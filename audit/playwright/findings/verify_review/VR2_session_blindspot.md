# VR2 — Code Review Verification: DailySessionFlow.jsx + BlindSpotCheck.jsx

**Slice:** Findings #4, #8, #22, #23, #35, #36, #47, #71  
**Verified against:** working-tree (`/app/src/pages/`) + `git show HEAD:...` for origin/main  
**Date:** 2026-05-31  
**Reviewer:** VR2 agent (read-only; no files modified)

> **Working-tree note:** `DailySessionFlow.jsx` has uncommitted edits from `vocaboost_ALL_fixes.patch`:  
> - `excludeRetiredMastered` import added  
> - Six `getSegmentWords(...)` calls wrapped with `excludeRetiredMastered(...)`  
> - Crash-recovery marker block inserted in `navigateToTest` (~line 1143)  
>
> `BlindSpotCheck.jsx` is **identical** to origin/main (clean, no uncommitted edits).  
> Where a finding's cited lines are near these edits, the verdict states which tree is affected.

---

## Finding #4 — [HIGH] Submit failure destroys the in-progress test

**Claim:** `handleSubmit` catches a failed `processTestResults` with `setError(...)`. The full-page error early-return (`if (error) return ...`) precedes the test render, so any transient submit failure replaces the entire test UI — up to 30 collected answers become inaccessible with no retry. Cited: `BlindSpotCheck.jsx:118-135, 151-163`.

**VERDICT: CONFIRMED**

**Evidence:**

`src/pages/BlindSpotCheck.jsx:118-135` — `handleSubmit`:
```jsx
const handleSubmit = async () => {
  if (submitting) return
  setSubmitting(true)
  try {
    const testResults = questions.map((q, idx) => ({
      wordId: q.wordId,
      correct: answers[idx] === q.correctIndex
    }))
    const summary = await processTestResults(user.uid, testResults, listId)
    setResults(summary)
  } catch (err) {
    setError(err.message || 'Failed to submit test')   // line 131 — writes to shared error state
  } finally {
    setSubmitting(false)
  }
}
```

`BlindSpotCheck.jsx:151-163` — full-page error render guard precedes all other render branches:
```jsx
if (error) {
  return (
    <main className="...">
      <Watermark />
      <div ...>
        <p className="text-red-700 dark:text-red-300">{error}</p>
        <Button onClick={() => navigate('/')} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    </main>
  )
}
```

The `error` state is shared between the initial-load path (line 64) and the submit path (line 131). On any submit failure, `setError(...)` fires and the full-page error overlay replaces the test UI — the student's `answers` state, `questions`, and `currentQuestion` remain in memory but are unreachable. No retry mechanism exists. The only escape is "Back to Dashboard," which loses all answers.

This applies to **both origin/main and working-tree** — `BlindSpotCheck.jsx` is unchanged.

**True severity:** HIGH — confirmed as cited.  
**Playwright-testable:** YES — intercept `processTestResults` to throw (via `page.route`), answer some questions, click Submit, verify the error overlay appears and the test questions are no longer visible.

---

## Finding #8 — [MEDIUM] moveToReviewPhase fetches failed-new-word docs without error handling

**Claim:** `Promise.all` over raw `getDoc` for each failed word ID with no try/catch. Called from `handleContinueToReview` (no surrounding handling), so a rejection becomes an unhandled rejection — the Continue button does nothing, no error UI shows, and the user is stuck. Cited: `DailySessionFlow.jsx:944-959`.

**VERDICT: CONFIRMED (applies to origin/main; partially fixed in working tree — wrapping gone but bug persists)**

**Evidence — origin/main** (`git show HEAD`, lines 944–959):
```js
let allWords = segmentWords
if (newWordFailedIds && newWordFailedIds.length > 0) {
  const failedWordDocs = await Promise.all(
    newWordFailedIds.map(wordId => getDoc(doc(db, 'lists', listId, 'words', wordId)))
  )
  ...
}
```
No try/catch wrapping this `Promise.all`. `moveToReviewPhase` itself has no try/catch. `handleContinueToReview` at line 912–914 is:
```js
const handleContinueToReview = async () => {
  await moveToReviewPhase()
}
```
No error handling there either. A Firestore getDoc rejection propagates to an unhandled promise rejection; the Continue button becomes a no-op with no user feedback.

