import type { AdaptationPatch } from "./types";

declare global {
  interface Window { __MATCH_MY_WEB_SHADOW_HOOK__?: boolean; }
}

if (!window.__MATCH_MY_WEB_SHADOW_HOOK__) {
  window.__MATCH_MY_WEB_SHADOW_HOOK__ = true;
  const roots = new Set<ShadowRoot>();
  let activePatch: AdaptationPatch | null = null;
  const originalAttachShadow = Element.prototype.attachShadow;

  function safePatch(value: unknown): AdaptationPatch | null {
    if (!value || typeof value !== "object") return null;
    const input = value as Record<string, unknown>;
    const number = (key: string, min: number, max: number): number | null =>
      typeof input[key] === "number" && Number.isFinite(input[key]) ? Math.min(max, Math.max(min, input[key] as number)) : null;
    return {
      fontScale: number("fontScale", 0.8, 2),
      lineHeight: number("lineHeight", 1.1, 2.5),
      letterSpacingEm: number("letterSpacingEm", 0, 0.12),
      contentMaxWidthRem: number("contentMaxWidthRem", 30, 100),
      headingColor: typeof input.headingColor === "string" && (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(input.headingColor) || /^(?:black|white|gr[ae]y|red|orange|yellow|green|blue|purple|pink|brown|navy|teal|maroon)$/i.test(input.headingColor))
        ? input.headingColor.toLowerCase()
        : null,
      articleLayout: input.articleLayout === "swipe-cards" ? "swipe-cards" : "unchanged",
      deckControls: input.articleLayout === "swipe-cards" && input.deckControls === "sides" ? "sides" : "unchanged",
      deckImageSize: input.articleLayout === "swipe-cards" && input.deckImageSize === "compact" ? "compact" : "unchanged",
      deckLinkPosition: input.articleLayout === "swipe-cards" && input.deckLinkPosition === "footer" ? "footer" : "unchanged",
      colorVisionMode: input.colorVisionMode === "avoid-red" ? "avoid-red" : "unchanged",
      themePreset: input.themePreset === "warm-hospitality"
        || input.themePreset === "clean-minimal"
        || input.themePreset === "bold-dark"
        || input.themePreset === "paper-editorial"
        ? input.themePreset
        : "unchanged",
      colorScheme: input.colorScheme === "dark" || input.colorScheme === "light" ? input.colorScheme : "unchanged",
      contrast: input.contrast === "more" ? "more" : "unchanged",
      reduceMotion: input.reduceMotion === true,
      strongFocus: input.strongFocus === true,
      hideSponsoredContent: input.hideSponsoredContent === true,
      hideVideoPosts: input.hideVideoPosts === true,
      feedFilterTerms: Array.isArray(input.feedFilterTerms)
        ? input.feedFilterTerms.filter((item): item is string => typeof item === "string").slice(0, 8)
        : [],
      hideSelectors: Array.isArray(input.hideSelectors)
        ? input.hideSelectors.filter((item): item is string => typeof item === "string" && /^[.#a-zA-Z][\w .#>+~:-]*$/.test(item)).slice(0, 12)
        : [],
    };
  }

  function shadowCss(patch: AdaptationPatch): string {
    const hidden = patch.hideSelectors.length ? `${patch.hideSelectors.join(",")} { display: none !important; }` : "";
    const fontSize = patch.fontScale === null ? "" : `font-size: ${patch.fontScale}em !important;`;
    const lineHeight = patch.lineHeight === null ? "" : `line-height: ${patch.lineHeight} !important;`;
    const letterSpacing = patch.letterSpacingEm === null ? "" : `letter-spacing: ${patch.letterSpacingEm}em !important;`;
    const headingColor = patch.headingColor === null ? "" : `:where(h1,h2,h3,[role="heading"]),:where(h1,h2,h3,[role="heading"]) * { color: ${patch.headingColor} !important; }`;
    return `
      :host { ${fontSize} ${lineHeight} ${letterSpacing} ${patch.colorScheme === "unchanged" ? "" : `color-scheme: ${patch.colorScheme} !important;`} }
      ${patch.strongFocus ? `:focus-visible { outline: 3px solid #f59e0b !important; outline-offset: 3px !important; }` : ""}
      ${patch.reduceMotion ? `*,*::before,*::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .01ms !important; }` : ""}
      ${headingColor}
      ${hidden}`;
  }

  function applyToRoot(root: ShadowRoot): void {
    let style = root.querySelector<HTMLStyleElement>("style[data-match-my-web]");
    if (!style) {
      style = document.createElement("style");
      style.dataset.matchMyWeb = "true";
      root.append(style);
    }
    style.textContent = activePatch ? shadowCss(activePatch) : "";
  }

  Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
    const root = originalAttachShadow.call(this, init);
    roots.add(root);
    if (activePatch) queueMicrotask(() => applyToRoot(root));
    return root;
  };

  window.addEventListener("match-my-web:shadow-patch", (event) => {
    if (!(event instanceof CustomEvent)) return;
    activePatch = safePatch(event.detail?.patch);
    roots.forEach(applyToRoot);
    document.querySelectorAll("*").forEach((element) => {
      if (element.shadowRoot) {
        roots.add(element.shadowRoot);
        applyToRoot(element.shadowRoot);
      }
    });
  });
}
