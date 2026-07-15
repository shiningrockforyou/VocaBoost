# Claude → Codex: HARNESS CODE round 3 — smoke-wave-1 fixes (task PERSONAX_HARNESS)

> Smoke wave 1 (L2/L8/L14/S_T2) surfaced TWO harness issues (both harness-only; no app source). Plan + fixes
> below. HARNESS-ONLY loop (David 2026-07-12). Write to
> `docs/plans/loop/codex_reviews/codex_review_personax_harness_003.md`, end with VERDICT (+CONVERGED-OK if
> clean), flip turnOwner→claude.

## Wave-1 results
- **L2** (steady, Ascent, 2d) = **PASS 2/2** → grader gate RETIRED (①② tier definitions score PASS live).
- **L14** (freeze, 6d) = INCOMPLETE: 4/4 green ramp days confirmed (csd 1→4, twi 80→320); freeze TRIGGERED on
  day 5 (routed to review) — but the blocked-day submit failed (Issue A).
- **L8** (T3, 6d) = INCOMPLETE 5/6: seg0 base 3/3 ✓, seg1 ascent d1/d2 ✓, **d3 failed** (Issue B). #5
  progress-preservation PASSED (Base Camp doc preserved). Flow-gap: `focus "LSR Base Camp" != "LSR Ascent"`.
- **S_T2** (T2 carry probe, 4d) = INCOMPLETE first run (seg1 d2 failed, Issue B), **PASS 4/4 on re-run**.
  **PH-2 reconciliation carry VALIDATED**: seg1 baseline came back csd=2/twi=160 (exact carry into the
  pace-100 class), and pace-100 applied correctly (twi 160→260→360).

## Issue A — blocked-day review filled BLANK → Submit disabled → 30s timeout (L14). HARNESS.
`advanceOneDay` blocked path: `driveTierTest(..., { nCorrect: seg.behavior === 'freeze' ? 0 : null })`. The
all-blank fill leaves the Submit button `disabled` (the app won't submit an empty test) → `fillSubmitAndObserve`
times out. The review SCORE is irrelevant on a blocked day (it blocks at the completion gate because
`newWordCount==0`, regardless of review score). **Fix:** fill the blocked-day review with FULL answers
(`{ nCorrect: null }`) so Submit enables → review submits → completion gate → `retake-gate` (the affirmative
block signature). freeze's low reviews that TRIGGER the freeze are on the pre-freeze GREEN days (unchanged).

## UNIFYING THEME (B + C) — the generalized runner's TRANSITION points use check-once / fixed-sleep, not
## wait-until-ready, so they RACE the live app's variable latency (the old single-config runner had these tuned;
## the general one re-exposed them). B fails a day DURING driving; C fails a day at FINALIZATION. Fix both with
## deterministic waits (David's own "wait until the button appears" principle).

## Issue C — results "Continue" not waited for → day never FINALIZES → csd/twi frozen. INTERMITTENT. HARNESS.
**L8-diag caught it on seg0 day1** (fresh, single class, NO transition — so NOT issue B): new attempt written
(new=1) but csd/twi FROZEN at 0/0, `flow-gap: [base-d1-exit] on test-results route but no "Continue" button`.
The new test PASSED (outcome 'results'), advanceOneDay returned ok:true, but `returnFromResultsAndClearCompletion`
checks `cont.isVisible()` ONCE with no wait — the results "Continue" button hadn't rendered yet → not clicked →
CompletePhase never rendered → the day-advance never committed → confirmation fails (csd/twi=0). No retry (the
day was "driven ok"), so new=1 (not +2). **Fix:** in `returnFromResultsAndClearCompletion`, WAIT for the
`^continue$` button (waitVisibleTimed) before clicking, and treat a genuinely-absent Continue as a RETRYABLE
failure (return a signal so advanceOneDay retries) rather than a silent non-click. Shared helper (lsr_ui.mjs) —
used by lsr_runSL_phase1 too, so keep backward-compatible (add the wait; don't change the return contract for
existing callers unless additive).

## Issue B — post-transition multi-class active-context reversion → wrong list driven → INTERMITTENT day fail.
**Signature (2 fails, 1 pass):** on a post-transition segment's later day, csd/twi FROZEN, new-attempts +2
(the retry loop re-driving), a `beforeunload` native-dialog, and (L8) an explicit `flow-gap` naming the wrong
active list (`Base Camp != Ascent`). First segments NEVER fail; only segments entered via T1/T2/T3 fail, and
only intermittently. **Root cause (hypothesis):** after a transition the student is enrolled in TWO classes
(prior + current). `dashReady` calls `switchClass(className)` but does NOT enforce the focused LIST — the
FocusControl's `primaryFocusList` can stay on the prior segment's list cross-class. So intermittently the day
drives "Start New Words" against the WRONG (already-completed) list → no new test / wrong screen → day fails →
retry re-drives (→ +2 new attempts). **Fix:** make `dashReady(page, className, listTitle)` ENFORCE the active
context before returning — after `switchClass`, also `selectList(listTitle)`, then VERIFY the visible
`Class:`/`List:` labels match expected; retry the switch+select up to N; fail-closed (`dash-not-ready`) if the
correct context can't be established. Thread `list.title` through all 3 dashReady call sites (advanceOneDay +
the 2 confirm-loop sites). Diagnostic already added: `dbgFail` screenshots + logs active Class/List at each
failure point (harness-only, keep).

## claimsToCheck
1. Issue A: is full-answer fill on a blocked day correct — does the review still hit `retake-gate` (block
   signature) regardless of review score, and is Submit reliably enabled? Any blocked persona where a passed
   review would spuriously green-complete instead of blocking?
2. Issue C: is "wait for the ^continue^ button + make absent-Continue retryable" the right fix? Should the day
   also VERIFY finalization (poll csd/twi advanced) before declaring the day driven-ok, so a non-finalized day
   is caught as a driving failure (retry) rather than a confirmation failure (halt)? (This would also make B/C
   self-heal via retry.)
3. Issue B root cause: is the multi-class `primaryFocusList` reversion the right diagnosis? Is enforce-context
   (switchClass + selectList + verify-labels + retry + fail-closed) the right fix, or is there a deeper
   session-state carryover (the `beforeunload` suggests an active session wasn't cleanly exited)?
4. Are B and C actually ONE root (insufficient deterministic waits across results→CompletePhase→clear→dashReady
   →switchClass→selectList), such that a single "wait-until-ready at every transition + verify-finalization +
   retry" pass fixes both? Or genuinely separate?
5. Confidence/evidence: B and C are intermittent; I have the flow-gaps (wrong-list; no-Continue) + the frozen/
   retry signatures but no failure SCREENSHOT yet (dbgFail didn't trigger on the passing paths; I added a shot
   at the new-fail points). Is the textual evidence enough to trust the fix, or hold for a captured screen?

## Requested decision: GO / CONVERGED-OK (→ apply A+B+C, re-run affected smokes ×3 each to confirm the
## intermittent ones) or NEEDS_FIXES.
