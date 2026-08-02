# Codex round 60 — stage-1 freeze attempt and shadow-v4 review

**Reviewed:** 2026-08-03  
**Round disposition:** **DONE**  
**Stage-1 freeze:** **NO**  
**Track B v2:** **NO-GO — CUTOVER/DELTA PATH IS NOT EXECUTABLE**  
**Cursor/H6:** **PARTIAL — MATERIAL CLOSURES, PERSISTED LAW STILL CONTRADICTORY**  
**Shadow execution-readiness:** **NO**

## Ruling

Round 60 is a substantial improvement, but it is not freeze-clean. The most important result is a new concrete
false-green/impasse in the Track-B cutover choreography: B4's delta artifact cannot be fed through B1 and B3 in
the advertised sequence, and even a manually adapted sequence can never make the original B4 verdict reach
`PASS`. The incompatibilities are in the current CLI and hash contracts, not missing explanatory prose.

The rewritten B3 does now compare current values, emit deletes for expected-null fields, and publish its
pre-image before starting its write loop. However, its final writes do not re-read the reset lock/epoch or use
write preconditions. That directly contradicts H6's new “B3 final txn” fence and allows a long phase-1 snapshot
to overwrite a concurrent legitimate label write. The broader attempt-mutation detector also hashes only four
challenge metadata values even though replay depends on score, correctness rows, type, total, teacher-edit, and
preOverride fields.

The cursor reference fixture independently passes **2,683 checks / 0 failures**, and the new mid-lap size leg is
real. The claimed “one wording everywhere” is still false, the reference underflow transition still differs
from H6's exact transition, and same-day cross-class reuse is undefined when the two class assignments have
different queue sizes.

The shadow plan is closer, especially on cleanup IDs, reduced-cohort honesty, passwordless auth, restore
partitions, and monitoring separation. It is still not executable: its reduced-set Audit A depends on the
broken delta/B3 interface, its deployed metrics guard cannot test UID membership from a UID-set hash, and its
containment claim assumes every callable writes only for the authenticated UID even though the planned teacher
flows intentionally write a different student's state.

`codexDecision=DONE` means this review turn is complete. It does **not** mean GO or freeze approval.

## Scope verdicts

| Scope | Verdict | Independent result |
|---|---|---|
| A1/A2 mutation + cutover delta | **MISS / BLOCKER** | Challenge pending→adjudicated changes are detected, but the detector is not a full replay-input digest and the B4→B1→B3 artifact chain is mutually incompatible. |
| A3/A4 B3 convergence | **PARTIAL PASS** | Exact field diffs and deletes landed. Extra label-bearing docs remain unrepairable, and concurrent writes can be overwritten after the phase-1 read. |
| A5 backup-first | **PARTIAL PASS** | Pre-image publication precedes phase 2. Full-cohort state is held in memory, partial execution is not resumable/journaled, and no conditional-write binding protects the pre-image/current-state relationship. |
| A6 baseline/scope binding | **MISS** | B3 improved but still makes required hashes/class binding optional; B4 retains the old sample/full autodetection and one-hash trust model. |
| A7 two-sided B4 | **PARTIAL PASS** | Extra authoritative-field presence now prevents PASS, but only one extra row per field is reported/counted and B3 has no cleanup path for it. |
| A8 word collision | **PARTIAL PASS** | B1/B3 abort on divergent collisions; B4 computes the census but never checks it. |
| A9 authority law | **PARTIAL PASS** | The B3 RRU write flag is dead and graded-false manual overrides no longer pass. Governing docs and B1/B4 still carry the retired RRU-seed/check path. |
| H6 counter/key/quarantine folds | **PASS** | Count-query residue was removed, first allocation is explicit, compose keys are validated+hashed, and `job_quarantined` is in §8. |
| Cursor fixture v4 | **PARTIAL PASS** | 2,683/0 and genuine mid-lap mutation, but the certified text and underflow transition are not unified with H6/reference code. |
| Same-day cross-class cursor law | **MISS** | It prevents double advance only for equal effective queue semantics; differing per-class queue sizes make the reused content contradict the receiving queue snapshot. |
| Shadow v4 | **NO** | Several r59 inconsistencies are fixed, but registry, containment, reduced-set execution, monitoring wording, and full teacher-isolation proof remain open. |

