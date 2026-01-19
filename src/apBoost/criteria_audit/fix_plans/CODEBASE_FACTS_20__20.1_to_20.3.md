# CODEBASE_FACTS__20__20.1_to_20.3.md

**Generated:** 2026-01-14
**Chunk ID:** 20__20.1_to_20.3
**Source document:** Fix Plan: Sections 20.1 to 20.3 (Seed Data & Phase Verification 1-4)

---

## 1) Canonical Data Schema / Source-of-Truth

**Found: Yes**

### ap_tests Collection Schema

**Source of truth:** `src/apBoost/utils/apTypes.js` (lines 21-31, 89-98) + `src/apBoost/utils/seedTestData.js` (lines 21-48)

```javascript
// apTypes.js:21-31
export const TEST_TYPE = {
  EXAM: 'EXAM',
  MODULE: 'MODULE',
}

export const SECTION_TYPE = {
  MCQ: 'MCQ',
  FRQ: 'FRQ',
  MIXED: 'MIXED',
}
```

**Expected ap_tests fields (from seedTestData.js:21-48):**
| Field | Type | Notes |
|-------|------|-------|
| `title` | string | Test title |
| `subject` | string | e.g., 'AP_US_HISTORY' |
| `testType` | string | `TEST_TYPE.EXAM` or `TEST_TYPE.MODULE` |
| `createdBy` | string | User ID or 'system' |
| `isPublic` | boolean | Whether publicly accessible |
| `questionOrder` | string | `QUESTION_ORDER.FIXED` or `RANDOMIZED` |
| `sections[]` | array | Array of section objects (see below) |
| `scoreRanges` | object | `{ap5: {min, max}, ap4: {...}, ...}` |
| `hasFRQ` | boolean | Set by apTeacherService.js:91-93 |
| `isPublished` | boolean | apTeacherService.js:64 |
| `createdAt` | timestamp | serverTimestamp |
| `updatedAt` | timestamp | serverTimestamp |

**Section object structure:**
```javascript
{
  id: 'section1',
  title: 'Multiple Choice',
  sectionType: SECTION_TYPE.MCQ,  // or FRQ or MIXED
  timeLimit: 45,  // in minutes
  questionIds: ['q1', 'q2', ...],
  mcqMultiplier: 1.0,
  calculatorEnabled: false,
}
```

---

### ap_questions Collection Schema

**Source of truth:** `src/apBoost/services/apQuestionService.js` (lines 159-188) + `src/apBoost/utils/seedTestData.js` (lines 52-157)

**MCQ Question fields:**
| Field | Type | Notes |
|-------|------|-------|
| `testId` | string | Optional link to test |
| `subject` | string | e.g., 'AP_US_HISTORY' |
| `questionType` | string | `QUESTION_TYPE.MCQ`, `MCQ_MULTI`, `FRQ`, `SAQ`, `DBQ` |
| `format` | string | `QUESTION_FORMAT.VERTICAL` or `HORIZONTAL` |
| `questionDomain` | string | e.g., 'Unit 3: Colonial America' |
| `questionTopic` | string | More specific topic |
| `difficulty` | string | `EASY`, `MEDIUM`, `HARD` |
| `questionText` | string | The question prompt |
| `choiceA-E` | object | `{ text: "..." }` for each choice |
| `choiceCount` | number | Number of choices (typically 4) |
| `correctAnswers` | array | `['B']` for single, `['A', 'C']` for multi |
| `partialCredit` | boolean | For MCQ_MULTI |
| `explanation` | string | Answer explanation |
| `points` | number | Points for this question |
| `stimulus` | object | Optional: `{ type, content, source }` |
| `createdBy` | string | User ID |
| `createdAt` | timestamp | serverTimestamp |

**FRQ Question fields (additional):**

**Source:** `src/apBoost/services/apQuestionService.js:176`
```javascript
subQuestions: questionData.subQuestions || null,
```

**subQuestions schema (expected by UI/grading):**

**Evidence from:**
- `src/apBoost/hooks/useTestSession.js:93-104` (navigation logic)
- `src/apBoost/components/grading/GradingPanel.jsx:144, 183-216` (grading UI)

```javascript
subQuestions: [
  {
    label: 'a',      // Required: subquestion identifier
    prompt: '...',   // Optional: sub-question text
    points: 3,       // Optional: defaults to 3 in grading UI (line 209)
    rubric: '...',   // Optional: not currently used in code
  },
  { label: 'b', ... },
  { label: 'c', ... },
]
```

