# Fix Plan: Sections 12.1 to 13.2

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_12.1_to_13.2_criteria_audit.md

## Executive Summary
- Total Issues: 14
- Verified as Implemented: 1 (ScoreRangesEditor - audit was incomplete)
- ⚠️ Partial Implementations: 6
- ❌ Missing Features: 6
- ❓ Needs Investigation: 1
- Estimated Complexity: High

---

## Issue 1: Missing Download Report PDF Button (12.1)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Students can download score reports as PDF
- **Current State:** `generateReportPdf.js` utility exists with full implementation but is NOT imported or used in APReportCard.jsx

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/generateReportPdf.js` (lines 1-263) - Complete PDF generation utility with `downloadReportPdf` export
  - `src/apBoost/pages/APReportCard.jsx` (lines 497-505) - Actions section only has "Back to Dashboard" button
- **Current Implementation:** The utility is fully implemented:
  - `generateReportPdf(result, test, student)` - Creates jsPDF document
  - `downloadReportPdf(result, test, student)` - Saves PDF with filename
- **Gap:** No import statement for utility, no download button in UI
- **Dependencies:** jsPDF library (already installed per import in utility)

### Fix Plan

#### Step 1: Add import to APReportCard.jsx
**File:** `src/apBoost/pages/APReportCard.jsx`
**Action:** Modify - Add import at top of file
**Details:**
- Add import: `import { downloadReportPdf } from '../utils/generateReportPdf'`
- Place after existing imports (after line 8)

#### Step 2: Add download handler function
**File:** `src/apBoost/pages/APReportCard.jsx`
**Action:** Modify - Add handler inside component
**Details:**
- Add after line 340 (after grading status checks):
```jsx
// Handle PDF download
const handleDownloadPdf = async () => {
  try {
    await downloadReportPdf(result, test, {
      name: user?.displayName || user?.email || 'Student',
      email: user?.email,
    })
  } catch (err) {
    console.error('Failed to download PDF:', err)
  }
}
```

#### Step 3: Add download button to Actions section
**File:** `src/apBoost/pages/APReportCard.jsx`
**Action:** Modify - Add button in actions div (line 498-505)
**Details:**
- Add before "Back to Dashboard" link:
```jsx
<button
  onClick={handleDownloadPdf}
  className="bg-brand-primary text-white px-6 py-2 rounded-[--radius-button] hover:opacity-90 transition-colors"
>
  Download Report PDF
</button>
```

### Verification Steps
1. Navigate to `/ap/results/:resultId`
2. Click "Download Report PDF" button
3. Verify PDF downloads with correct filename format
4. Open PDF and verify content matches on-screen report

### Potential Risks
- Low risk: PDF generation is synchronous and uses existing data
- Consider adding loading state for download button if needed

---

## Issue 2: Customize Score Ranges UI (12.2)

### Audit Finding
- **Status:** ⚠️ Partial (per audit)
- **Criterion:** Teachers can customize score ranges for AP conversion
- **Current State:** Audit claimed no UI found

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APTestEditor.jsx` (lines 156-197) - `ScoreRangesEditor` component EXISTS
  - `src/apBoost/pages/APTestEditor.jsx` (lines 496-500) - Component IS rendered
- **Current Implementation:** FULLY IMPLEMENTED
  - ScoreRangesEditor component with 5 AP score range inputs
  - State managed by `scoreRanges` state variable (line 214)
  - Passed to `onChange={setScoreRanges}` handler

### Fix Plan
**NO FIX NEEDED** - This was incorrectly flagged in the audit. The ScoreRangesEditor is fully implemented at lines 156-197 and rendered at lines 496-500.

### Verification Steps
1. Navigate to `/ap/teacher/test/:testId/edit`
2. Scroll to "Score Ranges" section
3. Verify 5 AP score inputs (AP 5-1) with min/max percentage fields
4. Modify values and verify they persist on save

---

