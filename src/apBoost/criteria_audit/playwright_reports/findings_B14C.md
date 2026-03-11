# Batch B14-C Findings: Realistic Simulation — The Second-Guesser

**Agent:** Sonnet 4.6
**Date:** 2026-03-10
**Status:** PARTIAL — Code analysis complete; live browser execution blocked (Playwright MCP tools unavailable in this session)
**Scenarios Covered:** B14-C (Second-Guesser flow)

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** Desktop (1440px assumed)
- **Auth:** student6@apboost.test / Student123!
- **Note:** The Playwright MCP browser tools (`mcp__playwright__browser_*`) were not available in this execution environment. This report documents findings derived from a thorough static code analysis of all components involved in the second-guesser flow. All findings reference exact file paths, line numbers, and function signatures. Live verification was not possible; each finding includes an Acceptance Test that a live agent can use to confirm or refute.

---

## Scenario Results

### B14-C: The Second-Guesser
- **Status:** PARTIAL (code analysis only — cannot mark PASS without live execution)
- **Evidence:** Static code analysis of `useTestSession.js`, `useOfflineQueue.js`, `ReviewScreen.jsx`, `APTestSession.jsx`, `QuestionNavigator.jsx`, `AnswerInput.jsx`, and `apScoringService.js`
- **Notes:** The answer persistence architecture is architecturally sound for the second-guesser pattern. Two potential UX issues were identified (see findings below). No data-loss or stale-state risks were found in the core answer management logic for the described flow.

---

## Code Analysis: Second-Guesser Flow Trace

The following trace documents how the code handles each step of the B14-C scenario:

**Steps 1-4 (Answer Q1-Q15):**
- Each `setAnswer(letter)` call in `useTestSession.js` (line 435) immediately updates the local `answers` Map (optimistic) and queues an `ANSWER_CHANGE` action to IndexedDB via `addToQueue`.
- `addToQueue` schedules `flushQueue` after 300ms for `ANSWER_CHANGE` (high-priority path, `useOfflineQueue.js` line 214).
- `flushQueue` deduplicates by `(questionId, subQuestionLabel)` using last-write-wins (line 274-277), so the latest answer for each question is always what gets persisted to Firestore.

**Step 5 (Go back to Q3 via navigator, change answer):**
- Navigator `handleNavigate(2)` calls `goToQuestion(2)` in `useTestSession.js` (line 370). This sets `currentQuestionIndex = 2`. The `answers` Map is unchanged.
- Selecting a new answer calls `setAnswer(newLetter)`, which sets `answers.set(q3_id, newLetter)` locally and queues `ANSWER_CHANGE` for Q3.
- Since `flushQueue` uses last-write-wins, the new Q3 answer overwrites any previous Q3 answer in Firestore.

**Step 6 (Go to Q11 via navigator, change answer):**
- Same pattern as Q3. `goToQuestion(10)`, then `setAnswer` for Q11. New answer queued, will flush.

**Step 7 (Go to Q7 via navigator, keep same answer):**
- `goToQuestion(6)` only. No `setAnswer` call. `answers` Map unchanged for Q7. Nothing queued. Q7 retains its original answer.

**Step 8 (Open Review screen):**
- `handleGoToReview()` sets `view = 'review'`.
- `ReviewScreen` receives the live `answers` Map from `useTestSession`. It calls `answers.has(questionId)` for each question. Since the Map was updated optimistically for all changes, the review grid correctly shows all 15 questions as answered with their latest values.

