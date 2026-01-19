# CODEBASE_FACTS__UNK__10.1_to_10.9

**Generated:** 2026-01-14
**Chunk ID:** UNK__10.1_to_10.9
**Features in Scope:** Teacher analytics PDF download buttons, FRQ rubric click behavior, Student results table icon, APStudentProfile route

---

## 1) Canonical Data Schema / Source-of-Truth

**Found: Yes**

### Analytics Data Object Shape

The analytics data is returned from `getTestAnalytics()` in `src/apBoost/services/apAnalyticsService.js:23-80`:

```javascript
// Return shape (lines 67-75)
return {
  test,           // Test document from ap_tests collection
  questions,      // Map of { [questionId]: questionObject }
  results,        // Array of result documents from ap_test_results
  mcqPerformance, // { [questionId]: { questionId, questionNumber, correct, total, percentage } }
  frqPerformance, // { [questionId]: { questionId, questionText, totalPoints, totalMaxPoints, percentage, subQuestions: {...}, studentCount } }
  summary,        // { averageScore, averagePercentage, highestScore, lowestScore, apScoreDistribution }
  totalStudents,  // Number
}
```

### MCQ Performance Schema

From `calculateQuestionPerformance()` in `src/apBoost/services/apAnalyticsService.js:88-125`:

```javascript
// Performance object per MCQ question (lines 94-101)
performance[questionId] = {
  questionId,
  questionNumber: question.questionNumber || 0,
  correct: 0,
  total: 0,
  percentage: 0,
}
```

### FRQ Performance Schema

From `calculateFRQPerformance()` in `src/apBoost/services/apAnalyticsService.js:171-243`:

```javascript
// FRQ performance structure (lines 177-185)
performance[questionId] = {
  questionId,
  questionText: question.questionText,
  totalPoints: 0,
  totalMaxPoints: 0,
  percentage: 0,
  subQuestions: {},    // { [label]: { label, points, maxPoints, percentage, count } }
  studentCount: 0,
}

// Sub-question structure (lines 190-196)
performance[questionId].subQuestions[sq.label] = {
  label: sq.label,
  points: 0,
  maxPoints: sq.points || 3,
  percentage: 0,
  count: 0,
}
```

### Question Schema Fields

From `src/apBoost/utils/apTypes.js:6-12` and usage in PDF generator:

```javascript
// Question types
export const QUESTION_TYPE = {
  MCQ: 'MCQ',
  MCQ_MULTI: 'MCQ_MULTI',
  FRQ: 'FRQ',
  SAQ: 'SAQ',
  DBQ: 'DBQ',
}

// Question fields used (from generateQuestionsPdf.js):
// - questionText
// - questionType ('mcq', 'frq', 'saq', 'dbq')
// - choiceA, choiceB, choiceC, choiceD, choiceE
// - choiceCount
// - correctAnswers (array)
// - subQuestions (array of { label, prompt, points })
// - stimulus
// - questionDomain
// - explanation
```

### Collections

From `src/apBoost/utils/apTypes.js:90-98`:

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

---

## 2) Write Paths

**Found: No writes in analytics paths**

### Inspected Paths

1. **APExamAnalytics.jsx** - Searched for `updateDoc|setDoc|addDoc|deleteDoc`
   - **Result:** No matches found
   - The page is read-only; it only fetches data via `getTestAnalytics`, `getStudentResults`, etc.

2. **apAnalyticsService.js** - Searched for `updateDoc|setDoc|addDoc|deleteDoc`
   - **Result:** No matches found
   - Service only uses `getDoc`, `getDocs`, `query`, `where` (read operations)

3. **generateQuestionsPdf.js** - No Firestore imports
   - Uses `jsPDF` library to generate PDF client-side
   - `doc.save(filename)` triggers browser download, no server writes

4. **StudentResultsTable.jsx** - No Firestore imports
   - Uses `Link` for navigation and click handlers for callbacks

### Conclusion

**No writes found in inspected paths.** The analytics page and its components are entirely read-only. PDF downloads are generated client-side and saved locally via browser download.

---

## 3) Offline/Resilience Mechanics

**Not applicable for this chunk.**

Searched terms:
- `pdf save` - Only found `doc.save(filename)` in generateQuestionsPdf.js (browser download, not offline persistence)
- `retry` - Not present in analytics components
- `queue` - Not present in analytics components
- `offline` - Not present in analytics components
- `cache` - Not present in analytics components

