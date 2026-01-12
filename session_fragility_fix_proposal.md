## Implementation Rules

- Do NOT add validation layers or defensive checks beyond what's specified
- Do NOT create new abstractions or wrapper classes
- Do NOT refactor surrounding code - only modify what's necessary for the fix
- Follow the exact patterns shown in code examples
- Ask before modifying any file not listed in "Files to Modify"
- Implement one solution at a time, verify it works before moving on


# Session Fragility Fix Proposal

This document proposes fixes for the sporadic session issues identified in the fragility audit.

## Core Principle #1: Initialization-Based State Recovery

Instead of relying on fragile "return from test" logic that depends on sessionStorage and location.state, **make initialization smart enough to determine the correct state from Firebase**.

The attempt record in Firebase becomes the source of truth for what phase the student should be in.

---

## Core Principle #2: Bulletproof Attempt Writing

**The entire init-based recovery depends on attempts being saved.** If `submitTestAttempt()` fails, no recovery is possible.

### Approach: Block Until Confirmed

- `submitTestAttempt()` is the chokepoint
- If it fails after retries → **block navigation**, show error, let user retry
- Student stays on test screen with answers preserved in React state
- Only navigate when attempt is confirmed saved

This eliminates the "missing attempt" scenario entirely. We don't plan for missing attempts - we make attempt writing so robust it never happens.

### Implementation

```javascript
// In MCQTest.jsx / TypedTest.jsx
const handleSubmit = async () => {
  setSubmitting(true);
  setSubmitError(null);

  try {
    // Retry with exponential backoff + verification
    await submitAttemptWithRetry(attemptData);

    // Only navigate on confirmed success
    navigate('/session', { state: { testCompleted: true } });
  } catch (err) {
    // Stay on test screen, answers preserved
    setSubmitError('Failed to save your test. Please try again.');
    setSubmitting(false);
    // answers[] still in React state - retry will use same data
  }
};
```

### Error Differentiation

```javascript
try {
  await submitAttemptWithRetry(...);
} catch (err) {
  if (err.code === 'permission-denied' || err.code === 'unauthenticated') {
    // Auth expired - don't retry, redirect to login
    setSubmitError({ type: 'auth', message: 'Session expired. Please log in again.' });
  } else {
    // Transient error - offer retry
    setSubmitError({ type: 'network', message: 'Connection issue. Try again.' });
  }
}
```

### Recovery UI Options

| Error Type | Button Options |
|------------|----------------|
| Network/transient | "Try Again" |
| Auth expired | "Log In Again" |
| After 3+ retries | "Try Again", "Return to Dashboard" |

---

## Core Principle #3: Attempt-Based Progress Verification

On initialization, verify `class_progress` against actual attempts. If there's a mismatch, reconcile.

### Implementation in `getOrCreateClassProgress()`

```javascript
export async function getOrCreateClassProgress(userId, classId, listId) {
  // ... existing get/create logic ...

  // Always verify against attempts
  const attempts = await getAttemptsForClassList(userId, classId, listId);
  const actualCompletedDays = countCompletedDaysFromAttempts(attempts);

  if (actualCompletedDays !== progress.currentStudyDay) {
    console.warn(`Reconciling: CSD=${progress.currentStudyDay}, actual=${actualCompletedDays}`);
    progress = await reconcileClassProgressFromAttempts(userId, classId, listId, attempts);
  }

  return progress;
}
```

### Error Handling: Block and Retry

If the attempts query or reconciliation fails, **block the session** and offer retry:

```javascript
// In DailySessionFlow.jsx
const [initError, setInitError] = useState(null);

async function initializeSession() {
  try {
    const progress = await getOrCreateClassProgress(userId, classId, listId);
    // ... continue
  } catch (err) {
    if (err.code === 'permission-denied' || err.code === 'unauthenticated') {
      setInitError({ type: 'auth', message: 'Session expired.' });
    } else {
      setInitError({ type: 'network', message: 'Failed to load progress.' });
    }
  }
}

// Render error overlay with retry options
```

---

## Fix for Issue #1: Stuck at `new-word-test` Phase (Day 2+)

### Problem
Student passes new word test on Day 2+ but gets stuck because `newWordsTestPassed` isn't set and phase doesn't advance to review.

### Root Cause
The "return from test" handler relies on sessionStorage to restore session state and update Firestore. If sessionStorage is cleared or the save fails silently, the student appears stuck.

### Solution: Check for Attempt on Initialization

During `initializeDailySession()` or the DailySessionFlow initialization effect, check if a passing new word attempt already exists for today:

```javascript
async function initializeDailySession(userId, classId, listId, assignmentSettings) {
  // Get current progress
  const progress = await getOrCreateClassProgress(userId, classId, listId)
  const dayNumber = (progress.currentStudyDay || 0) + 1
  const isFirstDay = dayNumber === 1
  const threshold = assignmentSettings.newWordRetakeThreshold || 0.95

  // NEW: Check if student already passed new word test today
  const todaysNewWordAttempt = await getNewWordAttemptForDay(userId, classId, dayNumber)
  const newWordsPassed = todaysNewWordAttempt && todaysNewWordAttempt.score >= threshold

  if (newWordsPassed) {
    if (isFirstDay) {
      // Day 1: New word test is final - session complete
      return {
        ...sessionConfig,
        startPhase: SESSION_PHASE.COMPLETE,
        newWordsTestPassed: true,
        newWordsTestScore: todaysNewWordAttempt.score
      }
    } else {
      // Day 2+: Move to review phase
      return {
        ...sessionConfig,
        startPhase: SESSION_PHASE.REVIEW_STUDY,
        newWordsTestPassed: true,
        newWordsTestScore: todaysNewWordAttempt.score
      }
    }
  }

  // Normal case: No passing attempt, start with new words
  return {
    ...sessionConfig,
    startPhase: SESSION_PHASE.NEW_WORDS_STUDY,
    newWordsTestPassed: false
  }
}
```

