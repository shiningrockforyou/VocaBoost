# Session Fragility Audit

This document analyzes potential failure points in the study session flow, identifying fragile operations that could cause sporadic issues.

---

## Phase 0: Initialization

**Overall Risk: LOW-MEDIUM**

| Step | Function | Location | Fragility | Impact |
|------|----------|----------|-----------|--------|
| 1 | Component mount | DailySessionFlow.jsx:544 | Low | Triggers init |
| 2 | `getSessionState()` | sessionService.js:67 | Low | Read only, fails visibly |
| 3 | `returnMasteredWords()` | studyService.js:827 | Medium | Write op - if fails, mastered words stuck forever |
| 4 | `getOrCreateClassProgress()` | progressService.js | Medium | Read + conditional write, could orphan state |
| 5 | Calculations (intervention, allocation, segment) | studyAlgorithm.js | Low | Pure functions, no I/O |
| 6 | `getNewWords()` | studyService.js:454 | Low | Read only, fails visibly |
| 7 | `initializeNewWordStates()` | studyService.js:387 | **HIGH** | Batch write - partial failure = inconsistent state |

### Key Concerns

#### `initializeNewWordStates()` - Batch Write Risk
- Creates `study_state` documents for each new word
- If batch partially fails: some words have states, others don't
- Words appear in flashcards (from list), but missing `study_states` causes issues downstream
- Impact surfaces later: test submission errors, review queue problems, graduation failures

#### `returnMasteredWords()` - Silent Failure Risk
- Updates words where `returnAt <= now` back to `NEEDS_CHECK`
- If fails silently: words stuck in MASTERED forever, never return to queue

### Recommendations
1. Verify `initializeNewWordStates()` uses batch writes (all-or-nothing)
2. Make initialization idempotent (check before create)
3. Ensure errors propagate and block session start

---

## Phase 1: New Words Study

**Overall Risk: LOW**

| Component | Storage | Fragility | Impact |
|-----------|---------|-----------|--------|
| `newWordsQueue` | React state only | Low | Lost on refresh/crash |
| `newWordsDismissed` | React state only | Low | Lost on refresh/crash |
| `currentIndex` | React state only | Low | Lost on refresh/crash |
| Card flip state | React state only | Low | Lost on refresh/crash |

### Key Characteristics
- **No Firestore writes during this phase**
- Everything lives in React state
- Persistence only happens when transitioning to test

### What Happens on Crash
| Scenario | Result |
|----------|--------|
| Browser crashes mid-study | All progress lost, restart study |
| Tab closes | Dismissed list lost, restart study |
| Phone dies | Same - local state gone |

### Assessment
**Not fragile in a way that causes data corruption.** Worst case is lost study time (user re-studies cards). No silent failures, no data corruption risk.

### Optional Improvements
- Periodic auto-save to sessionStorage (survives refresh)
- Debounced save to Firestore every 30s (survives browser crash)
- Save on `beforeunload` event (catches tab close)

---

## Phase 2: New Words Test

**Overall Risk: HIGH**

This is where writes happen and errors get swallowed.

| Step | Operation | Location | Fragility | Impact |
|------|-----------|----------|-----------|--------|
| 11 | Save to sessionStorage | DailySessionFlow.jsx:1078 | Medium | Crash recovery broken if fails |
| 12 | Navigate to test | DailySessionFlow.jsx:1091 | Low | Just navigation |
| 13 | `selectTestWords()` | studyAlgorithm.js | Low | Pure function, no I/O |
| 14 | User answers questions | MCQTest.jsx | Low | Local state only |
| 15 | **`handleSubmit()`** | MCQTest.jsx:438 | **HIGH** | Multiple writes, error swallowing |
| 15a | → `processTestResults()` | studyService.js:237 | **HIGH** | Batch write to study_states |
| 15b | → `submitTestAttempt()` | db.js:1003 | **HIGH** | Write to attempts collection |
| 15c | → `completeSessionFromTest()` | studyService.js:980 | **HIGH** | Conditional execution, errors swallowed |

### Critical Issue 1: `processTestResults()` - Batch Write

**What it does:** Updates each word's status to PASSED or FAILED

**Fragility:**
- Batch can partially fail
- If fails, word statuses don't update
- Test continues as if success

**Impact:** Words stuck at wrong status, affects future review queue building

### Critical Issue 2: `submitTestAttempt()` - Attempt Recording

**What it does:** Saves test attempt for gradebook

