# Plan-review loop — workflow queue & sequence

The Claude⇄Codex review loop (see `README.md`) is a **reusable workflow**. This file tracks what's
queued through it and the standing sequence, so it's re-runnable and nothing is lost across sessions.

## Standing per-round contract (David's rules — enforced in `lib/CLAUDE_ROUND_SOP.md`)
Every plan version `vN` gets **two concurrent independent reviews before it's revised**:
1. **Codex** (Docker, `/repo:ro`) reviews `vN`.
2. **Claude's 3-agent audit** (Explore A=correctness / B=security-blast-radius / C=UX-edge) reviews `vN`
   IN PARALLEL — launched at hand-off (and on the very first draft), not after Codex returns.
Then Claude **verifies EVERYTHING against the real code** — both Codex's findings AND the 3 agents'
(rejecting the wrong ones from either source with `file:line` evidence) — edits `vN → v(N+1)`, and hands
back. **Termination:** converge on 2 consecutive rounds where Codex(0 blocker/high) + agents(0
blocker/high) + plan unchanged; hard backstops = maxRounds(8) / deadlock(same finding re-raised & rejected
2×) / drift(3 rounds no decrease). Nits & medium never block (not too strict); the caps guarantee it can
never run forever.

## Queue
1. **[RUNNING] Extend-list cycling** — slug `x`, `x/plan.md`. First real loop. Round 1 in progress
   (Codex + 3-agent audit both on v1). Basis: `docs/design/LIST_CYCLING_DESIGN.md` option C.
2. **[QUEUED] Extremely-extensive Playwright audit plan** — after #1 converges. Draft a very thorough
   Playwright acceptance/regression audit plan (full user flows, roles, responsive, a11y, edge/error
   states, data-integrity of study/reconciliation via UI, gradebook, apBoost, etc.), then run it through
   the SAME loop (3-agent + Codex, same procedure). New slug (e.g. `pw-audit`).
3. **[QUEUED] Operationalization doc** — after #2. A single doc that operationalizes this whole workflow
   and organizes the documents sanely so it re-runs easily next time (kickoff steps, doc layout/naming,
   plan + instruction templates, how to read results, both worked examples). Likely `README.md` becomes
   the mechanism reference + a new `WORKFLOW_GUIDE.md` (or `HOWTO_RUN_A_LOOP.md`) as the operator runbook.

## Later candidates for this loop (from the backlog)
- **Student-owned progress re-key** (LIST_SCOPED_RECON Phase 2 / NEED_TO_FIX #6) — the durable root-cause
  fix behind the CS-ticket flood. High-stakes migration + authz → prime loop target after the above.
- Gradebook student-filter server-side fix (NEED_TO_FIX #8).
- List-completion auto-advance (durable UI fix; the workaround is #1 above).
