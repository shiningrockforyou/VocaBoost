# M-STATIC — deepfix static certifier

- **runId:** `a967f54-shipped`  **target:** `shipped`
- **git:** `a967f54` (HEAD `a967f544e0f3d4bce72861ad82a34d8e2ec27206`) dirty=true (266 paths)
- **dist:** local dist/ built 2026-07-13T22:25:35.122Z (NOT the deployed bundle; freshness unverified)
- **flag files dirty:** M functions/index.js, M src/config/featureFlags.js, ?? functions/foundation.js
- **run:** 2026-07-13T22:46:12.192Z

**FINAL: NOT_CLEAN** target=shipped pass=6 fail=21 invalid=0 skip=2

| | ID | Scenario | Expected | Actual | Verdict |
|---|---|---|---|---|---|
| ❌ | DG-1:GRADE_TOKEN_ENFORCED | DG-1 | true | false | **FAIL** |
| ✅ | DG-1:GRADE_TOKEN_MINT | DG-1 | true | true | **PASS** |
| ✅ | DG-1:GRADE_JOB_ENABLED | DG-1 | true | true | **PASS** |
| ✅ | DG-1:SERVER_ATTEMPT_WRITE | DG-1 | true | true | **PASS** |
| ❌ | DG-1:SERVER_CHALLENGE_WRITE | DG-1 | true | false | **FAIL** |
| ❌ | DG-1:SERVER_REVIEW_MARKER | DG-1 | true | false | **FAIL** |
| ✅ | DG-1:LIST_SCOPED_RECON | DG-1 | true | true | **PASS** |
| ❌ | DG-1:CONTINUATION_LINKS | DG-1 | true | false | **FAIL** |
| ❌ | DG-1:SERVER_PROGRESS_WRITE | DG-1 | true | false | **FAIL** |
| ❌ | DG-1:SERVER_RESET_PROGRESS | DG-1 | true | false | **FAIL** |
| ❌ | DG-1:SERVER_COMPLETE_SESSION_ENABLED | DG-1 | true | false | **FAIL** |
| ❌ | DG-1:SERVER_RESOLVE_LIST_PROGRESS_ENABLED | DG-1 | true | false | **FAIL** |
| ❌ | DG-1:SERVER_RESET_PROGRESS_ENABLED | DG-1 | true | false | **FAIL** |
| ❌ | DG-1:SERVER_ADVANCE_FOR_CHALLENGE_ENABLED | DG-1 | true | false | **FAIL** |
| ❌ | DG-1:LIST_PROGRESS_CANONICAL | DG-1 | true | false | **FAIL** |
| ❌ | DG-1:ANCHOR_VALIDATION_SHADOW | DG-1 | true | false | **FAIL** |
| ❌ | DG-1:ANCHOR_VALIDATION_ENFORCE | DG-1 | true | false | **FAIL** |
| ⏭️ | DG-2 | DG-2 | probe==expected | no-live-probe | **SKIP** |
| ⏭️ | DG-3 | DG-3 | stamp==hostingSha | no-live-probe | **SKIP** |
| ✅ | DG-4 | DG-4 | commits∧fixStr∧hygiene | commits=true fixStr=true hygiene=true | **PASS** |
| ✅ | DG-4b | DG-4 | fix>0 ∧ audit==0 | fixInDist=1 auditInDist=0 | **PASS** |
| ❌ | CUT-1 | CUT-1 | 0 sinks | totalPresentSinks=4 | **FAIL** |
| ❌ | CUT-1b | CUT-1 | 0 | assetsWithClassProgress=6 | **FAIL** |
| ❌ | RET-1 | RET-1 | 0 | 75 | **FAIL** |
| ❌ | RET-2:dup_resume_branch | RET-2 | 0 | 1 | **FAIL** |
| ❌ | RET-2:neg_twi_passthrough | RET-2 | 0 | 1 | **FAIL** |
| ❌ | RET-2:client_automarker | RET-2 | 0 | 1 | **FAIL** |
| ❌ | RET-2:client_challenge_advance | RET-2 | 0 | 1 | **FAIL** |
| ❌ | RET-4 | RET-4 | 0 transitional ∧ CONTINUATION_LINKS present | present=6 contLinks=true | **FAIL** |

