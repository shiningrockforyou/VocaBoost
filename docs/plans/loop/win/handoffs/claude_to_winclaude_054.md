# WSL → WinClaude round 54: DRIVE two waves — live-ticket verbatim clones (priority) + wave-1R reconstructed-session re-run

**r53 is CANCELLED by David (superseded by this r54).** Your r53 handback (rev 106) was received and is CORRECT and
valuable — I've folded its corrections in (off-by-one advances are session-entry reconciles; that verdict still stands
because PR-1 advances score-independently). Thank you for the fail-fast timeouts + live progress log.

Two seeded waves are committed and verified in sandbox (roster: `audit/playwright/findings/a2_clone_roster.json`, all
entries carry `sessionProvenance`). **Priority order below.**

## 🔓 YOUR r53 BLOCKER IS SOLVED (WSL source-dive) — the new-word test IS reachable; two paths you missed
Your r53 concluded "the new-word study exposes NO working skipToTest and card-advance controls don't match" and fell
back to ~30s/card. **Root cause (from reading `src/pages/DailySessionFlow.jsx` + `src/components/SessionMenu.jsx`
directly):** you were clicking **"Next card"** (`[aria-label="Next card"]`, the ChevronRight) — that only **cycles the
index, it does NOT dismiss** the card (DailySessionFlow.jsx:995-999 `handleNewWordNext` just bumps `currentIndex`). So
the queue never empties, "All cards reviewed" never shows, and `optionCount` stays 0 (your `matched 0/30`). **Also: the
sim auto-swipe is dead on prod** — it's gated by `isSimulationEnabled()=import.meta.env.VITE_SIMULATION_MODE==='true'`
(useSimulation.jsx:16), which is FALSE on the live build. Don't chase it.

**REACH PATH A (FAST — use this, no card grind).** Skip-to-test lives in the kebab menu, gated on `currentQueueLength>0`:
1. Click the header kebab: `[aria-label="Session menu"]`  (SessionMenu.jsx:92)
2. Click the menu item **"Skip to Test"**  (exact text, SessionMenu.jsx:122; only rendered while cards remain)
3. A confirm dialog opens → click **"Start Test"**  (`confirmLabel="Start Test"`, DailySessionFlow.jsx:2057 →
   `handleTestConfirm` → `goToNewWordTest()` → `navigateToTest('new','mcq')`)
4. You're now on the MCQ (`optionCount>0`) → your direction-agnostic matcher answers. THIS is where r53's matcher gets
   its first real test.

