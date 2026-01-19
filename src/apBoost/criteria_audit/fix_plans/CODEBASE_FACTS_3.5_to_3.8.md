# CODEBASE FACTS: Sections 3.5 to 3.8

**Generated:** 2026-01-14
**Inspected by:** Claude Repo Inspector
**Purpose:** Ground-truth codebase facts for fix plan validation

---

## 1) Canonical Data Schema / Source-of-Truth

**Found: Yes**

### Collection Names (from COLLECTIONS constant)

- Evidence: `src/apBoost/utils/apTypes.js:L90-L98`
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

### FRQ Result Document Schema (ap_test_results)

- Evidence: `src/apBoost/services/apScoringService.js:L127-L154`
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
  // FRQ submission data
  frqSubmissionType: frqData?.frqSubmissionType || null,
  frqUploadedFiles: frqData?.frqUploadedFiles || null,  // <-- ARRAY, NOT frqUploadUrl
  frqAnswers: session.answers || {},
  frqMaxPoints: 0,
  frqScore: null,
  annotatedPdfUrl: null,  // <-- NOT frqGradedPdfUrl
  frqGrades: null,
  gradingStatus,
  startedAt: session.startedAt,
  completedAt: serverTimestamp(),
  gradedAt: null,
}
```

**Key Findings:**
- **`frqUploadedFiles`** (array/object) is used, NOT `frqUploadUrl` (string)
- **`annotatedPdfUrl`** is used, NOT `frqGradedPdfUrl`
- No read fallback or aliasing exists for either field
- These are intentional naming choices, not bugs

### Classes Collection Schema (ap_classes)

- **Found: Partial** - No `createClass` function exists. Schema inferred from read patterns.

- Evidence: `src/apBoost/services/apTeacherService.js:L160-L178`
```javascript
export async function getTeacherClasses(teacherId) {
  const classesRef = collection(db, COLLECTIONS.CLASSES)
  const q = query(
    classesRef,
    where('teacherId', '==', teacherId),
    orderBy('name', 'asc')
  )
  // ...
}
```

- Evidence: `src/apBoost/services/apTeacherService.js:L185-L195`
```javascript
export async function getClassStudents(classId) {
  // ...
  const classData = classSnap.data()
  const studentIds = classData.studentIds || []
  // ...
}
```

**Inferred Class Schema Fields:**
- `teacherId` - required (queried)
- `name` - required (ordered by)
- `studentIds` - array of user IDs
- `period` - optional (displayed in AssignTestModal)
- `createdAt` - **NOT CONFIRMED** - no write function exists
- `updatedAt` - **NOT CONFIRMED** - no write function exists
- `subject` - **NOT FOUND** in any code

### Assignments Collection Schema (ap_assignments)

- Evidence: `src/apBoost/services/apTeacherService.js:L230-L251`
```javascript
export async function createAssignment(assignmentData) {
  const newAssignment = {
    testId: assignmentData.testId,
    classIds: assignmentData.classIds || [],      // <-- USES classIds (PLURAL)
    studentIds: assignmentData.studentIds || [],
    dueDate: assignmentData.dueDate || null,
    maxAttempts: assignmentData.maxAttempts || 1, // <-- DEFAULT IS 1, not 3
    frqSubmissionType: assignmentData.frqSubmissionType || 'TYPED',
    assignedBy: assignmentData.assignedBy,
    assignedAt: serverTimestamp(),
  }
  const docRef = await addDoc(assignmentsRef, newAssignment)
  return docRef.id
}
```

**Key Findings:**
- Uses `classIds` (array), NOT `classId` (singular)
- Uses `studentIds` for denormalized student list
- `maxAttempts` defaults to `1` in service (line 239)
- `maxAttempts` defaults to `1` in UI (AssignTestModal line 48)

### Session State Schema (ap_session_state)

- Evidence: `src/apBoost/services/apSessionService.js:L47-L67`
```javascript
const sessionData = {
  userId,
  testId,
  assignmentId,  // <-- Links to assignment, used for access control
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

### FRQ Submission Data Write Path

| Function | File | Operation | Fields Written |
|----------|------|-----------|----------------|
| `createTestResult` | `apScoringService.js:L67-L161` | `setDoc` | `frqSubmissionType`, `frqUploadedFiles`, `annotatedPdfUrl` (initialized to null) |

- Evidence: `src/apBoost/services/apScoringService.js:L143-L148`
```javascript
frqSubmissionType: frqData?.frqSubmissionType || null,
frqUploadedFiles: frqData?.frqUploadedFiles || null,
frqAnswers: session.answers || {},
frqMaxPoints: 0,
frqScore: null,
annotatedPdfUrl: null,
```

### Grading/Annotated PDF Write Path

| Function | File | Operation | Fields Written |
|----------|------|-----------|----------------|
| `saveGrade` | `apGradingService.js:L165-L206` | `updateDoc` | `frqGrades`, `gradingStatus`, `gradedBy`, `gradedAt`, `annotatedPdfUrl` (conditional), `frqScore`, `score`, `maxScore`, `percentage`, `apScore` |

- Evidence: `src/apBoost/services/apGradingService.js:L165-L179`
```javascript
export async function saveGrade(resultId, grades, status, teacherId, annotatedPdfUrl = null) {
  const updateData = {
    frqGrades: grades,
    gradingStatus: status,
    gradedBy: teacherId,
    gradedAt: serverTimestamp(),
  }

  if (annotatedPdfUrl) {
    updateData.annotatedPdfUrl = annotatedPdfUrl  // <-- Writes annotatedPdfUrl
  }
  // ...
}
```

### Class Creation Write Path

**NOT FOUND** - No `createClass` function exists in `apTeacherService.js`

- Evidence: Searched entire `src/apBoost` directory for `createClass`:
```
$ grep -rn "createClass" src/apBoost/services/
# No results in service files
```

- Evidence: `src/apBoost/services/apTeacherService.js` exports:
  - `getTeacherClasses` (read only)
  - `getClassStudents` (read only)
  - NO `createClass`, `updateClass`, or `deleteClass`

### Assignment Creation Write Path

| Function | File | Operation | Fields Written |
|----------|------|-----------|----------------|
| `createAssignment` | `apTeacherService.js:L230-L251` | `addDoc` | `testId`, `classIds`, `studentIds`, `dueDate`, `maxAttempts`, `frqSubmissionType`, `assignedBy`, `assignedAt` |

- Evidence: shown in Section 1 above

### Session Creation/Resume Write Path

| Function | File | Operation | Fields Written |
|----------|------|-----------|----------------|
| `createOrResumeSession` | `apSessionService.js:L30-L76` | `setDoc` | Full session state document |

- Evidence: `src/apBoost/services/apSessionService.js:L30-L76`
```javascript
export async function createOrResumeSession(testId, userId, assignmentId = null) {
  // Check for existing active session first
  const existingSession = await getActiveSession(testId, userId)
  if (existingSession) {
    return existingSession  // <-- Returns existing, no new creation
  }

  // Create new session
  await setDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), sessionData)
  return { id: sessionId, ...sessionData }
}
```

**Access Control Note:**
- `createOrResumeSession` does NOT validate assignment membership
- It only passes `assignmentId` through if provided
- No call to `getAssignment` or assignment validation within this function

### Server-Side Write Paths (Cloud Functions)

- Evidence: `functions/index.js` - Only contains `gradeTypedTest` for vocabulary grading
- **NO AP-specific Cloud Functions found**
- All AP writes are client-side Firestore operations

---

## 3) Offline/Resilience Mechanics

**Found: Yes (Limited)**

### Offline Queue Implementation

- Evidence: `src/apBoost/hooks/useTestSession.js:L50`
```javascript
const { addToQueue, flushQueue, queueLength, isOnline, isFlushing } = useOfflineQueue(session?.id)
```

- Evidence: `src/apBoost/hooks/useOfflineQueue.js` (exists but not read in this inspection)

**Behavior:**
- Uses `addToQueue` for answer changes, navigation, timer sync, flag toggles
- `flushQueue` called before test submission (`submitTest`, line 406-408)
- Queue is per-session, not per-collection
- Does NOT appear to affect `frqUploadedFiles` or `annotatedPdfUrl` fields (these are set directly)

### No Conflict Resolution Found

- No idempotency keys or `lastModified` timestamps for FRQ fields
- No retry logic specific to the AP module (uses parent service retry from `db.js`)

---

## 4) UI/Flow Entry Points

**Found: Yes**

### FRQ Upload UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `APTestSession` | `pages/APTestSession.jsx` | Hosts FRQ choice flow |
| `FRQHandwrittenMode` | `components/FRQHandwrittenMode.jsx` (imported L15) | Upload handwritten files |

- Evidence: `src/apBoost/pages/APTestSession.jsx:L182-L192`
```javascript
const handleSubmit = async () => {
  const frqData = frqSubmissionType === FRQ_SUBMISSION_TYPE.HANDWRITTEN
    ? { frqSubmissionType, frqUploadedFiles: uploadedFiles }  // <-- passes frqUploadedFiles
    : { frqSubmissionType: FRQ_SUBMISSION_TYPE.TYPED }

  const resultId = await submitTest(frqData)
  // ...
}
```

### Grading UI - Annotated PDF Upload

| Component | File | Purpose |
|-----------|------|---------|
| `GradingPanel` | `components/grading/GradingPanel.jsx` | Teacher grading with PDF upload |

- Evidence: `src/apBoost/components/grading/GradingPanel.jsx:L250,L267,L305`
```javascript
const [annotatedPdfUrl, setAnnotatedPdfUrl] = useState(null)
// ...
setAnnotatedPdfUrl(data.annotatedPdfUrl || null)  // Load existing
// ...
await saveGrade(resultId, grades, GRADING_STATUS.COMPLETE, teacherId, annotatedPdfUrl)
```

### Class Management UI

**NOT FOUND** - No dedicated class management page exists

- Evidence: `src/apBoost/routes.jsx` - No route matching `/ap/teacher/class*`
- Evidence: `src/apBoost/components/teacher/` contains only `AssignTestModal.jsx`
- Evidence: `src/apBoost/pages/` - No `APClassManager.jsx` or similar

Classes are displayed but not created/edited:
- `APTeacherDashboard` sidebar displays classes
- `AssignTestModal` lists classes for assignment selection
- No create/edit/delete class functionality

### Assignment Flow UI

| Component | File | Purpose |
|-----------|------|---------|
| `AssignTestModal` | `components/teacher/AssignTestModal.jsx` | Create test assignments |

- Evidence: `src/apBoost/components/teacher/AssignTestModal.jsx:L48`
```javascript
const [maxAttempts, setMaxAttempts] = useState(1)  // <-- Defaults to 1
```

- Evidence: `src/apBoost/components/teacher/AssignTestModal.jsx:L110-L118`
```javascript
const assignmentData = {
  testId: test.id,
  classIds: Array.from(selectedClassIds),  // <-- Uses classIds (plural)
  studentIds: Array.from(allStudentIds),
  dueDate: dueDate ? new Date(dueDate) : null,
  maxAttempts,  // <-- From state, default 1
  // ...
}
```

### Test Start Flow - Routing & Access Control

| Route | Component | Guard |
|-------|-----------|-------|
| `/ap/test/:testId` | `APTestSession` | `PrivateRoute` (auth only) |
| `/ap/test/:testId/assignment/:assignmentId` | `APTestSession` | `PrivateRoute` (auth only) |

- Evidence: `src/apBoost/routes.jsx:L25-L40`
```jsx
<Route
  path="/ap/test/:testId"
  element={
    <PrivateRoute>
      <APTestSession />
    </PrivateRoute>
  }
/>
<Route
  path="/ap/test/:testId/assignment/:assignmentId"
  element={
    <PrivateRoute>
      <APTestSession />
    </PrivateRoute>
  }
/>
```

**Access Control Analysis:**

1. **Route-level guard:** Only `PrivateRoute` (authentication check)
2. **No role check:** Teacher/student not distinguished at route level
3. **No assignment membership check:** User can navigate directly to any testId

- Evidence: `src/apBoost/hooks/useTestSession.js:L160-L206`
```javascript
async function loadTestAndSession() {
  // Load test with questions
  const testData = await getTestWithQuestions(testId)  // <-- No access check
  // ...
  // Check for existing session
  const existingSession = await getActiveSession(testId, user.uid)
  // ...
}
```

- Evidence: `src/apBoost/services/apSessionService.js:L30-L76`
```javascript
export async function createOrResumeSession(testId, userId, assignmentId = null) {
  // NO assignment membership validation
  // Just creates session if none exists
}
```

**Gap:** Direct URL navigation to `/ap/test/:testId` can bypass dashboard filtering. The `getAvailableTests` function filters by assignment, but nothing prevents direct navigation.

---

## 5) Must-Answer Questions

### Q1: Where is the canonical shape of an FRQ submission/result document defined?

**Answer:** `src/apBoost/services/apScoringService.js:L127-L154` (createTestResult function)

**Fields for uploaded student work:**
- `frqUploadedFiles` (array/object) - **YES, this is written**
- `frqUploadUrl` - **NOT USED anywhere in code**

Evidence: `src/apBoost/services/apScoringService.js:L144`
```javascript
frqUploadedFiles: frqData?.frqUploadedFiles || null,
```

### Q2: Where is the teacher's annotated/graded PDF URL stored and updated?

**Answer:** `src/apBoost/services/apGradingService.js:L165-L179` (saveGrade function)

**Field name used:** `annotatedPdfUrl` - **NOT `frqGradedPdfUrl`**

**No read fallback/aliasing exists.** The field is read directly:
- `GradingPanel.jsx:L267` - `setAnnotatedPdfUrl(data.annotatedPdfUrl || null)`
- `APReportCard.jsx:L355` - `const annotatedPdfUrl = result?.annotatedPdfUrl`

### Q3: Do any UI components or report views read these fields?

**Answer:** Yes

| Field | File | Line | Usage |
|-------|------|------|-------|
| `frqUploadedFiles` | `pages/APReportCard.jsx` | L354 | `const uploadedFiles = result?.frqUploadedFiles \|\| []` |
| `frqUploadedFiles` | `components/grading/GradingPanel.jsx` | L345 | `const uploadedFiles = result?.frqUploadedFiles \|\| []` |
| `annotatedPdfUrl` | `pages/APReportCard.jsx` | L355 | `const annotatedPdfUrl = result?.annotatedPdfUrl` |
| `annotatedPdfUrl` | `pages/APReportCard.jsx` | L206,L236,L246,L474 | Passed to HandwrittenFilesSection |
| `annotatedPdfUrl` | `components/grading/GradingPanel.jsx` | L250,L267,L305,L427,L431 | State and display |
| `frqUploadUrl` | **NOWHERE** | N/A | Not used in any code |
| `frqGradedPdfUrl` | **NOWHERE** | N/A | Not used in any code |

### Q4: Is there any function that creates classes?

**Answer:** NOT FOUND

- No `createClass` function exists in `apTeacherService.js`
- No class creation UI exists
- Only `getTeacherClasses` (read) and `getClassStudents` (read) exist

**Nearest related functionality:**
- `apTeacherService.js:L160-L178` - `getTeacherClasses(teacherId)` reads existing classes
- `apTeacherService.js:L185-L223` - `getClassStudents(classId)` reads students in a class

**Evidence of absence:** Full function exports from `apTeacherService.js`:
- `getTeacherTests`, `createTest`, `updateTest`, `deleteTest`, `getTestById`
- `getTeacherClasses`, `getClassStudents`
- `createAssignment`, `getTestAssignments`
- `getPendingGradingCount`, `getPendingGradingList`
- `publishTest`, `unpublishTest`
- **NO class write functions**

### Q5: For assignments, is `classIds` the only persisted field or does `classId` exist?

**Answer:** `classIds` (plural, array) is the ONLY field used

**Write location:** `src/apBoost/services/apTeacherService.js:L236`
```javascript
classIds: assignmentData.classIds || [],
```

**Read locations:**
- NOT directly queried (assignments are looked up by `testId` and `studentIds`)
- `studentIds` is the denormalized list used for filtering

**`classId` singular is NOT used in assignments.** It IS used in:
- `ap_test_results` schema (single classId for the result)
- `ap_session_state` schema (session.classId)
- Grading filter queries

### Q6: What is the default for `maxAttempts` in BOTH UI and service?

**Answer:** Default is `1` in BOTH places

**UI default:** `src/apBoost/components/teacher/AssignTestModal.jsx:L48`
```javascript
const [maxAttempts, setMaxAttempts] = useState(1)
```

**Service default:** `src/apBoost/services/apTeacherService.js:L239`
```javascript
maxAttempts: assignmentData.maxAttempts || 1,
```

**No normalization for "0":** The `|| 1` fallback would treat `0` as falsy and default to `1`.

### Q7: Is student access control enforced when calling `createOrResumeSession`?

**Answer:** NO - not enforced in `createOrResumeSession`

**Client-side gating:** Only `getAvailableTests` filters by assignment
- Evidence: `src/apBoost/services/apTestService.js:L41-L44`
```javascript
const assignmentsQuery = query(
  collection(db, COLLECTIONS.ASSIGNMENTS),
  where('studentIds', 'array-contains', userId)
)
```

**Direct URL bypass is possible:**
- Routes `/ap/test/:testId` and `/ap/test/:testId/assignment/:assignmentId` only check authentication
- `useTestSession` hook calls `getTestWithQuestions(testId)` without assignment check
- `createOrResumeSession` accepts any `testId` and `userId` combination

**Evidence:** `src/apBoost/hooks/useTestSession.js:L168-L173`
```javascript
// Load test with questions
const testData = await getTestWithQuestions(testId)  // <-- No assignment check
if (!testData) {
  throw new Error('Test not found')
}
setTest(testData)
```

### Q8: Are there Firestore Security Rules enforcing assignment membership?

**Answer:** NO - No AP-specific rules exist

**Evidence:** `firestore.rules` (full file reviewed)
- Rules exist for: `users`, `classes`, `lists`, `attempts`, `system_logs`
- NO rules for: `ap_tests`, `ap_questions`, `ap_stimuli`, `ap_session_state`, `ap_test_results`, `ap_classes`, `ap_assignments`

**AP collections have NO security rules defined.** Default behavior is deny all (unless a parent match exists, which doesn't apply here).

### Q9: What composite indexes are defined in `firestore.indexes.json`?

**Answer:** Only indexes for `attempts` collection (VocaBoost, not AP)

**Evidence:** `firestore.indexes.json:L1-L37`
```json
{
  "indexes": [
    {
      "collectionGroup": "attempts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "teacherId", "order": "ASCENDING" },
        { "fieldPath": "submittedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "attempts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "teacherId", "order": "ASCENDING" },
        { "fieldPath": "classId", "order": "ASCENDING" },
        { "fieldPath": "submittedAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

**NO AP indexes defined.** The following queries may fail or be slow:

| Service | Query Pattern | Needs Index? |
|---------|---------------|--------------|
| `apTeacherService.getTeacherTests` | `where('createdBy') + orderBy('createdAt')` | YES |
| `apTeacherService.getTeacherClasses` | `where('teacherId') + orderBy('name')` | YES |
| `apTeacherService.getTestAssignments` | `where('testId') + orderBy('assignedAt')` | YES |
| `apGradingService.getPendingGrades` | `where('gradingStatus') + where('testId') + orderBy('completedAt')` | YES |
| `apSessionService.getActiveSession` | `where('testId') + where('userId') + where('status')` | YES |
| `apQuestionService.getQuestions` | Multiple where + orderBy | YES |

### Q10: Are there runtime "missing index" error handlers?

**Answer:** NOT FOUND

- No `failed-precondition` catch blocks in AP services
- No FirebaseError type checking in AP services
- Errors are logged generically via `logError` utility

**Evidence:** Search result for "failed-precondition" in `src/apBoost/`:
```
# Only found in fix plan documentation, not in actual code
```

---

## Summary of Critical Gaps

1. **Field Naming:** Uses `frqUploadedFiles` and `annotatedPdfUrl` instead of spec's `frqUploadUrl` and `frqGradedPdfUrl`

2. **No Class Creation:** `createClass` function missing; no UI for class management

3. **maxAttempts Default:** Defaults to `1`, spec says `3`

4. **No Assignment Access Control:** Direct URL navigation can bypass dashboard filtering; no server-side enforcement

5. **No Firestore Rules for AP:** All AP collections lack security rules

6. **No Composite Indexes for AP:** Query patterns may fail without proper indexes
