# CODEBASE_FACTS__UNK__5.9_to_5.12

**Generated:** 2026-01-14
**Chunk Scope:** Offline queue persistence, session resume reconciliation, timer expiry, lifecycle events, quota handling, extended offline tracking

---

## Section 1: Canonical Data Schema / Source-of-Truth

**Found: Yes**

### Firestore Session Document Schema

**Collection:** `ap_session_state` (defined in `src/apBoost/utils/apTypes.js:94`)

**Evidence:** `src/apBoost/services/apSessionService.js` lines 47-67

```javascript
const sessionData = {
  userId,
  testId,
  assignmentId,
  sessionToken: generateSessionToken(),
  status: SESSION_STATUS.IN_PROGRESS,
  attemptNumber,
  currentSectionIndex: 0,
  currentQuestionIndex: 0,
  sectionTimeRemaining: {},
  answers: {},
  flaggedQuestions: [],
  annotations: {},
  strikethroughs: {},
  lastHeartbeat: serverTimestamp(),
  lastAction: serverTimestamp(),
  startedAt: serverTimestamp(),
  completedAt: null,
}
```

**Fields relevant to resume/timer/submission:**

| Field | Type | Purpose | Written Where |
|-------|------|---------|---------------|
| `status` | string | `IN_PROGRESS`, `PAUSED`, `COMPLETED`, `NOT_STARTED` | apSessionService.js:54, 225 |
| `lastAction` | serverTimestamp | Last user action timestamp | apSessionService.js:64, 116, 135, 171, 190, 209, 227 |
| `lastHeartbeat` | serverTimestamp | Last heartbeat ping | apSessionService.js:63, 261; useHeartbeat.js:56; useDuplicateTabGuard.js:35 |
| `sectionTimeRemaining` | object | Map of sectionId → seconds remaining | apSessionService.js:58, 208; useOfflineQueue.js:218 |
| `completedAt` | timestamp/null | When session was submitted | apSessionService.js:66, 226 |
| `sessionToken` | string | Unique tab identifier for duplicate detection | apSessionService.js:53; useHeartbeat.js:57; useDuplicateTabGuard.js:34 |

**SESSION_STATUS Constants:** `src/apBoost/utils/apTypes.js` lines 33-39
```javascript
export const SESSION_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
}
```

**Note:** `autoSubmitQueued` field does **NOT EXIST** in the current schema. Fix plans propose adding it.

### Firestore Collections

**Evidence:** `src/apBoost/utils/apTypes.js` lines 89-98
```javascript
export const COLLECTIONS = {
  TESTS: 'ap_tests',
  QUESTIONS: 'ap_questions',
  STIMULI: 'ap_stimuli',
  SESSION_STATE: 'ap_session_state',
  TEST_RESULTS: 'ap_test_results',
  CLASSES: 'ap_classes',
  ASSIGNMENTS: 'ap_assignments',
}
```

### Session Fields Read into UI/Hooks

**Evidence:** `src/apBoost/hooks/useTestSession.js` lines 176-195
```javascript
if (existingSession) {
  setSession(existingSession)
  setCurrentSectionIndex(existingSession.currentSectionIndex || 0)
  setCurrentQuestionIndex(existingSession.currentQuestionIndex || 0)
  // Restore answers
  const answersMap = new Map()
  if (existingSession.answers) {
    Object.entries(existingSession.answers).forEach(([qId, ans]) => {
      answersMap.set(qId, ans)
    })
  }
  setAnswers(answersMap)
  // Restore flags
  const flagsSet = new Set(existingSession.flaggedQuestions || [])
  setFlags(flagsSet)
}
```

---

## Section 2: Write Paths

**Found: Yes**

### Path 1: Queued Writes via IndexedDB (Primary Path)

**Entry:** `useOfflineQueue.addToQueue()`
**File:** `src/apBoost/hooks/useOfflineQueue.js` lines 125-160

**Queue Actions Supported:**
| Action | Payload | Firestore Update |
|--------|---------|------------------|
| `ANSWER_CHANGE` | `{ questionId, value }` | `answers.${questionId}` |
| `FLAG_TOGGLE` | `{ questionId, markedForReview }` | Comment says "needs special handling" - NOT actually applied |
| `NAVIGATION` | `{ currentSectionIndex, currentQuestionIndex }` | `currentSectionIndex`, `currentQuestionIndex` |
| `TIMER_SYNC` | `{ sectionTimeRemaining: { sectionId: time } }` | `sectionTimeRemaining.${sectionId}` |

