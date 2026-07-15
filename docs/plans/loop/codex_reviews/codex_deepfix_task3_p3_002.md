# Codex review — DEEPFIX_TASK3_P3 round 2

Target: `functions/foundation.js` round-2 deltas only.

Verdict: GO / CONVERGED-OK.

I reviewed only the two W2 marker deltas requested in `docs/plans/loop/handoffs/claude_to_codex_deepfix_task3_p3_002.md`.

## Delta 1 — existing legacy marker upgrade

Status: resolved.

The previous defect was that `writeUpgradedReviewMarker` returned `alreadyWritten` for an existing owned marker without upgrading the fields that make the marker pairable and gradebook-visible. The new code now:

- verifies ownership (`functions/foundation.js:672-676`);
- detects upgraded shape through parseable `testId` and integer range fields (`functions/foundation.js:677-684`);
- derives the day anchor and merges missing `testId` / range fields into the existing marker (`functions/foundation.js:686-705`);
- logs `review_marker_anchor_missing` rather than fabricating a range when no same-day anchor is derivable (`functions/foundation.js:695-701`).

This resolves the C-14 legacy-marker hole for the concrete live shape: a range-less/testId-less owned automarker now becomes parseable and range-bearing instead of silently remaining unpairable.

Non-blocking hardening note: `rangeOk` currently means “both range fields are integers,” not “both equal the derived day anchor.” For the specific legacy defect this is sufficient because legacy automarkers had no range. If a future/partial marker has integer-but-wrong range fields, this helper would treat it as already upgraded. I do not mark this as a blocker for P3, but an acceptance test should prefer “existing legacy no-range marker upgrades to exact anchor range” over only checking integer presence.

## Delta 2 — completeSession marker suppression by pairability

Status: resolved.

The previous defect was that `completeSession` suppressed marker creation when any same-day review existed, even if that review did not pair to the anchor range. The new code now:

- uses the day’s passed-new anchor when available (`functions/foundation.js:1075-1084`);
- calls `getReviewForDayServer`, the exact-range/temporal pairing path, before suppressing marker creation (`functions/foundation.js:1080-1084`);
- retains the coarse `dayReviewExists` fallback only for no-anchor pure review-only days (`functions/foundation.js:1085-1091`);
- suppresses the marker only on `pairing.status === "found"` (`functions/foundation.js:1092-1095`);
- writes/upgrades the marker on `none` and on `query-error`, logging the query-error path instead of silently suppressing (`functions/foundation.js:1095-1104`).

This closes the same-day/different-range review false-suppression path. A different-range review no longer counts as a pairing review, so it cannot suppress the upgraded marker.

## Syntax

`node --check functions/foundation.js` passed.

## Verdict

The two round-1 high findings are fixed, and I found no new blocker/high issue in these deltas.

VERDICT blockers=0 high=0 med=0 nits=0

CONVERGED-OK
