import { hasAdaptationChanges, type ApplyReport, type ChatTurn, type ExtensionMessage, type MessageResult, type PageContext, type PageSnapshot, type Proposal, type ProviderConfig, type SharedDesign, type SiteProfile, type SiteStatus } from "./types";
import { classifyChatAction, type ChatAction } from "./chat-actions";
import { changesEffectiveDesign, mergeAdaptationPatches } from "./patch-merge";

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing UI element: ${id}`);
  return element as T;
};

const pageBadge = $("page-badge");
const pageDetail = $("page-detail");
const status = $("status");
const conversation = $("conversation");
const actionDock = $("action-dock");
const prompt = $<HTMLTextAreaElement>("prompt");
const proposalSection = $<HTMLElement>("proposal");
const proposalSummary = $("proposal-summary");
const proposalDetails = $("proposal-details");
const previewButton = $<HTMLButtonElement>("preview");
const saveButton = $<HTMLButtonElement>("save");
const recordButton = $<HTMLButtonElement>("record");
const providerSelect = $<HTMLSelectElement>("provider");
const azureSettings = $("azure-settings");
const endpointInput = $<HTMLInputElement>("endpoint");
const voiceNote = $("voice-note");
const pauseSiteButton = $<HTMLButtonElement>("pause-site");
const exportLogButton = $<HTMLButtonElement>("export-log");
const shareDesignButton = $<HTMLButtonElement>("share-design");
const importDesignButton = $<HTMLButtonElement>("import-design");
const importDesignFile = $<HTMLInputElement>("import-design-file");
const actionsMenu = $<HTMLElement>("actions-menu");
const settingsDialog = $<HTMLDialogElement>("settings-dialog");
const CHAT_HISTORY_KEY_PREFIX = "chat-history.session.v1:";
const DIAGNOSTIC_KEY_PREFIX = "diagnostics.session.v1:";
const DEFAULT_PROMPT_PLACEHOLDER = "Try: Make this calmer and easier to scan…";

let snapshot: PageSnapshot | null = null;
let activeProposal: Proposal | null = null;
let proposalContext: PageContext | null = null;
let previewActive = false;
let recorder: MediaRecorder | null = null;
let recordingTimer: number | null = null;
interface LocalSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
interface LocalSpeechConstructor {
  new(): LocalSpeechRecognition;
  available?: (options: { langs: string[]; processLocally: boolean }) => Promise<string>;
  install?: (options: { langs: string[]; processLocally: boolean }) => Promise<boolean>;
}
let localRecognition: LocalSpeechRecognition | null = null;
let currentPageContext: PageContext | null = null;
let currentSiteStatus: SiteStatus = { hasProfile: false, paused: false };
let currentSiteProfile: SiteProfile | null = null;
let currentProviderMetadata: { provider: ProviderConfig["provider"]; model: string; endpointOrigin?: string } | null = null;
const chatHistory: ChatTurn[] = [];
interface DiagnosticEvent {
  timestamp: string;
  type: string;
  data: unknown;
}
const diagnosticEvents: DiagnosticEvent[] = [];
let historyOrigin = "";
let generationEpoch = 0;

function chatHistoryKey(origin: string): string {
  return `${CHAT_HISTORY_KEY_PREFIX}${encodeURIComponent(origin)}`;
}

function diagnosticKey(origin: string): string {
  return `${DIAGNOSTIC_KEY_PREFIX}${encodeURIComponent(origin)}`;
}

function pageWithoutQuery(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "unavailable";
  }
}

function logDiagnostic(type: string, data: unknown): void {
  diagnosticEvents.push({ timestamp: new Date().toISOString(), type, data });
  if (diagnosticEvents.length > 100) diagnosticEvents.splice(0, diagnosticEvents.length - 100);
  if (historyOrigin) void chrome.storage.session.set({ [diagnosticKey(historyOrigin)]: diagnosticEvents });
}

function remember(role: ChatTurn["role"], content: string): void {
  chatHistory.push({ role, content: content.slice(0, 1200) });
  if (chatHistory.length > 12) chatHistory.splice(0, chatHistory.length - 12);
  if (historyOrigin) void chrome.storage.session.set({ [chatHistoryKey(historyOrigin)]: chatHistory });
}

async function useChatHistory(origin: string): Promise<void> {
  if (historyOrigin === origin) return;
  historyOrigin = origin;
  chatHistory.length = 0;
  diagnosticEvents.length = 0;
  conversation.replaceChildren();
  const key = chatHistoryKey(origin);
  const diagnosticsStorageKey = diagnosticKey(origin);
  const storage = await chrome.storage.session.get([key, diagnosticsStorageKey]);
  const stored = storage[key];
  const storedDiagnostics = storage[diagnosticsStorageKey];
  if (historyOrigin !== origin) return;
  if (Array.isArray(storedDiagnostics)) diagnosticEvents.push(...storedDiagnostics.slice(-100));
  if (!Array.isArray(stored)) return;
  const restored = stored
    .filter((turn): turn is ChatTurn => !!turn && (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string")
    .slice(-12);
  chatHistory.push(...restored);
  for (const turn of restored) addMessage(`${turn.role === "user" ? "You" : "Tweaksy"}: ${turn.content}`);
}

function updateProviderFields(): void {
  const isAzure = providerSelect.value === "azure";
  azureSettings.hidden = !isAzure;
  endpointInput.required = isAzure;
  if (providerSelect.value === "anthropic") {
    voiceNote.textContent = "Chrome on-device dictation is used when available. Provider fallback recording is unavailable with Anthropic.";
  } else if (isAzure) {
    voiceNote.textContent = "Chrome on-device dictation is preferred. Fallback recording requires a separate Azure speech-to-text deployment. Audio is never saved.";
  } else {
    voiceNote.textContent = "Chrome on-device dictation is preferred. If unavailable, audio uses your configured OpenAI provider and is never saved.";
  }
}

function azurePermissionOrigin(value: string): string {
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new Error("Enter a valid Azure OpenAI endpoint before saving.");
  }
  const host = endpoint.hostname.toLowerCase();
  const isAzureHost = host.endsWith(".openai.azure.com")
    || host.endsWith(".services.ai.azure.com")
    || host.endsWith(".cognitiveservices.azure.com");
  if (endpoint.protocol !== "https:" || !isAzureHost || endpoint.username || endpoint.password) {
    throw new Error("Use the HTTPS resource endpoint provided by Microsoft Azure.");
  }
  return `${endpoint.origin}/*`;
}

function providerMetadata(config: ProviderConfig): { provider: ProviderConfig["provider"]; model: string; endpointOrigin?: string } {
  return {
    provider: config.provider,
    model: config.model,
    ...(config.endpoint ? { endpointOrigin: new URL(config.endpoint).origin } : {}),
  };
}

async function send<T>(message: ExtensionMessage): Promise<T> {
  const timeoutMs = message.type === "GENERATE_PROPOSAL" || message.type === "TRANSCRIBE_AUDIO" ? 90_000 : 20_000;
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error("The extension action timed out. You can try again without reloading the panel.")), timeoutMs);
  });
  const result = await Promise.race([
    chrome.runtime.sendMessage(message) as Promise<MessageResult<T>>,
    timeout,
  ]).finally(() => {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  });
  if (!result.ok) throw new Error(result.error ?? "The extension could not complete that action.");
  return result.data as T;
}

function setStatus(message: string, isError = false): void {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function addMessage(message: string, isError = false, reveal = true): void {
  const item = document.createElement("div");
  const isUser = message.startsWith("You:");
  item.className = `message${isUser ? " user" : " assistant"}${isError ? " error" : ""}`;
  item.textContent = message.replace(/^(?:You|Tweaksy|Match My Web):\s*/, "");
  conversation.append(item);
  if (reveal) conversation.scrollTop = conversation.scrollHeight;
}

