# CODEBASE_FACTS__01__1.1_to_1.4

**Generated:** 2026-01-14
**Chunk ID:** `01__1.1_to_1.4`

---

## 1) Canonical Data Schema / Source-of-Truth

**Found:** Yes

### Session State Fields (Firestore `ap_session_state` collection)

**Source:** `apSessionService.js:49-67`

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
  sectionTimeRemaining: {},       // Object keyed by sectionId -> seconds remaining
  answers: {},                    // Object keyed by questionId -> answer value
  flaggedQuestions: [],           // Array of questionId strings
  annotations: {},                // Object (unused in code, but defined)
  strikethroughs: {},             // Object (unused in code, but defined)
  lastHeartbeat: serverTimestamp(),
  lastAction: serverTimestamp(),
  startedAt: serverTimestamp(),
  completedAt: null,
}
```

### SESSION_STATUS Constants

**Source:** `apTypes.js:34-39`

```javascript
export const SESSION_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
}
```

- **Note:** `PENDING_SUBMIT` and `AUTO_SUBMIT` statuses do **NOT EXIST** in the current codebase.

### Collection Names

**Source:** `apTypes.js:89-98`

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

### flaggedQuestions Shape

- **Type:** Array of strings (questionId values)
- **Local State:** `Set<string>` in `useTestSession.js:43` — `const [flags, setFlags] = useState(new Set())`
- **Firestore:** Array of strings (converted from Set on resume at `useTestSession.js:194`)

### Annotations Shape (Local State)

**Source:** `useAnnotations.js:21-30`

- **highlights:** `Map<questionId, Array<{ start, end, color }>>`
- **strikethroughs:** `Map<questionId, Set<choiceId>>`

**Firestore Schema (defined but not actively synced):**

**Source:** `apSessionService.js:61-62`
```javascript
annotations: {},      // Object keyed by questionId
strikethroughs: {},   // Object keyed by questionId
```

### Timer State Shape

- **Firestore field:** `sectionTimeRemaining` — Object keyed by sectionId → number (seconds)
- **Local:** `useTimer.js:19` — `timeRemaining` state (single number for current section)
- **No `pausedAt` or `status` field** — pause state is entirely local (`isRunning` boolean)

---

## 2) Write Paths

**Found:** Yes

### Direct Firestore Writes (Services)

| Function | File:Line | Fields Written |
|----------|-----------|----------------|
| `saveAnswer` | `apSessionService.js:131-141` | `answers.{questionId}`, `lastAction` |
| `toggleQuestionFlag` | `apSessionService.js:150-176` | `flaggedQuestions`, `lastAction` (read-modify-write) |
| `updatePosition` | `apSessionService.js:185-196` | `currentSectionIndex`, `currentQuestionIndex`, `lastAction` |
| `updateTimer` | `apSessionService.js:205-215` | `sectionTimeRemaining.{sectionId}`, `lastAction` |
| `completeSession` | `apSessionService.js:222-233` | `status`, `completedAt`, `lastAction` |
| `updateSession` (generic) | `apSessionService.js:112-122` | Any fields + `lastAction` |

### Offline Queue Writes

**Source:** `useOfflineQueue.js:200-225`

Actions handled in `flushQueue()`:

| Action | Handled? | Fields Written |
|--------|----------|----------------|
| `ANSWER_CHANGE` | ✅ Yes | `answers.{questionId}` |
| `FLAG_TOGGLE` | ❌ **EMPTY CASE** | Nothing (comment: "Flags need special handling") |
| `NAVIGATION` | ✅ Yes | `currentSectionIndex`, `currentQuestionIndex` |
| `TIMER_SYNC` | ✅ Yes | `sectionTimeRemaining.{sectionId}` |
| `ANNOTATION_UPDATE` | ❌ **NOT IN SWITCH** | Not handled at all |
| `AUTO_SUBMIT` | ❌ **NOT IN SWITCH** | Not handled |
| `SESSION_STATUS` | ❌ **NOT IN SWITCH** | Not handled |

**Evidence:** `useOfflineQueue.js:203-225`
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
    if (item.payload.sectionTimeRemaining) {
      Object.entries(item.payload.sectionTimeRemaining).forEach(([sectionId, time]) => {
        updates[`sectionTimeRemaining.${sectionId}`] = time
      })
    }
    break
  default:
    break
}
```

