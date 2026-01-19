# Codebase Facts Report: UNK__4.1_to_4.5

**Generated:** 2026-01-14
**Inspector:** Claude Agent (Repo Inspector)
**Scope:** MCQ_MULTI scoring, partialCredit, FRQ multipliers, calculateAPScore implementations, scoreRanges

---

## 1) Canonical Data Schema / Source-of-Truth

**Found: Yes**

### Question Schema

**Source:** `src/apBoost/services/apQuestionService.js:159-188`

```javascript
const newQuestion = {
  questionText: questionData.questionText || '',
  questionType: questionData.questionType || QUESTION_TYPE.MCQ,
  format: questionData.format || 'VERTICAL',
  subject: questionData.subject || '',
  questionDomain: questionData.questionDomain || '',
  questionTopic: questionData.questionTopic || '',
  difficulty: questionData.difficulty || DIFFICULTY.MEDIUM,
  // MCQ choices
  choiceA: questionData.choiceA || null,
  ...
  choiceCount: questionData.choiceCount || 4,
  correctAnswers: questionData.correctAnswers || [],
  // FRQ sub-questions
  subQuestions: questionData.subQuestions || null,
  // Scoring
  partialCredit: questionData.partialCredit || false,
  ...
}
```

**Key fields:**
- `questionType`: String enum - values from `QUESTION_TYPE`
- `correctAnswers`: **Array of strings** (e.g., `['B']` or `['A', 'C']`)
- `partialCredit`: Boolean, defaults to `false`
- `subQuestions`: Array of `{ label, prompt, maxPoints }` or null

### QUESTION_TYPE Enum

**Source:** `src/apBoost/utils/apTypes.js:6-12`

```javascript
export const QUESTION_TYPE = {
  MCQ: 'MCQ',
  MCQ_MULTI: 'MCQ_MULTI',
  FRQ: 'FRQ',
  SAQ: 'SAQ',
  DBQ: 'DBQ',
}
```

### Section Schema

**Source:** `src/apBoost/utils/seedTestData.js:28-37`

```javascript
sections: [
  {
    id: 'section1',
    title: 'Multiple Choice',
    sectionType: SECTION_TYPE.MCQ,
    timeLimit: 45,
    questionIds: ['q1', 'q2', 'q3', 'q4', 'q5'],
    mcqMultiplier: 1.0,
    calculatorEnabled: false,
  }
]
```

**Key fields:**
- `sectionType`: `MCQ`, `FRQ`, or `MIXED`
- `mcqMultiplier`: Number (used in scoring)
- **No `frqMultiplier` or `frqMultipliers` field exists** in seed data or services

### Test Schema

**Source:** `src/apBoost/services/apTeacherService.js:56-68`

```javascript
const newTest = {
  title: testData.title || 'Untitled Test',
  subject: testData.subject || '',
  testType: testData.testType || TEST_TYPE.EXAM,
  sections: testData.sections || [],
  scoreRanges: testData.scoreRanges || DEFAULT_SCORE_RANGES,
  questionOrder: testData.questionOrder || 'FIXED',
  isPublished: false,
  hasFRQ: false,
  createdBy: testData.createdBy,
  ...
}
```

### Session State Answer Schema

**Source:** `src/apBoost/services/apSessionService.js:49-67`

```javascript
const sessionData = {
  ...
  answers: {},  // { [questionId]: answer }
  ...
}
```

**Answer storage for MCQ:**
- **Source:** `src/apBoost/hooks/useTestSession.js:343-345`
```javascript
// For MCQ (non-FRQ):
next.set(questionId, answer)  // answer is a single string like 'A'
```

**Answer storage for FRQ:**
- **Source:** `src/apBoost/hooks/useTestSession.js:337-342`
```javascript
// For FRQ with sub-questions, store as object
if (isFRQQuestion && position.subQuestionLabel) {
  const existing = next.get(questionId) || {}
  next.set(questionId, {
    ...existing,
    [position.subQuestionLabel]: answer
  })
}
```

### Result Document Schema

**Source:** `src/apBoost/services/apScoringService.js:127-154`

