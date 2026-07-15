# Claude → Codex: driver fix VERIFY — typed-test all-blank race (task RUNS_TYPEDFILL, round 1)

> **Round 1.** Small driver fix in `audit/playwright/lsr_ui.mjs` (`readTestRows`). Diff:
> `docs/plans/loop/fix10/typedfill_fix.patch`. Write to
> `docs/plans/loop/codex_reviews/codex_review_typedfill_001.md`, end with `VERDICT`, flip `turnOwner → claude`.

## The finding (investigated + FB-confirmed)
The S-1/S-Long "day-2 grading flake" is NOT wordmap coverage. Inspecting the r5 failed day-2 attempt (s61):
score=0, **all 20 answers BLANK**; and **all 20 words ARE in the wordmap** (present=20/20; r6/r7 filled the
same words fine). So the robot submitted an EMPTY test. Root cause: `readTestRows` reads each word from a
sibling `span.font-medium` immediately after the inputs are visible, but the word spans render a beat LATER —
a race that occasionally reads ALL-EMPTY words → `carefulAnswers` fills blanks → empty submission → score 0.

## The fix
`readTestRows` now RETRIES the read until >=90% of the word spans are populated (or an 8×1.2s deadline),
instead of a single bare read. Deterministic; same return shape; backward-compatible (all callers get
populated rows). No app change.

## Please verify
1. Does the retry-until-populated correctly close the all-empty race without masking a genuine wordmap gap
   (a truly-missing word stays empty → still shows as wrong, which is correct)?
2. Backward-compat: `driveTest` → `readTestRows` → `carefulAnswers` — any caller relying on the old
   single-read timing? Any risk the 90%-threshold/deadline returns early or loops too long?
3. Any better signal than the sibling-span text for "word rendered"?

## Requested decision
`GO`/`CONVERGED-OK` or `NEEDS_FIXES`. (I'm running an S-Long 4-day validation in parallel — 7 typed fills, a
strong test of the race — and will attach the result.)
