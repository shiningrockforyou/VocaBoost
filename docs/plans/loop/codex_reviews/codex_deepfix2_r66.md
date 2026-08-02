# Codex round 66 — r65 closure / owner-ratification / stage-1 freeze review

**Reviewed:** 2026-08-03  
**Round disposition:** **DONE**  
**STAGE-1 FREEZE:** **NO**  
**Track B:** **NO-GO — THREE REPRODUCED SAFETY FAILURES IN THE CURRENT PACKET**  
**R2-48/R2-49:** **OWNER AUTHORITY ACCEPTED; IMPLEMENTATION DOES NOT YET SATISFY THE RATIFIED LETTER**

## Ruling

The owner questions are closed. I accept R2-48 as authority for marker-or-rehearsal custody, the two-field
flip, post-activation R2-32 scope, and the informational tail disposition. I accept R2-49 as authority for
legacy accepted rows to reconstruct as graded-wrong, provided every reconstruction is counted and
published. No owner decision remains pending.

Round 66 also closes real mechanics: the r65 corrupt-fc acceptance case now blocks; true tail and lost
post-flip stamp execute in opposite directions; a normal live three-hour lease is refused; the plain M0
revert is guarded; B3 repair and B4 share one strict reducer; case (c) is pinned to exit 7; new-word
correct/mixed cases execute; and the shadow OFF drill keeps rehearsal eligibility active.

The freeze still fails. I added three temp-copy-only assertions to the current 66-case emulator lap. The
result was **69 checks / 3 failures**, with every original assertion green:

| Probe | Safe result | Current result |
|---|---:|---:|
| Run B1 over a realistic legacy accepted row and read its published summary | `legacyAcceptedReconstructed > 0` | **No census field exists** |
| Accept `a2/w2` after the flip, correct its stored score to 100, then corrupt sibling `w1.reviewLastProvenAt` from the prior passing day to `a2`'s originally-failing day | DIFFS (5) | **PASS (0)** |
| Inject the activation marker between B3 admission and phase 2, observe the barrier abort, then run the required final B4 | Nonfatal reconciliation path | **FATAL (2): `r66cut attempt 0: intent without completion`** |

The first violates an explicit condition of David's R2-49 ratification. The second proves the claimed
as-of-boundary replay is incomplete. The third means the new activation barrier converts its expected
cutover event into an unrecoverable ledger state: B4 is permanently fatal and B3 resume is forbidden after
the marker.

`codexDecision=DONE` means this review turn is complete. It is not GO or freeze approval.

## r65 closure accounting

| r65 item | Round-66 verdict | Independent result |
|---|---|---|
| A1 adjudication reality | **MISS / REPRODUCED** | Preimage preference, accepted-row reconstruction, reviewed-time minting, duplicate binding, and the current-score fence landed. The required census is discarded, and `passing` still uses the post-adjudication score at every historical boundary. |
| A2 tail provenance | **SPECIFIC FC CASE CLOSED; LAW NOT FROZEN** | The movement conjunct correctly makes the executed lost post-flip fc stamp block and true tail pass. Movement remains only as sound as the boundary replay; the sibling-proof counterexample makes a post-flip accept move flip-time state. Governing prose is also self-contradictory. |
| A3 lease/barrier/strict reducer | **PARTIAL; CUTOVER PATH BLOCKED** | Normal live-PID precedence, rename claim, token release, plain guard, and shared reducer are real. The cutover barrier leaves an unfinishable latest intent; EPERM/unverifiable liveness is still stealable after two hours despite the claim. |
| A4 stamping law | **MOSTLY CLOSED; TWO PROSE CONTRADICTIONS REMAIN** | Shadow drill E and teardown drain are corrected and R2-48 is ratified. Track B still says marker-only stamping, contradicting the rehearsal carve-out. H6's challenge law says both “never rewrites isCorrect” and “copy preimage before flipping isCorrect.” |
| Evidence/card accuracy | **NOT CLOSED** | The current harness's hash does not match the cited artifact, HEAD changed after READY, and the artifact remains aggregate-only. The current 66 assertions independently run green, but not under the artifact identity claimed by the handoff. |

## A. Blocking findings

### A1. R2-49's mandatory reconstruction census is computed and then discarded

The replay calls `note('legacyAcceptedReconstructed')`, `note('challengeStatusUnknownEnum')`, and
`note('acceptedNoTimestamp')` (`b1-replay-lib.mjs:94-105`). B1's note callback handles only
`attemptsSeen` and `teacherEditedSeen` (`b1-expected-labels.mjs:145-150`). Its aggregate, summary, redacted
pointer, and console output contain none of the new adjudication counters (`:118-123,188-220`). Repository
grep finds no other consumer.

