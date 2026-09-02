import { describe, expect, it } from "vitest";
import { DEFAULT_PATCH, type AdaptationPatch } from "../../src/types";
import {
  AdaptationController,
  RevisionConflictError,
  type AdaptationRenderer,
  type AdaptationVerification,
} from "../../src/web/adaptation-controller";
import {
  MemoryApprovedDesignStorage,
  createApprovedDesignStorage,
  type ApprovedDesignStorage,
} from "../../src/web/storage";

class FakeRenderer implements AdaptationRenderer {
  readonly applied: AdaptationPatch[] = [];

  apply(patch: AdaptationPatch): void {
    this.applied.push({ ...patch, hideSelectors: [...patch.hideSelectors] });
  }

  verify(): AdaptationVerification {
    const latest = this.applied.at(-1) ?? DEFAULT_PATCH;
    return {
      storyCount: 6,
      storyLinkCount: 6,
      renderedStoryCount: latest.articleLayout === "swipe-cards" ? 1 : 6,
      contentPreserved: true,
      linkTargetsValid: true,
      deckKeyboardNavigation: latest.articleLayout === "swipe-cards",
    };
  }
}

function makeController(storage = new MemoryApprovedDesignStorage()): {
  controller: AdaptationController;
  renderer: FakeRenderer;
  storage: MemoryApprovedDesignStorage;
} {
  const renderer = new FakeRenderer();
  const controller = new AdaptationController(
    renderer,
    storage,
    () => new Date("2026-08-28T12:00:00.000Z"),
    () => "preview-fixed",
  );
  return { controller, renderer, storage };
}