**Answer:** `subQuestions` is NOT strictly required - code checks with `question.subQuestions?.length > 0` (useTestSession.js:95). For FRQ without subQuestions, it's treated as a single-item question. However, grading UI (GradingPanel.jsx:183-216) expects subQuestions to exist for proper scoring.

---

### ap_classes Collection Schema

**Source of truth:** `src/apBoost/services/apTeacherService.js` (lines 160-178, 186-223)

**Expected fields:**
| Field | Type | Notes |
|-------|------|-------|
| `teacherId` | string | Teacher's user ID (queried at line 165) |
| `name` | string | Class name (ordered by at line 166) |
| `studentIds` | array | Array of student user IDs (line 195) |
| `subject` | string | Not explicitly in code, inferred from spec |

---

### ap_assignments Collection Schema

**Source of truth:** `src/apBoost/services/apTeacherService.js` (lines 230-251)

```javascript
// apTeacherService.js:234-245
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

**Note:** `availableFrom` is NOT currently in the schema (not found in codebase). Only `dueDate` exists.

---

### ap_test_results Collection Schema

**Source of truth:** `src/apBoost/services/apScoringService.js` (lines 127-154) + `src/apBoost/services/apGradingService.js` (lines 165-206)

**Fields from createTestResult (apScoringService.js:127-154):**
```javascript
{
  userId, testId, classId, assignmentId, attemptNumber, isFirstAttempt, sessionId,
  answers,
  score, maxScore, percentage, apScore,
  sectionScores,  // { 0: { correct, total, points } }
  mcqResults,     // [{ questionId, studentAnswer, correctAnswer, correct }]
  frqSubmissionType, frqUploadedFiles, frqAnswers, frqMaxPoints,
  frqScore: null,       // Set after grading
  annotatedPdfUrl: null,
  frqGrades: null,
  gradingStatus,  // PENDING, IN_PROGRESS, COMPLETE, NOT_NEEDED
  startedAt, completedAt, gradedAt: null,
}
```

**Fields updated by saveGrade (apGradingService.js:169-206):**
```javascript
{
  frqGrades: grades,     // { [questionId]: { subScores: { a: 2, b: 3 }, comment: "...", maxPoints: N } }
  gradingStatus: status,
  gradedBy: teacherId,
  gradedAt: serverTimestamp(),
  annotatedPdfUrl,       // Optional
  // When status === COMPLETE:
  frqScore,              // Calculated from grades
  score,                 // mcqScore + frqScore
  maxScore,              // mcqMaxPoints + frqMaxPoints
  percentage,            // Recalculated
  apScore,               // Recalculated via calculateAPScore()
}
```

---

### SECTION_TYPE.MIXED Usage

**Answer:** `SECTION_TYPE.MIXED` is **defined** in `apTypes.js:30` but **rarely used at runtime**.

**Evidence:**
- `apTeacherService.js:91-93` checks for MIXED when setting `hasFRQ`:
  ```javascript
  hasFRQ = updates.sections.some(section =>
    section.sectionType === 'FRQ' || section.sectionType === 'MIXED'
  )
  ```
- `apScoringService.js:122-123` checks for FRQ or MIXED to set grading status:
  ```javascript
  const hasFRQ = test.sections.some(s => s.sectionType === SECTION_TYPE.FRQ || s.sectionType === SECTION_TYPE.MIXED)
  ```
- **Runtime navigation** in `useTestSession.js` uses `flatNavigationItems` which iterates over `currentSection.questionIds` and checks individual question types (`QUESTION_TYPE.FRQ`, `SAQ`, `DBQ`) - not section type.

**Conclusion:** Mixed tests currently work by having **two separate sections** (one MCQ, one FRQ), not a single `SECTION_TYPE.MIXED` section. The MIXED type exists but is not heavily utilized in section transitions.

---

## 2) Write Paths

**Found: Yes**

### 2.1 Seed Writes

**Entry function:** `seedAPTestData()` in `src/apBoost/utils/seedTestData.js`

**What is written:**
| Collection | Document ID | Method |
|------------|-------------|--------|
| `ap_tests` | `test_apush_practice_1` | `setDoc()` - line 21 |
| `ap_questions` | `q1` - `q5` | `setDoc()` - line 162 |

**Trigger:** Manual invocation - console or import (line 4: "Run this in the browser console or import and call seedAPTestData()")

**Idempotency:** Uses `setDoc()` which overwrites - idempotent by design.

**Gap:** Currently only seeds MCQ test and questions. No FRQ/class/assignment seed data.

---

### 2.2 Offline Queue Writes

**Entry function:** `addToQueue()` in `src/apBoost/hooks/useOfflineQueue.js` (lines 125-160)

**Storage:** IndexedDB database `ap_boost_queue`, store `actions` (lines 8-10)

**Queue item structure (lines 131-138):**
```javascript
{
  id: generateId(),
  sessionId,
  localTimestamp: Date.now(),
  action: action.action,    // ANSWER_CHANGE, FLAG_TOGGLE, NAVIGATION, TIMER_SYNC
  payload: action.payload,
  status: 'PENDING',
}
```

**Flush behavior (`flushQueue()` lines 173-266):**
1. Reads all PENDING items from IndexedDB for sessionId
2. Builds Firestore update object from actions
3. Writes to `ap_session_state/{sessionId}` via `updateDoc()`
4. Deletes processed items from IndexedDB
5. Exponential backoff retry on failure (2s, 4s, 8s, 16s)

**Idempotency:** Each queue item has unique ID. Last-write-wins for answer changes.

---

### 2.3 Submit Flow Writes

**Entry function:** `submitTest()` in `src/apBoost/hooks/useTestSession.js` (lines 396-421)

**Flow:**
```javascript
// useTestSession.js:396-421
const submitTest = useCallback(async (frqData = null) => {
  // 1. Stop timer
  timer.pause()

  // 2. Flush queue if pending items exist
  if (queueLength > 0) {
    await flushQueue()  // <-- Guaranteed flush before result creation
  }

  // 3. Create test result
  const resultId = await createTestResult(session.id, frqData)
  return resultId
}, [session?.id, isSubmitting, timer, queueLength, flushQueue])
```

**createTestResult() (apScoringService.js:67-166):**
1. Gets session from Firestore
2. Gets test with questions
3. Calculates MCQ scores per section
4. Creates result document via `setDoc()` with deterministic ID: `{userId}_{testId}_{attemptNumber}`
5. Marks session as completed via `completeSession()`

**Idempotency:** Document ID is deterministic - overwrites existing result for same attempt.

---

### 2.4 Grading Writes

**Entry function:** `saveGrade()` in `src/apBoost/services/apGradingService.js` (lines 165-211)

**What is written:**
- Collection: `ap_test_results`
- Fields updated: `frqGrades`, `gradingStatus`, `gradedBy`, `gradedAt`
- When `status === COMPLETE`: also `frqScore`, `score`, `maxScore`, `percentage`, `apScore`

**Score recalculation (lines 182-203):**
```javascript
if (status === GRADING_STATUS.COMPLETE) {
  const frqScore = calculateFRQScore(grades)
  updateData.frqScore = frqScore

  // Get current result to update totals
  const resultSnap = await getDoc(resultRef)
  const resultData = resultSnap.data()
  const mcqScore = resultData.mcqScore || 0
  // ...
  updateData.score = mcqScore + frqScore
  updateData.percentage = Math.round((updateData.score / updateData.maxScore) * 100)
  updateData.apScore = calculateAPScore(updateData.percentage)
}
```

**Idempotency:** Uses `updateDoc()` - last write wins.

---

## 3) Offline/Resilience Mechanics

**Found: Yes**

### 3.1 Queue Storage

**Location:** IndexedDB
- Database name: `ap_boost_queue` (useOfflineQueue.js:9)
- Store name: `actions` (useOfflineQueue.js:10)
- Key: `id` (auto-generated)
- Indexes: `sessionId`, `status` (lines 32-33)

### 3.2 flushQueue Mechanics

**Source:** `src/apBoost/hooks/useOfflineQueue.js:173-266`

| State | Location | Description |
|-------|----------|-------------|
| `isFlushing` | line 54 | True while flush in progress |
| `queueLength` | line 52 | Count of pending items for current session |
| `isOnline` | line 53 | `navigator.onLine` state |

**Progress reporting:** Currently `queueLength` is exposed (line 280) but NOT shown in ReviewScreen UI. The `isSyncing` prop is passed but only shows "Syncing your progress..." message, not item count.

### 3.3 Heartbeat + Connectivity

**Source:** `src/apBoost/hooks/useHeartbeat.js`

**Constants (lines 9-10):**
```javascript
const HEARTBEAT_INTERVAL = 15000  // 15 seconds
const MAX_FAILURES = 3
```

**`isConnected` derivation (lines 70-76):**
```javascript
setFailureCount(prev => {
  const newCount = prev + 1
  if (newCount >= MAX_FAILURES) {
    setIsConnected(false)  // Flips after 3 failures
  }
  return newCount
})
```

**Flow to UI:**
- `useHeartbeat()` returns `isConnected` (line 122)
- `useTestSession()` exposes it (line 498)
- `APTestSession` passes to `ConnectionStatus` (lines 277, 333, 361, 392)

**ConnectionStatus display (ConnectionStatus.jsx:41-48):**
```javascript
// Disconnected state shows when isConnected=false AND not syncing
return (
  <div className="bg-warning ...">
    <span>Connection unstable - your progress is being saved locally</span>
  </div>
)
```

### 3.4 Duplicate Tab / Cross-Browser Takeover

**Same-browser detection:** `BroadcastChannel` in `useDuplicateTabGuard.js:71-97`
- Channel name: `ap_session_${sessionId}`
- Listens for `SESSION_CLAIMED` messages
- Instant detection within same browser

**Cross-browser detection:** Firestore `sessionToken` in `useHeartbeat.js:47-50`
```javascript
// Check if another tab took over
if (sessionData.sessionToken && sessionData.sessionToken !== instanceToken) {
  setSessionTakenOver(true)
  return
}
```

**Detection timing:**
- Same browser: Instant via BroadcastChannel
- Cross-browser: Up to `HEARTBEAT_INTERVAL` (15s) for detection
- **Conditions that extend timing:** If network is slow/offline, heartbeat may fail before detecting takeover. Heartbeat timeout (`TIMEOUTS.HEARTBEAT`) could add delay.

**Modal trigger:** `DuplicateTabModal` shown when `isInvalidated` (line 395 in APTestSession.jsx)

---

## 4) UI/Flow Entry Points

**Found: Yes**

### 4.1 Dashboard to Test Session Flow

```
APDashboard (/ap)
    ↓ click TestCard
