# M-STATIC — deepfix static certifier

- **runId:** `a967f54-baseline`  **target:** `baseline`
- **git:** `a967f54` (HEAD `a967f544e0f3d4bce72861ad82a34d8e2ec27206`) dirty=true (320 paths)
- **dist:** local dist/ built 2026-07-14T09:12:20.509Z (NOT the deployed bundle; freshness unverified)
- **flag files dirty:** M functions/index.js, M src/config/featureFlags.js, ?? functions/foundation.js
- **run:** 2026-07-14T10:24:47.498Z

**FINAL: CLEAN** target=baseline pass=27 fail=0 invalid=0 skip=2

| | ID | Scenario | Expected | Actual | Verdict |
|---|---|---|---|---|---|
| ✅ | DG-1:GRADE_TOKEN_ENFORCED | DG-1 | false | false | **PASS** |
| ✅ | DG-1:GRADE_TOKEN_MINT | DG-1 | true | true | **PASS** |
| ✅ | DG-1:GRADE_JOB_ENABLED | DG-1 | true | true | **PASS** |
| ✅ | DG-1:SERVER_ATTEMPT_WRITE | DG-1 | true | true | **PASS** |
| ✅ | DG-1:SERVER_CHALLENGE_WRITE | DG-1 | false | false | **PASS** |
| ✅ | DG-1:SERVER_REVIEW_MARKER | DG-1 | false | false | **PASS** |
| ✅ | DG-1:LIST_SCOPED_RECON | DG-1 | true | true | **PASS** |
| ✅ | DG-1:CONTINUATION_LINKS | DG-1 | false | false | **PASS** |
| ✅ | DG-1:SERVER_PROGRESS_WRITE | DG-1 | false | false | **PASS** |
| ✅ | DG-1:SERVER_RESET_PROGRESS | DG-1 | false | false | **PASS** |
| ✅ | DG-1:SERVER_COMPLETE_SESSION_ENABLED | DG-1 | false | false | **PASS** |
| ✅ | DG-1:SERVER_RESOLVE_LIST_PROGRESS_ENABLED | DG-1 | false | false | **PASS** |
| ✅ | DG-1:SERVER_RESET_PROGRESS_ENABLED | DG-1 | false | false | **PASS** |
| ✅ | DG-1:SERVER_ADVANCE_FOR_CHALLENGE_ENABLED | DG-1 | false | false | **PASS** |
| ✅ | DG-1:LIST_PROGRESS_CANONICAL | DG-1 | false | false | **PASS** |
| ✅ | DG-1:ANCHOR_VALIDATION_SHADOW | DG-1 | false | false | **PASS** |
| ✅ | DG-1:ANCHOR_VALIDATION_ENFORCE | DG-1 | false | false | **PASS** |
| ⏭️ | DG-2 | DG-2 | probe==expected | no-live-probe | **SKIP** |
| ⏭️ | DG-3 | DG-3 | stamp==hostingSha | no-live-probe | **SKIP** |
| ✅ | DG-4 | DG-4 | commits∧fixStr∧hygiene | commits=true fixStr=true hygiene=true | **PASS** |
| ✅ | DG-4b | DG-4 | fix>0 ∧ audit==0 | fixInDist=1 auditInDist=0 | **PASS** |
| ✅ | CUT-1 | CUT-1 | all sinks present∧guarded; 0 unguarded | sinks=challenge_class_progress_write:present=1,guarded=true; client_review_marker_create:present=1,guarded=true; client_reset_attempt_delete:present=1,guarded=true; unguardedDeletes=0 | **PASS** |
| ✅ | CUT-1b | CUT-1 | present (dormant) | assetsWithClassProgress=6 | **PASS** |
| ✅ | RET-1 | RET-1 | > 0 | 91 | **PASS** |
| ✅ | RET-2:dup_resume_branch | RET-2 | count==1 | 1 | **PASS** |
| ✅ | RET-2:neg_twi_passthrough | RET-2 | count==1 | 1 | **PASS** |
| ✅ | RET-2:client_automarker | RET-2 | count==1 | 1 | **PASS** |
| ✅ | RET-2:client_challenge_advance | RET-2 | count==1 | 1 | **PASS** |
| ✅ | RET-4 | RET-4 | 6 transitional present ∧ CONTINUATION_LINKS present | present=6 contLinks=true | **PASS** |

