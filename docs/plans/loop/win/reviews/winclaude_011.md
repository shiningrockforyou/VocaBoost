# WINCLAUDE round 11 — confirm harness fixes + RO-S1 diagnostic

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `DEEPFIX_TASK6_WINCLAUDE_MUI_CONFIRM_RS1_ROS1`
- **handoff:** `docs/plans/loop/win/handoffs/claude_to_winclaude_011.md`
- **git:** `a967f54` dirty · **run:** 2026-07-14T20:59–21:11Z (7 scenarios, background)
- **execDecision:** `NOT_CLEAN` — **2/7 PASS** (RS-2 newly green + RO-S9), fatals now **0**

---

## FINAL manifest (verbatim)
```
❌ RS-1   FAIL    — RS-1: Showing=8 > target attempts 3 — filter not server-side (filler rows leaked)
✅ RS-2   PASS    — testId-less attempt renders with list title "LSR Base Camp (audit clone)" (1 row(s))
❌ RS-3   FAIL    — RS-3: list NOT shown on the teacher Assigned-Lists surface
⚠️ RS-4   INVALID — score 40% outside [90,95) — grader drift; re-calibrate the answer count
❌ RO-S1  FAIL    — RO-S1: csd 0->0 (want 0->1); twi 0->0 (want +pace); no passed new attempt recorded
✅ RO-S9  PASS    — finished hero persistent, no misleading copy, re-entry recorded nothing (csd2|twi1200|rs0|se0)
❌ RO-S10 FAIL    — RO-S10: submit produced a RESULTS screen — a FALSE SUCCESS on a day-guard collision …
FINAL: NOT CLEAN — 2/7 · fatals: 0
```

## ① Harness-fix confirmations
- **(a) Fatal count = 0 ✅** — the `src/index.css ERR_ABORTED` is no longer classified fatal. Confirmed (JSON `fatals: []`).
- **(b) RS-1 does NOT pass, but the oracle FIX is working** ✅ — it now asserts on the **filter result** and produced a concrete, real signal: `Showing=8 > target attempts 3`. So the r10 name-token bug you fixed is gone; the assertion is now meaningful. **But see ② — I opened the screenshot and the manifest's "filler rows leaked" label looks like a misread.**
- **Bonus:** **RS-2 newly PASSES** (`testId-less attempt renders with list title … (1 row)`) — was FAIL in r10. Second green.

## ② RS-1 — I opened `DFX_RS1_gradebook_winclaude-ui-r11.png` (important correction)
> Filter **`Name: LSRDEEPCV9V`** → **"Showing: 8"** → 8 rows, **every row NAME = "LSR Student 41"** (the target/deep student; the token is its identifier, "LSR Student 41" its display name). The **CLASS** column spans multiple runs:
> - 1× `25WT DFX RS-4 winclaude-ui-r10` (New Words, Day 1, 37%)
> - 1× `25WT DFX RS-2 winclaude-ui-r10` (Review, 100%)
> - 3× `25WT DFX RS-1 winclaude-ui-r11` (Review, 88%) ← this run
> - 3× `25WT DFX RS-1 winclaude-ui-r10` (Review, 88%) ← last run

**What this actually shows (pointer, not a fix):** the 8 rows are **not** filler-student rows — they're the **same target student's attempts accumulated across un-swept prior-run classes** (r10 RS-1/RS-2/RS-4 + this run's RS-1). The filter *is* returning the right student; the count is inflated because (i) the deep student account (`lsr_s41`) is **reused across runs**, and (ii) prior sandbox classes were **left in place** ("don't clean up"), so its history piles up. So RS-1 reads as a **test-isolation / oracle-scoping** problem (scope the count to *this run's* class/testId), **not** the "filter not server-side / filler leaked" the manifest string asserts. Worth re-checking before treating RS-1 as a filter bug. (Also: the pending 25WT DFX sweep is now materially affecting counts — may want it sooner.)

## ③ RO-S1 — the diagnostic: NO screenshot was written
The handoff expected a flow-gap `shot()` for RO-S1 — **none exists.** Only RS-1–RS-4 read-surface shots were written this run; there is **no** RO-S1 / flow-gap PNG. So I can't give you the visual (I did not fabricate one, and reproducing the exact stuck state manually is outside executor scope).

**What the raw log DOES show for RO-S1 (verbatim):**
```
STEP [RO-S1] join "25WT DFX RO-S1 winclaude-ui-r11" via PUM763 → member
[21:07:59] flow-gap — [RO-S1] on test-results route but "Continue" never appeared (20s)
```
So RO-S1 (a new-word day) reached a **test-results route** but the **"Continue" button never appeared within 20s** → the new-word test flow **didn't complete** → downstream `no passed new attempt recorded`, `csd 0->0`, `twi 0->0`. This is the **same "Continue never appeared" symptom family** seen earlier on RA2 (r5/r6). Direction of evidence: **flow-gap (a Continue locator/appearance issue on the results screen), not confirmed app-persistence** — the day never finished, so "didn't persist" is expected, not proof of a write bug. **To get you the actual screen, the harness needs a `shot()` wired on this `flow-gap` path** (it currently only shot()s the RS read-surfaces). I'd re-run once that's added.

## ④ Unchanged (verbatim, as expected — already classified)
- **RS-3** `RS-3: list NOT shown on the teacher Assigned-Lists surface` — unchanged (P2 read-render, flag-on validate).
- **RO-S10** `submit produced a RESULTS screen — a FALSE SUCCESS on a day-guard collision (must rebuild); no day_guard_rejected log NOR day-guard console warn observed (uid signal)` — unchanged (known DSF:1529 carry-forward; server day-guard emulator-certified CS-2).
- **RS-4 INVALID** grader drift 40% (was 37% r10) — deferred.

## Artifacts
`findings/deepfix_ui_winclaude-ui-r11.{json,md}` · `findings/B_LIST_PROGRESS_PHASE1_DFX_winclaude-ui-r11.md` (raw) · screenshots `DFX_RS1_gradebook`/`DFX_RS2_gradebook`/`DFX_RS3_assignedlists`/`DFX_RS4_resultcard`_winclaude-ui-r11.png. **No RO-S1 screenshot** (see ③).

## For WSL-Claude (deliverable)
Both fixes confirmed: fatals→0, RS-1 oracle now meaningful (+ RS-2 flipped green → 2/7). Two things need your call: **(1) RS-1** — the "Showing=8" is cross-run accumulation on the reused deep student across un-swept classes, not a filler/filter leak; scope the oracle to this run (and consider sweeping 25WT DFX now). **(2) RO-S1** — it's a "Continue never appeared" **flow-gap** on the new-word results screen (not proven persistence); wire a `shot()` on that flow-gap and I'll capture the screen next run.

## Executor discipline / hygiene
Executor-only, no edits; `--use-system-ca` per David's confirmation. Sandbox 25WT/`lsr_*` only (3 students incl. `lsr_s43` filler); new `…-r11` classes left in place. No 26SM/prod. No commits/branches.

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_011.md`.
- `baton.json` → `turnOwner="claude"`, `revision=22`, `execStatus="run-written"`, `execDecision="NOT_CLEAN"`, `updatedBy="winclaude"`, `updatedAt=2026-07-14T21:13Z`.
- Watcher re-backgrounded at baseline 22. Dev server up on 5173.
