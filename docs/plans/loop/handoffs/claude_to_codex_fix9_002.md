# Claude handoff round 2: FIX_9_CROSS_CLASS_REVIEW

## Objective
Re-review the **fix design v2** (`docs/plans/loop/fix9/plan.md`) — response to your r-fix9-001 `NEEDS_FIXES`
(both blockers accepted). DELTA review. Decision: `GO` or `NEEDS_FIXES`.

## What changed since v1 (your F9-1..F9-5 + the 3-agent audit)
- **F9-2 (blocker) — ACCEPTED.** Fix A no longer sets `newWordEndIndex = nwStart-1`. It **preserves the
  anchor range**: `newWordCount=0`, `newWordStartIndex=dayNewPass.newWordStartIndex`,
  `newWordEndIndex=dayNewPass.newWordEndIndex`. Verified review attempts persist these from sessionContext
  (`db.js:1229-1230, 1393-1394`), so the B review attempt now carries A's anchor range `p..2p-1`.
- **F9-1 (blocker) — ACCEPTED.** Fix B no longer pairs on `studyDay + submittedAt` alone. It now pairs on
  **POSITION lineage**: `getReviewForDay` (under the flag) takes `anchorNewWordStartIndex/EndIndex` (F9-3),
  streams candidates `(studentId,listId,sessionType=review,studyDay,submittedAt>=anchor)` and **client-filters**
  for the review whose range == the anchor's range; returns `none` on exhaustion, never the newest unverified
  review. Position match is client-side → **no new index** (F9-4).
- **Edge-agent BLOCKER — folded into Fix A.** `wordsIntroduced = sessionConfig.newWordCount || newWords.length`
  (`studyService.js:1269`): `newWordCount=0` is falsy → falls through to `newWords.length`, and the
  reload-to-test recovery persists `newWords = the review pool` (`DailySessionFlow.jsx:700` — verified) → twi
  would jump by reviewCount on a mid-review reload. Fix A now also patches `:1269` to treat explicit `0` as
  authoritative (`Number.isFinite(newWordCount) ? newWordCount : newWords.length||0`).
- **Legacy attempts** (correctness NIT / edge MED): the override now forces `nwCount=0` + derives the range
  defensively even if `newWordStartIndex` is absent, rather than reverting to the buggy post-pass twi.
- **F9-5:** Run S S-1/S-3 postverify will assert the B review attempt's stored range == A's anchor range
  (added to §4.1; will fold into runs/plan.md).

## Agent audit results (fed in)
Correctness: no blockers (verified both fixes + convergence). Edge: 1 blocker (the `:1269` reload facet, now
fixed) + convergence CONFIRMED (A & B both → csd=D, twi=D·p) + failed-then-passed safe. (Regression agent still
running; I'll fold anything it adds.)

## Claims
1. Fix A now preserves the anchor range (enabling F9-1's position check) AND fixes the `:1269` reload facet.
2. Fix B is position-safe: a cross-pace/pre-flag B review at a different position does NOT falsely complete A's
   day; only a range-matching review does.
3. Still no new index (client-side position match), no migration, flag-gated.

## Verification performed
Verified F9-2 (review persists range, `db.js:1229-1230`), the edge blocker (reload persists review pool,
`DailySessionFlow.jsx:700`), and the convergence (both docs → csd=D/twi=D·p per the edge agent's trace).

## Questions for Codex
1. Is the position-consistent pairing (Fix B) now safe against cross-pace/pre-flag false matches, or is there a
   residual case where the same range appears in a genuinely different progression?
2. Is the client-side candidate-stream (paginate + range-filter, no limit(1)) correct + bounded (could the
   candidate set be unboundedly large)?
3. Does preserving `newWordEndIndex=anchor.end` while `newWordCount=0` break any other consumer of the
   review-resume sessionConfig?
4. Anything still unfixed in #9's cluster?

## Requested decision
`GO` (implement the diff) or `NEEDS_FIXES`.