**Fragility:**
- Network failure = attempt not saved
- No retry logic
- Error may or may not propagate

**Impact:** Teacher doesn't see attempt, student has no record

### Critical Issue 3: `completeSessionFromTest()` - Error Swallowing

**Location:** MCQTest.jsx:549-572

```javascript
if (passed && isSessionFinalTest && sessionContext?.dayNumber) {
  try {
    await completeSessionFromTest({...})
  } catch (completionErr) {
    console.error('Failed to complete session:', completionErr)
    // Don't fail the whole submit - attempt is already saved  ← ERROR SWALLOWED
  }
}
```

**Failure Points:**
| Point | Why It's Sporadic |
|-------|-------------------|
| `sessionContext?.dayNumber` undefined | sessionStorage cleared/corrupted |
| `completeSessionFromTest()` throws | Network timeout, Firestore error |
| sessionStorage read fails inside | Browser evicted it |
| `recordSessionCompletion()` fails inside | Network, day validation |
| Error caught and swallowed | User sees success, DB not updated |

### Critical Issue 4: Day 2+ - `newWordsTestPassed` Not Set Here

On Day 2+, new word test is NOT the final test, so `completeSessionFromTest()` doesn't run.

**Problem:** `newWordsTestPassed = true` is NOT set in Phase 2 for Day 2+. This responsibility falls on DailySessionFlow's return handler (Phase 3). If that fails, student appears to not have passed.

### The Order Problem - No Rollback

Operations happen in sequence:
```
1. processTestResults()      ✓ Succeeds - study_states updated
2. submitTestAttempt()       ✓ Succeeds - attempt saved
3. completeSessionFromTest() ✗ Fails silently
```

**Result:**
- Words marked PASSED ✓
- Attempt recorded ✓
- Session not completed ✗
- Progress not incremented ✗
- User sees "passed" screen ✓ (misleading!)

### Traced Issues

| Reported Issue | Root Cause in Phase 2 |
|----------------|----------------------|
| Stuck at new-word-test phase | `newWordsTestPassed` not set (Day 2+ path relies on Phase 3) |
| Review test doesn't complete day | `completeSessionFromTest()` failed silently |
| CSD/TWI not incremented | `recordSessionCompletion()` failed silently |

---

## Phase 3: Return from New Word Test

**Overall Risk: HIGH (especially for Day 2+)**

This is where the Day 2+ `newWordsTestPassed` issue likely originates.

| Step | Operation | Location | Fragility | Impact |
|------|-----------|----------|-----------|--------|
| 1 | Read `location.state.testCompleted` | DailySessionFlow.jsx:1152 | Medium | If missing, doesn't know test finished |
| 2 | Read sessionStorage | DailySessionFlow.jsx:1160~ | **HIGH** | If cleared, can't restore session config |
| 3 | Day 1: Display completion | DailySessionFlow.jsx | Low | Already completed in Phase 2 |
| 4 | Day 2+: `saveSessionState()` | sessionService.js | **HIGH** | Must set `newWordsTestPassed`, update phase |
| 5 | Day 2+: `moveToReviewPhase()` | DailySessionFlow.jsx:871 | **HIGH** | Loads review words, transitions phase |

### Day 1 Path (Low Risk)

Session was already completed in Phase 2 by `completeSessionFromTest()`. Phase 3 just displays the completion screen.

**Fragility:** Low - just reading and displaying.

### Day 2+ Path (HIGH Risk)

This is where things break. The test component did NOT call `completeSessionFromTest()` (review test is final, not new word test).

**Phase 3 must:**
1. Restore session from sessionStorage
2. Save `newWordsTestPassed = true` to Firestore
3. Update `phase = 'review-study'`
4. Load review segment words

### Critical Point: Who Sets `newWordsTestPassed` for Day 2+?

| Day | Where `newWordsTestPassed` is set |
|-----|-----------------------------------|
| Day 1 | Inside `completeSessionFromTest()` in Phase 2 |
| Day 2+ | **Must happen in Phase 3 return handler** |

**Key Question:** Is there actually a `saveSessionState()` call that sets `newWordsTestPassed = true` for Day 2+?

If this call is:
- **Missing** → `newWordsTestPassed` never set
- **Fails silently** → `newWordsTestPassed` stays false
- **Conditional on sessionStorage** → fails if sessionStorage cleared

### Failure Scenarios

