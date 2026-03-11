# Batch B14C-retest v2 Findings: The Second-Guesser — FIX-6 Verification

**Agent:** Sonnet 4.6
**Date:** 2026-03-12
**Status:** COMPLETE
**Scenarios Covered:** B14-C (The Second-Guesser — student6@apboost.test, Micro test)

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** 1280x720 (Chromium default)
- **Auth:** student6@apboost.test / Student123!
- **Test ID:** test_micro_full_1 (Micro test, 15 MCQ + FRQ)
- **Script:** e2e/b14c_retest_v4.spec.js (final passing run)
- **Screenshots:** src/apBoost/criteria_audit/playwright_reports/screenshots_B14C_retest_v4/
- **Results JSON:** src/apBoost/criteria_audit/playwright_reports/b14c_retest_v4_results.json

---

## TDZ Crash Check

**No TDZ crash observed.** The prior report of `Cannot access 'scheduleFlush' before initialization` was confirmed to be a stale Vite HMR artifact. The Micro test page loaded cleanly in all 4 test runs. No `scheduleFlush` error appeared in page errors or console output.

---

## Test Execution Summary

The full Second-Guesser scenario was completed successfully in the v4 run (1 minute 24 seconds):

1. Login as student6@apboost.test → redirected to `/` (known bug B4-006, documented separately)
2. Navigated directly to `/ap/test/test_micro_full_1`
3. Dismissed DuplicateTabModal (from stale prior session) via "Use This Tab"
4. Clicked "Begin Test" — started fresh session at Q15 (prior session's last position)
5. Navigated to Q1 via navigator, answered Q1-Q15 in order:
   - Q1=A, Q2=B, Q3=C, Q4=A, Q5=D, Q6=B, Q7=A, Q8=C, Q9=B, Q10=D, Q11=A, Q12=C, Q13=B, Q14=D, Q15=A
6. Navigated to Q3 via navigator — changed C → A. Confirmed detected: A.
7. Navigated to Q11 via navigator — changed A → B. Confirmed detected: B.
8. Navigated to Q7 via navigator — observed only, did NOT change. Confirmed: A (unchanged).
9. Opened Review screen (visit 1) via "Review →" at Q15. Confirmed: Answered 15/15.
10. Clicked "Return to Questions" — landed on Q15.
11. Navigated to Q14 via navigator — changed D → C. Confirmed detected: C.
12. Opened Review screen (visit 2). Confirmed: Answered 15/15.
13. Clicked "Return to Questions" again — landed on Q15.
14. Navigated to Q2 via navigator — observed only. Confirmed: B (unchanged).
15. Opened Review screen (visit 3). Confirmed: Answered 15/15.
16. Clicked "Submit Section" → FRQ choice screen appeared.
17. Selected "Type Your Answers" → Confirmed & Continue → answered all FRQ questions.
18. Submitted test → Results page loaded at `/ap/results/4Bt1gbCpgPQvMovo1M0kXvJMbzi2_test_micro_full_1_1`.

---

## Answer Persistence Verification

### Answers Selected During Test

| Question | Original Answer | Changed To | Final Answer |
|----------|----------------|------------|--------------|
| Q2 | B | (not changed) | B |
| Q3 | C | A | A |
| Q7 | A | (not changed, visited) | A |
| Q11 | A | B | B |
| Q14 | D | C | C |

### Report Card Verification

Report card table column order: `[Q#, Unit, Topic, Correct Answer, Your Answer, Result]`

| Question | Expected (My Answer) | Report "Your Answer" | Result | PASS? |
|----------|---------------------|---------------------|--------|-------|
| Q2 | B (original) | B | ✓ | **PASS** |
| Q3 | A (changed from C) | A | ✗ | **PASS** — changed answer persisted |
| Q7 | A (original, visited only) | A | ✗ | **PASS** — unchanged answer persisted |
| Q11 | B (changed from A) | B | ✓ | **PASS** — changed answer persisted |
| Q14 | C (changed from D) | C | ✗ | **PASS** — changed answer persisted |

**All 5 key answer persistence checks PASS.** Changed answers (Q3, Q11, Q14) correctly replaced the originals in the report. Visited-but-not-changed answers (Q7, Q2) were correctly preserved.

---

## Scenario Results

### B14-C: The Second-Guesser — Full Flow
- **Status:** PASS (with observations)
- **Evidence:** Review screens confirmed 15/15 answered across all 3 visits. Report card confirmed all changed answers reflected correctly. No console errors throughout.
- **Notes:** Answer persistence through multiple Review→Return→Change cycles is working correctly. FIX-6 is VERIFIED.

---

## Findings

### Blockers
> None.

---

### High-Priority
> None.

---

### Medium-Priority

#### [FINDING-B14C-001]: "Return to Questions" Always Lands on Q15, Not Last Visited Question

- **Severity:** Medium-Priority
- **Scenario:** B14-C (Second-Guesser)
- **Criteria Reference:** B14 — Realistic Student Simulation, UX gaps
- **What Happened:** After clicking "Return to Questions" from the Review screen, the app consistently returned to **Q15** on both return visits. The last question the student had visited before opening Review was Q7 (first return) and Q2 (second return), but neither was the landing point. Q15 was the last question navigated to before clicking "Review →" (since the only way to reach the Review screen is via the "Review →" button at Q15).
- **Expected:** Ideally, "Return to Questions" should return to either: (a) the last question the student was actively working on, or (b) Q1 (predictable start). Landing on Q15 every time is confusing because the student's last intent was Q7 or Q2, not Q15.
- **Screenshot/Evidence:** Screenshots `RETURN_01.png` and `RETURN_02.png` both show Q15 active. The step logs confirm: "B14C-001 Return 1: landed on Q15" and "B14C-001 Return 2: landed on Q15".
- **File(s) to Fix:** `src/apBoost/pages/APTestSession.jsx`
- **How to Fix:** In `handleReturnFromReview` (line 205-207 of APTestSession.jsx), after setting `setView('testing')`, also call `goToQuestion(lastVisitedQuestionIndex)` where `lastVisitedQuestionIndex` is tracked in a state variable (e.g., `lastEditedIndex`). The simplest fix is to track which question the user was on before going to Review: save `position.questionIndex` in a state variable when `handleGoToReview` is called, then restore it via `goToQuestion()` when `handleReturnFromReview` is called.

  ```jsx
  // Add state:
  const [preReviewQuestionIndex, setPreReviewQuestionIndex] = useState(0)

  const handleGoToReview = () => {
    setPreReviewQuestionIndex(position.questionIndex) // save current position
    setView('review')
  }

  const handleReturnFromReview = () => {
    setView('testing')
    goToQuestion(preReviewQuestionIndex) // restore saved position
  }
  ```

- **Acceptance Test:** Answer Q1-Q15, navigate to Q7 via navigator, open Review screen, click "Return to Questions" — verify landing is on Q7 (not Q15). Repeat with Q2 as last visited before Review.

---

#### [FINDING-B14C-002]: Review Grid Does Not Show Selected Answer Letter Badges

- **Severity:** Medium-Priority (UX Enhancement)
- **Scenario:** B14-C
- **Criteria Reference:** B14 — Realistic UX expectations
- **What Happened:** The Review screen grid shows question boxes numbered 1-15 (or 🚩 for flagged questions) with a blue `bg-brand-primary` background for answered questions. However, the boxes do **not** show which answer letter (A/B/C/D) was selected. The student can see that a question is answered, but cannot see their specific choice.
- **Expected:** For a "second-guesser" student reviewing their answers, seeing the selected letter (e.g., "A" or "C") directly in the review grid would allow quick review without navigating into each question. Many AP practice platforms show the selected answer in the review grid.
- **Screenshot/Evidence:** `REVIEW_01.png` shows the review grid with blue boxes numbered 1-15. No letter badges visible in any grid box. The `hasBadges` check returned `false` for all three review visits.
- **File(s) to Fix:** `src/apBoost/components/ReviewScreen.jsx` (QuestionBox component, lines 1-31) and `src/apBoost/components/QuestionNavigator.jsx` (QuestionBox component, lines 6-36)
- **Suggested Fix:** In `ReviewScreen.jsx`, modify the `QuestionBox` component to accept an `answerLetter` prop and display it inside the button when answered:

  ```jsx
  // In ReviewScreen.jsx, QuestionBox:
  function QuestionBox({ number, questionId, isAnswered, isFlagged, answerLetter, hasAnnotation, onClick }) {
    // ... existing code ...
    return (
      <button ...>
        {isFlagged ? '🚩' : (isAnswered && answerLetter ? answerLetter : number)}
        {hasAnnotation && (...)}
      </button>
    )
  }
  ```

  In the parent ReviewScreen component where QuestionBox is rendered (around line 88-98), pass `answerLetter` by looking up the answer: `const answerValue = answers.get(questionId)` — for MCQ this will be the letter string.

---

#### [FINDING-B14C-003]: DuplicateTabModal Appears When Reloading Test After Browser Crash/Close

- **Severity:** Medium-Priority
- **Scenario:** B14-C (observed during test setup)
- **Criteria Reference:** B6 — Session Resilience
- **What Happened:** When a prior Playwright browser instance closed while a test session was in-progress (leaving an orphaned `sessionToken` in Firestore), the next browser opening the same test URL immediately showed the DuplicateTabModal ("Session Active Elsewhere"). This happened even though no other browser tab was actually open. The BroadcastChannel query (1-second timeout) should auto-claim the session, but the Firestore heartbeat check then detects the token mismatch and shows the modal.
- **Expected:** When a browser instance closes unexpectedly (crash, window close), the session should be considered abandoned. A new browser opening the same session should be able to claim it without seeing the DuplicateTabModal. The 32-second heartbeat staleness check (previously fixed) should handle this by treating old heartbeats as "no other tab active."
- **Screenshot/Evidence:** In the v4 run, the log shows "DuplicateTabModal detected — clicking Use This Tab" at test load. The modal is dismissable, but creates unnecessary friction for a student resuming after a crash.
- **File(s) to Fix:** `src/apBoost/hooks/useHeartbeat.js` (lines 52-59) — the takeover check fires immediately on first heartbeat, before the BroadcastChannel 1-second auto-claim timeout completes.
- **How to Fix:** In `useHeartbeat.js`, the `suppressTakeoverRef` already handles some suppression. The issue is that on first load, the heartbeat runs before the 1-second BroadcastChannel auto-claim timeout completes. Add a `suppressTakeoverRef` window at startup (e.g., suppress for 2 seconds on initial mount) or check `lastHeartbeat` timestamp — if the Firestore `lastHeartbeat` is older than the heartbeat interval (30s), consider the session abandoned and claim silently.
- **Acceptance Test:** 1) Start test, let it run for 30+ seconds (so heartbeat fires). 2) Close the browser window entirely. 3) Open a new browser, navigate to the same test URL. 4) Verify: no DuplicateTabModal appears and the test resumes cleanly.