### Benefits
- **Idempotent**: Same result no matter how many times you refresh
- **No sessionStorage dependency**: Phase decision based on Firebase
- **Self-healing**: If "return" logic failed, next load fixes it
- **Crash recovery**: Works even if browser crashed during test

### Also Update session_states
When we detect a passing attempt but session_states doesn't reflect it, update it:

```javascript
if (newWordsPassed && !existingSessionState?.newWordsTestPassed) {
  await saveSessionState(userId, classId, listId, {
    newWordsTestPassed: true,
    newWordsTestScore: todaysNewWordAttempt.score,
    phase: isFirstDay ? SESSION_PHASE.COMPLETE : SESSION_PHASE.REVIEW_STUDY
  })
}
```

---

## Fix for Issue #2 & #3: Review Test Completion Failures

### Problem
- Issue #2: Student passes review test but day doesn't complete
- Issue #3: Session shows complete but CSD/TWI don't increment

### Root Cause
`completeSessionFromTest()` errors are swallowed, or sessionStorage is missing critical data like dayNumber causing day validation to fail.

### Solution: Check for Review Attempt and Reconcile on Initialization

During initialization, check if a review attempt exists for today. If it does but `class_progress.currentStudyDay` wasn't incremented, run completion logic:

```javascript
async function initializeDailySession(userId, classId, listId, assignmentSettings) {
  const progress = await getOrCreateClassProgress(userId, classId, listId)
  const dayNumber = (progress.currentStudyDay || 0) + 1
  const isFirstDay = dayNumber === 1

  // Check for today's attempts
  const todaysNewWordAttempt = await getNewWordAttemptForDay(userId, classId, dayNumber)
  const todaysReviewAttempt = await getReviewAttemptForDay(userId, classId, dayNumber)

  // NEW: Check if review test was completed but progress wasn't updated
  if (!isFirstDay && todaysReviewAttempt) {
    // Review attempt exists - session should be complete
    // Check if progress was actually updated
    const expectedCompletedDay = dayNumber
    const actualCompletedDay = progress.currentStudyDay

    if (actualCompletedDay < expectedCompletedDay) {
      // MISMATCH: Attempt exists but progress not updated
      // Run completion logic now
      console.warn(`Reconciling: Review attempt exists for day ${dayNumber} but currentStudyDay is ${actualCompletedDay}`)

      await reconcileSessionCompletion({
        userId,
        classId,
        listId,
        dayNumber,
        newWordAttempt: todaysNewWordAttempt,
        reviewAttempt: todaysReviewAttempt,
        progress
      })

      // Refresh progress after reconciliation
      const updatedProgress = await getClassProgress(userId, classId, listId)

      return {
        ...sessionConfig,
        startPhase: SESSION_PHASE.COMPLETE,
        progress: updatedProgress
      }
    }

    // Progress is correct, just show completion
    return {
      ...sessionConfig,
      startPhase: SESSION_PHASE.COMPLETE
    }
  }

  // Continue with normal initialization...
}
```

### Reconciliation Function

```javascript
async function reconcileSessionCompletion({
  userId, classId, listId, dayNumber,
  newWordAttempt, reviewAttempt, progress
}) {
  // Extract scores from attempts
  const newWordScore = newWordAttempt?.score || 0
  const reviewScore = reviewAttempt?.score || 1 // Review always "passes"

  // Calculate segment for graduation (recalculate from progress)
  const segment = calculateSegment(
    dayNumber,
    progress.studyDaysPerWeek || 5,
    progress.totalWordsIntroduced,
    progress.dailyPace || 10,
    progress.interventionLevel || 0
  )

  // Build session summary
  const sessionSummary = {
    dayNumber,
    newWordScore,
    reviewScore,
    wordsIntroduced: newWordAttempt?.wordsIntroduced || 0,
    wordsReviewed: reviewAttempt?.wordsTested || 0,
    completedAt: reviewAttempt?.submittedAt || new Date()
  }

  // Run the completion steps that may have failed
  try {
    // 1. Update class_progress
    await updateClassProgress(userId, classId, listId, sessionSummary)

    // 2. Graduate words (if not already done)
    if (segment) {
      const failedIds = reviewAttempt?.failedWordIds || []
      await graduateSegmentWords(userId, listId, segment, reviewScore, failedIds)
    }

    // 3. Update session_states to complete
    await saveSessionState(userId, classId, listId, {
      phase: SESSION_PHASE.COMPLETE,
      reviewTestScore: reviewScore,
      newWordsTestPassed: true,
      newWordsTestScore: newWordScore
    })

    console.log(`Session reconciliation complete for day ${dayNumber}`)
  } catch (err) {
    console.error('Session reconciliation failed:', err)
    // Don't swallow - let it surface
    throw err
  }
}
```

### Benefits
- **Self-healing**: Detects and fixes incomplete sessions
- **No data loss**: Uses attempt data to reconstruct what should have happened
- **Visible errors**: Reconciliation errors are thrown, not swallowed

---

## Additional Improvements

### 1. Remove sessionStorage Dependency in `completeSessionFromTest()`

Instead of reading from sessionStorage:

```javascript
// OLD (fragile)
const savedState = sessionStorage.getItem('dailySessionState')
const { segment, interventionLevel } = JSON.parse(savedState)
```

Query/calculate from Firestore:

```javascript
// NEW (robust)
const progress = await getClassProgress(userId, classId, listId)
const segment = calculateSegment(dayNumber, progress)
const interventionLevel = calculateInterventionLevel(progress.recentSessions)
```

### 2. Stop Swallowing Errors in Test Components

In MCQTest.jsx and TypedTest.jsx, change:

```javascript
// OLD (swallows error)
try {
  await completeSessionFromTest({...})
} catch (err) {
  console.error('Failed:', err)
  // Continues as if success
}
```

To:

```javascript
// NEW (surfaces error)
try {
  await completeSessionFromTest({...})
} catch (err) {
  console.error('Session completion failed:', err)
  setCompletionError(err.message)
  // Show retry button to user
  return
}
```

### 3. Make Day Validation Failure Visible

