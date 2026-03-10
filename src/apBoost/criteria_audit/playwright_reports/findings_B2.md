# Batch B2 Findings: Student Complete & Report (RE-RUN)

**Agent:** Sonnet 4.6
**Date:** 2026-03-10
**Status:** COMPLETE
**Scenarios Covered:** S-08, S-09, S-10, S-11, S-12, S-13
**Re-run purpose:** Verify fixes for B2-001 through B2-004 from original 2026-03-09 run. Find any new issues.

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** 1440x900
- **Auth:** student@apboost.test (role: student, display name: Alex Johnson)
- **Test Used:** test_micro_full_1 (AP Microeconomics Practice Exam)
- **Result ID produced:** 3s3ch0IlQYVffn5lYgZJczQ5SL22_test_micro_full_1_4

---

## Fix Verification Summary (Prior Findings)

| Finding | Status | Evidence |
|---------|--------|----------|
| B2-001 (Submit Section called submitTest) | FIXED | FRQ Choice Screen appeared after clicking "Submit Section" |
| B2-002 (frqAnswers stores all session answers) | NOT FIXED | Report card FRQ section shows 17 entries (15 MCQ letters + 2 FRQ typed texts) |
| B2-003 (SubmitProgressModal flash) | PARTIAL | Modal detected (text "Submitting" visible 500ms after click). Fast on good connection — acceptable. |
| B2-004 (MCQ_MULTI absent from seed) | NOT FIXED | Still no MCQ_MULTI questions in micro test seed data |

---

## Scenario Results

### S-08: Answer All MCQ Questions in Section 1
- **Status:** PASS
- **Evidence:** All 15 MCQ questions answered sequentially Q2-Q15 (session resumed at Q2). On Q15, "Review →" button present; "Next →" button absent. Clicking "Review →" navigated to Review Screen. Screenshot: `/c/tmp/b2_s08_q15.png`.
- **Notes:** Review button correctly replaces Next on the last question. Nav label correctly showed "Question N of 15" (N=1 through N=15 values confirmed via selector).

### S-09: MCQ Multi-Select Question
- **Status:** SKIP
- **Evidence:** No MCQ_MULTI questions in Section 1 of test_micro_full_1. All 15 questions are single-select MCQ. No "Select all that apply" text appeared. Same finding as original run.
- **Notes:** B2-004 still open — seed data does not contain MCQ_MULTI questions.

### S-10: Review Screen Before Section Submit
- **Status:** PASS
- **Evidence:** Review screen showed:
  - Heading: "Review Your Answers" (h1) — PRESENT
  - Question grid: 2 boxes with brand primary background (Q1, Q2 flagged) — PRESENT
  - Summary: "Answered: 15/15" — PRESENT
  - "Flagged: 2 (Q1, Q2)" — PRESENT (Q1 flagged in previous session, Q2 flagged in original seeded state)
  - "Return to Questions" button — PRESENT
  - "Submit Section" button (NOT "Submit Test") — CORRECT for Section 1 of 2
  - Legend with Answered/Unanswered/Flagged/Annotated indicators — PRESENT
  - Clicking a question box navigates to that question — CONFIRMED
- Screenshots: `/c/tmp/b2_s10_review.png`

### S-11: Submit Section 1 and Transition to Section 2 (FRQ)
- **Status:** PASS (FIX B2-001 VERIFIED)
- **Evidence:** Clicking "Submit Section" on the Section 1 Review Screen correctly transitioned to the FRQ Choice Screen:
  - URL remained: `http://localhost:5173/ap/test/test_micro_full_1` (did NOT navigate to `/ap/results/`)
  - FRQ Choice Screen body: "Free Response Section / Choose how you'd like to complete your free response answers: / Type Your Answers / Write by Hand"
  - Both options presented with descriptions
  - Timer visible at bottom of FRQ choice card
  - Section header changed to "Section 2 of 2: Section II: Free Response" after clicking "Type Your Answers"
  - Lock indicator visible ("Locked" in header) indicating Section 1 is now locked
- Screenshots: `/c/tmp/b2_s11_after_submit.png`
- **Notes:** Fix confirmed working. `handleSubmitSection` (APTestSession.jsx line 209-212) and conditional `onSubmit` prop (line 432) are working correctly. `submitSection()` increments `currentSectionIndex` and the `useEffect` at line 186-190 detects `isFRQSection` and sets view to `frqChoice`.

