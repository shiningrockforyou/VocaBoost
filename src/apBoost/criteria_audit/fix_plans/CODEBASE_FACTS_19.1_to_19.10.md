# CODEBASE FACTS: Sections 19.1 to 19.10 (Utilities Detailed)

**CHUNK_ID:** `UNK__19.1_to_19.10`
**Generated:** 2026-01-14
**Inspector:** Claude Code

---

## 1) Canonical Data Schema / Source-of-Truth

### AP_SUBJECTS Configuration
**Found: Yes**

- **Location:** `src/apBoost/utils/apTestConfig.js:5-66`
- **Shape:** Object with subject ID keys, each containing:
  - `id: string` - Subject identifier (e.g., `'AP_US_HISTORY'`)
  - `name: string` - Full display name (e.g., `'AP United States History'`)
  - `shortName: string` - Abbreviated name (e.g., `'APUSH'`)
  - `color: string` - Hex color code (e.g., `'#1a365d'`)
- **NO default time limits present**
- **10 subjects defined:** AP_US_HISTORY, AP_WORLD_HISTORY, AP_EURO_HISTORY, AP_LANG, AP_LIT, AP_GOV, AP_PSYCH, AP_BIO, AP_CHEM, AP_PHYSICS

**Evidence:** `src/apBoost/utils/apTestConfig.js:5-24`
```javascript
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

### Subject ID Constants / Enum
**Found: No**

- No `AP_SUBJECT` enum or subject ID constants exist in `apTypes.js`
- Subject identifiers are only stored as string keys within `AP_SUBJECTS` object

**Evidence:** `src/apBoost/utils/apTypes.js:1-99` - No subject-related exports besides type enums

### DEFAULT_SCORE_RANGES
**Found: Yes**

- **Location:** `src/apBoost/utils/apTypes.js:81-87`
- **NOT in apTestConfig.js** (per fix plan, should be moved)
- **Shape:**
```javascript
export const DEFAULT_SCORE_RANGES = {
  ap5: { min: 80, max: 100 },
  ap4: { min: 65, max: 79 },
  ap3: { min: 50, max: 64 },
  ap2: { min: 35, max: 49 },
  ap1: { min: 0, max: 34 },
}
```

**Evidence:** `src/apBoost/utils/apTypes.js:81-87`

### SECTION_TYPE Constants
**Found: Yes**

- **Location:** `src/apBoost/utils/apTypes.js:27-31`
- **Shape:** Simple enum only
```javascript
export const SECTION_TYPE = {
  MCQ: 'MCQ',
  FRQ: 'FRQ',
  MIXED: 'MIXED',
}
```
- **No SECTION_TYPE_CONFIG or getSectionTypeConfig()** exists currently

**Evidence:** `src/apBoost/utils/apTypes.js:27-31`

### Session Data Schema
**Found: Yes**

- **Creation Location:** `src/apBoost/services/apSessionService.js:48-67`
- **Schema Shape:**
```javascript
{
  userId: string,
  testId: string,
  assignmentId: string | null,
  sessionToken: string,
  status: SESSION_STATUS.IN_PROGRESS,
  attemptNumber: number,
  currentSectionIndex: number,
  currentQuestionIndex: number,
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

**Evidence:** `src/apBoost/services/apSessionService.js:48-67`

### PDF Utility Function Signatures
**Found: Yes**

| Function | File | Return Type |
|----------|------|-------------|
| `generateAnswerSheetPdf(test, student, frqQuestions)` | `generateAnswerSheetPdf.js:10` | `Blob` |
| `downloadAnswerSheetPdf(test, student, frqQuestions)` | `generateAnswerSheetPdf.js:244` | `void` (triggers download) |
| `generateReportPdf(result, test, student)` | `generateReportPdf.js:14` | `jsPDF` instance |
| `downloadReportPdf(result, test, student)` | `generateReportPdf.js:244` | `void` (uses `doc.save()`) |
| `generateQuestionsPdf(test, questions, options)` | `generateQuestionsPdf.js:14` | `jsPDF` instance |
| `downloadQuestionsPdf(test, questions, options)` | `generateQuestionsPdf.js:271` | `void` (uses `doc.save()`) |

---

## 2) Write Paths

### PDF Downloads

| What | Who Calls | Where It Goes |
|------|-----------|---------------|
| Answer sheet PDF Blob | `downloadAnswerSheetPdf()` | Browser download via `URL.createObjectURL()` |
| Report PDF | `downloadReportPdf()` | Browser download via `doc.save()` |
| Questions PDF | `downloadQuestionsPdf()` | Browser download via `doc.save()` |

**Evidence:** `src/apBoost/utils/generateAnswerSheetPdf.js:248-255`
```javascript
const url = URL.createObjectURL(blob)
const link = document.createElement('a')
link.href = url
link.download = `answer_sheet_${test.title?.replace(/[^a-z0-9]/gi, '_') || 'test'}.pdf`
document.body.appendChild(link)
link.click()
```

**Evidence:** `src/apBoost/utils/generateReportPdf.js:247`
```javascript
doc.save(filename)
```

### FRQ File Uploads

| What | Who Calls | Where It Goes |
|------|-----------|---------------|
| FRQ answer sheet files | `FRQHandwrittenMode.jsx` -> `uploadFRQAnswerSheet()` | Firebase Storage: `ap_frq_uploads/{userId}/{resultId}/{filename}` |
| Graded PDF | `uploadGradedPdf()` | Firebase Storage: `ap_frq_graded/{resultId}/graded_{timestamp}.pdf` |

**Evidence:** `src/apBoost/services/apStorageService.js:100-101`
```javascript
const storagePath = `ap_frq_uploads/${userId}/${resultId}/${filename}`
const storageRef = ref(storage, storagePath)
```

### Error Logging Output

| What | Where It Goes |
|------|---------------|
| Error info object | Console only (`console.error`) |
| No Firestore/external | Comment mentions future: Sentry/LogRocket/Crashlytics |

**Evidence:** `src/apBoost/utils/logError.js:25-33`
```javascript
// Console output for development
console.error(`[APBoost:${functionName}]`, errorInfo)

// In production, could send to:
// - Sentry/LogRocket
// - Firebase Crashlytics
// - Custom error endpoint

return errorInfo
```

### Session Creation/Persistence

| What | Who Calls | Where It Goes |
|------|-----------|---------------|
| Session document | `createOrResumeSession()` | Firestore: `ap_session_state/{sessionId}` |
| Session updates | `updateSession()`, `saveAnswer()`, etc. | Firestore: `ap_session_state/{sessionId}` |
| Test result | `createTestResult()` | Firestore: `ap_test_results/{resultId}` |

**Evidence:** `src/apBoost/services/apSessionService.js:69`
```javascript
await setDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), sessionData)
```

---

## 3) Offline/Resilience Mechanics

### Upload Resilience
**Found: Limited**

- No retry/queue mechanism in `apStorageService.js`
- Files uploaded via basic `uploadBytes()` - no resumable uploads

**Evidence:** `src/apBoost/services/apStorageService.js:104`
```javascript
const snapshot = await uploadBytes(storageRef, file, {
```

### Session Resilience
**Found: Yes**

- **Offline queue hook:** `useOfflineQueue.js` exists
- **Heartbeat monitoring:** `useHeartbeat.js` exists
- **Duplicate tab guard:** `useDuplicateTabGuard.js` exists
- **Queue integration:** `useTestSession.js` uses `addToQueue()` for answer/position sync

**Evidence:** `src/apBoost/hooks/useTestSession.js:50-52`
```javascript
const { addToQueue, flushQueue, queueLength, isOnline, isFlushing } = useOfflineQueue(session?.id)
const { instanceToken, isInvalidated, takeControl } = useDuplicateTabGuard(session?.id)
const { isConnected, failureCount, sessionTakenOver } = useHeartbeat(session?.id, instanceToken)
```

### Asset Loading Fallbacks
**Found: No**

- No fallback handling for logo load failures in PDF generation
- Logo is not currently embedded in PDFs (see section 5, Q7)

### HEIC Conversion Fallback
**Found: No**

- HEIC listed as supported but no conversion exists
- If conversion fails, user would get raw error

---

## 4) UI/Flow Entry Points

### PDF Generation/Download Entry Points

| Entry Point | File | Triggers |
|-------------|------|----------|
| "Download Answer Sheet PDF" button | `FRQHandwrittenMode.jsx:148` | `downloadAnswerSheetPdf()` |
| Report download (implied) | Component using `downloadReportPdf()` | Report PDF generation |
| Questions PDF (implied) | Teacher interface | `downloadQuestionsPdf()` |

**Evidence:** `src/apBoost/components/FRQHandwrittenMode.jsx:43-52`
```javascript
const handleDownloadPdf = useCallback(async () => {
  try {
    setError(null)
    await downloadAnswerSheetPdf(test, student, frqQuestions)
    setDownloadedPdf(true)
  } catch (err) {
    logError('FRQHandwrittenMode.downloadPdf', { testId: test?.id }, err)
    setError('Failed to generate answer sheet. Please try again.')
  }
}, [test, student, frqQuestions])
```

### FRQ Upload UI Entry Points

| Entry Point | File | Component |
|-------------|------|-----------|
| Handwritten FRQ upload flow | `FRQHandwrittenMode.jsx:221-232` | `<FileUpload>` with accept="image/jpeg,image/png,image/heic,image/webp,application/pdf" |
| Generic file upload | `FileUpload.jsx:119-170` | Drag-and-drop zone |

**Evidence:** `src/apBoost/components/FRQHandwrittenMode.jsx:221-232`
```javascript
<FileUpload
  accept="image/jpeg,image/png,image/heic,image/webp,application/pdf"
  multiple={true}
  maxSize={10 * 1024 * 1024}
  maxFiles={10}
  files={uploadedFiles}
  onUpload={handleUpload}
  onRemove={handleRemoveFile}
  isUploading={isUploading}
  uploadProgress={uploadProgress}
  disabled={disabled}
/>
```

### Subject Config Usage in UI

| Entry Point | File | Usage |
|-------------|------|-------|
| Test Editor subject dropdown | `APTestEditor.jsx:459` | `AP_SUBJECTS.map(s => ...)` (expects array) |
| Question Editor subject dropdown | `APQuestionEditor.jsx:342` | `AP_SUBJECTS.map(s => ...)` |
| Question Bank filter | `APQuestionBank.jsx:380` | `AP_SUBJECTS.map(s => ({ value: s.id, label: s.name }))` |

**Evidence:** `src/apBoost/pages/APTestEditor.jsx:7-8`
```javascript
import { SECTION_TYPE, DEFAULT_SCORE_RANGES, TEST_TYPE } from '../utils/apTypes'
import { AP_SUBJECTS } from '../utils/apTestConfig'
```

### Score Ranges Usage in UI

| Entry Point | File | Usage |
|-------------|------|-------|
| Test Editor score config | `APTestEditor.jsx:177-186` | Input fields for min/max with `DEFAULT_SCORE_RANGES` defaults |
| Scoring calculations | `apScoringService.js:53` | `calculateAPScore(percentage, scoreRanges = DEFAULT_SCORE_RANGES)` |

**Evidence:** `src/apBoost/pages/APTestEditor.jsx:214`
```javascript
const [scoreRanges, setScoreRanges] = useState(DEFAULT_SCORE_RANGES)
```

---

## 5) Must-Answer Questions

### Q1: Where is the canonical definition of AP subjects today?
**Answer:** `src/apBoost/utils/apTestConfig.js:5-66`

`AP_SUBJECTS` is an **object** (not array) with subject ID keys. Each entry has:
- `id: string`
- `name: string`
- `shortName: string`
- `color: string`

**Evidence:** `src/apBoost/utils/apTestConfig.js:5-66` (shown in section 1)

---

### Q2: Does apTypes.js export any subject identifiers (e.g., AP_SUBJECT)?
**Answer: No**

`apTypes.js` contains only type enums (QUESTION_TYPE, QUESTION_FORMAT, TEST_TYPE, SECTION_TYPE, SESSION_STATUS, GRADING_STATUS, etc.) and DEFAULT_SCORE_RANGES. No subject-related constants.

**Evidence:** `src/apBoost/utils/apTypes.js:1-99` - Full file contents show no AP_SUBJECT export

---

### Q3: Who imports/uses AP_SUBJECTS and how?
**Answer:** 3 direct consumers found

| File | Line | Usage |
|------|------|-------|
| `APTestEditor.jsx` | 8, 459 | Import + dropdown mapping (expects array via `.map()`) |
| `APQuestionEditor.jsx` | 7, 342 | Import + dropdown mapping |
| `APQuestionBank.jsx` | 7, 380 | Import + options mapping `s => ({ value: s.id, label: s.name })` |

**Critical Issue:** Consumers use `.map()` which expects an array, but `AP_SUBJECTS` is an object. They likely use `getAllSubjects()` or there's a bug.

**Evidence:** `src/apBoost/pages/APQuestionBank.jsx:7,380`
```javascript
import { AP_SUBJECTS } from '../utils/apTestConfig'
// ...
const subjectOptions = AP_SUBJECTS.map(s => ({ value: s.id, label: s.name }))
```

Also helper functions exist:
**Evidence:** `src/apBoost/utils/apTestConfig.js:83-85`
```javascript
export function getAllSubjects() {
  return Object.values(AP_SUBJECTS)
}
```

---

### Q4: Do subject configs include default time limit fields?
**Answer: No**

Subject configs only have: `id`, `name`, `shortName`, `color`

No `defaultTimeLimit` or similar field exists at subject level.

Section-level time limits exist in test documents (e.g., `section.timeLimit`) but not as subject defaults.

**Evidence:** `src/apBoost/utils/apTestConfig.js:5-66` shows no time fields
**Evidence:** `src/apBoost/hooks/useTestSession.js:133`
```javascript
return (currentSection.timeLimit || 45) * 60  // Default 45 min fallback
```

---

### Q5: Where is DEFAULT_SCORE_RANGES defined? Who uses it?
**Answer:**

**Definition:** `src/apBoost/utils/apTypes.js:81-87`

**Consumers:**
| File | Lines | Usage |
|------|-------|-------|
| `apScoringService.js` | 12, 53, 119 | Import + `calculateAPScore()` default param + `test.scoreRanges` fallback |
| `apTeacherService.js` | 19, 61 | Import + test creation fallback |
| `APTestEditor.jsx` | 7, 177, 186, 214, 243 | Import + state init + input defaults |

**Evidence:** `src/apBoost/services/apScoringService.js:53`
```javascript
export function calculateAPScore(percentage, scoreRanges = DEFAULT_SCORE_RANGES) {
```

**Evidence:** `src/apBoost/services/apTeacherService.js:61`
```javascript
scoreRanges: testData.scoreRanges || DEFAULT_SCORE_RANGES,
```

---

### Q6: What is the logError behavior/shape?
**Answer:**

**Function:** `src/apBoost/utils/logError.js:14-34`

**Signature:** `logError(functionName, context = {}, error = null)`

**Output Object Shape:**
```javascript
{
  function: functionName,        // string
  context: context,              // raw object passed in (NOT extracted)
  message: error?.message || String(error || 'Unknown error'),
  code: error?.code || null,
  stack: error?.stack || null,
  timestamp: new Date().toISOString(),
  userAgent: navigator.userAgent || 'N/A',
}
```

**Destination:** `console.error()` only (no Firestore, no external service)

**Does NOT extract sessionId/userId:** Context is stored as-is. The function name and context object are passed directly without field extraction.

**Evidence:** `src/apBoost/utils/logError.js:14-26`
```javascript
export function logError(functionName, context = {}, error = null) {
  const errorInfo = {
    function: functionName,
    context,  // <-- stored raw, not extracted
    message: error?.message || String(error || 'Unknown error'),
    code: error?.code || null,
    stack: error?.stack || null,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
  }

  // Console output for development
  console.error(`[APBoost:${functionName}]`, errorInfo)
```

---

### Q7: Is there logo inclusion in generateAnswerSheetPdf.js?
**Answer: No**

No `addImage()`, base64 loading, or logo references exist in `generateAnswerSheetPdf.js`.

The header is plain text only.

**Evidence:** `src/apBoost/utils/generateAnswerSheetPdf.js:62-79`
```javascript
// ===== PAGE 1: Header =====

// Title
doc.setFontSize(18)
doc.setFont('helvetica', 'bold')
doc.text('ANSWER SHEET', pageWidth / 2, yPos, { align: 'center' })
yPos += 10

// Test title
doc.setFontSize(14)
doc.setFont('helvetica', 'normal')
doc.text(test.title || 'Practice Test', pageWidth / 2, yPos, { align: 'center' })
```

Logo files **do exist** at:
- `public/apBoost/ap_logo.png`
- `public/apBoost/ap_logo_small.png`
- (and other variants)

**Evidence:** `public/apBoost/` directory contains 9 logo files

---

### Q8: What do generateReportPdf and generateQuestionsPdf return?
**Answer:**

| Function | Returns | Download Method |
|----------|---------|-----------------|
| `generateReportPdf()` | `jsPDF` instance (line 235: `return doc`) | `downloadReportPdf()` uses `doc.save(filename)` |
| `generateQuestionsPdf()` | `jsPDF` instance (line 262: `return doc`) | `downloadQuestionsPdf()` uses `doc.save(filename)` |
| `generateAnswerSheetPdf()` | `Blob` (line 235: `return doc.output('blob')`) | `downloadAnswerSheetPdf()` uses `URL.createObjectURL()` |

**INCONSISTENCY:** Answer sheet returns Blob, others return jsPDF doc.

**Evidence:** `src/apBoost/utils/generateReportPdf.js:235`
```javascript
return doc
```

**Evidence:** `src/apBoost/utils/generateQuestionsPdf.js:262`
```javascript
return doc
```

**Evidence:** `src/apBoost/utils/generateAnswerSheetPdf.js:235`
```javascript
return doc.output('blob')
```

---

### Q9: Are there existing utilities for doc.output('blob'), doc.save(), or URL.createObjectURL?
**Answer: Yes**

| Pattern | File | Line |
|---------|------|------|
| `doc.output('blob')` | `generateAnswerSheetPdf.js` | 235 |
| `URL.createObjectURL(blob)` | `generateAnswerSheetPdf.js` | 248 |
| `doc.save(filename)` | `generateReportPdf.js` | 247 |
| `doc.save(filename)` | `generateQuestionsPdf.js` | 274 |

**Evidence:** See Q8 above

---

### Q10: Does SECTION_TYPE_CONFIG or getSectionTypeConfig() exist?
**Answer: No**

Only `SECTION_TYPE` enum exists at `src/apBoost/utils/apTypes.js:27-31`:
```javascript
export const SECTION_TYPE = {
  MCQ: 'MCQ',
  FRQ: 'FRQ',
  MIXED: 'MIXED',
}
```

No extended configuration object. No `getSectionTypeConfig()` function.

**Usage locations:**
- `apScoringService.js:91,122` - Section type checks
- `APTestEditor.jsx:73,77-79,273` - Dropdown options
- `seedTestData.js:32` - Seed data

**Evidence:** Full grep of `SECTION_TYPE_CONFIG` returns only fix plan documents, not actual code.

---

### Q11: Is there a validateSession.js or equivalent?
**Answer: No**

No `validateSession.js`, `validateSessionData()`, `validateSessionForResume()`, or `isSessionStale()` functions exist in actual code.

Searched patterns found only in fix plan/criteria audit markdown files, not in implementation.

**Evidence:** Glob search for `**/validateSession*.js` returned "No files found"

**Current session schema sources:**
- Creation: `src/apBoost/services/apSessionService.js:48-67`
- Restoration: `src/apBoost/hooks/useTestSession.js:177-195`

---

### Q12: FRQ upload flow - HEIC conversion and image compression?
**Answer:**

**Upload flow implementation:**
- **Service:** `src/apBoost/services/apStorageService.js:81-136` - `uploadFRQAnswerSheet()`
- **UI Component:** `src/apBoost/components/FRQHandwrittenMode.jsx` - Calls service via `handleUpload()`
- **Generic upload UI:** `src/apBoost/components/FileUpload.jsx` - Drag-drop zone

**HEIC Support:**
- **Accepted:** Yes, listed in `SUPPORTED_FORMATS` at `apStorageService.js:16`
- **Conversion:** **NO** - Files uploaded as-is without HEIC→JPEG conversion

**Evidence:** `src/apBoost/services/apStorageService.js:16`
```javascript
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf']
```

**Image Compression:**
- **NOT FOUND** - No canvas-based compression, no `compressImage()`, no size threshold processing
- Files uploaded directly via `uploadBytes()` without pre-processing

**Evidence:** `src/apBoost/services/apStorageService.js:104-111`
```javascript
// Upload file
const snapshot = await uploadBytes(storageRef, file, {
  contentType: file.type,
  customMetadata: {
    originalName: file.name,
    uploadedBy: userId,
    resultId: resultId,
  }
})
```

**imageProcessing.js:** **NOT FOUND** - Glob search returned no matches

**heic2any library:** **NOT INSTALLED** - No import or usage in codebase

**Size thresholds:**
- Max per file: 10MB (`MAX_FILE_SIZE`)
- Max total: 50MB (`MAX_TOTAL_SIZE`)
- But no compression applied if under limits

**Evidence:** `src/apBoost/services/apStorageService.js:17-18`
```javascript
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB per file
const MAX_TOTAL_SIZE = 50 * 1024 * 1024 // 50MB total
```

---

## Summary of Critical Gaps

1. **AP_SUBJECTS organization:** Object in apTestConfig.js, no ID constants in apTypes.js
2. **No default time limits:** Subject configs lack time fields
3. **DEFAULT_SCORE_RANGES location:** In apTypes.js, not apTestConfig.js
4. **logError does NOT extract sessionId/userId:** Stores context object as-is
5. **No logo in answer sheet PDF:** Header is plain text only
6. **PDF return type inconsistency:** Answer sheet returns Blob, others return jsPDF
7. **No SECTION_TYPE_CONFIG:** Only simple enum exists
8. **No validateSession utility:** Must be created
9. **No HEIC conversion:** Files uploaded as-is (browser compatibility issue)
10. **No image compression:** Direct upload without processing
