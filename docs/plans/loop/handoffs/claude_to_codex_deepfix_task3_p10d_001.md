# Claude → Codex: DEEPFIX Task 3 P10 part (d) — custom-claim role + rules NARROWING DRAFT

> **TASK = DEEPFIX_TASK3_P10D, round 1.** The **security point-of-no-return**: FIX_PLAN P10 part (d) — David
> decision **role = Option A (custom auth claim)**. STAGED (rules deploy only at the P10 cutover, like the P6
> cutoff already in the file), claim-set flag-gated dormant, backfill `--dry`-only, LOCAL-ONLY. Review HARD — this
> re-keys ~15 rules at once. Write `/out/reviews/codex_deepfix_task3_p10d_001.md`, VERDICT (+ CONVERGED-OK if
> clean), flip → claude. ADJUDICATE U1–U8.

## BINDING RULE (David): "always verify all claims… Never trust blindly. Always verify."

## Read
- **Plan/decision:** `audit/deepfix/task3/P10_IMPL_PLAN.md` (role=A + §1(d)) + `audit/deepfix/task3/P10d_impl_notes.md`
  (§5 U1–U8, incl. the full blast-radius table). Diff: `audit/deepfix/task3/phase10d_diff.patch`.
- **Changed:** `firestore.rules` (isTeacher→claim `:104-106`; users-subcollection WRITE→isOwner `:184`; attempts
  UPDATE→`if false` `:282`; header P10d note `:35-71`), `functions/index.js` (`TEACHER_CLAIM_ENABLED=false` `:1965`;
  provisionTeacher claim mint `:2058-2068`; version probe `:2130`), `scripts/cs/deepfix-backfill-teacher-claims.mjs`
  (NEW, --dry).

## Orchestrator pre-checks (H1 — confirm, don't re-derive)
- `isTeacher():104-106` = claim-only, fail-closed (null claim → false); all call-sites `isAuthenticated()`-guarded.
- Narrowings: users-subcollection WRITE → `isOwner` (READ `:181` unchanged); attempts UPDATE → `if false`. Both
  safe ONLY because the teacher write paths are now server-side (reviewChallenge/overrideAttempt = Admin SDK,
  bypass rules) — each comment couples the narrowing to its server-flag rollback.
- provisionTeacher claim mint gated on `TEACHER_CLAIM_ENABLED` (false), fail-closed throw; backfill `--dry` write-guard.
- Staged (rules not deployed); functions claim-set dormant. eslint delta 0; parser OK; patch git-apply+round-trip.

## Verify (priority) — the point-of-no-return crux
1. **★ Blast-radius / precondition SUFFICIENCY.** `isTeacher()→claim` re-keys ~15 rules AT ONCE (P10d_impl_notes
   enumerates them: class_progress CG read, users update/read, classes/lists create, system_logs read, 9× ap_*).
   Safety rests ENTIRELY on the hard preconditions D1–D4 (provisionTeacher live → claim backfill → token-refresh
   window → rules deploy). Is that discipline SUFFICIENT + enforceable? Is the **transition-safety choice A
   (hard-precondition) vs B (claim-OR-doc window, inline)** the right call given a claimless/un-refreshed teacher
   loses ALL 15 at cutover? (David accepted the promote→re-login lag — but is a fleet-wide re-key safe under A, or
   should B bridge it?)
2. **Narrowing correctness + rollback-coupling.** attempts UPDATE `if false` — any LEGIT teacher attempt-update
   left (grep says no; override is server-side)? users-subcollection WRITE→isOwner — does any live teacher write
   to a student subcollection remain (study_states now server-side via reviewChallenge)? Are the SERVER_OVERRIDE /
   reviewChallenge-server rollback couplings correct?
3. **Claim mint** (`:2058-2068`): merge-vs-replace (provisionTeacher replaces `{role:'teacher'}`, backfill merges —
   U2); fail-closed UX; idempotent path. Backfill script: --dry write-guarded, --confirm sentinel, MERGE-set.
4. **U6:** the users-doc `challenges` teacher branch (`:146`) is now also dead (server-side) but was NOT a named
   TODO — narrow it too, or leave + document? **U5:** token-refresh accelerator (`getIdToken(true)`) not wired.
   **U8:** `getUserData()` now defined-but-unused (the Option-B fallback).

VERDICT + CONVERGED-OK if 0 blockers/0 high. GO = (d) is a correct, safe, STAGED draft with sound deploy
preconditions → **P10 fully drafted** → P7 (retirement patch) is the last piece.
