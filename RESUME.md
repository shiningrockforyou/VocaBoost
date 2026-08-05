# RESUME — DEEPFIX2 (2026-08-05 late: ENGINE DEPLOYED DARK · exploit closed live · DF2-51 CODE-COMPLETE · 2 orders + gates await David)

## ⚡ FIRST ACTION — arm the monitor, then session-start, then READ THE BATON
```
Monitor({command: "bash /app/scripts/deepfix2/baton-monitor.sh",
         description: "DEEPFIX2 baton returns (win + codex)", persistent: true, timeout_ms: 3600000})
```
Then `bash scripts/deepfix2/session-start.sh`. **Win baton is IDLE with claude (rev 204, r105 DEPLOYED).**
**TWO PREPARED ORDERS AWAIT DAVID — do not execute, do not nag:**
- **order 106** (`handoffs/claude_to_winclaude_106.md`) — the RULES deploy (rv2_ namespace reservation).
- **order 107** (`handoffs/claude_to_winclaude_107.md`) — the FIRST FLAG-ON visual walkthrough (= 51-h).
**Codex: David says the baton may not return — dispatch NO codex rounds.** He plans to review the codex
audits + gates when back.

## WHAT SHIPPED TO PRODUCTION TODAY (order 105, David present, byte-verified)
Ten functions UPDATED (typed leg + namespace guards + the NTF-26 grader fix), zero created/deleted, from
pin c7d7cc7. **ORCHESTRATOR-VERIFIED LIVE, not accepted from the report:** dark state intact
(`system_config/review_v2` enabled:false, rehearsalClassIds:[]) AND a live probe of the deployed grader
as a 25WT student returns **0/20 correct for the 20×"answer" exploit** (was 20/20) with a real
student-facing reason. **NTF-26 is CLOSED in production for all 947 students.**

## COMMITTED, NOT DEPLOYED (rides a later David-executed functions order)
- **ai-metering** (d3dce7a) — counts every AI-grading call; caps ONLY practice retests; a live/required
  typed test is STRUCTURALLY unrefusable. Two-round opus audit GO. The audit caught a contention
  blocker (global counter serialized all 947 students' live claims: 105ms → 19,521ms at 80 concurrent);
  the global write now leaves the live txn entirely — 183ms, counts exact. NTF-29 cards a LOW
  KST-midnight straggler (under-counts only).
- **DF2-51 (the past-day/free-nav feature) — CODE-COMPLETE, 7/8 folds**, each fixtured + mutant-killed +
  orchestrator-re-executed; the last one (retest+cap+reload) carries an independent opus audit GO whose
  flag-off proof is by EXHAUSTION (all 19 deleted lines per page traced + an executed flag-off reduction).
  Scope = David's CORE+EXTRAS ruling. **Only 51-h (the flag-ON visual) remains = order 107.**

## THE STATE OF THE GATES (all David's; nothing here is blocked on me)
`functions-deploy-engine` ✅ DONE · **rules deploy (order 106)** · **flag-ON visual (order 107)** ·
flip-abort-thresholds ratify · gate4 backfill-go · gate5 flip-go · gradedIsCorrect trust (DATA IN — see
below) · teacher-registration.

## DECISIONS DAVID MADE TODAY (8 total, all recorded in the queue + change log)
Round 1: NTF-26 fix-the-prompt · deploy prepare-now/run-ASAP · **build the AI meter first, launch both
modalities** · df2-51 mockups-first · gradedIsCorrect scan-first.
Round 2: **df2-51 = CORE + EXTRAS** · B0 R1/R5 manually watched · spend limits ratified (40/student/day,
6000/day global) · rules deploy prepare-now.

## FINDINGS THIS SESSION THAT WERE NOT ON ANYONE'S LIST
- **NTF-30 (CRITICAL PATH, now resolved to a script):** B0's premise was FALSE — production `ops_metrics`
  is EMPTY and NO R1–R7 emitter exists anywhere. 21_ CORRECTED (its sentence retracted verbatim + three
  scoping errors: R6 is a VOLUME not a rate, R4 splits, R7-MCQ is vacuous). **No waiting week** — five
  invariants derive from 38-44d of history. `scripts/deepfix2/b0-baseline.mjs` is the deterministic
  producer (mandatory explicit window, `--verify` mode). What remains is a FLIP-TIME freeze, not a build.
- **A real bug found by that work:** `grading_jobs.leaseExpiresAt` is epoch-ms, not a Timestamp — it had
  been ZEROING R7's never-graded rate.
- **The most-cited failure stat was a June INCIDENT, not a rate** (`permission-denied` 471/597, zero
  in-window) ⇒ its post-flip rule should be "any occurrence at all", a sharper alarm.
- **gradedIsCorrect sweep (3882af7):** 1,038,196 rows, ZERO unexplained discrepancies — the 23 typed
  mismatches are our own CS-2026-07-23b fix. Field exists on 51 rows (0.005%). RECOMMENDATION for gate 4:
  ignore the field, recompute, WITH an adjudication/manualOverride carve-out (a naive recompute would
  REVERT those 23 CS corrections).

## STANDING FACTS (unchanged unless noted)
- WSL cannot run vite (RE-TESTED today: rollup native is win32-only) ⇒ every visual is a WinClaude order.
  **NEW: playwright + chromium DO work here** (installed to the scratchpad `pw-browsers` path) — static
  HTML renders to PNG fine, which is how the wireframes were produced.
- Dev build talks to REAL prod Firebase ⇒ 25WT only, never 26SM. Typed tests bill real tokens.
- Emulator: `PATH="$HOME/jre/jdk-21.0.12+8-jre/bin:$PATH" NODE_PATH=/app/node_modules
  ~/fbtools/node_modules/.bin/firebase emulators:exec --only firestore --project vocaboost-879c2 "node <s>"`.
  ONE lap at a time (`audit/deepfix/emulator-lap.lock`; a killed run leaves it — clear a stale one).
- Grader key: Secret Manager via the admin SA (scratchpad only, never printed/committed).
- Netlify builds STOPPED, production pinned `ce09792` ⇒ pushes are inert client-side.
- **gate.mjs is down to ONE failure**: pre-existing NUMBERS against `audit/deepfix/task3` + `17_`, which
  belong to the RULES workstream (order 106). EVERY evidence receipt is green against the current tree.
- A parallel CS session shares this repo — stage explicitly, never `git add -A`; expect living-log dirt.
