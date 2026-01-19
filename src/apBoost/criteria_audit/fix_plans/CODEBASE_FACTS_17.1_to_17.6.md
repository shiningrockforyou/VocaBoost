# CODEBASE_FACTS__UNK__17.1_to_17.6.md

**Generated:** 2026-01-14
**Purpose:** Ground-truth facts for Fix Plan Sections 17.1 to 17.6 (Hooks Detailed)

---

## 1) Canonical Data Schema / Source-of-Truth

**Found: Yes**

### Session State Schema (`ap_session_state` collection)

**File:** `src/apBoost/services/apSessionService.js:49-67`

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

### Field Shapes

| Field | Type | Shape | Evidence |
|-------|------|-------|----------|
| `annotations` | Object | `{}` (empty object at init) | `apSessionService.js:61` |
| `strikethroughs` | Object | `{}` (empty object at init) | `apSessionService.js:62` |
| `flaggedQuestions` | Array | `[]` (array of questionId strings) | `apSessionService.js:60` |
| `sessionToken` | String | UUID-like `${Date.now()}-${random}` | `apSessionService.js:19-21` |
| `answers` | Object | `{ [questionId]: value }` | `apSessionService.js:59` |

### In-Memory Shapes (useAnnotations.js)

**File:** `src/apBoost/hooks/useAnnotations.js:21-25`

```javascript
// Highlights: Map<questionId, HighlightRange[]>
const [highlights, setHighlights] = useState(new Map())

// Strikethroughs: Map<questionId, Set<choiceId>>
const [strikethroughs, setStrikethroughs] = useState(new Map())
```

### Export Format (for persistence)

**File:** `src/apBoost/hooks/useAnnotations.js:208-223`

```javascript
const exportAnnotations = useCallback(() => {
  const highlightsObj = {}
  highlights.forEach((ranges, qId) => {
    highlightsObj[qId] = ranges  // Array of {start, end, color}
  })

  const strikethroughsObj = {}
  strikethroughs.forEach((choices, qId) => {
    strikethroughsObj[qId] = Array.from(choices)  // Array of choiceId strings
  })

  return {
    highlights: highlightsObj,
    strikethroughs: strikethroughsObj,
  }
}, [highlights, strikethroughs])
```

### Import Format (loadAnnotations)

**File:** `src/apBoost/hooks/useAnnotations.js:181-205`

```javascript
const loadAnnotations = useCallback((annotationData) => {
  if (!annotationData) return

  // Load highlights
  if (annotationData.highlights) {
    const highlightsMap = new Map()
    Object.entries(annotationData.highlights).forEach(([qId, ranges]) => {
      highlightsMap.set(qId, ranges)
    })
    setHighlights(highlightsMap)
  }

  // Load strikethroughs
  if (annotationData.strikethroughs) {
    const strikethroughsMap = new Map()
    Object.entries(annotationData.strikethroughs).forEach(([qId, choices]) => {
      strikethroughsMap.set(qId, new Set(choices))
    })
    setStrikethroughs(strikethroughsMap)
  }
})
```

---

## 2) Write Paths

**Found: Yes**

### Summary Table

| Data Type | Write Path | Uses Queue? | Firestore Method | File Location |
|-----------|------------|-------------|------------------|---------------|
| Answers | `useTestSession.setAnswer` → queue → `flushQueue` | Yes | `updateDoc` with dot notation | `useTestSession.js:328-359`, `useOfflineQueue.js:205-207` |
| Flags | `useTestSession.toggleFlag` → queue → `flushQueue` | Yes (but NOT processed) | **NOT PERSISTED** (placeholder only) | `useTestSession.js:362-383`, `useOfflineQueue.js:208-210` |
| Flags (direct) | `apSessionService.toggleQuestionFlag` | No (direct) | `updateDoc` with read-modify-write | `apSessionService.js:150-176` |
| Annotations | `useAnnotations` → queue → `flushQueue` | Yes (but NOT processed) | **NOT PERSISTED** | `useAnnotations.js:45-50`, `useOfflineQueue.js:222-224` |
| Navigation | `useTestSession.goToFlatIndex` → queue → `flushQueue` | Yes | `updateDoc` with direct fields | `useTestSession.js:242-260`, `useOfflineQueue.js:211-214` |
| Timer | `useTestSession.handleTimerTick` → queue → `flushQueue` | Yes | `updateDoc` with dot notation | `useTestSession.js:142-150`, `useOfflineQueue.js:215-221` |
| Heartbeat | `useHeartbeat.doHeartbeat` | No (direct) | `updateDoc` | `useHeartbeat.js:54-61` |
| Session claim | `useDuplicateTabGuard.claimSession` | No (direct) | `updateDoc` | `useDuplicateTabGuard.js:28-47` |

