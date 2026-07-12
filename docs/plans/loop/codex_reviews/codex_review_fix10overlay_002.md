# Codex Review — FIX10_OVERLAY_CODE round 2

## Verdict

GO

CONVERGED-OK

## Scope reviewed

- Handoff: `docs/plans/loop/handoffs/claude_to_codex_fix10overlay_002.md`
- Revised harness: `audit/playwright/lsr_fix10_overlay.mjs`
- Synthesis: `docs/plans/loop/fix10/rounds/r03_overlay_synthesis.md`
- Prior Codex review: `docs/plans/loop/codex_reviews/codex_review_fix10overlay_001.md`

Warm review only. I rechecked the v2 deltas that address the round-1 findings and the three explicit claims in the handoff.

## Findings

No blocker/high findings remain.

## Round-1 findings rechecked

### F10O-1 — red-mode Day-2 reachability

Status: resolved.

`driveNewPass` now resumes setup after a rebuild when Firebase shows CSD advanced:

- `audit/playwright/lsr_fix10_overlay.mjs:356-375`

This is a sound way to make Day-2 review-final reachable on a broken build. The setup phase is explicitly unmeasured; it is only preparing the student for the measured review-final completion. The measured cell still has to satisfy its own `redSignature` or `green` oracle later.

On a fixed build, a setup rebuild should not happen. If it does but CSD advanced, this harness will continue to the measured Day-2 review. That is acceptable because:

- Day-1 final completion is separately measured by TD1/MD1;
- Day-2 new is not the session-final completion path under test;
- setup rebuilds are preserved in `rec.setupRebuilds` for diagnosis.

### F10O-2 — async log-window false-red

Status: resolved.

The harness now drains `csd_twi_reconciled` before opening the measured window:

- `stableRead`: `audit/playwright/lsr_fix10_overlay.mjs:223-236`
- pre-window drain: `audit/playwright/lsr_fix10_overlay.mjs:266-277`

This directly addresses the app behavior where `progressService.js` fires `logSystemEvent('csd_twi_reconciled', ...)` without awaiting the `system_logs` write.

The null handling is fail-closed: null keys do not count as stable, and null log reads later fail the discriminator instead of being treated as zero.

### F10O-3 — fatal findings in red-mode

Status: resolved.

The fatal gate now applies before both green and red verdict branches:

- `audit/playwright/lsr_fix10_overlay.mjs:483-498`

This closes the false-REPRO path from round 1.

### F10O-4 — list-scoped freshness

Status: resolved.

The baseline now checks `study_states` for `LIST.id`:

- `studyStatesForList`: `audit/playwright/lsr_fix10_overlay.mjs:150-155`
- baseline consumption: `audit/playwright/lsr_fix10_overlay.mjs:437-443`

Dirty accounts now produce an invalid cell and an `INVALID` verdict rather than an incomplete or misleading run.

## Handoff claims

### 1. Poll-until-stable correctness

Accepted.

`stableRead` requires two identical non-null keys before returning stable. For the before-window drain, this is sufficient to exclude the known delayed session-entry reconciliation log in normal conditions. For after reads, it also reduces stale reads across the separate progress/session/log writes.

Non-blocking note: the after-read key currently includes progress, sessions, phase, recon, and guard counts, but not `guardFailed` or `fallback`. Since those are only secondary red/fallback disambiguators, this is not a blocker. Including them in the key would make the stabilization mechanically more complete.

### 2. RED resume soundness

Accepted.

On the broken build, “CSD advanced after setup rebuild” is a valid setup-complete signal because the broken path reconciles the same final CSD/TWI even though it loses the completion summary. The setup phase is not the measured oracle.

On the fixed build, the resume branch does not create a false green for the measured path. A legitimate final-completion bug still has to evade the separately measured TD1/MD1 cells or the measured Day-2 review oracle, which it should not.

### 3. Still fail-closed

Accepted.

The v2 additions improve fail-closed behavior:

- page identity mismatch is invalid;
- final non-pass is not treated as a fix failure;
- red signatures are confounder-aware;
- fatal findings apply to both branches;
- dirty baselines become invalid;
- single red run is only `REPRO-CANDIDATE`, not confirmed.

The `fallbackInWindow` exoneration is acceptable for this harness because the main green oracle still requires UI success, recentSessions, a session doc, COMPLETE session state, and no guard. If a future Fix B relies more heavily on d6 as the sole race detector, this branch should be revisited, but it is not a blocker for validating Fix A.

## Deferred items

### Negative control

Acceptable to defer.

The negative control is surfaced unconditionally as skipped/not implemented. It is important guard-integrity coverage, but not required to validate the #10 overlay’s primary regression path.

### Shared results matcher

Acceptable to defer.

The shared `/%|score|correct/i` matcher remains loose, but v2 neutralizes the local false-red risk with pass verification, settle, and stable reads. Tightening the shared helper can be a separate harness cleanup.

### d7 progressSnapshot

Keep diagnostic.

Making `progressSnapshot` a hard discriminator would over-couple the overlay to the dormant retake-rewind path. The primary oracle already proves the completion behavior that matters.

## Non-blocking notes

- The comment at `audit/playwright/lsr_fix10_overlay.mjs:488-489` says setup-phase rebuild evidence is counted in `redCells`, but the code only counts `result.redSignature`. Either update the comment or intentionally include setup evidence. I do not consider this blocking because the measured Day-2 review still has to produce its own red signature.
- If red-mode is used for formal historical evidence, consider storing the harness revision or expected cell set in `fix10_red_state.json`, not only `BUILD_ID`, so a second run after harness edits cannot accidentally confirm a stale candidate. This is not relevant to post-fix green deployment gating.

## Final decision

VERDICT: GO

CONVERGED-OK
