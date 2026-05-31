# VR6 — Utils + Hooks + Components + ListEditor + ThemeContext Verification

**Label:** VR6  
**Date:** 2026-05-31  
**Slice:** findings #20, #21, #32, #33, #34, #41, #45, #46, #59, #61, #62, #63, #64, #65, #66, #67, #68, #69, #72  
**Method:** READ-ONLY. Each cited file:line opened and compared against the claim. No files modified.

---

## Per-Finding Verdicts

---

### #20 — Deleting a word leaves position gaps and causes duplicate positions on next add

**Claim:** `deleteWord` only does `increment(-1)` on `wordCount`; it does not re-sequence `position`. New words get `position = currentCount (== wordCount)`, so after a middle delete (positions 0,1,3,4, wordCount=4) the next add collides at position 4.  
**Cited:** `src/pages/ListEditor.jsx:173-187` (root cause `src/services/db.js:589-599, 531-545`)

**VERDICT: CONFIRMED**

**Evidence:**

`src/services/db.js:589-599` — `deleteWord` does:
```js
await deleteDoc(doc(db, 'lists', listId, 'words', wordId))
await updateDoc(doc(db, 'lists', listId), {
  wordCount: increment(-1),
  updatedAt: serverTimestamp(),
})
```
No position re-sequencing of sibling words.

`src/services/db.js:531-545` — `addWordToList` does:
```js
const listDoc = await getDoc(doc(db, 'lists', listId))
const currentCount = listDoc.exists() ? (listDoc.data()?.wordCount ?? 0) : 0
...
position: currentCount,  // 0-indexed position in list
```
New word gets `position = wordCount`. After deleting the middle word at position 2 from a 5-word list, `wordCount` becomes 4 and remaining words keep positions 0, 1, 3, 4. Next add gets `position = 4` — a collision with the existing word at position 4.

**True severity:** MEDIUM (confirmed — ordering corruption in production for any list that has had a word deleted).  
**Testable via:** unit (db.js helpers) or Playwright (add words, delete middle word, add another, check ordering).

---

### #21 — wordCount and word list desync when add/delete partially fails (no transaction)

**Claim:** Word doc write and the parent-list `wordCount` update are two separate unbatched writes. If the second fails after the first, `wordCount` drifts permanently.  
**Cited:** `src/pages/ListEditor.jsx:181-186, 227-247` (root cause `src/services/db.js:550-554, 594-598`)

**VERDICT: CONFIRMED**

**Evidence:**

`src/services/db.js:550-554` (`addWordToList`):
```js
await addDoc(collection(db, 'lists', listId, 'words'), wordPayload)
await updateDoc(doc(db, 'lists', listId), {
  wordCount: increment(1),
  updatedAt: serverTimestamp(),
})
```
Two sequential `await` calls with no `writeBatch` or `runTransaction`. A failure between them leaves `wordCount` out of sync.

`src/services/db.js:594-598` (`deleteWord`):
```js
await deleteDoc(doc(db, 'lists', listId, 'words', wordId))
await updateDoc(doc(db, 'lists', listId), {
  wordCount: increment(-1),
  updatedAt: serverTimestamp(),
})
```
Same two-step non-atomic pattern for delete.

The `handleAddWord` in `ListEditor.jsx:227-247` additionally re-fetches the word list (via `getDocs`) only after both writes succeed — if the `updateDoc` throws, the catch at line 248 sets an error while the word doc already exists but `wordCount` is stale.

**True severity:** MEDIUM (confirmed — non-atomic writes are a real corruption path, even if transient network failures are infrequent).  
**Testable via:** unit (mock second write to fail), static-only (structural inspection).

---

### #32 — getAutoAnswer can infinite-loop when optionsCount <= 1

**Claim:** The wrong-answer `do/while` loops until it finds an index ≠ `correctIndex`. For a single-option question (reachable via a one-word list), the only candidate (0) equals `correctIndex` (0), so the loop never terminates.  
**Cited:** `src/hooks/useSimulation.jsx:226-230`

**VERDICT: CONFIRMED** (dev/sim-only)

**Evidence:**

`src/hooks/useSimulation.jsx:217-231`:
```js
const getAutoAnswer = useCallback((correctIndex, optionsCount) => {
  const { score } = generateTestScore(profile, 1)

  if (score >= 0.5) {
    return correctIndex
  } else {
    // Answer incorrectly - pick a random wrong answer
    let wrongIndex
    do {
      wrongIndex = Math.floor(Math.random() * optionsCount)
    } while (wrongIndex === correctIndex)
    return wrongIndex
  }
}, [profile])
```
When `optionsCount = 1`, `Math.floor(Math.random() * 1)` always returns `0`, and if `correctIndex = 0` the `while` condition is always true — infinite loop. No guard for `optionsCount <= 1` exists.

