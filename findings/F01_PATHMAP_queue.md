# F01 PATHMAP: Review Study Queue Population — Exhaustive Source Trace

**Date:** 2026-05-31  
**Scope:** `src/pages/DailySessionFlow.jsx` + downstream utilities  
**Purpose:** Map every path that populates `reviewQueue` / `reviewQueueCurrent` and determine MASTERED-filter coverage before the test handoff.

---

## 1. Every `setReviewQueue` / `setReviewQueueCurrent` Call

### PATH-1 — `loadReviewQueue` (lines 462–476) — DEAD CODE

```js
// line 462
const loadReviewQueue = useCallback(async (config) => {
  const queue = await buildReviewQueue(...)
  setReviewQueue(queue)        // line 473
  setReviewQueueCurrent(queue) // line 474
}, ...)
```

- **Data source:** `buildReviewQueue`
- **MASTERED filtered?** YES — `buildReviewQueue` explicitly filters `status !== MASTERED` at `studyService.js:580–582` and `selectReviewQueue` in `studyAlgorithm.js:222` adds a backstop filter.
- **Can reach navigateToTest?** N/A — `loadReviewQueue` is **never called** anywhere in the file. Dead code. SAFE by non-use.

---

### PATH-2 — `handleSwitchToCompleteMode` (lines 482–509) — LEAK

```js
// line 490–497
const allWords = await getSegmentWords(
  user.uid, listId,
  sessionConfig.segment.startIndex,
  sessionConfig.segment.endIndex
)
setReviewQueue(allWords)        // line 496
setReviewQueueCurrent(allWords) // line 497
```

- **Data source:** `getSegmentWords` — returns ALL words in the segment range regardless of status.
- **MASTERED filtered?** NO. `getSegmentWords` (`studyService.js:278–308`) fetches words by position range and merges study states; it contains **zero MASTERED filtering**.
- **Can reach navigateToTest?** YES. After complete-mode is activated the user is in `PHASE.REVIEW_STUDY`. They can press "Finish" → `handleFinishReviewStudy` → `goToReviewTest` → `navigateToTest('review', ...)`. At that point `reviewQueue` is the unfiltered `allWords`.
- **STATUS: CONFIRMED LEAK**

---

### PATH-3 — `handleSwitchToFastMode` (lines 511–539) — SAFE

```js
// line 519–527
const queue = await buildReviewQueue(
  user.uid, listId,
  sessionConfig.segment,
  sessionConfig.reviewCount,
  newWordFailedIds
)
setReviewQueue(queue)        // line 526
setReviewQueueCurrent(queue) // line 527
```

- **Data source:** `buildReviewQueue`
- **MASTERED filtered?** YES — double-filtered: `buildReviewQueue` pre-filters (`studyService.js:580`) and `selectReviewQueue` backstops (`studyAlgorithm.js:222`).
- **Can reach navigateToTest?** YES, via same `handleFinishReviewStudy` → `navigateToTest` path.
- **STATUS: SAFE**

---

### PATH-4 — Init: `config.startPhase === SESSION_PHASE.REVIEW_STUDY` (lines 618–641) — LEAK

```js
// line 622–630
const segmentWords = await getSegmentWords(
  user.uid, listId,
  config.segment.startIndex,
  config.segment.endIndex
)
setReviewQueue(segmentWords)        // line 629
setReviewQueueCurrent(segmentWords) // line 630
```

- **Trigger:** Server-side session recovery (Firestore `startPhase === REVIEW_STUDY`); fires when the user passed the new-word test and the server knows to resume at review study.
- **Data source:** `getSegmentWords` — unfiltered.
- **MASTERED filtered?** NO.
- **Can reach navigateToTest?** YES. `setPhase(PHASES.REVIEW_STUDY)` is called at line 640; user can proceed normally to the test.
- **STATUS: CONFIRMED LEAK**

---

