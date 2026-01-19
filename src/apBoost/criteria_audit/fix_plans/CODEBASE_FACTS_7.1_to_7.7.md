# Codebase Facts Report: Sections 7.1 to 7.7

**CHUNK_ID:** UNK__7.1_to_7.7
**Date:** 2026-01-14
**Inspector:** Claude Agent
**Purpose:** Ground-truth facts for fix plan validation (navigation/review screen/connection status/submit modals/menu)

---

## Search Log

Keywords searched and files opened:
- `QuestionNavigator|ReviewScreen|ConnectionStatus|TestTimer` → Found src/apBoost/components/*
- `useTestSession|useHeartbeat|useOfflineQueue` → Found src/apBoost/hooks/*
- `resizable|react-resizable|split-pane` → No usage found in src/apBoost (only in audit docs)
- `Review|review` → Found in QuestionNavigator.jsx, ReviewScreen.jsx
- `isSubmitting|submitTest|handleSubmit` → Found in APTestSession.jsx, useTestSession.js
- `modal|Modal|z-50` → Found DuplicateTabModal.jsx, QuestionNavigator.jsx modal
- `Keep Trying|Retry|retry` → Found in useOfflineQueue.js (retry logic), ErrorFallback.jsx
- `Reconnected|reconnect|wasDisconnected` → Found useHeartbeat.js:115-127, no wasDisconnected in ConnectionStatus.jsx
- Opened package.json → No resizable panel library installed

---

## 1) Canonical Data Schema / Source-of-Truth

**Found: Yes**

### Test Session State (useTestSession.js)

**File:** `src/apBoost/hooks/useTestSession.js:27-43`
```javascript
// Core state
const [session, setSession] = useState(null)
const [test, setTest] = useState(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState(null)
const [isSubmitting, setIsSubmitting] = useState(false)

// Position state
const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
const [currentSubQuestionLabel, setCurrentSubQuestionLabel] = useState(null)

// Answers state (Map for fast lookup)
const [answers, setAnswers] = useState(new Map())

// Flags state (Set for fast lookup)
const [flags, setFlags] = useState(new Set())
```

### Position Object Shape

**File:** `src/apBoost/hooks/useTestSession.js:68-74`
```javascript
const position = useMemo(() => ({
  sectionIndex: currentSectionIndex,
  questionIndex: currentQuestionIndex,
  questionId: currentSection?.questionIds?.[currentQuestionIndex] || null,
  subQuestionLabel: currentSubQuestionLabel, // null for MCQ
}), [currentSectionIndex, currentQuestionIndex, currentSection, currentSubQuestionLabel])
```

### flatNavigationItems Shape (FRQ Support)

**File:** `src/apBoost/hooks/useTestSession.js:83-116`
```javascript
const flatNavigationItems = useMemo(() => {
  // ...
  items.push({
    questionId: qId,
    questionIndex: qIdx,
    subQuestionLabel: sq.label,  // e.g., 'a', 'b', 'c' or null for MCQ
    displayLabel: `${qIdx + 1}${sq.label}`, // e.g., "1a", "1b"
  })
  // ...
}, [currentSection, test])
```

### ReviewScreen Input Shape

**File:** `src/apBoost/pages/APTestSession.jsx:352-356`
```javascript
const sectionQuestions = currentSection?.questionIds?.map((qId, idx) => ({
  id: qId,
  index: idx,
})) || []
```

**ReviewScreen props (APTestSession.jsx:368-381):**
```jsx
<ReviewScreen
  section={currentSection}
  questions={sectionQuestions}  // Array of { id: string, index: number }
  answers={answers}             // Map<questionId, answer>
  flags={flags}                 // Set<questionId>
  onGoToQuestion={(idx) => {...}}
  onSubmit={handleSubmit}
  onCancel={handleReturnFromReview}
  isSubmitting={isSubmitting}
  isFinalSection={position.sectionIndex === (test?.sections?.length || 1) - 1}
/>
```

### Flags Data Type

**Canonical source:** `src/apBoost/hooks/useTestSession.js:43`
- **Type:** `Set<questionId>`
- **Key stored:** Question ID (string)
- **Populated at:** `src/apBoost/hooks/useTestSession.js:193-195` (restore from session)
- **Modified at:** `src/apBoost/hooks/useTestSession.js:361-383` (toggleFlag)

```javascript
// Restore flags
const flagsSet = new Set(existingSession.flaggedQuestions || [])
setFlags(flagsSet)

// Toggle flag
const toggleFlag = useCallback((questionId) => {
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

### Unanswered Detection

**File:** `src/apBoost/components/ReviewScreen.jsx:45-55`
```javascript
// Calculate statistics
const totalQuestions = questions.length
const answeredCount = questions.filter(q => answers.has(q.id || q)).length
const unansweredCount = totalQuestions - answeredCount
const flaggedCount = questions.filter(q => flags.has(q.id || q)).length

// Get unanswered question numbers
const unansweredQuestions = questions
  .map((q, idx) => ({ q, idx }))
  .filter(({ q }) => !answers.has(q.id || q))  // NOT in answers Map
  .map(({ idx }) => idx + 1)
```

**"Unanswered" means:** `!answers.has(questionId)` - the questionId is not a key in the answers Map.

---

## 2) Write Paths

**Found: Yes**

### Answer Write Path

**File:** `src/apBoost/hooks/useTestSession.js:327-359`
```javascript
const setAnswer = useCallback((answer) => {
  const questionId = position.questionId
  // Update local state immediately (optimistic)
  setAnswers(prev => {
    const next = new Map(prev)
    // For FRQ with sub-questions, store as object
    if (isFRQQuestion && position.subQuestionLabel) {
      const existing = next.get(questionId) || {}
      next.set(questionId, {
        ...existing,
        [position.subQuestionLabel]: answer
      })
    } else {
      next.set(questionId, answer)
    }
    return next
  })
  // Queue for sync
  addToQueue({
    action: 'ANSWER_CHANGE',
    payload: { questionId, value: answer, subQuestionLabel: position.subQuestionLabel }
  })
}, [position.questionId, position.subQuestionLabel, session?.id, addToQueue, isFRQQuestion])
```

### Flag Write Path

**File:** `src/apBoost/hooks/useTestSession.js:361-383`
- Updates local `flags` Set immediately
- Queues `FLAG_TOGGLE` action with `{ questionId, markedForReview }`

### Navigation Position Write Path

**File:** `src/apBoost/hooks/useTestSession.js:241-260`
```javascript
const goToFlatIndex = useCallback((flatIndex) => {
  // ... update local state ...
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
}, [...])
```

### Timer Write Path

**File:** `src/apBoost/hooks/useTestSession.js:142-150`
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

### Submit Write Path

**File:** `src/apBoost/hooks/useTestSession.js:395-421`
```javascript
const submitTest = useCallback(async (frqData = null) => {
  if (!session?.id || isSubmitting) return null

  try {
    setIsSubmitting(true)
    timer.pause()

    // Flush any pending changes first
    if (queueLength > 0) {
      await flushQueue()  // <-- Flushes offline queue before submit
    }

    // Create test result
    const resultId = await createTestResult(session.id, frqData)
    return resultId
  } catch (err) {
    logError('useTestSession.submitTest', { sessionId: session?.id }, err)
    setError(err.message || 'Failed to submit test')
    return null
  } finally {
    setIsSubmitting(false)
  }
}, [session?.id, isSubmitting, timer, queueLength, flushQueue])
```

### Heartbeat Write Path

**File:** `src/apBoost/hooks/useHeartbeat.js:54-61`
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

---

## 3) Offline/Resilience Mechanics

**Found: Yes**

### Heartbeat Mechanism

**File:** `src/apBoost/hooks/useHeartbeat.js:8-10`
```javascript
const HEARTBEAT_INTERVAL = 15000 // 15 seconds
const MAX_FAILURES = 3
```

**Failure threshold logic (useHeartbeat.js:68-77):**
```javascript
} catch (error) {
  logError('useHeartbeat.doHeartbeat', { sessionId }, error)
  setFailureCount(prev => {
    const newCount = prev + 1
    if (newCount >= MAX_FAILURES) {  // >= 3 failures triggers isConnected = false
      setIsConnected(false)
    }
    return newCount
  })
}
```

**Return values (useHeartbeat.js:122-128):**
```javascript
return {
  isConnected,      // boolean - false after 3+ consecutive failures
  failureCount,     // number
  lastHeartbeat,    // Date | null
  sessionTakenOver, // boolean - true if another instance claimed session
  reconnect,        // async function to manually reconnect
}
```

### Offline Queue Mechanism

**File:** `src/apBoost/hooks/useOfflineQueue.js:51-54`
```javascript
const [queueLength, setQueueLength] = useState(0)
const [isOnline, setIsOnline] = useState(navigator.onLine)
const [isFlushing, setIsFlushing] = useState(false)
```

**Storage:** IndexedDB database `ap_boost_queue`, store `actions`

**Flush trigger on reconnect (useOfflineQueue.js:85-91):**
```javascript
const handleOnline = () => {
  setIsOnline(true)
  retryCountRef.current = 0
  // Try to flush when we come back online
  scheduleFlush(1000)
}
```

**Retry backoff (useOfflineQueue.js:257-262):**
```javascript
retryCountRef.current++
if (retryCountRef.current < 5) {
  const delay = Math.pow(2, retryCountRef.current) * 1000 // 2s, 4s, 8s, 16s
  scheduleFlush(delay)
}
```

### Connection/Sync States Propagation to ConnectionStatus

**File:** `src/apBoost/pages/APTestSession.jsx:83-86`
```javascript
// Resilience
isConnected,  // from useHeartbeat
isSyncing,    // actually isFlushing from useOfflineQueue
```

**Re-export (useTestSession.js:498-501):**
```javascript
// Resilience - connection state
isConnected,
isOnline,
isSyncing: isFlushing,  // <-- isSyncing in API = isFlushing internally
queueLength,
```

**ConnectionStatus receives (APTestSession.jsx:392):**
```jsx
<ConnectionStatus isConnected={isConnected} isSyncing={isSyncing} />
```

---

## 4) UI/Flow Entry Points

**Found: Yes**

### Component Tree for Test-Taking UI

**File:** `src/apBoost/pages/APTestSession.jsx:389-496`

```
APTestSession (main page)
├── ConnectionStatus (banner at top)
├── DuplicateTabModal (conditional overlay)
├── header (inline, lines 403-411)
│   ├── Section info text
│   └── TestTimer
├── main
│   ├── QuestionDisplay
│   │   ├── (stimulus panel)
│   │   └── (question/answer panel with AnswerInput or FRQTextInput)
│   └── Flag button
└── QuestionNavigator (bottom bar)
    └── Slide-up modal (internal)
```

### View State Control

**File:** `src/apBoost/pages/APTestSession.jsx:44-45`
```javascript
// View state: 'instruction' | 'testing' | 'review' | 'frqChoice' | 'frqHandwritten'
const [view, setView] = useState('instruction')
```

**Transitions:**
- `instruction` → `testing`: `handleBegin()` (line 166-169)
- `testing` → `review`: `handleGoToReview()` (line 172-174)
- `review` → `testing`: `handleReturnFromReview()` (line 177-179)
- `review` → navigate away: `handleSubmit()` on success

### QuestionNavigator Props (How Navigation is Wired)

**File:** `src/apBoost/pages/APTestSession.jsx:477-494`
```jsx
<QuestionNavigator
  questions={currentSection?.questionIds || []}
  currentIndex={position.questionIndex}
  totalQuestions={currentSection?.questionIds?.length || 0}
  // FRQ flat navigation
  flatNavigationItems={flatNavigationItems}
  currentFlatIndex={currentFlatIndex}
  onNavigateFlatIndex={goToFlatIndex}
  // Common props
  answers={answers}
  flags={flags}
  onNavigate={goToQuestion}
  onBack={goPrevious}
  onNext={goNext}
  onGoToReview={handleGoToReview}  // <-- Passed and used
  canGoBack={canGoPrevious}
  canGoNext={canGoNext}
/>
```

### Modal Patterns

**DuplicateTabModal Structure (src/apBoost/components/DuplicateTabModal.jsx:5-52):**
```jsx
export default function DuplicateTabModal({ onTakeControl, onGoToDashboard }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />
      {/* Modal */}
      <div className="relative bg-surface rounded-[--radius-card] shadow-theme-xl p-6 md:p-8 max-w-md mx-4">
        {/* Icon, Title, Message, Actions */}
      </div>
    </div>
  )
}
```

**QuestionNavigator internal modal (src/apBoost/components/QuestionNavigator.jsx:140-234):**
- Uses `z-50` for overlay
- Has backdrop with `bg-black/50`
- Slide-up animation

### Header Definition in Test Session

**File:** `src/apBoost/pages/APTestSession.jsx:402-411`
```jsx
{/* Header with timer */}
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