### S-12: FRQ Answer Entry and Sub-Question Navigation
- **Status:** PARTIAL
- **Evidence:**
  - FRQ typing interface loaded after clicking "Type Your Answers" — PASS
  - Section header shows "Locked Section 2 of 2: Section II: Free Response" — PASS
  - Textarea present — PASS
  - Character count shows (e.g., "167 / 10,000 characters") — PASS
  - FRQ question 1 text visible: "Assume a profit-maximizing monopoly operates..." — PASS
  - Sub-question prompt visible: "(a) Draw a correctly labeled graph..." — PASS
  - Text typed and character count updated — PASS
  - Navigation through sub-questions via Next/Review worked — PASS
  - **BUG: Navigator shows "Question 0 of 7"** instead of "Question 1a of 7" or "Question 1 of 7" — FAIL (NEW FINDING B2-005)
- Screenshot: `/c/tmp/b2_s12_frq.png`, `/c/tmp/b2_s12_frq_done.png`

### S-13: Submit Final Section and View Report Card
- **Status:** PARTIAL
- **Evidence:**
  - FRQ Review Screen showed "Submit Test" (correct, final section) — PASS
  - Summary showed "Answered: 2/2, Flagged: 0" — PASS
  - SubmitProgressModal was visible briefly (text containing "Submitting" detected 500ms after click) — PASS
  - Navigated to `/ap/results/3s3ch0IlQYVffn5lYgZJczQ5SL22_test_micro_full_1_4` — PASS
  - Report card elements verified:
    - "SCORE REPORT" heading — PRESENT
    - "Alex Johnson" student name — PRESENT
    - "AP Microeconomics Practice Exam" test title — PRESENT
    - "AP Microeconomics" subject — PRESENT
    - Date "2026. 3. 10." — PRESENT
    - "AP Score ⏳ Pending" badge — PRESENT
    - "Free Response section is awaiting teacher grading..." banner — PRESENT
    - Section 1 MCQ score: "6/15 (40%)" — PRESENT
    - Section 2 FRQ: "Free Response --/0 (pending)" — PRESENT (but 0 max points is WRONG, should be 18)
    - MCQ results table with Q#, Domain, Topic, Correct, Your Answer, Result columns — PRESENT
    - All 15 MCQ rows populated with correct/incorrect indicators — PRESENT
    - Performance by Domain section with 6 domains and percentages — PRESENT
    - "Section 2: Free Response ⏳ Awaiting Grade" — PRESENT
    - "Your Submitted Answers" section in FRQ — PRESENT but WRONG (shows 17 entries including MCQ answers)
    - "Back to Dashboard" button — PRESENT
    - "Download PDF" button — PRESENT
  - **BUG: "Free Response --/0 (pending)"** — max points shows 0, should be 18 (B2-006 NEW)
  - **BUG: FRQ "Your Submitted Answers" shows all 17 session answers** — MCQ letter answers (Q1-Q12) appear before typed FRQ text (B2-002 STILL OPEN)
- Screenshots: `/c/tmp/b2_s13_final_review.png`, `/c/tmp/b2_s13_report_card.png`, `/c/tmp/b2_report_full.png`

---

## Findings

### Blockers
> None

---

### High-Priority
> None

---

### Medium-Priority

#### [FINDING-B2-002]: FRQ "Submitted Answers" on Report Card Shows MCQ Answer Letters Mixed With FRQ Text (STILL OPEN)
- **Severity:** Medium-Priority
- **Scenario:** S-13
- **Criteria Reference:** Section 9.4 (FRQ results table), Section 9.3 (data sources)
- **What Happened:** The "Section 2: Free Response / Your Submitted Answers" section on the report card renders 17 question entries instead of 2. Questions 1-12 show single MCQ answer letters (D, B, C, C, D, D, A, C, C, B, C, B). Questions 13-17 show either typed FRQ text or MCQ letters from the end of Section 1. Only the 2 FRQ questions (at entries 13 and 15) show actual typed text. This is because `frqAnswers = session.answers` (a flat map of ALL question IDs to all answers) is stored at result creation, not filtered to FRQ-only answers.
- **Expected:** "Your Submitted Answers" should only show the 2 FRQ questions (micro_frq1 and micro_frq2) with their sub-question answers (a, b, c, d). MCQ answers should not appear here.
- **Screenshot/Evidence:** Live run body text from `/ap/results/3s3ch0IlQYVffn5lYgZJczQ5SL22_test_micro_full_1_4`: "Your Submitted AnswersQuestion 1DQuestion 2BQuestion 3CQuestion 4C...Question 13In a competitive market, equilibrium is established...Question 15(a)In a competitive market...(c)...(b)..."
- **File(s) to Fix:** `src/apBoost/services/apScoringService.js` (line 244)
- **How to Fix:** At line 244 in `apScoringService.js`, replace:
  ```javascript
  frqAnswers: session.answers || {}, // Typed FRQ answers from session
  ```
  with filtered FRQ-only answers:
  ```javascript
  // Filter answers to only FRQ questions (identified by section type)
  frqAnswers: (() => {
    const frqAnswers = {}
    for (const section of test.sections) {
      if (section.sectionType === SECTION_TYPE.FRQ || section.sectionType === SECTION_TYPE.MIXED) {
        for (const qId of section.questionIds || []) {
          if ((session.answers || {})[qId] !== undefined) {
            frqAnswers[qId] = session.answers[qId]
          }
        }
      }
    }
    return frqAnswers
  })(),
  ```
  This requires `test` to be in scope at that point (it is — `test` is loaded from Firestore at line ~130 in `createTestResult`). Also ensure `SECTION_TYPE` is imported (it is at line 12).
