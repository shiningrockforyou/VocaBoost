# Codex review — PR1_DIFF_REVIEW round 11

Verdict: NEEDS_FIXES

The code is directionally right: the pairing predicate is centralized, the main reader asymmetry is addressed, the re-entry guard is flag-gated, and recovery intersection is a reasonable client-side I6 leg. I would not flip this yet. Two gate-level issues can make the deployed behavior differ from the verified census or let the ship-gate script pass when it should fail.

## Findings

### HIGH — The grandfather timestamp changes the deployed pairing predicate away from the verified census

Evidence:

- `src/utils/reviewPairing.js:21-33` defines `ENGAGEMENT_GRANDFATHER_TS = 0` and says this strict mode is what the census validated.
- `src/config/featureFlags.js:177-178` and `src/utils/reviewPairing.js:29-30` instruct the operator to set `ENGAGEMENT_GRANDFATHER_TS` to the PR-1 deploy epoch at flip time.
- `src/utils/reviewPairing.js:80-88` makes any review with `submittedAt < ENGAGEMENT_GRANDFATHER_TS` engaged.
- `src/utils/reviewPairing.js:130-137` lets same-class engaged reviews pair on relaxed temporal/stub/null legs.
- The handoff says the live verification was run with `ENGAGEMENT_GRANDFATHER_TS = 0`, producing 13/14 drain + 1 skip-only retake.

Why this matters: if the constant is changed to the deploy timestamp before flipping `REVIEW_PAIRING_V2`, every pre-deploy review becomes engaged for PR-1 pairing, including the skip-only residual that David decided should route to a real retake. That is not the predicate the census certified. The code comments and flag comments currently tell the operator to deploy a different predicate from the measured one.

Required fix: separate the policies or lock the exact flip value. Acceptable options:

1. Keep PR-1 pairing strict: do not grandfather inside `reviewPairsWithAnchor`; leave `ENGAGEMENT_GRANDFATHER_TS = 0` for PR-1 and update comments/runbook so the operator does not change it at flip.
2. If grandfathering is still required for later F3 completion readers, use a separate constant/function for that later reader path, not the PR-1 pairing predicate.
3. If you intentionally want PR-1 pairing to grandfather, rerun the census with the deploy-timestamp behavior and update the expected gate/result, including the skip-only residual decision.

Until this is resolved, the “13/14 + one retake” evidence does not certify the actual flip instructions.

### HIGH — `census-verify-pr1.mjs` can false-pass the ship gate

Evidence:

- `scripts/cs/census-verify-pr1.mjs:49` prints PASS when `drained.length >= 13 && falsePairs.length === 0`.
- `scripts/cs/census-verify-pr1.mjs:50` always exits `0`, even when the gate prints `CHECK ✗`.
- The gate does not assert the expected stuck denominator (`14`), the exact drained count (`13`), or that the residual is the known by-design skip-only student.

Why this matters: this is described as the SHIP GATE. As written, it can return success to any caller even on failure. It can also print PASS with many unexpected residual stuck students, as long as at least 13 drain and false-pairs are zero.

Required fix:

- Exit nonzero on gate failure.
- Assert the full expected shape, not only `>=13`: expected stuck count, expected drained count, expected residual identity/category, and zero false-pairs.
- Prefer recording full stable identifiers in the check, not only `uid.slice(0, 8)`, so the residual assertion cannot collide.

### NOTE — Strict “flag-off byte-equivalence” is slightly overstated

Evidence:

- `src/services/studyService.js:280-287` adds `userId` to the `impossible_phase_detected` log payload unconditionally, outside any PR-1 flag.

This is not a behavioral defect and I would not block on it by itself. But the handoff claims all behavior is flag-gated and byte-equivalent; strictly speaking, telemetry payload shape changes flag-off. Either gate it or call it an intentional unconditional observability-only change.

## Question answers

1. `reviewPairsWithAnchor` is structurally aligned with the locked tiered predicate, but the grandfather timestamp must be resolved before it is safe to flip.
2. Flag-off runtime behavior looks mostly byte-equivalent at the functional sites; the unconditional log payload change should be documented or gated.
3. I did not find an obvious missed PR-1 reader site in the changed scope. Foundation mirrors are correctly left to PR-2 per the roadmap, not this diff.
4. F2 under `REENTRY_GUARD` is acceptable as a packaging choice, since it is client-display-only and PR-1 ships as a bundle of three flags. The risk is operational clarity, not correctness.

## Required before GO

Fix the grandfather/census mismatch and make the verifier fail closed. Then rerun the ship-gate evidence against the exact predicate intended for flip.
