# Codex review — REVIEWONLY_DESIGN round 2

## Verdict

GO / CONVERGED-OK for design.

The v2 plan resolves the round-1 defects at the design level. I do not see a remaining design blocker before implementation, assuming the implementation preserves the guardrails below.

## Checks against round-1 findings

### ROD-1 — authoritative predicate

Resolved for this client-side correctness fix.

The predicate is now explicitly:

```js
LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount) && cfgNewWordCount === 0
```

That closes the important correctness hole from v1: absent/unreadable session config must not collapse to “review-only.” It also correctly keeps the change behind `LIST_SCOPED_RECON`, because the review-only CSD advance depends on the non-demoting CSD behavior in `progressService`.

I agree with the revised security framing. This gate is not currently a security boundary; the path is client-side and already operates on student-writable progress/attempt data. Re-deriving the same values in client code would not add integrity. W3/server-authoritative progress remains the real hardening line and should stay tracked separately.

### ROD-2 — session state and analytics semantics

Resolved.

The plan now requires review-only completions to persist:

- `newWordScore: null` in the session summary
- `newWordsTestScore: null`
- `newWordsTestPassed: null`
- `reviewOnlyDay: true`

That avoids the contradictory `COMPLETE + newWordsTestPassed:false` state and avoids polluting `avgNewWordScore`, since current stats already filter `null`/`undefined`.

Implementation guardrail: apply the null/marker semantics consistently to both durable `session_states` and the session summary passed into `recordSessionCompletion`. Do not only fix one of them.

### ROD-3 — list-end handling

Resolved.

Splitting `newWordCount === 0` by `wordsRemaining` is the correct UX/state distinction:

- `wordsRemaining > 0`: recovery throttle, complete the review-only day.
- `wordsRemaining <= 0` with review backlog: terminal “list finished” completion, not a retake loop.
- no review work/all mastered: terminal/all-mastered path, no fake empty-day completion.

Implementation guardrail: the no-review-work case must not call `recordSessionCompletion` just to advance a day. It should stay a terminal/no-work state.

### ROD-4 — intervention staleness

Resolved.

The plan now names the stored `interventionLevel` staleness correctly. The important behavior is that future allocation recomputes intervention from `recentSessions`; the stored field is not the source of truth for recovery once the review-only completion appends the new review score.

### ROD-5 — acceptance coverage

Resolved.

The acceptance matrix now covers the meaningful failure modes:

- full-freeze recovery
- persistent-low review-only progression
- ordinary assigned-new negative gate
- stale/absent config
- list-end with review backlog
- list-end with no review work
- analytics/null new-word score
- reconciliation re-verification

One useful non-blocking addition: if the harness can induce it, add a stale finite-zero negative case: an ordinary assigned-new day with a stale `sessionConfig.newWordCount === 0` must not silently skip the gate. This is not a design blocker because the plan already states this is a client-side durability signal, not a security boundary, but it is the highest-value edge case to test if feasible.

## Answers to the handoff questions

1. Yes. Explicit finite zero plus `LIST_SCOPED_RECON` resolves the correctness issue. Treating it as correctness-not-security is the right resolution under the current architecture.
2. Yes. Null new-word fields plus `reviewOnlyDay` are complete enough to avoid contradictory state and analytics pollution.
3. Yes. `wordsRemaining` is sufficient for the throttle-vs-list-end split, provided the all-mastered/no-review branch does not fake-complete a day.
4. Re-verification is the right scope for this plan. I do not see evidence that review-only completion itself requires a reconciliation redesign before shipping. Cycling must not inherit the old “zero recon change” claim without rerunning the combined scenario.
5. The split is sound. Review-only completion and terminal list-end UX can ship now. Cycling remains a separate capstone and this plan does not pre-commit the lap/reset design beyond requiring compatibility re-verification.

## Implementation guardrails

- Compute `reviewOnlyDay` only from the explicit finite session-config value and the flag. Do not use a falsy fallback.
- Keep the ordinary assigned-new retake gate intact.
- Persist null new-word fields plus a marker for review-only completions.
- Do not advance progress for an empty/no-review terminal state.
- Keep W3/server-authoritative hardening separate; do not represent this as forgery protection.
- Run the reconciliation re-verification before claiming compatibility with cycling.

## Final

VERDICT: GO / CONVERGED-OK.
