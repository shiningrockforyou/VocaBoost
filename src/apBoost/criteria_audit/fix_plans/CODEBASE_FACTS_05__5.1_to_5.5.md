# CODEBASE_FACTS__05__5.1_to_5.5.md

**Chunk ID:** 05__5.1_to_5.5
**Inspector:** Claude Agent
**Date:** 2026-01-14
**Scope:** Offline queue, debounce, immediate writes, lifecycle pause, retry/recovery, heartbeat integration

---

## 1) Canonical Data Schema / Source-of-Truth

**Found: Yes**

### Firestore Collection: `ap_session_state`
**Evidence:** `src/apBoost/utils/apTypes.js:L90-L98`
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

### Session Document Schema (canonical creation)
**Evidence:** `src/apBoost/services/apSessionService.js:L49-L67`
```javascript
const sessionData = {
  userId,                          // string
  testId,                          // string
  assignmentId,                    // string|null
  sessionToken: generateSessionToken(), // string (tab identity)
  status: SESSION_STATUS.IN_PROGRESS,   // enum string
  attemptNumber,                   // number
  currentSectionIndex: 0,          // number
  currentQuestionIndex: 0,         // number
  sectionTimeRemaining: {},        // object<sectionId, number>
  answers: {},                     // object<questionId, any>
  flaggedQuestions: [],            // array<string>
  annotations: {},                 // object (highlights nested)
  strikethroughs: {},              // object<questionId, object<choiceId, boolean>>
  lastHeartbeat: serverTimestamp(), // timestamp
  lastAction: serverTimestamp(),   // timestamp
  startedAt: serverTimestamp(),    // timestamp
  completedAt: null,               // timestamp|null
}
```

### Session Status Values (canonical)
**Evidence:** `src/apBoost/utils/apTypes.js:L34-L39`
```javascript
export const SESSION_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
}
```

### Key Observations:
- **`completedSections` field:** NOT in canonical schema - proposed only in fix plans
- **`currentSubQuestionLabel` field:** NOT in Firestore schema - only local state (useTestSession.js:L37)
- **Timer fields:** Only `sectionTimeRemaining` map exists; no global timer fields

---

## 2) Write Paths

**Found: Yes**

### Path A: Queue-Based Writes (Primary Path)
**Source:** `src/apBoost/hooks/useOfflineQueue.js`

**Entry:** `addToQueue()` (L125-160)
```javascript
const addToQueue = useCallback(async (action) => {
  // ...
  const queueItem = {
    id: generateId(),
    sessionId,
    localTimestamp: Date.now(),
    action: action.action,
    payload: action.payload,
    status: 'PENDING',
  }
  // ... add to IndexedDB ...
  if (isOnline) {
    scheduleFlush(1000) // 1 second debounce
  }
}, [sessionId, isOnline, updateQueueLength])
```

**Flush:** `flushQueue()` (L173-266)
```javascript
// Builds single updates object, writes via updateDoc
await withTimeout(
  updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), updates),
  TIMEOUTS.FIRESTORE_WRITE,
  'Queue flush'
)
```

### Path B: Direct Service Writes (Bypass Queue)
**Source:** `src/apBoost/services/apSessionService.js`

| Function | Lines | Fields Written | Usage Status |
|----------|-------|----------------|--------------|
| `updateSession` | L112-122 | Any fields + lastAction | Generic |
| `saveAnswer` | L131-141 | `answers.{questionId}`, lastAction | **IMPORTED but unused in useTestSession** |
| `toggleQuestionFlag` | L150-176 | `flaggedQuestions[]`, lastAction | **IMPORTED but unused in useTestSession** |
| `updatePosition` | L185-196 | `currentSectionIndex`, `currentQuestionIndex`, lastAction | **IMPORTED but unused in useTestSession** |
| `updateTimer` | L205-215 | `sectionTimeRemaining.{sectionId}`, lastAction | **IMPORTED but unused in useTestSession** |
| `completeSession` | L222-233 | `status`, `completedAt`, lastAction | Used by scoring |
| `updateHeartbeat` | L258-267 | `lastHeartbeat` | **NOT USED** (heartbeat uses inline updateDoc) |

