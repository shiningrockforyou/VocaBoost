# CODEBASE_FACTS__11__11.1_to_11.5

**Generated:** 2026-01-14
**Inspector:** Claude Agent
**Chunk ID:** 11__11.1_to_11.5

---

## 1) Canonical Data Schema / Source-of-Truth

Found: **Yes**

### Firestore Collections
- **Tests:** `ap_tests`
- **Questions:** `ap_questions`
- **Classes:** `ap_classes`
- **Assignments:** `ap_assignments`
- **Test Results:** `ap_test_results`
- **Session State:** `ap_session_state`
- **Stimuli:** `ap_stimuli`

### Test Document Schema (sections and question ordering)
- Tests contain an embedded `sections` array
- Each section has a `questionIds` array storing ordered question IDs as strings
- Section structure: `{ title, sectionType, timeLimit, multiplier, questionIds: string[] }`

### Class Document Schema
- Contains `studentIds` array of user IDs
- Contains `teacherId` field
- Contains `name` and optional `period` fields

### Assignment Document Schema
- Fields: `testId`, `classIds[]`, `studentIds[]`, `dueDate`, `maxAttempts`, `frqSubmissionType`, `assignedBy`, `assignedAt`

### Evidence:

**`src/apBoost/utils/apTypes.js:89-98`**
```javascript
// Collection names
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

**`src/apBoost/pages/APTestEditor.jsx:267-278`** (Section structure in handleAddSection)
```javascript
const handleAddSection = () => {
  setSections([
    ...sections,
    {
      title: `Section ${sections.length + 1}`,
      sectionType: SECTION_TYPE.MCQ,
      timeLimit: 45,
      multiplier: 1.0,
      questionIds: [],
    }
  ])
}
```

**`src/apBoost/services/apTeacherService.js:193-196`** (Class studentIds structure)
```javascript
const classData = classSnap.data()
const studentIds = classData.studentIds || []
```

---

## 2) Write Paths

Found: **Yes**

### 2.1 Question Reorder Within Section
- **Function:** `reorderSectionQuestions(testId, sectionIndex, newOrder)`
- **Location:** `src/apBoost/services/apQuestionService.js:317-346`
- **Write Method:** `updateDoc` (no transaction/batch)
- **Target:** Entire `sections` array is rewritten
- **Import Status:** Imported in APTestEditor.jsx but **NEVER CALLED**

**Evidence - `src/apBoost/services/apQuestionService.js:317-346`:**
```javascript
export async function reorderSectionQuestions(testId, sectionIndex, newOrder) {
  try {
    const testRef = doc(db, COLLECTIONS.TESTS, testId)
    const testSnap = await getDoc(testRef)

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
    section.questionIds = newOrder
    sections[sectionIndex] = section

    await updateDoc(testRef, {
      sections,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    logError('apQuestionService.reorderSectionQuestions', { testId, sectionIndex }, error)
    throw error
  }
}
```

**Evidence - `src/apBoost/pages/APTestEditor.jsx:6`:** (Import but unused)
```javascript
import { getQuestionsByIds, removeQuestionFromSection, reorderSectionQuestions } from '../services/apQuestionService'
```

### 2.2 Section Reorder
- **Handler:** `handleMoveSection(index, direction)`
- **Location:** `src/apBoost/pages/APTestEditor.jsx:294-304`
- **Write Method:** Local state only (`setSections`) - **NOT immediately persisted**
- **Persistence:** Only when test is saved via `handleSave()`

**Evidence - `src/apBoost/pages/APTestEditor.jsx:294-304`:**
```javascript
const handleMoveSection = (index, direction) => {
  const newIndex = direction === 'up' ? index - 1 : index + 1
  if (newIndex < 0 || newIndex >= sections.length) return

  const newSections = [...sections]
  const temp = newSections[index]
  newSections[index] = newSections[newIndex]
  newSections[newIndex] = temp
  setSections(newSections)
}
```

### 2.3 Add Questions to Section
- **Function:** `addQuestionsToSection(testId, sectionIndex, questionIds)`
- **Location:** `src/apBoost/services/apQuestionService.js:240-270`
- **Write Method:** `updateDoc` - rewrites entire `sections` array
- **Concurrency:** Performs read-then-write (potential race condition)

**Evidence - `src/apBoost/services/apQuestionService.js:256-265`:**
```javascript
// Add questions to section
const section = { ...sections[sectionIndex] }
const existingIds = section.questionIds || []
section.questionIds = [...existingIds, ...questionIds]
sections[sectionIndex] = section

await updateDoc(testRef, {
  sections,
  updatedAt: serverTimestamp(),
})
```

### 2.4 Create Assignment (includes maxAttempts)
- **Function:** `createAssignment(assignmentData)`
- **Location:** `src/apBoost/services/apTeacherService.js:230-251`
- **Write Method:** `addDoc`
- **maxAttempts default:** Falls back to `1` if not provided

**Evidence - `src/apBoost/services/apTeacherService.js:234-245`:**
```javascript
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

### 2.5 Gradebook Data Fetch
- **Function:** `getPendingGrades(teacherId, filters)`
- **Location:** `src/apBoost/services/apGradingService.js:26-101`
- **Read Method:** `getDocs` (one-time fetch)
- **Real-time:** **NO** `onSnapshot` usage

**Evidence - `src/apBoost/services/apGradingService.js:54-55`:**
```javascript
const q = query(resultsRef, ...constraints)
const snapshot = await getDocs(q)
```

---

## 3) Offline/Resilience Mechanics

Found: **No**

Not applicable - No offline/resilience mechanics found in the inspected flows:
- Question editor reorder: No retry/offline handling
- Question bank add-to-test: No retry/offline handling
- Assign test: No retry/offline handling
- Gradebook: No caching/retry mechanism

Note: The project has `useOfflineQueue.js` hook but it is NOT used in the flows covered by this audit chunk.

---

## 4) UI/Flow Entry Points

Found: **Yes**

### Routes Configuration
- **Location:** `src/apBoost/routes.jsx`

| Route | Component | Description |
|-------|-----------|-------------|
| `/ap/teacher/test/:testId/edit` | APTestEditor | Test editor with sections |
| `/ap/teacher/questions` | APQuestionBank | Question bank (supports `?picker=true`) |
| `/ap/teacher/question/:questionId/edit` | APQuestionEditor | Question create/edit |
| `/ap/gradebook` | APGradebook | Teacher gradebook |
| `/ap/teacher/test/:testId/assign` | APAssignTest | Dedicated assignment page |

**Evidence - `src/apBoost/routes.jsx:59-98`:**
```jsx
<Route
  path="/ap/teacher/test/:testId/edit"
  element={
    <PrivateRoute>
      <APTestEditor />
    </PrivateRoute>
  }
/>
<Route
  path="/ap/teacher/questions"
  element={
    <PrivateRoute>
      <APQuestionBank />
    </PrivateRoute>
  }
/>
<Route
  path="/ap/gradebook"
  element={
    <PrivateRoute>
      <APGradebook />
    </PrivateRoute>
  }
/>
```

### AssignTestModal Entry Point
- **Invoked from:** APTeacherDashboard (inferred from import pattern)
- **Component:** `src/apBoost/components/teacher/AssignTestModal.jsx`

---

## 5) Must-Answer Questions (from checklist)

### Q1: What is the authoritative data shape for test sections and their question ordering?

**Conclusion:** Yes - Fully documented

- **Location:** Embedded `sections` array in test document
- **Ordering:** `sections[sectionIndex].questionIds` is an array of string IDs
- **Type:** `string[]` (array of question document IDs)
- **Order significance:** Array index determines display/execution order

**Evidence - `src/apBoost/pages/APTestEditor.jsx:340-344`:**
```javascript
const getSectionQuestions = (section) => {
  return (section.questionIds || [])
    .map(id => questionsCache[id])
    .filter(Boolean)
}
```

---

### Q2: How does `reorderSectionQuestions(testId, sectionIndex, newOrder)` persist ordering?

**Conclusion:** Yes - Fully documented

- **Collection:** `ap_tests`
- **Document:** Test document identified by `testId`
- **Field Path:** `sections` (entire array is rewritten)
- **Method:** `updateDoc` - no transaction or batch
- **Idempotency Risk:** Read-then-write pattern without transaction

**Evidence - `src/apBoost/services/apQuestionService.js:333-341`:**
```javascript
// Update question order
const section = { ...sections[sectionIndex] }
section.questionIds = newOrder
sections[sectionIndex] = section

await updateDoc(testRef, {
  sections,
  updatedAt: serverTimestamp(),
})
```

---

### Q3: Is there any existing UI control for question reordering in APTestEditor today?

**Conclusion:** **NO** - No UI controls exist

- Current question row only has "Edit" link and "Remove" button
- No up/down buttons for questions
- No drag handles
- `reorderSectionQuestions` is imported but never called from UI

**Evidence - `src/apBoost/pages/APTestEditor.jsx:112-139`:** (Question row rendering)
```jsx
{questions.map((question, idx) => (
  <div
    key={question.id}
    className="flex items-center justify-between py-2 px-3 bg-muted rounded-[--radius-sm]"
  >
    <div className="flex-1 min-w-0">
      <span className="text-text-muted text-sm mr-2">{idx + 1}.</span>
      <span className="text-text-primary text-sm truncate">
        {question.questionText?.substring(0, 60)}
        {question.questionText?.length > 60 ? '...' : ''}
      </span>
    </div>
    <div className="flex items-center gap-2 ml-2">
      <Link
        to={`/ap/teacher/question/${question.id}/edit`}
        className="text-brand-primary text-xs hover:underline"
      >
        Edit
      </Link>
      <button
        onClick={() => onRemoveQuestion(question.id)}
        className="text-error-text text-xs hover:underline"
      >
        Remove
      </button>
    </div>
  </div>
))}
```

---

### Q4: How are sections reordered today, and is the order persisted immediately?

**Conclusion:** Yes - Documented

- **UI Controls:** Up/down buttons (^ and v characters)
- **Handler:** `handleMoveSection(index, direction)`
- **Persistence:** **NOT IMMEDIATE** - Only local state update
- **When persisted:** On `handleSave()` call (Save Draft or Save and Publish)

**Evidence - `src/apBoost/pages/APTestEditor.jsx:42-57`:** (Section move buttons)
```jsx
<button
  onClick={() => onMoveSection('up')}
  disabled={!canMoveUp}
  className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
  title="Move up"
>
  <span className="text-lg">^</span>
</button>
<button
  onClick={() => onMoveSection('down')}
  disabled={!canMoveDown}
  className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
  title="Move down"
>
  <span className="text-lg">v</span>
</button>
```

---

### Q5: How does APQuestionBank determine the target test/section when adding questions?

**Conclusion:** Yes - Fully documented

- **Storage:** `sessionStorage` with key `'testEditor_state'`
- **Fields stored:**
  - `testId` (null for new test)
  - `title`, `subject`, `testType`
  - `sections` (array)
  - `scoreRanges`
  - `targetSectionIndex` (integer)
- **Picker Mode Flag:** URL query param `?picker=true`

**Evidence - `src/apBoost/pages/APTestEditor.jsx:306-318`:** (Write to sessionStorage)
```javascript
const handleAddQuestions = (sectionIndex) => {
  sessionStorage.setItem('testEditor_state', JSON.stringify({
    testId: isNew ? null : testId,
    title,
    subject,
    testType,
    sections,
    scoreRanges,
    targetSectionIndex: sectionIndex,
  }))
  navigate('/ap/teacher/questions?picker=true')
}
```

**Evidence - `src/apBoost/pages/APQuestionBank.jsx:294-305`:** (Read from sessionStorage)
```javascript
const savedState = sessionStorage.getItem('testEditor_state')
if (!savedState) {
  alert('No test editor state found. Please start from the test editor.')
  return
}

const state = JSON.parse(savedState)
const { testId, targetSectionIndex } = state
```

---

### Q6: Does any "test/section dropdown selector" already exist anywhere (e.g., TestSectionSelector)?

**Conclusion:** **NOT FOUND**

- No `TestSectionSelector` component exists in the codebase
- The component is only mentioned in the fix plan as a proposed new file
- Question Bank currently only works via sessionStorage picker-mode flow

**Search performed:**
- Grep for `TestSectionSelector` - only found in fix plan markdown files
- No component file at `src/apBoost/components/teacher/TestSectionSelector.jsx`

---

### Q7: In AssignTestModal, how are students selected today?

**Conclusion:** Yes - Documented

- **Selection Method:** By class only (class checkboxes)
- **Student IDs Source:** `cls.studentIds` array from class documents
- **No individual student selection:** No search/add for individual students
- **Aggregation:** All studentIds from selected classes are combined

**Evidence - `src/apBoost/components/teacher/AssignTestModal.jsx:102-108`:**
```javascript
// Collect all student IDs from selected classes
const allStudentIds = new Set()
classes.forEach(cls => {
  if (selectedClassIds.has(cls.id)) {
    (cls.studentIds || []).forEach(id => allStudentIds.add(id))
  }
})
```

**Evidence - `src/apBoost/components/teacher/AssignTestModal.jsx:9-31`:** (ClassCheckbox component)
```jsx
function ClassCheckbox({ cls, checked, onChange }) {
  const studentCount = cls.studentIds?.length || 0

  return (
    <label className="flex items-center gap-3 py-2 px-3 rounded-[--radius-sm] hover:bg-hover cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        ...
      />
      ...
    </label>
  )
}
```

---

### Q8: Is there any existing student search function/service today?

**Conclusion:** **NOT FOUND**

- No `searchStudents` function exists in any service file
- No `searchUsers` function exists
- The `users` collection is queried only by individual ID (`getDoc`)
- Grep for `searchStudents` found only fix plan proposals

**Evidence - `src/apBoost/services/apTeacherService.js:201-216`:** (Individual student fetch only)
```javascript
// Fetch student details
const students = []
for (const studentId of studentIds) {
  try {
    const userRef = doc(db, 'users', studentId)
    const userSnap = await getDoc(userRef)
    if (userSnap.exists()) {
      students.push({
        id: userSnap.id,
        ...userSnap.data()
      })
    }
  } catch {
    // Skip students that can't be fetched
  }
}
```

---

### Q9: Where is `maxAttempts` set for assignments, and what defaults/fallbacks exist?

**Conclusion:** Yes - Fully documented

| Location | Default Value | Evidence |
|----------|---------------|----------|
| UI State (AssignTestModal) | `1` | Line 48 |
| Service fallback (createAssignment) | `1` | Line 239 |

**Evidence - `src/apBoost/components/teacher/AssignTestModal.jsx:48`:** (UI default)
```javascript
const [maxAttempts, setMaxAttempts] = useState(1)
```

**Evidence - `src/apBoost/services/apTeacherService.js:239`:** (Service fallback)
```javascript
maxAttempts: assignmentData.maxAttempts || 1,
```

**Note:** The fix plan mentions changing default to `3`, but current implementation uses `1`.

---

### Q10: Does APGradebook currently use one-time fetch or real-time listeners?

**Conclusion:** Yes - Documented as **ONE-TIME FETCH ONLY**

- **Current implementation:** Uses `getDocs` (one-time fetch)
- **Real-time listeners:** **NO `onSnapshot` usage** in APGradebook or apGradingService
- **Refresh mechanism:** Manual refresh via `handleSave()` callback

**Evidence - `src/apBoost/pages/APGradebook.jsx:145-179`:** (loadResults effect)
```javascript
useEffect(() => {
  async function loadResults() {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const filters = {}
      // ... filter setup ...

      const data = await getPendingGrades(user.uid, filters)
      setResults(data)
    } catch (err) {
      logError('APGradebook.loadResults', { userId: user?.uid }, err)
      setError(err.message || 'Failed to load gradebook')
    } finally {
      setLoading(false)
    }
  }

  loadResults()
}, [user, statusFilter, testFilter, classFilter])
```

**Evidence - `src/apBoost/services/apGradingService.js:1-18`:** (No onSnapshot import)
```javascript
import { db } from '../../firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
```

**Grep confirmation:** No source files in `src/apBoost/**/*.{js,jsx}` contain `onSnapshot` usage.

---

## Summary Table

| Feature | Current State | Missing/Gap |
|---------|---------------|-------------|
| Question reorder within section | Service exists, UI missing | Need up/down buttons or drag-and-drop |
| Section reorder | Works (up/down buttons) | Consider drag-and-drop |
| Question Bank target selector | sessionStorage picker-mode | Consider dropdown selector |
| Individual student selection | Not implemented | Need search UI + service |
| maxAttempts default | Defaults to 1 | Consider changing to 3 |
| Gradebook real-time updates | One-time getDocs | Need onSnapshot listener |
| Drag-and-drop library | Not installed | Would need @dnd-kit or similar |

---

## Package.json Dependencies (relevant)

No drag-and-drop libraries installed:
- `@dnd-kit/core` - **NOT FOUND**
- `@dnd-kit/sortable` - **NOT FOUND**
- `react-beautiful-dnd` - **NOT FOUND**

**Evidence - `package.json:13-28`:** (dependencies section)
```json
"dependencies": {
  "@tailwindcss/postcss": "^4.1.17",
  "autoprefixer": "^10.4.22",
  "dotenv": "^17.2.3",
  "firebase": "^12.6.0",
  "firebase-admin": "^13.6.0",
  "jspdf": "^3.0.4",
  "jspdf-autotable": "^5.0.2",
  "lucide-react": "^0.556.0",
  "postcss": "^8.5.6",
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-router-dom": "^7.9.6",
  "tailwindcss": "^4.1.17",
  "xlsx": "^0.18.5"
}
```
