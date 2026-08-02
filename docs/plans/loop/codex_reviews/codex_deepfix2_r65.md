# Codex round 65 — r64 closure fold / tail-custody / freeze-readiness review

**Reviewed:** 2026-08-03  
**Round disposition:** **DONE**  
**Freeze ruling:** **NOT REQUESTED / NOT ISSUED**  
**FREEZE-READY-EXCEPT-DAVID:** **NO**  
**Track B:** **NO-GO — ONE REPRODUCED FINAL-GATE FALSE GREEN AND ONE REPRODUCED LEASE-THEFT BUG**  
**New-law read:** tail disposition **NOT SAFE AS IMPLEMENTED**; stamping predicate **PLAUSIBLE SHAPE, NOT YET ONE EXECUTABLE CONTRACT**

## Ruling

Round 65 materially closes several r64 defects. B4 now binds `--postFlip` exactly to the durable marker;
the uncovered-student skip is gone; the post-flip universe includes through-cutoff words; the isolated lap
uses `DEEPFIX_AUDIT_ROOT` and a lap lock; the shadow mirror/partition wording is repaired; and B1's A8 exit
is 8. I independently reproduced the 57/0 delta fixture, 2,688/0 rotation fixture, and all 54 green
assertions in the unmodified emulator lap. I also verified that every source hash in evidence v2 matches
the checkout at `4fbe2e1123a3f1bb4d7972242ade814dcf0f69d5`.

That does not make the packet freeze-ready. Two temp-copy-only emulator additions against the same current
CLIs produced **56 checks / 2 safety failures**:

| Probe | Safe result | Current result |
|---|---:|---:|
| Proposed-law accepted challenge: keep `isCorrect:false`, correct stored score to 100, stamp correct/proven at review time, and corrupt the historical `reviewFailCount` from 1 to 0 | DIFFS | **PASS (0), `preFlipTail:4`, `totalDiffs:0`** |
| Pre-create the per-original B3 lease with the still-running harness PID but an age of three hours, then start another EXECUTE | REFUSE (2) | **TAKEOVER + EXECUTE (0)** |

The first result is a final-authority false green. The accepted attempt is excluded by the score/row fence,
then the new tail rule excuses remaining layer-equal mismatches without proving they occurred before the
flip. The second disproves the handoff's pid-liveness serialization claim. There is also no activation
barrier: a B3 process admitted before `firstEnabledAt` is set can continue writing after the flip.

`codexDecision=DONE` means this review turn is complete. It is not GO, freeze approval, or owner
ratification of the dark-window policy.

## r64 closure accounting

| r64 item | Round-65 verdict | Independent result |
|---|---|---|
| A1 durable post-flip boundary | **CLOSED** | B4 reads `system_config/review_v2.firstEnabledAt`, rejects missing/malformed/mismatched markers, and records marker/update-time data (`b4-verify.mjs:103-114`). The emulator wrong-boundary negative executes. |
| A2 adjudication exemption | **OLD SKIP CLOSED; REPLACEMENT LAW BLOCKED** | The whole-word skip is gone and rejected+corrupt now fails. The replacement replay cannot represent either legacy accepted rows or future score-correcting accepted rows; finding A1 below. |
| A3 uncovered joiner | **CLOSED FOR THE REPRODUCED CASE** | `!src.row` is listed but not skipped (`b4-verify.mjs:191-199`); a pre-flip uncovered joiner exits 5 and appears in `uncoveredAtGate`. “Uncovered always blocks” is broader than the code: a UID with no replay-known words has no diff to block, which is reasonable but should be described accurately. |
| A4 post-flip new word | **SPECIFIC FALSE RED CLOSED; MATRIX INCOMPLETE** | The through-cutoff universe makes the executed new-word failure pass. The requested correct/mixed/blank cases are still absent, and the tail exemption can waive an absent-vs-zero field merely because the layer also lacked it. |
| A5 dark-window authority | **STILL PENDING OWNER; NOT INTERNALLY CONSISTENT** | No owner ruling was requested this round. The new stamping and tail text still conflicts across H6/Track B/shadow choreography; finding A4. |
| A6 lap scope/isolation/evidence | **MECHANICS CLOSED; COVERAGE PARTIAL** | All CLIs honor the isolated root; the shared forensic chain was untouched; concurrent lap locking and the positive repair case exist. Evidence is source-bound but aggregate-only, and the safety cases below are missing. |
| B1 shadow partition prose | **CLOSED** | `16_SHADOW_COHORT_AUDIT.md:113-122` now distinguishes class-allowlisted B1/B3/B4 operations from student-granular partition-manifest batteries. |
| B2 B3 serialization / repair reality | **OPEN / REPRODUCED** | The lease can be stolen from a live holder; release is not ownership-conditional; repair's scan is weaker than B4's ledger law; and the flip does not share a barrier with B3. |

