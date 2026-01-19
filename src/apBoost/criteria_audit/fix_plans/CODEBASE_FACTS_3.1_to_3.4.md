# CODEBASE_FACTS__UNK__3.1_to_3.4.md

**Generated:** 2026-01-14
**Scope:** Data model enhancements for ap_tests, ap_stimuli, ap_questions, ap_session_state

---

## 1) Canonical Data Schema / Source-of-Truth

**Found: Yes**

### ap_tests Collection
- **Defined in:** `src/apBoost/utils/apTypes.js:L91`
```javascript
COLLECTIONS = {
  TESTS: 'ap_tests',
```
- **Schema from seedTestData.js:L21-48:**
```javascript
await setDoc(doc(db, COLLECTIONS.TESTS, testId), {
  title: 'AP US History Practice Exam #1',
  subject: 'AP_US_HISTORY',
  testType: TEST_TYPE.EXAM,
  createdBy: 'system',
  isPublic: true,
  questionOrder: QUESTION_ORDER.FIXED,
  sections: [
    {
      id: 'section1',
      title: 'Multiple Choice',
      sectionType: SECTION_TYPE.MCQ,
      timeLimit: 45, // minutes
      questionIds: ['q1', 'q2', 'q3', 'q4', 'q5'],
      mcqMultiplier: 1.0,
      calculatorEnabled: false,
    }
  ],
  scoreRanges: { ap5: {...}, ap4: {...}, ... },
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
})
```
- **Section schema fields confirmed:**
  - `id`, `title`, `sectionType`, `timeLimit` (minutes), `questionIds`, `mcqMultiplier`, `calculatorEnabled`
  - **NO `frqMultipliers` field exists** in seed or write paths

### ap_questions Collection
- **Defined in:** `src/apBoost/utils/apTypes.js:L92`
- **Schema from apQuestionService.js:L155-188:**
```javascript
const newQuestion = {
  questionText: questionData.questionText || '',
  questionType: questionData.questionType || QUESTION_TYPE.MCQ,
  format: questionData.format || 'VERTICAL',
  subject: questionData.subject || '',
  questionDomain: questionData.questionDomain || '',
  questionTopic: questionData.questionTopic || '',
  difficulty: questionData.difficulty || DIFFICULTY.MEDIUM,
  choiceA: questionData.choiceA || null,
  choiceB: questionData.choiceB || null,
  choiceC: questionData.choiceC || null,
  choiceD: questionData.choiceD || null,
  choiceE: questionData.choiceE || null,
  choiceCount: questionData.choiceCount || 4,
  correctAnswers: questionData.correctAnswers || [],
  subQuestions: questionData.subQuestions || null,
  stimulusId: questionData.stimulusId || null,
  stimulus: questionData.stimulus || null,
  explanation: questionData.explanation || '',
  partialCredit: questionData.partialCredit || false,
  createdBy: questionData.createdBy,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
}
```
- **Fields NOT in createQuestion:** `rubric`, `tags`, `points` (points only in seed data)

### ap_stimuli Collection
- **Defined in:** `src/apBoost/utils/apTypes.js:L93`
```javascript
STIMULI: 'ap_stimuli',
```
- **Schema:** **NOT IMPLEMENTED** - No service reads/writes to this collection
- **Inline stimulus shape (from seedTestData.js:L123-127):**
```javascript
stimulus: {
  type: 'PASSAGE',
  content: '"The factory system..."',
  source: 'Harriet Martineau, Society in America, 1837',
},
```
- **Fields used in UI:** `type`, `content`, `source`, `imageAlt`
- **Fields NOT used anywhere:** `title`, `tags`, `createdBy`, timestamps

### ap_session_state Collection
- **Defined in:** `src/apBoost/utils/apTypes.js:L94`
- **Schema from apSessionService.js:L47-67:**
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

---

## 2) Write Paths

**Found: Yes**

### ap_tests
| Service | Function | Fields Written |
|---------|----------|----------------|
| apTeacherService.js:L52-76 | `createTest()` | title, subject, testType, sections, scoreRanges, questionOrder, isPublished, hasFRQ, createdBy, createdAt, updatedAt |
| apTeacherService.js:L84-105 | `updateTest()` | `...updates`, hasFRQ, updatedAt |
| apQuestionService.js:L240-270 | `addQuestionsToSection()` | sections (array update), updatedAt |
| apQuestionService.js:L317-346 | `reorderSectionQuestions()` | sections (questionIds reorder), updatedAt |

