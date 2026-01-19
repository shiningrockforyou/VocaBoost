# Fix Plan: Sections 4.1 to 4.5 (Scoring System)

**Planned by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE
**Based on Audit:** section_4.1_to_4.5_criteria_audit.md

## Executive Summary
- Total Issues: 5
- Partial Implementations: 1 (FRQ multipliers in score flow)
- Missing Features: 3 (MCQ_MULTI all-or-nothing, MCQ_MULTI partial credit, FRQ multipliers)
- Needs Investigation: 0
- Additional Issue: 1 (Duplicate AP Score calculation function)
- Estimated Complexity: **Medium-High**

---

## Issue 1: MCQ_MULTI Scoring Not Implemented (All-or-Nothing Mode)

### Audit Finding
- **Status:** Missing
- **Criterion:** If `partialCredit: false`, all-or-nothing scoring
- **Current State:** `calculateMCQScore()` only checks `correctAnswers.includes(studentAnswer)` which is single-answer logic. No support for multi-select questions.

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/services/apScoringService.js` (lines 23-45) - MCQ scoring function
  - `src/apBoost/services/apQuestionService.js` (line 183) - `partialCredit` field stored
  - `src/apBoost/hooks/useTestSession.js` (lines 328-359) - `setAnswer()` stores single values
  - `src/apBoost/utils/apTypes.js` (line 8) - `MCQ_MULTI` type defined

- **Current Implementation:**
  ```javascript
  // apScoringService.js:35-37
  if (correctAnswers.includes(studentAnswer)) {
    correct++
  }
  ```
  This only checks if a single studentAnswer is in the correctAnswers array.

- **Gap:**
  1. Student answers for MCQ_MULTI are stored as single values, not arrays
  2. No question type check to distinguish MCQ from MCQ_MULTI
  3. No array comparison logic for MCQ_MULTI questions
  4. `partialCredit` field on questions is not read during scoring

- **Dependencies:**
  - **UI Layer:** `useTestSession.js` needs to store MCQ_MULTI answers as arrays
  - **Question Model:** Already has `partialCredit` field and `correctAnswers` as array
  - **Test Session:** Answer storage needs array support for MCQ_MULTI

### Fix Plan

#### Step 1: Update answer storage in useTestSession for MCQ_MULTI
**File:** `src/apBoost/hooks/useTestSession.js`
**Action:** Modify
**Details:**
- Add check for MCQ_MULTI question type in `setAnswer()` function (around line 328)
- When question is MCQ_MULTI, store answer as an array instead of single value
- Reference pattern from `isFRQQuestion` check at lines 77-81 for how to detect question type

#### Step 2: Add helper function for array comparison
**File:** `src/apBoost/services/apScoringService.js`
**Action:** Add new function before `calculateMCQScore()`
**Details:**
- Create `arraysEqual(arr1, arr2)` function that compares two arrays regardless of order
- Sort both arrays and compare element-by-element
- Return true only if arrays have same elements (ignoring order)

```javascript
// Add at line 16 (before calculateMCQScore)
function arraysEqual(arr1, arr2) {
  if (!arr1 || !arr2) return false
  if (arr1.length !== arr2.length) return false
  const sorted1 = [...arr1].sort()
  const sorted2 = [...arr2].sort()
  return sorted1.every((val, i) => val === sorted2[i])
}
```

#### Step 3: Update calculateMCQScore for MCQ_MULTI all-or-nothing
**File:** `src/apBoost/services/apScoringService.js`
**Action:** Modify `calculateMCQScore()` function (lines 23-45)
**Details:**
- Add import for `QUESTION_TYPE` from `../utils/apTypes`
- Inside the loop, check `question.questionType`
- If `MCQ_MULTI` with `partialCredit: false` (or undefined), use `arraysEqual()` for comparison
- If regular `MCQ`, keep existing single-answer logic

```javascript
// Modified lines 31-37
if (question.questionType === QUESTION_TYPE.MCQ_MULTI) {
  // MCQ_MULTI: student answer should be an array
  const studentAnswerArray = Array.isArray(studentAnswer) ? studentAnswer : []
  if (!question.partialCredit && arraysEqual(studentAnswerArray, correctAnswers)) {
    correct++
  }
  // partialCredit: true handled in Issue 2
} else {
  // Regular MCQ: single answer
  if (correctAnswers.includes(studentAnswer)) {
    correct++
  }
}
```

### Verification Steps
1. Create MCQ_MULTI question with `partialCredit: false` and multiple correct answers (e.g., A, C)
2. Submit test with exact matching answers [A, C] - should score 1 point
3. Submit test with only partial answers [A] - should score 0 points
4. Submit test with extra answers [A, B, C] - should score 0 points
5. Submit test with wrong answers [B, D] - should score 0 points
6. Verify answer storage in Firestore shows array format for MCQ_MULTI

### Potential Risks
- **Risk:** Existing MCQ_MULTI answers stored as single values will fail scoring
- **Mitigation:** The fix includes fallback - if studentAnswer is not an array, convert to empty array (scores 0)
- **Risk:** UI may not support multi-select yet (noted in section_2.1_to_2.3 audit)
- **Mitigation:** Scoring fix is independent; UI fix should be coordinated separately

---

## Issue 2: MCQ_MULTI Partial Credit Not Implemented

### Audit Finding
- **Status:** Missing
- **Criterion:** If `partialCredit: true`, partial points based on formula considering correct selections, incorrect selections, and missed answers
- **Current State:** No partial credit calculation exists whatsoever

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/services/apScoringService.js` (lines 23-45) - needs partial credit logic
  - `src/apBoost/pages/APQuestionEditor.jsx` (line 248) - sets `partialCredit = true` for MCQ_MULTI

