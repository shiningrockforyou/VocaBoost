# Codex round 70 — stage-2 dark-engine checkpoint

**Reviewed:** 2026-08-02  
**Commit:** `ca8d4fe`  
**Checkpoint verdict:** **NO**  
**`codexDecision`: `NO`**

## Ruling

The pure queue, presentation, stamping, graduation, cursor, and CAS mechanisms are generally close to
the frozen contracts. The checkpoint still fails at the authority and wiring boundary. In particular,
the public completion callable accepts weakly related historical attempts, re-resolves posture at
completion time, never atomically advances the canonical progress record, and accepts a client-selected
day. The live compose path also treats every missing passed-new anchor as a list-end day and exposes the
whole list. Those are reachable server-mediated data-integrity failures, not product re-litigation.

The 68/68 lap does not cover `callables.js`; it manually seeds the evidence records that the callable
layer is meant to authorize. It therefore cannot falsify the main failure class in this review. The
separate Opus lane independently found the same weak completion binding and anchorless-whole-list path.

This is a bounded implementation NO. Typed grading, the full UI, Playwright, and 25WT product rehearsal
remain later train stages and are not conditions of this checkpoint. The complete closing-condition list
for this checkpoint is in §8; the next review is limited to that list.

## 1. Blocking — completion does not bind authority and does not perform the advance

`reviewV2CompleteDay` accepts `logicalDay`, two attempt ids, and the consumed class id from the client
(`callables.js:512-540`). `completeDay` then checks the consumed attempt only for uid/list/class,
`sessionType === 'review'`, non-rerun, and `passed === true`; the new attempt is checked only for
uid/list/pass (`completion.js:250-276`). It does **not** require:

- `attempt.studyDay === logicalDay`;
- the evidence attempt's `resetEpoch` to equal the completion epoch;
- the new attempt to be a live `sessionType:'new'` attempt;
- either attempt to bind to the expected presentation, source-class queue, pool/presentation hash,
  anchor, or generation;
- the cross-class attempt and target day to match on the frozen
  `{uid,listId,logicalDay,resetEpoch,anchor/generation}` tuple.

Consequently one passed review plus one passed “new” record can be reused across fresh
`day_completions/{listId}_dN_eE` ids. Each new id defeats the CAS replay guard and can mint graduation,
21-day rest, and a streak credit. A rerun or wrong-day passed record can satisfy the same path. The lap's
Case E cannot detect this: it seeds matching happy-path ids and never executes a mismatch negative; its
seeded new attempt even lacks the new engine's epoch/presentation bindings
(`engine-emulator-lap.mjs:258-270`).

The source-posture derivation is also wrong despite the sound “privilege requires ON” policy.
`completeDay` resolves the source class's **current** config (`completion.js:218-245`) and ignores the
consumed attempt's stored `gatePosture`. An attempt graded while OFF can therefore be completed after the
assignment/global gate returns ON and mint protected rest; the inverse change silently strips graduation
from an ON attempt. This contradicts the frozen attempt-time-posture-governs-through-completion law.

Finally, `completeDay` creates the completion record, rest fields, and streak credit, but it never updates
the canonical `list_progress`/progress state. The existing `foundation.completeSession` still performs the
actual `currentStudyDay` advance in a different transaction. The submitted callable therefore either does
not advance the student at all, or requires a second non-atomic call—both violate “one advance + one
graduation per logical day” in one server-authoritative transaction.

Secondary fail-open: `computeGraduation` treats a finite impossible score such as 120 as valid and clamps it
to 100. I reproduced `invalidScore:false` with 58 graduated ids from a score-120 input. Since completion
currently accepts historical/server records without the r48 impossible-record validity check, this is a
reachable privilege mint, not merely a pure-helper curiosity.

## 2. Blocking — missing anchor is not proof of list end; day/frontier authority is absent

`foundation.deriveDayAnchorRange` returns null whenever the day has no valid passed new attempt
(`foundation.js:996-1001`). That includes ordinary review-first use before the day's new test passes, a
pending/failed grade, day 1 before the new test, an invalid client-selected future day, and a genuine
zero-new/list-end day.

`deriveDayContext` maps all of those states to the whole canonical list
(`callables.js:149-168`). A review-first compose can therefore freeze an immutable day queue containing
unintroduced future words, advance the list-scoped rotation cursor across them, test/stamp them, and on day
1 create a review even though `first_day_new_only` assumes none exists.

The callable accepts any integer day ≥1. `composeDayQueue` rejects only days **behind** the cursor
(`composer.js:268-274`), so `logicalDay:999` can set `cursor.lastLogicalDay=999` and make every legitimate
later compose fail until reset. The completion and mint-visit callables have the same missing frontier
check. The current `anchorNwei=-1` / `generation:'none'` sentinel is therefore not a stable list-end
identity—it is also the normal pre-new-test identity and can flip inside one shared day, making the
cross-class reuse assertion throw `internal` (`composer.js:294-300`).

