# Fix Plan: Sections 10.1 to 10.9

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_10.1_to_10.9_criteria_audit.md

## Executive Summary
- Total Issues: 9
- ⚠️ Partial Implementations: 3
- ❌ Missing Features: 6
- ❓ Needs Investigation: 0
- Estimated Complexity: Low to Medium

The issues fall into three main categories:
1. **Missing PDF Download buttons** (2 issues) - PDF utility exists but not integrated
2. **Student Profile page** (6 issues) - Route and stub page completely missing
3. **UI refinements** (1 issue) - Icon vs text for Report Card link

---

## Issue 1: [Download PDF] Button Missing in MCQ Performance Grid

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** MCQ Performance Grid should have [Download PDF] button to export questions
- **Current State:** PDF generation utilities exist in `generateQuestionsPdf.js` but no button is integrated into the MCQ section of the analytics UI

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APExamAnalytics.jsx` (lines 303-348) - MCQ Section container
  - `src/apBoost/utils/generateQuestionsPdf.js` (lines 271-275) - `downloadQuestionsPdf()` function
  - `src/apBoost/components/analytics/PerformanceGrid.jsx` - MCQ grid component
- **Current Implementation:**
  - The MCQ section header (lines 305-330) contains the "Grid"/"Detailed" toggle buttons
  - `downloadQuestionsPdf(test, questions, options)` is available and exports a PDF with test questions
- **Gap:** No "Download PDF" button exists in the MCQ section header
- **Dependencies:**
  - Requires `test` and `questions` data already available in `APExamAnalytics`
  - `downloadQuestionsPdf` needs to be imported from utils

### Fix Plan

#### Step 1: Import the PDF utility in APExamAnalytics.jsx
**File:** `src/apBoost/pages/APExamAnalytics.jsx`
**Action:** Modify
**Details:**
- Add import at top of file: `import { downloadQuestionsPdf } from '../utils/generateQuestionsPdf'`
- Add this near existing imports around line 18

#### Step 2: Add handler function for MCQ PDF download
**File:** `src/apBoost/pages/APExamAnalytics.jsx`
**Action:** Modify
**Details:**
- Add a handler function after `handleQuestionClick` (around line 192):
```javascript
// Handle MCQ PDF download
const handleDownloadMcqPdf = async () => {
  if (!analytics?.test || !analytics?.questions) return
  try {
    // Filter to only MCQ questions from mcqPerformance keys
    const mcqQuestionIds = Object.keys(mcqPerformance || {})
    const mcqTest = {
      ...analytics.test,
      title: `${analytics.test.title} - MCQ Section`,
      sections: [{
        title: 'Multiple Choice',
        sectionType: 'MCQ',
        questionIds: mcqQuestionIds
      }]
    }
    await downloadQuestionsPdf(mcqTest, analytics.questions, { includeAnswers: true })
  } catch (err) {
    logError('APExamAnalytics.downloadMcqPdf', {}, err)
  }
}
```

#### Step 3: Add Download PDF button to MCQ section header
**File:** `src/apBoost/pages/APExamAnalytics.jsx`
**Action:** Modify
**Details:**
- In the MCQ section header (around line 309), add a Download PDF button next to the Grid/Detailed toggle:
```jsx
<div className="flex items-center gap-2">
  <button
    onClick={handleDownloadMcqPdf}
    className="px-3 py-1 text-sm rounded-[--radius-button] border border-border-default text-text-secondary hover:bg-hover"
    title="Download MCQ questions as PDF"
  >
    Download PDF
  </button>
  {/* Existing Grid/Detailed buttons */}
  <button onClick={() => setMcqView('grid')} ...>Grid</button>
  <button onClick={() => setMcqView('detailed')} ...>Detailed</button>
