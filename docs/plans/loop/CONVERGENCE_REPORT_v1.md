# CONVERGENCE REPORT v1 — P4/D3 cutover, post read-only sweeps (2026-07-18)

**For INDEPENDENT verification by: Fable-1, Fable-2, Fable-3, Codex, WinClaude.**
David-directed convergence loop: each party independently **CONFIRMS or REFUTES every claim below with primary
evidence** — never trust blindly. WSL folds verified corrections into v2 and re-issues to the same five. We iterate
until a round yields **no surviving corrections from any party** AND all agree on the verdict. Master plan of record:
`docs/plans/MASTER_TASK_LIST.md`.

---

## Situation (confirmed by all 5 at round 22 — re-confirm it still holds)
A mid-round machine restart ("the crash") killed the **WSL orchestrator**, not WinClaude's round. WinClaude recovered
from durable state and **completed** the P4/D3 client→server cutover, then handed back `DEPLOYED`. The cutover is
**live, correctly ordered, reversible — but not behaviorally certified.**

## NEW evidence since round 22 — two read-only live scans (WSL, admin SDK; the SDK path is NOT affected by the broken git `schannel`)
1. **26SM `data-integrity-sweep`: CLEAN** — `invalidAnchor:0` and every structural signature 0 (`csdImplausible`,
   `twiOverList`, `dupProgress`, `orphanTwi`, `docIdMismatch`, `ghostProgress`, `noClassAttempt`, `missingProgramStart`).
   Sole non-zero `reviewNoNewPass:68` = known-benign (list-end/review-only days), **down from the 72 baseline** (2026-07-17).
2. **`system_logs` sweep since 08:46Z: NO-SPIKE** (`deepfix_syslog_sweep_postcutover.json`) — 13 logs; **9
   `resolve_list_progress` + 2 `csd_twi_reconciled` from 26SM** (the server path is working AND reconciling for real
   students); **1 `impossible_phase_detected` at baseline rate (delta 0)**; **ZERO** `dayGuardRejected` /
   `csd_anchor_invalid` / `anchor_rejected` / `reviewonly_derivation_mismatch`. **Honest caveats:** low-N early-evening
   read (heavier traffic still to come); a Firestore-collection sweep does NOT cover Cloud Functions runtime
   failed-precondition errors that live in GCP Logging (console/WinClaude check).

## Claims to verify (CONFIRM / REFUTE, each with evidence)
- **C1.** `HEAD = 6bffe1c == origin/main`; D-track chain `59df732 → 26cd8ee → d2bb2bc → 0ddbb34 → 6bffe1c`; `6bffe1c`
  changes only `featureFlags.js` (the 4 route flags false→true).
- **C2.** Committed posture: client 4 route flags + `FORCED_PATHWAY` true; functions `FORCED_PATHWAY_ENABLED` + the 7 D2
  flags true, epoch `1784333239063` (== client); `LIST_PROGRESS_CANONICAL` + `ANCHOR_VALIDATION_ENFORCE` false.
- **C3.** Deploy-order invariant held (functions live + fail-closed gate PASS 08:37:06Z **before** the client flip
  08:45–08:46Z); **not** a client-ahead-of-server condition.
- **C4.** The 6-assertion behavioral smoke **never ran** (`deepfix_p4_smoke_r37.json` `SMOKE_PASS:false`,
  `reachedTest:false`, 0/6); the M-CALL substitute (`deepfix_call_cert-59df732-r34.md`) does NOT cover the live
  forced-pathway hold-csd branch (baseline `59df732`, omits `FORCED_PATHWAY_ENABLED`, CANONICAL/ENFORCE=true).
- **C5.** The two read-only live scans above (CLEAN / NO-SPIKE) accurately reflect the current 26SM state.
- **C6.** Verdict: **deployed, not behaviorally certified**; **NEEDS-BEHAVIORAL-SMOKE**; **no rollback** absent a live
  regression signal; **D4/P5 remains blocked**.

## The question for THIS round
Given the two clean live scans (C5), does anyone **revise** the C6 verdict?
- **Hold `NEEDS-BEHAVIORAL-SMOKE`** — the scans exclude corruption/error-spikes but do NOT substitute for the behavioral
  proof; certification still requires the 6 assertions.
- **`GO-HOLD`** — clean scans + reversibility + working-server-path evidence suffice to hold live *while* the smoke is
  fixed and rerun (Codex's own r22 condition: "if the sweep is clean, it supports GO-HOLD").
- **`ROLLBACK`** — only if you can point to a live signal the scans missed.

## Party-specific asks
- **Fable-1/2/3** — re-verify C1–C6 in your lens (git-forensics / deploy-safety / baton-protocol); flag any NEW
  inconsistency, especially anything the two scans might paper over.
- **Codex** — apply your own r22 logic: does the clean live telemetry (C5) meet your GO-HOLD condition, or does
  `NEEDS-BEHAVIORAL-SMOKE` stand unchanged as the certification bar? Confirm C1–C4, C6; confirm D4/P5 blocked.
- **WinClaude** — do the one verification only you can: **re-probe the LIVE state NOW** — remote `main` HEAD, Netlify
  served build, functions `version` callable (sha/flags/epoch). Confirm/refute C1–C3 against live, and report whether
  your machine is back up + ready to run the 6-assertion behavioral smoke (round 38).

## Convergence bar
All five CONFIRM C1–C6 (or their refutations are WSL-verified and folded into v2), AND all agree on the C6 verdict,
with no surviving corrections in a round. WSL records each party's response + verification in `MASTER_TASK_TRACKER.md`.
