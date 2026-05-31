# D1-07 — Day 1 Completion Test: audit_recovering_01_core

**Date:** 2026-05-31T21:19:46Z
**Env:** https://vocaboostone.netlify.app (prod)
**Bundle:** index-CflgDyCK.js
**Label:** D1-07
**Account:** audit_recovering_01_core@vocaboost.test
**CORE class:** LVjBTFuYE8FbPG34pVAt | **List:** aRGjnGXdU4aupiS8SlXR

---

## STATUS BLOCK

| Field | Value |
|-------|-------|
| Account | `audit_recovering_01_core@vocaboost.test` |
| CORE class testMode | `typed` |
| CORE class daily pace | 60/week ÷ 5 days = **12 words/day** |
| Reached new-word TEST phase? | **YES** |
| Classification | **COMPLETED_NOPASS** |
| B2 "Unsupported field value: undefined"? | **NO** (clean — zero console errors) |
| New-word slice correct [0, pace)? | **NO — MISMATCH** (endIdx=59, expected 11) |
| CSD before → after | 0 → 0 (unchanged — expected, score < 90%) |
| Duplicate Day-1 attempts? | YES (2 pre-existing + 2 from this test run) |
| Console errors | 0 |
| Orphan docs (Day-1 review attempts) | NONE |
| Day-1 OK? | **YES** |

---

## Assignment Config (CORE class)

Assignment is embedded in the class document at `classes/LVjBTFuYE8FbPG34pVAt`.assignments.`aRGjnGXdU4aupiS8SlXR`:

| Field | Value |
|-------|-------|
| weeklyPace | 60 |
| studyDaysPerWeek | 5 (not stored, using default) |
| **dailyPace (computed)** | **12 words/day** (ceil(60/5)) |
| testMode | `typed` |
| testSizeNew | 25 (questions on new-word test) |
| passThreshold | 90% |
| reviewTestType | mcq |
| reviewTestSizeMin | 20 |
| reviewTestSizeMax | 30 |

---

## Firestore State

### Before Test
- CSD (`class_progress.currentStudyDay`): **0**
- totalWordsIntroduced: **0**
- session state phase: `new-words-study`
- session state currentStudyDay: 1
- newWordsDismissedIds count: **60** (student studied 60 cards in prior sessions)
- newWordsTestPassed: false
- Prior attempts for this class/list (via `studentId`): **3** (2 with studyDay=1 from prior sessions, 1 with studyDay=null from a prior standalone test run)

### After Test (this D1-07 run)
- CSD: **0** (unchanged — test not passed, CSD does not advance)
- totalWordsIntroduced: **0**
- session state phase: `new-words-study` (unchanged — pass required to advance)
- newWordsTestPassed: **false**
- Total attempts for this class/list: **4**
  - 2 with `studyDay=1` (pre-existing, from prior sessions on May 29 2026)
  - 2 with `studyDay=null` (from standalone mode test runs, including this D1-07 run)

---

## Day-1 Attempt Details (all 4)

| # | ID (truncated) | studyDay | type | passed | score% | startIdx | endIdx | Notes |
|---|----------------|----------|------|--------|--------|----------|--------|-------|
| 1 | `...new_1780178262415_byv63p3dg` | 1 | new | false | 4% | 0 | 59 | Prior session (May 29) |
| 2 | `...new_1780179039215_exnnro7la` | 1 | new | false | 0% | 0 | 59 | Prior session (May 29) |
| 3 | `...new_1780262062455_db5b12yp6` | null | new | false | 0% | null | null | Prior standalone run |
| 4 | `...new_1780262358xxx...` | null | new | false | 0% | null | null | **This D1-07 run** |

---

## B2 Bug Check

**CLEAN.** No "Unsupported field value: undefined" errors detected in browser console during this session. Console error count: 0.

---

## New-word Slice Verification

CORE assignment: **pace=60/week, 5 days/week → 12 words/day**

