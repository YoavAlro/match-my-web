import { changesEffectiveDesign, mergeAdaptationPatches } from "../patch-merge";
import {
  DEFAULT_PATCH,
  hasAdaptationChanges,
  type AdaptationField,
  type AdaptationPatch,
} from "../types";
import { validatePatch } from "../validation";
import type { ApprovedDesignStorage } from "./storage";

export const SAFE_ADAPTATION_FIELDS = [
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
] as const satisfies readonly AdaptationField[];

export type SafeAdaptationField = typeof SAFE_ADAPTATION_FIELDS[number];
export type PreviewSource = "human" | "webmcp";

export interface AdaptationVerification {
  storyCount: number;
  storyLinkCount: number;
  renderedStoryCount: number;
  contentPreserved: boolean;
  linkTargetsValid: boolean;
  deckKeyboardNavigation: boolean;
}

export interface AdaptationRenderer {
  apply(patch: AdaptationPatch): void;
  verify(): AdaptationVerification;
}

export interface AdaptationPreview {
  id: string;
  summary: string;
  patch: AdaptationPatch;
  source: PreviewSource;
  createdAt: string;
}

export interface AdaptationActivity {
  kind: "previewed" | "approved" | "discarded" | "restored";
  summary: string;
  revision: number;
  at: string;
}

export interface AdaptationSnapshot {
  revision: number;
  persistence: ApprovedDesignStorage["persistence"];
  approvedPatch: AdaptationPatch;
  preview: AdaptationPreview | null;
  effectivePatch: AdaptationPatch;
  verification: AdaptationVerification;
  activity: AdaptationActivity[];
}

export interface PreviewAdaptationRequest {
  expectedRevision: number;
  summary: string;
  changes: unknown;
  resetFields?: unknown;
}

export class RevisionConflictError extends Error {
  constructor(expected: number, actual: number) {
    super(`The page changed after inspection. Expected revision ${expected}, but the current revision is ${actual}. Inspect state and retry.`);
    this.name = "RevisionConflictError";
  }
}

function clonePatch(patch: AdaptationPatch): AdaptationPatch {
  return { ...patch, hideSelectors: [...patch.hideSelectors] };
}

function webSafePatch(patch: AdaptationPatch): AdaptationPatch {
  const normalized = validatePatch(patch);
  const articleLayout = normalized.articleLayout;
  return {
    ...DEFAULT_PATCH,
    fontScale: normalized.fontScale,
    lineHeight: normalized.lineHeight,
    letterSpacingEm: normalized.letterSpacingEm,
    contentMaxWidthRem: normalized.contentMaxWidthRem,
    articleLayout,
    deckControls: articleLayout === "swipe-cards" ? normalized.deckControls : "unchanged",
    deckImageSize: articleLayout === "swipe-cards" ? normalized.deckImageSize : "unchanged",
    deckLinkPosition: articleLayout === "swipe-cards" ? normalized.deckLinkPosition : "unchanged",
    colorVisionMode: normalized.colorVisionMode,
    themePreset: normalized.themePreset,
    colorScheme: normalized.colorScheme,
    contrast: normalized.contrast,
    reduceMotion: normalized.reduceMotion,
    strongFocus: normalized.strongFocus,
    headingColor: null,
    hideSelectors: [],
  };
}

function clonePreview(preview: AdaptationPreview | null): AdaptationPreview | null {
  return preview ? { ...preview, patch: clonePatch(preview.patch) } : null;
}

function parseExpectedRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("expectedRevision must be a non-negative integer.");
  }
  return value;
}

function parseSummary(value: unknown): string {
  if (typeof value !== "string") throw new Error("summary must be a string.");
  const summary = value.trim();
  if (summary.length < 4 || summary.length > 240) {
    throw new Error("summary must contain between 4 and 240 characters.");
  }
  return summary;
}

function requireNumber(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${field} must be a number from ${min} to ${max}.`);
  }
  return value;
}

function requireEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`${field} must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
}

export function parseSafeAdaptationChanges(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("changes must be an object.");
  }

  const value = input as Record<string, unknown>;
  const allowedFields = new Set<string>(SAFE_ADAPTATION_FIELDS);
  const keys = Object.keys(value);
  const unknownField = keys.find((field) => !allowedFields.has(field));
  if (unknownField) throw new Error(`changes contains unsupported field: ${unknownField}.`);
  if (keys.length === 0) return {};

  const parsed: Record<string, unknown> = {};
  for (const [field, raw] of Object.entries(value)) {
    switch (field as SafeAdaptationField) {
      case "fontScale": parsed[field] = requireNumber(raw, field, 0.8, 2); break;
      case "lineHeight": parsed[field] = requireNumber(raw, field, 1.1, 2.5); break;
      case "letterSpacingEm": parsed[field] = requireNumber(raw, field, 0, 0.12); break;
      case "contentMaxWidthRem": parsed[field] = requireNumber(raw, field, 30, 100); break;
      case "articleLayout": parsed[field] = requireEnum(raw, field, ["unchanged", "swipe-cards"]); break;
      case "deckControls": parsed[field] = requireEnum(raw, field, ["unchanged", "sides"]); break;
      case "deckImageSize": parsed[field] = requireEnum(raw, field, ["unchanged", "compact"]); break;
      case "deckLinkPosition": parsed[field] = requireEnum(raw, field, ["unchanged", "footer"]); break;
      case "colorVisionMode": parsed[field] = requireEnum(raw, field, ["unchanged", "avoid-red"]); break;
      case "themePreset": parsed[field] = requireEnum(raw, field, ["unchanged", "warm-hospitality", "clean-minimal", "bold-dark", "paper-editorial"]); break;
      case "colorScheme": parsed[field] = requireEnum(raw, field, ["unchanged", "light", "dark"]); break;
      case "contrast": parsed[field] = requireEnum(raw, field, ["unchanged", "more"]); break;
      case "reduceMotion":
      case "strongFocus":
        if (typeof raw !== "boolean") throw new Error(`${field} must be a boolean.`);
        parsed[field] = raw;
        break;
    }
  }
  return parsed;
}

