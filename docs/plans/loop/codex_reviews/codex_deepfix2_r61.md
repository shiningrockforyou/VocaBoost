# Codex round 61 — r60 closure / stage-1 freeze review

**Reviewed:** 2026-08-03  
**Round disposition:** **DONE**  
**Stage-1 freeze:** **NO**  
**Track B v3:** **NO-GO — DIRECT DELTA CHAIN STILL DOES NOT COMPOSE; EXECUTION IS FAIL-OPEN**  
**Cursor/H6:** **PARTIAL — REFERENCE TRANSITION FIXED, CONTRACT SET STILL CONTRADICTORY**  
**Shadow execution-readiness:** **NO**

## Ruling

Round 61 closes meaningful parts of r60, but it is not freeze-clean. The replay-input digest now covers the
eligible attempt facts that determine replay output, the reference cursor implements the underflow transition,
P1D checks returned cursor values, B4 can overlay delta baselines, and B3 now computes exact field diffs with
document update-time preconditions. Those are real improvements.

The advertised delta command chain still cannot be run as written. B4 emits a run-named **object**, B1
`--uids` accepts a bare **array**, and the shared loader later requires a file named exactly
`delta-auth.json`. There is no materializer, rename/copy step, or end-to-end fixture in the repository. More
seriously, B3's tombstone read is not in the final write transaction, reset-locked students are skipped with a
successful process exit, and B4 also exits successfully for every non-PASS verdict. A normal shell pipeline can
therefore stay green after skipped or divergent state.

B3's new journal is unsafe as a recovery authority: it records a UID even after residual write failures, and
`--resume` does not bind the invocation to the published run manifest. A dry-run backup can be resumed with
`--execute`, a different baseline/scope/delta/extras report can reuse the same backup, and newly planned writes
on resume need not have any pre-image in that backup. The implementation also still retains the full baseline
and whole-cohort write plan in memory, so streaming only the backup did not establish bounded memory.

The shadow registry is now a real membership set in prose, and the audit-teacher ownership argument is much
better grounded in the existing target-bound override code. But the registry introduces a new
`system_config/*` surface that the current authority record explicitly does not permit, B3/B4 do not consume
the claimed immutable reduced UID file, and the monitoring and teacher-visibility contradictions from r60
remain.

`codexDecision=DONE` means this review turn is complete. It does **not** mean GO or freeze approval.

## Seven-claim result

| Handoff claim | Verdict | Independent result |
|---|---|---|
| 1. One tested delta protocol | **MISS / BLOCKER** | Per-UID overlay logic exists, but B4 output, B1 input, and the canonical layer filename do not compose; no nonempty-delta integration fixture exists. |
| 2. Full digest + fenced writes | **PARTIAL / BLOCKER** | The replay digest materially improved. Update-time preconditions landed, but the reset lock remains a read-before-write TOCTOU and both B3/B4 have fail-open exit behavior. |
| 3. Binding + extras/corrupt repair | **MISS / BLOCKER** | Corrupt values are repaired, but baseline schema checks remain optional/incomplete and `--repairExtras` accepts an unbound report capable of cross-scope deletes. |
| 4. Bounded/honest execution | **MISS / BLOCKER** | Backup bytes stream, but baseline rows and every plan remain in RAM; stream backpressure is ignored; resume can change the authorized run and journals failed UIDs as committed. |
| 5. RRU residue gone | **MISS** | Runtime B3 no longer writes RRU and B4 asserts absence, but B1 headers/summary and Track-B/H6 contracts still state the retired seed law. |
| 6. One cursor guarantee | **PARTIAL** | P1D and the underflow reference fix pass. Counts/wording are stale, H6 still says “highest,” and differing-size first-composer reuse creates a false receiving snapshot. |
| 7. Shadow executable | **MISS** | Exact UID membership is now representable, but its config authority is missing, reduced UID-file consumption is not implemented in B3/B4, and isolation/monitoring gates remain contradictory or sampled. |

## A. Stage-1 blockers

### A1. The direct B4 → B1 → delta-layer chain still cannot execute

The new overlay resolver makes a manually assembled layer usable, but it does not make the handoff's command
chain coherent:

1. B4 writes `<runId>.delta-auth.json` containing an object with `probe`, `version`, `uids`, `reasons`, and the
   original manifest hash (`b4-verify.mjs:124-139`).
2. B1 `--uids=FILE` rejects that object; it accepts only a non-empty JSON array of strings
   (`b1-expected-labels.mjs:89-96`).
3. `loadDeltaLayer` does not look for B4's run-named file. It requires the selected directory to contain a file
   named exactly `delta-auth.json` beside `b1-manifest-delta.json` (`b-baseline.mjs:27-35`).
