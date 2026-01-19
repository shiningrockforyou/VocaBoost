# Fix Plan: Sections 2.1 to 2.3

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_2.1_to_2.3_criteria_audit.md

## Executive Summary
- Total Issues: 6
- ⚠️ Partial Implementations: 4
- ❌ Missing Features: 2
- ❓ Needs Investigation: 0
- Estimated Complexity: **Medium-High**

All issues are related to MCQ_MULTI (Multiple Choice - Multiple Answers) functionality. The data model and question creation support MCQ_MULTI, but the runtime UI and scoring do not.

---

## Issue 1: MCQ_MULTI Question Text Display Missing "Select All That Apply" Indicator

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** Displays question text (for MCQ_MULTI)
- **Current State:** Uses same QuestionDisplay component as MCQ - works, but no visual indicator that multiple selections are allowed

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/QuestionDisplay.jsx` (lines 48-164) - Main question display component
  - `src/apBoost/pages/APTestSession.jsx` (lines 416-456) - Renders QuestionDisplay with question prop
- **Current Implementation:** QuestionDisplay renders question text at lines 130-132 (HORIZONTAL) and 156-157 (VERTICAL), but has no awareness of question type for MCQ variations
- **Gap:** No "Select all that apply" or similar hint displayed for MCQ_MULTI questions
- **Dependencies:** Needs `question.questionType` to be passed through to display

### Fix Plan

#### Step 1: Add MCQ_MULTI indicator in QuestionDisplay.jsx
**File:** `src/apBoost/components/QuestionDisplay.jsx`
**Action:** Modify
**Details:**
- Import `QUESTION_TYPE` from `../utils/apTypes`
- Add check for `question.questionType === QUESTION_TYPE.MCQ_MULTI` after question text
- Add visual hint: `<p className="text-text-muted text-sm italic mt-1">Select all that apply</p>`
- Apply to both HORIZONTAL (after line 131) and VERTICAL (after line 157) layouts

**Code Pattern Reference:**
```jsx
// After question text, add:
{question.questionType === QUESTION_TYPE.MCQ_MULTI && (
  <p className="text-text-muted text-sm italic mt-1">Select all that apply</p>
)}
```

### Verification Steps
1. Create or load an MCQ_MULTI question in test session
2. Verify "Select all that apply" text appears below question text
3. Verify hint does NOT appear for regular MCQ questions
4. Test both VERTICAL and HORIZONTAL layouts

### Potential Risks
- None - purely additive visual change

---

## Issue 2: AnswerInput Does Not Support Checkbox Behavior for MCQ_MULTI

### Audit Finding
- **Status:** ❌ Missing (CRITICAL)
- **Criterion:** Displays answer options with checkboxes
- **Current State:** AnswerInput.jsx uses the SAME radio-button-style interface for all MCQ types. No checkbox implementation exists for MCQ_MULTI.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/components/AnswerInput.jsx` (lines 1-107) - Current MCQ answer component
  - `src/apBoost/pages/APTestSession.jsx` (lines 446-455) - Where AnswerInput is rendered
  - `src/apBoost/utils/apTypes.js` (line 8) - `QUESTION_TYPE.MCQ_MULTI` constant
- **Current Implementation:**
  - Line 36: `isSelected = selectedAnswer === letter` - compares single string value
  - Line 45: `onClick={() => !disabled && onSelect(letter)}` - passes single letter
  - No differentiation between MCQ and MCQ_MULTI types
- **Gap:** No checkbox UI, no array-based selection, no support for multiple selections
- **Dependencies:**
  - `APTestSession.jsx` passes `selectedAnswer` (single value) and `onSelect` (single callback)
  - `useTestSession.js` stores single answer for MCQ questions

### Fix Plan

#### Step 1: Add questionType prop and multi-select logic to AnswerInput
**File:** `src/apBoost/components/AnswerInput.jsx`
**Action:** Modify
**Details:**
- Add `questionType` prop to the component signature (default to `QUESTION_TYPE.MCQ`)
- Import `QUESTION_TYPE` from `../utils/apTypes`
- Determine if multi-select: `const isMultiSelect = questionType === QUESTION_TYPE.MCQ_MULTI`
- For multi-select mode:
  - Change `isSelected` check: `isSelected = Array.isArray(selectedAnswer) && selectedAnswer.includes(letter)`
  - Change click handler: toggle letter in array instead of replacing
