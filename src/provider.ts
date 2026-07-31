import type { AdaptationPatch, ChatTurn, PageSnapshot, Proposal, ProviderConfig } from "./types";
import { parseProviderJson } from "./validation";

const SYSTEM_PROMPT = `You create safe, reversible visual website adaptations for an accessibility-focused Chrome extension.
Return JSON only with this exact shape:
{
  "summary": "plain-language explanation",
  "patch": {
    "fontScale": number from 0.8 to 2 or null,
    "lineHeight": number from 1.1 to 2.5 or null,
    "letterSpacingEm": number from 0 to 0.12 or null,
    "contentMaxWidthRem": number from 30 to 100 or null,
    "headingColor": a safe named color or hex color, or null,
    "articleLayout": "unchanged" | "swipe-cards",
    "deckControls": "unchanged" | "sides",
    "deckImageSize": "unchanged" | "compact",
    "deckLinkPosition": "unchanged" | "footer",
    "colorVisionMode": "unchanged" | "avoid-red",
    "themePreset": "unchanged" | "warm-hospitality" | "clean-minimal" | "bold-dark" | "paper-editorial",
    "colorScheme": "unchanged" | "light" | "dark",
    "contrast": "unchanged" | "more",
    "reduceMotion": boolean,
    "strongFocus": boolean,
    "hideSelectors": string[]
  },
  "resetFields": an array of patch field names to intentionally restore to the website default
}
Rules: make the smallest change that satisfies the request. Reply in the same language as the user's request. This response is only a proposed preview: never say that a change was applied, completed, performed, or is currently visible. Treat patch values as an incremental delta over the current active design: null, false, empty arrays, and "unchanged" preserve existing settings. Put a field in resetFields only when the user explicitly asks to restore that part to the website default. When the user explicitly replaces an existing theme or palette, set the requested new value and reset any conflicting themePreset, colorScheme, headingColor, or colorVisionMode fields. The summary must describe only behavior represented by non-default patch fields or resetFields; never promise a layout detail that is absent from both. Use conversation history to understand follow-ups such as "why not?", "do it", and pronouns. Treat a canceled or rejected proposal as negative feedback: do not repeat the same effective patch unless the user explicitly asks for it again. If the requested revision is outside the available patch schema, explain the limitation and return an unchanged patch instead of recycling the rejected proposal. If asked why a prior request was not performed, explain the actual limitation from the previous turn. Use headingColor when a heading/headline color is requested, articleLayout "swipe-cards" for a full-page Tinder-like article deck, deckControls "sides" only when navigation buttons are requested beside the cards, and colorVisionMode "avoid-red" when the user cannot distinguish red. Swipe-card layouts already support touch swiping, mouse dragging, and keyboard arrows. When the user references a familiar website's visual style, choose the closest non-identical themePreset: warm-hospitality for friendly rounded travel/marketplace styling, clean-minimal for restrained premium product styling, bold-dark for high-energy media/music styling, or paper-editorial for document-like styling. Describe it as inspired rather than copied and never imply affiliation. Never substitute an unrelated accessibility change when the request is unclear or unsupported; return an unchanged patch instead. Never claim the extension has controls that are not described here. Never output code, URLs, CSS declarations, HTML, scripts, pseudo-elements, :has(), attribute selectors for value/src/href, or selectors that target form values. hideSelectors is only for clearly distracting non-essential regions and must use simple stable selectors. Never hide navigation, main content, forms, dialogs, alerts, or focused elements.`;

const CAPABILITY_RULES = `Additional binding rules: call the response a proposed change, never an open or visible preview. deckControls may be supplied as an incremental delta without repeating articleLayout when the current design already uses swipe cards. Use deckImageSize "compact" when the user requests smaller images or more card space. Use deckLinkPosition "footer" when the Open article link should sit at the card bottom. Swipe-card layouts use a regular cursor and support touch swiping, mouse dragging, and keyboard arrows. On recognized social feeds, the packaged renderer uses each currently visible post as a card, preserves its author, avatar, text, and visible media, keeps live page videos playable, and omits the generic Open article action. It includes available Comments, Repost, and Like controls in each card footer. Comments open a left-side local details sheet with a link to the original conversation. Tweaksy does not fetch or copy replies that are not already visible on the permitted page; never claim unseen comments will appear inside the sheet.`;

