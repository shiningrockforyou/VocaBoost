# Investigation — S-1 "Review B not reached" (the #9 cross-class review crux)

**Question:** after a student does Day-1 + Day-2-new in class A, switches to class B (same list), and tries the
Day-2 review in B — Run S-1 reported `Review B: reached=false`. Is #9 (cross-class review completion) BROKEN,
or is it a harness issue?

**Method:** visual + Firebase (read-only), reusing s59's r4 classes (A/B still exist). Script
`audit/playwright/lsr_investigate_reviewB.mjs`. Screenshots `findings/INV_reviewB_dashboard.png`,
`findings/INV_reviewB_afterclick.png`.

## Finding: #9 WORKS at the app level. "Review B not reached" is a HARNESS bug.

**Evidence (live + FB):**
- **B dashboard (before entering):** shows **"DAY 1 · STEP 1 OF 2 · Learn 20 new words · Start new words"**;
  My-Classes lists B as "DAY 1, 0 introduced, 1 behind" vs A "DAY 2, 20 introduced, On track". B's
  `class_progress` = null, `session_states` = null (never entered). Visible buttons: **"Start new words",
  "Start Session"** — NO "Review/Continue".
- **After clicking "Start new words":** the session lands on **"Review Study — Day 2"** (Card 1 of 10, review
  flashcards). `reviewUI=true, newWordsUI=false`. FB after entry: `class_progress {csd:1, twi:40}`,
  `session_states {phase:review-study, csd:2}`. → the app RECONCILED the cross-class position on entry and
  correctly routed to the DAY-2 REVIEW.

So switching to B and ENTERING the session gives the cross-class day-2 review — **#9's guarantee holds**. This
matches the code: `initializeDailySession` (studyService.js:156-185) reconciles list-scoped (csd 0→1, twi→40
from the cross-class attempts) → `currentStudyDay=2` → `determineStartingPhase(attempts, 2)` sees the passed
day-2 NEW attempt (cross-class, studyDay=2) and no review → **REVIEW_STUDY** (studyService.js:93-102).

**Why the harness failed:** `driveReviewToTest` (lsr_ui.mjs) looks for a **"Review/Continue"** button on B's
DASHBOARD. But B's dashboard offers **"Start new words" / "Start Session"** (B's own `class_progress` is null
→ the dashboard renders B as a fresh Day-1 class). The review is only reachable by ENTERING the session (which
then routes to review). The harness never enters → `reached=false`. → **HARNESS bug, not #9.**

## Proposed harness fix (for Codex to confirm/advise)
The S-1 B step (and/or `driveReviewToTest`) must ENTER B's session via whatever study affordance is present
("Start Session" / "Start new words" / "Continue" / "Review"), THEN drive the review — because the app routes
a cross-class re-entry to review-study on entry, regardless of the dashboard's (class-keyed) Day-1 label.
Candidate: a shared `enterSessionAny(page)` that clicks the first available study button, then
`driveReviewToTest` proceeds from the in-session review screen (not the dashboard).

## Genuine UX note (Phase-1 known limitation — NOT a #9 data bug; flag for Codex/David)
B's dashboard shows **"DAY 1 · Learn 20 new words · Start new words"** for a cross-class student, but clicking
it delivers the REVIEW. This is the Phase-1 class-keyed display: progress is still keyed `{classId}_{listId}`,
so B (no class_progress yet) renders as Day 1; the cross-class carry happens at session ENTRY via
reconciliation, not on the dashboard. Phase-2 (student+list re-key, NOT deployed) would make the dashboard
reflect the list-wide position. **Low-severity UX inconsistency** (misleading label, correct session) —
candidate Phase-2 / UX item, not a regression.

## Ask for Codex
1. Verify the diagnosis against code: does a cross-class re-entry correctly route to review-study on entry
   (so #9's data behavior is sound)? Is the dashboard "Day 1 / Start new words" the expected Phase-1
   class-keyed display?
2. Advise the harness fix (enter-then-review) — is `enterSessionAny` the right shape, and does anything else
   in the S-1 scenario (leave-A-before-review, re-enter-A-no-re-review) need the same treatment?
3. Is the misleading dashboard label worth escalating as a UX/Phase-2 item, or noting only?
