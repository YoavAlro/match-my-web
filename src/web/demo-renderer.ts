import type { AdaptationPatch } from "../types";
import type { AdaptationRenderer, AdaptationVerification } from "./adaptation-controller";

function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Tweaksy demo is missing required element: ${selector}`);
  return element;
}

export class HarborlineRenderer implements AdaptationRenderer {
  private readonly stories: HTMLElement[];
  private readonly baseline: string[];
  private readonly storyGrid: HTMLElement;
  private readonly controls: HTMLElement;
  private readonly currentLabel: HTMLElement;
  private readonly totalLabel: HTMLElement;
  private activeIndex = 0;
  private deckActive = false;

  constructor(private readonly root: HTMLElement) {
    this.stories = [...root.querySelectorAll<HTMLElement>("[data-story-id]")];
    this.baseline = this.stories.map((story) => this.storyFingerprint(story));
    this.storyGrid = requiredElement(root, "#story-grid");
    this.controls = requiredElement(root, ".deck-controls");
    this.currentLabel = requiredElement(root, "[data-deck-current]");
    this.totalLabel = requiredElement(root, "[data-deck-total]");
    requiredElement<HTMLButtonElement>(root, "[data-deck-previous]").addEventListener("click", () => this.move(-1));
    requiredElement<HTMLButtonElement>(root, "[data-deck-next]").addEventListener("click", () => this.move(1));
    this.stories.forEach((story, index) => {
      const heading = story.querySelector<HTMLElement>("h3");
      if (heading && !heading.id) heading.id = `tweaksy-story-heading-${index + 1}`;
    });
    this.storyGrid.addEventListener("keydown", (event) => {
      if (!this.deckActive || !(event instanceof KeyboardEvent)) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.move(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        this.move(1);
      }
    });
  }

  apply(patch: AdaptationPatch): void {
    this.root.dataset.adapted = String(patch.fontScale !== null
      || patch.lineHeight !== null
      || patch.letterSpacingEm !== null
      || patch.contentMaxWidthRem !== null
      || patch.articleLayout !== "unchanged"
      || patch.themePreset !== "unchanged"
      || patch.colorScheme !== "unchanged"
      || patch.contrast !== "unchanged"
      || patch.colorVisionMode !== "unchanged"
      || patch.reduceMotion
      || patch.strongFocus);
    this.root.dataset.layout = patch.articleLayout;
    this.root.dataset.deckImages = patch.deckImageSize;
    this.root.dataset.deckLinks = patch.deckLinkPosition;
    this.root.dataset.theme = patch.themePreset;
    this.root.dataset.colorScheme = patch.colorScheme;
    this.root.dataset.contrast = patch.contrast;
    this.root.dataset.colorVision = patch.colorVisionMode;
    this.root.dataset.reduceMotion = String(patch.reduceMotion);
    this.root.dataset.strongFocus = String(patch.strongFocus);
    this.setVariable("--tweaksy-font-scale", patch.fontScale);
    this.setVariable("--tweaksy-line-height", patch.lineHeight);
    this.setVariable("--tweaksy-letter-spacing", patch.letterSpacingEm, "em");
    this.setVariable("--tweaksy-content-width", patch.contentMaxWidthRem, "rem");

    this.deckActive = patch.articleLayout === "swipe-cards";
    this.controls.hidden = !this.deckActive || patch.deckControls !== "sides";
    this.storyGrid.tabIndex = this.deckActive ? 0 : -1;
    if (this.deckActive) {
      this.storyGrid.setAttribute("role", "region");
      this.storyGrid.setAttribute("aria-describedby", "deck-instructions");
    } else {
      this.storyGrid.removeAttribute("role");
      this.storyGrid.removeAttribute("aria-labelledby");
      this.storyGrid.removeAttribute("aria-describedby");
      this.activeIndex = 0;
    }
    this.syncDeck();
  }

  verify(): AdaptationVerification {
    const storyLinks = this.root.querySelectorAll<HTMLAnchorElement>("[data-story-id] a");
    const renderedStoryCount = this.stories.filter((story) => !story.hidden).length;
    const fingerprintsMatch = this.stories.every((story, index) => this.storyFingerprint(story) === this.baseline[index]);
    const linkTargetsValid = [...storyLinks].every((link) => {
      const href = link.getAttribute("href");
      if (!href) return false;
      if (!href.startsWith("#")) return true;
      try {
        return document.getElementById(decodeURIComponent(href.slice(1))) !== null;
      } catch {
        return false;
      }
    });
    return {
      storyCount: this.stories.length,
      storyLinkCount: storyLinks.length,
      renderedStoryCount,
      contentPreserved: this.stories.length === 6
        && storyLinks.length === 6
        && this.stories.every((story) => story.isConnected)
        && fingerprintsMatch
        && linkTargetsValid,
      linkTargetsValid,
      deckKeyboardNavigation: this.deckActive
        && this.storyGrid.tabIndex === 0
        && renderedStoryCount === 1,
    };
  }

  private move(delta: number): void {
    if (!this.deckActive || this.stories.length === 0) return;
    this.activeIndex = (this.activeIndex + delta + this.stories.length) % this.stories.length;
    this.syncDeck();
  }

  private syncDeck(): void {
    this.totalLabel.textContent = String(this.stories.length);
    this.currentLabel.textContent = String(this.activeIndex + 1);
    const activeHeading = this.stories[this.activeIndex]?.querySelector<HTMLElement>("h3");
    const activeTitle = activeHeading?.textContent?.trim() ?? "story";
    const titleLabel = this.root.querySelector<HTMLElement>("[data-deck-title]");
    if (titleLabel) titleLabel.textContent = activeTitle;
    if (this.deckActive && activeHeading?.id) this.storyGrid.setAttribute("aria-labelledby", activeHeading.id);
    this.stories.forEach((story, index) => {
      const inactive = this.deckActive && index !== this.activeIndex;
      story.hidden = inactive;
      story.inert = inactive;
      if (inactive) story.setAttribute("aria-hidden", "true");
      else story.removeAttribute("aria-hidden");
    });
  }

  private setVariable(name: string, value: number | null, unit = ""): void {
    if (value === null) this.root.style.removeProperty(name);
    else this.root.style.setProperty(name, `${value}${unit}`);
  }

  private storyFingerprint(story: HTMLElement): string {
    const id = story.dataset.storyId ?? "";
    const heading = story.querySelector<HTMLElement>("h3")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const body = story.querySelector<HTMLElement>(".story-copy > p:not(.story-meta)")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const href = story.querySelector<HTMLAnchorElement>("a")?.getAttribute("href") ?? "";
    return JSON.stringify({ id, heading, body, href });
  }
}
