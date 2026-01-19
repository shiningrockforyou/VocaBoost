# Fix Plan: Sections 20.4 to 20.7

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_20.4_to_20.7_criteria_audit.md

## Executive Summary
- Total Issues from Audit: 5
- ⚠️ Partial Implementations: 2
- ❌ Missing Features: 0
- ❓ Needs Investigation: 1
- **Actual Issues Requiring Code Changes: 2**
- Estimated Complexity: Medium

**Key Findings:**
Upon thorough code analysis, several items marked as "Partial" or "Unable to Verify" are actually fully implemented. Only 2 items require actual fixes:
1. Question reordering via drag-and-drop (needs UI implementation)
2. Design token consistency in QuestionDetailModal.jsx

---

## Issue 1: Create new questions

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Create new questions
- **Current State:** Audit noted "APQuestionEditor.jsx exists but full implementation details not verified"

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APQuestionEditor.jsx` (full file) - Complete question editor
  - `src/apBoost/services/apQuestionService.js` (lines 155-196) - createQuestion service

- **Current Implementation:**
  The APQuestionEditor.jsx is **FULLY IMPLEMENTED** with:
  - **MCQ/MCQ_MULTI support:** Lines 13-44 `ChoiceEditor` component with checkbox for correct answer selection
  - **FRQ/SAQ/DBQ support:** Lines 49-91 `SubQuestionEditor` component with label, prompt, and maxPoints
  - **Question type selector:** Lines 322-332 with all 5 types (MCQ, MCQ_MULTI, FRQ, SAQ, DBQ)
  - **Metadata fields:** Subject (lines 335-345), difficulty (347-358), format (360-368), domain (372-380), topic (382-390)
  - **Create/Update logic:** Lines 217-270 `handleSave()` with proper data structure

- **Gap:** None - This is fully implemented

### Fix Plan

#### No Fix Required - Verification Only

**Action:** Update audit status to ✅ Implemented

**Verification Steps:**
1. Navigate to `/ap/teacher/question/new`
2. Select each question type (MCQ, MCQ_MULTI, FRQ, SAQ, DBQ)
3. Fill in all fields and save
4. Verify question appears in question bank
5. Edit the question and verify all fields load correctly

### Potential Risks
- None - code is already complete

---

## Issue 2: Reorder questions via drag

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Reorder questions via drag
- **Current State:** "Section reordering implemented with up/down buttons. However, question reordering within a section is NOT implemented via drag"

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APTestEditor.jsx` (lines 110-140) - Question list display in SectionEditor
  - `src/apBoost/services/apQuestionService.js` (lines 317-346) - `reorderSectionQuestions()` service function

- **Current Implementation:**
  - **Section reordering:** ✅ Implemented with up/down buttons (APTestEditor.jsx lines 294-304)
  - **Question list display:** Shows questions with Edit/Remove buttons (lines 112-139)
  - **Backend service:** `reorderSectionQuestions(testId, sectionIndex, newOrder)` is ALREADY IMPLEMENTED (apQuestionService.js lines 317-346)

- **Gap:**
  - No drag-and-drop UI for questions within a section
  - No up/down buttons for questions (only for sections)
  - The `reorderSectionQuestions` service exists but is never called from the UI

- **Dependencies:**
  - No drag-and-drop library currently installed (checked package.json)
  - Options: `@dnd-kit/core` (recommended, modern), `react-beautiful-dnd` (deprecated but stable)

### Fix Plan

#### Option A: Implement with Up/Down Buttons (Simpler, Matches Section Pattern)

##### Step 1: Add question reorder handler to APTestEditor.jsx
**File:** `src/apBoost/pages/APTestEditor.jsx`
**Action:** Add function after `handleRemoveQuestion` (around line 339)
**Details:**
```javascript
// Reorder question within a section
const handleReorderQuestion = async (sectionIndex, questionIndex, direction) => {
  const section = sections[sectionIndex]
  const questionIds = [...(section.questionIds || [])]
  const newIndex = direction === 'up' ? questionIndex - 1 : questionIndex + 1

  if (newIndex < 0 || newIndex >= questionIds.length) return

  // Swap questions
  const temp = questionIds[questionIndex]
  questionIds[questionIndex] = questionIds[newIndex]
  questionIds[newIndex] = temp

  // Update local state
  const newSections = [...sections]
  newSections[sectionIndex] = { ...section, questionIds }
  setSections(newSections)

  // Persist if not new test
  if (!isNew && testId) {
    try {
      await reorderSectionQuestions(testId, sectionIndex, questionIds)
    } catch (err) {
      logError('APTestEditor.reorderQuestion', { testId, sectionIndex }, err)
    }
  }
}
```

##### Step 2: Update SectionEditor props
**File:** `src/apBoost/pages/APTestEditor.jsx`
**Action:** Add `onReorderQuestion` prop to SectionEditor component definition (line 14-25)
**Details:**
- Add `onReorderQuestion` to destructured props
- Add `questionCount` to determine button states

