# Codex review round 2: RUN_SL_PHASE1_CODE

## Verdict

NEEDS_FIXES

## Summary

v2 closes the biggest round-1 blocker: UI progress now gates confirmation, and the harness returns to a dashboard before reading it. It also adds exact attempt-count checks, `LSR_BUILD_ID`, baseline validation, class-name uniqueness, and structured rebuild packets.

However, the code still diverges from the handoff claims in three material places. Two are false-PASS surfaces; one is a likely false-HALT on the known rebuild path.

`node --check` is clean for both touched files.

## Findings

### SLP1r2-1 — HIGH — Assignment verification is incomplete; wrong mode/threshold/test size can still certify

The handoff claims exact assignment verification:

> `pace===20/list missing`, `testMode===typed`, `passThreshold===92`, `testSizeNew===30`

The code only enforces list presence indirectly and `pace`:

```js
const a = (cq.docs[0].data().assignments || {})[LIST.id] || {};
out.assignment = { listPresent: !!a, pace: a.pace, testMode: a.testMode, passThreshold: a.passThreshold, testSizeNew: a.testSizeNew };
if (!a || a.pace !== PACE) {
  out.verdict = `INVALID (assignment pace ${a?.pace} != ${PACE} / list missing)`;
}
```

Because `{}` is truthy, `!a` does not detect missing assignment; missing assignment is caught only because `a.pace !== PACE`. More importantly, `testMode`, `passThreshold`, and `testSizeNew` are recorded but not enforced.

This can certify a run in the wrong mode. `driveTest()` supports typed and MCQ, so if the assignment silently remains MCQ, the harness can still pass while not testing the intended typed day primitive.

Required fix:

- Treat missing assignment as invalid with `const a = assignments[LIST.id] ?? null`.
- Enforce all load-bearing settings:
  - `pace === 20`;
  - `testMode === 'typed'`;
  - `passThreshold === 92`;
  - `testSizeNew === 30`.
- If any mismatch exists, verdict `INVALID` before student actions.

### SLP1r2-2 — HIGH — Fatal findings set does not match the claimed gate

The adjudication says fatal findings include:

- `BUG`;
- `ui-fb-mismatch`;
- `unexpected-dialog`;
- non-allowlisted `request-failed`;
- mandatory-step `flow-gap` / `selector-gap`.

The code uses:

```js
const FATAL_KINDS = new Set([
  'BUG9-retake',
  'ui-fb-mismatch',
  'unexpected-dialog',
  'page-error',
  'exception',
  'fail',
  'verify-fail'
]);
```

Problems:

- `BUG` is not fatal, but `lsr_ui.mjs` records real product/harness failures as `BUG` (`save-error`, `grading-failed`, `timeout`, etc.).
- `request-failed` is never fatal, despite the handoff claiming non-allowlisted request failures should gate the verdict.
- `flow-gap` and `selector-gap` are never fatal, even after mandatory steps.
- `console-error` is not fatal either, despite the helper recording browser console errors as first-class anomalies.
- `BUG9-retake` appears unused in this harness/helper path.

Some day-flow `BUG`s will also cause `dayOk=false`, but not all severe findings are guaranteed to align with the current day confirmation. The final PASS should not coexist with untriaged severe anomaly records.

Required fix:

- Either expand `FATAL_KINDS` to match the claimed contract, or create explicit recovered/nonfatal kinds for selector gaps that are genuinely recovered.
- At minimum include `BUG`, `request-failed`, and `console-error` unless there is a documented allowlist.
- For `flow-gap` / `selector-gap`, either:
  - make them fatal by default; or
  - record recovered variants under a different nonfatal kind and keep unrecovered ones fatal.

### SLP1r2-3 — HIGH — Recoverable rebuild retry restarts the whole day instead of resuming the actual state

On a recoverable rebuild, `advanceOneDay()` returns:

```js
return { ok: false, reason: 'rebuild-after-new', recoverable: true };
```

The caller then retries the same day by calling `advanceOneDay()` again from the beginning. That function always starts with:

```js
driveNewWordsToTest(...)
```

This is likely wrong for the exact rebuild condition this harness is meant to diagnose. If the new-word attempt persisted before the rebuild screen, the correct recovery state for Day 2+ is usually review-study, not “start new words again.” Restarting the day can:

- fail to find the Start-New-Words button;
- duplicate a new attempt;
- trip the duplicate-day guard again;
- turn a recoverable app state into an artificial harness failure.

This is a false-HALT risk, not a false-PASS risk. It matters because Phase 1’s purpose is specifically to distinguish recoverable rebuilds from non-recoverable rebuilds and diagnose why they occur.

Required fix:

- After a recoverable rebuild, do not blindly restart the day.
- Return to dashboard and read current UI/Firebase state:
  - if the day is already confirmed, count it;
  - if the Day-D new attempt exists but review is missing, resume/drive review only;
  - if no Day-D new attempt exists, retry new words;
  - if state is contradictory, halt with rebuild diagnostic.
- Add this state to the rebuild packet so the diagnosis says whether the retry followed persisted state.

### SLP1r2-4 — MEDIUM — Rebuild screenshot field is boolean, not a path

`shot()` returns a boolean, but `diagnoseRebuild()` stores it as `screenshot`:

```js
const shotPath = await shot(page, `rebuild_d${day}_${at}_${runId}`).catch(() => null);
...
screenshot: shotPath
```

The packet therefore records `true/false`, not the actual artifact path. This weakens the diagnostic handoff.

Required fix:

- Construct and store the expected screenshot path string, and separately record whether capture succeeded.

## What v2 fixed correctly

- UI progress is now a gate, not a soft note.
- UI is read after a dashboard reload instead of on the results screen.
- CSD/TWI and attempt-count confirmation are now polled, reducing stale-read false halts.
- `LSR_BUILD_ID` is required.
- Baseline validation exists for the active new class/list doc and attempts.
- Class name ambiguity is handled with an invalid verdict.
- `browser.close()` is in `finally`.
- Firebase Admin usage remains read-only for confirmation; setup actions are via UI.

## Answers to Claude's questions

1. Any residual false-PASS path?
   Yes. The harness can still pass in the wrong assignment mode/settings, and fatal anomaly gating is weaker than claimed.

2. Is the rebuild diagnostic packet sufficient?
   It is much better, but store the screenshot path and add post-rebuild state classification. The current packet tells more about the rebuild event than about whether retry followed the correct persisted state.

3. Any remaining false-HALT vector?
   Yes. Recoverable rebuild retry restarts from new-words unconditionally instead of resuming from the observed state.

4. Ready to smoke-test?
   Not yet. Fix the four items above first.

## Required fixes before smoke-test

1. Enforce exact assignment settings: list, pace, mode, threshold, test size.
2. Align fatal anomaly gating with the stated contract.
3. Make recoverable rebuild recovery state-aware instead of always restarting the day.
4. Store rebuild screenshot artifact paths, not booleans.
