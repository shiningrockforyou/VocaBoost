# Codex review — PERSONAX_DESIGN round 3

## Verdict

GO / CONVERGED-OK.

Round 3 fixes the remaining round-2 blocker. L14 is now modeled as `EXPECTED-BLOCKED`, not as a frozen-but-advancing green day, and the universal oracle is correctly split between green completion days and blocked `paceEffective == 0` days.

## Claims checked

### 1. L13 and L14 blocked semantics

Accepted.

- L13 is blocked by post-cap `newWordCount == 0` with a non-empty review segment.
- L14 is blocked by full-freeze intervention: `interv == 1.0 -> paceEff == 0 -> newWordCount == 0` with a non-empty review segment.
- Both hit the same Day-2+ completion gate: no same-day passed new-word attempt exists, so completion must return the retake-required / blocked path and preserve CSD/TWI.
- The distinction between triggers is clear enough for implementation: cap exhaustion vs intervention freeze.

The empty-segment exception is also stated correctly: if there is no review segment, the no-review path can complete without hitting the same new-word gate.

### 2. Split oracle

Accepted.

The plan now correctly scopes the green oracle to:

```text
paceEffective > 0:
  Δtwi = min(paceEffective, listSize - twi)
  Δcsd = +1
```

And separately scopes blocked days to:

```text
paceEffective == 0 with a non-empty review segment:
  Δtwi = 0
  Δcsd = 0
  requiresNewWordRetake / EXPECTED-BLOCKED
```

That matches the current `calculateDailyAllocation -> initializeDailySession -> DailySessionFlow -> completeSessionFromTest` behavior.

### 3. L14 stuck-state investigation

Accepted.

Flagging L14 as an audit-time product-edge investigation is the right call. It should not block the persona-expansion design, but the harness should record it sharply if observed:

- full-freeze creates no same-day new-word test,
- blocked completion does not append a successful recent session,
- intervention may remain stuck at `1.0`,
- recovery may require a product change rather than a harness adjustment.

That is a valid candidate `NEED_TO_FIX` if reproduced.

## Nonblocking cleanup notes

- The plan header still says `v2` / `round-2 draft`; update it to v3 / converged before implementation to avoid artifact confusion.
- The remaining David decisions in §9 are real scope choices, not implementation details:
  - re-pin invalid-anchor #10b or accept out-of-scope,
  - include pure same-pace #6 or accept out-of-scope,
  - accept L4’s 45-day runtime or truncate Summit.

These do not block design convergence as long as they are decided before final fleet execution and not counted as covered until accepted.

## VERDICT

GO / CONVERGED-OK.
