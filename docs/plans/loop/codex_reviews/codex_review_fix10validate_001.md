# Codex Review — FIX10_VALIDATION_ADJUDICATE round 1

## Verdict

FINALIZE-3/4

## Scope reviewed

- Handoff: `docs/plans/loop/handoffs/claude_to_codex_fix10overlay_adjudicate_001.md`
- Results summary: `docs/plans/loop/fix10/OVERLAY_RESULTS.md`
- Build/run log: `audit/playwright/FIX10_OVERLAY_BUILD_LOG.md`
- Code traced:
  - `src/pages/TypedTest.jsx`
  - `src/pages/MCQTest.jsx`
  - `src/services/studyService.js`

This is an adjudication of validation sufficiency, not a new code review.

## Decision

The 3/4 green overlay is sufficient to validate Fix #10. The missing TD2 cell is useful literal matrix coverage, but it is redundant for the specific #10 root cause.

I would not block moving on solely to force the fourth cell.

## Evidence reviewed

Live overlay on production build `a967f54`:

- TD1 — `TypedTest.jsx` Day-1 new-final: green.
- MD1 — `MCQTest.jsx` Day-1 new-final: green.
- MD2 — `MCQTest.jsx` Day-2 review-final: green.
- TD2 — `TypedTest.jsx` Day-2 review-final: unmeasured because the driver could not reach the typed review test.

The important part is that the measured green cells are not CSD/TWI-only evidence. The overlay’s green oracle checks the discriminating fingerprints:

- no rebuild/session-refreshed UI;
- results/pass reached;
- `recentSessions` gained exactly one entry;
- exactly one new `users/{uid}/sessions` doc;
- `session_states` reached `complete`;
- zero day-guard rejection logs;
- zero in-window `csd_twi_reconciled`.

That is the correct evidence family for #10.

## TypedTest trace

In `TypedTest.jsx`, the #10 fix is in one shared completion block:

- `TypedTest.jsx:971-973` computes `isSessionFinalTest`.
  - Day 1: final if `currentTestType === 'new'`.
  - Day 2+: final if `currentTestType === 'review'`.
- `TypedTest.jsx:976` enters the shared final-completion block.
- `TypedTest.jsx:983-985` performs the fixed non-reconciling read:

```js
const progress = LIST_SCOPED_RECON
  ? await getClassProgress(user.uid, classIdParam, listId)
  : (await getOrCreateClassProgress(user.uid, classIdParam, listId)).progress;
```

- `TypedTest.jsx:991-1019` writes the pre-completion snapshot if the progress doc exists.
- `TypedTest.jsx:1022-1037` calls `completeSessionFromTest`.
- `TypedTest.jsx:1040-1057` handles retake-gate and day-guard rebuild sentinels.

There is no separate TypedTest review-specific implementation of the #10 fix. TD1 exercises the same fixed snapshot-read and snapshot-write code that TD2 would exercise.

## Review-specific logic

There is review-specific logic, but it is not a TypedTest-specific #10 risk:

1. `passed` is computed differently:
   - `TypedTest.jsx:817`: review tests always pass.
   - This only decides whether the shared completion block runs.

2. Day-2 completion has the new-word-pass gate:
   - `studyService.js:1355-1401`.
   - MD2 already exercised the Day-2 review-final path through this gate successfully.

3. Day-2 review writes review score and may graduate words:
   - `studyService.js:1405-1410`, `1444+`.
   - This is inside the shared service path, not the page-level snapshot-race fix.

None of those introduce a typed-review-only path that would call `getOrCreateClassProgress` in the fixed snapshot window or otherwise recreate #10.

## Residual risk assessment

The residual risk TD2 would cover is not “is Fix #10 implemented in TypedTest review-final?” The implementation trace answers that: it is the same block TD1 already covered.

The residual risk is harness/product navigation coverage: can the audit reliably drive a typed review-final UI session. That is useful, but it is not necessary to declare the #10 root problem fixed.

Coverage achieved by the 3 green cells:

- Typed file-level fixed block: TD1.
- MCQ file-level fixed block: MD1 and MD2.
- Day-1 new-final completion type: TD1 and MD1.
- Day-2 review-final completion type and service gate: MD2.
- Typed AI-grading latency path: TD1.
- Discriminating completion fingerprints: all green cells.

That covers the root cause: post-attempt pre-completion reconciliation racing the day guard.

## Notes on TD2

TD2 being unmeasured should stay documented as a harness limitation. If later work specifically targets typed-review navigation or review UI coverage, it is reasonable to harden the driver and obtain 4/4.

But for Fix #10 closure, requiring TD2 would be process purity rather than risk-based validation. The unmeasured cell did not false-pass; the harness failed closed.

## Final answer

VERDICT: FINALIZE-3/4