## Issue 3: Create and Manage Classes Page (12.2)

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Teachers can create and manage classes
- **Current State:** Classes displayed in dashboard sidebar but no dedicated management page

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APTeacherDashboard.jsx` (lines 296-311) - Classes list in sidebar
  - `src/apBoost/services/apTeacherService.js` (lines 160-178) - `getTeacherClasses` exists
  - `src/apBoost/routes.jsx` - No class management route
- **Current Implementation:**
  - Classes are fetched and displayed as read-only list
  - No create/edit/delete functionality
  - ClassItem component only displays name, period, student count
- **Gap:** Need APClassManager page with CRUD operations
- **Dependencies:** Need new service functions for class CRUD

### Fix Plan

#### Step 1: Create apClassService.js
**File:** `src/apBoost/services/apClassService.js`
**Action:** Create new file
**Details:**
- Create service with functions:
  - `createClass(teacherId, classData)` - Create new class
  - `updateClass(classId, classData)` - Update class details
  - `deleteClass(classId)` - Delete class
  - `addStudentsToClass(classId, studentIds)` - Add students
  - `removeStudentFromClass(classId, studentId)` - Remove student
  - `getClassStudents(classId)` - Fetch student details
- Follow patterns from `apTeacherService.js`

#### Step 2: Create APClassManager.jsx
**File:** `src/apBoost/pages/APClassManager.jsx`
**Action:** Create new page
**Details:**
- Page layout with APHeader
- Class list with edit/delete actions
- "Create Class" button opening modal/form
- Class form with: name, period, year fields
- Student management section (add/remove students)
- Follow patterns from APTestEditor.jsx for form handling

#### Step 3: Add route for class management
**File:** `src/apBoost/routes.jsx`
**Action:** Modify - Add new route
**Details:**
- Add import: `import APClassManager from './pages/APClassManager'`
- Add routes:
```jsx
<Route
  path="/ap/teacher/classes"
  element={
    <PrivateRoute>
      <APClassManager />
    </PrivateRoute>
  }
/>
<Route
  path="/ap/teacher/class/:classId"
  element={
    <PrivateRoute>
      <APClassManager />
    </PrivateRoute>
  }
/>
```

#### Step 4: Update dashboard "My Classes" section
**File:** `src/apBoost/pages/APTeacherDashboard.jsx`
**Action:** Modify - Add link to class management
**Details:**
- Add "Manage Classes" link in My Classes section header (line 298)
- Update ClassItem to link to `/ap/teacher/class/:classId`

### Verification Steps
1. Navigate to `/ap/teacher/classes`
2. Create a new class
3. Add students to class
4. Edit class details
5. Remove student from class
6. Delete class

### Potential Risks
- Medium complexity: Requires new service layer and full CRUD page
- Need to handle student lookup/search for adding students

---

## Issue 4: Export Questions/Reports PDF Buttons (12.2)

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Teachers can export questions and reports as PDFs
- **Current State:** Utilities exist but no UI buttons to trigger them

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/generateQuestionsPdf.js` - Complete utility with options
  - `src/apBoost/pages/APTestEditor.jsx` - Test editing page (best location for questions PDF)
  - `src/apBoost/pages/APExamAnalytics.jsx` - Analytics page (location for reports)
- **Current Implementation:**
  - `generateQuestionsPdf(test, questions, options)` - Creates PDF
  - `downloadQuestionsPdf(test, questions, options)` - Downloads PDF
  - Options: `{ includeAnswers: boolean, includeStimuli: boolean }`
- **Gap:** No buttons wired up in UI

### Fix Plan

#### Step 1: Add PDF export to APTestEditor
**File:** `src/apBoost/pages/APTestEditor.jsx`
**Action:** Modify
**Details:**
- Add import: `import { downloadQuestionsPdf } from '../utils/generateQuestionsPdf'`
- Add export handler:
```jsx
const handleExportPdf = async (includeAnswers = false) => {
  await downloadQuestionsPdf(
    { title, subject, sections },
    questionsCache,
    { includeAnswers, includeStimuli: true }
  )
}
```
- Add dropdown or button group in header section (near "Save Draft"):
```jsx
<div className="relative">
  <button className="px-4 py-2 border ...">Export PDF</button>
  <div className="dropdown-menu">
    <button onClick={() => handleExportPdf(false)}>Student Version</button>
    <button onClick={() => handleExportPdf(true)}>Teacher Version (with answers)</button>
  </div>
</div>
```