**True severity:** MEDIUM **but dev-harness only** — gated behind `VITE_SIMULATION_MODE === 'true'`. Zero production impact. Low real-world impact because production test generation enforces at least 4 options, but the harness itself is vulnerable on small lists.  
**Testable via:** unit (call `getAutoAnswer(0, 1)` in sim context).

---

### #33 — Auto-swipe recursion is not stopped by pause/state changes (stale closure)

**Claim:** `triggerAutoSwipe` schedules a setTimeout that recursively re-calls the closure captured at timer creation (`phase=RUNNING`). If an already-fired callback runs after `pauseSimulation` cleared the ref, it re-schedules a new timer whose stale guard still sees RUNNING.  
**Cited:** `src/hooks/useSimulation.jsx:258-271`

**VERDICT: CONFIRMED** (dev/sim-only)

**Evidence:**

`src/hooks/useSimulation.jsx:258-271`:
```js
const triggerAutoSwipe = useCallback(() => {
  if (phase !== SIM_PHASES.RUNNING || !isAutoMode) return

  const delay = speed.cardDelay
  autoSwipeTimerRef.current = setTimeout(() => {
    if (onCardSwipeRef.current) {
      const dismiss = shouldDismiss()
      onCardSwipeRef.current(dismiss)
      log.incrementCardsStudied()
      // Continue auto-swiping
      triggerAutoSwipe()
    }
  }, delay)
}, [phase, isAutoMode, speed, shouldDismiss, log])
```
`triggerAutoSwipe` is in `useCallback` with `[phase, isAutoMode, ...]` in the dep array. The closure captured by `setTimeout` holds the version of `triggerAutoSwipe` from when it was scheduled. When `pauseSimulation` is called it sets `phase` to PAUSED (state update) and clears `autoSwipeTimerRef.current`, but any callback already in-flight (timer fired before clear) calls the *stale* `triggerAutoSwipe` that still sees `phase === SIM_PHASES.RUNNING`. This re-schedules a new timer, bypassing the pause. Phase state is read from the closure, not a ref.

`pauseSimulation` at line 144-148 only clears the `autoSwipeTimerRef.current` — cannot cancel already-fired callbacks.

**True severity:** MEDIUM **but dev-harness only** — `VITE_SIMULATION_MODE` gated.  
**Testable via:** unit (trigger then pause in rapid succession).

---

### #34 — buildTestConfig caps review test at static testSizeReview, ignoring intervention-scaled review size

**Claim:** Review `effectiveTestSize` is the static `testSizeReview` (default 30), but the review queue is built upstream with intervention-scaled counts (up to 60). `calculateReviewTestSize` exists in `studyAlgorithm.js` but is not called here.  
**Cited:** `src/utils/testConfig.js:40-44`

**VERDICT: CONFIRMED**

**Evidence:**

`src/utils/testConfig.js:39-44`:
```js
// Determine effective test size based on test type
const effectiveTestSize = testType === 'new' ? testSizeNew : testSizeReview
```
For `testType === 'review'`, `effectiveTestSize` is set to `testSizeReview` (assignment setting, defaults to `DEFAULT_TEST_SIZE_REVIEW = 30` from `STUDY_ALGORITHM_CONSTANTS`).

`src/utils/studyAlgorithm.js:196-206`:
```js
export function calculateReviewTestSize(interventionLevel, minSize, maxSize) {
  const min = minSize ?? STUDY_ALGORITHM_CONSTANTS.REVIEW_TEST_SIZE_MIN;
  const max = maxSize ?? STUDY_ALGORITHM_CONSTANTS.REVIEW_TEST_SIZE_MAX;
  const size = min + (max - min) * interventionLevel;
  return Math.round(size);
}
```
The function exists and is correct (linear interpolation 30..60 over `interventionLevel`). The `buildTestConfig` function accepts `sessionContext` (which could carry `interventionLevel`) but never calls `calculateReviewTestSize`. It also receives `reviewTestSizeMin` and `reviewTestSizeMax` (lines 36-37) which are the inputs needed for the scaled calculation.

Meanwhile `sessionTimeCalculator.js:79-81` correctly applies the same linear formula:
```js
const reviewTestSize = Math.round(
  reviewTestSizeMin + (reviewTestSizeMax - reviewTestSizeMin) * interventionLevel
);
```
So `buildTestConfig` and `sessionTimeCalculator` diverge — a struggling student gets up to 60 questions in the time estimate but only 30 in the actual test config.

