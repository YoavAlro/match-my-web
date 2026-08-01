import { describe, expect, it } from "vitest";
import { proposalFromSupportedIntent } from "../src/intent";

describe("supported intent routing", () => {
  it("turns a headline color request into a deterministic safe patch", () => {
    const proposal = proposalFromSupportedIntent("make headline text blue");
    expect(proposal?.patch.headingColor).toBe("blue");
  });

  it("supports a Tinder-style article view", () => {
    const proposal = proposalFromSupportedIntent("I want the page to be a Tinder-style page where I can swipe articles");
    expect(proposal?.patch.articleLayout).toBe("swipe-cards");
  });

  it("sends multi-part visual requests to the configured provider", () => {
    const proposal = proposalFromSupportedIntent("I want swipeable articles with the color scheme aribnb have");
    expect(proposal).toBeNull();
  });

  it("does not silently drop page-specific ad removal requirements", () => {
    const proposal = proposalFromSupportedIntent("design the page as tinder cards without ads, with an airbnb color scheme");
    expect(proposal).toBeNull();
  });

  it("sends sponsored-post requests to the provider for DOM-pattern selection", () => {
    expect(proposalFromSupportedIntent("hide posts marked Ad or Sponsored")).toBeNull();
  });

  it("routes a focused video-post request to the packaged filter", () => {
    const proposal = proposalFromSupportedIntent("hide posts with videos");
    expect(proposal?.patch.hideVideoPosts).toBe(true);
  });

  it("does not reduce a detailed social-card request to a generic swipe deck", () => {
    const proposal = proposalFromSupportedIntent("Make a Tinder-style post deck with avatars, playable video, Like, Repost, and Comments buttons in the footer");
    expect(proposal).toBeNull();
  });

  it("supports requests to avoid red", () => {
    const proposal = proposalFromSupportedIntent("I want all colors without red because I can't see red");
    expect(proposal?.patch.colorVisionMode).toBe("avoid-red");
  });

  it("leaves follow-up questions for the provider with conversation history", () => {
    expect(proposalFromSupportedIntent("why not?")).toBeNull();
  });

  it("resolves an action follow-up against the previous user request", () => {
    const proposal = proposalFromSupportedIntent("try it now", [
      { role: "user", content: "make the headlines blue" },
      { role: "assistant", content: "That was not supported." },
    ]);
    expect(proposal?.patch.headingColor).toBe("blue");
  });
});
