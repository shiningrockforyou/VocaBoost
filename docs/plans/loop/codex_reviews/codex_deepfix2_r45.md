# Codex review — DEEPFIX 2 round 45

**Reviewed:** 2026-07-26  
**Overall verdict: R44 FOLD FAITHFUL; GRADUATION ADDENDUM v2 NEEDS FIXES BEFORE DAVID'S ITEM-15 DECISION.**

The eight round-44 amendments are now faithfully represented at card level:

- `deriveNoScoreEligibility` is shared by the public compatibility route and internal marker path, fails closed, and
  has a proof/write race requirement.
- `no_score` is assigned only after the effective queue resolves, with terminal-no-work and auto-complete separated.
- all evidence readers are pass-aware in every gate posture, subject only to a census-derived legacy clause.
- `review_not_engaged` is distinct from a score failure.
- DF2-12 is correctly re-carded as a fail-closed exact-attempt recovery problem with a likely server surface.
- R8 uses an atomic outbox or idempotent missing-stamp repair.
- both test-page throttle snapshot writers are explicitly removed.
- the runtime kill-switch helper, immutable posture stamp, request snapshot, operational flip, and regrade semantics
  are required before code.

That bounded fold passes. It does **not**, however, authorize DF2-10 automatically: the task list and the new addendum
still disagree about whether item 15 blocks DF2-10.

The saved 26SM evidence table also reproduces exactly from
`evidence/graduation-validity-26SM.json`: 844 banded students and the four displayed proven/aged/after-wrong rates
match the addendum. The table is real descriptive evidence. Some conclusions drawn from it are stronger than the
probe supports, as detailed below.

## Authorization

| Scope | Round-45 ruling |
|---|---|
| Round-44 amendment fold | **ACCEPTED** |
| Existing task-scoped Wave-0 authorization | **UNCHANGED** |
| DF2-10 minimal D-2 gate | **WAIT** until the unbundling contradiction in B3 is removed; it should no longer wait on the full redesign |
| Addendum v2 as a packet for David | **NEEDS FIXES** — the decision list omits two product decisions and the proposed escape cannot persist today |
| Future DF2-14 implementation card | **NO-GO to card/build yet** — B1/B2/B4 and the D-3/W3/rules/client-version dependencies must be frozen first |

## Findings

### B1 — BLOCKER: “pure by day” is not the same as a pinned authoritative queue

Section 2.1 derives the queue from `(currentStudyDay, ACTIVE pool snapshot)` and then says it is pinned in session
config. Those are different contracts.

Today `initializeDailySession` builds `segment.wordIds` in the client
(`studyService.js:414-438`). `DailySessionFlow` retains that config in React/session storage; the Firestore
`session_states` autosave does not persist an authoritative segment. A later server call therefore cannot recover
the same pool snapshot merely from the day. The ACTIVE pool can change during the day because of:

- time-based MASTERED returns;
- test-result/status writes;
- another tab or class using the same student+list;
- graduation or challenge adjudication;
- reset-epoch changes.

A function is deterministic for the *same* snapshot, but the plan has not made that snapshot stable or
server-recoverable. This reopens both the three-page divergence risk and B1's no-score proof: client study/test may
use pinned set A while `deriveNoScoreEligibility` re-derives set B.

Before DF2-14 carding, choose one authoritative identity:

1. server-create an immutable, idempotent day-queue record containing at least
   `{uid,listId,effectiveProgressDay,resetEpoch,algorithmVersion,poolVersion/hash,wordIds}` and make every surface
   consume it; or
2. define immutable as-of inputs from which the exact word IDs can always be re-derived and transactionally reject
   a changed snapshot.

The server must validate the pinned identity at attempt creation and completion. “Same day and current pool” is not
enough. Also specify stable ordering/ties (`position`, then word ID) and a stable tie-break for equal
`lastFailedAt` timestamps; one test batch naturally gives many words the same timestamp.

### B2 — BLOCKER: `review_retake_exhausted` cannot create a durable completed day under the accepted readers

The escape valve says the day **completes** after N failed retakes, without graduation and with no evidence minted.
But D-4's accepted reconciliation law recognizes pass-aware review evidence. After N failures there is no passed
review. If progress is advanced anyway, `determineStartingPhase`, `getReviewForDay`, `dayReviewExists`, and
cross-class reconciliation can subsequently treat the day as incomplete or roll it back.

The proposed response shape is also inconsistent with DF2-10 H4: a `holdReason` describes a non-advance, while this
case says the day advances.

The design needs a durable, server-owned completion disposition that is **not** fake mastery/pass evidence, for
example an idempotent day-outcome record or typed attempt disposition recognized uniformly by reconciliation:

