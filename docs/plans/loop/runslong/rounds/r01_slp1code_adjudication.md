# SLP1 harness code review — round 1 adjudication (Codex + 3 agents, code-verified)

4 reviewers converge. All ACCEPTED (verified against code); grouped by fix. Applied to
`lsr_runSL_phase1.mjs` (+ a 1-line `lsr_ui.mjs` console-listener widen).

## ACCEPTED — the confirmation contract (unanimous)
- **UI must GATE, not soft-note** [Codex SLP1-1, B-2]: `uiOk` was only `F.add`, never in `confirmedDays`/HALT
  → a UI-broken/FB-correct build could PASS, inverting the owner ruling. FIX: `confirmedDays` requires
  `driven && persisted && uiOk`; UI mismatch is FATAL. Navigate to a confirmed dashboard before reading UI
  (the `ui.words=null` symptom = reading mid-results). Assert BOTH `ui.words===expTwi` AND `ui.day===expCsd+1`
  [B-6]; distinguish "UI read failed" from "UI mismatch".
- **Exact attempt deltas** [Codex SLP1-2, B-3]: `persisted` checked only csd/twi → lazy reconciliation could
  pull a list-wide anchor and satisfy it with NO new attempt this run. FIX: `persisted` also requires
  `Δnew==1` and (day≥2) `Δreview==1`; FAIL on duplicates (rebuild/retry double-write). Bind attempts by
  studyDay+classId+listId+sessionType within the run window.
- **Assert the test actually PASSED** [B-5, C-6]: `advanceOneDay` returned ok:true without checking
  `outcome==='pass'`; a failed/threshold/save-error test still counted as driven. FIX: require the pass
  verdict (call `assertVerdictCoherent`); treat any non-`results` outcome (save-error/grading-failed/timeout/
  retake-gate/no-submit) as a TYPED failure with that reason (not a later ambiguous FB mismatch).

## ACCEPTED — verdict integrity
- **Findings gate the verdict** [Codex SLP1-3]: define a FATAL anomaly set — `BUG`, `ui-fb-mismatch`,
  `unexpected-dialog`, non-allowlisted `request-failed`, post-mandatory-step `flow-gap`/`selector-gap` — and
  fail PASS if any present. No severe finding silently coexists with PASS.
- **In-run PRISTINE baseline assert + INVALID verdict** [B-4, C-8]: the absolute oracle (`expCsd=day`,
  `expTwi=day·pace`) assumes csd=0/twi=0 but never verified it. FIX: read fbState BEFORE day 1; if
  `csd||twi||attempts !== 0` → `verdict=INVALID (non-pristine baseline)`, stop. Add the missing INVALID state.
- **Bind DAYS into the verdict** [B-1]: `SL_DAYS=2` emitted the same bare `PASS (primitive proven)` + exit 0
  as 16. FIX: PASS certifies only at `DAYS===16`; `SL_DAYS<16` → non-certifying `ITERATION (n/16)`; embed
  `confirmedDays/DAYS` in the verdict string.
- **Require LSR_BUILD_ID** [Codex SLP1-7]: `'unspecified'` undermines certification. FIX: abort INVALID if
  absent; prefix artifacts/screenshots with it.

## ACCEPTED — fixture integrity
- **Verify assignment settings exactly** [Codex SLP1-5]: `assignList` can log a selector-gap yet return ok →
  wrong list/pace/mode breaks the +20 oracle. FIX: after assign, read-only-verify listId/pace/testMode/
  passThreshold/testSize on the class doc; mismatch → INVALID.
- **Unique classId binding** [Codex SLP1-6]: `docs[0]` on a name query can bind the wrong class on rerun. FIX:
  require exactly one match (fresh runId name makes this reliable); >1 → INVALID.

## ACCEPTED — THE rebuild diagnosis (owner ruling #2 — currently detection-only) [C-1..4, Codex SLP1-4]
The app CONSOLE.WARNs the smoking gun: `"Duplicate day completion blocked: expected day X, got day Y"`
(`progressService.js:444`) — but the listener drops warnings (`lsr_ui.mjs:75`, `type()==='error'` only). FIX:
- **Widen the console listener** to capture `warning` (or match `/Duplicate day completion blocked|expected day/`)
  and stamp it onto the rebuild record — gives the exact server-vs-session day mismatch.
- **Structured rebuild packet** per event: day, phase, runId, buildId, URL, visible-text excerpt,
  `lastDialog(page)` + `precededByBeforeunloadAccept/Reload` (harness-race discriminator), `driveTest` outcome,
  screenshot (`shot`), ISO timestamp, AND read-only Firebase AT the rebuild: class_progress, this-day attempts,
  and the `csd_twi_reconciled` system_log (`progressService.js:253`) for uid+classId. → lets the run state
  "harness-induced stale-day resubmit after reload" vs "clean submit rejected by reconciliation = app defect".

## ACCEPTED — robustness
- **Wrap fbState in bounded retry + .catch** [C-5]: the per-day Firebase read is unguarded; a transient blip
  → spurious HALT. FIX: 2-3× retry w/ backoff, `.catch`→null = "confirmation unavailable, retry", not "run failed".
- **Wall-clock bound** [C-7]: no total/per-day timeout; a degenerate day can burn 10+ min ×16. FIX: `SL_MAX_MS`
  deadline checked at the day-loop top + a per-day soft budget → abort to INCOMPLETE, never hang.
- **finally + close student context** [C-11]: move `browser.close()` to `finally`; close the student context.

## CONFIRMED CLEAN (no fix)
Firebase strictly READ-ONLY (grep: zero writes; only getUserByEmail + .get) [Codex Q2, B, C-9]. PACE math:
20×16=320 ≪ 3381, no list-tail [C-10]. Every rebuild recorded even on recovery [B]. +1/+pace oracle correct
for the steady control persona [Codex Q3]. Concurrent Admin reads authorized by owner ruling #1 [C-9].
