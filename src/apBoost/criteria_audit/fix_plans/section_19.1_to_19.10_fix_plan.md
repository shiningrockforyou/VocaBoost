# Fix Plan: Sections 19.1 to 19.10 (Utilities Detailed)

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_19.1_to_19.10_criteria_audit.md

## Executive Summary
- Total Issues: 11
- ⚠️ Partial Implementations: 6
- ❌ Missing Features: 5
- ❓ Needs Investigation: 0
- Estimated Complexity: Medium

---

## Issue 1: Subject Constants File Location

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Subject constants for AP subjects should be in `apTypes.js`
- **Current State:** Subject constants are defined in `apTestConfig.js:5-66` instead of `apTypes.js`

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/apTestConfig.js` (lines 5-66) - Contains `AP_SUBJECTS` object
  - `src/apBoost/utils/apTypes.js` (lines 1-99) - Type constants file
- **Current Implementation:** `AP_SUBJECTS` object with id, name, shortName, and color properties is in `apTestConfig.js`
- **Gap:** Criteria specifies subject constants should be in `apTypes.js`
- **Dependencies:** Components importing from `apTestConfig.js` for subject data

### Fix Plan

#### Step 1: Export Subject IDs from apTypes.js
**File:** `src/apBoost/utils/apTypes.js`
**Action:** Add subject ID constants
**Details:**
- Add `AP_SUBJECT` constant object after line 75 (after `DIFFICULTY`):
```javascript
// AP Subjects (IDs only - full config in apTestConfig.js)
export const AP_SUBJECT = {
  US_HISTORY: 'AP_US_HISTORY',
  WORLD_HISTORY: 'AP_WORLD_HISTORY',
  EURO_HISTORY: 'AP_EURO_HISTORY',
  LANG: 'AP_LANG',
  LIT: 'AP_LIT',
  GOV: 'AP_GOV',
  PSYCH: 'AP_PSYCH',
  BIO: 'AP_BIO',
  CHEM: 'AP_CHEM',
  PHYSICS: 'AP_PHYSICS',
}
```

#### Step 2: Update apTestConfig.js to reference apTypes.js
**File:** `src/apBoost/utils/apTestConfig.js`
**Action:** Import and use constants from apTypes
**Details:**
- Import `AP_SUBJECT` from `./apTypes`
- Update `AP_SUBJECTS` to use the constants for IDs

### Verification Steps
1. Verify `AP_SUBJECT` constants are exported from `apTypes.js`
2. Verify no circular import issues
3. Test that existing code using `AP_SUBJECTS` still works

### Potential Risks
- **Circular imports:** If `apTestConfig.js` imports from `apTypes.js` and vice versa - Mitigation: Keep subject IDs simple strings in `apTypes.js`
- **Breaking changes:** Components may expect specific import paths - Mitigation: Keep `AP_SUBJECTS` in `apTestConfig.js` but add subject ID constants to `apTypes.js`

---

## Issue 2: Subject Configurations Missing Default Time Limits

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Subject configurations should include default time limits
- **Current State:** `AP_SUBJECTS` has id, name, shortName, color - but NO default time limits

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/apTestConfig.js` (lines 5-66) - Subject config object
- **Current Implementation:** Each subject has: `{ id, name, shortName, color }`
- **Gap:** Missing `defaultTimeLimits` property for each subject (typically MCQ section time, FRQ section time)
- **Dependencies:** Timer logic in `useTestSession.js`, test creation forms

### Fix Plan

#### Step 1: Add default time limits to each subject
**File:** `src/apBoost/utils/apTestConfig.js`
**Action:** Modify AP_SUBJECTS entries
**Details:**
- Add `defaultTimeLimits` property to each subject:
```javascript
AP_US_HISTORY: {
  id: 'AP_US_HISTORY',
  name: 'AP United States History',
  shortName: 'APUSH',
  color: '#1a365d',
  defaultTimeLimits: {
    mcqMinutes: 55,    // Per actual AP APUSH exam
    frqMinutes: 100,   // SAQs + DBQ + LEQ
  },
},
```
- Research actual AP exam times for each subject:
  - AP US History: 55 min MCQ, 100 min FRQ
  - AP World History: 55 min MCQ, 100 min FRQ
  - AP Euro History: 55 min MCQ, 100 min FRQ
  - AP Lang: 60 min MCQ, 135 min FRQ
  - AP Lit: 60 min MCQ, 120 min FRQ
  - AP Gov: 80 min MCQ, 100 min FRQ
  - AP Psych: 70 min MCQ (no FRQ on AP Psych)
  - AP Bio: 90 min MCQ, 90 min FRQ
  - AP Chem: 90 min MCQ, 105 min FRQ
  - AP Physics: 90 min MCQ, 90 min FRQ

