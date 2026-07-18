# Codex review — P4 convergence re-verify, round 23

Verdict: GO-HOLD.

Meaning: keep the P4 cutover live under observation while the behavioral smoke is fixed and rerun. This does not certify P4 behaviorally, and it does not unblock D4/P5.

## A — Verdict after clean live telemetry

I revise the live-state ruling from `NEEDS-BEHAVIORAL-SMOKE` to `GO-HOLD`.

Reason:

- In round 22, I required a read-only 26SM `system_logs` sweep as the immediate de-risk before holding live through real traffic.
- That condition is now satisfied by `audit/playwright/findings/deepfix_syslog_sweep_postcutover.json`.
- The sweep reports `NO-SPIKE` since the P4 client cutover time:
  - cutoff: `2026-07-18T08:46:00Z`
  - 13 post-cutover logs
  - 9 `resolve_list_progress` from 26SM
  - 2 `csd_twi_reconciled` from 26SM
  - 0 `dayGuardRejected`
  - 0 `csd_anchor_invalid`
  - 0 `anchor_rejected`
  - 0 `reviewonly_derivation_mismatch`
  - 1 `impossible_phase_detected`, equal to baseline / no spike
- The convergence report also records a clean read-only 26SM data-integrity sweep: `invalidAnchor:0` and structural signatures 0, with `reviewNoNewPass` down from baseline.

This is enough to avoid rollback and hold the live cutover while the real behavioral smoke is repaired.

Important boundary: `GO-HOLD` is not `CERTIFIED`. The six behavioral assertions still have to pass before D3/P4 is closed as behaviorally proven.

## B — Ground truth re-confirmation

### C1 — Git/head chain

Confirmed.

- `HEAD == origin/main == 6bffe1c5a5275b36f346a50d85e555489148e7ea`.
- The recent D-track chain is present:
  - `59df732`
  - `26cd8ee`
  - `d2bb2bc`
  - `0ddbb34`
  - `6bffe1c`
- `6bffe1c` changes one file, `src/config/featureFlags.js`, with four route flags flipped false → true.

### C2 — Committed/deployed posture

Confirmed from git plus gate/build evidence.

- Client at `6bffe1c` has:
  - `SERVER_PROGRESS_WRITE=true`
  - `SERVER_CHALLENGE_WRITE=true`
  - `SERVER_REVIEW_MARKER=true`
  - `SERVER_RESET_PROGRESS=true`
  - `FORCED_PATHWAY=true`
- Server gate evidence reports:
  - deployed short sha `0ddbb34`
  - `FORCED_PATHWAY_ENABLED=true`
  - deployed epoch `1784333239063`
  - D2 server flags true
  - `LIST_PROGRESS_CANONICAL=false`
  - `ANCHOR_VALIDATION_ENFORCE=false`

The functions `dirty:true` provenance caveat remains, but it does not refute the proven sha/flag/epoch gate.

### C3 — Deploy order invariant

Confirmed.

The fail-closed server-state gate passed at `2026-07-18T08:37:06Z`, before the client commit/push window around `2026-07-18T08:45–08:46Z`. This was not a client-ahead-of-server cutover.

### C4 — Behavioral smoke and M-CALL gap

Confirmed.

The six-assertion behavioral smoke still did not run:

- `deepfix_p4_smoke_r37.json`
  - `SMOKE_PASS:false`
  - `reachedTest:false`
  - no progress doc before or after
  - no completion
  - no meaningful routed-path assertions executed

The M-CALL substitute still does not cover the live forced-pathway hold-csd branch:

- it ran at baseline `59df732`
- it omits `FORCED_PATHWAY_ENABLED`
- it used `LIST_PROGRESS_CANONICAL=true` and `ANCHOR_VALIDATION_ENFORCE=true`, opposite current production posture
- deployed functions since then include a substantial diff through `0ddbb34`

So the live cutover is de-risked by telemetry, not behaviorally certified by the planned smoke.

### C6 — Updated status

Revised.

Current status should be:

- P4/D3 is deployed and live
- clean early telemetry supports holding live
- no rollback signal is present
- behavioral certification remains incomplete
- the six-assertion smoke still must be repaired and rerun
- D4/P5 remains blocked

If the canonical label must be a single token, use `GO-HOLD`, not `NEEDS-BEHAVIORAL-SMOKE`. If the label is descriptive, use: `GO-HOLD; not behaviorally certified; smoke still required before D3 closure / P5`.

## C — D4/P5 gate

Confirmed blocked.

Nothing in the clean telemetry authorizes D4/P5. P5 remains a one-way migration and needs a fresh Codex-GO'd, David-authorized plan plus completed D3 certification/soak conditions.

## Required follow-up

1. Keep P4 live for now.
2. Continue read-only monitoring during heavier 26SM traffic.
3. Fix the `joinClass` harness/enrollment gap.
4. Rerun the six-assertion behavioral smoke on live `6bffe1c` or an equivalent live build.
5. Do not start D4/P5 until the smoke gap is closed and a fresh P5 plan is approved.

## Final

`codexDecision=GO-HOLD`

`codexConverged=true`
