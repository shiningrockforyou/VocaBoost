# RESUME — current active work

> **This is the canonical resume file.** When the user says "resume," read this first, then any
> linked spec. **Rotate at each save-state:** copy this file to `docs/resume_archive/RESUME_<date>.md`
> (copy, don't move), then overwrite the active-stream section below with the new state. History lives
> in `docs/resume_archive/` (see its README).

---

## ▶ ACTIVE STREAM (updated 2026-07-13, post-clear handoff): the **deepfix** program

**READ FIRST: `audit/deepfix/MASTER_TASK_PLAN.md`** — David's commissioned 7-task deep root-cause
audit → fix → Playwright-validate program. Then read `audit/deepfix/context/SESSION_CONTEXT_2026-07-13.md`
(the full state digest: structural flaws A/#11 + B/#12, the built-but-undeployed Phase-1 fix, the
built-but-never-run audit harness, environment truths, CS state, deploy posture).

**Current position (rotated 2026-07-13 at the Task-2 boundary): TASK 1 + TASK 2 COMPLETE (CONVERGED) → TASK 3
(implementation) IN PROGRESS.** Read `task2/FIX_PLAN.md` (v3, CONVERGED — the phased plan to implement) +
`reports/TASK2_REPORT.md` + `task2/adjudication_log.md` first; then `task1/ROOT_CAUSE_FINDINGS.md` +
`task1/investigations/inv_I6_foundation.md` (the migration keystone) + `inv_I5_deploy_gate.md` +
`inv_I2_reviewonly_matrix.md` (the S1-S10 day machine) for context.

**Task 2 outcome:** FIX_PLAN v3 CONVERGED via first Codex loop (r1 NEEDS_FIXES 1+4+2 → folded → r2 GO) + 3
independent verifiers (1 blocker + 7 high, ALL verified-true + folded → v3) + second Codex loop (r3 GO 0/0/0/0).
The plan = 11 phases: **P0 FND-0** (commit #11 [David] + disarm G1 in-tree) → **P1 RO** (hosting-only deploy of the
built #11/#9/#10/#4-UX — David deploys) → **P2 RS** (read-surfaces) → **P3-P7** the ONE migration (server surface →
client cutover → data migration [David-authorized CS event] → one rules cutoff → retire) → **P8 CONT-A** →
**P9 CYC** → **P10 OVR**. Every phase independently shippable/reversible, tied to the F-4 H/P/B metric.

**START/CONTINUE TASK 3 (§ MASTER_TASK_PLAN Task 3):** 3.1 orchestrator implements the plan phase-by-phase
LOCAL-ONLY/uncommitted/no-deploy/no-live-writes (deploys P1/P3/P6 + the P5 live migration + CS-toolchain live
writes are David/owner actions), logging each phase to `change_action_log.md` + a `task3/phaseN_diff.patch`.
Then 3.2 three fable verifiers on the diff → 3.3 Codex → 3.4 adjudicate-all + fix + Codex loop to GO → 3.5 final
3-fable sweep → 3.6 report. **Task-3 carryforwards:** (1) resolver read-only↔write mode = explicit server flag +
tests proving P4 can't write canonical; (2) "same student/list lineage" concrete in the migration script.
**Impl order:** P0 (G1 disarm — the safe first step) → P2 RS (small, low-risk) → then the P3-P7 foundation.
David pre-authorized autonomous implementation (H2 met: Codex GO + 3-agent verify). Prior fork-agent plan
verification: `audit/deepfix/PLAN_VERIFICATION_2026-07-13.md`.

**Hard rules live in the plan §H — the binding one to internalize immediately (memory
`verify-all-claims`): VERIFY EVERY agent + Codex claim against code/data before acting. Never trust
blindly.**

Quick state facts (details + evidence in SESSION_CONTEXT + Task 1 findings):
- Phase-1 #11 fix (+ #9/#10/#27): fixed-in-tree, uncommitted on `main`, NOT deployed. **NEW (I-5): all
  client-bundle-only → deployable via `firebase deploy --only hosting` WITHOUT re-arming G1.** David's deploy
  call stands (X2); deploy is Task 2's FND-0/RO decision, owner-executed.
- Review-only audit harness: built, NEVER executed (Task 5/6). WSL can't run Vite/Playwright (Codex/David runs).
- Baton (`docs/plans/loop/baton.json`): IDLE (turnOwner=claude, last taskId DEEPFIX_TASK1_ISSUES done) — safe to
  open the Task-2 taskId.
- **No CS tickets during the program (David); all live-Firebase work is READ-ONLY; surface fixes as proposals.**
- **No background agents/watchers running at Task-1 close** (all Task-1 agents completed).

Prior streams archived: `docs/resume_archive/RESUME_2026-07-13.md` (review-only fix cycle / CS surge, digested into
SESSION_CONTEXT) + `docs/resume_archive/RESUME_2026-07-13_deepfix-task1.md` (this Task-1 state, pre-rotation).

**David's authorizations (2026-07-13, standing for this program):** (1) Task 3 implementation — PROCEED
AUTONOMOUSLY once the Task-2 plan converges (Codex GO + 3-agent verify); local/uncommitted/no-deploy; log each
phase; show result after. (2) Live Firebase — READ-ONLY ONLY; **no CS tickets will arrive during the program**;
surface any fix (config drift, strands) as a SUPPORT_RUNBOOK proposal, NEVER execute a live write. (3) Git —
everything stays LOCAL/UNCOMMITTED, **no branches whatsoever**; owner commits/pushes if they choose.

**Standing constraints:** owner deploys (Claude can't build/deploy); never commit/push without say-so
(NEVER commit `audit/deepfix/context/transcripts/`); code→`change_action_log.md`, CS/data→`SUPPORT_RUNBOOK.md`;
sandbox only for audits (`lsr_*`/25WT) — NEVER 26SM; WSL cannot run Vite/Playwright (9p Windows mount) but
Admin CS scripts DO run (`NODE_PATH=/app/node_modules node scripts/cs/…`).
