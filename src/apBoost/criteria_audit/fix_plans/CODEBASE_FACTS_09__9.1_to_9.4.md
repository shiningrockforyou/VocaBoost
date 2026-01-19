# CODEBASE_FACTS__09__9.1_to_9.4.md

**Chunk ID:** 09__9.1_to_9.4
**Scope:** AP Report Card / Gradebook report-view for AP tests (PDF export, class & student identity display, MCQ/FRQ metadata columns, FRQ weighting display, teacher view navigation, graded-paper download labeling, field-name consistency for graded PDF URLs).
**Generated:** 2026-01-14

---

## 1) Canonical Data Schema / Source-of-Truth

**Found: Yes**

### ap_test_results (Collection: `COLLECTIONS.TEST_RESULTS` = `'ap_test_results'`)

**Evidence:** `src/apBoost/utils/apTypes.js:95`, `src/apBoost/services/apScoringService.js:127-154`

Fields as written in `createTestResult()` (lines 127-154):
```javascript
const resultData = {
  userId: session.userId,           // string - student user ID
  testId: session.testId,           // string - test document ID
  classId: session.classId || null, // string | null - class document ID
  assignmentId: session.assignmentId || null,
  attemptNumber: session.attemptNumber,
  isFirstAttempt: session.attemptNumber === 1,
  sessionId: session.id,
  answers,                          // object - map of questionId -> answer
  score: totalScore,                // number
  maxScore,                         // number
  percentage,                       // number
  apScore,                          // number (1-5)
  sectionScores,                    // object - map of sectionIndex -> { correct, total, points }
  mcqResults,                       // array - [{ questionId, studentAnswer, correctAnswer, correct }]
  frqSubmissionType: frqData?.frqSubmissionType || null, // 'TYPED' | 'HANDWRITTEN' | null
  frqUploadedFiles: frqData?.frqUploadedFiles || null,   // array | null
  frqAnswers: session.answers || {},                     // object - FRQ typed answers
  frqMaxPoints: 0,                  // number
  frqScore: null,                   // number | null - set after grading
  annotatedPdfUrl: null,            // string | null - teacher's annotated PDF
  frqGrades: null,                  // object | null - { [questionId]: { subScores, maxPoints, comment } }
  gradingStatus,                    // GRADING_STATUS enum value
  startedAt: session.startedAt,
  completedAt: serverTimestamp(),
  gradedAt: null,
}
```

**Key Observations:**
- `mcqResults` array contains: `{ questionId, studentAnswer, correctAnswer, correct }` - does **NOT** include `questionDomain` or `questionTopic`
- `classId` is stored (line 130)
- `annotatedPdfUrl` is the field name used (NOT `frqGradedPdfUrl`)

### ap_classes (Collection: `COLLECTIONS.CLASSES` = `'ap_classes'`)

**Evidence:** `src/apBoost/utils/apTypes.js:96`, `src/apBoost/services/apTeacherService.js:160-178`, `src/apBoost/services/apGradingService.js:271-285`

Fields observed in usage:
- `teacherId` - string (line 164 apTeacherService, line 274 apGradingService)
- `name` - string (line 166 apTeacherService sorts by `name`)
- `studentIds` - array of user IDs (line 195 apTeacherService)

### users/{userId}

**Evidence:** `src/apBoost/services/apGradingService.js:64-69`, `src/apBoost/services/apTeacherService.js:203-216`

Fields read for display:
- `displayName` - string (line 68 apGradingService, line 210 apTeacherService)
- `email` - string (line 68 apGradingService, line 210 apTeacherService)

**Note:** The code reads from `'users'` collection directly (NOT `ap_users`).

### ap_questions (Collection: `COLLECTIONS.QUESTIONS` = `'ap_questions'`)

**Evidence:** `src/apBoost/services/apQuestionService.js:155-196`

Question document shape from `createQuestion()`:
```javascript
const newQuestion = {
  questionText: ...,
  questionType: ...,           // MCQ, MCQ_MULTI, FRQ, SAQ, DBQ
  format: ...,                 // VERTICAL, HORIZONTAL
  subject: ...,
  questionDomain: ...,         // ✅ CONFIRMED - line 164
  questionTopic: ...,          // ✅ CONFIRMED - line 165
  difficulty: ...,
  choiceA, choiceB, choiceC, choiceD, choiceE,
  choiceCount,
  correctAnswers: [],
  subQuestions: ...,           // FRQ sub-questions array
  stimulusId, stimulus,
  explanation,
  partialCredit,
  createdBy,
  createdAt, updatedAt,
}
```

**Evidence for field names:** `src/apBoost/services/apQuestionService.js:57` uses `where('questionDomain', '==', ...)` and line 88-89 searches `questionDomain`/`questionTopic`.

