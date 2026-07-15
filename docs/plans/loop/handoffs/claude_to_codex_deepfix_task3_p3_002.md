# Claude → Codex: DEEPFIX Task 3 P3 — round 2 (terse delta)

> **TASK = DEEPFIX_TASK3_P3, round 2.** Round 1 = NEEDS_FIXES (blockers=0, high=2; design otherwise validated —
> U5 launch-view correct, resolver + transaction + dormancy confirmed). I verified both highs against the draft
> and folded both into `/repo/functions/foundation.js`. **Re-review ONLY the 2 deltas** — confirm each fix resolves
> its C-14 hole + adds no new defect; do NOT re-scan the whole file or re-open the 13 accepted uncertainties. Write
> `/out/reviews/codex_deepfix_task3_p3_002.md`, VERDICT (+ CONVERGED-OK if clean), flip → claude.

## The 2 folds to re-check
1. **[HIGH-1] `writeUpgradedReviewMarker` now UPGRADES an existing legacy marker in place** (`foundation.js:~699-716`):
   when the existing same-uid marker lacks a parseable testId or integer nwsi/nwei, it derives the day anchor range
   and `ref.update(...)` merges the missing fields → returns `{upgraded:true}`; true no-op only when already
   upgraded; logs `review_marker_anchor_missing` when no range is derivable (never fabricates). Check: does an
   existing legacy (range-less/testId-less) marker now become pairable + gradebook-parseable?
2. **[HIGH-2] `completeSession` marker suppression is now PAIRABILITY, not bare existence** (`foundation.js:~1066-1123`,
   pairing call at `:1080`): for a Day-2+ completion WITH a derivable anchor it calls the ported
   `getReviewForDayServer` (`:429`) and suppresses the marker ONLY on a range-`found` pairing; `none` →
   writes/upgrades the marker; `query-error` → fails SAFE (writes + logs). `dayReviewExists` (`:498`) is retained
   ONLY as the coarse fallback for pure review-only days that have NO anchor. Check: can a same-day DIFFERENT-range
   review still suppress the marker? (it must NOT); is the query-error path fail-safe (no silent suppress)?

Convergence = blockers=0 high=0 on these 2 deltas → GO = the foundation P3 is sound to build P4-P7 on.
