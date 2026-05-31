# F01 MASTERED-Retirement Lifecycle Analysis (MAP-LIFECYCLE)

**Question:** Is the F01 filter `status !== 'MASTERED'` sufficient everywhere, or does it need `!(status === 'MASTERED' && returnAt > now)` to be correct?

---

## 1. WHERE MASTERED IS SET: `graduateSegmentWords`

**File:** `src/services/studyService.js` lines 888–902

```js
// 5. Batch update to MASTERED status
const batch = writeBatch(db);
const now = Timestamp.now();
const returnAt = new Timestamp(now.seconds + (21 * 24 * 60 * 60), 0); // 21 days

for (const word of toGraduate) {
  const stateRef = doc(db, `users/${userId}/study_states`, word.id);
  batch.set(stateRef, {
    status: WORD_STATUS.MASTERED,
    masteredAt: now,
    returnAt: returnAt,
    wordIndex: word.position,
    listId: listId
  }, { merge: true });
}
```

- `returnAt` = exactly now + 21 days (seconds precision, nanoseconds = 0).
- **No other code path sets status to `MASTERED`** — confirmed by full-codebase grep.

---

## 2. WHERE MASTERED IS CLEARED → NEEDS_CHECK: `returnMasteredWords`

**File:** `src/services/studyService.js` lines 920–946

```js
export async function returnMasteredWords(userId, listId) {
  const now = Timestamp.now();

  const expiredQuery = query(
    collection(db, 'users', userId, 'study_states'),
    where('listId', '==', listId),
    where('status', '==', WORD_STATUS.MASTERED),
    where('returnAt', '<=', now)
  );

  const expiredSnap = await getDocs(expiredQuery);
  if (expiredSnap.empty) return 0;

  const batch = writeBatch(db);
  for (const docSnap of expiredSnap.docs) {
    batch.set(docSnap.ref, {
      status: WORD_STATUS.NEEDS_CHECK,
      masteredAt: null,
      returnAt: null
    }, { merge: true });
  }

  await batch.commit();
  return expiredSnap.size;
}
```

### When / where is `returnMasteredWords` called?

**Only one call site exists in the entire codebase:**

`src/pages/DailySessionFlow.jsx` line 579:

```js
// Return any MASTERED words that have passed their 21-day period
await returnMasteredWords(user.uid, listId)
```

### Call order within `init()` (the PHASE 0 `useEffect`):

```
init() {
  1. getDoc(classRef)                         // fetch class
  2. getDoc(listRef)                          // fetch list title
  3. getSessionState(...)                     // check existing Firestore session state
  4. await returnMasteredWords(...)           // LINE 579 — flips expired MASTERED → NEEDS_CHECK
  5. await initializeDailySession(...)        // calculates segment, allocation, phase
  6. [various phase-recovery branches]        // all use getSegmentWords / buildReviewQueue AFTER step 4
  7. load new words / segment words           // all reads happen AFTER step 4
}
```

### Does it run on EVERY session entry, or only some paths?

The `useEffect` has this guard at the top:

```js
if (location.state?.testCompleted) return   // DailySessionFlow.jsx line 548
```

This means the init effect (and therefore `returnMasteredWords`) is **skipped** when returning from a completed test (the `handleReturnFromTest` effect at line 1206 handles that path instead). `handleReturnFromTest` does NOT call `returnMasteredWords`.

However, on return from test, no new Firestore study_states reads occur for the review queue — the reviewQueue is restored from sessionStorage (saved before navigating to the test), so no stale data issue arises on this path.