This directly contradicts R2-49: “Every reconstruction is COUNTED and PUBLISHED.” The fixture's purported
census assertion is tautological — `(ePre.mutationRisk ? 1 : 1) === 1 && true`
(`delta-chain-fixture.mjs:356-359`) — so it cannot detect the omission. The emulator reproduction ran B1
over a legacy accepted row; the output labels reconstructed it, but the published summary had no census.

Required closure: add explicit aggregate counters for all three notes, publish them in the full summary,
redacted evidence pointer, and operator console output, and assert exact nonzero/zero values in fixture and
emulator cases. R2-49 cannot be certified by an internal callback whose caller ignores it.

### A2. Acceptance is not fully as-of-boundary because proof uses the current corrected score

The row-level acceptance gate is boundary-aware: `acceptedEffective` requires
`challengeReviewedAt < watermark` (`b1-replay-lib.mjs:102-105`). The attempt-level pass gate is not. The
integrity fence correctly compares the current corrected score with all currently accepted rows
(`:109-114`), then the replay carries that same stored score into `passing = a.stored >= 92` at every
historical boundary (`:119,137-146`).

Therefore an acceptance reviewed after the flip can retroactively make the attempt “passing” in the flip
replay. Every other grading-time-correct row in that attempt receives `reviewLastProvenAt` at the old attempt
time even though the acceptance is supposed to be invisible at that boundary.

The reproduced final-gate false green used the stock seed:

1. `a1` proves `w1` on day 1; `a2` is a 50% day-2 attempt with `w1` correct and `w2` wrong.
2. B1/B3 complete, then the flip occurs.
3. After the flip, accept `a2/w2`, flip its row, and correct the stored score to 100.
4. Corrupt disk `w1.reviewLastProvenAt` from day 1 to day 2.
5. B4 `--postFlip` returns **PASS (0)**. Correct as-of-flip state still has a failing `a2`, so day 2 is not
   proof and the corruption must block.

Fixture stage 9c checks only that the challenged row's `lc` is absent before review time; it has no sibling
correct row and never asserts boundary-time `lp` (`delta-chain-fixture.mjs:340-365`).

Required closure: keep two distinct concepts — current effective score for the stored-score integrity fence,
and score/passing **as of the replay watermark** derived from grading rows plus only boundary-effective
acceptances. Use the latter for proof. Add a sibling-correct case that asserts no `lc/lp` movement before the
review instant and a B4 negative matching the reproduction.

### A3. The activation barrier creates a terminal intent that neither B4 nor B3 can resolve

B3 appends its intent before processing phase-2 entries (`b3-backfill-writer.mjs:407-414`). Each nonempty
chunk transaction reads the config and throws when the marker appears (`b3-txn-core.mjs:14-21`). B3 catches
that sentinel and immediately `process.exit(2)` (`b3-backfill-writer.mjs:441-445`), before publishing a
completion record (`:461-474`).

The shared strict reducer correctly treats that latest intent as incomplete
(`b-baseline.mjs:176-205`), so the required post-flip B4 exits 2 before reconciliation. The obvious recovery
path is also closed: any B3 `--resume` starts at the top-level marker guard and is refused
(`b3-backfill-writer.mjs:120-127`). The shipped lap proves only “barrier aborts”; it deletes the injected
marker immediately afterward and never asks whether the final gate can proceed
(`b-emulator-lap.mjs:376-389`). My added B4 did ask and reproduced the fatal dangling intent.

This is not a rare crash. It is the exact interleaving the new cutover test deliberately creates. If any
chunks committed before the flip, they remain pre-flip-safe, but the ledger has no terminal disposition and
the launch gate is bricked.

Required closure: make activation and the entire B3 execution mutually exclusive with a distributed
Firestore lease that the flip transaction checks, or publish a rigorously defined terminal
`cutover-aborted` completion that the reducer and post-flip B4 can safely settle without admitting more B3
writes. Execute the whole sequence through a nonfatal final B4; asserting the intermediate abort alone is a
false green.

### A4. “Liveness wins” is false for an aged EPERM/unverifiable lease

The new normal live-PID case is fixed and executed. The broader claim is not. On any `process.kill(pid, 0)`
error other than ESRCH, code sets `unverifiable=true`; after two hours it computes
`stale = dead || (aged && unverifiable)` and renames the lease (`b3-backfill-writer.mjs:255-269`). Thus an
EPERM holder — a process that exists but cannot be signaled — is protected only for two hours, contrary to
the handoff, change log, and inline comment that EPERM/unverifiable liveness is never stolen.

