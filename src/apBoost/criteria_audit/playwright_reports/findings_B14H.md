# Batch B14-H Findings: Realistic Simulation — Group Chat Student

**Agent:** Sonnet 4.6
**Date:** 2026-03-10
**Status:** COMPLETE
**Scenario Covered:** B14-H (The Group Chat Student — Duplicate Tab Detection and Session Handoff)

---

## Environment
- **URL:** http://localhost:5173
- **Viewport:** 1280x800 (desktop)
- **Auth:** student11@apboost.test / Student123!
- **Test:** test_micro_full_1 (AP Microeconomics Practice Exam)
- **Browser:** Chromium (Playwright), same browser context for both tabs (required for BroadcastChannel)

---

## Scenario Results

### B14-H: The Group Chat Student
- **Status:** PARTIAL
- **Evidence:** 3 test runs executed. Screenshots 001-210 captured in screenshots_B14H/. BroadcastChannel activity confirmed via console logs in all runs.
- **Notes:** BroadcastChannel detection mechanism works correctly at the protocol level, but the DuplicateTabModal is not rendered at the right time (instruction view) and Tab 1 is never invalidated when Tab 2 enters testing mode. Answer persistence is at risk when concurrent sessions occur.

#### Step-by-step results:

| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| 1. Login as student11 | Redirect to /ap | Redirected to / then navigated to /ap | PASS (note: / not /ap — known B4-006) |
| 2. Start Micro test | Navigate to test_micro_full_1 | Navigated correctly | PASS |
| 3. Resume/Begin Test | Enter testing mode | "Resume Test" button clicked, entered testing mode | PASS |
| 4. Answer Q1-Q3 in Tab 1 | 3 questions answered | Q1 (A), Q2 (B), Q3 (C) answered successfully | PASS |
| 5. Open Tab 2 with same URL | DuplicateTabModal appears | BroadcastChannel fired but modal NOT rendered (instruction screen) | FAIL |
| 6. Click "Use This Tab" in Tab 2 | Tab 2 takes control | No modal to click — Tab 2 saw instruction screen | BLOCKED |
| 7. Answer Q4-Q6 in Tab 2 | Q4-Q6 answered | Tab 2 clicked Resume → entered testing → Q4-Q6 answered | PARTIAL |
| 8. Close Tab 2, check Tab 1 | Tab 1 shows DuplicateTabModal | Tab 1 NOT invalidated — no modal shown | FAIL |
| 9. Tab 1 "Use This Tab" | Reclaim session | N/A — modal not shown | BLOCKED |
| 10. Verify Q1-Q6 all present | 6 answers persisted | Q1-Q3 answers from Tab 1 NOT persisted in Firestore after Tab 2 session | FAIL |
| 11. Answer Q7-Q15 | Submit test | Answered in separate run | PARTIAL |
| 12. Submit test | Report card | Submit flow blocked (need Review → click) | PARTIAL |

---

## Findings

### Blockers
> None

---

### High-Priority

#### [FINDING-B14H-001]: DuplicateTabModal not rendered in instruction screen view

- **Severity:** High-Priority
- **Scenario:** B14-H (step 5 — Open same test URL in Tab 2)
- **Criteria Reference:** 5.5 (duplicate tab guard), 7.7 (duplicate tab modal); B14-H spec: "DuplicateTabModal should appear in Tab 2"
- **What Happened:** When Tab 2 navigated to `/ap/test/test_micro_full_1` while Tab 1 had an active test session, the BroadcastChannel correctly fired and the `isInvalidated` state was set to `true` in Tab 2's `useDuplicateTabGuard` hook (confirmed by console log: `[APBoost:useDuplicateTabGuard] Existing tab is active, blocking this tab`). However, DuplicateTabModal was never rendered. Tab 2 displayed the instruction screen with a "Resume Test" button, fully accessible. The user could click "Resume Test" without any warning about the conflict.
- **Expected:** As soon as Tab 2 navigates to the test URL and the BroadcastChannel confirms an active session in another tab, DuplicateTabModal should overlay the instruction screen — blocking the user from clicking Begin/Resume until they explicitly choose "Use This Tab" or "Go to Dashboard".
- **Screenshot/Evidence:** Screenshot 110 (v2 run, `110_v2_08_tab2_initial_load.png`) shows Tab 2 displaying the instruction screen with Resume Test button visible. Console log shows "Existing tab is active, blocking this tab" — confirming isInvalidated=true internally but not rendered.
- **File(s) to Fix:** `src/apBoost/pages/APTestSession.jsx`
- **How to Fix:** In the `view === 'instruction'` render block (approximately lines 300–313 in APTestSession.jsx), add a `DuplicateTabModal` overlay that renders when `isInvalidated` is true:

