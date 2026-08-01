# Codex round 58 — shadow-cohort plan and cursor-law review

**Reviewed:** 2026-08-02  
**Round disposition:** **DONE**  
**Shadow-cohort execution readiness:** **NO — NEEDS FIXES**  
**Cursor-law verification:** **NO — DIRECTIONALLY SOUND MECHANISM, CLAIM NOT PROVED**

## Ruling

The shadow-cohort idea is valuable and the proposed battery is substantially stronger than a synthetic-only
rehearsal. It is not yet a safe or complete execution plan. The clone inventory omits live data surfaces, maps
the wrong class-owner fields, and does not clone the members collection that the real teacher roster and
gradebook read. Its “PII redacted” and “zero consequence” claims are also too strong: the IDs remain directly
linkable to real identities, free-text educational records remain intact, all 947 Auth accounts share one
password, and 1.5–2 million Admin-SDK writes occur in the production project where namespace conventions and
Firestore rules cannot contain a defective Admin writer.

The audit stages are not state-isolated. Backfill, full-cohort compose, walkthrough, concurrency, kill-switch,
and reset drills all mutate one shadow cohort in sequence. Later tests therefore run on state produced by
earlier tests rather than the same known clone. The source clone itself also lacks a point-in-time or drift
protocol while the real cohort continues changing. These are false-green risks, not editorial omissions.

The cursor-chain mechanism is a sensible replacement for day-offset modulo, and the submitted fixture really
runs 2,671 green cases. But its P1B leg proves only that one day's output equals one swept index interval; it
does not prove its stated per-cycle coverage property under mutation. A concrete burst-return case leaves 37
of 100 continuously-active-at-cycle-start words unseen after the fixture's own ten-day cycle. The persisted
contract is also class-scoped even though logical progress is shared across classes, so switching classes can
make “previous queue absent” restart at the smallest word and repeat the prior day's queue. Underflow cursor
state in the reference function is different from “the last index in the persisted queue” in the plans.

I did not re-review the round-57 B1/H6 residue; the findings below are bounded to the two round-58 scopes and
the requested allowlist check.

## Requested scope verdicts

| Scope | Verdict | Independent result |
|---|---|---|
| Shadow clone inventory/fidelity | **MISS** | Class ownership, member roster, session history, document/reference mapping, and PII treatment are incomplete. |
| Isolation / no-real-impact law | **MISS** | Same-project Admin writes, join-code/teacher leaks, config races, metrics ambiguity, and intended-manifest-only verification do not prove containment. |
| Audit battery completeness | **MISS** | Strong scenarios exist, but stages contaminate each other and auth/rules, old-client, configuration, expiry/quarantine, and cleanup races are absent. |
| Execution ordering | **MISS** | No consistent source snapshot and no restore/fork between destructive batteries. |
| Permission set Q1–Q6 | **INCOMPLETE** | It omits same-production-project bulk-write risk, credential design, privacy scope, audit principal/log access, config mutations, rate limits, cleanup deadline, and recovery authority. |
| Local 26SM class allowlist | **MECHANISM VERIFIED / PROVENANCE PARTIAL** | The separate JSON array is 33 unique IDs and matches the census; roster consistency/freshness is not bound into an immutable artifact. |
| Cursor-chain mechanism | **PARTIAL** | Ordered cursor scanning is a plausible law, but the fixture does not prove its mutation claim and the persisted/cross-class contract is unsafe. |
| Cursor fold consistency | **MISS** | Governing clauses were edited, but stale day-offset/bounded-sighting requirements remain in the task list. |

## Scope 1 — shadow-cohort audit plan

### Valuable parts that should stay

- The three-leg framing is strong: computed B1 expectations, synthetic-history 25WT product flow, and
  real-shaped shadow history exercise different failure classes.
- Dry-run before execute, a fail-closed rewrite map, pre-execution B1 equivalence, byte comparison after B3,
  and a second zero-write B3 pass are the right kinds of gates.
- The battery correctly includes live composition across the full cohort, real dual enrollments, contention,
  kill-switch behavior, reset ownership/takeover, replay, and the actual monitoring pipeline.
- Rehearsal-class isolation, a hard AI-call cap, explicit cleanup, and owner permission are appropriate
  constraints.
- The plan is honest that it cannot reproduce 947 humans' simultaneous behavior.

