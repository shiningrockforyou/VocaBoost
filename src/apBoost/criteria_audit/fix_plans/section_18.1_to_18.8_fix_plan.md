# Fix Plan: Sections 18.1 to 18.8

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_18.1_to_18.8_criteria_audit.md

## Executive Summary
- Total Issues: 9
- Partial Implementations: 6
- Missing Features: 3 (all related to validateSession.js)
- Estimated Complexity: Medium

**Note:** The audit file notes that the chunk table describes sections 18.1-18.8 as "Services (Detailed)" but they are actually "Utilities (Detailed)" per the acceptance criteria. This fix plan addresses the utility-related issues.

---

## Issue 1: Subject Constants Organization (Section 18.1)

### Audit Finding
- **Status:** Partial
- **Criterion:** Subject constants for AP subjects should be in `apTypes.js`
- **Current State:** Subject constants (`AP_SUBJECTS`) are defined in `apTestConfig.js` instead of `apTypes.js`

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/apTestConfig.js` (lines 5-66) - Contains `AP_SUBJECTS` object with 10 subjects
  - `src/apBoost/utils/apTypes.js` - Should contain subject constants per specification
- **Current Implementation:** `AP_SUBJECTS` is in apTestConfig.js with id, name, shortName, color properties
- **Gap:** Organizational difference from specification
- **Dependencies:**
  - `getSubjectConfig()` and `getAllSubjects()` functions reference `AP_SUBJECTS`
  - Need to search for imports of `AP_SUBJECTS` from `apTestConfig.js`

### Fix Plan

#### Step 1: Move AP_SUBJECTS to apTypes.js
**File:** `src/apBoost/utils/apTypes.js`
**Action:** Add
**Details:**
- Add the `AP_SUBJECTS` constant at the end of the file (before `COLLECTIONS`)
- Copy the entire object structure from `apTestConfig.js`

```javascript
// AP Subject Constants
export const AP_SUBJECTS = {
  AP_US_HISTORY: {
    id: 'AP_US_HISTORY',
    name: 'AP United States History',
    shortName: 'APUSH',
    color: '#1a365d',
  },
  // ... all other subjects
}
```

#### Step 2: Update apTestConfig.js to import from apTypes
**File:** `src/apBoost/utils/apTestConfig.js`
**Action:** Modify
**Details:**
- Import `AP_SUBJECTS` from `apTypes.js`
- Remove the local definition of `AP_SUBJECTS`
- Re-export for backward compatibility

```javascript
import { AP_SUBJECTS } from './apTypes'
export { AP_SUBJECTS }
```

#### Step 3: Update any direct imports (if any)
**Action:** Search and update
**Details:**
- Search codebase for `from '../utils/apTestConfig'` or similar imports of `AP_SUBJECTS`
- Update to import from `apTypes` if appropriate

### Verification Steps
1. Run `npm run build` - no import errors
2. Check all pages that use subject colors/names still work
3. Test APTeacherDashboard and APTestEditor which likely use subject data

### Potential Risks
- **Risk:** Breaking imports across the codebase
- **Mitigation:** Re-export from apTestConfig.js maintains backward compatibility

---

## Issue 2: Subject Configurations Missing Time Limits (Section 18.2)

### Audit Finding
- **Status:** Partial
- **Criterion:** Subject configurations should include name and default time limits
- **Current State:** Subject configs have id, name, shortName, color but NOT default time limits

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/apTestConfig.js` (lines 5-66) - Current subject definitions
- **Current Implementation:** Each subject has id, name, shortName, color
- **Gap:** Missing `defaultTimeLimits` for MCQ/FRQ sections per subject
- **Dependencies:** Test creation flows may benefit from these defaults

### Fix Plan

#### Step 1: Add default time limits to each subject
**File:** `src/apBoost/utils/apTypes.js` (after moving AP_SUBJECTS there)
**Action:** Modify
**Details:**
- Add `defaultTimeLimits` object to each subject
- Use typical AP exam time allocations per subject type