### Answer Write Path Detail

**File:** `src/apBoost/hooks/useOfflineQueue.js:205-207`

```javascript
case 'ANSWER_CHANGE':
  updates[`answers.${item.payload.questionId}`] = item.payload.value
  break
```

### Flag Write Path Detail (PLACEHOLDER - NOT IMPLEMENTED)

**File:** `src/apBoost/hooks/useOfflineQueue.js:208-210`

```javascript
case 'FLAG_TOGGLE':
  // Flags need special handling - we'd need to maintain the array
  break
```

**Evidence:** The `FLAG_TOGGLE` case is a placeholder with a comment. No actual Firestore write happens for flags via the queue.

### Direct Flag Write Path (apSessionService)

**File:** `src/apBoost/services/apSessionService.js:150-176`

```javascript
export async function toggleQuestionFlag(sessionId, questionId, flagged) {
  const sessionDoc = await getDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId))
  const session = sessionDoc.data()
  let flaggedQuestions = session.flaggedQuestions || []

  if (flagged) {
    if (!flaggedQuestions.includes(questionId)) {
      flaggedQuestions = [...flaggedQuestions, questionId]
    }
  } else {
    flaggedQuestions = flaggedQuestions.filter(id => id !== questionId)
  }

  await updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), {
    flaggedQuestions,
    lastAction: serverTimestamp(),
  })
}
```

**Evidence:** This direct service function is **NOT imported or used** in `useTestSession.js`. The service imports at `useTestSession.js:7-11` show `toggleQuestionFlag` is imported but never called - instead flags go through the queue which doesn't process them.

### Annotation Write Path (NOT IMPLEMENTED)

**File:** `src/apBoost/hooks/useOfflineQueue.js:204-225`

The switch statement handles `ANSWER_CHANGE`, `FLAG_TOGGLE`, `NAVIGATION`, `TIMER_SYNC`, and `default`. There is **NO case for `ANNOTATION_UPDATE`**.

```javascript
switch (item.action) {
  case 'ANSWER_CHANGE':
    // ...handled
  case 'FLAG_TOGGLE':
    // Flags need special handling - we'd need to maintain the array
    break
  case 'NAVIGATION':
    // ...handled
  case 'TIMER_SYNC':
    // ...handled
  default:
    break  // ANNOTATION_UPDATE falls here - nothing happens
}
```

---

## 3) Offline/Resilience Mechanics

**Found: Yes**

### IndexedDB Configuration

**File:** `src/apBoost/hooks/useOfflineQueue.js:8-11`

```javascript
const DB_NAME = 'ap_boost_queue'
const STORE_NAME = 'actions'
const DB_VERSION = 1
```

### IndexedDB Schema

**File:** `src/apBoost/hooks/useOfflineQueue.js:28-34`

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

### Queue Item Schema

**File:** `src/apBoost/hooks/useOfflineQueue.js:131-138`

```javascript
const queueItem = {
  id: generateId(),          // "${Date.now()}-${random}"
  sessionId,
  localTimestamp: Date.now(),
  action: action.action,     // e.g., 'ANSWER_CHANGE', 'ANNOTATION_UPDATE'
  payload: action.payload,
  status: 'PENDING',
}
```

### Status Handling

**PENDING → deleted (no CONFIRMED state)**

