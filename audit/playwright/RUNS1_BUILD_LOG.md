# Run S — S-1 flagship build log (NEED_TO_FIX #9 acceptance, live server)

Consolidated log of issues hit while building/running `lsr_runS1.mjs` against the LIVE server
(`https://vocaboostone.netlify.app`, flag-ON, #9 fix deployed 2026-07-12). Per-run anomalies also
auto-save to `findings/runS1_<runId>.json` + `findings/B_LIST_PROGRESS_PHASE1_RUNS1_*.md`.

## Scenario (S-1)
Fresh zero-progress student joins classes A + B (same list). Day 1 in A (new pass) → Day 2 in A (new
pass → review-study → LEAVE before review) → switch to B → complete Day-2 review (MUST NOT force retake)
→ re-enter A (no re-review). Oracle: A_L & B_L both csd=2/twi=40; B's review attempt range == 20..39;
no retake.

## Issues encountered + resolution
| # | Issue | Root cause | Fix |
|---|---|---|---|
| 1 | `browserType.launch: Executable doesn't exist at /ms-playwright/...1208` | `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` has build 1223; installed PW 1.58.2 wants 1208 (in `~/.cache`) | run with `PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright` |
| 2 | `assignList` selected the wrong/ default list; classes got TOP not CORE | teacher `lsr_teacher_01` can only assign the TOP list (CORE value-select fails → dropdown default) | use the TOP list (`EQ0Dc9rb...`) for S-1 |
| 3 | student focus defaulted to a different list; "not clean" | `lsr_s34` had prior TOP-list `class_progress`; F02 default-focus fix pointed there | use zero-progress account `lsr_s38` |
| 4 | Day-1 "no Start-New-Words button" (not-reached) | called `enterSessionOnly` (enters cards) BEFORE `driveNewWordsToTest` (also clicks Start) → double-enter conflict | drive directly with `driveNewWordsToTest` (Run L's `day1Complete` pattern); dropped `enterSessionOnly` |
| 5 | Day-1 `outcome=rebuild`; Day-2 then "no Class control" everywhere | Day-1 test submit landed on the session-refresh/rebuild screen → app stuck in-session → `goDashboard` fired a beforeunload dialog, never reached dashboard | `dashReady()` now does a CLEAN reload to the public entry (`page.goto(BASE)`) between steps to clear stuck screens (policy-allowed) |
| 6 | Day 1/Day 2 landed in DIFFERENT (even prior-run) classes | `lsr_s38` accumulated enrollments across failed runs; default-focus landed on stale classes | use a PRISTINE account per run (`lsr_s39`+); harden `dashReady` to VERIFY landing (retry ×3, confirm visible class name) |
| 7 | switch after Day 1 hit "no Class control" (stuck) | Day-1 submit → "session refreshed / rebuild" screen leaves an active session; navigating away fired a **beforeunload** dialog that the harness auto-DISMISSED → nav cancelled → never reached dashboard | `dashReady` now `armDialog(page,'accept')` before each reload so beforeunload proceeds → dashboard loads. **This unblocked Day 2.** |
| 8 | **[OPEN]** Day-1 `outcome=rebuild` is INTERMITTENT; when it fires, Day 2 doesn't persist a real attempt (only the Day-1 attempt exists) | Day-1 test submit sometimes hits the day-guard "session refreshed" screen → Day-1 session stuck → reload resumes it → "Day 2" re-shows stale Day-1 state, no real Day-2 new attempt written. One clean run (S1_1783819677352, Day1=results) DID reach Day-2 review-study. | flakiness in the live multi-day drive — needs resilience: detect rebuild after submit, recover cleanly, and confirm each day wrote its attempt before proceeding |

## Status (latest, run S1_1783820763648, account lsr_s40)
Day 1 ✅ reached (but outcome=rebuild) · Day 2 ✅ reached review-study · Review B ❌ not reached ·
**Only 1 attempt persisted (Day-1 new pass); the Day-2 new attempt did NOT write** → the cross-class
review can't be exercised. verdict FAIL = **flow incomplete, NOT a fix contradiction.** Nothing observed
so far contradicts the #9 fix; the blocker is live-UI driver reliability (intermittent Day-1 "rebuild"
screen corrupting the Day-1→Day-2 sequence).

## Honest assessment
5 distinct driver issues fixed; Day-1 and Day-2 study flows now execute and Day-2 reaches review-study.
The remaining wall is the **intermittent Day-1 "session refreshed / rebuild"** screen (a day-guard race)
that, when it fires, prevents Day 2 from writing a real attempt — so the cross-class review (the actual
#9 acceptance) isn't reached. Each live run is ~3-4 min; this needs several more resilience iterations.

## Runbook
`PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright LSR_BUILD_ID=… NODE_PATH=/app/node_modules \
  node audit/playwright/lsr_runS1.mjs [runId]`
Sandbox only (25WT / `lsr_*` accounts + fresh `25WT RUNS1 …` classes) — NEVER the 26SM real cohort.

---

## Run S-Long Phase-1 SMOKE (2026-07-12, SLP1_1783825362789, lsr_s42) — harness VALIDATED, day-2 driver + app-signal open

**Harness works (all review guards functioned):** Day 1 CONFIRMED — UI[words=20 day=2] + FB[csd=1 twi=20 new=1 rev=0] matched; rebuild RECOVERED (state-aware); rebuild DIAGNOSED. Day 2 FAILED-CLOSED (reason=review-not-reached), did NOT false-pass. Verdict INCOMPLETE 1/2.

**Finding A — day-2 is a HARNESS driver bug, NOT app.** Probe (fresh login, csd=1) shows a HEALTHY Day 2: "DAY 2 · STEP 1 OF 2 · Learn 20 new words", Start-new-words ready, WORDS INTRODUCED 20. But the smoke's day-2 new-word drive did NOT persist (FB stayed new=1) → driver isn't completing day-2 new words. [OPEN — driver iteration]

**Finding B — possible APP double-completion signal.** Day-1 rebuild packet: warn="Duplicate day completion blocked: expected day 2, got day 1", reload=FALSE, newPersisted=TRUE. Interpretation (per the harness rubric): clean submit + counter-already-advanced + NO reload ⇒ a second day-1 completion fired that the day-guard (progressService.js:442) blocked — a candidate double-completion race, not a harness navigation. Recovered, non-blocking, but may be the ROOT of the day-2 flakiness (stale session from the double-fire). [INVESTIGATE — potential real app finding]

### Finding B — CORRECTED (2026-07-12): it IS a real app self-race → NEED_TO_FIX #10 (Codex root-caused; my first take was WRONG)
My initial conclusion (below) was WRONG. Verified: it's an app-side self-race — `getOrCreateClassProgress`
(`TypedTest.jsx:979`, `MCQTest.jsx:717`) reconciles+writes the advanced CSD from the just-written day-1 attempt
BEFORE `completeSessionFromTest`, so completion is stale-blocked by the day-guard. Filed **NEED_TO_FIX #10**.
"0 on 26SM" = latent in prod, NOT a non-bug. Harness fresh-context is a WORKAROUND, not a resolution.
Original (incorrect) note retained below for the record:

### [SUPERSEDED — WRONG] the day-1 "duplicate completion" is a HARNESS artifact, NOT an app bug
Read-only investigation. `day_guard_rejected_session_cleared` system_log: **5 events all-time, ALL from today, ALL sandbox (RUNS1/RUNSL) audit classes, ZERO from 26SM live cohort** → no real student ever hits this.
- **Mechanism:** day-1 new-word submit fires `completeSessionFromTest`→`updateClassProgress` (csd 0→1, attempt idempotent via nonce). The harness then reloads (`dashReady`) almost immediately, racing the completion's async settle → the in-flight session re-fires a SECOND day-1 completion → the day-guard (`progressService.js:442`, "expected day 2 got day 1") correctly BLOCKS it → "session refreshed" rebuild screen. **No data corruption** (csd advanced once; attempt saved).
- **Verdict:** the day-guard is a defense working AS DESIGNED. NO app bug, NO NEED_TO_FIX. A human student (slow test, no instant reload) never triggers it.
- **Harness fix (→ Finding A):** after a successful submit, POLL Firebase until csd advances BEFORE navigating/reloading — don't let dashReady race the in-flight completion. This is the root-cause fix for BOTH the day-1 rebuild AND the day-2 carried-state breakage.

---

## Run S-1 + Run S-Long P1 on the DEPLOYED #10 fix (build a967f54, 2026-07-12) — parallel, staggered 10 min

**Both failed at the SAME point — Day-2 reach — with a CLEAN Day 1, confirming #10 is fixed:**
- **Run S-1** (`S1_a967f54`, student s55): `Day1 A: outcome=results` (csd=1/twi=20, NO rebuild). `Day2 A:
  reached=false` → "Session-menu button not visible" → test not reached → cross-class review (the #9 test)
  never exercised. verdict FAIL = flow-incomplete, NOT a #9 contradiction.
- **Run S-Long P1** (`SLP1_a967f54`, student s56): **day 1 CONFIRMED** (UI words=20 day=2; FB csd=1 twi=20
  new=1 rev=0). **`rebuilds: 0`** across the run. day 2 halted `new-test-not-reached`. verdict INCOMPLETE
  1/16.

**★ #10 validated in the multi-day context:** BOTH runs completed Day 1 with ZERO rebuild screens (pre-fix,
the S-Long smoke hit day-1 rebuilds). The ONLY remaining blocker is the shared Day-2 REACH flakiness
("Session-menu button not visible" / "test page not reached"), NOT the fix, NOT the app data (Day-1 data is
exactly correct in both).

**Root cause (shared helper):** `skipToTest`/`driveNewWordsToTest` gave up at an 8s cliff → raced the live
app's variable render/network. **Fix (lsr_ui.mjs, David's design):** `waitVisibleTimed` — wait a generous
ceiling (deterministic; fails only if the control TRULY never appears) + LOG appearance latency to
`findings/reach_latency.tsv` + emit `perf-slow` for any control >=3000ms (candidate student-facing lag,
surfaced not dismissed). Wired into skipToTest (30s) + drive Start/Review (20s); reach probes 15s→30s.
Re-running S-1 (instrumented, student s57) to (a) get past Day 2 and exercise #9, and (b) capture real
button-appearance latencies. S-Long P1 to be re-run on the instrumented code next.

---

## ★ VISUAL CONFIRMATION (David's request) — the Day-2 "reach flakiness" is NOT flakiness — it's a DETERMINISTIC wrong-screen

**Screenshot evidence** (`findings/lsr_menugap_*.png`, md5 `6470536e…` — BYTE-IDENTICAL across S-1, S-Long P1,
and the overlay's TD2/MD2 Day-2 failures → the SAME screen every time, not random timing): the robot, on
Day 2, lands on a **"DAY 2 COMPLETE — Great Job!"** session-summary screen (Session Summary: New Words Studied
20, Words Reviewed 5, Total Progress 20/3381; "Back to Dashboard" button). There is no "Session menu" because
the robot is PAST the session, on the summary → skipToTest correctly can't find it.

**Timing evidence** (`findings/reach_latency.tsv`, instrumented re-run): buttons that appear are near-INSTANT
(Start/Continue 4-5ms); the Session menu waited the FULL 30000ms and never appeared (ok=false). So it is NOT
slow-render (no >3s buttons anywhere) — the control is genuinely ABSENT (wrong screen). Re-run reproduced
identically: verdict FAIL, csd=1/twi=20, day2new reached=false completeVisible=true reviewStudyVisible=true.

**The suspicious discrepancy (needs investigation):** the screen says "DAY 2 COMPLETE" but shows Day-1 numbers
(20 words, 20/3381 — a real Day-2 completion is 40) and the backend has **csd=1** (only Day 1). So the app
presents a "Day 2 complete" summary the backend doesn't reflect. Candidate real finding (what does the app
serve on Day 2 after Day 1?) OR a resume-navigation artifact. NOT a harness-timeout issue.

**Correction:** my earlier "probably robot-timing / harmless flakiness" framing was WRONG (David pushed for the
visual — right call). The instrumentation still paid off: it PROVED buttons are fast and isolated this to a
deterministic wrong-state. NEXT: focused Day-2 investigation (reproduce finish-D1→start-D2, capture every
screen + FB/system_logs) to classify real-app-finding vs resume-artifact — pending David's go.

---

## ★★ INVESTIGATION RESULT — ROOT CAUSE FOUND: HARNESS navigation bug (NOT an app bug, NOT flakiness)

**The "Day 2 Complete" wall is a stale `session_states` doc the harness never clears.** Evidence chain:
- FB after Day 1 (student s57): class_progress csd=1/twi=20 (correct); **session_states = {phase:complete,
  currentStudyDay:2, newWordsTestPassed:true}** with only ONE attempt (day-1 new, studyDay=1) → stale/inconsistent.
- `clearSessionState` (deletes that doc) is called in exactly ONE student path: **the completion screen's
  "Back to Dashboard" button onClick — `DailySessionFlow.jsx:1787`** (+ the re-entry-modal "Move On",
  `:1474`). A normal completion does NOT otherwise clear it.
- Re-entry guard **`DailySessionFlow.jsx:751-755`**: `if existingState.phase===COMPLETE && currentStudyDay===1
  → setPhase(COMPLETE); return` → shows the "complete" screen. The "Day 2" label = freshly-computed
  sessionConfig.dayNumber while phase is stale-complete → "DAY 2 COMPLETE" with Day-1 numbers.
- **Harness gap (confirmed):** `goDashboard` clicks a header dashboard/home link OR reloads to BASE — it does
  NOT click the completion "Back to Dashboard" button; grep shows NO harness clicks it. So after each
  completed day the stale complete state persists → next-day entry hits the guard → wall.

**Verdict: HARNESS navigation bug. Real students are UNAFFECTED** — they click the prominent "Back to
Dashboard" button, which clears the state, so their next day starts fresh.

**FIX (harness):** after completing a day, click the completion screen's **"Back to Dashboard"** button
(triggers clearSessionState) BEFORE starting the next day — a reload/header-nav does NOT substitute. Unblocks
Run S + Run S-Long. (Explains why the overlay's Day-1 cells were fine — they measure ONE completion and never
start a next day; only the multi-day drives hit this.)

**Minor real-app NOTE (low severity, logged — not a blocker):** the re-entry guard renders a MISLABELED
"Day N+1 Complete" screen (fresh dayNumber + stale complete phase) if a student ABANDONS the complete screen
without clicking "Back to Dashboard" (e.g. closes the tab). It self-corrects (click Back to Dashboard →
clears → proceed). Candidate hardening: clear session_state on completion unconditionally, or label the
re-entry screen from the stale currentStudyDay. Low priority; real students rarely abandon the complete screen.

---

## ★★ DAY-2 FIX VALIDATED (Codex D2F-3 + loop round 2) — the wall is GONE

**Fix:** `returnFromResultsAndClearCompletion` (lsr_ui.mjs) — after a session-FINAL test the harness is on the
test-RESULTS screen (route /typedtest|/mcqtest); click its "Continue" (→ handleBackToSession → navigate back
with testCompleted:true → DailySessionFlow CompletePhase), THEN clearCompletionIfPresent (Back to Dashboard /
Move On to Next Day). Wired after the final driveTest in S-1 (day 1), S-Long (advanceOneDay exit), overlay
driveNewPass (day-1 final only). Codex traced the flow (D2F-3); Claude verified TypedTest.jsx:1259-1263/1273/
1354, MCQTest.jsx:927/937.

**Validated (S-1 r4, student s59) — FB-confirmed:**
| | r3 (before) | r4 (after) |
|---|---|---|
| Day 2 reached | reached=false, complete=true (WALL) | **reached=true, outcome=results** ✅ |
| session_states (A) | phase=complete (stale) | **phase=review-study** (healthy) ✅ |
| attempts | d1/new only | **d1/new/pass d2/new/pass** ✅ |
The stale-complete clears, Day 2 starts fresh + reaches, both attempts persist. **Root cause resolved.**

**Remaining (SEPARATE, downstream — the actual #9 crux):** S-1 r4 still FAILs at `Review B: reached=false` —
the CROSS-CLASS review in class B isn't reached after switching from A. Not the Day-2 wall (that's fixed);
it's the next step (cross-class review reach) — own investigation. A stays csd=1 because the day-2 review
never completed (was to be done in B).

**Pending:** S-Long 4-day smoke (s60) — validates the fix in the pure multi-day case incl. the Day-2+ re-entry
MODAL clearing path (D2F-1) that S-1 never reaches. Then hand the validated fix to Codex round 3.

### ✅ S-Long 4-day smoke (SLP1_a967f54_v2, s60) — FULLY VALIDATES the Day-2 fix (incl. the modal path)
4/4 confirmed days, **rebuilds: 0**: day1 csd1/twi20, day2 csd2/twi40/rev1, day3 csd3/twi60/rev2, day4
csd4/twi80/rev3 — each a full new+review day, clean transitions, correct counters. This exercises the
Day-2+ re-entry MODAL clearing path (D2F-1) that S-1 never reaches. The 16-day primitive (blocked at day 2)
now marches cleanly. Verdict "FAIL" is ONLY the spurious teacher-assign selector-gap (benign, bindAndVerify
confirmed the assignment; S-Long FATAL_KINDS still gates it — separate hygiene, cf. overlay which dropped it).

---

## ★ INVESTIGATION — "Review B not reached" = HARNESS bug; #9 cross-class review WORKS (app)
Visual+FB (script `lsr_investigate_reviewB.mjs`, s59's r4 classes; `findings/INV_reviewB_*.png`):
- B dashboard: **"DAY 1 · Learn 20 new words · Start new words"** (B class_progress null → renders Day-1); no
  "Review/Continue" button. My-Classes: B="DAY 1, 0 introduced, 1 behind", A="DAY 2, 20 introduced, On track".
- Click "Start new words" → session lands on **"Review Study — Day 2"** (reviewUI=true); FB reconciles to
  `class_progress csd=1/twi=40`, `session_states phase=review-study`. → **entering B correctly serves the
  cross-class DAY-2 REVIEW. #9 works.**
- **Harness bug:** `driveReviewToTest` expects a dashboard "Review/Continue"; B offers "Start Session"/"Start
  new words". Fix: ENTER the session (any study button) THEN drive the review (candidate `enterSessionAny`).
- **UX note (Phase-1):** B's dashboard "Learn 20 new words" is misleading (click → review); class-keyed
  Phase-1 display, Phase-2 re-key would fix. Low severity. Handed to Codex (RUNS_REVIEWB).

### RB-1 fix — r5 validation CONFOUNDED (day-2 new grading flake, NOT the fix)
S-1 r5 (s61): the enter-then-review fix MECHANISM worked (Review B: entered=true, reached=true — entered B's
session + reached a test). BUT confounded: A's **day-2 new test FAILED** grading (attempts: A d1/new/P
d2/new/**F**; B d2/new/P). No passed day-2 new → B served day-2 NEW (not the review) → cross-class REVIEW
never exercised; re-enter-A's reReviewDay2 flag fired as a false-positive (A legitimately offered the
not-yet-done review). Root cause = typed day-2 test grading flake on words 20-39 (r4 PASSED the same test;
flaky/borderline — candidate wordmap-coverage). Re-running (s62) for a clean day-2-new-pass to validate the
cross-class review + A/B convergence. Codex verifying the fix CODE in parallel (round 2).

### ★★★ #9 CROSS-CLASS ACCEPTANCE VALIDATED (S-1 r6, s62)
Clean run (day-2 new passed this time). ALL oracle checks GREEN: A csd=2/twi=40, B csd=2/twi=40, B day-2
review attempt at range **20..39** (bRange_ok), no_double_advance; UI paths clean: Day2 reviewStudy=true,
Review B entered+reviewStudy+reached+results, Re-enter A no-retake + no-reReviewDay2. **#9 (cross-class review
completion, no forced retake, A/B convergence) WORKS end-to-end.**
Verdict was a spurious FAIL: S-1's bugFindings regex `/…|fail/i` matched the substring in benign
`request-failed` (Firestore Listen/Write channel ERR_ABORTED ×14). FIXED: allowlist those (isAllowedReqFail,
matches lsr_runSL_phase1/overlay) + anchor the fatal kinds. Re-eval of r6 data under the fixed gate = ✅ PASS.
RB-1 (enter-then-review) + RB-2 (fail-closed Step-4 gate) CONVERGED (Codex GO). Fresh run s63 for the on-record PASS.

### ✅ Typed-fill fix VALIDATED + S-Long verdict hygiene → launching FULL 16-day Run S-Long
S-Long v3 4-day (s64): **4/4 confirmed days, 0 rebuilds, all 7 typed fills populated** (csd 1→4, twi 20→80,
review attempts each day) — the all-blank read race is GONE. Verdict FAILed only on the spurious teacher-assign
selector-gap → dropped flow-gap/selector-gap from S-Long FATAL_KINDS (matches overlay; fail-closed: days gate
via strict per-day confirmation). Launching the full 16-day Run S-Long (s65) — the day-primitive exit gate.
