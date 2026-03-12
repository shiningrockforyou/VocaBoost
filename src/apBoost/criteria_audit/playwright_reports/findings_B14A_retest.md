# Batch B14A-retest Findings: The Careful One — Regression Retest

**Agent:** Sonnet 4.6
**Date:** 2026-03-12
**Status:** COMPLETE — Live Playwright testing with Node.js chromium
**Persona:** B14-A — The Careful One (student4@apboost.test / Student123!)
**Test Target:** test_micro_full_1 (AP Microeconomics, 15 MCQ + 2 FRQ)
**Script:** `src/apBoost/criteria_audit/playwright_reports/b14a_retest_live.cjs`

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** 1280x720 (desktop)
- **Auth:** student4@apboost.test / Student123!
- **Browser:** Chromium (headless)
- **Screenshots:** `src/apBoost/criteria_audit/playwright_reports/screenshots_B14A_retest/`

---

## Scenario Results

### B14A-retest: Full Careful Student Flow
- **Status:** PASS (core scenario) with 2 Medium findings
- **Notes:** Session started at Q11 because student4 had an existing IN_PROGRESS session. Begin Test successfully resumed at Q11 and proceeded through Q15, review, MCQ submit, FRQ choice, FRQ answering (7 sub-questions), and final test submission. Report card loaded correctly.

---

## Fix Verification Results

| Fix | Finding | Description | Status |
|-----|---------|-------------|--------|
| suppressTakeoverRef (2s) | B14A-002 | No DuplicateTabModal on fresh session start | PASS |
| Login redirect to /ap | B14A-004 | student4@apboost.test → /ap after login | PASS |
| flaggedQuestions in result | B14A-003 | Flagged for Review on report card | PASS |
| code.startsWith fix | B14G-003 | No startsWith errors in console | PASS |
| Timer on review screen | FIX-7 | TestTimer visible on ReviewScreen | PASS |
| Submit Test confirmation | FIX-8 | Confirmation dialog before final submit | PASS |
| FRQ two-step confirmation | FIX-9 | Select card then Confirm & Continue | PASS |
| Change submission type link | FIX-9 | "Change submission type" in FRQ header | PASS |
| ARIA roles on AnswerInput | B14A-005 | role="radio" on answer choice buttons | FAIL |
| Letter badge selected state | B14B-LIVE-001 | bg-white text-brand-primary when selected | FAIL |

---

## Detailed Step Results

