import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Harborline static surface", () => {
  it("provides six original story cards with six valid fragment destinations", async () => {
    const html = await readFile(path.resolve("web/index.html"), "utf8");
    const storyIds = [...html.matchAll(/data-story-id="([^"]+)"/g)].map((match) => match[1]);
    const storyHrefs = [...html.matchAll(/<a href="#([^"]+-story)" aria-label="Read /g)].map((match) => match[1]);
    const targetIds = new Set([...html.matchAll(/id="([^"]+-story)"/g)].map((match) => match[1]));

    expect(storyIds).toEqual(["ferry", "bakery", "garden", "radio", "pool", "signs"]);
    expect(storyHrefs).toHaveLength(6);
    expect(storyHrefs.every((href) => targetIds.has(href))).toBe(true);
  });

  it("keeps the publication itself as the complete visible surface", async () => {
    const html = await readFile(path.resolve("web/index.html"), "utf8");
    expect(html).toContain('data-tweaksy-demo');
    expect(html).toContain("Harborline Journal");
    expect(html).not.toContain('id="tweaksy-controls"');
    expect(html).not.toContain("tweaksy-dock");
  });

  it("leaves ChatGPT as the only agent conversation surface", async () => {
    const html = await readFile(path.resolve("web/index.html"), "utf8");
    expect(html).not.toContain("data-chat-form");
    expect(html).not.toContain("data-chat-input");
    expect(html).not.toContain("data-assistive-mode");
    expect(html).not.toContain("data-preview-hero");
  });

  it("keeps the source page free of Tweaksy branding", async () => {
    const html = await readFile(path.resolve("web/index.html"), "utf8");
    expect(html).not.toContain("Tweaksy Live");
    expect(html).not.toContain("Talk to Tweaksy");
    expect(html).not.toContain("Download Chrome demo");
  });
});
