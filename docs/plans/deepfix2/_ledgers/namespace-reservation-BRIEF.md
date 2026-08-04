# NAMESPACE-RESERVATION — IMPLEMENTER BRIEF (LIVE-PATH fold; the design + ledger are law)

You implement the fix for the two pre-flip PERMANENT-DENIAL blockers (NEED_TO_FIX 19 + 22), now one fold.
**This touches the LIVE path 947 students use today** (firestore.rules + two live callables). Precision
and refusal-over-improvisation matter more than speed.

## Read first, in this order — do not edit before you have
1. `/app/docs/plans/deepfix2/20_ENGINE_NAMESPACE_RESERVATION.md` — THE DESIGN. The root cause, the THREE
   vectors (V-A rules create · V-B the `submitVocabAttempt` callable that BYPASSES rules · V-C
   `gradeTypedTest`), the three guards G1/G2/G3, and §4 THE RULES-ARTIFACT PROTOCOL. Do not deviate.
2. `/app/docs/plans/deepfix2/_ledgers/namespace-reservation-fold-ledger.md` — THE LEDGER, your row-by-row
   contract. V-rows are answered — build on them, do not re-derive or contradict. Tick A/C/D rows with
   file:line + fixture refs as you close them; leave honest `[ ]` on anything not closed.
3. Verify V2 yourself before trusting it: `grep -rn "rv2_" /app/src` (expect ONLY the
   `rv2_compose_invalid_day` LOG-event name — NO document write). This is the proof the guards deny
   nothing legitimate. If you find a real client writer of an `rv2_`-named doc, STOP and report.
4. `/app/functions/index.js` — the two live callables: `submitVocabAttempt` (:530) → `assertCanWriteAttempt`
   (:306) → `writeAttempt` (`db.collection("attempts").doc(ctx.attemptDocId)` :471, Admin SDK); and
   `gradeTypedTest` (:1005; client jobKey at :1048-1051 → `claimOrRecoverGradingJob`). Confirm
   `GRADE_TOKEN_ENFORCED=false` (:67), `GRADE_JOB_ENABLED=true` (:104).
5. `/app/firestore.rules` — the attempts CREATE clause (:301-317). Note it is BYTE-IDENTICAL to the three
   baseline artifacts (sha16 `f40f91fce3693b82`): `audit/deepfix/task3/live_baseline/firestore.merged.rules`,
   `.../firestore.live.rules`, `audit/deepfix/task3/firestore.review_v2.rules`.
6. `/app/functions/reviewV2/composer.js:132` (`engineDocId`) and `callables.js:551`, `typedGrading.js:270`
   — the ENGINE's OWN write paths. They derive `rv2_` ids server-side and must stay UNTOUCHED.
7. `scripts/deepfix2/rules-matrix.mjs`, `rules-mutants.mjs`, `run-rules-matrix.sh` — the rules harness you
   extend. `audit/deepfix/task3/live_baseline/rv2-docid-precondition-receipt.json` — the retrospective
   scan that already exists (0 rv2_ ids / 41,688 attempts + 16,732 grading_jobs); C0 = re-run/confirm it,
   not author from scratch.
8. Clone the emulator-fixture pattern from `scripts/deepfix2/cutover-a-compose-{fixtures,emulator,mutants}.mjs`
   for the callable guards G2/G3 (name yours `namespace-reservation-*`; evidence JSON →
   `docs/plans/deepfix2/evidence/`).

## The three guards (ledger A1/A2/A3) — each denies nothing legitimate (§5 of the design proves it)
- **G1 — rules** attempts CREATE: add `&& !attemptId.matches('rv2_.*')` (RE2 full-match ⇒ prefix). Land it
  in `/app/firestore.rules` **AND the three baseline artifacts in lockstep** (§4). Extend `rules-matrix.mjs`
  (a `rv2_`-create DENY case for a stranger AND for the victim's own uid-in-name; a legit
  `{uid}_{testId}_{nonce}` create that MUST still ALLOW — the false-DENY failure mode is the one this
  program fears most) and `rules-mutants.mjs` (revert G1 ⇒ the DENY case reddens). Re-run `run-rules-matrix.sh`.
