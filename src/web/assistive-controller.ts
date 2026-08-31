import type { PreviewSource, AdaptationController, AdaptationSnapshot } from "./adaptation-controller";

export type AccessibilityMode = "color-safe" | "low-vision";
export type ReadingScope = "page-summary" | "current-story" | "all-headlines";

export interface AssistiveSnapshot {
  reading: { active: boolean; scope: ReadingScope | null; characterCount: number };
  focus: { active: boolean; minutes: number | null; remainingSeconds: number };
}

export interface SpeechDriver {
  available(): boolean;
  speak(text: string, rate: number, onEnd: () => void, onError: () => void): void;
  stop(): void;
}

class BrowserSpeechDriver implements SpeechDriver {
  available(): boolean {
    return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  }

  speak(text: string, rate: number, onEnd: () => void, onError: () => void): void {
    this.stop();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.onend = onEnd;
    utterance.onerror = onError;
    window.speechSynthesis.speak(utterance);
  }

  stop(): void {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }
}

const MODE_PRESETS = {
  "color-safe": {
    summary: "Color-safe presentation with stronger contrast and no red-only cues",
    changes: { colorVisionMode: "avoid-red", contrast: "more", strongFocus: true },
  },
  "low-vision": {
    summary: "Low-vision reading preview with larger type, shorter lines, and stronger focus",
    changes: {
      fontScale: 1.38,
      lineHeight: 1.82,
      contentMaxWidthRem: 58,
      contrast: "more",
      strongFocus: true,
      reduceMotion: true,
    },
  },
} as const;

const FOCUS_PRESET = {
  fontScale: 1.18,
  lineHeight: 1.72,
  contentMaxWidthRem: 62,
  articleLayout: "swipe-cards",
  deckControls: "sides",
  deckImageSize: "compact",
  deckLinkPosition: "footer",
  themePreset: "paper-editorial",
  colorScheme: "light",
  reduceMotion: true,
  strongFocus: true,
} as const;

function cleanText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function elementText(root: ParentNode, selector: string): string {
  return cleanText(root.querySelector<HTMLElement>(selector)?.textContent);
}

export function extractHarborlineReading(root: HTMLElement, scope: ReadingScope): string {
  const storyCards = [...root.querySelectorAll<HTMLElement>("[data-story-id]")];
  const headlines = storyCards.map((story) => elementText(story, "h3")).filter(Boolean);
  if (scope === "all-headlines") {
    return `Harborline Journal. Today's headlines. ${headlines.map((headline, index) => `${index + 1}. ${headline}.`).join(" ")}`;
  }

  if (scope === "current-story") {
    const visibleStory = storyCards.find((story) => !story.hidden) ?? storyCards[0];
    const storyId = visibleStory?.dataset.storyId;
    const detail = storyId ? root.querySelector<HTMLElement>(`#${storyId}-story`) : null;
    const source = detail ?? visibleStory;
    if (!source) return "Harborline Journal has no readable story selected.";
    const heading = elementText(source, "h2, h3");
    const paragraphs = [...source.querySelectorAll<HTMLElement>("p:not(.eyebrow):not(.story-meta)")]
      .map((paragraph) => cleanText(paragraph.textContent))
      .filter(Boolean);
    return `${heading}. ${paragraphs.join(" ")}`.trim();
  }

  const title = elementText(root, "#page-title");
  const description = elementText(root, ".lead-in .dek");
  return `Harborline Journal. ${title}. ${description} There are ${headlines.length} stories. ${headlines.join(". ")}.`;
}

export class AssistiveController {
  private reading: AssistiveSnapshot["reading"] = { active: false, scope: null, characterCount: 0 };
  private focus: AssistiveSnapshot["focus"] = { active: false, minutes: null, remainingSeconds: 0 };
  private focusPreviewId: string | null = null;
  private focusEndsAt = 0;
  private focusTimer: ReturnType<typeof setInterval> | null = null;
  private speechToken = 0;
  private readonly listeners = new Set<(snapshot: AssistiveSnapshot) => void>();