**No menu button [≡] exists in this header.**

---

## 5) Must-Answer Questions

### Q1: Where is "last question" actually determined?

**Answer: Found in useTestSession.js:303-305**

```javascript
const canGoNext = useMemo(() => {
  return currentFlatIndex < flatNavigationItems.length - 1
}, [currentFlatIndex, flatNavigationItems.length])
```

**Canonical source:** `canGoNext` is false when `currentFlatIndex === flatNavigationItems.length - 1`

The "last question" condition is derived from: `currentFlatIndex === flatNavigationItems.length - 1` which makes `canGoNext = false`.

---

### Q2: In QuestionNavigator, what are the current props for navigation?

**Answer: Found in QuestionNavigator.jsx:60-78**

```javascript
export default function QuestionNavigator({
  // Legacy props (MCQ only)
  questions,
  currentIndex,
  totalQuestions,
  // New props (FRQ support)
  flatNavigationItems = null,
  currentFlatIndex = null,
  onNavigateFlatIndex = null,
  // Common props
  answers,
  flags,
  onNavigate,
  onBack,
  onNext,
  onGoToReview,   // <-- EXISTS and is passed
  canGoBack,
  canGoNext,
}) {
```

**`onGoToReview` IS passed from APTestSession (line 491)** and is used at QuestionNavigator.jsx:224-227:
```jsx
<button
  onClick={() => {
    setIsModalOpen(false)
    onGoToReview()
  }}
  ...
>
  Go to Review Screen
</button>
```

