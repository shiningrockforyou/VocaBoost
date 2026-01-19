# Fix Plan: Sections 6.1 to 6.7

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_6.1_to_6.7_criteria_audit.md

## Executive Summary
- Total Issues: 11
- ⚠️ Partial Implementations: 8
- ❌ Missing Features: 3
- ❓ Needs Investigation: 0
- Estimated Complexity: Medium

---

## Issue 1: Replace console.error with logError in Services

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** No silent failures - every error logged with context (6.1), Log with full context (6.3)
- **Current State:** `apSessionService.js` has 9 `console.error` calls, `apTestService.js` has 5 `console.error` calls - all without structured context

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/services/apSessionService.js` (lines 73, 101, 119, 138, 173, 193, 212, 230, 264)
  - `src/apBoost/services/apTestService.js` (lines 85, 121, 139, 166, 184)
  - `src/apBoost/utils/logError.js` (lines 1-68) - already exists and working
- **Current Implementation:** Direct `console.error('Error message:', error)` calls
- **Gap:** Should use `logError(functionName, context, error)` for structured logging
- **Dependencies:** `logError` utility already exists and is used by hooks

### Fix Plan

#### Step 1: Update apSessionService.js
**File:** `src/apBoost/services/apSessionService.js`
**Action:** Modify
**Details:**
- Add import: `import { logError } from '../utils/logError'`
- Replace each `console.error` call with `logError`:

| Line | Current | Replace With |
|------|---------|--------------|
| 73 | `console.error('Error creating/resuming session:', error)` | `logError('apSessionService.createOrResumeSession', { testId, userId, assignmentId }, error)` |
| 101 | `console.error('Error getting active session:', error)` | `logError('apSessionService.getActiveSession', { testId, userId }, error)` |
| 119 | `console.error('Error updating session:', error)` | `logError('apSessionService.updateSession', { sessionId }, error)` |
| 138 | `console.error('Error saving answer:', error)` | `logError('apSessionService.saveAnswer', { sessionId, questionId }, error)` |
| 173 | `console.error('Error toggling flag:', error)` | `logError('apSessionService.toggleQuestionFlag', { sessionId, questionId, flagged }, error)` |
| 193 | `console.error('Error updating position:', error)` | `logError('apSessionService.updatePosition', { sessionId, sectionIndex, questionIndex }, error)` |
| 212 | `console.error('Error updating timer:', error)` | `logError('apSessionService.updateTimer', { sessionId, sectionId, timeRemaining }, error)` |
| 230 | `console.error('Error completing session:', error)` | `logError('apSessionService.completeSession', { sessionId }, error)` |
| 248 | `console.error('Error getting session:', error)` | `logError('apSessionService.getSession', { sessionId }, error)` |
| 264 | `console.error('Error updating heartbeat:', error)` | `logError('apSessionService.updateHeartbeat', { sessionId }, error)` |

#### Step 2: Update apTestService.js
**File:** `src/apBoost/services/apTestService.js`
**Action:** Modify
**Details:**
- Add import: `import { logError } from '../utils/logError'`
- Replace each `console.error` call with `logError`:

| Line | Current | Replace With |
|------|---------|--------------|
| 85 | `console.error('Error fetching available tests:', error)` | `logError('apTestService.getAvailableTests', { assignedTestIds, limit }, error)` |
| 121 | `console.error('Error fetching test with questions:', error)` | `logError('apTestService.getTestWithQuestions', { testId }, error)` |
| 139 | `console.error('Error fetching test meta:', error)` | `logError('apTestService.getTestMeta', { testId }, error)` |
| 166 | `console.error('Error fetching assignment:', error)` | `logError('apTestService.getAssignment', { assignmentId }, error)` |
| 184 | `console.error('Error fetching question:', error)` | `logError('apTestService.getQuestion', { questionId }, error)` |

### Verification Steps
1. Search for remaining `console.error` in both service files (should find 0)
2. Test session creation - verify errors appear in structured format in console
3. Intentionally trigger an error (e.g., invalid testId) and verify log output includes function name, context, and stack trace

### Potential Risks
- None - direct replacement, no logic changes

---

## Issue 2: Fix Silent Catch Blocks

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Never empty catch blocks - must log or rethrow (6.1)
- **Current State:** 5 catch blocks in services have only comments like "// Ignore user fetch errors"

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/services/apAnalyticsService.js` (lines 318-320, 399-401)
  - `src/apBoost/services/apTeacherService.js` (lines 213-215)
  - `src/apBoost/services/apGradingService.js` (lines 70-72, 83-85)