---

## 2) Write Paths

**Found: Yes**

### Where `mcqResults` is created/populated

**Evidence:** `src/apBoost/services/apScoringService.js:86-112`

```javascript
// Build MCQ results for report card (lines 97-112)
for (const questionId of section.questionIds || []) {
  const question = test.questions[questionId]
  if (!question) continue

  const studentAnswer = answers[questionId] || null
  const correctAnswers = question.correctAnswers || []
  const isCorrect = correctAnswers.includes(studentAnswer)

  mcqResults.push({
    questionId,
    studentAnswer,
    correctAnswer: correctAnswers[0] || 'N/A',
    correct: isCorrect,
  })
}
```

**Current stored shape:** `{ questionId, studentAnswer, correctAnswer, correct }` - NO domain/topic fields.

### Where `frqGrades` is created/updated

**Evidence:** `src/apBoost/services/apGradingService.js:165-211`

Function: `saveGrade(resultId, grades, status, teacherId, annotatedPdfUrl = null)`

Updates written:
```javascript
const updateData = {
  frqGrades: grades,          // { [questionId]: { subScores, maxPoints, comment } }
  gradingStatus: status,
  gradedBy: teacherId,
  gradedAt: serverTimestamp(),
}
if (annotatedPdfUrl) {
  updateData.annotatedPdfUrl = annotatedPdfUrl
}
```

### Where `annotatedPdfUrl` is set

**Write Paths:**
1. **Initial creation:** `src/apBoost/services/apScoringService.js:148` - set to `null`
2. **Grading update:** `src/apBoost/services/apGradingService.js:177-179` - set from parameter
3. **GradingPanel UI:** `src/apBoost/components/grading/GradingPanel.jsx:305` - passes to `saveGrade()`

**Read Paths:**
- `src/apBoost/pages/APReportCard.jsx:355` - `const annotatedPdfUrl = result?.annotatedPdfUrl`
- `src/apBoost/components/grading/GradingPanel.jsx:267` - `setAnnotatedPdfUrl(data.annotatedPdfUrl || null)`

### Service functions for fetching

| Function | File:Line | Description |
|----------|-----------|-------------|
| `getTestResult(resultId)` | `apScoringService.js:173-184` | Gets result by ID from `COLLECTIONS.TEST_RESULTS` |
| `getTestMeta(testId)` | `apTestService.js:131-142` | Gets test metadata from `COLLECTIONS.TESTS` |
| `getQuestion(questionId)` | `apTestService.js:176-187` | Gets question by ID |
| `getQuestionById(questionId)` | `apQuestionService.js:105-122` | Alternate question getter |
| `getTeacherClasses(teacherId)` | `apGradingService.js:271-285` | Gets classes by teacherId |
| `getTeacherClasses(teacherId)` | `apTeacherService.js:160-178` | Duplicate function in teacher service |
| `getClassById(classId)` | **NOT FOUND** | No such function exists in codebase |

---

## 3) Offline/Resilience Mechanics

**Found: Yes - but NOT applicable to Report Card data loads**

**Evidence:** `src/apBoost/hooks/useOfflineQueue.js` (entire file, 287 lines)

The `useOfflineQueue` hook:
- Uses IndexedDB for queueing (`DB_NAME = 'ap_boost_queue'`)
- Handles `ANSWER_CHANGE`, `FLAG_TOGGLE`, `NAVIGATION`, `TIMER_SYNC` actions
- Writes only to `COLLECTIONS.SESSION_STATE` (line 232)
- Implements exponential backoff retry (lines 258-261)

**Key Finding:** This offline queue is ONLY for test session state syncing. It does NOT apply to:
- Report card data loading (`getTestResult`, `getTestMeta`)
- Gradebook data loading (`getPendingGrades`)
- Class/User data loading

The report card page (`APReportCard.jsx`) and gradebook (`APGradebook.jsx`) have NO offline/retry handling for their data fetches - they fail silently or show error UI.

---

## 4) UI/Flow Entry Points

**Found: Yes**

### Student route to report card

**Evidence:** `src/apBoost/routes.jsx:41-48`

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

Route path: `/ap/results/:resultId`
Component: `APReportCard`

### Teacher Gradebook "View" action

**Evidence:** `src/apBoost/pages/APGradebook.jsx:187-191`

```javascript
// Handle view action (same as grade for now)
const handleView = (resultId) => {
  setSelectedResultId(resultId)
  setIsPanelOpen(true)
}
```

**Current behavior:** Opens `GradingPanel` side panel (NOT navigation to `/ap/results/:id`)