### PATH-5 — Init: Same-day resume at REVIEW_STUDY / REVIEW_TEST (lines 802–815) — LEAK

```js
// line 806–813
const allWords = await getSegmentWords(
  user.uid, listId,
  config.segment.startIndex,
  config.segment.endIndex
)
setReviewQueue(allWords)        // line 812
setReviewQueueCurrent(allWords) // line 813
```

- **Trigger:** Firestore `existingState.phase` is `REVIEW_STUDY` or `REVIEW_TEST` AND it's the same calendar day (`isSameDay`).
- **Data source:** `getSegmentWords` — unfiltered.
- **MASTERED filtered?** NO.
- **Can reach navigateToTest?** YES. `setPhase(PHASES.REVIEW_STUDY)` at line 815.
- **STATUS: CONFIRMED LEAK**

---

### PATH-6 — Init: No new words, segment-only day (lines 820–828) — LEAK

```js
// line 820–827
const allWords = await getSegmentWords(
  user.uid, listId,
  config.segment.startIndex,
  config.segment.endIndex
)
setReviewQueue(allWords)        // line 826
setReviewQueueCurrent(allWords) // line 827
```

- **Trigger:** `config.newWordCount === 0` and `config.segment` exists. The session has no new words — goes straight to review.
- **Data source:** `getSegmentWords` — unfiltered.
- **MASTERED filtered?** NO.
- **Can reach navigateToTest?** YES. `setPhase(PHASES.REVIEW_STUDY)` at line 828.
- **STATUS: CONFIRMED LEAK**

---

### PATH-7 — `moveToReviewPhase` (lines 925–973) — LEAK

```js
// line 937–968
const segmentWords = await getSegmentWords(
  user.uid, listId,
  config.segment.startIndex,
  config.segment.endIndex
)
// plus optional prepend of failedWords (new word failures, always status='failed')
let allWords = segmentWords
if (newWordFailedIds ...) {
  allWords = [...failedWords, ...segmentWords]
}
setReviewQueue(allWords)        // line 967
setReviewQueueCurrent(allWords) // line 968
```

- **Trigger:** Called by `handleContinueToReview` (line 913) and from `handleReturnFromTest` when `testType === 'new'` on Day 2+ (line 1261). This is the **normal, happy-path** transition from new-word test → review study.
- **Data source:** `getSegmentWords` — unfiltered. Failed new-word docs are fetched separately and forced to `status: 'failed'` (these are legitimately in-review, not MASTERED).
- **MASTERED filtered?** NO (for the segment portion).
- **Can reach navigateToTest?** YES — this is the primary path leading to `handleFinishReviewStudy` → `navigateToTest('review', ...)`.
- **STATUS: CONFIRMED LEAK** (the main normal-path leak)

---

### PATH-8 — `handleGoToStudy` / Return-from-test "Study" button (lines 1154–1201) — INHERITED

```js
// line 1171
setReviewQueue(state.reviewQueue)      // from sessionStorage
// line 1185
setReviewQueueCurrent([...state.reviewQueue])
```

- **Trigger:** User clicks "Study More" inside MCQTest/TypedTest, returns to DailySessionFlow.
- **Data source:** `state.reviewQueue` from `sessionStorage` — whatever was stored in `navigateToTest` at line 1139, which is whatever was in `reviewQueue` React state at that moment.
- **MASTERED filtered?** Depends entirely on which PATH built the queue before `navigateToTest` was called. If PATH-2/4/5/6/7 built it, MASTERED words are present in sessionStorage and restored here.
- **Can reach navigateToTest?** YES — `setPhase(PHASES.REVIEW_STUDY)` at line 1189; user re-studies and can go to test again.
- **STATUS: INHERITED LEAK** (carries over whatever the source path had)

---

### PATH-9 — `handleReturnFromTest` / Test completion return (lines 1206–1302) — INHERITED

```js
// line 1220
setReviewQueue(state.reviewQueue)  // from sessionStorage
```

