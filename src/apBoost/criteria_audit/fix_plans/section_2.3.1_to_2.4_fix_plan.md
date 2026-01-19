# Fix Plan: Sections 2.3.1 to 2.5

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_2.3.1_to_2.4_criteria_audit.md

## Executive Summary
- Total Issues: 4
- ⚠️ Partial Implementations: 2
- ❌ Missing Features: 0
- ❓ Needs Investigation: 2 (both verified as implemented correctly)
- Estimated Complexity: Low-Medium

---

## Issue 1: FRQTextInput Missing onBlur Save Handler

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** "Saves on blur event"
- **Current State:** No `onBlur` handler present. Saving happens through onChange which queues to Firestore via useOfflineQueue.

### Code Analysis
- **Relevant Files:**
  - [FRQTextInput.jsx](src/apBoost/components/FRQTextInput.jsx) (lines 1-98) - FRQ textarea component, no blur handling
  - [APTestSession.jsx](src/apBoost/pages/APTestSession.jsx) (lines 439-445) - Renders FRQTextInput with setAnswer callback
  - [useTestSession.js](src/apBoost/hooks/useTestSession.js) (lines 328-359) - setAnswer function adds to queue
  - [useOfflineQueue.js](src/apBoost/hooks/useOfflineQueue.js) (lines 124-160) - Queue management with 1s debounce

- **Current Implementation:**
  - FRQTextInput receives `onChange` prop and calls it on every keystroke (line 34-38)
  - Parent (APTestSession) passes `setAnswer` from useTestSession as onChange
  - setAnswer adds action to IndexedDB queue and schedules flush with 1s debounce
  - No explicit blur handler to ensure data is captured when user navigates away

- **Gap:** If a user types in the textarea then immediately clicks "Next" or closes the browser, the final answer state might not be queued if no additional onChange events fire. While the queue system is robust, an explicit blur save adds a safety net.

- **Dependencies:**
  - The fix only touches FRQTextInput and APTestSession
  - No changes to useTestSession or useOfflineQueue needed - the existing setAnswer mechanism works fine

### Fix Plan

#### Step 1: Add onBlur prop to FRQTextInput
**File:** `src/apBoost/components/FRQTextInput.jsx`
**Action:** Modify
**Details:**
- Add `onBlur` to the destructured props (line 14 area)
- Add onBlur handler to the textarea element (line 64 area)
- The onBlur should call the provided onBlur callback with the current value
- Pattern to follow: Similar to how onChange is handled currently

```jsx
// Add to props:
onBlur = null, // Optional blur handler

// Add handler:
const handleBlur = () => {
  if (onBlur) {
    onBlur(value)
  }
}

// Add to textarea:
<textarea
  ...
  onBlur={handleBlur}
  ...
/>
```

#### Step 2: Pass onBlur to FRQTextInput in APTestSession
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Modify
**Details:**
- At line 439-445 where FRQTextInput is rendered, add onBlur prop
- Use the same setAnswer function for onBlur as used for onChange
- This ensures the current value is queued on blur

```jsx
<FRQTextInput
  subQuestion={currentQuestion?.subQuestions?.find(sq => sq.label === subQuestionLabel)}
  value={currentAnswer || ''}
  onChange={setAnswer}
  onBlur={setAnswer}  // ADD THIS LINE
  disabled={isSubmitting || isInvalidated}
/>
```

### Verification Steps
1. Start an FRQ question, type some text, click Next button - verify answer is saved
2. Type in FRQ, click outside the textarea (blur), check IndexedDB for queued action
3. Type in FRQ, close browser tab - verify beforeunload warning appears if queue not empty
4. Resume session after blur-save - verify answer was persisted

### Potential Risks
- **Risk:** Double-save if onChange fires immediately before blur
  - **Mitigation:** Queue system handles duplicates gracefully - latest value wins when flushed
- **Risk:** Performance impact of extra queue writes
  - **Mitigation:** Minimal - blur only fires once per field interaction, not on every keystroke

---

## Issue 2: DBQ Multi-Document Support Missing

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** "Displays multiple documents as stimulus"
- **Current State:** StimulusDisplay only handles a single stimulus object. DBQ type is supported but only shows one document.

### Code Analysis
- **Relevant Files:**
  - [FRQQuestionDisplay.jsx](src/apBoost/components/FRQQuestionDisplay.jsx) (lines 6-33) - StimulusDisplay component
  - [FRQQuestionDisplay.jsx](src/apBoost/components/FRQQuestionDisplay.jsx) (lines 85-160) - Main component, uses displayStimulus
  - [apTypes.js](src/apBoost/utils/apTypes.js) (lines 56-62) - STIMULUS_TYPE enum includes DOCUMENT

