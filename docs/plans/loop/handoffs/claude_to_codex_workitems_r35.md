# WSL → Codex round 35: INPUT on two active work items (review-quiz floor + grader fix)

David wants us (WSL + Codex only) working on two things right away. WSL investigated; **your independent input + code
verification** is requested. Target: `docs/plans/D3.5_WORKITEMS_reviewfloor_grader.md` (read it), plus the deployed code.

## Item A — review-quiz floor
WSL found `reviewTestSizeMin`/`reviewTestSizeMax` exist as per-class settings, but `calculateReviewCount`
(`studyAlgorithm.js:223`) floors on a HARDCODED `REVIEW_COUNT_MIN` (=15) and takes only a `reviewCap`.
- **VERIFY:** is `reviewTestSizeMin` actually wired into the review-count floor, or stored-but-unused? Trace the call site
  (`studyService.js:442`) + wherever `reviewCap`/min come from + the server path (`foundation.js`). Report the exact wiring.
- Confirm there is NO per-class review-SCORE / throttle floor (thresholds hardcoded at `foundation.js:687-688`).
- Opinion: to give teachers a "review floor" lever, is the right primitive the existing size-min (wire it if unused), or a
  new score/throttle floor — and where would each change land?

## Item B — grader false-negatives on correct Korean
WSL's root cause: the model (`claude-haiku-4-5`) over-applies Rule 1 ("Restating the word") to correct KOREAN direct
translations (자전적인←autobiographical), despite Rule 1's English-only examples; the 06-29 fix ("matches the Korean
definition") is too narrow.
- **Weigh in:** is a prompt-only fix (scope Rule 1 to English; add positive Korean-translation examples; typo tolerance)
  reliable on Haiku, or does this need a model bump (Haiku→Sonnet) and/or a re-grade-only-the-rejections pass?
- **VERIFY provenance:** CS-2026-06-29 flagged that the DEPLOYED grader lagged committed code. Does the current prod build
  actually run the prompt at `index.js:1267`? (What commit/deploy is live.)
- Propose a small **regression-test set** from the runbook's known cases (correct: 자전적인/무관심한/불협화음-typo; wrong:
  culminate←요점, dispel←"express disapproval") to gate any grader change.

## Hand back
Write `docs/plans/loop/codex_reviews/codex_workitems_r35.md` with: (A) the exact reviewTestSizeMin wiring verdict +
recommendation; (B) grader fix recommendation (prompt-only vs model bump vs re-grade pass) + the regression set + the
provenance answer. Set baton `turnOwner=claude round=35 codexStatus=review-written codexDecision=DONE updatedBy=codex
revision=141 codexReviewRepoPath=docs/plans/loop/codex_reviews/codex_workitems_r35.md`.
