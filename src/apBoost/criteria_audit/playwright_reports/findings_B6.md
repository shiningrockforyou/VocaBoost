# Batch B6 Findings: Resilience & Browser Edge Cases

**Agent:** Sonnet 4.6
**Date:** 2026-03-10
**Status:** COMPLETE
**Scenarios Covered:** S-27, S-28, S-29, E-05

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** 1440x900 (desktop)
- **Auth:** teacher@apboost.test (Teacher123!) — used because student3@apboost.test redirects to vocaBoost root (known B4-006 finding). Teacher account can access all student-facing AP routes.

---

## Scenario Results

### S-27: Duplicate Tab Detection
- **Status:** PARTIAL
- **Evidence:** Two-tab playwright test (headless chromium, shared browser context). Tab1 started session (Begin Test). Tab2 navigated to same URL and clicked "Resume Test". Tab1 received BroadcastChannel message and showed DuplicateTabModal with "Session Active Elsewhere" / "Go to Dashboard" / "Use This Tab". Tab2 entered the session without any modal warning.
- **Notes:** The detection mechanism works (BroadcastChannel fires correctly), but the modal appears on the WRONG tab. Per spec, Tab 2 (the new/incoming tab) should show the DuplicateTabModal and be blocked from entering the session. Instead, Tab 2 silently takes over and Tab 1 is blocked. "Go to Dashboard" on Tab1 correctly navigates to /ap. "Use This Tab" on the invalidated tab correctly broadcasts SESSION_CLAIMED and re-takes control. The takeover/re-takeover cycle works correctly — only the initial direction is inverted.

### S-28: Connection Status Banner
- **Status:** PARTIAL
- **Evidence:** Firestore network requests intercepted via page.route() to simulate offline. Banner states tracked at 1-second polling intervals after restoring connection.
- **Notes:**
  1. No banner in connected state: PASS (returns null)
  2. Disconnected banner ("Connection unstable - your progress is being saved locally"): PASS — appears after exactly 45 seconds (3 heartbeat failures x 15s)
  3. Syncing banner ("Syncing your progress..."): NOT OBSERVED — queue flush completes in <1 second (empty queue in test) making the banner imperceptible
  4. Reconnected banner ("Reconnected"): PASS — appears ~6s after restoring connection (after next heartbeat succeeds)
  5. Auto-dismiss: PASS — Reconnected banner dismisses exactly 2 seconds after appearing

### S-29: View Existing Seed Results on Report Card
- **Status:** PARTIAL
- **Evidence:** Navigated directly to /ap/results/result_micro_student1 through result_micro_student5, result_macro_student1, result_calc_student1. All 7 results loaded. AP Score badge shows correct numeric score (5, 4, 3, 2, 1) with correct color tokens (bg-success, bg-info, bg-warning, bg-error-bg-subtle, bg-error). "Back to Dashboard" and "Download PDF" buttons present. MCQ results table populates with domain/topic data.
- **Notes:** Two data-layer bugs found: (1) "Total: / pts (85%)" — the score numerator and denominator are blank because seed data stores `totalPossible` but APReportCard reads `result?.maxScore`; (2) "Your Answer" column shows "—" for all seed results because seed data stores `selectedAnswer` but the MCQ table reads `result.studentAnswer`.

### E-05: Before Unload Warning
- **Status:** PASS
- **Evidence:** Started test session (Begin Test), answered one question. Triggered navigation via window.location.href = '/ap'. Playwright dialog listener captured a dialog event with type "beforeunload". Page remained at test URL after dialog dismissed (navigation was cancelled). Console: 0 errors.
- **Notes:** The beforeunload handler fires when `queueLength > 0 OR status === SESSION_STATUS.IN_PROGRESS`, so it fires consistently during any active test session (not just when answers are queued). This is correct per spec. The browser native dialog appeared as expected.

---

## Findings

### Blockers
> No blockers found.

---

### High-Priority