- **Trigger:** Test completes, navigates back to DailySessionFlow with `testCompleted` flag.
- **Data source:** `sessionStorage` — same as PATH-8.
- **MASTERED filtered?** Inherited. This sets `reviewQueue` back for display purposes (session summary). The test itself has already run, so this `reviewQueue` is no longer fed into a new test in this context. Used only for `wordsReviewed` count at line 1288.
- **Can reach navigateToTest?** No — `setPhase(PHASES.COMPLETE)` at line 1291.
- **STATUS: NOT A TEST-FEED RISK** (post-completion UI only)

---

### PATH-10 — `handleLocalRecoveryContinue` / localStorage crash recovery (lines 1424–1470) — LEAK

```js
// line 1442–1453
const allWords = await getSegmentWords(
  user.uid, listId,
  sessionConfig.segment.startIndex,
  sessionConfig.segment.endIndex
)
setReviewQueue(allWords)             // line 1448
// re-filter to saved word IDs:
const restoredQueue = allWords.filter(w => queueWordIds.has(w.id))
setReviewQueueCurrent(restoredQueue) // line 1453
```

- **Trigger:** `studyRecovery.lastPhase === 'REVIEW_STUDY'` from localStorage (crash/unexpected exit mid-study). Auto-triggered by `useEffect` at line 1473.
- **Data source:** `getSegmentWords` — unfiltered — then `reviewQueueCurrent` is further narrowed by saved word IDs (not MASTERED-filtered, just ID-filtered from the previously-built queue).
- **MASTERED filtered?** NO. `reviewQueue` is set to the full unfiltered segment. `reviewQueueCurrent` is whatever IDs were saved to localStorage — which could include MASTERED words if they were present in the original queue when the crash happened.
- **Can reach navigateToTest?** YES — `setPhase(PHASES.REVIEW_STUDY)` at line 1456; user can resume and proceed to the test.
- **STATUS: CONFIRMED LEAK**

---

### Additional `setReviewQueueCurrent` mutations (not full resets)

These manipulate `reviewQueueCurrent` but do not set `reviewQueue`; they are not population paths:

| Line | Operation | Notes |
|------|-----------|-------|
| 213 | `filter(w => w.id !== currentWord.id)` | Auto-mode dismiss |
| 987 | `filter(w => w.id !== currentReviewWord.id)` | "Know This" dismiss |
| 1000–1004 | Rotate word to end | "Not Sure" |
| 1015 | `[...reviewQueue]` | Reset (pulls from reviewQueue — inherits its filter state) |
| 1038 | `[...prev, wordData]` | Undo single dismiss |
| 1053 | `[...prev, ...wordsToRestore]` | Restore all dismissed |

Line 1015 (`handleReviewReset`) spreads `reviewQueue` back into `reviewQueueCurrent`. If `reviewQueue` contains MASTERED words, the reset restores them — reinforcing that `reviewQueue` is the authoritative source.

---

## 2. Mode Switch Summary

| Function | Lines | Data Source | MASTERED Filtered? |
|----------|-------|-------------|-------------------|
| `handleSwitchToFastMode` | 511–539 | `buildReviewQueue` | YES (double: pre-filter + backstop) |
| `handleSwitchToCompleteMode` | 482–509 | `getSegmentWords` | NO — LEAK |

Fast mode replaces the queue with a properly filtered algorithmic selection. Complete mode replaces the queue with the **entire raw segment** — intentional UX (show all words) but carries MASTERED words into both study and test.

---

## 3. Crash/Refresh Recovery of REVIEW_STUDY Phase

### 3a. Server-based recovery (`config.startPhase === REVIEW_STUDY`, PATH-4, lines 618–641)

When Firestore attempt history shows the new-word test was passed but the review has not been done, `initializeDailySession` returns `startPhase = SESSION_PHASE.REVIEW_STUDY`. The init effect calls `getSegmentWords` directly — no MASTERED filter. Words are set into `reviewQueue` and `reviewQueueCurrent`.

