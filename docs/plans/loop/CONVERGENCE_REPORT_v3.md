# CONVERGENCE REPORT v3 — P4/D3 cutover (round-3 corrections folded)

**For INDEPENDENT re-verification by Fable-1/2/3, Codex, WinClaude (round 4).** v2 superseded. Round-3 verdict was
**UNANIMOUS (`GO-HOLD`)**; this v3 folds the round-3 surviving corrections (all verdict-neutral, WSL-verified against
code) + WinClaude's new GCP-Logging evidence. Confirm the fold + flag any **surviving** correction; if none from any
party, WSL declares 5-way convergence. Master plan: `docs/plans/MASTER_TASK_LIST.md`.

## Round-3 outcome — verdict UNANIMOUS across all 5
`GO-HOLD` (hold live, reversible, **no rollback**) · the **6-assertion behavioral smoke is the certification bar** ·
**D4/P5 blocked**. Fable-1 + WinClaude: fully CONVERGED at round 3. Codex + Fable-2 + Fable-3: converge on fixing the
corrections below.

## Corrections folded from round 3 (each WSL-verified against code)
1. **Day-guard telemetry — v2's "no `dayGuard*` emitter exists" was WRONG; corrected.** `dayGuardRejected` (camelCase)
   is a `completeSession` *return-payload field* (foundation.js:1559/1565/1586), NOT a `system_logs` type. The real
   day-guard log emitters DO exist: **`day_guard_rejected_session_cleared` / `day_guard_session_clear_FAILED`** (server
   `logSystemEventServer` foundation.js:1548 + legacy client `logSystemEvent` studyService.js:910). Because
   `scan-syslog-since.mjs` queries `system_logs` by timestamp with **no type filter** (type-exhaustive) and buckets ALL
   types, the artifact already establishes both = **0** since cutover — a REAL zero, now also explicit in
   `deepfix_canonical_writepath_postcutover.json`. The zero is **uninformative for certification** because these sit on
   the `completeSession` day-guard path whose correctness a *successful* call does not log — same class as
   `review_recorded=0`. `day_guard_rejected_session_cleared` is an EXPECTED observable for smoke assertion ⑤.
2. **`attempt_day_fallback` (1, no-uid, ~08:50Z) classified** (Fable-3): known-latent LOW
   (`audit/deepfix/task1/CONSOLIDATED_ISSUES.md:128`; historical ~1/3.2h → 1 in ~80 min = baseline); no current-code
   emitter at HEAD (`git grep` = audit docs only) → a stale pre-cutover client bundle. Not cutover-related.

## New evidence — WinClaude r39 GCP Cloud Logging (closes the C5 CF-runtime caveat)
`firebase functions:log` (authed; `gcloud` not installed), post-cutover (≥08:46Z), across `completeSession` /
`resolveListProgress` / `resetProgress` / `advanceForChallenge` / `submitChallenge` / `markReviewComplete`:
**ZERO error, ZERO warning, ZERO FAILED_PRECONDITION / throw / permission-denied** (31 info + 10 debug). **NOT silence:
`completeSession` invoked 09:37:09Z (auth=VALID, sha `0ddbb34`, no error); `resolveListProgress` ~8× 08:59–10:12Z
error-free.** Evidence: `deepfix_cf_runtime_logcheck_r39.json` + `cf_runtime_logs_r39.txt` (112KB raw). ⇒ the normal
server write/resolve path IS exercised by real authenticated 26SM students with **zero runtime errors**. Refines the
write-path picture:
- **Normal `completeSession`: invoked + runtime-error-free** (GCP-confirmed) — but csd/twi-advance **correctness** is
  still unasserted (a successful call is silent) → smoke ①.
- **Forced-pathway hold-csd branch: UNEXERCISED** (0 `review_recorded`) → smoke ②.

## Converged evidence picture (C5, final)
No data corruption (integrity CLEAN, persisted) · no Firestore error/refusal/quarantine/day-guard signatures (all REAL
zeros, type-exhaustive sweep) · canonical `list_progress` EMPTY · **zero CF-runtime errors post-cutover with confirmed
live invocation** · read/resolve + server-reconciliation + normal-completion paths exercised error-free — while the
**forced-pathway hold-csd branch is unexercised and the write path's behavioral CORRECTNESS is unasserted** → the
6-assertion smoke remains the only certification. Standing caveat: `data-integrity` inspects each class's first assigned
list only.

## Verdict (v3) — unchanged, now fully evidence-grounded
**`GO-HOLD`** · **`NEEDS-BEHAVIORAL-SMOKE`** (cert bar; approach-1 emulator re-cert **pinned to tree `0ddbb34`**
[Fable-1], needs **Codex sign-off** as a cert-instrument amendment [Fable-3]) · **no rollback** · **D4/P5 blocked**.

## Round-4 ask
Each of the 5: confirm the round-3 corrections are faithfully folded + the GCP evidence is sound; flag any **surviving**
correction. **If no party has one, WSL declares 5-way convergence.** Housekeeping now fully tracked in
`MASTER_TASK_LIST §4` (RESUME rotation · `--renormalize` commit · SUPPORT_RUNBOOK CS-2026-07-18 · B2/B4/PR-1 sourcing).
