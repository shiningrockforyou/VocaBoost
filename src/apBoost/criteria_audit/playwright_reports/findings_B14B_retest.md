# Batch B14B Retest Findings

**Agent:** Sonnet 4.6
**Date:** 2026-03-12
**Status:** COMPLETE
**Scenarios Covered:** V1 (B14B-NEW-001), V2 (B14B-LIVE-001), V3 (B14B-LIVE-002), V4 (B14B-LIVE-007), V5 (B14B-003), V6 (B14B-006), V7 (FRQ two-step), V8 (Nav dedup)

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** 1440x900 (desktop)
- **Auth:** student5@apboost.test / Student123!
- **Test Used:** test_macro_full_1 (15 MCQ + 7 FRQ questions)

---

## Scenario Results

### V1 (B14B-NEW-001): logError crash — code.startsWith is not a function
- **Status:** PASS
- **Evidence:** Source code review of `src/apBoost/utils/logError.js` line 13 confirms `const code = String(error?.code || '')`. The `String()` coercion ensures numeric Firestore error codes (e.g., `400`, `503`) are converted to strings before `.startsWith()` is called. No `code.startsWith is not a function` runtime errors were observed across multiple test script runs including offline simulation.
- **Notes:** Fix was confirmed applied in the source. Multiple test run logs from prior sessions (b14b_v2_results.json, b14b_v3_results.json) showed 0 occurrences of the TypeError.

### V2 (B14B-LIVE-001): MCQ letter badge contrast — selected answer badge visibility
- **Status:** PASS
- **Evidence:** Screenshot `b14b_v2_check_02_selected.png` — shows Q15 (Macro test) with option A "Wages falling, SRAS shifting right" selected. The button is rendered with `bg-brand-primary` (dark blue) background. The letter badge "A" appears as a white circle (`bg-white`) with dark brand-primary colored letter text (`text-brand-primary font-semibold`). The badge is clearly legible with high contrast against the blue button. Options B/C/D show muted gray badges (`bg-muted text-text-secondary`) as expected.
- **Notes:** Source confirmed at `src/apBoost/components/AnswerInput.jsx` line 104: `${isSelected ? 'bg-white text-brand-primary font-semibold' : 'bg-muted text-text-secondary'}`.

### V3 (B14B-LIVE-002): Timer visible on review screen
- **Status:** FAIL (FIX APPLIED in this session)
- **Evidence:** Screenshot `b14b_retest_07_review.png` shows the MCQ review screen with "Review Your Answers" heading, question grid, summary "Answered: 0/15", and "Submit Section" button — but NO timer is visible anywhere on the screen. The `timeRemaining` prop was being passed from `APTestSession.jsx` (line 461: `timeRemaining={timeRemaining}`) but ReviewScreen did not accept or render the prop — it was not in the function signature and TestTimer was not imported.
- **Notes:** Root cause identified: `ReviewScreen.jsx` was missing `timeRemaining` prop in function signature and had no TestTimer import. Fix applied in this session — see FINDING-B14B-RETEST-001.

### V4 (B14B-LIVE-007): Submit confirmation dialog on final section
- **Status:** FAIL (not fixed in commit 0de81fb)
- **Evidence:** Code review of `APTestSession.jsx` lines 252-262: `handleSubmit()` calls `submitTest(frqData)` immediately without any confirmation step — no `window.confirm`, no `setShowSubmitConfirm(true)` state, no modal rendered. The ReviewScreen's "Submit Test" button calls `handleSubmit` directly via `onSubmit` prop (line 515). No confirmation step exists anywhere in the submit flow for the final section.
- **Notes:** This was originally reported as B14B-LIVE-007 (Medium) and listed as FIX-8 (MEDIUM / TODO) in the consolidated fixes plan. It was NOT implemented in commit 0de81fb. See FINDING-B14B-RETEST-002.

### V5 (B14B-003): FRQ navigator shows "Question 1 of X" not "Question 0 of X"
- **Status:** PASS
- **Evidence:** Test run logs (b14b_macro_retest.cjs output) confirmed "Question 1 of 7" in the FRQ section navigator. The `QuestionNavigator.jsx` uses `displayCurrentIndex + 1` for display, which produces correct 1-indexed output. The B2-005 regression (Q0 of 7) was fixed in prior sessions and remains fixed.
- **Notes:** Verified through test script console output from prior session runs.

### V6 (B14B-006): Timer urgency cues — bold under 5min, bold+pulse under 1min
- **Status:** PASS
- **Evidence:** Source code confirmed at `src/apBoost/components/TestTimer.jsx` lines 20-32:
  - `timeRemaining <= 60`: sets `colorClass = 'text-error-text'` and `urgencyClass = 'font-bold animate-pulse'`
  - `timeRemaining <= 300`: sets `colorClass = 'text-warning-text'` and `urgencyClass = 'font-bold'`
  - Both classes applied to the outer `<div>` via `${colorClass} ${urgencyClass}`.
- **Notes:** Source fix confirmed. Runtime testing with actual low-time values was limited to source inspection since controlled timer values require test setup.

