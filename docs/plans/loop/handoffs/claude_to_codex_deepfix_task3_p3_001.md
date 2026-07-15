# Claude → Codex: DEEPFIX Task 3 — review the P3 foundation server-surface DRAFT

> **TASK = DEEPFIX_TASK3_P3, round 1.** The deepfix FIX_PLAN's Phase P3 (FND-1, the additive server surface) is
> implemented as a REVIEWED DRAFT (dormant behind server flags; cannot be execution-tested in Claude's WSL env —
> that's Task 6). Review it against the plan + the current code, ADJUDICATE the drafter's 14 flagged uncertainties,
> and find correctness/security defects. This gates whether P4-P7 (which build on P3's design) can proceed. Write
> `/out/reviews/codex_deepfix_task3_p3_001.md`, VERDICT (+ CONVERGED-OK if clean), flip turnOwner→claude.

## BINDING RULE (David): "always verify all claims… Never trust blindly. Always verify."
Trace every integration claim to `/repo` `file:line`. The draft's own `[V-P]` tags are not proof — check them.

## Read
- The DRAFT: `/repo/functions/foundation.js` (NEW, ~1670 lines) + `/repo/audit/deepfix/task3/phase3_diff.patch`
  (incl. the `functions/index.js` hooks: M4 shadow, W2 marker upgrade, nonce F2, re-exports).
- The DRAFTER'S NOTES + 14 UNCERTAINTIES: `/repo/audit/deepfix/task3/P3_impl_notes.md` — ADJUDICATE these.
- The SPEC: `/repo/audit/deepfix/task2/FIX_PLAN.md` **P3 · FND-1** (+ the F4-1/F4-2/F5-HIGH-2/C-14 folds) +
  `/repo/audit/deepfix/task1/investigations/inv_I6_foundation.md` (M3-M7) + `inv_I2_reviewonly_matrix.md` (S1-S10).
- Current code to check against: `functions/index.js` (patterns; `GRADE_TOKEN_ENFORCED=false` at :66 must be
  preserved), `src/services/progressService.js` (legacy recon WRITE :255-271, day-guard :441-452, recordSessionCompletion),
  `src/services/studyService.js` (client `reviewOnlyDay` predicate :1329-1335, all 3 reasons), `src/services/db.js`
  (anchor :3239, reviewChallenge twi writer :2790-2833, review pairing :3440-3450).

## Adjudicate + verify (priority order)
1. **U5 (BLOCKER-adjacent): the read-only `resolveListProgress` return shape vs the day-guard.** The drafter
   returns the LAUNCH-doc view as primary (merged alongside) to avoid a merged-csd > launch-csd day-guard-REJECT
   of every completion (the F4-1 failure class). Is that CORRECT, or should it return the merged view (plan text)?
   Trace `completeSession`'s day-guard read vs what the legacy recon write (F4-1 fold) sets on the launch doc.
   **This is the load-bearing correctness question — get it right.**
2. **U1: server `reviewOnlyDay` reason-3.** The drafter derives reason-3 (REVIEW_STUDY resume) server-side as
   "day's new-pass absorbed into stored twi (nwei ≤ twi−1)". Does that faithfully replicate the client predicate's
   `startPhase===REVIEW_STUDY` (studyService.js:1329-1335) for the #9 cross-class-resume case (no twi
   double-introduce)? What fixture diff-check would prove it?
3. **`completeSession` correctness:** transactional day-guard (stronger than the read-then-write at
   progressService.js:441-452?), allocation recompute from own state, `wordsIntroduced=max(0,…)`, recentSessions
   append (null new-word fields on review-only), retry-idempotency (committed-but-lost). Any race/hole?
4. **`resolveListProgress` READ-ONLY mode:** does it PRESERVE today's legacy class_progress recon write (F4-1)
   AND create ZERO canonical `list_progress` docs (the Codex-r1/r2 blocker)? Confirm both.
5. **U8 (reset epoch location), U10 (challenge twi phase-gate), + the other 10 uncertainties** — adjudicate each
   (accept / needs-change with file:line).
6. **Dormancy:** confirm all 7 foundation flags are `false` and NO existing live path changes behavior (the M4
   shadow is log-only; W2/nonce are additive). Confirm `GRADE_TOKEN_ENFORCED=false` preserved.

Per-finding: `severity · location (foundation.js:line / plan §) · problem · evidence · fix`. End with
`VERDICT blockers=<n> high=<n> med=<n> nits=<n>` (+ CONVERGED-OK if 0/0). GO = the draft's DESIGN is sound to
build P4-P7 on (impl details can be nits); NEEDS_FIXES = a design defect that P4-P7 would inherit.
