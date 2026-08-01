# Codex round 59 — cursor/H6/Track-B freeze review and shadow-plan verification

**Reviewed:** 2026-08-02  
**Round disposition:** **DONE**  
**Stage-1 freeze-clean:** **NO**  
**Cursor-law v3 closure:** **PARTIAL — REFERENCE FIXTURE GREEN, PERSISTED LAW NOT CLOSED**  
**H6 residue closure:** **NO**  
**Track B1/B3/B4:** **NO-GO**  
**Shadow audit execution-ready pending permissions:** **NO — TECHNICAL BLOCKERS REMAIN**

## Ruling

The round contains real progress. The rotation fixture parses and executes with **2,680 checks / 0 failures**;
the cursor is now student+list+epoch scoped; `review_cursors` and `compose_keys` are included in all three
client-write exclusions in the additive rules artifact; the reset fence is explicitly transactional; and the
shared replay library removes one important class of B1/B3/B4 formula drift.

Those changes do not make the stage-1 artifact set freeze-clean. The Track-B pipeline can still publish a
false-green result after an old attempt is adjudicated, cannot apply its own post-watermark delta, always
rewrites every planned document on a second pass, cannot delete stale nullable labels, and begins production
writes before the promised pre-image backup is durable. Its B4 verifier only inspects expected word IDs, so it
can certify `ZERO-DIFF` while extra/stale authoritative labels remain. These are execution and authority
defects, not documentation polish.

The H6 contract still contains a live count-query instruction, omits its two new state collections from reset
cleanup, and allows two classes composing the same shared logical day to advance the shared cursor twice. The
fixture does not exercise that persisted concurrency law, and its underflow state transition is not the state
transition written in H6.

The shadow plan is also not execution-ready even if all necessary permissions are treated as granted. The new
opaque `zx...` identity conflicts with cleanup and metrics guards that still require `shadow_`; the required B1
CLI flags do not exist; the snapshot gate permits skipped students despite the all-947 fidelity claim; and the
in-process wrapper cannot contain writes made by deployed Admin-SDK code. The permission evidence also does
not match the handoff's “B-E pending” claim.

`codexDecision=DONE` below means this review turn is complete. It is **not** a GO/freeze verdict.

## Requested scope verdicts

| Scope | Verdict | Independent result |
|---|---|---|
| Cursor property/reference fixture | **PARTIAL PASS** | The submitted pure-JS reference passes 2,680/2,680 checks and permanently contains the r58 burst-return case. Its certified text, underflow transition, and persisted same-day/cross-class behavior remain inconsistent or untested. |
| H6 schema/contracts | **MISS** | The new cursor/claim schemas help, but count-query residue, reset reach/fencing gaps, raw compose-key identity, allocator ambiguity, and shared-cursor double advancement remain. |
| Additive rules fragment | **PASS for the claimed direct-lock delta** | All nine named server-owned subcollections, including `review_cursors` and `compose_keys`, appear in create/update/delete exclusions and in the emulator case list. The stale “five” comment is editorial. |
| B1 replay formula sharing | **PARTIAL PASS** | B1/B3/B4 call one replay implementation, but the consumer decision logic still misses mutations and the manual-override exception remains fail-open. |
| B3 writer | **NO-GO** | Not convergent, not zero-write-idempotent, no durable-before-write backup, no executable new-watermark delta path, incomplete baseline binding. |
| B4 verifier | **NO-GO** | Can miss post-watermark adjudications on old attempts and stale/extra labels; reports a verdict separately from an unconsumed delta list. |
| Stage-1 artifact freeze | **NO** | Track B and H6 still have launch-authority/concurrency blockers. |
| Shadow plan v3 | **NO** | Its own identity, auth, fidelity, isolation, containment, monitoring, CLI, and permission claims conflict. |

## A. Track B — blocking defects

### A1. Post-watermark adjudication of an old attempt is still invisible

The shared library scans current challenge rows before the attempt watermark fence and correctly exposes
`adjudicatedAtOrAfterWatermark` (`b1-replay-lib.mjs:29-47`). The consumers do not use that current fact unless
the **baseline** already told them to recompute:

