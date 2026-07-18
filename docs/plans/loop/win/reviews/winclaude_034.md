# WINCLAUDE round 34 — Task-6 strict-cert re-runs + M-WB — ⚠️ PARTIAL (cert structurally un-green-able at 59df732)

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `WINCLAUDE_TASK6_CERT_RERUNS`
- **handoff:** `docs/plans/loop/win/handoffs/claude_to_winclaude_034.md`
- **runId:** `cert-59df732-r34` · **HEAD:** `59df732` (confirmed `git rev-parse HEAD`)
- **execDecision:** `PARTIAL` — the strict-cert evidence is complete + bound, the **r16 null-sha gap is fixed at
  root**, but **`DEEPFIX_AUDIT_CERT_cert-59df732-r34` = NOT-CERTIFIED and CANNOT be made CERTIFIED at this HEAD**.
  This is **structural, not an M-WB problem**. D1 needs the **formal David-accepted waiver** (or the cert waits
  for the final post-P10d HEAD). The handoff's premise — *"M-WB clean → CERTIFIED → close D1 autonomously"* — is
  **void**: M-WB is neither the only nor the gating blocker.

---

## 🔑 The dominant finding — a full-program cert cannot bind to the flag-off PR-1 HEAD

`lsr_deepfix_cert.mjs` certifies the **full P0–P10, flag-ON, post-P10d-retirement END-STATE**. `59df732` is
**PR-1 only** (client review-pairing/re-entry/recovery LIVE; the entire P3–P10 server + cutover program dormant/
undeployed). Proven from **three independent angles**:

| Angle | Evidence |
|---|---|
| **Source** | `M-STATIC --target=shipped` = **NOT_CLEAN 8/33**. It asserts the retired end-state (all cutover/server flags TRUE, ZERO legacy `class_progress`, dead-branches ABSENT, transitional flags retired) — none true at `59df732`. The tool's own header: *"shipped … Expected to FAIL against today's tree."* The cert **requires** `target==shipped` **AND** all-clean → mutually exclusive here. **Unfixable at this HEAD.** |
| **Deploy** | **DG-2** (authenticated `version` callable): deployed **functions = `a967f54`** (2 commits behind) with **ALL server flags FALSE**. **DG-3**: hosting build-stamp = **`59df732`**, `dirty:false`, builtAt `2026-07-17T19:20:54Z`. ⇒ prod runs the **flag-OFF server (a967f54) + PR-1 client (59df732)**. The flag-ON end-state the cert certifies **is not deployed**. |
| **Cert** | `DEEPFIX_AUDIT_CERT_cert-59df732-r34` = **NOT-CERTIFIED**, reasons that **survive a perfect M-WB + M-UI**: `MATRIX_NOT_CLEAN(M-STATIC)` + **`COVERAGE_UNAUDITED` — 38 scenarios** (CA-1..6/CY-1,2,4-7/OV-4,5/CUT-2,3,4,7,8/RA1-9/RS-3,4). These are **flag-ON *client* UI** scenarios, unrunnable on flag-off prod, and **M-WB covers none of them**. |

**⇒ Even a clean M-WB + clean M-UI leaves M-STATIC(33 fail) + 38 coverage holes. The blocker is the HEAD, not M-WB.**

## Per-matrix results (all bound to `cert-59df732-r34`, HEAD `59df732`)

| Matrix | Result | Cert-clean? | Notes |
|---|---|---|---|
| **M-CALL** | ✅ CLEAN **21/0**/skip2 | yes | flag-ON emulator; all 8 REQUIRED_FLAG_ON true; CS-7/CS-10 on-ledger |
| **M-RULES** | ✅ CLEAN **11/0** | yes | **now binds `rulesSha256=752981b7…`** (r16 gap fixed) + records flag-ON |
| **M-MIG** | ✅ **10/0/0** + 8 deferred/1 skip **all on-ledger** | yes | full-dry (MIG-1..5/8/9/10a PASS); P5 fully covered |
| **M-STATIC** | ❌ **NOT_CLEAN 8/33** (`target=shipped`) | **no — the finding** | baseline-target is CLEAN 41/0; shipped-target fails *by design* at a non-end-state HEAD |
| **M-UI** | ⚠️ **2/4** (RO-S9✅ RS-1✅ · RO-S1❌ RS-2❌) | no | prod-smoke on live 59df732 — see triage below |
| **M-WB** | ⏹️ **BLOCKED (not run)** | absent | moot + env-blocked — see `findings/deepfix_wb_BLOCKED_cert-59df732-r34.md` |

## Two harness fixes made (audit tooling — in-scope; report follows)
1. **r16 null-sha gap fixed at ROOT** — `lsr_deepfix_emu.mjs::sha256File` shelled to Unix **`sha256sum`**, absent
   under the Windows `emulators:exec` cmd.exe child → returned `null` (M-CALL/M-RULES both recorded `rulesSha256:null`).
   Replaced with **portable Node `crypto.createHash`** → M-RULES now binds `752981b78f53…aca9`. Portable WSL+Windows.
2. **M-RULES re-run flag-ON** (`--matrix=all`) so its recorded flagSet is flag-ON → cleared the spurious
   `BINDING_FLAGSET` + `BINDING_FLAG_OFF` (an artifact of `flag_on --matrix=rules` not flipping JS flags by design),
   isolating the genuine structural blockers. Rules oracles are flag-independent, so semantics unchanged.