- **Acceptance Test:** Complete a test with FRQ answers typed. On the report card, verify "Your Submitted Answers" shows only 2 entries (the 2 FRQ questions), each with sub-question labels (a, b, c, d) and typed text. No MCQ letter answers (A/B/C/D single characters) should appear in the FRQ submitted answers section.

---

#### [FINDING-B2-004]: MCQ_MULTI Questions Absent From Seed Data (STILL OPEN)
- **Severity:** Medium-Priority
- **Scenario:** S-09 (SKIP)
- **Criteria Reference:** Section 2.2 (MCQ_MULTI), Section 4.3 (partial credit scoring)
- **What Happened:** No MCQ_MULTI questions exist in any section of test_micro_full_1 or the other seeded tests. All questions are single-select MCQ or FRQ. The S-09 scenario cannot be verified.
- **Expected:** At least one MCQ_MULTI question should exist in seed data to enable verification of multi-select UI behavior (checkboxes, simultaneous selections, partial credit scoring in report card).
- **Screenshot/Evidence:** During Q1-Q15 navigation, no question showed checkbox UI elements or "Select all that apply" text. All answers showed single-select radio-style buttons.
- **File(s) to Fix:** `src/apBoost/utils/seedFullData.js`
- **How to Fix:** Add one `MCQ_MULTI` question to `MICRO_MCQ_QUESTIONS` (currently 15 questions). Example addition before `micro_q15` (the public goods question):
  ```javascript
  {
    id: 'micro_q_multi1',
    questionDomain: 'Unit 1: Basic Economic Concepts',
    questionTopic: 'Market Characteristics',
    questionType: 'MCQ_MULTI',
    difficulty: 'MEDIUM',
    questionText: 'Which of the following are characteristics of a perfectly competitive market? (Select ALL that apply)',
    choiceA: { text: 'Many buyers and sellers' },
    choiceB: { text: 'Differentiated products' },
    choiceC: { text: 'Free entry and exit' },
    choiceD: { text: 'Price-making power for individual firms' },
    correctAnswers: ['A', 'C'],
    partialCredit: true,
    explanation: 'Perfect competition features many buyers and sellers and free entry/exit. Products are homogeneous (not differentiated) and no single firm has price-making power.',
  },
  ```
  Update the section `questionCount` in `MICRO_TEST_SECTIONS[0]` from 15 to 16, and update the seed success message count from "51 questions" to "52 questions".
- **Acceptance Test:** After seeding, navigate to the AP Micro test. Find the MCQ_MULTI question (shows "Select ALL that apply" text). Verify: checkboxes render for each choice, clicking A then C selects both simultaneously (both show brand primary background), clicking A again deselects it, navigating away and back preserves the selection, and the report card shows partial credit scoring for this question.

---

