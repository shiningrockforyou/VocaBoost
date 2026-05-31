# F01 Path Map — Every Path by Which Words Reach a Test

**Bug:** MASTERED words (status === 'MASTERED' with future returnAt) appear in REVIEW tests.  
**Scope:** MCQTest (`src/pages/MCQTest.jsx`) and TypedTest (`src/pages/TypedTest.jsx`).  
**Date of analysis:** 2026-05-31  

---

## 1. Every Entry Point Into loadTestWords / loadList

### 1A — MCQTest.jsx: loadTestWords branches

**Source:** `src/pages/MCQTest.jsx` lines 235–349

The function has three mutually exclusive branches based on what `location.state` contains.

#### PATH A — testConfig present (new flow, DailySessionFlow)

- **Trigger condition:** `testConfig` is truthy (line 241)  
- **Data source:** `testConfig.wordsToTest` — pre-computed by `buildTestConfig` in `navigateToTest` (DailySessionFlow line 1100)  
- **Key lines in MCQTest:** 248–249  
  ```js
  setOriginalWords(testConfig.originalWordPool)
  generateQuestions(testConfig.wordsToTest, testConfig.testOptionsCount)
  ```
- **MASTERED filtered?** Depends entirely on what `buildTestConfig` received as `wordPool`.  
  - `buildTestConfig` calls `selectTestWords(wordPool, effectiveTestSize)` (`src/utils/testConfig.js` line 43–44).  
  - `selectTestWords` — **NO MASTERED filter** (`src/utils/studyAlgorithm.js` lines 300–311).  
  - Therefore PATH A is **SAFE or LEAK** depending on the caller's wordPool. See Section 2 for each caller.

#### PATH B — Legacy wordPool present (backwards compatibility)

- **Trigger condition:** `testConfig` is null AND `wordPool` (= `legacyWordPool`) is non-empty (line 255)  
- **Data source:** `location.state.wordPool` — raw array passed directly by caller  
- **Key lines:** 259–265  
  ```js
  setOriginalWords(wordPool)
  generateQuestions(wordPool, numOptions)
  ```
- **MASTERED filtered?** No filter in MCQTest itself. Whether MASTERED words are absent depends on what the caller put in `wordPool`. The only current caller that uses legacy `wordPool` is the crash-recovery path in DailySessionFlow (line 721). See Section 2-D.

#### PATH C — Neither testConfig nor wordPool (standalone "smart selection")

- **Trigger condition:** Both `testConfig` and `wordPool` are falsy (lines 267+)  
- **Data source:**  
  - New test: `getNewWords()` → `selectTestWords()` (MCQTest lines 306–307)  
  - Review test: `getSegmentWords()` → `selectTestWords()` (lines 322–328)  
  - Review fallback (no segment, Day 1): raw Firestore query → `selectTestWords()` (lines 330–334)  
- **MASTERED filtered?**  
  - **NO** — `getSegmentWords` returns ALL segment words with studyState merged but does NOT filter by status (`src/services/studyService.js` lines 278–308).  
  - **NO** — `selectTestWords` does no status filtering (`src/utils/studyAlgorithm.js` lines 300–311).  
  - **LEAK on review path.** New word path: new words can never be MASTERED (they are NEVER_TESTED until their first test), so PATH C new is safe in practice.

---

### 1B — TypedTest.jsx: loadTestWords branches

**Source:** `src/pages/TypedTest.jsx` lines 242–440

TypedTest has the same three-path structure plus an additional recovery sub-branch.

#### PATH A — testConfig present

- **Trigger condition:** `testConfig` truthy AND no valid recovery state (lines 283–302)  
- **Data source:** `testConfig.wordsToTest` (line 290)  
- **Key lines:**  
  ```js
  const cappedWords = testConfig.wordsToTest.slice(0, MAX_TYPED_TEST_WORDS)
  setOriginalWords(cappedWords)
  setWords(shuffleArray([...cappedWords]))
  ```
- **MASTERED filtered?** Same as MCQTest PATH A — depends on caller's wordPool. See Section 2.

#### PATH A-R — Recovery mode (testConfig present, valid saved state)

