# LSR UI Audit — Master Plan (F02/F03 verification + comprehensive regression)

**Status:** REBUILT after Codex NO-GO (2026-07-05, 4 blockers) → focused F02/F03 **acceptance run** ready;
awaiting a Codex re-review before launch. **Owner-facing plan.**

This is the single consolidated plan for the Playwright audit following the **F02/F03 fixes** (deployed
2026-07-05, flag `LIST_SCOPED_RECON` still OFF). It ties together the four existing docs and adds the
execution plan, the setup inventory, the recovery protocol, and the acceptance criteria.

## 0. What the Codex NO-GO changed (2026-07-05)
The first plan was a NO-GO — it could false-pass F02/F03 and used runtime Admin mutation. Rebuilt into a
**focused, hardened F02/F03 acceptance run** (`lsr_accept.mjs`):
- **No Admin mutation at runtime.** `lsr_accept.mjs` never imports firebase-admin. Every actor state is built
  **forward-only through the real UI** (teacher creates a fresh disposable class + assigns; a fresh
  never-reused student joins + studies). Read-only CSD/TWI checks are a **separate** process after close.
- **Hard preconditions** abort a scenario to **INVALID** (never PASS) if setup can't be built via UI; the
  F02 assertion compares the **exact** TOP label and requires CORE to actually appear as an option (so a
  silently-failed teacher assign can't read as "unchanged/good" — the original false-pass).
- **Scenario-controlled dialogs** (`armDialog`): unexpected dialogs are recorded + dismissed + flagged, never
  silently accepted. TA2 tests the full F03 contract (cancel-preserves / accept-strands / exact warning).
- **Nonzero exit** on any FAIL/INVALID/error; **acceptance matrix** where only PASS counts.
- **Teacher-wave / reset / concurrency scenarios are SPLIT OUT** into a separate later campaign (they add
  state risk without strengthening these two fixes).
- **Credentials** load from `LSR_AUDIT_PW` / gitignored `.lsr_secret.json` — no hard-coded passwords.

**Companion docs (read alongside):**
- Policy / constraints (binding): `docs/plans/PLAYWRIGHT_AUDIT_list_progress_persist_phase1.md`
- Batch spec + CS-log traceability: `batches/B_LIST_PROGRESS_PHASE1_UI.md`
- Teacher-concurrent scenario catalog: `SCENARIO_CATALOG_teacher_concurrent.md`
- Prior findings / infrastructure save-state: `LSR_AUDIT_RESULTS.md`

---

## 1. Purpose & what we're verifying

1. **Prove the F02/F03 fixes work in the live app** (before/after, using the exact scenarios that surfaced them).
2. **Regression-sweep the blast radius** — F02 changed shared Dashboard state (`getPrimaryFocus`,
   `progressData` shape, hero render, per-list Start gating, readiness). That touches **every student's
   dashboard**, so normal flows must be re-proven, not assumed.
3. **Comprehensive teacher-concurrent coverage** — run the rest of the encoded teacher-move scenarios
   (assign/unassign/settings/remove/reset/concurrent-completion) that historically caused the most CS pain.
4. **Flag-off regression (Run L)** — confirm the deployed Phase-1 code is behavior-neutral with the flag off
   (this is what actually gates enabling the flag later).
5. **Record ANY AND ALL bugs** that surface — in-scope or tangential — per the mandatory findings protocol.

**The two fixes under test:**
- **F02** (`Dashboard.jsx`): default list now prefers the list the student has active progress on (recency-
  ranked); success-based `progressReady` gate; fail-closed on incomplete/errored progress.
- **F03** (`ClassDetail.jsx`): unassign confirm reworded to honestly warn students lose access (warn-only).

---

## 2. Policy & constraints (binding — from the policy doc)

- **All interaction is UI-only.** Semantic locators, visible controls. **NO** `page.evaluate` / injected JS /
  storage access / request interception / deep-links to internal routes / `{force:true}`.
- **Admin SDK is NEVER used at runtime by the acceptance run** (`lsr_accept.mjs` imports no firebase-admin).
  The only Admin usage is three **separate** processes: (a) owner-authorized **provisioning** BEFORE the run
  (accounts, list clones); (b) `lsr_preflight.mjs` — **read-only**, proves clean accounts, before browsers;
  (c) `lsr_postverify.mjs` — **read-only**, confirms TA2 CSD/TWI, after all browsers close. No per-scenario
  resets, no runtime mutation. (Reset-based teacher-wave scenarios are the DEFERRED campaign, §6b.)
- **Sandbox only:** 25WT `lsr_*` accounts. **Never** touch 26SM (real cohort).
- `scripts/serviceAccountKey.json` gitignored, never committed. Owner deploys code; the harness never does.

---

## 3. Setup / infrastructure (all built, reusable)

**Accounts (32):** `lsr_teacher_01/02`, `lsr_s01`–`lsr_s30` (password from `LSR_AUDIT_PW` / gitignored
`.lsr_secret.json`, never in source). Roster: `lsr_accounts.json`. **Cleanliness is PROVEN, not assumed:**
a local "used" list is insufficient because `lsr_prep.mjs` already dirtied part of the pool. `lsr_preflight.mjs`
(read-only) verifies each candidate has **no saved `primaryFocusListId`, no class/list progress, no attempts**
and emits `lsr_clean_accounts.json`; `lsr_accept.mjs` allocates **only** from that allowlist (forward-only,
each used once). If the clean pool runs low, provision fresh `lsr_*` accounts and re-run preflight.

**Lists (admin-cloned, owned by `lsr_teacher_01`):** `LSR TOP Vocab (audit clone)` = `EQ0Dc9rb7gvoerflHlnz`
(3381 words) · `LSR CORE Vocab (audit clone)` = `aDVcq3MoCvVYPTpb83IU` (3380). `lsr_lists.json`.

**Classes (7):**
- Persona (Run L/S): `25WT LSR-A/B TYPED` (pace 80/100), `25WT LSR-A/B MCQ` (80/100) — all TOP, thr 92, tsN 30.
- **Isolated** teacher-wave: `25WT LSR-TCH-A/B/C` (pace 80/100/60, TOP) — destructive teacher moves hit these,
  never the persona classes. Join codes: `lsr_prep_state.json`.

**Student personas (13, built):** dual-enroll, move, same-day-join, stale-session (typed+MCQ), mixed-history —
built through realistic interleaved timelines (study in A → join B mid-course). Mapping: `lsr_personas.json`.

**Answer key:** `wordmap.json` rebuilt from the lists' own definitions (careful answers = 100%).

**Scripts — the focused F02/F03 acceptance run (`audit/playwright/`):**
- `lsr_ui.mjs` — UI primitives (login, join+recover, study, robust `readFocusList`/`listSelectorOptions`/
  `readVisibleProgress`, scenario-controlled `armDialog`/`lastDialog`).
- `lsr_teacher.mjs` — teacher primitives (createClass, assignList, unassignList w/ dialog intent, readJoinCode).
- `lsr_preflight.mjs` — **read-only** Admin; proves clean accounts → `lsr_clean_accounts.json`.
- `lsr_accept.mjs` — the **Admin-free** acceptance runner (TA1/TA2/M1/M3/M5) → matrix + manifest.
- `lsr_postverify.mjs` — **read-only** Admin; consumes the manifest, confirms TA2 CSD/TWI, prints the FINAL verdict.
- (Deferred campaign, §6b: `lsr_orchestrate.mjs`, `lsr_prep.mjs`, `lsr_snapshot.mjs`, `lsr_runL/S.mjs`.)
- Pre-audit provisioning (owner, authorized): `lsr_provision.mjs` / `lsr_clone_lists.mjs`.

**Launch sequence (3 processes, cleanly separated):**
```
1. NODE_PATH=/app/node_modules node audit/playwright/lsr_preflight.mjs      # read-only → clean allowlist
2. LSR_AUDIT_PW=… NODE_PATH=/app/node_modules node audit/playwright/lsr_accept.mjs   # browsers, Admin-free
3. NODE_PATH=/app/node_modules node audit/playwright/lsr_postverify.mjs     # read-only → FINAL verdict
```

---

## 4. Recovery protocol + the reconciliation with test validity (user directives, 2026-07-05)

When a scenario hits a broken state, the harness does NOT silently retry it away:
1. **Records it as a first-class `BUG`/finding** (with evidence, e.g. "candidate phantom membership, rules:57-60").
2. **Attempts escalating recovery**, logging each rung's outcome: **refresh → re-submit the action → relaunch
   the browser context (new context + re-login)**.
3. **Records which rung (if any) recovered it** ("after refresh → still broken" / "after browser relaunch →
   RECOVERED ✓" / "STILL broken (persistent — likely a real bug)"). Transient-vs-persistent is a diagnostic.

**Reconciliation with validity (David's call):** recovery keeps the run *going* and keeps the *finding*, but
it does NOT manufacture a pass. If recovery restores the required state → continue. **If a precondition can't
be restored → the scenario is INVALID and its dependent checks are SKIPPED (never PASS)**, and the run exits
nonzero. A recovered defect remains a finding.

Implemented as `recoverProbe()` (page-level) + orchestrator `relaunchActor()` (context-level). In
`lsr_accept.mjs` the `need()` helper does one page-level recovery, then marks the scenario **INVALID** on
persistent failure (dependent checks skipped).

---

## 5. Findings protocol

Every anomaly → written to `findings/B_LIST_PROGRESS_PHASE1_<runId>.md` (incl. out-of-scope). Each entry:
kind + detail + evidence. Console errors, page errors, request failures, native dialogs auto-captured.
Confirmed product bugs are promoted into `LSR_AUDIT_RESULTS.md` (F-numbered) and cross-referenced to the CS log.

---

## 6. Execution plan — the focused F02/F03 acceptance run (`lsr_accept.mjs`)

Five scenarios; each builds its state forward-only through the UI, then asserts. Only **PASS** counts;
**INVALID** = setup couldn't be built via UI (not a pass); nonzero exit on any FAIL/INVALID/error.
Screenshots captured at each decision point. Est. ~30–60 min (each `studyOneDay` is a full graded cycle).

| ID | What it proves | Key hard assertions |
|---|---|---|
| **TA1** | **F02** — teacher list-add does NOT flip a mid-progress student | before==exact TOP; teacher assign visibly ok; **CORE appears as an option** (condition exercised); **after==exact TOP** (null/CORE/loading = FAIL) |
| **TA2** | **F03** — honest, warn-only unassign; cancel preserves, accept strands, progress kept | dialog appears; text has "LOSE ACCESS" + "re-assigned" + preserved/hidden; **cancel → still assigned + reachable**; **accept → unassigned + access lost**; CSD/TWI-preserved via separate snapshot |
| **M1** | F02 — zero-progress student still defaults to newest-assigned | both lists shown; **focus == CORE** (newest); fallback preserved |
| **M3** | F02 — explicit saved preference still wins over progress/recency (§1 intact) | after explicitly selecting CORE (no progress) with TOP progressed, **focus == CORE** |
| **M5** | Regression — single-class flow renders; Start enabled; no retry/skeleton lock | focus==TOP; **no retry card** on healthy load; per-list "Start Session" present + **enabled** |

**Post-run (separate read-only process):** `lsr_postverify.mjs` consumes `lsr_accept_manifest.json`, resolves
the exact uid/classId/listId, asserts TA2 CSD/TWI preserved after unassign, and combines with the matrix +
browser anomalies into the **FINAL verdict** (nonzero exit on any failure). Admin read-only, after browsers close.

## 6b. Deferred to a separate later campaign (NOT in this run)
- **Teacher-wave / reset / concurrency** (TA5/TS1/TS2/TE1/TE2/MS1/AD2/XC3) — needs forward-only rewrites of
  the reset-based `lsr_orchestrate.mjs`; adds state risk without strengthening F02/F03.
- **Run L (flag-off regression)** — gates enabling the flag; run as its own effort.
- **Run S (flag-on)** — needs an owner deploy of a `LIST_SCOPED_RECON=true` build + 7 indexes Enabled.

---

## 7. Known limitations & caveats (stated up front)

- **F02 error / fail-closed path is NOT UI-testable.** The `progressReady`-on-query-error branch, retry card,
  and per-list Start gating on error require inducing a Firestore query failure, which we can't do through the
  UI without injected JS (policy-forbidden). That path stays **code-review + Codex-verified only**. M5 does
  assert the retry card does NOT over-trigger on a *healthy* load. The load-flicker is hard to assert cleanly.
- **Pure recency ranking (recent-shallow beats old-deep) is not cleanly UI-constructible.** Giving a student
  progress on a *second* list requires selecting it, which persists a saved preference — so the no-saved-pref
  recency tiebreak can't be isolated via pure UI. Disclosed; covered by code review. (M3 covers the adjacent,
  constructible case: saved preference wins.) Same class for **class-switch ranking (M4)** — deferred.
- **Admin usage.** `lsr_accept.mjs` does **zero** Admin at runtime; the only Admin is (a) owner-authorized
  account/list provisioning BEFORE the run and (b) a **separate** read-only snapshot AFTER close (TA2 CSD/TWI).
- **Phantom-membership flakiness** (CANDIDATE-1) may still trip join preconditions; recovery (§4) probes it,
  and a persistent failure marks the scenario INVALID (not a false pass).
- **Run S (flag-on)** and **Run L** are out of scope here (§6b).

---

## 8. Deliverables
- Per-run findings files (`findings/…`), updated `LSR_AUDIT_RESULTS.md` (F-numbered confirmed bugs),
  before/after results for TA1/TA2, a Tier-2 regression verdict, and a Run-L flag-off invariance verdict.
- Any new bugs (in- or out-of-scope) promoted to findings + cross-referenced to `NEED_TO_FIX.md` / the CS log.
