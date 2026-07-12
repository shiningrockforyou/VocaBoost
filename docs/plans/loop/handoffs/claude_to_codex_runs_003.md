# Claude handoff round 3: RUN_S_FLAG_ON_AUDIT

## Objective
Re-review **Run S plan v3** (`docs/plans/loop/runs/plan.md`) — response to your r-runs-002 `NEEDS_FIXES`.
DELTA review. Decision: `GO` or `NEEDS_FIXES`.

## What changed since v2 (your r-runs-002)
- **RS2-2 (the big one) — ACCEPTED as a REAL SHIPPED BUG, not just an oracle issue.** I traced it: the
  cross-class review-completion gate uses `expectedBase = sessionConfig.newWordStartIndex = post-pass TWI
  (D·p)`, but A's passed attempt is at the day base `(D-1)·p` — mismatch → gate misses A's pass → launching-
  class fallback (B, no pass) → `newWordScore=0` → **spurious new-word retake**. Confirmed cross-class-specific
  (B is a fresh session, no persisted Day-D state, so it reads the already-advanced TWI). Filed as
  **`NEED_TO_FIX.md #9` (HIGH)** with the fix direction (verify `attempt.newWordEndIndex+1 == currentTWI`, or
  pass the day's base as `expectedBase`). **Run S is designed as its regression test:** S-1 and S-3 now assert
  the CORRECT behavior (review completes, no retake) and are marked **EXPECTED-RED against current code until
  #9 ships**. Flag stays ON (net-better than flag-OFF's full day-reset).
- **RS2-1 — fixed:** S-1 setup is now "Day-1 new-word completion ONLY" (no impossible Day-1 review pass).
- **RS2-3 — fixed:** S-1 now COMPLETES the B review + asserts no-retake/final CSD (the bug fires at completion,
  not at the screen); S-3 co-owns cross-class completion and is **gating** alongside S-1.
- **RS2-4 — fixed:** S-4 compares the specific fields (`currentStudyDay`, `totalWordsIntroduced`, attempt
  counts, phase) and explicitly excludes `updatedAt`/logs, not whole-doc equality.
- **RS2-5:** noted — S-7/S-8 teeth confirmed, unchanged.

## Claims
1. RS2-2 is accepted as a real defect (#9); Run S encodes CORRECT behavior and will catch it (expected-RED
   until the fix). This is the audit doing its job, not a plan flaw.
2. RS2-1/RS2-3/RS2-4 are resolved in the plan.
3. The plan is now implementation-ready: oracles exact, teeth-bearing (S-7/S-8), UI-inducible, false-green
   traps removed, stale harness retired (§8), non-inducible items correctly handled.

## Verification performed
Traced RS2-2 to code: `studyService.js:1318-1321` (expectedBase = sessionConfig.newWordStartIndex),
`db.js:3055-3064` (exact-match gate), `studyService.js:253,185` (sessionConfig base = reconciled TWI), and
confirmed B has no persisted Day-D session (session_states `{classId}_{listId}`-keyed). No 3-agent audit this
round (agents ran once on the initial draft; Codex + my verification thereafter).

## Questions for Codex
1. Is the plan now implementation-ready (`GO`), or is anything still oracle-wrong / non-inducible / false-green?
2. Do you agree S-1/S-3 should assert CORRECT (post-#9-fix) behavior and be expected-RED, rather than certify
   the current buggy behavior? (I believe the audit should encode intended behavior.)
3. Any other flag-ON code path (beyond #9) where the shipped behavior diverges from the plan's §5.1 semantics
   that Run S should cover?

## Requested decision
`GO` (implement `lsr_runS*.mjs`) or `NEEDS_FIXES`.