- **Trigger condition:** `testConfig` truthy AND `hasValidRecovery` AND matching words found (lines 256–278)  
- **Data source:** Saved `wordIds` from localStorage, resolved against `testConfig.wordsToTest`  
- **MASTERED filtered?** No additional filter. The same words that were in `testConfig.wordsToTest` originally — whatever MASTERED filtering (or lack thereof) applied at the time of first load.

#### PATH B — Legacy wordPool

- **Trigger condition:** `wordPool` non-empty (lines 305–323)  
- **Data source:** `location.state.wordPool`  
- **MASTERED filtered?** No filter in TypedTest itself.

#### PATH C — Standalone smart selection

- **Trigger condition:** Neither testConfig nor wordPool (lines 325+)  
- **Data source:**  
  - New: `getNewWords()` → `selectTestWords()` (lines 362–363)  
  - Review: `getSegmentWords()` → `selectTestWords()` (lines 379–384)  
  - Review fallback: raw Firestore query → `selectTestWords()` (lines 386–391)  
- **MASTERED filtered?** **NO** — same as MCQTest PATH C. LEAK on review path.

---

## 2. Every Caller That Navigates to /mcqtest or /typedtest

### CALLER A — DailySessionFlow: navigateToTest (normal flow)

**File:** `src/pages/DailySessionFlow.jsx` lines 1088–1151  
**Invoked by:**  
- `goToNewWordTest()` (line 902–906) → calls `navigateToTest('new', actualMode)`  
- `goToReviewTest()` (line 1077–1082) → calls `navigateToTest('review', actualMode)`  
- `handleNewWordTestRetake()` (line 916–919) → calls `navigateToTest('new', mode)`  
- `handleTestConfirm()` (line 1504–1511) — the Skip-to-Test confirm handler — calls `goToNewWordTest()` or `handleFinishReviewStudy()` → `goToReviewTest()`  

**What it puts in location.state:**  
```js
navigate(`${route}/${classId}/${listId}`, {
  state: { testConfig, returnPath }
})
```
where `testConfig = buildTestConfig({ assignment, wordPool, testType, sessionContext })`.

**For review test:** `wordPool = reviewQueue` (line 1089).  
**The reviewQueue state** is set by different code paths:

| setReviewQueue source | Code location | MASTERED filtered? |
|---|---|---|
| `loadReviewQueue` → `buildReviewQueue()` | Line 473 (helper, currently never called from main init) | YES (buildReviewQueue filters, then selectReviewQueue backstop) |
| `handleSwitchToCompleteMode` → `getSegmentWords()` | Line 496 | **NO** |
| `handleSwitchToFastMode` → `buildReviewQueue()` | Line 526 | YES |
| Session recovery (REVIEW_STUDY phase) → `getSegmentWords()` | Line 629 | **NO** |
| Init: existing state same-day resume → `getSegmentWords()` | Line 812 | **NO** |
| Init: no new words path → `getSegmentWords()` | Line 826 | **NO** |
| `moveToReviewPhase()` → `getSegmentWords()` | Line 967 | **NO** |
| `handleReturnFromTest`/`handleGoToStudy` → restore `state.reviewQueue` | Lines 1171, 1220 | Inherits from when it was stored |
| Local recovery `handleLocalRecoveryContinue` → `getSegmentWords()` | Line 1448 | **NO** |

**Conclusion:** The `reviewQueue` passed into `navigateToTest` comes from `getSegmentWords()` in the vast majority of paths. `getSegmentWords()` returns ALL segment words including MASTERED ones (as nested `studyState.status`). `buildTestConfig` then calls `selectTestWords(wordPool)` — **NO MASTERED filter**. This is the primary leak channel.

**Navigates to PATH A** in MCQTest/TypedTest.  
**MASTERED filtered for review?** **NO — LEAK.**  
**Reachable by real student?** YES — every normal session flow.

---

### CALLER B — DailySessionFlow: Crash-recovery navigation

