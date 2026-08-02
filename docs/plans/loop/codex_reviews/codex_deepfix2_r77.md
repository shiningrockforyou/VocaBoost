# Codex review — Deepfix2 round 77

**Verdict: YES.** I reviewed committed target `3cb6e40`. Both Round-76 findings are closed against the actual active and fallback writer shapes, the new fixtures discriminate the old failures, and the governing artifact now matches the code. No blocker or high false-green path remains in this checkpoint.

## 1. Legacy consumed evidence is now correctly skipped-aware

`functions/reviewV2/completion.js:340-386` now derives `consumedIsEngine` before validating rows and applies the correct split:

- common validation requires a sane score/denominator, a non-empty row array no longer than the denominator, and recomputes score using the full `totalQuestions` denominator;
- engine evidence retains the complete-rows requirement (`rows.length === totalQuestions`); and
- epoch-less legacy evidence permits the real partial-row shape and validates an integer `skipped` value against the row shortfall.

This matches both deployed writers. With the active server path, `MCQTest.jsx` sends answered rows plus the full test size, and `functions/index.js` stores partial `answers`, full `totalQuestions`, and the difference as `skipped`. The fallback `submitTestAttempt` has the same denominator law.

The lap is discriminating: a 28-row/30-question/score-93 epoch-less review now completes with `postureSource: "completion_legacy"`; the Round-76 implementation would reject it on row count. A mismatched integer `skipped` value refuses, while a short epoch-carrying engine row set refuses through the separate complete-rows reason.

## 2. `resetEpoch` now exclusively selects posture authority

After the engine posture completeness fence, `completion.js:550` selects attempt posture only when `consumedIsEngine`. An epoch-less attempt always uses `completion_legacy`, even if it carries a structurally complete and conflicting posture. The new day-11 fixture asserts both `postureSource: "completion_legacy"` and the completion-time source config's enabled posture, so it fails under the Round-76 `if (gpComplete)` implementation.

`docs/plans/deepfix2/17_DEPLOY_ORDER_REQUIREMENTS.md §6` now states the same three-way law and corrects the prior false writer premise.

## Independent verification

- `origin/main` resolves to the named review target `3cb6e40`.
- The evidence receipt reports 220/220; all 16 SHA-256 prefixes match the current sources. The increase from 217 is exactly the three new discriminators: short engine rows, inconsistent legacy `skipped`, and epoch-less conflicting posture.
- The changed JavaScript files pass `node --check`; `functions` lint passes unmasked; importing `reviewV2/callables.js` succeeds; JSON parses; and `git diff --check 3cb6e40^ 3cb6e40` passes.
- A direct predicate reproduction returns `accepted` for legacy 28/30/93 with `skipped:2`, `skipped_inconsistent` for `skipped:9`, and `engine_rows_incomplete` for the same short engine row set.
- The committed target and READY files remained stable while `turnOwner=codex`.
- I did not rerun the emulator lap because this workspace lacks its `/app` environment, and I did not revive Docker.

One non-blocking precision note: prose says a “present `skipped` field” must match, while code checks consistency when that field is an integer and otherwise treats it like absent legacy metadata. Current writers always emit an integer, and score authority is independently bound to rows/full denominator, so this does not create privilege or a live false-green path. It can be tightened opportunistically without another checkpoint round.

**Codex decision: YES. PRESENTABLE: YES. The Stage-2 checkpoint is converged.**
