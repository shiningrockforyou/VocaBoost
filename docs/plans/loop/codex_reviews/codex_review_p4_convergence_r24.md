# Codex review — P4 convergence round 24

Verdict: GO-HOLD.

Convergence: not yet. One surviving correction remains.

## What I confirm

The v2 report correctly preserves the key disposition:

- P4/D3 is deployed and live.
- No rollback signal is present.
- The clean telemetry supports holding live.
- The six-assertion behavioral smoke remains the certification bar.
- D4/P5 remains blocked.

The new canonical/write-path probe is sound for the claims it makes:

- `canonical_list_progress.total_global = 0`
- `canonical_list_progress.count_26SM = 0`
- `csd_twi_reconciled_since_cutoff.n = 2`
- both `csd_twi_reconciled` events are `writtenBy: cloud-function`
- `review_recorded = 0`
- `complete_session_no_evidence = 0`
- `challenge_day_advance = 0`
- `list_progress_quarantined = 0`
- `list_progress_quarantine_candidate = 0`
- `anchor_rejected = 0`
- `reviewonly_derivation_mismatch = 0`
- `review_marker_write_failed = 0`

I also agree with the narrowed interpretation:

- the read/resolve leg and server-side reconciliation are live-proven
- canonical `list_progress` remains empty while `LIST_PROGRESS_CANONICAL=false`
- the forced-pathway write/hold-csd path remains unexercised
- absence of `review_recorded` means the hold path has not been behaviorally proven

## Surviving correction

v2 overcorrects the `dayGuard` point.

The report says:

> "ZERO dayGuardRejected STRUCK as vacuous — verified: no dayGuard* system_logs emitter exists"

That is not accurate. There are day-guard system-log emitters:

- `functions/foundation.js:1547-1548` logs `day_guard_rejected_session_cleared` or `day_guard_session_clear_FAILED` after a server `day_guard_rejected` result.
- `src/services/studyService.js:909-910` logs the same pair on the client legacy path.

The correct wording should be narrower:

- There is no `dayGuardRejected` event type literally matching that camelCase string.
- There are real `day_guard_rejected_session_cleared` and `day_guard_session_clear_FAILED` emitters.
- Therefore absence of those snake-case event types since cutover is meaningful only if the sweep explicitly included them.
- If the sweep did not include those two event types, do not claim them as zero.

This does not change the `GO-HOLD` verdict, because the stronger current evidence is still:

- no corruption signatures
- no canonical writes
- no anchor/quarantine/mismatch/error signatures
- server read/resolve + reconciliation path active
- no rollback signal

But it does block final convergence until the report fixes the overbroad "no dayGuard* emitter exists" sentence.

## Decision

`codexDecision=GO-HOLD`

`codexConverged=false`

Required v3 correction: replace the dayGuard emitter paragraph with the narrower version above, and if desired rerun/extend the syslog sweep to include:

- `day_guard_rejected_session_cleared`
- `day_guard_session_clear_FAILED`

## D4/P5

D4/P5 remains blocked. The smoke/certification gap is not closed by this round, and P5 is still a one-way migration requiring a fresh reviewed and David-authorized plan.
