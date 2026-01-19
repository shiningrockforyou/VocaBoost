# Fix Plan: Sections 17.1 to 17.6 (Hooks Detailed)

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_17.1_to_17.6_criteria_audit.md

## Executive Summary
- Total Issues: 11
- ⚠️ Partial Implementations: 8
- ❌ Missing Features: 2
- ❓ Needs Investigation: 1 (resolved - working as designed)
- Estimated Complexity: **Medium**

---

## Issue 1: ANNOTATION_UPDATE Not Handled in flushQueue

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Stored in ap_session_state.annotations
- **Current State:** `useAnnotations.js` queues `ANNOTATION_UPDATE` actions but `useOfflineQueue.flushQueue()` doesn't handle this action type

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` (lines 204-225) - flushQueue switch statement missing ANNOTATION_UPDATE case
  - `src/apBoost/hooks/useAnnotations.js` (lines 47, 65, 82, 113, 134, 174) - queues ANNOTATION_UPDATE with various payload types
  - `src/apBoost/services/apSessionService.js` (lines 61-62) - shows session has `annotations: {}` and `strikethroughs: {}` fields
- **Current Implementation:** useAnnotations queues annotation changes with payloads like:
  - `{ type: 'ADD_HIGHLIGHT', questionId, range, color }`
  - `{ type: 'REMOVE_HIGHLIGHT', questionId, index }`
  - `{ type: 'CLEAR_HIGHLIGHTS', questionId }`
  - `{ type: 'TOGGLE_STRIKETHROUGH', questionId, choiceId }`
  - `{ type: 'CLEAR_STRIKETHROUGHS', questionId }`
  - `{ type: 'CLEAR_ALL' }`
- **Gap:** flushQueue switch statement has no case for 'ANNOTATION_UPDATE', so these actions fall to default and are never persisted
- **Dependencies:** Uses same Firestore update pattern as other queue actions

### Fix Plan

#### Step 1: Add ANNOTATION_UPDATE case to flushQueue
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Modify switch statement at lines 204-225
**Details:**
- Add new case for 'ANNOTATION_UPDATE' before the default case
- Handle each annotation payload type:
  - `ADD_HIGHLIGHT`: Append to `annotations.highlights.{questionId}` array
  - `REMOVE_HIGHLIGHT`: This is complex - may need to read current state first OR use a batch approach
  - `CLEAR_HIGHLIGHTS`: Set `annotations.highlights.{questionId}` to empty array
  - `TOGGLE_STRIKETHROUGH`: Toggle value in `strikethroughs.{questionId}.{choiceId}`
  - `CLEAR_STRIKETHROUGHS`: Set `strikethroughs.{questionId}` to empty object
  - `CLEAR_ALL`: Reset both `annotations` and `strikethroughs` to empty objects

```javascript
// Example implementation pattern:
case 'ANNOTATION_UPDATE':
  const { type, questionId, range, color, choiceId, index } = item.payload
  switch (type) {
    case 'ADD_HIGHLIGHT':
      // Use arrayUnion for atomic append
      // updates[`annotations.highlights.${questionId}`] = arrayUnion({ ...range, color })
      break
    case 'TOGGLE_STRIKETHROUGH':
      // Store strikethrough state
      // This needs special handling - either use a Set representation or boolean map
      break
    // ... other cases
  }
  break
