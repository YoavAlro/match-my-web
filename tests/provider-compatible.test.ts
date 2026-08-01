import { afterEach, describe, expect, it, vi } from "vitest";
import { generateProposal } from "../src/provider";
import type { PageSnapshot, ProviderConfig } from "../src/types";

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
  feedPatterns: [{ text: "Sponsored", source: "rendered-text", occurrences: 1 }],
};

afterEach(() => vi.unstubAllGlobals());

describe.each([
  ["tokenrouter", "moonshotai/kimi-k3-free", "https://api.tokenrouter.com/v1/chat/completions"],
  ["openrouter", "moonshotai/kimi-k3", "https://openrouter.ai/api/v1/chat/completions"],
  ["gemini", "gemini-3.6-flash", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"],
] as const)("%s requests", (provider, model, expectedUrl) => {
  it("uses the fixed OpenAI-compatible endpoint and bearer token", async () => {
    const config: ProviderConfig = { provider, model, apiKey: "compatible-secret-key" };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ summary: "Larger text", patch: { fontScale: 1.25, feedFilterTerms: ["Sponsored", "Invented"] } }) } }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const proposal = await generateProposal(config, "Make this easier to read", snapshot, [], new AbortController().signal);

    expect(proposal.patch.fontScale).toBe(1.25);
    expect(proposal.patch.feedFilterTerms).toEqual(["Sponsored"]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(expectedUrl);
    expect(init.headers).toMatchObject({ authorization: "Bearer compatible-secret-key" });
    const body = JSON.parse(String(init.body)) as { model: string; messages: Array<{ content: string }> };
    expect(body.model).toBe(model);
    expect(body.messages.at(-1)?.content).not.toContain("private=value");
    expect(body.messages.at(-1)?.content).toContain("Sponsored");
  });
});