**File:** `src/pages/DailySessionFlow.jsx` lines 697–737  
**Trigger:** User crashes during a test phase, then returns to session.  
**What it puts in location.state:**  
```js
navigate(`${route}/${classId}/${listId}`, {
  state: {
    testType: testRecovery.phaseType,                          // 'new' or 'review'
    wordPool: testRecovery.phaseType === 'new' ? recoveredWordPool : null,
    returnPath: `/session/${classId}/${listId}`,
    sessionContext: { ... }
  }
})
```

- For **new** test recovery: passes legacy `wordPool` (= `recoveredWordPool` from localStorage). Navigates to **PATH B**. New words can't be MASTERED → **SAFE**.
- For **review** test recovery: passes `wordPool: null` (line 721). With `testConfig` also null (not in state), **PATH C** is triggered. `getSegmentWords()` + `selectTestWords()` → **NO MASTERED filter → LEAK**.  
**Reachable by real student?** YES — any browser crash or unexpected navigation during review test.

---

### CALLER C — MCQTest: handleRetake (review retake)

**File:** `src/pages/MCQTest.jsx` lines 807–812  
**Trigger:** Student requests retake of review test after failing.  
**What it puts in location.state:**  
```js
navigate(`/mcqtest/${classIdParam}/${listId}?type=review`, {
  state: { testConfig: sessionContext, returnPath }
})
```
where `sessionContext = testConfig || legacySessionContext` (line 61). This re-uses the original `testConfig` object (which was the PATH A testConfig from DailySessionFlow). The `wordsToTest` inside it still came from the original unfiltered `reviewQueue`.

**Navigates to PATH A** in MCQTest.  
**MASTERED filtered?** Whatever the original PATH A testConfig had — inherits the leak.  
**Reachable by real student?** YES — review test retake.

---

### CALLER D — TypedTest: handleRetake (review retake)

**File:** `src/pages/TypedTest.jsx` lines 909–914  
**Identical pattern** to CALLER C.  
```js
navigate(`/typedtest/${classIdParam}/${listId}?type=review`, {
  state: { testConfig: sessionContext, returnPath }
})
```
**MASTERED filtered?** Inherits leak from original testConfig.  
**Reachable by real student?** YES.

---

### CALLER E — MCQTest: handleRetake (new word retake — in-place)

**File:** `src/pages/MCQTest.jsx` lines 731–743  
Not a navigation. Re-shuffles from `originalWords` (already loaded in state).  
```js
const shuffled = selectTestWords(originalWords, configuredTestSize)
generateQuestions(shuffled)
```
New words are never MASTERED. **SAFE.** Not a navigation.

---

### CALLER F — TypedTest: handleRetake (new word retake — in-place)

**File:** `src/pages/TypedTest.jsx` lines 832–845  
Same pattern as CALLER E, in-place re-shuffle from `originalWords`.  
New words are never MASTERED. **SAFE.** Not a navigation.

---

### CALLER G — DailySessionFlow: handleReEntryRetake (re-entry after complete)

**File:** `src/pages/DailySessionFlow.jsx` lines 1399–1402  
```js
const handleReEntryRetake = () => {
  setShowReEntryModal(false)
  setPhase(PHASES.REVIEW_STUDY)
}
```
This does NOT navigate to test directly — it returns to REVIEW_STUDY phase. The student must then click "Ready for Test" / skip-to-test which goes through `goToReviewTest()` → `navigateToTest()` → **CALLER A**.  
The `reviewQueue` at this point is whatever was restored from `state.reviewQueue` (from sessionStorage on `handleReturnFromTest`, line 1220) — which was the unfiltered `reviewQueue` captured before the test.  
**Ultimately lands on CALLER A. LEAK inherited.**  
**Reachable by real student?** YES — re-entry after completed session.

---

## 3. Helper Functions — MASTERED Filter Status

### `buildReviewQueue` — `src/services/studyService.js` lines 564–613

Filters MASTERED **before** passing to `selectReviewQueue`:
```js
const eligibleSegmentWords = segmentWords.filter(
  w => w.studyState?.status !== WORD_STATUS.MASTERED
)
```
(Line 580–582) **YES — SAFE.**  
This is used for the study flashcard review queue building, and is correctly filtered.

---

