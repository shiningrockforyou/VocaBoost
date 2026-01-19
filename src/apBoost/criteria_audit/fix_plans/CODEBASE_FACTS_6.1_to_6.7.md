# CODEBASE_FACTS__UNK__6.1_to_6.7.md

**Generated:** 2026-01-14
**Chunk ID:** `UNK__6.1_to_6.7`
**Scope:** Error handling, validation, user-facing errors (Sections 6.1-6.7)

---

## 1) Canonical Data Schema / Source-of-Truth

**Found: Yes**

### Session Schema

**Primary Definition:** `src/apBoost/services/apSessionService.js:49-67`

```javascript
const sessionData = {
  userId,                       // string - required
  testId,                       // string - required
  assignmentId,                 // string | null - optional
  sessionToken: generateSessionToken(), // string - required
  status: SESSION_STATUS.IN_PROGRESS,   // enum - required
  attemptNumber,                // number - required
  currentSectionIndex: 0,       // number - required
  currentQuestionIndex: 0,      // number - required
  sectionTimeRemaining: {},     // object - required (empty default)
  answers: {},                  // object - required (empty default)
  flaggedQuestions: [],         // array - required (empty default)
  annotations: {},              // object - required (empty default)
  strikethroughs: {},           // object - required (empty default)
  lastHeartbeat: serverTimestamp(), // Timestamp - required
  lastAction: serverTimestamp(),    // Timestamp - required
  startedAt: serverTimestamp(),     // Timestamp - required
  completedAt: null,            // Timestamp | null - nullable
}
```

**Status Constants:** `src/apBoost/utils/apTypes.js:34-39`
```javascript
export const SESSION_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
}
```

### Question Schema

**Inferred from usage in:** `src/apBoost/services/apTestService.js` and `src/apBoost/utils/apTypes.js`

**Type Constants:** `src/apBoost/utils/apTypes.js:6-12`
```javascript
export const QUESTION_TYPE = {
  MCQ: 'MCQ',
  MCQ_MULTI: 'MCQ_MULTI',
  FRQ: 'FRQ',
  SAQ: 'SAQ',
  DBQ: 'DBQ',
}
```

**No formal `validateQuestionData` function exists.** Question shape is implicit from service usage.

### Collection Names

**Definition:** `src/apBoost/utils/apTypes.js:90-98`
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

---

## 2) Write Paths

**Found: Yes**

### apSessionService.js

**File:** `src/apBoost/services/apSessionService.js`

| Function | Lines | Firestore Operation | Collection/Path | Current Error Handling |
|----------|-------|---------------------|-----------------|------------------------|
| `createOrResumeSession` | 30-76 | `setDoc` | `ap_session_state/{sessionId}` | `console.error` (line 73), throws |
| `getActiveSession` | 84-104 | `getDocs` (query) | `ap_session_state` | `console.error` (line 101), returns `null` |
| `updateSession` | 112-122 | `updateDoc` | `ap_session_state/{sessionId}` | `console.error` (line 119), throws |
| `saveAnswer` | 131-141 | `updateDoc` | `ap_session_state/{sessionId}` | `console.error` (line 138), throws |
| `toggleQuestionFlag` | 150-176 | `getDoc`, `updateDoc` | `ap_session_state/{sessionId}` | `console.error` (line 173), throws |
| `updatePosition` | 185-196 | `updateDoc` | `ap_session_state/{sessionId}` | `console.error` (line 193), throws |
| `updateTimer` | 205-215 | `updateDoc` | `ap_session_state/{sessionId}` | `console.error` (line 212), throws |
| `completeSession` | 222-233 | `updateDoc` | `ap_session_state/{sessionId}` | `console.error` (line 230), throws |
| `getSession` | 240-251 | `getDoc` | `ap_session_state/{sessionId}` | `console.error` (line 248), throws |
| `updateHeartbeat` | 258-267 | `updateDoc` | `ap_session_state/{sessionId}` | `console.error` (line 264), **does NOT throw** |

