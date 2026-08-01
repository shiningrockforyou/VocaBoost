# Codex review — DEEPFIX 2 v4 bounded fold-verification (round 44)

**Reviewed:** 2026-07-26  
**Overall verdict: FOLD MOSTLY FAITHFUL; PLAN-OF-RECORD STILL ACCEPTED; WAVE 1 STILL NEEDS FIXES.**

The r43 findings, David D-1 through D-4, and most panel amendments are visibly and faithfully represented in v4.
The long-range architecture does not need another teardown. The deployment reachability rule, task-scoped
authorization matrix, delta-scoped soak, compound-rollback warning, `dayReviewExists` inventory addition, D-1
product decision, attempt-durability work split, and starvation-probe/scheduler inputs are all directionally sound.

However, the closure check proved that text was present, not that the resulting contracts were executable together.
Static verification against the current client/server flow found six task-scoped gaps. Closing register item 15 would
**not yet make DF2-10 or the whole Wave-1 set implementable as carded**.

## Authorization

| Scope | Round-44 verdict |
|---|---|
| Previously authorized Wave-0 docs/audits and DF2-08 pure authoring | **GO under the existing task gates** |
| DF2-01 / DF2-02a safe subset / DF2-04 / DF2-05 | **Prior task-scoped rulings unchanged** |
| DF2-07 build | **NEEDS FIX** — `no_score` cannot be derived at the claimed boundary |
| DF2-10 | **NO-GO** — no-score proof, reader posture, response schema, and success-stamp durability remain incomplete |
| DF2-11 / DF2-02b | **WAIT for DF2-10** |
| DF2-12 | **NO-GO as a client-only flip** — the current server path still permits a graded-but-unwritten result |
| DF2-13 | **Design direction accepted; WAIT for its implementation spec and DF2-10 sequence** |
| DF2-35 | **Data-contract direction accepted; build remains downstream of DF2-10 facts** |

DECIDE-0 still does not gate Wave 0 or Wave 1.

---

## Findings

### B1 — BLOCKER: the proposed “server-proved no-score” test still does not prove that no review was available

The r43 bypass is acknowledged, but the replacement proof enumerated on DF2-10 is incomplete. It binds CSD/day,
list, anchor, assignment/mode, and concurrent attempts; none of those facts proves that the student's effective
review-study set was empty.

Today that fact is learned only after the client asynchronously builds the effective set:

- `DailySessionFlow.jsx:509-527` resolves the segment, removes resting/mastered words, and prepends today's failed-new
  words.
- The empty decision occurs later at `:615-623`, `:840-845`, `:855-868`, or `:1035-1041`.
- `initializeDailySession` returns a segment/config but does not return the result of that asynchronous effective-set
  construction.
- The server's current `reviewOnlyReasons` at `foundation.js:1390-1398` are allocation zero, list complete, and
  review resume. None is proof that the scoreable review pool is empty.

This matters twice:

1. the hardened cached-client `markReviewComplete` route needs an authoritative empty-pool proof; and
2. the internal `completeSession` marker path needs the same proof. Merely moving the marker into
   `completeSession` does not make the proof server-owned.

The implementation spec must define one authoritative `deriveNoScoreEligibility` contract shared by both paths. It
must reproduce the effective review composition from authoritative list/study-state/attempt facts, including
resting/mastered exclusion, today's failed-new rows, the exact segment/scheduler identity, reset epoch, and concurrent
scored-review attempts. A failed or unavailable derivation must not mint completion evidence while the gate is on.

The required race test also needs to assert the transaction boundary: a scored review becoming available between
proof and marker write cannot coexist with a passing automarker.

There is also stale deployment wording on the DF2-10 card. B1 says **harden now, delete at DF2-46**, but DF2-10's
DEPLOY paragraph still lists `markReviewComplete(→ RETIRED ... its delete deploys + verifies)`. For DF2-10 it must say
**hardened and retained for cached bundles**; only DF2-46 deletes it after the measured drain.

### H1 — HIGH: DF2-07's `no_score` reason is assigned to a boundary that cannot know it

DF2-07 says the three-way client-local discriminant is derived once “during `initializeDailySession` config
assembly.” `list_complete` and `review_resume` can be derived there. `no_score` cannot: the current code only discovers
the empty/all-mastered outcome when `buildReviewStudySet` resolves the effective queue in
`DailySessionFlow.jsx:509-527`.

The card must choose one honest boundary:

