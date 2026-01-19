# Fix Plan: Sections 9.1 to 9.4 (Report Card)

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_9.1_to_9.4_criteria_audit.md

## Executive Summary
- Total Issues: 13
- ⚠️ Partial Implementations: 8
- ❌ Missing Features: 5
- ❓ Needs Investigation: 0
- Estimated Complexity: Medium

---

## Issue 1: Download Report PDF Button Missing

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** [Download Report PDF] button in Report Card UI
- **Current State:** The `generateReportPdf.js` utility is fully implemented with jsPDF but there is NO button in APReportCard.jsx to trigger the download.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/generateReportPdf.js` (lines 1-262) - Complete PDF generation utility
  - `src/apBoost/pages/APReportCard.jsx` (lines 497-505) - Actions section where button should go
- **Current Implementation:** The `downloadReportPdf(result, test, student)` function exists and is exported, but never imported or called in APReportCard.
- **Gap:** No import statement, no button UI, no click handler to trigger PDF download.
- **Dependencies:** None - utility is already complete.

### Fix Plan

#### Step 1: Add import for PDF utility
**File:** `src/apBoost/pages/APReportCard.jsx`
**Action:** Modify
**Details:**
- Add import at top of file (around line 7): `import { downloadReportPdf } from '../utils/generateReportPdf'`

#### Step 2: Add download button to Actions section
**File:** `src/apBoost/pages/APReportCard.jsx`
**Action:** Modify (lines 497-505)
**Details:**
- Add a "Download Report PDF" button next to the "Back to Dashboard" link
- Button should call `downloadReportPdf(result, test, { name: user?.displayName || user?.email })`
- Style to match existing design tokens: `bg-brand-primary text-white px-6 py-2 rounded-[--radius-button]`

```jsx
{/* Actions */}
<div className="flex justify-center gap-4">
  <button
    onClick={() => downloadReportPdf(result, test, { name: user?.displayName || user?.email })}
    className="bg-brand-primary text-white px-6 py-2 rounded-[--radius-button] font-medium hover:opacity-90 transition-colors"
  >
    Download Report PDF
  </button>
  <Link
    to="/ap"
    className="bg-surface text-text-primary px-6 py-2 rounded-[--radius-button] border border-border-default hover:bg-hover transition-colors"
  >
    Back to Dashboard
  </Link>
</div>
```

### Verification Steps
1. Load any completed test result at /ap/results/:resultId
2. Click "Download Report PDF" button
3. Verify PDF downloads with proper filename format: `AP_Report_[StudentName]_[Date].pdf`
4. Open PDF and verify all sections render correctly

### Potential Risks
- None - utility already fully tested and used elsewhere

---

## Issue 2: Class Name Not Displayed in Header

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Class name displayed in header section
- **Current State:** result.classId exists but is never used to fetch or display class name.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APReportCard.jsx` (lines 378-386) - Header section where class should be shown
  - `src/apBoost/services/apTeacherService.js` (lines 160-178) - Has getTeacherClasses but no getClassById
  - `src/apBoost/utils/apTypes.js` (line 96) - COLLECTIONS.CLASSES = 'ap_classes'
- **Current Implementation:** Header shows Student, Test, Subject, Date but NOT class name.
- **Gap:**
  1. No function to fetch a single class by ID
  2. No state to hold class name in APReportCard
  3. No display of class name in header
- **Dependencies:** New service function needed first.

### Fix Plan

#### Step 1: Add getClassById function to service
**File:** `src/apBoost/services/apTeacherService.js`
**Action:** Add new function (after getTeacherClasses around line 178)
**Details:**
- Follow existing pattern from getTestById (lines 136-153)

```javascript
/**
 * Get a single class by ID
 * @param {string} classId - Class document ID
 * @returns {Promise<Object|null>} Class object or null
 */
export async function getClassById(classId) {
  try {
    const classRef = doc(db, COLLECTIONS.CLASSES, classId)
    const classSnap = await getDoc(classRef)

    if (!classSnap.exists()) {
      return null
    }

    return {
      id: classSnap.id,
      ...classSnap.data()
    }
  } catch (error) {
    logError('apTeacherService.getClassById', { classId }, error)
    throw error
  }
}
```

#### Step 2: Import and use getClassById in APReportCard
**File:** `src/apBoost/pages/APReportCard.jsx`
**Action:** Modify
**Details:**
- Add import: `import { getClassById } from '../services/apTeacherService'`
- Add state: `const [className, setClassName] = useState(null)`
- In useEffect after loading result, fetch class if classId exists:

```javascript
// In useEffect loadResult function, after setResult(resultData):
if (resultData.classId) {
  try {
    const classData = await getClassById(resultData.classId)
    setClassName(classData?.name || null)
  } catch {
    // Ignore class fetch errors - not critical
  }
}
```

#### Step 3: Display class name in header
**File:** `src/apBoost/pages/APReportCard.jsx`
**Action:** Modify (lines 378-386)
**Details:**
- Add class name row after Student row, conditionally render if className exists:

```jsx
<div>
  <p>Student: {user?.displayName || user?.email || 'Student'}</p>
  {className && <p>Class: {className}</p>}
  <p>Test: {test?.title || 'AP Practice Exam'}</p>
</div>
```

### Verification Steps
1. Create a test result with a valid classId
2. Load the report card at /ap/results/:resultId
3. Verify class name appears in header (if classId was set)
4. Verify no errors for results without classId

### Potential Risks
- Results without classId: Handle gracefully with conditional render
- Non-existent classId: getClassById returns null, no crash

---

## Issue 3: MCQ Table Missing Domain and Topic Columns

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** MCQ table columns: Q#, Answer, Response, Domain, Topic, Result
- **Current State:** Only shows Q#, Correct, Your Answer, Result. Domain and Topic are missing.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APReportCard.jsx` (lines 73-109) - MCQResultsTable component
  - `src/apBoost/services/apScoringService.js` (lines 97-112) - Creates mcqResults array
  - `src/apBoost/services/apQuestionService.js` (lines 164-165) - Questions have questionDomain, questionTopic fields
- **Current Implementation:** mcqResults only includes: questionId, studentAnswer, correctAnswer, correct
- **Gap:**
  1. mcqResults needs questionDomain and questionTopic fields
  2. MCQResultsTable needs to render Domain and Topic columns
- **Dependencies:** Must modify scoring service first to include metadata.

### Fix Plan

#### Step 1: Expand mcqResults to include domain/topic in scoring service
**File:** `src/apBoost/services/apScoringService.js`
**Action:** Modify (lines 106-111)
**Details:**
- Add questionDomain and questionTopic to each result object:

```javascript
mcqResults.push({
  questionId,
  studentAnswer,
  correctAnswer: correctAnswers[0] || 'N/A',
  correct: isCorrect,
  questionDomain: question.questionDomain || '',
  questionTopic: question.questionTopic || '',
})
```

#### Step 2: Update MCQResultsTable to display Domain and Topic
**File:** `src/apBoost/pages/APReportCard.jsx`
**Action:** Modify (lines 73-109)
**Details:**
- Add Domain and Topic column headers (after Your Answer, before Result):

```jsx
<thead>
  <tr className="border-b border-border-default">
    <th className="text-left py-2 px-3 text-text-secondary font-medium">Q#</th>
    <th className="text-left py-2 px-3 text-text-secondary font-medium">Correct</th>
    <th className="text-left py-2 px-3 text-text-secondary font-medium">Your Answer</th>
    <th className="text-left py-2 px-3 text-text-secondary font-medium">Domain</th>
    <th className="text-left py-2 px-3 text-text-secondary font-medium">Topic</th>
    <th className="text-left py-2 px-3 text-text-secondary font-medium">Result</th>
  </tr>
</thead>
```

- Add cells for Domain and Topic in each row:

```jsx
<td className="py-2 px-3 text-text-secondary text-sm">{result.questionDomain || '—'}</td>
<td className="py-2 px-3 text-text-secondary text-sm">{result.questionTopic || '—'}</td>
```

### Verification Steps
1. Complete a test and submit
2. View the report card
3. Verify MCQ table shows Domain and Topic columns
4. Verify data populates from question metadata

### Potential Risks
- **Existing results:** Old results won't have domain/topic in mcqResults. Table will show '—' which is acceptable.
- **Re-migration:** Could write a migration script to backfill existing results, but not critical.

---