</div>
```

### Verification Steps
1. Navigate to `/ap/teacher/analytics/:testId`
2. In the MCQ Performance section, verify "Download PDF" button appears
3. Click the button and verify a PDF downloads with MCQ questions
4. Verify PDF contains question text, choices, and correct answers

### Potential Risks
- None significant - additive change only
- PDF generation is async; may want to add loading state for large tests

---

## Issue 2: [Download PDF] Button Missing in FRQ Performance Grid

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** FRQ Performance Grid should have [Download PDF] button
- **Current State:** PDF generation utilities exist but no button in FRQ section

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APExamAnalytics.jsx` (lines 350-367) - FRQ Section container
  - `src/apBoost/utils/generateQuestionsPdf.js` - PDF generation with FRQ support (lines 184-198)
- **Current Implementation:**
  - The FRQ section has a header "Section 2: Free Response Performance" (line 353)
  - No download button exists
- **Gap:** No "Download PDF" button in FRQ section
- **Dependencies:** Same as MCQ - test and questions data available

### Fix Plan

#### Step 1: Add handler function for FRQ PDF download
**File:** `src/apBoost/pages/APExamAnalytics.jsx`
**Action:** Modify
**Details:**
- Add after the MCQ PDF handler:
```javascript
// Handle FRQ PDF download
const handleDownloadFrqPdf = async () => {
  if (!analytics?.test || !analytics?.questions) return
  try {
    const frqQuestionIds = Object.keys(frqPerformance || {})
    const frqTest = {
      ...analytics.test,
      title: `${analytics.test.title} - FRQ Section`,
      sections: [{
        title: 'Free Response',
        sectionType: 'FRQ',
        questionIds: frqQuestionIds
      }]
    }
    await downloadQuestionsPdf(frqTest, analytics.questions, { includeAnswers: true })
  } catch (err) {
    logError('APExamAnalytics.downloadFrqPdf', {}, err)
  }
}
```

#### Step 2: Modify FRQ section header to include Download PDF button
**File:** `src/apBoost/pages/APExamAnalytics.jsx`
**Action:** Modify
**Details:**
- Change FRQ section header from simple `<h2>` to flex container with button (around line 353):
```jsx
<div className="flex items-center justify-between mb-4">
  <h2 className="text-lg font-semibold text-text-primary">
    Section 2: Free Response Performance
  </h2>
  <button
    onClick={handleDownloadFrqPdf}
    className="px-3 py-1 text-sm rounded-[--radius-button] border border-border-default text-text-secondary hover:bg-hover"
    title="Download FRQ questions as PDF"
  >
    Download PDF
  </button>
</div>
```

### Verification Steps
1. Navigate to analytics page with FRQ questions
2. Verify "Download PDF" button appears in FRQ section header
3. Click and verify PDF downloads with FRQ questions and sub-question prompts
4. Verify PDF includes point values for each sub-question

### Potential Risks
- None - additive change only

---

## Issue 3: FRQ Rubric Modal Not Implemented

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Click sub-question square → Could show rubric (future feature)
- **Current State:** `onSubClick` prop is passed to FRQCard but no rubric modal is rendered

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/analytics/FRQCard.jsx` (line 66) - `onClick={() => onSubClick?.(label)}`
  - `src/apBoost/pages/APExamAnalytics.jsx` (lines 357-364) - FRQCard rendering without onSubClick handler
- **Current Implementation:**
  - FRQCard accepts `onSubClick` prop but it's not passed from parent
  - SubQuestionSquare component is clickable but click does nothing
- **Gap:** No handler passed, no modal created for rubric display
- **Dependencies:**
  - Would need access to rubric data from question structure
  - May need to fetch additional data or use existing question data

### Fix Plan

#### Step 1: Create FRQRubricModal component
**File:** `src/apBoost/components/analytics/FRQRubricModal.jsx` (NEW FILE)
**Action:** Create
**Details:**
- Create a simple modal similar to `QuestionDetailModal.jsx` pattern:
```jsx
/**
 * FRQRubricModal - Shows rubric for FRQ sub-question
 * TODO: This is a placeholder for future rubric display feature
 */