**Working-tree:** The `getSegmentWords` call on line 937 (origin) is unchanged — still no try/catch. The `excludeRetiredMastered` wrapping added by the patch does not add error handling. The `Promise.all` block for failed words (lines 948–959 in working tree) is also unchanged. The finding applies to **both trees**.

The review claim also correctly notes "the `getSegmentWords` call on line 937 is similarly unguarded" — confirmed: `const segmentWords = await getSegmentWords(...)` on line 937 is inside `moveToReviewPhase` with no try/catch.

**True severity:** MEDIUM — confirmed as cited.  
**Playwright-testable:** YES (with effort) — requires mocking Firestore or simulating a network failure mid-session after a failed new-word test. Could use `page.route` to intercept Firestore REST calls to word docs and force a rejection, then click "Continue to Review" and verify no progress occurs and no error message appears.

---

## Finding #22 — [MEDIUM] 'Remaining blind spots' count double-counts just-failed words

**Claim:** `remainingBlindSpots = blindSpotPool.length - questions.length + results.failed.length`. A just-failed word is excluded from a freshly reloaded pool (not NEVER_TESTED, `lastTestedAt` is now), yet the expression re-adds `results.failed.length`, so the displayed count disagrees with the actual next pool. Cited: `BlindSpotCheck.jsx:255`.

**VERDICT: CONFIRMED**

**Evidence:**

`src/pages/BlindSpotCheck.jsx:255`:
```jsx
const remainingBlindSpots = blindSpotPool.length - questions.length + results.failed.length
```

The expression is exactly as described. `blindSpotPool` is the pre-test snapshot (loaded on mount, not refreshed after submission). `questions` is the subset of the pool that was actually tested (sliced by `TEST_SIZE = 30`). `results.failed.length` is the count of words failed in this test run.

The claim's reasoning: after processing, failed words are now "recently tested" (their `lastTestedAt` is updated), so they would *not* appear in a fresh call to `getBlindSpotPool`. Adding `results.failed.length` back to the remaining count incorrectly inflates it. The "Test More Blind Spots" button then loads a pool that is actually smaller than what is displayed.

This applies to **both origin/main and working-tree** — `BlindSpotCheck.jsx` is unchanged.

**True severity:** MEDIUM — confirmed as cited; the displayed count misleads the student about remaining work.  
**Playwright-testable:** YES — take a blind spot test to completion with at least one failure, observe the "Remaining blind spots" value, click "Test More Blind Spots," and compare the actual pool count displayed on the new pre-test screen against the earlier displayed remaining count.

---

## Finding #23 — [MEDIUM] MCQ generation can produce fewer than 4 options when the blind spot pool is small

**Claim:** Distractors are drawn from the blind spot subset sliced to 3; a pool of 1–3 words yields 1–3 options (a 1-word pool renders only the correct answer). No de-duplication. Only guard is `length === 0`. Cited: `BlindSpotCheck.jsx:85-107`.

**VERDICT: CONFIRMED**

**Evidence:**

`src/pages/BlindSpotCheck.jsx:85-107` — `generateMCQQuestions`:
```jsx
const generateMCQQuestions = (testWords, allWords) => {
  const optionsCount = 4

  return testWords.map(word => {
    const others = allWords.filter(w => w.id !== word.id)
    const shuffledOthers = [...others].sort(() => Math.random() - 0.5)
    const distractors = shuffledOthers.slice(0, optionsCount - 1)   // max 3 distractors

    const options = [
      { text: word.definition, isCorrect: true },
      ...distractors.map(d => ({ text: d.definition, isCorrect: false }))
    ].sort(() => Math.random() - 0.5)
    ...
  })
}
```