**Guard Clauses:** None - no parameter validation before Firestore operations.

### apTestService.js

**File:** `src/apBoost/services/apTestService.js`

| Function | Lines | Firestore Operation | Collection/Path | Current Error Handling |
|----------|-------|---------------------|-----------------|------------------------|
| `getAvailableTests` | 20-88 | `getDocs` (queries) | `ap_tests`, `ap_assignments`, `ap_test_results` | `console.error` (line 85), throws |
| `getTestWithQuestions` | 95-124 | `getDoc`, `getDocs` | `ap_tests/{testId}`, `ap_questions` | `console.error` (line 121), throws |
| `getTestMeta` | 131-142 | `getDoc` | `ap_tests/{testId}` | `console.error` (line 139), throws |
| `getAssignment` | 150-169 | `getDocs` (query) | `ap_assignments` | `console.error` (line 166), throws |
| `getQuestion` | 176-187 | `getDoc` | `ap_questions/{questionId}` | `console.error` (line 184), throws |

**Guard Clauses:** None - no parameter validation.

### apScoringService.js

**File:** `src/apBoost/services/apScoringService.js`

| Function | Lines | Firestore Operation | Error Handling |
|----------|-------|---------------------|----------------|
| `createTestResult` | 67-166 | `setDoc` to `ap_test_results` | `console.error` (line 163), throws |
| `getTestResult` | 173-184 | `getDoc` | `console.error` (line 181), throws |
| `getTestResults` | 192-211 | `getDocs` (query) | `console.error` (line 208), throws |

**Guard Clauses:** Throws `new Error('Session not found')` (line 72) and `new Error('Test not found')` (line 78).

### Services Using logError (already migrated)

| Service | Lines with `logError` |
|---------|----------------------|
| `apTeacherService.js` | 42, 73, 102, 126, 150, 175, 220, 248, 273, 314, 340, 359, 377 |
| `apGradingService.js` | 98, 151, 208, 261, 282 |
| `apAnalyticsService.js` | 77, 335, 358, 412 |
| `apQuestionService.js` | 95, 119, 145, 193, 213, 228, 267, 305, 343, 368, 398, 424 |
| `apStorageService.js` | 133, 174, 189, 205, 224, 253 |

---

## 3) Offline/Resilience Mechanics

**Found: Yes**

### withTimeout Utility

**File:** `src/apBoost/utils/withTimeout.js:15-32`

