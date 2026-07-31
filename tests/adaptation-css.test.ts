import { describe, expect, it } from "vitest";
import { buildAdaptationCss } from "../src/adaptation-css";
import { validatePatch } from "../src/validation";

describe("adaptation CSS", () => {
  it("contains only local visual declarations from validated input", () => {
    const css = buildAdaptationCss(validatePatch({
      fontScale: 1.3,
      headingColor: "blue",
      reduceMotion: true,
      hideSelectors: [".ad-slot", "img[src='https://attacker.test/pixel']"],
    }));
    expect(css).toContain("font-size: 1.3em");
    expect(css).toContain("color: blue");
    expect(css).toContain('[role="heading"]) *');
    expect(css).toContain(".ad-slot");
    expect(css).not.toMatch(/url\s*\(|@import|attacker\.test/i);
  });

  it("uses an extension-owned full-page deck for swipe mode", () => {
    const css = buildAdaptationCss(validatePatch({ articleLayout: "swipe-cards" }));
    expect(css).toContain("html[data-mmw-deck-active]");
    expect(css).toContain("[data-mmw-deck-track]");
    expect(css).toContain("scroll-snap-type: x mandatory");
    expect(css).toContain("min-height: 2.2rem");
    expect(css).toContain("[data-mmw-deck-header] button");
    expect(css).toContain("[data-mmw-brand-mark]");
    expect(css).toContain('[data-mmw-deck-kind="social-post"]');
    expect(css).toContain("[data-mmw-post-drawer]");
    expect(css).toContain("[data-mmw-post-actions]");
    expect(css).toContain("inset: 0 auto 0 0");
  });

  it("supports a warm hospitality theme without copying a branded color token", () => {
    const css = buildAdaptationCss(validatePatch({ articleLayout: "swipe-cards", themePreset: "warm-hospitality" }));
    expect(css).toContain("#fffaf7");
    expect(css).toContain("border-radius: 1.75rem");
    expect(css.toLowerCase()).not.toContain("#ff385c");
  });

  it("places validated deck navigation beside the cards", () => {
    const css = buildAdaptationCss(validatePatch({ articleLayout: "swipe-cards", deckControls: "sides", deckImageSize: "compact", deckLinkPosition: "footer" }));
    expect(css).toContain('[data-mmw-deck-controls="sides"]');
    expect(css).toContain('[data-mmw-deck-side="previous"]');
    expect(css).toContain("cursor: default");
    expect(css).toContain('[data-mmw-deck-image="compact"]');
    expect(css).toContain('[data-mmw-deck-link="footer"]');
    expect(css).toContain("var(--mmw-page-bg");
  });
});
