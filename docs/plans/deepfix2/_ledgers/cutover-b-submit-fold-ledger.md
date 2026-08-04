# CUTOVER-B SUBMIT — FOLD LEDGER, **ACTIVE**

> Renamed from `-PLAN` now that work has begun, so `gate.mjs` enforces every row again.

**WHAT THIS FOLD DOES:** behind `REVIEW_V2_CLIENT`, submission goes through `submitAttempt` — the SERVER
grades and the SERVER writes the attempt. The client stops computing the verdict and stops writing the
document.

**THE ASYMMETRY THAT SHAPES THE WHOLE FOLD** (mapped before planning):
- **MCQ today** is ONE call — `submitVocabAttempt({testType:'mcq', context, attemptAnswers})`
  (`MCQTest.jsx:731-733` pre-fold; the legacy call now sits at `MCQTest.jsx:838-840`, byte-identical).
- **TYPED today is TWO** — `gradeTypedTest({answers, listId, classId, gradeContext})`
  (`TypedTest.jsx:710-718`) which mints a **gradeToken**, then
  `submitVocabAttempt({testType:'typed', …, gradeToken, gradeTokenCreatedAt})` (pre-fold `:998-1004`).
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
        **ENFORCED 2026-08-04:** the adapter builds the payload as exactly `{presentationId, answers}`
        (`reviewV2Submit.js:271`); pure CASE V1/PAYLOAD asserts payload keys === [answers,
        presentationId] and row keys === [studentResponse, wordId]; C2 asserts neither page's
        `submitAttemptV2` call carries attemptDocId/totalQuestions/gradeToken (regex over source bytes).

[x] V6  **ANSWERED — same obligation as cutover-a, and the same single control.**
        Nothing to discover: `REVIEW_V2_CLIENT=false` and the legacy submit path is untouched today, so
        flag-off parity is a DESIGN obligation of this fold, not a property to verify. Every new branch
        gated at the call site; no shared helper mutated in place; the typed TWO-CALL sequence
        (`gradeTypedTest` → `submitVocabAttempt`, token fields included) byte-identical flag-off.
        C2 is the only thing that can prove it, so C2 is not optional — and cutover-a's audit showed the
        static argument must be checked line by line, not accepted.
        **HELD 2026-08-04:** `reviewV2Compose.js` and `reviewV2Client.js` are BYTE-UNTOUCHED (their
        cutover-a receipt shas still match the tree — gate 3b verifies). All new logic lives in the NEW
        `reviewV2Submit.js`; every page branch is `rv2Handle`-gated where `rv2Handle` is null by
        construction flag-off (`MCQTest.jsx:627`, `TypedTest.jsx:824`). C2 proves it (below).

## GROUP A — DELTAS