4. Repository search finds no layer-builder/materializer that extracts the UID array, preserves the B4
   artifact, and publishes those canonical names atomically.

An operator must therefore manually extract and copy/rename security-relevant artifacts. That is the same
interface break r60 identified, now hidden behind a helper. The handoff calls this “one tested delta protocol,”
but only syntax and the isolated cursor fixture were supplied; there is no fixture that starts with a nonempty
B4 delta and reaches final B4 `PASS`.

The custody link is also weaker than claimed. The fresh B1 delta manifest records neither the delta-auth hash
nor the original-manifest hash. The loader merely colocates two mutable files and compares their UID **sets**
(`b-baseline.mjs:36-41`), so a different B1 artifact with the same UID set can be substituted. Auth version,
reason shape, emitted run, and fresh-watermark ordering are not validated; a delta watermark merely has to be
positive. `resolveExpectedSource` silently ignores a declared older layer while B4 still lists its hash under
`appliedDeltas` (`b-baseline.mjs:44-51`, `b4-verify.mjs:128-130`).

Required closure: make B1 accept the B4 auth artifact directly or ship one atomic layer-builder; publish a
post-B1 layer manifest hashing M0, DA, M1, JSONL, and summary; require an exact supported schema plus strictly
advancing watermark; and add a local/mock nonempty-delta fixture through final PASS.

### A2. B3 and B4 are process-level fail-open gates

B3 detects a reset lock before queuing a student's writes, but a locked student is only counted and skipped
(`b3-backfill-writer.mjs:190-196`). `skippedResetLocked > 0` does not affect the exit status. The only nonzero
terminal condition is `preconditionFailures > 0` (`:242-247`). A B3 execution with omitted students therefore
returns success.

B4 has the same operational problem: it records `PASS`, `ZERO-DIFF-BUT-DELTA-OUTSTANDING`, or `DIFFS`, prints
JSON, and reaches end-of-file with status 0 in all cases (`b4-verify.mjs:124-141`). Thus a conventional
`B3 && B4 && activate` sequence stays green for reset-skipped students, diffs, outstanding deltas, corrupt
fields, extras, or a truncated report unless an unimplemented wrapper parses both JSON documents perfectly.

This is the exact false-green class the activation barrier must exclude. B3 must exit nonzero for every
uncommitted/skipped target, and B4 must exit 0 **only** for untruncated `PASS`.

### A3. The reset fence still violates H6's final-transaction law

H6 requires each writer's final transaction to re-read epoch and `resetInProgress`
(`15_H6_SCHEMAS_AND_CONTRACTS.md:221-241`). B3 instead:

- reads every tombstone collection before creating the BulkWriter (`b3-backfill-writer.mjs:190-198`);
- writes each independent target document with only that target's phase-1 `lastUpdateTime` (`:200-207`);
- on conflict, re-reads only the target `study_states` document and retries it (`:210-233`).

A reset can acquire its lock after line 196 and before any write or retry. The target document precondition does
not observe a different tombstone document, so the stale label write can still commit while reset is in
progress. The retry path never rechecks the lock at all. This is a real TOCTOU, not the claimed H6 §9 fence.

Required closure: retain the `(uid,listId)` binding in every plan and commit bounded groups in a transaction
that reads both tombstones and checks epoch/lock immediately before the label writes. A deterministic race
fixture must acquire the reset lock after phase 1 and prove that zero stale writes commit.

### A4. The commit journal and `--resume` authority are unsafe

The journal marks a UID committed unconditionally after the retry loop (`b3-backfill-writer.mjs:210-237`). If a
retry still fails, `preconditionFailures` increases, but the same UID is nevertheless appended. A later
`--resume` skips it as `resumedCommitted` (`:95,116-118`), permanently converting a known partial commit into a
claimed completed student.

Resume also trusts only the presence of the old backup path. It never loads or verifies the existing run
manifest against the current invocation. Consequently the same run ID can be resumed with:

- `--execute` after the published run manifest said `mode: DRY`;
- a different manifest, allowlist, delta directory, or extras report;
- a newly recomputed plan containing target documents absent from the original pre-image.

On resume `preStream` is null (`:104-107`), no new pre-images are captured, the new in-memory plan hash is not
compared with the old manifest, and the manifest is not republished (`:172-183`). Those writes therefore lack
the backup-first authority the header claims.

Required closure: hash-bind the complete immutable invocation; reject DRY→EXECUTE and any argument/artifact
change; verify backup and plan hashes before resume; journal a UID only after every intended write is confirmed;
and leave failed/locked UIDs pending with a nonzero result.

