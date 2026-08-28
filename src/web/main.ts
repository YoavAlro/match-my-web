import { hasAdaptationChanges, type AdaptationPatch } from "../types";
import {
  AdaptationController,
  type AdaptationSnapshot,
} from "./adaptation-controller";
import { HarborlineRenderer } from "./demo-renderer";
import { createApprovedDesignStorage } from "./storage";
import { registerTweaksyWebMcpTools } from "./webmcp";

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

const controller = new AdaptationController(
  new HarborlineRenderer(root),
  createApprovedDesignStorage(),
);
let currentState = controller.getState();

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
  previewButton.focus();
}));

restoreButton.addEventListener("click", () => runAction(() => {
  controller.restoreOriginal(currentState.revision);
  previewButton.focus();
}));

controller.subscribe(render);

const currentYear = document.querySelector<HTMLElement>("[data-current-year]");
if (currentYear) currentYear.textContent = String(new Date().getFullYear());
document.documentElement.classList.add("tweaksy-live-ready");

const webMcpStatus = requiredElement<HTMLElement>("[data-webmcp-status]");
const connectionDot = requiredElement<HTMLElement>("[data-connection-dot]");
try {
  const registeredToolCount = await registerTweaksyWebMcpTools(controller, root);
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

export { controller };
