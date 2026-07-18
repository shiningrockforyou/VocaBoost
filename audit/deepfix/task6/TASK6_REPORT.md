# DEEPFIX TASK-6 (AUDIT RUN) — ACCEPTANCE REPORT

**Date:** 2026-07-17 · **Author:** consolidation pass (factual synthesis of the on-disk evidence).
**Scope:** the Task-6 acceptance audit of `audit/deepfix/task2/FIX_PLAN.md` per `audit/deepfix/task4/AUDIT_DESIGN.md`
(83 scenarios) and `audit/deepfix/task5/CODEX_RUNBOOK.md`. Governs roadmap **D1** (`docs/plans/SESSION_TODO_2026-07-17.md`)
/ Track-2 step 1 (`docs/plans/CONSOLIDATED_ROADMAP_2026-07-17.md`).

> **This report PREPARES for the Codex end-gate; it does NOT replace it and does NOT self-approve.**
> The Codex end-gate is a HARD gate that has NOT been run (§5). Every result below is transcribed from a
> findings JSON/MD or an executor review; claims I could not back with an artifact are flagged in §6.

---

## 0. Bottom line up front

- **6 matrices are individually GREEN / characterized** — but across **two different git HEADs** and **two flag
  states**, and with one design matrix (M-WB) swapped out for an ad-hoc one (M-NET). They are **not** a single
  bound run.
- **No consolidated single-runId certification exists.** `lsr_deepfix_cert.mjs` is built + self-validated but has
  **never been run on real findings** — there is **no `findings/DEEPFIX_AUDIT_CERT_*.{md,json}`** on disk.
  Single-runId cert = **OPEN** (§4).
- **flag-ON M-UI = DEFERRED-documented** (harness fixture-gap), joining **CS-7 / CS-10 / DG-2 / DG-3** (§3).
- **All W-\* (white-box / M-WB) findings classify as harness-artifacts** — zero product defects (§2).
- **prod-smoke STEP1: BLOCKED → RESOLVED** (4/4 green, `prod-smoke-r2`).
- **One live discrepancy:** the latest M-STATIC run on the live tree is **NOT_CLEAN 38/3** — the 3 FAILs are the
  **PR-1 client flags** (a separate CS track, explicitly out of D1 scope), not deepfix-baseline defects (§1 / §6).

---

## 1. Matrix certification table

Column key — **Result** = the matrix's own verdict + counts (`pass/fail/invalid/skip`, `+deferred` for MIG).
**Cert** = CERTIFIED (green, in-scope) · DEFERRED-documented · OPEN.