- **G2 — `submitVocabAttempt`/`writeAttempt`:** refuse `ctx.attemptDocId` matching `^rv2_` with
  `invalid-argument`, BEFORE the Admin-SDK write. Unconditional (a security guard, not flag-gated).
- **G3 — `gradeTypedTest`:** refuse client `(writeContext||gradeContext).attemptDocId` matching `^rv2_`
  with `invalid-argument`, BEFORE `claimOrRecoverGradingJob`.
- Do NOT put the `^rv2_` refusal inside the shared `claimOrRecoverGradingJob` or `writeAttempt` — the
  ENGINE calls those legitimately with server-derived `rv2_` ids. Guard at the CLIENT-INPUT boundary only.

## Fixtures + mutants (ledger C1–C7) + truth repairs (D1–D4)
- One fixture per bypass row in A1/A2/A3 (incl. the ALLOW-still-allowed and both-modalities cases), C7 the
  cross-boundary proof (same victim id denied at ALL THREE boundaries), C4/C5/C6 the three revert-mutants.
- D1 (card 22 "rules-only insufficient") is ALREADY corrected in NEED_TO_FIX by the orchestrator — VERIFY it
  reads correctly, do not re-edit. D3/D4: the stale rules-matrix P10 comment and the typedGrading/callables
  "naming convention" comments — append that the boundary is now enforced; do NOT delete the descriptions.

## Hard constraints (violating any is a failed fold)
- **NO git commit. NO `git add`. NO `.claude/*` edits.** A concurrent session shares this repo.
- **Do NOT write `/app/change_action_log.md`** — put your proposed change-log row TEXT in your report; the
  orchestrator appends it on fold (avoids a concurrent-append clobber).
- **Do NOT touch `GRADE_TOKEN_ENFORCED`, `GRADE_TOKEN_MINT`, `GRADE_JOB_ENABLED`, or `REVIEW_V2_CLIENT`.**
- **Do NOT deploy anything. Do NOT flip any baton.** This fold produces code + fixtures only.
- **The rules AFTER-sha is re-derived from the matrix receipt, never typed.** Never hand-type any score/count.
- Run the gate with the EXPLICIT ledger path (never let it pick a scratchpad ledger):
  `node scripts/deepfix2/gate.mjs --plan docs/plans/deepfix2/_ledgers/namespace-reservation-fold-ledger.md`
  before editing, and `node scripts/deepfix2/gate.mjs docs/plans/deepfix2/_ledgers/namespace-reservation-fold-ledger.md`
  at the end. Include verbatim output.
- After any mutant run, RESTORE the tree (the gate fails closed on a `[MUTANT` marker left in functions/ or
  src/, and a reverted-guard residue would ship).

## Refusal conditions — a REPORT, not something to work around
- A legit client flow supplies an `rv2_` id anywhere (grep proves otherwise, but if it doesn't) → STOP.
- The four rules artifacts are NOT byte-identical before you start, or your edit cannot keep them in
  lockstep → STOP, report the divergence with shas.
- The Firestore emulator will not start, or anything demands production credentials → STOP, report.
- Guarding at the client boundary would require editing a shared helper the engine also uses → STOP.
- A rules-matrix ALLOW case that passed before now DENIES (a false-DENY that would break real students) →
  STOP, report — this is the failure mode that matters most.

## Your final report (for an orchestrator who will re-run your evidence and audit your diff)
Files changed with line ranges; files created; the four rules-artifact shas AFTER (must match); evidence
JSON paths + exact re-run commands (matrix, mutants, G2/G3 fixtures, the C0 scan confirm); ledger rows
ticked vs not and why; every ambiguity and what you chose or stopped on; the proposed change_action_log
row text; the verbatim gate output. Claims without an evidence file behind them are treated as unverified.
