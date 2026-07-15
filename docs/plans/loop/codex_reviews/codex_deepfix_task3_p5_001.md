# Codex review — DEEPFIX_TASK3_P5 round 1

Verdict: NEEDS_FIXES

`VERDICT blockers=1 high=1 med=1 nits=0`

Reviewed:

- `scripts/cs/deepfix-migrate-list-progress.mjs`
- `audit/deepfix/task3/P5_impl_notes.md`
- `audit/deepfix/task2/FIX_PLAN.md` Phase P5
- `audit/deepfix/task1/investigations/inv_I6_foundation.md` §2
- `docs/plans/PLAN_list_progress_persist.md` §8
- live anchor semantics in `src/services/db.js`
- durable `reviewOnlyDay` fact in `src/services/studyService.js`

Syntax:

- `node --check scripts/cs/deepfix-migrate-list-progress.mjs` passes.

## Findings

### P5-1 — BLOCKER — `--catchup` ignores quarantine/action and can merge suspect legacy data into canonical progress

Location:

- `scripts/cs/deepfix-migrate-list-progress.mjs:340-415`
- `scripts/cs/deepfix-migrate-list-progress.mjs:617-642`

Problem:

The per-pair computation correctly detects `TWI_EXCEEDS_ANCHOR`, `ANCHORLESS_TWI`, `CSD_IMPLAUSIBLE`, and `PREEXISTING_CANONICAL_CONFLICT`, then sets `action = 'SKIP_QUARANTINE'` at line 415.

The `--commit` branch respects that by writing only `MIGRATE`, `MIGRATE_OVERWRITES_FOREIGN`, and `MERGE_STRAGGLER`.

The `--catchup` branch does not respect it. It iterates every record with an existing migration-owned canonical doc and late stamped legacy docs, regardless of `r.action` or `r.quarantine`, then writes:

- `currentStudyDay: Math.max(ex.currentStudyDay || 0, ...late.map(s => s.csd))`
- ancillary fields from the newest late doc
- anchor-capped TWI only for the TWI field

That means a late legacy doc with `CSD_IMPLAUSIBLE csd=999`, or a late doc in any other quarantined pair, can still promote canonical CSD/ancillary during `--catchup`. This violates the P5 rule: suspect docs are quarantined, never hydrated/migrated, and the quarantine set must be resolved to zero before cutover.

Fix:

In `--catchup`, fail closed before any write if `assertFailures > 0 || quarTotal > 0`, matching `--commit`; and also skip/refuse any individual `r.action === 'SKIP_QUARANTINE' || r.quarantine?.length || r.action === 'SKIP_ERROR'`.

If catch-up is intentionally allowed to run with unrelated quarantines, it still must block each quarantined pair and report a nonzero failure. Do not merge late docs from a pair whose current recomputation quarantined.

### P5-2 — HIGH — A6 “review-attempt evidence alone” is not enforced; calendar-only CSD rescue can silently pass and migrate

Location:

- `audit/deepfix/task2/FIX_PLAN.md:505-507`
- `scripts/cs/deepfix-migrate-list-progress.mjs:331-350`
- `scripts/cs/deepfix-migrate-list-progress.mjs:526-545`

Problem:

The P5 hard acceptance says every student with N>1 consecutive review-only days must pass the CSD screen on review-attempt evidence alone.

The script computes:

```js
ceil = Math.max(evidCeil, calCeil ?? 0)
csdPlausible = s.csd <= ceil
passesOnEvidenceAlone = s.csd <= evidCeil
```

But when `gap >= 2 && csdPlausible && !passesOnEvidenceAlone`, it only appends to `REPORT.csdPassedOnlyByCalendar`; it does not fail A6 and it does not quarantine/exclude the CSD. The hard asserts do not include `REPORT.csdPassedOnlyByCalendar`.

So a large CSD gap with insufficient durable review-attempt evidence can migrate if the calendar threshold is high enough. That is not “passes on review-attempt evidence alone,” and it weakens the exact screen added to prevent demoting or wrongly admitting long-recovering students.

Fix:

Either:

1. Promote `REPORT.csdPassedOnlyByCalendar` into a hard assertion failure for gap ≥ 2, as the current P5 acceptance text requires; or
2. Change the P5 spec/acceptance explicitly and get an owner decision that calendar-only rescue is allowed.

