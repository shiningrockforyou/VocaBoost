# Fix Plan: Sections 16.1 to 16.6 (Components/Hooks List)

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_16.1_to_16.6_criteria_audit.md

## Executive Summary
- Total Issues: 10
- ⚠️ Partial Implementations: 9
- ❌ Missing Features: 1
- ❓ Needs Investigation: 0
- Estimated Complexity: Medium

---

## Issue 1: Missing Opportunistic Mode in useOfflineQueue

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** After 3 failures: opportunistic mode (retry on user action)
- **Current State:** Stops retrying after 5 failures with no opportunistic fallback

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` (lines 257-262) - Retry logic
  - `src/apBoost/hooks/useTestSession.js` (lines 350-358, 379-383) - User action handlers
- **Current Implementation:**
  - Line 259: `if (retryCountRef.current < 5)` - simply stops after 5 retries
  - No mechanism to retry on user interaction after backoff exhaustion
- **Gap:** No opportunistic mode that retries on user actions (answer change, navigation, flag toggle)
- **Dependencies:** useTestSession calls addToQueue on user actions

### Fix Plan

#### Step 1: Add opportunistic mode state
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Add new state and ref
**Details:**
- Add `const [isOpportunisticMode, setIsOpportunisticMode] = useState(false)` after line 54
- This tracks when the queue has exhausted retries and is waiting for user action

#### Step 2: Enter opportunistic mode after 3 failures
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Modify retry logic (lines 257-262)
**Details:**
- Change from 5 failures to 3 as per criteria
- When reaching 3 failures, set `isOpportunisticMode` to true instead of giving up
- Stop scheduling automatic retries
```javascript
retryCountRef.current++
if (retryCountRef.current < 3) {
  const delay = Math.pow(2, retryCountRef.current) * 1000 // 2s, 4s
  scheduleFlush(delay)
} else {
  // Enter opportunistic mode - retry on user action
  setIsOpportunisticMode(true)
}
```

#### Step 3: Retry on user action in opportunistic mode
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Modify addToQueue function (lines 125-160)
**Details:**
- After adding item to queue, check if in opportunistic mode
- If so, immediately attempt flush (user took action = retry opportunity)
```javascript
// After line 150 (await updateQueueLength())
if (isOpportunisticMode) {
  // User action = opportunity to retry
  setIsOpportunisticMode(false)
  retryCountRef.current = 0
  flushQueue()
} else if (isOnline) {
  scheduleFlush(1000)
}
```

#### Step 4: Return isOpportunisticMode from hook
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Add to return object (line 277-283)
**Details:**
- Add `isOpportunisticMode` to the returned object for UI feedback

### Verification Steps
1. Simulate 3 network failures during flush
2. Verify automatic retries stop after 3 failures
3. Perform a user action (change answer)
4. Verify queue attempts flush again
5. If successful, verify normal operation resumes

### Potential Risks
- **Race conditions:** Mitigate by checking isFlushing before opportunistic retry
- **UI confusion:** Return isOpportunisticMode so UI can show "Waiting for connection" indicator

---

## Issue 2: Missing Visibility Change Flush in useOfflineQueue

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Flushes on: online event, visibility change, successful heartbeat
- **Current State:** Only flushes on online event

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` (lines 84-104) - Event listeners
  - `src/apBoost/hooks/useHeartbeat.js` (lines 100-113) - Already has visibility change handler for heartbeat
- **Current Implementation:** Only `window.addEventListener('online', handleOnline)` exists
- **Gap:** Missing `document.addEventListener('visibilitychange', ...)` to flush on tab focus
- **Dependencies:** None - self-contained change

### Fix Plan

#### Step 1: Add visibility change event listener
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Add new useEffect after online/offline listeners (after line 104)
**Details:**
```javascript
// Flush on visibility change (tab becomes visible)
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && isOnline && queueLength > 0) {
      retryCountRef.current = 0 // Reset retries on visibility
      scheduleFlush(500) // Slight delay to let page settle
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}, [isOnline, queueLength])
```

