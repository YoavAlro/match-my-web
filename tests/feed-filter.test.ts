import { describe, expect, it } from "vitest";
import { isSponsoredMarker, isSponsoredMetadata, normalizeFeedMarker } from "../src/feed-filter";

describe("feed filtering markers", () => {
  it("recognizes rendered split-letter and localized sponsorship labels", () => {
    expect(isSponsoredMarker("S p o n s o r e d")).toBe(true);
    expect(isSponsoredMarker("ממומן")).toBe(true);
    expect(isSponsoredMarker("Sponsorisé")).toBe(true);
  });

  it("does not treat ordinary post text as a sponsorship marker", () => {
    expect(isSponsoredMarker("This post discusses sponsored content policies")).toBe(false);
    expect(isSponsoredMarker("video advertisement techniques")).toBe(false);
  });

  it("accepts bounded accessibility metadata without broad text matching", () => {
    expect(isSponsoredMetadata("Sponsored post by Example Company")).toBe(true);
    expect(isSponsoredMetadata("This is a long discussion about sponsored content policies and advertising techniques")).toBe(false);
  });

  it("normalizes compatibility characters and punctuation", () => {
    expect(normalizeFeedMarker("Ｓｐｏｎｓｏｒｅｄ ·")).toBe("sponsored");
  });

});
