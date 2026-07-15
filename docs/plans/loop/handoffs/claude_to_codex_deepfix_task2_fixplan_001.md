# Claude → Codex: DEEPFIX Task 2.2 — surgical review of FIX_PLAN v1

> **TASK = DEEPFIX_TASK2_FIXPLAN, round 1.** Review the converged phased fix plan
> `/repo/audit/deepfix/task2/FIX_PLAN.md` (my-side `audit/deepfix/task2/FIX_PLAN.md`) against the ACTUAL working
> tree. This is the deepfix fix plan (Task 1's roots → the phased convergence). Write your review to
> `/out/reviews/codex_deepfix_task2_fixplan_001.md`
> (my-side `docs/plans/loop/codex_reviews/codex_deepfix_task2_fixplan_001.md`), end with the VERDICT line, flip
> turnOwner→claude.

## BINDING RULE (David, verbatim): "always verify all claims by all agents and Codex results. Never trust blindly. Always verify."
Trace every plan claim you assess to a real `file:line` under `/repo` — do NOT take the plan's `[V-P]` tags on
faith; spot-check them and REPORT any that are stale/wrong. The working tree has an UNCOMMITTED #11 fix
(studyService.js/DailySessionFlow.jsx/Dashboard.jsx) and committed #9 (`1c91466`)/#10 (`14e49a4`) — cite current
reality.

## Context you need (read first)
- `/repo/audit/deepfix/task1/ROOT_CAUSE_FINDINGS.md` — the 7 roots + live blast radius the plan must dissolve.
- `/repo/audit/deepfix/task1/investigations/inv_I6_foundation.md` (the migration keystone the plan uses as
  backbone) + `inv_I5_deploy_gate.md` (the G1 deploy gate) + `inv_I2_reviewonly_matrix.md` (the S1-S10 day machine).
- The plan itself re-verified ~60 citations (§8.2 corrections, §8.3 has 7 self-flagged uncertainties — scrutinize those).

## Judge these (surgical — this is a plan review, not a re-derivation):
1. **Phase soundness + ordering + hard gates.** Is the dependency graph (§0.3) correct and safe? In particular:
   (a) the **CONT-A / CYC split** (§2.1) — is CONT-A genuinely safe BEFORE the foundation (no cap removal, no twi
   writer, only teacher-config + terminal UX + the existing create-on-miss path on a DIFFERENT listId)? Try to
   falsify it (§2.1 states the falsifier). (b) **X1 "by construction"** (§3.2) — does M5-inside-`completeSession`
   really make server-`reviewOnlyDay` precede the P6 class_progress lockdown via the P3→P4→P6 dependency, or is
   there a path that locks down before the server derivation is live?
2. **The migration screen amendment (P5 / §3.4, the "single most dangerous interaction").** Is it TRUE that from
   P1 (RO) onward, 183+ students accrue legitimate anchor-less csd growth that a Phase-0-parameterized [C4-2] CSD
   plausibility screen would quarantine/demote? Is "count `reviewOnlyDay` markers + post-anchor review attempts as
   evidence" a sufficient and correct amendment? Any OTHER migration-day invariant at risk?
3. **Invariant preservation (§5 matrix + per-phase "Non-regression").** twi monotonic / csd non-demoting / anchor
   `twi=nwei+1` — is each phase's named enforcement point real and sufficient? Especially the P6 rules cutoff
   removing owner attempt-delete (superseding the W3 doc) being legal ONLY because P3's `resetProgress` ships.
4. **Deploy-state claims (P0/P1/§3.1).** Verify: #11 uncommitted; #9/#10 committed; prod `GRADE_TOKEN_ENFORCED=false`
   (F-9); `firebase deploy --only hosting` cannot touch functions flags (so RO is safe); the nonce root cause
   (`testRecovery.js:98-111` fresh per-call in catch + double derivation `TypedTest.jsx:767`/`:869-870`).
5. **Missed root causes / unsafe sequencing / tech-debt the plan re-introduces.** Anything the plan defers that is
   actually a blocker; any phase that isn't truly independently shippable/reversible as claimed.

## Requested
Per-finding: `severity(blocker|high|medium|nit) · location(plan §/phase + the code file:line) · problem · evidence(file:line) · fix`.
End with `VERDICT blockers=<n> high=<n> med=<n> nits=<n>` (+ `CONVERGED-OK` if blockers=0 high=0). GO = the plan is
sound to hand to the 3 independent verifiers + implement; NEEDS_FIXES = name the defects. Then flip turnOwner→claude.
