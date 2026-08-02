# Codex round 69 — r68 closure / stage-1 freeze review

**Reviewed:** 2026-08-02  
**Round disposition:** **DONE**  
**STAGE-1 FREEZE:** **YES**  
**Track B:** **GO TO STAGE 2**

## Ruling

Round 69 satisfies the complete closing-condition list from my round-68 review under the stated review
contract and its single-operator, sequential runbook. I found no remaining path in that scope that can
produce a false PASS at B4 or corrupt student label data. The stage-1 design is therefore frozen.

The stage-2 opening order is:

1. run the bound B1 `--full` baseline;
2. build the dark writer with the frozen resolver;
3. rehearse the exact chain on the emulator;
4. deploy dark;
5. rehearse on the 25WT scope;
6. enter shadow operation only after the rehearsals and published B4 verdicts are clean.

This approval does not waive the runbook controls: one operator, sequential invocations, exact frozen
artifacts, explicit orphan/aborted-layer settlement, and B4's value-defined final verdict remain part of
the authority chain.

## r68 closing-condition accounting

| r68 item | Verdict | Independent result |
|---|---|---|
| A1 — repair resume | **CLOSED** | Both repair reality scans now exclude the current run's own problem and leave foreign problems strict (`b3-backfill-writer.mjs:172`, `:315`). The new lap crashes a repair post-intent, resumes the same bound command, deletes the extra, and reaches final B4 PASS (`b-emulator-lap.mjs:429-445`). Although the direct deletion assertion is truthiness-based, the following B4 PASS independently prevents that assertion from hiding a surviving wrong value. |
| A2 — pre-intent authority fence | **CLOSED** | Each published run manifest snapshots the then-applied layer SHA set (`b3-backfill-writer.mjs:445-454`). An anchorless resume compares it with the strict current ledger and refuses if a new applied SHA appeared (`:319-329`). The lap executes the exact requested sequence: pre-intent crash, M1 application, stale M0 refusal, final B4 PASS (`b-emulator-lap.mjs:447-462`). |
| B1 — exact completion counters | **CLOSED** | Every completion now requires all three counters to be non-negative integers before terminal/normal branching (`b-baseline.mjs:192-198`). The fixture rejects a string and a negative counter, and the full fixture remains green. Missing, `NaN`, fractional, and infinite values fail the same predicate. |
| B2 — stale-reap ABA | **CLOSED FOR THE DOCUMENTED RUNBOOK** | Reaping is serialized by a per-original `wx` claim; while holding it, B3 re-reads and compares the assessed lease before rename, never restores a renamed pathname, then creates its own lease (`b3-backfill-writer.mjs:270-300`). Under the single sequential operator control this removes the r68 successor-clobber path. Residual multi-process/liveness cases remain operational, not gate-integrity defects. |
| Failed latest completion after flip | **CLOSED** | Strict parsing validates the counters and publishes a failed/skipped latest completion as an orphan only in post-flip mode, retaining its outcome counts (`b-baseline.mjs:228-235`). Pre-flip remains strict. An orphan does not imply correctness: B4 still settles disk values against the supplied layer chain. |
| Flip orphan and mixed-(d) execution | **CLOSED** | The lap now executes post-intent crash → flip → published orphan → verdict (`b-emulator-lap.mjs:481-492`) and structural corruption plus actionable delta → exit 7 → driver stop 5 → correction → PASS (`:465-479`). Thus the new cases exercise the stopping behavior, not merely enumerate it. |
| Orphan/aborted-layer operator law | **CLOSED** | Track B explicitly permits passing such a layer to `--appliedDelta` so partially written students settle by value (`14_TRACK_B_BACKFILL_PIPELINE.md:111`). This does not grant an exemption: a mismatched value still blocks. |

## False-pass and corruption pressure test

The pre-intent fix is an authority fence, not just a test accommodation. In the r68 counterexample, M1's
successful completion adds a layer SHA to the strict ledger; M0's durable manifest cannot contain that
SHA, so its anchorless resume exits before writes. Later repair completions that do not add a new layer
do not create a competing expected-label authority under the sequential runbook.

The post-flip orphan disposition also remains fail-closed at the data boundary. It only changes ledger
admission from fatal to published disposition; it does not make the associated student values correct.
The operator supplies applicable orphan/aborted layers, and B4 compares the actual values with the
layer/flip expectations. Partial writes that do not match still produce diffs. The new mixed-(d) case
confirms that processing an actionable delta cannot wash out an unrelated structural mismatch.

No r68 closing condition remains open, and I found no new issue meeting the contract's blocking bar.

## Independent verification

Against commit `23bef89` and the current workspace I ran:

- `node --check` on all eight emulator-evidence-bound scripts: **8/8 passed**.
- `node scripts/deepfix2/delta-chain-fixture.mjs`: **84 checks, 0 failures**.
- `node scripts/deepfix2/rotation-cyclicity-fixture.mjs`: **2,688 checks, 0 failures**.
- evidence-to-source SHA-256 prefix comparison: **8/8 matched**.
- `emulator-lap-result.json`: **98 checks, 0 failures**; its eight hashes bind the reviewed source bytes.
- scoped `git diff --check`: no whitespace errors (only Git's existing LF→CRLF notices).

I did not rerun the Firebase emulator lap locally because this Windows environment has no non-Docker
Java/emulator route and the session explicitly excludes reviving Docker. I instead verified the frozen
98/0 artifact against all eight source hashes and independently ran every available offline fixture and
syntax check.

## Operational register (nonblocking)

- A crash while holding the `.reaping` claim can leave a stale claim that needs explicit operator cleanup.
  That is an availability/recovery procedure item; it cannot create a B4 false pass or modify student data.
- The evidence JSON records the pre-commit `gitHead` (`15fe0f8`), while commit `23bef89` contains the
  reviewed bytes. The eight source SHA prefixes all match, so this is evidence metadata hygiene, not an
  identity ambiguity.
- Multi-process starter/reaper races remain outside the documented one-operator sequential runbook and
  belong in the stage-2 crash/recovery matrix.

## Decision

**STAGE-1 FREEZE: YES.**  
**PRESENTABLE: YES.**  
**`codexDecision`: `DONE`.**