Those strengths do not close the following blockers.

### Clone-surface and fidelity blockers

1. **The class ownership rewrite names the wrong fields.** The plan rewrites class `teacherIds`/`teacherId`
   (`16_SHADOW_COHORT_AUDIT.md:20`), while the real class owner and teacher-class query use
   `ownerTeacherId` (`src/services/db.js:342-376`). Callable authorization also reads `ownerTeacherId`
   (`functions/index.js:1961-1969`). If the class document is copied verbatim, the real teacher owns and can
   see the shadow class; if an eventual fail-closed map rejects the unmapped field, the class is not cloned at
   all. The class rewrite must be an allowlisted output schema, not “verbatim except these names.”
2. **`classes/{classId}/members/{uid}` is missing.** The real ClassDetail roster reads and orders that
   subcollection (`src/pages/ClassDetail.jsx:219-220`); teacher attempt aggregation and name filters also build
   their roster from it (`src/services/db.js:1652-1666,1932-1954`). A class with only rewritten `studentIds`
   yields an empty or inconsistent teacher surface, making the planned force-pass and gradebook walkthroughs
   non-fidelitous. Member IDs and member PII must be mapped and cloned, and all three roster sources
   (`studentIds`, member docs, user `enrolledClasses`) must reconcile.
3. **Existing `users/{uid}/sessions/*` history is omitted.** The production flow writes completed-session
   history there (`src/services/studyService.js:931,1087-1090`). The audit's completion/wall flows touch the
   same surface, yet only `session_states` is listed. Either clone it with an explicit behavioral/read-surface
   rationale or prove every audited reader ignores prior session documents. Newly created session docs must
   also be in cleanup.
4. **The root/document rewrite list is far below the actual reference graph.** At minimum, user settings carry
   `primaryFocusClassId`; `challenges.history` can carry attempt/class/teacher identities and free text;
   `enrolledClasses` uses class IDs as **map keys**; class-progress and session-state document IDs embed class
   IDs; attempt IDs are referenced by challenges and new server records; and later audit writes add
   presentation, completion, visit, grading-job, and force-pass references. Exact-value matching only for known
   student/class IDs does not catch embedded strings, map keys, document references, paths, attempt IDs, real
   teacher IDs, or an unenumerated identifier. The map must cover document IDs, field names/map keys, arrays,
   nested objects, Firestore `DocumentReference`/Timestamp types, and every cross-reference as a graph.
5. **Attempt document identity is not specified.** Namespace law says every created document ID is prefixed,
   but the attempt row only lists field rewrites (:18,30). Reusing a real attempt ID would overwrite production;
   prefixing it without rewriting all `attemptId`, `consumedAttemptId`, `preOverride`, challenge, presentation,
   and grading-job references corrupts fidelity. Define a run-scoped ID map for every cloned collection and
   prove referential closure before the first write.
6. **Shared list/word data is called read-only but not enforced as an audit invariant.** A dark-code or harness
   defect with Admin SDK can write it despite Firestore rules. Shared-reference safety needs explicit pre/post
   digests or Cloud Audit Log assertions for `lists/{id}` and `lists/{id}/words/*`, not a comment in the clone
   table.

### Privacy and credential blockers

1. **This is pseudonymization, not PII redaction.** `shadow_{origUid}` preserves the real stable UID in every
   shadow path (:14,22), so the shadow record is directly joinable to the real student without consulting a
   separate mapping. Class names also preserve the originals. Use opaque run-scoped random IDs and protect the
   mapping separately; never put the real identifier in the document path, Auth UID, logs, or report.
2. **Names and email are not the complete sensitive payload.** Full attempts include typed answers; challenge
   history can include student questions/reasons and teacher responses; profile/avatar and other free-text
   fields may be identifying. “Full” copies of user roots, attempts, session state, and study state need a
   field-level data classification and minimum-required allowlist. Free text should be dropped or replaced with
   type/length-preserving synthetic values unless a named test needs it. The clone manifest/report must not
   contain raw source payloads.
3. **One password for 947 accounts is not acceptable isolation.** One leak compromises every shadow student
   and creates a broad callable/write credential. Create Auth users without passwords and mint short-lived
   custom tokens for the harness, or use unique high-entropy credentials stored outside the repository for
   only the Playwright accounts. Enforce expiry/revocation and test that shadow principals cannot read/write
   real student state.
