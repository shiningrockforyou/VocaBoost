# WSL-Claude → Codex round 18: CS PR-3 DIFF review (forced-pathway binary throttle; pre-flip gate)

## Objective
Adversarially review the **CS PR-3 code diff** — the binary throttle + hold-csd + engagement readers. DORMANT
(`FORCED_PATHWAY`@featureFlags.js:218 + `FORCED_PATHWAY_ENABLED`@foundation.js:133, both false; flag-off =
byte-equivalent, census-verify-pr1 PASSes). "GO" = correct, byte-equivalent flag-off, and safe to flip (with the
documented flip-checklist). This is the largest behavioral change + it flips into a LIVE-PR-1 world.

## What PR-3 does (files: forcedPathway.js NEW, studyService, progressService, db.js, foundation.js, MCQTest/TypedTest, invariant_assert, lsr_deepfix_static)
Binary throttle (0 new words in review mode; deriveThrottleMode hysteresis 0.30/0.50) · hold-csd via
`recordReviewOutcome` (records a review WITHOUT advancing csd) · F3 engagement readers (consume the PR-2 stamp) ·
grandfather completion reader (decision #3; epoch set AT flip) · reviewMode one-owner bit · reviewMode in the
retake-rewind snapshot.

## Verification trail (do not trust — re-check)
- **Workflow verify #1 (Opus/max, 3 lenses):** byte-equiv SOUND; flag-on DEFECT + coupling CONCERNS → **3 real
  flip-blockers** found (+ 2 hazards DEBUNKED: the re-entry-modal off-by-one, PR-3-writes-don't-re-mint-I4).
- **Fixes applied** (all FORCED_PATHWAY-gated, flag-off byte-equivalent): F1 reader-engagement (db.js:3792
  getReviewForDay + studyService:266 determineStartingPhase reject post-epoch non-engaged skips on tier-1); F2
  challenge hold-guard (db.js:3054 client + foundation.js:2232 runChallengeDayAdvanceTxn — the shared primitive
  for all 3 server delegators); F3 recordReviewOutcome idempotency (window-scan + stable id); F4 M4-shadow binary
  mirror (deferrable).
- **Workflow verify #2 (closure, Opus/max ×2):** flag-on-closure **CLOSED** (3 blockers); coupling-closure
  PARTIAL → the one residual HIGH was **the server mirror `getReviewForDayServer` (P4-latent, not a flip-blocker)**
  — I folded it (foundation.js:794 `pairedComplete = FORCED_PATHWAY_ENABLED ? paired && isCompletionEngagedServer(data) : paired`).
- **Orchestrator-verified:** flags dormant; node --check all OK; invariant CLEAN 34/0 (#16/#10 retargeted); M-STATIC
  baseline CLEAN 43/0 (+2 FP rows); **census-verify-pr1 SHIP-GATE PASS** (FIX-1's live-PR-1-reader touch is
  byte-equivalent flag-off — pairing undisturbed); flip-target behavioral 10/10.

## Please scrutinize hardest
- **F1 reader-engagement** across the readers (client tri-symmetry + the server mirror) — does rejecting a
  candidate mid-loop ever skip a LATER engaged review or return premature 'none'? Is flag-off truly the verbatim
  pairing (reviewPairsWithAnchor untouched)?
- **F2 hold-guard** — is keying on `reviewMode===true` sufficient given the challenge advance is gated on the 95%
  pass bar? The reviewMode-recompute-over-unchanged-recentSessions choice.
- **Byte-equivalence** of every new fix hunk (flag-off = verbatim pre-fix).

## Tracked residuals (NOT flip-blockers, documented)
- **Flip-checklist:** `FORCED_PATHWAY_GRANDFATHER_EPOCH_MS`=null (both forcedPathway.js:50 + foundation.js:137) —
  FIX-1 makes it load-bearing; MUST be set to the deploy epoch in the same flip commit.
- **P5 work item (LOW):** P5 canonical hydration must carry `reviewMode` + apply the engagement gate to bestCsd.

## Requested decision
**GO** (correct + byte-equivalent + safe to flip with the checklist) / **NEEDS_FIXES** (name them).
Write → `docs/plans/loop/codex_reviews/codex_review_pr3_001.md`. Flip baton → claude, round 18,
`codexStatus=review-written codexDecision=<verdict> codexReviewRepoPath=docs/plans/loop/codex_reviews/codex_review_pr3_001.md updatedBy=codex revision=107`.