##### Step 3: Add up/down buttons to question list
**File:** `src/apBoost/pages/APTestEditor.jsx`
**Action:** Modify question item display (lines 112-139)
**Details:**
```jsx
{questions.map((question, idx) => (
  <div
    key={question.id}
    className="flex items-center justify-between py-2 px-3 bg-muted rounded-[--radius-sm]"
  >
    <div className="flex-1 min-w-0">
      <span className="text-text-muted text-sm mr-2">{idx + 1}.</span>
      <span className="text-text-primary text-sm truncate">
        {question.questionText?.substring(0, 60)}
        {question.questionText?.length > 60 ? '...' : ''}
      </span>
    </div>
    <div className="flex items-center gap-2 ml-2">
      {/* Up/Down buttons */}
      <button
        onClick={() => onReorderQuestion(idx, 'up')}
        disabled={idx === 0}
        className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
        title="Move up"
      >
        ↑
      </button>
      <button
        onClick={() => onReorderQuestion(idx, 'down')}
        disabled={idx === questions.length - 1}
        className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
        title="Move down"
      >
        ↓
      </button>
      <Link
        to={`/ap/teacher/question/${question.id}/edit`}
        className="text-brand-primary text-xs hover:underline"
      >
        Edit
      </Link>
      <button
        onClick={() => onRemoveQuestion(question.id)}
        className="text-error-text text-xs hover:underline"
      >
        Remove
      </button>
    </div>
  </div>
))}
```

##### Step 4: Pass handler to SectionEditor component
**File:** `src/apBoost/pages/APTestEditor.jsx`
**Action:** Update SectionEditor usage in map (around line 472)
**Details:**
```jsx
onReorderQuestion={(qIdx, dir) => handleReorderQuestion(index, qIdx, dir)}
```

#### Option B: Implement with Drag-and-Drop (More Complex, Better UX)

If drag-and-drop is preferred:

##### Step 1: Install @dnd-kit
**Action:** Run in terminal
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

##### Step 2: Create DraggableQuestionList component
**File:** `src/apBoost/components/teacher/DraggableQuestionList.jsx` (NEW FILE)
**Action:** Create new component using @dnd-kit/sortable
**Details:** Follow existing pattern from FileUpload.jsx drag handling

##### Step 3: Replace question list in SectionEditor
**File:** `src/apBoost/pages/APTestEditor.jsx`
**Action:** Import and use DraggableQuestionList

### Recommended Approach: Option A
- Matches existing pattern (sections use up/down buttons)
- No new dependencies
- Simpler implementation
- Backend service already exists

### Verification Steps
1. Create a test with a section
2. Add 3+ questions to the section
3. Use up/down buttons to reorder questions
4. Save the test
5. Refresh and verify order persisted
6. Check Firestore document for correct `questionIds` order

### Potential Risks
- **Risk:** Race condition if user clicks rapidly
- **Mitigation:** Disable buttons while async operation in progress
- **Risk:** Stale state if multiple tabs open
- **Mitigation:** Out of scope for this fix (general state management issue)

---

## Issue 3: Student sees annotated PDF after grading

### Audit Finding
- **Status:** ❓ Unable to Verify
- **Criterion:** Student sees annotated PDF after grading
- **Current State:** "frqGradedPdfUrl is stored and passed to grading complete flow. Student-facing display in APReportCard.jsx needs verification"

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APReportCard.jsx` (lines 206-259) - HandwrittenFilesSection component
  - `src/apBoost/pages/APReportCard.jsx` (lines 469-478) - Component usage

- **Current Implementation:**
  This is **FULLY IMPLEMENTED**:

  1. **HandwrittenFilesSection component** (lines 206-259):
     - Accepts `annotatedPdfUrl` and `isGradingComplete` props
     - Displays uploaded files list (lines 216-232)
     - Shows annotated PDF section when grading is complete (lines 236-256):
       ```jsx
       {isGradingComplete && annotatedPdfUrl && (
         <div className="p-3 bg-success rounded-[--radius-sm]">
           <span className="text-success-text-strong font-medium">Teacher's Annotated Feedback</span>
           <a href={annotatedPdfUrl} ... download>Download PDF</a>
         </div>
       )}
       ```

  2. **Data flow** (lines 352-355):
     ```javascript
     const isHandwritten = result?.frqSubmissionType === FRQ_SUBMISSION_TYPE.HANDWRITTEN
     const uploadedFiles = result?.frqUploadedFiles || []
     const annotatedPdfUrl = result?.annotatedPdfUrl
     ```

  3. **Component rendered** (lines 469-478):
     ```jsx
     {isHandwritten && (
       <HandwrittenFilesSection
         files={uploadedFiles}
         annotatedPdfUrl={annotatedPdfUrl}
         isGradingComplete={isGradingComplete}
       />
     )}
     ```

- **Gap:** None - This is fully implemented

### Fix Plan

#### No Fix Required - Verification Only

**Action:** Update audit status to ✅ Implemented

**Verification Steps:**
1. Complete a test with handwritten FRQ submission
2. As teacher, upload annotated PDF via GradingPanel
3. As student, view report card at `/ap/results/{resultId}`
4. Verify "Teacher's Annotated Feedback" section appears
5. Click "Download PDF" and verify file downloads

### Potential Risks
- None - code is already complete

---

## Issue 4: Design Token Consistency in QuestionDetailModal

### Audit Finding
- **Status:** Low Priority Recommendation
- **Criterion:** "Some analytics components use raw Tailwind colors instead of design tokens"
- **Current State:** QuestionDetailModal.jsx uses `bg-green-50`, `text-green-700`, etc.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/analytics/QuestionDetailModal.jsx` (lines 6-30) - ResponseBar component
  - `src/index.css` - Design token definitions

