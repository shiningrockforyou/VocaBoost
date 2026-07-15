# M-MIG — deepfix migration audit

- **runId:** `mig-wsl-selfval`  **mode:** `self-validate`
- **git:** `a967f54` (HEAD `a967f544e0f3d4bce72861ad82a34d8e2ec27206`) dirty=true (367 paths)
- **migration:** scripts/cs/deepfix-migrate-list-progress.mjs @ P5-FND-3-v1, cohort=/25WT/i, slack=7
- **cohort uids:** (none — resolved in full mode)
- **sandbox docs re-verified:** 0
- **run:** 2026-07-15T10:41:02.531Z

**PROGRAM VERDICT: SELF_VALIDATED (no live oracles run; commit legs deferred)** — pass=3 fail=0 invalid=0 deferred=12 skip=0

| | ID | Scenario | Expected | Actual | Verdict | Leg |
|---|---|---|---|---|---|---|
| ✅ | SELF-EVAL | oracle-walk self-test (evaluators + FINAL/JSON parser vs synthetic ± poisoned fixtures) | all positive fixtures PASS, poisoned fixtures FAIL, parseFinal round-trips | 10/10 checks ok | **PASS** | self |
| ✅ | MIG-8 | errored-anchor abort (code-walk) | computePair try/catch → PAIR_ERROR/SKIP_ERROR; pool continues for others | try/catch→PAIR_ERROR/SKIP_ERROR=true pool-continues=true | **PASS** | code-walk |
| ✅ | MIG-10a | CS toolchain — manual-pass writes a full valid anchor (static) | manual-pass.mjs writes newWordStartIndex/EndIndex/wordsIntroduced/testId | mpValidAnchor=true | **PASS** | static |
| 🕓 | MIG-10b | CS toolchain — sweep/census read list_progress (static retarget status) | data-integrity-sweep.mjs + deepfix-census2.mjs read list_progress (F6-3 retarget shipped) | sweepReadsLP=false censusReadsLP=false | **DEFERRED** | static |
| 🕓 | MIG-1 | LIVE-STRAND collapse | PASS on a seeded 25WT per-uid --dry run | NOT RUN (--dry-only self-validation: no live writes/reads in this env) | **DEFERRED** | deferred |
| 🕓 | MIG-2 | divergent + own-anchor CSD | PASS on a seeded 25WT per-uid --dry run | NOT RUN (--dry-only self-validation: no live writes/reads in this env) | **DEFERRED** | deferred |
| 🕓 | MIG-3 | review-only evidence | PASS on a seeded 25WT per-uid --dry run | NOT RUN (--dry-only self-validation: no live writes/reads in this env) | **DEFERRED** | deferred |
| 🕓 | MIG-4 | forged/anchorless quarantine (dry leg) | PASS on a seeded 25WT per-uid --dry run | NOT RUN (--dry-only self-validation: no live writes/reads in this env) | **DEFERRED** | deferred |
| 🕓 | MIG-5 | single-doc 1:1 | PASS on a seeded 25WT per-uid --dry run | NOT RUN (--dry-only self-validation: no live writes/reads in this env) | **DEFERRED** | deferred |
| 🕓 | MIG-9 | cohort hard asserts (dry leg) | PASS on a seeded 25WT per-uid --dry run | NOT RUN (--dry-only self-validation: no live writes/reads in this env) | **DEFERRED** | deferred |
| 🕓 | MIG-6 | idempotent re-run | second --commit run is a no-op (0 additional diffs; no double-merge) | NOT RUN (write-guarded; Codex Task-6) | **DEFERRED** | deferred |
| 🕓 | MIG-7 | post-flip catch-up fold | a completion landing on a stamped legacy doc (lastSessionAt > migratedAt) is folded into canonical; no loss | NOT RUN (write-guarded; Codex Task-6) | **DEFERRED** | deferred |
| 🕓 | MIG-9-commit | post-commit cohort sweep (written docs) | twi_after >= twi_before AND csd_after >= csd_before for every seeded student on the WRITTEN canonical docs; one backup file per source doc; every canonical traces to the runId stamp | NOT RUN (write-guarded; Codex Task-6) | **DEFERRED** | deferred |
| 🕓 | MIG-10-commit | CS toolchain retarget — live sweep + manual-pass | the reworked sweep flags a seeded list_progress corruption (not via class_progress); manual-pass writes a canonical valid anchor CS-6 M4 accepts | NOT RUN (write-guarded; Codex Task-6) | **DEFERRED** | deferred |
| 🕓 | RET-3 | legacy deletion + sweep clean (sandbox) | after the P7 deletion script, 0 class_progress docs remain for the 25WT cohort AND the list_progress-shaped sweep exits 0 | NOT RUN (write-guarded; Codex Task-6) | **DEFERRED** | deferred |