### Submit Flow

**Source:** `useTestSession.js:396-421`

```javascript
const submitTest = useCallback(async (frqData = null) => {
  if (!session?.id || isSubmitting) return null

  try {
    setIsSubmitting(true)
    timer.pause()                    // 1. Stop timer locally

    if (queueLength > 0) {
      await flushQueue()             // 2. Flush queue (AWAITED)
    }

    const resultId = await createTestResult(session.id, frqData)  // 3. Create result

    return resultId
  } catch (err) {
    // error handling
  }
})
```

**Key Observation:** `flushQueue()` IS awaited before `createTestResult()` — ordering is enforced at `useTestSession.js:406-408`.

### submitSection Implementation

**Source:** `useTestSession.js:385-393`

```javascript
const submitSection = useCallback(async () => {
  // For Phase 1, we just go to next section
  // In future, this would lock the section and start next timer
  if (currentSectionIndex < (test?.sections?.length || 1) - 1) {
    setCurrentSectionIndex(prev => prev + 1)
    setCurrentQuestionIndex(0)
  }
}, [currentSectionIndex, test?.sections?.length])
```

- **Does NOT call `flushQueue()`**
- **Does NOT update Firestore status**
- **Just advances local state indices**

### handleTimerExpire Implementation

**Source:** `useTestSession.js:136-140`

```javascript
const handleTimerExpire = useCallback(() => {
  // Auto-submit when timer expires
  console.log('Timer expired, auto-submitting...')
  // Could trigger auto-submit here
}, [])
```

- **Only logs to console**
- **Does NOT call `submitTest()` or `submitSection()`**
- **Comment indicates future work**

### Timer onExpire Wiring

**Source:** `useTestSession.js:152-157`

```javascript
const timer = useTimer({
  initialTime,
  onExpire: handleTimerExpire,   // ✅ Passed to useTimer
  onTick: handleTimerTick,
  isPaused: false,
})
```

**Source:** `useTimer.js:84-89` — onExpire IS invoked when timer reaches 0:

```javascript
if (newTime <= 0) {
  setIsExpired(true)
  setIsRunning(false)
  if (onExpireRef.current) {
    onExpireRef.current()          // ✅ Called
  }
  return 0
}
```

---

## 3) Offline/Resilience Mechanics

**Found:** Yes (IndexedDB-backed queue exists)

### IndexedDB Configuration

**Source:** `useOfflineQueue.js:8-11`

```javascript
const DB_NAME = 'ap_boost_queue'
const STORE_NAME = 'actions'
const DB_VERSION = 1
```

### Queue Item Structure

**Source:** `useOfflineQueue.js:131-138`

```javascript
const queueItem = {
  id: generateId(),              // Unique ID: timestamp-random
  sessionId,                     // Current session
  localTimestamp: Date.now(),    // When queued
  action: action.action,         // Action type string
  payload: action.payload,       // Action-specific data
  status: 'PENDING',             // Status for processing
}
```

### IndexedDB Schema

**Source:** `useOfflineQueue.js:28-34`

```javascript
const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
store.createIndex('sessionId', 'sessionId', { unique: false })
store.createIndex('status', 'status', { unique: false })
```

### Flush Behavior

| Aspect | Implementation |
|--------|----------------|
| Batching | Single batch per `flushQueue()` call — all pending items processed together |
| Retry Logic | Exponential backoff: 2s, 4s, 8s, 16s (max 5 retries) |
| Ordering | Items processed in order queued (FIFO by array order from IndexedDB) |
| Deletion | Items deleted after successful Firestore write |

**Evidence:** `useOfflineQueue.js:254-262`
```javascript
retryCountRef.current++
if (retryCountRef.current < 5) {
  const delay = Math.pow(2, retryCountRef.current) * 1000 // 2s, 4s, 8s, 16s
  scheduleFlush(delay)
}
```

