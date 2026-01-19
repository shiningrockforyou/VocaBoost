# Fix Plan: Sections 5.1 to 5.5

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_5.1_to_5.5_criteria_audit.md

## Executive Summary
- Total Issues: 20
- ⚠️ Partial Implementations: 12
- ❌ Missing Features: 7
- ❓ Needs Investigation: 1
- Estimated Complexity: **Medium-High**

The issues center around three main themes:
1. **Debounce timing** - Uses 1s instead of 2-3s across all actions
2. **Immediate vs debounced writes** - Navigation/section complete should bypass queue
3. **Missing integrations** - Heartbeat and queue don't communicate for recovery

---

## Issue 1: Debounce Timing (1s vs 2-3s)

### Audit Finding
- **Status:** ⚠️ Partial (4 criteria affected)
- **Criteria:**
  - Answer change: debounced write (2-3s batch)
  - Flag toggle: debounced write (2-3s batch)
  - Annotation: debounced write (2-3s batch)
  - Strikethrough: debounced write (2-3s batch)
- **Current State:** All use 1000ms (1 second) debounce

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` (line 155) - `scheduleFlush(1000)`
  - `src/apBoost/hooks/useOfflineQueue.js` (line 90) - Online handler also uses 1000ms
- **Current Implementation:** Single hardcoded 1000ms delay
- **Gap:** Spec requires 2000-3000ms for reduced Firestore writes
- **Dependencies:** All components using `addToQueue` inherit this behavior

### Fix Plan

#### Step 1: Create debounce timing constant
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Add constant at top of file
**Details:**
- Add `const DEBOUNCE_DELAY = 2500` (middle of 2-3s range)
- This centralizes the timing for easy adjustment later

#### Step 2: Update scheduleFlush calls
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Modify lines 90, 155
**Details:**
- Line 90: Change `scheduleFlush(1000)` to `scheduleFlush(DEBOUNCE_DELAY)`
- Line 155: Change `scheduleFlush(1000)` to `scheduleFlush(DEBOUNCE_DELAY)`

### Verification Steps
1. Add an answer, wait - Firestore write should occur after ~2.5s
2. Make multiple rapid answer changes - should batch into single write
3. Toggle flag, verify same 2.5s debounce behavior

### Potential Risks
- **User perception:** 2.5s delay might feel less responsive (mitigate: optimistic UI already in place)
- **Data loss window:** Larger window if browser crashes (mitigate: IndexedDB queue persists data)

---

## Issue 2: Question Navigation Should Be Immediate Write

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Question navigation: immediate write
- **Current State:** Navigation goes through `addToQueue` with 1s debounce (line 249-259)

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useTestSession.js` (lines 249-259, 280-287) - `goToFlatIndex` and `goToQuestion`
  - `src/apBoost/hooks/useOfflineQueue.js` (lines 173-266) - `flushQueue` handles NAVIGATION
  - `src/apBoost/services/apSessionService.js` (lines 185-196) - `updatePosition` direct Firestore write
- **Current Implementation:** Navigation calls `addToQueue` → debounced flush
- **Gap:** If user closes browser during debounce, resume position may be stale
- **Dependencies:** `updatePosition` already exists in apSessionService

### Fix Plan

#### Step 1: Add immediate write option to queue hook
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Modify `addToQueue` function signature
**Details:**
- Change signature to `addToQueue(action, { immediate = false } = {})`
- If `immediate` is true, call `flushQueue()` immediately after adding

```javascript
const addToQueue = useCallback(async (action, { immediate = false } = {}) => {
  // ... existing code to add to queue ...

  if (isOnline) {
    if (immediate) {
      await flushQueue() // Immediate flush
    } else {
      scheduleFlush(DEBOUNCE_DELAY)
    }
  }
}, [/* deps */])
```

#### Step 2: Update navigation calls to use immediate
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify `goToFlatIndex` (lines 249-259) and `goToQuestion` (lines 280-287)
**Details:**
- Change `addToQueue({ action: 'NAVIGATION', ... })`
- To `addToQueue({ action: 'NAVIGATION', ... }, { immediate: true })`