- Add checkbox visual indicator for MCQ_MULTI (replace radio dot with checkbox square)

**Updated Component Signature:**
```jsx
export default function AnswerInput({
  question,
  questionType = 'MCQ', // NEW PROP
  selectedAnswer,
  onSelect,
  disabled = false,
  strikethroughs = new Set(),
  onStrikethrough,
}) {
```

**Multi-select Logic:**
```jsx
const isMultiSelect = questionType === QUESTION_TYPE.MCQ_MULTI

// For isSelected check:
const isSelected = isMultiSelect
  ? Array.isArray(selectedAnswer) && selectedAnswer.includes(letter)
  : selectedAnswer === letter

// For click handler:
onClick={() => {
  if (disabled) return
  if (isMultiSelect) {
    const current = Array.isArray(selectedAnswer) ? selectedAnswer : []
    if (current.includes(letter)) {
      onSelect(current.filter(l => l !== letter))
    } else {
      onSelect([...current, letter].sort())
    }
  } else {
    onSelect(letter)
  }
}}
```

#### Step 2: Add visual checkbox indicator for MCQ_MULTI
**File:** `src/apBoost/components/AnswerInput.jsx`
**Action:** Modify
**Details:**
- In the choice letter badge (lines 57-65), conditionally render checkbox vs radio style
- For MCQ_MULTI: use square checkbox icon
- For MCQ: keep current circular badge

**Code Pattern:**
```jsx
{/* Choice indicator - checkbox for multi, radio for single */}
{isMultiSelect ? (
  <span className={`
    inline-flex items-center justify-center w-5 h-5 rounded shrink-0 border-2
    ${isSelected
      ? 'bg-brand-primary border-brand-primary text-white'
      : 'border-border-default bg-surface'
    }
  `}>
    {isSelected && (
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    )}
  </span>
) : (
  <span className={`
    inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium shrink-0
    ${isSelected ? 'bg-white/20 text-white' : 'bg-muted text-text-secondary'}
  `}>
    {letter}
  </span>
)}
```

#### Step 3: Update APTestSession to pass questionType
**File:** `src/apBoost/pages/APTestSession.jsx`
**Action:** Modify
**Details:**
- Pass `questionType={currentQuestion?.questionType}` prop to AnswerInput (around line 447)

**Code Change:**
```jsx
<AnswerInput
  question={currentQuestion}
  questionType={currentQuestion?.questionType}  // ADD THIS
  selectedAnswer={currentAnswer}
  onSelect={setAnswer}
  disabled={isSubmitting || isInvalidated}
  strikethroughs={currentStrikethroughs}
  onStrikethrough={handleStrikethrough}
/>
```

### Verification Steps
1. Create an MCQ_MULTI question with correct answers A and C
2. Start a test session with this question
3. Verify checkbox-style UI appears (not radio buttons)
4. Click A - verify it's selected
5. Click C - verify BOTH A and C are selected
6. Click A again - verify only C remains selected
7. Verify regular MCQ still uses radio-button behavior

### Potential Risks
- **Risk:** Existing answer data format mismatch
  - **Mitigation:** The `isSelected` check handles both string and array formats gracefully
- **Risk:** Click handler complexity
  - **Mitigation:** Sort array to ensure consistent storage order

---

## Issue 3: Multiple Options Cannot Be Selected Simultaneously