```

#### Step 2: Consider batch annotation updates
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Add helper for complex annotation merges
**Details:**
- For REMOVE_HIGHLIGHT and similar operations, may need to:
  - Group all annotation updates for a session
  - Apply them in order locally
  - Write final state to Firestore
- Alternative: Store annotations as a single object and use full replacement

#### Step 3: Update useAnnotations to use proper Firestore-compatible structures
**File:** `src/apBoost/hooks/useAnnotations.js`
**Action:** Ensure data structures are Firestore-friendly
**Details:**
- Current Map/Set structures work locally but need object conversion for Firestore
- The `exportAnnotations` function (lines 208-223) already does this conversion
- Consider calling exportAnnotations during flush to get the complete state

### Verification Steps
1. Add a highlight in a test session
2. Refresh the page
3. Verify highlight persists from session state
4. Repeat for strikethroughs
5. Test offline scenario - add highlights while offline, verify they persist when back online

### Potential Risks
- **Risk:** Complex annotation operations (remove specific highlight) may be difficult to merge atomically
- **Mitigation:** Consider storing full annotation state per question rather than individual operations
- **Risk:** Race conditions if multiple tabs modify annotations
- **Mitigation:** Accept last-write-wins for annotations (low priority data)

---

## Issue 2: FLAG_TOGGLE Has Placeholder Handling

### Audit Finding
- **Status:** ⚠️ Partial (related to Issue 1)
- **Criterion:** Queue entries properly processed for all action types
- **Current State:** FLAG_TOGGLE case exists but only has a comment "// Flags need special handling - we'd need to maintain the array"

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` (lines 208-210) - placeholder case
  - `src/apBoost/services/apSessionService.js` (lines 150-176) - shows proper flag toggle pattern
- **Current Implementation:** Case exists but does nothing
- **Gap:** Flags are not persisted through the queue
- **Dependencies:** Uses `flaggedQuestions` array in session state

### Fix Plan

#### Step 1: Implement FLAG_TOGGLE in flushQueue
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Replace placeholder with working implementation
**Details:**
- Import `arrayUnion` and `arrayRemove` from firebase/firestore
- Use these for atomic array operations:

```javascript
case 'FLAG_TOGGLE':
  if (item.payload.markedForReview) {
    // Add to flagged questions - use arrayUnion for atomic add
    updates.flaggedQuestions = arrayUnion(item.payload.questionId)
  } else {
    // Remove from flagged questions - use arrayRemove for atomic remove
    updates.flaggedQuestions = arrayRemove(item.payload.questionId)
  }
  break
```

#### Step 2: Update imports
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Add arrayUnion, arrayRemove to imports
**Details:**
- Line 2: Add to existing firebase/firestore import

### Verification Steps
1. Flag a question during a test
2. Refresh the page
3. Verify flag is still set
4. Test unflagging and refresh again

### Potential Risks
- **Risk:** Multiple rapid flag toggles may create race conditions
- **Mitigation:** arrayUnion/arrayRemove are idempotent - toggling same question twice has expected behavior

---

## Issue 3: HighlightRange Type Not Validated

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** HighlightRange: { start: number, end: number, color: string }
- **Current State:** Range structure used but not explicitly typed/validated

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useAnnotations.js` (line 40) - `{ ...range, color }` spread without validation
  - `src/apBoost/hooks/useAnnotations.js` (lines 36-51) - addHighlight function
- **Current Implementation:** Accepts any range object and spreads it
- **Gap:** No validation that range has start/end properties, no type enforcement
- **Dependencies:** Consumers of highlights expect consistent structure

### Fix Plan

#### Step 1: Add JSDoc type definition
**File:** `src/apBoost/hooks/useAnnotations.js`
**Action:** Add type documentation at top of file
**Details:**
```javascript
/**
 * @typedef {Object} HighlightRange
 * @property {number} start - Start character index
 * @property {number} end - End character index
 * @property {string} color - Highlight color key (yellow, green, pink, blue)
 */
```

#### Step 2: Add runtime validation in addHighlight
**File:** `src/apBoost/hooks/useAnnotations.js`
**Action:** Modify addHighlight function (lines 36-51)
**Details:**
```javascript
const addHighlight = useCallback((questionId, range, color = 'yellow') => {
  // Validate range structure
  if (typeof range?.start !== 'number' || typeof range?.end !== 'number') {
    logError('useAnnotations.addHighlight', { questionId },
      new Error('Invalid range: must have numeric start and end'))
    return
  }
  if (range.start < 0 || range.end < range.start) {
    logError('useAnnotations.addHighlight', { questionId },
      new Error('Invalid range: start must be >= 0 and end must be >= start'))
    return
  }
  // ... rest of implementation
}, [sessionId, addToQueue])
```

### Verification Steps
1. Call addHighlight with valid range - verify it works
2. Call addHighlight with invalid range (missing start/end) - verify it logs error and doesn't crash
3. Call addHighlight with negative start - verify validation catches it

### Potential Risks
- **Risk:** Breaking existing code that passes malformed ranges
- **Mitigation:** Log error but don't throw - graceful degradation

---

## Issue 4: IndexedDB Name Mismatch

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Uses IndexedDB database: ap_action_queue
- **Current State:** Database named `ap_boost_queue`

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` (line 9) - `const DB_NAME = 'ap_boost_queue'`
- **Current Implementation:** Uses `ap_boost_queue`
- **Gap:** Criteria specifies `ap_action_queue`
- **Dependencies:** Changing this would require migration for existing users

