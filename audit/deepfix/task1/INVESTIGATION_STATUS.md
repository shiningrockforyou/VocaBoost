# Task 1.6 — investigation status tracker

Live status of the WS-F empirical scans (orchestrator, read-only) + WS-C code investigations (agents).
Findings land in `firebase/scan_*_FINDINGS.md` / `firebase/*.json` and `investigations/inv_*.md`; roots roll up
into `ROOT_CAUSE_FINDINGS.md` (1.6). Legend: ✅ done · 🔄 running · ⏳ queued · ⛔ blocked (dep/env).

## WS-F — empirical Firebase scans (orchestrator, READ-ONLY)
| Scan | What | Status | Result |
|---|---|---|---|
| F-1 | attribute impossible_phase / day_guard | ✅ | day_guard = 6 real 26SM students (prod fires it); impossible_phase = 531 real states (emitter studyService.js:105-114); no-uid = observability gap. scan_F1_FINDINGS.md |
| F-2 | precise #13 recount | ✅ | 18 undersized / 17 students / 5 day-1. scan_F2_testsize.json + CENSUS2_FINDINGS.md |
| F-3 | dual-enroll live-#12 split | ✅ | 36 LIVE-STRAND + 6 divergent (~42 live) + 72 latent, of 141. CENSUS2_FINDINGS.md |
| F-4 | H/P/B partition | ✅ | H=541 / P=45(24 re-stuck) / B=188 (~30% broken-or-patched). scan_F4_hpb.json |
| F-5 | config drift | ✅ | 12 off-normal (제주/유라시아 90-tier + undef retake-thr). scan_F5_FINDINGS.md |
| F-9 | deploy-state probe | ✅ | prod = ENFORCED:false + SERVER_ATTEMPT_WRITE:true. G1 gap confirmed. CENSUS2_FINDINGS.md |
| F-11 | twi vs mastery | ✅ | 4 over-credits (2 known patches) — C-05 rare. |
| F-6 | tokens / permanent-fail census | ✅ | 3 permanent-fail (all known cases); 3 of 817 locked; 614 pending backlog. scan_F6_FINDINGS.md |
| F-7 | grader false-negative eval set | ⏳ | feeds I-4 |
| F-8 | automarker / testId-less census | ⏳ | feeds C-14/C-34 |
| F-12 | continuation exposure | ⏳ | feeds C-11/12/13 |
| F-13 | review-quality distribution | ⏳ | feeds C-10/20/21, I-9 |
| F-14 | #12 strand timelines | ⏳ | feeds I-1 |

## WS-C — code/root-cause investigations (agents on code + exports; NO live access)
| Inv | What | Status | Result |
|---|---|---|---|
| I-8 | read-surface fix spec | ✅ | 2 composite indexes; field-first listId; 6-site helper; seed at db.js:328. inv_I8_read_surfaces.md |
| I-10 | permission-gap trace | ✅ | C-19 PINNED — teacherId stamp + 3 predicates + rules; corrected the H1-gate claim. inv_I10_permission_gap.md |
| I-2 | day-state predicate matrix + impossible_phase verdict | ✅ | predicate complete except C-14 automarker gap; impossible_phase = mixed/anomaly (reset/CS-drop, NOT direct #12, emitter Dashboard.jsx:1464); plan §5 cites DEAD code (:800-816, live :590-623); 10-state matrix. inv_I2_reviewonly_matrix.md |
| I-3 | #13 generation-path pin | ⏳ | dep F-2 ✅ → ready (deferred: #13 sized at 18, moderate value) |
| I-1 | #12 mechanism (elimination; repro not in WSL) | ⛔ | dep F-14; repro needs Vite/Playwright (Codex/David). I-2: impossible_phase is the reset/CS-drop family, class-scoped |
| I-5 | G1 deploy-gate hardening design | ✅ | nonce root cause CONFIRMED e2e; fix = server-echoed docId + memoized nonce; **#11/#9/#10/C-27 deployable hosting-only (no G1 re-arm)**; flag table. inv_I5_deploy_gate.md |
| I-6 | foundation design (KEYSTONE, Task-2 gate) | ✅ | ONE migration (list-owned + server-auth twi); conflict rule mapped to F-3; phase order FND-0…OVR; CSD-plausibility-vs-reviewOnly risk. inv_I6_foundation.md |
| I-4 | grader calibration eval | ⏳ | dep F-7 |
| I-7 | override + challenge design | ⏳ | dep I-6 + C-28 role decision |
| I-9 | review-model + legibility spec | ⏳ | dep F-13 |

## WS-V — 1.5 H1 gate: ✅ COMPLETE (H1_GATE_1.5.md); I-10 corrected the C-19 finding.

**Task 1.6 COMPLETE** → `ROOT_CAUSE_FINDINGS.md` + `reports/TASK1_REPORT.md` written. Deferred (not essential to
roots, run in Task 2 if a design needs them): F-7/F-8/F-12/F-13/F-14, I-1 (env-blocked repro), I-3, I-4, I-7, I-9.