```javascript
const resultData = {
  userId: session.userId,
  testId: session.testId,
  classId: session.classId || null,
  assignmentId: session.assignmentId || null,
  attemptNumber: session.attemptNumber,
  isFirstAttempt: session.attemptNumber === 1,
  sessionId: session.id,
  answers,
  score: totalScore,
  maxScore,
  percentage,
  apScore,
  sectionScores,
  mcqResults,
  frqSubmissionType: frqData?.frqSubmissionType || null,
  frqUploadedFiles: frqData?.frqUploadedFiles || null,
  frqAnswers: session.answers || {},
  frqMaxPoints: 0,  // Will be calculated from FRQ section questions
  frqScore: null,   // Set after grading
  annotatedPdfUrl: null,
  frqGrades: null,
  gradingStatus,
  ...
}
```

**Critical observation:** Result stores `score` and `maxScore`, but grading service reads `mcqScore` and `mcqMaxPoints` (lines 190-191) which are **NOT WRITTEN** during result creation.

---

## 2) Write Paths

**Found: Yes**

### Student Answer Writes

**Primary path via offline queue:**

**Source:** `src/apBoost/hooks/useTestSession.js:350-358`
```javascript
// Queue for sync
addToQueue({
  action: 'ANSWER_CHANGE',
  payload: {
    questionId,
    value: answer,
    subQuestionLabel: position.subQuestionLabel // null for MCQ
  }
})
```

**Queue flush to Firestore:**

**Source:** `src/apBoost/hooks/useOfflineQueue.js:204-207`
```javascript
case 'ANSWER_CHANGE':
  updates[`answers.${item.payload.questionId}`] = item.payload.value
  break
```

**Direct write path (also exists):**

**Source:** `src/apBoost/services/apSessionService.js:131-140`
```javascript
export async function saveAnswer(sessionId, questionId, answer) {
  try {
    await updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), {
      [`answers.${questionId}`]: answer,
      lastAction: serverTimestamp(),
    })
  }
}
```

**Collection:** `ap_session_state`

### Test Result Creation

**Source:** `src/apBoost/services/apScoringService.js:67-165`

- Function: `createTestResult(sessionId, frqData)`
- Writes to: `ap_test_results` collection
- Doc ID pattern: `${session.userId}_${session.testId}_${session.attemptNumber}`

**Source:** `src/apBoost/services/apScoringService.js:156`
```javascript
await setDoc(doc(db, COLLECTIONS.TEST_RESULTS, resultId), resultData)
```

### Grading Updates

**Source:** `src/apBoost/services/apGradingService.js:165-210`

- Function: `saveGrade(resultId, grades, status, teacherId, annotatedPdfUrl)`
- Updates: `ap_test_results` collection
- Updates fields: `frqGrades`, `gradingStatus`, `gradedBy`, `gradedAt`, `annotatedPdfUrl`, `frqScore`, `score`, `maxScore`, `percentage`, `apScore`

**Source:** `src/apBoost/services/apGradingService.js:206`
```javascript
await updateDoc(resultRef, updateData)
```

---

## 3) Offline/Resilience Mechanics

**Found: Yes**

### IndexedDB Queue

**Source:** `src/apBoost/hooks/useOfflineQueue.js:8-11`
```javascript
const DB_NAME = 'ap_boost_queue'
const STORE_NAME = 'actions'
const DB_VERSION = 1
```

### Action Types

**Source:** `src/apBoost/hooks/useOfflineQueue.js:203-225`
- `ANSWER_CHANGE` - stores answers
- `FLAG_TOGGLE` - not fully implemented (comment says "Flags need special handling")
- `NAVIGATION` - updates position
- `TIMER_SYNC` - saves remaining time

### Retry/Backoff

**Source:** `src/apBoost/hooks/useOfflineQueue.js:257-262`
```javascript
// Exponential backoff retry
retryCountRef.current++
if (retryCountRef.current < 5) {
  const delay = Math.pow(2, retryCountRef.current) * 1000 // 2s, 4s, 8s, 16s
  scheduleFlush(delay)
}
```

### Flush Triggers

**Source:** `src/apBoost/hooks/useOfflineQueue.js:153-156`
```javascript
// Schedule flush if online
if (isOnline) {
  scheduleFlush(1000) // 1 second debounce
}
```

**On reconnect:** `src/apBoost/hooks/useOfflineQueue.js:89-91`
```javascript
const handleOnline = () => {
  ...
  scheduleFlush(1000)
}
```

---

## 4) UI/Flow Entry Points

**Found: Yes**

