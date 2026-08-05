# BRIEF — 51-c: the past-day browser (the route + the page)
2026-08-05 · orchestrator → implementer · ledger `_ledgers/df2-51c-browser-fold-ledger.md`
Fold 3 of 8 in the DF2-51 train. **51-a and 51-b have LANDED (19dd849, 2779d4d) — consume them, do not
duplicate them.** Read `22_DF2-51_PASTDAY_NAV_DESIGN.md` §7 (RATIFIED) first.

## What this fold is
The screen a student lands on: **`/restudy/:classId/:listId`** — the past-days list from the SHIPPING
wireframe `mockups/df2-51-extended.html` (David ruled CORE + EXTRAS, so the extras are IN scope here:
the 5-state chips, the per-day pips, and the bookmark toggle). It **reads and renders**; it does not
submit tests (51-d) and does not own the Dashboard entry point or the resume panel (51-f).

## Consume, don't rebuild
- **`src/utils/pastDayAuthority.js`** (51-a, landed) — `derivePastDays`, `DAY_STATES`, the pip rules,
  `deriveTodayRow`, `bookmarkedDayForList`. **All day/state/pip logic lives THERE.** If you find
  yourself computing a state or a pip in the component, stop — extend the pure module's fixtures
  instead, or report the gap. Read its header; it documents PIP-CANON (two half-finished visits must
  never render as a completed day) and the `'na'` pip for a day with no new-word half.
- **`src/services/restudyVisit.js`** (51-b, landed) — do NOT mint a visit here. Browsing mints nothing;
  the mint happens at the first rerun compose, which is 51-d's. Read its header for the boundary.

## Build
1. **The route** — one line in `App.jsx`, matching how sibling routes are declared (read them first).
   Behind `REVIEW_V2_CLIENT`: flag-off the route must not exist / must not render (decision (e):
   NOTHING visible flag-off). Prove the flag-off behavior in the ledger.
2. **The page** — new file under `src/pages/` (name it as the conventions suggest). It must:
   - load what the model needs (progress/attempts/visits/bookmark) using the EXISTING data patterns in
     this codebase (`db.js` helpers / the same hooks the Dashboard uses — read `Dashboard.jsx`'s
     loading idiom, including its loading/error/empty states, and match it rather than inventing one);
   - render one row per past day with: day number, studied/tested dates, the state chip, the pips, a
     bookmark toggle, and **Re-study / Re-test** buttons that are wired to nothing yet (51-d wires
     them — leave a clearly-named handler stub, do not fake navigation);
   - render **today** as the wireframe does: present but NOT actionable ("in progress", no buttons);
   - carry the wireframe's plain-language banner that re-tests never change progress or grade;
   - handle empty (no past days yet), loading, and error states explicitly.
3. **Design tokens only** — `bg-surface`, `text-text-primary`, `rounded-[--radius-card]`, etc. per
   CLAUDE.md. No raw Tailwind colors, no new CSS files. Read `src/index.css` for the token set.
4. **Bookmark write** — the bookmark is an OWNER-writable UI preference on `users/{uid}`
   (`restudyBookmarks.{classId}_{listId} = day`, `15_H6:196`); never server authority. Use the
   existing user-settings write path if one exists (find it; do not add a second one). If writing it
   cleanly requires touching a file outside your touch-list, STOP and report rather than widening.

## Constraints (law)
- **Touch ONLY**: the new page file, `src/App.jsx` (route line ONLY — nothing else in that file), your
  fixtures/mutants under `scripts/deepfix2/`, their evidence JSONs, and your ledger. NOTHING else.
  Explicitly NOT: `pastDayAuthority.js`, `restudyVisit.js`, `Dashboard.jsx`, `DailySessionFlow.jsx`,
  `MCQTest.jsx`, `TypedTest.jsx`, `functions/**`, `firestore.rules`, any flag value.
- **Flag-off must be byte-identical in behavior.** `REVIEW_V2_CLIENT` stays `false`.
- **WSL cannot run vite** — do NOT attempt a build or dev server; a browser check is a later WinClaude
  order (51-h). Syntax-gate with `npx eslint <your files>` and report the delta vs HEAD for any file
  that already has findings.
- No commit, no staging. A parallel CS session shares this tree; never `git add`.

## Fixtures + mutants
The page is a component, so fixture what is fixturable **without a browser**: the pure view-model
assembly (rows → props), the flag-off gate, the empty/loading/error branch selection, and the bookmark
precedence. Do NOT re-test what 51-a already proves — cite its evidence instead. One mutant per new
clause (at minimum: flag-off gate removed; today rendered as actionable). Evidence JSON; numbers never
hand-typed.

## Report back
The route + flag-off proof; what you consumed from 51-a/51-b vs what you added; the data-loading idiom
you matched and where you found it; token compliance; fixture/mutant results with evidence paths; the
eslint delta; every judgment call; anything in 51-a's model that the wireframe needs but the model
cannot supply (that is a FINDING — report it, do not compute it in the component). Your report is a
CLAIM; the orchestrator re-executes.