#### Step 2: Add report export to APExamAnalytics (optional enhancement)
**File:** `src/apBoost/pages/APExamAnalytics.jsx`
**Action:** Modify
**Details:**
- Add export functionality for analytics summary PDF
- Lower priority than questions PDF

### Verification Steps
1. Navigate to `/ap/teacher/test/:testId/edit`
2. Click "Export PDF" dropdown
3. Download "Student Version" - verify no answers shown
4. Download "Teacher Version" - verify answers highlighted

### Potential Risks
- Low risk: Utility already tested and complete
- May need loading indicator for large tests

---

## Issue 5: Admin Question Bank Access (12.3)

### Audit Finding
- **Status:** ❓ Unable to Verify
- **Criterion:** Admins can manage question bank
- **Current State:** No explicit admin role check for question bank

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APQuestionBank.jsx` - Question bank page
  - `src/components/PrivateRoute.jsx` - Only checks authentication, not roles
  - `src/contexts/AuthContext.jsx` (lines 37-43) - User object DOES have role property
- **Current Implementation:**
  - User role is loaded from Firestore (`role: userData.role ?? 'student'`)
  - PrivateRoute does not check role
  - No admin-specific UI or permissions
- **Gap:** Need role-based access control for admin features

### Fix Plan

#### Step 1: Create RoleProtectedRoute component
**File:** `src/apBoost/components/RoleProtectedRoute.jsx`
**Action:** Create new component
**Details:**
```jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function RoleProtectedRoute({
  children,
  allowedRoles = [],
  fallback = '/ap'
}) {
  const { user, initializing } = useAuth()

  if (initializing) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Check if user has required role
  const userRole = user.role || 'student'

  // Admin has access to everything
  if (userRole === 'admin') {
    return children
  }

  // Check if user's role is in allowed list
  if (!allowedRoles.includes(userRole)) {
    return <Navigate to={fallback} replace />
  }

  return children
}
```

#### Step 2: Update routes.jsx to use RoleProtectedRoute
**File:** `src/apBoost/routes.jsx`
**Action:** Modify - Protect teacher routes
**Details:**
- Import: `import RoleProtectedRoute from './components/RoleProtectedRoute'`
- Wrap teacher routes:
```jsx
<Route
  path="/ap/teacher"
  element={
    <RoleProtectedRoute allowedRoles={['teacher', 'admin']}>
      <APTeacherDashboard />
    </RoleProtectedRoute>
  }