### MCQ Answer Capture

**Source:** `src/apBoost/components/AnswerInput.jsx:17-24`
```javascript
export default function AnswerInput({
  question,
  selectedAnswer,
  onSelect,
  disabled = false,
  strikethroughs = new Set(),
  onStrikethrough,
})
```

**Answer selection (single click = single letter):**

**Source:** `src/apBoost/components/AnswerInput.jsx:36,45`
```javascript
const isSelected = selectedAnswer === letter
...
onClick={() => !disabled && onSelect(letter)}
```

**Critical finding:** `AnswerInput.jsx` only supports **single-select** (radio button behavior). There is **NO checkbox/multi-select UI for MCQ_MULTI**.

### MCQ_MULTI UI Gap

**Source:** `src/apBoost/pages/APTestSession.jsx:447-454`
```javascript
<AnswerInput
  question={currentQuestion}
  selectedAnswer={currentAnswer}
  onSelect={setAnswer}
  ...
/>
```

The code does **NOT** check for `questionType === MCQ_MULTI` before rendering. All MCQ types get the same single-select `AnswerInput`.

### Test Submission

**Source:** `src/apBoost/hooks/useTestSession.js:396-421`
```javascript
const submitTest = useCallback(async (frqData = null) => {
  ...
  const resultId = await createTestResult(session.id, frqData)
  return resultId
})
```

### Teacher Grading

**Source:** `src/apBoost/pages/APGradingPage.jsx` (file exists per grep results)
- Calls `saveGrade()` from `apGradingService.js`

---

## 5) Must-Answer Questions

### Q1: Canonical schema for question object?

**Answer:** Question schema is defined in `apQuestionService.js:159-188`. Key fields:
- `questionType`: String from `QUESTION_TYPE` enum (MCQ, MCQ_MULTI, FRQ, SAQ, DBQ)
- `correctAnswers`: **Array of strings** (e.g., `['B']` for MCQ, potentially `['A', 'C']` for MCQ_MULTI)
- `partialCredit`: Boolean, defaults to `false`
- `subQuestions`: Array of `{ label: string, prompt: string, maxPoints: number }` for FRQ types

**Evidence:** `src/apBoost/services/apQuestionService.js:174-183`
```javascript
correctAnswers: questionData.correctAnswers || [],
// FRQ sub-questions
subQuestions: questionData.subQuestions || null,
...
// Scoring
partialCredit: questionData.partialCredit || false,
```

---

### Q2: Where/how are student answers stored in session state?

**Answer:**
- Answers stored in `session.answers` as `{ [questionId]: answer }`
- For MCQ: answer is a **single string** (e.g., `'A'`)
- For FRQ with sub-questions: answer is an **object** `{ a: "text", b: "text" }`
- MCQ_MULTI: **Currently stored as single string** (same as MCQ) - no array support implemented

**Evidence:** `src/apBoost/hooks/useTestSession.js:337-345`
```javascript
// For FRQ with sub-questions, store as object
if (isFRQQuestion && position.subQuestionLabel) {
  const existing = next.get(questionId) || {}
  next.set(questionId, {
    ...existing,
    [position.subQuestionLabel]: answer
  })
} else {
  next.set(questionId, answer)  // MCQ: single string
}
```

---

### Q3: How does scoring distinguish MCQ vs MCQ_MULTI?

**Answer:** **It does NOT distinguish.** The `calculateMCQScore` function treats all MCQ types identically.

**Evidence:** `src/apBoost/services/apScoringService.js:23-45`
```javascript
export function calculateMCQScore(answers, questions, section) {
  let correct = 0
  let total = 0

  for (const questionId of section.questionIds || []) {
    const question = questions[questionId]
    if (!question) continue

    total++
    const studentAnswer = answers[questionId]
    const correctAnswers = question.correctAnswers || []

    if (correctAnswers.includes(studentAnswer)) {
      correct++
    }
  }
  ...
}
```

There is **no check** for `question.questionType === QUESTION_TYPE.MCQ_MULTI`.

---

### Q4: Does `calculateMCQScore()` currently support MCQ_MULTI?

**Answer:** **NO.** Current logic assumes `studentAnswer` is a single string and checks if it's included in `correctAnswers` array. For MCQ_MULTI:
- Student would need to select multiple answers (stored as array)
- Scoring would need to compare arrays

