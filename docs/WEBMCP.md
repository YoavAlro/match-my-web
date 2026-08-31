# Tweaksy WebMCP architecture

Tweaksy uses WebMCP in two complementary modes. The hosted Harborline surface is a zero-install, first-party challenge demo. The Chrome extension brings a smaller tool surface to real top-level pages after the person activates Tweaksy. In both modes, the page supplies bounded tools and remains the source of truth for visible state.

## Product loop

1. A person opens the fictional Harborline Journal page and sees the same six stories the agent can inspect; the page contains no duplicate Tweaksy chat or control dock.
2. The agent calls a read tool to inspect capabilities and the current revision.
3. The agent proposes a vetted visual adaptation or invokes a semantic assistive capability: color-safe/low-vision preview, browser read-aloud, or timed focus.
4. The person reviews the actual page in ChatGPT and explicitly asks the agent to approve or discard the preview through WebMCP.
5. Approval stores only the validated declarative patch in local storage for this origin. Restore removes it.

ChatGPT's external conversation is the only agent surface. WebMCP tools invoke the page's adaptation and assistive controllers directly, while the page remains a clean publication surface and the person retains consent by explicitly directing the agent to approve, discard, restore, or stop an action.

## Tool surface

| Tool | Kind | Effect |
| --- | --- | --- |
| `inspect_tweaksy_surface` | Read | Returns the demo inventory, supported adaptation capabilities, content counts, and guarantees. |
| `get_tweaksy_state` | Read | Returns revision, effective/approved design, pending preview, verification, and recent activity. |
| `preview_tweaksy_accessibility_mode` | Reversible write | Applies a fixed color-safe or low-vision preview through the normal adaptation controller. |
| `read_tweaksy_content` | Audible local action | Extracts owned Harborline content and starts the browser speech engine; no network is used. |
| `stop_tweaksy_reading` | Restorative local action | Cancels speech started by the page. |
| `start_tweaksy_focus_session` | Timed reversible write | Starts a 10/25/45 minute countdown and a one-story, reduced-distraction preview. |
| `end_tweaksy_focus_session` | Restorative write | Ends the timer, restores page chrome, and discards an unchanged focus preview. |
| `preview_tweaksy_adaptation` | Reversible write | Applies a vetted preview in memory. It never persists and replaces any previous preview. |
| `discard_tweaksy_preview` | Restorative write | Removes the preview and reapplies the last approved design. |
| `approve_tweaksy_preview` | Local persistent write | Saves the exact current preview to this origin’s browser storage. Its description requires an explicit approval request. |

Tools are registered in top-level page JavaScript after feature detection. Browsers without WebMCP retain the complete readable publication, but agent-driven adaptations require a WebMCP-capable browser.

Read aloud deliberately operates only on the fictional first-party Harborline content. It is presented as a browser reading aid, not as a replacement for a screen reader, semantic HTML, or accessibility testing. Focus mode hides only nonessential Harborline chrome with a scoped data attribute; it does not delete content.

## Real-site extension mode

On an ordinary permitted `http` or `https` page, Tweaksy’s main-world script registers four tools with the same names and schemas: inspect, state, preview, and discard. A narrow request/response bridge forwards those calls to the isolated content script, which owns the existing real-page renderer and validates every field again. Raw CSS, HTML, scripts, URLs, selectors, content edits, and arbitrary commands never cross the boundary.

The extension intentionally does **not** register `approve_tweaksy_preview` on third-party pages. DOM events in a page’s main world are not an authentication boundary, so a page must never be able to trigger privileged extension operations. WebMCP can create and undo a reversible visual preview; only the person can grant persistent origin access and approve a saved profile in the Tweaksy side panel. Provider credentials and free-form generation also remain inside trusted extension contexts.

The side panel remains a genuine free-form chat. A person can say “make this calmer, show one article at a time, and reduce motion”; the configured provider maps that request to the same validated `AdaptationPatch` vocabulary. WebMCP gives compatible agents a direct structured path to the visible preview system without duplicating the renderer.

## Input boundary

The preview schema has `additionalProperties: false` at the request and `changes` levels. It accepts only:

- bounded numeric typography and width values;
- fixed layout, control, image, link, theme, scheme, contrast, and color-vision enums;
- two booleans for reduced motion and stronger focus; and
- a fixed enum list of fields that may be reset.

It cannot accept or generate raw CSS, HTML, JavaScript, selectors, URLs, arbitrary DOM operations, network requests, or content deletion. Although the extension domain model includes `hideSelectors`, the Tweaksy Live controller removes that field at every storage and execution boundary.

## Concurrency and approval

Every write requires `expectedRevision`, obtained from `get_tweaksy_state`. A stale call fails with the actual revision and asks the caller to inspect again. Approval additionally requires the opaque id of the exact current preview, preventing an earlier proposal from being saved after a newer proposal replaces it.

Preview state is memory-only. Approved state is local-only. No account, backend, OpenAI API key, provider credential, analytics request, or third-party service is involved.

## Rendering boundary

`HarborlineRenderer` receives only a normalized `AdaptationPatch`. It writes data attributes and CSS custom properties on `[data-tweaksy-demo]`, never on arbitrary page selectors. In story-deck mode, inactive stories remain connected to the document and are restored as the user navigates; total story and link counts are verified after every controller mutation.

The hosted page has no companion dock. The agent receives the revision, preview identity, state, and verification through WebMCP, and the person keeps control by explicitly directing the ChatGPT conversation to approve, discard, restore, or stop an action.

## Verification

Run the complete local gate:

```powershell
npm run check
```

The WebMCP-specific tests cover hosted controller state transitions, semantic mode execution, timed-focus cleanup, persistence, rollback, stale revisions, unsafe fields, schema closure, top-level registration, real-page bridge validation, the no-persistence extension boundary, shared execution, manual fallback controls, and unsupported-browser fallback.

The implementation follows OpenAI’s [Site tools guide](https://learn.chatgpt.com/docs/webmcp): narrow inputs, explicit side effects, verifiable results, existing application permissions, and preserved user control.
