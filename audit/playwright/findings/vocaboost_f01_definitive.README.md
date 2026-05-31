# vocaboost_f01_definitive.patch — the REAL F01 fix (MASTERED words in review test)

**This is the fix that actually stops F01.** The two prior F01 attempts were insufficient:
1. `buildReviewQueue` build-time filter (commit f38e383/6e9dd4a) — correct, but the review TEST doesn't use that path.
2. `selectReviewQueue` backstop (6e9dd4a) — also on a path the test doesn't use.

VERIFY proved F01 still leaked in production (lazy pool-collapse: 48 MASTERED words served across 4/6 days, identity-verified). Three read-only investigations (F01_PATHMAP_test.md, F01_PATHMAP_queue.md, F01_LIFECYCLE.md) found the true chokepoint.

## Root cause (verified)
Every review-TEST word list — 11 distinct paths (normal Day2+ session, complete-mode, crash-recovery, retake, standalone URL) — funnels through **`selectTestWords()`** (src/utils/studyAlgorithm.js), which was a pure shuffle/slice with ZERO MASTERED awareness. `getSegmentWords()` returns all segment words including MASTERED; `selectTestWords` passed them straight into the test.

## The fix (1 file, 1 function)
`selectTestWords` now filters retired-MASTERED words before sampling. Key design points, each backed by an investigation:
- **Single chokepoint:** MAP-TEST confirmed all 11 leaking test paths pass through `selectTestWords`. New-word pools have no `status` field → filter is a no-op for them (harmless). Verified no review-test path lacks the status field.
- **returnAt-aware (not just `status !== 'MASTERED'`):** MAP-LIFECYCLE found `returnMasteredWords` (which flips expired MASTERED→NEEDS_CHECK) runs at DailySessionFlow:579 before normal-flow reads — BUT the standalone MCQTest/TypedTest PATH C reads study_states WITHOUT it. So an expired-MASTERED word can still carry `status==='MASTERED'` there; a naive status filter would wrongly hide a word that's actually due back. The fix keeps overdue words: `exclude only if status==='MASTERED' AND returnAt > now`.
- **Both word shapes:** words carry status at `w.studyState.status` (from getSegmentWords) OR `w.status` (from buildReviewQueue). Filter checks `w.studyState || w`. `returnAt` is a Firestore Timestamp (`.toMillis()`).

## Verified
- esbuild parse OK.
- Behavioral test (VERDICT PASS): excludes retired-MASTERED in BOTH shapes; KEEPS overdue-MASTERED, PASSED, FAILED, NEEDS_CHECK, and new words; respects testSize.
- `git apply --check` clean against HEAD.

## Apply
```bash
git checkout main && git pull
git apply --check vocaboost_f01_definitive.patch
git apply vocaboost_f01_definitive.patch
git add -A && git commit -m "F01: filter retired MASTERED words in selectTestWords (the real review-test chokepoint)"
```
NOTE: this patch also contains the NEEDS_CHECK review-queue bucket (from the quick-fixes set) since both live in studyAlgorithm.js. If you apply vocaboost_quick_fixes.patch separately, this patch already includes that hunk — apply ONE of them for studyAlgorithm.js, not both. Cleanest: apply vocaboost_f01_definitive.patch (it has selectReviewQueue NEEDS_CHECK + selectTestWords F01) and take the OTHER files (MCQTest/TypedTest/sessionService/_redirects) from vocaboost_quick_fixes.patch.

## MANDATORY post-deploy verification
Re-run the lazy pool-collapse VERIFY (the only test that exercises F01): expect **0 identity-verified MASTERED-in-review leaks** across all days. F01 is NOT considered fixed until that shows 0. (It was wrongly called fixed twice before.)

## NOT included — optional study-layer follow-up (product decision)
MAP-QUEUE found 5+ `setReviewQueue` sites (complete-mode, crash-recovery, normal moveToReviewPhase) that source from `getSegmentWords` unfiltered, so MASTERED words can appear as STUDY FLASHCARDS (not the test). This is cosmetic relative to the test leak (now fixed). NOT patched because `getSegmentWords` is shared with complete-mode (intentionally shows all words), PDF export, and debug — a blanket filter there would change those semantics. If you want mastered words hidden from review flashcards too, filter at each setReviewQueue site (post-returnMasteredWords, so simple `status!=='MASTERED'` is safe there per MAP-LIFECYCLE) — but decide complete-mode's intended behavior first.
