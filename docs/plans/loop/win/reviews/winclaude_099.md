# WinClaude r099 — ORDER 99: FLAG-OFF **NEW-WORD PHASE** VERIFICATION

**Date:** 2026-08-04 · **Baton rev in:** 191 → **out:** 192
**Evidence:** `audit/playwright/findings/r099_newword_flagoff/` (7 screenshots @1440px + `console.json`)

## VERDICT: `CLEAN`

**Plain answer — is the flag-off NEW-WORD phase unchanged? YES.** Both screens r098 could not reach were
driven, both render correctly, and the composition is the legacy result. The only console warnings are
**pre-existing legacy diagnostics in code the fold provably does not touch** (§4).

## 1. Gates cleared before anything ran

- **`REVIEW_V2_CLIENT`** — `featureFlags.js:243` = `false` ✅ (refusal condition 1)
- **Identity: `lsr_s64@vocaboost.test`** — class **“25WT RUNSL P1 SLP1_a967f54_v3”**, list “LSR TOP Vocab
  (audit clone)”, `reviewTestType=mcq`. **25WT sandbox. No 26SM at any point.** ✅
- **No seeding was necessary** — refusal condition 3 avoided honestly, not worked around. A read-only Admin
  survey of the 317 25WT class/list pairs found accounts already at day start (`day=(none)`, i.e. no progress
  doc at all) on MCQ classes. I **selected** one rather than writing anything.
- Dev server already up on `http://localhost:5173` (vite v7.2.4).

## 2. The two screens r098 could not reach — both reached

| Screenshot | Screen | Result |
|---|---|---|
| `01-dashboard-day-start.png` | Dashboard | Correct: class, list, 80/3,381 (2%) |
| `02-new-word-study-modal.png` | First-run modal | **“Customize Your Flashcards”** — Korean Definition / Sample Sentence toggles + “Start Studying” |
| `03-new-word-study.png` | **NEW-WORD STUDY** | **Step 1 of 5 · New Words Study — Day 5 · “0 of 20 mastered” · Card 1 of 20** — `anthology (n.)`, English definition, **Korean**, sample sentence |
| `04-new-word-study-complete.png` | Study complete | Walked all 20 cards → **“20 of 20 mastered”**, “All cards reviewed!” |
| `05-NEW-WORD-TEST.png` | **NEW-WORD TEST** | **Step 2 of 5 · New Words Test — Day 5 · “0 of 20 answered”** — 20 words listed (`scarcity`, `anthology`, `antagonism`, `credit`, `secular`, `residue`, `multifaceted`, `indigent`, `vagary`, …) |

**Composition is the legacy result:** 20 new words studied → a 20-word new-word test, 1:1, on a day-start
account. That is the surface `prepareRv2NewTest` / `DailySessionFlow.jsx` re-wires, and flag-off it behaves
exactly as legacy.

## 3. A blocker worth recording for future UI rounds

The run initially hung: my `known()` selector matched the green ✓ button **behind** the first-run
“Customize Your Flashcards” modal, so every click was intercepted and the walk stalled with no error. **Any
day-start account hits this modal**, so every future new-word verification must dismiss “Start Studying”
first. Now handled in the harness.

## 4. ⚠️ FOUR CONSOLE WARNINGS — reported, and traced to a NON-fold cause

**81 messages · 0 errors · 4 warnings.** Verbatim, twice each:

```
[PHASE] ⚠️ DECISION: COMPLETE (impossible state detected)
[PHASE] Reason: Day 1 should never have passed new test
```

Your order is explicit that any new warning is a finding, so I did not stop at "it looks fine" — **I traced
provenance before judging it:**

1. Source is **`src/services/studyService.js:294`**.
2. `studyService.js` **is** in the cutover-a fold's file list — so this could not be dismissed on the file
   name alone.
3. **The fold's entire change to that file is `9 added, 0 deleted` — a pure comment block** (`git show
   f9b423f --numstat -- src/services/studyService.js` → `9 0`; the diff body is nine `//` lines describing
   the legacy segment model). **No executable line was added, removed, or altered.**

**Conclusion: the fold cannot have caused this warning.** It is pre-existing legacy phase-engine behaviour,
fired by this sandbox account's seeded data state — the engine noticed a Day-1 record that had passed a new
test, which is a artefact of prior audit seeding, not a code defect and not student-facing.

**Not a regression. Not attributable to the fold. Flagged rather than swallowed**, since it is a real
inconsistency living in 25WT fixture data and may confuse a future round that meets it cold.

## 5. Confirmations and scope

- **`git diff HEAD -- src/` is empty** and no `src/` file was modified during the run window (latest mtime
  18:00, run at 20:38) — so **the bytes I exercised are exactly the committed cutover-a fold** (`f9b423f`),
  not a mixed or stale tree. I checked this explicitly rather than assuming.
- **Submit → grade → completion NOT chased**, per your instruction that it belongs to cutover-b/c. Shots 06
  and 07 show the new-word test unchanged because I stopped there deliberately — the new-word test is also a
  typed surface, and driving it is not this order's scope.
- **The “Words #a–b” range-line expectation was not verified this round.** It concerns the *review* sheet;
  this order's scope was the new-word phase and the walk stopped at the new-word test. Flagging it as
  **still unchecked** rather than implying otherwise — it is one screen away in a review-phase round.

## 6. Boundaries honoured

25WT only, never 26SM · `REVIEW_V2_CLIENT` read-only, still `false` · no deploys, no commits, no branching,
no stash, no reset · `node_modules` untouched (playwright resolved from the repo via `createRequire`; driver
scripts live in my scratchpad) · **no source edited to make anything render** · the Admin survey was
**read-only** and filtered to `25WT`-named classes by construction.

## STANDBY

Baton returned at rev **192**, `execDecision: CLEAN`. Watcher armed.
