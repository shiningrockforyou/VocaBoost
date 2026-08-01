# Codex round 54 — checkpoint-1 closure verification

**Reviewed:** 2026-08-01  
**Round disposition:** **DONE**  
**Stage-1 implementation-authority disposition:** **NOT READY — NEEDS FIXES**  
**B1 full-baseline disposition:** **NO-GO**

## Ruling

Round 54 closes meaningful parts of every round-53 blocker, but it does not close the checkpoint. The completion
CAS, clock rename, op-split rules shape, pinned H8 queue, measured accuracy table, and several plan folds are real
improvements. The package still has baseline false-green paths, client-writable behavioral authority, a
label-erasing rules path, reset races, an invalid launch-state simulation, and unresolved selector/challenge laws.

The full all-at-once DF2-14 dark build is not authorized. Bounded implementation that explicitly excludes the
unresolved selector, challenge, baseline, and authority surfaces may be separately proposed; that is not the
stage-1 authorization requested by this handoff.

## Closure verdicts

| Closure | Verdict | Ruling |
|---|---|---|
| 1. B1/B2 | **PARTIAL** | B2 now reads the real tombstones. B1 is not a safe or durable watermark baseline. |
| 2. H6 | **PARTIAL / MISS** | Completion CAS and posture homes closed; pool/reset/pairing/presentation authority did not. |
| 3. Rules | **PARTIAL** | Rename/op-split/live-base text closed; protected labels remain owner-deletable and one oracle uses the wrong field. |
| 4. H8 | **PARTIAL** | Pinned queues and measured rates closed; B1 seeding and the fairness oracle remain false-green. |
| 5. Track A/folds | **PARTIAL** | Several corrected contracts landed, but contradictory A1, R2-10, cycling, and range text remains. |
| 6. B1 adjudications | **POLICY CLOSED; EXECUTION PARTIAL** | Uniform stored 92 and review-only clock are in the plan, but B1's fail-open type/edit handling can violate them. |

## Closure 1 — B1/B2: PARTIAL; do not run full

### What closed

- B2 reads both real per-list tombstone homes and reports epochMarkersSeen
  (scripts/deepfix2/b2-database-investigation.mjs:101-109), matching
  functions/foundation.js:2047-2053,2110-2140.
- B1 emits per-student word-state JSONL and digests, uses the stored-score 92 comparator, applies review-only
  reviewLastTestedAt seeding, and groups duplicate signatures
  (scripts/deepfix2/b1-expected-labels.mjs:120-181).
- The saved sample is internally reproducible: 50 lines, 30,180 words, matching per-student digests, and 85.7%
  proven.

### Blocking residue

1. **The watermark is metadata, not a read boundary.** B1 records workstation Date.now at :58, but its attempt
   query at :89 has no upper bound and replay at :92-143 never rejects attempts at/after it. Tombstones and
   attempts are also read without a consistent snapshot. This cannot support the durable expected-equality
   watermark required by 10_REVIEW_GRADUATION_REDESIGN.md:104-106.
2. **The claimed fail-closed parser is still fail-open.** Missing/non-array answers are converted to an empty
   array and accepted (:103-118); submittedAt only tests truthiness of toMillis before calling it (:95-96);
   missing/unknown session types default to new (:115,118). That admits non-graded shapes and weakens Q2.
3. **Teacher edits are not adjudicated.** B1 never reads teacherEdited or preOverride. A grade-only edit can
   either be excluded from all factual fail/correct labels by the score/row fence or mint proof from an overridden
   score. This contradicts A1_FORCE_PASS_AUDIT.md:71-73,119-130 and 02_TASK_LIST.md:79.
4. **Audit output is incomplete.** The plan requires per-signature exclusions
   (14_TRACK_B_BACKFILL_PIPELINE.md:53-58), but B1 emits only global/per-class maps (:170-178). Its duplicate hash
   omits totalQuestions and is row-order-sensitive (:116). Duplicate-row failures are misclassified at :111.
5. **Epoch zero is not serialized.** The sample represents 67 (uid,list) pairs and has zero epochByList entries;
   all 67 are absent rather than explicit epoch 0. B3 therefore cannot byte-compare the advertised per-list
   snapshot without an extra unstated default.
6. **Full-run operations are unsafe.** Unknown flags are accepted; --full=true silently remains sample mode;
   invalid limits and an empty cohort are not fatal. The deterministic JSONL path is opened/truncated before reads
   complete, with no temp-file/atomic rename/completion manifest. A crash can pair partial JSONL with a stale
   summary.