### A5. `--repairExtras` is an unbound cross-scope deletion authority

B3 validates only `probe === 'b4-report'` and that `extrasList` is an array
(`b3-backfill-writer.mjs:59-65`). It does not bind the report to:

- the selected original manifest or applied delta hashes;
- the selected allowlist/live UID set;
- an untruncated B4 run or its verdict;
- valid, unique string UID/word IDs and a permitted field list.

It then opens exactly the report-supplied `users/{uid}/study_states/{wordId}` and deletes **all six** fields,
even for a UID outside `uids` (`:154-165`). Those foreign UIDs are inserted into `planByUid` and written during
phase 2. A stale, foreign, or edited JSON file can therefore authorize destructive cross-cohort deletes while
the result still reports `stats.students = uids.length` (`:242`), excluding those extra targets from the
student count.

B4's detail output is not a complete spill artifact either. It counts all extra documents but retains only the
first 5,000 repair entries and sets the shared truncation flag (`b4-verify.mjs:109-132`). Repeated detect/repair
runs may eventually converge, but that is not “enumerated FULLY, spill-safe” and no one-pass repair authority
exists.

Required closure: cryptographically bind the exact B4 report and applied chain, refuse truncated input, require
every target UID in the selected execution scope, validate/deduplicate every tuple, and publish a complete
hash-bound spill file for repair.

### A6. “Full A6” validation remains fail-open and is not cross-platform

The shared loader verifies both payload hashes, which is a good closure. It still accepts malformed authority
metadata:

- versions **greater than or equal to** 6 rather than one understood schema (`b-baseline.mjs:12-14`);
- absent/non-finite watermarks and arbitrary modes for B4;
- duplicate or malformed UID rows, silently last-write-wins in a `Map` (`:22-24`);
- an absent `classesMatched`, because both B3 and B4 compare it only when truthy
  (`b3-backfill-writer.mjs:76-79`; `b4-verify.mjs:44-47`).

An undefined watermark makes both `t >= watermark` checks false, eliminating the durable-boundary and
new-attempt detector without causing a loader error. B4 also does not require an original `full` manifest.

The path code is Windows-hostile in this Windows repository. `manifestPath.slice(...lastIndexOf('/')...)`
loses the directory for a normal backslash path (`b-baseline.mjs:15-17`). Independently, Node resolved B1
`--outDir=C:/tmp/delta/` to protocol `c:` rather than `file:`, while a relative path resolved correctly; the
construction at `b1-expected-labels.mjs:123-128` therefore rejects ordinary absolute Windows paths.

Required closure: exact schema validation (including positive finite watermark, exact mode, required class
set, unique non-empty UID rows and row shapes) and `node:path`/`pathToFileURL`-based path handling. Add Windows
path tests because this session no longer uses the old Docker workflow.

### A7. Backup streaming did not make execution bounded

`preimage.jsonl` now streams and hashes incrementally, but the implementation still loads the entire baseline
JSONL into `rows`, retains every student's complete plan in `planByUid`, then materializes `planFlat` and its
whole JSON serialization for the plan hash (`b-baseline.mjs:18-24`; `b3-backfill-writer.mjs:104-108,151-178`).
This remains whole-cohort memory proportional to the backfill.

The code also ignores the boolean return from `preStream.write` (`b3-backfill-writer.mjs:133,159`), so it does
not await `drain`; the writable buffer can grow without a bound. The r60 handoff's “no full-cohort RAM” claim is
therefore false.

Required closure: stream a durable plan file as well as pre-images, honor backpressure and stream errors, close
and hash both before phase 2, and replay the verified plan stream in bounded batches. Exercise it with a
synthetic cohort larger than the configured high-water memory envelope.

## B. Replay digest, verifier, and RRU

### B1. The replay-input digest core substantially landed

For eligible attempts, the digest now includes attempt identity, signature fields, effective score,
totalQuestions, sorted correctness rows, and teacher-edit/preOverride facts
(`b1-replay-lib.mjs:52-92`). Challenge rows are scanned before the eligibility fence and included separately
(`:33-50`). Inclusion/exclusion transitions add or remove the replay row, so the old “challenge metadata only”
blind spot is materially closed.

The remaining integrity issue is canonicalization: the digest uses delimiter-joined raw IDs/fields rather than
a length-delimited or JSON canonical projection (`:50,86-90,135`). Firestore IDs can contain delimiter/newline
characters, and no corresponding validation excludes them. Use a canonical structured encoding. The variable
name `challengeDigest` now also understates that this is the full mutation digest.

