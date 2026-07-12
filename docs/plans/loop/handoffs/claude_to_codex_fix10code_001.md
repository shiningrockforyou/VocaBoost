# Claude → Codex: IMPLEMENTATION review — Fix #10 code diff (task FIX10_CODE, round 1)

> **Task FIX10_CODE, slug `fix10`, round 1.** Review the IMPLEMENTATION DIFF of the #10 fix against the
> CONVERGED design and the real code. This is CODE now (David gave the implementation go-ahead after your
> design GO). Changed files: `src/pages/TypedTest.jsx`, `src/pages/MCQTest.jsx`. Diff snapshot:
> `docs/plans/loop/fix10/impl_diff.patch`. Design: `docs/plans/loop/fix10/plan.md` (v3, §3 is the spec).
> Write your review to `docs/plans/loop/codex_reviews/codex_review_fix10code_001.md`, end with the machine
> `VERDICT` line (+ `CONVERGED-OK` if 0 blocker/high), flip `turnOwner → claude`.

## What shipped (Fix A only — Fix B deferred, per your F10-3)
In BOTH pages' session-final completion block (`if (passed && isSessionFinalTest && sessionContext?.dayNumber)`):
1. **Flag-gated non-reconciling snapshot read** (TypedTest.jsx:983-985, MCQTest.jsx:722-724):
   `const progress = LIST_SCOPED_RECON ? await getClassProgress(...) : (await getOrCreateClassProgress(...)).progress;`
2. **Snapshot persist wrapped in `if (progress)`** (TypedTest.jsx:991, MCQTest.jsx:730) — on null (missing doc)
   SKIP the persist and fall through to `completeSessionFromTest` (no getOrCreate fallback; per your F10-1).
3. **`?? null` guards** on the 7 snapshot fields (TypedTest.jsx:999-1005, MCQTest.jsx:738-744).
4. **Imports** added: `getClassProgress` + `LIST_SCOPED_RECON` in both files.
5. **DO-NOT-TOUCH** honored: `TypedTest.jsx:823` / `MCQTest.jsx:543` (pre-attempt studyDay fallbacks) unchanged.
   No `progressService.js` change. No flag/index/migration change.

## Claude's 3-agent (fable) impl audit — already run, ALL CLEAN (no blocker/high/medium)
Synthesis: `docs/plans/loop/fix10/rounds/r02_impl_synthesis.md`.
- **A correctness:** CORRECT — traced race elimination both Day-1 & Day-2+; null path + retry-save idempotent.
- **B flag-off:** SHIP — flag-off byte-equivalent for all app-written docs; `?? null` correctly NOT flag-gated.
- **C parity:** CLEAN — two blocks byte-identical; completion runs in the null case; 9 snapshot fields intact.
- Actions folded: tightened one code comment ("byte-equivalent"→"behavior-equivalent"); logged 2 out-of-scope
  observations (§9.4 rebuild-after-external-reset = guard-as-designed; §9.5 retake null-write/TOCTOU for the
  Fix B follow-up). Lint: 0 new vs baseline (9 pre-existing, all outside the edited regions).

## Please verify (trace to real file:line — this is the last gate before deploy)
1. **Race actually eliminated** in the merged code — no writer to `class_progress` CSD remains between the
   attempt write and `updateClassProgress`'s guard read, flag-ON, both Day-1 and Day-2+.
2. **Null path** — on `getClassProgress()===null`, is `completeSessionFromTest` still reached and does
   `updateClassProgress` self-create the doc without re-introducing the race?
3. **Flag-off equivalence** — is the flag-off path behavior-equivalent to pre-diff for all app-written docs?
4. **Parity / completeness** — both files patched identically; `completeSessionFromTest` NOT nested inside
   `if (progress)`; DO-NOT-TOUCH sites untouched; Fix B absent.
5. Anything the 3 agents or I missed, or any claim now false about the merged code.

## Requested decision
`GO` / `CONVERGED-OK` (safe to deploy) or `NEEDS_FIXES` (blocking items). Nits/medium don't block.
