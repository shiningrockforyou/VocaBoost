# VR1 — Test Components Verification
**Slice:** findings #1, #2, #14, #15, #16, #17, #40
**Files:** `src/pages/TypedTest.jsx`, `src/pages/MCQTest.jsx`
**Verifier note:** Working tree has uncommitted patches to both files (retake route path and retake button UI). Origin/main is the deployed baseline. Per-finding analysis distinguishes the two states.

---

## #1 — submitError retry UI is unreachable in TypedTest (overlay only renders while isSubmitting)

**Claim:** After save failure the code calls `setSubmitError(...)` then `setIsSubmitting(false)`. The error/retry button render only inside `{isSubmitting && (...)}`, so with `isSubmitting=false` they never render.

**VERDICT: CONFIRMED (TypedTest) / FALSE for MCQTest**

**Evidence:**

`src/pages/TypedTest.jsx:701-707` (origin/main and working tree identical):
```js
} catch (submitErr) {
  setSubmitError('Failed to save your test results. Please try again.')
  setIsSubmitting(false)
  return
}
```

`src/pages/TypedTest.jsx:1400, 1433`:
```js
{isSubmitting && (
  ...
  {submitError && (
    <div ...>
      <p ...>{submitError}</p>
      <button onClick={handleSubmit}>Retry Submission</button>
    </div>
  )}
)}
```

The only occurrence of `submitError` in TypedTest's JSX is at line 1418 (origin/main), nested inside the `{isSubmitting && ...}` block. Once `setIsSubmitting(false)` fires, the whole overlay disappears, hiding the error with it. The user is silently returned to the test with no error feedback and no retry affordance.

**MCQTest is different:** It has an inline `{submitError && ...}` block at line 1306 (origin/main) that lives OUTSIDE the `{submitting && ...}` overlay and IS visible after submit failure. Finding #1 only applies to TypedTest.

**Applies to:** origin/main (deployed) AND working tree (patch did not change error overlay logic).

**True severity: HIGH** — A TypedTest submit failure after three AI-grading retries silently returns the student to the test with no error feedback. The student cannot retry from the UI; the only recovery is a page reload (which triggers the localStorage recovery flow).

**Playwright testable: YES** — Intercept/mock the Firestore `submitTestAttempt` call (via service worker or network interception) to reject after retries, then complete a TypedTest and verify that an error message is visible after submission fails. The hidden state is directly observable in the rendered DOM.

---

## #2 — resultsProcessedRef never reset on 'new'-test retake, skipping processTestResults

**Claim:** `handleRetake('new')` resets React state but not `resultsProcessedRef.current`. The `if (!resultsProcessedRef.current)` guard in `handleSubmit` then skips `processTestResults` for the retake attempt, so word stats/mastery are never updated for the retake.

**VERDICT: CONFIRMED**

**Evidence:**

`src/pages/TypedTest.jsx:106`: `const resultsProcessedRef = useRef(false)`

`src/pages/TypedTest.jsx:830-845` (handleRetake 'new' branch — origin/main and working tree):
```js
if (currentTestType === 'new') {
  setResponses({})
  setFocusedIndex(0)
  setShowResults(false)
  setCanRetake(false)
  setTestResultsData(null)
  setResults(null)
  const shuffled = selectTestWords(originalWords, configuredTestSize)
  const cappedWords = shuffled.slice(0, MAX_TYPED_TEST_WORDS)
  setWords(cappedWords)
  inputRefs.current = new Array(cappedWords.length)
  return   // <-- resultsProcessedRef.current never set to false
}
```

`src/pages/TypedTest.jsx:714-722` (handleSubmit guard):
```js
if (!resultsProcessedRef.current) {
  await processTestResults(user.uid, resultsArray, listId)
  resultsProcessedRef.current = true
}
```

`src/pages/MCQTest.jsx:731-743` (same omission in MCQTest 'new' retake):
```js
if (currentTestType === 'new') {
  setAnswers({})
  answersRef.current = {}
  setCurrentIndex(0)
  setShowResults(false)
  setCanRetake(false)
  setTestResultsData(null)
  const shuffled = selectTestWords(originalWords, configuredTestSize)
  generateQuestions(shuffled)
  return   // <-- resultsProcessedRef.current never set to false
}
```

`resultsProcessedRef` is set to `true` on first successful submit and never reset. A 'new'-test retake stays on the same component mount, so the ref is already `true` when the retake submits. `processTestResults` is skipped, and study_states are never updated with the retake's grading.

