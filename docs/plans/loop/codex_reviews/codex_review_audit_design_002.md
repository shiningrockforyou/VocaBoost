# Codex review — REVIEWONLY_AUDIT_DESIGN round 2

## Verdict

GO.

The v2 audit design resolves the r1 blockers and is ready to build. It is correctly framed as a hybrid audit: UI-driven acceptance for user-reachable behavior, plus a separately reported white-box integration layer for un-drivable gate negatives.

## r1 findings verification

### RAD-1 — Fix #9 review-resume coverage

Resolved.

RA9 directly covers the regression that only this case can catch: `reviewOnlyDay === true` with a real passed same-day new attempt must persist the real new-word score, not null.

Required oracle is correct:

- `recentSessions[last].newWordScore` equals the real score
- `session_state.newWordsTestScore` equals the real score
- `newWordsTestPassed === true`
- TWI stays flat

### RAD-2 — sessionStorage injection / UI-only scope

Resolved by scope split.

RA4/RA4b/W-RA3 are now explicitly white-box integration tests in a separate matrix, not full-UI acceptance. That is the right call. The plan also pins timing after `navigateToTest` writes `dailySessionState` and before submit, with URL guard and readback. That closes the “injection overwritten before it matters” false-pass path.

### RAD-3 — list-end seeding / reconciliation anchor

Conceded for the clean no-attempt seed case.

The cited code supports Claude’s correction:

- With no passed anchor, `hasValidData === false`.
- `safeTWI = Math.max(storedTWI, twi)` preserves seeded TWI.
- Under `LIST_SCOPED_RECON`, `safeCSD` is non-demoting.
- `csd_anchor_invalid` is only logged for an existing malformed passed anchor, not for `anchorStatus === 'none'`.

So raw `class_progress.totalWordsIntroduced` seeding is acceptable for the specific list-end/no-attempt fixtures, provided the mandatory pre-verifier remains. The pre-verifier must fail the run if the loaded session does not produce the intended `isListComplete/newWordCount/segment` state or if system logs show unexpected reconciliation anomalies.

### RAD-4 — base guard

Resolved.

Default local URL plus import-time guard is the right safety posture:

- no live fallback
- guard runs for every importer
- localhost/127.0.0.1 + `http:` only
- guard failure is INVALID / exit 1

### RAD-5 — deterministic intervention setup

Resolved.

Pinned `recentSessions` for RA1/RA2 setup is correct. The measured transition remains UI-driven, which is the important line.

### RAD-6 — artifact binding

Resolved.

The manifest binding fields are sufficient: run id, git/dirty marker, resolved BASE, scenario set, sandbox identity triple, and snapshot hashes.

### RAD-7 — exact sessions path

Resolved.

The plan now names `users/{userId}/sessions`, which matches the implementation path.

### RAD-8 — teacher UI scope

Resolved.

Requiring `PreviousSessionCell` / existing recent-session display is fine. Deferring `CurrentSessionCell` legibility is also correct.

## Open-question rulings

1. List-end seed vs drive: seed is acceptable for clean no-attempt list-end fixtures, with the pre-verifier. Do not seed malformed anchors. RA9 is the only valid-anchor seed case.
2. SessionStorage injection: acceptable only in the separate white-box matrix. It must not be counted as full-UI Playwright acceptance.
3. Intervention setup: seeded `recentSessions` is the deterministic primary path. Organic low-review buildup can be optional realism coverage, not the core certifier.

## Implementation cautions

- Keep `lsr_ui.mjs` free of `page.evaluate`; put all white-box behavior in the new white-box module.
- Ensure the identity guard runs before any Firebase write, not just before login.
- For RA6, the no-advance proof must compare before/after `class_progress`, `recentSessions.length`, and `users/{uid}/sessions` after a settle window.
- For RA5/RA5b, pre-verify the session config before the measured drive; a fixture that does not actually reach the intended state is INVALID, not FAIL and not PASS.
- For RA9, seed a valid position-bearing passed new attempt; do not reuse malformed-anchor scaffolding.

## Final

VERDICT blockers=0 high=0 med=0 nits=0

GO.
