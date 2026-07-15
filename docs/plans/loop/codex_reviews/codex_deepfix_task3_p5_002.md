# Codex review — DEEPFIX_TASK3_P5 round 2

Verdict: GO — CONVERGED-OK

`VERDICT blockers=0 high=0 med=0 nits=0`

Scope: re-reviewed only the three round-1 deltas requested in `docs/plans/loop/handoffs/claude_to_codex_deepfix_task3_p5_002.md`.

Syntax:

- `node --check scripts/cs/deepfix-migrate-list-progress.mjs` passes.

## Delta review

### P5-1 — catch-up fail-closed

Status: fixed.

Evidence:

- `scripts/cs/deepfix-migrate-list-progress.mjs:637-640` now refuses `--catchup` when `assertFailures > 0 || quarTotal > 0`.
- `scripts/cs/deepfix-migrate-list-progress.mjs:647` additionally skips any individual record with `SKIP_QUARANTINE`, `SKIP_ERROR`, or `r.quarantine?.length`.

Result:

A late legacy doc in a quarantined pair can no longer promote canonical CSD or ancillary fields through catch-up. The global fail-closed guard is stricter than the per-pair skip and matches the P5/C7-2 discipline.

### P5-2 — A6 evidence ceiling is binding

Status: fixed.

Evidence:

- `scripts/cs/deepfix-migrate-list-progress.mjs:346-351` makes `passesOnEvidenceAlone` the default plausibility rule.
- `scripts/cs/deepfix-migrate-list-progress.mjs:356` quarantines/excludes CSD that fails the durable review-attempt evidence ceiling.
- `scripts/cs/deepfix-migrate-list-progress.mjs:362-364` hard-fails A6 for gap ≥ 2 without durable review-attempt evidence.
- `scripts/cs/deepfix-migrate-list-progress.mjs:126-128` refuses diagnostic calendar rescue under `--commit` / `--catchup`.

Result:

A calendar-only CSD rescue cannot migrate on a default run. The diagnostic override is dry-inspection-only and still records the A6 failure path.

### P5-3 — dry-run exit reflects quarantine

Status: fixed.

Evidence:

- `scripts/cs/deepfix-migrate-list-progress.mjs:687-690` computes `notReady = assertFailures > 0 || quarTotal > 0`, prints `FINAL: READY|NOT_READY`, and exits nonzero by default when quarantine is nonzero.
- `scripts/cs/deepfix-migrate-list-progress.mjs:126-128` refuses `--diagnostic-only` under `--commit` / `--catchup`.

Result:

A quarantine-bearing dry run is no longer machine-green by default. That closes the false-ready path from round 1.

## Conclusion

The three round-1 issues are resolved. The P5 migration script is correct and safe to hand to David for the next procedural step: 25WT rehearsal, then owner-authorized 26SM execution under the P5 runbook/off-peak/watch-window constraints.