### Fix Plan

#### Option A: Update criteria to match implementation (Recommended)
**Action:** This is a documentation/criteria issue, not a code issue
**Rationale:**
- `ap_boost_queue` is descriptive and follows the project's `ap_` prefix convention
- Changing the DB name would require migration logic for existing sessions
- The functionality is identical regardless of name

#### Option B: Rename to match criteria
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Change DB_NAME constant
**Details:**
- Change line 9: `const DB_NAME = 'ap_action_queue'`
- Add migration logic to handle existing data (complex)

### Recommendation
**Choose Option A** - Update acceptance criteria to document `ap_boost_queue` as the correct name. The current name is reasonable and changing it adds complexity with no functional benefit.

### Verification Steps
- N/A if choosing Option A
- If Option B: Test that queue operations work with new DB name, verify no data loss

---

## Issue 5: No CONFIRMED Status in Queue

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Status flow: PENDING → CONFIRMED → deleted
- **Current State:** Items go directly from PENDING to deleted

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` (lines 238-249) - delete transaction
- **Current Implementation:** After successful Firestore write, items are immediately deleted
- **Gap:** No intermediate CONFIRMED state
- **Dependencies:** None - this is an internal queue state

### Fix Plan

#### Option A: Add CONFIRMED state (matches criteria)
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Add CONFIRMED transition before delete
**Details:**
```javascript
// After successful Firestore write (around line 237)
// Mark items as CONFIRMED first
const confirmTx = dbRef.current.transaction(STORE_NAME, 'readwrite')
const confirmStore = confirmTx.objectStore(STORE_NAME)
for (const item of pendingItems) {
  confirmStore.put({ ...item, status: 'CONFIRMED' })
}
await new Promise((resolve, reject) => {
  confirmTx.oncomplete = resolve
  confirmTx.onerror = () => reject(confirmTx.error)
})

// Then delete confirmed items
const deleteTx = dbRef.current.transaction(STORE_NAME, 'readwrite')
// ... existing delete logic
```

#### Option B: Document current behavior as acceptable (Recommended)
**Rationale:**
- The CONFIRMED state was intended to handle partial failure scenarios
- In practice, if Firestore write succeeds but IndexedDB delete fails:
  - Items would be re-sent on next flush (idempotent for most operations)
  - This is actually acceptable behavior
- Adding CONFIRMED state doubles IndexedDB transactions, impacting performance

### Recommendation
**Choose Option B** - Document that the implementation intentionally skips CONFIRMED for performance. The current behavior is safe because queue operations are idempotent.

### Verification Steps
- N/A if documenting current behavior
- If implementing CONFIRMED: Test partial failure scenarios

---

## Issue 6: No Visibility Change Flush

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Flushes on: online event, visibility change, successful heartbeat
- **Current State:** Only flushes on online event

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` (lines 84-104) - online/offline handlers
  - `src/apBoost/hooks/useHeartbeat.js` (lines 101-113) - has visibility handler but for heartbeat only
- **Current Implementation:** Only listens for 'online'/'offline' events
- **Gap:** No visibility change handler to flush queue
- **Dependencies:** Could use same pattern as useHeartbeat visibility handler

### Fix Plan

#### Step 1: Add visibility change listener
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Add new useEffect for visibility change
**Details:**
```javascript
// Add after the online/offline useEffect (around line 104)
// Listen for visibility changes - flush when tab becomes visible
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && isOnline) {
      // Tab became visible, try to flush any pending changes
      scheduleFlush(500) // Short delay to avoid race conditions
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}, [isOnline, scheduleFlush])
```

