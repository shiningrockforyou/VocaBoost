# CODEBASE_FACTS__UNK__2.3.1_to_2.5.md

**Generated:** 2026-01-14
**Inspector:** Claude Agent (Repo Inspector Mode)
**Scope:** FRQ textarea persistence, offline queue, DBQ stimuli, manual grading

---

## 1) Canonical Data Schema / Source-of-Truth

**Found: Yes**

### Student Session Answer State

**Source:** `src/apBoost/hooks/useTestSession.js`

- **Local state:** `answers` is a `Map<questionId, answer>` (line 40)
- **For MCQ:** `answer` is a string (choice letter)
- **For FRQ with sub-questions:** `answer` is an object `{ a: "...", b: "...", c: "..." }` (lines 337-342)

```javascript
// useTestSession.js:337-342
if (isFRQQuestion && position.subQuestionLabel) {
  const existing = next.get(questionId) || {}
  next.set(questionId, {
    ...existing,
    [position.subQuestionLabel]: answer
  })
}
```

**Firestore collection:** `ap_session_state` (defined in `apTypes.js:94`)

### Question Stimulus Fields

**Source:** `src/apBoost/utils/apTypes.js:56-62`

- **STIMULUS_TYPE enum:** `TEXT`, `IMAGE`, `PASSAGE`, `DOCUMENT`, `CHART`
- **Question model has `stimulus` (singular object)** - confirmed in:
  - `QuestionDisplay.jsx:74`: `const displayStimulus = stimulus || question.stimulus`
  - `FRQQuestionDisplay.jsx:94`: `const displayStimulus = stimulus || question.stimulus`

**Evidence for single stimulus (NOT array):**
```javascript
// FRQQuestionDisplay.jsx:94
const displayStimulus = stimulus || question.stimulus

// QuestionDisplay.jsx:74
const displayStimulus = stimulus || question.stimulus
```

**`question.stimuli` (plural array):** NOT FOUND in actual code
- Searched terms: `.stimuli`, `question.stimuli`
- Only result: `apTypes.js:93` defines collection name `STIMULI: 'ap_stimuli'`

### Grading Status Fields

**Source:** `src/apBoost/utils/apTypes.js:42-47`

```javascript
export const GRADING_STATUS = {
  NOT_NEEDED: 'NOT_NEEDED',
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETE: 'COMPLETE',
}
```

**Where set:** `src/apBoost/services/apScoringService.js:122-123`
```javascript
const hasFRQ = test.sections.some(s => s.sectionType === SECTION_TYPE.FRQ || s.sectionType === SECTION_TYPE.MIXED)
const gradingStatus = hasFRQ ? GRADING_STATUS.PENDING : GRADING_STATUS.NOT_NEEDED
```

**Key Files Opened:**
- `src/apBoost/hooks/useTestSession.js`
- `src/apBoost/utils/apTypes.js`
- `src/apBoost/components/QuestionDisplay.jsx`
- `src/apBoost/components/FRQQuestionDisplay.jsx`
- `src/apBoost/services/apScoringService.js`

---

## 2) Write Paths

**Found: Yes**

### FRQ Answer Write Path

1. **User types in FRQTextInput** → `onChange` prop called with new text value
2. **APTestSession.jsx:443** passes `onChange={setAnswer}` to FRQTextInput
3. **useTestSession.setAnswer (lines 328-359):**
   - Updates local state immediately (optimistic)
   - Calls `addToQueue({ action: 'ANSWER_CHANGE', payload: { questionId, value, subQuestionLabel } })`
4. **useOfflineQueue.addToQueue (lines 125-160):**
   - Stores item in IndexedDB with `status: 'PENDING'`
   - Schedules flush with 1000ms debounce (line 155)
5. **useOfflineQueue.flushQueue (lines 173-266):**
   - Reads pending items from IndexedDB
   - Builds Firestore update object
   - Writes to `ap_session_state` collection

### FRQTextInput State Management

**FRQTextInput is fully controlled (no internal state):**
```javascript
// FRQTextInput.jsx:11-19 - Props definition
export default function FRQTextInput({
  subQuestion,
  value = '',       // <-- Controlled from parent
  onChange,
  disabled = false,
  ...
})
```

```javascript
// FRQTextInput.jsx:64-68 - Textarea element
<textarea
  ref={textareaRef}
  value={value}              // <-- From props
  onChange={handleChange}    // <-- Calls props.onChange
  ...
/>
```

### Navigation Triggers

- **Navigation (goNext, goPrevious, goToQuestion, goToFlatIndex):** Queues `NAVIGATION` action
- **Submit test (submitTest):** Calls `flushQueue()` before creating result (line 406-408)

### Grading Write Path

