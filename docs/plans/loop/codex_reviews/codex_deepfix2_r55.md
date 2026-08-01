# Codex round 55 — stage-1 freeze verification

**Reviewed:** 2026-08-01  
**Round disposition:** **DONE**  
**Stage-1 implementation-authority disposition:** **NOT READY — NEEDS FIXES**  
**B1 full-baseline disposition:** **NO-GO**

## Ruling

Round 55 contains real closures, but the freeze claim does not survive independent execution and cross-file
reconciliation. The saved H8 artifact has an advancing launch-seeded run whose measured exposure is 48 against
the asserted hard bound of 40. B1 still has no durable boundary for in-place challenge mutations and cannot
implement the newly ratified resting-challenge law. The new server resting field is not in the Track-B expected
baseline or B3 write contract. H6 also retains reset, restudy, presentation, and bootstrap authority gaps.

The owner decisions R2-42..45 are acknowledged. R2-42 and R2-43 are not executable/contradiction-free in the
current fold, so the full DF2-14 dark build is not authorized.

## Closure verdicts

| Item | Verdict | Ruling |
|---|---|---|
| B1 v3 / full safety | **MISS / NO-GO** | Static fences improved, but mutable challenge events defeat the watermark and R2-43 replay. |
| B2 v2 | **CLOSED WITH CAVEAT** | Version/caps/cadence/tombstones are real; future capped cadence remains unordered. |
| H6 schemas | **PARTIAL** | Six-field authority direction is better; reset, restudy, presentation, completion, and bootstrap remain incomplete. |
| Rules artifact | **MOSTLY CLOSED** | Six-field create/update/delete denial and uid oracle are fixed; authoritative monitoring is not. |
| H8 v3 | **REJECTED AS FREEZE EVIDENCE** | Reproducible, but launch state is synthetic and one advancing run violates the claimed bound. |
| R2-42 | **MISS** | Deterministic remainder does not bound service under priority saturation; invariant/fallback are underspecified. |
| R2-43 | **PARTIAL** | Forward guard is clear; historical replay and concurrency condition (iii)/(iv) remain open. |
| R2-44 | **PARTIAL** | Core cards say English-only; orientation/source/architecture text still mandates bilingual UI. |
| R2-45 | **CLOSED IN POLICY; FOLD CLEANUP** | Later-row decision is clear; the older hover/long-press wording remains unstated as superseded. |
| Range/cycling fold | **PARTIAL** | Functional cycling disposition improved; governing ranges and one status row remain stale. |

## B1/B2 — full remains a no-go

### What genuinely closed

- Unknown flags and false full values fail; bare full and full=true select full mode.
- Timestamp shape, session-type whitelist, answers-array, score/total, duplicate-row, teacher-edit, and
  totalQuestions/order-independent duplicate-content checks are present
  (scripts/deepfix2/b1-expected-labels.mjs:42-51,114-151).
- UID-bearing output is under the ignored audit/deepfix/trackB_baselines directory
  (.gitignore:86-87).
- The saved sample is internally consistent: 50 JSONL rows, 30,180 words, matching per-student digests, and the
  advertised 83.06/2.62/6.78/7.54 joint mix.
- B2 reports version 2, one merged caps object, real tombstones, and a cadence histogram
  (b2-database-investigation.mjs:90-96,131-140). This sample stayed below its cap.

### Blocking findings

1. **submittedAt is not a mutation watermark.** B1 takes workstation Date.now and filters only each attempt's
   submittedAt (:68,108,114-117). Accepted challenges update answers/score/passed in place without changing
   submittedAt (src/services/db.js:2900-2947; functions/foundation.js:2592-2627). A challenge after a student's
   read is missed by a submittedAt delta; a challenge after the nominal watermark but before the read can leak
   into the baseline. Date.now is also not a Firestore-issued consistent read boundary.
2. **Accepted adjudications replay at the wrong event/time.** B1 reduces rows to wordId/isCorrect and replays
   them at original submission time (:138-178), discarding challengeStatus and challengeReviewedAt. It therefore
   rewrites factual ordering and cannot apply R2-43's resting-at-acceptance skip. R2-10 condition (iv) is still
   open. If historical resting-at-accept cannot be reconstructed, the plan must define and count a conservative
   exclusion rather than silently mint labels.