function addThinking(label: string): { update: (value: string) => void; remove: () => void } {
  const item = document.createElement("div");
  item.className = "message assistant thinking";
  const dots = document.createElement("span");
  dots.className = "thinking-dots";
  dots.setAttribute("aria-hidden", "true");
  dots.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
  const text = document.createElement("span");
  text.textContent = label;
  item.append(dots, text);
  conversation.append(item);
  conversation.scrollTop = conversation.scrollHeight;
  return {
    update(value) { text.textContent = value; },
    remove() { item.remove(); },
  };
}

function busy(button: HTMLButtonElement, value: boolean, busyLabel: string): void {
  if (value) button.dataset.originalLabel = button.textContent ?? "";
  button.disabled = value;
  button.textContent = value ? busyLabel : button.dataset.originalLabel ?? button.textContent;
  button.setAttribute("aria-busy", String(value));
}

actionsMenu.addEventListener("click", (event) => {
  if (!(event.target as Element).closest("button")) return;
  window.setTimeout(() => {
    if (actionsMenu.matches(":popover-open")) actionsMenu.hidePopover();
  });
});

function patchEntries(proposal: Proposal): Array<[string, string]> {
  return [
    ["Text size", proposal.patch.fontScale === null ? "Unchanged" : `${Math.round(proposal.patch.fontScale * 100)}%`],
    ["Line height", proposal.patch.lineHeight === null ? "Unchanged" : String(proposal.patch.lineHeight)],
    ["Letter spacing", proposal.patch.letterSpacingEm === null ? "Unchanged" : `${proposal.patch.letterSpacingEm}em`],
    ["Content width", proposal.patch.contentMaxWidthRem ? `${proposal.patch.contentMaxWidthRem}rem` : "Unchanged"],
    ["Heading color", proposal.patch.headingColor ?? "Unchanged"],
    ["Article layout", proposal.patch.articleLayout === "swipe-cards" ? "Swipeable cards" : "Unchanged"],
    ["Deck controls", proposal.patch.deckControls === "sides" ? "Beside the cards" : "Unchanged"],
    ["Card images", proposal.patch.deckImageSize === "compact" ? "Compact" : "Unchanged"],
    ["Open article link", proposal.patch.deckLinkPosition === "footer" ? "Card footer" : "Unchanged"],
    ["Red colors", proposal.patch.colorVisionMode === "avoid-red" ? "Remapped to blue/teal" : "Unchanged"],
    ["Visual theme", proposal.patch.themePreset === "unchanged" ? "Unchanged" : proposal.patch.themePreset.replace(/-/g, " ")],
    ["Color scheme", proposal.patch.colorScheme],
    ["Contrast", proposal.patch.contrast],
    ["Motion", proposal.patch.reduceMotion ? "Reduced" : "Unchanged"],
    ["Focus indicator", proposal.patch.strongFocus ? "Strengthened" : "Unchanged"],
    ["Hidden regions", proposal.patch.hideSelectors.length ? proposal.patch.hideSelectors.join(", ") : "None"],
    ["Reset to site default", proposal.resetFields?.length ? proposal.resetFields.join(", ") : "None"],
  ];
}

