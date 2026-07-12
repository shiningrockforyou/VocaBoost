# RESUME — current active work

> **This is the canonical resume file.** When the user says "resume," read this first, then any
> linked spec. **Rotate at each save-state:** copy this file to `docs/resume_archive/RESUME_<date>.md`
> (copy, don't move), then overwrite the active-stream section below with the new state. History lives
> in `docs/resume_archive/` (see its README).

---

## ▶ ACTIVE STREAM (updated 2026-07-12): LIST_SCOPED_RECON flag-ON — validation (Run S / Run S-Long) + the #10 fix it surfaced

**Big picture.** `LIST_SCOPED_RECON` is ENABLED (David pushed 2026-07-12; all 17 attempts indexes verified
live+READY). The class-change/cross-class reconciliation (NEED_TO_FIX #6 fix) is live. On top of it, the
cross-class-review bug **#9** was found, fixed (code-review-clean, deployed), and its acceptance test is Run S.
Building the **live Playwright validation** surfaced a NEW latent bug **#10** (pre-completion reconciliation
self-race). Everything runs through the Claude⇄Codex+3-agent **loop** (`docs/plans/loop/`).

### ✅ DONE
- **#6 fix (LIST_SCOPED_RECON) ENABLED + live-cohort-clean.** `featureFlags.js:41 = true`. Post-deploy sweep
  clean; 0 CSD demotions across 297 reconciliations; indexes READY.
- **#9 fix (cross-class review completion) — deployed + code-review-clean.** 3 files (studyService/db/
  progressService), all flag-gated. Design + code both looped to Codex GO. `docs/plans/loop/fix9/`.
- **Run S design (S-1..S-9) — Codex GO.** `docs/plans/loop/runs/plan.md`. S-1 is the #9 flagship acceptance.
- **Run S-Long design (10 CS-grounded personas × 16+ days × reassignments) — Codex GO (5 rounds).**
  `docs/plans/loop/runslong/plan.md` v4 + `CONVERGED.md`. Foundation-first: Phase-1 day-primitive gates the rest.
- **Run S-Long Phase-1 harness — code-review CLEAN (Codex GO, 4 rounds + 3-agent).**
  `audit/playwright/lsr_runSL_phase1.mjs`. Guards: required BUILD_ID, unique class binding, exact assignment
  verify, pristine baseline, UI-primary gate + FB read-only poll + exact attempt deltas + dup-fail, fatal-
  findings gate, state-aware rebuild recovery, rich rebuild diagnosis (captures the app's own day-guard warn).
- **Smoke test (2 days)** VALIDATED the harness (day 1 fully confirmed; rebuild recovered + diagnosed; day 2
  failed-CLOSED not false-pass) and SURFACED #10.

### 🐛 NEED_TO_FIX #10 (NEW — Codex root-caused, Claude code-verified) — the current work
Flag-ON self-race: on a session-final completion, `getOrCreateClassProgress` (`TypedTest.jsx:979`,
`MCQTest.jsx:717`) reconciles+writes the advanced CSD from the just-written attempt BEFORE
`completeSessionFromTest` → completion is stale → day-guard (`progressService.js:442`) blocks it → "session
refreshed" rebuild. Typed AND MCQ. **0 live-cohort occurrences (latent); real code-level self-race,
deterministic in the fast audit driver.** Corrected an earlier WRONG "harness-only" conclusion (build log).

### ▶ NEXT (David's directive 2026-07-12)
1. **#10 app fix** — write plan → **3-agent audit (FABLE agents)** → Codex loop → (go-ahead) implement.
   Fix direction (Codex): don't reconcile between attempt-write and completion for a final-test completion, OR
   make completion idempotent to "already reconciled from this same day's attempt". `docs/plans/loop/fix10/`.
2. **Harness workaround** for Run S-Long Phase-1 (fresh-context / settle-before-navigate) — a DRIVER fix, not
   a resolution of #10 (which is fixed separately in app code).
3. **Run the Playwright tests together** — Run S-Long updated to ALSO validate the #10 fix (a day-completion
   overlay asserting no spurious rebuild). Then Phase-1 (16 clean days) → personas → fleet.

### Loop mechanics (reference)
`docs/plans/loop/` — baton.json turn-token; Claude self-wakes via `lib/baton-watch.sh`; Codex reviews via the
long-turn session (writes `codex_reviews/`, flips the baton). Standing rule: **NO source-code change until
Codex signs off the plan AND David gives explicit implementation go-ahead** (reverting counts too). Sandbox
only for audits (25WT / `lsr_*` / fresh classes) — NEVER 26SM. PowerShell `.ps1` from WSL = ASCII-only.

**Standing constraints:** owner deploys code (Claude can't build/deploy); never commit/branch without say-so;
log code→`change_action_log.md`, CS/data→`SUPPORT_RUNBOOK.md`; read-only Firebase for audits (never write to
advance a run). Playwright browser: `PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright`.
