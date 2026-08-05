# BRIEF — 51-e: the within-day Review / New-words toggle (FREE-NAV proper)
2026-08-05 · orchestrator → implementer · ledger `_ledgers/df2-51e-toggle-fold-ledger.md`
Fold 5 of 8 in the DF2-51 train. Read `22_DF2-51_PASTDAY_NAV_DESIGN.md` §7 (RATIFIED) first.
Runs in PARALLEL with 51-f (`Dashboard.jsx`) — your file sets are disjoint. **Do not touch `Dashboard.jsx`.**

## What this fold is — and why it is the smallest change with the biggest meaning
This is **free-nav**, in David's own definition (R2-26 Q11, ratified): *students move freely between
review and new-word work within the day*. Panel 3 of `mockups/df2-51-extended.html` is the target: two
buttons (**Review** / **New words**) on today's session screen, with the rule stated on screen — the
toggle changes the ORDER, not the requirement. **Both halves must still be finished before the day
advances.** Never weaken that; the day-advance gate is server-side and is not yours to touch.

## The key fact (verify it yourself before designing)
**The server already permits this.** Neither compose callable requires the other phase first — the only
thing forcing new-words→review is the CLIENT, at `src/services/studyService.js#determineStartingPhase`
(read it; it is the phase oracle both the Dashboard and the session flow consume). So this fold adds a
way to *choose* a phase within the day; it does not change what a phase IS, and it must not fork the
oracle. Decision (d) = **D3**: two additive buttons on the DSF study screens (D2 — tappable
`SessionProgressSheet` steps — is CARDED for the container line, not this fold).

## Build — `src/pages/DailySessionFlow.jsx` only
- Behind `REVIEW_V2_CLIENT`, render the two-button toggle on today's study screens. Flag-off:
  **byte-identical behavior, nothing rendered** (decision (e)) — the same doctrine every cutover fold
  shipped under, and what makes the later visual check meaningful.
- Selecting a phase switches which half the student is working on **within today**. It must:
  - never advance the day, never submit anything, never mutate progress;
  - be safe mid-session — read how DSF currently holds phase/session state and reuse it rather than
    introducing a parallel source of truth. If today's structure makes that impossible without a
    refactor beyond this fold, **STOP and report** rather than widening;
  - reflect what is actually available: if a half genuinely has no work (e.g. no new words today), the
    toggle must not offer a dead destination — disable with a reason, mirroring 51-c's precedent for
    the same class of problem (an enabled control with nothing behind it is a dead click);
  - carry the on-screen rule from the wireframe ("both halves still have to be finished before tomorrow
    unlocks — the toggle only changes the order, not the requirement") in the app's own voice.
- **Design tokens only** (`src/index.css`); reuse existing `src/components/ui/` components.

## Constraints (law)
- **Touch ONLY**: `src/pages/DailySessionFlow.jsx`, your fixtures/mutants under `scripts/deepfix2/`,
  their evidence JSONs, and your ledger. NOTHING else — explicitly NOT `studyService.js` (the oracle
  stays single-source), NOT `Dashboard.jsx` (51-f, in flight now), NOT `MCQTest.jsx`/`TypedTest.jsx`
  (51-d), NOT `pastDayAuthority.js`/`restudyVisit.js` (landed), NOT `functions/**`, NOT any flag value.
- WSL cannot run vite — no build, no dev server. Syntax-gate with `npx eslint`, and report the delta
  vs HEAD (this file already has pre-existing findings; prove you added none).
- No commit, no staging. A parallel CS session shares this tree; never `git add`.

## Fixtures + mutants
Pure node on whatever you can extract (the JSX page itself is not node-importable — this checkout has
no JSX transform for plain node; 51-c hit this and put its pure logic in a sibling `.js` module. Follow
that precedent if you need it, and say so). Cases: flag-off renders nothing · toggling changes only the
phase, never progress/day · a half with no work is not offerable · the day-advance requirement is
unaffected by any toggle sequence. One mutant per new clause (at minimum: flag-off gate removed; a
toggle that advances or submits). Evidence JSON; numbers never hand-typed.

## Report back
Where you hooked the toggle and why that seam; how you proved no progress/day mutation; the disabled
case; flag-off proof; fixture/mutant results with evidence paths; the eslint delta; every judgment
call; anything that would require touching `studyService.js` (that is a FINDING and a STOP — report it).
Your report is a CLAIM; the orchestrator re-executes.
