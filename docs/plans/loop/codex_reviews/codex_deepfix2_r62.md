# Codex round 62 — r61 closure / stage-1 freeze review

**Reviewed:** 2026-08-03  
**Round disposition:** **DONE**  
**Stage-1 freeze:** **NO**  
**Track B:** **NO-GO — THE DELTA DRIVER STOPS ON TWO OF THE DELTA CLASSES IT IS SUPPOSED TO REPAIR, AND THE POST-FLIP VERIFIER CAN FALSE-PASS**  
**Cursor/H6 wording:** **SUBSTANTIALLY CLOSED**  
**Shadow execution-readiness:** **NO**

## Ruling

Round 62 contains substantial real closure. The B4 artifact now feeds B1 directly; both parent hashes are
checked; ordinary B3 writes have a genuine transaction read set containing both tombstone collections and
their target documents; B3/B4 now return nonzero for non-success; the original baseline has an indexed
reader; B3 plans/pre-images stream with backpressure; the cursor/RRU/differing-size wording is materially
better; and the extracted transaction core has useful reset-interleaving tests. These are not paper fixes.

The freeze attempt nevertheless fails. The advertised cycle driver advances only when B4 exits 6
(`ZERO-DIFF-BUT-DELTA-OUTSTANDING`). B4 deliberately classifies any run with a state difference as exit 5,
even when it also materialized an actionable delta layer. A newly enrolled student normally has missing label
state relative to its live recomputation, and an in-place adjudication normally changes the recomputed labels;
both therefore produce **DIFFS + a nonempty delta layer**. The driver stops before B1/B3 and cannot converge
the exact roster/adjudication cases the handoff says it closes.

The one post-flip verifier is also false-green at document granularity. If any one label timestamp is at or
after the flip, B4 skips every field comparison for the document. A legitimate live event can touch only a
subset of the six fields, so an old missing/corrupt/different field can survive while an unrelated fresh stamp
makes the whole document invisible to the final gate.

Writer audit authority remains incomplete as well. `--repairExtras` is bound to the original manifest but not
to the exact applied-delta chain that made the report true, and it ignores/overrides the report's field list by
deleting all six fields. The applied-layer ledger is appended only after writes/results and silently ignores
malformed JSON, so a crash or truncated record can remove the very evidence B4 claims is mandatory.

The shadow plan still contains two competing reduced-scope mechanisms and a generation probe that cannot
establish its stated fleet-wide fact through a load-balanced callable. Stage 2 should not open on this packet.

`codexDecision=DONE` means this review turn is complete. It does **not** mean GO or freeze approval.

## Eleven-claim result