### Verification Steps
1. Add items to queue
2. Switch to another tab
3. Simulate offline briefly
4. Switch back to test tab
5. Verify queue attempts to flush

### Potential Risks
- **Performance:** Rate limit with scheduleFlush debounce (already 500ms delay)
- **Dependencies:** Need queueLength in dependency array, may cause extra renders (minimal impact)

---

## Issue 3: Navigation Not Triggering Immediate Firestore Save

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** On navigation: Immediate Firestore save
- **Current State:** Navigation goes through debounced queue (1s delay)

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useTestSession.js` (lines 250-259, 280-287) - Navigation handlers
  - `src/apBoost/services/apSessionService.js` - updatePosition function
- **Current Implementation:**
  - Lines 251-258: `addToQueue({ action: 'NAVIGATION', payload: {...} })`
  - This goes through 1s debounce before Firestore write
- **Gap:** Criteria specifies "immediate" save for navigation, but implementation debounces
- **Dependencies:** updatePosition service function already exists

### Fix Plan

#### Step 1: Create immediate save option in queue
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Add immediate flag to addToQueue
**Details:**
- Modify addToQueue to accept optional `immediate` parameter
- If immediate, bypass debounce and flush now
```javascript
const addToQueue = useCallback(async (action, immediate = false) => {
  // ... existing add logic ...

  if (immediate && isOnline) {
    flushQueue() // Immediate flush, no debounce
  } else if (isOnline) {
    scheduleFlush(1000) // Normal debounce
  }
}, [sessionId, isOnline, updateQueueLength, flushQueue])
```

#### Step 2: Update navigation calls to use immediate flag
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify goToFlatIndex and goToQuestion
**Details:**
- Line 251: Change `addToQueue({...})` to `addToQueue({...}, true)` for immediate save
- Line 282: Same change for goToQuestion

**Alternative Approach (if immediate flag is complex):**
- Call updatePosition directly from navigation functions
- Keep queue for offline fallback
```javascript
// In goToFlatIndex, after addToQueue:
if (isOnline) {
  updatePosition(session.id, {
    currentSectionIndex,
    currentQuestionIndex: item.questionIndex,
    currentSubQuestionLabel: item.subQuestionLabel
  }).catch(err => logError('Navigation save failed', err))
}
```

### Verification Steps
1. Navigate between questions
2. Check Firestore console - position should update immediately
3. Verify latency is under 100ms (not debounced 1s)
4. Test offline - should still queue for later

### Potential Risks
- **Performance:** More Firestore writes. Mitigate by only immediate for navigation (answers still debounced)
- **Conflict with queue:** Could write same data twice. Accept this - idempotent update
- **Recommendation:** Use the immediate flag approach for cleaner code

---

## Issue 4: useHeartbeat Not Triggering Queue Flush on Success

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** On success: clears failure counter, attempts queue flush
- **Current State:** Clears failure counter but does not flush queue

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useHeartbeat.js` (lines 63-67) - Success handler
  - `src/apBoost/hooks/useTestSession.js` (lines 50-52) - Hook integration
  - `src/apBoost/hooks/useOfflineQueue.js` - flushQueue function
- **Current Implementation:**
  - useHeartbeat has no access to flushQueue
  - Hooks are separate with no communication channel
- **Gap:** Need to integrate heartbeat success with queue flush
- **Dependencies:** Both hooks used in useTestSession

### Fix Plan

#### Option A: Add callback prop to useHeartbeat (Recommended)
**File:** `src/apBoost/hooks/useHeartbeat.js`
**Action:** Accept onSuccess callback
**Details:**
```javascript
// Line 18: Add onSuccess parameter
export function useHeartbeat(sessionId, instanceToken, onSuccess = null) {

  // Line 66-67: Call onSuccess after setting state
  setLastHeartbeat(new Date())
  if (onSuccess) {
    onSuccess()
  }
  logDebug('useHeartbeat.doHeartbeat', 'Heartbeat successful')
```