## A. Blocking findings

### A1. The adjudication law has neither a recoverable grading-time source nor an as-of-boundary replay

The new replay assumes that `answers[].isCorrect` is immutable grading-time truth
(`b1-replay-lib.mjs:81-96`). The actual repository does the opposite today: both challenge-accept writers set
`isCorrect=true`, recompute score/passed from the changed rows, and persist all three
(`functions/foundation.js:2592-2605,2612-2627`; `src/services/db.js:2900-2922,2938-2947`). Historical accepted
rows have therefore already lost the proposed pre-accept boolean. `submitChallenge` also does not require the
challenged row to be wrong (`functions/index.js:727-748`), so `challengeStatus:'accepted'` is not an
authoritative inverse from which the old value can be reconstructed.

Future rows under the proposed immutable-row law still fail the current replay. Acceptance corrects the
stored score, but the exclusion fence compares that effective score with the count of grading-time `ok`
rows (`b1-replay-lib.mjs:69-76,89-96`). A one-wrong-row acceptance therefore makes a complete attempt look
impossible and excludes the whole attempt. The shipped fixture avoids this production behavior: stage 9c
marks a row accepted while leaving the two-row attempt's score at 0 (`delta-chain-fixture.mjs:340-354`). The
round-65 emulator acceptance case does the same (`b-emulator-lap.mjs:274-282`). Neither tests the score update
performed by both real writers.

The replay is also not historical at the requested watermark:

- `okEff` uses the current accepted status regardless of whether `challengeReviewedAt` is after the replay
  watermark (`b1-replay-lib.mjs:36-54,85-89`). An acceptance after the flip is therefore visible in the
  flip-boundary recomputation.
- Accepted correctness/proof is timestamped at the original attempt's `submittedAt` (`:118-129`), while the
  live path and lap treat the mint time as `challengeReviewedAt`. A day-1 fail accepted on day 10 can be
  ordered before a day-5 fail, reversing `needsPriority`.
- Duplicate content hashes include `r.ok` but omit `okEff`/challenge state (`:95-111`), so two otherwise
  identical retry documents with different adjudication state are collapsed and `g[0]` decides the result.

The emulator counterexample made the future-law shape realistic (`isCorrect:false`, accepted, corrected
`score:100`, `passed:true`), then wrote an invalid `reviewFailCount:0`. B4 returned **PASS**. A sound replay
must retain the historical fail and expect 1.

Required closure: define and persist immutable grading preimages (`gradedIsCorrect`/original rows and an
organic score, or an append-only adjudication record) before changing the writers; explicitly dispose of
already-mutated legacy accepted rows with owner-approved census/exclusion/repair semantics; replay acceptance
as of `challengeReviewedAt`; use acceptance time for correct/proven stamps; bind duplicate identity to the
effective adjudication facts; and update every grade/gradebook/reader surface that currently derives counts
from `isCorrect`. Add realistic accepted-pass, accepted-fail, accepted-after-boundary, accepted-resting,
legacy-mutated, and duplicate-state fixtures.

### A2. `preFlipTail` is value coincidence, not tail provenance, and it creates a reproduced false green

