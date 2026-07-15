# Codex review — PERSONAX_HARNESS round 8

## Verdict

NEEDS_FIXES.

The two proposed fixes are directionally right:

- L1/L4 resume should be based on persisted passed-step state, not blindly re-driving new words after a partial day.
- L9 should not use an all-blank deliberate fail; `nCorrect: 1` is safely below the configured `92%` / `30`-question pass threshold and keeps Submit enabled.

But the current rerun evidence exposes one remaining harness bug that blocks a clean L9 certification.

## Findings

### PH8-1 — L9 duplicate detection is global, so a legitimate retake duplicate poisons later normal days

Severity: high

Evidence:

- `audit/playwright/findings/persona_L9_rerun2.json`
- Verdict: `INCOMPLETE (3/4 confirmed; L9 seg0 day4 not confirmed (reason=oracle-mismatch))`
- Day 3 confirms correctly after the one-correct retake fix:
  - expected `new=4`, actual `new=4`
  - `dupKey=true`
  - `expectDup=true`, so day 3 passes.
- Day 4 then has all counters correct:
  - expected `csd=4 twi=320 new=5 rev=3`
  - actual `csd=4 twi=320 new=5 rev=3`
  - UI words/day also match.
- It still fails because `fbState().dupKey` is computed over all attempts in the class/list. The legitimate duplicate from day 3 remains visible on day 4, where `expectDup=false`, so `fbOk` becomes false.

This is a harness oracle bug, not an app regression. The duplicate check must be scoped to unexpected duplicates, not “any duplicate ever existed.”

Required fix:

- Replace the single global boolean `dupKey` with duplicate details, e.g. `dupKeys` / `dupByStudyDay`.
- Treat duplicates as acceptable when they correspond to expected retake days already driven by this persona.
- For the current day, allow the duplicate only when `oracle.dNew > 1`.
- Do not let a prior legitimate retake duplicate fail later non-retake days.

One simple implementation path:

- Track allowed duplicate keys in runner state, e.g. `allowedDupKeys`.
- When a retake day confirms, add that day’s `studyDay/new` key to the allowed set.
- In `fbOk`, reject only duplicate keys not in `allowedDupKeys` plus the current expected retake key.

### PH8-2 — Passed-count resume is the right fix, but keep it tied to final confirmation

Severity: note

The current code changed resume from total attempts to passed attempts:

- `newDone = pre.newPassed > prev.newPassed`
- `reviewDone = pre.reviewPassed > prev.reviewPassed`

That addresses Claude’s retake concern: a failed retake attempt increments `newAttempts`, but not `newPassed`, so it no longer falsely skips the required retake pass.

The remaining risk is operational, not false-green: if a retake run is interrupted after the failed attempt but before the pass, retrying can create an extra failed attempt. The final Firebase assertion will fail closed because `newAttempts` will exceed the oracle. That is acceptable for certification, though it may still cause a rerun to halt.

### PH8-3 — `nCorrect: 1` is robust for the current L9 assignment

Severity: note

The current persona config uses `thr=92` and `testSize=30`. One correct answer is ~3.3%, far below the pass threshold. The assignment setup also verifies `testSizeNew === seg.testSize` and `passThreshold === seg.thr`, so this should not accidentally pass unless the configured test is materially changed.

## Checks performed

- `node --check audit/playwright/lsr_persona.mjs` passed.
- `node --check audit/playwright/lsr_fleet_manifest.mjs` passed.
- Reviewed:
  - `audit/playwright/lsr_persona.mjs`
  - `audit/playwright/lsr_fleet_manifest.mjs`
  - `audit/playwright/findings/fleet_manifest_fleet.json`
  - `audit/playwright/findings/persona_L9_rerun2.json`

## Required before GO

Fix the duplicate oracle so expected retake duplicates do not poison later days. Then rerun at least L9 through the second retake day or through the full L9 arc.

## VERDICT

NEEDS_FIXES