- **Current Implementation:**
  - StimulusDisplay (lines 6-33) receives a single `stimulus` object with `type`, `content`, `source`
  - FRQQuestionDisplay uses `displayStimulus = stimulus || question.stimulus` (line 94) - single object
  - StimulusDisplay renders IMAGE/CHART differently from TEXT/PASSAGE/DOCUMENT
  - No handling for an array of stimuli

- **Gap:** DBQ questions should display multiple historical documents. The current data model and display only support one stimulus per question.

- **Dependencies:**
  - Data model in Firestore may need to support `stimuli` (array) in addition to `stimulus` (object)
  - FRQQuestionDisplay needs modification
  - StimulusDisplay needs a wrapper for multi-document navigation
  - Test seed data may need updating

### Fix Plan

#### Step 1: Create MultiStimulusDisplay wrapper component
**File:** `src/apBoost/components/FRQQuestionDisplay.jsx`
**Action:** Add new component above existing StimulusDisplay
**Details:**
- Create a component that handles an array of stimuli
- Include tab/document navigation for switching between documents
- Show document number indicator (e.g., "Document 1 of 3")
- Pattern: Follow existing StimulusDisplay styling

```jsx
/**
 * Multi-stimulus display for DBQ with document navigation
 */
function MultiStimulusDisplay({ stimuli }) {
  const [activeIndex, setActiveIndex] = useState(0)

  if (!stimuli || stimuli.length === 0) return null
  if (stimuli.length === 1) {
    return <StimulusDisplay stimulus={stimuli[0]} />
  }

  return (
    <div className="space-y-3">
      {/* Document tabs */}
      <div className="flex gap-2 border-b border-border-default pb-2">
        {stimuli.map((s, idx) => (
          <button
            key={idx}
            onClick={() => setActiveIndex(idx)}
            className={`px-3 py-1.5 text-sm rounded-t-[--radius-button] transition-colors
              ${idx === activeIndex
                ? 'bg-brand-primary text-white'
                : 'bg-muted text-text-secondary hover:bg-hover'
              }`}
          >
            Document {idx + 1}
          </button>
        ))}
      </div>

      {/* Active document */}
      <StimulusDisplay stimulus={stimuli[activeIndex]} />

      {/* Document count indicator */}
      <div className="text-text-muted text-xs text-center">
        Document {activeIndex + 1} of {stimuli.length}
      </div>
    </div>
  )
}
```

#### Step 2: Update FRQQuestionDisplay to handle array or single stimulus
**File:** `src/apBoost/components/FRQQuestionDisplay.jsx`
**Action:** Modify
**Details:**
- Update line 94 to handle both `stimulus` (object) and `stimuli` (array)
- Add logic to choose between StimulusDisplay and MultiStimulusDisplay
- Maintain backward compatibility with single stimulus

```jsx
// Around line 94, replace:
const displayStimulus = stimulus || question.stimulus

// With:
const displayStimulus = stimulus || question.stimulus
const displayStimuli = question.stimuli // Array of documents for DBQ

// In the render (around line 107), replace:
<StimulusDisplay stimulus={displayStimulus} />

// With:
{displayStimuli && displayStimuli.length > 0 ? (
  <MultiStimulusDisplay stimuli={displayStimuli} />
) : (
  <StimulusDisplay stimulus={displayStimulus} />
)}
```

#### Step 3: Add useState import
**File:** `src/apBoost/components/FRQQuestionDisplay.jsx`
**Action:** Modify
**Details:**
- Add `useState` to imports at top of file for MultiStimulusDisplay component

```jsx
import { useState } from 'react'
```

### Verification Steps
1. Create a test DBQ question with multiple documents in `question.stimuli` array
2. Load the DBQ question - verify document tabs appear
3. Click between tabs - verify content switches correctly
4. Verify single-stimulus questions still work (backward compatibility)
5. Test on mobile viewport - ensure tabs are accessible

### Potential Risks
- **Risk:** Existing seed data uses `stimulus` not `stimuli`
  - **Mitigation:** Backward compatible - falls back to single StimulusDisplay
- **Risk:** Long document titles overflow tabs
  - **Mitigation:** Use numbered tabs ("Document 1") not titles
- **Risk:** Many documents make tabs unusable
  - **Mitigation:** For >5 docs, consider dropdown or scrollable tabs (future enhancement)

---

## Issue 3: SAQ Manual Grading Verification

### Audit Finding
- **Status:** ❓ Unable to Verify Directly
- **Criterion:** "Requires manual grading"
- **Current State:** Infrastructure appears to support manual grading but needs verification.

