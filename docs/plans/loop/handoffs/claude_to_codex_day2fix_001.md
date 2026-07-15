# Claude → Codex: HARNESS FIX review — Day-2 "reach" root cause (task RUNS_DAY2FIX, round 1)

> **Task RUNS_DAY2FIX, slug `fix10`, round 1.** Review a HARNESS FIX (test tooling — no app `src/` change).
> Changed files: `audit/playwright/lsr_ui.mjs`, `lsr_runS1.mjs`, `lsr_runSL_phase1.mjs`, `lsr_fix10_overlay.mjs`.
> Diff snapshot: `docs/plans/loop/fix10/day2_reach_fix.patch` (tracked files; the overlay is untracked — read it
> directly). Write your review to `docs/plans/loop/codex_reviews/codex_review_day2fix_001.md`, end with the
> machine `VERDICT` line, flip `turnOwner → claude`.

## The investigation finding (what this fixes)
Both Run S-1 and Run S-Long P1 stalled at Day 2 with `new-test-not-reached`. I got VISUAL confirmation (David's
call): the robot lands on a **"DAY 2 COMPLETE"** summary screen (byte-identical screenshot every run;
`findings/lsr_menugap_*.png` md5 `6470536e`), and the instrumented reach shows the Session-menu control waited
the FULL 30s (absent — wrong screen), while other buttons render in 4-5ms (so NOT a slow-button/flakiness issue).

**Root cause (traced + FB-verified):**
- After a normal completion, `session_states` is left at `phase=complete` and is CLEARED in exactly one
  student path: the completion screen's **"Back to Dashboard" button onClick** (`DailySessionFlow.jsx:1787`;
  the re-entry-modal "Move On" `:1474` is the other). A reload / header-nav does NOT clear it.
- FB after Day 1 (student s57): `class_progress csd=1/twi=20` (correct) but
  `session_states = {phase:complete, currentStudyDay:2, newWordsTestPassed:true}` with only the day-1 attempt.
- Re-entry guard `DailySessionFlow.jsx:751-755`: `if existingState.phase===COMPLETE … → setPhase(COMPLETE)`
  → shows the complete screen; the "Day 2" label is the fresh sessionConfig.dayNumber over the stale phase.
- **Harness gap:** every harness returns to the dashboard via reload/`goDashboard` (header link) — NONE clicked
  "Back to Dashboard" (grep-confirmed). So the stale complete state persists → next-day entry → the wall.
- **Real students are UNAFFECTED** — they click "Back to Dashboard", which clears the state.

## The fix (harness only)
1. **New shared primitive** `clearCompletionIfPresent(page)` in `lsr_ui.mjs`: if a completion screen is showing,
   click "Back to Dashboard" (the state-clearing exit); returns true iff clicked; backward-compatible no-op
   otherwise.
2. Folded into `goDashboard` (prefer "Back to Dashboard" when present).
3. Called at the START of the three reload-based dashboard helpers — BEFORE their `goto(BASE)` reload — so the
   stale complete state is cleared while still on the completion screen:
   - `lsr_runS1.mjs` `dashReady`
   - `lsr_runSL_phase1.mjs` `dashReady`
   - `lsr_fix10_overlay.mjs` `freshDashboard`
Also in this diff (related Day-2 reach work, David's design): `waitVisibleTimed` — deterministic wait-until +
latency logging to `findings/reach_latency.tsv` + a `perf-slow` finding for any control ≥3s; reach probes
15s→30s. (This is what PROVED the buttons are fast and isolated the wrong-screen; it's not the fix itself.)

## Please verify
1. Is "Back to Dashboard" the correct + sufficient state-clearing action, and is `clearCompletionIfPresent`
   wired at the right points (before every reload that follows a completed day)? Any day-transition path that
   still bypasses it?
2. Backward-compatibility: does the `goDashboard` fold or the reach instrumentation change behavior for callers
   NOT on a completion screen (it should be a no-op)?
3. Is the fix correct that a reload does NOT clear `session_states` (only the button onClick does)? Confirm
   against `DailySessionFlow.jsx:1787/1474` + `sessionService.clearSessionState`.
4. Any harness-reliability regression, or a better single-point wiring.

## Note (separate, NOT in this fix)
Minor real-app robustness gap (logged, low severity, NOT filed as a fix yet): if a student ABANDONS the
completion screen without clicking "Back to Dashboard" (closes tab), re-entry shows a mislabeled "Day N+1
Complete" screen that self-corrects on clicking the button. Candidate: clear `session_states` on completion
unconditionally. Flag if you think it should be escalated.

## Requested decision
`GO` / `CONVERGED-OK` (fix correct + well-wired) or `NEEDS_FIXES`.