export function parseSafeResetFields(input: unknown): SafeAdaptationField[] {
  if (input === undefined) return [];
  if (!Array.isArray(input)) throw new Error("resetFields must be an array.");
  const allowedFields = new Set<string>(SAFE_ADAPTATION_FIELDS);
  const parsed: SafeAdaptationField[] = [];
  for (const field of input) {
    if (typeof field !== "string" || !allowedFields.has(field)) {
      throw new Error(`resetFields contains unsupported field: ${String(field)}.`);
    }
    if (!parsed.includes(field as SafeAdaptationField)) parsed.push(field as SafeAdaptationField);
  }
  return parsed;
}

export class AdaptationController {
  private revision = 0;
  private approvedPatch: AdaptationPatch;
  private preview: AdaptationPreview | null = null;
  private verification: AdaptationVerification;
  private readonly activity: AdaptationActivity[] = [];
  private readonly listeners = new Set<(snapshot: AdaptationSnapshot) => void>();

  constructor(
    private readonly renderer: AdaptationRenderer,
    private readonly storage: ApprovedDesignStorage,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = () => crypto.randomUUID(),
  ) {
    this.approvedPatch = webSafePatch(storage.load() ?? DEFAULT_PATCH);
    this.renderer.apply(this.approvedPatch);
    this.verification = this.renderer.verify();
  }

  getState(): AdaptationSnapshot {
    return {
      revision: this.revision,
      persistence: this.storage.persistence,
      approvedPatch: clonePatch(this.approvedPatch),
      preview: clonePreview(this.preview),
      effectivePatch: clonePatch(this.preview?.patch ?? this.approvedPatch),
      verification: { ...this.verification },
      activity: this.activity.map((item) => ({ ...item })),
    };
  }

  subscribe(listener: (snapshot: AdaptationSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  previewAdaptation(request: PreviewAdaptationRequest, source: PreviewSource): AdaptationSnapshot {
    const expectedRevision = parseExpectedRevision(request.expectedRevision);
    this.assertRevision(expectedRevision);
    const summary = parseSummary(request.summary);
    const changes = parseSafeAdaptationChanges(request.changes);
    const resetFields = parseSafeResetFields(request.resetFields);
    if (Object.keys(changes).length === 0 && resetFields.length === 0) {
      throw new Error("Preview at least one change or reset field.");
    }

    const basePatch = this.approvedPatch;
    const delta = webSafePatch(validatePatch(changes));
    const effectivePatch = webSafePatch(mergeAdaptationPatches(basePatch, delta, resetFields));
    if (!changesEffectiveDesign(basePatch, effectivePatch)) {
      throw new Error("The requested preview would not change the current design.");
    }

    this.preview = {
      id: this.createId(),
      summary,
      patch: effectivePatch,
      source,
      createdAt: this.now().toISOString(),
    };
    this.commitMutation("previewed", summary, effectivePatch);
    return this.getState();
  }

  approvePreview(previewId: unknown, expectedRevision: unknown): AdaptationSnapshot {
    this.assertRevision(parseExpectedRevision(expectedRevision));
    if (typeof previewId !== "string" || !previewId.trim() || previewId.length > 100) {
      throw new Error("previewId must contain between 1 and 100 characters.");
    }
    if (!this.preview) throw new Error("There is no preview to approve.");
    if (this.preview.id !== previewId) throw new Error("That preview is no longer current. Inspect state and retry.");

    const summary = this.preview.summary;
    const nextApprovedPatch = clonePatch(this.preview.patch);
    this.storage.save(nextApprovedPatch);
    this.approvedPatch = nextApprovedPatch;
    this.preview = null;
    this.commitMutation("approved", summary, this.approvedPatch);
    return this.getState();
  }

  discardPreview(expectedRevision: unknown): AdaptationSnapshot {
    this.assertRevision(parseExpectedRevision(expectedRevision));
    if (!this.preview) throw new Error("There is no preview to discard.");
    const summary = this.preview.summary;
    this.preview = null;
    this.commitMutation("discarded", summary, this.approvedPatch);
    return this.getState();
  }

  restoreOriginal(expectedRevision: unknown): AdaptationSnapshot {
    this.assertRevision(parseExpectedRevision(expectedRevision));
    if (!this.preview && !hasAdaptationChanges(this.approvedPatch)) {
      throw new Error("The original design is already active.");
    }
    this.storage.clear();
    this.preview = null;
    this.approvedPatch = clonePatch(DEFAULT_PATCH);
    this.commitMutation("restored", "Restored the original Harborline design", this.approvedPatch);
    return this.getState();
  }

  private assertRevision(expectedRevision: number): void {
    if (expectedRevision !== this.revision) throw new RevisionConflictError(expectedRevision, this.revision);
  }

  private commitMutation(kind: AdaptationActivity["kind"], summary: string, patch: AdaptationPatch): void {
    this.revision += 1;
    this.renderer.apply(patch);
    this.verification = this.renderer.verify();
    this.activity.unshift({ kind, summary, revision: this.revision, at: this.now().toISOString() });
    this.activity.splice(8);
    this.notify();
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) listener(snapshot);
  }
}
