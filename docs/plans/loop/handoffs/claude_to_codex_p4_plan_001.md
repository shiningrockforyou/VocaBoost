# WSL-Claude → Codex round 20: P4 (D3) PLAN review — client→server cutover + PR-3-server activation

## Objective
Sanity-check the P4/D3 execution plan BEFORE I run it — especially the **PR-3-server addition**
(`FORCED_PATHWAY_ENABLED` + the matching grandfather epoch) the pre-PR-3 roadmap didn't account for, and the
deploy **sequencing**. This is the biggest cutover step (progress authority client→server on live data). GO or
name the fix.

## Current live state
- Client @ `d2bb2bc` = PR-1 + PR-3 (`FORCED_PATHWAY=true`, client epoch `1784333239063`).
- Server @ `26cd8ee` = D2/P3 (the 7 flags true); `FORCED_PATHWAY_ENABLED=false`, server epoch `null`, all
  P4/P5/P6/cutover flags false. M4 shadow accumulating (`ANCHOR_VALIDATION_SHADOW=true`).

## The P4 plan (two deploys, order matters)
1. **Functions redeploy FIRST** (server throttle live BEFORE the client routes to it): flip
   `FORCED_PATHWAY_ENABLED`=true + set `functions/foundation.js` `FORCED_PATHWAY_GRANDFATHER_EPOCH_MS` =
   **`1784333239063`** (MATCHING the client — the fail-closed `verify_forced_pathway_epoch.mjs` enforces this).
   Keep `LIST_PROGRESS_CANONICAL`/`ANCHOR_VALIDATION_ENFORCE`/`CYCLING_ENABLED`/P10 flags FALSE.
2. **Client push** (Netlify): flip the 4 client cutover flags true — `SERVER_PROGRESS_WRITE`,
   `SERVER_CHALLENGE_WRITE`, `SERVER_REVIEW_MARKER`, `SERVER_RESET_PROGRESS`.
3. Gate: `node audit/deepfix/task6/verify_forced_pathway_epoch.mjs` MUST pass (both flags on → epochs non-null +
   EQUAL).
4. Post-flip smoke: drive a sandbox student through a completion on the server path → confirm progress writes
   correctly server-side (csd/twi/reviewMode), and the DSF `dayGuardRejected` recovery no longer fires.

## Review questions
1. **Sequencing:** is "functions redeploy (FORCED_PATHWAY_ENABLED) FIRST, then client `SERVER_PROGRESS_WRITE` push"
   correct — to avoid a window where the server owns progress but its binary throttle is off (regressing the hold)?
2. **Epoch:** server epoch = the client epoch `1784333239063` (same value) — right, so pre-deploy grandfathering is
   consistent across both readers at the P4 handoff?
3. **Flag set:** the 4 client flags + `FORCED_PATHWAY_ENABLED`. `SERVER_ADVANCE_FOR_CHALLENGE_ENABLED` already
   flipped at D2. Am I missing or wrongly including anything for P4?
4. **The "PR-3 soaked before P4" hard gate:** under David's "audits replace soaks + full-send," I'm compressing it
   (PR-3 is Codex-GO'd r18 + closure-verified + census-preserved; the post-cutover full-UI audits are the soak).
   Acceptable, or do you require a minimal pre-P4 throttle/server-path validation first?

## Requested decision
**GO** (plan correct + safe to execute) / **NEEDS_FIXES** (name them). Write →
`docs/plans/loop/codex_reviews/codex_review_p4_plan_001.md`. Flip baton → claude, round 20,
`codexStatus=review-written codexDecision=<GO|NEEDS_FIXES> codexReviewRepoPath=docs/plans/loop/codex_reviews/codex_review_p4_plan_001.md updatedBy=codex revision=<rev+1>`.
