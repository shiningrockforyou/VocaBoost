# CODEBASE_FACTS__20__20.4_to_20.7.md

**Chunk Scope:** AP teacher question creation + test editor question reordering + student annotated PDF display after grading + design-token consistency in analytics QuestionDetailModal.

---

## 1) Canonical Data Schema / Source-of-Truth

**Found: Yes**

### Question Documents (ap_questions collection)

**Collection Path:** `ap_questions` (defined in `src/apBoost/utils/apTypes.js:92`)

**Field Names + Types (from apQuestionService.js:159-188):**
```javascript
{
  questionText: string,
  questionType: 'MCQ' | 'MCQ_MULTI' | 'FRQ' | 'SAQ' | 'DBQ',
  format: 'VERTICAL' | 'HORIZONTAL',
  subject: string,
  questionDomain: string,
  questionTopic: string,
  difficulty: 'EASY' | 'MEDIUM' | 'HARD',
  // MCQ fields
  choiceA: string | null,
  choiceB: string | null,
  choiceC: string | null,
  choiceD: string | null,
  choiceE: string | null,
  choiceCount: number,
  correctAnswers: string[],  // e.g., ['A'] or ['A', 'C']
  // FRQ fields
  subQuestions: Array<{ label: string, prompt: string, maxPoints: number }> | null,
  // Stimulus
  stimulusId: string | null,
  stimulus: string | null,
  // Other
  explanation: string,
  partialCredit: boolean,
  createdBy: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

**Evidence (apQuestionService.js:159-188):**
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
  choiceB: questionData.choiceB || null,
  choiceC: questionData.choiceC || null,
  choiceD: questionData.choiceD || null,
  choiceE: questionData.choiceE || null,
  choiceCount: questionData.choiceCount || 4,
  correctAnswers: questionData.correctAnswers || [],
  // FRQ sub-questions
  subQuestions: questionData.subQuestions || null,
  ...
}
```

---

### Test Documents (ap_tests collection)

**Collection Path:** `ap_tests` (defined in `src/apBoost/utils/apTypes.js:91`)

**Field Names + Types (from apTeacherService.js:56-68):**
```javascript
{
  title: string,
  subject: string,
  testType: 'EXAM' | 'MODULE',
  sections: Array<{
    title: string,
    sectionType: 'MCQ' | 'FRQ' | 'MIXED',
    timeLimit: number,
    multiplier: number,
    questionIds: string[],  // Array of question doc IDs - ORDER PRESERVED
  }>,
  scoreRanges: { ap5: {min,max}, ap4: {min,max}, ap3: {min,max}, ap2: {min,max}, ap1: {min,max} },
  questionOrder: 'FIXED' | 'RANDOMIZED',
  isPublished: boolean,
  hasFRQ: boolean,
  createdBy: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  publishedAt?: Timestamp,
}
```