#### [FINDING-B2-005]: FRQ Section Navigator Shows "Question 0 of 7" — currentFlatIndex Returns -1 on Entry
- **Severity:** Medium-Priority
- **Scenario:** S-12
- **Criteria Reference:** Section 7.4 (navigation — flat indexing for FRQ sub-questions), Section 2.3.2 (FRQTextInput navigation)
- **What Happened:** When entering the FRQ section after clicking "Type Your Answers" from the FRQ Choice Screen, the bottom navigation bar shows "Question 0 of 7" instead of "Question 1 of 7" (or "Question 1a of 7"). This is because `currentFlatIndex` returns -1 (findIndex not matched) when `currentSubQuestionLabel` is null, even though `flatNavigationItems` contains items with `subQuestionLabel: 'a'`, `'b'`, etc.
- **Expected:** Upon entering FRQ typing mode, the navigator should show "Question 1 of 7" (or "Question 1a of 7" depending on display format). The first sub-question (label 'a') should be pre-selected and the flat index should be 0 (pointing to the first sub-question item).
- **Screenshot/Evidence:** Live run output: `FRQ nav: Question 0 of 7`. The session resumed at Q1 (questionIndex=0) with `subQuestionLabel=null` because `handleFRQChoice` in APTestSession.jsx only calls `setView('testing')` without initializing the sub-question label. The `flatNavigationItems` array has no entry with `subQuestionLabel: null` for FRQ questions (FRQ sub-questions always have labels), so `findIndex` returns -1, making `displayCurrentIndex = -1 + 1 = 0`.
- **File(s) to Fix:** `src/apBoost/pages/APTestSession.jsx` (handleFRQChoice function, line 236-243)
- **How to Fix:** In `APTestSession.jsx`, modify `handleFRQChoice` to initialize the first FRQ sub-question. Call `goToQuestion(0)` after setting the view, which will properly initialize `currentSubQuestionLabel` to the first sub-question's label via the `goToQuestion` callback (which already calls `setCurrentSubQuestionLabel(question.subQuestions[0].label)` at `useTestSession.js:364`):
  ```javascript
  // Handle FRQ submission type choice
  const handleFRQChoice = (type) => {
    setFrqSubmissionType(type)
    if (type === FRQ_SUBMISSION_TYPE.HANDWRITTEN) {
      setView('frqHandwritten')
    } else {
      setView('testing')
      // Initialize to first FRQ question and first sub-question
      goToQuestion(0)
    }
  }
  ```
  The `goToQuestion` function is already destructured from `useTestSession` at APTestSession.jsx line 69. This single-line addition will set `currentSubQuestionLabel` to the first sub-question label ('a' for micro_frq1), making `currentFlatIndex = 0` and the navigator display "Question 1 of 7".
- **Acceptance Test:** Start the AP Micro test, answer all 15 MCQ, submit Section 1, click "Type Your Answers" on FRQ choice screen. Verify: (1) navigator shows "Question 1 of 7" (not "Question 0 of 7"), (2) sub-question prompt for "(a)" is visible, (3) clicking Next advances to sub-question "(b)" and shows "Question 2 of 7".

---

#### [FINDING-B2-006]: FRQ Max Points Shows 0 — Seed Data Uses `points` Key, Scoring Service Expects `maxPoints`
- **Severity:** Medium-Priority
- **Scenario:** S-13
- **Criteria Reference:** Section 9.4 (report card — FRQ pending section), Section 4.2 (FRQ scoring)
- **What Happened:** The report card shows "Free Response --/0 (pending)" instead of "Free Response --/18 (pending)". The micro test FRQ section has 2 questions worth 10 and 8 points respectively (18 total). The `frqMaxPoints` field on the result document is stored as 0. The scoring service at `apScoringService.js:205` calculates `frqMaxPoints` by summing `sq.maxPoints` for each sub-question, but the seed data stores sub-question point values under the key `points` (not `maxPoints`).
- **Expected:** "Free Response --/18 (pending)" should be shown on the report card, correctly reflecting the total graded points available.
- **Screenshot/Evidence:** Live run body text confirms: "Free ResponseSection 1 (MCQ) 6/15 (40%) Free Response --/0 (pending)". The micro FRQ question data in `seedFullData.js` lines 304-309 shows: `{ label: 'a', prompt: '...', points: 3 }` — the key is `points`, not `maxPoints`. The scoring service at line 205-208 uses `(sq.maxPoints || 0)` which evaluates to 0 for all seed FRQ sub-questions.
- **File(s) to Fix:** `src/apBoost/services/apScoringService.js` (line 205) OR `src/apBoost/utils/seedFullData.js` (all FRQ sub-question definitions)
- **How to Fix:** Two options:

  **Option A (preferred — fix scoring service to accept either key):** At `apScoringService.js:205-208`, update the max points accumulation to accept both `maxPoints` and `points`:
  ```javascript
  const questionMaxPoints = (question.subQuestions || []).reduce(
    (sum, sq) => sum + (sq.maxPoints || sq.points || 0),
    0
  )
  ```
  This is non-breaking: existing question documents that use `maxPoints` continue to work; seed data using `points` also works.

  **Option B (fix seed data):** In `seedFullData.js`, rename all FRQ sub-question `points` keys to `maxPoints`. This requires updating approximately 20 sub-question entries across MICRO, MACRO, and CALC FRQ questions and re-seeding the database.

  Option A is strongly preferred because it's a one-line change with no data migration needed.