The analytics page does not implement any offline/resilience patterns. It relies on live Firestore reads.

---

## 4) UI/Flow Entry Points

**Found: Yes**

### Teacher Analytics Route

**Route Definition:** `src/apBoost/routes.jsx:100-106`

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

**Component:** `src/apBoost/pages/APExamAnalytics.jsx`

**Major UI Sections:**
- Summary Cards (lines 276-294)
- AP Score Distribution (lines 296-301)
- MCQ Section with Grid/Detailed toggle (lines 303-348)
- FRQ Section with FRQCard components (lines 350-367)
- Student Results Table (lines 369-378)
- QuestionDetailModal (lines 381-392)

### Student Click Navigation Target

**File:** `src/apBoost/pages/APExamAnalytics.jsx:195-197`

```javascript
const handleStudentClick = (userId) => {
  navigate(`/ap/teacher/student/${userId}`)
}
```

**Target Path:** `/ap/teacher/student/${userId}`

### Report Card Link

**File:** `src/apBoost/components/analytics/StudentResultsTable.jsx:183-189`

```jsx
<Link
  to={`/ap/results/${result.id}`}
  className="text-brand-primary hover:underline text-sm"
  title="View Report Card"
>
  View Report
</Link>
```

**Target Path:** `/ap/results/${resultId}`

---

## 5) Must-Answer Questions (from checklist)

### Question 1: Where is the teacher analytics page route defined?

**Found: Yes**

**Route:** `/ap/teacher/analytics/:testId`
**File:** `src/apBoost/routes.jsx:100-106`
**Component:** `APExamAnalytics` imported from `./pages/APExamAnalytics`

Evidence:
```jsx
// src/apBoost/routes.jsx:100-106
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

### Question 2: In APExamAnalytics.jsx, what is the runtime shape of analytics data?

**Found: Yes**

**Data Destructuring:** `src/apBoost/pages/APExamAnalytics.jsx:237`

```javascript
const { test, questions, mcqPerformance, frqPerformance, summary } = analytics || {}
```

**Data Loading:** Lines 116-120

```javascript
const analyticsData = await getTestAnalytics(testId, {
  classIds: allClassIds,
  studentIds: studentsData.map(s => s.id),
})
setAnalytics(analyticsData)
```

**mcqPerformance Shape:** (from apAnalyticsService.js:94-101)
```javascript
{
  [questionId]: {
    questionId: string,
    questionNumber: number,
    correct: number,
    total: number,
    percentage: number,
  }
}
```

**frqPerformance Shape:** (from apAnalyticsService.js:177-198)
```javascript
{
  [questionId]: {
    questionId: string,
    questionText: string,
    totalPoints: number,
    totalMaxPoints: number,
    percentage: number,
    subQuestions: {
      [label]: {
        label: string,
        points: number,
        maxPoints: number,
        percentage: number,
        count: number,
      }
    },
    studentCount: number,
  }
}
```

---

### Question 3: PDF utility existence and exports

**Found: Yes**

**File:** `src/apBoost/utils/generateQuestionsPdf.js`

**Exports:**
- `generateQuestionsPdf` (named export, lines 14-263)
- `downloadQuestionsPdf` (named export, lines 271-275)

**Function Signatures:**

```javascript
// Line 14
export async function generateQuestionsPdf(test, questions, options = {})

// Line 271
export async function downloadQuestionsPdf(test, questions, options = {})
```

**Options Supported:** (Line 15)
```javascript
const { includeAnswers = false, includeStimuli = true } = options
```

Evidence from file:
```javascript
// src/apBoost/utils/generateQuestionsPdf.js:7-12
/**
 * Generate a PDF of test questions
 * @param {Object} test - Test object with sections and questions
 * @param {Object} questions - Questions map
 * @param {Object} options - { includeAnswers: boolean, includeStimuli: boolean }
 * @returns {jsPDF} PDF document
 */
