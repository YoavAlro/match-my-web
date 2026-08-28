import { hasAdaptationChanges, type AdaptationPatch } from "../types";
import {
  AdaptationController,
  type AdaptationSnapshot,
} from "./adaptation-controller";
import { HarborlineRenderer } from "./demo-renderer";
import { createApprovedDesignStorage } from "./storage";
import { registerTweaksyWebMcpTools } from "./webmcp";
import { interpretHostedChatRequest } from "./chat-intent";
import {
  AssistiveController,
  interpretAssistiveChatAction,
  type AssistiveSnapshot,
} from "./assistive-controller";

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Tweaksy Live is missing required element: ${selector}`);
  return element;
}

const HERO_CHANGES = {
  fontScale: 1.24,
  lineHeight: 1.72,
  contentMaxWidthRem: 62,
  articleLayout: "swipe-cards",
  deckControls: "sides",
  deckImageSize: "compact",
  deckLinkPosition: "footer",
  colorVisionMode: "avoid-red",
  themePreset: "paper-editorial",
  colorScheme: "light",
  contrast: "more",
  reduceMotion: true,
  strongFocus: true,
} as const;

const root = requiredElement<HTMLElement>("[data-tweaksy-demo]");
const previewButton = requiredElement<HTMLButtonElement>("[data-preview-hero]");
const approveButton = requiredElement<HTMLButtonElement>("[data-approve-preview]");
const discardButton = requiredElement<HTMLButtonElement>("[data-discard-preview]");
const restoreButton = requiredElement<HTMLButtonElement>("[data-restore-original]");
const decisionCard = requiredElement<HTMLElement>("[data-decision-card]");
const decisionKind = requiredElement<HTMLElement>("[data-decision-kind]");
const decisionSource = requiredElement<HTMLElement>("[data-decision-source]");
const decisionSummary = requiredElement<HTMLElement>("[data-decision-summary]");
const decisionDetails = requiredElement<HTMLUListElement>("[data-decision-details]");
const previewActions = requiredElement<HTMLElement>("[data-preview-actions]");
const proofStories = requiredElement<HTMLElement>("[data-proof-stories]");
const proofLinks = requiredElement<HTMLElement>("[data-proof-links]");
const proofSaved = requiredElement<HTMLElement>("[data-proof-saved]");
const dockStatus = requiredElement<HTMLElement>("[data-dock-status]");
const chatLog = requiredElement<HTMLElement>("[data-chat-log]");
const chatForm = requiredElement<HTMLFormElement>("[data-chat-form]");
const chatInput = requiredElement<HTMLTextAreaElement>("[data-chat-input]");
const chatSend = requiredElement<HTMLButtonElement>("[data-chat-send]");
const chatSuggestions = [...document.querySelectorAll<HTMLButtonElement>("[data-chat-suggestion]")];
const assistiveButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-assistive-mode]")];
const assistiveStatus = requiredElement<HTMLElement>("[data-assistive-status]");
const readLabel = requiredElement<HTMLElement>("[data-read-label]");
const focusLabel = requiredElement<HTMLElement>("[data-focus-label]");
const focusDetail = requiredElement<HTMLElement>("[data-focus-detail]");

const controller = new AdaptationController(
  new HarborlineRenderer(root),
  createApprovedDesignStorage(),
);
const assistive = new AssistiveController(controller, root);
let currentState = controller.getState();
let currentAssistiveState = assistive.getState();

function describePatch(patch: AdaptationPatch): string[] {
  const details: string[] = [];
  if (patch.articleLayout === "swipe-cards") details.push("One story at a time with keyboard deck controls");
  if (patch.fontScale !== null) details.push(`${Math.round(patch.fontScale * 100)}% reading type with ${patch.lineHeight ?? "comfortable"} line height`);
  if (patch.contentMaxWidthRem !== null) details.push(`Reading width capped at ${patch.contentMaxWidthRem}rem`);
  if (patch.reduceMotion) details.push("Nonessential motion reduced");
  if (patch.strongFocus) details.push("High-visibility keyboard focus enabled");
  if (patch.colorVisionMode === "avoid-red") details.push("Critical accents avoid red-only meaning");
  return details.slice(0, 5);
}

function replaceDetails(details: string[]): void {
  const items = details.map((detail) => {
    const item = document.createElement("li");
    item.textContent = detail;
    return item;
  });
  decisionDetails.replaceChildren(...items);
}

function render(snapshot: AdaptationSnapshot): void {
  currentState = snapshot;
  const hasApprovedDesign = hasAdaptationChanges(snapshot.approvedPatch);
  const preview = snapshot.preview;

  proofStories.textContent = snapshot.effectivePatch.articleLayout === "swipe-cards"
    ? `${snapshot.verification.storyCount} available · ${snapshot.verification.renderedStoryCount} shown`
    : `${snapshot.verification.storyCount} of 6`;
  proofLinks.textContent = `${snapshot.verification.storyLinkCount} of 6`;
  proofSaved.textContent = hasApprovedDesign
    ? snapshot.persistence === "local" ? "This browser" : "This session"
    : "Nothing yet";
  const proofStatus = requiredElement<HTMLElement>("[data-proof-status]");
  proofStatus.textContent = snapshot.verification.contentPreserved ? "Original intact" : "Check required";
  proofStatus.dataset.state = snapshot.verification.contentPreserved ? "success" : "warning";

  if (preview) {
    decisionCard.hidden = false;
    decisionKind.textContent = "Preview · not saved";
    decisionSource.textContent = preview.source === "webmcp" ? "Requested through WebMCP" : "Requested by you";
    decisionSummary.textContent = preview.summary;
    replaceDetails(describePatch(preview.patch));
    previewActions.hidden = false;
    restoreButton.hidden = true;
    previewButton.disabled = true;
    dockStatus.textContent = "Preview only. Approve to save it in this browser, or discard it cleanly.";
  } else if (hasApprovedDesign) {
    decisionCard.hidden = false;
    decisionKind.textContent = "Approved design";
    decisionSource.textContent = snapshot.persistence === "local"
      ? "Stored only in this browser"
      : "Held for this page session";
    decisionSummary.textContent = "Your saved Harborline adaptation is active.";
    replaceDetails(describePatch(snapshot.approvedPatch));
    previewActions.hidden = true;
    restoreButton.hidden = false;
    previewButton.disabled = true;
    dockStatus.textContent = snapshot.persistence === "local"
      ? "Saved locally. The original page remains available at any time."
      : "Browser storage is unavailable, so this approval lasts for this session only.";
  } else {
    decisionCard.hidden = true;
    previewActions.hidden = false;
    restoreButton.hidden = true;
    previewButton.disabled = false;
    dockStatus.textContent = "Ready. Preview changes first; nothing is saved without your approval.";
  }
}

function runAction(action: () => void): void {
  try {
    action();
  } catch (error) {
    dockStatus.textContent = error instanceof Error ? error.message : "Tweaksy could not complete that action.";
  }
}

function appendChatMessage(role: "user" | "assistant", message: string): void {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble chat-bubble-${role}`;
  bubble.textContent = message;
  chatLog.append(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function setChatBusy(busy: boolean): void {
  chatInput.disabled = busy;
  chatSend.disabled = busy;
  for (const suggestion of chatSuggestions) suggestion.disabled = busy;
  chatForm.setAttribute("aria-busy", String(busy));
}

function formatRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function renderAssistive(snapshot: AssistiveSnapshot): void {
  currentAssistiveState = snapshot;
  const readButton = assistiveButtons.find((button) => button.dataset.assistiveMode === "read-aloud");
  const focusButton = assistiveButtons.find((button) => button.dataset.assistiveMode === "focus");
  readLabel.textContent = snapshot.reading.active ? "Stop reading" : "Read aloud";
  readButton?.setAttribute("aria-pressed", String(snapshot.reading.active));
  focusLabel.textContent = snapshot.focus.active ? formatRemaining(snapshot.focus.remainingSeconds) : "Focus 25";
  focusDetail.textContent = snapshot.focus.active ? "End focus session" : "One calm story";
  focusButton?.setAttribute("aria-pressed", String(snapshot.focus.active));
  assistiveStatus.textContent = snapshot.reading.active
    ? "Reading now"
    : snapshot.focus.active
      ? `${formatRemaining(snapshot.focus.remainingSeconds)} left`
      : "Ready";
}

function handleAssistiveAction(request: string): boolean {
  const action = interpretAssistiveChatAction(request);
  if (!action) return false;
  if (action.kind === "stop-reading") {
    assistive.stopReading();
    appendChatMessage("assistant", "Read aloud stopped.");
  } else if (action.kind === "read") {
    assistive.read(action.scope);
    appendChatMessage("assistant", "I’m reading the Harborline content aloud with your browser voice. You can ask me to stop at any time. This aid does not replace a full screen reader.");
  } else if (action.kind === "accessibility-mode") {
    const snapshot = assistive.previewAccessibilityMode(action.mode, currentState.revision, "human");
    const label = action.mode === "color-safe" ? "color-safe presentation" : "low-vision reading layout";
    appendChatMessage("assistant", `I made a reversible ${label} preview. All ${snapshot.verification.storyCount} stories remain intact; approve it, refine it, or discard it.`);
    approveButton.focus();
  } else if (action.kind === "start-focus") {
    const result = assistive.startFocus(action.minutes, currentState.revision, "human");
    appendChatMessage("assistant", `Your ${action.minutes}-minute focus session is running. I reduced the page to one calm story with less motion; the design is still only a preview.`);
    if (result.adaptation.preview) approveButton.focus();
  } else {
    assistive.endFocus(currentState.revision);
    appendChatMessage("assistant", "Focus session ended. The page chrome is back, and any unchanged focus preview was discarded.");
    chatInput.focus();
  }
  return true;
}

function handleChatRequest(rawRequest: string): void {
  const request = rawRequest.trim();
  if (!request) return;
  appendChatMessage("user", request);
  setChatBusy(true);
  try {
    if (/^(?:approve|save|keep)(?:\s+(?:it|this|the preview))?[.!]?$/i.test(request)) {
      const preview = currentState.preview;
      if (!preview) throw new Error("There is no preview to approve yet. Describe a change first.");
      controller.approvePreview(preview.id, currentState.revision);
      appendChatMessage("assistant", "Approved. This exact design is saved only in this browser; you can restore the original at any time.");
      restoreButton.focus();
      return;
    }
    if (/^(?:discard|undo|cancel)(?:\s+(?:it|this|the preview))?[.!]?$/i.test(request)) {
      if (!currentState.preview) throw new Error("There is no temporary preview to discard.");
      controller.discardPreview(currentState.revision);
      appendChatMessage("assistant", "Preview discarded. The last approved design is back.");
      chatInput.focus();
      return;
    }
    if (/^(?:restore|reset|go back to)(?:\s+(?:the )?(?:original|default)(?: page| design)?)?[.!]?$/i.test(request)) {
      controller.restoreOriginal(currentState.revision);
      if (currentAssistiveState.focus.active) assistive.endFocus(currentState.revision);
      appendChatMessage("assistant", "The original Harborline design is restored.");
      chatInput.focus();
      return;
    }

    if (handleAssistiveAction(request)) return;

    const proposal = interpretHostedChatRequest(request, currentState.effectivePatch);
    if (!proposal) {
      appendChatMessage("assistant", "I couldn’t map that to a safe visual change yet. Try typography, reading width, one story at a time, light or dark mode, contrast, motion, keyboard focus, or a calm, warm, minimal, or bold theme.");
      dockStatus.textContent = "No preview created. Try one of the supported visual requests shown in the chat.";
      return;
    }
    const snapshot = controller.previewAdaptation({
      expectedRevision: currentState.revision,
      summary: proposal.summary,
      changes: proposal.changes,
      ...(proposal.resetFields.length ? { resetFields: proposal.resetFields } : {}),
    }, "human");
    const proof = snapshot.verification.contentPreserved
      ? `All ${snapshot.verification.storyCount} stories and ${snapshot.verification.storyLinkCount} links remain intact.`
      : "Please review the page proof before approving.";
    appendChatMessage("assistant", `I made a reversible preview. ${proof} Refine it in another message, approve it, or discard it.`);
    approveButton.focus();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tweaksy could not understand that request.";
    appendChatMessage("assistant", message);
    dockStatus.textContent = message;
  } finally {
    setChatBusy(false);
  }
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const request = chatInput.value;
  chatInput.value = "";
  handleChatRequest(request);
});

