import { DEFAULT_PATCH, type ChatTurn, type Proposal } from "./types";

const COLORS = ["black", "white", "gray", "grey", "red", "orange", "yellow", "green", "blue", "purple", "pink", "brown", "navy", "teal", "maroon"];

export function proposalFromSupportedIntent(request: string, history: ChatTurn[] = []): Proposal | null {
  const text = request.trim();
  const isActionFollowUp = /^(?:do it|try (?:it|that)(?: now)?|change it(?: now)?|make it so|comply|yes(?:,? do it)?|תעשה(?: את זה)?|נסה שוב)$/i.test(text);
  const previousRequest = [...history].reverse().find((turn) => turn.role === "user")?.content ?? "";
  const effectiveText = isActionFollowUp && previousRequest ? `${previousRequest}. ${text}` : text;
  const lower = effectiveText.toLowerCase();
  const isHebrew = /[\u0590-\u05ff]/.test(text);
  const patch = { ...DEFAULT_PATCH, hideSelectors: [] };
  const changes: string[] = [];
  const isRequest = /\b(?:make|change|set|turn|show|style|use|convert|transform|want|please|try)\b|(?:שנה|תשנה|רוצה|הפוך|תעשה)/i.test(effectiveText);
  const isQuestionOnly = /^\s*(?:why|how come|למה|מדוע)\b/i.test(text);

  const wantsVideoPostsHidden = /\b(?:hide|remove|filter|block|don'?t (?:want to )?see|do not (?:want to )?see)\b[^.]{0,80}\b(?:video|videos|video posts?)\b/i.test(effectiveText)
    || /\b(?:video|videos|video posts?)\b[^.]{0,80}\b(?:hide|remove|filter|block)\b/i.test(effectiveText);
  if (wantsVideoPostsHidden) {
    patch.hideVideoPosts = true;
    changes.push(isHebrew ? "הסתרת פוסטים שמכילים וידאו" : "Hide feed posts containing video");
  }

  const headingRequested = /\b(?:headline|headlines|heading|headings|article title|article titles)\b|(?:כותרת|כותרות)/i.test(effectiveText);
  const namedColor = COLORS.find((color) => new RegExp(`\\b${color}\\b`, "i").test(effectiveText));
  const hexColor = effectiveText.match(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/i)?.[0]?.toLowerCase();
  if (isRequest && headingRequested && (hexColor || namedColor)) {
    patch.headingColor = hexColor ?? namedColor ?? null;
    changes.push(isHebrew ? `שינוי צבע הכותרות ל-${patch.headingColor}` : `Set headline text to ${patch.headingColor}`);
  }

  const wantsSwipeCards = /\btinder(?:-style)?\b/i.test(effectiveText)
    || (/\b(?:swipe|swipeable|horizontal cards?)\b/i.test(effectiveText) && /\b(?:article|articles|news|story|stories|page)\b/i.test(effectiveText));
  if (isRequest && wantsSwipeCards) {
    patch.articleLayout = "swipe-cards";
    changes.push(isHebrew
      ? "בניית תצוגת כתבות מלאה ככרטיסים שניתן להחליק אופקית, ללא אזורי הפרסום של העמוד המקורי"
      : "Build a full-page horizontal content deck without the original page's distracting regions");
  }

  const cannotSeeRed = /\b(?:without|avoid|remove|replace|cannot see|can't see|do not use|don't use)\b[^.]{0,50}\bred\b/i.test(lower)
    || /\bred\b[^.]{0,50}\b(?:cannot see|can't see|color blind|colour blind)\b/i.test(lower)
    || /(?:בלי|ללא|לא רואה|להחליף|הסר)[^.]{0,50}(?:אדום|הצבע האדום)/i.test(effectiveText);
  if (isRequest && cannotSeeRed) {
    patch.colorVisionMode = "avoid-red";
    changes.push(isHebrew ? "החלפת צבעי ממשק אדומים בחלופות כחולות וטורקיז" : "Remap red interface colors to blue and teal alternatives");
  }

  if (isRequest && !isQuestionOnly) {
    if (/\b(?:airbnb|aribnb|air-bnb|air bnb)\b/i.test(effectiveText)) {
      patch.themePreset = "warm-hospitality";
      changes.push(isHebrew
        ? "החלת עיצוב אירוח חמים ובהיר בהשראת שווקי תיירות, בלי להעתיק את המותג"
        : "Apply a warm, light hospitality-marketplace theme inspired by the reference without copying its brand");
    } else if (/\bapple\b/i.test(effectiveText)) {
      patch.themePreset = "clean-minimal";
      changes.push(isHebrew ? "החלת עיצוב נקי ומינימלי" : "Apply a restrained clean-minimal theme");
    } else if (/\bspotify\b/i.test(effectiveText)) {
      patch.themePreset = "bold-dark";
      changes.push(isHebrew ? "החלת עיצוב כהה, נועז ואנרגטי" : "Apply an energetic bold-dark theme");
    } else if (/\bnotion\b/i.test(effectiveText)) {
      patch.themePreset = "paper-editorial";
      changes.push(isHebrew ? "החלת עיצוב נייר עריכתי רגוע" : "Apply a calm paper-editorial theme");
    }
  }

  const needsPageSpecificReasoning = /\b(?:sidebar|side bar|menu|search bar|who to follow|banner)\b/i.test(effectiveText);
  const hasDetailedSocialDeckRequirements = wantsSwipeCards
    && /\b(?:posts?|tweets?|twitter|footer|likes?|retweets?|reposts?|comments?|replies|reply|videos?|media|assets?|avatars?|icons?|flip|drawer)\b/i.test(effectiveText);
  if (changes.length !== 1 || needsPageSpecificReasoning || hasDetailedSocialDeckRequirements) return null;
  return {
    summary: isHebrew
      ? `${changes.join(". ")}. ניתן להציג תצוגה מקדימה הפיכה לפני השמירה.`
      : `${changes.join(". ")}. Preview the reversible change before saving.`,
    patch,
  };
}
