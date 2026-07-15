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

**Current position (interim, updated 2026-07-13 mid-session — NOT a formal rotation): Task 1, step 1.6 IN
PROGRESS.** Steps 1.1–1.5 DONE: three independent issue lists (`task1/issues_{claude,fable1,codex}.md`) →
consolidation (`task1/CONSOLIDATED_ISSUES.md`, 38 issues / 7 roots CR-1…CR-7) + `task1/INVESTIGATION_PLAN.md`
(F-1…F-14 empirical scans + I-1…I-10 code investigations + waves + 6 Task-2 gates); **H1 gate PASSED**
(`task1/H1_GATE_1.5.md`). David added TWO directives (both honored + memory'd `[[ground-plans-in-empirical-data]]`):
(1) extensive live-Firebase empirical investigation linking findings to data + auditing CS manual writes; (2)
planning agents get the empirical data too. Empirical backbone built (READ-ONLY): `scripts/cs/deepfix-census.mjs`
+ `deepfix-f1-syslog-attribution.mjs` → `task1/firebase/` (CENSUS_SUMMARY.md, census_rows.json, cs_manual_writes_catalog.md,
scan_F1_FINDINGS.md). **Key live facts:** 183 at #11 wall, 98 dual-enroll-same-list (many divergent), 82
hand-patched (25 re-stuck), data NOT corrupt, #9/#10/#11/C-27 all fixed-in-tree-but-undeployed, day_guard fires
for 6 real 26SM students (prod is behind HEAD), G1 `GRADE_TOKEN_ENFORCED=true` deploy landmine confirmed.
**NEXT (1.6 remaining):** run F-2/F-3/F-4/F-5/F-6/F-9 etc. (orchestrator, read-only) + launch I-2/I-8/I-10 code
agents (per INVESTIGATION_PLAN §5 waves), then `task1/ROOT_CAUSE_FINDINGS.md` + 1.7 TASK1_REPORT + rotate RESUME.
The prior fork-agent plan verification is at `audit/deepfix/PLAN_VERIFICATION_2026-07-13.md`.

**Hard rules live in the plan §H — the binding one to internalize immediately (memory
`verify-all-claims`): VERIFY EVERY agent + Codex claim against code/data before acting. Never trust
blindly.**

Quick state facts (details + evidence in SESSION_CONTEXT):
- Phase-1 #11 fix: 3 files uncommitted on `main` (diff in `audit/deepfix/context/`), Codex GO, NOT deployed.
  **Deploy posture (David verbatim): "we'll just fix as requests come in" — deliberately deferred.**
- Review-only audit harness: built, syntax-clean, NEVER executed. Codex prep verdict **NOT_READY**
  (Firestore egress from Codex env unproven — Task 6.0 gate).
- Baton (`docs/plans/loop/baton.json`): IDLE (turnOwner=claude) — safe to open a new taskId.
- Live CS will keep arriving (plan §H11 has the interrupt protocol + `scripts/cs/*` patterns; 63 list-end
  finishers still to advance: `audit/deepfix/context/next-list-by-class_2026-07-13.md`).
- No background agents or watchers were left running at session close.

Prior stream (review-only fix cycle, CS surge, chat-log triage) is archived at
`docs/resume_archive/RESUME_2026-07-13.md` and digested into SESSION_CONTEXT.

**David's authorizations (2026-07-13, standing for this program):** (1) Task 3 implementation — PROCEED
AUTONOMOUSLY once the Task-2 plan converges (Codex GO + 3-agent verify); local/uncommitted/no-deploy; log each
phase; show result after. (2) Live Firebase — READ-ONLY ONLY; **no CS tickets will arrive during the program**;
surface any fix (config drift, strands) as a SUPPORT_RUNBOOK proposal, NEVER execute a live write. (3) Git —
everything stays LOCAL/UNCOMMITTED, **no branches whatsoever**; owner commits/pushes if they choose.

**Standing constraints:** owner deploys (Claude can't build/deploy); never commit/push without say-so
(NEVER commit `audit/deepfix/context/transcripts/`); code→`change_action_log.md`, CS/data→`SUPPORT_RUNBOOK.md`;
sandbox only for audits (`lsr_*`/25WT) — NEVER 26SM; WSL cannot run Vite/Playwright (9p Windows mount) but
Admin CS scripts DO run (`NODE_PATH=/app/node_modules node scripts/cs/…`).