### ap_questions
| Service | Function | Fields Written |
|---------|----------|----------------|
| apQuestionService.js:L155-196 | `createQuestion()` | Full schema (see above) |
| apQuestionService.js:L204-216 | `updateQuestion()` | `...updates`, updatedAt |

### ap_session_state
| Service | Function | Update Pattern |
|---------|----------|----------------|
| apSessionService.js:L69 | `createOrResumeSession()` | `setDoc()` - full document |
| apSessionService.js:L112-122 | `updateSession()` | `...updates`, lastAction |
| apSessionService.js:L131-141 | `saveAnswer()` | `answers.${questionId}`, lastAction |
| apSessionService.js:L150-176 | `toggleQuestionFlag()` | `flaggedQuestions` (array), lastAction |
| apSessionService.js:L185-196 | `updatePosition()` | currentSectionIndex, currentQuestionIndex, lastAction |
| apSessionService.js:L205-215 | `updateTimer()` | `sectionTimeRemaining.${sectionId}`, lastAction |
| apSessionService.js:L222-233 | `completeSession()` | status, completedAt, lastAction |
| useOfflineQueue.js:L202-225 | `flushQueue()` | `answers.${questionId}`, currentSectionIndex, currentQuestionIndex, `sectionTimeRemaining.${sectionId}`, lastAction |

### ap_stimuli
- **NOT FOUND** - No write paths exist

---

## 3) Offline/Resilience Mechanics

**Found: Yes**

Relevant to ap_session_state writes:

- **File:** `src/apBoost/hooks/useOfflineQueue.js`
- **Mechanism:** IndexedDB queue (`ap_boost_queue`) stores actions when offline, flushes to Firestore when online
- **Queue item shape (L131-138):**
```javascript
const queueItem = {
  id: generateId(),
  sessionId,
  localTimestamp: Date.now(),
  action: action.action,  // ANSWER_CHANGE, FLAG_TOGGLE, NAVIGATION, TIMER_SYNC
  payload: action.payload,
  status: 'PENDING',
}
```
- **Flush logic (L202-225):** Builds update object from queued actions, writes to Firestore with dot notation paths
- **Answer write pattern (L206-207):**
```javascript
case 'ANSWER_CHANGE':
  updates[`answers.${item.payload.questionId}`] = item.payload.value
```

---

## 4) UI/Flow Entry Points

**Found: Yes**

### Test Creation/Editing
- **APTestEditor.jsx** - Creates/edits tests with sections
  - Section fields editable: title, sectionType, timeLimit, multiplier (generic, not `mcqMultiplier`)
  - Line 93-101: `multiplier` field (NOT `mcqMultiplier`)

### Question Creation/Editing
- **APQuestionEditor.jsx** - Creates/edits questions
  - Does NOT include: rubric, tags, stimulusId picker
  - Includes: questionText, questionType, format, subject, domain, topic, difficulty, choices, subQuestions, explanation

### Stimulus Display
- **PassageDisplay.jsx:L53** - Uses: `type`, `content`, `source`, `imageAlt`
- **QuestionDisplay.jsx:L74** - `displayStimulus = stimulus || question.stimulus`
- **FRQQuestionDisplay.jsx:L9** - Uses: `type`, `content`, `source`, `imageAlt`
- **No `title` field rendered anywhere**

### Grading
- **apGradingService.js** - No rubric display/usage
- **FRQQuestionDisplay.jsx:L83** - Comment mentions "rubric hint" but only shows point values from subQuestions

### Total Time Display
- **APDashboard.jsx:L15** - `const totalTime = calculateTotalTime(test.sections || [])`
- **InstructionScreen.jsx:L18** - `const totalTime = calculateTotalTime(test.sections || [])`
- **Total time is derived, NOT stored in Firestore**

### Session Status Display
- **APDashboard.jsx:L21** - Checks `session?.status === SESSION_STATUS.IN_PROGRESS`
- **InstructionScreen.jsx:L19** - Checks `existingSession?.status === SESSION_STATUS.IN_PROGRESS`

