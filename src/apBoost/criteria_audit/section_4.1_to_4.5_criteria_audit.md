# Acceptance Criteria Audit: Sections 4.1 to 4.5

**Audited by:** Claude Agent
**Date:** 2026-01-14
**Status:** COMPLETE

## Summary
- Total Criteria: 17
- Implemented: 12
- Partial: 2
- Missing: 3
- Unable to Verify: 0

---

## Section 4.1: Score Calculation Flow

### Criterion: Step 1: Calculate RAW SCORE per section (MCQ: count correct, FRQ: sum graded points)
- **Status:** Implemented
- **Evidence:** [apScoringService.js:23-45](src/apBoost/services/apScoringService.js#L23-L45)
- **Notes:** `calculateMCQScore()` iterates through `section.questionIds`, counts correct answers by checking `correctAnswers.includes(studentAnswer)`. FRQ raw scores calculated in `calculateFRQScore()` at [apGradingService.js:218-231](src/apBoost/services/apGradingService.js#L218-L231)

### Criterion: Step 2: Apply MULTIPLIERS (MCQ section x mcqMultiplier, FRQ questions x individual frqMultipliers)
- **Status:** Partial
- **Evidence:**
  - MCQ multiplier: [apScoringService.js:41-42](src/apBoost/services/apScoringService.js#L41-L42)
  - FRQ multiplier: NOT FOUND
- **Notes:** MCQ multiplier is correctly applied: `const multiplier = section.mcqMultiplier || 1; const points = correct * multiplier`. However, **frqMultiplier is NOT implemented** anywhere in the codebase (grep for "frqMultiplier" returns zero matches). FRQ scores are summed without any per-question multiplier.

### Criterion: Step 3: Calculate TOTAL weighted score (sum all weighted section scores)
- **Status:** Implemented
- **Evidence:** [apScoringService.js:83-95](src/apBoost/services/apScoringService.js#L83-L95)
- **Notes:** Loop through sections, add `result.points` to `totalScore`, add `result.total * multiplier` to `maxScore`

### Criterion: Step 4: Convert to PERCENTAGE (totalWeighted / maxWeighted x 100)
- **Status:** Implemented
- **Evidence:** [apScoringService.js:118](src/apBoost/services/apScoringService.js#L118)
- **Notes:** `const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0`

### Criterion: Step 5: Map to AP SCORE (1-5) using test.scoreRanges
- **Status:** Implemented
- **Evidence:** [apScoringService.js:53-59](src/apBoost/services/apScoringService.js#L53-L59), [apScoringService.js:119](src/apBoost/services/apScoringService.js#L119)
- **Notes:** `calculateAPScore(percentage, scoreRanges)` checks percentage against `scoreRanges.ap5.min`, `ap4.min`, etc. Called with `test.scoreRanges` on line 119.

---

## Section 4.2: MCQ Scoring

### Criterion: 1 point per correct answer (before multiplier)
- **Status:** Implemented
- **Evidence:** [apScoringService.js:35-37](src/apBoost/services/apScoringService.js#L35-L37)
- **Notes:** `if (correctAnswers.includes(studentAnswer)) { correct++ }` - counts each correct answer as 1 point

### Criterion: 0 points for incorrect or unanswered
- **Status:** Implemented
- **Evidence:** [apScoringService.js:35-37](src/apBoost/services/apScoringService.js#L35-L37)
- **Notes:** Implemented implicitly - only increments `correct` counter when answer matches, otherwise no points added

### Criterion: Apply section's mcqMultiplier to raw score
- **Status:** Implemented
- **Evidence:** [apScoringService.js:41-42](src/apBoost/services/apScoringService.js#L41-L42)
- **Notes:** `const multiplier = section.mcqMultiplier || 1; const points = correct * multiplier` - defaults to 1 if not set

### Criterion: Auto-scored immediately on test submit
- **Status:** Implemented
- **Evidence:** [apScoringService.js:67-166](src/apBoost/services/apScoringService.js#L67-L166)
- **Notes:** `createTestResult()` is called on test submission, calculates MCQ scores immediately, creates result document with `score`, `maxScore`, `percentage`, `apScore`

---

## Section 4.3: MCQ_MULTI Partial Credit

### Criterion: If partialCredit: false, all-or-nothing scoring
- **Status:** Missing
- **Evidence:**
  - Field defined: [apQuestionService.js:183](src/apBoost/services/apQuestionService.js#L183)
  - Scoring logic: [apScoringService.js:35-37](src/apBoost/services/apScoringService.js#L35-L37)
- **Notes:** The `partialCredit` field is stored when creating questions, but **the scoring logic does not check this field**. `calculateMCQScore()` only uses `correctAnswers.includes(studentAnswer)` which is single-answer logic. No array comparison for MCQ_MULTI.

### Criterion: If partialCredit: true, partial points based on formula (TBD)
- **Status:** Missing
- **Evidence:** No implementation found
- **Notes:** **NOT IMPLEMENTED.** No partial credit calculation exists. The formula mentioned in criteria (considering correct selections, incorrect selections, missed answers) has no corresponding implementation.

### Criterion: Formula considers: correct selections, incorrect selections, missed answers
- **Status:** Missing
- **Evidence:** No implementation found
- **Notes:** **NOT IMPLEMENTED.** Current scoring only checks if a single student answer is in the correctAnswers array. Does not handle:
  1. Multiple student selections
  2. Partial matches
  3. Incorrect selections reducing score
  4. Missed correct answers

---

## Section 4.4: FRQ Sub-Question Scoring

### Criterion: Each subQuestion graded independently
- **Status:** Implemented
- **Evidence:** [GradingPanel.jsx:145-161](src/apBoost/components/grading/GradingPanel.jsx#L145-L161), [GradingPanel.jsx:199-226](src/apBoost/components/grading/GradingPanel.jsx#L199-L226)
- **Notes:** Teacher UI provides individual input fields for each sub-question score. Each sub-question has its own score input with max points limit.

### Criterion: subScores object stores points per part (e.g., {a: 2, b: 3, c: 1})
- **Status:** Implemented
- **Evidence:** [apGradingService.js:159](src/apBoost/services/apGradingService.js#L159), [GradingPanel.jsx:155-157](src/apBoost/components/grading/GradingPanel.jsx#L155-L157)
- **Notes:** Grade structure documented as `{ [questionId]: { subScores: { a: 2, b: 3 }, comment: "..." } }`. UI updates subScores object on each input change.

### Criterion: Total FRQ question score = sum of subScores
- **Status:** Implemented
- **Evidence:** [apGradingService.js:218-231](src/apBoost/services/apGradingService.js#L218-L231)
- **Notes:** `calculateFRQScore()` iterates through all question grades, sums all values from `questionGrade.subScores`

### Criterion: Apply question's frqMultiplier to total
- **Status:** Missing
- **Evidence:** No implementation found (grep "frqMultiplier" = 0 matches)
- **Notes:** **NOT IMPLEMENTED.** The acceptance criteria specifies per-question FRQ multipliers, but:
  1. No `frqMultiplier` field in test data model
  2. No application of FRQ multipliers in scoring logic
  3. `calculateFRQScore()` simply sums raw subScores without any multiplication

### Criterion: Requires teacher/AI grading
- **Status:** Implemented
- **Evidence:** [apScoringService.js:122-123](src/apBoost/services/apScoringService.js#L122-L123), [apGradingService.js](src/apBoost/services/apGradingService.js)
- **Notes:** `gradingStatus` is set to `PENDING` when test has FRQ sections. Full grading workflow exists via `GradingPanel` and `saveGrade()`.

---

## Section 4.5: AP Score Conversion

### Criterion: Uses test.scoreRanges object
- **Status:** Implemented
- **Evidence:** [apScoringService.js:119](src/apBoost/services/apScoringService.js#L119)
- **Notes:** `const apScore = calculateAPScore(percentage, test.scoreRanges)`

### Criterion: Customizable ranges per test
- **Status:** Implemented
- **Evidence:**
  - Editor: [APTestEditor.jsx:156-193](src/apBoost/pages/APTestEditor.jsx#L156-L193)
  - Storage: [APTestEditor.jsx:315](src/apBoost/pages/APTestEditor.jsx#L315)
- **Notes:** `ScoreRangesEditor` component allows teachers to customize min/max values for each AP score tier. Saved to test document as `scoreRanges`.

### Criterion: Default ranges: ap5: 80-100%, ap4: 65-79%, ap3: 50-64%, ap2: 35-49%, ap1: 0-34%
- **Status:** Implemented
- **Evidence:** [apTypes.js:81-87](src/apBoost/utils/apTypes.js#L81-L87)
- **Notes:**
```javascript
export const DEFAULT_SCORE_RANGES = {
  ap5: { min: 80, max: 100 },
  ap4: { min: 65, max: 79 },
  ap3: { min: 50, max: 64 },
  ap2: { min: 35, max: 49 },
  ap1: { min: 0, max: 34 },
}
```
Matches acceptance criteria exactly.

### Criterion: Percentage falls within range -> maps to AP score
- **Status:** Implemented
- **Evidence:** [apScoringService.js:53-59](src/apBoost/services/apScoringService.js#L53-L59)
- **Notes:** Sequential if-statements check percentage against each tier's min threshold, returning appropriate AP score (5, 4, 3, 2, or 1).

---

## Recommendations

### 1. MCQ_MULTI Partial Credit NOT Implemented (HIGH PRIORITY)

**Current State:**
- `partialCredit` field exists in data model
- `MCQ_MULTI` type constant defined
- **But scoring logic treats MCQ_MULTI same as MCQ (single answer check)**

**Required Implementation:**
1. Update `calculateMCQScore()` to detect MCQ_MULTI question type
2. For MCQ_MULTI with `partialCredit: false`:
   - Compare student's answer array with correctAnswers array
   - Award points only if arrays match exactly (order-independent)
3. For MCQ_MULTI with `partialCredit: true`:
   - Implement partial credit formula (e.g., correct - incorrect, minimum 0)
4. Store student answers as arrays for MCQ_MULTI questions

**Note:** This was also identified in [section_2.1_to_2.3_criteria_audit.md](section_2.1_to_2.3_criteria_audit.md) - the UI doesn't support MCQ_MULTI either.

### 2. FRQ Multipliers NOT Implemented (MEDIUM PRIORITY)

**Current State:**
- MCQ sections have `mcqMultiplier` field (working)
- FRQ questions have NO `frqMultiplier` field
- FRQ raw scores are used without any weighting

**Required Implementation:**
1. Add `frqMultipliers` object to test data model (per-question multipliers)
2. Update `calculateFRQScore()` to apply multipliers
3. Update `createTestResult()` to calculate weighted FRQ max score
4. Add UI in APTestEditor for setting FRQ multipliers per question

### 3. Duplicate AP Score Calculation Functions

**Observation:** `calculateAPScore` is defined in TWO places:
- [apScoringService.js:53-59](src/apBoost/services/apScoringService.js#L53-L59) - accepts custom `scoreRanges`
- [apGradingService.js:238-244](src/apBoost/services/apGradingService.js#L238-L244) - uses hardcoded thresholds

**Risk:** `saveGrade()` in apGradingService.js uses the local version with hardcoded ranges, ignoring test's custom scoreRanges.

**Fix:** Remove duplicate function from apGradingService.js, import from apScoringService.js, and pass test.scoreRanges when recalculating AP score after FRQ grading.

---

## Summary Table

| Section | Criterion | Status |
|---------|-----------|--------|
| 4.1 | Raw score calculation | Implemented |
| 4.1 | Apply multipliers | Partial (MCQ yes, FRQ no) |
| 4.1 | Total weighted score | Implemented |
| 4.1 | Percentage calculation | Implemented |
| 4.1 | AP score mapping | Implemented |
| 4.2 | 1 point per correct MCQ | Implemented |
| 4.2 | 0 points incorrect/unanswered | Implemented |
| 4.2 | mcqMultiplier applied | Implemented |
| 4.2 | Auto-scored on submit | Implemented |
| 4.3 | partialCredit: false all-or-nothing | Missing |
| 4.3 | partialCredit: true partial points | Missing |
| 4.3 | Formula for partial credit | Missing |
| 4.4 | Independent sub-question grading | Implemented |
| 4.4 | subScores object storage | Implemented |
| 4.4 | Sum of subScores | Implemented |
| 4.4 | frqMultiplier applied | Missing |
| 4.4 | Requires teacher grading | Implemented |
| 4.5 | Uses test.scoreRanges | Implemented |
| 4.5 | Customizable ranges | Implemented |
| 4.5 | Default ranges correct | Implemented |
| 4.5 | Percentage to AP mapping | Implemented |
