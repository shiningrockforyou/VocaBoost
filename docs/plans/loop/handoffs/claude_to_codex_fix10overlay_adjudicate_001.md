# Claude → Codex: ADJUDICATION — is #10 validated at 3/4? (task FIX10_VALIDATION_ADJUDICATE)

> **Task FIX10_VALIDATION_ADJUDICATE, slug `fix10`, round 1.** NOT a code review — an ADJUDICATION. The #10
> fix is deployed (`a967f54`) and the live overlay run is **3/4 cells green**. David wants your independent
> call (with Claude's) on whether that VALIDATES #10 or whether the 4th cell is required. Read
> **`docs/plans/loop/fix10/OVERLAY_RESULTS.md`** (full results + both positions), trace the code yourself,
> write your verdict to **`docs/plans/loop/codex_reviews/codex_review_fix10validate_001.md`**, end with the
> machine `VERDICT` line, flip `turnOwner → claude`.

## The situation
Live green-mode overlay vs the deployed fix (`a967f54`):
- ✅ TD1 — `TypedTest.jsx` Day-1 **new**-final: GREEN (all 6 discriminators + snapshot diagnostic {day:1,csd:0})
- ✅ MD1 — `MCQTest.jsx` Day-1 **new**-final: GREEN
- ✅ MD2 — `MCQTest.jsx` Day-2 **review**-final: GREEN (csd 1→2)
- ⚠️ TD2 — `TypedTest.jsx` Day-2 **review**-final: UNMEASURED (driver couldn't reach the typed review test —
  intermittent nav flake; MD2 proves review-final works; the harness is fail-closed → NOT-MEASURED, not a
  false pass)

## Claude's lean: FINALIZE at 3/4
- Both files proven (TypedTest via TD1; MCQTest via MD1+MD2); both completion types proven (new-final +
  review-final via MD2).
- The #10 fix in `TypedTest.jsx` is ONE shared completion block (`doWriteAndFinalize`, the
  `if (passed && isSessionFinalTest && sessionContext?.dayNumber)` block; new vs review differ only by
  `isSessionFinalTest` at `:971-973`). So TD1-green exercises the exact fixed code; TD2 is redundant coverage
  blocked by a driver flake.

## What I need you to VERIFY (don't take my word)
1. **Trace the `TypedTest.jsx` completion block** (~:976-1057) and the swapped snapshot read (~:983-985):
   is there ANY review-specific branch in the #10 fix's completion path that a Day-1 NEW-final cell does NOT
   exercise but a Day-2 REVIEW-final would? (e.g. the Day-2 gate `requiresNewWordRetake`, the review
   sessionContext, `isFirstDay=false`.) If the fixed code is genuinely identical for new vs review, TD1 covers it.
2. Is there any #10-relevant risk (the reconcile-vs-completion race) that is UNIQUE to a typed review-final
   and not covered by TD1 (typed new-final) + MD2 (mcq review-final)?
3. Anything in `OVERLAY_RESULTS.md` I've misstated about the code.

## Requested decision
`FINALIZE-3/4` (the 3/4 green adequately validates #10; TD2 is redundant) or `NEEDS-4TH-CELL` (with the
specific review-final-only risk that requires it). This is a judgment call — give your reasoning, not just a verdict.