```javascript
AP_US_HISTORY: {
  id: 'AP_US_HISTORY',
  name: 'AP United States History',
  shortName: 'APUSH',
  color: '#1a365d',
  defaultTimeLimits: {
    mcq: 55, // 55 minutes for MCQ section
    frq: 100, // 100 minutes for FRQ section (typical for history)
  },
},
```

#### Step 2: Add helper function for getting time limits
**File:** `src/apBoost/utils/apTestConfig.js`
**Action:** Add
**Details:**
```javascript
/**
 * Get default time limits for a subject
 * @param {string} subjectId - Subject ID
 * @returns {Object} { mcq: number, frq: number } in minutes
 */
export function getSubjectTimeLimits(subjectId) {
  const subject = AP_SUBJECTS[subjectId]
  return subject?.defaultTimeLimits || { mcq: 45, frq: 60 }
}
```

### Verification Steps
1. Run build successfully
2. Check test creation flow uses reasonable defaults

### Potential Risks
- **Risk:** Time limits vary by actual AP exam; these are approximations
- **Mitigation:** Document that these are defaults that can be overridden per test

---

## Issue 3: DEFAULT_SCORE_RANGES in Wrong File (Section 18.2)

### Audit Finding
- **Status:** Partial
- **Criterion:** Default score ranges for AP 1-5 conversion should be in `apTestConfig.js`
- **Current State:** `DEFAULT_SCORE_RANGES` is in `apTypes.js` (lines 81-87)

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/apTypes.js` (lines 81-87) - Current location
  - `src/apBoost/utils/apTestConfig.js` - Specified location
- **Current Implementation:** Correct structure with ap5 through ap1 ranges
- **Gap:** Organizational placement differs from specification
- **Dependencies:** Need to find all imports of `DEFAULT_SCORE_RANGES`

### Fix Plan

#### Step 1: Move DEFAULT_SCORE_RANGES to apTestConfig.js
**File:** `src/apBoost/utils/apTestConfig.js`
**Action:** Add
**Details:**
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

#### Step 2: Update apTypes.js to remove and re-export
**File:** `src/apBoost/utils/apTypes.js`
**Action:** Modify
**Details:**
- Remove `DEFAULT_SCORE_RANGES` definition
- Add import and re-export for backward compatibility:
```javascript
// Re-export from apTestConfig for backward compatibility
export { DEFAULT_SCORE_RANGES } from './apTestConfig'
```

#### Step 3: Update direct imports if needed
**Action:** Search codebase
**Details:**
- Search for `import.*DEFAULT_SCORE_RANGES.*from.*apTypes`
- Update to import from `apTestConfig` if appropriate

### Verification Steps
1. Run build with no errors
2. Check scoring service still calculates AP scores correctly

### Potential Risks
- **Risk:** Circular imports between apTypes and apTestConfig
- **Mitigation:** Careful ordering of imports; apTestConfig should not import from apTypes for this constant

---

## Issue 4: SECTION_TYPE Configurations in Wrong File (Section 18.2)

### Audit Finding
- **Status:** Partial
- **Criterion:** Section type configurations should be in `apTestConfig.js` with extended configuration
- **Current State:** `SECTION_TYPE` is in `apTypes.js` (lines 27-31) as simple constants only

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/apTypes.js` (lines 27-31) - Current location with MCQ, FRQ, MIXED values
- **Current Implementation:** Simple string constants
- **Gap:** Missing extended configuration (default times, calculator settings, etc.)
- **Dependencies:** Used in section type checks throughout the app

### Fix Plan

#### Step 1: Create SECTION_CONFIG in apTestConfig.js
**File:** `src/apBoost/utils/apTestConfig.js`
**Action:** Add
**Details:**
```javascript
import { SECTION_TYPE } from './apTypes'

// Extended section type configurations
export const SECTION_CONFIG = {
  [SECTION_TYPE.MCQ]: {
    type: SECTION_TYPE.MCQ,
    name: 'Multiple Choice',
    defaultTimeLimit: 45, // minutes
    calculatorAllowed: false,
    autoGraded: true,
  },
  [SECTION_TYPE.FRQ]: {
    type: SECTION_TYPE.FRQ,
    name: 'Free Response',
    defaultTimeLimit: 60, // minutes
    calculatorAllowed: true, // varies by subject
    autoGraded: false,
  },
  [SECTION_TYPE.MIXED]: {
    type: SECTION_TYPE.MIXED,
    name: 'Mixed',
    defaultTimeLimit: 60, // minutes
    calculatorAllowed: false,
    autoGraded: false, // partial
  },
}

/**
 * Get section configuration by type
 * @param {string} sectionType - Section type constant
 * @returns {Object} Section configuration
 */
export function getSectionConfig(sectionType) {
  return SECTION_CONFIG[sectionType] || SECTION_CONFIG[SECTION_TYPE.MCQ]
}
```