**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Pass flushQueue to useHeartbeat
**Details:**
```javascript
// Line 52: Add flushQueue callback
const { isConnected, failureCount, sessionTakenOver } = useHeartbeat(
  session?.id,
  instanceToken,
  flushQueue // Called on successful heartbeat
)
```

#### Option B: Use shared context/event emitter (More complex)
- Create a shared event bus for hook communication
- Heartbeat emits 'heartbeat-success' event
- Queue listens and flushes
- **Not recommended** - adds complexity for simple integration

### Verification Steps
1. Add items to queue while offline
2. Go online
3. Wait for heartbeat (15s)
4. Verify queue flushes after successful heartbeat

### Potential Risks
- **Circular dependency:** None - one-way callback from heartbeat to queue
- **Multiple flushes:** flushQueue already guards with isFlushing check

---

## Issue 5: IndexedDB Database Name Mismatch

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Uses IndexedDB database: ap_action_queue
- **Current State:** Database name is 'ap_boost_queue'

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` (line 9) - DB_NAME constant
- **Current Implementation:** `const DB_NAME = 'ap_boost_queue'`
- **Gap:** Criteria specifies 'ap_action_queue'
- **Dependencies:** Existing users may have data in old database

### Fix Plan

#### Step 1: Update database name constant
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Change DB_NAME value
**Details:**
```javascript
// Line 9
const DB_NAME = 'ap_action_queue'
```

#### Step 2: Add migration for existing data (Optional but recommended)
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Add migration in openDatabase function
**Details:**
- Check if old database exists
- Copy data to new database
- Delete old database
```javascript
async function migrateOldDatabase() {
  const oldDbName = 'ap_boost_queue'
  const databases = await indexedDB.databases()
  const oldExists = databases.some(db => db.name === oldDbName)

  if (oldExists) {
    // Copy data from old to new, then delete old
    // Implementation details...
  }
}
```

**Note:** Given this is likely dev/test phase, migration may be overkill. Simple rename sufficient.

### Verification Steps
1. Clear IndexedDB in browser
2. Use offline queue
3. Check IndexedDB - should show 'ap_action_queue' database
4. Verify data persists correctly

### Potential Risks
- **Data loss:** If users have pending data in old DB. Mitigate with migration or document as breaking change
- **Recommendation:** If pre-production, just rename. If production users exist, add migration.

---

## Issue 6: Missing CONFIRMED Status in Queue Flow

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Status flow: PENDING → CONFIRMED → deleted
- **Current State:** Items go PENDING → deleted directly

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` (lines 238-249) - Flush completion
- **Current Implementation:**
  - After successful Firestore write, items are deleted immediately
  - No intermediate CONFIRMED status
- **Gap:** Two-phase commit pattern not implemented
- **Dependencies:** None

### Fix Plan

#### Step 1: Add CONFIRMED status transition
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Modify flush completion (lines 238-249)
**Details:**
```javascript
// After successful Firestore write (line 236)

// Mark items as CONFIRMED
const confirmTx = dbRef.current.transaction(STORE_NAME, 'readwrite')
const confirmStore = confirmTx.objectStore(STORE_NAME)

for (const item of pendingItems) {
  const confirmedItem = { ...item, status: 'CONFIRMED' }
  confirmStore.put(confirmedItem)
}

await new Promise((resolve, reject) => {
  confirmTx.oncomplete = resolve
  confirmTx.onerror = () => reject(confirmTx.error)
})

// Then delete confirmed items
const deleteTx = dbRef.current.transaction(STORE_NAME, 'readwrite')
const deleteStore = deleteTx.objectStore(STORE_NAME)

for (const item of pendingItems) {
  deleteStore.delete(item.id)
}

await new Promise((resolve, reject) => {
  deleteTx.oncomplete = resolve
  deleteTx.onerror = () => reject(deleteTx.error)
})
```