- **Current Implementation:** `catch { // Ignore error }` - completely silent
- **Gap:** Should at least log a warning so issues can be debugged
- **Dependencies:** `logWarning` utility already exists in `logError.js`

### Fix Plan

#### Step 1: Update apAnalyticsService.js
**File:** `src/apBoost/services/apAnalyticsService.js`
**Action:** Modify
**Details:**
- Ensure import includes: `import { logError, logWarning } from '../utils/logError'`
- Line 318-320 (in `getStudentResults`):
```javascript
// Before:
catch {
  // Ignore user fetch errors
}

// After:
catch (error) {
  logWarning('apAnalyticsService.getStudentResults', 'Failed to fetch user data, using fallback', { userId: result.userId, error: error?.message })
}
```
- Line 399-401 (in `getStudentsForFilter`):
```javascript
// Before:
catch {
  // Ignore user fetch errors
}

// After:
catch (error) {
  logWarning('apAnalyticsService.getStudentsForFilter', 'Failed to fetch student data, skipping', { studentId, error: error?.message })
}
```

#### Step 2: Update apTeacherService.js
**File:** `src/apBoost/services/apTeacherService.js`
**Action:** Modify
**Details:**
- Add import: `import { logWarning } from '../utils/logError'`
- Line 213-215 (in `getClassStudents`):
```javascript
// Before:
catch {
  // Skip students that can't be fetched
}

// After:
catch (error) {
  logWarning('apTeacherService.getClassStudents', 'Failed to fetch student, skipping', { studentId, error: error?.message })
}
```

#### Step 3: Update apGradingService.js
**File:** `src/apBoost/services/apGradingService.js`
**Action:** Modify
**Details:**
- Ensure import includes `logWarning` from `../utils/logError`
- Line 70-72 (user fetch):
```javascript
// After:
catch (error) {
  logWarning('apGradingService.getPendingGrades', 'Failed to fetch user data', { studentId: data.studentId, error: error?.message })
}
```
- Line 83-85 (test fetch):
```javascript
// After:
catch (error) {
  logWarning('apGradingService.getPendingGrades', 'Failed to fetch test data', { testId: data.testId, error: error?.message })
}
```

### Verification Steps
1. Search for `catch {` or `catch (error) { //` patterns with empty bodies
2. Test analytics dashboard with a user that doesn't exist in users collection - verify warning appears in console
3. Check console for warning messages when data fetch fails

### Potential Risks
- Low - adding warnings won't change functionality, just visibility

---

## Issue 3: Create validateSessionData Utility

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** validateSessionData function checks all required fields (6.5)
- **Current State:** No validation utility exists - data shape is assumed

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/services/apSessionService.js` - defines session structure (lines 49-67)
  - `src/apBoost/utils/` - utility directory where it should live
- **Current Implementation:** None - sessions are used without validation
- **Gap:** Need `validateSessionData(data)` that checks required fields and returns validation result
- **Dependencies:** Session structure from `apSessionService.js`

### Fix Plan

#### Step 1: Create validateSession.js
**File:** `src/apBoost/utils/validateSession.js`
**Action:** Create
**Details:**
Create new file with the following structure:
```javascript
/**
 * Session data validation utility for AP Boost
 * Validates session data shape from Firestore
 */

/**
 * Required fields for a valid session
 */
const REQUIRED_SESSION_FIELDS = [
  'userId',
  'testId',
  'status',
  'currentSectionIndex',
  'currentQuestionIndex',
]

/**
 * Validate session data from Firestore
 * @param {Object} data - Session data to validate
 * @returns {{ valid: boolean, errors: string[], data: Object }} Validation result
 */
