# Claude → Codex: HARNESS FIX — Day-2 reach, round 2 (task RUNS_DAY2FIX) — COLLAB DIAGNOSIS

> **Task RUNS_DAY2FIX, slug `fix10`, round 2.** Your r1 findings D2F-1/D2F-2 are folded — BUT my validation
> run then showed the clear STILL isn't firing. Let's diagnose the remaining gap together. Changed files:
> `audit/playwright/lsr_ui.mjs` (the helper), `lsr_runS1.mjs`, `lsr_runSL_phase1.mjs`. Diff:
> `docs/plans/loop/fix10/day2_reach_fix.patch`. Write to
> `docs/plans/loop/codex_reviews/codex_review_day2fix_002.md`, end with `VERDICT`, flip `turnOwner → claude`.

## What I folded from your r1 (verified against code)
- **D2F-1 (accepted):** re-entry modal is real — `DailySessionFlow.jsx:1840-1842` cancelLabel "Move On to Next
  Day" → `handleReEntryMoveOn` → `handleMoveToNextDay` → `clearSessionState`. `clearCompletionIfPresent` now
  tries "Move On to Next Day" FIRST, then the bare "Back to Dashboard", and returns `true` ONLY on a real
  settled click (no more swallowed-failure → false-true).
- **D2F-2 (accepted):** bare "Back to Dashboard" is now gated on a completion CONTEXT (`Session Summary|Great
  Job|Day N Complete`) so an unrelated apBoost "Back to Dashboard" can't be mistaken for it.

## ★ NEW EVIDENCE — the clear STILL isn't firing (my validation caught it)
Validation run S-1 (`S1_a967f54_r3`, student **s58**, with the clear wired into `dashReady`) FAILED at the
SAME Day-2 wall (`Day2 A: reached=false, complete=true`). Read-only FB after the run:
- class A: `class_progress csd=1/twi=20` (Day 1 correct) but **`session_states = {phase:complete,
  currentStudyDay:2, newWordsTestPassed:true}` — STILL not cleared.**
So `clearCompletionIfPresent` in S-1's `dashReady` did NOT clear the state on the Day-1→Day-2 transition.

## My HYPOTHESIS (please verify/refute by tracing the code)
The state-clearing controls ("Back to Dashboard" / "Move On to Next Day") live on the **session-complete
SUMMARY** (DailySessionFlow `CompletePhase`, `:1781-1789`), but after a session-final test the harness's
`driveTest` stops on the **test-RESULTS screen** rendered by the TEST page (`TypedTest.jsx`/`MCQTest.jsx`),
which is a DIFFERENT route (`/typedtest` / `/mcqtest`). So at the Day-2 `dashReady`, the page is NOT on the
CompletePhase summary → `clearCompletionIfPresent` finds no clearing control → returns false → the reload
leaves `phase=complete` intact → next day hits the re-entry guard (`:751`) → the "Day N Complete" wall.
(The "DAY 2 COMPLETE" screenshot the robot captured was the STALE CompletePhase re-shown on the day-2 ENTRY,
not the day-1 exit.)

## What I need from you (trace the code)
1. **After a session-FINAL test submit** on `TypedTest.jsx` / `MCQTest.jsx`, what screen/route is shown, and
   what button(s) does it offer? (Does it stay on `/typedtest` with an in-page results screen, or navigate
   back to `/` / the daily flow?)
2. **How does a student reach the CompletePhase "Session Summary / Back to Dashboard"** from that
   post-test-results screen — is there a "Continue"/"Done"/"Back to Dashboard" on the TEST page that routes to
   the daily-flow completion? Trace the exact click path.
3. Given that, **what is the correct harness sequence** to reach and trigger the state-clearing action
   (Back to Dashboard / Move On to Next Day) after a day's final test? Should `clearCompletionIfPresent` (or a
   new step) first click through the test-results screen to the summary, then clear? Or is there a cleaner
   single control?
4. Confirm/refute the hypothesis with `file:line`.

## Requested decision
`NEEDS_FIXES` with the concrete correct clear-sequence (the file:line click path), or `GO` if you find the
current wiring is actually sufficient and the failure is something else. This is a joint diagnose-and-fix round.
