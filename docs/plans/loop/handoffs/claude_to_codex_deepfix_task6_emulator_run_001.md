# Claude → Codex: RUN the Firebase-emulator matrices (M-CALL + M-RULES) — you RUN, I FIX

> **TASK = DEEPFIX_TASK6_EMULATOR_RUN, round 1.** You confirmed the emulator is viable (EMULATOR_VIABLE probe).
> Now **get ready for + RUN** the two emulator matrices and **return the RAW results to me.**
>
> ★★ **DIVISION OF LABOR (David's instruction): YOU RUN, CLAUDE FIXES.** You are the EXECUTOR only. **Do NOT
> diagnose, do NOT edit the matrix scripts, do NOT fix anything.** Run the commands, capture everything verbatim
> (stdout+stderr, exit codes, the findings JSON/MD, any emulator/script errors), and return it. I (Claude) read
> your raw results, fix the matrix scripts, and hand back a corrected version for you to re-run. Iterate that way.

## 1. Get ready (confirm still-ready from your probe)
- `firebase --version` (14.x), `java -version` (Temurin 21 OK), root + `functions/node_modules` present, emulator
  ports free (auth 9099 / firestore 8080 / functions 5001). If any prereq regressed, report it and STOP (don't fix).
- The matrices + the disposable flag-on helper are built: `audit/playwright/lsr_deepfix_{callable,rules}.mjs`,
  `lsr_deepfix_flag_on.mjs`, shared `lsr_deepfix_emu.mjs`. **Read `audit/deepfix/task5/CODEX_RUNBOOK.md` §3a** for
  the EXACT flag-on→`emulators:exec`→restore commands + the `CI=true FIREBASE_CLI_DISABLE_UPDATE_CHECK=true
  NO_UPDATE_NOTIFIER=1` env — run them exactly as §3a specifies.

## 2. Run (runId = `emu-r1`; SEQUENTIAL, never parallel — parallel emulators EADDRINUSE)
- **M-CALL first**, then **M-RULES** — each via the flag-on `--exec` wrapper per §3a (the wrapper flips flags →
  `emulators:exec --only functions,firestore,auth --project demo-vocaboost "node <matrix>.mjs emu-r1"` → GUARANTEED
  restore). Sandbox/emulator only (`demo-vocaboost`) — NEVER 26SM/prod.
- Expect FIRST-RUN issues (these scripts have never executed): script bugs, wrong endpoint/flag/oracle
  assumptions, INVALIDs, emulator-load errors. **That's fine — that's what I fix.** Don't work around them.

## 3. Return to me (the RAW results — this is the whole job)
For EACH matrix (call, then rules):
- The **full command output** (stdout + stderr) verbatim — especially any error/stack/INVALID lines.
- The **exit code**.
- The written **`findings/deepfix_{call,rules}_emu-r1.json` + `.md`** (paste the JSON, or its key contents: the
  per-scenario `{id, verdict, reason}` rows + the summary + the manifest binding).
- Any **emulator/firebase-tools noise** (EADDRINUSE, ETIMEDOUT SDK-check, secret warnings, load errors).
- **Confirm the flag-on helper RESTORED** — after each run, `git status --porcelain src/config/featureFlags.js
  functions/foundation.js functions/index.js` should show them at the dormant-draft state (the helper's finally
  block; if restore failed, say so LOUDLY — that's the one thing to flag immediately).

Then flip → claude. **Do not attempt fixes.** Write your report to
`/out/reviews/codex_deepfix_task6_emulator_run_001.md`. I'll diagnose + patch the scripts and send back round 2.
