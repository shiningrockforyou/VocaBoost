# Batch B14C-Retest Findings: The Second-Guesser — FIX-6 Verification

**Agent:** Sonnet 4.6
**Date:** 2026-03-12
**Status:** BLOCKED — New Blocker discovered that prevents live test execution
**Scenarios Covered:** B14C (Second-Guesser), FIX-6 / B14C-003 verification, B14C-001, B14C-002

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** Desktop (1440x900)
- **Auth:** student6@apboost.test / Student123!
- **Test Attempted:** Automated Playwright script (b14c_retest.cjs)

---

## Executive Summary

The B14C-retest could not complete the second-guesser flow because a **new Blocker regression** (`ReferenceError: Cannot access 'scheduleFlush' before initialization`) was introduced in commit `0de81fb` to `useOfflineQueue.js`. This crash fires immediately when any test session is loaded, rendering the entire test-taking feature broken in the current build.

The FIX-6 race condition (B14C-003) **cannot be verified live** until this regression is fixed. However, static code inspection confirms that `submitTest` in `useTestSession.js` (lines 524-540) already implements the correct fix: it calls `getPendingItems()` directly from IndexedDB rather than reading stale `queueLength` React state.

Login succeeded (PASS). Navigation to `/ap/test/test_micro_full_1` succeeded. The test session failed to load due to the crash.

---

## Scenario Results

### B14C-Retest: The Second-Guesser
- **Status:** BLOCKED
- **Evidence:** Console error: `ReferenceError: Cannot access 'scheduleFlush' before initialization` fired in `useOfflineQueue.js` line 118 immediately on page load. The `APErrorBoundary` caught it and showed a "Something went wrong" screen. The instruction screen showed only a "Try Again" button — no "Begin Test" or "Resume Test" available.
- **Notes:** This is a regression from commit `0de81fb`. The same test worked in prior audit batches (B14A, B14B, B14D, B14E). The root cause is a hook declaration ordering violation: `scheduleFlush` (a `const`) is referenced in a `useEffect` dependency array at line 118 before it is declared at line 246.

---

## Findings

### Blockers

#### [FINDING-B14C-RETEST-001]: useOfflineQueue crashes with TDZ error — entire test session is broken in current build

- **Severity:** Blocker
- **Scenario:** B14C-Retest (and all test-session scenarios)
- **Criteria Reference:** Section 3.1 (Test Session Core Flow) — test must load and accept answers
- **What Happened:** Navigating to `http://localhost:5173/ap/test/test_micro_full_1` triggers an immediate JavaScript crash: `ReferenceError: Cannot access 'scheduleFlush' before initialization`. This fires in `useOfflineQueue.js` at line 118 (the dependency array `[scheduleFlush]` of the online/offline `useEffect`). React's `APErrorBoundary` catches the error and renders the error boundary UI instead of the test. The page shows: "Something went wrong — Cannot access 'scheduleFlush' before initialization". No test session can be started or resumed.
- **Expected:** The test session loads normally, showing the instruction screen with "Begin Test" or "Resume Test" button.
- **Screenshot/Evidence:** Console log from automated script shows: `[ERR] ReferenceError: Cannot access 'scheduleFlush' before initialization at useOfflineQueue (useOfflineQueue.js?t=...:118:7) at useTestSession`. Screenshot saved to `screenshots_B14C_retest/02_instruction_screen.png` shows "Try Again" button only (error boundary UI). Screenshot `03_test_started.png` shows "Something went wrong" error page.
- **File(s) to Fix:** `src/apBoost/hooks/useOfflineQueue.js`
- **Root Cause:** Commit `0de81fb` modified the online/offline `useEffect` (around line 94) to add `scheduleFlush` to its dependency array (`}, [scheduleFlush]` at line 118). However, `scheduleFlush` is declared as `const scheduleFlush = useCallback(...)` at line 246 — AFTER the `useEffect` that references it. In JavaScript, `const` declarations are not hoisted with an initialized value. When React evaluates the `useEffect` dependency array during component render, it accesses `scheduleFlush` before it has been assigned a value, throwing a `ReferenceError: Cannot access 'scheduleFlush' before initialization` (temporal dead zone error).

  In the prior version of this file (commit `4f2c353`), the online/offline `useEffect` had an empty dependency array `[]` — which suppressed the linting warning but avoided the TDZ crash.

- **How to Fix:** Move the `scheduleFlush` declaration to before its first reference. The `scheduleFlush` `useCallback` (currently at line 246) must be relocated to immediately after the `useRef` declarations at the top of the hook body (before line 94, where the online/offline `useEffect` is defined).

  Specifically, in `src/apBoost/hooks/useOfflineQueue.js`:
  1. Cut the entire `scheduleFlush` declaration block (lines 244–253):
     ```js
     // Schedule a flush with debounce
     // Uses flushQueueRef to always call the latest flushQueue (avoids stale closure)
     const scheduleFlush = useCallback((delay) => {
       if (flushTimeoutRef.current) {
         clearTimeout(flushTimeoutRef.current)
       }
       flushTimeoutRef.current = setTimeout(() => {
         flushQueueRef.current?.()
       }, delay)
     }, [])
     ```
  2. Paste it immediately after the `mountedRef` block (after line 66, before the `initDB` useEffect at line 69), so it reads:
     ```js
     const mountedRef = useRef(true)
     useEffect(() => {
       return () => { mountedRef.current = false }
     }, [])

     // Schedule a flush with debounce
     // Uses flushQueueRef to always call the latest flushQueue (avoids stale closure)
     const scheduleFlush = useCallback((delay) => {
       if (flushTimeoutRef.current) {
         clearTimeout(flushTimeoutRef.current)
       }
       flushTimeoutRef.current = setTimeout(() => {
         flushQueueRef.current?.()
       }, delay)
     }, [])

     // Initialize IndexedDB
     useEffect(() => { ...
     ```
  This ensures `scheduleFlush` is initialized before any `useEffect` dependency array or `addToQueue` closure references it. All three places that use `scheduleFlush` (`addToQueue`, the online handler `useEffect`, and the visibilitychange `useEffect`) will then be able to access the already-initialized value.

