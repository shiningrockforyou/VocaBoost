# BRIEF — 51-a: the past-day model (PURE derivation, no UI, no I/O)
2026-08-05 · orchestrator → implementer · ledger `_ledgers/df2-51a-model-fold-ledger.md`
Fold 1 of 8 in the DF2-51 train (`22_DF2-51_PASTDAY_NAV_DESIGN.md` §7 RATIFIED — read it first).

## What this fold is
The pure functions the whole past-day feature derives from. **No React, no Firestore, no imports from
`src/firebase*`** — a plain node-loadable module, exactly like `src/utils/streakAuthority.js` and
`src/utils/dayStatusAuthority.js` (read BOTH before writing; match their conventions, header style, and
dependency-injection idiom). Everything else in the train consumes this; nothing here consumes UI.

## Read first (verify every cite yourself — line numbers drift)
- `22_DF2-51_PASTDAY_NAV_DESIGN.md` — the whole draft, especially §7 (ratified decisions) and its
  findings F2/F3/F4: the rerun REVIEW half is NOT day-scoped (it pools the full introduced range);
  not every past day has a NEW half (`no_evidence` / `empty_pool`); a day with no new half can never
  reach the "re-completed" state because a pip needs both halves in one visit.
- `mockups/df2-51-extended.html` — the SHIPPING target (David ruled CORE + EXTRAS). The five day-states
  and the pips are visible there; your model must be able to produce exactly what that renders.
- The engine's own vocabulary, so your states match server truth rather than inventing a parallel one:
  `functions/reviewV2/visits.js` (visit docs, half-pairing, the `completed` CAS), `callables.js`
  rerun compose (~:401-483) and the `type:"retest"` stamp (~:761), `completion.js` non-advancing guards.

## What to build — `src/utils/pastDayAuthority.js` (new)
Pure functions; every input injected, nothing fetched:
1. **`derivePastDays({ currentStudyDay, attempts, visits, bookmarks })` → array of day rows**, one per
   completed day (day 1 .. currentStudyDay), each row carrying at minimum: `day`, `studiedAt`,
   `testedAt`, `state` (see below), `pips` (see below), `bookmarked`, `canRestudy`, `canRetest`.
   **Today is NOT a past day** — the day-guard means restudy targets `1..csd` only. Emit today (if you
   emit it at all) as an explicitly non-actionable row, matching the wireframe's "in progress".
2. **The FIVE states**, as a documented enum with a single derivation function — `untouched` ·
   `studied` · `tested` · `re-completed` · `bookmarked`. Decide and DOCUMENT the precedence (the
   wireframe shows bookmark displacing the progress chip; make that explicit and fixture it), and
   document which inputs each state derives from.
3. **Pips** — the per-day progress dots. A day with **no new-word half** must produce the dashed
   "not applicable" pip the wireframe shows, NOT an empty or failed one (finding F3). A day that can
   never be re-completed must not render as perpetually incomplete — name that in the header.
4. **`canRetestTyped({ metering })`-style predicate** *(shape yours; keep it pure)* so the UI can show
   the cap state without calling the server: given a metering snapshot, is a typed re-test currently
   offerable, or should the UI offer MCQ only? The cap itself is server-authoritative (`ai-metering`
   fold, landed d3dce7a) — this is presentation only and must NEVER be the enforcement point. Say so
   in the header.

## Constraints (law)
- **Touch ONLY**: `src/utils/pastDayAuthority.js` (new), `scripts/deepfix2/df2-51a-model-fixtures.mjs`
  (new), `scripts/deepfix2/df2-51a-model-mutants.mjs` (new), their two evidence JSONs, and your ledger.
  NOTHING else — no page, no route, no service, no `Dashboard.jsx`/`DailySessionFlow.jsx`, no
  `functions/`, no flags. No commit, no staging.
- **Zero imports** of firebase/firestore/React. Prove it with a grep row in the ledger (strip comments
  first — `dashboard-df2-33-fixtures.mjs` hit a false positive on its own prose; learn from it).
- This fold ships **no user-visible change** and is not flag-gated because nothing calls it yet. State
  that plainly in the ledger rather than claiming flag-off parity you didn't test.

## Fixtures + mutants
Pure node, evidence JSON, numbers never hand-typed. Cases must include: a day with both halves → the
right state + full pips · a day with **no new half** → dashed pip, never "incomplete" · a bookmarked day
→ precedence proven · an untouched day · a re-completed day (both halves in ONE visit) · **halves in
DIFFERENT visits must NOT pair** (that is the whole reason visits exist — finding F4) · today excluded
from actionable rows · empty/missing inputs degrade safely. One mutant per new clause (at minimum: break
the same-visit pairing rule, invert the today-exclusion, drop the no-new-half special case) — each
killed, restore clean.

## Report back
The state enum + precedence you chose and why; the pip rules; the pairing proof; fixture/mutant results
with evidence paths; every judgment call; anything in the engine that contradicts the wireframe (that is
a FINDING — report it, do not design around it silently). Your report is a CLAIM; the orchestrator
re-executes.
