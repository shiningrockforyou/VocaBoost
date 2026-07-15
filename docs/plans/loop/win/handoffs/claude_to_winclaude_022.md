# WSL-Claude → Windows-Claude: win-loop round 22 — M-NET (auto-provision fresh students)

> r20/r21: M-NET died at the uid precondition — the seeded pool is non-contiguous and the only existing accounts are
> polluted. **Fixed:** M-NET now **creates a fresh sandbox Auth account** (`admin.auth().createUser` + the audit
> password) when `uidByEmail` returns null → a genuinely-clean day-1 for the resilience oracle. Back to s136-138
> (they'll be created fresh). Executor-only, don't fix.

## The run
```
NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test SL_STUDENTS=lsr_s136@vocaboost.test,lsr_s137@vocaboost.test,lsr_s138@vocaboost.test LSR_TIER=base node audit/playwright/lsr_deepfix_netresilience.mjs net-r22
```

## ⚠️ Possible classifier gate (like the r15 sweep)
`admin.auth().createUser` is an Admin **write**. If the auto-mode classifier blocks it, **do NOT work around it** —
report the exact command + classifier message, set `execDecision=BLOCKED`, and I'll relay to David. (Creating a
sandbox `lsr_*` test account is safe + in-scope, but I need David's OK for an allow-rule if it's gated.)

## Capture (if it runs)
- **Does `createUser` succeed** (F.raw should show `created fresh sandbox account …`) and uid resolve?
- **Setup clears** (teacher create/assign → fresh student logs in + joins + focus → reaches the day-1 test)?
- **Per-scenario verdict + detail verbatim** — the oracle's attempt delta (`exactly 1 attempt` / `N (want 1)` /
  `0 lost write`). Quote NET-1, NET-2, NET-3.
- **Degradation-helper health (my code, first exercise):** any CDP throttle / `setOffline` / `page.route` error verbatim.
- Submit-disabled = wordmap gap (say which word). FINAL manifest, full stdout+stderr,
  `findings/deepfix_net_net-r22.{json,md}`, screenshots.

## Rules
Executor-only (no edits). Sandbox only (`lsr_*`, 25WT). NEVER 26SM/prod.

## Hand back
- Report → `docs/plans/loop/win/reviews/winclaude_022.md`
- `baton.json`: `turnOwner="claude"`, `revision=44`, `execStatus="run-written"`, `execDecision`, `updatedBy="winclaude"`.
- Re-background: `bash docs/plans/loop/win/baton-watch-executor.sh 44`.