| Handoff item | Verdict | Independent result |
|---|---|---|
| 1. Atomic runnable chain + integration fixture + Windows paths | **MISS / BLOCKER** | Artifact hashes and path normalization landed, but the driver stops on actionable `DIFFS + delta`; the fixture simulates B4/B1/B3 rather than executing their CLIs and does not cover roster-added or adjudication convergence. |
| 2. Fail-closed exits + true transaction fence | **MOSTLY CLOSED** | B3 normal write chunks now transactionally re-read tombstones/targets and B3/B4 exits are fail-closed. The extracted core tests lock, completed reset, normal write, and no-op. The driver composes the exit meanings incorrectly. |
| 3. Resume binds everything | **PARTIAL** | Mode/original/delta/extras hashes are bound. Repeated resumes append to one pre-image sidecar while hashing only the current append, and overwrite one `result.resume.json`; the published audit record cannot identify/verify each resume slice. |
| 4. Exact validation | **PARTIAL** | Exact manifest version, finite/sane watermark, duplicate-row rejection, mode checks, and mandatory class matching landed. UID/row shapes, delta-auth UID/reason uniqueness/types, departed UID law, and strictly ordered multi-layer watermarks remain unvalidated. |
| 5. Bounded memory + backpressure | **PARTIAL / CREDIBLE DESIGN** | B3 original rows are offset-indexed and its two output streams await drain. The loader still creates one full transient baseline buffer and leaves its file descriptor open; B1's JSONL stream still ignores backpressure. The promised large-cohort RSS evidence remains a valid stage-2 gate, not present evidence. |
| 6. Wording/cursor/RRU/differing-size law | **SUBSTANTIALLY CLOSED** | The current fixture passes 2,688 checks and the key laws are repaired. The handoff's 2,692 and 20-check claims are stale (actual delta fixture is 34). |
| 7. Shadow two-mode/isolation/generation/reduced scope | **MISS / BLOCKER** | Two evaluator predicates and structural teacher isolation improved. The scope text still alternates between class allowlists and `--uids`, and one callable cannot prove the cached generation held by every serving instance. |
| Panel: direct `--deltaAuth` + both parents | **CLOSED WITH VALIDATION DEBT** | B1 directly consumes DA and the loader verifies M0 and DA hashes. DA's own schema is not fully validated by B1. |
| Panel: roster churn counted/not bricked | **MISS** | Original-baseline departures are counted, but layer-only joiners who later depart are omitted. If all authorized delta UIDs depart, B1 fatals on zero remaining UIDs. Most importantly, roster-added `DIFFS + delta` is stopped by the driver. |
| Panel: stale retry re-force eliminated | **CLOSED FOR NORMAL PLANS** | The transaction re-diffs planned fields and does not blindly replay phase-1 values. Final B4 remains necessary for fields not present in the phase-1 plan and partial earlier chunks. |
| Panel: applied-layers ledger | **MISS / BLOCKER** | The ledger is post-write, non-atomic append evidence and malformed lines are ignored. It cannot prove that every execute is represented after a crash. |

## A. Stage-1 blockers

### A1. The cycle driver rejects actionable delta runs

B4 builds `deltaSet` for all three meaningful drift classes:

- roster additions (`b4-verify.mjs:107-108`);
- epoch/adjudication drift (`:116-122`);
- attempts at or after the selected layer watermark (`:123-129`).

It separately compares actual state to recomputed expected state (`:130-183`). Its verdict law is:

- `PASS` only for zero differences and no delta;
- exit 6 only for **zero differences plus delta**;
- `DIFFS` / exit 5 for every case with any difference, whether or not `deltaList` is nonempty
  (`:195-223`).

The layer is still materialized whenever `deltaList` is nonempty (`:205-219`). The driver, however, continues
only on exit 6; every exit 5 stops immediately (`b-delta-cycle.sh:25-34`). This creates two deterministic
counterexamples:

1. **Roster addition:** `src.row` is null, so B4 recomputes expected labels. A joiner with history and no
   backfilled labels has diffs and `rosterAdded`; B4 materializes DA then exits 5. The driver never invokes B1.
2. **In-place adjudication:** the digest changes while `submittedAt` can remain before the watermark. B4 uses
   recomputed expected labels, sees the old backfill differ, adds `adjudicationChanged`, materializes DA, then
   exits 5. Again the driver stops.

The local fixture cannot catch this because stages 3, 4, and 6 are explicitly simulations
(`delta-chain-fixture.mjs:3-14,113-182`). It detects only a post-watermark attempt whose effects are excluded
at the old boundary, then manually applies the resolved row. It never executes B4's verdict/exit branch, any
CLI, or the shell driver; it contains no roster-added/adjudication `DIFFS + delta` lap.

Required closure: define an explicit actionable-delta outcome independent of whether the current state already
differs, and make the driver continue only under a machine-checked safety condition. Add real CLI/emulator
laps for (a) new attempt with zero current diff, (b) roster addition with diffs, (c) in-place adjudication with
diffs, (d) a mixed unrelated structural diff that must remain a final failure, and (e) all delta UIDs departing.

