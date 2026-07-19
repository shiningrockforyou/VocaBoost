# RESUME — current active work

> **Canonical resume pointer.** When the user says "resume," read this first. The FULL plan of record is
> **`docs/plans/MASTER_TASK_LIST.md`** (canonical, verified) + action log **`docs/plans/MASTER_TASK_TRACKER.md`**
> (ACT-001…119) + findings **`docs/plans/D3.5_FINDINGS.md`**. This RESUME is a thin pointer.
> **Rotate at each save-state:** copy → `docs/resume_archive/RESUME_<date>.md` (copy, don't move), then overwrite here.

---

## ▶ ACTIVE STREAM (rotated 2026-07-19): D3.5 recovery+adversarial audit COMPLETE (15 PASS / 0 FAIL) → next is D4/P5

**READ FIRST:** `docs/plans/MASTER_TASK_LIST.md` (plan A→E) + `docs/plans/MASTER_TASK_TRACKER.md` (ACT-001…119) +
`docs/plans/D3.5_FINDINGS.md` (verified results + behavioral insights + harness method + seed-fidelity lessons).

### Where we are (2026-07-19 ~08:15 UTC)
- **Through D3/P4 is DONE + CERTIFIED + LIVE** (client `6bffe1c` / functions `0ddbb34`, committed `e20b532`). Server-authoritative progress path live.
- **D3.5 pre-migration recovery + adversarial audit = ESSENTIALLY COMPLETE.** Live-prod tier-3 Playwright drives (r54-r60)
  via the WSL⇄WinClaude⇄Codex baton loop. **Cumulative: 15 PASS / 0 FAIL** across every recovery family —
  throttle-deadlock (faithful 2-step, durable), off-by-one (graded completion), normal-progress, runaway-inflated
  (containment), lost-save (full retake→review→advance, mid-list), list-end, skip-hold, read-only-safe, canonical-anomaly.
  All on **faithful seeds in isolated per-tag classes**, verified against Firestore + FRESH server-path proof.
- **Every finding independently verified** (never trusted WinClaude's read-backs — caught 3 premature "no recovery" reads +
  a verdict-engine stale-log bug + a class-collision seeding bug + the 최도훈 phantom, all corrected).

### Just completed this session (2026-07-19)
- **최도훈 (Inter B4) forensic + CS fix (CS-2026-07-19b):** the audit's one "FAIL" traced to a PAST CS error, not a
  regression — the CS-2026-07-07 manual-pass wrote a PHANTOM day-16 anchor (words that don't exist on his 15-day/1200-word
  list) inflating twi to 1280. Fixed his real data (twi 1280→1200, phantom deleted, csd=16 kept; backup + sweep before/after).
- **Tooling hardened:** `manual-pass.mjs` refuses out-of-range days; `data-integrity-sweep.mjs` compares twi/anchors to
  each doc's OWN list (+ new `phantomAnchor` check). New `scripts/cs/fix-phantom-anchor.mjs`. Scope scan: phantom UNIQUE to 최도훈.

### NEXT
1. **Commit everything** (docs + audit scripts + the CS tooling changes) via WinClaude — WSL has no push/firebase creds.
   (Living logs updated: change_action_log, SUPPORT_RUNBOOK CS-2026-07-19b, MASTER_TASK_TRACKER, D3.5_FINDINGS.)
2. **Remaining D3.5 breadth (optional, if David wants max-exhaustive):** Part-B adversarial UI interactions (button-spam/
   races/reloads) + the browser-state layer (B23/B24 localStorage/nonce — still unbuilt).
3. **Then D4/P5** — the one-way `class_progress → list_progress` migration — gated on its own pre-work: fresh 26SM backup +
   25WT rehearsal + a fresh Codex-GO'd, David-authorized plan. NOT started.

### David's STANDING instructions
- **26SM = real cohort — READ-ONLY, no writes without explicit authorization** (he authorized the 최도훈 fix explicitly). 25WT/25WTsynth = sandbox.
- **Commit at milestones** via WinClaude; `git add -A` hazardous (`.gitattributes = * text=auto`) → targeted adds / `--renormalize`.
- **Never trust an agent (or your own tooling) blindly** — verify every claim vs code/live Firestore. Keep Codex + WinClaude in the loop.
- **Save all audit insights** into the master markdowns; rotate RESUME at each save-state.

Prior streams: `docs/resume_archive/RESUME_2026-07-19.md` (pre-audit-run snapshot), `RESUME_2026-07-18b.md`; earlier in `docs/resume_archive/`.