**True severity:** MEDIUM (confirmed — this is a real product impact on the adaptive mechanic for struggling students; the "intervention" feature is live, not sim-only).  
**Testable via:** unit (`buildTestConfig({ testType:'review', assignment:{...}, sessionContext:{interventionLevel:1.0} })` — verify `wordsToTest.length <= 30` even though the pool has 60).

---

### #41 — Debug console.log statements left in production submit path

**Claim:** Unconditional `DEBUG MCQ Results` / `[DEBUG STUDYDAY]` / `[SUBMIT]` logs on every submission dump uid, per-question results, and session metadata to the console.  
**Cited:** `src/pages/MCQTest.jsx:468-478, 525-551, 559-572`

**VERDICT: CONFIRMED**

**Evidence:**

`src/pages/MCQTest.jsx:467-478`:
```js
// DEBUG: Log all results to find the mismatch
console.log('DEBUG MCQ Results:', {
  testWordsCount: testWords.length,
  answersCount: Object.keys(currentAnswers).length,
  results: results.map((r, i) => ({
    index: i + 1,
    wordId: r.wordId,
    correct: r.correct,
    hasAnswer: !!currentAnswers[r.wordId],
    answerIsCorrect: currentAnswers[r.wordId]?.isCorrect
  }))
})
```

`src/pages/MCQTest.jsx:525-551`: Multiple `console.log('[DEBUG STUDYDAY] ...')` calls on every non-practice submit.

`src/pages/MCQTest.jsx:559-572`:
```js
console.log('[SUBMIT] ═══════════════════════════════════════')
console.log('[SUBMIT] Starting test submission with retry logic')
...
console.log('[SUBMIT] Test data:', {
  userId: user.uid,
  testId,
  attemptDocId,
  answerCount: answerArray.length,
  ...
})
```
All three blocks are unconditional in the hot production submit path. `userId: user.uid` is logged.