function boundedHistory(history: ChatTurn[]): ChatTurn[] {
  return history
    .filter((turn) => (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string")
    .slice(-12)
    .map((turn) => ({ role: turn.role, content: turn.content.trim().slice(0, 1200) }))
    .filter((turn) => turn.content.length > 0);
}

function snapshotForProvider(snapshot: PageSnapshot): object {
  return {
    url: new URL(snapshot.context.url).origin + new URL(snapshot.context.url).pathname,
    title: snapshot.context.title,
    headings: snapshot.headings,
    landmarks: snapshot.landmarks,
    controls: snapshot.controls,
    visibleTextExcerpt: snapshot.text,
  };
}

function alignSupportedRequest(proposal: Proposal, request: string, basePatch?: AdaptationPatch): Proposal {
  const asksForSideControls = /\b(?:buttons?|controls?|arrows?|navigation)\b[^.]{0,90}\b(?:side|sides|beside|next to|left and right)\b|\b(?:side|sides|beside|next to|left and right)\b[^.]{0,90}\b(?:buttons?|controls?|arrows?|navigation)\b/i.test(request)
    || /(?:כפתורים|חצים|פקדים)[^.]{0,90}(?:בצד|בצדי|משני צדי)/i.test(request);
  const asksForCompactImages = /\b(?:reduce|shrink|smaller|compact)\b[^.]{0,70}\b(?:image|images|photo|photos)\b|\b(?:image|images|photo|photos)\b[^.]{0,70}\b(?:reduce|shrink|smaller|compact|more (?:space|real ?estate))\b/i.test(request);
  const asksForFooterLink = /\b(?:open article|article (?:button|link))\b[^.]{0,80}\b(?:footer|bottom)\b|\b(?:footer|bottom)\b[^.]{0,80}\b(?:open article|article (?:button|link))\b/i.test(request);
  const explicitlyRefinesDeck = /\b(?:cards?|swipe|swiping|deck)\b/i.test(request) && (asksForSideControls || asksForCompactImages || asksForFooterLink);
  const usesDeck = proposal.patch.articleLayout === "swipe-cards" || basePatch?.articleLayout === "swipe-cards" || explicitlyRefinesDeck;
  if (!usesDeck) return proposal;
  return {
    ...proposal,
    patch: {
      ...proposal.patch,
      ...(explicitlyRefinesDeck && proposal.patch.articleLayout !== "swipe-cards" && basePatch?.articleLayout !== "swipe-cards" ? { articleLayout: "swipe-cards" as const } : {}),
      ...(asksForSideControls ? { deckControls: "sides" as const } : {}),
      ...(asksForCompactImages ? { deckImageSize: "compact" as const } : {}),
      ...(asksForFooterLink ? { deckLinkPosition: "footer" as const } : {}),
    },
  };
}

async function checkedJson(response: Response): Promise<Record<string, unknown>> {
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const error = body.error as Record<string, unknown> | undefined;
    throw new Error(typeof error?.message === "string" ? error.message : `Provider request failed (${response.status}).`);
  }
  return body;
}

export async function generateProposal(config: ProviderConfig, request: string, snapshot: PageSnapshot, history: ChatTurn[], signal: AbortSignal, basePatch?: AdaptationPatch): Promise<Proposal> {
  const designContext = basePatch ? `\n\nCurrent active declarative design to preserve unless explicitly reset:\n${JSON.stringify(basePatch)}` : "";
  const userContent = `User request:\n${request.slice(0, 4000)}\n\nPermitted current-page snapshot:\n${JSON.stringify(snapshotForProvider(snapshot))}${designContext}`;
  const priorTurns = boundedHistory(history);

  if (config.provider === "openai" || config.provider === "azure") {
    const isAzure = config.provider === "azure";
    if (isAzure && !config.endpoint) throw new Error("Azure OpenAI endpoint is missing.");
    const url = isAzure
      ? `${config.endpoint}/openai/v1/chat/completions`
      : "https://api.openai.com/v1/chat/completions";
    const response = await fetch(url, {
      method: "POST",
      headers: isAzure
        ? { "content-type": "application/json", "api-key": config.apiKey }
        : { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${SYSTEM_PROMPT}\n${CAPABILITY_RULES}` },
          ...priorTurns,
          { role: "user", content: userContent },
        ],
      }),
      signal,
    });
    const body = await checkedJson(response);
    const choices = body.choices as Array<{ message?: { content?: string } }> | undefined;
    return alignSupportedRequest(parseProviderJson(choices?.[0]?.message?.content ?? ""), request, basePatch);
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1200,
      temperature: 0.1,
      system: `${SYSTEM_PROMPT}\n${CAPABILITY_RULES}`,
      messages: [...priorTurns, { role: "user", content: userContent }],
    }),
    signal,
  });
  const body = await checkedJson(response);
  const content = body.content as Array<{ type?: string; text?: string }> | undefined;
  return alignSupportedRequest(parseProviderJson(content?.find((part) => part.type === "text")?.text ?? ""), request, basePatch);
}

export async function transcribeAudio(config: ProviderConfig, base64: string, mimeType: string): Promise<string> {
  if (config.provider !== "openai" && config.provider !== "azure") throw new Error("Voice transcription requires OpenAI or Azure OpenAI.");
  if (base64.length > 7_000_000) throw new Error("Recording is too large. Keep it under one minute.");
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const extension = mimeType.includes("mp4") ? "m4a" : "webm";
  const form = new FormData();
  if (config.provider === "azure" && !config.transcriptionModel) {
    throw new Error("Add an Azure voice transcription deployment in provider settings before recording.");
  }
  form.append("model", config.transcriptionModel || "whisper-1");
  form.append("file", new Blob([bytes], { type: mimeType }), `request.${extension}`);
  const isAzure = config.provider === "azure";
  if (isAzure && !config.endpoint) throw new Error("Azure OpenAI endpoint is missing.");
  const url = isAzure
    ? `${config.endpoint}/openai/v1/audio/transcriptions?api-version=preview`
    : "https://api.openai.com/v1/audio/transcriptions";
  const response = await fetch(url, {
    method: "POST",
    headers: isAzure ? { "api-key": config.apiKey } : { authorization: `Bearer ${config.apiKey}` },
    body: form,
  });
  const body = await checkedJson(response);
  if (typeof body.text !== "string") throw new Error("The transcription response did not contain text.");
  return body.text;
}
