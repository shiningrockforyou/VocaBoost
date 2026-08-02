# Codex round 63 — r62 closure / stage-1 freeze review

**Reviewed:** 2026-08-03  
**Round disposition:** **DONE**  
**Stage-1 freeze:** **NO**  
**Track B:** **NO-GO — POST-FLIP FAIL COUNTS CAN STILL FALSE-PASS, AND EXTRAS REPAIR CAN REVERT AN APPLIED DELTA CHAIN**  
**Shadow design:** **CONDITIONALLY CLOSED AT PLAN LEVEL; IMPLEMENTATION/STALE-CACHE TEST REMAINS A DARK-BUILD GATE**

## Ruling

Round 63 closes the headline r62 driver defect. B4 now distinguishes structural diffs from diffs accompanied
by an actionable delta; the Node driver is cross-platform and continues on both actionable outcomes. The
shared transaction fence, direct DA custody, layer ordering, top-level row checks, all-departed artifact,
fsync'd ledger records, unique resume pre-image/result names, class-based shadow scoping, and
generation-bound shadow classification are all meaningful improvements. The measured fixtures are accurate:
47/0 and 2,688/0.

The remaining item is **not only the emulator lap**.

First, the per-field post-flip law is still wrong for the cumulative `reviewFailCount`. It exempts the counter
whenever `reviewLastFailedAt` is post-flip. A fail transaction increments the counter; it does not recompute
history. Any pre-flip tail omitted from the current counter therefore survives every post-flip increment, and
the fresh fail timestamp hides that offset from B4. The fixture explicitly asserts the unsafe implication
instead of exercising the cumulative counterexample.

Second, B3 checks that `--repairExtras` was reported against the supplied applied-delta chain, but it does not
use that chain to compute its ordinary write plan. In the natural repair invocation (report +
`--appliedDelta`, no `--deltaDir`), phase 1 resolves every student against M0 and can overwrite labels already
correct under M1/M2 back to the original baseline before deleting the extras. B3 can return 0 after this
regression; only the next B4 catches it.

The new ledger and resume custody also have exactness gaps: ledger intents/completions are paired only by
runId rather than `(runId, attempt)`, the ledger is skipped entirely if the file is absent, and every resume
still overwrites the shared `plans.resume.jsonl` file referenced by all otherwise-immutable per-attempt
results.

Finally, the repository's David-ratified gate still says the emulator smoke lap must run **before any future
freeze claim**, while the handoff asks to defer it until after freeze. Both governing cards still invoke the
deleted `.sh` driver and the Track-B prose still describes the removed document-wide post-flip exemption.
The code and frozen runbook are not one executable law.

`codexDecision=DONE` means this review turn is complete. It does **not** mean GO or freeze approval.

## Closure result

| Handoff item | Verdict | Independent result |
|---|---|---|
| A1 actionable outcome + Node driver | **CODE CLOSED / EXECUTION GATE OPEN** | Exit 7 and the Node driver correctly compose the previously rejected `DIFFS + delta` outcome. The real CLI/emulator lap remains unrun, and the governing cards still name the deleted shell driver. |
| A2 per-field post-flip exactness | **MISS / BLOCKER** | Timestamp fields are narrowed correctly, but cumulative `reviewFailCount` cannot inherit correctness from a fresh `reviewLastFailedAt`; an increment preserves any pre-flip count deficit. |
| A3 repairExtras chain custody | **MISS / BLOCKER** | Ordered hashes are compared, but the loaded applied chain is discarded after validation. Normal B3 planning still uses M0 or the one `--deltaDir`, so repair can regress earlier-layer UIDs. |
| A4 durable ledger | **PARTIAL** | Intent-before-write, completion-after-result, fsync, strict JSON, and failure/skip checks landed. Attempt pairing and absent-ledger handling remain fail-open as audit claims. |
| A5 per-attempt resume identity | **PARTIAL** | Pre-image and result files are unique. The plan file remains shared/overwritten, and concurrent resumes can select the same attempt and temporary/final paths. |
| A6 exactness + roster | **MOSTLY CLOSED** | Strict layer order, DA/departure top-level checks, and union-of-row departures landed. Indexed rows are validated only when fetched, and all-departed layer-only UIDs still vanish because the union excludes DA UIDs without rows. |
| B1 one reduced-scope law | **CLOSED AT PLAN LEVEL** | The shadow plan consistently materializes partitions as class `studentIds`, consumes class allowlists, and adds a generated-manifest equality gate. |
| B2 generation-bound classification | **CLOSED AT PLAN LEVEL** | The fleet-enumeration pretense is gone. Stale-generation rows are quarantined and excluded from both production classification and current-generation audit evaluation; implementation plus stale-cache injection remain required. |
| B1 stream / indexed close notes | **CLOSED WITH NIT** | B1 awaits drain and the indexed facade exposes `close()`. One-shot B3/B4 never call it, so the descriptor remains open until process exit; the transient full hash buffer remains honestly documented. |