The rerun half of named derivation #6 is also not supported by the final decision record. R2-41(h) and the
discussion trace define a fresh pure-random draw over the student's **full currently introduced range**;
the build instead caps it through the visited day's `newWordEndIndex` (`callables.js:164-167, 274-283`).
That closes the “always-open” rerun proof path for words introduced after the visited day and overlaps the
visited day's new-word half while excluding later introduced words.

## 3. Blocking — config and serving gates are fail-open or only preflight checks

`resolveReviewConfig` calls a doc malformed only when `enabled` or `configVersion` has the wrong primitive
shape (`config.js:83-87`). Security-critical malformed fields are silently normalized:

- any non-null `firstEnabledAt`, including a string or boolean, makes `stampingEligible=true`;
- malformed `minClientVersion` becomes null and disarms the client-version fence;
- malformed rehearsal/assignment values fall into defaults rather than HOLD.

An independent mock probe with `firstEnabledAt:'not-a-timestamp'` and
`minClientVersion:'bad'` returned `{readStatus:'ok', stampingEligible:true,
minClientVersion:null}`. That can admit live label writes before the real R2-48 marker and stale clients
after the fence should be armed.

The callable-level eligibility/version check is also a non-transactional preflight. The minting txns do
not consistently re-enforce it:

- `composeDayQueue` re-reads config but will create a queue when its txn snapshot is no longer eligible;
- `composePresentation` does not read config at all;
- the submit txn re-reads config but still creates the attempt when `stampingEligible` is false—its label
  helper merely returns `not_eligible` (`callables.js:405-475`);
- `mintRestudyVisit` is a plain `set` after courtesy reads (`visits.js:38-53`);
- the preflight `clientContractVersion` is not checked against the transaction-time config version.

Thus rehearsal removal, fence activation, or a config/version edit between preflight and commit can mint
exactly the unstamped/stale objects the activation barrier is supposed to exclude. The successful engine
txn must adopt and enforce its own resolver snapshot; returning the earlier snapshot is insufficient.

## 4. Incomplete frozen writer/reset integrations

Several submitted “built” duties are helpers with no authoritative caller:

- There is no live-new presentation/submit route, and the existing live new-test writers are untouched, so
  “every graded test stamps, including live new” is not implemented. The only `new-day` callable use is the
  rerun-new half.
- `gradingPreimageWrites` is not called by the live challenge-accept or teacher-edit writers. The existing
  writers still mutate `isCorrect` without first preserving `gradedIsCorrect`, so the R2-49 legacy
  reconstruction class continues to grow after the real baseline.
- `reset.js` implements only a cleanup helper and is imported nowhere. The live
  `foundation.resetProgress` remains delete-first and stamps the epoch last; it does not create the two-doc
  owned lock, invoke the nine-family stale cleanup, cancel jobs, clear bookmarks, reconcile, or owner-clear.
- `mintRestudyVisit` neither joins that reset fence nor proves that the requested day is a real past day.
  Rerun compose/submit also does not compare the visit's class/list/day/epoch to the presentation.

These gaps must close before the new exports enter a deploy order. R2-10's **label-minting** activation may
remain dormant, but preserving the grading preimage before existing adjudication mutates rows is not the
same deferred decision.

## 5. False-green activation gate

The flip script accepts a receipt when `lap.pass === true || lap.failed === 0`
(`flip-review-v2.mjs:83-92`). Therefore `{ "pass": true }` and `{ "failed": 0 }` pass without a probe name,
stage sequence, positive check count, source hashes, project/run identity, or content timestamp. The engine
lap tests activation by writing exactly such a synthetic `{pass:true}` file
(`engine-emulator-lap.mjs:354-368`) rather than consuming the required final B4→B1→B3→B4 receipt. The
existing Track-B evidence uses `checks`/`failures`, not this synthetic schema.

Freshness is based only on mutable filesystem mtime. In addition, absence of
`shadow_registry/window` is checked before and after activation but not read in the activation transaction;
the claimed “exact” transaction serializes only on the config doc. The flip gate is therefore false-green
and its no-window invariant is not atomic.

## 6. Monitoring and evidence gaps

- `priority_saturation_day` and `rerun_graduation` are vocabulary entries with no writer. The presentation
  layer discards `priorityCount`, so saturation cannot currently be emitted.
- A malformed audit window maps `generation` to null and production classification then skips quarantine
  entirely (`monitoring.js:120-137, 172-189`). That is fail-open.