### V7 (FRQ choice two-step confirmation): Click highlights, then Confirm & Continue required
- **Status:** PASS
- **Evidence:** Source confirmed at `APTestSession.jsx`: `useState(null)` for `pendingFRQChoice`, button `onClick={() => setPendingFRQChoice(FRQ_SUBMISSION_TYPE.TYPED)}` highlights the card with `border-brand-primary bg-brand-primary/5` styling, and a "Confirm & Continue" button appears (lines 429-439) only when `pendingFRQChoice` is set. Test script output from prior session confirmed: "Confirm button absent before selection" and "Confirm button present after clicking Type Your Answers, still on choice screen".
- **Notes:** Both TYPED and HANDWRITTEN cards use `setPendingFRQChoice` pattern. `handleFRQChoice(pendingFRQChoice)` is only called when the Confirm button is clicked.

### V8 (Duplicate question ID dedup): Navigator should not show duplicate entries
- **Status:** PASS
- **Evidence:** Test script confirmed 15 items in the MCQ navigator grid with 0 duplicates. Navigator correctly shows one entry per unique question ID. The `flatNavigationItems` array deduplication logic is working correctly for the Macro test (15 MCQ + 7 FRQ = 22 total, no duplicates).
- **Notes:** Verified via `document.querySelectorAll('.fixed button[class*="w-10 h-10"]')` in prior session, returning exactly 15 MCQ items.

---

## Findings

### Blockers
> None.

---

### High-Priority
> None.

---

### Medium-Priority

#### [FINDING-B14B-RETEST-001]: ReviewScreen does not render TestTimer — timer missing from review screen
- **Severity:** Medium-Priority
- **Scenario:** V3 (B14B-LIVE-002)
- **Criteria Reference:** B14B-LIVE-002 — "Timer visible on review screen" (originally Medium in findings_B14B.md)
- **What Happened:** The `timeRemaining` prop was added to the `ReviewScreen` call in `APTestSession.jsx` (line 461) as part of the fix attempt in commit 0de81fb, but `ReviewScreen.jsx` itself was never updated: it lacked both the `import TestTimer from './TestTimer'` import and the `timeRemaining` parameter in its function signature. As a result, the prop was silently ignored and no timer appeared on the review screen.
- **Expected:** Per B14B-LIVE-002 acceptance criteria: a TestTimer component should be visible on the review screen, showing the current countdown for timed sections. The timer should reflect the live `timeRemaining` value and apply urgency styling (bold at 5 min, pulse at 1 min).
- **Screenshot/Evidence:** `b14b_retest_07_review.png` — shows the MCQ review screen with "Review Your Answers" heading, question grid (15 boxes), summary stats, and submit button. No timer element is visible anywhere on the screen.
- **File(s) to Fix:** `src/apBoost/components/ReviewScreen.jsx`
- **How to Fix:** Add the following changes to `ReviewScreen.jsx`:
  1. At line 1 (top of file, before the `QuestionBox` function), add: `import TestTimer from './TestTimer'`
  2. In the `ReviewScreen` function signature (line 51 in the fixed file), add `timeRemaining = null` to the destructured props after `isFinalSection`.
  3. After the `<h1>Review Your Answers</h1>` heading and before the `{/* Question Grid */}` comment, add:
     ```jsx
     {timeRemaining != null && (
       <div className="flex justify-center mb-6">
         <TestTimer timeRemaining={timeRemaining} />
       </div>
     )}
     ```
  **NOTE: These three changes have already been applied in this session.** The file at `src/apBoost/components/ReviewScreen.jsx` now has all three changes (import at line 1, `timeRemaining = null` in props, conditional timer render at lines 79-84).
- **Acceptance Test:**
  1. Login as student5@apboost.test, navigate to `/ap/test/test_macro_full_1`.
  2. Begin test, answer at least one MCQ question.
  3. Click "Review" to open the review screen.
  4. Verify a timer (format MM:SS) is visible between the "Review Your Answers" heading and the question grid.
  5. Confirm the timer is counting down.
  6. Wait until < 5 minutes remain — timer text should become bold.
  7. If possible wait until < 1 minute — timer text should become bold and pulsing.

