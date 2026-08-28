import { describe, expect, it } from "vitest";
import { validatePatch, validateProposal, validateProviderConfig, validateSharedDesign } from "../src/validation";

describe("adaptation validation", () => {
  it("clamps numeric controls and normalizes enums", () => {
    const patch = validatePatch({
      fontScale: 99,
      lineHeight: -4,
      letterSpacingEm: 0.5,
      contentMaxWidthRem: 10,
      colorScheme: "sepia",
      contrast: "more",
      themePreset: "copied-brand-css",
    });
    expect(patch.fontScale).toBe(2);
    expect(patch.lineHeight).toBe(1.1);
    expect(patch.letterSpacingEm).toBe(0.12);
    expect(patch.contentMaxWidthRem).toBe(30);
    expect(patch.colorScheme).toBe("unchanged");
    expect(patch.contrast).toBe("more");
    expect(patch.themePreset).toBe("unchanged");
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

  it("accepts only known fields in an explicit reset request", () => {
    const proposal = validateProposal({
      summary: "Keep the layout but restore the original palette",
      patch: {},
      resetFields: ["themePreset", "colorScheme", "apiKey", "themePreset"],
    });
    expect(proposal.resetFields).toEqual(["themePreset", "colorScheme"]);
  });

  it("accepts the packaged sponsored-content filter without accepting arbitrary code", () => {
    expect(validatePatch({ hideSponsoredContent: true }).hideSponsoredContent).toBe(true);
    expect(validatePatch({ hideSponsoredContent: "document.querySelectorAll('*')" }).hideSponsoredContent).toBe(false);
  });

  it("accepts only a boolean for the packaged video-post filter", () => {
    expect(validatePatch({ hideVideoPosts: true }).hideVideoPosts).toBe(true);
    expect(validatePatch({ hideVideoPosts: "video" }).hideVideoPosts).toBe(false);
  });

  it("accepts bounded declarative feed terms and rejects code-like values", () => {
    expect(validatePatch({ feedFilterTerms: [" Sponsored ", "<script>", "x" ] }).feedFilterTerms).toEqual(["Sponsored"]);
  });

  it("accepts bounded declarative DOM automations without accepting scripts or sensitive selectors", () => {
    const patch = validatePatch({
      automationAssets: [{
        type: "dom-filter",
        name: "Hide attributed feed items",
        triggers: ["page-ready", "dom-mutation", "timer"],
        evidence: {
          text: [" Sponsored ", "<script>"],
          attributes: ["attributionsrc", "data-ad-marker", "href", "onclick"],
          descendantTags: ["video", "script"],
        },
        container: "nearest-feed-item",
        action: "hide",
        code: "document.body.remove()",
      }],
    });
    expect(patch.automationAssets).toEqual([{
      type: "dom-filter",
      name: "Hide attributed feed items",
      skills: [
        "semantic-attribute-evidence",
        "exact-text-evidence",
        "descendant-element-evidence",
        "nearest-semantic-container",
        "dynamic-content-trigger",
      ],
      triggers: ["page-ready", "dom-mutation"],
      evidence: { text: ["Sponsored"], attributes: ["attributionsrc", "data-ad-marker"], descendantTags: ["video"] },
      container: "nearest-feed-item",
      action: "hide",
    }]);
  });

  it("accepts the evidence-cluster relationship for repeated semantic markers", () => {
    const patch = validatePatch({
      automationAssets: [{
        type: "dom-filter",
        name: "Hide semantic ad cards",
        triggers: ["page-ready", "dom-mutation"],
        evidence: { text: [], attributes: ["data-ad-rendering-role"], descendantTags: [] },
        container: "evidence-cluster",
        action: "hide",
      }],
    });
    expect(patch.automationAssets[0]?.container).toBe("evidence-cluster");
  });

  it("accepts safe heading colors and rejects executable CSS-like values", () => {
    expect(validatePatch({ headingColor: "blue" }).headingColor).toBe("blue");
    expect(validatePatch({ headingColor: "#1d4ed8" }).headingColor).toBe("#1d4ed8");
    expect(validatePatch({ headingColor: "url(https://bad.test)" }).headingColor).toBeNull();
  });

  it("allows side-mounted controls only for the extension-owned swipe deck", () => {
    expect(validatePatch({ articleLayout: "swipe-cards", deckControls: "sides" }).deckControls).toBe("sides");
    expect(validatePatch({ articleLayout: "unchanged", deckControls: "sides" }).deckControls).toBe("sides");
    expect(validatePatch({ deckImageSize: "compact", deckLinkPosition: "footer" })).toMatchObject({ deckImageSize: "compact", deckLinkPosition: "footer" });
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

describe("OpenAI-compatible provider validation", () => {
  it("accepts fixed TokenRouter, OpenRouter, and Gemini providers", () => {
    expect(validateProviderConfig({
      provider: "tokenrouter",
      model: "moonshotai/kimi-k3-free",
      apiKey: "tokenrouter-key-value",
    })).toMatchObject({ provider: "tokenrouter", model: "moonshotai/kimi-k3-free" });
    expect(validateProviderConfig({
      provider: "openrouter",
      model: "moonshotai/kimi-k3",
      apiKey: "openrouter-key-value",
    })).toMatchObject({ provider: "openrouter", model: "moonshotai/kimi-k3" });
    expect(validateProviderConfig({
      provider: "gemini",
      model: "gemini-3.6-flash",
      apiKey: "gemini-key-value",
    })).toMatchObject({ provider: "gemini", model: "gemini-3.6-flash" });
  });
});

describe("shared design validation", () => {
  it("accepts a portable declarative design and sanitizes its patch", () => {
    const design = validateSharedDesign({
      format: "tweaksy-design",
      schemaVersion: 1,
      origin: "https://example.com",
      name: "Calm reading view",
      exportedAt: "2026-07-17T12:00:00.000Z",
      patch: { headingColor: "blue", hideSelectors: [".ad-slot", "input[value='secret']"] },
    });
    expect(design.origin).toBe("https://example.com");
    expect(design.format).toBe("tweaksy-design");
    expect(design.patch.headingColor).toBe("blue");
    expect(design.patch.hideSelectors).toEqual([".ad-slot"]);
  });

  it("imports legacy Match My Web designs and normalizes them to Tweaksy", () => {
    const design = validateSharedDesign({
      format: "match-my-web-design",
      schemaVersion: 1,
      origin: "https://example.com",
      name: "Legacy reading view",
      exportedAt: "2026-07-17T12:00:00.000Z",
      patch: { fontScale: 1.2 },
    });
    expect(design.format).toBe("tweaksy-design");
    expect(design.patch.fontScale).toBe(1.2);
  });

  it("rejects unsupported formats and non-origin targets", () => {
    expect(() => validateSharedDesign({ format: "other", schemaVersion: 1 })).toThrow(/supported/);
    expect(() => validateSharedDesign({
      format: "match-my-web-design",
      schemaVersion: 1,
      origin: "https://example.com/private/path",
      name: "Bad target",
      patch: {},
      exportedAt: new Date().toISOString(),
    })).toThrow(/exact/);
  });

  it("rejects shared designs that contain nothing to preview", () => {
    expect(() => validateSharedDesign({
      format: "match-my-web-design",
      schemaVersion: 1,
      origin: "https://example.com",
      name: "Empty design",
      patch: {},
      exportedAt: new Date().toISOString(),
    })).toThrow(/no visual changes/);
  });
});