function describePatch(proposal: Proposal, context: PageContext): boolean {
  if (!hasAdaptationChanges(proposal.patch) && !proposal.resetFields?.length) {
    activeProposal = null;
    proposalContext = null;
    actionDock.replaceChildren();
    actionDock.hidden = true;
    addMessage(`Tweaksy: ${proposal.summary}`);
    setStatus("The response contains no previewable visual change. Refine the request and try again.");
    return false;
  }
  proposalSummary.textContent = proposal.summary;
  proposalDetails.replaceChildren();
  const entries = patchEntries(proposal);
  for (const [term, description] of entries) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = term;
    dd.textContent = description;
    proposalDetails.append(dt, dd);
  }
  proposalSection.hidden = true;
  saveButton.disabled = true;

  addMessage(`Tweaksy: ${proposal.summary}`);
  const card = document.createElement("article");
  card.className = "action-card";
  const copy = document.createElement("div");
  copy.className = "action-card-copy";
  const summary = document.createElement("p");
  summary.textContent = proposal.summary;
  copy.append(summary);
  const details = document.createElement("details");
  const detailsSummary = document.createElement("summary");
  detailsSummary.textContent = "Review exact changes";
  const list = document.createElement("dl");
  for (const [term, description] of entries.filter(([, value]) => value !== "Unchanged" && value !== "None")) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = term;
    dd.textContent = description;
    list.append(dt, dd);
  }
  details.append(detailsSummary, list);
  const actions = document.createElement("div");
  actions.className = "action-buttons";
  const actionStatus = document.createElement("div");
  actionStatus.className = "action-result";
  actionStatus.setAttribute("role", "status");
  actionStatus.setAttribute("aria-live", "polite");
  const actionMessage = document.createElement("span");
  actionMessage.className = "action-result-message";
  actionMessage.textContent = "Preview this proposal. Existing design settings stay in place unless explicitly reset.";
  const feedback = document.createElement("button");
  feedback.type = "button";
  feedback.className = "feedback-button";
  feedback.textContent = "Cancel & revise";
  feedback.setAttribute("aria-label", "Cancel this proposal and give feedback");
  actionStatus.append(actionMessage, feedback);
  const preview = document.createElement("button");
  preview.type = "button";
  preview.className = "primary";
  preview.dataset.action = "preview";
  preview.textContent = "Preview";
  preview.setAttribute("aria-label", "Preview this proposal on the current page");
  preview.title = "Preview on page";
  const approve = document.createElement("button");
  approve.type = "button";
  approve.className = "primary";
  approve.dataset.action = "save";
  approve.textContent = "Save";
  approve.setAttribute("aria-label", "Approve and save this design for the current website");
  approve.title = "Approve and save";
  approve.disabled = true;
  const undo = document.createElement("button");
  undo.type = "button";
  undo.className = "secondary";
  undo.dataset.action = "undo";
  undo.textContent = "Undo";
  undo.setAttribute("aria-label", "Undo the temporary preview");
  undo.title = "Undo preview";
  undo.disabled = true;
  preview.addEventListener("click", async () => {
    let applied = false;
    busy(preview, true, "Applying…");
    actionMessage.textContent = "Applying and measuring the preview…";
    try {
      const report = await runPreview(proposal, context, false);
      applied = true;
      approve.disabled = false;
      undo.disabled = false;
      actionMessage.textContent = report.details.join(" ") || `Preview changed ${report.affectedElements} page elements.`;
    } catch (error) {
      actionMessage.textContent = error instanceof Error ? error.message : "Preview failed.";
      reportError(error, "Preview failed.", false);
    } finally {
      busy(preview, false, "");
      if (applied) preview.textContent = "Again";
    }
  });
  approve.addEventListener("click", async () => {
    let saved = false;
    busy(approve, true, "Saving…");
    actionMessage.textContent = "Requesting site access and saving this design…";
    try {
      await runSave(proposal, context, false);
      saved = true;
      actionMessage.textContent = "Saved locally. This design will return on this website.";
    } catch (error) {
      actionMessage.textContent = error instanceof Error ? error.message : "Could not save the profile.";
      reportError(error, "Could not save the profile.", false);
    } finally {
      busy(approve, false, "");
      if (saved) {
        approve.textContent = "Saved";
        approve.disabled = true;
      }
    }
  });
  undo.addEventListener("click", async () => {
    let reverted = false;
    busy(undo, true, "Undoing…");
    actionMessage.textContent = "Removing the temporary preview…";
    try {
      await runRevert(context, false);
      reverted = true;
      approve.disabled = true;
      actionMessage.textContent = "Preview removed. You can preview this proposal again.";
    } catch (error) {
      actionMessage.textContent = error instanceof Error ? error.message : "Could not undo the preview.";
      reportError(error, "Could not undo the preview.", false);
    } finally {
      busy(undo, false, "");
      if (reverted) undo.disabled = true;
    }
  });
  feedback.addEventListener("click", async () => {
    busy(feedback, true, "Canceling…");
    try {
      await cancelProposalForFeedback(proposal, context);
    } catch (error) {
      actionMessage.textContent = error instanceof Error ? error.message : "Could not cancel this proposal.";
      reportError(error, "Could not cancel this proposal.", false);
      busy(feedback, false, "");
    }
  });
  actions.append(preview, approve, undo);
  card.append(copy, details, actionStatus, actions);
  actionDock.replaceChildren(card);
  actionDock.hidden = false;
  conversation.scrollTop = conversation.scrollHeight;
  logDiagnostic("proposal", { summary: proposal.summary, patch: proposal.patch, context: { origin: context.origin, page: pageWithoutQuery(context.url) } });
  return true;
}

function updateActionDock(state: "previewed" | "saved" | "reverted", message: string): void {
  if (actionDock.hidden) return;
  const preview = actionDock.querySelector<HTMLButtonElement>("[data-action='preview']");
  const save = actionDock.querySelector<HTMLButtonElement>("[data-action='save']");
  const undo = actionDock.querySelector<HTMLButtonElement>("[data-action='undo']");
  const result = actionDock.querySelector<HTMLElement>(".action-result-message");
  if (result) result.textContent = message;
  if (state === "previewed") {
    if (preview) preview.textContent = "Again";
    if (save) save.disabled = false;
    if (undo) undo.disabled = false;
  } else if (state === "saved") {
    if (save) {
      save.textContent = "Saved";
      save.disabled = true;
    }
    if (undo) undo.disabled = false;
  } else {
    if (preview) preview.textContent = "Preview";
    if (save) save.disabled = true;
    if (undo) undo.disabled = true;
  }
}

