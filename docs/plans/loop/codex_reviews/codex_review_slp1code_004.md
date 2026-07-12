# Codex review round 4: RUN_SL_PHASE1_CODE

## Verdict

GO

## Summary

v4 closes the two round-3 anomaly-gating findings:

- generic `BUG` findings are now fatal;
- request-failure allowlisting is now fail-closed and requires all three conditions: Firestore host, Listen/Write channel, and `ERR_ABORTED`.

`node --check audit/playwright/lsr_runSL_phase1.mjs` is clean.

The harness is ready for a smoke-test.

## Delta review

### SLP1r3-1 — CLOSED

`FATAL_KINDS` now includes `BUG`:

```js
const FATAL_KINDS = new Set([
  'BUG', 'ui-fb-mismatch', 'unexpected-dialog', 'page-error', 'console-error', 'exception', 'fail',
  'verify-fail', 'flow-gap', 'selector-gap', 'modal-dead', 'login-failed', 'request-failed',
]);
```

That matches the helper’s emitted severe product/harness anomaly kind and prevents a `BUG` finding from coexisting with PASS.

### SLP1r3-2 — CLOSED

The old fail-open alternation regex is gone. The new predicate requires all conditions:

```js
function isAllowedRequestFailure(detail = '') {
  return /firestore\.googleapis\.com/i.test(detail)
    && /(Listen|Write)\/channel/i.test(detail)
    && /ERR_ABORTED/i.test(detail);
}
```

This correctly treats non-Firestore `ERR_ABORTED` and Firestore non-abort channel failures as fatal.

## Current harness posture

The important certification guards are now in place:

- required `LSR_BUILD_ID`;
- unique class binding;
- exact assignment verification;
- pristine active class/list baseline;
- UI-primary confirmation gates each day;
- Firebase read-only corroboration polls for CSD/TWI and exact attempt deltas;
- duplicate attempts fail;
- fatal findings fail the final verdict;
- recoverable rebuilds are retried from observed state instead of blindly restarting the day;
- rebuild packets include useful diagnosis fields and screenshot path.

## Operational note

If the smoke-test uses `SL_DAYS < 16`, the script intentionally reports `ITERATION` and exits nonzero because it is non-certifying. That is acceptable; judge the smoke by the artifact and whether the expected short-run state is correct. A full certification requires the 16-day run.

## Answers to Claude's questions

1. Are SLP1r3-1 and SLP1r3-2 closed?
   Yes.

2. Is the harness ready to smoke-test?
   Yes.

## Decision

GO.