**Flush Mechanism:**
- `flushQueue()` at lines 173-266
- Uses single `updateDoc()` - NOT batched writes or transactions
- Idempotency: Items deleted by `store.delete(item.id)` after successful flush (line 243)
- **Hazard:** FLAG_TOGGLE is queued but never processed in switch statement (line 209-210 is a comment only)

**Evidence - flushQueue implementation:** lines 201-236
```javascript
const updates = {}
for (const item of pendingItems) {
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
      // ...
      break
  }
}
if (Object.keys(updates).length > 0) {
  updates.lastAction = serverTimestamp()
  await withTimeout(
    updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), updates),
    TIMEOUTS.FIRESTORE_WRITE,
    'Queue flush'
  )
}
```

### Path 2: Direct Firestore Writes (Bypass Queue)

**Files and Functions:**

| Service Function | File:Lines | Firestore Method |
|-----------------|------------|------------------|
| `createOrResumeSession()` | apSessionService.js:30-76 | `setDoc()` |
| `updateSession()` | apSessionService.js:112-122 | `updateDoc()` |
| `saveAnswer()` | apSessionService.js:131-141 | `updateDoc()` |
| `toggleQuestionFlag()` | apSessionService.js:150-176 | `getDoc()` + `updateDoc()` (read-modify-write) |
| `updatePosition()` | apSessionService.js:185-196 | `updateDoc()` |
| `updateTimer()` | apSessionService.js:205-215 | `updateDoc()` |
| `completeSession()` | apSessionService.js:222-233 | `updateDoc()` |
| `updateHeartbeat()` | apSessionService.js:258-267 | `updateDoc()` |

**Important:** These direct service functions are **NOT CALLED** during normal test session. The imports exist in `useTestSession.js` lines 4-11 but are only used for:
- Initial session creation (`createOrResumeSession` at line 228)
- Flag service imports exist but not used (queue handles flags locally)

### Path 3: Submission Pipeline

**Entry:** `useTestSession.submitTest()` at lines 396-421

**Evidence:**
```javascript
const submitTest = useCallback(async (frqData = null) => {
  if (!session?.id || isSubmitting) return null
  try {
    setIsSubmitting(true)
    timer.pause()
    // Flush any pending changes first
    if (queueLength > 0) {
      await flushQueue()
    }
    const resultId = await createTestResult(session.id, frqData)
    return resultId
  } catch (err) { ... }
}, [session?.id, isSubmitting, timer, queueLength, flushQueue])
```

- **Flush-before-submit:** Yes, queue is flushed before creating result
- **Scoring service:** `createTestResult()` in `apScoringService.js:67-166` calls `completeSession()` to mark status

---

## Section 3: Offline/Resilience Mechanics

**Found: Partial (significant gaps)**

### IndexedDB Configuration

**Evidence:** `src/apBoost/hooks/useOfflineQueue.js` lines 8-11, 16-37

```javascript
const DB_NAME = 'ap_boost_queue'
const STORE_NAME = 'actions'
const DB_VERSION = 1

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    // ...
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('sessionId', 'sessionId', { unique: false })
        store.createIndex('status', 'status', { unique: false })
      }
    }
  })
}
```

| Property | Value |
|----------|-------|
| Database Name | `ap_boost_queue` |
| Store Name | `actions` |
| Key Path | `id` |
| Indexes | `sessionId` (non-unique), `status` (non-unique) |

### Queue Item Schema

**Evidence:** `src/apBoost/hooks/useOfflineQueue.js` lines 131-138

```javascript
const queueItem = {
  id: generateId(),           // `${Date.now()}-${random}`
  sessionId,
  localTimestamp: Date.now(),
  action: action.action,      // 'ANSWER_CHANGE' | 'FLAG_TOGGLE' | 'NAVIGATION' | 'TIMER_SYNC'
  payload: action.payload,
  status: 'PENDING',
}
```

| Field | Type | Purpose |
|-------|------|---------|
| `id` | string | Unique identifier, used as keyPath |
| `sessionId` | string | Foreign key to session |
| `localTimestamp` | number | `Date.now()` when queued |
| `action` | string | Action type enum |
| `payload` | object | Action-specific data |
| `status` | string | Always 'PENDING' (no other status used) |

### Queue Lifecycle

- **Created:** `addToQueue()` sets status to `'PENDING'`
- **Flushed:** `flushQueue()` filters for `status === 'PENDING'` then deletes items by `id`
- **No intermediate states:** Status never changes to 'APPLIED' or similar - items are deleted after flush

### Ordering Guarantees

**Evidence:** `src/apBoost/hooks/useOfflineQueue.js` lines 181-192

