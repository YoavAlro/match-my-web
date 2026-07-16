import type { PageSnapshot, Proposal, ProviderConfig } from "./types";
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
    "colorScheme": "unchanged" | "light" | "dark",
    "contrast": "unchanged" | "more",
    "reduceMotion": boolean,
    "strongFocus": boolean,
    "hideSelectors": string[]
  }
}
Rules: make the smallest change that satisfies the request. Never output code, URLs, CSS declarations, HTML, scripts, pseudo-elements, :has(), attribute selectors for value/src/href, or selectors that target form values. hideSelectors is only for clearly distracting non-essential regions and must use simple stable selectors. Never hide navigation, main content, forms, dialogs, alerts, or focused elements.`;

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

async function checkedJson(response: Response): Promise<Record<string, unknown>> {
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const error = body.error as Record<string, unknown> | undefined;
    throw new Error(typeof error?.message === "string" ? error.message : `Provider request failed (${response.status}).`);
  }
  return body;
}

export async function generateProposal(config: ProviderConfig, request: string, snapshot: PageSnapshot, signal: AbortSignal): Promise<Proposal> {
  const userContent = `User request:\n${request.slice(0, 4000)}\n\nPermitted current-page snapshot:\n${JSON.stringify(snapshotForProvider(snapshot))}`;

  if (config.provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
      signal,
    });
    const body = await checkedJson(response);
    const choices = body.choices as Array<{ message?: { content?: string } }> | undefined;
    return parseProviderJson(choices?.[0]?.message?.content ?? "");
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
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }),
    signal,
  });
  const body = await checkedJson(response);
  const content = body.content as Array<{ type?: string; text?: string }> | undefined;
  return parseProviderJson(content?.find((part) => part.type === "text")?.text ?? "");
}

export async function transcribeAudio(config: ProviderConfig, base64: string, mimeType: string): Promise<string> {
  if (config.provider !== "openai") throw new Error("Voice transcription currently requires an OpenAI provider.");
  if (base64.length > 7_000_000) throw new Error("Recording is too large. Keep it under one minute.");
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const extension = mimeType.includes("mp4") ? "m4a" : "webm";
  const form = new FormData();
  form.append("model", "whisper-1");
  form.append("file", new Blob([bytes], { type: mimeType }), `request.${extension}`);
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${config.apiKey}` },
    body: form,
  });
  const body = await checkedJson(response);
  if (typeof body.text !== "string") throw new Error("The transcription response did not contain text.");
  return body.text;
}
