# Codex review — PR2_DIFF_REVIEW round 14

Verdict: NEEDS_FIXES

The code diff is close and the syntax checks pass. I do not see a core implementation defect in the strict pairing mirror, score clamp wiring, or canonical cycle-length helper. The blocker is integration/activation: the new PR-2 server flags are added to code and static expectations, but the executable deploy plan still tells the operator to flip exactly the old P3 flag set. That means the PR-2 stamp/clamp can remain dormant even after the supposed PR-2/D2 activation.

## Findings

### HIGH — D2 activation plan omits the two new PR-2 server flags

Evidence:

- `functions/foundation.js:116` adds `REVIEW_ENGAGEMENT_STAMP_ENABLED=false`.
- `functions/foundation.js:122` adds `RECOVERY_SCORE_CLAMP_ENABLED=false`.
- `functions/foundation.js:136-149` exports both through `FOUNDATION_FLAGS`.
- `functions/index.js:426-433` only applies the I6 clamp when `foundation.FOUNDATION_FLAGS.RECOVERY_SCORE_CLAMP_ENABLED` is true.
- `functions/index.js:469` only gets a non-null engagement stamp when `REVIEW_ENGAGEMENT_STAMP_ENABLED` is true through `computeReviewEngagementStamp`.
- `audit/playwright/lsr_deepfix_static.mjs:173-174` says both flip true at the D2 functions deploy.
- But `docs/plans/SESSION_TODO_2026-07-17.md:35` still says D2 flips **EXACTLY** five flags: `SERVER_COMPLETE_SESSION_ENABLED`, `SERVER_RESOLVE_LIST_PROGRESS_ENABLED`, `SERVER_RESET_PROGRESS_ENABLED`, `SERVER_ADVANCE_FOR_CHALLENGE_ENABLED`, `ANCHOR_VALIDATION_SHADOW`.
- `docs/plans/CONSOLIDATED_ROADMAP_2026-07-17.md:66` similarly says P3 activation flips the five server flags including `ANCHOR_VALIDATION_SHADOW=true`.

Why this matters: PR-2’s two live effects — additive review-engagement stamp and server score clamp — are both gated by these new flags. If the operator follows the current D2 instructions, the functions redeploy can contain the code but leave the PR-2 effects off. That violates the handoff claim that stamp+clamp “flip TRUE in the D2 functions-deploy flag set.”

Required fix: update the executable roadmap/TODO and any deploy checklist/static target to define the D2 server flag set consistently. Either:

1. D2 flips seven server flags, adding `REVIEW_ENGAGEMENT_STAMP_ENABLED=true` and `RECOVERY_SCORE_CLAMP_ENABLED=true`; or
2. these two flags have a separate named PR-2 activation step before PR-3/P4, with an explicit gate proving they are live.

Do not leave “EXACTLY five” in the operator-facing plan while the code/static table expects seven.

### MEDIUM — PR-2/PR-3 split is not reflected consistently in the roadmap scope text

Evidence:

- The handoff says hold-csd / `review_recorded` hold-shape and grandfathering are deferred to PR-3.
- `docs/plans/SESSION_TODO_2026-07-17.md:30` still describes C2/PR-2 as including `OC-1 review_recorded/hold-shape`.
- `docs/plans/CONSOLIDATED_ROADMAP_2026-07-17.md:60` also describes PR-2 as including `review_recorded hold-shape`.
- The reviewed PR-2 code does not implement hold-csd / `review_recorded`; it implements strict pairing mirror, engagement stamp, score clamp, and cycling lap-reset mirror.

Why this matters: it creates a false sense that PR-2 already satisfies the server hold-shape prerequisite. If the actual split is “PR-2 stamp/clamp/mirrors now; PR-3 hold-csd/grandfather later,” the roadmap must say that explicitly, especially because P4 is hard-gated on C3/PR-3 anyway.

Required fix: update C2/PR-2 text to remove `review_recorded/hold-shape`, or mark it explicitly as PR-3-owned. Keep the P4 hard gate on PR-3 soaked.

## Implementation notes / answers

- OC-4 canonical cycle length: `getCanonicalCycleLengthServer()` using `lists/{listId}/words.count()` is the right modulus source. Reading it before the transaction is acceptable for this purpose; a concurrent word-list mutation during a session completion would be an administrative/content-change race, not a student-progress transaction invariant. Returning `0` fail-safes by disabling lap reset.
- `pairMs` parity: the current implementation matches the client `tsMillis` shape. If malformed timestamp access throws, `getReviewForDayServer` catches it and returns `query-error`, preserving CSD rather than pairing open. That direction is safe.
- PR-2/PR-3 split: deferring grandfathering out of pairing is correct after PR-1. Deferring hold-csd to PR-3 is acceptable only if roadmap/TODO wording is corrected and P4 remains gated on PR-3.
- Dormant code posture: with both new flags false, the stamp and clamp are dormant. That preserves flag-off behavior, but it makes the activation-plan mismatch above blocking.

## Checks run

- `node --check functions/foundation.js` — clean
- `node --check functions/index.js` — clean
- `node --check audit/playwright/lsr_deepfix_static.mjs` — clean

## Required before GO

Fix the D2 activation flag set / deployment wording and the PR-2-vs-PR-3 scope text. Then re-submit for a narrow re-review.