| # | Matrix | Run (runId · date · git · env) | Result | Cert | Evidence |
|---|---|---|---|---|---|
| 1 | **M-STATIC** (flag-table / static signatures) | `4b8452a-baseline` · 2026-07-17T18:45Z · git `4b8452a` · WSL | **NOT_CLEAN 38/3/0/2** (latest) | **CERTIFIED for the deepfix baseline, but latest run RED — see note** | `findings/deepfix_static_4b8452a-baseline.{json,md}` |
| 1b | M-STATIC (prior clean baselines) | `wsl-verify` / `wsl-postfix` / `a967f54-baseline` / `p7final` · git `a967f54`-era | **CLEAN 27/0/0/2** ×4 | CERTIFIED (dormant-flag table, pre-PR-1) | `findings/deepfix_static_wsl-verify.json` (+3 siblings) |
| 2 | **M-CALL** (server callables, emulator) | `flagon_r27` · 2026-07-17T17:01Z · git `4b8452a` · emulator `demo-vocaboost` (fs8080/auth9099/fn5001) | **CLEAN 21/0/0/2** | **CERTIFIED** (flag-ON) | `findings/deepfix_call_flagon_r27.{json,md}` · `winclaude_027.md` |
| 3 | **M-RULES** (firestore rules-test) | `emu-r1` · 2026-07-14T11:54Z · git `a967f54` · emulator | **CLEAN 11/0/0/0** | **CERTIFIED** | `findings/deepfix_rules_emu-r1.{json,md}` |
| 4 | **M-MIG --dry** (migration dry-run) | `mig-r19` · 2026-07-15T10:56Z · git `a967f54` · cohort `/25WT/i` | **10/0/0 PASS + 8 DEFERRED + 1 SKIP** (top verdict `NOT_CLEAN` by design) | **CERTIFIED (--dry scope)**; commit legs DEFERRED to Codex | `findings/deepfix_mig_mig-r19.{json,md}` |
| 5 | **M-NET** (network resilience) | `net-r24` · 2026-07-15T11:45Z · git **not recorded in JSON** | **CLEAN 3/3** | **CERTIFIED** — but ad-hoc matrix (see note) | `findings/deepfix_net_net-r24.{json,md}` |
| 6 | **M-UI flag-off** (prod-smoke) | `prod-smoke-r2` · 2026-07-17T16:58Z · git `4b8452a` · BASE `https://vocaboostone.netlify.app` (sandbox `lsr_s130-133`) | **PASS 4/4** (RO-S1, RO-S9, RS-1, RS-2) | **CERTIFIED** (STEP1 blocked→resolved) | `findings/deepfix_ui_prod-smoke-r2.{json,md}` · `winclaude_026.md` |
| — | **flag-ON M-UI** (RS-3 render, CUT client→server routing) | not run — `winclaude_028` **BLOCKED** (investigation only) | DEFERRED | **DEFERRED-documented** (§3) | `winclaude_028.md` · `winclaude_029.md` |
| — | **M-WB** (white-box — the AUDIT_DESIGN §0.1 6th matrix) | `wb-r25` 0/6 · `winclaude-wb-r14` 0/4 · `winclaude-wb-r13` 0/6 · git `a967f54` | **NOT-CLEAN, 0 PASS (all INVALID/FAIL)** | **OPEN → reclassified harness-artifact** (§2) | `findings/deepfix_wb_wb-r25.{json,md}` |