**File:** `src/apBoost/hooks/useOfflineQueue.js:192, 238-249`

```javascript
// Filter for pending items only
const pendingItems = items.filter(item => item.status === 'PENDING')

// After successful write, DELETE items (no CONFIRMED transition)
const deleteTx = dbRef.current.transaction(STORE_NAME, 'readwrite')
const deleteStore = deleteTx.objectStore(STORE_NAME)

for (const item of pendingItems) {
  deleteStore.delete(item.id)
}
```

**Evidence:** Items go directly from PENDING to deleted. There is no CONFIRMED status transition.

### Flush Triggers

| Trigger | Implemented? | File Location | Details |
|---------|--------------|---------------|---------|
| `online` event | ✅ Yes | `useOfflineQueue.js:86-91` | Resets retryCount, schedules flush with 1s delay |
| `offline` event | ✅ Yes | `useOfflineQueue.js:93-95` | Sets `isOnline = false` |
| `visibilitychange` | ❌ No | NOT FOUND in useOfflineQueue | Only in useHeartbeat for heartbeat, not queue flush |
| Heartbeat success | ❌ No | NOT FOUND | No coupling between heartbeat success and queue flush |
| Item added (when online) | ✅ Yes | `useOfflineQueue.js:153-156` | 1s debounce schedule |
| Timer/interval | ❌ No | NOT FOUND | No periodic flush |

### Online Event Handler

**File:** `src/apBoost/hooks/useOfflineQueue.js:86-91`

```javascript
const handleOnline = () => {
  setIsOnline(true)
  retryCountRef.current = 0
  // Try to flush when we come back online
  scheduleFlush(1000)
}
```

### visibilitychange (Only in useHeartbeat, NOT queue)

**File:** `src/apBoost/hooks/useHeartbeat.js:101-113`

```javascript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && sessionId && instanceToken) {
      doHeartbeat()  // Only triggers heartbeat, NOT queue flush
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
}, [sessionId, instanceToken, doHeartbeat])
```

### Retry/Backoff Logic

**File:** `src/apBoost/hooks/useOfflineQueue.js:257-262`

```javascript
// Exponential backoff retry
retryCountRef.current++
if (retryCountRef.current < 5) {
  const delay = Math.pow(2, retryCountRef.current) * 1000 // 2s, 4s, 8s, 16s
  scheduleFlush(delay)
}
```

| Attempt | Delay |
|---------|-------|
| 1 | 2s |
| 2 | 4s |
| 3 | 8s |
| 4 | 16s |
| 5+ | **Stops** (no opportunistic mode) |

### Opportunistic Mode

**Found: No**

There is no `isOpportunistic` state or similar concept. After 5 retries, the queue simply stops trying until the next `online` event or new item is added.

---

## 4) UI/Flow Entry Points

**Found: Yes**

### Highlight Add/Remove/Clear

| Action | Component | Hook Method | Queue Action | File Location |
|--------|-----------|-------------|--------------|---------------|
| Add highlight | `Highlighter.jsx` → `APTestSession.jsx` | `addHighlight()` | `ANNOTATION_UPDATE` with `type: 'ADD_HIGHLIGHT'` | `Highlighter.jsx:187-193`, `APTestSession.jsx:118-122`, `useAnnotations.js:36-51` |
| Remove highlight | `Highlighter.jsx` | `removeHighlight()` | `ANNOTATION_UPDATE` with `type: 'REMOVE_HIGHLIGHT'` | `Highlighter.jsx:196-201`, `useAnnotations.js:54-69` |
| Clear highlights | `ToolsToolbar.jsx` | `clearAllAnnotations()` | `ANNOTATION_UPDATE` with `type: 'CLEAR_ALL'` | `ToolsToolbar.jsx:85-94`, `useAnnotations.js:166-178` |

### Strikethrough Toggle/Clear

