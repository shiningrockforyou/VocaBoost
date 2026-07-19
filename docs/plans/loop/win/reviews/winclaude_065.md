# WINCLAUDE round 65 — weekly challenge-token reset: VERIFY → COMMIT → PUSH → DEPLOY (fn + client) — ✅ DEPLOYED

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`. **taskId:** `TOKEN_WEEKLY_DEPLOY` · **execDecision:** `DEPLOYED`. David-directed, before-noon. No 26SM data writes (the reset is pure read-time code — that's the design).

---

## Pre-flight safety
The 5 code files were the only src/functions changes (verified — no other src/ or functions/ modified). `functions/index.js` diff is confined to `availableChallengeTokens` + the new `startOfKstWeekMs` helper (hunk at line ~658, after `markReviewComplete`); it does **not** touch `completeSession`/`resolveListProgress`/`gradeTypedTest`. Server + client `startOfKstWeekMs` are byte-identical (fixed +540min KST, `WEEKLY_RESET_HOUR_KST=4`).

## STEP 1 — gate: **ALL PASS: 16 passed, 0 failed** (`node scripts/challenge-token-kst-test.mjs`, deterministic).

## STEP 2 — commit + push
Staged exactly the 6 files (5 code + change_action_log.md; verified `git diff --cached --stat`; no secrets). Commit **`6094cdd`**: *"feat(tokens): weekly challenge-token reset (Mon 04:00 KST) via read-time week window"*. Pushed **`0992f5f..6094cdd main -> main`**.
> *Transparency: change_action_log carried 2 additional recent-work entries WSL had written (r63 grader-DEPLOYED note, r64 yyj grader-investigation tooling) alongside the token entry — docs only, rode along; benign.*

## STEP 3 — deploy functions (surgical)
`firebase deploy --only functions:submitChallenge` → **"Successful update operation" / Deploy complete!** — **only `submitChallenge(us-central1)` updated** (build sha `6094cdd`). The pinned cutover functions (`completeSession`/`resolveListProgress` @ `0ddbb34`) and `gradeTypedTest` (@ `0992f5f`) were **not** re-stamped.

## STEP 4 — client build + hosting
- `npm run build` → **`✓ built in 11.48s`**, clean (only the standard pre-existing "chunks >500 kB" bundle-size advisory — not an error; did not deploy a broken bundle).
- `firebase deploy --only hosting` → **"release complete" / Deploy complete!** (vocaboost-879c2.web.app).
- **Two-surface note:** the git push to `main` (`6094cdd`) also triggers the **Netlify** auto-build of `vocaboostone.netlify.app` (the URL the D3.5 audit used; no `[skip netlify]` on this commit). So both student-facing surfaces receive the token change, and both call the same surgically-updated `submitChallenge` backend. STEP 3 + 4 ran back-to-back (functions deploy finished, hosting deployed within seconds) to keep the client/server token-count window tight.

## STEP 5 — result
- **Deployed SHA: `6094cdd`** (functions:submitChallenge + Firebase hosting; Netlify auto-deploying the same from the push).
- **Deployed state now:** `submitChallenge` @ `6094cdd` · `gradeTypedTest` @ `0992f5f` · `completeSession`/`resolveListProgress` @ `0ddbb34` (pinned) · Firebase hosting @ `6094cdd` · Netlify (vocaboostone) auto-building `6094cdd`.
- **Behavior:** challenge tokens now reset weekly at **Monday 04:00 KST** (was 30-day/`replenishAt`), computed read-time — no cron, no data write. UI copy updated "for 30 days" → "until the weekly reset (Mon)".

## Verification timing
The first reset fires at **Mon 04:00 KST today (2026-07-20)** — students hold current counts until then, so a live token-count verification is only meaningful **after 04:00 KST** (not now). The unit-test gate (16/16) already proves the boundary math deterministically. Suggest a post-04:00 spot-check of a real student's `availableChallengeTokens` if WSL/David want live confirmation.

## Hand back
`baton.json` → `turnOwner=claude round=65 taskId=TOKEN_WEEKLY_DEPLOY execStatus=review-written execDecision=DEPLOYED updatedBy=winclaude revision=130`. Watcher re-armed at baseline 130.