### `selectReviewQueue` — `src/utils/studyAlgorithm.js` lines 215–292

Has backstop filter at top:
```js
segmentWords = (segmentWords || []).filter(w => w.status !== 'MASTERED');
```
(Line 222) **YES — SAFE.**  
But this function is only called from `buildReviewQueue`. It never appears in the test word selection chain.

---

### `getSegmentWords` — `src/services/studyService.js` lines 278–308

Returns words merged with studyState. **NO status filter.** Returns MASTERED words.  
The status is nested at `word.studyState.status`, not `word.status`.  
Called by: `buildReviewQueue` (filtered afterward), `moveToReviewPhase` (NOT filtered), session init (NOT filtered), `handleSwitchToCompleteMode` (NOT filtered), local recovery (NOT filtered).

---

### `selectTestWords` — `src/utils/studyAlgorithm.js` lines 300–311

```js
export function selectTestWords(wordPool, testSize) {
  if (!Array.isArray(wordPool) || wordPool.length === 0) {
    return [];
  }
  if (wordPool.length <= testSize) {
    return shuffleArray(wordPool);
  }
  const shuffled = shuffleArray(wordPool);
  return shuffled.slice(0, testSize);
}
```
**NO status filter whatsoever.** Passes through whatever is in wordPool.

---

### `buildTestConfig` — `src/utils/testConfig.js` lines 21–67

```js
const wordsToTest = wordPool.length > 0
  ? selectTestWords(wordPool, effectiveTestSize)
  : []
```
(Lines 43–44) **NO status filter.** Delegates entirely to `selectTestWords`.

---

### `getNewWords` — `src/services/studyService.js` lines 538–550

Returns raw Firestore word documents by position range. **NO status filter** (and none needed — new words are NEVER_TESTED by definition).

---

## 4. Definitive Table — Every Distinct Way a Review Test Can Be Populated

| # | Entry Point | Data Source | MASTERED Filtered? | Reachable by Student? | LEAK or SAFE? |
|---|---|---|---|---|---|
| 1 | CALLER A: Normal session flow (DailySessionFlow `navigateToTest`, review) | `reviewQueue` state ← `moveToReviewPhase()` ← `getSegmentWords()` ← no filter | **NO** | YES — every normal Day 2+ session | **LEAK** |
| 2 | CALLER A: Complete mode switch then test | `reviewQueue` state ← `handleSwitchToCompleteMode()` ← `getSegmentWords()` ← no filter | **NO** | YES — when student switches to complete mode | **LEAK** |
| 3 | CALLER A: Session resume (same-day, Firestore state) | `reviewQueue` state ← init `getSegmentWords()` (line 812) ← no filter | **NO** | YES — any mid-session page refresh | **LEAK** |
| 4 | CALLER A: Init, no new words path | `reviewQueue` state ← init `getSegmentWords()` (line 826) ← no filter | **NO** | YES — when student is caught up on new words | **LEAK** |
| 5 | CALLER A: REVIEW_STUDY recovery (attempt-based) | `reviewQueue` state ← init `getSegmentWords()` (line 629) ← no filter | **NO** | YES — mid-session crash recovery | **LEAK** |
| 6 | CALLER A: Local crash recovery | `reviewQueue` state ← `handleLocalRecoveryContinue()` ← `getSegmentWords()` (line 1448) ← no filter | **NO** | YES — unexpected browser close | **LEAK** |
| 7 | CALLER A: handleReturnFromTest restores reviewQueue | `reviewQueue` state ← restore from sessionStorage ← originally unfiltered `getSegmentWords()` | **NO** | YES — always, every time returning from a test | **LEAK (inherited)** |
| 8 | CALLER B: Crash recovery → review PATH C | `getSegmentWords()` + `selectTestWords()` — no filter | **NO** | YES — crash during review test | **LEAK** |
| 9 | CALLER C/D: Review retake (MCQTest/TypedTest handleRetake) | `sessionContext` (original testConfig) reused — inherits Leak #1 | **NO** | YES — review test retake | **LEAK (inherited)** |
| 10 | CALLER A: Fast mode (buildReviewQueue path) | `reviewQueue` ← `handleSwitchToFastMode()` ← `buildReviewQueue()` ← filters MASTERED | **YES** | YES — only when student uses Fast mode | **SAFE** |
| 11 | PATH C: Standalone test, review type | `getSegmentWords()` → `selectTestWords()` | **NO** | Rare (direct URL navigation) | **LEAK** |
| 12 | PATH C: Standalone test, new word type | `getNewWords()` → `selectTestWords()` | NO filter (harmless — new words never MASTERED) | Rare (direct URL navigation) | **SAFE** |
| 13 | PATH A: testConfig from fast-mode buildReviewQueue | Inherits SAFE because fast mode built reviewQueue via buildReviewQueue | **YES (upstream)** | YES — only via fast mode | **SAFE** |