### Audit Finding
- **Status:** ❌ Missing (CRITICAL)
- **Criterion:** Multiple options can be selected simultaneously
- **Current State:** `selectedAnswer === letter` and `onSelect(letter)` only support single selection. No array-based multi-select logic exists.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/hooks/useTestSession.js` (lines 327-359) - setAnswer callback
  - `src/apBoost/hooks/useTestSession.js` (lines 311-325) - currentAnswer getter
- **Current Implementation:**
  - Line 344: `next.set(questionId, answer)` - stores answer directly (string for MCQ)
  - Line 316: `answers.get(questionId)` - retrieves stored value
  - No special handling for array values for MCQ_MULTI
- **Gap:** The hook's setAnswer and currentAnswer work with any value type, but the calling code (APTestSession + AnswerInput) only uses string values
- **Dependencies:** Issue 2 fix enables array passing; this issue is about ensuring data flows correctly

### Fix Plan

#### Step 1: Verify useTestSession handles array values (already does)
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Verify (no change needed)
**Details:**
- The `setAnswer` callback at lines 327-359 already handles any answer value
- For non-FRQ questions, line 344 stores `answer` directly without type coercion
- This means arrays will work correctly once Issue 2 is fixed

#### Step 2: Update currentAnswer to handle array for MCQ_MULTI
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Verify (likely no change needed)
**Details:**
- Line 316: `const answer = answers.get(questionId)` returns the stored value
- Lines 320-322 only apply to FRQ with sub-questions
- For MCQ/MCQ_MULTI, line 324 returns the raw answer (string or array)

**Conclusion:** No changes needed to useTestSession.js - it already supports any answer value type.

### Verification Steps
1. After Issue 2 is implemented, select multiple answers for MCQ_MULTI
2. Navigate away and back - verify selections persist
3. Check browser dev tools: `answers.get(questionId)` should return array like `["A", "C"]`

### Potential Risks
- None - the hook is already type-agnostic

---

## Issue 4: correctAnswers Array for MCQ_MULTI Not Utilized at Runtime

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** correctAnswers array contains multiple values (e.g., ["A", "C"])
- **Current State:** The data model supports MCQ_MULTI as a type constant and questions can be created with multiple correct answers in APQuestionEditor, but the runtime answer-selection UI does not support it

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/pages/APQuestionEditor.jsx` (lines 181-193) - Creates correctAnswers array
  - `src/apBoost/services/apScoringService.js` (lines 23-45) - Uses correctAnswers for scoring
- **Current Implementation:**
  - APQuestionEditor correctly stores `correctAnswers: ["A", "C"]` for MCQ_MULTI
  - apScoringService.js line 35: `correctAnswers.includes(studentAnswer)` - only works for single string
- **Gap:** The correctAnswers array is stored correctly; the gap is in scoring (Issue 5/6) and UI (Issue 2)
- **Dependencies:** This is addressed by Issues 2 and 5/6

### Fix Plan

This issue is resolved by implementing Issues 2, 5, and 6. No additional changes needed.

### Verification Steps
1. Create MCQ_MULTI question with correct answers A and C
2. In Firestore, verify `correctAnswers: ["A", "C"]` is stored
3. After Issues 2/5/6, verify scoring correctly compares arrays

### Potential Risks
- None - data model is correct

---

## Issue 5: MCQ_MULTI Partial Credit Scoring Not Implemented

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** If partialCredit: true, partial points awarded for partially correct selections
- **Current State:** `partialCredit` field is set when creating MCQ_MULTI questions, but `calculateMCQScore()` only checks `correctAnswers.includes(studentAnswer)` - no partial credit calculation implemented

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/services/apScoringService.js` (lines 23-45) - calculateMCQScore function
  - `src/apBoost/pages/APQuestionEditor.jsx` (line 248) - Sets `partialCredit = true` for MCQ_MULTI
- **Current Implementation:**
  - Line 35-37: Only checks `correctAnswers.includes(studentAnswer)` - single answer comparison
  - No array comparison logic
  - `partialCredit` field is stored but never read during scoring
- **Gap:** Need to implement array comparison and partial credit formula
- **Dependencies:** Need student answers stored as arrays (Issue 2/3)

### Fix Plan

#### Step 1: Create calculateMCQMultiScore helper function
**File:** `src/apBoost/services/apScoringService.js`
**Action:** Add new function
**Details:**
- Add new function `calculateMCQMultiScore(studentAnswer, correctAnswers, partialCredit)`
- Implement partial credit formula: `score = correct_selections - wrong_selections` (minimum 0)
- Implement all-or-nothing: exact array match required

**New Function (add after line 45):**
```javascript
/**
 * Calculate score for MCQ_MULTI question
 * @param {Array} studentAnswer - Array of selected letters (e.g., ["A", "C"])
 * @param {Array} correctAnswers - Array of correct letters (e.g., ["A", "C"])
 * @param {boolean} partialCredit - Whether to allow partial credit
 * @returns {number} Score (0 to 1 for partial, 0 or 1 for all-or-nothing)
 */