function closeActionDock(): void {
  actionDock.replaceChildren();
  actionDock.hidden = true;
}

async function cancelProposalForFeedback(proposal: Proposal, context: PageContext): Promise<void> {
  if (activeProposal !== proposal || proposalContext !== context) {
    throw new Error("This proposal is no longer active.");
  }
  generationEpoch += 1;
  if (previewActive) await runRevert(context, false);
  activeProposal = null;
  proposalContext = null;
  previewActive = false;
  saveButton.disabled = true;
  closeActionDock();
  const message = "Proposal canceled. Tell me what was wrong or what should be different, and I’ll use that feedback for the next proposal.";
  addMessage(`Tweaksy: ${message}`);
  remember("assistant", message);
  logDiagnostic("proposal-rejected", { summary: proposal.summary, patch: proposal.patch, context: { origin: context.origin, page: pageWithoutQuery(context.url) } });
  setStatus("Proposal canceled. Add your feedback in chat.");
  prompt.placeholder = "What wasn’t right? Describe what should change…";
  prompt.focus();
}

function reportError(error: unknown, fallback: string, reveal = true): void {
  const message = error instanceof Error ? error.message : fallback;
  addMessage(`Tweaksy: ${message}`, true, reveal);
  setStatus(message, true);
  logDiagnostic("error", { message });
}

async function refreshContext(): Promise<void> {
  try {
    const context = await send<PageContext>({ type: "GET_ACTIVE_CONTEXT" });
    currentPageContext = context;
    await useChatHistory(context.origin);
    pageBadge.textContent = "Ready";
    pageDetail.textContent = `${context.title || "Untitled page"} — ${context.origin}`;
    await refreshSiteStatus();
  } catch (error) {
    pageBadge.textContent = "Unavailable";
    pageDetail.textContent = error instanceof Error ? error.message : "This page cannot be adapted.";
  }
}

function renderSiteStatus(): void {
  pauseSiteButton.disabled = !currentSiteStatus.hasProfile;
  pauseSiteButton.textContent = !currentSiteStatus.hasProfile
    ? "No saved profile"
    : currentSiteStatus.paused ? "Resume on this site" : "Pause on this site";
  pauseSiteButton.setAttribute("aria-pressed", String(currentSiteStatus.paused));
  shareDesignButton.disabled = !currentSiteStatus.hasProfile || !currentSiteProfile;
}

async function refreshSiteStatus(): Promise<void> {
  [currentSiteStatus, currentSiteProfile] = await Promise.all([
    send<SiteStatus>({ type: "GET_SITE_STATUS" }),
    send<SiteProfile | null>({ type: "GET_ACTIVE_PROFILE" }),
  ]);
  renderSiteStatus();
}

async function setSitePaused(paused: boolean): Promise<void> {
  const context = currentPageContext ?? await send<PageContext>({ type: "GET_ACTIVE_CONTEXT" });
  currentPageContext = context;
  currentSiteStatus = await send<SiteStatus>({ type: "SET_SITE_PAUSED", context, paused });
  renderSiteStatus();
  setStatus(paused ? "Saved adaptations are paused on this site." : "Saved adaptations are active on this site.");
}

async function inspectWithAccessPrompt(): Promise<PageSnapshot> {
  try {
    return await send<PageSnapshot>({ type: "INSPECT_ACTIVE_PAGE" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/cannot access contents|permission to access|host/i.test(message)) throw error;
    const tabId = await send<number>({ type: "GET_ACTIVE_TAB_ID" });
    if (chrome.permissions.addHostAccessRequest) {
      try {
        await chrome.permissions.addHostAccessRequest({ tabId });
      } catch (permissionError) {
        const permissionMessage = permissionError instanceof Error ? permissionError.message : "";
        if (/already has access/i.test(permissionMessage)) {
          return await send<PageSnapshot>({ type: "INSPECT_ACTIVE_PAGE" });
        }
        throw permissionError;
      }
    }
    throw new Error("Chrome is asking for access to this site. Choose Allow, then click Inspect this page again.");
  }
}

async function inspectCurrentPage(): Promise<PageSnapshot> {
  snapshot = await inspectWithAccessPrompt();
  currentPageContext = snapshot.context;
  pageBadge.textContent = "Inspected";
  pageDetail.textContent = `${snapshot.context.title || "Untitled page"} — ${snapshot.context.origin}`;
  setStatus("Page structure is ready. Nothing has been sent to an AI provider yet.");
  return snapshot;
}

$("inspect").addEventListener("click", async (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  busy(button, true, "Inspecting…");
  try {
    await inspectCurrentPage();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Inspection failed.", true);
  } finally {
    busy(button, false, "");
  }
});

$("settings-open").addEventListener("click", () => settingsDialog.showModal());
$("settings-close").addEventListener("click", () => settingsDialog.close());
settingsDialog.addEventListener("click", (event) => {
  if (event.target === settingsDialog) settingsDialog.close();
});

$("provider-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const button = form.querySelector<HTMLButtonElement>("button[type='submit']")!;
  const config: ProviderConfig = {
    provider: providerSelect.value as ProviderConfig["provider"],
    model: $<HTMLInputElement>("model").value.trim(),
    apiKey: $<HTMLInputElement>("api-key").value.trim(),
    ...(providerSelect.value === "azure" ? { endpoint: endpointInput.value.trim() } : {}),
    ...($<HTMLInputElement>("transcription-model").value.trim()
      ? { transcriptionModel: $<HTMLInputElement>("transcription-model").value.trim() }
      : {}),
  };
  busy(button, true, "Saving…");
  try {
    const providerOrigin = config.provider === "openai"
      ? "https://api.openai.com/*"
      : config.provider === "anthropic"
        ? "https://api.anthropic.com/*"
        : azurePermissionOrigin(config.endpoint ?? "");
    const granted = await chrome.permissions.request({ origins: [providerOrigin] });
    if (!granted) throw new Error("Provider access was not granted. The extension cannot contact that API.");
    await send<boolean>({ type: "SAVE_PROVIDER_CONFIG", config });
    currentProviderMetadata = providerMetadata(config);
    $<HTMLInputElement>("api-key").value = "";
    setStatus("Provider saved locally.");
    settingsDialog.close();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not save the provider.", true);
  } finally {
    busy(button, false, "");
  }
});