#### Step 2: Add helper function to get default time
**File:** `src/apBoost/utils/apTestConfig.js`
**Action:** Add new function after `calculateTotalTime`
**Details:**
```javascript
/**
 * Get default time limits for a subject
 * @param {string} subjectId - Subject ID
 * @returns {Object} { mcqMinutes, frqMinutes }
 */
export function getSubjectDefaultTimeLimits(subjectId) {
  const subject = AP_SUBJECTS[subjectId]
  return subject?.defaultTimeLimits || { mcqMinutes: 45, frqMinutes: 60 }
}
```

### Verification Steps
1. Verify each subject has `defaultTimeLimits` property
2. Test `getSubjectDefaultTimeLimits()` returns correct values
3. Verify test creation can use these defaults

### Potential Risks
- **Incorrect time limits:** Must research actual AP exam times - Mitigation: Document sources
- **Low risk:** Additive change, doesn't break existing code

---

## Issue 3: Default Score Ranges in Wrong File

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Default score ranges for AP 1-5 conversion should be in `apTestConfig.js`
- **Current State:** `DEFAULT_SCORE_RANGES` is defined in `apTypes.js:81-87` instead of `apTestConfig.js`

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/apTypes.js` (lines 81-87) - Contains `DEFAULT_SCORE_RANGES`
  - `src/apBoost/utils/apTestConfig.js` - Configuration file where it should be
- **Current Implementation:** Score ranges in `apTypes.js`:
  ```javascript
  export const DEFAULT_SCORE_RANGES = {
    ap5: { min: 80, max: 100 },
    ap4: { min: 65, max: 79 },
    ap3: { min: 50, max: 64 },
    ap2: { min: 35, max: 49 },
    ap1: { min: 0, max: 34 },
  }
  ```
- **Gap:** Configuration data should be in config file, not types file
- **Dependencies:** `apScoringService.js` likely imports this

### Fix Plan

#### Step 1: Move DEFAULT_SCORE_RANGES to apTestConfig.js
**File:** `src/apBoost/utils/apTestConfig.js`
**Action:** Add score ranges constant
**Details:**
- Add after `getAllSubjects()` function (around line 85):
```javascript
// Default score ranges for AP 1-5 conversion
export const DEFAULT_SCORE_RANGES = {
  ap5: { min: 80, max: 100 },
  ap4: { min: 65, max: 79 },
  ap3: { min: 50, max: 64 },
  ap2: { min: 35, max: 49 },
  ap1: { min: 0, max: 34 },
}
```

#### Step 2: Update apTypes.js
**File:** `src/apBoost/utils/apTypes.js`
**Action:** Remove and re-export
**Details:**
- Remove lines 80-87 (the DEFAULT_SCORE_RANGES definition)
- Add re-export for backward compatibility:
```javascript
// Re-export from apTestConfig for backward compatibility
export { DEFAULT_SCORE_RANGES } from './apTestConfig'
```

#### Step 3: Update imports in consuming files
**File:** Any file importing `DEFAULT_SCORE_RANGES` from `apTypes.js`
**Action:** Update import path (or keep as-is if re-export works)
**Details:**
- Search for: `import { DEFAULT_SCORE_RANGES } from`
- Verify imports work with re-export

### Verification Steps
1. Verify `DEFAULT_SCORE_RANGES` exports from both files
2. Test scoring service still calculates AP scores correctly
3. No import errors in consuming files

### Potential Risks
- **Breaking imports:** Existing code may import from apTypes - Mitigation: Re-export for compatibility
- **Low risk:** Simple move with backward compatibility

---

## Issue 4: logError sessionId/userId Handling

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Includes sessionId and userId if available
- **Current State:** Context object is passed through, but sessionId/userId not explicitly extracted/handled

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/logError.js` (lines 14-34) - Main logError function
- **Current Implementation:**
  ```javascript
  const errorInfo = {
    function: functionName,
    context,  // Just stores raw context object
    message: error?.message || String(error || 'Unknown error'),
    ...
  }
  ```
