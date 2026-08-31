import { hasAdaptationChanges } from "../types";
import type { AdaptationController, AdaptationSnapshot } from "./adaptation-controller";
import type { AccessibilityMode, AssistiveController, ReadingScope } from "./assistive-controller";
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
        colorVisionMode: { type: "string", enum: ["unchanged", "avoid-red", "avoid-blue"] },
        themePreset: { type: "string", enum: ["unchanged", "warm-hospitality", "clean-minimal", "bold-dark", "paper-editorial"] },
        colorScheme: { type: "string", enum: ["unchanged", "light", "dark"] },
        contrast: { type: "string", enum: ["unchanged", "more"] },
        hideDemoAds: { type: "boolean", description: "Hide the clearly marked Harborline demo advertisements." },
        deemphasizeImages: { type: "boolean", description: "Reduce saturation and visual weight of decorative story artwork." },
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
          "hideDemoAds",
          "deemphasizeImages",
          "reduceMotion",
          "strongFocus",
        ],
      },
    },
  },
  required: ["expectedRevision", "summary", "changes"],
  additionalProperties: false,
} as const;

function stateResult(snapshot: AdaptationSnapshot, assistive: AssistiveController): Record<string, unknown> {
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
    assistive: assistive.getState(),
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
  assistive: AssistiveController,
): WebMcpToolDefinition[] {
  return [
    {
      name: "inspect_tweaksy_surface",
      description: "Inspect the Harborline demo surface, visual and assistive capabilities, content counts, and safety guarantees. This does not change the page.",
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
        return stateResult(controller.getState(), assistive);
      },
    },
    {
      name: "preview_tweaksy_accessibility_mode",
      description: "Preview one of ten vetted accessibility modes on Harborline: color-safe, blue-safe, low-vision, large-text, dyslexia-friendly, reduced-motion, high-contrast, image-free, cognitive-load, or keyboard-access. The preview is visible and reversible but not saved. Call get_tweaksy_state first and pass its revision.",
      inputSchema: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["color-safe", "blue-safe", "low-vision", "large-text", "dyslexia-friendly", "reduced-motion", "high-contrast", "image-free", "cognitive-load", "keyboard-access"] },
          expectedRevision: expectedRevisionProperty,
        },
        required: ["mode", "expectedRevision"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      execute: async (rawInput) => {
        const input = parseClosedInput(rawInput, "preview_tweaksy_accessibility_mode", ["mode", "expectedRevision"]);
        const modes: AccessibilityMode[] = ["color-safe", "blue-safe", "low-vision", "large-text", "dyslexia-friendly", "reduced-motion", "high-contrast", "image-free", "cognitive-load", "keyboard-access"];
        if (!modes.includes(input.mode as AccessibilityMode)) throw new Error(`mode must be one of: ${modes.join(", ")}.`);
        const snapshot = assistive.previewAccessibilityMode(input.mode as AccessibilityMode, input.expectedRevision as number, "webmcp");
        return {
          status: "accessibility_preview_ready",
          mode: input.mode,
          revision: snapshot.revision,
          preview: snapshot.preview,
          verification: snapshot.verification,
          persisted: false,
          nextStep: "Ask the person to inspect the visible page in ChatGPT, then call approve_tweaksy_preview or discard_tweaksy_preview only after they explicitly choose.",
        };
      },
    },
    {
      name: "read_tweaksy_content",
      description: "Read owned Harborline content aloud through the browser speech engine. Choose a page summary, the current story, or all headlines. This starts audible speech on the person's device, does not send content over the network, and is a reading aid rather than a replacement for a screen reader.",
      inputSchema: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["page-summary", "current-story", "all-headlines"] },
          rate: { type: "number", minimum: 0.8, maximum: 1.4, description: "Optional speech rate; defaults to 1." },
        },
        required: ["scope"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      execute: async (rawInput) => {
        const input = parseClosedInput(rawInput, "read_tweaksy_content", ["scope", "rate"]);
        if (!(["page-summary", "current-story", "all-headlines"] as unknown[]).includes(input.scope)) {
          throw new Error("scope must be page-summary, current-story, or all-headlines.");
        }
        const state = assistive.read(input.scope as ReadingScope, input.rate === undefined ? 1 : input.rate as number);
        return {
          status: "reading_started",
          reading: state.reading,
          networkUsed: false,
          nextStep: "The person can ask ChatGPT to call stop_tweaksy_reading at any time.",
        };
      },
    },
    {
      name: "stop_tweaksy_reading",
      description: "Stop Tweaksy's browser read-aloud immediately. This only cancels speech started by the page.",
      inputSchema: emptyInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: async (input) => {
        parseClosedInput(input, "stop_tweaksy_reading", []);
        return { status: "reading_stopped", assistive: assistive.stopReading() };
      },
    },
    {
      name: "start_tweaksy_focus_session",
      description: "Start a real 10, 25, or 45 minute focus session on Harborline. This creates a reversible one-story reading preview, hides the clearly marked demo ads, de-emphasizes decorative images, reduces nonessential page chrome and motion, strengthens focus, and starts a visible countdown. It replaces any current unsaved preview but never saves automatically. Call get_tweaksy_state first and pass its revision.",
      inputSchema: {
        type: "object",
        properties: {
          minutes: { type: "integer", enum: [10, 25, 45] },
          expectedRevision: expectedRevisionProperty,
        },
        required: ["minutes", "expectedRevision"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      execute: async (rawInput) => {
        const input = parseClosedInput(rawInput, "start_tweaksy_focus_session", ["minutes", "expectedRevision"]);
        if (input.minutes !== 10 && input.minutes !== 25 && input.minutes !== 45) throw new Error("minutes must be 10, 25, or 45.");
        const result = assistive.startFocus(input.minutes, input.expectedRevision as number, "webmcp");
        return {
          status: "focus_session_started",
          revision: result.adaptation.revision,
          preview: result.adaptation.preview,
          focus: result.assistive.focus,
          persisted: false,
          nextStep: "The person can navigate stories, approve the visual design separately, or end the timed session at any time.",
        };
      },
    },
    {
      name: "end_tweaksy_focus_session",
      description: "End the active focus countdown and restore nonessential Harborline page chrome. If the focus preview is still unsaved and unchanged, discard that preview and restore the last approved design. Call get_tweaksy_state first and pass its revision.",
      inputSchema: {
        type: "object",
        properties: { expectedRevision: expectedRevisionProperty },
        required: ["expectedRevision"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: async (rawInput) => {
        const input = parseClosedInput(rawInput, "end_tweaksy_focus_session", ["expectedRevision"]);
        const result = assistive.endFocus(input.expectedRevision as number);
        return { status: "focus_session_ended", revision: result.adaptation.revision, focus: result.assistive.focus };
      },
    },
    {
      name: "preview_tweaksy_adaptation",
      description: "Apply a reversible visual preview to the Harborline demo using only vetted design fields, including readable type, contrast, color-vision handling, focus settings, hiding clearly marked demo ads, and de-emphasizing decorative images. This changes the visible demo in memory and replaces any current preview, but never saves without approval. Call get_tweaksy_state first and pass its revision.",
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
          nextStep: "Let the person inspect the visible page in ChatGPT. They can ask you to approve or discard the preview through WebMCP.",
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
  assistive: AssistiveController,
): Promise<number> {
  if (typeof document.modelContext?.registerTool !== "function") return 0;
  const tools = createTweaksyWebMcpTools(controller, root, assistive);
  for (const tool of tools) await document.modelContext.registerTool(tool);
  return tools.length;
}