## Issue 4: FRQ Results Missing Domain and Topic

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** FRQ column headers: Q#, Sub, Pts Max, Earned, Domain, Topic, Comment
- **Current State:** Card-based layout shows scores and comments but NO domain/topic.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APReportCard.jsx` (lines 156-200) - FRQGradedResults component
  - `src/apBoost/services/apGradingService.js` (lines 136-145) - Fetches frqQuestions but doesn't add to result
- **Current Implementation:** FRQ grades are stored in result.frqGrades but questions aren't loaded in report card.
- **Gap:** Need to fetch question metadata (domain/topic) for FRQ display.
- **Dependencies:** Could fetch questions on report card load OR enhance frqGrades to include metadata.

### Fix Plan

#### Step 1: Fetch FRQ questions in APReportCard for display
**File:** `src/apBoost/pages/APReportCard.jsx`
**Action:** Modify
**Details:**
- Add import: `import { getQuestion } from '../services/apTestService'`
- Add state: `const [frqQuestions, setFrqQuestions] = useState({})`
- In useEffect, after loading result, fetch FRQ questions:

```javascript
// After loading result and test:
if (resultData.frqGrades) {
  const questionsData = {}
  for (const questionId of Object.keys(resultData.frqGrades)) {
    try {
      const q = await getQuestion(questionId)
      if (q) questionsData[questionId] = q
    } catch {
      // Ignore individual question fetch errors
    }
  }
  setFrqQuestions(questionsData)
}
```

#### Step 2: Update FRQGradedResults to accept and display question metadata
**File:** `src/apBoost/pages/APReportCard.jsx`
**Action:** Modify FRQGradedResults component (lines 156-200)
**Details:**
- Add `questions` prop to FRQGradedResults
- Display domain/topic for each question:

```jsx
function FRQGradedResults({ frqGrades, questions = {} }) {
  // ... existing code ...
  {Object.entries(frqGrades).map(([questionId, grade], qIdx) => {
    const question = questions[questionId] || {}
    return (
      <div key={questionId} className="...">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-text-primary font-medium">Question {qIdx + 1}</h4>
            {question.questionDomain && (
              <p className="text-text-secondary text-sm">
                {question.questionDomain}
                {question.questionTopic && ` - ${question.questionTopic}`}
              </p>
            )}
          </div>
          {/* existing score display */}
        </div>
        {/* rest of component */}
      </div>
    )
  })}
}
```

#### Step 3: Pass frqQuestions to FRQGradedResults
**File:** `src/apBoost/pages/APReportCard.jsx`
**Action:** Modify (around line 465)
**Details:**

```jsx
<FRQGradedResults frqGrades={frqGrades} questions={frqQuestions} />
```

### Verification Steps
1. Complete a test with FRQ section and get it graded
2. View report card
3. Verify domain/topic appears under each FRQ question header

### Potential Risks
- Extra API calls: Fetching questions adds latency. Consider caching or batch fetch.
- Missing questions: Handle gracefully with empty object fallback.

---

## Issue 5: FRQ Summary Only Shows Raw Points

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** FRQ Summary: X/Y raw pts -> X/Y weighted (percentage)
- **Current State:** Only shows raw points (frqEarnedPoints/frqMaxPoints), no weighted display.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APReportCard.jsx` (lines 489-492) - FRQ points display
  - `src/apBoost/services/apScoringService.js` (lines 40-45) - Section has mcqMultiplier
- **Current Implementation:** Shows `Points: X/Y` for raw FRQ score
- **Gap:** If weighted multipliers exist, should show both raw and weighted. Need to check test sections for FRQ multiplier.
- **Dependencies:** Need test.sections data available in report card.

### Fix Plan

#### Step 1: Check for FRQ section weighting and display accordingly
**File:** `src/apBoost/pages/APReportCard.jsx`
**Action:** Modify (lines 489-492)
**Details:**
- Calculate if FRQ has a multiplier from test.sections
- Show weighted points if different from raw:

```jsx
{/* FRQ Points */}
{(() => {
  // Find FRQ section multiplier
  const frqSection = test?.sections?.find(s => s.sectionType === 'FRQ' || s.sectionType === 'MIXED')
  const multiplier = frqSection?.frqMultiplier || 1
  const weighted = frqEarnedPoints * multiplier
  const maxWeighted = frqMaxPoints * multiplier
  const showWeighted = multiplier !== 1

  return (
    <div className="mt-4 pt-4 border-t border-border-default">
      <p className="text-text-secondary text-sm">
        Points: {isGradingComplete ? (
          <>
            {frqEarnedPoints}/{frqMaxPoints}
            {showWeighted && (
              <span className="text-text-muted"> → {weighted}/{maxWeighted} weighted</span>
            )}
            <span className="text-text-muted ml-2">
              ({frqMaxPoints > 0 ? Math.round((frqEarnedPoints / frqMaxPoints) * 100) : 0}%)
            </span>
          </>
        ) : `--/${frqMaxPoints} (pending)`}
      </p>
    </div>
  )
})()}
```

