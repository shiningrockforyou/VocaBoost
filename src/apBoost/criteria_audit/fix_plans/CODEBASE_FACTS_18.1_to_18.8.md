# CODEBASE FACTS: UNK__18.1_to_18.8

**Scope:** apBoost "Utilities (Detailed)" fixes - AP subject constants, section configs, error logging, session validation, PDF utilities

**Generated:** 2026-01-14

---

## 1) Canonical Data Schema / Source-of-Truth

### AP_SUBJECTS

**Found: Yes**

- **Location:** `src/apBoost/utils/apTestConfig.js:5-66`
- **Export:** Named export `export const AP_SUBJECTS`
- **Shape per subject:**
  ```js
  {
    id: string,        // e.g., 'AP_US_HISTORY'
    name: string,      // e.g., 'AP United States History'
    shortName: string, // e.g., 'APUSH'
    color: string,     // hex code e.g., '#1a365d'
  }
  ```
- **NO `defaultTimeLimits` field exists** - only `id`, `name`, `shortName`, `color`
- **Re-export patterns:** None - only defined in apTestConfig.js

**Evidence:**
```js
// src/apBoost/utils/apTestConfig.js:5-24
export const AP_SUBJECTS = {
  AP_US_HISTORY: {
    id: 'AP_US_HISTORY',
    name: 'AP United States History',
    shortName: 'APUSH',
    color: '#1a365d', // Navy blue
  },
  AP_WORLD_HISTORY: {
    id: 'AP_WORLD_HISTORY',
    name: 'AP World History',
    shortName: 'World',
    color: '#2d3748', // Dark gray
  },
  // ... 8 more subjects
}
```

---

### DEFAULT_SCORE_RANGES

**Found: Yes**

- **Location:** `src/apBoost/utils/apTypes.js:81-87`
- **Export:** Named export `export const DEFAULT_SCORE_RANGES`
- **Shape:**
  ```js
  {
    ap5: { min: 80, max: 100 },
    ap4: { min: 65, max: 79 },
    ap3: { min: 50, max: 64 },
    ap2: { min: 35, max: 49 },
    ap1: { min: 0, max: 34 },
  }
  ```

**Evidence:**
```js
// src/apBoost/utils/apTypes.js:80-87
// Default score ranges for AP 1-5 conversion
export const DEFAULT_SCORE_RANGES = {
  ap5: { min: 80, max: 100 },
  ap4: { min: 65, max: 79 },
  ap3: { min: 50, max: 64 },
  ap2: { min: 35, max: 49 },
  ap1: { min: 0, max: 34 },
}
```

**Imports (3 files):**
- `src/apBoost/services/apScoringService.js:12` - `import { ..., DEFAULT_SCORE_RANGES } from '../utils/apTypes'`
- `src/apBoost/services/apTeacherService.js:19` - `import { ..., DEFAULT_SCORE_RANGES } from '../utils/apTypes'`
- `src/apBoost/pages/APTestEditor.jsx:7` - `import { SECTION_TYPE, DEFAULT_SCORE_RANGES, TEST_TYPE } from '../utils/apTypes'`

---

### SECTION_TYPE

**Found: Yes**

- **Location:** `src/apBoost/utils/apTypes.js:27-31`
- **Export:** Named export `export const SECTION_TYPE`
- **Shape:** Simple enum-like object
  ```js
  {
    MCQ: 'MCQ',
    FRQ: 'FRQ',
    MIXED: 'MIXED',
  }
  ```
- **No extended configuration exists** (no SECTION_CONFIG by any name in codebase)

**Evidence:**
```js
// src/apBoost/utils/apTypes.js:27-31
export const SECTION_TYPE = {
  MCQ: 'MCQ',
  FRQ: 'FRQ',
  MIXED: 'MIXED',
}
```

**Usages (5 files):**
- `src/apBoost/utils/seedTestData.js:10` - import and use for section creation
- `src/apBoost/services/apScoringService.js:12,91,122` - import and type checks
- `src/apBoost/pages/APTestEditor.jsx:7,73-79,273` - import, dropdown options, default value

