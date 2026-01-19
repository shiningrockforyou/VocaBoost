# CODEBASE_FACTS__05__5.6_to_5.8

**Inspector:** Claude Agent
**Date:** 2026-01-14
**Chunk ID:** 05__5.6_to_5.8
**Scope:** Timer pause on browser/tab close, mobile background handling, optional pause button, resume flow for PAUSED sessions, submit sync UX, flush retry policy

---

## 1) Canonical Data Schema / Source-of-Truth

**Found: Yes**

### SESSION_STATUS Enum Definition
- **Location:** `src/apBoost/utils/apTypes.js:34-39`
- **Values:** `NOT_STARTED`, `IN_PROGRESS`, `PAUSED`, `COMPLETED`

**Evidence (apTypes.js:34-39):**
```javascript
export const SESSION_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
}
```

### Session Document Schema
- **Collection:** `ap_session_state` (defined in `COLLECTIONS.SESSION_STATE` at `apTypes.js:94`)
- **Source-of-truth:** `src/apBoost/services/apSessionService.js:47-67`

**Evidence (apSessionService.js:47-67):**
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
  sectionTimeRemaining: {},    // ← per-section map of sectionId → seconds
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

### Key Schema Facts
| Field | Type | Location Written | Notes |
|-------|------|------------------|-------|
| `status` | String (enum) | apSessionService.js:54, 225 | Only `IN_PROGRESS` and `COMPLETED` are written today |
| `sectionTimeRemaining` | Object `{ [sectionId]: number }` | Queue via `TIMER_SYNC` action | Seconds remaining per section |
| `lastAction` | Timestamp | apSessionService.js:64, 117, etc. | Updated on every session write |
| `pausedAt` | - | **NOT FOUND** | Does not exist in current schema |
| `allowPause` | - | **NOT FOUND** | Does not exist in test/section config |

### PAUSED Status Usage
- **Defined:** Yes (`apTypes.js:37`)
- **Written anywhere:** **NO** — never written to Firestore
- **Queried anywhere:** **NO** — `getActiveSession` only queries `IN_PROGRESS`

**Evidence (apSessionService.js:86-91):**
```javascript
const sessionsQuery = query(
  collection(db, COLLECTIONS.SESSION_STATE),
  where('testId', '==', testId),
  where('userId', '==', userId),
  where('status', '==', SESSION_STATUS.IN_PROGRESS)  // Does NOT include PAUSED
)
```

---

## 2) Write Paths

**Found: Yes**

### Timer Tick Persistence
- **Mechanism:** Queued via `TIMER_SYNC` action in useTestSession.js
- **Cadence:** Every 30 seconds (when `newTime % 30 === 0`)
- **Verify 30s claim:** Confirmed

**Evidence (useTestSession.js:142-150):**
```javascript
const handleTimerTick = useCallback((newTime) => {
  // Save timer every 30 seconds via queue
  if (session?.id && currentSection?.id && newTime % 30 === 0) {
    addToQueue({
      action: 'TIMER_SYNC',
      payload: { sectionTimeRemaining: { [currentSection.id]: newTime } }
    })
  }
}, [session?.id, currentSection?.id, addToQueue])
```

### Queue Action Types Currently Used
| Action | File | Line | Description |
|--------|------|------|-------------|
| `TIMER_SYNC` | useTestSession.js | 146 | Timer persistence |
| `NAVIGATION` | useTestSession.js | 252, 283 | Position updates |
| `ANSWER_CHANGE` | useTestSession.js | 352 | Answer saves |
| `FLAG_TOGGLE` | useTestSession.js | 380 | Question flagging |
| `ANNOTATION_UPDATE` | useAnnotations.js | 47, 65, 82, 113, 134, 174 | Highlights/strikethroughs |

### Queue Flush to Firestore
- **Location:** `src/apBoost/hooks/useOfflineQueue.js:172-266`
- **Write mechanism:** Single `updateDoc` with merged fields