---

### Nitpicks

- **Nit:** The "Submit Section" button text (shown when MCQ section is not the final section) correctly changes to "Submit Test" when on the FRQ final section. This is working correctly.

- **Nit:** The review summary shows "Flagged: 3 (Q2, Q7, Q14)" — these are flagged questions carried over from a prior test run by the same student account on the same test ID. Flag persistence across sessions is by design (sessions are associated with test+user), but may confuse students who see flags from a prior attempt.

---

## B14C-001 Observed Behavior: Return to Questions Landing

| Return Visit | Last Question Before Review | Last Navigator Click | Landing Position | Expected |
|-------------|----------------------------|---------------------|------------------|---------|
| Return 1 | Q7 (visited but not via "Review →") | Q15 (to access Review →) | **Q15** | Q7 (last worked on) |
| Return 2 | Q2 (visited but not via "Review →") | Q15 (to access Review →) | **Q15** | Q2 (last worked on) |

**Behavior explanation:** The "Review →" button only appears on Q15 (the last question in the section). To reach the Review screen, the student must navigate to Q15 first. When "Return to Questions" is clicked, `handleReturnFromReview()` sets `view='testing'` without resetting the question position — so the app stays at Q15 (which was the last position set by `goToQuestion(14)` when navigating to Q15 to click Review).

---

## Console Errors

| Page/Route | Error Message | Severity |
|------------|---------------|----------|
| All routes | None | — |

Zero console errors throughout the entire test run (Q1-Q15 answering, 3 Review visits, FRQ section, Results page).

---

## Summary

| Metric | Count |
|--------|-------|
| Scenarios Tested | 1 (B14-C) |
| PASS | 1 |
| FAIL | 0 |
| PARTIAL | 0 |
| SKIP | 0 |
| TDZ Crash | 0 (not reproduced — was stale HMR artifact) |
| Blockers Found | 0 |
| High-Priority Found | 0 |
| Medium-Priority Found | 3 |
| Nitpicks | 2 |

### FIX-6 Verification Result: PASS

Answer persistence through multiple navigator visits and Review screen round-trips is working correctly:
- Q3: Changed C → A. Report shows A. ✓
- Q11: Changed A → B. Report shows B. ✓
- Q14: Changed D → C. Report shows C. ✓
- Q7: Visited only (A). Report shows A. ✓
- Q2: Visited only (B). Report shows B. ✓
- All 3 Review visits showed Answered: 15/15 with all grid boxes filled. ✓
- Zero data loss through the multi-step change-review-return cycle. ✓
