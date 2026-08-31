export type ProviderKind = "openai" | "anthropic" | "azure" | "tokenrouter" | "openrouter" | "gemini";

export interface ProviderConfig {
  provider: ProviderKind;
  model: string;
  apiKey: string;
  endpoint?: string;
  transcriptionModel?: string;
}

export type ColorScheme = "unchanged" | "light" | "dark";
export type ContrastMode = "unchanged" | "more";
export type ArticleLayout = "unchanged" | "swipe-cards";
export type DeckControls = "unchanged" | "sides";
export type DeckImageSize = "unchanged" | "compact";
export type DeckLinkPosition = "unchanged" | "footer";
export type ColorVisionMode = "unchanged" | "avoid-red" | "avoid-blue";
export type ThemePreset = "unchanged" | "warm-hospitality" | "clean-minimal" | "bold-dark" | "paper-editorial";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export type AutomationTrigger = "page-ready" | "dom-mutation";
export type AutomationContainerStrategy = "nearest-feed-item" | "nearest-repeating-ancestor" | "evidence-cluster";
export type DomAutomationSkillId =
  | "semantic-attribute-evidence"
  | "exact-text-evidence"
  | "descendant-element-evidence"
  | "nearest-semantic-container"
  | "evidence-cluster-container"
  | "repeating-ancestor-container"
  | "dynamic-content-trigger";

export interface DomFilterAutomationAsset {
  type: "dom-filter";
  name: string;
  skills: DomAutomationSkillId[];
  triggers: AutomationTrigger[];
  evidence: {
    text: string[];
    attributes: string[];
    descendantTags: Array<"video">;
  };
  container: AutomationContainerStrategy;
  action: "hide";
}

export type AutomationAsset = DomFilterAutomationAsset;

export interface AdaptationPatch {
  fontScale: number | null;
  lineHeight: number | null;
  letterSpacingEm: number | null;
  contentMaxWidthRem: number | null;
  headingColor: string | null;
  articleLayout: ArticleLayout;
  deckControls: DeckControls;
  deckImageSize: DeckImageSize;
  deckLinkPosition: DeckLinkPosition;
  colorVisionMode: ColorVisionMode;
  themePreset: ThemePreset;
  colorScheme: ColorScheme;
  contrast: ContrastMode;
  hideDemoAds: boolean;
  deemphasizeImages: boolean;
  reduceMotion: boolean;
  strongFocus: boolean;
  hideSponsoredContent: boolean;
  hideVideoPosts: boolean;
  feedFilterTerms: string[];
  automationAssets: AutomationAsset[];
  hideSelectors: string[];
}

export const ADAPTATION_FIELDS = [
  "fontScale",
  "lineHeight",
  "letterSpacingEm",
  "contentMaxWidthRem",
  "headingColor",
  "articleLayout",
  "deckControls",
  "deckImageSize",
  "deckLinkPosition",
  "colorVisionMode",
  "themePreset",
  "colorScheme",
  "contrast",
  "hideDemoAds",
  "deemphasizeImages",
  "reduceMotion",
  "strongFocus",
  "hideSponsoredContent",
  "hideVideoPosts",
  "feedFilterTerms",
  "automationAssets",
  "hideSelectors",
] as const;

export type AdaptationField = typeof ADAPTATION_FIELDS[number];

export interface Proposal {
  summary: string;
  patch: AdaptationPatch;
  resetFields?: AdaptationField[];
}

export interface ApplyReport {
  applied: boolean;
  affectedElements: number;
  details: string[];
}

export interface PageContext {
  tabId: number;
  documentToken: string;
  navigationToken: string;
  url: string;
  origin: string;
  title: string;
}

export interface PageSnapshot {
  context: PageContext;
  headings: string[];
  landmarks: string[];
  controls: string[];
  text: string;
  feedPatterns?: Array<{ text: string; source: "rendered-text" | "aria-label" | "title" | "data-content"; occurrences: number }>;
  domSignals?: Array<{
    kind: "attribute-presence" | "descendant-tag";
    name: string;
    occurrences: number;
    relevance: "request-match" | "content-marker" | "structural";
  }>;
}

export interface SiteProfile {
  id: string;
  origin: string;
  name: string;
  patch: AdaptationPatch;
  createdAt: string;
  updatedAt: string;
  schemaVersion: 1;
}

