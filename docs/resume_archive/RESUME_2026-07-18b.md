# RESUME — current active work

> **Canonical resume pointer.** When the user says "resume," read this first. The FULL plan of record is now
> **`docs/plans/MASTER_TASK_LIST.md`** (canonical, verified) + action log **`docs/plans/MASTER_TASK_TRACKER.md`**.
> This RESUME is a thin pointer. **Rotate at each save-state:** copy → `docs/resume_archive/RESUME_<date>.md` (copy,
> don't move), then overwrite here.

---

## ▶ ACTIVE STREAM (rotated 2026-07-18, post-crash-recovery + 5-way convergence): executing the D3/P4 certification gate

**READ FIRST:** `docs/plans/MASTER_TASK_LIST.md` (plan A→E, per-item status, verified ground truth §1, execution queue
§4) and `docs/plans/MASTER_TASK_TRACKER.md` (every action, ACT-001…). Convergence record (frozen):
`docs/plans/loop/CONVERGENCE_REPORT_v4.md`.

### Where we are (2026-07-18 ~12:00 UTC)
- A crash ended a session mid-cutover; state was reconstructed from PRIMARY evidence and confirmed by a **5-way
  convergence** (WSL + 3 Fable + WinClaude + Codex) that CLOSED 5/5 on the verdict below.
- **HEAD = `6bffe1c`** (client P4 cutover) · functions `0ddbb34`. **The D3/P4 client→server cutover is LIVE but NOT yet
  behaviorally certified.**
- **Verdict = `GO-HOLD`** — hold live (reversible, no rollback signal); the **6-assertion behavioral smoke is the
  certification bar**; **D4/P5 (one-way migration) BLOCKED** until D3 certifies.
- Read-only de-risk COMPLETE: `data-integrity` CLEAN · `system_logs` NO-SPIKE · canonical `list_progress` EMPTY · GCP
  Logging zero CF-runtime errors + confirmed live invocation.

### In flight NOW — the one open gate (§4 item 2)
- **Certify D3/P4 via approach-1:** emulator/sandbox re-cert, **pinned to `0ddbb34`**, at the live prod flag set
  (`FORCED_PATHWAY_ENABLED=true`, epoch `1784333239063`, `CANONICAL/ENFORCE=false`), the 6 assertions. Instrument:
  `docs/plans/loop/P4_CERT_INSTRUMENT_approach1.md`.
- **Codex sign-off on the instrument:** r27 = NEEDS-FIXES (assertion #2 epoch-boundary subcases; #5 must use callable
  observables not DSF/UI) → **folded → re-dispatched Codex r28** (awaiting GO).
- On Codex GO → **WinClaude runs approach-1** → WSL verifies all 6 → PASS = **D3 CERTIFIED**. Any fail = STOP + escalate
  to David (rollback candidate; flip 4 client flags false + push).

### David's STANDING instructions (2026-07-18)
- **Commit sequencing (LOCKED): WAIT for D3 cert, then commit EVERYTHING together.** The ~1,200-line plan-of-record +
  convergence evidence + cert artifacts are **disk-only until then** (risk R-4). **After that commit → give David the
  full task list + progress.**
- **Never trust an agent blindly** — verify every claim vs code / live evidence. Keep Codex + WinClaude in every round;
  if either goes silent, tell David.
- Deploys/pushes route through **WinClaude** (WSL has no push/firebase creds). **`git add -A` is hazardous**
  (`.gitattributes = * text=auto` renorm storm) → targeted adds / `git add --renormalize .`.
- **26SM = real cohort — READ-ONLY, no writes without explicit authorization.** 25WT = sandbox.

### NEXT (after D3 cert)
Commit everything together (via WinClaude) → **report full task list + progress to David** → housekeeping
(`SUPPORT_RUNBOOK` CS-2026-07-18 entry) → D4/P5 pre-work (fresh 26SM backup + 25WT rehearsal + a fresh Codex-GO'd,
David-authorized plan).

Prior stream: `docs/resume_archive/RESUME_2026-07-18.md` (the stale pre-crash 07-17c snapshot this rotation replaced);
earlier in `docs/resume_archive/`.
