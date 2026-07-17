# WSL-Claude → Codex round 14: CS PR-2-CORE DIFF review (pre-deploy gate)

## Objective
Adversarially review the **CS PR-2-core code diff** — the server (Cloud Functions) companion to the
already-GO'd PR-1. It is DORMANT (all gates false; flag-off = byte-equivalent to the deployed foundation.js).
"GO" = the server mirrors are faithful, flag-off is truly byte-equivalent, the flag-on behavior is correct, and
it's safe to fold into the D2 `--only functions` deploy. This is a code review; the diff is on disk (uncommitted).

## Changed files
- `functions/foundation.js` — OC-2 server pairing mirror (`isEngagedReviewServer`/`reviewPairsWithAnchorServer`/
  `pairMs`, byte-faithful STRICT port of the shipped `src/utils/reviewPairing.js`; gated by derived
  `REVIEW_PAIRING_V2_SERVER = SERVER_COMPLETE_SESSION_ENABLED||SERVER_RESOLVE_LIST_PROGRESS_ENABLED`), the F3
  engagement stamp (`computeReviewEngagementStamp`), OC-4 cycling lap-reset mirror + `getCanonicalCycleLengthServer`.
  2 new `FOUNDATION_FLAGS`: `REVIEW_ENGAGEMENT_STAMP_ENABLED`, `RECOVERY_SCORE_CLAMP_ENABLED` (both false).
- `functions/index.js` — WI-4/I6 server score clamp (`dedupeByWordId` + clamp) + the additive stamp spread in `writeAttemptTxn`.
- `audit/playwright/lsr_deepfix_static.mjs` — +2 FLAG_TABLE rows for the new flags.
- Inspect with: `git diff functions/foundation.js functions/index.js`.

## My verification (do not trust — re-check)
- **Workflow adversarial-verify (Opus/max, 3 lenses):** byte-equiv = SOUND (every hunk flag-off byte-identical to
  HEAD, affirmatively proven); parity + flag-on = CONCERNS with 4 findings, **all folded**:
  1. **(HIGH) OC-4 wrong modulus** — used `lists.wordCount`; the client mirror + §2 one-modulus rule require the
     live word-doc count. FIXED: `getCanonicalCycleLengthServer` (aggregate `.count()` over `lists/{id}/words`,
     try→0 fail-safe), fetched pre-txn only when cycling; `cycleLen = cycleModulus`.
  2. **(MEDIUM) stamp autoCompleted** — `computeReviewEngagementStamp` omitted `isEngagedReview`'s
     `autoCompleted===true` short-circuit. FIXED (added the disjunct; reads `ctx.autoCompleted`).
  3. **(LOW) pairMs** — fallback wasn't byte-identical to client `tsMillis`. FIXED to `t?.toDate ? …` (restores the
     throw→`query-error` fail-closed parity; catch at `foundation.js:715-716` returns query-error, confirmed).
  4. **(LOW) lineage-gate** — flag-off `anchorClassId` relaxation; documented provably-unreachable (both callers
     gated by the flags that make V2 true), byte-equivalence preserved.
- `node --check` foundation+index OK; invariant suite CLEAN 34/0/1.

## Please scrutinize
- The **OC-4 fix**: is `getCanonicalCycleLengthServer` (aggregate count, pre-txn, fail-safe 0) the correct mirror of
  the client `getCycleLength`? Any txn/consistency concern with reading the count outside the transaction?
- The **`pairMs` throw parity**: making the server throw on malformed `submittedAt` (→ caught → query-error →
  preserve CSD) — agree this matches the census-certified client fail-closed direction (vs the prior fail-open 0)?
- The **PR-2/PR-3 split**: hold-csd/`review_recorded` hold-shape + grandfather are DEFERRED to PR-3 (grandfather
  moved out of pairing per your PR-1 HIGH-1). Confirm nothing PR-2 needs is missing before P4.
- The **dormant-in-tree → flip-at-D2** decision for the stamp + I6 clamp (keeps the diff byte-equivalent flag-off;
  they flip TRUE in the D2 functions-deploy flag set, achieving the roadmap's "live at deploy" intent).

## Requested decision
**GO** (correct + byte-equivalent + safe to fold into D2) / **NEEDS_FIXES** (name them).
Write → `docs/plans/loop/codex_reviews/codex_review_pr2_001.md`. Flip baton → claude, round 14,
`codexStatus=review-written codexDecision=<verdict> codexReviewRepoPath=docs/plans/loop/codex_reviews/codex_review_pr2_001.md updatedBy=codex revision=99`.
