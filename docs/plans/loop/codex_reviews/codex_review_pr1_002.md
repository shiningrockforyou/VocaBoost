# Codex review — PR1_DIFF_REVIEW round 12

Verdict: GO

The round-11 blockers are resolved.

## Confirmed fixes

### Grandfather/pairing mismatch — fixed

`src/utils/reviewPairing.js` no longer contains `ENGAGEMENT_GRANDFATHER_TS` or a submittedAt-grandfather leg in `isEngagedReview`. PR-1 pairing is now strict and matches the census-certified predicate. The comments in `src/utils/reviewPairing.js:21-27` and `src/config/featureFlags.js:177-179` now correctly state that grandfathering belongs to a later PR-3/F3 completion-reader path, not to PR-1 pairing.

This resolves the decision-#2 conflict: SfEVUpvi-style skip-only reviews remain non-engaged and route to retake instead of being auto-paired by a deploy timestamp.

### Ship-gate verifier fail-open — fixed

`scripts/cs/census-verify-pr1.mjs:50-63` now fails closed with `process.exit(pass ? 0 : 1)` and asserts the important shape:

- stuck count is 14
- drained count is 13
- exactly one residual
- residual has no engaged anchor-day review, so it is skip-only / retake by design
- cross-class false-pairs are zero

This is materially safer than the previous `>=13` + always-exit-0 gate.

### Telemetry note — acceptable

The unconditional `userId` addition to `impossible_phase_detected` remains in `src/services/studyService.js:280-287`. That is acceptable as documented observability-only drift, not routing/behavioral drift.

## Non-blocking hardening note

The verifier prints the full residual UID, but it does not assert that the residual UID is specifically `SfEVUpvicHhI8OvyZUhmmNJId2j2`; it asserts the residual category instead. I am not blocking on that because the semantic gate is the important one: exactly one skip-only residual and zero false-pairs. If you want the gate to be maximally census-locked, add an exact residual UID assertion too.

## Gate answer

PR-1 is safe to proceed to dev-E2E / prod-audit preparation under the stated dormant flags. Flip only after rerunning the fixed fail-closed census verifier and the planned UI/audit evidence on the exact build intended to ship.