**Evidence:** `src/apBoost/hooks/useTestSession.js:L4-L11`
```javascript
import {
  createOrResumeSession,
  getActiveSession,
  saveAnswer as saveAnswerToFirestore,  // Imported but NOT called
  toggleQuestionFlag,                    // Imported but NOT called
  updatePosition,                        // Imported but NOT called
  updateTimer,                           // Imported but NOT called
} from '../services/apSessionService'
```

### Path C: Heartbeat Direct Writes
**Source:** `src/apBoost/hooks/useHeartbeat.js:L54-L61`
```javascript
await withTimeout(
  updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), {
    lastHeartbeat: serverTimestamp(),
    sessionToken: instanceToken,
  }),
  TIMEOUTS.HEARTBEAT,
  'Heartbeat write'
)
```

### Write Path Summary:
| User Action | Current Path | File:Lines |
|-------------|--------------|------------|
| Answer change | Queue → flushQueue | useTestSession.js:L351-358 |
| Flag toggle | Queue → flushQueue (BROKEN) | useTestSession.js:L379-382 |
| Navigation | Queue → flushQueue | useTestSession.js:L250-258 |
| Annotation/Highlight | Queue → flushQueue (BROKEN) | useAnnotations.js:L46-49 |
| Strikethrough | Queue → flushQueue (BROKEN) | useAnnotations.js:L112-115 |
| Timer sync | Queue → flushQueue | useTestSession.js:L145-149 |
| Heartbeat | Direct updateDoc | useHeartbeat.js:L54-61 |
| Session claim | Direct updateDoc | useDuplicateTabGuard.js:L32-39 |

---

## 3) Offline/Resilience Mechanics

**Found: Yes**

### IndexedDB Schema
**Evidence:** `src/apBoost/hooks/useOfflineQueue.js:L8-L11, L28-L36`

| Property | Value |
|----------|-------|
| **DB Name** | `ap_boost_queue` |
| **Store Name** | `actions` |
| **DB Version** | `1` |
| **keyPath** | `id` |
| **Indexes** | `sessionId` (non-unique), `status` (non-unique) |

```javascript
const DB_NAME = 'ap_boost_queue'
const STORE_NAME = 'actions'
const DB_VERSION = 1

// onupgradeneeded:
const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
store.createIndex('sessionId', 'sessionId', { unique: false })
store.createIndex('status', 'status', { unique: false })
```

### Queue Item Shape
**Evidence:** `src/apBoost/hooks/useOfflineQueue.js:L131-L138`
```javascript
const queueItem = {
  id: generateId(),           // string (timestamp-random)
  sessionId,                  // string
  localTimestamp: Date.now(), // number (ms)
  action: action.action,      // string (action type)
  payload: action.payload,    // object (action-specific)
  status: 'PENDING',          // string (always 'PENDING')
}
```

### Debounce Timing Mechanics
**Evidence:** `src/apBoost/hooks/useOfflineQueue.js:L90, L155, L162-170`

| Location | Delay | Trigger |
|----------|-------|---------|
| L90 | `1000` ms | Online event handler |
| L155 | `1000` ms | After addToQueue (if online) |

```javascript
// L162-170: scheduleFlush implementation
const scheduleFlush = useCallback((delay) => {
  if (flushTimeoutRef.current) {
    clearTimeout(flushTimeoutRef.current)
  }
  flushTimeoutRef.current = setTimeout(() => {
    flushQueue()
  }, delay)
}, [])
```

**Key Finding:** Only ONE debounce mechanism - simple setTimeout, re-scheduled on each addToQueue call.

### Retry/Backoff Logic
**Evidence:** `src/apBoost/hooks/useOfflineQueue.js:L254-L262`
```javascript
// Exponential backoff retry
retryCountRef.current++
if (retryCountRef.current < 5) {
  const delay = Math.pow(2, retryCountRef.current) * 1000 // 2s, 4s, 8s, 16s
  scheduleFlush(delay)
}
```

