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

**Current position (rotated 2026-07-13 at the Task-1 boundary): TASK 1 COMPLETE → START TASK 2 (plan the fixes).**
Read `task1/ROOT_CAUSE_FINDINGS.md` (the 1.6 deliverable — 7 roots CR-1…CR-7 with live blast radius + convergence)
+ `reports/TASK1_REPORT.md` first; then `task1/CONSOLIDATED_ISSUES.md`, `task1/investigations/inv_I6_foundation.md`
(the KEYSTONE — the one migration + phase order Task 2 sequences off), `inv_I5_deploy_gate.md`, and
`task1/INVESTIGATION_STATUS.md` (what's done/deferred). David's TWO directives are honored + memory'd
(`[[ground-plans-in-empirical-data]]`): every finding is linked to live-Firebase evidence; planning agents get the
exported data.

**Task 1 findings (headline):** H=541 / P=45 (24 re-stuck) / B=188 of 774 started; **data NOT corrupt** — failures
are structural/behavioral/deploy-state. **#9/#10/#11/C-27 all fixed-in-tree-but-undeployed, and DEPLOYABLE
HOSTING-ONLY without re-arming G1** (I-5). ~42 live cross-class carry-strands (#6/#12); #12 mechanism UNPINNED
(needs an instrumented repro — env-blocked, WSL can't run Vite/Playwright). #13 sized at 18. 3 permanent-fail
(all known cases). G1 `GRADE_TOKEN_ENFORCED=true` in HEAD vs prod `false` — **functions-deploy landmine**
confirmed. The keystone: ONE migration (student-owned progress + server-authoritative twi, I-6) dissolves
CR-1/#6/#9/#12, unblocks cycling, secures the override.

**START TASK 2 (§ MASTER_TASK_PLAN Task 2):** 2.1 fable agent drafts `task2/FIX_PLAN.md` from ROOT_CAUSE_FINDINGS +
CONSOLIDATED_ISSUES + inv_I6/I5, in the I-6 phase order (FND-0 deploy-gate → deploy #11 hosting-only → foundation
callables → client cutover → migration → one rules cutoff → cycling → override), gated by I-5's deploy checklist +
the F-4 H/P/B before/after metric. Then 2.2 Codex baton loop → 2.3 adjudicate → 2.4 three fable verifiers → 2.5
fold → 2.6 Codex loop to GO → 2.7 report. **David pre-authorized autonomous Task 3 implementation once the Task-2
plan converges (Codex GO + 3-agent).** The prior fork-agent plan verification is at
`audit/deepfix/PLAN_VERIFICATION_2026-07-13.md`.

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