- **Acceptance Test:** After applying Option A fix and re-running a test (or re-seeding + using a seeded result), verify the report card shows "Free Response --/18 (pending)" for the micro test (10 + 8 = 18 total FRQ points). Teacher grading panel should also show max points correctly.

---

### Nitpicks

- **Nit:** The FRQ section "Your Submitted Answers" on the report card renders sub-question entries in a non-sequential order. In the live run, sub-questions for FRQ Q1 appeared as "(a)...(c)...(b)..." (out of alphabetical order). This is because JavaScript object property iteration does not guarantee insertion order for string keys. The `FRQSubmittedAnswers` component iterates `Object.entries(frqAnswers[questionId])` without sorting. Fix: in `APReportCard.jsx` `FRQSubmittedAnswers` component, wrap the entries in `.sort(([a], [b]) => a.localeCompare(b))` before mapping.

- **Nit:** The review screen body text showed "Flagged: 2 (Q1, Q2)" during the re-run — the test resumed from a prior session with Q1 already flagged. This is expected behavior (flags persist across sessions), not a bug, but worth noting that the flag count may differ from what a fresh session would show.

- **Nit:** The SubmitProgressModal flash is very brief on a local development connection. Per S-13 acceptance criteria it should be visible for long enough to confirm state. This may be invisible on fast connections. No minimum display time is enforced. Acceptable for production (slow connections will show it naturally), but consider a 300ms minimum delay.

- **Nit:** The AP Score pending badge shows "AP Score / ⏳ / Pending" as three separate lines in a square badge. The criteria (Section 9.2) specifies a "large AP Score display (1-5)" with color-coded badges. The pending state visual treatment is present but the badge size (w-24 h-24) may feel too small relative to the importance of this metric. Not a functional issue.

---

## Console Errors
| Page/Route | Error Message | Severity |
|------------|---------------|----------|
| All routes | None during normal test flow | - |
| Note | No JavaScript errors observed in the browser console during the entire test flow (login → dashboard → test session → FRQ → submit → report card) | - |

---

## Summary

| Metric | Count |
|--------|-------|
| Scenarios Tested | 6 |
| PASS | 3 (S-08, S-10, S-11) |
| PARTIAL | 2 (S-12 — nav shows Q0, S-13 — wrong FRQ max pts + wrong submitted answers) |
| SKIP | 1 (S-09 — no MCQ_MULTI in seed) |
| FAIL | 0 |
| Blockers Found | 0 |
| High-Priority Found | 0 |
| Medium-Priority Found | 4 (B2-002 still open, B2-004 still open, B2-005 new, B2-006 new) |
| Nitpicks | 4 |

### Key Finding Summary

**FINDING-B2-001 CONFIRMED FIXED:** The "Submit Section" → FRQ Choice Screen flow works correctly. Clicking "Submit Section" on Section 1 Review now correctly shows the FRQ Choice Screen with "Type Your Answers" and "Write by Hand" options, then loads the FRQ typing interface for Section 2.

**FINDING-B2-005 (Medium-Priority, NEW):** FRQ navigator shows "Question 0 of 7" because `handleFRQChoice` in APTestSession.jsx doesn't call `goToQuestion(0)` to initialize the sub-question label. One-line fix: add `goToQuestion(0)` after `setView('testing')` in `handleFRQChoice`.

**FINDING-B2-006 (Medium-Priority, NEW):** FRQ max points is 0 in the result because seed data uses `points` field on sub-questions while the scoring service reads `maxPoints`. One-line fix in `apScoringService.js:205`: change `sq.maxPoints` to `sq.maxPoints || sq.points`.

**FINDING-B2-002 (Medium-Priority, STILL OPEN):** `frqAnswers = session.answers` stores ALL session answers (MCQ + FRQ). Report card FRQ section shows MCQ letter answers alongside FRQ typed text. Requires filtering `session.answers` to only FRQ question IDs in `apScoringService.js:244`.

**FINDING-B2-004 (Medium-Priority, STILL OPEN):** No MCQ_MULTI questions in seed data. S-09 cannot be verified.
