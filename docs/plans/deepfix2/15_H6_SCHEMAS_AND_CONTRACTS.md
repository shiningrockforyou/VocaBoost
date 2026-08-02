# DEEPFIX2 — H6 pre-implementation schemas (15_, v1 2026-08-01 — checkpoint-1 freeze target)

> The r49-H6 deliverable owned by DF2-14: doc locations, creation/claim transactions, immutable-field lists,
> hash format, retry responses, retention/reset cleanup — plus the R2-38..41 and Track-A additions (streak,
> pips, bookmark, `teacherEdited`, `reviewGateEnabled`). Laws cited from the ledger (11_ §1). **v2 — the r53
> correction fold: completion/CAS record added (§3b) · presentation composeKey replay + rerun identity ·
> gate-posture stamp on every attempt · minClientVersion negotiation · restudy pairing state · reset-reach
> fields · THE CLOCK FIELD RENAMED `reviewLastTestedAt` (r53-B3: legacy `lastTestedAt` is client-written today —
> the server rotation clock is a NEW field, born server-only; legacy field untouched until DF2-46) · pool-input
> authority disposition (§10).** Frozen at the checkpoint-1 closure; later changes require a logged supersession.

## 1. `users/{uid}/study_states/{wordId}` — label fields (extends the existing doc; no new doc)