[x] A1  **DONE 2026-08-04.** Route submission through `submitAttempt` behind the flag; the server grades
        and writes. IMPLEMENTED: adapter `src/services/reviewV2Submit.js:249` (`submitAttemptV2`) +
        MCQ engine leg `MCQTest.jsx:744-818` + typed engine leg `TypedTest.jsx:1015-1111` (the typed
        TWO-call sequence is not run flag-on — the engine grades inside the submit; per-word display
        rows come from the attempt READ-BACK `TypedTest.jsx:1423` + `rv2RowsToTypedResults`
        `reviewV2Submit.js:205`, never fabricated). The handle (`getRv2SubmitHandle`,
        `MCQTest.jsx:1093` / `TypedTest.jsx:1406`) prefers the sessionStorage blob (fresh across
        in-page retakes + reloads — the hook cutover-a built for this fold), identity-checked on
        class/list/source. The verdict + denominator shown and passed downstream are the SERVER's
        (V3); review progression keeps the legacy always-pass law (day completion is cutover-c).
        BYPASS SET — every way a submission can be lost, double-written, or mis-scored (one fixture each,
        ALL in cutover-b-submit-emulator.json 65/0):
          · create      — SB-CREATE (server verdict; denominator = the PRESENTATION: 5 answered of 10
                          scores 30%, never 60%; engine identity + COMPLETE-ROWS on the stored doc)
          · update      — SB-RESUBMIT (replay: `replayed:true`, STORED verdict served even against a
                          different sheet, submittedAt byte-identical, still ONE doc)
          · delete      — SB-RESET (moved epoch ⇒ reset_epoch_mismatch; live lock ⇒ reset_in_progress;
                          zero writes both ways)
          · set-merge / set-overwrite — SB-OCCUPIED (non-engine doc at the derived id ⇒
                          presentation_invalid, occupying doc byte-untouched) + the SB-RESUBMIT replay leg
          · FieldValue.delete() equivalent — SB-VANISH (attempt deleted between the replay pre-read and
                          the txn via the r74 C8a hook ⇒ grading_in_progress with zero writes; the
                          adapter's bounded poll self-heals from the CACHED grade — grader charged ONCE)
          · delete-then-recreate SEQUENCE — SB-RECREATE (submit → reset → old presentation refuses →
                          fresh compose under the new epoch → submit lands, attempt carries epoch 1)
          · batch / transaction — SB-TABS (two concurrent submits: ONE doc, one creator, one replay,
                          identical verdicts)
          · a different path — SB-NEWVSREV (new: sessionType 'new' + anchor range persisted; review:
                          no range fields; distinct testId families)
          · as a third party — SB-THIRD (another student's presentationId ⇒ thrown not-found ⇒ adapter
                          LEGACY, zero writes — presentations are path-scoped)
          · as a teacher — SB-TEACHER (same thrown channel ⇒ LEGACY, zero writes)
        OTHER LEG: flag-off, `submitVocabAttempt` (both modalities, incl. the typed two-call sequence and
        its gradeToken) is byte-identical to today — PROVEN by C2 (below), not asserted.

[x] A2  **DONE 2026-08-04.** Handle every V4 status — the census is TOTAL in `submitAttemptV2`
        (`reviewV2Submit.js:249-380`): terminal `attempt_written` (replay included; success CLEARS the
        once-guard `reviewV2Submit.js:301`) · `grading_in_progress` ⇒ bounded poll of the SAME submit (`:274-296`, never
        a recompose — pure CASE A2/POLL asserts zero compose calls while polling) · six authority
        refusals ⇒ blocked with rendered reasons · `config_hold`/`review_v2_dark` as DATA + the thrown
        trio via `classifyThrownRefusal` ⇒ LEGACY fallback with the student's answers preserved ·
        `client_version_stale` ⇒ blocked force-refresh · unknown/malformed ⇒ blocked generic (never a
        blank screen). **`grade_unusable` ⇒ recompose EXACTLY ONCE** (`:323-357`), then surface a
        reason — never a loop. Guard PERSISTED alongside the composeKey (sessionStorage scope
        `rv2ru.<uid>.<class>.<list>.d<day>.<kind>`, `reviewV2Submit.js:99`), marked BEFORE the
        recompose (`:331`, fail-closed across a crash), cleared ONLY by attempt_written.
        BYPASS SET — every way the once-only guard can be defeated (one pure fixture each, ALL in
        cutover-b-submit-pure.json 179/0):
          · an immediate second `grade_unusable` — CASE C3 leg 2 (blocked terminal, ZERO compose calls)
          · a reload between the refusal and the recompose — CASE "reload between refusal and
            recompose" (guard read from storage, not component state)
          · two tabs each recomposing — CASE "two tabs" (per-tab sessionStorage bounds EACH tab to one
            recompose — the same per-tab law as the composeKey itself; never a loop)
          · a recompose that itself refuses — CASE "recompose that itself refuses" (refusal surfaced,
            guard stays set, retry is terminal; recompose-into-dark ⇒ legacy with guard held;
            recompose-throw ⇒ blocked with guard held)
          · a user-initiated retry after the automatic one — CASE "user-initiated retry" (second
            unusable terminal; an intervening SUCCESS closes the incident, which is what makes an
            automatic tight loop impossible: the reset requires a success, and success ends the flow)
        FIXTURE: the SECOND `grade_unusable` does NOT recompose again — pure C3 AND the real-engine
        SB-UNUSABLE (poisoned grading job ⇒ one REAL recompose, second poison ⇒ TERMINAL, presentation
        count proves exactly one mint, zero grader spend).

## GROUP C — FIXTURES + MUTANTS
[x] C1  One case per A1 bypass row. **DONE** — the ten emulator SB-* cases enumerated in A1
        (cutover-b-submit-emulator.json: 65 checks, 0 failures; re-run command in the receipt header).
[x] C2  FLAG-OFF PARITY for BOTH modalities — including the typed two-call sequence and its token.
        **DONE, line by line against the source bytes** (pure CASES C2/MCQ + C2/TYPED + C2/FLAGS):
        the legacy MCQ call + full 13-line context block verbatim · the legacy nonce lines verbatim ·
        `gradeTypedTest({ answers: answersToGrade, listId, classId: classIdParam, gradeContext })`
        verbatim · BOTH token lines + the typed submitVocabAttempt call verbatim · exactly ONE
        submitVocabAttempt site per page and ONE gradeTypedTest site · every rv2 gate reduces to
        today's condition flag-off (`rv2Handle` null by construction) · `REVIEW_V2_CLIENT = false` ·
        `GRADE_TOKEN_ENFORCED = false` + `GRADE_TOKEN_MINT = false` untouched, exactly one assignment
        of each.
[x] C3  The recompose-once guard, both legs. **DONE** — pure CASE C3 (fires once: outcome 'recomposed',
        ONE compose call, fresh composeKey observed; does NOT fire twice: blocked terminal, compose
        calls stay 1) + the REAL leg SB-UNUSABLE (emulator, real poisoned job, real recompose, real
        terminal second refusal).
[x] C4  MUTANT: make the recompose unbounded. **KILLED** — M-C4-UNBOUNDED-RECOMPOSE (guard check
        disabled in reviewV2Submit.js) turns the pure suite red (7 red checks, exit 1); restore
        sha-verified (cutover-b-submit-mutants.json).
[x] C5  MUTANT: drop the idempotency on re-submit. **KILLED** — M-C5-DROP-IDEMPOTENCY (callables.js
        replay short-circuit disabled + txn.create → txn.set) turns the emulator suite red (7 red
        checks, exit 1 — SB-RESUBMIT: replayed missing, second sheet re-graded, submittedAt moved);
        restore sha-verified, no [MUTANT residue (gate scan clean).
[x] C6  Fixtures at the **page/testConfig boundary**, not only the adapter. **DONE** — the pure C6
        cases run the page-boundary builders the pages actually call (`rv2McqAnswers`
        `reviewV2Submit.js:168` from testWords×selected-options — answered-only, definition-string
        responses, de-duped, order preserved; `rv2TypedAnswers` `:185` from words×responses;
        `rv2RowsToTypedResults` `:205` — strict boolean isCorrect, aiReasoning→reasoning, vanished
        read-back ⇒ [] with NO fabricated verdicts), and the C2 static cases pin the page bytes
        themselves (the gates, the calls, the context blocks). The emulator suite drives the same
        adapter surface the pages call, with the REAL compose envelopes as input.

## GROUP D — TRUTH REPAIRS
[x] D1  **DONE 2026-08-04.** The legacy writers now say what they are: `db.js:1249` (submitTestAttempt)
        + `db.js:1382` (submitTypedTestAttempt) — LEGACY flag-off writers, dead behind REVIEW_V2_CLIENT
        where the server grades/writes; the page PHASE-1 nonce comments annotated the same way
        (MCQTest + TypedTest "[CUTOVER-B D1] LEGACY leg only"). 10_ needed no repair (it already says
        "totalQuestions derives server-side"; its one client-write claim — legacy `lastTestedAt`,
        10_:68 — remains TRUE: processTestResults still writes it on both paths, disjoint fields from
        the engine's stamps). 18_ needed no repair (server-view throughout; §7 "changes no legacy
        path" remains true — C2 proves the legacy path is byte-identical).
[x] D2  **DONE 2026-08-04.** The subsumption is recorded AT THE TOKEN'S DEFINITION —
        `functions/index.js:64-78`, immediately above `gradeTokenSecret`/GRADE_TOKEN_ENFORCED/MINT:
        what the token protected (client-held verdict bound to a client-minted docId between the two
        legacy calls) does not exist on the engine path (server-derived id at callables.js:550, grade
        produced and written inside the submit txn, nothing returned pre-write at :812-832). BOTH flag
        VALUES untouched (pure C2/FLAGS asserts `= false` ×2, exactly one assignment each);
        engine-lap re-run 453/0 re-stamps the edited file's sha.

## GROUP E — CARDED, NOT THIS ROUND
[~] E1  Day completion is cutover-c. This fold stops at the attempt being written. **HELD:** flag-on
        and flag-off, everything after the write (processTestResults, the retake snapshot,
        completeSessionFromTest and its guards) runs exactly as cutover-a left it — the engine leg
        rejoins the shared PHASE-2 code at `setAttemptId`. Verified before building: the engine's
        in-txn stamps (`stamping.js:169` — reviewFail/Correct/Proven/TestedAt) and the legacy
        `processTestResults` fields (status/timesTested*/lastTestedAt/lastTestResult/queue tracking)
        are DISJOINT sets on the same study_states docs, so both writers coexist without clobbering.
        The one deliberate seam choice: review progression stays always-pass for completion (the
        legacy law), while the result card shows the server verdict (C-23 idiom) — moving the
        completion gate to the server verdict would BE a completion change, i.e. cutover-c.

## CLOSE
[x] every row ticked with file:line + fixture ref
[x] evidence re-run AFTER the last edit — all three cutover-b receipts and the engine-lap re-run
    postdate the final source edit; every receipt's sourceShas match the tree (gate 3b green)
[x] all shas re-stamped — pure/emulator/mutants receipts bind reviewV2Submit.js, both pages,
    featureFlags.js, functions/index.js, callables.js, typedGrading.js at current bytes;
    engine-lap-result.json re-stamped after the D2 comment edit (453/0)
[x] numbers re-derived from evidence — 179/0 (pure), 65/0 (emulator), 2/2 killed with 7 reds each
    (mutants), 453/0 (engine lap): all read from the JSONs, none hand-typed
[x] change log row (ABSOLUTE path) — /app/change_action_log.md, dated 2026-08-04
[x] `node scripts/deepfix2/gate.mjs` — run at close; verbatim output in the implementer report.
    Expected non-clean remainder is the OPEN visual-check row below (WinClaude order — not
    executable from WSL) and any environment warnings (watcher/baton) owned by the orchestrator.
[x] commit — ORCHESTRATOR'S (the brief forbids git here; nothing was staged, no git commands run)
[ ] **VISUAL CHECK** — I cannot run it (9p mount, win32 node_modules). It is a WinClaude order, and this
    fold NEEDS the submit→grade path that order 98 could not reach, so seed an MCQ class at day start.
    OPEN — the orchestrator issues the order (flag-off parity is the thing to prove; 25WT only; do not
    flip the flag; console capture; typed tests cost real AI money — prefer MCQ).
[x] a concurrent session is writing to this repo — noted for the committer: stage explicitly, never
    `git add -A` (untracked namespace-reservation files in docs/ belong to the other session)
