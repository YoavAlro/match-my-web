import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PATCH, type AdaptationPatch } from "../../src/types";
import {
  AdaptationController,
  type AdaptationRenderer,
  type AdaptationVerification,
} from "../../src/web/adaptation-controller";
import { MemoryApprovedDesignStorage } from "../../src/web/storage";
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

afterEach(() => {
  Reflect.deleteProperty(globalThis, "document");
});

describe("Tweaksy WebMCP tools", () => {
  it("defines five focused tools and strict schemas", () => {
    const tools = createTweaksyWebMcpTools(makeController(), {} as HTMLElement);
    expect(tools.map((tool) => tool.name)).toEqual([
      "inspect_tweaksy_surface",
      "get_tweaksy_state",
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
    const tools = createTweaksyWebMcpTools(controller, {} as HTMLElement);
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

    const count = await registerTweaksyWebMcpTools(makeController(), {} as HTMLElement);
    expect(count).toBe(5);
    expect(registerTool).toHaveBeenCalledTimes(5);
    expect(registeredTools.map((tool) => tool.name)).toContain("preview_tweaksy_adaptation");
  });

  it("keeps the human interface usable when WebMCP is unavailable", async () => {
    Object.defineProperty(globalThis, "document", { configurable: true, value: {} });
    await expect(registerTweaksyWebMcpTools(makeController(), {} as HTMLElement)).resolves.toBe(0);
  });

  it("rejects malformed direct calls even when a host skips schema validation", async () => {
    const tools = createTweaksyWebMcpTools(makeController(), {} as HTMLElement);
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
});
