# WSL → Codex round 54: CHECKPOINT-1 CLOSURE VERIFICATION — your r53 blockers are executed

The r53 correction fold is COMPLETE (same day; every batch row-logged in `change_action_log.md` 2026-08-01).
Round 54 = verify closure of YOUR four blockers + the panel's convergent findings, then re-rule stage-1
readiness. A 3-Fable closure panel runs simultaneously (handed off as the agents launch).

## CLOSURES (verify each against the actual files)
1. **R53-B1** → `scripts/deepfix2/b2-database-investigation.mjs` v2 (real tombstones `progress_meta/{listId}` +
   `list_progress/{listId}`; epochMarkersSeen; GLOBAL volume labels) + `b1-expected-labels.mjs` v2: per-word
   five-field JSONL baseline + per-student digests + watermark + per-(uid,list) epoch snapshot; **STORED-score≥92**
   (B1-Q3 — rows fence, never replace); fail-closed eligibility fence (8 named exclusion classes incl. preEpoch);
   whole-group conflicting-dup exclusion (order-independent) + identical-dup counts; per-class exclusion maps;
   named-flag CLI. Sample rerun published (`evidence/b1-expected-labels-sample.{json,jsonl}`): 138 identical dups
   caught; 30,180 words; proven 85.7%.
2. **R53-B2** → `15_H6_SCHEMAS_AND_CONTRACTS.md` v2: §3b `day_completions` exactly-once CAS record (class-agnostic
   docId = the shared logical day; consumed-attempt + sourceConfig audit; graduation moves into this txn; streak
   same-txn); composeKey presentation replay + queue `presentationCount`; rerun presentation identity
   (visited-day, introduced-range hash); `gatePosture` stamp on EVERY attempt + writeContext mirror;
   `minClientVersion` + frozen `client_version_stale`; restudy pairing state (pendingHalf/consumedAttemptIds/
   visitId); reset-reach fields + bookmark delete + the (uid,status) index; §10 pool-input authority disposition
   (DF2-46-carded narrowing behind the min-version fence).
3. **R53-B3** → rules artifact v2: **the clock RENAMED `reviewLastTestedAt`** (all five guarded fields are NEW ⇒
   truly inert; legacy `lastTestedAt` untouched until DF2-46); op-split create/update/delete merged text;
   live-production deploy-base law (re-derive against the then-live base); attempts clause corrected (already
   server-owned; conditional guard for pre-P10 bases); grading_jobs owner-read posture corrected; 9-case frozen
   emulator matrix. The rename is folded through H6/14_/10_/02 (contract (4), tie-break, scope).
4. **R53-B4** → H8 v2: B1-seeded scenario (file actually read); pinned queue across walled calendar days;
   censored/never-seen words counted; structural out-of-queue reported separately (walled runs ⇒ fairness N/A,
   honest); measured per-band accuracy table (probe perStudent rebuild, all cells n>400) + probe-semantics
   mapping + caveats block; widened timestamp slots; DAILY_ATTEMPTS behavioral rename; 3 seeds; size-change
   scenario + config-aware bound. Result: bound HOLDS on every advancing run; walled bands honestly N/A.
5. **Track A folds**: override-then-real-pass = ONE advance + ZERO graduation + no-client-graduation-on-
   `already_completed` (02); A2 row carries the r53 R2-10 deferral conditions (11_); CERT cycling residue →
   list-end + nextListId; queueSize_effective defined as post-top-up pinned length; ranges → R2-1..R2-41.
6. **Adjudications applied**: B1-Q1 uniform-92 (your ruling) · B1-Q2 review-type seed + null⇒not-written ·
   B1-Q3 stored-score letter.

## OPEN — NOT blockers for this round (owner questions, queued to David)
Q-D1 fairness mechanism (deterministic remainder vs probabilistic SLO — H8 v2 measures the tail either way) ·
Q-D2 MASTERED→PASSED challenge edge · C2's two UI layout calls. Rule whether any of these actually BLOCKS
stage-1 implementation auth or can ride to the David batch.

## RULE ON
(a) Each closure: closed / partial / miss (file+line). (b) **STAGE-1 IMPLEMENTATION-AUTH: ready, or name the
exact residue.** (c) Is B1 --full (read-only, JSONL) now safe to run for the real baseline?

## WRITE
`docs/plans/loop/codex_reviews/codex_deepfix2_r54.md`; baton → turnOwner=claude, round=54,
codexStatus=review-written, codexDecision=DONE, updatedBy=codex, revision=181, codexReviewRepoPath set.