export interface SharedDesign {
  format: "tweaksy-design";
  schemaVersion: 1;
  origin: string;
  name: string;
  patch: AdaptationPatch;
  exportedAt: string;
}

export interface SiteStatus {
  hasProfile: boolean;
  paused: boolean;
  shutdown: boolean;
}

export interface TweaksyToggleState {
  origin: string | null;
  siteDisabled: boolean;
  shutdown: boolean;
}

export type ExtensionMessage =
  | { type: "GET_ACTIVE_CONTEXT" }
  | { type: "GET_ACTIVE_TAB_ID" }
  | { type: "GET_TWEAKSY_TOGGLE_STATE" }
  | { type: "SET_ACTIVE_SITE_DISABLED"; disabled: boolean }
  | { type: "SET_GLOBAL_DISABLED"; disabled: boolean }
  | { type: "REQUEST_ACTIVE_SITE_ACCESS" }
  | { type: "INSPECT_ACTIVE_PAGE"; request?: string }
  | { type: "GET_PROVIDER_CONFIG" }
  | { type: "SAVE_PROVIDER_CONFIG"; config: ProviderConfig }
  | { type: "GENERATE_PROPOSAL"; request: string; snapshot: PageSnapshot; history: ChatTurn[]; basePatch?: AdaptationPatch }
  | { type: "APPLY_PREVIEW"; context: PageContext; proposal: Proposal }
  | { type: "REVERT_PREVIEW"; context: PageContext }
  | { type: "SAVE_PROFILE"; context: PageContext; proposal: Proposal }
  | { type: "GET_SITE_STATUS" }
  | { type: "GET_ACTIVE_PROFILE" }
  | { type: "VALIDATE_SHARED_DESIGN"; design: unknown }
  | { type: "SET_SITE_PAUSED"; context: PageContext; paused: boolean }
  | { type: "GET_PROFILE_FOR_URL"; url: string }
  | { type: "TRANSCRIBE_AUDIO"; base64: string; mimeType: string }
  | { type: "CONTENT_GET_CONTEXT" }
  | { type: "CONTENT_SNAPSHOT"; request?: string }
  | { type: "CONTENT_APPLY"; context: PageContext; patch: AdaptationPatch; mode: "preview" | "approved"; summary?: string; resetFields?: AdaptationField[] }
  | { type: "CONTENT_CLEAR"; context: PageContext }
  | { type: "CONTENT_REVERT"; context: PageContext };

export interface MessageResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export const DEFAULT_PATCH: AdaptationPatch = {
  fontScale: null,
  lineHeight: null,
  letterSpacingEm: null,
  contentMaxWidthRem: null,
  headingColor: null,
  articleLayout: "unchanged",
  deckControls: "unchanged",
  deckImageSize: "unchanged",
  deckLinkPosition: "unchanged",
  colorVisionMode: "unchanged",
  themePreset: "unchanged",
  colorScheme: "unchanged",
  contrast: "unchanged",
  hideDemoAds: false,
  deemphasizeImages: false,
  reduceMotion: false,
  strongFocus: false,
  hideSponsoredContent: false,
  hideVideoPosts: false,
  feedFilterTerms: [],
  automationAssets: [],
  hideSelectors: [],
};

export function hasAdaptationChanges(patch: AdaptationPatch): boolean {
  return patch.fontScale !== null
    || patch.lineHeight !== null
    || patch.letterSpacingEm !== null
    || patch.contentMaxWidthRem !== null
    || patch.headingColor !== null
    || patch.articleLayout !== "unchanged"
    || patch.deckControls !== "unchanged"
    || patch.deckImageSize !== "unchanged"
    || patch.deckLinkPosition !== "unchanged"
    || patch.colorVisionMode !== "unchanged"
    || patch.themePreset !== "unchanged"
    || patch.colorScheme !== "unchanged"
    || patch.contrast !== "unchanged"
    || patch.hideDemoAds
    || patch.deemphasizeImages
    || patch.reduceMotion
    || patch.strongFocus
    || patch.hideSponsoredContent
    || patch.hideVideoPosts
    || (patch.feedFilterTerms?.length ?? 0) > 0
    || (patch.automationAssets?.length ?? 0) > 0
    || patch.hideSelectors.length > 0;
}