**Evidence (useOfflineQueue.js:227-236):**
```javascript
if (Object.keys(updates).length > 0) {
  updates.lastAction = serverTimestamp()

  // Write to Firestore with timeout
  await withTimeout(
    updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), updates),
    TIMEOUTS.FIRESTORE_WRITE,
    'Queue flush'
  )
}
```

### Direct Firestore Writes (Bypassing Queue)
| Location | Function | Purpose |
|----------|----------|---------|
| `apSessionService.js:69` | `setDoc` | Create new session |
| `apSessionService.js:114-117` | `updateSession` | Generic session update |
| `apSessionService.js:131-136` | `saveAnswer` | Direct answer save (exported but not used from UI) |
| `apSessionService.js:168-171` | `toggleQuestionFlag` | Direct flag toggle (exported but not used from UI) |
| `apSessionService.js:187-191` | `updatePosition` | Direct position update (exported but not used from UI) |
| `apSessionService.js:207-210` | `updateTimer` | Direct timer update (exported but not used from UI) |
| `apSessionService.js:224-228` | `completeSession` | Mark session COMPLETED |
| `apSessionService.js:260-262` | `updateHeartbeat` | Heartbeat timestamp |
| `useHeartbeat.js:55-58` | `updateDoc` | Heartbeat + sessionToken |
| `useDuplicateTabGuard.js:33-36` | `updateDoc` | Claim session token |

**Key Finding:** The UI (useTestSession) uses the offline queue for answers, navigation, timer, and flags. The direct Firestore functions in apSessionService exist but are NOT called from the UI during normal test-taking. Only `completeSession` is called at submit time.

### Session Status Write Paths
| Status | Where Written | How |
|--------|--------------|-----|
| `IN_PROGRESS` | apSessionService.js:54 | On `createOrResumeSession` |
| `COMPLETED` | apSessionService.js:225 | On `completeSession(sessionId)` |
| `PAUSED` | **NOWHERE** | Not implemented |

### "Pause Session" Write Path
**Found: No** — No function, queue action, or UI to write PAUSED status exists.

---

## 3) Offline/Resilience Mechanics

**Found: Yes**

### Offline Queue Implementation
- **File:** `src/apBoost/hooks/useOfflineQueue.js`
- **Storage:** IndexedDB (`ap_boost_queue` database, `actions` store)

**Evidence (useOfflineQueue.js:8-11):**
```javascript
const DB_NAME = 'ap_boost_queue'
const STORE_NAME = 'actions'
const DB_VERSION = 1
```

### Queue Item Schema
**Evidence (useOfflineQueue.js:131-138):**
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

### flushQueue Behavior
- **Batching:** Yes — reads all PENDING items, builds single `updates` object, writes once
- **Per-item handling:** Switch statement per action type (lines 204-224)
- **Idempotency:** Partial — uses last-write-wins for each field, no explicit deduplication
- **Cleanup:** Deletes processed items after successful Firestore write