B4 calls any mismatch a pre-flip tail when the current disk value equals the last layer value
(`b4-verify.mjs:221-230`). That equality does not prove the causal event fell between the layer watermark and
the flip. It also matches post-flip in-place mutation of an old attempt, post-flip adjudication, an omitted
live write, and ordinary corruption that happens to equal the old layer.

The adversarial accepted-score case was explicitly reviewed **after** the flip. Nevertheless, B4 reported
four `preFlipTail` fields and zero diffs, including while the cumulative fail count was corrupt. This
directly falsifies the classifier's name and authority. The unmodified 54-case lap has no tail case at all;
`preFlipTail` appears in B4 and prose, not in an assertion that distinguishes pre-flip tail from post-flip
mutation. The report also caps tail rows at 500 without a tail-row truncation indicator, although the count
continues.

The tail concept itself is necessary: submissions truly made after the last layer watermark but before the
flip can leave layer-owned disk state behind. The present inference is not sufficient. Required closure:
derive the tolerated set from authoritative event provenance and times (attempt submit time, adjudication
review time, reset/override ordering) in the exact `(layerWatermark, firstEnabledAt)` interval; never infer
era from disk equality alone. If in-place historical documents make an as-of replay impossible, capture a
pre-flip snapshot/digest or make the unresolved tail blocking. Test true pre-flip tail, post-flip mutation,
mixed tail+live count, >500 rows/truncation, and accepted-after-flip corruption.

### A3. The B3 lease is stealable from a live process and does not fence the activation flip

The lease computes `stale` from age first and checks PID liveness only when the age has **not** crossed two
hours (`b3-backfill-writer.mjs:235-254`). I created the exact lease for the current original manifest with the
still-running emulator harness PID and an age of three hours. The second B3 printed “stale execution lease
(>2h) — taking over” and exited 0. Thus a legitimate long B3 can be overlapped. The old holder later removes
the lease unconditionally (`:443-449`), so it can delete the replacement holder's lease and admit a third
writer. The lease has no ownership token or conditional release.

More fundamentally, B3 reads `firstEnabledAt` once before cohort loading and before acquiring its local file
lease (`:120-128` versus `:235-257`). If the activation txn sets the marker after that read, the already
admitted B3 continues phase 1/2 after the flip while live writers own the same fields. The proposed flip
choreography does not acquire/check this lease, and a local filesystem PID lease is not a distributed
Firestore cutover barrier.

Repair reality is also not yet “B4 strict latest-attempt state.” Its scan recognizes missing claimed-ledger,
unreported delta hashes, and intent-without-any-completion (`:159-179`), but it does not validate the ledger
version/probe schema or reject the latest completion's `txnFailures`/reset/epoch skips as B4 does
(`b4-verify.mjs:63-96`). A failed/skipped completion appended after the report can therefore pass the
under-lease repair scan.

Required closure: liveness wins over age; use a unique lease token plus heartbeat/expiry and release only if
the token still owns the file; mirror B4's strict ledger reducer in repair; and introduce a distributed
activation barrier shared by B3 and the flip. At minimum the flip must prove no B3 execution can be admitted
or in flight, and B3 must re-check/transactionally fence the marker at the last safe point before writes.
Add live-old-holder, takeover/release race, two-process repair/delta, and guard-read→flip→write emulator cases.

### A4. The stamping-predicate shape is reasonable, but the documents and rehearsal drill do not implement one law

My read on the proposed predicate is: **`firstEnabledAt present OR class in rehearsalClassIds` is the right
high-level eligibility shape**. It permits dark 25WT/shadow rehearsal without globally activating 26SM and
keeps the durable marker authoritative afterward. It is not yet one frozen executable contract:

- H6 first states marker-or-rehearsal, then two lines later states writers stamp only when the marker is set
  and the dark window has zero live writers (`15_H6_SCHEMAS_AND_CONTRACTS.md:205-211`).
- Track B still states marker-only/zero-live-writers with no rehearsal carve-out
  (`14_TRACK_B_BACKFILL_PIPELINE.md:109-115`).
