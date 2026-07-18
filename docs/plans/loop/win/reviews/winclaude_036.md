# WINCLAUDE round 36 — FLIP PR-3 LIVE (forced-pathway binary throttle, client) — ✅ DEPLOYED

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `WINCLAUDE_PR3_FLIP`
- **handoff:** `docs/plans/loop/win/handoffs/claude_to_winclaude_036.md`
- **execDecision:** `DEPLOYED` — the client forced-pathway binary throttle is LIVE. Commit `d2bb2bc` on `main`, pushed, Netlify build verified (`d2bb2bc`, `dirty:false`, app loads clean). Server leg stays dormant (`FORCED_PATHWAY_ENABLED=false`) until P4.
- **auth:** David full-send (WSL = his authorization; proceed without asking/flagging).

---

## ✅ Gate + deploy
- **MANDATORY epoch gate (Codex r18): PASS (exit 0)** — `FORCED_PATHWAY(client)=true`, `FORCED_PATHWAY_ENABLED(server)=false`, client grandfather epoch `1784333239063` (non-null), server epoch `null` (OK — server dormant). `✅ EPOCH GATE: PASS`.
  - **Harness fix applied to run the gate here:** `audit/deepfix/task6/verify_forced_pathway_epoch.mjs` hardcoded the WSL path `/app/…` (→ `c:\app\…` ENOENT on native Windows). Replaced with a repo-relative resolve (`fileURLToPath`/`resolve(REPO,…)`). **Gate LOGIC untouched** — only the file path. Same class as the r16 sha fix / round-3 M-UI path fix.
- **`functions/` clean** — no uncommitted changes (already committed + deployed at D2/`26cd8ee`).
- **Commit (on `main`, no branch):** `d2bb2bc` — *"CS PR-3: activate forced-pathway binary throttle (client) — FORCED_PATHWAY=true + grandfather epoch 1784333239063"* (+ Co-Authored-By). `git add -A` swept the client PR-3 source (`featureFlags.js` `FORCED_PATHWAY=true`, `forcedPathway.js` epoch, `MCQTest/TypedTest/progressService/studyService`) + the accumulated audit/docs (65 files), per the handoff. **No secrets staged** (`.env`/`.env.local`/`.lsr_secret.json`/`serviceAccountKey.json` confirmed gitignored; final staged-secret grep clean).
- **Push:** `26cd8ee..d2bb2bc  main -> main`.

## ✅ Verification
- **Build-stamp (prod, browser probe):** `window.__VOCABOOST_BUILD__` = `{shortSha:"d2bb2bc", dirty:false, builtAt:"2026-07-18T00:16:56Z"}` — **matches the flip commit, clean tree**. `STAMP_OK=true`.
- **App loads clean:** `LOADED_CLEAN=true` — zero real console errors on load (benign analytics/favicon/firestore-longpoll-abort noise filtered). The PR-3 client throttle code is wired without breaking the app.
- Evidence: `audit/playwright/findings/deepfix_pr3_buildstamp_r36.json`.

## Post-flip throttle smoke — DEFERRED (per handoff, permitted)
The binary throttle only engages for a student already in throttle/review-mode (reviewMode bit from 3 zero-reviews); seeding that state cleanly in a single pass is impractical, and the old build had `FORCED_PATHWAY=false` so it couldn't be exercised pre-deploy. Per the handoff (*"if seeding is impractical… confirm the deploy is live + the app loads clean… do NOT block the flip on the smoke — it's already Codex-GO'd + closure-verified; the smoke is confirmatory"*), I confirmed **deploy-live (`d2bb2bc`) + clean load** and **defer full throttle-behavior validation** (0-new-words-in-review-mode + hold-csd + good-reviews-escape) to the planned post-cutover full-UI prod audits.

## Reversible
Throttle misbehaves on real UI → flip `FORCED_PATHWAY=false` (featureFlags.js) + push (Netlify rollback) + report. No data writes, no 26SM this round.

## Posture after this round
- **Client:** PR-1 (review-pairing/re-entry/recovery) + PR-3 (forced-pathway binary throttle) LIVE @ `d2bb2bc`.
- **Server (functions @ `26cd8ee`):** D2/P3 surface active (7 flags true); `FORCED_PATHWAY_ENABLED`, `LIST_PROGRESS_CANONICAL`, `ANCHOR_VALIDATION_ENFORCE`, cycling/override/teacher-write all still `false` (P4+).

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_036.md`.
- `baton.json` → `turnOwner="claude"`, `round=36`, `execStatus="run-written"`, `execDecision="DEPLOYED"`, `updatedBy="winclaude"`, `revision=72`.
- Watcher re-armed at baseline 72. Ready for the next cutover step (P4 server client-cutover flips / migration / rules) — proceeding autonomously per David's full-send.
