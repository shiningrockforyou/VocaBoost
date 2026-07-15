# Task-6 diagnosis — M-CALL emu-r1 NOT_CLEAN (1/20/0/2)

**Date:** 2026-07-14 · **Round:** emulator run 1 → 2 · **Author:** Claude (per the "Codex runs, Claude fixes" split).
**M-RULES was CLEAN (11/11)** — this diagnosis is M-CALL only.

## Symptom (Codex executor report, round 1)
`FINAL: NOT_CLEAN pass=1 fail=20 invalid=0 skip=2`. Six scenarios hard **HTTP 500 INTERNAL**
(CS-1, CS-5, CS-9, OV-1, OV-3c, OV-3p); the rest return `undefined` expected fields. Two representative
function-runtime errors from his raw output:

```
TypeError: Cannot read properties of undefined (reading 'now')            functions/foundation.js:1087:41
TypeError: Cannot read properties of undefined (reading 'serverTimestamp') writeUpgradedReviewMarker foundation.js:870:45
```

- foundation.js:1087 = `const now = admin.firestore.Timestamp.now();` → `admin.firestore.Timestamp` is `undefined`.
- foundation.js:870  = `submittedAt: admin.firestore.FieldValue.serverTimestamp()` → `admin.firestore.FieldValue` is `undefined`.

Signature: `admin.firestore` resolves (a function) but BOTH `.Timestamp` and `.FieldValue` statics are `undefined`.

## Root cause — firebase-admin version drift on the executor's box (NOT a code or matrix defect)
Empirically verified in this repo (grounded, not assumed):
- `functions/package-lock.json` **pins firebase-admin `13.6.0`**; the installed module here is `13.6.0`.
- In **13.6.0** the namespaced statics are LIVE: `typeof admin.firestore.FieldValue === 'function'`,
  `typeof admin.firestore.Timestamp === 'function'` (before AND after `initializeApp`). Verified by direct `node -e`.
- The **modular** imports also work here: `require('firebase-admin/firestore') → {FieldValue, Timestamp}` both functions.
- The pattern is **prod-proven**: index.js uses the identical `admin.firestore.FieldValue`/`.Timestamp` in 19 places
  (lines 474/677/889/... ) and runs in production.