### 3b. localStorage crash recovery (PATH-10, lines 741–753 + 1424–1470)

The `studyRecovery` object is built from `localReviewState` when `lastPhase === 'REVIEW_STUDY'`. `setPendingLocalRecovery(true)` triggers the useEffect at line 1473 which calls `handleLocalRecoveryContinue`. Inside:

- `getSegmentWords` provides the full unfiltered segment as `reviewQueue`.
- `reviewQueueCurrent` is reconstructed by filtering `allWords` to the saved `studyQueue` word IDs. These IDs came from the localStorage snapshot taken while the user was studying (line 369: `wordPool: wordPool.map(w => ({ id: w.id, word: w.word }))`), which includes whatever MASTERED words were in the queue at crash time.

Neither recovery path filters MASTERED.

---

## 4. Handoff to the Test: `navigateToTest('review')`

```js
// line 1088–1089
const navigateToTest = (testPhase, mode) => {
  const wordPool = testPhase === 'new' ? newWords : reviewQueue
  // ...
  const testConfig = buildTestConfig({ ..., wordPool: wordPool || [], ... })
```

`navigateToTest` reads `reviewQueue` from React state at call time. `buildTestConfig` passes `wordPool` to `selectTestWords` — which does **no MASTERED filtering**. `selectTestWords` (`studyAlgorithm.js:300–311`) is a pure random sampler.

The MASTERED backstop exists in `selectReviewQueue` (`studyAlgorithm.js:222`) — but `navigateToTest` uses `buildTestConfig` → `selectTestWords`, **not** `selectReviewQueue`. Therefore `selectReviewQueue`'s backstop filter is **not invoked** on the test path.

**Which `reviewQueue`-setting paths can reach `navigateToTest`?**

```
PATH-2  (completeMode)   → setReviewQueue(unfiltered) → REVIEW_STUDY → navigateToTest  LEAK
PATH-4  (server recovery)→ setReviewQueue(unfiltered) → REVIEW_STUDY → navigateToTest  LEAK
PATH-5  (same-day resume)→ setReviewQueue(unfiltered) → REVIEW_STUDY → navigateToTest  LEAK
PATH-6  (segment-only)   → setReviewQueue(unfiltered) → REVIEW_STUDY → navigateToTest  LEAK
PATH-7  (moveToReview)   → setReviewQueue(unfiltered) → REVIEW_STUDY → navigateToTest  LEAK (main path)
PATH-8  (goToStudy)      → setReviewQueue(sessionStorage) → REVIEW_STUDY → navigateToTest  INHERITED LEAK
PATH-10 (crash recovery) → setReviewQueue(unfiltered) → REVIEW_STUDY → navigateToTest  LEAK
PATH-3  (fastMode)       → setReviewQueue(filtered)   → REVIEW_STUDY → navigateToTest  SAFE
```

---

## 5. Summary Table

| # | Trigger | Data Source | MASTERED Filtered? | Can Flow into Review TEST? | Status |
|---|---------|-------------|-------------------|---------------------------|--------|
| PATH-1 | `loadReviewQueue` (never called) | `buildReviewQueue` | YES | N/A (dead code) | SAFE (dead) |
| PATH-2 | `handleSwitchToCompleteMode` | `getSegmentWords` | **NO** | **YES** | **LEAK** |
| PATH-3 | `handleSwitchToFastMode` | `buildReviewQueue` | YES | YES | SAFE |
| PATH-4 | Init: server `startPhase=REVIEW_STUDY` | `getSegmentWords` | **NO** | **YES** | **LEAK** |
| PATH-5 | Init: same-day resume REVIEW_STUDY/TEST | `getSegmentWords` | **NO** | **YES** | **LEAK** |
| PATH-6 | Init: no-new-words segment-only day | `getSegmentWords` | **NO** | **YES** | **LEAK** |
| PATH-7 | `moveToReviewPhase` (normal happy path) | `getSegmentWords` | **NO** | **YES** | **LEAK** |
| PATH-8 | Return from test "Study" button | sessionStorage (inherited) | Inherited | **YES** | **INHERITED LEAK** |
| PATH-9 | Return from test (completion) | sessionStorage (inherited) | Inherited | NO (goes to COMPLETE) | SAFE for test |
| PATH-10 | localStorage crash recovery | `getSegmentWords` + saved IDs | **NO** | **YES** | **LEAK** |

