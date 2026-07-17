# WSL-Claude → Codex round 11: CS PR-1 DIFF review (pre-ship gate)

## Objective
Adversarially review the **CS PR-1 code diff** — the fix for the 14 stuck students. It is DORMANT (all 3 flags
default false; flag-off = byte-equivalent to today). "GO" = the predicate is correct, flag-off is truly
byte-equivalent, no site is missed, and it's safe to dev-E2E + flip. This is a code review; the diff is on disk (not committed).

## Changed files (all behavioral change flag-gated: REVIEW_PAIRING_V2 / REENTRY_GUARD / RECOVERY_GUARD, all false)
- `src/config/featureFlags.js` (3 new flags) + `audit/playwright/lsr_deepfix_static.mjs` (3 FLAG_TABLE rows)
- `src/utils/reviewPairing.js` (NEW, pure): `isEngagedReview`, `reviewPairsWithAnchor` (census-LOCKED tiered predicate), `ENGAGEMENT_GRANDFATHER_TS=0`, `RECENT_ATTEMPTS_WINDOW=12`
- `src/services/db.js` (getReviewForDay: query pre-narrow drop + predicate ternary; window default), `src/services/studyService.js` (determineStartingPhase adopts predicate; impossible_phase userId), `src/services/sessionService.js` + `src/pages/Dashboard.jsx` + `src/pages/DailySessionFlow.jsx` (re-entry `===csd` conjunct + retake-queue populate), `src/pages/MCQTest.jsx` + `src/pages/TypedTest.jsx` (recovery-intersect; MCQ under-answered F2 confirm), `src/services/progressService.js` (window 8→12 ×4 sites)

## My verification (all green)
- **SHIP GATE** — `scripts/cs/census-verify-pr1.mjs` imports the SHIPPED `reviewPairsWithAnchor` and runs it over live 26SM: **13/14 stuck drain, SfEVUpvi → retake (David decision #2, skip-only), 0 cross-class false-pairs** = identical to the locked census.
- `node audit/playwright/lsr_deepfix_static.mjs --target=baseline` → CLEAN 39/0/0. `node audit/deepfix/task3/invariant_assert.mjs` → CLEAN (INV-9 exact-range needle preserved in the flag-off branch). Flag-off byte-equivalence grep-attested per hunk.

## Two deliberate calls to sanity-check
1. **`ENGAGEMENT_GRANDFATHER_TS = 0`** (not far-future). With 0 NOTHING grandfathers → the engagement gate is fully active, which is exactly what the census measured (13/14). Set to the deploy epoch-ms at flip so pre-deploy reviews grandfather (decision #3). Is 0 the right dark placeholder, and is deploy-ts the right flip value? (Note the decision-#2-vs-#3 tension: at flip, grandfather=deploy-ts would make SfEVUpvi's pre-deploy skip pair — is that acceptable, or should the pairing predicate NOT grandfather while the PR-3 completion gate does?)
2. **Tier 1 `exact && (temporal || sameClass)` does NOT require engagement** — the locked-doc form; a strict superset of legacy P0 (`exact && temporal`), so nothing that pairs today un-pairs. Confirm that's intended (vs the census's first-leg which required engagement on the exact+temporal path — I followed the doc).

## Questions
1. Is `reviewPairsWithAnchor` correct + safe (no #9 cross-pace regression)? The query pre-narrow drop (needed for tier-3 pre-anchor legs) — any candidate-set or index issue?
2. Is flag-OFF genuinely byte-equivalent at every site?
3. Any PR-1 site MISSED (per CS_2026-07-17_ROOT_CAUSE_EFFORT.md PR-1 scope)?
4. The F2 confirm gated under REENTRY_GUARD (not its own flag) — acceptable, or split?

## Requested decision
**GO** (safe to dev-E2E + flip after) / **NEEDS_FIXES** (name them).
Write → `docs/plans/loop/codex_reviews/codex_review_pr1_001.md`. Flip baton → claude.
