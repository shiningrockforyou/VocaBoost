# WinClaude r098 — ORDER 98: FLAG-OFF VISUAL VERIFICATION

**Date:** 2026-08-04 · **Baton rev in:** 189 → **out:** 190
**Evidence:** `audit/playwright/findings/r098_flagoff_parity/` (6 screenshots @1440px + `console.json`)

## VERDICT: `PASS_WITH_GAP`

**Plain answer to the question this order exists to ask — is the legacy flow unchanged with the flag off?**
**Yes, for every screen I exercised.** Zero console errors, zero warnings, correct data on every surface,
and the composition that the fold re-wires produces exactly the legacy result.

**But I did not drive the whole day to completion**, and I am not reporting that as if I had. The gap is
stated in §4.

## 1. Refusal gates — both cleared before anything ran

- **`REVIEW_V2_CLIENT`** — `src/config/featureFlags.js:243`: `export const REVIEW_V2_CLIENT = false;` ✅
  (refusal condition 1 cleared — I was exercising the LEGACY path, which is the premise of the order)
- **Identity** — `lsr_s201@vocaboost.test`, enrolled in class **“25WT DFX THR-C thr-c-escape”**, list
  “LSR Ascent (audit clone)”. **A 25WT sandbox account. No 26SM identity was used at any point.** ✅
- **Dev server** — `npm run dev` → vite v7.2.4 ready in 1131 ms on `http://localhost:5173` ✅
  (refusal condition 3 not triggered). **Local server, not the deployed bundle** — the point is to exercise
  the *uncommitted working tree*, which is where the fold lives.
- Baseline `git status --short` captured before starting: 11 modified + 8 untracked, including the fold
  (`DailySessionFlow.jsx`, `MCQTest.jsx`, `TypedTest.jsx`, `reviewV2Client.js`, `studyService.js`, and the
  new `reviewV2Compose.js`). Two pre-existing stashes noted and **not touched**.

## 2. What I verified, screen by screen

| Screenshot | Screen | Result |
|---|---|---|
| `00-dashboard-entry.png` | Dashboard | Correct: class, list, **Day 9 · Step 1 of 2**, 640/1600 words (40%), streak, "Learn 3 new words" |
| `01-A-review-study-card1.png` | Review Study, card 1/60 | Full content renders — word, part of speech, English definition, **Korean translation**, sample sentence |
| `02-B-all-cards-reviewed.png` | Study complete | Walked **all 60 cards**; progress tracked 0/60 → **60/60 mastered**; "All cards reviewed! You're ready to take the test." |
| `03-C-review-test.png` | **Review Test** | **Step 4 of 5 · "0 of 30 answered"** — 30 words composed from the 60-card queue |
| `04-D-after-submit.png`, `05-E-completion.png` | (same screen) | My driver did not advance past the test — see §4 |

**The single most load-bearing observation:** the fold re-wires **composition**. With the flag off, the review
test composed **30 words out of the 60-word study queue** — the legacy `testSize 30` / `queueSize 60`
behaviour, with real vocabulary (`recollection`, `emulate`, `faction`, `adversity`, `legitimacy`, `deity`,
`monolithic`, …). Had the fold leaked into the flag-off path, this is the surface where it would show, and it
did not.

Also confirmed from console: `determineStartingPhase` runs and decides
`✓ DECISION: NEW_WORDS_STUDY (fresh start)` — **the legacy phase engine, not the v2 path.**

## 3. Console — the parity signal

**79 messages · 0 errors · 0 warnings** (`console.json`). Reproduced across **six independent runs** this
round, consistently 78–79 messages with **zero** errors and **zero** warnings every time.

Per the order, *"any new error or warning that was not there before is a finding, even if the UI looks
right — a silent throw is exactly how the two-channel refusal bug would surface."* **There were none.** All
messages are the app's own `[PHASE]` / session diagnostics.

## 4. ⚠️ THE GAP — stated plainly rather than glossed

**I did not drive test submission → grading → the completion screen.** The review test is a *typed* surface
and my driver's selectors (MCQ choice buttons / a single textarea) did not match its per-word inputs, so
shots `04` and `05` show the test screen unchanged rather than a completion screen.

**Two consequences, both honest:**
1. **Submit → grade → complete is UNVERIFIED in a browser.** That path includes the compose→submit→complete
   wiring the fold touches. It passed your 117 pure + 89 emulator fixtures, but per the premise of this order,
   fixtures are not a running browser. **This specific leg still has the gap the order was written to close.**
2. **The new-word phase was not exercised** — the account entered at *Step 3 of 5 (Review Study)*, so
   new-word study and the new-word test were already behind it.

Neither gap is a *failure*; both are simply **not covered**. If you want them closed, the cheapest path is a
25WT account seeded at day-start with an **MCQ** review type (the driver handles MCQ), or give me the typed
test's input selector and I will finish the leg in one round.

## 5. Boundaries honoured

- **25WT sandbox only. No 26SM identity, no production data, no writes to any live student.**
- **`REVIEW_V2_CLIENT` not flipped** — read only, still `false`.
- **No deploys. No commits, no branching, no stash, no reset.** Tree left dirty for you.
- **`node_modules` not reinstalled or modified.** Playwright resolved from the repo via `createRequire`;
  my driver scripts live in my **scratchpad**, not the repo — the only repo writes are this review and the
  evidence folder under `audit/playwright/findings/`, both inside my write scope.
- **No source edited to make anything render.**

## STANDBY

Baton returned at rev **190**, `execDecision: PASS_WITH_GAP`. Watcher armed.

**Note for the remaining UI folds:** you flagged that every one of them will need me for this step, since
vite cannot start under WSL against Windows `node_modules`. Confirmed — the harness now exists and the
login/session path is mapped, so subsequent rounds should be quicker. **Sending me the intended
phase/modality (MCQ vs typed) and the account's starting day in the order would remove most of the
iteration cost I spent this round.**
