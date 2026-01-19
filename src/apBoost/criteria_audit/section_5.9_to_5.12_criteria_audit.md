# Acceptance Criteria Audit: Sections 5.9 to 5.12

**Audited by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE

## Summary
- Total Criteria: 22
- ✅ Implemented: 8
- ⚠️ Partial: 9
- ❌ Missing: 5
- ❓ Unable to Verify: 0

---

## Section 5.9: Session Resume Flow

### Criterion: Load session from Firestore
- **Status:** ✅ Implemented
- **Evidence:** [useTestSession.js:176](src/apBoost/hooks/useTestSession.js#L176) - `const existingSession = await getActiveSession(testId, user.uid)`
- **Notes:** Session is loaded via `getActiveSession()` which queries for IN_PROGRESS status sessions

### Criterion: Check IndexedDB for pending queue items
- **Status:** ❌ Missing
- **Evidence:** No code found in `useTestSession.js` or `useOfflineQueue.js` that checks for pending queue items on session resume
- **Notes:** The `useOfflineQueue` hook initializes the database but doesn't reconcile pending items with Firestore on resume. The `updateQueueLength()` function only counts items, doesn't compare timestamps.

### Criterion: For each item: compare localTimestamp vs session.lastModified
- **Status:** ❌ Missing
- **Evidence:** [useOfflineQueue.js:134](src/apBoost/hooks/useOfflineQueue.js#L134) - `localTimestamp` is stored but never compared
- **Notes:** The queue stores `localTimestamp: Date.now()` for each item, but no comparison logic exists against `session.lastAction` or `lastModified`

### Criterion: If item newer: apply to Firestore, delete from queue
- **Status:** ❌ Missing
- **Evidence:** No timestamp comparison or conditional application logic found
- **Notes:** The `flushQueue()` function applies ALL pending items without timestamp comparison

### Criterion: If item older: discard (stale)
- **Status:** ❌ Missing
- **Evidence:** No stale item detection or discard logic found
- **Notes:** Related to above - no comparison means stale items could overwrite newer Firestore data

### Criterion: Use Firestore state (now authoritative)
- **Status:** ⚠️ Partial
- **Evidence:** [useTestSession.js:177-195](src/apBoost/hooks/useTestSession.js#L177-L195) - State restored from `existingSession`
- **Notes:** Firestore state is loaded and used, but the queue items are not reconciled, so Firestore is not truly authoritative if stale queue items exist

### Criterion: Show "Resume" modal if status was PAUSED
- **Status:** ⚠️ Partial
- **Evidence:** [InstructionScreen.jsx:19](src/apBoost/components/InstructionScreen.jsx#L19) - `const isResuming = existingSession?.status === SESSION_STATUS.IN_PROGRESS`
- **Notes:** InstructionScreen shows "Resume Test" button and position info when session is IN_PROGRESS, but the system never sets status to PAUSED. Per other audits, `beforeunload` doesn't update status. The resume UI exists but relies on IN_PROGRESS, not PAUSED.

---

## Section 5.10: Conflict Resolution

### Criterion: Firestore serverTimestamp() is authoritative
- **Status:** ✅ Implemented
- **Evidence:** Multiple files use `serverTimestamp()`:
  - [apSessionService.js:63-65](src/apBoost/services/apSessionService.js#L63-L65) - Session creation
  - [apSessionService.js:116,135,170,190,209,227](src/apBoost/services/apSessionService.js#L116) - All update operations
  - [useOfflineQueue.js:228](src/apBoost/hooks/useOfflineQueue.js#L228) - Queue flush writes
- **Notes:** Firestore `serverTimestamp()` is consistently used for all writes, establishing server time as authoritative

### Criterion: Local timestamps for queue ordering only
- **Status:** ⚠️ Partial
- **Evidence:** [useOfflineQueue.js:134](src/apBoost/hooks/useOfflineQueue.js#L134) - `localTimestamp: Date.now()`
- **Notes:** Local timestamps are stored in queue items but are never actually used for ordering or conflict resolution. They exist but serve no functional purpose currently.

### Criterion: Local newer than Firestore -> Apply local
- **Status:** ❌ Missing
- **Evidence:** No comparison logic found in `useOfflineQueue.js` or `useTestSession.js`
- **Notes:** Queue flush applies ALL items without checking if they are newer than Firestore state

### Criterion: Firestore newer than local -> Discard local
- **Status:** ⚠️ Partial
- **Evidence:** N/A
- **Notes:** On session load, Firestore state is used (effectively discarding local React state), but IndexedDB queue items are never compared or discarded based on timestamps

### Criterion: Same timestamp -> Last-write-wins (Firestore handles)
- **Status:** ✅ Implemented
- **Evidence:** Firestore's inherent behavior
- **Notes:** Firestore naturally handles concurrent writes via last-write-wins semantics. The `sessionToken` mechanism ([useHeartbeat.js:47](src/apBoost/hooks/useHeartbeat.js#L47)) also helps detect conflicts.

---

## Section 5.11: Data Loss Protection

### Must Protect Against:

### Criterion: Network blip (few seconds) -> Queue + auto-retry
- **Status:** ✅ Implemented
- **Evidence:** [useOfflineQueue.js:257-261](src/apBoost/hooks/useOfflineQueue.js#L257-L261) - Exponential backoff: `Math.pow(2, retryCountRef.current) * 1000`
- **Notes:** Implements 2s, 4s, 8s, 16s backoff up to 5 retries. Queue persists in IndexedDB during network issues.

### Criterion: Page refresh -> beforeunload warning + resume
- **Status:** ⚠️ Partial
- **Evidence:** [useTestSession.js:208-220](src/apBoost/hooks/useTestSession.js#L208-L220) - `beforeunload` handler
- **Notes:** Shows browser warning dialog if `queueLength > 0`. Resume works via `getActiveSession()`. However, warning only appears when queue has pending items, not always during active test.

### Criterion: Accidental tab close -> beforeunload warning + resume
- **Status:** ⚠️ Partial
- **Evidence:** Same as above - [useTestSession.js:208-220](src/apBoost/hooks/useTestSession.js#L208-L220)
- **Notes:** Same behavior as page refresh. Warning appears conditionally (only if queue not empty).

### Criterion: Browser crash -> IndexedDB persists + resume
- **Status:** ⚠️ Partial
- **Evidence:**
  - [useOfflineQueue.js:16-36](src/apBoost/hooks/useOfflineQueue.js#L16-L36) - IndexedDB setup
  - [useTestSession.js:176](src/apBoost/hooks/useTestSession.js#L176) - Session resume
- **Notes:** IndexedDB persists through crashes. However, on resume, pending queue items are NOT reconciled with Firestore state (see 5.9 findings). Items remain in queue and may be flushed later, potentially causing conflicts.

### Criterion: App/JS error -> Error boundary + state preserved
- **Status:** ✅ Implemented
- **Evidence:**
  - [APErrorBoundary.jsx:1-58](src/apBoost/components/APErrorBoundary.jsx#L1-L58) - Full implementation
  - [ErrorFallback.jsx:1-64](src/apBoost/components/ErrorFallback.jsx#L1-L64) - UI with recovery options
  - [APTestSession.jsx:502-507](src/apBoost/pages/APTestSession.jsx#L502-L507) - Wraps test session
- **Notes:** Complete implementation with "Your answers are saved locally" message, "Try Again" button, and "Return to Dashboard" link

### Criterion: Server temporarily down -> Queue locally + sync when back
- **Status:** ✅ Implemented
- **Evidence:**
  - [useOfflineQueue.js:86-104](src/apBoost/hooks/useOfflineQueue.js#L86-L104) - Online/offline event listeners
  - [useOfflineQueue.js:89-91](src/apBoost/hooks/useOfflineQueue.js#L89-L91) - `handleOnline` triggers `scheduleFlush(1000)`
- **Notes:** Queue automatically flushes when coming back online via `window.addEventListener('online', handleOnline)`

### Criterion: Slow connection -> Loading states + generous timeouts
- **Status:** ✅ Implemented
- **Evidence:**
  - [withTimeout.js](src/apBoost/utils/withTimeout.js) - Timeout wrapper utility
  - [useHeartbeat.js:32-36, 54-60](src/apBoost/hooks/useHeartbeat.js#L32-L36) - Uses `withTimeout`
  - [useOfflineQueue.js:231-235](src/apBoost/hooks/useOfflineQueue.js#L231-L235) - Queue flush with timeout
- **Notes:** `withTimeout` utility wraps async operations. Loading states shown in `SessionSkeleton` component.

### Acceptable Loss (With Warning):

### Criterion: User ignores "don't close" warning -> Data lost
- **Status:** ✅ Implemented (by design)
- **Evidence:** [useTestSession.js:212-213](src/apBoost/hooks/useTestSession.js#L212-L213) - `e.returnValue = 'You have unsaved changes...'`
- **Notes:** Browser warning is shown; if user proceeds, data loss is expected and acceptable per spec

### Criterion: User clears browser data -> Data lost
- **Status:** ✅ Implemented (by design)
- **Evidence:** N/A - Inherent browser behavior
- **Notes:** IndexedDB is cleared with browser data; this is acceptable per spec

### Criterion: User in incognito + closes -> Data lost
- **Status:** ✅ Implemented (by design)
- **Evidence:** N/A - Inherent browser behavior
- **Notes:** Incognito sessions don't persist IndexedDB; acceptable per spec

### Criterion: User offline entire test, never reconnects -> Data lost
- **Status:** ⚠️ Partial
- **Evidence:** N/A
- **Notes:** Data stays in local IndexedDB but will never sync. If user closes browser while offline, data is lost. This is acceptable per spec but no explicit warning is shown for extended offline periods.

### Criterion: User's device dies -> Physical loss
- **Status:** ✅ Implemented (by design)
- **Evidence:** N/A - Physical limitation
- **Notes:** Acceptable per spec

---

## Section 5.12: Edge Cases

### Criterion: Browser crash mid-IndexedDB write -> Atomic transaction rollback
- **Status:** ⚠️ Partial
- **Evidence:** [useOfflineQueue.js:141-148](src/apBoost/hooks/useOfflineQueue.js#L141-L148) - Transaction usage
```javascript
const tx = dbRef.current.transaction(STORE_NAME, 'readwrite')
const store = tx.objectStore(STORE_NAME)
store.add(queueItem)
await new Promise((resolve, reject) => {
  tx.oncomplete = resolve
  tx.onerror = () => reject(tx.error)
})
```
- **Notes:** IndexedDB transactions are used but there's no explicit error handling for partial writes or rollback scenarios. IndexedDB's native atomicity should handle crashes, but no verification or recovery logic exists.

### Criterion: Device storage full -> Catch QuotaExceededError, try flush, show warning
- **Status:** ❌ Missing
- **Evidence:** No `QuotaExceededError` handling found in codebase (grep returned no results)
- **Notes:** Critical gap - storage full errors will cause uncaught exceptions. Should wrap IndexedDB writes with try/catch for quota errors.

### Criterion: Timer expires offline -> Queue auto-submit, complete on reconnect
- **Status:** ⚠️ Partial
- **Evidence:** [useTestSession.js:136-140](src/apBoost/hooks/useTestSession.js#L136-L140) - Timer expire handler
```javascript
const handleTimerExpire = useCallback(() => {
  console.log('Timer expired, auto-submitting...')
  // Could trigger auto-submit here
}, [])
```
- **Notes:** Handler exists but only logs to console. No actual auto-submit is triggered. No queue action for offline timer expiry. The comment "Could trigger auto-submit here" indicates incomplete implementation.

### Criterion: Two tabs race to write -> Last-write-wins via sessionToken
- **Status:** ✅ Implemented
- **Evidence:**
  - [useDuplicateTabGuard.js:66-112](src/apBoost/hooks/useDuplicateTabGuard.js#L66-L112) - BroadcastChannel + Firestore token
  - [useHeartbeat.js:47-50](src/apBoost/hooks/useHeartbeat.js#L47-L50) - Token comparison on heartbeat
- **Notes:** Dual-mechanism: BroadcastChannel for instant same-browser detection, Firestore token check on heartbeat for cross-browser. Later tab always wins.

### Criterion: Firestore quota exceeded -> Exponential backoff, notify user
- **Status:** ⚠️ Partial
- **Evidence:**
  - [useOfflineQueue.js:257-262](src/apBoost/hooks/useOfflineQueue.js#L257-L262) - Exponential backoff
  - [ConnectionStatus.jsx:41-48](src/apBoost/components/ConnectionStatus.jsx#L41-L48) - Connection unstable banner
- **Notes:** Exponential backoff is implemented. Connection status banner appears after 3 heartbeat failures. However, quota-specific errors are not distinguished or communicated to user - all errors treated the same.

### Criterion: User's clock wildly wrong -> Use serverTimestamp for Firestore
- **Status:** ✅ Implemented
- **Evidence:** All Firestore writes use `serverTimestamp()` - see evidence in 5.10 section
- **Notes:** Client clock is never used for Firestore timestamps, only for local queue ordering (which is currently unused anyway).

---

## Recommendations

### Critical Gaps to Address:

1. **Queue Reconciliation on Resume (5.9)** - The most significant gap. On session resume, the system should:
   - Load pending IndexedDB queue items
   - Compare each item's `localTimestamp` against session's `lastAction`
   - Apply newer items, discard stale ones
   - Implementation location: `useTestSession.js` in `loadTestAndSession()`

2. **QuotaExceededError Handling (5.12)** - Add try/catch in `useOfflineQueue.js`:
   ```javascript
   try {
     store.add(queueItem)
   } catch (error) {
     if (error.name === 'QuotaExceededError') {
       await flushQueue() // Try to free space
       // Show warning toast to user
     }
     throw error
   }
   ```

3. **Timer Expiry Auto-Submit (5.12)** - Complete the `handleTimerExpire` implementation:
   - Queue a SUBMIT action
   - If online, trigger submit flow
   - If offline, queue action for later processing

4. **PAUSED Status on Browser Close (5.9)** - Add logic to set session status to PAUSED on `beforeunload` (noted in other audit sections as well)

### Patterns Observed:

- **Infrastructure exists but incomplete**: IndexedDB queue, timestamps, and transactions are all set up correctly, but the conflict resolution and reconciliation logic is missing
- **Optimistic but no reconciliation**: The system is optimistic-update first, but lacks the reconciliation step that makes this pattern robust
- **Edge cases deferred**: Comments like "Could trigger auto-submit here" indicate edge cases were identified but not implemented

### Suggested Implementation Order:
1. QuotaExceededError handling (quick win, prevents crashes)
2. Timer expiry auto-submit (user-facing impact)
3. Queue reconciliation on resume (critical for data integrity)
4. PAUSED status handling (completes the resume flow)
