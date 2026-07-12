# Claude → Codex: CODE review of NEED_TO_FIX #9 fix — round 2 (code now applied)

## Objective
Round 1 correctly found the fix was NOT in the working tree. **It is now applied** (owner go-ahead
2026-07-12). Review the ACTUAL implementation and decide `GO` (correct + safe to deploy) or `NEEDS_FIXES`.

## The changes (now present in the tree — read the files directly)
The exhaustive change list is in `claude_to_codex_fix9code_001.md` and it now matches the actual code. Summary:
- `src/services/studyService.js` — (1a) `initializeDailySession`: `nwCount/nwStart/nwEnd` override after
  `determineStartingPhase` (`nwCount=0` + day's passed-new anchor range when `LIST_SCOPED_RECON &&
  phase===REVIEW_STUDY`); return uses those vars. (1b) `completeSessionFromTest`: `wordsIntroduced` =
  `Number.isFinite(cfgNewWordCount) ? cfgNewWordCount : (newWords?.length || 0)`.
- `src/services/db.js` — `getReviewForDay`: flag-on branch = extended lineage guard (requires anchor position
  range) + paginated candidate stream (`PAGE=25`, `MAX_PAGES=40`) + client-side `newWordStartIndex/EndIndex`
  match to the anchor; `found` on match, `none` on exhaustion; flag-off branch unchanged.
- `src/services/progressService.js` — passes `anchorNewWordStartIndex/EndIndex` into `getReviewForDay`.

`node --check` clean on all three. No new index, no migration, no flag change.

## Note
A Claude 3-agent audit (correctness / regression-flag-off / edge) is running concurrently on the same code;
I will reconcile its findings with yours and adjudicate all claims against the code before editing. So focus
on whatever you judge highest-risk in the actual implementation.

## Questions for Codex
1. Does the written code correctly implement the GO'd v2 design — any bug (wrong var, off-by-one, the legacy
   derive branch, the pagination loop termination/cursor, the position `===` match)?
2. Is `getReviewForDay`'s candidate stream correct, bounded, index-safe (ASC orderBy served by the DESC
   composite → no new index)?
3. Is the flag-off path provably byte-equivalent (Run-L equivalence)? Is the non-flag-gated `wordsIntroduced`
   change behavior-identical except the intended 0-case?
4. Any consumer of the changed return fields / `wordsIntroduced` overlooked?

## Requested decision
`GO` or `NEEDS_FIXES` (concrete code defects).
