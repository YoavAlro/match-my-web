import { describe, expect, it } from "vitest";
import { validatePatch, validateProposal, validateProviderConfig } from "../src/validation";

describe("adaptation validation", () => {
  it("clamps numeric controls and normalizes enums", () => {
    const patch = validatePatch({
      fontScale: 99,
      lineHeight: -4,
      letterSpacingEm: 0.5,
      contentMaxWidthRem: 10,
      colorScheme: "sepia",
      contrast: "more",
    });
    expect(patch.fontScale).toBe(2);
    expect(patch.lineHeight).toBe(1.1);
    expect(patch.letterSpacingEm).toBe(0.12);
    expect(patch.contentMaxWidthRem).toBe(30);
    expect(patch.colorScheme).toBe("unchanged");
    expect(patch.contrast).toBe("more");
  });

  it("drops selectors that could exfiltrate or overreach", () => {
    const patch = validatePatch({
      hideSelectors: [
        ".newsletter-banner",
        "aside.promoted",
        "input[value='secret']",
        "img[src^='https']",
        "body:has(.account)",
        "main .promo",
        "button.dismiss",
        "[role='navigation']",
        "x { background: url(https://bad.test) }",
      ],
    });
    expect(patch.hideSelectors).toEqual([".newsletter-banner", "aside.promoted"]);
  });

  it("accepts JSON-shaped proposals only", () => {
    expect(() => validateProposal(null)).toThrow();
    expect(validateProposal({ summary: "Larger copy", patch: { fontScale: 1.25 } }).summary).toBe("Larger copy");
  });
});

describe("Azure provider validation", () => {
  it("normalizes an official Azure resource endpoint to its origin", () => {
    const config = validateProviderConfig({
      provider: "azure",
      model: "my-chat-deployment",
      apiKey: "azure-key-value",
      endpoint: "https://my-resource.openai.azure.com/openai/v1/",
      transcriptionModel: "my-transcription-deployment",
    });
    expect(config.endpoint).toBe("https://my-resource.openai.azure.com");
    expect(config.transcriptionModel).toBe("my-transcription-deployment");
  });

  it("refuses endpoints that could receive an Azure key outside Microsoft", () => {
    expect(() => validateProviderConfig({
      provider: "azure",
      model: "deployment",
      apiKey: "azure-key-value",
      endpoint: "https://azure.example.test",
    })).toThrow(/Microsoft Azure/);
  });
});