## A. Blocking findings

### A1. A fresh fail timestamp does not prove the cumulative fail count is correct

The new helper returns true for `reviewFailCount` whenever the document carries
`reviewLastFailedAt >= flipTs` (`b-baseline.mjs:21-32`). B4 exempts any mismatching numeric fail count under
that condition (`b4-verify.mjs:164-172`). H6 defines the counter as **+1 per failed presented word**, not as an
absolute replay recomputation (`15_H6_SCHEMAS_AND_CONTRACTS.md:12-18`).

Counterexample using the actual cutover choreography:

1. The last applied delta has `fc=1`.
2. One additional failure lands before the flip. B4's flip-boundary replay correctly expects `fc=2`, but live
   label writers were not active yet, so the document still contains 1.
3. One failure lands after the flip. The live writer increments the stored counter to 2 and stamps
   `reviewLastFailedAt >= flip`.
4. The true through-current-history count is 3. B4 compares only to the flip-boundary value 2 and either sees
   a coincidental match or exempts a remaining mismatch because LF is fresh. It can PASS.

With two omitted pre-flip failures, the post-flip value remains one behind and is explicitly exempted. The
same-txn relationship proves that FC was **touched**, not that its pre-increment base was correct.

The fixture codifies only `fresh unrelated LC does not exempt FC` and then asserts that fresh LF **does**
exempt FC (`delta-chain-fixture.mjs:324-332`). It does not model a counter, a pre-flip tail, or an increment,
so its green result is false assurance for the cumulative case.

Required closure: verify FC against replay through a captured post-flip cutoff, or add the exact number of
eligible post-flip failures to the flip-boundary expected counter and fence/retry concurrent attempts. Do not
exempt a cumulative counter merely because its partner timestamp is fresh. The fixture must reproduce the
three-step sequence above and require the correct through-cutoff count.

### A2. `--repairExtras` validates the chain, then plans writes against a different expectation

B3 loads `args.appliedDelta` into a local `chainLayers`, checks strict order, and compares its manifest-hash
sequence with `report.appliedDeltas` (`b3-backfill-writer.mjs:126-141`). That local chain is never assigned to
the `deltaLayers` used by `resolveExpectedSource` (`:63-67,224-233`).

A concrete clean-state regression is therefore possible:

1. M1 changes student U's correct expected labels and has already been applied.
2. B4 runs with `--appliedDelta=M1`; U is correct, but B4 reports an unrelated extra document. The report
   properly records `[sha(M1)]`.
3. The operator follows the repair interface with M0, that report, and `--appliedDelta=M1`, but no
   `--deltaDir` (the usage header does not even document the new applied-chain argument).
4. Chain custody passes. `deltaLayers` is nevertheless empty, so phase 1 resolves U from M0 and plans to
   overwrite M1's labels back to old values. Extras plans are emitted after the ordinary student plans
   (`:224-274`).
5. Both plans can commit and B3 exits 0 with a clean completion. Final B4 detects the regression, but the
   writer has already accepted and executed authority from the wrong expected state.