### M-STATIC note (the live discrepancy — see §6 GAP-1)
The 3 FAILs in `4b8452a-baseline` are `DG-1:REVIEW_PAIRING_V2`, `DG-1:REENTRY_GUARD`, `DG-1:RECOVERY_GUARD`
(expected `false`, actual `true`) — the **PR-1 client flags**. `change_action_log.md` (2026-07-17 entry) records
this as **transiently NOT_CLEAN**: the flags read `true` because WinClaude's concurrent flag-ON dev-E2E
(`winclaude_030/031`, guaranteed-restore) had them flipped; WSL-Claude expected the restored true-baseline to be
**CLEAN 41/0**. **`winclaude_032` then flipped PR-1 LIVE** (commit `59df732`, those 3 flags now committed `true`),
so a fresh `--target=baseline` run will **still** show 3 FAIL until the static baseline table is re-based to expect
the post-PR-1 values. **PR-1 is a separate CS track — roadmap D1 explicitly scopes it OUT** ("D1 closes ONLY the
current deepfix/live-baseline harness — PR-1/PR-2/PR-3 each need their OWN gate"). For the **deepfix** flag-table
(the 11 foundation flags + P-flags, all dormant `false`) M-STATIC is green; the 3 FAILs are not deepfix defects.

### M-NET note (matrix-identity discrepancy — see §6 DISCREPANCY-1)
`AUDIT_DESIGN.md` §0.1 and the cert consolidator (`CERT_BUILD_NOTES.md`) define the **6 matrices** as
**{M-STATIC, M-UI, M-WB, M-MIG, M-CALL, M-RULES}**. The roadmap / `M_UI_CALIBRATION_LOG.md` "ALL 6 MATRICES
CERTIFIED" tally instead lists **{M-STATIC, M-CALL, M-RULES, M-MIG --dry, M-NET, M-UI flag-off}** — i.e. it
**substitutes M-NET (ad-hoc, `lsr_deepfix_netresilience.mjs`, built rounds 20-24) for the un-runnable M-WB.**
Both facts are true; they are two different "6." The automated consolidator still expects an M-WB JSON, not M-NET.

---

## 2. W-\* (white-box / M-WB) findings — classification

The M-WB matrix (`lsr_deepfix_whitebox.mjs`) never produced a clean run. Its scenarios are the "W-\*" set plus the
whitebox-driven CS-11 / CUT-5 / CUT-6. **Every finding classifies as a harness-artifact; none is a product defect.**
The underlying behaviors are covered by other matrices or by the deferred flag-ON leg.

| W-\* scenario | Latest verdict / signal | Root cause | Class | What actually covers the behavior |
|---|---|---|---|---|
| **W-RA3g** (reviewOnlyDay skips the gate) | `winclaude-wb-r14`: FAIL "csd 4→4"; `wb-r25`: INVALID "could not reach the review test" | wordmap "neutral"-answer seed gap → student scored 67% (<92% gate) → app **correctly** refused to advance (`change_action_log.md` 2026-07-14 wordmap fix) | **harness-artifact (app-correct)** | server `reviewOnlyDay` gate-skip = **M-CALL CS-4a/b/c CLEAN** |
| **W-RA4** (absent config → gate fails CLOSED) | FAIL: `locator.click Timeout 30000ms` on Submit | reach-submit flow-gap in the whitebox reach-test-route path (later fixed in the shared `lsr_ui` primitives) | **harness-artifact** | gate-fails-closed is a client-only path; deferred to flag-ON M-UI |
| **W-RA4b** (stale finite `newWordCount:0` does NOT open gate) | FAIL: Submit `Timeout 30000ms`; `wb-r25` INVALID | same reach-submit flow-gap | **harness-artifact** | deferred to flag-ON M-UI |
| **CS-11** (derivation-mismatch tripwire, WB arm) | INVALID "no `reviewonly_derivation_mismatch` — completeSession tripwire not active in this env" | tripwire needs **flag-ON server**; the WB env is flag-OFF client | **harness-artifact (env-gap)** | **M-CALL CS-11m / CS-11a CLEAN** (mismatch fires / agree = silent) |
| **CUT-5** (nonce F1/F3 storage-stub) | INVALID "no NEW attempt doc / save leg not observed"; `wb-r13` Vite `firebase/firestore` import-path failure | crafted storage-stub / injected-write handle didn't materialize in the browser env | **harness-artifact** | deferred to flag-ON M-UI |
| **CUT-6** (denied-legacy-write handler) | INVALID "injected direct-write handle failed (Vite import path)" | injected direct-write handle module-resolution failure | **harness-artifact** | deferred to flag-ON M-UI |
| **`wb-r25` 18 "fatal anomalies"** | 6× "joined … but the class is NOT present after join — candidate phantom membership"; 12× `GET /src/index.css?t=… net::ERR_ABORTED` | (a) join/seeding race (phantom class membership); (b) Vite dev cache-bust abort on hard reload — a **known non-fatal** dev-only signal (`M_UI_CALIBRATION_LOG.md` r10: added `isDevAssetAbort` to the fatal filter) | **harness-artifact** | n/a (setup noise, not behavior) |

**Net:** M-WB is uncertified because its crafted preconditions could not be materialized in the browser
(answer-seed gaps, reach-submit flow-gaps, flag-OFF env, Vite import-path issues, join races) — **not** because
any asserted behavior failed. The behaviors it targets are either **emulator-certified in M-CALL** (CS-4, CS-11) or
belong to the **deferred flag-ON M-UI** client-render leg. Disposition: **W-\* = harness-artifact / deferred; 0
product-defects.**

---

## 3. Deferred certification legs (documented, non-blocking)

Each is a legitimate deferral with a stated reason and a covering path; none indicates a defect.

| Leg | Where | Why deferred | What covers it |
|---|---|---|---|
| **flag-ON M-UI** (RS-3 assigned-lists render, CUT client→server routing) | `winclaude_028.md` (BLOCKED), confirmed `winclaude_029.md` | **Harness fixture-gap:** `lsr_deepfix_ui.mjs` is hard-wired to **prod** sandbox fixtures (`lsr_lists.json` prod IDs, `lsr_*`/25WT in prod) with **zero emulator awareness**; `scripts/seedEmulator.js` seeds only generic data. Building an emulator seed is an executor-out-of-scope harness change. | (a) M-CALL certified the server callables flag-ON on the emulator (`flagon_r27` CLEAN); (b) flag-OFF M-UI passed live (`prod-smoke-r2` 4/4); (c) the unique client-render value is covered by David's **planned post-cutover PROD full-UI audits** (`change_action_log.md` 2026-07-17). |
| **CS-7** (nonce F2 `gradeTypedTest` attemptDocId) | M-CALL `flagon_r27` → **SKIP** | Secret-backed — needs `GRADE_TOKEN_SECRET` + `ANTHROPIC_API_KEY`, absent in the emulator. | Run against **deployed functions** with the grade secret (`--grade-enforced`), per the CS-7 note. |
| **CS-10** (grading-job 7-transition recovery suite) | M-CALL `flagon_r27` → **SKIP** | Uses the **Web SDK** (hangs in the Node emulator shell), targets the **live prod project**, needs the grade secrets. | Run `dsg-edits/srv_validate/grading_job_tests.mjs` separately against deployed functions. |
| **DG-2** (deployed `exports.version` `{sha,dirty,flags}` probe) | M-STATIC → **SKIP** ("no-live-probe") | M-STATIC has no live network. | **Codex must capture the live HTTPS probe at the end-gate** and confirm it equals the bound git HEAD (`CERT_BUILD_NOTES.md` flag 1). |
| **DG-3** (hosting build-stamp sha probe) | M-STATIC → **SKIP** ("no-live-probe") | Same — no live network in M-STATIC. | Codex captures at the end-gate. *(Note: WinClaude did read live `window.__VOCABOOST_BUILD__ = {shortSha:"4b8452a",dirty:false}` in `winclaude_026`/`029` — evidence the stamp is live, but it is **not** recorded as a DG-3 finding row.)* |

Additional **M-MIG commit legs** on the documented DEFERRED ledger (write-guarded, Codex Task-6):
`MIG-6, MIG-7, MIG-9-commit, MIG-9-backup, MIG-10-commit, MIG-10b, RET-3, MIG-TID` (see `deepfix_mig_mig-r19.md`
+ `CERT_BUILD_NOTES.md` ledger). The **--dry oracles** `MIG-1..5 / MIG-8 / MIG-9 / MIG-10a / SELF-EVAL /
SANDBOX-GUARD` all **PASS** and are **not** ledger-deferrable (a `--dry-only` run cannot certify P5).

---

## 4. Single-runId certification status — **OPEN**

**A single-runId program certification does NOT exist.** Findings:

1. **No consolidated artifact on disk.** `find` for `DEEPFIX_AUDIT_CERT_*` returns nothing. The consolidator
   `audit/playwright/lsr_deepfix_cert.mjs` is **BUILT + self-validated (12/12 synthetic)** (`CERT_BUILD_NOTES.md`)
   but has **never been run on real matrix findings** — by design "the REAL program cert runs at Codex's Task-6."
2. **The matrices are not a single bound run.** Verbatim git HEADs from the finding JSONs:
   `M-STATIC 4b8452a` · `M-CALL 4b8452a` · `M-UI(prod-smoke) 4b8452a` · **`M-RULES a967f54`** · **`M-MIG a967f54`** ·
   `M-NET` (no git field in JSON). They span **two HEADs** and were produced on different dates.
3. **As-run, the strict consolidator would NOT certify** — it fails closed on exactly these:
   - `MISSING_MATRIX` — it expects an **M-WB** JSON; the green set substitutes **M-NET** (not consumed). M-UI's
     full 83-scenario set was never run under one runId (only the 4-scenario prod-smoke subset) →
     `COVERAGE_UNAUDITED`.
   - `BINDING_GIT_HEAD` — M-RULES/M-MIG (`a967f54`) ≠ M-STATIC/M-CALL/M-UI (`4b8452a`).
   - `BINDING_STATIC_TARGET` — M-STATIC ran `target=baseline`; the consolidator requires `shipped` to be coherent
     with the flag-ON matrices.
   - `BINDING_FLAG_OFF` — M-RULES ran the **flag-OFF** foundation set; prod-smoke is a flag-OFF build.

**⇒ What "CERTIFIED" requires** (two possible paths, Codex/David to choose):
- **(a) Strict:** a single coherent re-run — all six of the consolidator's matrices (incl. a runnable M-WB or an
  agreed M-WB→M-NET substitution wired into the consolidator), same git HEAD, M-STATIC `target=shipped`, flags-ON,
  full scenario coverage — then `lsr_deepfix_cert.mjs <runId>` exits 0.
