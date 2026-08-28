import { describe, expect, it } from "vitest";
import { classifyChatAction, isSendShortcut } from "../src/chat-actions";

describe("chat action routing", () => {
  it.each([
    ["save this as my template", "save-design"],
    ["approve and keep these changes", "save-design"],
    ["preview it", "preview"],
    ["to it now", "preview"],
    ["i dont get previews here", "preview"],
    ["cancel this proposal", "reject-proposal"],
    ["undo the preview", "undo"],
    ["pause the extension on this site", "pause-site"],
    ["resume the design on this website", "resume-site"],
    ["inspect this page", "inspect-page"],
    ["share this design", "share-design"],
    ["import a template", "import-design"],
    ["export the debug log", "export-debug"],
    ["open settings", "open-settings"],
    ["start a new conversation", "new-conversation"],
    ["clear this chat", "new-conversation"],
  ])("routes %s", (request, expected) => {
    expect(classifyChatAction(request)).toBe(expected);
  });

  it("keeps credentials and provider configuration manual", () => {
    expect(classifyChatAction("save my Azure API key")).toBe("credentials-manual");
    expect(classifyChatAction("change the provider endpoint")).toBe("credentials-manual");
  });

  it("does not steal ordinary visual requests from the adaptation agent", () => {
    expect(classifyChatAction("make the headlines blue")).toBeNull();
    expect(classifyChatAction("analyze the page and turn every article into a card")).toBeNull();
  });
});

describe("chat send shortcut", () => {
  it("accepts Control+Enter and Command+Enter", () => {
    expect(isSendShortcut({ key: "Enter", ctrlKey: true, metaKey: false })).toBe(true);
    expect(isSendShortcut({ key: "Enter", ctrlKey: false, metaKey: true })).toBe(true);
  });

  it("keeps plain Enter available for composing text", () => {
    expect(isSendShortcut({ key: "Enter", ctrlKey: false, metaKey: false })).toBe(false);
    expect(isSendShortcut({ key: "a", ctrlKey: false, metaKey: true })).toBe(false);
  });
});
