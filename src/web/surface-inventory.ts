export interface TweaksySurfaceInventory {
  surfaceId: "harborline-journal";
  title: string;
  description: string;
  storyCount: number;
  storyLinkCount: number;
  headings: string[];
  adaptationCapabilities: string[];
  assistiveCapabilities: string[];
  guarantees: string[];
}

export function inspectTweaksySurface(root: HTMLElement): TweaksySurfaceInventory {
  const headings = [...root.querySelectorAll<HTMLHeadingElement>("h1, h2, h3")]
    .map((heading) => heading.textContent?.trim() ?? "")
    .filter(Boolean);
  const stories = root.querySelectorAll<HTMLElement>("[data-story-id]");
  const storyLinks = root.querySelectorAll<HTMLAnchorElement>("[data-story-id] a");

  return {
    surfaceId: "harborline-journal",
    title: "Harborline Journal evening edition",
    description: "A fictional six-story editorial page designed for safe, visible adaptation.",
    storyCount: stories.length,
    storyLinkCount: storyLinks.length,
    headings,
    adaptationCapabilities: [
      "increase readable type and line spacing",
      "constrain the reading width",
      "present stories as a keyboard-operable deck",
      "reduce motion and strengthen focus indicators",
      "hide clearly marked demo ads and de-emphasize decorative images for focus",
      "apply vetted color and editorial themes",
    ],
    assistiveCapabilities: [
      "preview ten accessibility modes for color vision, low vision, reading comfort, motion, focus, and keyboard access",
      "read a page summary, current story, or all headlines aloud through the browser",
      "start or end a visible 10, 25, or 45 minute focus session",
    ],
    guarantees: [
      "Adaptations are scoped to the Harborline demo surface.",
      "Preview changes remain in memory until a person approves them.",
      "All six stories and their links remain in the document.",
      "Tools cannot inject HTML, JavaScript, CSS, URLs, or selectors.",
      "Read aloud stays on the device and is presented as an aid, not a screen-reader replacement.",
    ],
  };
}