**Evidence (apTeacherService.js:56-68):**
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
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
}
```

---

### Result Documents (ap_test_results collection)

**Collection Path:** `ap_test_results` (defined in `src/apBoost/utils/apTypes.js:95`)

**Relevant Fields for Handwritten + Annotated PDF (from APReportCard.jsx:339-355):**
```javascript
{
  gradingStatus: 'NOT_NEEDED' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETE',
  frqSubmissionType: 'TYPED' | 'HANDWRITTEN',
  frqUploadedFiles: Array<{ url: string, originalName: string, name: string }>,
  annotatedPdfUrl: string | null,  // Teacher's annotated feedback PDF
  frqAnswers: object,
  frqGrades: object,
  frqScore: number,
  frqMaxPoints: number,
  ...
}
```

**Evidence (APReportCard.jsx:339-355):**
```javascript
const gradingStatus = result?.gradingStatus || GRADING_STATUS.NOT_NEEDED
const isGradingComplete = gradingStatus === GRADING_STATUS.COMPLETE || gradingStatus === GRADING_STATUS.NOT_NEEDED
const hasFRQ = result?.frqAnswers && Object.keys(result.frqAnswers).length > 0
// ...
const isHandwritten = result?.frqSubmissionType === FRQ_SUBMISSION_TYPE.HANDWRITTEN
const uploadedFiles = result?.frqUploadedFiles || []
const annotatedPdfUrl = result?.annotatedPdfUrl
```

---

### Constants/Enums (from apTypes.js:1-98)

**Question Types (apTypes.js:6-12):**
```javascript
export const QUESTION_TYPE = {
  MCQ: 'MCQ',
  MCQ_MULTI: 'MCQ_MULTI',
  FRQ: 'FRQ',
  SAQ: 'SAQ',
  DBQ: 'DBQ',
}
```

**FRQ Submission Type (apTypes.js:49-53):**
```javascript
export const FRQ_SUBMISSION_TYPE = {
  TYPED: 'TYPED',
  HANDWRITTEN: 'HANDWRITTEN',
}
```

**Grading Status (apTypes.js:42-47):**
```javascript
export const GRADING_STATUS = {
  NOT_NEEDED: 'NOT_NEEDED',
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETE: 'COMPLETE',
}
```

---

## 2) Write Paths

**Found: Yes**

### Create/Update Question Path

**UI Entry Point:** `APQuestionEditor.jsx:handleSave` (L217-270)

**Service Functions:**
- `createQuestion()` - apQuestionService.js:155-196
- `updateQuestion()` - apQuestionService.js:204-216

**Firestore Writes:**

1. **createQuestion (apQuestionService.js:155-196):**
   - Doc Path: `ap_questions/{auto-generated-id}`
   - Method: `addDoc(questionsRef, newQuestion)`
   - Returns: new document ID

2. **updateQuestion (apQuestionService.js:204-216):**
   - Doc Path: `ap_questions/{questionId}`
   - Method: `updateDoc(questionRef, { ...updates, updatedAt: serverTimestamp() })`

**Payload Assembly (APQuestionEditor.jsx:227-254):**
```javascript
const questionData = {
  questionText: questionText.trim(),
  questionType,
  format,
  subject,
  questionDomain,
  questionTopic,
  difficulty,
  explanation,
  createdBy: user?.uid,
}

// MCQ data
if (questionType === QUESTION_TYPE.MCQ || questionType === QUESTION_TYPE.MCQ_MULTI) {
  questionData.choiceCount = choiceCount
  questionData.choiceA = choices.A || null
  questionData.choiceB = choices.B || null
  questionData.choiceC = choices.C || null
  questionData.choiceD = choices.D || null
  questionData.choiceE = choices.E || null
  questionData.correctAnswers = correctAnswers
  questionData.partialCredit = questionType === QUESTION_TYPE.MCQ_MULTI
}

