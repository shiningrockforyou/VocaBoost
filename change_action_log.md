# Change Action Log

> **Instructions for Claude:** Log every code change you make to this file. Add a new row for each modification with the date, file path, and a brief description of what changed. This helps track all modifications across sessions.

| Date | File | Change |
|------|------|--------|
| 2026-05-31 | `public/help-teacher-ko.html`, `public/help-teacher-en.html` | Resectioned both teacher guides to front-load top TA tasks: moved Gradebook from 6th to 3rd (now: 1 Getting Started, 2 TA/Admin Access, 3 Gradebook, 4 Class Management, 5 Word List Management, 6 Assigning Word Lists, 7 FAQ). Renumbered TOC, section-number spans, and section comments. EN file was missing the TA/Admin Access section so added it as section 2 (translated from KO) to keep the two files parallel. No prose rewrites. |
| 2026-06-01 | `CODE_REVIEW_2026-06-01.md` | Added full multi-agent code audit report (vocaBoost excl. apBoost): 72 verified findings (0 blocker / 7 high), severity-ranked + systemic patterns |
| 2026-05-31 | `scripts/seed-26sm-classes.js` | Created seeder that creates 28 26SM SAT classes in production with appropriate Base Camp (pace=60, size=25, threshold=90) or Ascent (pace=80, size=30, threshold=92) tier defaults; auto-assigns the matching VZIP 3K list; auto-detects weekend ([주말]) classes for studyDaysPerWeek=2 |
| 2026-05-31 | Firebase production | Created 28 26SM SAT classes via seed-26sm-classes.js (16 Base Camp / 12 Ascent); each with auto-generated unique 6-char joinCode, veterans@vocaboost.com as ownerTeacherId, list assignment baked in. Join codes recorded in audit/playwright/seeded_26sm_classes.json (gitignored) |
| 2026-05-31 | `.gitignore` | Added pattern `audit/playwright/seeded_*.json` so the new 26SM class output file (with join codes) doesn't get committed |
| 2026-05-31 | `scripts/update-26sm-classes.js` | Created script + updated all 28 26SM SAT class assignments to corrected tier definitions: BRIDGE pace 60 (3 classes), INT/CORE pace 80 (12), ADV/Top pace 80 (10), FINAL pace 100 (3). Set testOptionsCount=6 for all (6-choice MCQ review). testMode=typed and reviewTestType=mcq preserved across all. studyDaysPerWeek preserved (2 for [주말], 5 otherwise) |
| 2026-05-31 | `scripts/update-26sm-classes.js` + Firebase | Bumped FINAL tier testSizeNew from 30 → 35; reran update across all 28 (effective change on 3 FINAL classes only) |
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
| 2026-01-14 | `src/pages/DailySessionFlow.jsx` | Fixed test recovery sessionContext - added missing fields (segment, interventionLevel, wordsIntroduced, wordsReviewed, newWordStartIndex, newWordEndIndex) to prevent TWI reconciliation failures |
| 2026-01-14 | `scripts/export-attempts.js` | Created script to export all Firestore attempts to flattened JSON |
| 2026-01-14 | `scripts/export-users.js` | Created script to export all Firestore users to flattened JSON |
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
| 2026-01-09 | `src/pages/DailySessionFlow.jsx` | Added `newWordStartIndex` and `newWordEndIndex` to sessionContext (lines 1062-1063) |
| 2026-01-09 | `src/services/db.js` | Added `sessionContext` parameter to `submitTestAttempt` function (line 1003) |
| 2026-01-09 | `src/services/db.js` | Added 9 flattened session context fields to `submitTestAttempt` attemptData: `isFirstDay`, `listTitle`, `segmentStartIndex`, `segmentEndIndex`, `interventionLevel`, `wordsIntroduced`, `wordsReviewed`, `newWordStartIndex`, `newWordEndIndex` (lines 1064-1073) |
| 2026-01-12 | `src/utils/sessionStepTracker.js` | **NEW FILE** - Centralized step calculation utility with `getSessionStep()` function. Returns `{ stepNumber, totalSteps, stepText }` based on phase or testType. |
| 2026-01-12 | `src/utils/sessionStepTracker.js` | Fixed switch cases to use lowercase phase constants (`'new_words'`, `'review_study'`, `'complete'`) instead of uppercase |
| 2026-01-12 | `src/pages/MCQTest.jsx` | Replaced custom header (lines 1037-1072) with SessionHeader component on active test screen; Added step tracker import and usage |
| 2026-01-12 | `src/pages/MCQTest.jsx` | Updated results screen to use `getSessionStep()` utility instead of inline calculation (lines 730-731) |
| 2026-01-12 | `src/pages/TypedTest.jsx` | Updated active test screen and results screen to use `getSessionStep()` utility instead of inline calculation (lines 780-781, 1079-1080, 1122-1124) |
| 2026-01-12 | `src/pages/DailySessionFlow.jsx` | Updated to use `getSessionStep()` utility instead of inline calculation (lines 1558-1567) |
| 2026-01-12 | `src/pages/TypedTest.jsx` | **Review Test UX** - Updated button labels for all 4 tiers: Excellent → "Continue" (was "Return to Dashboard"); Good → swapped button order; Needs Work & Critical → "Review Again" + "Continue" (was "Retake Test" + "Dashboard") |
| 2026-01-12 | `src/pages/TypedTest.jsx` | **Review Test UX** - "Review Again" button now navigates with `goToStudy: true` state to return user to review study flashcards instead of retaking test |
| 2026-01-12 | `src/pages/MCQTest.jsx` | **Review Test UX** - Updated button labels for all 4 tiers: Excellent → "Continue"; Good → swapped button order; Needs Work & Critical → "Review Again" + "Continue" |
| 2026-01-12 | `src/pages/MCQTest.jsx` | **Review Test UX** - "Review Again" button now navigates with `goToStudy: true` state to return user to review study flashcards instead of retaking test |
| 2026-01-09 | `src/services/db.js` | Added `sessionContext` parameter to `submitTypedTestAttempt` function (line 1121) |
| 2026-01-09 | `src/services/db.js` | Added 9 flattened session context fields to `submitTypedTestAttempt` attemptData (lines 1215-1224) |
| 2026-01-09 | `src/pages/MCQTest.jsx` | Pass `sessionContext` to `submitTestAttempt` call (line 539) |
| 2026-01-09 | `src/pages/TypedTest.jsx` | Pass `sessionContext` to `submitTypedTestAttempt` call (line 636) |
| 2026-01-09 | `src/services/db.js` | **Solution #3** - Added `isTransientError()` helper to identify retryable Firebase errors (lines 44-55) |
| 2026-01-09 | `src/services/db.js` | **Solution #3** - Added `addJitter()` helper for exponential backoff randomization (lines 57-61) |
| 2026-01-09 | `src/services/db.js` | **Solution #3** - Added `withRetry()` generic retry wrapper with exponential backoff and logging (lines 63-109) |
| 2026-01-09 | `src/services/db.js` | **Solution #3** - Added `logSystemEvent()` for anomaly logging to `system_logs` collection (lines 111-125) |
| 2026-01-09 | `src/services/db.js` | **Solution #3** - Added `listId` parameter to `submitTestAttempt()` and `submitTypedTestAttempt()` |
| 2026-01-09 | `src/pages/MCQTest.jsx` | **Solution #3** - Wrapped `submitTestAttempt()` with `withRetry()` for transient failure recovery |
| 2026-01-09 | `src/pages/MCQTest.jsx` | **Solution #3** - Added `submitError` state and error UI with "Try Again" button |
| 2026-01-09 | `src/pages/MCQTest.jsx` | **Solution #3** - Added `beforeunload` handler to warn before leaving with unsaved answers |
| 2026-01-09 | `src/pages/TypedTest.jsx` | **Solution #3** - Wrapped `submitTypedTestAttempt()` with `withRetry()` for transient failure recovery |
| 2026-01-09 | `src/pages/TypedTest.jsx` | **Solution #3** - Added `submitError` state and error UI with "Try Again" button |
| 2026-01-09 | `src/pages/TypedTest.jsx` | **Solution #3** - Added `beforeunload` handler to warn before leaving with unsaved answers |
| 2026-01-09 | `src/services/db.js` | **Solution #1** - Added `getRecentAttemptsForClassList()` to query recent attempts by studentId/classId/listId |
| 2026-01-09 | `src/services/progressService.js` | **Solution #1** - Added `calculateCSDAndTWIFromAttempts()` to derive CSD/TWI from attempt history |
| 2026-01-09 | `src/services/progressService.js` | **Solution #1** - Modified `getOrCreateClassProgress()` to reconcile CSD/TWI and return `{ progress, attempts }` |
| 2026-01-09 | `src/services/progressService.js` | **Solution #1** - Added `logSystemEvent('csd_twi_reconciled', ...)` when mismatch detected |
| 2026-01-09 | `src/services/studyService.js` | **Solution #1** - Updated `initializeDailySession()` to destructure `{ progress, attempts }` |
| 2026-01-09 | `src/pages/MCQTest.jsx` | **Solution #1** - Updated `getOrCreateClassProgress()` call to destructure `{ progress }` (line 525) |
| 2026-01-09 | `src/pages/TypedTest.jsx` | **Solution #1** - Updated `getOrCreateClassProgress()` call to destructure `{ progress }` (line 621) |
| 2026-01-09 | `src/services/studyService.js` | **Solution #2** - Added `determineStartingPhase()` to detect mid-session or complete states from attempts (lines 57-95) |
| 2026-01-09 | `src/services/studyService.js` | **Solution #2** - Added `logSystemEvent('impossible_phase_detected', ...)` for Day 1 anomaly |
| 2026-01-09 | `src/services/studyService.js` | **Solution #2** - Updated `initializeDailySession()` to return `startPhase`, `recoveredNewWordScore`, `recoveredReviewScore` |
| 2026-01-09 | `src/pages/DailySessionFlow.jsx` | **Solution #2** - Added startPhase handling in init: COMPLETE skips to completion, REVIEW_STUDY loads segment words and skips new word phase (lines 604-639) |
| 2026-01-09 | `src/services/progressService.js` | **Bug Fix #4** - Added Math.max safeguard to prevent CSD/TWI regression if query returns empty/incomplete data (lines 117-119) |
| 2026-01-09 | `src/pages/DailySessionFlow.jsx` | **Bug Fix #6** - Fixed undefined `combinedWords` variable in test recovery - now uses `testRecovery.localState?.wordPool` (lines 696, 713) |
| 2026-01-09 | `src/pages/DailySessionFlow.jsx` | **Bug Fix #7** - Added `setCardsReviewed(0)` to REVIEW_STUDY recovery to reset card count (line 633) |
| 2026-01-09 | `src/pages/DailySessionFlow.jsx` | **Bug Fix #8** - Wrapped `getSegmentWords` in try-catch for REVIEW_STUDY recovery with error UI fallback (lines 620-645) |
| 2026-01-11 | `src/pages/MCQTest.jsx` | **Rollback** - Removed all pending submission localStorage recovery work (Steps R1-R8): removed `isResumingSubmission` and `showConnectionWarning` states, removed `resumePendingSubmission` function, restored simple testRecovery useEffect, removed all pending submission save/clear logic in handleSubmit, removed resuming submission UI, simplified submission overlay to show only "Submitting Your Test..." with retry button on error |
| 2026-01-11 | `src/pages/TypedTest.jsx` | Added simple submission overlay modal (lines 1259-1288) matching MCQTest's simplified approach - full-screen modal with "Submitting Your Test..." message, spinner, and retry button on error |
| 2026-01-11 | `src/pages/TypedTest.jsx` | Removed inline `submitError` display (previously lines 1182-1200) - error handling now centralized in submission overlay modal |
| 2026-01-12 | `src/pages/TypedTest.jsx` | **AI Grading Retry Logic** - Added retry state variables `retryAttempt` and `gradingError` (lines 97-99) |
| 2026-01-12 | `src/pages/TypedTest.jsx` | **AI Grading Retry Logic** - Added `gradeWithRetry()` function with 3 max retries, 10s delay between retries, 90s timeout per attempt (lines 572-603) |
| 2026-01-12 | `src/pages/TypedTest.jsx` | **AI Grading Retry Logic** - Updated `handleSubmit()` to use `gradeWithRetry()` instead of direct API call, added retry state initialization (lines 605-628) |
| 2026-01-12 | `src/pages/TypedTest.jsx` | **AI Grading Retry Logic** - Added `handleRetryGrading()` for manual retry after all attempts fail (lines 753-757) |
| 2026-01-12 | `src/pages/TypedTest.jsx` | **AI Grading Retry Logic** - Updated submission overlay to show retry status on attempts 2-3 with yellow warning and attempt counter (lines 1287-1314) |
| 2026-01-12 | `src/pages/TypedTest.jsx` | **AI Grading Retry Logic** - Added separate grading error modal with manual "Try Again" button after 3 failed attempts, preserves student answers (lines 1332-1355) |
| 2026-01-12 | `src/services/db.js` | **Challenge Bug Fix** - `reviewChallenge()` now updates `passed` field when challenge is accepted. Previously only `score` was updated, leaving `passed: false` even when score crossed threshold. This caused reconciliation to not advance days. (lines 2606-2628) |
| 2026-01-12 | `CLAUDE.md` | Fixed filename reference from `changes_action_log.md` to `change_action_log.md` and added table format hint |
| 2026-01-12 | `CLAUDE.md` | Added apBoost rule to log changes to `change_action_log_ap.md` instead of main log |
| 2026-01-12 | `change_action_log_ap.md` | **NEW FILE** - Separate change log for apBoost development |
| 2026-01-13 | `updated_tech_spec_vocaboost.md` | **NEW FILE** - Complete technical specification document with 15 sections covering architecture, routing, pages, components, design system, state management, services, data models, algorithms, study flow, utilities, dev tools, and security |
| 2026-01-19 | `src/services/progressService.js` | **TWI Bug Fix** - Changed reconciliation TWI calculation to use most recent new test instead of exact CSD-level match (lines 86-97). Previous logic failed when no new test existed at exact CSD level. |
| 2026-01-19 | `src/services/progressService.js` | **TWI Bug Fix** - Added fallback TWI fetch: if TWI=0 with CSD>0, calls `getMostRecentNewTest()` to recover TWI from any new test (lines 167-176) |
| 2026-01-19 | `src/services/db.js` | **NEW FUNCTION** - Added `getMostRecentNewTest()` helper for fallback TWI reconciliation - queries only new tests with sessionType filter (lines 3016-3060) |
| 2026-01-19 | `src/services/studyService.js` | **TWI Bug Fix** - Changed `wordsIntroduced` to use `sessionConfig.newWordCount` as primary source instead of `newWords.length` which was often 0 (line 1087) |
| 2026-01-19 | `src/services/progressService.js` | **Anchor-Based Reconciliation** - Rewrote `calculateCSDAndTWIFromAttempts()` to use NEW TEST as anchor for both CSD and TWI (lines 40-102). CSD and TWI now derived from same source to prevent mismatch. |
| 2026-01-19 | `src/services/progressService.js` | **Orphan Cleanup** - Added `cleanupOrphanedReviews()` function to delete review tests where `studyDay > anchorDay`. Logs full attempt data to `system_logs` before deletion (lines 115-155). |
| 2026-01-19 | `src/services/progressService.js` | **Orphan Cleanup** - Updated `getOrCreateClassProgress()` to call `cleanupOrphanedReviews()` after calculating anchor day (lines 212-215) |
| 2026-01-26 | `scripts/advance-student-to-day.js` | **NEW SCRIPT** - Admin script to advance a student's progress when transferring between classes (CORE→TOP). Inserts synthetic NEW + REVIEW attempts and resets class_progress/session_states so reconciliation sets correct CSD/TWI. Used to advance Sarang Min (love0609m@gmail.com) to Day 11 in TOP OFFLINE class. |
| 2026-02-03 | `src/services/db.js` | **NEW FUNCTION** - Added `getMostRecentPassedNewTest()` to query only PASSED new tests for reconciliation anchor (lines 3066-3111). Fixes bug where failed new tests incorrectly advanced TWI. |
| 2026-02-03 | `src/services/db.js` | **NEW FUNCTION** - Added `getReviewForDay()` to check if review exists for specific study day (lines 3113-3153). Used by reconciliation to determine CSD. |
| 2026-02-03 | `src/services/progressService.js` | **CRITICAL BUG FIX** - Rewrote reconciliation to use two-query approach: (1) find anchor from PASSED new tests only, (2) check if review exists for anchor day. Previously, failed new tests were used as anchors, causing TWI to advance and students to skip word ranges on retry. |
| 2026-02-03 | `src/services/progressService.js` | Removed old `calculateCSDAndTWIFromAttempts()` function, replaced with direct calls to new db.js query helpers. |
| 2026-02-03 | `scripts/check-single-student.js` | Updated reconciliation analysis to only consider PASSED new tests as anchors, matching new app logic. |

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