If M1 introduced a roster-added student, the same natural invocation instead fails the M0 scope check, so
extras repair is not runnable for that valid chain without an undocumented `--deltaDir` workaround. Passing
only the latest `--deltaDir` is still not equivalent to resolving every UID over the full applied chain.

Required closure: make extras repair a deletion-only mode, or use the exact loaded applied chain as the
resolver chain for all ordinary planning. Define whether `--deltaDir` may coexist; if it may, require it to be
the exact final/new layer under a single combined chain. Add a fixture where M1 changes U, an unrelated extra
is repaired, and U remains byte-equal to M1 after B3.

### A3. Ledger records are not paired by attempt, and a missing ledger disables the audit

The fsync'd record publication is a real improvement. B4 stores intents and completions in two maps keyed only
by `runId` (`b4-verify.mjs:55-78`). It considers an intent complete whenever **any** completion for that runId
exists; it never requires `intent.attempt === completion.attempt`.

Thus an already-completed run followed by a new resume attempt that crashes after its new intent is not
reported as intent-without-completion—the old completion satisfies `applieds.has(runId)`. This is easy to
trigger even if the resume has no work. It directly falsifies the handoff's “any intent without completion ⇒
FATAL” claim. If a report-named extra was absent during the clean attempt and reappears before resume, the new
attempt can also have real deletion work while still being paired with the old completion.

The entire audit is also conditional on `existsSync(ledgerPath)` (`:55-57`). If the ledger is absent after an
execute, B4 silently performs no ledger checks. Strict parsing does not make an optional file mandatory.

Required closure: key records by `(runId, attempt)`, require an exact intent/completion pair for the latest
attempt, and specify how a clean later attempt supersedes an earlier failed one without erasing history. A
final verifier should reject a missing ledger whenever it is operating after B3 execution / with an applied
chain; use an explicit forensic/pre-write override for the genuinely pre-ledger probe. Test clean attempt 0 +
crashed intent 1 and a completely missing ledger.

### A4. Resume result files are unique, but their plan evidence is still overwritten

Attempt discovery creates unique `resume-N.preimage.jsonl` and `resume-N.result.json`
(`b3-backfill-writer.mjs:184-199,344-351`). Every resume still writes the plan to the same
`<runId>.plans.resume.jsonl`, however (`:200-201,277-290`). Each immutable result records that shared path and
its current hash. Resume N+1 overwrites the file, after which resume N's recorded hash no longer verifies its
referenced plan.

There is no run/resume lease. Two concurrent resumes can both choose the same N and share the same pre-image,
plan temp, plan final, and result paths. Transaction re-diff limits state corruption, but audit evidence can
race or be overwritten.

Required closure: include the attempt number in plan temp/final names and acquire an exclusive per-run resume
lease (or atomically reserve the attempt ID). Each result must reference immutable pre-image and plan files
whose hashes remain verifiable after later resumes.

### A5. The repository's own gate requires the emulator lap before freeze

The handoff asks whether the lap can be treated as the first post-freeze stage-2 gate. The current ratified
task card says the Track-B smoke lap must be executed “before any future freeze/gate claim cites it”
(`02_TASK_LIST.md:95`), and the change log repeats “before 25WT and before any future freeze claim.” No newer
owner decision in the packet changes that sequencing.

The lap also cannot be executed from the frozen prose as written: both 02_ and Track B still invoke
`b-delta-cycle.sh`, which round 63 deleted (`02_TASK_LIST.md:95`; `14_TRACK_B_BACKFILL_PIPELINE.md:90-96`).
Track B's post-flip paragraph still says a document bearing any fresh label timestamp is wholly
LIVE-PROGRESSED (`14_:97-104`), while the code now attempts a per-field law.

Therefore even if A1-A4 did not exist, the current contract itself rules **freeze-NO-until-lap**. If David
intends a freeze-YES with the lap only as a stage-2 entry gate, that gate-order amendment must be explicit and
the `.mjs` command/exit matrix must replace the deleted `.sh` instructions first.

## B. Exactness and operational notes

### B1. All-departed layer-only students are still not counted by final B4