```jsx
// Instruction screen
if (view === 'instruction') {
  return (
    <div className="min-h-screen bg-base">
      <APHeader />
      {/* Duplicate tab modal — must overlay instruction screen too */}
      {isInvalidated && (
        <DuplicateTabModal
          onTakeControl={handleTakeControl}
          onGoToDashboard={handleGoToDashboard}
        />
      )}
      <InstructionScreen
        test={test}
        existingSession={session}
        onBegin={handleBegin}
        onCancel={handleCancel}
      />
    </div>
  )
}
```

Note: `isInvalidated` is already available in `APTestSessionInner` scope (destructured from `useTestSession` at line 97 as `isInvalidated`). The `handleTakeControl` and `handleGoToDashboard` handlers are also already defined (lines 263–270). No new state or logic is needed — only adding the conditional render.

Also verify that `useDuplicateTabGuard(session?.id)` activates correctly when Tab 2 loads the instruction screen. Since `getActiveSession` runs on mount in `useTestSession` (line 247) and sets `session` state before the instruction screen appears, `session?.id` should be non-null, allowing the guard to activate. Test confirms the guard does activate (BroadcastChannel fires) — only the rendering is missing.

- **Acceptance Test:**
  1. Login as student11, start Micro test, answer Q1-Q3, stay on Q3.
  2. Open a new tab in the same browser, navigate to `http://localhost:5173/ap/test/test_micro_full_1`.
  3. Tab 2 should immediately show DuplicateTabModal ("Session Active Elsewhere" heading, "Go to Dashboard" and "Use This Tab" buttons) overlaying the instruction screen. The instruction screen should be visible beneath the modal backdrop but not interactive.
  4. Click "Go to Dashboard" — Tab 2 navigates to `/ap`.
  5. Navigate Tab 2 back to the test URL — modal appears again.
  6. Click "Use This Tab" — Tab 2 should dismiss modal and show instruction screen (or enter testing if session was mid-test).
  7. Tab 1 should now show DuplicateTabModal.

---

#### [FINDING-B14H-002]: Tab 1 not invalidated when Tab 2 enters testing mode

- **Severity:** High-Priority
- **Scenario:** B14-H (step 8 — After Tab 2 clicks Resume/Begin, Tab 1 should show modal)
- **Criteria Reference:** 5.5 (duplicate tab guard); B14-H spec: "Tab 1 should show DuplicateTabModal"
- **What Happened:** After Tab 2 clicked "Resume Test" and entered testing mode (transitioning from `view==='instruction'` to `view==='testing'`), Tab 1 did NOT show DuplicateTabModal. Tab 1 remained fully interactive, both tabs were simultaneously in the testing state. In the v2 run (confirmed by screenshots 114, `114_v2_15_tab1_after_tab2_started.png`), Tab 1 displayed Q3 of the test without any blocking modal. Meanwhile Tab 2 correctly showed its own `isInvalidated=true` modal in testing view.

  The BroadcastChannel handoff protocol works like this:
  1. Tab 2 sends `SESSION_QUERY` on load
  2. Tab 1 responds with `SESSION_ACTIVE` (Tab 1 has `isActiveRef.current = true`)
  3. Tab 2 receives `SESSION_ACTIVE` → sets `isInvalidated = true` in Tab 2
  4. Tab 2 user clicks "Resume Test" → `startTest()` is called → does NOT broadcast `SESSION_CLAIMED`
  5. The `takeControl()` function is only called when user explicitly clicks "Use This Tab" in the modal

  Since Tab 2 entered testing mode by clicking "Resume Test" (bypassing the modal — see B14H-001), `takeControl()` was never called and `SESSION_CLAIMED` was never broadcast to Tab 1.

  Even if B14H-001 is fixed (modal shows on instruction screen), there is an additional gap: Tab 2's `handleBegin` function calls `startTest()` but does NOT call `takeControl()`. If the user clicks "Use This Tab" which calls `handleTakeControl`, that works. But `handleBegin` bypasses this.