- **Current Implementation:**
  The `ResponseBar` component uses raw Tailwind colors:
  - Line 8: `bg-green-50` / `bg-red-50` for backgrounds
  - Line 11: `text-green-700` / `text-red-700` for choice labels
  - Line 15: `text-green-600` for "Correct" indicator
  - Line 22: `bg-white` for bar background
  - Line 24: `bg-green-500` / `bg-red-400` for progress bars

- **Gap:** Should use semantic tokens for theme consistency

- **Token Mapping:**
  | Raw Tailwind | Design Token |
  |--------------|--------------|
  | `bg-green-50` | `bg-success` |
  | `bg-red-50` | `bg-error` |
  | `text-green-700` | `text-success-text-strong` |
  | `text-red-700` | `text-error-text-strong` |
  | `text-green-600` | `text-success-text` |
  | `bg-white` | `bg-surface` |
  | `bg-green-500` | `bg-btn-success` |
  | `bg-red-400` | `bg-ring-error` or `bg-error-text` |

### Fix Plan

#### Step 1: Update ResponseBar component
**File:** `src/apBoost/components/analytics/QuestionDetailModal.jsx`
**Action:** Replace lines 6-30 with design tokens

**Before (lines 6-30):**
```jsx
function ResponseBar({ choice, percentage, count, isCorrect }) {
  return (
    <div className={`p-3 rounded-[--radius-input] ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
            ({choice})
          </span>
          {isCorrect && (
            <span className="text-green-600 text-sm">✓ Correct</span>
          )}
        </div>
        ...
      </div>
      <div className="h-4 bg-white rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${isCorrect ? 'bg-green-500' : 'bg-red-400'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
```

**After:**
```jsx
function ResponseBar({ choice, percentage, count, isCorrect }) {
  return (
    <div className={`p-3 rounded-[--radius-input] ${isCorrect ? 'bg-success' : 'bg-error'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${isCorrect ? 'text-success-text-strong' : 'text-error-text-strong'}`}>
            ({choice})
          </span>
          {isCorrect && (
            <span className="text-success-text text-sm">✓ Correct</span>
          )}
        </div>
        <span className="text-text-secondary text-sm">
          {count} student{count !== 1 ? 's' : ''} ({percentage}%)
        </span>
      </div>
      <div className="h-4 bg-surface rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${isCorrect ? 'bg-btn-success' : 'bg-ring-error'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
```

### Verification Steps
1. Navigate to `/ap/teacher/analytics/{testId}`
2. Click on any MCQ question square to open modal
3. Verify correct answers show green styling
4. Verify incorrect answers show red styling
5. Toggle dark mode and verify colors adapt properly
6. Compare appearance with other components using design tokens

### Potential Risks
- **Risk:** Colors may look slightly different than before
- **Mitigation:** Token colors are designed to be semantically equivalent
- **Risk:** Bar colors may need adjustment for contrast
- **Mitigation:** Test in both light and dark modes

---

## Implementation Order

Recommended order to implement fixes (considering dependencies):

1. **Issue 2: Question Reordering** - Most impactful user-facing feature
   - Add handler function
   - Update SectionEditor component
   - Add UI buttons
   - Wire up to service

2. **Issue 4: Design Token Consistency** - Simple refactor, no dependencies
   - Update QuestionDetailModal.jsx
   - Test in both themes

3. **Issues 1 & 3: Verification Only** - No code changes needed
   - Run through verification steps
   - Update audit status

---

## Cross-Cutting Concerns

None identified - each fix is self-contained.

---

## Notes for Implementer

1. **APTestEditor.jsx is the main file for Issue 2** - The SectionEditor is defined inline (not a separate file), so all changes are in one file.

2. **The `reorderSectionQuestions` service already exists** - You just need to import and call it. The import is already present at line 6.

3. **For design tokens** - Reference `src/index.css` for available tokens. The `@theme` block (lines 306-433) defines all usable token names.

4. **Testing handwritten flow** (Issue 3):
   - Requires a test assigned with `frqSubmissionType: HANDWRITTEN`
   - Requires uploading files during test
   - Requires teacher grading and uploading annotated PDF
   - Then check student view

5. **Log changes to `change_action_log_ap.md`** per project rules.
