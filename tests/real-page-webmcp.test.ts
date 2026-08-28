import { describe, expect, it, vi } from "vitest";
import {
  createRealPageWebMcpTools,
  parseExpectedRevision,
  parseRealPagePreviewInput,
  parseRealPageWebMcpRequest,
  REAL_PAGE_WEBMCP_TOOL_NAMES,
  realPagePreviewInputSchema,
} from "../src/real-page-webmcp";

describe("real-page WebMCP bridge", () => {
  it("exposes four bounded tools without a persistence capability", () => {
    const tools = createRealPageWebMcpTools(async () => ({}));
    expect(tools.map((tool) => tool.name)).toEqual([...REAL_PAGE_WEBMCP_TOOL_NAMES]);
    expect(tools.map((tool) => tool.name)).not.toContain("approve_tweaksy_preview");
    const schema = JSON.stringify(realPagePreviewInputSchema).toLowerCase();
    for (const unsafeField of ["hideselectors", "css", "html", "javascript", "url", "selector"]) {
      expect(schema).not.toContain(`\"${unsafeField}\"`);
    }
  });

  it("passes validated tool calls through the isolated-world bridge", async () => {
    const execute = vi.fn(async (tool: string, input: Record<string, unknown>) => ({ tool, input }));
    const tools = createRealPageWebMcpTools(execute);
    const preview = tools.find((tool) => tool.name === "preview_tweaksy_adaptation")!;
    await expect(preview.execute({
      expectedRevision: 2,
      summary: "Make the real page calmer",
      changes: { reduceMotion: true, fontScale: 1.2 },
    })).resolves.toMatchObject({ tool: "preview_tweaksy_adaptation" });
    expect(execute).toHaveBeenCalledWith("preview_tweaksy_adaptation", {
      expectedRevision: 2,
      summary: "Make the real page calmer",
      changes: { reduceMotion: true, fontScale: 1.2 },
    });
  });

  it("strictly validates direct page-event requests and preview values", () => {
    const request = parseRealPageWebMcpRequest({
      requestId: "12345678-abcd",
      tool: "preview_tweaksy_adaptation",
      input: {
        expectedRevision: 0,
        summary: "Use a readable dark layout",
        changes: { colorScheme: "dark", lineHeight: 1.7 },
        resetFields: ["fontScale"],
      },
    });
    expect(parseRealPagePreviewInput(request.input)).toMatchObject({
      expectedRevision: 0,
      changes: { colorScheme: "dark", lineHeight: 1.7 },
      resetFields: ["fontScale"],
    });
    expect(() => parseRealPagePreviewInput({
      expectedRevision: 0,
      summary: "Inject a selector",
      changes: { hideSelectors: [".paywall"] },
    })).toThrow(/unsupported field/i);
    expect(() => parseRealPagePreviewInput({
      expectedRevision: 0,
      summary: "Oversized text",
      changes: { fontScale: 99 },
    })).toThrow(/between 0.8 and 2/i);
    expect(() => parseRealPagePreviewInput({
      expectedRevision: 0,
      summary: "Missing changes",
    })).toThrow(/changes is required/i);
  });

  it("requires optimistic revisions for every mutating tool", () => {
    expect(parseExpectedRevision({ expectedRevision: 4 }, "discard_tweaksy_preview")).toBe(4);
    expect(() => parseExpectedRevision({ expectedRevision: -1 }, "discard_tweaksy_preview")).toThrow(/non-negative integer/i);
    expect(() => parseRealPageWebMcpRequest({
      requestId: "12345678-abcd",
      tool: "discard_tweaksy_preview",
      input: { expectedRevision: 1, css: "body{}" },
    })).toThrow(/unsupported field: css/i);
  });
});