---

## Phase 5: Session Fragility Fixes

**Date:** 2026-01-09

### Problem Statement

Sessions were fragile due to three interrelated issues:

1. **Attempt writes could fail silently** - Network failures during test submission could lose student work
2. **CSD/TWI could drift from reality** - `class_progress` fields could become inconsistent with actual attempt history
3. **Mid-session crashes lost progress** - If a student completed the new word test but crashed before review, they'd restart from scratch

### Solution Overview

Implemented three fixes from `session_fragility_fix_proposal.md`:

| Solution | Purpose | Key Mechanism |
|----------|---------|---------------|
| #3: Bulletproof Attempt Writing | Prevent data loss on network failures | Retry with exponential backoff |
| #1: CSD/TWI Reconciliation | Self-healing progress tracking | Derive CSD/TWI from attempts on load |
| #2: Init-Based Phase Detection | Resume mid-session | Check attempts to determine starting phase |

---

### Solution #3: Bulletproof Attempt Writing

#### Problem
Firebase writes can fail due to transient network issues. Without retry logic, a student could complete a test, have the submission fail, and lose all their work.

#### Implementation

**New helpers in `db.js`:**

```javascript
// Identify retryable errors (network, unavailable, etc.)
function isTransientError(error) {
  const transientCodes = [
    'unavailable', 'resource-exhausted', 'deadline-exceeded',
    'cancelled', 'unknown', 'internal', 'aborted'
  ];
  return transientCodes.includes(error?.code);
}

// Add ±25% jitter to prevent thundering herd
function addJitter(baseDelayMs) {
  const jitter = baseDelayMs * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, baseDelayMs + jitter);
}

// Generic retry wrapper with exponential backoff
async function withRetry(fn, options = {}, loggingContext = {}) {
  const { maxRetries = 3, totalTimeoutMs = 15000 } = options;
  // Retries with 1s, 2s, 4s delays (with jitter)
  // Logs success after retry or final failure to system_logs
}
```

