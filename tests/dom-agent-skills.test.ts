import { describe, expect, it } from "vitest";
import { deriveDomAutomationSkills, DOM_AGENT_SKILLS_PROMPT, DOM_AUTOMATION_SKILLS } from "../src/dom-agent-skills";

describe("portable DOM agent skills", () => {
  it("contains no website recipe or captured selector", () => {
    expect(DOM_AGENT_SKILLS_PROMPT).not.toMatch(/facebook|twitter|x\.com|instagram|linkedin|data-ad-rendering-role|\.x[a-z0-9]{5,}/i);
    expect(DOM_AGENT_SKILLS_PROMPT).toContain("current-page evidence");
    expect(new Set(DOM_AUTOMATION_SKILLS.map((skill) => skill.id)).size).toBe(DOM_AUTOMATION_SKILLS.length);
  });

  it("derives an auditable skill chain from the validated asset rather than provider claims", () => {
    expect(deriveDomAutomationSkills({
      evidence: { text: [], attributes: ["data-example-kind"], descendantTags: [] },
      container: "evidence-cluster",
      triggers: ["page-ready", "dom-mutation"],
    })).toEqual([
      "semantic-attribute-evidence",
      "evidence-cluster-container",
      "dynamic-content-trigger",
    ]);
  });

  it("covers every supported container relationship", () => {
    const purposes = DOM_AUTOMATION_SKILLS.map((skill) => skill.id);
    expect(purposes).toEqual(expect.arrayContaining([
      "nearest-semantic-container",
      "evidence-cluster-container",
      "repeating-ancestor-container",
    ]));
  });
});