export default function FRQRubricModal({
  question,
  questionNumber,
  subLabel,
  performance,
  onClose
}) {
  const subQuestion = question?.subQuestions?.find(sq => sq.label === subLabel)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-surface rounded-[--radius-card] shadow-theme-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-default">
          <h3 className="text-lg font-semibold text-text-primary">
            FRQ {questionNumber} - Part ({subLabel})
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {subQuestion ? (
            <>
              <div className="mb-4">
                <h4 className="text-sm font-medium text-text-secondary mb-1">Prompt</h4>
                <p className="text-text-primary">{subQuestion.prompt || 'No prompt available'}</p>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-text-secondary mb-1">Points</h4>
                <p className="text-text-primary">{subQuestion.points || 3} points</p>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-text-secondary mb-1">Average Score</h4>
                <p className="text-text-primary">{performance?.percentage || 0}%</p>
              </div>

              {/* TODO: Add rubric display when rubric data is available */}
              <div className="bg-info rounded-[--radius-card] p-4 mt-4">
                <p className="text-info-text text-sm">
                  Detailed rubric display coming soon. This will show scoring criteria and point breakdowns.
                </p>
              </div>
            </>
          ) : (
            <p className="text-text-muted">Sub-question data not available</p>
          )}
        </div>
      </div>
    </div>
  )
}
```

#### Step 2: Add state and handler in APExamAnalytics.jsx
**File:** `src/apBoost/pages/APExamAnalytics.jsx`
**Action:** Modify
**Details:**
- Add state for selected FRQ sub-question (near line 91):
```javascript
const [selectedFrqSub, setSelectedFrqSub] = useState(null) // { questionId, label }
```
- Add handler function:
```javascript
const handleFrqSubClick = (questionId, label) => {
  setSelectedFrqSub({ questionId, label })
}
```

#### Step 3: Pass handler to FRQCard components
**File:** `src/apBoost/pages/APExamAnalytics.jsx`
**Action:** Modify
**Details:**
- Update FRQCard rendering (around line 358):
```jsx
<FRQCard
  key={questionId}
  questionNumber={index + 1}
  question={questions[questionId]}
  performance={perf}
  onSubClick={(label) => handleFrqSubClick(questionId, label)}
/>
```

#### Step 4: Import and render modal
**File:** `src/apBoost/pages/APExamAnalytics.jsx`
**Action:** Modify
**Details:**
- Add import: `import FRQRubricModal from '../components/analytics/FRQRubricModal'`
- Add modal rendering after QuestionDetailModal (around line 391):
```jsx
{selectedFrqSub && (
  <FRQRubricModal
    question={questions[selectedFrqSub.questionId]}
    questionNumber={Object.keys(frqPerformance || {}).indexOf(selectedFrqSub.questionId) + 1}
    subLabel={selectedFrqSub.label}
    performance={frqPerformance[selectedFrqSub.questionId]?.subQuestions?.[selectedFrqSub.label]}
    onClose={() => setSelectedFrqSub(null)}
  />
)}
```

### Verification Steps
1. Navigate to analytics page with FRQ questions
2. Click on a sub-question square (a, b, c, etc.)
3. Verify modal opens with sub-question information
4. Verify modal shows prompt, points, and average score
5. Verify "coming soon" note for rubric is displayed
6. Verify clicking X or outside modal closes it

### Potential Risks
- Low risk - additive feature with graceful fallback
- Future work needed to add actual rubric data when available

---

## Issue 4: "View Report" Text Instead of Icon

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Student table should have Report Card icon column with clickable icon
- **Current State:** Uses "View Report" text link instead of icon per spec

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/analytics/StudentResultsTable.jsx` (lines 138-140, 182-189)
- **Current Implementation:**
  - Column header shows "Actions" (line 138-140)
  - Cell content shows "View Report" text link (lines 183-188)
- **Gap:** Should use icon instead of text, header could say "Report"
- **Dependencies:** None

### Fix Plan

#### Step 1: Update column header
**File:** `src/apBoost/components/analytics/StudentResultsTable.jsx`
**Action:** Modify
**Details:**
- Change header from "Actions" to simpler format (around line 138):
```jsx
<th className="text-center py-3 px-4 text-text-secondary font-medium w-16">
  Report
</th>
```

