# Phase 6: FRQ Handwritten Mode

> **Goal:** Support handwritten FRQ submission (PDF download, scan upload)

## Prerequisites
- Phase 1-5 complete and verified
- Read `ap_boost_spec_plan.md` sections: 3.4.2-3.4.5 (Answer Sheet PDF, Upload, Grading)
- Firebase Storage configured

---

## Step 6.1: generateAnswerSheetPdf Utility

**File:** `utils/generateAnswerSheetPdf.js`

**Generate printable PDF answer sheet:**

```javascript
/**
 * Generate answer sheet PDF for handwritten FRQ
 * @param {Test} test - Test with FRQ section
 * @param {User} student - Student info for header
 * @returns {Blob} PDF blob for download
 */
export async function generateAnswerSheetPdf(test, student);
```

**PDF Structure:**
```
┌─────────────────────────────────────────────────────────┐
│  [AP Logo]    ANSWER SHEET                              │
│  Test: AP US History Practice Exam #3                   │
│  Student: _________________________  Date: ___________  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  SECTION 2: Free Response Questions                     │
│                                                         │
│  ═══════════════════════════════════════════════════    │
│  QUESTION 1 (9 points)                                  │
│  ───────────────────────────────────────────────────    │
│  [Stimulus text/image reprinted here]                   │
│                                                         │
│  Using the excerpt above, answer parts a, b, and c.     │
│                                                         │
│  (a) Identify ONE historical development... (3 pts)     │
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  │  [Lined writing space - ~20 lines]              │    │
│  │                                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  (b) Explain how... (3 pts)                             │
│  ┌─────────────────────────────────────────────────┐    │
│  │  [Lined writing space]                          │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Libraries:** Use `jspdf` or `pdf-lib`

**Features:**
- Header with test info, student name field, date
- Each FRQ question with stimulus
- Sub-questions with point values
- Lined writing areas
- Page breaks between questions

**Verification:**
- [ ] PDF generates correctly
- [ ] All questions included
- [ ] Writing areas properly sized
- [ ] Stimulus reprinted

---

## Step 6.2: Handwritten Mode UI

**File:** `components/FRQHandwrittenMode.jsx`

**When `frqSubmissionType === 'HANDWRITTEN'`:**

**Before test (instruction screen):**
```
Note: This test requires handwritten FRQ responses.
You will download an answer sheet, write your answers by hand,
and upload a scan or photo of your work.
```

**During FRQ section:**
```
┌─────────────────────────────────────────────────────────────────┐
│  SECTION 2: Free Response (Handwritten)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⏱ Time Remaining: 55:00                                       │
│                                                                 │
│  Step 1: Download your answer sheet                             │
│  [📥 Download Answer Sheet PDF]                                 │
│                                                                 │
│  Step 2: Write your answers by hand                             │
│  Print the PDF and write your responses in the provided spaces. │
│                                                                 │
│  Step 3: Scan or photograph your work                           │
│  Use a scanner or phone camera to capture your answers.         │
│                                                                 │
│  Step 4: Upload your completed answer sheet                     │
│  [📤 Upload Answer Sheet]                                       │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Uploaded Files: (none yet)                                     │
│                                                                 │
│  [Submit Test]  (disabled until upload)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**After upload:**
```
│  Uploaded Files:                                                │
│  ✓ answer_sheet_page1.jpg  (2.3 MB)  [Preview] [Remove]        │
│  ✓ answer_sheet_page2.jpg  (2.1 MB)  [Preview] [Remove]        │
│                                                                 │
│  [+ Add More Files]                                             │
│                                                                 │
│  [Submit Test]  (enabled)                                       │
```

**Verification:**
- [ ] Download button works
- [ ] Upload interface shows
- [ ] Preview uploaded files
- [ ] Submit only enabled after upload

---

## Step 6.3: apStorageService

**File:** `services/apStorageService.js`

**Firebase Storage operations:**

```javascript
/**
 * Upload FRQ answer sheet(s)
 * @param {string} userId
 * @param {string} resultId
 * @param {File[]} files
 * @returns {Promise<string[]>} Array of download URLs
 */
export async function uploadFRQAnswerSheet(userId, resultId, files);

/**
 * Upload graded PDF with annotations
 * @param {string} resultId
 * @param {File} file
 * @returns {Promise<string>} Download URL
 */
export async function uploadGradedPdf(resultId, file);

/**
 * Get download URL for uploaded file
 * @param {string} path
 * @returns {Promise<string>}
 */
export async function getDownloadUrl(path);

/**
 * Delete uploaded file
 * @param {string} path
 */
export async function deleteUpload(path);
```