4. **Retention is open-ended under one Q5 branch.** “Hold until your review” has no maximum deadline, access
   list, mapping retention, secret deletion, or deletion owner. Approval should state a hard delete-by time,
   permitted readers, where manifests/mappings live, and what evidence remains after payload deletion.

### Isolation and operational blockers

1. **Same-project Admin execution cannot be called “zero consequence.”** Admin SDK bypasses rules; millions of
   writes share production quotas, indexes, function concurrency, billing, TTL, logs, and operational alerts.
   The safest design is a separate Firebase project/database deployed from the exact build. If production-project
   fidelity is mandatory, the plan needs explicit owner acceptance of that residual risk, a dedicated audit
   service account, off-peak/rate/backpressure limits, live abort thresholds, and Cloud Data Access log review
   for every write by that principal.
2. **An intended-write manifest cannot prove no real document was touched.** A buggy writer can mutate an
   unmanifested real path; diffing only manifest-listed targets will never observe it. Namespace validation must
   occur in the actual write wrapper before each write, and containment evidence must be independent: dedicated
   principal audit logs plus pre/post hashes/versions of all real source and shared-reference surfaces in scope.
3. **`joinCode` is copied without a law.** Class creation uses a globally queried join code
   (`src/services/db.js:333-364,1021-1049`). Copying the original code creates duplicate query matches and a path
   for a real student to join a shadow class; preserving `ownerTeacherId` compounds the leak. Shadow classes
   must be non-joinable or receive unique reserved codes, and this field belongs in the explicit class output
   schema.
4. **Teacher invisibility over three teachers is not exhaustive.** At least every owner of the 33 source
   classes, the audit teacher, unrelated teachers, real students, shadow students, and unauthenticated clients
   need both normal-query and direct-document authorization negatives. Query invisibility is not equivalent to
   rules isolation. Include client-SDK/REST rule tests; an Admin harness cannot test rules.
5. **`rehearsalClassIds` mutation has no ownership/CAS protocol.** The list also contains 25WT (:34-35).
   Adding/removing 33 shadow IDs must preserve concurrently authorized rehearsal IDs, bind the exact prior
   config version, restore only this run's IDs, and fail if the config changed. The kill-switch drill must say
   whether it edits shadow assignment overrides or this shared list; it must never toggle the global gate.
6. **Metrics isolation and Audit I contradict each other.** Section 2 says real baseline computations filter
   shadow events, while Audit I says the real threshold-computation path consumes an `ops_metrics` stream
   “filtered `shadow:true`” (:38-39,77-79). Define two explicit modes: production path proves it excludes
   shadow events; a side-effect-free shadow evaluation reads only shadow events and writes no real alert/abort
   state. The `shadow` marker must be server-derived from a trusted class/run registry, not caller-supplied, and
   every log/metric emitter must be inventoried.
7. **Background and external effects are not inventoried.** Auth creation, Firestore writes, grading, TTL,
   logging, monitoring, analytics, alerting, and any triggers must be checked for emails, notifications, real
   tickets, paging, or external AI calls. “AI cap” addresses cost, not all outbound effects.

### Snapshot, ordering, and cleanup blockers

1. **There is no consistent source snapshot.** Reading millions of documents from 947 active users while they
   submit attempts, receive challenge decisions, or advance sessions yields a temporal mixture. The real B1
   baseline has its own watermark; copying later mutable state and then comparing shadow B1 cannot prove
   fidelity. Use a managed point-in-time/export source where possible, or a per-student read/re-read protocol
   with source version/count/digest fences, retry changed students, one shared watermark/run ID, and an abort on
   unresolved drift.
2. **The destructive audits share one mutable cohort.** A writes labels; B creates queues/presentations for
   every identity; C advances/graduates and creates jobs/visits; D races; E changes posture; F resets. Nothing
   restores the clone between them. The result depends on order, and failures are not reproducible from one
   baseline. Use run-scoped scenario forks, a post-clone export restored before each destructive battery, or
   explicitly partition students into nonoverlapping immutable scenario cohorts with a stated baseline hash.
   Clone fidelity must be rechecked after each restore.
3. **Clone execution is not restart-safe.** A 1.5–2M-write job can fail halfway. Define run IDs, create-only
   preconditions, checkpoint/resume semantics, bounded BulkWriter retries, backpressure, partial-run detection,
   and abort-to-cleanup. A second clone execute must be idempotent or refuse on any preexisting run residue.