#### Scenario A: sessionStorage Cleared
```
Student finishes test → Returns to DailySessionFlow → sessionStorage empty
```
**Result:**
- Can't restore `sessionConfig`
- Don't know `dayNumber`, `segment`, etc.
- Phase transition fails or uses wrong data
- Student stuck or sees wrong content

#### Scenario B: `saveSessionState()` Fails Silently
```
Student returns → saveSessionState() throws → Error caught/swallowed
```
**Result:**
- `newWordsTestPassed` stays `false`
- `phase` stays `'new-word-test'`
- UI may show review, but Firestore says stuck at new word test
- Refresh → student back at new word test

#### Scenario C: `moveToReviewPhase()` Fails
```
Student returns → Phase updated → moveToReviewPhase() throws
```
**Result:**
- Phase says review-study but no review words loaded
- Segment query fails
- Student sees empty review screen or error

### The Likely Cause of Issue #1

**"Student passes new word test, but stuck at `new-word-test` phase"**

For Day 2+, the sequence should be:
```
1. Return from test with passed=true
2. Read sessionStorage → get sessionConfig
3. saveSessionState({ newWordsTestPassed: true, phase: 'review-study' })
4. moveToReviewPhase() → load review words
```

**If step 2 or 3 fails:**
- Firestore never updated
- Student sees review phase (React state)
- Refresh → Firestore says `phase: 'new-word-test'`, `newWordsTestPassed: false`
- Student appears stuck

### Summary

| Risk | Description |
|------|-------------|
| sessionStorage dependency | If cleared between test and return, session config lost |
| Missing/failing saveSessionState() | `newWordsTestPassed` never persisted for Day 2+ |
| Error swallowing | Phase transition failures hidden from user |
| React state vs Firestore mismatch | UI shows progress, database doesn't |

---

## Phase 4: Review Study (Day 2+ only)

**Overall Risk: LOW**

Similar to Phase 1 - mostly local state, low-stakes operations.

| Step | Operation | Location | Fragility | Impact |
|------|-----------|----------|-----------|--------|
| 1 | Display review flashcards | DailySessionFlow.jsx | Low | Local state |
| 2 | `handleReviewKnowThis()` | DailySessionFlow.jsx:929 | Low | Local state only |
| 3 | `handleReviewNotSure()` | DailySessionFlow.jsx:944 | Low | Local state only |
| 4 | `handleFinishReviewStudy()` | DailySessionFlow.jsx:1017 | Low-Medium | Triggers transition |
| 5 | `updateQueueTracking()` | studyService.js:285 | Low | Writes lastQueuedAt, queueAppearances |

### Key Characteristics

- **Mostly local state** - `reviewQueue`, `reviewDismissed`, `currentIndex` all in React
- **One write operation** - `updateQueueTracking()` at the end
- **Non-critical write** - Only updates algorithm hints, not progress data

### What `updateQueueTracking()` Does

Writes to `study_states` for each studied word:
- `lastQueuedAt: now()`
- `queueAppearances: increment(1)`

**If it fails:**
- Algorithm might not prioritize words optimally next session
- No "stuck" state
- No data corruption
- Student can proceed to test

### What Happens on Crash

| Scenario | Result |
|----------|--------|
| Browser crashes mid-study | Review progress lost, restart study |
| Tab closes | Dismissed list lost, restart study |

**Impact:** Low - just lost study time, same as Phase 1.

### Assessment

**Not fragile.** This phase is safe because:
1. No critical writes during study
2. `updateQueueTracking()` failure doesn't block progress
3. Worst case: sub-optimal algorithm next session

---

## Phase 5: Review Test (Day 2+ only)

**Overall Risk: HIGH**

This is the final test - where session completion MUST happen. Same issues as Phase 2, plus additional complexity.

| Step | Operation | Location | Fragility | Impact |
|------|-----------|----------|-----------|--------|
| 1 | Navigate to test | DailySessionFlow.jsx | Low | Just navigation |
| 2 | `selectTestWords()` | studyAlgorithm.js | Low | Pure function |
| 3 | User answers | MCQTest.jsx | Low | Local state |
| 4 | **`handleSubmit()`** | MCQTest.jsx:438 | **HIGH** | Multiple writes |
| 4a | → `processTestResults()` | studyService.js:237 | **HIGH** | Batch write to study_states |
| 4b | → `submitTestAttempt()` | db.js:1003 | **HIGH** | Write to attempts |
| 4c | → `completeSessionFromTest()` | studyService.js:980 | **HIGH** | Session completion |
| 5 | → `getNewWordAttemptForDay()` | db.js:2704 | **HIGH** | Must find earlier test score |
| 6 | → `recordSessionCompletion()` | studyService.js:312 | **HIGH** | Updates class_progress |
| 7 | → `graduateSegmentWords()` | studyService.js:762 | **Medium** | Marks words MASTERED |