**Storage Paths:**
```
ap_frq_uploads/{userId}/{resultId}/
├── page1.jpg
├── page2.jpg
└── ...

ap_frq_graded/{resultId}/
└── graded.pdf
```

**File validation:**
- Supported formats: PDF, JPG, PNG, HEIC, WebP
- Max size: 10MB per file, 50MB total
- Compress images if needed

**Verification:**
- [ ] Upload succeeds
- [ ] Download URL works
- [ ] Delete works
- [ ] Size limits enforced

---

## Step 6.4: Update Grading Panel for Handwritten

**File:** `components/grading/GradingPanel.jsx`

**Add PDF viewer for handwritten submissions:**

```
┌─────────────────────────────────────────────────────────────────┐
│  GRADING: John Smith - AP US History #1            [X Close]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Student's Submission:                                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  [PDF/Image Viewer]                                       │  │
│  │                                                           │  │
│  │  Page 1 of 3   [< Prev] [Next >]   [🔍+] [🔍-] [↻]       │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [📥 Download Original]                                         │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Grading:                                                       │
│  [Same grading inputs as before]                                │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Teacher Annotations:                                           │
│  [📤 Upload Annotated PDF]  (optional)                          │
│                                                                 │
│  [Save Draft]  [Mark Complete]                                  │
└─────────────────────────────────────────────────────────────────┘
```

**PDF Viewer Features:**
- Page navigation
- Zoom in/out
- Rotate
- Download original

**Teacher Annotations:**
- Optional: Upload PDF with handwritten feedback
- Stored in `frqGradedPdfUrl`
- Visible to student on Report Card

**Verification:**
- [ ] Viewer displays uploaded images/PDF
- [ ] Navigation works
- [ ] Zoom/rotate work
- [ ] Download original works
- [ ] Upload annotated PDF works

---

## Step 6.5: Update Report Card for Handwritten

**File:** `pages/APReportCard.jsx`

**Show teacher's annotated feedback:**

```
│  SECTION 2: Free Response (Handwritten)                        │
│                                                                 │
│  ✓ Your submission received                                    │
│  [📥 Download Your Answer Sheet]                                │
│                                                                 │
│  Teacher Feedback:                                              │
│  [📥 Download Graded Paper (PDF)]  ← Teacher's annotations     │
│                                                                 │
│  Q1: 6/9 pts                                                   │
│  Comment: "Good analysis of economic factors..."                │
│                                                                 │
│  Q2: 5/7 pts                                                   │
│  Comment: "Missing contextualization..."                        │
```

**Verification:**
- [ ] Student can download their submission
- [ ] Teacher annotations available when graded
- [ ] Shows scores and comments

---

## File Upload Component

**File:** `components/FileUpload.jsx`

**Reusable file upload with preview:**

```typescript
interface FileUploadProps {
  accept: string;              // "image/*,application/pdf"
  multiple: boolean;
  maxSize: number;             // bytes
  maxFiles: number;
  onUpload: (files: File[]) => void;
  onRemove: (index: number) => void;
  files: UploadedFile[];
  isUploading: boolean;
}

interface UploadedFile {
  name: string;
  size: number;
  url: string;
  type: string;
}
```

**Features:**
- Drag and drop zone
- File picker button
- Preview thumbnails
- Size display
- Remove button
- Upload progress

**Verification:**
- [ ] Drag and drop works
- [ ] File picker works
- [ ] Preview shows
- [ ] Remove works
- [ ] Progress indicator

---

## Final Verification Checklist

- [ ] Teacher assigns test with HANDWRITTEN mode
- [ ] Student sees handwritten instructions
- [ ] Download PDF button generates answer sheet
- [ ] Answer sheet has all questions and writing areas
- [ ] Upload accepts images and PDFs
- [ ] Multiple files supported
- [ ] Preview before submit
- [ ] Submit stores files in Firebase Storage
- [ ] `frqUploadUrl` stored in result
- [ ] Teacher can view uploaded files in grading panel
- [ ] Teacher can download original
- [ ] Teacher can upload annotated PDF
- [ ] Student sees annotated PDF after grading
