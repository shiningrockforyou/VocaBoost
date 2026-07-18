# WINCLAUDE round 35 — D2/P3 ACTIVATION (functions deploy) — ✅ DEPLOYED

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `WINCLAUDE_D2_P3_ACTIVATION`
- **handoff:** `docs/plans/loop/win/handoffs/claude_to_winclaude_035.md`
- **execDecision:** `DEPLOYED` — the **first server activation** is LIVE. Commit `26cd8ee` on `main`, pushed, `firebase deploy --only functions` succeeded (18 functions), flag posture verified EXACT.
- **auth:** David confirmed directly (present) → *"Go. I already gave you authorization… WSL Claude is basically my authorization to you."* D1 waiver accepted; full-send cutover authorized.

---

## ✅ Deploy result
- **Commit (on `main`, no branch):** `26cd8ee` — *"D2/P3: activate deepfix server surface + PR-2 stamp/clamp + start M4 shadow (flip 7 foundation flags)"* (+ Co-Authored-By). **Staged ONLY `functions/`** (`functions/foundation.js` + `functions/index.js`, 425 insertions / 22 deletions = PR-2-core + PR-3-server fold + the 7 flips). Client PR-3 diff + docs left **uncommitted**, as instructed.
- **Push:** `59df732..26cd8ee  main -> main` (origin/main == 26cd8ee).
- **Functions deploy:** `firebase deploy --only functions` (project `vocaboost-879c2`) → **Deploy complete!** All 18 functions `Successful update operation` (completeSession, resolveListProgress, resetProgress, advanceForChallenge, reviewChallenge, overrideAttempt, markReviewComplete, submitTest, gradeTypedTest, version, …).

## ✅ Verification (VERBATIM)
- **(b) DG-2 authenticated `version` posture — `POSTURE_OK=true`, deployed sha `26cd8ee`:**
  - The **7 flipped `true`:** `SERVER_COMPLETE_SESSION_ENABLED`, `SERVER_RESOLVE_LIST_PROGRESS_ENABLED`, `SERVER_RESET_PROGRESS_ENABLED`, `SERVER_ADVANCE_FOR_CHALLENGE_ENABLED`, `ANCHOR_VALIDATION_SHADOW` (M4 shadow clock started), `REVIEW_ENGAGEMENT_STAMP_ENABLED` (PR-2 stamp live), `RECOVERY_SCORE_CLAMP_ENABLED` (PR-2 >100% clamp live).
  - **Must-stay-false — all `false`:** `LIST_PROGRESS_CANONICAL`, `ANCHOR_VALIDATION_ENFORCE`, `CYCLING_ENABLED`, `FORCED_PATHWAY_ENABLED`, `SERVER_REVIEW_CHALLENGE_ENABLED`, `SERVER_OVERRIDE_ENABLED`, `TEACHER_IDS_WRITE_ENABLED`, `GRADE_TOKEN_ENFORCED`, `GRADE_TOKEN_MINT`, `TEACHER_PROVISIONING_ENABLED`, `TEACHER_CLAIM_ENABLED`. (`trueMissing=[]`, `falseViolations=[]`.)
- **(a) prod `completeSession` unauth probe:** HTTP **401 UNAUTHENTICATED** — `stillDisarmed=false` (no longer the `SERVER_COMPLETE_SESSION_ENABLED=false` FAILED_PRECONDITION disarm). Consistent with activation; (b) is the definitive posture proof.
- Evidence: `audit/playwright/findings/deepfix_d2_verify_r35.json`; deploy log `audit/deepfix/task6/` (foreground capture).
- Note: `version` reports `dirty:true` — expected, the tree carries uncommitted client PR-3 (dormant). The activation sha `26cd8ee` is the committed functions.

## Pre-deploy safety (done)
- `node --check functions/foundation.js && node --check functions/index.js` → both OK.
- Flipped EXACTLY the 7 by name (grep-verified before & after); confirmed the must-stay-false set unchanged; **no client flag touched** (functions-only).
- `git add functions/` verified to stage ONLY the 2 functions files (client PR-3 + docs confirmed unstaged).

## Reversibility
Reversible: flip the 7 back in `functions/foundation.js` + redeploy. NO data writes, NO 26SM mutation this round.

## Coordination
The parallel PR-3 `FORCED_PATHWAY` build's client diff (`src/**` + `forcedPathway.js`) remains uncommitted in the shared tree (its server leg in `foundation.js` was folded into THIS commit but stays dormant: `FORCED_PATHWAY_ENABLED=false`). Untouched by me beyond the folded-and-committed `functions/` server code.

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_035.md`.
- `baton.json` → `turnOwner="claude"`, `round=35`, `execStatus="run-written"`, `execDecision="DEPLOYED"`, `updatedBy="winclaude"`, `revision=70`.
- Watcher re-armed at baseline 70. Ready for the next cutover step (P4 client flips + push, or whatever WSL scopes) — proceeding autonomously per David's full-send.
