# WINCLAUDE round 27 — firebase-creds check + Task-6 flag-ON M-CALL

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `WINCLAUDE_FIRECREDS_AND_TASK6_MATRICES`
- **handoff:** `docs/plans/loop/win/handoffs/claude_to_winclaude_027.md`
- **run:** 2026-07-17T17:0xZ
- **execDecision:** `CLEAN` — TASK 1 answered; **TASK 2 M-CALL = CLEAN 21/0/0/2** (flag-restore verified). M-UI flag-on deferred (see §3).

---

## TASK 1 — firebase deploy capability: **YES (technically capable)**
Verbatim evidence:
```
firebase --version      → 14.27.0
firebase login:list     → Logged in as dmchwang@gmail.com
firebase use            → vocaboost-879c2
firebase projects:list  → VocaBoost | vocaboost-879c2 (current) | 340529006626
.firebaserc default     → vocaboost-879c2
```
So: CLI present (14.x), authenticated as **dmchwang@gmail.com**, that account owns/accesses **vocaboost-879c2**, which is the default project → **I can technically run `firebase deploy --only functions`.** **Deployed NOTHING** (as instructed).

### ⚠️ Authorization caveat (important — flagging, not blocking)
The handoff frames my role as *"you do git commit/push + firebase deploy."* Technical capability ≠ my authorization. **David gave a firm, direct standing rule: never commit/push (not even a branch) without his explicit in-the-moment say-so** — and a firebase **deploy** to live prod functions is an even bigger outward action. A relayed "full-auto includes deploy/git" is **not** the same as David directly telling me to. **So: I will NOT run `firebase deploy` (or any git commit/push) on the relayed authorization — when a round actually needs it, I'll pause and relay to David for explicit confirmation first.** (Neither round-27 task needed it, so no conflict this round.)

## TASK 2 — flag-ON M-CALL emulator matrix: **CLEAN 21 / 0 / 0 / 2**
`node lsr_deepfix_flag_on.mjs --matrix=call --run=flagon_r27 --exec "firebase emulators:exec --only functions,firestore,auth --project demo-vocaboost <shim>"` → the guaranteed-restore wrapper flipped the 11 server + 8 client flags ON, `emulators:exec` loaded the flag-ON functions, ran the callable suite, then **restored**.

**FINAL: `CLEAN pass=21 fail=0 invalid=0 skip=2`** · emulator `demo-vocaboost` (fs 8080 / auth 9099 / fn 5001) · flag-set loaded exactly as intended (`GRADE_TOKEN_ENFORCED` correctly stayed OFF).

**21 PASS:** CS-1, CS-1e, CS-2 (day-guard), CS-3 (idempotent), CS-4a/b/c (3-reason reviewOnlyDay), CS-5 (W2 marker), CS-6f/CS-6v (M4 ENFORCE forge-reject/valid-pass), CS-8a/b/c (resolveListProgress canonical/hydrate/quarantine), CS-9 (resetProgress), CS-11m/CS-11a (derivation-mismatch tripwire), OV-1 (full-anchor override), OV-2 (authz union 200/200/403), OV-3c/OV-3p (reviewChallenge clamp/phase-gate), CY-3 (lap-aware M4).
**2 SKIP (by design):** CS-7 (nonce `gradeTypedTest` — needs `GRADE_TOKEN_SECRET`), CS-10 (grading-job suite — needs secrets + Web SDK, targets live prod). SKIP ≠ FAIL; both are the documented deferred-secret oracles.
**Artifacts:** `findings/deepfix_call_flagon_r27.{json,md}`.

### First-run Windows fix (executor's own shim — not a matrix edit)
First attempt failed: `emulators:exec` ran the `.cmd` via cmd.exe, which choked on the **forward-slash** path (`'audit' is not recognized`). Fix (my shim invocation, within `audit/deepfix/task6/*.cmd` write-scope): passed the shim as an **absolute backslash** path → ran clean. No matrix-script/source edits.

### ✅ Flag-restore discipline held (both times)
The failed 1st attempt AND the clean 2nd attempt both ended with `restore complete — flags OFF, working tree reverted`. Verified after: `SERVER_COMPLETE_SESSION_ENABLED / SERVER_RESOLVE_LIST_PROGRESS_ENABLED / LIST_PROGRESS_CANONICAL / ANCHOR_VALIDATION_ENFORCE / CYCLING_ENABLED` all `= false`; `git diff --stat` on the two flag files = **no content change**; backup dir cleaned up; no leftover lock. Emulator ports free.

## §3 — flag-ON M-UI: DEFERRED (recommend a dedicated round)
"if time permits" — I did **not** attempt it. Reason: M-UI flag-on needs a **flag-ON dev-server build** (per CODEX_RUNBOOK §1.4) — a different mechanism than the emulator `--exec` wrapper (which is built for M-CALL/M-RULES). Doing it right needs: flip client flags → restart/rebuild the dev server on the flag-ON build → run M-UI (RS-3/CA/CY/OV/CUT) → restore — with its own restore discipline. Rather than improvise that under "if time permits," recommend WSL-Claude hand a **dedicated round** specifying the exact flag set, the build/dev-server choreography, and the scenario list. (M-RULES flag-on emulator, by contrast, is ready to run the same way as M-CALL whenever you want it.)

## Executor discipline / hygiene
Executor-only — no source/matrix/flag hand-edits (the wrapper flipped+restored flags; I only wrote the `run_call.cmd` shim in `audit/deepfix/task6/`). TASK 1 was read-only (deployed nothing). Emulator = `demo-vocaboost` (local, zero prod risk). Sandbox `lsr_*`/25WT only. No 26SM/prod. **No commits/branches/deploys.**

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_027.md`.
- `baton.json` → `turnOwner="claude"`, `round=27`, `execStatus="run-written"`, `execDecision="CLEAN"`, `updatedBy="winclaude"`, `revision=54`.
- Watcher re-backgrounded at baseline 54.
- **Open ask for David (relay):** confirm whether I'm actually authorized to run `firebase deploy` / git commit+push when a future round needs it — I'm holding on that pending his direct OK (per §1 caveat).
