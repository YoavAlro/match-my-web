import { deriveDomAutomationSkills } from "./dom-agent-skills";
import type { AdaptationPatch, AutomationAsset, PageSnapshot, Proposal } from "./types";

function requestsContentFiltering(request: string): boolean {
  const action = /\b(?:hide|remove|filter|block|exclude|suppress)\b|(?:הסתר|להסתיר|הסר|לסנן|סנן)/i.test(request);
  const content = /\b(?:ads?|advertisements?|sponsored|promoted|posts?|feed|wall|cards?|items?|content|videos?)\b|(?:פרסומות?|ממומן|פוסטים?|תוכן|וידאו)/i.test(request);
  return action && content;
}

function usedAttributes(proposal: Proposal, basePatch?: AdaptationPatch): Set<string> {
  return new Set([
    ...(basePatch?.automationAssets ?? []),
    ...proposal.patch.automationAssets,
  ].flatMap((asset) => asset.evidence.attributes.map((attribute) => attribute.toLowerCase())));
}

export function augmentWithObservedDomSkill(
  proposal: Proposal,
  request: string,
  snapshot: PageSnapshot,
  basePatch?: AdaptationPatch,
): Proposal {
  if (!requestsContentFiltering(request)) return proposal;
  const used = usedAttributes(proposal, basePatch);
  const relevancePriority = { "request-match": 2, "content-marker": 1, structural: 0 } as const;
  const candidate = (snapshot.domSignals ?? [])
    .filter((signal) => signal.kind === "attribute-presence" && signal.relevance !== "structural" && !used.has(signal.name.toLowerCase()))
    .sort((left, right) => relevancePriority[right.relevance] - relevancePriority[left.relevance]
      || Number(right.occurrences >= 3) - Number(left.occurrences >= 3)
      || right.occurrences - left.occurrences
      || left.name.localeCompare(right.name))[0];
  if (!candidate) return proposal;

  const container = candidate.occurrences >= 3 ? "evidence-cluster" as const : "nearest-repeating-ancestor" as const;
  const triggers = ["page-ready" as const, "dom-mutation" as const];
  const evidence = { text: [], attributes: [candidate.name], descendantTags: [] };
  const asset: AutomationAsset = {
    type: "dom-filter",
    name: "Hide items matching an observed semantic marker",
    skills: deriveDomAutomationSkills({ evidence, container, triggers }),
    triggers,
    evidence,
    container,
    action: "hide",
  };
  return {
    ...proposal,
    patch: {
      ...proposal.patch,
      automationAssets: [...proposal.patch.automationAssets, asset].slice(0, 8),
    },
  };
}
