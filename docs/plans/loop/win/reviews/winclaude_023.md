# WINCLAUDE round 23 — M-NET admin-init fix → matrix WORKS + a real resilience finding (NET-1)

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `DEEPFIX_TASK6_WINCLAUDE_MNET_ADMININIT`
- **handoff:** `docs/plans/loop/win/handoffs/claude_to_winclaude_023.md`
- **git:** `a967f54` dirty · **run:** 2026-07-15T11:29Z (net-r23, s136–s138)
- **execDecision:** `NOT_CLEAN` — **2/3, and this is the GOOD kind: the M-NET machinery finally exercised end-to-end, and the 1 FAIL (NET-1) is a real resilience finding, not a harness break.**

---

## ✅ The admin-init fix worked — M-NET runs for the first time
Both your fixes landed: `FB.db()` at startup initialized admin before the first `admin.auth()`, so **uid resolved**, setup cleared (teacher create/assign → student login/join/focus → day-1 test), and all three degradation helpers exercised. No `createUser`/CDP/`setOffline`/`route` errors.

**Bonus — confirms my r22 retraction:** **no `created fresh sandbox account` line** appeared for any scenario (0 in stdout) → the accounts **already existed** (branch A). So s136-138 were never missing; the r20/r21 "no uid" was 100% the masked admin-init bug, as retracted. Good to have that settled.

## FINAL manifest (verbatim)
```
▶ deepfix M-NET net-r23 — BASE=http://localhost:5173 tier=base list=LSR Base Camp (audit clone) students=3
  → NET-1 …  ❌ NET-1 FAIL — offline submit produced 0 new attempts after reconnect (lost write)
  → NET-2 …  ✅ NET-2 PASS — slow network on submit → exactly 1 attempt, eventual success (no false-fail/dup)
  → NET-3 …  ✅ NET-3 PASS — one-shot write failure on submit → retried to exactly 1 attempt (idempotent)
=== M-NET (net-r23) === NOT_CLEAN — 2/3
```

## Per-scenario (verbatim)
- **NET-2 PASS** (`3EsAnQAA…`) — slow-3G on submit → **exactly 1 attempt**, eventual success, no false-fail/dup. App is resilient to a slow link.
- **NET-3 PASS** (`wlZPGer8…`) — one-shot write failure on submit → **retried to exactly 1 attempt (idempotent)**. App's retry recovers a single transient write failure cleanly.
- **NET-1 FAIL** (`eJM2pPdI…`) — offline blip on submit → **0 new attempts after reconnect (lost write)**. ← the finding.

## NET-1 — the resilience finding (evidence + the honest open question)
**What was measured:** after taking the network offline during the submit and reconnecting, the Admin-SDK oracle found **0 new attempts** for the student → the submission was lost.

**Evidence the degradation was real + the app tried (raw log, verbatim):**
```
[11:30:48] POST …/cloudfunctions.net/gradeTypedTest — net::ERR_INTERNET_DISCONNECTED
[11:30:48] console-error [student-NET-1] Grading attempt 1/3 failed [functions/internal, 369ms]: FirebaseError: internal
[11:30:48–50] repeated POST …/Firestore/Write/channel (RID=632,925,790) — net::ERR_INTERNET_DISCONNECTED
[11:30:50] POST …/cloudfunctions.net/getGradingStatus — net::ERR_INTERNET_DISCONNECTED
```
**The app UI (I opened `findings/net1_noattempt_net-r23.png`):** the test screen ("New Words Test — Day 1", 17/30 answered) with a modal: **⚠️ "Connection Issue" · "Retrying in 10 seconds…" · "(Attempt 1/3)"**, Submit shows "Grading…". **So the app HAS offline-retry UX** — it detects the drop and shows a 3-attempt retry.

**The telling asymmetry:** NET-3 (a *single transient* write failure) PASSES via idempotent retry, but NET-1 (a *sustained offline* window) loses the write. That points at a **bounded 3-retry that doesn't survive an offline period long enough to exhaust it, with no durable flush-on-reconnect** — i.e. the grading/attempt submit may not be backed by a persistent offline queue that replays after the connection returns.

**Honest open question (this is WSL-Claude's diagnosis, not my call):**
- **Real finding** if: the app's 3 retries (10s each) exhaust while still offline and nothing re-submits after reconnect → a genuine lost-write / offline-queue-coverage gap on the grading submit path. (Worth checking whether this path uses any durable offline queue the app has elsewhere.)
- **Harness artifact** if: the offline window vs the app's 10s×3 retry schedule / the oracle's post-reconnect wait didn't give a retry time to land after reconnect. Needs the M-NET offline-window + measurement timing checked against the observed "Retrying in 10 seconds (Attempt 1/3)".

I'm reporting it as a **FAIL with a real measured lost-write**, but flagging that the real-vs-timing call needs your look at the reconnect timing before it's certified as a product bug.

## Artifacts
`findings/deepfix_net_net-r23.{json,md}` · raw `findings/B_LIST_PROGRESS_PHASE1_DFN_net-r23.md` · screenshot **`net1_noattempt_net-r23.png`** (the Connection-Issue retry modal above).

## For WSL-Claude (deliverable)
M-NET is **live and green on 2/3** — slow-3G and transient-write-fail are resilient (exactly-1, idempotent). **NET-1 is a real, measured offline-submit lost-write**, with the app showing a bounded 3-retry ("Retrying… Attempt 1/3") that doesn't recover the write after a sustained offline blip. Adjudicate real-bug (no durable offline-queue on the grading submit) vs harness reconnect-timing by checking the offline-window/wait against the 10s×3 retry schedule. If real, it's the first genuine M-NET product finding.

## Executor discipline / hygiene
Executor-only, no edits (only opened the screenshot + read logs). `--use-system-ca` per David's confirmation. Sandbox `lsr_*`/25WT only; classes left in place. No 26SM/prod. No commits/branches. `createUser` not gated (accounts existed anyway → branch A). 

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_023.md`.
- `baton.json` → `turnOwner="claude"`, `revision=46`, `execStatus="run-written"`, `execDecision="NOT_CLEAN"`, `updatedBy="winclaude"`, `updatedAt=2026-07-15T11:37Z`.
- Watcher re-backgrounded at baseline 46. Dev server up on 5173.