**Step 9 (Return to Questions, change Q14):**
- "Return to Questions" button calls `onCancel` which is `handleReturnFromReview` in `APTestSession.jsx` (line 205-207). This sets `view = 'testing'` only.
- IMPORTANT: `currentQuestionIndex` is NOT reset. User returns to whichever question they were on when they navigated to Review (Q15, since that's where "Review →" appears). User must navigate to Q14 via Navigator or Back button.
- `setAnswer` for Q14 updates the Map and queues the change.

**Step 10 (Go back to Review):**
- `handleGoToReview()` again. Review receives updated `answers` Map. Q14's box now reflects the changed answer.

**Step 11 (Return to Questions, check Q2):**
- "Return to Questions" again. User navigates to Q2. No `setAnswer` call. Q2 unchanged.

**Step 12 (Go back to Review third time and Submit):**
- Review screen opens. Submit button calls `handleSubmit`.
- `handleSubmit` calls `submitTest({ frqSubmissionType: 'typed' })`.
- `submitTest` flushes the queue first (line 519-523 of `useTestSession.js`): `if (queueLength > 0 && !isFlushing) { await flushQueue() }`.
- `createTestResult(session.id, frqData)` then calls `getSession(sessionId)` from Firestore, which returns the fully synced session with all answers.
- Score is calculated from `session.answers`, which at this point contains the final last-written values for all questions.

**Step 13 (Verify final answers):**
- Q3: changed answer (last write wins) — CORRECT
- Q11: changed answer (last write wins) — CORRECT
- Q7: original answer unchanged (never called `setAnswer` again) — CORRECT
- Q14: changed answer (last write wins) — CORRECT
- Q2: original answer unchanged (never called `setAnswer` again) — CORRECT

---

## Findings

### Blockers
> No blockers identified in code analysis.

---

### High-Priority
> No high-priority issues identified in code analysis.

---

### Medium-Priority

#### [FINDING-B14C-001]: "Return to Questions" does not restore position to first unanswered or last-changed question — user lands at Q15

- **Severity:** Medium-Priority
- **Scenario:** B14-C
- **Criteria Reference:** Section 7.4 (Review Screen Navigation) — "Return to Questions should allow the student to navigate back to any question"
- **What Happened:** When the student clicks "Return to Questions" from the Review screen (not via a grid cell click), `handleReturnFromReview()` in `APTestSession.jsx` (line 205-207) sets `view = 'testing'` without changing `currentQuestionIndex`. Since the Review button appears at Q15 (the last question), the student is returned to Q15 every time they click "Return to Questions". To reach Q14 (step 9) or Q2 (step 11), the student must open the navigator or use the Back button. There is no affordance indicating where they will land.
- **Expected:** Clicking "Return to Questions" should either (a) restore the student to the last question they visited before opening Review, OR (b) display the question navigator's grid view immediately so the student can pick a question, OR (c) at minimum restore to Q1 so the student sees all questions from the beginning. The current behavior silently drops the student at Q15 with no indication of how to reach earlier questions.
- **Screenshot/Evidence:** Code analysis — `APTestSession.jsx` line 205-207: `const handleReturnFromReview = () => { setView('testing') }` — no position change. `ReviewScreen.jsx` line 151-158: "Return to Questions" button triggers `onCancel`. Navigator "Question 15 of 15" would be displayed.
- **File(s) to Fix:** `src/apBoost/pages/APTestSession.jsx`
- **How to Fix:** Modify `handleReturnFromReview` to also call `goToQuestion(0)` so the student is always returned to Q1 when using "Return to Questions" generically, OR preserve the position prior to opening review by storing it in a ref before `handleGoToReview` and restoring it in `handleReturnFromReview`. The simplest fix that improves UX is to return to Q1:
  ```js
  const handleReturnFromReview = () => {
    goToQuestion(0)  // Return to Q1 for clearer orientation
    setView('testing')
  }
  ```
  Alternatively, pass a `goToQuestion` call in the `onGoToQuestion` handler on ReviewScreen so that clicking any question grid cell always both navigates AND switches view (already implemented correctly at line 432-435), and document that "Return to Questions" returns to Q15 as an intentional affordance when the user wants to continue from where they left off.
- **Acceptance Test:** Take a test, answer Q1-Q15, open Review screen. Click "Return to Questions" (not a grid cell). Verify which question is displayed. If Q1 — fix is confirmed. If Q15 — behavior is unchanged (acceptable if documented as intentional, but still confusing in the second-guesser flow).

---

#### [FINDING-B14C-002]: No visual confirmation that answer changed in Review grid after returning from a change

- **Severity:** Medium-Priority
- **Scenario:** B14-C
- **Criteria Reference:** Section 7.1 (Review Screen Grid) — "Grid shows answered/unanswered/flagged states"
- **What Happened:** The Review screen grid in `ReviewScreen.jsx` (lines 52-96) shows each question box as filled (`bg-brand-primary`) if `answers.has(questionId)` is true. When a student changes an answer (e.g., Q14 from A to B), the box remains the same color (blue/filled) because `answers.has(q14_id)` was already true before the change. There is no visual distinction between "original answer" and "changed answer" in the grid. A student who changed Q14, Q11, and Q3 would see all 15 boxes uniformly filled — they cannot visually verify which answers were changed vs. which were kept.
- **Expected:** Per typical AP exam review conventions, the grid should be able to surface that the review reflects the current final answer for each question. Ideally, questions with changed answers would have a subtle visual indicator (e.g., a dot, an asterisk, or a secondary color state) to indicate the answer was modified. At minimum, the grid cell tooltip or accessible description should state the selected answer letter.
- **Screenshot/Evidence:** Code analysis — `ReviewScreen.jsx` line 7-30 (QuestionBox component): only three visual states — `bg-surface` (unanswered), `bg-brand-primary` (answered), `border-warning-ring` (flagged). No state for "changed answer". The `QuestionBox` receives no `answer` prop, only `isAnswered` boolean.
- **File(s) to Fix:** `src/apBoost/components/ReviewScreen.jsx`
- **How to Fix:** In the `QuestionBox` component (line 1-31), add an optional visual indicator that shows the currently selected letter. Since all 15 questions will be answered in the second-guesser flow, this is most practical as an `aria-label` for accessibility, plus optionally a small letter badge inside the box:
  ```jsx
  function QuestionBox({ number, questionId, isAnswered, isFlagged, hasAnnotation, selectedAnswer, onClick }) {
    // ... existing logic ...
    return (
      <button
        onClick={onClick}
        aria-label={`Question ${number}${isAnswered ? `, answered ${selectedAnswer}` : ', unanswered'}${isFlagged ? ', flagged' : ''}`}
        className={`...`}
      >
        {isFlagged ? '🚩' : number}
        {isAnswered && selectedAnswer && (
          <span className="absolute bottom-0.5 right-0.5 text-[8px] font-bold text-white/80">
            {selectedAnswer}
          </span>
        )}
        {hasAnnotation && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-info-ring rounded-full" />
        )}
      </button>
    )
  }
  ```
  In `ReviewScreen`, pass `selectedAnswer={answers.get(questionId)}` to each `QuestionBox`. This requires `answers` to be used inside the map loop (it already is available as a prop).
- **Acceptance Test:** Take a test, answer Q1-Q15 with mixed choices. Open Review screen. Verify each box shows the answer letter (e.g., Q3 shows "B" if B was selected). Change an answer and return to Review — verify the box shows the updated letter.

---

#### [FINDING-B14C-003]: Potential race condition between queue flush and createTestResult when submission happens rapidly after final answer change

- **Severity:** Medium-Priority
- **Scenario:** B14-C
- **Criteria Reference:** Section 7.6 (Submit Test) — "Final submitted answers must reflect all student changes"
- **What Happened:** In `submitTest` (`useTestSession.js` line 519-523), the queue flush guard is: `if (queueLength > 0 && !isFlushing)`. The `queueLength` state is updated asynchronously via `updateQueueLength()` (called in `addToQueue` after the IndexedDB write completes). There is a brief window where:
  1. `setAnswer` for Q14 is called (e.g., on step 9 of the flow)
  2. The IndexedDB write starts (async)
  3. The student immediately clicks "Go to Review" then "Submit Test" within ~50ms
  4. At the moment `submitTest` checks `queueLength`, the IndexedDB write may not have completed yet
  5. `queueLength` may still read 0 (stale state)
  6. The `if (queueLength > 0 && !isFlushing)` guard evaluates false
  7. `createTestResult` reads `session.answers` from Firestore BEFORE the Q14 answer was written
  8. Q14's changed answer is NOT reflected in the submitted result

  This is a timing-dependent issue. In practice, the 300ms debounce on `scheduleFlush` means the queue flush would already be in progress by the time a user navigates through review and clicks submit. However, the guard relies on React state (`queueLength`) which can be stale for one render cycle, creating a theoretical data loss window.
- **Expected:** `submitTest` should guarantee all queued answers are flushed to Firestore before reading the session for scoring, regardless of whether `queueLength` React state reflects the true IndexedDB count.
- **Screenshot/Evidence:** Code analysis — `useTestSession.js` line 519-523:
  ```js
  if (queueLength > 0 && !isFlushing) {
    await flushQueue()
  }
  ```
  `queueLength` is React state updated via `setQueueLength` in `useOfflineQueue.js` line 118-120 (async callback). There is no guarantee that `queueLength > 0` at the moment `submitTest` is called, even if items are genuinely pending in IndexedDB.
- **File(s) to Fix:** `src/apBoost/hooks/useTestSession.js`
- **How to Fix:** Replace the `queueLength > 0` guard with an unconditional `flushQueue()` call at submit time, or — better — call `getPendingItems()` directly to check IndexedDB for pending items rather than relying on React state:
  ```js
  const attemptSubmission = async () => {
    // Always flush before reading session for scoring
    // Use getPendingItems() to check actual IndexedDB state, not React state
    const pending = await getPendingItems()
    if (pending.length > 0 && !isFlushing) {
      await flushQueue()
    }
    return await createTestResult(session.id, frqData)
  }
  ```
  Note: `getPendingItems` is already available from `useOfflineQueue` destructuring in `useTestSession.js` (line 65). This change ensures the flush guard reflects actual IndexedDB contents rather than potentially stale React state.
- **Acceptance Test:** Answer Q14, then within 100ms navigate to Review and click Submit. Verify the submitted result document in Firestore contains Q14's final answer. (This requires adding a small artificial delay between answer selection and submit — e.g., using `page.evaluate` to call `setAnswer` then immediately calling the submit handler.)

---

### Nitpicks

- **Nit:** The "Review" button text in `QuestionNavigator.jsx` (line 141: "Review →") is the only navigation item in the bottom bar that has the "Review →" label. After answering all 15 questions, returning from Review via "Return to Questions" puts the user at Q15 where they see "Review →" again, which is a smooth experience. However, if the student navigates to an earlier question (e.g., Q1) using the navigator, the "Review →" button only appears on Q15. This is correct behavior — the button appears only when `!canGoNext` — but students may not realize they need to navigate to Q15 to reach the Review screen; they might think there's no way to review from Q1. Consider adding "Go to Review" as a separate option in the hamburger menu or navigator modal for better discoverability.

- **Nit:** In `ReviewScreen.jsx` (line 151-156), the "Return to Questions" button uses `border border-border-default text-text-secondary` styling. This is visually de-emphasized compared to the Submit button (`bg-brand-primary text-white`). This is intentional (Submit is the primary action) but the "Return to Questions" button reads as near-disabled rather than as a secondary action. Consider using `text-text-primary` instead of `text-text-secondary` for better readability.

---

## Console Errors

| Page/Route | Error Message | Severity |
|------------|---------------|----------|
| (not tested live) | Live browser execution was not available | N/A |

---

## Summary

| Metric | Count |
|--------|-------|
| Scenarios Tested | 1 |
| PASS | 0 |
| FAIL | 0 |
| PARTIAL | 1 (code analysis only) |
| SKIP | 0 |
| Blockers Found | 0 |
| High-Priority Found | 0 |
| Medium-Priority Found | 3 |
| Nitpicks | 2 |

---

## Additional Notes: Architecture Assessment

The core answer persistence architecture for the second-guesser pattern is sound:

1. **Optimistic updates**: `setAnswer` in `useTestSession.js` updates the `answers` Map immediately, so the UI always reflects the latest selection without waiting for Firestore.
2. **Last-write-wins deduplication**: `flushQueue` in `useOfflineQueue.js` (lines 272-278) deduplicates `ANSWER_CHANGE` actions per `(questionId, subQuestionLabel)`, so changing Q3 from A to B to C only writes C to Firestore — no stale answer states.
3. **Review screen data freshness**: `ReviewScreen` receives the live `answers` Map as a prop. On every return to the Review screen, the component re-renders with the current Map contents. There is no stale closure or cached state issue.
4. **Submit reads from Firestore**: `createTestResult` in `apScoringService.js` (line 131) reads `session.answers` from the Firestore document after flushing the queue, not from React state. This provides a server-side source of truth for scoring.

The only architectural concern is Finding B14C-003 (race condition between queue flush guard using stale React state), which is low-probability in normal usage but theoretically possible for extremely fast submitters.

---

## Questions from Consolidated Fix Review (2026-03-11)

> These questions are from the lead developer reviewing all B14 findings. Please answer in a follow-up section below.

**Q1 (re: FIX-6 / B14C-003):** You identified the submit race condition as "low-probability in normal usage." Did any live agent run (B14A, B14B, B14D, B14E) actually observe data loss from this race, or is this purely from static code analysis? If no live agent has reproduced it, we may deprioritize it below the other high-priority fixes (FIX-1 through FIX-5) which have confirmed live data loss.

---

## Responses (2026-03-11)

**A1 (re: FIX-6 / B14C-003):** This finding is **purely from static code analysis** — no live agent run reproduced data loss from this specific race condition. The B14C audit did not have Playwright MCP tools available, so all findings are code-inferred. The 300ms high-priority debounce on `scheduleFlush` plus the realistic human latency of navigating Review → clicking Submit (easily 1-2 seconds) makes this extremely unlikely in practice. **Deprioritize below FIX-1 through FIX-5.** The fix is still correct (replace `queueLength > 0` with `getPendingItems()` check) and low-risk, but it's a hardening measure, not a response to observed data loss.

Additionally, note that B14C-001 ("Return to Questions" landing on Q15) has been reviewed and determined to be **acceptable current behavior** — the student returns to where they left off, which is standard "go back" UX. The Review screen's question grid provides direct navigation to any question. This finding is being deferred as part of a broader "Review screen layout unification" item in AP_BOOST_TRACKER.md, which would give the review screen the same Back/Next nav as question pages, making the dedicated "Return to Questions" button unnecessary.
