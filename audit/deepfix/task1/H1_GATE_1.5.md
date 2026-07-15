# Task 1.5 — H1 verification gate (orchestrator sign-off)

**Mandate (plan §1.5 + David H1):** verify every consolidated issue + every investigation-plan premise against
code/data before Task 1.6/2 act on it; correct in-place; reject/demote speculation. This records the gate.

**Method:** the load-bearing anchors were traced in `verification_ledger.md` (during 1.1–1.4). This gate closes
the remaining `plausible-unverified` / `[V-prior]` items (INVESTIGATION_PLAN §4 WS-V list 1–8). **Result: all
re-traced anchors CONFIRMED against the current working tree — nothing failed re-trace.** Several were found MORE
fixed than the docs claimed (working tree ahead of NEED_TO_FIX). No consolidated issue was built on a stale cite.

## WS-V re-traces (all confirmed today, [V-now])
| WS-V | Claim | Result |
|---|---|---|
| 1 · C-28 #1b | rules owner-write has no role whitelist | ✓ `firestore.rules:34-37` — `hasOnly(['challenges'])` gates ONLY the teacher branch; `isOwner(userId)` writes any field incl. `role`. **#1b confirmed.** Bonus: `:39-44` TODO — teacher subcollection writes are OVERLY BROAD (any teacher writes any student's data regardless of class). |
| 2 · C-32 G1 nonce | docId divergence unpatched | ✓ `testRecovery.js:98-110` — nonce localStorage-persisted; catch-fallback returns a FRESH per-call in-memory nonce ("just non-idempotent") that does NOT survive the grade→save gap → grade-docId ≠ save-docId exactly as CS-06-29. **Root cause unpatched; HEAD `ENFORCED=true` re-arms the outage.** |
| 3 · C-17 grader | "restating" prompt rule | Deferred to I-4 (data-gated; prompt exists in `functions/index.js` grading path). Not a gate blocker. |
| 4 · C-26 #3 | listId-gated backfill | ✓ `functions/index.js:717` `if (!listId) return {answers, allResolved:false}`; `:1116` "Unresolvable grading payload". Confirmed. |
| 5 · C-27 #4-UX | modal branches by errCode | ✓ **LARGELY FIXED IN-TREE** — `:105` `gradingErrorKind`, `:596` branch on `invalid-argument`/`failed-precondition`, `:1755` de-alarmed titles ("Grading Didn't Go Through" / "Couldn't Grade — Please Reload"), reload guidance for deterministic. **Status change → fixed-in-tree-verify-deployed.** |
| 6 · C-25 | newWordsTestPassed score-derived | ✓ `studyService.js:1376/1453` (traced 1.4). **Upgrade plausible→verified-evidence.** |
| 7 · C-11 | legacy dead-end throw | ✓ `MCQTest.jsx:323` `throw new Error('No new words available for testing')`; DailySessionFlow.jsx is at `src/pages/` (fable B2's `src/components/` path was wrong — corrected). |
| 8 · adopted line-cites | result-card recompute / retake regen / day-stamp / unassign warn | ✓ result-card `TypedTest.jsx:1306` + `MCQTest.jsx:1042` `passed = score >= retakeThreshold` (**C-23 recompute upgrade plausible→verified**); retake-regen `TypedTest.jsx:1123` `selectTestWords(originalWords, configuredTestSize)`; unassign warn-only `ClassDetail.jsx:390-401`. |

## Corrections folded into CONSOLIDATED_ISSUES (single source of truth)
1. **C-27 → fixed-in-tree-verify-deployed** (was open-defect). The errCode-branched, de-alarmed modal is present in HEAD. Adds to the #9/#10/#11/C-27 "prod-behaves-as-HEAD?" deploy-state question (F-9).
2. **C-25 → verified-evidence** (was plausible-unverified). Traced `studyService.js:1376/1453`.
3. **C-23 result-card recompute → verified-evidence** (default+compare already verified; the recompute-in-result-card leg now confirmed).
4. **C-19 refinement — CORRECTED by I-10 (inv_I10_permission_gap.md):** my initial "UI/query-scoped, NOT rules-scoped" was WRONG. I-10 traced it: attempts are stamped `teacherId = launching class's ownerTeacherId` at write (`db.js:1194-1204`, `functions/index.js:348`) and NEVER re-stamped on promotion — the gap is THREE stacked `teacherId==uid` predicates: gradebook query (`db.js:1926`), the `reviewChallenge` throw "Unauthorized: You are not the teacher for this attempt" (`db.js:2666` = the literal "단어 권한이 없습니다"), AND the **attempts RULES** (`firestore.rules:102-118`). So a fix must change query + rules TOGETHER. Only `users/{uid}` subcollections (rules:45-48) are permissive (the separate over-broad-teacher finding, relevant to C-16). The old teacher also goes roster-blind (`db.js:1892-1896`) → the pending challenge is ORPHANED, not just misrouted.

## Gate verdict
**PASS.** The consolidated issue set is H1-clean: every issue is either `verified-evidence` (traced to
code/data), or explicitly tagged `plausible-unverified`/`speculative` with a named investigation (I-x/F-x) that
will pin it — no speculation is treated as a finding. Items whose ROOT is honestly UNPINNED are flagged as such
and gated behind an investigation before any fix plan may claim them: **C-02 (#12 mechanism → I-1 repro),
C-22 (#13 generation path → F-2+I-3), C-17 (grader calibration → F-7+I-4), C-19 (permission predicate → I-10).**
The two deploy-state contradictions (`impossible_phase_detected` 3088 / `day_guard` 17, unattributed) are the
top empirical TODO (F-1) and MUST resolve before any deploy-sequencing conclusion (Task-2 Gate #1).

Ready for 1.6 (execute the investigation: WS-F orchestrator scans + WS-C agent investigations, per plan §5 waves).
