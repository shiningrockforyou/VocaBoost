# Fix Plan: Sections 8.1 to 8.6

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_8.1_to_8.6_criteria_audit.md

## Executive Summary
- Total Issues: 10
- ⚠️ Partial Implementations: 7
- ❌ Missing Features: 3
- ❓ Needs Investigation: 0
- Estimated Complexity: Medium

---

## Issue 1: Student Choice for FRQ Mode (DESIGN DECISION)

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Student chooses mode per test (all-or-nothing)
- **Current State:** Mode is set by teacher when assigning test via AssignTestModal.jsx

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/teacher/AssignTestModal.jsx` (lines 49, 229-243) - Teacher selects frqSubmissionType
  - `src/apBoost/services/apTeacherService.js` - createAssignment stores frqSubmissionType
- **Current Implementation:** Teacher sets FRQ mode (TYPED or HANDWRITTEN) during test assignment
- **Gap:** Spec says student should choose, but teacher control may be intentional for classroom management
- **Dependencies:** InstructionScreen, APTestSession, APStudentDashboard

### Recommendation: DOCUMENT AS DESIGN DECISION

This is likely an intentional design choice. In a classroom setting, teachers often need to control submission mode to:
1. Ensure consistency across all students
2. Manage grading workflow (handwritten requires more teacher time)
3. Handle technical constraints (not all students may have scanning capability)

**If student choice is truly required:**

#### Step 1: Add mode selection to InstructionScreen
**File:** `src/apBoost/components/InstructionScreen.jsx`
**Action:** Modify
**Details:**
- Add state for selectedMode
- Show radio buttons for TYPED vs HANDWRITTEN (only if test hasFRQ)
- Pass selected mode to onBegin callback
- Only show if assignment.allowStudentChoice === true (new field)

#### Step 2: Update APTestSession to accept mode from InstructionScreen
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Modify
**Details:**
- Receive frqSubmissionType from onBegin callback
- Store in session state

#### Step 3: Add allowStudentChoice flag to assignments
**File:** `src/apBoost/components/teacher/AssignTestModal.jsx`
**Action:** Modify
**Details:**
- Add checkbox "Allow students to choose FRQ mode"
- When checked, set allowStudentChoice: true in assignment
- When unchecked, teacher selects the mode

### Verification Steps
1. Teacher can still set mode when assigning
2. If allowStudentChoice enabled, student sees mode selection on InstructionScreen
3. Selected mode flows through to test session

### Potential Risks
- **Risk:** Existing assignments don't have allowStudentChoice field
- **Mitigation:** Default to false (teacher-controlled) for backward compatibility

---

## Issue 2: InstructionScreen Missing FRQ Mode-Specific Instructions

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** InstructionScreen shows mode-specific instructions
- **Current State:** InstructionScreen only shows section breakdown and general warnings, no reference to frqSubmissionType

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/InstructionScreen.jsx` (lines 1-93) - Current implementation
- **Current Implementation:** Shows test title, section breakdown (questions, time), and warnings about timer/sections
- **Gap:** No mention of FRQ submission mode (typed vs handwritten)
- **Dependencies:** Assignment data must include frqSubmissionType

### Fix Plan

#### Step 1: Accept frqSubmissionType prop
**File:** `src/apBoost/components/InstructionScreen.jsx`
**Action:** Modify
**Details:**
- Add `frqSubmissionType` to destructured props (line 14)
- Import `FRQ_SUBMISSION_TYPE` from `../utils/apTypes`