---

### SESSION_STATUS

**Found: Yes**

- **Location:** `src/apBoost/utils/apTypes.js:34-39`
- **Export:** Named export `export const SESSION_STATUS`
- **Shape:**
  ```js
  {
    NOT_STARTED: 'NOT_STARTED',
    IN_PROGRESS: 'IN_PROGRESS',
    PAUSED: 'PAUSED',
    COMPLETED: 'COMPLETED',
  }
  ```

**Evidence:**
```js
// src/apBoost/utils/apTypes.js:34-39
export const SESSION_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
}
```

---

### Circular Import Risk Assessment

**Found: No circular imports**

- `apTestConfig.js` does NOT import from `apTypes.js` (verified via grep)
- `apTypes.js` does NOT import from `apTestConfig.js` (verified via grep)
- These files are independent - safe to add cross-imports in one direction

**Evidence:**
```
> Grep for "import.*from.*apTypes" in apTestConfig.js: No matches found
> Grep for "import.*from.*apTestConfig" in apTypes.js: No matches found
```

---

## 2) Write Paths

### Session Read/Return Paths

**Found: Yes**

| Function | File | Return Type | Validation |
|----------|------|-------------|------------|
| `getSession` | `apSessionService.js:240-251` | `{ id, ...doc.data() }` or `null` | None - raw Firestore data |
| `getActiveSession` | `apSessionService.js:84-104` | `{ id, ...doc.data() }` or `null` | None - raw Firestore data |
| `createOrResumeSession` | `apSessionService.js:30-76` | `{ id, sessionId, ...sessionData }` | None on return |

**No session validation/sanitization** is performed before returning data to callers.

**Evidence:**
```js
// src/apBoost/services/apSessionService.js:240-251
export async function getSession(sessionId) {
  try {
    const sessionDoc = await getDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId))
    if (!sessionDoc.exists()) {
      return null
    }
    return { id: sessionDoc.id, ...sessionDoc.data() }
  } catch (error) {
    console.error('Error getting session:', error)
    throw error
  }
}
```

### Session Data Structure (from createOrResumeSession)

**Evidence:**
```js
// src/apBoost/services/apSessionService.js:49-67
const sessionData = {
  userId,
  testId,
  assignmentId,
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

### logError Write Path

**Found: Yes**

- **Location:** `src/apBoost/utils/logError.js:14-34`
- **Signature:** `logError(functionName, context = {}, error = null)`
- **Write destinations:** Console only (`console.error`)
- **No Firestore/remote persistence**

**Evidence:**
```js
// src/apBoost/utils/logError.js:14-34
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

  // Console output for development
  console.error(`[APBoost:${functionName}]`, errorInfo)

  // In production, could send to:
  // - Sentry/LogRocket
  // - Firebase Crashlytics
  // - Custom error endpoint

  return errorInfo
}
```

**How callers pass userId/sessionId:**
- Via `context` object parameter (second argument)
- Example: `logError('useTestSession.loadTestAndSession', { testId, userId: user?.uid }, err)`

---

### PDF Write Paths

| Function | File | Returns | Download Method |
|----------|------|---------|-----------------|
| `generateAnswerSheetPdf` | `generateAnswerSheetPdf.js:10-236` | `Blob` | via `doc.output('blob')` |
| `downloadAnswerSheetPdf` | `generateAnswerSheetPdf.js:244-256` | `void` | Creates link, clicks, revokes URL |
| `generateReportPdf` | `generateReportPdf.js:14-236` | `jsPDF` doc | Returns doc directly |
| `downloadReportPdf` | `generateReportPdf.js:244-248` | `void` | Calls `doc.save(filename)` |
| `generateQuestionsPdf` | `generateQuestionsPdf.js:14-263` | `jsPDF` doc | Returns doc directly |
| `downloadQuestionsPdf` | `generateQuestionsPdf.js:271-274` | `void` | Calls `doc.save(filename)` |

**INCONSISTENCY FOUND:**
- `generateAnswerSheetPdf` returns `Blob` via `doc.output('blob')`
- `generateReportPdf` and `generateQuestionsPdf` return `jsPDF` doc instance

**Evidence:**
```js
// src/apBoost/utils/generateAnswerSheetPdf.js:234-235
  // Return as blob
  return doc.output('blob')