| Retry | Delay |
|-------|-------|
| 1 | 2,000 ms |
| 2 | 4,000 ms |
| 3 | 8,000 ms |
| 4 | 16,000 ms |
| 5+ | No more retries |

### Flush Triggers
**Evidence:** Various locations in `useOfflineQueue.js`

| Trigger | Lines | Code |
|---------|-------|------|
| `addToQueue` (online) | L154-156 | `scheduleFlush(1000)` |
| Online event | L86-91 | `scheduleFlush(1000)` |
| Retry after failure | L261 | `scheduleFlush(delay)` |

**NOT FOUND:**
- Tab focus / visibilitychange trigger for queue flush
- Heartbeat recovery trigger for queue flush
- "Opportunistic mode" implementation

### Queue Item Status Flow
**Evidence:** `src/apBoost/hooks/useOfflineQueue.js:L137, L192, L242-244`

```javascript
// L137: Items created with status 'PENDING'
status: 'PENDING',

// L192: Only PENDING items are processed
const pendingItems = items.filter(item => item.status === 'PENDING')

// L242-244: Items DELETED after successful flush (no CONFIRMED state)
for (const item of pendingItems) {
  deleteStore.delete(item.id)
}
```

**Status Flow:** `PENDING` → (flush success) → **DELETED**
- **No CONFIRMED state exists** in current implementation

---

## 4) UI/Flow Entry Points

**Found: Yes**

### Navigation Entry Points
**Evidence:** `src/apBoost/hooks/useTestSession.js`

| Function | Lines | Queue Action | Immediate? |
|----------|-------|--------------|------------|
| `goToFlatIndex` | L242-260 | `NAVIGATION` | No (debounced) |
| `goToQuestion` | L263-287 | `NAVIGATION` | No (debounced) |
| `goNext` | L289-294 | calls goToFlatIndex | No |
| `goPrevious` | L296-301 | calls goToFlatIndex | No |

### Section Submit Entry Point
**Evidence:** `src/apBoost/hooks/useTestSession.js:L386-393`
```javascript
const submitSection = useCallback(async () => {
  // For Phase 1, we just go to next section
  if (currentSectionIndex < (test?.sections?.length || 1) - 1) {
    setCurrentSectionIndex(prev => prev + 1)
    setCurrentQuestionIndex(0)
  }
}, [currentSectionIndex, test?.sections?.length])
```
**Finding:** NO Firestore write - only local state update

### beforeunload Handler
**Evidence:** `src/apBoost/hooks/useTestSession.js:L209-220`
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
**Finding:** Only shows warning dialog - NO status update, NO queue flush, NO sendBeacon

### visibilitychange Handler
**Evidence:** `src/apBoost/hooks/useHeartbeat.js:L101-113`
```javascript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && sessionId && instanceToken) {
      doHeartbeat()
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}, [sessionId, instanceToken, doHeartbeat])
```
**Finding:** Only triggers heartbeat - does NOT trigger queue flush

### Heartbeat Usage Location
**Evidence:** `src/apBoost/hooks/useTestSession.js:L52`
```javascript
const { isConnected, failureCount, sessionTakenOver } = useHeartbeat(session?.id, instanceToken)
```
**Finding:** Returns are consumed but NO callback/integration to trigger flushQueue on recovery

---

## 5) Must-Answer Questions

### Q1: Canonical Firestore document schema for `ap_session_state`
**Found: Yes**
**Evidence:** `src/apBoost/services/apSessionService.js:L49-L67` (shown in Section 1)

| Field | Type | Present in Schema |
|-------|------|-------------------|
| `currentSectionIndex` | number | ✅ Yes |
| `currentQuestionIndex` | number | ✅ Yes |
| `completedSections` | array | ❌ **NOT FOUND** |
| `status` | string (enum) | ✅ Yes |
| `flaggedQuestions` | array<string> | ✅ Yes |
| `annotations` | object | ✅ Yes |
| `strikethroughs` | object | ✅ Yes |
| `completedAt` | timestamp\|null | ✅ Yes |
| `lastAction` | timestamp | ✅ Yes |
| `sectionTimeRemaining` | object<sectionId, number> | ✅ Yes |
| `lastHeartbeat` | timestamp | ✅ Yes |
| `sessionToken` | string | ✅ Yes |

