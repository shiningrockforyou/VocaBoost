# apBoost Code Audit Report
**Date:** January 13, 2026
**Scope:** All 7 phases of apBoost implementation
**Auditor:** Claude Code

---

## Executive Summary

A comprehensive code audit was performed across all 7 phases of the apBoost implementation. **55+ issues** were identified ranging from critical bugs to minor improvements.

| Severity | Count | Action Required |
|----------|-------|-----------------|
| Critical | 7 | Immediate fix required |
| High | 14 | Fix before production |
| Medium | 16 | Fix in next sprint |
| Low | 13 | Nice to have |
| Design/UX | 5 | Future improvement |

**Top 3 concerns:**
1. **Design token violations** - Multiple files use raw Tailwind colors instead of design tokens
2. **Wrong Firestore queries** - apAnalyticsService queries non-existent fields
3. **Type constant mismatches** - Uses lowercase strings instead of QUESTION_TYPE constants

---

## Critical Issues

### C1. Design Token Violations (CLAUDE.md Requirement)

Multiple files violate the design token requirement from CLAUDE.md. Should use tokens like `bg-success`, `bg-error`, `text-text-primary` instead of raw Tailwind.

| File | Lines | Violation |
|------|-------|-----------|
| `utils/performanceColors.js` | 8-12, 84-92, 100-109 | `bg-green-500`, `bg-lime-400`, `text-white`, etc. |
| `hooks/useAnnotations.js` | 7-12 | `bg-yellow-200`, `bg-green-200`, `bg-blue-200` |
| `components/analytics/QuestionDetailModal.jsx` | 8, 11, 15, 24 | `bg-green-50`, `text-green-700`, `bg-red-50` |
| `components/analytics/MCQDetailedView.jsx` | 20 | `text-green-600` |
| `components/tools/Highlighter.jsx` | 22, 40 | `rounded-[--radius-button-sm]` (undefined token) |
| `components/tools/ToolsToolbar.jsx` | 23, 40 | `rounded-[--radius-button-sm]` (undefined token) |
| `components/tools/LineReader.jsx` | 90 | `brand-primary-rgb` CSS var not defined |
| `components/FRQQuestionDisplay.jsx` | 18 | `rounded-[--radius-sm]` (undefined token) |

**Fix:** Replace all raw Tailwind colors with design tokens from `src/index.css`.

---

### C2. Wrong Firestore Query - apAnalyticsService.js

**File:** `services/apAnalyticsService.js`
**Lines:** 48-51

```javascript
// WRONG: Questions don't have a testId field
const questionsQuery = query(
  collection(db, COLLECTIONS.QUESTIONS),
  where('testId', '==', testId)
)
```

**Problem:** Questions are stored in global `ap_questions` collection without a `testId` field. This query returns empty results.

**Fix:** Load questions by IDs referenced in test sections:
```javascript
const questionIds = test.sections.flatMap(s => s.questionIds || [])
// Fetch questions by document IDs instead
```

---

### C3. Wrong Type Checks - apAnalyticsService.js

**File:** `services/apAnalyticsService.js`

| Line | Issue |
|------|-------|
| 93 | Uses `'mcq'` instead of `QUESTION_TYPE.MCQ` |
| 176 | Uses `'frq'`, `'saq'`, `'dbq'` instead of uppercase constants |

**Fix:** Import and use constants from `apTypes.js`:
```javascript
import { QUESTION_TYPE } from '../utils/apTypes'
// Use QUESTION_TYPE.MCQ, QUESTION_TYPE.FRQ, etc.
```

---

### C4. Incorrect Import Path - GradingPanel.jsx

**File:** `components/grading/GradingPanel.jsx`
**Line:** 2

```javascript
// WRONG: Extra level of nesting
import { ... } from '../../services/apGradingService'

// CORRECT: One level up from grading/
import { ... } from '../services/apGradingService'
```

---

### C5. jsPDF Import Syntax

**Files:**
- `utils/generateReportPdf.js:5`
- `utils/generateQuestionsPdf.js:5`

```javascript
// WRONG (may work but inconsistent with jsPDF v2+)
import jsPDF from 'jspdf'

// CORRECT
import { jsPDF } from 'jspdf'
```

---

### C6. FRQ Type Detection - APTestSession.jsx

**File:** `pages/APTestSession.jsx`

| Line | Issue |
|------|-------|
| 151 | Checks `type === 'frq'` instead of `sectionType` |
| 154 | Checks `q.type` instead of `q.questionType` |

**Fix:** Use correct field names per apTypes.js data schema.

---

### C7. Offline Queue FLAG_TOGGLE Not Implemented

**File:** `hooks/useOfflineQueue.js`
**Lines:** 209-210

```javascript
case ACTION_TYPES.FLAG_TOGGLE:
  // TODO: Flags need special handling
  break
```

**Problem:** Flag toggles are queued but never synced to Firestore.

**Fix:** Implement flag sync:
```javascript
case ACTION_TYPES.FLAG_TOGGLE:
  const flagField = `flaggedQuestions.${item.payload.questionId}`
  updates[flagField] = item.payload.flagged
  break
```

