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

    const proposal = await generateProposal(config, "Make this easier to read", snapshot, new AbortController().signal);

    expect(proposal.patch.fontScale).toBe(1.25);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://my-resource.openai.azure.com/openai/v1/chat/completions");
    expect(init.headers).toMatchObject({ "api-key": "azure-secret-key" });
    const body = JSON.parse(String(init.body)) as { model: string; messages: Array<{ content: string }>; temperature?: number };
    expect(body.model).toBe("my-chat-deployment");
    expect(body.temperature).toBeUndefined();
    expect(body.messages[1]?.content).not.toContain("private=value");
  });
});
