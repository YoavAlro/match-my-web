import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PATCH, type AdaptationPatch } from "../../src/types";
import {
  AdaptationController,
  type AdaptationRenderer,
  type AdaptationVerification,
} from "../../src/web/adaptation-controller";
import { MemoryApprovedDesignStorage } from "../../src/web/storage";
import { AssistiveController, type SpeechDriver } from "../../src/web/assistive-controller";
import {
  createTweaksyWebMcpTools,
  previewAdaptationInputSchema,
  registerTweaksyWebMcpTools,
} from "../../src/web/webmcp";

class FakeRenderer implements AdaptationRenderer {
  private patch: AdaptationPatch = DEFAULT_PATCH;

  apply(patch: AdaptationPatch): void {
    this.patch = patch;
  }

  verify(): AdaptationVerification {
    return {
      storyCount: 6,
      storyLinkCount: 6,
      renderedStoryCount: this.patch.articleLayout === "swipe-cards" ? 1 : 6,
      contentPreserved: true,
      linkTargetsValid: true,
      deckKeyboardNavigation: this.patch.articleLayout === "swipe-cards",
    };
  }
}

function makeController(): AdaptationController {
  return new AdaptationController(
    new FakeRenderer(),
    new MemoryApprovedDesignStorage(),
    () => new Date("2026-08-28T12:00:00.000Z"),
    () => "webmcp-preview",
  );
}

const silentSpeech: SpeechDriver = {
  available: () => true,
  speak: (_text, _rate, _onEnd, _onError) => undefined,
  stop: () => undefined,
};

function makeRoot(): HTMLElement {
  return {
    dataset: {},
    querySelector: () => null,
    querySelectorAll: () => [],
  } as unknown as HTMLElement;
}

function makeAssistive(controller: AdaptationController, root = makeRoot()): AssistiveController {
  return new AssistiveController(controller, root, silentSpeech, () => 0);
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "document");
});