**System logging helper:**

```javascript
export async function logSystemEvent(eventType, data, severity = 'warning') {
  // Writes to system_logs collection for anomaly monitoring
  // Fire-and-forget (doesn't block on errors)
}
```

**Test component changes (MCQTest.jsx, TypedTest.jsx):**

1. Wrap `submitTestAttempt()` / `submitTypedTestAttempt()` with `withRetry()`
2. Add `submitError` state for error UI display
3. Show "Try Again" button when submission fails after all retries
4. Add `beforeunload` handler to warn before leaving with unsaved answers

#### Files Modified

| File | Changes |
|------|---------|
| `src/services/db.js` | Added `isTransientError()`, `addJitter()`, `withRetry()`, `logSystemEvent()` |
| `src/services/db.js` | Added `listId` parameter to submit functions |
| `src/pages/MCQTest.jsx` | Retry wrapper, error UI, exit confirmation |
| `src/pages/TypedTest.jsx` | Retry wrapper, error UI, exit confirmation |

---

### Solution #1: CSD/TWI Reconciliation

#### Problem
`class_progress` stores `currentStudyDay` (CSD) and `totalWordsIntroduced` (TWI). These could drift from reality if:
- Session completion failed mid-write
- Race conditions between concurrent requests
- Bugs in progression logic

