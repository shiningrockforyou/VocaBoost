# Change Action Log

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
