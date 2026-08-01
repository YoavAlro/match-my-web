# Tweaksy

Tweaksy is a privacy-first Manifest V3 Chrome extension that lets a person describe visual website adaptations in plain language, preview them safely, and save approved changes as local site profiles.

## What works in this MVP foundation

- Inspects only the active `http`/`https` page after a user action.
- Sends a bounded, value-free page snapshot only when the user chooses **Generate preview**.
- Uses the user's OpenAI, Azure OpenAI, Anthropic, TokenRouter, OpenRouter, or Google Gemini account, model/deployment, and API key.
- Accepts a small declarative adaptation schema—never AI-generated JavaScript, HTML, remote code, or raw CSS.
- Supports reviewed, origin-scoped DOM-filter automation assets that bind exact observed evidence to packaged actions, run on page load and infinite-feed mutations, and remain previewable, reversible, pausable, and locally persisted.
- Composes those assets from a portable, audited DOM-skill catalog—semantic attributes, exact markers, descendant evidence, semantic containers, evidence clusters, repeating ancestors, and dynamic-content triggers—without website recipes or generated class names.
- Includes a packaged, reversible filter for sponsored feed items, including rendered/accessibility labels, localized or split-letter markers, and standard attribution metadata; providers can enable it but cannot supply executable filtering code.
- Includes a separate packaged, reversible filter for feed posts containing actual video elements.
- For unfamiliar feed filtering, sends bounded observed DOM marker and structure signals to the configured provider; the provider may select only exact observed evidence, and Tweaksy executes it through a validated site-agnostic rule engine.
- Remembers at most 12 chat turns per browser tab in session storage, keeps in-flight generation bound to its originating tab while the user browses elsewhere, and restores its thinking or completed proposal state on return.
- Uses the toolbar popup as a fast off switch: disable only the current origin or shut Tweaksy down everywhere, immediately clear active adaptations, and show the off state with a grayscale toolbar icon. Re-enabling restores eligible saved profiles.
- Supports deterministic headline colors, a full-page article deck with touch swiping, mouse dragging, keyboard navigation, optional side controls, and reversible red-to-blue/teal interface-color remapping.
- Recognizes visible social-feed posts for swipe decks, preserving author, text, and visible image/video media without a generic article button; post details open in a local accessible dialog with a link to the original conversation.
- Keeps preview, measured application results, approval, and undo controls inside the chat instead of claiming an unverified action succeeded.
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

```powershell
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
- `src/validation.ts` — the AI-output safety boundary.
- `src/sidepanel.ts` — accessible chat, approval, and voice workflow.
- `docs/ARCHITECTURE.md` — trust boundaries and lifecycle.
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
