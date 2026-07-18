# CONVERGENCE REPORT v4 — P4/D3 cutover — ✅ CONVERGED (FINAL, 2026-07-18)

> **5-WAY CONVERGENCE ACHIEVED at round 5 (2026-07-18 ~10:38Z).** All five — Fable-1, Fable-2, Fable-3, Codex (r26,
> `codexConverged=true`), WinClaude (r41, VERIFIED) — signed off "no surviving corrections." This is the canonical,
> frozen convergence record. Verdict: **GO-HOLD · behavioral smoke = certification bar (approach-1, pinned `0ddbb34`,
> pending Codex sign-off) · no rollback · D4/P5 blocked.** Loop CLOSED — no further rounds.


**For INDEPENDENT re-verification by Fable-1/2/3, Codex, WinClaude (round 5 — the sign-off round).** v3 superseded.
The **verdict has been 5-way unanimous and unchallenged since round 2**; rounds 3–4 corrected only evidence-prose
accuracy. This v4 folds the round-4 correction (raised independently by Fable-1 + Fable-2, WSL-verified against code).
Confirm the fold + flag any **surviving** correction; if none from any party, WSL declares 5-way convergence. Master
plan: `docs/plans/MASTER_TASK_LIST.md`.

## Verdict (stable since round 2 — reconfirm, do not relitigate)
**`GO-HOLD`** (hold `6bffe1c`/`0ddbb34` live, reversible, **no rollback** — no signal) · **`NEEDS-BEHAVIORAL-SMOKE`**
(cert bar: the 6 assertions must pass on live `6bffe1c`; path = approach-1 emulator re-cert **pinned to tree
`0ddbb34`**, needs **Codex sign-off**) · **D4/P5 blocked**.

## Ground truth (C1–C4) — confirmed every round
HEAD `6bffe1c` == origin/main (WinClaude r38 `git ls-remote` live-confirmed); chain
`59df732→26cd8ee→d2bb2bc→0ddbb34→6bffe1c`; `6bffe1c` = only the 4 route-flag flips. Deploy order held (functions +
gate PASS 08:37:06Z before client flip 08:45–08:46Z). Committed posture: client 4 flags + `FORCED_PATHWAY` true;
functions `FORCED_PATHWAY_ENABLED` + 7 D2 flags true, epoch `1784333239063`, `CANONICAL`/`ENFORCE` false. The
6-assertion behavioral smoke never ran (`deepfix_p4_smoke_r37.json` 0/6); the M-CALL substitute
(`deepfix_call_cert-59df732-r34.md`) does not cover the forced-pathway hold-csd branch at the prod flag set.

## Evidence picture (C5) — de-risk complete, behavioral cert still owed
Three read-only Firestore scans + GCP Logging, all clean:
- **`data-integrity` CLEAN** (`deepfix_dataintegrity_sweep_26sm_postcutover.txt`): `invalidAnchor:0`, all structural 0;
  `reviewNoNewPass:68` benign (baseline 72, `change_action_log.md:1175`).
- **`system_logs` NO-SPIKE** (type-exhaustive, `deepfix_syslog_sweep_postcutover.json`): all real concern-signature
  emitters = 0 since cutover — incl. `anchor_rejected`, `csd_anchor_invalid`, `reviewonly_derivation_mismatch`,
  `complete_session_no_evidence`, `review_marker_write_failed`, `list_progress_quarantine{,_candidate}`, and the real
  day-guard emitters `day_guard_rejected_session_cleared` / `day_guard_session_clear_FAILED` (foundation.js:1548 server
  + studyService.js:910 client; camelCase `dayGuardRejected` is a return-payload field only, foundation.js:1559/1565/1586).
- **canonical/write-path** (`deepfix_canonical_writepath_postcutover.json`): canonical `list_progress` EMPTY (0/0);
  `csd_twi_reconciled` = server-written (`writtenBy: cloud-function` ×2); all write-path/error signatures 0.
- **GCP Cloud Logging** (WinClaude r39, `deepfix_cf_runtime_logcheck_r39.json` + 112KB raw `cf_runtime_logs_r39.txt`):
  ZERO CF-runtime error/warning/FAILED_PRECONDITION post-cutover (31 info + 10 debug); the sole E-line is pre-cutover
  (00:38Z, benign GET-poke input validation). The 00:36Z UpdateFunction audit entries independently corroborate the
  `0ddbb34` deploy.

**Refined write-path reading:** the **read/resolve + server-reconciliation legs are proven live** (9 server-written
`resolve_list_progress`, 26SM via system_logs cross-ref). `completeSession` was **invoked post-cutover at 09:37:09Z,
auth=VALID, sha `0ddbb34`, runtime-error-free** — but this proves an *authenticated* invocation (GCP shows auth-valid,
not cohort membership → "26SM" is inferred for that single call, confirmed only for the resolve leg), and a *successful*
`completeSession` emits no `system_logs` event, so **csd/twi-advance CORRECTNESS is unasserted** (→ smoke ①). The
**forced-pathway hold-csd branch is UNEXERCISED** (`review_recorded=0`) (→ smoke ②). ⇒ the 6-assertion smoke remains the
only certification. Standing caveat: `data-integrity` inspects each class's first assigned list only.

## Correction folded from round 4 (Fable-1 + Fable-2, independently; WSL git-verified)
**`attempt_day_fallback` provenance — v3 §2 was WRONG, corrected.** v3 said "no current-code emitter at HEAD → stale
pre-cutover bundle." Refuted by `git grep` at `6bffe1c`: **live emitters exist** at `src/pages/MCQTest.jsx:612` and
`src/pages/TypedTest.jsx:872` (`logSystemEvent('attempt_day_fallback', {...})`, active code in the derived-fallback
branch). Corrected facts: the 1 observed event is **known-latent LOW** (`audit/deepfix/task1/CONSOLIDATED_ISSUES.md:128`;
~1/3.2h historical ≈ baseline for the window) at **~09:10:04Z** (not ~08:50Z; clusters with the 09:10:39Z
`csd_twi_reconciled`). Stale-vs-current provenance is **UNDECIDABLE** — the HEAD payload `{testType, stamped, csd,
classId, listId}` carries **no `userId`**, so a current `6bffe1c` bundle produces exactly the observed `no-uid` event.
Verdict-neutral (benign, not a concern signature). **Work-queue (data-safety, Fable-2):** because the payload has no
`userId`, every `attempt_day_fallback` is permanently invisible to cohort attribution — add `userId` to both emitters if
this signal is wanted for 26SM monitoring.

## Known hygiene nits (non-blocking; not verdict inputs)
- `deepfix_cf_runtime_logcheck_r39.json` has a malformed `"at": "2026-07-18T10:1x"` placeholder + a `window` string that
  understates the raw capture start — flagged by Fable-1/2/3. Time is pinned by file mtime (10:16:13Z) + the raw log.
  **WinClaude to regenerate this field on the r41 pass** (WSL does not hand-edit another agent's evidence artifact).
- Uncommitted evidence/coordination pile (remote ends at `6bffe1c`): scheduled housekeeping (`MASTER_TASK_LIST §4`),
  not a verdict input.

## Round-5 ask
Each of the 5: confirm the round-4 `attempt_day_fallback` correction is faithfully folded + nothing else regressed;
flag any **surviving** correction. **If no party has one, WSL declares 5-way convergence and stops the loop.**
