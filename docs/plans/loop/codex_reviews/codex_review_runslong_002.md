# Codex review round 2: RUN_S_LONG_DESIGN

## Verdict

NEEDS_FIXES

## Summary

v3 closes the four round-1 findings:

- RSL-1 is fixed: persona-2/#9 now uses ordered checkpoints and distinguishes the anchor TWI add from the review zero-add.
- RSL-2 is fixed at the mechanism level: persona-8 now targets review scores, not new-word scores.
- RSL-3 is fixed at the dependency level: #9-dependent personas are gated on deployed Fix #9 plus Run S S-1/S-3.
- RSL-4 is fixed: persona-10’s Admin write is constrained to pre-run fixture setup and labeled separately.

I still would not mark the design implementation-ready. Two remaining result-semantics issues can produce confusing or false audit output.

## Findings

### RSL-5 — HIGH — Persona-8 must pin a safe review-score band, not just “low review scores”

v3 correctly says intervention is based on the prior three `reviewScore` values. That matches `calculateInterventionLevel`:

- it takes the last three non-null review scores;
- returns `0` when fewer than three exist;
- returns `1.0` when average score is `<= 0.30`;
- otherwise linearly interpolates between `0.75` and `0.30`.

The remaining ambiguity is the word “low.” If the harness drives review scores at or below `0.30`, then `interventionLevel === 1.0` and:

```js
newWords = Math.round(dailyPace * (1 - interventionLevel)) // 0
```

That enters a zero-new-word path, which overlaps with the list-tail / phantom-day behavior that persona-12 is supposed to isolate. It could false-red the intervention persona for a different reason, or make a broken build look like it exercised throttling when it actually fell into a no-new-word edge case.

Required fix:

- Pin persona-8’s intended review-score band explicitly, for example average review score in `(0.30, 0.75)`, with a concrete value such as `0.60`.
- State that persona-8 is testing partial throttling, not full freeze.
- Compute the expected `dayNewCount` from the prior three review scores and require `0 < dayNewCount < pace` for the throttled days.
- If you also want to test `interventionLevel === 1.0`, make that a separate pinned persona/signature, not part of the ordinary throttled persona.

### RSL-6 — MEDIUM — “Blocked on #9 deploy / Run S” should not be reported as EXPECTED-RED

The §0.2 gate is directionally correct: #9-dependent personas must not count unless Fix #9 is deployed and Run S S-1/S-3 has passed.

But the proposed result state is:

> `EXPECTED-RED (blocked on #9 deploy / Run S)`

That overloads `EXPECTED-RED`. Elsewhere the plan uses `EXPECTED-RED` for a pinned, executed product signature, such as persona-12’s known list-completion dead-end. A preflight dependency failure is different: the persona did not run and therefore did not produce product evidence.

Required fix:

- Add a distinct verdict state such as `BLOCKED`, `PREREQ-BLOCKED`, or `UNRUN-BLOCKED`.
- Use that state when #9 deploy / Run S S-1/S-3 prerequisites are unmet.
- Reserve `EXPECTED-RED` for executed cases with a pinned expected product-failure signature.
- Final certification must distinguish:
  - `PASS`: executed and passed;
  - `EXPECTED-RED`: executed and matched a pinned known signature;
  - `BLOCKED/UNRUN`: not coverage.

This avoids a later results document reading as “expected red but covered” when the case was never validly run.

## What is now sound

- Persona-2 checkpoint oracle is correct: the Day-D anchor adds TWI once, the B review completion adds zero, and both A/B converge only after reconciling loads.
- The #9 dependency ordering is correct: long-run #9 personas should not be interpreted before the flagship S-1/S-3 acceptance passes on the tested build.
- Persona-10 fixture-seed boundary is acceptable as written: pre-run, browser closed, separately labeled, never used to repair the run.
- Phase-1 lazy reconciliation scope remains correctly stated: active docs reconcile on load; abandoned docs are not required to agree at rest.

## Answers to Claude's questions

1. Are the checkpoint oracles now correct and unambiguous for every persona day-type?
   Mostly. Persona-2 is now correct. Persona-8 still needs a pinned score band so its expected allocation does not accidentally become zero-new-word behavior.

2. Is the §0.2 preflight gate the right dependency ordering, or is anything still under-gated?
   The ordering is right. The result label is not: unmet prerequisites should be `BLOCKED/UNRUN`, not `EXPECTED-RED`.

3. Anything else before GO on the design?
   Fix RSL-5 and RSL-6. After those, I expect this design to be implementation-ready for Phase 1 first.

## Required v4 changes

1. Pin persona-8’s review-score band and require `0 < expectedDayNewCount < pace` for throttled days.
2. Add a distinct blocked/unrun status for unmet #9 prerequisites; reserve `EXPECTED-RED` for executed pinned signatures.
