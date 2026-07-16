const openButton = document.getElementById("open") as HTMLButtonElement;
const popupStatus = document.getElementById("status") as HTMLParagraphElement;

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