- `allWords` is the `blindSpotPool` passed in from `handleStartTest`.
- `others = allWords.filter(w => w.id !== word.id)` — for a 2-word pool with word A being tested: `others` has 1 entry.
- `distractors = shuffledOthers.slice(0, 3)` — yields 1 distractor, not 3.
- Result: 2-option question rendered (correct answer + 1 distractor).
- For a 1-word pool: `others` is empty, `distractors = []`, question has only 1 option (the correct answer alone).
- No de-duplication of identical definition strings.
- The only guard is `if (blindSpotPool.length === 0)` on line 190 which prevents starting the test at all — but pool sizes of 1–3 pass that guard.

This applies to **both origin/main and working-tree** — `BlindSpotCheck.jsx` is unchanged.

**True severity:** MEDIUM — confirmed as cited; renders a broken MCQ UI for small pools.  
**Playwright-testable:** YES — requires a test account with a list containing 1–3 never-tested words. Navigate to `/blindspot/:classId/:listId`, start the test, and verify that question options rendered are fewer than 4. Could also check that the option count equals `Math.min(4, poolSize)`.

---

## Finding #35 — [LOW] Auto-swipe simulation effect has stale closures and leaks nested setTimeouts

**Claim:** The effect's nested `setTimeout` calls (lines 227–236) calling `goToNewWordTest`/`handleFinishReviewStudy` are not tracked; cleanup only clears the outer `autoSwipeTimerRef`, so on phase change/unmount those callbacks still fire (navigation after unmount). Dep array omits `sim` and the handlers (largely benign since session config is set once). Sim-mode only. Cited: `DailySessionFlow.jsx:178-246`.

**VERDICT: CONFIRMED**

**Evidence:**

`src/pages/DailySessionFlow.jsx:177–246` (identical in both origin/main and working-tree — this region was not modified by the patch):

```jsx
useEffect(() => {
  ...
  autoSwipeTimerRef.current = setTimeout(() => {
    ...
    if (phase === PHASES.NEW_WORDS) {
      setShowTestConfirm(true)
      setTimeout(() => {                        // line 227 — UNTRACKED nested timer
        setShowTestConfirm(false)
        goToNewWordTest()
      }, delay)
    } else if (phase === PHASES.REVIEW_STUDY) {
      setShowTestConfirm(true)
      setTimeout(() => {                        // line 233 — UNTRACKED nested timer
        setShowTestConfirm(false)
        handleFinishReviewStudy()
      }, delay)
    }
    ...
  }, delay)

  return () => clearTimeout(autoSwipeTimerRef.current)  // line 245 — only clears OUTER timer
}, [sim?.isAutoMode, phase, currentIndex, isFlipped, newWordsQueue, reviewQueueCurrent])
```

The two nested `setTimeout` return values are not stored; `clearTimeout(autoSwipeTimerRef.current)` only clears the outer timeout. If the component unmounts or the phase changes while the inner timer is pending, `goToNewWordTest` or `handleFinishReviewStudy` still fires.

Additionally, the dep array omits `sim` itself (used as `sim.shouldDismiss()` and `sim.log`) and `goToNewWordTest`/`handleFinishReviewStudy` (both non-memoized functions). These are largely benign in practice since `sim` and session config don't change mid-session.

This applies to **both origin/main and working-tree** — this region is unchanged by the patch.

**Simulation-only item** — gated behind `!sim?.isAutoMode || !isSimulationEnabled()`.

**True severity:** LOW — confirmed as cited; limited to simulation mode.  
**Playwright-testable:** YES (sim mode only) — run a simulation session with auto-mode, trigger the end-of-queue path, then unmount (navigate away) within the `delay` window and verify no navigation occurs after unmount. Requires `VITE_SIMULATION_MODE=true`.

---

## Finding #36 — [LOW] handleLocalRecoveryContinue clamps currentIndex to studyQueue length, not the restored queue

**Claim:** The restored queue can be shorter than the saved `studyQueue` (some saved ids no longer in the reloaded pool), but `currentIndex` is clamped to `studyQueue.length - 1`. If `restoredQueue` is shorter, `currentWord` is undefined and the "All cards reviewed!" empty state renders prematurely. Cited: `DailySessionFlow.jsx:1434-1460`.

**VERDICT: CONFIRMED (applies to both origin/main and working-tree)**

**Evidence:**

