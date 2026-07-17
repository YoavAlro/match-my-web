import { buildAdaptationCss } from "./adaptation-css";
import type { AdaptationPatch, ExtensionMessage, MessageResult, PageContext, PageSnapshot, SiteProfile } from "./types";

declare global {
  interface Window { __MATCH_MY_WEB_CONTENT__?: boolean; }
}

if (!window.__MATCH_MY_WEB_CONTENT__) {
  window.__MATCH_MY_WEB_CONTENT__ = true;
  const documentToken = crypto.randomUUID();
  let navigationToken = crypto.randomUUID();
  let trackedUrl = location.href;
  let approvedPatch: AdaptationPatch | null = null;
  let previewPatch: AdaptationPatch | null = null;

  function context(): PageContext {
    return {
      tabId: -1,
      documentToken,
      navigationToken,
      url: location.href,
      origin: location.origin,
      title: document.title,
    };
  }

  function contextMatches(expected: PageContext): boolean {
    return expected.documentToken === documentToken
      && expected.navigationToken === navigationToken
      && expected.url === location.href;
  }

  function applyPatch(patch: AdaptationPatch | null): void {
    let style = document.getElementById("match-my-web-root") as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "match-my-web-root";
      (document.head ?? document.documentElement).append(style);
    }
    style.textContent = patch ? buildAdaptationCss(patch) : "";
    window.dispatchEvent(new CustomEvent("match-my-web:shadow-patch", { detail: { patch } }));
  }

  async function loadApprovedProfile(): Promise<void> {
    const response = await chrome.runtime.sendMessage({ type: "GET_PROFILE_FOR_URL", url: location.href } satisfies ExtensionMessage) as MessageResult<SiteProfile | null>;
    if (!response.ok || trackedUrl !== location.href) return;
    approvedPatch = response.data?.patch ?? null;
    previewPatch = null;
    applyPatch(approvedPatch);
  }

  function cleanText(value: string | null | undefined): string {
    return (value ?? "").replace(/\s+/g, " ").trim();
  }

  function uniqueText(selector: string, limit: number): string[] {
    const values = new Set<string>();
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      if (element.closest("[aria-hidden='true'], script, style, noscript, template")) continue;
      const label = cleanText(element.getAttribute("aria-label") || element.innerText || element.textContent);
      if (label) values.add(label.slice(0, 240));
      if (values.size >= limit) break;
    }
    return [...values];
  }

  function visibleTextExcerpt(): string {
    const walker = document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest("script, style, noscript, template, input, textarea, select, [contenteditable='true'], [aria-hidden='true']")) {
          return NodeFilter.FILTER_REJECT;
        }
        const text = cleanText(node.textContent);
        if (!text) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const chunks: string[] = [];
    let length = 0;
    while (walker.nextNode() && length < 18_000) {
      const text = cleanText(walker.currentNode.textContent);
      chunks.push(text);
      length += text.length + 1;
    }
    return chunks.join(" ").slice(0, 18_000);
  }

  function snapshot(): PageSnapshot {
    return {
      context: context(),
      headings: uniqueText("h1, h2, h3, [role='heading']", 60),
      landmarks: uniqueText("main, nav, aside, header, footer, [role='main'], [role='navigation'], [role='complementary']", 30),
      controls: uniqueText("button, a[href], summary, [role='button'], [role='link'], input:not([type='password']), select, textarea", 100),
      text: visibleTextExcerpt(),
    };
  }

  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse: (value: MessageResult) => void) => {
    if (message.type === "CONTENT_GET_CONTEXT") {
      sendResponse({ ok: true, data: context() });
      return;
    }
    if (message.type === "CONTENT_SNAPSHOT") {
      sendResponse({ ok: true, data: snapshot() });
      return;
    }
    if (message.type === "CONTENT_APPLY") {
      if (!contextMatches(message.context)) {
        sendResponse({ ok: false, error: "This page changed before the adaptation could be applied." });
        return;
      }
      if (message.mode === "approved") approvedPatch = message.patch;
      else previewPatch = message.patch;
      applyPatch(previewPatch ?? approvedPatch);
      sendResponse({ ok: true });
      return;
    }
    if (message.type === "CONTENT_CLEAR") {
      if (!contextMatches(message.context)) {
        sendResponse({ ok: false, error: "This page changed before adaptations could be paused." });
        return;
      }
      approvedPatch = null;
      previewPatch = null;
      applyPatch(null);
      sendResponse({ ok: true });
      return;
    }
    if (message.type === "CONTENT_REVERT") {
      if (!contextMatches(message.context)) {
        sendResponse({ ok: false, error: "This page changed before the preview could be undone." });
        return;
      }
      previewPatch = null;
      applyPatch(approvedPatch);
      sendResponse({ ok: true });
    }
  });

  function checkNavigation(): void {
    if (location.href === trackedUrl) return;
    trackedUrl = location.href;
    navigationToken = crypto.randomUUID();
    previewPatch = null;
    void loadApprovedProfile();
  }

  window.addEventListener("popstate", checkNavigation);
  window.addEventListener("hashchange", checkNavigation);
  new MutationObserver(checkNavigation).observe(document.documentElement, { childList: true, subtree: true });
  void loadApprovedProfile();
}