The code review cited this as a "residual of persistence audit #4 (Applied)". The patch (`vocaboost_ALL_fixes.patch`) does NOT touch `resultsProcessedRef` — confirmed by `git diff HEAD -- src/pages/TypedTest.jsx | grep resultsProcessedRef` (no output). The bug is live in origin/main and the working tree.

**True severity: HIGH** — Retaking a new-word test that was failed does not update word mastery/study_states, meaning word statistics permanently diverge from the gradebook attempt record.

**Playwright testable: YES** — With simulation mode enabled, trigger a new-word test that scores below the retake threshold (manipulate sim accuracy), click Try Again, complete the retake, then query Firestore (or inspect via a debug route/panel) to verify study_states were updated for the retake attempt. The split-brain is observable by comparing the attempt's `answers[].isCorrect` with `study_states[wordId].status`.

---

## #14 — Simulation auto-answer reads word.text but word objects use word.word

**Claim:** The sim auto-answer generator reads `word.text`, but word docs expose `.word`. Correct branch assigns `undefined`; the typo branch evaluates `undefined.length`, throwing a TypeError.

**VERDICT: CONFIRMED (sim-mode only)**

**Evidence:**

`src/pages/TypedTest.jsx:162-175`:
```js
if (shouldBeCorrect) {
  answer = word.text             // <-- word docs expose .word, not .text
} else {
  const typoChance = Math.random()
  if (typoChance < 0.5 && word.text.length > 2) {   // <-- TypeError when word.text is undefined
    const pos = Math.floor(Math.random() * word.text.length)
    answer = word.text.slice(0, pos) + 'x' + word.text.slice(pos + 1)
  } else {
    answer = 'wronganswer'
  }
}
```

Contrast with the real submit path at line 628-634, which uses `word.word`:
```js
const answersToGrade = words.map((word) => ({
  wordId: word.id,
  word: word.word,           // <-- correct field
  correctDefinition: word.definition,
  ...
}))
```

When `shouldBeCorrect` is true: `answer = word.text = undefined`. This records `undefined` as the response, which grades as incorrect regardless of the student's actual knowledge.

When `shouldBeCorrect` is false AND `typoChance < 0.5`: `word.text.length` throws `TypeError: Cannot read properties of undefined (reading 'length')`, crashing the simulation auto-answer effect.

**Dev-only flag:** This only activates when `VITE_SIMULATION_MODE=true` AND `sim.isAutoMode` is true. No production impact.

**True severity: MEDIUM** (as rated) — but effectively LOW for production since it's sim-only. For the simulation harness's utility as an audit tool, it is HIGH.

**Playwright testable: YES (sim-mode only)** — Launch with `VITE_SIMULATION_MODE=true`, enable auto-mode on a TypedTest, observe a JavaScript console error (`TypeError: Cannot read properties of undefined`) or verify that answers are marked incorrect even when shouldBeCorrect was intended.

---

## #15 — Auto-answer effect double-increments currentIndex in MCQTest, skipping every other question

**Claim:** The effect calls `handleAnswerSelect` (which advances the index) then advances it again, jumping by 2 and skipping every other question in simulation.

**VERDICT: CONFIRMED (sim-mode only)**

**Evidence:**

`src/pages/MCQTest.jsx:131-144`:
```js
autoAnswerTimerRef.current = setTimeout(() => {
  handleAnswerSelect(currentWord.id, selectedOption)   // <-- increments currentIndex by 1

  if (currentIndex < testWords.length - 1) {
    setCurrentIndex(prev => prev + 1)                  // <-- increments currentIndex by 1 again
  } else {
    setTimeout(() => { handleSubmit() }, delay)
  }
}, delay)
```

`src/pages/MCQTest.jsx:403-416` (handleAnswerSelect):
```js
const handleAnswerSelect = (wordId, option) => {
  answersRef.current[wordId] = option
  setAnswers(...)
  if (currentIndex < testWords.length - 1) {
    setCurrentIndex(prev => prev + 1)    // <-- already advances here
  }
}
```

In React 19 (using createRoot / concurrent features), both `setCurrentIndex(prev => prev + 1)` calls within the same setTimeout callback are batched into one render but the functional updaters are applied sequentially: the state transitions from `n → n+1 → n+2`, skipping every other word. The skipped word gets no answer recorded (`answersRef.current` for that wordId remains unset), so it scores as incorrect.

**Dev-only flag:** Only activates when `VITE_SIMULATION_MODE=true` AND `sim.isAutoMode` is true.

**True severity: MEDIUM** (as rated) — sim-only, but makes simulation grading unreliable/meaningless. Odd-indexed words are always skipped.