### Verification Steps
1. Run build successfully
2. Test section creation in APTestEditor uses proper defaults

### Potential Risks
- **Risk:** None significant - additive change
- **Mitigation:** Keep SECTION_TYPE in apTypes.js for type constants, add extended config separately

---

## Issue 5: logError sessionId/userId Auto-Extraction (Section 18.3)

### Audit Finding
- **Status:** Partial
- **Criterion:** logError should include sessionId and userId if available
- **Current State:** Function accepts context parameter but doesn't auto-extract these fields

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/logError.js` (lines 14-34) - logError function
  - `src/apBoost/hooks/useTestSession.js` - Example caller passing context
  - `src/apBoost/hooks/useOfflineQueue.js` - Example caller passing context
- **Current Implementation:** Callers manually include `{ userId, sessionId }` in context
- **Gap:** No automatic extraction or validation of these fields
- **Dependencies:** Would need a way to access current session/user context globally

### Fix Plan

#### Option A: Document Current Pattern (Recommended)
The current implementation is actually correct and flexible. Callers are responsible for providing context, which is a clean pattern. The audit's concern is that sessionId/userId aren't "automatically" extracted.

**Recommendation:** Keep current pattern, but add helper context-builders:

#### Step 1: Add context helper function
**File:** `src/apBoost/utils/logError.js`
**Action:** Add
**Details:**
```javascript
/**
 * Create standard error context object
 * @param {Object} options - Context options
 * @param {string} options.userId - User ID
 * @param {string} options.sessionId - Session ID
 * @param {Object} options.extra - Additional context
 * @returns {Object} Formatted context object
 */
export function createErrorContext({ userId, sessionId, ...extra } = {}) {
  const context = {}
  if (userId) context.userId = userId
  if (sessionId) context.sessionId = sessionId
  return { ...context, ...extra }
}
```

#### Step 2: Ensure errorInfo extracts top-level userId/sessionId
**File:** `src/apBoost/utils/logError.js`
**Action:** Modify
**Details:**
- Update errorInfo to explicitly show userId and sessionId at top level if present in context:

```javascript
export function logError(functionName, context = {}, error = null) {
  const errorInfo = {
    function: functionName,
    userId: context.userId || null,     // Explicitly extract
    sessionId: context.sessionId || null, // Explicitly extract
    context: { ...context },
    message: error?.message || String(error || 'Unknown error'),
    code: error?.code || null,
    stack: error?.stack || null,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
  }
  // ... rest of function
}
```

### Verification Steps
1. Confirm logging output shows userId/sessionId prominently
2. Test error logging in useTestSession

### Potential Risks
- **Risk:** None - additive and backward compatible
- **Mitigation:** N/A

---

## Issue 6: validateSession.js Missing (Section 18.5) - CRITICAL

### Audit Finding
- **Status:** Missing (3 criteria)
- **Criterion:**
  1. `validateSessionData(data)` function
  2. Checks all required session fields exist
  3. Returns validation result with errors
- **Current State:** No `validateSession.js` file exists

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/services/apSessionService.js` (lines 47-68) - Session data structure
  - `src/apBoost/services/apStorageService.js` (lines 25-44) - Validation pattern to follow
- **Current Implementation:** None
- **Gap:** Complete utility is missing
- **Dependencies:**
  - Should be used in `getActiveSession()` and `getSession()` to validate loaded data
  - Should be used in `useTestSession.js` when loading sessions
  - Pattern exists in `validateFile()` that can be followed

### Fix Plan

