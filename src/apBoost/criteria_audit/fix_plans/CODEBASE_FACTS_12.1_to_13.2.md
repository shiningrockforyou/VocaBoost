# CODEBASE_FACTS__UNK__12.1_to_13.2

**Inspector:** Claude Agent
**Date:** 2026-01-14
**Chunk ID:** UNK__12.1_to_13.2
**Source:** Fix Plan Sections 12.1 to 13.2

---

## 1) Canonical Data Schema / Source-of-Truth

**Found: Yes**

### Collection Names (from apTypes.js)
- `ap_tests` - Test definitions
- `ap_questions` - Question bank
- `ap_classes` - Class/roster data
- `ap_assignments` - Test assignments
- `ap_test_results` - Student test results
- `ap_session_state` - Active test sessions

**Evidence:**
- File: `src/apBoost/utils/apTypes.js` L90-98
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

### Test Schema (isPublic field)
- `isPublic` field EXISTS in data model and is queried
- Field is NOT exposed in APTestEditor UI
- Only set via seed data

**Evidence:**
- File: `src/apBoost/services/apTestService.js` L27
```javascript
where('isPublic', '==', true)
```
- File: `src/apBoost/utils/seedTestData.js` L26
```javascript
isPublic: true,
```
- File: `src/apBoost/pages/APTestEditor.jsx` - NO `isPublic` state or field (only `isPublished` at L215, L244)

### User Role Storage
- Role stored in Firestore `users` collection under `role` field
- Default role is `'student'` when not found or on error

**Evidence:**
- File: `src/contexts/AuthContext.jsx` L32-56
```javascript
const loadProfile = async () => {
  try {
    const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid))
    const userData = userSnap.exists() ? userSnap.data() : {}
    if (isMounted) {
      setUser({
        ...firebaseUser,
        role: userData.role ?? 'student',
        profile: userData.profile ?? null,
        stats: userData.stats ?? null,
        settings: userData.settings ?? null,
      })
    }
  } catch {
    if (isMounted) {
      setUser({
        ...firebaseUser,
        role: 'student',
      })
    }
  }
}
```

### Class Schema Fields
- Collection: `ap_classes`
- Fields: `teacherId`, `name`, `period`, `studentIds[]`

**Evidence:**
- File: `src/apBoost/services/apTeacherService.js` L160-178
```javascript
export async function getTeacherClasses(teacherId) {
  try {
    const classesRef = collection(db, COLLECTIONS.CLASSES)
    const q = query(
      classesRef,
      where('teacherId', '==', teacherId),
      orderBy('name', 'asc')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  }
}
```
- File: `src/apBoost/services/apTeacherService.js` L185-223 (getClassStudents references `studentIds`)

### Result Object for Report PDF
- Sources from `ap_test_results` collection via `getTestResult()`
- Fields used: `mcqResults`, `frqAnswers`, `frqGrades`, `apScore`, `score`, `maxScore`, `percentage`, `completedAt`, `gradingStatus`, `frqSubmissionType`, `frqUploadedFiles`, `annotatedPdfUrl`

**Evidence:**
- File: `src/apBoost/pages/APReportCard.jsx` L277-297, L339-355
```javascript
const resultData = await getTestResult(resultId)
// ...
const gradingStatus = result?.gradingStatus || GRADING_STATUS.NOT_NEEDED
const mcqResults = result?.mcqResults || []
const frqAnswers = result?.frqAnswers || {}
const frqGrades = result?.frqGrades || {}
const isHandwritten = result?.frqSubmissionType === FRQ_SUBMISSION_TYPE.HANDWRITTEN
const uploadedFiles = result?.frqUploadedFiles || []
const annotatedPdfUrl = result?.annotatedPdfUrl
```

---

## 2) Write Paths

**Found: Yes (Partial)**

### Report PDF Generation - Client-Side Only
- `downloadReportPdf` is purely client-side (generates PDF and triggers browser download)
- Does NOT write to Firestore or Storage
- Function exists but is NOT imported/used in APReportCard.jsx

