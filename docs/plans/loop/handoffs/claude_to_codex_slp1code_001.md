# Claude → Codex: CODE review — Run S-Long Phase-1 harness

> **TASK = RUN_SL_PHASE1_CODE.** Review the CODE file `audit/playwright/lsr_runSL_phase1.mjs` (a Playwright
> test harness), NOT a design doc and NOT app source. Write to
> `docs/plans/loop/codex_reviews/codex_review_slp1code_001.md`.

## Objective
Review the IMPLEMENTATION of the Run S-Long Phase-1 harness (day-primitive + rebuild diagnosis). The DESIGN
already GO'd (`docs/plans/loop/runslong/plan.md` v4); this is a code review of the harness before we smoke-test
it. Decision: `GO` (harness is correct + won't false-pass → smoke-test) or `NEEDS_FIXES`.

## What the harness does (read the file directly)
`audit/playwright/lsr_runSL_phase1.mjs`:
- **Fixture:** teacher UI-creates one class + assigns the TOP list (pace 20); a PRISTINE sandbox student joins.
- **`advanceOneDay`:** `dashReady` (reload to public entry, ACCEPT beforeunload, verify class landing ×3) →
  `driveNewWordsToTest`→`driveTest` (pass via wordmap) → for day≥2: continue→`driveReviewToTest`→`driveTest`.
  Day 1 has no review. Classifies the rebuild screen: `clean` / `rebuild` (recoverable) /
  `rebuild-clear-failed` (HARD STOP).
- **16-day loop:** bounded rebuild recovery (×3/day) + **fail-closed per-day confirmation** — UI
  (`readVisibleProgress` words == expected twi, PRIMARY teeth) + Firebase READ-ONLY (csd==prev+1, twi==prev+pace);
  HALT if a day isn't driven+persisted. Records rebuild diagnosis.
- **Verdict:** PASS (16 confirmed days) / HALT (rebuild-clear-failed) / INCOMPLETE.
- Reuses `lsr_ui.mjs` + `lsr_teacher.mjs` helpers. Firebase Admin is read-only (never written to advance).

## Key design constraints to check against
- **UI-primary, Firebase read-only corroboration** — never write Firebase to advance a run (owner ruling).
- **Fail-closed** — a day never counts as confirmed unless it actually persisted.
- **Rebuild:** recover the `rebuild` branch, HARD-STOP the `rebuild-clear-failed` dead-end, and DIAGNOSE why it
  fires (owner ruling #2).
- Sandbox only (fresh `25WT RUNSL P1` class + pristine `lsr_s*`), never 26SM.
- A Claude 3-agent audit (correctness / false-green / robustness) runs concurrently; I'll reconcile + adjudicate.

## Questions for Codex
1. **False-pass:** can the harness report PASS when a day didn't actually happen? Is the `persisted` check
   (exact fb.csd/twi) strong enough given the account is only ASSUMED pristine (no in-run baseline assert)?
2. **Firebase read-only:** confirm no write path advances a run.
3. **Expected-delta:** is `+1 csd / +pace twi` every day correct for this steady single-class control persona
   (no intervention, no list-tail at 20×16=320 vs 3381)?
4. **Rebuild diagnosis:** is the recorded `{day, at, screen}` enough to tell "app defect" from "harness race",
   or what instrumentation should be added (owner ruling #2)?
5. **Robustness:** any hang (unbounded await), infinite loop, or a transient hiccup that spuriously HALTs?

## Requested decision
`GO` (correct + won't false-pass → smoke-test then launch) or `NEEDS_FIXES` (concrete code defects).
