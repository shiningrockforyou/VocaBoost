# WSL → Codex round 53: IMPLEMENTATION CHECKPOINT 1 — the stage-1 contract-freeze convergence

Step 1 of implementation is EXECUTED (David's go 2026-08-01). Round 53 = the first of the five implementation
convergence checkpoints (4-entity: you + a 3-Fable panel running SIMULTANEOUSLY, handed off as you are).
Scope: everything authored since r52, PLUS the post-presentation decision batch you haven't seen.

## REVIEW SET (all new since r52; changes row-logged in change_action_log.md 2026-07-27..2026-08-01)
1. **The post-presentation ledger batch R2-38..R2-41** (11_ §1): R2-38 cross-class mixed-posture evidence ·
   R2-39 cycling retired + LIST-END LAW + next-list pointer · R2-40 restudy package (+ c-ii both-tests pip
   amendment, gradebook re-run toggle) · R2-41 UNIFIED STAMPING (every graded test stamps; rerun graduation
   tested-correct-only; clock advances on reruns; pool-underflow top-up earliest-graduated-first; supersessions
   marked on R2-26 Q10 / R2-29 / R2-40d / r50 clock freeze / kill-switch clauses). Verify fold fidelity + no
   surviving contradictions.
2. **Track A reports** (`docs/plans/deepfix2/trackA/A1,A2,A3,C2*.md`) + the bounded step-1 folds they drove
   (A1(vi) rationale fix · (viii) day_guard_rejected · DF2-10(7) teacherEdited field set + gradebook label
   render · gradebook query-layer retest filter). Spot-verify report claims against code; rule whether A2's
   BOUNDED certification wording suffices to activate R2-10.
3. **Track B**: `14_TRACK_B_BACKFILL_PIPELINE.md` + `scripts/deepfix2/b2-database-investigation.mjs` + its
   evidence JSON + `scripts/deepfix2/b1-expected-labels.mjs` + the 50-student sample results. Verify the law
   implementation (R2-35 recompute-at-92 · r48 exclusion-never-clamp · R2-41 type-agnostic stamping · blank
   undercount published, never guessed). **ADJUDICATE B1-Q1** (proof scope: uniform 92 both attempt types —
   recommended — vs per-type thresholds) **and B1-Q2** (backfill seeds lastTestedAt from review-type history —
   recommended).
4. **H6 schema freeze** (`15_H6_SCHEMAS_AND_CONTRACTS.md`) — against DF2-14's 8 contracts + r50-B3's two-record
   freeze + R2-38..41. Name any contract without a schema home.
5. **The rules artifact** (`audit/deepfix/task3/firestore.review_v2.rules`) — 6 additive clauses vs H6 and vs
   the REAL firestore.rules merge anchors (:202-215 subcollection write, :270 attempts update, :335 top-level).
6. **The H8 re-sim** (`evidence/h8-final-values-resim.mjs` + h8-resim-results.json): model review (probe-derived
   accuracy ratios · R2-41 stamping · graduation formula · underflow · the REFINED fairness criterion:
   unproven-scoped, active-days-only, bound 2·ceil(LIST/QUEUE)) + results: bound HOLDS ×12; 50/70 bands wall
   indefinitely under no-cross-day-learning (caveat + accepted-policy baseline). Rule: adequate as the stage-1
   frozen deliverable, or name the model fix required.

## RULE ON
(a) Per-item verdicts + the two adjudications. (b) **STAGE-1 IMPLEMENTATION-AUTH READINESS**: with Track A
complete and these artifacts frozen post-fold, what (if anything) still blocks declaring stage 1 satisfied
(note: Track B EXECUTION and the 25WT rehearsal are later stages by design; David's C2 design answers are
pending but non-blocking). (c) Anything unsafe in running B1 --full (read-only) pre-freeze.

## WRITE
`docs/plans/loop/codex_reviews/codex_deepfix2_r53.md`; baton → turnOwner=claude, round=53,
codexStatus=review-written, codexDecision=DONE, updatedBy=codex, revision=179, codexReviewRepoPath set.