function recordRoutedRequest(request: string, action: ChatAction): void {
  addMessage(`You: ${request}`);
  remember("user", request);
  logDiagnostic("user-message", { content: request, routedAction: action });
}

function replyToRoutedRequest(message: string): void {
  addMessage(`Tweaksy: ${message}`);
  remember("assistant", message);
  setStatus(message);
}

async function executeChatAction(action: ChatAction): Promise<void> {
  switch (action) {
    case "credentials-manual":
      settingsDialog.showModal();
      replyToRoutedRequest("I opened Settings. For your privacy, API keys and provider credentials must be entered and saved manually there.");
      return;
    case "open-settings":
      settingsDialog.showModal();
      replyToRoutedRequest("Settings are open. Credential fields remain manual-only.");
      return;
    case "import-design":
      importDesignFile.click();
      replyToRoutedRequest("Choose a Tweaksy design file. I will validate it and place its Preview and Approve controls in this chat.");
      return;
    case "share-design":
      await shareCurrentDesign();
      return;
    case "export-debug": {
      const message = await exportDiagnosticLog();
      replyToRoutedRequest(message);
      return;
    }
    case "inspect-page": {
      const inspected = await inspectCurrentPage();
      replyToRoutedRequest(`Inspected ${inspected.context.title || inspected.context.origin}. Page structure is ready and has not been sent to an AI provider.`);
      return;
    }
    case "preview":
      if (!activeProposal || !proposalContext) throw new Error("There is no pending design to preview. Describe the visual change you want first.");
      await runPreview(activeProposal, proposalContext);
      return;
    case "reject-proposal":
      if (!activeProposal || !proposalContext) throw new Error("There is no pending proposal to cancel.");
      await cancelProposalForFeedback(activeProposal, proposalContext);
      return;
    case "undo":
      if (!proposalContext) throw new Error("There is no preview to undo on this page.");
      await runRevert(proposalContext);
      return;
    case "save-design":
      if (!activeProposal || !proposalContext) {
        if (currentSiteProfile) {
          replyToRoutedRequest("This website already has a saved local design. Ask me for a new change before replacing it.");
          return;
        }
        throw new Error("There is no pending design to save. Describe a change or import a design first.");
      }
      await runSave(activeProposal, proposalContext);
      return;
    case "pause-site":
      if (!currentSiteStatus.hasProfile) throw new Error("There is no saved design to pause on this website.");
      await setSitePaused(true);
      replyToRoutedRequest("Saved adaptations are paused on this website.");
      return;
    case "resume-site":
      if (!currentSiteStatus.hasProfile) throw new Error("There is no saved design to resume on this website.");
      await setSitePaused(false);
      replyToRoutedRequest("Saved adaptations are active on this website again.");
      return;
  }
}

$("prompt-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const request = prompt.value.trim();
  if (!request) {
    prompt.focus();
    setStatus("Describe the change you want first.", true);
    return;
  }
  prompt.placeholder = DEFAULT_PROMPT_PLACEHOLDER;
  const chatAction = classifyChatAction(request);
  if (chatAction) {
    prompt.value = "";
    recordRoutedRequest(request, chatAction);
    try {
      await executeChatAction(chatAction);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setStatus("Action canceled.");
      else reportError(error, "The requested extension action could not be completed.");
    } finally {
      prompt.focus();
    }
    return;
  }
  const button = $<HTMLButtonElement>("generate");
  const generationId = ++generationEpoch;
  prompt.value = "";
  prompt.disabled = true;
  recordButton.disabled = true;
  busy(button, true, "Working…");
  let thinking: ReturnType<typeof addThinking> | null = null;
  try {
    const latestContext = await send<PageContext>({ type: "GET_ACTIVE_CONTEXT" });
    currentPageContext = latestContext;
    await useChatHistory(latestContext.origin);
    addMessage(`You: ${request}`);
    logDiagnostic("user-message", { content: request });
    const priorHistory = [...chatHistory];
    remember("user", request);
    thinking = addThinking("Understanding your request…");
    const asksHowToToggle = /\bhow\b.*\b(?:toggle|turn|switch|disable|pause|resume)\b|\bwhere\b.*\b(?:toggle|pause|resume)\b/i.test(request);
    if (asksHowToToggle) {
      const guidance = !saveButton.disabled
        ? "Use “Undo preview” to remove the temporary preview."
        : currentSiteStatus.hasProfile
          ? "Use “Pause on this site” in the Current page section. It changes to “Resume on this site” while paused."
          : "There is no saved adaptation active on this site. Previewed changes can be removed with “Undo preview”.";
      addMessage(`Tweaksy: ${guidance}`);
      remember("assistant", guidance);
      setStatus("No AI request was needed.");
      return;
    }
    const asksToApply = /\b(?:do it|apply (?:it|that|now)|preview (?:it|that)|just do it|comply)\b/i.test(request);
    if (asksToApply && activeProposal && proposalContext) {
      thinking.update("Applying the pending preview and measuring the result…");
      await runPreview(activeProposal, proposalContext);
      return;
    }
    const asksToUndo = /\b(?:undo|revert|remove the preview)\b/i.test(request);
    if (asksToUndo && proposalContext) {
      thinking.update("Undoing the preview…");
      await runRevert(proposalContext);
      return;
    }
    if (!activeProposal) await refreshSiteStatus();
    const basePatch = activeProposal?.patch ?? currentSiteProfile?.patch ?? null;
    snapshot = await inspectWithAccessPrompt();
    currentPageContext = snapshot.context;
    thinking.update("Building a safe, reversible proposal from the permitted page…");
    const result = await send<{ proposal: Proposal; context: PageContext; source?: "local" | "provider" }>({
      type: "GENERATE_PROPOSAL",
      request,
      snapshot,
      history: priorHistory,
      ...(basePatch ? { basePatch } : {}),
    });
    if (generationId !== generationEpoch) {
      logDiagnostic("proposal-discarded", { reason: "The pending proposal was canceled while this response was running." });
      return;
    }
    logDiagnostic("proposal-route", { source: result.source ?? "unknown" });
    const effectiveProposal: Proposal = {
      ...result.proposal,
      patch: mergeAdaptationPatches(basePatch, result.proposal.patch, result.proposal.resetFields),
    };
    logDiagnostic("proposal-merge", {
      basePatch,
      deltaPatch: result.proposal.patch,
      resetFields: result.proposal.resetFields ?? [],
      effectivePatch: effectiveProposal.patch,
    });
    if (!changesEffectiveDesign(basePatch, effectiveProposal.patch)) {
      thinking.remove();
      thinking = null;
      addMessage(`Tweaksy: ${effectiveProposal.summary}`);
      remember("assistant", effectiveProposal.summary);
      logDiagnostic("proposal-noop", { summary: effectiveProposal.summary, basePatch, deltaPatch: result.proposal.patch });
      setStatus("No new preview was created because the response did not change the active design.");
      return;
    }
    activeProposal = effectiveProposal;
    proposalContext = result.context;
    thinking.remove();
    thinking = null;
    const hasPreview = describePatch(effectiveProposal, result.context);
    remember("assistant", effectiveProposal.summary);
    if (hasPreview) setStatus("Proposal ready. Preview and approval are available in the chat.");
  } catch (error) {
    reportError(error, "Generation failed.");
  } finally {
    thinking?.remove();
    busy(button, false, "");
    prompt.disabled = false;
    recordButton.disabled = false;
    prompt.focus();
  }
});