### Verification Steps
1. Make changes to a test (answer question, flag, etc.)
2. Immediately switch to another tab
3. Wait a few seconds
4. Switch back to the test tab
5. Check network/console to verify flush occurred
6. Also test: put device to sleep, wake it up, verify flush

### Potential Risks
- **Risk:** Excessive flushes if user rapidly switches tabs
- **Mitigation:** scheduleFlush already has debouncing built in

---

## Issue 7: No Heartbeat-Triggered Queue Flush

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** On success: clears failure counter, attempts queue flush
- **Current State:** useHeartbeat clears failure counter but doesn't trigger queue flush

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useHeartbeat.js` (lines 63-67) - success handling
  - `src/apBoost/hooks/useTestSession.js` (lines 50-52) - integrates both hooks
- **Current Implementation:** On successful heartbeat, sets `isConnected(true)` and `failureCount(0)` but no queue interaction
- **Gap:** Should also trigger a queue flush
- **Dependencies:** useHeartbeat and useOfflineQueue are both used in useTestSession

### Fix Plan

#### Option A: Pass flushQueue to useHeartbeat
**File:** `src/apBoost/hooks/useHeartbeat.js`
**Action:** Accept optional flushQueue parameter
**Details:**
```javascript
export function useHeartbeat(sessionId, instanceToken, flushQueue = null) {
  // ... existing code

  // In doHeartbeat success path (around line 67)
  if (flushQueue) {
    flushQueue()
  }
}
```

**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Pass flushQueue to useHeartbeat
**Details:**
```javascript
const { isConnected, failureCount, sessionTakenOver } = useHeartbeat(
  session?.id,
  instanceToken,
  flushQueue // Add this parameter
)
```

#### Option B: Coordinate in useTestSession (Recommended)
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Add effect to flush on connection restore
**Details:**
```javascript
// Add new useEffect after the resilience hooks
useEffect(() => {
  // When connection is restored (failureCount goes from high to 0 while connected)
  if (isConnected && failureCount === 0 && queueLength > 0) {
    flushQueue()
  }
}, [isConnected, failureCount, queueLength, flushQueue])
```

### Recommendation
**Choose Option B** - Coordinating in useTestSession keeps hooks more focused and doesn't require modifying useHeartbeat's API.

### Verification Steps
1. Start a test session
2. Simulate network issues (DevTools offline mode)
3. Make some changes (should queue locally)
4. Go back online
5. Verify heartbeat succeeds and triggers queue flush

### Potential Risks
- **Risk:** Multiple flush triggers (visibility + heartbeat + online event)
- **Mitigation:** flushQueue checks `isFlushing` flag and debounces

---

## Issue 8: No Opportunistic Mode After Retries Exhausted

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** After 3 failures: opportunistic mode (retry on user action)
- **Current State:** After 5 retries, stops completely

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` (lines 257-262) - retry logic
- **Current Implementation:** Retries 5 times with exponential backoff, then stops
- **Gap:** No "opportunistic mode" that retries on user action after exhaustion
- **Dependencies:** Would need to detect "user action" triggers

### Fix Plan

#### Step 1: Track retry exhaustion state
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Add state for tracking exhausted retries
**Details:**
```javascript
const [isRetryExhausted, setIsRetryExhausted] = useState(false)

// In the retry logic (around line 259):
if (retryCountRef.current < 5) {
  const delay = Math.pow(2, retryCountRef.current) * 1000
  scheduleFlush(delay)
} else {
  // Enter opportunistic mode
  setIsRetryExhausted(true)
}
```

#### Step 2: Retry on user action when exhausted
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Modify addToQueue to attempt flush when in opportunistic mode
**Details:**
```javascript
const addToQueue = useCallback(async (action) => {
  // ... existing add logic

  // If we're in opportunistic mode (retries exhausted), try again on user action
  if (isRetryExhausted && isOnline) {
    retryCountRef.current = 0
    setIsRetryExhausted(false)
    scheduleFlush(1000)
  } else if (isOnline) {
    scheduleFlush(1000)
  }
}, [sessionId, isOnline, updateQueueLength, isRetryExhausted])
```

#### Step 3: Also retry on visibility change in opportunistic mode
**Details:** The visibility change handler from Issue 6 will naturally handle this if we reset `isRetryExhausted` when tab becomes visible.