#### Step 2: Add mode-specific instructions section
**File:** `src/apBoost/components/InstructionScreen.jsx`
**Action:** Add after section breakdown (line 55)
**Details:**
```jsx
{/* FRQ Mode Instructions */}
{frqSubmissionType && (
  <div className="bg-info rounded-[--radius-alert] p-4 mb-6">
    <h3 className="text-info-text-strong font-medium mb-2">
      Free Response Section
    </h3>
    {frqSubmissionType === FRQ_SUBMISSION_TYPE.TYPED ? (
      <div className="text-info-text text-sm space-y-1">
        <p>You will type your responses directly in the browser.</p>
        <p>Make sure to save your work frequently.</p>
      </div>
    ) : (
      <div className="text-info-text text-sm space-y-1">
        <p>You will complete your responses on paper.</p>
        <p>During the FRQ section, you will:</p>
        <ol className="list-decimal ml-4 mt-1">
          <li>Download an answer sheet PDF</li>
          <li>Print and write your responses by hand</li>
          <li>Scan or photograph your completed work</li>
          <li>Upload your files before submitting</li>
        </ol>
        <p className="mt-2 font-medium">Tip: Have a scanner or phone camera ready.</p>
      </div>
    )}
  </div>
)}
```

#### Step 3: Update APTestSession to pass frqSubmissionType to InstructionScreen
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Modify
**Details:**
- Ensure frqSubmissionType from assignment is passed to InstructionScreen component
- Pattern: `<InstructionScreen ... frqSubmissionType={assignment?.frqSubmissionType} />`

### Verification Steps
1. Load a test with FRQ section and TYPED mode - see typed instructions
2. Load a test with FRQ section and HANDWRITTEN mode - see handwritten instructions
3. Load a test without FRQ - no FRQ instructions shown
4. Instructions clearly explain what student will do

### Potential Risks
- **Risk:** assignment.frqSubmissionType might not be loaded
- **Mitigation:** Add null check, only show if frqSubmissionType is defined

---

## Issue 3: Answer Sheet PDF Missing AP Logo

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** PDF includes AP Logo and "ANSWER SHEET" header
- **Current State:** "ANSWER SHEET" header present (line 67), but AP Logo is NOT included

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/generateAnswerSheetPdf.js` (lines 62-68) - Header section
  - `public/apBoost/` - Asset directory for AP-related images
- **Current Implementation:** Uses jsPDF, text-only header with "ANSWER SHEET"
- **Gap:** No AP Logo image
- **Dependencies:** Need to add logo image to public assets

### Fix Plan

#### Step 1: Add AP logo image to public assets
**File:** `public/apBoost/ap-logo.png`
**Action:** Create
**Details:**
- Add a high-quality AP logo PNG (approximately 100x40 pixels recommended for PDF)
- Or use SVG converted to base64 for embedding

#### Step 2: Modify PDF generation to include logo
**File:** `src/apBoost/utils/generateAnswerSheetPdf.js`
**Action:** Modify
**Details:**
- Add async image loading at the start of generateAnswerSheetPdf function
- Insert logo before or alongside "ANSWER SHEET" header

```javascript
// After line 22 (yPos declaration), add:
// Load and add AP logo
try {
  const logoImg = new Image()
  logoImg.src = '/apBoost/ap-logo.png'
  await new Promise((resolve) => {
    logoImg.onload = resolve
    logoImg.onerror = resolve // Continue even if logo fails
  })
  if (logoImg.complete && logoImg.naturalWidth > 0) {
    // Add logo centered at top
    const logoWidth = 25 // mm
    const logoHeight = 10 // mm (adjust based on aspect ratio)
    doc.addImage(logoImg, 'PNG', (pageWidth - logoWidth) / 2, yPos, logoWidth, logoHeight)
    yPos += logoHeight + 3
  }
} catch (e) {
  // Continue without logo if error
  console.warn('Failed to load AP logo for PDF', e)
}
```

#### Step 3: Alternative - Embed base64 logo
**File:** `src/apBoost/utils/generateAnswerSheetPdf.js`
**Action:** Add constant
**Details:**
- If external loading is problematic, embed logo as base64 string
- Add `const AP_LOGO_BASE64 = 'data:image/png;base64,...'`
- Use `doc.addImage(AP_LOGO_BASE64, 'PNG', x, y, width, height)`

### Verification Steps
1. Generate answer sheet PDF
2. Verify AP logo appears at top of first page
3. Verify logo doesn't break layout
4. Test with missing logo file (should degrade gracefully)

### Potential Risks
- **Risk:** Logo loading fails in browser context
- **Mitigation:** Use base64 embedded image or catch errors gracefully
- **Risk:** Logo aspect ratio distorts
- **Mitigation:** Calculate height from width using actual image dimensions

---

## Issue 4: Answer Sheet PDF Stimulus Truncation and Missing Images

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** For each FRQ section: Stimulus text/image reprinted
- **Current State:** Stimulus text truncated to 500 characters (line 172-173), images NOT rendered

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/utils/generateAnswerSheetPdf.js` (lines 159-182) - Stimulus rendering
- **Current Implementation:**
  - Line 172-173: `question.stimulus.content.substring(0, 500)` with ellipsis
  - Only handles text content, no image handling