**True severity:** LOW (confirmed — noise/hygiene; user's own data only but unconditional logging of uid + test data in production is poor practice).  
**Testable via:** Playwright (submit an MCQ test, check browser console).

---

### #45 — Operator precedence bug: add-word error always shows "Unable to update word."

**Claim:** `err.message ?? editingId ? 'Unable to update word.' : 'Unable to add word.'` parses as `(err.message ?? editingId) ? ...`, so any error with a truthy message always selects "update".  
**Cited:** `src/pages/ListEditor.jsx:249`

**VERDICT: CONFIRMED**

**Evidence:**

`src/pages/ListEditor.jsx:249`:
```js
setWordError(err.message ?? editingId ? 'Unable to update word.' : 'Unable to add word.')
```
JavaScript operator precedence: `??` has lower precedence than ternary `?:`. The expression groups as `(err.message ?? editingId) ? 'Unable to update word.' : 'Unable to add word.'`. When an error occurs during an **add** operation (where `editingId` is `null`), if `err.message` is a truthy string (virtually always), the entire expression evaluates to `'Unable to update word.'` — the wrong message. The intended grouping is `err.message ?? (editingId ? 'Unable to update word.' : 'Unable to add word.')`.

**True severity:** LOW (confirmed — wrong error string shown to user during add failures; no data corruption, just misleading UX).  
**Testable via:** Playwright (attempt to add a word that triggers an error, verify the error message text) or static-only.

---

### #46 — Stale word list after edit when add/update Firestore reload throws

**Claim:** Success state is set and the form reset before the words re-fetch. If the write succeeds but the reload `getDocs` throws, the catch overwrites with an error while the form is already cleared and the table shows pre-edit data — both a success and error state.  
**Cited:** `src/pages/ListEditor.jsx:218-247`

**VERDICT: CONFIRMED**

**Evidence:**

`src/pages/ListEditor.jsx:218-247`:
```js
// (inside try block)
if (editingId) {
  await updateWord(listId, editingId, { ...wordForm, definitions })
  setWordSuccess('Word updated successfully.')   // <-- success set
} else {
  await addWordToList(listId, { ...wordForm, definitions })
  setWordSuccess('Word added to list.')           // <-- success set
}

setWordForm({ word: '', ... })   // <-- form reset
setEditingId(null)               // <-- edit state cleared

const wordsRef = collection(db, 'lists', listId, 'words')
const wordsQuery = query(wordsRef, orderBy('position', 'asc'))
const wordsSnap = await getDocs(wordsQuery)       // <-- may throw
setWords(wordsSnap.docs.map(...))
```
Then the `catch` at line 248:
```js
} catch (err) {
  setWordError(err.message ?? editingId ? 'Unable to update word.' : 'Unable to add word.')
}
```
If `getDocs` throws (after write succeeded and success was set), the catch sets `wordError`, leaving the UI showing both a success banner (already rendered from `setWordSuccess`) and an error state, with the word table showing stale pre-edit data. The form is already cleared so the user cannot easily re-submit.

**True severity:** LOW (confirmed — uncommon failure path, but the mixed success+error state is genuinely confusing UX).  
**Testable via:** unit (mock `getDocs` to throw after write succeeds).

---

### #59 — Theme effect always persists to localStorage, making the system-preference listener dead code

**Claim:** The effect writes `vocaboost-theme` on every run including mount, so the listener's `if (!stored)` branch is never reached — "follow system preference" never updates on OS theme changes.  
**Cited:** `src/contexts/ThemeContext.jsx:112-125`

**VERDICT: CONFIRMED**

**Evidence:**

`src/contexts/ThemeContext.jsx:77-87` — theme effect:
```js
useEffect(() => {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  localStorage.setItem('vocaboost-theme', theme)  // always writes
}, [theme])
```
This runs on every mount with the initial `theme` value (loaded from localStorage or defaulting to `'light'`). After mount, `localStorage.getItem('vocaboost-theme')` always returns a non-null string.

`src/contexts/ThemeContext.jsx:112-125` — system listener:
```js
const handleChange = (e) => {
  const stored = localStorage.getItem('vocaboost-theme')
  if (!stored) {
    setTheme(e.matches ? 'dark' : 'light')
  }
}
```
`stored` is never null after the first mount effect runs, so `if (!stored)` is always false. The system preference change handler is permanently dead code from the first render onward. A user who wants OS-driven theming gets no follow-through on OS changes.

**True severity:** LOW (confirmed — real behavioral bug: system-preference following is advertised/supported in the context API but non-functional).  
**Testable via:** static-only (structural analysis confirms the invariant). Playwright can confirm by changing OS preference programmatically.

---

### #61 — onSessionComplete setTimeout is never cleared (leaked timer)

**Claim:** The 500ms timer calling `navigateRef.current(...)` isn't stored in a ref or cleared in stop/reset/unmount. Stopping/unmounting within the window still navigates.  
**Cited:** `src/hooks/useSimulation.jsx:127-131`

**VERDICT: CONFIRMED** (dev/sim-only)

**Evidence:**

`src/hooks/useSimulation.jsx:114-132`:
```js
const onSessionComplete = useCallback(() => {
  if (!isFullSimulation || !sessionTarget) return

  dateProvider.advanceDays(1)

  const nextDay = currentDay + 1
  setCurrentDay(nextDay)
  log.startDay(nextDay)
  updateLiveStats({ dayNumber: nextDay, phase: 'restarting' })

  // Navigate back to session after short delay
  setTimeout(() => {
    if (navigateRef.current && sessionTarget) {
      navigateRef.current(`/session/${sessionTarget.classId}/${sessionTarget.listId}`)
    }
  }, 500)
}, [isFullSimulation, sessionTarget, currentDay, log, updateLiveStats])
```
The `setTimeout` return value is not captured into any ref. The cleanup effect at line 376-381 only clears `autoSwipeTimerRef.current` and `autoAnswerTimerRef.current` — the session-complete timer is never tracked or cleared.

`stopSimulation` (line 160-167) does not clear any timer associated with `onSessionComplete`. If the user stops the simulation within 500ms of a session completing, the navigation fires anyway.

**True severity:** LOW **but dev-harness only** — `VITE_SIMULATION_MODE` gated. In the sim harness, this causes erroneous navigation-after-stop.  
**Testable via:** unit (call `onSessionComplete()`, then `stopSimulation()` within 500ms, assert no navigation).

---

### #62 — completeDay's day-scoped issue filtering misses warnings/errors lacking dayNumber in context

**Claim:** `completeDay` filters issues by `i.context?.dayNumber === dayNumber`, but `logMismatch` is called with `{ check, tolerance }` and no `dayNumber` — so per-day summaries under-report failures.  
**Cited:** `src/hooks/useSimulationLog.js:140`

**VERDICT: CONFIRMED** (dev/sim-only)

**Evidence:**

`src/hooks/useSimulationLog.js:140`:
```js
issues: issues.filter(i => i.context?.dayNumber === dayNumber),
```

`src/hooks/useSimulationLog.js:97-109` — `logMismatch`:
```js
const logMismatch = useCallback((expected, actual, context) => {
  const issue = {
    id: Date.now(),
    type: 'MISMATCH',
    severity: 'warning',
    expected,
    actual,
    context,     // <-- whatever the caller passes
    message: `Expected ${expected}, got ${actual}`
  }
  ...
```

`src/hooks/useSimulation.jsx:298-306` — `validateExpectation` (the primary caller of `logMismatch`):
```js
const validateExpectation = useCallback((name, expected, actual, tolerance = 0.05) => {
  ...
  if (!passed) {
    log.logMismatch(expected, actual, { check: name, tolerance })
    //                                  ^^^^^^^^^^^^^^^^^^^^
    //                                  no dayNumber field
  }
```
No `dayNumber` is included in the context object. When `completeDay` filters `i.context?.dayNumber === dayNumber`, these mismatches evaluate `undefined === dayNumber` which is always false — they are excluded from per-day summaries. The global `issues` array does include them, so `generateSummary` counts them in the total, but per-day `passed` determination misses them.

**True severity:** LOW **but dev-harness only** — inaccurate per-day audit reports; no production impact.  
**Testable via:** unit (call `validateExpectation` then `completeDay`, check returned `summary.issues.length`).

---

### #63 — Event/issue ids use Date.now() and collide, breaking React keys

**Claim:** `logEvent` uses `Date.now() + Math.random()`, but `logError`/`logMismatch` use plain `Date.now()`. Issues created in the same millisecond share ids, producing duplicate React keys.  
**Cited:** `src/hooks/useSimulationLog.js:81, 99`

**VERDICT: CONFIRMED** (dev/sim-only)

**Evidence:**

`src/hooks/useSimulationLog.js:28-29` — `logEvent`:
```js
id: Date.now() + Math.random(),
```

`src/hooks/useSimulationLog.js:81-82` — `logError`:
```js
const issue = {
  id: Date.now(),    // no Math.random()
```

`src/hooks/useSimulationLog.js:99` — `logMismatch`:
```js
const issue = {
  id: Date.now(),    // no Math.random()
```
Two rapid calls to `logError` or `logMismatch` within the same millisecond (common in synchronous simulation loops) produce identical `id` values. If these issues are rendered in a list, React will warn about duplicate keys and reconciliation behavior is undefined.

**True severity:** LOW **but dev-harness only** — affects dev log panel rendering only.  
**Testable via:** unit (call `logMismatch` twice synchronously, check `issues[0].id !== issues[1].id`).

---

### #64 — 'both' test-mode time estimate double-counts the middle question for odd sizes

**Claim:** `halfSize = Math.ceil(size/2)` is used for both MCQ and typed halves, so for odd sizes (e.g. 51 → 26+26=52) the estimate is inflated by one question.  
**Cited:** `src/utils/sessionTimeCalculator.js:68-69`

**VERDICT: CONFIRMED**

**Evidence:**

`src/utils/sessionTimeCalculator.js:66-69`:
```js
} else if (testMode === 'both') {
  // Assume half MCQ, half typed
  const halfSize = Math.ceil(actualNewTestSize / 2);
  newWordTestSec = (halfSize * times.MCQ_QUESTION_SEC) + (halfSize * times.TYPED_QUESTION_SEC);
}
```
For `actualNewTestSize = 51`: `halfSize = Math.ceil(51/2) = 26`. Both MCQ and typed get 26 questions, computing `26*20 + 26*40 = 1560s`. The correct split for 51 questions would be 26 MCQ + 25 typed = 51 total, computing `26*20 + 25*40 = 1520s`. The overcount is one `TYPED_QUESTION_SEC = 40s` for any odd test size.

**True severity:** LOW (confirmed — display estimate only; no test data corruption; inflated by at most 40s for odd test sizes).  
**Testable via:** unit (`calculateSessionTime({ testMode:'both', testSizeNew:51, ... })` — verify `newWordTest.items` matches expectation).

---

### #65 — PDF definition cell ignores rich fallbacks whenever word.definition is present

**Claim:** `definitionText` only appends `definitions.ko`, and `buildDefinitionCell` (which handles all languages, `definitionKo`, secondary defs, etc.) is used only when `definitionText` is empty. A word with `definition` set but translations in `definitions.es`/`.fr`/`definitionKo` silently drops them.  
**Cited:** `src/utils/pdfGenerator.js:137-143`

**VERDICT: CONFIRMED**

**Evidence:**

`src/utils/pdfGenerator.js:137-143`:
```js
const definitionText = (word.definition || '') + (word.definitions?.ko ? `\n[KR] ${word.definitions.ko}` : '')
...
definitionText?.trim()?.length ? definitionText : buildDefinitionCell(word),
```
When `word.definition` is a non-empty string, `definitionText` is truthy and `buildDefinitionCell(word)` is never called. The cell only contains the English definition plus Korean if present. If the word also has `definitions.es`, `definitions.fr`, `definitionKo` (legacy field), or secondary definitions, those are silently dropped from the PDF.

`buildDefinitionCell` (line referenced elsewhere in the file) handles multiple language fallbacks but is bypassed entirely whenever `word.definition` exists.

**True severity:** LOW (confirmed — PDF output is subtly incomplete for multilingual words; English-only lists are unaffected).  
**Testable via:** unit (pass a word with `definition` + `definitions.es` to `wordsToTableBody`, assert cell contains Spanish text).

---

### #66 — speak() leaves utterance handlers/promise dangling on browser silent-failure

**Claim:** `speak()` resolves only on `onend`, rejects only on `onerror`. When speechSynthesis silently drops an utterance (rapid `cancel()`, Chrome pause bug), neither fires — `await speak(...)` never settles, the `finally` in callers never runs.  
**Cited:** `src/utils/tts.js:23-36`

**VERDICT: CONFIRMED**

**Evidence:**

`src/utils/tts.js:7-37`:
```js
export const speak = (text, lang = 'en-US') => {
  return new Promise((resolve, reject) => {
    ...
    utterance.onend = () => { resolve() }
    utterance.onerror = (event) => { reject(new Error(...)) }
    try {
      window.speechSynthesis.speak(utterance)
    } catch (error) {
      reject(new Error(...))
    }
  })
}
```
The promise only settles via `onend` (success) or `onerror` (error). The `window.speechSynthesis.cancel()` at line 15 is called *before* queuing — this cancels any prior utterance, not the new one. However, known browser behaviors (Chrome >15s pause bug, rapid cancel-then-speak cycles, background tab suspension) can cause the utterance to be silently discarded with neither `onend` nor `onerror` firing. In those cases, the returned Promise never settles — any `await speak(...)` call hangs indefinitely. No timeout or abort mechanism exists.

**True severity:** LOW (confirmed — not a crash, but an indefinite hang in callers that await `speak()`; depends on browser/tab state).  
**Testable via:** unit (mock `speechSynthesis.speak` to not fire events, assert promise settles within a timeout).

---

### #67 — MasteryBars wordsPerSquare defaults to 1 when totalWords is 0, fully filling grid

**Claim:** When `totalWords=0` but `masteredCount>0`, `wordsPerSquare` falls back to 1, filling the 28-square grid, while `masteryPercent` shows 0% — a visual contradiction.  
**Cited:** `src/components/MasteryBars.jsx:8-16`

**VERDICT: PARTIAL**

**Evidence:**

`src/components/MasteryBars.jsx:6-19`:
```js
const MasteryBars = ({ totalWords = 0, masteredCount = 0 }) => {
  const safeTotalWords = Math.max(0, totalWords)
  const safeMastered = Math.min(Math.max(0, masteredCount), safeTotalWords || masteredCount)
  const wordsPerSquare = safeTotalWords > 0 ? safeTotalWords / totalSquares : 1
  const rawFullSquares = Math.floor(safeMastered / wordsPerSquare)
  const fullSquares = Math.min(rawFullSquares, totalSquares)
  ...
  const masteryPercent =
    safeTotalWords > 0 ? Math.round((safeMastered / safeTotalWords) * 100) : 0
```
The logic is subtler than stated. When `totalWords=0`:
- `safeTotalWords = 0`
- `safeMastered = Math.min(Math.max(0, masteredCount), 0 || masteredCount) = Math.min(masteredCount, masteredCount) = masteredCount`
- `wordsPerSquare = 1` (the fallback)
- `rawFullSquares = Math.floor(masteredCount / 1) = masteredCount`
- `fullSquares = Math.min(masteredCount, 28)`
- `masteryPercent = 0` (because `safeTotalWords > 0` is false)

So the claim is **confirmed** when `masteredCount > 0` and `totalWords = 0`: up to 28 squares fill (visual says mastered), but the text shows "0% Mastered" and "N / — words". The visual directly contradicts the numeric display.

However, the claim says "fully filling the grid from masteredCount" — this is accurate only when `masteredCount >= 28`. For smaller values (e.g., `masteredCount=3, totalWords=0`) only 3 squares fill, which is still inconsistent but not "fully filling."

The **core bug is confirmed**: `safeMastered` is incorrectly set to `masteredCount` instead of 0 when `totalWords=0` (line 8: `safeTotalWords || masteredCount` resolves to `masteredCount` when `safeTotalWords=0`). This creates the contradiction. The fix (render zero filled squares when `safeTotalWords === 0`) is correct.

**True severity:** LOW (confirmed with nuance — cosmetic visual contradiction; occurs only on malformed data where `masteredCount > totalWords`).  
**Testable via:** unit (render `<MasteryBars totalWords={0} masteredCount={5} />`, assert `fullSquares === 0`).

---

### #68 — ImportWordsModal debug console.log leaks imported word contents

**Claim:** `console.log('ImportWordsModal → Sending to DB:', wordsToImport[0])` runs unguarded on every import.  
**Cited:** `src/components/ImportWordsModal.jsx:195`

**VERDICT: CONFIRMED**

**Evidence:**

`src/components/ImportWordsModal.jsx:195`:
```js
console.log('ImportWordsModal → Sending to DB:', wordsToImport[0])
```
Unconditional, in the production code path, logs the full first word object to the console on every import operation. The word object includes `word`, `definition`, `partOfSpeech`, `sampleSentence`, and any secondary language definitions.

**True severity:** LOW (confirmed — user's own vocabulary data only, but unguarded debug logging in production is poor practice; consistent with #41 as part of a systemic pattern).  
**Testable via:** Playwright (import a word file, check browser console for the log).

---

### #69 — Disabled CardButton div lacks aria-disabled and dim/cursor styling never applies

**Claim:** The div branch uses `disabled:opacity-60 disabled:cursor-not-allowed`, but Tailwind's `disabled:` variant maps to CSS `:disabled` which a `<div>` can never match — dim/cursor styling never applies. Also omits `aria-disabled`.  
**Cited:** `src/components/ui/buttons/CardButton.jsx:50-67`

**VERDICT: CONFIRMED** (with nuance on the aria-disabled claim)

**Evidence:**

`src/components/ui/buttons/CardButton.jsx:23-31` — base classes:
```js
const baseClasses = `
  block w-full text-left
  transition-all duration-200
  cursor-pointer
  hover:-translate-y-1 hover:shadow-xl
  active:translate-y-0 active:scale-[0.99] active:shadow-md
  disabled:cursor-not-allowed disabled:opacity-60 
  disabled:hover:translate-y-0 disabled:hover:shadow-none
`.trim().replace(/\s+/g, ' ')
```

`src/components/ui/buttons/CardButton.jsx:50-67` — div branch:
```js
return (
  <div
    ref={ref}
    role="button"
    tabIndex={disabled ? -1 : 0}
    onClick={disabled ? undefined : onClick}
    onKeyDown={(e) => {
      if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        onClick?.(e)
      }
    }}
    className={combinedClasses}
    {...props}
  >
    {children}
  </div>
)
```
The `disabled:` Tailwind variant generates CSS like `[disabled]:opacity-60` or `:disabled { opacity: 60% }` — neither applies to a `<div>`. The element has `role="button"` but no `aria-disabled` attribute. Click and keydown are correctly guarded by JS. However, the visual dim and pointer change never render for disabled divs.

Note: The `<Link>` branch (when `to` is provided and `!disabled`) is never rendered when `disabled=true`, so the disabled state always hits the div branch.

**True severity:** LOW (confirmed — visual affordance missing for disabled state; accessibility gap with missing `aria-disabled`).  
**Testable via:** Playwright (render disabled CardButton, check opacity and cursor) or static-only (structural).

---

### #72 — StudySelectionModal stats block renders based on always-truthy stats object

**Claim:** `list.stats` is set to `(list.stats || {})`, so the `{list.stats && (...)}` guard is always true — the "words learned" row always renders. Functionally fine via `?? 0`.  
**Cited:** `src/components/modals/StudySelectionModal.jsx:87-93`

**VERDICT: CONFIRMED**

**Evidence:**

`src/components/modals/StudySelectionModal.jsx:33`:
```js
stats: list.stats || {},
```
`list.stats` is always set to at least `{}` (empty object). An empty object `{}` is truthy in JavaScript.

`src/components/modals/StudySelectionModal.jsx:87-93`:
```js
{list.stats && (
  <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
    <span>
      {list.stats.wordsLearned ?? 0} / {list.wordCount} words learned
    </span>
  </div>
)}
```
The `list.stats &&` guard is dead — `list.stats` is always truthy. The "words learned" row always renders. With `?? 0`, a list with no real stats shows "0 / N words learned" (which may be acceptable), but the conditional guard implies intent to suppress this row when there are no stats.

**True severity:** NITPICK (confirmed — cosmetic; `?? 0` makes it functionally safe, but the dead guard is misleading and shows a falsely initialized stat).  
**Testable via:** static-only.

---

## STATUS BLOCK

### Verdict Table

| ID | Claim | VERDICT | True Sev | Real-Prod vs Dev-Harness | Testable Via |
|----|-------|---------|----------|--------------------------|--------------|
| #20 | Delete leaves position gaps; next add collides | CONFIRMED | MEDIUM | **Real-prod** | Playwright / unit |
| #21 | wordCount+wordDoc non-atomic; desync on partial fail | CONFIRMED | MEDIUM | **Real-prod** | unit / static-only |
| #32 | getAutoAnswer infinite-loop on optionsCount<=1 | CONFIRMED | MEDIUM | **Dev-harness only** | unit |
| #33 | Auto-swipe stale closure bypasses pause | CONFIRMED | MEDIUM | **Dev-harness only** | unit |
| #34 | buildTestConfig ignores intervention-scaled review size | CONFIRMED | MEDIUM | **Real-prod** | unit |
| #41 | Debug console.log in production submit path | CONFIRMED | LOW | **Real-prod** | Playwright |
| #45 | Operator precedence: add error always says "update" | CONFIRMED | LOW | **Real-prod** | Playwright / static |
| #46 | Stale word list + mixed success+error when reload fails | CONFIRMED | LOW | **Real-prod** | unit |
| #59 | Theme effect writes localStorage on mount; system listener dead | CONFIRMED | LOW | **Real-prod** | static-only |
| #61 | onSessionComplete setTimeout never cleared | CONFIRMED | LOW | **Dev-harness only** | unit |
| #62 | completeDay filters mismatches with no dayNumber (under-report) | CONFIRMED | LOW | **Dev-harness only** | unit |
| #63 | logError/logMismatch use Date.now() with no random; id collisions | CONFIRMED | LOW | **Dev-harness only** | unit |
| #64 | 'both' mode double-counts middle question for odd sizes | CONFIRMED | LOW | **Real-prod** (display only) | unit |
| #65 | PDF ignores non-KO translations when word.definition present | CONFIRMED | LOW | **Real-prod** | unit |
| #66 | speak() promise never settles on browser silent-failure | CONFIRMED | LOW | **Real-prod** | unit |
| #67 | MasteryBars fills squares when totalWords=0, masteredCount>0 | PARTIAL | LOW | **Real-prod** (malformed data) | unit |
| #68 | ImportWordsModal debug console.log on every import | CONFIRMED | LOW | **Real-prod** | Playwright |
| #69 | Disabled CardButton: disabled: CSS variant inert on div; no aria-disabled | CONFIRMED | LOW | **Real-prod** | Playwright / static |
| #72 | StudySelectionModal stats guard always truthy | CONFIRMED | NITPICK | **Real-prod** (cosmetic) | static-only |

### Counts

| Verdict | Count |
|---------|-------|
| CONFIRMED | 18 |
| PARTIAL | 1 |
| FALSE | 0 |
| OVERSTATED | 0 |
| **Total** | **19** |

### Classification

| Category | IDs | Notes |
|----------|-----|-------|
| Real-product bugs | #20, #21, #34, #41, #45, #46, #59, #64, #65, #66, #68, #69, #72 | 13 findings — affect production users |
| Dev-harness only | #32, #33, #61, #62, #63 | 5 findings — gated behind `VITE_SIMULATION_MODE=true`; zero production impact |
| Cosmetic / display-only | #64, #67, #72 | Subset — correct behavior, wrong visual/text |

### Priority Notes for Fixes

**Highest impact real-prod (MEDIUM):**
- **#20 + #21** together: position gaps + non-atomic writes in ListEditor/db.js — one writeBatch wrapping both the word doc and wordCount update fixes both, and a post-delete re-sequence fixes #20
- **#34**: `buildTestConfig` must call `calculateReviewTestSize(interventionLevel, reviewTestSizeMin, reviewTestSizeMax)` for `testType='review'`

**Quick wins (LOW, real-prod):**
- **#45**: Add parens — `err.message ?? (editingId ? '...' : '...')` — one character change
- **#41 + #68**: Remove all 4 `console.log` blocks in MCQTest.jsx submit path and ImportWordsModal
- **#59**: ThemeContext system-preference listener: store explicit "user chose this" flag separately from localStorage; gate the listener on that flag
- **#69**: Add `aria-disabled={disabled}` and replace `disabled:opacity-60` with `disabled ? 'opacity-60 cursor-not-allowed' : ''` conditional class

**Dev-harness sweep (#32, #33, #61, #62, #63):** Treat as one unit — fix sim harness timer lifecycle, add `optionsCount <= 1` guard, pass `dayNumber` in `validateExpectation` context, use `Date.now() + Math.random()` uniformly.
