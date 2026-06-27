# Plan: Server-Side Attempt Write Refactor

> **Status:** Draft  
> **Author:** Claude  
> **Created:** 2026-06-22  
> **Priority:** High (eliminates "connection error after grading" class of bugs)

## Problem Statement

Current architecture has a critical failure point:

```
Client → Cloud Function (grade) → [response] → Client → Firestore (write)
                                                  ↑
                                          FAILURE POINT
```

If the client loses connection after receiving grading results but before writing the attempt to Firestore:
- Student's work is lost
- They see "Connection Error" 
- Retrying submits a new grading request (costs tokens, may get different results)
- No server-side record that grading ever happened

This causes recurring support tickets (이가온, 강민서, etc.) requiring manual database fixes.

## Proposed Solution

Move the attempt write inside the Cloud Function:

```
Client → Cloud Function (grade + write) → [response] → Client (display only)
```

Benefits:
- **Atomic**: Grade and write succeed or fail together
- **Reliable**: Server-side writes don't depend on client connection
- **Simpler client**: No write logic, just display results
- **Auditable**: Server logs capture all attempts
- **Idempotent**: Can design for safe retries

## Current Code Inventory

### Cloud Functions (`functions/index.js`)

| Function | Purpose | Returns |
|----------|---------|---------|
| `gradeTypedAnswers` | AI-grades typed answers | `{ results: [...], score }` |
| `gradeTestAnswers` | Grades MCQ answers | `{ results: [...], score }` |

### Client Write Locations

| File | Function | What it writes |
|------|----------|----------------|
| `src/pages/TypedTest.jsx` | `handleSubmit` | Calls `submitTestAttempt()` after grading |
| `src/pages/MCQTest.jsx` | `handleSubmit` | Calls `submitTestAttempt()` after grading |
| `src/services/db.js` | `submitTestAttempt()` | Writes to `attempts` collection |
| `src/services/studyService.js` | `completeSessionFromTest()` | Updates progress after attempt |

### Data Written to `attempts` Collection

```javascript
{
  studentId,
  classId,
  listId,
  studyDay,
  sessionType,      // 'new' | 'review'
  testType,         // 'typed' | 'mcq'
  score,
  passed,
  graded: true,
  totalQuestions,
  correctAnswers,
  newWordStartIndex,
  newWordEndIndex,
  submittedAt: serverTimestamp(),
  gradedAt: serverTimestamp(),
  answers: [...]    // Full answer array with grading results
}
```

## Implementation Plan

### Phase 1: Extend Cloud Function (Non-Breaking)

**File:** `functions/index.js`

1. Add new parameter `writeAttempt: boolean` (default `false` for backward compat)
2. Add required context params when `writeAttempt: true`:
   ```javascript
   {
     answers: [...],
     writeAttempt: true,
     // New required fields:
     classId,
     listId,
     studyDay,
     sessionType,
     testType,
     newWordStartIndex,
     newWordEndIndex,
     passThreshold
   }
   ```
3. After grading, if `writeAttempt: true`:
   - Calculate `passed = score >= passThreshold`
   - Write attempt document with Admin SDK
   - Return `{ results, score, passed, attemptId, attemptWritten: true }`

4. Add idempotency key:
   - Client generates `attemptKey = hash(studentId + listId + studyDay + sessionType + timestamp_minute)`
   - Function checks if attempt with this key exists → return existing result
   - Prevents duplicate writes on retry

**New function signature:**
```javascript
exports.gradeTypedAnswers = onCall(async (request) => {
  const { 
    answers, 
    writeAttempt = false,
    // Context for write:
    classId, listId, studyDay, sessionType, testType,
    newWordStartIndex, newWordEndIndex, passThreshold,
    idempotencyKey
  } = request.data;
  
  const uid = request.auth.uid;
  
  // ... existing grading logic ...
  
  if (writeAttempt) {
    // Check idempotency
    const existing = await checkExistingAttempt(idempotencyKey);
    if (existing) return existing;
    
    // Write attempt
    const attemptData = {
      studentId: uid,
      classId, listId, studyDay, sessionType, testType,
      score, passed: score >= passThreshold,
      graded: true,
      totalQuestions: answers.length,
      correctAnswers: results.filter(r => r.isCorrect).length,
      newWordStartIndex, newWordEndIndex,
      submittedAt: FieldValue.serverTimestamp(),
      gradedAt: FieldValue.serverTimestamp(),
      answers: results,
      idempotencyKey
    };
    
    const attemptRef = await db.collection('attempts').add(attemptData);
    
    return { results, score, passed, attemptId: attemptRef.id, attemptWritten: true };
  }
  
  return { results, score };
});
```