### Reconciliation on Resume

**Source:** `useTestSession.js:176-196`

- Session state IS restored from Firestore on mount
- No timestamp comparison or conflict resolution
- No check for stale local queue vs server state

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

### Idempotency Hazards

1. **FLAG_TOGGLE replay hazard:** Since FLAG_TOGGLE is not persisted via queue (empty case), toggle replays are not possible via this path. However, if FLAG_TOGGLE were implemented, replaying the same toggle would flip state incorrectly (no idempotency key).

2. **TOGGLE_STRIKETHROUGH replay hazard:** Strikethroughs use Set toggle logic locally (`useAnnotations.js:94-108`), but ANNOTATION_UPDATE actions are never flushed to Firestore — so no server-side replay issue.

3. **Highlight removal by index hazard:**
   - `removeHighlight` uses array index (`useAnnotations.js:54-58`)
   - `REMOVE_HIGHLIGHT` queued with `index` in payload (`useAnnotations.js:66`)
   - Since ANNOTATION_UPDATE is never flushed, no server-side mismatch possible currently
   - **If implemented,** index-based removal could cause wrong highlight deletion after merges

---

## 4) UI/Flow Entry Points

**Found:** Yes

### Timer Start/Pause/Resume

| Operation | Location | Trigger |
|-----------|----------|---------|
| Start | `useTestSession.js:232` | `startTest()` calls `timer.start()` |
| Pause | `useTestSession.js:403` | `submitTest()` calls `timer.pause()` |
| Resume | Not called | No explicit resume in codebase |

### Review Mode Entry

**Source:** `APTestSession.jsx:171-174`

```javascript
const handleGoToReview = () => {
  setView('review')
}
```

- Called from `QuestionNavigator` via `onGoToReview` prop (line 491)
- User clicks "Review" button at end of navigation

### ReviewScreen Rendering

**Source:** `APTestSession.jsx:352-384`

```jsx
if (view === 'review') {
  const sectionQuestions = currentSection?.questionIds?.map((qId, idx) => ({
    id: qId,
    index: idx,
  })) || []

  return (
    <ReviewScreen
      section={currentSection}
      questions={sectionQuestions}      // Only id and index, NOT full question objects
      answers={answers}                  // Full answers Map
      flags={flags}                      // Full flags Set
      onGoToQuestion={...}
      onSubmit={handleSubmit}
      onCancel={handleReturnFromReview}
      isSubmitting={isSubmitting}
      isFinalSection={...}
    />
  )
}
```

- **questions:** Array of `{ id, index }` — NO full question objects
- **answers:** Full Map available
- **flags:** Full Set available
- **annotations/strikethroughs:** NOT passed to ReviewScreen

### Review Question Modal/Panel

**NOT FOUND** — ReviewScreen only shows a grid of boxes, no modal for viewing individual questions with annotations.

### Strikethrough UI

**Source:** `AnswerInput.jsx:82-101`

```jsx
{onStrikethrough && (
  <button
    type="button"
    onClick={() => onStrikethrough(letter)}
    disabled={disabled}
    className={`
      p-2 rounded-[--radius-button-sm] border transition-colors shrink-0
      ${isStruckThrough
        ? 'bg-muted border-border-strong text-text-secondary'
        : 'bg-surface border-border-default text-text-muted hover:text-text-secondary'
      }
    `}
    title={isStruckThrough ? 'Remove strikethrough' : 'Strike through'}
  >
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-3-3v6" />
    </svg>
  </button>
)}
```

- **Icon:** Plus sign (`M9 12h6m-3-3v6`) — NOT an X
- **Styling:** `line-through` class applied to choice text (`AnswerInput.jsx:69`)
- **No right-click or long-press handling**

### Highlight Rendering/Overlap

**Source:** `Highlighter.jsx:45-78`

