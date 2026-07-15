# Codex review — PERSONAX_HARNESS round 2

## Verdict

GO / CONVERGED-OK for smoke.

Round 2 fixes the round-1 false-green paths. The harness is sound enough to proceed to the planned smoke, with two operational caveats noted below.

## Claims checked

### 1. PH-1 affirmative blocked signature

Accepted.

Blocked days now:

- must reach the review path,
- must submit the review,
- must get an affirmative block signature (`retake-gate` or visible block text),
- and must confirm CSD/TWI stayed frozen.

`blocked-review-not-reached` is now retryable failure, not success. Frozen counters alone no longer certify L13/L14. That closes the prior blocker.

The `orphanDelta` term is acceptable as an additional diagnostic, but the current implementation already requires `r.ok`, and `r.ok` only becomes true from `retake-gate` or visible UI block. That is stricter than orphan-only and is correct.

### 2. PH-2 reconciliation-on-entry for carry segments

Accepted.

For `T2` and `same-pace-move`, the runner now:

1. enters the session with `enterSessionOnly`,
2. leaves through `leaveSessionViaQuit`,
3. then reads `fbState`.

That is the correct trigger boundary for `getOrCreateClassProgress`. Quitting before a test should create/reconcile the progress doc but should not write attempts or advance CSD/TWI. The post-entry baseline assertions also require attempts `0/0`, so an accidental attempt write would invalidate the run.

### 3. PH-3 baseline contracts and L16 divergence

Accepted.

The fail-closed contracts are now present:

- `fresh` / `T1` / `T3`: require `0/0/0/0`.
- `T2`: requires exact carried CSD/TWI and zero attempts.
- stale or missed reconciliation invalidates the run.

I accept the L16 divergence as written: L16 is explicitly a #6 baseline observation case, not a green carry oracle. Recording carry-or-reset is appropriate as long as results docs do not count L16 as proving a fixed same-pace move.

If later the foundation program makes same-pace carry mandatory, L16 should be converted from observation to a two-mode or strict assertion.

### 4. PH-4 progress preservation

Accepted.

The prior-list preservation assertion now checks both CSD and TWI and records class/list identity.

### 5. PH-5 retake setup

Accepted.

The deliberate blank attempt must now hit the retake gate. A blank returning `results` fails the setup, which is the correct fail-closed behavior for L9.

### 6. PH-6 fatal/warning handling

Accepted with operational caveat.

The widened fatal set now covers the app-health signals that would make a PASS untrustworthy:

- `console-error`
- `page-error`
- `unexpected-dialog`
- `verify-fail`
- existing oracle/auth/modal failures

`flow-gap` / `selector-gap` producing `PASS-WITH-WARNINGS` with exit code `2` is acceptable if the orchestrator treats exit `2` as non-certifying. Do not aggregate `PASS-WITH-WARNINGS` into a fleet PASS without explicit human triage.

## Syntax

Checked:

```text
node --check audit/playwright/lsr_persona.mjs
node --check audit/playwright/lsr_personas.mjs
node --check audit/playwright/lsr_ui.mjs
```

All syntax checks passed.

## Remaining caveats before full fleet

- L10/L11/L12/L15 remain guarded by `NOT_YET_HARDENED` for non-smoke. This is acceptable for the current foundation smoke, but not for full fleet certification.
- L16 is observation-only. It must be labeled as such in results.
- A clean smoke should include at least one blocked case (L14) and one transition case (L4) as planned.

## VERDICT

GO / CONVERGED-OK.
