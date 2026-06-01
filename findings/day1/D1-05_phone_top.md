# D1-05 — Day 1 Completion Test (Mobile/Phone viewport)

**Label:** D1-05
**Account:** audit_phone_01_top@vocaboost.test
**UID:** b6pQOxFd6kcovH0jtNuSwnHQOqo2
**Class:** k8tzOiiwotBbtJS3uTiv (TOP)
**List:** 8RMews2H7C3UJUAsOBzR (25WT2 TOP Vocabulary v2, 3381 words)
**Viewport:** 390x844, isMobile=true, deviceScaleFactor=3
**Run date:** 2026-05-31T21:52:00Z
**Bundle:** index-CflgDyCK.js (prod, https://vocaboostone.netlify.app)

---

## STATUS BLOCK

| Field | Value |
|-------|-------|
| account | audit_phone_01_top@vocaboost.test |
| viewport | 390x844 mobile (isMobile, dPR=3) |
| reached test? | YES |
| classification | **COMPLETED_NOPASS** |
| mobile layout blockers | "Start Session" button at y=861 (viewport height=844) — 17px below visible area on 390x844 viewport |
| B2 strand? | NO |
| new-word slice correct? | YES — 30 questions in New Words Test (Day-1 segment from 3381-word list) |
| CSD before→after | 1→1 (class_progress NOT advanced; session_state shows phase=complete/CSD=2 — sync bug) |
| console errors | none |
| orphan docs | NONE (1 session_state doc with phase=complete is expected state) |
| Day-1 OK on mobile? | NO — New Words Test passes (100%) but class_progress.CSD not advanced |

---

## Classification Rationale

**COMPLETED_NOPASS** — The full Day 1 session flow was driven end-to-end on mobile. The New Words Test passed with 100% correct answers (verified by AI grader). However, `class_progress.currentStudyDay` remained at 1 (not advanced to 2) after session completion. The session_state shows `phase=complete` and `currentStudyDay=2`, indicating the session internally completed but the class_progress sync did not fire.

---

## Mobile Layout Blockers

1. **"Start Session" button off-screen (y=861, viewport height=844)**: The Start Session card on the student dashboard is 17px below the visible viewport boundary on 390x844. A real user would need to scroll down. scrollIntoViewIfNeeded() resolved this in automation but a real phone user on standard iPhone viewport height would need to scroll. Severity: HIGH — blocks Day 1 start without scrolling.

No other mobile layout blockers: All interactive elements (flashcard X/checkmark buttons at y=705, test inputs at y=233-682, Submit Test at y=780, Continue buttons) were within the 390x844 viewport.

---

## Firestore State

### Before (Admin SDK reset to Day 1)
- class_progress.currentStudyDay: 1
- class_progress.streakDays: 0
- class_progress.recentSessions: []
- attempts: 0
- session_states: 0

### After (final state — confirmed via Admin SDK)
- **class_progress.currentStudyDay: 1** (NOT advanced — BUG)
- class_progress.streakDays: 0 (NOT incremented)
- class_progress.recentSessions: [] (EMPTY — BUG, should have Day 1 session entry)
- session_state.currentStudyDay: 2 (session-internal CSD advanced correctly)
- session_state.phase: complete
- session_state.newWordsTestPassed: true
- session_state.newWordsTestScore: 1.0 (100%)
- session_state.reviewTestScore: 0.233 (23%)
- attempts: 2 (typed/new=100% passed; mcq/review=23% passed)

---

## B2 Strand

No "Unsupported field value: undefined" errors detected at any point in the session flow. **B2: CLEAR**

---

## New-Word Slice Verification

- List: 8RMews2H7C3UJUAsOBzR (3,381 words total)
- Pace setting: 80 (words per day displayed in study phase as "0 of 80 mastered")
- Day-1 New Words Test: exactly 30 questions shown
- All 30 definitions fetched from Firestore at runtime (not from cached audit_state.json which only has 30 of the 3381 words)
- Score: 100% (30/30 correct, AI grader confirmed)
- Conclusion: New-word slice is correct for Day 1

---

## Attempt Documents

| Type | Score | Passed | Study Day |
|------|-------|--------|-----------|
| typed (new words) | 100 | true | 2* |
| mcq (review) | 23 | true | 2* |

*Both attempts have studyDay=2. The "new words" typed attempt at studyDay=2 for a Day 1 session is noted — may reflect the app writing the next day index rather than the current day.

---

## Orphan Documents Check

- 1 session_state doc remains: `k8tzOiiwotBbtJS3uTiv_8RMews2H7C3UJUAsOBzR`
- This is **not orphaned** — it holds the completed session state (phase=complete)
- No unexpected orphan attempt docs

---

## Console Errors

**None** — zero JavaScript errors throughout the complete session flow.

---

## Findings

### F1 [BLOCKER] class_progress.currentStudyDay not advanced after Day 1 completion

**Observed:** After completing all session steps (Study → New Words Test [100%] → Review Study → MCQ Review → session_state.phase=complete), class_progress.currentStudyDay remains 1, recentSessions=[], streakDays=0. The session_state correctly shows currentStudyDay=2 and phase=complete.

**Expected:** class_progress.currentStudyDay should advance to 2, recentSessions should have 1 entry, and streakDays should be 1.

**Impact (BLOCKER):** The student will see "Day 1" again on next login. Streak is not tracked. Teacher gradebook shows no completion.

**Hypothesis:** The Firestore write to class_progress fired from a Cloud Function or client-side write that either failed silently, had a write conflict, or had a condition check that prevented the write (possibly because the CSD in Firestore was reset by the Admin SDK before the test, and the session_state wrote a completion that required the "original" CSD to be 1 before writing to class_progress, but something in the timing prevented it).

### F2 [HIGH] Start Session button below mobile viewport boundary

**Observed:** On 390x844 viewport, Start Session button at y=861 — 17px below visible area. scrollIntoViewIfNeeded() was required to click it.

**Expected:** Button within the 390x844 viewport without scrolling.

**Evidence:** `02_before_start.png` shows the dashboard with the button cropped.

### F3 [INFO] studyDay=2 in New Words Test attempt for a Day 1 session

**Observed:** Both attempt documents have studyDay=2 even though the test was Day 1. The session was started with class_progress.currentStudyDay=1.

**Possible explanation:** The app increments studyDay before writing the attempt doc (writing the NEXT day's index), which could be intentional design.

### F4 [INFO] session_state.reviewTestAttempts=0 after MCQ submission

**Observed:** After the MCQ review test was submitted (score=23%, passed=true), session_state.reviewTestAttempts remained 0 instead of incrementing to 1.

### F5 [INFO] Intro modal "Customize Your Flashcards" on first session

**Observed:** On first session start, a modal appears requiring the user to configure flashcard settings and tap "Start Studying" before accessing the flashcard deck.

**Impact:** Not a blocker (one-time UX), but audit scripts must handle this modal.

---

## Session Flow Summary

Step 1 of 5 — New Words Study: NAVIGATED (5 cards + Skip to Test)
Step 2 of 5 — New Words Test: PASSED (30 questions, score=100, char-by-char typed)
Step 2b — Grading: ~8 seconds (Cloud Function AI grader)
Step 3 of 5 — Review Study: NAVIGATED (Skip to Test used)
Step 4 of 5 — MCQ Review Test: SUBMITTED (score=23%, passed=true per Firestore)
Step 5 of 5 — Day Complete: session_state.phase=complete set, class_progress NOT updated

---

## Evidence Files

All screenshots: `/app/findings/day1/D1-05_evidence/`
- `01_dashboard.png` — Dashboard with Day 1 card
- `02_before_start.png` — Start Session button off-screen at y=861
- `04_study_phase_start.png` — Flashcard (Card 1 of 80, "inflammatory")
- `05_study_phase_after5cards.png` — 5 of 80 mastered
- `05b_session_menu_open.png` — Session menu with "Skip to Test"
- `06_study_phase_end.png` — "Ready for the Test?" dialog
- `07_test_start.png` — New Words Test (30 inputs, "Step 2 of 3/5")
- `08_first_answer_typed.png` — First answer being typed
- `09_all_answers_typed.png` — All 30 typed
- `10_after_submit_grading.png` — Post-grading results
- `11_results_page.png` — Green checkmarks (all correct)
- `11c_after_continue.png` — Step 3: Review Study Day 2
- `13_step2_mcq_start.png` — Step 4: MCQ Review Test
