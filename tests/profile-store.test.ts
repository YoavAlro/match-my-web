import { beforeEach, describe, expect, it, vi } from "vitest";
import { isGloballyDisabled, isOriginPaused, setGloballyDisabled, setOriginPaused } from "../src/profile-store";

const values: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(values)) delete values[key];
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: values[key] })),
        set: vi.fn(async (next: Record<string, unknown>) => Object.assign(values, next)),
      },
    },
  });
});

describe("Tweaksy off-state persistence", () => {
  it("keeps global shutdown independent from per-origin state", async () => {
    await setOriginPaused("https://example.com", true);
    await setGloballyDisabled(true);

    expect(await isOriginPaused("https://example.com")).toBe(true);
    expect(await isGloballyDisabled()).toBe(true);

    await setGloballyDisabled(false);
    expect(await isOriginPaused("https://example.com")).toBe(true);
    expect(await isGloballyDisabled()).toBe(false);
  });

  it("removes only the origin being turned back on", async () => {
    await setOriginPaused("https://one.example", true);
    await setOriginPaused("https://two.example", true);
    await setOriginPaused("https://one.example", false);

    expect(await isOriginPaused("https://one.example")).toBe(false);
    expect(await isOriginPaused("https://two.example")).toBe(true);
  });
});
