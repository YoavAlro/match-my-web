import type { AdaptationPatch, Proposal, ProviderConfig } from "./types";

const FORBIDDEN_SELECTOR = /(?:url\s*\(|@import|javascript:|data:|\[[^\]]*(?:value|src|href)\s*[*^$|~]?=|:has\s*\()/i;
const SAFE_SELECTOR = /^(?:[.#]?[a-zA-Z][\w-]*|\[[a-zA-Z][\w-]*(?:=["']?[\w -]+["']?)?\])(?:[ >+~:.#\[\]="'()\w-])*$/;
const ESSENTIAL_SELECTOR = /(?:\[role\s*=|(?:^|[\s>+~,(])(?:html|body|main|nav|header|footer|form|dialog|button|input|textarea|select|a)(?=$|[\s>+~.#:[(]))/i;
const SAFE_NAMED_COLORS = new Set([
  "black", "white", "gray", "grey", "red", "orange", "yellow", "green", "blue", "purple", "pink", "brown", "navy", "teal", "maroon",
]);

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export function sanitizeSelector(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const selector = value.trim();
  if (!selector || selector.length > 160 || FORBIDDEN_SELECTOR.test(selector) || ESSENTIAL_SELECTOR.test(selector) || !SAFE_SELECTOR.test(selector)) return null;
  return selector;
}

export function sanitizeColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const color = value.trim().toLowerCase();
  if (SAFE_NAMED_COLORS.has(color) || /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color)) return color;
  return null;
}

export function validatePatch(input: unknown): AdaptationPatch {
  const value = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const selectors = Array.isArray(value.hideSelectors)
    ? value.hideSelectors.map(sanitizeSelector).filter((item): item is string => item !== null).slice(0, 12)
    : [];
  const optionalNumber = (item: unknown, min: number, max: number): number | null =>
    item === null || item === undefined ? null : clampNumber(item, min, max, min);
  const maxWidth = value.contentMaxWidthRem === null || value.contentMaxWidthRem === undefined
    ? null
    : clampNumber(value.contentMaxWidthRem, 30, 100, 70);

  return {
    fontScale: optionalNumber(value.fontScale, 0.8, 2),
    lineHeight: optionalNumber(value.lineHeight, 1.1, 2.5),
    letterSpacingEm: optionalNumber(value.letterSpacingEm, 0, 0.12),
    contentMaxWidthRem: maxWidth,
    headingColor: sanitizeColor(value.headingColor),
    colorScheme: value.colorScheme === "light" || value.colorScheme === "dark" ? value.colorScheme : "unchanged",
    contrast: value.contrast === "more" ? "more" : "unchanged",
    reduceMotion: value.reduceMotion === true,
    strongFocus: value.strongFocus === true,
    hideSelectors: [...new Set(selectors)],
  };
}

export function validateProposal(input: unknown): Proposal {
  if (!input || typeof input !== "object") throw new Error("The provider did not return an adaptation object.");
  const value = input as Record<string, unknown>;
  const summary = typeof value.summary === "string" ? value.summary.trim().slice(0, 500) : "Suggested visual adaptation";
  return { summary, patch: validatePatch(value.patch) };
}

export function validateProviderConfig(input: unknown): ProviderConfig {
  if (!input || typeof input !== "object") throw new Error("Provider configuration is missing.");
  const value = input as Record<string, unknown>;
  if (value.provider !== "openai" && value.provider !== "anthropic" && value.provider !== "azure") throw new Error("Unsupported AI provider.");
  if (typeof value.model !== "string" || !value.model.trim() || value.model.length > 120) throw new Error("Enter a valid model name.");
  if (typeof value.apiKey !== "string" || value.apiKey.length < 8 || value.apiKey.length > 512) throw new Error("Enter a valid API key.");
  const transcriptionModel = typeof value.transcriptionModel === "string" ? value.transcriptionModel.trim().slice(0, 120) : "";
  if (value.provider === "azure") {
    if (typeof value.endpoint !== "string") throw new Error("Enter your Azure OpenAI resource endpoint.");
    let endpoint: URL;
    try {
      endpoint = new URL(value.endpoint.trim());
    } catch {
      throw new Error("Enter a valid Azure OpenAI endpoint URL.");
    }
    const host = endpoint.hostname.toLowerCase();
    const allowedHost = host.endsWith(".openai.azure.com")
      || host.endsWith(".services.ai.azure.com")
      || host.endsWith(".cognitiveservices.azure.com");
    if (endpoint.protocol !== "https:" || !allowedHost || endpoint.username || endpoint.password) {
      throw new Error("Use an HTTPS endpoint hosted by Microsoft Azure.");
    }
    return {
      provider: "azure",
      model: value.model.trim(),
      apiKey: value.apiKey.trim(),
      endpoint: endpoint.origin,
      ...(transcriptionModel ? { transcriptionModel } : {}),
    };
  }
  return {
    provider: value.provider,
    model: value.model.trim(),
    apiKey: value.apiKey.trim(),
    ...(transcriptionModel ? { transcriptionModel } : {}),
  };
}

export function parseProviderJson(text: string): Proposal {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The provider response did not contain JSON.");
  return validateProposal(JSON.parse(candidate.slice(start, end + 1)));
}
