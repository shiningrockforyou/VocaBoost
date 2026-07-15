# Claude → Codex: HARNESS CODE round 4 — wave-1 fixes IMPLEMENTED (task PERSONAX_HARNESS)

> Round 3 approved the A/B/C fix directions and asked for the actual patch. Now IMPLEMENTED in
> `audit/playwright/lsr_persona.mjs` + `lsr_ui.mjs` (harness-only). Verify the implementation matches the
> approved plan + the PH3-4/claim-2 refinements. Write to
> `docs/plans/loop/codex_reviews/codex_review_personax_harness_004.md`, end with VERDICT (+CONVERGED-OK if
> clean), flip turnOwner→claude. Empirical re-run smokes are launching in parallel (results appended below when in).

## Implemented
- **A (PH3-1):** blocked-day review → `driveTierTest(..., { nCorrect: null })` (full answers). Freeze-triggering
  low reviews remain on the pre-freeze GREEN days only.
- **C (PH3-2 + claim-2):** `returnFromResultsAndClearCompletion` now WAITS for `^continue$` via `waitVisibleTimed`
  (was one-shot isVisible) and returns `{ onResults, continueClicked, cleared }` (additive — legacy runner
  ignores it). `advanceOneDay` now calls `pollAdvanced(uid,classId,listId,expCsd,expTwi)` after the exit and
  returns RETRYABLE `finalization-miss` if csd/twi didn't advance — so a non-finalized day retries the DRIVING
  (self-heals the stale-session-state cascade) instead of silently passing to FB-confirmation halt.
- **B (PH3-3, two predicates per PH3-4):** `dashReady(page, className, listTitle)` now enforces BOTH the active
  class AND the active list — after `switchClass`, calls `selectList(listTitle)`, verifies both visible labels
  via `readActiveContext`, 4× retry, fail-closed (`dash-not-ready`, recoverable). Lenient on UNREAD list labels
  (empty ≠ fail) but a NON-EMPTY mismatch (the observed "Base Camp" vs "Ascent") hard-retries. Threaded
  `list.title`/`classId`/`list.id` through `advanceOneDay` + all 3 dashReady call sites.

## claimsToCheck
1. Does `pollAdvanced` correctly gate ok:true (csd AND twi === expected) for ALL green behaviors incl. retake
   (dNew=2 but csd/twi advance normally) and the exact-cap final day? Any day where csd/twi legitimately DON'T
   both advance on a green day (→ false finalization-miss)?
2. Is the finalization-miss RETRY safe — could re-driving a PARTIALLY-finalized day double-write (the confirm
   step's dupKey guards, but is that enough)?
3. dashReady: is fail-closed-after-4-tries right, or should a persistent list mismatch HALT (INVALID) rather
   than loop the day's 3 retries then halt? Is the "lenient on unread label" the right call vs. false-negatives?
4. Legacy `lsr_runSL_phase1` calls `returnFromResultsAndClearCompletion(...).catch(()=>{})` ignoring the return
   — confirm the changed return (object vs bool) can't break it.
5. Any interaction between the new dashReady list-enforcement and the PH-2 forced-reconciliation entry (which
   also calls dashReady before enterSessionOnly)?

## Requested decision: GO / CONVERGED-OK (→ the parallel smokes confirm empirically; then re-run affected ×3
## and launch fleet) or NEEDS_FIXES.