#### Implementation

**New query in `db.js`:**

```javascript
export async function getRecentAttemptsForClassList(userId, classId, listId, maxResults = 8) {
  // Query attempts collection by studentId, classId, listId
  // Order by submittedAt desc, limit to maxResults
  // Returns array of attempt documents
}
```

**New reconciliation logic in `progressService.js`:**

```javascript
function calculateCSDAndTWIFromAttempts(attempts) {
  // Find highest studyDay among attempts
  const highestStudyDay = Math.max(...attempts.map(a => a.studyDay || 0));

  // Day 1: CSD = 1 if new test passed, else 0
  // Day 2+: CSD = studyDay if review test exists, else studyDay - 1

  // TWI = newWordEndIndex + 1 from new test where studyDay === CSD
  // (endIndex is 0-based, TWI is count)

  return { csd, twi };
}
```

**Modified `getOrCreateClassProgress()`:**

```javascript
export async function getOrCreateClassProgress(userId, classId, listId) {
  // Get or create progress document (existing logic)

  // NEW: Always verify against attempts
  const attempts = await getRecentAttemptsForClassList(userId, classId, listId, 8);
  const { csd, twi } = calculateCSDAndTWIFromAttempts(attempts);

  // If mismatch, reconcile and log
  if (csd !== storedCSD || twi !== storedTWI) {
    logSystemEvent('csd_twi_reconciled', { stored, calculated, attemptCount });
    await updateDoc(progressRef, { currentStudyDay: csd, totalWordsIntroduced: twi });
  }

  // Return both progress and attempts (attempts reused by Solution #2)
  return { progress, attempts };
}
```

#### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Query limit | 8 attempts | Covers 4 days of new+review pairs |
| TWI calculation | `newWordEndIndex + 1` | endIndex is 0-based, TWI is count |
| Reconciliation timing | On every progress load | Self-healing without manual intervention |
| Return format | `{ progress, attempts }` | Allows Solution #2 to reuse attempts |

#### Files Modified

| File | Changes |
|------|---------|
| `src/services/db.js` | Added `getRecentAttemptsForClassList()` |
| `src/services/progressService.js` | Added `calculateCSDAndTWIFromAttempts()`, modified `getOrCreateClassProgress()` |
| `src/services/studyService.js` | Updated caller to destructure `{ progress, attempts }` |
| `src/pages/MCQTest.jsx` | Updated caller to destructure `{ progress }` |
| `src/pages/TypedTest.jsx` | Updated caller to destructure `{ progress }` |

---

### Solution #2: Init-Based Phase Detection

#### Problem
If a student completes the new word test on Day 2+ but crashes/closes browser before review:
- CSD hasn't incremented yet (review test completes the day)
- On return, `initializeDailySession()` treats it as a fresh start
- Student sees new word study phase again instead of resuming at review

#### Implementation

**New phase detection in `studyService.js`:**

```javascript
function determineStartingPhase(attempts, dayNumber) {
  const dayAttempts = attempts.filter(a => a.studyDay === dayNumber);
  const newTest = dayAttempts.find(a => a.sessionType === 'new');
  const reviewTest = dayAttempts.find(a => a.sessionType === 'review');

  // Day 2+: mid-session (new passed, no review) -> resume at review
  if (dayNumber > 1 && newTest?.passed && !reviewTest) {
    return { phase: SESSION_PHASE.REVIEW_STUDY, newWordScore: newTest.score };
  }

  // Day 1 with passed new test -> complete (impossible after reconciliation, log it)
  if (dayNumber === 1 && newTest?.passed) {
    logSystemEvent('impossible_phase_detected', { dayNumber, reason: 'day1_with_passed_new_test' });
    return { phase: SESSION_PHASE.COMPLETE, newWordScore: newTest.score };
  }

  // Day 2+ with both tests -> complete
  if (dayNumber > 1 && newTest?.passed && reviewTest) {
    return { phase: SESSION_PHASE.COMPLETE, newWordScore: newTest.score, reviewScore: reviewTest.score };
  }

  // Normal: fresh start
  return { phase: SESSION_PHASE.NEW_WORDS_STUDY };
}
```

**Updated `initializeDailySession()` return:**

```javascript
return {
  // ... existing fields ...

  // Phase detection for session recovery
  startPhase: phaseInfo.phase,
  recoveredNewWordScore: phaseInfo.newWordScore,
  recoveredReviewScore: phaseInfo.reviewScore
};
```

**Updated `DailySessionFlow.jsx` init effect:**

