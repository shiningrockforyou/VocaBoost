# vocaboost_blocker_fixes.patch — how to apply

Fixes the two confirmed BLOCKERs (B2 day-not-advancing strand; F01 retired-words-in-review backstop). 3 files, +25/-1. Verified here: `node --check` ✓, full `vite build` ✓, behavioral unit test ✓ (undefined stripped; MASTERED excluded from selectReviewQueue output; newWordScore=0 keeps passed boolean).

## Apply
```bash
git checkout main && git pull          # or whichever base branch you deploy from
git apply --check vocaboost_blocker_fixes.patch   # dry run — reports issues without changing files
git apply vocaboost_blocker_fixes.patch           # apply
# review, then commit
git add -A && git commit -m "Fix B2 session-state strand + F01 review MASTERED backstop"
```
If `git apply` complains about offsets/context, use: `patch -p1 < vocaboost_blocker_fixes.patch` (more lenient), or `git apply --3way`.

## What each hunk does
1. **sessionService.js `saveSessionState`** — strips `undefined` fields before the Firestore `setDoc`. This is the single chokepoint all session_states writes flow through (DailySessionFlow, studyService Day-1 and Day-2+ paths), so it kills the entire "Unsupported field value: undefined → day won't advance" class. **(B2, primary)**
2. **studyService.js `completeSessionFromTest`** — defaults `newWordScore = 0` when no prior new-word attempt is found on Day 2+, instead of leaving it `undefined`. Logic fix complementing #1. **(B2)**
3. **studyAlgorithm.js `selectReviewQueue`** — filters MASTERED words at the start, so retired words can never be served in review no matter which path (incl. a restored/persisted queue) built the pool. **(F01 backstop)**

## Notes / still open (NOT in this patch — need your decisions)
- **F01 stale-queue source:** #3 is a guaranteed backstop, but the *trigger* is likely the persisted review queue restored on resume (`setReviewQueue(state.reviewQueue)` in DailySessionFlow.jsx). Recommended follow-up: on resume, rebuild via `buildReviewQueue` (or re-filter the restored array vs current study_states) so stale queues aren't replayed. The backstop makes this non-urgent but it's the cleaner root fix.
- **NOT included** (need product decisions): logout/restart work-loss (3-min localStorage window + intentional_exit suppression), empty-`correctDefinition` batch crash (data backfill + function skip-and-mark), beginner 90%-threshold stall, grader reversed-meaning leniency. See FIX_SPEC.md.

## Post-deploy verification (harnesses saved, reusable)
- `lazy` chronic-failure walk → expect 0 F01 leaks under pool collapse.
- `careful` walk past Day 16 (`e2e/audit/B27/run_walk20.mjs`) → expect 0 F01 leaks under correct play.
- B2 strand + recovery scenarios (RECOVER) → expect CSD advances; no permanent stuck.

The branch `audit/fix-mastered-review-exclusion` already carries the earlier build-time F01 filter (commit f38e383); this patch's hunk #3 is independent of it and applies with or without it.