---

## 6. Recommendation: Study Layer + Test Layer Both Need Fixing

### Is filtering only at the test layer sufficient?

**No — for two distinct reasons:**

#### Reason A: MASTERED words appear in the STUDY flashcard deck (UX bug)
All unfiltered paths (PATH-2, 4, 5, 6, 7, 10) place MASTERED words in `reviewQueue` and `reviewQueueCurrent`. These words are shown as flashcards during the study phase. The user sees and "studies" words they have already mastered and are supposed to be resting. Even if the test were perfectly clean, the study UX would still be incorrect. For complete-mode (PATH-2) this may be intentional design (show everything), but for PATH-4/5/6/7/10 (normal and recovery flows) it is a straight bug.

#### Reason B: The test layer has NO MASTERED backstop on the review path
`navigateToTest` feeds `reviewQueue` into `buildTestConfig` → `selectTestWords`. `selectTestWords` is a dumb random sampler with no filter. The existing backstop in `selectReviewQueue` (line 222 of `studyAlgorithm.js`) is **never invoked** on the test-navigation path. So adding a filter only at the test layer would require adding it explicitly inside `buildTestConfig` or `selectTestWords`, or adding it in `navigateToTest` before passing to `buildTestConfig`.

### Recommended two-layer fix

**Layer 1 — Study queue (source fix, preferred):** Filter MASTERED words out of `getSegmentWords` results before calling `setReviewQueue` at every call site (PATH-4, 5, 6, 7, 10) — or add filtering inside a shared wrapper. Exception: complete-mode (PATH-2) where showing all words is the stated design intent — but even there, a MASTERED word being shown in study and then passed to the test is a confirmed functional bug.

```js
// Pattern to apply at each getSegmentWords call site before setReviewQueue:
const eligibleWords = segmentWords.filter(
  w => w.studyState?.status !== 'MASTERED'
)
setReviewQueue(eligibleWords)
setReviewQueueCurrent(eligibleWords)
```

**Layer 2 — Test layer (belt-and-suspenders backstop):** Add a MASTERED filter inside `buildTestConfig` or immediately before `navigateToTest` uses `wordPool`. This closes the window where any future new path could forget to filter:

```js
// In navigateToTest, line 1089:
const rawPool = testPhase === 'new' ? newWords : reviewQueue
const wordPool = testPhase === 'review'
  ? rawPool.filter(w => w.studyState?.status !== 'MASTERED' && w.status !== 'MASTERED')
  : rawPool
```

Note that the studyState field name is `studyState.status` for words from `getSegmentWords` (which merges the study state doc into a `.studyState` sub-object). Words from `buildReviewQueue` are re-shaped to have a top-level `.status` field. Both shapes may appear in `reviewQueue` depending on the path, so the filter must check both.

**Regarding complete-mode specifically:** The design intent of complete-mode is to show the whole segment as flashcards. Whether MASTERED words should appear in study is a product decision. However, they must never appear in the test regardless of mode, so Layer 2 is necessary even if Layer 1 exempts complete-mode from filtering.

### Definitive fix scope

The "once and forever" fix requires **both layers**:
1. Filter at every study-queue source (primarily the 5+ `getSegmentWords` → `setReviewQueue` call sites)
2. Filter at `navigateToTest` / `buildTestConfig` as a structural guarantee

Without Layer 1, MASTERED words pollute the study flashcard experience.  
Without Layer 2, any future unfiltered population path creates a new test leak.
