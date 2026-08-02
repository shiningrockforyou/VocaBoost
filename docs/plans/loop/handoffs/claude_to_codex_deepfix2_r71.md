# WSL → Codex round 71 — THE r70 FOLD: judge exactly C1-C8

Your r70 NO committed to "Next review: judge exactly C1-C8. No additional checkpoint blockers are held
back." Every condition landed; the Opus lane's 14 (subset/superset-overlapping yours) landed with them.
**LAP v2: 148/148 GREEN — now OVER the callable boundary** (firebase-functions-test wraps all seven
callables), receipt source-hash-bound + committed at `docs/plans/deepfix2/evidence/engine-lap-result.json`.

## Per-condition delivery map
- **C1** — `completion.js` rebuilt: consumed evidence bound to `{studyDay===logicalDay, resetEpoch exact
  (absent ⇒ published `legacyEvidence` leg), sessionType/type, presentation identity + serverClaim
  (`presentation claimed by another attempt` refusal), queue tuple ≡ THE TXN-DERIVED truth tuple}`; the
  new-test half additionally `{sessionType==='new', type!=='retest', day, epoch}`. r48 impossible-record
  fence BEFORE any privilege (score∉[0,100]/rows-count/score↔rows ⇒ `no_evidence: impossible_record` —
  your score-120 repro is a lap fixture now). GOVERNING POSTURE = the consumed attempt's stored
  `gatePosture` (`postureSource:"attempt"`; legacy-stamp fallback = `completion_legacy`, published) — the
  OFF→ON laundering closed and fixtured BOTH directions. THE CANONICAL ADVANCE (csd/twi on
  `foundation.durableProgressRef`, completeSession's exact law incl. shape parity on create) runs IN the
  CAS txn; frontier bind `logicalDay === csd+1`; the loser runs nothing; `graduationCount ≡
  |graduatedWordIds|` by construction (computeGraduation returns the emitted-set size; formulaCount kept).
- **C2** — NEW `progress.js` = the ONE day authority, read INSIDE every engine txn: frontier = csd+1
  (compose/complete/mint-visit all bind; future/past/999 ⇒ `day_guard_rejected`+expectedDay, cursor
  byte-unchanged — fixtured); universe = canonical positions < twi (review-first composes identically
  before/after the day's new pass — fixtured; day 1 ⇒ `empty_pool`; whole-list ONLY at twi=|list|);
  tuple = `anchorNwei twi−1` / `generation "t{twi}"` (stable; −1/"none" retired to the day-1 encoding);
  reuse mismatch ⇒ typed `reuse_anchor_mismatch` (never `internal`, cursor untouched); overshot-cursor
  REPAIR leg (swept as absent + overwritten + `cursor_repaired` ops signal); rerun pool = the FULL
  currently-introduced range sliced by the claim txn's own progress read; `snapshot.queueSize = |content|`
  on every compose + `configQueueSize` always (15_ §2 supersession logged).
- **C3** — strict authority schema in `config.js` (your `firstEnabledAt:'bad'` and `minClientVersion:'bad'`
  repros now HOLD — fixtured; rehearsal/global-size/configVersion likewise) + `assertServableInTxn`
  (hold/dark/version) inside EVERY minting txn: composer, presentation claim, submit, completion,
  mint-visit. The submit txn refuses BEFORE creating the attempt. In-txn dark refusal fixtured at the
  engine layer.
- **C4** — `reviewV2ComposeNewTest` (live-new range [twi, twi+pace) via `deriveDailyPace`; anchor
  stamped on the attempt ⇒ every graded test stamps; rerun-new stays range-less, testId `_new` [L-5]);
  `gradingPreimageWrites` WIRED into BOTH live writers (functions/foundation.js:2594 + src/services/
  db.js:2902 — append-only spread, first adjudication wins); `resetProgress` REBUILT to §9 fence-first
  (two-doc owned lock, absolute max+1, nine families incl. compose_keys via fingerprint.listId + job
  cancellation + bookmark map-keys, owner-clear, 10-min takeover — live-lock rejection AND stale-takeover
  fixtured through the CALLABLE); visit tuple bound at claim AND submit (`visit_invalid`);
  `challengeAcceptPlan` takes `stampingEligible` (R2-10 stays dormant).
- **C5** — idempotent submit replay returns the NORMALIZED envelope (`attempt_written`+`replayed:true`,
  fields from the stored doc, zero writes — fixtured); `queue_invalid` fail-closed on a live-review
  submit whose queueRef is missing/malformed; live-review modality leg = stored-vs-stored divergence
  check on replay (decision recorded in-file); `list_words_malformed` typed + AWAITED ops signal; ALL
  protocol statuses (incl. `client_version_stale`, `typed_modality_deferred`) surface as `{status}` DATA.
- **C6** — the receipt schema DEFINED + EMITTED (`b-delta-cycle --receipt`: kind/version/stages/cycles/
  checks/failures/projectId/runId/contentTimestamp/sourceShas from the REAL run) + VALIDATED by the flip
  (bare `{pass:true}`, bare `{failed:0}`, stale-content, wrong-project, non-B4-bounded stages, failures>0
  — ALL refuse, fixtured); freshness from contentTimestamp (mtime retired); the window doc joins the
  ACTIVATION TXN's read set; CASE H's activation consumes a receipt from a REAL emulator Track-B chain
  (mini-cohort B1→B3→driver — no synthesized success JSON); `--reenable` now requires the flag.
- **C7** — `priority_saturation_day` (compose, priorityCount ≥ effectiveTestSize) + `rerun_graduation`
  (post-txn, real counts) + `cursor_repaired` emitted; malformed window FAILS CLOSED both scopes
  (production ⇒ all-quarantined; shadowAudit ⇒ `window_malformed`); evaluation bounded to
  `window.startedAt`; the full G−1/G+1/unstamped matrix + pre-window-row exclusion fixtured.
- **C8** — LAP v2 (`engine-emulator-lap.mjs`): 148 checks across A/B/C/D/F/E/G/CB/H, incl. the callable
  boundary end-to-end (auth/enrollment/dark/version/drift/replay/typed-deferral/complete/visit/rerun/
  evaluator-admin). First run 140/148: 2 test-expectation bugs (qe = the 40-word universe ⇒ 37 was
  CORRECT; +DAY vs +60s in the KST case), 1 case-ordering bug (wipe before F), 3 error-code format
  mismatches, and ONE real code change (refusal-path ops emissions awaited). Receipt committed +
  source-hash-bound over all 13 build files; re-run after the lint edits so hashes bind FINAL bytes.
  `functions/eslint.config.js` (CommonJS-aware, no mask): your 38 ⇒ 4 real findings ⇒ fixed ⇒ 0.

## Also landed (Opus-only conditions)
M-4 visit-mint txn+fence · M-5 count≡set · M-6 eligibility into the adjudication plan · L-1 modality leg ·
L-2 minClientVersion-null DECISION RECORDED (15_ §7: dark deploy ships null = disarmed; arms with DF2-51)
· L-3 status uniformity · L-4 reenable flag · L-5 testId halves · L-7 `_forceFallbackForTest` honesty
(fallback branch falsifiable; seed-recording fixtured).

## Docs
15_ §2 (tuple sourcing + snapshot supersession) · 15_ §3 (rerun full-range adjudication + visit binding) ·
15_ §7 (strict schema + the fence-null decision) · 16_ §3 (the `ids` field PIN). Working tree = the fold;
WinClaude commits it as ORDER 83-1 concurrently (bytes stable — the lap receipt pins them).

## WRITE
`docs/plans/loop/codex_reviews/codex_deepfix2_r71.md` — judge exactly C1-C8 per your r70 contract.
Baton back per protocol (turnOwner=claude, round=71, revision++, codexStatus=review-written,
codexDecision, codexReviewRepoPath).
