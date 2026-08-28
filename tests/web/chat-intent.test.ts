import { describe, expect, it } from "vitest";
import { DEFAULT_PATCH } from "../../src/types";
import { interpretHostedChatRequest } from "../../src/web/chat-intent";
import { interpretAssistiveChatAction } from "../../src/web/assistive-controller";

describe("Tweaksy Live free-form chat", () => {
  it("turns a broad reading request into a coordinated safe preview", () => {
    const proposal = interpretHostedChatRequest("Make this calmer and easier to read", DEFAULT_PATCH);
    expect(proposal).not.toBeNull();
    expect(proposal?.changes).toMatchObject({
      fontScale: 1.16,
      lineHeight: 1.68,
      contentMaxWidthRem: 62,
      reduceMotion: true,
      themePreset: "paper-editorial",
    });
  });

  it("combines layout and color-scheme intent from one natural sentence", () => {
    const proposal = interpretHostedChatRequest("Show one story at a time in dark mode", DEFAULT_PATCH);
    expect(proposal?.changes).toMatchObject({
      articleLayout: "swipe-cards",
      deckControls: "sides",
      deckImageSize: "compact",
      deckLinkPosition: "footer",
      colorScheme: "dark",
    });
  });

  it("preserves an active preview while refining one field", () => {
    const active = {
      ...DEFAULT_PATCH,
      fontScale: 1.24,
      lineHeight: 1.72,
      articleLayout: "swipe-cards" as const,
      deckControls: "sides" as const,
    };
    const proposal = interpretHostedChatRequest("Use higher contrast too", active);
    expect(proposal?.changes).toMatchObject({
      fontScale: 1.24,
      lineHeight: 1.72,
      articleLayout: "swipe-cards",
      deckControls: "sides",
      contrast: "more",
    });
  });

  it("declines requests outside the visual adaptation vocabulary", () => {
    expect(interpretHostedChatRequest("Book me a ferry ticket", DEFAULT_PATCH)).toBeNull();
  });
});

describe("Tweaksy Live assistive chat", () => {
  it("routes disability and focus language to semantic browser actions", () => {
    expect(interpretAssistiveChatAction("I'm color blind. Avoid red-only cues.")).toEqual({
      kind: "accessibility-mode",
      mode: "color-safe",
    });
    expect(interpretAssistiveChatAction("I am blind, read this page to me")).toEqual({
      kind: "read",
      scope: "page-summary",
    });
    expect(interpretAssistiveChatAction("Help me focus for 45 minutes")).toEqual({
      kind: "start-focus",
      minutes: 45,
    });
  });

  it("distinguishes current-story reading and stop controls", () => {
    expect(interpretAssistiveChatAction("Read this current story to me")).toEqual({ kind: "read", scope: "current-story" });
    expect(interpretAssistiveChatAction("Stop reading")).toEqual({ kind: "stop-reading" });
    expect(interpretAssistiveChatAction("End focus mode")).toEqual({ kind: "end-focus" });
  });
});