async function runPreview(proposal: Proposal, context: PageContext, revealResult = true): Promise<ApplyReport> {
  generationEpoch += 1;
  const report = await send<ApplyReport>({ type: "APPLY_PREVIEW", context, proposal });
  if (!report.applied || report.affectedElements < 1) {
    throw new Error(report.details.join(" ") || "The proposal did not produce a visible change on this page.");
  }
  activeProposal = proposal;
  proposalContext = context;
  previewActive = true;
  saveButton.disabled = false;
  const message = report.details.join(" ") || `Preview changed ${report.affectedElements} page elements.`;
  updateActionDock("previewed", message);
  addMessage(`Tweaksy: Preview applied and verified: ${message}`, false, revealResult);
  remember("assistant", `Preview applied and verified: ${message}`);
  logDiagnostic("preview-applied", { report, patch: proposal.patch });
  setStatus("Preview applied and measured. Use the chat controls to approve or undo it.");
  return report;
}

async function runRevert(context: PageContext, revealResult = true): Promise<void> {
  generationEpoch += 1;
  await send<boolean>({ type: "REVERT_PREVIEW", context });
  previewActive = false;
  saveButton.disabled = true;
  updateActionDock("reverted", "Preview removed. You can preview this proposal again.");
  addMessage("Tweaksy: Preview removed. The page was restored to its previously approved state.", false, revealResult);
  remember("assistant", "Preview removed. The page was restored to its previously approved state.");
  logDiagnostic("preview-reverted", { context: { origin: context.origin, page: pageWithoutQuery(context.url) } });
  setStatus("Preview undone.");
}

async function runSave(proposal: Proposal, context: PageContext, revealResult = true): Promise<void> {
  generationEpoch += 1;
  const originPattern = `${context.origin}/*`;
  const granted = await chrome.permissions.request({ origins: [originPattern] });
  if (!granted) throw new Error("Site access was not granted. The preview remains temporary and was not saved.");
  const result = await send<{ profile: SiteProfile; report: ApplyReport }>({ type: "SAVE_PROFILE", context, proposal });
  currentPageContext = context;
  currentSiteProfile = result.profile;
  previewActive = false;
  await refreshSiteStatus();
  const message = `Approved and saved locally for ${context.origin}. ${result.report.details.join(" ")}`;
  updateActionDock("saved", "Saved locally. This design will return on this website.");
  addMessage(`Tweaksy: ${message}`, false, revealResult);
  remember("assistant", message);
  logDiagnostic("profile-saved", { profile: { ...result.profile, patch: result.profile.patch }, report: result.report });
  setStatus(`Profile saved locally for ${context.origin}.`);
  activeProposal = null;
  proposalContext = null;
  saveButton.disabled = true;
  closeActionDock();
}

previewButton.addEventListener("click", async () => {
  if (!activeProposal || !proposalContext) return;
  busy(previewButton, true, "Applying…");
  try {
    await runPreview(activeProposal, proposalContext);
  } catch (error) {
    reportError(error, "Preview failed.");
  } finally {
    busy(previewButton, false, "");
  }
});

$("revert").addEventListener("click", async (event) => {
  if (!proposalContext) return;
  const button = event.currentTarget as HTMLButtonElement;
  busy(button, true, "Undoing…");
  try {
    await runRevert(proposalContext);
  } catch (error) {
    reportError(error, "Could not undo the preview.");
  } finally {
    busy(button, false, "");
  }
});

saveButton.addEventListener("click", async () => {
  if (!activeProposal || !proposalContext) return;
  busy(saveButton, true, "Saving…");
  try {
    await runSave(activeProposal, proposalContext);
  } catch (error) {
    reportError(error, "Could not save the profile.");
  } finally {
    busy(saveButton, false, "");
  }
});