- **Gap:** sessionId and userId should be extracted to top-level for easier filtering in error tracking systems
- **Dependencies:** All error logging calls pass context with sessionId/userId

### Fix Plan

#### Step 1: Extract sessionId and userId to top level
**File:** `src/apBoost/utils/logError.js`
**Action:** Modify errorInfo construction
**Details:**
- Update lines 15-23 to explicitly extract key identifiers:
```javascript
export function logError(functionName, context = {}, error = null) {
  // Extract key identifiers for top-level visibility
  const { sessionId, userId, ...restContext } = context

  const errorInfo = {
    function: functionName,
    // Top-level identifiers for filtering/grouping in error tracking
    sessionId: sessionId || null,
    userId: userId || null,
    // Full context object
    context: restContext,
    message: error?.message || String(error || 'Unknown error'),
    code: error?.code || null,
    stack: error?.stack || null,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
  }
  ...
}
```

#### Step 2: Document expected context properties
**File:** `src/apBoost/utils/logError.js`
**Action:** Update JSDoc
**Details:**
- Update the `@param {Object} context` documentation:
```javascript
/**
 * Log an error with context information
 * @param {string} functionName - Name of the function where error occurred
 * @param {Object} context - Additional context
 * @param {string} [context.sessionId] - Session ID if in test session
 * @param {string} [context.userId] - User ID if authenticated
 * @param {Error|string} error - The error object or message
 */
```

### Verification Steps
1. Log an error with sessionId/userId in context
2. Verify sessionId/userId appear at top level in console output
3. Verify remaining context still included

### Potential Risks
- **Low risk:** Non-breaking enhancement, just adds structured extraction

---

## Issue 5: generateAnswerSheetPdf Missing AP Logo

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Includes AP logo, header with test/student info
- **Current State:** Has header with title, test name, student name - but NO AP logo

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/generateAnswerSheetPdf.js` (lines 62-97) - Header section
  - `public/apBoost/ap_logo.png` - Logo file EXISTS (100x100 approx)
  - `public/apBoost/ap_logo_small.png` - Smaller version EXISTS
- **Current Implementation:** Title "ANSWER SHEET" centered, test title, student info fields
- **Gap:** No AP logo included in header
- **Dependencies:** jsPDF `addImage()` method, must load image as base64 or URL

### Fix Plan

#### Step 1: Add logo embedding function
**File:** `src/apBoost/utils/generateAnswerSheetPdf.js`
**Action:** Add helper to load and embed logo
**Details:**
- Add helper function before `generateAnswerSheetPdf`:
```javascript
/**
 * Load image as base64 for PDF embedding
 * @param {string} src - Image source path
 * @returns {Promise<string>} Base64 data URL
 */
async function loadImageAsBase64(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = src
  })
}
```

#### Step 2: Add logo to header
**File:** `src/apBoost/utils/generateAnswerSheetPdf.js`
**Action:** Modify header section (around line 62)
**Details:**
- Add logo loading at start of function:
```javascript
// Load AP logo
let logoData = null
try {
  logoData = await loadImageAsBase64('/apBoost/ap_logo_small.png')
} catch (e) {
  console.warn('Could not load AP logo for PDF:', e)
}
```
- Insert logo before title (around line 65):
```javascript
// Add AP logo if loaded
if (logoData) {
  const logoWidth = 15  // mm
  const logoHeight = 15 // mm (maintain aspect ratio)
  doc.addImage(logoData, 'PNG', margin, yPos - 5, logoWidth, logoHeight)
  yPos += logoHeight + 5
}

