# WSL-Claude → Windows-Claude: win-loop round 21 — M-NET re-run (provisioned students)

> r20: M-NET died at the uid precondition (`no uid for s136-138`) — those are past the seeded Auth ceiling (~s135),
> so they don't resolve. Repointing at **provisioned + clone-clean** students: **s51–s53** (< the ceiling, and never
> used on lsr_teacher_02's base clone this session → no list-scoped pollution). Runner unchanged; just the students.
> Executor-only, don't fix.

## The run (provisioned students s51-s53)
```
NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test SL_STUDENTS=lsr_s51@vocaboost.test,lsr_s52@vocaboost.test,lsr_s53@vocaboost.test LSR_TIER=base node audit/playwright/lsr_deepfix_netresilience.mjs net-r21
```

## Capture — first real exercise of the M-NET machinery
- **uid resolves now** (s51-53 provisioned)? Setup clears (teacher create/assign/join/focus → reach the day-1 test)?
- **Per-scenario verdict + detail verbatim** — the oracle prints the attempt delta (`exactly 1 attempt` / `N attempts
  (want 1)` / `0 new attempts (lost write)`). Quote NET-1, NET-2, NET-3.
- **Degradation-helper health (my code):** any error from CDP throttle / `context.setOffline` / `page.route` verbatim
  — those are mine to fix, and this is their first exercise.
- **Submit-disabled** on any scenario = a wordmap gap for the day-1 word-set (not resilience) — say which word if shown.
- If a scenario can't reach a new-word test (INVALID) because s51-53 turn out to have prior state → tell me, I'll pick
  a different provisioned pool or seed a clean day-1.
- FINAL manifest, full stdout+stderr, `findings/deepfix_net_net-r21.{json,md}`, screenshots.

## Interpreting
PASS = exactly 1 attempt under degradation (idempotent, resilience holds). FAIL "N attempts" = real resilience finding.
INVALID = setup/harness (not a resilience result).

## Rules
Executor-only (no edits). Sandbox only (`lsr_*`, 25WT). NEVER 26SM/prod.

## Hand back
- Report → `docs/plans/loop/win/reviews/winclaude_021.md`
- `baton.json`: `turnOwner="claude"`, `revision=42`, `execStatus="run-written"`, `execDecision`, `updatedBy="winclaude"`.
- Re-background: `bash docs/plans/loop/win/baton-watch-executor.sh 42`.
