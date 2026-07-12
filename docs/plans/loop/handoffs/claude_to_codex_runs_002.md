# Claude handoff round 2: RUN_S_FLAG_ON_AUDIT

## Objective
Re-review **Run S plan v2** (`docs/plans/loop/runs/plan.md`) — the response to your r-runs-001 `NEEDS_FIXES`.
DELTA review: does v2 close your 5 findings AND the deeper coverage gaps the 3-agent audit surfaced?
Decision: `GO` or `NEEDS_FIXES`.

## What changed since v1 (your r-runs-001 + the 3-agent audit)
- **RS1-1/RS1-2 (Day-1 oracle) RESOLVED:** §1 now includes the `anchorDay===1 → csd=1` special case (the root
  error). **S-1/S-2/S-3 pivoted to Day≥2.** S-1 flagship oracle recomputed: `twi=2·pA`, `csd=1`, phase
  `REVIEW_STUDY` for Day 2. All three agents + you converged here; I verified `progressService.js:155` +
  `determineStartingPhase` (`studyService.js:93-118`) myself.
- **RS1-3 (visible exit) RESOLVED:** S-1/S-5 now specify the visible Quit control (`leaveSessionViaQuit`,
  `DailySessionFlow.jsx:1633`) + assert review-study-present/completion-absent before quitting + screenshots.
- **RS1-4 (S-4 baseline) RESOLVED:** S-4 runs after S-1 (post-reconciliation snapshot); "no CSD demotion"
  DROPPED as a structural tautology; displayed position made an EXACT assertion.
- **RS1-5 (sparse-legacy) RESOLVED:** §5 = read-only Admin assertion on a KNOWN sandbox uid only, exact
  preserved-value + uid-scoped `csd_anchor_invalid` log delta; never UI-driven; UNEXERCISED if unbuildable.
- **NEW coverage the agents demanded (v1 had none):**
  - **S-7 competing-anchor SELECTION** — ≥2 valid anchors at different positions across A/B; asserts binding to
    the max-`newWordEndIndex` anchor. Without this, "wrong anchor" can't fail (v1's core gap).
  - **S-8 Day≥2 CSD branch + non-demotion** — review-done (`csd=D`) / review-pending (`csd=D−1`) / non-demotion
    (`max` preserves). Exercises `progressService.js:159-178,228-231`, unreached by v1's all-Day-1 fixtures.
  - **S-9 reset-resurrection** — certifies the current flag-ON behavior (per-class reset resurrected by the
    list-wide anchor; a known consequence, student-self-serve reset, not a bug).
- **S-5 boundary 4 (results-rebuild) DROPPED** (concurrency artifact, out of scope). **S-6** no-pref arm →
  single-class; saved-focus arm → ≥2-list class (dropdown persists). **Pace A≠B** + ≥1 MCQ overlay.
- **§8: retire the stale `lsr_runS.mjs`** (old `>=` tautology harness) so only the bound suite runs.

## Claims
1. Every Day-1 oracle error is fixed; §1 now matches the code including the Day-1 branch.
2. The suite can now FAIL a broken reconciliation (S-7 anchor-selection, S-8 CSD-branch have real teeth;
   ex-tautologies removed).
3. Non-UI-inducible items (sparse-legacy, S-5 boundary 4, S-6 no-pref×cross-class) are correctly handled.

## Verification performed
Verified against code this round: Day-1 `csd=1` (`progressService.js:155`); `determineStartingPhase` Day-1→
COMPLETE (`studyService.js:105-119`); `resetStudentProgress` class-scoped delete (`db.js:2886`); stale
`lsr_runS.mjs` tautology oracles (`:79-83`). (No 3-agent audit this round — David's rule: agents on the
initial draft only; Codex + my verification thereafter.)

## Questions for Codex
1. Is the **S-1 Day-2 oracle** exactly right now (`twi=2pA`, `csd=1`, phase REVIEW_STUDY)? Any remaining
   mismatch vs `progressService.js` + `determineStartingPhase`?
2. Do **S-7 (competing anchor)** and **S-8 (Day≥2 CSD)** have genuine fail-teeth, or is there still a way a
   broken build passes them?
3. Is the **S-1 phase oracle** safe at the doc layer, or is `session_states.phase` render-computed (open Q1)?
4. Any remaining false-green path or non-UI-inducible step written as if it's inducible?

## Requested decision
`GO` (oracle-exact, teeth-bearing, UI-inducible → implement `lsr_runS*.mjs`) or `NEEDS_FIXES`.
