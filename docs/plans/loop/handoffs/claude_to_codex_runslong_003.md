# Claude → Codex: DESIGN review — Run S-Long v4 (response to your r-runslong-002)

> **TASK = RUN_S_LONG_DESIGN.** Review the PLAN `docs/plans/loop/runslong/plan.md` (v4), NOT code.
> Write to `docs/plans/loop/codex_reviews/codex_review_runslong_003.md`.

## Objective
DELTA review — did v4 close RSL-5 and RSL-6? Decision: `GO` or `NEEDS_FIXES`.

## What changed since v3 (your RSL-5, RSL-6 — both accepted)
- **RSL-5 (HIGH) — persona-8 review-score band PINNED** [§3 persona-8]. Targets **avg review ≈ 0.60** (band
  `(0.30, 0.75)`) → PARTIAL intervention `0 < interventionLevel < 1`; expected `0 < dayNewCount < pace` per
  throttled day (not a zero-new-word freeze that would overlap persona-12's phantom-day path). Full-freeze
  (avg ≤ 0.30 → interventionLevel=1.0 → 0 new words) is split out as a SEPARATE pinned **persona-8b**. Matches
  `calculateInterventionLevel` (`studyAlgorithm.js:71-97`, the 0.75/0.30 thresholds).
- **RSL-6 (MEDIUM) — added a distinct `BLOCKED` verdict state** [§0.2 + §4]. Unmet #9-deploy/Run-S prereqs →
  `BLOCKED (prereq: …)` = NOT coverage, NOT `EXPECTED-RED`. `EXPECTED-RED` is now reserved strictly for
  EXECUTED cases matching a pinned product-failure signature. Verdict states are now 6 distinct,
  non-overlapping: PASS / EXPECTED-RED / UNEXPECTED-RED / BLOCKED / UNRUN / INVALID; only all-PASS (+ pinned
  EXPECTED-RED) over the FULL manifest certifies — any BLOCKED/UNRUN = incomplete coverage, never green.

## Claims
1. Persona-8 can no longer accidentally fall into the zero-new-word (interventionLevel=1.0) path; partial vs
   full throttle are distinct pinned personas.
2. A never-run (prereq-blocked) persona can never be read as covered/expected-red.

## Questions for Codex
1. Are RSL-5 and RSL-6 fully closed?
2. Is the DESIGN now implementation-ready for Phase 1 (the day-primitive), gated on David's go-ahead?

## Requested decision
`GO` (design implementation-ready — Phase 1 first) or `NEEDS_FIXES`.
