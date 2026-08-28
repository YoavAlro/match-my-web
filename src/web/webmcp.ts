import { hasAdaptationChanges } from "../types";
import type { AdaptationController, AdaptationSnapshot } from "./adaptation-controller";
import { inspectTweaksySurface } from "./surface-inventory";

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

export const previewAdaptationInputSchema = {
  type: "object",
  properties: {
    expectedRevision: expectedRevisionProperty,
    summary: {
      type: "string",
      minLength: 4,
      maxLength: 240,
      description: "A concise, human-readable explanation of the proposed adaptation.",
    },
    changes: {
      type: "object",
      description: "A narrow set of vetted visual preferences. Raw CSS, HTML, scripts, URLs, selectors, and content edits are not accepted.",
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
          "fontScale",
          "lineHeight",
          "letterSpacingEm",
          "contentMaxWidthRem",
          "articleLayout",
          "deckControls",
          "deckImageSize",
          "deckLinkPosition",
          "colorVisionMode",
          "themePreset",
          "colorScheme",
          "contrast",
          "reduceMotion",
          "strongFocus",
        ],
      },
    },
  },
  required: ["expectedRevision", "summary", "changes"],
  additionalProperties: false,
} as const;

function stateResult(snapshot: AdaptationSnapshot): Record<string, unknown> {
  const approved = hasAdaptationChanges(snapshot.approvedPatch);
  return {
    revision: snapshot.revision,
    mode: snapshot.preview ? "preview" : approved ? "approved" : "original",
    persisted: approved && snapshot.persistence === "local",
    persistenceScope: snapshot.persistence === "local" ? "this browser and site origin" : "this page session",
    preview: snapshot.preview
      ? {
          id: snapshot.preview.id,
          summary: snapshot.preview.summary,
          source: snapshot.preview.source,
          createdAt: snapshot.preview.createdAt,
        }
      : null,
    effectiveDesign: snapshot.effectivePatch,
    approvedDesign: snapshot.approvedPatch,
    verification: snapshot.verification,
    recentActivity: snapshot.activity.slice(0, 4),
  };
}

function parseClosedInput(input: unknown, toolName: string, allowedFields: readonly string[]): Record<string, unknown> {
  const value = input === undefined ? {} : input;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${toolName} input must be an object.`);
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(allowedFields);
  const unknownField = Object.keys(record).find((field) => !allowed.has(field));
  if (unknownField) throw new Error(`${toolName} input contains unsupported field: ${unknownField}.`);
  return record;
}

export function createTweaksyWebMcpTools(
  controller: AdaptationController,
  root: HTMLElement,
): WebMcpToolDefinition[] {
  return [
    {
      name: "inspect_tweaksy_surface",
      description: "Inspect the Harborline demo surface, available adaptation capabilities, content counts, and safety guarantees. This does not change the page.",
      inputSchema: emptyInputSchema,
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        parseClosedInput(input, "inspect_tweaksy_surface", []);
        return inspectTweaksySurface(root);
      },
    },
    {
      name: "get_tweaksy_state",
      description: "Read the current Tweaksy revision, effective design, pending preview, approved design, verification counts, and recent activity. This does not change the page.",
      inputSchema: emptyInputSchema,
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        parseClosedInput(input, "get_tweaksy_state", []);
        return stateResult(controller.getState());
      },
    },
    {
      name: "preview_tweaksy_adaptation",
      description: "Apply a reversible visual preview to the Harborline demo using only vetted design fields. This changes the visible demo in memory and replaces any current preview, but never saves without approval. Call get_tweaksy_state first and pass its revision.",
      inputSchema: previewAdaptationInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      execute: async (rawInput) => {
        const input = parseClosedInput(rawInput, "preview_tweaksy_adaptation", ["expectedRevision", "summary", "changes", "resetFields"]);
        const snapshot = controller.previewAdaptation({
          expectedRevision: input.expectedRevision as number,
          summary: input.summary as string,
          changes: input.changes,
          resetFields: input.resetFields,
        }, "webmcp");
        return {
          status: "preview_ready",
          revision: snapshot.revision,
          preview: snapshot.preview
            ? { id: snapshot.preview.id, summary: snapshot.preview.summary, source: snapshot.preview.source }
            : null,
          verification: snapshot.verification,
          effectiveDesign: snapshot.effectivePatch,
          persisted: false,
          nextStep: "Let the person inspect the visible preview. They can approve or discard it in the Tweaksy dock.",
        };
      },
    },
    {
      name: "discard_tweaksy_preview",
      description: "Discard the current unsaved Tweaksy preview and restore the last approved design. This is a reversible, local page change and does not delete approved preferences.",
      inputSchema: {
        type: "object",
        properties: { expectedRevision: expectedRevisionProperty },
        required: ["expectedRevision"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      execute: async (rawInput) => {
        const input = parseClosedInput(rawInput, "discard_tweaksy_preview", ["expectedRevision"]);
        const snapshot = controller.discardPreview(input.expectedRevision);
        return {
          status: "preview_discarded",
          revision: snapshot.revision,
          verification: snapshot.verification,
          persistedDesignUnchanged: true,
        };
      },
    },
    {
      name: "approve_tweaksy_preview",
      description: "Approve the exact current Tweaksy preview. This saves the vetted design in this browser's local storage when available, or keeps it for the current page session when storage is blocked. Only call after the person explicitly asks to approve the visible preview.",
      inputSchema: {
        type: "object",
        properties: {
          previewId: {
            type: "string",
            minLength: 1,
            maxLength: 100,
            description: "The exact preview id returned by preview_tweaksy_adaptation or get_tweaksy_state.",
          },
          expectedRevision: expectedRevisionProperty,
        },
        required: ["previewId", "expectedRevision"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      execute: async (rawInput) => {
        const input = parseClosedInput(rawInput, "approve_tweaksy_preview", ["previewId", "expectedRevision"]);
        const snapshot = controller.approvePreview(input.previewId, input.expectedRevision);
        return {
          status: "preview_approved",
          revision: snapshot.revision,
          persisted: snapshot.persistence === "local",
          persistenceScope: snapshot.persistence === "local"
            ? "This browser and this site origin only"
            : "This page session only because browser storage is unavailable",
          verification: snapshot.verification,
        };
      },
    },
  ];
}

export async function registerTweaksyWebMcpTools(
  controller: AdaptationController,
  root: HTMLElement,
): Promise<number> {
  if (typeof document.modelContext?.registerTool !== "function") return 0;
  const tools = createTweaksyWebMcpTools(controller, root);
  for (const tool of tools) await document.modelContext.registerTool(tool);
  return tools.length;
}