## A. Stage-1 blockers

### A1. The B4 → B1 → B3 delta workflow cannot execute

The implemented artifacts do not compose:

1. B4 writes a **delta object** `{probe, version, uids, reasons, baselineManifestSha256, ...}`
   (`b4-verify.mjs:133-139`). B1 `--uids` accepts only a JSON **array of strings**
   (`b1-expected-labels.mjs:89-96`). There is no bound extractor or command that preserves the B4 artifact's
   hash/provenance while supplying B1.
2. B1 with `--uids` always publishes `mode:'delta'` (`b1-expected-labels.mjs:102-105,191-195`). B3 rejects any
   execute baseline whose mode is not `full`, unless `--allowSampleExecute` is supplied—the latter is documented
   as shadow-only (`b3-backfill-writer.mjs:17,47-50`). A production delta baseline therefore cannot execute.
3. B4 binds its delta manifest to the **old full baseline manifest** (`b4-verify.mjs:135-137`). After B1 creates
   a fresh-watermark delta baseline, B3 compares that old-baseline hash to the `--manifest` it was given
   (`b3-backfill-writer.mjs:60-64`). Passing the fresh delta manifest fails the binding. Passing the old full
   manifest satisfies the hash but discards B1's fresh expectations and recomputes at the old watermark.
4. B4 cannot verify the fresh delta baseline. Its CLI accepts only `--baseline`, auto-selects only `full` or
   `sample`, and has no UID/delta mode (`b4-verify.mjs:21-38`).
5. Re-running B4 against the original full baseline can never empty its delta: every attempt whose
   `submittedAt >= original watermark` is added again (`b4-verify.mjs:78-83`). Applying a delta does not alter
   that historical timestamp, so the composite verdict remains `ZERO-DIFF-BUT-DELTA-OUTSTANDING` forever.

This invalidates the handoff claim that B4 emits a manifest “consumable by B1 --uids → B3 --deltaManifest at a
fresh watermark.” The activation barrier has no reachable success state.

Required closure: define one immutable chain such as `old full manifest → B4 delta manifest → B1 fresh delta
manifest`, record hashes of **both** parent artifacts in the fresh manifest, let production B3 execute an exact
delta mode, require exact equality between delta UIDs and delta-baseline UIDs, and define a verification ledger
that marks each old-watermark delta applied without rediscovering it forever. Ship one end-to-end local/mock
fixture exercising nonempty delta through final PASS; syntax checks are insufficient.

### A2. `challengeDigest` is not a replay-input mutation digest

The new digest is useful for the exact pending→accepted/rejected case: it hashes attempt ID, word ID, challenge
status, and reviewed-at (`b1-replay-lib.mjs:32-50,140-141`). But replay output also depends on session type,
stored/preOverride score, totalQuestions, `answers[].isCorrect`, teacherEdited, list/class/day, timestamp, and
duplicate content (`:52-115`). None of those values is in `challengeDigest`.

