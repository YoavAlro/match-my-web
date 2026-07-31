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
    : `:where(h1, h2, h3, [role="heading"]), :where(h1, h2, h3, [role="heading"]) * { color: ${patch.headingColor} !important; }`;
  const articleLayout = patch.articleLayout === "swipe-cards"
    ? `
      html[data-mmw-deck-active] body > :not([data-mmw-deck]) { display: none !important; }
      html[data-mmw-deck-active], html[data-mmw-deck-active] body {
        margin: 0 !important;
        min-height: 100% !important;
        overflow: hidden !important;
      }
      [data-mmw-deck] {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483646 !important;
        display: grid !important;
        grid-template-rows: auto minmax(0, 1fr) auto !important;
        gap: 0 !important;
        color: var(--mmw-page-text, #202124) !important;
        background: var(--mmw-page-bg, #ffffff) !important;
        font: 16px/1.5 ui-sans-serif, system-ui, sans-serif !important;
      }
      [data-mmw-deck-header], [data-mmw-deck-footer] {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 1rem !important;
        background: var(--mmw-surface, var(--mmw-page-bg, #ffffff)) !important;
      }
      [data-mmw-deck-header] {
        min-height: 2.2rem !important;
        padding: .25rem .55rem !important;
        border-bottom: 1px solid rgb(148 163 184 / .28) !important;
      }
      [data-mmw-deck-header] strong {
        display: inline-flex !important;
        align-items: center !important;
        gap: .4rem !important;
        overflow: hidden !important;
        font-size: .72rem !important;
        font-weight: 650 !important;
        letter-spacing: .01em !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }
      [data-mmw-brand-mark] {
        width: 1.35rem !important;
        height: 1.35rem !important;
        flex: 0 0 auto !important;
        overflow: visible !important;
      }
      [data-mmw-brand-mark] [data-mmw-mark-body] { fill: #1769e0 !important; stroke: #0b1f33 !important; }
      [data-mmw-brand-mark] [data-mmw-mark-face] { fill: #0b1f33 !important; stroke: #0b1f33 !important; }
      [data-mmw-deck-footer] { padding: .65rem .85rem !important; }
      [data-mmw-deck-track] {
        display: grid !important;
        grid-auto-flow: column !important;
        grid-auto-columns: 100% !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        scroll-snap-type: x mandatory !important;
        scrollbar-width: none !important;
        touch-action: pan-x !important;
        cursor: default !important;
      }
      [data-mmw-deck-track][data-mmw-dragging] { scroll-snap-type: none !important; cursor: default !important; user-select: none !important; }
      [data-mmw-deck-track]::-webkit-scrollbar { display: none !important; }
      [data-mmw-deck-card] {
        position: relative !important;
        display: grid !important;
        grid-template-rows: minmax(12rem, 52vh) auto !important;
        width: min(92vw, 54rem) !important;
        max-height: calc(100dvh - 6.25rem) !important;
        margin: auto !important;
        overflow: hidden !important;
        scroll-snap-align: center !important;
        border: 1px solid color-mix(in srgb, var(--mmw-page-text, #202124) 24%, transparent) !important;
        border-radius: 1.25rem !important;
        color: var(--mmw-page-text, #202124) !important;
        background: var(--mmw-surface, var(--mmw-page-bg, #ffffff)) !important;
        box-shadow: 0 1.5rem 4rem rgb(0 0 0 / .45) !important;
      }
      [data-mmw-deck-card] img {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        background: color-mix(in srgb, var(--mmw-surface, #ffffff) 88%, var(--mmw-page-text, #202124)) !important;
      }
      [data-mmw-deck-card][data-mmw-deck-kind="social-post"] {
        grid-template-rows: minmax(10rem, 48vh) minmax(0, 1fr) auto !important;
        cursor: pointer !important;
      }
      [data-mmw-deck-card][data-mmw-deck-kind="social-post"][data-mmw-has-media="false"] { grid-template-rows: minmax(0, 1fr) auto !important; }
      [data-mmw-post-media] {
        display: grid !important;
        grid-auto-flow: column !important;
        grid-auto-columns: minmax(100%, 1fr) !important;
        width: 100% !important;
        min-height: 0 !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        background: color-mix(in srgb, var(--mmw-surface, #ffffff) 88%, var(--mmw-page-text, #202124)) !important;
        scroll-snap-type: x mandatory !important;
      }
      [data-mmw-post-media] img, [data-mmw-post-media] video {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        min-height: 0 !important;
        object-fit: contain !important;
        scroll-snap-align: center !important;
        background: #000 !important;
      }
      [data-mmw-deck-copy] { padding: 1.25rem !important; overflow: auto !important; }
      [data-mmw-deck-copy] h2 { margin: 0 0 .5rem !important; color: var(--mmw-page-text, #202124) !important; font-size: clamp(1.4rem, 4vw, 2.4rem) !important; }
      [data-mmw-deck-copy] p { margin: 0 0 1rem !important; color: color-mix(in srgb, var(--mmw-page-text, #202124) 74%, transparent) !important; }
      [data-mmw-post-author] { display: flex !important; align-items: center !important; gap: .55rem !important; margin: 0 0 .7rem !important; color: var(--mmw-page-text, #202124) !important; font-size: .9rem !important; font-weight: 750 !important; }
      [data-mmw-post-avatar] { width: 2rem !important; height: 2rem !important; flex: 0 0 2rem !important; border-radius: 50% !important; object-fit: cover !important; }
      [data-mmw-post-text] { color: var(--mmw-page-text, #202124) !important; font-size: clamp(1.15rem, 3.5vw, 1.8rem) !important; line-height: 1.45 !important; white-space: pre-wrap !important; }
      [data-mmw-post-drawer] {
        position: fixed !important;
        inset: 0 auto 0 0 !important;
        width: min(34rem, calc(100vw - 2rem)) !important;
        max-width: calc(100vw - 2rem) !important;
        height: 100dvh !important;
        max-height: none !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
        border: 0 !important;
        border-right: 1px solid color-mix(in srgb, var(--mmw-page-text, #202124) 24%, transparent) !important;
        border-radius: 0 1rem 1rem 0 !important;
        color: var(--mmw-page-text, #202124) !important;
        background: var(--mmw-surface, #ffffff) !important;
        box-shadow: 0 1.5rem 5rem rgb(0 0 0 / .45) !important;
      }
      [data-mmw-post-drawer]::backdrop { background: rgb(0 0 0 / .62) !important; backdrop-filter: blur(2px) !important; }
      [data-mmw-post-drawer] > header { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 1rem !important; padding: .7rem .8rem !important; border-bottom: 1px solid rgb(148 163 184 / .28) !important; }
      [data-mmw-post-drawer] h2 { margin: 0 !important; color: inherit !important; font-size: 1rem !important; }
      [data-mmw-post-drawer] > header button { min-height: 2rem !important; padding: .3rem .65rem !important; }
      [data-mmw-post-drawer-body] { display: grid !important; gap: .8rem !important; padding: 1rem !important; overflow: auto !important; }
      [data-mmw-post-drawer-body] p { margin: 0 !important; color: inherit !important; white-space: pre-wrap !important; }
      [data-mmw-post-drawer-note] { color: color-mix(in srgb, var(--mmw-page-text, #202124) 68%, transparent) !important; font-size: .8rem !important; }
      [data-mmw-post-actions] { display: flex !important; align-items: center !important; justify-content: space-around !important; gap: .35rem !important; padding: .45rem .7rem !important; border-top: 1px solid rgb(148 163 184 / .25) !important; background: var(--mmw-surface, #ffffff) !important; }
      [data-mmw-deck] [data-mmw-post-actions] button { min-width: 0 !important; min-height: 2rem !important; padding: .3rem .6rem !important; border: 0 !important; color: var(--mmw-page-text, #202124) !important; background: transparent !important; font-size: .78rem !important; font-weight: 650 !important; }
      [data-mmw-deck] [data-mmw-post-actions] button:hover { background: color-mix(in srgb, var(--mmw-accent, #1d4ed8) 12%, transparent) !important; }
      [data-mmw-deck] button, [data-mmw-deck] a {
        min-height: 2.75rem !important;
        padding: .65rem 1rem !important;
        border: 2px solid var(--mmw-accent, #1d4ed8) !important;
        border-radius: 999px !important;
        color: #fff !important;
        background: var(--mmw-accent, #1d4ed8) !important;
        font: inherit !important;
        font-weight: 750 !important;
        text-decoration: none !important;
        cursor: pointer !important;
      }
      [data-mmw-deck] [data-mmw-deck-header] button {
        min-height: 1.7rem !important;
        padding: .15rem .55rem !important;
        border-width: 1px !important;
        border-color: currentColor !important;
        border-radius: .45rem !important;
        color: inherit !important;
        background: transparent !important;
        font-size: .7rem !important;
        font-weight: 650 !important;
      }
      [data-mmw-deck] [data-mmw-deck-header] button:hover { background: rgb(148 163 184 / .16) !important; }
      [data-mmw-deck][data-mmw-deck-controls="sides"] [data-mmw-deck-card] { width: min(84vw, 54rem) !important; }
      [data-mmw-deck][data-mmw-deck-image="compact"] [data-mmw-deck-card] { grid-template-rows: minmax(8rem, 34vh) minmax(0, 1fr) auto !important; }
      [data-mmw-deck][data-mmw-deck-image="compact"] [data-mmw-deck-card][data-mmw-deck-kind="social-post"][data-mmw-has-media="false"] { grid-template-rows: minmax(0, 1fr) auto !important; }
      [data-mmw-deck][data-mmw-deck-link="footer"] [data-mmw-deck-copy] { display: flex !important; min-height: 12rem !important; flex-direction: column !important; }
      [data-mmw-deck][data-mmw-deck-link="footer"] [data-mmw-deck-copy] > a {
        min-height: 2.15rem !important;
        align-self: flex-start !important;
        margin-top: auto !important;
        padding: .4rem .7rem !important;
        font-size: .82rem !important;
      }
      [data-mmw-deck] [data-mmw-deck-side] {
        position: absolute !important;
        top: 50% !important;
        z-index: 3 !important;
        display: grid !important;
        width: 2.65rem !important;
        min-width: 2.65rem !important;
        height: 2.65rem !important;
        min-height: 2.65rem !important;
        place-items: center !important;
        padding: 0 !important;
        transform: translateY(-50%) !important;
        border: 1px solid rgb(255 255 255 / .72) !important;
        border-radius: 50% !important;
        color: #ffffff !important;
        background: var(--mmw-accent, rgb(32 33 35 / .82)) !important;
        box-shadow: 0 .35rem 1rem rgb(0 0 0 / .28) !important;
        font-size: 1.15rem !important;
        backdrop-filter: blur(8px) !important;
      }
      [data-mmw-deck] [data-mmw-deck-side="previous"] { left: clamp(.35rem, 2vw, 1.25rem) !important; }
      [data-mmw-deck] [data-mmw-deck-side="next"] { right: clamp(.35rem, 2vw, 1.25rem) !important; }
      [data-mmw-deck][data-mmw-deck-controls="sides"] [data-mmw-deck-footer] {
        justify-content: center !important;
        padding: .35rem .75rem !important;
        font-size: .75rem !important;
      }
      [data-mmw-deck] :focus-visible {
        outline: 3px solid #f59e0b !important;
        outline-offset: 3px !important;
      }`
    : "";
  const theme = patch.themePreset === "warm-hospitality"
    ? `
      body { background-color: #fffaf7 !important; color: #292524 !important; }
      [data-mmw-deck] { color: #292524 !important; background: #fffaf7 !important; }
      [data-mmw-deck-header], [data-mmw-deck-footer] { color: #292524 !important; background: #ffffff !important; border-color: #eadfd9 !important; }
      [data-mmw-deck-card] { color: #292524 !important; background: #ffffff !important; border-color: #eadfd9 !important; border-radius: 1.75rem !important; box-shadow: 0 1rem 2.8rem rgb(77 52 44 / .14) !important; }
      [data-mmw-deck-copy] h2 { color: #292524 !important; }
      [data-mmw-deck-copy] p { color: #625752 !important; }
      [data-mmw-deck] button, [data-mmw-deck] a { color: #ffffff !important; background: #c65368 !important; border-color: #c65368 !important; }
    `
    : patch.themePreset === "clean-minimal"
      ? `
        body { background-color: #f5f5f7 !important; color: #1d1d1f !important; }
        [data-mmw-deck] { color: #1d1d1f !important; background: #f5f5f7 !important; }
        [data-mmw-deck-header], [data-mmw-deck-footer] { color: #1d1d1f !important; background: rgb(255 255 255 / .9) !important; }
        [data-mmw-deck-card] { color: #1d1d1f !important; background: #ffffff !important; border-color: #d2d2d7 !important; border-radius: 1.5rem !important; box-shadow: 0 1rem 3rem rgb(0 0 0 / .1) !important; }
        [data-mmw-deck-copy] h2 { color: #1d1d1f !important; }
        [data-mmw-deck-copy] p { color: #515154 !important; }
        [data-mmw-deck] button, [data-mmw-deck] a { color: #ffffff !important; background: #2457a6 !important; border-color: #2457a6 !important; }
      `
      : patch.themePreset === "bold-dark"
        ? `
          body, [data-mmw-deck] { color: #f8fafc !important; background: #0b0f14 !important; }
          [data-mmw-deck-header], [data-mmw-deck-footer] { color: #f8fafc !important; background: #111820 !important; }
          [data-mmw-deck-card] { color: #f8fafc !important; background: #17212b !important; border-color: #354553 !important; border-radius: 1.4rem !important; box-shadow: 0 1.2rem 3rem rgb(0 0 0 / .5) !important; }
          [data-mmw-deck-copy] h2 { color: #ffffff !important; }
          [data-mmw-deck-copy] p { color: #cbd5e1 !important; }
          [data-mmw-deck] button, [data-mmw-deck] a { color: #07120a !important; background: #62d789 !important; border-color: #62d789 !important; }
        `
        : patch.themePreset === "paper-editorial"
          ? `
            body, [data-mmw-deck] { color: #24221f !important; background: #f4f1e9 !important; font-family: Georgia, "Times New Roman", serif !important; }
            [data-mmw-deck-header], [data-mmw-deck-footer] { color: #24221f !important; background: #ebe5da !important; }
            [data-mmw-deck-card] { color: #24221f !important; background: #fffdf8 !important; border-color: #d2c8b8 !important; border-radius: .5rem !important; box-shadow: 0 .8rem 2.2rem rgb(70 61 48 / .13) !important; }
            [data-mmw-deck-copy] h2 { color: #24221f !important; }
            [data-mmw-deck-copy] p { color: #5f584f !important; }
            [data-mmw-deck] button, [data-mmw-deck] a { color: #ffffff !important; background: #355b4c !important; border-color: #355b4c !important; }
          `
          : "";

  return `
    :root { ${fontSize} ${lineHeight} ${letterSpacing} ${color} ${contrast} }
    ${width}
    ${articleLayout}
    ${theme}
    ${headingColor}
    ${focus}
    ${motion}
    ${hidden}
  `;
}