#### Step 2: Replace text link with icon button
**File:** `src/apBoost/components/analytics/StudentResultsTable.jsx`
**Action:** Modify
**Details:**
- Replace the "View Report" link (lines 182-189) with an icon:
```jsx
<td className="py-3 px-4 text-center">
  <Link
    to={`/ap/results/${result.id}`}
    className="inline-flex items-center justify-center w-8 h-8 rounded-[--radius-button] hover:bg-hover text-text-secondary hover:text-text-primary transition-colors"
    title="View Report Card"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  </Link>
</td>
```

Note: Using an SVG document icon rather than emoji for better cross-platform consistency. The icon represents a document/report card.

### Verification Steps
1. Navigate to analytics page
2. Scroll to student results table
3. Verify "Report" column header appears
4. Verify document icon appears instead of "View Report" text
5. Verify hover states work on icon
6. Click icon and verify navigation to report card page

### Potential Risks
- Very low - pure UI change
- SVG icon should be tested across browsers

---

## Issue 5: Student Profile Route Missing

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Route /ap/teacher/student/:userId should exist
- **Current State:** Route is not defined in routes.jsx, navigation exists in APExamAnalytics but leads nowhere

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/routes.jsx` - Route definitions (ends at line 107, no student profile route)
  - `src/apBoost/pages/APExamAnalytics.jsx` (lines 195-197) - Navigation to `/ap/teacher/student/${userId}`
- **Current Implementation:**
  - `handleStudentClick` navigates to `/ap/teacher/student/${userId}` but no route exists
  - Other teacher routes follow pattern: `/ap/teacher/...`
- **Gap:** Route definition missing
- **Dependencies:** Requires APStudentProfile page component (Issue 6)

### Fix Plan

#### Step 1: Add route after APExamAnalytics route
**File:** `src/apBoost/routes.jsx`
**Action:** Modify
**Details:**
- Add import for APStudentProfile (after line 11):
```javascript
import APStudentProfile from './pages/APStudentProfile'
```
- Add route after the analytics route (after line 106):
```jsx
<Route
  path="/ap/teacher/student/:userId"
  element={
    <PrivateRoute>
      <APStudentProfile />
    </PrivateRoute>
  }
/>
```

### Verification Steps
1. Navigate to analytics page
2. Click on a student name
3. Verify navigation to `/ap/teacher/student/:userId` works without 404

### Potential Risks
- Depends on APStudentProfile component existing (Issue 6)
- Must be done after or alongside Issue 6

---

## Issue 6: APStudentProfile Stub Page Missing

### Audit Finding
- **Status:** ❌ Missing (6 related criteria)
- **Criterion:**
  - Placeholder/stub page with TODO note
  - Future features planned: Student's AP test history
  - Future features planned: Performance trends
  - Future features planned: Strengths/weaknesses by domain
  - Future features planned: Comparison to class average
- **Current State:** No APStudentProfile component exists

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/` - No APStudentProfile.jsx exists
  - `src/apBoost/pages/APTeacherDashboard.jsx` - Reference pattern for teacher page structure
  - `src/apBoost/components/APHeader.jsx` - Shared header component
- **Current Implementation:** No page exists
- **Gap:** Need to create complete stub page with planned feature documentation
- **Dependencies:**
  - Uses existing `APHeader` component
  - Uses existing `useAuth` context
  - Uses `react-router-dom` for params and navigation

### Fix Plan

