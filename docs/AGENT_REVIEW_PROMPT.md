# Agent Review Prompt: Tweaksy WebMCP Hackathon Project

You are reviewing and improving an OpenAI WebMCP hackathon project.

## Project

- Local workspace: `C:\Users\yuval\OneDrive\מסמכים\Personalize site UI extention`
- GitHub repository: <https://github.com/YoavAlro/tweaksy-live>
- Live demo: <https://tweaksy-live.yoavalro.chatgpt.site>
- Related but separate Chrome extension: <https://github.com/YoavAlro/match-my-web>

## Context

Tweaksy is an accessibility personalization assistant. The extension can adapt arbitrary permitted websites from the outside. Tweaksy Live is the first-party demo website: the website itself exposes WebMCP tools so an AI agent and the user can collaboratively adapt the live page.

The intended hackathon story is:

1. A website owner exposes safe, semantic accessibility capabilities through WebMCP.
2. The user tells Tweaksy what would help in free text.
3. The agent discovers the site's capabilities and proposes an adaptation.
4. The site previews the change visibly.
5. The user approves, rejects, or restores it.
6. The same state is visible to the user, the chat, and the WebMCP agent.

## Current capabilities

The demo currently includes:

- Inspecting page and adaptation state
- Color-safe mode for color-vision limitations
- Low-vision mode with larger type, shorter reading width, reduced motion, and stronger focus
- Browser read-aloud for the demo site's own content
- Timed focus mode with one story at a time and reduced distractions
- Preview, approval, discard, persistence, rollback, and stale-revision protection
- Free-text chat routing to assistive actions
- Strict WebMCP schemas and bounded inputs
- No arbitrary CSS, HTML, JavaScript, URLs, selectors, or unrestricted DOM editing

## Important distinction

- `match-my-web` is the outside-in browser extension and is unrelated to the website's WebMCP implementation.
- `tweaksy-live` is the first-party WebMCP collaboration demo.
- The future idea is a “WebMCP Accessibility Capability Profile” or vocabulary, not a replacement for WCAG, ARIA, WAI-Adapt, CSS preferences, or screen readers.
- The site should expose capabilities; the user or agent should retain the private preference profile.
- Prefer functional preferences such as “avoid color-only distinctions” or “reduce distractions” over diagnoses such as “I am blind.”
- Adaptations must be consent-aware, reversible, scoped to the site, and safe.

## Official sources to review

Review these before making decisions:

- WebMCP specification: <https://webmachinelearning.github.io/webmcp/>
- OpenAI Site Tools/WebMCP documentation: <https://learn.chatgpt.com/docs/webmcp>
- WCAG 2.2: <https://www.w3.org/TR/WCAG22/>
- WAI-ARIA: <https://www.w3.org/TR/wai-aria-1.2/>
- WAI-Adapt: <https://www.w3.org/WAI/adapt/>
- WAI-Adapt explainer: <https://www.w3.org/TR/adapt/>
- Media Queries Level 5: <https://www.w3.org/TR/mediaqueries-5/>
- AccessForAll: <https://www.1edtech.org/standards/accessibility/index>

## Task

1. Inspect the entire repository, README, hackathon documentation, source, tests, and live/demo architecture.
2. Inspect the current official WebMCP hackathon criteria and rubric and evaluate the project against them.
3. Identify what is missing, weak, confusing, or likely to score poorly.
4. Prioritize improvements that make the demo more compelling and competition-relevant, especially:
   - Clear evidence that WebMCP is used by the website itself
   - A meaningful accessibility problem and user story
   - Strong free-text conversation with Tweaksy
   - Visible agent/user collaboration
   - Safe preview → approval → rollback flow
   - Concrete before/after accessibility results
   - Compatibility with existing accessibility standards
   - Clear distinction between site-native capabilities and arbitrary extension manipulation
   - Security, privacy, consent, and prompt-injection boundaries
   - Reliable browser fallback when WebMCP is unavailable
5. Create the missing implementation, documentation, tests, and demo polish directly in the repository.
6. Preserve existing working features and avoid destructive changes.
7. Do not publish, make repositories public, create external pull requests, or change hosting settings unless explicitly requested.
8. Run relevant tests, type checks, build, and local verification. Fix failures.
9. At the end, report:
   - What you found
   - What you changed
   - Which competition criteria are now satisfied
   - Remaining risks or gaps
   - Exact files changed
   - How to run and demonstrate the result

## Technical constraints

- Use the existing architecture and shared controllers.
- Keep WebMCP registration in the top-level page.
- Use closed JSON schemas with bounded enums/numbers and `additionalProperties: false`.
- Never expose arbitrary CSS/HTML/JavaScript/DOM execution as a tool.
- Keep actions semantic and site-native.
- Require state inspection and expected revisions where appropriate.
- Make writes reversible and visibly previewable.
- Keep approval controls stable and accessible even when the page layout changes.
- Preserve keyboard navigation, focus visibility, reduced-motion behavior, semantic labels, and screen-reader compatibility.
- Do not claim that read-aloud replaces a screen reader or that the demo proves WCAG conformance.
- If proposing an accessibility capability vocabulary, implement only a practical, clearly documented prototype rather than presenting it as an official standard.

Start by producing a short findings/priorities summary, then implement the highest-value missing work.