- **Gap:** Long stimuli are cut off, images are completely ignored
- **Dependencies:** Stimulus data structure { type, content, imageUrl, source }

### Fix Plan

#### Step 1: Remove arbitrary truncation, add proper pagination
**File:** `src/apBoost/utils/generateAnswerSheetPdf.js`
**Action:** Modify lines 159-182
**Details:**
- Remove 500 character limit
- Let jsPDF's splitTextToSize handle wrapping
- Add page breaks if stimulus is very long

```javascript
// Replace lines 172-174 with:
const stimulusText = question.stimulus.content || ''
// Calculate box height dynamically based on text length
const textLines = doc.splitTextToSize(stimulusText, contentWidth - 6)
const textHeight = textLines.length * 4 + 10 // 4mm per line + padding
const boxHeight = Math.max(30, Math.min(textHeight, pageHeight - yPos - margin - 50))

// Check if we need a new page for long stimulus
if (yPos + boxHeight > pageHeight - margin - 20) {
  doc.addPage()
  yPos = margin
}

doc.setFillColor(245, 245, 245)
doc.rect(margin, yPos, contentWidth, boxHeight, 'F')
// ... rest of drawing code
```

#### Step 2: Add image support for stimuli
**File:** `src/apBoost/utils/generateAnswerSheetPdf.js`
**Action:** Add after text stimulus handling
**Details:**
```javascript
// After text stimulus, handle images
if (question.stimulus?.imageUrl) {
  checkNewPage(60) // Reserve space for image
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = question.stimulus.imageUrl
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      setTimeout(reject, 5000) // 5s timeout
    })

    // Calculate dimensions to fit width
    const maxImgWidth = contentWidth - 10
    const maxImgHeight = 80
    const aspectRatio = img.naturalWidth / img.naturalHeight
    let imgWidth = maxImgWidth
    let imgHeight = imgWidth / aspectRatio
    if (imgHeight > maxImgHeight) {
      imgHeight = maxImgHeight
      imgWidth = imgHeight * aspectRatio
    }

    doc.addImage(img, 'JPEG', margin + 5, yPos, imgWidth, imgHeight)
    yPos += imgHeight + 5
  } catch (e) {
    // Show placeholder if image fails
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.text('[Image not available - see online version]', margin, yPos)
    yPos += 10
  }
}
```

#### Step 3: Handle very long stimuli with continuation pages
**File:** `src/apBoost/utils/generateAnswerSheetPdf.js`
**Action:** Add helper function
**Details:**
- Create `addLongText(doc, text, x, startY, maxWidth, maxY)` helper
- Returns final y position after text
- Automatically adds pages as needed

### Verification Steps
1. Generate PDF with short stimulus - renders completely
2. Generate PDF with long stimulus (>1000 chars) - wraps properly, may span pages
3. Generate PDF with image stimulus - image appears in PDF
4. Generate PDF with image + text stimulus - both render
5. Test with very large image - scales to fit
6. Test with failing image URL - graceful fallback

### Potential Risks
- **Risk:** Very long stimuli make PDF unwieldy
- **Mitigation:** Add max height per stimulus, continue on next page with "[continued]" note
- **Risk:** Image loading fails or times out
- **Mitigation:** Add timeout, show placeholder text
- **Risk:** Cross-origin image restrictions
- **Mitigation:** Use crossOrigin attribute, handle CORS errors

---

## Issue 5: Image Compression Before Upload