```javascript
export async function withTimeout(promise, ms, operation = 'Operation') {
  let timeoutId
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${ms}ms`))
    }, ms)
  })
  try {
    const result = await Promise.race([promise, timeout])
    clearTimeout(timeoutId)
    return result
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}
```

**Timeout Constants:** `src/apBoost/utils/withTimeout.js:37-43`
```javascript
export const TIMEOUTS = {
  FIRESTORE_READ: 10000,    // 10 seconds
  FIRESTORE_WRITE: 15000,   // 15 seconds
  SESSION_LOAD: 20000,      // 20 seconds
  HEARTBEAT: 5000,          // 5 seconds
  QUEUE_FLUSH: 30000,       // 30 seconds
}
```

### Usage Sites

| File | Lines | Operation Wrapped |
|------|-------|-------------------|
| `useOfflineQueue.js` | 231-235 | Firestore queue flush |
| `useHeartbeat.js` | 32-36, 54-61 | Heartbeat read/write |
| `useDuplicateTabGuard.js` | 32-37 | Session token update |

### Offline Queue (IndexedDB)

**File:** `src/apBoost/hooks/useOfflineQueue.js`

- Uses IndexedDB for local persistence (lines 16-37)
- Listens for `online`/`offline` events (lines 85-104)
- Exponential backoff retry on flush failure (lines 257-262)
- Returns: `{ addToQueue, flushQueue, queueLength, isOnline, isFlushing }`

### Connection Status UI

**File:** `src/apBoost/components/ConnectionStatus.jsx:1-50`

**Props:** `{ isConnected, isSyncing }`

**States Displayed:**
1. Nothing (connected and not syncing)
2. "Syncing your progress..." (blue info banner with spinner)
3. "Connection unstable - your progress is being saved locally" (yellow warning banner)

---

## 4) UI/Flow Entry Points

**Found: Yes**

### Hook: useTestSession

**File:** `src/apBoost/hooks/useTestSession.js`

**Session Loading Pipeline (lines 160-206):**
```javascript
useEffect(() => {
  async function loadTestAndSession() {
    try {
      setLoading(true)
      setError(null)
      const testData = await getTestWithQuestions(testId)
      if (!testData) throw new Error('Test not found')
      setTest(testData)
      const existingSession = await getActiveSession(testId, user.uid)
      if (existingSession) {
        setSession(existingSession)
        // Restore state from session...
      }
    } catch (err) {
      logError('useTestSession.loadTestAndSession', { testId, userId: user?.uid }, err)
      setError(err.message || 'Failed to load test')
    } finally {
      setLoading(false)
    }
  }
  loadTestAndSession()
}, [testId, user])
```

**Current Validation:** None - session data is used directly without validation.

**Exposed State:**
- `loading` (boolean)
- `error` (string | null)
- `isConnected` (from useHeartbeat)
- `isOnline` (from useOfflineQueue)
- `isSyncing` (from useOfflineQueue)
- `isInvalidated` (session invalidated by duplicate tab or takeover)

### ErrorFallback Component

**File:** `src/apBoost/components/ErrorFallback.jsx:1-65`

**Props:** `{ error, onRetry }`

**Current Implementation:**
- Generic error message: "Something went wrong"
- Shows error details in dev mode (lines 29-35)
- Reassurance about local save (lines 37-42)
- Actions: "Return to Dashboard" (always), "Try Again" (if `onRetry` provided)

**Does NOT support:**
- Type-specific messaging (network, auth, validation, not-found)
- Type-specific actions (retry vs login vs skip)
- Timeout-specific indicator

### AuthContext

**File:** `src/contexts/AuthContext.jsx`

**Exports:** `{ useAuth }`

**User Object Shape (lines 37-43, 85-95):**
```javascript
{
  ...firebaseUser,  // Firebase user object
  role: 'student' | 'teacher',
  profile: Object | null,
  stats: Object | null,
  settings: Object | null,
}
```

**Usage in apBoost:** `const { user } = useAuth()` - used in `useTestSession.js:25`, many pages.

---

## 5) Must-Answer Questions

### Q1: What is the actual canonical session schema?

**Found: Yes**

**Definition:** `src/apBoost/services/apSessionService.js:49-67`

**Required Fields:**
- `userId` (string)
- `testId` (string)
- `sessionToken` (string)
- `status` (SESSION_STATUS enum)
- `attemptNumber` (number)
- `currentSectionIndex` (number)
- `currentQuestionIndex` (number)
- `sectionTimeRemaining` (object)
- `answers` (object)
- `flaggedQuestions` (array)
- `annotations` (object)
- `strikethroughs` (object)
- `lastHeartbeat` (Timestamp)
- `lastAction` (Timestamp)
- `startedAt` (Timestamp)

**Optional Fields:**
- `assignmentId` (string | null)
- `completedAt` (Timestamp | null)

---

### Q2: What are the exported functions and Firestore operations in apSessionService.js and apTestService.js?

**Found: Yes**

**apSessionService.js exports:**
1. `createOrResumeSession(testId, userId, assignmentId)` - query + setDoc
2. `getActiveSession(testId, userId)` - query
3. `updateSession(sessionId, updates)` - updateDoc
4. `saveAnswer(sessionId, questionId, answer)` - updateDoc
5. `toggleQuestionFlag(sessionId, questionId, flagged)` - getDoc + updateDoc
6. `updatePosition(sessionId, sectionIndex, questionIndex)` - updateDoc
7. `updateTimer(sessionId, sectionId, timeRemaining)` - updateDoc
8. `completeSession(sessionId)` - updateDoc
9. `getSession(sessionId)` - getDoc
10. `updateHeartbeat(sessionId)` - updateDoc

**apTestService.js exports:**
1. `getAvailableTests(userId, role)` - multiple queries
2. `getTestWithQuestions(testId)` - getDoc + query
3. `getTestMeta(testId)` - getDoc
4. `getAssignment(testId, userId)` - query
5. `getQuestion(questionId)` - getDoc

---

### Q3: Does logError.js export logError and logWarning?

**Found: Yes**

**File:** `src/apBoost/utils/logError.js:1-68`

**Exports:**
1. `logError(functionName, context, error)` - lines 14-34
2. `logWarning(functionName, message, context)` - lines 42-53
3. `logDebug(functionName, message, data)` - lines 61-65
4. `default` export: `logError`

**logError signature (lines 14-34):**
```javascript
export function logError(functionName, context = {}, error = null) {
  const errorInfo = {
    function: functionName,
    context,
    message: error?.message || String(error || 'Unknown error'),
    code: error?.code || null,
    stack: error?.stack || null,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
  }
  console.error(`[APBoost:${functionName}]`, errorInfo)
  return errorInfo
}
```

**logWarning signature (lines 42-53):**
```javascript
export function logWarning(functionName, message, context = {}) {
  const warningInfo = {
    function: functionName,
    message,
    context,
    timestamp: new Date().toISOString(),
  }
  console.warn(`[APBoost:${functionName}]`, warningInfo)
  return warningInfo
}
```

---

### Q4: Are there console.error calls in apBoost services?

**Found: Yes**

**Services with console.error (NOT using logError):**

| File | Count | Lines |
|------|-------|-------|
| `apSessionService.js` | 10 | 73, 101, 119, 138, 173, 193, 212, 230, 248, 264 |
| `apTestService.js` | 5 | 85, 121, 139, 166, 184 |
| `apScoringService.js` | 3 | 163, 181, 208 |

**Total:** 18 `console.error` calls in these three services.

---

### Q5: Are there silent catch blocks?

**Found: Yes**

**Silent catch blocks (`catch {` with no logging):**

| File | Lines | Context |
|------|-------|---------|
| `apTeacherService.js` | 213-215 | `getClassStudents` - skips students that can't be fetched |
| `apGradingService.js` | 70-72 | `getPendingGrades` - ignores user fetch errors |
| `apGradingService.js` | 83-85 | `getPendingGrades` - ignores test fetch errors |
| `apAnalyticsService.js` | 318-320 | `getStudentResults` - ignores user fetch errors |
| `apAnalyticsService.js` | 399-401 | `getStudentsForFilter` - ignores user fetch errors |

**Total:** 5 silent catch blocks across 3 services.

---

### Q6: Does apTypes.js contain error-related constants?

**Found: No (NOT FOUND)**

`src/apBoost/utils/apTypes.js` contains:
- `QUESTION_TYPE`
- `QUESTION_FORMAT`
- `TEST_TYPE`
- `SECTION_TYPE`
- `SESSION_STATUS`
- `GRADING_STATUS`
- `FRQ_SUBMISSION_TYPE`
- `STIMULUS_TYPE`
- `QUESTION_ORDER`
- `DIFFICULTY`
- `CHOICE_LETTERS`
- `DEFAULT_SCORE_RANGES`
- `COLLECTIONS`

**No `ERROR_TYPE`, `FIREBASE_ERROR_MAP`, or `ERROR_MESSAGES` constants exist.**

---

### Q7: Is there an error-type detection utility (getErrorType)?

**Found: No (NOT FOUND)**

Searched for `getErrorType` in entire `src/apBoost/` directory - no matches in actual code files. Only found in fix plan markdown files which propose this as a future implementation.

---

### Q8: Is there a validateSession.js utility?

**Found: No (NOT FOUND)**

Searched for:
- `validateSession.js` file - does not exist
- `validateSessionData` function - not found in code
- `validateQuestionData` function - not found in code

Only found in audit/fix plan markdown files as proposed implementations.

---

### Q9: How is session data loaded in useTestSession.js and how are errors handled?

**Found: Yes**

**Session loading:** `src/apBoost/hooks/useTestSession.js:160-206`

**Error handling pattern:**
```javascript
try {
  setLoading(true)
  setError(null)
  // ... async operations ...
} catch (err) {
  logError('useTestSession.loadTestAndSession', { testId, userId: user?.uid }, err)
  setError(err.message || 'Failed to load test')
} finally {
  setLoading(false)
}
```

**Current validation:** None - data is used directly.

**Fallback UI:** `error` state is exposed, consumed by parent component.

---

### Q10: What does ErrorFallback.jsx render and what props does it accept?

**Found: Yes**

**File:** `src/apBoost/components/ErrorFallback.jsx`

**Props:**
- `error` (Error | null) - error object to display
- `onRetry` (function | undefined) - callback for retry button

**Renders:**
1. Error icon (exclamation mark in red circle)
2. Title: "Something went wrong"
3. Generic message: "We encountered an unexpected error..."
4. Error details (dev mode only, lines 29-35)
5. Reassurance info box about local save
6. Actions:
   - "Return to Dashboard" link (always)
   - "Try Again" button (only if `onRetry` provided)

**Does NOT support type-specific messaging or actions today.**

---

### Q11: Does withTimeout utility exist?

**Found: Yes**

**File:** `src/apBoost/utils/withTimeout.js:15-32`

**Signature:** `withTimeout(promise, ms, operation = 'Operation')`

**Behavior:**
- Uses `Promise.race` with timeout promise
- Throws `Error('${operation} timed out after ${ms}ms')` on timeout
- Clears timeout on completion or error

**Usage sites:**
- `useOfflineQueue.js:231` - queue flush (30s)
- `useHeartbeat.js:32-36,54-60` - heartbeat read/write (5s)
- `useDuplicateTabGuard.js:32` - session token update

---

### Q12: Is there a connection/offline/timeout status UI element?

**Found: Yes**

**File:** `src/apBoost/components/ConnectionStatus.jsx`

**Props:** `{ isConnected, isSyncing }`

**States:**
1. Hidden (connected and not syncing)
2. Info banner: "Syncing your progress..." (isSyncing=true)
3. Warning banner: "Connection unstable - your progress is being saved locally" (isConnected=false)

**Triggers:**
- `isConnected` from `useHeartbeat` (tracks heartbeat failures)
- `isSyncing` from `useOfflineQueue` (tracks queue flush in progress)

**No timeout-specific message ("Taking too long") exists.**

---

## Summary of Gaps

| Item | Status | Notes |
|------|--------|-------|
| `logError` usage in apSessionService | Missing | 10 console.error calls |
| `logError` usage in apTestService | Missing | 5 console.error calls |
| `logError` usage in apScoringService | Missing | 3 console.error calls |
| `logWarning` for silent catches | Missing | 5 silent catch blocks |
| `validateSessionData` utility | Missing | No validation exists |
| `validateQuestionData` utility | Missing | No validation exists |
| `ERROR_TYPE` constants | Missing | Not in apTypes.js |
| `FIREBASE_ERROR_MAP` | Missing | Not in apTypes.js |
| `getErrorType` utility | Missing | Not implemented |
| `ERROR_MESSAGES` map | Missing | Not in apTypes.js |
| Type-specific ErrorFallback | Missing | Generic only |
| Timeout indicator UI | Missing | No "Taking too long" message |
| Guard clauses in services | Missing | No param validation |
| `useErrorLogger` hook | Missing | Not implemented |