export function validateSessionData(data) {
  const errors = []

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Session data is null or not an object'], data: null }
  }

  // Check required fields
  for (const field of REQUIRED_SESSION_FIELDS) {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`Missing required field: ${field}`)
    }
  }

  // Type checks
  if (data.userId && typeof data.userId !== 'string') {
    errors.push('userId must be a string')
  }
  if (data.testId && typeof data.testId !== 'string') {
    errors.push('testId must be a string')
  }
  if (data.currentSectionIndex !== undefined && typeof data.currentSectionIndex !== 'number') {
    errors.push('currentSectionIndex must be a number')
  }
  if (data.currentQuestionIndex !== undefined && typeof data.currentQuestionIndex !== 'number') {
    errors.push('currentQuestionIndex must be a number')
  }
  if (data.answers && typeof data.answers !== 'object') {
    errors.push('answers must be an object')
  }
  if (data.flaggedQuestions && !Array.isArray(data.flaggedQuestions)) {
    errors.push('flaggedQuestions must be an array')
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : null
  }
}

/**
 * Validate question data from Firestore
 * @param {Object} data - Question data to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateQuestionData(data) {
  const errors = []

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Question data is null or not an object'] }
  }

  if (!data.type) errors.push('Missing required field: type')
  if (!data.text && !data.prompt) errors.push('Missing question text/prompt')

  return { valid: errors.length === 0, errors }
}
```

#### Step 2: Use validateSessionData in session loading
**File:** `src/apBoost/hooks/useTestSession.js` (or equivalent session hook)
**Action:** Modify
**Details:**
- Import: `import { validateSessionData } from '../utils/validateSession'`
- After loading session from Firestore, validate:
```javascript
const { valid, errors } = validateSessionData(sessionData)
if (!valid) {
  logError('useTestSession.loadSession', { sessionId, errors }, new Error('Invalid session data'))
  throw new Error('Session data is corrupted')
}
```

### Verification Steps
1. Verify file exists at `src/apBoost/utils/validateSession.js`
2. Test with valid session data - should return `{ valid: true, errors: [] }`
3. Test with missing fields - should return specific error messages
4. Test session loading with corrupted data - should show error

### Potential Risks
- Medium - need to handle validation failures gracefully to not break existing sessions
- Mitigation: Use validation for warnings first before making it blocking

---

## Issue 4: Add Error Type Constants and Detection

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Handle by error type - Auth/permission error → Return AUTH error (6.3)
- **Current State:** All errors treated the same - no type differentiation

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/apTypes.js` - existing constants file
  - `src/apBoost/utils/logError.js` - could add error type detection
- **Current Implementation:** All errors logged and rethrown without categorization
- **Gap:** Need error type constants and detection utility
- **Dependencies:** Firebase error codes

### Fix Plan

#### Step 1: Add Error Type Constants
**File:** `src/apBoost/utils/apTypes.js`
**Action:** Modify
**Details:**
Add at the end of the file:
```javascript
// Error Types for categorized error handling
export const ERROR_TYPE = {
  NETWORK: 'NETWORK',       // Connection/timeout errors
  AUTH: 'AUTH',             // Permission/authentication errors
  VALIDATION: 'VALIDATION', // Data shape/format errors
  NOT_FOUND: 'NOT_FOUND',   // Resource doesn't exist
  UNKNOWN: 'UNKNOWN',       // Unrecognized errors
}

// Firebase error codes mapped to error types
export const FIREBASE_ERROR_MAP = {
  'permission-denied': ERROR_TYPE.AUTH,
  'unauthenticated': ERROR_TYPE.AUTH,
  'not-found': ERROR_TYPE.NOT_FOUND,
  'unavailable': ERROR_TYPE.NETWORK,
  'deadline-exceeded': ERROR_TYPE.NETWORK,
  'resource-exhausted': ERROR_TYPE.NETWORK,
}
```

#### Step 2: Create Error Type Detection Utility
**File:** `src/apBoost/utils/logError.js`
**Action:** Modify
**Details:**
Add after imports:
```javascript
import { ERROR_TYPE, FIREBASE_ERROR_MAP } from './apTypes'

/**
 * Detect error type from error object
 * @param {Error} error - The error to categorize
 * @returns {string} Error type from ERROR_TYPE
 */