The Windows claim is also narrower than the handoff suggests. Manifest paths now normalize correctly and B1
uses `pathToFileURL`, but the only driver is Bash, hard-codes the old `/app/node_modules`, and has no native
PowerShell/Node entrypoint. `bash` in the current PowerShell environment resolves to WSL and failed with
`E_ACCESSDENIED`; an explicit Git Bash invocation passed syntax only. Supplying prior layers while omitting the
fourth positional max-cycle argument is also impossible because argument 4 is always parsed as `MAX`. A
cross-platform Node driver is the cleanest closure and avoids reviving the retired container assumptions.

### A2. Post-flip B4 can PASS while pre-flip divergence survives

Under `--postFlip`, `isLiveDoc` returns true if **any** of five timestamps is at/after the flip
(`b4-verify.mjs:138-147`). B4 then skips the entire expected-document comparison (`:149-164`). The verdict is
based only on the remaining non-skipped documents (`:193-198`).

That exemption is too coarse. A live correct/review/graduation event can legitimately update one subset of
`reviewLastCorrectAt`, `reviewLastProvenAt`, `reviewLastTestedAt`, or `reviewRestingUntil` without proving that
an old `reviewFailCount`/`reviewLastFailedAt` or another untouched field was correct. For example, a missing or
corrupt pre-flip fail count can coexist with a legitimate post-flip correct timestamp. The latter causes all
six fields to be skipped, and final B4 can return PASS.

The comment that fail count “travels with” a fail timestamp does not prove the document-wide implication: the
fresh timestamp that triggered `isLiveDoc` need not be a fail timestamp at all. This is exactly a final-gate
false green.

Required closure: make reconciliation field/event-aware. At minimum, verify every field not provably owned by
a post-flip event against the flip-boundary expectation. Prefer a captured read cutoff and exact replay
through that cutoff, with a retry/fence for concurrently changing documents. Add a counterexample where one
legitimate post-flip stamp coexists with one stale/corrupt untouched field and prove non-PASS.

### A3. `--repairExtras` is not bound to the delta chain that defined “extra”

B3 validates a report probe, list presence, truncation, post-flip state, original-manifest hash, and cohort UID
membership (`b3-backfill-writer.mjs:67-77,113-114`). It never compares `report.appliedDeltas` to the selected
delta layer/chain.

A report created against M0 can therefore mark a word as extra, while a later delta layer for the same M0
makes that word expected. In one invocation B3 first emits the normal delta plan, then emits extras plans after
all student plans (`:174-225`). The extras line deletes every owned field from that document, so it can undo
the just-applied delta. Final B4 should catch the result, but B3 has already accepted stale deletion authority
and can exit 0.

The input tuple is not exact either: B3 does not validate unique nonempty UID/word IDs, duplicate tuples, or
that `fields` is a subset of the six owned names. It ignores the supplied `fields` and computes deletion as all
six present fields (`:215-224`).

Required closure: bind the report to the exact ordered applied-layer chain used by the invocation; reject a
missing/different chain; validate and deduplicate every tuple; and either delete exactly the report-authorized
fields or explicitly encode/hash the all-six deletion law in the report schema. Test the stale-M0-report plus
M1-word counterexample and require a pre-write rejection.

### A4. The applied-layer ledger is not durable fail-closed authority

B3 writes its result and only then appends the ledger record (`b3-backfill-writer.mjs:292-303`). A process or
host failure after transaction commits but before that append leaves applied writes with no ledger evidence.
The append itself has no atomic record publication or fsync boundary. B4 then parses the JSONL and silently
continues past malformed/truncated lines (`b4-verify.mjs:54-65`). Thus the audit described as mandatory is
optional in exactly the crash/corruption cases for which a ledger exists.

The record also means “the command reached its tail,” not “the layer completed”: it is appended even when
`txnFailures` or skipped students will immediately make B3 exit nonzero. Those counts are stored, but B4
ignores them and checks only whether a non-null delta hash appears in the supplied set.