| Action | Component | Hook Method | Queue Action | File Location |
|--------|-----------|-------------|--------------|---------------|
| Toggle strikethrough | `AnswerInput.jsx` (MCQ choices) | `toggleStrikethrough()` | `ANNOTATION_UPDATE` with `type: 'TOGGLE_STRIKETHROUGH'` | `APTestSession.jsx:132-135`, `useAnnotations.js:94-117` |
| Clear strikethroughs | `ToolsToolbar.jsx` | `clearAllAnnotations()` | `ANNOTATION_UPDATE` with `type: 'CLEAR_ALL'` | `useAnnotations.js:166-178` |

### Flag Toggle

| Action | Component | Hook Method | Queue Action | File Location |
|--------|-----------|-------------|--------------|---------------|
| Toggle flag | `QuestionNavigator.jsx` or similar | `toggleFlag()` | `FLAG_TOGGLE` with `{ questionId, markedForReview }` | `useTestSession.js:362-383` |

**Entry Point Detail:**

**File:** `src/apBoost/hooks/useTestSession.js:362-383`

```javascript
const toggleFlag = useCallback((questionId) => {
  if (!questionId || !session?.id) return

  const wasFlagged = flags.has(questionId)

  // Update local state immediately
  setFlags(prev => {
    const next = new Set(prev)
    if (wasFlagged) {
      next.delete(questionId)
    } else {
      next.add(questionId)
    }
    return next
  })

  // Queue for sync
  addToQueue({
    action: 'FLAG_TOGGLE',
    payload: { questionId, markedForReview: !wasFlagged }
  })
}, [flags, session?.id, addToQueue])
```

### Navigation Updates

| Action | Component | Hook Method | Queue Action | File Location |
|--------|-----------|-------------|--------------|---------------|
| Go to question | `QuestionNavigator.jsx` | `goToFlatIndex()` | `NAVIGATION` with position data | `useTestSession.js:242-260` |
| Next/Previous | Navigation buttons | `goNext()`, `goPrevious()` | `NAVIGATION` via `goToFlatIndex()` | `useTestSession.js:289-301` |

---

## 5) Must-Answer Questions

### Q1: Where is the canonical session state schema defined for `ap_session_state`?

**Answer: Yes**

**Evidence:**
- **File:** `src/apBoost/services/apSessionService.js:49-67`
- Fields `annotations`, `strikethroughs`, and `flaggedQuestions` exist
- `annotations: {}` - empty object (shape defined by exportAnnotations as `{ [qId]: HighlightRange[] }`)
- `strikethroughs: {}` - empty object (shape: `{ [qId]: choiceId[] }`)
- `flaggedQuestions: []` - array of questionId strings

### Q2: Does `useOfflineQueue.flushQueue()` contain an action switch/dispatcher?

**Answer: Yes**

**Evidence:**
- **File:** `src/apBoost/hooks/useOfflineQueue.js:204-225`
- Handled action types: `ANSWER_CHANGE`, `FLAG_TOGGLE` (placeholder), `NAVIGATION`, `TIMER_SYNC`
- Default branch: `break` (does nothing)

```javascript
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
      // ...handles sectionTimeRemaining
      break
    default:
      break
  }
}
```

### Q3: Is `ANNOTATION_UPDATE` ever persisted to Firestore today?

**Answer: No**

**Evidence:**
- **File:** `src/apBoost/hooks/useOfflineQueue.js:204-225`
- No `case 'ANNOTATION_UPDATE':` in the switch statement
- Falls through to `default: break` - nothing is added to the updates object
- **Conclusion:** ANNOTATION_UPDATE actions are queued to IndexedDB but never written to Firestore

### Q4: How does `useAnnotations` represent highlights and strikethroughs in-memory?

**Answer: Found**

**Evidence:**
- **File:** `src/apBoost/hooks/useAnnotations.js:21-25`
- Highlights: `Map<questionId, HighlightRange[]>` where HighlightRange is `{ start, end, color }`
- Strikethroughs: `Map<questionId, Set<choiceId>>`

**exportAnnotations output:**
- **File:** `src/apBoost/hooks/useAnnotations.js:208-223`
- Returns: `{ highlights: { [qId]: ranges[] }, strikethroughs: { [qId]: choiceId[] } }`