describe("AdaptationController", () => {
  it("creates an unsaved preview and verifies the preserved story surface", () => {
    const { controller, storage } = makeController();
    const snapshot = controller.previewAdaptation({
      expectedRevision: 0,
      summary: "Create a calmer reading deck",
      changes: {
        fontScale: 1.2,
        articleLayout: "swipe-cards",
        deckControls: "sides",
        reduceMotion: true,
      },
    }, "webmcp");

    expect(snapshot.revision).toBe(1);
    expect(snapshot.preview).toMatchObject({
      id: "preview-fixed",
      source: "webmcp",
      summary: "Create a calmer reading deck",
    });
    expect(snapshot.effectivePatch).toMatchObject({
      fontScale: 1.2,
      articleLayout: "swipe-cards",
      deckControls: "sides",
      reduceMotion: true,
      hideSelectors: [],
    });
    expect(snapshot.verification).toMatchObject({
      storyCount: 6,
      storyLinkCount: 6,
      renderedStoryCount: 1,
      contentPreserved: true,
    });
    expect(storage.load()).toBeNull();
  });

  it("preserves safe ad-hiding and image-deemphasis changes in a preview", () => {
    const { controller, renderer } = makeController();
    const snapshot = controller.previewAdaptation({
      expectedRevision: 0,
      summary: "Reduce visual noise for focused reading",
      changes: {
        hideDemoAds: true,
        deemphasizeImages: true,
        strongFocus: true,
      },
    }, "webmcp");

    expect(snapshot.effectivePatch).toMatchObject({
      hideDemoAds: true,
      deemphasizeImages: true,
      strongFocus: true,
    });
    expect(renderer.applied.at(-1)).toMatchObject({
      hideDemoAds: true,
      deemphasizeImages: true,
    });
  });

  it("approves only the exact current preview and persists the safe design", () => {
    const { controller, storage } = makeController();
    const preview = controller.previewAdaptation({
      expectedRevision: 0,
      summary: "Increase the reading size",
      changes: { fontScale: 1.3, strongFocus: true },
    }, "human");

    expect(() => controller.approvePreview("old-preview", 1)).toThrow(/no longer current/i);
    const approved = controller.approvePreview(preview.preview?.id, 1);

    expect(approved.revision).toBe(2);
    expect(approved.preview).toBeNull();
    expect(approved.approvedPatch).toMatchObject({ fontScale: 1.3, strongFocus: true, hideSelectors: [] });
    expect(storage.load()).toMatchObject({ fontScale: 1.3, strongFocus: true, hideSelectors: [] });
  });

  it("discards a preview and restores the approved design", () => {
    const storage = new MemoryApprovedDesignStorage();
    storage.save({ ...DEFAULT_PATCH, themePreset: "clean-minimal" });
    const { controller, renderer } = makeController(storage);
    controller.previewAdaptation({
      expectedRevision: 0,
      summary: "Try a dark option",
      changes: { themePreset: "bold-dark", colorScheme: "dark" },
    }, "webmcp");

    const discarded = controller.discardPreview(1);
    expect(discarded.preview).toBeNull();
    expect(discarded.effectivePatch.themePreset).toBe("clean-minimal");
    expect(renderer.applied.at(-1)?.themePreset).toBe("clean-minimal");
  });

  it("rejects stale revisions and unsupported or unsafe fields", () => {
    const { controller } = makeController();
    controller.previewAdaptation({
      expectedRevision: 0,
      summary: "Add stronger focus",
      changes: { strongFocus: true },
    }, "webmcp");

    expect(() => controller.previewAdaptation({
      expectedRevision: 0,
      summary: "Try another change",
      changes: { reduceMotion: true },
    }, "webmcp")).toThrow(RevisionConflictError);

    expect(() => makeController().controller.previewAdaptation({
      expectedRevision: 0,
      summary: "Inject unsafe styling",
      changes: { css: "body { display: none }" },
    }, "webmcp")).toThrow(/unsupported field: css/i);

    expect(() => makeController().controller.previewAdaptation({
      expectedRevision: 0,
      summary: "Hide arbitrary content",
      changes: { hideSelectors: [".story-card"] },
    }, "webmcp")).toThrow(/unsupported field: hideSelectors/i);
  });

  it("requires a real design change and can restore the original", () => {
    const { controller, storage } = makeController();
    expect(() => controller.previewAdaptation({
      expectedRevision: 0,
      summary: "Keep the same design",
      changes: { articleLayout: "unchanged" },
    }, "webmcp")).toThrow(/would not change/i);

    const preview = controller.previewAdaptation({
      expectedRevision: 0,
      summary: "Use a paper theme",
      changes: { themePreset: "paper-editorial" },
    }, "human");
    controller.approvePreview(preview.preview?.id, 1);
    const restored = controller.restoreOriginal(2);

    expect(restored.revision).toBe(3);
    expect(restored.effectivePatch).toEqual(DEFAULT_PATCH);
    expect(storage.load()).toBeNull();
  });

  it("keeps the visible preview and state unchanged when persistence fails", () => {
    const throwingStorage: ApprovedDesignStorage = {
      persistence: "local",
      load: () => null,
      save: () => { throw new Error("Storage unavailable"); },
      clear: () => undefined,
    };
    const renderer = new FakeRenderer();
    const controller = new AdaptationController(
      renderer,
      throwingStorage,
      () => new Date("2026-08-28T12:00:00.000Z"),
      () => "preview-fixed",
    );
    controller.previewAdaptation({
      expectedRevision: 0,
      summary: "Use larger reading type",
      changes: { fontScale: 1.25 },
    }, "human");

    expect(() => controller.approvePreview("preview-fixed", 1)).toThrow(/storage unavailable/i);
    const state = controller.getState();
    expect(state.revision).toBe(1);
    expect(state.preview?.id).toBe("preview-fixed");
    expect(state.approvedPatch).toEqual(DEFAULT_PATCH);
    expect(renderer.applied.at(-1)?.fontScale).toBe(1.25);
  });

  it("keeps approved state unchanged when clearing persistence fails", () => {
    const approvedPatch = { ...DEFAULT_PATCH, fontScale: 1.2 };
    const throwingStorage: ApprovedDesignStorage = {
      persistence: "local",
      load: () => approvedPatch,
      save: () => undefined,
      clear: () => { throw new Error("Clear denied"); },
    };
    const renderer = new FakeRenderer();
    const controller = new AdaptationController(renderer, throwingStorage);

    expect(() => controller.restoreOriginal(0)).toThrow(/clear denied/i);
    const state = controller.getState();
    expect(state.revision).toBe(0);
    expect(state.preview).toBeNull();
    expect(state.approvedPatch.fontScale).toBe(1.2);
    expect(renderer.applied.at(-1)?.fontScale).toBe(1.2);
  });

  it("falls back to session memory when local storage is blocked", () => {
    const blockedWindow = {} as Pick<Window, "localStorage">;
    Object.defineProperty(blockedWindow, "localStorage", {
      get: () => { throw new Error("Denied"); },
    });
    expect(createApprovedDesignStorage(blockedWindow).persistence).toBe("memory");
  });

  it("canonicalizes stored designs to the safe web domain", () => {
    const storage = new MemoryApprovedDesignStorage();
    storage.save({
      ...DEFAULT_PATCH,
      headingColor: "#fff",
      deckControls: "sides",
      hideSelectors: [".story-card"],
    });
    const { controller } = makeController(storage);
    expect(controller.getState().approvedPatch).toMatchObject({
      headingColor: null,
      articleLayout: "unchanged",
      deckControls: "unchanged",
      hideSelectors: [],
    });
  });

  it("replaces an existing preview instead of silently accumulating it", () => {
    const { controller } = makeController();
    controller.previewAdaptation({
      expectedRevision: 0,
      summary: "Try stronger focus",
      changes: { strongFocus: true },
    }, "webmcp");
    const replaced = controller.previewAdaptation({
      expectedRevision: 1,
      summary: "Try reduced motion instead",
      changes: { reduceMotion: true },
    }, "webmcp");
    expect(replaced.effectivePatch).toMatchObject({ strongFocus: false, reduceMotion: true });
  });
});
