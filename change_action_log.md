# Change Action Log

> **Instructions for Claude:** Log every code change you make to this file. Add a new row for each modification with the date, file path, and a brief description of what changed. This helps track all modifications across sessions.

| Date | File | Change |
|------|------|--------|
| 2026-01-02 | `src/pages/Dashboard.jsx` | Removed Panic Mode warning banner (lines 1300-1312) |
| 2026-01-02 | `src/pages/DailySessionFlow.jsx` | Fixed daily pace calculation - changed `pace * 7` to `pace * studyDaysPerWeek` (line 467) |
| 2026-01-02 | `src/pages/ClassDetail.jsx` | Added `studyDaysPerWeek` setting to Edit List Settings modal |
| 2026-01-03 | `src/services/db.js` | Fixed duplicate class fetches in `fetchUserAttempts` - now caches `assignedLists` (lines 2610-2667) |
| 2026-01-03 | `src/services/db.js` | Fixed `removeStudentFromClass` to also remove from user's `enrolledClasses` (lines 259-268) |
| 2026-01-03 | `src/services/db.js` | Added `testType` parameter to `submitTestAttempt` function (line 1313) |
| 2026-01-03 | `src/services/db.js` | Fixed `joinClass` to verify user document exists before proceeding (lines 795-797) |
| 2026-01-03 | `src/services/studyService.js` | Fixed `buildReviewQueue` to fetch today's failed words directly by ID instead of filtering from segment (lines 481-500) |
| 2026-01-03 | `src/services/studyService.js` | Added blind spot count caching to `getBlindSpotPool` and `getBlindSpotCount` for efficiency |
| 2026-01-03 | `src/pages/Dashboard.jsx` | Updated `getBlindSpotCount` call to pass `classId` for caching (line 529) |
| 2026-01-03 | `src/services/db.js` | Optimized `fetchDashboardStats` to use Firestore orderBy + limit(1) for latest attempt instead of client-side sort (lines 396-402) |
| 2026-01-03 | `src/services/db.js` | Optimized `fetchUserAttempts` to use Firestore orderBy for sorted results, removed client-side sort (lines 2592-2686) |
| 2026-01-03 | `src/pages/ClassDetail.jsx` | Added `passThreshold` and `testSizeNew` to Edit List Settings modal |
| 2026-01-03 | `src/components/AssignListModal.jsx` | Added `passThreshold` and `testSizeNew` to initial assignment settings |
| 2026-01-03 | `src/services/db.js` | Updated `assignListToClass` to accept and save `passThreshold` and `testSizeNew` |
| 2026-01-03 | `src/pages/MCQTest.jsx` | Read `passThreshold` and `testOptionsCount` from assignment instead of hardcoded values |
| 2026-01-03 | `src/pages/TypedTest.jsx` | Read `passThreshold` from assignment instead of hardcoded value |
| 2026-01-03 | `src/pages/DailySessionFlow.jsx` | Fixed `interventionLevel: undefined` error by adding default value of 0 (line 976) |
| 2026-01-03 | `src/services/progressService.js` | Added duplicate day completion guard - blocks re-submission if dayNumber doesn't match expected next day (lines 98-103) |
| 2026-01-03 | `src/services/db.js` | **Box Removal Migration** - Fixed retention calculation to use test score directly instead of filtering by box >= 4 |
| 2026-01-03 | `src/services/db.js` | Fixed mastery count in `fetchDashboardStats` to use `status === 'PASSED'` instead of `box >= 4` |
| 2026-01-03 | `src/services/db.js` | Fixed words learned count in `fetchStudentAggregateStats` to use status instead of box |
| 2026-01-03 | `src/services/db.js` | Removed box updates from `submitTestAttempt` and `submitTypedTestAttempt` - status updates handled by processTestResults |
| 2026-01-03 | `src/services/db.js` | Fixed challenge bug in `reviewChallenge` - now updates status to PASSED instead of box |
| 2026-01-03 | `src/services/db.js` | Deleted unused box functions: `computeNextReview`, `nextBoxValue`, `saveStudyResult` |
| 2026-01-03 | `src/services/db.js` | Deleted unused legacy test generators: `generateTest`, `generateTypedTest` |
| 2026-01-03 | `src/services/db.js` | Simplified `normalizeStudyState` to just merge defaults with document |
| 2026-01-03 | `src/types/studyTypes.js` | Removed legacy box-related JSDoc comments |
| 2026-01-03 | `src/services/db.js` | Added day progression trigger in `reviewChallenge` when challenge acceptance pushes score above threshold (lines 2544-2589) |
| 2026-01-03 | `src/services/studyService.js` | Fixed PDF pace calculation - changed `pace * 7` to `pace * studyDaysPerWeek` in `getTodaysBatchForPDF` and `getCompleteBatchForPDF` |
| 2026-01-03 | `src/services/studyService.js` | Added failed carryover words to `getTodaysBatchForPDF` - returns structured `{ newWords, failedCarryover, reviewWords }` |
| 2026-01-03 | `src/utils/pdfGenerator.js` | Updated `downloadListAsPDF` to handle structured format with demarcated sections for new words vs failed carryover |
| 2026-01-03 | `src/pages/DailySessionFlow.jsx` | Updated PDF handler to preserve structured format when calling `downloadListAsPDF` |
| 2026-01-03 | `src/pages/Dashboard.jsx` | Updated PDF handler to preserve structured format when calling `downloadListAsPDF` |
| 2026-01-03 | `src/utils/pdfGenerator.js` | Added logo image to PDF header with aspect-ratio-preserving sizing (fixed 10mm height, auto width) |
| 2026-01-03 | `src/utils/pdfGenerator.js` | Changed column widths to responsive: `wrap` for #/Word/POS, `auto` for Definition/Sample |
| 2026-01-03 | `src/utils/pdfGenerator.js` | Added `rowPageBreak: 'avoid'` to prevent table rows from splitting across pages |
| 2026-01-03 | `src/utils/studyAlgorithm.js` | Rewrote `calculateSegment` function - now uses intervention-adjusted projection with week-based segment rotation instead of cumulative days 2-4 logic |
| 2026-01-03 | `src/utils/studyAlgorithm.js` | Commented out `EARLY_DAYS_THRESHOLD` constant (no longer needed) |
| 2026-01-03 | `src/utils/studyAlgorithm.js` | Added legacy `calculateSegment` as comment block for reference |
| 2026-01-03 | `src/services/studyService.js` | Updated `calculateSegment` call to pass `dailyPace` and `interventionLevel` parameters (lines 81-87) |
| 2026-01-03 | `src/utils/studyAlgorithm.js` | Updated review test size constants from 20-50 to 30-60 |
| 2026-01-03 | `src/utils/studyAlgorithm.js` | Updated `calculateReviewTestSize` to accept optional `minSize` and `maxSize` parameters for teacher-configurable ranges |
| 2026-01-03 | `src/pages/DailySessionFlow.jsx` | Removed failed carryover mixing - NEW_WORDS phase now shows only new words (failed words handled via segment review priority) |
| 2026-01-03 | `src/components/AssignListModal.jsx` | Added review test settings: `reviewTestType`, `reviewTestSizeMin`, `reviewTestSizeMax` |
| 2026-01-03 | `src/pages/ClassDetail.jsx` | Added review test settings section to Edit List Settings modal |
| 2026-01-03 | `src/services/db.js` | Updated `assignListToClass` to accept and save review test settings |
| 2026-01-03 | `src/services/db.js` | Updated `updateAssignmentSettings` to handle review test settings validation |
| 2026-01-03 | `src/pages/DailySessionFlow.jsx` | Updated `goToReviewTest` to use `reviewTestType` from assignment settings |
| 2026-01-03 | `src/utils/pdfGenerator.js` | Added reviewWords section with green header (#22C55E) and light green table background (#DCFCE7) |
| 2026-01-03 | `session-time-calculator.html` | Added synchronized slider + textbox inputs for all parameters (pace, test sizes, intervention, time constants, pool settings, algorithm constants) |
| 2026-01-03 | `session-time-calculator.html` | Added Graduation Model section with dynamic calculation of avg tests to graduate based on student accuracy (%), consecutive correct needed, and new test bonus checkbox |
| 2026-01-03 | `src/types/studyTypes.js` | Added `MASTERED` and `NEEDS_CHECK` to `WORD_STATUS` enum for graduation system |
| 2026-01-03 | `src/types/studyTypes.js` | Added `masteredAt` and `returnAt` fields to `DEFAULT_STUDY_STATE` |
| 2026-01-03 | `src/services/studyService.js` | Added `graduateSegmentWords()` - graduates X% of PASSED words where X = review test score |
| 2026-01-03 | `src/services/studyService.js` | Added `returnMasteredWords()` - returns MASTERED words to NEEDS_CHECK after 21 days |
| 2026-01-03 | `src/pages/DailySessionFlow.jsx` | Added `returnMasteredWords` call before session initialization |
| 2026-01-03 | `src/pages/DailySessionFlow.jsx` | Added `graduateSegmentWords` call after review test in `completeSession` |
| 2026-01-03 | `src/pages/MCQTest.jsx` | Fixed retake shuffling - now re-shuffles words using `selectTestWords()` to avoid identical test order |
| 2026-01-03 | `src/components/DismissedWordsDrawer.jsx` | NEW: Right-side drawer component for viewing/restoring dismissed words |
| 2026-01-03 | `src/pages/DailySessionFlow.jsx` | Added dismissed words drawer with undo functionality - stores full word data on dismiss, toggle button in header, restore individual or all |
| 2026-01-04 | `src/pages/MCQTest.jsx` | Fixed challenge bug - capture `attemptId` from `submitTestAttempt` return value and call `setAttemptId(result.id)` |
| 2026-01-04 | `src/pages/TypedTest.jsx` | Fixed challenge bug - capture `attemptId` from `submitTypedTestAttempt` return value and call `setAttemptId(result.id)` |

---

## Phase 3: Mastery Graduation System (% Culling Approach)

**Date:** 2026-01-03

### Problem Statement

Without a graduation mechanism, the review pool grows unboundedly as students learn new words each day. At 80 words/day, 5 days/week = 400 words/week with zero graduation means:
- Week 4: Pool = 1,600 words
- Week 8: Pool = 3,200 words
- Review becomes impossible to complete in reasonable time

### Solution: % Culling Graduation

After each review test, graduate **X% of PASSED words** in the segment, where **X = test score**.

```
Review test score = 80%
→ Fetch all PASSED words in today's segment
→ Randomly select 80% of them to graduate
→ Update selected words to MASTERED status
→ FAILED words always stay in pool (safety net)
```

### Why % Culling (vs Individual Streak Tracking)

| Approach | Complexity | Trigger | Per-Word Tracking |
|----------|------------|---------|-------------------|
| Streak (old design) | High | Every test result | `correctStreak` field |
| **% Culling (implemented)** | **Low** | **After review test only** | **None needed** |

**Key insight:** FAILED words provide the safety net. We're graduating from words the student got RIGHT on the test - the test itself is the verification. No need for additional per-word streak tracking.

### Design Decisions

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Graduation trigger | After review test | Segment-level, not per-word |
| Graduation rate | X% where X = test score | Proportional to demonstrated knowledge |
| Pool for graduation | PASSED words in segment | All segment PASSED words, not just tested |
| FAILED words | Never graduate | Safety net - always stay for more practice |
| Return delay | 21 days | Matches existing blind spot threshold |
| Conservative rounding | `Math.floor` | Avoid over-graduating on small pools |

### New Status Values

```javascript
export const WORD_STATUS = {
  NEW: 'NEW',
  NEVER_TESTED: 'NEVER_TESTED',
  FAILED: 'FAILED',
  PASSED: 'PASSED',
  MASTERED: 'MASTERED',      // NEW: Graduated from review pool
  NEEDS_CHECK: 'NEEDS_CHECK' // NEW: Returned from MASTERED after 21 days
};
```

### Study State Document Changes

```javascript
// Added to DEFAULT_STUDY_STATE:
{
  masteredAt: null,    // Timestamp when word became MASTERED
  returnAt: null       // Timestamp when word should return (masteredAt + 21 days)
}
```

### Core Functions Implemented

#### `graduateSegmentWords(userId, listId, segment, testScore)`
**Location:** `src/services/studyService.js` (lines 745-793)

1. Fetches all segment words with current status
2. Filters to PASSED words only (excludes FAILED, NEVER_TESTED, MASTERED, NEEDS_CHECK)
3. Calculates graduation count: `Math.floor(passedWords.length * testScore)`
4. Randomly selects words to graduate (Fisher-Yates shuffle + slice)
5. Batch updates selected words to MASTERED status with 21-day return timestamp
6. Returns `{ graduated: number, remaining: number }`

#### `returnMasteredWords(userId, listId)`
**Location:** `src/services/studyService.js` (lines 803-829)

1. Queries for MASTERED words where `returnAt <= now`
2. Batch updates them to NEEDS_CHECK status
3. Clears `masteredAt` and `returnAt` fields
4. Returns count of words returned to pool

### Integration Points

**Session Initialization (DailySessionFlow.jsx line 477):**
```javascript
// Return any MASTERED words that have passed their 21-day period
await returnMasteredWords(user.uid, listId)
```

**Session Completion (DailySessionFlow.jsx lines 997-1008):**
```javascript
// Graduate percentage of PASSED words from segment after review test
if (sessionConfig?.segment && reviewTestResults?.score !== undefined) {
  graduationResult = await graduateSegmentWords(
    user.uid,
    listId,
    sessionConfig.segment,
    reviewTestResults.score
  )
}
```

### Pool Dynamics (Projected at 80% Accuracy)

**Scenario: 80 words/day, 5 days/week = 400 words/week**

| Week | Inflow | Segment PASSED | Graduate (80%) | Net Pool Growth |
|------|--------|----------------|----------------|-----------------|
| 1 | 400 | ~256 | ~205 | +195 |
| 2 | 400 | ~320 | ~256 | +144 |
| 3 | 400 | ~350 | ~280 | +120 |
| 4 | 400 | ~360 | ~288 | +112 (+ returns) |
| 8+ | 400 | ~400 | ~320 | Stabilizes ~800-1000 |

**Key insight:** Weekly graduation rate ≈ `score × PASSED% × inflow` = 0.80 × 0.80 × 400 = **256 words/week**

With 400 inflow and ~256 graduation, pool grows slowly then stabilizes when returns balance.

### Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| No PASSED words in segment | Returns `{ graduated: 0, remaining: 0 }` |
| 100% test score | Graduates all PASSED words in segment |
| 0% test score | Graduates 0 words (all stay for practice) |
| All segment words MASTERED | No PASSED words to graduate, early return |
| Day 1 (no segment) | Skip review phases, no graduation call |
| Small pool (e.g., 3 words at 85%) | `Math.floor(3 * 0.85) = 2` (conservative) |
| NEEDS_CHECK word passes test | Status → PASSED; then eligible for graduation |
| NEEDS_CHECK word fails test | Status → FAILED; stays in pool |

### Files Modified

| File | Changes |
|------|---------|
| `src/types/studyTypes.js` | Added `MASTERED`, `NEEDS_CHECK` to `WORD_STATUS`; Added `masteredAt`, `returnAt` to `DEFAULT_STUDY_STATE` |
| `src/services/studyService.js` | Added `graduateSegmentWords()` and `returnMasteredWords()` functions |
| `src/pages/DailySessionFlow.jsx` | Added imports; Call `returnMasteredWords()` on init; Call `graduateSegmentWords()` after review test |

### Files NOT Needing Changes

- `src/utils/studyAlgorithm.js` - Segments still use `totalWordsIntroduced` (stable boundaries)
- `src/services/db.js` - `normalizeStudyState()` already spreads `DEFAULT_STUDY_STATE`
- `processTestResults()` - Kept as-is (just updates PASSED/FAILED)
- Test components - No changes needed

### Future Enhancements (Not Yet Implemented)

1. **Graduation Feedback UI** - Show user how many words graduated after review test
2. **Dashboard Mastered Count** - Add mastered word count alongside "Learned" count
3. **Progress Visualization** - Progress ring showing New → Active → Mastered percentages