#### Alternative: Simplified approach
**Details:**
- If the purpose is just crash recovery, the current approach is functionally equivalent
- CONFIRMED status only helps if we need to track "sent but not acknowledged" state
- Consider if this complexity is needed for MVP

### Verification Steps
1. Add items to queue
2. Set breakpoint between CONFIRMED and delete
3. Verify items show CONFIRMED status in IndexedDB
4. Let complete - verify items deleted

### Potential Risks
- **Performance:** Extra IndexedDB transaction. Minimal impact.
- **Complexity:** Adds code for marginal benefit. Consider deferring.
- **Recommendation:** Defer to Phase 2 unless explicit crash recovery needed

---

## Issue 7: Answer Debounce Timing (Minor)

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** On answer change: Debounce save (1s-2s)
- **Current State:** Uses 1s debounce (within range but at lower bound)

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` (line 155) - scheduleFlush(1000)
- **Current Implementation:** 1000ms (1s) debounce
- **Gap:** Technically meets criteria (1s-2s range), but at lower bound
- **Dependencies:** None

### Fix Plan

#### Decision: No change needed
- 1s is within the 1s-2s range specified
- Lower debounce = faster perceived responsiveness
- Consider this a design choice, not a bug

#### Alternative: If 2s preferred
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Change debounce timing
**Details:**
```javascript
// Line 155
scheduleFlush(2000) // 2 second debounce
```

### Verification Steps
- N/A - no change recommended

### Potential Risks
- None

---

## Issue 8: useAnnotations Missing saveAnnotations() Function Name

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Returns: saveAnnotations(), loadAnnotations()
- **Current State:** Has loadAnnotations() and exportAnnotations(), but no saveAnnotations()

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useAnnotations.js` (lines 207-223, 252-253) - Export functions
- **Current Implementation:**
  - `exportAnnotations()` - serializes annotations for persistence
  - Actual saving done implicitly via `addToQueue` in each annotation function
- **Gap:** No explicit `saveAnnotations()` function by that name
- **Dependencies:** None

### Fix Plan

#### Step 1: Add saveAnnotations as alias or explicit function
**File:** `src/apBoost/hooks/useAnnotations.js`
**Action:** Add saveAnnotations function
**Details:**
```javascript
// After exportAnnotations (line 223)

// Explicit save function for API consistency
const saveAnnotations = useCallback(() => {
  const data = exportAnnotations()
  if (sessionId && addToQueue) {
    addToQueue({
      action: 'ANNOTATION_UPDATE',
      payload: { type: 'FULL_SAVE', data }
    })
  }
  return data
}, [sessionId, addToQueue, exportAnnotations])

// In return object (line 253)
saveAnnotations,
```

### Verification Steps
1. Call saveAnnotations()
2. Verify item added to queue
3. Verify annotations persist after page reload

### Potential Risks
- **Duplicate saves:** Individual functions already queue. Full save is redundant but harmless.
- **Recommendation:** Low priority - current implicit save via individual functions is actually better UX

---