export function getErrorType(error) {
  if (!error) return ERROR_TYPE.UNKNOWN

  // Check Firebase error codes
  if (error.code && FIREBASE_ERROR_MAP[error.code]) {
    return FIREBASE_ERROR_MAP[error.code]
  }

  // Check error message patterns
  const message = error.message?.toLowerCase() || ''

  if (message.includes('network') || message.includes('timeout') ||
      message.includes('offline') || message.includes('fetch')) {
    return ERROR_TYPE.NETWORK
  }

  if (message.includes('permission') || message.includes('unauthorized') ||
      message.includes('auth') || message.includes('token')) {
    return ERROR_TYPE.AUTH
  }

  if (message.includes('not found') || message.includes('does not exist')) {
    return ERROR_TYPE.NOT_FOUND
  }

  if (message.includes('invalid') || message.includes('validation') ||
      message.includes('required')) {
    return ERROR_TYPE.VALIDATION
  }

  return ERROR_TYPE.UNKNOWN
}
```

Modify `logError` function to include error type:
```javascript
export function logError(functionName, context = {}, error = null) {
  const errorType = getErrorType(error)
  const errorInfo = {
    function: functionName,
    context,
    type: errorType, // NEW: add error type
    message: error?.message || String(error || 'Unknown error'),
    code: error?.code || null,
    stack: error?.stack || null,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
  }
  // ... rest unchanged
}
```

### Verification Steps
1. Import `ERROR_TYPE` in a test and verify constants are accessible
2. Test `getErrorType` with Firebase permission error - should return AUTH
3. Test with network timeout - should return NETWORK
4. Verify logError output includes `type` field

### Potential Risks
- Low - additive change, doesn't break existing functionality

---

## Issue 5: Add User-Facing Error Messages

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Auth/permission → "Session expired. Please log in again." (6.7), Timeout → "Taking too long. Retrying..." (6.7), Validation → "Something's wrong with this question. Skipping." (6.7)
- **Current State:** Only generic "Something went wrong" message exists

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/ErrorFallback.jsx` - shows generic error
  - `src/apBoost/components/ConnectionStatus.jsx` - shows network status
- **Current Implementation:** Single generic message for all errors
- **Gap:** Need error-type-specific user messages
- **Dependencies:** ERROR_TYPE from Issue 4

### Fix Plan

#### Step 1: Create Error Message Constants
**File:** `src/apBoost/utils/apTypes.js`
**Action:** Modify
**Details:**
Add after ERROR_TYPE:
```javascript
// User-facing error messages by type
export const ERROR_MESSAGES = {
  [ERROR_TYPE.NETWORK]: {
    title: 'Connection lost',
    message: 'Your work is saved locally and will sync when reconnected.',
    action: 'retry',
  },
  [ERROR_TYPE.AUTH]: {
    title: 'Session expired',
    message: 'Please log in again to continue.',
    action: 'login',
  },
  [ERROR_TYPE.VALIDATION]: {
    title: 'Something went wrong',
    message: "There's an issue with this question. You can skip it and continue.",
    action: 'skip',
  },
  [ERROR_TYPE.NOT_FOUND]: {
    title: 'Content not found',
    message: 'The requested content could not be loaded.',
    action: 'back',
  },
  [ERROR_TYPE.UNKNOWN]: {
    title: 'Something went wrong',
    message: 'Your work is saved. Try again or return to dashboard.',
    action: 'retry',
  },
}

// Timeout-specific message
export const TIMEOUT_MESSAGE = {
  title: 'Taking too long',
  message: 'Retrying automatically...',
  action: 'wait',
}
```

#### Step 2: Update ErrorFallback to Use Error Types
**File:** `src/apBoost/components/ErrorFallback.jsx`
**Action:** Modify
**Details:**
- Import: `import { ERROR_TYPE, ERROR_MESSAGES } from '../utils/apTypes'`
- Import: `import { getErrorType } from '../utils/logError'`
- Modify component to show type-specific messages:
```jsx
export default function ErrorFallback({ error, onRetry, onLogin, onSkip }) {
  const errorType = getErrorType(error)
  const errorMsg = ERROR_MESSAGES[errorType] || ERROR_MESSAGES[ERROR_TYPE.UNKNOWN]

  return (
    <div className="...">
      {/* Title */}
      <h2 className="text-xl font-bold text-text-primary mb-2">
        {errorMsg.title}
      </h2>

      {/* Message */}
      <p className="text-text-secondary mb-4">
        {errorMsg.message}
      </p>

      {/* Actions based on error type */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/ap">Return to Dashboard</Link>

        {errorMsg.action === 'retry' && onRetry && (
          <button onClick={onRetry}>Try Again</button>
        )}

        {errorMsg.action === 'login' && onLogin && (
          <button onClick={onLogin}>Log In</button>
        )}

        {errorMsg.action === 'skip' && onSkip && (
          <button onClick={onSkip}>Skip Question</button>
        )}
      </div>
    </div>
  )
}
```

