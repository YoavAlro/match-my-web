import type { PageContext } from "./types";

export function samePageContext(actual: PageContext, expected: PageContext): boolean {
  return actual.tabId === expected.tabId
    && actual.documentToken === expected.documentToken
    && actual.navigationToken === expected.navigationToken
    && actual.url === expected.url;
}

export function assertSamePageContext(actual: PageContext, expected: PageContext): void {
  if (!samePageContext(actual, expected)) throw new Error("The page changed. This response was safely discarded.");
}