---

## 5. Chokepoint Analysis

### Why the existing fixes are insufficient

The existing filters are at:
1. `buildReviewQueue` (studyService.js line 580) — filters before passing to `selectReviewQueue`
2. `selectReviewQueue` backstop (studyAlgorithm.js line 222) — filters status field

These cover the **study flashcard review queue** (what the student sees during study), but **neither is called in the test word selection chain**. The test chain is:

```
reviewQueue (React state) → navigateToTest → buildTestConfig → selectTestWords → testConfig.wordsToTest → MCQTest/TypedTest PATH A
```

None of these steps filters MASTERED.

---

### Option 1: Filter in `selectTestWords` (recommended)

**Location:** `src/utils/studyAlgorithm.js` line 300

Add at the top of `selectTestWords`:
```js
// Remove MASTERED words — they are in a 21-day rest and must not appear in tests.
// New words never have status set, so this is harmless for new-word test pools.
const eligiblePool = wordPool.filter(w => {
  const status = w.status || w.studyState?.status
  return status !== 'MASTERED'
})
```
Then use `eligiblePool` instead of `wordPool` throughout the function.

**Coverage analysis:**
- PATH A (DailySessionFlow → buildTestConfig → selectTestWords): COVERED
- PATH B (legacy wordPool → generateQuestions directly — does NOT call selectTestWords): NOT COVERED
- PATH C (getSegmentWords → selectTestWords): COVERED
- MCQ/Typed review retake (re-uses original testConfig.wordsToTest — already selected, does not re-call selectTestWords): **NOT COVERED for retake words already in testConfig**

**Key feasibility question:** Do words passed to selectTestWords carry `status` or `studyState.status`?

- Via PATH A (`navigateToTest` → `buildTestConfig`): wordPool = `reviewQueue` from `getSegmentWords()`. `getSegmentWords` returns `{ ...word, studyState: { status, ... } }`. Status is at `w.studyState.status`. The top-level `w.status` is NOT set by `getSegmentWords`. So the filter must check `w.studyState?.status`.
- Via PATH C (`getSegmentWords` directly): Same — status at `w.studyState.status`.
- Via PATH B (legacy wordPool from DailySessionFlow crash recovery for new test): Words have no studyState (from localStorage snapshot). New words anyway, so not MASTERED.

So the filter needs: `(w.status || w.studyState?.status) !== 'MASTERED'`

**Impact on new word tests:** New words come from `getNewWords()` which returns raw Firestore documents with no `status` or `studyState` field. The filter `undefined !== 'MASTERED'` → true → words are kept. **Harmless and correct.**

---

### Option 2: Defensive filter in test component before generateQuestions

**Location:** MCQTest.jsx and TypedTest.jsx, at the point where `wordsToTest` is finalized.

For PATH A in MCQTest (line 249):
```js
const filteredWords = testConfig.wordsToTest.filter(w =>
  (w.status || w.studyState?.status) !== 'MASTERED'
)
generateQuestions(filteredWords, testConfig.testOptionsCount)
```

For PATH B (line 261–262):
```js
const filteredPool = wordPool.filter(w => (w.status || w.studyState?.status) !== 'MASTERED')
setOriginalWords(filteredPool)
generateQuestions(filteredPool, numOptions)
```

