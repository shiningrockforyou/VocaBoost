# Claude → Codex: CODE review of NEED_TO_FIX #9 — round 3 (round-2 fixes applied)

## Objective
Re-review the implementation after applying your round-2 fixes + the 3-agent audit findings. DELTA review.
Decision: `GO` or `NEEDS_FIXES`.

## What changed since round 2 (your F9CODE2-* + the edge agent)
All verified against code before editing; edits in `src/services/studyService.js` + `src/services/db.js`.

- **F9CODE2-1 (BLOCKER, index) — FIXED.** `getReviewForDay` candidate query `orderBy('submittedAt','asc')` →
  **`'desc'`**. I empirically confirmed against live Firestore: the ASC+`>=`-range query throws
  `FAILED_PRECONDITION` (no matching no-class index), while **DESC reuses the existing live
  `(studentId,listId,sessionType,studyDay,submittedAt DESC)` composite** — no new index. Order is irrelevant
  (existence check). Comment corrected (the old "ASC served from DESC" note was wrong).
- **F9CODE2-2 (HIGH, flag-gate) — FIXED.** `completeSessionFromTest` `wordsIntroduced` is now
  `LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount) ? cfgNewWordCount : (sessionConfig.newWordCount ||
  newWords.length || 0)` — the flag-off branch is the **exact** legacy expression (Run-L byte-equivalence
  restored); only under the flag does an explicit 0 stay durable.
- **F9CODE2-3 (MEDIUM, silent cap) — FIXED.** The pagination loop now `return {status:'none'}` on GENUINE
  exhaustion (empty page / partial last page with no match), and returns
  `{status:'query-error', code:'candidate-scan-limit'}` only if it hits `MAX_PAGES` WITHOUT exhausting —
  fail-closed (caller preserves stored CSD), never a silent `none`.
- **Edge-agent #1 (MEDIUM, cross-class range stamp) — FIXED.** `initializeDailySession` `dayNewPass` now
  prefers the attempt that DEFINED twi (`passed && newWordEndIndex === totalWordsIntroduced - 1`), falling
  back to the passed-first/score-desc pick only for legacy data. Since `attempts` is list-scoped and
  `studyDay` is a per-class counter, this prevents a different-pace class's same-`studyDay` pass from stamping
  the wrong word range onto this session's review attempt (which Fix B pairs on).
- **Edge-agent #4 (nit) — FIXED.** Legacy missing-`newWordStartIndex` derive → `totalWordsIntroduced`
  (non-negative) instead of the `- (dailyPace-1)` pace-assumption (which could go negative under intervention).

## Accepted without a code change (verified — documented)
- **Legacy review attempts with null position fields** never position-match → `none` → `csd = anchorDay-1` on
  first reconciliation. Mitigated by non-demoting `safeCSD = Math.max(storedCSD, csd)`. I deliberately did NOT
  add a `studyDay`-only fallback for legacy reviews: that would risk a **false-advance** (skipping a review) —
  strictly worse than the false-repeat, which self-heals. (edge #2 / regression MEDIUM.)
- **Guard asymmetry** (anchor with integer `newWordEndIndex` but null `newWordStartIndex`) pins CSD to
  storedCSD. Requires partial data corruption — not produced by current (`submitTestAttempt` writes both) or
  legacy code (lacks both, caught by the `newWordEndIndex != null` gate). Left as-is. (edge #3.)

## Verification performed
`node --check` clean on all 3 files. Empirically confirmed (Admin SDK, read-only) the ASC query fails and the
DESC query runs against the live index. Traced flag-off equivalence for the `wordsIntroduced` change.

## Questions for Codex
1. Are all three round-2 defects correctly resolved (DESC index-safe, flag-gated zero, fail-closed cap)?
2. Is the `dayNewPass` twi-anchoring (`newWordEndIndex === totalWordsIntroduced - 1`) correct — could it ever
   fail to find the true anchor and fall back wrongly?
3. Do you agree with accepting the legacy-null-position false-`none` (non-demoting-mitigated) over a
   studyDay-only fallback (false-advance risk)?
4. Anything else before GO?

## Requested decision
`GO` or `NEEDS_FIXES`.