- Evaluation reads a generic last-24h range rather than binding rows to the window's `startedAt`/run, so an
  audit can consume same-generation rows from outside the current window.
- The claimed G−1/G+1/unstamped lap matrix plants only G−1 and unstamped rows
  (`engine-emulator-lap.mjs:337-345`).
- The lap explicitly excludes callable HTTP/handler coverage and manually seeds attempt authority. It also
  writes only a temporary aggregate receipt; no committed source-hash-bound 68/68 artifact exists.
- All 11 submitted JavaScript files pass `node --check`, and the callable module loads. A direct local ESLint
  invocation reports 38 errors (mostly the root flat config treating CommonJS globals as browser/module
  globals, plus real unused bindings). The package lint script masks every failure with `|| exit 0`, so the
  deploy precheck remains green regardless.

## 7. Adjudication of the ten named derivations

| # | Derivation | Ruling |
|---|---|---|
| 1 | New typed statuses | **AMEND.** The names are reasonable endpoint-local protocol names, including safe `typed_modality_deferred`. But attempt replay must return the same normalized semantic result as the first write; `attempt_exists` currently returns a raw attempt in a different envelope. Status delivery (data vs `HttpsError`) must be uniform and documented. |
| 2 | Graduation pick in queue order | **ACCEPT.** The frozen text fixes the eligible set/count, not the tie order. Queue order is deterministic and auditable. |
| 3 | OFF-source evidence advances but graduates zero | **ACCEPT POLICY; IMPLEMENTATION FAILS.** This is the conservative reading of proof-freeze, but it must use the attempt-time source posture. Current-config re-resolution permits OFF→ON laundering. |
| 4 | Per-user `restudy_completions` path | **ACCEPT.** It is the collision-free reading and fits reset reach. |
| 5 | Shadow registry field `ids` | **ACCEPT.** Pin the name in the stage-3 driver/schema so a mismatch cannot silently classify an empty cohort. |
| 6 | Live universe / rerun range | **REJECT.** Missing passed anchor is not list-end proof; derive the live introduced bound from progress truth. Rerun review uses the full current introduced range, not only through the visited day. |
| 7 | `s{start}e{end}` generation and `-1` sentinel | **AMEND.** The format is acceptable, but source it from stable authoritative day truth. `-1/'none'` is reserved for a proven zero-new/list-end day, not any missing anchor. |
| 8 | Serving gate equals `stampingEligible` | **ACCEPT POLICY; IMPLEMENTATION FAILS.** Correct for dark custody and post-flip OFF stamping, but it must be re-enforced in every minting transaction, not only before it. |
| 9 | Rotation clock writes while OFF | **ACCEPT.** It is bookkeeping; only proof privilege freezes. |
| 10 | Streak is posture-independent | **ACCEPT POLICY.** Every valid advance credits, but “valid” requires the day/evidence/progress authority repairs in §1-2. |

## 8. Complete closing-condition list

**The round-70 checkpoint becomes YES when exactly C1-C8 hold. No additional checkpoint blockers are held
back.**

### C1 — one authoritative completion transaction

- Derive the expected current logical day/frontier from server progress inside the transaction.
- Bind consumed and new evidence to uid/list/day/epoch/type/retest state, the exact presentation and source
  queue, and the frozen anchor/generation tuple; enforce the cross-class rule against the source queue.
- Use the consumed attempt's validated attempt-time `gatePosture`/config version for source posture and
  privilege, not a completion-time reclassification. A missing legacy stamp may use only a narrowly named,
  published boundary rule.
- Apply the canonical progress advance, `day_completions` CAS, graduation/rest, and streak in that same
  transaction. The loser returns `already_completed` and runs none of those writes.
- Reject impossible attempt shapes/scores and assert
  `graduationCount === graduatedWordIds.length` before commit.

### C2 — authoritative day, universe, rerun, and match tuple

- Live compose accepts only the server-authorized current frontier day. Derive the introduced bound from
  server progress truth so review-first is stable before/after the new attempt; day 1 has no review and only
  a proven zero-new/list-end day uses the whole list.
- Rerun/mint-visit accepts only an existing restudy day at or behind the authorized frontier and draws review
  words from the full **currently introduced** range, with resting words included.
- Source `anchorNwei`/`generation` from the same stable truth; reserve `-1/'none'` for proven list-end. A reuse
  mismatch returns a typed fail-closed refusal, never `internal`, and never mutates the cursor.
- Add a bounded repair for any already-overshot cursor and record first-compose
  `snapshot.queueSize = orderedQueueWordIds.length` (configured size remains separately auditable).

### C3 — strict, transaction-bound config/serving authority

- Validate the complete config schema: Timestamp-or-null marker, valid rehearsal id array, positive/allowed
  versions and fence, and typed assignment overrides. A malformed authority field resolves HOLD; it never
  enables stamping or disables the version fence by coercion.
