import { afterEach, describe, expect, it, vi } from "vitest";
import { generateProposal } from "../src/provider";
import type { PageSnapshot, ProviderConfig } from "../src/types";

const config: ProviderConfig = {
  provider: "azure",
  model: "my-chat-deployment",
  apiKey: "azure-secret-key",
  endpoint: "https://my-resource.openai.azure.com",
};

const snapshot: PageSnapshot = {
  context: {
    tabId: 1,
    documentToken: "document",
    navigationToken: "navigation",
    url: "https://example.com/article?private=value",
    origin: "https://example.com",
    title: "Article",
  },
  headings: ["A heading"],
  landmarks: ["Main"],
  controls: ["Continue"],
  text: "A bounded excerpt",
};

afterEach(() => vi.unstubAllGlobals());

describe("Azure OpenAI requests", () => {
  it("uses the unified v1 endpoint, deployment model, and api-key header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ summary: "Larger text", patch: { fontScale: 1.25 } }) } }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const proposal = await generateProposal(config, "Why not?", snapshot, [
      { role: "user", content: "Make the headlines blue" },
      { role: "assistant", content: "That was not supported." },
    ], new AbortController().signal);

    expect(proposal.patch.fontScale).toBe(1.25);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://my-resource.openai.azure.com/openai/v1/chat/completions");
    expect(init.headers).toMatchObject({ "api-key": "azure-secret-key" });
    const body = JSON.parse(String(init.body)) as { model: string; messages: Array<{ role: string; content: string }>; temperature?: number };
    expect(body.model).toBe("my-chat-deployment");
    expect(body.temperature).toBeUndefined();
    expect(body.messages.map((message) => message.content)).not.toContain(expect.stringContaining("private=value"));
    expect(body.messages[1]).toEqual({ role: "user", content: "Make the headlines blue" });
    expect(body.messages[2]).toEqual({ role: "assistant", content: "That was not supported." });
    expect(body.messages.at(-1)?.content).toContain("Why not?");
  });

  it("does not drop explicitly requested side controls from a swipe-deck patch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ summary: "Swipe cards with controls beside them", patch: { articleLayout: "swipe-cards" } }) } }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const proposal = await generateProposal(config, "put the navigation buttons at the sides of the cards", snapshot, [], new AbortController().signal);

    expect(proposal.patch.articleLayout).toBe("swipe-cards");
    expect(proposal.patch.deckControls).toBe("sides");
  });

  it("keeps deck refinements executable when the provider returns only a delta", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ summary: "Refine the existing cards", patch: {} }) } }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const basePatch = {
      fontScale: null, lineHeight: null, letterSpacingEm: null, contentMaxWidthRem: null, headingColor: null,
      articleLayout: "swipe-cards" as const, deckControls: "unchanged" as const, deckImageSize: "unchanged" as const,
      deckLinkPosition: "unchanged" as const, colorVisionMode: "unchanged" as const, themePreset: "warm-hospitality" as const,
      colorScheme: "unchanged" as const, contrast: "unchanged" as const, reduceMotion: false, strongFocus: false, hideSelectors: [],
    };

    const proposal = await generateProposal(
      config,
      "make the images smaller and put the Open article button at the card footer",
      snapshot,
      [],
      new AbortController().signal,
      basePatch,
    );

    expect(proposal.patch.deckImageSize).toBe("compact");
    expect(proposal.patch.deckLinkPosition).toBe("footer");
  });
});
