# Run L harness — Codex review brief (2026-07-05)

**Ask:** adversarially review the **Run L** harness the same way you reviewed the F02/F03 acceptance harness
(6 rounds). Find every path by which it could report a false GREEN, or fail to actually prove what it claims.
This harness is NEW and has NOT been reviewed. I already caught one false-green (below); assume there are more.

## What Run L is supposed to prove
Gate before enabling `LIST_SCOPED_RECON`. Claim: **the deployed Phase-1 code is behavior-NEUTRAL with the
flag OFF** — realistic study activity must produce NONE of the flag-on-only effects. (Flag currently OFF in
prod; Phase-1 code deployed dormant.)

## Architecture — bound 3-process pipeline (runId ties all artifacts)
1. `lsr_runL_verify.mjs --pre <runId>` — **read-only Admin**; snapshots the persona set → `runL_pre_<runId>.json`.
2. `lsr_runL.mjs <runId>` — **Admin-free** browser driver; each persona logs in + `studyOneDay` (exercises the
   flag-gated recon path) → `runL_activity_<runId>.json`.
3. `lsr_runL_verify.mjs --post <runId>` — **read-only Admin**; snapshots again, binds to the exact `--pre` +
   `activity` for this runId, asserts invariants, writes `runL_verdict_<runId>.json`, prints FINAL: PASS/FAIL.

**Files to review:** `lsr_runL.mjs`, `lsr_runL_verify.mjs`, `lsr_runL_personas.json` (+ shared primitives in
`lsr_ui.mjs`: `login`, `studyOneDay`, `readVisibleProgress`).

## Flag-off invariants asserted (any violation ⇒ FAIL)
- **I1** ZERO `list_progress` docs (that collection is written ONLY when flag ON) — asserted ABSOLUTE, not delta.
- **I2** ZERO new flag-on-only `system_logs` (orphaned_attempt_flagged, day_guard_*_cleared, list_progress_quarantined, csd_anchor_invalid, csd_anchor_query_error) — delta vs `--pre`.
- **I3** TWI never regresses. **I4** every NEW attempt carries a valid anchor. **I5** no review attempt deleted.
- **I6** no impossible session states. **I7** collision persona `lsr_s13` keeps ≥2 class_progress on TOP (no collapse).
- **ACTIVITY** (added after the false-green): binds `runL_activity`, requires `allDriven` AND per-persona
  new-attempt delta > 0 — a persona that did nothing cannot certify neutrality.

## KNOWN ISSUES (self-disclosed)
1. **[CAUGHT + FIXED] False-green on run `L1_122152`:** verifier printed FINAL: PASS while only **2/4 personas
   actually studied** (s13, s01 no-op'd) — invariants held trivially for the two that did nothing. Fixed by the
   ACTIVITY binding above; re-running `--post` on L1_122152 now correctly returns **FINAL: FAIL** (3 problems).
   → Review whether the fix is sufficient, or if other trivial-pass paths remain.
2. **[OPEN] Personas don't reliably study.** `s13` (the KEY collision case) was at day-3 and didn't advance
   (likely "done today" — accounts were built earlier the same day); `s01` (enrolled, no progress) never
   resolved a studyable dashboard (likely phantom-membership / focus). So the collision case — the whole point
   — was never exercised. The persona set + driver need to reliably drive all personas.
3. **[OPEN] Day-number discrepancy:** read-only shows `s03`/`s10` at `csd=2`, but the driver's
   `readVisibleProgress` saw `day 1→2` (implying csd 0→1). Either a focus mismatch in `readVisibleProgress` or
   a state discrepancy — needs explaining.

## Specific things I want scrutinized (likely false-green surface)
- Is **I1 absolute-zero** correct, or should it be a delta vs `--pre`? (Chosen absolute because these personas
  have none; is that assumption safe across the set / re-runs?)
- Is **"per-persona new attempt > 0"** a sufficient proof that the **flag-gated reconciliation path** actually
  ran? Could attempts be created without touching the flag-gated readers?
- **I7** hardcodes `lsr_s13` + the TOP list id — brittle and specific; is it even meaningful if s13 never studies?
- **Binding completeness:** does `--post` fully prevent stale/partial artifacts (exact `--pre` + `activity` by
  runId; runId match)? Any path where a prior run's files leak in?
- **Fundamental A/B gap:** Run L can only assert "no flag-on effects appear," not compare against a pre-Phase-1
  build. Is invariant-assertion a sufficient neutrality proof, or is a stronger design needed?
- **Same-day "done today"** may be a structural limit on driving these personas — is the persona strategy sound?

## Artifacts from the run
`findings/runL_pre_L1_122152.json`, `runL_activity_L1_122152.json`, `runL_verdict_L1_122152.json`,
`B_LIST_PROGRESS_PHASE1_RUNL_L1_122152.md` (raw findings), `runL_driver_console.log`.

**Status: NOT certified. Preliminary result is FINAL: FAIL (correctly). Awaiting Codex review before any
re-run is trusted.**