4. **Cleanup cannot rely only on the clone manifest.** The server creates attempts, jobs, queues,
   presentations, completions, counters, restudy docs, streak credits, AI meters, metrics/logs, session history,
   and possibly TTL/repair artifacts after clone time. Enumerate every top-level and nested created surface,
   remove rehearsal IDs with config CAS, wait for asynchronous writers to quiesce, delete children before
   parents, delete/revoke Auth credentials, and run at least two zero-residue sweeps separated by a bounded
   delay. Cleanup itself needs dry-run, idempotent retry, and a durable deletion report.

### Audit-battery false-green and coverage gaps

1. **Backfill's acceptance is fail-open.** “Byte-equal + zero-second-pass, or the miss list explains itself”
   (:54-56) allows post-hoc rationalization. The gate must be exact equality except for a predeclared,
   machine-evaluated exception set with expected IDs/counts and owner approval. Any new divergence is a fail.
2. **The Admin-SDK concurrency harness may bypass the system being certified.** It must call the deployed
   authenticated callable boundary with real Auth tokens, client-version fields, and the exact production
   transaction code. Direct Admin calls cannot certify callable authorization, App Check/client contract,
   rules, or request validation. Each contention case also needs multiple calls against the **same**
   uid/list/day/counter and deliberate same-key/different-key barriers; 100 accounts each making one call do
   not contend.
3. **Missing authority/rules matrix:** shadow student cannot write six labels or any server-only collection;
   cannot read/write another shadow or real student; real student/teacher/unrelated teacher cannot access
   shadow state except the exact intended audit-teacher read; audit teacher cannot mutate real rows. Test with
   client SDK/REST, not Admin.
4. **Missing version/config matrix:** stale/malformed/missing `clientContractVersion`, old-bundle forced refresh,
   mid-day global/per-assignment edits, snapshot immutability, rehearsal-list CAS, and global-OFF cold-start
   failure. The conditional hosting deploy makes old/new bundle skew a real boundary.
5. **Missing durable-job cases:** malformed/missing-uid quarantine, 12-hour logical expiry/redaction, lease
   takeover, AI cap enforcement under concurrency, write-only recovery, reset racing claim and finalize, and
   no extra billing on retry.
6. **Reset coverage is too narrow.** “Op rejections” should enumerate concurrent compose, submit, completion,
   grading claim/finalize, challenge acceptance, force-pass, B3 label write, rerun composition, and a second
   reset/takeover. Verify both tombstones, identical target epoch, owner-clear CAS, and no post-cleanup
   resurrection.
7. **Evidence-kind and edge-shape live checks are absent:** first-day new-only, standard, gate-off autopass,
   list-end review-only, gate-off list-end, underflow, forced fallback, priority saturation, cross-class source
   posture in both directions, and class/list source IDs in the audit record. These are precisely where a
   real-shaped cohort adds value beyond unit fixtures.
8. **No audit of cleanup and production exclusion as a first-class battery item.** Add a final J gate that
   proves production monitors/thresholds ignored shadow data, no real/shared document was written, all config
   was restored, every audit credential was revoked, and repeated cleanup is a zero-op.

## Permission set — additions required

Q1–Q6 should be supplemented with explicit decisions/authority for:

1. same production Firebase project versus an isolated project/database, including the residual consequence
   of production quotas/indexes/logging and the estimated bulk-write/function cost;
2. the exact pseudonymized data classes copied, including free text, stable identifiers, mapping/report storage,
   authorized readers, and the hard deletion deadline;
3. a dedicated audit service account, access to Cloud/Data Access logs, and who may hold its credentials;
4. short-lived custom-token or unique-secret authentication — not a common password;
5. writing/restoring `rehearsalClassIds` and per-assignment gate settings, force-pass/reset operations, and the
   dedicated audit-teacher identity;
6. off-peak window, write/function concurrency caps, live abort owner/signals, and authority to stop/clean a
   partial run;
7. outbound AI/analytics/log/alert behavior and whether synthetic typed content may be sent externally;
8. destructive cleanup, credential revocation, deletion verification, and recovery/PITR authority if an
   independent audit log reports any real-path write.