### B2. B4's two-sided/corrupt checks improved, but do not self-enforce

B4 correctly treats corrupt numeric/timestamp types as diffs, asserts `reviewRestingUntil` absent on expected
documents, deduplicates extra documents across six field queries, and makes truncation incompatible with a
`PASS` verdict (`b4-verify.mjs:55-68,94-132`). B3 can repair expected nulls and corrupt values.

Those gains should be preserved. They do not close A2/A5: the verifier returns process success for a failing
verdict, and its capped `extrasList` is not a complete bound repair artifact.

### B3. RRU runtime authority is retired, but the claimed residue purge is false

The operational expected word shape now has five fields and B3 never writes `reviewRestingUntil`. B4's
absence assertion is consistent with the live-only law. However, repository search still finds authoritative
or misleading retired text:

- B1's header says it emits a validated RRU seed and that B3 writes it behind `--seedRru`
  (`b1-expected-labels.mjs:7-14`), while that flag no longer exists.
- B1's summary still publishes “rru validated masteredAt seed” as its law (`:173-179`).
- Track B still defines canonical rows with `rru = the validated resting seed`
  (`14_TRACK_B_BACKFILL_PIPELINE.md:56-64`).
- H6 §10 still says `reviewRestingUntil` is “backfill-seeded from legacy masteredAt once”
  (`15_H6_SCHEMAS_AND_CONTRACTS.md:246-253`).
- The replay library header still describes RRU seed semantics (`b1-replay-lib.mjs:1-6`).

The legacy-resting census can remain clearly informational, but the removed seed cannot remain in headers,
artifact law strings, or governing contracts while the handoff says residue is gone.

## C. Cursor/H6 review

### C1. Reference transition and P1D pass

The underflow reference now stores the last active traversal member, and P1D directly checks normal, wrap,
underflow, no-active, and first-ever returned cursor values
(`rotation-cyclicity-fixture.mjs:34-47,222-240`). Independent execution returned:

```text
rotation-cyclicity-fixture: 2688 checks, 0 failures
```

That does not match the handoff/baton claim of 2,692 checks, and the governing 10_ paragraph still says 2,671
(`10_REVIEW_GRADUATION_REDESIGN.md:38-42`). The behavior is green; the evidence claim is not.

### C2. The contract set still does not have one cursor law

H6's creation paragraph still says the cursor becomes the “highest ACTIVE-sweep index served”
(`15_H6_SCHEMAS_AND_CONTRACTS.md:34-39`), which conflicts with its own exact wrap rule later in §2b. The
non-archived verification plan and H8 source still retain “every pool word each cycle” wording
(`11_REDESIGN_VERIFICATION_AND_FOLD_PLAN.md:37`; `evidence/h8-final-values-resim.mjs:2-4`) even though the
accepted property is the two-consecutive-lap statement.

These are governing/current sources, not only archives. Replace the stale phrases and record the actual
fixture count generated by the current file.

### C3. Differing-size first-composer reuse is explicit but internally mis-described

H6 now chooses first-composer-wins queue content when two classes compose the same logical day. That is an
explicit conflict policy. But the receiving class stores its **own** `snapshot.queueSize` while reusing the
first class's queue verbatim (`15_H6_SCHEMAS_AND_CONTRACTS.md:49-56`). A 60-first/30-second case therefore
creates a second queue with 60 members beside `snapshot.queueSize:30`; reversing the race produces 30 members
beside `snapshot.queueSize:60`.

The receiving snapshot no longer describes the content-generation configuration, and no fixture covers
60→30 / 30→60 reuse. Record the source queue/config (or freeze the shared queue-size tuple), distinguish it
from the receiver's threshold/test posture, and test both arrival orders.

## D. Shadow execution-readiness

### D1. The exact membership registry is representable, but not authorized

The plan now puts actual UIDs in ≤500-entry server-readable chunks, so `has(uid)` is finally implementable
(`16_SHADOW_COHORT_AUDIT.md:79-85`). That closes r60's hash-cannot-answer-membership defect in design.

It introduces `system_config/shadow_registry_{n}` writes. The latest authority record says writes are narrowed
to the §2.8 guarded `review_v2.rehearsalClassIds`/shadow-scoped setup and that **any other**
`system_config/*` path remains forbidden (`winclaude_069.md:97-109`). Round 70 is a commit/push record and does
not grant this new path. Shadow execution cannot start until this surface is explicitly authorized or moved to
an already-authorized authority store.

The plan also needs exact version/CAS/chunk-count/cache invalidation behavior. “Loads once per instance + on
config change” is not executable without a generation pointer; stale warm instances could mistag rows after
registry setup or cleanup.