### Audit Finding
- **Status:** ❌ Missing
- **Criterion:** Compress images if needed before upload
- **Current State:** Files are uploaded as-is without any compression

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/services/apStorageService.js` (lines 81-136) - uploadFRQAnswerSheet function
  - `src/apBoost/components/FRQHandwrittenMode.jsx` (lines 55-86) - handleUpload function
- **Current Implementation:** Files pass through validation then directly to Firebase Storage
- **Gap:** No image compression, large images uploaded at full size
- **Dependencies:** None (browser canvas API is sufficient)

### Fix Plan

#### Step 1: Create image compression utility
**File:** `src/apBoost/utils/imageCompression.js`
**Action:** Create
**Details:**
```javascript
/**
 * Compress an image file using canvas
 * @param {File} file - Image file to compress
 * @param {Object} options - { maxWidth: 2000, maxHeight: 2000, quality: 0.8 }
 * @returns {Promise<Blob>} Compressed image blob
 */
export async function compressImage(file, options = {}) {
  const { maxWidth = 2000, maxHeight = 2000, quality = 0.8 } = options

  // Only compress images, not PDFs
  if (!file.type.startsWith('image/')) {
    return file
  }

  // Skip if already small
  if (file.size < 500 * 1024) { // < 500KB
    return file
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    img.onload = () => {
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

      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            // Preserve original name
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })
            resolve(compressedFile)
          } else {
            resolve(file) // Fallback to original
          }
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => resolve(file) // Fallback to original on error
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Compress multiple files
 * @param {File[]} files - Array of files
 * @param {Object} options - Compression options
 * @returns {Promise<File[]>} Compressed files
 */
export async function compressImages(files, options = {}) {
  return Promise.all(files.map(file => compressImage(file, options)))
}
```

#### Step 2: Integrate compression into upload flow
**File:** `src/apBoost/services/apStorageService.js`
**Action:** Modify uploadFRQAnswerSheet function
**Details:**
- Import compressImages utility
- Call compression before upload loop

```javascript
import { compressImages } from '../utils/imageCompression'

// Add after validation (line 87), before upload loop:
// Compress images (PDFs pass through unchanged)
const processedFiles = await compressImages(files, {
  maxWidth: 2000,
  maxHeight: 2000,
  quality: 0.85
})
```

#### Step 3: Show compression status in UI (optional enhancement)
**File:** `src/apBoost/components/FRQHandwrittenMode.jsx`
**Action:** Modify (optional)
**Details:**
- Add "Optimizing images..." state before "Uploading..."
- Or simply include in upload progress

### Verification Steps
1. Upload large image (5MB+) - should compress to <1MB
2. Upload small image (<500KB) - should pass through unchanged
3. Upload PDF - should not be modified
4. Verify compressed images are still legible
5. Check that file size validation still works post-compression

### Potential Risks
- **Risk:** Compression too aggressive, text illegible
- **Mitigation:** Use quality: 0.85, maxWidth: 2000 for good balance
- **Risk:** HEIC format not supported by canvas
- **Mitigation:** Let HEIC files pass through to Firebase (still valid)
- **Risk:** Memory issues with very large images
- **Mitigation:** Add try/catch, fallback to original if compression fails

---

## Issue 6: Client-Side Preview Before Upload

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Preview thumbnails for images
- **Current State:** Shows image preview only AFTER upload (file.url), not before upload

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/FileUpload.jsx` (lines 191-201) - Preview display logic
- **Current Implementation:** `{isImage(file.type) && file.url ? (` - requires file.url which only exists after upload
- **Gap:** No preview during file selection/upload process
- **Dependencies:** FileReader API for local file reading

### Fix Plan

#### Step 1: Add local preview generation for pending files
**File:** `src/apBoost/components/FileUpload.jsx`
**Action:** Modify
**Details:**
- Track pending files with local URLs separately from uploaded files
- Generate preview URLs using URL.createObjectURL when files are selected
- Clean up URLs when files are removed