**Evidence:**
- File: `src/apBoost/utils/generateReportPdf.js` L244-248
```javascript
export async function downloadReportPdf(result, test, student) {
  const doc = await generateReportPdf(result, test, student)
  const filename = `AP_Report_${student?.name?.replace(/\s+/g, '_') || 'Student'}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
```
- File: `src/apBoost/pages/APReportCard.jsx` - NO import of `downloadReportPdf`

### Questions PDF Export - Utility Exists, NOT Wired
- `downloadQuestionsPdf` utility exists
- NOT imported or used anywhere in APTestEditor or other pages

**Evidence:**
- File: `src/apBoost/utils/generateQuestionsPdf.js` L271-275
```javascript
export async function downloadQuestionsPdf(test, questions, options = {}) {
  const doc = await generateQuestionsPdf(test, questions, options)
  const filename = `${test?.title?.replace(/\s+/g, '_') || 'Questions'}_${options.includeAnswers ? 'Teacher' : 'Student'}.pdf`
  doc.save(filename)
}
```
- Grep result: `downloadQuestionsPdf` only appears in utility file and audit markdown files - NOT in any page/component

### Class CRUD Services
- **getTeacherClasses** - EXISTS (L160-178)
- **getClassStudents** - EXISTS (L185-223)
- **createClass** - NOT FOUND
- **updateClass** - NOT FOUND
- **deleteClass** - NOT FOUND
- **addStudentsToClass** - NOT FOUND
- **removeStudentFromClass** - NOT FOUND

**Evidence:**
- File: `src/apBoost/services/apTeacherService.js` - Full file read, only contains:
  - `getTeacherTests`, `createTest`, `updateTest`, `deleteTest`, `getTestById`
  - `getTeacherClasses`, `getClassStudents`
  - `createAssignment`, `getTestAssignments`
  - `getPendingGradingCount`, `getPendingGradingList`
  - `publishTest`, `unpublishTest`

### isPublic Field Persistence
- NOT included in APTestEditor save payload
- Field only appears in seed data

**Evidence:**
- File: `src/apBoost/pages/APTestEditor.jsx` L358-365 (handleSave testData)
```javascript
const testData = {
  title: title.trim(),
  subject,
  testType,
  sections,
  scoreRanges,
  createdBy: user?.uid,
}
```
Note: NO `isPublic` field in this object

### Role-Based Gating
- NO RoleProtectedRoute component exists
- PrivateRoute only checks authentication, NOT role

**Evidence:**
- File: `src/components/PrivateRoute.jsx` L4-20 (complete file)
```javascript
const PrivateRoute = ({ children }) => {
  const { user, initializing } = useAuth()

  if (initializing) {
    return (/* loading UI */)
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
```
- Glob search for `RoleProtectedRoute*` returned: No files found

---

## 3) Offline/Resilience Mechanics

**Found: No**

Not applicable to the features in scope (PDF generation, routing, role checks). The test session has resilience (connection status, duplicate tab handling) but that's unrelated to these features.

---

## 4) UI/Flow Entry Points

**Found: Yes**

### Route Definitions (from routes.jsx)

| Route | Component | Exists |
|-------|-----------|--------|
| `/ap/results/:resultId` | APReportCard | ✅ Yes (L41-48) |
| `/ap/gradebook` | APGradebook | ✅ Yes (L91-98) |
| `/ap/teacher/gradebook` | N/A | ❌ NOT FOUND |
| `/ap/teacher/test/:testId/edit` | APTestEditor | ✅ Yes (L59-66) |
| `/ap/teacher/test/new` | N/A | ❌ NOT FOUND |
| `/ap/test/:testId/review` | N/A | ❌ NOT FOUND (internal state only) |
| `/ap/teacher/classes` | N/A | ❌ NOT FOUND |
| `/ap/teacher/class/:classId` | N/A | ❌ NOT FOUND |
| `/ap/teacher/student/:userId` | N/A | ❌ NOT FOUND |

**Evidence:**
- File: `src/apBoost/routes.jsx` L14-108 (complete file)
```javascript
export const apBoostRoutes = (
  <>
    {/* Student Routes */}
    <Route path="/ap" element={<PrivateRoute><APDashboard /></PrivateRoute>} />
    <Route path="/ap/test/:testId" element={<PrivateRoute><APTestSession /></PrivateRoute>} />
    <Route path="/ap/test/:testId/assignment/:assignmentId" element={<PrivateRoute><APTestSession /></PrivateRoute>} />
    <Route path="/ap/results/:resultId" element={<PrivateRoute><APReportCard /></PrivateRoute>} />

    {/* Teacher Routes */}
    <Route path="/ap/teacher" element={<PrivateRoute><APTeacherDashboard /></PrivateRoute>} />
    <Route path="/ap/teacher/test/:testId/edit" element={<PrivateRoute><APTestEditor /></PrivateRoute>} />
    <Route path="/ap/teacher/test/:testId/assign" element={<PrivateRoute><APAssignTest /></PrivateRoute>} />
    <Route path="/ap/teacher/questions" element={<PrivateRoute><APQuestionBank /></PrivateRoute>} />
    <Route path="/ap/teacher/question/:questionId/edit" element={<PrivateRoute><APQuestionEditor /></PrivateRoute>} />
    <Route path="/ap/gradebook" element={<PrivateRoute><APGradebook /></PrivateRoute>} />
    <Route path="/ap/teacher/analytics/:testId" element={<PrivateRoute><APExamAnalytics /></PrivateRoute>} />
  </>
)
```

### UI Links to Missing Routes

**"Create New Test" button links to missing route:**
- File: `src/apBoost/pages/APTeacherDashboard.jsx` L216-221
```javascript
<QuickActionButton
  to="/ap/teacher/test/new"
  icon="+"
  label="Create New Test"
  primary
/>
```

**Student profile link to missing route:**
- File: `src/apBoost/pages/APExamAnalytics.jsx` L194-197
```javascript
const handleStudentClick = (userId) => {
  navigate(`/ap/teacher/student/${userId}`)
}
```

**QuestionBank also references /ap/teacher/test/new:**
- File: `src/apBoost/pages/APQuestionBank.jsx` L316, L355
```javascript
const backUrl = testId ? `/ap/teacher/test/${testId}/edit` : '/ap/teacher/test/new'
```

### APReportCard Actions Section
- Currently only has "Back to Dashboard" link
- NO PDF download button

**Evidence:**
- File: `src/apBoost/pages/APReportCard.jsx` L497-505
```javascript
{/* Actions */}
<div className="flex justify-center gap-4">
  <Link
    to="/ap"
    className="bg-surface text-text-primary px-6 py-2 rounded-[--radius-button] border border-border-default hover:bg-hover transition-colors"
  >
    Back to Dashboard
  </Link>
</div>
```

### Review Flow (Internal State, Not Route)
- Review is a view state inside APTestSession, NOT a separate route
- State: `'instruction' | 'testing' | 'review' | 'frqChoice' | 'frqHandwritten'`

**Evidence:**
- File: `src/apBoost/pages/APTestSession.jsx` L44-45
```javascript
// View state: 'instruction' | 'testing' | 'review' | 'frqChoice' | 'frqHandwritten'
const [view, setView] = useState('instruction')
```
- File: `src/apBoost/pages/APTestSession.jsx` L351-384 (review screen rendering)
```javascript
if (view === 'review') {
  return (
    <div className="min-h-screen bg-base">
      <APHeader />
      <ReviewScreen ... />
    </div>
  )
}
```

### Gradebook Panel State
- Panel opened via click handler, NOT URL params
- No `useParams` for deep linking

**Evidence:**
- File: `src/apBoost/pages/APGradebook.jsx` L121-122
```javascript
const [selectedResultId, setSelectedResultId] = useState(null)
const [isPanelOpen, setIsPanelOpen] = useState(false)
```
- File: `src/apBoost/pages/APGradebook.jsx` L182-191
```javascript
const handleGrade = (resultId) => {
  setSelectedResultId(resultId)
  setIsPanelOpen(true)
}

const handleView = (resultId) => {
  setSelectedResultId(resultId)
  setIsPanelOpen(true)
}
```

---

## 5) Must-Answer Questions (Checklist)

### 1. Does `src/apBoost/utils/generateReportPdf.js` exist, and does it export `downloadReportPdf`? How is jsPDF imported/used?

**Answer:** Yes, file exists and exports `downloadReportPdf`. jsPDF is imported at line 5 and instantiated at line 15.

**Evidence:**
- File: `src/apBoost/utils/generateReportPdf.js` L5
```javascript
import jsPDF from 'jspdf'
```
- File: `src/apBoost/utils/generateReportPdf.js` L14-15
```javascript
export async function generateReportPdf(result, test, student) {
  const doc = new jsPDF()
```
- File: `src/apBoost/utils/generateReportPdf.js` L244-248
```javascript
export async function downloadReportPdf(result, test, student) {
  const doc = await generateReportPdf(result, test, student)
  const filename = `AP_Report_${student?.name?.replace(/\s+/g, '_') || 'Student'}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
```

### 2. In `APReportCard.jsx`, is `downloadReportPdf` imported anywhere today? Is there any button or handler that triggers a PDF download?

**Answer:** NO. `downloadReportPdf` is NOT imported. No PDF download button exists in the Actions section.

**Evidence:**
- File: `src/apBoost/pages/APReportCard.jsx` L1-8 (imports)
```javascript
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import APHeader from '../components/APHeader'
import { getTestResult } from '../services/apScoringService'
import { getTestMeta } from '../services/apTestService'
import { getSubjectConfig } from '../utils/apTestConfig'
import { GRADING_STATUS, FRQ_SUBMISSION_TYPE } from '../utils/apTypes'
```
No `generateReportPdf` or `downloadReportPdf` import present.

- File: `src/apBoost/pages/APReportCard.jsx` L497-505 (Actions section - only has Back to Dashboard)
```javascript
{/* Actions */}
<div className="flex justify-center gap-4">
  <Link to="/ap" className="...">Back to Dashboard</Link>
</div>
```

### 3. What is the exact route path that renders APReportCard (results page), and what params does it use?

**Answer:** `/ap/results/:resultId` renders APReportCard. Uses `resultId` param.

**Evidence:**
- File: `src/apBoost/routes.jsx` L41-48
```javascript
<Route
  path="/ap/results/:resultId"
  element={
    <PrivateRoute>
      <APReportCard />
    </PrivateRoute>
  }
/>
```
- File: `src/apBoost/pages/APReportCard.jsx` L262
```javascript
const { resultId } = useParams()
```

### 4. Does `ScoreRangesEditor` exist in `APTestEditor.jsx`, and is it actually rendered? Where is its state stored and saved?

**Answer:** YES. ScoreRangesEditor exists (L156-197), is rendered (L497-500). State stored in `scoreRanges` (L214), included in save payload (L363).

**Evidence:**
- File: `src/apBoost/pages/APTestEditor.jsx` L156-197 (ScoreRangesEditor component definition)
```javascript
function ScoreRangesEditor({ scoreRanges, onChange }) {
  const handleChange = (score, field, value) => {
    const newRanges = { ...scoreRanges }
    newRanges[score] = { ...newRanges[score], [field]: parseInt(value) || 0 }
    onChange(newRanges)
  }
  // ... rendering logic
}
```
- File: `src/apBoost/pages/APTestEditor.jsx` L214
```javascript
const [scoreRanges, setScoreRanges] = useState(DEFAULT_SCORE_RANGES)
```
- File: `src/apBoost/pages/APTestEditor.jsx` L496-500 (rendering)
```javascript
<div className="mb-6">
  <ScoreRangesEditor
    scoreRanges={scoreRanges}
    onChange={setScoreRanges}
  />
</div>
```
- File: `src/apBoost/pages/APTestEditor.jsx` L358-365 (save payload includes scoreRanges)
```javascript
const testData = {
  title: title.trim(),
  subject,
  testType,
  sections,
  scoreRanges,  // <-- included
  createdBy: user?.uid,
}
```

### 5. Is there already any questions PDF export UI wired to `downloadQuestionsPdf`? If not, confirm the utility exists and where it is referenced.

**Answer:** NO UI is wired to `downloadQuestionsPdf`. Utility exists at `src/apBoost/utils/generateQuestionsPdf.js` L271-275. Only referenced in audit markdown files, NOT in any page/component.

**Evidence:**
- File: `src/apBoost/utils/generateQuestionsPdf.js` L271-275
```javascript
export async function downloadQuestionsPdf(test, questions, options = {}) {
  const doc = await generateQuestionsPdf(test, questions, options)
  const filename = `${test?.title?.replace(/\s+/g, '_') || 'Questions'}_${options.includeAnswers ? 'Teacher' : 'Student'}.pdf`
  doc.save(filename)
}
```
- Grep results for `downloadQuestionsPdf` show only:
  - `src/apBoost/utils/generateQuestionsPdf.js` (definition)
  - Various `criteria_audit/*.md` files (documentation only)

### 6. What is the current route for gradebook (exact path), and do any teacher-prefixed routes exist? Are there links pointing to the old path?

**Answer:** Current route is `/ap/gradebook` (NOT teacher-prefixed). No `/ap/teacher/gradebook` route exists. Links in APTeacherDashboard correctly point to `/ap/gradebook`.

**Evidence:**
- File: `src/apBoost/routes.jsx` L91-98
```javascript
<Route
  path="/ap/gradebook"
  element={
    <PrivateRoute>
      <APGradebook />
    </PrivateRoute>
  }
/>
```
- File: `src/apBoost/pages/APTeacherDashboard.jsx` L227-231
```javascript
<QuickActionButton
  to="/ap/gradebook"
  icon="G"
  label="Gradebook"
/>
```
- File: `src/apBoost/pages/APTeacherDashboard.jsx` L286-291
```javascript
<Link
  to="/ap/gradebook"
  className="text-brand-primary text-sm hover:underline"
>
  Go to Gradebook
</Link>
```

### 7. Does `APGradebook.jsx` support opening a side panel based on URL params today? If not, what state drives the panel?

**Answer:** NO URL param support. Panel driven entirely by component state: `selectedResultId` and `isPanelOpen`. No `useParams` usage.

**Evidence:**
- File: `src/apBoost/pages/APGradebook.jsx` L1-7 (imports - no useParams)
```javascript
import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import APHeader from '../components/APHeader'
import GradingPanel from '../components/grading/GradingPanel'
import { getPendingGrades, getTestsForGrading, getTeacherClasses } from '../services/apGradingService'
import { GRADING_STATUS } from '../utils/apTypes'
import { logError } from '../utils/logError'
```
- File: `src/apBoost/pages/APGradebook.jsx` L121-122
```javascript
const [selectedResultId, setSelectedResultId] = useState(null)
const [isPanelOpen, setIsPanelOpen] = useState(false)
```

### 8. Does `/ap/teacher/test/new` exist in routes today? If missing, confirm where the dashboard links to it and how APTestEditor detects "new" mode.

**Answer:** Route does NOT exist. Dashboard links to it at L217. APTestEditor detects new mode via `testId === 'new'` at L207.

**Evidence:**
- File: `src/apBoost/routes.jsx` - NO route for `/ap/teacher/test/new` (full file reviewed)
- File: `src/apBoost/pages/APTeacherDashboard.jsx` L216-221
```javascript
<QuickActionButton
  to="/ap/teacher/test/new"
  icon="+"
  label="Create New Test"
  primary
/>
```
- File: `src/apBoost/pages/APTestEditor.jsx` L203, L207
```javascript
const { testId } = useParams()
// ...
const isNew = testId === 'new'
```

### 9. Is there any RoleProtectedRoute (or equivalent) already? If not, what does PrivateRoute currently check?

**Answer:** NO RoleProtectedRoute exists. PrivateRoute only checks `user` existence (authentication), NOT role.

**Evidence:**
- Glob search `**/RoleProtectedRoute*` returned: No files found
- File: `src/components/PrivateRoute.jsx` L4-20 (complete component)
```javascript
const PrivateRoute = ({ children }) => {
  const { user, initializing } = useAuth()

  if (initializing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-medium text-slate-600">Loading your workspace...</p>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
```

### 10. Where is `user.role` sourced (AuthContext)? What is the default role if missing?

**Answer:** Sourced from Firestore `users` collection. Default is `'student'` (both when userData.role is undefined and on fetch error).

**Evidence:**
- File: `src/contexts/AuthContext.jsx` L32-56
```javascript
const loadProfile = async () => {
  try {
    const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid))
    const userData = userSnap.exists() ? userSnap.data() : {}
    if (isMounted) {
      setUser({
        ...firebaseUser,
        role: userData.role ?? 'student',  // <-- default 'student'
        // ...
      })
    }
  } catch {
    if (isMounted) {
      setUser({
        ...firebaseUser,
        role: 'student',  // <-- default 'student' on error
      })
    }
  }
}
```

### 11. Does APQuestionBank have any role gating (route-level or component-level)? If yes, what roles are allowed?

**Answer:** NO role gating. Route uses generic PrivateRoute (auth only). Component has no role checks.

**Evidence:**
- File: `src/apBoost/routes.jsx` L75-82
```javascript
<Route
  path="/ap/teacher/questions"
  element={
    <PrivateRoute>
      <APQuestionBank />
    </PrivateRoute>
  }
/>
```
- File: `src/apBoost/pages/APQuestionBank.jsx` - Full file reviewed, no `user.role` checks

### 12. Do class CRUD services/pages already exist anywhere? If partially present, list what exists and what is NOT FOUND.

**Answer:** PARTIAL. Read functions exist; Create/Update/Delete do NOT exist. No class management pages exist.

**EXISTS:**
- `getTeacherClasses(teacherId)` - `src/apBoost/services/apTeacherService.js` L160-178
- `getClassStudents(classId)` - `src/apBoost/services/apTeacherService.js` L185-223

**NOT FOUND:**
- `createClass` function
- `updateClass` function
- `deleteClass` function
- `addStudentsToClass` function
- `removeStudentFromClass` function
- `/ap/teacher/classes` route
- `/ap/teacher/class/:classId` route
- `APClassManager` page component

**Evidence:**
- File: `src/apBoost/services/apTeacherService.js` - Complete file reviewed (381 lines), only exports listed functions
- Grep `createClass|deleteClass|updateClass` in `src/apBoost` - Only found in audit markdown files
- Grep `/ap/teacher/class` in `src/apBoost` - Only found in audit markdown files

---

## Summary of Key Findings

| Feature | Status | Notes |
|---------|--------|-------|
| Report PDF download button | ❌ NOT WIRED | Utility exists, not imported in APReportCard |
| Questions PDF export UI | ❌ NOT WIRED | Utility exists, not used anywhere |
| ScoreRangesEditor | ✅ WORKING | Rendered and saved correctly |
| isPublic toggle | ❌ MISSING | Field exists in DB, no UI to set it |
| RoleProtectedRoute | ❌ NOT FOUND | Only auth check, no role check |
| /ap/teacher/test/new route | ❌ MISSING | Links exist but route undefined |
| /ap/test/:testId/review route | ❌ N/A | Review is internal state, not route |
| Gradebook deep linking | ❌ NOT IMPLEMENTED | Panel state-driven only |
| Class CRUD services | ⚠️ PARTIAL | Read exists; CUD missing |
| Class management pages | ❌ NOT FOUND | No routes or pages |
| Student profile page | ❌ NOT FOUND | Link exists in Analytics, route missing |