7. **The output location is inappropriate for student data.** Raw UIDs and per-word assessment timestamps are
   written under a non-ignored repository docs path. The repository's existing data-handling comments state that
   UID-bearing audit/backfill artifacts remain local and uncommitted (.gitignore:55-60,83-84). A full artifact
   would extrapolate to roughly 67 MB from the 3.50 MB/50-student sample.

B2's tombstone correction is closed. Its evidence still self-labels version 1, its caps object is overwritten at
b2:126-130, and the planned recent-write cadence is absent; those are secondary to B1's no-go.

## Closure 2 — H6: PARTIAL / MISS

### What closed

- A concrete class-agnostic day-completion record now gives create-winner/already_completed-loser CAS,
  consumed-attempt/source-config audit, and same-transaction graduation/streak
  (15_H6_SCHEMAS_AND_CONTRACTS.md:60-71).
- Queue presentationCount, composeKey replay, rerun visited-day identity, all-attempt gatePosture/resetEpoch, and
  grading-job posture carry are specified at :28-58 and :73-91.

### Blocking residue

1. **Restudy pairing is reversed.** H6 :99 says empty-or-other-type fills pendingHalf and otherwise completes.
   That completes a same-type pair and refuses the required opposite-type pair. It also does not require the two
   attempts to share visitId. The exact law must be: empty stores; same visit plus opposite type consumes both and
   increments; every other combination gives no credit.
2. **Pool inputs remain client authority.** H6 :131-139 expressly leaves status/masteredAt/return fields
   owner-writable until DF2-46 and calls overwrite+sweeps interim authority. Actual rules permit owner writes
   (firestore.rules:202-216), and current clients write these fields
   (studyService.js:774-785,1552-1560,1593-1600). A write between server completion and the next compose controls
   the behavioral pool; minClientVersion does not fence direct Firestore. DF2-46 at 02_TASK_LIST.md:130 does not
   actually name the claimed rules narrowing.
3. **Reset is race-open.** H6 :121-129 extends the existing reset, whose implementation deletes attempts and
   study states before incrementing the epoch (functions/foundation.js:2068-2140). An old-epoch writer can commit
   after the sweep and before the final bump. Attempts can later be rejected by epoch, but the five label fields
   carry no epoch (H6 :14-24), so late labels can survive into the fresh pool. Freeze a fence-first reset and a
   post-fence cleanup/reconciliation law.
4. **Compose replay is not request-bound.** A (uid,composeKey) hit is returned without checking class/list/day/
   epoch/testType/visit equality (:43-47). Persist and compare an operation fingerprint; reject a reused key with
   mismatched inputs.
5. **Authoritative presentation coverage is incomplete.** H6 :75 limits presentationId/queueId to review-type
   attempts while R2-41 stamps labels from every graded new/review and live/rerun test. Every stamping source must
   bind to a server-authoritative presented set and server-derived denominator, whether through a presentation
   record or an equally explicit new-test record.
6. **Cached-client fencing is only a vocabulary.** client_version_stale exists (:102-119), but version type/order
   semantics and the choice between forced refresh and adapter are not frozen, and it cannot compensate for the
   direct-write authority above.

## Closure 3 — rules: PARTIAL

The reviewLastTestedAt rename is genuinely inert, the operation split is structurally correct, the live-base
re-derive requirement is explicit, and current repo attempts are already fully server-owned
(firestore.review_v2.rules:6-20,22-54,76-82; firestore.rules:270-320).

Two authority/oracle defects remain:

- The fragment deliberately allows an owner to delete a study_state carrying all five protected labels
  (firestore.review_v2.rules:22-26,46-49), and emulator case 1 requires that delete to pass (:91-95). Server reset
  already bypasses client rules, so owner delete must not erase behavioral truth.
- The grading-job prose says owner read uses studentId (:84-89), while the actual rule and job shape use uid
  (firestore.rules:340-347; functions/index.js:946-962). Case 8 can false-green or test the wrong document shape.

The matrix must deny label erasure, use the real uid field, and prove the activation-time pool-input narrowing.

## Closure 4 — H8: PARTIAL and stage-blocking

### What closed

- The saved 44-row output reproduces byte-for-byte (SHA-256
  3C8586A1A9A22F588C4A00BC843EEB5E2378C71A469044A9E77EFA073C2815EA).
- Walled days reuse the same pinned queue (h8-final-values-resim.mjs:69,81-95,132).
- The per-band accuracy table recomputes exactly from graduation-validity-26SM.json; the smallest cell has n=403.
- Censored/structural reporting, a size-change scenario, and a conservative minimum-queue bound exist.