---

## High Severity Issues

### H1. APDashboard.jsx:62-65 - Inconsistent Data Structure

**Problem:** Code paths return different structures (`test` vs `item.test`), making data access fragile.

**Fix:** Standardize return structure across all code paths.

---

### H2. useTestSession.js:51 - Missing Null Safety

```javascript
useDuplicateTabGuard(session?.id)
```

**Problem:** When session is null, passes undefined to hook.

**Fix:** Add early return or default value handling in hook.

---

### H3. apScoringService.js:119 - Unsafe Property Access

```javascript
const apScore = calculateAPScore(percentage, test.scoreRanges)
```

**Problem:** `test.scoreRanges` might not exist.

**Fix:** Add fallback: `test.scoreRanges || DEFAULT_SCORE_RANGES`

---

### H4. useOfflineQueue.js:206 - Missing Null Check

```javascript
updates[`answers.${item.payload.questionId}`] = item.payload.value
```

**Problem:** No validation that `item.payload.value` is defined.

**Fix:** Add validation before setting value.

---

### H5. useHeartbeat.js:47 - Race Condition

```javascript
if (sessionData.sessionToken !== instanceToken)
```

**Problem:** Another tab could claim session between reads.

**Fix:** Use Firestore transaction for atomic check-and-update.

---

### H6. GradingPanel.jsx:149 - Reduce Fails on Undefined

```javascript
Object.values(subScores).reduce((a, b) => a + b, 0)
```

**Problem:** Fails if `subScores` is undefined/null.

**Fix:** Add null check: `Object.values(subScores || {}).reduce(...)`

---

### H7. GradingPanel.jsx:184-186 - Type Safety Issue

```javascript
typeof studentAnswer === 'object'
```

**Problem:** Doesn't handle null or array types correctly.

**Fix:** Use more specific type checking.

---

### H8. FRQHandwrittenMode.jsx:56-58 - Missing Validation

**Problem:** Doesn't validate `frqQuestions` is not empty before proceeding.

**Fix:** Add validation check for empty questions array.

---

### H9. APQuestionBank.jsx - Wrong Filter Logic

**Problem:** `addQuestionsToSection` filters by testId but questions don't have this field.

**Fix:** Update function to work with global question bank structure.

---

### H10. APTestEditor.jsx:517 - Incomplete Validation

```javascript
disabled={saving || sections.length === 0}
```

**Problem:** Allows publishing test with empty sections.

**Fix:** Also check `sections.every(s => s.questionIds?.length > 0)`

---

### H11. FRQCard.jsx:193 & generateQuestionsPdf.js:189 - Wrong Property

```javascript
sq.points  // WRONG
sq.maxPoints  // CORRECT per apTypes.js
```

---

### H12. apStorageService.js:204 - Error Code Verification

```javascript
if (error.code !== 'storage/object-not-found')
```

**Problem:** Firebase error code format needs verification.

---

### H13. APExamAnalytics.jsx:385-386 - Incorrect Index Calculation

```javascript
Object.keys(mcqPerformance || {}).indexOf(selectedQuestion) + 1
```

**Problem:** Object key order is unreliable; indexOf on array of keys may give wrong number.

**Fix:** Store/calculate question numbers in performance data.

---

## Medium Severity Issues

| ID | File:Line | Issue |
|----|-----------|-------|
| M1 | useOfflineQueue.js:174 | Missing guard for null session |
| M2 | useAnnotations.js:51,69,86 | Unstable dependency array references |
| M3 | APReportCard.jsx:385 | Timestamp format could fail silently |
| M4 | useTimer.js:19 | initialTime change doesn't reset state |
| M5 | Highlighter.jsx:87 | Fallback may fail if HIGHLIGHT_COLORS incomplete |
| M6 | Highlighter.jsx:206 | Event listener added outside useEffect |
| M7 | ToolsToolbar.jsx:92 | setTimeout not cleaned up on unmount |
| M8 | PassageDisplay.jsx:113 | Missing null check for contentRef |
| M9 | AssignTestModal.jsx:114 | No validation that due date is not in past |
| M10 | APExamAnalytics.jsx:152 | handleClassChange missing loading state |
| M11 | StudentResultsTable.jsx:145-147 | MCQ calculation on every render (perf) |
| M12 | useTestSession.js:142-150 | Timer sync may miss final state |
| M13 | GradingPanel.jsx:175 | Substring may cut mid-word |
| M14 | PerformanceGrid.jsx:69 | Math.min() edge case with empty array |
| M15 | apAnalyticsService.js:112 | Missing question logging for debug |
| M16 | useAnnotations.js:181-205 | No structure validation on load |

---

## Low Severity Issues