#### Step 1: Create validateSession.js file
**File:** `src/apBoost/utils/validateSession.js`
**Action:** Create
**Details:**

```javascript
/**
 * Session Data Validation Utility
 * Validates session data loaded from Firestore for data integrity
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
 * Optional fields with their expected types
 */
const OPTIONAL_FIELDS = {
  assignmentId: 'string',
  sessionToken: 'string',
  attemptNumber: 'number',
  sectionTimeRemaining: 'object',
  answers: 'object',
  flaggedQuestions: 'array',
  annotations: 'object',
  strikethroughs: 'object',
  startedAt: 'object', // Firestore Timestamp
  completedAt: 'object', // Firestore Timestamp or null
  lastHeartbeat: 'object',
  lastAction: 'object',
}

/**
 * Valid session statuses
 */
const VALID_STATUSES = Object.values(SESSION_STATUS)

/**
 * Validate session data from Firestore
 * @param {Object} data - Session data object
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateSessionData(data) {
  const errors = []
  const warnings = []

  // Check if data exists
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: ['Session data is null or not an object'],
      warnings: [],
    }
  }

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`Missing required field: ${field}`)
    }
  }

  // Validate specific field values
  if (data.status && !VALID_STATUSES.includes(data.status)) {
    errors.push(`Invalid session status: ${data.status}. Expected one of: ${VALID_STATUSES.join(', ')}`)
  }

  if (data.currentSectionIndex !== undefined && typeof data.currentSectionIndex !== 'number') {
    errors.push(`currentSectionIndex must be a number, got: ${typeof data.currentSectionIndex}`)
  }

  if (data.currentQuestionIndex !== undefined && typeof data.currentQuestionIndex !== 'number') {
    errors.push(`currentQuestionIndex must be a number, got: ${typeof data.currentQuestionIndex}`)
  }

  if (data.currentSectionIndex !== undefined && data.currentSectionIndex < 0) {
    errors.push(`currentSectionIndex cannot be negative: ${data.currentSectionIndex}`)
  }

  if (data.currentQuestionIndex !== undefined && data.currentQuestionIndex < 0) {
    errors.push(`currentQuestionIndex cannot be negative: ${data.currentQuestionIndex}`)
  }

  // Check optional field types (warnings only)
  if (data.answers !== undefined && typeof data.answers !== 'object') {
    warnings.push(`answers should be an object, got: ${typeof data.answers}`)
  }

  if (data.flaggedQuestions !== undefined && !Array.isArray(data.flaggedQuestions)) {
    warnings.push(`flaggedQuestions should be an array, got: ${typeof data.flaggedQuestions}`)
  }

  if (data.attemptNumber !== undefined && typeof data.attemptNumber !== 'number') {
    warnings.push(`attemptNumber should be a number, got: ${typeof data.attemptNumber}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validate and sanitize session data
 * Returns sanitized data with defaults for missing optional fields
 * @param {Object} data - Session data object
 * @returns {Object} { valid: boolean, data: Object|null, errors: string[] }
 */
export function validateAndSanitizeSession(data) {
  const validation = validateSessionData(data)

  if (!validation.valid) {
    return {
      valid: false,
      data: null,
      errors: validation.errors,
    }
  }

  // Sanitize with defaults
  const sanitized = {
    ...data,
    answers: data.answers || {},
    flaggedQuestions: data.flaggedQuestions || [],
    annotations: data.annotations || {},
    strikethroughs: data.strikethroughs || {},
    sectionTimeRemaining: data.sectionTimeRemaining || {},
    attemptNumber: data.attemptNumber || 1,
  }

  return {
    valid: true,
    data: sanitized,
    errors: [],
    warnings: validation.warnings,
  }
}

export default validateSessionData
```

#### Step 2: Integrate into apSessionService.js
**File:** `src/apBoost/services/apSessionService.js`
**Action:** Modify
**Details:**
- Import the validation function
- Use it in `getSession()` and `getActiveSession()` to validate data before returning

```javascript
import { validateAndSanitizeSession } from '../utils/validateSession'
import { logWarning } from '../utils/logError'

