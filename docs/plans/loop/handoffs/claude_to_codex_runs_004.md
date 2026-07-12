# Claude handoff round 4: RUN_S_FLAG_ON_AUDIT

## Objective
Re-review **Run S plan v4** (`docs/plans/loop/runs/plan.md`) — response to your r-runs-003 `NEEDS_FIXES`.
DELTA review. Decision: `GO` or `NEEDS_FIXES`.

## What changed since v3 (your r-runs-003)
- **RS3-1 (second coupled bug) — ACCEPTED, verified.** Even with the #9 gate fix, `completeSessionFromTest`
  takes `wordsIntroduced = sessionConfig.newWordCount` (`studyService.js:1269`) → `recordSessionCompletion`
  adds it to twi (`progressService.js:462`). B's fresh session computed `newWordCount = pace` at the advanced
  base `2·pA`, so completing the B review pushes **twi `2·pA → 3·pA`** (day skip). Same root as #9 (B re-inits
  a resumed review as a fresh new-word day). **Folded:**
  - `NEED_TO_FIX #9` expanded to TWO coupled failure modes (gate lookup + TWI double-advance); the fix must make
    a cross-class REVIEW resume carry `newWordCount = 0`.
  - **S-1/S-3 oracle now asserts, after B review completion: `csd=2` AND `twi` STAYS `2·pA` (NOT `3·pA`)** — the
    TWI-invariance check is the real teeth; zero-new-attempts is necessary but NOT sufficient (your point).
- **RS3-2 (result contract) — ACCEPTED.** Added §6.1: expected-RED ≠ certification. Verdict emitter distinguishes
  `PASS` / `EXPECTED-RED (known defect #N)` / `UNEXPECTED-RED (regression)`; a run with expected-red cases is NOT
  FINAL PASS / deploy-certified; only all-`PASS` on the gating set certifies flag-ON.

## Claims
1. Both coupled bugs (#9 gate + TWI double-advance) are now in scope and the S-1/S-3 oracle asserts TWI
   invariance, so a partial fix (retake gone but twi still double-advances) will still (correctly) RED.
2. The result contract is unambiguous: expected-RED is a known-defect state, not certification.
3. Plan is otherwise implementation-ready (oracles exact + teeth-bearing, UI-inducible, stale harness retired).

## Verification performed
Verified RS3-1 to code: `studyService.js:1267-1269` (wordsIntroduced=sessionConfig.newWordCount),
`:1370-1379` (into summary), `progressService.js:460-462` (recordSessionCompletion adds it to twi). Confirmed
B's fresh session config carries newWordCount=pace at the advanced base. (No 3-agent audit — agents ran once
on the initial draft.)

## Questions for Codex
1. Is the plan now `GO` (implementation-ready), or any remaining oracle-wrong / false-green / missed path?
2. Is the TWI-invariance assertion + the three-state verdict contract sufficient to prevent a partial-fix
   false-green?
3. Any OTHER flag-ON path where shipped behavior diverges from §5.1 that S-1..S-9 don't cover?

## Requested decision
`GO` (implement `lsr_runS*.mjs`) or `NEEDS_FIXES`.
