# BRIEF — 51-f: Dashboard entry + resume panel + end-of-list screen (the EXTRAS)
2026-08-05 · orchestrator → implementer · ledger `_ledgers/df2-51f-entry-fold-ledger.md`
Fold 6 of 8 in the DF2-51 train. Read `22_DF2-51_PASTDAY_NAV_DESIGN.md` §7 (RATIFIED) first.
Runs in PARALLEL with 51-e (`DailySessionFlow.jsx`) — disjoint. **Do not touch `DailySessionFlow.jsx`.**

## What this fold is
The three pieces David's **CORE + EXTRAS** ruling added that live on the Dashboard side, all against
the shipping wireframe `mockups/df2-51-extended.html`:
1. **The entry affordance** — a "Past days" control on each list card, opening `/restudy/:classId/:listId`
   (the route landed in 51-c, commit 92bc6e0 — link to it, do not re-implement it).
2. **The resume-where-you-left-off panel** — the wireframe's top panel, pointing at a half-finished
   restudy visit.
3. **The end-of-list completion screen** section.

## Consume, don't rebuild
- **`src/utils/pastDayAuthority.js`** (51-a, landed 19dd849) — day rows, the five states, pips,
  `bookmarkedDayForList`. All such logic lives THERE. Computing a state or pip inside `Dashboard.jsx`
  is the error this brief exists to prevent; if the model can't supply something the wireframe needs,
  that is a FINDING to report, not a thing to compute locally.
- **`src/utils/dayStatusAuthority.js`** (df2-33, landed) — the Dashboard's ONE day/phase derivation.
  The resume panel must not become a second authority for "where the student is".
- **`src/services/restudyVisit.js`** (51-b, landed 2779d4d) — read its header for the visit boundary.
  **The resume panel READS visit state; it must not mint, discard, or repair a visit** (that is 51-d's).

## Build — `src/pages/Dashboard.jsx` only
Everything behind `REVIEW_V2_CLIENT`; **flag-off byte-identical** (decision (e)) — this file is on the
live path for 947 students and has already shipped two flag-gated folds (streak authority, df2-33). Read
how BOTH did it (`REVIEW_V2_CLIENT ? <new> : <legacy verbatim>`, legacy untouched inside the ternary,
lazy where the legacy branch has side effects) and match that idiom exactly.
- **Entry affordance**: on each list card, alongside the existing controls. Use existing `ui/`
  components + design tokens; no raw Tailwind, no new CSS.
- **Resume panel**: renders only when there IS a resumable visit; otherwise absent entirely (no empty
  shell). Must degrade safely when the read fails — the Dashboard must still load. State plainly in the
  ledger what happens when visit data is unavailable.
- **End-of-list screen**: the wireframe's completion state for a finished list. Note `listFinished`
  already exists in this file (~:1787) — reuse the existing derivation, do not add a second one.
- **No new reads if an existing one covers it.** The Dashboard already loads progress, attempts and
  (flag-on) the streak. Add a read only if genuinely needed, and say why in the ledger.

## Constraints (law)
- **Touch ONLY**: `src/pages/Dashboard.jsx`, your fixtures/mutants under `scripts/deepfix2/`, their
  evidence JSONs, and your ledger. NOTHING else — explicitly NOT `DailySessionFlow.jsx` (51-e, in
  flight now), NOT `MCQTest.jsx`/`TypedTest.jsx`/`reviewV2Client.js` (51-d), NOT `App.jsx` (51-c owns
  the route), NOT the landed utils/services, NOT `functions/**`, NOT any flag value.
- **The streak and day-status code must stay byte-identical** — the orchestrator diffs them. Two prior
  folds' guarantees live in this file; do not disturb them.
- WSL cannot run vite — no build. `npx eslint`, and report the delta vs HEAD (this file has
  pre-existing findings incl. one deliberate unused-var from df2-33; prove you added none beyond what
  you declare).
- No commit, no staging. A parallel CS session shares this tree; never `git add`.

## Fixtures + mutants
Follow the precedent already set in this file's folds: pure logic in a node-importable module where the
JSX cannot be imported (see `dayStatusAuthority.js`, and 51-c's `RestudyBrowser.viewModel.js`). Cases:
flag-off renders none of the three · resume panel absent when there is no resumable visit · entry
affordance links to the right route params · end-of-list uses the EXISTING `listFinished` derivation ·
a failed visit read still lets the Dashboard render. One mutant per new clause (at minimum: flag-off
gate removed; resume panel rendering with no visit). Evidence JSON; numbers never hand-typed.

## Report back
The three insertion points and why; proof the streak/day-status code is untouched (diff-based, not
assertion); the degrade-on-failure behavior; flag-off proof; fixture/mutant results with evidence paths;
the eslint delta; every judgment call; anything the wireframe needs that 51-a's model cannot supply
(a FINDING — report it). Your report is a CLAIM; the orchestrator re-executes.