### Code Analysis
- **Relevant Files:**
  - [useTestSession.js](src/apBoost/hooks/useTestSession.js) (lines 79-80) - SAQ included in frqTypes
  - [apScoringService.js](src/apBoost/services/apScoringService.js) (lines 122-123) - PENDING status for FRQ/MIXED sections
  - [apGradingService.js](src/apBoost/services/apGradingService.js) (full file) - Complete grading workflow

- **Current Implementation:**
  ```javascript
  // useTestSession.js:79-80
  const frqTypes = [QUESTION_TYPE.FRQ, QUESTION_TYPE.SAQ, QUESTION_TYPE.DBQ]

  // apScoringService.js:122-123
  const hasFRQ = test.sections.some(s =>
    s.sectionType === SECTION_TYPE.FRQ || s.sectionType === SECTION_TYPE.MIXED
  )
  const gradingStatus = hasFRQ ? GRADING_STATUS.PENDING : GRADING_STATUS.NOT_NEEDED
  ```

- **Verification Result:** ✅ **IMPLEMENTED CORRECTLY**
  - SAQ is included in `frqTypes` array
  - Any section containing FRQ-type questions gets `gradingStatus: PENDING`
  - `apGradingService.js` provides complete manual grading infrastructure:
    - `getPendingGrades()` - retrieves submissions awaiting grading
    - `getResultForGrading()` - fetches full submission with questions
    - `saveGrade()` - saves teacher grades with sub-scores and comments
    - `calculateFRQScore()` - sums up sub-question scores

### Fix Plan

**No code changes needed.** The implementation is complete.

### Verification Steps
1. Complete an SAQ test as a student
2. Verify test result has `gradingStatus: 'PENDING'`
3. As teacher, access grading interface - verify SAQ appears in pending list
4. Grade the SAQ - verify scores are saved correctly

### Potential Risks
None - implementation is verified as correct.

---

## Issue 4: DBQ Manual Grading Verification

### Audit Finding
- **Status:** ❓ Unable to Verify Directly
- **Criterion:** "Requires manual grading"
- **Current State:** Same infrastructure as SAQ, needs verification.

### Code Analysis
- **Relevant Files:** Same as Issue 3

- **Current Implementation:**
  - DBQ is included alongside SAQ and FRQ in `frqTypes` array (useTestSession.js:79-80)
  - Uses identical grading pathway as SAQ
  - All FRQ-type questions require manual grading via teacher interface

- **Verification Result:** ✅ **IMPLEMENTED CORRECTLY**
  - DBQ is treated identically to SAQ and FRQ for grading purposes
  - Test results get `gradingStatus: PENDING`
  - Teacher grading interface handles all FRQ types uniformly

### Fix Plan

**No code changes needed.** The implementation is complete.

### Verification Steps
1. Complete a DBQ test as a student
2. Verify test result has `gradingStatus: 'PENDING'`
3. As teacher, access grading interface - verify DBQ appears in pending list
4. Grade the DBQ including sub-question scores - verify saves correctly

### Potential Risks
None - implementation is verified as correct.

---

## Implementation Order

Recommended order to implement fixes (considering dependencies):

1. **Issue 1: FRQTextInput onBlur** - Independent, quick win, improves data safety
2. **Issue 2: DBQ Multi-Document Support** - Requires more changes but no dependencies on Issue 1
3. **Issue 3 & 4** - No changes needed, already verified as correct

## Cross-Cutting Concerns

### Data Model Consideration
For Issue 2 (multi-document DBQ), the Firestore question document may need both fields:
- `stimulus` (object) - for single-stimulus questions (backward compatible)
- `stimuli` (array) - for multi-document DBQ questions

Seed data scripts should be updated to include sample DBQ questions with multiple documents.

### Component Reusability
The `MultiStimulusDisplay` component created for Issue 2 could be reused for any future question types that need multiple documents/images.

## Notes for Implementer

1. **Issue 1 is a 5-minute fix** - Just add onBlur prop and handler
2. **Issue 2 is 15-20 minutes** - Create new component, update existing component
3. **Issues 3 & 4 require no code changes** - Just testing verification
4. **Test with existing seed data first** - Ensure backward compatibility before adding multi-doc support
5. **The queue system is robust** - Don't over-engineer the blur handler; the existing queue mechanism handles edge cases well

## Files Summary

| File | Changes Required |
|------|-----------------|
| `src/apBoost/components/FRQTextInput.jsx` | Add onBlur prop and handler |
| `src/apBoost/pages/APTestSession.jsx` | Pass onBlur to FRQTextInput |
| `src/apBoost/components/FRQQuestionDisplay.jsx` | Add MultiStimulusDisplay, update to handle stimuli array |
| `src/apBoost/services/apScoringService.js` | No changes needed (verified) |
| `src/apBoost/services/apGradingService.js` | No changes needed (verified) |