**Evidence (useOfflineQueue.js:201-225):**
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
      if (item.payload.sectionTimeRemaining) {
        Object.entries(item.payload.sectionTimeRemaining).forEach(([sectionId, time]) => {
          updates[`sectionTimeRemaining.${sectionId}`] = time
        })
      }
      break
    default:
      break
  }
}
```

### Retry Policy
- **Formula:** Exponential backoff: `Math.pow(2, retryCount) * 1000` ms
- **Delays:** 2s, 4s, 8s, 16s (then stops)
- **Max retries:** 5 (via `retryCountRef.current < 5` check)
- **Stop condition:** After 5 failures

**Evidence (useOfflineQueue.js:257-262):**
```javascript
// Exponential backoff retry
retryCountRef.current++
if (retryCountRef.current < 5) {
  const delay = Math.pow(2, retryCountRef.current) * 1000 // 2s, 4s, 8s, 16s
  scheduleFlush(delay)
}
```

### "Aggressive Submit Mode"
**Found: No** — No separate retry policy, parameter, or flag for submit vs background flushes.

### Lifecycle Hooks for Flush/Persist
| Event | File | Lines | Behavior |
|-------|------|-------|----------|
| `online` | useOfflineQueue.js | 86-91 | Resets retryCount, schedules flush in 1s |
| `offline` | useOfflineQueue.js | 93-95 | Sets `isOnline = false` |
| `beforeunload` | useTestSession.js | 209-220 | Shows warning if queue not empty, **does NOT flush** |
| `visibilitychange` | useHeartbeat.js | 101-113 | Triggers heartbeat, **does NOT flush queue** |

**Key Finding:** No lifecycle handler attempts to flush the queue on unload/visibility change. Only the heartbeat fires on visibilitychange='visible'.

---

## 4) UI/Flow Entry Points

**Found: Yes**

### beforeunload/pagehide/visibilitychange Listeners

| Event | Hook/Component | Lines | Purpose |
|-------|----------------|-------|---------|
| `beforeunload` | useTestSession.js | 209-220 | Warning dialog if unsaved changes |
| `beforeunload` | useDuplicateTabGuard.js | 115-126 | Empty handler (no-op) |
| `visibilitychange` | useHeartbeat.js | 101-113 | Heartbeat on visible |
| `online`/`offline` | useOfflineQueue.js | 84-104 | Track online status |
| `pagehide` | **NOT FOUND** | — | Not implemented |
| `sendBeacon` | **NOT FOUND** | — | Not implemented |

**Evidence (useTestSession.js:209-220):**
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

### Timer Pause/Resume UI Location
- **Timer display:** `src/apBoost/components/TestTimer.jsx` — display only, no controls
- **Header render:** `APTestSession.jsx:403-411` — shows timer in header
- **Pause button:** **NOT FOUND** — no UI element to pause timer

**Evidence (APTestSession.jsx:403-411):**
```jsx
<header className="bg-surface border-b border-border-default px-4 py-3 flex items-center justify-between">
  <div className="flex items-center gap-4">
    <span className="text-text-secondary text-sm">
      Section {position.sectionIndex + 1} of {test?.sections?.length || 1}:{' '}
      {currentSection?.title || 'Multiple Choice'}
    </span>
  </div>
  <TestTimer timeRemaining={timeRemaining} />
</header>
```

### Syncing/Submit Modal
- **Dedicated SyncingModal:** **NOT FOUND** — component does not exist
- **Submit UI:** ReviewScreen.jsx shows spinner in button when `isSubmitting` is true

**Evidence (ReviewScreen.jsx:138-145):**
```jsx
{isSubmitting ? (
  <>
    <svg className="animate-spin h-4 w-4" ... />
    Submitting...
  </>
) : (
  isFinalSection ? 'Submit Test' : 'Submit Section'
)}
```

**State triggers:**
- `isSubmitting`: Set in useTestSession.js:400 when `submitTest` is called
- `isFlushing`: Exposed from useOfflineQueue but **NOT used** in UI
- `queueLength`: Exposed but **NOT displayed** to user during submit

### Resume Prompt Location
- **Component:** `src/apBoost/components/InstructionScreen.jsx`
- **Resume condition:** Checks `existingSession?.status === SESSION_STATUS.IN_PROGRESS`

**Evidence (InstructionScreen.jsx:19):**
```javascript
const isResuming = existingSession?.status === SESSION_STATUS.IN_PROGRESS
```

**Evidence (InstructionScreen.jsx:66-73):**
```jsx
{isResuming && existingSession && (
  <div className="bg-info rounded-[--radius-alert] p-4 mb-6">
    <p className="text-info-text-strong text-sm">
      Resume from: Section {existingSession.currentSectionIndex + 1},
      Question {existingSession.currentQuestionIndex + 1}
    </p>
  </div>
)}
```

**Key Finding:** InstructionScreen only checks `IN_PROGRESS`, NOT `PAUSED`. If PAUSED were used, this logic would need updating.

---

## 5) Must-Answer Questions

### Q1: Does SESSION_STATUS.PAUSED exist, and is it used anywhere besides constants?

**A:** PAUSED is **defined** but **never used** operationally.

**Evidence (apTypes.js:37):**
```javascript
PAUSED: 'PAUSED',
```

Usage search results:
- Not written to Firestore anywhere
- Not queried in `getActiveSession`
- Not checked in InstructionScreen resume logic
- Not referenced in any hook or component logic

---

### Q2: What is the exact stored shape/type for sectionTimeRemaining?

**A:** Object/Map where keys are section IDs (strings) and values are numbers (seconds remaining).

**Evidence (apSessionService.js:58):**
```javascript
sectionTimeRemaining: {},    // Initial empty object
```

**Evidence (useTestSession.js:130-133):**
```javascript
const savedTime = session?.sectionTimeRemaining?.[currentSection.id]
if (savedTime != null) return savedTime
// Otherwise use section time limit (minutes to seconds)
return (currentSection.timeLimit || 45) * 60
```

**Evidence (useOfflineQueue.js:216-220):**
```javascript
case 'TIMER_SYNC':
  if (item.payload.sectionTimeRemaining) {
    Object.entries(item.payload.sectionTimeRemaining).forEach(([sectionId, time]) => {
      updates[`sectionTimeRemaining.${sectionId}`] = time
    })
  }
  break
