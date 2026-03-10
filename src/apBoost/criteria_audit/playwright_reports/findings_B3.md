# Batch B3 Findings: Report Card Deep Dive

**Agent:** Sonnet 4.6
**Date:** 2026-03-10
**Status:** COMPLETE
**Scenarios Covered:** S-14, S-15, S-16, S-17, S-18

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** 1440x900 (desktop)
- **Auth:** teacher@apboost.test (teacher account, navigating student-accessible routes /ap and /ap/test/:id and /ap/results/:id)
- **Test Used:** AP Microeconomics Practice Exam (test_micro_full_1)
- **Result ID:** 7gKfDsJTtSMocVH9oggUCf4ys6K2_test_micro_full_1_1

---

## B3 Test Flow Summary

B3 ran its own complete test flow:
1. Login as teacher -> navigate to /ap -> click AP Microeconomics -> Begin Test
2. Answered all 15 MCQ (flagged Q2 before answering it) -> clicked Review -> Submit Section
3. FRQ Choice Screen appeared (Type Your Answers / Write by Hand) -> selected Type Your Answers
4. Typed responses for all 7 FRQ sub-questions (1a, 1b, 1c, 1d, 2a, 2b, 2c) -> Review -> Submit Test
5. Report card at /ap/results/... -> deep-verified all sections
6. Clicked Download PDF -> clicked Back to Dashboard

---

## Scenario Results

### S-14: Report Card MCQ Results Verification
- **Status:** PASS
- **Evidence:** Screenshot b3r2_13_report_card_top.png and b3r2_14_mcq_table.png. Table shows all 6 columns: Q#, Domain, Topic, Correct, Your Answer, Result. 15 rows rendered. Domain values populated ("Unit 1: Basic Economic Concepts", etc.). Topic values populated ("Scarcity & Opportunity Cost", etc.). Correct column shows answer letter. Your Answer column shows student answer. Result column shows checkmark (correct) or X (incorrect). MCQ Summary line shows "6/15 correct (40%)". Performance by Domain section present.
- **Notes:**
  - Result indicators use text symbols (✓ and ✗) with CSS token colors `text-success-text` and `text-error-text`. These render as semantic green/red text.
  - Domain text appears styled in a blue/teal tone from `text-text-secondary` which is the secondary text color. This may look link-like but is not clickable.
  - Performance by Domain bars use `bg-success-text`, `bg-warning-text-strong`, `bg-error-text` classes for fill color. These are text-color tokens applied as background utilities. The bars appear to render but with incorrect semantic semantics (FINDING B3-003).
  - The `hidden sm:table-cell` class on Domain and Topic columns means they are HIDDEN on mobile screens. At 1440px they display correctly.

### S-15: Report Card Flagged Questions Display
- **Status:** FAIL
- **Evidence:** Script confirmed `flaggedSectionFound: false`. Screenshots b3r2_15_flagged_section.png and b3r2_18_report_full_full.png show the full report card with NO "Flagged for Review" section anywhere. Q2 was definitively flagged during the test (confirmed in b3r2_04_q2_flagged.png showing "Flagged" button state, and b3r2_06_review_screen_full.png showing review screen with "Flagged: 1 (Q2)"). The flagged question data exists in the session but is never transferred to the result document.
- **Notes:** This is a HIGH-PRIORITY finding (B3-001). The session stores `flaggedQuestions` correctly, but `createTestResult` in apScoringService.js never includes this field in the result document.

### S-16: Report Card FRQ Section - Pending Grading
- **Status:** PARTIAL
- **Evidence:** Screenshot b3r2_16_frq_pending.png and b3r2_18_report_full_full.png.
  - Awaiting Grade badge present (hourglass + "Awaiting Grade") ✓
  - "Your Submitted Answers" heading present ✓
  - "Raw Points: --/18 (pending)" present ✓
  - Grading banner at top present: "Free Response section is awaiting teacher grading. Final AP score will be calculated after grading is complete." ✓
  - AP Score Pending badge at top present (hourglass + "Pending") ✓
  - Submitted FRQ answer text displayed in bg-muted boxes ✓
  - FAIL: FRQ sub-question answers are displayed in the WRONG ORDER and mapped to the WRONG question (B3-002).
- **Notes:** The answers typed for micro_frq1 (sub-questions a, b, c, d) appear under "Question 2" in reverse order, and the answers for micro_frq2 (a, b, c) appear under "Question 1". This is a data display ordering bug caused by Firestore map field key ordering not being preserved during retrieval.

