# Codex review — REVIEWONLY_DESIGN round 3

## Verdict

NEEDS_FIXES.

The v3 corrections are mostly right, but the `<= 0` change introduces one implementation-critical hole unless the plan explicitly clamps the completion write path.

## Blocker

### ROD3-1 — `newWordCount <= 0` must not persist a negative `wordsIntroduced`

The plan correctly observes that `newWordCount = Math.min(allocation.newWords, wordsRemaining)` can be negative when the list is over-introduced, and that negative should mean “no new words assignable.”

But the current completion code uses the session-config value as the durable words-introduced count:

- `completeSessionFromTest`: `cfgNewWordCount` feeds `wordsIntroduced`
- `recordSessionCompletion`: passes `wordsIntroduced` into the session summary
- `updateClassProgress`: applies `totalWordsIntroduced += sessionSummary.wordsIntroduced`

So if Phase 1 implements only:

```js
const reviewOnlyDay = LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount) && cfgNewWordCount <= 0;
```

and leaves `wordsIntroduced = cfgNewWordCount`, then an over-introduced finished-list day can persist `wordsIntroduced: -N` and decrement TWI. That directly violates the plan’s invariant that review-only/list-end completion keeps TWI flat.

Required fix in the plan:

```js
const hasExplicitCfgNewWordCount = Number.isFinite(cfgNewWordCount);
const reviewOnlyDay = LIST_SCOPED_RECON && hasExplicitCfgNewWordCount && cfgNewWordCount <= 0;
const wordsIntroduced = LIST_SCOPED_RECON && hasExplicitCfgNewWordCount
  ? Math.max(0, cfgNewWordCount)
  : (sessionState?.sessionConfig?.newWordCount || sessionState?.newWords?.length || 0);
```

Or equivalently:

```js
const wordsIntroduced = reviewOnlyDay ? 0 : cfgNewWordCount;
```

for the explicit-config path.

Acceptance must include an over-introduced list-end case where `cfgNewWordCount < 0`, completion succeeds, and TWI remains exactly flat.

## Otherwise resolved

The other v3 corrections are sound:

- `<= 0` is the right gate predicate once the persisted count is clamped to zero.
- Literal nulls in both `session_states` and the session summary are required; do not derive `newWordsTestPassed` via `null >= threshold`.
- `isListComplete` is the correct persisted derivative for terminal UX; raw `wordsRemaining` is not available at completion.
- The fresh no-review list-end terminal belongs at the `DailySessionFlow` bare-complete branch, not the all-mastered resume modal.
- The three-phase split is sound: Phase 1 can close the backend deadlock without blocking on the allocation-aware hero work, and Phase 3 cycling remains separate.

## Required plan edits

1. Add an explicit implementation guardrail: review-only/list-end completions persist `wordsIntroduced: 0`, never a negative value.
2. Update the code sketch in §2 so `reviewOnlyDay <= 0` and `wordsIntroduced` clamping are shown together.
3. Add an acceptance case for over-introduced list-end: `cfgNewWordCount < 0`, completion allowed, CSD advances as intended, TWI does not decrease.
4. Clean the stale §4 wording that still says `Number.isFinite && ===0`; it should match the final `<= 0` predicate.

## Final

VERDICT: NEEDS_FIXES.