1. **Teacher clicks "Grade" in APGradebook** → opens GradingPanel
2. **GradingPanel.handleSaveDraft/handleMarkComplete** → calls `saveGrade()`
3. **apGradingService.saveGrade (lines 165-210):**
   - Writes `frqGrades`, `gradingStatus`, `gradedBy`, `gradedAt` to `ap_test_results`
   - If COMPLETE: also calculates `frqScore` and updates totals

### Write Paths Summary

| Event | Handler | Queue/Service | Persistence |
|-------|---------|---------------|-------------|
| FRQ text change | `FRQTextInput.handleChange` → `setAnswer` | `addToQueue(ANSWER_CHANGE)` | IndexedDB → Firestore (debounced) |
| Navigation | `goToFlatIndex` | `addToQueue(NAVIGATION)` | IndexedDB → Firestore (debounced) |
| Timer tick | `handleTimerTick` (every 30s) | `addToQueue(TIMER_SYNC)` | IndexedDB → Firestore (debounced) |
| Test submit | `submitTest` | `flushQueue()` then `createTestResult()` | Immediate flush + new doc |
| Grade save | `saveGrade` | Direct Firestore write | Immediate (no queue) |

**Key Files Opened:**
- `src/apBoost/components/FRQTextInput.jsx`
- `src/apBoost/pages/APTestSession.jsx`
- `src/apBoost/hooks/useTestSession.js`
- `src/apBoost/hooks/useOfflineQueue.js`
- `src/apBoost/services/apGradingService.js`

---

## 3) Offline/Resilience Mechanics

**Found: Yes**

### Queue Storage Mechanism

**Library:** Native IndexedDB (no wrapper library like localforage)
**Database name:** `ap_boost_queue` (line 9)
**Store name:** `actions` (line 10)
**Key path:** `id` (auto-generated timestamp + random)

```javascript
// useOfflineQueue.js:8-11
const DB_NAME = 'ap_boost_queue'
const STORE_NAME = 'actions'
const DB_VERSION = 1
```

**Queue item schema (lines 131-138):**
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

### Debounce Timing

**Confirmed: 1000ms (1 second)**

```javascript
// useOfflineQueue.js:154-156
if (isOnline) {
  scheduleFlush(1000) // 1 second debounce
}
```

Also used when coming back online (line 90):
```javascript
scheduleFlush(1000)
```

### Flush Triggers

1. **Debounce timer:** 1000ms after `addToQueue` if online (line 155)
2. **Coming back online:** 1000ms after `online` event (line 90)
3. **Explicit call:** `submitTest()` calls `flushQueue()` before creating result (useTestSession.js:406-408)
4. **Exponential backoff retry:** 2s, 4s, 8s, 16s on failure (lines 258-261)

### Lifecycle Handling

**beforeunload (useTestSession.js:209-220):**
```javascript
const handleBeforeUnload = (e) => {
  if (queueLength > 0) {
    e.preventDefault()
    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
    return e.returnValue
  }
}
```
- **Purpose:** Warning dialog only
- **Does NOT persist/flush:** Just shows browser warning

**visibilitychange:**
- Used in `useHeartbeat.js:101-113` for heartbeat only
- **NOT used in useOfflineQueue** for flushing

**pagehide:** NOT FOUND
**navigator.sendBeacon:** NOT FOUND (only in fix plan docs)

### Idempotency / Dedupe Behavior

**CRITICAL BUG FOUND:** For FRQ sub-questions, there is no proper merge behavior.

```javascript
// useOfflineQueue.js:205-206
case 'ANSWER_CHANGE':
  updates[`answers.${item.payload.questionId}`] = item.payload.value
```

- `item.payload.value` is just the current sub-answer text (e.g., "answer for part a")
- `item.payload.subQuestionLabel` exists but is NEVER USED
- Multiple ANSWER_CHANGE for same question ID will overwrite each other
- **Result:** If student types in (a) then (b), only (b) survives flush

**Key Files Opened:**
- `src/apBoost/hooks/useOfflineQueue.js`
- `src/apBoost/hooks/useTestSession.js`
- `src/apBoost/hooks/useHeartbeat.js`

---

## 4) UI/Flow Entry Points

**Found: Yes**

### FRQTextInput Rendering

**Location:** `src/apBoost/pages/APTestSession.jsx:439-445`

```javascript
{isFRQQuestion ? (
  <FRQTextInput
    subQuestion={currentQuestion?.subQuestions?.find(sq => sq.label === subQuestionLabel)}
    value={currentAnswer || ''}
    onChange={setAnswer}
    disabled={isSubmitting || isInvalidated}
  />
) : (
  <AnswerInput ... />
)}
```

**Props wired:**
- `value`: from `currentAnswer` (computed in useTestSession.js:312-325)
- `onChange`: `setAnswer` from useTestSession
- `disabled`: based on `isSubmitting` or `isInvalidated`
- **NO `onBlur` prop passed**