```javascript
// Handle session recovery based on startPhase from attempt history
if (config.startPhase === SESSION_PHASE.COMPLETE) {
  // Session already complete - show completion screen
  setNewWordTestResults({ score: config.recoveredNewWordScore });
  setReviewTestResults({ score: config.recoveredReviewScore });
  setPhase(PHASES.COMPLETE);
  return;
}

if (config.startPhase === SESSION_PHASE.REVIEW_STUDY) {
  // Mid-session recovery: new word test passed, need to do review
  const segmentWords = await getSegmentWords(user.uid, listId, config.segment.startIndex, config.segment.endIndex);
  setReviewQueue(segmentWords);
  setReviewQueueCurrent(segmentWords);
  setNewWordTestResults({ score: config.recoveredNewWordScore });
  setPhase(PHASES.REVIEW_STUDY);
  return;
}

// Normal flow continues...
```

#### Phase Detection Logic

| Day | New Test | Review Test | Result |
|-----|----------|-------------|--------|
| 1 | None | N/A | `NEW_WORDS_STUDY` (fresh start) |
| 1 | Passed | N/A | `COMPLETE` (impossible, log it) |
| 2+ | None | None | `NEW_WORDS_STUDY` (fresh start) |
| 2+ | Passed | None | `REVIEW_STUDY` (mid-session resume) |
| 2+ | Passed | Exists | `COMPLETE` (already done) |

#### Files Modified

| File | Changes |
|------|---------|
| `src/services/studyService.js` | Added `determineStartingPhase()`, updated `initializeDailySession()` return |
| `src/pages/DailySessionFlow.jsx` | Added startPhase handling in init effect |

---

### Solution #4: System Logging

System logging was implemented as part of Solutions #1-3:

| Event Type | Location | Trigger |
|------------|----------|---------|
| `attempt_retry_succeeded` | `withRetry()` | First attempt failed, retry succeeded |
| `attempt_write_failed` | `withRetry()` | All retries exhausted |
| `csd_twi_reconciled` | `getOrCreateClassProgress()` | CSD/TWI mismatch detected and fixed |
| `impossible_phase_detected` | `determineStartingPhase()` | Day 1 with passed new test found |

All events written to `system_logs` collection with timestamp and severity.

---

### Testing Checklist

**Solution #3:**
- [ ] Submit test normally - should succeed without retry
- [ ] Simulate network failure (offline mode) - should retry and show error UI
- [ ] Check answers preserved after failure - retry should work
- [ ] Try to navigate away with error - should show warning

**Solution #1:**
- [ ] Check console for reconciliation logs
- [ ] Manually corrupt CSD in Firestore - should auto-fix on next load
- [ ] Verify TWI matches after reconciliation

**Solution #2:**
- [ ] Complete new word test on Day 2+, close browser mid-session
- [ ] Reopen - should resume at REVIEW_STUDY phase
- [ ] Complete Day 1 - refresh should show COMPLETE

**Solution #4:**
- [ ] Check `system_logs` collection in Firebase Console
- [ ] Verify logs only appear for anomalies, not normal operations

---

## Bug Fixes: Session Fragility Code Review

**Date:** 2026-01-09

### Bug #4: CSD/TWI Regression on Empty Query Results

**Problem:** If `getRecentAttemptsForClassList()` fails or returns an empty array, `calculateCSDAndTWIFromAttempts()` returns `{csd: 0, twi: 0}`. The reconciliation logic would then overwrite valid stored values with zeros.

**Fix:** Added Math.max safeguard in `progressService.js`:

```javascript
// Use Math.max to prevent regression if query fails or returns incomplete data
const safeCSD = Math.max(storedCSD, csd);
const safeTWI = Math.max(storedTWI, twi);
```

This ensures CSD/TWI can only ever increase through reconciliation, never decrease. If the query fails, stored values are preserved.

**File:** `src/services/progressService.js` (lines 117-119)

---

### Bug #6: Undefined `combinedWords` in Test Recovery

**Problem:** The test crash recovery code in `DailySessionFlow.jsx` referenced `combinedWords` variable which was never defined in that scope. This would silently evaluate to `undefined`, then `combinedWords || []` would return an empty array - effectively breaking word recovery.

**Fix:** Changed to use `testRecovery.localState?.wordPool` which contains the word pool saved to localStorage when the test started:

```javascript
// Before (broken):
newWords: combinedWords || [],
wordPool: testRecovery.phaseType === 'new' ? (combinedWords || []) : null,

// After (fixed):
const recoveredWordPool = testRecovery.localState?.wordPool || []
newWords: recoveredWordPool,
wordPool: testRecovery.phaseType === 'new' ? recoveredWordPool : null,
```

**File:** `src/pages/DailySessionFlow.jsx` (lines 696, 713)

---

### Bug #7: `cardsReviewed` Not Reset on REVIEW_STUDY Recovery

**Problem:** When recovering to REVIEW_STUDY phase, the `cardsReviewed` state was not reset. If the student had reviewed cards in a previous session, the count would persist and show incorrect progress.

**Fix:** Added `setCardsReviewed(0)` to the REVIEW_STUDY recovery block:

```javascript
setReviewQueue(segmentWords)
setReviewQueueCurrent(segmentWords)
setReviewDismissed(new Set())
setCurrentIndex(0)
setIsFlipped(false)
setCardsReviewed(0)  // NEW: Reset card count for fresh recovery
```