// Title (shift right if logo present)
doc.setFontSize(18)
doc.setFont('helvetica', 'bold')
```

### Verification Steps
1. Generate PDF and verify logo appears in header
2. Verify PDF still generates if logo fails to load (graceful degradation)
3. Check logo positioning and sizing

### Potential Risks
- **CORS issues:** Loading from public folder should work, but test in production - Mitigation: Try/catch with fallback
- **Performance:** Async image loading adds latency - Mitigation: Logo is small, impact minimal

---

## Issue 6: generateReportPdf Returns jsPDF Instead of Blob

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Returns Blob for download
- **Current State:** Returns jsPDF document object (line 235: `return doc`), not Blob

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/generateReportPdf.js` (line 235) - Returns `doc`
  - `downloadReportPdf()` function (lines 244-248) - Uses `doc.save()`
- **Current Implementation:** Returns raw jsPDF doc, `downloadReportPdf` calls `doc.save()`
- **Gap:** Spec says return Blob; current approach works but doesn't match spec
- **Dependencies:** Any code calling `generateReportPdf()` directly

### Fix Plan

#### Step 1: Change return type to Blob
**File:** `src/apBoost/utils/generateReportPdf.js`
**Action:** Modify return statement
**Details:**
- Change line 235 from:
```javascript
return doc
```
- To:
```javascript
return doc.output('blob')
```

#### Step 2: Update downloadReportPdf to use Blob
**File:** `src/apBoost/utils/generateReportPdf.js`
**Action:** Modify download function
**Details:**
- Update `downloadReportPdf` (lines 244-248):
```javascript
export async function downloadReportPdf(result, test, student) {
  const blob = await generateReportPdf(result, test, student)

  // Create download link
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `AP_Report_${student?.name?.replace(/\s+/g, '_') || 'Student'}_${new Date().toISOString().split('T')[0]}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
```

#### Step 3: Update JSDoc return type
**File:** `src/apBoost/utils/generateReportPdf.js`
**Action:** Update function documentation
**Details:**
- Change line 12 from `@returns {jsPDF}` to `@returns {Promise<Blob>}`

### Verification Steps
1. Verify `generateReportPdf()` returns a Blob
2. Verify `downloadReportPdf()` still works
3. Test PDF content is correct after change

### Potential Risks
- **Breaking changes:** If any code expects jsPDF doc object - Mitigation: Search codebase for direct calls
- **Low risk:** `downloadReportPdf` is likely the only consumer

---

## Issue 7: generateQuestionsPdf Returns jsPDF Instead of Blob

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Returns Blob for download
- **Current State:** Returns jsPDF document object (line 262: `return doc`), not Blob

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/generateQuestionsPdf.js` (line 262) - Returns `doc`
  - `downloadQuestionsPdf()` function (lines 271-275) - Uses `doc.save()`
- **Current Implementation:** Same pattern as `generateReportPdf`
- **Gap:** Spec says return Blob
- **Dependencies:** Any code calling `generateQuestionsPdf()` directly

### Fix Plan

#### Step 1: Change return type to Blob
**File:** `src/apBoost/utils/generateQuestionsPdf.js`
**Action:** Modify return statement
**Details:**
- Change line 262 from:
```javascript
return doc
```
- To:
```javascript
return doc.output('blob')
```

#### Step 2: Update downloadQuestionsPdf to use Blob
**File:** `src/apBoost/utils/generateQuestionsPdf.js`
**Action:** Modify download function
**Details:**
- Update `downloadQuestionsPdf` (lines 271-275):
```javascript
export async function downloadQuestionsPdf(test, questions, options = {}) {
  const blob = await generateQuestionsPdf(test, questions, options)

  // Create download link
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${test?.title?.replace(/\s+/g, '_') || 'Questions'}_${options.includeAnswers ? 'Teacher' : 'Student'}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
```

#### Step 3: Update JSDoc return type
**File:** `src/apBoost/utils/generateQuestionsPdf.js`
**Action:** Update function documentation
**Details:**
- Change line 13 `@returns {jsPDF}` to `@returns {Promise<Blob>}`

### Verification Steps
1. Verify `generateQuestionsPdf()` returns a Blob
2. Verify `downloadQuestionsPdf()` still works
3. Test both teacher and student editions

### Potential Risks
- **Same as Issue 6:** Low risk, only download helper uses it

---