chatInput.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

for (const suggestion of chatSuggestions) {
  suggestion.addEventListener("click", () => {
    const request = suggestion.dataset.chatSuggestion ?? "";
    chatInput.value = request;
    chatForm.requestSubmit();
  });
}

for (const button of assistiveButtons) {
  button.addEventListener("click", () => runAction(() => {
    const mode = button.dataset.assistiveMode;
    if (mode === "color-safe") {
      const snapshot = assistive.previewAccessibilityMode("color-safe", currentState.revision, "human");
      appendChatMessage("assistant", `Color-safe preview ready. Contrast is stronger and important cues no longer rely on red alone; all ${snapshot.verification.storyCount} stories remain intact.`);
      approveButton.focus();
    } else if (mode === "read-aloud") {
      if (currentAssistiveState.reading.active) {
        assistive.stopReading();
        appendChatMessage("assistant", "Read aloud stopped.");
      } else {
        assistive.read("page-summary");
        appendChatMessage("assistant", "I’m reading a page summary with your browser voice. This is a reading aid, not a replacement for a screen reader.");
      }
    } else if (mode === "focus") {
      if (currentAssistiveState.focus.active) {
        assistive.endFocus(currentState.revision);
        appendChatMessage("assistant", "Focus session ended. The page chrome is back.");
      } else {
        assistive.startFocus(25, currentState.revision, "human");
        appendChatMessage("assistant", "Your 25-minute focus session is running with one calm story and a visible countdown.");
        approveButton.focus();
      }
    }
  }));
}