---

## 5) Must-Answer Questions

### Q1: Canonical Firestore schemas

**ap_tests:** Found: Yes
- See Section 1 - sections array with: id, title, sectionType, timeLimit, questionIds, mcqMultiplier, calculatorEnabled
- No totalTime field, no frqMultipliers field

**ap_questions:** Found: Yes
- See Section 1 - includes stimulusId, inline stimulus, explanation
- NO rubric field, NO tags field in createQuestion

**ap_stimuli:** Found: Partial
- Collection constant defined but **NO service** implements CRUD
- No schema in code - only inline stimulus objects used

**ap_session_state:** Found: Yes
- See Section 1 - answers (object), flaggedQuestions (array), status, lastAction

---

### Q2: Is `frqMultipliers` referenced anywhere?

**Found: No**

- Searched entire `src/apBoost` directory
- Only found in audit/fix plan markdown files
- NOT in any `.js` or `.jsx` files
- `frqMultiplier` (singular) also **NOT FOUND** in code

---

### Q3: How is FRQ scoring calculated?

**Found: Yes**

- **File:** `src/apBoost/services/apGradingService.js:L218-231`
```javascript
export function calculateFRQScore(grades) {
  if (!grades) return 0
  let total = 0
  for (const questionGrade of Object.values(grades)) {
    if (questionGrade.subScores) {
      for (const score of Object.values(questionGrade.subScores)) {
        total += Number(score) || 0
      }
    }
  }
  return total
}
```
- Grades shape: `{ [questionId]: { subScores: { a: 2, b: 3 }, comment: "..." } }`
- **NO multiplier support** - raw sum of subScores only

---

### Q4: Where is MCQ scoring multiplier applied?

**Found: Yes**

- **File:** `src/apBoost/services/apScoringService.js:L23-45`
```javascript
export function calculateMCQScore(answers, questions, section) {
  let correct = 0
  let total = 0
  for (const questionId of section.questionIds || []) {
    // ... count correct
  }
  // Apply multiplier if present
  const multiplier = section.mcqMultiplier || 1
  const points = correct * multiplier
  return { correct, total, points }
}
```
- Used at line 92: `const result = calculateMCQScore(answers, test.questions, section)`
- Field name: `section.mcqMultiplier` with default of 1

---

### Q5: Is there a "total time" helper?

**Found: Yes**

- **File:** `src/apBoost/utils/apTestConfig.js:L114-116`
```javascript
export function calculateTotalTime(sections) {
  return sections.reduce((total, section) => total + (section.timeLimit || 0), 0)
}
```
- Returns sum of section.timeLimit in minutes
- Handles null/undefined with `|| 0`

---

### Q6: Do tests store `totalTime` in Firestore?

**Found: No**

- No `totalTime` field in seedTestData.js test document
- No `totalTime` in createTest() in apTeacherService.js
- Dashboard and InstructionScreen compute it on read via `calculateTotalTime()`

---

### Q7: Does ap_stimuli collection have any service?

**Found: No**

- `COLLECTIONS.STIMULI` defined at `apTypes.js:L93`
- **No service file** `apStimuliService.js` exists
- No functions: getStimulusById, createStimulus, updateStimulus, deleteStimulus, getStimuli
- Collection constant is **unused** in any service

---

### Q8: How does `getTestWithQuestions()` assemble questions?

**Found: Yes**

- **File:** `src/apBoost/services/apTestService.js:L95-124`
```javascript
export async function getTestWithQuestions(testId) {
  const testDoc = await getDoc(doc(db, COLLECTIONS.TESTS, testId))
  const test = { id: testDoc.id, ...testDoc.data() }

  const questionsQuery = query(
    collection(db, COLLECTIONS.QUESTIONS),
    where('testId', '==', testId)
  )
  const questionsSnap = await getDocs(questionsQuery)

  const questionsMap = {}
  questionsSnap.forEach((doc) => {
    questionsMap[doc.id] = { id: doc.id, ...doc.data() }
  })

  test.questions = questionsMap
  return test
}
```
- **NO stimulus resolution** - questions returned as-is with inline `stimulus` object
- `stimulusId` is stored but **never resolved** to fetch from ap_stimuli

