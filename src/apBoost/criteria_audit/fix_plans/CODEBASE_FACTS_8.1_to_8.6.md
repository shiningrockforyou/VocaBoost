# CODEBASE_FACTS__UNK__8.1_to_8.6

**Chunk ID:** UNK__8.1_to_8.6
**Inspection Date:** 2026-01-14
**Inspector:** Claude Agent

---

## 1) Canonical Data Schema / Source-of-Truth

**Found: Yes**

### 1.1 Assignment Schema (ap_assignments collection)

The assignment schema is constructed in `createAssignment()` and stored in Firestore.

**Source:** [apTeacherService.js:230-246](src/apBoost/services/apTeacherService.js#L230-L246)
```javascript
export async function createAssignment(assignmentData) {
  try {
    const assignmentsRef = collection(db, COLLECTIONS.ASSIGNMENTS)

    const newAssignment = {
      testId: assignmentData.testId,
      classIds: assignmentData.classIds || [],
      studentIds: assignmentData.studentIds || [],
      dueDate: assignmentData.dueDate || null,
      maxAttempts: assignmentData.maxAttempts || 1,
      frqSubmissionType: assignmentData.frqSubmissionType || 'TYPED',
      assignedBy: assignmentData.assignedBy,
      assignedAt: serverTimestamp(),
    }

    const docRef = await addDoc(assignmentsRef, newAssignment)
    return docRef.id
  }
```

**Assignment Fields (inferred from writes):**
| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `testId` | string | required | Reference to ap_tests |
| `classIds` | string[] | [] | Selected class IDs |
| `studentIds` | string[] | [] | Aggregated student IDs |
| `dueDate` | Date\|null | null | Optional deadline |
| `maxAttempts` | number | 1 | Max retakes allowed |
| `frqSubmissionType` | string | 'TYPED' | 'TYPED' or 'HANDWRITTEN' |
| `assignedBy` | string | required | Teacher user ID |
| `assignedAt` | Timestamp | serverTimestamp() | Creation time |

**Key Finding:** `frqSubmissionType` IS stored on assignment. No `allowStudentChoice` field exists.

---

### 1.2 Test Result Schema (ap_test_results collection)

The result schema is constructed in `createTestResult()`.

**Source:** [apScoringService.js:127-154](src/apBoost/services/apScoringService.js#L127-L154)
```javascript
const resultData = {
  userId: session.userId,
  testId: session.testId,
  classId: session.classId || null,
  assignmentId: session.assignmentId || null,
  attemptNumber: session.attemptNumber,
  isFirstAttempt: session.attemptNumber === 1,
  sessionId: session.id,
  answers,
  score: totalScore,
  maxScore,
  percentage,
  apScore,
  sectionScores,
  mcqResults,
  // FRQ submission data
  frqSubmissionType: frqData?.frqSubmissionType || null,
  frqUploadedFiles: frqData?.frqUploadedFiles || null,
  frqAnswers: session.answers || {}, // Typed FRQ answers from session
  frqMaxPoints: 0, // Will be calculated from FRQ section questions
  frqScore: null, // Set after grading
  annotatedPdfUrl: null, // Teacher's annotated PDF
  frqGrades: null,
  gradingStatus,
  startedAt: session.startedAt,
  completedAt: serverTimestamp(),
  gradedAt: null,
}
```

**Result Fields for FRQ (inferred from writes/reads):**
| Field | Type | Notes |
|-------|------|-------|
| `frqSubmissionType` | string\|null | 'TYPED', 'HANDWRITTEN', or null |
| `frqUploadedFiles` | Object[]\|null | Array of `{name, originalName, url, size, type, path}` |
| `frqAnswers` | Object | Map of questionId -> answer (typed responses) |
| `annotatedPdfUrl` | string\|null | Teacher's graded PDF URL |
| `frqGrades` | Object\|null | `{ [questionId]: { subScores, comment, maxPoints } }` |
| `gradingStatus` | string | PENDING, IN_PROGRESS, COMPLETE, NOT_NEEDED |

**Key Finding:** Field is `frqUploadedFiles` (array), NOT `frqUploadUrl` (string). Field is `annotatedPdfUrl`, NOT `frqGradedPdfUrl`.

---

### 1.3 FRQ_SUBMISSION_TYPE Enum

**Source:** [apTypes.js:50-53](src/apBoost/utils/apTypes.js#L50-L53)
```javascript
export const FRQ_SUBMISSION_TYPE = {
  TYPED: 'TYPED',
  HANDWRITTEN: 'HANDWRITTEN',
}
```

---

### 1.4 Stimulus Schema

**Source:** [apTypes.js:56-62](src/apBoost/utils/apTypes.js#L56-L62)
```javascript
export const STIMULUS_TYPE = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  PASSAGE: 'PASSAGE',
  DOCUMENT: 'DOCUMENT',
  CHART: 'CHART',
}
```

**Stimulus Object Shape (inferred from QuestionDisplay.jsx and generateAnswerSheetPdf.js):**
| Field | Type | Notes |
|-------|------|-------|
| `type` | string | STIMULUS_TYPE enum value |
| `content` | string | Text content OR image URL for IMAGE/CHART types |
| `source` | string\|undefined | Citation/attribution |
| `imageUrl` | string\|undefined | Alternative field for image URL (not consistently used) |
| `imageAlt` | string\|undefined | Alt text for images |

**Evidence from QuestionDisplay.jsx:15-22:**
```javascript
{type === STIMULUS_TYPE.IMAGE || type === STIMULUS_TYPE.CHART ? (
  <div>
    <img
      src={content}
      alt={stimulus.imageAlt || 'Stimulus image'}
      className="max-w-full h-auto rounded-[--radius-sm]"
    />
```

---

### 1.5 Uploaded File Object Shape

**Source:** [apStorageService.js:116-123](src/apBoost/services/apStorageService.js#L116-L123)
```javascript
uploadedFiles.push({
  name: filename,
  originalName: file.name,
  url,
  size: file.size,
  type: file.type,
  path: storagePath,
})
```

**Shape:** `{ name, originalName, url, size, type, path }`

---

## 2) Write Paths

**Found: Yes**

### 2.1 FRQ Handwritten Upload Flow

**Entry Point:** FRQHandwrittenMode.jsx → FileUpload.jsx
**Service:** apStorageService.uploadFRQAnswerSheet()
**Storage Path:** `ap_frq_uploads/${userId}/${resultId}/page_${n}_${timestamp}.${ext}`

**Flow Summary:**
1. User selects files in `FileUpload.jsx` (lines 67-73)
2. `FRQHandwrittenMode.handleUpload()` calls `uploadFRQAnswerSheet()` (lines 55-86)
3. Files uploaded to Firebase Storage (apStorageService.js:81-136)
4. Upload results passed to parent via `onFilesUploaded(newFiles)` (line 77)
5. On test submission, `frqUploadedFiles` array passed to `submitTest()` (APTestSession.jsx:184-188)
6. Stored in `ap_test_results` document via `createTestResult()` (apScoringService.js:143-144)

**Evidence - Storage Path Pattern:**
**Source:** [apStorageService.js:97-100](src/apBoost/services/apStorageService.js#L97-L100)
```javascript
const timestamp = Date.now()
const ext = file.name.split('.').pop() || 'jpg'
const filename = `page_${completedFiles + 1}_${timestamp}.${ext}`
const storagePath = `ap_frq_uploads/${userId}/${resultId}/${filename}`
```

---

### 2.2 Graded PDF Upload Flow

**Entry Point:** GradingPanel.jsx → FileUpload.jsx
**Service:** apStorageService.uploadGradedPdf()
**Storage Path:** `ap_frq_graded/${resultId}/graded_${timestamp}.pdf`

**Flow Summary:**
1. Teacher uploads PDF in `GradingPanel.jsx` (lines 317-337)
2. `uploadGradedPdf()` called with file (apStorageService.js:145-177)
3. URL stored in local state `annotatedPdfUrl` (line 330)
4. On "Mark Complete", URL saved via `saveGrade()` (line 305)
5. Stored to Firestore as `annotatedPdfUrl` field (apGradingService.js:177-178)

**Evidence - Storage Path Pattern:**
**Source:** [apStorageService.js:156-158](src/apBoost/services/apStorageService.js#L156-L158)
```javascript
const timestamp = Date.now()
const storagePath = `ap_frq_graded/${resultId}/graded_${timestamp}.pdf`
const storageRef = ref(storage, storagePath)
```

**Evidence - Save to Firestore:**
**Source:** [apGradingService.js:176-179](src/apBoost/services/apGradingService.js#L176-L179)
```javascript
if (annotatedPdfUrl) {
  updateData.annotatedPdfUrl = annotatedPdfUrl
}
```

---

### 2.3 Answer Sheet PDF Generation

**Entry Point:** FRQHandwrittenMode.jsx → generateAnswerSheetPdf.js
**Invocation:** "Download Answer Sheet PDF" button (lines 147-161)

**Flow Summary:**
1. User clicks download button in `FRQHandwrittenMode.jsx`
2. `downloadAnswerSheetPdf()` called (line 46)
3. PDF generated with jsPDF (generateAnswerSheetPdf.js)
4. Blob created and download triggered (lines 248-256)

**Evidence - Download Trigger:**
**Source:** [FRQHandwrittenMode.jsx:43-51](src/apBoost/components/FRQHandwrittenMode.jsx#L43-L51)
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

---

## 3) Offline/Resilience Mechanics

**Found: No — Limited resilience found**

### 3.1 Error Handling in Upload

**Source:** [FRQHandwrittenMode.jsx:79-85](src/apBoost/components/FRQHandwrittenMode.jsx#L79-L85)
```javascript
} catch (err) {
  logError('FRQHandwrittenMode.upload', { sessionId: session?.id }, err)
  setError(err.message || 'Failed to upload files. Please try again.')
} finally {
  setIsUploading(false)
  setUploadProgress(0)
}
```

### 3.2 Object URL Cleanup

**Found in generateAnswerSheetPdf.js only:**
**Source:** [generateAnswerSheetPdf.js:248-256](src/apBoost/utils/generateAnswerSheetPdf.js#L248-L256)
```javascript
const url = URL.createObjectURL(blob)
const link = document.createElement('a')
link.href = url
link.download = `answer_sheet_${test.title?.replace(/[^a-z0-9]/gi, '_') || 'test'}.pdf`
document.body.appendChild(link)
link.click()
document.body.removeChild(link)
URL.revokeObjectURL(url)
```

**NOT Found:** No cleanup in FileUpload.jsx for preview URLs.

### 3.3 PDF Logo Loading Failures

**NOT Found:** No logo loading in generateAnswerSheetPdf.js currently. No try/catch for image loading.

### 3.4 Stimulus Image Loading Failures

**NOT Found:** No error handling for stimulus image loading in QuestionDisplay.jsx.

---

## 4) UI/Flow Entry Points

**Found: Yes**

### 4.1 InstructionScreen Rendering

**Location:** APTestSession.jsx lines 258-269

**Source:** [APTestSession.jsx:258-269](src/apBoost/pages/APTestSession.jsx#L258-L269)
```javascript
if (view === 'instruction') {
  return (
    <div className="min-h-screen bg-base">
      <APHeader />
      <InstructionScreen
        test={test}
        existingSession={session}
        onBegin={handleBegin}
        onCancel={handleCancel}
      />
    </div>
  )
}
```

**Props Received by InstructionScreen:**
- `test` - Test object with sections
- `assignment` - NOT PASSED (missing)
- `existingSession` - Session for resume logic
- `onBegin` - Start test callback
- `onCancel` - Cancel callback

**Key Finding:** `frqSubmissionType` is NOT passed to InstructionScreen. Assignment object is NOT passed.

---

### 4.2 FRQ Mode Selection (Student Choice UI)

**Location:** APTestSession.jsx lines 273-326

**Source:** [APTestSession.jsx:159-163](src/apBoost/pages/APTestSession.jsx#L159-L163)
```javascript
// When entering FRQ section for first time, show submission choice
useEffect(() => {
  if (isFRQSection && view === 'testing' && frqSubmissionType === null) {
    setView('frqChoice')
  }
}, [isFRQSection, view, frqSubmissionType])
```

**Current Behavior:** Student ALWAYS gets to choose FRQ mode when entering FRQ section, regardless of assignment setting.

**Evidence - Choice UI:**
**Source:** [APTestSession.jsx:289-316](src/apBoost/pages/APTestSession.jsx#L289-L316)
```javascript
<button
  onClick={() => handleFRQChoice(FRQ_SUBMISSION_TYPE.TYPED)}
  className="p-6 rounded-[--radius-card] border-2 border-border-default hover:border-brand-primary text-left transition-colors group"
>
  <div className="text-3xl mb-3">⌨️</div>
  <h3 className="font-semibold text-text-primary mb-2">
    Type Your Answers
  </h3>
...
<button
  onClick={() => handleFRQChoice(FRQ_SUBMISSION_TYPE.HANDWRITTEN)}
```

**Key Finding:** Student-facing FRQ mode selection UI EXISTS but ignores assignment.frqSubmissionType.

---

### 4.3 FileUpload Component

**Location:** Used in FRQHandwrittenMode.jsx and GradingPanel.jsx

**Source:** [FRQHandwrittenMode.jsx:221-232](src/apBoost/components/FRQHandwrittenMode.jsx#L221-L232)
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

**Preview Rendering:** Uses `file.url` for already-uploaded files (line 191-196), NOT local previews.

---

### 4.4 HandwrittenViewer (Grading Panel)

**Location:** GradingPanel.jsx lines 11-110

**Evidence - Image Fit Behavior:**
**Source:** [GradingPanel.jsx:37-46](src/apBoost/components/grading/GradingPanel.jsx#L37-L46)
```javascript
) : (
  <img
    src={currentFile.url}
    alt={`Page ${currentIndex + 1}`}
    className="max-w-full max-h-full object-contain transition-transform"
    style={{
      transform: `scale(${zoom}) rotate(${rotation}deg)`,
    }}
  />
)}
```

**Fit Behavior:** `object-contain` with `max-w-full max-h-full` = maintains aspect ratio, fits within container (NOT width-fit).

---

## 5) Must-Answer Questions

### Q1: Is `frqSubmissionType` stored on the assignment?

**Answer: YES**

**Evidence:** [apTeacherService.js:240](src/apBoost/services/apTeacherService.js#L240)
```javascript
frqSubmissionType: assignmentData.frqSubmissionType || 'TYPED',
```

**Enum Values:** [apTypes.js:50-53](src/apBoost/utils/apTypes.js#L50-L53)
- `FRQ_SUBMISSION_TYPE.TYPED` = 'TYPED'
- `FRQ_SUBMISSION_TYPE.HANDWRITTEN` = 'HANDWRITTEN'

**Default:** 'TYPED'

---

### Q2: Is there ANY existing student-facing FRQ mode selection UI?

**Answer: YES - Selection UI exists but ignores assignment setting**

**Evidence:** APTestSession.jsx shows FRQ choice modal at lines 273-326 when `isFRQSection && frqSubmissionType === null`. This shows REGARDLESS of assignment.frqSubmissionType.

**Key Issue:** Assignment's `frqSubmissionType` is not consulted. The useTestSession hook does not appear to load assignment data into the component.

---

### Q3: Does InstructionScreen currently render any FRQ mode-specific instructions?

**Answer: NO**

**Evidence:** [InstructionScreen.jsx:1-93](src/apBoost/components/InstructionScreen.jsx#L1-L93) - Full file has NO reference to `frqSubmissionType`, `FRQ_SUBMISSION_TYPE`, or any FRQ-related instructions.

**Props needed:** Would need `frqSubmissionType` prop from parent. Currently only receives `test`, `assignment`, `existingSession`, `onBegin`, `onCancel`.

---

### Q4: Does generateAnswerSheetPdf.js currently truncate stimulus content?

**Answer: YES**

**Evidence:** [generateAnswerSheetPdf.js:172-173](src/apBoost/utils/generateAnswerSheetPdf.js#L172-L173)
```javascript
const stimulusText = question.stimulus.content.substring(0, 500) +
  (question.stimulus.content.length > 500 ? '...' : '')
```

**Truncation:** 500 characters with ellipsis.

---

### Q5: Does generateAnswerSheetPdf.js support stimulus images today?

**Answer: NO**

**Evidence:** [generateAnswerSheetPdf.js:159-182](src/apBoost/utils/generateAnswerSheetPdf.js#L159-L182)
```javascript
// Stimulus (if any)
if (question.stimulus?.content) {
  checkNewPage(40)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'italic')

  // Draw stimulus box
  doc.setFillColor(245, 245, 245)
  doc.rect(margin, yPos, contentWidth, 30, 'F')
  ...
  const stimulusText = question.stimulus.content.substring(0, 500) + ...
  yPos = addWrappedText(stimulusText, margin + 3, yPos, contentWidth - 6, 4)
```

**Observations:**
- Only checks `stimulus?.content` (text)
- No check for `stimulus.type === IMAGE/CHART`
- No `doc.addImage()` call
- No image loading logic

---

### Q6: Is there already an AP logo asset under public/apBoost/?

**Answer: YES - Multiple logo assets exist**

**Evidence:** Glob results show:
```
public/apBoost/ap_logo.png
public/apBoost/ap_logo_small.png
public/apBoost/ap_logo_white.png
public/apBoost/ap_logo_small_white.png
public/apBoost/ap_logo_vector.svg
public/apBoost/ap_logo_header_blue.svg
public/apBoost/ap_logo_header_orange.svg
public/apBoost/ap_logo_square_vector.svg
public/apBoost/ap_logo_square_vector_white.svg
```

**Referenced in code:** [APHeader.jsx:17](src/apBoost/components/APHeader.jsx#L17)
```javascript
src="/apBoost/ap_logo.png"
```

**NOT Referenced in generateAnswerSheetPdf.js** - No logo is added to the PDF.

---

### Q7: Is there ANY existing client-side image compression before upload?

**Answer: NO**

**Evidence:** Searched for `compressImage`, `toBlob`, `canvas` in src/apBoost. Results only appear in fix plan documents (proposed implementations), NOT actual code.

**FileUpload.jsx:** No compression logic. Directly passes files to onUpload callback.

**apStorageService.js:** Only validates file size, doesn't compress.

---

### Q8: Does FileUpload support local previews prior to upload?

**Answer: PARTIAL - Only for already-uploaded files**

**Evidence:** [FileUpload.jsx:191-196](src/apBoost/components/FileUpload.jsx#L191-L196)
```javascript
{isImage(file.type) && file.url ? (
  <img
    src={file.url}
    alt={file.name}
    className="w-12 h-12 object-cover rounded"
  />
)
```

**Key Finding:**
- Preview uses `file.url` which is the Firebase Storage URL (post-upload)
- No `URL.createObjectURL()` for pre-upload previews
- No `localPreviews` state management
- No `URL.revokeObjectURL()` cleanup in FileUpload.jsx

---

### Q9: What is the exact graded PDF storage path pattern?

**Answer: TIMESTAMPED**

**Evidence:** [apStorageService.js:156-158](src/apBoost/services/apStorageService.js#L156-L158)
```javascript
const timestamp = Date.now()
const storagePath = `ap_frq_graded/${resultId}/graded_${timestamp}.pdf`
```

**Pattern:** `ap_frq_graded/${resultId}/graded_${timestamp}.pdf`

---

### Q10: What field name is used for graded PDF URL?

**Answer: `annotatedPdfUrl` (NOT `frqGradedPdfUrl`)**

**Evidence - Write Path:**
[apGradingService.js:177-178](src/apBoost/services/apGradingService.js#L177-L178)
```javascript
if (annotatedPdfUrl) {
  updateData.annotatedPdfUrl = annotatedPdfUrl
}
```

**Evidence - Read Path (GradingPanel):**
[GradingPanel.jsx:267](src/apBoost/components/grading/GradingPanel.jsx#L267)
```javascript
setAnnotatedPdfUrl(data.annotatedPdfUrl || null)
```

**Evidence - Read Path (APReportCard):**
[APReportCard.jsx:355](src/apBoost/pages/APReportCard.jsx#L355)
```javascript
const annotatedPdfUrl = result?.annotatedPdfUrl
```

**Evidence - Schema initialization:**
[apScoringService.js:148](src/apBoost/services/apScoringService.js#L148)
```javascript
annotatedPdfUrl: null, // Teacher's annotated PDF
```

**Compatibility Fallback:** NONE - No fallback to `frqGradedPdfUrl`.

---

### Q11: What is the exact shape of uploaded FRQ files stored in results?

**Answer: Array of objects with `{name, originalName, url, size, type, path}`**

**Evidence - Write (apStorageService.js:116-123):**
```javascript
uploadedFiles.push({
  name: filename,
  originalName: file.name,
  url,
  size: file.size,
  type: file.type,
  path: storagePath,
})
```

**Evidence - Read (APReportCard.jsx:354):**
```javascript
const uploadedFiles = result?.frqUploadedFiles || []
```

**Evidence - Read (GradingPanel.jsx:345):**
```javascript
const uploadedFiles = result?.frqUploadedFiles || []
```

---

### Q12: Where is "handwritten viewer fit" behavior implemented?

**Answer:** GradingPanel.jsx lines 37-46

**Evidence:** [GradingPanel.jsx:37-44](src/apBoost/components/grading/GradingPanel.jsx#L37-L44)
```javascript
<img
  src={currentFile.url}
  alt={`Page ${currentIndex + 1}`}
  className="max-w-full max-h-full object-contain transition-transform"
  style={{
    transform: `scale(${zoom}) rotate(${rotation}deg)`,
  }}
/>
```

**CSS Classes:** `max-w-full max-h-full object-contain`

**Behavior:** Image maintains aspect ratio (`object-contain`) and fits within container bounds (`max-w-full max-h-full`). This is NOT width-fit (which would be `w-full object-contain`).

**Container:** Line 30 shows `className="relative h-96 bg-black/10 flex items-center justify-center overflow-hidden"` - Fixed height of 96 (24rem).

---

## Summary of Key Gaps Found

| Issue | Status | Evidence |
|-------|--------|----------|
| `allowStudentChoice` field | NOT FOUND | Not in assignment schema |
| InstructionScreen FRQ instructions | NOT IMPLEMENTED | No frqSubmissionType handling |
| Student mode respects assignment | NOT IMPLEMENTED | Always shows choice UI |
| PDF logo inclusion | NOT IMPLEMENTED | No logo loading in generateAnswerSheetPdf.js |
| PDF stimulus truncation | CONFIRMED BUG | substring(0,500) with ellipsis |
| PDF stimulus images | NOT IMPLEMENTED | No addImage() for IMAGE/CHART types |
| Client-side image compression | NOT IMPLEMENTED | No compression before upload |
| Pre-upload local previews | NOT IMPLEMENTED | Only shows post-upload URLs |
| Object URL cleanup | PARTIAL | Only in generateAnswerSheetPdf.js |
| Field name `annotatedPdfUrl` | CONFIRMED | Code uses this, not `frqGradedPdfUrl` |
| Field name `frqUploadedFiles` | CONFIRMED | Code uses array, not `frqUploadUrl` string |
| Viewer fit behavior | WIDTH-CONTAIN | `max-h-full object-contain` (not width-fit) |