### Verification Steps
1. Simulate persistent network failure (firewall block to Firestore)
2. Make changes until retries are exhausted
3. Fix network
4. Make another change (user action)
5. Verify queue attempts to flush again

### Potential Risks
- **Risk:** Rapid retry loops if network keeps failing
- **Mitigation:** Keep exponential backoff, just reset counter on user action

---

## Issue 9: Navigation Goes Through Queue (Not Immediate)

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** On navigation: Immediate Firestore save
- **Current State:** Navigation goes through queue with 1s debounce

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useTestSession.js` (lines 249-259) - navigation uses addToQueue
- **Current Implementation:** `addToQueue({ action: 'NAVIGATION', ... })` with 1s debounce
- **Gap:** Criteria says "immediate" but it's queued
- **Dependencies:** beforeunload handler (lines 208-220) warns if queue not empty

### Fix Plan

#### Option A: Make navigation truly immediate
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Call updatePosition directly instead of queueing
**Details:**
```javascript
// In goToFlatIndex and goToQuestion, replace addToQueue with:
if (session?.id) {
  // Immediate save, don't queue
  updatePosition(session.id, currentSectionIndex, item.questionIndex)
    .catch(err => {
      logError('useTestSession.navigation', { sessionId: session.id }, err)
      // Fall back to queue on failure
      addToQueue({ action: 'NAVIGATION', payload: { ... } })
    })
}
```

#### Option B: Accept queued navigation with safeguards (Recommended)
**Rationale:**
- beforeunload already warns user if queue not empty
- Navigation updates every second during active use
- Making it truly immediate adds latency to every navigation click
- Queue batches multiple rapid navigations into single write

**Action:** Document that queued navigation with beforeunload protection meets the intent

### Recommendation
**Choose Option B** - The current implementation with beforeunload protection is a reasonable interpretation. The criteria's "immediate" intent is to prevent data loss, which the current design achieves.

### Verification Steps
- Verify beforeunload triggers when navigating away with pending changes
- Verify position is correct after page refresh

---

## Issue 10: Answer Debounce Timing

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** On answer change: Debounce save (1s-2s) - some criteria reference 2-3s
- **Current State:** Uses 1s debounce

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` (line 155) - `scheduleFlush(1000)` = 1 second
- **Current Implementation:** 1 second debounce before flush
- **Gap:** Some criteria reference 2-3 second debounce
- **Dependencies:** Timer sync uses 30 second interval (different concern)

### Fix Plan

#### Option A: Increase to 2 seconds
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Change debounce delay
**Details:**
```javascript
// Line 155: Change 1000 to 2000
scheduleFlush(2000) // 2 second debounce
```

#### Option B: Keep 1 second (Recommended)
**Rationale:**
- 1 second provides good UX (changes feel like they save quickly)
- Still batches rapid typing effectively
- 2-3 seconds may make the app feel unresponsive
- The criteria range "1s-2s" includes 1s

### Recommendation
**Choose Option B** - 1 second is within the acceptable range and provides better UX. No change needed.

---

## Issue 11: saveAnnotations Function Naming

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Returns: saveAnnotations(), loadAnnotations()
- **Current State:** Returns `exportAnnotations` instead of `saveAnnotations`

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useAnnotations.js` (lines 253-254) - returns `loadAnnotations` and `exportAnnotations`
- **Current Implementation:** `exportAnnotations` converts internal state to Firestore-friendly object
- **Gap:** Function named differently than criteria specifies
- **Dependencies:** Any code calling `saveAnnotations` would fail

### Fix Plan

#### Step 1: Add saveAnnotations alias
**File:** `src/apBoost/hooks/useAnnotations.js`
**Action:** Rename exportAnnotations to saveAnnotations or add alias
**Details:**
```javascript
// Option 1: Rename (breaking change if exportAnnotations is used elsewhere)
const saveAnnotations = useCallback(() => { ... }, [...])