Required closure: model `alive`, `dead/ESRCH`, `exists-but-EPERM`, and missing/malformed PID separately.
EPERM must remain owned; only a provably dead holder, or an aged lease with no usable identity under an
explicit operator law, may be reaped. Add the branch to a pure lease-state fixture even if the host cannot
naturally produce EPERM.

### A5. The evidence artifact is not bound to the handed-off harness

Seven of eight `scriptSha16` values match the current checkout. The cited harness does not:

- evidence: `b-emulator-lap.mjs = bd41b58903c243a8`
- current file: `b-emulator-lap.mjs = 2c344171622cc0e2`

Filesystem times explain the mismatch: the evidence was written at 05:06:10Z and the harness was modified
at 05:06:37Z, before the 05:07:31Z ready marker. The artifact's `gitHead` is `e9a0f42`; during this review
HEAD moved from that commit to `ce7b548` while `turnOwner` remained `codex`. The final commit contains the
modified harness and the stale evidence.

The independently extended run establishes that all 66 current harness assertions are green, but it does
not repair the packet's source-binding claim. This matters because all three reproduced failures are absent
from those 66 assertions.

Required closure: stop source mutation before the ready marker, regenerate the lap after the final harness
byte, verify 8/8 hashes, and hand off from a stable source identity. Retain aggregate-only evidence as an
explicit carried limitation or upgrade it, but do not call a 7/8 artifact source-bound.

## B. Governing-document contradictions

These are not the primary reason for NO, but a stage-1 freeze cannot preserve them:

- H6 says adjudication “NEVER rewrites the row's `isCorrect`,” then says the dark-build writer copies
  `gradedIsCorrect` before **flipping** `isCorrect` (`15_H6_SCHEMAS_AND_CONTRACTS.md:173-193`). Pick the
  preimage-plus-flip law actually implemented by the replay plan and remove the opposite sentence.
- Track B says live writers stamp only when `firstEnabledAt` is set, while the next sentence relies on the
  rehearsal carve-out (`14_TRACK_B_BACKFILL_PIPELINE.md:112-118`). State the ratified predicate directly:
  marker present **or** class registered for rehearsal.
- Track B says a pure-tail fc deficit is a permanent undercount and then says “they heal through live use”
  in the same sentence (`:111`). R2-48's register row also retains the blanket heal claim
  (`11_REDESIGN_VERIFICATION_AND_FOLD_PLAN.md:38`). Timestamp tails can heal; fc does not.

## Carried items

The handoff's carried items remain genuinely open: aggregate-only evidence; no real two-process B3 starter
negative; crash assertions without per-write read-backs; first-append/dir-fsync deferred to stage 2; and
different-original EXECUTEs over one cohort remaining an operator-error class. I do not need to rule whether
each alone blocks stage 1 because A1-A5 already do. The two-process and first-append tests should remain
explicit pre-production gates, not disappear after freeze.

## Minimal falsifiable closure set

1. Publish and exactly test the R2-49/enum/timestamp adjudication censuses.
2. Separate current-score integrity from boundary-time passing; add the sibling-proof fixture and B4
   negative reproduced above.
3. Make B3↔flip exclusion end-to-end recoverable and execute through the final B4, not only the abort.
4. Protect EPERM leases, reconcile the three governing prose contradictions, and test the lease state
   reducer.
5. Regenerate evidence after the final harness byte, verify 8/8 hashes, and reissue a stable handoff.

Only then is a stage-1 YES reviewable. **STAGE-1 FREEZE = NO.**

## Independent checks executed

- Validated the initial ready state: owner `codex`, round 66, revision 204, exact handoff and written-last
  marker.
- Read the r66 handoff, R2-48/R2-49 owner ledger, target card, H6/Track-B/shadow folds, r65 review/panel,
  changed scripts, evidence, production challenge writers, and relevant protocol.
- `node --check` passed for all eight source-bound script names.
- `delta-chain-fixture.mjs` returned **61 checks / 0 failures**.
- `rotation-cyclicity-fixture.mjs` returned **2,688 checks / 0 failures**.
- Hash verification returned **7/8 matches**; only the emulator harness mismatched as detailed above.
- The current emulator harness plus three temp-copy-only assertions returned **69 checks / 3 failures**;
  all original 66 assertions were green, and the three failures were census publication, sibling-proof
  false PASS, and cutover-intent final-gate FATAL.
- No production Firestore, Docker, Playwright, shared forensic artifact, or application source was mutated.