### Verification Steps
1. Navigate to a question, immediately close browser
2. Reopen - should resume at exact position
3. Check Firestore - position update should appear immediately (not after 2.5s)

### Potential Risks
- **More Firestore writes:** Navigation generates more writes than batched approach
- **Mitigation:** Navigation is less frequent than answer typing, acceptable tradeoff

---

## Issue 3: Section Complete Should Be Immediate Write

### Audit Finding
- **Status:** ❓ Unable to Verify
- **Criterion:** Section complete: immediate write
- **Current State:** `submitSection` only updates local state (lines 385-393)

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useTestSession.js` (lines 385-393) - `submitSection` function
  - `src/apBoost/services/apSessionService.js` - No section complete function exists
- **Current Implementation:** Only increments `currentSectionIndex` in React state
- **Gap:** No Firestore write at all - section completion not persisted
- **Dependencies:** Would need new action type and queue handler

### Fix Plan

#### Step 1: Add SECTION_COMPLETE to queue handler
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Add case in switch statement (after line 221)
**Details:**
```javascript
case 'SECTION_COMPLETE':
  updates.currentSectionIndex = item.payload.sectionIndex
  updates.currentQuestionIndex = 0
  if (item.payload.completedSections) {
    updates.completedSections = item.payload.completedSections
  }
  break
```

#### Step 2: Update submitSection to queue immediate write
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify `submitSection` function (lines 385-393)
**Details:**
```javascript
const submitSection = useCallback(async () => {
  if (currentSectionIndex < (test?.sections?.length || 1) - 1) {
    const newIndex = currentSectionIndex + 1
    setCurrentSectionIndex(newIndex)
    setCurrentQuestionIndex(0)

    // Queue immediate write for section completion
    if (session?.id) {
      addToQueue({
        action: 'SECTION_COMPLETE',
        payload: {
          sectionIndex: newIndex,
          completedSections: currentSectionIndex + 1
        }
      }, { immediate: true })
    }
  }
}, [currentSectionIndex, test?.sections?.length, session?.id, addToQueue])
```

### Verification Steps
1. Complete a section, close browser immediately
2. Resume - should be on new section, not previous one
3. Verify `completedSections` field appears in Firestore

### Potential Risks
- **Schema change:** Adding `completedSections` field (low risk, additive)

---

## Issue 4: beforeunload Should Set Status to PAUSED

### Audit Finding
- **Status:** ❌ Missing (CRITICAL)
- **Criterion:** beforeunload: set status -> PAUSED immediately
- **Current State:** Only shows warning dialog (lines 208-220)

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useTestSession.js` (lines 208-220) - `handleBeforeUnload`
  - `src/apBoost/services/apSessionService.js` (line 14) - `SESSION_STATUS.PAUSED` constant
  - `src/apBoost/utils/apTypes.js` (line 37) - `PAUSED: 'PAUSED'` defined but never used
- **Current Implementation:** `e.preventDefault()` + `e.returnValue` warning
- **Gap:** Session stays IN_PROGRESS forever if browser closes; resume logic may fail
- **Dependencies:** Resume flow in `getActiveSession` queries for IN_PROGRESS only

### Fix Plan

