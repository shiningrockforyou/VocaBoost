# Acceptance Criteria Audit: Sections 5.1 to 5.5

**Audited by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE

## Summary
- Total Criteria: 48
- Implemented: 28
- Partial: 12
- Missing: 7
- Unable to Verify: 1

---

## Section 5.1: Core Sync Strategy

### Criterion: Firestore-first architecture (server is source of truth)
- **Status:** Implemented
- **Evidence:** [apSessionService.js:1-268](src/apBoost/services/apSessionService.js) - All session operations use Firestore as primary store. Local state is synced from Firestore on load.
- **Notes:** Session data is fetched from Firestore on mount, and all updates go through Firestore ultimately.

### Criterion: Local storage (IndexedDB) is write-ahead queue only
- **Status:** Implemented
- **Evidence:** [useOfflineQueue.js:8-11](src/apBoost/hooks/useOfflineQueue.js#L8-L11) - IndexedDB `ap_boost_queue` used solely as action queue, not for state storage.
- **Notes:** Queue stores actions temporarily; actual state lives in Firestore.

### Criterion: Answer change: debounced write (2-3s batch)
- **Status:** Partial
- **Evidence:** [useOfflineQueue.js:155](src/apBoost/hooks/useOfflineQueue.js#L155) - `scheduleFlush(1000)` uses 1 second debounce.
- **Notes:** Debounce is 1 second, not the specified 2-3 seconds. Works but doesn't match spec.

### Criterion: Flag toggle: debounced write (2-3s batch)
- **Status:** Partial
- **Evidence:** [useTestSession.js:378-383](src/apBoost/hooks/useTestSession.js#L378-L383) - Flags go through `addToQueue`, which uses 1s debounce.
- **Notes:** Same 1 second debounce as answers. Spec requires 2-3s.

### Criterion: Annotation: debounced write (2-3s batch)
- **Status:** Partial
- **Evidence:** Uses same queue mechanism with 1s debounce.
- **Notes:** Spec requires 2-3 second debounce; implementation uses 1s.

### Criterion: Strikethrough: debounced write (2-3s batch)
- **Status:** Partial
- **Evidence:** Uses same queue mechanism with 1s debounce.
- **Notes:** Spec requires 2-3 second debounce; implementation uses 1s.

### Criterion: Question navigation: immediate write
- **Status:** Missing
- **Evidence:** [useTestSession.js:249-259](src/apBoost/hooks/useTestSession.js#L249-L259) - Navigation goes through `addToQueue` with debounce.
- **Notes:** Criteria specifies navigation should be IMMEDIATE write, but implementation routes through debounced queue.

### Criterion: Section complete: immediate write
- **Status:** Unable to Verify
- **Evidence:** [useTestSession.js:385-393](src/apBoost/hooks/useTestSession.js#L385-L393) - `submitSection` only updates local state.
- **Notes:** Section completion doesn't appear to trigger immediate Firestore write. May be incomplete implementation.

### Criterion: Timer tick: local only, Firestore update every 30s
- **Status:** Implemented
- **Evidence:** [useTestSession.js:142-150](src/apBoost/hooks/useTestSession.js#L142-L150) - Timer sync queued when `newTime % 30 === 0`.
- **Notes:** Timer ticks locally every second; syncs to Firestore every 30 seconds via queue.

### Criterion: beforeunload: set status -> PAUSED immediately
- **Status:** Missing
- **Evidence:** [useTestSession.js:208-220](src/apBoost/hooks/useTestSession.js#L208-L220) - beforeunload only shows warning dialog.
- **Notes:** Critical gap - session status is NOT set to PAUSED when browser closes. Only shows "unsaved changes" warning if queue has items.

### Criterion: Test submission: immediate write
- **Status:** Implemented
- **Evidence:** [useTestSession.js:396-421](src/apBoost/hooks/useTestSession.js#L396-L421) - `submitTest` flushes queue then creates result.
- **Notes:** Submit flushes pending queue first, then creates test result synchronously.

---

## Section 5.2: Write-Ahead Queue (IndexedDB)

### Criterion: Queue schema: id, sessionId, localTimestamp, action, payload, status
- **Status:** Implemented
- **Evidence:** [useOfflineQueue.js:131-138](src/apBoost/hooks/useOfflineQueue.js#L131-L138) - Queue item has all specified fields.
- **Notes:** Schema matches spec exactly.

### Criterion: Action types: ANSWER_CHANGE, FLAG_TOGGLE, ANNOTATION_ADD, ANNOTATION_REMOVE, STRIKETHROUGH_TOGGLE, NAVIGATION, SECTION_COMPLETE, TIMER_SYNC, SESSION_PAUSE, SESSION_SUBMIT
- **Status:** Partial
- **Evidence:** [useOfflineQueue.js:204-224](src/apBoost/hooks/useOfflineQueue.js#L204-L224) - Switch handles ANSWER_CHANGE, FLAG_TOGGLE, NAVIGATION, TIMER_SYNC.
- **Notes:** Missing handlers for: ANNOTATION_ADD, ANNOTATION_REMOVE, STRIKETHROUGH_TOGGLE, SECTION_COMPLETE, SESSION_PAUSE, SESSION_SUBMIT.

### Criterion: Status flow: PENDING -> CONFIRMED -> deleted
- **Status:** Partial
- **Evidence:** [useOfflineQueue.js:238-249](src/apBoost/hooks/useOfflineQueue.js#L238-L249) - Items go from PENDING directly to deleted.
- **Notes:** No CONFIRMED intermediate status. Items are deleted immediately after successful Firestore write.

### Criterion: All writes go through local queue before Firestore
- **Status:** Implemented
- **Evidence:** [useTestSession.js:350-358](src/apBoost/hooks/useTestSession.js#L350-L358) - `setAnswer` calls `addToQueue`.
- **Notes:** All answer changes, navigation, flags go through queue first.

### Criterion: IndexedDB database name: ap_action_queue
- **Status:** Partial
- **Evidence:** [useOfflineQueue.js:9](src/apBoost/hooks/useOfflineQueue.js#L9) - `DB_NAME = 'ap_boost_queue'`
- **Notes:** Actual name is `ap_boost_queue`, not `ap_action_queue` as specified.

### Criterion: Queue persists after browser crash
- **Status:** Implemented
- **Evidence:** Uses IndexedDB which persists across browser sessions/crashes.
- **Notes:** IndexedDB inherently provides crash persistence.

### Criterion: Queue handles concurrent writes safely
- **Status:** Implemented
- **Evidence:** [useOfflineQueue.js:141-148](src/apBoost/hooks/useOfflineQueue.js#L141-L148) - Uses IndexedDB transactions.
- **Notes:** Transactions ensure atomic writes.

### Criterion: Queue flushes automatically on reconnect
- **Status:** Implemented
- **Evidence:** [useOfflineQueue.js:86-91](src/apBoost/hooks/useOfflineQueue.js#L86-L91) - `handleOnline` triggers `scheduleFlush(1000)`.
- **Notes:** Flush scheduled 1 second after coming online.

---

## Section 5.2.1: useOfflineQueue Hook

### Criterion: Returns: addToQueue, flushQueue, queueLength, isOnline, isFlushing
- **Status:** Implemented
- **Evidence:** [useOfflineQueue.js:277-283](src/apBoost/hooks/useOfflineQueue.js#L277-L283) - All 5 values returned.
- **Notes:** Return values match spec exactly.

### Criterion: addToQueue(action) adds entry with PENDING status
- **Status:** Implemented
- **Evidence:** [useOfflineQueue.js:137](src/apBoost/hooks/useOfflineQueue.js#L137) - `status: 'PENDING'`
- **Notes:** New items always start as PENDING.

### Criterion: flushQueue() attempts to sync all pending items
- **Status:** Implemented
- **Evidence:** [useOfflineQueue.js:173-266](src/apBoost/hooks/useOfflineQueue.js#L173-L266) - Full flush implementation.
- **Notes:** Filters for PENDING items, batches updates, writes to Firestore.

### Criterion: queueLength tracks number of pending items
- **Status:** Implemented
- **Evidence:** [useOfflineQueue.js:107-122](src/apBoost/hooks/useOfflineQueue.js#L107-L122) - `updateQueueLength` counts by sessionId.
- **Notes:** Count updated after each add/flush operation.

### Criterion: isOnline tracks navigator.onLine status
- **Status:** Implemented
- **Evidence:** [useOfflineQueue.js:53](src/apBoost/hooks/useOfflineQueue.js#L53) - `useState(navigator.onLine)` plus event listeners.
- **Notes:** Tracks online/offline events correctly.

### Criterion: isFlushing indicates sync in progress
- **Status:** Implemented
- **Evidence:** [useOfflineQueue.js:54](src/apBoost/hooks/useOfflineQueue.js#L54), [L178](src/apBoost/hooks/useOfflineQueue.js#L178), [L264](src/apBoost/hooks/useOfflineQueue.js#L264)
- **Notes:** Set true at flush start, false at end.

---

## Section 5.3: Write Flow

### Criterion: Step 1: Update React state (optimistic update - instant UI)
- **Status:** Implemented
- **Evidence:** [useTestSession.js:332-348](src/apBoost/hooks/useTestSession.js#L332-L348) - `setAnswers` updates immediately.
- **Notes:** Local state updated before queue write.

### Criterion: Step 2: Write to IndexedDB queue with PENDING status
- **Status:** Implemented
- **Evidence:** [useTestSession.js:350-358](src/apBoost/hooks/useTestSession.js#L350-L358) - `addToQueue` called after state update.
- **Notes:** Queue write happens after optimistic update.

### Criterion: Step 3: Debounce timer (2-3s) batches multiple actions
- **Status:** Partial
- **Evidence:** [useOfflineQueue.js:155](src/apBoost/hooks/useOfflineQueue.js#L155) - Uses 1000ms (1s) debounce.
- **Notes:** Debounce is 1 second, not 2-3 seconds as specified.

### Criterion: Step 4: Write batch to Firestore
- **Status:** Implemented
- **Evidence:** [useOfflineQueue.js:201-236](src/apBoost/hooks/useOfflineQueue.js#L201-L236) - Batches updates into single Firestore write.
- **Notes:** Multiple queue items combined into single `updateDoc` call.

### Criterion: On success: Delete from queue
- **Status:** Implemented
- **Evidence:** [useOfflineQueue.js:238-249](src/apBoost/hooks/useOfflineQueue.js#L238-L249) - Items deleted after successful write.
- **Notes:** Uses transaction to delete flushed items.

### Criterion: On failure: Keep in queue, retry later
- **Status:** Implemented
- **Evidence:** [useOfflineQueue.js:254-261](src/apBoost/hooks/useOfflineQueue.js#L254-L261) - Items remain, retry scheduled.
- **Notes:** Queue items preserved on error; retry with backoff.

---

## Section 5.4: Retry Strategy

### Criterion: Exponential backoff: 2s -> 4s -> 8s -> opportunistic mode
- **Status:** Partial
- **Evidence:** [useOfflineQueue.js:257-261](src/apBoost/hooks/useOfflineQueue.js#L257-L261) - `Math.pow(2, retryCountRef.current) * 1000`
- **Notes:** Backoff is 2s, 4s, 8s, 16s, then stops at 5 attempts. Does NOT switch to opportunistic mode - just stops retrying.

### Criterion: After backoff exhausted, retry on: Any user action
- **Status:** Missing
- **Evidence:** No code found that triggers queue flush on user actions after backoff exhausted.
- **Notes:** Opportunistic retry on user action not implemented.

### Criterion: After backoff exhausted, retry on: Network restored (online event)
- **Status:** Implemented
- **Evidence:** [useOfflineQueue.js:86-91](src/apBoost/hooks/useOfflineQueue.js#L86-L91) - `handleOnline` resets counter and flushes.
- **Notes:** `retryCountRef.current = 0` resets backoff on reconnect.

### Criterion: After backoff exhausted, retry on: Tab gains focus (visibilitychange)
- **Status:** Missing
- **Evidence:** No visibilitychange listener in useOfflineQueue for queue flushing.
- **Notes:** useHeartbeat has visibilitychange, but it doesn't flush the queue.

### Criterion: After backoff exhausted, retry on: Heartbeat succeeds
- **Status:** Missing
- **Evidence:** [useHeartbeat.js:63-67](src/apBoost/hooks/useHeartbeat.js#L63-L67) - Success only clears counter, doesn't flush queue.
- **Notes:** Heartbeat success does not trigger queue flush.

---

## Section 5.5: Heartbeat System

### Criterion: Interval: 15 seconds
- **Status:** Implemented
- **Evidence:** [useHeartbeat.js:9](src/apBoost/hooks/useHeartbeat.js#L9) - `HEARTBEAT_INTERVAL = 15000`
- **Notes:** Matches spec exactly.

### Criterion: Updates lastHeartbeat timestamp in Firestore
- **Status:** Implemented
- **Evidence:** [useHeartbeat.js:54-61](src/apBoost/hooks/useHeartbeat.js#L54-L61) - `lastHeartbeat: serverTimestamp()`
- **Notes:** Uses server timestamp for accuracy.

### Criterion: Verifies sessionToken matches (detects tab takeover)
- **Status:** Implemented
- **Evidence:** [useHeartbeat.js:47-51](src/apBoost/hooks/useHeartbeat.js#L47-L51) - Compares tokens, sets `sessionTakenOver`.
- **Notes:** Clean implementation of token verification.

### Criterion: On success: clear failure counter, attempt queue flush
- **Status:** Partial
- **Evidence:** [useHeartbeat.js:63-67](src/apBoost/hooks/useHeartbeat.js#L63-L67) - Clears counter but no queue flush.
- **Notes:** Failure counter cleared, but queue flush NOT attempted as spec requires.

### Criterion: On failure: increment failure counter, retry up to 2 times
- **Status:** Partial
- **Evidence:** [useHeartbeat.js:68-77](src/apBoost/hooks/useHeartbeat.js#L68-L77) - Increments counter, no special 2-retry logic.
- **Notes:** Counter increments continuously; no distinction between first 2 retries and subsequent failures.

### Criterion: After 3 consecutive failures: show "Connection unstable" banner
- **Status:** Implemented
- **Evidence:** [useHeartbeat.js:10](src/apBoost/hooks/useHeartbeat.js#L10), [L72-74](src/apBoost/hooks/useHeartbeat.js#L72-L74) - `MAX_FAILURES = 3`, sets `isConnected = false`.
- **Notes:** Consumer components can show banner when `isConnected` is false.

### Criterion: On recovery: flush queued writes, hide banner
- **Status:** Partial
- **Evidence:** [useHeartbeat.js:63-67](src/apBoost/hooks/useHeartbeat.js#L63-L67) - Sets `isConnected = true` (hides banner).
- **Notes:** Banner hides on recovery, but queued writes are NOT flushed.

---

## Section 5.5.1: useHeartbeat Hook

### Criterion: Accepts: sessionId, instanceToken
- **Status:** Implemented
- **Evidence:** [useHeartbeat.js:18](src/apBoost/hooks/useHeartbeat.js#L18) - `function useHeartbeat(sessionId, instanceToken)`
- **Notes:** Matches spec exactly.

### Criterion: Returns: isConnected, failureCount, lastHeartbeat
- **Status:** Implemented
- **Evidence:** [useHeartbeat.js:122-128](src/apBoost/hooks/useHeartbeat.js#L122-L128) - Returns all three plus extras.
- **Notes:** Also returns `sessionTakenOver` and `reconnect` - additional functionality beyond spec.

### Criterion: isConnected false after 3 consecutive failures
- **Status:** Implemented
- **Evidence:** [useHeartbeat.js:72-74](src/apBoost/hooks/useHeartbeat.js#L72-L74) - `if (newCount >= MAX_FAILURES) setIsConnected(false)`
- **Notes:** Correctly implemented.

### Criterion: failureCount tracks consecutive failures
- **Status:** Implemented
- **Evidence:** [useHeartbeat.js:70](src/apBoost/hooks/useHeartbeat.js#L70) - `setFailureCount(prev => prev + 1)`
- **Notes:** Counter increments on each failure, resets on success.

### Criterion: lastHeartbeat is Date of last successful heartbeat
- **Status:** Implemented
- **Evidence:** [useHeartbeat.js:66](src/apBoost/hooks/useHeartbeat.js#L66) - `setLastHeartbeat(new Date())`
- **Notes:** Stores JavaScript Date object.

### Criterion: Automatically attempts queue flush on success
- **Status:** Missing
- **Evidence:** [useHeartbeat.js:63-67](src/apBoost/hooks/useHeartbeat.js#L63-L67) - No queue interaction.
- **Notes:** Hook does not have access to or call any queue flush mechanism.

---

## Recommendations

### High Priority (Missing Criteria)

1. **beforeunload PAUSED status** - Critical for session recovery. The beforeunload handler in useTestSession.js should set session status to PAUSED via a synchronous Firestore write or sendBeacon API. Current implementation only shows a warning dialog.

2. **Immediate navigation writes** - Navigation position changes should bypass the debounce queue and write immediately to Firestore. This ensures accurate resume position if user closes browser.

3. **Heartbeat-triggered queue flush** - When heartbeat succeeds after failures, the queue should be flushed. Add queue flush call to useHeartbeat success handler.

4. **Opportunistic retry mode** - After exponential backoff exhausted, implement retry on user action and visibilitychange. Consider adding a flag to track "opportunistic mode" state.

### Medium Priority (Partial Implementations)

5. **Debounce timing** - Change queue debounce from 1 second to 2-3 seconds as specified. This reduces Firestore writes and costs while still providing reasonable sync speed.

6. **Missing action type handlers** - Add switch cases for ANNOTATION_ADD, ANNOTATION_REMOVE, STRIKETHROUGH_TOGGLE, SECTION_COMPLETE, SESSION_PAUSE, SESSION_SUBMIT in flushQueue.

7. **CONFIRMED intermediate status** - Consider adding CONFIRMED status between PENDING and deletion for better debugging/recovery. Low urgency as current flow works.

8. **Database naming** - Minor: Rename `ap_boost_queue` to `ap_action_queue` for consistency with spec (or update spec to match implementation).

### Patterns Observed

- **Strong offline support foundation** - The IndexedDB queue architecture is solid and handles most offline scenarios well.
- **Missing integration points** - Heartbeat and queue are not connected; they should work together for recovery.
- **PAUSED status underutilized** - The PAUSED status exists in apTypes.js but is never set; session always remains IN_PROGRESS.

### Summary Table

| Section | Implemented | Partial | Missing | Unable to Verify |
|---------|-------------|---------|---------|------------------|
| 5.1     | 4           | 4       | 2       | 1                |
| 5.2     | 5           | 3       | 0       | 0                |
| 5.2.1   | 6           | 0       | 0       | 0                |
| 5.3     | 5           | 1       | 0       | 0                |
| 5.4     | 1           | 1       | 3       | 0                |
| 5.5     | 4           | 3       | 0       | 0                |
| 5.5.1   | 5           | 0       | 1       | 0                |
| **Total** | **28**    | **12**  | **7**   | **1**            |

---

*Audit completed 2026-01-14 by Claude Agent*