### Blocking residue

1. **The launch seed is not B1 per-word state.** H8 reads only three overlapping summary marginals (:33-37), not
   the JSONL required by 10_:114-118. Its thresholds at :61-66 make the everCorrect branch unreachable because
   0.857 + 0.094 > 0.939 and incorrectly force overlapping categories to be exclusive. The real JSONL joint mix
   is 83.06% proven/non-priority, 2.62% proven+priority, 6.78% unproven+priority, and 7.54%
   unproven/non-priority-correct; the simulator uses 85.7%, 9.4%, 0%, and 4.9%.
2. **Input failure false-greens.** Missing/malformed B1 silently falls back to constants equal to the sample,
   producing the same scenarios without recording source mode/hash. A stage artifact must fail closed and record
   the baseline digest.
3. **Exposure still omits first-sighting starvation.** Lines 114/142 record a gap only after seen > 0. If a word
   is first seen late and proves on that sighting, :157 omits its initial interval. Timestamp zero is also treated
   as absence through truthiness at :101,114,152,157.
4. **The fairness law is unresolved.** The script admits random remainder provides only a probabilistic guarantee
   (:18-19), while 10_:114-118 and 02_:95 require bounded sighting intervals. Three seeds cannot prove a hard
   bound; size-change and launch-seeded cases use only seed 1 (:176-177).

Q-D1 is therefore load-bearing. Deterministic remainder changes the selector/composition version and tests;
probabilistic service needs an owner-ratified SLO, horizon, tail threshold, and statistical evidence. H8 cannot
freeze before that choice.

## Closures 5-6 — folds and adjudications

Correct folds landed for one advance plus zero graduation/no client graduation on already_completed
(02_TASK_LIST.md:79; H6 :70-83), post-top-up queueSize_effective, and list-end plus nextListId cert
(02_TASK_LIST.md:95).

Contradictions remain:

- 11_REDESIGN_VERIFICATION_AND_FOLD_PLAN.md:66 still says override-then-real-pass gives a single graduation and
  single advance, contradicting the corrected zero-graduation law in the same package.
- R2-10's four deferral conditions are correctly listed at 11_:67, but 10_:5-7 and 02_:95 still imply A2 alone
  activates/confirms it.
- Cycling remains live in 00_ORIENTATION.md:59, 02_TASK_LIST.md:127, and the authorization matrix at 02_:300,
  despite its retirement at 02_:158,171.
- Governing ranges still stop at R2-38/R2-40 in 00_:8 and 02_:91.

The policy adjudications are sound: uniform historical stored-score 92 for eligible attempt types, review-only
clock seeding, and rows as a fence rather than a score substitute (B1 :43,99-115,134-142;
14_TRACK_B_BACKFILL_PIPELINE.md:50-52,62-70). Executable application is partial because type eligibility defaults
fail-open and teacherEdited/preOverride is absent.

Q-D2 blocks the challenge branch: MASTERED-to-PASSED retirement behavior and challenge-label-versus-graduation
ordering are explicitly unresolved at 11_:67. The two C2 layout decisions can ride the owner batch for backend
work, but their affected UI components cannot be called frozen before the choices land.

## Exact stage-1 closure gate

Before implementation authority:

1. Make B1 a strict, fail-closed, atomic, gitignored/local baseline with a server-valid read boundary, complete
   epoch/signature metadata, and explicit teacher-edit semantics; rerun and review the sample.
2. Freeze server authority for every behavioral pool input and protected-label delete, fence reset first, repair
   same-visit/opposite-type pairing, bind compose replay to request identity, and cover every stamping source with
   an authoritative presentation/denominator.
3. Correct the rules uid oracle and run the merged rules matrix with label-delete and pool-forgery denials.
4. Resolve Q-D1 and Q-D2 (or explicitly exclude/disable those branches), rebuild H8 from per-word B1 input with a
   fail-closed source digest and complete exposure accounting, and remove the contradictory fold residue.

## What I verified

- Validated baton revision 180 and the matching round-54 ready marker/handoff.
- Read the governing plans, Track A findings, H6, rules fragment, actual rules/source writers, B1/B2, and H8.
- Ran node syntax checks on B1, B2, and H8.
- Reran H8; the generated artifact hash was unchanged.
- Independently recomputed all H8 accuracy cells and the B1 JSONL joint/epoch counts.
- Reconciled the three requested independent closure lanes. No Firebase operation and no Playwright audit ran.

## Baton update

Review complete. Hand back with codexDecision DONE; this means the round-54 review is finished, not that stage 1
or the B1 full read is authorized.
