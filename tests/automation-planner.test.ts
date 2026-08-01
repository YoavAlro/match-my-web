import { describe, expect, it } from "vitest";
import { augmentWithObservedDomSkill } from "../src/automation-planner";
import { DEFAULT_PATCH, type PageSnapshot, type Proposal } from "../src/types";

const snapshot: PageSnapshot = {
  context: {
    tabId: 1,
    documentToken: "document",
    navigationToken: "navigation",
    url: "https://example.test/feed",
    origin: "https://example.test",
    title: "Feed",
  },
  headings: [],
  landmarks: [],
  controls: [],
  text: "",
  domSignals: [
    { kind: "attribute-presence", name: "data-content-kind", occurrences: 40, relevance: "structural" },
    { kind: "attribute-presence", name: "data-promoted-rendering", occurrences: 8, relevance: "request-match" },
  ],
};

const noOp: Proposal = { summary: "Filter unwanted feed content", patch: DEFAULT_PATCH };

describe("generic observed-DOM skill planning", () => {
  it("turns a new semantic signal into an incremental clustered automation", () => {
    const proposal = augmentWithObservedDomSkill(noOp, "remove promoted posts from the feed", snapshot, DEFAULT_PATCH);
    expect(proposal.patch.automationAssets[0]).toMatchObject({
      evidence: { attributes: ["data-promoted-rendering"] },
      container: "evidence-cluster",
      skills: ["semantic-attribute-evidence", "evidence-cluster-container", "dynamic-content-trigger"],
    });
  });

  it("does not repeat evidence already present in the active design", () => {
    const first = augmentWithObservedDomSkill(noOp, "remove promoted posts", snapshot, DEFAULT_PATCH);
    const base = { ...DEFAULT_PATCH, automationAssets: first.patch.automationAssets };
    expect(augmentWithObservedDomSkill(noOp, "remove promoted posts", snapshot, base).patch.automationAssets).toEqual([]);
  });

  it("does not convert unrelated layout requests into content filters", () => {
    expect(augmentWithObservedDomSkill(noOp, "make the page wider", snapshot, DEFAULT_PATCH)).toBe(noOp);
  });
});