## Issue 8: Section Type Configurations Missing

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Section type configurations in `apTestConfig.js`
- **Current State:** `SECTION_TYPE` constants exist in `apTypes.js:27-31` but no detailed configurations

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/apTypes.js` (lines 27-31) - Has `SECTION_TYPE` enum: MCQ, FRQ, MIXED
  - `src/apBoost/utils/apTestConfig.js` - Should have section configs
- **Current Implementation:** Only enum values exist, no configuration data
- **Gap:** Need section type configs with default time limits, question counts, etc.
- **Dependencies:** Test creation, section display, timer initialization

### Fix Plan

#### Step 1: Add section type configurations
**File:** `src/apBoost/utils/apTestConfig.js`
**Action:** Add new configuration object
**Details:**
- Add after `DEFAULT_SCORE_RANGES`:
```javascript
/**
 * Section type configurations
 * Default settings for each section type
 */
export const SECTION_TYPE_CONFIG = {
  MCQ: {
    id: 'MCQ',
    name: 'Multiple Choice',
    description: 'Multiple choice questions',
    defaultTimeMinutes: 45,
    defaultQuestionCount: 55,
    allowSkipping: true,
    showTimer: true,
    autoSubmitOnExpire: true,
  },
  FRQ: {
    id: 'FRQ',
    name: 'Free Response',
    description: 'Free response questions including SAQ, DBQ, LEQ',
    defaultTimeMinutes: 60,
    defaultQuestionCount: 4,
    allowSkipping: true,
    showTimer: true,
    autoSubmitOnExpire: true,
  },
  MIXED: {
    id: 'MIXED',
    name: 'Mixed',
    description: 'Combination of MCQ and FRQ questions',
    defaultTimeMinutes: 45,
    defaultQuestionCount: 20,
    allowSkipping: true,
    showTimer: true,
    autoSubmitOnExpire: true,
  },
}
```

#### Step 2: Add helper function
**File:** `src/apBoost/utils/apTestConfig.js`
**Action:** Add getter function
**Details:**
```javascript
/**
 * Get section type configuration
 * @param {string} sectionType - Section type (MCQ, FRQ, MIXED)
 * @returns {Object} Section configuration
 */
export function getSectionTypeConfig(sectionType) {
  return SECTION_TYPE_CONFIG[sectionType] || SECTION_TYPE_CONFIG.MIXED
}
```

### Verification Steps
1. Verify `SECTION_TYPE_CONFIG` exports correctly
2. Test `getSectionTypeConfig()` returns correct defaults
3. Verify test creation can use these configs

### Potential Risks
- **Low risk:** Additive feature, doesn't break existing code

---

## Issue 9: validateSession.js Missing (Critical)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** `validateSessionData(data)` function that checks all required session fields and returns validation result with errors
- **Current State:** No `validateSession.js` file exists in `src/apBoost/utils/`

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/services/apSessionService.js` - Creates/manages session data
  - `src/apBoost/hooks/useTestSession.js` - Uses session data
- **Current Implementation:** Session structure from `apSessionService.js:48-67`:
  ```javascript
  const sessionData = {
    userId,
    testId,
    assignmentId,
    sessionToken,
    status,
    attemptNumber,
    currentSectionIndex,
    currentQuestionIndex,
    sectionTimeRemaining: {},
    answers: {},
    flaggedQuestions: [],
    annotations: {},
    strikethroughs: {},
    lastHeartbeat,
    lastAction,
    startedAt,
    completedAt,
  }
  ```
- **Gap:** No validation utility to check session data integrity
- **Dependencies:** Session recovery, data syncing, conflict resolution

### Fix Plan