describe("Tweaksy WebMCP tools", () => {
  it("defines ten focused tools and strict schemas", () => {
    const controller = makeController();
    const root = makeRoot();
    const tools = createTweaksyWebMcpTools(controller, root, makeAssistive(controller, root));
    expect(tools.map((tool) => tool.name)).toEqual([
      "inspect_tweaksy_surface",
      "get_tweaksy_state",
      "preview_tweaksy_accessibility_mode",
      "read_tweaksy_content",
      "stop_tweaksy_reading",
      "start_tweaksy_focus_session",
      "end_tweaksy_focus_session",
      "preview_tweaksy_adaptation",
      "discard_tweaksy_preview",
      "approve_tweaksy_preview",
    ]);
    expect(previewAdaptationInputSchema.additionalProperties).toBe(false);
    expect(previewAdaptationInputSchema.properties.changes.additionalProperties).toBe(false);
    const serializedSchema = JSON.stringify(previewAdaptationInputSchema);
    for (const unsafeField of ["hideSelectors", "css", "html", "javascript", "url", "selector"]) {
      expect(serializedSchema.toLowerCase()).not.toContain(`\"${unsafeField.toLowerCase()}\"`);
    }
  });

  it("runs preview, state, approval, and discard through the shared controller", async () => {
    const controller = makeController();
    const root = makeRoot();
    const tools = createTweaksyWebMcpTools(controller, root, makeAssistive(controller, root));
    const previewTool = tools.find((tool) => tool.name === "preview_tweaksy_adaptation");
    const stateTool = tools.find((tool) => tool.name === "get_tweaksy_state");
    const approveTool = tools.find((tool) => tool.name === "approve_tweaksy_preview");
    const discardTool = tools.find((tool) => tool.name === "discard_tweaksy_preview");
    expect(previewTool && stateTool && approveTool && discardTool).toBeTruthy();

    const previewResult = await previewTool?.execute({
      expectedRevision: 0,
      summary: "Make this easier to read",
      changes: { fontScale: 1.25, articleLayout: "swipe-cards", deckControls: "sides" },
    }) as Record<string, unknown>;
    expect(previewResult).toMatchObject({ status: "preview_ready", revision: 1, persisted: false });

    const stateResult = await stateTool?.execute() as Record<string, unknown>;
    expect(stateResult).toMatchObject({ revision: 1, mode: "preview", persisted: false });
    const preview = stateResult.preview as { id: string };

    const approved = await approveTool?.execute({ previewId: preview.id, expectedRevision: 1 }) as Record<string, unknown>;
    expect(approved).toMatchObject({ status: "preview_approved", revision: 2, persisted: false });

    await previewTool?.execute({
      expectedRevision: 2,
      summary: "Try reduced motion",
      changes: { reduceMotion: true },
    });
    const discarded = await discardTool?.execute({ expectedRevision: 3 }) as Record<string, unknown>;
    expect(discarded).toMatchObject({ status: "preview_discarded", revision: 4, persistedDesignUnchanged: true });
  });

  it("feature-detects support and registers each tool on the top-level document", async () => {
    const registeredTools: WebMcpToolDefinition[] = [];
    const registerTool = vi.fn(async (tool: WebMcpToolDefinition) => {
      registeredTools.push(tool);
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { modelContext: { registerTool } },
    });

    const controller = makeController();
    const root = makeRoot();
    const count = await registerTweaksyWebMcpTools(controller, root, makeAssistive(controller, root));
    expect(count).toBe(10);
    expect(registerTool).toHaveBeenCalledTimes(10);
    expect(registeredTools.map((tool) => tool.name)).toContain("preview_tweaksy_adaptation");
  });

  it("keeps the human interface usable when WebMCP is unavailable", async () => {
    Object.defineProperty(globalThis, "document", { configurable: true, value: {} });
    const controller = makeController();
    const root = makeRoot();
    await expect(registerTweaksyWebMcpTools(controller, root, makeAssistive(controller, root))).resolves.toBe(0);
  });

  it("rejects malformed direct calls even when a host skips schema validation", async () => {
    const controller = makeController();
    const root = makeRoot();
    const tools = createTweaksyWebMcpTools(controller, root, makeAssistive(controller, root));
    const previewTool = tools.find((tool) => tool.name === "preview_tweaksy_adaptation");
    const approveTool = tools.find((tool) => tool.name === "approve_tweaksy_preview");
    const stateTool = tools.find((tool) => tool.name === "get_tweaksy_state");

    await expect(stateTool?.execute({ unexpected: true })).rejects.toThrow(/unsupported field/i);
    await expect(previewTool?.execute(null)).rejects.toThrow(/must be an object/i);
    await expect(previewTool?.execute({
      expectedRevision: 0,
      summary: "Try safe focus",
      changes: { strongFocus: true },
      topLevelCss: "body{}",
    })).rejects.toThrow(/unsupported field: topLevelCss/i);
    await expect(approveTool?.execute({
      expectedRevision: 0,
      previewId: "x".repeat(101),
    })).rejects.toThrow(/between 1 and 100/i);
  });

  it("runs semantic accessibility, read-aloud, and focus actions through shared controllers", async () => {
    const controller = makeController();
    const root = makeRoot();
    const assistive = makeAssistive(controller, root);
    const tools = createTweaksyWebMcpTools(controller, root, assistive);
    const accessibility = tools.find((tool) => tool.name === "preview_tweaksy_accessibility_mode");
    const read = tools.find((tool) => tool.name === "read_tweaksy_content");
    const focus = tools.find((tool) => tool.name === "start_tweaksy_focus_session");
    const endFocus = tools.find((tool) => tool.name === "end_tweaksy_focus_session");

    await expect(accessibility?.execute({ mode: "color-safe", expectedRevision: 0 })).resolves.toMatchObject({
      status: "accessibility_preview_ready",
      revision: 1,
    });
    controller.discardPreview(1);
    await expect(read?.execute({ scope: "page-summary", rate: 1 })).resolves.toMatchObject({ status: "reading_started" });
    await expect(focus?.execute({ minutes: 25, expectedRevision: 2 })).resolves.toMatchObject({
      status: "focus_session_started",
      revision: 3,
    });
    expect(root.dataset.focusSession).toBe("true");
    await expect(endFocus?.execute({ expectedRevision: 3 })).resolves.toMatchObject({ status: "focus_session_ended", revision: 4 });
    expect(root.dataset.focusSession).toBeUndefined();
  });
});