```

---

### Question 4: How are MCQ questions identified in analytics?

**Found: Yes**

MCQ questions are identified by iterating `mcqPerformance` keys.

**File:** `src/apBoost/pages/APExamAnalytics.jsx:131-135`

```javascript
// Pre-calculate distributions for MCQ
const dists = {}
for (const questionId of Object.keys(analyticsData.mcqPerformance || {})) {
  const { distribution } = calculateResponseDistribution(results, questionId)
  dists[questionId] = distribution
}
```

**MCQ identification in service:** `src/apBoost/services/apAnalyticsService.js:91-102`

```javascript
// Initialize performance for each MCQ question
for (const [questionId, question] of Object.entries(questions)) {
  if (question.questionType === 'mcq' || !question.questionType) {
    performance[questionId] = {
      questionId,
      questionNumber: question.questionNumber || 0,
      // ...
    }
  }
}
```

Question IDs are consistent between `mcqPerformance` and `analytics.questions` - they use the same Firestore document IDs.

---

### Question 5: FRQ questions + sub-questions structure

**Found: Yes**

**Question object subQuestions field:** Array of `{ label, prompt, points }`

Evidence from `src/apBoost/services/apAnalyticsService.js:187-198`:
```javascript
// Initialize sub-questions
if (question.subQuestions) {
  for (const sq of question.subQuestions) {
    performance[questionId].subQuestions[sq.label] = {
      label: sq.label,
      points: 0,
      maxPoints: sq.points || 3,
      percentage: 0,
      count: 0,
    }
  }
}
```

**Performance data per sub-question:** `{ label, points, maxPoints, percentage, count }`

Evidence from `src/apBoost/components/analytics/FRQCard.jsx:35-37`:
```javascript
const { percentage, subQuestions = {} } = performance
// ...
const subLabels = Object.keys(subQuestions).sort()
```

Sub-question data access in FRQCard (lines 59-67):
```javascript
{subLabels.map(label => {
  const subData = subQuestions[label] || {}
  return (
    <SubQuestionSquare
      key={label}
      label={label}
      percentage={subData.percentage || 0}
      onClick={() => onSubClick?.(label)}
    />
  )
})}
```

---

### Question 6: FRQCard click behavior

**Found: Yes**

**FRQCard accepts `onSubClick`:** `src/apBoost/components/analytics/FRQCard.jsx:29-34`

```jsx
export default function FRQCard({
  questionNumber,
  question,
  performance = {},
  onSubClick,  // <-- accepts handler
}) {
```

**SubQuestionSquare invokes `onSubClick`:** Lines 62-67

```jsx
<SubQuestionSquare
  key={label}
  label={label}
  percentage={subData.percentage || 0}
  onClick={() => onSubClick?.(label)}  // <-- invokes with label
/>
```

**Parent (APExamAnalytics.jsx) does NOT pass `onSubClick`:** Lines 357-364

```jsx
{Object.entries(frqPerformance).map(([questionId, perf], index) => (
  <FRQCard
    key={questionId}
    questionNumber={index + 1}
    question={questions[questionId]}
    performance={perf}
    // NOTE: onSubClick is NOT passed
  />
))}
```

**Conclusion:** The `onSubClick` prop exists and is called in FRQCard, but the parent component does not currently provide a handler.

---

### Question 7: Existing modal patterns

**Found: Yes**

**QuestionDetailModal exists:** `src/apBoost/components/analytics/QuestionDetailModal.jsx`

**Props:** (Lines 35-41)
```jsx
export default function QuestionDetailModal({
  question,
  questionNumber,
  distribution = {},
  totalResponses = 0,
  onClose,
}) {
```

**How it's opened/closed in APExamAnalytics.jsx:**

State storage (line 90):
```javascript
const [selectedQuestion, setSelectedQuestion] = useState(null)
```

Open handler (lines 189-192):
```javascript
const handleQuestionClick = (questionId) => {
  setSelectedQuestion(questionId)
}
```

Render condition (lines 382-392):
```jsx
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

**Other modal patterns:**
- `DuplicateTabModal.jsx` - Uses fixed positioning with backdrop (`fixed inset-0 z-50`)
- `AssignTestModal.jsx` - Uses backdrop + centered modal with `z-40`/`z-50` split

---

### Question 8: Error logging

**Found: Yes**

**logError is available in APExamAnalytics.jsx:** Line 18

```javascript
import { logError } from '../utils/logError'
```

**Usage in APExamAnalytics.jsx:**
- Line 137: `logError('APExamAnalytics.loadData', { testId }, err)`
- Line 182: `logError('APExamAnalytics.applyFilters', { testId }, err)`

**logError utility:** `src/apBoost/utils/logError.js:14-34`

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
  console.error(`[APBoost:${functionName}]`, errorInfo)
  return errorInfo
}
```

---

### Question 9: Student results table and "View Report" link

**Found: Yes**

**File:** `src/apBoost/components/analytics/StudentResultsTable.jsx`

**"View Report" link:** Lines 183-189

```jsx
<Link
  to={`/ap/results/${result.id}`}
  className="text-brand-primary hover:underline text-sm"
  title="View Report Card"
>
  View Report
</Link>
```

**Target path:** `/ap/results/${result.id}`

**Icon usage elsewhere in file:** None. The component uses text labels only ("View Report", sort arrows via text "↑"/"↓").

**Icon library available:** `lucide-react` is installed (`package.json:21`), but NOT currently imported in any apBoost files.

**Design token pattern for hover:** Uses `hover:underline` and `hover:bg-hover` classes (consistent with design token system).

---

### Question 10: Student profile navigation + route

**Found: Partial**

**Navigation target path:** `src/apBoost/pages/APExamAnalytics.jsx:195-197`

```javascript
const handleStudentClick = (userId) => {
  navigate(`/ap/teacher/student/${userId}`)
}
```

**Route definition:** **NOT FOUND**

Searched `src/apBoost/routes.jsx` - No route matching `/ap/teacher/student/:userId`.

**Closest teacher route pattern:** `src/apBoost/routes.jsx:59-66`

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

**PrivateRoute pattern:** All AP routes wrap their component with `<PrivateRoute>` from `src/components/PrivateRoute.jsx`.

---

### Question 11: APStudentProfile page

**Found: No**

**Search result:** `Glob pattern **/APStudentProfile*` returned "No files found"

**Grep result:** `APStudentProfile` only found in audit/fix plan documentation files, not in actual code.

**File does not exist:** `src/apBoost/pages/APStudentProfile.jsx` does NOT exist.

**Correct import paths from existing teacher page (APTeacherDashboard.jsx:1-6):**

```javascript
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import APHeader from '../components/APHeader'
// ...services from '../services/apTeacherService'
import { logError } from '../utils/logError'
```

**Layout convention from APTeacherDashboard.jsx:**
```jsx
return (
  <div className="min-h-screen bg-base">
    <APHeader />
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* content */}
    </main>
  </div>
)
```

---

### Question 12: Are these changes read-only?

**Found: Yes - Confirmed read-only**

**Analytics page render:** Read-only (fetches via `getTestAnalytics`, `getStudentResults`)

**Download PDF:** Read-only (client-side PDF generation via jsPDF, no server calls)

**Student/report links:** Navigation only (uses `navigate()` and `<Link>`, no writes)

**Opening modals:** State changes only (`setSelectedQuestion(questionId)`)

**Searched for write operations:**
- `updateDoc|setDoc|addDoc|deleteDoc` in APExamAnalytics.jsx: No matches
- `updateDoc|setDoc|addDoc|deleteDoc` in apAnalyticsService.js: No matches
- No fetch/POST calls found in analytics components

**Conclusion:** All changes in scope are additive read-only operations. No Firestore writes, analytics tracking, or logging endpoints are triggered.

---

## Summary Table

| Item | Status | Location |
|------|--------|----------|
| Analytics route | ✅ Found | routes.jsx:100-106 |
| APExamAnalytics component | ✅ Found | pages/APExamAnalytics.jsx |
| downloadQuestionsPdf | ✅ Found | utils/generateQuestionsPdf.js:271 |
| mcqPerformance shape | ✅ Found | apAnalyticsService.js:94-101 |
| frqPerformance shape | ✅ Found | apAnalyticsService.js:177-198 |
| FRQCard onSubClick prop | ✅ Found | FRQCard.jsx:33 |
| FRQCard onSubClick handler passed | ❌ Missing | APExamAnalytics.jsx:357-364 |
| QuestionDetailModal | ✅ Found | analytics/QuestionDetailModal.jsx |
| FRQRubricModal | ❌ Not found | Does not exist |
| StudentResultsTable "View Report" | ✅ Found | StudentResultsTable.jsx:183-189 |
| /ap/teacher/student/:userId route | ❌ Not found | Not in routes.jsx |
| APStudentProfile page | ❌ Not found | Does not exist |
| lucide-react icons | ✅ Installed | package.json, not used in apBoost |
| Write operations in analytics | ❌ None | Read-only confirmed |