---

### Q9: Where is stimulus rendered and what fields assumed?

**Found: Yes**

- **PassageDisplay.jsx:L53:**
```javascript
const { type, content, source, imageAlt } = stimulus
```
- **QuestionDisplay.jsx:L11:**
```javascript
const { type, content, source } = stimulus
```
- **FRQQuestionDisplay.jsx:L9:**
```javascript
const { type, content, source } = stimulus
```

**`title` field:** NOT referenced anywhere in UI components

---

### Q10: Are question `tags` used anywhere?

**Found: No**

- `tags` not in createQuestion() schema
- `tags` not in searchQuestions() filters
- `tags` not in APQuestionEditor.jsx UI
- No search/filter by tags implemented

---

### Q11: Session status representation end-to-end?

**Found: Yes**

**Constants (apTypes.js:L34-39):**
```javascript
export const SESSION_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
}
```

**`ACTIVE` status:** NOT FOUND - only `IN_PROGRESS` exists

**Usage:**
- apSessionService.js:L54 - `status: SESSION_STATUS.IN_PROGRESS` (create)
- apSessionService.js:L90 - `where('status', '==', SESSION_STATUS.IN_PROGRESS)` (query)
- apSessionService.js:L225 - `status: SESSION_STATUS.COMPLETED` (complete)
- APDashboard.jsx:L21 - `session?.status === SESSION_STATUS.IN_PROGRESS`
- InstructionScreen.jsx:L19 - `existingSession?.status === SESSION_STATUS.IN_PROGRESS`

All code uses enum values, not string literals.

---

### Q12: Session answers shape and flaggedQuestions storage?

**Found: Yes**

**Answers shape:**
- **MCQ:** Simple value stored at `answers.${questionId}` (string like "A", "B")
- **FRQ:** Object stored at `answers.${questionId}` with sub-question keys
  - From useTestSession.js:L337-345:
```javascript
if (isFRQQuestion && position.subQuestionLabel) {
  const existing = next.get(questionId) || {}
  next.set(questionId, {
    ...existing,
    [position.subQuestionLabel]: answer  // e.g., { a: "...", b: "..." }
  })
}
```

**flaggedQuestions storage:**
- **Separate array**, NOT embedded in answer objects
- From apSessionService.js:L60: `flaggedQuestions: []`
- Toggle logic (L158-166):
```javascript
let flaggedQuestions = session.flaggedQuestions || []
if (flagged) {
  if (!flaggedQuestions.includes(questionId)) {
    flaggedQuestions = [...flaggedQuestions, questionId]
  }
} else {
  flaggedQuestions = flaggedQuestions.filter(id => id !== questionId)
}
```

**No `markedForReview` embedded in answer shape** - flags are separate array

**Read/write call sites:**
- Write: apSessionService.js:L168 `toggleQuestionFlag()`
- Read: useTestSession.js:L194 `new Set(existingSession.flaggedQuestions || [])`
- Queue action: useTestSession.js:L379-382 `{ action: 'FLAG_TOGGLE', payload: { questionId, markedForReview } }`
- Note: Queue uses `markedForReview` in payload but service stores in `flaggedQuestions` array

---

## Summary of Key Findings

| Item | Status | Evidence Location |
|------|--------|-------------------|
| `frqMultipliers` | NOT FOUND | Searched all .js/.jsx files |
| `mcqMultiplier` | EXISTS | seedTestData.js:L35, apScoringService.js:L41 |
| `calculateTotalTime` | EXISTS | apTestConfig.js:L114-116 |
| `totalTime` in Firestore | NOT STORED | Derived on read |
| ap_stimuli service | NOT IMPLEMENTED | Collection constant only |
| `stimulusId` resolution | NOT IMPLEMENTED | Stored but never fetched |
| stimulus `title` field | NOT USED | Only type/content/source/imageAlt |
| question `rubric` field | NOT IMPLEMENTED | Not in createQuestion |
| question `tags` field | NOT IMPLEMENTED | Not in createQuestion or search |
| `ACTIVE` status | NOT FOUND | Only IN_PROGRESS exists |
| flaggedQuestions | SEPARATE ARRAY | Not embedded in answer objects |
