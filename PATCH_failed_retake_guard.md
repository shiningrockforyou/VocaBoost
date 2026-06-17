# Patch: Failed Day-2+ new-word test → retake (not review) + honor completion gate + reconciliation indexes

Fixes Codex audit Blockers #1 & #2 and High #3. Anchored to `origin/main` (`0349929`).
Apply on freshly-pulled `main`, `npm run build`, then push. WEB-ONLY for the code changes;
#3 is a Firestore index config (separate `firebase deploy --only firestore:indexes`).

---

## Fix #1 (Blocker) — failed new-word test must retake, never enter review
The only chokepoint: `handleReturnFromTest` in `src/pages/DailySessionFlow.jsx` unconditionally
calls `moveToReviewPhase()` for any Day-2+ completed new-word test (so the results back-button
carries a *failed* student into review). Gate it on pass.

**FIND** (in `src/pages/DailySessionFlow.jsx`, the Day-2+ branch):
```js
          } else {
            // Day 2+: Move to review phase (session not complete yet)
            await moveToReviewPhase(state.sessionConfig)
          }
```

**REPLACE WITH:**
```js
          } else {
            // Day 2+: only carry into review if the new-word test PASSED. A failed
            // test (incl. reaching here via the results back button) must be retaken,
            // not advanced into review. Mirrors Day 1, which holds on failure.
            const passThreshold = state.sessionConfig?.retakeThreshold ?? 0.95
            if ((results?.score ?? 0) >= passThreshold) {
              await moveToReviewPhase(state.sessionConfig)
            } else {
              setNewWordTestResults(results)
              setNewWordFailedIds(results?.failed || [])
              setPhase(PHASES.NEW_WORDS)
            }
          }
```
(`results`, `state`, `setNewWordTestResults`, `setNewWordFailedIds`, `setPhase`, `PHASES`,
`moveToReviewPhase` are all in scope here. On fail → back to new-word study → student retakes.)

---

## Fix #2 (Blocker) — callers must honor `requiresNewWordRetake`
`completeSessionFromTest()` already returns `{ requiresNewWordRetake: true }` when a Day-2+ day
can't complete (new-word not passed), but both test components ignore it and proceed as completed.
Capture it; if set, block (don't clear recovery, don't show as completed).

### 2a — `src/pages/TypedTest.jsx`
**FIND:**
```js
            await completeSessionFromTest({
```
**REPLACE WITH:**
```js
            const completion = await completeSessionFromTest({
```

**FIND:**
```js
            })
            console.log('Session completed successfully from TypedTest')
```
**REPLACE WITH:**
```js
            })
            // Day-2+ gate: if this day's new-word test wasn't passed, the day does NOT
            // complete. Don't present as finished — block and require a retake.
            if (completion?.requiresNewWordRetake) {
              console.warn('completeSessionFromTest: day not complete — new-word retake required')
              setGradingError('이 날을 완료하려면 먼저 새 단어 시험을 통과해야 합니다.\n(Day not complete — pass the new-word test first.)')
              return
            }
            console.log('Session completed successfully from TypedTest')
```

### 2b — `src/pages/MCQTest.jsx`
**FIND:**
```js
            await completeSessionFromTest({
```
**REPLACE WITH:**
```js
            const completion = await completeSessionFromTest({
```

**FIND:**
```js
            })
            console.log('Session completed successfully from MCQTest')
```
**REPLACE WITH:**
```js
            })
            // Day-2+ gate: if this day's new-word test wasn't passed, the day does NOT
            // complete. Don't present as finished — block and require a retake.
            if (completion?.requiresNewWordRetake) {
              console.warn('completeSessionFromTest: day not complete — new-word retake required')
              setSubmitError('이 날을 완료하려면 먼저 새 단어 시험을 통과해야 합니다. (Day not complete — pass the new-word test first.)')
              return
            }
            console.log('Session completed successfully from MCQTest')
```

(Both `return` early — before `clearTestState`/`setShowResults` — so recovery is preserved and the
day isn't shown as complete. Both components have a `finally { setIsSubmitting(false) }`, so the
early return is clean.)

**Known limitation (acceptable):** the block reuses the existing error modal, whose "Try Again"
re-submits and re-hits the gate (a loop) for a student already stranded in review. Fix #1 prevents
*new* students from reaching this state, so #2 only triggers for legacy-stuck students mid-review.
A follow-up can route them directly to the new-word retake instead of the modal. The important
behavior — **never falsely mark the day complete** — is achieved.

---

## Fix #3 (High) — track the reconciliation indexes in the repo
The composite indexes for `getRecentAttemptsForClassList`, `getMostRecentPassedNewTest`,
`getNewWordAttemptForDay` are **deployed in prod** (verified: those queries succeed) but **not in
`firestore.indexes.json`**. Risk: a future `firebase deploy --only firestore:indexes` from the repo
would **drop them**, silently degrading the recovery/reconciliation path.

**SAFEST fix — export the live indexes (no guessing, can't drop anything):**
```
firebase firestore:indexes > firestore.indexes.json
```
Review the diff (it should ADD the missing vocaboost `attempts` composites and keep everything
else), commit it. This guarantees repo == prod.

**Fallback** if you can't run the export — add these to the `indexes` array (verify field/order
against the actual query if any are unused; harmless if slightly off, but the export is preferred):
```json
{ "collectionGroup": "attempts", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "studentId", "order": "ASCENDING" },
  { "fieldPath": "classId", "order": "ASCENDING" },
  { "fieldPath": "listId", "order": "ASCENDING" },
  { "fieldPath": "submittedAt", "order": "DESCENDING" } ] },
{ "collectionGroup": "attempts", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "studentId", "order": "ASCENDING" },
  { "fieldPath": "classId", "order": "ASCENDING" },
  { "fieldPath": "sessionType", "order": "ASCENDING" },
  { "fieldPath": "studyDay", "order": "ASCENDING" },
  { "fieldPath": "submittedAt", "order": "DESCENDING" } ] },
{ "collectionGroup": "attempts", "queryScope": "COLLECTION", "fields": [
  { "fieldPath": "studentId", "order": "ASCENDING" },
  { "fieldPath": "classId", "order": "ASCENDING" },
  { "fieldPath": "listId", "order": "ASCENDING" },
  { "fieldPath": "sessionType", "order": "ASCENDING" },
  { "fieldPath": "passed", "order": "ASCENDING" },
  { "fieldPath": "studyDay", "order": "DESCENDING" } ] }
```
⚠️ Use `firebase firestore:indexes` (export) over this fallback — it's exact and never drops live indexes.

---

## Verify after applying
1. `npm run build` passes.
2. **Fail** a Day-2+ new-word test → on the results screen hit the **back button** → must land on
   the **new-word study/retake**, NOT review. (Repro for Blocker #1.)
3. A genuine **pass** still flows new → review → complete → advance.
4. (Defensive) If a student is already mid-review with an unpassed new test, submitting review must
   NOT show "complete" — it shows the retake message and stays put.
5. Indexes: `firebase deploy --only firestore:indexes` should be a no-op/additive (never "deleting").

## Deploy
Code: log to `change_action_log.md`, push → Netlify. Indexes: `firebase deploy --only firestore:indexes`.