`completionDisposition: 'review_retake_exhausted'`, `advanced:true`, `graduationCount:0`,
`retakeCount`, day/list/reset-epoch identity, and the exact failed-attempt IDs.

It also needs its own response status or `completionReason`, not a `holdReason`. Retry/concurrency and challenge-after-
exhaustion semantics must be frozen. “No evidence minted” may mean no *mastery* evidence, but durable proof of the
exhaustion decision is mandatory.

This is also a product-law exception: forced mode currently says pass-to-advance is YES. Section 8 asks David only
for the shape and N, not whether “advance without a pass after N” is an approved exception. That explicit decision
must be added.

### B3 — HIGH: the claimed DF2-10/DF2-14 unbundling is not folded into the task list

The addendum §5 says DF2-10 ships only the minimal D-2 rule—gate-ON failure graduates zero; otherwise legacy
graduation—and the redesign becomes DF2-14 later.

The plan-of-record still says the opposite:

- DF2-10's D-2 rider says a passed review graduates “per register item 15” and that item 15 **blocks this pin-move**.
- the authorization matrix still gates the DF2-10 pin-move on David/item 15;
- the Wave-1 approved-delta list still treats the item-15 basis as part of DF2-10;
- item 15's lead description still says “rotation cursor” and `failCount-DESC`, the superseded v1 mechanics, before
  later prose says v2 fixed them.

Reconcile these before asking for a decision. DF2-10 must have one frozen minimal graduation rule and must not wait
on DF2-14 product choices. DF2-14 needs its own row, wave/dependencies, approved-delta entry, deploy surface, cert,
soak, and rollback posture.

### B4 — HIGH: a per-class flag cannot guarantee disabled-class byte identity over shared student+list state

The behavioral state lives at `users/{uid}/study_states/{wordId}` and the ACTIVE pool is student+list-wide, while
§2.6 proposes a per-class enablement flag. For a student taking the same list in two simultaneous classes:

- an enabled class can MASTER/return words and thereby change the disabled class's pool;
- a failed/correct answer in a disabled class may or may not update labels consumed by the enabled class, depending
  on how dark writes are gated;
- the two classes can currently have different class-keyed CSD values and therefore derive different queues over
  the same mutable pool.

Consequently, “disabled ⇒ byte-identical today behavior” is false whenever another class sharing that student+list
is enabled.

Define an effective rollout scope compatible with student-living list progress: preferably student+list/list-level
posture, or a hard invariant that every class sharing a student+list resolves to the same posture. If per-class
configuration remains the teacher surface, specify the deterministic effective resolver and mixed-assignment
conflict behavior. DF2-14 may also need to wait for the canonical/mode-record contract rather than merely “after
DF2-10.”

### H5 — HIGH: DF2-14's actual build prerequisites are missing from staging

“After DF2-10” is insufficient. Behavioral label integrity requires:

- typed and MCQ attempt creation on durable server paths (DF2-12 and DF2-13);
- the W3/D-3 writer posture so every graded attempt reaches the created-once mutation;
- the named DF2-44 rules lineage that denies client mutation of label fields while preserving allowed legacy
  `study_states` keys;
- an attested client build or version negotiation before the server enforces redesigned test composition. A cached
  legacy client will otherwise submit the old random composition to an enabled-class server and be rejected or
  misinterpreted.

Make these explicit enablement gates. Labels may be collected earlier only under the separately declared dark-write
posture in H6; they cannot become behavioral earlier.

### H6 — HIGH: “one flag for every leg” conflicts with dark label writes

Section 2.6 says every redesign leg is keyed to one flag and disabled behavior is byte-identical, then permits label
writes to accrue dark before enablement. Those additive Firestore writes are not byte-identical storage and create
a second rollout posture.

Choose and name one of:

- label writes use the same enablement flag, with an enable-time backfill/forward-only policy;
- a separate collector posture ships first as a named additive-data delta, with its own rules, monitoring,
  rollback/retention policy, and explicit statement that only behavioral outputs—not document bytes—remain
  identical; or
- no dark accrual.

This choice determines what “start empty” means and must precede David's backfill choice.

### H7 — HIGH: post-return stickiness is not represented by the normative predicate, and reversals can punish a false grade forever

The normative fill rule excludes only `unrecovered` words, where
`unrecovered = lastFailedAt > lastPassedAt`. A later correct answer makes that false. Therefore §8 option (b),
“ever-failed words stay fill-excluded,” cannot be implemented by the stated formula. It needs a separate
`fillEligible` predicate, likely based on confirmed failure history.

