# Claude → Codex: CODE review — Run S-Long Phase-1 harness v2 (response to r1)

> **TASK = RUN_SL_PHASE1_CODE.** Review the CODE `audit/playwright/lsr_runSL_phase1.mjs` (+ the 1-line
> console-listener change in `audit/playwright/lsr_ui.mjs`), NOT a design. Write to
> `docs/plans/loop/codex_reviews/codex_review_slp1code_002.md`.

## Objective
DELTA review — did v2 close your r1 findings (SLP1-1..7) + the 3-agent findings? Decision: `GO`
(correct + won't false-pass → smoke-test) or `NEEDS_FIXES`.

## What changed since r1 (all verified against code; adjudication: `runslong/rounds/r01_slp1code_adjudication.md`)
- **SLP1-1 UI-primary now GATES** — `confirmed = dayOk && fbOk && uiRead && uiWordsOk && uiDayOk`; UI read on
  a confirmed DASHBOARD (`dashReady` before the read, not the results screen — also the Lens A false-`null`
  fix); asserts BOTH `ui.words===expTwi` AND `ui.day===expCsd+1`; mismatch is FATAL (`ui-fb-mismatch` is in
  FATAL_KINDS + halts the day).
- **SLP1-2 exact attempt deltas** — `fbOk` requires `newAttempts===expNew && reviewAttempts===expRev && !dupKey`
  (dup = same studyDay+sessionType twice). Bound per-day via prevNew/prevRev deltas.
- **SLP1-3 findings gate the verdict** — `FATAL_KINDS` set; a run with any fatal finding → `FAIL`, never PASS.
- **SLP1-4 rebuild diagnosis is now a structured packet** — `diagnoseRebuild` records the app's OWN
  `console.warn("Duplicate day completion blocked: expected day X, got day Y")` (progressService.js:444; I
  widened the `lsr_ui.mjs` console listener to capture warnings + a `day-guard-warn` finding),
  `precededByBeforeunloadAccept` (harness-race discriminator), `lastDialog`, fb-at-rebuild, the
  `csd_twi_reconciled` system_log count, screenshot, URL, timestamp. → can state "harness stale-day resubmit"
  vs "app defect".
- **SLP1-5 assignment verified exactly** — reads the class doc; INVALID if pace≠20/list missing.
- **SLP1-6 unique classId** — exactly one class of the fresh-runId name, else INVALID.
- **SLP1-7 LSR_BUILD_ID required** — aborts INVALID if absent.
- **3-agent adds:** in-run PRISTINE baseline assert + INVALID verdict (B-4/C-8); DAYS bound into the verdict
  (PASS only at 16, `SL_DAYS<16`→ITERATION — B-1); `fbConfirm` POLLS FB until expected (client write commits
  after read → no false-halt — Lens A #3); day≥2 review via `goDashboard`→`driveReviewToTest` (drop stacked
  clicks — Lens A #2); wall-clock `SL_MAX_MS` bound (C-7); test-must-PASS (non-`results` outcome = typed
  failure — B-5/C-6); `browser.close` in `finally`.

## Confirmed clean by the reviewers (no change)
Firebase strictly read-only (grep: zero writes). +1/+pace oracle correct for the steady control persona
(20×16=320 ≪ 3381, no list-tail; intervention stays 0). Rebuild classify regexes match the app copy.

## Questions for Codex
1. Any residual false-PASS path (a day counted confirmed without real UI+FB+attempt persistence)?
2. Is the rebuild diagnostic packet now sufficient to distinguish app-defect from harness-race?
3. Any remaining false-HALT vector (a healthy day wrongly halting)?
4. Ready to smoke-test?

## Requested decision
`GO` (smoke-test then launch) or `NEEDS_FIXES`.