- **(b) Pragmatic (what D1 pursues):** accept the per-matrix greens + the documented deferrals (§3) + the W-\*
  harness-artifact classification (§2) as the acceptance basis, and have the **Codex end-gate** bless the
  deferral ledger and capture DG-2/DG-3 live. This is a documented sign-off, **not** a consolidator exit-0.

Either way, **single-runId cert is currently OPEN.**

---

## 5. Readiness statement for the Codex end-gate

**CERTIFIED (green, in-scope) now:**
- M-CALL flag-ON emulator — 21/0/0 (2 documented SKIP).
- M-RULES emulator — 11/0/0.
- M-MIG --dry — 10/0/0 (+ 8 documented commit-leg deferrals).
- M-NET — 3/3.
- M-UI flag-off prod-smoke — 4/4 (STEP1 blocked→resolved).
- M-STATIC deepfix flag-table — CLEAN historically (27/0); see the PR-1 caveat below.

**DEFERRED-documented (non-blocking, covered):** flag-ON M-UI · CS-7 · CS-10 · DG-2 · DG-3 · the 8 M-MIG
commit legs.

**OPEN (must close for a formal cert):**
1. **Single-runId cert** — not produced; consolidator never run on real findings (§4).
2. **M-STATIC live-tree RED** — re-baseline the static table for the post-PR-1 live values (or run it on a tree
   with the 3 PR-1 flags at their intended state) so the live run is CLEAN, and persist that artifact (§6 GAP-1).