### Phase 2: Update Client to Use New Flow

**Files:** `TypedTest.jsx`, `MCQTest.jsx`

1. Generate idempotency key before calling function
2. Pass all context to cloud function with `writeAttempt: true`
3. Remove call to `submitTestAttempt()` 
4. On success, just display results (attempt already written)
5. On failure, show retry button (idempotent, safe to retry)

**Before:**
```javascript
const { results, score } = await gradeTypedAnswers({ answers });
await submitTestAttempt({ ...attemptData, score, answers: results });
```

**After:**
```javascript
const { results, score, passed, attemptId } = await gradeTypedAnswers({ 
  answers,
  writeAttempt: true,
  classId, listId, studyDay, sessionType, testType,
  newWordStartIndex, newWordEndIndex, passThreshold,
  idempotencyKey: generateIdempotencyKey()
});
// No submitTestAttempt call needed - already written server-side
```

### Phase 3: Progress Updates (Optional Enhancement)

Currently `completeSessionFromTest()` updates:
- `session_states` (phase, scores)
- `class_progress` (currentStudyDay, totalWordsIntroduced)
- `study_states` (word-level mastery)

**Option A:** Keep client-side (simpler, lower risk)
- These are less critical than the attempt record
- Can be reconstructed from attempts if lost

**Option B:** Move to Cloud Function (more atomic)
- Add `updateProgress: true` flag
- Function updates all state in a batch/transaction
- More complex but fully atomic

**Recommendation:** Start with Option A, consider Option B later.

### Phase 4: Cleanup

1. Remove `writeAttempt: false` default (make it required)
2. Deprecate client-side `submitTestAttempt()` for test results
3. Update error messages to reflect new flow
4. Add monitoring/alerts for function failures

## Rollout Strategy

1. **Deploy Phase 1** - New function with `writeAttempt` flag (backward compatible)
2. **Test internally** - Use `writeAttempt: true` in dev/staging
3. **Gradual rollout** - Feature flag per class or percentage
4. **Monitor** - Watch for errors, compare attempt counts
5. **Full rollout** - Enable for all, remove old path

## Security Considerations

1. **Input validation** - Function must validate all inputs (classId exists, user is member, etc.)
2. **Auth check** - `request.auth.uid` must match studentId
3. **Rate limiting** - Prevent abuse (already have retry limits)
4. **Firestore rules** - Can tighten client write rules for `attempts` once migration complete

## Testing Plan

1. **Unit tests** - Function grading + writing logic
2. **Integration tests** - Full flow with test Firebase project
3. **E2E tests** - Playwright tests for both typed and MCQ
4. **Failure injection** - Test retry behavior with idempotency
5. **Load test** - Ensure function handles concurrent submissions

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Function timeout on slow AI grading | Already have 90s timeout; monitor |
| Duplicate attempts on retry | Idempotency key prevents this |
| Client shows wrong state | Return full attempt data so client has truth |
| Rollback needed | Keep old path available via flag |

## Success Metrics

- Zero "connection error after grading" support tickets
- Attempt write success rate > 99.9%
- No increase in function errors
- Reduced client-side error handling code

## Files to Modify

| File | Changes |
|------|---------|
| `functions/index.js` | Add write logic to grading functions |
| `functions/package.json` | No changes expected |
| `src/pages/TypedTest.jsx` | Pass context, remove submitTestAttempt |
| `src/pages/MCQTest.jsx` | Pass context, remove submitTestAttempt |
| `src/services/db.js` | Deprecate submitTestAttempt for tests |
| `firestore.rules` | Tighten attempts write rules (Phase 4) |

## Estimated Effort

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1 | 2-3 hours | None |
| Phase 2 | 2-3 hours | Phase 1 deployed |
| Phase 3 | 3-4 hours | Optional |
| Phase 4 | 1 hour | Full rollout complete |

**Total:** 5-6 hours for core fix (Phases 1-2)

## Open Questions

1. Should `passThreshold` be fetched server-side from class doc instead of passed by client?
   - Pro: Can't be spoofed
   - Con: Extra read per grading call
   - **Recommendation:** Fetch server-side for security

2. Should we batch progress updates in the same function call?
   - **Recommendation:** Defer to Phase 3, keep scope tight for initial fix

3. Keep `submitTestAttempt` for non-test writes (manual teacher entries)?
   - **Recommendation:** Yes, rename to `submitManualAttempt` for clarity
