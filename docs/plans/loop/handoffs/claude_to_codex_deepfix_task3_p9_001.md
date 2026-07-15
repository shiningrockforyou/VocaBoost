# Claude → Codex: DEEPFIX Task 3 P9 (CYC) — review the cycling capstone DRAFT

> **TASK = DEEPFIX_TASK3_P9, round 1.** The FIX_PLAN Phase P9 (CYC — per-student finished-list lap cycling,
> "start over"), the capstone on the now-converged server-authoritative-twi foundation (P3–P6). Implemented as a
> **LOCAL-ONLY, dormant, DOUBLE-gated draft**: global build flag `CYCLING_ENABLED=false` (client
> `featureFlags.js` + server `foundation.js`) AND per-assignment `cyclingEnabled`. Review for correctness +
> flag-off byte-equivalence. Write `/out/reviews/codex_deepfix_task3_p9_001.md`, VERDICT (+ CONVERGED-OK if
> clean), flip → claude. ADJUDICATE U1–U12.

## BINDING RULE (David): "always verify all claims… Never trust blindly. Always verify."
Trace every lap-math + gate claim to the code + `docs/plans/loop/x/plan.md` v5 (the hardened, Codex-reviewed spec).

## Read
- **Spec:** `docs/plans/loop/x/plan.md` v5 (§2 monotonic virtual index; §3a reconciliation-UNCHANGED; §3c the ONE
  `resolveVirtualRange` + consumer inventory; §3d review-pool single-mechanism + DROP batch-clear; §3e display;
  §3f rollover; §3g the hard prerequisite) + `audit/deepfix/task2/FIX_PLAN.md` Phase P9 (`:762-788`, esp. the
  **lap-aware M4** integration point).
- **Draft + uncertainties:** `audit/deepfix/task3/P9_impl_notes.md` (U1–U12; adjudicate each). Diff:
  `audit/deepfix/task3/phase9_diff.patch` (`git apply --check` clean, round-trip verified).
- **Changed files:** `src/config/featureFlags.js` (global gate), `src/services/studyService.js` (core:
  `isCyclingActive`/`computeLapView`/`resolveVirtualRange`; cap removal `:341-343`; lap-bound `getUnmasteredPool`/
  `getFailedFromPreviousNewWords`; `getNewWords` cycling param), `functions/foundation.js` (server gate
  `cyclingAllowed()` `:181`; **lap-modular M4 clamp**; `completeSession`/`advanceForChallenge` lap-aware),
  `src/services/db.js` (`cyclingEnabled` write), `DailySessionFlow.jsx`/`MCQTest.jsx`/`Dashboard.jsx`/
  `ClassDetail.jsx`/`SessionSummaryCard.jsx` (lap-aware display + capability-gated "Start over").

## Verify (priority)
1. **Flag-off byte-equivalence:** with `CYCLING_ENABLED===false`, does EVERY touched leg take today's exact
   path? (Orchestrator pre-checked the top-level gate in studyService.js:66-67 + foundation.js:181-182 —
   confirm across ALL files incl. the added inert return fields `cyclingActive/cycleLength/lapView` and the UI
   markup.) A behavior change when off = BLOCKER.
2. **Monotonic virtual index (§2/§3a):** `twi` NEVER wraps; only the LOOKUP wraps (`positions[i mod cycleLength]`,
   `cycleLength := positions.length`). Reconciliation/anchor path UNTOUCHED (greatest-nwei still climbs). Any path
   that wraps the COUNTER = re-stick BLOCKER.
3. **`resolveVirtualRange` correctness:** straddle day (tail+head in virtual order) off-by-one-free; all §3c
   consumers routed; review pool lap-bounded `[lap·cL, twi mod cycleLength)` as the SINGLE mechanism (batch-clear
   correctly DROPPED).
4. **Lap-aware M4 (the new integration point):** a lap-2 day is NOT `anchor_rejected`, but M4 still validates
   WITHIN the lap (a forged cross-lap jump is still caught). Is the lap-modular clamp correct + still gated
   (shadow/enforce flags + cyclingAllowed)?
5. **U1–U12** — esp. **U1** (global-`CYCLING_ENABLED` deviation from x/plan per-assignment-only), **U2**
   (lap-aware-M4 approach), **U3** (review-only×laps re-verification still owed — do NOT inherit the zero-recon
   claim), **U9/U10** (deferred cross-class unlock; TypedTest standalone not lap-aware).

VERDICT + CONVERGED-OK if 0 blockers/0 high. GO = P9 is a correct, safe, dormant draft (ships only when
`CYCLING_ENABLED` flips post-P6-live, per §3g).