  constructor(
    private readonly adaptation: AdaptationController,
    private readonly root: HTMLElement,
    private readonly speech: SpeechDriver = new BrowserSpeechDriver(),
    private readonly now: () => number = () => Date.now(),
  ) {}

  getState(): AssistiveSnapshot {
    return { reading: { ...this.reading }, focus: { ...this.focus } };
  }

  subscribe(listener: (snapshot: AssistiveSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  previewAccessibilityMode(mode: AccessibilityMode, expectedRevision: number, source: PreviewSource): AdaptationSnapshot {
    const preset = MODE_PRESETS[mode];
    return this.adaptation.previewAdaptation({
      expectedRevision,
      summary: preset.summary,
      changes: preset.changes,
    }, source);
  }

  read(scope: ReadingScope, rate = 1): AssistiveSnapshot {
    if (!this.speech.available()) throw new Error("Read aloud is not available in this browser.");
    if (!Number.isFinite(rate) || rate < 0.8 || rate > 1.4) throw new Error("rate must be from 0.8 to 1.4.");
    const text = extractHarborlineReading(this.root, scope);
    const token = ++this.speechToken;
    this.reading = { active: true, scope, characterCount: text.length };
    this.emit();
    this.speech.speak(text, rate, () => this.finishReading(token), () => this.finishReading(token));
    return this.getState();
  }

  stopReading(): AssistiveSnapshot {
    this.speechToken += 1;
    this.speech.stop();
    this.reading = { active: false, scope: null, characterCount: 0 };
    this.emit();
    return this.getState();
  }

  startFocus(minutes: 10 | 25 | 45, expectedRevision: number, source: PreviewSource): { adaptation: AdaptationSnapshot; assistive: AssistiveSnapshot } {
    this.clearFocusTimer();
    const snapshot = this.adaptation.previewAdaptation({
      expectedRevision,
      summary: `${minutes}-minute focus session with one calm story at a time`,
      changes: FOCUS_PRESET,
    }, source);
    this.focusPreviewId = snapshot.preview?.id ?? null;
    this.focusEndsAt = this.now() + minutes * 60_000;
    this.focus = { active: true, minutes, remainingSeconds: minutes * 60 };
    this.root.dataset.focusSession = "true";
    this.focusTimer = setInterval(() => this.tickFocus(), 1_000);
    this.emit();
    return { adaptation: snapshot, assistive: this.getState() };
  }

  endFocus(expectedRevision: number): { adaptation: AdaptationSnapshot; assistive: AssistiveSnapshot } {
    const current = this.adaptation.getState();
    if (expectedRevision !== current.revision) {
      throw new Error(`The page changed after inspection. Expected revision ${expectedRevision}, but the current revision is ${current.revision}. Inspect state and retry.`);
    }
    let adaptation = current;
    if (this.focusPreviewId && current.preview?.id === this.focusPreviewId) {
      adaptation = this.adaptation.discardPreview(expectedRevision);
    }
    this.finishFocus();
    return { adaptation, assistive: this.getState() };
  }

  private finishReading(token: number): void {
    if (token !== this.speechToken) return;
    this.reading = { active: false, scope: null, characterCount: 0 };
    this.emit();
  }

  private tickFocus(): void {
    const remainingSeconds = Math.max(0, Math.ceil((this.focusEndsAt - this.now()) / 1_000));
    this.focus = { ...this.focus, remainingSeconds };
    if (remainingSeconds === 0) {
      const current = this.adaptation.getState();
      if (this.focusPreviewId && current.preview?.id === this.focusPreviewId) {
        this.adaptation.discardPreview(current.revision);
      }
      this.finishFocus();
      return;
    }
    this.emit();
  }

  private finishFocus(): void {
    this.clearFocusTimer();
    this.focusPreviewId = null;
    this.focus = { active: false, minutes: null, remainingSeconds: 0 };
    delete this.root.dataset.focusSession;
    this.emit();
  }

  private clearFocusTimer(): void {
    if (this.focusTimer !== null) clearInterval(this.focusTimer);
    this.focusTimer = null;
  }

  private emit(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) listener(snapshot);
  }
}