**Evidence:** `src/apBoost/services/apScoringService.js:32-37`
```javascript
const studentAnswer = answers[questionId]  // Expects string
const correctAnswers = question.correctAnswers || []

if (correctAnswers.includes(studentAnswer)) {  // String-in-array check
  correct++
}
```

This logic would fail for MCQ_MULTI because:
1. `studentAnswer` should be an array like `['A', 'C']`
2. `correctAnswers.includes(['A', 'C'])` would always be `false` (array-in-array comparison)

---

### Q5: Is `partialCredit` read anywhere during scoring?

**Answer:** **NOT FOUND** in scoring services.

**Search evidence:** Grep for `partialCredit` in `*.js` files:
- Found in `apQuestionService.js:183` (write/create)
- Found in `seedTestData.js:69,89,109,134,155` (seed data)
- **NOT found** in `apScoringService.js` or `apGradingService.js`

The `partialCredit` field exists in the schema but is **never read** during score calculation.

---

### Q6: Are fractional MCQ points supported end-to-end?

**Answer:** **PARTIALLY.** Points can be fractional due to multiplier, but percentage is always rounded.

**Evidence:** `src/apBoost/services/apScoringService.js:40-44`
```javascript
// Apply multiplier if present
const multiplier = section.mcqMultiplier || 1
const points = correct * multiplier  // Can be fractional if multiplier is e.g. 1.5
```

**Rounding for percentage:** `src/apBoost/services/apScoringService.js:118`
```javascript
const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0
```

**AP score:** Based on rounded percentage, so also effectively rounded.

---

### Q7: Where is FRQ score computed, and does it apply multipliers?

**Answer:** FRQ score computed in `apGradingService.js`. **NO multipliers applied.**

**Evidence:** `src/apBoost/services/apGradingService.js:218-230`
```javascript
export function calculateFRQScore(grades) {
  if (!grades) return 0

  let total = 0
  for (const questionGrade of Object.values(grades)) {
    if (questionGrade.subScores) {
      for (const score of Object.values(questionGrade.subScores)) {
        total += Number(score) || 0  // Raw sum, no multiplier
      }
    }
  }

  return total
}
```

No `frqMultiplier` is applied anywhere.

---

### Q8: What multiplier fields exist on test sections?

**Answer:**
- **Written by editor UI:** `section.multiplier`
- **Read by scoring service:** `section.mcqMultiplier`
- **FRQ multiplier:** **NOT FOUND**

**Editor writes `multiplier`:**

**Evidence:** `src/apBoost/pages/APTestEditor.jsx:93-101`
```javascript
<label className="block text-text-muted text-xs mb-1">Multiplier</label>
<input
  type="number"
  step="0.1"
  min="0.1"
  value={section.multiplier || 1.0}
  onChange={(e) => onUpdate({ multiplier: parseFloat(e.target.value) || 1.0 })}
```

**Scoring reads `mcqMultiplier`:**

**Evidence:** `src/apBoost/services/apScoringService.js:41`
```javascript
const multiplier = section.mcqMultiplier || 1
```

**MISMATCH:** Editor saves `section.multiplier`, scoring reads `section.mcqMultiplier`. These are **different field names**.

---

### Q9: Where is `frqMaxPoints` computed, and is it weighted?

**Answer:** `frqMaxPoints` is **hardcoded to 0** at result creation and **never computed**.

**Evidence:** `src/apBoost/services/apScoringService.js:146`
```javascript
frqMaxPoints: 0, // Will be calculated from FRQ section questions
```

The comment says "Will be calculated" but **no code actually calculates it**. It remains 0 unless manually set.

**In grading completion:** `src/apBoost/services/apGradingService.js:192`
```javascript
const frqMaxPoints = resultData.frqMaxPoints || 0  // Reads existing (likely 0)
```

**No weighting applied** - raw points only.

---

### Q10: How many `calculateAPScore` functions exist and which is used where?

**Answer:** **TWO implementations exist:**

**1. apScoringService.js (correct version with scoreRanges param):**

**Evidence:** `src/apBoost/services/apScoringService.js:53-59`
```javascript
export function calculateAPScore(percentage, scoreRanges = DEFAULT_SCORE_RANGES) {
  if (percentage >= scoreRanges.ap5.min) return 5
  if (percentage >= scoreRanges.ap4.min) return 4
  if (percentage >= scoreRanges.ap3.min) return 3
  if (percentage >= scoreRanges.ap2.min) return 2
  return 1
}
```