/>
```
- Apply to all `/ap/teacher/*` routes

### Verification Steps
1. Log in as student - verify cannot access `/ap/teacher`
2. Log in as teacher - verify can access `/ap/teacher`
3. Log in as admin - verify can access all routes

### Potential Risks
- Breaking change: May lock out users if roles not properly set in Firestore
- Mitigation: Default to 'student' role if not set

---

## Issue 6: Create Public Tests Admin UI (12.3)

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Admins can create public tests (isPublic: true)
- **Current State:** `isPublic` field exists in data model but no UI to set it

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/seedTestData.js` (line 26) - `isPublic: true` used in seed
  - `src/apBoost/services/apTestService.js` (line 27) - Queries public tests
  - `src/apBoost/pages/APTestEditor.jsx` - No isPublic toggle
- **Current Implementation:**
  - Data model supports `isPublic` field
  - No UI to toggle it
- **Gap:** Need checkbox/toggle in APTestEditor (admin-only)

### Fix Plan

#### Step 1: Add isPublic toggle to APTestEditor
**File:** `src/apBoost/pages/APTestEditor.jsx`
**Action:** Modify
**Details:**
- Add state: `const [isPublic, setIsPublic] = useState(false)`
- Load from test data in useEffect (line 244): `setIsPublic(test.isPublic || false)`
- Add to testData in handleSave (line 365): `isPublic,`
- Add toggle in UI (visible only to admins):
```jsx
{user?.role === 'admin' && (
  <div className="flex items-center gap-2 mt-4">
    <input
      type="checkbox"
      id="isPublic"
      checked={isPublic}
      onChange={(e) => setIsPublic(e.target.checked)}
      className="rounded border-border-default"
    />
    <label htmlFor="isPublic" className="text-text-secondary text-sm">
      Make this test public (visible to all students)
    </label>
  </div>
)}
```

### Verification Steps
1. Log in as admin
2. Edit test - verify isPublic checkbox visible
3. Enable isPublic and save
4. Verify test appears in student dashboard without assignment

### Potential Risks
- Low risk: Simple boolean toggle
- Consider: Warning message about public visibility

---

## Issue 7: Missing /ap/test/:testId/review Route (13.1)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** /ap/test/:testId/review → APTestReview (quick view after submit)
- **Current State:** Review is inline view state within APTestSession

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APTestSession.jsx` (line 45) - `view` state includes 'review'
  - `src/apBoost/components/ReviewScreen.jsx` - Review component
- **Current Implementation:**
  - ReviewScreen is rendered inline when `view === 'review'`
  - No separate route/page
- **Gap:** May want dedicated route for direct linking/bookmarking

### Fix Plan

#### Option A: Add route that maps to APTestSession with review state
**File:** `src/apBoost/routes.jsx`
**Action:** Modify - Add review route
**Details:**
```jsx
<Route
  path="/ap/test/:testId/review"
  element={
    <PrivateRoute>
      <APTestSession initialView="review" />
    </PrivateRoute>
  }
/>
```
- Update APTestSession to accept `initialView` prop and set initial state

#### Option B: Create separate APTestReview page (if needed for different functionality)
**File:** `src/apBoost/pages/APTestReview.jsx`
**Action:** Create new page
**Details:**
- Page that loads session and displays review screen
- May redirect to results if test already submitted

### Recommended Approach: Option A (simpler)

#### Step 1: Modify APTestSession to accept initialView prop
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Modify
**Details:**
- Change line 45:
```jsx
const [view, setView] = useState(initialView || 'instruction')
```
- Add prop destructuring: `function APTestSession({ initialView = 'instruction' })`

#### Step 2: Add route
**File:** `src/apBoost/routes.jsx`
**Action:** Modify
**Details:**
```jsx
<Route
  path="/ap/test/:testId/review"
  element={
    <PrivateRoute>
      <APTestSession initialView="review" />
    </PrivateRoute>
  }
/>
```

### Verification Steps
1. Navigate directly to `/ap/test/:testId/review`
2. Verify review screen is displayed
3. Verify navigation still works

### Potential Risks
- May need to handle edge cases (test not started, test already submitted)
- Consider redirecting to results if already submitted

---

## Issue 8: Gradebook Route Path Discrepancy (13.2)

### Audit Finding
- **Status:** ⚠️ Partial (Different Path)
- **Criterion:** /ap/teacher/gradebook → APGradebook
- **Current State:** Route is `/ap/gradebook` (missing /teacher)

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/routes.jsx` (lines 91-98) - Route is `/ap/gradebook`
  - `src/apBoost/pages/APTeacherDashboard.jsx` (lines 228, 287) - Links to `/ap/gradebook`
- **Current Implementation:** Path works but doesn't match criteria pattern

### Fix Plan

#### Step 1: Update route path
**File:** `src/apBoost/routes.jsx`
**Action:** Modify
**Details:**
- Change line 92: `path="/ap/teacher/gradebook"`
- Add RoleProtectedRoute wrapper for teacher access

#### Step 2: Update all links to gradebook
**File:** `src/apBoost/pages/APTeacherDashboard.jsx`
**Action:** Modify
**Details:**
- Line 228: Change `to="/ap/gradebook"` to `to="/ap/teacher/gradebook"`
- Line 287: Change `to="/ap/gradebook"` to `to="/ap/teacher/gradebook"`

### Verification Steps
1. Navigate to `/ap/teacher/gradebook`
2. Verify page loads
3. Verify dashboard links work

### Potential Risks
- Low risk: Simple path rename
- Update any other references to old path

---

## Issue 9: Missing /ap/teacher/gradebook/:resultId Route (13.2)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** /ap/teacher/gradebook/:resultId → APGradebook with side-panel open
- **Current State:** No route with resultId parameter

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APGradebook.jsx` (lines 121-122) - Has `selectedResultId` and `isPanelOpen` state
- **Current Implementation:**
  - Panel opens via button click, not direct URL
  - State managed internally, not from URL params

### Fix Plan

#### Step 1: Add route with resultId parameter
**File:** `src/apBoost/routes.jsx`
**Action:** Modify
**Details:**
```jsx
<Route
  path="/ap/teacher/gradebook/:resultId"
  element={
    <RoleProtectedRoute allowedRoles={['teacher', 'admin']}>
      <APGradebook />
    </RoleProtectedRoute>
  }
/>
```

#### Step 2: Modify APGradebook to read resultId from URL
**File:** `src/apBoost/pages/APGradebook.jsx`
**Action:** Modify
**Details:**
- Add: `const { resultId: urlResultId } = useParams()`
- Add useEffect to open panel when resultId is in URL:
```jsx
useEffect(() => {
  if (urlResultId) {
    setSelectedResultId(urlResultId)
    setIsPanelOpen(true)
  }
}, [urlResultId])
```

### Verification Steps
1. Navigate directly to `/ap/teacher/gradebook/abc123`
2. Verify panel opens automatically with that result
3. Verify closing panel updates URL

### Potential Risks
- Low risk: Additive change
- Consider updating URL when panel opens/closes

---

## Issue 10: Missing /ap/teacher/test/new Route (13.2)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** /ap/teacher/test/new → APTestEditor (create)
- **Current State:** Route NOT defined but IS referenced in dashboard

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APTeacherDashboard.jsx` (line 217) - Links to `/ap/teacher/test/new`
  - `src/apBoost/routes.jsx` - Route missing
  - `src/apBoost/pages/APTestEditor.jsx` (line 207) - Checks `isNew = testId === 'new'`
- **Current Implementation:**
  - APTestEditor already handles `testId === 'new'` case
  - But no route to get there
- **Gap:** Critical - button in UI leads nowhere

### Fix Plan

#### Step 1: Add route for new test
**File:** `src/apBoost/routes.jsx`
**Action:** Modify
**Details:**
```jsx
<Route
  path="/ap/teacher/test/new"
  element={
    <RoleProtectedRoute allowedRoles={['teacher', 'admin']}>
      <APTestEditor />
    </RoleProtectedRoute>
  }
/>
```
- Place BEFORE the `/ap/teacher/test/:testId/edit` route (order matters for matching)

### Verification Steps
1. Click "Create New Test" button on teacher dashboard
2. Verify APTestEditor loads in create mode
3. Create and save a test
4. Verify redirect to edit mode works

### Potential Risks
- Low risk: Route already expected by component
- Ensure route is placed before parameterized route

---

## Issue 11: Test Editor Route Path Has /edit Suffix (13.2)

### Audit Finding
- **Status:** ⚠️ Partial (Different Path)
- **Criterion:** /ap/teacher/test/:testId → APTestEditor (edit)
- **Current State:** Route is `/ap/teacher/test/:testId/edit` (has /edit suffix)

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/routes.jsx` (line 60) - Path includes `/edit`
  - `src/apBoost/pages/APTeacherDashboard.jsx` (line 59) - Links to `/ap/teacher/test/${test.id}/edit`
- **Current Implementation:** Works but path differs from criteria

### Fix Plan

#### Option A: Change path to match criteria
**File:** `src/apBoost/routes.jsx`
**Action:** Modify
**Details:**
- Change line 60: `path="/ap/teacher/test/:testId"`
- Update all links throughout the codebase

#### Option B: Keep current path (recommended)
**Rationale:** The `/edit` suffix provides clarity that this is edit mode vs. view mode. This is a common pattern.

### Recommended: Option B - No Change Needed
- The current pattern (`/edit` suffix) is clearer for UX
- Document this as intentional deviation from criteria

### Verification Steps
- Verify all edit links work correctly
- Consider if a view-only test page is needed

---

## Issue 12: Missing APStudentProfile Page (13.2)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** /ap/teacher/student/:userId → APStudentProfile (stub)
- **Current State:** Page and route completely missing

### Code Analysis
- No existing file
- Noted as "stub" in criteria - minimal implementation acceptable

### Fix Plan

#### Step 1: Create APStudentProfile.jsx
**File:** `src/apBoost/pages/APStudentProfile.jsx`
**Action:** Create new page
**Details:**
```jsx
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import APHeader from '../components/APHeader'
import { getStudentProfile, getStudentResults } from '../services/apTeacherService'
import { logError } from '../utils/logError'

export default function APStudentProfile() {
  const { userId } = useParams()
  const [student, setStudent] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadStudent() {
      try {
        setLoading(true)
        const [studentData, resultsData] = await Promise.all([
          getStudentProfile(userId),
          getStudentResults(userId),
        ])
        setStudent(studentData)
        setResults(resultsData)
      } catch (err) {
        logError('APStudentProfile.load', { userId }, err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadStudent()
  }, [userId])

  // Render student info, test results list, etc.
  // ... stub implementation
}
```

#### Step 2: Add service functions
**File:** `src/apBoost/services/apTeacherService.js`
**Action:** Modify - Add functions
**Details:**
- Add `getStudentProfile(userId)` - Fetch user document
- Add `getStudentResults(userId)` - Fetch test results for student

#### Step 3: Add route
**File:** `src/apBoost/routes.jsx`
**Action:** Modify
**Details:**
```jsx
<Route
  path="/ap/teacher/student/:userId"
  element={
    <RoleProtectedRoute allowedRoles={['teacher', 'admin']}>
      <APStudentProfile />
    </RoleProtectedRoute>
  }
/>
```

### Verification Steps
1. Navigate to `/ap/teacher/student/:userId`
2. Verify student info loads
3. Verify test results list displays

### Potential Risks
- Medium complexity: Requires new service functions
- May need to link from gradebook/analytics

---

## Issue 13: Missing Class Management Route (13.2)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** /ap/teacher/class/:classId → Class management
- **Current State:** Route and page completely missing

### Code Analysis
- Covered in Issue 3 (Create and Manage Classes Page)

### Fix Plan
See Issue 3 - Fix includes both `/ap/teacher/classes` and `/ap/teacher/class/:classId` routes

---

## Issue 14: No Role-Based Access Control (12.3)

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Admins can access all teacher capabilities
- **Current State:** PrivateRoute only checks authentication, not roles

### Code Analysis
- Covered in Issue 5 (Admin Question Bank Access)

### Fix Plan
See Issue 5 - RoleProtectedRoute component handles all role-based access

---

## Implementation Order

Recommended order to implement fixes (considering dependencies):

1. **Issue 5: RoleProtectedRoute** - Foundational for role-based access control
2. **Issue 10: /ap/teacher/test/new Route** - Critical bug fix (button leads nowhere)
3. **Issue 1: Download Report PDF Button** - Quick win, utility already exists
4. **Issue 4: Export Questions PDF Button** - Quick win, utility already exists
5. **Issue 8: Gradebook Route Path** - Simple rename
6. **Issue 9: Gradebook with resultId** - Builds on issue 8
7. **Issue 6: isPublic Toggle** - Simple UI addition
8. **Issue 7: /ap/test/:testId/review Route** - Simple route addition
9. **Issue 3 & 13: Class Management Page** - New page and service (larger effort)
10. **Issue 12: APStudentProfile Page** - New page (stub acceptable)
11. **Issue 11: Test Editor Path** - No change recommended

## Cross-Cutting Concerns

### RoleProtectedRoute Component
- Create once, use for all teacher/admin routes
- Pattern: Check user.role against allowedRoles array
- Admin role has access to everything

### Service Layer Additions
- `apClassService.js` - New service for class CRUD
- `apTeacherService.js` additions for student profile

### UI Patterns to Follow
- Use existing button styles from APReportCard, APTestEditor
- Use dropdown pattern from APTestEditor for PDF export options
- Follow APHeader + main container layout pattern

## Notes for Implementer

1. **Test Role Data:** Ensure test users have appropriate roles in Firestore
2. **Backward Compatibility:** Keep `/ap/gradebook` as redirect to `/ap/teacher/gradebook`
3. **Error States:** All new pages should handle loading/error states like existing pages
4. **Design Tokens:** Use design tokens from `/src/index.css` per CLAUDE.md instructions
5. **Change Log:** Log all changes to `change_action_log_ap.md`

## Quality Verification
- [ ] Every ⚠️/❌/❓ issue from audit has fix plan
- [ ] Each fix plan includes specific file paths and line numbers
- [ ] Each fix plan references existing code patterns
- [ ] Dependencies between fixes identified
- [ ] Implementation order is logical
- [ ] Verification steps are actionable
- [ ] Potential risks documented
