import { generateProposal, transcribeAudio } from "./provider";
import { assertSamePageContext } from "./context-guard";
import { getProfile, getProfiles, getProviderConfig, isOriginPaused, saveProfile, saveProviderConfig, setOriginPaused } from "./profile-store";
import type { ExtensionMessage, MessageResult, PageContext, PageSnapshot, ProviderConfig, SiteProfile } from "./types";
import { validateProviderConfig } from "./validation";

const requests = new Map<number, AbortController>();

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  void syncRegisteredScripts();
});

chrome.runtime.onStartup.addListener(() => {
  void chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  void syncRegisteredScripts();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  requests.get(tabId)?.abort();
  requests.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === "loading") {
    requests.get(tabId)?.abort();
    requests.delete(tabId);
  }
});

function isWebUrl(value: string | undefined): value is string {
  return !!value && (value.startsWith("https://") || value.startsWith("http://"));
}

async function activeTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) throw new Error("Open a regular http or https page first.");
  return tab;
}

async function ensureContent(tabId: number): Promise<void> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "CONTENT_GET_CONTEXT" } satisfies ExtensionMessage) as MessageResult;
    if (response?.ok) return;
  } catch {
    // The activeTab grant allows this user-initiated one-page injection.
  }
  await chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", files: ["main-world.js"] });
  await chrome.scripting.executeScript({ target: { tabId }, world: "ISOLATED", files: ["content.js"] });
}

async function currentContext(tab?: chrome.tabs.Tab): Promise<PageContext> {
  tab ??= await activeTab();
  await ensureContent(tab.id!);
  const response = await chrome.tabs.sendMessage(tab.id!, { type: "CONTENT_GET_CONTEXT" } satisfies ExtensionMessage) as MessageResult<PageContext>;
  if (!response.ok || !response.data) throw new Error(response.error ?? "Could not inspect the current page.");
  if (!isWebUrl(response.data.url)) throw new Error("Open a regular http or https page first.");
  return { ...response.data, tabId: tab.id!, title: tab.title ?? response.data.title, url: response.data.url, origin: new URL(response.data.url).origin };
}

async function inspect(): Promise<PageSnapshot> {
  const tab = await activeTab();
  const expected = await currentContext(tab);
  const response = await chrome.tabs.sendMessage(tab.id!, { type: "CONTENT_SNAPSHOT" } satisfies ExtensionMessage) as MessageResult<PageSnapshot>;
  if (!response.ok || !response.data) throw new Error(response.error ?? "Could not read the permitted page.");
  const latest = await currentContext(tab);
  if (latest.documentToken !== expected.documentToken || latest.navigationToken !== expected.navigationToken || latest.url !== expected.url) {
    throw new Error("The page changed while it was being inspected. Try again.");
  }
  return { ...response.data, context: latest };
}

function scriptId(origin: string, world: "main" | "isolated"): string {
  let first = 2166136261;
  let second = 2246822519;
  for (let index = 0; index < origin.length; index += 1) {
    const code = origin.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 3266489917);
  }
  return `mmw_${world}_${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`;
}

async function registerOrigin(origin: string): Promise<void> {
  const matches = [`${origin}/*`];
  const ids = [scriptId(origin, "main"), scriptId(origin, "isolated")];
  await chrome.scripting.unregisterContentScripts({ ids }).catch(() => undefined);
  await chrome.scripting.registerContentScripts([
    { id: ids[0]!, matches, js: ["main-world.js"], runAt: "document_start", world: "MAIN", persistAcrossSessions: true },
    { id: ids[1]!, matches, js: ["content.js"], runAt: "document_start", world: "ISOLATED", persistAcrossSessions: true },
  ]);
}