B3 and B4 decide whether to replace a baseline expectation using only epoch comparison and that challenge
digest (`b3-backfill-writer.mjs:103-116`; `b4-verify.mjs:55-77`). B4's other detector only sees a newly
submitted attempt. An in-place teacher edit/override or any correction of an old attempt's replay-relevant
fields can therefore leave both the expectation and the verifier stale. This conflicts with the governing
cutover requirement for reset/**challenge/override** ordering (`14_TRACK_B_BACKFILL_PIPELINE.md:90-95`).

Required closure: hash a delimiter-safe canonical projection of every replay-relevant field of every attempt
(or a server-authored immutable attempt revision), and compare that full digest live. Challenge-only metadata
can remain as a diagnostic sub-digest.

### A3. B3 violates H6's final-transaction reset/concurrency fence

H6 now says the B3 writer rejects `reset_in_progress` and every writer's **final transaction** re-reads epoch and
lock (`15_H6_SCHEMAS_AND_CONTRACTS.md:220-240`). The script does neither:

- Phase 0 reads attempts/tombstones and fixes expected state (`b3-backfill-writer.mjs:101-118`).
- Phase 1 reads all current target documents and publishes a cohort-wide plan (`:121-169`).
- Phase 2 later performs unconditional `BulkWriter.set(..., {merge:true})` operations (`:171-183`).

There is no final tombstone read, lock read, update-time precondition, or transaction. A reset, challenge,
post-watermark attempt, or dark-deployed label write can land between phase 1 and phase 2. B3 then overwrites
that newer authoritative value with its stale plan. Collapsing expectations to `wordId` at `:126-128` also
throws away the list identity needed to enforce a per-(uid,list) reset lock at write time.

Required closure: retain each target's list binding, and commit each bounded group in a transaction (or with
verified update-time preconditions plus a transactional epoch/lock guard). On conflict, abort/recompute rather
than overwrite. Add a deterministic fixture that inserts reset/label/challenge mutations after phase 1 and
proves no stale write commits.

### A4. Baseline trust remains fail-open, especially in B4

B3's claimed mandatory checks are conditional:

- `summarySha256` is verified only if it exists (`b3-backfill-writer.mjs:53-54`).
- `classesMatched` is compared only if it exists (`:76-80`).
- any numeric version ≥6 is accepted rather than one exact understood schema (`:47-48`).
- duplicate baseline rows silently overwrite in a `Map` (`:55-56`).

B4 did not receive the A6 rewrite at all. It auto-picks full if that filename exists, otherwise sample; verifies
only the JSONL hash; does not check probe/version/summary/class set/UID equality; and silently live-recomputes
students missing from the chosen baseline (`b4-verify.mjs:30-48,55-74`). A sample or mixed artifact directory
can therefore drive a broad comparison and potentially report PASS without the claimed frozen full-baseline
provenance.

Required closure: make all manifest fields required and exact, reject duplicate UID rows, accept one explicit
manifest in B4, and enforce exact class/UID scope there as in B3. A production verifier must refuse sample,
delta, or mixed-mode input unless it is executing the explicitly defined delta-verification state machine.

### A5. B3 and B4 still disagree on epoch/collision decisions

B3 compares the complete live and baseline epoch objects (`b3-backfill-writer.mjs:108-115`). B4 iterates only
lists present in the baseline object (`b4-verify.mjs:66-68`), so a newly created tombstone/list epoch can be
missed and omitted from the delta. The comment that both use “the SAME rule” is false.

The shared library returns `wordIdCollisions` (`b1-replay-lib.mjs:143-150`). B1 and B3 abort on it, but B4
ignores `live.wordIdCollisions` after computing live replay (`b4-verify.mjs:69-74`). The handoff's claim that
“consumers ABORT” is therefore also false.

### A6. The two-sided verifier detects state that the writer cannot repair

B4's six existence sweeps now ensure at least one extra label-bearing document prevents PASS, which is a useful
fail-closed improvement (`b4-verify.mjs:92-102`). But B3 enumerates targets only from expected history
(`b3-backfill-writer.mjs:124-150`). It never enumerates or deletes authoritative fields on actual documents
absent from expected. Once B4 finds such residue, this pipeline has no backed-up remediation path.

The B4 detail/count is also not actually a document census: the inner `break` reports at most one extra row for
each of six fields and can count the same document repeatedly (`b4-verify.mjs:96-101`). `extraLabelDocs` is not
the number its name claims.

Required closure: produce a deduplicated two-sided target map, feed removals into B3's pre-image/write plan, and
verify exact absent-field convergence. Preserve the capped presentation list if desired, but publish exact
counts and a complete spill artifact.

### A7. “Durable, resumable, rate-controlled” still mismatches the implementation

The phase split is safer than r59, but the script stores every full pre-image, every expected state, and every
write plan for the whole cohort in JavaScript memory, then materializes additional whole-cohort JSON strings
(`b3-backfill-writer.mjs:101-169`). The repository's own earlier census records roughly 897k `study_states` for
823 students (`change_action_log.md:22`); the current sample implies roughly 30k expected words per 50 students.
No bounded-memory rehearsal evidence accompanies this freeze attempt.

The governing plan still says durable per-student cursor/resumable, batch-limited, and rate-controlled
(`14_TRACK_B_BACKFILL_PIPELINE.md:78-88`). B3 v2 has no cursor/resume or explicit rate limiter. A partial phase-2
failure leaves an unresumable single-use run ID and no committed-batch journal; a new run's pre-image describes
the partially mutated state, complicating restoration against the original backup.

Required closure: stream/hash backups and plans with bounded memory, use an explicit throttling policy, and
either implement a hash-bound commit journal/resume or change the governing law to a tested abort→verify→new-run
recovery protocol with an unambiguous rollback chain.

### A8. The “one RRU law everywhere” fold is incomplete

The B3 operator flag is gone and H6 §1 clearly says `reviewRestingUntil` is live-only. But:

- H6 §10 still says it is “backfill-seeded from legacy masteredAt once”
  (`15_H6_SCHEMAS_AND_CONTRACTS.md:245-251`).
- B1 still queries legacy masteredAt, emits an `rru` seed, and publishes the retired seed law
  (`b1-replay-lib.mjs:118-139`; `b1-expected-labels.mjs:7-14,172-179`).
- B4 still exposes `--checkRru` and can compare that client-derived seed against the live-only server field
  (`b4-verify.mjs:21-28,114-118`).
- Track B §2 still calls `rru` “the validated resting seed” (`14_TRACK_B_BACKFILL_PIPELINE.md:56-64`).

These paths may now be read-only, but they disprove the handoff's “dead everywhere / one law” claim and can
turn a valid live-only state into an operator-selected B4 failure. Remove the seed from the canonical backfill
artifact/collision digest and retire `--checkRru`, or explicitly isolate it as a non-authoritative historical
diagnostic that cannot affect any verdict.

## B. Cursor/H6 review

### B1. Fixture v4 itself is green and the mid-lap leg is genuine

Independent result:

```text
rotation-cyclicity-fixture: 2683 checks, 0 failures
```

The new getter changes queue size every three composed days inside `runLapCase`
(`rotation-cyclicity-fixture.mjs:140-168,207-217`). The r58 burst-return case remains present. The counter
allocator, hashed compose-key, cleanup collection additions, and frozen quarantine response are faithful H6
improvements.

### B2. “One exact wording everywhere” is still not true

The governing queue paragraph now states the two-consecutive-lap property
(`10_REVIEW_GRADUATION_REDESIGN.md:38-49`), but the same document still says the rotation reaches every word
“each cycle” (`:68-71`). The fixture header still promises every word active for an entire lap is served **in
that lap** (`rotation-cyclicity-fixture.mjs:5-12`), while P1C explicitly tests only appearance in either of two
laps (`:134-166`). This is the exact contradiction r59 asked to remove.

### B3. H6's underflow transition still differs from the reference

H6's exact rule says an active-underflow day stores the last active member in traversal order
(`15_H6...:55-60`). The reference still returns `max(maxActiveIndex, priorCursor)`
(`rotation-cyclicity-fixture.mjs:41-44`). If the prior cursor is above every currently active index, it remains
unchanged instead of becoming the last served active index. H6's earlier creation paragraph also retains the
stale phrase “highest ACTIVE-sweep index served” (`15_H6...:34-39`), which is not traversal-last on wrap.

Required closure: update the reference and add assertions for the returned cursor—not only queue membership—for
normal wrap, active underflow below/above the prior cursor, no-active, reset, and OFF→ON.

### B4. Same-day cross-class reuse is not defined for different queue sizes

H6 says the second class reuses the first class queue's complete `orderedQueueWordIds`, takes snapshot fields
from **its own** assignment, and does not advance the cursor (`15_H6...:47-60`). If class A has queueSize 60
and class B has queueSize 30, B's queue record contains 60 reused words beside a snapshot claiming size 30.
Reversing arrival order gives the opposite result. One teacher's effective queue setting is silently ignored,
and content depends on the concurrent winner even though the clause calls it class-independent.

Required closure: choose and freeze one policy—for example, the first shared logical-day queue freezes one
shared queue-size/config tuple for all classes, or each class derives its own size without moving the shared
cursor twice—and add 60↔30 / ON↔OFF concurrent-class fixtures. `lastLogicalDay/lastQueueRef` alone does not
resolve cross-class config semantics.

### B5. H6 reset text landed, but B3 does not implement it

The reset clause now names finalize, force-pass, B3, cursors, and compose keys, which closes the documentation
list from r59. Because the actual B3 phase-2 writer has no final transaction/lock check (A3 above), this is a
claim/code mismatch and remains stage-1 blocking.

## C. Shadow v4 review

### C1. Reduced-cohort Audit A cannot be driven by the current B3 interface

The plan permits `947-k` after snapshot retries and says that immutable reduced UID set governs every downstream
step (`16_SHADOW_COHORT_AUDIT.md:99-105`). B1 can emit that subset with `--uids`, but the resulting manifest is
mode `delta`. B3 derives all 947 live UIDs from the shadow class allowlist and rejects baseline/scope mismatch
unless a `--deltaManifest` is present; the only producer of that artifact, B4, cannot read a delta baseline.
Even if one is manufactured, the production delta hash incompatibility in A1 applies.

Thus Audit A's “ALL 947”/reduced-set execution (`16_:121-125`) has no valid command line when any student was
skipped. Add an exact UID-scope input to B3 bound directly to the B1 manifest, and make all downstream scripts
consume the same cohort manifest.

### C2. The deployed registry membership test has no executable schema

The plan requires metrics writers to evaluate
`uid.startsWith('zx') && REHEARSAL_REGISTRY.has(uid)`, then describes the server-readable registry doc as
holding a **UID-set hash + class IDs** (`16_:79-83`). A hash cannot answer `has(uid)`. The path, exact UID
membership representation, rules, size/update/CAS law, cleanup, and callable cache-refresh behavior are not
specified.

If this is a new `system_config/*` write, the authority record expressly permits only the narrowed
`rehearsalClassIds`/shadow-scoped reviewGate writes and leaves every other system-config path forbidden
(`winclaude_069.md:97-109`). Either use an already-authorized exact server-side membership mechanism or request
specific authority for the new registry surface.

### C3. Callable auth scoping is not containment

The containment triad says a deployed callable writes only for its authenticated UID
(`16_:105-110`). The same plan intentionally exercises audit-teacher force-pass and class/config operations
that write a **student target different from the caller**, plus top-level attempts, jobs, counters, and metrics.
Authentication and ordinary authz are behaviors being audited; assuming they contain a defective writer makes
the safety proof circular.

Audit logs and hashes can detect damage after it occurs, but cannot make the opening “zero consequence” claim
true. Same-production co-tenancy was authorized, but that consent does not turn post-hoc detection into
containment. The dark build needs an explicit server-side rehearsal registry guard on every audit-capable
write path (target UID/class in the exact run registry, shared/reference collections denied), with a negative
matrix proving a shadow principal/audit teacher cannot target real IDs.

### C4. Monitoring and concurrency text still conflict

Law 11 correctly separates production exclusion from a side-effect-free shadow evaluator (`16_:79-83`), but
Audit I still says shadow rows are consumed by the “real threshold-computation path (filtered shadow:true)”
(`:146-148`). A production path that filters shadow rows cannot compute over them. Replace the battery text with
the two explicit invocations and prove both input predicates.

Battery D is called an “Admin-SDK harness” (`:135-137`) while the concurrency-realism clause says D drives the
deployed callable boundary with real tokens and never direct Admin calls (`:170-172`). If “Admin harness” only
orchestrates token-authenticated client calls, say that exactly; otherwise this remains a false-green route.

### C5. Teacher invisibility is still sampled, not proved

The isolation gate executes teacher-surface queries for only three real teachers (`16_:49-50`). That does not
prove zero visibility for every real teacher, especially when class IDs preserve the original class ID inside
`shdw{origId}`. Run the actual query for the complete real-teacher set or prove structurally from ownership and
rules plus a full class query. A three-teacher sample is useful smoke evidence, not an isolation invariant.

### C6. Improvements that did land

- Every `shadow_` cleanup/tag predicate was replaced with `zx` plus exact-registry membership.
- Passwordless custom-token auth with limited password exceptions is one coherent operational scheme in the
  normative laws.
- Reduced-cohort reporting is honest in principle.
- Post-A exports and per-battery restore/partition language now includes N-P.
- The wrapper is no longer claimed to intercept deployed writes.
- `study_states` now names an allowlisted output schema.
- The permission ledger correctly records B/C/E granted, hosting conditions retained, dark functions allowed,
  and the global ON switch parked.

Those gains should be preserved while closing C1-C5.

## D. Authority record interpretation

I read `winclaude_069.md` as follows:

- Q1-Q7 and narrowed A are granted; Q4 is 300 and Q7 authorizes full same-project scale.
- B, C, and E were later granted verbatim (`"Agreed."`).
- Dark function deployment is covered by Q3.
- Hosting remains conditional on OFF-parity + old-bundle evidence and a numbered order.
- The global `review_v2.enabled=true` flip is expressly **not authorized and not needed** for the audit;
  `rehearsalClassIds` is the approved mechanism.
- E does not silently lift A's explicit ban on other `system_config/*` writes.

That matches the final r69 record. I do not treat the passwordless/custom-token refinement as requiring a new
Q2 ask by itself: it creates fewer standing credentials and is plausibly within E. I do require a specific
path/schema/authority ruling if the new rehearsal registry adds a config write outside narrowed A.

## Required next closure

Do not start the dark build from a stage-1 YES yet. The minimum next handoff should include:

1. One tested, reachable old-baseline → delta → fresh-B1 → exact-B3 → final-PASS protocol, with compatible CLI
   shapes and parent hashes.
2. A full replay-input mutation digest and a B3 final write fence that cannot overwrite concurrent/reset state.
3. Required/exact baseline validation in both B3 and B4, identical epoch/collision rules, and a repair plan for
   two-sided extras.
4. Bounded-memory/rate/recovery evidence or an updated governing B3 law that honestly matches the implementation.
5. Removal of every retired RRU-seed/check path.
6. One cursor guarantee everywhere, a reference implementation matching H6 underflow, and a cross-class
   differing-config law+fixture.
7. For shadow: executable reduced-set scope, exact server-side registry membership with authority, non-circular
   server containment, corrected monitoring/concurrency wording, and full teacher-invisibility proof.

## Independent checks executed

- Validated baton owner `codex`, round 60, revision 192, task/handoff, and written-last ready marker.
- Read the actual B1 replay/B1 CLI/B3/B4/fixture sources and governing 10_/14_/15_/16_ plans.
- `node --check` passed for all five Track-B/fixture scripts.
- `node scripts/deepfix2/rotation-cyclicity-fixture.mjs` → **2,683 checks, 0 failures**.
- `git diff --check` passed apart from existing LF→CRLF warnings.
- Verified the refreshed sample artifact carries 64-hex challenge digests; this does not exercise the delta or
  write protocols.
- Compared permission claims to the full r69 authority record and the r70 commit evidence.