```javascript
const index = store.index('sessionId')
const request = index.getAll(IDBKeyRange.only(sessionId))
// ...
const pendingItems = items.filter(item => item.status === 'PENDING')
```

- **Order:** Items retrieved via `index.getAll()` - IndexedDB returns in insertion order by default
- **No explicit sort by localTimestamp** in flushQueue
- **Processing:** All pending items are merged into a single update object (last-write-wins within batch)

### Retry/Backoff Behavior

**Evidence:** `src/apBoost/hooks/useOfflineQueue.js` lines 254-262

```javascript
} catch (error) {
  logError('useOfflineQueue.flushQueue', { sessionId }, error)
  // Exponential backoff retry
  retryCountRef.current++
  if (retryCountRef.current < 5) {
    const delay = Math.pow(2, retryCountRef.current) * 1000 // 2s, 4s, 8s, 16s
    scheduleFlush(delay)
  }
}
```

| Retry | Delay |
|-------|-------|
| 1 | 2s |
| 2 | 4s |
| 3 | 8s |
| 4 | 16s |
| 5+ | **Stops retrying** |

**Triggers for flush:**
- `online` event (lines 86-91)
- After `addToQueue()` if online (lines 153-156) - 1s debounce
- No visibilitychange trigger in useOfflineQueue

### Lifecycle Events