3. **The launch now has six server fields, but Track B still has five.** H6 adds behavioral
   reviewRestingUntil and assigns its seed to B3 (15_H6_SCHEMAS_AND_CONTRACTS.md:14-25,156-164), while B1 emits
   only fc/lf/lc/lp/rlt and 14_TRACK_B_BACKFILL_PIPELINE.md:74-77 still freezes a five-field B3 write set. B4
   cannot expected-vs-actual verify the authority field that decides active/resting/underflow.
4. **Per-signature publication is not implemented.** exclusionSignatures is a first-500 row list, not counts,
   and most fence failures carry sig:null because the signature is built later (:76-82,114-147). This does not
   satisfy 14_:53-58.
5. **The artifact set is not atomic.** Only JSONL gets tmp+rename. Summary and pointer are direct subsequent
   writes with no run ID, completion manifest, JSONL hash, or atomic publish (:84-88,204-230). The local summary
   says version 2 while the pointer says version 3 (:214,227).
6. **Operational strictness remains incomplete.** parseInt accepts limit=1.5 and limit=01junk; an empty cohort
   value falls back to 26SM; full mode has no expected-cohort confirmation. Stream errors/backpressure are
   ignored and the output directory is assumed to exist. Eligibility also lacks the promised graded=true fence
   or a named synthetic-anchor exception to it.

B2's cadence is honest for this sample because no student reached ATT_CAP=300. Its query is unordered before
limit (b2:57), so it must order by submittedAt or qualify the metric before a capped run.

## H6 and rules — partial

### What genuinely closed

- All six server fields are guarded on create/update/delete, including label erasure
  (audit/deepfix/task3/firestore.review_v2.rules:29-54).
- The grading-job rule oracle now uses the real uid field (:89-94).
- All-four presentation intent, compose-key comparison, integer min-version direction, server-only resting truth,
  and the forward R2-43 policy are explicitly present (H6 :43-67,114-131,156-164).

### Blocking findings

1. **Fence-first reset opens a new-epoch race.** H6 :144-151 bumps epoch and then performs broad deletes. A valid
   new-epoch compose/submit can start after the bump and be deleted by the cleanup. Freeze an atomic
   epoch+frontier reset plus resetInProgress; all new operations reject while cleanup runs; delete stale epochs,
   reconcile, then release.
2. **Restudy state is not keyed per visit.** One replaceable pendingHalf loses valid overlapping/out-of-order
   visits, and consumedAttemptIds grows without bound while R2-45 permits an unbounded total (:105-112). Use
   per-visit claim/completion docs or another bounded idempotency design.
3. **Presentation identity is incomplete.** Live-new n-sequence has no counter/allocator. The fingerprint uses
   testType without separately freezing modality, session phase, and live/rerun kind, although current code uses
   testType for mcq/typed and sessionType for new/review. Hashes based on join(',') also need canonical
   delimiter-safe serialization (H6 :41,45-64).
4. **Pool bootstrap trusts client state.** reviewRestingUntil is seeded from legacy client-writable masteredAt
   (:21,158-164). A pre-cutover forgery becomes server truth unless the seed is validated against eligible
   history or explicitly adjudicated. The LRT wordIndex tie-break must likewise come from canonical list word
   position, not the client-written study-state copy.
5. **Completion audit lacks an evidence-kind matrix.** consumedAttemptId null is defined only as OFF auto-pass,
   and newTestAttemptId null only as list-end (:69-81); other legitimate no-evidence/first-day shapes are not
   dispositioned. anchor/generation is also absent even though cross-class validity depends on it.
6. **Min-version needs an exact rejection predicate.** Missing/malformed old-bundle values must satisfy
   !Number.isSafeInteger(v) or v < min => client_version_stale. A naïve undefined < min is false
   (H6 :123-129).
7. **Current grading-job ownership is still fail-open in code.** functions/index.js:935-938 and :1566-1569
   reject only when job.uid is truthy and different; missing-uid jobs pass. The build contract must require exact
   job.uid === caller uid and quarantine legacy malformed rows.
8. **Fallback telemetry is forgeable.** R2-42 treats composition_fallback as a monitoring/abort signal, but
   firestore.rules:334-337 permits any authenticated client to create system_logs. Use a server-only event/metric
   sink. The existing collection cannot be an authority signal.

The rules fragment also contains stale prose saying owner delete is acceptable before showing the corrected
delete guard (:23-27), and its broad system_config wildcard should be narrowed to the literal review_v2 document.

## H8 / R2-42 — rejected as freeze evidence

The script reruns byte-identically. Its output has 60 scenarios, the saved B1 summary digest matches, all special
scenarios use seeds 1/2/3, and first-sighting/null checks improved.

