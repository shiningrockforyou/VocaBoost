# CUTOVER-B-SUBMIT — IMPLEMENTER BRIEF (orchestrator-written; the ledger is law)

## Read first, in this order
1. `/tmp/claude-1000/-app/eba7808e-e0e3-43b1-b92b-4d6770ea5b75/scratchpad/cutover-b-submit-fold-ledger.md`
   — THE LEDGER. Groups A, C, D are your scope. E1 is explicitly OUT (day completion = cutover-c).
   Tick rows there (with file:line + fixture refs) as you close them. V1/V6 are already answered — do
   not re-derive them, do not contradict them.
2. `/app/src/services/reviewV2Client.js` — whole file. The ONE call surface. `submitAttempt`,
   `isGradingInProgress`, `isGradeUnusable`, `newComposeKey` already exist. Do not hand-roll a callable.
3. `/app/src/services/reviewV2Compose.js` — cutover-a's compose service (`classifyThrownRefusal`,
   composeKey persistence). Your recompose-once guard builds on its persisted composeKey.
4. `/app/functions/reviewV2/callables.js` — the submit callable (~:550-812). Key lines: :623-625
   `presentation_invalid`, :636-637 replay ⇒ `attempt_written, replayed:true`, zero writes.
5. `/app/functions/reviewV2/typedGrading.js` :74, :299, :354 — where `grade_unusable` comes from (it is
   NOT among the callable's own returns; it passes through from the typed grading resolver).
6. `/app/src/pages/MCQTest.jsx` (~:660-760: legacy submit; :700 client-minted `attemptDocId` nonce;
   :718-721 `context`; :731-733 the call) and `/app/src/pages/TypedTest.jsx` (~:690-1010: the legacy
   TWO-call sequence — :710-718 `gradeTypedTest` → :998-1004 `submitVocabAttempt` with token fields).
7. `/app/src/pages/DailySessionFlow.jsx` + `/app/src/services/studyService.js` — how cutover-a gated
   flag-on branches and surfaces refusals. COPY that idiom; reuse its refusal surfaces; invent no UI.
8. `scripts/deepfix2/cutover-a-compose-fixtures.mjs`, `-emulator.mjs`, `-mutants.mjs` — the harness
   pattern to clone (naming: `cutover-b-submit-{fixtures,emulator,mutants}.mjs`; evidence JSON →
   `docs/plans/deepfix2/evidence/`).

## Mission (ledger A1 + A2)
Behind `REVIEW_V2_CLIENT` (`src/config/featureFlags.js`), submission goes through
`submitAttempt({presentationId, answers})`. The SERVER grades and the SERVER writes the attempt.
Flag-on, the client's verdict computation and its attempt write are dead code paths; the denominator
(`totalQuestions`) is the server's, from the presentation.

## Six settled facts — verified before you; build on them, never against them
1. **V1** — legacy `context` fields map server-side one-for-one; the ONLY purely client-invented field
   is `attemptDocId = uid_testId_nonce` (`MCQTest.jsx:700`) — the 06-29 outage root cause. Send ONLY
   `{presentationId, answers}`. Never smuggle an attemptDocId or totalQuestions.
2. **V2** — the gradeToken is SUBSUMED, not lost: both `GRADE_TOKEN_MINT` and `GRADE_TOKEN_ENFORCED`
   are false in prod (`functions/index.js:67,79`). The engine kills the root cause (server-derived
   attemptId; verdicts never reach the client pre-write — `callables.js:550`, `:812`).
   **DO NOT touch either flag.** Record the subsumption AT THE TOKEN'S DEFINITION (ledger D2).
3. **V3** — the client is today's denominator authority (`totalQuestions: testWords.length`); under the
   engine the presentation is. 50 answers vs a 60-word presentation must FAIL server-side, not read 100%.
4. **V4** — the status census: terminal `attempt_written` (incl. `replayed:true`) · poll
   `grading_in_progress` (retry SAME submit, never recompose) · recompose-ONCE `grade_unusable` ·
   6 block-with-reason (`presentation_invalid`, `queue_invalid`, `visit_invalid`, `day_guard_rejected`,
   `reset_in_progress`, `reset_epoch_mismatch`) · legacy-fallback `config_hold`/`review_v2_dark` as
   DATA + the thrown trio (`class_not_found`/`not_enrolled`/`list_not_assigned` arrive as HttpsError —
   route via `classifyThrownRefusal`). Handle EVERY one.
5. **V5** — recovery INVERTS: the legacy "fetch cached grade and write it" leg is IMPOSSIBLE flag-on
   (client never holds a grade, never writes). Replacement: call submit again — same presentationId ⇒
   `attempt_written, replayed:true`, zero writes.
6. **V6** — flag-off parity is a DESIGN obligation. Gate every new branch at the call site; never
   mutate a shared helper in place; the typed two-call sequence (token fields included) byte-identical
   flag-off. C2 proves it — check the static argument line by line, don't assert it.

## Hard constraints
- `grade_unusable` ⇒ recompose EXACTLY ONCE (new composeKey), then surface a reason — NEVER a loop, a
  looping client hammers a live AI grader. The once-guard must survive: an immediate second
  `grade_unusable` · a reload between refusal and recompose · two tabs · a recompose that itself
  refuses · a user-initiated retry after the automatic one (A2 bypass set). Persist the guard alongside
  the composeKey, not in component state.
- The fold STOPS at the attempt being written. Day completion and everything after stays exactly as
  cutover-a left it, flag-on and flag-off. If that seam is ambiguous anywhere, STOP and report — do not
  improvise a completion behavior.
- Fixtures: one per A1 bypass row (create · re-submit idempotent · post-reset refuse · replay on
  written attempt · vanish between submit and read-back · submit-reset-submit · two tabs concurrent ·
  new-word vs review path · another student's presentationId · teacher-driven) + the A2 set + C2
  flag-off parity BOTH modalities + C3 recompose-once both legs + C6 at the page/testConfig boundary
  (cutover-a's audit found three student-visible defects precisely because no fixture touched pages).
- Mutants: C4 (make recompose unbounded) must turn C3 red; C5 (drop re-submit idempotency) must turn
  C1 red. RESTORE the tree after each mutant run — gate.mjs has a mutant-residue check and an
  un-restored guard would ship.
- Never hand-type a score or count anywhere — numbers exist only in the evidence JSON your harness
  writes.
- Git: DO NOT commit, DO NOT `git add`, DO NOT touch `.claude/*` — a concurrent session shares this
  repo; staging and committing are the orchestrator's.
- No vite, no browser, no UI run (structurally impossible in WSL). No production Firebase — the
  emulator harness only.
- Run `node scripts/deepfix2/gate.mjs` at the end and include its verbatim output in your report.

## Refusal conditions (a REPORT, not something to fix)
- The server contract you observe contradicts the ledger or the RV2 frozen list → STOP, report exactly
  what differs, with file:line.
- Flag-off parity would require editing a shared helper in place → STOP, report.
- The emulator will not start, or anything demands credentials → STOP, report.

## Your final report must contain
- Files changed with line ranges; files created.
- Evidence JSON paths + the exact command to re-run each harness.
- Ledger rows ticked vs not, and why.
- Every ambiguity you hit and what you chose (or stopped on).
Your report will be independently audited against the diff and re-executed. Claims without an evidence
file behind them are treated as unverified.