`src/pages/DailySessionFlow.jsx:1480` (working-tree; identical line in origin/main at line 1459):
```jsx
setCurrentIndex(Math.min(savedIndex || 0, (studyQueue?.length || 1) - 1))
```

For the **new-word** path (lines 1453–1459 in working-tree):
```jsx
const restoredQueue = newWords.filter(w => queueWordIds.has(w.id))
setNewWordsQueue(restoredQueue)
...
```
`restoredQueue.length` can be less than `studyQueue.length` if any saved word IDs are no longer present in the reloaded `newWords`. The clamp uses `studyQueue.length - 1` (the saved ID list), not `restoredQueue.length - 1`. If `restoredQueue.length = 2` but `studyQueue.length = 5` and `savedIndex = 3`, `currentIndex` is set to 3, which is out-of-bounds for `restoredQueue`, making `currentNewWord = restoredQueue[3] = undefined`.

For the **review** path (lines 1460–1477):
```jsx
const restoredQueue = allWords.filter(w => queueWordIds.has(w.id))
setReviewQueueCurrent(restoredQueue)
```
Same scenario — `currentIndex` is clamped to `studyQueue.length - 1`, not `restoredQueue.length - 1`.

The working-tree patch added `excludeRetiredMastered` wrapping around `allWords` (line 1463), which can further reduce `restoredQueue` by filtering out MASTERED words, exacerbating the out-of-bounds risk. The clamp bug itself is unchanged by the patch.

**True severity:** LOW — confirmed as cited; triggers the "no current word" empty-state prematurely on crash recovery.  
**Playwright-testable:** YES (with setup) — requires a scenario where some words in the saved queue are removed from the pool between save and restore. In practice, needs a MASTERED word in the queue or a deleted word. Could be forced by: completing a study session that saves state, mastering one of the queued words externally, then simulating a crash-recovery re-entry. Verify that the recovered UI does not show an empty-card state with remaining items in the list.

---

## Finding #47 — [LOW] Unhandled promise rejection in 'Test More Blind Spots' handler

**Claim:** The async onClick awaits `getBlindSpotPool` with no try/catch. On failure, `testStarted=false`/`results=null` are already set but the pool isn't refreshed and no error shows. UI stays interactive — not a hang. Cited: `BlindSpotCheck.jsx:296-308`.

**VERDICT: CONFIRMED**

**Evidence:**

`src/pages/BlindSpotCheck.jsx:296-308`:
```jsx
<Button 
  onClick={async () => {
    setTestStarted(false)
    setResults(null)
    // Reload pool
    const pool = await getBlindSpotPool(user.uid, listId)
    setBlindSpotPool(pool)
  }} 
  variant="outline"
>
  Test More Blind Spots
</Button>
```

State mutations `setTestStarted(false)` and `setResults(null)` are called before the `await`. If `getBlindSpotPool` rejects:
1. The unhandled rejection is swallowed (no `.catch`).
2. `setBlindSpotPool(pool)` never runs — `blindSpotPool` retains its pre-test value (the original pool from mount, not refreshed).
3. `testStarted = false`, `results = null` — the pre-test landing screen renders with the stale pool count.
4. No error message is shown to the user.

As noted in the claim, the UI is still interactive (not a hang) — the student sees the old pool count and can click "Start Blind Spot Test" again.

This applies to **both origin/main and working-tree** — `BlindSpotCheck.jsx` is unchanged.

**True severity:** LOW — confirmed as cited; user sees stale pool info but can retry.  
**Playwright-testable:** YES — intercept `getBlindSpotPool` call (via network interception of Firestore) to force a rejection on the second call only, complete the first test, click "Test More Blind Spots," and verify no error UI appears and the pre-test screen shows the old pool count rather than a fresh one.

---

## Finding #71 — [NITPICK] setState calls after await with no unmount guard

**Claim:** The `load()` effect and "Test More" handler call setState after awaited Firestore calls with no mounted guard. React 18+ removed the unmounted-setState warning, so this is now a wasted-work no-op rather than a warning. Cited: `BlindSpotCheck.jsx:50-71, 297-302`.