In `updateClassProgress()`, change:

```javascript
// OLD (silent skip)
if (sessionSummary.dayNumber !== expectedDay) {
  console.warn(`Day mismatch`)
  return current
}
```

To:

```javascript
// NEW (throws or logs loudly)
if (sessionSummary.dayNumber !== expectedDay) {
  const error = new Error(
    `Day validation failed: expected ${expectedDay}, got ${sessionSummary.dayNumber}`
  )
  console.error(error)
  // Option A: Throw
  throw error
  // Option B: Log to monitoring and continue with safeguard
}
```

---

## Implementation Order

### Phase 1: Quick Wins (Low Risk)
1. Add attempt check to initialization for Issue #1
2. Update session_states when mismatch detected

### Phase 2: Completion Robustness
3. Add reconciliation logic for Issues #2 & #3
4. Remove sessionStorage dependency in `completeSessionFromTest()`

### Phase 3: Error Visibility
5. Stop swallowing errors in test components
6. Make day validation failures visible/alerting

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/services/studyService.js` | Add attempt checks to `initializeDailySession()`, add `reconcileSessionCompletion()`, remove sessionStorage reads in `completeSessionFromTest()` |
| `src/pages/DailySessionFlow.jsx` | Handle new `startPhase` from initialization, simplify "return from test" logic |
| `src/pages/MCQTest.jsx` | Surface `completeSessionFromTest()` errors to UI |
| `src/pages/TypedTest.jsx` | Surface `completeSessionFromTest()` errors to UI |
| `src/services/progressService.js` | Make day validation failure visible |
| `src/services/db.js` | Add `getReviewAttemptForDay()` if not exists |

---

## Summary

The core fix is **moving from "return-based" state management to "initialization-based" state recovery**:

| Before | After |
|--------|-------|
| "Return" handler must update state | Initialization checks attempts and determines state |
| Depends on sessionStorage | Depends on Firebase attempts |
| Fragile to browser/network issues | Self-healing on every load |
| Silent failures | Visible failures with reconciliation |

This approach makes the session flow **idempotent** - the same result regardless of how you arrive at the page.

---

## Remaining Fragility After Proposed Fixes

### 1. `submitTestAttempt()` Failure - CRITICAL

**The entire init-based fix depends on the attempt being saved.**

If `submitTestAttempt()` fails:
- No attempt record exists
- Init can't detect that test was taken
- No recovery possible

| Status | Impact |
|--------|--------|
| ❌ Not addressed | This is the foundation - if it fails, everything else fails |

**Recommendation:** Add retry + verification for attempt writes:

```javascript
async function submitAttemptWithRetry(attemptData, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const ref = await addDoc(collection(db, 'attempts'), attemptData)

      // Verify it exists
      const verification = await getDoc(ref)
      if (verification.exists()) {
        return { success: true, id: ref.id }
      }
    } catch (err) {
      console.error(`Attempt write failed (try ${attempt}/${maxRetries}):`, err)
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500))
      }
    }
  }

  // All retries failed - show error to user
  throw new Error('Failed to save test attempt after multiple retries')
}
```

---

### 2. `processTestResults()` Batch Failure

Updates word statuses (PASSED/FAILED) after test.

| Status | Impact |
|--------|--------|
| ⚠️ Partially addressed | Init fix doesn't help here - word statuses could be wrong |

**Impact:** Words might have wrong status, affecting future review queues.

**Recommendation:** Make recoverable - can re-derive statuses from attempt's answers if needed:

```javascript
async function reconcileWordStatuses(userId, listId, attempt) {
  // Re-derive correct statuses from attempt answers
  for (const answer of attempt.answers) {
    const currentState = await getStudyState(userId, answer.wordId)
    const correctStatus = answer.correct ? 'PASSED' : 'FAILED'

    if (currentState?.status !== correctStatus) {
      await updateStudyState(userId, answer.wordId, { status: correctStatus })
    }
  }
}
```

---

### 3. `initializeNewWordStates()` Batch Failure (Phase 0)

Creates study_state documents for new words.

| Status | Impact |
|--------|--------|
| ⚠️ Not addressed | Partial failure = some words missing states |

**Impact:** Missing study_states causes errors downstream during test submission.

**Recommendation:** Make idempotent + verify:

```javascript
async function initializeNewWordStates(userId, listId, words, dayNumber) {
  const batch = writeBatch(db)

  for (const word of words) {
    const ref = doc(db, `users/${userId}/study_states/${word.id}`)
    const existing = await getDoc(ref)

    if (!existing.exists()) {
      batch.set(ref, {
        status: 'NEVER_TESTED',
        listId,
        introducedOnDay: dayNumber,
        // ... other fields
      })
    }
  }

  await batch.commit()

  // Verify all exist
  for (const word of words) {
    const ref = doc(db, `users/${userId}/study_states/${word.id}`)
    const check = await getDoc(ref)
    if (!check.exists()) {
      throw new Error(`Failed to create study_state for word ${word.id}`)
    }
  }
}
```

---

### 4. `graduateSegmentWords()` Failure

Marks words as MASTERED after review test.

| Status | Impact |
|--------|--------|
| ✅ Mostly addressed | Reconciliation can re-run this |

**Caveat:** Need to ensure idempotent (doesn't double-graduate).

Already handled by reconciliation logic - just ensure `graduateSegmentWords()` checks current status before updating.

---

### 5. Error Visibility in UI

| Status | Impact |
|--------|--------|
| ⚠️ Partially addressed | Errors still swallowed, user doesn't know |

**Recommendation:** Surface errors to UI:

```javascript
// In test components
const [submissionError, setSubmissionError] = useState(null)

try {
  await submitTestAttempt(...)
} catch (err) {
  setSubmissionError('Failed to save your test. Please try again.')
  return // Don't proceed
}