// src/apBoost/utils/generateReportPdf.js:235
  return doc

// src/apBoost/utils/generateQuestionsPdf.js:262
  return doc
```

**Call sites that would break if return types change:**
- `downloadAnswerSheetPdf` expects Blob (uses `URL.createObjectURL`)
- `downloadReportPdf` expects jsPDF doc (calls `doc.save()`)
- `downloadQuestionsPdf` expects jsPDF doc (calls `doc.save()`)

---

## 3) Offline/Resilience Mechanics

**Found: Partial relevance**

### Logo Fetch Failure Handling
- **NOT FOUND** - No current graceful degradation for logo fetch failure in PDF generators
- PDFs do not currently embed logos (no `addImage` calls in actual code)

### Session Validation Failure Handling
- **NOT FOUND** - `validateSession.js` does not exist
- No validation occurs in `getSession`/`getActiveSession` - raw data returned

### Queue Retry Logic (useOfflineQueue.js)
- **Found** - Exponential backoff with 5 max retries for flush failures
- Line 258-262: `Math.pow(2, retryCountRef.current) * 1000` (2s, 4s, 8s, 16s)

**Evidence:**
```js
// src/apBoost/hooks/useOfflineQueue.js:257-262
      // Exponential backoff retry
      retryCountRef.current++
      if (retryCountRef.current < 5) {
        const delay = Math.pow(2, retryCountRef.current) * 1000 // 2s, 4s, 8s, 16s
        scheduleFlush(delay)
      }
```

---

## 4) UI/Flow Entry Points

### Subject Info Display

| UI File | Import Path | Functions Used |
|---------|-------------|----------------|
| `APQuestionEditor.jsx:7` | `../utils/apTestConfig` | `AP_SUBJECTS` |
| `APQuestionBank.jsx:7` | `../utils/apTestConfig` | `AP_SUBJECTS` |
| `APTestEditor.jsx:8` | `../utils/apTestConfig` | `AP_SUBJECTS` |
| `APDashboard.jsx:7` | `../utils/apTestConfig` | `getSubjectConfig, formatTimeMinutes, calculateTotalTime` |
| `APReportCard.jsx:7` | `../utils/apTestConfig` | `getSubjectConfig` |
| `InstructionScreen.jsx:1` | `../utils/apTestConfig` | `getSubjectConfig, formatTimeMinutes, calculateTotalTime` |

---

### PDF Download Entry Points

| UI File | Function | Handler Chain |
|---------|----------|---------------|
| `FRQHandwrittenMode.jsx:4` | `downloadAnswerSheetPdf` | Line 46: `await downloadAnswerSheetPdf(test, student, frqQuestions)` |

**Note:** `downloadReportPdf` and `downloadQuestionsPdf` are NOT currently called from any UI components in `/pages` or `/components` (grep returned no matches outside audit/implementation docs).

---

### Session Loading Flows

| Consumer | Import | Functions Used |
|----------|--------|----------------|
| `useTestSession.js:4-11` | `../services/apSessionService` | `createOrResumeSession, getActiveSession, saveAnswer, toggleQuestionFlag, updatePosition, updateTimer` |
| `apScoringService.js:14` | `./apSessionService` | `getSession, completeSession` |

**Flow:**
```
APTestSession.jsx
  → useTestSession hook
    → getActiveSession() / createOrResumeSession()
      → Raw Firestore data (no validation)
