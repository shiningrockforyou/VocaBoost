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
| `reviewFailCount` | int ≥0 | SERVER (attempt txn + backfill) | +1 per wrong-or-blank presented word, ANY graded test (R2-17/41); reset-epoch-scoped |
| `reviewLastFailedAt` | Timestamp | SERVER | any graded test (R2-41) |
| `reviewLastCorrectAt` | Timestamp | SERVER | any correct answer, any graded test — clears PRIORITY (R2-29/41) |
| `reviewLastProvenAt` | Timestamp | SERVER | correct on a PASSING test (any type, R2-41b); accepted challenge per R2-10 once A2-activated |
| `reviewLastTestedAt` | Timestamp | SERVER | THE rotation clock [r53-B3 rename — legacy `lastTestedAt` stays client-written until DF2-46 and is NEVER read by the redesign]: advanced by review-TYPE tests incl. reruns (R2-41d); backfill-seeded from review-type history, null ⇒ NOT WRITTEN (unseeded words tie-break by wordIndex — **from the CANONICAL list word order (`lists/{id}/words`), never the client-written study-state copy [r55]**) per B1-Q2/r53 |
| `reviewRestingUntil` | Timestamp | SERVER | **THE SERVER RESTING TRUTH [r54 — closes the pool-authority hole]: set = completedAt+21d in the graduation txn (day_completions.graduatedWordIds is the audit twin); cleared/ignored past its instant; BACKFILL-SEEDED one-time from legacy `masteredAt`+21d — **VALIDATED [r55: legacy masteredAt is
client-forgeable]: seeded ONLY when (a) masteredAt is inside the live 21-day window AND (b) the word has
eligible attempt history in B1's baseline; anything else ⇒ not seeded + counted (B3; verified vs pre-image)**. The redesign's pool/underflow derivation reads ONLY server fields — NEVER client-writable `status`/`masteredAt`** |

Rules: client writes to these SIX fields DENIED field-level — ALL SIX ARE NEW FIELDS, so the lock is truly
inert pre-launch [r53-B3] (owner keeps writing the rest of the doc, including legacy `lastTestedAt`);
owner DELETE of a doc carrying any of the six is DENIED (label erasure, r54);
derived predicates (`needsPriority`, `fillEligible`) are computed, never stored.

## 2. `users/{uid}/review_queues/{queueId}` — the immutable DAY-QUEUE record (NEW, server-only)

- **docId** = `{classId}_{listId}_d{logicalDay}_e{resetEpoch}` (one per identity; deterministic ⇒ idempotent create).
- Fields: the identity septuple `{uid, classId, listId, logicalDay, resetEpoch, algorithmVersion, configVersion}`
  + `anchorNwei` + `generation` (the cross-class match tuple, r48/r50-B3) + `orderedQueueWordIds[]` + `poolHash`
  + `snapshot{threshold, queueSize, testSize, reviewTestType, reviewGateEnabled}` + `createdAt`.
- **Creation txn**: composed server-side inside the session-start/test-compose callable — txn reads pool state,
  applies rotation + the R2-41(e) underflow top-up (earliest-graduated resting words), `create()`s the doc
  (fails on exists ⇒ read existing — first writer wins, replays converge). The queue doc also carries
  `presentationCount` — the ONE mutable counter field, incremented only inside the presentation-compose txn
  (the sole exception to queue immutability; every other field frozen) [r53-B2].
- **Immutable**: every field after create EXCEPT `presentationCount` (the one counter, above). Mid-day teacher
  edits affect the NEXT day's queue (snapshot law).
- `poolHash` = SHA-256 over `JSON.stringify(orderedQueueWordIds)` (hex, full) [r55 — delimiter-safe canonical
  serialization; same rule for `presentationHash` and the introduced-range hash] — drift detection for audits.

## 3. `users/{uid}/review_presentations/{presentationId}` — the PER-ATTEMPT presentation record (NEW, server-only)

