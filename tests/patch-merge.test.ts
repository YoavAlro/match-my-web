import { describe, expect, it } from "vitest";
import { changesEffectiveDesign, mergeAdaptationPatches } from "../src/patch-merge";
import { DEFAULT_PATCH } from "../src/types";

describe("incremental adaptation patches", () => {
  it("keeps the established color identity during a layout refinement", () => {
    const base = {
      ...DEFAULT_PATCH,
      themePreset: "warm-hospitality" as const,
      colorScheme: "light" as const,
      headingColor: "navy",
      colorVisionMode: "avoid-red" as const,
    };
    const delta = { ...DEFAULT_PATCH, articleLayout: "swipe-cards" as const, deckControls: "sides" as const };

    const merged = mergeAdaptationPatches(base, delta);

    expect(merged).toMatchObject({
      themePreset: "warm-hospitality",
      colorScheme: "light",
      headingColor: "navy",
      colorVisionMode: "avoid-red",
      articleLayout: "swipe-cards",
      deckControls: "sides",
    });
  });

  it("requires an explicit reset field to restore an existing setting", () => {
    const base = { ...DEFAULT_PATCH, themePreset: "bold-dark" as const, strongFocus: true };
    const merged = mergeAdaptationPatches(base, { ...DEFAULT_PATCH, fontScale: 1.2 }, ["themePreset", "strongFocus"]);

    expect(merged.themePreset).toBe("unchanged");
    expect(merged.strongFocus).toBe(false);
    expect(merged.fontScale).toBe(1.2);
  });

  it("preserves previously hidden regions while adding new safe regions", () => {
    const base = { ...DEFAULT_PATCH, hideSelectors: [".ad-slot"] };
    const delta = { ...DEFAULT_PATCH, hideSelectors: [".promoted"] };
    expect(mergeAdaptationPatches(base, delta).hideSelectors).toEqual([".ad-slot", ".promoted"]);
  });

  it("preserves sponsored-content filtering until it is explicitly reset", () => {
    const base = { ...DEFAULT_PATCH, hideSponsoredContent: true };
    expect(mergeAdaptationPatches(base, DEFAULT_PATCH).hideSponsoredContent).toBe(true);
    expect(mergeAdaptationPatches(base, DEFAULT_PATCH, ["hideSponsoredContent"]).hideSponsoredContent).toBe(false);
  });

  it("preserves video-post filtering until it is explicitly reset", () => {
    const base = { ...DEFAULT_PATCH, hideVideoPosts: true };
    expect(mergeAdaptationPatches(base, DEFAULT_PATCH).hideVideoPosts).toBe(true);
    expect(mergeAdaptationPatches(base, DEFAULT_PATCH, ["hideVideoPosts"]).hideVideoPosts).toBe(false);
  });

  it("merges observed feed-marker rules and supports explicit reset", () => {
    const base = { ...DEFAULT_PATCH, feedFilterTerms: ["Sponsored"] };
    const delta = { ...DEFAULT_PATCH, feedFilterTerms: ["Promoted"] };
    expect(mergeAdaptationPatches(base, delta).feedFilterTerms).toEqual(["Sponsored", "Promoted"]);
    expect(mergeAdaptationPatches(base, DEFAULT_PATCH, ["feedFilterTerms"]).feedFilterTerms).toEqual([]);
  });

  it("accepts a deck-control-only delta over an existing deck", () => {
    const base = { ...DEFAULT_PATCH, articleLayout: "swipe-cards" as const };
    const delta = { ...DEFAULT_PATCH, deckControls: "sides" as const };
    const merged = mergeAdaptationPatches(base, delta);
    expect(merged.articleLayout).toBe("swipe-cards");
    expect(merged.deckControls).toBe("sides");
  });

  it("drops side controls when the deck layout is explicitly reset", () => {
    const base = { ...DEFAULT_PATCH, articleLayout: "swipe-cards" as const, deckControls: "sides" as const };
    const merged = mergeAdaptationPatches(base, DEFAULT_PATCH, ["articleLayout"]);
    expect(merged.articleLayout).toBe("unchanged");
    expect(merged.deckControls).toBe("unchanged");
  });

  it("does not treat an inherited active design as a new proposal", () => {
    const base = { ...DEFAULT_PATCH, articleLayout: "swipe-cards" as const };
    const inherited = mergeAdaptationPatches(base, DEFAULT_PATCH);
    expect(changesEffectiveDesign(base, inherited)).toBe(false);
  });

  it("recognizes a real incremental refinement", () => {
    const base = { ...DEFAULT_PATCH, articleLayout: "swipe-cards" as const };
    const refined = mergeAdaptationPatches(base, { ...DEFAULT_PATCH, deckControls: "sides" as const });
    expect(changesEffectiveDesign(base, refined)).toBe(true);
  });
});