---

### Q2: Is useOfflineQueue the ONLY write path?
**Found: Yes - Multiple paths exist**

| Path | Used? | Evidence |
|------|-------|----------|
| Queue (addToQueue → flushQueue) | ✅ Active | Primary path for user actions |
| Direct services (apSessionService) | ⚠️ Imported but unused | useTestSession.js:L7-10 imports but never calls |
| Heartbeat direct write | ✅ Active | useHeartbeat.js:L54-61 |
| Tab guard direct write | ✅ Active | useDuplicateTabGuard.js:L32-39 |

**Conclusion:** Queue is primary for answers/flags/nav/timer, but heartbeat and tab guard write directly.

---

### Q3: Where is debounce delay defined?
**Found: Yes**
**Evidence:** `src/apBoost/hooks/useOfflineQueue.js:L90, L155`

Two hardcoded `1000` values:
```javascript
// L90: Online handler
scheduleFlush(1000)

// L155: After addToQueue
scheduleFlush(1000)
```

**No constant defined** - both are inline literals.

---

### Q4: How does flushQueue apply queued items?
**Found: Yes**
**Evidence:** `src/apBoost/hooks/useOfflineQueue.js:L201-L236`

```javascript
// Build update object from queued actions
const updates = {}
for (const item of pendingItems) {
  switch (item.action) {
    case 'ANSWER_CHANGE':
      updates[`answers.${item.payload.questionId}`] = item.payload.value
      break
    case 'FLAG_TOGGLE':
      // Flags need special handling - we'd need to maintain the array
      break  // <-- NOT IMPLEMENTED
    case 'NAVIGATION':
      updates.currentSectionIndex = item.payload.currentSectionIndex
      updates.currentQuestionIndex = item.payload.currentQuestionIndex
      break
    case 'TIMER_SYNC':
      // ... section time remaining ...
      break
    default:
      break
  }
}

if (Object.keys(updates).length > 0) {
  updates.lastAction = serverTimestamp()
  await updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), updates)
}
```

**Batching:** Single `updateDoc` call with merged `updates` object
**No transactions used** - plain updateDoc
**No arrayUnion/arrayRemove** - dot notation field updates only

**Idempotency/Race Hazards Identified:**
1. **FLAG_TOGGLE:** Comment says "needs special handling" - falls to break, NEVER persisted
2. **ANNOTATION_UPDATE:** NOT in switch - falls to default, NEVER persisted
3. **NAVIGATION:** Overwrites entirely - last write wins, but safe
4. **ANSWER_CHANGE:** Dot notation for nested field - safe, idempotent
5. **TIMER_SYNC:** Dot notation for nested field - safe, idempotent

---

### Q5: Exact action type strings handled in flushQueue
**Found: Yes**
**Evidence:** `src/apBoost/hooks/useOfflineQueue.js:L204-L224`

| Action Type | Handled? | Evidence |
|-------------|----------|----------|
| `ANSWER_CHANGE` | ✅ Yes | L205-207 |
| `FLAG_TOGGLE` | ❌ **NO** (empty case) | L208-210 |
| `NAVIGATION` | ✅ Yes | L211-214 |
| `TIMER_SYNC` | ✅ Yes | L215-221 |
| `ANNOTATION_UPDATE` | ❌ **NOT IN SWITCH** | Falls to default |
| `SECTION_COMPLETE` | ❌ **NOT IN SWITCH** | Does not exist |
| `SESSION_PAUSE` | ❌ **NOT IN SWITCH** | Does not exist |
| `SESSION_SUBMIT` | ❌ **NOT IN SWITCH** | Does not exist |

**Action types queued but NOT handled:**
- `ANNOTATION_UPDATE` (from useAnnotations.js:L47, L65, L82, L113, L134, L174)
- `FLAG_TOGGLE` has case but body is empty (only comment)

