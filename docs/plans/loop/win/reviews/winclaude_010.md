# WINCLAUDE round 10 — high-value read-surface LANDSCAPE (9 scenarios)

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `DEEPFIX_TASK6_WINCLAUDE_MUI_HIGHVALUE_LANDSCAPE`
- **handoff:** `docs/plans/loop/win/handoffs/claude_to_winclaude_010.md`
- **git:** `a967f54` dirty · **run:** 2026-07-14T20:31–20:48Z (~16 min, 9 scenarios, background task)
- **execDecision:** `NOT_CLEAN` — **1/9 PASS** (first green 🎉), 7 FAIL, 1 INVALID, 5 fatal signals

---

## FINAL manifest (verbatim) — the triage map
```
❌ RS-1   FAIL    — RS-1: no gradebook row bearing the deep student's name "LSRDEEPDEZR"
❌ RS-2   FAIL    — RS-2: testId-less attempt row NOT visible in the gradebook (dropped for lacking testId)
❌ RS-3   FAIL    — RS-3: list NOT shown on the teacher Assigned-Lists surface
⚠️ RS-4   INVALID — score 37% outside [90,95) — grader drift; re-calibrate the answer count (did not exercise serverPassed-vs-0.95 gap)
❌ RO-S1  FAIL    — RO-S1: csd 0->0 (want 0->1); twi 0->0 (want +pace); no passed new attempt recorded
✅ RO-S9  PASS    — finished hero persistent, no misleading copy, re-entry recorded nothing (csd2|twi1200|rs0|se0)
❌ RO-S10 FAIL    — RO-S10: submit produced a RESULTS screen — a FALSE SUCCESS on a day-guard collision (must rebuild); no day_guard_rejected log NOR day-guard console warn observed
❌ RA1    FAIL    — RA1 complete oracle: csd 4->4 (want +1); reviewAttempts not +1
❌ RA2    FAIL    — day 0 csd 4->4 (want +1)
⛔ 5 fatal app-health signal(s)
FINAL: NOT CLEAN — 1/9
```
Per-scenario ids: RS-1 cls=I8FUKOh2 · RS-2 cls=YVVFUfv4 · RS-3 cls=U9RwgApz · RS-4 cls=WuCd4Yu0 · RO-S1 cls=ljZZqy3F · RO-S9 cls=9qErZsWA · RO-S10 cls=HAcUwAql · RA1 cls=gCINfBpf · RA2 cls=6oNZK7nI (all `25WT DFX <scn> winclaude-ui-r10`).

## ✅ RO-S9 — FIRST GREEN
`finished hero persistent, no misleading copy, re-entry recorded nothing (csd2|twi1200|rs0|se0)`. A read-surface scenario passes clean on the calibrated foundation — the harness itself is now certifying real behavior.

## 5 fatal app-health signals — all the SAME thing (likely dev-mode artifact)
Every fatal is the dev server's own stylesheet aborting on a student page:
```
request-failed: [student-RS-2 / RS-4 / RO-S1 / RO-S9 / RO-S10] GET http://localhost:5173/src/index.css?t=… — net::ERR_ABORTED
```
These are `src/index.css` (Vite dev cache-bust) `ERR_ABORTED` — consistent with the harness's hard `page.reload` aborting the in-flight CSS request. **RO-S9 still PASSED while emitting one**, so the "fatal" tag looks over-sensitive for this dev-only CSS abort rather than a real health defect. (Reporting as fatal because the harness marked it; flagging the likely cause — not fixing.)

## Read-surface findings — with screenshot evidence
Screenshots written this run:
- `findings/DFX_RS1_gradebook_winclaude-ui-r10.png` · `findings/DFX_RS2_gradebook_winclaude-ui-r10.png`
- `findings/DFX_RS3_assignedlists_winclaude-ui-r10.png` · `findings/DFX_RS4_resultcard_winclaude-ui-r10.png`
- `findings/lsr_menugap_RA1.png` · `findings/lsr_menugap_RA2_d0.png` (same "Day N Complete" wall as r7–r9)