```javascript
// Add state after line 32:
const [localPreviews, setLocalPreviews] = useState({}) // { filename: localUrl }

// In processFiles function, after validation (after line 94):
// Generate local previews for images
const newPreviews = { ...localPreviews }
for (const file of validFiles) {
  if (file.type.startsWith('image/')) {
    newPreviews[file.name] = URL.createObjectURL(file)
  }
}
setLocalPreviews(newPreviews)

// Add cleanup effect:
useEffect(() => {
  return () => {
    // Cleanup local preview URLs on unmount
    Object.values(localPreviews).forEach(url => URL.revokeObjectURL(url))
  }
}, []) // Only on unmount
```

#### Step 2: Update preview rendering to use local previews
**File:** `src/apBoost/components/FileUpload.jsx`
**Action:** Modify lines 191-201
**Details:**
```jsx
{/* Preview or icon */}
{isImage(file.type) && (file.url || localPreviews[file.name]) ? (
  <img
    src={file.url || localPreviews[file.name]}
    alt={file.name}
    className="w-12 h-12 object-cover rounded"
  />
) : (
  <div className="w-12 h-12 flex items-center justify-center bg-muted rounded text-text-secondary text-xs font-medium">
    {getFileIcon(file.type)}
  </div>
)}
```

#### Step 3: Cleanup previews when file is removed
**File:** `src/apBoost/components/FileUpload.jsx`
**Action:** Add to remove handler or parent component
**Details:**
- When onRemove is called, also revoke the local preview URL
- Pass through a cleanup callback or handle in parent

### Verification Steps
1. Select image file - thumbnail appears immediately before upload
2. Select PDF file - shows PDF icon (no thumbnail)
3. Remove pending file - no memory leak from unreleased URLs
4. Upload completes - switches to uploaded URL seamlessly
5. Select multiple images - all show previews

### Potential Risks
- **Risk:** Memory leak from unreleased object URLs
- **Mitigation:** Cleanup on unmount and file removal
- **Risk:** Large images slow to generate preview
- **Mitigation:** Use small thumbnail size, loading indicator

---

## Issue 7: PDF Viewer Container Fit

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Fits to container width by default
- **Current State:** Uses max-w-full max-h-full object-contain, iframe is w-full h-full

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/grading/GradingPanel.jsx` (lines 37-45) - HandwrittenViewer
- **Current Implementation:** `max-w-full max-h-full object-contain` for images
- **Gap:** "Fits to container width" vs "fits within container" semantic difference
- **Dependencies:** None

### Fix Plan

#### Step 1: Adjust image styling for width-fit
**File:** `src/apBoost/components/grading/GradingPanel.jsx`
**Action:** Modify HandwrittenViewer (lines 37-45)
**Details:**
```jsx
// Current:
className="max-w-full max-h-full object-contain transition-transform"

// Change to:
className="w-full h-auto object-contain transition-transform"
// Or keep current if "fit within" behavior is preferred
```

**Note:** Current behavior is reasonable - "object-contain" ensures image fits without cropping. The "fits to container width" may mean width-priority scaling. Consider this a **LOW PRIORITY** cosmetic issue.

### Verification Steps
1. View wide image - should fill width
2. View tall image - should scale appropriately
3. Zoom controls still work
4. Rotation still works

### Potential Risks
- **Risk:** Tall images may extend beyond viewport
- **Mitigation:** Keep max-h-full or add scrolling

---

## Issue 8: Graded PDF Storage Path Timestamp

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Stored at: ap_frq_graded/{resultId}/graded.pdf
- **Current State:** Path is `ap_frq_graded/${resultId}/graded_${timestamp}.pdf`

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/services/apStorageService.js` (lines 157-158) - uploadGradedPdf function
- **Current Implementation:** Includes timestamp in filename for uniqueness
- **Gap:** Spec says "graded.pdf", implementation uses "graded_{timestamp}.pdf"
- **Dependencies:** GradingPanel, APReportCard

### Fix Plan

#### Option A: Remove timestamp (simple match to spec)
**File:** `src/apBoost/services/apStorageService.js`
**Action:** Modify line 158
**Details:**
```javascript
// Current:
const storagePath = `ap_frq_graded/${resultId}/graded_${timestamp}.pdf`

// Change to:
const storagePath = `ap_frq_graded/${resultId}/graded.pdf`
```