pauseSiteButton.addEventListener("click", async () => {
  busy(pauseSiteButton, true, currentSiteStatus.paused ? "Resuming…" : "Pausing…");
  try {
    await setSitePaused(!currentSiteStatus.paused);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not change the site profile state.", true);
  } finally {
    busy(pauseSiteButton, false, "");
    renderSiteStatus();
  }
});

function sharedDesignFromProfile(profile: SiteProfile): SharedDesign {
  return {
    format: "tweaksy-design",
    schemaVersion: 1,
    origin: profile.origin,
    name: profile.name,
    patch: profile.patch,
    exportedAt: new Date().toISOString(),
  };
}

function designFileName(origin: string): string {
  const hostname = new URL(origin).hostname.replace(/[^a-z0-9.-]+/gi, "-").replace(/^-+|-+$/g, "");
  return `tweaksy-${hostname || "design"}.tweaksy.json`;
}

async function shareCurrentDesign(): Promise<void> {
  busy(shareDesignButton, true, "Preparing…");
  try {
    const profile = currentSiteProfile;
    if (!profile) throw new Error("Approve and save a design for this website before sharing it.");
    const design = sharedDesignFromProfile(profile);
    const contents = `${JSON.stringify(design, null, 2)}\n`;
    const file = new File([contents], designFileName(profile.origin), { type: "application/json" });
    const shareData: ShareData = {
      title: `Tweaksy design for ${new URL(profile.origin).hostname}`,
      text: "Open the matching website in Tweaksy, then import and preview this design.",
      files: [file],
    };
    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
      await navigator.share(shareData);
      setStatus("Design shared. The recipient must preview and approve it on the matching website.");
    } else {
      const message = await saveJsonFile(contents, file.name, "Tweaksy shared design");
      setStatus(message);
    }
    addMessage("Tweaksy: The saved design is ready to share. Recipients will preview and approve it on the matching website.");
    remember("assistant", "The saved design is ready to share. Recipients will preview and approve it on the matching website.");
    logDiagnostic("design-shared", { origin: design.origin, name: design.name, schemaVersion: design.schemaVersion });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") setStatus("Sharing canceled.");
    else reportError(error, "Could not share this design.");
  } finally {
    busy(shareDesignButton, false, "");
    renderSiteStatus();
  }
}

shareDesignButton.addEventListener("click", () => { void shareCurrentDesign(); });

importDesignButton.addEventListener("click", () => importDesignFile.click());
importDesignFile.addEventListener("change", async () => {
  const file = importDesignFile.files?.[0];
  importDesignFile.value = "";
  if (!file) return;
  busy(importDesignButton, true, "Reading…");
  try {
    if (file.size > 64 * 1024) throw new Error("Shared design files must be smaller than 64 KB.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      throw new Error("The selected file is not valid JSON.");
    }
    const design = await send<SharedDesign>({ type: "VALIDATE_SHARED_DESIGN", design: parsed });
    const context = await send<PageContext>({ type: "GET_ACTIVE_CONTEXT" });
    if (context.origin !== design.origin) {
      throw new Error(`This design is for ${design.origin}. Open that website before importing it.`);
    }
    currentPageContext = context;
    await useChatHistory(context.origin);
    const proposal: Proposal = {
      summary: `Shared design “${design.name}” for ${new URL(design.origin).hostname}. Preview it before approving access and saving.`,
      patch: design.patch,
    };
    activeProposal = proposal;
    proposalContext = context;
    addMessage(`Tweaksy: Imported ${file.name}. Its declarative settings passed validation; no scripts or raw CSS were accepted.`);
    remember("assistant", `Imported shared design “${design.name}”. Preview it before approving and saving.`);
    describePatch(proposal, context);
    logDiagnostic("design-imported", { origin: design.origin, name: design.name, schemaVersion: design.schemaVersion, fileName: file.name });
    setStatus("Shared design validated. Preview and approval controls are available in chat.");
  } catch (error) {
    reportError(error, "Could not import this design.");
  } finally {
    busy(importDesignButton, false, "");
  }
});

function diagnosticPageContext(): Record<string, unknown> | null {
  if (!currentPageContext) return null;
  let page = currentPageContext.origin;
  try {
    const url = new URL(currentPageContext.url);
    page = `${url.origin}${url.pathname}`;
  } catch {
    // Keep the already validated origin only.
  }
  return {
    origin: currentPageContext.origin,
    page,
    title: currentPageContext.title,
    documentToken: currentPageContext.documentToken,
    navigationToken: currentPageContext.navigationToken,
  };
}