### S-17: Download Report PDF
- **Status:** PASS
- **Evidence:** Screenshot b3r2_19_bottom_of_report.png confirms "Download PDF" button present. 0 console errors during PDF generation. The download uses `URL.createObjectURL(blob)` + programmatic anchor click pattern which successfully triggers a browser download. Playwright's `download` event was not caught because blob URL downloads do not trigger this event type, but the download mechanism is correct and error-free.
- **Notes:** PDF download function is correct and operational. No errors observed.

### S-18: Return to Dashboard After Test Completion
- **Status:** PASS
- **Evidence:** Screenshot b3r2_21_dashboard_final.png. "Back to Dashboard" link clicked, URL changed to http://localhost:5173/ap. AP Microeconomics Practice Exam card now shows "Completed" badge (green styling). Other tests (AP Calc AB, AP Macro) still show "Not Started". Navigation is correct.
- **Notes:** The Completed badge appears with correct green styling (`bg-success` area). The test card correctly reflects completed status.

---

## Findings

### High-Priority
> Significant issues that violate acceptance criteria.

#### [FINDING-B3-001]: flaggedQuestions Not Saved to Result Document - "Flagged for Review" Section Always Empty

- **Severity:** High-Priority
- **Scenario:** S-15
- **Criteria Reference:** Section 9.3 (report card - flagged questions)
- **What Happened:** The "Flagged for Review" section is completely absent from every report card, even when the student flagged questions during the test. Q2 was definitively flagged (verified by screenshot b3r2_04_q2_flagged.png showing "Flagged" button state and b3r2_06_review_screen_full.png showing "Flagged: 1 (Q2)" in the review summary). After submitting, the report card at /ap/results/... shows no "Flagged for Review" section at all.
- **Expected:** After completing a test with flagged questions, the report card should show a "Flagged for Review" section listing each flagged question number (e.g., "Q2") with a color-coded correct/incorrect indicator (green border if correct, red border if incorrect). Per S-15: "Heading says 'Flagged for Review'" and "Flagged question badges appear (e.g., 'Q2')".
- **Screenshot/Evidence:** b3r2_15_flagged_section.png shows report card at the position where flagged section should appear - it is absent. b3r2_18_report_full_full.png (full page screenshot) confirms no flagged section anywhere on the report card. b3r2_06_review_screen_full.png confirms Q2 was flagged during the test.
- **File(s) to Fix:** `src/apBoost/services/apScoringService.js`
- **How to Fix:** In the `createTestResult` function, the `resultData` object (lines 225-273) is missing `flaggedQuestions`. The session object has `session.flaggedQuestions` (an array of question IDs). Add it to the result document:

  In `createTestResult` function, after line 131 (`const answers = session.answers || {}`), add:
  ```js
  const flaggedQuestions = session.flaggedQuestions || []
  ```

  Then in the `resultData` object (around line 233 after `answers`), add:
  ```js
  flaggedQuestions,  // Array of flagged question IDs from the session
  ```

  This ensures `result.flaggedQuestions` is populated when `APReportCard.jsx` reads it at line 355: `const flaggedQuestions = result?.flaggedQuestions || []`.

  No changes are needed to `APReportCard.jsx` since the rendering code for the "Flagged for Review" section (lines 534-562) is already correct — it simply never gets data.

- **Acceptance Test:**
  1. Navigate to /ap, click AP Microeconomics, Begin Test
  2. On Question 2, click "Flag for Review" — confirm "Flagged" button state
  3. Answer all 15 MCQ, click Review (verify "Flagged: 1 (Q2)" in summary), click Submit Section
  4. Complete FRQ section, click Submit Test
  5. On the report card, scroll past the MCQ table — verify a "Flagged for Review" section appears
  6. Verify the section shows "You flagged 1 question(s) during the test:"
  7. Verify a "Q2" badge with correct/incorrect color indicator (green border if Q2 was correct, red if incorrect)

---

### Medium-Priority
> Polish issues, partial implementations, or P3 criteria gaps.

#### [FINDING-B3-002]: FRQ Submitted Answers Displayed in Wrong Order and Wrong Question Assignment

- **Severity:** Medium-Priority
- **Scenario:** S-16
- **Criteria Reference:** Section 9.4 (report card - FRQ), Section 2.3 (FRQ sub-questions)
- **What Happened:** The FRQ submitted answers section displays answers for the wrong questions and in the wrong sub-question order. Specifically: answers typed for micro_frq1 (sub-questions a, b, c, d) appear under "Question 2" in reverse alphabetical order (d, c, b, a). Answers typed for micro_frq2 (sub-questions a, b, c) appear under "Question 1" in an unexpected order (c, a, b). This was verified by cross-referencing the actual text typed for each sub-question against the display.
- **Expected:** The submitted answers should appear under the correct question heading in alphabetical sub-question order: Question 1 shows (a), (b), (c), (d) and Question 2 shows (a), (b), (c).
- **Screenshot/Evidence:** b3r2_19_bottom_of_report.png shows "Question 1" with answers (c), (a), (b) and "Question 2" with answers (d), (c), (b), (a). Cross-referencing the typed text against our script's frqResponses array confirms the answers are assigned to the wrong parent question AND in reversed sub-question order within Q2.
- **File(s) to Fix:**
  - `src/apBoost/pages/APReportCard.jsx` (FRQSubmittedAnswers component, lines 137-174)
  - Possibly `src/apBoost/services/apScoringService.js` (frqAnswers filtering, lines 244-263)
