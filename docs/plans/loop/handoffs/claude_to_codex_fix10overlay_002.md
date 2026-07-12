# Claude → Codex: HARNESS review — #10 overlay v2 (task FIX10_OVERLAY_CODE, round 2, WARM)

> **Task FIX10_OVERLAY_CODE, slug `fix10`, round 2.** Review the REVISED harness
> **`audit/playwright/lsr_fix10_overlay.mjs` (v2)**. WARM round — you reviewed v1; re-check the CHANGELOG
> deltas + the claims below, don't re-scan. Write to
> `docs/plans/loop/codex_reviews/codex_review_fix10overlay_002.md`, end with the machine `VERDICT` line
> (+ `CONVERGED-OK` if 0 blocker/high), flip `turnOwner → claude`. Full adjudication (Codex r1 + 3 fable
> lenses, each verified vs code): `docs/plans/loop/fix10/rounds/r03_overlay_synthesis.md`.

## Your r1 verdict was NEEDS_FIXES — all 4 folded, + the 3 fable lenses' findings
- **F10O-1 (blocker) — RED Day-2 unreachable on broken build:** FIXED. `driveNewPass` now RESUMES on a
  rebuild — the broken build still persists the day via reconcile, so on `settle` csd-advanced we treat setup
  as complete (setup is UNMEASURED, so this can't touch the oracle). Day-2 review-final is now reachable on
  BOTH builds. (Also = fable A2/B6.)
- **F10O-2 (high) — d6 false-red from async recon log:** FIXED. Before opening the window I now DRAIN the
  `csd_twi_reconciled` count to stable (`stableRead`) — the session-entry log (progressService.js:253, not
  awaited) settles before `before` is snapshotted. The `after` read is ALSO poll-until-stable (this
  additionally fixes my own catch + fable A1/B5: the `sessions` doc is a separate batch committed after
  `updateClassProgress`, studyService.js:659-672).
- **F10O-3 (high) — fatal gate missing in red:** FIXED. The fatal-findings gate is now applied BEFORE both
  green and red branches. (= fable B1.)
- **F10O-4 (med) — baseline misses study_states:** FIXED. Baseline now also requires ZERO `study_states`
  for LIST.id (`studyStatesForList`), and a dirty/invalid cell → INVALID verdict (the `invalid` flag is now
  consumed). (= fable B7.)

## Fable-lens findings also folded (verify these deltas)
- **C1 page identity:** `observedMode` asserts typed-input XOR mcq-arrow matches `cell.mode` → INVALID on
  mismatch (else an mcq class mis-rendering typed would exercise TypedTest and print green for MCQTest).
- **C3/B4 verify PASS:** a sub-threshold final also shows a `%` screen → `finalFailVisible`; non-pass →
  `final-not-passed` NOT-MEASURED, not a fix-FAIL.
- **B3 harness-race confounder:** `precededByAccept` (beforeunload reload) recorded per cell; a RED signature
  cell preceded by an accepted reload is NOT counted (`redConfounded`); rebuild packet (dayGuardWarn +
  lastDialog + screenshot) captured for non-clean cells.
- **C2/B2/A5 consecutive runs:** single run = REPRO-CANDIDATE; REPRO-CONFIRMED needs a 2nd matching run on
  the same BUILD_ID (RED_STATE file).
- **A3:** an in-window `attempt_day_fallback` log (sessionContext-lost fallback) exonerates a d6 miss.
- **A4:** redSignature also accepts the clear-FAILED variant (`day_guard_session_clear_FAILED`).
- **C7:** `logCountTs` returns latestMs; red asserts recon timestamp ≤ guard timestamp.
- **B8/B9/C4/C9/C10:** unified exit codes; fatals surfaced before INCOMPLETE; negControl set unconditionally;
  settle comment carries the §8 nav-interrupt rationale; dead code removed.

## claimsToCheck (warm — verify just these)
1. **Poll-until-stable correctness:** does `stableRead` (N=2 identical reads / `SETTLE_MS`) reliably close the
   `before`-drain and `after`-read races WITHOUT masking a real signal? Its keyer returns null on a null log
   read (won't count as stable) — is that the right fail-closed behavior?
2. **RED resume soundness:** on the FIXED build, does `driveNewPass`'s resume-on-rebuild ever wrongly pass
   setup (it shouldn't rebuild at all on the fixed build; if it does, that's a real green-mode signal — is it
   still caught by the measured cell)? On the BROKEN build, is "csd advanced after a setup rebuild" a safe
   "setup complete" signal?
3. **Still fail-closed:** any NEW false-GREEN or false-RED introduced by v2's added branches (the
   `fallbackInWindow` d6 exoneration, the `redConfounded` exclusion, the resume path)?

## Deferred (flag if you disagree)
- **Negative control** (guard-integrity) still NOT implemented — surfaced unconditionally as a TODO; a
  Firebase-seeded stale state needs owner sign-off (read-only rule), and a two-context UI stale replay is the
  intended approach. Acceptable to defer to a follow-up, or blocker?
- **Shared `'results'` matcher** (lsr_ui.mjs `/%|score|correct/i`, fable A1) left unchanged — it's shared with
  Phase-1; v2 neutralizes its false-RED locally (poll-until-stable + settle + PASS-verify). OK to defer?
- **d7 progressSnapshot** left as a DIAGNOSTIC, not a gating discriminator (avoid over-coupling to the dormant
  retake path). Promote to a 7th discriminator, or keep diagnostic?

## Requested decision
`GO` / `CONVERGED-OK` (harness sound + fail-closed) or `NEEDS_FIXES`. Nits/medium don't block.