## Issue 9: Firestore sessionToken Check Location

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** (useDuplicateTabGuard) Checks Firestore sessionToken on heartbeat
- **Current State:** Check is in useHeartbeat (line 47-50), not useDuplicateTabGuard

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useHeartbeat.js` (lines 47-50) - Token check
  - `src/apBoost/hooks/useDuplicateTabGuard.js` - No Firestore check on heartbeat
  - `src/apBoost/hooks/useTestSession.js` (lines 51-52) - Integration
- **Current Implementation:**
  - useHeartbeat checks token match and sets `sessionTakenOver`
  - useTestSession combines `isInvalidated || sessionTakenOver` (line 55)
  - Functionally correct through hook integration
- **Gap:** Architecture differs from spec but behavior is correct
- **Dependencies:** Both hooks deeply integrated

### Fix Plan

#### Decision: Document as design decision, no code change
- Current implementation is cleaner - token check happens where Firestore read happens
- Moving check to useDuplicateTabGuard would require duplicating Firestore reads
- Result is the same - session invalidation detected

#### Alternative: If strict compliance needed
**File:** `src/apBoost/hooks/useDuplicateTabGuard.js`
**Action:** Add periodic Firestore token check
**Details:**
- Add useEffect with interval to check Firestore token
- Duplicates work already done by useHeartbeat
- **Not recommended**

### Verification Steps
1. Open test session in two tabs
2. Verify second tab triggers invalidation in first
3. Verify both BroadcastChannel and Firestore detection work

### Potential Risks
- None - current implementation correct
- **Recommendation:** Add comment in code documenting the integration pattern

---

## Issue 10: Heartbeat Success Queue Flush Integration

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** (useOfflineQueue) Flushes on: successful heartbeat
- **Current State:** No integration between heartbeat success and queue flush

### Code Analysis
Same as Issue 4 - this is the queue-side perspective of the same integration gap.

### Fix Plan
See Issue 4 - single fix addresses both issues.

---

## Implementation Order

Recommended order (considering dependencies and impact):

1. **Issue 4 & 10: Heartbeat-Queue Integration** - Foundation for resilience
2. **Issue 2: Visibility Change Flush** - Quick win, isolated change
3. **Issue 1: Opportunistic Mode** - Important for offline resilience
4. **Issue 3: Navigation Immediate Save** - User experience improvement
5. **Issue 5: Database Name** - Simple rename, do before production
6. **Issue 6: CONFIRMED Status** - Can defer to Phase 2
7. **Issue 8: saveAnnotations Name** - Low priority API consistency
8. **Issue 7: Debounce Timing** - No change needed
9. **Issue 9: Token Check Location** - No change needed, document only

---

## Cross-Cutting Concerns

### Queue-Heartbeat Communication Pattern
Both hooks need to communicate. Options:
1. **Callback props** (Recommended) - Pass flushQueue to useHeartbeat
2. **Shared context** - Overkill for this use case
3. **Event emitter** - Adds complexity

Use callback pattern - cleanest for this integration.

### Constants Alignment
Consider creating shared constants file:
```javascript
// src/apBoost/utils/queueConstants.js
export const DB_NAME = 'ap_action_queue'
export const DEBOUNCE_MS = 1000
export const MAX_RETRIES = 3
export const HEARTBEAT_INTERVAL_MS = 15000
```

---

## Notes for Implementer

1. **Test offline scenarios thoroughly** - Use Chrome DevTools Network throttling
2. **Watch for race conditions** - Multiple flushes, simultaneous heartbeats
3. **IndexedDB debugging** - Use Application tab in DevTools to inspect queue
4. **BroadcastChannel testing** - Requires same-origin tabs, not incognito
5. **Consider backwards compatibility** - If any users have data in old DB name
6. **Keep changes minimal** - These are refinements, not rewrites
7. **Add logging** - Use logDebug for new code paths to aid debugging

---

## Summary Table

| Issue | Priority | Complexity | Recommendation |
|-------|----------|------------|----------------|
| 1. Opportunistic Mode | High | Medium | Implement |
| 2. Visibility Flush | High | Low | Implement |
| 3. Navigation Immediate | Medium | Low | Implement |
| 4/10. Heartbeat-Queue | High | Low | Implement |
| 5. DB Name | Low | Low | Implement before prod |
| 6. CONFIRMED Status | Low | Medium | Defer to Phase 2 |
| 7. Debounce Timing | None | N/A | No change |
| 8. saveAnnotations | Low | Low | Optional |
| 9. Token Check Location | None | N/A | Document only |
