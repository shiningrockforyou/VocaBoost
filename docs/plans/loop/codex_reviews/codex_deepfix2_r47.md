# Codex review — DEEPFIX 2 round 47

**Reviewed:** 2026-07-26  
**Scope:** owner-answer adjudication for R2-31..R2-33  
**Overall verdict: ACTIVATION ACCEPTED; Q2 AMENDED; Q3 REJECTED; Q5/Q6 ACCEPTED WITH CONTRACT ADDITIONS; Q7 AMENDED.**

## Executive ruling

| Item | Ruling | Required disposition |
|---|---|---|
| Q1 / R2-31 activation | **SOUND** | Seal it. This closes r46-B1's activation half, not the backfill race in r46-B2. |
| Q2 historical proof | **AMEND** | Do not trust every stored `score >= 92`. Use a provenance-qualified historical boundary, or make **all four** labels prospective. |
| Q3 shared settings | **REJECT** | “Follow current mechanics” describes today's collision; it does not resolve it. One shared logical list-day needs one server-pinned effective config. |
| Q4 / R2-32 kill switch | **AMEND** | Keep fail **and correct** stamps; freeze proven; define cold-start config failure and attempt/config-version behavior. |
| Q5 reset | **SOUND, ADD EPOCH BOUNDARY** | Reset clears the four labels because it deletes `study_states`; define “lifetime” as within one reset epoch and invalidate old jobs/queues. |
| Q6 modality | **SOUND** | Delete the hidden fallback; missing `reviewTestType` resolves visibly to `mcq`, matching today's teacher UI/defaults. |
| Q7 retention | **AMEND** | Thirty days is reasonable, but after row deletion the submission is not recoverable from those rows. Pick an honest expiry outcome. |

## Q1 — activation: sound

R2-31 is the correct interpretation of “one launch”:

1. dark-deploy compatible code with `enabled:false`;
2. verify the complete build/rules/index/client set;
3. run backfill plus the bounded final delta;
4. perform one audited cohort-wide activation.

That preserves David's no-pilot/all-at-once exposure decision while removing the partial-callable activation
window. Seal R2-31 and mark the literal R2-6 pre-set-true prose superseded rather than leaving both instructions.

This does **not** close r46-B2. “Bounded delta” still needs a durable high-water mark, late-write capture,
idempotent replay, and activation barrier. R2-31 should point to that Track-B contract rather than imply the words
alone solve it.

## Q2 — historical proof: amend WSL's recommendation

WSL's semantic instinct is right: a historical proof should satisfy the same threshold as a prospective proof.
The blanket implementation—“stored score >= 92”—is not clean enough.

Historical attempts span weaker writer/provenance eras. The current server-authoritative attempt/rules posture was
not always present, and historical `totalQuestions`, answer correctness, presented-set completeness, and even
attempt creation were not uniformly server-owned. A stored 92 can therefore be an old denominator bug, incomplete
presented set, client-authored grade, or forged record. Replacing legacy `passed:true` with an unqualified legacy
`score >= 92` changes the laundering test but does not eliminate it.

Also, David's “start fresh” has two meanings that must not be conflated:

- **all four labels prospective** is a genuinely fresh start, but it reverses R2-3's full-history decision;
- historical failures/corrects plus prospective-only proof is **not** fresh. It imports every historical negative
  while denying historical recovery and is the harshest/asymmetric option.

### Recommendation

Use **provenance-qualified recompute-at-92**, applied symmetrically to every backfilled label:

1. Track B identifies the earliest attempt era whose creation, correctness, denominator, and presented set are
   authoritative enough for the relevant label.
2. Only trusted attempts enter `reviewFailCount`, failed/correct timestamps, or proof reconstruction.
3. A trusted historical attempt stamps proof for a correct word only when its authoritative score is at least the
   launch threshold.
4. Accepted adjudications use their authoritative adjudication timestamp.
5. Untrusted history is diagnostic only; it cannot poison or prove.
6. Publish trusted/untrusted counts and resulting label distributions before David authorizes 26SM writes.