Button label: "View" (line 94)
Handler: `onView={handleView}` passed to `GradebookRow` (line 313)

### APReportCard.jsx UI Elements

**Actions section (lines 497-505):**
```jsx
{/* Actions */}
<div className="flex justify-center gap-4">
  <Link
    to="/ap"
    className="bg-surface text-text-primary px-6 py-2 ..."
  >
    Back to Dashboard
  </Link>
</div>
```

**No "Download Report PDF" button exists.** Only a "Back to Dashboard" link.

**Graded paper download (lines 245-253):**
```jsx
<a
  href={annotatedPdfUrl}
  target="_blank"
  rel="noopener noreferrer"
  className="..."
  download
>
  Download PDF
</a>
```
Label: **"Download PDF"** (generic, not "Download Graded Paper")

**MCQ table headers (lines 77-83):**
```jsx
<th>Q#</th>
<th>Correct</th>
<th>Your Answer</th>
<th>Result</th>
```

**NO Domain/Topic columns rendered today.**

**FRQ graded results UI (lines 163-199):**
- Renders `FRQGradedResults` component
- Shows question number, sub-scores, teacher comment
- **Does NOT display question domain/topic**
- **Does NOT fetch FRQ question docs for metadata**

**Header block student display (line 380):**
```jsx
<p>Student: {user?.displayName || user?.email || 'Student'}</p>
```

**Uses authenticated user (`useAuth()`), NOT `result.userId` student.**

---

## 5) Must-Answer Questions

### A. PDF download integration

**1. Is `downloadReportPdf` imported anywhere in the app today?**

**Answer: NOT FOUND**

Searched: `import.*generateReportPdf|import.*downloadReportPdf` in `src/`
Result: Only found in markdown audit/fix plan files, NOT in any `.jsx` or `.js` source files.

**Evidence:** Grep returned only `.md` files:
- `src/apBoost/criteria_audit/fix_plans/section_12.1_to_13.2_fix_plan.md`
- `src/apBoost/criteria_audit/fix_plans/section_9.1_to_9.4_fix_plan.md`
- `src/apBoost/criteria_audit/section_9.1_to_9.4_criteria_audit.md`

---

**2. Does `APReportCard.jsx` currently render any button/link that triggers report PDF generation?**

**Answer: No**

**Evidence:** `src/apBoost/pages/APReportCard.jsx:497-505`
The Actions section only contains a "Back to Dashboard" link. No PDF generation trigger exists.

The `generateReportPdf.js` file exists (`src/apBoost/utils/generateReportPdf.js`) but is NEVER imported or called.

---

**3. What student object shape does `downloadReportPdf`/`generateReportPdf` expect?**

**Answer:** `{ name, email }` (optional)

**Evidence:** `src/apBoost/utils/generateReportPdf.js:11-12`

```javascript
/**
 * @param {Object} student - Student info { name, email }
 */
export async function generateReportPdf(result, test, student) { ... }
```

Usage in function (line 54):
```javascript
addText(student?.name || 'Student', margin + 40, yPos)
```

Filename generation (line 246):
```javascript
const filename = `AP_Report_${student?.name?.replace(/\s+/g, '_') || 'Student'}_${...}.pdf`
```

---

### B. Class name + student identity

**4. Does the codebase already have a `getClassById` service?**

**Answer: NOT FOUND**

Searched: `getClassById` in `src/apBoost/`
Result: Only found in `src/apBoost/criteria_audit/fix_plans/section_9.1_to_9.4_fix_plan.md` (markdown)

No actual `getClassById` function exists in any service file. Related functions exist:
- `getTeacherClasses(teacherId)` - returns array of classes for a teacher (apTeacherService.js:160)
- `getClassStudents(classId)` - returns students in a class (apTeacherService.js:185)

---

**5. In report card header, does it use authenticated user or result.userId student?**

**Answer: Uses authenticated user (incorrect for teacher view)**

**Evidence:** `src/apBoost/pages/APReportCard.jsx:264, 380`

```javascript
const { user } = useAuth()  // line 264
...
<p>Student: {user?.displayName || user?.email || 'Student'}</p>  // line 380
```

The `result` object DOES contain `userId` (from `createTestResult` at apScoringService.js:128), but it is NOT used for student name display.

---

**6. Does the repo include Firestore rules for `users/{userId}` or `ap_classes/{classId}`?**

**Answer: Partial - rules exist for `users` but NOT for `ap_*` collections**

**Evidence:** `firestore.rules:27-39`

```
// USERS
match /users/{userId} {
  allow read: if isAuthenticated();
  ...
}
```

**Critical Finding:** NO rules exist for `ap_*` collections (`ap_tests`, `ap_test_results`, `ap_questions`, `ap_classes`, `ap_assignments`, `ap_session_state`, `ap_stimuli`). These collections are **unprotected** by Firestore rules.

