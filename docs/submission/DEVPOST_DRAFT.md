# Devpost submission draft

## Project name

Tweaksy Live

## One-line pitch

Tweaksy lets a person and their agent safely reshape the same website—with visible previews, exact approvals, and proof that the original content remains intact.

## Inspiration

The web is usually designed once for an imagined average user, while real people have changing needs: larger type tonight, lower motion during a migraine, fewer simultaneous choices when concentrating, or stronger keyboard focus. Browser automation can change a page, but it often asks people to trust invisible reasoning or brittle UI manipulation.

Tweaksy Live explores a more legible relationship. The site publishes the adaptation vocabulary it actually supports. An agent can reason about the person’s request and propose a bounded transformation, while the person sees and controls the same live page.

## What it does

The demo begins as Harborline Journal, an intentionally dense but fully original six-story editorial page. A person can ask their agent to make it calmer and easier to read. Through WebMCP, the agent can:

- inspect the page’s content inventory and supported adaptation capabilities;
- read the current revision, approved design, and any pending preview;
- preview a validated combination of layout, typography, width, motion, focus, theme, contrast, and color-vision preferences;
- verify that all six stories and six links remain connected to the document;
- discard the preview or, only after explicit approval, save the exact visible design locally.

The hero transformation presents one story at a time with keyboard controls, larger reading text, reduced motion, a narrower reading measure, strong focus indicators, compact imagery, and blue rather than red-only critical accents. The Tweaksy dock stays fixed outside the transformed surface, so the approval controls never move out from under the person.

## Why WebMCP

Without WebMCP, an agent must infer capabilities from buttons, manipulate the UI indirectly, and guess whether the page accepted a change. Tweaksy’s tools make the safe adaptation vocabulary explicit and return revision and preservation evidence after each action. That lets the agent do the reasoning-heavy part—translate a human need into a coherent design—while the app retains authority over validation, rendering, persistence, and undo.

This is meaningfully collaborative: the agent can propose a multi-variable adaptation in one structured call, the person judges the real visual result, and both continue from the same versioned page state.

## How it was built

Tweaksy Live is a static TypeScript app compiled with esbuild. It reuses the pre-existing Tweaksy extension’s declarative `AdaptationPatch`, validation, and patch-merging logic, but adds a new hosted surface and a stricter WebMCP boundary.

Five tools are registered from top-level JavaScript with `document.modelContext.registerTool`. Their JSON Schemas are closed with `additionalProperties: false`. The preview tool accepts only bounded numbers, fixed enums, and booleans; it cannot receive CSS, HTML, JavaScript, URLs, selectors, arbitrary DOM edits, or content removal.

The visible dock and WebMCP tools call one `AdaptationController`. Every write includes an expected revision, exact preview approval also requires an opaque preview id, previews remain in memory, and approved patches remain in local storage for this origin only. The renderer modifies only the `[data-tweaksy-demo]` canvas through known data attributes and custom properties.

The repo includes automated tests for controller transitions, stale calls, unsafe fields, schema closure, registration, shared execution, fallback behavior, and preservation results.

## Challenges

The central design challenge was preserving meaningful human authority without reducing WebMCP to read-only metadata. The solution separates reversible preview from persistence, keeps approval visible, and makes both state changes verifiable. Another challenge was ensuring “one story at a time” did not mean deleting the other five stories; the renderer keeps every original story and link connected and exposes measured proof after each mutation.

## Accomplishments

- One controller powers both the human UI and all agent actions.
- The primary transformation is visibly substantial but completely reversible.
- Strict schemas eliminate raw code and arbitrary selectors at the agent boundary.
- Revision and preview-id checks prevent stale or replaced proposals from being applied.
- The app works without WebMCP, accounts, API keys, a backend, or network calls.
- Challenge work is documented separately from the pre-existing extension baseline.

## What’s next

The next step is to bring this safe preview/approval contract back into the extension so participating sites can expose first-class adaptation surfaces while Tweaksy still supports ordinary pages. Future work could add site-authored accessibility presets, portable preference profiles with explicit per-origin consent, and standardized verification signals for content preservation.

## Links to fill before submission

- Live app: `https://tweaksy-live.yoavalro.chatgpt.site/`
- Public repository: `https://github.com/YoavAlro/match-my-web`
- Demo video: `[public YouTube URL]`
- Challenge evidence: `HACKATHON.md`
