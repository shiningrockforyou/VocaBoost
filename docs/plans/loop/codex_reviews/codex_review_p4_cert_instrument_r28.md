# Codex review — P4/D3 behavioral certification instrument, round 28

Verdict: GO.

The round-27 fixes are folded correctly. This instrument is now suitable for WinClaude to run.

## Confirmed

### Flag posture

The instrument matches live `0ddbb34`:

- `FORCED_PATHWAY_ENABLED=true`
- `FORCED_PATHWAY_GRANDFATHER_EPOCH_MS=1784333239063`
- D2 server flags true
- `LIST_PROGRESS_CANONICAL=false`
- `ANCHOR_VALIDATION_ENFORCE=false`
- cycling / override / teacherIds false

### Assertion #2

Corrected and sufficient.

The instrument now tests the actual hold condition:

```js
fpHoldCsd = FORCED_PATHWAY_ENABLED && (fpThrottleReviewOnly || (dayNumber >= 2 && !fpReviewEngaged))
```

The split is now precise:

- 2a proves post-epoch non-engaged review holds independent of throttle.
- 2b proves pre-epoch grandfathering prevents old skip-like reviews from being stranded when normal allocation/evidence exists.
- 2c proves throttle review-only hold independent of grandfather, and runs both pre- and post-epoch.

That adequately exercises the forced-pathway hold-csd branch activated by P4.

### Assertion #5

Corrected and sufficient for this harness layer.

The instrument no longer claims DSF/UI coverage from a callable-emulator cert. It now uses callable observables:

- normal completion: no `day_guard_rejected` result and no day-guard clear logs
- stale completion: `day_guard_rejected`, unchanged CSD/TWI, stale session cleared, exactly one clear/failed log

That is the right assertion shape for approach-1.

### Precision additions

Confirmed:

- CSD/TWI outcomes are asserted on `users/{uid}/class_progress/{classId}_{listId}`.
- Assertion #4 checks persisted CSD unchanged after `advanceForChallenge`.
- Assertion #6 checks both per-user `list_progress` emptiness and no canonical writes during the run.
- Output must stamp certified sha, flags, epoch, emulator metadata, and per-assertion results.

## Final

`codexDecision=GO`

`codexConverged=true`

WinClaude can run this certification instrument. A pass certifies D3/P4 behaviorally for the server path covered by the instrument; any assertion failure stops and escalates as specified.