“No redaction” should not be offered as an informal fidelity alternative. If ever considered, it needs a
separate, explicit privacy/data-controller decision rather than being a sibling checkbox in the execution
prompt.

## Allowlist and census check

The local ignored directory contains both artifacts even though the handoff names only the census:

- `26sm-class-allowlist.json` is a valid top-level JSON array with 33 unique class IDs, exactly the shape B1
  consumes. Its SHA-256 is
  `d17d6f483e2172c15de1ad3aa83fd1132139e38dd4eafeae4efc5b33f01bc946`.
- Those 33 IDs exactly match `26sm-census.json.included[].id`.
- The census reports 947 unique students across 1,217 class-enrollment rows and 18 excluded test-pattern
  classes. This is internally consistent with the intended dual-enrollment population.

That verifies local shape and set equality, not source truth. Both files are gitignored; the census has no
roster IDs/digests, no reconciliation between class `studentIds`, class member docs, and user
`enrolledClasses`, and no post-build drift/freshness rule. Bind both hashes, query time, source project,
class-name/owner digest, roster-source reconciliation, per-class counts, unique-UID digest, exclusion IDs, and
the reviewed regex/rule into a durable run manifest before using the allowlist for full B1 or clone execution.

## Scope 2 — cursor-chain law

### What is real

- The fixture is syntactically valid and deterministically reports
  `rotation-cyclicity-fixture: 2671 checks, 0 failures`.
- Static-pool coverage across the enumerated sizes, queues, and starting cursors is a genuine check.
- The one-day cyclic interval check is useful: for the mutations generated by the fixture, the selected active
  set equals the index interval traversed by the cursor.
- P2 exercises deterministic priority/remainder order; P3 exercises effective size, uniqueness, membership,
  and prefix-preserving fallback; P4 checks underflow length and earliest-graduated top-up order.
- The governing 10_ and H6 queue clauses both describe “strictly after the prior persisted cursor, wrapping,”
  so the primary law edit is visible.

### Blocking proof and contract failures

1. **P1B is not the P1 property in the fixture header.** The header defines a cycle as
   `ceil(|pool at cycle start| / queueSize)` advancing days and promises every word active for that whole cycle
   is served. P1B never records a cycle, a continuously-active set, or a coverage deadline; it only checks each
   day's selected set against `(previousCursor,newCursor]` (`rotation-cyclicity-fixture.mjs:67-75,103-123`).
   Passing the local interval identity does not prove the stated cycle property when words return ahead of the
   cursor and consume service slots.
2. **A concrete mutation counterexample defeats the stated claim.** Start with 100 active even-index words,
   queue size 10, cursor null, and return ten previously resting odd-index words before each day after day 1.
   After the defined ten-day cycle, 37 of the 100 continuously-active-at-cycle-start words (starting at index
   126) have never appeared; the cursor is only 124. This is a plausible 21-day return slug. The fixture's
   mutation loop returns at most one word when its artificial resting list exceeds eight and never asserts
   cycle coverage, so all 2,671 checks remain green.
3. **The class-scoped persisted chain breaks shared-progress switching.** Queue identity and document ID include
   `classId` (`10_REVIEW_GRADUATION_REDESIGN.md:44-48`;
   `15_H6_SCHEMAS_AND_CONTRACTS.md:30-39`). A dual-enrolled student can compose day N through class A, then day
   N+1 through class B. Class B's prior class-scoped queue is absent, so the frozen law restarts at the smallest
   index and can repeat class A's previous queue. Alternating classes can repeatedly reset each per-class chain.
   The fixture has no class dimension, while R2-36/38 explicitly makes logical progress shared. Persist one
   list/logical-day cursor chain independent of source class, or define a transactional resolver over the one
   shared winning queue.
4. **Underflow cursor persistence disagrees with the plan.** The reference function, when active pool is below
   queue size, sets cursor to `max(active indices, prior cursor)` and ignores resting top-ups for cursor
   advancement (`fixture:38-42`). The plan stores no explicit cursor and says to use the prior queue's “last
   served wordIndex” (`10_:41-43`; `15_:37-39`). The prior queue's last element can be an earliest-graduated
   resting top-up with an unrelated index; with no active words, the fixture keeps the old/null cursor while the
   prose would advance to that resting word. Add an explicit immutable `rotationCursorWordIndex` (and previous
   queue reference) produced by the composition law; do not infer it from the last presentation element.