// In getActiveSession():
export async function getActiveSession(testId, userId) {
  try {
    // ... existing query code ...

    const doc = sessionsSnap.docs[0]
    const rawData = doc.data()

    // Validate session data
    const validation = validateAndSanitizeSession(rawData)
    if (!validation.valid) {
      logWarning('getActiveSession', `Invalid session data: ${validation.errors.join(', ')}`, { testId, userId })
      return null
    }

    if (validation.warnings.length > 0) {
      logWarning('getActiveSession', `Session data warnings: ${validation.warnings.join(', ')}`, { testId, userId })
    }

    return { id: doc.id, ...validation.data }
  } catch (error) {
    // ... existing error handling ...
  }
}
```

#### Step 3: Integrate into useTestSession.js
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify (optional enhancement)
**Details:**
- Validation already happens in service layer
- Could add validation logging if needed

### Verification Steps
1. Unit test validateSessionData with valid data - returns `{ valid: true, errors: [], warnings: [] }`
2. Unit test with missing userId - returns error for missing field
3. Unit test with invalid status - returns error for invalid status
4. Integration test: Load an existing session and verify it validates
5. Integration test: Corrupt a session in Firestore and verify graceful handling

### Potential Risks
- **Risk:** Overly strict validation could reject valid sessions with unexpected fields
- **Mitigation:** Only validate required fields strictly; use warnings for optional fields
- **Risk:** Performance impact on every session load
- **Mitigation:** Validation is lightweight; only checking field existence and types

---

## Issue 7: AP Logo Missing in Answer Sheet PDF (Section 18.6)

### Audit Finding
- **Status:** Partial
- **Criterion:** Answer sheet PDF should include AP logo and header with test/student info
- **Current State:** Header includes text but NO AP logo image

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/generateAnswerSheetPdf.js` (lines 62-97) - Header section
  - `public/apBoost/` - Contains AP logo assets (ap_logo.png, ap_logo_small.png, etc.)
- **Current Implementation:** Text-only header with "ANSWER SHEET" title
- **Gap:** No logo image included
- **Dependencies:** jsPDF supports image embedding via `doc.addImage()`

### Fix Plan

#### Step 1: Add logo loading and embedding
**File:** `src/apBoost/utils/generateAnswerSheetPdf.js`
**Action:** Modify
**Details:**

```javascript
import { jsPDF } from 'jspdf'

// Logo path (relative to public directory)
const AP_LOGO_PATH = '/apBoost/ap_logo_small.png'

/**
 * Load image as base64 for PDF embedding
 * @param {string} path - Path to image
 * @returns {Promise<string>} Base64 image data
 */
async function loadImageAsBase64(path) {
  try {
    const response = await fetch(path)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.warn('Failed to load logo image:', error)
    return null
  }
}

export async function generateAnswerSheetPdf(test, student, frqQuestions) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  })

  // ... existing setup code ...

  let yPos = margin

  // ===== PAGE 1: Header with Logo =====

  // Try to add logo
  try {
    const logoBase64 = await loadImageAsBase64(AP_LOGO_PATH)
    if (logoBase64) {
      // Add logo centered at top (30mm wide, auto height)
      const logoWidth = 30
      const logoHeight = 15 // approximate, adjust based on actual logo aspect ratio
      const logoX = (pageWidth - logoWidth) / 2
      doc.addImage(logoBase64, 'PNG', logoX, yPos, logoWidth, logoHeight)
      yPos += logoHeight + 5
    }
  } catch (error) {
    // Silently fail - logo is optional enhancement
    console.warn('Could not add logo to PDF:', error)
  }

  // Title (existing code)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('ANSWER SHEET', pageWidth / 2, yPos, { align: 'center' })
  yPos += 10

  // ... rest of existing code ...
}
```

### Verification Steps
1. Generate answer sheet PDF - logo appears at top
2. Test with logo file missing - PDF still generates with text-only header
3. Check logo scales properly and looks professional

### Potential Risks
- **Risk:** Logo file might not be accessible in all deployment contexts
- **Mitigation:** Graceful fallback to text-only header if logo fails to load
- **Risk:** Logo size/aspect ratio issues
- **Mitigation:** Test with actual logo files and adjust dimensions

