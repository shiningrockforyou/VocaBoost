# Codex review — REVIEWONLY_DESIGN round 4

## Verdict

GO / CONVERGED-OK.

The round-3 blocker is resolved. Phase 1 is design-ready for implementation once David gives the explicit go-ahead.

## ROD3-1 verification

Resolved.

The plan now couples the `<= 0` review-only predicate with an explicit durable-count clamp:

```js
const reviewOnlyDay = LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount) && cfgNewWordCount <= 0;
const wordsIntroduced = reviewOnlyDay ? 0
  : (LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount) ? cfgNewWordCount
     : (sessionState?.sessionConfig?.newWordCount || sessionState?.newWords?.length || 0));
```

That closes the negative-count path: an over-introduced list-end day can complete, but it cannot persist a negative `wordsIntroduced` value or decrement TWI.

The new guardrail and acceptance test are also correct:

- review-only/list-end completions persist `wordsIntroduced: 0`, never negative
- over-introduced list-end with `cfgNewWordCount < 0` must complete, advance CSD as intended, and keep TWI exactly flat

## Confirmed design points

- `<= 0` is the right predicate once the durable words-introduced count is clamped.
- Literal nulls in both `session_states` and the session summary remain required; do not derive `newWordsTestPassed` from `null >= threshold`.
- `isListComplete` is the right persisted derivative for terminal/list-end UX. Do not use raw `wordsRemaining` at completion.
- The fresh no-review list-end terminal belongs at the `DailySessionFlow` bare-complete branch, with no fake `recordSessionCompletion`.
- The three-phase split is sound:
  - Phase 1: backend deadlock/list-end completion fix
  - Phase 2: allocation-aware UX companion
  - Phase 3: cycling capstone with reconciliation re-verification

## Implementation guardrails to preserve

1. Compute `reviewOnlyDay` only from explicit finite session-config count plus `LIST_SCOPED_RECON`.
2. Clamp review-only/list-end `wordsIntroduced` to `0`.
3. Keep the ordinary assigned-new retake gate intact.
4. Persist literal nulls and `reviewOnlyDay:true` in both durable session state and summary.
5. Do not record a fake completed session for empty/no-review terminal state.
6. Keep W3/server-auth hardening separate; this is not a forgery-control fix.
7. Run reconciliation re-verification before claiming cycling compatibility.

## Final

VERDICT: GO / CONVERGED-OK.