**loadAnnotations input:**
- **File:** `src/apBoost/hooks/useAnnotations.js:181-205`
- Expects same format as exportAnnotations output

### Q5: Is there any existing Firestore write path for annotations outside the offline queue?

**Answer: No**

**Evidence:**
- Searched all files in `src/apBoost/` for patterns: `annotations`, `updateDoc`, `strikethroughs`
- No direct Firestore writes for annotations found outside the queue
- `useAnnotations.js` only queues actions via `addToQueue`, never calls `updateDoc` directly
- `apSessionService.js` only initializes `annotations: {}` and `strikethroughs: {}` at session creation

### Q6: How are flags persisted today?

**Answer: FLAG_TOGGLE is a placeholder - NOT persisted via queue**

**Evidence:**
- **File:** `src/apBoost/hooks/useOfflineQueue.js:208-210`
```javascript
case 'FLAG_TOGGLE':
  // Flags need special handling - we'd need to maintain the array
  break
```
- The comment indicates awareness of the issue but no implementation
- Direct path exists in `apSessionService.toggleQuestionFlag` (`apSessionService.js:150-176`) but is **NOT CALLED** from useTestSession

**File:** `src/apBoost/hooks/useTestSession.js:6-11` (imports)
```javascript
import {
  createOrResumeSession,
  getActiveSession,
  saveAnswer as saveAnswerToFirestore,
  toggleQuestionFlag,  // Imported but NEVER USED
  updatePosition,
  updateTimer,
} from '../services/apSessionService'
```

### Q7: What is the authoritative Firestore field for flags?

**Answer: `flaggedQuestions` (array)**

**Evidence:**
- **File:** `src/apBoost/services/apSessionService.js:60` - `flaggedQuestions: []`
- **File:** `src/apBoost/services/apSessionService.js:168-171` - Uses read-modify-write pattern:
```javascript
await updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), {
  flaggedQuestions,
  lastAction: serverTimestamp(),
})
```

**arrayUnion/arrayRemove usage:**
- **NOT USED** currently
- Only exists in `src/services/db.js:4-5` (vocaBoost, not apBoost) and fix plan proposals

### Q8: What is the IndexedDB implementation for the queue?

**Answer: Found**

**Evidence:**
- **File:** `src/apBoost/hooks/useOfflineQueue.js:8-11`
- DB name: `ap_boost_queue`
- Store name: `actions`
- keyPath: `id`
- Indexes: `sessionId`, `status`

**Item schema:** `src/apBoost/hooks/useOfflineQueue.js:131-138`
```javascript
{
  id: string,           // keyPath
  sessionId: string,    // indexed
  localTimestamp: number,
  action: string,
  payload: object,
  status: 'PENDING'     // indexed
}
```

### Q9: Is there any notion of item status transitions (PENDING → CONFIRMED → deleted)?

**Answer: No - Items go PENDING → deleted directly**

**Evidence:**
- **File:** `src/apBoost/hooks/useOfflineQueue.js:238-249`
- After successful Firestore write, items are deleted directly
- No status update to 'CONFIRMED' occurs
```javascript
const deleteTx = dbRef.current.transaction(STORE_NAME, 'readwrite')
const deleteStore = deleteTx.objectStore(STORE_NAME)

for (const item of pendingItems) {
  deleteStore.delete(item.id)  // Direct delete, no status transition
}
```

### Q10: What events trigger flushing today?

**Answer: Found - Limited triggers**

| Event | Triggers Flush? | Evidence |
|-------|----------------|----------|
| `online` | ✅ Yes | `useOfflineQueue.js:86-91` - schedules with 1s delay |
| `offline` | ❌ No | `useOfflineQueue.js:93-95` - only sets state |
| `visibilitychange` | ❌ No | Only in useHeartbeat.js:108 for heartbeat |
| Heartbeat success | ❌ No | No coupling in code |
| Item added (when online) | ✅ Yes | `useOfflineQueue.js:153-156` - 1s debounce |
| Timer/interval | ❌ No | No periodic flush |
| `beforeunload` | ❌ No | Only warning in useTestSession.js:209-220 |