- **docId** = `{queueId}_p{seq}` (seq = the queue doc's `presentationCount`+1, assigned in the compose txn).
- **REPLAY KEY [r53-B2 + r54 fingerprint fix]: `composeKey`** — a client-minted idempotency token sent with
  every compose request; the compose txn queries `(uid, composeKey)` (indexed). On a hit the txn COMPARES the
  stored request fingerprint `{classId, listId, logicalDay, resetEpoch, sessionType(new|review),
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
  `presentedWordIds` = the day's anchor range draw, docId `{classId}_{listId}_d{day}_e{epoch}_n{seq}` — **seq from `users/{uid}/review_counters/{identity}` `{next}` — a server-only COUNTER DOC read+incremented
  INSIDE the compose txn (count-query allocation raced: two composeKeys could both pick N+1, and ALREADY_EXISTS
  is not in the txn retry set [r56]); `_p{seq}` keeps the queue's own `presentationCount`; `_r{seq}` uses the
  same counter-doc mechanism**.
  Every retake composes a NEW presentation under R2-15 rotation (r50-B3).
- **`compositionVersion` enum [r55 — its own clause]: `'lrt-v1'` (the R2-42/46 deterministic law — live review)
  · `'fallback-random'` (invariant-check fallback; remainder only; seed recorded) · `'rerun-random'` (R2-41h)
  · `'new-day'` (live new-word).**
- **RERUN identity [r53-B2/panel]**: restudied days have no live queue — rerun presentations use docId
  `{classId}_{listId}_d{visitedDay}_e{resetEpoch}_r{seq}` with `queueRef:null`, `poolHash` = the
  INTRODUCED-RANGE hash, `compositionVersion:'rerun-random'` (pure-random, no priority slots), `visitId` set
  (§6 pairing), seq from a per-(identity) count query in the txn. A rerun presentation binds `logicalDay` =
  the VISITED day (display/pairing) — never the frontier.
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
  newTestAttemptId|null, graduationCount, graduatedWordIds[] (bounded ≤ queue size — the SERVER resting-truth
  input, see §10), graduatedWordIdsHash, completedAt}` — **`evidenceKind` [r55/r56 matrix — decided by (newTest null?, consumed null?, gate posture, day)]:
  `standard` (neither null) · `gate_off_autopass` (consumed null, newTest present, gate OFF) ·
  `list_end_review_only` (newTest null, consumed present) · `gate_off_list_end` (BOTH null, gate OFF,
  day > 1 — the legitimate OFF×zero-new-words day [r56: previously walled by refusal]) · `first_day_new_only`
  (consumed null, day == 1, gate ON — Day 1 has no review). REFUSED: both-null with gate ON on day > 1
  (impossible under the both-tests law), and any shape not enumerated above** — the cross-class evidence audit
  (contract (2): "audit records the consumed attempt + source config") lives HERE; resetEpoch binding for
  completions (contract (6)) lives HERE.
- Immutable after create. Streak credit (§6) writes in the SAME txn. Client graduation dies (DF2-10(8) moves
  graduation into this txn); a client receiving `already_completed` re-runs NOTHING [A2/r53].

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
full accept path. Ordering with graduation is transactional by construction (both read/write inside their own
txns against server truth — R2-10 condition (iii)).

## 6c. `ops_metrics/{metricId}` — the server-only operational sink [r55]

`composition_fallback`, priority-saturation days, reset reconciliation counts, and every other MONITORING/ABORT
signal write HERE (Admin SDK only; client write DENIED; teacher read) — **never to `system_logs`, which any
authenticated client may create (firestore.rules:334-337) and which therefore can never be an authority signal.**

## 6d. Grading-job ownership contract [r55]

The claim/pickup path requires **exact `job.uid === caller.uid`** — a job with a MISSING/malformed `uid` is
REFUSED and quarantined (today's code fail-opens on missing uid: index.js:935-938/:1566-1569 reject only
truthy-and-different; the build closes this; legacy malformed rows are quarantined at backfill).

## 7. `system_config/review_v2` (NEW top-level)

`{enabled:false, threshold:92, queueSize:60, testSize:30, configVersion:1, minClientVersion,
rehearsalClassIds:[]}` — dark-deployed `enabled:false` (R2-31); David's fireadmin write flips `enabled` ONLY.
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

## 8. Retry responses (frozen shapes)

- Compose replay ⇒ the existing queue/presentation records (deterministic ids; no duplicates).
- Attempt idempotent retry ⇒ `normalizeExistingAttempt(existing)` (zero writes — code-verified index.js:474-478).
- Completion loser ⇒ `already_completed`; stale-day submit ⇒ `day_guard_rejected` (A1-corrected).
- Grading pickup on expired job ⇒ `{status:'expired'}` after the transactional mark+redact.
- Stale client contract ⇒ `client_version_stale` (frozen; carries `minClientVersion`) [contract (5)].

## 9. Retention + reset cleanup

- **RESET = OWNED LOCKED FENCE-FIRST [r54+r55+r56 — closes the races AND the liveness/ownership holes]:**
  (1) the fence: ONE batched write to **BOTH tombstone docs** (`progress_meta/{listId}` + `list_progress/{listId}`
  [the two real homes, 14_ §1.5]) setting `{resetEpoch: +1, resetInProgress: {opId, targetEpoch, at}}` —
  a second reset while the lock holds is REJECTED (`reset_already_running`) unless TAKEOVER applies;
  (2) while locked, EVERY server op for that (uid,list) — compose, submit, completion, grading claim, label
  write, **challenge-accept [the §6b txn — enumerated, r56]**, rerun compose — rejects `reset_in_progress`;
  (3) stale-epoch-only deletes (all epoch-tagged: queues, presentations, completions, visits, credits,
  restudy_completions, counters) + pending-job cancellation; (4) reconciliation sweep; (5) **owner-clear**:
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
`reviewRestingUntil` (§1, set in the graduation txn, backfill-seeded from legacy `masteredAt` once) +
`day_completions.graduatedWordIds` + the labels. Client-writable `status`/`masteredAt` are NEVER inputs to the
new composition, so a client write between completion and compose alters NOTHING behavioral.** Legacy fields
stay client-writable for legacy display until DF2-46 retires their writers (rules narrowing carded there,
min-version precondition); the emulator matrix proves pool-input forgery is behaviorally inert (case 10).