#### Step 3: Add Timeout Indicator Component
**File:** `src/apBoost/components/TimeoutIndicator.jsx`
**Action:** Create
**Details:**
```jsx
import { TIMEOUT_MESSAGE } from '../utils/apTypes'

export default function TimeoutIndicator({ isRetrying }) {
  if (!isRetrying) return null

  return (
    <div className="fixed bottom-4 right-4 bg-warning rounded-[--radius-alert] p-3 shadow-theme-md flex items-center gap-2">
      <span className="animate-spin">⟳</span>
      <span className="text-warning-text-strong text-sm">
        {TIMEOUT_MESSAGE.message}
      </span>
    </div>
  )
}
```

### Verification Steps
1. Trigger AUTH error (e.g., logout during test) - should see "Session expired" message
2. Go offline during test - should see "Connection lost" message
3. Simulate timeout - should see "Taking too long" indicator
4. Verify all messages match acceptance criteria wording

### Potential Risks
- Medium - need to pass additional handlers (onLogin, onSkip) through component tree
- Mitigation: Make handlers optional with sensible defaults

---

## Issue 6: Add Guard Clauses to Service Functions

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Guard clauses at top - fail fast on invalid input (6.3), Function parameters: Guard clause at top (6.5)
- **Current State:** Hooks have guards, services don't

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/services/apSessionService.js` - no guards on most functions
  - `src/apBoost/services/apTestService.js` - no guards on most functions
  - `src/apBoost/hooks/useOfflineQueue.js` (lines 126-129) - example of good pattern
- **Current Implementation:** Functions proceed directly to try/catch
- **Gap:** Should validate required parameters before proceeding
- **Dependencies:** None

### Fix Plan

#### Step 1: Add Guards to apSessionService.js
**File:** `src/apBoost/services/apSessionService.js`
**Action:** Modify
**Details:**
Add guard clauses at the top of each function. Pattern to follow:
```javascript
export async function saveAnswer(sessionId, questionId, answer) {
  // Guard clauses
  if (!sessionId) throw new Error('sessionId is required')
  if (!questionId) throw new Error('questionId is required')

  try {
    // ... existing logic
  }
}
```

Apply to all functions:
- `createOrResumeSession(testId, userId)` - guard testId, userId
- `updateSession(sessionId, updates)` - guard sessionId
- `saveAnswer(sessionId, questionId, answer)` - guard sessionId, questionId
- `toggleQuestionFlag(sessionId, questionId, flagged)` - guard sessionId, questionId
- `updatePosition(sessionId, sectionIndex, questionIndex)` - guard sessionId
- `updateTimer(sessionId, sectionId, timeRemaining)` - guard sessionId, sectionId
- `completeSession(sessionId)` - guard sessionId
- `getSession(sessionId)` - guard sessionId
- `updateHeartbeat(sessionId)` - guard sessionId

#### Step 2: Add Guards to apTestService.js
**File:** `src/apBoost/services/apTestService.js`
**Action:** Modify
**Details:**
Apply same pattern:
- `getTestWithQuestions(testId)` - guard testId
- `getTestMeta(testId)` - guard testId
- `getAssignment(assignmentId)` - guard assignmentId
- `getQuestion(questionId)` - guard questionId

### Verification Steps
1. Call `saveAnswer(null, 'q1', 'A')` - should throw "sessionId is required"
2. Call `getTestWithQuestions(undefined)` - should throw "testId is required"
3. Verify error is thrown before any Firestore call is made

### Potential Risks
- Low - guards fail fast, preventing wasted operations
- Ensure guards use `throw` not `return` for consistency

---

## Issue 7: Enhance logError with Automatic Context

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Includes sessionId and userId if available (6.4)
- **Current State:** Callers must explicitly pass sessionId/userId

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/logError.js` - current implementation
  - `src/contexts/AuthContext.jsx` - provides current user