#### Step 1: Create validateSession.js
**File:** `src/apBoost/utils/validateSession.js` (NEW FILE)
**Action:** Create new utility file
**Details:**
```javascript
/**
 * Session Data Validation Utility
 * Validates session data structure and integrity
 */

import { SESSION_STATUS } from './apTypes'

/**
 * Required fields for a valid session
 */
const REQUIRED_FIELDS = [
  'userId',
  'testId',
  'status',
  'currentSectionIndex',
  'currentQuestionIndex',
]

/**
 * Optional fields with default values
 */
const OPTIONAL_FIELDS = {
  assignmentId: null,
  sessionToken: null,
  attemptNumber: 1,
  sectionTimeRemaining: {},
  answers: {},
  flaggedQuestions: [],
  annotations: {},
  strikethroughs: {},
  lastHeartbeat: null,
  lastAction: null,
  startedAt: null,
  completedAt: null,
}

/**
 * Validate session data
 * @param {Object} data - Session data to validate
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[], sanitized: Object }
 */
export function validateSessionData(data) {
  const errors = []
  const warnings = []

  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: ['Session data is null or not an object'],
      warnings: [],
      sanitized: null,
    }
  }

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`Missing required field: ${field}`)
    }
  }

  // Validate specific field types
  if (data.userId && typeof data.userId !== 'string') {
    errors.push('userId must be a string')
  }

  if (data.testId && typeof data.testId !== 'string') {
    errors.push('testId must be a string')
  }

  if (data.status && !Object.values(SESSION_STATUS).includes(data.status)) {
    errors.push(`Invalid status: ${data.status}. Must be one of: ${Object.values(SESSION_STATUS).join(', ')}`)
  }

  if (data.currentSectionIndex !== undefined && (typeof data.currentSectionIndex !== 'number' || data.currentSectionIndex < 0)) {
    errors.push('currentSectionIndex must be a non-negative number')
  }

  if (data.currentQuestionIndex !== undefined && (typeof data.currentQuestionIndex !== 'number' || data.currentQuestionIndex < 0)) {
    errors.push('currentQuestionIndex must be a non-negative number')
  }

  if (data.answers && typeof data.answers !== 'object') {
    errors.push('answers must be an object')
  }

  if (data.flaggedQuestions && !Array.isArray(data.flaggedQuestions)) {
    errors.push('flaggedQuestions must be an array')
  }

  // Warnings for optional but expected fields
  if (!data.sessionToken) {
    warnings.push('sessionToken is missing - duplicate tab detection may not work')
  }

  if (!data.startedAt) {
    warnings.push('startedAt timestamp is missing')
  }

  // Create sanitized version with defaults
  const sanitized = errors.length === 0 ? {
    ...OPTIONAL_FIELDS,
    ...data,
    // Ensure arrays and objects exist
    answers: data.answers || {},
    flaggedQuestions: data.flaggedQuestions || [],
    sectionTimeRemaining: data.sectionTimeRemaining || {},
    annotations: data.annotations || {},
    strikethroughs: data.strikethroughs || {},
  } : null

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitized,
  }
}

/**
 * Validate session for resume (additional checks)
 * @param {Object} session - Session data
 * @param {string} expectedUserId - Expected user ID
 * @param {string} expectedTestId - Expected test ID
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateSessionForResume(session, expectedUserId, expectedTestId) {
  const baseValidation = validateSessionData(session)
  const errors = [...baseValidation.errors]

  if (baseValidation.valid) {
    // Check user match
    if (session.userId !== expectedUserId) {
      errors.push('Session belongs to a different user')
    }

    // Check test match
    if (session.testId !== expectedTestId) {
      errors.push('Session is for a different test')
    }

    // Check status allows resume
    if (session.status === SESSION_STATUS.COMPLETED) {
      errors.push('Session is already completed and cannot be resumed')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Check if session data is stale
 * @param {Object} session - Session data
 * @param {number} maxAgeMs - Maximum age in milliseconds (default: 24 hours)
 * @returns {boolean} True if session is stale
 */
export function isSessionStale(session, maxAgeMs = 24 * 60 * 60 * 1000) {
  if (!session?.lastAction) return false

  const lastActionTime = session.lastAction?.toDate?.() || session.lastAction
  if (!(lastActionTime instanceof Date)) return false

  const age = Date.now() - lastActionTime.getTime()
  return age > maxAgeMs
}

export default validateSessionData
```

### Verification Steps
1. Import `validateSessionData` in useTestSession.js
2. Test validation with valid session data
3. Test validation with missing required fields
4. Test validation with invalid field types
5. Verify sanitized output fills defaults

### Potential Risks
- **Low risk:** New utility, doesn't change existing behavior until integrated

---

