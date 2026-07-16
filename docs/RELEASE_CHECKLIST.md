# Production and Chrome Web Store release gates

No release is ready until every required item below is checked and evidence is linked from the release issue.

## Reliability

- [x] Abort in-flight provider calls on navigation and replacement requests.
- [x] Reject stale results by tab, document, same-document navigation, and exact URL.
- [x] Persist approved profiles and origin-scoped registrations across browser restarts.
- [x] Reapply within open and newly created closed shadow roots.
- [ ] Add Playwright-in-Chrome E2E tests for reload, restart, multi-tab races, SPA navigation, open/closed shadow roots, and permission denial.
- [ ] Add a global pause/disable control plus profile edit/delete/export/import UI.
- [ ] Test the packaged CRX for 7 consecutive days across the supported Chrome range.

## Accessibility

- [x] Semantic labels, status announcements, keyboard operation, visible focus, 44px controls, reduced-motion support, and light/dark themes.
- [x] Voice is optional; all actions remain available without audio.
- [ ] Run axe-core with zero serious/critical issues.
- [ ] Complete keyboard-only, 200%/400% zoom, high-contrast, NVDA, JAWS, and VoiceOver test passes.
- [ ] Recruit at least five target users with varied visual, motor, cognitive, and speech needs for moderated usability testing.

## Security and privacy

- [x] No remote code or arbitrary model-generated CSS/HTML/JavaScript.
- [x] Credentials confined to trusted local extension contexts.
- [x] Explicit generation and approval boundaries.
- [x] Form values and URL query strings excluded from provider snapshots.
- [ ] Obtain an independent security review and resolve all high/critical findings.
- [ ] Add automated dependency, secret, CSP, and manifest permission checks in CI.
- [ ] Implement profile/key deletion and verify uninstall cleanup behavior.
- [ ] Finalize provider disclosures and a legally reviewed hosted privacy policy.

## Performance

- [x] Bounded extraction and no polling loop.
- [ ] Measure content-script idle CPU, heap, page-load impact, mutation cost, and provider payload size on 50 representative sites.
- [ ] Gate at <1% idle CPU, <10 MB added heap per page, <50 ms p95 local apply time, and <100 ms p95 document-start overhead on reference hardware.

## Chrome Web Store

- [x] Manifest V3 and package-only code.
- [x] Optional per-origin access; no install-time host access.
- [ ] Confirm the product name with trademark counsel and a full store/domain search.
- [ ] Add publisher identity, support email, support URL, and hosted privacy-policy URL.
- [ ] Produce 1280×800 or 640×400 screenshots, a 440×280 small promo tile, and final listing copy.
- [ ] Complete CWS data-use disclosures and single-purpose justification.
- [ ] Upload an unlisted build, run review feedback, then promote the signed artifact unchanged.
- [ ] Prepare incident response, rollback, key-compromise, and release-signing procedures.

## CI command

```powershell
npm ci
npm run check
```