#### [FINDING-B14B-RETEST-002]: No submit confirmation dialog for "Submit Test" on final section
- **Severity:** Medium-Priority
- **Scenario:** V4 (B14B-LIVE-007)
- **Criteria Reference:** B14B-LIVE-007 (findings_B14B.md line 156) — "Submit Test completes without a confirmation modal — immediate submission"
- **What Happened:** The `handleSubmit` function in `APTestSession.jsx` (lines 252-262) calls `submitTest(frqData)` directly without any confirmation step. Clicking "Submit Test" on the FRQ review screen immediately submits the test and navigates to results without giving the student an "Are you sure?" prompt. This was listed as FIX-8 (MEDIUM / TODO) in the consolidated fixes plan but was not implemented in commit 0de81fb.
- **Expected:** Per B14B-LIVE-007 acceptance criteria: clicking "Submit Test" on the FRQ review screen should show a confirmation modal with a "Cancel" and "Confirm / Submit Test" button. Clicking Cancel should return to the FRQ review screen. Clicking Confirm should complete the submission.
- **Screenshot/Evidence:** Source code review of `APTestSession.jsx` lines 252-262 confirms `handleSubmit` has no confirmation step. The consolidated fixes doc (`findings_B14_consolidated_fixes.md` lines 296-314) provides the intended implementation pattern using a `showSubmitConfirm` state flag.
- **File(s) to Fix:** `src/apBoost/pages/APTestSession.jsx`
- **How to Fix:** Implement a state-driven confirmation modal in `APTestSession.jsx`:
  1. Add state near line 56 (after `pendingFRQChoice`): `const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)`
  2. Add a new handler `handleSubmitRequest` that opens the modal instead of submitting:
     ```jsx
     const handleSubmitRequest = () => setShowSubmitConfirm(true)
     ```
  3. In the `ReviewScreen` call (lines 448-462), change the `onSubmit` prop for the final section from `handleSubmit` to `handleSubmitRequest`:
     ```jsx
     onSubmit={position.sectionIndex === (test?.sections?.length || 1) - 1
       ? handleSubmitRequest
       : handleSubmitSection}
     ```
  4. Add a confirmation modal just before the closing `</div>` of the main `return` block (after the SPA blocker modal at line 573):
     ```jsx
     {/* Submit Test confirmation modal */}
     {showSubmitConfirm && (
       <div className="fixed inset-0 z-50">
         <div className="absolute inset-0 bg-black/50" onClick={() => setShowSubmitConfirm(false)} />
         <div className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-[--radius-card] p-6">
           <h3 className="text-lg font-semibold text-text-primary mb-2">Submit Test?</h3>
           <p className="text-text-secondary mb-4">This action cannot be undone. Make sure you have answered all questions you want to answer.</p>
           <div className="flex gap-3">
             <button
               onClick={() => setShowSubmitConfirm(false)}
               className="flex-1 py-3 rounded-[--radius-button] border border-border-default text-text-primary font-medium hover:bg-hover transition-colors"
             >
               Cancel
             </button>
             <button
               onClick={() => { setShowSubmitConfirm(false); handleSubmit() }}
               className="flex-1 py-3 rounded-[--radius-button] bg-brand-primary text-brand-text font-medium hover:opacity-90 transition-opacity"
             >
               Submit Test
             </button>
           </div>
         </div>
       </div>
     )}
     ```
- **Acceptance Test:**
  1. Complete the FRQ section and reach the FRQ review screen.
  2. Click "Submit Test".
  3. A bottom-sheet modal should appear with title "Submit Test?" and Cancel / Submit Test buttons.
  4. Click Cancel — modal dismisses, FRQ review screen remains active.
  5. Click "Submit Test" again, then click the "Submit Test" button in the modal — submission proceeds and app navigates to results.

---

### Nitpicks
> None observed in this retest pass.

---

## Console Errors
| Page/Route | Error Message | Severity |
|------------|---------------|----------|
| No new console errors observed in this retest pass. Prior sessions confirmed 0 new errors after logError fix. | — | — |

---

## Summary

| Metric | Count |
|--------|-------|
| Scenarios Tested | 8 |
| PASS | 6 |
| FAIL | 2 |
| PARTIAL | 0 |
| SKIP | 0 |
| Blockers Found | 0 |
| High-Priority Found | 0 |
| Medium-Priority Found | 2 |
| Nitpicks | 0 |

### Fix Verdicts

| ID | Fix Description | Verdict |
|----|-----------------|---------|
| B14B-NEW-001 | logError: `String(error?.code)` coercion | CONFIRMED FIXED |
| B14B-LIVE-001 | MCQ letter badge: `bg-white text-brand-primary font-semibold` | CONFIRMED FIXED |
| B14B-LIVE-002 | Timer on review screen | FAIL — ReviewScreen missing import + prop (FIX APPLIED in this session) |
| B14B-LIVE-007 | Submit confirmation dialog on final section | FAIL — not implemented in commit 0de81fb |
| B14B-003 | FRQ navigator "Question 1 of X" | CONFIRMED FIXED |
| B14B-006 | Timer urgency cues (bold 5min, pulse 1min) | CONFIRMED FIXED |
| FRQ two-step | Click highlights, Confirm & Continue required | CONFIRMED FIXED |
| Nav dedup | Navigator shows no duplicate entries | CONFIRMED FIXED |

### Fixes Applied in This Session

1. **ReviewScreen.jsx** — Added `import TestTimer from './TestTimer'`, added `timeRemaining = null` prop, added conditional timer render between heading and question grid. This completes the FIX-7 implementation that was partially applied (prop passed but never received).

### Remaining Open Items

- **B14B-RETEST-002 (Medium)** — Submit confirmation dialog for final section (FIX-8) is still not implemented. Needs `showSubmitConfirm` state + `handleSubmitRequest` handler + bottom-sheet modal in `APTestSession.jsx`.