// Show retry button if error
{submissionError && (
  <div className="error">
    {submissionError}
    <button onClick={handleRetry}>Retry</button>
  </div>
)}
```

---

## Complete Fix Priority List

| Priority | Fix | Addresses |
|----------|-----|-----------|
| **P0** | `submitTestAttempt()` retry + verify | Foundation for all recovery |
| **P1** | Init-based phase detection | Issue #1 (stuck at new-word-test) |
| **P2** | Init-based reconciliation | Issues #2, #3 (completion failures) |
| **P3** | `initializeNewWordStates()` idempotent | Phase 0 robustness |
| **P4** | `processTestResults()` recoverable | Word status accuracy |
| **P5** | Error visibility in UI | User feedback |

---

## Files to Modify (Complete List)

| File | Changes |
|------|---------|
| `src/services/db.js` | Add `submitAttemptWithRetry()`, add `getReviewAttemptForDay()` |
| `src/services/studyService.js` | Add attempt checks to init, add reconciliation, make `initializeNewWordStates()` idempotent |
| `src/pages/DailySessionFlow.jsx` | Handle `startPhase` from init, simplify return logic |
| `src/pages/MCQTest.jsx` | Use retry for attempt, surface errors to UI |
| `src/pages/TypedTest.jsx` | Use retry for attempt, surface errors to UI |
| `src/services/progressService.js` | Make day validation visible |

---

## Refined Solution: CSD/TWI Reconciliation Logic (Ready to Implement)

This is the finalized logic for verifying and reconciling `class_progress` against actual attempts.

### Input

Query **8 most recent attempts** for this user/class/list, ordered by `submittedAt` descending.

```javascript
const attemptsRef = collection(db, 'attempts');
const q = query(attemptsRef,
  where('studentId', '==', userId),
  where('classId', '==', classId),
  where('listId', '==', listId),
  orderBy('submittedAt', 'desc'),
  limit(8)
);
const snapshot = await getDocs(q);
const attempts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

### Algorithm

**Step 1:** Find the highest `studyDay` value among the attempts.

**Step 2:** Determine CSD based on conditions:

| Highest studyDay | Condition | CSD |
|------------------|-----------|-----|
| None (no attempts) | - | 0 |
| 1 | New test `passed === true` | 1 |
| 1 | New test `passed === false` or missing | 0 |
| > 1 | Review test exists for that studyDay | studyDay |
| > 1 | No review test for that studyDay | studyDay - 1 |

**Step 3:** Determine TWI:

| CSD | TWI |
|-----|-----|
| 0 | 0 |
| > 0 | `newWordEndIndex` from new test where `studyDay === CSD` |

### Implementation

```javascript
function calculateCSDAndTWIFromAttempts(attempts) {
  if (attempts.length === 0) {
    return { csd: 0, twi: 0 };
  }

  // Find highest studyDay
  const highestStudyDay = Math.max(...attempts.map(a => a.studyDay || 0));

  if (highestStudyDay === 0) {
    return { csd: 0, twi: 0 };
  }

  // Get attempts for the highest studyDay
  const highestDayAttempts = attempts.filter(a => a.studyDay === highestStudyDay);
  const newTestForHighestDay = highestDayAttempts.find(a => a.sessionType === 'new');
  const reviewTestForHighestDay = highestDayAttempts.find(a => a.sessionType === 'review');

  let csd;

  if (highestStudyDay === 1) {
    // Day 1: Check if new test passed
    csd = (newTestForHighestDay?.passed === true) ? 1 : 0;
  } else {
    // Day 2+: Check if review test exists
    csd = reviewTestForHighestDay ? highestStudyDay : highestStudyDay - 1;
  }

  // Determine TWI
  let twi = 0;
  if (csd > 0) {
    // Find new test attempt where studyDay === CSD
    const newTestForCSD = attempts.find(a => a.studyDay === csd && a.sessionType === 'new');
    twi = newTestForCSD?.newWordEndIndex || 0;
  }

  return { csd, twi };
}
```

### Integration with `getOrCreateClassProgress()`

```javascript
export async function getOrCreateClassProgress(userId, classId, listId) {
  const docId = getProgressDocId(classId, listId);
  const progressRef = doc(db, `users/${userId}/class_progress`, docId);

  const snapshot = await getDoc(progressRef);
  let progress;

  if (snapshot.exists()) {
    progress = { id: snapshot.id, ...snapshot.data() };
  } else {
    // Create new progress document
    const newProgress = createClassProgress(classId, listId);
    await setDoc(progressRef, {
      ...newProgress,
      programStartDate: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    progress = { id: docId, ...newProgress };
  }

  // Always verify against attempts
  const attempts = await getRecentAttemptsForClassList(userId, classId, listId, 8);
  const { csd, twi } = calculateCSDAndTWIFromAttempts(attempts);

  // Check for mismatch
  if (csd !== progress.currentStudyDay || twi !== progress.totalWordsIntroduced) {
    console.warn(`Reconciling class_progress: stored CSD=${progress.currentStudyDay}, actual=${csd}; stored TWI=${progress.totalWordsIntroduced}, actual=${twi}`);

    // Update progress document
    const updates = {
      currentStudyDay: csd,
      totalWordsIntroduced: twi,
      updatedAt: Timestamp.now()
    };

    await updateDoc(progressRef, updates);
    progress = { ...progress, ...updates };
  }

  return progress;
}
```

### Edge Cases Handled

| Scenario | CSD | TWI |
|----------|-----|-----|
| No attempts at all | 0 | 0 |
| Only failed Day 1 attempt | 0 | 0 |
| Day 1 passed | 1 | Day 1 new test's `newWordEndIndex` |
| Day 5 new + review complete | 5 | Day 5 new test's `newWordEndIndex` |
| Day 5 new only (no review yet) | 4 | Day 4 new test's `newWordEndIndex` |
| 6 duplicate Day 3 review submissions | 3 | Day 3 new test's `newWordEndIndex` |

### Why 8 Attempts?

- Accounts for duplicate submissions (retry scenarios)
- Covers current day + previous day's attempts
- More than 6 duplicates indicates a deeper issue not worth planning for
- Keeps query cost low (~0.00048 cents per init)

---