#### [FINDING-B6-001]: Duplicate Tab Modal Appears on Wrong Tab — New Tab Takes Over Without Warning
- **Severity:** High-Priority
- **Scenario:** S-27
- **Criteria Reference:** 5.5 (duplicate tab guard), 7.6 (duplicate tab modal)
- **What Happened:** When a test session is active in Tab 1 and the user opens Tab 2 to the same test URL, Tab 2 is shown the Instruction Screen with a "Resume Test" button. When Tab 2 clicks "Resume Test", it silently enters the test session and takes control. Tab 1 then receives the BroadcastChannel `SESSION_CLAIMED` message and shows the DuplicateTabModal. Tab 2 never shows any warning.
- **Expected:** Per spec (S-27 step 3): "The DuplicateTabModal should appear [in Tab 2]" with "Go to Dashboard" and "Use This Tab" buttons. Tab 2 should be the tab that is blocked first and requires user confirmation before taking control. The original active tab (Tab 1) should continue uninterrupted until Tab 2 explicitly clicks "Use This Tab".
- **Screenshot/Evidence:** `C:/tmp/b6_s27_final_tab1_modal.png` shows Tab 1 with the DuplicateTabModal. `C:/tmp/b6_s27_final_tab2_normal.png` shows Tab 2 in normal test mode simultaneously — both tabs had live session access briefly.
- **File(s) to Fix:** `src/apBoost/hooks/useDuplicateTabGuard.js`
- **How to Fix:** The current flow is: Tab 2 mounts → immediately claims session via BroadcastChannel (line 92-98 of `useDuplicateTabGuard.js`) → Tab 1 receives `SESSION_CLAIMED` and sets `isInvalidated = true`. The fix is to add a "query" step before claiming:
  1. On mount (before claiming), Tab 2 should broadcast a `SESSION_QUERY` message asking if any other tab has an active session.
  2. Add a listener for `SESSION_ACTIVE` replies. If a reply comes within 500ms, Tab 2 should set `isInvalidated = true` immediately (blocking itself) and display the DuplicateTabModal.
  3. If no reply comes within 500ms (no other tabs), Tab 2 broadcasts `SESSION_CLAIMED` and proceeds normally.
  4. Tab 1 should listen for `SESSION_QUERY` and respond with `SESSION_ACTIVE` (including its token) if it has an active session.

  In `useDuplicateTabGuard.js`, in the `useEffect` where `channelRef.current = new BroadcastChannel(...)` is created, change the claim logic:
  ```javascript
  // Before claiming, query for existing sessions
  channelRef.current.postMessage({ type: 'SESSION_QUERY', token: instanceToken });

  // Listen for SESSION_ACTIVE response
  const queryTimeout = setTimeout(() => {
    // No one responded — safe to claim
    channelRef.current.postMessage({ type: 'SESSION_CLAIMED', token: instanceToken });
    claimSession();
  }, 500);

  // In onmessage handler, handle SESSION_QUERY:
  if (event.data.type === 'SESSION_QUERY' && event.data.token !== instanceToken) {
    // We are the active tab — announce it
    channelRef.current.postMessage({ type: 'SESSION_ACTIVE', token: instanceToken });
  }
  // Handle SESSION_ACTIVE (we are the new tab being blocked):
  if (event.data.type === 'SESSION_ACTIVE' && event.data.token !== instanceToken) {
    clearTimeout(queryTimeout); // Don't claim
    setIsInvalidated(true); // Show DuplicateTabModal on THIS tab
  }
  ```
- **Acceptance Test:** Start Tab 1 with a test session in progress (Begin Test clicked, question visible). Open Tab 2 to the same `/ap/test/:testId` URL and click "Resume Test" on the Instruction Screen. Tab 2 should immediately show the DuplicateTabModal with "Session Active Elsewhere" heading. Tab 1 should remain on the test question with no interruption. In Tab 2, click "Go to Dashboard" → Tab 2 navigates to /ap, Tab 1 continues. Re-open Tab 2 to same test URL, click "Resume Test" again, DuplicateTabModal appears. Click "Use This Tab" in Tab 2 → Tab 2 enters the test session, Tab 1 shows DuplicateTabModal.

---

### Medium-Priority