| Step | Status | Evidence |
|------|--------|----------|
| Login as student4@apboost.test | PASS | Redirected to http://localhost:5173/ap (screenshots/02_after_login.png) |
| Login redirect to /ap | PASS | URL: /ap immediately after login, not / |
| Instruction screen loads | PASS | "AP Microeconomics Practice Exam" (screenshots/04_instruction_screen.png) |
| No DuplicateTabModal on session start | PASS | 3s wait after load; no modal detected (screenshots/05_no_dup_modal_check.png) |
| APHeader shows "Log out" button | PASS | "Log out" visible in header (screenshots/04_instruction_screen.png) |
| Begin Test button found | PASS | Button text: "Begin Test" |
| Session resumed at Q11 | PASS | Q11 loaded from prior IN_PROGRESS session (screenshots/06_test_started.png) |
| MCQ answering Q11-Q15 (5 Qs) | PASS | Selected choices, answer visible in dark blue highlight |
| Flag Q3 (carried from prior session: Q7, Q11, Q13, Q14) | PASS | Q3 flagged (screenshots/07_q3_answered.png) |
| Answer change on Q4 (A→C) | PASS | Changed answer confirmed (screenshots/07_q4_answered.png) |
| Review screen visible with timer | PASS | "Review Your Answers" with 26:50 timer top-right (screenshots/11b_no_review_btn.png) |
| Review summary: Answered 10/15 | PASS | Summary shows "Answered: 10/15, Unanswered: 5, Flagged: 5" |
| Review grid shows flag indicators | PASS | Q3, Q7, Q11, Q13, Q14 show flag icon in grid |
| Submit Section button on review | PASS | "Submit Section" button present and clicked |
| FRQ Choice screen appeared | PASS | "Type Your Answers" / "Write by Hand" cards (screenshots/12_after_submit_section.png) |
| FRQ two-step confirmation | PASS | Click "Type Your Answers" → "Confirm & Continue" appeared and worked |
| FRQ section loaded at Q1(a) | PASS | "Question 1 (a)" with textarea (screenshots/13_frq_section.png) |
| "Change submission type" link visible | PASS | Header shows "Change submission type" in blue (screenshots/13_frq_section.png) |
| Lock indicator on FRQ section header | PASS | Lock icon + "Locked" text visible for Section 1 |
| All 7 FRQ sub-questions answered | PASS | Iterated through all 7 sub-questions with typed responses |
| FRQ Review screen (Answered 2/2) | PASS | FRQ review shows 2/2 answered, 0 flagged |
| Submit Test confirmation dialog | PASS | "Submit Test?" modal with Cancel/Submit (screenshots/15_submit_attempt.png) |
| Test submitted successfully | PASS | Redirected to /ap/results/i9ROu5cl60ZWZzsGnz2Pknw5B502_test_micro_full_1_1 |
| Report card loaded | PASS | SCORE REPORT visible (screenshots/17_report_card.png) |
| Student name correct (Diana Park) | PASS | "Student: Diana Park" — not "Unknown Student" |
| MCQ score section present | PASS | "Section 1 (MCQ) 6/15 (40%)" with progress bar |
| MCQ table columns (Q#, Domain, Topic, Correct, Your Answer, Result) | PASS | All 6 columns visible |
| FRQ pending section | PASS | "Free Response --/18 (pending)" visible |
| Flagged for Review section | PASS | 5 flagged questions listed with ✓/✗ indicators |
| No console errors | PASS | 0 errors throughout entire flow |

---

## Findings

### Blockers
None found.

---

### High-Priority
None found.

---

### Medium-Priority

#### [FINDING-B14A-RETEST-001]: AnswerInput selected letter badge still uses bg-white/20 — fix not applied

- **Severity:** Medium-Priority
- **Scenario:** B14A-retest (Step 5 — MCQ answering)
- **Criteria Reference:** B14B-LIVE-001 — Letter badge invisible when selected; listed as "Already Fixed" in `findings_B14_consolidated_fixes.md`
- **What Happened:** The consolidated fixes table at line 20 states B14B-LIVE-001 is fixed: "`AnswerInput.jsx:107` — now uses `bg-white text-brand-primary`". However, the live screenshot of Q11 (selected answer B on a dark blue background) shows the "B" letter badge as a barely-visible semi-transparent circle — confirming `bg-white/20` is still in the source. Source inspection of `src/apBoost/components/AnswerInput.jsx` line 104 confirms: `${isSelected ? 'bg-white/20 text-white' : 'bg-muted text-text-secondary'}` — the fix was NOT applied.
- **Expected:** Selected answer letter badge should be `bg-white text-brand-primary` — solid white background with dark blue text — providing high contrast against the dark blue selected row background. The letter should be clearly readable.
- **Screenshot/Evidence:** `screenshots_B14A_retest/06_test_started.png` shows Q11 with choice "B" selected. The "B" badge in the dark blue row is a subtle semi-transparent grey circle, barely distinguishable. Compare to unselected "A", "C", "D" badges which show clearly as grey circles on white background.
- **File(s) to Fix:** `src/apBoost/components/AnswerInput.jsx`
- **How to Fix:** On line 104, change:
  ```js
  ${isSelected ? 'bg-white/20 text-white' : 'bg-muted text-text-secondary'}
  ```
  to:
  ```js
  ${isSelected ? 'bg-white text-brand-primary' : 'bg-muted text-text-secondary'}
  ```
  This is at the `<span>` element that renders the letter badge (A, B, C, D). No other changes needed.
- **Acceptance Test:** Navigate to any MCQ question in a live test. Select answer choice B. The "B" letter badge in the selected row must show as a solid white circle with dark blue letter — clearly visible against the dark blue selected row background. The letter must not be semi-transparent.

---

#### [FINDING-B14A-RETEST-002]: AnswerInput answer choice buttons missing ARIA role="radio" — accessibility fix not applied

- **Severity:** Medium-Priority
- **Scenario:** B14A-retest (Step 5 — MCQ answering)
- **Criteria Reference:** B14A-005 — AnswerInput missing ARIA roles; listed as "Already Fixed" in `findings_B14_consolidated_fixes.md`
- **What Happened:** The consolidated fixes table states B14A-005 is fixed: "`AnswerInput.jsx` — role='radio'/'checkbox', aria-checked added". However, DOM inspection during the live run confirms zero `button[role="radio"]` elements on MCQ questions. Source inspection of `src/apBoost/components/AnswerInput.jsx` shows no `role` attribute on the answer choice buttons (lines 67-123). Only `type="button"` is present.
- **Expected:** MCQ answer choice buttons should have `role="radio"` and `aria-checked={isSelected}`. MCQ_MULTI answer choices should have `role="checkbox"` and `aria-checked={isSelected}`. An `aria-label` like `"Choice A: Cooperate"` should also be present for screen reader users.
- **Screenshot/Evidence:** Live Playwright selector `button[role="radio"]` returned 0 elements during the test run. `src/apBoost/components/AnswerInput.jsx` source confirms no `role` attribute.
- **File(s) to Fix:** `src/apBoost/components/AnswerInput.jsx`
- **How to Fix:** On the answer choice `<button>` element (line 67), add:
  ```jsx
  role={isMulti ? 'checkbox' : 'radio'}
  aria-checked={isSelected}
  aria-label={`Choice ${letter}: ${choiceText}`}
  ```
  For the MCQ_MULTI case, also wrap the choices in a `<div role="group" aria-label="Select all that apply">`. For standard MCQ, wrap in `<div role="radiogroup" aria-label="Answer choices">`.
- **Acceptance Test:** Open a test question. In browser DevTools, run: `document.querySelectorAll('button[role="radio"]').length` — must return 4 (for a 4-choice question). Run `document.querySelector('button[role="radio"][aria-checked="true"]')` after selecting an answer — must return the selected button element. Screen reader should announce "Choice B: Defect, radio button, checked" when option B is selected.

---

### Nitpicks

- **Nit:** The review screen (screenshot `screenshots_B14A_retest/11b_no_review_btn.png`) correctly shows the question grid with flag indicators (red flag icons on Q3, Q7, Q11, Q13, Q14). However, the grid cells show only question numbers — not the selected answer letter (A/B/C/D). Students cannot quickly verify their answer choices from the review grid without clicking each cell. This matches B14C-002 (deferred per `findings_B14_consolidated_fixes.md` under "Review Screen Layout Unification").

- **Nit:** The FRQ sub-question display at `screenshots_B14A_retest/13_frq_section.png` shows an unusual double-rendering: the question overview section lists (a), (b), (c), (d) sub-questions in a grey card, and then the individual textarea section below ALSO shows "(a)" and re-displays the sub-question text. This creates a visually redundant layout. Not a functional bug.

- **Nit:** The "Syncing your progress..." banner visible at the top of `screenshots_B14A_retest/07_q3_answered.png` confirms the offline queue is syncing correctly after answer changes. This is expected behavior. The banner text uses appropriate design tokens (bg-brand-primary area).

---

## Console Errors

| Page/Route | Error Message | Severity |
|------------|---------------|----------|
| All pages | No console errors detected | N/A |

Zero console errors throughout the entire test run (login, dashboard, instruction, MCQ Q11-Q15, review, FRQ choice, FRQ sections, submit, report card, return to dashboard). The `code.startsWith` fix in `logError.js` is confirmed working.

---

## Original B14A Findings Status

| Finding | Original Severity | Current Status |
|---------|------------------|----------------|
| B14A-001 (reconcileQueue staleness) | High | FIXED — content-based comparison in useTestSession.js lines 662-681. Session resumed at Q11 with flags intact from prior session, confirming queue reconciliation works. |
| B14A-002 (DuplicateTabModal on fresh start) | High | FIXED — suppressTakeoverRef starts true, clears after 2s. No modal appeared after 3s wait at session start. |
| B14A-003 (flaggedQuestions missing from result) | High | FIXED — 5 flagged questions appeared in report card "Flagged for Review" section with ✓/✗ indicators. |
| B14A-004 (login redirect to /) | Medium | FIXED — student4@apboost.test → /ap (not /). |
| B14A-005 (AnswerInput missing ARIA roles) | Medium | NOT FIXED — no role="radio" present. New finding B14A-RETEST-002 logged. |
| B14A-006 (review screen regex mismatch) | Medium | Test script issue, not app bug. Review screen correctly shows "Answered: X/15" text. |
| B14A-007 (FRQ 7 nav items, loop budget) | Medium | Informational — 7 FRQ sub-questions navigated successfully in this run. |
| B14B-LIVE-001 (letter badge bg-white/20) | Medium | NOT FIXED — still bg-white/20 in source. New finding B14A-RETEST-001 logged. |

---

## Summary

| Metric | Count |
|--------|-------|
| Scenarios Tested | B14-A (1 scenario, full flow) |
| PASS | 1 (full flow: login → MCQ → review → submit section → FRQ → submit test → report card) |
| FAIL | 0 |
| PARTIAL | 0 |
| SKIP | 0 |
| Fixes Verified PASS | 8 (suppressTakeoverRef, login redirect, flaggedQuestions, code.startsWith, timer on review, submit confirmation, FRQ two-step confirmation, change submission type link) |
| Fixes NOT Applied | 2 (ARIA roles, letter badge) |
| Blockers Found | 0 |
| High-Priority Found | 0 |
| Medium-Priority Found | 2 (B14A-RETEST-001: letter badge; B14A-RETEST-002: ARIA roles) |
| Nitpicks | 3 |
| Console Errors | 0 |

**Overall Verdict:** The B14A-retest scenario PASSES with no regressions in core session lifecycle, answer changes, flagging, navigator-carried flag state, FRQ section, or report card. All High-Priority original findings are confirmed fixed. Two Medium-Priority items from the consolidated fixes list were not actually applied to the source code and are re-logged above.