**Used in:** Initial result creation (`apScoringService.js:119`):
```javascript
const apScore = calculateAPScore(percentage, test.scoreRanges)
```

**2. apGradingService.js (hardcoded ranges):**

**Evidence:** `src/apBoost/services/apGradingService.js:238-244`
```javascript
export function calculateAPScore(percentage) {
  if (percentage >= 80) return 5
  if (percentage >= 65) return 4
  if (percentage >= 50) return 3
  if (percentage >= 35) return 2
  return 1
}
```

**Used in:** Grading completion (`apGradingService.js:202`):
```javascript
updateData.apScore = calculateAPScore(updateData.percentage)
```

**PROBLEM:** Grading service uses the **local hardcoded version**, ignoring test's custom `scoreRanges`.

---

### Q11: Where does `scoreRanges` live and is it passed consistently?

**Answer:** `scoreRanges` lives on the test document. It is **NOT passed consistently**.

**Test document storage:**

**Evidence:** `src/apBoost/services/apTeacherService.js:61`
```javascript
scoreRanges: testData.scoreRanges || DEFAULT_SCORE_RANGES,
```

**Initial submission (correct):**

**Evidence:** `src/apBoost/services/apScoringService.js:119`
```javascript
const apScore = calculateAPScore(percentage, test.scoreRanges)
```

**Grading completion (INCORRECT):**

**Evidence:** `src/apBoost/services/apGradingService.js:202`
```javascript
updateData.apScore = calculateAPScore(updateData.percentage)  // No scoreRanges passed!
```

The grading service **does not fetch** the test document to get `scoreRanges`.

---

### Q12: Firestore write paths for results and grading updates?

**Answer:**

**Result creation:**
- Collection: `ap_test_results` (from `COLLECTIONS.TEST_RESULTS`)
- Function: `createTestResult()` in `apScoringService.js:67-165`
- Fields written: `score`, `maxScore`, `percentage`, `apScore`, `sectionScores`, `mcqResults`, `frqScore: null`, `frqMaxPoints: 0`, `gradingStatus`

**Evidence:** `src/apBoost/services/apScoringService.js:156`
```javascript
await setDoc(doc(db, COLLECTIONS.TEST_RESULTS, resultId), resultData)
```

**Grading updates:**
- Collection: `ap_test_results`
- Function: `saveGrade()` in `apGradingService.js:165-210`
- Fields updated: `frqGrades`, `frqScore`, `score`, `maxScore`, `percentage`, `apScore`, `gradingStatus`, `gradedBy`, `gradedAt`, `annotatedPdfUrl`

**Evidence:** `src/apBoost/services/apGradingService.js:206`
```javascript
await updateDoc(resultRef, updateData)
```

**CRITICAL BUG:** Grading service reads `mcqScore` and `mcqMaxPoints` (line 190-191) but result creation only writes `score` and `maxScore`. These field names **do not match**.

**Evidence:** `src/apBoost/services/apGradingService.js:190-191`
```javascript
const mcqScore = resultData.mcqScore || 0      // NOT WRITTEN by createTestResult!
const mcqMaxPoints = resultData.mcqMaxPoints || 0  // NOT WRITTEN by createTestResult!
```

---

## Summary of Critical Gaps

| Issue | Status | Location |
|-------|--------|----------|
| MCQ_MULTI scoring | NOT IMPLEMENTED | apScoringService.js:32-37 |
| MCQ_MULTI UI | NOT IMPLEMENTED | AnswerInput.jsx (single-select only) |
| MCQ_MULTI answer storage | NOT IMPLEMENTED | useTestSession.js stores string, not array |
| partialCredit in scoring | NOT USED | Field exists but never read |
| frqMultiplier | NOT FOUND | No FRQ multiplier field or logic |
| multiplier field mismatch | BUG | Editor writes `multiplier`, scoring reads `mcqMultiplier` |
| frqMaxPoints calculation | NOT IMPLEMENTED | Hardcoded to 0 |
| Duplicate calculateAPScore | BUG | Two implementations, grading ignores scoreRanges |
| mcqScore/mcqMaxPoints | BUG | Field name mismatch between create and grading |