### Q11: What is the retry logic in `useOfflineQueue`?

**Answer: Found - No opportunistic mode**

**Evidence:**
- **File:** `src/apBoost/hooks/useOfflineQueue.js:257-262`
- Max retries: 5 (condition `retryCountRef.current < 5`)
- Backoff: Exponential - `Math.pow(2, retryCount) * 1000` = 2s, 4s, 8s, 16s
- Stop condition: After 5 failures, stops scheduling
- **No opportunistic mode state exists** - searched for `opportunistic` and found only in spec/audit docs, not implementation

### Q12: How is heartbeat implemented?

**Answer: Found**

**Evidence:**
- **File:** `src/apBoost/hooks/useHeartbeat.js:18-78`

**sessionToken check:**
```javascript
// Line 47-51
if (sessionData.sessionToken && sessionData.sessionToken !== instanceToken) {
  logDebug('useHeartbeat.doHeartbeat', 'Session taken over by another instance')
  setSessionTakenOver(true)
  return
}
```

**Combined with useDuplicateTabGuard in useTestSession:**
- **File:** `src/apBoost/hooks/useTestSession.js:51-55`
```javascript
const { addToQueue, flushQueue, queueLength, isOnline, isFlushing } = useOfflineQueue(session?.id)
const { instanceToken, isInvalidated, takeControl } = useDuplicateTabGuard(session?.id)
const { isConnected, failureCount, sessionTakenOver } = useHeartbeat(session?.id, instanceToken)

// Combined invalidation check
const isSessionInvalidated = isInvalidated || sessionTakenOver
```

**Token flow:**
1. `useDuplicateTabGuard` generates `instanceToken` (`useDuplicateTabGuard.js:15-21`)
2. `instanceToken` is passed to `useHeartbeat` (`useTestSession.js:52`)
3. `useHeartbeat` checks Firestore `sessionToken` against `instanceToken` (`useHeartbeat.js:47`)
4. If mismatch, sets `sessionTakenOver = true`
5. `useTestSession` combines `isInvalidated || sessionTakenOver` for final state (`useTestSession.js:55`)

---

## Summary of Key Findings

| Issue | Status | Impact |
|-------|--------|--------|
| ANNOTATION_UPDATE not processed | ❌ Not implemented | Annotations lost on refresh |
| FLAG_TOGGLE not processed | ❌ Placeholder only | Flags lost on refresh |
| No visibilitychange flush | ❌ Missing | No flush on tab focus |
| No opportunistic mode | ❌ Missing | Queue stuck after 5 failures |
| No heartbeat→queue coupling | ❌ Missing | No flush on reconnect |
| arrayUnion/arrayRemove for flags | ❌ Not used | Uses read-modify-write instead |
| CONFIRMED status | ❌ Not implemented | Items deleted directly |

---

## File Reference Index

| File | Key Lines | Purpose |
|------|-----------|---------|
| `useOfflineQueue.js` | L8-11, L131-138, L173-266 | Queue config, item schema, flushQueue |
| `useAnnotations.js` | L21-25, L36-178, L208-223 | State shapes, actions, export/load |
| `useHeartbeat.js` | L10, L47-51, L101-113 | MAX_FAILURES, token check, visibilitychange |
| `useDuplicateTabGuard.js` | L15-21, L28-47, L76-81 | instanceToken, claimSession, BroadcastChannel |
| `useTestSession.js` | L50-55, L328-383, L507-508 | Hook composition, setAnswer, toggleFlag |
| `apSessionService.js` | L49-67, L150-176 | Session schema, toggleQuestionFlag service |
| `apTypes.js` | L90-98 | Collection names including SESSION_STATE |
| `APTestSession.jsx` | L91-141 | useAnnotations integration |
| `ToolsToolbar.jsx` | L85-94, L143-160 | Clear all UI |
| `Highlighter.jsx` | L116-256 | Text selection and highlighting |