- move the effective review-set derivation into a shared service and return a tested discriminant with the config; or
- derive `list_complete`/`review_resume` at initialization and set `no_score` only from the later queue-build result,
  through one shared helper/state transition.

The terminal no-work branch at `DailySessionFlow.jsx:855-868` deliberately does **not** complete or record the day,
whereas the post-new-test empty branch at `:1035-1055` does. Fixtures must distinguish these outcomes; “empty/all
mastered always completes” is false.

This is bounded to DF2-07 and the B1 shared-proof design. It does not reopen the container architecture.

### H2 — HIGH: D-4's uniform reader conflicts with the gate-conditioned reader wording

David D-4 is clear: a durable `passed:false` review remains non-evidence after the kill switch is turned off, and a
new OFF-posture retake is written `passed:true`. That requires a uniform pass-aware evidence reader, with only an
explicit census-derived legacy clause.

DF2-10 still says:

- pass-reader correctness is “gated on `passed===true`, byte-equivalent when OFF”; and
- `dayReviewExists` requires a passed review “under the gate,” with an OFF-byte-identity fixture.

Those formulations permit an OFF reader to count the old `passed:false` attempt, contradicting D-4. Replace them with
one rule:

> Evidence readers are pass-aware in every posture. Writer posture determines whether a new review is stamped
> `passed:true`; the only compatibility exception is the timestamp/shape-scoped clause produced by the read-only
> census.

Apply that exact rule to `determineStartingPhase`, `getReviewForDay`, `getDayReviewForEngagement`,
`dayReviewExists`, challenge/override readers, and marker suppression. The OFF fixture should prove legacy outcome
parity for newly written OFF attempts, not restore “any review exists” semantics.

### H3 — HIGH: the response vocabulary cannot explain the surviving non-engagement hold

After D-1, `review_recorded` still exists for a Day-2+ review that answered under the engagement threshold. Current
code routes this through `fpHoldCsd` (`foundation.js:1342-1347`, `:1462-1491`) and returns a non-advancing
`review_recorded` response.

H4 requires every non-advance to carry one of:

`review_retake_required | list_complete | review_resume | no_evidence | day_guard`

None means “review did not count because fewer than 80% of questions were answered,” which is also messaging-register
row 3. Mapping it to `review_retake_required` would conflate a score failure with an engagement failure and render the
wrong next step.

Add a distinct server-owned outcome reason such as `review_not_engaged`, include it in the frozen per-status table,
and bind row 3 to it. The table must say whether `review_recorded` is reserved for this reason after D-1 or can carry
other reasons.

### H4 — HIGH: DF2-12's client flip alone does not close the typed durability windows

The card calls the current `gradeTypedTest` direct-write leg “one durable server transaction” and scopes DF2-12 as a
hosting-only client flip. The current server behavior does not support that claim:

- `index.js:1167-1181` attempts `writeAttemptTxn`.
- `:1182-1193` catches a write failure and returns a successful grade with `attemptWritten:false`.
- The grading-job result is persisted only in the `!writeContext` branch at `:1127-1164`. With `writeContext`, a
  failed write leaves the job claimed and no attempt exists.

Therefore a crash/abandon after that response can still lose the graded attempt; a retry can also sit behind the
orphaned grading lease. Sending `writeContext` does not by itself close windows (i) and (iii).

DF2-12 must specify and test one fail-closed recovery design:

- cache the authoritative grade before/with the direct-write attempt and make retries complete the attempt write
  without re-grading; or
- require the client to run a durable write-only recovery loop from `attemptWritten:false`, never show completion,
  clear recovery state, or permit “Start Fresh” until the exact attempt doc is confirmed.

Because the direct-write/grading-job behavior needs adjustment or an explicit proven client fallback contract,
re-evaluate DF2-12's `hosting`-only surface and deploy set. Certify crash before response, crash after grade cache,
write failure, lease expiry/takeover, reload, and idempotent exact-doc recovery.

### H5 — HIGH: the required R8 stamp has an unhandled commit-to-stamp loss window

M7 says the success stamp is emitted only after the authoritative progress transaction commits, the verifier requires
it, and an `already_completed` retry emits no stamp. That creates a permanent gap:

1. progress transaction commits;
2. process/network/log write fails before the stamp is durable;
3. retry returns `already_completed`;
4. no stamp is ever repaired;
5. the fail-closed verifier rejects a legitimate committed advance forever.