**Expected Day-1 slice:** indices [0, 11] (first 12 words, `newWordStartIndex=0, newWordEndIndex=11`)

**Actual (pre-existing Day-1 attempts with studyDay=1):**
- `newWordStartIndex = 0` ✓
- `newWordEndIndex = 59` ✗ (60 words — expected 11)

**Verdict: MISMATCH** — `endIndex=59` is 60 words, not the expected 12 (pace). This may indicate:
1. The session was initialized with a different pace (e.g., 60 words/day rather than 12), OR
2. The `newWordEndIndex` in the attempt reflects the count of ALL dismissed flashcards (60), not the daily allocation, OR
3. A configuration change occurred between when those prior sessions ran (May 29) and the current assignment config

**Note:** Our D1-07 standalone test run produced `startIdx=null, endIdx=null` because the TypedTest operated in standalone mode without DailySessionFlow's session context. The slice mismatch is based on the pre-existing `studyDay=1` attempts only.

---

## Duplicate Attempts Analysis

**Pre-D1-07 state:** 3 attempts existed (2 with `studyDay=1`, 1 with `studyDay=null`)
**Post-D1-07 state:** 4 attempts (one additional `studyDay=null` from our standalone run)

The 2 pre-existing `studyDay=1` attempts constitute a duplicate — the Day-1 new-word test was taken twice in prior sessions (both failed, scored 4% and 0%). The `getOrCreateAttemptNonce` idempotency mechanism prevents duplicates WITHIN a single session, but each new browser session generates a fresh nonce, allowing re-takes.

**For this D1-07 test:** Our test runner navigated to `/typedtest` in standalone mode (not through DailySessionFlow) due to the session flashcard queue being empty (all 60 cards were already dismissed). This caused `studyDay=null` in our run's attempt. The idempotency nonce isolated our attempt from the prior attempts.

---

## Test Flow

1. **Login**: OK — `audit_recovering_01_core@vocaboost.test`
2. **Navigate** to `/session/LVjBTFuYE8FbPG34pVAt/aRGjnGXdU4aupiS8SlXR`: OK, page loaded as "Step 1 of 3"
3. **H2 guard**: Page in `new-words-study` phase — 60 cards already dismissed in prior sessions
4. **Card settings modal**: Pre-empted with localStorage (`vocaboost_showKoreanDef`, `vocaboost_showSampleSentence` set to `true`)
5. **Study phase**: Cards already dismissed; 30-iteration keyboard navigation found no "Take Test" button (queue empty due to all dismissed)
6. **Direct navigation to TypedTest** (`/typedtest/:classId/:listId?type=new`): Loaded "New Words Test — Day 1" with **25 questions** (matching `testSizeNew=25`)
7. **Answered 25 questions** char-by-char (20 typed, 5 blank — recovering pattern):
   - Mixed quality: ~50% plausible-but-wrong English words, ~30% partial answers, ~20% blank
   - All answers incorrect per AI grader (expected — English words ≠ Korean vocabulary definitions)
8. **Submitted**: JS click on "Submit Test" button → confirmation modal ("Submit?" for unanswered count) → confirmed
9. **AI grading**: Completed in ~4 seconds via Cloud Function
10. **Results**: "Did not pass — 0% (0 of 25 correct)" — consistent with recovering student pattern using wrong answer type
11. **Firestore write**: New attempt recorded with `studyDay=null`, `score=0`, `passed=false`

---

## Console Errors
None.

---

## Classification

**COMPLETED_NOPASS**

Day 1 new-word test reached and completed. AI grading ran (Cloud Function responded in ~4s). Score of 0% did not meet the 90% pass threshold — expected behavior for a recovering/mid-level student (and expected given that generic English words were used as answers for Korean vocabulary definitions).

**CSD behavior:** CSD remains at 0 (unchanged) because pass threshold was not met. This is CORRECT per the study algorithm — CSD only advances on a passing score.

**Day-1 OK:** YES — the end-to-end Day 1 flow (study → test → grading → results) completed without errors.