3. **W-\* formal disposition** — this report classifies them as harness-artifacts (§2); the Codex gate should
   ratify that disposition.
4. **DG-2 / DG-3 live probes** — Codex captures and confirms `== bound git HEAD` (`CERT_BUILD_NOTES.md` flag 1).
5. **The §6 not-re-executed ledger** — enumerated by the consolidator but existence-checked only by a human/Codex
   (`AUDIT_DESIGN.md` §6; `CERT_BUILD_NOTES.md` flag 2).

**Explicit gate note:** the **Codex end-gate is a HARD gate and has NOT been run.** This report is preparation
only. **No self-approval** — per roadmap D1: *"Codex end-gate (HARD — never self-approve; wait if silent)."* Task 6
is **NOT closed** until Codex signs off.

---

## 6. Gaps & unverifiable items (honest ledger)

- **GAP-1 (M-STATIC "CLEAN 36/0" / "CLEAN 41/0" not artifact-backed).** `change_action_log.md` (2026-07-17, A1 +
  the PR-2 correction) claims the A1-refreshed table verified **CLEAN 36/0** and that the true PR-1-restored
  baseline is **CLEAN 41/0**. **I cannot find a findings JSON for either.** The only post-refresh file on disk is
  `4b8452a-baseline` = **NOT_CLEAN 38/3**; the CLEAN files (`wsl-verify`/`wsl-postfix`/`a967f54-baseline`/`p7final`)
  are the **pre-refresh 27/0** table. So "M-STATIC CLEAN at the full 36/41-row table" is a **log claim, not a
  persisted artifact** — flagged for Codex to reproduce.
- **DISCREPANCY-1 (the "6 matrices").** The roadmap/calibration-log "6 certified" set swaps **M-WB → M-NET** vs
  the AUDIT_DESIGN / consolidator's canonical six (§1 M-NET note). Both are internally consistent but they are
  **different sets**; the automated consolidator cannot consume the M-NET-substituted set without a code change.
