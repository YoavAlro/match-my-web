import type { AdaptationField, AdaptationPatch } from "./types";

export const REAL_PAGE_WEBMCP_ACTIVATE_EVENT = "tweaksy:webmcp-activate:v1";
export const REAL_PAGE_WEBMCP_REQUEST_EVENT = "tweaksy:webmcp-request:v1";
export const REAL_PAGE_WEBMCP_RESPONSE_EVENT = "tweaksy:webmcp-response:v1";

export const REAL_PAGE_WEBMCP_TOOL_NAMES = [
  "inspect_tweaksy_surface",
  "get_tweaksy_state",
  "preview_tweaksy_adaptation",
  "discard_tweaksy_preview",
] as const;

export type RealPageWebMcpToolName = typeof REAL_PAGE_WEBMCP_TOOL_NAMES[number];

export interface RealPageWebMcpRequest {
  requestId: string;
  tool: RealPageWebMcpToolName;
  input: Record<string, unknown>;
}

export interface RealPageWebMcpResponse {
  requestId: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface RealPagePreviewInput {
  expectedRevision: number;
  summary: string;
  changes: Partial<AdaptationPatch>;
  resetFields: AdaptationField[];
}

const emptyInputSchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

const expectedRevisionProperty = {
  type: "integer",
  minimum: 0,
  description: "The revision returned by get_tweaksy_state. Prevents changing stale page state.",
} as const;

export const realPagePreviewInputSchema = {
  type: "object",
  properties: {
    expectedRevision: expectedRevisionProperty,
    summary: {
      type: "string",
      minLength: 4,
      maxLength: 240,
      description: "A concise explanation of the proposed visual adaptation.",
    },
    changes: {
      type: "object",
      description: "Vetted visual preferences only. Raw CSS, HTML, scripts, selectors, URLs, and content edits are not accepted.",
      properties: {
        fontScale: { type: "number", minimum: 0.8, maximum: 2 },
        lineHeight: { type: "number", minimum: 1.1, maximum: 2.5 },
        letterSpacingEm: { type: "number", minimum: 0, maximum: 0.12 },
        contentMaxWidthRem: { type: "number", minimum: 30, maximum: 100 },
        articleLayout: { type: "string", enum: ["unchanged", "swipe-cards"] },
        deckControls: { type: "string", enum: ["unchanged", "sides"] },
        deckImageSize: { type: "string", enum: ["unchanged", "compact"] },
        deckLinkPosition: { type: "string", enum: ["unchanged", "footer"] },
        colorVisionMode: { type: "string", enum: ["unchanged", "avoid-red"] },
        themePreset: { type: "string", enum: ["unchanged", "warm-hospitality", "clean-minimal", "bold-dark", "paper-editorial"] },
        colorScheme: { type: "string", enum: ["unchanged", "light", "dark"] },
        contrast: { type: "string", enum: ["unchanged", "more"] },
        reduceMotion: { type: "boolean" },
        strongFocus: { type: "boolean" },
      },
      additionalProperties: false,
    },
    resetFields: {
      type: "array",
      maxItems: 15,
      uniqueItems: true,
      description: "Optional vetted fields to restore to their original values.",
      items: {
        type: "string",
        enum: [
          "fontScale", "lineHeight", "letterSpacingEm", "contentMaxWidthRem",
          "articleLayout", "deckControls", "deckImageSize", "deckLinkPosition",
          "colorVisionMode", "themePreset", "colorScheme", "contrast",
          "reduceMotion", "strongFocus",
        ],
      },
    },
  },
  required: ["expectedRevision", "summary", "changes"],
  additionalProperties: false,
} as const;

const previewFields = new Set([
  "fontScale", "lineHeight", "letterSpacingEm", "contentMaxWidthRem",
  "articleLayout", "deckControls", "deckImageSize", "deckLinkPosition",
  "colorVisionMode", "themePreset", "colorScheme", "contrast",
  "reduceMotion", "strongFocus",
]);

const resetFields = new Set<AdaptationField>([...previewFields] as AdaptationField[]);

function closedRecord(input: unknown, toolName: string, allowedFields: readonly string[]): Record<string, unknown> {
  const value = input === undefined ? {} : input;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${toolName} input must be an object.`);
  const record = value as Record<string, unknown>;
  const allowed = new Set(allowedFields);
  const unsupported = Object.keys(record).find((field) => !allowed.has(field));
  if (unsupported) throw new Error(`${toolName} input contains unsupported field: ${unsupported}.`);
  return record;
}

function numberInRange(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${field} must be a number between ${min} and ${max}.`);
  }
  return value;
}

function enumValue<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`${field} has an unsupported value.`);
  return value as T;
}

function validateChanges(input: unknown): Partial<AdaptationPatch> {
  const changes = closedRecord(input, "preview_tweaksy_adaptation changes", [...previewFields]);
  const result: Partial<AdaptationPatch> = {};
  for (const [field, value] of Object.entries(changes)) {
    switch (field) {
      case "fontScale": result.fontScale = numberInRange(value, field, 0.8, 2); break;
      case "lineHeight": result.lineHeight = numberInRange(value, field, 1.1, 2.5); break;
      case "letterSpacingEm": result.letterSpacingEm = numberInRange(value, field, 0, 0.12); break;
      case "contentMaxWidthRem": result.contentMaxWidthRem = numberInRange(value, field, 30, 100); break;
      case "articleLayout": result.articleLayout = enumValue(value, field, ["unchanged", "swipe-cards"]); break;
      case "deckControls": result.deckControls = enumValue(value, field, ["unchanged", "sides"]); break;
      case "deckImageSize": result.deckImageSize = enumValue(value, field, ["unchanged", "compact"]); break;
      case "deckLinkPosition": result.deckLinkPosition = enumValue(value, field, ["unchanged", "footer"]); break;
      case "colorVisionMode": result.colorVisionMode = enumValue(value, field, ["unchanged", "avoid-red"]); break;
      case "themePreset": result.themePreset = enumValue(value, field, ["unchanged", "warm-hospitality", "clean-minimal", "bold-dark", "paper-editorial"]); break;
      case "colorScheme": result.colorScheme = enumValue(value, field, ["unchanged", "light", "dark"]); break;
      case "contrast": result.contrast = enumValue(value, field, ["unchanged", "more"]); break;
      case "reduceMotion":
      case "strongFocus":
        if (typeof value !== "boolean") throw new Error(`${field} must be true or false.`);
        result[field] = value;
        break;
    }
  }
  return result;
}