previewButton.addEventListener("click", () => runAction(() => {
  controller.previewAdaptation({
    expectedRevision: currentState.revision,
    summary: "Turn the six-story feed into a calmer, accessible story deck",
    changes: HERO_CHANGES,
  }, "human");
  approveButton.focus();
}));

approveButton.addEventListener("click", () => runAction(() => {
  const preview = currentState.preview;
  if (!preview) throw new Error("There is no preview to approve.");
  controller.approvePreview(preview.id, currentState.revision);
  restoreButton.focus();
}));

discardButton.addEventListener("click", () => runAction(() => {
  controller.discardPreview(currentState.revision);
  if (currentAssistiveState.focus.active) assistive.endFocus(currentState.revision);
  previewButton.focus();
}));

restoreButton.addEventListener("click", () => runAction(() => {
  controller.restoreOriginal(currentState.revision);
  previewButton.focus();
}));

controller.subscribe(render);
assistive.subscribe(renderAssistive);

const currentYear = document.querySelector<HTMLElement>("[data-current-year]");
if (currentYear) currentYear.textContent = String(new Date().getFullYear());
document.documentElement.classList.add("tweaksy-live-ready");

const webMcpStatus = requiredElement<HTMLElement>("[data-webmcp-status]");
const connectionDot = requiredElement<HTMLElement>("[data-connection-dot]");
try {
  const registeredToolCount = await registerTweaksyWebMcpTools(controller, root, assistive);
  if (registeredToolCount > 0) {
    webMcpStatus.textContent = `${registeredToolCount} WebMCP tools ready · no API key`;
    connectionDot.title = `${registeredToolCount} WebMCP tools ready`;
    connectionDot.setAttribute("aria-label", `${registeredToolCount} Tweaksy WebMCP tools are ready`);
  } else {
    webMcpStatus.textContent = "Manual controls ready · WebMCP unavailable in this browser";
  }
} catch (error) {
  webMcpStatus.textContent = "Manual controls ready · tool registration needs a refresh";
  connectionDot.classList.add("connection-dot-warning");
  connectionDot.title = "WebMCP tool registration needs a refresh";
  connectionDot.setAttribute("aria-label", "Tweaksy manual controls are ready, but WebMCP tool registration needs a refresh");
  console.error("Tweaksy WebMCP registration failed", error);
}

export { assistive, controller };
