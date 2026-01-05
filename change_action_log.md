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
| 2026-01-04 | `src/utils/testConfig.js` | **NEW FILE** - Centralized test configuration builder with `buildTestConfig()` function. Single source of truth for test parameters, applies testSizeNew limiting to word pools. |
| 2026-01-04 | `src/pages/DailySessionFlow.jsx` | Added import for `buildTestConfig`; Updated `navigateToTest()` to build testConfig and pass as single object (words now limited by testSizeNew before navigation) |
| 2026-01-04 | `src/pages/MCQTest.jsx` | Refactored to consume `testConfig` from navigation state with backwards compatibility for legacy props; Added testConfig path in `loadTestWords()` |
| 2026-01-04 | `src/pages/TypedTest.jsx` | Refactored to consume `testConfig` from navigation state with backwards compatibility for legacy props; Added testConfig path in `loadTestWords()` |
| 2026-01-04 | `src/pages/DailySessionFlow.jsx` | **Navigation Simplification** - Simplified `CompletePhase` to single "Back to Dashboard" button; Removed unused props (`onMoveOn`, `onNext`, `onRetakeReview`); Removed retake warning box |
| 2026-01-04 | `src/pages/DailySessionFlow.jsx` | Removed `showMoveOnConfirm` and `showNextSessionModal` state variables; Deleted Move On Confirmation and Next Session modals |
| 2026-01-04 | `src/pages/DailySessionFlow.jsx` | Removed unused `handleRetakeReviewTest` function |
| 2026-01-04 | `src/pages/MCQTest.jsx` | Changed quit handler to always navigate to `/` (Dashboard) instead of `returnPath` |
| 2026-01-04 | `src/pages/MCQTest.jsx` | Replaced "Study" button with "Dashboard" on failed new word tests |
| 2026-01-04 | `src/pages/MCQTest.jsx` | Added "Dashboard" button to needs-work and critical review test tiers (alongside Retake) |
| 2026-01-04 | `src/pages/MCQTest.jsx` | Removed unused `handleGoToStudy` function |
| 2026-01-04 | `src/pages/TypedTest.jsx` | Changed quit handler to always navigate to `/` (Dashboard) instead of `returnPath` |
| 2026-01-04 | `src/pages/TypedTest.jsx` | Replaced "Study" button with "Dashboard" on failed new word tests |
| 2026-01-04 | `src/pages/TypedTest.jsx` | Added "Dashboard" button to needs-work and critical review test tiers (alongside Retake) |
| 2026-01-04 | `src/pages/TypedTest.jsx` | Removed unused `handleGoToStudy` function |
| 2026-01-04 | `NAVIGATION_AUDIT.md` | **NEW FILE** - Comprehensive navigation audit documenting all 68 navigation elements across 21 files, including button destinations, redirects, and 3 dead route issues |
| 2026-01-04 | `scripts/migrateWordPositions.js` | **NEW FILE** - One-time migration script to add `position` field to existing words based on `createdAt` order |
| 2026-01-04 | `src/services/db.js` | **Word Position Refactor** - `addWordToList()` now assigns `position: currentCount` (0-indexed) to new words |
| 2026-01-04 | `src/services/db.js` | **Word Position Refactor** - `batchAddWords()` now assigns sequential positions starting from current wordCount |
| 2026-01-04 | `src/services/db.js` | **Word Position Refactor** - `fetchAllWords()` changed `orderBy('createdAt', 'asc')` → `orderBy('position', 'asc')` |
| 2026-01-04 | `src/services/studyService.js` | **Word Position Refactor** - `getSegmentWords()` uses `orderBy('position')` and filters by `w.position` instead of computed `wordIndex` |
| 2026-01-04 | `src/services/studyService.js` | **Word Position Refactor** - `initializeNewWordStates()` uses `word.position` instead of `word.wordIndex` |
| 2026-01-04 | `src/services/studyService.js` | **Word Position Refactor** - `getFailedFromPreviousNewWords()` uses `orderBy('position')` and filters by `w.position` |
| 2026-01-04 | `src/services/studyService.js` | **Word Position Refactor** - `getNewWords()` uses `orderBy('position')` and filters by position range |
| 2026-01-04 | `src/services/studyService.js` | **Word Position Refactor** - `getBlindSpotPool()` uses `orderBy('position')` instead of `createdAt` |
| 2026-01-04 | `src/pages/ListEditor.jsx` | **Word Position Refactor** - All 3 word queries changed from `orderBy('createdAt')` to `orderBy('position')` |
| 2026-01-04 | `src/pages/MCQTest.jsx` | **Word Position Refactor** - Fallback query uses `orderBy('position')`, removed dynamic `wordIndex` assignment |
| 2026-01-04 | `src/pages/TypedTest.jsx` | **Word Position Refactor** - Fallback query uses `orderBy('position')`, removed dynamic `wordIndex` assignment |
| 2026-01-04 | `src/pages/DailySessionFlow.jsx` | **Word Position Refactor** - Removed `wordIndex` mapping; words already have `position` field |
| 2026-01-04 | `src/utils/pdfGenerator.js` | **Word Position Refactor** - Changed `word.wordIndex ?? word.index` to `word.position` for word numbering |
| 2026-01-04 | `src/pages/Dashboard.jsx` | **Performance** - Parallelized progress data loading using `Promise.all` instead of sequential `for...await` loops (lines 543-586) |
| 2026-01-04 | `src/components/dev/SegmentDebugPanel.jsx` | **NEW FILE** - Collapsible debug panel showing segment boundaries, session config, and word-level queue details |
| 2026-01-04 | `src/services/studyService.js` | Added `getDebugSessionData()` export for debug panel - returns sessionConfig, reviewQueue, and segmentWords |
| 2026-01-04 | `src/pages/Dashboard.jsx` | Added SegmentDebugPanel component to list cards (dev-only via `import.meta.env.DEV`) |
| 2026-01-04 | `src/services/studyService.js` | **Full Segment PDF** - `getTodaysBatchForPDF()` now uses `getSegmentWords()` instead of `buildReviewQueue()` to show ALL segment words |
| 2026-01-04 | `src/pages/DailySessionFlow.jsx` | **Full Segment Study** - Session initialization and `moveToReviewPhase()` now use `getSegmentWords()` for REVIEW_STUDY phase |
| 2026-01-04 | `src/services/studyService.js` | **Bug Fix** - `getDebugSessionData()` now transforms assignment with `weeklyPace = pace * studyDaysPerWeek` (matching `getTodaysBatchForPDF` pattern) |
| 2026-01-04 | `src/pages/DailySessionFlow.jsx` | **Bug Fix** - Fixed "No Test Content" error on review tests: `navigateToTest()` now passes `reviewQueue` instead of `null` for review test wordPool (line 1014) |
| 2026-01-04 | `src/pages/MCQTest.jsx` | **Shuffle Fix** - Added `shuffleArray` import; Fixed biased distractor selection and option ordering to use Fisher-Yates instead of `sort(() => Math.random() - 0.5)` (lines 195, 206) |
| 2026-01-04 | `src/pages/TypedTest.jsx` | **Shuffle Fix** - Fixed biased retake shuffle to use `shuffleArray()` instead of `sort(() => Math.random() - 0.5)` (line 650) |
| 2026-01-04 | `src/services/studyService.js` | **Shuffle Fix** - Added `shuffleArray` import; Fixed biased graduation selection to use Fisher-Yates instead of `sort(() => Math.random() - 0.5)` (line 781) |
| 2026-01-05 | `src/services/studyService.js` | **Bug Fix** - `graduateSegmentWords()` now writes `wordIndex` and `listId` to Firebase batch (lines 802-803). Debug panel's `getMasteredWordsInRange()` filters by `wordIndex`, so graduated words were invisible without this field. |