## Evidence
- **DG-1:GRADE_TOKEN_ENFORCED** (PASS): functions/index.js declares GRADE_TOKEN_ENFORCED=false. Source: FIX_PLAN P0 change 2 — G1 disarm → false (matches live prod F-9); shipped re-arms with nonce fix P4 F1-F3+F5
- **DG-1:GRADE_TOKEN_MINT** (PASS): functions/index.js declares GRADE_TOKEN_MINT=true. Source: FIX_PLAN P0 change 3 table — pre-existing, ON for validation (index.js:79)
- **DG-1:GRADE_JOB_ENABLED** (PASS): functions/index.js declares GRADE_JOB_ENABLED=true. Source: FIX_PLAN P0 change 3 / P3 — stays true (validated, not flipped)
- **DG-1:SERVER_ATTEMPT_WRITE** (PASS): src/config/featureFlags.js declares SERVER_ATTEMPT_WRITE=true. Source: FIX_PLAN P0 change 3 table (:10) — pre-existing live
- **DG-1:SERVER_CHALLENGE_WRITE** (PASS): src/config/featureFlags.js declares SERVER_CHALLENGE_WRITE=false. Source: FIX_PLAN P0 change 3 (:20) — NEW, dormant until P4 cutover
- **DG-1:SERVER_REVIEW_MARKER** (PASS): src/config/featureFlags.js declares SERVER_REVIEW_MARKER=false. Source: FIX_PLAN P0 change 3 (:28) — NEW, dormant until P4
- **DG-1:LIST_SCOPED_RECON** (PASS): src/config/featureFlags.js declares LIST_SCOPED_RECON=true. Source: FIX_PLAN P0 change 3 table (:41) — pre-existing live (F-9)
- **DG-1:CONTINUATION_LINKS** (PASS): src/config/featureFlags.js declares CONTINUATION_LINKS=false. Source: FIX_PLAN P8 CONT-A — dormant in baseline; feature-on at ship
- **DG-1:SERVER_PROGRESS_WRITE** (PASS): src/config/featureFlags.js declares SERVER_PROGRESS_WRITE=false. Source: FIX_PLAN P4 FND-2 — NEW routing flag (folds plan-name LIST_PROGRESS_PERSIST read-routing per the const doc); dormant
- **DG-1:SERVER_RESET_PROGRESS** (PASS): src/config/featureFlags.js declares SERVER_RESET_PROGRESS=false. Source: FIX_PLAN P4 FND-2 v2 HIGH-3 — NEW; dormant
- **DG-1:SERVER_COMPLETE_SESSION_ENABLED** (PASS): functions/foundation.js declares SERVER_COMPLETE_SESSION_ENABLED=false. Source: FIX_PLAN P3 — foundation flag, dormant at merge; P4 flips
- **DG-1:SERVER_RESOLVE_LIST_PROGRESS_ENABLED** (PASS): functions/foundation.js declares SERVER_RESOLVE_LIST_PROGRESS_ENABLED=false. Source: FIX_PLAN P3 — dormant; P4 flips
- **DG-1:SERVER_RESET_PROGRESS_ENABLED** (PASS): functions/foundation.js declares SERVER_RESET_PROGRESS_ENABLED=false. Source: FIX_PLAN P3 — dormant; P4 flips (before P6 owner-delete removal)
- **DG-1:SERVER_ADVANCE_FOR_CHALLENGE_ENABLED** (PASS): functions/foundation.js declares SERVER_ADVANCE_FOR_CHALLENGE_ENABLED=false. Source: FIX_PLAN P3 change 9 (F5-HIGH-2) — dormant; P4 flips
- **DG-1:LIST_PROGRESS_CANONICAL** (PASS): functions/foundation.js declares LIST_PROGRESS_CANONICAL=false. Source: FIX_PLAN P3 change 2 + P5 — the P5-ONLY mode switch; dormant until migration
- **DG-1:ANCHOR_VALIDATION_SHADOW** (PASS): functions/foundation.js declares ANCHOR_VALIDATION_SHADOW=false. Source: FIX_PLAN P3 change 6 (M4) — dormant at merge; P3 DEPLOY flips for the ≥14d soak
- **DG-1:ANCHOR_VALIDATION_ENFORCE** (PASS): functions/foundation.js declares ANCHOR_VALIDATION_ENFORCE=false. Source: FIX_PLAN P3/P6(d) — M4 enforce; P6 only
- **DG-2** (SKIP): needs Codex: deployed exports.version HTTPS probe (no live network in M-STATIC).
- **DG-3** (SKIP): needs Codex: deployed hosting build-stamp probe.
- **DG-4** (PASS): commits: src/services/studyService.js→1c91466 Fix #9: flag-ON cross-class review completion (studentService/db/progress) \| src/pages/DailySessionFlow.jsx→e3d97f7 feat(grading): attempt-write lockdown + server-authoritative typed grading (staged, flag-off) \| src/pages/Dashboard.jsx→6743b91 fix(dashboard): default-list prefers progress + honest unassign warning (F02/F03). fix-unique "Please Reload" ×1 in TypedTest.jsx (full: "Couldn't Grade — Please Reload"). audit/scripts imports from src: none.
- **DG-4b** (PASS): local dist/ built 2026-07-14T09:12:20.509Z (NOT the deployed bundle; freshness unverified). "Please Reload" in 1 dist asset(s); audit/scripts refs in 0.
- **CUT-1** (PASS): src/services/db.js — direct class_progress day-advance write, in the SERVER_CHALLENGE_WRITE flag-off fallback (db.js:2923). [present×1, guard 'if (SERVER_CHALLENGE_WRITE)'=true] \|\| src/pages/DailySessionFlow.jsx — client attempt-create automarker, in the SERVER_REVIEW_MARKER flag-off fallback (DailySessionFlow.jsx:1053). [present×1, guard 'if (SERVER_REVIEW_MARKER)'=true] \|\| src/services/db.js — client attempt batch-delete for reset, after the SERVER_RESET_PROGRESS early-return guard (db.js:2989) → flag-off fallback. [present×1, guard 'if (SERVER_RESET_PROGRESS)'=true] \|\| no unguarded attempt-delete
- **CUT-1b** (PASS): local dist/ built 2026-07-14T09:12:20.509Z (NOT the deployed bundle; freshness unverified). class_progress in 6 dist asset(s) — expected present in baseline (goes 0 only after P4 cutover + P7 retire).
- **RET-1** (PASS): class_progress refs: 91 (src=41 functions=13 scripts/cs=37). Nothing retired in baseline.
- **RET-2:dup_resume_branch** (PASS): src/pages/DailySessionFlow.jsx :: "existingState.phase === SESSION_PHASE.COMPLETE" ×1. UNREACHABLE duplicate resume branch (I-2 finding 4; FIX_PLAN P7 DailySessionFlow.jsx:800-816). LIVE branch keys on config.startPhase; the dead copy keys on the deliberately-not-consulted session_state.phase.
- **RET-2:neg_twi_passthrough** (PASS): src/services/studyService.js :: "LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount)" ×1. flag-OFF negative-TWI passthrough (I-2 finding 5; FIX_PLAN P7 studyService.js:1342). The flag-OFF else passes an unclamped newWordCount that can decrement TWI; retired when LIST_SCOPED_RECON is retired.
- **RET-2:client_automarker** (PASS): src/pages/DailySessionFlow.jsx :: "all segment words mastered (21-day rest)" ×1. client automarker leg (FIX_PLAN P7 DailySessionFlow.jsx:964-1008). The SERVER_REVIEW_MARKER=false else-branch client setDoc marker.
- **RET-2:client_challenge_advance** (PASS): src/services/db.js :: "end SERVER_CHALLENGE_WRITE else — direct class_progress day-advance" ×1. client reviewChallenge day-advance to class_progress (FIX_PLAN P7 db.js:2790-2833; routed server-side at P4 F5-HIGH-2).
- **RET-4** (PASS): declared transitional: LIST_SCOPED_RECON, SERVER_PROGRESS_WRITE, SERVER_RESET_PROGRESS, SERVER_CHALLENGE_WRITE, SERVER_REVIEW_MARKER, LIST_PROGRESS_CANONICAL. folded (plan-name, no separate decl): LIST_PROGRESS_PERSIST→SERVER_PROGRESS_WRITE (read-routing leg). CONTINUATION_LINKS declared=true.
