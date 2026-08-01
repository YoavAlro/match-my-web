import type { ExtensionMessage, MessageResult, TweaksyToggleState } from "./types";

const openButton = document.getElementById("open") as HTMLButtonElement;
const siteToggleButton = document.getElementById("site-toggle") as HTMLButtonElement;
const shutdownButton = document.getElementById("shutdown") as HTMLButtonElement;
const popupStatus = document.getElementById("status") as HTMLParagraphElement;
const stateLabel = document.getElementById("state") as HTMLParagraphElement;
const siteLabel = document.getElementById("site") as HTMLParagraphElement;
let state: TweaksyToggleState | null = null;

async function send<T>(message: ExtensionMessage): Promise<T> {
  const response = await chrome.runtime.sendMessage(message) as MessageResult<T>;
  if (!response.ok) throw new Error(response.error ?? "Tweaksy could not complete that action.");
  return response.data as T;
}

function render(next: TweaksyToggleState): void {
  state = next;
  const off = next.shutdown || next.siteDisabled;
  document.body.classList.toggle("off", off);
  stateLabel.textContent = next.shutdown
    ? "Shut down"
    : next.siteDisabled ? "Off on this site" : "Active on this site";
  siteLabel.textContent = next.origin ?? "Site controls are unavailable on this page";
  siteLabel.title = next.origin ?? "";
  siteToggleButton.textContent = next.siteDisabled ? "Turn on for this site" : "Turn off for this site";
  siteToggleButton.disabled = next.shutdown || !next.origin;
  shutdownButton.textContent = next.shutdown ? "Turn Tweaksy back on" : "Shut down Tweaksy";
  openButton.disabled = next.shutdown;
}

async function runToggle(button: HTMLButtonElement, message: ExtensionMessage): Promise<void> {
  button.disabled = true;
  popupStatus.textContent = "Updating…";
  try {
    render(await send<TweaksyToggleState>(message));
    popupStatus.textContent = "";
  } catch (error) {
    popupStatus.textContent = error instanceof Error ? error.message : "Could not update Tweaksy.";
    if (state) render(state);
  }
}

siteToggleButton.addEventListener("click", () => {
  if (state) void runToggle(siteToggleButton, { type: "SET_ACTIVE_SITE_DISABLED", disabled: !state.siteDisabled });
});

shutdownButton.addEventListener("click", () => {
  if (state) void runToggle(shutdownButton, { type: "SET_GLOBAL_DISABLED", disabled: !state.shutdown });
});

openButton.addEventListener("click", async () => {
  openButton.disabled = true;
  popupStatus.textContent = "Opening…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.windowId) throw new Error("No active browser tab was found.");
    await chrome.sidePanel.open({ windowId: tab.windowId });
    window.close();
  } catch (error) {
    openButton.disabled = false;
    popupStatus.textContent = error instanceof Error ? error.message : "Could not open the panel.";
  }
});

void send<TweaksyToggleState>({ type: "GET_TWEAKSY_TOGGLE_STATE" })
  .then(render)
  .catch((error: unknown) => {
    popupStatus.textContent = error instanceof Error ? error.message : "Could not read Tweaksy's state.";
    siteToggleButton.disabled = true;
    shutdownButton.disabled = true;
  });
