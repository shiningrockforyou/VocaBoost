# Claude handoff round 1: RUN_S_FLAG_ON_AUDIT

## Objective
Review **Run S plan v1** (`docs/plans/loop/runs/plan.md`) — the implementation-ready design for the flag-ON
behavioral validation suite for LIST_SCOPED_RECON (now LIVE on the cohort). It fills the exact oracles the
design stub (`audit/playwright/RUNS_DESIGN_SPEC.md`) left as TODO. Decision requested: `GO` (oracle-exact +
UI-inducible + no false-green → ready to implement) or `NEEDS_FIXES`.

## Context
- Owner shipped `LIST_SCOPED_RECON=true` today (all 17 attempts composite indexes verified live+READY). So the
  stub's prerequisite ("implement only after a flag-ON build ships") is now MET — Run S is buildable.
- Run L (`audit/playwright/RUNL_RESULTS.md`, certified `L_20260706_014108`) proved flag-OFF neutrality. Run S
  is the flag-ON correctness counterpart, and should mirror Run L's 4-phase bound harness (`lsr_runL*.mjs`).
- Flag-ON semantics are `PLAN_list_progress_persist.md §5.1` (anchor by `newWordEndIndex DESC, submittedAt
  DESC`; `twi=nwei+1`; `CSD=max(stored, reviewForAnchorDay?anchorDay:anchorDay−1)`; review paired to the
  ANCHOR's class + temporal lineage; completion-gate position-consistent; orphan cleanup log-only).

## Claims
1. §1 correctly summarizes the flag-ON reconciliation rules from `progressService.js §5.1`.
2. Each overlay S-1..S-6 has an EXACT oracle (per-doc CSD/TWI + phase), not just negative properties.
3. S-4's oracle is correctly CORRECTED (viewing displays the reconciled position — do NOT assert "no advance").
4. The harness (§2) mirrors Run L's certified rigor (bound by runId, read-only pre/post, Admin-free UI driver,
   anomaly-failing, INVALID-not-PASS).
5. Deferred items (reset/epoch) are correctly scoped out; sparse-legacy fallback (§5) is flagged.

## Verification performed
- Derived every oracle from `PLAN_list_progress_persist.md §5.1` (read the section). Marked ⊳verify-vs-code the
  CSD values (S-1/S-2) that need a final trace against `progressService.js` reconciliation.
- A 3-agent audit is running in parallel (oracle-accuracy / anti-false-green / UI-inducibility) — I'll
  reconcile its findings with yours.

## Known limitations / open questions (§7)
CSD exact values (review-pending vs review-done sub-cases); whether S-5 "results-rebuild" + the sparse-legacy
persona are UI-inducible under the strict no-injection audit policy or must be marked not-UI-reproducible;
live-cohort isolation (Run S drives FRESH per-run sandbox classes, never 26SM).

## Questions for Codex (pressure-test these)
1. **Are the oracle values correct?** Especially S-1 FLAGSHIP: after "Day-1 new pass in A, leave before review,
   enter B" — is `CSD=0`, `twi=p`, phase=Day-1 review-pending exactly what the real reconciliation produces?
   Trace `progressService.js` + `determineStartingPhase`. A wrong oracle = a false-green audit.
2. **False-green paths:** for each overlay, if list-scoped reconciliation were subtly WRONG, would the oracle
   actually go red? Are any oracles too weak (esp. S-4)?
3. **UI-inducibility under the strict policy** (`PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md §1`): is
   "leave before review" (S-1), the class-switch, and S-5's boundaries actually reachable via visible controls,
   or written as if they are?
4. **Coverage:** is every flag-relevant CS incident mapped, or is something missing/over-scoped?

## Requested decision
`GO` (oracle-exact, UI-inducible, no false-green → implement) or `NEEDS_FIXES` (name them for v2).