| field | type | writer | law |
|---|---|---|---|
| `reviewFailCount` | int ≥0 | SERVER (attempt txn + backfill) | +1 per wrong-or-blank presented word, ANY graded test (R2-17/41); reset-epoch-scoped. **COMPLETE-ROWS LAW [r64]: the post-flip attempt writer records ONE answers row per PRESENTED word — a blank is an explicit `{wordId, isCorrect:false, blank:true}` row, never an absent row — so replay-through-cutoff (the final B4's fc verification) is exact without consulting presentation records; pre-flip attempts keep the published blank-undercount posture** |
| `reviewLastFailedAt` | Timestamp | SERVER | any graded test (R2-41) |
| `reviewLastCorrectAt` | Timestamp | SERVER | any correct answer, any graded test — clears PRIORITY (R2-29/41) |
| `reviewLastProvenAt` | Timestamp | SERVER | correct on a PASSING test (any type, R2-41b); accepted challenge per R2-10 once A2-activated |
| `reviewLastTestedAt` | Timestamp | SERVER | THE rotation clock [r53-B3 rename — legacy `lastTestedAt` stays client-written until DF2-46 and is NEVER read by the redesign]: advanced by review-TYPE tests incl. reruns (R2-41d); backfill-seeded from review-type history, null ⇒ NOT WRITTEN (unseeded words tie-break by wordIndex — **from the CANONICAL list word order (`lists/{id}/words`), never the client-written study-state copy [r55]**) per B1-Q2/r53 |
| `reviewRestingUntil` | Timestamp | SERVER | **THE SERVER RESTING TRUTH — LIVE-ONLY [r59-A9 FINAL LAW: the backfill NEVER writes it; no seed, no operator flag — the masteredAt-laundering surface is DEAD]. Born at the first server graduations (set = completedAt+21d in the graduation txn; day_completions.graduatedWordIds is the audit twin); ignored past its instant. LAUNCH TRANSIENT (accepted, David-veto flagged): words resting under legacy `masteredAt` at the flip simply re-enter rotation — a benign one-time reappearance. The redesign's pool/underflow derivation reads ONLY server fields — NEVER client-writable `status`/`masteredAt`** |

Rules: client writes to these SIX fields DENIED field-level — ALL SIX ARE NEW FIELDS, so the lock is truly
inert pre-launch [r53-B3] (owner keeps writing the rest of the doc, including legacy `lastTestedAt`);
owner DELETE of a doc carrying any of the six is DENIED (label erasure, r54);
derived predicates (`needsPriority`, `fillEligible`) are computed, never stored.

## 2. `users/{uid}/review_queues/{queueId}` — the immutable DAY-QUEUE record (NEW, server-only)

- **docId** = `{classId}_{listId}_d{logicalDay}_e{resetEpoch}` (one per identity; deterministic ⇒ idempotent create).
- Fields: the identity septuple `{uid, classId, listId, logicalDay, resetEpoch, algorithmVersion, configVersion}`
  + `anchorNwei` + `generation` (the cross-class match tuple, r48/r50-B3 — **[SUPERSESSION r70-C2]: sourced
  from PROGRESS TRUTH, stable within a day: `anchorNwei = twi − 1` (−1 IFF twi=0, the day-1/empty-universe
  encoding) and `generation = "t{twi}"`; a reuse-path mismatch is the typed refusal `reuse_anchor_mismatch`,
  never an abort**) + `orderedQueueWordIds[]` + `poolHash`
  + `snapshot{threshold, queueSize, testSize, reviewTestType, reviewGateEnabled, configQueueSize}` +
  `createdAt` — **[SUPERSESSION r70-C2, replacing the r62 reuse-only wording]: `snapshot.queueSize` =
  |orderedQueueWordIds| (CONTENT truth) on EVERY compose — first compose AND reuse — and
  `configQueueSize` (this class's own configured value, audit-only) is ALWAYS present.**
- **Creation txn**: composed server-side inside the session-start/test-compose callable — txn reads pool state
  **+ the ROTATION CURSOR DOC (§2b — NOT the previous queue record: last-element inference breaks under
  underflow top-ups, and class-scoped chains break dual-enrollment [r58])**, applies the sweep + the R2-41(e)
  underflow top-up (earliest-graduated resting words), `create()`s the doc **and advances the cursor doc IN
  THE SAME TXN (cursor := per §2b's EXACT TRANSITIONS — the LAST ACTIVE-sweep element in TRAVERSAL order, NOT the numeric max [r62: §2b is THE one cursor law; this paragraph defers to it]; top-ups never move it)**
  (fails on exists ⇒ read existing — first writer wins, replays converge). The queue doc also carries
  `presentationCount` — the ONE mutable counter field, incremented only inside the presentation-compose txn
  (the sole exception to queue immutability; every other field frozen) [r53-B2].
- **Immutable**: every field after create EXCEPT `presentationCount` (the one counter, above). Mid-day teacher
  edits affect the NEXT day's queue (snapshot law).
- `poolHash` = SHA-256 over `JSON.stringify(orderedQueueWordIds)` (hex, full) [r55 — delimiter-safe canonical
  serialization; same rule for `presentationHash` and the introduced-range hash] — drift detection for audits.
- **[SUPERSESSION r74-N-1]: ENGINE `twi` IS AN ORDINAL COUNT over the canonical word order** — the review
  universe = the FIRST twi canonical words; the live-new range = the NEXT `dailyPace` after them. Identical
  to the positional reading on gap-free lists; on gapped lists (historical deletions) the engine stays
  correct and every canonical load emits the `positionGap` ops warning (17_ §5). The legacy anchor
  reconciliation (`twi = nwei + 1`, CS runbook) remains positional — exact on contiguous lists only.

## 2b. `users/{uid}/review_cursors/{listId}_e{resetEpoch}` — THE ROTATION CURSOR (NEW, server-only) [r58]

`{uid, listId, resetEpoch, cursorWordIndex|null, lastLogicalDay, lastQueueRef, updatedAt}` — ONE per
(student, list, epoch), SHARED across classes. **SAME-DAY CROSS-CLASS LAW [r59-B2 — without it two classes
composing one shared logical day each advance the sweep]: the compose txn reads the cursor doc; if
`lastLogicalDay === the composing logicalDay`, the txn REUSES `lastQueueRef`'s `orderedQueueWordIds` VERBATIM for the
new class's queue doc — **even when the two assignments' queueSize DIFFERS [r60]: the shared day's CONTENT is
first-composer-wins (day-truth); the receiving class's OWN snapshot governs threshold/testSize, and its test =
effectiveTestSize = min(its testSize, |the reused queue|); the receiving queue doc's `snapshot.queueSize` records |the REUSED queue| — snapshot describes the CONTENT that actually generated the day [r62 — a 60-first/30-second race must never mint a 30-labeled 60-member queue]; the receiving class's own configured value lands in `snapshot.configQueueSize` (audit-only). CERT: differing-size reuse fixtures, BOTH orders** — and DOES NOT advance the cursor — one logical day consumes exactly ONE sweep segment; content is class-independent, posture is
class-scoped. Only a compose with `logicalDay > lastLogicalDay` advances.** Advanced ONLY inside the queue-compose txn. **EXACT TRANSITIONS [r59-B3 — code, not prose]: let A = the
day's ACTIVE-sweep members in traversal order (top-ups excluded). (normal) cursor := index of the LAST element
of A in TRAVERSAL order (on a wrapped window this is the last traversed, NOT the numeric max); (underflow,
A non-empty) same rule over A; (no active at all) cursor UNCHANGED; (first-ever / post-reset / absent doc)
sweep starts at the smallest index and the doc is created; (OFF→ON) the doc persists — the sweep resumes where
it left; (same logical day) NO advance (the reuse law above).** Epoch-scoped (reset deletes it). Client writes
DENIED (rules list).

## 3. `users/{uid}/review_presentations/{presentationId}` — the PER-ATTEMPT presentation record (NEW, server-only)

- **docId** = `{queueId}_p{seq}` (seq = the queue doc's `presentationCount`+1, assigned in the compose txn).
- **REPLAY KEY [r53-B2 + r54 + r57 registry fix]: `composeKey`** — a client-minted idempotency token; global
  uniqueness is serialized by a CLAIM REGISTRY: the compose txn `create()`s
  `users/{uid}/compose_keys/{SHA-256(composeKey) hex}` `{composeKeyCanonical, presentationId, fingerprint,
  createdAt, resetEpoch}` — **the docId is the HASH [r59-B6: raw client tokens are path-unsafe/unbounded; the
  canonical original is stored for comparison; token validation: 8-128 chars, [A-Za-z0-9._-]]** — the create
  is the lock (a concurrent duplicate fails the txn and re-reads) [the bare (uid,composeKey) query raced
  across identities]. On an existing claim the txn COMPARES the stored request fingerprint `{classId, listId, logicalDay, resetEpoch, sessionType(new|review),
  testType(mcq|typed), kind(live|rerun), visitId|null}` [r55 — modality, phase, and kind each frozen
  separately] against the request:
  MATCH ⇒ return the existing presentation (lost-response replay); MISMATCH ⇒ typed refusal
  `compose_key_reused` (a reused key never silently serves a different test). A NEW retake sends a NEW composeKey.
- Fields: `{uid, classId, listId, logicalDay, resetEpoch, composeKey,
  requestFingerprint{sessionType, testType, kind, visitId|null} [STORED — the replay comparison operates on
  persisted truth, r56], fallbackSeed|null [set when compositionVersion='fallback-random', r56],
  queueRef|null, poolHash, presentedWordIds[], compositionVersion, testType, visitId|null,
  serverClaim{claimedAt, attemptDocId|null}, createdAt}` + `presentationHash` (SHA-256 over
  `JSON.stringify(presentedWordIds)` — the canonical serialization, same as poolHash [r56: join(',') retired]).
  (uid/classId/listId denormalized for reset reach + queries [panel].)
- One per composed test — **EVERY GRADED TEST TYPE [r54]: live review, rerun review, live NEW-WORD, rerun
  new-word** (R2-41 stamps labels from all four, so all four need a server-authoritative presented set +
  server-derived denominator). New-word presentations: `compositionVersion:'new-day'`, `queueRef:null`,
  `presentedWordIds` = the day's anchor range draw, docId `{classId}_{listId}_d{day}_e{epoch}_n{seq}` — **seq from `users/{uid}/review_counters/{familyId}` — the FROZEN allocator schema [r57]: docId `familyId` =
  the presentation-family identity string (`{classId}_{listId}_d{day}_e{epoch}_n` for new-day; `..._r` for
  rerun); fields `{uid, classId, listId, logicalDay, resetEpoch, next:int}`; CREATED with `next:1` on first
  use INSIDE the compose txn, else read+increment IN the txn (transactional read-modify-write — no
  ALREADY_EXISTS path, no count query [the count-query instruction is RETIRED everywhere]); the allocated seq
  = the pre-increment value. **Worked first-use [r59-B4]: request 1 finds no doc ⇒ txn creates `{next:2}` and
  allocates seq 1; request 2 reads `{next:2}` ⇒ writes `{next:3}`, allocates 2; a txn retry re-reads and
  cannot double-allocate.** `_p{seq}` keeps the queue doc's own `presentationCount`.**
  Every retake composes a NEW presentation under R2-15 rotation (r50-B3).
- **`compositionVersion` enum [r55 — its own clause]: `'lrt-v1'` (the R2-42/46 deterministic law — live review)
  · `'fallback-random'` (invariant-check fallback; remainder only; seed recorded) · `'rerun-random'` (R2-41h)
  · `'new-day'` (live new-word).**
- **RERUN identity [r53-B2/panel]**: restudied days have no live queue — rerun presentations use docId
  `{classId}_{listId}_d{visitedDay}_e{resetEpoch}_r{seq}` with `queueRef:null`, `poolHash` = the
  INTRODUCED-RANGE hash **[ADJUDICATED r70 — BOTH review lanes, from R2-41(h)/trace row 71: the range is
  the FULL CURRENTLY-INTRODUCED range (canonical positions < twi, resting included), sliced by the claim
  txn's own progress read — never day-scoped through the visited day]**, `compositionVersion:'rerun-random'`
  (pure-random, no priority slots), `visitId` set
  (§6 pairing — **[r70-C4] the claim txn READS the visit doc and refuses `visit_invalid` on a
  missing/mismatched tuple; the submit txn re-verifies**), **seq from the SAME counter-doc allocator as
  `_n{seq}` (§3's frozen schema — NO count query
  anywhere [r59-B4])**. A rerun presentation binds `logicalDay` = the VISITED day (display/pairing) — never
  the frontier.
- The submission names its `presentationId`; the server validates the submitted set against THIS record
  (compose-to-submit drift rule) and derives `totalQuestions` from it. Immutable after create;
  `serverClaim.attemptDocId` is the ONE post-create merge (set once, in the attempt txn).

## 3b. `users/{uid}/day_completions/{listId}_d{logicalDay}_e{resetEpoch}` — the EXACTLY-ONCE completion record (NEW, server-only) [r53-B2]

- **docId is CLASS-AGNOSTIC** — it IS the shared logical day (R2-36/38: one advance + one graduation per
  logical day across classes). The completion txn `create()`s it: the winner creates; a concurrent loser's
  create fails ⇒ server returns `already_completed` (the CAS).
- Fields: `{uid, listId, logicalDay, resetEpoch, anchorNwei, generation [r55 — the cross-class validity tuple
  lives on the completion too], winningClassId, evidenceKind, consumedAttemptId|null, consumedAttemptClassId|null,
  sourceConfig{threshold, queueSize, testSize, configVersion, reviewGateEnabled, gateEffectiveEnabled},
  // PROVENANCE [r62p]: sourceConfig = the SOURCE class's CONFIGURED values (its posture authority for the
  // R2-38 cross-class evidence record); queue CONTENT truth lives on the queueRef's snapshot — on a same-day
  // reuse these can differ by design (first-composer-wins content, class-scoped posture).
  newTestAttemptId|null (null iff a ZERO-new-words day — the R2-39 law),
  **[r74-N-11 additions]: `wordsIntroduced` (engine: |the new presentation's presented set|; legacy: the
  attempt's range count; range-less legacy ⇒ 0 + `twiHeld:true`) · `completedTwi` (the winner's
  post-advance twi — THE absolute value the R2-51 view catch-up copies; legacy records without it fall
  back to the relative derive, clamped) · `postureSource` (attempt | completion_legacy |
  completion_autopass) · `legacyEvidence` (the published flip-week boundary flag)**,
  graduationCount, graduatedWordIds[]
  (bounded ≤ queue size — the SERVER resting-truth input, see §10), graduatedWordIdsHash =
  **SHA-256(JSON.stringify(graduatedWordIds)) [the frozen formula, r57]**, completedAt}` —
  **BINDINGS [r57]: `consumedAttemptClassId` is null IFF `consumedAttemptId` is null; every `gate_off_*` kind
  requires `sourceConfig.gateEffectiveEnabled === false`; `fallbackSeed` is REQUIRED iff
  `compositionVersion === 'fallback-random'` (else null)** — **`evidenceKind` [r55/r56 matrix — decided by (newTest null?, consumed null?, gate posture, day)]:
  `standard` (neither null) · `gate_off_autopass` (consumed null, newTest present, gate OFF) ·
  `list_end_review_only` (newTest null, consumed present) · `gate_off_list_end` (BOTH null, gate OFF,
  day > 1 — the legitimate OFF×zero-new-words day [r56: previously walled by refusal]) · `first_day_new_only`
  (consumed null, day == 1, gate ON — Day 1 has no review). REFUSED: both-null with gate ON on day > 1
  (impossible under the both-tests law), and any shape not enumerated above** — the cross-class evidence audit
  (contract (2): "audit records the consumed attempt + source config") lives HERE; resetEpoch binding for
  completions (contract (6)) lives HERE.
- Immutable after create. Streak credit (§6) writes in the SAME txn. Client graduation dies (DF2-10(8) moves
  graduation into this txn); a client receiving `already_completed` re-runs NOTHING [A2/r53].
  **[RATIFIED — R2-51, David 2026-08-03: "progress should be intrinsic to students only and should not
  have any class-specific components" — the catch-up is that principle applied to the pre-P5 per-class
  storage; full unification lands at P5. Also ruled same session: the RESET_V2 flip = the sandbox-
  rehearsal phase, "whenever is convenient, not a big deal."]: THE DUAL-CLASS VIEW CATCH-UP — pre-P5 the durable progress doc is
  class-scoped, so when the shared day is ALREADY completed and the calling class's view sits exactly one
  day behind (csd === day−1), the loser txn syncs that class's csd/twi view (NO graduation, NO rest, NO
  streak — the shared day advanced ONCE; this is the r48 "a valid cross-class pass satisfies the shared
  logical day" made real for the second class). Response carries `viewAdvanced:true`.**

## 4. Attempt-doc additions (existing `attempts/{attemptId}`)

- `presentationId` + `queueId|null` (review-type attempts) · `resetEpoch` (ALL new attempts — B2 found it
  absent historically; stamped going forward) · **`gatePosture{effectiveEnabled, threshold, configVersion,
  source}` on EVERY attempt of EVERY type [r53-B2/panel — contract (7)'s attempt-time stamp; new-word attempts
  have no queue pointer, so the stamp cannot be derived and must be stored]** · `visitId` on rerun attempts
  (§6 pairing) · `type:'retest'` for reruns (non-advancing; gradebook toggle filters on it AT QUERY LAYER [C2])
  · force-pass adds `teacherEdited:true, teacherEditedBy, teacherEditedAt, preOverride{score,passed}` (A1 —
  never `manualOverride`). **Force-pass display law [A1/r53]: the gradebook renders the stored (overridden)
  grade + the `teacherEdited` label; `preOverride` preserves the organic score for audit; row facts are NEVER
  rewritten; an override mints NO proof and NO graduation (one advance + ZERO graduation).**

## 5. `grading_jobs/{jobId}` (existing, server-owned) — answers-on-the-job additions

`rows[]` (submitted answers) + full `writeContext` **(incl. the `gatePosture` stamp [r53-B2] — the async
grade+write leg completes under the attempt-time posture)** + queryable `classId/listId/dayNumber` + `lastError` +
`resetEpoch` + `expiresAt` (server-authored, +12h logical; checked transactionally at every pickup — expiry ⇒
transactional mark + redact `rows`; native TTL on `expiresAt` = async physical backstop) + `aiCallCount`
(per-job meter increments; the per-student + global counters live in §6). Claim/write txns per DF2-12's card.

## 6. Metering + streak + restudy docs (NEW, all server-only writes)

| doc | shape | law |
|---|---|---|
| `ai_metering/{uid}` + `ai_metering/_global` | `{count, windowStart}` per period | R2-20: incremented in the grading-job claim txn; the future global-limit gate reads it |
| `users/{uid}/streak_credits/{kstDate}` | `{classId, listId, dayNumber, resetEpoch, createdAt}` | R2-21/r51-H1: docId = KST date ⇒ ≤1 credit/date idempotent by construction; written in the day-advance txn; weekday-gap/weekend law computed at read |
| `users/{uid}/restudy_visits/{visitId}` + the counter on `restudy_completions/{classId}_{listId}_d{day}` `{uid, classId, listId, day, resetEpoch, count, lastAt}` | R2-40c-ii — PER-VISIT CLAIM DOCS [r55 — replaces the single replaceable pendingHalf, which lost overlapping/out-of-order visits and grew an unbounded consumed list]: `visitId` = server-minted per restudy-day entry (stamped on that visit's rerun presentations + attempts); the visit doc `{uid, classId, listId, day, resetEpoch, createdAt, newHalfAttemptId|null, reviewHalfAttemptId|null, completed:false}` [epoch-tagged + timestamped for reset reach and TTL cleanup, r56] — a passing rerun attempt writes ITS half onto ITS OWN visit doc (idempotent: the field is set-once; a second same-type pass in the visit is ignored); when BOTH halves are set, the SAME txn flips `completed:true` and increments the day's `count` (exactly once — the flip is the CAS). Cross-visit pairing impossible by construction; each attempt bound to one visit by its stamped visitId; bounded
state per visit. **Lifecycle [r56]: visits are epoch-tagged (reset-reachable) and incomplete visits are inert
garbage at worst — physically TTL-cleaned via `createdAt` (async), never load-bearing.** Display-only — no progression reader |
| restudy bookmark | **field on `users/{uid}`**: `restudyBookmarks.{classId}_{listId} = day` | R2-40e: OWNER-writable UI pref (same class as the persisted Dashboard focus); never server authority |

## 6b. Challenge-acceptance guard [R2-43]

The challenge-accept txn re-reads `reviewRestingUntil` INSIDE the txn: resting ⇒ grade/score/answers fix ONLY
(no status write; the R2-10 label stamp, once active, is likewise skipped on resting words); not resting ⇒ the
full accept path. **THE ADJUDICATION LAW [r65 — Codex r64 A2's reproduced false-green]: grading history is immutable IN THE PREIMAGE [r67 — reconciled with the (1) duty below: the writer copies
`gradedIsCorrect` BEFORE flipping `isCorrect`, so the flip is display truth and the preimage is replay
truth]; acceptance sets
`challengeStatus:"accepted"` (+`challengeReviewedAt`) and consumers derive effective-correct =
`isCorrect ∨ accepted`. Label semantics: `reviewFailCount`/`reviewLastFailedAt` replay from GRADING-TIME
truth (the historical fail stands — fails are history, R2-41 spirit); `reviewLastCorrectAt`/
`reviewLastProvenAt` follow EFFECTIVE truth (acceptance mints correctness, and proof on a passing test).
The challenge-status enum is CLOSED: pending | accepted | rejected — rejected/unknown values change
NOTHING anywhere (unknown strings are counted `challengeStatusUnknownEnum` and treated as rejected; B4's
final gate has NO whole-word adjudication exemption). **THE GRADING-PREIMAGE SCHEMA [r66 — Codex r65 A1:
today's PRODUCTION accept writers mutate `isCorrect` in place (foundation.js:2600 / db.js:2912), so
grading truth must be PRESERVED going forward and RECONSTRUCTED backward]: (1) the dark-build accept
writer copies the pre-accept value into `gradedIsCorrect` BEFORE flipping `isCorrect` (append-only
adjudication truth; the replay lib prefers it whenever present); (2) LEGACY accepted rows (no preimage) —
[RATIFIED — R2-49, David 2026-08-02]: reconstructed as GRADED-WRONG (an accept flipped it, so the pre-accept
grade was wrong in ~all cases; the rare already-correct-challenged row over-counts fc by 1) with a
PUBLISHED census (`legacyAcceptedReconstructed`); (3) acceptance applies AS-OF the replay boundary
(`challengeReviewedAt < watermark`; missing timestamps counted + not effective); (4) the MINT time for
lc/lp on an accepted row = `challengeReviewedAt` (matching the live txn), never the attempt time; (5)
duplicate-attempt identity binds the adjudication facts (status + reviewedAt in the content hash); (6) the
eligibility fence compares the stored score against EFFECTIVE-correct rows (the accept writers recompute
the stored score from flipped rows — like must compare with like).** Ordering with graduation is transactional by construction (both read/write inside their own
txns against server truth — R2-10 condition (iii)).

## 6c. `ops_metrics/{metricId}` — the server-only operational sink [r55]

`composition_fallback`, priority-saturation days, reset reconciliation counts, and every other MONITORING/ABORT
signal write HERE (Admin SDK only; client write DENIED; teacher read) — **never to `system_logs`, which any
authenticated client may create (firestore.rules:334-337) and which therefore can never be an authority signal.**

## 6d. Grading-job ownership + quarantine contract [r55/r57 — executable]

The claim/pickup path requires **exact `job.uid === caller.uid` with `typeof job.uid === 'string' &&
job.uid.length > 0`** — anything else is MALFORMED. THE QUARANTINE CONTRACT: (predicate) uid
missing/non-string/empty, or writeContext absent where status requires it; (transition) the claiming txn sets
`{status:'quarantined', quarantineReason, quarantinedAt}` atomically — never serves the job; (caller response)
the frozen typed status `job_quarantined` (terminal — retry returns the same; the client offers a fresh test);
(session-start) pickup queries SKIP `status=='quarantined'`; (legacy scan) a one-time dark-train script counts +
quarantines existing malformed rows, its count published in the deploy report; (acceptance) post-launch
monitoring expects ZERO new quarantines — any occurrence is an ops_metrics signal.

## 7. `system_config/review_v2` (NEW top-level)

`{enabled:false, threshold:92, queueSize:60, testSize:30, configVersion:1, minClientVersion,
rehearsalClassIds:[], firstEnabledAt:null}` — dark-deployed `enabled:false` (R2-31). **[RATIFIED — R2-48, David 2026-08-02]: the FIRST activation is ONE audited txn writing `{enabled:true, firstEnabledAt:serverTimestamp}` TOGETHER — `firstEnabledAt` is written IFF ABSENT (a re-enable can never move the era boundary) and never cleared; every later write touches `enabled` only. **THE STAMPING PREDICATE [r65p — the marker law must coexist with the 25WT/shadow rehearsal]: live label writers stamp iff `firstEnabledAt` is set ∨ the class ∈ `rehearsalClassIds` — rehearsal classes stamp while globally dark BY DESIGN (that is what the rehearsal certifies); the 14_ §4 'zero live writers' dark-window law therefore reads 'zero live writers OUTSIDE rehearsalClassIds', and the shadow audit's battery-A (B3-on-shadow) runs BEFORE shadow ids enter `rehearsalClassIds` (ordering pinned in 16_).** **`firstEnabledAt` [r64 — THE DURABLE FLIPPED-ONCE MARKER, panel N2/N3]: written
(server timestamp) in the SAME audited txn as the first `enabled:true`, NEVER cleared afterward — the kill
switch clears `enabled` only. It is the ERA BOUNDARY for the six label fields per THE STAMPING PREDICATE below (marker ∨ rehearsal —
the dark window has zero live writers OUTSIDE `rehearsalClassIds`; B3 owns the real cohort's fields
exclusively); B3 FATALs
whenever it exists (a kill-switch OFF window can never re-admit the backfill writer); R2-32's OFF-stamping
law governs post-activation windows only (its ratified context).**
**`rehearsalClassIds` [stage-3 mechanism, David-granted 2026-08-02 — Codex-verify next round]: the server
resolver treats a class in this list as gate-ON even while globally dark — the ONLY way 25WT rehearses
ON-behavior with zero 26SM exposure; 26SM class ids are NEVER placed here; the list is emptied before the
real flip (the flip choreography asserts it empty).** **`minClientVersion` [contract (5), r53-B2/panel; semantics FROZEN r54]: a positive integer, monotonically
increased at deploys; compose/submit/completion requests carry the client's integer `clientContractVersion`;
server refuses when `!Number.isSafeInteger(clientContractVersion) || clientContractVersion < minClientVersion`
[r55 — the exact predicate: missing/malformed values REFUSE; a naive `undefined < min` is false] with the frozen
status `client_version_stale`
(response carries `minClientVersion`) ⇒ the client FORCES A REFRESH — the forced-refresh branch is CHOSEN;
no adapter ships at launch [decision recorded]; no silent validation weakening. This fences CALLABLE traffic
only — direct-Firestore authority is closed by §10's server-truth derivation, not by this fence.** Per-assignment overrides live on
`classes/{id}.assignments.{listId}`: `reviewPassThreshold, reviewQueueSize, reviewTestSize,
reviewGateEnabled` (default true; missing/null ⇒ true; precedence global-then-assignment, R2-38/r50-H4).
Client read allowed (UI posture); client write DENIED.
**[r70-C3 STRICT AUTHORITY SCHEMA]: a PRESENT-but-malformed authority field (`firstEnabledAt` non-Timestamp ·
`rehearsalClassIds` non-string-array · `minClientVersion` non-positive-int · `configVersion` < 1 · malformed
global threshold/sizes) resolves HOLD — coercion never enables stamping, arms a rehearsal, or disarms the
fence. [r70 RECORDED DECISION]: `minClientVersion: null` = fence DISARMED — the dark deploy ships null; the
fence arms (monotonic positive integers) when the DF2-51 client ships its `clientContractVersion`.**

## 8. Retry responses (frozen shapes)

- Compose replay ⇒ the existing queue/presentation records (deterministic ids; no duplicates).
- Attempt idempotent retry ⇒ `normalizeExistingAttempt(existing)` (zero writes — code-verified index.js:474-478).
- Completion loser ⇒ `already_completed`; stale-day submit ⇒ `day_guard_rejected` (A1-corrected).
- Grading pickup on expired job ⇒ `{status:'expired'}` after the transactional mark+redact.
- Stale client contract ⇒ `client_version_stale` (frozen; carries `minClientVersion`) [contract (5)].
- Malformed-ownership job (uid missing/non-string/empty, or writeContext absent while status ∈
  {claimed, grading, graded-unwritten}) ⇒ `job_quarantined` `{jobId, quarantineReason}` — TERMINAL (retry
  returns the same; the client offers a fresh test) [r59-B7; the §6d contract, now frozen HERE too].

## 9. Retention + reset cleanup

- **[r72 SUPERSESSIONS — the §9 build, both r71 lanes]** (1) **PRE-P5 FENCE SCOPE [BL-A — Opus r71
  BLOCKER]: while `LIST_PROGRESS_CANONICAL` is false the fence/lock lives on `progress_meta/{listId}`
  ONLY — creating `list_progress` pre-P5 flips both live readers (foundation.js resolveListProgress +
  progressService fetchStudentsProgressForClass prefer the canonical doc ON EXISTENCE) onto a doc with no
  csd/twi, freezing the student at day 0. Post-P5 both docs fence per the letter below; every epoch
  consumer reduces max(both) either way.** (2) **THE RESET-V2 GATE [WinClaude r83 escalation]:
  `resetProgress` is a LIVE callable, so the rebuilt law ships behind `RESET_V2_ENABLED=false`
  (emulator-overridable for the lap) — the dark deploy stays zero-delta; flipping the const is DAVID'S
  deploy decision, exercised in the 25WT/shadow phases first.** (3) **TWO-DOC LOCK REDUCTION [Codex r71
  C4]: ANY live lock on EITHER tombstone rejects; takeover only when every present lock is stale.**
- **RESET = OWNED LOCKED FENCE-FIRST [r54+r55+r56 — closes the races AND the liveness/ownership holes]:**
  (1) the fence: ONE **TRANSACTION** [r57 — a WriteBatch cannot read/reject: two callers could both pass a
  precheck and overwrite ownership] that READS both tombstone docs (`progress_meta/{listId}` +
  `list_progress/{listId}`), REJECTS if a live un-expired lock exists (`reset_already_running`), derives ONE
  absolute `targetEpoch = max(both epochs) + 1`, and WRITES both docs `{resetEpoch: targetEpoch,
  resetInProgress: {opId, targetEpoch, at}}` atomically;
  (2) while locked, EVERY server op for that (uid,list) — compose, submit, completion, grading claim,
  **grading FINALIZE/write-recovery, force-pass/override, the B3 backfill writer [r59-B5]**, label write,
  challenge-accept [the §6b txn], rerun compose — rejects `reset_in_progress` (each writer's FINAL txn re-reads
  the epoch + lock). **B3 COMPLIANCE + THE HONEST RESIDUAL [r62/r62p]:** B3's phase-2 writes run in chunked
  transactions (the law extracted to `b3-txn-core.mjs`, race-fixtured) whose READ SET includes both
  tombstone collections + the chunk's targets (all reads before writes; serializable isolation) — a LIVE
  lock aborts the chunk (`skippedResetLocked`) AND a COMPLETED reset that already cleared its lock aborts
  too via the EPOCH re-check against the phase-1 snapshot (`skippedEpochDrift`) [r62p — the
  lock-cleared-between-phases counterexample is closed]; both exit 5, no journal line ⇒ resumed later. The residual window is BETWEEN chunks of one
  large student: chunks committed BEFORE the reset began stay written. That tail is harmless BY CONSTRUCTION —
  the reset's own stale-epoch cleanup wipes/rebuilds the student's state, and the post-flip reconciliation pass
  (14_ §4) re-verifies every uid against the final baseline; no silent divergence survives;
  (3) stale-epoch-only deletes (all epoch-tagged: queues, presentations, completions, visits, credits,
  restudy_completions, counters, **review_cursors, compose_keys [r59-B5 — a stale claim would otherwise refuse
  a legitimate post-reset replay forever]**) + pending-job cancellation; (4) reconciliation sweep; (5) **owner-clear**:
  the op clears the lock only if `resetInProgress.opId` is its own. **LIVENESS [r56]: a lock older than 10
  minutes is TAKEOVER-eligible — a new reset op re-fences (epoch +1 again, new opId) and re-runs cleanup;
  crash mid-cleanup therefore self-heals on the next reset attempt, and the stuck-lock state rejects only
  WRITE ops (reads/UI unaffected) until takeover.** Delete set extends to `review_queues`, `review_presentations`, `day_completions`,
  `streak_credits`, `restudy_completions` (all carry queryable `listId`/`classId` fields [panel]) and pending
  `grading_jobs` cancellation via the named `(uid,status)` index (epoch mismatch ⇒ reject/cancel, r47 Q5).
  Server label writes re-verify the tombstone epoch INSIDE their txn (labels carry no epoch field — the txn
  fence is the guard).
- **Bookmark cleanup [panel]**: reset deletes `restudyBookmarks.{classId}_{listId}` (FieldValue.delete on the
  map key); belt-and-braces client rule: a bookmark beyond the frontier is ignored.
- Grading jobs: 12h logical expiry (§5); physical TTL cleanup async.

## 10. Pool-input authority disposition (`status`/`masteredAt`/return fields) [r53-B2]

**RESOLVED BY SERVER-TRUTH DERIVATION [r54 — supersedes the v2 "interim authority" posture, which r54
correctly rejected]: the redesign's pool/resting/underflow derivation reads ONLY server-owned truth —
`reviewRestingUntil` (§1, set in the graduation txn — LIVE-ONLY per r59-A9/r62p: NEVER backfilled or seeded;
at launch every word starts un-resting and rest schedules accrue organically from live graduations) +
`day_completions.graduatedWordIds` + the labels. Client-writable `status`/`masteredAt` are NEVER inputs to the
new composition, so a client write between completion and compose alters NOTHING behavioral.** Legacy fields
stay client-writable for legacy display until DF2-46 retires their writers (rules narrowing carded there,
min-version precondition); the emulator matrix proves pool-input forgery is behaviorally inert (case 10).
