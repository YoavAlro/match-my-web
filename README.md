# Tweaksy

Tweaksy is a privacy-first Manifest V3 Chrome extension that lets a person describe visual website adaptations in plain language, preview them safely, and save approved changes as local site profiles.

![Tweaksy Live turns a dense page into a calm reading card](web/assets/tweaksy-live-social.png)

## Tweaksy Live — WebMCP Challenge

Tweaksy now demonstrates the same adaptation model in two places. **Real-site mode** uses the Chrome extension on a permitted top-level website: the person describes the desired layout in free-form chat, Tweaksy creates a bounded preview, and the extension registers four safe WebMCP tools so an agent can inspect, preview, and undo on that real page. Permanent approval stays human-only in the side panel. **Tweaksy Live** is the no-install challenge experience: a clean, fictional six-story Harborline Journal page with no embedded Tweaksy controls and ten first-party WebMCP tools. ChatGPT is the conversation surface; WebMCP is the page's control bridge.

Live demo: [tweaksy-live.yoavalro.chatgpt.site](https://tweaksy-live.yoavalro.chatgpt.site/)

The strongest product demo uses ChatGPT's conversation to ask the first-party Harborline website to adapt for color blindness or low vision, read owned page content aloud, or start a timed focus session. WebMCP changes the actual page in front of the person and returns state and verification to the agent. Read aloud is an optional browser aid, not a replacement for a screen reader or individualized accessibility testing.

### Run the web experience

Requirements: Node.js 22+.

```powershell
npm install
npm run build:web
node scripts/serve-web.mjs
```

Open `http://127.0.0.1:4173/`. If that port is occupied, run `node scripts/serve-web.mjs --port=4319` and open the matching URL.

The Harborline publication remains readable in any modern browser. To discover and invoke its adaptation tools, use ChatGPT’s built-in browser or a compatible WebMCP-enabled Chrome build.

For the hosted worker artifact, run `npm run build:site`; the Sites-ready output is written to `dist/`.

### WebMCP tools

| Tool | Purpose |
| --- | --- |
| `inspect_tweaksy_surface` | Read the page inventory, capabilities, preservation counts, and safety guarantees. |
| `get_tweaksy_state` | Read the exact revision, approved state, pending preview, and verification result. |
| `preview_tweaksy_accessibility_mode` | Preview a vetted color-safe or low-vision presentation. |
| `read_tweaksy_content` | Read a page summary, the current story, or all headlines through the browser voice. |
| `stop_tweaksy_reading` | Stop speech started by Tweaksy. |
| `start_tweaksy_focus_session` | Start a visible 10, 25, or 45 minute one-story focus session. |
| `end_tweaksy_focus_session` | End focus time and cleanly restore the prior surface. |
| `preview_tweaksy_adaptation` | Apply a reversible, memory-only adaptation from vetted design fields. |
| `discard_tweaksy_preview` | Restore the last approved design without deleting it. |
| `approve_tweaksy_preview` | Save the exact visible preview locally after explicit approval. |

The hosted page exposes all ten tools. On third-party pages, the extension deliberately exposes only the original four: WebMCP cannot grant host permission, access provider credentials, or persist a site profile. The person approves lasting changes from the extension side panel.

See [the WebMCP architecture](docs/WEBMCP.md) for trust boundaries and [the challenge evidence](HACKATHON.md) for the pre-existing baseline and submission checklist.

## Install a shared build

Tweaksy is not yet published in the Chrome Web Store, so a shared ZIP must be installed as an unpacked extension:

1. Unzip `tweaksy-<version>-chrome.zip` into a permanent folder.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the unzipped folder—the folder containing `manifest.json`.
5. Pin Tweaksy from Chrome's extensions menu, open a normal website, and click its toolbar icon.

Each person supplies their own provider API key in **AI provider and privacy**. Keys stay in that person's local Chrome extension storage and are sent only to the configured provider. Never include API keys when sharing the build.

### Everyday controls

- Click the Tweaksy toolbar icon and choose **Open Tweaksy** to start or continue the conversation for the current tab.
- Choose **Turn off for this site** to clear adaptations and stop Tweaksy only on the current origin. The toolbar icon becomes grayscale there.
- Choose **Shut down Tweaksy** to clear adaptations and stop activity across all open sites. Click **Turn Tweaksy back on** to restore eligible saved profiles.
- Use **Cmd+Enter** on macOS or **Ctrl+Enter** elsewhere to send a message.

## Existing Chrome extension foundation

The Chrome extension is Tweaksy’s real-site product surface. It supports optional user-supplied provider credentials for free-form adaptation generation and now adds top-level WebMCP discovery after the person activates Tweaksy for a page.

### What works in this MVP foundation

- Inspects only the active `http`/`https` page after a user action.
- Sends a bounded, value-free page snapshot only when the user chooses **Generate preview**.
- Uses the user's OpenAI, Azure OpenAI, Anthropic, TokenRouter, OpenRouter, or Google Gemini account, model/deployment, and API key.
- Accepts a small declarative adaptation schema—never AI-generated JavaScript, HTML, remote code, or raw CSS.
- Supports reviewed, origin-scoped DOM-filter automation assets that bind exact observed evidence to packaged actions, run on page load and infinite-feed mutations, and remain previewable, reversible, pausable, and locally persisted.
- Composes those assets from a portable, audited DOM-skill catalog—semantic attributes, exact markers, descendant evidence, semantic containers, evidence clusters, repeating ancestors, and dynamic-content triggers—without website recipes or generated class names.
- Includes a packaged, reversible filter for sponsored feed items, including rendered/accessibility labels, localized or split-letter markers, and standard attribution metadata; providers can enable it but cannot supply executable filtering code.
- Includes a separate packaged, reversible filter for feed posts containing actual video elements.
- For unfamiliar feed filtering, sends bounded observed DOM marker and structure signals to the configured provider; the provider may select only exact observed evidence, and Tweaksy executes it through a validated site-agnostic rule engine.
- Remembers at most 12 extension chat turns per browser tab in session storage, keeps in-flight generation bound to its originating tab while the user browses elsewhere, and restores its thinking or completed proposal state on return.
- Uses the toolbar popup as a fast off switch: disable only the current origin or shut Tweaksy down everywhere, immediately clear active adaptations, and show the off state with a grayscale toolbar icon. Re-enabling restores eligible saved profiles.
- Supports deterministic headline colors, a full-page article deck with touch swiping, mouse dragging, keyboard navigation, optional side controls, and reversible red-to-blue/teal interface-color remapping.
- Recognizes visible social-feed posts for swipe decks, preserving author, text, and visible image/video media without a generic article button; post details open in a local accessible dialog with a link to the original conversation.
- Keeps preview, measured application results, approval, and undo state in the WebMCP response instead of claiming an unverified action succeeded; the page itself stays free of a second control surface.
- Registers read, preview, and discard WebMCP tools in the real page’s top-level JavaScript context; the isolated extension world validates every request and never exposes approval, storage, permissions, or provider calls through the page bridge.
- Provides an explicit, key-free JSON diagnostic export that can be saved into the project workspace for debugging.
- Shares approved profiles as versioned `.tweaksy.json` files through the system share sheet or a file-save fallback. Recipients must open the matching origin, import, preview, and explicitly approve the validated declarative patch. Legacy `.matchmyweb.json` files remain importable.
- Treats chat as the command surface for safe extension actions: start a new tab-scoped conversation, inspect, preview, approve/save, cancel/revise, undo, pause/resume, share, import, debug export, and open settings. API keys and provider credentials remain manual-only.
- Maps familiar website-style references to a small set of non-identical, validated visual themes rather than copying third-party CSS, logos, or trademarked brand assets.
- Composes follow-up requests as incremental patches over the active design, preserving its palette and other established settings unless the user explicitly requests a validated field reset.
- Rejects inherited no-op proposals and invalidates late responses when a proposal is canceled or another page action supersedes the request.
- Validates and clamps every AI field and rejects risky selectors.
- Applies previews reversibly and saves only after a separate approval.
- Requests ongoing access to the approved origin only; other sites remain inaccessible.
- Persists profiles in `chrome.storage.local` and registers origin-scoped document-start scripts across reloads and browser restarts.
- Styles the document plus open and newly created closed shadow roots.
- Rejects stale results using a four-part guard: tab ID, document token, same-document navigation token, and exact URL.
- Supports keyboard input and on-device Chrome speech recognition when available, with the user's configured provider as an optional fallback. Audio is never saved.

## Local development

Requirements: Node.js 22+ and Chrome 114+.

```bash
npm install
npm run check
```

Load `dist/` as an unpacked extension:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this repository's `dist` folder.
4. Pin Tweaksy, open a normal website, click the toolbar button, and choose **Open Tweaksy**. The same popup can turn Tweaksy off for the current site or shut it down globally. This deliberate click grants temporary `activeTab` access for the current page.

The extension requests no site access at install time. Clicking the toolbar provides temporary `activeTab` access. Approving a profile prompts for persistent access to that single origin.

### Share a design

Save and approve a profile, then say “share this design” in chat or choose **Share saved design** from the top action menu. The shared file contains the exact origin, profile name, declarative patch, format version, and export time—never an API key, page contents, scripts, HTML, or raw CSS. A recipient opens the same website, asks to import a design or uses the action menu, reviews the normalized settings in chat, previews them, and grants that origin access only when approving and saving.

### Azure OpenAI setup

Choose **Azure OpenAI** in the provider panel and enter:

- **Azure resource endpoint:** the value from Azure's Keys and Endpoint page, such as `https://your-resource.openai.azure.com`. A pasted `/openai/v1/` path is safely normalized.
- **Model or deployment name:** the Azure deployment name—not necessarily the underlying model name.
- **API key:** either key from the Azure resource. It stays in local extension storage and is sent only to that Azure hostname in the `api-key` header.
- **Voice transcription deployment:** optional; provide a separately deployed Azure speech-to-text model if recording should work.

The extension uses Azure's unified `POST /openai/v1/chat/completions` API and requests runtime permission for that exact Azure origin.

### OpenAI-compatible provider setup

Tweaksy also supports API-token access through fixed OpenAI-compatible gateways:

- **TokenRouter:** use a model ID such as `moonshotai/kimi-k3-free`. The key is sent only to `https://api.tokenrouter.com`.
- **OpenRouter:** use a model ID such as `moonshotai/kimi-k3`. The key is sent only to `https://openrouter.ai`; paid models require sufficient OpenRouter credits.
- **Google Gemini:** use a model ID such as `gemini-3.6-flash`. The key is sent only to `https://generativelanguage.googleapis.com`.

These providers use their documented OpenAI-compatible chat-completions endpoints and Bearer authentication. Tweaksy requests runtime access only to the selected provider origin. Provider fallback voice transcription is not enabled for these gateways; Chrome on-device dictation remains available when supported.

## Repository guide

- `src/background.ts` — permission boundary, request cancellation, provider calls, persistence, and stale-result enforcement.
- `src/content.ts` — bounded inspection and reversible page adaptation.
- `src/main-world.ts` — no-secret bridge that styles shadow roots, including closed roots created after the hook starts.
- `src/real-page-webmcp.ts` — strict schemas and four-tool contract for WebMCP on extension-permitted real pages.
- `src/validation.ts` — the AI-output safety boundary.
- `src/sidepanel.ts` — accessible chat, approval, and voice workflow.
- `src/web/adaptation-controller.ts` — shared revision, preview, approval, discard, and restore state machine for Tweaksy Live.
- `src/web/assistive-controller.ts` — shared color-safe, low-vision, browser read-aloud, and timed-focus capabilities used by WebMCP.
- `src/web/demo-renderer.ts` — renderer scoped to the fictional Harborline surface.
- `src/web/webmcp.ts` — top-level WebMCP schemas, tools, execution, and feature detection.
- `web/` — static Tweaksy Live document, styles, and original social preview.
- `docs/ARCHITECTURE.md` — trust boundaries and lifecycle.
- `docs/WEBMCP.md` — hosted WebMCP architecture and security boundary.
- `docs/THREAT_MODEL.md` — security analysis and mitigations.
- `docs/RELEASE_CHECKLIST.md` — production and Chrome Web Store gates.

- `docs/BRAND.md` — Tweaksy identity, mascot states, palette, and accessibility rules.

## Important limits

- Chrome internal pages, the Chrome Web Store, and other restricted schemes cannot be inspected or changed.
- A closed shadow root created before temporary injection cannot be reached until the page reloads after origin approval. Approved profiles inject at document start and cover subsequently created roots.
- Voice transcription works with OpenAI and with Azure OpenAI when the user provides a separate speech-to-text deployment. Text requests also work with Anthropic, TokenRouter, OpenRouter, and Google Gemini.
- The build is an MVP foundation, not yet a published Chrome Web Store release. Complete every gate in `docs/RELEASE_CHECKLIST.md` before submission.

## Brand

**Tweaksy** means the web can be gently reshaped around the person using it. Its mascot, **Tweak**, keeps one recognizable silhouette while changing expression, color, and status symbol for ready, thinking, preview, saved, and error states. Status never depends on color alone. The tagline is **“The web, shaped for you.”**