### FRQQuestionDisplay / StimulusDisplay Usage

**Location:** `src/apBoost/components/QuestionDisplay.jsx:76-89`

```javascript
const frqTypes = [QUESTION_TYPE.FRQ, QUESTION_TYPE.SAQ, QUESTION_TYPE.DBQ]
if (frqTypes.includes(question.questionType)) {
  return (
    <FRQQuestionDisplay
      question={question}
      questionNumber={questionNumber}
      subQuestionLabel={subQuestionLabel}
      stimulus={displayStimulus}     // <-- Single object
    >
      {children}
    </FRQQuestionDisplay>
  )
}
```

**Stimulus selection (QuestionDisplay.jsx:74):**
```javascript
const displayStimulus = stimulus || question.stimulus
```
- Assumes single object, not array
- No DBQ-specific branching for multi-document stimuli

### DBQ-specific UI Branching

**NOT FOUND**
- `QUESTION_TYPE.DBQ` exists in apTypes.js
- DBQ is handled identically to FRQ/SAQ in QuestionDisplay
- No special rendering for multiple documents

### Teacher Grading UI Entry Points

**Route:** `/ap/teacher/gradebook` (implied from APGradebook.jsx)

**Page:** `src/apBoost/pages/APGradebook.jsx`
- Loads pending results via `getPendingGrades()` (line 168)
- Opens `GradingPanel` when "Grade" clicked (lines 182-185)

**Component:** `src/apBoost/components/grading/GradingPanel.jsx`
- Loads result via `getResultForGrading(resultId)` (line 261)
- Saves via `saveGrade(resultId, grades, status, teacherId, annotatedPdfUrl)` (lines 291, 305)

**Service functions called:**
- `getPendingGrades(teacherId, filters)` - apGradingService.js:26
- `getResultForGrading(resultId)` - apGradingService.js:108
- `saveGrade(resultId, grades, status, teacherId, annotatedPdfUrl)` - apGradingService.js:165

**Key Files Opened:**
- `src/apBoost/pages/APTestSession.jsx`
- `src/apBoost/components/QuestionDisplay.jsx`
- `src/apBoost/components/FRQQuestionDisplay.jsx`
- `src/apBoost/pages/APGradebook.jsx`
- `src/apBoost/components/grading/GradingPanel.jsx`

---

## 5) Must-Answer Questions

### Question 1: FRQTextInput onBlur Support

**Found: No - ABSENT**

FRQTextInput does NOT have any onBlur support:

```javascript
// FRQTextInput.jsx:11-19 - Full props list
export default function FRQTextInput({
  subQuestion,
  value = '',
  onChange,
  disabled = false,
  maxLength = 10000,
  showCharCount = true,
  placeholder = 'Type your response here...',
})
```

```javascript
// FRQTextInput.jsx:64-81 - Textarea element (no onBlur)
<textarea
  ref={textareaRef}
  value={value}
  onChange={handleChange}
  disabled={disabled}
  placeholder={placeholder}
  className={...}
  style={{ minHeight: '150px', maxHeight: '400px' }}
/>
```

**Evidence:** No `onBlur` in props destructuring (lines 11-19), no `onBlur` on textarea element (lines 64-81).

---

### Question 2: FRQTextInput Controlled vs Uncontrolled

**Found: Yes - FULLY CONTROLLED**

- `value` comes from props (line 13: `value = ''`)
- No `useState` for text content
- Textarea uses `value={value}` directly (line 66)
- Changes call `onChange(newValue)` from props (line 37)

```javascript
// FRQTextInput.jsx:34-39
const handleChange = (e) => {
  const newValue = e.target.value
  if (newValue.length <= maxLength) {
    onChange(newValue)   // <-- Parent controls state
  }
}
```

---

### Question 3: APTestSession Handler for FRQTextInput

**Found: Yes**

```javascript
// APTestSession.jsx:439-445
<FRQTextInput
  subQuestion={currentQuestion?.subQuestions?.find(sq => sq.label === subQuestionLabel)}
  value={currentAnswer || ''}
  onChange={setAnswer}    // <-- Handler from useTestSession
  disabled={isSubmitting || isInvalidated}
/>
```

`setAnswer` comes from useTestSession hook (line 74 destructured, line 443 passed).

---

### Question 4: setAnswer Action in useTestSession

**Found: Yes**

```javascript
// useTestSession.js:328-359
const setAnswer = useCallback((answer) => {
  const questionId = position.questionId
  if (!questionId || !session?.id) return

  // Update local state immediately (optimistic)
  setAnswers(prev => {
    const next = new Map(prev)
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
    payload: {
      questionId,
      value: answer,
      subQuestionLabel: position.subQuestionLabel // null for MCQ
    }
  })
}, [...])
```

**Action object shape:**
```javascript
{
  action: 'ANSWER_CHANGE',
  payload: {
    questionId: string,
    value: string,              // Just the current sub-answer text
    subQuestionLabel: string | null
  }
}
```