## Evidence
- **SELF-EVAL** (PASS, self): evaluators + parser proven against synthetic positive/negative fixtures
- **MIG-8** (PASS, code-walk): code-walk: computePair wraps the pair in try/catch → QUAR.PAIR_ERROR + SKIP_ERROR ("errored lookups move NOTHING") and the POOL loop processes other pairs regardless. A hard computePair THROW is not deterministically seed-reproducible (the script is defensively coded); the invalid-anchor "moves nothing" arm is exercised live by seedForgedTwiHigh (MIG-4).
- **MIG-10a** (PASS, static): the manual-pass canonical-anchor half of MIG-10 (CLAUDE.md rule) is shipped at HEAD
- **MIG-10b** (DEFERRED, static): RETARGET NOT SHIPPED at HEAD: sweep + census still read class_progress (empirically confirmed 2026-07-14). This is a P7/F6-3 shipped-state oracle — DEFERRED with status, not a migration FAIL.
- **MIG-1** (DEFERRED, deferred): runner + evaluator validated via SELF-EVAL; the live seed+--dry leg runs in the authorized env (Codex/David).
- **MIG-2** (DEFERRED, deferred): runner + evaluator validated via SELF-EVAL; the live seed+--dry leg runs in the authorized env (Codex/David).
- **MIG-3** (DEFERRED, deferred): runner + evaluator validated via SELF-EVAL; the live seed+--dry leg runs in the authorized env (Codex/David).
- **MIG-4** (DEFERRED, deferred): runner + evaluator validated via SELF-EVAL; the live seed+--dry leg runs in the authorized env (Codex/David).
- **MIG-5** (DEFERRED, deferred): runner + evaluator validated via SELF-EVAL; the live seed+--dry leg runs in the authorized env (Codex/David).
- **MIG-9** (DEFERRED, deferred): runner + evaluator validated via SELF-EVAL; the live seed+--dry leg runs in the authorized env (Codex/David).
- **MIG-6** (DEFERRED, deferred): Codex: (1) NODE_PATH=/app/node_modules node scripts/cs/deepfix-migrate-list-progress.mjs 25WT --commit --confirm-migrate=25WT ; (2) re-run the SAME command → expect actions all SKIP_DONE, written=0, and a byte-identical diff. (idempotency stamp: migratedAt on each collapsed legacy doc; existing canonical overwrite only if anchor-validated twi >= existing.)
- **MIG-7** (DEFERRED, deferred): Codex: --commit; then simulate a flag-off client advancing the seedRacingLegacyWrite doc (bump csd/twi + fresh lastSessionAt on the legacy class_progress); then … --catchup --confirm-migrate=25WT → expect the canonical csd/twi to include the racing completion (non-demoting max) and the late legacy doc re-stamped. Fixture seeded: seedRacingLegacyWrite.
- **MIG-9-commit** (DEFERRED, deferred): Codex: after --commit, read back users/{uid}/list_progress/{listId} for [<cohort ] and assert non-regression vs the pre-image; assert dsg-edits/srv_validate/list_progress_backups/{uid}_{listId}.json exists per SOURCE doc; assert every written doc carries migrationVersion=P5-FND-3-v1. (The --dry leg already proved A1/A2 empty + the diff artifact + --dry --backup files.)
- **MIG-10-commit** (DEFERRED, deferred): Codex: after the F6-3 retarget ships, run node scripts/cs/data-integrity-sweep.mjs 25WT against a seeded list_progress corruption → expect a flag; run node scripts/cs/manual-pass.mjs <sandbox student> (commit) → expect an attempt with newWordStartIndex/EndIndex/wordsIntroduced/testId that CS-6's M4 accepts.
- **RET-3** (DEFERRED, deferred): Codex: after --commit + the flag cutover, run the P7 deletion (the P7 deletion script — NOT PRESENT at HEAD, author it first) scoped 25WT → expect 0 legacy class_progress for the cohort; then the reworked sweep exit 0. (RET-1 zero-refs grep is M-STATIC's job.)
