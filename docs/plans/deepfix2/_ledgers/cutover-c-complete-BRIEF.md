# CUTOVER-C-COMPLETE — IMPLEMENTER BRIEF (the ledger is law)

## Read first, in order
1. `docs/plans/deepfix2/_ledgers/cutover-c-complete-fold-ledger.md` — THE LEDGER, your row-by-row contract.
   V1/V3/V4/V6 are ANSWERED (a scout verified them, file:line inside). **V2 is NOT — you verify it first.**
2. `src/services/reviewV2Client.js` `completeDay` (:194-204) — the ONE call surface: sends
   `{classId, listId, logicalDay, consumedAttemptId, consumedAttemptClassId, newTestAttemptId}`; returns
   `completed` / `already_completed`. `classifyThrownRefusal` (reviewV2Compose.js) routes the thrown trio.
3. `src/services/reviewV2Submit.js` — cutover-b's adapter: the handle pattern, the status routing, the
   flag gating. **Build a parallel `src/services/reviewV2Complete.js` in the same shape.**
4. `src/pages/MCQTest.jsx` (:976 the `completeSessionFromTest` call site · :744-818 the cutover-b engine
   submit leg · :754 `result = {id: out.attemptId}`) + `src/pages/TypedTest.jsx` (:1268 the call site). THE SEAM.
5. `src/services/studyService.js` `completeSessionFromTest` (:1738-2031, the legacy completion; :1881
   `getNewWordAttemptForDay`) + `src/services/progressService.js` (`updateClassProgress` :563-639,
   `graduateSegmentWords`, `calculateUpdatedStreak`) — the LEGACY path that must stay byte-identical flag-off.
6. `functions/reviewV2/completion.js` + `callables.js:847-887` — the engine contract (what completeDay does;
   the exact statuses it reaches — V4).
7. Test harness: `scripts/deepfix2/lib/fold-harness.mjs` (NEW — **use it** for the shared emulator
   scaffolding) + `scripts/deepfix2/cutover-b-submit-{emulator,fixtures,mutants}.mjs` (the pattern to clone).
   Name yours `cutover-c-complete-*`; evidence → `docs/plans/deepfix2/evidence/`.

## Mission (ledger A1 + A2)
Behind `REVIEW_V2_CLIENT` (still false), route the TEST-DRIVEN day completion through `completeDay`: the
server advances the day + graduates + streaks; the client stops computing them. Send completeDay the
attempt IDS, not computed values.

## FIRST — verify V2 (the attempt-id slot mapping) IN CODE, before any edit
completeDay wants `consumedAttemptId` (the REVIEW attempt satisfying the day; classId-bound at
`completion.js:329`) + `newTestAttemptId` (the NEW-word attempt; NOT classId-bound). Post-cutover-b,
`result.id = out.attemptId` (`MCQTest:754`). At the `completeSessionFromTest` call sites (`MCQTest:976`,
`TypedTest:1268`): determine which test (review vs new) just submitted → which slot its id fills; and where
the OTHER slot's id comes from on a new-word day (today `completeSessionFromTest` self-derives it via
`getNewWordAttemptForDay:1881`, AFTER the call). The seam must resolve BOTH ids at/before the completeDay
call. **If the mapping differs from the ledger's assumption, STOP and report with file:line — this is the
core plumbing and getting it wrong wastes the fold.**

## Settled facts (V1/V3/V4/V6 — build on them, do not re-derive or contradict)
- **V1:** every value the client computes at completion (CSD/TWI advance · graduation [client random →
  engine deterministic] · streak [client counter → engine ledger] · the day-2+ evidence gate) is
  server-derived under completeDay. Send IDs.
- **V3 (the inversion):** `already_completed` is a TERMINAL SUCCESS (re-run nothing), NOT today's
  `dayGuardRejected` ERROR. Map it to the day-DONE success path — the same shape cutover-b established for
  `attempt_written{replayed:true}`. NEVER onto `dayGuardRejected`.
- **V4:** handle EVERY completeDay status — `completed` · `already_completed` · refusals as DATA
  (`no_evidence`/`day_guard_rejected`/`reset_in_progress`/`reset_epoch_mismatch`/`queue_invalid`/
  `presentation_invalid`/`list_words_malformed`) · legacy-fallback `config_hold`/`review_v2_dark` · the
  thrown trio via `classifyThrownRefusal`. VERIFY the exact set the callable reaches (grep may miss ones
  passing through from the gate/epoch/word-load helpers).
- **V6:** flag-off parity — `completeSessionFromTest`/`completeSession`/`updateClassProgress`/
  `graduateSegmentWords`/`recordReviewOutcome` BYTE-IDENTICAL. New branches gated at the call sites ONLY.

## Hard constraints
- **E1 CARVE:** the EMPTY-REVIEW / no-test auto-complete (`completeSession` in `DailySessionFlow.jsx:~1727`,
  all-mastered day) has NO evidence ⇒ completeDay returns `no_evidence` ⇒ it STAYS LEGACY. Do NOT route it
  through completeDay; assert it stays legacy (a fixture).
- The graduation FIELD split (client `status=MASTERED`+`returnAt` vs engine `reviewRestingUntil`) is
  CONSISTENT by construction (the composer reads only `reviewRestingUntil`) — do NOT add a fixture asserting
  client==server graduation.
- Fixtures: one per A1/A2 bypass row + C2 flag-off parity (both modalities) + C3 idempotency + C4 mutant
  (loser re-runs advance → red) + C5 mutant (`already_completed`→error path → red) + C6 at the page/call-site
  boundary. Restore the tree after each mutant (the gate fails on `[MUTANT` residue).
- NO git commit/add · NO `.claude/*` edits · NO `change_action_log` write (propose the row TEXT) · NO
  flag-value changes · NO deploy · stage nothing (a concurrent session shares the repo).
- Never hand-type a score/count — derive from the evidence your run writes.
- Run `node scripts/deepfix2/gate.mjs --plan docs/plans/deepfix2/_ledgers/cutover-c-complete-fold-ledger.md`
  before editing and `gate.mjs <that path>` at the end; include both verbatim.

## Refusal (a REPORT, not something to fix)
- V2 slot mapping differs from the ledger → STOP, cite file:line.
- Flag-off parity would require mutating a shared helper in place → STOP.
- The emulator won't start / anything needs production credentials → STOP.
- The status census contradicts the ledger → STOP.

## Report (for an orchestrator who will re-run your evidence + audit your diff)
`filesChanged` manifest + files created; evidence JSON paths + exact re-run commands; ledger rows ticked
vs not and why; V2's RESOLVED mapping (which id → which slot, per phase); every ambiguity and what you chose
or stopped on; the proposed change-log row; the verbatim gate output. Claims without an evidence file are
treated as unverified.