async function saveJsonFile(contents: string, suggestedName: string, description: string): Promise<string> {
  type Writable = { write(value: string): Promise<void>; close(): Promise<void> };
  type Handle = { createWritable(): Promise<Writable> };
  type PickerWindow = Window & { showSaveFilePicker?: (options: unknown) => Promise<Handle> };
  const picker = (window as PickerWindow).showSaveFilePicker;
  if (picker) {
    const handle = await picker.call(window, {
      suggestedName,
      types: [{ description, accept: { "application/json": [".json"] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(contents);
    await writable.close();
    return `${description} saved to the location you selected.`;
  }
  const blobUrl = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = suggestedName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  return `${description} downloaded.`;
}

async function exportDiagnosticLog(): Promise<string> {
  const payload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    extensionVersion: chrome.runtime.getManifest().version,
    page: diagnosticPageContext(),
    provider: currentProviderMetadata,
    conversation: chatHistory,
    events: diagnosticEvents,
    pendingProposal: activeProposal,
  };
  const message = await saveJsonFile(
    `${JSON.stringify(payload, null, 2)}\n`,
    `tweaksy-debug-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    "JSON diagnostic log",
  );
  setStatus(message);
  return message;
}

exportLogButton.addEventListener("click", async () => {
  busy(exportLogButton, true, "Exporting…");
  try {
    await exportDiagnosticLog();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") setStatus("Diagnostic export canceled.");
    else reportError(error, "Could not export the diagnostic log.");
  } finally {
    busy(exportLogButton, false, "");
  }
});

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the recording."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(blob);
  });
}

async function stopAndTranscribe(chunks: Blob[], mimeType: string): Promise<void> {
  try {
    setStatus("Transcribing with your provider…");
    const blob = new Blob(chunks, { type: mimeType });
    const base64 = await blobToBase64(blob);
    const text = await send<string>({ type: "TRANSCRIBE_AUDIO", base64, mimeType });
    prompt.value = [prompt.value.trim(), text.trim()].filter(Boolean).join(" ");
    prompt.focus();
    setStatus("Transcription added. Review it before generating a preview.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Transcription failed.", true);
  }
}

function resetRecordButton(): void {
  recordButton.setAttribute("aria-pressed", "false");
  recordButton.setAttribute("aria-label", "Start voice input");
  recordButton.title = "Start voice input";
  setRecordButtonIcon(false);
}

function setRecordButtonIcon(recording: boolean): void {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  if (recording) {
    const stop = document.createElementNS(namespace, "rect");
    stop.setAttribute("x", "7");
    stop.setAttribute("y", "7");
    stop.setAttribute("width", "10");
    stop.setAttribute("height", "10");
    stop.setAttribute("rx", "2");
    svg.append(stop);
  } else {
    const microphone = document.createElementNS(namespace, "rect");
    microphone.setAttribute("x", "9");
    microphone.setAttribute("y", "3");
    microphone.setAttribute("width", "6");
    microphone.setAttribute("height", "11");
    microphone.setAttribute("rx", "3");
    const path = document.createElementNS(namespace, "path");
    path.setAttribute("d", "M6.5 11a5.5 5.5 0 0 0 11 0M12 16.5V21M9 21h6");
    svg.append(microphone, path);
  }

  recordButton.replaceChildren(svg);
}

async function startOnDeviceSpeech(): Promise<boolean> {
  const constructor = (window as Window & { SpeechRecognition?: LocalSpeechConstructor }).SpeechRecognition;
  if (!constructor) return false;
  const probe = new constructor();
  if (!("processLocally" in probe)) return false;
  const lang = navigator.language || "en-US";
  if (constructor.available) {
    const availability = await constructor.available({ langs: [lang], processLocally: true });
    if (availability === "unavailable") return false;
    if (availability === "downloadable" || availability === "downloading") {
      if (!constructor.install) return false;
      setStatus(`Installing Chrome's private on-device ${lang} speech pack…`);
      const installed = await constructor.install({ langs: [lang], processLocally: true });
      if (!installed) return false;
    }
  }
  probe.lang = lang;
  probe.continuous = false;
  probe.interimResults = false;
  probe.processLocally = true;
  probe.onresult = (event) => {
    const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
    if (transcript) prompt.value = [prompt.value.trim(), transcript].filter(Boolean).join(" ");
  };
  probe.onerror = (event) => {
    setStatus(`On-device speech recognition stopped: ${event.error}.`, true);
    logDiagnostic("voice-error", { mode: "on-device", error: event.error });
  };
  probe.onend = () => {
    localRecognition = null;
    resetRecordButton();
    prompt.focus();
    if (prompt.value.trim()) setStatus("On-device transcription added. Review it, then send.");
  };
  localRecognition = probe;
  probe.start();
  recordButton.setAttribute("aria-pressed", "true");
  recordButton.setAttribute("aria-label", "Stop voice input");
  recordButton.title = "Stop voice input";
  setRecordButtonIcon(true);
  setStatus("Listening with Chrome on this device. Audio is not sent to your AI provider.");
  logDiagnostic("voice-started", { mode: "on-device", lang });
  return true;
}

recordButton.addEventListener("click", async () => {
  if (localRecognition) {
    localRecognition.stop();
    return;
  }
  if (recorder?.state === "recording") {
    recorder.stop();
    if (recordingTimer !== null) window.clearTimeout(recordingTimer);
    resetRecordButton();
    return;
  }
  try {
    try {
      if (await startOnDeviceSpeech()) return;
    } catch (error) {
      logDiagnostic("voice-fallback", { reason: error instanceof Error ? error.message : "On-device recognition failed." });
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks: Blob[] = [];
    recorder = new MediaRecorder(stream);
    const mimeType = recorder.mimeType || "audio/webm";
    recorder.addEventListener("dataavailable", (event) => { if (event.data.size) chunks.push(event.data); });
    recorder.addEventListener("stop", () => {
      stream.getTracks().forEach((track) => track.stop());
      void stopAndTranscribe(chunks, mimeType);
    }, { once: true });
    recorder.start();
    recordButton.setAttribute("aria-pressed", "true");
    recordButton.setAttribute("aria-label", "Stop recording");
    recordButton.title = "Stop recording";
    setRecordButtonIcon(true);
    setStatus("On-device recognition is unavailable, so audio will use your configured provider. Activate Stop when finished.");
    recordingTimer = window.setTimeout(() => {
      if (recorder?.state === "recording") recordButton.click();
    }, 60_000);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Microphone access was not available.", true);
  }
});

prompt.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key === "Enter") {
    event.preventDefault();
    $<HTMLButtonElement>("generate").click();
  }
});

void send<ProviderConfig | null>({ type: "GET_PROVIDER_CONFIG" }).then((config) => {
  if (!config) return;
  currentProviderMetadata = providerMetadata(config);
  providerSelect.value = config.provider;
  $<HTMLInputElement>("model").value = config.model;
  $<HTMLInputElement>("transcription-model").value = config.transcriptionModel ?? "";
  endpointInput.value = config.endpoint ?? "";
  $<HTMLInputElement>("api-key").placeholder = "Saved locally — leave blank to keep it";
  updateProviderFields();
}).catch(() => undefined);
providerSelect.addEventListener("change", updateProviderFields);
updateProviderFields();
void refreshContext();