// FRQ data
if (questionType === QUESTION_TYPE.FRQ || questionType === QUESTION_TYPE.SAQ || questionType === QUESTION_TYPE.DBQ) {
  questionData.subQuestions = subQuestions.length > 0 ? subQuestions : null
}
```

**Error Handling:** try/catch with `logError('APQuestionEditor.save', { questionId }, err)` at L264-266

---

### Reorder Questions Within Section Path

**Service Function:** `reorderSectionQuestions()` - apQuestionService.js:317-346

**Exact Write Behavior (apQuestionService.js:317-346):**
```javascript
export async function reorderSectionQuestions(testId, sectionIndex, newOrder) {
  try {
    const testRef = doc(db, COLLECTIONS.TESTS, testId)
    const testSnap = await getDoc(testRef)  // <-- READ first

    if (!testSnap.exists()) {
      throw new Error('Test not found')
    }

    const testData = testSnap.data()
    const sections = [...(testData.sections || [])]

    if (sectionIndex < 0 || sectionIndex >= sections.length) {
      throw new Error('Invalid section index')
    }

    // Update question order
    const section = { ...sections[sectionIndex] }
    section.questionIds = newOrder  // <-- FULL ARRAY OVERWRITE
    sections[sectionIndex] = section

    await updateDoc(testRef, {
      sections,
      updatedAt: serverTimestamp(),
    })  // <-- updateDoc (NOT transaction)
  } catch (error) {
    logError('apQuestionService.reorderSectionQuestions', { testId, sectionIndex }, error)
    throw error
  }
}
```

**Key Facts:**
- Uses `getDoc` + `updateDoc` (NOT a transaction)
- Overwrites entire `questionIds` array (preserves order)
- NO concurrency protection - concurrent edits could lose updates

**Is it called in APTestEditor?**
- **Imported:** Yes, at L6: `import { getQuestionsByIds, removeQuestionFromSection, reorderSectionQuestions } from '../services/apQuestionService'`
- **Called:** **NO** - grep confirms only the import exists, no actual invocation in the file

**Evidence (grep search result):**
```
c:\Users\dmchw\vocaboost\src\apBoost\services\apQuestionService.js:317:export async function reorderSectionQuestions(testId, sectionIndex, newOrder) {
```
(No other calls found in APTestEditor.jsx beyond the import)

---

### Annotated PDF Display Pipeline

**Where annotatedPdfUrl is WRITTEN:**
- `apGradingService.js:saveGrade()` at L165-211

**Evidence (apGradingService.js:165-179):**
```javascript
export async function saveGrade(resultId, grades, status, teacherId, annotatedPdfUrl = null) {
  try {
    const resultRef = doc(db, COLLECTIONS.TEST_RESULTS, resultId)

    const updateData = {
      frqGrades: grades,
      gradingStatus: status,
      gradedBy: teacherId,
      gradedAt: serverTimestamp(),
    }

    // Include annotated PDF URL if provided
    if (annotatedPdfUrl) {
      updateData.annotatedPdfUrl = annotatedPdfUrl
    }
    ...
```

**Where annotatedPdfUrl is READ:**
- `APReportCard.jsx:355`: `const annotatedPdfUrl = result?.annotatedPdfUrl`
- Used in `HandwrittenFilesSection` component at L206-259

---

## 3) Offline/Resilience Mechanics

**Not applicable**

**What was searched:**
- Searched for IndexedDB, localforage, useOfflineQueue in teacher editor flows
- Found `useOfflineQueue.js` exists but it's used for student test session flows, NOT teacher editor flows

**Evidence:**
- `src/apBoost/hooks/useOfflineQueue.js` exists but is NOT imported in:
  - APQuestionEditor.jsx
  - APTestEditor.jsx
  - apQuestionService.js
  - apTeacherService.js

Teacher editor flows use direct Firestore writes with no offline queue or retry mechanism beyond Firebase SDK defaults.

---

## 4) UI/Flow Entry Points

**Found: Yes**

### Route Definitions (routes.jsx:1-109)

**Question Creation/Edit:**
- Path: `/ap/teacher/question/:questionId/edit`
- Component: `APQuestionEditor`
- Evidence (routes.jsx:83-89):
```jsx
<Route
  path="/ap/teacher/question/:questionId/edit"
  element={
    <PrivateRoute>
      <APQuestionEditor />
    </PrivateRoute>
  }
/>
```
- New question: Navigate to `/ap/teacher/question/new/edit` (isNew = `questionId === 'new'`)

**Test Editor:**
- Path: `/ap/teacher/test/:testId/edit`
- Component: `APTestEditor`
- Evidence (routes.jsx:59-66):
```jsx
<Route
  path="/ap/teacher/test/:testId/edit"
  element={
    <PrivateRoute>
      <APTestEditor />
    </PrivateRoute>
  }
/>
```

**Report Card (Annotated PDF Display):**
- Path: `/ap/results/:resultId`
- Component: `APReportCard`
- Evidence (routes.jsx:42-48):
```jsx
<Route
  path="/ap/results/:resultId"
  element={
    <PrivateRoute>
      <APReportCard />
    </PrivateRoute>
  }
/>
```

**Analytics (QuestionDetailModal):**
- Path: `/ap/teacher/analytics/:testId`
- Component: `APExamAnalytics`
- Evidence (routes.jsx:99-106):
```jsx
<Route
  path="/ap/teacher/analytics/:testId"
  element={
    <PrivateRoute>
      <APExamAnalytics />
    </PrivateRoute>
  }
/>
```

---

### SectionEditor Location

**Inline inside APTestEditor.jsx** (NOT a separate file)

**Evidence (APTestEditor.jsx:14-151):**
```javascript
/**
 * Section editor component
 */
function SectionEditor({
  section,
  sectionIndex,
  questions,
  onUpdate,
  onDelete,
  onAddQuestions,
  onRemoveQuestion,
  onMoveSection,
  canMoveUp,
  canMoveDown,
}) {
  // ... implementation at lines 14-151
}
```

---

### QuestionDetailModal Invocation

**Invoked from:** `APExamAnalytics.jsx:382-392`

**Evidence (APExamAnalytics.jsx:382-392):**
```jsx
{/* Question Detail Modal */}
{selectedQuestion && (
  <QuestionDetailModal
    question={questions[selectedQuestion]}
    questionNumber={
      Object.keys(mcqPerformance || {}).indexOf(selectedQuestion) + 1
    }
    distribution={distributions[selectedQuestion] || {}}
    totalResponses={analytics?.totalStudents || 0}
    onClose={() => setSelectedQuestion(null)}
  />
)}
```

**Trigger:** `handleQuestionClick` at L190-192, called from `PerformanceGrid` and `MCQDetailedView` via `onQuestionClick` prop.

---

## 5) Must-Answer Questions (Checklist)

### Q1: What is the exact Firestore schema for a Test's sections and section.questionIds?

**Answer:**
- `sections` is an array of section objects
- Each section has `questionIds: string[]` - an array of question document IDs
- Order IS significant (array order = question display order)

**Evidence (apTeacherService.js:56-68):**
```javascript
sections: testData.sections || [],
// Section structure from APTestEditor.jsx:268-278:
{
  title: `Section ${sections.length + 1}`,
  sectionType: SECTION_TYPE.MCQ,
  timeLimit: 45,
  multiplier: 1.0,
  questionIds: [],
}
```

---

### Q2: In APTestEditor, what is the source of truth for section questions when rendering?

**Answer:** `section.questionIds` (array of IDs) + `questionsCache` (map of ID → question object)

**Evidence (APTestEditor.jsx:341-345):**
```javascript
// Get questions for a section
const getSectionQuestions = (section) => {
  return (section.questionIds || [])
    .map(id => questionsCache[id])
    .filter(Boolean)
}
```

Questions are loaded at L247-255:
```javascript
const allQuestionIds = test.sections?.flatMap(s => s.questionIds || []) || []
if (allQuestionIds.length > 0) {
  const questions = await getQuestionsByIds(allQuestionIds)
  const cache = {}
  questions.forEach(q => {
    cache[q.id] = q
  })
  setQuestionsCache(cache)
}
```

---

### Q3: Does reorderSectionQuestions write the entire questionIds array or use arrayUnion/arrayRemove?

**Answer:** Writes the **entire questionIds array** (preserves order)

**Evidence (apQuestionService.js:334-341):**
```javascript
const section = { ...sections[sectionIndex] }
section.questionIds = newOrder  // <-- Full array replacement
sections[sectionIndex] = section

await updateDoc(testRef, {
  sections,
  updatedAt: serverTimestamp(),
})
```

---

### Q4: Does reorderSectionQuestions use a transaction or any concurrency guard?

**Answer:** **NO** - uses simple `getDoc` + `updateDoc` with no transaction

**Evidence (apQuestionService.js:319-341):**
```javascript
const testRef = doc(db, COLLECTIONS.TESTS, testId)
const testSnap = await getDoc(testRef)  // <-- Read
// ... modify sections array ...
await updateDoc(testRef, { sections, updatedAt: serverTimestamp() })  // <-- Write
```

No `runTransaction` or optimistic locking. Concurrent edits could cause lost updates.

---

### Q5: Is reorderSectionQuestions imported in APTestEditor today, and is it ever called?

**Answer:**
- **Imported:** Yes
- **Called:** **NO**

**Evidence (APTestEditor.jsx:6):**
```javascript
import { getQuestionsByIds, removeQuestionFromSection, reorderSectionQuestions } from '../services/apQuestionService'
```

Grep search for `reorderSectionQuestions(` found only the function definition in apQuestionService.js:317 and documentation/plan files. **No actual invocation in APTestEditor.jsx**.

---

### Q6: In APQuestionEditor.handleSave, what exact object shape is sent to createQuestion/updateQuestion?

**Answer:** (APQuestionEditor.jsx:227-254)
```javascript
const questionData = {
  questionText: questionText.trim(),
  questionType,               // 'MCQ' | 'MCQ_MULTI' | 'FRQ' | 'SAQ' | 'DBQ'
  format,                     // 'VERTICAL' | 'HORIZONTAL'
  subject,
  questionDomain,
  questionTopic,
  difficulty,                 // 'EASY' | 'MEDIUM' | 'HARD'
  explanation,
  createdBy: user?.uid,
}

// Added for MCQ/MCQ_MULTI:
questionData.choiceCount = choiceCount      // number
questionData.choiceA = choices.A || null
questionData.choiceB = choices.B || null
questionData.choiceC = choices.C || null
questionData.choiceD = choices.D || null
questionData.choiceE = choices.E || null
questionData.correctAnswers = correctAnswers  // string[]
questionData.partialCredit = (questionType === QUESTION_TYPE.MCQ_MULTI)

// Added for FRQ/SAQ/DBQ:
questionData.subQuestions = subQuestions.length > 0 ? subQuestions : null
// subQuestions: Array<{ label: string, prompt: string, maxPoints: number }>
```

---

### Q7: Where are the enums/constants for question types and FRQ_SUBMISSION_TYPE defined?

**Answer:** `src/apBoost/utils/apTypes.js`

**Evidence (apTypes.js:6-12, 49-53):**
```javascript
// Question Types (L6-12)
export const QUESTION_TYPE = {
  MCQ: 'MCQ',
  MCQ_MULTI: 'MCQ_MULTI',
  FRQ: 'FRQ',
  SAQ: 'SAQ',
  DBQ: 'DBQ',
}

// FRQ Submission Type (L49-53)
export const FRQ_SUBMISSION_TYPE = {
  TYPED: 'TYPED',
  HANDWRITTEN: 'HANDWRITTEN',
}
```

---

### Q8: In APReportCard, what are the exact result fields used to decide "handwritten" and render the annotated PDF link?

**Answer:**

**Fields used (APReportCard.jsx:339-355):**
```javascript
const gradingStatus = result?.gradingStatus || GRADING_STATUS.NOT_NEEDED
const isGradingComplete = gradingStatus === GRADING_STATUS.COMPLETE || gradingStatus === GRADING_STATUS.NOT_NEEDED

const isHandwritten = result?.frqSubmissionType === FRQ_SUBMISSION_TYPE.HANDWRITTEN
const uploadedFiles = result?.frqUploadedFiles || []
const annotatedPdfUrl = result?.annotatedPdfUrl
```

**Gating conditions for annotated PDF display (APReportCard.jsx:236):**
```jsx
{isGradingComplete && annotatedPdfUrl && (
  // Render annotated PDF link
)}
```

---

### Q9: Is the annotated PDF field named annotatedPdfUrl everywhere, or are there alternate names?

**Answer:** Consistently named `annotatedPdfUrl` everywhere.

**Evidence (grep search results):**
- Write: `apGradingService.js:178` - `updateData.annotatedPdfUrl = annotatedPdfUrl`
- Read: `APReportCard.jsx:355` - `const annotatedPdfUrl = result?.annotatedPdfUrl`
- Props: `HandwrittenFilesSection` receives `annotatedPdfUrl` prop

No alternate names (`frqGradedPdfUrl`, `gradedPdfUrl`) found in active code. Prior audit files reference this consistency.

---

### Q10: In src/index.css, do the design tokens referenced exist?

**Answer:** **Partial** - Core tokens exist but naming differs slightly from raw Tailwind

**Tokens that EXIST (index.css:379-416):**

| Plan Reference | Actual Token | Location |
|---------------|--------------|----------|
| `bg-success` | `--color-success` (emerald-50 light / emerald-900 dark) | L382 |
| `bg-error` | `--color-error` (red-50 light / red-900 dark) | L390 |
| `text-success-text` | `--color-text-success` (emerald-600 light / emerald-400 dark) | L386 |
| `text-success-text-strong` | `--color-text-success-strong` (emerald-800 light / emerald-200 dark) | L387 |
| `text-error-text` | `--color-text-error` (red-600 light / red-400 dark) | L394 |
| `text-error-text-strong` | `--color-text-error-strong` (red-800 light / red-200 dark) | L395 |
| `bg-surface` | `--color-surface` | L329 |

**Evidence (index.css:379-395):**
```css
/* Success (emerald) */
--color-success: rgb(var(--color-success-bg));
--color-success-subtle: rgb(var(--color-success-bg-subtle));
--color-border-success: rgb(var(--color-success-border));
--color-ring-success: rgb(var(--color-success-ring));
--color-text-success: rgb(var(--color-success-text));
--color-text-success-strong: rgb(var(--color-success-text-strong));

/* Error (red) */
--color-error: rgb(var(--color-error-bg));
--color-error-subtle: rgb(var(--color-error-bg-subtle));
--color-border-error: rgb(var(--color-error-border));
--color-ring-error: rgb(var(--color-error-ring));
--color-text-error: rgb(var(--color-error-text));
--color-text-error-strong: rgb(var(--color-error-text-strong));
```

**Tokens NOT directly defined:** `bg-btn-success`, `bg-ring-error` (though `ring-success`/`ring-error` exist via `--color-ring-success`/`--color-ring-error`)

---

### Q11: In QuestionDetailModal.jsx, enumerate all raw Tailwind color classes used

**Answer:** (QuestionDetailModal.jsx:6-30 - ResponseBar component)

| Line | Raw Class | Should Map To |
|------|-----------|---------------|
| L8 | `bg-green-50` | `bg-success` |
| L8 | `bg-red-50` | `bg-error` |
| L11 | `text-green-700` | `text-success-text-strong` |
| L11 | `text-red-700` | `text-error-text-strong` |
| L15 | `text-green-600` | `text-success-text` |
| L22 | `bg-white` | `bg-surface` |
| L24 | `bg-green-500` | `bg-btn-success` or token equivalent |
| L24 | `bg-red-400` | `bg-error-subtle` or token equivalent |

**Evidence (QuestionDetailModal.jsx:6-30):**
```jsx
function ResponseBar({ choice, percentage, count, isCorrect }) {
  return (
    <div className={`p-3 rounded-[--radius-input] ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
            ({choice})
          </span>
          {isCorrect && (
            <span className="text-green-600 text-sm">✓ Correct</span>
          )}
        </div>
        ...
      </div>
      <div className="h-4 bg-white rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${isCorrect ? 'bg-green-500' : 'bg-red-400'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
```

**Comparison with other analytics components:**

`performanceColors.js:7-13` also uses raw Tailwind colors:
```javascript
export const PERFORMANCE_THRESHOLDS = [
  { min: 85, color: 'bg-green-500', textColor: 'text-green-500', label: 'Excellent' },
  { min: 70, color: 'bg-lime-400', textColor: 'text-lime-500', label: 'Good' },
  { min: 60, color: 'bg-yellow-400', textColor: 'text-yellow-500', label: 'Satisfactory' },
  { min: 50, color: 'bg-orange-400', textColor: 'text-orange-500', label: 'Needs Improvement' },
  { min: 0, color: 'bg-red-500', textColor: 'text-red-500', label: 'Critical' },
]
```

`MCQDetailedView.jsx:20` also uses raw:
```jsx
className={`${isCorrect ? 'text-green-600 font-medium' : 'text-text-muted'}`}
```

---

### Q12: Where is logError defined/imported, and what context fields does it typically expect?

**Answer:** Defined in `src/apBoost/utils/logError.js:14-34`

**Function Signature:**
```javascript
export function logError(functionName, context = {}, error = null)
```

**Parameters:**
- `functionName`: string - e.g., `'APQuestionEditor.save'`, `'apQuestionService.reorderSectionQuestions'`
- `context`: object - typically contains relevant identifiers like `{ questionId }`, `{ testId, sectionIndex }`, etc.
- `error`: Error object or string

**Evidence (logError.js:14-34):**
```javascript
export function logError(functionName, context = {}, error = null) {
  const errorInfo = {
    function: functionName,
    context,
    message: error?.message || String(error || 'Unknown error'),
    code: error?.code || null,
    stack: error?.stack || null,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
  }

  // Console output for development
  console.error(`[APBoost:${functionName}]`, errorInfo)

  return errorInfo
}
```

**Usage patterns found:**
- `logError('APQuestionEditor.loadQuestion', { questionId }, err)` - APQuestionEditor.jsx:165
- `logError('APQuestionEditor.save', { questionId }, err)` - APQuestionEditor.jsx:265
- `logError('apQuestionService.reorderSectionQuestions', { testId, sectionIndex }, error)` - apQuestionService.js:343

---

## Open Questions / Risks

1. **Concurrency Risk in reorderSectionQuestions:** The function uses read-then-write without a transaction. If two users reorder the same section simultaneously, the second write will overwrite the first, losing changes. This is a factual observation of the current implementation.

2. **reorderSectionQuestions is imported but never called:** The function exists and is imported, but APTestEditor does not have any UI or handler that invokes it. Question reordering UI is missing.

3. **Design Token Inconsistency across analytics:** Both `QuestionDetailModal.jsx` and `performanceColors.js` use raw Tailwind colors. A fix would need to address both files (or at minimum ensure consistency).

4. **Progress bar fill colors:** The bar fills in QuestionDetailModal use `bg-green-500`/`bg-red-400` which don't have exact token equivalents. The closest would be `bg-btn-success` (emerald-600) for success or custom tokens may be needed.
