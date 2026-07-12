# Claude → Codex: CODE review of the NEED_TO_FIX #9 fix

## Objective
Review the **implementation** of the `#9` fix (the design you already GO'd in `docs/plans/loop/fix9/plan.md`
v2). This is a CODE review, not a design review: read the three changed files and check that the code
**correctly and safely implements the design** — wrong variable, off-by-one, missed edge, pagination/cursor
bug, flag-gating leak, or any divergence from the GO'd plan. Decision: `GO` (code is correct + safe to
deploy) or `NEEDS_FIXES` (list the concrete code defects).

## Scope — all changes are in these 3 files (all under `LIST_SCOPED_RECON`; flag-off paths unchanged)
Read the files directly; below is the exhaustive list of what I changed and where.

### 1. `src/services/studyService.js`

**1a. `initializeDailySession` — REVIEW_STUDY-resume allocation override.**
Inserted, immediately AFTER `const phaseInfo = determineStartingPhase(attempts, currentStudyDay);` and BEFORE
the `return {`, a block computing `nwCount / nwStart / nwEnd`:
- defaults: `nwCount = newWordCount`, `nwStart = totalWordsIntroduced`,
  `nwEnd = totalWordsIntroduced + newWordCount - 1` (i.e. the original values).
- if `LIST_SCOPED_RECON && phaseInfo.phase === SESSION_PHASE.REVIEW_STUDY`: select `dayNewPass` =
  `attempts.filter(studyDay===currentStudyDay && sessionType==='new').sort(passed-desc, score-desc)[0]`
  (byte-identical selection to `determineStartingPhase` ~L77-81). If `dayNewPass` exists:
  - `nwCount = 0`;
  - `nwEnd = Number.isInteger(dayNewPass.newWordEndIndex) ? dayNewPass.newWordEndIndex : (totalWordsIntroduced - 1)`;
  - `nwStart = Number.isInteger(dayNewPass.newWordStartIndex) ? dayNewPass.newWordStartIndex :
    (Number.isInteger(dayNewPass.newWordEndIndex) ? dayNewPass.newWordEndIndex - (dailyPace - 1) : totalWordsIntroduced)`.
- The `return {}` object's three new-word fields now read `newWordCount: nwCount`, `newWordStartIndex: nwStart`,
  `newWordEndIndex: nwEnd` (previously `newWordCount`, `totalWordsIntroduced`, `totalWordsIntroduced + newWordCount - 1`).
- **Intent:** on a review resume, don't re-introduce/re-count new words (`count=0`) but preserve the day's
  passed-new anchor range on start/end (for the completion gate + for the review attempt's stored range).
- **Please check:** selection identity to `determineStartingPhase`; the legacy derive branch (both indices
  missing → falls back to `totalWordsIntroduced`, which does NOT fix the bug for that legacy attempt but forces
  `count=0` — is that the intended "can't prove range, at least don't double-advance" behavior?); that the
  normal path (`phase !== REVIEW_STUDY`) and flag-off are byte-identical.

**1b. `completeSessionFromTest` — `wordsIntroduced` read.**
Changed `const wordsIntroduced = sessionState?.sessionConfig?.newWordCount || sessionState?.newWords?.length || 0;`
to:
```
const cfgNewWordCount = sessionState?.sessionConfig?.newWordCount;
const wordsIntroduced = Number.isFinite(cfgNewWordCount) ? cfgNewWordCount : (sessionState?.newWords?.length || 0);
```
- **Intent:** treat an explicit `0` as authoritative (the `||` would fall through to `newWords.length`, which
  the reload-to-test recovery path populates with the review pool → mid-review reload double-advances TWI).
- **Please check:** does any non-review-resume path rely on the old `||`-coalescing (e.g. a legitimately
  `undefined`/`null` newWordCount that SHOULD fall back to newWords.length)? `Number.isFinite(undefined)` is
  false → falls back, so that should hold — confirm.

### 2. `src/services/db.js` — `getReviewForDay`

Rewrote the docstring (pairing rule is now position-based) and the function body:
- **Lineage guard extended:** under `LIST_SCOPED_RECON`, require `pairing.anchorClassId && anchorSubmittedAt &&
  Number.isInteger(anchorNewWordStartIndex) && Number.isInteger(anchorNewWordEndIndex)`; else return
  `{status:'query-error', ...}` (unchanged safe outcome). Updated `@param` accordingly.
- **Flag-on query replaced:** the old single query (`where classId==anchorClassId`, `orderBy submittedAt asc`,
  `limit(1)`) is replaced by a **paginated candidate stream**: query
  `(studentId, listId, sessionType=='review', studyDay==studyDay, submittedAt >= anchorSubmittedAt)`,
  `orderBy submittedAt asc`, `limit(PAGE=25)`, looping with `startAfter(cursor)` up to `MAX_PAGES=40`. For each
  candidate, if `data.newWordStartIndex === anchorNewWordStartIndex && data.newWordEndIndex === anchorNewWordEndIndex`
  → return `{status:'found', attempt:data}`. On exhaustion → `{status:'none'}`.
- **Flag-off branch unchanged:** the `classId==classId`, `limit(1)` legacy query now sits as a fall-through
  after the `if (LIST_SCOPED_RECON) {...}` block; the `catch → query-error` is unchanged.
- **Intent:** recognize a review earned in ANY of the student's classes ONLY if it covers the anchor's exact
  word range (position-consistent), avoiding the cross-pace/pre-flag false match; position match is client-side
  → no new index.
- **Please check:** the ASC `orderBy` + `submittedAt >=` range is served by the existing
  `(studentId, listId, sessionType, studyDay, submittedAt DESC)` composite (I believe Firestore serves it in
  reverse — confirm no new index needed); the pagination `startAfter`/`limit(PAGE)`/break-on-`<PAGE` termination
  is correct and bounded; `MAX_PAGES=40` cap can't silently drop a valid later match (is the candidate set ever
  larger than 25×40 for one student/list/day post-anchor?); returning `none` (not the newest) on exhaustion.

### 3. `src/services/progressService.js` — the `getReviewForDay` call site (Day-2+ branch, ~L163)

Added two fields to the pairing object passed to `getReviewForDay`:
`anchorNewWordStartIndex: anchorTest.newWordStartIndex`, `anchorNewWordEndIndex: anchorTest.newWordEndIndex`
(alongside the existing `anchorClassId`/`anchorSubmittedAt`). Updated the adjacent comment. Nothing else in
`progressService.js` changed.
- **Please check:** `anchorTest` (from `getMostRecentPassedNewTest`) always carries integer
  `newWordStartIndex/newWordEndIndex` for a modern passed-new anchor; if it can be null/absent, the new lineage
  guard would return `query-error` (CSD preserved) — is that the intended degradation?

## What I did NOT change
No other files. No new Firestore index. No migration. No feature-flag change. `determineStartingPhase`,
`recordSessionCompletion`, `getNewWordAttemptForDay`, and the flag-off branches of all three functions are
untouched.

## Questions for Codex
1. Does the code correctly implement the v2 design, or are there implementation bugs (wrong var, off-by-one,
   the legacy-derive branch, the pagination loop)?
2. Is the `getReviewForDay` candidate stream correct, bounded, and index-safe (no new index)?
3. Is the flag-off path provably byte-equivalent (Run-L equivalence preserved)?
4. Any consumer of the changed return fields / `wordsIntroduced` I missed?

## Requested decision
`GO` (code correctly + safely implements the GO'd design) or `NEEDS_FIXES` (concrete code defects to fix).