---

### Q6: IndexedDB persistence details
**Found: Yes**
**Evidence:** `src/apBoost/hooks/useOfflineQueue.js:L8-L11, L16-L37`

| Property | Value |
|----------|-------|
| DB Name | `ap_boost_queue` |
| Store Name | `actions` |
| DB Version | `1` |
| keyPath | `id` |
| Indexes | `sessionId`, `status` |
| Item Shape | `{id, sessionId, localTimestamp, action, payload, status}` |

**Migration/Versioning:** Single `onupgradeneeded` handler creates store if not exists (L28-L36). No version migration logic.

---

### Q7: Status flow for queue items
**Found: Yes**
**Evidence:** `src/apBoost/hooks/useOfflineQueue.js:L137, L192, L242-244`

**Current Flow:**
1. Created with `status: 'PENDING'` (L137)
2. Filtered by `status === 'PENDING'` for flush (L192)
3. **DELETED immediately** after successful Firestore write (L242-244)

**No CONFIRMED state exists.** Items go from PENDING → deleted.

---

### Q8: Retry/backoff logic
**Found: Yes**
**Evidence:** `src/apBoost/hooks/useOfflineQueue.js:L57, L88, L251, L257-262`

```javascript
const retryCountRef = useRef(0)  // L57

// Reset on online event: L88
retryCountRef.current = 0

// Reset on success: L251
retryCountRef.current = 0

// Increment and retry on failure: L257-262
retryCountRef.current++
if (retryCountRef.current < 5) {
  const delay = Math.pow(2, retryCountRef.current) * 1000
  scheduleFlush(delay)
}
```

**Triggers for flush attempts:**
1. `addToQueue` while online (L154-156)
2. Online event (L86-91)
3. Retry after failure (L261)

**NOT triggered by:**
- visibilitychange / tab focus
- Heartbeat recovery
- User action (beyond addToQueue)

---

### Q9: Existing visibilitychange/pagehide/beforeunload handling
**Found: Partial**

| Event | Handler | Location | Action |
|-------|---------|----------|--------|
| `beforeunload` | useTestSession.js:L209-220 | Queue context | Shows warning if queueLength > 0 |
| `beforeunload` | useDuplicateTabGuard.js:L115-126 | Tab guard | Empty handler (comment says "don't clear token") |
| `visibilitychange` | useHeartbeat.js:L101-113 | Heartbeat | Calls `doHeartbeat()` when visible |

**NOT FOUND:**
- `pagehide` handler
- `sendBeacon` usage
- Status update to PAUSED on unload
- Queue flush on unload

---

### Q10: useHeartbeat implementation details
**Found: Yes**
**Evidence:** `src/apBoost/hooks/useHeartbeat.js:L9-L10, L19-L78`

```javascript
const HEARTBEAT_INTERVAL = 15000 // 15 seconds
const MAX_FAILURES = 3
```

**Failure/Success Logic (L27-L77):**
```javascript
const doHeartbeat = useCallback(async () => {
  try {
    // Read session doc
    const sessionDoc = await getDoc(...)

    // Check if taken over
    if (sessionData.sessionToken !== instanceToken) {
      setSessionTakenOver(true)
      return
    }

    // Write heartbeat
    await updateDoc(...)

    // Success:
    setIsConnected(true)
    setFailureCount(0)
  } catch (error) {
    setFailureCount(prev => {
      const newCount = prev + 1
      if (newCount >= MAX_FAILURES) {  // >= 3
        setIsConnected(false)
      }
      return newCount
    })
  }
}, [...])
```

**Callback/Hook for flushQueue on recovery:** **NOT FOUND**
- useHeartbeat returns `{ isConnected, failureCount, sessionTakenOver, reconnect }`
- `reconnect` just calls `doHeartbeat()` - no queue integration
- No callback prop or event emitter for recovery notification

---

### Q11: "Active session" query logic in getActiveSession
**Found: Yes**
**Evidence:** `src/apBoost/services/apSessionService.js:L84-L104`