navigate(`/ap/test/${testId}`) or navigate(`/ap/test/${testId}/assignment/${assignmentId}`)
    ↓
APTestSession (/ap/test/:testId or /ap/test/:testId/assignment/:assignmentId)
    ↓ view='instruction'
InstructionScreen (shows test info, Resume/Begin button)
    ↓ handleBegin() → startTest()
view='testing' (main test UI)
    ↓ handleGoToReview()
view='review' → ReviewScreen
    ↓ handleSubmit() → submitTest()
navigate(`/ap/results/${resultId}`)
    ↓
APReportCard (/ap/results/:resultId)
```

### 4.2 ReviewScreen Props

**Source:** `APTestSession.jsx:368-383`
```javascript
<ReviewScreen
  section={currentSection}
  questions={sectionQuestions}
  answers={answers}
  flags={flags}
  onGoToQuestion={(idx) => {...}}
  onSubmit={handleSubmit}
  onCancel={handleReturnFromReview}
  isSubmitting={isSubmitting}
  isFinalSection={position.sectionIndex === (test?.sections?.length || 1) - 1}
/>
```

**NOT currently passed:** `isSyncing`, `queueLength` - these are available in `useTestSession` but not forwarded to ReviewScreen.

### 4.3 ConnectionStatus Props

**Source:** `APTestSession.jsx:392`
```javascript
<ConnectionStatus isConnected={isConnected} isSyncing={isSyncing} />
```

**Rendered in:** Multiple views (frqChoice, frqHandwritten, review, main testing)

### 4.4 APReportCard Data Loading

**Source:** `APReportCard.jsx:271-297`
```javascript
useEffect(() => {
  async function loadResult() {
    const resultData = await getTestResult(resultId)  // getDoc - one-time fetch
    setResult(resultData)
    const testData = await getTestMeta(resultData.testId)
    setTest(testData)
  }
  if (resultId) {
    loadResult()
  }
}, [resultId])
```

**Answer:** Uses `getDoc()` only (one-time fetch). **No `onSnapshot` listener** currently implemented for real-time updates.

### 4.5 Annotations in Session vs Review

**Session mode:** `APTestSession.jsx:91-141`
- `useAnnotations()` hook provides highlights, strikethroughs, line reader
- Passed to `QuestionDisplay` (lines 423-435)
- `currentHighlights`, `currentStrikethroughs` computed per question

**Review mode:** `ReviewScreen.jsx` does **NOT** receive annotation props.
- ReviewScreen only shows question boxes (answered/flagged status)
- No highlight/strikethrough indicators visible in review grid

**Storage:** Annotations are keyed by `questionId` in Maps:
- `highlights: Map<questionId, HighlightRange[]>` (useAnnotations.js:22)
- `strikethroughs: Map<questionId, Set<choiceId>>` (useAnnotations.js:25)

---

## 5) Must-Answer Questions (from checklist)

**Found: Yes**

### Question 1: Does `seedAPTestData()` currently seed only one MCQ test?

**Answer: Yes**

**Evidence:** `src/apBoost/utils/seedTestData.js:20-48`
- Single test ID: `test_apush_practice_1`
- Single section with `sectionType: SECTION_TYPE.MCQ`
- 5 MCQ questions (`q1` - `q5`)

```javascript
// seedTestData.js:20-21
const testId = 'test_apush_practice_1'
await setDoc(doc(db, COLLECTIONS.TESTS, testId), {...})
```

Collections written: `ap_tests`, `ap_questions` only.

---

### Question 2: Is there already any FRQ/SAQ/DBQ seed logic or subQuestions usage?

**Answer: No (in seed data)**

**Evidence:** Searched `seedTestData.js` - no FRQ questions, no `subQuestions` field populated.

**subQuestions schema expected by UI (from GradingPanel.jsx:144, 183-216):**
```javascript
subQuestions: [
  { label: 'a', prompt: '...', points: 3, rubric: '...' },
  { label: 'b', ... },
]
```

**UI usage:**
- `useTestSession.js:95-104`: Iterates `question.subQuestions` for flat navigation
- `GradingPanel.jsx:183-216`: Renders sub-question grading inputs
- `APReportCard.jsx:125-145`: Displays FRQ answers by sub-question label

---

### Question 3: For mixed tests, does runtime expect separate sections or MIXED type?

**Answer: Separate sections (MCQ + FRQ)**

**Evidence:**
- `apScoringService.js:88-115`: Iterates `test.sections` and checks `section.sectionType === SECTION_TYPE.MCQ` individually
- `useTestSession.js:58-66`: `currentSection` is determined by `currentSectionIndex`
- Section transition: `submitSection()` at line 386-393 increments `currentSectionIndex`

**SECTION_TYPE.MIXED:** Exists in type definitions but actual scoring logic only handles MCQ sections with FRQ scoring deferred to grading.

---

### Question 4: Are assignments/classes already used in teacher/student flows?

**Answer: Yes (partially)**

**Teacher side:**
- `apTeacherService.js`: `getTeacherClasses()` (line 160), `createAssignment()` (line 230)
- `AssignTestModal.jsx`: Uses `createAssignment()` (line 114)

**Student side:**
- `APDashboard.jsx:48-52`: Shows `assignment.dueDate` if present
- `APTestSession.jsx:40`: Receives `assignmentId` from route params
- `useTestSession.js:228`: Passes `assignmentId` to `createOrResumeSession()`

**Fields queried:** `testId`, `classIds`, `studentIds`, `dueDate`, `assignedBy`, `assignedAt`

**Gap:** No `availableFrom` field in current schema.

---

### Question 5: Is flushQueue() guaranteed before result creation when queueLength > 0?

**Answer: Yes**

**Evidence:** `useTestSession.js:405-408`
```javascript
// Flush any pending changes first
if (queueLength > 0) {
  await flushQueue()  // Awaited before createTestResult
}
const resultId = await createTestResult(session.id, frqData)
```

The `await flushQueue()` blocks until flush completes. Sequential execution guaranteed.

---

### Question 6: Is there UI state for "syncing X items" in ReviewScreen?

**Answer: No**

**Evidence:**
- `ReviewScreen.jsx:34-44` props: `section`, `questions`, `answers`, `flags`, `onGoToQuestion`, `onSubmit`, `onCancel`, `isSubmitting`, `isFinalSection`
- **NOT present:** `isSyncing`, `queueLength`

**Where it would come from:** `useTestSession` already exposes `isSyncing` (line 500) and `queueLength` (line 501). Would need to be passed through `APTestSession.jsx` to `ReviewScreen`.

---

### Question 7: Is cross-browser takeover detection strictly bounded to 15s?

**Answer: No - 15s in normal cases, potentially longer**

**Normal case:** Heartbeat runs every 15s (`HEARTBEAT_INTERVAL`), so detection within 15s.

**Conditions that extend it:**
1. **Network timeout:** `TIMEOUTS.HEARTBEAT` (from withTimeout.js) adds timeout duration
2. **Visibility hidden:** Heartbeat runs on visibility change (line 102-113), but if tab stays hidden, no extra heartbeat
3. **Offline period:** If offline when takeover happens, won't detect until back online

```javascript
// useHeartbeat.js:31-36
const sessionDoc = await withTimeout(
  getDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId)),
  TIMEOUTS.HEARTBEAT,  // Could add delay
  'Heartbeat read'
)
```

---

### Question 8: Connection unstable banner timing and display

**Answer: Flips after MAX_FAILURES (3) failures**

**Evidence:** `useHeartbeat.js:70-76`
```javascript
setFailureCount(prev => {
  const newCount = prev + 1
  if (newCount >= MAX_FAILURES) {  // MAX_FAILURES = 3
    setIsConnected(false)
  }
  return newCount
})
```

**Display:** Yes, shown in APTestSession via `ConnectionStatus` component.

**Message:** `"Connection unstable - your progress is being saved locally"` (ConnectionStatus.jsx:44-45)

---

### Question 9: What fields change when teacher marks complete?

**Answer:** Multiple fields updated in `saveGrade()`

**Evidence:** `apGradingService.js:169-206`

```javascript
// Always updated:
frqGrades, gradingStatus, gradedBy, gradedAt

