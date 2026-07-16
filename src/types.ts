export type ProviderKind = "openai" | "anthropic" | "azure";

export interface ProviderConfig {
  provider: ProviderKind;
  model: string;
  apiKey: string;
  endpoint?: string;
  transcriptionModel?: string;
}

export type ColorScheme = "unchanged" | "light" | "dark";
export type ContrastMode = "unchanged" | "more";

export interface AdaptationPatch {
  fontScale: number | null;
  lineHeight: number | null;
  letterSpacingEm: number | null;
  contentMaxWidthRem: number | null;
  colorScheme: ColorScheme;
  contrast: ContrastMode;
  reduceMotion: boolean;
  strongFocus: boolean;
  hideSelectors: string[];
}

export interface Proposal {
  summary: string;
  patch: AdaptationPatch;
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

export type ExtensionMessage =
  | { type: "GET_ACTIVE_CONTEXT" }
  | { type: "GET_ACTIVE_TAB_ID" }
  | { type: "REQUEST_ACTIVE_SITE_ACCESS" }
  | { type: "INSPECT_ACTIVE_PAGE" }
  | { type: "GET_PROVIDER_CONFIG" }
  | { type: "SAVE_PROVIDER_CONFIG"; config: ProviderConfig }
  | { type: "GENERATE_PROPOSAL"; request: string; snapshot: PageSnapshot }
  | { type: "APPLY_PREVIEW"; context: PageContext; proposal: Proposal }
  | { type: "REVERT_PREVIEW"; context: PageContext }
  | { type: "SAVE_PROFILE"; context: PageContext; proposal: Proposal }
  | { type: "GET_PROFILE_FOR_URL"; url: string }
  | { type: "TRANSCRIBE_AUDIO"; base64: string; mimeType: string }
  | { type: "CONTENT_GET_CONTEXT" }
  | { type: "CONTENT_SNAPSHOT" }
  | { type: "CONTENT_APPLY"; context: PageContext; patch: AdaptationPatch; mode: "preview" | "approved" }
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
  colorScheme: "unchanged",
  contrast: "unchanged",
  reduceMotion: false,
  strongFocus: true,
  hideSelectors: [],
};
