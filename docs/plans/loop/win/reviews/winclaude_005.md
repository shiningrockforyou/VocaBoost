# WINCLAUDE round 5 — M-UI subset (RA1, RA2) with system-CA trust

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `DEEPFIX_TASK6_WINCLAUDE_MUI_SUBSET_1_RERUN2`
- **handoff:** `docs/plans/loop/win/handoffs/claude_to_winclaude_005.md`
- **git:** `a967f54` dirty
- **run:** 2026-07-14T15:32Z
- **execDecision:** `NOT_CLEAN` (0/2 — both scenarios RAN; expected locator/oracle drift + 1 fatal app-health)

---

## Consent note (why this round ran against real Firestore)
STEP0's first attempt was **blocked by the harness permission guard** as an unauthorized production read (real project `vocaboost-879c2`), because the round-4 TLS remedy had been *deferred to David* and I had no first-party confirmation. I stopped and asked David directly; **David confirmed "proceed"** (apply `--use-system-ca`, run vs the real project with sandbox `lsr_*`/25WT identities — the established audit design). Only then did I run. No `NODE_TLS_REJECT_UNAUTHORIZED` — system-CA trust only.

---

## STEP 0 — Firestore connectivity (system-CA)
```
NODE_OPTIONS=--use-system-ca  → FIRESTORE OK, docs= 1
```
✅ The TLS root-CA break from round 4 is resolved — Admin SDK connects to real Firestore via the OS trust store.

## STEP 1 — M-UI run
```
NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test \
SL_STUDENTS=lsr_s41@vocaboost.test,lsr_s42@vocaboost.test DFX_SCENARIOS="RA1 RA2" \
node audit/playwright/lsr_deepfix_ui.mjs winclaude-ui-r5
```

**Full stdout+stderr (verbatim):**
```
▶ deepfix M-UI (RO) winclaude-ui-r5 — BASE=http://localhost:5173 build=local-dev tier=base list=LSR Base Camp (audit clone)(1200) students=2
  → RA1 …
    ❌ RA1 FAIL — RA1 complete oracle: csd 4->4 (want +1); reviewAttempts not +1
  → RA2 …
[readTestRows] word spans still under-populated after deadline: 0/0
    ❌ RA2 FAIL — day 0 did not complete: no-submit
=== deepfix M-UI MANIFEST (winclaude-ui-r5) ===
  ❌ RA1    FAIL — RA1 complete oracle: csd 4->4 (want +1); reviewAttempts not +1
  ❌ RA2    FAIL — day 0 did not complete: no-submit
  ⛔ 1 fatal app-health signal(s)
❌ NOT CLEAN — 0/2 → findings/deepfix_ui_winclaude-ui-r5.json
```
**Exit code: 1**

---

## SETUP phase outcome — NOW FULLY CLEARS ✅ (big step)
Both scenarios got all the way through the shared critical path — **the whole reason for rounds 3–4 is now unblocked**:
- teacher **login** ✅ → class **create** ✅ (`25WT DFX RA1/RA2 winclaude-ui-r5`) → list **assign** ✅ (`LSR Base Camp (audit clone)`, pace=3 thr=92 mode=typed) → join code read ✅ (RA1 `7Y8CGQ`, RA2 `TYDUNZ`) → student **login + join + select list** ✅ (both students `member`).
- Then RA1/RA2 executed and failed at the **scenario/oracle** level — the drift you predicted.

## Per-scenario verdicts + oracle detail (verbatim)
| Scenario | Verdict | studentUid | classId | Detail |
|---|---|---|---|---|
| RA1 | FAIL | 3MUIeEHhrb… | fLYKxVrETb… | `RA1 complete oracle: csd 4->4 (want +1); reviewAttempts not +1` |
| RA2 | FAIL | LZ9NeANMfI… | dOUctcUAW6… | `day 0 did not complete: no-submit` |

listId `uhKYwNKHDtbFaY2goHQh` (1200 words). **FINAL: `NOT-CLEAN — 0/2`.**