### Same Issues as Phase 2

- `processTestResults()` batch can partially fail
- `submitTestAttempt()` can fail
- `completeSessionFromTest()` errors swallowed
- sessionStorage dependency

### Additional Review Test Issues

#### 1. `getNewWordAttemptForDay()` - Must Find Earlier Score

```javascript
// Inside completeSessionFromTest() for Day 2+
const newWordAttempt = await getNewWordAttemptForDay(userId, classId, dayNumber)
const newWordScore = newWordAttempt?.score
```

**If this fails or returns null:**
- `newWordScore` is undefined
- Session recorded with missing/wrong score
- Or validation fails and completion aborts

**Why it might fail:**
- Composite index missing in Firestore
- Earlier attempt wasn't saved (Phase 2 failure)
- Query timeout

#### 2. `graduateSegmentWords()` - Word Graduation

**What it does:**
- Selects words to mark as MASTERED based on review score
- Sets `status: MASTERED`, `returnAt: 21 days`

**If it fails:**
- Words never graduate
- Stuck in review segment forever
- But session still "completes" (error likely swallowed)

#### 3. Day Validation in `updateClassProgress()`

```javascript
const expectedDay = (current.currentStudyDay || 0) + 1;
if (sessionSummary.dayNumber !== expectedDay) {
  return current; // ← SILENTLY SKIPS UPDATE
}
```

**If `dayNumber` is stale (from old sessionStorage):**
- Validation fails
- `currentStudyDay` not incremented
- `totalWordsIntroduced` not incremented
- Session appears complete but progress stuck

### The Likely Causes of Issues #2 and #3

**Issue #2: "Passes review test, day not completed"**
- `completeSessionFromTest()` threw error (swallowed)
- sessionStorage was empty/corrupted
- `recordSessionCompletion()` failed

**Issue #3: "Session completes, but CSD/TWI don't increment"**
- Day validation failed (stale dayNumber)
- `updateClassProgress()` silently returned without updating
- Double-submit caused mismatch

### Summary

| Risk | Description |
|------|-------------|
| All Phase 2 risks | Error swallowing, sessionStorage, batch failures |
| `getNewWordAttemptForDay()` | Must find earlier test - can fail silently |
| Day validation | Stale dayNumber causes silent skip |
| `graduateSegmentWords()` | Failure means words never graduate |
| No atomicity | Session "completes" but progress doesn't update |

---

## Phase 6: Session Complete

**Overall Risk: LOW**

By this point, all critical writes have already happened (or failed). This phase is mostly display.

| Step | Operation | Location | Fragility | Impact |
|------|-----------|----------|-----------|--------|
| 1 | Display summary | DailySessionFlow.jsx:1552 | Low | Read-only display |
| 2 | Show scores, graduation count | DailySessionFlow.jsx | Low | Local state |
| 3 | User clicks "Next Day" | DailySessionFlow.jsx | Low | Just triggers cleanup |
| 4 | `clearSessionState()` | sessionService.js:141 | Low-Medium | Deletes session_states doc |

### What Happens Here

- Display completion summary (scores, words, graduation count)
- User acknowledges and clicks "Next Day" or "Dashboard"
- Session state document is deleted to allow fresh start next time

### The Only Write: `clearSessionState()`

```javascript
// sessionService.js:141
await deleteDoc(doc(db, `users/${userId}/session_states/${classId}_${listId}`))
```

**If it fails:**
- Session state document remains
- Next session load might try to "resume" completed session
- Could cause confusion but not data corruption

**Impact:** Low - worst case is a stale session state that can be manually cleared or will naturally resolve.

### Why This Phase Is Safe

1. **All critical writes already done** - Progress updated in Phase 2/5
2. **Display only** - Just showing results
3. **Cleanup is non-critical** - Failed cleanup is annoying, not catastrophic
4. **Recoverable** - Stale session state can be cleared manually

### Summary

| Risk | Description |
|------|-------------|
| `clearSessionState()` failure | Stale session state next time - minor annoyance |
| User abandons page | Session state stays "complete" - not harmful |

**Assessment:** This phase is not fragile. The damage (if any) was already done in earlier phases.

