import { DEFAULT_PATCH, type AdaptationField, type AdaptationPatch } from "./types";

export function changesEffectiveDesign(basePatch: AdaptationPatch | null, effectivePatch: AdaptationPatch): boolean {
  return JSON.stringify(basePatch ?? DEFAULT_PATCH) !== JSON.stringify(effectivePatch);
}

export function mergeAdaptationPatches(basePatch: AdaptationPatch | null, delta: AdaptationPatch, resetFields: AdaptationField[] = []): AdaptationPatch {
  const base = basePatch ?? DEFAULT_PATCH;
  const reset = new Set<AdaptationField>(resetFields);
  const number = (field: "fontScale" | "lineHeight" | "letterSpacingEm" | "contentMaxWidthRem"): number | null =>
    reset.has(field) ? null : delta[field] ?? base[field];
  const enumValue = <Field extends "articleLayout" | "deckControls" | "deckImageSize" | "deckLinkPosition" | "colorVisionMode" | "themePreset" | "colorScheme" | "contrast">(
    field: Field,
    unchanged: AdaptationPatch[Field],
  ): AdaptationPatch[Field] => reset.has(field) ? unchanged : delta[field] === unchanged ? base[field] : delta[field];

  const articleLayout = enumValue("articleLayout", "unchanged");
  const deckControls = articleLayout === "swipe-cards" ? enumValue("deckControls", "unchanged") : "unchanged";
  const deckImageSize = articleLayout === "swipe-cards" ? enumValue("deckImageSize", "unchanged") : "unchanged";
  const deckLinkPosition = articleLayout === "swipe-cards" ? enumValue("deckLinkPosition", "unchanged") : "unchanged";
  const hideSelectors = reset.has("hideSelectors")
    ? []
    : delta.hideSelectors.length
      ? [...new Set([...base.hideSelectors, ...delta.hideSelectors])].slice(0, 12)
      : [...base.hideSelectors];
  const baseFeedFilterTerms = base.feedFilterTerms ?? [];
  const deltaFeedFilterTerms = delta.feedFilterTerms ?? [];
  const feedFilterTerms = reset.has("feedFilterTerms")
    ? []
    : deltaFeedFilterTerms.length
      ? [...new Set([...baseFeedFilterTerms, ...deltaFeedFilterTerms])].slice(0, 8)
      : [...baseFeedFilterTerms];
  const baseAutomationAssets = base.automationAssets ?? [];
  const deltaAutomationAssets = delta.automationAssets ?? [];
  const automationAssets = reset.has("automationAssets")
    ? []
    : deltaAutomationAssets.length
      ? [...new Map([...baseAutomationAssets, ...deltaAutomationAssets].map((asset) => [JSON.stringify(asset), asset])).values()].slice(0, 8)
      : [...baseAutomationAssets];

  return {
    fontScale: number("fontScale"),
    lineHeight: number("lineHeight"),
    letterSpacingEm: number("letterSpacingEm"),
    contentMaxWidthRem: number("contentMaxWidthRem"),
    headingColor: reset.has("headingColor") ? null : delta.headingColor ?? base.headingColor,
    articleLayout,
    deckControls,
    deckImageSize,
    deckLinkPosition,
    colorVisionMode: enumValue("colorVisionMode", "unchanged"),
    themePreset: enumValue("themePreset", "unchanged"),
    colorScheme: enumValue("colorScheme", "unchanged"),
    contrast: enumValue("contrast", "unchanged"),
    reduceMotion: reset.has("reduceMotion") ? false : delta.reduceMotion || base.reduceMotion,
    strongFocus: reset.has("strongFocus") ? false : delta.strongFocus || base.strongFocus,
    hideSponsoredContent: reset.has("hideSponsoredContent") ? false : delta.hideSponsoredContent === true || base.hideSponsoredContent === true,
    hideVideoPosts: reset.has("hideVideoPosts") ? false : delta.hideVideoPosts === true || base.hideVideoPosts === true,
    feedFilterTerms,
    automationAssets,
    hideSelectors,
  };
}