- **Acceptance Test:**
  1. Navigate to `http://localhost:5173/ap/test/test_micro_full_1` as any student account
  2. The instruction screen should load with "Begin Test" or "Resume Test" button (no error boundary)
  3. Check browser console — no `ReferenceError: Cannot access 'scheduleFlush'` error should appear
  4. Click "Begin Test" — questions should load normally
  5. Select an answer — no console errors, answer is recorded

---

### High-Priority
> No additional high-priority findings (the blocker above is the only new issue).

---

### Medium-Priority
> No additional medium-priority findings from live testing (blocked). Static code analysis findings from original B14C report stand as-is.

---

## FIX-6 / B14C-003 Verification (Static Code Analysis)

Since live execution was blocked, the FIX-6 verification is based on code inspection only:

**Finding:** FIX-6 is CONFIRMED IMPLEMENTED in source code.

In `src/apBoost/hooks/useTestSession.js`, the `attemptSubmission` function (lines 524–541) reads:

```js
const attemptSubmission = async () => {
  // 1. Wait for any in-progress flush to complete first
  await waitForFlush()

  // 2. Flush remaining queue items (check IndexedDB directly, not stale React state)
  const pending = await getPendingItems()
  if (pending.length > 0) {
    await flushQueue()
    // Double-check after flush
    const remaining = await getPendingItems()
    if (remaining.length > 0) {
      await flushQueue()
    }
  }

  // 3. Create result (idempotent via deterministic ID)
  return await createTestResult(session.id, frqData)
}
```

The original B14C-003 finding identified that the submit guard used `queueLength > 0` (stale React state). The current code uses `getPendingItems()` which reads IndexedDB directly — this is exactly the fix recommended in the B14C-003 finding. The fix also adds a double-check `flushQueue()` call and a `waitForFlush()` call for maximum safety.

**Verdict on B14C-003:** The race condition has been fixed in code. Live verification is blocked by the B14C-RETEST-001 blocker. Once the TDZ crash is fixed, re-run the second-guesser flow and confirm submitted answers match changed values.

---

## B14C-001 and B14C-002 Status (Code Inspection)

**B14C-001 ("Return to Questions" landing position):** Code in `APTestSession.jsx` (line 216-218) still reads:
```js
const handleReturnFromReview = () => {
  setView('testing')
}
```
No `goToQuestion` call. The finding from the original B14C report stands — the user returns to whatever question they were on when they clicked "Go to Review". As noted in the B14C responses, this has been deemed **acceptable behavior** and deferred as part of the "Review screen layout unification" item in AP_BOOST_TRACKER.md.

**B14C-002 (No answer letter badge in review grid):** Code in `ReviewScreen.jsx` (lines 6-33, `QuestionBox` component) still has only three visual states: `bg-surface` (unanswered), `bg-brand-primary` (answered), `border-warning-ring` (flagged). The `QuestionBox` component receives no `answer` prop and displays no letter badge. The finding from the original B14C report stands as Medium-Priority.

---

## Console Errors

| Page/Route | Error Message | Severity |
|------------|---------------|----------|
| `/ap/test/test_micro_full_1` | `ReferenceError: Cannot access 'scheduleFlush' before initialization` at `useOfflineQueue.js:118` | Error (Blocker) |
| `/ap/test/test_micro_full_1` | `[APBoost:APErrorBoundary] {type: unknown, message: Cannot access 'scheduleFlush' before initialization, code: null}` | Error (Blocker) |

---

## Summary

| Metric | Count |
|--------|-------|
| Scenarios Tested | 1 |
| PASS | 0 |
| FAIL | 0 |
| PARTIAL | 0 |
| BLOCKED | 1 |
| Blockers Found | 1 (new regression in commit 0de81fb) |
| High-Priority Found | 0 |
| Medium-Priority Found | 0 |
| Nitpicks | 0 |

---

## Action Items

1. **IMMEDIATE:** Fix `useOfflineQueue.js` TDZ crash by moving `scheduleFlush` declaration above its first `useEffect` reference (see B14C-RETEST-001 fix instructions above).
2. **AFTER FIX:** Re-run this retest script (`b14c_retest.cjs`) to live-verify FIX-6 (answer preservation through second-guesser flow) and B14C-001/B14C-002 observations.
3. **B14C-002:** Review grid answer letter badge — still Medium-Priority, still not implemented. Consider addressing in the "Review screen layout unification" sprint item.