```

**Shape:** `{ [sectionId: string]: number (seconds) }`

---

### Q3: On browser/tab close, is there currently any lifecycle handler that attempts to persist timer/session state?

**A:** **Only a warning dialog**, no state persistence.

**Evidence (useTestSession.js:209-220):**
```javascript
const handleBeforeUnload = (e) => {
  if (queueLength > 0) {
    e.preventDefault()
    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
    return e.returnValue
  }
}
```

- No `navigator.sendBeacon` call
- No Firestore write attempt
- No queue flush attempt
- No PAUSED status update

---

### Q4: Is the offline queue the only write path for timer ticks and answer changes, or are there direct Firestore writes?

**A:** **Queue is the only write path used from UI** for answers, timer, navigation, and flags.

Direct Firestore functions exist in `apSessionService.js` (`saveAnswer`, `updateTimer`, `updatePosition`, `toggleQuestionFlag`) but they are **NOT called** from `useTestSession` or `APTestSession`. The UI exclusively uses `addToQueue()`.

**Evidence (useTestSession.js:351-359):**
```javascript
// Queue for sync
addToQueue({
  action: 'ANSWER_CHANGE',
  payload: {
    questionId,
    value: answer,
    subQuestionLabel: position.subQuestionLabel
  }
})
```

**Exception:** Direct writes occur for:
- Session creation (`setDoc` in createOrResumeSession)
- Session completion (`updateDoc` in completeSession)
- Heartbeat (`updateDoc` in useHeartbeat)
- Session claim (`updateDoc` in useDuplicateTabGuard)

---

### Q5: What is the exact submit pipeline ordering today?

**A:** **flushQueue() → createTestResult()**, with a guard for empty queue.

**Evidence (useTestSession.js:395-421):**
```javascript
const submitTest = useCallback(async (frqData = null) => {
  if (!session?.id || isSubmitting) return null

  try {
    setIsSubmitting(true)

    // Stop timer
    timer.pause()

    // Flush any pending changes first
    if (queueLength > 0) {
      await flushQueue()
    }

    // Create test result
    const resultId = await createTestResult(session.id, frqData)

    return resultId
  } catch (err) { ... }
})
```

**Race condition risk:** If `flushQueue()` is already running (`isFlushing = true`), the submit flow does NOT wait for it. The `queueLength > 0` check would still trigger another flush, but `flushQueue()` has a guard:

**Evidence (useOfflineQueue.js:174-176):**
```javascript
if (!dbRef.current || !sessionId || isFlushing || !isOnline) {
  return
}
```

This means if a flush is in progress, `submitTest` calls `flushQueue()` which returns immediately (no-op), then proceeds to `createTestResult` potentially before the ongoing flush completes.

---

### Q6: What is the current flushQueue retry policy?

**A:** Exponential backoff with max 5 retries, no mode switch.

| Retry # | Delay |
|---------|-------|
| 1 | 2s |
| 2 | 4s |
| 3 | 8s |
| 4 | 16s |
| 5+ | Stops |

**Evidence (useOfflineQueue.js:257-262):**
```javascript
retryCountRef.current++
if (retryCountRef.current < 5) {
  const delay = Math.pow(2, retryCountRef.current) * 1000
  scheduleFlush(delay)
}
```

**No "aggressive" mode:** There is no parameter, flag, or separate function for different retry behavior during submit vs background.

---

### Q7: Is there any existing UI/modal for "syncing answers" or "submit progress"?

**A:** **No dedicated syncing modal exists.** Only a spinner in the Submit button.

- No `SyncingModal.jsx` component
- `ReviewScreen.jsx:138-145` shows "Submitting..." with spinner when `isSubmitting` is true
- `isFlushing` and `queueLength` are NOT displayed to user during submit

---

### Q8: Are there any existing hooks for visibilitychange that affect timers?

**A:** **Only for heartbeat, not for timer pause.**

**Evidence (useHeartbeat.js:101-113):**
```javascript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && sessionId && instanceToken) {
      doHeartbeat()
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
}, [sessionId, instanceToken, doHeartbeat])
```

- Only triggers when tab becomes **visible**
- Does NOT handle **hidden** state
- Does NOT pause timer
- Does NOT adjust elapsed time
- No 30s threshold for mobile background

---

### Q9: Is there any existing concept of user-initiated pause?

**A:** **NOT FOUND**

- No `allowPause` field in test or section config
- No pause button in UI
- No queue action for `SESSION_PAUSE`
- `useTimer` has `pause()` method but it's only called internally (on submit, timer expiry)

**Evidence (useTimer.js:46-49):**
```javascript
// Pause the timer
const pause = useCallback(() => {
  setIsRunning(false)
}, [])
```

This is called in `submitTest` at line 403 of useTestSession.js:
```javascript
timer.pause()
```

---

### Q10: How does "resume existing session" work today?

**A:** `getActiveSession` queries for `IN_PROGRESS` only, returns first matching session.

**Evidence (apSessionService.js:84-104):**
```javascript
export async function getActiveSession(testId, userId) {
  try {
    const sessionsQuery = query(
      collection(db, COLLECTIONS.SESSION_STATE),
      where('testId', '==', testId),
      where('userId', '==', userId),
      where('status', '==', SESSION_STATUS.IN_PROGRESS)
    )
    const sessionsSnap = await getDocs(sessionsQuery)

    if (sessionsSnap.empty) {
      return null
    }

    const doc = sessionsSnap.docs[0]
    return { id: doc.id, ...doc.data() }
  } catch (error) { ... }
}
```

**Resumable statuses:** Only `IN_PROGRESS`. PAUSED sessions would NOT be found.

**Resume flow:**
1. `useTestSession` calls `getActiveSession()` on mount (line 176)
2. If found, restores `currentSectionIndex`, `currentQuestionIndex`, `answers`, `flags` from session
3. `InstructionScreen` shows "Resume Test" button if `existingSession?.status === IN_PROGRESS`
4. `startTest()` calls `createOrResumeSession()` which returns existing session if found

---

## Summary Table

| Feature | Status | Evidence |
|---------|--------|----------|
| SESSION_STATUS.PAUSED defined | ✅ Yes | apTypes.js:37 |
| PAUSED written to Firestore | ❌ No | Not found |
| PAUSED queried for resume | ❌ No | getActiveSession:90 |
| pausedAt field | ❌ Not Found | — |
| allowPause config | ❌ Not Found | — |
| Timer persistence (30s) | ✅ Yes | useTestSession.js:142-150 |
| beforeunload handler | ✅ Yes (warning only) | useTestSession.js:209-220 |
| visibilitychange for timer pause | ❌ No | — |
| pagehide handler | ❌ No | — |
| sendBeacon usage | ❌ No | — |
| SyncingModal component | ❌ No | — |
| Aggressive submit retry | ❌ No | — |
| flushQueue → createTestResult order | ✅ Yes | useTestSession.js:406-411 |
| Race condition on flush | ⚠️ Possible | isFlushing guard returns early |
