# Fix #9 design — CONVERGED (GO)

**Final design:** `docs/plans/loop/fix9/plan.md` (v2). **Verdict:** Codex `GO` (round 2,
`codex_reviews/codex_review_fix9_002.md`) + Claude verification + 3-agent audit agree.

## Loop summary (2 rounds)
- **Round 1:** 3-agent audit (correctness=no-blockers / regression / edge) + Codex r-fix9-001. Two blockers:
  (F9-1, also found by regression agent) v1's Fix B re-introduced cross-progression review mispairing; (F9-2)
  Fix A's empty `nwStart-1` range destroyed the lineage Fix B needs. Plus an edge blocker: `newWordCount=0`
  falsy → `wordsIntroduced` falls through to the review pool on reload.
- **Round 2:** all folded → GO.

## The fix (implementation-ready, 3 files, all LIST_SCOPED_RECON-gated, no new index/migration)
1. `studyService.js` — (a) `initializeDailySession`: on REVIEW_STUDY resume set `newWordCount=0`,
   `newWordStartIndex/newWordEndIndex = the day's passed-new anchor range`; (b) `completeSessionFromTest`:
   `wordsIntroduced` uses `Number.isFinite(newWordCount) ? newWordCount : (newWords.length||0)`.
2. `db.js` — `getReviewForDay`: position-consistent cross-class pairing (candidate stream + client-side
   range match against anchor's `newWordStartIndex/EndIndex`); `found` only on range match, `none` on
   exhaustion, `query-error` preserved, P1-1 lineage guard retained.
3. `progressService.js` — pass `anchorNewWordStartIndex/EndIndex` into `getReviewForDay`.

## Codex GO guardrails (follow when writing the diff)
1. Everything behind `LIST_SCOPED_RECON` (Run-L flag-off equivalence).
2. Passed-new selection byte-equivalent to `determineStartingPhase:77-81` (or factor a helper).
3. Legacy attempts missing range → force `newWordCount=0`; don't pretend a derived range is authoritative.
4. Update the stale `getReviewForDay` comments (new invariant = student/list + temporal + anchor range).
5. Run S S-1/S-3 postverify asserts the B review attempt's range == A's anchor range.
6. Retire the stale `lsr_runS.mjs` before relying on Run S output.

## Next
Implement the diff → owner reviews + deploys → Run S (GO design) validates it green.