Required closure: publish a durable per-run intent before the first write, then an atomic completion/outcome
record after all writes; make final B4 fail on malformed, incomplete, failed, skipped, duplicate, or unknown
records for its original. If JSONL remains, parsing must reject any invalid nonblank line. Crash-inject before
first write, after a committed chunk, after final commit, and during completion publication.

### A5. Resume evidence is not one verifiable record per attempt

The important invocation bindings at `b3-backfill-writer.mjs:131-140` are real. The remaining issue is audit
identity:

- every resume appends to the same `<runId>.preimage.resume.jsonl`, but `resumePreimageSha256` hashes only the
  lines appended by the current process (`:151-157,191-193,291-293`);
- the result has no byte offset/length for that slice, so the recorded hash cannot be checked against the
  final sidecar;
- every resume overwrites the same `<runId>.result.resume.json`, despite the comment that it writes its own
  result (`:294-297`);
- a crash after publishing the base pre-image but before publishing the manifest leaves a run ID that fresh
  mode rejects and resume cannot accept (`:127-135,227-243`).

This is not the r61 cross-input authority hole, but it falsifies “complete” resumable audit custody. Use a
unique immutable resume-attempt ID/file/result (or record exact append offsets plus a cumulative hash chain),
and publish backup+manifest under a recoverable state machine.

### A6. Multi-layer and roster validation is still not exact

Each delta layer is required only to have a watermark greater than the original (`b-baseline.mjs:97-117`).
The loaded chain is not required to be strictly increasing or to have unique watermarks. For the same UID, two
different valid layers at the same watermark resolve according to CLI array order because the resolver uses
`>=` (`:120-128`). The fixture's “order-insensitive” test uses unequal W1/W2 and does not cover this tie.

Baseline row loading rejects duplicate map keys, but does not validate a nonempty string UID or the row's
`epochByList`, digest, and words shape (`:46-73,90-92`). B1's direct DA reader checks neither exact version nor
unique/nonempty string UIDs/reason tuples (`b1-expected-labels.mjs:94-107`). `departedUids` is not checked for
type, uniqueness, or subset-of-auth in the shared loader.

Roster reporting also considers only `original.rows` for departures (`b4-verify.mjs:80-88`). A student first
introduced in a delta layer and later departed is absent from both the live loop and `departedUids`. If all DA
UIDs depart before B1, B1 exits fatally at zero remaining UIDs (`b1-expected-labels.mjs:103-107`), contradicting
the “never a brick” claim.

Required closure: reject non-increasing/equal layer watermarks or bind an explicit predecessor hash; validate
all row/auth/departure shapes exactly; compute departures from the union of M0 and all applied layer rows; and
represent an all-departed delta as an auditable no-op rather than a fatal dead end.

## B. Shadow execution-readiness

### B1. The reduced-scope law still has two incompatible interfaces