## Raw anomaly log (verbatim — the diagnostic gold; triage all)
```
STEP [teacher] create class "25WT DFX RA1 winclaude-ui-r5"
STEP [teacher] assign "LSR Base Camp (audit clone)" … (pace=3 thr=92 mode=typed) → ok
STEP [teacher] read join code … → 7Y8CGQ
STEP [RA1] join … via 7Y8CGQ → member
[15:29:46] flow-gap — [RA1] single-list focus "LSR TOP Vocab (audit clone)" != "LSR Base Camp (audit clone)"
[15:30:23] unexpected-dialog — [student-RA1] UNEXPECTED native dialog (not armed): "" — auto-dismissed   ← the 1 FATAL
STEP [teacher] create class "25WT DFX RA2 winclaude-ui-r5"
STEP [teacher] assign "LSR Base Camp (audit clone)" … → ok
[15:31:15] request-failed — [teacher] GET firestore.googleapis.com/.../Listen/channel… — net::ERR_ABORTED
STEP [teacher] read join code … → TYDUNZ
STEP [RA2] join … via TYDUNZ → member
[15:31:34] flow-gap — [RA2] single-list focus "LSR TOP Vocab (audit clone)" != "LSR Base Camp (audit clone)"
[15:31:55] flow-gap — [RA2-d0] no Submit button
[15:32:14] request-failed — [student-RA2] …/Write/channel… — net::ERR_ABORTED
[15:32:14] request-failed — [student-RA2] …/Listen/channel… — net::ERR_ABORTED
[15:32:15] flow-gap — [RA2-d0] on test-results route but "Continue" never appeared (20s)
[15:32:21] request-failed — [student-RA2] …/Listen/channel… (x2) — net::ERR_ABORTED
```

## Executor read of the signal (NOT a fix — pointers for your diagnosis)
- **Likely primary:** both scenarios log `single-list focus "LSR TOP Vocab (audit clone)" != "LSR Base Camp (audit clone)"` — the student session focuses a **different list than the one assigned**. That plausibly explains RA1's oracle miss (csd/reviewAttempts on the assigned list never advance because the wrong list was practiced). Could be a seed/list-selection locator or a default-list pick.
- **RA2 day-0:** `no Submit button` then `"Continue" never appeared (20s)` on the test-results route → a drifted submit/continue locator or a gated completion.
- **1 fatal:** an unarmed native dialog on student-RA1 (empty text) — a `beforeunload`/confirm the harness didn't expect.
- **ERR_ABORTED on firestore …/Listen|Write/channel** — most likely benign long-poll teardown on page close, but flagging since one coincided with RA2's stuck completion.

## Artifacts / screenshots
- `audit/playwright/findings/deepfix_ui_winclaude-ui-r5.json` (per-scenario + fatals + uids/classIds)
- `audit/playwright/findings/deepfix_ui_winclaude-ui-r5.md` (summary table)
- `audit/playwright/findings/B_LIST_PROGRESS_PHASE1_DFX_winclaude-ui-r5.md` (the full raw anomaly log above)
- **No new screenshots** for this run. (The two `lsr_tch_assign_gap_25WT_RUNS1_*_r5.png` in `findings/` are **stale Jul-12 files** from an unrelated run — they only match a `*r5*` glob incidentally; the harness did not `shot()` on these oracle-level failures.)

## Sandbox / prod hygiene
- Real classes created under the **25WT** sandbox prefix (`25WT DFX RA1/RA2 winclaude-ui-r5`) with `lsr_*@vocaboost.test` identities — segregated from `26SM`. Left in place (executor doesn't clean up; note for you if you want a sweep). **No 26SM/prod-cohort contact.**

## Executor discipline
Executor-only: no edits to harness/src/flags. `--use-system-ca` applied per David's explicit confirmation (safe remedy, verification NOT disabled). No commits/branches.

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_005.md` (this file).
- `baton.json` → `turnOwner="claude"`, `revision=10`, `execStatus="run-written"`, `execDecision="NOT_CLEAN"`, `updatedBy="winclaude"`, `updatedAt=2026-07-14T15:33Z`.
- Self-wake watcher re-backgrounded at baseline 10. Dev server up on 5173. **`NODE_OPTIONS=--use-system-ca` must be set on every future node run** (Bash env doesn't persist across my calls — I prefix it inline each time).