## Issue 10: HEIC to JPEG Conversion Missing

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Converts HEIC to JPEG if needed
- **Current State:** HEIC is listed as supported format but no conversion logic exists

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/services/apStorageService.js` (line 16) - Lists 'image/heic' as supported
  - No conversion code exists in codebase
- **Current Implementation:** HEIC files are uploaded as-is
- **Gap:** HEIC format not supported by most browsers; needs conversion for display
- **Dependencies:** File upload flow, FileUpload.jsx component

### Fix Plan

#### Step 1: Install heic2any library
**File:** `package.json`
**Action:** Add dependency
**Details:**
```bash
npm install heic2any
```
- `heic2any` is the standard library for HEIC to JPEG/PNG conversion in browser

#### Step 2: Add HEIC conversion utility
**File:** `src/apBoost/utils/imageProcessing.js` (NEW FILE)
**Action:** Create new utility file
**Details:**
```javascript
/**
 * Image Processing Utilities for FRQ Uploads
 */

/**
 * Check if file is HEIC format
 * @param {File} file - File to check
 * @returns {boolean}
 */
export function isHEIC(file) {
  return file.type === 'image/heic' ||
         file.type === 'image/heif' ||
         file.name.toLowerCase().endsWith('.heic') ||
         file.name.toLowerCase().endsWith('.heif')
}

/**
 * Convert HEIC file to JPEG
 * @param {File} file - HEIC file
 * @returns {Promise<File>} Converted JPEG file
 */
export async function convertHEICtoJPEG(file) {
  if (!isHEIC(file)) {
    return file
  }

  try {
    // Dynamic import to reduce bundle size
    const heic2any = (await import('heic2any')).default

    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    })

    // Handle case where heic2any returns array
    const resultBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob

    // Create new File with .jpg extension
    const newName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg')
    return new File([resultBlob], newName, { type: 'image/jpeg' })
  } catch (error) {
    console.error('HEIC conversion failed:', error)
    throw new Error('Failed to convert HEIC image. Please convert to JPEG manually.')
  }
}

/**
 * Process file for upload (convert if needed)
 * @param {File} file - File to process
 * @returns {Promise<File>} Processed file
 */
export async function processFileForUpload(file) {
  // Convert HEIC to JPEG
  if (isHEIC(file)) {
    return convertHEICtoJPEG(file)
  }

  return file
}
```

#### Step 3: Integrate in apStorageService.js
**File:** `src/apBoost/services/apStorageService.js`
**Action:** Add conversion step in upload flow
**Details:**
- Import the utility:
```javascript
import { processFileForUpload } from '../utils/imageProcessing'
```
- Modify `uploadFRQAnswerSheet` (around line 93):
```javascript
for (const file of files) {
  // Process file (convert HEIC if needed)
  const processedFile = await processFileForUpload(file)

  // Generate unique filename
  const timestamp = Date.now()
  const ext = processedFile.name.split('.').pop() || 'jpg'
  ...
}
```

### Verification Steps
1. Upload a HEIC file from iPhone
2. Verify it converts to JPEG before upload
3. Verify converted image displays correctly
4. Test error handling when conversion fails

### Potential Risks
- **Bundle size:** heic2any is ~1MB - Mitigation: Dynamic import
- **Conversion time:** HEIC conversion can take 2-5 seconds - Mitigation: Show progress indicator
- **Conversion failures:** Some HEIC variants may not convert - Mitigation: Error handling with user message

---

## Issue 11: Image Compression Missing

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Compresses images if needed
- **Current State:** No image compression logic exists

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/services/apStorageService.js` - File upload with 10MB limit
  - No compression code exists
- **Current Implementation:** Images uploaded at original size
- **Gap:** Large images may fail upload or be slow; compression would improve UX
- **Dependencies:** File upload flow

### Fix Plan

