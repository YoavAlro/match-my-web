import type { AutomationContainerStrategy, AutomationTrigger, DomAutomationSkillId } from "./types";

export interface DomAutomationSkillDefinition {
  id: DomAutomationSkillId;
  purpose: string;
  guardrail: string;
}

export const DOM_AUTOMATION_SKILLS: readonly DomAutomationSkillDefinition[] = [
  {
    id: "semantic-attribute-evidence",
    purpose: "Prefer observed attribute names whose semantics match the user’s unwanted-content concept.",
    guardrail: "Use attribute names only when they appear in domSignals; never invent names or depend on generated classes.",
  },
  {
    id: "exact-text-evidence",
    purpose: "Match a short rendered or accessibility marker exactly, including reconstructed split text.",
    guardrail: "Use only exact values present in feedPatterns; never infer a hidden keyword from unrelated page copy.",
  },
  {
    id: "descendant-element-evidence",
    purpose: "Identify a content item by an observed descendant element type supported by the packaged runtime.",
    guardrail: "Use only descendant tags exposed by domSignals and the declarative schema.",
  },
  {
    id: "nearest-semantic-container",
    purpose: "Resolve evidence to its closest semantic feed item when that relationship is reliable.",
    guardrail: "Do not use when reported semantic items are nested controls, comments, or unrelated subcontent.",
  },
  {
    id: "evidence-cluster-container",
    purpose: "Resolve several instances of the same semantic evidence to their nearest shared non-essential container.",
    guardrail: "Require at least three observed evidence nodes and never resolve to page, navigation, form, or dialog roots.",
  },
  {
    id: "repeating-ancestor-container",
    purpose: "Walk from a nested marker to a structurally repeated content-item ancestor when semantic roles are absent.",
    guardrail: "Stop before essential page landmarks and require sibling evidence of repeated content structure.",
  },
  {
    id: "dynamic-content-trigger",
    purpose: "Re-run a validated automation when an infinite feed or client-side application inserts relevant content.",
    guardrail: "Observe bounded DOM changes, debounce cluster analysis, and execute only the packaged declarative action.",
  },
] as const;

interface SkillInput {
  evidence: { text: string[]; attributes: string[]; descendantTags: string[] };
  container: AutomationContainerStrategy;
  triggers: AutomationTrigger[];
}

export function deriveDomAutomationSkills(asset: SkillInput): DomAutomationSkillId[] {
  const skills: DomAutomationSkillId[] = [];
  if (asset.evidence.attributes.length) skills.push("semantic-attribute-evidence");
  if (asset.evidence.text.length) skills.push("exact-text-evidence");
  if (asset.evidence.descendantTags.length) skills.push("descendant-element-evidence");
  if (asset.container === "nearest-feed-item") skills.push("nearest-semantic-container");
  if (asset.container === "evidence-cluster") skills.push("evidence-cluster-container");
  if (asset.container === "nearest-repeating-ancestor") skills.push("repeating-ancestor-container");
  if (asset.triggers.includes("dom-mutation")) skills.push("dynamic-content-trigger");
  return skills;
}

export const DOM_AGENT_SKILLS_PROMPT = `Reusable DOM-analysis skills available to compose declarative automation assets:
${DOM_AUTOMATION_SKILLS.map((skill) => `- ${skill.id}: ${skill.purpose} Guardrail: ${skill.guardrail}`).join("\n")}
Choose skills from current-page evidence rather than memorized website structure. A saved asset may be origin-scoped, but the reasoning skill must remain portable. Do not use site names, advertiser names, generated class names, or a website-specific selector recipe. The runtime derives and records the selected skills from the validated evidence, container strategy, and triggers.`;
