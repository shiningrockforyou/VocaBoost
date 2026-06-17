# Patch v2: Day-2+ passer bounced back to the new-word test + threshold gaps in the deployed completion gate

**v2 supersedes v1.** A re-check found two gaps that v1 missed — one is a regression
risk in the ALREADY-DEPLOYED bug-#1 completion gate, so Changes C and D below are not
optional. **v2.1 adds Change E** (empty-review-queue pool collapse on resume — actively
blocking top students daily as of 2026-06-10). Apply all five changes (A–E) together.

Production evidence note (2026-06-10): the deployed bug-#1 gate IS firing for 92–94%
passers (threshold resolves to 0.95) — their `recordSessionCompletion` is skipped
(missing day-N `sessions` docs), but CSD reconciliation masks it by re-advancing the
day from attempt history. Net silent damage until C+D ship: lost session records,
empty `recentSessions` (blinds intervention pacing), and skipped MASTERED graduation
for that day. Self-corrects over time once fixed; no backfill required.

## Symptoms
1. A student **passes** the Day-2+ new-word test (esp. fail → retake → pass), but on
   re-entry is dropped back into the **new-word study/test** instead of **review**.
   (e.g. 유지웅 87→100, JW Han 93 — class 26SM Inter B2, threshold 92%.)
2. (Latent, introduced by the deployed bug-#1 gate) A student in a 92%-threshold class
   who passes at **92–94%** can be **blocked from completing Day 2+** because the gate
   compares against a wrong default threshold of 0.95.
3. (Latent) Teacher **manual-override passes** (attempt `passed=true`, score below
   threshold) would also be blocked from completing the day.

## Root causes
- **Wrong attempt picked:** `determineStartingPhase` uses
  `dayAttempts.find(a => a.sessionType === 'new')` → first attempt. For fail→retake→pass
  that's the FAILED one, so `config.startPhase` never becomes `REVIEW_STUDY`, and the
  existing recovery branch (DailySessionFlow.jsx ~line 618) that would resume the passer
  into review never fires. → **Change A**
- **Stale session pointer trusted:** the secondary resume path keys off
  `existingState.phase` (stale `new-words-study`) and ignores attempt-derived state.
  → **Change B** (defense-in-depth; mostly shadowed by A + line-618 since that branch
  `return`s, but kept so a stale pointer can never bounce a confirmed passer)
- **Threshold-source bug:** assignments store **`passThreshold`** (percent, e.g. 92) and
  NEVER store `newWordRetakeThreshold`; every settings builder falls back to
  `DEFAULT_RETAKE_THRESHOLD = 0.95`. So `sessionConfig.retakeThreshold` is 0.95 for all
  classes while the attempt's `passed` flag is computed server-side against the real 92%.
  This is also why `session_state.newWordsTestPassed` shows `false` for 93% passers.
  Cosmetic before; the deployed bug-#1 gate made it BLOCKING for 92–94% passers.
  → **Changes C + D**
- **Manual overrides ignored:** the deployed gate is score-based and ignores the
  attempt's authoritative `passed=true`. → **Change C**

---

## Change A — `src/services/studyService.js`, function `determineStartingPhase`

**FIND:**
```js
  const dayAttempts = attempts.filter(a => a.studyDay === dayNumber);
  const newTest = dayAttempts.find(a => a.sessionType === 'new');
  const reviewTest = dayAttempts.find(a => a.sessionType === 'review');
```

**REPLACE WITH:**
```js
  const dayAttempts = attempts.filter(a => a.studyDay === dayNumber);
  // Pick the BEST new-word attempt for the day, not just the first match. A student
  // who failed then retook-and-passed has multiple 'new' attempts; .find() can return
  // the earlier FAILED one, so we'd conclude they still owe the test and resume them to
  // the new-word phase instead of review — even though they passed. Prefer a passed
  // attempt; otherwise the highest score.
  const newAttempts = dayAttempts.filter(a => a.sessionType === 'new');
  const newTest = newAttempts.slice().sort((a, b) =>
    (Number(b.passed === true) - Number(a.passed === true)) ||
    ((b.score ?? 0) - (a.score ?? 0))
  )[0] || null;
  const reviewTest = dayAttempts.find(a => a.sessionType === 'review');
```

(No other lines in the function change; the branches already read `newTest?.passed`,
which is the server-computed flag and therefore threshold-correct.)

---

## Change B — `src/pages/DailySessionFlow.jsx`, the `existingState` resume block (~line 800)

**FIND:**
```js
        const resumeNewWordThreshold = config?.retakeThreshold ?? 0.95
        const resumeNewWordsPassed = existingState?.newWordsTestScore != null &&
          existingState.newWordsTestScore >= resumeNewWordThreshold

        if (isSameDay && resumeNewWordsPassed && (existingState?.phase === SESSION_PHASE.REVIEW_STUDY || existingState?.phase === SESSION_PHASE.REVIEW_TEST)) {
```

**REPLACE WITH:**
```js
        const resumeNewWordThreshold = config?.retakeThreshold ?? 0.95
        const resumeNewWordsPassed = existingState?.newWordsTestScore != null &&
          existingState.newWordsTestScore >= resumeNewWordThreshold
        // Attempt-derived source of truth: determineStartingPhase returns REVIEW_STUDY
        // when the day's new-word test was PASSED (server-computed flag) but the review
        // isn't done. Honor it even when the saved session_state.phase is stale (e.g.
        // passed on a retake, or left before "Continue"), so a confirmed passer is never
        // sent back to redo a test they passed. NOTE: normally the startPhase ===
        // REVIEW_STUDY recovery branch above already returns first; this is
        // defense-in-depth for any path that reaches here.
        const attemptsSayReviewPending = config?.startPhase === SESSION_PHASE.REVIEW_STUDY
        const sessionSaysReviewResume = isSameDay && resumeNewWordsPassed &&
          (existingState?.phase === SESSION_PHASE.REVIEW_STUDY || existingState?.phase === SESSION_PHASE.REVIEW_TEST)

        if (attemptsSayReviewPending || sessionSaysReviewResume) {
```

(The body of the `if` block stays exactly the same.)

---

## Change C — `src/services/studyService.js`, function `completeSessionFromTest`
### (URGENT companion fix to the already-deployed Day-2+ completion gate)

Two edits in the same function.

**C-1 FIND (Day 2+ branch where the new-word attempt is read):**
```js
    // Query the new word attempt for this day
    const newWordAttempt = await getNewWordAttemptForDay(userId, classId, dayNumber);
    if (newWordAttempt) {
      // Convert score from 0-100 to 0-1 if needed
      newWordScore = newWordAttempt.score <= 1
        ? newWordAttempt.score
        : newWordAttempt.score / 100;
    } else {
```

**C-1 REPLACE WITH:**
```js
    // Query the new word attempt for this day
    const newWordAttempt = await getNewWordAttemptForDay(userId, classId, dayNumber);
    if (newWordAttempt) {
      // Convert score from 0-100 to 0-1 if needed
      newWordScore = newWordAttempt.score <= 1
        ? newWordAttempt.score
        : newWordAttempt.score / 100;
      // The attempt's `passed` flag is authoritative: it was computed at submission
      // against the CLASS's real passThreshold (and covers teacher manual overrides
      // where passed=true with a lower score). The local `threshold` may be a wrong
      // default (0.95) because assignments don't store newWordRetakeThreshold.
      newWordAttemptPassed = newWordAttempt.passed === true;
    } else {
```

**C-2 FIND (the declarations above the isFirstDay branch):**
```js
  let newWordScore = null;
  let reviewScore = null;
  let reviewFailed = [];
```

**C-2 REPLACE WITH:**
```js
  let newWordScore = null;
  let reviewScore = null;
  let reviewFailed = [];
  let newWordAttemptPassed = null; // authoritative passed flag from the attempt doc
```

**C-3 FIND (the deployed Day-2+ completion gate):**
```js
  if (!isFirstDay && newWordScore < threshold) {
    console.warn('completeSessionFromTest: Day 2+ completion blocked — new-word test not passed', {
      dayNumber, newWordScore, threshold
    });
```

**C-3 REPLACE WITH:**
```js
  if (!isFirstDay && newWordAttemptPassed !== true && newWordScore < threshold) {
    console.warn('completeSessionFromTest: Day 2+ completion blocked — new-word test not passed', {
      dayNumber, newWordScore, threshold, newWordAttemptPassed
    });
```

Effect: a passer is recognized by the attempt's `passed=true` regardless of the local
threshold value; a genuine failer (passed=false AND score below threshold) is still
blocked. The score-vs-threshold compare remains only as a fallback when no attempt doc
is found.

---

## Change D — derive the retake threshold from the class's real passThreshold

Assignments store `passThreshold` (percent); `newWordRetakeThreshold` is never stored.
Fix the fallback chain in FOUR places (identical pattern). This also fixes the
chronically-wrong `session_state.newWordsTestPassed` boolean (computed against 0.95).

**FIND in `src/pages/DailySessionFlow.jsx` (~line 591), and in
`src/services/studyService.js` at ~line 770, ~line 820, and ~line 1014 — four
occurrences total, all identical:**
```js
            newWordRetakeThreshold: assignment.newWordRetakeThreshold || STUDY_ALGORITHM_CONSTANTS.DEFAULT_RETAKE_THRESHOLD
```
(indentation varies per site; in studyService the lines are not wrapped in extra spaces:
`    newWordRetakeThreshold: assignment.newWordRetakeThreshold || STUDY_ALGORITHM_CONSTANTS.DEFAULT_RETAKE_THRESHOLD`)

**REPLACE EACH WITH (keep each site's indentation):**
```js
            newWordRetakeThreshold: assignment.newWordRetakeThreshold ||
              (Number(assignment.passThreshold) > 0 ? Number(assignment.passThreshold) / 100 : STUDY_ALGORITHM_CONSTANTS.DEFAULT_RETAKE_THRESHOLD)
```

Effect: `config.retakeThreshold` becomes the class's real threshold (0.92 for the 26SM
classes) instead of the 0.95 default — fixing the resume guard, the
`newWordsTestPassed` session writes, and the completion-gate fallback in one shot.
`assignment.passThreshold` is stored as a number 1–100 (`Number(passThreshold) || 95`
at write time), so `/100` is safe; a missing/zero value falls through to the default.

---

## Change E — empty review queue on resume → auto-complete the day (pool collapse)

### Background
For top scorers, `graduateSegmentWords` retires entire segments to MASTERED (21-day
rest). A later day's review segment can then be legitimately EMPTY after the
MASTERED-resting exclusion — a VALID designed state: the in-session path
(`moveToReviewPhase`) shows the success modal "No words need review today - all
mastered!" (`showNoReviewModal`) and `completeSession()` finishes the day.
BUT the two RESUME paths skip that handler and push the student into the review
phase with 0 words, dead-ending at the test page's "No Test Content — Your teacher
hasn't assigned enough words yet" screen.
Live impact 2026-06-10: 4 students blocked (정아영/Paige Lim/Ryan Kim day 6,
손지우 day 7 — all top scorers); manually advanced. WITHOUT THIS CHANGE THEY
RE-BLOCK on subsequent days (their MASTERED spans cover the next segments too).
Only students whose new-word test PASSED can reach these branches (esp. after
Changes A/B), so auto-completing here cannot bypass the failed-test hold.

### E-1 — `src/pages/DailySessionFlow.jsx`, the `startPhase === REVIEW_STUDY` recovery branch (~line 618)

**FIND:**
```js
            const segmentWords = excludeRetiredMastered(await getSegmentWords(
              user.uid,
              listId,
              config.segment.startIndex,
              config.segment.endIndex
            ))

            setReviewQueue(segmentWords)
            setReviewQueueCurrent(segmentWords)
```

**REPLACE WITH:**
```js
            const segmentWords = excludeRetiredMastered(await getSegmentWords(
              user.uid,
              listId,
              config.segment.startIndex,
              config.segment.endIndex
            ))

            if (segmentWords.length === 0) {
              // Empty review segment (all words MASTERED & resting) — valid state.
              // Same designed outcome as the in-session path: "all mastered" success
              // modal -> completeSession() finishes the day. Without this, the student
              // lands in the review test with 0 words ("No Test Content" dead end).
              setShowNoReviewModal(true)
              return
            }

            setReviewQueue(segmentWords)
            setReviewQueueCurrent(segmentWords)
```

(`setShowNoReviewModal` and its handler `handleNoReviewModalClose` → `completeSession()`
already exist in this file; `setSessionConfig(config)` has already run by this point, so
`completeSession()` has the config it needs when the user clicks OK.)

### E-2 — `src/pages/DailySessionFlow.jsx`, the `existingState` resume block (inside the `if` from Change B)

**FIND:**
```js
          if (config.segment) {
            const allWords = excludeRetiredMastered(await getSegmentWords(
              user.uid,
              listId,
              config.segment.startIndex,
              config.segment.endIndex
            ))
            setReviewQueue(allWords)
            setReviewQueueCurrent(allWords)
          }
          setPhase(PHASES.REVIEW_STUDY)
```

**REPLACE WITH:**
```js
          if (config.segment) {
            const allWords = excludeRetiredMastered(await getSegmentWords(
              user.uid,
              listId,
              config.segment.startIndex,
              config.segment.endIndex
            ))
            if (allWords.length === 0) {
              // Empty review segment (all words MASTERED & resting): designed outcome
              // is the "all mastered" modal -> completeSession(), not the review phase.
              setShowNoReviewModal(true)
              return
            }
            setReviewQueue(allWords)
            setReviewQueueCurrent(allWords)
          }
          setPhase(PHASES.REVIEW_STUDY)
```

### E-3 — fix the misleading dead-end copy (backstop screens)

In BOTH `src/pages/MCQTest.jsx` (~line 1156) and `src/pages/TypedTest.jsx` (~line 960):

**FIND (identical in both files):**
```js
          <p className="text-lg font-semibold text-text-primary">No Test Content</p>
          <p className="mt-3 text-sm text-text-muted">Your teacher hasn't assigned enough words yet.</p>
```

**REPLACE WITH (identical in both files):**
```js
          <p className="text-lg font-semibold text-text-primary">No Test Content</p>
          <p className="mt-3 text-sm text-text-muted">No words are available for this test right now. If you just finished a test, go back and continue from the dashboard.</p>
```

(With E-1/E-2 in place this screen should be unreachable via the daily flow; the copy
fix removes the false "teacher misconfigured the class" implication for any remaining
edge path.)

### E-4 — make the auto-complete durable against CSD reconciliation (REQUIRED)

CSD reconciliation (`progressService.js getOrCreateClassProgress`, ~line 146) counts a
Day 2+ day complete ONLY if a day-N attempt with `sessionType=='review'` exists:
`csd = reviewForAnchorDay ? anchorDay : anchorDay - 1`, and when the anchor is valid it
**bidirectionally overwrites** the stored CSD. An empty-review day auto-completed via
`completeSession()` writes NO review attempt → reconciliation REVERTS the day on the
next session entry. (Observed live 2026-06-10: manual advances for the 4 blocked
students were reverted within hours; re-fixed by writing marker review attempts.)

In `src/pages/DailySessionFlow.jsx`:

**FIND:**
```js
  const handleNoReviewModalClose = async () => {
    setShowNoReviewModal(false)
    await completeSession()
  }
```

**REPLACE WITH:**
```js
  const handleNoReviewModalClose = async () => {
    setShowNoReviewModal(false)
    await completeSession()
    // Record a marker review attempt for this day. CSD reconciliation
    // (getOrCreateClassProgress -> getReviewForDay) only counts a Day 2+ day as
    // complete when a day-N review attempt exists — without this marker the
    // auto-completed day is REVERTED on the next session entry.
    try {
      const dayNumber = sessionConfig?.dayNumber
      if (user?.uid && classId && listId && Number.isInteger(dayNumber) && dayNumber > 1) {
        const classSnap = await getDoc(doc(db, 'classes', classId))
        const ownerTeacherId = classSnap.exists() ? (classSnap.data().ownerTeacherId ?? null) : null
        // Deterministic id => idempotent (re-entry can't duplicate the marker)
        const markerId = `${user.uid}_${classId}_${listId}_day${dayNumber}_review_automarker`
        await setDoc(doc(db, 'attempts', markerId), {
          studentId: user.uid,
          teacherId: ownerTeacherId,
          classId,
          listId,
          studyDay: dayNumber,
          testType: 'mcq',
          sessionType: 'review',
          score: 100,
          passed: true,
          totalQuestions: 0,
          correctCount: 0,
          answers: [],
          autoCompleted: true,
          manualReviewNote: 'Auto-completed: no review available — all segment words mastered (21-day rest).',
          submittedAt: Timestamp.now()
        })
      }
    } catch (err) {
      // Non-fatal: the day still completed; reconciliation may revert it until the
      // student produces a real review attempt. Log for visibility.
      console.error('Failed to write empty-review marker attempt:', err)
    }
  }
```

**E-4b — REQUIRED import change (do not skip).** DailySessionFlow.jsx currently imports
ONLY `doc, getDoc` from firestore. Without this edit, `setDoc`/`Timestamp` are
undefined — and because the marker write is inside try/catch, the ReferenceError is
SWALLOWED: everything appears to work but markers never write and auto-completed days
silently revert. In `src/pages/DailySessionFlow.jsx` (top of file):

**FIND:**
```js
import { doc, getDoc } from 'firebase/firestore'
```

**REPLACE WITH:**
```js
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
```

(Also note: on re-entry the marker already exists, so the setDoc becomes an UPDATE; if
firestore rules deny student updates to attempts, the catch handles it harmlessly —
the marker is already in place from the first write.)

Note: the marker shows in the gradebook as a 100% review with 0 questions and an
explanatory note — intentionally auditable rather than invisible.

### E verification
- Simulate a pool-collapsed passer (all segment words MASTERED with future returnAt,
  day-N new test passed, no day-N review) → re-enter the session ⇒ should see the
  "all mastered" success modal, and after OK the day completes and CSD advances.
- After the modal OK, confirm a `day{N}_review_automarker` attempt doc exists, then
  RE-ENTER the session once more ⇒ CSD must NOT revert (this is the E-4 check; without
  the marker, reconciliation pulls CSD back to N-1).
- A passer with a NON-empty segment still resumes into review normally.
- A FAILED student still cannot reach review/auto-complete (Changes A/B gate them).

## Residual notes (known, intentionally NOT in this patch)
- Other places hardcode the 0.95 default when building standalone test contexts:
  `TypedTest.jsx` ~358/374, `MCQTest.jsx` ~302/318, `Dashboard.jsx` ~1800/1835
  (`newWordRetakeThreshold: 0.95`). After Change C the completion gate no longer
  depends on these (the attempt's `passed` flag is authoritative), so their impact is
  cosmetic (session-state booleans on standalone paths). Skipped to keep this patch
  focused; fold into a later cleanup if desired.
- E-1/E-2 show the "all mastered" modal while the page is still in its loading phase
  (the modal overlays it); after OK, `completeSession()` sets phase COMPLETE
  (verified: DailySessionFlow ~line 1410). Cosmetic only.
- Recovery paths don't restore `newWordFailedIds`, so a passer's 1–2 missed words
  aren't prepended to a resumed review (pre-existing). They stay FAILED in
  study_states and resurface in later segments.

## Applying & deploy notes
- Per project convention, log all applied changes to `change_action_log.md`
  (table format: `| Date | File | Change |`).
- All five changes are WEB-ONLY (`src/` files) → ships via the normal git push →
  Netlify build. No Cloud Functions or firestore.rules deploy needed.
- Parse-check after applying: esbuild loaders — `jsx` for the three .jsx files,
  `js` for studyService.js. (`node --check` cannot parse JSX; full `vite build` is
  not runnable in the sandbox.)

## Why this is safe
- **Failed student (no passed attempt, score < threshold):** Change A still yields
  `passed=false` best-attempt → `startPhase = NEW_WORDS_STUDY` → retake. Change C still
  blocks completion. The bug-#1 hold is fully preserved.
- **Passer (incl. retake-pass):** routed to review (A), never bounced (B), completes and
  advances (C honors `passed=true`).
- **92–94% passer in a 92% class:** no longer blocked (C + D).
- **Teacher manual override (passed=true, low score):** completes normally (C).

## Verify after applying
1. esbuild parse-check both files (repo is type:module; loaders 'jsx'/'js').
2. Fail → retake → PASS the Day-2 new-word test → leave → re-enter ⇒ lands in
   **review study**, not the new-word test.
3. Fail (no pass) → leave → re-enter ⇒ lands on the **new-word test** (retake) — bug-#1
   behavior intact.
4. Pass at **93%** in a 92%-threshold class → complete review ⇒ **day completes, CSD
   advances** (this is the regression check for the deployed gate).
5. `session_state.newWordsTestPassed` after a 93% pass should now be `true`.

## Already-stuck students
Routing self-corrects on next re-entry after deploy; no data backfill required.
(Inter B2's confirmed passers can also be advanced manually — separate decision.)
