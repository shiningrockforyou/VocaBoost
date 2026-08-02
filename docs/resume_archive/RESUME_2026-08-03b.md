# RESUME — DEEPFIX2: STAGE-2 CHECKPOINT CONVERGENCE (r73 fold pending, 2026-08-03)

## Where we are
Dark build + r70/r71/r72 folds DONE (lap: 174/174 over the callable boundary; receipt binds 16 files).
Reviews: r70 double-NO → r71 double-NO → r72 Codex NO (C4 ✅ C6 ✅; six surgical remainders below) +
**Opus r72 verdict PENDING (workflow w16bgrss2 — check its output/panel_r72_opus.md FIRST on resume)**.
Git: c7abf0a pushed; WinClaude ORDER 84-1 (the r72 fold commit) in flight — check win baton (rev 159+).
Codex baton: revision 217, turnOwner=claude, review at codex_reviews/codex_deepfix2_r72.md.

## r73 CODE ITEMS: ✅ ALL LANDED (2026-08-03, node --check green throughout):
completedTwi absolute-copy + catch-up ENABLED (R2-51 ratified) · teacherEdited ⇒ zero-grad · new-test
r48 fence · assignment CONTAINER hold · live-review queue REQUIRED · live-new submit frontier re-bind +
unclaimed-replay re-bind · C7 windowRunId stamping + run-quarantine · grading_jobs (uid,status) index
ADDED to firestore.indexes.json · 17_DEPLOY_ORDER_REQUIREMENTS.md CREATED (H-A card/N-1/sizing/flip
steps) · N-1 positionGap ops WARNING · L-2 comment fixed.

## REMAINING (the continuation executes NEXT — nothing else pending):
1. LAP fixtures: queue_invalid (strip queueRef) · teacherEdited zero-grad · impossible new-test score ·
   C7 run isolation (same-gen row, runId "other" ⇒ quarantined; note rows now need windowRunId stamped
   to be CONSUMED during windows — existing CASE G expectations may shift: rows written by
   recordOpsMetric DURING the window carry the runId (cache! _resetRegistryCacheForTests + re-read after
   window creation), manually-planted rows without windowRunId ⇒ quarantined — ADJUST CASE G counts) ·
   H-A interlock (bump csd ⇒ completeDay day_guard) · position-gap warning fixture (seed 0,1,3) ·
   completion negatives via WRAPPED reviewV2CompleteDay · v3 relabel (header + version:3).
2. Run the lap (RUNBOOK in the lap header; expect CASE G count shifts from run-binding).
3. Close-out: change_action_log row · r73 handoff (Codex judges its r72 remainder; note the C4 packet
   correction "state-law parity"; David receipts R2-51 + reset timing already in 15_ §3b) · codex baton
   rev 218/round 73 (marker last, file-read verify, sync) · Opus lane workflow (judge its r72 unmet #2/
   #9/#10 + N-1/N-3/L-2/v3) · WinClaude ORDER 85-1 (commit: reviewV2 4 files + firestore.indexes.json +
   17_ NEW + lap + receipt + 15_ + logs).