- B3 calculates `flagged` solely from `base.mutationRisk` and calls the shared library only when the baseline
  flag, epoch drift, or missing baseline row says so (`b3-backfill-writer.mjs:85-109`).
- B4 repeats the same baseline-only decision (`b4-verify.mjs:53-71`). Its separate delta scan looks only for an
  attempt whose `submittedAt >= manifest.watermark` (`:72-77`).

Concrete false-green sequence: B1 snapshots an unchallenged attempt submitted before the watermark; after B1,
a teacher accepts/rejects a challenge on that same attempt; B3 sees no baseline mutation flag and writes the
old expectation; B4 sees neither a baseline flag nor a post-watermark `submittedAt` and compares against that
same old expectation. `challengedAttemptIds` is produced by the library (`b1-replay-lib.mjs:44-46`) but is never
consumed as a change detector.

Required closure: persist a challenge/adjudication revision or digest at B1 and compare it live in B3/B4, or
unconditionally scan/recompute the in-scope students at cutover. The detector must cover changes to old
attempts, not just newly submitted attempts.

### A2. The advertised cutover delta cannot be applied by these scripts

B4 can list students with post-watermark attempts, but B3 recomputes them using the **old** baseline watermark
(`b3-backfill-writer.mjs:102-105`). The replay fence excludes every attempt at or after that value
(`b1-replay-lib.mjs:49-53`). B1 always creates its watermark from `Date.now()` and has no UID-delta mode
(`b1-expected-labels.mjs:53-65,90`); B3 has no per-student delta input; B4 only emits `deltaList`
(`b4-verify.mjs:109-117`).

Therefore the comment that an activation barrier consumes “rerun B1→B3 for exactly these students”
(`b4-verify.mjs:7-10`) has no executable implementation. A verdict of `ZERO-DIFF` is also independent of a
non-empty delta list (`:111-114`), so a caller can treat the comparison as green while known late work remains.

Required closure: implement a hash-bound delta artifact, a fresh cutover watermark, exact UID-scoped B1 and
B3 modes, and one fail-closed barrier whose success requires both zero diff and an empty/applied delta.

### A3. B3 cannot satisfy the second-pass zero-write gate

For every expected word, B3 constructs an update without reading the current label values
(`b3-backfill-writer.mjs:110-123`), then queues a `BulkWriter.set` for every entry and increments
`docsWritten` by the full write count (`:125-136`). An already-correct document is still a billed write and may
receive a new update event. Thus the shadow plan's explicit “run B3 AGAIN: second pass must write ZERO changes”
gate (`16_SHADOW_COHORT_AUDIT.md:111-113`) is impossible on a genuine second full pass.

Using `--resume` is not a substitute: after a complete run, the cursor causes every UID to be skipped without
re-reading state (`b3-backfill-writer.mjs:72-84,139`). That can manufacture a zero-work report while proving
nothing. The fixed run ID and append-mode artifacts (`:72-76`) also merge retries/reruns into the same files.

Required closure: read current target fields, emit/write only exact diffs, make each run ID unique, bind resume
to an immutable run manifest, and distinguish “verified equal” from “skipped by cursor.”

### A4. Null expectations do not converge stale state

The writer omits each nullable timestamp when the expected value is null
(`b3-backfill-writer.mjs:115-121`). Merge-write omission preserves an existing value. After a partial prior run,
changed adjudication, or replay-law correction, stale `reviewLastFailedAt`, `reviewLastCorrectAt`,
`reviewLastProvenAt`, `reviewLastTestedAt`, and optional `reviewRestingUntil` can survive forever. B4 may detect
some such diffs, but B3 has no repair operation for them.

Required closure: expected-null must map to `FieldValue.delete()` for every field owned by this backfill, with
pre-image, write-plan, verifier, and idempotency coverage for deletion as well as setting.

### A5. “Backup before any write” is not durable