async function syncRegisteredScripts(): Promise<void> {
  const profiles = await getProfiles();
  for (const origin of Object.keys(profiles)) {
    const granted = await chrome.permissions.contains({ origins: [`${origin}/*`] });
    if (granted) await registerOrigin(origin);
  }
}

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case "GET_ACTIVE_CONTEXT":
      return currentContext();
    case "GET_ACTIVE_TAB_ID":
      return (await activeTab()).id;
    case "REQUEST_ACTIVE_SITE_ACCESS": {
      const tab = await activeTab();
      if (!chrome.permissions.addHostAccessRequest) {
        throw new Error("Chrome could not show a site-access prompt. Click the Match My Web toolbar button once, then try Inspect again.");
      }
      await chrome.permissions.addHostAccessRequest({ tabId: tab.id! });
      return true;
    }
    case "INSPECT_ACTIVE_PAGE":
      return inspect();
    case "GET_PROVIDER_CONFIG": {
      const config = await getProviderConfig();
      return config ? { ...config, apiKey: "" } : null;
    }
    case "SAVE_PROVIDER_CONFIG": {
      const existing = await getProviderConfig();
      const retainedKey = existing?.provider === message.config.provider ? existing.apiKey : "";
      const merged = { ...message.config, apiKey: message.config.apiKey || retainedKey } as ProviderConfig;
      await saveProviderConfig(validateProviderConfig(merged));
      return true;
    }
    case "GET_PROFILE_FOR_URL":
      if (!isWebUrl(message.url)) return null;
      return await isOriginPaused(new URL(message.url).origin) ? null : getProfile(new URL(message.url).origin);
    case "GET_SITE_STATUS": {
      const actual = await currentContext();
      const [profile, paused] = await Promise.all([getProfile(actual.origin), isOriginPaused(actual.origin)]);
      return { hasProfile: profile !== null, paused };
    }
    case "SET_SITE_PAUSED": {
      const actual = await currentContext();
      assertSamePageContext(actual, message.context);
      await setOriginPaused(actual.origin, message.paused);
      if (message.paused) {
        await chrome.tabs.sendMessage(actual.tabId, { type: "CONTENT_CLEAR", context: actual } satisfies ExtensionMessage);
      } else {
        const profile = await getProfile(actual.origin);
        if (profile) {
          await chrome.tabs.sendMessage(actual.tabId, { type: "CONTENT_APPLY", context: actual, patch: profile.patch, mode: "approved" } satisfies ExtensionMessage);
        }
      }
      return { hasProfile: (await getProfile(actual.origin)) !== null, paused: message.paused };
    }
    case "GENERATE_PROPOSAL": {
      const config = await getProviderConfig();
      if (!config) throw new Error("Save your AI provider, model, and API key first.");
      const actual = await currentContext();
      assertSamePageContext(actual, message.snapshot.context);
      requests.get(actual.tabId)?.abort();
      const controller = new AbortController();
      requests.set(actual.tabId, controller);
      try {
        const proposal = await generateProposal(config, message.request, message.snapshot, controller.signal);
        const latest = await currentContext();
        assertSamePageContext(latest, actual);
        return { proposal, context: latest };
      } finally {
        if (requests.get(actual.tabId) === controller) requests.delete(actual.tabId);
      }
    }
    case "APPLY_PREVIEW": {
      const actual = await currentContext();
      assertSamePageContext(actual, message.context);
      const response = await chrome.tabs.sendMessage(actual.tabId, { type: "CONTENT_APPLY", context: actual, patch: message.proposal.patch, mode: "preview" } satisfies ExtensionMessage) as MessageResult;
      if (!response.ok) throw new Error(response.error ?? "Preview failed.");
      return true;
    }
    case "REVERT_PREVIEW": {
      const actual = await currentContext();
      assertSamePageContext(actual, message.context);
      const response = await chrome.tabs.sendMessage(actual.tabId, { type: "CONTENT_REVERT", context: actual } satisfies ExtensionMessage) as MessageResult;
      if (!response.ok) throw new Error(response.error ?? "Could not undo the preview.");
      return true;
    }
    case "SAVE_PROFILE": {
      const actual = await currentContext();
      assertSamePageContext(actual, message.context);
      const permission = await chrome.permissions.contains({ origins: [`${actual.origin}/*`] });
      if (!permission) throw new Error("Ongoing access to this site was not granted, so the profile was not saved.");
      const now = new Date().toISOString();
      const previous = await getProfile(actual.origin);
      const profile: SiteProfile = {
        id: previous?.id ?? crypto.randomUUID(),
        origin: actual.origin,
        name: message.proposal.summary,
        patch: message.proposal.patch,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
        schemaVersion: 1,
      };
      await saveProfile(profile);
      await setOriginPaused(actual.origin, false);
      await registerOrigin(actual.origin);
      await chrome.tabs.sendMessage(actual.tabId, { type: "CONTENT_APPLY", context: actual, patch: profile.patch, mode: "approved" } satisfies ExtensionMessage);
      return profile;
    }
    case "TRANSCRIBE_AUDIO": {
      const config = await getProviderConfig();
      if (!config) throw new Error("Save an OpenAI provider first.");
      return transcribeAudio(config, message.base64, message.mimeType);
    }
    default:
      throw new Error("Unsupported message.");
  }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse: (result: MessageResult) => void) => {
  void handleMessage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error: unknown) => {
      const text = error instanceof DOMException && error.name === "AbortError"
        ? "Generation was canceled because the page changed or a newer request started."
        : error instanceof Error ? error.message : "Unexpected extension error.";
      sendResponse({ ok: false, error: text });
    });
  return true;
});