| Event | File:Lines | Behavior |
|-------|------------|----------|
| `beforeunload` | useTestSession.js:209-220 | Shows warning if `queueLength > 0` |
| `beforeunload` | useDuplicateTabGuard.js:115-126 | Empty handler (comment says don't clear token) |
| `visibilitychange` | useHeartbeat.js:101-113 | Triggers heartbeat when tab becomes visible |
| `online` | useOfflineQueue.js:86-91 | Resets retry count, schedules flush |
| `offline` | useOfflineQueue.js:93-95 | Sets `isOnline` to false |
| `pagehide` | — | **NOT FOUND** |

**Evidence - beforeunload in useTestSession:**
```javascript
useEffect(() => {
  const handleBeforeUnload = (e) => {
    if (queueLength > 0) {
      e.preventDefault()
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
      return e.returnValue
    }
  }
  window.addEventListener('beforeunload', handleBeforeUnload)
  return () => window.removeEventListener('beforeunload', handleBeforeUnload)
}, [queueLength])
```

### Reconciliation on Resume

**NOT FOUND**

- `loadTestAndSession()` in useTestSession.js:161-206 loads Firestore session
- `useOfflineQueue` initializes and counts queue items (`updateQueueLength()`)
- **No comparison of `localTimestamp` vs `session.lastAction`**
- **No discard of stale queue items**

**Evidence of absence:** The `updateQueueLength` function only counts items:
```javascript
const updateQueueLength = useCallback(async () => {
  // ...
  const index = store.index('sessionId')
  const request = index.count(IDBKeyRange.only(sessionId))
  request.onsuccess = () => {
    setQueueLength(request.result)
  }
}, [sessionId])
```

### Quota Handling

**IndexedDB QuotaExceededError: NOT FOUND**

- `addToQueue()` has try/catch but no specific quota detection (lines 140-159)
- No `error.name === 'QuotaExceededError'` check
- No `error.code === 22` check

**Firestore resource-exhausted: NOT FOUND**

- `flushQueue()` catch block doesn't distinguish quota errors
- All errors treated the same - exponential backoff applied

### Extended Offline Duration Tracking

**NOT FOUND**

- No `offlineSince` state variable
- No `offlineDuration` tracking
- No UI escalation for extended offline periods

### IndexedDB Transaction Abort Handling

**NOT FOUND**

- No explicit transaction abort handlers
- No `resetDatabase()` function exists

---

## Section 4: UI/Flow Entry Points

**Found: Yes**

### ConnectionStatus Component

**File:** `src/apBoost/components/ConnectionStatus.jsx` (50 lines)

**Props:**
```javascript
export default function ConnectionStatus({ isConnected, isSyncing })
```

**States Displayed:**

| Condition | UI |
|-----------|-----|
| `isConnected && !isSyncing` | Returns `null` (hidden) |
| `isSyncing` | Blue info banner: "Syncing your progress..." with spinner |
| `!isConnected` | Yellow warning banner: "Connection unstable - your progress is being saved locally" |

**Props NOT currently supported:**
- `isStorageFull` - **NOT FOUND**
- `offlineDuration` - **NOT FOUND**
- `isQuotaExceeded` - **NOT FOUND**

**Usage in APTestSession.jsx:**
```javascript
<ConnectionStatus isConnected={isConnected} isSyncing={isSyncing} />
```

### DuplicateTabModal

**File:** `src/apBoost/components/DuplicateTabModal.jsx` (53 lines)

**Props:**
```javascript
export default function DuplicateTabModal({ onTakeControl, onGoToDashboard })
```

- Renders when `isInvalidated` is true in APTestSession.jsx (lines 362-367, 394-400)
- Modal with two buttons: "Go to Dashboard" and "Use This Tab"

### InstructionScreen

**File:** `src/apBoost/components/InstructionScreen.jsx` (94 lines)

**Props:**
```javascript
export default function InstructionScreen({ test, assignment, existingSession, onBegin, onCancel })
```

**Resume Detection:** line 19
```javascript
const isResuming = existingSession?.status === SESSION_STATUS.IN_PROGRESS
```

**Resume UI:** lines 66-73
```javascript
{isResuming && existingSession && (
  <div className="bg-info rounded-[--radius-alert] p-4 mb-6">
    <p className="text-info-text-strong text-sm">
      Resume from: Section {existingSession.currentSectionIndex + 1},
      Question {existingSession.currentQuestionIndex + 1}
    </p>
  </div>
)}
```

### View State Machine in APTestSession

**File:** `src/apBoost/pages/APTestSession.jsx` lines 44-45

```javascript
// View state: 'instruction' | 'testing' | 'review' | 'frqChoice' | 'frqHandwritten'
const [view, setView] = useState('instruction')
```

---

## Section 5: Must-Answer Questions

### Q1: Canonical Firestore session doc schema for timing + resume

**Found: Yes**

**Evidence:** `src/apBoost/services/apSessionService.js` lines 47-67

Fields:
- `status`: SESSION_STATUS enum (line 54)
- `lastAction`: serverTimestamp (line 64)
- `lastHeartbeat`: serverTimestamp (line 63)
- `sectionTimeRemaining`: object map (line 58)
- `completedAt`: null/serverTimestamp (line 66)
- `startedAt`: serverTimestamp (line 65)

**`autoSubmitQueued` does NOT EXIST** in current implementation.

---

### Q2: IndexedDB queue item schema

**Found: Yes**

**Evidence:** `src/apBoost/hooks/useOfflineQueue.js` lines 131-138

```javascript
const queueItem = {
  id: generateId(),
  sessionId,
  localTimestamp: Date.now(),
  action: action.action,
  payload: action.payload,
  status: 'PENDING',
}
```

**Indexes:** `sessionId` (non-unique), `status` (non-unique) - lines 32-33

---

### Q3: Reconciliation logic on session resume

**Found: No**

- `loadTestAndSession()` at useTestSession.js:161-206 loads Firestore state
- `updateQueueLength()` at useOfflineQueue.js:107-122 only counts items
- **No comparison of `localTimestamp` vs `session.lastAction`**
- **No stale item discard logic exists**

---

### Q4: Queue as only write path vs bypass

**Found: Mixed**

**Queued writes (primary path):**
- ANSWER_CHANGE, NAVIGATION, TIMER_SYNC via `addToQueue()`

**Direct writes (bypass queue):**
- Session creation: `createOrResumeSession()` uses `setDoc()`
- Session completion: `completeSession()` uses `updateDoc()`
- Heartbeat: `useHeartbeat.doHeartbeat()` uses `updateDoc()`
- Duplicate tab claim: `useDuplicateTabGuard.claimSession()` uses `updateDoc()`

---

### Q5: flushQueue implementation

**Found: Yes**

**Evidence:** `src/apBoost/hooks/useOfflineQueue.js` lines 173-266

- **Method:** Single `updateDoc()` call (line 232)
- **No batch/transaction** used
- **Idempotency:** Items deleted by `id` after success (line 243)
- **Duplicate hazard:** If flush fails mid-write and retries, same updates are re-applied (safe for last-write-wins fields)

---

### Q6: flushQueue triggers

**Found: Yes**

| Trigger | Location | Condition |
|---------|----------|-----------|
| `online` event | useOfflineQueue.js:90 | `scheduleFlush(1000)` |
| After `addToQueue()` | useOfflineQueue.js:154-156 | If `isOnline` |
| Debounced timeout | useOfflineQueue.js:163-170 | Via `scheduleFlush(delay)` |

**Backoff logic:** Yes, lines 257-262 - exponential with max 5 retries

**Retry state:** Stored in `retryCountRef.current`

---

### Q7: Timer implementation

**Found: Yes**

**Evidence:** `src/apBoost/hooks/useTimer.js`

- **Tick-based:** 1 second interval (line 95: `setInterval(..., 1000)`)
- **State:** `timeRemaining` decremented each tick (line 77)
- **Pause/Resume:** `isRunning` state + `isPaused` prop control (lines 67, 47-49, 52-56)
- **Authoritative source:** `initialTime` from session's `sectionTimeRemaining` or section's `timeLimit * 60`

**Evidence of initialTime:** useTestSession.js:127-134
```javascript
const initialTime = useMemo(() => {
  if (!currentSection) return 0
  const savedTime = session?.sectionTimeRemaining?.[currentSection.id]
  if (savedTime != null) return savedTime
  return (currentSection.timeLimit || 45) * 60
}, [currentSection, session])
```

---

### Q8: Lifecycle events beyond beforeunload

**Found: Partial**

| Event | Handler Location | Behavior |
|-------|-----------------|----------|
| `beforeunload` | useTestSession.js:209-220 | Warns if queue not empty |
| `beforeunload` | useDuplicateTabGuard.js:115-126 | Empty (intentionally) |
| `visibilitychange` | useHeartbeat.js:101-113 | Triggers heartbeat on visible |
| `pagehide` | — | **NOT FOUND** |

**visibilitychange in useHeartbeat:**
```javascript
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && sessionId && instanceToken) {
    doHeartbeat()
  }
}
document.addEventListener('visibilitychange', handleVisibilityChange)
```

**Note:** visibilitychange does NOT trigger queue flush - only heartbeat.

---

### Q9: Auto-submit on timer expiry

**Found: Placeholder only**

**Evidence:** `src/apBoost/hooks/useTestSession.js` lines 136-140

```javascript
const handleTimerExpire = useCallback(() => {
  // Auto-submit when timer expires
  console.log('Timer expired, auto-submitting...')
  // Could trigger auto-submit here
}, [])
```

- **Only logs to console** - no actual submission triggered
- **No queue action** for offline timer expiry
- Handler is passed to useTimer (line 154: `onExpire: handleTimerExpire`)

---

### Q10: ConnectionStatus UI states

**Found: Yes**

**Evidence:** `src/apBoost/components/ConnectionStatus.jsx`

**Props accepted:** `isConnected`, `isSyncing`

**States displayed:**
1. Hidden (null) when connected and not syncing
2. "Syncing your progress..." (blue info banner)
3. "Connection unstable - your progress is being saved locally" (yellow warning)

**NOT supported:**
- Storage full warning
- Quota exceeded warning
- Extended offline duration indicator

---

### Q11: Timestamp conversion / error classification utilities

**Found: Partial**

**Timeout utility exists:** `src/apBoost/utils/withTimeout.js`
```javascript
export const TIMEOUTS = {
  FIRESTORE_READ: 10000,
  FIRESTORE_WRITE: 15000,
  SESSION_LOAD: 20000,
  HEARTBEAT: 5000,
  QUEUE_FLUSH: 30000,
}
```

**`toMillis` utility:** **NOT FOUND** (only proposed in fix plans)

**Quota error classification:** **NOT FOUND**
- No `error.name === 'QuotaExceededError'` check
- No `error.code === 'resource-exhausted'` check

---

### Q12: Tests for offline queue, resume, flush ordering, timer expiry, beforeunload, quota errors

**Found: No**

- No test files found in `src/apBoost/`
- No `*.test.js`, `*.spec.js`, or `__tests__` directories
- Only test files in project are in `node_modules/`

---

## Summary of Gaps

| Feature | Status | Location |
|---------|--------|----------|
| Queue reconciliation on resume | ❌ Not implemented | useOfflineQueue.js |
| localTimestamp comparison | ❌ Stored but unused | useOfflineQueue.js:134 |
| Timer auto-submit | ❌ Placeholder only | useTestSession.js:136-140 |
| AUTO_SUBMIT queue action | ❌ Not handled | useOfflineQueue.js:204 |
| visibilitychange queue flush | ❌ Not implemented | useOfflineQueue.js |
| pagehide handler | ❌ Not implemented | — |
| QuotaExceededError handling | ❌ Not implemented | useOfflineQueue.js |
| resource-exhausted classification | ❌ Not implemented | useOfflineQueue.js |
| Extended offline duration tracking | ❌ Not implemented | — |
| IndexedDB transaction abort handling | ❌ Not implemented | — |
| resetDatabase utility | ❌ Not implemented | — |
| toMillis utility | ❌ Not implemented | — |
| Unit/integration tests | ❌ None found | src/apBoost/ |
| FLAG_TOGGLE in flush | ❌ Queued but not processed | useOfflineQueue.js:209-210 |