The pre-image stream is opened in append mode (`b3-backfill-writer.mjs:75`); each record is merely passed to
`backup.write()` (`:125-130`); production writes start immediately afterward (`:132-136`); and the stream is
closed only after every student has been processed (`:143`). No drain/flush/fsync barrier occurs before the
corresponding Firestore write. A process or host failure can leave the mutation committed while its pre-image
is still buffered.

A retry is worse: because the run ID is deterministic and the backup is append-only, a partial execution can
append a **post-mutation** image of an already-touched document beside the original image. The artifact has no
unique-path invariant or committed batch boundary, so rollback provenance becomes ambiguous.

Required closure: materialize, close, hash, and atomically publish the complete pre-image before any execute
write; bind that hash into an immutable run manifest; reject an execute retry that would overwrite/append the
backup; record committed write batches separately.

### A6. Baseline and cohort provenance are not fully bound

B3/B4 select `full` if a full manifest happens to exist, otherwise accept `sample`, and verify only the JSONL
hash (`b3-backfill-writer.mjs:48-56`; `b4-verify.mjs:30-35`). They do not verify:

- manifest `probe`, `version`, and mode against the requested operation;
- `summarySha256` or the summary itself;
- that `classesMatched` exactly equals the supplied allowlist;
- that the baseline UID set exactly equals the live allowlist-derived UID set;
- that a production execute run is based on a full artifact.

Missing baseline students are silently live-recomputed at the old watermark
(`b3-backfill-writer.mjs:85-108`) rather than making scope drift fatal. This allows a sample artifact, stale
allowlist, or mixed artifact directory to drive a broad execute run.

Required closure: one explicit manifest path, full schema/hash verification, exact class and UID-set equality,
mode=`full` for production, and fatal scope drift unless a separately reviewed delta manifest authorizes it.

### A7. B4 can certify ZERO-DIFF with extra authoritative labels

B4 derives document references only from expected `listId|wordId` keys and iterates only those entries
(`b4-verify.mjs:79-102`). A `study_states` document absent from expected history but carrying one or more of the
six server-authoritative fields is never read. Extra/stale labels can therefore survive while
`stats.totalDiffs === 0` produces `ZERO-DIFF` (`:111-114`). The published miss details are also silently capped
at 2,000 (`:95,100`) without a truncation marker.

Required closure: enumerate the actual authoritative-label-bearing state in scope and perform a two-sided key
diff; include an explicit `diffsTruncated` flag and a complete machine-readable spill artifact.

### A8. Word identity can collapse across lists

Replay keys are `listId|wordId` (`b1-replay-lib.mjs:103-105`), but B3 strips the list and writes
`study_states/{wordId}` (`b3-backfill-writer.mjs:111-134`). Two lists containing the same word document ID for
one student produce two updates to one target document; write order can choose the winner. B4 similarly maps
both expected keys to one actual document (`b4-verify.mjs:79-100`). Random-looking IDs are not a schema proof.

Required closure: publish a full-cohort collision census and abort on any duplicate `(uid, wordId)` with
different list-derived expectations, or formally change the authoritative target identity.

### A9. Two authority decisions are still open/fail-open

The synthetic manual-override exception is a bare boolean bypass: any row with `manualOverride === true`
passes the `graded` requirement (`b1-replay-lib.mjs:54-56,83`). It is not constrained to the exact synthetic
anchor shape that the B1 comments claim. A malformed or unrelated manual override can mint history.

Separately, H6 freezes `reviewRestingUntil` as server resting truth and says B3 seeds it once from validated
legacy `masteredAt` (`15_H6_SCHEMAS_AND_CONTRACTS.md:21-23`), while B3 defaults to not writing it and exposes an
unreviewed raw `--seedRru` switch (`b3-backfill-writer.mjs:4-9,121`). Stage 1 cannot be frozen with a required
authority field both default-off and optionally enabled by an operator flag “pending the ruling.” Decide the
law, remove the unsafe alternate mode, and test the chosen path.

## B. Cursor and H6 — remaining closure failures

### B1. The reference fixture is green, but the frozen property is still inconsistent

Independent run result:

```text
rotation-cyclicity-fixture: 2680 checks, 0 failures
```