For this migration draft, I would implement option 1. It is the safer reading and matches the stated hard acceptance.

### P5-3 — MED — Dry-run exit code can be green with quarantine > 0

Location:

- `scripts/cs/deepfix-migrate-list-progress.mjs:522-545`
- `scripts/cs/deepfix-migrate-list-progress.mjs:560-566`
- `scripts/cs/deepfix-migrate-list-progress.mjs:660`

Problem:

`--commit` refuses to write when `assertFailures > 0 || quarTotal > 0`, which is correct.

But the final process exit is:

```js
process.exit(assertFailures > 0 ? 2 : 0)
```

So `--dry` can return exit 0 even when quarantine is nonzero. The notes already show the 25WT sample had “8/8 asserts PASS” with 2 quarantines. That is operationally dangerous because P5’s precondition is not “asserts pass”; it is “asserts pass and quarantine set is zero before commit/cutover.”

Fix:

Make dry-run machine verdict fail when `quarTotal > 0`, or at minimum print a single unambiguous final status such as `FINAL: NOT_READY quarantine=N` and exit nonzero unless an explicit diagnostic-only flag is passed.

Recommended:

```js
const notReady = assertFailures > 0 || quarTotal > 0
process.exit(notReady ? 2 : 0)
```

This keeps automation from treating a quarantine-bearing dry run as migration-ready.

## Adjudication of U1-U10

- U1 — Pair-level quarantine for implausible CSD is acceptable and safer than excluding only the CSD, because [C7-2] requires the quarantine set to be zero before flip. But `--catchup` must respect it; currently it does not.
- U2 — Pair-level quarantine for `TWI_EXCEEDS_ANCHOR` is correct. Moving a pair while ignoring a forged high is too risky for the single canonical writer.
- U3 — Own-anchor fallback to the list anchor is acceptable for the LIST_SCOPED_RECON carried-CSD case, provided dry-run output surfaces the fallback rate. This is a defensible implementation choice.
- U4 — `lastSessionAt = max()` across sources is acceptable. It is a shared student/list truth and better than ancillary-winner verbatim for divergent cases.
- U5 — Not acceptable as implemented. “Calendar rescue” must not satisfy the hard “review-attempt evidence alone” acceptance unless the spec is changed explicitly.
- U6 — TestId fallback is acceptable because it is constrained to the canonical shape and counted. Full-cohort dry run must review the fallback rate.
- U7 — H/P/B “after” limitations are acceptable if the report keeps `leftB` and `stayedB(wall)` separate. This is a metric/reporting limitation, not a merge-rule blocker.
- U8 — Fixed 80-word F-3 parity constant is acceptable for classification labels only. It must not drive merge correctness, and it currently does not.
- U9 — Stale census numbers are acceptable as banner/reference only. The script recomputes live.
- U10 — Keeping the three-flag cutover out of the script is correct. The script should remain the data writer, not a deploy orchestrator.

## Checks that look correct

- TWI anchor selection matches the load-bearing live semantics: student+list, passed new attempts, integer `newWordEndIndex >= 0`, max position, submittedAt tie-break. Enumerating all attempts makes the pagination detail irrelevant.
- Anchorless or above-anchor stored TWI is quarantined rather than zeroed or promoted.
- `reviewOnlyDay` is correctly not used as durable evidence; `studyService.js` confirms it is only stored on `session_states`, not the durable summary.
- `--dry` has no Firestore write call-sites in the dry branch. The reachable Firestore writes are under `commit`/`catchup` mode gates.
- `--commit` writes backups before the per-pair batch and retains legacy `class_progress`.
- A8’s exemption for this migration’s own `migrationVersion` is appropriate for idempotent re-runs, while foreign canonical docs remain a hard assert.

## Required changes before GO

1. Make `--catchup` fail closed on any current assert failure or quarantine, and never merge an individually quarantined pair.
2. Enforce A6 as written, or explicitly revise the spec to allow calendar-only CSD rescue.
3. Make dry-run machine status non-green when quarantine is nonzero.

After those fixes, this should be a straightforward round-2 re-review focused on the delta.