- Every queue, presentation, attempt, completion, rerun graduation, and visit mint re-reads and enforces
  `stampingEligible`, client version, enrollment/assignment, and the reset fence in its final minting
  transaction. The caller adopts that transaction's snapshot.
- Race tests cover rehearsal removal, marker/config/version change, assignment removal, and reset between
  preflight and commit; each either commits wholly under the serialized snapshot or mints nothing.

### C4 — wire the frozen writers and reset, not only helpers

- Route live-new attempts through a server presentation/denominator and the same complete-row stamping txn;
  all live/rerun × new/review cases stamp exactly once. Typed may continue returning
  `typed_modality_deferred` until DF2-12, with zero writes.
- Wire grading-preimage preservation into every live challenge-accept/teacher-edit mutation (or close the
  duplicate client mutation path); repeated adjudication never overwrites the preimage. R2-10 label stamps
  remain explicitly dormant.
- Replace/wire `resetProgress` to the two-doc owned locked fence-first law, invoke all stale-family/job/bookmark
  cleanup, reconcile, and owner-clear/takeover. Visit mint and every final writer participate in the fence.
- Bind every rerun presentation/attempt half to an existing visit with exact uid/class/list/day/epoch; missing
  or mismatched visits mint no attempt, graduation, or pip.

### C5 — immutable-record and retry consistency

- Attempt idempotent replay returns the same normalized response semantics as the first commit, with zero
  writes; it does not expose a divergent raw-attempt envelope.
- A live presentation validates its queue identity/hash and threshold snapshot fail-closed; queueRef present
  with missing/malformed queue is not silently converted to `queueId:null` or current config.
- Preserve the separately compared modality leg in the compose-key fingerprint and make malformed canonical
  word positions a typed refusal plus an ops signal, not silent omission/`internal`.

### C6 — source-bound, atomic activation proof

- Define and validate one exact final Track-B micro-lap receipt schema: expected probe/version and ordered
  B4→B1→B3→B4 stages, positive check counts, zero failures, project/run identity, content timestamp/freshness,
  and hashes for every bound source. Bare `pass:true`, bare `failed:0`, touched/stale, wrong-project, and
  hash-mismatched receipts refuse.
- The activation transaction reads and rejects `shadow_registry/window` inside the same transaction as the
  config mutation, while retaining the existing rehearsal-empty and write-once-marker assertions.
- The flip rehearsal consumes a real receipt of that schema; it may not synthesize success JSON.

### C7 — complete, fail-closed monitoring

- Emit `priority_saturation_day` and `rerun_graduation` from their actual successful transactions and retain
  the already-wired `composition_fallback` event.
- A present but malformed audit window refuses/fails closed for both scopes. Window evaluation is bounded to
  that window's `startedAt`/run so prior same-generation rows cannot feed it; every baseline consumer uses the
  same quarantine partition.
- Execute G−1, G+1, non-integer, and missing generation cases and assert the published per-window quarantine
  count.

### C8 — evidence that reaches the authority boundary

- Extend a named emulator artifact over the public callable/handler boundary and cover: wrong-day and reused
  attempts; rerun-as-new; cross-epoch; wrong queue/anchor/generation; OFF→ON and ON→OFF source posture;
  current-day/frontier/future-day composes; review-first before the new pass; day 1; true list-end; full-range
  rerun; visit mismatches; config/eligibility/version races; live-new stamping; reset crash/takeover; actual
  compose-key cleanup; same-KST-date streak; wrapped/no-active cursor transitions; LRT/prefix/fallback; and
  complete-row drift/duplicate/blank negatives.
- Commit a source-hash-bound receipt with exact counts and make the flip test consume it.
- `node --check` stays green, a targeted CommonJS-aware lint runs without the package's `|| exit 0` mask, and
  the checkpoint packet reports test failures rather than classifying every red as a test bug by assertion.

## 9. Independent verification performed

- `node --check` on all nine reviewV2 files plus both scripts: **11/11 passed**.
- `require('./reviewV2/callables.js')`: module load passed.
- `git show --check ca8d4fe`: passed.
- Direct config mock reproduced malformed-marker/fence fail-open.
- Direct graduation probe reproduced finite score 120 being treated as valid.
- Direct ESLint on the nine reviewV2 files: **38 errors**; the configured package script masks the exit.
- I did not cite the 68/68 aggregate as independent runtime evidence: no source-bound artifact was handed off,
  and the available lap intentionally excludes the callable layer where the blockers live.

## Decision

**CHECKPOINT: NO.**  
**DARK DEPLOY ORDER SERIES: HOLD.**  
**Next review: judge exactly C1-C8.**