Make the stamp part of the authoritative transaction (for example, a deterministic outbox/audit document), or permit
an `already_completed` retry to idempotently repair the missing deterministic stamp while never creating a second
advance. “After commit” plus “never on retry” cannot satisfy the proof contract.

### M6 — MEDIUM: D-1's claimed client-leg inventory omits the live retake snapshot writers

The D-1 rider lists `studyService`, `forcedPathway`, `db`, and `progressService`, but both live test pages snapshot and
restore `interventionLevel` and `reviewMode`:

- `MCQTest.jsx:820-838` and `:1016-1031`
- `TypedTest.jsx:1076-1094` and `:1294-1309`

If these writes are intentionally retained as inert frozen metadata until DF2-46, say so and fixture that a restored
`reviewMode:true` has no behavioral reader after DF2-10. Otherwise remove them in the same hosting release. The
current “client legs enumerated” claim is not exhaustive.

### M7 — MEDIUM: the kill-switch snapshot/transaction contract still needs to be frozen before code

The runtime-config document is the correct kind of emergency switch, and missing/unreadable ⇒ inactive is a
reasonable student-safe default. But “read at all three verdict sites” and “attempt-time posture governs that day”
do not yet define what happens when those reads disagree.

The DF2-10 implementation spec must freeze:

- one helper/result shape, e.g. `{active, version, thresholdSource, readStatus}`;
- client-write denial and the authorized/audited operational flip path for the config document;
- which stamped attempt fields are immutable;
- that completion interprets existing evidence from the attempt's stamped posture/version rather than silently
  reclassifying it with the latest document;
- override/regrade behavior across a posture change;
- transaction read ordering/cache freshness and a single request-level snapshot;
- version/posture response behavior without a client-side “legacy success” guess when the server returned a hold.

This can be a pre-code contract inside DF2-10; it does not require a new architecture track.

---

## Panel amendments and F13-F21 rulings

| Item | Ruling |
|---|---|
| `dayReviewExists` added to reader inventory | **Accepted in intent; amend to the uniform D-4 rule in H2** |
| Runtime-config kill switch | **Accepted in direction; M7 contract still required** |
| D-1 client legs / skew window | **Skew rule accepted; inventory incomplete per M6** |
| Delta-scoped soak signals | **Accepted** |
| Compound rollback + certified-pin restatement | **Accepted** |
| Attempt-write/review-composition deploy protections | **Accepted** |
| Reachability-derived deploy set | **Accepted.** The seven exclusions are only the current diff instance; re-derive on every actual diff |
| F13 organic release of ~27 | **Accepted conditionally:** prove every behavioral reader ignores the persisted true bit; no data write without authorization |
| F14 uniform-reader census | **Accepted; it produces only a narrowly scoped legacy clause, never an OFF bypass** |
| F15 item-15 OFF scoping | **Accepted as the open David choice; recommended legacy graduation under OFF is coherent** |
| F16 Wave-1 delta list / DF2-12/13 non-deltas | **Accepted conditionally:** attempt shape, verdict, and visible outcome must remain identical; durability is the intended change |
| F17 interim no throttle banner | **Accepted** |
| F18 DF2-03 allocation-zero audit | **Accepted; it does not substitute for the runtime no-score derivation** |
| F19 item-3 ↔ item-15 coupling | **Accepted** |
| F20 DF2-12/13 sequencing | **DF2-13 ordering accepted; DF2-12 must be re-carded after H4 determines whether a server change is needed** |
| F21 probe recommendation + seen-marker refinement | **Accepted** |

## Required bounded next fold

No architecture re-review is needed. Amend only:

1. DF2-10 B1 with the exact authoritative no-score derivation/race boundary and correct two-step deploy wording.
2. DF2-07 with the real `no_score` derivation boundary and terminal-vs-auto-complete fixtures.
3. DF2-10 readers to one posture-independent D-4 evidence rule.
4. H4 response vocabulary with `review_not_engaged`.
5. DF2-12 with a fail-closed exact-attempt recovery protocol and corrected deployment surface.
6. M7 success stamp with atomic outbox or idempotent missing-stamp repair.
7. D-1 client inventory with the two retake snapshot writers classified.
8. Kill-switch request-snapshot/stamp/regrade contract frozen before code.

After those amendments and David's item 15 decision, a final bounded fold check should be enough to authorize the
relevant Wave-1 cards. The long-range DeepFix2 plan remains accepted.