**However:** The bottom bar Next button (lines 125-137) does NOT use `onGoToReview`. It only uses `onNext` and is disabled when `!canGoNext`.

---

### Q3: How does the app enter/exit the Review screen today?

**Answer: Found in APTestSession.jsx:44-45, 172-179, 352-384**

**Controlling state:** `const [view, setView] = useState('instruction')`

**Entry to review:**
```javascript
// APTestSession.jsx:172-174
const handleGoToReview = () => {
  setView('review')
}
```

**Exit from review:**
```javascript
// APTestSession.jsx:177-179
const handleReturnFromReview = () => {
  setView('testing')
}
```

**Render condition (APTestSession.jsx:352):**
```javascript
if (view === 'review') {
  // Renders ReviewScreen with ConnectionStatus and DuplicateTabModal
}
```

**Component tree path:**
`APTestSession` → `view === 'review'` → `ReviewScreen`

---

### Q4: Canonical data shapes for questions, flags, and unanswered

**Questions used by ReviewScreen:**
- **Type:** `Array<{ id: string, index: number }>`
- **Source:** APTestSession.jsx:353-356
```javascript
const sectionQuestions = currentSection?.questionIds?.map((qId, idx) => ({
  id: qId,
  index: idx,
})) || []
```

**Flags:**
- **Type:** `Set<string>` (Set of questionId strings)
- **Source:** useTestSession.js:43
- **Key stored:** `questionId` (string)

