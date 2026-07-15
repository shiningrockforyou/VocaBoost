# WINCLAUDE round 4 — M-UI subset re-run (RA1, RA2) after key-path fix

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `DEEPFIX_TASK6_WINCLAUDE_MUI_SUBSET_1_RERUN`
- **handoff:** `docs/plans/loop/win/handoffs/claude_to_winclaude_004.md`
- **git:** `a967f54` dirty
- **run:** 2026-07-14T14:14Z
- **execDecision:** `NOT_CLEAN` (setup advanced past init+key-load; now fails at Admin SDK → Firestore TLS handshake — env/CA calibration)

---

## The run

**Env (identical to round 3, new runId):**
```
LSR_TEACHER=lsr_teacher_02@vocaboost.test
SL_STUDENTS=lsr_s41@vocaboost.test,lsr_s42@vocaboost.test
DFX_SCENARIOS="RA1 RA2"    (LSR_TIER not set)
```

**Command:**
```
node audit/playwright/lsr_deepfix_ui.mjs winclaude-ui-r4
```

**Full stdout+stderr (verbatim — entire output):**
```
Error: 14 UNAVAILABLE: No connection established. Last error: Error: unable to verify the first certificate; if the root CA is installed locally, try running Node.js with --use-system-ca. Resolution note:
```
**Exit code: 2**

---

## SETUP phase outcome — PROGRESS vs round 3

- ✅ **Init + Admin SDK key load: PASSED.** Your round-3 fix (repo-relative `serviceAccountKey.json` + `LSR_SA_KEY` in `lsr_reviewonly_fb.mjs`) worked — no more `/app/...` ENOENT; setup got past line one.
- ❌ **First Admin SDK → Firestore call: FAILED** with gRPC `14 UNAVAILABLE`, root cause **`unable to verify the first certificate`** (Node TLS root-CA trust).
- Teacher login (browser) / class create / list assign / student join+select / RA1 / RA2: **not reached** — the failure is in the Admin SDK provisioning/verify step that runs during setup, before the Playwright browser flows. No per-scenario verdicts, no FINAL line.

---

## Diagnosis pointers for WSL-Claude (context only — NOT a fix, NOT applied)

This looks like an **environment/network TLS trust** issue on the native-Windows box, not a harness locator bug:

- **Target:** Admin SDK connects to **real Firestore** — project `vocaboost-879c2` (`.firebaserc` default) → `firestore.googleapis.com`. (The M-UI leg runs against the real project with sandbox `lsr_*` identities, by design; the emulator is only for M-CALL/M-RULES.)
- **`unable to verify the first certificate`** = Node can't build a trust chain to the presented server cert. Classic causes: a corporate/AV **TLS-inspection proxy** re-signing traffic with a root CA that's in the **Windows system store but not Node 24's bundled Mozilla CA list**, or a locally-installed enterprise root CA.
- **Env presence check (values not printed):** `NODE_EXTRA_CA_CERTS`, `NODE_OPTIONS`, `HTTPS_PROXY`, `HTTP_PROXY`, `NODE_TLS_REJECT_UNAUTHORIZED` are **all unset** — so no CA/proxy is configured for Node; it's on the default bundled store.
- **The error's own suggested remedy:** `--use-system-ca` (Node 24 flag to use the OS trust store). Equivalent safe options: `NODE_OPTIONS=--use-system-ca`, or point `NODE_EXTRA_CA_CERTS` at the proxy's root-CA PEM.
- ⚠️ **Security note (why I did NOT just apply it):** the safe remedies use the OS/explicit CA store. Do **NOT** "fix" this with `NODE_TLS_REJECT_UNAUTHORIZED=0` — that disables cert verification globally and is a real security hole. Choosing the remedy (and whether the network is expected to MITM) is your + David's call, not an executor workaround.

---

## Artifacts / screenshots
- **None** — failed during setup's Admin SDK connect, before any run/`shot()`.

---

## Executor discipline
- **Did NOT fix / work around.** Did not set `--use-system-ca`, `NODE_EXTRA_CA_CERTS`, or (never) `NODE_TLS_REJECT_UNAUTHORIZED`; did not edit any source.
- **Sandbox only:** `lsr_*@vocaboost.test`; **no data written / no 26SM/prod contact** — the connection never established, so nothing was created or mutated.
- Write-scope honored: only this review + named baton fields. No commits/branches.

---

## For WSL-Claude (deliverable)
Round 4 advanced the shared setup path by one stage (init+key-load now clean) and surfaced the next break: **Node TLS root-CA trust when the Admin SDK dials real Firestore.** Likely a system/enterprise CA that Node's bundled store doesn't include. Decide the remedy (system-CA flag or `NODE_EXTRA_CA_CERTS` → proxy root PEM — not verification-disable), hand me a re-run, and I'll push into the actual teacher-login → list-select → RA1/RA2 flows. This one may need a David decision (it's his network/CA), so flagging up.

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_004.md` (this file).
- `baton.json` → `turnOwner="claude"`, `revision=8`, `execStatus="run-written"`, `execDecision="NOT_CLEAN"`, `updatedBy="winclaude"`, `updatedAt=2026-07-14T14:14Z`.
- Self-wake watcher re-backgrounded at baseline 8. Dev server still up on 5173.
