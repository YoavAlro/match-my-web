import { buildAdaptationCss } from "./adaptation-css";
import { domSignalRelevance, isSponsoredMarker, isSponsoredMetadata } from "./feed-filter";
import { changesEffectiveDesign, mergeAdaptationPatches } from "./patch-merge";
import {
  parseExpectedRevision,
  parseRealPagePreviewInput,
  parseRealPageWebMcpRequest,
  REAL_PAGE_WEBMCP_ACTIVATE_EVENT,
  REAL_PAGE_WEBMCP_REQUEST_EVENT,
  REAL_PAGE_WEBMCP_RESPONSE_EVENT,
  type RealPageWebMcpRequest,
  type RealPageWebMcpResponse,
} from "./real-page-webmcp";
import { DEFAULT_PATCH, hasAdaptationChanges, type AdaptationPatch, type ApplyReport, type AutomationAsset, type ExtensionMessage, type MessageResult, type PageContext, type PageSnapshot, type SiteProfile } from "./types";
import { validatePatch } from "./validation";

declare global {
  interface Window { __MATCH_MY_WEB_CONTENT__?: boolean; }
}

if (!window.__MATCH_MY_WEB_CONTENT__) {
  window.__MATCH_MY_WEB_CONTENT__ = true;
  const documentToken = crypto.randomUUID();
  let navigationToken = crypto.randomUUID();
  let trackedUrl = location.href;
  let approvedPatch: AdaptationPatch | null = null;
  let previewPatch: AdaptationPatch | null = null;
  let webMcpRevision = 0;
  let previewMetadata: { id: string; summary: string; createdAt: string; source: "webmcp" | "chat" } | null = null;
  type StyledElement = HTMLElement | SVGElement;
  type SavedDeclaration = { value: string; priority: string };
  const changedColors = new Map<StyledElement, Map<string, SavedDeclaration>>();
  let colorObserver: MutationObserver | null = null;
  let feedFilterObserver: MutationObserver | null = null;
  let feedFilterTimer: number | null = null;
  let navigationObserver: MutationObserver | null = null;
  let activeDeck: HTMLElement | null = null;
  let activeDeckRestorers: Array<() => void> = [];

  function context(): PageContext {
    return {
      tabId: -1,
      documentToken,
      navigationToken,
      url: location.href,
      origin: location.origin,
      title: document.title,
    };
  }

  function contextMatches(expected: PageContext): boolean {
    return expected.documentToken === documentToken
      && expected.navigationToken === navigationToken
      && expected.url === location.href;
  }

  function applyPatch(patch: AdaptationPatch | null): ApplyReport {
    clearDomTransformations();
    let style = document.getElementById("match-my-web-root") as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "match-my-web-root";
      (document.head ?? document.documentElement).append(style);
    }
    style.textContent = patch ? buildAdaptationCss(patch) : "";
    const details: string[] = [];
    let affectedElements = 0;
    if (patch?.articleLayout === "swipe-cards") {
      const deck = applySwipeDeck(patch);
      if (deck) {
        affectedElements += deck.count;
        const itemName = deck.kind === "social-post" ? "visible posts" : "articles";
        details.push(`Built a full-page swipe deck from ${deck.count} ${itemName}.`);
        details.push("Enabled touch swiping, mouse dragging, and keyboard arrow navigation.");
        if (deck.kind === "social-post") {
          details.push("Preserved post authors, text, avatars, and visible media; live page videos retain playback controls.");
          details.push("Added available Comments, Repost, and Like controls to each card footer.");
          details.push("Comments open a left-side details sheet with a private link to the original conversation; unseen replies are not fetched.");
        }
        if (patch.deckControls === "sides") details.push("Placed previous and next controls beside the cards.");
        if (patch.deckImageSize === "compact") details.push("Reduced media height to create more room for content.");
        if (deck.kind === "article" && patch.deckLinkPosition === "footer") details.push("Placed the Open article action at the bottom of each card.");
      } else {
        details.push("No usable social posts or article links were found on the current page.");
      }
    }
    if (patch?.headingColor) {
      const headings = document.querySelectorAll("h1, h2, h3, [role='heading']").length;
      affectedElements += headings;
      details.push(`Changed ${headings} heading${headings === 1 ? "" : "s"} to ${patch.headingColor}.`);
    }
    if (patch?.colorVisionMode === "avoid-red") {
      const remapped = applyRedAvoidance();
      affectedElements += remapped;
      details.push(`Remapped red interface colors on ${remapped} element${remapped === 1 ? "" : "s"}.`);
    }
    if (patch?.colorVisionMode === "avoid-blue") {
      const remapped = applyBlueAvoidance();
      affectedElements += remapped;
      details.push(`Remapped blue interface colors on ${remapped} element${remapped === 1 ? "" : "s"}.`);
    }
    if (patch?.hideSponsoredContent || patch?.hideVideoPosts || patch?.feedFilterTerms?.length || patch?.automationAssets?.length) {
      const feedFilterTerms = patch.feedFilterTerms ?? [];
      const automationAssets = patch.automationAssets ?? [];
      const hidden = applyFeedFilters(patch.hideSponsoredContent === true, patch.hideVideoPosts === true, feedFilterTerms, automationAssets);
      affectedElements += Math.max(1, hidden.total);
      if (patch.hideSponsoredContent) {
        details.push(`Enabled sponsored-content filtering; scanned ${hidden.scanned} feed container${hidden.scanned === 1 ? "" : "s"} and matched ${hidden.sponsored} sponsored item${hidden.sponsored === 1 ? "" : "s"}.`);
        details.push(feedDiagnostics());
      }
      if (patch.hideVideoPosts) {
        details.push(`Enabled video-post filtering; currently matched ${hidden.video} feed item${hidden.video === 1 ? "" : "s"} containing video.`);
      }
      if (feedFilterTerms.length) {
        details.push(`Applied the observed feed marker rule for: ${feedFilterTerms.join(", ")}.`);
      }
      for (const asset of automationAssets) {
        details.push(`Enabled automation “${asset.name}” on page load${asset.triggers.includes("dom-mutation") ? " and new page content" : ""}.`);
      }
      if (automationAssets.length) {
        details.push(`Automation evidence matched ${hidden.automation} item${hidden.automation === 1 ? "" : "s"} currently on the page.`);
      }
    }
    if (patch && patch.themePreset && patch.themePreset !== "unchanged") {
      affectedElements += 1;
      details.push(`Applied the ${patch.themePreset.replace(/-/g, " ")} visual theme.`);
    }
    if (patch && (patch.fontScale !== null || patch.lineHeight !== null || patch.letterSpacingEm !== null || patch.contentMaxWidthRem !== null || patch.colorScheme !== "unchanged" || patch.contrast !== "unchanged" || patch.reduceMotion || patch.strongFocus || patch.hideSelectors.length)) {
      affectedElements += 1;
      details.push("Applied the requested document-level display settings.");
    }
    window.dispatchEvent(new CustomEvent("match-my-web:shadow-patch", { detail: { patch } }));
    return { applied: patch === null || affectedElements > 0, affectedElements, details };
  }

  function clearDomTransformations(): void {
    colorObserver?.disconnect();
    colorObserver = null;
    feedFilterObserver?.disconnect();
    feedFilterObserver = null;
    if (feedFilterTimer !== null) window.clearTimeout(feedFilterTimer);
    feedFilterTimer = null;
    for (const [element, saved] of filteredFeedElements) {
      if (saved.value) element.style.setProperty("display", saved.value, saved.priority);
      else element.style.removeProperty("display");
      element.removeAttribute("data-mmw-feed-hidden");
    }
    filteredFeedElements.clear();
    for (const [element, properties] of changedColors) {
      for (const [property, saved] of properties) {
        if (saved.value) element.style.setProperty(property, saved.value, saved.priority);
        else element.style.removeProperty(property);
      }
    }
    changedColors.clear();
    for (const restore of activeDeckRestorers.splice(0).reverse()) restore();
    activeDeck?.remove();
    activeDeck = null;
    document.documentElement.removeAttribute("data-mmw-deck-active");
  }

  interface ArticleRecord {
    kind: "article";
    title: string;
    description: string;
    href: string;
    imageUrl: string;
  }

  interface SocialPostRecord {
    kind: "social-post";
    author: string;
    text: string;
    href: string;
    imageUrls: string[];
    videoUrl: string;
    videoPoster: string;
    avatarUrl: string;
    sourceVideo: HTMLVideoElement | null;
    actions: {
      reply: HTMLElement | null;
      repost: HTMLElement | null;
      like: HTMLElement | null;
    };
  }

  type DeckRecord = ArticleRecord | SocialPostRecord;

  interface DeckBuildResult {
    count: number;
    kind: DeckRecord["kind"];
  }

  function extractArticles(): ArticleRecord[] {
    const articles: ArticleRecord[] = [];
    const seen = new Set<string>();
    const headings = Array.from(document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, [role='heading'], [data-tb-title], .slotTitle"));
    for (const heading of headings) {
      const container = heading.closest<HTMLElement>("article, [data-tb-region-item], .slotView, li") ?? heading.parentElement;
      const link = heading.closest<HTMLAnchorElement>("a[href]") ?? container?.querySelector<HTMLAnchorElement>("a[href]");
      if (!link) continue;
      let href: string;
      try {
        href = new URL(link.href, location.href).href;
      } catch {
        continue;
      }
      if (!/^https?:/i.test(href) || seen.has(href)) continue;
      const title = cleanText(heading.innerText || heading.textContent).slice(0, 240);
      if (title.length < 8) continue;
      const source = container ?? link.parentElement ?? heading;
      const descriptionElement = source.querySelector<HTMLElement>(".slotSubTitle, [data-tb-subtitle], p, [class*='subtitle' i], [class*='description' i]");
      const description = cleanText(descriptionElement?.innerText || descriptionElement?.textContent).slice(0, 420);
      const image = source.querySelector<HTMLImageElement>("img") ?? link.querySelector<HTMLImageElement>("img");
      const imageUrl = image?.currentSrc || image?.src || "";
      seen.add(href);
      articles.push({ kind: "article", title, description, href, imageUrl });
      if (articles.length >= 60) break;
    }
    return articles;
  }

  function safePageMediaUrl(value: string | null | undefined): string {
    const url = value?.trim() ?? "";
    return /^(?:https?:|blob:)/i.test(url) ? url : "";
  }

  function extractSocialPosts(): SocialPostRecord[] {
    const posts: SocialPostRecord[] = [];
    const seen = new Set<string>();
    const candidates = Array.from(document.querySelectorAll<HTMLElement>("article[data-testid='tweet'], article[role='article']"));
    for (const article of candidates) {
      const textElement = article.querySelector<HTMLElement>("[data-testid='tweetText'], [data-testid='postText']");
      const authorElement = article.querySelector<HTMLElement>("[data-testid='User-Name'], [data-testid='user-name'], header");
      const statusLink = article.querySelector<HTMLAnchorElement>("a[href*='/status/'], a[href*='/posts/']");
      const text = cleanText(textElement?.innerText || textElement?.textContent).slice(0, 4000);
      const author = cleanText(authorElement?.innerText || authorElement?.textContent).slice(0, 300) || "Post author";
      const imageUrls = [...new Set(Array.from(article.querySelectorAll<HTMLImageElement>("[data-testid='tweetPhoto'] img, [data-testid='postPhoto'] img"))
        .map((image) => safePageMediaUrl(image.currentSrc || image.src))
        .filter(Boolean))].slice(0, 4);
      const sourceVideo = article.querySelector<HTMLVideoElement>("video");
      const videoUrl = safePageMediaUrl(sourceVideo?.currentSrc || sourceVideo?.src || sourceVideo?.querySelector<HTMLSourceElement>("source")?.src);
      const videoPoster = safePageMediaUrl(sourceVideo?.poster);
      const avatar = article.querySelector<HTMLImageElement>("[data-testid^='UserAvatar-Container'] img, [data-testid='Tweet-User-Avatar'] img");
      const avatarUrl = safePageMediaUrl(avatar?.currentSrc || avatar?.src);
      const actions = {
        reply: article.querySelector<HTMLElement>("[data-testid='reply']"),
        repost: article.querySelector<HTMLElement>("[data-testid='retweet'], [data-testid='unretweet']"),
        like: article.querySelector<HTMLElement>("[data-testid='like'], [data-testid='unlike']"),
      };
      if (!text && !imageUrls.length && !videoUrl && !videoPoster) continue;
      let href = "";
      try {
        if (statusLink?.href) href = new URL(statusLink.href, location.href).href;
      } catch {
        href = "";
      }
      const identity = href || `${author}|${text.slice(0, 400)}`;
      if (!identity || seen.has(identity)) continue;
      seen.add(identity);
      posts.push({ kind: "social-post", author, text, href, imageUrls, videoUrl, videoPoster, avatarUrl, sourceVideo: sourceVideo ?? null, actions });
      if (posts.length >= 60) break;
    }
    return posts;
  }

  function createPostMedia(post: SocialPostRecord): HTMLElement | null {
    if (!post.imageUrls.length && !post.videoUrl && !post.videoPoster) return null;
    const media = document.createElement("div");
    media.dataset.mmwPostMedia = "true";
    if (post.sourceVideo?.parentNode) {
      const video = post.sourceVideo;
      const originalParent = video.parentNode!;
      const originalNextSibling = video.nextSibling;
      const placeholder = document.createComment("tweaksy-video-placeholder");
      const hadControls = video.controls;
      const hadPlaysInline = video.playsInline;
      const previousAriaLabel = video.getAttribute("aria-label");
      originalParent.replaceChild(placeholder, video);
      video.controls = true;
      video.playsInline = true;
      video.setAttribute("aria-label", "Video attached to this post");
      media.append(video);
      activeDeckRestorers.push(() => {
        video.controls = hadControls;
        video.playsInline = hadPlaysInline;
        if (previousAriaLabel === null) video.removeAttribute("aria-label");
        else video.setAttribute("aria-label", previousAriaLabel);
        if (placeholder.parentNode) placeholder.parentNode.replaceChild(video, placeholder);
        else if (originalParent.isConnected) originalParent.insertBefore(video, originalNextSibling?.parentNode === originalParent ? originalNextSibling : null);
      });
    } else if (post.videoUrl) {
      const video = document.createElement("video");
      video.src = post.videoUrl;
      if (post.videoPoster) video.poster = post.videoPoster;
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.setAttribute("aria-label", "Video attached to this post");
      media.append(video);
    } else if (post.videoPoster) {
      const preview = document.createElement("img");
      preview.src = post.videoPoster;
      preview.alt = "Preview image for a video attached to this post";
      preview.loading = "lazy";
      media.append(preview);
    }
    for (const imageUrl of post.imageUrls) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = "Image attached to this post";
      image.loading = "lazy";
      media.append(image);
    }
    return media;
  }

  function createTweaksyMark(): SVGSVGElement {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 128 128");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.dataset.mmwBrandMark = "true";

    const body = document.createElementNS(namespace, "path");
    body.setAttribute("d", "M29 104C16 95 13 78 19 64c4-10 3-22 9-33 7-14 22-17 35-13 12 4 20-7 33-3 15 5 19 22 12 36-4 8 3 15 2 28-1 19-15 31-33 30-15-1-25 5-38 0-4-1-7-3-10-5Z");
    body.setAttribute("stroke-width", "4");
    body.setAttribute("stroke-linejoin", "round");
    body.dataset.mmwMarkBody = "true";

    const leftEye = document.createElementNS(namespace, "ellipse");
    leftEye.setAttribute("cx", "46");
    leftEye.setAttribute("cy", "61");
    leftEye.setAttribute("rx", "5");
    leftEye.setAttribute("ry", "7");
    leftEye.dataset.mmwMarkFace = "true";

    const rightEye = leftEye.cloneNode(false) as SVGEllipseElement;
    rightEye.setAttribute("cx", "80");

    const smile = document.createElementNS(namespace, "path");
    smile.setAttribute("d", "M47 78c5 6 11 9 17 9s12-3 17-9");
    smile.setAttribute("fill", "none");
    smile.setAttribute("stroke-width", "5");
    smile.setAttribute("stroke-linecap", "round");
    smile.dataset.mmwMarkFace = "true";

    svg.append(body, leftEye, rightEye, smile);
    return svg;
  }

  function applySwipeDeck(patch: AdaptationPatch): DeckBuildResult | null {
    const posts = extractSocialPosts();
    const records: DeckRecord[] = posts.length ? posts : extractArticles();
    if (!records.length) return null;
    const kind: DeckRecord["kind"] = posts.length ? "social-post" : "article";
    const itemName = kind === "social-post" ? "post" : "article";
    const controls = patch.deckControls;
    const bodyStyle = getComputedStyle(document.body);
    const rootStyle = getComputedStyle(document.documentElement);
    const sourceSurface = document.querySelector<HTMLElement>("article, [data-tb-region-item], .slotView");
    const sourceLink = document.querySelector<HTMLElement>("a[href]");
    const opaqueBackground = (...values: string[]): string => values.find((value) => value && value !== "transparent" && !/^rgba\([^)]*,\s*0\s*\)$/i.test(value)) ?? "#ffffff";
    const pageBackground = opaqueBackground(bodyStyle.backgroundColor, rootStyle.backgroundColor, "#ffffff");
    const surfaceBackground = opaqueBackground(sourceSurface ? getComputedStyle(sourceSurface).backgroundColor : "", pageBackground);
    const pageText = bodyStyle.color || rootStyle.color || "#202124";
    const pageAccent = sourceLink ? getComputedStyle(sourceLink).color : "#1d4ed8";
    const deck = document.createElement("main");
    deck.dataset.mmwDeck = "true";
    deck.dataset.mmwDeckControls = controls;
    deck.dataset.mmwDeckImage = patch.deckImageSize;
    deck.dataset.mmwDeckLink = patch.deckLinkPosition;
    deck.style.setProperty("--mmw-page-bg", pageBackground);
    deck.style.setProperty("--mmw-surface", surfaceBackground);
    deck.style.setProperty("--mmw-page-text", pageText);
    deck.style.setProperty("--mmw-accent", pageAccent);
    deck.setAttribute("aria-label", `Tweaksy swipeable ${itemName} view`);

    const header = document.createElement("header");
    header.dataset.mmwDeckHeader = "true";
    const brand = document.createElement("strong");
    brand.append(createTweaksyMark(), document.createTextNode("Modified by Tweaksy"));
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Back";
    close.setAttribute("aria-label", "Return to the original page view");
    close.title = "Return to original page";
    close.addEventListener("click", () => {
      previewPatch = null;
      approvedPatch = null;
      applyPatch(null);
    });
    header.append(brand, close);

    const track = document.createElement("div");
    track.dataset.mmwDeckTrack = "true";
    track.tabIndex = 0;
    track.setAttribute("role", "list");
    track.setAttribute("aria-label", `${records.length} ${itemName}${records.length === 1 ? "" : "s"}. Swipe, drag horizontally, or use the arrow keys.`);

    const drawer = document.createElement("dialog");
    drawer.dataset.mmwPostDrawer = "true";
    drawer.setAttribute("aria-labelledby", "mmw-post-drawer-title");
    const drawerHeader = document.createElement("header");
    const drawerTitle = document.createElement("h2");
    drawerTitle.id = "mmw-post-drawer-title";
    drawerTitle.textContent = "Post and comments";
    const drawerClose = document.createElement("button");
    drawerClose.type = "button";
    drawerClose.textContent = "Close";
    drawerClose.addEventListener("click", () => drawer.close());
    drawerHeader.append(drawerTitle, drawerClose);
    const drawerBody = document.createElement("div");
    drawerBody.dataset.mmwPostDrawerBody = "true";
    drawer.append(drawerHeader, drawerBody);
    drawer.addEventListener("click", (event) => {
      if (event.target === drawer) drawer.close();
    });

    const openPostDrawer = (post: SocialPostRecord): void => {
      const author = document.createElement("strong");
      author.textContent = post.author;
      const text = document.createElement("p");
      text.textContent = post.text || "This post contains media without visible text.";
      const note = document.createElement("p");
      note.dataset.mmwPostDrawerNote = "true";
      note.textContent = "Comments that are not already visible on this page stay private and are not fetched by Tweaksy.";
      drawerBody.replaceChildren(author, text, note);
      if (post.href) {
        const open = document.createElement("a");
        open.href = post.href;
        open.textContent = "View comments on X";
        drawerBody.append(open);
      }
      drawer.showModal();
      drawerClose.focus();
    };

    for (const record of records) {
      const card = document.createElement("article");
      card.dataset.mmwDeckCard = "true";
      card.dataset.mmwDeckKind = record.kind;
      card.setAttribute("role", "listitem");
      const copy = document.createElement("div");
      copy.dataset.mmwDeckCopy = "true";
      copy.dir = "auto";
      let cardFooter: HTMLElement | null = null;
      if (record.kind === "social-post") {
        const media = createPostMedia(record);
        card.dataset.mmwHasMedia = media ? "true" : "false";
        if (media) card.append(media);
        const author = document.createElement("div");
        author.dataset.mmwPostAuthor = "true";
        if (record.avatarUrl) {
          const avatar = document.createElement("img");
          avatar.src = record.avatarUrl;
          avatar.alt = "";
          avatar.loading = "lazy";
          avatar.dataset.mmwPostAvatar = "true";
          author.append(avatar);
        }
        const authorName = document.createElement("span");
        authorName.textContent = record.author;
        author.append(authorName);
        const postText = document.createElement("p");
        postText.dataset.mmwPostText = "true";
        postText.textContent = record.text || "This post contains media without visible text.";
        copy.append(author, postText);
        const actionFooter = document.createElement("footer");
        actionFooter.dataset.mmwPostActions = "true";
        const actionText = (source: HTMLElement | null, fallback: string): string => {
          const accessibleName = cleanText(source?.getAttribute("aria-label"));
          const count = accessibleName.match(/\b\d[\d,.]*\b/)?.[0];
          return count ? `${fallback} ${count}` : fallback;
        };
        const comments = document.createElement("button");
        comments.type = "button";
        comments.textContent = actionText(record.actions.reply, "Comments");
        comments.addEventListener("click", () => openPostDrawer(record));
        actionFooter.append(comments);
        const proxyAction = (source: HTMLElement | null, label: string): void => {
          if (!source) return;
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = actionText(source, label);
          button.addEventListener("click", (event) => {
            event.stopPropagation();
            source.click();
            window.setTimeout(() => { button.textContent = actionText(source, label); }, 150);
          });
          actionFooter.append(button);
        };
        proxyAction(record.actions.repost, "Repost");
        proxyAction(record.actions.like, "Like");
        cardFooter = actionFooter;
        card.tabIndex = 0;
        card.setAttribute("aria-label", `Post by ${record.author}. Open post details.`);
        card.addEventListener("click", (event) => {
          if ((event.target as Element).closest("a, button, video")) return;
          openPostDrawer(record);
        });
        card.addEventListener("keydown", (event) => {
          if ((event.target as Element).closest("a, button, video")) return;
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          openPostDrawer(record);
        });
      } else {
        if (record.imageUrl) {
          const image = document.createElement("img");
          image.src = record.imageUrl;
          image.alt = "";
          image.loading = "lazy";
          card.append(image);
        } else {
          const imagePlaceholder = document.createElement("div");
          imagePlaceholder.setAttribute("aria-hidden", "true");
          card.append(imagePlaceholder);
        }
        const heading = document.createElement("h2");
        heading.textContent = record.title;
        copy.append(heading);
        if (record.description) {
          const description = document.createElement("p");
          description.textContent = record.description;
          copy.append(description);
        }
        const open = document.createElement("a");
        open.href = record.href;
        open.textContent = "Open article";
        copy.append(open);
      }
      card.append(copy);
      if (cardFooter) card.append(cardFooter);
      track.append(card);
    }

    const footer = document.createElement("footer");
    footer.dataset.mmwDeckFooter = "true";
    const previous = document.createElement("button");
    previous.type = "button";
    previous.textContent = controls === "sides" ? "←" : "← Previous";
    previous.setAttribute("aria-label", `Previous ${itemName}`);
    const counter = document.createElement("span");
    counter.setAttribute("aria-live", "polite");
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = controls === "sides" ? "→" : "Next →";
    next.setAttribute("aria-label", `Next ${itemName}`);
    const updateCounter = (): void => {
      const index = Math.min(records.length - 1, Math.max(0, Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));
      counter.textContent = `${index + 1} of ${records.length}`;
    };
    const move = (direction: number): void => track.scrollBy({ left: direction * track.clientWidth, behavior: "smooth" });
    previous.addEventListener("click", () => move(-1));
    next.addEventListener("click", () => move(1));
    track.addEventListener("scroll", updateCounter, { passive: true });
    track.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      move(event.key === "ArrowRight" ? 1 : -1);
    });
    let pointerId: number | null = null;
    let pointerStartX = 0;
    let pointerStartScroll = 0;
    let dragged = false;
    let suppressClick = false;
    const endDrag = (event: PointerEvent): void => {
      if (pointerId !== event.pointerId) return;
      if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
      pointerId = null;
      delete track.dataset.mmwDragging;
      if (!dragged) return;
      suppressClick = true;
      const page = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      track.scrollTo({ left: page * track.clientWidth, behavior: "smooth" });
      window.setTimeout(() => { suppressClick = false; }, 0);
    };
    track.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || (event.target as Element).closest("a, button, video")) return;
      pointerId = event.pointerId;
      pointerStartX = event.clientX;
      pointerStartScroll = track.scrollLeft;
      dragged = false;
      track.setPointerCapture(event.pointerId);
      track.dataset.mmwDragging = "true";
    });
    track.addEventListener("pointermove", (event) => {
      if (pointerId !== event.pointerId) return;
      const distance = event.clientX - pointerStartX;
      if (Math.abs(distance) > 5) dragged = true;
      track.scrollLeft = pointerStartScroll - distance;
    });
    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    track.addEventListener("click", (event) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
    }, { capture: true });
    if (controls === "sides") {
      previous.dataset.mmwDeckSide = "previous";
      next.dataset.mmwDeckSide = "next";
      footer.append(counter);
      deck.append(header, track, previous, next, footer);
    } else {
      footer.append(previous, counter, next);
      deck.append(header, track, footer);
    }
    if (kind === "social-post") deck.append(drawer);
    document.body.append(deck);
    document.documentElement.dataset.mmwDeckActive = "true";
    activeDeck = deck;
    updateCounter();
    queueMicrotask(() => track.focus());
    return { count: records.length, kind };
  }

  function redReplacement(value: string): string | null {
    const match = value.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)(?:\D+(\d*(?:\.\d+)?))?\s*\)$/i);
    if (!match) return null;
    const red = Number(match[1]);
    const green = Number(match[2]);
    const blue = Number(match[3]);
    const alpha = match[4] === undefined || match[4] === "" ? 1 : Number(match[4]);
    if (alpha === 0 || red < 90 || red <= green * 1.3 || red <= blue * 1.15) return null;
    const nextRed = Math.min(255, Math.round(green + red * 0.12));
    const nextGreen = Math.min(255, Math.round(green + red * 0.52));
    const nextBlue = Math.min(255, Math.round(blue + red * 0.82));
    return alpha < 1
      ? `rgba(${nextRed}, ${nextGreen}, ${nextBlue}, ${alpha})`
      : `rgb(${nextRed}, ${nextGreen}, ${nextBlue})`;
  }

  function blueReplacement(value: string): string | null {
    const match = value.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)(?:\D+(\d*(?:\.\d+)?))?\s*\)$/i);
    if (!match) return null;
    const red = Number(match[1]);
    const green = Number(match[2]);
    const blue = Number(match[3]);
    const alpha = match[4] === undefined || match[4] === "" ? 1 : Number(match[4]);
    if (alpha === 0 || blue < 90 || blue <= red * 1.15 || blue <= green * 1.08) return null;
    const nextRed = Math.min(255, Math.round(red + blue * 0.78));
    const nextGreen = Math.min(255, Math.round(green + blue * 0.42));
    const nextBlue = Math.min(255, Math.round(blue * 0.12 + green * 0.18));
    return alpha < 1
      ? `rgba(${nextRed}, ${nextGreen}, ${nextBlue}, ${alpha})`
      : `rgb(${nextRed}, ${nextGreen}, ${nextBlue})`;
  }

  function remapRedIn(root: ParentNode): void {
    const elements: StyledElement[] = [];
    if (root instanceof HTMLElement || root instanceof SVGElement) elements.push(root);
    elements.push(...Array.from(root.querySelectorAll<StyledElement>("*:not(script):not(style):not(noscript):not(template)")).slice(0, 2500));
    const properties = ["color", "background-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "fill", "stroke"];
    for (const element of elements) {
      const computed = getComputedStyle(element);
      for (const property of properties) {
        const replacement = redReplacement(computed.getPropertyValue(property));
        if (!replacement) continue;
        let saved = changedColors.get(element);
        if (!saved) {
          saved = new Map();
          changedColors.set(element, saved);
        }
        if (!saved.has(property)) {
          saved.set(property, { value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) });
        }
        element.style.setProperty(property, replacement, "important");
      }
    }
  }

  function applyRedAvoidance(): number {
    remapRedIn(document);
    colorObserver = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement || node instanceof SVGElement) remapRedIn(node);
        }
      }
    });
    colorObserver.observe(document.documentElement, { childList: true, subtree: true });
    return changedColors.size;
  }

  function applyBlueAvoidance(): number {
    const elements: StyledElement[] = [];
    elements.push(...Array.from(document.querySelectorAll<StyledElement>("*:not(script):not(style):not(noscript):not(template)")).slice(0, 2500));
    const properties = ["color", "background-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "fill", "stroke"];
    for (const element of elements) {
      const computed = getComputedStyle(element);
      for (const property of properties) {
        const replacement = blueReplacement(computed.getPropertyValue(property));
        if (!replacement) continue;
        let saved = changedColors.get(element);
        if (!saved) {
          saved = new Map();
          changedColors.set(element, saved);
        }
        if (!saved.has(property)) {
          saved.set(property, { value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) });
        }
        element.style.setProperty(property, replacement, "important");
      }
    }
    colorObserver = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement || node instanceof SVGElement) {
            const descendants = [node, ...Array.from(node.querySelectorAll<StyledElement>("*:not(script):not(style):not(noscript):not(template)"))];
            for (const element of descendants) {
              const computed = getComputedStyle(element);
              for (const property of properties) {
                const replacement = blueReplacement(computed.getPropertyValue(property));
                if (!replacement) continue;
                let saved = changedColors.get(element);
                if (!saved) {
                  saved = new Map();
                  changedColors.set(element, saved);
                }
                if (!saved.has(property)) saved.set(property, { value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) });
                element.style.setProperty(property, replacement, "important");
              }
            }
          }
        }
      }
    });
    colorObserver.observe(document.documentElement, { childList: true, subtree: true });
    return changedColors.size;
  }

  const filteredFeedElements = new Map<HTMLElement, SavedDeclaration>();
  const FEED_ITEM_SELECTOR = "article[data-testid='tweet'], [data-testid='tweet'], article, [role='article']";
  const SEMANTIC_FEED_WRAPPER_SELECTOR = "[aria-posinset], [aria-describedby]:not([aria-posinset])";

  function elementHasSponsoredMarker(element: HTMLElement): boolean {
    const metadata = [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-testid"),
    ];
    return metadata.some(isSponsoredMetadata)
      || isSponsoredMarker(element.innerText)
      || isSponsoredMarker(element.textContent)
      || isSponsoredMarker(renderedMarkerText(element));
  }

  function feedDiagnostics(): string {
    const hiddenBold = Array.from(document.querySelectorAll<HTMLElement>("b")).slice(0, 2000)
      .filter((element) => getComputedStyle(element).display === "none").length;
    return `Feed signals: ${document.querySelectorAll("[role='article']").length} articles, ${document.querySelectorAll(SEMANTIC_FEED_WRAPPER_SELECTOR).length} semantic wrappers, ${document.querySelectorAll("[role='feed'] > div").length} direct feed children, ${document.querySelectorAll("a[attributionsrc]").length} attribution links, ${document.querySelectorAll("[data-content]").length} generated-text fragments, and ${hiddenBold} hidden bold fragments.`;
  }

  function renderedMarkerText(root: HTMLElement, limit = 48): string {
    let result = "";
    const visit = (node: Node): void => {
      if (result.length >= limit) return;
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent ?? "";
        return;
      }
      if (!(node instanceof HTMLElement)) return;
      const style = getComputedStyle(node);
      if (node.hidden || node.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || Number(style.opacity) === 0) return;
      const dataContent = node.getAttribute("data-content");
      if (dataContent && !node.textContent?.trim()) result += dataContent;
      for (const child of node.childNodes) visit(child);
    };
    visit(root);
    return result.slice(0, limit);
  }

  function obfuscatedMarker(item: HTMLElement): boolean {
    const groups = new Set<HTMLElement>();
    for (const fragment of Array.from(item.querySelectorAll<HTMLElement>("b, [data-content]")).slice(0, 250)) {
      let candidate: HTMLElement | null = fragment;
      for (let depth = 0; candidate && candidate !== item && depth < 5; depth += 1) {
        groups.add(candidate);
        candidate = candidate.parentElement;
      }
    }
    return [...groups].slice(0, 500).some((group) => isSponsoredMarker(renderedMarkerText(group)));
  }

  function feedContainer(item: HTMLElement): HTMLElement {
    const semanticWrapper = item.closest<HTMLElement>(SEMANTIC_FEED_WRAPPER_SELECTOR);
    if (semanticWrapper) return semanticWrapper;
    const feed = item.closest<HTMLElement>("[role='feed']");
    if (!feed) return item;
    let directChild = item;
    while (directChild.parentElement && directChild.parentElement !== feed) directChild = directChild.parentElement;
    return directChild.parentElement === feed ? directChild : item;
  }

  function normalizedFeedItem(item: HTMLElement): HTMLElement {
    return feedContainer(item);
  }

  function feedItemsIn(root: ParentNode): HTMLElement[] {
    const items = new Set<HTMLElement>();
    if (root instanceof HTMLElement) {
      const closest = root.closest<HTMLElement>(FEED_ITEM_SELECTOR);
      if (closest) items.add(normalizedFeedItem(closest));
      if (root.matches(FEED_ITEM_SELECTOR)) items.add(normalizedFeedItem(root));
    }
    for (const item of root.querySelectorAll<HTMLElement>(FEED_ITEM_SELECTOR)) items.add(normalizedFeedItem(item));
    for (const wrapper of root.querySelectorAll<HTMLElement>(SEMANTIC_FEED_WRAPPER_SELECTOR)) {
      if (wrapper.querySelector("[role='article'], a[attributionsrc], video")) items.add(wrapper);
    }
    for (const feed of root.querySelectorAll<HTMLElement>("[role='feed']")) {
      for (const child of Array.from(feed.children).slice(0, 500)) {
        if (child instanceof HTMLElement && child.querySelector("[role='article'], a[attributionsrc], video")) items.add(child);
      }
    }
    const strongEvidence = root.querySelectorAll<HTMLElement>("a[attributionsrc]");
    for (const evidence of Array.from(strongEvidence).slice(0, 500)) items.add(feedContainer(evidence));
    return [...items].slice(0, 2000);
  }

  function itemIsSponsored(item: HTMLElement): boolean {
    if (item.innerText.split(/\n+/).some((line) => isSponsoredMarker(line.trim()))) return true;
    const markers = item.querySelectorAll<HTMLElement>("span, a, [aria-label], [title], [data-testid]");
    if (Array.from(markers).slice(0, 700).some(elementHasSponsoredMarker)) return true;
    return item.querySelector("a[attributionsrc]") !== null || obfuscatedMarker(item);
  }

  function itemMatchesObservedTerms(item: HTMLElement, terms: Set<string>): boolean {
    if (!terms.size) return false;
    const values = item.innerText.split(/\n+/).map((line) => line.trim());
    for (const marker of Array.from(item.querySelectorAll<HTMLElement>("[aria-label], [title], [data-content], span, a")).slice(0, 700)) {
      values.push(
        marker.getAttribute("aria-label") ?? "",
        marker.getAttribute("title") ?? "",
        marker.getAttribute("data-content") ?? "",
        renderedMarkerText(marker),
      );
    }
    return values.some((value) => terms.has(value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")));
  }

  function nearestRepeatingAncestor(evidence: HTMLElement, fallback: HTMLElement): HTMLElement {
    let current: HTMLElement | null = fallback;
    for (let depth = 0; current?.parentElement && depth < 12; depth += 1) {
      const parent: HTMLElement = current.parentElement;
      if (parent.matches("body, main, [role='main']")) break;
      const siblings = Array.from(parent.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
      const feedLikeSiblings = siblings.filter((sibling) => sibling.matches(FEED_ITEM_SELECTOR) || sibling.querySelector(FEED_ITEM_SELECTOR));
      if (siblings.length >= 2 && feedLikeSiblings.length >= 2) return current;
      current = parent;
    }
    return fallback;
  }

  function evidenceClusterContainer(evidence: HTMLElement, evidenceNodes: HTMLElement[], fallback: HTMLElement): HTMLElement {
    if (evidenceNodes.length < 3) return nearestRepeatingAncestor(evidence, fallback);
    let current: HTMLElement | null = evidence;
    for (let depth = 0; current && depth < 16; depth += 1) {
      if (current.matches("html, body, main, [role='main'], nav, [role='navigation'], form, dialog, [role='dialog']")) break;
      let contained = 0;
      for (const node of evidenceNodes) {
        if (current.contains(node)) contained += 1;
        if (contained >= 3) return current;
      }
      current = current.parentElement;
    }
    return nearestRepeatingAncestor(evidence, fallback);
  }

  function automationContainer(evidence: HTMLElement, strategy: AutomationAsset["container"], evidenceNodes: HTMLElement[]): HTMLElement {
    const feedItem = evidence.closest<HTMLElement>(FEED_ITEM_SELECTOR);
    const fallback = feedItem ?? feedContainer(evidence);
    if (strategy === "evidence-cluster") return evidenceClusterContainer(evidence, evidenceNodes, fallback);
    return strategy === "nearest-repeating-ancestor" ? nearestRepeatingAncestor(evidence, fallback) : fallback;
  }

  function hideFilteredElement(element: HTMLElement): boolean {
    if (filteredFeedElements.has(element) || element.contains(document.activeElement)) return false;
    filteredFeedElements.set(element, {
      value: element.style.getPropertyValue("display"),
      priority: element.style.getPropertyPriority("display"),
    });
    element.dataset.mmwFeedHidden = "true";
    element.style.setProperty("display", "none", "important");
    return true;
  }

  function automationEvidenceIn(root: ParentNode, asset: AutomationAsset): HTMLElement[] {
    const evidence = new Set<HTMLElement>();
    const addMatchingRoot = (selector: string): void => {
      if (root instanceof HTMLElement && root.matches(selector)) evidence.add(root);
      for (const element of root.querySelectorAll<HTMLElement>(selector)) evidence.add(element);
    };
    for (const attribute of asset.evidence.attributes) {
      if (/^(?:aria-[a-z][\w-]*|data-[a-z][\w-]*|attributionsrc)$/.test(attribute)) addMatchingRoot(`[${attribute}]`);
    }
    for (const tag of asset.evidence.descendantTags) addMatchingRoot(tag);
    if (asset.evidence.text.length) {
      const terms = new Set(asset.evidence.text.map((term) => term.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")));
      for (const item of feedItemsIn(root)) {
        if (itemMatchesObservedTerms(item, terms)) evidence.add(item);
      }
    }
    return [...evidence].slice(0, 1000);
  }

  function runAutomationAssetsIn(root: ParentNode, assets: AutomationAsset[]): number {
    const matched = new Set<HTMLElement>();
    for (const asset of assets) {
      const evidenceNodes = automationEvidenceIn(root, asset);
      for (const evidence of evidenceNodes) {
        const target = automationContainer(evidence, asset.container, evidenceNodes);
        if (target.matches("html, body, main, [role='main'], nav, [role='navigation'], form, dialog, [role='dialog']")) continue;
        matched.add(target);
      }
    }
    for (const target of matched) hideFilteredElement(target);
    return matched.size;
  }

  function hideFilteredItemsIn(root: ParentNode, hideSponsored: boolean, hideVideo: boolean, terms: Set<string>, assets: AutomationAsset[]): { sponsored: number; video: number; automation: number; scanned: number } {
    let sponsored = 0;
    let video = 0;
    const items = feedItemsIn(root);
    for (const item of items) {
      const sponsoredMatch = (hideSponsored && itemIsSponsored(item)) || itemMatchesObservedTerms(item, terms);
      const videoMatch = hideVideo && item.querySelector("video") !== null;
      if (sponsoredMatch) sponsored += 1;
      if (videoMatch) video += 1;
      if ((!sponsoredMatch && !videoMatch) || filteredFeedElements.has(item) || item.contains(document.activeElement)) continue;
      hideFilteredElement(item);
    }
    return { sponsored, video, automation: runAutomationAssetsIn(root, assets), scanned: items.length };
  }

  function applyFeedFilters(hideSponsored: boolean, hideVideo: boolean, feedFilterTerms: string[], automationAssets: AutomationAsset[]): { sponsored: number; video: number; automation: number; scanned: number; total: number } {
    const terms = new Set(feedFilterTerms.map((term) => term.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")));
    const pageReadyAssets = automationAssets.filter((asset) => asset.triggers.includes("page-ready"));
    const mutationAssets = automationAssets.filter((asset) => asset.triggers.includes("dom-mutation"));
    const localMutationAssets = mutationAssets.filter((asset) => asset.container !== "evidence-cluster");
    const clusterMutationAssets = mutationAssets.filter((asset) => asset.container === "evidence-cluster");
    const initial = hideFilteredItemsIn(document, hideSponsored, hideVideo, terms, pageReadyAssets);
    feedFilterObserver = new MutationObserver((records) => {
      const roots = new Set<HTMLElement>();
      for (const record of records) {
        if (record.type === "attributes") {
          if (record.target instanceof HTMLElement) {
            roots.add(record.target.closest<HTMLElement>(`${SEMANTIC_FEED_WRAPPER_SELECTOR}, ${FEED_ITEM_SELECTOR}`) ?? record.target);
          }
          continue;
        }
        if (record.type === "characterData") {
          const parent = record.target.parentElement;
          if (parent) roots.add(parent.closest<HTMLElement>(`${SEMANTIC_FEED_WRAPPER_SELECTOR}, ${FEED_ITEM_SELECTOR}`) ?? parent);
          continue;
        }
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement) roots.add(node.closest<HTMLElement>(`${SEMANTIC_FEED_WRAPPER_SELECTOR}, ${FEED_ITEM_SELECTOR}`) ?? node);
        }
      }
      for (const root of [...roots].slice(0, 200)) hideFilteredItemsIn(root, hideSponsored, hideVideo, terms, localMutationAssets);
      const clusterAttributes = new Set(clusterMutationAssets.flatMap((asset) => asset.evidence.attributes));
      const clusterMayHaveChanged = clusterMutationAssets.length > 0 && records.some((record) =>
        (record.type === "childList" && record.addedNodes.length > 0)
        || (record.type === "attributes" && !!record.attributeName && clusterAttributes.has(record.attributeName)));
      if (clusterMayHaveChanged) {
        if (feedFilterTimer !== null) window.clearTimeout(feedFilterTimer);
        feedFilterTimer = window.setTimeout(() => {
          feedFilterTimer = null;
          runAutomationAssetsIn(document, clusterMutationAssets);
        }, 100);
      }
    });
    const automationAttributes = mutationAssets.flatMap((asset) => asset.evidence.attributes);
    feedFilterObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [...new Set(["aria-label", "title", "data-content", "attributionsrc", "style", "class", ...automationAttributes])],
      childList: true,
      characterData: true,
      subtree: true,
    });
    return { ...initial, total: filteredFeedElements.size };
  }

  async function loadApprovedProfile(): Promise<void> {
    if (!chrome.runtime?.id || typeof chrome.runtime.sendMessage !== "function") {
      navigationObserver?.disconnect();
      return;
    }
    let response: MessageResult<SiteProfile | null>;
    try {
      response = await chrome.runtime.sendMessage({ type: "GET_PROFILE_FOR_URL", url: location.href } satisfies ExtensionMessage) as MessageResult<SiteProfile | null>;
    } catch {
      // Reloading an unpacked extension invalidates content scripts in existing tabs.
      // Stop background work quietly; a page reload injects the new extension context.
      navigationObserver?.disconnect();
      return;
    }
    if (!response.ok || trackedUrl !== location.href) return;
    const nextApprovedPatch = response.data?.patch ?? null;
    if (JSON.stringify(nextApprovedPatch) !== JSON.stringify(approvedPatch)) webMcpRevision += 1;
    approvedPatch = nextApprovedPatch;
    previewPatch = null;
    previewMetadata = null;
    if (approvedPatch?.articleLayout === "swipe-cards" && document.readyState === "loading") {
      await new Promise<void>((resolve) => document.addEventListener("DOMContentLoaded", () => resolve(), { once: true }));
    }
    applyPatch(approvedPatch);
  }

  function cleanText(value: string | null | undefined): string {
    return (value ?? "").replace(/\s+/g, " ").trim();
  }

  function uniqueText(selector: string, limit: number): string[] {
    const values = new Set<string>();
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      if (element.closest("[aria-hidden='true'], script, style, noscript, template")) continue;
      const label = cleanText(element.getAttribute("aria-label") || element.innerText || element.textContent);
      if (label) values.add(label.slice(0, 240));
      if (values.size >= limit) break;
    }
    return [...values];
  }

  function visibleTextExcerpt(): string {
    const walker = document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest("script, style, noscript, template, input, textarea, select, [contenteditable='true'], [aria-hidden='true']")) {
          return NodeFilter.FILTER_REJECT;
        }
        const text = cleanText(node.textContent);
        if (!text) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const chunks: string[] = [];
    let length = 0;
    while (walker.nextNode() && length < 18_000) {
      const text = cleanText(walker.currentNode.textContent);
      chunks.push(text);
      length += text.length + 1;
    }
    return chunks.join(" ").slice(0, 18_000);
  }

  function discoverFeedPatterns(request = ""): NonNullable<PageSnapshot["feedPatterns"]> {
    const requestWords = new Set((request.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).slice(0, 30));
    const patterns = new Map<string, { text: string; source: "rendered-text" | "aria-label" | "title" | "data-content"; occurrences: number; score: number }>();
    const add = (raw: string | null | undefined, source: "rendered-text" | "aria-label" | "title" | "data-content"): void => {
      const text = cleanText(raw);
      if (text.length < 2 || text.length > 48) return;
      const normalized = text.normalize("NFKC").toLocaleLowerCase();
      const requestMatch = [...requestWords].some((word) => normalized.includes(word));
      const semanticMatch = isSponsoredMetadata(text);
      if (source === "rendered-text" && !requestMatch && !semanticMatch) return;
      const key = `${source}:${normalized}`;
      const existing = patterns.get(key);
      if (existing) existing.occurrences += 1;
      else patterns.set(key, { text, source, occurrences: 1, score: (semanticMatch ? 100 : 0) + (requestMatch ? 50 : 0) + (source === "rendered-text" ? 0 : 10) });
    };
    for (const item of feedItemsIn(document).slice(0, 80)) {
      for (const line of item.innerText.split(/\n+/).slice(0, 30)) add(line, "rendered-text");
      for (const marker of Array.from(item.querySelectorAll<HTMLElement>("[aria-label], [title], [data-content]")).slice(0, 300)) {
        add(marker.getAttribute("aria-label"), "aria-label");
        add(marker.getAttribute("title"), "title");
        add(marker.getAttribute("data-content"), "data-content");
        add(renderedMarkerText(marker), "rendered-text");
      }
      for (const group of Array.from(item.querySelectorAll<HTMLElement>("b, [data-content]")).slice(0, 150)) add(renderedMarkerText(group.parentElement ?? group), "rendered-text");
    }
    return [...patterns.values()]
      .sort((left, right) => right.score - left.score || right.occurrences - left.occurrences)
      .slice(0, 40)
      .map(({ text, source, occurrences }) => ({ text, source, occurrences }));
  }

  function discoverDomSignals(request = ""): NonNullable<PageSnapshot["domSignals"]> {
    const counts = new Map<string, number>();
    const safeAttribute = /^(?:aria-[a-z][\w-]*|data-[a-z][\w-]*|attributionsrc)$/;
    const elements = new Set<HTMLElement>();
    for (const item of feedItemsIn(document).slice(0, 80)) {
      elements.add(item);
      for (const element of Array.from(item.querySelectorAll<HTMLElement>("*")).slice(0, 500)) elements.add(element);
    }
    // Semantic evidence can sit outside recognized feed items when a page omits
    // article/feed roles. Inspect attribute names only (never their values) so
    // request-relevant structure can still be proposed through the safe DSL.
    for (const element of Array.from(document.querySelectorAll<HTMLElement>("*")).slice(0, 12_000)) {
      if (Array.from(element.attributes).some((attribute) =>
        safeAttribute.test(attribute.name.toLowerCase())
        && domSignalRelevance(attribute.name, request) !== "structural")) {
        elements.add(element);
      }
    }
    for (const element of elements) {
      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        if (safeAttribute.test(name)) counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    const signals: NonNullable<PageSnapshot["domSignals"]> = [...counts]
      .map(([name, occurrences]) => ({ kind: "attribute-presence" as const, name, occurrences, relevance: domSignalRelevance(name, request) }))
      .sort((left, right) => {
        const priority = { "request-match": 2, "content-marker": 1, structural: 0 } as const;
        return priority[right.relevance] - priority[left.relevance]
          || left.occurrences - right.occurrences
          || left.name.localeCompare(right.name);
      })
      .slice(0, 40);
    const videos = document.querySelectorAll("video").length;
    if (videos) signals.push({ kind: "descendant-tag", name: "video", occurrences: videos, relevance: domSignalRelevance("video", request) });
    return signals;
  }

  function snapshot(request?: string): PageSnapshot {
    return {
      context: context(),
      headings: uniqueText("h1, h2, h3, [role='heading']", 60),
      landmarks: uniqueText("main, nav, aside, header, footer, [role='main'], [role='navigation'], [role='complementary']", 30),
      controls: uniqueText("button, a[href], summary, [role='button'], [role='link'], input:not([type='password']), select, textarea", 100),
      text: visibleTextExcerpt(),
      feedPatterns: discoverFeedPatterns(request),
      domSignals: discoverDomSignals(request),
    };
  }

  function realPageWebMcpState(): Record<string, unknown> {
    const approved = approvedPatch ?? DEFAULT_PATCH;
    const effective = previewPatch ?? approved;
    return {
      revision: webMcpRevision,
      mode: previewPatch ? "preview" : hasAdaptationChanges(approved) ? "approved" : "original",
      persisted: hasAdaptationChanges(approved),
      persistenceScope: hasAdaptationChanges(approved) ? "this browser and site origin" : "none",
      preview: previewMetadata,
      effectiveDesign: effective,
      approvedDesign: approved,
      approval: {
        availableThroughWebMCP: false,
        nextStep: "Inspect the visible page, then use Approve in the Tweaksy side panel to save this design for the site.",
      },
    };
  }

  function assertWebMcpRevision(expectedRevision: number): void {
    if (expectedRevision !== webMcpRevision) {
      throw new Error(`Tweaksy page state changed. Expected revision ${expectedRevision}, but the current revision is ${webMcpRevision}. Read get_tweaksy_state and try again.`);
    }
  }

  function inspectRealPageSurface(): Record<string, unknown> {
    return {
      surface: "real-top-level-page",
      title: document.title,
      origin: location.origin,
      counts: {
        headings: document.querySelectorAll("h1, h2, h3, [role='heading']").length,
        controls: document.querySelectorAll("button, a[href], summary, [role='button'], [role='link'], input, select, textarea").length,
        articles: document.querySelectorAll("article, [role='article']").length,
        images: document.images.length,
      },
      supportedAdaptations: [
        "type scale", "line height", "letter spacing", "content width", "light or dark scheme",
        "higher contrast", "reduced motion", "strong keyboard focus", "vetted themes",
        "red-avoidance mode", "article or social-post swipe deck when compatible content is present",
      ],
      safety: {
        topLevelPageOnly: true,
        rawCssHtmlScriptsSelectorsAndUrlsRejected: true,
        previewsAreReversible: true,
        webMcpCanPersistChanges: false,
        humanApprovalRequiredInExtension: true,
      },
    };
  }

  function executeRealPageWebMcp(request: RealPageWebMcpRequest): unknown {
    switch (request.tool) {
      case "inspect_tweaksy_surface":
        return inspectRealPageSurface();
      case "get_tweaksy_state":
        return realPageWebMcpState();
      case "preview_tweaksy_adaptation": {
        const input = parseRealPagePreviewInput(request.input);
        assertWebMcpRevision(input.expectedRevision);
        const basePatch = previewPatch ?? approvedPatch;
        const deltaPatch = validatePatch(input.changes);
        const effectivePatch = mergeAdaptationPatches(basePatch, deltaPatch, input.resetFields);
        if (!changesEffectiveDesign(basePatch, effectivePatch)) throw new Error("The requested fields do not change the current Tweaksy design.");
        const priorPreview = previewPatch;
        const priorMetadata = previewMetadata;
        previewPatch = effectivePatch;
        previewMetadata = { id: crypto.randomUUID(), summary: input.summary, createdAt: new Date().toISOString(), source: "webmcp" };
        const report = applyPatch(effectivePatch);
        if (input.resetFields.length) {
          report.applied = true;
          report.affectedElements = Math.max(1, report.affectedElements);
          report.details.push(`Reset ${input.resetFields.join(", ")} to the website defaults.`);
        }
        if (!report.applied) {
          previewPatch = priorPreview;
          previewMetadata = priorMetadata;
          applyPatch(priorPreview ?? approvedPatch);
          throw new Error(report.details.join(" ") || "The requested preview did not produce a visible change on this page.");
        }
        webMcpRevision += 1;
        return {
          status: "preview_ready",
          ...realPageWebMcpState(),
          verification: report,
          persisted: false,
          nextStep: "Let the person inspect the visible real page. They can approve in the Tweaksy side panel or discard this preview through WebMCP.",
        };
      }
      case "discard_tweaksy_preview": {
        const expectedRevision = parseExpectedRevision(request.input, request.tool);
        assertWebMcpRevision(expectedRevision);
        if (!previewPatch) throw new Error("There is no Tweaksy preview to discard.");
        previewPatch = null;
        previewMetadata = null;
        const report = applyPatch(approvedPatch);
        webMcpRevision += 1;
        return {
          status: "preview_discarded",
          ...realPageWebMcpState(),
          verification: report,
          persistedDesignUnchanged: true,
        };
      }
    }
  }

  window.addEventListener(REAL_PAGE_WEBMCP_REQUEST_EVENT, (event) => {
    if (!(event instanceof CustomEvent)) return;
    const candidate = event.detail && typeof event.detail === "object" ? event.detail as Record<string, unknown> : null;
    let requestId = typeof candidate?.requestId === "string" ? candidate.requestId : "invalid-request";
    void Promise.resolve().then(() => {
      const request = parseRealPageWebMcpRequest(event.detail);
      requestId = request.requestId;
      return executeRealPageWebMcp(request);
    }).then((result) => {
      const response: RealPageWebMcpResponse = { requestId, ok: true, result };
      window.dispatchEvent(new CustomEvent(REAL_PAGE_WEBMCP_RESPONSE_EVENT, { detail: response }));
    }).catch((error: unknown) => {
      const response: RealPageWebMcpResponse = {
        requestId,
        ok: false,
        error: error instanceof Error ? error.message : "Tweaksy could not complete the WebMCP request.",
      };
      window.dispatchEvent(new CustomEvent(REAL_PAGE_WEBMCP_RESPONSE_EVENT, { detail: response }));
    });
  });

  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse: (value: MessageResult) => void) => {
    if (message.type === "CONTENT_GET_CONTEXT") {
      sendResponse({ ok: true, data: context() });
      return;
    }
    if (message.type === "CONTENT_SNAPSHOT") {
      sendResponse({ ok: true, data: snapshot(message.request) });
      return;
    }
    if (message.type === "CONTENT_APPLY") {
      if (!contextMatches(message.context)) {
        sendResponse({ ok: false, error: "This page changed before the adaptation could be applied." });
        return;
      }
      const priorApprovedPatch = approvedPatch;
      const priorPreviewPatch = previewPatch;
      const priorPreviewMetadata = previewMetadata;
      if (message.mode === "approved") {
        approvedPatch = message.patch;
        previewPatch = null;
        previewMetadata = null;
      } else {
        previewPatch = message.patch;
        previewMetadata = { id: crypto.randomUUID(), summary: message.summary ?? "Tweaksy chat preview", createdAt: new Date().toISOString(), source: "chat" };
      }
      const report = applyPatch(previewPatch ?? approvedPatch);
      if (message.resetFields?.length) {
        report.applied = true;
        report.affectedElements = Math.max(1, report.affectedElements);
        report.details.push(`Reset ${message.resetFields.join(", ")} to the website defaults.`);
      }
      if (!report.applied) {
        approvedPatch = priorApprovedPatch;
        previewPatch = priorPreviewPatch;
        previewMetadata = priorPreviewMetadata;
        applyPatch(priorPreviewPatch ?? priorApprovedPatch);
        sendResponse({ ok: false, error: report.details.join(" ") || "The proposal contained no applicable visual changes." });
        return;
      }
      webMcpRevision += 1;
      sendResponse({ ok: true, data: report });
      return;
    }
    if (message.type === "CONTENT_CLEAR") {
      if (!contextMatches(message.context)) {
        sendResponse({ ok: false, error: "This page changed before adaptations could be paused." });
        return;
      }
      approvedPatch = null;
      previewPatch = null;
      previewMetadata = null;
      applyPatch(null);
      webMcpRevision += 1;
      sendResponse({ ok: true });
      return;
    }
    if (message.type === "CONTENT_REVERT") {
      if (!contextMatches(message.context)) {
        sendResponse({ ok: false, error: "This page changed before the preview could be undone." });
        return;
      }
      previewPatch = null;
      previewMetadata = null;
      applyPatch(approvedPatch);
      webMcpRevision += 1;
      sendResponse({ ok: true });
    }
  });

  function checkNavigation(): void {
    if (location.href === trackedUrl) return;
    trackedUrl = location.href;
    navigationToken = crypto.randomUUID();
    previewPatch = null;
    previewMetadata = null;
    webMcpRevision += 1;
    void loadApprovedProfile();
  }

  window.addEventListener("popstate", checkNavigation);
  window.addEventListener("hashchange", checkNavigation);
  navigationObserver = new MutationObserver(checkNavigation);
  navigationObserver.observe(document.documentElement, { childList: true, subtree: true });
  window.dispatchEvent(new CustomEvent(REAL_PAGE_WEBMCP_ACTIVATE_EVENT));
  void loadApprovedProfile();
}