**Unanswered detection:**
- **Condition:** `!answers.has(questionId)`
- **Source:** ReviewScreen.jsx:54
- **"Unanswered" means:** The questionId is not present as a key in the answers Map

---

### Q5: Where does timeRemaining come from?

**Answer:**

**Source chain:**
1. `useTimer` hook (useTimer.js:19): `const [timeRemaining, setTimeRemaining] = useState(initialTime)`
2. `useTestSession` (useTestSession.js:152-157): Creates timer instance
3. `useTestSession` return (useTestSession.js:493): `timeRemaining: timer.timeRemaining`
4. `APTestSession` (line 82): Destructures `timeRemaining` from useTestSession
5. Passed to TestTimer at line 410: `<TestTimer timeRemaining={timeRemaining} />`

**Is it available at ReviewScreen render time?**
- **YES** - but it's NOT currently passed to ReviewScreen. It's only rendered in the test interface header (line 410) and FRQ choice screen (line 320).
- **Same source?** YES - both test header and review would use the same `timeRemaining` from useTestSession.

---

### Q6: What connection/sync states exist and who owns them?

**isConnected:**
- **Owner:** `useHeartbeat.js:19`
- **Type:** `boolean`, default `true`
- **Threshold:** Set to `false` when `failureCount >= MAX_FAILURES` (3)
- **Source:** useHeartbeat.js:70-74

**isFlushing (exposed as isSyncing):**
- **Owner:** `useOfflineQueue.js:54`
- **Type:** `boolean`
- **Set true:** When `flushQueue()` starts (line 178)
- **Set false:** In finally block after flush completes (line 264)

**Propagation to ConnectionStatus:**
- `useTestSession` re-exports: `isSyncing: isFlushing` (line 500)
- `APTestSession` passes to `<ConnectionStatus isConnected={isConnected} isSyncing={isSyncing} />`

---

### Q7: Does ConnectionStatus have transition detection or timeout-based dismissal?

**Answer: NO - Confirmed ABSENT**

**File:** `src/apBoost/components/ConnectionStatus.jsx` (full file, 49 lines)

Current implementation:
- No `useState` or `useEffect` hooks
- No `wasDisconnected` state
- No `showReconnected` state
- No `setTimeout` or timer refs
- Pure render function based on props only

**Logic (lines 5-9, 12, 41):**
```javascript
// Don't show anything if connected and not syncing
if (isConnected && !isSyncing) {
  return null
}

// Syncing state
if (isSyncing) {
  return <div>..."Syncing your progress..."...</div>
}

// Disconnected state
return <div>..."Connection unstable..."...</div>
```