---

## Phase 4: Word Position Field Refactor

**Date:** 2026-01-04

### Problem Statement

Word indices were computed at runtime from array position after `orderBy('createdAt', 'asc')`. This design was fragile because:
- Timestamps can be inconsistent (imports, clock skew, simultaneous adds)
- "#435 of List X" didn't point to anything specific - it was just the 435th item after sorting
- Any timestamp issues would silently corrupt word order and break segment boundaries

### Solution: Explicit `position` Field

Added permanent `position: number` field to all word documents. Words are now:
- Assigned sequential 0-indexed positions on creation
- Queried by `orderBy('position', 'asc')` instead of `createdAt`
- Filtered directly by `w.position` instead of computed array index

### New Word Document Structure

```javascript
{
  id: "abc123",
  word: "Abate",
  definition: "...",
  position: 0,        // NEW: Permanent, explicit position (0-indexed)
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### CRUD Changes

**`addWordToList()` (db.js):**
```javascript
const listDoc = await getDoc(doc(db, 'lists', listId))
const currentCount = listDoc.exists() ? (listDoc.data()?.wordCount ?? 0) : 0
const wordPayload = {
  ...wordData,
  position: currentCount,  // 0-indexed position
  createdAt: serverTimestamp(),
}
```

**`batchAddWords()` (db.js):**
```javascript
let nextPosition = listDoc.data()?.wordCount ?? 0
// Each word in batch gets sequential position
position: nextPosition++
```

### Query Changes

All `orderBy('createdAt', 'asc')` changed to `orderBy('position', 'asc')`:

| File | Function/Location |
|------|-------------------|
| `db.js` | `fetchAllWords()` |
| `studyService.js` | `getSegmentWords()`, `getFailedFromPreviousNewWords()`, `getNewWords()`, `getBlindSpotPool()` |
| `ListEditor.jsx` | `loadList()`, `reloadWords()`, `handleAddWord()` |
| `MCQTest.jsx` | Fallback load |
| `TypedTest.jsx` | Fallback load |

### Index Pattern Removal

All `.map((doc, index) => ({ wordIndex: index, ... }))` patterns changed to read `position` from document:

```javascript
// BEFORE:
const allWords = wordsSnap.docs.map((doc, index) => ({
  id: doc.id,
  wordIndex: index,
  ...doc.data()
}))
const segmentWords = allWords.filter(w => w.wordIndex >= startIndex)

