# CODEBASE_FACTS__UNK__16.1_to_16.6

**Generated:** 2026-01-14
**Chunk ID:** UNK__16.1_to_16.6
**Scope:** useOfflineQueue retry/backoff, Queue flush triggers, Navigation writes, Hook-to-hook integration, IndexedDB naming, Queue item lifecycle, useAnnotations API surface, Duplicate tab guard/session token checks

---

## 1) Canonical Data Schema / Source-of-Truth

**Found: Yes**

### 1.1 Firestore Session Document Schema

**File:** `src/apBoost/services/apSessionService.js` (lines 47-67)
**Collection:** `ap_session_state` (defined in `src/apBoost/utils/apTypes.js:94`)

```javascript
const sessionData = {
  userId,
  testId,
  assignmentId,
  sessionToken: generateSessionToken(),  // Unique token for duplicate tab detection
  status: SESSION_STATUS.IN_PROGRESS,
  attemptNumber,
  currentSectionIndex: 0,               // Navigation position
  currentQuestionIndex: 0,              // Navigation position
  sectionTimeRemaining: {},             // Timer state per section
  answers: {},                          // Keyed by questionId
  flaggedQuestions: [],                 // Array of questionIds
  annotations: {},                      // NOT USED IN CODE - placeholder
  strikethroughs: {},                   // NOT USED IN CODE - placeholder
  lastHeartbeat: serverTimestamp(),     // Heartbeat timestamp
  lastAction: serverTimestamp(),        // Last activity timestamp
  startedAt: serverTimestamp(),
  completedAt: null,
}
```

**Evidence for fields used in duplicate tab detection:**
- `sessionToken` - Written by `useDuplicateTabGuard.claimSession()` (line 34) and checked by `useHeartbeat.doHeartbeat()` (line 47)
- `lastHeartbeat` - Updated by heartbeat writes

**Evidence for navigation position fields:**
| Field | Set by | Location |
|-------|--------|----------|
| `currentSectionIndex` | Session creation | apSessionService.js:56 |
| `currentQuestionIndex` | Session creation | apSessionService.js:57 |
| `currentSubQuestionLabel` | **NOT STORED IN FIRESTORE** | Only local state in useTestSession.js:37 |

### 1.2 IndexedDB Queue Item Schema

**File:** `src/apBoost/hooks/useOfflineQueue.js` (lines 131-138)