---

### Question 5: Debounce Interval

**Found: Yes - 1000ms (1 second)**

```javascript
// useOfflineQueue.js:154-156
if (isOnline) {
  scheduleFlush(1000) // 1 second debounce
}
```

Also at line 90:
```javascript
scheduleFlush(1000)
```

---

### Question 6: Navigation Away / Tab Close Persistence

**Found: Yes - WARNING ONLY, NO PERSISTENCE**

**beforeunload handler (useTestSession.js:209-220):**
```javascript
const handleBeforeUnload = (e) => {
  if (queueLength > 0) {
    e.preventDefault()
    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
    return e.returnValue
  }
}
```

- Shows browser warning dialog if queue has pending items
- Does NOT call `flushQueue()` or persist data
- Does NOT use `sendBeacon`

**visibilitychange:** Only used in useHeartbeat for heartbeat, NOT for queue flush
**pagehide:** NOT FOUND

---

### Question 7: question.stimuli Array Support

**Found: No - NOT IMPLEMENTED**

Searched for `.stimuli` in all `.js` and `.jsx` files:
- Only result: `apTypes.js:93` defines Firestore collection `STIMULI: 'ap_stimuli'`
- No code accesses `question.stimuli` as an array of documents

**Evidence:**
```bash
Grep pattern: stimuli
Results in code files:
  src/apBoost/utils/apTypes.js:93  STIMULI: 'ap_stimuli',  (collection name only)
```

---

### Question 8: Stimulus Selection in FRQQuestionDisplay

**Found: Yes - Single Object Assumed**

```javascript
// FRQQuestionDisplay.jsx:89-95
stimulus,            // Props
...
const displayStimulus = stimulus || question.stimulus  // Single object
```

```javascript
// QuestionDisplay.jsx:74
const displayStimulus = stimulus || question.stimulus
```

- Uses `question.stimulus` (singular)
- Assumes single object, not array
- Same pattern in both components

---

### Question 9: gradingStatus Computation

**Found: Yes**

```javascript
// apScoringService.js:122-123
const hasFRQ = test.sections.some(s =>
  s.sectionType === SECTION_TYPE.FRQ ||
  s.sectionType === SECTION_TYPE.MIXED
)
const gradingStatus = hasFRQ ? GRADING_STATUS.PENDING : GRADING_STATUS.NOT_NEEDED
```

**Logic:**
- If ANY section is FRQ or MIXED → `gradingStatus = PENDING`
- Otherwise → `gradingStatus = NOT_NEEDED`
- SAQ and DBQ are question types within FRQ sections, so they trigger PENDING via section type

---

### Question 10: End-to-End Grading Write Flow

**Found: Yes**

**Service Functions:**

1. **getPendingGrades** (apGradingService.js:26-101)
   - Queries `ap_test_results` where `gradingStatus` in [PENDING, IN_PROGRESS]
   - Returns array with studentName and testTitle enriched

2. **getResultForGrading** (apGradingService.js:108-154)
   - Fetches single result by ID
   - Enriches with student info and FRQ questions

3. **saveGrade** (apGradingService.js:165-210)
   - Updates `frqGrades`, `gradingStatus`, `gradedBy`, `gradedAt`
   - If COMPLETE: calculates `frqScore`, updates totals

**UI Callers:**

**APGradebook.jsx:**
```javascript
// Line 168 - Load results
const data = await getPendingGrades(user.uid, filters)

// Lines 182-185 - Open grading panel
const handleGrade = (resultId) => {
  setSelectedResultId(resultId)
  setIsPanelOpen(true)
}
```

**GradingPanel.jsx:**
```javascript
// Line 261 - Load result for grading
const data = await getResultForGrading(resultId)

// Line 291 - Save draft
await saveGrade(resultId, grades, GRADING_STATUS.IN_PROGRESS, teacherId)

// Line 305 - Mark complete
await saveGrade(resultId, grades, GRADING_STATUS.COMPLETE, teacherId, annotatedPdfUrl)
```

---

## Summary of Critical Findings

| Finding | Severity | Location |
|---------|----------|----------|
| No onBlur on FRQTextInput | Medium | FRQTextInput.jsx |
| FRQ sub-answer overwrite bug | **HIGH** | useOfflineQueue.js:205-206 |
| No visibilitychange flush | Medium | useOfflineQueue.js |
| No sendBeacon on beforeunload | Medium | useTestSession.js:209-220 |
| No `question.stimuli` array support | Medium | All display components |
| beforeunload only warns, no persist | Medium | useTestSession.js:209-220 |

**Most Critical:** `ANSWER_CHANGE` in useOfflineQueue does NOT handle `subQuestionLabel` - FRQ sub-answers will overwrite each other on flush.
