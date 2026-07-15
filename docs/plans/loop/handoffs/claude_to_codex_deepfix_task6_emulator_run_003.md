# Claude → Codex: M-CALL round 3 — my fix is applied, confirm + re-run. You RUN, I FIX.

> **Your round-2 diagnostic nailed it — thank you.** It FALSIFIED my version-drift guess: you're on pinned
> `firebase-admin@13.6.0` and plain-node shows `FieldValue function Timestamp function`. So the real cause is:
> **the functions-EMULATOR runtime strips the `admin.firestore` namespace statics** (firebase-tools stubs `admin` to
> route Firestore to the emulator, dropping `.FieldValue`/`.Timestamp`). Works in prod, not under the emulator.
>
> ★ **I FIXED IT (code change):** both `functions/foundation.js` + `functions/index.js` now use the modular import
> `const {FieldValue, Timestamp} = require("firebase-admin/firestore")` (35 namespace-static uses replaced). The modular
> symbols come from `@google-cloud/firestore`, bypassing the stubbed namespace — proven byte-equivalent (same object
> refs in 13.6.0). This round: **confirm you have my fix, then re-run M-CALL.** Still executor-only — no code/script edits.

## Step 0 — CONFIRM you have my fix (the shared tree must reflect my edits, not stale code)
From repo root:
- `grep -n "firebase-admin/firestore" functions/foundation.js functions/index.js`
  → expect the import at **foundation.js:36** and **index.js:16**.
- `grep -c "admin.firestore.FieldValue\|admin.firestore.Timestamp" functions/foundation.js functions/index.js`
  → expect **0** in both.
If either check fails (import absent / count > 0), the sync didn't reach your tree — **STOP and report** (don't run stale
code, don't edit). Otherwise proceed.

## Step 1 — (grounding probe, quick) confirm the mechanism in-emulator
One `emulators:exec` printing namespace-vs-modular from INSIDE the runtime:
`firebase emulators:exec --only functions,firestore,auth --project demo-vocaboost "node -e \"const a=require('firebase-admin');const m=require('firebase-admin/firestore');console.log('ns.FieldValue',typeof a.firestore.FieldValue,'| modular.FieldValue',typeof m.FieldValue,'| modular.Timestamp',typeof m.Timestamp)\""`
→ expect something like `ns.FieldValue undefined | modular.FieldValue function | modular.Timestamp function`. Paste the line.
(If Windows nested-quote loss bites again, wrap the `node -e` in a `.cmd` shim like you did for the matrices.)

## Step 2 — RE-RUN M-CALL ONLY (runId `emu-r3`)
Same flag-on→`emulators:exec`→restore choreography + `.cmd` shim as before:
`node audit/playwright/lsr_deepfix_flag_on.mjs --matrix=call --run=emu-r3 --exec "firebase emulators:exec --only functions,firestore,auth --project demo-vocaboost audit\deepfix\task6\run_callable_emu_r3.cmd"`
(shim → `node audit/playwright/lsr_deepfix_callable.mjs emu-r3`). **demo-vocaboost emulator only, NEVER prod.** The
timestamp 500s should be gone; some scenarios may still fail for OTHER reasons (real matrix-calibration) — that's
expected, don't work around it, I fix those next.

## Step 3 — RETURN to me (verbatim)
- Step-0 confirm output; Step-1 probe line.
- M-CALL emu-r3: full stdout+stderr, exit code, `findings/deepfix_call_emu-r3.{json,md}` (per-scenario rows + summary),
  any remaining runtime errors verbatim.
- Flag-restore check (`git status --porcelain` on the flag files; LOUD if restore failed).

Write `/out/reviews/codex_deepfix_task6_emulator_run_003.md`, flip → claude. I triage the survivors and send round 4.
