import type { AdaptationPatch } from "./types";

export function buildAdaptationCss(patch: AdaptationPatch): string {
  const hidden = patch.hideSelectors.length
    ? `${patch.hideSelectors.join(",\n")} { display: none !important; }`
    : "";
  const width = patch.contentMaxWidthRem === null
    ? ""
    : `:where(main, article, [role="main"]) { max-width: ${patch.contentMaxWidthRem}rem !important; margin-inline: auto !important; }`;
  const color = patch.colorScheme === "unchanged" ? "" : `color-scheme: ${patch.colorScheme} !important;`;
  const contrast = patch.contrast === "more" ? "filter: contrast(1.15) !important;" : "";
  const focus = patch.strongFocus
    ? `:focus-visible { outline: 3px solid #f59e0b !important; outline-offset: 3px !important; }`
    : "";
  const motion = patch.reduceMotion
    ? `*, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .01ms !important; }`
    : "";

  const fontSize = patch.fontScale === null ? "" : `font-size: ${patch.fontScale}em !important;`;
  const lineHeight = patch.lineHeight === null ? "" : `line-height: ${patch.lineHeight} !important;`;
  const letterSpacing = patch.letterSpacingEm === null ? "" : `letter-spacing: ${patch.letterSpacingEm}em !important;`;
  const headingColor = patch.headingColor === null
    ? ""
    : `:where(h1, h2, h3, [role="heading"]) { color: ${patch.headingColor} !important; }`;

  return `
    :root { ${fontSize} ${lineHeight} ${letterSpacing} ${color} ${contrast} }
    ${width}
    ${headingColor}
    ${focus}
    ${motion}
    ${hidden}
  `;
}
