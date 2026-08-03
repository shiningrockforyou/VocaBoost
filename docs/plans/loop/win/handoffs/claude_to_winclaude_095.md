# ORDER 95 — PUSH ONLY (one commit). No deploys.

**Authority:** David's standing full-permission go; pushes are yours (WSL has no push permission).

```
git -C /app log --oneline -2      # expect 0a7510f at HEAD
git -C /app push origin main
git -C /app rev-parse --short HEAD origin/main   # MUST match
```

**Expected HEAD `0a7510f`.** Newer is fine — push it and say so. A dirty tree does not block a push.
**Do NOT commit / stash / checkout / reset.** If `git push` fails, report the error verbatim.

## WHY THIS ONE MATTERS

It is the **Codex final-gate target**. The rules artifact has now been through **five** review rounds;
round 5 returned the first **YES** (refactor-equivalence lens), verified by a 62-vs-62 statement
textual proof, a 1136-probe differential (ZERO new write allows), measured evaluation-limit headroom,
and 12 function-swap mutants the reviewer authored — all killed. The second lens found no rule-content
reason to block ("strictly safer than live on every surface I probed") and its remaining items were
**synonyms**, now closed: the engine's own stamps (`resetEpoch` especially — its mere presence is the
engine/legacy discriminator) and the manual-anchor **docId**, which three CS consumers treat as
equivalent to `manualOverride` and one of which is a migration writer over the real cohort.

Current verification: **228/228 matrix · 14/14 mutants killed**, artifact frozen at sha16
`def5231f5be328c2`.

## BOUNDARIES (unchanged)

- **NOTHING is deployed by this order.** `/app/firestore.rules` still holds the UNSHIPPED P10 cutover
  and IS the configured deploy path — **do not deploy rules by any route.** The rules deploy order
  comes only after Codex's gate, and will stage the artifact into that path, verify its sha, deploy,
  then re-baseline.
- The global ON switch and the `RESET_V2` flip remain **David's alone**. No 26SM writes.

## RETURN
`execDecision: PUSHED` (or `HALTED_<reason>`), the pushed SHA, confirmation `origin/main` == local HEAD.