## Refined Solution #2: Init-Based Phase Detection (Ready to Implement)

This is the finalized logic for determining the starting phase based on attempts. It runs AFTER CSD/TWI reconciliation, using the same 8 attempts already fetched.

### Key Insight: Post-Reconciliation State

After CSD/TWI reconciliation runs, certain states become **impossible** for the current `dayNumber` (CSD + 1):

| "Impossible" State | Why Impossible |
|--------------------|----------------|
| Day 1 with passed new test | If passed, CSD would be 1, so dayNumber would be 2 |
| Day 2+ with passed new + review exists | If both exist, CSD would be that day, so dayNumber would be next |

These states indicate reconciliation edge cases (race conditions, transient failures). We handle them gracefully by showing COMPLETE and letting re-entry retry reconciliation.

### Simplified Logic

Since study phases can be skipped (no gates), the only meaningful phase detection is:
- **Day 2+ mid-session**: New test passed but no review yet → skip to REVIEW_STUDY
- **Everything else**: Start fresh at NEW_WORDS_STUDY

The "cost" of re-doing study phases is minimal (~30 seconds of clicking through flashcards).

### Implementation

```javascript
/**
 * Determine starting phase based on attempts for current day.
 * Runs AFTER CSD/TWI reconciliation.
 *
 * @param {Array} attempts - The 8 recent attempts (already fetched for reconciliation)
 * @param {number} dayNumber - Current day (reconciled CSD + 1)
 * @returns {string} SESSION_PHASE constant
 */
function determineStartingPhase(attempts, dayNumber) {
  const dayAttempts = attempts.filter(a => a.studyDay === dayNumber);
  const newTest = dayAttempts.find(a => a.sessionType === 'new');
  const reviewTest = dayAttempts.find(a => a.sessionType === 'review');

  // Day 2+: mid-session (new passed, no review yet) → resume at review
  if (dayNumber > 1 && newTest?.passed && !reviewTest) {
    return SESSION_PHASE.REVIEW_STUDY;
  }

  // "Impossible" states after reconciliation → treat as complete
  // (Graceful handling - student can exit and re-enter to retry reconciliation)
  if (dayNumber === 1 && newTest?.passed) {
    return SESSION_PHASE.COMPLETE;
  }
  if (dayNumber > 1 && newTest?.passed && reviewTest) {
    return SESSION_PHASE.COMPLETE;
  }

  // Normal: fresh start (no attempts, failed new test, or next day)
  return SESSION_PHASE.NEW_WORDS_STUDY;
}
```

### Integration with `initializeDailySession()`

```javascript
export async function initializeDailySession(userId, classId, listId, assignmentSettings) {
  // Step 1: Get reconciled progress (includes CSD/TWI fix)
  // getOrCreateClassProgress now returns { progress, attempts }
  const { progress, attempts } = await getOrCreateClassProgress(userId, classId, listId);

  // Step 2: Calculate current day
  const dayNumber = (progress.currentStudyDay || 0) + 1;

  // Step 3: Determine starting phase from attempts
  const startPhase = determineStartingPhase(attempts, dayNumber);

  // Step 4: Build session config based on phase
  if (startPhase === SESSION_PHASE.COMPLETE) {
    // Extract scores from attempts for display
    const dayAttempts = attempts.filter(a => a.studyDay === dayNumber);
    const newTest = dayAttempts.find(a => a.sessionType === 'new');
    const reviewTest = dayAttempts.find(a => a.sessionType === 'review');

    return {
      phase: SESSION_PHASE.COMPLETE,
      dayNumber,
      newWordsTestScore: newTest?.score || null,
      reviewTestScore: reviewTest?.score || null,
      // Skip graduation count - not critical for edge case display
    };
  }

  if (startPhase === SESSION_PHASE.REVIEW_STUDY) {
    const newTest = attempts.find(a => a.studyDay === dayNumber && a.sessionType === 'new');

    return {
      phase: SESSION_PHASE.REVIEW_STUDY,
      dayNumber,
      newWordsTestPassed: true,
      newWordsTestScore: newTest?.score || null,
      // ... load review segment words
    };
  }

  // Normal: NEW_WORDS_STUDY
  return {
    phase: SESSION_PHASE.NEW_WORDS_STUDY,
    dayNumber,
    newWordsTestPassed: false,
    // ... normal initialization
  };
}
```

### Modify `getOrCreateClassProgress()` to Return Attempts

Since we already query attempts for CSD/TWI reconciliation, return them to avoid a second query:

```javascript
export async function getOrCreateClassProgress(userId, classId, listId) {
  // ... existing progress get/create logic ...

  // Fetch attempts for reconciliation
  const attempts = await getRecentAttemptsForClassList(userId, classId, listId, 8);
  const { csd, twi } = calculateCSDAndTWIFromAttempts(attempts);

  // ... reconciliation logic ...

  // Return BOTH progress and attempts
  return { progress, attempts };
}
```

### Truth Table

| dayNumber | newTest exists | newTest.passed | reviewTest exists | Starting Phase |
|-----------|----------------|----------------|-------------------|----------------|
| 1 | No | - | - | NEW_WORDS_STUDY |
| 1 | Yes | false | - | NEW_WORDS_STUDY |
| 1 | Yes | true | - | COMPLETE* |
| 2+ | No | - | - | NEW_WORDS_STUDY |
| 2+ | Yes | false | - | NEW_WORDS_STUDY |
| 2+ | Yes | true | No | REVIEW_STUDY |
| 2+ | Yes | true | Yes | COMPLETE* |

*These are "impossible" states after reconciliation - handled gracefully.

### Why COMPLETE for "Impossible" States?

When we detect an "impossible" state (e.g., Day 1 with passed new test but CSD still 0):

1. **Don't block the student** - Show COMPLETE screen with available scores
2. **Self-healing on re-entry** - Student exits, re-enters, reconciliation runs again
3. **Transient failures resolve** - Network issues, race conditions fix themselves
4. **No complex retry logic needed** - COMPLETE is a safe exit point