```

---

## 5) Must-Answer Questions

### Q1. Where is `AP_SUBJECTS` defined today, and what is its exact object shape?

**Answer:** Defined in `src/apBoost/utils/apTestConfig.js:5-66`. Shape: `{ id, name, shortName, color }`. **No `defaultTimeLimits` field exists.**

**Evidence:** See Section 1 above.

---

### Q2. Which modules import `AP_SUBJECTS` and from what paths?

**Answer:** 3 direct imports from `../utils/apTestConfig`:
- `src/apBoost/pages/APQuestionEditor.jsx:7`
- `src/apBoost/pages/APQuestionBank.jsx:7`
- `src/apBoost/pages/APTestEditor.jsx:8`

Helper `getSubjectConfig` imported by:
- `src/apBoost/pages/APDashboard.jsx:7`
- `src/apBoost/pages/APReportCard.jsx:7`
- `src/apBoost/components/InstructionScreen.jsx:1`

**Evidence:**
```
src/apBoost/pages/APQuestionEditor.jsx:7:import { AP_SUBJECTS } from '../utils/apTestConfig'
src/apBoost/pages/APQuestionBank.jsx:7:import { AP_SUBJECTS } from '../utils/apTestConfig'
src/apBoost/pages/APTestEditor.jsx:8:import { AP_SUBJECTS } from '../utils/apTestConfig'
```

---

### Q3. Does `apTypes.js` currently import anything from `apTestConfig.js` (or vice versa)?

**Answer:** NO. Neither file imports from the other. No circular dependency risk exists.

**Evidence:** Grep searches returned "No matches found" for both directions.

---

### Q4. Where is `DEFAULT_SCORE_RANGES` currently defined and how is it used?

**Answer:** Defined in `src/apBoost/utils/apTypes.js:81-87`.

**Usage:**
- `apScoringService.js:53` - parameter default in `calculateAPScore(percentage, scoreRanges = DEFAULT_SCORE_RANGES)`
- `apScoringService.js:119` - passed to `calculateAPScore(percentage, test.scoreRanges)` (test can override)
- `APTestEditor.jsx` - imported (likely for display/editing)
- `apTeacherService.js` - imported

**Evidence:** See Section 1 above.

---

### Q5. Where is `SECTION_TYPE` defined and what are all usages?

**Answer:** Defined in `src/apBoost/utils/apTypes.js:27-31`.

**Usages:**
| File | Line(s) | Purpose |
|------|---------|---------|
| `seedTestData.js` | 10, 32 | Import, section creation |
| `apScoringService.js` | 12, 91, 122 | Import, type checks for MCQ/FRQ scoring |
| `APTestEditor.jsx` | 7, 73-79, 273 | Import, dropdown options, default value |

**Evidence:** See Grep output in Section 1.

---

### Q6. Is there already an "extended section config" concept (by any name)?

**Answer:** NO. `SECTION_CONFIG` or `getSectionConfig` do NOT exist in actual code. Only found in fix plan docs.

**Evidence:**
```
> Grep for "SECTION_CONFIG" in src/apBoost: Found 1 file (fix_plans only)
> Grep for "getSectionConfig" in src/apBoost: Found 1 file (fix_plans only)
```

---

### Q7. What does `logError` currently do? What is its signature?

**Answer:**
- **Signature:** `logError(functionName, context = {}, error = null)`
- **Action:** Console output only (`console.error`)
- **Returns:** `errorInfo` object

Callers pass `userId`/`sessionId` via the `context` object:
```js
logError('useTestSession.loadTestAndSession', { testId, userId: user?.uid }, err)
```

**Evidence:** See Section 2 above.

---

### Q8. Does a `logWarning` helper exist?

**Answer:** YES - exists in `src/apBoost/utils/logError.js:42-53`

**Signature:** `logWarning(functionName, message, context = {})`
**Action:** Console output via `console.warn`

**Evidence:**
```js
// src/apBoost/utils/logError.js:42-53
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

### Q9. Does `src/apBoost/utils/validateSession.js` exist?

**Answer:** NO - file does not exist. No session validation utility exists anywhere.

