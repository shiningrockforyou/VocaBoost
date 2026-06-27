---
name: plan-audit
description: Adversarially audit a plan/design doc with 3 independent reviewers (distinct lenses) + optional Codex, then synthesize corrections back into the doc
argument-hint: <path-to-plan.md> [extra context]
---

Run our standard **3-agent plan audit** on the plan document at `$ARGUMENTS` (first token = path;
remainder = optional extra context). This is a *review*, not an implementation step — the goal is to
find what's wrong, missing, or risky in the PLAN before any code is written.

## How to run it

1. **Read the plan** yourself first so you can judge the reviewers' claims (don't just relay them).

2. **Spawn 3 reviewers in parallel** (one message, 3 `Agent` calls, subagent_type `Explore` — read-only).
   Give each the plan path, the relevant code areas, and ONE lens. Each must return findings as a list of
   `{severity: blocker|high|medium|nit, location, problem, evidence (file:line), fix}` and explicitly call
   out anything in the plan that is **factually wrong about the current code**. The three lenses:
   - **Lens A — Correctness & data integrity.** Does the design actually produce the intended state
     change? Trace it against the real code paths. Off-by-ones, denominators, idempotency, reconciliation/
     migration divergence, ordering, partial-failure, what it claims the code does vs. what it does.
   - **Lens B — Security & authorization.** AuthN/AuthZ gaps, privilege boundaries, forgeable inputs,
     rules changes, multi-tenant/ownership leakage, audit/logging, blast radius of a bug.
   - **Lens C — UX, product & edge cases.** Does it solve the user's real problem? Confusing/foot-gun
     flows, missing states, interaction with existing features, accessibility, what a confused user does,
     unhandled edge cases, scope creep / under-scope.

3. **Synthesize.** Read all three reports, dedupe, and resolve contradictions against the actual code
   (verify any disputed file:line claim yourself before accepting it). Produce a single prioritized list:
   Blockers → High → Medium → Nits, each with a concrete plan edit.

4. **Fold corrections into the plan doc** (edit it in place; note what changed). Leave genuine open
   decisions as decisions for the user, don't silently pick.

5. **Codex (external 4th pass).** Our norm pairs the 3 agents with a Codex review. If a `codex` CLI is
   available, offer to run it on the plan/diff; otherwise note it as the user's external pass. Don't block
   on it.

6. **Present** a tight summary: what the audit changed, what's now locked, and the open decisions that
   need the user — then stop for their call before implementing.

## Notes
- Reviewers are read-only and independent — do not let them see each other's output; divergence is signal.
- Scale to the plan: a small plan = 3 focused agents; a large/risky one = add a 4th "completeness critic"
  asking *what's missing*.
- This command audits PLANS. For live-UI acceptance audits use `/apboost-audit`.
