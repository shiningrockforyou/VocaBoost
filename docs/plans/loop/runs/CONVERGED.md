# Run S plan — CONVERGED (GO)

**Final plan:** `docs/plans/loop/runs/plan.md` (v5). **Verdict:** Codex `GO` (round 5,
`codex_reviews/codex_review_runs_005.md`) + Claude verification agree — implementation-ready as a design.

## Loop summary (5 rounds)
- **Reviewers:** 3-agent audit (once, on v1) + Codex long-turn (r-runs-001..005).
- **Round 1:** all 4 reviewers independently caught the Day-1 flagship oracle error (verified) + the
  anti-false-green agent found the suite had no teeth for anchor-selection / Day≥2 CSD. → v2.
- **Rounds 2–5:** each Codex round uncovered a distinct facet of ONE shipped bug cluster (`NEED_TO_FIX #9`):
  RS2-2 completion-gate lookup mismatch → RS3-1 TWI double-advance → RS4-1 cross-class A/B divergence. Each
  verified against code and folded; the Run S S-1/S-3 oracle now asserts the CORRECT (post-fix) behavior with
  a 3-state verdict contract (PASS / EXPECTED-RED / UNEXPECTED-RED).

## Primary outcome (beyond the audit design)
The loop uncovered a real, live, HIGH-severity bug in the flag-ON flagship flow — **`NEED_TO_FIX #9`, a
three-part coupled bug** (gate lookup + TWI double-advance + cross-class convergence) in cross-class review
completion. It affects the exact partial-day-switch cohort the feature targets (이주헌/박주하/손진욱). Run S is
now the precise regression spec + acceptance test for that fix.

## Implementation notes (Codex GO-notes — follow when implementing)
1. Executable oracle binds BOTH `A_L` and `B_L` convergence (not `B_L` only) — folded into S-1.
2. A-after-B re-entry is a GATING doc-layer assertion, not a screenshot.
3. Pre-#9-ship Run S output = `EXPECTED-RED (known defect #9)`, not FINAL PASS.
4. Retire/hard-disable the stale `audit/playwright/lsr_runS.mjs` before relying on any Run S results (§8).

## Next (open — for owner direction)
Two coupled work items, both scoped by this loop:
- **Fix `#9`** (the live bug) — small change on the hardened LIST_SCOPED_RECON path; must go through the loop +
  owner deploy. Acceptance = the Run S S-1/S-3 oracle.
- **Implement Run S** (`lsr_runS*.mjs`, mirror the certified `lsr_runL*.mjs` 4-phase bound pipeline) — the
  automated regression harness; runs expected-RED until #9 ships, then certifies flag-ON.
