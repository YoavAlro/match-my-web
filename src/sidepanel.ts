import type { ExtensionMessage, MessageResult, PageContext, PageSnapshot, Proposal, ProviderConfig } from "./types";

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing UI element: ${id}`);
  return element as T;
};

const pageBadge = $("page-badge");
const pageDetail = $("page-detail");
const status = $("status");
const conversation = $("conversation");
const prompt = $<HTMLTextAreaElement>("prompt");
const proposalSection = $<HTMLElement>("proposal");
const proposalSummary = $("proposal-summary");
const proposalDetails = $("proposal-details");
const previewButton = $<HTMLButtonElement>("preview");
const saveButton = $<HTMLButtonElement>("save");
const recordButton = $<HTMLButtonElement>("record");
const providerSelect = $<HTMLSelectElement>("provider");
const azureSettings = $("azure-settings");
const endpointInput = $<HTMLInputElement>("endpoint");
const voiceNote = $("voice-note");

let snapshot: PageSnapshot | null = null;
let activeProposal: Proposal | null = null;
let proposalContext: PageContext | null = null;
let recorder: MediaRecorder | null = null;
let recordingTimer: number | null = null;

function updateProviderFields(): void {
  const isAzure = providerSelect.value === "azure";
  azureSettings.hidden = !isAzure;
  endpointInput.required = isAzure;
  if (providerSelect.value === "anthropic") {
    voiceNote.textContent = "Recording is unavailable with Anthropic. You can always type your request.";
  } else if (isAzure) {
    voiceNote.textContent = "Recording is optional and requires a separate Azure speech-to-text deployment name. Audio is never saved.";
  } else {
    voiceNote.textContent = "Recording is optional. Audio is sent to your configured OpenAI provider for transcription and is never saved.";
  }
}

function azurePermissionOrigin(value: string): string {
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new Error("Enter a valid Azure OpenAI endpoint before saving.");
  }
  const host = endpoint.hostname.toLowerCase();
  const isAzureHost = host.endsWith(".openai.azure.com")
    || host.endsWith(".services.ai.azure.com")
    || host.endsWith(".cognitiveservices.azure.com");
  if (endpoint.protocol !== "https:" || !isAzureHost || endpoint.username || endpoint.password) {
    throw new Error("Use the HTTPS resource endpoint provided by Microsoft Azure.");
  }
  return `${endpoint.origin}/*`;
}

async function send<T>(message: ExtensionMessage): Promise<T> {
  const result = await chrome.runtime.sendMessage(message) as MessageResult<T>;
  if (!result.ok) throw new Error(result.error ?? "The extension could not complete that action.");
  return result.data as T;
}

function setStatus(message: string, isError = false): void {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function addMessage(message: string, isError = false): void {
  const item = document.createElement("div");
  item.className = `message${isError ? " error" : ""}`;
  item.textContent = message;
  conversation.append(item);
}

function busy(button: HTMLButtonElement, value: boolean, busyLabel: string): void {
  if (value) button.dataset.originalLabel = button.textContent ?? "";
  button.disabled = value;
  button.textContent = value ? busyLabel : button.dataset.originalLabel ?? button.textContent;
  button.setAttribute("aria-busy", String(value));
}

function describePatch(proposal: Proposal): void {
  proposalSummary.textContent = proposal.summary;
  proposalDetails.replaceChildren();
  const entries: Array<[string, string]> = [
    ["Text size", proposal.patch.fontScale === null ? "Unchanged" : `${Math.round(proposal.patch.fontScale * 100)}%`],
    ["Line height", proposal.patch.lineHeight === null ? "Unchanged" : String(proposal.patch.lineHeight)],
    ["Letter spacing", proposal.patch.letterSpacingEm === null ? "Unchanged" : `${proposal.patch.letterSpacingEm}em`],
    ["Content width", proposal.patch.contentMaxWidthRem ? `${proposal.patch.contentMaxWidthRem}rem` : "Unchanged"],
    ["Color scheme", proposal.patch.colorScheme],
    ["Contrast", proposal.patch.contrast],
    ["Motion", proposal.patch.reduceMotion ? "Reduced" : "Unchanged"],
    ["Focus indicator", proposal.patch.strongFocus ? "Strengthened" : "Unchanged"],
    ["Hidden regions", proposal.patch.hideSelectors.length ? proposal.patch.hideSelectors.join(", ") : "None"],
  ];
  for (const [term, description] of entries) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = term;
    dd.textContent = description;
    proposalDetails.append(dt, dd);
  }
  proposalSection.hidden = false;
  saveButton.disabled = true;
}

async function refreshContext(): Promise<void> {
  try {
    const context = await send<PageContext>({ type: "GET_ACTIVE_CONTEXT" });
    pageBadge.textContent = "Ready";
    pageDetail.textContent = `${context.title || "Untitled page"} — ${context.origin}`;
  } catch (error) {
    pageBadge.textContent = "Unavailable";
    pageDetail.textContent = error instanceof Error ? error.message : "This page cannot be adapted.";
  }
}

async function inspectWithAccessPrompt(): Promise<PageSnapshot> {
  try {
    return await send<PageSnapshot>({ type: "INSPECT_ACTIVE_PAGE" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/cannot access contents|permission to access|host/i.test(message)) throw error;
    await send<boolean>({ type: "REQUEST_ACTIVE_SITE_ACCESS" });
    throw new Error("Chrome is asking for access to this site. Choose Allow, then click Inspect this page again.");
  }
}

$("inspect").addEventListener("click", async (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  busy(button, true, "Inspecting…");
  try {
    snapshot = await inspectWithAccessPrompt();
    pageBadge.textContent = "Inspected";
    pageDetail.textContent = `${snapshot.context.title || "Untitled page"} — ${snapshot.context.origin}`;
    setStatus("Page structure is ready. Nothing has been sent to an AI provider yet.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Inspection failed.", true);
  } finally {
    busy(button, false, "");
  }
});

$("provider-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const button = form.querySelector<HTMLButtonElement>("button[type='submit']")!;
  const config: ProviderConfig = {
    provider: providerSelect.value as ProviderConfig["provider"],
    model: $<HTMLInputElement>("model").value.trim(),
    apiKey: $<HTMLInputElement>("api-key").value.trim(),
    ...(providerSelect.value === "azure" ? { endpoint: endpointInput.value.trim() } : {}),
    ...($<HTMLInputElement>("transcription-model").value.trim()
      ? { transcriptionModel: $<HTMLInputElement>("transcription-model").value.trim() }
      : {}),
  };
  busy(button, true, "Saving…");
  try {
    const providerOrigin = config.provider === "openai"
      ? "https://api.openai.com/*"
      : config.provider === "anthropic"
        ? "https://api.anthropic.com/*"
        : azurePermissionOrigin(config.endpoint ?? "");
    const granted = await chrome.permissions.request({ origins: [providerOrigin] });
    if (!granted) throw new Error("Provider access was not granted. The extension cannot contact that API.");
    await send<boolean>({ type: "SAVE_PROVIDER_CONFIG", config });
    $<HTMLInputElement>("api-key").value = "";
    setStatus("Provider saved locally.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not save the provider.", true);
  } finally {
    busy(button, false, "");
  }
});

$("prompt-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const request = prompt.value.trim();
  if (!request) {
    prompt.focus();
    setStatus("Describe the change you want first.", true);
    return;
  }
  const button = $<HTMLButtonElement>("generate");
  busy(button, true, "Generating…");
  try {
    if (!snapshot) snapshot = await inspectWithAccessPrompt();
    addMessage(`You: ${request}`);
    const result = await send<{ proposal: Proposal; context: PageContext }>({ type: "GENERATE_PROPOSAL", request, snapshot });
    activeProposal = result.proposal;
    proposalContext = result.context;
    describePatch(result.proposal);
    addMessage(`Match My Web: ${result.proposal.summary}`);
    setStatus("Suggestion ready. Review it, then choose Preview.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    addMessage(message, true);
    setStatus(message, true);
  } finally {
    busy(button, false, "");
  }
});

previewButton.addEventListener("click", async () => {
  if (!activeProposal || !proposalContext) return;
  busy(previewButton, true, "Applying…");
  try {
    await send<boolean>({ type: "APPLY_PREVIEW", context: proposalContext, proposal: activeProposal });
    saveButton.disabled = false;
    setStatus("Preview applied. You can undo it or approve and save it.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Preview failed.", true);
  } finally {
    busy(previewButton, false, "");
  }
});

$("revert").addEventListener("click", async (event) => {
  if (!proposalContext) return;
  const button = event.currentTarget as HTMLButtonElement;
  busy(button, true, "Undoing…");
  try {
    await send<boolean>({ type: "REVERT_PREVIEW", context: proposalContext });
    saveButton.disabled = true;
    setStatus("Preview undone.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not undo the preview.", true);
  } finally {
    busy(button, false, "");
  }
});

saveButton.addEventListener("click", async () => {
  if (!activeProposal || !proposalContext) return;
  busy(saveButton, true, "Saving…");
  try {
    const originPattern = `${proposalContext.origin}/*`;
    const granted = await chrome.permissions.request({ origins: [originPattern] });
    if (!granted) throw new Error("Site access was not granted. The preview remains temporary and was not saved.");
    await send({ type: "SAVE_PROFILE", context: proposalContext, proposal: activeProposal });
    setStatus(`Profile saved locally for ${proposalContext.origin}.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not save the profile.", true);
  } finally {
    busy(saveButton, false, "");
  }
});

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the recording."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(blob);
  });
}

async function stopAndTranscribe(chunks: Blob[], mimeType: string): Promise<void> {
  try {
    setStatus("Transcribing with your provider…");
    const blob = new Blob(chunks, { type: mimeType });
    const base64 = await blobToBase64(blob);
    const text = await send<string>({ type: "TRANSCRIBE_AUDIO", base64, mimeType });
    prompt.value = [prompt.value.trim(), text.trim()].filter(Boolean).join(" ");
    prompt.focus();
    setStatus("Transcription added. Review it before generating a preview.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Transcription failed.", true);
  }
}

recordButton.addEventListener("click", async () => {
  if (recorder?.state === "recording") {
    recorder.stop();
    if (recordingTimer !== null) window.clearTimeout(recordingTimer);
    recordButton.setAttribute("aria-pressed", "false");
    recordButton.textContent = "● Record";
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks: Blob[] = [];
    recorder = new MediaRecorder(stream);
    const mimeType = recorder.mimeType || "audio/webm";
    recorder.addEventListener("dataavailable", (event) => { if (event.data.size) chunks.push(event.data); });
    recorder.addEventListener("stop", () => {
      stream.getTracks().forEach((track) => track.stop());
      void stopAndTranscribe(chunks, mimeType);
    }, { once: true });
    recorder.start();
    recordButton.setAttribute("aria-pressed", "true");
    recordButton.textContent = "■ Stop";
    setStatus("Recording. Activate Stop when finished; recording stops automatically after 60 seconds.");
    recordingTimer = window.setTimeout(() => {
      if (recorder?.state === "recording") recordButton.click();
    }, 60_000);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Microphone access was not available.", true);
  }
});

prompt.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key === "Enter") {
    event.preventDefault();
    $<HTMLButtonElement>("generate").click();
  }
});

void send<ProviderConfig | null>({ type: "GET_PROVIDER_CONFIG" }).then((config) => {
  if (!config) return;
  providerSelect.value = config.provider;
  $<HTMLInputElement>("model").value = config.model;
  $<HTMLInputElement>("transcription-model").value = config.transcriptionModel ?? "";
  endpointInput.value = config.endpoint ?? "";
  $<HTMLInputElement>("api-key").placeholder = "Saved locally — leave blank to keep it";
  updateProviderFields();
}).catch(() => undefined);
providerSelect.addEventListener("change", updateProviderFields);
updateProviderFields();
void refreshContext();