### Verification Steps
1. Create test with FRQ section that has a multiplier (frqMultiplier: 1.5)
2. Complete test, get it graded
3. Verify weighted points shown in FRQ summary

### Potential Risks
- Most tests may not have multipliers - default behavior unchanged
- Test not loaded: Handle with optional chaining

---

## Issue 6: Download Graded Paper Button Label Mismatch

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** [Download Graded Paper (PDF)] button label
- **Current State:** Button says "Download PDF" instead of matching spec.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APReportCard.jsx` (lines 246-256) - HandwrittenFilesSection download button
- **Current Implementation:** Button text is "Download PDF"
- **Gap:** Should say "Download Graded Paper (PDF)" per acceptance criteria

### Fix Plan

#### Step 1: Update button label
**File:** `src/apBoost/pages/APReportCard.jsx`
**Action:** Modify (line 252)
**Details:**
- Change button text from "Download PDF" to "Download Graded Paper (PDF)":

```jsx
<a
  href={annotatedPdfUrl}
  target="_blank"
  rel="noopener noreferrer"
  className="bg-surface text-brand-primary px-4 py-2 rounded-[--radius-button] border border-border-default hover:bg-hover text-sm font-medium"
  download
>
  Download Graded Paper (PDF)
</a>
```

### Verification Steps
1. Complete handwritten FRQ submission
2. Get it graded with annotated PDF uploaded
3. View report card
4. Verify button label reads "Download Graded Paper (PDF)"

### Potential Risks
- None - cosmetic change only

---

## Issue 7: Teacher View Side-Panel Not Showing Report Card

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Teacher view: Side-panel from Gradebook (editable)
- **Current State:** GradingPanel only shows grading workflow, not a read-only/editable report card view.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APGradebook.jsx` (lines 182-191) - Both Grade and View open same panel
  - `src/apBoost/components/grading/GradingPanel.jsx` - Focused on FRQ grading only
- **Current Implementation:** "View" button opens the grading panel which is designed for editing grades, not viewing completed reports.
- **Gap:** Need either a separate read-only view or navigation to full report card.
- **Dependencies:** Design decision needed: read-only panel vs. linking to full page

### Fix Plan

#### Option A: Link to Full Report Card Page (Recommended)
This is simpler and provides a consistent experience.

#### Step 1: Update View button to navigate to report card
**File:** `src/apBoost/pages/APGradebook.jsx`
**Action:** Modify
**Details:**
- Add useNavigate hook and update handleView:

```jsx
import { useNavigate } from 'react-router-dom'

// In component:
const navigate = useNavigate()

// Update handleView:
const handleView = (resultId) => {
  navigate(`/ap/results/${resultId}`)
}
```

#### Step 2: Update GradebookRow View button styling to indicate navigation
**File:** `src/apBoost/pages/APGradebook.jsx`
**Action:** Modify (lines 90-95)
**Details:**
- Add visual indicator that this navigates away:

```jsx
<button
  onClick={() => onView(result.id)}
  className="px-4 py-1 rounded-[--radius-button] border border-border-default text-text-secondary text-sm hover:bg-hover inline-flex items-center gap-1"
>
  View Report
  <span className="text-xs">→</span>
</button>
```

### Verification Steps
1. Go to Gradebook as teacher
2. Find a completed/graded result
3. Click "View Report" button
4. Verify navigation to /ap/results/:resultId page

### Potential Risks
- Teacher may want inline view: Could add panel option later
- Authorization: Report card page should work for teachers viewing student results (requires Issue 8 fix)

---