```javascript
const queueItem = {
  id: generateId(),            // `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
  sessionId,                   // Current session ID
  localTimestamp: Date.now(),  // Client timestamp when queued
  action: action.action,       // Action type string (e.g., 'ANSWER_CHANGE', 'NAVIGATION')
  payload: action.payload,     // Action-specific data
  status: 'PENDING',           // Only status used - never changes
}
```

**Key findings:**
- **keyPath:** `'id'` (explicit, not autoIncrement) - useOfflineQueue.js:31
- **Indexes created:** `sessionId` (non-unique), `status` (non-unique) - lines 32-33
- **Status values implemented:** Only `'PENDING'` - set on creation, never modified

---

## 2) Write Paths

**Found: Yes**

### 2.1 Navigation Write Path

**File:** `src/apBoost/hooks/useTestSession.js`

| Function | Lines | Behavior |
|----------|-------|----------|
| `goToFlatIndex` | 242-260 | Updates local state, then calls `addToQueue({ action: 'NAVIGATION', ... })` |
| `goToQuestion` | 263-287 | Updates local state, then calls `addToQueue({ action: 'NAVIGATION', ... })` |
| `goNext` | 289-294 | Calls `goToFlatIndex` |
| `goPrevious` | 296-301 | Calls `goToFlatIndex` |

**Evidence (useTestSession.js:249-258):**
```javascript
// Queue position update
if (session?.id) {
  addToQueue({
    action: 'NAVIGATION',
    payload: {
      currentSectionIndex,
      currentQuestionIndex: item.questionIndex,
      currentSubQuestionLabel: item.subQuestionLabel
    }
  })
}
```

**Conclusion:** Navigation writes are **ALWAYS QUEUED** - there is no direct/immediate Firestore write for navigation. The `updatePosition` function from `apSessionService.js` is imported (line 9) but **NEVER CALLED** anywhere in useTestSession.js.

### 2.2 Answer Write Path

**File:** `src/apBoost/hooks/useTestSession.js` (lines 328-359)

```javascript
// setAnswer function
setAnswers(prev => { ... }) // Optimistic local update
addToQueue({
  action: 'ANSWER_CHANGE',
  payload: { questionId, value: answer, subQuestionLabel: position.subQuestionLabel }
})
```

**Conclusion:** Answers are queued, not written immediately.

### 2.3 Queue Flush Write Path

**File:** `src/apBoost/hooks/useOfflineQueue.js` (lines 172-266)

The `flushQueue` function:
1. Reads all PENDING items for sessionId from IndexedDB (lines 182-192)
2. Builds `updates` object from queued actions (lines 202-225)
3. Writes to Firestore via `updateDoc` (lines 231-235)
4. Deletes processed items from IndexedDB (lines 239-249)

**Action types handled in switch (lines 204-225):**
| Action | Handling |
|--------|----------|
| `ANSWER_CHANGE` | `updates[answers.${questionId}] = value` |
| `FLAG_TOGGLE` | Comment says "Flags need special handling" - **NOT IMPLEMENTED** |
| `NAVIGATION` | `updates.currentSectionIndex = ...`, `updates.currentQuestionIndex = ...` |
| `TIMER_SYNC` | `updates[sectionTimeRemaining.${sectionId}] = time` |
| `ANNOTATION_UPDATE` | **NOT IN SWITCH** - falls to default (no-op) |

**Evidence (lines 204-225):**
```javascript
switch (item.action) {
  case 'ANSWER_CHANGE':
    updates[`answers.${item.payload.questionId}`] = item.payload.value
    break
  case 'FLAG_TOGGLE':
    // Flags need special handling - we'd need to maintain the array
    break
  case 'NAVIGATION':
    updates.currentSectionIndex = item.payload.currentSectionIndex
    updates.currentQuestionIndex = item.payload.currentQuestionIndex
    break
  case 'TIMER_SYNC':
    // ... timer handling
    break
  default:
    break
}
```

### 2.4 Annotation Write Path

**File:** `src/apBoost/hooks/useAnnotations.js`

All annotation operations queue `ANNOTATION_UPDATE` actions:
- `addHighlight` (line 47)
- `removeHighlight` (line 65)
- `clearHighlights` (line 82)
- `toggleStrikethrough` (line 113)
- `clearStrikethroughs` (line 134)
- `clearAllAnnotations` (line 174)

**BUT:** These are **NOT PERSISTED** because `ANNOTATION_UPDATE` is not handled in `flushQueue` switch statement.

---

## 3) Offline/Resilience Mechanics

**Found: Yes**

### 3.1 Retry/Backoff Logic

**File:** `src/apBoost/hooks/useOfflineQueue.js` (lines 254-262)

```javascript
} catch (error) {
  logError('useOfflineQueue.flushQueue', { sessionId }, error)

  // Exponential backoff retry
  retryCountRef.current++
  if (retryCountRef.current < 5) {
    const delay = Math.pow(2, retryCountRef.current) * 1000 // 2s, 4s, 8s, 16s
    scheduleFlush(delay)
  }
} finally {
```

**Implementation details:**
| Aspect | Value | Evidence |
|--------|-------|----------|
| Retry threshold | **5 failures** (retries 0-4 = 5 attempts) | Line 259: `if (retryCountRef.current < 5)` |
| Backoff schedule | 2s, 4s, 8s, 16s | Line 260: `Math.pow(2, retryCountRef.current) * 1000` |
| After threshold | **STOPS TRYING** - no further action | No else branch, no error state |
| Opportunistic mode | **NOT IMPLEMENTED** | No `isOpportunisticMode` state exists |
| Reset on success | Yes | Line 251: `retryCountRef.current = 0` |

### 3.2 Flush Triggers Implemented

| Trigger | Implemented | Location | Evidence |
|---------|-------------|----------|----------|
| `online` event | **YES** | useOfflineQueue.js:86-91 | `window.addEventListener('online', handleOnline)` |
| `visibilitychange` | **NO** | useOfflineQueue.js | Not present in file |
| Heartbeat success | **NO** | useHeartbeat.js | No queue flush callback/integration |
| After addToQueue | **YES** (if online) | useOfflineQueue.js:153-156 | `if (isOnline) { scheduleFlush(1000) }` |
| `beforeunload` | **NO** | useOfflineQueue.js | Not present |
| `pagehide` | **NO** | useOfflineQueue.js | Not present |

**Evidence for online handler (lines 86-91):**
```javascript
const handleOnline = () => {
  setIsOnline(true)
  retryCountRef.current = 0
  // Try to flush when we come back online
  scheduleFlush(1000)
}
```

**Evidence that visibilitychange only exists in useHeartbeat (useHeartbeat.js:101-113):**
```javascript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && sessionId && instanceToken) {
      doHeartbeat()  // Only triggers heartbeat, NOT queue flush
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)
  // ...
}, [sessionId, instanceToken, doHeartbeat])
```

### 3.3 Flush Guards

**File:** `src/apBoost/hooks/useOfflineQueue.js` (lines 173-176)

```javascript
const flushQueue = useCallback(async () => {
  if (!dbRef.current || !sessionId || isFlushing || !isOnline) {
    return
  }
```

Guards implemented:
- `!dbRef.current` - DB not initialized
- `!sessionId` - No session
- `isFlushing` - **Re-entrancy guard present**
- `!isOnline` - Offline check

### 3.4 IndexedDB Database Name

**File:** `src/apBoost/hooks/useOfflineQueue.js` (lines 8-11)

```javascript
const DB_NAME = 'ap_boost_queue'
const STORE_NAME = 'actions'
const DB_VERSION = 1
```

**Migration/compat logic:** **NOT FOUND** - No code checking for old database names or migrating data.

### 3.5 Queue Item Lifecycle

| Status | Used | Evidence |
|--------|------|----------|
| `PENDING` | **YES** | Set on creation (line 137), filtered for flush (line 192) |
| `CONFIRMED` | **NO** | Not present anywhere in codebase |

**Deletion behavior (lines 238-249):**
```javascript
// Mark items as confirmed and delete
const deleteTx = dbRef.current.transaction(STORE_NAME, 'readwrite')
const deleteStore = deleteTx.objectStore(STORE_NAME)

for (const item of pendingItems) {
  deleteStore.delete(item.id)  // Direct delete, no CONFIRMED status
}
```

**Conclusion:** Items go directly from `PENDING` → **deleted** (no intermediate CONFIRMED state).

---

## 4) UI/Flow Entry Points

**Found: Yes**

### 4.1 useTestSession Integration

**File:** `src/apBoost/hooks/useTestSession.js`

**Hook composition (lines 49-55):**
```javascript
// Resilience hooks
const { addToQueue, flushQueue, queueLength, isOnline, isFlushing } = useOfflineQueue(session?.id)
const { instanceToken, isInvalidated, takeControl } = useDuplicateTabGuard(session?.id)
const { isConnected, failureCount, sessionTakenOver } = useHeartbeat(session?.id, instanceToken)

// Combined invalidation check
const isSessionInvalidated = isInvalidated || sessionTakenOver
```

**User actions that trigger addToQueue:**
| Action | Handler | Lines | Queue Action |
|--------|---------|-------|--------------|
| Answer change | `setAnswer` | 328-359 | `ANSWER_CHANGE` |
| Flag toggle | `toggleFlag` | 361-383 | `FLAG_TOGGLE` |
| Navigation | `goToFlatIndex` | 242-260 | `NAVIGATION` |
| Navigation | `goToQuestion` | 263-287 | `NAVIGATION` |
| Timer tick (every 30s) | `handleTimerTick` | 142-150 | `TIMER_SYNC` |

### 4.2 useHeartbeat Flow

**File:** `src/apBoost/hooks/useHeartbeat.js`

| Parameter | Value | Evidence |
|-----------|-------|----------|
| Interval | **15 seconds** | Line 9: `const HEARTBEAT_INTERVAL = 15000` |
| Max failures | **3** | Line 10: `const MAX_FAILURES = 3` |
| Initial heartbeat | **On mount** | Line 87: `doHeartbeat()` |
| Visibility heartbeat | **On tab visible** | Lines 101-113 |

**Heartbeat success behavior (lines 63-67):**
```javascript
// Success
setIsConnected(true)
setFailureCount(0)
setLastHeartbeat(new Date())
logDebug('useHeartbeat.doHeartbeat', 'Heartbeat successful')
// NO queue flush callback/integration
```

### 4.3 Duplicate Tab Detection Flow

**File:** `src/apBoost/hooks/useDuplicateTabGuard.js`

**BroadcastChannel usage (lines 70-101):**
1. Creates channel: `new BroadcastChannel(\`ap_session_${sessionId}\`)`
2. Listens for `SESSION_CLAIMED` messages from other tabs
3. On mount (after 500ms delay): posts `SESSION_CLAIMED` and calls `claimSession()`
4. On `SESSION_CLAIMED` from other tab with different token: sets `isInvalidated = true`

**Session invalidation propagation:**
| Source | State Variable | Set By |
|--------|---------------|--------|
| BroadcastChannel | `isInvalidated` | useDuplicateTabGuard.js:79 |
| Firestore token mismatch | `sessionTakenOver` | useHeartbeat.js:49 |
| Combined in useTestSession | `isSessionInvalidated` | useTestSession.js:55 |

---

## 5) Must-Answer Questions

### Q1: Retry limit and backoff schedule

**Found: Yes**

**File:** `src/apBoost/hooks/useOfflineQueue.js` (lines 257-262)

- **Retry limit:** 5 attempts (retries 0-4)
- **Backoff schedule:** `Math.pow(2, retryCountRef.current) * 1000` = 2s, 4s, 8s, 16s
- **After 5 failures:** Stops retrying, no further action taken

```javascript
retryCountRef.current++
if (retryCountRef.current < 5) {
  const delay = Math.pow(2, retryCountRef.current) * 1000 // 2s, 4s, 8s, 16s
  scheduleFlush(delay)
}
// No else branch - just stops
```

---

### Q2: Opportunistic mode implementation

**Found: No**

**NOT IMPLEMENTED** - No `isOpportunisticMode` state, ref, or equivalent exists in `useOfflineQueue.js`.

Searched for:
- `isOpportunisticMode` - Not found in hooks
- `setIsOpportunistic` - Not found in hooks
- Any "gave up" state indicator - Not found

The hook simply stops retrying after 5 failures with no state indicating this condition.

---

### Q3: Flush triggers

**Found: Yes**

| Trigger | Status | Evidence |
|---------|--------|----------|
| `online` event | **IMPLEMENTED** | useOfflineQueue.js:97: `window.addEventListener('online', handleOnline)` |
| `visibilitychange` | **NOT IMPLEMENTED** | Not present in useOfflineQueue.js |
| Heartbeat success | **NOT IMPLEMENTED** | useHeartbeat.js has no queue flush integration |
| `beforeunload` | **NOT IMPLEMENTED** | Not in useOfflineQueue.js (only in useTestSession.js for warning) |
| `pagehide` | **NOT IMPLEMENTED** | Not present anywhere |
| After addToQueue (if online) | **IMPLEMENTED** | useOfflineQueue.js:153-156 |

---

### Q4: useHeartbeat → queue flush integration

**Found: No**

**NOT IMPLEMENTED** - useHeartbeat has no mechanism to trigger queue flush on success.

**Evidence (useHeartbeat.js:63-67):**
```javascript
// Success
setIsConnected(true)
setFailureCount(0)
setLastHeartbeat(new Date())
logDebug('useHeartbeat.doHeartbeat', 'Heartbeat successful')
// No callback, no shared context access, no event emission
```

**Separation evidence:**
- useHeartbeat does not import useOfflineQueue or any queue functions
- useHeartbeat does not accept a callback parameter for success
- useHeartbeat returns only: `isConnected`, `failureCount`, `lastHeartbeat`, `sessionTakenOver`, `reconnect`

---

### Q5: Navigation immediate vs queued

**Found: Yes - QUEUED ONLY**

Navigation handlers **do NOT** write immediately to Firestore. They only call `addToQueue`.

**Evidence (useTestSession.js):**

1. `updatePosition` is imported (line 9) but **never called**:
```javascript
import {
  createOrResumeSession,
  getActiveSession,
  saveAnswer as saveAnswerToFirestore,
  toggleQuestionFlag,
  updatePosition,  // Imported but NEVER used
  updateTimer,
} from '../services/apSessionService'
```

2. Grep for `updatePosition(` in useTestSession.js: **0 matches** (excluding import)

3. All navigation functions use `addToQueue`:
   - goToFlatIndex (line 251): `addToQueue({ action: 'NAVIGATION', ... })`
   - goToQuestion (line 282): `addToQueue({ action: 'NAVIGATION', ... })`

---

### Q6: IndexedDB database name

**Found: Yes**

**File:** `src/apBoost/hooks/useOfflineQueue.js` (lines 8-10)

```javascript
const DB_NAME = 'ap_boost_queue'
const STORE_NAME = 'actions'
const DB_VERSION = 1
```

**Migration/compat for old DB names:** **NOT FOUND**

Searched:
- `indexedDB.databases` - Not in hooks
- `migrateFromOld` - Not found
- `ap_action_queue` - Not present in implementation code (only in audit docs)

---

### Q7: IndexedDB store name and key strategy

**Found: Yes**

**File:** `src/apBoost/hooks/useOfflineQueue.js` (lines 28-34)

```javascript
request.onupgradeneeded = (event) => {
  const db = event.target.result
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
    store.createIndex('sessionId', 'sessionId', { unique: false })
    store.createIndex('status', 'status', { unique: false })
  }
}
```

| Aspect | Value |
|--------|-------|
| Store name | `'actions'` |
| Key strategy | **Explicit id** via `keyPath: 'id'` (NOT autoIncrement) |
| ID format | `${Date.now()}-${Math.random().toString(36).substring(2, 15)}` (line 43) |
| Indexes | `sessionId`, `status` |

**Enumeration for flush (lines 182-192):**
```javascript
const tx = dbRef.current.transaction(STORE_NAME, 'readonly')
const store = tx.objectStore(STORE_NAME)
const index = store.index('sessionId')
const request = index.getAll(IDBKeyRange.only(sessionId))
// ...
const pendingItems = items.filter(item => item.status === 'PENDING')
```

---

### Q8: Queue item status flow

**Found: Yes**

**Actual flow:** `PENDING` → **deleted** (no CONFIRMED state)

**Evidence:**
1. Status set on creation (line 137): `status: 'PENDING'`
2. Items filtered by status (line 192): `items.filter(item => item.status === 'PENDING')`
3. On success, direct delete (lines 242-244):
```javascript
for (const item of pendingItems) {
  deleteStore.delete(item.id)
}
```

**CONFIRMED status:** `grep -r "CONFIRMED" src/apBoost/hooks/` returns **NO MATCHES**

---

### Q9: useAnnotations saveAnnotations() function

**Found: No - NOT EXPORTED**

**File:** `src/apBoost/hooks/useAnnotations.js` (lines 225-255)

**Returned API surface:**
```javascript
return {
  // Highlights
  highlights,
  addHighlight,
  removeHighlight,
  clearHighlights,
  getHighlights,
  highlightColor,
  setHighlightColor,

  // Strikethroughs
  strikethroughs,
  toggleStrikethrough,
  getStrikethroughs,
  clearStrikethroughs,

  // Line reader
  lineReaderEnabled, lineReaderPosition, lineReaderLines,
  toggleLineReader, moveLineReader, moveLineReaderUp, moveLineReaderDown, setVisibleLines,

  // General
  clearAllAnnotations,
  loadAnnotations,
  exportAnnotations,  // NOT saveAnnotations
}
```

**How annotations persist:**
- Each annotation operation (addHighlight, toggleStrikethrough, etc.) calls `addToQueue({ action: 'ANNOTATION_UPDATE', payload: {...} })`
- These are queued to IndexedDB
- **BUT** they are never written to Firestore because `ANNOTATION_UPDATE` is not handled in `flushQueue` switch

---

### Q10: Session token check location

**Found: Yes**

**Dual-layer implementation:**

**Layer 1: BroadcastChannel (same browser)**
**File:** `src/apBoost/hooks/useDuplicateTabGuard.js` (lines 76-81)

```javascript
channelRef.current.onmessage = (event) => {
  if (event.data.type === 'SESSION_CLAIMED' && event.data.token !== instanceToken) {
    logDebug('useDuplicateTabGuard', 'Another tab claimed session', event.data)
    setIsInvalidated(true)
  }
}
```

**Layer 2: Firestore sessionToken (cross-browser/device)**
**File:** `src/apBoost/hooks/useHeartbeat.js` (lines 46-51)

```javascript
// Check if another tab took over
if (sessionData.sessionToken && sessionData.sessionToken !== instanceToken) {
  logDebug('useHeartbeat.doHeartbeat', 'Session taken over by another instance')
  setSessionTakenOver(true)
  return
}
```

**Invalidation propagation to UI:**
**File:** `src/apBoost/hooks/useTestSession.js` (lines 51-55)

```javascript
const { instanceToken, isInvalidated, takeControl } = useDuplicateTabGuard(session?.id)
const { isConnected, failureCount, sessionTakenOver } = useHeartbeat(session?.id, instanceToken)

// Combined invalidation check
const isSessionInvalidated = isInvalidated || sessionTakenOver
```

Then exposed in return (line 504): `isInvalidated: isSessionInvalidated`

---

## Summary Table

| Topic | Status | Key Finding |
|-------|--------|-------------|
| Retry limit | 5 attempts | `retryCountRef.current < 5` |
| Backoff | 2s, 4s, 8s, 16s | `Math.pow(2, count) * 1000` |
| Opportunistic mode | **NOT IMPLEMENTED** | No state for "gave up" |
| `online` flush trigger | **IMPLEMENTED** | useOfflineQueue.js:97 |
| `visibilitychange` flush | **NOT IMPLEMENTED** | Only in useHeartbeat for heartbeat |
| Heartbeat → flush | **NOT IMPLEMENTED** | No integration |
| Navigation writes | **QUEUED ONLY** | `updatePosition` never called |
| DB name | `ap_boost_queue` | Line 9 |
| Store name | `actions` | Line 10 |
| Key strategy | Explicit `keyPath: 'id'` | Line 31 |
| CONFIRMED status | **NOT IMPLEMENTED** | Direct delete on success |
| `saveAnnotations()` | **NOT EXPORTED** | Has `exportAnnotations` instead |
| ANNOTATION_UPDATE handling | **NOT IMPLEMENTED** | Missing from flushQueue switch |
| Session token check | **DUAL: BroadcastChannel + Firestore** | useDuplicateTabGuard + useHeartbeat |

---

## Files Referenced

| File | Lines Used |
|------|------------|
| src/apBoost/hooks/useOfflineQueue.js | 1-287 (full file) |
| src/apBoost/hooks/useTestSession.js | 1-513 (full file) |
| src/apBoost/hooks/useHeartbeat.js | 1-132 (full file) |
| src/apBoost/hooks/useAnnotations.js | 1-259 (full file) |
| src/apBoost/hooks/useDuplicateTabGuard.js | 1-136 (full file) |
| src/apBoost/services/apSessionService.js | 1-268 (full file) |
| src/apBoost/utils/apTypes.js | 89-98 (COLLECTIONS) |
