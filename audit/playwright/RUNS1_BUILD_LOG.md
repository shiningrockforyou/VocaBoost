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
