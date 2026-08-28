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

  it("keeps Tweaksy controls reachable before traversing the full page", async () => {
    const html = await readFile(path.resolve("web/index.html"), "utf8");
    expect(html).toContain('href="#tweaksy-controls">Skip to Tweaksy controls</a>');
    expect(html).toContain('id="tweaksy-controls"');
  });
});