#### Step 1: Use sendBeacon for guaranteed delivery
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify `handleBeforeUnload` (lines 208-220)
**Details:**
- sendBeacon is designed for beforeunload - fires even if page closes
- Need to send to a Cloud Function endpoint (can't do Firestore directly)

```javascript
const handleBeforeUnload = (e) => {
  // Always try to set PAUSED status via sendBeacon
  if (session?.id) {
    const payload = JSON.stringify({
      sessionId: session.id,
      status: SESSION_STATUS.PAUSED,
      timestamp: Date.now()
    })
    navigator.sendBeacon('/api/ap/pauseSession', payload)
  }

  // Show warning if queue has items
  if (queueLength > 0) {
    e.preventDefault()
    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
    return e.returnValue
  }
}
```

#### Step 2: Create Cloud Function endpoint
**File:** `functions/index.js` (or new file `functions/apSession.js`)
**Action:** Add HTTP endpoint
**Details:**
```javascript
exports.pauseSession = functions.https.onRequest(async (req, res) => {
  const { sessionId, status } = req.body
  if (!sessionId) return res.status(400).send('Missing sessionId')

  await admin.firestore()
    .collection('ap_session_state')
    .doc(sessionId)
    .update({
      status: status,
      lastAction: admin.firestore.FieldValue.serverTimestamp()
    })

  res.status(200).send('OK')
})
```

#### Step 3: Update getActiveSession to include PAUSED status
**File:** `src/apBoost/services/apSessionService.js`
**Action:** Modify query (lines 84-103)
**Details:**
- Change from `where('status', '==', SESSION_STATUS.IN_PROGRESS)`
- To `where('status', 'in', [SESSION_STATUS.IN_PROGRESS, SESSION_STATUS.PAUSED])`

### Verification Steps
1. Start test, close browser tab
2. Check Firestore - session should have status: 'PAUSED'
3. Reopen test - should resume correctly

### Potential Risks
- **Cloud Function required:** Adds deployment step
- **sendBeacon reliability:** Not 100% guaranteed but best available option
- **Alternative:** Also set PAUSED on visibilitychange='hidden' as backup

---

## Issue 5: Missing Action Type Handlers in Queue

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Action types: ANSWER_CHANGE, FLAG_TOGGLE, ANNOTATION_ADD, ANNOTATION_REMOVE, STRIKETHROUGH_TOGGLE, NAVIGATION, SECTION_COMPLETE, TIMER_SYNC, SESSION_PAUSE, SESSION_SUBMIT
- **Current State:** Only handles ANSWER_CHANGE, FLAG_TOGGLE (partial), NAVIGATION, TIMER_SYNC

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` (lines 204-224) - switch statement
- **Current Implementation:**
  - ANSWER_CHANGE: ✅
  - FLAG_TOGGLE: ⚠️ Comment says "needs special handling"
  - NAVIGATION: ✅
  - TIMER_SYNC: ✅
- **Gap:** Missing: ANNOTATION_ADD, ANNOTATION_REMOVE, STRIKETHROUGH_TOGGLE, SECTION_COMPLETE, SESSION_PAUSE, SESSION_SUBMIT
- **Dependencies:** Session schema in apTypes.js supports annotations and strikethroughs

### Fix Plan

#### Step 1: Fix FLAG_TOGGLE handler
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Replace incomplete handler (lines 209-211)
**Details:**
```javascript
case 'FLAG_TOGGLE':
  // Collect all flag changes, apply in order
  if (!updates.flaggedQuestions) {
    updates.flaggedQuestions = []
    updates._flagOperations = []
  }
  updates._flagOperations.push({
    questionId: item.payload.questionId,
    flagged: item.payload.markedForReview
  })
  break
```

Then after the loop, apply flag operations:
```javascript
// Apply flag operations
if (updates._flagOperations) {
  // Need to read current flags first or track locally
  // For now, track flags locally in queue state
  delete updates._flagOperations
}
```

**Note:** Flag handling is complex - may need to read current state from Firestore first. Alternative: Track flags as a Set client-side and replace entire array.

#### Step 2: Add annotation handlers
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Add cases after TIMER_SYNC
**Details:**
```javascript
case 'ANNOTATION_ADD':
  // Annotations stored as { questionId: [{ id, text, startOffset, endOffset }] }
  updates[`annotations.${item.payload.questionId}`] = item.payload.annotations
  break

case 'ANNOTATION_REMOVE':
  updates[`annotations.${item.payload.questionId}`] = item.payload.annotations
  break

case 'STRIKETHROUGH_TOGGLE':
  // Strikethroughs stored as { questionId: { choiceIndex: boolean } }
  updates[`strikethroughs.${item.payload.questionId}.${item.payload.choiceIndex}`] =
    item.payload.struckThrough
  break
```

#### Step 3: Add session state handlers
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Add cases for session control
**Details:**
```javascript
case 'SECTION_COMPLETE':
  updates.currentSectionIndex = item.payload.sectionIndex
  updates.currentQuestionIndex = 0
  break

case 'SESSION_PAUSE':
  updates.status = 'PAUSED'
  break

case 'SESSION_SUBMIT':
  updates.status = 'COMPLETED'
  updates.completedAt = serverTimestamp()
  break
```

### Verification Steps
1. Add annotation, verify it persists after flush
2. Toggle strikethrough, verify persisted
3. Add/remove flags, verify array updates correctly

### Potential Risks
- **Flag array race condition:** Multiple flag toggles may overwrite each other
- **Mitigation:** Use arrayUnion/arrayRemove in Firestore instead of full replacement

---

## Issue 6: Queue Status Flow Missing CONFIRMED Step

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Status flow: PENDING -> CONFIRMED -> deleted
- **Current State:** Items go PENDING -> deleted (no CONFIRMED)

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` (lines 238-249) - Items deleted immediately after write
- **Current Implementation:** Direct delete after successful Firestore write
- **Gap:** No intermediate CONFIRMED status for debugging/recovery
- **Dependencies:** None - this is an internal implementation detail

### Fix Plan

#### Step 1: Add CONFIRMED status update before delete
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Modify flush success handling (lines 238-249)
**Details:**
```javascript
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
const deleteStore = deleteTx.objectStore(STORE_NAME)

for (const item of pendingItems) {
  deleteStore.delete(item.id)
}
```

**Note:** This adds latency. Consider making this optional/debug-only.

### Verification Steps
1. Add browser DevTools breakpoint between CONFIRMED and delete
2. Verify items have status='CONFIRMED' before deletion

### Potential Risks
- **Performance:** Double transaction adds latency
- **Mitigation:** Could be made conditional on debug flag; current flow works fine

**Recommendation:** LOW PRIORITY - current implementation is acceptable

---

## Issue 7: Database Name Mismatch

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** IndexedDB database name: ap_action_queue
- **Current State:** Database named `ap_boost_queue`

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` (line 9) - `DB_NAME = 'ap_boost_queue'`
- **Current Implementation:** Uses `ap_boost_queue`
- **Gap:** Spec says `ap_action_queue`
- **Dependencies:** Migration would be needed if renaming

### Fix Plan

#### Option A: Update spec to match implementation (RECOMMENDED)
- Update acceptance criteria to reflect `ap_boost_queue`
- No code changes needed
- Avoids migration complexity

#### Option B: Rename database
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Change constant and add migration
**Details:**
- Change `const DB_NAME = 'ap_boost_queue'` to `const DB_NAME = 'ap_action_queue'`
- Add migration to copy data from old DB to new
- Complex and error-prone for minimal benefit

### Verification Steps
1. If Option A: Update spec document
2. If Option B: Verify data persists across rename

### Potential Risks
- **Data loss:** If Option B done incorrectly, queue data could be lost
- **Recommendation:** Option A - update spec, not code

---

## Issue 8: Opportunistic Retry Mode Not Implemented

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** After backoff exhausted, retry on: Any user action
- **Current State:** After 5 retries, stops trying until online event

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` (lines 257-262) - Retry logic
- **Current Implementation:**
  - Exponential backoff: 2s, 4s, 8s, 16s (4 retries)
  - After 5 failures, stops scheduling retries
  - Only resumes on `online` event
- **Gap:** Should enter "opportunistic mode" and retry on any user action
- **Dependencies:** Would need to expose a `retryNow` method

### Fix Plan

#### Step 1: Add opportunistic mode state
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Add state and ref
**Details:**
```javascript
const [isOpportunisticMode, setIsOpportunisticMode] = useState(false)
```

#### Step 2: Enter opportunistic mode after backoff exhausted
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Modify retry logic (lines 257-262)
**Details:**
```javascript
retryCountRef.current++
if (retryCountRef.current < 5) {
  const delay = Math.pow(2, retryCountRef.current) * 1000
  scheduleFlush(delay)
} else {
  // Enter opportunistic mode
  setIsOpportunisticMode(true)
}
```

#### Step 3: Trigger flush on user actions during opportunistic mode
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Modify `addToQueue` to check opportunistic mode
**Details:**
```javascript
if (isOnline) {
  scheduleFlush(DEBOUNCE_DELAY)
} else if (isOpportunisticMode) {
  // In opportunistic mode, try flush on any action
  scheduleFlush(100) // Quick retry
}
```

#### Step 4: Return opportunistic mode state
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Add to return object
**Details:**
```javascript
return {
  addToQueue,
  flushQueue,
  queueLength,
  isOnline,
  isFlushing,
  isOpportunisticMode, // NEW
}
```

### Verification Steps
1. Disconnect network
2. Make changes until backoff exhausts
3. Make another change - should attempt flush
4. Reconnect - should succeed and exit opportunistic mode

### Potential Risks
- **Excessive retries:** User actions could trigger many failed retries
- **Mitigation:** Use debounce even in opportunistic mode

---

## Issue 9: Retry on Tab Focus (visibilitychange)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** After backoff exhausted, retry on: Tab gains focus (visibilitychange)
- **Current State:** No visibilitychange listener in useOfflineQueue

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useOfflineQueue.js` - No visibility handling
  - `src/apBoost/hooks/useHeartbeat.js` (lines 101-113) - Has visibilitychange but only for heartbeat
- **Current Implementation:** Queue only flushes on: add action, online event, scheduled retry
- **Gap:** Tab focus doesn't trigger flush attempt
- **Dependencies:** None

### Fix Plan

#### Step 1: Add visibilitychange listener
**File:** `src/apBoost/hooks/useOfflineQueue.js`
**Action:** Add new useEffect after online/offline listener
**Details:**
```javascript
// Listen for visibility change - flush when tab gains focus
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && isOnline && queueLength > 0) {
      // Reset retry count and attempt flush
      retryCountRef.current = 0
      setIsOpportunisticMode(false)
      scheduleFlush(500) // Quick flush after focus
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}, [isOnline, queueLength, scheduleFlush])
```

### Verification Steps
1. Add changes to queue
2. Switch to another tab
3. Switch back - queue should attempt flush
4. Verify in DevTools Network tab

### Potential Risks
- **Low:** Visibility change is infrequent; adds minimal overhead

---

## Issue 10: Heartbeat Success Should Trigger Queue Flush

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** After backoff exhausted, retry on: Heartbeat succeeds
- Also: On success: clear failure counter, attempt queue flush
- **Current State:** Heartbeat success clears counter but doesn't flush queue

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useHeartbeat.js` (lines 63-67) - Success handler
  - `src/apBoost/hooks/useOfflineQueue.js` - Has no connection to heartbeat