// When status === COMPLETE (lines 182-203):
frqScore       // calculateFRQScore(grades)
score          // mcqScore + frqScore
maxScore       // mcqMaxPoints + frqMaxPoints
percentage     // Math.round((score / maxScore) * 100)
apScore        // calculateAPScore(percentage)
annotatedPdfUrl // If provided
```

**Recalculation confirmed:** Yes, `saveGrade()` recalculates totals.

---

### Question 10: Does APReportCard use getDoc or onSnapshot?

**Answer: getDoc only (one-time fetch)**

**Evidence:** `APReportCard.jsx:277`
```javascript
const resultData = await getTestResult(resultId)
```

`getTestResult()` in `apScoringService.js:173-184`:
```javascript
const resultDoc = await getDoc(doc(db, COLLECTIONS.TEST_RESULTS, resultId))
```

**No onSnapshot:** Not currently implemented. No automatic refresh mechanism.

---

### Question 11: Does ReviewScreen receive annotation props?

**Answer: No**

**Evidence:** `ReviewScreen.jsx:34-44` - no highlight/strikethrough props accepted.

**Where annotations stored:**
- `useAnnotations.js:22-25`:
  ```javascript
  const [highlights, setHighlights] = useState(new Map())     // Map<questionId, HighlightRange[]>
  const [strikethroughs, setStrikethroughs] = useState(new Map())  // Map<questionId, Set<choiceId>>
  ```
- Keyed by `questionId`
- Only used in `QuestionDisplay` during testing view, not review

---

### Question 12: Idempotency safeguards for annotations and submission?

**Answer: Partial**

**Annotations:**
- Queue items have unique IDs (`generateId()` at useOfflineQueue.js:42-44)
- Last-write-wins for same action type/questionId
- No explicit dedupe logic for identical actions

**Submission:**
- Result document ID is deterministic: `{userId}_{testId}_{attemptNumber}` (apScoringService.js:126)
- `setDoc()` overwrites - prevents duplicates
- `isSubmitting` state prevents concurrent submits (useTestSession.js:397)

**Gap:** No explicit idempotency key for queued actions beyond unique ID. Duplicate actions (e.g., two ANSWER_CHANGE for same question) would both be processed, but last wins.

---

## Summary of Key Gaps Identified

1. **Seed data:** Only MCQ test, no FRQ/class/assignment data
2. **ReviewScreen:** Missing `isSyncing`/`queueLength` props for sync progress UI
3. **APReportCard:** No real-time listener - uses one-time `getDoc()`
4. **Review mode annotations:** Not displayed in ReviewScreen
5. **Assignment schema:** Missing `availableFrom` field
6. **SECTION_TYPE.MIXED:** Defined but not fully utilized in runtime logic