- **DISCREPANCY-2 (doc says "ALL 6 CERTIFIED" — findings say split-git + no consolidated cert).**
  `M_UI_CALIBRATION_LOG.md` ("★ ALL 6 MATRICES CERTIFIED") and `CONSOLIDATED_ROADMAP` read as a finished program.
  The findings show the greens are real **but** span two git HEADs and two flag-states with **no single-runId
  cert** (§4). "Certified" here means "each matrix green in isolation," **not** "the program certified on one bound
  deployment." D1 correctly still lists single-runId cert + Codex gate as OPEN.
- **DISCREPANCY-3 (M-MIG top verdict).** `mig-r19.json` top verdict is **`NOT_CLEAN`**, which at a glance reads as
  a failure; it is `NOT_CLEAN` **only** because 8 write-legs are DEFERRED — the **--dry oracles are 10/0/0 PASS**.
  Represented here as "CERTIFIED (--dry scope)." Confirm the consolidator's DEFERRED-ledger treats all 8 as
  ledgered (it does, per `CERT_BUILD_NOTES.md`).
- **M-NET provenance thin.** `deepfix_net_net-r24.json` carries **no git field** (verified: `grep -c git` = 0) and
  no flag-set; its binding to `4b8452a`/`a967f54` is inferred from the 2026-07-15 run date only. Also, M-NET is
  **not** part of the AUDIT_DESIGN scenario set — it is an ad-hoc resilience matrix. Its 3/3 is real but
  un-bindable by the consolidator.
- **DG-3 not recorded as a finding.** The live build-stamp was observed (`winclaude_026`/`029`) but there is no
  DG-3 finding row; treat DG-3 as SKIP-in-M-STATIC pending Codex's recorded probe.
- **Emulator "rules sha256: null".** Both M-CALL and M-RULES record `firestore.rules sha256: null` — the
  rules-artifact binding the AUDIT_DESIGN §2.2(c) calls for is **absent** from those two runs; the consolidator's
  `BINDING_RULES_SHA` check therefore has nothing to bind. Flagged for the end-gate.
- **Not independently re-executed.** I did **not** re-run any matrix, emulator, or probe (read-only synthesis).
  All verdicts are as-recorded in the finding artifacts; I verified counts/verdicts/git against the JSONs but did
  not re-derive them from a live run.

---

## Appendix — primary evidence paths

- Matrices: `audit/playwright/findings/deepfix_{static_4b8452a-baseline, call_flagon_r27, rules_emu-r1, mig_mig-r19,
  net_net-r24, ui_prod-smoke-r2}.{json,md}` · white-box `deepfix_wb_{wb-r25, winclaude-wb-r14, winclaude-wb-r13}.{json,md}`
  · prior clean static `deepfix_static_{wsl-verify, wsl-postfix, a967f54-baseline, p7final}.json`
- Executor reviews: `docs/plans/loop/win/reviews/winclaude_026.md` (prod-smoke STEP1 blocked) · `_027.md` (M-CALL
  flag-ON r27) · `_028.md` (flag-ON M-UI BLOCKED) · `_029.md` (deferral confirmed) · `_030/_031.md` (PR-1 dev-E2E)
  · `_032.md` (PR-1 flip live).
- Specs/gates: `audit/deepfix/task4/AUDIT_DESIGN.md` (6 matrices, 83 scenarios, §2/§5/§6) ·
  `audit/deepfix/task5/CODEX_RUNBOOK.md` (run choreography, §5 fail-closed gate) ·
  `audit/playwright/CERT_BUILD_NOTES.md` (consolidator logic + DEFERRED ledger + Codex-flagged gaps) ·
  `audit/deepfix/task6/M_UI_CALIBRATION_LOG.md` (M-UI/M-NET calibration history).
- Roadmap: `docs/plans/SESSION_TODO_2026-07-17.md` (D1) · `docs/plans/CONSOLIDATED_ROADMAP_2026-07-17.md` (Track 2
  step 1). Change history: `change_action_log.md` (2026-07-17 A1 / prod-smoke / flag-ON-M-UI-deferred / PR-2
  M-STATIC-transient entries).
- STALE (structure/context only, not current facts): `audit/deepfix/task7/TASK7_FINAL_REPORT.md`.
