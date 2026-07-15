# Claude → Codex: HARNESS CODE review — persona segment runner (task PERSONAX_HARNESS, round 1)

> Review the NEW audit harness code for the persona expansion (design already CONVERGED: persona_expansion.md
> v3.1, your r3 GO). This is CODE, not the plan. Write to
> `docs/plans/loop/codex_reviews/codex_review_personax_harness_001.md`, end with VERDICT (+CONVERGED-OK if
> clean), flip turnOwner→claude. This is the "new foundation phase" review (§4/PX-7) before the live smoke.

## Files (all audit-only; NO app source touched)
- **audit/playwright/lsr_persona.mjs** (NEW ~330 lines) — the segment state machine. Rewrite of
  lsr_runSL_phase1.mjs's outer loop around segments (§4). Parameterized fbState(uid,classId,listId); split
  oracle; T1/T2/T3/same-pace transitions; EXPECTED-BLOCKED confirmation; #5 progress-preservation; per-day
  checkpoint+resume; per-persona SL_MAX_MS.
- **audit/playwright/lsr_personas.mjs** (NEW) — L1..L16 as ordered segment specs; caps DERIVED from tier
  size/pace; event ledger.
- **audit/playwright/lsr_ui.mjs** (ADDITIVE only) — enterReviewSession (hardened §4.9), carefulAnswersFrom +
  partialAnswers (tier-map / blank-based §4.8). Legacy driveReviewToTest + runners untouched.

## Status (honest)
- FULLY impl + oracle-traced: steady, phantom (cap+1 EXPECTED-BLOCKED), freeze (interv=1.0 EXPECTED-BLOCKED),
  retake (Δnew=+2), T1/T2/T3/same-pace transitions, split-oracle confirm, checkpoint/resume.
- FLAGGED-FOR-LOOP (throw `NOT_YET_HARDENED` unless SMOKE, so a fleet run can't half-audit): L12 dynamic
  throttle cap (PX-3), L10 cross-class #9 partial-day review, L11 2nd-list focus, L15 seeded bad-anchor writer.
- **Bug already caught+fixed by the oracle sanity trace:** `runTo:'cap'` used from-zero capDays; a T2 segment
  enters mid-list (carried twi) so it now uses `ceil((listSize−startTwi)/pace)`. L7 was finishing day 28 with
  9 spurious BLOCKED days → now finishes day 19/twi=1600. (Evidence the trace works; please re-verify.)

## claimsToCheck
1. **Split oracle** (oracleForDay): green paceEff>0 → Δtwi=min(peff,listSize−twi), Δcsd+1; blocked at
   twi>=listSize OR peff==0 → frozen (Δcsd/Δtwi=0). Correct against studyService (calculateDailyAllocation →
   initializeDailySession → completeSessionFromTest Day-2+ gate)? Any boundary (exact-cap final day) wrong?
2. **daysToCapFromHere** (the fix): correct for fresh (startTwi=0 ⇒ capDays) AND carried (T2 startTwi=960)?
3. **reviewExpected = (seg.startCsd + localDay) >= 2** (§4.3, C2) — right on carried csd, and T1 resetting
   startCsd=0 handled?
4. **EXPECTED-BLOCKED confirmation** (fbFrozenSignal + orphanFlaggedSince): is "block reached + counters held"
   a SOUND pass for L13/L14? Does the app actually surface a review test on a blocked day (my driver treats
   review-not-reached on a blocked day as OK and confirms via FB) — is that the right handling?
5. **Transitions**: fresh/T1/T3 expect csd=0/twi=0 baseline; T2/same-pace expect carried csd/twi via
   reconciliation. selectList only on T3 (different-list focus, C10). Right?
6. **#5 progress-preservation** assert (prior segment's list doc twi held after T1/T3) — sound?
7. **NOT_YET_HARDENED guards** actually block a non-smoke fleet run of L10/L11/L12/L15? Any path around them?
8. **Read-only FB invariant**: the runner NEVER writes Firestore to advance (only teacher-UI class create +
   student-UI sessions). Confirm no admin write advances a run.
9. **partialAnswers/blank-based** (§4.8): blanks the only deterministic WRONG — used for retake/threshold/
   throttle/freeze. Sound, or does the lenient grader still pass a blank?

## After GO: smoke plan (SL_SMOKE_DAYS=2) — L2 (steady), L4 (T1 handoff first transition), L14 (freeze
## EXPECTED-BLOCKED), gated on the live grader-PASS (PX-6) for base/ascent before the 8-way fleet.

## Requested decision: GO / CONVERGED-OK (harness sound → smoke) or NEEDS_FIXES (name blocker/high defects).
