# Fix Plan: Sections 3.5 to 3.8

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_3.5_to_3.8_criteria_audit.md

## Executive Summary
- Total Issues: 15
- ⚠️ Partial Implementations: 6
- ❌ Missing Features: 9 (1 access control + 8 index groups)
- ❓ Needs Investigation: 0
- Estimated Complexity: Medium

---

## Issue 1: frqUploadUrl Field Name Mismatch

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** `frqUploadUrl` for student's scanned answer
- **Current State:** Uses `frqUploadedFiles` (array/object) instead of `frqUploadUrl` (string)

### Code Analysis
- **Relevant Files:**
  - [apScoringService.js:144](src/apBoost/services/apScoringService.js#L144) - stores frqUploadedFiles
  - [apScoringService.js:64](src/apBoost/services/apScoringService.js#L64) - JSDoc mentions frqUploadedFiles
- **Current Implementation:**
  ```javascript
  frqUploadedFiles: frqData?.frqUploadedFiles || null,
  ```
  The implementation stores uploaded files as an array/object, allowing multiple file uploads per submission.
- **Gap:** Spec requires single URL string `frqUploadUrl`, implementation uses array `frqUploadedFiles`
- **Dependencies:**
  - FRQ upload components that create the `frqData` object
  - Any grading UI that reads uploaded files for review

### Fix Plan

#### Option A: Rename to Match Spec (Breaking Change)
**File:** `src/apBoost/services/apScoringService.js`
**Action:** Modify field name
**Details:**
- Line 144: Change `frqUploadedFiles` to `frqUploadUrl`
- Line 64: Update JSDoc comment
- Requires migration of existing data if any exists

#### Option B: Document Deviation (Recommended)
**File:** Update acceptance criteria documentation
**Action:** Document that `frqUploadedFiles` is intentional deviation
**Details:**
- Multiple file uploads provide better UX for handwritten work
- Document that this is an intentional enhancement
- Update spec to reflect actual implementation

### Verification Steps
1. Search codebase for all usages of `frqUploadedFiles`
2. Verify grading UI reads the field correctly
3. Test FRQ upload flow end-to-end

### Potential Risks
- If renaming: Breaking change for any existing test results with uploaded files
- Mitigation: Run migration script or support both field names during transition

---

## Issue 2: frqGradedPdfUrl Field Name Mismatch

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** `frqGradedPdfUrl` for teacher's annotated PDF
- **Current State:** Uses `annotatedPdfUrl` instead of `frqGradedPdfUrl`

### Code Analysis
- **Relevant Files:**
  - [apScoringService.js:148](src/apBoost/services/apScoringService.js#L148) - initializes as null
  - [apGradingService.js:162](src/apBoost/services/apGradingService.js#L162) - parameter name
  - [apGradingService.js:177-178](src/apBoost/services/apGradingService.js#L177-L178) - updates field
- **Current Implementation:**
  ```javascript
  // In apScoringService.js:148
  annotatedPdfUrl: null, // Teacher's annotated PDF

  // In apGradingService.js:177-178
  if (annotatedPdfUrl) {
    updateData.annotatedPdfUrl = annotatedPdfUrl
  }
  ```
- **Gap:** Field named `annotatedPdfUrl` instead of spec's `frqGradedPdfUrl`
- **Dependencies:**
  - Grading UI components that display annotated PDFs
  - Student report card that shows graded feedback

### Fix Plan

#### Option A: Rename to Match Spec (Breaking Change)
**File:** `src/apBoost/services/apScoringService.js`
**Action:** Modify field initialization
**Details:**
- Line 148: Change `annotatedPdfUrl: null` to `frqGradedPdfUrl: null`
- Remove the comment (field name is now self-documenting)

**File:** `src/apBoost/services/apGradingService.js`
**Action:** Update parameter and field references
**Details:**
- Line 162: Change parameter `annotatedPdfUrl` to `frqGradedPdfUrl`
- Line 177-178: Update field name in updateData

#### Option B: Document Deviation (Simpler)
**Action:** Update acceptance criteria documentation
**Details:**
- `annotatedPdfUrl` is semantically equivalent
- Document as intentional naming choice

### Verification Steps
1. Search for all usages of `annotatedPdfUrl`
2. Update grading UI if it reads this field
3. Test annotated PDF upload and retrieval flow

### Potential Risks
- Breaking change for existing graded results
- Mitigation: Add field alias or migration

---

## Issue 3: Class Subject Field Not Verified

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** `name, subject, teacherId` required fields
- **Current State:** `subject` field not explicitly handled in service layer

### Code Analysis
- **Relevant Files:**
  - [apTeacherService.js:160-178](src/apBoost/services/apTeacherService.js#L160-L178) - getTeacherClasses
- **Current Implementation:**
  ```javascript
  const q = query(
    classesRef,
    where('teacherId', '==', teacherId),
    orderBy('name', 'asc')
  )
  ```
  Queries by teacherId, orders by name. Subject field may exist in data but isn't used.
- **Gap:** No createClass function exists; subject field not set or validated
- **Dependencies:** Need class creation functionality

### Fix Plan

#### Step 1: Create createClass Function
**File:** `src/apBoost/services/apTeacherService.js`
**Action:** Add new function
**Details:**
- Add after getTeacherClasses function (around line 178)
- Follow pattern from createTest function (lines 52-76)

```javascript
/**
 * Create a new class
 * @param {Object} classData - Class configuration { name, subject, teacherId }
 * @returns {Promise<string>} Created class ID
 */
export async function createClass(classData) {
  try {
    const classesRef = collection(db, COLLECTIONS.CLASSES)

    const newClass = {
      name: classData.name,
      subject: classData.subject || '',
      teacherId: classData.teacherId,
      studentIds: classData.studentIds || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    const docRef = await addDoc(classesRef, newClass)
    return docRef.id
  } catch (error) {
    logError('apTeacherService.createClass', { classData }, error)
    throw error
  }
}
```

### Verification Steps
1. Test class creation with all required fields
2. Verify subject field is stored and retrievable
3. Test timestamps are properly set

### Potential Risks
- Low risk - adding new functionality
- Ensure UI exists to call this function

---

## Issue 4: Class createdAt/updatedAt Timestamps

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** `createdAt` and `updatedAt` timestamps
- **Current State:** No createClass function, timestamps can't be set

### Code Analysis
- **Relevant Files:**
  - [apTeacherService.js](src/apBoost/services/apTeacherService.js) - no class creation function
- **Current Implementation:** getTeacherClasses reads existing classes but no creation logic
- **Gap:** Class creation not implemented, so timestamps cannot be set
- **Dependencies:** Requires Issue 3 fix (createClass function)

### Fix Plan

#### Step 1: Included in Issue 3 Fix
**Details:**
- The createClass function in Issue 3 includes `createdAt` and `updatedAt` fields
- Both use `serverTimestamp()` for consistency

#### Step 2: Add updateClass Function (Optional)
**File:** `src/apBoost/services/apTeacherService.js`
**Action:** Add update function
**Details:**
```javascript
/**
 * Update a class
 * @param {string} classId - Class document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateClass(classId, updates) {
  try {
    const classRef = doc(db, COLLECTIONS.CLASSES, classId)
    await updateDoc(classRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    logError('apTeacherService.updateClass', { classId, updates }, error)
    throw error
  }
}
```

### Verification Steps
1. Test class creation sets both timestamps
2. Test class update modifies updatedAt only
3. Verify timestamps display correctly in UI

### Potential Risks
- Low risk - standard timestamp pattern

---

## Issue 5: Assignment classIds vs classId Schema Deviation

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** `testId` and `classId` references
- **Current State:** Uses `classIds` (array) instead of `classId` (string)

### Code Analysis
- **Relevant Files:**
  - [apTeacherService.js:236](src/apBoost/services/apTeacherService.js#L236) - stores classIds array
  - [AssignTestModal.jsx:112](src/apBoost/components/teacher/AssignTestModal.jsx#L112) - creates array from Set
- **Current Implementation:**
  ```javascript
  classIds: assignmentData.classIds || [],
  ```
- **Gap:** Spec says single `classId`, implementation uses `classIds` array
- **Dependencies:** This allows assigning one test to multiple classes at once - MORE flexible

### Fix Plan

#### Recommendation: Document as Enhancement
**Action:** Update acceptance criteria documentation
**Details:**
- Current implementation is MORE flexible than spec
- Allows single assignment record for multi-class assignments
- Reduces database writes and simplifies management
- Update spec to reflect `classIds: string[]` pattern

### Verification Steps
1. Verify queries work with array field
2. Ensure grading/reports handle multi-class assignments
3. Document the schema in data model docs

### Potential Risks
- None - current implementation is superior to spec

---

## Issue 6: maxAttempts Default Value

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** `maxAttempts (default: 3)`
- **Current State:** Defaults to 1, not 3

### Code Analysis
- **Relevant Files:**
  - [AssignTestModal.jsx:48](src/apBoost/components/teacher/AssignTestModal.jsx#L48) - useState(1)
  - [apTeacherService.js:239](src/apBoost/services/apTeacherService.js#L239) - defaults to 1
- **Current Implementation:**
  ```javascript
  // AssignTestModal.jsx:48
  const [maxAttempts, setMaxAttempts] = useState(1)

  // apTeacherService.js:239
  maxAttempts: assignmentData.maxAttempts || 1,
  ```
- **Gap:** UI and service both default to 1, spec says 3
- **Dependencies:** Existing assignments would be unaffected (already have values)

### Fix Plan

#### Step 1: Update UI Default
**File:** `src/apBoost/components/teacher/AssignTestModal.jsx`
**Action:** Modify
**Details:**
- Line 48: Change `useState(1)` to `useState(3)`

#### Step 2: Update Service Default
**File:** `src/apBoost/services/apTeacherService.js`
**Action:** Modify
**Details:**
- Line 239: Change `assignmentData.maxAttempts || 1` to `assignmentData.maxAttempts || 3`

### Verification Steps
1. Open AssignTestModal and verify dropdown shows 3 selected by default
2. Create assignment without changing attempts, verify stores as 3
3. Verify existing assignments retain their values

### Potential Risks
- Low risk - only affects new assignments
- Teachers may prefer 1 as default - consider if this is intentional UX choice

---

## Issue 7: Student Access Control Not Implemented

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Only students in studentIds can access assigned tests
- **Current State:** No access control verification when starting test session

### Code Analysis
- **Relevant Files:**
  - [apTestService.js:20-88](src/apBoost/services/apTestService.js#L20-L88) - getAvailableTests
  - [apSessionService.js:30-76](src/apBoost/services/apSessionService.js#L30-L76) - createOrResumeSession
- **Current Implementation:**

  `getAvailableTests` (line 41-44) correctly filters by studentIds:
  ```javascript
  const assignmentsQuery = query(
    collection(db, COLLECTIONS.ASSIGNMENTS),
    where('studentIds', 'array-contains', userId)
  )
  ```

  However, `createOrResumeSession` (line 30) does NOT verify access:
  ```javascript
  export async function createOrResumeSession(testId, userId, assignmentId = null) {
    // No validation that userId is allowed to take this test!
  ```
- **Gap:** A user with a direct URL to `/ap/test/[testId]` could bypass the dashboard and access any test
- **Dependencies:** apSessionService.js, apTestService.js

### Fix Plan

#### Step 1: Add Access Verification Function
**File:** `src/apBoost/services/apTestService.js`
**Action:** Add new function
**Details:**
- Add after getAssignment function (around line 169)

```javascript
/**
 * Verify user has access to a test
 * Returns true if test is public or user is in assignment's studentIds
 * @param {string} testId - Test ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Whether user can access the test
 */
export async function canAccessTest(testId, userId) {
  try {
    // Check if test is public
    const testDoc = await getDoc(doc(db, COLLECTIONS.TESTS, testId))
    if (!testDoc.exists()) {
      return false
    }

    const testData = testDoc.data()
    if (testData.isPublic === true) {
      return true
    }

    // Check if user has an assignment for this test
    const assignment = await getAssignment(testId, userId)
    return assignment !== null
  } catch (error) {
    console.error('Error checking test access:', error)
    return false
  }
}
```

#### Step 2: Add Validation to Session Creation
**File:** `src/apBoost/services/apSessionService.js`
**Action:** Modify createOrResumeSession
**Details:**
- Add import at top: `import { canAccessTest } from './apTestService'`
- Add validation after line 31:

```javascript
export async function createOrResumeSession(testId, userId, assignmentId = null) {
  try {
    // Verify user has access to this test
    const hasAccess = await canAccessTest(testId, userId)
    if (!hasAccess) {
      throw new Error('Access denied: You are not assigned to this test')
    }

    // ... rest of function
```

### Verification Steps
1. Test that assigned students can access their tests
2. Test that non-assigned students get "Access denied" error
3. Test that public tests remain accessible to everyone
4. Test direct URL access is blocked for non-assigned users

### Potential Risks
- Breaking change if teachers have been sharing direct test URLs
- Mitigation: Add clear error message directing users to contact teacher
- Consider: Allow teachers to bypass check?

---

## Issue 8-15: Missing Firestore Indexes

### Audit Finding
- **Status:** ❌ Missing (All 13 specified indexes)
- **Criterion:** Various composite and single-field indexes for ap_* collections
- **Current State:** firestore.indexes.json only contains legacy "attempts" collection indexes

### Code Analysis
- **Relevant Files:**
  - [firestore.indexes.json](firestore.indexes.json) - current index config
  - [apSessionService.js:86-91](src/apBoost/services/apSessionService.js#L86-L91) - session queries
  - [apGradingService.js:52](src/apBoost/services/apGradingService.js#L52) - grading queries
  - [apTeacherService.js:163-167](src/apBoost/services/apTeacherService.js#L163-L167) - class queries
  - [apTeacherService.js:261-265](src/apBoost/services/apTeacherService.js#L261-L265) - assignment queries

### Fix Plan

#### Step 1: Update firestore.indexes.json
**File:** `firestore.indexes.json`
**Action:** Replace entire contents
**Details:**

```json
{
  "indexes": [
    {
      "collectionGroup": "ap_session_state",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "testId", "order": "ASCENDING" },
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "ap_test_results",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "testId", "order": "ASCENDING" },
        { "fieldPath": "userId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "ap_test_results",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "testId", "order": "ASCENDING" },
        { "fieldPath": "completedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "ap_test_results",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "gradingStatus", "order": "ASCENDING" },
        { "fieldPath": "completedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "ap_test_results",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "isFirstAttempt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "ap_assignments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "testId", "order": "ASCENDING" },
        { "fieldPath": "assignedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "ap_classes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "teacherId", "order": "ASCENDING" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "ap_questions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "subject", "order": "ASCENDING" },
        { "fieldPath": "questionDomain", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "ap_questions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "subject", "order": "ASCENDING" },
        { "fieldPath": "tags", "arrayConfig": "CONTAINS" }
      ]
    },
    {
      "collectionGroup": "ap_questions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "difficulty", "order": "ASCENDING" },
        { "fieldPath": "questionType", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "ap_stimuli",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "subject", "order": "ASCENDING" },
        { "fieldPath": "tags", "arrayConfig": "CONTAINS" }
      ]
    },
    {
      "collectionGroup": "ap_tests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "createdBy", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": [
    {
      "collectionGroup": "ap_assignments",
      "fieldPath": "studentIds",
      "indexes": [
        { "order": "ASCENDING", "queryScope": "COLLECTION" },
        { "arrayConfig": "CONTAINS", "queryScope": "COLLECTION" }
      ]
    },
    {
      "collectionGroup": "ap_classes",
      "fieldPath": "studentIds",
      "indexes": [
        { "order": "ASCENDING", "queryScope": "COLLECTION" },
        { "arrayConfig": "CONTAINS", "queryScope": "COLLECTION" }
      ]
    }
  ]
}
```

#### Step 2: Deploy Indexes
**Action:** Run Firebase CLI
**Details:**
```bash
firebase deploy --only firestore:indexes
```

### Verification Steps
1. Run `firebase deploy --only firestore:indexes`
2. Verify in Firebase Console that indexes are building
3. Wait for indexes to complete (may take several minutes)
4. Test all queries that require these indexes:
   - Session queries (getActiveSession)
   - Grading queries (getPendingGrades)
   - Class queries (getTeacherClasses)
   - Assignment queries (getTestAssignments)
5. Verify no "missing index" errors in console

### Potential Risks
- Index building takes time (5-30 minutes depending on data size)
- Queries may fail until indexes complete
- Mitigation: Deploy during low-usage period

---

## Implementation Order

Recommended order to implement fixes (considering dependencies):

1. **Issue 8-15: Firestore Indexes** - Deploy first, as queries depend on these
2. **Issue 3: createClass Function** - Foundational, Issue 4 depends on this
3. **Issue 4: Class Timestamps** - Depends on Issue 3
4. **Issue 7: Access Control** - Critical security fix
5. **Issue 6: maxAttempts Default** - Simple fix, low risk
6. **Issue 1: frqUploadUrl** - Documentation or rename
7. **Issue 2: frqGradedPdfUrl** - Documentation or rename
8. **Issue 5: classIds Schema** - Documentation only (keep current implementation)

---

## Cross-Cutting Concerns

### Data Migration
If renaming fields (Issues 1-2), consider:
1. Adding migration script to update existing documents
2. Supporting both field names during transition period
3. Using Firestore functions to migrate on-read

### Error Handling
Issue 7 (Access Control) should return clear error messages:
- "Access denied: You are not assigned to this test"
- "Test not found"
- Direct users to contact their teacher

### Testing Requirements
All fixes should include:
1. Unit tests for new service functions
2. Integration tests for access control
3. Manual verification of query performance after index deployment

---

## Notes for Implementer

1. **Index Deployment is Critical** - Many queries will fail in production without proper indexes. Deploy these first and monitor for completion.

2. **Access Control is a Security Issue** - Issue 7 should be prioritized after indexes. Currently, any user can start a session for any test if they know the test ID.

3. **Field Renaming Decisions** - Issues 1-2 and 5 are naming discrepancies. Recommend documenting as intentional deviations rather than renaming, unless strict spec compliance is required.

4. **Default Value Change** - Issue 6 only affects new assignments. Confirm with product owner if defaulting to 3 attempts is correct behavior.

5. **Class Management** - No UI currently exists for class creation. Issue 3 provides the service function, but a UI component will also be needed.

---

*Fix plan completed on 2026-01-14*