## THE r73 FOLD LIST (reference — executed above) (Codex r72 — execute after Opus r72 returns, fold BOTH):
1. C1.1: gate the H-B view catch-up behind `R2_51_VIEW_CATCHUP=false` const (David-pending ratification;
   emulator-env override like RESET_V2_FOR_TEST) — loser law pure read-only until ratified. ALSO add
   `completedTwi` (winner's post-advance twi) to the completion record; catch-up (when enabled) COPIES it
   absolute, never re-derives.
2. C1.2: `consumed.teacherEdited === true` ⇒ graduation ZERO (A1: one advance + zero graduation) + fixture.
3. C1.3: the new-test attempt gets the SAME r48 validity fence (integer score 0-100, totals/rows agreement,
   score↔rows recompute, passed↔gatePosture-threshold w/ teacherEdited exempt) + fixture.
4. C2: frontier re-bind at BOTH remaining crossings: (a) submit txn for live-new attempts (isNewSession &&
   !isRerun ⇒ truth read, day ≠ frontier ⇒ day_guard_rejected); (b) registry replay of an UNCLAIMED
   live-new presentation ⇒ same re-bind (claimed replays stay pure §8). + race fixture.
5. C3: assignment CONTAINER shape — asg present but not a plain object (true/7/"assigned"/[]) ⇒ HOLD
   (config.js derivation; Codex reproduced all four) + fixtures.
6. C5: live review REQUIRES a queue — submit: `isReviewType && !isRerun && !p.queueRef ⇒ queue_invalid`
   + missing-queueRef fixture.
7. C7: window RUN binding — the registry cache view captures the window doc (loadShadowRegistry already
   sweeps the collection; stop skipping "window", expose {windowRunId}); recordOpsMetric stamps
   `windowRunId`; classifyRows during a window quarantines rows whose windowRunId ≠ window.runId (null
   incl.); fixture: same-generation row with runId "other" ⇒ quarantined.
8. C8: completion negatives (wrong-day/rerun-as-new/cross-epoch/impossible/foreign-claim) via the WRAPPED
   reviewV2CompleteDay; un-enroll ALSO via wrapped (permission-denied) alongside the txn-typed; new
   fixtures: teacherEdited-zero-grad, impossible new-test, missing-queueRef, run isolation; relabel lap
   v3 (header + summary version:3). Rerun lap ⇒ re-bind receipt.
9. Handoff corrections: C4 "byte-preserved" ⇒ "state-law parity" (response fields differ: resetV2/
   targetEpoch/rv2Deleted/jobsCancelled).
10. OPUS r72 ADDS (verdict NO, 9/12 met — panel_r72_opus.md):
    (a) H-A: durable home + fixture — create docs/plans/deepfix2/17_DEPLOY_ORDER_REQUIREMENTS.md
        (H-A field-freeze card · CC-14 compose sizing · RESET_V2 flip step · the INDEX below); interlock
        fixture: bump csd directly (simulated legacy advance) ⇒ completeDay day_guard_rejected; after an
        engine completion assert csd moved (the legacy day-guard's own reject basis).
    (b) N-3 (MY FALSE CLAIM): firestore.indexes.json has NO grading_jobs index — ADD the (uid ASC,
        status ASC) composite (deploys with the dark train; the reset job-cancel query needs it).
    (c) queue_invalid fixture (same as Codex C5 item) — strip queueRef, assert typed refusal.
    (d) N-1 (HIGH): ordinal twi vs the positional CS anchor law (twi = nwei+1) — record in 15_ that
        ENGINE twi = ordinal count over canonical order (exact ≡ positional on contiguous lists);
        loadCanonicalWordsStrict EMITS a position_gap ops WARNING row (no refusal) so gapped lists
        surface to CS; + a gap fixture (seed positions 0,1,3).
    (e) L-2: fix the stale callables.js:262-264 comment (claims preflight-only bind; code binds in-txn).
    (f) Relabel the lap v3 everywhere (header, summary version:3, log label).
11. (fold together, ONE r73 round: handoff → codex baton rev 218/round 73 →
    Opus lane workflow → WinClaude ORDER 85-1).

## r75 SEED (Codex r74 NO — 5 items; build the FULL ledger when Opus r74 lands, from BOTH files):
1. REVERT composer resetLockActive to fail-closed on ANY lock (my N-2 fix was the wrong branch — a
   crashed reset leaves a partially-deleted graph; §9's law: writes rejected until TAKEOVER completes
   cleanup). Publish-side already exists (SUPPORT_RUNBOOK CS repair). Replace the 11-min SERVES fixture
   with THE SEQUENCE: stale lock ⇒ engine REFUSES ⇒ resetProgress takeover (RESET_V2_FOR_TEST) re-fences
   + cleans + owner-clears ⇒ engine SERVES.
2. Scope the new-test rows/posture fences INSIDE the engine (epoch-present) branch — legacy epoch-less
   new attempts keep identity/day/pass only (published; legacy MCQ stored answered-rows-only vs
   totalQuestions-with-skips ⇒ the row-count rule is engine-only, publish the decision). Engine posture:
   configVersion ≥ 1 + non-empty source. Fixtures: epoch-less posture-free ACCEPTED; configVersion 0
   refused; missing source refused.
3. Validate the PARENT assignments container (plain map) before lookup (array-indexed-by-"0" repro).
   Fixtures: parent array/Timestamp + entry GeoPoint (the loop lacked GeoPoint despite the claim).
4. The unassignment race through the WRAPPED callable via the afterPreflight hook (mirror un-enroll).
5. Sweep evidence: list-position-sweep emits a committed receipt (projectId/time/counts/script sha16;
   re-run); CORRECT the inverted reindex card (deleteWord does NOT renumber — it just deletes;
   addWordToList appends at decremented count ⇒ position REUSE after middle deletion; fix NEED_TO_FIX +
   17_ §5 text; repair choice: allocate max(position)+1).
+ Opus r74 items when they land. Calibration: #1 = real design catch on NEW code (bucket 1); #2-#4
  incomplete-fold (bucket 2); #5 evidence-quality. NOT over-audit yet.

## r74 LEDGER (executed): /tmp/claude-1000/-app/87eba36e-8e66-4638-bae9-6cd6f923fff6/scratchpad/r74-fold-ledger.md
(implement row-by-row, mark file:line per row, separate verify pass, explicit deferrals). A PERPETUAL
round-agnostic baton watcher runs (scratchpad/baton-watcher.sh — relaunch FIRST THING each wake).

## r74 FOLD — THE MANDATORY PROCESS (fold-ledger discipline, David-directed):
1. READ IN FULL (never notifications): docs/plans/loop/fable_panels/panel_r72_opus.md AND
   panel_r73_opus.md AND codex_reviews/codex_deepfix2_r73.md. The r72/r73 folds MISSED Opus items
   hidden below a notification truncation (N-2 composer takeover-window, N-5 evidence discriminator,
   N-6 list sweep/duplicate ruling, L-1 lastStudyDate, L-4 pace comment, exact fixture names).
2. BUILD THE FOLD LEDGER first (scratchpad file): one row per atomic clause + one row per demanded
   fixture, from ALL THREE documents. Codex r73: C1 new-test posture REQUIRED+validated for engine legs
   (not conditional) · C3 plain-map check (Timestamp/GeoPoint refused — prototype/constructor check) ·
   C8 (races through the WRAPPED callable via an emulator-only afterPreflight test hook · stale-replay +
   submit-frontier fixtures · malformed-new-posture fixture · container fixtures in CASE A · H-B fixture
   must DISCRIMINATE absolute-copy vs derive [distinct twi seed] · reset.js:17 false comment · 15_ §3b
   schema += wordsIntroduced/completedTwi · baton wslNote refresh). Opus r73: its full closing list from
   the panel file + N-7 (17_ "vice versa — fixtured" FALSE — fix the claim or build the fixture) ·
   N-8 (=Codex H-B point) · N-9 (run-binding ≤60s blackout at window open — design note/mitigation:
   the window writer could pre-warm caches or the evaluator tolerates the TTL edge; adjudicate) ·
   N-2/N-5/N-6/L-1/L-4 from the panel.
3. Implement per row (file:line noted) → SEPARATE verification pass (diff + lap assertion per row) →
   only then claims/handoff. Run the lap. r74 handoff cites the ledger.

## DAVID RULINGS (2026-08-03, this session — receipts in 15_ §3b):
- R2-51 RATIFIED by principle ("progress should be intrinsic to students only..."): r73 fold ENABLES the
  view catch-up (no gating const needed — Codex C1.1's procedural objection is answered by ratification;
  still add `completedTwi` absolute-copy).
- RESET_V2 flip timing: the sandbox-rehearsal phase, at convenience (already the 17_ card's plan).

## Standing state (unchanged)
RESET_V2_ENABLED=false gate (David's const; escalation answered) · R2-51 view catch-up PROPOSED
(David ratification pending, 15_ §3b) · roster: checkpoints = Codex + 1 Opus xhigh via Workflow ·
no-folds-while-measuring · zero git during win turns (verify by file reads) · codex flips: revision++ +
full marker schema, marker last, sync first · lap runbook in engine-emulator-lap.mjs header ·
RESET_V2_FOR_TEST=1 arms the reset lap case. Process laws + memory pointers: see memory/MEMORY.md.

## After a double-YES at r72/r73
WinClaude DARK-DEPLOY ORDER SERIES (zero-delta: RESET_V2 false; deploy-order requirements in the r72
handoff tail) → 25WT rehearsal (client legs DF2-51 build next) → shadow audit (16_) → David's backfill
go → David's flip (both exclusively David's).