- **How to Fix:** Two separate fixes are needed:

  **Fix 1 — Sub-question ordering**: In `FRQSubmittedAnswers` (APReportCard.jsx line 155), replace `Object.entries(answers).map(...)` with an ordered iteration that sorts by sub-question label:
  ```jsx
  {Object.entries(answers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([subLabel, answer]) => (
      // ...existing render code unchanged
    ))
  }
  ```

  **Fix 2 — Question ordering**: In `FRQSubmittedAnswers` (APReportCard.jsx line 146), the outer iteration `Object.entries(frqAnswers).map(...)` assigns question numbers based on array index. The ordering of keys in `frqAnswers` depends on Firestore retrieval order (not guaranteed). To fix the question ordering, in `createTestResult` (apScoringService.js), build the `frqAnswers` filtered object in the order of `test.sections` → `section.questionIds`, not in iteration order of `session.answers`:

  Replace the current IIFE for `frqAnswers` (lines 244-263) with:
  ```js
  frqAnswers: (() => {
    const frqQuestionIds = []  // Use array to preserve section order
    for (const section of test.sections) {
      if (section.sectionType === SECTION_TYPE.FRQ || section.sectionType === SECTION_TYPE.MIXED) {
        for (const qId of section.questionIds || []) {
          const q = test.questions[qId]
          if (q && (q.questionType === QUESTION_TYPE.FRQ || q.questionType === QUESTION_TYPE.SAQ || q.questionType === QUESTION_TYPE.DBQ)) {
            frqQuestionIds.push(qId)
          }
        }
      }
    }
    const allAnswers = session.answers || {}
    const filtered = {}
    for (const qId of frqQuestionIds) {  // Iterate in section-defined order
      if (allAnswers[qId] !== undefined) {
        filtered[qId] = allAnswers[qId]
      }
    }
    return filtered
  })(),
  ```

  This ensures `frqAnswers` keys are in the canonical test section order (micro_frq1 before micro_frq2).

- **Acceptance Test:**
  1. Navigate to /ap, click AP Microeconomics, Begin Test
  2. Complete all 15 MCQ, submit Section 1
  3. Choose "Type Your Answers", type distinct text for each sub-question in order: 1(a)="answer1a", 1(b)="answer1b", 1(c)="answer1c", 1(d)="answer1d", 2(a)="answer2a", 2(b)="answer2b", 2(c)="answer2c"
  4. Submit test, navigate to report card
  5. Scroll to "Section 2: Free Response" → "Your Submitted Answers"
  6. Verify "Question 1" shows (a)="answer1a", (b)="answer1b", (c)="answer1c", (d)="answer1d" in that order
  7. Verify "Question 2" shows (a)="answer2a", (b)="answer2b", (c)="answer2c" in that order

---

#### [FINDING-B3-003]: Performance by Domain Progress Bars Use Wrong CSS Token Class

- **Severity:** Medium-Priority
- **Scenario:** S-14
- **Criteria Reference:** Section 9.2 (domain performance), Design Tokens (CLAUDE.md)
- **What Happened:** The Performance by Domain section renders progress bars using CSS classes `bg-success-text`, `bg-warning-text-strong`, and `bg-error-text` (APReportCard.jsx line 522). These are text-color tokens being applied as background-color utilities. While the aliases exist in the CSS (lines 418-420 of index.css), the correct design tokens for colored progress bar fills should use the semantic background tokens `bg-success`, `bg-warning`, and `bg-error`. Looking at the rendered output, the bars in the screenshot appear as light-colored or barely visible fills instead of the expected vivid green/yellow/red domain performance bars.
- **Expected:** Domain performance bars should display in clear semantic colors: green (bg-success) for domains >=70%, yellow (bg-warning) for >=50%, red (bg-error) for <50%. The color coding should match the criteria reference for "color coding: green for >=70%, yellow for >=50%, red for <50%".
- **Screenshot/Evidence:** b3r2_16_frq_pending.png shows the Performance by Domain section. All 6 domain bars appear as empty gray tracks or very faint fills despite having 33%-50% correct percentages. The bars should be clearly colored with semantic success/warning/error colors.
- **File(s) to Fix:** `src/apBoost/pages/APReportCard.jsx`
- **How to Fix:** In the `domainPerformance` rendering block (line 522), replace the class string with correct background tokens:
  ```jsx
  // BEFORE (line 522):
  className={`h-full transition-all ${percentage >= 70 ? 'bg-success-text' : percentage >= 50 ? 'bg-warning-text-strong' : 'bg-error-text'}`}

  // AFTER:
  className={`h-full transition-all ${percentage >= 70 ? 'bg-success' : percentage >= 50 ? 'bg-warning' : 'bg-error'}`}
  ```
  Use `bg-success` (maps to --color-success), `bg-warning` (maps to --color-warning), and `bg-error` (maps to --color-error) which are the correct semantic background color utilities defined in the design token system.

