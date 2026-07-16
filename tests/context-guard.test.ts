import { describe, expect, it } from "vitest";
import { assertSamePageContext, samePageContext } from "../src/context-guard";
import type { PageContext } from "../src/types";

const context: PageContext = {
  tabId: 7,
  documentToken: "document-a",
  navigationToken: "navigation-a",
  url: "https://example.com/article",
  origin: "https://example.com",
  title: "Article",
};

describe("stale response guard", () => {
  it("accepts an exact tab, document, navigation, and URL match", () => {
    expect(samePageContext(context, { ...context })).toBe(true);
  });

  it.each([
    ["tab", { tabId: 8 }],
    ["document", { documentToken: "document-b" }],
    ["same-document navigation", { navigationToken: "navigation-b" }],
    ["URL", { url: "https://example.com/other" }],
  ])("rejects a changed %s", (_label, changed) => {
    const stale = { ...context, ...changed } as PageContext;
    expect(samePageContext(stale, context)).toBe(false);
    expect(() => assertSamePageContext(stale, context)).toThrow(/safely discarded/);
  });
});