**RS-1 — I opened `DFX_RS1_gradebook_winclaude-ui-r10.png` (important nuance):**
> Gradebook filtered **`Name: LSRDEEPDEZR`** → **"Showing: 3"** → **3 rows returned**, but every row's **NAME column reads "LSR Student 41"**, NOT "LSRDEEPDEZR". Rows: Class `25WT DFX RS-1 winclaude-ui-r10`, List `LSR Base Camp (audit clone)`, Date May 31 2026, Score `88% (0/30)`, Type `Written`, Session `Review`, Day `—`.

So the gradebook **does** surface this student's rows — under the human display name **"LSR Student 41"** — while the oracle asserts on the literal token **"LSRDEEPDEZR"**. Direction: this reads more like an **oracle/seed name-expectation mismatch** (the "deep student" token vs the rendered display name) than a missing-render bug — analogous to how RA1/RA2 turned out app-correct. WSL-Claude to confirm which. (Only RS-1 opened; RS-2/RS-3/RS-4 screenshots listed for you — say the word if you want them described like r7.)

## Per-scenario pointers (observations, NOT fixes)
- **RA1 / RA2** — identical csd-flat to r9; already adjudicated **app-correct** (deliberate no-advance guardrail, `DailySessionFlow.jsx:850-862`) and deferred. Consistent, no new signal.
- **RO-S1 (new-word day)** — `csd 0->0 (want 0->1); twi 0->0 (want +pace); no passed new attempt recorded` + flow-gap `on test-results route but "Continue" never appeared (20s)`. ⚠️ This is a **new-word day**, not the mastered-review case — so the "deliberate no-advance" explanation from RA1/RA2 likely does **not** apply. Worth a hard look.
- **RO-S10** — `submit produced a RESULTS screen — FALSE SUCCESS on a day-guard collision … no day_guard_rejected log NOR day-guard console warn`. Potentially serious correctness finding: the day-guard didn't reject a collision and produced a success screen.
- **RS-2** — testId-less attempt row dropped from the gradebook (filter/render on missing testId).
- **RS-3** — assigned list not shown on the teacher Assigned-Lists surface (teacher read-surface).
- **RS-4 INVALID** — grader drift (37% vs target [90,95)); harness calibration (answer-count), not an app finding — didn't exercise the serverPassed-vs-0.95 gap.

## Raw anomaly log
`findings/B_LIST_PROGRESS_PHASE1_DFX_winclaude-ui-r10.md` — every scenario's setup (all class-create/assign/join succeeded), the RA1/RA2 30s Session-menu selector-gaps (still non-terminal), RO-S1's Continue-never-appeared flow-gap, and the Firestore/CSS `ERR_ABORTED` lines. No focus-mismatch anywhere (pin holds across all 9).

## Suggested triage priority (my read, your call)
1. **RO-S10** false-success on day-guard collision (correctness) · 2. **RO-S1** new-word-day progress not persisting · 3. **RS-3 / RS-2** teacher read-surfaces · 4. **RS-1** confirm oracle-name vs display-name · 5. **RS-4** grader re-calibration (harness) · 6. the 5 CSS `ERR_ABORTED` fatal-classification (harness sensitivity).

## Executor discipline / hygiene
Executor-only, no edits; `--use-system-ca` per David's confirmation. Sandbox 25WT/`lsr_*` only; 9 new `…-r10` classes left in place (WSL-Claude to sweep). No 26SM/prod. No commits/branches.

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_010.md`.
- `baton.json` → `turnOwner="claude"`, `revision=20`, `execStatus="run-written"`, `execDecision="NOT_CLEAN"`, `updatedBy="winclaude"`, `updatedAt=2026-07-14T20:49Z`.
- Watcher re-backgrounded at baseline 20. Dev server up on 5173.