Section 2.11 now says reduced batteries use generated class allowlists and that clone-time `studentIds`
exactly encode each partition (`16_SHADOW_COHORT_AUDIT.md:83-90`). Section 3 still says the reduced set is the
allowlist/**UID files** every script consumes, explicitly names B1 `--uids`, and later invokes clone fidelity
with `--uids` (`:110-131`). B3/B4 have no UID-scope input; their scope comes from class documents. B1's bare
`--uids` mode also emits a delta-mode artifact without the DA parent hashes that the shared delta loader now
requires.

The clone-time partitioned class model may be a valid single design, but the governing execution pipeline
must use it consistently and name which full baseline/allowlist each B3/B4 invocation consumes. Delete or
clearly isolate the old UID-file law and add a generated-manifest test proving every selected class's
`studentIds` exactly equals its partition before any backfill/battery runs.

### B2. The generation probe cannot prove fleet-wide cache visibility

The plan says the driver repeatedly calls `getShadowRegistryGeneration` until the generation “each serving
instance currently holds” matches (`16_SHADOW_COHORT_AUDIT.md:83-90`). A normal load-balanced callable reaches
one selected instance per request. Repeated success can come from the same warm instance; there is no inventory
of serving instances and no routing control in the proposed surface. It therefore cannot establish the
fleet-wide predicate used to open the batteries.

TTL and a membership-stable schedule limit exposure, but they do not make the stated assertion true. Use a
design whose safety does not depend on proving all warm caches refreshed—for example, generation-bound
requests with fail-closed reload, or no membership cache on audit-sensitive writes. The test must inject a
stale instance/cache and prove that it cannot emit a production-classified shadow metric.

### B3. What did improve

The two evaluator modes now have disjoint, named predicates and the shadow-audit mode is explicitly
side-effect-free. Teacher isolation is framed structurally across ownership instead of as a three-teacher
sample, and the target-bound authority-union negatives are much better than the old ownership shorthand. The
new top-level `shadow_registry` rule is client-denied. Preserve these improvements while closing B1/B2.

## C. Evidence and packet accuracy

- Independent delta fixture result: **34 checks, 0 failures**, not the handoff's 20.
- Independent rotation fixture result: **2,688 checks, 0 failures**, not the handoff's 2,692.
- The delta fixture accurately disclaims CLI and live-Firestore coverage. The handoff over-promotes it to a
  fake-DB full chain even though B4 detection, B1 layer production, B3 application, and final B4 are simulated.
- The baton/handoff changed-file list omits security-relevant files in commit `89d8b5f`, including
  `scripts/deepfix2/b3-txn-core.mjs`, `b1-replay-lib.mjs`, the rotation fixture, the rules artifact, and plan
  10. They were inspected anyway, but future packets must enumerate the real review surface.
- The shell driver passed `bash -n` only when Git Bash was invoked explicitly outside the sandbox. The default
  Windows `bash` command attempted WSL and failed; no live Firestore cycle was authorized or run.

## Minimal falsifiable closure set

Do not open stage 2 yet. The minimum next packet is:

1. **Driver/CLI convergence:** a cross-platform driver whose outcome model handles actionable
   `DIFFS + delta`, with emulator CLI laps for new-attempt, roster-added, adjudication, mixed structural diff,
   and all-departed cases. Final success remains possible only on B4 PASS.
2. **Post-flip exactness:** replace document-wide `isLiveDoc` exemption with field/event-aware or cutoff-bound
   verification; the fresh-one-field + stale-other-field counterexample must fail.
3. **Writer custody:** exact applied-chain binding for extras plus a durable intent/completion ledger that fails
   closed under malformed lines, partial writes, skips, failures, and crash injection.
4. **Artifact determinism:** strict predecessor/monotonic layer order, exact row/DA/departure validation, and
   immutable verifiable per-resume evidence.
5. **Shadow one-law execution:** one reduced-scope interface throughout and a stale-cache design/test that does
   not pretend a load-balanced callable enumerates all instances.

## Independent checks executed

- Revalidated baton owner `codex`, round 62, revision 196, task/handoff, and written-last ready marker.
- Inspected the handoff, actual commit file list, B1/shared loaders, B3 writer and extracted transaction core,
  B4, delta driver/fixture, Track-B/H6/shadow plans, and additive rules artifact.
- `node --check` passed for the shared loader, B1, B3, transaction core, B4, and delta fixture.
- `node scripts/deepfix2/delta-chain-fixture.mjs` returned **34 checks / 0 failures**.
- `node scripts/deepfix2/rotation-cyclicity-fixture.mjs` returned **2,688 checks / 0 failures**.
- `git diff --check` returned exit 0; the repository emitted its broad existing LF→CRLF warnings.
- `C:\Program Files\Git\bin\bash.exe -n scripts/deepfix2/b-delta-cycle.sh` passed outside the sandbox;
  PowerShell's default `bash`/WSL path failed with `E_ACCESSDENIED`.
- No Playwright or live Firestore mutation was run; the baton did not request either.