---

## Issue 8: PDF Return Types (Section 18.6, 18.7, 18.8)

### Audit Finding
- **Status:** Partial (minor)
- **Criterion:** PDF generators should return Blob for download
- **Current State:** `generateReportPdf` and `generateQuestionsPdf` return jsPDF document, not Blob

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/generateAnswerSheetPdf.js` (line 235) - Returns `doc.output('blob')` - CORRECT
  - `src/apBoost/utils/generateReportPdf.js` (line 235) - Returns `doc` (jsPDF) - INCORRECT per spec
  - `src/apBoost/utils/generateQuestionsPdf.js` (line 262) - Returns `doc` (jsPDF) - INCORRECT per spec
- **Current Implementation:** Inconsistent return types
- **Gap:** Two files return jsPDF document instead of Blob

### Fix Plan

#### Step 1: Update generateReportPdf.js return
**File:** `src/apBoost/utils/generateReportPdf.js`
**Action:** Modify
**Details:**
- Change line 235 from `return doc` to `return doc.output('blob')`
- Update JSDoc return type to `@returns {Promise<Blob>}`

#### Step 2: Update downloadReportPdf helper
**File:** `src/apBoost/utils/generateReportPdf.js`
**Action:** Modify
**Details:**
```javascript
export async function downloadReportPdf(result, test, student) {
  const blob = await generateReportPdf(result, test, student)

  // Create download link from blob
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

#### Step 3: Update generateQuestionsPdf.js return
**File:** `src/apBoost/utils/generateQuestionsPdf.js`
**Action:** Modify
**Details:**
- Change line 262 from `return doc` to `return doc.output('blob')`
- Update JSDoc return type to `@returns {Promise<Blob>}`
- Update `downloadQuestionsPdf` helper similarly

### Verification Steps
1. Download report PDF - works correctly
2. Download questions PDF - works correctly
3. Verify blob URLs are properly revoked to prevent memory leaks

### Potential Risks
- **Risk:** Any code using `doc.save()` directly will break
- **Mitigation:** Use helper download functions which handle this correctly

---

## Implementation Order

Recommended order to implement fixes (considering dependencies):

1. **Issue 6: validateSession.js (CRITICAL)** - No dependencies, creates new file, most important missing feature
2. **Issue 1: Subject Constants Organization** - Foundational, moves constants to proper location
3. **Issue 3: DEFAULT_SCORE_RANGES Location** - Depends on knowing how to handle apTypes/apTestConfig relationship
4. **Issue 4: SECTION_TYPE Configurations** - Adds new config object
5. **Issue 2: Subject Time Limits** - Can be done after Issue 1
6. **Issue 5: logError Enhancement** - Independent, simple enhancement
7. **Issue 7: AP Logo in PDF** - Independent, enhancement
8. **Issue 8: PDF Return Types** - Independent, consistency fix

---

## Cross-Cutting Concerns

### Export Consistency Pattern
When moving constants between files, always:
1. Add to new location with proper export
2. In old location: `export { CONSTANT } from './newFile'` for backward compatibility
3. Search codebase for imports and update over time

### Validation Pattern
Follow the pattern from `apStorageService.js`:
```javascript
return { valid: boolean, error?: string } // for single error
return { valid: boolean, errors: string[], warnings: string[] } // for multiple
```

### Error Logging Pattern
When calling logError, always include:
```javascript
logError('functionName', { userId, sessionId, ...extra }, error)
```

---

## Notes for Implementer

1. **Backward Compatibility:** When moving constants, always re-export from old location to avoid breaking existing code.

2. **Testing Validation:** For validateSession.js, consider adding unit tests since this is critical for data integrity.

3. **Logo Dimensions:** The AP logo dimensions in the PDF fix plan (30mm x 15mm) are estimates. Test with actual logo file and adjust.

4. **Time Limits:** The default time limits added to subjects are approximations based on typical AP exam structures. These should be reviewed against actual AP exam specifications.

5. **TypeScript Future:** If the project migrates to TypeScript, the validation function could become a type guard with proper typing.

6. **Build Verification:** After each change, run `npm run build` to catch any import errors immediately.