**Playwright testable: YES (sim-mode only)** — Launch with sim auto-mode on an MCQTest with ≥4 questions. Verify in the results that words at index 1, 3, 5, ... are all marked incorrect (they were skipped). Observable by inspecting the gradebook entry's per-word breakdown.

---

## #16 — Gradebook answerArray uses async `answers` state while scoring uses synced ref, diverging on auto-submit

**Claim:** `results`/summary use `answersRef.current` (sync), but `answerArray` (gradebook payload) is built from the `answers` state. On sim auto-submit, the state closure omits the last answer while the ref includes it.

**VERDICT: PARTIAL**

**Evidence:**

`src/pages/MCQTest.jsx:458-517`:
```js
const currentAnswers = answersRef.current          // sync ref
const results = testWords.map((word) => ({
  wordId: word.id,
  correct: currentAnswers[word.id]?.isCorrect || false  // from ref
}))
...
const answerArray = Object.entries(answers).map(([wordId, option]) => {  // from state
  ...
})
```

The structural divergence IS real: `results` (which drives score, pass/fail, and `processTestResults`) uses `answersRef.current`, while `answerArray` (which populates the gradebook attempt's `answers` field) uses the `answers` state. These can differ.

**However, the specific split-brain scenario described is less certain.** The auto-answer effect for the last question calls `handleAnswerSelect` then schedules `handleSubmit()` in a NESTED `setTimeout` with `delay`. By the time the nested timeout fires (another `delay`ms, default 100ms), React has had sufficient time to re-render and flush the state update from `setAnswers`. The `handleSubmit` closure would be captured from before the re-render, but in React 19 concurrent mode the timing is not deterministic.

The finding is sound in identifying the ref-vs-state divergence as an architectural issue (they should share one source of truth), but the claimed split-brain on auto-submit is hard to reproduce reliably in production. The bug is more theoretical than consistently observable.

**True severity: MED** (as rated, but leans LOW in practice for normal submission paths). The architectural issue is real and should be fixed regardless.

**Playwright testable: PARTIAL** — The architectural split is not reliably testable via Playwright since it depends on React render timing. However, a test could verify consistency between the displayed score and the gradebook entry's `answers` array length for auto-submitted MCQ tests in sim mode.

---

## #17 — Recovery resume restores answers without validating against regenerated testWords; also leaves canRetake/retakeThreshold stale

**Claim:** `handleRecoveryResume` restores saved `answers` and `currentIndex` with no validation. `testWords` are freshly generated (possibly a different subset). A `validateTestState` helper exists in `utils/testRecovery.js` but is unused.

**VERDICT: CONFIRMED**

**Evidence:**

`src/pages/MCQTest.jsx:381-394`:
```js
const handleRecoveryResume = () => {
  clearIntentionalExitFlag(testId)
  if (savedRecoveryState?.answers) {
    setAnswers(savedRecoveryState.answers)
    answersRef.current = { ...savedRecoveryState.answers }
    if (savedRecoveryState.currentIndex !== undefined) {
      setCurrentIndex(savedRecoveryState.currentIndex)  // no clamp
    }
  }
  setShowRecoveryPrompt(false)
  setSavedRecoveryState(null)
}
```

No call to `validateTestState`. The `savedRecoveryState` is set from `getTestState(testId)` at line 359-368, which reads from localStorage. When the page loads, `testWords` are freshly generated via `generateQuestions(wordsToTest)` — a re-shuffle or a different subset is possible, especially if the list was edited or the session config changed between the exit and the resume.

`src/utils/testRecovery.js:141-156` confirms `validateTestState` exists and compares saved vs current wordIds — it is imported in MCQTest (line 22) but never called in `handleRecoveryResume`.

The `currentIndex` restoration at line 389 is not clamped to `[0, testWords.length - 1]`. If the fresh `testWords` is shorter than the saved `currentIndex`, `testWords[currentIndex]` is `undefined`, and the question render at line 1167 (`const currentWord = testWords[currentIndex]`) would be `undefined`, potentially crashing the render.

**Regarding canRetake/retakeThreshold:** The claim that "recovery leaves canRetake/retakeThreshold stale" is partially true — there is no code to reset `canRetake` or validate `retakeThreshold` on resume, but these values are set during the initial load from the assignment settings, not from the recovery state, so they remain accurate as long as the assignment hasn't changed between exit and resume.

**True severity: MEDIUM** (as rated) — The missing validation is a real correctness bug, though in practice testIds encode the exact test configuration, making a mismatch rare for typical resumptions.

**Playwright testable: YES** — Simulate a recovery scenario: answer some questions, modify the test word set (requires editing the list between sessions), reload and resume. Verify that mismatched answers are handled gracefully (not silently submitted as correct) and that `currentIndex` doesn't exceed `testWords.length - 1`. This requires test setup but is fully automatable.

---

## #40 — answeredCount assumes every response value is a string; non-string throws r.trim

**Claim:** `Object.values(responses).filter(r => r.trim() !== '')` — recovery restores `responses` from unvalidated localStorage; a non-string value makes `r.trim()` throw and crashes the test page.

**VERDICT: CONFIRMED**

**Evidence:**

`src/pages/TypedTest.jsx:923` (origin/main and working tree):
```js
const answeredCount = Object.values(responses).filter((r) => r.trim() !== '').length
```

This line runs on every render (it is not inside a useEffect or useMemo). The `responses` object is restored from localStorage via `handleRecoveryResume` at line 512-523:
```js
if (savedRecoveryState?.answers) {
  setResponses(savedRecoveryState.answers)
```

`savedRecoveryState` comes from `getTestState(testId)` which reads raw localStorage JSON with no type validation. If a legacy save or a corrupted payload has a non-string value (e.g., `null`, a number, or an object) for any wordId, `r.trim()` throws `TypeError: r.trim is not a function`, crashing the component and rendering nothing.

The severity is somewhat mitigated by the fact that TypedTest's own auto-answer and `setResponses` calls always write strings, so corruption requires an external or legacy payload. However, the localStorage recovery path explicitly accepts unvalidated external input.

**True severity: LOW** (as rated) — Only triggered by corrupt/legacy localStorage data, not by normal usage. Once crashed, the user is stuck on the test page until they clear localStorage.

**Playwright testable: YES** — Manually inject a non-string value into the recovery localStorage key before navigating to the TypedTest page, then trigger the recovery resume. Verify whether a TypeError is thrown and the page crashes. This is deterministic.

---

## Summary Table

| ID | Claim (1 line) | VERDICT | True Sev | Playwright? | Notes |
|----|---------------|---------|----------|-------------|-------|
| #1 | TypedTest submitError/retry UI hidden inside isSubmitting overlay | **CONFIRMED** (TypedTest) | HIGH | y — mock Firestore reject, verify error visible | MCQTest has separate inline block — finding is TypedTest-only; both origin/main and working tree affected |
| #2 | resultsProcessedRef not reset on 'new' retake, skipping processTestResults | **CONFIRMED** | HIGH | y — sim retake + Firestore check | Both TypedTest and MCQTest; not touched by working-tree patch; deployed (origin/main) |
| #14 | Sim auto-answer reads word.text (undefined), crashing on typo branch | **CONFIRMED** | MED (dev-only) | y — sim mode, check console error | Dev-only (VITE_SIMULATION_MODE); correct branch returns undefined, typo branch throws TypeError |
| #15 | MCQ auto-answer double-increments currentIndex, skipping every other question | **CONFIRMED** | MED (dev-only) | y — sim mode, check skipped words in results | Dev-only; both functional setCurrentIndex calls apply, net +2 per step |
| #16 | Gradebook answerArray uses stale answers state vs sync ref on auto-submit | **PARTIAL** | MED → LOW | partial — timing-dependent | Structural divergence confirmed; claimed split-brain scenario timing is uncertain in React 19 |
| #17 | Recovery resume restores answers/index without validating against fresh testWords | **CONFIRMED** | MED | y — inject stale recovery state, verify behaviour | validateTestState exists but unused; no index clamping; canRetake staleness claim is overstated |
| #40 | answeredCount r.trim() crashes on non-string response from corrupt localStorage | **CONFIRMED** | LOW | y — inject non-string into localStorage recovery key | Every-render crash; TypedTest only; requires corrupt/legacy localStorage |

**Totals:** CONFIRMED: 5 | PARTIAL: 1 | FALSE: 0 | OVERSTATED: 0

**Playwright-testable:** #1 (y), #2 (y), #14 (y, sim), #15 (y, sim), #16 (partial), #17 (y), #40 (y) → 6 of 7 fully testable, 1 partial.

---

## Cross-reference: Patch Coverage

The uncommitted working-tree changes to `src/pages/TypedTest.jsx` and `src/pages/MCQTest.jsx` (visible in `git diff HEAD`) fix:
- Retake route path: `/typed-test/` → `/typedtest/`, `/mcq-test/` → `/mcqtest/`
- Retake button UI: adds `canRetake`/`handleRetake`/`retakeError` display in results view

None of these patches address findings **#1, #2, #14, #15, #16, #17, or #40**. All seven findings apply equally to origin/main (deployed) and the current working tree.
