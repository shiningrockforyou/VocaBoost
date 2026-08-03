---
name: verifying-published-claims
description: Checks a claim against evidence before it is published — runs the pre-publish gate, re-derives every number from its evidence file, and flags words like "closed", "verified", "proven", "inert", "cannot", or "no-op" that lack a fixture or file:line behind them. Use before writing a receipt, status report, handoff, changelog row, or any statement that something is fixed, safe, tested, or complete.
---

# Verifying published claims

The failure this prevents is specific and recurring: **a claim written from intent rather than from
evidence.** It has produced a fabricated security closure, three rounds of stale test scores, and a
certified hash for bytes that no longer existed.

## Before publishing

```
Claim check:
- [ ] 1. node scripts/deepfix2/gate.mjs   (treat a failure as a STOP, not a suggestion)
- [ ] 2. Every number re-read from the evidence file — never typed from memory
- [ ] 3. Every strong word has a fixture id or file:line within a line or two
- [ ] 4. Evidence ran AFTER the last edit to the thing it certifies
- [ ] 5. Say what is NOT covered, in the same breath as what is
```

## Words that require evidence next to them

`closed · verified · proven · inert · cannot · impossible · guaranteed · no-op · disarmed ·
every X is pinned · safe · complete`

For each, ask: *which fixture fails if this is false?* If none exists, the honest sentence is
"untested," not "verified." A guard fixtured only on its direct path is **untested**, not closed.

## Calibrating strength

| Evidence you have | Sentence you may write |
|---|---|
| A fixture that fails when the property breaks | "closed — case X" |
| A grep showing no writer exists today | "inert against the current tree (grep, file:line)" |
| Reasoning only | "expected to…; not fixtured" |
| An external reviewer's verdict | "confirmed by <reviewer>, not independently re-audited" |

## Coverage claims

"Every clause is pinned" requires one mutant **per clause, including the ones just added**. Otherwise
write "every *mutated* clause is pinned" and list which are assertion-only. A mutation suite must fail
loudly when a mutant's anchor goes stale — a skipped mutant that reports success is worse than none.

## When a claim turns out false

Correct it **at every source that carries it** — the artifact comment, the receipt, the plan doc, the
changelog — not only the newest one. Then say so in the report; the correction is more useful to the
reader than the original claim was.

Rationale: `docs/plans/deepfix2/EXECUTION_DISCIPLINE.md`.