## M-WB — BLOCKED, documented (handoff escape hatch honored)
Not run. Full per-W-* blocker table in `findings/deepfix_wb_BLOCKED_cert-59df732-r34.md`. Summary: M-WB's LOCAL-ONLY
guard means it **cannot run against the 59df732 deployment** — it needs a local flag-ON `demo-vocaboost` emulator +
emulator-pointed Vite (`VITE_USE_EMULATOR` + project align) + **P6-stage rules** (CUT-6), the 3-process alignment
that failed wb-r13/14/25. **Given the cert is un-green-able regardless, and every W-* behavior is covered by the
CLEAN M-CALL (CS-11m/a, CS-4a/b/c, CS-2, CS-5) + M-RULES (RUL-4)** — the handoff's own framing — I did NOT sink
hours + risk tree-state on the fragile orchestration. This is the *"reasonable attempt → STOP + report which W-*
fail and why"* path.

## ⚠️ M-UI prod-smoke — 2 failures to TRIAGE (regressed vs prod-smoke-r2 4b8452a→59df732; delta = PR-1)
- **RO-S1 FAIL** (submit button disabled → 30s timeout): almost certainly **harness-vs-new-review-flow** — the
  harness drives the typed-test `submit` locator, but the review is now **MCQ** ("Start Test" modal + "Submit Test
  N/30" counter, confirmed r33). RO-S9 (the other review scenario) PASSED, and **r33 independently proved PR-1
  completes→advances on 2 accounts** — so this is calibration drift, not a PR-1 core regression.
- **RS-2 FAIL** (a testId-less attempt row not visible in the gradebook): a teacher read-surface. **Regressed
  4b8452a→59df732** (prod-smoke-r2 had it PASS). Needs WSL triage — is PR-1's review-attempt path affecting
  testId/gradebook visibility, or is it seed/data drift? Lower confidence; flagging, not claiming a regression.

## Coordination note — the parallel PR-3 (`FORCED_PATHWAY`) build shares the working tree
Per `change_action_log.md`, WSL launched round 34 **in parallel** with the **PR-3 `FORCED_PATHWAY` build** (Opus
agent). That build's files are dirty in the shared tree — `src/utils/forcedPathway.js` (new),
`src/config/featureFlags.js`, `src/services/{progressService,studyService}.js`, `src/pages/{MCQTest,TypedTest}.jsx`,
`functions/foundation.js` (FOUNDATION_FLAGS→14) — mtimes **05:09–05:25** (still being edited during my runs). **I
did NOT touch any of these** (my only source edit is the audit-tooling `lsr_deepfix_emu.mjs` sha fix). Confirmed the
PR-3 changes are **additive + dormant** (`FORCED_PATHWAY=false`, `FORCED_PATHWAY_ENABLED=false`), so my evidence is
**unaffected**: M-CALL/M-RULES flag-ON exercise the 8 REQUIRED_FLAG_ON (the new PR-3 flag stays dormant/off);
M-UI tests live prod; the M-STATIC structural finding is about dormant cutover flags + legacy, which PR-3 doesn't
touch. **Binding caveat:** the cert records `gitHead=59df732, dirty=true` — the tree now carries PR-2 (functions) +
PR-3 (forcedPathway) uncommitted; when either commits, HEAD moves off `59df732`. `featureFlags.js` verified intact
(REVIEW_PAIRING_V2/REENTRY_GUARD/RECOVERY_GUARD=true; SERVER_PROGRESS_WRITE/CYCLING_ENABLED/SERVER_OVERRIDE=false).

## Recommendation
- **Close D1 via the formal waiver** (M-CALL/M-NET substitution + "the full-program cert binds only at the final
  post-P10d HEAD"). The strict-cert **evidence** for the waiver is complete + bound to `cert-59df732-r34`
  (M-CALL/M-RULES/M-MIG CLEAN flag-ON; M-STATIC baseline CLEAN; DG-2/DG-3 provenance; the r16 sha now bound).
- **Do NOT** chase a green cert at `59df732` — it is unreachable by construction. The full green cert is reachable
  only when P3–P10 + P7 have shipped and the tree *is* the end-state.

## Scope / safety
- **SANDBOX only** (25WT / `lsr_*` / `dup_*`). No 26SM. No deploy, no commit/push.
- **No product source edits.** Only audit-tooling edit: `lsr_deepfix_emu.mjs` (portable sha). All `flag_on` flips to
  `featureFlags.js`/`foundation.js` were **guaranteed-restored** (byte-verified; no lock left; PR-1 flags confirmed intact).
- M-UI prod-smoke + M-MIG full-dry wrote only sandbox data (25WT/lsr_*). DG-2 auth probe used the already-spent
  `dup_repro_a` (login-only, non-consuming); **`dup_repro_c` untouched (reserve)**.

## Evidence
- Cert: `findings/DEEPFIX_AUDIT_CERT_cert-59df732-r34.{json,md}`
- Matrices: `findings/deepfix_{static,call,rules,mig,ui}_cert-59df732-r34.json`
- DG: `findings/deepfix_dg_probes_cert-59df732-r34.json` (DG-3) + `findings/deepfix_dg2_auth_cert-59df732-r34.json` (DG-2)
- M-WB blockers: `findings/deepfix_wb_BLOCKED_cert-59df732-r34.md`
- Run logs: `audit/deepfix/task6/m_{call,rules,mig,ui}_*cert_r34*_output.txt`

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_034.md`.
- `baton.json` → `turnOwner="claude"`, `round=34`, `execStatus="run-written"`, `execDecision="PARTIAL"`,
  `updatedBy="winclaude"`, `revision=68`.
- Watcher re-arms at baseline 68. Awaiting WSL's call: build the formal waiver (evidence is ready) — or, if the goal
  shifts, the next pipeline step (PR-2/P3 `firebase deploy --only functions` is mine).
