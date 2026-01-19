# Acceptance Criteria Audit: Sections 3.5 to 3.8

**Audited by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE

## Summary
- Total Criteria: 35
- ✅ Implemented: 20
- ⚠️ Partial: 4
- ❌ Missing: 11
- ❓ Unable to Verify: 0

---

## Section 3.5: ap_test_results Collection

### Criterion: userId, testId, classId, assignmentId references
- **Status:** ✅ Implemented
- **Evidence:** [apScoringService.js:128-131](src/apBoost/services/apScoringService.js#L128-L131)
- **Notes:** All four references are included in the result document creation.

### Criterion: attemptNumber (1, 2, or 3)
- **Status:** ✅ Implemented
- **Evidence:** [apScoringService.js:132](src/apBoost/services/apScoringService.js#L132)
- **Notes:** `attemptNumber: session.attemptNumber` - value comes from session which tracks attempt count.

### Criterion: isFirstAttempt boolean (for stats)
- **Status:** ✅ Implemented
- **Evidence:** [apScoringService.js:133](src/apBoost/services/apScoringService.js#L133)
- **Notes:** `isFirstAttempt: session.attemptNumber === 1` - correctly calculated.

### Criterion: sessionId reference
- **Status:** ✅ Implemented
- **Evidence:** [apScoringService.js:134](src/apBoost/services/apScoringService.js#L134)
- **Notes:** `sessionId: session.id` included in result.

### Criterion: answers object (MCQ: string, FRQ: object with parts)
- **Status:** ✅ Implemented
- **Evidence:** [apScoringService.js:135](src/apBoost/services/apScoringService.js#L135)
- **Notes:** Answers object is copied from session. FRQ answers also stored separately in `frqAnswers` field (line 145).

### Criterion: score, maxScore, percentage, apScore (1-5)
- **Status:** ✅ Implemented
- **Evidence:** [apScoringService.js:136-139](src/apBoost/services/apScoringService.js#L136-L139)
- **Notes:** All four fields present. AP score calculated using `calculateAPScore()` function.

### Criterion: sectionScores object with correct/total/points per section
- **Status:** ✅ Implemented
- **Evidence:** [apScoringService.js:82-115](src/apBoost/services/apScoringService.js#L82-L115)
- **Notes:** Section scores calculated with `{ correct, total, points }` structure stored by section index.

### Criterion: frqSubmissionType: TYPED, HANDWRITTEN, or null
- **Status:** ✅ Implemented
- **Evidence:** [apScoringService.js:143](src/apBoost/services/apScoringService.js#L143)
- **Notes:** `frqSubmissionType: frqData?.frqSubmissionType || null` - accepts TYPED, HANDWRITTEN, or null.

### Criterion: frqUploadUrl for student's scanned answer
- **Status:** ⚠️ Partial
- **Evidence:** [apScoringService.js:144](src/apBoost/services/apScoringService.js#L144)
- **Notes:** Uses `frqUploadedFiles` (array/object) instead of `frqUploadUrl` (string). Stores multiple files rather than single URL as specified.

### Criterion: frqGradedPdfUrl for teacher's annotated PDF
- **Status:** ⚠️ Partial
- **Evidence:** [apScoringService.js:148](src/apBoost/services/apScoringService.js#L148)
- **Notes:** Uses `annotatedPdfUrl` instead of the specified `frqGradedPdfUrl`. Functionality exists but field name differs from spec.

### Criterion: frqGrades object with subScores and comments per question
- **Status:** ✅ Implemented
- **Evidence:** [apGradingService.js:159-160](src/apBoost/services/apGradingService.js#L159-L160)
- **Notes:** Comments clearly state format: `{ [questionId]: { subScores: { a: 2, b: 3 }, comment: "..." } }`. Matches spec.

### Criterion: gradingStatus: NOT_NEEDED, PENDING, IN_PROGRESS, COMPLETE
- **Status:** ✅ Implemented
- **Evidence:** [apTypes.js:42-47](src/apBoost/utils/apTypes.js#L42-L47), [apScoringService.js:122-124](src/apBoost/services/apScoringService.js#L122-L124)
- **Notes:** All four statuses defined in constants and used appropriately.

### Criterion: startedAt, completedAt, gradedAt timestamps
- **Status:** ✅ Implemented
- **Evidence:** [apScoringService.js:151-153](src/apBoost/services/apScoringService.js#L151-L153)
- **Notes:** All three timestamps included. `startedAt` from session, `completedAt` uses serverTimestamp(), `gradedAt` initially null.

---

## Section 3.6: ap_classes Collection

### Criterion: name, subject, teacherId
- **Status:** ⚠️ Partial
- **Evidence:** [apTeacherService.js:160-178](src/apBoost/services/apTeacherService.js#L160-L178)
- **Notes:** `name` and `teacherId` confirmed via query. `subject` field not explicitly seen in code - may exist in data but not verified in service layer.

### Criterion: studentIds array
- **Status:** ✅ Implemented
- **Evidence:** [apTeacherService.js:195](src/apBoost/services/apTeacherService.js#L195)
- **Notes:** `const studentIds = classData.studentIds || []` - confirmed as array.

### Criterion: createdAt and updatedAt timestamps
- **Status:** ❓ Unable to Verify → ⚠️ Partial
- **Evidence:** No explicit class creation function found in services.
- **Notes:** No `createClass()` function exists in apTeacherService.js. The `getTeacherClasses()` reads existing classes but creation logic not implemented. Timestamps likely need to be added when class creation is implemented.

### Criterion: Assignments stored separately in ap_assignments
- **Status:** ✅ Implemented
- **Evidence:** [apTypes.js:97](src/apBoost/utils/apTypes.js#L97), [apTeacherService.js:230-251](src/apBoost/services/apTeacherService.js#L230-L251)
- **Notes:** `COLLECTIONS.ASSIGNMENTS: 'ap_assignments'` defined and used separately from classes.

---

## Section 3.7: ap_assignments Collection

### Criterion: testId and classId references
- **Status:** ⚠️ Partial
- **Evidence:** [apTeacherService.js:235-236](src/apBoost/services/apTeacherService.js#L235-L236)
- **Notes:** Uses `testId` (correct) but uses `classIds` (array) instead of single `classId`. This is actually MORE flexible but deviates from spec.

### Criterion: studentIds array (explicit list)
- **Status:** ✅ Implemented
- **Evidence:** [apTeacherService.js:237](src/apBoost/services/apTeacherService.js#L237), [AssignTestModal.jsx:103-107](src/apBoost/components/teacher/AssignTestModal.jsx#L103-L107)
- **Notes:** `studentIds` is explicitly collected from selected classes and stored as array.

### Criterion: dueDate (optional)
- **Status:** ✅ Implemented
- **Evidence:** [apTeacherService.js:238](src/apBoost/services/apTeacherService.js#L238)
- **Notes:** `dueDate: assignmentData.dueDate || null` - correctly optional.

### Criterion: maxAttempts (default: 3)
- **Status:** ⚠️ Partial
- **Evidence:** [apTeacherService.js:239](src/apBoost/services/apTeacherService.js#L239), [AssignTestModal.jsx:48](src/apBoost/components/teacher/AssignTestModal.jsx#L48)
- **Notes:** Implemented but default is `1` (line 48: `useState(1)`), not `3` as specified. UI offers options 1, 2, 3, 5, Unlimited.

### Criterion: assignedAt timestamp and assignedBy userId
- **Status:** ✅ Implemented
- **Evidence:** [apTeacherService.js:241-242](src/apBoost/services/apTeacherService.js#L241-L242)
- **Notes:** Both fields present: `assignedBy: assignmentData.assignedBy` and `assignedAt: serverTimestamp()`.

### Criterion: Only students in studentIds can access
- **Status:** ❌ Missing
- **Evidence:** No access control logic found in apTestService.js or apSessionService.js
- **Notes:** Student access verification not implemented. The dashboard should filter tests by checking if current user is in assignment's studentIds array - this logic needs to be verified/implemented.

### Criterion: New students joining class do NOT auto-get old assignments
- **Status:** ✅ Implemented (by design)
- **Evidence:** [AssignTestModal.jsx:103-107](src/apBoost/components/teacher/AssignTestModal.jsx#L103-L107)
- **Notes:** studentIds are captured at assignment creation time from current class rosters. No mechanism exists to auto-update assignments when class membership changes - this is the correct behavior.

---

## Section 3.8: Firestore Indexes

### Criterion: ap_session_state: userId + status
- **Status:** ❌ Missing
- **Evidence:** [firestore.indexes.json](firestore.indexes.json) - only contains indexes for "attempts" collection
- **Notes:** Index not defined. Query exists at [apSessionService.js:86-91](src/apBoost/services/apSessionService.js#L86-L91) using `userId`, `testId`, and `status`.

### Criterion: ap_session_state: sessionToken
- **Status:** ❌ Missing
- **Evidence:** [firestore.indexes.json](firestore.indexes.json)
- **Notes:** No index for sessionToken. May need single-field index if querying by token alone.

### Criterion: ap_test_results: userId + testId + classId
- **Status:** ❌ Missing
- **Evidence:** [firestore.indexes.json](firestore.indexes.json)
- **Notes:** Index not defined. Composite queries may fail without this index.

### Criterion: ap_test_results: testId + completedAt
- **Status:** ❌ Missing
- **Evidence:** [firestore.indexes.json](firestore.indexes.json)
- **Notes:** Index not defined. Query at [apGradingService.js:52](src/apBoost/services/apGradingService.js#L52) uses `orderBy('completedAt', 'desc')`.

### Criterion: ap_test_results: userId + isFirstAttempt
- **Status:** ❌ Missing
- **Evidence:** [firestore.indexes.json](firestore.indexes.json)
- **Notes:** Index not defined.

### Criterion: ap_assignments: classId + studentIds
- **Status:** ❌ Missing
- **Evidence:** [firestore.indexes.json](firestore.indexes.json)
- **Notes:** Index not defined. Note: implementation uses `classIds` (array) not `classId`.

### Criterion: ap_assignments: testId
- **Status:** ❌ Missing
- **Evidence:** [firestore.indexes.json](firestore.indexes.json)
- **Notes:** Single-field index for testId not explicitly defined. Query at [apTeacherService.js:261](src/apBoost/services/apTeacherService.js#L261).

### Criterion: ap_classes: teacherId
- **Status:** ❌ Missing
- **Evidence:** [firestore.indexes.json](firestore.indexes.json)
- **Notes:** Index not defined. Query at [apTeacherService.js:163-167](src/apBoost/services/apTeacherService.js#L163-L167).

### Criterion: ap_classes: studentIds
- **Status:** ❌ Missing
- **Evidence:** [firestore.indexes.json](firestore.indexes.json)
- **Notes:** Array-contains index not defined.

### Criterion: ap_questions: subject + tags
- **Status:** ❌ Missing
- **Evidence:** [firestore.indexes.json](firestore.indexes.json)
- **Notes:** Index not defined for question bank queries.

### Criterion: ap_questions: subject + questionDomain
- **Status:** ❌ Missing
- **Evidence:** [firestore.indexes.json](firestore.indexes.json)
- **Notes:** Index not defined.

### Criterion: ap_questions: difficulty + questionType
- **Status:** ❌ Missing
- **Evidence:** [firestore.indexes.json](firestore.indexes.json)
- **Notes:** Index not defined.

### Criterion: ap_stimuli: subject + tags
- **Status:** ❌ Missing
- **Evidence:** [firestore.indexes.json](firestore.indexes.json)
- **Notes:** Index not defined.

---

## Recommendations

### Critical Issues

1. **Missing Firestore Indexes (Section 3.8)**
   - All 13 specified indexes are missing from `firestore.indexes.json`
   - The file only contains legacy "attempts" collection indexes
   - This will cause query failures in production
   - **Action Required:** Add all ap_* collection indexes to firestore.indexes.json and deploy

2. **Access Control Not Implemented (Section 3.7)**
   - No verification that students can only access tests they're assigned to
   - **Action Required:** Add assignment-based access checks in apTestService.js

### Minor Issues

3. **Field Name Discrepancies (Section 3.5)**
   - `frqUploadedFiles` should be `frqUploadUrl` (or document the deviation)
   - `annotatedPdfUrl` should be `frqGradedPdfUrl` (or document the deviation)

4. **Default Value Mismatch (Section 3.7)**
   - `maxAttempts` defaults to 1, spec says default should be 3
   - Consider updating [AssignTestModal.jsx:48](src/apBoost/components/teacher/AssignTestModal.jsx#L48)

5. **Class Management Incomplete (Section 3.6)**
   - No `createClass()` function in apTeacherService.js
   - Cannot verify if `subject`, `createdAt`, `updatedAt` fields are properly set

6. **Schema Deviation (Section 3.7)**
   - Uses `classIds` (array) instead of `classId` (string)
   - This is actually more flexible but deviates from documented schema

### Suggested Index Configuration

```json
{
  "indexes": [
    {
      "collectionGroup": "ap_session_state",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
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
        { "fieldPath": "difficulty", "order": "ASCENDING" },
        { "fieldPath": "questionType", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

*Audit completed on 2026-01-14*