## Issue 8: Student Name Source for Teacher View

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Student name from users/{userId}
- **Current State:** Uses AuthContext user object which is the currently logged-in user, not the student whose report this is.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APReportCard.jsx` (line 264) - `const { user } = useAuth()`
  - `src/apBoost/pages/APReportCard.jsx` (line 380) - Uses `user?.displayName`
- **Current Implementation:** Shows currently authenticated user's name, which is wrong when a teacher views a student's report.
- **Gap:** Should fetch student name from result.userId, not current user.
- **Dependencies:** None - standard pattern exists in grading service.

### Fix Plan

#### Step 1: Fetch student info from result.userId
**File:** `src/apBoost/pages/APReportCard.jsx`
**Action:** Modify
**Details:**
- Add state: `const [studentInfo, setStudentInfo] = useState(null)`
- Add import: `import { doc, getDoc } from 'firebase/firestore'` and `import { db } from '../../firebase'`
- In useEffect after loading result:

```javascript
// Fetch student info from result.userId (not current user)
if (resultData.userId) {
  try {
    const userDoc = await getDoc(doc(db, 'users', resultData.userId))
    if (userDoc.exists()) {
      const userData = userDoc.data()
      setStudentInfo({
        name: userData.displayName || userData.email || 'Student',
        email: userData.email
      })
    }
  } catch {
    // Fallback to current user if fetch fails
    setStudentInfo({
      name: user?.displayName || user?.email || 'Student',
      email: user?.email
    })
  }
} else {
  // No userId, fallback to current user
  setStudentInfo({
    name: user?.displayName || user?.email || 'Student',
    email: user?.email
  })
}
```

#### Step 2: Update display to use studentInfo
**File:** `src/apBoost/pages/APReportCard.jsx`
**Action:** Modify (line 380)
**Details:**

```jsx
<p>Student: {studentInfo?.name || user?.displayName || user?.email || 'Student'}</p>
```

### Verification Steps
1. As teacher, navigate to a student's report card
2. Verify student's name shows (not teacher's name)
3. As student, verify own name shows correctly

### Potential Risks
- Firebase rules: Ensure teachers can read users collection or result includes studentName
- Fallback: Gracefully falls back to current user if fetch fails

---

## Issue 9: Field Name Inconsistency (annotatedPdfUrl vs frqGradedPdfUrl)

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Graded PDF from ap_test_results.frqGradedPdfUrl
- **Current State:** Uses `annotatedPdfUrl` field instead of spec's `frqGradedPdfUrl`

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APReportCard.jsx` (line 355) - `const annotatedPdfUrl = result?.annotatedPdfUrl`
  - `src/apBoost/services/apScoringService.js` (line 148) - `annotatedPdfUrl: null`
  - `src/apBoost/services/apGradingService.js` (lines 176-178) - Saves as `annotatedPdfUrl`
  - `src/apBoost/components/grading/GradingPanel.jsx` (line 267) - Uses `annotatedPdfUrl`
- **Current Implementation:** Consistently uses `annotatedPdfUrl` across codebase
- **Gap:** Spec says `frqGradedPdfUrl` but code uses `annotatedPdfUrl`
- **Dependencies:** Would require migration of existing data if changed

### Fix Plan

#### Option A: Document the deviation (Recommended)
Since `annotatedPdfUrl` is consistently used throughout the codebase and changing would require data migration, recommend documenting this as an intentional deviation.

**Action:** Update acceptance criteria or documentation to note that `annotatedPdfUrl` is used instead of `frqGradedPdfUrl`.

#### Option B: Rename field (Not recommended unless required)
Would require:
1. Migration script to rename field in existing documents
2. Update all code references (5+ files)
3. Deploy atomically

### Verification Steps
1. Verify current functionality works with `annotatedPdfUrl`
2. Document the field name in data model documentation

### Potential Risks
- None if keeping current name
- Breaking existing data if renamed without migration

---

## Issue 10: PDF Utility Missing Class Name