The burst-return, intake-growth, and graduation-churn cases are useful. The fixture's honest P1C assertion is a
two-lap window: a word meeting its continuity conditions must appear in lap `k` **or** `k+1`
(`rotation-cyclicity-fixture.mjs:134-165`). But the governing product spec still says “every word active across
a full cursor lap ... is served within it” (`10_REVIEW_GRADUATION_REDESIGN.md:46-48`) and later says the
rotation reaches every word “each cycle” (`:68-70`). The implementation commentary itself explains why
single-lap bookkeeping can miss and tests the weaker two-lap statement (`rotation-cyclicity-fixture.mjs:138-139`).
One exact guarantee must replace all three wordings.

The fixture header also claims a mid-lap queue-size-change leg (`rotation-cyclicity-fixture.mjs:10-12`), but its
only queue-size changes occur after each prior coverage loop, at lap boundaries (`:96-104`). `runLapCase` keeps
`queueSize` constant (`:140-203`). The claimed case is absent.

Finally, this is still a standalone reference composer. Deferring the extracted-production differential to a
launch gate is acceptable only if the stage-1 contract is exact; it cannot compensate for the contradictions
above.

### B2. Same-day dual-class composition double-advances the shared cursor

Queue IDs are class-scoped (`15_H6_SCHEMAS_AND_CONTRACTS.md:30-33`), while the cursor is shared by
student+list+epoch and carries `lastLogicalDay`/`lastQueueRef` (`:49-55`). The creation transaction says an
existing **queue doc** converges (`:36-43`), but two classes have different queue docs. If class A and class B
compose the same shared logical day concurrently, Firestore serializes the cursor conflict: A creates its queue
and advances the cursor; B retries, creates its distinct class queue, and advances the cursor again. Both
requests succeed, so one shared logical day consumes two sweep segments and yields class-dependent pinned
content.

Nothing says that `lastLogicalDay` causes the second compose to reuse `lastQueueRef`, nor defines the posture/
snapshot policy if the two classes differ. This is exactly the kind of authority/concurrency invariant the
schema must freeze, and the pure fixture cannot test it.

Required closure: define and test the same `(uid,list,epoch,logicalDay)` CAS/reuse law across classes, including
mixed class posture/config, or make cursor advancement class-scoped and reconcile that choice with shared
progress. The unused cursor fields are not a lock by themselves.

### B3. Cursor state wording and underflow implementation disagree

H6 says `cursorWordIndex` is the “highest active-sweep index served” (`15_H6...:53-55`). On a wrapped queue,
the numeric highest index is not the last point in cyclic traversal; the reference advances to the last queue
member (`rotation-cyclicity-fixture.mjs:34-40`). Under underflow, the reference instead stores
`max(active indexes, prior cursor)` (`:42-44`). If every current active index lies below the prior cursor, the
prior cursor survives even though H6's “highest ... served” would be a current active index. The handoff's
“top-ups never move it” does not resolve whether serving the entire active underflow pool moves it.

Required closure: specify the exact transition as code/pseudocode for normal, wrap, active-underflow, no-active,
and OFF→ON/reset cases, then assert persisted cursor outputs in the differential fixture.

### B4. Count-query residue and first-use allocator ambiguity remain

The frozen allocator paragraph correctly says no count query and describes a counter doc
(`15_H6...:79-85`), but the rerun paragraph still says `seq from a per-(identity) count query in the txn`
(`:90-94`). The count-query instruction is therefore not retired everywhere as the handoff claims.

The counter paragraph also says create the doc with `next:1` on first use and allocate the pre-increment value,
without saying which value the first request receives or what value is persisted after it. Freeze a worked
first-use/retry sequence (for example allocate 1 and persist 2) for both new-day and rerun families.

### B5. Reset fencing and cleanup do not reach the newly introduced state

The locked-operation list names compose, submit, completion, grading **claim**, label write, challenge accept,
and rerun compose (`15_H6...:207-216`). It still does not explicitly fence grading finalize/write recovery,
force-pass/teacher override, or the B3/backfill writer. Those paths can mutate attempts/labels while reset owns
the epoch unless their transactional predicate is frozen here.