For PATH C review (line 328):
```js
wordsToTest = selectTestWords(segmentWords.filter(
  w => w.studyState?.status !== 'MASTERED'
), testSize)
```

**Coverage:** Would cover all leaking paths in both test components.  
**Downside:** Requires changes in 4 places (PATH A, B, C in both MCQTest and TypedTest = 6 edits), higher risk of missing a callsite.

---

### Option 3: Filter in `buildTestConfig`

**Location:** `src/utils/testConfig.js` line 43

```js
const eligiblePool = wordPool.filter(w =>
  (w.status || w.studyState?.status) !== 'MASTERED'
)
const wordsToTest = eligiblePool.length > 0
  ? selectTestWords(eligiblePool, effectiveTestSize)
  : []
```

**Coverage:** Covers PATH A for both MCQTest and TypedTest. Does NOT cover PATH B (legacy wordPool bypasses buildTestConfig) or PATH C (calls selectTestWords directly in test components, not via buildTestConfig).

---

### Recommendation: Filter in `selectTestWords` (Option 1) + one guard in PATH C

**Rationale:**  
`selectTestWords` is the lowest-level chokepoint that all PATH C calls go through. Combined with a filter at the start of `buildTestConfig` (which handles PATH A), this covers every path except PATH B (legacy wordPool).

However, **the single most robust fix** is to filter inside `selectTestWords` itself — because:
1. It is called by PATH C directly in both test components
2. It is called by `buildTestConfig` (which handles PATH A)  
3. New words are never MASTERED, so the filter is a no-op for them
4. `selectTestWords` is also called inside `handleRetake` for new word retakes (`selectTestWords(originalWords, configuredTestSize)`) — harmless

The only path `selectTestWords` does NOT cover is PATH B (legacy wordPool → `generateQuestions` directly without going through `selectTestWords`). PATH B is the crash-recovery path for the **new** test (which is safe) and no longer the main path for review tests. However, to be fully safe, add the same MASTERED filter at the start of `generateQuestions` or `setOriginalWords` calls in PATH B as well.

**Recommended minimal fix:**

1. **In `selectTestWords` (`src/utils/studyAlgorithm.js` line 300):** Add MASTERED filter at top of function. Covers all PATH C invocations and all `buildTestConfig`→PATH A invocations.

2. **In `buildTestConfig` (`src/utils/testConfig.js` line 43) OR at the PATH B entry in MCQTest/TypedTest:** Add same filter. Covers the legacy wordPool path.

**Fields available for filtering:**
- PATH A words (from `getSegmentWords`): `word.studyState.status` — status field IS available
- PATH C words (from `getSegmentWords`): same — IS available  
- PATH B words (legacy `wordPool` from DailySessionFlow crash recovery for new test): no status field, but new words can't be MASTERED — filter is harmless
- Retake words (from `originalWords`, already in test component state): same fields as when originally loaded

**No path identified where words lack status info for MASTERED filtering:**
All review test word pools originate from `getSegmentWords()` which always merges `studyState` (or defaults to `NEVER_TESTED`). MASTERED words always have a `studyState` document. No path reaches the test with words that are MASTERED but missing the `studyState` field.

---

## Quick Reference

```
selectTestWords (studyAlgorithm.js:300)  ← NO MASTERED filter (fix here)
  ↑ called by
buildTestConfig (testConfig.js:43)       ← NO MASTERED filter
  ↑ called by
navigateToTest (DailySessionFlow:1100)   ← uses reviewQueue (from getSegmentWords, unfiltered)
  ↑ called by goToReviewTest, goToNewWordTest, handleNewWordTestRetake

selectTestWords (studyAlgorithm.js:300)  ← NO MASTERED filter (fix here too, same function)
  ↑ called directly by
MCQTest PATH C review branch (MCQTest.jsx:328)
TypedTest PATH C review branch (TypedTest.jsx:384)

buildReviewQueue (studyService.js:564)   ← MASTERED filter EXISTS (line 580) — SAFE
selectReviewQueue (studyAlgorithm.js:215) ← MASTERED backstop EXISTS (line 222) — SAFE
  (but these are STUDY FLASHCARD paths, never reached during test word selection)
```
