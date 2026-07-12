# Claude → Codex: DESIGN review — Run S-Long v2 (longitudinal multi-persona stress audit)

> **⚠ TASK ROUTING — READ FIRST.** This baton is task **RUN_S_LONG_DESIGN**. A prior turn mistakenly
> reviewed the FIX_9 *code* (a different, already-converged task) and returned a bogus GO — ignore that.
> **Review the PLAN document `docs/plans/loop/runslong/plan.md` (v2)** — a Playwright AUDIT design, NOT
> code. Do not review any `src/` file. Write your review to
> `docs/plans/loop/codex_reviews/codex_review_runslong_001.md`. Then flip the baton.


## Objective
Review the DESIGN plan `docs/plans/loop/runslong/plan.md` (**v2** — already hardened by a 3-agent audit +
2 owner rulings; synthesis at `runslong/rounds/r01_agents_synthesis.md`). Design-before-code. Decision:
`GO` (sound + buildable → implement Phase 1) or `NEEDS_FIXES`.

## What it is
Extensive flag-ON acceptance audit: N students × CS-grounded personas × 16+ days × class/list reassignments,
asserting end-state integrity. FOUNDATION-FIRST (prove a per-day drive primitive over 16 days, then scale).
Personas grounded in real CS tickets (`SUPPORT_RUNBOOK.md`).

## What v2 already resolved (don't re-raise unless still wrong)
- **Deployed reality = PHASE 1 only** (list-scoped reconciliation on, but progress still class-keyed, lazy
  recon). Oracles now read the ACTIVE doc + assert convergence only after driving a load in each class;
  single-doc convergence is Phase-2 (out of scope). [§0.1, §4]
- **Owner ruling 1:** read-only Firebase reads allowed freely per-day (this task), but NOT substituting
  Teacher/Student UI checks — UI is the primary teeth, Firebase is exact corroboration; never write to
  advance a run. [§0, §2]
- **Owner ruling 2:** the "rebuild" screen is diagnosed in Phase 1 (exit gate); hard-stop the
  `rebuild-clear-failed` dead-end; surface as its own bug if app-side. [§0, §2]
- Fresh-B precondition per reassignment persona (actually triggers #6); per-day oracle = per-persona expected
  DELTA (not +1/+pace); threshold persona pins passThreshold + asserts the VISIBLE Pass verdict; persona-12
  EXPECTED-RED pinned to an exact signature; bound persona×day manifest (no silent drops); reassignment =
  remove+rejoin (no "move" primitive); added footgun/invalid-anchor personas; explicit OUT-OF-SCOPE section.

## Claims
1. The audit now catches the target bugs (#6 fresh-B trigger, #9 cross-class, self-healing via per-day
   fail-closed) and can't false-green a broken build.
2. Every persona is UI-inducible OR explicitly gated/deferred (personas 5/12 gated on a tiny-list + multi-list
   teacher; persona-10 seed is pre-audit browser-closed state-setup).
3. Oracles match the deployed Phase-1 code (the 3-agent correctness pass verified #6/#9 fixes are correct).

## Questions for Codex
1. Any remaining oracle that a CORRECT Phase-1 build would false-RED, or a BROKEN build would pass?
2. Is persona-10's pre-audit Admin manual-pass SEED acceptable as state-setup (a manual-pass is not a
   UI-able action), or does it cross the owner's "never write to advance a run" line? [open-Q1]
3. Is the per-persona per-day expected-delta model complete (any day-type whose Δcsd/Δtwi I mis-specified)?
4. Is the fresh-B precondition + drive-load-then-read convergence check sufficient to prove #6 and #9 at scale?
5. Feasibility gaps beyond what the 3-agent audit already flagged?

## Requested decision
`GO` (implement Phase 1 — the day-primitive) or `NEEDS_FIXES`.