The delete set omits both new collections `review_cursors` and `compose_keys` (`:215-222`). That contradicts
the cursor clause's “reset deletes it” (`:55`). A stale compose-key claim can also make a legitimate post-reset
request replay/refuse forever if the client reuses the token. Add both collections to the queryable stale-epoch
cleanup and reconciliation law, plus every writer/finalizer to the lock fence.

### B6. Raw compose keys are not a safe registry document identity

The contract places the client-minted `composeKey` directly in
`users/{uid}/compose_keys/{composeKey}` (`15_H6...:59-68`) but gives no canonical format, length bound, or hash.
A slash/path-shaped or overlong token can fail before the intended typed replay law; multiple textual encodings
can also undermine canonical identity. Freeze a validated token format or a delimiter-safe hash doc ID while
storing the original canonical value for fingerprint comparison, and add malformed/boundary fixtures.

### B7. Quarantine response is not folded into the frozen retry table

Section 6d defines `job_quarantined` and a terminal retry behavior (`15_H6...:167-176`), but the “frozen
shapes” table in §8 omits it (`:197-204`). The status-dependent phrase “writeContext absent where status
requires it” also lacks an exact status set. Put the precise predicate and response object in §8 and the job
state-machine fixture; prose in a separate section is not an executable frozen response contract.

### B8. Rules closure that did land

`audit/deepfix/task3/firestore.review_v2.rules:30-55` includes `review_cursors` and `compose_keys` in create,
update, and delete exclusions. Lines 62-68 enumerate all nine server-owned collections, and emulator case 4
asserts both student and teacher writes are denied (`:105-117`). This direct rules delta is faithful. The line-58
comment still says “five new subcollection names,” but the actual lists—not that stale count—are the authority.

## C. Shadow plan v3 — not execution-ready

These findings do not block stage-1 freeze under the handoff's stated sequencing, but they do block the claimed
stage-3.5 execution readiness.

1. **Opaque IDs break the existing guards.** The clone now uses `zx{random}` UIDs and `shdw{origId}` class IDs
   (`16_SHADOW_COHORT_AUDIT.md:19,26`). Isolation still requires every ID/UID to carry `shadow_`/`SHADOW`
   (`:44-45`); cleanup queries `users/shadow_*` and Auth deletion requires an exact `shadow_` prefix (`:58-61`);
   metrics stamp `shadow: uid.startsWith('shadow_')` (`:71-75`). The new accounts will not be tagged or deleted
   by those guards, and their metrics can enter real aggregates. `zx` being “neutral” does not make a
   `shadow_` predicate pass.
2. **The auth law contradicts itself.** The clone table says all 947 accounts have no passwords and use custom
   tokens, with passwords only for about 30 Playwright accounts (`:29`). The hygiene law and Q2 still require
   random passwords for every account (`:71-73,184-186`). The granted Q2 evidence approved the password design
   (`winclaude_069.md:24-30`), not the later all-custom-token substitution. Choose one exact provisioning,
   storage, expiry, revocation, and cleanup flow and reconcile permission to that flow.
3. **The clone-fidelity command cannot run.** The plan requires B1 `--watermark` and `--outDir`
   (`16_:94-104`), while B1's known arguments are only `cohort`, `limit`, `full`, and `classAllowlist`
   (`b1-expected-labels.mjs:53-65`), and it always chooses `Date.now()`/a fixed local output directory (`:90,108-113`).
4. **“All 947” fidelity permits omissions.** The snapshot fence retries then flags/skips students and aborts
   only above 2% (`16_:93-96`). Up to roughly 18 students can therefore be missing while the plan calls B1
   equivalence and Audit A/B full-947. Either zero skips is the gate or every downstream cohort claim/report
   must use the exact reduced immutable UID set.
5. **Scenario partitions do not isolate the launch substrate.** Audit A establishes the launch-state clone;
   Audit B then composes for every account, mutating queues/cursors/presentations before the disjoint C-L
   partitions begin (`16_:83-96,111-125`). N/O/P also contain destructive config/job/evidence operations but
   are not assigned explicit restore-isolated partitions. Export/restore must occur after every broad mutator,
   or each mutating battery needs an independently cloned partition.
