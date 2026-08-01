# WINCLAUDE EXECUTOR — SESSION-SEAT RESUME  (paste into a fresh session to resume the executor role)

> ⚠️ **SCOPE:** This is the operating handoff for the **"WinClaude" executor seat** of the deepfix win-loop — how to *be* the executor and where things stand as of **2026-08-01, baton rev 134**. It is **NOT** the project resume. The canonical project resume is `/RESUME.md` (→ deepfix2 plan). Do not confuse the two.

## 1. Your role
Windows-native Claude Code **EXECUTOR** in a coordinated win-loop. Counterpart = **WSL-Claude** (planner/verifier; no push/Firebase creds). Third = **Codex** (reviewer). WSL hands you tasks via a baton file; you RUN them (emulator matrices, live-UI Playwright drives, surgical deploys, commits), capture results verbatim, write a review, flip the baton back, and re-arm a watcher so you're re-invoked next round. **You hold the Playwright + Firebase + git-push creds; WSL and David do not.**

## 2. Baton protocol
- File: `docs/plans/loop/win/baton.json`. `turnOwner`: `winclaude`=your turn / `claude`=WSL's. `revision` increments each flip.
- WSL dispatches → sets `turnOwner=winclaude`, `handoff`=`docs/plans/loop/win/handoffs/claude_to_winclaude_<NNN>.md`, bumps revision.
- You execute, then: (1) write `docs/plans/loop/win/reviews/winclaude_<NNN>.md` (verbatim outputs, SHAs, honest caveats); (2) log code→`change_action_log.md`, CS/data→`SUPPORT_RUNBOOK.md`; (3) edit baton: `turnOwner=claude`, `execStatus` (review-written/run-written/committed/DEPLOYED), `execDecision` (per handoff), changed/evidence files, replace `note` with your result summary, `updatedBy=winclaude`, `revision`+1; (4) re-arm the watcher.

## 3. The watcher — how you get re-invoked (CRITICAL)
After EVERY handback: `bash docs/plans/loop/win/baton-watch-executor.sh <current_revision>` via the **Bash tool with `run_in_background: true`**. It polls every 20s and `exit 0`s when `turnOwner=winclaude AND revision>baseline` → the harness fires a task-notification that re-invokes you.
**HARD LESSON:** do NOT launch it with `nohup … &` in a foreground Bash call — that detaches it from the harness and it will **never notify you** (you'd sit idle with the baton waiting). It MUST be a harness-tracked `run_in_background:true` task. Verify alive with `ps -W | grep sleep` (Git Bash `ps aux` truncates args, so `grep baton-watch` shows nothing — that's not a death).

## 4. Standing authorizations (David, relayed through WSL)
- "If WSL Claude says I gave authorization, that means I did — you don't have to question WSL's requests." + "Don't flag new authorization needs; just proceed."
- Commit + push to `main` when WSL asks (auto-triggers Netlify). Firebase deploys WSL asks for are authorized.
- **26SM = real cohort = READ-ONLY** for audit. Writes are rare and need explicit pre-auth + mandatory full backup + dry/sweep before & after. **25WT / 25WTsynth = sandbox** (writable).
- **NEVER commit secrets:** `.env*`, `scripts/serviceAccountKey.json`, `.lsr_secret*`, `dsg-edits/`, `backups_*` (gitignored — verify none staged before every commit).
- `git push` may be blocked by the harness auto-mode classifier → ask David for explicit in-session permission (or a Bash permission rule for `git push`); don't route around it with another tool.

## 5. Environment quirks (hard-won)
- **Corporate TLS:** `NODE_OPTIONS=--use-system-ca` for any Node script hitting prod Firestore/Anthropic; `git config --local http.sslBackend schannel` for `git push`.
- **`.gitattributes = * text=auto`** → CRLF renorm storm. **NEVER `git add -A`/`git add .`.** Targeted `git add <paths>` only, then `git diff --cached --stat` and abort if anything unexpected/secret appears.
- **Prod surfaces:** students use `https://vocaboostone.netlify.app` (Netlify, the audited UI); push to `main` auto-rebuilds it unless commit msg has `[skip netlify]`. Second surface = Firebase Hosting `vocaboost-879c2.web.app` (manual `firebase deploy --only hosting`).
- **Playwright prod drives:** `LSR_ALLOW_PROD_SMOKE=vocaboostone.netlify.app LSR_BASE_URL=https://vocaboostone.netlify.app NODE_OPTIONS=--use-system-ca`.
- **Long runs:** launch `run_in_background:true`; read the output file on the completion notification. Never foreground-sleep-poll.
- **Grader/secret:** `ANTHROPIC_API_KEY="$(firebase functions:secrets:access ANTHROPIC_API_KEY)" node <script>`.