- **Current Implementation:** None

- **Gap:** Complete feature missing. Need to implement a partial credit formula.

- **Dependencies:**
  - Depends on Issue 1 being fixed first (MCQ_MULTI basic recognition)
  - Need to decide on partial credit formula (several options exist)

### Fix Plan

#### Step 1: Choose and document partial credit formula
**File:** `src/apBoost/services/apScoringService.js`
**Action:** Add documentation comment and implement formula
**Details:**
- Recommended formula: **Correct - Incorrect, minimum 0, scaled to 1 point max**
- Formula: `score = max(0, (correctSelected - incorrectSelected)) / totalCorrect`
- This penalizes guessing while rewarding partial knowledge

Alternative simpler formula (no penalty):
- `score = correctSelected / totalCorrect`
- This only rewards correct selections, doesn't penalize incorrect

#### Step 2: Implement partial credit calculation
**File:** `src/apBoost/services/apScoringService.js`
**Action:** Add partial credit logic inside MCQ_MULTI branch
**Details:**
- Add after the all-or-nothing check (from Issue 1)
- Only triggers when `question.partialCredit === true`

```javascript
// Inside MCQ_MULTI branch, after all-or-nothing check
} else if (question.partialCredit) {
  // Partial credit calculation
  const studentAnswerArray = Array.isArray(studentAnswer) ? studentAnswer : []
  const correctSet = new Set(correctAnswers)

  let correctSelected = 0
  let incorrectSelected = 0

  for (const ans of studentAnswerArray) {
    if (correctSet.has(ans)) {
      correctSelected++
    } else {
      incorrectSelected++
    }
  }

  const totalCorrect = correctAnswers.length
  // Partial credit: (correct - incorrect) / total, min 0, max 1
  const partialScore = Math.max(0, (correctSelected - incorrectSelected) / totalCorrect)
  correct += partialScore // Note: changes 'correct' to a float
}
```

#### Step 3: Handle float scores in multiplier calculation
**File:** `src/apBoost/services/apScoringService.js`
**Action:** Modify lines 40-42
**Details:**
- Change `points` calculation to handle fractional scores
- Consider whether to round at end or keep precision

```javascript
// Line 42 - no change needed, multiplication handles floats
const points = correct * multiplier
```

### Verification Steps
1. Create MCQ_MULTI with `partialCredit: true`, correct answers [A, B, C]
2. Test case: student selects [A, B] → should get 2/3 = 0.67 points
3. Test case: student selects [A, B, D] → should get (2-1)/3 = 0.33 points
4. Test case: student selects [A, B, C, D] → should get (3-1)/3 = 0.67 points
5. Test case: student selects [D] → should get (0-1)/3 = 0 points (min 0)
6. Test case: student selects [A, B, C] → should get 3/3 = 1 point

