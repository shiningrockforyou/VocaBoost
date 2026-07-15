# M-MIG — deepfix migration audit

- **runId:** `mig-r19`  **mode:** `full-dry`
- **git:** `a967f54` (HEAD `a967f544e0f3d4bce72861ad82a34d8e2ec27206`) dirty=true (371 paths)
- **migration:** scripts/cs/deepfix-migrate-list-progress.mjs @ P5-FND-3-v1, cohort=/25WT/i, slack=7
- **cohort uids:** hXSKzDlS, w0qimnAT, OYJ5NYWk, l7bIs5RS, d1LmoxgW, PXmLkDFD
- **sandbox docs re-verified:** 16
- **run:** 2026-07-15T10:56:09.600Z

**PROGRAM VERDICT: NOT_CLEAN** — pass=10 fail=0 invalid=0 deferred=8 skip=1

| | ID | Scenario | Expected | Actual | Verdict | Leg |
|---|---|---|---|---|---|---|
| ✅ | SELF-EVAL | oracle-walk self-test (evaluators + FINAL/JSON parser vs synthetic ± poisoned fixtures) | all positive fixtures PASS, poisoned fixtures FAIL, parseFinal round-trips | 10/10 checks ok | **PASS** | self |
| ✅ | MIG-8 | errored-anchor abort (code-walk) | computePair try/catch → PAIR_ERROR/SKIP_ERROR; pool continues for others | try/catch→PAIR_ERROR/SKIP_ERROR=true pool-continues=true | **PASS** | code-walk |
| ✅ | MIG-10a | CS toolchain — manual-pass writes a full valid anchor (static) | manual-pass.mjs writes newWordStartIndex/EndIndex/wordsIntroduced/testId | mpValidAnchor=true | **PASS** | static |
| 🕓 | MIG-10b | CS toolchain — sweep/census read list_progress (static retarget status) | data-integrity-sweep.mjs + deepfix-census2.mjs read list_progress (F6-3 retarget shipped) | sweepReadsLP=false censusReadsLP=false | **DEFERRED** | static |
| ✅ | SANDBOX-GUARD | independent per-doc sandbox re-verify of the --dry plan | every enumerated doc 25WT + lsr_*@vocaboost.test | 16 docs verified sandbox | **PASS** | dry |
| ✅ | MIG-1 | LIVE-STRAND collapse | merged twi == cross-class anchor 640; LIVE-STRAND; MIGRATE | after.twi=640 anchor.twi=640 pop=LIVE-STRAND action=MIGRATE | **PASS** | dry |
| ✅ | MIG-2 | divergent + own-anchor CSD screen | twi==640(fast), csd==15(slow), not quarantined | after.twi=640 after.csd=15 pop=LIVE-STRAND | **PASS** | dry |
| ✅ | MIG-3 | review-only CSD evidence amendment | MIGRATE; csd==13 preserved (not demoted to 3); A6 clean | action=MIGRATE after.csd=13 (anchorDay=3) | **PASS** | dry |
| ✅ | MIG-4 | forged/anchorless → QUARANTINE (dry leg) | SKIP_QUARANTINE + ANCHORLESS_TWI + never zeroed/promoted; legacy retained | action=SKIP_QUARANTINE quarantine=["ANCHORLESS_TWI 5CUSsT0XXShooufEgd69_0HrPB6ejvDxQ16arUh7C: twi=2000 (invalid anchors present)"] invalidAnchors=1 | **PASS** | dry |
| ✅ | MIG-5 | single-doc 1:1 re-key | verbatim csd==5/twi==200; single-doc; 0 deviations | pop=single-doc after={csd:5,twi:200} dropped=0 | **PASS** | dry |
| ✅ | MIG-9 | cohort hard asserts (dry leg) | A1/A2 empty cohort-wide; --dry diff artifact per uid; migrationVersion stamp | twiRegressions=0 csdRegressions=0 artifacts=6 migVer_ok=true | **PASS** | dry |
| 🕓 | MIG-9-backup | backups per source doc (--dry --backup) | one {uid}_{listId}.json (sources[]) per seeded pair | 0/6 backup files present | **DEFERRED** | dry |
| 🕓 | MIG-7 | post-flip catch-up (dry note) | fixture staged; the fold requires --commit+--catchup | seedRacingLegacyWrite present for d1LmoxgW | **DEFERRED** | deferred |
| ⏭️ | MIG-TID | P10c teacherIds backfill --dry | run with --with-teacherids | skipped (default; heavy 1-query-per-cohort-class scan) | **SKIP** | deferred |
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
- **SANDBOX-GUARD** (PASS, dry): all 16 source docs re-read as 25WT + lsr_*
- **MIG-1** (PASS, dry): want after.twi==anchor==640, LIVE-STRAND, MIGRATE, A1/A3 clean; okTwi=true okAnchor=true okPop=true noResidual=true
- **MIG-2** (PASS, dry): want twi==640(fast) csd==15(slow); no CSD_IMPLAUSIBLE; A7 clean; okTwi=true okCsd=true noCsdQuar=true a7=true (population label 'LIVE-STRAND' is not asserted — the own-anchor merge result is)
- **MIG-3** (PASS, dry): want MIGRATE + csd==13 (not demoted to 3) + 0 CSD_IMPLAUSIBLE + A6 clean; okAction=true okCsd=true noCsdQuar=true a6=true
- **MIG-4** (PASS, dry): want SKIP_QUARANTINE + ANCHORLESS/EXCEEDS + never-zeroed + invalid reported; okQuar=true notZeroed=true invalidReported=true. NOTE: the {mode:'quarantined'} canonical + blocked-study UX + list_progress_quarantined log are the resolveListProgress/commit leg (CS-8), NOT this script — deferred.
- **MIG-5** (PASS, dry): want single-doc + verbatim csd==5/twi==200 + 0 deviations; okPop=true okVerbatim=true noDev=true
- **MIG-9** (PASS, dry): cohort A1/A2 empty + a --dry diff artifact per uid carrying migrationVersion=P5-FND-3-v1. (Backups-per-source verified separately via --dry --backup; post-commit twi/csd-after sweep on WRITTEN docs is DEFERRED to Codex.)
- **MIG-9-backup** (DEFERRED, dry): partial/none — dry --backup writes to the shared hardcoded BK_DIR; definitive per-commit backups are the Codex leg
- **MIG-7** (DEFERRED, deferred): nothing is committed (0 list_progress in DB); --catchup finds no stamped canonical — the fold is Codex Task-6. See MIG-7 stub.
- **MIG-TID** (SKIP, deferred): Codex/authorized: NODE_PATH=/app/node_modules node scripts/cs/deepfix-migrate-attempts-teacherids.mjs 25WT --dry ; --commit is the Codex leg.
- **MIG-6** (DEFERRED, deferred): Codex: (1) NODE_PATH=/app/node_modules node scripts/cs/deepfix-migrate-list-progress.mjs 25WT --commit --confirm-migrate=25WT ; (2) re-run the SAME command → expect actions all SKIP_DONE, written=0, and a byte-identical diff. (idempotency stamp: migratedAt on each collapsed legacy doc; existing canonical overwrite only if anchor-validated twi >= existing.)
- **MIG-7** (DEFERRED, deferred): Codex: --commit; then simulate a flag-off client advancing the seedRacingLegacyWrite doc (bump csd/twi + fresh lastSessionAt on the legacy class_progress); then … --catchup --confirm-migrate=25WT → expect the canonical csd/twi to include the racing completion (non-demoting max) and the late legacy doc re-stamped. Fixture seeded: seedRacingLegacyWrite.
- **MIG-9-commit** (DEFERRED, deferred): Codex: after --commit, read back users/{uid}/list_progress/{listId} for [hXSKzDlS, w0qimnAT, OYJ5NYWk, l7bIs5RS, d1LmoxgW, PXmLkDFD] and assert non-regression vs the pre-image; assert dsg-edits/srv_validate/list_progress_backups/{uid}_{listId}.json exists per SOURCE doc; assert every written doc carries migrationVersion=P5-FND-3-v1. (The --dry leg already proved A1/A2 empty + the diff artifact + --dry --backup files.)
- **MIG-10-commit** (DEFERRED, deferred): Codex: after the F6-3 retarget ships, run node scripts/cs/data-integrity-sweep.mjs 25WT against a seeded list_progress corruption → expect a flag; run node scripts/cs/manual-pass.mjs <sandbox student> (commit) → expect an attempt with newWordStartIndex/EndIndex/wordsIntroduced/testId that CS-6's M4 accepts.
- **RET-3** (DEFERRED, deferred): Codex: after --commit + the flag cutover, run the P7 deletion (the P7 deletion script — NOT PRESENT at HEAD, author it first) scoped 25WT → expect 0 legacy class_progress for the cohort; then the reworked sweep exit 0. (RET-1 zero-refs grep is M-STATIC's job.)
