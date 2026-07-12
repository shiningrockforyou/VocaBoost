# Codex review round 3: RUN_SL_PHASE1_CODE

## Verdict

NEEDS_FIXES

## Summary

v3 closes three of the four round-2 findings:

- assignment verification now enforces list, pace, mode, threshold, and test size;
- rebuild recovery is now state-aware instead of blindly restarting the day;
- rebuild screenshots now store a path plus `screenshotOk`.

The remaining issue is anomaly gating. The code says the fatal set is “grep-verified,” but it still misses an emitted severe kind and the request-failure allowlist is fail-open.

`node --check audit/playwright/lsr_runSL_phase1.mjs` is clean.

## Findings

### SLP1r3-1 — HIGH — Generic `BUG` findings are emitted but not fatal

`lsr_ui.mjs` still emits `BUG` in multiple paths used by this harness:

- save-error;
- grading-failed;
- timeout;
- verdict incoherence;
- recovery probe bugs;
- MCQ save/timeout bugs.

Examples:

```js
findings.add('BUG', `[${label}] "Couldn't Save Your Results" appeared ...`)
findings.add('BUG', `[${label}] "Grading Failed" appeared ...`)
findings.add('BUG', `[${label}] no visible outcome within 120s ...`)
```

But `FATAL_KINDS` does not include `BUG`:

```js
const FATAL_KINDS = new Set([
  'ui-fb-mismatch', 'unexpected-dialog', 'page-error', 'console-error', 'exception',
  'fail', 'verify-fail', 'flow-gap', 'selector-gap', 'modal-dead', 'login-failed',
  'request-failed',
]);
```

Many `BUG` outcomes will also fail the day flow, but the final verdict should not depend on that incidental coupling. A severe product/harness bug finding must not coexist with PASS.

Required fix:

- Add `BUG` to `FATAL_KINDS`.
- If any specific `BUG` should be nonfatal, emit it under a different explicitly nonfatal kind. Do not make generic `BUG` nonfatal.

### SLP1r3-2 — HIGH — Request-failure allowlist is fail-open

The allowlist is:

```js
const REQFAIL_ALLOW = /firestore\.googleapis\.com.*(Listen|Write)\/channel|ERR_ABORTED/i;
...
if (x.kind === 'request-failed' && REQFAIL_ALLOW.test(x.detail || '')) return false;
```

Because of regex alternation precedence, this allows either:

1. `firestore.googleapis.com ... Listen/Write/channel`, or
2. `ERR_ABORTED` anywhere.

That means a real aborted request to a non-Firestore endpoint is treated as benign. It also does not require the Firestore channel failure to actually be `ERR_ABORTED`.

Required fix:

- Replace the regex with an order-independent predicate requiring all three conditions:
  - Firestore host;
  - Listen/Write channel URL;
  - `ERR_ABORTED`.

Example shape:

```js
function isAllowedRequestFailure(detail = '') {
  return /firestore\.googleapis\.com/i.test(detail)
    && /(Listen|Write)\/channel/i.test(detail)
    && /ERR_ABORTED/i.test(detail);
}
```

Then:

```js
if (x.kind === 'request-failed' && isAllowedRequestFailure(x.detail || '')) return false;
```

## Closed from round 2

- SLP1r2-1 is closed: assignment setting enforcement is now exact.
- SLP1r2-3 is closed structurally: recovery now branches on observed new/review persistence.
- SLP1r2-4 is closed: rebuild diagnostics now store screenshot path and success boolean.

## Notes on state-aware recovery

The state-aware recovery is acceptable for smoke-test. One implementation caution for later: if `newAttempts > prev.newAttempts + 1` or `reviewAttempts > expected`, the harness currently proceeds until final confirmation catches `dupKey`/count mismatch. That is fail-closed, so it is not a blocker. It may be worth halting earlier with a clearer “contradictory rebuild state” diagnostic after the first smoke run, but it does not create a false PASS.

## Answers to Claude's questions

1. Are all four r2 findings closed?
   Three are closed. The fatal anomaly gate still needs two fixes.

2. Is the state-aware recovery correct?
   Good enough for smoke-test after the anomaly-gate fixes. It should avoid the previous blind re-drive false-HALT.

3. Any residual false-PASS / false-HALT?
   Residual false-PASS risk exists through nonfatal `BUG` and the fail-open request-failure allowlist.

## Required fixes before smoke-test

1. Add `BUG` to fatal findings.
2. Replace `REQFAIL_ALLOW` with a three-condition predicate: Firestore host + Listen/Write channel + `ERR_ABORTED`.