### Potential Risks
- **Risk:** Fractional scores may cause display issues
- **Mitigation:** Round final percentage/AP score; keep intermediate precision
- **Risk:** Different AP exams may use different formulas
- **Mitigation:** Could make formula configurable per-test in future; start with standard formula

---

## Issue 3: FRQ Multipliers Not Implemented

### Audit Finding
- **Status:** Missing (also noted as Partial in 4.1)
- **Criterion:** Apply question's `frqMultiplier` to FRQ question totals
- **Current State:** MCQ has `mcqMultiplier` at section level; FRQ has no multiplier at all

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/services/apScoringService.js` (lines 91-114) - MCQ scoring loop, FRQ not handled
  - `src/apBoost/services/apGradingService.js` (lines 218-231) - `calculateFRQScore()` sums raw subScores
  - `src/apBoost/pages/APTestEditor.jsx` (lines 92-101) - section has `multiplier` field (used as mcqMultiplier)

- **Current Implementation:**
  ```javascript
  // apGradingService.js:218-231
  export function calculateFRQScore(grades) {
    let total = 0
    for (const questionGrade of Object.values(grades)) {
      if (questionGrade.subScores) {
        for (const score of Object.values(questionGrade.subScores)) {
          total += Number(score) || 0
        }
      }
    }
    return total
  }
  ```
  No multiplier applied.

- **Gap:**
  1. No `frqMultiplier` field in test/question data model
  2. `calculateFRQScore()` doesn't apply any multipliers
  3. No UI to configure FRQ multipliers
  4. `createTestResult()` doesn't calculate weighted FRQ max points

- **Dependencies:**
  - Need to decide: per-question multiplier or per-section multiplier?
  - Acceptance criteria says "per-question" (`frqMultipliers`)
  - APTestEditor already has section `multiplier` field - could extend this pattern

### Fix Plan

#### Step 1: Define FRQ multiplier data model approach
**Decision Required:** Two options:
- **Option A:** Per-section FRQ multiplier (simpler, matches MCQ pattern)
- **Option B:** Per-question FRQ multiplier (more flexible, matches acceptance criteria)

**Recommendation:** Option A for consistency with MCQ pattern. The section already has a `multiplier` field in APTestEditor.jsx - just need to apply it to FRQ sections too.

#### Step 2: Update calculateFRQScore to accept multipliers
**File:** `src/apBoost/services/apGradingService.js`
**Action:** Modify `calculateFRQScore()` function
**Details:**
- Add optional `test` parameter to access section multipliers
- Or add optional `multipliers` object parameter

```javascript
// Modified function signature
export function calculateFRQScore(grades, questionMultipliers = null) {
  if (!grades) return 0

  let total = 0
  for (const [questionId, questionGrade] of Object.entries(grades)) {
    if (questionGrade.subScores) {
      let questionTotal = 0
      for (const score of Object.values(questionGrade.subScores)) {
        questionTotal += Number(score) || 0
      }
      // Apply per-question multiplier if provided
      const multiplier = questionMultipliers?.[questionId] || 1
      total += questionTotal * multiplier
    }
  }

  return total
}
```

#### Step 3: Update saveGrade to pass multipliers
**File:** `src/apBoost/services/apGradingService.js`
**Action:** Modify `saveGrade()` function (lines 165-211)
**Details:**
- When status is COMPLETE, need to fetch test data to get multipliers
- Apply multipliers when calculating frqScore
- OR use section-level multiplier from result data

```javascript
// Inside saveGrade, around line 183-184
if (status === GRADING_STATUS.COMPLETE) {
  // Get test to access FRQ section multiplier
  const resultSnap = await getDoc(resultRef)
  if (resultSnap.exists()) {
    const resultData = resultSnap.data()

    // Fetch test for multiplier info
    const testDoc = await getDoc(doc(db, COLLECTIONS.TESTS, resultData.testId))
    const testData = testDoc.exists() ? testDoc.data() : null

    // Find FRQ section multiplier
    let frqMultiplier = 1
    if (testData?.sections) {
      const frqSection = testData.sections.find(s =>
        s.sectionType === SECTION_TYPE.FRQ || s.sectionType === SECTION_TYPE.MIXED
      )
      frqMultiplier = frqSection?.multiplier || 1
    }

    const rawFrqScore = calculateFRQScore(grades)
    const frqScore = rawFrqScore * frqMultiplier
    updateData.frqScore = frqScore
    // ...rest of calculation
  }
}
```

#### Step 4: Update APTestEditor to clarify multiplier usage
**File:** `src/apBoost/pages/APTestEditor.jsx`
**Action:** Modify SectionEditor component (line 93-101)
**Details:**
- The `multiplier` field already exists at section level
- Update label to clarify it applies to both MCQ and FRQ sections
- Current code uses `section.multiplier` but scoring uses `section.mcqMultiplier`

**Important Discovery:** There's a mismatch!
- APTestEditor saves `section.multiplier`
- apScoringService reads `section.mcqMultiplier`

This needs to be unified. Either:
- Change editor to save `mcqMultiplier`
- Or change scoring to read `multiplier`

```javascript
// SectionEditor line 93-101 - update to use consistent field name
<input
  type="number"
  step="0.1"
  min="0.1"
  value={section.mcqMultiplier || 1.0}  // Changed from section.multiplier
  onChange={(e) => onUpdate({ mcqMultiplier: parseFloat(e.target.value) || 1.0 })}
  // ...
