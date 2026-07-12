# FIX10_DESIGN — CONVERGED

**Plan:** `docs/plans/loop/fix10/plan.md` (v3) · **Fixes:** NEED_TO_FIX #10 (flag-ON pre-completion
reconciliation self-race → spurious "session refreshed" rebuild).

## Convergence
- **Round 1:** Codex `NEEDS_FIXES` (F10-1 blocker, F10-2 high, F10-3 medium) + 3-agent fable audit
  (Lens A correctness / B flag-off-regression / C edge+test-design). All findings verified by Claude against
  real code, triaged in `rounds/r01_synthesis.md`. Notable: v1's flag-gating claim was factually WRONG
  (caught by all 4); one reviewer claim REJECTED with evidence (progressSnapshot "no readers" — false; it's
  the retake-rewind consumer, which Codex Q3 independently corroborated).
- **Round 2 (warm delta):** Codex `GO / CONVERGED-OK` on v2. All 3 R1 fixes confirmed resolved; all 3
  Claude `claimsToCheck` answered (null-skip safe; read-source gating sufficient; reconciliation-discriminator
  valid with a tight-window boundary). Boundary advisory folded into §8 → v3.
- 3-agent audit ran ONCE on the initial draft (per standing contract), converged into v2.

## Locked design (Fix A only)
1. In `TypedTest.jsx` (~:979, inside `doWriteAndFinalize`) + `MCQTest.jsx` (~:718): flag-gate the
   pre-completion snapshot read — `LIST_SCOPED_RECON ? getClassProgress(...) : getOrCreateClassProgress(...)`.
2. On null (flag-ON, missing doc — near-impossible): SKIP the `progressSnapshot` persist, proceed to
   `completeSessionFromTest` (which self-creates via `updateClassProgress` `setDoc`). No getOrCreate fallback.
3. `?? null` guards on the 7 snapshot fields. Import `getClassProgress` + `LIST_SCOPED_RECON` in both pages.
4. DO-NOT-TOUCH the pre-attempt studyDay-fallback reads (`TypedTest.jsx:823`, `MCQTest.jsx:543`).
5. **Fix B DEFERRED** — unsafe as specced; only revive (own plan) if post-Fix-A evidence shows a residual
   duplicate-completion path.
6. Flag-off = byte-equivalent (Run L). No `progressService.js` change, no index, no migration.

## Validation (built next, together with the harness workaround)
Run S-Long #10 overlay: 4-cell matrix {Day-1 new, Day-2+ review} × {Typed, MCQ}; DISCRIMINATING asserts
(recentSessions +1 for day N; one new sessions doc; session_states COMPLETE; zero day-guard rejects;
zero in-window `csd_twi_reconciled` as race-detector); signature-pinned EXPECTED-RED (flag-ON, N≥2) →
GREEN after fix; stale-completion negative control (recoverable rebuild); keep settle-before-navigate.

## Out-of-scope observations logged (§9)
Flag-off silent session-summary loss; nav-interrupt silent-reconcile completion; `impossible_phase_detected`.

## Implementation — DONE + code-review CONVERGED (2026-07-12)
David gave the go-ahead → Fix A implemented in `src/pages/TypedTest.jsx` + `src/pages/MCQTest.jsx` (flag-gated
non-reconciling snapshot read, null-skip persist, `?? null` guards, imports; DO-NOT-TOUCH sites untouched; no
progressService change; Fix B deferred). Lint 0-new vs baseline.
- **Initial 3-agent fable impl audit:** all 3 lenses clean (A correctness=CORRECT, B flag-off=SHIP, C
  parity=CLEAN) — only non-actionable nits. Folded: 1 comment-precision tweak + 2 out-of-scope observations
  (§9.4/§9.5). `rounds/r02_impl_synthesis.md`.
- **Codex FIX10_CODE round 1:** `GO / CONVERGED-OK` — no blocker/high/medium, no edits requested. Independently
  traced race elimination (both branches), null path, flag-off equivalence, parity, day-guard intact.
  `codex_reviews/codex_review_fix10code_001.md`. Code-review loop CLOSED.

## GATE — next step requires David: DEPLOY
**Owner deploys code (Claude cannot build/deploy).** After deploy: build the #10 regression overlay (§8) +
the Run S-Long harness workaround, then run Run S-Long (overlay EXPECTED-RED→GREEN proves the fix).