**Current validation:** None. `getSession` and `getActiveSession` return raw Firestore data.

**Evidence:**
```
> Glob for "src/apBoost/utils/validateSession*": No files found
> Grep for "validateSession" in src/apBoost: Found only in fix plan/criteria docs
```

---

### Q10. What is the canonical session data structure as returned by `apSessionService`?

**Answer:** From `createOrResumeSession`:
```js
{
  id: string,               // Document ID
  userId: string,
  testId: string,
  assignmentId: string|null,
  sessionToken: string,
  status: SESSION_STATUS value,
  attemptNumber: number,
  currentSectionIndex: number,
  currentQuestionIndex: number,
  sectionTimeRemaining: {},  // Map of sectionId -> seconds
  answers: {},               // Map of questionId -> answer
  flaggedQuestions: [],
  annotations: {},
  strikethroughs: {},
  lastHeartbeat: Timestamp,
  lastAction: Timestamp,
  startedAt: Timestamp,
  completedAt: Timestamp|null,
}
```

**Evidence:** `src/apBoost/services/apSessionService.js:49-67`

---

### Q11. For `generateAnswerSheetPdf.js`: does it embed images? What assets exist?

**Answer:**
- **Image embedding:** NO - no `addImage` calls in current code
- **Assets in `public/apBoost/`:**
  - `ap_logo.png`
  - `ap_logo_small.png`
  - `ap_logo_white.png`
  - `ap_logo_small_white.png`
  - `ap_logo_vector.svg`
  - `ap_logo_header_blue.svg`
  - `ap_logo_header_orange.svg`
  - `ap_logo_square_vector.svg`
  - `ap_logo_square_vector_white.svg`

**Evidence:** Glob for `public/apBoost/*` returned 9 files. Grep for `addImage` found no matches in PDF generator files (only in fix plan docs).

---

### Q12. For `generateReportPdf.js` and `generateQuestionsPdf.js`: return types and call sites?

**Answer:**

| Function | Returns | Download Helper Expects |
|----------|---------|------------------------|
| `generateReportPdf` | `jsPDF` doc | `doc.save(filename)` |
| `generateQuestionsPdf` | `jsPDF` doc | `doc.save(filename)` |
| `generateAnswerSheetPdf` | `Blob` | `URL.createObjectURL(blob)` |

**Call sites:**
- `downloadReportPdf` calls `generateReportPdf`, expects jsPDF doc
- `downloadQuestionsPdf` calls `generateQuestionsPdf`, expects jsPDF doc
- `downloadAnswerSheetPdf` calls `generateAnswerSheetPdf`, expects Blob

**UI call sites:**
- `FRQHandwrittenMode.jsx:46` - only uses `downloadAnswerSheetPdf`
- `downloadReportPdf` and `downloadQuestionsPdf` - **NOT currently called from any UI** (only defined, not used)

**Evidence:**
```js
// src/apBoost/utils/generateReportPdf.js:244-248
export async function downloadReportPdf(result, test, student) {
  const doc = await generateReportPdf(result, test, student)
  const filename = `AP_Report_...`
  doc.save(filename)  // Expects jsPDF doc
}

// src/apBoost/utils/generateQuestionsPdf.js:271-274
export async function downloadQuestionsPdf(test, questions, options = {}) {
  const doc = await generateQuestionsPdf(test, questions, options)
  const filename = `${test?.title...}`
  doc.save(filename)  // Expects jsPDF doc
}
```

---

## Summary of Inconsistencies

1. **PDF return type inconsistency:** `generateAnswerSheetPdf` returns `Blob`, others return `jsPDF` doc
2. **No session validation:** Raw Firestore data returned without sanitization
3. **No logo embedding:** PDF generators don't use `addImage` despite available assets
4. **`logWarning` exists but may not be consistently used** (services use `console.error` directly)
5. **`SECTION_CONFIG` proposed but does not exist** - only `SECTION_TYPE` enum exists