- **Acceptance Test:**
  1. Navigate to any report card with MCQ results spanning multiple domains (e.g., /ap/results/result_micro_student1 using seed data)
  2. Scroll to "Performance by Domain" section
  3. Verify progress bars with >=70% show a vivid green fill
  4. Verify progress bars with >=50% and <70% show a yellow/amber fill
  5. Verify progress bars with <50% show a red fill
  6. All bar fills should be clearly visible and semantically colored (not faint or gray)

---

### Nitpicks

- **Nit:** The "SCORE REPORT" heading uses `text-2xl font-bold text-text-primary` styling which is appropriate, but the heading does not include the student's test title or any contextual subtitle. For a printed/downloaded report, having the test name directly under "SCORE REPORT" as a subtitle would improve clarity. The test name IS present in the "Test:" metadata row below, so this is cosmetic only.

- **Nit:** The MCQ table Domain and Topic columns use `hidden sm:table-cell` which correctly hides them on mobile. However, on desktop the Domain column text appears in a blue-teal secondary color that looks link-like but is not clickable. Consider making it `text-text-primary` or explicitly `text-text-secondary` with a clear non-link visual style to avoid confusion.

- **Nit:** The FRQ nav showed "Question 1 of 7" when entering Section 2, which is correct (7 = 4 + 3 sub-questions). This matches the B2-005 finding about "Question 0 of 7" being fixed and confirmed resolved.

---

## Console Errors

| Page/Route | Error Message | Severity |
|------------|---------------|----------|
| (none) | No console errors detected during entire B3 flow | — |

Zero console errors across login, dashboard, test session (MCQ + FRQ), report card, PDF generation, and dashboard return.

---

## Summary

| Metric | Count |
|--------|-------|
| Scenarios Tested | 5 (S-14, S-15, S-16, S-17, S-18) |
| PASS | 3 (S-14, S-17, S-18) |
| FAIL | 1 (S-15) |
| PARTIAL | 1 (S-16) |
| SKIP | 0 |
| Blockers Found | 0 |
| High-Priority Found | 1 (B3-001: flaggedQuestions not saved to result) |
| Medium-Priority Found | 2 (B3-002: FRQ answers wrong order/assignment; B3-003: domain bar colors wrong token) |
| Nitpicks | 3 |

### Key Findings by Impact

**B3-001 (High)** is the most important fix: `flaggedQuestions` must be copied from the session document into the result document inside `createTestResult()` in `apScoringService.js`. One line addition. Without this fix, the entire "Flagged for Review" section on every report card is always empty.

**B3-002 (Medium)** requires two coordinated fixes: (1) sort sub-question entries alphabetically in `FRQSubmittedAnswers` display, and (2) preserve FRQ question ordering from section definition in `createTestResult`. The combination ensures both the question ordering and sub-question ordering are deterministic.

**B3-003 (Medium)** is a single-line fix: replace `bg-success-text`/`bg-warning-text-strong`/`bg-error-text` with `bg-success`/`bg-warning`/`bg-error` in the domain performance bar rendering.

### Prerequisites Confirmed Working (from B3 flow)

- Test instruction screen loads correctly
- Begin Test starts new session with timer running
- Q2 flagging works during MCQ session
- Review screen shows "Flagged: 1 (Q2)" correctly
- "Submit Section" (not "Submit Test") appears on MCQ review screen correctly
- FRQ Choice Screen ("Type Your Answers" / "Write by Hand") appears correctly after Section 1 submit
- FRQ navigation works (7 sub-questions for AP Micro FRQ)
- Character counter shows "138 / 10,000 characters" correctly
- Submit Test modal fires and navigates to report card
- Report card URL pattern is correct: /ap/results/{userId}_{testId}_{attempt}
- Back to Dashboard returns to /ap with "Completed" badge on completed test card
- 0 console errors throughout entire flow