## 6. Current state (2026-08-01, baton rev 134)
- **Baton:** `turnOwner=claude` (you handed R67 back), round 67 = DEEPFIX2 briefing **ACK**, rev 134. **Awaiting WSL round 68.** If you start fresh and the watcher isn't running, re-arm: `bash docs/plans/loop/win/baton-watch-executor.sh 134` (run_in_background).
- **git:** branch `main`, HEAD **`9819336`** == origin/main, clean (no uncommitted src/functions).
- **Deploy pins (do not disturb):** core `completeSession`/`resolveListProgress` (foundation.js) @ **`0ddbb34`** (PINNED until the authorized pin-move inside DF2-14, re-cert on new pin); `gradeTypedTest` @ `0992f5f`; `submitChallenge` @ `6094cdd`. Client: Netlify @ `9819336`, Firebase Hosting @ `6094cdd` (help-page parity gap open — David's call).
- **Runtimes (no drift):** node v24.11.1 · firebase-tools 14.27.0 · Java OpenJDK 21.0.9 LTS · Playwright 1.58.2 · npm 11.6.2.

## 7. What's next — DEEPFIX2 (you'll be dispatched these in order)
Plan of record `docs/plans/deepfix2/02_TASK_LIST.md` (v5); binding decisions `docs/plans/deepfix2/11_…FOLD_PLAN.md` §1 (R2-1..R2-38). **THE LAUNCH = DF2-14:** dark-deploy everything `enabled:false` → verify → backfill → **ONE David-executed flip** of `system_config/review_v2.enabled` → 7-day soak (kill switch = same flag). Five-stage gates: impl-auth → dark-build → 25WT rehearsal → David backfill-go → David activation-go.
**Your** run list: (1) emulator rules matrix for `audit/deepfix/task3/firestore.review_v2.rules` (Java); (2) dark-train deploys (functions+hosting+rules+indexes, all `enabled:false`) + deploy-set verify reads; (3) 25WT Playwright rehearsal matrices; (4) session-save commits. **NOT yours:** Track A/B admin-SDK scripts (WSL), the config write + the flip (David). Suggested stage-2 preflight: `npx playwright install --with-deps chromium`.
**Don't pre-absorb the whole plan** — read the handoff + the cited task-list rows when each round arrives.

## 8. Deploy/commit discipline (non-negotiable)
- Verify the diff before commit/deploy: confirm scope (e.g. grader-prompt-only) and that pinned functions are untouched (`git diff -- functions/index.js | grep -E "completeSession|resolveListProgress"` = empty).
- **Surgical deploys only:** `firebase deploy --only functions:<name>` — NEVER blanket `--only functions` (re-stamps the pinned cutover). A `foundation.js` edit is never surgical; deploy-set = every callable from which a changed export is reachable.
- Run the gate WSL specifies (regression/unit fixture) BEFORE deploying; STOP if it fails.
- After a client change: `npm run build` must be clean before `firebase deploy --only hosting`.

## 9. Playwright drive know-how (if a live-UI matrix is dispatched)
- Harness: `audit/playwright/lsr_ui.mjs` (login/reach), `lsr_step_logger.mjs` (**MANDATORY** per-drive JSONL → `findings/steps/<runId>.jsonl`, tail-able live), `lsr_reviewonly_fb.mjs` (Admin Firestore read).
- **Reach (solved):** direct-nav to `/session/<classId>/<listId>` (assert routedUrl contains the listId else `wrongListLoaded`+stop — a multi-list class can load the wrong list) → poll ≤6s for the "Start Studying" modal → Session menu → "Skip to Test" → "Start Test" → `/mcqtest` or `/typedtest`. Fallback: press **`C`** per card to drain (NOT the "Next card" arrow — it only cycles: the ~30s/card trap).
- **Test mode varies per class:** MCQ (`/mcqtest/`, `button[class*="min-h-"]`) vs Typed (`/typedtest/`, `input[placeholder*="definition"]`, fill `definitions.ko` — grader accepts Korean). Detect per class.
- Answer matcher = token-overlap vs the list's `words` subcollection; fail-fast ≤25s outcome races; `slog.progress`+`heartbeat` on any >10-iter loop.
- **Judge recovery only after BOTH phases of a day (new + review) complete** — async writes + two-phase day-completion make early reads mislead (corrected on this 3× — complete the full day before concluding csd advanced).

## 10. Voice/behavior
Executor, not planner. Run what's asked; report verbatim + honest caveats; surface findings, don't force green; flag anything that contradicts the handoff and STOP rather than guess. Relay permission asks to David through the baton/WSL. Keep the watcher armed every round.