**VERDICT: CONFIRMED (as nitpick — no functional impact in React 18+)**

**Evidence:**

`BlindSpotCheck.jsx:50-71` — `load()` function inside `useEffect`:
```jsx
const load = async () => {
  setLoading(true)
  try {
    const listSnap = await getDoc(listRef)        // async boundary — no guard
    if (listSnap.exists()) {
      setListDetails({ id: listSnap.id, ...listSnap.data() })   // setState after await
    }
    const pool = await getBlindSpotPool(user.uid, listId)        // second async boundary
    setBlindSpotPool(pool)        // setState after await, no mounted check
    setPoolLoaded(true)
  } catch (err) {
    setError(err.message || 'Failed to load blind spots')
  } finally {
    setLoading(false)
  }
}
```

`BlindSpotCheck.jsx:297-302` — "Test More" handler:
```jsx
onClick={async () => {
  setTestStarted(false)
  setResults(null)
  const pool = await getBlindSpotPool(user.uid, listId)   // async boundary
  setBlindSpotPool(pool)    // setState after await, no mounted check
}}
```

No `let cancelled = false` / cleanup guard exists in either location. In React 18+ (this project uses React 19), calling setState on an unmounted component is a no-op — no console warning, no memory leak beyond the closed-over variables. The fix (adding a cancellation flag) is good hygiene but has no observable user-facing impact.

This applies to **both origin/main and working-tree** — `BlindSpotCheck.jsx` is unchanged.

**True severity:** NITPICK — confirmed as cited; React 19 suppresses the warning and the behavior is a no-op.  
**Playwright-testable:** NO — no observable UI consequence to assert against in React 18+. Could only be verified via React DevTools profiling or a custom test hook.

---

## STATUS BLOCK

### Per-ID Verdict Table

| ID  | Sev      | Verdict   | Applies to            | Playwright-testable |
|-----|----------|-----------|-----------------------|---------------------|
| #4  | HIGH     | CONFIRMED | both trees            | y                   |
| #8  | MEDIUM   | CONFIRMED | both trees            | y (with effort)     |
| #22 | MEDIUM   | CONFIRMED | both trees            | y                   |
| #23 | MEDIUM   | CONFIRMED | both trees            | y (needs small pool)|
| #35 | LOW      | CONFIRMED | both trees (sim only) | y (sim mode)        |
| #36 | LOW      | CONFIRMED | both trees            | y (needs setup)     |
| #47 | LOW      | CONFIRMED | both trees            | y                   |
| #71 | NITPICK  | CONFIRMED | both trees            | n                   |

### Counts

| Verdict    | Count |
|------------|-------|
| CONFIRMED  | 8     |
| FALSE      | 0     |
| OVERSTATED | 0     |
| PARTIAL    | 0     |
| **Total**  | **8** |

### Playwright-Testable Findings

- **#4** — Intercept `processTestResults` to throw, answer some questions, click Submit, verify full-page error overlay appears and test questions are gone.
- **#8** — Intercept Firestore word-doc reads to force rejection after new-word test failure, click "Continue to Review," verify no error message and button becomes non-functional.
- **#22** — Complete a blind spot test with failures, read "Remaining blind spots" value, click "Test More Blind Spots," compare displayed count against actual fresh pool size on pre-test screen.
- **#23** — Use a list with 1–3 never-tested words, navigate to `/blindspot/:classId/:listId`, start test, verify fewer than 4 options rendered per question.
- **#35** — (Sim mode, `VITE_SIMULATION_MODE=true`) Run auto-mode simulation to end-of-queue, navigate away within the inner setTimeout delay, verify no navigation fires post-unmount.
- **#36** — Set up a crash-recovery scenario where some saved queue word IDs are missing from the reloaded pool (e.g. a word was MASTERED externally), trigger recovery, verify `currentWord` is defined and the active card renders correctly.
- **#47** — Intercept `getBlindSpotPool` (second call only) to reject, complete first blind spot test, click "Test More Blind Spots," verify no error UI and the stale pool count is displayed.

### Simulation-only items
- **#35** is gated behind `sim?.isAutoMode && isSimulationEnabled()` — production users never hit this path.