| ID | File:Line | Issue |
|----|-----------|-------|
| L1 | APHeader.jsx:17-23 | Missing alt text fallback |
| L2 | InstructionScreen.jsx:10 | Unused `assignment` parameter |
| L3 | QuestionNavigator.jsx:14 | Design token for warning border |
| L4 | APTestSession.jsx:247 | Missing error handling in addToQueue |
| L5 | apGradingService.js:65,121 | Hardcoded 'users' collection |
| L6 | APGradebook.jsx:156 | Potential infinite loop in dependency array |
| L7 | PassageDisplay.jsx:111 | Redundant nested condition |
| L8 | APTestEditor.jsx:309 | Unused sessionStorage cleanup |
| L9 | performanceColors.js | Hardcoded thresholds (should be configurable) |
| L10 | APQuestionBank.jsx:240-263 | Uses alert() instead of toast |
| L11 | APTeacherDashboard.jsx:257,282 | Hardcoded slice limits |
| L12 | useDuplicateTabGuard.js:115-126 | Empty beforeunload handler |
| L13 | FRQQuestionDisplay.jsx:140,193 | Unverified info design tokens |

---

## Missing Functionality

| ID | Description |
|----|-------------|
| MF1 | No toast notifications for success/error states in teacher flow |
| MF2 | PDF export buttons not integrated into APExamAnalytics UI |
| MF3 | No progress tracking feedback for multi-file uploads in handwritten mode |

---

## Recommended Fix Priority

### Immediate (Before Testing)
1. C2 - Fix Firestore query in apAnalyticsService
2. C3 - Fix type constant mismatches
3. C4 - Fix GradingPanel import path
4. C6 - Fix FRQ type detection in APTestSession
5. C7 - Implement FLAG_TOGGLE in offline queue

### Before Production
1. C1 - Fix all design token violations
2. C5 - Fix jsPDF imports
3. H1-H13 - All high severity issues

### Next Sprint
1. M1-M16 - All medium severity issues

### Future Backlog
1. L1-L13 - Low severity issues
2. MF1-MF3 - Missing functionality

---

## Verification Checklist

After fixes are applied:

- [ ] Run `npm run build` - no errors
- [ ] Run `npm run lint` - no new warnings
- [ ] Test MCQ flow end-to-end
- [ ] Test FRQ typed submission
- [ ] Test FRQ handwritten submission
- [ ] Test offline queue sync
- [ ] Test analytics dashboard loads with data
- [ ] Test PDF generation (report + questions)
- [ ] Verify design tokens render correctly in all themes

---

## Files by Phase

### Phase 1 - Foundation
- `utils/apTypes.js`
- `utils/apTestConfig.js`
- `services/apTestService.js`
- `services/apSessionService.js`
- `services/apScoringService.js`
- `hooks/useTimer.js`
- `hooks/useTestSession.js`
- `pages/APDashboard.jsx`
- `pages/APTestSession.jsx`
- `pages/APReportCard.jsx`
- `components/APHeader.jsx`
- `components/InstructionScreen.jsx`
- `components/QuestionDisplay.jsx`
- `components/AnswerInput.jsx`
- `components/QuestionNavigator.jsx`
- `components/ReviewScreen.jsx`
- `components/TestTimer.jsx`

### Phase 2 - Session Resilience
- `hooks/useOfflineQueue.js`
- `hooks/useHeartbeat.js`
- `hooks/useDuplicateTabGuard.js`
- `components/ConnectionStatus.jsx`
- `components/DuplicateTabModal.jsx`
- `components/APErrorBoundary.jsx`
- `components/ErrorFallback.jsx`
- `utils/logError.js`
- `utils/withTimeout.js`

### Phase 3 - FRQ Support
- `components/FRQTextInput.jsx`
- `components/FRQQuestionDisplay.jsx`
- `services/apGradingService.js`
- `components/grading/GradingPanel.jsx`
- `pages/APGradebook.jsx`

### Phase 4 - Annotation Tools
- `hooks/useAnnotations.js`
- `components/tools/Highlighter.jsx`
- `components/tools/LineReader.jsx`
- `components/tools/ToolsToolbar.jsx`
- `components/tools/PassageDisplay.jsx`

### Phase 5 - Teacher Flow
- `services/apTeacherService.js`
- `services/apQuestionService.js`
- `pages/APTeacherDashboard.jsx`
- `pages/APTestEditor.jsx`
- `pages/APQuestionBank.jsx`
- `pages/APQuestionEditor.jsx`
- `pages/APAssignTest.jsx`
- `components/teacher/AssignTestModal.jsx`

### Phase 6 - Handwritten FRQ
- `utils/generateAnswerSheetPdf.js`
- `services/apStorageService.js`
- `components/FileUpload.jsx`
- `components/FRQHandwrittenMode.jsx`

### Phase 7 - Analytics
- `utils/performanceColors.js`
- `services/apAnalyticsService.js`
- `components/analytics/FilterBar.jsx`
- `components/analytics/MCQSquare.jsx`
- `components/analytics/PerformanceGrid.jsx`
- `components/analytics/QuestionDetailModal.jsx`
- `components/analytics/FRQCard.jsx`
- `components/analytics/MCQDetailedView.jsx`
- `components/analytics/StudentResultsTable.jsx`
- `pages/APExamAnalytics.jsx`
- `utils/generateReportPdf.js`
- `utils/generateQuestionsPdf.js`

---

*End of Audit Report*
