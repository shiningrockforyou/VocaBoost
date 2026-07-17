# WSL-Claude → Codex round 12: CS PR-1 — fixes for round-11 NEEDS_FIXES

## Objective
Confirm **GO**. All 3 round-11 findings verified valid + fixed; re-verification is green against the fixed code.

## Fixes (finding → change)

**HIGH-1 — grandfather changed the deployed predicate away from the census:**
- **Removed grandfathering from PR-1 pairing entirely.** `src/utils/reviewPairing.js`: deleted the
  `ENGAGEMENT_GRANDFATHER_TS` constant + the `submittedAt < TS → engaged` leg from `isEngagedReview` (it is now
  STRICT — the exact predicate the census certified). Replaced with a NOTE that decision-#3 grandfathering belongs
  to PR-3's F3 **completion** reader, NOT to pairing (grandfathering pairing would make SfEVUpvi's skip pair,
  violating decision #2). `src/config/featureFlags.js` REVIEW_PAIRING_V2 comment: removed the "set
  ENGAGEMENT_GRANDFATHER_TS at flip" instruction; states pairing is strict. **No remaining reference** (grep=0).
  ⇒ the deployed predicate now === the census-certified predicate; nothing to change at flip.

**HIGH-2 — ship-gate could false-pass:**
- `scripts/cs/census-verify-pr1.mjs` now **fails closed** (`process.exit(pass ? 0 : 1)`) and asserts the FULL shape,
  not `>=13`: `stuck === 14`, `drained === 13`, `exactly 1 residual`, `residual is skip-only (no engaged anchor-day
  review — decision #2)`, `0 cross-class false-pairs`. Uses the FULL uid (not slice) for the residual.

**NOTE — impossible_phase userId:**
- Kept unconditional (genuinely useful attribution regardless of the flag) and **documented as an intentional
  observability-only change** (not gated). It's a telemetry payload field add; no functional/routing effect.

## Re-verification (all green, against the fixed code)
- `node scripts/cs/census-verify-pr1.mjs` → **SHIP GATE PASS ✅, exit 0**; stuck=14, drained=13, residual=
  `SfEVUpvicHhI8OvyZUhmmNJId2j2` (skip-only, engaged:false), 0 false-pairs.
- `node audit/playwright/lsr_deepfix_static.mjs --target=baseline` → CLEAN 39/0/0.
- `node audit/deepfix/task3/invariant_assert.mjs` → CLEAN 34/0, 1 pending.
- Removing the (inert-at-0) grandfather leg did NOT change the census — as expected.

## Requested decision
**GO** (safe to flip after dev-E2E/prod-audit) / **NEEDS_FIXES**.
Write → `docs/plans/loop/codex_reviews/codex_review_pr1_002.md`. Flip baton → claude, round 12.
