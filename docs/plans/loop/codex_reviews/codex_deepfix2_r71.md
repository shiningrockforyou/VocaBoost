# Codex round 71 — C1-C8 fold verification

**Reviewed commit:** `c7abf0a`  
**Checkpoint verdict:** **NO**  
**`codexDecision`: `NO`**

## Ruling

This review is limited exactly to the round-70 closing list C1-C8. The fold closes several of the
previous repros, and the committed 148/148 artifact is internally consistent with its 13 recorded source
hashes. It does not, however, close the authority boundary. Concrete misses remain inside every one of
C1-C8. The most consequential are:

- completion still accepts an unclaimed/missing-queue presentation and an unbound new-attempt range;
- an existing old-day queue bypasses the frontier guard, while live-new binds the frontier only before its
  minting transaction;
- final transactions do not re-enforce enrollment or assignment existence, and malformed assignment
  authority is defaulted rather than held;
- the flip validates only the *presence* of five hashes, not their values, and accepts a one-stage `B4`
  receipt instead of the required ordered Track-B chain;
- `priority_saturation_day` is unreachable because `priorityCount` is discarded;
- most C8 authority negatives still execute internal helpers, not the public callable boundary.

The green lap therefore remains false-green with respect to the exact C1-C8 contract.

## C1 — FAIL: completion is not fully evidence-bound

The CAS, same-transaction `csd/twi` write, attempt-time `effectiveEnabled`, and count/set equality are real
improvements. Three authority holes remain.

1. The presentation claim is not exact. `completion.js:335-337` refuses only when a non-null claim belongs
   to another attempt. `serverClaim.attemptDocId:null` is accepted. An engine-written attempt always claims
   its presentation in the attempt transaction, so null is not valid engine evidence.
2. The source queue is optional. `completion.js:339-348` performs the tuple check only when `queueRef` is a
   non-empty string. A review attempt with a presentation but no queue therefore passes without any source
   queue, anchor, or generation binding. When a queue is present, only its two tuple fields are checked;
   uid/class/list/day/epoch, canonical queue identity, and the presentation/queue pool hash are not.
3. The new attempt is never bound to a presentation or authoritative range. `completion.js:353-376` checks
   uid/list/pass/type/day/epoch, then `:458-471` trusts its client-shaped range length. It does not prove
   `newWordStartIndex === truth.twi`, bind the range to a server presentation, or clamp it to the canonical
   list/allocation. A same-day passing record carrying an inflated range can inflate `twi` in the CAS txn.
   The lap's happy new evidence is deliberately seeded without a presentation
   (`engine-emulator-lap.mjs:435-438`), so the artifact blesses this gap.

The “validated gatePosture” claim is also too broad. `completion.js:389-400` validates only
`effectiveEnabled` and integer `configVersion`; a missing/malformed threshold falls back to the current
source config. The impossible-record fence does not require an integer score and does not check
`passed === (score >= stored threshold)`. Those are still completion-time substitutions/invalid shapes
inside C1, even though the score-120 fixture now refuses.

## C2 — FAIL: frontier enforcement has replay and live-new holes

The new progress truth produces a stable introduced universe and tuple, and the new-compose path correctly
handles day 1, full introduced reruns, typed reuse mismatch, and overshot-cursor repair in its tested cases.
But “live compose accepts only the frontier” is not true:

- `composeDayQueue` returns an existing deterministic queue at `composer.js:260-269` **before** the frontier
  check at `:272-275`. After day N completes, a caller can request N again, receive the old queue, and mint a
  new presentation/attempt for a past day. The lap tests a past day only when no such queue exists.
- `reviewV2ComposeNewTest` checks progress outside the transaction at `callables.js:260-267`.
  `composePresentation`'s `new-day/live` transaction never reads progress or rechecks the frontier
  (`presentations.js:324-375,445-469`). A progress advance between preflight and commit can mint a stale
  live-new presentation. The source comment at `callables.js:262-264` explicitly acknowledges that this is
  only a preflight bind.

Thus `progress.js` is not yet the one in-transaction day authority for every compose claimed by the handoff.

## C3 — FAIL: assignment/enrollment authority is absent from final transactions

Every minting module calls `resolveReviewConfig(..., {classId,listId,txn})` without `uid`, for example
`composer.js:242`, `presentations.js:328`, `callables.js:480`, `completion.js:242-245`, and
`visits.js:54`. The resolver produces `classExists`, `assignmentExists`, and `enrolled` only when `uid` is
supplied (`config.js:134-141`), while `assertServableInTxn` checks none of those fields
(`config.js:211-220`). Consequently removal of the assignment or student after preflight still permits a
mint under a globally eligible posture.

I reproduced this directly with the resolver: an existing class with `studentIds:[]` and `assignments:{}`
resolved `stampingEligible:true`, and `assertServableInTxn(...)` returned `null`; neither authorization fact
was present.

The “complete strict schema” claim also omits assignment authority. Malformed
`reviewGateEnabled:'bad'`, `reviewPassThreshold:'bad'`, `reviewQueueSize:-9`, and
`reviewTestType:'bogus'` resolve `readStatus:'ok'` and silently become gate `true`, threshold `92`, queue
size `60`, and modality `mcq` (`config.js:126-150`). C3 required typed assignment overrides to HOLD.

The lap tests pre-existing dark/version states, not an edit between preflight and final transaction, and it
contains no assignment-removal or enrollment-removal race. The third C3 bullet is therefore also unproven.

## C4 — FAIL: the two-doc reset lock is not reduced safely