/>
```

#### Step 5: Apply multiplier in createTestResult for FRQ max points
**File:** `src/apBoost/services/apScoringService.js`
**Action:** Modify `createTestResult()` around lines 113-115
**Details:**
- When calculating `frqMaxPoints`, apply the section multiplier

```javascript
// After MCQ section handling, add FRQ handling
if (section.sectionType === SECTION_TYPE.FRQ || section.sectionType === SECTION_TYPE.MIXED) {
  // Calculate FRQ max points with multiplier
  let sectionMaxPoints = 0
  for (const questionId of section.questionIds || []) {
    const question = test.questions[questionId]
    if (question?.subQuestions) {
      for (const sq of question.subQuestions) {
        sectionMaxPoints += sq.maxPoints || sq.points || 1
      }
    }
  }
  const frqMultiplier = section.mcqMultiplier || section.multiplier || 1
  resultData.frqMaxPoints = sectionMaxPoints * frqMultiplier
}
```

### Verification Steps
1. Create test with FRQ section, set section multiplier to 2.0
2. FRQ question has sub-questions worth 3 + 2 + 1 = 6 raw points
3. `frqMaxPoints` should be 12 (6 * 2.0)
4. Grade student: a=3, b=1, c=1 = 5 raw points
5. `frqScore` should be 10 (5 * 2.0)
6. Verify total score calculation includes weighted FRQ

### Potential Risks
- **Risk:** Existing tests have `section.multiplier` but scoring reads `section.mcqMultiplier`
- **Mitigation:** Add fallback: `section.mcqMultiplier || section.multiplier || 1`
- **Risk:** Data migration needed for existing tests
- **Mitigation:** Fallback to 1 if neither field exists

---

## Issue 4: Duplicate AP Score Calculation Functions

### Audit Finding
- **Status:** Observation/Bug (noted in Recommendations)
- **Criterion:** AP score should use test's custom `scoreRanges`
- **Current State:** Two `calculateAPScore` functions exist with different behavior

### Code Analysis
- **Relevant Files:**
  - `src/apBoost/services/apScoringService.js` (lines 53-59) - **correct version**, accepts `scoreRanges`
  - `src/apBoost/services/apGradingService.js` (lines 238-244) - **wrong version**, hardcoded thresholds

- **apScoringService.js version (CORRECT):**
  ```javascript
  export function calculateAPScore(percentage, scoreRanges = DEFAULT_SCORE_RANGES) {
    if (percentage >= scoreRanges.ap5.min) return 5
    if (percentage >= scoreRanges.ap4.min) return 4
    // ...uses custom ranges
  }
  ```

- **apGradingService.js version (WRONG):**
  ```javascript
  export function calculateAPScore(percentage) {
    if (percentage >= 80) return 5
    if (percentage >= 65) return 4
    // ...hardcoded values
  }
  ```

- **Bug:** In `saveGrade()` line 202:
  ```javascript
  updateData.apScore = calculateAPScore(updateData.percentage)
  ```
  This calls the LOCAL hardcoded version, ignoring test's custom `scoreRanges`!

### Fix Plan

#### Step 1: Remove duplicate function from apGradingService
**File:** `src/apBoost/services/apGradingService.js`
**Action:** Delete lines 233-244 (the duplicate function)

#### Step 2: Import calculateAPScore from apScoringService
**File:** `src/apBoost/services/apGradingService.js`
**Action:** Add import at top of file
**Details:**
```javascript
// Line 17 area - add to imports
import { calculateAPScore } from './apScoringService'
```

#### Step 3: Update saveGrade to use test's scoreRanges
**File:** `src/apBoost/services/apGradingService.js`
**Action:** Modify `saveGrade()` function
**Details:**
- Fetch test document to get `scoreRanges`
- Pass to `calculateAPScore()`

```javascript
// Around line 186-202, after getting resultData
const testDoc = await getDoc(doc(db, COLLECTIONS.TESTS, resultData.testId))
const testData = testDoc.exists() ? testDoc.data() : null
const scoreRanges = testData?.scoreRanges || DEFAULT_SCORE_RANGES