```javascript
// Sort highlights by start position
const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start)

// Build segments
const segments = []
let lastEnd = 0

sortedHighlights.forEach((highlight, idx) => {
  if (highlight.start > lastEnd) {
    segments.push({ type: 'normal', text: content.slice(lastEnd, highlight.start) })
  }
  segments.push({
    type: 'highlight',
    text: content.slice(highlight.start, highlight.end),
    color: highlight.color,
    index: idx,
  })
  lastEnd = Math.max(lastEnd, highlight.end)
})
```

- Highlights sorted by start position
- Overlapping highlights: `lastEnd = Math.max(lastEnd, highlight.end)` — overlaps are NOT merged, later text may be cut short if overlapping

---

## 5) Must-Answer Questions

### Q1: Timer expire wiring — Where is `onExpire` invoked, and is `handleTimerExpire` actually passed into `useTimer`?

**Answer:** Yes

- `handleTimerExpire` is defined at `useTestSession.js:136-140`
- Passed to `useTimer` at `useTestSession.js:154`
- `onExpire` is invoked in `useTimer.js:87-88` when `newTime <= 0`

### Q2: Auto-submit logic today — On timer expiry, does code call `submitTest`/`submitSection`, or only log?

**Answer:** Only logs

**Evidence:** `useTestSession.js:136-140`
```javascript
const handleTimerExpire = useCallback(() => {
  console.log('Timer expired, auto-submitting...')
  // Could trigger auto-submit here
}, [])
```

No call to `submitTest()` or `submitSection()`.

### Q3: Submission ordering — Is `flushQueue()` awaited before final submission/scoring/result creation?

**Answer:** Yes

**Evidence:** `useTestSession.js:405-411`
```javascript
if (queueLength > 0) {
  await flushQueue()                // ✅ Awaited
}
const resultId = await createTestResult(session.id, frqData)
```

### Q4: Canonical timer state — Is remaining time persisted anywhere?

**Answer:** Yes

- **Firestore field:** `sectionTimeRemaining.{sectionId}` (number of seconds)
- **Queued via:** `TIMER_SYNC` action every 30 seconds (`useTestSession.js:143-150`)
- **No `pausedAt` timestamp** — pause is local-only state

**Evidence:** `useTestSession.js:143-150`
```javascript
const handleTimerTick = useCallback((newTime) => {
  if (session?.id && currentSection?.id && newTime % 30 === 0) {
    addToQueue({
      action: 'TIMER_SYNC',
      payload: { sectionTimeRemaining: { [currentSection.id]: newTime } }
    })
  }
}, [session?.id, currentSection?.id, addToQueue])
```

### Q5: Lifecycle events — Does the app listen to `visibilitychange`, `pagehide`, `beforeunload`?

**Answer:** Partial

| Event | Found? | Location | Behavior |
|-------|--------|----------|----------|
| `beforeunload` | ✅ Yes | `useTestSession.js:209-220` | Warns if `queueLength > 0` |
| `beforeunload` | ✅ Yes | `useDuplicateTabGuard.js:115-126` | Empty handler (noop) |
| `visibilitychange` | ✅ Yes | `useHeartbeat.js:101-113` | Triggers heartbeat when tab becomes visible |
| `pagehide` | ❌ No | — | NOT implemented |
| `sendBeacon` | ❌ No | — | NOT implemented |

**Evidence:** `useHeartbeat.js:101-113`
```javascript
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && sessionId && instanceToken) {
    doHeartbeat()
  }
}
document.addEventListener('visibilitychange', handleVisibilityChange)
```

- **No action on `hidden` state** — only acts when becoming visible
- **Does NOT pause timer** on background
- **Does NOT sync queue** on background

### Q6: Mobile background threshold — Is there any ">30s background → pause" threshold?

**Answer:** No

- **NOT FOUND** in any implementation file
- Only references exist in criteria_audit and fix_plan documentation files

### Q7: Offline queue presence — Is there an IndexedDB/localforage-backed queue?

**Answer:** Yes

**Evidence:** `useOfflineQueue.js:8-37`
```javascript
const DB_NAME = 'ap_boost_queue'
const STORE_NAME = 'actions'
// ... IndexedDB initialization in openDatabase()
```