```javascript
export async function getActiveSession(testId, userId) {
  try {
    const sessionsQuery = query(
      collection(db, COLLECTIONS.SESSION_STATE),
      where('testId', '==', testId),
      where('userId', '==', userId),
      where('status', '==', SESSION_STATUS.IN_PROGRESS)  // ONLY IN_PROGRESS
    )
    const sessionsSnap = await getDocs(sessionsQuery)

    if (sessionsSnap.empty) {
      return null
    }

    const doc = sessionsSnap.docs[0]
    return { id: doc.id, ...doc.data() }
  } catch (error) {
    console.error('Error getting active session:', error)
    return null
  }
}
```

**Conclusion:** Query **ONLY includes `IN_PROGRESS`** - does NOT include `PAUSED`

---

### Q12: Backend endpoint for pausing session
**Found: No**

**Searches performed:**
- `pauseSession` in src/apBoost → 0 code matches (only in fix plan docs)
- `/api/` in src/apBoost → 0 code matches (only in fix plan docs)
- `functions/index.js` → Only contains `gradeTypedTest` function (vocabulary grading)

**Evidence:** `functions/index.js` (full file read)
- Only export: `exports.gradeTypedTest` - vocabulary grading function
- No AP-related functions
- No pause session endpoint
- No HTTP endpoints beyond the grading callable

**Conclusion:** **NO backend endpoint exists for pausing sessions.** All session state writes are client-side Firestore operations.

---

## Summary of Critical Findings

### Working Features:
- ✅ IndexedDB queue persistence (db: `ap_boost_queue`, store: `actions`)
- ✅ Basic debounce (1000ms, hardcoded)
- ✅ Exponential backoff retry (2s, 4s, 8s, 16s, max 5 retries)
- ✅ Online/offline detection
- ✅ Heartbeat with takeover detection (15s interval, MAX_FAILURES=3)
- ✅ ANSWER_CHANGE, NAVIGATION, TIMER_SYNC persisted

### Broken/Missing Features:
- ❌ FLAG_TOGGLE: Case exists but empty body - never persisted
- ❌ ANNOTATION_UPDATE: Not in switch - never persisted
- ❌ SECTION_COMPLETE: Not implemented
- ❌ SESSION_PAUSE: Not implemented
- ❌ beforeunload status update: Only shows dialog
- ❌ Heartbeat recovery → queue flush integration
- ❌ visibilitychange → queue flush integration
- ❌ "Opportunistic mode": Not implemented
- ❌ CONFIRMED status for queue items: Items deleted immediately
- ❌ Backend pause endpoint: Does not exist
- ❌ getActiveSession includes PAUSED: Only queries IN_PROGRESS

### Schema Gaps:
- ❌ `completedSections` field not in canonical schema
- ❌ `currentSubQuestionLabel` not persisted to Firestore

---

## Evidence Index

| Topic | File | Lines |
|-------|------|-------|
| Session schema | apSessionService.js | L49-L67 |
| IndexedDB config | useOfflineQueue.js | L8-L11 |
| IndexedDB schema | useOfflineQueue.js | L28-L36 |
| Queue item shape | useOfflineQueue.js | L131-L138 |
| addToQueue | useOfflineQueue.js | L125-L160 |
| flushQueue | useOfflineQueue.js | L173-L266 |
| scheduleFlush | useOfflineQueue.js | L162-L170 |
| Retry logic | useOfflineQueue.js | L257-L262 |
| Online handler | useOfflineQueue.js | L86-L91 |
| Heartbeat interval | useHeartbeat.js | L9-L10 |
| Heartbeat logic | useHeartbeat.js | L27-L78 |
| visibilitychange (heartbeat) | useHeartbeat.js | L101-L113 |
| beforeunload (warning) | useTestSession.js | L209-L220 |
| beforeunload (tab guard) | useDuplicateTabGuard.js | L115-L126 |
| getActiveSession | apSessionService.js | L84-L104 |
| SESSION_STATUS enum | apTypes.js | L34-L39 |
| COLLECTIONS | apTypes.js | L90-L98 |
| Backend functions | functions/index.js | L38-L312 |