// Option 2: Add alias (non-breaking)
return {
  // ... existing returns
  saveAnnotations: exportAnnotations, // Alias for criteria compliance
  exportAnnotations, // Keep for backwards compatibility
}
```

### Verification Steps
1. Search codebase for `exportAnnotations` usage
2. If not used externally, rename to `saveAnnotations`
3. If used externally, add alias

### Potential Risks
- **Risk:** Breaking existing code using exportAnnotations
- **Mitigation:** Add alias rather than rename

---

## Issue 12: Firestore Token Check Location (Unable to Verify)

### Audit Finding
- **Status:** ❓ Unable to Verify
- **Criterion:** Checks Firestore sessionToken on heartbeat (for useDuplicateTabGuard)
- **Current State:** Token check is in useHeartbeat, not useDuplicateTabGuard

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useHeartbeat.js` (lines 46-51) - checks sessionToken
  - `src/apBoost/hooks/useDuplicateTabGuard.js` - receives sessionTakenOver from useHeartbeat
  - `src/apBoost/hooks/useTestSession.js` (line 55) - combines: `isInvalidated || sessionTakenOver`
- **Current Implementation:**
  - useHeartbeat checks Firestore sessionToken and sets `sessionTakenOver` flag
  - useDuplicateTabGuard handles BroadcastChannel for same-browser detection
  - useTestSession combines both signals into `isSessionInvalidated`
- **Gap:** None - this is working as designed

### Fix Plan

**No code changes needed.**

The current design correctly separates concerns:
- `useDuplicateTabGuard`: Handles same-browser tab detection via BroadcastChannel
- `useHeartbeat`: Handles cross-browser/device detection via Firestore token check
- `useTestSession`: Combines both into unified `isInvalidated` state

### Documentation Update
Consider updating acceptance criteria to clarify that Firestore token checking is handled by useHeartbeat, with the result consumed by the broader session invalidation logic.

---

## Implementation Order

Recommended order to implement fixes (considering dependencies):

1. **Issue 2: FLAG_TOGGLE handling** - Quick fix, unblocks flag persistence
2. **Issue 1: ANNOTATION_UPDATE handling** - Same pattern as flags, unblocks annotation persistence
3. **Issue 6: Visibility change flush** - Simple addition, improves resilience
4. **Issue 7: Heartbeat-triggered flush** - Improves resilience after network issues
5. **Issue 8: Opportunistic mode** - Enhances retry behavior
6. **Issue 3: HighlightRange validation** - Defensive improvement
7. **Issue 11: saveAnnotations naming** - Simple alias addition
8. **Issues 4, 5, 9, 10:** Documentation updates (criteria clarifications)
9. **Issue 12:** No action needed - working as designed

## Cross-Cutting Concerns

### Import Updates Needed
`src/apBoost/hooks/useOfflineQueue.js` will need:
```javascript
import { doc, updateDoc, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore'
```

### Consistent Queue Action Handling Pattern
When adding new action types to flushQueue, follow this pattern:
1. Check if action type needs special Firestore operations (arrays, nested objects)
2. Use appropriate Firestore methods (arrayUnion, arrayRemove, dot notation for nested)
3. Add to the updates object that gets written atomically
4. Handle edge cases (empty values, null checks)

## Notes for Implementer

1. **Test offline scenarios thoroughly** - The queue is critical for data integrity during network issues
2. **Watch for IndexedDB quota** - Long sessions with many annotations could accumulate data
3. **Consider queue size limits** - May want to add upper bound on queue length
4. **Monitor Firestore writes** - Batching helps but frequent flushes still cost quota
5. **Browser compatibility** - BroadcastChannel not in Safari <15.4, IndexedDB may have quirks in private browsing

## Summary by Priority

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| High | Issue 1: ANNOTATION_UPDATE | Medium | Critical - annotations lost |
| High | Issue 2: FLAG_TOGGLE | Low | Important - flags lost |
| Medium | Issue 6: Visibility flush | Low | Improves reliability |
| Medium | Issue 7: Heartbeat flush | Low | Improves reliability |
| Medium | Issue 8: Opportunistic mode | Medium | Improves retry |
| Low | Issue 3: HighlightRange type | Low | Defensive |
| Low | Issue 11: Function naming | Low | API consistency |
| None | Issues 4,5,9,10,12 | N/A | Documentation only |