**REACH PATH B (fallback, if the menu item isn't present).** Dismiss every card, then take the test:
- Per card press **`C`** (or click `[aria-label="I know this word (C)"]`) — that fires `onKnowThis`, which DISMISSES the
  card and shrinks the queue. **Do NOT use the arrow / "Next card".** `C` is a keypress → ~instant, so 80 cards = seconds.
- When the last card is dismissed the panel shows **"All cards reviewed!"** → click the **"Take Test"** button
  (DailySessionFlow.jsx:2322, `onReadyForTest`→`goToNewWordTest`).
- Wrap the 80-press loop in `slog.progress('dismissCards', k+1, n)` + `slog.heartbeat()` (the in-loop rule below).

**⚠️ GATE BEFORE EITHER PATH — the first-run "Start Studying" modal (this is very likely what wedged you).** The 80 cards
sit behind a one-time "Customize Your Flashcards" modal whose button reads **"Start Studying"** (DailySessionFlow.jsx:2173).
It renders whenever localStorage `vocaboost_showKoreanDef`/`vocaboost_showSampleSentence` are UNSET — i.e. **on every fresh
Playwright context it ALWAYS appears.** Your "Step 1 of 5 / Start Studying / 80 cards" report = this modal + the header
step-text (informational only). **Step 1 of every drive: if a "Start Studying" button is present, click it** (`slog.step
('startStudyingGate',{present})`), THEN proceed to Path A/B.

**Cross-verified details (a 2nd independent source-read confirmed all of the above and added these):**
- **No `data-testid` anywhere in this flow** — target by `aria-label` or visible text ONLY. (The testids in the repo are
  apBoost's separate harness, not VocaBoost DOM.)
- **`C` auto-advances you to the test for free:** `handleNewWordKnowThis` (DailySessionFlow.jsx:951) — when the queue
  reaches ≤1 it **auto-fires the "Ready for the Test?" confirm modal**. So Path B = press `C` ×N; on the last card the
  **"Start Test"** confirm pops by itself → click it. (You don't have to hunt for "Take Test".)
- **The confirm button is "Start Test"** for BOTH paths (modal title "Ready for the Test?", DailySessionFlow.jsx:2050-2062).
- **The MCQ is a SEPARATE ROUTE** — clicking "Start Test" NAVIGATES to **`/mcqtest/:classId/:listId`** (MCQTest.jsx), it is
  not an in-page phase swap. Expect a URL change; wait on the MCQ options, then run your matcher. `slog.step('routed',{url})`.
- **No flip required** before `C`/`X` — both work regardless of flip state (skip the flip to save time).

**Verify, don't trust:** selectors are source-derived (two reads agree) but not yet driven. On the FIRST card,
`slog.step('reachProbe',{startStudyingSeen, menuFound, skipItemFound, confirmLabel, routedUrl})` so we SEE which path
engaged. If Path A's menu item is absent for a seeded state, fall to Path B. Review tests (throttle/live_oyk/live_kjk)
already reach fine — this only unblocks the NEW-WORD paths: live_lhs completion + **최도훈 lost-save** (its whole point is
retaking the missing new-word test, so this reach path is exactly what exercises it).

## ⚠️ MANDATORY (David-directed): per-step programmatic logging on EVERY drive
Drives have produced no interim output (your r52 "outcome: timeout" left no trace of WHERE it wedged). WSL built
**`audit/playwright/lsr_step_logger.mjs`** (self-tested) — wire it into EVERY drive from now on:
- `import { makeStepLogger } from './lsr_step_logger.mjs'` → `const slog = makeStepLogger('r54-<tag>')`.
- Log **after each step**: `slog.step('login',{email})` … or wrap phases: `await slog.run('renderCheck', async()=>{...})`
  (auto start/ok/FAIL + duration). Use `slog.heartbeat(15000)` during long waits; `slog.done({verdict})` at the end.
- Steps land **synchronously** in `audit/playwright/findings/steps/<runId>.jsonl` on the shared FS — **WSL tails your
  drives LIVE** while you run, and a wedged run leaves its last step visible (crash forensics).
- Minimum step set per student: `login` → `renderCheck` → `enterTest` → `answered{n/m,matched}` → `dialog` (if any) →
  `submit` → `outcome{score}` → `readback{csd,twi,reviewMode}`.
- **The steps files are part of the hand-back evidence** (list them in `evidenceFiles`). Runs without step logs = redo.
- **Converge your r53 ad-hoc `_r53_progress.log` into this module** (same idea — yours validated the need; the module
  adds per-run JSONL, seq/durations, crash-safe sync appends, heartbeat, machine-parseability). One convention from r54 on.
- **Also standard from r54: FAIL-FAST TIMEOUTS** (your r53 fix — keep it): ≤25s outcome races, capped reach helpers with
  logged fallbacks — no more 120s silent waits. Log + bound every long wait.
- **IN-LOOP PROGRESS (the 80-card gap David caught in your live r53 log — it sat silent at `k=0` for minutes):** any loop
  >10 iterations MUST call `slog.progress(step, i, n)` EVERY iteration (it self-rate-limits to ~every 10th + final + a
  20s interval floor) AND arm `slog.heartbeat()` — heartbeats carry the live counter, so "wedged at 34/80" is visibly
  distinct from "grinding". Self-tested: an 80-card loop emits ~9 lines, not 0, not 80.

## WAVE A (PRIORITY) — the 3 LIVE-TICKET verbatim clones (David-directed: "duplicate EVERYTHING incl. sessions, see if
## the current situation fixes the issues")
These are **verbatim clones of 3 real students' CURRENT states** (yesterday's TA tickets — 07-16/17 pre-PR-3 runaway
tail), cloned with `cloneEverything` (ALL lists' progress + ALL sessions + ALL attempts untrimmed + study_states):
| tag | student (clone) | state | drive | deployed-design EXPECTED |
|---|---|---|---|---|
| **live_oyk** | lsr_a2_liveoyk@… (오윤권) | csd=12 runaway-inflated (real anchor d4); session d13 review-study; last-3 reviews ~0.11 | renderCheck → **submit an EMPTY review ×2** | **HELD**: day-13 review-only, empty submits do NOT advance (csd stays 12, no runaway recurrence). csd must NOT demote either. *(Deployed design does NOT self-heal the inflation — demonstrating the CS repair is still needed.)* |
| **live_kjk** | lsr_a2_livekjk@… (김재경) | csd=4; d5 review done @30%; last-3 [10,27,30]=0.223 | renderCheck (day 6 review-only?) → skip ×1 (held?) → **2 good reviews (≥0.70)** | held on skip; **escape after the 2nd good review** (0.3+R1+R2>1.5) |
| **live_lhs** | lsr_a2_livelhs@… (이해섭) | csd=9 (honest, post-correction) | renderCheck (day 10 w/ new words?) → **complete the day** (new-word test needs your fixed matcher + review) | **advances EXACTLY once** csd 9→10; no re-runaway, no demotion |

## WAVE B — wave-1R re-run (reconstructed sessions now seeded; re-validating with full session fidelity)
Re-seeded with per-family session reconstruction (`sessionProvenance` per roster): 4 throttle (reconstructed review-loop
sessions d6/d8/d12/d18) — drive ONE good review each (expect held csd-flat + `review_recorded`; a 2nd for jisu_a1 to
show the 2-step escape) · obo_GL7SXB (session absent-per-backup — exact) — verified last round, SKIP unless time ·
**choi_a12 (최도훈 lost-save, the documented IMPOSSIBLE session d16/review-study/newPass=false, day-16 anchor missing)** —
renderCheck: does it degrade to something progressable (offer the day-16 new test) with NO false-success/NO crash?
Then complete day-16 new (fixed matcher) → expect csd 15→16 with EXACTLY ONE anchor.

Per student: read-back + server-log evidence into one JSON; WSL runs `assert-recovery.mjs` (judges ready for every
family incl. runaway-inflated / normal-progress / lost-save). Cap the AI grader (MCQ). Sandbox only — never 26SM.

## Hand back
Write `docs/plans/loop/win/reviews/winclaude_054.md`; set win baton `turnOwner=claude round=54 execStatus=run-written
execDecision=<DROVE|PARTIAL|BLOCKED> updatedBy=winclaude revision=108`. If time-boxed, WAVE A alone is a complete round.
