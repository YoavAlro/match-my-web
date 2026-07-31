export type ChatAction =
  | "credentials-manual"
  | "import-design"
  | "share-design"
  | "export-debug"
  | "save-design"
  | "reject-proposal"
  | "preview"
  | "undo"
  | "pause-site"
  | "resume-site"
  | "inspect-page"
  | "open-settings";

export function classifyChatAction(request: string): ChatAction | null {
  const text = request.trim().toLowerCase();
  if (!text) return null;

  if (/\b(?:save|set|change|update|store|configure|enter|use)\b.*\b(?:api[ -]?key|credentials?|secret|provider settings?|endpoint|deployment|model settings?)\b/i.test(text)) {
    return "credentials-manual";
  }
  if (/\b(?:export|download|save)\b.*\b(?:debug|diagnostic)\b|\bdebug log\b/i.test(text)) return "export-debug";
  if (/\b(?:import|open|load|install)\b.*\b(?:design|template|profile)\b/i.test(text)) return "import-design";
  if (/\b(?:share|export|send|download)\b.*\b(?:design|template|profile)\b/i.test(text)) return "share-design";
  if (/\b(?:save|approve|keep|remember)\b.*\b(?:design|template|profile|adaptation|change|changes)\b|^(?:please\s+)?(?:save|approve|keep)\s+(?:it|this|that)(?:\s+now)?[.!]?$/i.test(text)) return "save-design";
  if (/\b(?:cancel|reject|dismiss)\b.*\b(?:proposal|suggestion)\b/i.test(text)) return "reject-proposal";
  if (/\b(?:undo|revert|remove|cancel)\b.*\b(?:preview|change|changes|adaptation)\b|^(?:please\s+)?(?:undo|revert)(?:\s+it)?[.!]?$/i.test(text)) return "undo";
  if (/\b(?:resume|enable|unpause|turn on)\b.*\b(?:site|website|design|profile|adaptation|extension)\b/i.test(text)) return "resume-site";
  if (/\b(?:pause|disable|turn off)\b.*\b(?:site|website|design|profile|adaptation|extension)\b/i.test(text)) return "pause-site";
  if (/^(?:please\s+)?(?:inspect|scan|analy[sz]e)\s+(?:(?:this|the|current)\s+)?(?:page|site|website)(?:\s+now)?[.!]?$/i.test(text)) return "inspect-page";
  if (/\b(?:open|show)\b.*\b(?:settings?|configuration)\b/i.test(text)) return "open-settings";
  if (/\b(?:(?:do|to) it|apply (?:it|that|the change|the changes|now)|preview (?:it|that|the change|the changes)|(?:show|open) (?:the )?preview|just do it|comply)\b/i.test(text)
    || /\b(?:don'?t|do not|can'?t|cannot)\b.*\b(?:see|get|have)\b.*\bpreviews?\b/i.test(text)) return "preview";

  return null;
}
