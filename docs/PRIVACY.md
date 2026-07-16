# Privacy policy draft

Effective date: **not yet published**

Match My Web does not operate a backend, create user accounts, run analytics, sell data, or send data to the developer.

## Data stored on the device

- The AI provider, model name, and API key entered by the user.
- Website origins for which the user approved ongoing access.
- Approved visual adaptation profiles.

This information is stored in Chrome's local extension storage. It is not placed in synced storage and is not made available to website content scripts.

## Data sent to an AI provider

Only after the user chooses **Generate preview**, Match My Web sends the user's request and a bounded snapshot of the permitted current page to the OpenAI, Azure OpenAI, or Anthropic endpoint configured by that user. The snapshot may include the page title, URL origin/path, headings, landmark labels, control labels, and an excerpt of visible text. It excludes form values, password values, editable fields, and URL query parameters.

Optional voice recordings are held in memory, sent to the configured OpenAI account for transcription after the user stops recording, and then discarded. Audio is not saved by the extension.

The selected AI provider processes data under its own terms and privacy policy. Match My Web does not control provider retention. Users should not submit sensitive pages unless their provider configuration and account policy are appropriate.

## Website access

The extension receives temporary access to the active page only after the user activates it. If the user approves and saves a profile, Chrome asks for ongoing access to that exact website origin so the adaptation can be reapplied on future visits. Access can be revoked in Chrome extension settings.

## Data deletion

Uninstalling the extension deletes its local storage. A profile-management screen with individual delete/export controls is required before store submission.

## Contact

Add the publisher's support email and hosted privacy-policy URL before Chrome Web Store submission.