#### Option B: Keep timestamp (recommended for versioning)
The timestamp allows teachers to upload multiple versions of annotated feedback. This is actually a **feature enhancement** over the spec.

**Recommendation:** Document as intentional deviation, OR add a "replace previous" option that deletes old file first.

### Verification Steps
1. Upload graded PDF
2. Verify storage path matches expected pattern
3. Verify download URL works
4. If keeping timestamp, verify multiple uploads don't conflict

### Potential Risks
- **Risk:** Without timestamp, re-upload overwrites without warning
- **Mitigation:** Keep timestamp OR add confirmation dialog
- **Risk:** With timestamp, old files accumulate
- **Mitigation:** Delete previous graded PDF before uploading new one

---

## Issue 9: Graded PDF URL Field Name

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** URL saved to frqGradedPdfUrl
- **Current State:** Field is named `annotatedPdfUrl` not `frqGradedPdfUrl`

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/services/apGradingService.js` (lines 176-179) - saveGrade function
  - `src/apBoost/components/grading/GradingPanel.jsx` (lines 250, 267, 305, 329) - uses annotatedPdfUrl
  - `src/apBoost/pages/APReportCard.jsx` (line 355) - reads annotatedPdfUrl
  - `src/apBoost/services/apScoringService.js` (line 148) - initializes annotatedPdfUrl
- **Current Implementation:** Uses `annotatedPdfUrl` consistently throughout codebase
- **Gap:** Field name differs from specification
- **Dependencies:** Database documents, all components reading this field

### Fix Plan

**IMPORTANT:** This is a **breaking change** if any data exists with the current field name.

#### Step 1: Check if migration is needed
**Action:** Manual check
**Details:**
- Query Firestore for documents with `annotatedPdfUrl` field
- If data exists, migration required
- If no data (new system), can rename directly

#### Step 2a: If no data exists - Direct rename
**Files to modify:**
1. `src/apBoost/services/apGradingService.js` - line 178
2. `src/apBoost/components/grading/GradingPanel.jsx` - lines 250, 267, 305, 329
3. `src/apBoost/pages/APReportCard.jsx` - line 355
4. `src/apBoost/services/apScoringService.js` - line 148

**Details:**
Replace all occurrences of `annotatedPdfUrl` with `frqGradedPdfUrl`

#### Step 2b: If data exists - Support both names (migration path)
**File:** `src/apBoost/pages/APReportCard.jsx`
**Action:** Modify line 355
**Details:**
```javascript
// Support both old and new field names
const annotatedPdfUrl = result?.frqGradedPdfUrl || result?.annotatedPdfUrl
```

Then update write locations to use new name, and eventually migrate old data.

**Recommendation:** Keep `annotatedPdfUrl` as it's more descriptive ("annotated" clarifies this is teacher-marked PDF). Document as intentional naming choice.

### Verification Steps
1. Upload graded PDF via GradingPanel
2. Verify field name in Firestore document
3. Verify APReportCard displays download link
4. If migrating, verify old data still works

### Potential Risks
- **Risk:** Breaking existing data if renamed without migration
- **Mitigation:** Check for existing data first, support both names during transition
- **Risk:** Code search misses some occurrences
- **Mitigation:** Use IDE search for all references

---

## Issue 10: frqUploadUrl vs frqUploadedFiles

### Audit Finding
- **Status:** ⚠️ Partial (from Section 8.3)
- **Criterion:** frqUploadUrl stored in ap_test_results
- **Current State:** Uses `frqUploadedFiles` (array of objects) instead of `frqUploadUrl` (single string)

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/services/apScoringService.js` (line 144) - stores frqUploadedFiles
  - `src/apBoost/pages/APTestSession.jsx` (line 185) - passes frqUploadedFiles
  - `src/apBoost/pages/APReportCard.jsx` (line 354) - reads frqUploadedFiles
  - `src/apBoost/components/grading/GradingPanel.jsx` (line 345) - reads frqUploadedFiles
- **Current Implementation:** Stores array of file objects `[{ name, url, size, type, path }, ...]`
- **Gap:** Spec says single `frqUploadUrl` string, implementation allows multiple files
- **Dependencies:** All components reading/displaying uploaded files