**File:** `src/pages/DailySessionFlow.jsx` (line 633)

---

### Bug #8: No Error Handling for `getSegmentWords` in REVIEW_STUDY Recovery

**Problem:** If `getSegmentWords()` throws an error during REVIEW_STUDY recovery, the error would bubble up unhandled, potentially leaving the user stuck on a loading screen.

**Fix:** Wrapped the `getSegmentWords()` call in try-catch with user-friendly error display:

```javascript
if (config.startPhase === SESSION_PHASE.REVIEW_STUDY) {
  try {
    const segmentWords = await getSegmentWords(/* ... */);
    // ... recovery logic ...
  } catch (err) {
    console.error('Failed to load segment words for REVIEW_STUDY recovery:', err)
    setError('Failed to load review words. Please refresh and try again.')
    return
  }
}
```

**File:** `src/pages/DailySessionFlow.jsx` (lines 620-645)
| 2026-03-06 | `scripts/export-typed-test-answers.js` | Created script to export all typed test attempts with full answers array (including AI reasoning, challenge data) for accuracy analysis |
| 2026-03-06 | `scripts/build-ai-benchmark.js` | Created script to build AI grading benchmark dataset - enriches exported attempts with Korean definitions from Firestore, outputs in Cloud Function input format with current AI grades as baseline |
| 2026-03-07 | `functions/index.js` | Switched AI grader from GPT-4o-mini to Claude Haiku (3.55% → 0.96% error rate); added `?` to blank filter; added 3 prompt rules (#9 Korean def matching, #10 part-of-speech tolerance, #11 partial answers) |
| 2026-03-07 | `functions/package.json` | Replaced `openai` dependency with `@anthropic-ai/sdk` |
| 2026-03-07 | `functions/index.js` | Refactored grading prompt: replaced 11-rule prompt with 3 failure conditions + 8 few-shot examples from audit data; added `isSelfReferencing()` pre-filter; switched to JSON input format with explicit count instruction; moved grading philosophy to system message |
| 2026-03-09 | `package.json` | Added `@playwright/test` dev dependency and `test:e2e` / `test:e2e:ui` scripts |
| 2026-03-09 | `playwright.config.js` | Created Playwright config with Chromium, Vite dev server integration, HTML reporter |
| 2026-03-09 | `e2e/app.spec.js` | Created sample e2e test that verifies app loads |
| 2026-03-09 | `.gitignore` | Added Playwright artifact directories |
| 2026-05-30 | `audit_findings_persistence.md` | Created merged persistence/stability audit (Claude + Codex) with verification table and recommended fix order |
| 2026-05-30 | `firestore.rules` | C1: scoped `{path=**}/class_progress/{docId}` collection-group rule to `allow read: if isAuthenticated() && isTeacher()` (was `allow read, write` for any auth user, allowing arbitrary cross-student progress corruption) |
| 2026-05-30 | `firestore.rules` | C3: scoped student-side `attempts` update to `affectedKeys().hasOnly(['answers'])` so students can only mutate the answers array (for submitChallenge), no longer can rewrite score/passed/credibility; teacher-side update now also requires `isTeacher()` |
| 2026-05-30 | `firestore.rules` | C2: documented TODO on `/users/{userId}/{subcollection}/{docId}` write rule — teacher-any-student writes left in place to preserve reviewChallenge functionality; flagged for follow-up to move that write to a Cloud Function with Admin SDK and tighten the rule to `isOwner(userId)` |
| 2026-05-30 | `src/utils/testRecovery.js` | Added `getOrCreateAttemptNonce(testId)` and extended `clearTestState` to also remove the nonce key. Provides a stable per-session nonce for idempotent attempt-doc IDs so withRetry replays cannot create duplicate `attempts` documents |
| 2026-05-30 | `src/services/db.js` | `submitTestAttempt` + `submitTypedTestAttempt`: added optional `attemptDocId` parameter; switched from `addDoc` to `setDoc(doc(attemptsCol, attemptDocId))` when supplied so withRetry replays are idempotent overwrites of identical data (fix #5) |
| 2026-05-30 | `src/pages/MCQTest.jsx` | Fixed #1 + #3 + #4 + #5: reordered handleSubmit so the attempt doc is written FIRST and processTestResults (study_state mutations) runs only AFTER submit succeeds; clearTestState moved to after both writes; added resultsProcessedRef so Try-Again does not re-increment timesTestedTotal within the same mount; pass deterministic attemptDocId built from `${user.uid}_${testId}_${attemptNonce}` |
| 2026-05-30 | `src/pages/TypedTest.jsx` | Fixed #2 + #3 + #4 + #5: same reorder as MCQTest. clearTestState now runs only after AI grading + attempt write + processTestResults all succeed (was wiping local recovery before the 90s-per-attempt OpenAI call, losing 15-20 min of typing on any mid-flow failure) |
| 2026-05-30 | `change_action_log.md` | (this file) Logged the persistence audit and the rules + service + test-page fixes. #17 Dashboard hook-order DEFERRED to a dedicated follow-up PR: clean fix requires extracting StudentDashboardBody into a child component (~600 lines + 7 hooks + 5 helpers); mixing it into a persistence-focused PR creates regression risk on the very dashboard we're stabilizing |
| Date | File | Change |
| --- | --- | --- |
| 2026-05-31 | src/services/studyService.js | Fix B27-F01 BLOCKER: buildReviewQueue now excludes MASTERED (retired) words before selectReviewQueue, so words within their 21-day rest window no longer reappear in review tests and get re-tested/downgraded. |
| 2026-06-09 | src/pages/DailySessionFlow.jsx + src/services/studyService.js | Fix Day-2+ new-word test bypass: a student who FAILED the Day-2+ new-word test could be carried into the review phase and complete/advance the day without passing the gate (Day 1 correctly holds on failure; Day 2+ did not). (1) Resume guard in DailySessionFlow: only resume into review-study/review-test if `existingState.newWordsTestScore >= retakeThreshold`. (2) Backstop in completeSessionFromTest: for Day 2+, if `newWordScore < threshold`, block completion (skip recordSessionCompletion / CSD advance) and return `requiresNewWordRetake`. Root cause: handleReturnFromTest/resume moved Day-2+ to review unconditionally, and completion was gated only on the review test (which always passes). NEEDS staging/emulator test before deploy. Scan found 9 already-advanced (8×25WT, 1×26SM Ryan Han) + 2 mid-bug. |
| 2026-06-02 | src/services/studyService.js | Fix newWordsTestScore unit bug on Day-2 session resume. `determineStartingPhase` re-seeded recovered new-word/review scores straight from the attempt doc (stored as percent 0-100), but session_state.newWordsTestScore + all consumers (teacher roster "Current Session" cell, student resume banner) expect a fraction (0-1) and render ×100, so resumed students showed e.g. "9700%". Added `toFraction(s) = s>1 ? s/100 : s` (matches existing convention at line ~1139) and wrapped the three score-returning branches. Display-only: pass/fail gate and gradebook (read attempts directly) unaffected; bad values self-heal on day completion, no backfill needed. |
| 2026-06-10 | src/services/studyService.js | Patch v2 Change A: `determineStartingPhase` now picks the BEST new-word attempt for the day (prefer passed=true, then highest score) instead of `.find()` returning the first match. Fixes Day-2+ fail→retake→PASS students being bounced back to the new-word test on re-entry because the earlier FAILED attempt was inspected (e.g. 유지웅 87→100, JW Han 93 — 26SM Inter B2). |
| 2026-06-10 | src/services/studyService.js | Patch v2 Change C (urgent companion to the deployed Day-2+ completion gate): `completeSessionFromTest` now reads the attempt's authoritative `passed` flag (computed server-side against the class's real passThreshold, covers teacher manual overrides) and the gate only blocks when `newWordAttemptPassed !== true AND score < threshold`. Fixes 92–94% passers in 92%-threshold classes being silently blocked from completing the day (gate compared against wrong 0.95 default). |
| 2026-06-10 | src/services/studyService.js + src/pages/DailySessionFlow.jsx | Patch v2 Change D: fixed the retake-threshold fallback chain in 4 sites — `assignment.newWordRetakeThreshold` is never stored, so all settings builders fell back to the 0.95 default; now derive from the class's real `passThreshold` (percent / 100) before falling back. Fixes resume guard, `session_state.newWordsTestPassed` writes, and the completion-gate fallback. |
| 2026-06-10 | src/pages/DailySessionFlow.jsx | Patch v2 Change B (defense-in-depth): the `existingState` resume block now also honors attempt-derived state (`config.startPhase === REVIEW_STUDY`), so a stale session pointer (`phase: new-words-study`) can never bounce a confirmed passer back to the new-word test. |
| 2026-06-10 | src/pages/DailySessionFlow.jsx | Patch v2.1 Change E-1/E-2: both resume paths into review now detect an EMPTY review segment (all words MASTERED & resting after excludeRetiredMastered) and show the designed "all mastered" success modal → completeSession(), instead of pushing the student into a 0-word review test ("No Test Content" dead end). Live impact 2026-06-10: 4 top scorers blocked daily (정아영/Paige Lim/Ryan Kim day 6, 손지우 day 7). |
| 2026-06-10 | src/pages/DailySessionFlow.jsx | Patch v2.1 Change E-4/E-4b: `handleNoReviewModalClose` now writes an idempotent marker review attempt (deterministic doc id `..._day{N}_review_automarker`, score 100/passed/autoCompleted, explanatory note) so CSD reconciliation (`getOrCreateClassProgress`, which requires a day-N review attempt) does not REVERT the auto-completed day on next entry. Added `setDoc, Timestamp` to the firestore import (without them the ReferenceError would be swallowed by the try/catch). |
| 2026-06-10 | src/pages/MCQTest.jsx + src/pages/TypedTest.jsx | Patch v2.1 Change E-3: fixed misleading "No Test Content" copy — was "Your teacher hasn't assigned enough words yet." (false teacher-misconfiguration implication); now explains no words are available and points the student back to the dashboard. |