The result nevertheless disproves the freeze claim:

- h8-resim-results.json contains b70_85, reruns=2, seed=1, launchSeeded=true with daysAdvanced=120,
  max exposure=48, bound=40, and holds=false. The script admits this at
  h8-final-values-resim.mjs:200-201.
- R2-15 permits priority to consume all 30 test slots. Deterministic selection of the remainder provides no
  service bound when no remainder slot exists. Monitoring a 48-day transition does not make the required hard
  bound true.
- R2-42's invariant says exactly testSize unique words and priority words included
  (11_REDESIGN_VERIFICATION_AND_FOLD_PLAN.md:37). That is impossible when priorityCount > testSize and also
  conflicts with small-pool shrinkage. Define effectiveTestSize and the required top-priority subset.
- Seeded-random fallback is not simulated and has no hard bound. The invariant/fallback must preserve required
  priority selection and record a reproducible seed, or the fairness contract must explicitly exclude it.
- Launch input is aggregate jointMix from the 50-student sample, not B1 per-word state
  (h8 :33-41,57-73). It discards real clocks/order/correlations, applies one cohort mix to every ability band,
  gives every seeded label the same rlt, and omits the untouched word mass outside eligible attempts. That is not
  the per-word launch state required by 10_:128.
- Claimed fail-closed input validation only checks that proven_correct is present (:38-40). Missing/NaN/negative
  remaining components, a bad sum, or wrong mode/version/cohort can still run.

Closure requires either a policy that reserves/bounds non-priority service under priority saturation or an
owner-ratified bounded exception/SLO; a precise effective-size invariant and fallback law; then a rerun from a
validated per-word/recency launch-state extract with zero advancing oracle failures.

## R2-43..45 and fold consistency

- **R2-43 is partial.** The forward resting guard is faithful at 10_:31-36 and H6 :114-119. B1 does not replay
  accepted adjudications or resting-at-acceptance, and the planned cert needs both challenge/graduation orderings
  plus reset interleavings. Current challenge code is explicitly multi-step, not evidence for the future txn.
- **R2-44 is partial.** 10_:84-85 and DF2-11/14/32 carry English-only. 00_ORIENTATION.md:27,
  01_SOURCES.md:91, and UNIFIED_SESSION_STATE_ARCHITECTURE.md:548 still require bilingual new UI; the named
  06_MESSAGING_COPY.md does not exist.
- **R2-45 is policy-closed.** The later ledger row and DF2-14 card carry five pips plus static ×N. R2-40's older
  hover/long-press wording at 11_:35 should be struck or marked superseded.
- **R2-10/ranges remain stale.** 11_:7,16,64 still describe A2-only/confirm-pending deferral; condition (iv) is
  genuinely open. 00_:8,90,108, 10_:3, 12_:4, and multiple 02_ summary/citation rows still stop at R2-41 rather
  than R2-45. 10_:68 still says random remainder. 00_:42 still lists D7/P9 cycling as not started despite its
  retirement.

## Exact stage-1 closure gate

1. Replace the mutable-attempt boundary with an event/update-aware, server-issued baseline boundary; replay
   challenge events at their adjudication timestamps under R2-43; add reviewRestingUntil to expected-state/B3
   equality; publish a single atomic, hashed run manifest.
2. Repair reset with a reset lock, key restudy claims per visit, complete presentation/fingerprint/evidence
   schemas, validate resting/tie-break bootstrap authority, and move fallback telemetry to a server-only sink.
3. Reconcile R2-15 with R2-42 so the promised bound is actually true, correct the invariant/fallback, ingest
   validated per-word launch state, and rerun H8 with zero advancing failures.
4. Finish R2-43/44/45 and R2-1..45 ecosystem folds.

## What I verified

- Validated baton revision 182 and the round-55 marker/handoff.
- Read B1/B2, local baseline/pointer, H6, rules fragment, current rules/callers, H8, and governing folds.
- Ran node syntax checks on B1, B2, and H8.
- Reran H8; SHA-256 remained
  107B3D9BC1280424CC6646629F9027DAB2A3B003B6D0D65B237BEE6DF6E369EF.
- Independently checked the B1 source digest and the 60-scenario fairness failures.
- Reconciled all three requested read-only review lanes. No Firebase operation, B1 full run, or Playwright audit
  was performed.

## Baton update

Review complete. Hand back with codexDecision DONE; this means the round-55 review is finished, not that stage 1
or the B1 full read is authorized.
