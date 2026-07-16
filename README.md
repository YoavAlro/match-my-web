# Match My Web

Match My Web is a privacy-first Manifest V3 Chrome extension that lets a person describe visual website adaptations in plain language, preview them safely, and save approved changes as local site profiles.

## What works in this MVP foundation

- Inspects only the active `http`/`https` page after a user action.
- Sends a bounded, value-free page snapshot only when the user chooses **Generate preview**.
- Uses the user's OpenAI, Azure OpenAI, or Anthropic account, model/deployment, and API key.
- Accepts a small declarative adaptation schema—never AI-generated JavaScript, HTML, remote code, or raw CSS.
- Validates and clamps every AI field and rejects risky selectors.
- Applies previews reversibly and saves only after a separate approval.
- Requests ongoing access to the approved origin only; other sites remain inaccessible.
- Persists profiles in `chrome.storage.local` and registers origin-scoped document-start scripts across reloads and browser restarts.
- Styles the document plus open and newly created closed shadow roots.
- Rejects stale results using a four-part guard: tab ID, document token, same-document navigation token, and exact URL.
- Supports keyboard input and optional push-to-record transcription. Audio is never saved.

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
4. Pin Match My Web, open a normal website, and activate the toolbar button.

The extension requests no site access at install time. Clicking the toolbar provides temporary `activeTab` access. Approving a profile prompts for persistent access to that single origin.

### Azure OpenAI setup

Choose **Azure OpenAI** in the provider panel and enter:

- **Azure resource endpoint:** the value from Azure's Keys and Endpoint page, such as `https://your-resource.openai.azure.com`. A pasted `/openai/v1/` path is safely normalized.
- **Model or deployment name:** the Azure deployment name—not necessarily the underlying model name.
- **API key:** either key from the Azure resource. It stays in local extension storage and is sent only to that Azure hostname in the `api-key` header.
- **Voice transcription deployment:** optional; provide a separately deployed Azure speech-to-text model if recording should work.

The extension uses Azure's unified `POST /openai/v1/chat/completions` API and requests runtime permission for that exact Azure origin.

## Repository guide

- `src/background.ts` — permission boundary, request cancellation, provider calls, persistence, and stale-result enforcement.
- `src/content.ts` — bounded inspection and reversible page adaptation.
- `src/main-world.ts` — no-secret bridge that styles shadow roots, including closed roots created after the hook starts.
- `src/validation.ts` — the AI-output safety boundary.
- `src/sidepanel.ts` — accessible chat, approval, and voice workflow.
- `docs/ARCHITECTURE.md` — trust boundaries and lifecycle.
- `docs/THREAT_MODEL.md` — security analysis and mitigations.
- `docs/RELEASE_CHECKLIST.md` — production and Chrome Web Store gates.

## Important limits

- Chrome internal pages, the Chrome Web Store, and other restricted schemes cannot be inspected or changed.
- A closed shadow root created before temporary injection cannot be reached until the page reloads after origin approval. Approved profiles inject at document start and cover subsequently created roots.
- Voice transcription works with OpenAI and with Azure OpenAI when the user provides a separate speech-to-text deployment. Text requests work with OpenAI, Azure OpenAI, and Anthropic.
- The build is an MVP foundation, not yet a published Chrome Web Store release. Complete every gate in `docs/RELEASE_CHECKLIST.md` before submission.

## Brand

**Match My Web** keeps the intent of the working name “Match My Exp” while being easier to understand, pronounce, and find. The mark combines a speech bubble with adjustment controls. It is legible at 16px, avoids color-only meaning, and uses high-contrast navy, white, blue, and amber.