---

### C. MCQ/FRQ domain/topic metadata

**7. Are `questionDomain` and `questionTopic` present on question docs?**

**Answer: Yes - field names CONFIRMED as `questionDomain` and `questionTopic`**

**Evidence:** `src/apBoost/services/apQuestionService.js:164-165`

```javascript
questionDomain: questionData.questionDomain || '',
questionTopic: questionData.questionTopic || '',
```

Also confirmed in search/filter (lines 57, 88-89):
```javascript
constraints.push(where('questionDomain', '==', filters.domain))
...
q.questionDomain?.toLowerCase().includes(searchLower) ||
q.questionTopic?.toLowerCase().includes(searchLower)
```

---

**8. Is `mcqResults` persisted with domain/topic today?**

**Answer: No**

**Evidence:** `src/apBoost/services/apScoringService.js:106-111`

Current stored shape:
```javascript
mcqResults.push({
  questionId,
  studentAnswer,
  correctAnswer: correctAnswers[0] || 'N/A',
  correct: isCorrect,
})
```

No `questionDomain` or `questionTopic` fields are included.

---

**9. For FRQ report display: does `APReportCard.jsx` fetch FRQ question docs for metadata today?**

**Answer: No**

**Evidence:** `src/apBoost/pages/APReportCard.jsx:271-297`

The `loadResult()` function fetches:
1. `getTestResult(resultId)` - line 277
2. `getTestMeta(resultData.testId)` - line 284

It does NOT fetch individual FRQ question documents. The `FRQGradedResults` component (lines 156-200) renders from `result.frqGrades` without question metadata.

---

### D. FRQ weighting & multipliers

**10. Is there an implemented `frqMultiplier` on test sections?**

**Answer: No - only `mcqMultiplier` exists**

**Evidence:** `src/apBoost/services/apScoringService.js:41`

```javascript
// Apply multiplier if present
const multiplier = section.mcqMultiplier || 1
const points = correct * multiplier
```

Searched: `frqMultiplier` in `src/` - found only in markdown audit/criteria files, NOT in actual source code.

**Note:** FRQ weighting is not implemented. FRQ scores are calculated by summing `subScores` (apGradingService.js:218-231).

---

### E. Field-name consistency for graded PDF

**11. Is the graded PDF URL field consistently named `annotatedPdfUrl`?**

**Answer: Yes - consistently `annotatedPdfUrl`**

**Evidence:**
- Creation: `apScoringService.js:148` - `annotatedPdfUrl: null`
- Update: `apGradingService.js:178` - `updateData.annotatedPdfUrl = annotatedPdfUrl`
- Read (Report): `APReportCard.jsx:355` - `const annotatedPdfUrl = result?.annotatedPdfUrl`
- Read (Grading): `GradingPanel.jsx:267` - `setAnnotatedPdfUrl(data.annotatedPdfUrl || null)`

`frqGradedPdfUrl` does NOT appear in any source code - only in markdown documentation/audit files.

---

### F. Teacher "View Report" behavior

**12. In `APGradebook.jsx`, what does the "View" action do today?**

**Answer: Opens `GradingPanel` side panel (does NOT navigate)**

**Evidence:** `src/apBoost/pages/APGradebook.jsx:187-191, 331-344`

Handler:
```javascript
const handleView = (resultId) => {
  setSelectedResultId(resultId)
  setIsPanelOpen(true)
}
```

Rendered panel:
```jsx
{isPanelOpen && selectedResultId && (
  <>
    <div className="fixed inset-0 bg-black/50 z-40" onClick={handleClosePanel} />
    <GradingPanel
      resultId={selectedResultId}
      onClose={handleClosePanel}
      onSave={handleSave}
      teacherId={user?.uid}
    />
  </>
)}
```

Button label: "View" (line 94 in `GradebookRow`)

---

## Additional Findings

### Missing Firestore Security Rules for AP Collections

**Evidence:** `firestore.rules` (entire file)

The rules file defines rules for: `users`, `classes`, `lists`, `attempts`, `system_logs`

**No rules exist for:**
- `ap_tests`
- `ap_test_results`
- `ap_questions`
- `ap_classes`
- `ap_assignments`
- `ap_session_state`
- `ap_stimuli`

This means AP collections are either open (default deny in production) or rely on implicit rules not shown.

### Duplicate `getTeacherClasses` Functions

Two implementations exist:
1. `src/apBoost/services/apGradingService.js:271-285`
2. `src/apBoost/services/apTeacherService.js:160-178`

Both query the same collection with the same logic. This is a potential maintenance issue.