#### [FINDING-B6-002]: Seed Result Report Card Shows "Total: / pts" — maxScore Field Missing in Seed Data
- **Severity:** Medium-Priority
- **Scenario:** S-29
- **Criteria Reference:** 9.1 (report card), 9.2 (report card layout — total score display)
- **What Happened:** When viewing any seed result (e.g., `/ap/results/result_micro_student1`), the total score line displays as "Total: / pts (85%)" — the numerator and denominator are missing. The percentage is correct (calculated separately), but the raw score values are blank.
- **Expected:** The total score should display as e.g. "Total: 13/15 pts (85%)" showing actual numeric earned/possible scores.
- **Screenshot/Evidence:** Body text from b6_s29_check.cjs output shows `Total line: "/ pts (85%)"` for all seed micro results. `C:/tmp/b6_s29_score5.png` shows the blank total line.
- **File(s) to Fix:** `src/apBoost/utils/seedFullData.js` (fix seed data) OR `src/apBoost/pages/APReportCard.jsx` (fix component to handle both field names)
- **How to Fix:** There are two options:

  **Option A (Preferred — fix seed data):** In `seedFullData.js`, the `generateTestResult` function at line 916-933, rename the `totalPossible` field to `maxScore` to match what `apScoringService.js` uses:
  ```javascript
  // In generateTestResult return object, change:
  totalPossible,    // <-- old field name
  // to:
  maxScore: totalPossible,  // <-- matches APReportCard.jsx expectation
  ```

  **Option B (Defensive — fix component):** In `APReportCard.jsx` line 486, change:
  ```jsx
  Total: {result?.score}/{result?.maxScore} pts ({result?.percentage}%)
  // to:
  Total: {result?.score}/{result?.maxScore ?? result?.totalPossible} pts ({result?.percentage}%)
  ```
  Option A is preferred to keep the data schema consistent with `apScoringService.js`.

- **Acceptance Test:** Re-run seed from teacher dashboard (Developer Tools → Seed Full Test Data). Navigate to `/ap/results/result_micro_student1`. The total line should show "Total: 13/15 pts (85%)" (or similar numeric values, not "/ pts").

#### [FINDING-B6-003]: Seed Result "Your Answer" Column Shows "—" — Field Name Mismatch
- **Severity:** Medium-Priority
- **Scenario:** S-29
- **Criteria Reference:** 9.1 (report card — MCQ results table)
- **What Happened:** The MCQ results table "Your Answer" column shows "—" for all questions in every seed result. The "Correct Answer" column populates correctly (shows the correct letter). The "Result" column (✓/✗) also works correctly because it reads the `correct: boolean` field.
- **Expected:** The "Your Answer" column should show the student's actual selected answer letter (A, B, C, or D).
- **Screenshot/Evidence:** MCQ table first row output from b6_final_screenshots.cjs: `"1 | Unit 1: Basic Economic Concepts | Scarcity & Opportunity Cost | B | — | ✓"` — the 5th cell (Your Answer) shows "—" while correct answer is "B".
- **File(s) to Fix:** `src/apBoost/utils/seedFullData.js`
- **How to Fix:** In `seedFullData.js`, the `generateMCQResults` function (line 862-876) creates result objects with field `selectedAnswer`. The `APReportCard.jsx` MCQResultsTable (line 112-114) reads `result.studentAnswer`. Fix by renaming the field in `generateMCQResults`:
  ```javascript
  // In generateMCQResults return object, change:
  selectedAnswer: isCorrect ? correct : wrong[...],
  // to:
  studentAnswer: isCorrect ? correct : wrong[...],
  ```
  This matches the field name used by `apScoringService.js` (line 172: `studentAnswer`).
- **Acceptance Test:** Re-run seed. Navigate to `/ap/results/result_micro_student1`. The "Your Answer" column in the MCQ table should show actual answer letters (A, B, C, or D) for each question, not "—".