### Files to Modify

| File | Changes |
|------|---------|
| `src/services/progressService.js` | Modify `getOrCreateClassProgress()` to return `{ progress, attempts }` |
| `src/services/studyService.js` | Add `determineStartingPhase()`, update `initializeDailySession()` to use it |
| `src/pages/DailySessionFlow.jsx` | Handle `startPhase` from initialization, render appropriate phase |

### Benefits

- **Simple logic**: Only one special case (Day 2+ mid-session)
- **No risk**: Study phases can be skipped, so re-doing them is fine
- **Self-healing**: "Impossible" states resolve on re-entry
- **Reuses data**: Same 8 attempts used for CSD/TWI and phase detection
- **Idempotent**: Same result regardless of how you arrive at the page

---

## Refined Solution #3: Bulletproof Attempt Writing

Attempts are the source of truth for reconciliation. They **must** write successfully and with correct data.

### The Original Concern

**Current flow:**
```
1. Session init → dayNumber = CSD + 1 → stored in sessionStorage/props
2. Navigate to test → dayNumber passed via location.state/props
3. Submit test → attempt written with studyDay from props
```

**Perceived failure modes:**
- sessionStorage cleared by browser (memory pressure, backgrounded tab)
- location.state lost on page refresh
- Stale dayNumber if student had multiple tabs open

### Why These Aren't Actually Problems

**Key insight:** If you're in the test component and can click "Submit", you MUST have `props.dayNumber`.

1. **React props persist in memory** as long as the component is mounted
2. **No browser scenario exists** where:
   - Component stays mounted and functional
   - User can interact with "Submit" button
   - But `props.dayNumber` is undefined/lost

3. **If something catastrophic happens** (memory pressure, crash), the **entire page reloads**, forcing re-initialization through the normal flow - giving you fresh valid props.

4. **sessionStorage is only used** for session state resume, not for attempt submission. The `dayNumber` in the test component comes from props passed during navigation.

### Multi-Tab Race Condition is Already Handled

Scenario:
- Tab A and Tab B both start when CSD = n
- Both initialized with dayNumber = n + 1
- Tab A completes, CSD becomes n + 1
- Tab B submits later

**Why this is safe:**
- Tab B writes attempt with studyDay = n + 1 (correct - this was the day it was working on)
- Existing guard in `updateClassProgress()` blocks CSD increment if `dayNumber !== expectedDay`
- CSD only increments once (from Tab A)
- Duplicate attempts are harmless for reconciliation (uses `max(studyDay)`, not sum)

**No additional Firebase read needed.** Just use `props.dayNumber`.

### The Real Problem: Transient Network Failures

The actual fragility is **network failures during write**, not stale data. A single failed write attempt means:
- Student's work is lost
- No retry mechanism
- Must redo entire test

### The Solution: Retry Logic with Preserved State

Since attempts are critical, add retry logic that:
- **Retries transient failures** (network blips, timeouts)
- **Preserves answers** in React state on failure
- **Prevents accidental navigation** away from unsaved work
- **Uses props.dayNumber** directly (always valid if component is mounted)

### Retry Logic for Attempt Writes