### Recommendation: DOCUMENT AS ENHANCEMENT

The current implementation is **better than spec**:
1. Supports multiple files (spec would require combining into single PDF)
2. Preserves metadata (size, type, original name)
3. Allows individual file management (view, download, delete)

**No code change needed.** Update documentation to reflect the enhanced data structure.

### If Single URL Required (not recommended):

#### Step 1: Create PDF combiner utility
**File:** `src/apBoost/utils/pdfCombiner.js`
**Action:** Create (would need pdf-lib or similar)
**Details:**
- Combine multiple images/PDFs into single PDF
- Store combined PDF, return single URL

#### Step 2: Update upload flow
**File:** `src/apBoost/services/apStorageService.js`
**Action:** Modify uploadFRQAnswerSheet
**Details:**
- After uploading all files, combine into single PDF
- Return single URL string

**This adds significant complexity for no clear benefit.**

### Verification Steps
1. Upload multiple files - all stored correctly
2. View in GradingPanel - all files visible
3. View in APReportCard - all files downloadable

### Potential Risks
- None if kept as-is (current implementation works)

---

## Implementation Order

Recommended order to implement fixes (considering dependencies):

1. **Issue 5: Image Compression** - Standalone utility, no dependencies
2. **Issue 2: InstructionScreen FRQ Instructions** - User-facing improvement, straightforward
3. **Issue 6: Client-Side Preview** - Enhances UX, contained to FileUpload
4. **Issue 3: AP Logo in PDF** - Visual enhancement, contained
5. **Issue 4: PDF Stimulus Full Text/Images** - More complex, requires testing
6. **Issue 7: PDF Viewer Fit** - Minor CSS adjustment (low priority)
7. **Issue 8: Graded PDF Path** - Consider keeping timestamp (document decision)
8. **Issue 9: Field Name** - Consider keeping annotatedPdfUrl (document decision)
9. **Issue 10: frqUploadedFiles** - Keep as enhancement (document decision)
10. **Issue 1: Student Choice** - Largest change, may not be needed (verify requirement)

## Cross-Cutting Concerns

### Image Handling Utility
Several issues involve image handling:
- Issue 3: Loading images for PDF
- Issue 4: Loading stimulus images for PDF
- Issue 5: Compressing images before upload
- Issue 6: Creating local previews

Consider creating a shared `src/apBoost/utils/imageUtils.js` with:
- `loadImage(url)` - Promise-based image loading with timeout
- `compressImage(file, options)` - Canvas-based compression
- `createLocalPreview(file)` - Object URL creation with cleanup helper

### Documentation Updates
Several issues should be documented as intentional design decisions:
- frqUploadedFiles vs frqUploadUrl - Enhanced multi-file support
- annotatedPdfUrl vs frqGradedPdfUrl - Clearer naming
- graded_{timestamp}.pdf - Version history support
- Teacher-controlled FRQ mode - Classroom management requirement

## Notes for Implementer

1. **Test with real AP-style content** - Long passages, document images, charts
2. **Consider PDF generation performance** - Loading external images adds latency
3. **Handle offline scenarios** - What if image URLs are unreachable?
4. **Verify mobile upload flow** - Compression is especially important for phone photos
5. **Cross-browser testing** - Canvas operations may vary
6. **Memory management** - Object URLs must be revoked to prevent leaks

## Files Changed Summary

| File | Changes |
|------|---------|
| `src/apBoost/components/InstructionScreen.jsx` | Add FRQ mode instructions |
| `src/apBoost/utils/generateAnswerSheetPdf.js` | Add logo, fix stimulus rendering |
| `src/apBoost/utils/imageCompression.js` | NEW - compression utility |
| `src/apBoost/services/apStorageService.js` | Integrate compression |
| `src/apBoost/components/FileUpload.jsx` | Add local previews |
| `src/apBoost/components/grading/GradingPanel.jsx` | Minor fit adjustment (optional) |
| `public/apBoost/ap-logo.png` | NEW - AP logo image |
