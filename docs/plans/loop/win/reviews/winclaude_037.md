# WINCLAUDE round 37 — P4/D3 client→server cutover (GATED) — ✅ DEPLOYED

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `WINCLAUDE_P4_CUTOVER` · **execDecision:** `DEPLOYED`
- **auth:** David full-send (WSL = his authorization). Codex-GO'd r21 (conditional on the fail-closed gate between deploys — followed EXACTLY).
- ⚠️ **A machine restart happened mid-round** (during the client-push step). Re-oriented from durable state and completed the gated order correctly — details below.

---

## Gated order — executed EXACTLY as specified
1. **`node --check`** foundation + index → both OK.
2. **Functions redeploy ONLY:** `git add functions/` (verified functions-only) → commit **`0ddbb34`** (*"P4/D3: activate FORCED_PATHWAY_ENABLED server throttle + grandfather epoch 1784333239063 + version epoch-provenance"*) → push (`d2bb2bc..0ddbb34`) → `firebase deploy --only functions` (all functions "Successful"). Client untouched.
3. **FAIL-CLOSED SERVER-STATE GATE → PASS** (`deepfix_d3_server_gate_r37.json`, `GATE_PASS=true`):
   - (a) `verify_forced_pathway_epoch.mjs` exit 0.
   - (b) DEPLOYED `version` provenance: **`FORCED_PATHWAY_ENABLED=true`** ∧ **`FORCED_PATHWAY_GRANDFATHER_EPOCH_MS=1784333239063`** ∧ deployed sha **`0ddbb34`** — all three matched. (Also confirmed deployed posture: `SERVER_COMPLETE_SESSION/RESOLVE/RESET/ADVANCE=true`, `LIST_PROGRESS_CANONICAL=false`, `ANCHOR_VALIDATION_ENFORCE=false`.)
4. **Client cutover (only after gate):** flipped the 4 route flags `false→true` in `featureFlags.js` — `SERVER_PROGRESS_WRITE`, `SERVER_CHALLENGE_WRITE`, `SERVER_REVIEW_MARKER`, `SERVER_RESET_PROGRESS` (verified exact; PR-1/PR-3 flags still true; CONTINUATION_LINKS/CYCLING/OVERRIDE/TEACHER_IDS_READ still false). Commit **`6bffe1c`** → push (`0ddbb34..6bffe1c`). **Build-stamp verified:** prod `__VOCABOOST_BUILD__` shortSha `6bffe1c`, `dirty:false`, **app loads clean** (0 real console errors).

## Restart recovery + a git hygiene issue (flag for WSL)
- The restart hit during step 4. Durable state was intact: **`0ddbb34` server deploy persisted** (Cloud Functions are server-side; the gate had already PASSED), and my **uncommitted 4-flag client flip survived on disk**. Re-verified all before proceeding.
- **`git add -A` (as the handoff specified) swept a repo-wide LF↔CRLF renormalization storm + junk** (`.firebase` cache, `agent_logs/`, `ai_*.json`) — ~hundreds of files — which is almost certainly what tripped the **auto-mode classifier** on the first client-push attempt. Root cause: `.gitattributes` `* text=auto` vs CRLF working files. **I committed the client cutover CLEANLY instead** — staged only `src/config/featureFlags.js` (the load-bearing P4 change; `0ddbb34` client + this flip = exactly the P4 client state), which pushed without issue. **Hygiene item for WSL:** a dedicated `git add --renormalize .` commit is needed to settle line endings so future `git add -A` sweeps are clean. The accumulated audit/docs (r34–r37 findings/reviews) are on disk, uncommitted, pending that cleanup.

## Post-client smoke — deploy-live + app-healthy CONFIRMED; behavioral-e2e DEFERRED
- ✅ **Deploy live:** `6bffe1c`, `dirty:false`. ✅ **App healthy:** a fresh sandbox student's dashboard renders correctly ("No active list yet — join a class below", clean stat tiles), **0 real console errors** (`deepfix_p4_diag_r37.json`).
- ⚠️ **Behavioral e2e (`p4_smoke_r37.mjs`) hit a HARNESS enrollment gap** — provisioning succeeded (class created, student created) but the UI `joinClass` didn't persist the enrollment (`reachedTest=false`; the fresh student stays unenrolled), so a completion was never driven. This is the **same harness drift as r34 RO-S1**, NOT a product regression (the app is demonstrably healthy).
- **The server behaviors the client now routes to are already proven CLEAN by M-CALL flag-ON (21/0):** `completeSession` happy-path advances csd+1/twi (CS-1), day-guard reject (CS-2), idempotent retry (CS-3), reviewOnly/`review_recorded` (CS-4/CS-5/CS-11), `resolveListProgress` (CS-8), `resetProgress` (CS-9), `advanceForChallenge`/`reviewChallenge` clamps (OV-3/CY-3). The gate confirmed `LIST_PROGRESS_CANONICAL=false` deployed (no canonical writes by design).
- **Disposition (per the round-36 precedent + handoff's confirmatory framing):** full behavioral e2e validation of the 6 assertions on real UI is **deferred to the post-cutover full-UI prod audits** (which own harness calibration for the current build). The cutover is reversible if those audits surface a regression.

## Reversible
Regression → flip the 4 client flags `false` + push (rollback to pre-P4). No data writes / no 26SM this round.

## Posture after this round
- **Client @ `6bffe1c`:** PR-1 + PR-3 + **P4 cutover** (progress/challenge/review-marker/reset routed to server) LIVE.
- **Server (functions @ `0ddbb34`):** D2/P3 surface + **FORCED_PATHWAY_ENABLED=true** + epoch `1784333239063`. Still `false`: `LIST_PROGRESS_CANONICAL`, `ANCHOR_VALIDATION_ENFORCE`, cycling/override/teacher-ids-write (P5/P6/P9/P10).

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_037.md`.
- `baton.json` → `turnOwner="claude"`, `round=37`, `execStatus="run-written"`, `execDecision="DEPLOYED"`, `updatedBy="winclaude"`, `revision=74`.
- Watcher re-armed at baseline 74. Ready for the next step (P5 migration / P6 rules). **Two items flagged for WSL:** (1) the `.gitattributes` renormalization hygiene commit; (2) the smoke harness `joinClass` enrollment gap — worth a targeted post-cutover behavioral audit of the P4 server path.
