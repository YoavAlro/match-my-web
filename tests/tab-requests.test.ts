import { describe, expect, it } from "vitest";
import { TabRequestRegistry } from "../src/tab-requests";

describe("tab-bound provider requests", () => {
  it("keeps another tab's request alive", () => {
    const requests = new TabRequestRegistry();
    const first = requests.start(1);
    const second = requests.start(2);

    expect(first.signal.aborted).toBe(false);
    expect(second.signal.aborted).toBe(false);

    requests.abort(2);
    expect(first.signal.aborted).toBe(false);
    expect(second.signal.aborted).toBe(true);
  });

  it("replaces only an older request from the same tab", () => {
    const requests = new TabRequestRegistry();
    const first = requests.start(1);
    const replacement = requests.start(1);

    expect(first.signal.aborted).toBe(true);
    expect(replacement.signal.aborted).toBe(false);
  });

  it("does not let an older completion clear its replacement", () => {
    const requests = new TabRequestRegistry();
    const first = requests.start(1);
    const replacement = requests.start(1);
    requests.finish(1, first);

    requests.abort(1);
    expect(replacement.signal.aborted).toBe(true);
  });

  it("aborts every request only for an explicit global shutdown", () => {
    const requests = new TabRequestRegistry();
    const first = requests.start(1);
    const second = requests.start(2);
    requests.abortAll();
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(true);
  });
});