## Evidence
- **DG-1:GRADE_TOKEN_ENFORCED** (FAIL): functions/index.js declares GRADE_TOKEN_ENFORCED=false. Source: FIX_PLAN P0 change 2 — G1 disarm → false (matches live prod F-9); shipped re-arms with nonce fix P4 F1-F3+F5
- **DG-1:GRADE_TOKEN_MINT** (PASS): functions/index.js declares GRADE_TOKEN_MINT=true. Source: FIX_PLAN P0 change 3 table — pre-existing, ON for validation (index.js:79)
- **DG-1:GRADE_JOB_ENABLED** (PASS): functions/index.js declares GRADE_JOB_ENABLED=true. Source: FIX_PLAN P0 change 3 / P3 — stays true (validated, not flipped)
- **DG-1:SERVER_ATTEMPT_WRITE** (PASS): src/config/featureFlags.js declares SERVER_ATTEMPT_WRITE=true. Source: FIX_PLAN P0 change 3 table (:10) — pre-existing live
- **DG-1:SERVER_CHALLENGE_WRITE** (FAIL): src/config/featureFlags.js declares SERVER_CHALLENGE_WRITE=false. Source: FIX_PLAN P0 change 3 (:20) — NEW, dormant until P4 cutover
- **DG-1:SERVER_REVIEW_MARKER** (FAIL): src/config/featureFlags.js declares SERVER_REVIEW_MARKER=false. Source: FIX_PLAN P0 change 3 (:28) — NEW, dormant until P4
- **DG-1:LIST_SCOPED_RECON** (PASS): src/config/featureFlags.js declares LIST_SCOPED_RECON=true. Source: FIX_PLAN P0 change 3 table (:41) — pre-existing live (F-9)
- **DG-1:CONTINUATION_LINKS** (FAIL): src/config/featureFlags.js declares CONTINUATION_LINKS=false. Source: FIX_PLAN P8 CONT-A — dormant in baseline; feature-on at ship
- **DG-1:SERVER_PROGRESS_WRITE** (FAIL): src/config/featureFlags.js declares SERVER_PROGRESS_WRITE=false. Source: FIX_PLAN P4 FND-2 — NEW routing flag (folds plan-name LIST_PROGRESS_PERSIST read-routing per the const doc); dormant
- **DG-1:SERVER_RESET_PROGRESS** (FAIL): src/config/featureFlags.js declares SERVER_RESET_PROGRESS=false. Source: FIX_PLAN P4 FND-2 v2 HIGH-3 — NEW; dormant
- **DG-1:SERVER_COMPLETE_SESSION_ENABLED** (FAIL): functions/foundation.js declares SERVER_COMPLETE_SESSION_ENABLED=false. Source: FIX_PLAN P3 — foundation flag, dormant at merge; P4 flips
- **DG-1:SERVER_RESOLVE_LIST_PROGRESS_ENABLED** (FAIL): functions/foundation.js declares SERVER_RESOLVE_LIST_PROGRESS_ENABLED=false. Source: FIX_PLAN P3 — dormant; P4 flips
- **DG-1:SERVER_RESET_PROGRESS_ENABLED** (FAIL): functions/foundation.js declares SERVER_RESET_PROGRESS_ENABLED=false. Source: FIX_PLAN P3 — dormant; P4 flips (before P6 owner-delete removal)
- **DG-1:SERVER_ADVANCE_FOR_CHALLENGE_ENABLED** (FAIL): functions/foundation.js declares SERVER_ADVANCE_FOR_CHALLENGE_ENABLED=false. Source: FIX_PLAN P3 change 9 (F5-HIGH-2) — dormant; P4 flips
- **DG-1:LIST_PROGRESS_CANONICAL** (FAIL): functions/foundation.js declares LIST_PROGRESS_CANONICAL=false. Source: FIX_PLAN P3 change 2 + P5 — the P5-ONLY mode switch; dormant until migration
- **DG-1:ANCHOR_VALIDATION_SHADOW** (FAIL): functions/foundation.js declares ANCHOR_VALIDATION_SHADOW=false. Source: FIX_PLAN P3 change 6 (M4) — dormant at merge; P3 DEPLOY flips for the ≥14d soak
- **DG-1:ANCHOR_VALIDATION_ENFORCE** (FAIL): functions/foundation.js declares ANCHOR_VALIDATION_ENFORCE=false. Source: FIX_PLAN P3/P6(d) — M4 enforce; P6 only
- **DG-2** (SKIP): needs Codex: deployed exports.version HTTPS probe (no live network in M-STATIC).
- **DG-3** (SKIP): needs Codex: deployed hosting build-stamp probe.
- **DG-4** (PASS): commits present=true; fixStr=true; hygiene badImports=0.
- **DG-4b** (PASS): local dist/ built 2026-07-13T22:25:35.122Z (NOT the deployed bundle; freshness unverified). "Please Reload" in 1 dist asset(s); audit/scripts refs in 0.
- **CUT-1** (FAIL): challenge_class_progress_write present×1; client_review_marker_create present×1; client_reset_attempt_delete present×1; attemptDeleteFiles=1
- **CUT-1b** (FAIL): local dist/ built 2026-07-13T22:25:35.122Z (NOT the deployed bundle; freshness unverified). class_progress in 6 dist asset(s).
- **RET-1** (FAIL): class_progress refs: 75 (src=41 functions=13 scripts/cs=21).
- **RET-2:dup_resume_branch** (FAIL): src/pages/DailySessionFlow.jsx :: "existingState.phase === SESSION_PHASE.COMPLETE" ×1. UNREACHABLE duplicate resume branch (I-2 finding 4; FIX_PLAN P7 DailySessionFlow.jsx:800-816). LIVE branch keys on config.startPhase; the dead copy keys on the deliberately-not-consulted session_state.phase.
- **RET-2:neg_twi_passthrough** (FAIL): src/services/studyService.js :: "LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount)" ×1. flag-OFF negative-TWI passthrough (I-2 finding 5; FIX_PLAN P7 studyService.js:1342). The flag-OFF else passes an unclamped newWordCount that can decrement TWI; retired when LIST_SCOPED_RECON is retired.
- **RET-2:client_automarker** (FAIL): src/pages/DailySessionFlow.jsx :: "all segment words mastered (21-day rest)" ×1. client automarker leg (FIX_PLAN P7 DailySessionFlow.jsx:964-1008). The SERVER_REVIEW_MARKER=false else-branch client setDoc marker.
- **RET-2:client_challenge_advance** (FAIL): src/services/db.js :: "end SERVER_CHALLENGE_WRITE else — direct class_progress day-advance" ×1. client reviewChallenge day-advance to class_progress (FIX_PLAN P7 db.js:2790-2833; routed server-side at P4 F5-HIGH-2).
- **RET-4** (FAIL): still-declared transitional (should be 0): LIST_SCOPED_RECON, SERVER_PROGRESS_WRITE, SERVER_RESET_PROGRESS, SERVER_CHALLENGE_WRITE, SERVER_REVIEW_MARKER, LIST_PROGRESS_CANONICAL. CONTINUATION_LINKS declared=true.