export function parseRealPageWebMcpRequest(input: unknown): RealPageWebMcpRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid Tweaksy WebMCP request.");
  const value = input as Record<string, unknown>;
  const unsupported = Object.keys(value).find((field) => !["requestId", "tool", "input"].includes(field));
  if (unsupported) throw new Error(`Tweaksy WebMCP request contains unsupported field: ${unsupported}.`);
  if (typeof value.requestId !== "string" || !/^[a-zA-Z0-9-]{8,100}$/.test(value.requestId)) throw new Error("Invalid Tweaksy WebMCP request id.");
  if (typeof value.tool !== "string" || !REAL_PAGE_WEBMCP_TOOL_NAMES.includes(value.tool as RealPageWebMcpToolName)) throw new Error("Unsupported Tweaksy WebMCP tool.");
  const tool = value.tool as RealPageWebMcpToolName;
  const rawInput = value.input;
  const parsedInput = tool === "preview_tweaksy_adaptation"
    ? closedRecord(rawInput, tool, ["expectedRevision", "summary", "changes", "resetFields"])
    : tool === "discard_tweaksy_preview"
      ? closedRecord(rawInput, tool, ["expectedRevision"])
      : closedRecord(rawInput, tool, []);
  return { requestId: value.requestId, tool, input: parsedInput };
}

export function parseRealPagePreviewInput(input: unknown): RealPagePreviewInput {
  const value = closedRecord(input, "preview_tweaksy_adaptation", ["expectedRevision", "summary", "changes", "resetFields"]);
  if (!Number.isInteger(value.expectedRevision) || (value.expectedRevision as number) < 0) throw new Error("expectedRevision must be a non-negative integer.");
  if (typeof value.summary !== "string" || value.summary.trim().length < 4 || value.summary.trim().length > 240) {
    throw new Error("summary must be between 4 and 240 characters.");
  }
  if (!Object.hasOwn(value, "changes")) throw new Error("changes is required.");
  const requestedResets = value.resetFields === undefined ? [] : value.resetFields;
  if (!Array.isArray(requestedResets) || requestedResets.length > 15) throw new Error("resetFields must contain at most 15 supported fields.");
  const parsedResets = [...new Set(requestedResets.map((field) => {
    if (typeof field !== "string" || !resetFields.has(field as AdaptationField)) throw new Error("resetFields contains an unsupported field.");
    return field as AdaptationField;
  }))];
  return {
    expectedRevision: value.expectedRevision as number,
    summary: value.summary.trim(),
    changes: validateChanges(value.changes),
    resetFields: parsedResets,
  };
}

export function parseExpectedRevision(input: unknown, toolName: string): number {
  const value = closedRecord(input, toolName, ["expectedRevision"]);
  if (!Number.isInteger(value.expectedRevision) || (value.expectedRevision as number) < 0) throw new Error("expectedRevision must be a non-negative integer.");
  return value.expectedRevision as number;
}

export function isRealPageWebMcpResponse(input: unknown, requestId: string): input is RealPageWebMcpResponse {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  return value.requestId === requestId && typeof value.ok === "boolean";
}

export function createRealPageWebMcpTools(
  execute: (tool: RealPageWebMcpToolName, input: Record<string, unknown>) => Promise<unknown>,
): WebMcpToolDefinition[] {
  return [
    {
      name: "inspect_tweaksy_surface",
      description: "Inspect the real top-level page Tweaksy is currently attached to, its content counts, supported adaptations, and safety boundaries. This does not change the page.",
      inputSchema: emptyInputSchema,
      annotations: { readOnlyHint: true },
      execute: (input) => execute("inspect_tweaksy_surface", closedRecord(input, "inspect_tweaksy_surface", [])),
    },
    {
      name: "get_tweaksy_state",
      description: "Read the current real-page Tweaksy revision, effective design, approved design, and pending preview. This does not change the page.",
      inputSchema: emptyInputSchema,
      annotations: { readOnlyHint: true },
      execute: (input) => execute("get_tweaksy_state", closedRecord(input, "get_tweaksy_state", [])),
    },
    {
      name: "preview_tweaksy_adaptation",
      description: "Apply a reversible adaptation preview to the real page using vetted visual fields only. This never saves a profile. Call get_tweaksy_state first, pass its revision, and let the person inspect the result in the browser.",
      inputSchema: realPagePreviewInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      execute: (input) => execute("preview_tweaksy_adaptation", closedRecord(input, "preview_tweaksy_adaptation", ["expectedRevision", "summary", "changes", "resetFields"])),
    },
    {
      name: "discard_tweaksy_preview",
      description: "Discard the current unsaved Tweaksy preview on the real page and restore its last human-approved design. This does not delete saved preferences.",
      inputSchema: {
        type: "object",
        properties: { expectedRevision: expectedRevisionProperty },
        required: ["expectedRevision"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      execute: (input) => execute("discard_tweaksy_preview", closedRecord(input, "discard_tweaksy_preview", ["expectedRevision"])),
    },
  ];
}
