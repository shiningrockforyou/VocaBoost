# CUTOVER-B SUBMIT — FOLD LEDGER, **ACTIVE**

> Renamed from `-PLAN` now that work has begun, so `gate.mjs` enforces every row again.

**WHAT THIS FOLD DOES:** behind `REVIEW_V2_CLIENT`, submission goes through `submitAttempt` — the SERVER
grades and the SERVER writes the attempt. The client stops computing the verdict and stops writing the
document.

**THE ASYMMETRY THAT SHAPES THE WHOLE FOLD** (mapped before planning):
- **MCQ today** is ONE call — `submitVocabAttempt({testType:'mcq', context, attemptAnswers})`
  (`MCQTest.jsx:731-733`).
- **TYPED today is TWO** — `gradeTypedTest({answers, listId, classId, gradeContext})`
  (`TypedTest.jsx:710-718`) which mints a **gradeToken**, then
  `submitVocabAttempt({testType:'typed', …, gradeToken, gradeTokenCreatedAt})` (`:998-1004`).
- **The engine is ONE call for both**: `submitAttempt({presentationId, answers})`.
⇒ V2 SETTLED THIS: the token is DORMANT in production (both flags false) and the engine SUBSUMES what it
protected, by making the attempt docId server-derived and never letting a verdict reach the client. The
fold ships.

## GROUP V — VERIFY BEFORE EDITING

[x] V1  **ANSWERED — and the legacy `context` contains the 06-29 landmine itself.**
        `MCQTest.jsx:718-721`: `context = {studentId, classId, listId, testId, studyDay, sessionType,
        testType:'mcq', attemptDocId, totalQuestions}` — and crucially
        **`attemptDocId = `${user.uid}_${testId}_${attemptNonce}`** (`:700`). That client-minted nonce IS
        the divergence V2 identified: it is why enforcing the gradeToken re-armed the outage.
        FIELD-BY-FIELD under the engine: `studentId` ⇐ auth · `classId`/`listId`/`studyDay`/`sessionType`
        ⇐ the presentation record · `attemptDocId` ⇐ `engineDocId(uid, presentationId)`, SERVER-derived ·
        `totalQuestions` ⇐ the presentation (see V3) · `testType` ⇐ the queue snapshot's pinned posture,
        never the request's claim.
        ⇒ **Every field the client contributes today is supplied by the server under the engine, and the
        one field that is purely client-invented is the one that caused the outage.** Nothing is silently
        lost. The fold must send ONLY `{presentationId, answers}` and must not smuggle a client
        `attemptDocId` or `totalQuestions` alongside it.

[x] V6  **ANSWERED — same obligation as cutover-a, and the same single control.**
        Nothing to discover: `REVIEW_V2_CLIENT=false` and the legacy submit path is untouched today, so
        flag-off parity is a DESIGN obligation of this fold, not a property to verify. Every new branch
        gated at the call site; no shared helper mutated in place; the typed TWO-CALL sequence
        (`gradeTypedTest` → `submitVocabAttempt`, token fields included) byte-identical flag-off.
        C2 is the only thing that can prove it, so C2 is not optional — and cutover-a's audit showed the
        static argument must be checked line by line, not accepted.

## GROUP A — DELTAS

[ ] A1  Route submission through `submitAttempt` behind the flag; the server grades and writes.
        BYPASS SET — every way a submission can be lost, double-written, or mis-scored (one fixture each):
          · create      — the ordinary first submit
          · update      — a re-submit of the SAME presentation (must be idempotent, not a second attempt)
          · delete      — submitting after a reset (epoch moved) ⇒ must refuse, not write
          · set-merge / set-overwrite — a replay landing on an already-written attempt
          · FieldValue.delete() equivalent — the attempt vanishing between submit and read-back
          · delete-then-recreate SEQUENCE — submit, reset, submit again
          · batch / transaction — two tabs submitting the same presentation concurrently
          · a different path — the NEW-word submit vs the REVIEW submit
          · as a third party — another student's presentationId in the submit
          · as a teacher — a teacher-driven submit
        OTHER LEG: flag-off, `submitVocabAttempt` (both modalities, incl. the typed two-call sequence and
        its gradeToken) is byte-identical to today.

[ ] A2  Handle every V4 status. **`grade_unusable` ⇒ recompose EXACTLY ONCE**, then surface a reason —
        never a loop. This is the contract this program shipped in the refusal-status fold; a client that
        loops here hammers a live AI grader.
        BYPASS SET — every way the once-only guard can be defeated: an immediate second `grade_unusable`
        · a reload between the refusal and the recompose · two tabs each recomposing · a recompose that
        itself refuses · a user-initiated retry after the automatic one.
        FIXTURE: assert the SECOND `grade_unusable` does NOT recompose again (C3).

## GROUP C — FIXTURES + MUTANTS
[ ] C1  One case per A1 bypass row.
[ ] C2  FLAG-OFF PARITY for BOTH modalities — including the typed two-call sequence and its token.
[ ] C3  The recompose-once guard, both legs (it fires once; it does NOT fire twice).
[ ] C4  MUTANT: make the recompose unbounded. C3 must go red.
[ ] C5  MUTANT: drop the idempotency on re-submit (a second attempt is written). C1 must go red.
[ ] C6  Fixtures at the **page/testConfig boundary**, not only the adapter — cutover-a's audit showed
        three student-visible defects hid precisely because no fixture touched the pages.

## GROUP D — TRUTH REPAIRS
[ ] D1  Anything claiming the client grades or writes the attempt (studyService/db comments, 10_/18_).
[ ] D2  If V2 concludes the gradeToken is genuinely subsumed, say so AT ITS DEFINITION, with the reason.

## GROUP E — CARDED, NOT THIS ROUND
[ ] E1  Day completion is cutover-c. This fold stops at the attempt being written.

## CLOSE
[ ] every row ticked with file:line + fixture ref   [ ] evidence re-run AFTER the last edit
[ ] all shas re-stamped   [ ] numbers re-derived from evidence   [ ] change log row (ABSOLUTE path)
[ ] `node scripts/deepfix2/gate.mjs` clean   [ ] commit
[ ] **VISUAL CHECK** — I cannot run it (9p mount, win32 node_modules). It is a WinClaude order, and this
    fold NEEDS the submit→grade path that order 98 could not reach, so seed an MCQ class at day start.
[ ] a concurrent session is writing to this repo — stage explicitly, never `git add -A`