Since attempts are the source of truth for reconciliation, they **must** write successfully. Add retry logic with:
- **Exponential backoff** with jitter (prevents thundering herd)
- **Total timeout** cap at 15s (prevents 90s+ worst-case wait)
- **Only retry transient errors** (don't retry permission/auth errors)

```javascript
/**
 * Check if error is transient (worth retrying)
 */
function isTransientError(error) {
  const transientCodes = [
    'unavailable',
    'deadline-exceeded',
    'resource-exhausted',
    'cancelled',
    'unknown',
    'internal',
    'aborted'
  ];
  return transientCodes.includes(error?.code) ||
         error?.message?.includes('network') ||
         error?.message?.includes('timeout');
}

/**
 * Add jitter to prevent thundering herd
 * Returns delay +/- 25%
 */
function addJitter(baseDelayMs) {
  const jitter = baseDelayMs * 0.25;
  return baseDelayMs + (Math.random() * jitter * 2 - jitter);
}

/**
 * Wrap a promise with a timeout
 */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), ms)
    )
  ]);
}

/**
 * Submit test attempt with retry logic.
 * Calculates score internally and returns all values needed by caller.
 * Attempts are critical - reconciliation depends on them.
 *
 * @param {string} userId
 * @param {string} testId - The list ID (used as test identifier)
 * @param {Array} results - Array of { wordId, correct, ... } from test
 * @param {Object} options - { classId, testType, sessionType, studyDay, sessionContext, passThreshold }
 * @param {number} maxRetries - Max retry attempts (default 3)
 * @param {number} totalTimeoutMs - Total operation timeout (default 15000ms)
 * @returns {Promise<Object>} { attemptId, score, correct, total, failed, passed, results }
 */
async function submitTestAttemptWithRetry(
  userId,
  testId,
  results,
  options = {},
  maxRetries = 3,
  totalTimeoutMs = 15000
) {
  const { classId, testType = 'mcq', sessionType, studyDay, sessionContext, passThreshold = 0.8 } = options;

  // Calculate score locally - no dependency on processTestResults
  const total = results.length;
  const correct = results.filter(r => r.correct).length;
  const score = total > 0 ? correct / total : 0;
  const failed = results.filter(r => !r.correct).map(r => r.wordId);
  const passed = score >= passThreshold;

  // Convert results to answers format expected by submitTestAttempt
  const answers = results.map(r => ({
    wordId: r.wordId,
    isCorrect: r.correct,
    ...r // preserve any other fields (userAnswer, correctAnswer, etc.)
  }));

  const startTime = Date.now();
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Check if we've exceeded total timeout
    if (Date.now() - startTime > totalTimeoutMs) {
      throw new Error(`Operation timed out after ${totalTimeoutMs}ms`);
    }

    try {
      const attemptResult = await submitTestAttempt(
        userId,
        testId,
        answers,
        total,
        classId,
        testType,
        sessionType,
        studyDay,
        passed,
        sessionContext
      );

      // Return all values caller needs
      return {
        attemptId: attemptResult.id,
        score,
        correct,
        total,
        failed,
        passed,
        results
      };
    } catch (error) {
      lastError = error;
      console.error(`Attempt write failed (try ${attempt + 1}/${maxRetries}):`, error);

      // Don't retry non-transient errors (auth, permission)
      if (!isTransientError(error)) {
        throw error;
      }

      // Exponential backoff with jitter: ~1s, ~2s, ~4s
      if (attempt < maxRetries - 1) {
        const baseDelay = Math.pow(2, attempt) * 1000;
        const delayWithJitter = addJitter(baseDelay);

        // Don't delay past total timeout
        const remainingTime = totalTimeoutMs - (Date.now() - startTime);
        const actualDelay = Math.min(delayWithJitter, remainingTime);

        if (actualDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, actualDelay));
        }
      }
    }
  }

  // All retries failed - this is critical
  throw new Error(`Failed to write attempt after ${maxRetries} retries: ${lastError.message}`);
}
```

### The Gate Pattern: Attempt Must Succeed Before Any Progression

**Critical principle:** No phase transition (moveToReviewPhase, completeSession) can happen unless the attempt write succeeds.

The mechanism is simple async/await flow control:
1. `await submitTestAttemptWithRetry(...)` - blocks until success
2. If it throws, catch block prevents all downstream code from executing
3. Student stays on test page with answers preserved

This applies to **both** test completion scenarios:

| Test Type | On Success | On Failure |
|-----------|------------|------------|
| Day 2+ New Word Test | `moveToReviewPhase()` runs | Nothing runs, student stays on page |
| Day 1 New Word / Review Test | `completeSession()` runs | Nothing runs, student stays on page |

### Error Handling in Test Components

The test component must handle the final failure and show user feedback:

```javascript
// In MCQTest.jsx handleSubmit - Day 1 or Review Test
const handleSubmit = async () => {
  setIsSubmitting(true);
  setSubmitError(null);

  try {
    // Process answers for display/scoring
    await processTestResults(...);

    // GATE: Attempt MUST succeed before any progression
    await submitTestAttemptWithRetry(userId, classId, listId, {
      ...attemptData,
      studyDay: dayNumber  // From props - always valid if mounted
    });

    // Only reached if attempt succeeded
    // Now safe to update progress/session state
    if (isDay1 || testType === 'review') {
      await completeSessionFromTest(...);
    }

    // Navigate on success
    navigate('/study', { state: { testCompleted: true, score } });

  } catch (error) {
    // Critical failure - attempt not written
    // NO navigation, NO completeSession, NO moveToReviewPhase
    setSubmitError('Failed to save your test results. Please try again.');
    console.error('Submit failed:', error);
    // Student stays on page with answers preserved in React state
  } finally {
    setIsSubmitting(false);
  }
};
```

```javascript
// In MCQTest.jsx handleSubmit - Day 2+ New Word Test
const handleSubmit = async () => {
  setIsSubmitting(true);
  setSubmitError(null);

  try {
    await processTestResults(...);

    // GATE: Attempt MUST succeed before moving to review phase
    await submitTestAttemptWithRetry(userId, classId, listId, {
      ...attemptData,
      studyDay: dayNumber,
      sessionType: 'new'
    });

    // Only reached if attempt succeeded
    // Safe to transition to review phase
    await moveToReviewPhase(...);

    navigate('/study', { state: { newTestPassed: true } });

  } catch (error) {
    // Critical failure - attempt not written
    // NO moveToReviewPhase - student stays here
    setSubmitError('Failed to save your test results. Please try again.');
    console.error('Submit failed:', error);
  } finally {
    setIsSubmitting(false);
  }
};
```

### Why This Pattern Matters

Without the gate:
```javascript
// BROKEN: Error swallowed, progression happens anyway
try {
  await submitTestAttempt(...);
} catch (err) {
  console.error(err); // Swallowed
}
await completeSession(...);  // Runs even if attempt failed!
navigate('/success');        // Student sees success but data is lost
```

With the gate:
```javascript
// CORRECT: Progression blocked on failure
try {
  await submitTestAttemptWithRetry(...);
  await completeSession(...);  // Only runs if attempt succeeded
  navigate('/success');        // Only navigates if everything succeeded
} catch (err) {
  setError(err.message);       // Show error, stay on page
}
```

The key is that `await` blocks until the promise resolves. If it rejects (throws), execution jumps to the `catch` block, skipping all subsequent code in the `try` block.

### Why Retry is Critical

| Without Retry | With Retry |
|---------------|------------|
| Network blip → attempt lost | Network blip → retried → success |
| Firestore timeout → no record | Timeout → retried → success |
| Student must redo test | Student's work preserved |
| Reconciliation can't see test | Reconciliation has accurate data |

### Exit Confirmation (Prevent Accidental Data Loss)

When submit fails and answers are preserved in React state, prevent accidental navigation away.

#### 1. Browser Tab Close (`beforeunload`)

Shows browser's native "Changes may not be saved" dialog when closing tab/window:

```javascript
// In MCQTest.jsx / TypedTest.jsx
useEffect(() => {
  const handleBeforeUnload = (e) => {
    // Only prompt if we have answers AND haven't successfully submitted
    if (answers.length > 0 && !submitSuccess) {
      e.preventDefault();
      e.returnValue = ''; // Required for Chrome
      return ''; // Shows browser's generic confirmation
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [answers, submitSuccess]);
```

**Note:** Modern browsers show a generic message - you cannot customize the text.

#### 2. In-App Navigation (Dashboard button, back button)

Custom modal for React Router navigation:

```javascript
// State for exit warning
const [showExitWarning, setShowExitWarning] = useState(false);
const [pendingNavigation, setPendingNavigation] = useState(null);

// Intercept navigation attempts when there's unsaved work
const handleNavigationAttempt = (destination) => {
  if (submitError && answers.length > 0) {
    setShowExitWarning(true);
    setPendingNavigation(destination);
    return; // Block navigation
  }
  navigate(destination);
};

// Exit warning modal
{showExitWarning && (
  <div className="modal-overlay">
    <div className="modal">
      <h3>Your answers haven't been saved</h3>
      <p>If you leave now, you'll need to retake this test.</p>
      <div className="modal-buttons">
        <button onClick={() => setShowExitWarning(false)}>
          Stay and Retry
        </button>
        <button
          className="danger"
          onClick={() => {
            setShowExitWarning(false);
            navigate(pendingNavigation);
          }}
        >
          Leave Anyway
        </button>
      </div>
    </div>
  </div>
)}
```

#### When to Show Confirmation

| Condition | beforeunload | In-app modal |
|-----------|--------------|--------------|
| Answers exist + submit never attempted | Yes | No (let them leave) |
| Answers exist + submit failed | Yes | Yes |
| Submit succeeded | No | No |

### When to Give Up (After 15s Total Timeout)

After 15s total timeout with no success:

| Step | Action |
|------|--------|
| 1 | Promise rejects with timeout/retry error |
| 2 | Show clear error: "Unable to save your answers. Please try again." |
| 3 | **Do NOT proceed** with session completion (no progress update) |
| 4 | Student's answers are **preserved in React state** (not lost) |
| 5 | Show "Try Again" button for manual retry |
| 6 | Log error for monitoring/debugging |

**Why this is safe:**
- We never falsely mark a session complete if the attempt wasn't recorded
- Student can keep retrying (answers preserved in memory)
- If network is truly down, they try again later
- Their work only lost if they navigate away

**Error types and responses:**

| Error Type | Action |
|------------|--------|
| Transient (network, timeout) | Retry up to 15s, then show "Try Again" button |
| Auth expired | Don't retry - redirect to login |
| Permission denied | Don't retry - show support contact |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/MCQTest.jsx` | Add retry logic around `submitTestAttempt()`, use `props.dayNumber` |
| `src/pages/TypedTest.jsx` | Add retry logic around `submitTestAttempt()`, use `props.dayNumber` |

### Benefits

- **No additional Firebase reads** - props.dayNumber is always available
- **Bulletproof**: No query that could fail and block legitimate submissions
- **Multi-tab safe**: Existing `updateClassProgress()` guard handles race conditions
- **Works with reconciliation**: Attempts always have valid studyDay from init
- **Resilient**: Transient failures don't lose student work (retry logic)
- **Minimal code change**: Just wrap existing submit with retry logic

---

## Solution #4: System Logging

Log anomalies to Firebase for monitoring and debugging. Only log when something unusual happens - not normal operations.

### Collection: `system_logs`

### Events to Log

#### 1. CSD/TWI Reconciliation
When `calculateCSDAndTWIFromAttempts()` returns different values than stored:

```javascript
{
  type: 'csd_twi_reconciled',
  severity: 'warning',
  userId,
  classId,
  listId,
  stored: { csd: 3, twi: 30 },
  calculated: { csd: 4, twi: 40 },
  attemptCount: 8,
  timestamp: serverTimestamp()
}
```

#### 2. Attempt Write Retry Succeeded
When first attempt failed but retry succeeded:

```javascript
{
  type: 'attempt_retry_succeeded',
  severity: 'warning',
  userId,
  classId,
  listId,
  studyDay: 5,
  sessionType: 'new', // or 'review'
  retriesNeeded: 2,
  totalDurationMs: 3200,
  errorCodes: ['unavailable', 'unavailable'],
  timestamp: serverTimestamp()
}
```

#### 3. Attempt Write Failed (All Retries Exhausted)
When student saw error, couldn't save test:

```javascript
{
  type: 'attempt_write_failed',
  severity: 'error',
  userId,
  classId,
  listId,
  studyDay: 5,
  sessionType: 'new',
  retries: 3,
  totalDurationMs: 15000,
  lastError: 'unavailable',
  userAgent: navigator.userAgent,
  timestamp: serverTimestamp()
}
```

#### 4. Impossible Phase State Detected
When `determineStartingPhase()` finds a state that shouldn't exist after reconciliation:

```javascript
{
  type: 'impossible_phase_detected',
  severity: 'error',
  userId,
  classId,
  listId,
  dayNumber: 1,
  hasPassedNewTest: true,
  hasReviewTest: false,
  csd: 0, // Should be 1 if new test passed
  actionTaken: 'showed_complete',
  timestamp: serverTimestamp()
}
```

#### 5. Session Completion Reconciled
When review attempt exists but CSD wasn't incremented, reconciliation fixed it:

```javascript
{
  type: 'session_completion_reconciled',
  severity: 'warning',
  userId,
  classId,
  listId,
  dayNumber: 5,
  reviewAttemptId: 'abc123',
  graduationRan: true,
  timestamp: serverTimestamp()
}
```

### Helper Function

```javascript
async function logSystemEvent(eventType, data, severity = 'warning') {
  try {
    await addDoc(collection(db, 'system_logs'), {
      type: eventType,
      severity,
      ...data,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    // Don't let logging failure break the app
    console.error('Failed to write system log:', err);
  }
}

// Usage
await logSystemEvent('csd_twi_reconciled', {
  userId,
  classId,
  listId,
  stored: { csd: progress.currentStudyDay, twi: progress.totalWordsIntroduced },
  calculated: { csd, twi },
  attemptCount: attempts.length
});
```

### What NOT to Log

| Skip This | Why |
|-----------|-----|
| Successful normal submissions | Noise, expensive |
| Reconciliation ran but found nothing | Noise |
| Session initialized normally | Noise |
| Every individual retry attempt | Just log final outcome |

### Cleanup

Add periodic cleanup - logs only useful for recent debugging:

```javascript
// Run weekly or monthly via Cloud Function or manual
async function cleanupOldLogs() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const q = query(
    collection(db, 'system_logs'),
    where('timestamp', '<', thirtyDaysAgo)
  );

  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}
```

At current scale, manual quarterly cleanup is sufficient.
