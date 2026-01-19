# CODEBASE_FACTS__UNK__1.5_to_1.9

## 1) Canonical Data Schema / Source-of-Truth

- Found: **Yes**

### Source of Truth
- **Firestore** is the canonical source for session state
- Collection: `ap_session_state` (defined in `COLLECTIONS.SESSION_STATE`)
- Local state is optimistic and synced via IndexedDB queue

### SESSION_STATUS Enum
- **File:** `src/apBoost/utils/apTypes.js:34-39`
- Values: `NOT_STARTED`, `IN_PROGRESS`, `PAUSED`, `COMPLETED`
```javascript
export const SESSION_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
}
```

### ap_session_state Schema
- **File:** `src/apBoost/services/apSessionService.js:49-67`
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
  annotations: {},        // Object keyed by questionId
  strikethroughs: {},     // Object keyed by questionId
  lastHeartbeat: serverTimestamp(),
  lastAction: serverTimestamp(),
  startedAt: serverTimestamp(),
  completedAt: null,
}
```

### Key Observations
- **`completedSections` field:** **NOT FOUND** in current schema - mentioned only in fix plans
- **`pausedAt` field:** **NOT FOUND** in current schema - mentioned only in fix plans
- **`annotations` field:** Exists as empty object `{}` on creation, shape is `{questionId: HighlightRange[]}`
- **`strikethroughs` field:** Exists as empty object `{}` on creation, shape is `{questionId: string[]}`

### Assignment Schema
- **File:** `src/apBoost/services/apTeacherService.js:234-243`
```javascript
const newAssignment = {
  testId: assignmentData.testId,
  classIds: assignmentData.classIds || [],
  studentIds: assignmentData.studentIds || [],
  dueDate: assignmentData.dueDate || null,
  maxAttempts: assignmentData.maxAttempts || 1,
  frqSubmissionType: assignmentData.frqSubmissionType || 'TYPED',
  assignedBy: assignmentData.assignedBy,
  assignedAt: serverTimestamp(),
}
```
- **`maxAttempts`:** Exists with default value of 1

---

## 2) Write Paths

- Found: **Yes**

### Direct Firestore Writes
- **File:** `src/apBoost/services/apSessionService.js`
  - `createOrResumeSession()` (line 30-76) - `setDoc` for new session
  - `updateSession()` (line 112-122) - `updateDoc` for generic updates
  - `saveAnswer()` (line 131-141) - `updateDoc` for answer changes
  - `toggleQuestionFlag()` (line 150-176) - `updateDoc` for flag changes
  - `updatePosition()` (line 185-196) - `updateDoc` for navigation
  - `updateTimer()` (line 205-215) - `updateDoc` for timer sync
  - `completeSession()` (line 222-233) - `updateDoc` for completion

### Queued Writes (via useOfflineQueue)
- **File:** `src/apBoost/hooks/useOfflineQueue.js:173-266`
- Actions handled in `flushQueue` switch statement (lines 203-225):
  - `ANSWER_CHANGE` - Updates `answers.${questionId}`
  - `FLAG_TOGGLE` - Placeholder comment, **not fully implemented**
  - `NAVIGATION` - Updates `currentSectionIndex`, `currentQuestionIndex`
  - `TIMER_SYNC` - Updates `sectionTimeRemaining.${sectionId}`
  - **`ANNOTATION_UPDATE`** - **NOT HANDLED** (falls to default)
  - **`SECTION_COMPLETE`** - **NOT IMPLEMENTED**
  - **`SESSION_PAUSE`** - **NOT IMPLEMENTED**

### Queue Usage by Feature
| Feature | Uses Queue | Implementation Status |
|---------|-----------|----------------------|
| Section completion | Should use queue | **NOT IMPLEMENTED** |
| Session pause on hidden/unload | Should use queue | **NOT IMPLEMENTED** - beforeunload only shows warning |
| Annotation persistence | Queued as `ANNOTATION_UPDATE` | **Queued but NOT processed** in flushQueue |
| Attempt count updates | Direct write on session create | Works |

### flushQueue Location
- **File:** `src/apBoost/hooks/useOfflineQueue.js:173-266`

### Queue Persistence
- **Uses IndexedDB**
- **File:** `src/apBoost/hooks/useOfflineQueue.js:8-37`
```javascript
const DB_NAME = 'ap_boost_queue'
const STORE_NAME = 'actions'
const DB_VERSION = 1
```
- Items keyed by auto-generated `id` (timestamp + random string)
- Indexed by `sessionId` and `status`
- Items are ordered by `localTimestamp` (implicit via insertion order)

---

## 3) Offline/Resilience Mechanics

- Found: **Yes**

### Queue Persistence Implementation
- **File:** `src/apBoost/hooks/useOfflineQueue.js:16-37`
- Uses native IndexedDB (not localforage)
```javascript
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    // ... creates object store with keyPath 'id'
    // ... creates indexes on 'sessionId' and 'status'
  })
}
```

### Retry/Backoff Behavior
- **File:** `src/apBoost/hooks/useOfflineQueue.js:254-262`
```javascript
// Exponential backoff retry
retryCountRef.current++
if (retryCountRef.current < 5) {
  const delay = Math.pow(2, retryCountRef.current) * 1000 // 2s, 4s, 8s, 16s
  scheduleFlush(delay)
}
```

### Online/Offline Event Handling
- **File:** `src/apBoost/hooks/useOfflineQueue.js:84-104`
- Listens for `online`/`offline` events
- On `online`: resets retry count, schedules flush with 1s delay

### Lifecycle Hooks Present
| Hook | File | Location | Action |
|------|------|----------|--------|
| `beforeunload` | useTestSession.js | L208-220 | Shows warning if queue not empty - **does NOT set PAUSED** |
| `beforeunload` | useDuplicateTabGuard.js | L114-126 | **Empty handler** - explicitly does nothing |
| `visibilitychange` | useHeartbeat.js | L101-113 | Triggers heartbeat when tab becomes visible |
| `pagehide` | - | - | **NOT FOUND** |
| `navigator.sendBeacon` | - | - | **NOT FOUND** |

### beforeunload Handler Evidence
- **File:** `src/apBoost/hooks/useTestSession.js:208-220`
```javascript
const handleBeforeUnload = (e) => {
  if (queueLength > 0) {
    e.preventDefault()
    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
    return e.returnValue
  }
}
```
- **Does NOT write PAUSED status**

### visibilitychange Handler Evidence
- **File:** `src/apBoost/hooks/useHeartbeat.js:100-113`
```javascript
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && sessionId && instanceToken) {
    doHeartbeat()
  }
}
```
- **Only triggers on visible (tab foreground), NOT on hidden**
- **Does NOT set PAUSED status**

---

## 4) UI/Flow Entry Points

- Found: **Yes**

### LineReader Rendering
- **File:** `src/apBoost/components/tools/PassageDisplay.jsx:110-120`
```jsx
<LineReader
  contentRef={contentRef}
  enabled={lineReaderEnabled}
  position={lineReaderPosition}
  onPositionChange={onLineReaderMove}
  lineHeight={24}
  visibleLines={lineReaderLines}
