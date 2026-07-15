# Claude → Codex: DEEPFIX Task 3 P10 (OVR) part (c) — the read-surface widening DRAFT

> **TASK = DEEPFIX_TASK3_P10C, round 1.** FIX_PLAN P10 part (c): the C-19 read-surface widening so a promoted
> student's OLD-teacher-stamped attempts show in the NEW teacher's gradebook. **David decided U1 = Option A:
> `teacherIds`-array denormalization + reindex + a `--dry` backfill migration.** Dormant, DOUBLE-flag-gated,
> LOCAL-ONLY; the migration is `--dry`-only (commit is David's, P5-style). Part (d) (custom-claim role + rules
> narrowing) is the NEXT separate draft — OUT OF SCOPE here (firestore.rules untouched; only indexes added).
> Write `/out/reviews/codex_deepfix_task3_p10c_001.md`, VERDICT (+ CONVERGED-OK if clean), flip → claude.
> ADJUDICATE the uncertainties.

## BINDING RULE (David): "always verify all claims… Never trust blindly. Always verify."

## Read
- **Plan/decision:** `audit/deepfix/task3/P10_IMPL_PLAN.md` (★ OWNER DECISIONS banner U1=A + §1(c)) +
  `audit/deepfix/task3/P10c_impl_notes.md` (§5 uncertainties). Diff: `audit/deepfix/task3/phase10c_diff.patch`.
- **Changed:** `src/config/featureFlags.js` (`TEACHER_IDS_READ=false` :165), `functions/foundation.js`
  (`TEACHER_IDS_WRITE_ENABLED=false` :108; shared `computeTeacherIdsForAttempt` :1875; write-stamps), `functions/
  index.js` (writeAttemptTxn stamps :426/:456), `src/services/db.js` (client twin :1198; write-stamps :1324/:1483;
  widened query :2076; ex-roster filter :1937/:1946), `firestore.indexes.json` (+4 teacherIds indexes),
  `scripts/cs/deepfix-migrate-attempts-teacherids.mjs` (--dry backfill).

## Orchestrator pre-checks (H1 — confirm, don't re-derive)
Flag-off byte-equivalence + zero-read VERIFIED: server helper `:1876` `if(!TEACHER_IDS_WRITE_ENABLED) return null`
BEFORE any read; client write-stamps gated `if(TEACHER_IDS_READ)` at `db.js:1324/:1483` (helper never called when
off); read query `:2076` flag-off = `where('teacherId','==',…)` verbatim; ex-roster `:1946` gated. Parser OK;
eslint delta 0; `--dry` migration ran WRITE-FREE on live 26SM (400 in-scope, 0 writes; --commit refused without
--confirm).

## Verify (priority) — the correctness Codex owns
1. **★ U1 (load-bearing) — read scope vs authz scope.** The membership set (`computeTeacherIdsForAttempt`) is
   **list-scoped**: stamp ∪ owners of the student's currently-enrolled classes THAT ASSIGN the attempt's listId —
   deliberately TIGHTER than `overrideAttempt`'s `assertOverrideAuthz` "owns any enrolled class". So the gradebook
   READ surfaces a NARROWER set than the override AUTHZ. Is that the right call, or must read == authz? (A teacher
   who can override but isn't list-scoped-owner wouldn't SEE the attempt.)
2. **Disjunction budget (the STOP condition).** Claim: `array-contains` contributes a factor of 1 (like the
   equality it replaces), so `array-contains + studentId in[k] + classId in[m]` = m·k, bounded by the UNCHANGED
   C-33 guard `classDisjuncts*studentIds<=30`. Confirm no over-budget query ships; re-validate in the emulator at
   cutover.
3. **Write-stamp coverage + the field's additivity.** Stamped at writeAttemptTxn/writeUpgradedReviewMarker/
   overrideAttempt/reviewChallenge (arrayUnion re-stamp) + client submit paths. Correct set on each? The
   arrayUnion re-stamp on reviewChallenge UPDATE (U2) — should an update re-stamp at all?
4. **Migration** (`deepfix-migrate-attempts-teacherids.mjs`): conflict rule (union-never-demote), idempotency
   (`teacherIdsBackfilledAt`), cohort scoping by attempt.classId (non-cohort old class out of scope — is `--all`
   the right full-reindex escape?), legacy testId→listId parse parity, backups, --dry write-free + --commit guard.
5. **Ex-roster name-filter fix** (`:1937`, cap `EX_ROSTER_SCAN_LIMIT`): the bounded cached pre-scan — cap adequate?
   chicken/egg vs a server callable?
6. **U-promotion:** nothing re-stamps on `joinClass` (stamping scoped to attempt-write paths + migration) — is the
   recommended `joinClass` append a required follow-up or acceptable-deferred? The 4-index family — confirm or trim.

VERDICT + CONVERGED-OK if 0 blockers/0 high. GO = (c) is a correct, safe, dormant draft → part (d) begins.