// Line 202 - pass scoreRanges
updateData.apScore = calculateAPScore(updateData.percentage, scoreRanges)
```

#### Step 4: Add DEFAULT_SCORE_RANGES import
**File:** `src/apBoost/services/apGradingService.js`
**Action:** Update imports
**Details:**
```javascript
// Line 17 - add to apTypes import
import { COLLECTIONS, GRADING_STATUS, SECTION_TYPE, DEFAULT_SCORE_RANGES } from '../utils/apTypes'
```

### Verification Steps
1. Create test with custom score ranges (e.g., AP5 = 90-100%)
2. Student scores 85% on test
3. On initial submit (MCQ only), AP score should be 4 (using custom ranges)
4. After FRQ grading complete, AP score should still use custom ranges
5. Verify AP score doesn't incorrectly show 5 (which would happen with default 80% threshold)

### Potential Risks
- **Risk:** Tests missing `scoreRanges` field
- **Mitigation:** Fallback to `DEFAULT_SCORE_RANGES` (already implemented in apScoringService)
- **Risk:** Breaking change if any code depends on local function
- **Mitigation:** Both functions have same signature for default case; only behavior differs with custom ranges

---

## Implementation Order

Recommended order to implement fixes (considering dependencies):

1. **Issue 4: Duplicate AP Score Function** - Quick fix, prevents scoring bugs, no dependencies
2. **Issue 3 Step 4: Fix multiplier field name mismatch** - Fixes existing MCQ multiplier issue
3. **Issue 1: MCQ_MULTI All-or-Nothing** - Foundation for MCQ_MULTI support
4. **Issue 2: MCQ_MULTI Partial Credit** - Builds on Issue 1
5. **Issue 3: FRQ Multipliers** - Independent feature, can be done in parallel with MCQ_MULTI

## Cross-Cutting Concerns

### Data Model Consistency
- Unify `section.multiplier` vs `section.mcqMultiplier` field naming
- Decide on approach: use single `multiplier` field for all section types
- Migration consideration: add fallback logic for existing data

### Answer Storage Format
- MCQ: string (single letter)
- MCQ_MULTI: array of strings (multiple letters)
- FRQ: object keyed by sub-question label `{ a: "...", b: "..." }`
- Need to ensure UI, session, and scoring all handle these consistently

### Scoring Precision
- MCQ_MULTI partial credit introduces fractional points
- Consider rounding strategy: round at end for display, keep precision internally
- Document precision policy for implementer

## Notes for Implementer

1. **Test with existing data:** Ensure all fixes have fallbacks for tests/sessions created before these changes

2. **UI coordination needed:** MCQ_MULTI scoring fixes require UI to support multi-select. Check `section_2.1_to_2.3_criteria_audit.md` for related UI issues.

3. **Formula decision:** The partial credit formula `(correct - incorrect) / total` is one option. If a different formula is preferred (e.g., no penalty), it should be discussed before implementation.

4. **Consider unit tests:** These scoring functions are pure logic and highly testable. Consider adding unit tests as part of implementation.

5. **Import changes:** Several files need new imports:
   - `apScoringService.js`: Add `QUESTION_TYPE` import
   - `apGradingService.js`: Add `calculateAPScore` import from apScoringService, add `SECTION_TYPE` and `DEFAULT_SCORE_RANGES` to existing import