Using raw lifetime `reviewFailCount > 0` is not sufficient either: an accepted challenge intentionally leaves
`reviewFailCount` unchanged, so one grader false-negative would permanently exclude the word under option (b).
Define whether a reversed failure counts as “ever failed,” and define the authoritative effective-history rule for
multiple failures/reversals and backfill. Raw fail count can remain analytics, but it cannot silently become the
behavioral predicate.

### H8 — HIGH: the cited policy simulator does not simulate several v2 policies

`review-pool-trajectory-pf.mjs` is useful exploratory code, but it is not yet a faithful v2 policy simulation:

- it selects failed slots by word position (`filter(...).slice(...)`), not `lastFailedAt ASC`;
- it has no failure timestamps or deterministic tie-break;
- it implements one-correct clearing by setting `failed[i]=0`, not sticky option (b);
- it has no review-pass wall, same-day retakes, N-retake escape, exhaustion outcome, challenge reversal, or circuit
  breaker;
- it uses unseeded `Math.random()`, so the claimed output is not reproducible from a recorded seed.

Therefore §3 cannot currently support the escape-valve/deadlock claim or the recommendations for N=3 and 15 priority
slots. After David chooses candidate values, add a seeded sensitivity run across N, slots, test size, weak-band
transition rates, and both stickiness options. Report affected-student/day rates, advance-without-pass rate, active
pool, unrecovered growth, and workload. Until then, label §3 as a limited pool-trajectory approximation.

### M9 — MEDIUM: the evidence table is reproducible, but “fill penalty” and “MCQ chance floor” overstate it

The saved JSON exactly reproduces the displayed table. The probe is observational and compares answer rows selected
under current behavior; it does not observe historical graduation membership. Calling the 20.6pp association a
causal “fill penalty” or concluding that fill is proven invalid is stronger than the data permits.

The “21.3% is below the 25% MCQ chance floor” statement is also unsupported by this artifact:
`graduation-validity-probe.mjs` does not stratify rows by `testType` or option count. If typed review rows are mixed
in, their chance baseline is not 25%.

Use “observed evidence-validity gap” and “next-review accuracy after a prior wrong.” Add a test-type/question-format
stratum before making a chance-floor claim. Keep the existing caveats about selection, timing, missing graduation
membership, and adjudicated rows.

### M10 — MEDIUM: test composition needs an exact deterministic contract

“Remainder random from the rest of the queue” can include additional unrecovered words, contradicting the stated
failed-slot cap. State that remaining unrecovered words are excluded from the random remainder if that is the
intent.

Also freeze:

- oldest-failure ordering plus a stable tie-break;
- whether the server verifies the exact priority set and only membership constraints for the random remainder;
- a seeded/pinned random sample if exact client/server equality is required;
- recovery behavior when labels change between initial test composition and submit.

“Client assertion is never proof” requires the server to validate these facts against the attempt-time queue/label
snapshot, not the latest mutable state.

## Section 8 decision-list ruling

The list is **not complete yet**. Add:

1. **Pass-to-advance exception:** may `review_retake_exhausted` advance a forced-mode day without a passed review?
   What is its gradebook/teacher meaning? If yes, approve the durable non-mastery completion disposition.
2. **Cross-class rollout scope:** per class, per student+list, or list-wide; and what happens when simultaneous
   classes disagree.
3. **Label collection posture:** same behavior flag vs separately approved dark collector vs no dark accrual.
4. **Adjudicated failure semantics under sticky option (b):** does a reversed grader error count as ever-failed?

The current recommendations for N=3 and 15/30 are hypotheses, not evidence-backed defaults; present sensitivity
results or label them explicitly as pilot starting values. Starting with stronger classes is a reasonable safety
pilot, but certification must subsequently include a closely supported weak-stratum cohort because that is where
the policy's benefit and failure modes concentrate.

## Required bounded next fold

No long-range architecture teardown is required. Before another Codex round:

1. define authoritative immutable queue identity and its server/client consumers;
2. define durable exhausted-day semantics and add the explicit pass-to-advance product decision;
3. reconcile DF2-10 vs DF2-14 across the task card, delta list, item 15, and authorization matrix;
4. resolve mixed-class/shared-state enablement scope;
5. add DF2-12/13, W3/D-3, DF2-44, and cached-client gates to DF2-14 staging;
6. resolve dark label collection and challenge-reversal semantics;
7. correct the evidence wording and simulator scope; add seeded sensitivity evidence after candidate decisions;
8. replace the stale v1 item-15 synopsis and complete §8.

After that bounded fold, the addendum should be fit for David's item-15 decision and for conversion into a real
DF2-14 card.
