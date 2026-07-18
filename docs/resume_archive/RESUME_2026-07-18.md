# RESUME — current active work

> **Canonical resume file.** When the user says "resume," read this first, then the linked spec. **Rotate at each
> save-state:** copy to `docs/resume_archive/RESUME_<date>.md` (copy, don't move), then overwrite below.

---

## ▶ ACTIVE STREAM (rotated 2026-07-17c, post-situation-confirm): full-implementation run — PR-1 GO'd, mid-pipeline

**READ FIRST: `docs/plans/SESSION_TODO_2026-07-17.md`** (the primary task list, 3-agent + Codex converged) and
**`docs/plans/CONSOLIDATED_ROADMAP_2026-07-17.md`** (the reconciled roadmap grounded in the LIVE deploy; sequencing
**Codex-GO round 10, `codexConverged`**). Do NOT treat FREENAV/PR-1 as unstarted — both are closed/GO'd (see below).

### Situation re-confirmed 2026-07-17 (post-freeze, Codex round 13 = CORRECTION → applied)
Session froze ~17:30Z right after Codex GO'd PR-1 round 12. On resume, batoned Codex + WinClaude to re-confirm state.
Codex CONFIRMED the operational reconstruction (PR-1 GO; PR-1 remaining = census re-run + dev-E2E; deploy baseline
unchanged; task-list position) and issued ONE correction: **this RESUME was stale** (said FREENAV open / PR-1 unwritten)
— corrected by this rotation. (`codex_reviews/codex_review_013.md`.) WinClaude round-29 confirm was still pending at write.

### VERIFIED live deploy state — do NOT regress to "undeployed"
- **Client = `4b8452a`, live since 07-15 22:46Z** (== HEAD == origin/main; prod bundle build-stamp confirmed).
- **Functions = the deepfix tree, DEPLOYED-DORMANT** (prod `completeSession` → FAILED_PRECONDITION deepfix-only string).
  All 11 FOUNDATION_FLAGS false; **`ANCHOR_VALIDATION_SHADOW=false` → the 14-day M4 shadow clock has NOT started.**
- **Rules = pre-deepfix** (P6/R1, R2, R3 un-deployed; repo `firestore.rules` = the P10d FINAL artifact — NEVER bare-deploy).
- Client flags: only `SERVER_ATTEMPT_WRITE` + `LIST_SCOPED_RECON` true; PR-1's 3 flags false + DCE'd. Nothing committed.

### Gates CLOSED this run (do not re-open)
- **FREENAV = CLOSED as COEXISTENCE** (David 2026-07-17): forced-progression DEFAULT (binary throttle policy);
  free-nav = a future per-class OPTION (`navigationMode: forced|free` = roadmap **E4**, post-cutover). B1/B2 done.
- **Roadmap deploy sequencing = Codex GO** (baton round 10, `codexConverged`; `codex_review_010.md`).
- **CS PR-1 code diff = Codex GO** (baton round 12, `codex_review_pr1_002.md`) — round-11 blockers fixed (grandfather
  REMOVED from pairing → strict census-certified predicate; census verifier fail-closed w/ exact 14/13/skip-only/0 shape).

### Task-list position (`SESSION_TODO_2026-07-17.md`)
- **DONE:** A1 (flag-table CLEAN), A3/A5+B1/B2 (FREENAV coexistence), A4 (relief-script DO-NOT-RUN), A7 (925,851-doc
  reinstatable 26SM backup: `scripts/cs/backups_full_26sm_20260717-165840/` + MANIFEST + restore script), prod-smoke 4/4
  live, Task-6 M-CALL flag-ON 21/0/0 (WinClaude r27). **A2** invariant suite substantially built (`audit/deepfix/task3/
  invariant_assert.mjs` CLEAN 34/0/1-pending) — checkbox still open pending final register items.
- **PR-1 (C1): BUILT + Codex-GO'd, DORMANT, NOT committed/deployed.** Remaining before David flips = **(a) re-run the
  fail-closed `scripts/cs/census-verify-pr1.mjs` on the exact ship build; (b) dev-E2E / prod-audit evidence.** Then flip.
- **Task-6 (D1):** flag-ON M-UI DEFERRED (harness fixture-gap; covered by post-cutover prod audits + M-CALL emu coverage).
  Residue: single-runId cert→CERTIFIED, Codex end-gate (HARD), TASK6_REPORT.
- **PENDING:** B4 (continuation/list-end shape — David); **C2/PR-2** (functions mirrors + engagement stamp + I6 clamp —
  build after PR-1 GO so it mirrors the final predicate; a PR-2a build agent was in-flight at freeze — VERIFY it landed,
  `functions/foundation.js` was NOT dirty at freeze so likely did not); **C3/PR-3** (binary throttle, gated on PR-1 flipped);
  **D2–D9** the server-authoritative cutover (P3 flags → P4 → P5 migration ⚠one-way → P6 rules → P7 retire); **E1–E4**.

### David's standing authorizations (this run)
- **Full-auto on REVERSIBLE prod changes** (no live cohort to protect): build → Codex → dev-E2E → push → prod-smoke → flip.
- **Deploys route through WinClaude** — David is authorizing WinClaude for git push + `firebase deploy` DIRECTLY (WSL has
  no push creds / no firebase CLI). Keep everything built+staged so it ships the moment that auth is live.
- **Full send WITH rails on the one-way doors** (P5 migrate / P6 rules / P7 delete) — 25WT rehearsal + census before/after
  + comprehensive reinstatable backups FIRST. HARD STOP still applies to any **26SM write** until explicitly authorized.
- End-state goal: complete the full server-authoritative cutover, then **extensive full-UI prod Playwright audits** (audits
  replace the calendar soaks). Return David to a complete, audited end-state.

### NEXT
PR-1 evidence gate: re-run the fail-closed census verifier on the ship build → stage the dev-E2E (WinClaude flag-OFF sandbox)
→ (David-auth'd) flip PR-1 live. In parallel: verify/land C2/PR-2, finish A2. Then D-track cutover behind the backup+rehearsal.

---

## Standing constraints (binding)
- 3-agent convergence with **Opus agents** (`subagent_type: general-purpose`, `model: opus` — Fable DISABLED 2026-07-17, was Fable); **NO codex for MY loops**, but the
  **deepfix/CS Codex diff+end-gates are HARD gates** (never self-approve a phase; wait for GO). **Never trust agents — verify every
  file:line + live fact myself.** Ground plans in live-Firebase/prod evidence.
- Git: commit on `main`, **NEVER branch**; push/deploy via WinClaude on David's direct say-so. A `git checkout` of `firestore.rules`
  yields the **P10d draft** — do not deploy it.
- Live Firebase: diagnose READ-ONLY; **NO 26SM writes without explicit authorization** (25WT/`lsr_*`/dups = sandbox). CS scripts from
  `/app` via `NODE_PATH=/app/node_modules node`. Deploys are owner/WinClaude actions.
- Logging: code → `change_action_log.md`; CS/data → `SUPPORT_RUNBOOK.md`. WSL runs Admin scripts + Playwright-vs-prod-URLs (not Vite/localhost).

Prior streams: `docs/resume_archive/RESUME_2026-07-17.md` (deepfix pre-drift), `RESUME_2026-07-17b.md` (stale CS/consolidation),
`RESUME_2026-07-17c.md` (this stream's pre-correction snapshot — the one Codex round 13 flagged as stale).