**Bottom line:** `returnMasteredWords` is called on every FRESH session entry through `DailySessionFlow`. It is NOT called on the `testCompleted` return path (but that path doesn't re-read study_states for queue building).

---

## 3. GAP ANALYSIS: Entry paths that read study_states without `returnMasteredWords` running first

### PATH A (Normal session flow) — SAFE

Flow: `DailySessionFlow init()` → `returnMasteredWords` (line 579) → `initializeDailySession` → (various `getSegmentWords` / `buildReviewQueue` calls) → `navigateToTest`.

All reads happen AFTER `returnMasteredWords` completes. Expired-MASTERED words are already NEEDS_CHECK by the time any queue or test pool is built. **`status !== 'MASTERED'` is correct here.**

### Crash-recovery test path — SAFE

Flow: `DailySessionFlow init()` → `returnMasteredWords` (line 579) → crash-recovery check (line 697) → navigate to test with saved wordPool from localStorage.

`returnMasteredWords` runs BEFORE the crash-recovery check. The recovered wordPool came from localStorage (saved before the crash from the original session), not a fresh Firestore read. **Safe.**

### Mid-session recovery (REVIEW_STUDY startPhase) — SAFE

Flow: `DailySessionFlow init()` → `returnMasteredWords` (line 579) → `getSegmentWords` (line 622) → `setReviewQueue`.

Reads happen after returnMasteredWords. **Safe.**

### Complete-mode switch (`handleSwitchToCompleteMode`) — SAFE for retirement invariant, study-display only

Calls `getSegmentWords` (line 490) — no MASTERED filter. Returns ALL words including still-MASTERED ones. But this is for **study flashcards display**, not the test word pool. `reviewQueue` here is later used as the test wordPool via `navigateToTest` (line 1089). `returnMasteredWords` already ran during init, so any MASTERED words here are genuinely within their 21-day rest. **`status !== 'MASTERED'` filter applied at the test layer would correctly exclude them.**

### PATH C: Direct URL navigation (MCQTest/TypedTest standalone) — RISKY GAP

Both `MCQTest.jsx` (lines 295–335) and `TypedTest.jsx` (lines 351–392) have a PATH C triggered when no `testConfig` and no `wordPool` are passed (i.e., user navigates directly to `/mcqtest/:classId/:listId` without going through `DailySessionFlow`).

In PATH C (review type):
```js
// MCQTest.jsx lines 313-328 / TypedTest.jsx lines 369-384
const config = await initializeDailySession(user.uid, classIdParam, listId, { ... })

if (config.segment) {
  const segmentWords = await getSegmentWords(
    user.uid,
    listId,
    config.segment.startIndex,
    config.segment.endIndex
  )
  wordsToTest = selectTestWords(segmentWords, testSize)
}
```

**`returnMasteredWords` is NOT called here.** `getSegmentWords` returns ALL words including expired-MASTERED words that still have `status === 'MASTERED'` in Firestore (because nobody flipped them to NEEDS_CHECK).

- If the F01 fix adds `status !== 'MASTERED'` filter here, it would **wrongly exclude** an overdue word that should have returned to review. The word has `status === 'MASTERED'` but `returnAt <= now` — it should be treated as NEEDS_CHECK.
- **A simple `status !== 'MASTERED'` filter is INCORRECT in PATH C for expired-MASTERED words.**
- The correct filter for PATH C is: `!(status === 'MASTERED' && (!returnAt || returnAt > now))`
- In practice, PATH C only fires on pure direct URL navigation (no session context), which is an edge case. Normal users always go through DailySessionFlow.

### Retake path — SAFE

`MCQTest.jsx` line 807 / `TypedTest.jsx` line 909: navigates to the test with `testConfig: sessionContext` (which was already built during the original session and contains pre-selected words). No new study_states reads occur. **Safe.**

---

## 4. RECOMMENDATION: Which filter is correct?

### For the PRIMARY paths (DailySessionFlow normal flow, crash-recovery, mid-session recovery):

**`status !== 'MASTERED'` is SUFFICIENT and correct.**

Reasoning: `returnMasteredWords` runs at line 579 in `DailySessionFlow.init()`, before ANY `getSegmentWords`, `buildReviewQueue`, or `navigateToTest` call. After that, every word with `status === 'MASTERED'` is guaranteed to have `returnAt > now` (still within its 21-day rest). There are no expired-MASTERED words in Firestore by the time any queue or test pool is built. A simple status filter correctly excludes them.

### For PATH C (standalone test, direct URL navigation):

**`status !== 'MASTERED'` alone is INCORRECT for expired-MASTERED words.**

Because `returnMasteredWords` never runs in PATH C, an expired-MASTERED word (`returnAt <= now`) still has `status === 'MASTERED'`. The simple filter would exclude it, wrongly preventing a word that should re-enter review from appearing. The correct filter is:

```js
// Exclude only words that are MASTERED AND still within their retirement period
.filter(w => !(w.status === 'MASTERED' && w.returnAt && w.returnAt.toMillis() > Date.now()))
```

Or equivalently: include a word if it is NOT MASTERED, OR if it is MASTERED but expired.

**Practical guidance:**

- If the F01 fix is applied **only at the DailySessionFlow-guarded layers** (buildReviewQueue, selectReviewQueue, navigateToTest's wordPool), the simple `status !== 'MASTERED'` filter is safe because `returnMasteredWords` always precedes these reads.
- If the fix is also applied in **PATH C** (MCQTest/TypedTest standalone word loading), use the `returnAt`-aware filter, or better: call `returnMasteredWords` at the start of PATH C before reading study_states.
- The cleanest fix: add `await returnMasteredWords(userId, listId)` to PATH C before `getSegmentWords` — then `status !== 'MASTERED'` works everywhere uniformly.

### Current F01 fix placements and their correctness:

| Location | returnMasteredWords runs first? | Simple filter safe? |
|---|---|---|
| `selectReviewQueue` backstop (studyAlgorithm.js:222) | Yes (DailySessionFlow always calls it) | YES |
| `buildReviewQueue` filter (studyService.js:580-582) | Yes | YES |
| `navigateToTest` → `buildTestConfig` wordPool (DailySessionFlow:1089) | Yes | YES |
| PATH C: MCQTest/TypedTest `getSegmentWords` (MCQTest:322, TypedTest:378) | **NO** | **NO — needs returnAt check or call returnMasteredWords first** |

---

## 5. NEEDS_CHECK RE-ENTRY

`returnMasteredWords` sets expired words to `status: NEEDS_CHECK` (studyService.js:938).

`selectReviewQueue` in `studyAlgorithm.js` (lines 271–280) has a **Priority 4: NEEDS_CHECK bucket**:

```js
// Priority 4: NEEDS_CHECK words (returned from MASTERED after their 21-day rest;
// returnMasteredWords flips MASTERED -> NEEDS_CHECK, but without this bucket those
// words would never be re-selected for review and stay stuck out of rotation).
if (remaining > 0) {
  const needsCheck = segmentWords.filter(w =>
    w.status === 'NEEDS_CHECK' && !queueIds.has(w.id)
  );
  const shuffledNeedsCheck = shuffleArray(needsCheck);
  const needsCheckToAdd = shuffledNeedsCheck.slice(0, remaining);
  // ...
  queue.push(...needsCheckToAdd);
}
```

NEEDS_CHECK words **DO re-enter the review queue** via `selectReviewQueue` (Priority 4, after FAILED/NEVER_TESTED). This covers the review STUDY and review TEST paths that go through `buildReviewQueue`.

**PATH C and the test layer (TEST PATH):** In PATH C, `getSegmentWords` returns all words including NEEDS_CHECK. `selectTestWords` is a pure shuffle-and-slice with no status filter. So NEEDS_CHECK words naturally flow into PATH C tests. However, the test-layer has no explicit NEEDS_CHECK bucket — they simply appear as any other non-MASTERED word.

**Conclusion for NEEDS_CHECK re-entry:** Re-entry works correctly in the `buildReviewQueue`/`selectReviewQueue` path (the main flow). PATH C would include NEEDS_CHECK in tests automatically since there's no filter excluding them. No additional NEEDS_CHECK handling is required for PATH C tests — only the MASTERED exclusion gap needs addressing.

---

## STATUS BLOCK

**Where MASTERED is SET:** Only in `graduateSegmentWords` — `src/services/studyService.js` lines 888–902. Sets `status: MASTERED`, `returnAt: now + 21 days`. No other setter.

**Where/when `returnMasteredWords` runs:** Called at `src/pages/DailySessionFlow.jsx` line 579, inside `init()`, BEFORE any `getSegmentWords`, `buildReviewQueue`, or `navigateToTest` call. Runs on every fresh session entry through DailySessionFlow. NOT called on `testCompleted` return path (but that path doesn't re-read study_states). NOT called in MCQTest/TypedTest PATH C (standalone direct URL navigation).

**Is `status !== 'MASTERED'` sufficient?**
- **YES** for all paths routed through DailySessionFlow (the normal flow, crash-recovery, mid-session recovery, complete-mode). `returnMasteredWords` guarantees all remaining MASTERED words have `returnAt > now` before any queue/test read.
- **NO** for PATH C (MCQTest/TypedTest standalone, direct URL). `returnMasteredWords` never runs. Expired-MASTERED words (`returnAt <= now`) still have `status === MASTERED` in Firestore. The simple filter would wrongly exclude overdue words. Fix options: (a) add `await returnMasteredWords(userId, listId)` at the start of PATH C, enabling simple filter, or (b) use `!(status === 'MASTERED' && returnAt?.toMillis() > Date.now())` in PATH C.

**Any path that reads study_states before `returnMasteredWords` runs:** Yes — PATH C (MCQTest/TypedTest lines 322/378, TypedTest lines 378/384). These are triggered only by direct URL navigation without session context, not by normal user flows.

**NEEDS_CHECK re-entry:** NEEDS_CHECK words re-enter the review queue via Priority 4 in `selectReviewQueue` (`src/utils/studyAlgorithm.js` lines 271–280). They flow into test words naturally through `getSegmentWords` → `selectTestWords` in PATH C. No additional handling needed beyond ensuring MASTERED words are correctly filtered.
