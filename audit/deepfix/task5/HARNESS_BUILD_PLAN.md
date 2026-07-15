# Task 5 — deepfix audit HARNESS build plan

**Purpose.** Build the runnable scripts that certify the FIX_PLAN's implemented phases, per
`audit/deepfix/task4/AUDIT_DESIGN.md` (83 scenarios, 6 matrices). **Codex (David's Windows env) is the RUNNER**
for the browser/callable/rules/migration matrices (Task 6, before deploy); this WSL runs only M-STATIC. The
deliverable of Task 5 is: these scripts + `audit/deepfix/task5/CODEX_RUNBOOK.md` (how Codex runs them, logging/
artifacts, pass/fail gate). See memory `codex-runs-playwright-audits`.

## Environment truth (from recon of the existing `lsr_*` harness — binding)
- **No emulator.** Runners are raw Node ESM (`.mjs`) importing `playwright` directly, driving
  `http://localhost:5173`, and white-boxing Firestore via the **Admin SDK on the LIVE prod project**
  (`scripts/serviceAccountKey.json`). Data containment = **sandbox-identity discipline only**:
  `lsr_*@vocaboost.test` students, `25WT`-prefixed classes. **NEVER 26SM.** Import-time localhost-only BASE
  guard (`lsr_ui.mjs:23-31`) makes the live site physically unreachable.
- **Flags are BUILD-TIME constants** (`src/config/featureFlags.js` + server `FOUNDATION_FLAGS` in
  `functions/foundation.js`) — NOT runtime-toggleable. Testing the foundation flag-ON therefore requires a
  **flag-on BUILD** served at localhost:5173, plus a **flag-on functions environment** for the callable/rules
  matrices. Prod runs flags OFF, so we cannot use as-deployed prod for flag-on M-CALL/M-RULES.
  **★ OPEN QUESTION (needs David): the flag-on functions/rules environment** — Firebase **functions+firestore
  emulator** (cleanest, zero prod risk, but new to this harness) vs a **dedicated test Firebase project**.
  M-UI/M-WB/M-MIG (client + Admin-SDK white-box) do NOT need this; only M-CALL/M-RULES do.
- Canonical run pattern: **prep(Admin) → preflight(read-only) → run(browser, Admin-free) → postverify(read-only
  white-box)**. Fail-closed: INVALID ≠ PASS; any anomaly (console-error/pageerror/dialog/auth) = NOT-CLEAN.

## Module map (matrix → file → reuse source → scenarios → runner)
| Module | File (new under `audit/playwright/`) | Reuse | Scenarios (§1) | Runs where |
|---|---|---|---|---|
| **M-STATIC** | `lsr_deepfix_static.mjs` | git/grep/`dist` probes (no lsr dep) | DG-1..4, CUT-1, RET-1..4 (+ flag lifecycle) | **THIS WSL** + Codex (bundle greps need a build) |
| **M-UI** | `lsr_deepfix_ui.mjs` | extend `lsr_reviewonly.mjs` `runScenario`; `lsr_ui.mjs` verbs; `lsr_accept.mjs` structure (need()→INVALID, anomaly gate, bound matrix) | RA1-9, RO-S1/9/10, RS-1..4, CUT-2..4/7/8, CA-1..6, CY-1..7, OV-1/4/5 | Codex |
| **M-WB** | `lsr_deepfix_whitebox.mjs` | extend `lsr_reviewonly_whitebox.mjs` `patchSessionConfig` | W-RA3g/4/4b, CS-11, CUT-5 (storage stub), CUT-6 (forced-deny) | Codex |
| **M-CALL** | `lsr_deepfix_callable.mjs` | NEW (sandbox ID-token mint + guards §4.1); reuse `grading_job_tests.mjs` for CS-10 | CS-1..10, CS-6/M4, CY-3, OV-1/2/3 | Codex (flag-on fns env) |
| **M-RULES** | `lsr_deepfix_rules.mjs` | NEW (client-SDK signed-in-as-sandbox writes) | RUL-1..9, OV-6 | Codex (flag-on rules) |
| **M-MIG** | `lsr_deepfix_migrate_audit.mjs` | NEW driver around `scripts/cs/deepfix-migrate-list-progress.mjs` (--dry→commit on 25WT) + regression sweep | MIG-1..10, RET-3 | Codex (25WT sandbox) |
| **Seeds** | `lsr_deepfix_fb.mjs` | extend `lsr_reviewonly_fb.mjs` (assertSandboxTriple, preVerify, snapshotState, resetStudentState) | the §3 seed helper family (19 new) | shared |
| **Cert** | `lsr_deepfix_cert.mjs` | reuse `lsr_fleet_manifest.mjs` binding pattern | program cert consolidator (§2) | Codex |

## Build order (dependency-first; each module orchestrator-verified per H1 before the next)
1. ~~**M-STATIC**~~ ✅ **DONE + orchestrator-verified (H1).** `lsr_deepfix_static.mjs` built + run: **baseline CLEAN
   27/0/0/2** (2 SKIP = DG-2/DG-3, need a deployed probe → Codex), **shipped NOT_CLEAN 6/21** (phase-awareness
   proven). Ground truth independently confirmed (P0 disarm + all foundation flags dormant). Re-run as each phase
   lands + at ship time (`--target=shipped` goes green only post-P7). Known limitation: CUT-1 is a coarse
   source-grep proxy → authoritative CUT-1 = bundle grep + M-UI (Codex). Ship-time: DG-2/DG-3/DG-4 must bind the
   DEPLOYED sha to a COMMITTED state (foundation edits are uncommitted per the no-commit rule).
2. **`lsr_deepfix_fb.mjs`** (seeds) — every browser/mig matrix depends on it. Extends the reviewonly fb module.
3. **M-UI** + **M-WB** — the bulk of E2E/white-box; share the seed module and `lsr_ui.mjs` verbs.
4. **M-MIG** — wraps the (converged) P5 script; the 25WT rehearsal formalized with oracles.
5. **M-CALL** + **M-RULES** — gated on the flag-on functions/rules env decision (★ above).
6. **Cert consolidator** + **`CODEX_RUNBOOK.md`** — the run instructions (env, flag-on build steps, per-matrix
   invocation, logging/artifact paths, the fail-closed program-certification gate).

## Coverage-vs-foundation status (what's audit-able today)
- **P0-P6 = Codex-converged** → their matrices (DG, RO, RS, CS, CUT, MIG, RUL) are buildable NOW.
- **P9 (CY) / P10 (OV)** rows need those phases implemented first (file:line pins at impl review) — build the
  M-UI/M-CALL/M-RULES *scaffolding* now, add CY/OV scenarios when P9/P10 land.
- **P7 (RET)** rows (zero-refs grep, retirement inventory, flag lifecycle) are M-STATIC assertions that go GREEN
  only after P7 is applied (post-deploy); today they assert the *pre-retirement* dormant-draft state.