- Initialized in `useOfflineQueue.js:60-82`
- Persisted immediately on `addToQueue` (`useOfflineQueue.js:140-148`)
- Rehydrated: Queue length checked on init, but **no explicit rehydration of local state from queue**

### Q8: Queue write paths — Are specific actions handled in `flushQueue`?

**Answer:** Partial

| Action | Handled? | Evidence |
|--------|----------|----------|
| `FLAG_TOGGLE` | ❌ Empty case | `useOfflineQueue.js:208-210` — comment only |
| `ANNOTATION_UPDATE` | ❌ Missing | Not in switch statement |
| `AUTO_SUBMIT` | ❌ Missing | Not in switch statement |
| `SESSION_STATUS` | ❌ Missing | Not in switch statement |
| `TIMER_SYNC` | ✅ Yes | `useOfflineQueue.js:214-220` |

### Q9: Idempotency for toggles — Does code ensure final state correctness for replayed toggles?

**Answer:** No idempotency implemented

- `FLAG_TOGGLE` not actually persisted via queue (empty case)
- `toggleQuestionFlag` in service uses read-modify-write (`apSessionService.js:150-176`) — no idempotency key
- Local strikethrough toggle is Set-based (correct locally), but never synced

### Q10: Annotation removal hazards — Are highlights removed by index?

**Answer:** Yes

**Evidence:** `useAnnotations.js:54-58`
```javascript
const removeHighlight = useCallback((questionId, index) => {
  setHighlights(prev => {
    const next = new Map(prev)
    const existing = next.get(questionId) || []
    next.set(questionId, existing.filter((_, i) => i !== index))
    return next
  })
  // ...
})
```

- Uses array filter by index
- Queue payload includes `index` (`useAnnotations.js:66`)
- **Hazard exists** but currently mitigated because `ANNOTATION_UPDATE` is never flushed

### Q11: Review mode rendering — Is there UI that renders full question content with highlights + strikethroughs in read-only mode?

**Answer:** No

- `ReviewScreen.jsx` is **summary-only** — shows grid of question boxes with answered/flagged status
- Does NOT receive `annotations` or `strikethroughs` props
- Does NOT render full question content
- No review modal exists

**Evidence:** `APTestSession.jsx:368-381` — props passed to ReviewScreen:
```jsx
<ReviewScreen
  section={currentSection}
  questions={sectionQuestions}   // Only { id, index }
  answers={answers}
  flags={flags}
  // NO annotations prop
  // NO strikethroughs prop
  ...
/>
```

### Q12: Flagged question listing — Does ReviewScreen display flagged question numbers (Q1, Q5, …) or only a count?

**Answer:** Only count

**Evidence:** `ReviewScreen.jsx:49, 95`
```javascript
const flaggedCount = questions.filter(q => flags.has(q.id || q)).length
// ...
<li>• Flagged: {flaggedCount}</li>
```

- Displays `Flagged: {count}` only
- **Does NOT list individual flagged question numbers**
- Compare with unanswered which DOES list: `Q{unansweredQuestions.join(', Q')}` (line 92)

---

## Summary of Key Findings

| Feature | Status | Notes |
|---------|--------|-------|
| Timer expire → auto-submit | ❌ Not implemented | Only logs |
| Mobile backgrounding pause | ❌ Not implemented | No threshold logic |
| `beforeunload` → queue flush | ❌ Not implemented | Only warns user |
| `beforeunload` → timer sync | ❌ Not implemented | Only warns user |
| `FLAG_TOGGLE` persistence | ❌ Not implemented | Empty case in flushQueue |
| `ANNOTATION_UPDATE` persistence | ❌ Not implemented | Missing from switch |
| Review screen flagged list | ❌ Count only | No Q# list |
| Review mode question modal | ❌ Not implemented | Summary grid only |
| Highlight overlap handling | ⚠️ Basic | May truncate overlapping regions |
| IndexedDB queue | ✅ Implemented | Working for ANSWER_CHANGE, NAVIGATION, TIMER_SYNC |
| Submission queue flush ordering | ✅ Implemented | flushQueue awaited before createTestResult |