### Audit Finding
- **Status:** ⚠️ Partial (related to Issue 2)
- **Criterion:** Header with student/test info in PDF
- **Current State:** PDF includes student, test, date but NOT class name

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/generateReportPdf.js` (lines 52-66) - Header section
- **Current Implementation:** Shows Student, Test, Date
- **Gap:** Missing class name line

### Fix Plan

#### Step 1: Update generateReportPdf to accept and display class name
**File:** `src/apBoost/utils/generateReportPdf.js`
**Action:** Modify
**Details:**
- Update function signature to accept class name:

```javascript
export async function generateReportPdf(result, test, student, className = null) {
```

- Add class line after student info (around line 55):

```javascript
// Student Info
addText('Student:', margin, yPos, { fontStyle: 'bold' })
addText(student?.name || 'Student', margin + 40, yPos)
yPos += 7

if (className) {
  addText('Class:', margin, yPos, { fontStyle: 'bold' })
  addText(className, margin + 40, yPos)
  yPos += 7
}

addText('Test:', margin, yPos, { fontStyle: 'bold' })
// ... rest unchanged
```

#### Step 2: Update downloadReportPdf similarly
**File:** `src/apBoost/utils/generateReportPdf.js`
**Action:** Modify
**Details:**

```javascript
export async function downloadReportPdf(result, test, student, className = null) {
  const doc = await generateReportPdf(result, test, student, className)
  // ... rest unchanged
}
```

#### Step 3: Pass className when calling from APReportCard
**File:** `src/apBoost/pages/APReportCard.jsx`
**Action:** Modify (in download button handler)
**Details:**

```jsx
onClick={() => downloadReportPdf(result, test, { name: studentInfo?.name || user?.displayName }, className)}
```

### Verification Steps
1. Download PDF from report card with a class assigned
2. Verify class name appears in PDF header
3. Verify PDF still works when no class assigned

### Potential Risks
- None - additional optional parameter with fallback

---

## Issue 11: MCQ Correct Answer Column Header Mismatch

### Audit Finding
- **Status:** ⚠️ Partial (minor)
- **Criterion:** Column header: "Answer" for correct answer
- **Current State:** Column says "Correct" instead of "Answer"

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APReportCard.jsx` (line 80) - Header says "Correct"
- **Current Implementation:** `<th>Correct</th>` for the correct answer column
- **Gap:** Spec says "Answer" (for correct answer), "Response" (for student answer)

### Fix Plan

#### Step 1: Update column headers to match spec
**File:** `src/apBoost/pages/APReportCard.jsx`
**Action:** Modify (lines 79-82)
**Details:**

```jsx
<tr className="border-b border-border-default">
  <th className="text-left py-2 px-3 text-text-secondary font-medium">Q#</th>
  <th className="text-left py-2 px-3 text-text-secondary font-medium">Answer</th>
  <th className="text-left py-2 px-3 text-text-secondary font-medium">Response</th>
  <th className="text-left py-2 px-3 text-text-secondary font-medium">Domain</th>
  <th className="text-left py-2 px-3 text-text-secondary font-medium">Topic</th>
  <th className="text-left py-2 px-3 text-text-secondary font-medium">Result</th>
</tr>
```

### Verification Steps
1. View report card with MCQ results
2. Verify column headers match: Q#, Answer, Response, Domain, Topic, Result

### Potential Risks
- None - cosmetic change

---

## Implementation Order

Recommended order to implement fixes (considering dependencies):

1. **Issue 3: MCQ Domain/Topic in Scoring Service** - Foundational data change; new results will have metadata
2. **Issue 2: Class Name Display** - Includes new service function needed by Issue 10
3. **Issue 8: Student Name from userId** - Needed for teacher view correctness
4. **Issue 1: Download PDF Button** - Can be done after class name is available
5. **Issue 10: PDF Class Name** - Depends on Issue 2 completion
6. **Issue 4: FRQ Domain/Topic Display** - Independent enhancement
7. **Issue 5: FRQ Weighted Display** - Independent enhancement
8. **Issue 6: Button Label Fix** - Quick cosmetic fix
9. **Issue 7: Teacher View Navigation** - Depends on Issue 8
10. **Issue 11: Column Header Labels** - Quick cosmetic fix
11. **Issue 9: Field Name Documentation** - Documentation only

---

## Cross-Cutting Concerns

### Pattern: Fetching related data
Multiple issues require fetching related documents (class, student, questions). Consider:
1. Creating a unified `getReportCardData(resultId)` function that fetches all needed data in one call
2. This would reduce code duplication and improve performance

### Pattern: Error handling
All fetch operations should fail gracefully with:
- Try/catch blocks
- Fallback values (null, '—', or current user)
- No visible errors to user for non-critical data

### Pattern: Backward compatibility
Changes to mcqResults structure (Issue 3) should handle:
- Old results without domain/topic: Show '—'
- No need for data migration; graceful degradation

---

## Notes for Implementer

1. **Test with real data:** Create test results with various configurations (with/without class, with/without FRQ, graded/pending) to verify all code paths.

2. **Firebase rules:** Ensure teachers have read access to:
   - ap_classes (to get class name)
   - users (to get student name)
   - ap_questions (to get domain/topic for FRQ)

3. **Performance:** The report card now makes additional API calls. Monitor load time and consider:
   - Parallel Promise.all for independent fetches
   - Caching frequently accessed data
   - Loading states for each section

4. **Component extraction:** Consider extracting inline components (APScoreBadge, SectionScoreBar, MCQResultsTable, FRQGradedResults) to `src/apBoost/components/report/` folder for better organization.

5. **Design tokens:** All new UI elements must use design tokens from `/src/index.css` - no raw Tailwind values.

6. **Change log:** Remember to log all changes to `change_action_log_ap.md` as per project instructions.