#### Step 1: Create APStudentProfile.jsx stub page
**File:** `src/apBoost/pages/APStudentProfile.jsx` (NEW FILE)
**Action:** Create
**Details:**
```jsx
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import APHeader from '../components/APHeader'

/**
 * APStudentProfile - Student profile page for teachers
 *
 * TODO: This is a stub page. Future features planned:
 * - Student's AP test history
 * - Performance trends over time
 * - Strengths/weaknesses by domain
 * - Comparison to class average
 */
export default function APStudentProfile() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-base">
      <APHeader />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Back navigation */}
        <button
          onClick={() => navigate(-1)}
          className="text-text-muted hover:text-text-primary mb-6 flex items-center gap-1"
        >
          <span>←</span>
          <span>Back</span>
        </button>

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            Student Profile
          </h1>
          <p className="text-text-muted">
            Student ID: {userId}
          </p>
        </div>

        {/* Coming soon notice */}
        <div className="bg-surface rounded-[--radius-card] border border-border-default p-8">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-8 h-8 text-text-muted"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>

            <h2 className="text-xl font-semibold text-text-primary mb-2">
              Student Profile Coming Soon
            </h2>

            <p className="text-text-muted mb-6 max-w-md mx-auto">
              This page will provide detailed insights into individual student performance across AP tests.
            </p>

            {/* Planned features list */}
            <div className="bg-muted rounded-[--radius-card] p-6 text-left max-w-md mx-auto">
              <h3 className="text-sm font-medium text-text-secondary mb-3">
                Planned Features:
              </h3>
              <ul className="space-y-2 text-sm text-text-muted">
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary mt-0.5">•</span>
                  <span>Student's AP test history with scores</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary mt-0.5">•</span>
                  <span>Performance trends over time</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary mt-0.5">•</span>
                  <span>Strengths and weaknesses by domain</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary mt-0.5">•</span>
                  <span>Comparison to class average</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
```

### Verification Steps
1. Complete Issue 5 (route addition) first
2. Navigate to analytics page
3. Click on any student name
4. Verify APStudentProfile page loads
5. Verify back button works
6. Verify all planned features are documented
7. Verify page styling matches other AP pages

### Potential Risks
- None - this is a stub page
- Future implementation will replace content but page structure is established

---

## Implementation Order

Recommended order to implement fixes (considering dependencies):

1. **Issue 6: APStudentProfile Stub Page** - Foundational; creates the page component needed by the route
2. **Issue 5: Student Profile Route** - Depends on Issue 6; adds the route definition
3. **Issue 1: MCQ Download PDF Button** - Independent; can be done in parallel with issues 3-4
4. **Issue 2: FRQ Download PDF Button** - Independent; similar to Issue 1
5. **Issue 3: FRQ Rubric Modal** - Independent; adds new component and integration
6. **Issue 4: Report Card Icon** - Independent; simple UI change

Issues 1, 2, 3, and 4 can be implemented in parallel after Issues 5 and 6 are complete.

## Cross-Cutting Concerns

### New Files to Create
1. `src/apBoost/pages/APStudentProfile.jsx` - Stub page for student profiles
2. `src/apBoost/components/analytics/FRQRubricModal.jsx` - Modal for FRQ sub-question details

### Files to Modify
1. `src/apBoost/routes.jsx` - Add student profile route
2. `src/apBoost/pages/APExamAnalytics.jsx` - Add PDF handlers, FRQ sub-click handler, modal state
3. `src/apBoost/components/analytics/StudentResultsTable.jsx` - Replace text with icon

### Design Patterns to Follow
- **Page structure**: Follow `APTeacherDashboard.jsx` pattern with `APHeader`, main content area
- **Modal structure**: Follow `QuestionDetailModal.jsx` pattern for new FRQ modal
- **Button styling**: Use existing button classes from `APExamAnalytics.jsx` Grid/Detailed toggles
- **Icon usage**: Use inline SVG for document icons (consistent with React approach, no emoji)

## Notes for Implementer

1. **PDF Download**: The `downloadQuestionsPdf` function is async but typically fast. Consider adding a loading indicator for large tests with many questions.

2. **FRQ Rubric Modal**: The current implementation is a placeholder. When rubric data becomes available in the question structure, update the modal to display actual scoring criteria.

3. **Student Profile**: This is intentionally a stub. The real implementation should:
   - Fetch student data from Firestore
   - Display test history from `ap_test_results` collection
   - Calculate performance trends using existing analytics utilities
   - Consider using charts library for trend visualization

4. **Icon Choice**: Using SVG instead of emoji for the report card icon ensures consistent rendering across platforms. If a specific icon library is added later, this can be updated.

5. **Testing**: All changes are additive and low-risk. Manual testing should verify:
   - PDF downloads work correctly
   - Navigation doesn't break existing flows
   - Modal open/close works properly
   - Responsive design is maintained
