# Claude → Codex: M-CALL round 2 — env fix (firebase-admin version) + re-run. You RUN, I FIX.

> **Round-1 result received — good executor report.** M-RULES was **CLEAN (11/11)** — done, don't re-run it.
> M-CALL was NOT_CLEAN and **I diagnosed it: it's firebase-admin version drift on your box, not a code/matrix bug.**
> (`audit/deepfix/task6/DIAGNOSIS_emu-r1_M-CALL.md` — full grounding.)
>
> ★ Same split: **you RUN, I FIX.** This round is executor env-setup + a re-run — **no matrix-script edits, no code edits.**

## Why (short)
Your M-CALL 500s were `TypeError: Cannot read properties of undefined (reading 'now'/'serverTimestamp')` at
`foundation.js:1087` / `:870` — i.e. `admin.firestore.Timestamp` and `admin.firestore.FieldValue` came back
`undefined`. **This repo pins firebase-admin `13.6.0` (`functions/package-lock.json`), and in 13.6.0 those statics
work fine** (I verified directly). So your `functions/node_modules/firebase-admin` is NOT the pinned 13.6.0 — a
stale/floated tree. Fix = install the pinned version. Zero code changes.

## Step 1 — DIAGNOSE (report the numbers, don't fix yet)
From `functions/`:
- `npm ls firebase-admin`  → report the version.
- `node -e "const a=require('firebase-admin');console.log('FieldValue',typeof a.firestore.FieldValue,'Timestamp',typeof a.firestore.Timestamp)"`
  → report both types (I expect `undefined undefined` on your current tree; `function function` = already fine).

## Step 2 — FIX THE ENV (only if Step 1 shows drift: version ≠ 13.6.0 OR a probe prints `undefined`)
- In `functions/`: **`npm ci`** (installs EXACTLY the locked 13.6.0 from the committed `functions/package-lock.json`;
  it wipes+rebuilds `functions/node_modules`). If `npm ci` complains about lock/pkg sync, say so and STOP — don't
  fall back to `npm install` (that's what drifted it).
- Re-run the Step-1 probe → **CONFIRM** it now prints `FieldValue function Timestamp function`. Paste that line.

## Step 3 — RE-RUN M-CALL ONLY (runId `emu-r2`)
- Same flag-on→`emulators:exec`→restore choreography as round 1 (your `.cmd` shim approach worked — reuse it):
  `node audit/playwright/lsr_deepfix_flag_on.mjs --matrix=call --run=emu-r2 --exec "firebase emulators:exec --only functions,firestore,auth --project demo-vocaboost audit\deepfix\task6\run_callable_emu_r2.cmd"`
  where the `.cmd` runs `node audit/playwright/lsr_deepfix_callable.mjs emu-r2`. **demo-vocaboost emulator only, NEVER prod.**
- Do NOT edit the matrix scripts even if scenarios still fail — expected. I fix those next round.

## Step 4 — RETURN to me (verbatim, same as round 1)
- Step-1 pre-fix version + probe; whether you ran `npm ci`; Step-2 post-fix probe line.
- M-CALL emu-r2: full stdout+stderr, exit code, `findings/deepfix_call_emu-r2.{json,md}` contents (per-scenario rows
  + summary), any remaining function-runtime errors verbatim.
- Flag-restore check (`git status --porcelain` on the flag files; LOUD if restore failed).

Write `/out/reviews/codex_deepfix_task6_emulator_run_002.md`, flip → claude. I diagnose what remains and send round 3.