// AFTER:
const allWords = wordsSnap.docs.map((doc) => ({
  id: doc.id,
  ...doc.data()
}))
const segmentWords = allWords.filter(w => w.position >= startIndex)
```

### Migration Script

**File:** `scripts/migrateWordPositions.js`

One-time script to backfill `position` field on existing words:
1. Fetches all lists
2. For each list, gets words ordered by `createdAt`
3. Assigns sequential positions (0, 1, 2, ...)
4. Batch updates all word documents

Must be run once before deploying the code changes.

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Index base | 0-indexed | Matches JavaScript array semantics, simpler math |
| Gap handling | Allow gaps | Simpler than cascade updates on delete; filter logic handles gaps |
| Position on delete | No change | Gaps are fine; wordCount decrements but positions stay stable |
| Position on update | Preserved | updateDoc merges, doesn't overwrite position |

### Files Modified

| File | Changes |
|------|---------|
| `scripts/migrateWordPositions.js` | NEW - Migration script |
| `src/services/db.js` | `addWordToList`, `batchAddWords`, `fetchAllWords` |
| `src/services/studyService.js` | 5 functions updated (orderBy + position field) |
| `src/pages/ListEditor.jsx` | 3 query locations |
| `src/pages/MCQTest.jsx` | Fallback query |
| `src/pages/TypedTest.jsx` | Fallback query |
| `src/pages/DailySessionFlow.jsx` | Removed wordIndex mapping |
| `src/utils/pdfGenerator.js` | Word number from position |

### Backups

All modified files backed up to `vocaboost/backups/position-refactor/` before changes.

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