**No transition detection exists.** The component does not track previous connection state.

---

### Q8: Submit flow - states and modals

**Submit initiation:**
- **Button handler:** ReviewScreen.jsx:134 `onClick={onSubmit}`
- **Handler function:** APTestSession.jsx:182-192 `handleSubmit()`

**Submit states:**
- `isSubmitting` (useTestSession.js:32): boolean, set true/false around submit
- `error` (useTestSession.js:31): string | null, set on error

**Current submit UI (ReviewScreen.jsx:133-149):**
```jsx
<button
  onClick={onSubmit}
  disabled={isSubmitting}
  className="..."
>
  {isSubmitting ? (
    <>
      <svg className="animate-spin h-4 w-4" .../>
      Submitting...
    </>
  ) : (
    isFinalSection ? 'Submit Test' : 'Submit Section'
  )}
</button>
```

**Submit failure handling (useTestSession.js:414-417):**
```javascript
} catch (err) {
  logError('useTestSession.submitTest', { sessionId: session?.id }, err)
  setError(err.message || 'Failed to submit test')
  return null
}
```

**NO modal exists for submit progress or submit failure.** Only inline button spinner.

---

### Q9: Existing modal pattern (DuplicateTabModal)

**File:** `src/apBoost/components/DuplicateTabModal.jsx:5-52`

**Structure:**
```jsx
<div className="fixed inset-0 z-50 flex items-center justify-center">
  {/* Backdrop */}
  <div className="absolute inset-0 bg-black/50" />

  {/* Modal */}
  <div className="relative bg-surface rounded-[--radius-card] shadow-theme-xl p-6 md:p-8 max-w-md mx-4">
    {/* Icon in circle */}
    <div className="flex justify-center mb-4">
      <div className="w-16 h-16 rounded-full bg-warning flex items-center justify-center">
        <span className="text-3xl">...</span>
      </div>
    </div>
    {/* Title */}
    <h2 className="text-xl font-bold text-text-primary text-center mb-2">...</h2>
    {/* Message */}
    <p className="text-text-secondary text-center mb-6">...</p>
    {/* Actions */}
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <button ...>Secondary Action</button>
      <button ...>Primary Action</button>
    </div>
  </div>
</div>
```

**Z-index:** `z-50`
**Backdrop:** `bg-black/50`
**Focus handling:** None implemented (no focus trap)

---

### Q10: Menu button [≡] in test header

**Answer: NO - Confirmed ABSENT**

**File:** `src/apBoost/pages/APTestSession.jsx:402-411`

Current test session header contains only:
- Section info text (left side)
- TestTimer (right side)

**No menu button, hamburger icon, or dropdown exists.**

The APHeader component (src/apBoost/components/APHeader.jsx) is a different component used for dashboard pages, not the test session.

---

### Q11: Resizable panel/divider library

**Answer: NO - Confirmed NOT INSTALLED**

**package.json dependencies checked:**
- No `react-resizable-panels`
- No `react-split-pane`
- No `Resizable` component library

**Grep search:** Only found "resize" in audit documentation files and unrelated textarea resize CSS.

**Current layout (QuestionDisplay):** Uses fixed CSS grid `grid-cols-1 lg:grid-cols-2` for horizontal format.

---

## Summary Table

| Question | Status | Key Finding |
|----------|--------|-------------|
| Q1: Last question determination | Found | `canGoNext = currentFlatIndex < flatNavigationItems.length - 1` |
| Q2: QuestionNavigator props | Found | `onGoToReview` exists but NOT used by Next button |
| Q3: Review screen entry/exit | Found | Controlled by `view` state, `setView('review')` |
| Q4: Data shapes | Found | questions: `Array<{id, index}>`, flags: `Set<questionId>`, unanswered: `!answers.has(qId)` |
| Q5: Timer source | Found | `useTimer` hook → `useTestSession` → NOT passed to ReviewScreen currently |
| Q6: Connection/sync states | Found | `isConnected` from heartbeat (≥3 failures), `isFlushing` from offline queue |
| Q7: Transition detection in ConnectionStatus | **NOT FOUND** | No state tracking, no setTimeout |
| Q8: Submit modals | **NOT FOUND** | Only inline spinner, no modal component |
| Q9: Modal pattern | Found | DuplicateTabModal.jsx - z-50, bg-black/50, no focus trap |
| Q10: Menu button | **NOT FOUND** | Header has only section info + timer |
| Q11: Resizable panels | **NOT FOUND** | No library installed |