function calculateMCQMultiScore(studentAnswer, correctAnswers, partialCredit) {
  // Normalize inputs
  const selected = Array.isArray(studentAnswer) ? studentAnswer : []
  const correct = Array.isArray(correctAnswers) ? correctAnswers : []

  if (correct.length === 0) return 0

  // Count correct and incorrect selections
  let correctCount = 0
  let incorrectCount = 0

  for (const letter of selected) {
    if (correct.includes(letter)) {
      correctCount++
    } else {
      incorrectCount++
    }
  }

  // Check for missed correct answers
  const missedCount = correct.length - correctCount

  if (partialCredit) {
    // Partial credit formula: (correct - wrong) / total_correct, minimum 0
    const rawScore = (correctCount - incorrectCount) / correct.length
    return Math.max(0, rawScore)
  } else {
    // All-or-nothing: must select exactly the correct answers
    return (correctCount === correct.length && incorrectCount === 0) ? 1 : 0
  }
}
```

#### Step 2: Update calculateMCQScore to handle MCQ_MULTI
**File:** `src/apBoost/services/apScoringService.js`
**Action:** Modify calculateMCQScore function
**Details:**
- Import QUESTION_TYPE if not already imported
- Check question type before scoring
- For MCQ_MULTI, use new calculateMCQMultiScore function
- For MCQ, keep existing single-answer logic

**Modified calculateMCQScore (lines 23-45):**
```javascript
export function calculateMCQScore(answers, questions, section) {
  let correct = 0
  let total = 0
  let partialPoints = 0

  for (const questionId of section.questionIds || []) {
    const question = questions[questionId]
    if (!question) continue

    total++
    const studentAnswer = answers[questionId]
    const correctAnswers = question.correctAnswers || []

    // Check if MCQ_MULTI
    if (question.questionType === QUESTION_TYPE.MCQ_MULTI) {
      const score = calculateMCQMultiScore(
        studentAnswer,
        correctAnswers,
        question.partialCredit !== false // Default to true for MCQ_MULTI
      )
      partialPoints += score
      if (score === 1) correct++
    } else {
      // Standard MCQ - single answer
      if (correctAnswers.includes(studentAnswer)) {
        correct++
        partialPoints += 1
      }
    }
  }

  // Apply multiplier if present
  const multiplier = section.mcqMultiplier || 1
  const points = partialPoints * multiplier

  return { correct, total, points }
}
```

#### Step 3: Update imports in apScoringService.js
**File:** `src/apBoost/services/apScoringService.js`
**Action:** Modify imports
**Details:**
- Add `QUESTION_TYPE` to imports from `../utils/apTypes`

**Updated import (line 12):**
```javascript
import { COLLECTIONS, GRADING_STATUS, SECTION_TYPE, DEFAULT_SCORE_RANGES, QUESTION_TYPE } from '../utils/apTypes'
```

### Verification Steps
1. Create MCQ_MULTI question with correct answers ["A", "C"] and partialCredit: true
2. Student selects ["A"] only
   - Expected: 50% credit (1 correct, 0 wrong, 2 total)
3. Student selects ["A", "C"]
   - Expected: 100% credit
4. Student selects ["A", "B"]
   - Expected: 0% credit (1 correct - 1 wrong = 0)
5. Student selects ["A", "C", "D"]
   - Expected: 50% credit (2 correct - 1 wrong = 1, 1/2 = 0.5)

### Potential Risks
- **Risk:** Existing test results might have string answers for MCQ_MULTI
  - **Mitigation:** calculateMCQMultiScore handles non-array input gracefully (returns 0)
- **Risk:** Partial credit formula may need adjustment
  - **Mitigation:** Document the formula; can be tweaked later

---

## Issue 6: MCQ_MULTI All-or-Nothing Scoring Not Implemented

### Audit Finding
- **Status:** ⚠️ Partial
- **Criterion:** If partialCredit: false, must select exactly the correct options for credit
- **Current State:** Scoring logic does not handle array comparisons for multi-select answers

### Code Analysis
- Same as Issue 5
- **Gap:** No exact-match array comparison exists

### Fix Plan

This is addressed in Issue 5, Step 1 - the `calculateMCQMultiScore` function handles both:
- `partialCredit: true` - partial credit formula
- `partialCredit: false` - exact match required

### Verification Steps
1. Create MCQ_MULTI question with correct answers ["A", "C"] and partialCredit: false
2. Student selects ["A"] only
   - Expected: 0% credit (not exact match)
3. Student selects ["A", "C"]
   - Expected: 100% credit (exact match)
4. Student selects ["A", "C", "D"]
   - Expected: 0% credit (extra selection)
5. Student selects ["C", "A"]
   - Expected: 100% credit (order doesn't matter)

### Potential Risks
- None - covered by Issue 5 implementation

---

## Implementation Order

Recommended order to implement fixes (considering dependencies):

1. **Issue 2: AnswerInput Checkbox Behavior** - FIRST
   - This is the foundation - enables students to select multiple answers
   - Includes passing questionType prop from APTestSession
   - Without this, no other fixes can be tested

2. **Issue 1: "Select All That Apply" Indicator** - SECOND
   - Simple visual enhancement
   - Can be done in parallel with Issue 2 if desired
   - Improves UX for MCQ_MULTI

3. **Issue 5 & 6: Scoring Logic** - THIRD
   - Requires Issue 2 to be working (to generate array answers)
   - Implements both partial credit and all-or-nothing scoring
   - Critical for correct grading

4. **Issue 3: Multiple Selection Storage** - AUTOMATIC
   - No code changes needed - handled by Issue 2

5. **Issue 4: correctAnswers Array** - AUTOMATIC
   - No code changes needed - data model already correct

---

## Cross-Cutting Concerns

### 1. Answer Format Consistency
- MCQ answers: string (e.g., "B")
- MCQ_MULTI answers: sorted array (e.g., ["A", "C"])
- FRQ answers: object with sub-question keys (e.g., {a: "...", b: "..."})

The codebase already handles mixed types in useTestSession.js via Map storage.

### 2. Backward Compatibility
- Existing MCQ answers (strings) will continue to work
- Existing MCQ_MULTI questions in database are correct
- Scoring handles missing/malformed answers gracefully

### 3. Testing Considerations
- Test with 2, 3, and 4 correct answer combinations
- Test partial credit boundary cases (0%, 50%, 100%)
- Test navigation between questions preserves multi-select state
- Test session persistence (reload preserves selections)

---

## Notes for Implementer

1. **APQuestionEditor.jsx is already correct** - no changes needed for question creation
2. **useTestSession.js is already type-agnostic** - stores any answer value
3. **Focus on AnswerInput.jsx and apScoringService.js** - these are the main changes
4. **The `partialCredit` field** defaults to `true` for MCQ_MULTI in APQuestionEditor (line 248)
5. **Array sorting** - always sort selected answers to ensure consistent storage/comparison
6. **QuestionDisplay.jsx** only needs the small indicator text addition

---

## Files to Modify Summary

| File | Changes |
|------|---------|
| `src/apBoost/components/AnswerInput.jsx` | Add questionType prop, multi-select logic, checkbox UI |
| `src/apBoost/components/QuestionDisplay.jsx` | Add "Select all that apply" hint for MCQ_MULTI |
| `src/apBoost/pages/APTestSession.jsx` | Pass questionType to AnswerInput |
| `src/apBoost/services/apScoringService.js` | Add calculateMCQMultiScore, update calculateMCQScore |

---

## Estimated Changes

- **AnswerInput.jsx:** ~40 lines modified/added
- **QuestionDisplay.jsx:** ~6 lines added
- **APTestSession.jsx:** ~1 line added
- **apScoringService.js:** ~45 lines added/modified

**Total:** ~92 lines of code changes