- **Current Implementation:** Heartbeat and queue are separate, non-communicating hooks
- **Gap:** Heartbeat can't trigger queue flush; no integration point
- **Dependencies:** Both hooks are used in useTestSession; could coordinate there

### Fix Plan

#### Option A: Add callback to useHeartbeat (RECOMMENDED)
**File:** `src/apBoost/hooks/useHeartbeat.js`
**Action:** Accept `onRecovery` callback
**Details:**

Step 1: Update function signature:
```javascript
export function useHeartbeat(sessionId, instanceToken, { onRecovery } = {}) {
```

Step 2: Call callback on recovery (line 63-67):
```javascript
// Success
setIsConnected(true)
setFailureCount(prev => {
  // If recovering from failures, trigger callback
  if (prev >= MAX_FAILURES && onRecovery) {
    onRecovery()
  }
  return 0
})
setLastHeartbeat(new Date())
```

#### Step 3: Connect in useTestSession
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Pass callback to useHeartbeat
**Details:**
```javascript
const { isConnected, failureCount, sessionTakenOver } = useHeartbeat(
  session?.id,
  instanceToken,
  { onRecovery: flushQueue }
)
```

### Verification Steps
1. Simulate connection failure (DevTools offline mode)
2. Wait for 3+ heartbeat failures (isConnected = false)
3. Reconnect - heartbeat succeeds
4. Verify queue flushes automatically