6. **The in-process wrapper does not contain deployed server writes.** The wrapper described around clone/
   driver writes (`16_:96-100`) cannot intercept writes made by deployed callables under the production service
   account. Shared-surface digests and spot hashes can detect some damage after it occurs; they do not make
   “no real doc changed” (`:156-159`) true or contain a defective backend writer. A server-side rehearsal
   registry/namespace authorization guard plus complete audit-log/diff coverage is needed before same-project
   rehearsal.
7. **Monitoring is internally contradictory.** The plan says real consumers filter out `shadow:true` rows
   (`16_:50-53`) and also says Audit I feeds that filtered shadow stream through the real threshold-computation
   path (`:136-138`). A production consumer that correctly excludes shadow rows cannot simultaneously compute
   shadow thresholds. Use a side-effect-free evaluator over explicitly selected shadow input, and separately
   prove real consumers exclude it.
8. **Minimization is not consistently defined.** `study_states` is cloned “full” (`16_:20`) while the plan
   elsewhere requires field-level minimization and free-text rejection. Freeze collection-specific output
   schemas, not a mix of “full” and a global allowlist promise.
9. **Permission reporting does not match the evidence.** The handoff/plan say B-E are pending
   (`claude_to_codex_deepfix2_r59.md:35-37`; `16_:176-180`). The cited r69 review says B, C, and E are granted;
   D's relaxed hosting/ON interpretation was held; the global ON switch remains unauthorized and unnecessary
   (`winclaude_069.md:118-148,173-204`). Reconcile one permission ledger before execution. This bookkeeping
   mismatch is secondary to the technical blockers above.

## Acceptance conditions for the next closure attempt

Stage 1 can be presented as freeze-clean only after evidence demonstrates all of the following:

1. A mutation/delta protocol detects adjudications to old attempts, creates a fresh cutover watermark, and has
   executable exact-UID B1→B3 consumption with one fail-closed activation verdict.
2. B3 is two-sided and convergent: expected-null deletes stale fields, already-equal docs produce no writes,
   list/word collisions abort, resume cannot masquerade as verification, and a complete hash-bound pre-image is
   durable before the first write.
3. B3/B4 require a fully verified full baseline whose class/UID scope equals the requested allowlist; B4
   performs a two-sided actual/expected scan and makes delta/truncation state part of its verdict.
4. `reviewRestingUntil` and the exact synthetic-manual-override eligibility shape have one frozen, fail-closed
   law with no operator-selectable authority alternate.
5. H6 defines same-day cross-class cursor serialization/reuse, exact cursor transitions including underflow,
   one counter allocator with no count-query residue, and reset fencing/cleanup covering every writer plus
   `review_cursors` and `compose_keys`.
6. The fixture tests the exact frozen wording, mid-lap size changes, persisted cursor state, same-day dual-class
   contention, reset, and OFF→ON behavior; the launch differential then runs those properties against the
   extracted production composer.

The shadow plan separately needs one internally consistent namespace/auth scheme; existing CLI support; zero-
skip fidelity or truthful reduced scope; restore-isolated destructive batteries; server-side containment;
side-effect-free shadow monitoring evaluation; and a reconciled permission ledger.

## Independent checks executed

- Read and validated round-59 baton revision 190, owner `codex`, handoff path, and written-last ready marker.
- `node --check` passed for all five changed scripts.
- `node scripts/deepfix2/rotation-cyclicity-fixture.mjs` → **2,680 checks, 0 failures**.
- `git diff --check` passed (only existing LF→CRLF working-copy warnings were emitted).
- Static traced B1/B3/B4 argument parsing, baseline loading, mutation decisions, replay watermark, pre-image/
  write ordering, null handling, resume behavior, and B4 actual-key enumeration.
- Compared the shadow permission claims to `docs/plans/loop/win/reviews/winclaude_069.md` rather than accepting
  the handoff summary.