#### [FINDING-B6-004]: S-28 "Syncing your progress..." Banner Imperceptible During Fast Reconnects
- **Severity:** Medium-Priority
- **Scenario:** S-28
- **Criteria Reference:** 7.5 (Connection Status Banner), 7.7 (Connection Status UI States — Reconnected state), 5.4 (heartbeat)
- **What Happened:** After restoring the network connection following an offline period, the "Syncing your progress..." banner (blue `bg-info` background with spinner) was never observed at any 1-second polling interval over 20+ seconds of monitoring. The transition went directly from "Connection unstable" (yellow) to "Reconnected" (green) without the syncing state appearing.
- **Expected:** Per spec (S-28 step 7-8): A syncing banner should appear briefly showing "Syncing your progress..." with a spinner before the "Reconnected" banner appears.
- **Screenshot/Evidence:** Timeline from b6_s28_autodismiss.cjs: `t+1s through t+5s: disconnected=true syncing=false reconnected=false` → `t+6s: disconnected=false syncing=false reconnected=true`. The `isSyncing` state (controlled by `isFlushing` from `useOfflineQueue`) is never `true` at a 1-second resolution because the queue flush completes in <1 second when the queue is small.
- **File(s) to Fix:** `src/apBoost/hooks/useOfflineQueue.js` and/or `src/apBoost/hooks/useHeartbeat.js`
- **How to Fix:** The `ConnectionStatus` component correctly renders the syncing state when `isSyncing` (= `isFlushing`) is `true`. The problem is that `isFlushing` is only `true` for the duration of the Firestore write, which may be <500ms when the queue is small. Two options:

  **Option A (Recommended):** Add a minimum display duration for the syncing banner. In `ConnectionStatus.jsx`, track a `showSyncing` state with a minimum timer:
  ```jsx
  useEffect(() => {
    if (isSyncing) {
      setShowSyncing(true);
    } else if (showSyncing) {
      // Keep syncing banner visible for at least 1s
      const timer = setTimeout(() => setShowSyncing(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isSyncing]);
  ```

  **Option B:** Trigger a queue flush when going online only if there are pending items, and ensure the `isFlushing` state is set to `true` for long enough to be visible (minimum 500ms). In `useOfflineQueue.js` `handleOnline`:
  ```javascript
  const handleOnline = useCallback(() => {
    setIsOnline(true);
    retryCountRef.current = 0;
    // Only flush if there are pending items
    if (queueLength > 0) {
      scheduleFlush(1000);
    }
  }, [scheduleFlush, queueLength]);
  ```

  Note: The core syncing functionality is implemented correctly. The issue is purely the UI timing for the banner display.
- **Acceptance Test:** Start a test session, go offline (DevTools Network → Offline), answer several questions (these queue up in IndexedDB), go back online. The "Syncing your progress..." blue banner with spinner should be visible for at least 1 second before transitioning to the "Reconnected" green banner.

---

### Nitpicks
- **Nit:** The `ConnectionStatus` component includes an "extended offline" warning after 5 minutes (shows a red `bg-error` banner saying "You have been offline for over 5 minutes"). This is a good addition not documented in the spec. No action needed.
- **Nit:** E-05 beforeunload dialog fires even when the user has no unsaved changes (queue is empty) as long as session status is IN_PROGRESS. The dialog message "You have unsaved changes. Are you sure you want to leave?" is slightly misleading when there are no actual unsaved changes. Consider showing a different message when `queueLength === 0`: "Your test session will be paused. You can resume later." — this is a low-priority polish item.

---

## Console Errors
| Page/Route | Error Message | Severity |
|------------|---------------|----------|
| S-28 (during offline simulation) | `Failed to load resource: net::ERR_FAILED` (x8) | expected — network blocked |
| S-28 (during offline simulation) | `[APBoost:useHeartbeat.doHeartbeat] Heartbeat write timed out after 5000ms` | expected — heartbeat fails when offline |
| All other scenarios | No errors | — |

---

## Summary

| Metric | Count |
|--------|-------|
| Scenarios Tested | 4 |
| PASS | 1 (E-05) |
| FAIL | 0 |
| PARTIAL | 3 (S-27, S-28, S-29) |
| SKIP | 0 |
| Blockers Found | 0 |
| High-Priority Found | 1 (B6-001) |
| Medium-Priority Found | 3 (B6-002, B6-003, B6-004) |
| Nitpicks | 2 |

### Key Findings Summary

**B6-001 (High):** Duplicate tab modal appears on the wrong tab. New Tab 2 enters the session without warning; Tab 1 (original) gets blocked. Spec requires Tab 2 to be blocked first. Fix requires BroadcastChannel `SESSION_QUERY/SESSION_ACTIVE` protocol in `useDuplicateTabGuard.js`.

**B6-002 (Medium):** Seed result "Total" line shows "/ pts (X%)" — `totalPossible` field in seed vs `maxScore` expected by component. Fix: rename field in `seedFullData.js`.

**B6-003 (Medium):** Seed result MCQ "Your Answer" column always shows "—" — `selectedAnswer` in seed vs `studentAnswer` expected by component. Fix: rename field in `seedFullData.js`.

**B6-004 (Medium):** "Syncing your progress..." banner is imperceptible in practice because the `isFlushing` state is too brief when queue is small. Fix: add minimum display duration in `ConnectionStatus.jsx`.

**E-05 PASS:** Before unload warning fires correctly and consistently during any active test session.
**S-28 PASS (partial):** Disconnected banner (after 3 heartbeat failures), Reconnected banner, and 2s auto-dismiss all work correctly.