If the investigation cannot prove a trustworthy historical boundary, the clean fallback is **all four labels
prospective**, explicitly superseding R2-3. Do not use the one-sided “historical failures, prospective proofs”
variant.

## Q3 — shared-student settings: reject “follow current mechanics”

### Code-truth check

WSL's description of today's mechanics is factually correct:

- `DailySessionFlow` reads the launching class's assignment
  (`src/pages/DailySessionFlow.jsx:542-585`);
- the session/scratch document is keyed by class and list
  (`src/services/sessionService.js:54-71`);
- `initializeDailySession` receives those class-specific settings and class progress
  (`src/services/studyService.js:347-381`);
- the unmastered/MASTERED word pool is shared at `users/{uid}/study_states` and queried by list
  (`src/services/studyService.js:351-355,414-438`);
- reset is explicitly list-wide across all classes and deletes the shared word records
  (`functions/foundation.js:2037-2108`).

That proves the collision exists. It does not prove it is safe to preserve.

### Why the threshold half still fails

`reviewLastProvenAt` contains no score or threshold. If class B passes at 70 and stamps it, class A at 92 later
consumes the same timestamp as proof. The 92-class teacher's gate therefore governs day advancement but no longer
governs the shared fill/graduation proof. Calling this “teacher-created, visible, bounded” does not resolve the
semantic contradiction, and the MASTERED analogy is incomplete: the new proof predicate explicitly depends on a
threshold while the shared timestamp cannot represent different thresholds.

### Why the queue/test-size half also fails

The redesign makes the queue and presented set immutable/server-verifiable. If class A has queue/test 60/30 and
class B has 30/10, the same student/list/day can acquire two different queue identities. Cross-class completion can
then consume B's smaller passing review to advance the shared logical day that A presents as requiring its larger
queue/test. Which class opens first must not decide the student's contract.

Class-scoped queues also break the “one live position shared across simultaneous classes” goal: there is one
position but two incompatible definitions of the work required to advance it.

### Recommendation

Create exactly one server-owned **effective config snapshot per student+list+logical day**, and bind every class
surface/attempt/completion to its ID. The snapshot contains at least:

`{threshold,queueSize,testSize,reviewTestType,sourceAssignments,configVersion,createdAt}`.

David must choose the conflict resolver. My safe launch recommendation is:

- if all active assignments agree, use their value;
- if they conflict, use the strictest deterministic values (`max threshold`, `max queueSize`,
  `max testSize` clamped to queue/pool), show the conflict to affected teachers, and log it;
- teacher UI must disclose that the shared list uses a shared effective contract;
- no “first class opened wins,” most-recent-edit, or student-selected-class resolver.

A later richer ownership UI is possible, but the resolver cannot be deferred: exact queue identity and shared
proof are launch invariants. If strictest-wins is not pedagogically acceptable, David must choose a canonical
list-level owner or require assignments to agree before the student can start. Per-class independent semantics are
not compatible with shared list progress.

## Q4 — kill-switch law: sound direction, two omissions

R2-32 correctly makes legacy behavior ignore the new fields and prevents auto-passed OFF attempts from minting
proof. David's inertness premise is accurate **while OFF**: no legacy reader consumes the four new fields. They
become active again on re-enable, which is intentional and should be stated.

Two additions are required:

1. `reviewLastCorrectAt` must continue writing while OFF, alongside `reviewFailCount` and
   `reviewLastFailedAt`. It is truthful answer evidence and clears priority only; it does not grant fill/graduation
   proof. The concise OFF law is: **fail + correct write; proven freezes; retests remain label-neutral**.
2. “Config-read failure => last-known posture” needs a cold-start rule. A new function instance may have no cached
   posture. Use a bounded validated cache when present; with no last-known value, return an unavailable/hold result
   and mint no attempt/progress/label evidence. Never guess OFF on cold start.

Attempts/day queues must keep their stamped config version through completion even if the switch changes
mid-session. R2-31/R2-32 should point to one versioned helper contract.

## Q5 — reset: accept, but bind every delayed artifact to the epoch

WSL's proposed semantics match the implementation. `resetProgress` deletes:

- all attempts for the student/list;
- all class/list session states;
- all list `study_states`;
- all class progress for the list;
- then increments `resetEpoch`
  (`functions/foundation.js:2037-2134`).

The four labels therefore disappear naturally. Define `reviewFailCount` as “lifetime **within the current reset
epoch**,” not lifetime across a deliberate start-over.

One new correctness seam follows from R2-13: an ungraded grading job or immutable day-queue created before reset
must not finish afterward and repopulate the fresh epoch. Stamp `resetEpoch` on grading jobs, queue records,
attempt contexts, and completion requests; reject/cancel on mismatch. Reset should delete or terminally cancel
pending jobs/queues for the list. This is a build contract, not another pedagogy decision.

The ledger should also describe the current callable accurately: it is self-service for the authenticated
student; teacher/CS reset tooling, if any, is a separate authorization surface.

## Q6 — modality: accept deletion of the fallback

The code confirms WSL's reading:

- `reviewTestType` wins when present (`DailySessionFlow.jsx:1195-1199`);
- only a missing field calls `getReviewTestType`;
- that helper uses typed for the first three attempts when generic `testMode` is typed/both, then silently changes
  to MCQ (`sessionService.js:374-385`).

Teacher creation/edit UI already defaults and displays `reviewTestType` as `mcq`
(`AssignListModal.jsx:13`; `ClassDetail.jsx:177,270-274`). Therefore the clean behavior is:

`actualMode = assignment.reviewTestType || 'mcq'`.

Delete the attempt-count fallback and its import. Add fixtures for explicit mcq, explicit typed, missing legacy
field, repeated retakes, and cached-client/config-version behavior. Metering observes AI cost; it must not silently
change test difficulty.

## Q7 — 30-day retention: reasonable duration, incorrect expiry claim

Thirty days is a reasonable proposed active recovery window, but this sentence is contradictory:

> expiry recoverable via re-grade from stored rows

If TTL deletes the rows, the server cannot re-grade from them. If rows remain, the response data has not expired.

Recommended contract:

- ungraded/retryable job retains rows and complete context for 30 days;
- during those 30 days it is recoverable cross-device;
- on expiry, rows and answer-bearing context are hard-deleted and the student must take a new test;
- UI warns before/at expiry and never claims the old submission is recoverable;
- successfully graded jobs follow the existing shorter cache/attempt retention rule;
- reset cancels the job immediately regardless of TTL;
- rules, teacher access, audit access, and cleanup verification are explicit.

If David requires recovery after 30 days, store the immutable submission in a separately retained record and call
30 days the **job-processing** TTL, not response-data retention. He still needs to ratify the duration and expiry
experience.

## Reopened/remaining contracts

- r46-B1 activation is closed by R2-31; r46-B2 live-write/watermark cutover remains open.
- r46-B3 is mostly closed by R2-32 after the correct-stamp and cold-start clauses above.
- r46-B4 remains open; WSL's Q3 response does not close it.
- r46-H1 becomes the provenance-qualified historical backfill requirement.
- r46-H2 authoritative queue identity now explicitly includes one effective shared config.
- r46-H5 cached-client version negotiation remains a launch gate.
- r46-H6 closes once reset-epoch cancellation covers jobs/queues.
- r46-H7 closes only after David ratifies Q7 and the access/TTL contract.
- r46-H8 closes with Q6's fallback deletion and fixtures.

## Final recommendation to David

1. **Seal Q1.**
2. For Q2, choose provenance-qualified recompute-at-92; if no trustworthy era can be demonstrated, start all four
   labels prospectively. Do not backfill only the negatives.
3. Do **not** accept current-mechanics Q3. Choose a deterministic shared effective-config resolver; strictest-wins
   with visible conflict is the safest launch default.
4. Ratify Q4 with fail+correct writes, proven freeze, and fail-closed cold-start behavior.
5. Accept reset-clears-labels and epoch-bind/cancel delayed artifacts.
6. Delete the modality fallback and default missing legacy fields visibly to MCQ.
7. Thirty days is acceptable if expiry means the old submission is deleted and a new test is required.

**Round-47 owner-answer adjudication: DONE.**
