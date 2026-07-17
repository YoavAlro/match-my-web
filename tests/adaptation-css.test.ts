import { describe, expect, it } from "vitest";
import { buildAdaptationCss } from "../src/adaptation-css";
import { validatePatch } from "../src/validation";

describe("adaptation CSS", () => {
  it("contains only local visual declarations from validated input", () => {
    const css = buildAdaptationCss(validatePatch({
      fontScale: 1.3,
      headingColor: "blue",
      reduceMotion: true,
      hideSelectors: [".ad-slot", "img[src='https://attacker.test/pixel']"],
    }));
    expect(css).toContain("font-size: 1.3em");
    expect(css).toContain("color: blue");
    expect(css).toContain(".ad-slot");
    expect(css).not.toMatch(/url\s*\(|@import|attacker\.test/i);
  });
});
