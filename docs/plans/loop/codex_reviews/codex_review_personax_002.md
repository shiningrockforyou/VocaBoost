# Codex review — PERSONAX_DESIGN round 2

## Verdict

NEEDS_FIXES.

v2 fixes most of the round-1 design issues. The remaining blocker is the full-freeze intervention persona: under current code, a day with `newWordCount === 0` and a non-empty review segment is not a green `Δcsd=+1` completion. It reaches review study, but then fails the Day-2+ completion gate because there is no same-day passed new-word attempt.

## Clean / accepted deltas

- T1 as a new-class pace-change case is sound.
- T2 same-list pace-change timing and formula are sound if the switch is strictly between completed days and `N <= 15`.
- L13 post-cap phantom is now correctly framed as `EXPECTED-BLOCKED`, not a normal pass.
- The segment-runner framing is right. This is a new audited harness segment, not a light extension of the existing runner.
- Per-list wordmap plus live grader verification is the right acceptance gate for cloned lists.
- The event-coverage ledger is materially better. The remaining out-of-scope events are acceptable only if David explicitly accepts that they are not covered by this persona expansion.

## Finding PX2-1 — L14 full-freeze oracle is wrong

Severity: high / blocker.

The plan currently treats the full-freeze case as:

```text
interv = 1.0 -> Δtwi = 0, Δcsd = +1
```

That does not match the current implementation.

Code path:

- `calculateDailyAllocation(dailyPace, interventionLevel)` computes `newWords = Math.round(dailyPace * (1 - interventionLevel))`; at `interventionLevel === 1.0`, `newWords === 0`.
- `initializeDailySession` can still build a review segment.
- `DailySessionFlow` routes `newWordCount === 0 && segment` into review study.
- `completeSessionFromTest` then applies the Day-2+ completion gate and requires a same-day passed new-word attempt.
- With `newWordCount === 0`, there is no same-day new-word test to pass, so completion returns the retake-required / blocked path instead of advancing class progress.

So L14 cannot be a green recovery persona unless the app is intentionally changed to support review-only completion for full-freeze days.

Required correction:

- Either make L14 an `EXPECTED-BLOCKED` persona, parallel to L13, asserting:
  - no CSD advance,
  - no TWI advance,
  - visible blocked / retake-required state,
  - exact log or artifact signature.
- Or explicitly mark L14 as requiring an app change before it can be a green acceptance case.

## Finding PX2-2 — the universal oracle overstates `Δcsd=+1`

Severity: high.

The universal oracle says:

```text
Δtwi = min(paceEffective, listSize - twi)
Δcsd = +1
```

That is only valid for green completion days where `paceEffective > 0` and the completion gate can be satisfied.

It must explicitly exclude:

- L13 post-cap phantom / blocked days,
- L14 full-freeze if `paceEffective === 0`,
- any other case where `newWordCount === 0` but review completion still requires a same-day new-word pass,
- invalid setup / blocked personas.

Suggested corrected wording:

```text
For green days with paceEffective > 0:
  Δtwi = min(paceEffective, listSize - twi)
  Δcsd = +1

For paceEffective == 0 with a non-empty review segment:
  expected outcome is blocked unless the app has explicit review-only completion support.
```

## Finding PX2-3 — stale evidence path in baton/handoff

Severity: low.

The baton lists:

```text
docs/plans/loop/rounds/personax_r01_synthesis.md
```

That path does not exist. The actual file appears to be:

```text
docs/plans/loop/runslong/rounds/personax_r01_synthesis.md
```

This did not block review because the correct file was discoverable, but the loop handoff should use the real path so future reviewers do not silently miss evidence.

## Answers to requested checks

1. Universal oracle: correct only for green days with `paceEffective > 0`; wrong for full-freeze / blocked days.
2. L13 expected-blocked: sound, as long as its orphan / blocked signature is exact and scoped only to that persona.
3. L4 triple-chain: conceptually sound, but runtime remains a David decision. If runtime is a concern, truncate Summit rather than weakening the oracle.
4. Remaining out-of-scope events: acceptable only as explicitly accepted scope exclusions. They must not be counted as covered.

## VERDICT

NEEDS_FIXES.