5. **Mutation coverage is much narrower than claimed.** P1B has no intake growth, no burst 21-day returns, no
   mid-lap queue-size edit, no gate-OFF day followed by ON, no missing prior record, no reset/epoch transition,
   no cross-class switch, and no concurrent first-writer conflict. Its size-change leg uses a static pool and
   changes size only after an already overlong full-coverage run (`fixture:92-101`). The handoff's “under
   mutation” and “each cycle” summary overstates what is exercised.
6. **The reference fixture does not yet bind the implementation.** It contains its own `composeQueue` and
   selector functions rather than importing the production pure composer (which is not built yet). Keep it as
   a spec oracle, but the launch gate must run the same properties against the extracted production module and
   differential/live results, including persisted cursor bytes and transaction replays.
7. **The fold is not consistent.** `02_TASK_LIST.md:95` carries cursor-chain wording, but `02_:62` still says the
   day-offset rotation is the fix and `02_:71` still requires H8 to demonstrate bounded sighting intervals.
   Those are the falsified mechanism and retired numeric-style proof respectively. The task list is the build
   card, so this residue is operational.

### Cursor closure gate

1. Choose and define the actual structural property. If “cycle” means a cursor wrap/lap, define lap boundaries
   under insertions/returns and stop claiming a fixed `ceil(pool-at-start/queueSize)` day count. If it means the
   current header's fixed cycle, the algorithm needs admission/service rules that make the counterexample
   impossible.
2. Make the cursor student+list+epoch scoped across classes; persist an explicit cursor and prior-queue
   reference in the queue record; freeze behavior for underflow, no-active, first-ever, reset, OFF→ON, missing
   predecessor, and config changes.
3. Extend the fixture with continuously-active coverage tracking, burst returns, monotone intake, arbitrary
   mid-lap size changes, class switching, wall/unwall, resets, missing predecessor, and concurrent creates.
   Include the counterexample above as a permanent negative/regression case.
4. Import the production composer or run a byte-for-byte differential oracle, then make the shadow launch sweep
   assert cursor-chain continuity across at least two advancing logical days — a single launch-day compose
   cannot certify rotation.
5. Remove the stale day-offset and bounded-sighting build instructions.

## Exact shadow-plan closure gate

Before execution permission is requested again:

1. replace the clone table with explicit output schemas and a complete reference graph, including
   `ownerTeacherId`, class members, session history, all document/map-key/reference rewrites, new server-created
   collections, and join-code handling;
2. adopt opaque IDs, field-level minimization/redaction, short-lived auth, dedicated principals, and a bounded
   retention/deletion policy;
3. choose true isolated infrastructure or add production-project audit-log containment, rate/abort controls,
   config CAS, rules negatives, and independent proof that no real/shared path changed;
4. add a consistent source snapshot/drift law, restartable clone protocol, per-battery state forks/restores, and
   cleanup that discovers server/background writes rather than trusting only the original manifest;
5. make every acceptance rule fail closed and add the missing authority, version/config, job/quarantine,
   evidence-kind, reset-race, and final-cleanup matrices;
6. expand Q1–Q6 with the permissions and risk decisions listed above.

## What I verified

- Validated the complete baton/marker/handoff tuple `codex/58/188/DEEPFIX2_PROGRAM`.
- Read the new shadow plan, all three cursor-law folds, the full fixture, R2-47 trace/change evidence, relevant
  class/enrollment/teacher/attempt/session source paths, and both local census artifacts.
- Ran Node syntax and the fixture: 2,671 checks, zero reported failures.
- Ran an independent burst-return falsifier against the same cursor algorithm; the stated ten-day cycle missed
  37/100 continuously-active-at-cycle-start words.
- Verified the allowlist is 33 unique IDs, matches the census set exactly, and has SHA-256
  `d17d6f483e2172c15de1ad3aa83fd1132139e38dd4eafeae4efc5b33f01bc946`; census totals are 947 unique students,
  1,217 enrollment rows, and 18 excluded test-pattern classes.
- Per the handoff scope, I performed no production Firebase operation, clone, backfill, config mutation,
  deployment, Playwright run, Docker action, or product-code edit.

## Baton update

Review complete. Hand back with `codexDecision: DONE`; this records completion of the round-58 review, not
execution approval for the shadow audit or verification of the cursor law.