### Potential Risks
- **Circular dependency:** flushQueue defined after useHeartbeat call
- **Mitigation:** Use useCallback for flushQueue and pass ref

---

## Issue 11: Heartbeat Failure Retry Logic

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** On failure: increment failure counter, retry up to 2 times
- **Current State:** Counter increments continuously, no special retry logic

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useHeartbeat.js` (lines 68-77) - Failure handling
- **Current Implementation:** Just increments counter; interval continues regardless
- **Gap:** Spec implies first 2 failures should have special handling before "unstable" state
- **Dependencies:** `MAX_FAILURES = 3` already aligns with "after 3 failures" banner

### Fix Plan

#### Analysis
Looking at the spec more carefully:
- "retry up to 2 times" before showing banner
- "After 3 consecutive failures: show banner"

The current implementation achieves this:
- Failure 1: counter = 1
- Failure 2: counter = 2
- Failure 3: counter = 3 >= MAX_FAILURES → show banner

**This is actually CORRECTLY implemented.** The audit may have been too strict.

### Recommendation
No code changes needed. Update audit to mark as ✅ Implemented.

---

## Issue 12: Recovery Should Flush Queue and Hide Banner

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** On recovery: flush queued writes, hide banner
- **Current State:** Banner hides (isConnected = true), but queue not flushed

### Code Analysis
- Same as Issue 10 - heartbeat doesn't communicate with queue

### Fix Plan
Covered by Issue 10 fix (onRecovery callback).

---

## Issue 13: useHeartbeat Should Attempt Queue Flush on Success

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Automatically attempts queue flush on success
- **Current State:** No queue interaction in useHeartbeat

### Code Analysis
- Same as Issue 10

### Fix Plan
Covered by Issue 10 fix (onRecovery callback).

---

## Implementation Order

Recommended order to implement fixes (considering dependencies):

1. **Issue 1: Debounce Timing** - Simple constant change, no dependencies
2. **Issue 7: Database Name** - Decision point: update spec, not code
3. **Issue 2: Immediate Navigation Writes** - Foundation for immediate write pattern
4. **Issue 3: Section Complete Immediate Write** - Uses pattern from Issue 2
5. **Issue 5: Missing Action Type Handlers** - Needed before other features work
6. **Issue 8: Opportunistic Retry Mode** - Foundation for retry improvements
7. **Issue 9: Retry on Tab Focus** - Uses opportunistic mode
8. **Issue 10-13: Heartbeat-Queue Integration** - Requires queue patterns in place
9. **Issue 4: beforeunload PAUSED Status** - Requires Cloud Function, most complex
10. **Issue 6: CONFIRMED Status** - Low priority, optional

---

## Cross-Cutting Concerns

### 1. Queue Action Constants
Create a constants file for action types:
```javascript
// src/apBoost/utils/queueActions.js
export const QUEUE_ACTIONS = {
  ANSWER_CHANGE: 'ANSWER_CHANGE',
  FLAG_TOGGLE: 'FLAG_TOGGLE',
  ANNOTATION_ADD: 'ANNOTATION_ADD',
  ANNOTATION_REMOVE: 'ANNOTATION_REMOVE',
  STRIKETHROUGH_TOGGLE: 'STRIKETHROUGH_TOGGLE',
  NAVIGATION: 'NAVIGATION',
  SECTION_COMPLETE: 'SECTION_COMPLETE',
  TIMER_SYNC: 'TIMER_SYNC',
  SESSION_PAUSE: 'SESSION_PAUSE',
  SESSION_SUBMIT: 'SESSION_SUBMIT',
}
```

### 2. Firestore Array Operations
For FLAG_TOGGLE, consider using Firestore's arrayUnion/arrayRemove:
```javascript
import { arrayUnion, arrayRemove } from 'firebase/firestore'

// Instead of replacing entire array
updates.flaggedQuestions = arrayUnion(questionId)
// or
updates.flaggedQuestions = arrayRemove(questionId)
```

### 3. Error Boundary for Queue
Add error boundary around components that use queue to prevent crashes from corrupting queue state.

---

## Notes for Implementer

1. **Test offline scenarios** - Use Chrome DevTools Network tab to simulate offline
2. **Watch for race conditions** - Multiple quick navigations could cause issues
3. **Firestore costs** - Each immediate write is a document write; monitor usage
4. **Cloud Function for pauseSession** - Needs deployment; test locally with emulator first
5. **IndexedDB debugging** - Chrome DevTools → Application → IndexedDB → ap_boost_queue
6. **sendBeacon limitations** - Max ~64KB payload, keep session pause data minimal

---

*Fix plan completed 2026-01-14 by Claude Agent*
