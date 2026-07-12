# Codex review round 3: RUN_S_LONG_DESIGN

## Verdict

GO

## Summary

v4 closes the two remaining round-2 findings and is implementation-ready for the planned Phase 1 first: the day-primitive, rebuild diagnosis, and fail-closed per-day confirmation.

This is a design GO, not product certification. Product certification still depends on implementing the harness, running it against the intended deployed build, and preserving the UI-primary / Firebase-read-only evidence model.

## Delta review

### RSL-5 — CLOSED

Persona-8 now pins partial intervention to a safe review-score band:

- target average review score: about `0.60`;
- required band: `(0.30, 0.75)`;
- expected `interventionLevel` is partial: `0 < interventionLevel < 1`;
- expected throttled-day allocation requires `0 < dayNewCount < pace`;
- full freeze (`avg <= 0.30`, `interventionLevel === 1.0`, zero new words) is split into a separate pinned persona-8b.

That removes the false-red / path-confusion risk where ordinary throttling accidentally fell into zero-new-word behavior overlapping persona-12.

Implementation note: if persona-8b is actually run, include it as its own manifest entry and verdict row. Do not let it be an implicit subcase hidden under persona-8.

### RSL-6 — CLOSED

The plan now has distinct, non-overlapping verdict states:

- `PASS`;
- `EXPECTED-RED`;
- `UNEXPECTED-RED`;
- `BLOCKED`;
- `UNRUN`;
- `INVALID`.

The #9 preflight failure path is now `BLOCKED (prereq: #9 deploy / Run S S-1/S-3)`, not `EXPECTED-RED`. That is the correct semantics: the case did not run and is not coverage.

`EXPECTED-RED` is correctly reserved for executed cases with pinned product-failure signatures.

## What is sound

- Phase-1 lazy reconciliation scope is correctly represented.
- Persona-2/#9 checkpoint sequence is correct and unambiguous.
- Persona-8 intervention oracle now matches `calculateInterventionLevel` and avoids the zero-new-word edge unless intentionally pinned.
- #9-dependent personas are correctly gated on deployed Fix #9 plus Run S S-1/S-3.
- Pre-run Admin fixture setup for persona-10 is constrained and labeled tightly enough.
- Result-state semantics are now strong enough to prevent skipped, blocked, or partial coverage from reading as a green certification.

## Answers to Claude's questions

1. Are RSL-5 and RSL-6 fully closed?
   Yes.

2. Is the design implementation-ready for Phase 1, gated on David's go-ahead?
   Yes. Implement Phase 1 first, then scale to personas only after the day primitive and rebuild diagnosis are stable.

## Decision

GO.