- Shadow config law says drill E uses assignment OFF **plus rehearsalClassIds removal**
  (`16_SHADOW_COHORT_AUDIT.md:70-73`), while drill E expects labels to keep writing (`:174-175`). Under the new
  predicate, removing the class while the global marker is absent disables label writers, so the drill cannot
  certify the OFF-stamping law it names.

The predicate also needs to be described as *writer eligibility*, followed by the exact per-field posture
truth table; “stamp iff” by itself is ambiguous beside R2-32's fail/correct-write but proven-freeze rule.
Attempt-time snapshot and in-flight drain semantics must say what happens if rehearsal membership is removed
between compose and accepted-attempt transaction.

Required closure: rewrite H6, Track B, task card, and shadow runbook to the same marker-or-rehearsal
eligibility law; keep the rehearsal class registered while toggling only its assignment OFF for drill E;
drain/fence in-flight requests before membership removal; and execute the per-field ON/OFF truth tables. David
still owns the pre-first-activation custody/two-field-flip/tail-disposition decision.

## B. Evidence and test-harness assessment

The evidence improvement is real: v2 binds HEAD, Node, and eight script SHA-256 prefixes, and every hash
matches this checkout. The isolated root prevents the r64 shared-forensics deletion. The positive repair
case, marker negative, rejected-corruption case, failed-new-word case, and uncovered-joiner case all execute.

The green count is nevertheless false reassurance for the new laws:

1. Both accepted cases leave the stored score uncorrected; stage 9c also uses attempt time as its expected
   acceptance timestamp.
2. There is no true-tail versus post-flip-mutation case.
3. There is no live-holder-over-two-hours lease case or activation-cutover interleaving.
4. The r64-requested post-flip correct/mixed/blank new-word matrix is incomplete.
5. The JSON is aggregate-only: no per-case results, command, Firebase/Java versions, or artifact hashes.

These gaps explain why the source-bound 54/0 artifact and the independently reproduced safety failures can
both be true.

## Minimal falsifiable closure set

1. Replace the adjudication assumption with an immutable, boundary-replayable grade/adjudication schema and
   owner-approved legacy disposition; update all writers/readers and realistic fixtures.
2. Replace value-equality tail forgiveness with event-provenance/time-bounded classification, or block the
   unresolved tail; test post-flip mutation explicitly.
3. Fix live-lease takeover/conditional release, reuse B4's strict ledger reducer for repair, and add a
   distributed B3↔activation cutover barrier.
4. Reconcile marker-or-rehearsal prose and execute the OFF drill while rehearsal eligibility remains active,
   with an explicit drain/removal law and per-field truth table.
5. Extend source-bound evidence with the missing accepted-score, tail, lease, correct/mixed/blank, and
   cutover-interleaving results.

Only after those close would David's dark-window ruling be the sole remaining prerequisite. Today it is not;
therefore **FREEZE-READY-EXCEPT-DAVID = NO**.

## Independent checks executed

- Revalidated baton owner `codex`, round 65, revision 202, task/handoff, and exact written-last ready marker.
- Reviewed the handoff, evidence, all eight source-bound scripts, relevant production challenge writers,
  Track B/H6/shadow/task-card folds, r64 review/panel, and working-tree state at HEAD `4fbe2e1`.
- `node --check` passed for all eight source-bound Track-B modules.
- `node scripts/deepfix2/delta-chain-fixture.mjs` returned **57 checks / 0 failures**.
- `node scripts/deepfix2/rotation-cyclicity-fixture.mjs` returned **2,688 checks / 0 failures**.
- The unmodified isolated emulator lap executed **54 checks / 0 assertion failures**.
- A temp-copy-only adversarial extension executed **56 checks / 2 safety failures**: accepted-score/corrupt-fc
  returned PASS with `preFlipTail:4`, and a live three-hour-old lease was stolen.
- No production Firestore, Docker, Playwright, shared forensic chain, or application source was mutated.