/>
```
- Props received: `contentRef`, `enabled`, `position`, `onPositionChange`, `lineHeight` (fixed at 24), `visibleLines`

### Scroll Container Identity
- **File:** `src/apBoost/components/tools/PassageDisplay.jsx:76`
```jsx
<div className="flex-1 overflow-auto relative" ref={contentRef}>
```
- The scroll container is a `div` with `overflow-auto` class
- This `contentRef` is passed to LineReader

### Section Navigation UI
- **File:** `src/apBoost/pages/APTestSession.jsx:477-494`
- `QuestionNavigator` component renders Back/Next buttons
- Props: `canGoBack={canGoPrevious}`, `canGoNext={canGoNext}`

### Section/Question Index Change Origins
- **File:** `src/apBoost/hooks/useTestSession.js`
  - `goToFlatIndex(flatIndex)` - lines 242-260
  - `goToQuestion(index)` - lines 263-287
  - `goNext()` - lines 289-294
  - `goPrevious()` - lines 296-301
  - `setCurrentSectionIndex` - used directly in `submitSection()` line 390

### Annotation UI Rendering
- **File:** `src/apBoost/pages/APTestSession.jsx:91-111`
- Uses `useAnnotations` hook with session ID and queue
- **Initial state loading:** `loadAnnotations` is **NOT called** in `useTestSession.js` on session restore

### Dashboard TestCard
- **File:** `src/apBoost/pages/APDashboard.jsx:13-61`
- Props: `test`, `assignment`, `session`, `attemptCount`, `onClick`
- **Displays:** status, due date (if assignment)
- **Does NOT display:** `maxAttempts`
- **Does NOT disable:** when max attempts reached

---

## 5) Must-Answer Questions

### 1) LineReader positioning: What props/state does `LineReader.jsx` use to compute overlay position?

**Answer:**
- **File:** `src/apBoost/components/tools/LineReader.jsx:17-30`
- Props: `position` (0-indexed line number), `lineHeight` (default 24px), `visibleLines` (1-3, default 2)
- Computed: `windowTop = position * lineHeight`, `windowHeight = lineHeight * visibleLines`
- **NO scroll listener exists** - uses `contentRef.current?.scrollHeight` (line 64) for total height only
- **NO scroll offset tracking** - position is absolute, not relative to scroll

**Evidence:**
```javascript
// Line 28-29
const windowHeight = lineHeight * visibleLines
const windowTop = position * lineHeight
```

---

### 2) Drag support: Does `LineReader.jsx` currently implement any drag handlers?

**Answer:** **NO**

- **File:** `src/apBoost/components/tools/LineReader.jsx`
- Only has `onClick` handler (line 70) via `handleOverlayClick` function
- **NO `onMouseDown`**, **NO `onPointerDown`**, **NO `onTouchStart`** handlers
- Grep search for drag handlers in LineReader: **0 results**

**Evidence:**
```javascript
// Line 49-58 - handleOverlayClick is the only interaction handler
const handleOverlayClick = useCallback((e) => {
  if (!contentRef.current || !overlayRef.current) return
  const rect = overlayRef.current.getBoundingClientRect()
  const clickY = e.clientY - rect.top
  const newPosition = Math.floor(clickY / lineHeight)
  onPositionChange(Math.max(0, newPosition))
}, [lineHeight, onPositionChange, contentRef])
```

---

### 3) Scroll container identity: What element is the actual scroll container for the passage?

**Answer:**
- **File:** `src/apBoost/components/tools/PassageDisplay.jsx:76`
- Element: `<div className="flex-1 overflow-auto relative" ref={contentRef}>`
- This div has `overflow-auto` and contains the passage content
- The `contentRef` is passed to `LineReader` component

**Evidence:**
```jsx
// PassageDisplay.jsx:76
<div className="flex-1 overflow-auto relative" ref={contentRef}>
```

---

### 4) Section boundaries: How does the code map `currentFlatIndex` / navigation items to sections and questions?

**Answer:**
- **File:** `src/apBoost/hooks/useTestSession.js:84-116`
- `flatNavigationItems` is computed per-section (not across all sections)
- Shape: `{ questionId, questionIndex, subQuestionLabel, displayLabel }`

**Evidence:**
```javascript
// useTestSession.js:84-116
const flatNavigationItems = useMemo(() => {
  if (!currentSection?.questionIds || !test?.questions) return []
  const items = []
  currentSection.questionIds.forEach((qId, qIdx) => {
    const question = test.questions[qId]
    if (!question) return
    const frqTypes = [QUESTION_TYPE.FRQ, QUESTION_TYPE.SAQ, QUESTION_TYPE.DBQ]
    const isFRQ = frqTypes.includes(question.questionType)
    if (isFRQ && question.subQuestions?.length > 0) {
      // Add each sub-question as separate item
      question.subQuestions.forEach((sq) => {
        items.push({
          questionId: qId,
          questionIndex: qIdx,
          subQuestionLabel: sq.label,
          displayLabel: `${qIdx + 1}${sq.label}`, // e.g., "1a", "1b"
        })
      })
    } else {
      items.push({
        questionId: qId,
        questionIndex: qIdx,
        subQuestionLabel: null,
        displayLabel: `${qIdx + 1}`,
      })
    }
  })
  return items
}, [currentSection, test])
```

---

### 5) Section lock enforcement: Is there any existing guard that prevents decrementing `currentSectionIndex`?

**Answer:** **NO - No section lock enforcement exists**

- `goPrevious` and `goToFlatIndex` only guard against going before index 0 **within the current section**
- **NO guard** prevents navigating to a previous section
- `submitSection()` increments `currentSectionIndex` but doesn't track completed sections

**Evidence:**
```javascript
// useTestSession.js:296-301 - goPrevious only checks currentFlatIndex
const goPrevious = useCallback(() => {
  const prevIndex = currentFlatIndex - 1
  if (prevIndex >= 0) {
    goToFlatIndex(prevIndex)
  }
}, [currentFlatIndex, goToFlatIndex])

