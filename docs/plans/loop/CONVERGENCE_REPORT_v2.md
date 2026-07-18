# CONVERGENCE REPORT v2 — P4/D3 cutover (round-2 corrections folded)

**For INDEPENDENT re-verification by: Fable-1, Fable-2, Fable-3, Codex, WinClaude (round 3).** v1 is superseded.
This v2 folds the round-2 corrections (all WSL-verified against code) + two new read-only probes. Confirm the folding
is faithful + flag any **surviving** correction; if no party has one, WSL declares 5-way convergence. Master plan:
`docs/plans/MASTER_TASK_LIST.md`.

## What CONVERGED at round 2 (unchanged — all 5 independently agreed)
- **Ground truth C1–C4: confirmed.** WinClaude r38 live re-probe `ALL_VERIFIED` (remote `main`==`6bffe1c`, Netlify
  `6bffe1c dirty:false`, functions `0ddbb34`+`FORCED_PATHWAY_ENABLED=true`+epoch+CANONICAL/ENFORCE=false).
- **Verdict C6: `GO-HOLD`** (hold live, reversible, **no rollback** — no signal) + **the 6-assertion behavioral smoke is
  the certification bar (GO-HOLD ≠ certified)** + **D4/P5 blocked.** Codex r23 (`codexConverged=true`), WinClaude r38,
  Fable-1/2/3 all land here.

## Corrections folded from round 2 (each WSL-verified)
1. **"server path working" was OVER-CLAIMED → narrowed.** Corrected: the **read/resolve leg + server-side reconciliation
   are proven live** — 9 `resolve_list_progress` (server-only emitter, `foundation.js:1766/1900/1993`) + 2
   `csd_twi_reconciled` now confirmed **`writtenBy: "cloud-function"`** (server, not the legacy client
   `progressService.js:290` — resolves Fable-2's attribution ambiguity). The **write / completeSession / hold-csd path
   is UNEXERCISED**: **0 `review_recorded`** (the hold-csd log, `foundation.js:1575` — never fired for 26SM since
   cutover) and a *successful* `completeSession` emits no log at all. ⇒ the forced-pathway branch is clean-because-
   *unexercised*, NOT proven → the behavioral smoke is more necessary, not less.
2. **"ZERO dayGuardRejected" STRUCK as vacuous** — verified: **no `dayGuard*` `system_logs` emitter exists** (the server
   day-guard leg returns a status, writes no log). Removed from the evidence. GO-HOLD survives on the *real* zeros
   (genuine emitters, all zero this window): `anchor_rejected`, `csd_anchor_invalid`, `reviewonly_derivation_mismatch`,
   `complete_session_no_evidence`, `review_marker_write_failed`, `list_progress_quarantine{,_candidate}`.
3. **data-integrity sweep PERSISTED** (was prose-only) → `audit/playwright/findings/deepfix_dataintegrity_sweep_26sm_postcutover.txt`;
   re-run identical: `invalidAnchor:0`, all structural 0, `reviewNoNewPass:68` (baseline 72 documented in
   `change_action_log.md:1175`).

## New read-only probe — `scan-canonical-writepath.mjs` → `deepfix_canonical_writepath_postcutover.json`
- **Canonical `list_progress` EMPTY: PASS** — `total_global:0`, `count_26SM:0`. The resolver ran 9× and wrote **zero**
  canonical docs (`LIST_PROGRESS_CANONICAL=false` honored). Resolves Fable-2 residual (P4 requires canonical empty).
- **`csd_twi_reconciled` = server-written** (`writtenBy: cloud-function` ×2) — no legacy client reconciliation WRITE path firing.
- **All write-path / error signatures since cutover = ZERO** (`review_recorded`, `complete_session_no_evidence`,
  `reset_progress_server`, `challenge_day_advance`, `list_progress_quarantine{,_candidate}`, `anchor_rejected`,
  `reviewonly_derivation_mismatch`, `review_marker_write_failed`).

## Corrected C5 (honest current evidence)
The two live scans + this probe establish: **no data corruption** (integrity CLEAN), **no error/refusal/quarantine
signatures**, **canonical stays empty**, and the **read/resolve + server-reconciliation legs are live-proven** — while
the **write/hold-csd path is unexercised and unobservable via `system_logs`** (hence the behavioral smoke is required).
Standing caveats: low-N early-evening; GCP-Logging CF runtime errors still need a console check (WinClaude); the
`data-integrity` sweep inspects each class's first assigned list only.

## Verdict (v2) — unchanged
**`GO-HOLD`** (disposition) · **`NEEDS-BEHAVIORAL-SMOKE`** (cert bar — the 6 assertions must pass on live `6bffe1c`;
cert path = WinClaude **approach-1** emulator re-cert **pinned to tree `0ddbb34`** [Fable-1], needing **Codex sign-off**
as a cert-instrument amendment [Fable-3]) · **no rollback** · **D4/P5 blocked**.

## Round-3 ask
Each of the five: confirm the round-2 corrections are FAITHFULLY folded + the new probe is sound, and flag any
**surviving** correction. **If no party has a surviving correction, WSL declares 5-way convergence.**
Housekeeping (tracked separately, none verdict-affecting): RESUME rotation, `git add --renormalize .` commit,
`SUPPORT_RUNBOOK` CS-2026-07-18 entry, citing B2/B4/PR-1 sources (Fable-3's procedural list).