- **Expected:** When Tab 2 transitions from instruction to testing mode (either via "Use This Tab" → "Begin" or via direct Begin click), Tab 1 should receive a `SESSION_CLAIMED` broadcast and have its `isInvalidated` set to `true`, showing DuplicateTabModal and disabling all interactions.
- **Screenshot/Evidence:** Screenshot 114 (`114_v2_15_tab1_after_tab2_started.png`) shows Tab 1 fully interactive on Q3 after Tab 2 entered testing mode. No modal visible in Tab 1.
- **File(s) to Fix:** `src/apBoost/pages/APTestSession.jsx` (handleBegin function), `src/apBoost/hooks/useDuplicateTabGuard.js` (consider adding a claim on test start)
- **How to Fix:**

  **Option A (Preferred):** Fix B14H-001 first so the modal appears on instruction screen. Then the correct flow becomes:
  1. Tab 2 sees modal → user must click "Use This Tab" first
  2. "Use This Tab" calls `handleTakeControl` → calls `takeControl()` → broadcasts `SESSION_CLAIMED`
  3. `SESSION_CLAIMED` invalidates Tab 1
  4. Then user clicks "Begin Test" (if they haven't started yet) or enters testing mode

  **Option B (Defensive — add to handleBegin):** In `APTestSession.jsx`, modify `handleBegin` to broadcast a session claim before starting:

  ```jsx
  const handleBegin = async () => {
    // If this tab is invalidated (another tab was active), claim the session first
    if (isInvalidated) {
      await takeControl() // broadcasts SESSION_CLAIMED to other tabs
    }
    await startTest()
    setView('testing')
  }
  ```

  This ensures that even if the modal is dismissed and Begin is clicked, Tab 1 gets invalidated.

  **Option C:** In `useDuplicateTabGuard.js`, add a `claimOnStart` function that broadcasts `SESSION_CLAIMED` without needing user interaction, called automatically when a tab resumes a session that another tab was using. However, this is more complex and requires knowing the prior active token.

  The simplest correct fix is A: ensure the modal appears first, then takeover happens explicitly.

- **Acceptance Test:**
  1. Tab 1: active test, Q1-Q3 answered.
  2. Tab 2: navigates to same URL → DuplicateTabModal appears (after B14H-001 fix).
  3. Tab 2: click "Use This Tab" → modal dismisses, Tab 2 enters testing mode.
  4. Tab 1: IMMEDIATELY shows DuplicateTabModal — cannot interact with questions.
  5. Tab 2: answer Q4-Q6.
  6. Close Tab 2.
  7. Tab 1: DuplicateTabModal still showing (no auto-recovery).
  8. Tab 1: click "Use This Tab" → modal dismisses, Tab 1 is active again.
  9. Q1-Q6 all visible and answered in Tab 1.

---

#### [FINDING-B14H-003]: Answer loss when Tab 2 bypasses modal and resumes same session

- **Severity:** High-Priority
- **Scenario:** B14-H (step 10 — "Verify Q1-Q6 all present")
- **Criteria Reference:** 5.5 (duplicate tab guard); B14-H spec: "answers persist across takeovers. No answer loss."
- **What Happened:** In v2 test run, Tab 1 answered Q1 (choice A), Q2 (choice B), Q3 (choice C). These answers were queued to IndexedDB for Firestore sync (via `addToQueue` → `ANSWER_CHANGE`). Tab 2 then navigated to the same URL, bypassed the modal (B14H-001), and called `createOrResumeSession` which returned the same Firestore session. Tab 2 then started answering Q4-Q6 with its own fresh local state (no Tab 1 answers in memory). Tab 2's queue writes to Firestore, potentially racing with Tab 1's pending writes. In the v3 run (fresh browser session resuming the same Firestore session), Q1 showed no persisted answer — indicating Tab 1's Q1-Q3 answers were either not flushed to Firestore before Tab 2 initialized, or Tab 2's session initialization reset the answers field.

  The `createOrResumeSession` call returns the existing session (without modification), so it does NOT wipe answers. However, if Tab 1's queue hasn't flushed to Firestore yet, and Tab 2 reads the session from Firestore, Tab 2 will not see Tab 1's pending answers. Both tabs then write their answers to the same session document field — whichever write comes last wins. Since Tab 2 starts at Q1 with no local answers and starts answering, its writes can overwrite Tab 1's Q1-Q3 if they race.

  Root cause: The offline queue in `useOfflineQueue` is per-tab (IndexedDB is tab-local in Playwright's context isolation). Tab 2 cannot see Tab 1's pending queue items. When Tab 2 resumes the session, it reads from Firestore (which may not have Q1-Q3 yet), and subsequent Tab 2 answer writes can overwrite Q1-Q3.

- **Expected:** When Tab 2 takes control (via "Use This Tab"), ALL answers from Tab 1 should be flushed to Firestore BEFORE Tab 2 is given control. Alternatively, when Tab 2 reads the session, it should read the merged state of all pending queue items (not possible cross-tab). The safest approach: Tab 1 should flush its queue to Firestore when it broadcasts `SESSION_ACTIVE` (responding to Tab 2's query), ensuring all Tab 1 answers are persisted before Tab 2 can take over.
- **Screenshot/Evidence:** In v2 run, step "Q1 answer state" showed `hasSelectedAnswer: true, selectedText: ["CThere is a movement along the curve"]` in Tab 1's React state (screenshot 119). But in v3 run (fresh browser), step "Q1 answer preserved" showed `hasAnswer: false` — no persisted answer in Firestore.
- **File(s) to Fix:** `src/apBoost/hooks/useDuplicateTabGuard.js`, `src/apBoost/hooks/useOfflineQueue.js` (or `useTestSession.js`)
- **How to Fix:**

  In `useDuplicateTabGuard.js`, when the active tab receives a `SESSION_QUERY` (meaning another tab is opening), trigger an immediate queue flush BEFORE responding with `SESSION_ACTIVE`:

  ```js
  // In channelRef.current.onmessage handler:
  if (type === 'SESSION_QUERY' && token !== instanceToken && isActiveRef.current) {
    // NEW: Flush queue to Firestore before announcing we're active
    // This ensures all pending answers are saved before another tab can take over
    if (onFlushQueue) {
      await onFlushQueue() // Add this callback parameter to useDuplicateTabGuard
    }
    logDebug('useDuplicateTabGuard', 'Responding to query from new tab')
    channelRef.current.postMessage({
      type: 'SESSION_ACTIVE',
      token: instanceToken,
    })
  }
  ```

  Modify `useDuplicateTabGuard` signature to accept an `onFlushQueue` callback:
  ```js
  export function useDuplicateTabGuard(sessionId, { onFlushQueue } = {}) {
  ```

  In `useTestSession.js`, pass `flushQueue` to the guard:
  ```js
  const { instanceToken, isInvalidated, takeControl } = useDuplicateTabGuard(session?.id, { onFlushQueue: flushQueue })
  ```

  Note: The `onmessage` handler is synchronous currently. To await `flushQueue`, you need to handle the async properly:
  ```js
  channelRef.current.onmessage = async (event) => {
    // ... existing code ...
    if (type === 'SESSION_QUERY' && token !== instanceToken && isActiveRef.current) {
      if (onFlushQueueRef.current) {
        try { await onFlushQueueRef.current() } catch (e) { /* ignore flush errors */ }
      }
      channelRef.current?.postMessage({ type: 'SESSION_ACTIVE', token: instanceToken })
    }
  }
  ```
  (Use a ref for `onFlushQueue` to avoid stale closures in the event listener.)

- **Acceptance Test:**
  1. Tab 1: answer Q1-Q3 quickly (within 1-2 seconds).
  2. Tab 2: immediately open same URL (before any 30s timer sync).
  3. Tab 2: after takeover, verify that Firestore session document has Q1, Q2, Q3 answers.
  4. Close both tabs, open fresh session.
  5. Navigate to test URL → Instruction screen shows "Resume Test".
  6. Click Resume → Q1, Q2, Q3 should all be pre-answered (visible as selected answers).

---

### Medium-Priority

#### [FINDING-B14H-004]: Tab 2 shows DuplicateTabModal in testing view AFTER entering — but only after clickng Resume (not before)

- **Severity:** Medium-Priority
- **Scenario:** B14-H (step 7 — After Tab 2 resumes)
- **Criteria Reference:** 7.7 (duplicate tab modal)
- **What Happened:** When Tab 2 clicked "Resume Test" and entered testing mode, it DID show DuplicateTabModal. Console log from v2: "Tab 2 after Begin: hasQuestion: true, hasModal: true". This means the `isInvalidated = true` state from the BroadcastChannel IS correctly rendered in the testing view. The partial implementation works correctly for the testing view but not for the instruction view.
- **Expected:** Modal should appear BEFORE the user can click Resume (on instruction screen), not after they've already entered testing mode. Currently the user must click Resume and start a competing session before the modal appears.
- **Suggested Fix:** This is resolved by implementing B14H-001 fix (adding modal to instruction view). No additional code change needed beyond B14H-001.

---

#### [FINDING-B14H-005]: Student login redirects to / (vocaBoost root) not /ap

- **Severity:** Medium-Priority (pre-existing — documented as B4-006)
- **Scenario:** B14-H (step 1 — Login)
- **Criteria Reference:** Known issue B4-006
- **What Happened:** After student11@apboost.test login, browser redirected to `http://localhost:5173/` (vocaBoost root) instead of `http://localhost:5173/ap`. Manual navigation to /ap was required.
- **Expected:** Student users should be redirected to /ap after login.
- **Suggested Fix:** See existing finding B4-006 for fix instructions. This is a pre-existing known issue.

---

### Nitpicks

- **Nit:** The "Review →" button in QuestionNavigator has text "Review →" but is right-aligned next to navigation buttons. On Q15 (the last question), the "Next →" button is replaced by "Review →" — this is correct UX but the test automation needs careful handling since `clickNext()` looking for "Next →" won't find it on Q15. No app bug here, just documentation.

- **Nit:** The BroadcastChannel fires with `null` as second argument in console logs: `[APBoost:useDuplicateTabGuard] Existing tab is active, blocking this tab null`. This appears to be the optional `{ context: ... }` parameter in `logDebug` being null. Could be cleaned up but not a functional issue.

---

## Console Errors

| Page/Route | Error Message | Severity |
|------------|---------------|----------|
| /ap/test/test_micro_full_1 | Failed to load resource: the server responded with a status of 500 (Internal Server Error) | warning — transient, appeared during v3 run when resuming a session with conflicting state |
| /ap/test/test_micro_full_1 | [vite] Failed to reload /src/apBoost/pages/APReportCard.jsx. This could be due to syntax errors or importing non-existent modules. | warning — transient, Vite HMR issue during test run, not reproducible independently |

Note: No JavaScript errors during the v1 and v2 runs. The v3 500 error is likely related to a Firestore write conflict from the concurrent session scenario tested in v2. No persistent errors after page reload.

---

## Key Technical Analysis

### BroadcastChannel Protocol (CONFIRMED WORKING)

The two-phase BroadcastChannel protocol in `useDuplicateTabGuard.js` functions correctly:

1. Tab 2 opens → sends `SESSION_QUERY` with its `instanceToken`
2. Tab 1 (which has `isActiveRef.current = true`) receives query → responds with `SESSION_ACTIVE`
3. Tab 2 receives `SESSION_ACTIVE` → `setIsInvalidated(true)` → clears the 1s claim timeout
4. Tab 2's `isInvalidated === true` — CORRECT state

The protocol works. The failure is purely in the rendering layer: `APTestSession.jsx` does not render `DuplicateTabModal` in `view === 'instruction'`.

### Session Sharing Risk

Both tabs operate on the SAME Firestore session document (`${userId}_${testId}_N`). The `createOrResumeSession` service correctly returns the existing session without resetting it. However, both tabs maintain separate in-memory answer states and separate IndexedDB queues. This creates a race condition when two tabs write answers concurrently to the same Firestore document.

### Fix Priority

1. **B14H-001** (High): Add DuplicateTabModal to instruction view — 5 line change
2. **B14H-002** (High): Ensure Tab 1 is invalidated — resolved by B14H-001 (modal forces explicit "Use This Tab" before Begin)
3. **B14H-003** (High): Flush queue before announcing SESSION_ACTIVE — prevents answer loss

---

## Detailed Root Cause Analysis

This section traces the exact sequence of events that causes each bug, for future agents and developers.

### The Setup

The student has an **existing in-progress session** for `test_micro_full_1`. When they navigate to `/ap/test/test_micro_full_1`, `useTestSession` runs `loadTestAndSession()` which calls `getActiveSession(testId, user.uid)`, finds the existing session, restores answers/flags/position from the Firestore document, and sets `session` state. This triggers `useDuplicateTabGuard(session.id)` to activate — it fires up a BroadcastChannel, broadcasts `SESSION_QUERY`, nobody responds within 1 second, so it claims the session (writes its `instanceToken` to Firestore). `isInvalidated` stays `false`.

The student is now on the **instruction screen** (`view === 'instruction'`), sees "Resume Test", clicks it, `handleBegin()` → `startTest()` → `view` becomes `'testing'`. They see Q1. Everything is fine.

### Tab 1: Student answers Q1-Q3

Each answer click calls `setAnswer()` (`useTestSession.js` line 435), which:
1. Updates the local `answers` Map immediately (optimistic)
2. Calls `addToQueue({ action: 'ANSWER_CHANGE', payload: { questionId, value } })`
3. The queue writes to IndexedDB instantly
4. `scheduleFlush(300)` is called — a **300ms debounced** flush to Firestore

**Critical detail:** The 300ms debounce **resets on every action**. If the student clicks Q1, Q2, Q3 in quick succession (within 1 second), the flush keeps rescheduling. The answers are in IndexedDB but **may not yet be in Firestore**. Even after the debounce fires, `flushQueue()` is an async Firestore write that takes time. There is always a window where IndexedDB has data that Firestore does not.

### Tab 2: Student opens the same URL

**Step 1 — `useTestSession` loads in Tab 2:**
`loadTestAndSession()` runs again. It calls `getActiveSession()` which reads from **Firestore**. If Tab 1's flush hasn't completed, Tab 2 gets a session document **missing some or all of Q1-Q3 answers**. These answers exist only in Tab 1's IndexedDB — a per-origin store that Tab 2 *can* technically access, but Tab 2's `useOfflineQueue` is scoped to its own writes and the queue reconciliation logic (`reconciledRef`) only replays items queued by the current tab's session, not cross-tab items.

**Step 2 — `useDuplicateTabGuard` activates in Tab 2:**
The hook creates a new BroadcastChannel on `ap_session_${sessionId}` and broadcasts `SESSION_QUERY`. Tab 1's guard hears this and responds with `SESSION_ACTIVE`. Tab 2 receives it and sets `isInvalidated = true`.

**B14H-001 — The guard is invisible on the instruction view:**
Tab 2 is in `view === 'instruction'` with `isInvalidated = true`. But `APTestSession.jsx` lines 300-313 render the instruction screen with **no `isInvalidated` check and no `DuplicateTabModal`**. The state is correctly set in the hook, but nothing in the UI reads it for this view. The student sees a normal "Resume Test" button.

**Step 3 — Student clicks "Resume Test" in Tab 2:**
`handleBegin()` calls `startTest()` → `createOrResumeSession()` which writes a **new `sessionToken`** (Tab 2's instance token) to Firestore. `view` becomes `'testing'`.

**B14H-002 — Tab 1 doesn't know Tab 2 claimed the session:**
`startTest()` does NOT broadcast `SESSION_CLAIMED` over BroadcastChannel. Tab 1's guard is listening for `SESSION_CLAIMED` — but nobody sent one. The only detection mechanism is `useHeartbeat`, which pings Firestore every 15 seconds and compares the stored `sessionToken` against its own `instanceToken`. After **3 consecutive mismatches** (worst case: 45 seconds), `sessionTakenOver` becomes `true`. During those 45 seconds, **both tabs are fully interactive and writing to the same session document**.

**Step 4 — Student answers Q4-Q6 in Tab 2:**
Tab 2's answers go through the same optimistic path. But Tab 2's `answers` Map was loaded from Firestore in Step 1, which was **missing Q1-Q3**. Tab 2's Map:

```
{ q4: 'B', q5: 'A', q6: 'C' }  // Q1-Q3 absent from local state
```

When Tab 2's queue flushes, it writes `answers.q4`, `answers.q5`, `answers.q6` using **dot-notation field paths** (`useOfflineQueue.js` lines 293-297). This is a Firestore merge, not an overwrite — so it doesn't delete Q1-Q3 **if they were already in Firestore**. But if Tab 1's flush raced with Tab 2's load, Firestore may have partial Q1-Q3 data.

**B14H-003 — No write barrier before handoff:**
When Tab 1's guard responds to `SESSION_QUERY` with `SESSION_ACTIVE` (line 100-103 of `useDuplicateTabGuard.js`), it does NOT trigger a queue flush. The `SESSION_ACTIVE` response is just a BroadcastChannel message. So the handoff looks like:

```
Tab 1 guard:  receives SESSION_QUERY → sends SESSION_ACTIVE (no flush triggered)
Tab 2 guard:  receives SESSION_ACTIVE → sets isInvalidated = true
              (but UI doesn't block — B14H-001)
Tab 2:        student clicks Resume → reads Firestore → gets stale data
Tab 1:        flush eventually runs → writes Q1-Q3 to Firestore
              (Tab 2 already loaded without them — they're missing from Tab 2's local state)
```

The answers aren't permanently lost in Firestore (dot-notation merge preserves them eventually), but they're **lost in Tab 2's local `answers` Map**. Tab 2 never knows about Q1-Q3. If the student navigates to Q1-Q3 in Tab 2, they appear unanswered. The review screen shows them as unanswered. If Tab 2 submits, `createTestResult` reads from Firestore (which by then may have Q1-Q3 from Tab 1's delayed flush), so the final scored result **might** be complete — but the student can't see or verify Q1-Q3 in Tab 2's UI.

### The Cascade

These three bugs compound:
- If only B14H-001 existed (modal not shown), but answers always flushed instantly → data safe, UX guard lost
- If only B14H-003 existed (no flush on handoff), but the modal blocked → student can't trigger the race
- **Together:** a student can unknowingly lose answers with zero warning

### Why testing/review views don't have this problem

Lines 412-417 and 454-459 correctly render `DuplicateTabModal` when `isInvalidated` is true. The modal is `fixed inset-0 z-50` — blocks all interaction. The student must click "Use This Tab" (calls `takeControl()` → broadcasts `SESSION_CLAIMED`) or "Go to Dashboard". No way to interact underneath.

The instruction view was never given this treatment — likely an oversight, since the developer added the modal to active testing views but didn't consider that `startTest()` is callable from the instruction screen.

### Architectural root cause

`APTestSession.jsx` uses an **early-return pattern** for views (`if (view === 'instruction') return ...`, `if (view === 'review') return ...`, etc.). Cross-cutting concerns like the duplicate tab guard must be manually duplicated in each branch. The `DuplicateTabModal` was added to `testing` and `review` branches but missed `instruction`, `frqChoice`, and `frqHandwritten` branches. This is the "shotgun surgery" anti-pattern — any new view added in the future will also need to remember to add the guard.

### Recommended fix approach

1. **Centralize the guard** — restructure `APTestSession.jsx` to render `DuplicateTabModal` once, outside the view switch (since it's a fixed z-50 overlay, it works over any view). Replace early returns with a content variable pattern. This makes the guard impossible to accidentally bypass and removes duplication from `testing`/`review` branches.

2. **Add write barrier** — in `useDuplicateTabGuard`, accept an `onSessionQuery` callback. When responding to `SESSION_QUERY`, call it (fire-and-forget `flushQueue()`). The human latency of clicking "Take Control" (seconds) gives ample time for the async flush to complete. Keeps hooks loosely coupled.

3. **Broadcast from `startTest()`** — as defense-in-depth, have `startTest()` broadcast `SESSION_CLAIMED` after `createOrResumeSession()` succeeds. This gives sub-millisecond invalidation of other tabs, rather than relying on 15-45s heartbeat detection. Expose a `broadcastClaim()` method from `useDuplicateTabGuard` for this purpose.

---

## Summary

| Metric | Count |
|--------|-------|
| Scenarios Tested | 1 (B14-H, 3 runs) |
| PASS | 0 (full scenario did not complete) |
| FAIL | PARTIAL |
| PARTIAL | 1 |
| SKIP | 0 |
| Blockers Found | 0 |
| High-Priority Found | 3 |
| Medium-Priority Found | 1 (plus 1 pre-existing) |
| Nitpicks | 2 |

### Critical Path for Fix

The entire B14-H scenario would PASS after implementing B14H-001 (5 line addition) and B14H-002 (ensured by correct modal flow). B14H-003 (answer flush before SESSION_ACTIVE) is essential for zero-data-loss guarantee but requires more careful async implementation.

The DuplicateTabModal component itself (DuplicateTabModal.jsx) is correctly implemented with proper design tokens, correct copy ("Session Active Elsewhere", "Use This Tab", "Go to Dashboard"), and works correctly when rendered in the testing view (confirmed by v2 run showing modal in Tab 2 testing view).

---

## Questions from Consolidated Fix Review (2026-03-11)

> These questions are from the lead developer reviewing all B14 findings. Please answer in a follow-up section below.

**Q1 (re: FIX-5 / B14H-003):** The proposed fix makes the `onmessage` handler async to flush the queue before responding with `SESSION_ACTIVE`. This delays the response. Tab 2's `useDuplicateTabGuard` has a 1-second claim timeout — if Tab 1's flush takes longer than 1s, Tab 2 will claim the session prematurely (thinking no active tab exists). What's the typical Firestore write duration for 3-5 ANSWER_CHANGE items? If it can exceed 1s (especially on slow connections), should we increase Tab 2's claim timeout to 3s? Or should Tab 1 respond with `SESSION_ACTIVE` immediately and flush in the background (accepting a small race window)?

**Q2 (re: B14H-002):** After B14H-001 is fixed (modal on instruction screen), is the defensive `takeControl()` call in `handleBegin` still necessary? The flow would be: Tab 2 sees modal → must click "Use This Tab" (which calls `takeControl`) → then can click "Begin". If the modal properly blocks all other interactions, `handleBegin` should never be reachable while `isInvalidated` is true. Is the defensive check worth the added complexity, or is it a belt-and-suspenders measure?

---

## Responses to Consolidated Fix Review Questions

### A1 (re: Q1 — flush timing vs. 1s claim timeout)

**Respond immediately, flush in background. Do NOT make the handler async or delay `SESSION_ACTIVE`.**

The original findings writeup was imprecise here — the proposed async handler that awaits `flushQueue()` before sending `SESSION_ACTIVE` is the wrong approach. Here's why:

1. **Firestore write latency is unpredictable.** A batched `updateDoc` for 3-5 answer fields typically takes 100-400ms on a good connection, but on school WiFi or mobile data it can easily exceed 1s. We cannot guarantee it fits within Tab 2's claim timeout.

2. **Increasing the claim timeout creates a worse problem.** Bumping to 3s means that on a genuine fresh-tab-only scenario (no other tab active), the student stares at nothing for 3 seconds before the session claims. That's a noticeable UX regression for the common case to protect against the rare case.

3. **The race window is a non-issue.** The flush runs in the background after `SESSION_ACTIVE` is sent. Tab 2 receives `SESSION_ACTIVE`, sets `isInvalidated = true`, and renders `DuplicateTabModal`. The student must then **physically click "Use This Tab"** — minimum ~500ms of human reaction time, typically 1-3 seconds. The background flush will complete long before the human acts. Even if the flush takes a full 2 seconds, the human click hasn't happened yet.

**Correct implementation pattern:**

```js
if (type === 'SESSION_QUERY' && token !== instanceToken && isActiveRef.current) {
  // Respond IMMEDIATELY — don't let Tab 2's 1s timeout expire
  channelRef.current.postMessage({ type: 'SESSION_ACTIVE', token: instanceToken })

  // Flush queue in background — fire-and-forget
  // Human latency on Tab 2 (clicking "Use This Tab") gives us seconds of margin
  onSessionQueryRef.current?.()
}
```

No need to `await`, no need to increase the timeout. The 1s claim timeout is fine as-is.

**Edge case — what if the student on Tab 2 clicks "Use This Tab" before the flush completes?** This is only possible if (a) the student has superhuman reaction time AND (b) the Firestore write is slow. Even then, `takeControl()` in Tab 2 triggers `claimSession()` which writes Tab 2's token to Firestore — it does NOT read or overwrite answers. Tab 1's flush will still land in Firestore (it's already in-flight). The dot-notation merge (`answers.q1`, `answers.q2`, etc.) is additive, not destructive. So even in this narrow race, answers are preserved.

### A2 (re: Q2 — defensive `takeControl()` in `handleBegin`)

**Keep a defensive check, but make it a no-op guard, not a `takeControl()` call.**

You're right that with the centralized guard (B14H-001 fix), `handleBegin` should be unreachable while `isInvalidated` is true — the `DuplicateTabModal` is a `fixed inset-0 z-50` overlay that blocks pointer events. However:

1. **The modal is a CSS overlay, not a DOM barrier.** Keyboard navigation or screen readers could theoretically reach the "Resume Test" button underneath. A `tabindex` or `aria-modal` issue could expose it.

2. **React render timing.** If `isInvalidated` flips to `true` between renders, there's a single frame where the button could be clickable before the modal mounts.

3. **Future code changes.** A developer might add a keyboard shortcut or programmatic call that bypasses the visual overlay.

But calling `takeControl()` in `handleBegin` is the **wrong** defensive measure. `takeControl()` has side effects — it broadcasts `SESSION_CLAIMED`, writes a new token to Firestore, and clears `isInvalidated`. If `handleBegin` is reached while invalidated due to a bug, silently claiming and proceeding would mask the bug and create the exact concurrent-session situation we're trying to prevent.

**The correct defensive pattern is an early return:**

```jsx
const handleBegin = async () => {
  if (isInvalidated) return  // Guard: modal should be blocking, but just in case
  await startTest()
  setView('testing')
}
```

One line, no side effects, no added complexity. If somehow reached while invalidated, it simply refuses to start. The modal will re-render on the next cycle and the student can use the proper "Use This Tab" → "Begin" flow.

This is the standard "belt without suspenders" — cheap, zero risk, and catches the impossible case without introducing new behavior.