Live-new routing, append-only grading preimages, and visit tuple checks are now wired. The reset ownership
law still has an asymmetric two-doc race. `foundation.js:2091-2097` selects
`pmD.resetInProgress || lpD.resetInProgress` and examines only that one lock. If `progress_meta` carries a
stale lock but `list_progress` carries a different live lock, the stale first operand wins and the reset
overwrites both locks instead of returning `reset_already_running`. The required two-doc owned lock must
reject when **either** document has a live foreign owner and take over only when the effective lock set is
stale. The lap plants only one lock document (`engine-emulator-lap.mjs:399-406`), so it cannot falsify this
case.

## C5 — FAIL: retry semantics and queue validation remain weaker than claimed

Attempt replay has the same field names but not the same response semantics. The first commit returns the
actual `stamped`, `stampSkipped`, `rerunGraduated`, and `visitHalf` values
(`callables.js:606-613`); replay hard-codes `null/null/[]/null` (`:486-503`). A successful stamping or rerun
request therefore changes semantic result on retry. Those facts must be stored/reconstructed, or the first
and replay envelopes must use a genuinely stable normalized contract.

The live queue fence is also incomplete. At `callables.js:519-528`, a falsy/missing `p.queueRef` silently
uses current config. When present, the check proves only that the document exists and has an integer
threshold. It does not validate canonical path, uid/class/list/day/epoch, queue/presentation pool hash,
presented membership, or threshold bounds. This is not the C5 exact identity/hash fail-closed check.

The compose-key modality leg and strict canonical-word load are otherwise present.

## C6 — FAIL: receipt hashes and stage chain are not validated

The activation window document now joins the activation transaction, and bare legacy receipts/freshness/
project/failure-count checks improved. The source-bound proof is still nominal:

- `flip-review-v2.mjs:102-104` accepts any `sourceShas` object with at least five keys. It never enumerates the
  required files, recomputes current hashes, or compares values. Five arbitrary strings satisfy this check;
  the lap's own synthetic `goodShape` uses `{a:'1',...,e:'5'}` (`engine-emulator-lap.mjs:691-693`).
- `flip-review-v2.mjs:92-94` checks only “non-empty, starts B4, ends B4.” It does not require the exact ordered
  `B4→B1→B3→B4` sequence or validate `cycles`. A one-element `['B4']` receipt passes.
- The purported real receipt is produced only after B1/B3 were run separately; the driver then passes on its
  first B4 (`engine-emulator-lap.mjs:703-733`). Its receipt is therefore `stages:['B4']` and does not attest
  the ordered chain required by C6.

Hash-mismatched and wrong/intermediate-stage receipts consequently remain accepted by the production flip.

## C7 — FAIL: one required metric is unreachable and window binding is partial

`composeLiveReviewTest` computes `priorityCount`, but `composePresentation` copies only
`presentedWordIds`, version, seed, and `effectiveTestSize` and omits the count
(`presentations.js:418-431,521-531`). `reviewV2ComposeSession` then tests `p.priorityCount`
(`callables.js:200-205`), which is always undefined on creation. `priority_saturation_day` is therefore not
emitted from any successful transaction.

Window fail-closed behavior validates only integer `generation`. A present window with malformed/missing
`startedAt` or `runId` is treated as valid; `evaluateThresholds` falls back to the generic time cutoff
(`monitoring.js:231-249`). Rows are not stamped/filtered by window run id, so the claimed `startedAt/run`
binding is incomplete. The lap injects G-1, G+1, and missing generation, but not a non-integer **row**
generation; its string generation fixture corrupts the window instead (`engine-emulator-lap.mjs:533-551`).

## C8 — FAIL: the artifact does not reach all named authority paths

I verified that the committed artifact says 148/148 and that all 13 recorded SHA-256 prefixes match the
current commit. That establishes integrity of what it names, not completeness of the C8 claim.

Most binding negatives execute internal helpers directly: wrong day, rerun-as-new, cross-epoch, score
shape, foreign claim, posture, progress advance, and queue tuple cases are in direct `DONE`/`COMP` calls
(`engine-emulator-lap.mjs:410-522`). The wrapped callable case begins at `:559` and exercises mostly happy
compose/submit/complete/rerun flows plus a future day. It does not carry those authority negatives across
the public handler boundary.

Named C8 cases are also absent or weaker than specified: no transaction-time enrollment/assignment/config
race; no completion wrong-queue/pool-hash negative; no ON→OFF completion posture case; no exact live-new
label-stamp assertion; no duplicate-row callable negative; and no dual-lock reset race. The receipt test
does not mutate a bound hash, so it misses the C6 false-green above.

Finally, the artifact hashes the ten reviewV2 modules and three scripts, but not `functions/foundation.js`,
`functions/index.js`, or `src/services/db.js`. Those are precisely the public export, reset, and live
grading-preimage wiring C4/C8 asks this artifact to prove; the lap imports and executes `foundation.js` but
its receipt would remain green if those bytes changed.

## Independent verification

- `node --check`: **17/17 passed** (ten reviewV2 modules, three live wiring files, three scripts, ESLint
  config).
- `require('./functions/reviewV2/callables.js')`: **passed**.
- Direct CommonJS-aware ESLint over all reviewV2 files plus `foundation.js` and `index.js`: **0 findings**.
- `git diff --check` on the submitted implementation scope: **passed** (line-ending warnings only).
- Engine artifact: **148/148 recorded; 13/13 recorded hashes match current bytes**.
- Independent config probe reproduced assignment/enrollment fail-open and malformed assignment defaults as
  described under C3.

I did not rerun the emulator lap: it is hard-coded to `/app`, and the source-bound artifact was sufficient
to verify its exact code and reveal the missing assertions. No Docker workflow was used.

## Decision

**CHECKPOINT: NO.**  
**DARK DEPLOY ORDER SERIES: HOLD.**

Next review remains limited to the existing C1-C8 list. The items above are concrete unmet parts of that
list, not new checkpoint conditions.