// useTestSession.js:386-393 - submitSection just increments, no lock
const submitSection = useCallback(async () => {
  if (currentSectionIndex < (test?.sections?.length || 1) - 1) {
    setCurrentSectionIndex(prev => prev + 1)
    setCurrentQuestionIndex(0)
  }
}, [currentSectionIndex, test?.sections?.length])
```

---

### 6) Back button disable logic: Where is `canGoBack` / `canGoPrevious` computed?

**Answer:**
- **File:** `src/apBoost/hooks/useTestSession.js:307-309`
- `canGoPrevious` only considers flat index within current section
- **Does NOT consider section boundaries**

**Evidence:**
```javascript
// useTestSession.js:307-309
const canGoPrevious = useMemo(() => {
  return currentFlatIndex > 0
}, [currentFlatIndex])
```

- **Passed to QuestionNavigator:** `src/apBoost/pages/APTestSession.jsx:492`
```jsx
canGoBack={canGoPrevious}
```

---

### 7) Session PAUSED status: Where are lifecycle handlers implemented, and do they write PAUSED?

**Answer:** **Lifecycle handlers exist but do NOT write PAUSED status**

| Handler | Location | Action |
|---------|----------|--------|
| `beforeunload` | useTestSession.js:208-220 | Shows warning only |
| `beforeunload` | useDuplicateTabGuard.js:114-126 | Empty (no-op) |
| `visibilitychange` | useHeartbeat.js:101-113 | Triggers heartbeat on visible only |
| `pagehide` | - | **NOT FOUND** |

**Evidence:**
```javascript
// useTestSession.js:210-216 - only shows warning
const handleBeforeUnload = (e) => {
  if (queueLength > 0) {
    e.preventDefault()
    e.returnValue = 'You have unsaved changes...'
    return e.returnValue
  }
}
```

---

### 8) Session status querying: How does the app find an "active" session?

**Answer:**
- **File:** `src/apBoost/services/apSessionService.js:84-104`
- Queries only for `IN_PROGRESS` status
- **Does NOT include `PAUSED` in query**

**Evidence:**
```javascript
// apSessionService.js:86-91
const sessionsQuery = query(
  collection(db, COLLECTIONS.SESSION_STATE),
  where('testId', '==', testId),
  where('userId', '==', userId),
  where('status', '==', SESSION_STATUS.IN_PROGRESS) // ONLY IN_PROGRESS
)
```

---

### 9) Annotation restore: Is `loadAnnotations` implemented and called during session restore?

**Answer:**
- `loadAnnotations` **IS implemented** in `useAnnotations.js:181-205`
- `loadAnnotations` **IS exported** in return object at line 253
- **NOT called** during session restore in `useTestSession.js`

**Evidence - Implementation exists:**
```javascript
// useAnnotations.js:181-205
const loadAnnotations = useCallback((annotationData) => {
  if (!annotationData) return
  try {
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
  } catch (err) {
    logError('useAnnotations.loadAnnotations', { sessionId }, err)
  }
}, [sessionId])
```

**Evidence - NOT called in restore flow:**
- `useTestSession.js:176-196` - Session restore only restores answers and flags, NOT annotations
```javascript
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
// NO loadAnnotations() call
```

---

### 10) Max attempts on dashboard: Does dashboard display `maxAttempts` and disable when maxed out?

**Answer:**
- **`maxAttempts` is NOT displayed** on TestCard
- **Test is NOT disabled** when max attempts reached

**Evidence - TestCard component:**
- **File:** `src/apBoost/pages/APDashboard.jsx:13-61`
- Props received: `test, assignment, session, attemptCount, onClick`
- Assignment's `maxAttempts` is never read or displayed
- No disable logic based on attempt count

```jsx
// APDashboard.jsx:48-52 - Only dueDate is displayed from assignment
{assignment?.dueDate && (
  <p className="text-text-muted text-sm mt-2">
    Due: {assignment.dueDate.toDate?.().toLocaleDateString() || 'N/A'}
  </p>
)}
// NO maxAttempts display
// NO disabled check for maxAttempts
```

**Evidence - Assignment schema includes maxAttempts:**
- **File:** `src/apBoost/services/apTeacherService.js:239`
```javascript
maxAttempts: assignmentData.maxAttempts || 1,
```

**Evidence - AssignTestModal allows setting maxAttempts:**
- **File:** `src/apBoost/components/teacher/AssignTestModal.jsx:48,216-225`
```javascript
const [maxAttempts, setMaxAttempts] = useState(1)
// ... select with options 1, 2, 3, 5, -1 (unlimited)
```

---

## Summary Table

| Feature | Status | Evidence File:Line |
|---------|--------|-------------------|
| LineReader drag-to-reposition | **NOT IMPLEMENTED** | LineReader.jsx - no drag handlers |
| LineReader scroll tracking | **NOT IMPLEMENTED** | LineReader.jsx - no scroll listener |
| Section locking | **NOT IMPLEMENTED** | useTestSession.js:386-393 - no completedSections |
| Back button section boundary | **NOT IMPLEMENTED** | useTestSession.js:307-309 - only checks flatIndex |
| Section lock indicator | **NOT IMPLEMENTED** | APTestSession.jsx - no SectionIndicator component |
| Session PAUSED on close | **NOT IMPLEMENTED** | useTestSession.js:208-220 - only shows warning |
| Resume annotation restore | **NOT IMPLEMENTED** | useTestSession.js:176-196 - loadAnnotations not called |
| Dashboard maxAttempts display | **NOT IMPLEMENTED** | APDashboard.jsx:13-61 - not displayed |
| Offline queue SECTION_COMPLETE | **NOT IMPLEMENTED** | useOfflineQueue.js:203-225 - no case |
| Offline queue SESSION_PAUSE | **NOT IMPLEMENTED** | useOfflineQueue.js:203-225 - no case |
| Offline queue ANNOTATION_UPDATE | **NOT IMPLEMENTED** | useOfflineQueue.js:203-225 - no case |