⇒ For both statics to be `undefined` on the executor's box, his `functions/node_modules/firebase-admin` is **not the
pinned 13.6.0**. His stack paths (`C:\Users\dmchw\vocaboost\functions\`) confirm he loads his own `node_modules`.
Most likely a stale / `npm install`-floated tree rather than `npm ci` against the committed lock. This is an **audit
ENVIRONMENT faithfulness gap** — the emulator must run the pinned admin to mirror prod — not a defect in foundation.js.

## Why NOT a foundation.js code change
- The code is correct against the pinned admin (13.6.0) and matches the house pattern in index.js.
- A foundation.js-only conversion would be INCOMPLETE: index.js has 19 identical uses on paths M-CALL exercises
  (writeAttemptTxn, markReviewComplete, validateAttemptAnchorShadow) — those would still crash on a drifted admin.
- The env fix (`npm ci` → 13.6.0) resolves ALL of them at once, with zero churn to signed-off code.

## Why most of the other 14 FAILs are expected to clear
A callable that 500s returns no payload, so the matrix reads `status/reasons/mode/... = undefined`. Those are almost
certainly **downstream of the crash**, not independent matrix bugs. Whatever survives the env fix = the real
matrix-calibration work for round 3 (Claude fixes the scripts).

## Fix (round 2, executor = Codex, no code change)
1. Report his `functions` firebase-admin version (`npm ls firebase-admin`) + probe
   `node -e "const a=require('firebase-admin');console.log(typeof a.firestore.FieldValue, typeof a.firestore.Timestamp)"`.
2. If ≠ 13.6.0 or probe shows `undefined`: `npm ci` in `functions/` (installs pinned 13.6.0 from committed lock);
   re-probe to CONFIRM both print `function`.
3. Re-run **M-CALL only**, runId `emu-r2` (M-RULES already CLEAN). Same executor rules: capture verbatim, no script edits.

## Carry-forward (real finding, NOT a deepfix blocker — applies to prod index.js equally)
The whole functions codebase relies on the **deprecated** `admin.firestore.FieldValue`/`.Timestamp` compat statics
(foundation.js ×16, index.js ×19). firebase-admin **v14 will remove** them. Before any admin-major bump, migrate the
codebase to modular `const {FieldValue, Timestamp} = require('firebase-admin/firestore')`.

---

## ★ ROUND-2 UPDATE — the version-drift hypothesis above was FALSIFIED. Real root cause found + FIXED.

Codex round-2 diagnostic (grounded, in `codex_deepfix_task6_emulator_run_002.md`):
- `npm ls firebase-admin` on his box → **`firebase-admin@13.6.0`** (exactly pinned, deduped everywhere). NOT drifted.
- Plain-node probe → **`FieldValue function Timestamp function`** — statics ARE present outside the emulator.
- Yet M-CALL still crashed identically, now also at **`index.js:474`**.

⇒ **Real root cause: the firebase functions-EMULATOR runtime strips the `admin.firestore` namespace statics.**
firebase-tools stubs the `admin` app to route Firestore to the emulator, and that stub leaves `admin.firestore` callable
but drops `.FieldValue`/`.Timestamp`. Works in PROD (no stub) — which is why prod is fine — but not under the emulator.
(My round-1 "version drift" guess was wrong because I hadn't tested the in-emulator context; the plain-node probe here
matched prod, not the emulator. Recorded honestly per H1.)

**Fix applied (Claude, code change — the carry-forward above, done now):** converted BOTH files to the modular import
`const {FieldValue, Timestamp} = require("firebase-admin/firestore")` and replaced all 35 namespace-static uses
(foundation.js ×16, index.js ×19). The modular symbols come straight from `@google-cloud/firestore`, bypassing the
stubbed `admin.firestore` namespace — so they survive in-emulator AND in prod.

**Proven byte-equivalent (so prod behavior is bit-identical, flag-off byte-equivalence preserved):** in 13.6.0,
`FieldValue === admin.firestore.FieldValue` and `Timestamp === admin.firestore.Timestamp` are the SAME object refs
(verified `node -e`), and `serverTimestamp()` sentinels are JSON-equal. `node --check` passes both files; `admin.firestore()`
db-handle calls untouched (foundation ×1, index ×5); no other functions file uses the statics.

**Scope note:** this touched prod-proven `index.js` (474/677/... — paths M-CALL exercises), not just dormant foundation.js —
required because a foundation-only fix would leave index.js crashing in-emulator. Byte-equivalent + audit-driven; flagged
for the final Codex re-review. Round-3 = re-run M-CALL (emu-r3) to validate + triage any survivors as real matrix work.

---

## ★ ROUND-3 RESULT — FIX VALIDATED. M-CALL emu-r3 CLEAN (21 pass / 0 fail / 2 deferred-skip).

Codex round-3 (`codex_deepfix_task6_emulator_run_003.md`): stale-code guard PASS (import at foundation:36 + index:16,
zero namespace statics), then M-CALL emu-r3 = **CLEAN, exit 0, `pass=21 fail=0 invalid=0 skip=2`**. Every prior
timestamp-500 now passes with correct evidence — notably the final-review fixes proven live in the functions runtime:
CS-1e `no_evidence advanced=false` (F-4), CS-9 `zeroed=true stamped=true` (F-3), CS-2 day-guard `rejected/sessionCleared`,
CS-6v/CY-3 anchor validation, OV-2 override authz `403`. The 2 SKIPs (CS-7 secret-backed grading, CS-10 grading-job) are
deferred by design. **Both emulator matrices now CLEAN (M-RULES 11/11 + M-CALL 21/21).**

**Honest caveat on the mechanism (H1):** the Step-1 grounding probe did NOT reproduce the stripping — it printed
`ns.FieldValue function | modular.FieldValue function`. Reason: `emulators:exec "node -e ..."` runs a PLAIN child
process, not the firebase-tools **functions-hosting runtime** where the `admin` stub actually lives; so the probe
couldn't observe the divergence. The stripping is therefore INFERRED, not directly observed. It does not weaken the fix:
(1) the original code demonstrably crashed with `admin.firestore.FieldValue/.Timestamp = undefined` INSIDE the executing
callables across two runs (stack traces at foundation:870/1087, index:474); (2) the modular version passes 21/21 with
correct real Firestore writes (markers written, docs zeroed, anchors stamped); (3) modular === namespace object refs in
prod (byte-equivalent). The exact firebase-tools internal is academic; the fix is empirically validated.
