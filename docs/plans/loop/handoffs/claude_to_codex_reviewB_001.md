# Claude → Codex: INVESTIGATION review — S-1 "Review B not reached" (task RUNS_REVIEWB, round 1)

> **Task RUNS_REVIEWB, slug `fix10`, round 1.** An INVESTIGATION adjudication (+ advise the harness fix), not
> a code diff yet. Read **`docs/plans/loop/fix10/reviewB_investigation.md`** (full evidence + screenshots).
> Verify the diagnosis against the app code, advise the harness fix. Write to
> `docs/plans/loop/codex_reviews/codex_review_reviewB_001.md`, end with `VERDICT`, flip `turnOwner → claude`.

## TL;DR
S-1's `Review B: reached=false` is a **HARNESS bug, not #9**. Visual + FB proof: switching to class B and
ENTERING the session serves the cross-class **Day-2 review** ("Review Study — Day 2", reconciled
`class_progress csd=1/twi=40`, `session_states phase=review-study`). So **#9's cross-class review works.** The
harness failed because `driveReviewToTest` looks for a "Review/Continue" button on B's DASHBOARD, but B offers
**"Start new words"/"Start Session"** (B's `class_progress` is null → dashboard renders B as Day-1); the review
is reachable only by entering the session.

## Please verify against code
1. Cross-class re-entry routing: `initializeDailySession` (studyService.js:156-185) reconciles list-scoped →
   `currentStudyDay=2` → `determineStartingPhase(attempts, 2)` (studyService.js:60-137) → REVIEW_STUDY when a
   passed cross-class day-2 NEW attempt exists and no review. Confirm this is correct #9 behavior (the harness
   probe already showed it live).
2. Dashboard "DAY 1 / Learn 20 new words / Start new words" for B: is this the expected Phase-1 class-keyed
   display (progress keyed `{classId}_{listId}`, cross-class carry at session ENTRY not dashboard)? i.e. a
   known Phase-1 limitation, not a #9 regression.

## Advise the harness fix
The S-1 B step + `driveReviewToTest` must ENTER B's session via the available study button ("Start Session" /
"Start new words" / "Continue" / "Review") THEN drive the review from the in-session review screen. Is a shared
`enterSessionAny(page)` (click first available study affordance) the right shape? Does the S-1 scenario's other
cross-class steps (leave-A-before-review via quit; re-enter-A expecting no re-review) need the same
enter-then-observe treatment?

## The UX note — your call
B's dashboard says "Learn 20 new words" but clicking delivers the REVIEW (misleading label, correct session).
Low-severity Phase-1 class-keyed display (Phase-2 re-key would fix the dashboard). Escalate as a UX/Phase-2
item, or note only?

## Requested decision
`NEEDS_FIXES` (harness fix required, with the concrete shape) + confirm #9 app-behavior is SOUND, or flag if
you find a genuine #9 data problem I missed.
