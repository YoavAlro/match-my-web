# Chrome Web Store listing draft

## Name

Match My Web

## Short description

Describe, preview, and save private visual website adaptations using your own AI provider.

## Detailed description

Match My Web helps you make websites fit the way you read, focus, and navigate.

Describe what would help in plain language or record a short request. Match My Web inspects only the page you explicitly permit, asks your own AI provider for a constrained visual suggestion, and shows you exactly what would change. Nothing is applied until you preview it. Nothing becomes permanent until you approve it.

Approved profiles stay on your device and can return after reloads, navigation, and browser restarts. The extension supports modern sites that use shadow DOM and blocks late AI responses from affecting a page you have already left.

Privacy by design:

- No Match My Web account or developer-operated server.
- Your own AI provider, model, and API key.
- No analytics, advertising, or data sale.
- Temporary current-page access by default.
- Ongoing access requested only for a site whose profile you save.
- No AI-generated scripts, HTML, or arbitrary CSS.
- Reversible previews and a clear approval step.

Match My Web is designed to complement—not replace—browser zoom, screen readers, and website accessibility work.

## Single purpose

Allow users to describe, preview, save, and automatically reapply safe visual adaptations to websites they individually authorize.

## Permission justifications

- `activeTab`: inspect and preview changes on the page the user explicitly activates.
- `scripting`: run the packaged inspection and adaptation code on an authorized page.
- `sidePanel`: provide a persistent, accessible conversation and review interface.
- `storage`: keep credentials and approved profiles locally.
- Optional website origins: contact the chosen AI provider or reapply an approved profile on that specific origin. Origins are requested at runtime, not install time.