B4 now builds `knownUids` from original rows plus every applied layer's **row keys**
(`b4-verify.mjs:94-106`). An all-departed delta layer intentionally contains zero rows and records its UIDs
only in `delta-auth.json` / `manifest.departedUids`. A roster-added UID absent from M0 who departs before B1
therefore remains absent from `knownUids`; final B4 does not count/list it, contrary to the handoff's “next B4
counts them departed” claim.

Include every layer's authenticated UIDs (or departedUids), not only row keys, in the known-union. Extend the
all-departed fixture through B4's union law rather than stopping after `loadDeltaLayer` accepts an empty row
set (`delta-chain-fixture.mjs:364-376`).

### B2. Indexed validation remains lazy

The eager loader validates every parsed row. The indexed loader extracts UID keys without calling
`validateRowShape` and validates only inside `rows.get()` (`b-baseline.mjs:46-74,83-103`). A malformed row
that is currently departed may be enumerated by `keys()`, skipped by B4, and never fetched/validated. The
statement that both loaders validate row shapes is therefore too broad.

Validate at least the complete row envelope during index construction (or perform a streaming validation
pass while hashing/indexing). Inner `epochByList` entries and word payload values are still not schema-checked;
the current helper validates only their container types.

### B3. Skip recovery is outside the “one driver”

The Node driver correctly maps B3 exit 5 to driver exit 3, but its message says to rerun with `--resume` while
the driver exposes no resume mode (`b-delta-cycle.mjs:11-14,58-64`). Completing recovery requires a manual B3
command, retaining the emitted layer, then restarting the driver with that layer and a non-colliding prefix.
That is safe if done correctly, but it should be one explicit runbook/subcommand before 26SM rather than an
implicit operator reconstruction.

## C. Shadow disposition

The r63 shadow changes close the two design defects from r62:

- class membership is now the sole reduced-scope authority; generated allowlists and the pre-run equality
  gate consistently feed B1/B3/B4 and the battery partitions;
- safety no longer depends on proving every warm instance refreshed. Writers stamp the generation they used,
  production quarantines stale generations during the audit window, and shadow audit evaluation accepts only
  current-generation shadow rows.

This is freezeable **as a design**, subject to the already named dark-build implementation and stale-cache
injection test. The implementation must define missing/future generations as quarantined too—not merely
`generation < current`—and keep current-generation `shadow:true` rows excluded from production alerts. No
additional stage-1 shadow blocker was found in the r63 diff.

## Minimal falsifiable closure set

1. Replace the LF-based fail-count exemption with an exact through-cutoff cumulative check; add the
   pre-flip-tail + post-flip-fail counterexample.
2. Make extras repair deletion-only or resolve all planning against the exact report chain; prove an unrelated
   repair cannot move an M1/M2-correct student.
3. Pair ledger records by run+attempt, fail on an expected-but-missing ledger, and give every resume an
   immutable attempt-specific plan plus an exclusive attempt reservation.
4. Update the governing `.sh`/document-wide-live prose to the `.mjs`/per-field implementation, then execute
   the already-ratified emulator cases and crash injection **before freeze**, or obtain an explicit owner
   amendment moving that gate after freeze.
5. Count all authenticated departed layer UIDs and validate every indexed row envelope eagerly.

## Independent checks executed

- Revalidated baton owner `codex`, round 63, revision 198, task/handoff, and written-last ready marker.
- Reviewed commit `2f80e6d` and the complete handoff surface: shared loader, B1, B3, transaction core, B4,
  Node cycle driver, delta fixture, Track-B/task/shadow plans, change log, and panel receipt.
- `node --check` passed for all seven Track-B JavaScript modules in the review surface.
- `node scripts/deepfix2/delta-chain-fixture.mjs` returned **47 checks / 0 failures**.
- `node scripts/deepfix2/rotation-cyclicity-fixture.mjs` returned **2,688 checks / 0 failures**.
- `git show --check HEAD` found only trailing spaces in the already-published r62 review header; no r63 source
  whitespace error was reported.
- No Playwright, emulator, or live Firestore mutation was run; the handoff did not authorize a live audit and
  explicitly deferred the emulator lap.
