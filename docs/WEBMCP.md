# Tweaksy Live WebMCP architecture

Tweaksy Live turns Tweaksy’s safe adaptation model into a hosted human-agent collaboration surface. ChatGPT supplies the reasoning; the page supplies bounded tools and remains the source of truth for live state.

## Product loop

1. A person opens the fictional Harborline Journal page and sees the same six stories the agent can inspect.
2. The agent calls a read tool to inspect capabilities and the current revision.
3. The agent proposes a vetted visual adaptation. Tweaksy renders it as an unsaved preview and returns preservation evidence.
4. The person reviews the actual page and either approves or discards the preview in the persistent dock.
5. Approval stores only the validated declarative patch in local storage for this origin. Restore removes it.

The manual “One story at a time” action invokes the exact same controller as `preview_tweaksy_adaptation`. There is no parallel agent-only state path.

## Tool surface

| Tool | Kind | Effect |
| --- | --- | --- |
| `inspect_tweaksy_surface` | Read | Returns the demo inventory, supported adaptation capabilities, content counts, and guarantees. |
| `get_tweaksy_state` | Read | Returns revision, effective/approved design, pending preview, verification, and recent activity. |
| `preview_tweaksy_adaptation` | Reversible write | Applies a vetted preview in memory. It never persists and replaces any previous preview. |
| `discard_tweaksy_preview` | Restorative write | Removes the preview and reapplies the last approved design. |
| `approve_tweaksy_preview` | Local persistent write | Saves the exact current preview to this origin’s browser storage. Its description requires an explicit approval request. |

Tools are registered in top-level page JavaScript after feature detection. Browsers without WebMCP retain the complete human workflow.

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

The Tweaksy dock sits outside the adapted surface. This keeps approval controls stable even when the demonstration page changes theme, layout, typography, focus, or motion behavior.

## Verification

Run the complete local gate:

```powershell
npm run check
```

The WebMCP-specific tests cover controller state transitions, persistence, rollback, stale revisions, unsafe fields, schema closure, tool registration, shared execution, and unsupported-browser fallback.

The implementation follows OpenAI’s [Site tools guide](https://learn.chatgpt.com/docs/webmcp): narrow inputs, explicit side effects, verifiable results, existing application permissions, and preserved human controls.
