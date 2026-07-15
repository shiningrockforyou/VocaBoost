# WINCLAUDE round 24 — M-NET NET-1 timing fix → 3/3 CLEAN (matrix certified)

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `DEEPFIX_TASK6_WINCLAUDE_MNET_NET1TIMINGFIX`
- **handoff:** `docs/plans/loop/win/handoffs/claude_to_winclaude_024.md`
- **git:** `a967f54` dirty · **run:** 2026-07-15T11:45–11:50Z (net-r24, s136–s138, ~4m52s total)
- **execDecision:** `CLEAN` ✅ — **3/3 PASS. M-NET (the 6th matrix) is certified; NET-1 confirmed as the timing artifact, app correct.**

---

## FINAL manifest (verbatim)
```
▶ deepfix M-NET net-r24 — BASE=http://localhost:5173 tier=base list=LSR Base Camp (audit clone) students=3
  → NET-1 …  ✅ NET-1 PASS — offline blip on submit → exactly 1 attempt after retry-recovery (no dup, no loss)
  → NET-2 …  ✅ NET-2 PASS — slow network on submit → exactly 1 attempt, eventual success (no false-fail/dup)
  → NET-3 …  ✅ NET-3 PASS — one-shot write failure on submit → retried to exactly 1 attempt (idempotent)
=== M-NET (net-r24) === CLEAN — 3/3
```
JSON: `verdict: CLEAN · 3/3`.

## NET-1 — flipped to PASS, adjudication confirmed
The `awaitAttemptDelta()` poll worked exactly as designed. The raw log shows the SAME offline sequence as r23:
```
[11:46:43] POST …/gradeTypedTest — net::ERR_INTERNET_DISCONNECTED
[11:46:43] console-error [student-NET-1] Grading attempt 1/3 failed [functions/internal, 345ms]: FirebaseError: internal
```
…but this time the oracle **polled through the 10s retry gap**, caught **attempt 2's online recovery landing the durable write**, and measured **exactly 1 attempt** → PASS. Then the 6s stabilization re-read confirmed **no late duplicate**.

**So the r23 adjudication holds: NET-1 was a harness reconnect-timing artifact, and the app is correct** — an offline blip during submit is recovered by the built-in 3×10s retry (`TypedTest.jsx gradeWithRetry`) with **exactly one durable attempt, no loss, no duplicate.** (Good outcome that r23 flagged it as real-vs-timing rather than certifying a bug.)

## NET-2 / NET-3 — stayed PASS
- **NET-2 PASS** — slow-3G → exactly 1, eventual success, no false-fail/dup.
- **NET-3 PASS** — one-shot write failure → retried to exactly 1, idempotent. **Now deterministic** (de-raced onto the same `awaitAttemptDelta` poll, no longer passing by a timing race).

## Timing / helper health
- **Total wall-clock ~4m52s** for all 3 scenarios (incl. setup). **No scenario sat near the 45s poll ceiling** — each write landed within its retry window and the poll exited early on delta≥1 (NET-1's recovery ~t≈11s as adjudicated). So no "slow write" signal.
- **No `awaitAttemptDelta` / CDP `emulateNetworkConditions` / `setOffline` / `page.route` errors** — the degradation helpers are all healthy on native Windows.
- The `src/index.css ERR_ABORTED` + Firestore-channel teardown noise persists (benign, as before).

## Artifacts
`findings/deepfix_net_net-r24.{json,md}` · raw `findings/B_LIST_PROGRESS_PHASE1_DFN_net-r24.md`. (No failure screenshots — 3/3 pass.)

## For WSL-Claude (deliverable) — M-NET certified
**M-NET is CLEAN 3/3.** The app is resilient under all three submit-chokepoint degradations — offline blip, slow-3G, one-shot write failure — each yielding **exactly one durable attempt, no dup, no loss.** The one apparent finding (NET-1) resolved to a harness-timing artifact; the fix confirms the app's retry recovery is correct. The degradation-helper toolkit (`withOffline`/CDP-slow/`withFailOnce` + `awaitAttemptDelta`) works end-to-end on native Windows. That's the **6th matrix done** — M-NET joins STATIC/CALL/RULES/MIG(`--dry`) as certified.

## Executor discipline / hygiene
Executor-only, no edits; `--use-system-ca` per David's confirmation. Sandbox `lsr_*`/25WT only; classes left in place. No 26SM/prod. No commits/branches. No classifier gate.

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_024.md`.
- `baton.json` → `turnOwner="claude"`, `revision=48`, `execStatus="run-written"`, `execDecision="CLEAN"`, `updatedBy="winclaude"`, `updatedAt=2026-07-15T11:51Z`.
- Watcher re-backgrounded at baseline 48. Dev server up on 5173.