- **Current Implementation:** Context must be passed explicitly
- **Gap:** Could auto-capture from global context
- **Dependencies:** React context not available in service layer

### Fix Plan

#### Step 1: Create Context-Aware Logger Hook
**File:** `src/apBoost/hooks/useErrorLogger.js`
**Action:** Create
**Details:**
```javascript
import { useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { logError as baseLogError, logWarning as baseLogWarning } from '../utils/logError'

/**
 * Hook that provides context-aware error logging
 * Automatically includes userId from auth context
 */
export function useErrorLogger(sessionId = null) {
  const { currentUser } = useAuth()

  const logError = useCallback((functionName, context = {}, error = null) => {
    return baseLogError(functionName, {
      userId: currentUser?.uid,
      sessionId,
      ...context,
    }, error)
  }, [currentUser?.uid, sessionId])

  const logWarning = useCallback((functionName, message, context = {}) => {
    return baseLogWarning(functionName, message, {
      userId: currentUser?.uid,
      sessionId,
      ...context,
    })
  }, [currentUser?.uid, sessionId])

  return { logError, logWarning }
}
```

#### Step 2: Use in Components/Hooks
**File:** Components that handle errors (e.g., APTestSession)
**Action:** Modify
**Details:**
```javascript
// Before:
logError('APTestSession.handleError', { sessionId }, error)

// After:
const { logError } = useErrorLogger(sessionId)
logError('APTestSession.handleError', {}, error) // userId and sessionId auto-included
```

### Verification Steps
1. Trigger error while logged in - verify userId appears in log
2. Trigger error with active session - verify sessionId appears
3. Verify existing logError calls still work (backwards compatible)

### Potential Risks
- Low - hook is optional, base logError unchanged
- Service layer still needs explicit context (no React context there)

---

## Implementation Order

Recommended order to implement fixes (considering dependencies):

1. **Issue 4: Add Error Type Constants** - Foundational, other fixes depend on error types
2. **Issue 1: Replace console.error with logError** - Quick win, improves all logging
3. **Issue 2: Fix Silent Catch Blocks** - Quick win, adds visibility
4. **Issue 6: Add Guard Clauses** - Quick win, improves error detection
5. **Issue 3: Create validateSessionData** - Medium effort, important for data integrity
6. **Issue 5: Add User-Facing Error Messages** - Depends on Issue 4
7. **Issue 7: Enhance logError with Automatic Context** - Nice to have, optional

---

## Cross-Cutting Concerns

### Pattern: Consistent Error Handling in Services
All service functions should follow this pattern:
```javascript
export async function functionName(requiredParam1, requiredParam2) {
  // 1. Guard clauses
  if (!requiredParam1) throw new Error('requiredParam1 is required')
  if (!requiredParam2) throw new Error('requiredParam2 is required')

  try {
    // 2. Main logic
    const result = await firestoreOperation()
    return result
  } catch (error) {
    // 3. Structured logging
    logError('serviceName.functionName', { requiredParam1, requiredParam2 }, error)
    throw error // or return null for query-type functions
  }
}
```

### Pattern: Non-Critical Data Fetches
For operations where failure is acceptable (e.g., fetching user display name):
```javascript
try {
  const userData = await getDoc(userRef)
  displayName = userData.data()?.displayName || 'Unknown'
} catch (error) {
  logWarning('serviceName.functionName', 'Failed to fetch user, using fallback', { userId })
  displayName = 'Unknown'
}
```

---

## Notes for Implementer

1. **Import Paths:** All imports use `../utils/` pattern from services/hooks
2. **Design Tokens:** ErrorFallback and any new components must use design tokens from CLAUDE.md
3. **Testing:** Test error scenarios by temporarily adding `throw new Error('test')` in functions
4. **Backwards Compatibility:** All changes should be backwards compatible - no breaking changes to function signatures
5. **Firebase Errors:** Firebase error codes are in `error.code` property (e.g., 'permission-denied')
6. **Timeout Integration:** The `withTimeout` utility already exists and works - just need to add user-facing messages
