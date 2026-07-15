# WINCLAUDE round 8 — review-only completion recognition → oracle now runs

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `DEEPFIX_TASK6_WINCLAUDE_MUI_SUBSET_1_R8`
- **handoff:** `docs/plans/loop/win/handoffs/claude_to_winclaude_008.md`
- **git:** `a967f54` dirty · **run:** 2026-07-14T16:07Z
- **execDecision:** `NOT_CLEAN` (0/2) — but this is **outcome #2 (real state finding at the oracle)**, the useful one. Two caveats below.

---

## The run
```
NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test \
SL_STUDENTS=lsr_s41@vocaboost.test,lsr_s42@vocaboost.test DFX_SCENARIOS="RA1 RA2" \
node audit/playwright/lsr_deepfix_ui.mjs winclaude-ui-r8
```
**Full stdout+stderr (verbatim):**
```
▶ deepfix M-UI (RO) winclaude-ui-r8 — BASE=http://localhost:5173 build=local-dev tier=base list=LSR Base Camp (audit clone)(1200) students=2
  → RA1 …
    ❌ RA1 FAIL — RA1 complete oracle: csd 4->4 (want +1); reviewAttempts not +1
  → RA2 …
    ❌ RA2 FAIL — day 0 csd 4->4 (want +1)
=== deepfix M-UI MANIFEST (winclaude-ui-r8) ===
  ❌ RA1    FAIL — RA1 complete oracle: csd 4->4 (want +1); reviewAttempts not +1
  ❌ RA2    FAIL — day 0 csd 4->4 (want +1)
❌ NOT CLEAN — 0/2 → findings/deepfix_ui_winclaude-ui-r8.json
```
**Exit code: 1** · fatals: [] · FINAL `NOT-CLEAN — 0/2`

---

## ✅ Milestone: the ORACLE NOW RUNS for both
Both scenarios advanced past the day-complete summary and executed the real progress oracle — we finally have **csd/reviewAttempts** detail instead of a flow gap. That's exactly the recognition fix doing its job.

## Per-scenario oracle detail (verbatim)
| Scenario | Verdict | studentUid | classId | Oracle detail |
|---|---|---|---|---|
| RA1 | FAIL | 3MUIeEHhrb… | i9vnqLxFyx… | `csd 4->4 (want +1); reviewAttempts not +1` |
| RA2 | FAIL | LZ9NeANMfI… | 2XdXLofaKY… | `day 0 csd 4->4 (want +1)` |

## ⚠️ Caveat 1 — the Session-menu selector-gap is NOT gone (handoff expected it gone)
The raw anomaly log **still logs** the 30s gap for both, i.e. the harness still waits the full 30s for the Session-menu button, times out, then falls through to recognize the day-complete screen and run the oracle:
```
[16:05:05] selector-gap — [RA1]    Session-menu button not visible after 30009ms
[16:07:00] selector-gap — [RA2-d0] Session-menu button not visible after 30007ms
```
So the recognition fix made that gap **non-terminal** (good — oracle runs), but it did **not** eliminate the dead 30s wait per scenario. If you want, short-circuit the Session-menu wait once `dayCompleteVisible()` is true. (Reporting the discrepancy verbatim per executor rules — not fixing.)

## ⚠️ Caveat 2 — this is now a CLEAN read of a real state finding
The `csd 4->4` number is the same string RA1 showed back in **r5** — but r5 was **confounded** (student was on the wrong list "TOP Vocab", so csd not advancing was explainable). Now, post-focus-fix (r7 validated the correct **Base Camp** list) **and** post-recognition-fix, the day **visibly completes** ("Day 5 Complete / Great Job!", r7 screenshot) yet:
- **`csd` does not advance** (4 → 4, oracle wants +1), and
- **`reviewAttempts` does not increment** (RA1).

So under now-correct conditions, the review-only day's completion is **not writing the progress the oracle expects**. This is a **genuine state finding** for you to judge: either a real #11 progress-write miss (completion doesn't persist csd/reviewAttempts), OR the oracle's `csd+1` expectation is wrong for a *review-only* day (maybe csd only advances on new-word days). The raw number is the deliverable; the spec call is yours.

## Raw anomaly log (verbatim, condensed)
```
RA1: create/assign "25WT DFX RA1 …r8" (Base Camp) ok · join 9N5Z67 → member
     [16:04:24] request-failed [student-RA1] …/Write|Listen/channel ERR_ABORTED (x2)
     [16:05:05] selector-gap Session-menu button not visible 30009ms
RA2: create/assign "25WT DFX RA2 …r8" (Base Camp) ok · join 2LUA4C → member
     [16:06:19] request-failed [student-RA2] …/Write|Listen/channel ERR_ABORTED (x2)
     [16:07:00] selector-gap [RA2-d0] Session-menu button not visible 30007ms
```
(No focus-mismatch lines — pin still holds. No fatal dialog. `ERR_ABORTED` teardown noise persists.)

## Artifacts
`findings/deepfix_ui_winclaude-ui-r8.json` · `…-r8.md` · `findings/B_LIST_PROGRESS_PHASE1_DFX_winclaude-ui-r8.md` (raw) · screenshots `lsr_menugap_RA1.png`/`lsr_menugap_RA2_d0.png` (same 37202-byte "Day 5 Complete / Great Job!" summary as r7).

## For WSL-Claude (deliverable)
Recognition fix works — the oracle runs and we're now at a **real progress-state finding**: correct list + visibly-completed review-only day, but `csd` flat (4→4) and `reviewAttempts` not incremented. Decide whether that's a #11 completion-write bug or an oracle expectation to adjust for review-only days. Separately, the 30s Session-menu wait still fires (non-terminal) — optional short-circuit.

## Executor discipline / hygiene
Executor-only, no edits; `--use-system-ca` per David's confirmation. Sandbox 25WT/`lsr_*` only; new `…-r8` classes left in place. No 26SM/prod. No commits/branches.

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_008.md`.
- `baton.json` → `turnOwner="claude"`, `revision=16`, `execStatus="run-written"`, `execDecision="NOT_CLEAN"`, `updatedBy="winclaude"`, `updatedAt=2026-07-14T16:08Z`.
- Watcher re-backgrounded at baseline 16. Dev server up on 5173.
