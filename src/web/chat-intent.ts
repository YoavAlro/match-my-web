import type { AdaptationField, AdaptationPatch } from "../types";

export interface HostedChatPreview {
  summary: string;
  changes: Record<string, unknown>;
  resetFields: AdaptationField[];
}

function activeSafeChanges(patch: AdaptationPatch): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  if (patch.fontScale !== null) changes.fontScale = patch.fontScale;
  if (patch.lineHeight !== null) changes.lineHeight = patch.lineHeight;
  if (patch.letterSpacingEm !== null) changes.letterSpacingEm = patch.letterSpacingEm;
  if (patch.contentMaxWidthRem !== null) changes.contentMaxWidthRem = patch.contentMaxWidthRem;
  if (patch.articleLayout !== "unchanged") changes.articleLayout = patch.articleLayout;
  if (patch.deckControls !== "unchanged") changes.deckControls = patch.deckControls;
  if (patch.deckImageSize !== "unchanged") changes.deckImageSize = patch.deckImageSize;
  if (patch.deckLinkPosition !== "unchanged") changes.deckLinkPosition = patch.deckLinkPosition;
  if (patch.colorVisionMode !== "unchanged") changes.colorVisionMode = patch.colorVisionMode;
  if (patch.themePreset !== "unchanged") changes.themePreset = patch.themePreset;
  if (patch.colorScheme !== "unchanged") changes.colorScheme = patch.colorScheme;
  if (patch.contrast !== "unchanged") changes.contrast = patch.contrast;
  if (patch.reduceMotion) changes.reduceMotion = true;
  if (patch.strongFocus) changes.strongFocus = true;
  return changes;
}

export function interpretHostedChatRequest(request: string, currentPatch: AdaptationPatch): HostedChatPreview | null {
  const text = request.trim();
  if (text.length < 3 || text.length > 400) return null;
  const lower = text.toLowerCase();
  const changes = activeSafeChanges(currentPatch);
  const resetFields = new Set<AdaptationField>();
  const descriptions: string[] = [];

  const set = (field: string, value: unknown, description: string): void => {
    changes[field] = value;
    resetFields.delete(field as AdaptationField);
    if (!descriptions.includes(description)) descriptions.push(description);
  };
  const reset = (fields: AdaptationField[], description: string): void => {
    for (const field of fields) {
      delete changes[field];
      resetFields.add(field);
    }
    if (!descriptions.includes(description)) descriptions.push(description);
  };

  if (/\b(?:one|single)\s+(?:story|article|card)\b|\bone at a time\b|\bswipe(?:able)?\b|\bstory deck\b/.test(lower)) {
    set("articleLayout", "swipe-cards", "show one story at a time");
    set("deckControls", "sides", "add clear previous and next controls");
    set("deckImageSize", "compact", "keep images compact");
    set("deckLinkPosition", "footer", "keep each reading action at the card footer");
  }
  if (/\b(?:grid|all (?:six |the )?(?:stories|articles)|show everything|show them all)\b/.test(lower)) {
    reset(["articleLayout", "deckControls", "deckImageSize", "deckLinkPosition"], "return to the complete story grid");
  }

  if (/\b(?:larger|bigger|increase|enlarge)\b[^.]{0,35}\b(?:text|type|font|reading)\b|\beasier to read\b|\bmore readable\b|\blegible\b/.test(lower)) {
    set("fontScale", 1.24, "increase the reading type");
    set("lineHeight", 1.72, "open the line spacing");
  }
  if (/\b(?:smaller|decrease|reduce)\b[^.]{0,35}\b(?:text|type|font)\b|\bmore compact type\b/.test(lower)) {
    set("fontScale", 0.92, "make the type more compact");
  }
  if (/\b(?:more spacing|more space between lines|looser lines|open line spacing)\b/.test(lower)) {
    set("lineHeight", 1.82, "open the line spacing");
  }
  if (/\b(?:narrower|shorter lines|reading width|reading measure)\b/.test(lower)) {
    set("contentMaxWidthRem", 58, "narrow the reading measure");
  }
  if (/\b(?:wider|use more width|fuller width)\b/.test(lower)) {
    set("contentMaxWidthRem", 80, "widen the reading measure");
  }

  if (/\b(?:calm|calmer|quiet|quieter|focused|focus mode|less busy|less cluttered|simpler|simplify|less overwhelming)\b/.test(lower)) {
    set("fontScale", 1.16, "use calm, readable type");
    set("lineHeight", 1.68, "add breathing room");
    set("contentMaxWidthRem", 62, "narrow the reading measure");
    set("reduceMotion", true, "reduce nonessential motion");
    set("themePreset", "paper-editorial", "use a quiet editorial surface");
  }
  if (/\b(?:reduce|less|stop|disable|avoid)\b[^.]{0,30}\b(?:motion|animation|movement)\b|\bmotion sensitive\b/.test(lower)) {
    set("reduceMotion", true, "reduce nonessential motion");
  }
  if (/\b(?:restore|allow|normal)\b[^.]{0,25}\b(?:motion|animation)\b/.test(lower)) {
    reset(["reduceMotion"], "restore the original motion setting");
  }
  if (/\b(?:strong|clear|visible|better)\b[^.]{0,30}\b(?:focus|keyboard outline)\b|\bkeyboard focus\b/.test(lower)) {
    set("strongFocus", true, "strengthen keyboard focus");
  }
  if (/\b(?:high|higher|more|stronger)\b[^.]{0,20}\bcontrast\b/.test(lower)) {
    set("contrast", "more", "increase visual contrast");
  }
  if (/\b(?:avoid|replace|remove|without|no)\b[^.]{0,25}\bred\b|\bcolor ?blind\b|\bcolour ?blind\b/.test(lower)) {
    set("colorVisionMode", "avoid-red", "avoid red-only meaning");
  }

  if (/\b(?:dark|night)\b/.test(lower)) {
    set("colorScheme", "dark", "switch to a dark color scheme");
  }
  if (/\b(?:light|day)\b[^.]{0,20}\b(?:mode|theme|scheme|page)\b|\bmake it light\b/.test(lower)) {
    set("colorScheme", "light", "switch to a light color scheme");
  }
  if (/\b(?:warm|cozy|hospitality|airbnb)\b/.test(lower)) {
    set("themePreset", "warm-hospitality", "use a warm hospitality-inspired theme");
  } else if (/\b(?:minimal|clean|apple)\b/.test(lower)) {
    set("themePreset", "clean-minimal", "use a restrained minimal theme");
  } else if (/\b(?:bold|energetic|spotify)\b/.test(lower)) {
    set("themePreset", "bold-dark", "use a bold dark theme");
    set("colorScheme", "dark", "switch to a dark color scheme");
  } else if (/\b(?:paper|editorial|notion)\b/.test(lower)) {
    set("themePreset", "paper-editorial", "use a quiet editorial surface");
  }

  if (descriptions.length === 0) return null;
  const concise = descriptions.slice(0, 4);
  const summary = `Preview: ${concise.join(", ")}${descriptions.length > concise.length ? ", and related refinements" : ""}.`;
  return { summary, changes, resetFields: [...resetFields] };
}