### D2. The immutable reduced UID file is not consumed by every script

The plan says the reduced UID set is the file “every script consumes” and specifically names B3/B4 scope
(`16_SHADOW_COHORT_AUDIT.md:103-109`). Neither B3 nor B4 exposes `--uids`. Both derive live scope from every
student ID in selected class documents (`b3-backfill-writer.mjs:72-87`; `b4-verify.mjs:40-52`). B3 can
indirectly filter through an assembled delta layer, but that re-enters A1 and is not direct consumption of the
immutable reduced file; B4 always requires the original baseline UID set to equal the complete selected live
class scope.

Either rebuild every shadow class's `studentIds` from the frozen reduced set and name that as the sole scope
authority, or add one shared hash-bound UID-scope input to B1/B3/B4 and the batteries. The current prose claim
is not implemented.

### D3. Containment is improved but must name and test the actual authority union

The current override code is stronger than the plan's shorthand. The no-attempt path binds caller ownership to
the exact class, exact student enrollment, and assigned list (`functions/foundation.js:2299-2344`); the
attempt path derives its target from the loaded attempt and authorizes by teacher stamp or current-enrollment
ownership (`:2255-2296,2722-2774`). A newly created audit teacher owning only shadow classes makes real-target
authorization structurally difficult, and battery M includes the right negative.

Preserve that gain, but do not reduce it to `ownerTeacherId === caller`: the stamp leg is a separate authority
path, and the future force-pass implementation must be target-bound too. The dark-build negative matrix must
prove both legs cannot reach a real attempt/student, not assume the ownership statement is sufficient.

### D4. Monitoring and teacher visibility remain unresolved

Law 11 says production consumers exclude shadow rows and Audit I uses a separate side-effect-free evaluator
over only shadow rows (`16_SHADOW_COHORT_AUDIT.md:79-85`). Battery I still says the shadow stream is consumed by
the **real threshold-computation path** “filtered `shadow:true`” (`:151-153`). Those are different predicates.
Name two invocations and assert production=`shadow != true`, audit=`shadow === true` with no production alert
or abort writes.

Teacher invisibility still runs real teacher-surface queries for only three teachers (`:49-50`). That is a
smoke sample, not proof of an all-teacher isolation invariant. Use the complete real-teacher set or prove the
result structurally from a full class ownership query and rules, with at least one direct-doc and query
negative.

## Required next closure

Do not open stage 2 yet. The minimum next handoff should include:

1. One atomic, directly runnable B4-auth → B1 → hash-bound layer → B3 → final-PASS workflow, plus a nonempty
   delta integration fixture and Windows path coverage.
2. Fail-closed exit statuses and a true final reset/epoch transaction fence for B3; B4 exit 0 only on PASS.
3. A resume manifest that binds mode and every input hash, journals only fully committed students, and proves
   every resumed write has an original pre-image.
4. Exact baseline schema/duplicate/class/watermark validation and a report-bound, in-scope, complete extras
   repair artifact.
5. A genuinely bounded plan/pre-image stream with backpressure and large-cohort evidence.
6. Removal of retired RRU seed text, one cursor law/count everywhere, and differing-size cross-class snapshot
   fixtures.
7. For shadow: authority for the exact registry store, a generation/cache law, one executable reduced-set
   scope input, exact authority-union negatives, two-mode monitoring predicates, and full teacher isolation.

## Independent checks executed

- Revalidated baton owner `codex`, round 61, revision 194, task/handoff, and written-last ready marker.
- Read the actual shared baseline helper, B1 CLI/replay, B3, B4, cursor fixture, governing 10_/14_/15_/16_
  plans, current override authority code, and the r69/r70 authority records.
- `node --check` passed for `b-baseline.mjs`, `b1-replay-lib.mjs`, `b1-expected-labels.mjs`,
  `b3-backfill-writer.mjs`, and `b4-verify.mjs`.
- `node scripts/deepfix2/rotation-cyclicity-fixture.mjs` returned **2,688 checks / 0 failures**.
- `git diff --check` passed apart from existing LF→CRLF warnings.
- Verified Node's Windows path behavior independently: relative URL inputs became `file:` URLs, while
  `C:/...`/`C:\\...` inputs in the current B1 construction became protocol `c:`; backslash manifest paths also
  produced an empty helper directory prefix.
- Repository search found no delta-layer builder or B3/B4 reduced-UID CLI outside the reviewed sources.
- No live Firestore mutation or production audit was run; the handoff did not supply a local/mock Track-B
  integration fixture, and executing B3 against live data would exceed review authority.