#### Step 1: Add compression to imageProcessing.js
**File:** `src/apBoost/utils/imageProcessing.js`
**Action:** Add compression function
**Details:**
- Add after `processFileForUpload`:
```javascript
/**
 * Compress an image file
 * @param {File} file - Image file to compress
 * @param {Object} options - Compression options
 * @param {number} options.maxWidth - Max width in pixels (default: 2000)
 * @param {number} options.maxHeight - Max height in pixels (default: 2000)
 * @param {number} options.quality - JPEG quality 0-1 (default: 0.85)
 * @param {number} options.maxSizeMB - Target max size in MB (default: 2)
 * @returns {Promise<File>} Compressed file
 */
export async function compressImage(file, options = {}) {
  const {
    maxWidth = 2000,
    maxHeight = 2000,
    quality = 0.85,
    maxSizeMB = 2,
  } = options

  // Skip if not an image or already small enough
  if (!file.type.startsWith('image/') || file.type === 'application/pdf') {
    return file
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024
  if (file.size <= maxSizeBytes) {
    return file // Already small enough
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        // Calculate new dimensions
        let { width, height } = img

        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height
          height = maxHeight
        }

        // Draw to canvas
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Compression failed'))
              return
            }

            // Create new file
            const compressedFile = new File(
              [blob],
              file.name,
              { type: 'image/jpeg' }
            )

            resolve(compressedFile)
          },
          'image/jpeg',
          quality
        )
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => reject(new Error('Failed to load image for compression'))
    img.src = URL.createObjectURL(file)
  })
}
```

#### Step 2: Update processFileForUpload
**File:** `src/apBoost/utils/imageProcessing.js`
**Action:** Add compression step
**Details:**
```javascript
export async function processFileForUpload(file, options = {}) {
  let processedFile = file

  // Convert HEIC to JPEG
  if (isHEIC(file)) {
    processedFile = await convertHEICtoJPEG(file)
  }

  // Compress if image and large
  if (processedFile.type.startsWith('image/') && processedFile.type !== 'application/pdf') {
    processedFile = await compressImage(processedFile, options)
  }

  return processedFile
}
```

### Verification Steps
1. Upload a large image (>5MB)
2. Verify compression reduces file size
3. Verify image quality is acceptable
4. Test compression doesn't affect PDFs

### Potential Risks
- **Quality loss:** Compression reduces quality - Mitigation: Configurable quality setting, default 0.85
- **Memory usage:** Large images load into memory - Mitigation: Max dimensions limit
- **Low risk:** Graceful fallback to original file

---

## Implementation Order

Recommended order to implement fixes (considering dependencies):

1. **Issue 9: validateSession.js** - Foundation utility for session integrity; other session fixes may use this
2. **Issue 8: Section Type Configurations** - Standalone config, no dependencies
3. **Issue 2: Subject Default Time Limits** - Standalone config addition
4. **Issue 3: Move Score Ranges** - Simple reorganization
5. **Issue 1: Subject Constants Location** - File organization
6. **Issue 4: logError Enhancement** - Small improvement, standalone
7. **Issue 10: HEIC Conversion** - Create new imageProcessing.js
8. **Issue 11: Image Compression** - Build on imageProcessing.js
9. **Issue 5: Answer Sheet PDF Logo** - Standalone PDF enhancement
10. **Issue 6: Report PDF Return Blob** - Simple change
11. **Issue 7: Questions PDF Return Blob** - Simple change, same pattern as #6

---

## Cross-Cutting Concerns

### New Utility File: imageProcessing.js
Issues 10 and 11 both require creating `src/apBoost/utils/imageProcessing.js`. Implement both in same file:
- `isHEIC(file)`
- `convertHEICtoJPEG(file)`
- `compressImage(file, options)`
- `processFileForUpload(file, options)` - combines both

### PDF Generation Pattern
Issues 5, 6, 7 all relate to PDF generation utilities. Ensure consistent patterns:
- All generators return `Promise<Blob>`
- All have matching `download*Pdf()` helper
- All handle errors gracefully

---

## Notes for Implementer

1. **Testing HEIC conversion** - Requires actual HEIC file from iPhone/iPad; can't easily test in dev
2. **Logo file exists** - `/public/apBoost/ap_logo_small.png` already exists, just needs embedding
3. **heic2any bundle** - Use dynamic import to avoid bloating main bundle
4. **Validation utility** - Consider using in session recovery flow after implementation
5. **Re-exports for backward compatibility** - When moving constants between files, add re-exports to prevent breaking changes
