# Threat model

## Protected assets

- Provider API keys.
- Page content, including potentially sensitive visible text.
- The user's approved profiles and browsing origins.
- Page integrity and the user's ability to undo changes.

## Primary threats and controls

| Threat | Control |
|---|---|
| Late AI response changes a new page | Tab, document, navigation, and exact-URL checks before and after generation and again at apply time; navigation aborts in-flight work. |
| Prompt injection asks the model for code or data exfiltration | The page snapshot is marked as data; output is parsed as a fixed declarative schema; no generated code is executed. |
| CSS-based network exfiltration | URLs, imports, data schemes, risky attribute selectors, and `:has()` are rejected; CSS declarations are generated locally. |
| Credential exposure to pages | Keys live only in trusted extension storage and the service worker; content-script storage access is disabled. |
| Silent broad browsing access | Temporary access comes from a toolbar action; ongoing access is requested for the exact origin only when saving. |
| Accidental form/secret capture | Snapshot traversal excludes inputs, textareas, selects, password fields, and editable regions and never reads `.value`. |
| Irreversible or functional breakage | Preview is a replaceable style node, undo restores the last approved patch, and the model is instructed never to hide essential controls or landmarks. |
| Malicious page forges the shadow event | The event has no privileged capability, data, or secrets; the main-world hook independently clamps its fixed visual payload. |
| Malicious page calls or forges the WebMCP bridge | The bridge exposes only page-readable inventory plus reversible changes to that same page. The isolated script revalidates a closed schema. Provider calls, credentials, permissions, approval, persistence, and extension storage are not reachable through the bridge. |
| Remote code in the extension | Manifest V3 package-only scripts and an extension CSP that permits scripts only from `self`. |
| Audio retained unexpectedly | Media is kept in memory, capped at 60 seconds, sent only after recording, and discarded after transcription. |

## Residual risks

- A visually safe selector can still hide content the user later needs. Preview and explicit approval mitigate this; a future release should add per-rule toggles and an emergency global disable command.
- Visible page text can contain sensitive data. The UI must continue to explain exactly when it is sent to the selected provider.
- Provider policies and retention vary. Release documentation must link to each provider's current policy and make clear that the developer does not operate the provider.
- A compromised extension process can read local keys. OS account security and Chrome's extension isolation remain dependencies. Future versions may support short-lived provider tokens or native keychain-backed helpers.
- A page can observe or imitate main-world DOM events and can misrepresent its own DOM state. Tweaksy therefore treats the bridge as non-authenticated and grants it no capability beyond reversible changes the page itself could already make. Human review of the visible page remains authoritative.