---

## Final Summary

### Risk by Phase

| Phase | Risk Level | Key Concern |
|-------|------------|-------------|
| Phase 0: Initialization | LOW-MEDIUM | `initializeNewWordStates()` batch write |
| Phase 1: New Words Study | LOW | Local state only, no critical writes |
| Phase 2: New Words Test | **HIGH** | Error swallowing, sessionStorage dependency |
| Phase 3: Return from Test | **HIGH** | Day 2+ `newWordsTestPassed` not persisted |
| Phase 4: Review Study | LOW | Local state only, non-critical writes |
| Phase 5: Review Test | **HIGH** | All Phase 2 issues + day validation |
| Phase 6: Session Complete | LOW | Display only, cleanup non-critical |

### The Three Sporadic Issues - Root Causes

| Issue | Symptom | Root Cause | Phase |
|-------|---------|------------|-------|
| #1 | Passes new word test, stuck at `new-word-test` | `newWordsTestPassed` not saved for Day 2+ | Phase 3 |
| #2 | Passes review test, day not completed | `completeSessionFromTest()` error swallowed | Phase 2/5 |
| #3 | Session complete, CSD/TWI not incremented | Day validation failed or `updateClassProgress()` error | Phase 5 |

### Common Patterns Causing Failures

1. **Error Swallowing**
   - Try-catch blocks that log but don't retry or notify user
   - Operations continue as if successful when they failed
   - Locations: MCQTest.jsx:550-571, TypedTest.jsx:647-668

2. **sessionStorage Fragility**
   - Critical session data stored in browser sessionStorage
   - Can be cleared by browser (memory pressure, backgrounded tab)
   - No fallback when missing

3. **No Write Verification**
   - Firestore writes assumed successful
   - No read-after-write confirmation
   - Partial failures go undetected

4. **React State vs Firestore Mismatch**
   - UI updates immediately (optimistic)
   - Firestore write fails silently
   - Refresh reveals true (broken) state

5. **Silent Validation Failures**
   - Day validation in `updateClassProgress()` silently skips update
   - No logging, no user feedback, no retry

### Recommended Fixes (Priority Order)

#### Priority 1: Stop Swallowing Errors
- Remove or rethink try-catch blocks that hide failures
- Propagate errors to UI, show user feedback
- Allow retry for transient failures

#### Priority 2: Remove sessionStorage Dependency
- Store critical session config in Firestore, not sessionStorage
- Read from Firestore in `completeSessionFromTest()`
- sessionStorage as cache only, not source of truth

#### Priority 3: Add Write Verification
- Read-after-write for critical operations
- Verify `newWordsTestPassed`, `currentStudyDay` actually updated
- Retry on verification failure

#### Priority 4: Make Day Validation Visible
- Log loudly when day validation fails
- Consider: should validation failure throw instead of silently skip?
- Add monitoring/alerting for validation mismatches

#### Priority 5: Atomic Operations
- Use Firestore transactions for related writes
- Either all succeed (attempt + progress + session state) or all fail
- Prevents partial state

### Files to Modify

| File | Changes Needed |
|------|----------------|
| `src/pages/MCQTest.jsx` | Error handling in handleSubmit (lines 549-572) |
| `src/pages/TypedTest.jsx` | Error handling in handleSubmit (lines 646-669) |
| `src/services/studyService.js` | `completeSessionFromTest()` - remove sessionStorage dependency |
| `src/services/progressService.js` | `updateClassProgress()` - make validation failure visible |
| `src/services/sessionService.js` | Add write verification helpers |
| `src/pages/DailySessionFlow.jsx` | Phase 3 return handler - ensure `newWordsTestPassed` saved |

---

## Summary: Known Sporadic Issues

| Issue | Symptom | Root Cause | Phase |
|-------|---------|------------|-------|
| 1 | Passes new word test, stuck at `new-word-test` phase | `newWordsTestPassed` not saved, phase not updated | Phase 2/3 |
| 2 | Passes review test, day not completed | `completeSessionFromTest()` error swallowed | Phase 2 |
| 3 | Session shows complete, but CSD/TWI not incremented | `recordSessionCompletion()` or `updateClassProgress()` failed silently | Phase 2 |

## Common Thread: Silent Failures

All sporadic issues share the same pattern:
```
Operation attempted → Network/timing issue → Error caught → Logged to console → Continues as if success
```

**No user feedback. No retry. No verification.**
