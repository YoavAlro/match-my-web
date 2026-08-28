# Tweaksy Live — WebMCP Challenge evidence

Tweaksy Live is the WebMCP Challenge extension of the pre-existing Tweaksy browser-extension project. This file separates the earlier codebase from the work created during the challenge submission period.

## Official requirements tracked here

The [official challenge rules](https://webmcp.devpost.com/rules) define the submission period as August 25, 2026 at 11:00 a.m. PT through September 3, 2026 at 1:00 p.m. PT. For Israel, the submission deadline is September 3, 2026 at 11:00 p.m. IDT.

The [challenge submission page](https://webmcp.devpost.com/) requires a working live URL, a public code repository with a detectable open-source license, a project explanation, and a public narrated YouTube demo shorter than three minutes. Its judging criteria are WebMCP leverage, execution, potential impact, and creativity/ambition.

## Pre-challenge baseline

The repository existed before the submission period as a Manifest V3 Chrome extension. The last baseline commit is:

```text
37cac55ceb807cb05594d3d4eef2f73243487568
2026-07-31T15:27:50+03:00
Rebrand and extend Tweaksy extension
```

That baseline includes extension-specific provider integrations, content-script adaptation, a side panel, local profiles, and the original validated `AdaptationPatch` domain model. It does **not** contain a hosted web experience, WebMCP registration, Harborline Journal, the web controller, or challenge submission materials.

## Submission links

- Live app: <https://tweaksy-live.yoavalro.chatgpt.site/>
- Public repository: <https://github.com/YoavAlro/match-my-web>
- Baseline source: <https://github.com/YoavAlro/match-my-web/tree/37cac55ceb807cb05594d3d4eef2f73243487568>

## Work added during the challenge

Development began on August 28, 2026 on the `webmcp-challenge` branch. The meaningful WebMCP extension consists of:

- A standalone, static Tweaksy Live app with the original fictional Harborline Journal surface.
- A scoped renderer that can convert a dense six-story feed into an accessible, keyboard-operable story deck without removing any story or link.
- One revision-safe adaptation controller shared by the visible dock and WebMCP tools.
- In-memory previews, explicit approval, discard, locally persisted approved designs, and restore-original behavior.
- Five top-level JavaScript WebMCP tools registered with `document.modelContext.registerTool`.
- A four-tool real-page WebMCP surface injected by the Chrome extension after explicit page activation, reusing the existing arbitrary-page renderer while keeping persistence and provider access human-controlled.
- Free-form side-panel chat for describing real-page adaptations in natural language; the agent output is normalized into the same declarative patch model.
- Strict, closed input schemas that expose vetted visual settings only—not CSS, HTML, JavaScript, URLs, selectors, arbitrary content edits, or network access.
- Verification results that report story/link preservation after every change.
- Automated tests for input safety, stale-revision rejection, preview/approve/discard state transitions, registration, and non-WebMCP fallback.
- A separate web build, original visual assets, open-source license, implementation documentation, and submission/demo preparation.

## New challenge surface

| Area | Challenge implementation |
| --- | --- |
| Web app | `web/`, `src/web/main.ts` |
| Shared controller | `src/web/adaptation-controller.ts` |
| Scoped renderer | `src/web/demo-renderer.ts` |
| WebMCP registration | `src/web/webmcp.ts`, `src/web/webmcp-types.d.ts` |
| Real-page WebMCP bridge | `src/real-page-webmcp.ts`, `src/main-world.ts`, `src/content.ts` |
| Safe inspection | `src/web/surface-inventory.ts` |
| Local persistence | `src/web/storage.ts` |
| Tests | `tests/web/` |
| Build and preview | `scripts/build-web.mjs`, `scripts/serve-web.mjs`, `scripts/stage-site-assets.mjs` |
| Sites host | `app/`, `vite.config.ts`, `.openai/hosting.json` |
| Architecture | `docs/WEBMCP.md` |

## Reproducibility

```powershell
npm install
npm run typecheck
npm run test
npm run build:web
npm run build:site
node scripts/serve-web.mjs
```

Open `http://127.0.0.1:4173/`. The human interface works in any modern browser. Site tools are discoverable in ChatGPT’s built-in browser or a compatible WebMCP-enabled browser.

## Submission checklist

- [x] Meaningful WebMCP work is separated from the pre-challenge baseline.
- [x] Source includes explicit top-level `document.modelContext.registerTool` registration.
- [x] Human-visible fallback supports the same core workflow.
- [x] Tests and production build pass.
- [x] MIT license is present at the repository root.
- [x] Public repository visibility verified after pushing the challenge branch.
- [x] Production URL deployed and recorded here.
- [ ] Production WebMCP discovery and all tool calls tested in ChatGPT’s built-in browser.
- [ ] Public narrated YouTube demo under three minutes recorded and linked here.
- [ ] Devpost entry submitted before September 3, 2026 at 1:00 p.m. PT.

Do not change the public repository or deployed submission after the deadline unless the official rules or organizers explicitly allow it.
