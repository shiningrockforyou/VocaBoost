# WSL → Codex round 70 — STAGE-2 CHECKPOINT REVIEW: the dark-build engine

Your r69 YES opened stage 2. Since then: THE REAL BASELINE landed (947/947, censuses published), R2-50
ratified+implemented, and **THE DARK BUILD IS NOW CODE-COMPLETE THROUGH THE ENGINE** — this round is the
David-mandated stage-2 checkpoint (roster: you + 1 Opus xhigh, WSL orchestrates; gate-class quads return at
the deploy/flip gates).

## Review class + contract
CHECKPOINT (not a freeze): the engine is DARK (nothing deploys until the WinClaude order series; nothing
serves until the R2-48 predicate). Bar: **build-vs-frozen-contract fidelity** — does the code implement 15_/
14_/16_/11_ as frozen at r69? A NO must carry your complete closing-condition list (the standing David
contract). Product re-litigation is out of scope; the contracts are frozen.

## What landed (all NEW files unless noted)
- `functions/reviewV2/config.js` — THE ONE RESOLVER (R2-48 predicate; rehearsal resolver; r48 HOLD; r55
  fence; txn=activation-barrier; + this round: txn read errors RETHROW [a swallowed ABORTED poisoned the
  retry loop], reviewTestType/assignmentGateEnabled for §2 snapshots, uid→authFacts for callable fences).
- `functions/reviewV2/composer.js` — H6 §2/§2b/§10: the day-queue txn (identity septuple, poolHash,
  presentationCount the ONE mutable field, create=first-writer-wins), THE CURSOR exact transitions
  (r59-B3 incl. wrapped-window=last-traversed), same-day cross-class REUSE (r59-B2/r60/r62:
  snapshot.queueSize=|reused|, configQueueSize audit-only, anchor-tuple equality), R2-41(e) underflow
  (earliest-graduated=restingUntil asc), §9 fence in-txn.
- `functions/reviewV2/presentations.js` — §3: composeKey CLAIM REGISTRY (sha256 docId [r59-B6], create=lock,
  stored-fingerprint replay/`compose_key_reused`), the frozen `_n`/`_r` counter allocator (create-{next:2}-
  allocate-1; NO count queries [r59-B4]), `_p` seq=presentationCount+1, R2-42/46 composition (LRT
  absent-first tie-wordIndex; INDEPENDENT invariant check; prefix-preserving seeded fallback w/ recorded
  seed; order shuffled both paths), modality=queue snapshot, rerun-random full-range draw.
- `functions/reviewV2/stamping.js` — §1/§6b: R2-48 writer-eligibility HARD GATE (ineligible ⇒ zero writes),
  R2-32 per-field (OFF: fail/correct/clock write, lp freezes), COMPLETE-ROWS asserted, blank=fail,
  gradingPreimageWrites (append-only `gradedIsCorrect`), challengeAcceptPlan (R2-43 resting guard; R2-10
  BUILT-DORMANT behind explicit r2_10Active).
- `functions/reviewV2/completion.js` — §3b: class-agnostic CAS, the evidenceKind matrix EXACT (5 kinds +
  refusals), source-class provenance [r62p], R2-29 graduation (frozen vectors verified 92→55/100→60/NaN),
  rerun=tested-correct-only, rru born here (completedAt+21d EXACT twins, R2-48-gated), streak (KST docId,
  same-txn, ≤1/date by construction), in-txn evidence verification + legacy/boundary legs.
- `functions/reviewV2/monitoring.js` — §6c + 16_ r62/r63/r64: recordOpsMetric (every row stamped
  {registryGeneration, shadow} from the CACHED view), the window artifact, THE QUARANTINE PREDICATE exact
  (missing/non-int/<G/>G), evaluateThresholds({scope,dryRun}) (shadowAudit REQUIRES dryRun; quarantinedRowCount
  published per-window), getShadowRegistryGeneration diagnostic.
- `functions/reviewV2/reset.js` — §9 leg (3): stale-epoch-only deletes across the 9 reviewV2 families
  (compose_keys via fingerprint.listId) + R2-40e bookmark cleanup. `functions/reviewV2/visits.js` —
  R2-40c-ii per-visit claim docs (set-once halves; both-set ⇒ flip+increment SAME txn).
- `functions/reviewV2/callables.js` + **functions/index.js (ONE wiring block — the only existing-file
  touch)**: six dormant callables; serving gate ≡ stampingEligible; server-derived epoch; MCQ server verdict
  vs canonical `definition`; deterministic `rv2_{presentationId}` attempt ⇒ idempotent retry; typed ⇒
  `typed_modality_deferred` (DF2-12 lands in-train).
- `scripts/deepfix2/flip-review-v2.mjs` — the R2-48 txn EXACT (+ --kill/--reenable; DRY default;
  --yes-i-am-david; lap-receipt gate; window/rehearsal-list asserts; THE SWITCH IS DAVID'S).
- `scripts/deepfix2/engine-emulator-lap.mjs` — **THE EVIDENCE: 68/68 GREEN** (8 cases: posture matrix ·
  composer incl. reuse/wrap/day-guard/underflow/fences · claim registry/allocator · labels in real txns
  (dark ⇒ zero writes) · completion CAS/graduation-55/rru-twins/streak/visit-pair · reset cleanup ·
  quarantine injection matrix · THE FLIP choreography). First run 66/68 — both reds were TEST bugs (seed
  arithmetic; set-merge deep-merge), system right both times, receipts in change_action_log.md.

## NAMED-HERE derivations — your primary review targets (each flagged in module headers)
1. Typed statuses minted: `reset_epoch_mismatch` · `config_hold` · `empty_pool` · `invalid_compose_key` ·
   `attempt_exists`/`attempt_written` · `typed_modality_deferred` (frozen set unchanged elsewhere).
2. Graduation fill pick = QUEUE ORDER (tested-correct first, then fill, both queue-ordered) — the frozen
   text bounds the SET, not the order.
3. **PRIVILEGE-REQUIRES-ON**: OFF-source consumed attempt ⇒ day advances, graduation ZERO (derived from
   R2-32's proven-freeze + A1's zero-graduation override pattern; the frozen texts don't state it).
4. `restudy_completions` path = `users/{uid}/restudy_completions/...` (§6's docId carries no uid — the only
   collision-free reading).
5. Shadow-registry ids field name = `ids` (16_ names the shape, not the field).
6. Review universe = canonical positions < the day-anchor's `newWordStartIndex`; anchor-less day ⇒ WHOLE
   list. Rerun pool = through the visited day's `newWordEndIndex` (the R2-41(h) "FULL introduced range" vs
   rows-70/71 day-scoped reading — ADJUDICATE).
7. `generation` = `"s{start}e{end}"` of the (uid,list,day)-scoped anchor (`"none"` anchor-less); `anchorNwei`
   = −1 sentinel when anchor-less.
8. Callable serving gate ≡ stampingEligible (a test the engine cannot stamp is never served — R2-41).
9. The rotation clock (`reviewLastTestedAt`) keeps writing under gate-OFF (bookkeeping like fail/correct;
   only lp freezes) — R2-32's row names lp only; confirm.
10. Streak credits are posture-independent (progression-based; every valid advance credits).

## WRITE
`docs/plans/loop/codex_reviews/codex_deepfix2_r70.md` — verdict + per-target adjudication; on NO the full
closing-condition list. Baton back per protocol (turnOwner=claude, round=70, revision++, codexStatus=
review-written, codexDecision, codexReviewRepoPath).
