# BRIEF — dashboard-df2-33: Dashboard one-affordance (hero + per-list on ONE derivation)
2026-08-04 · orchestrator → implementer · fold ledger: `_ledgers/dashboard-df2-33-fold-ledger.md`
Predecessor: `dashboard-streak-authority` (its ledger's E1 card is THIS fold). Flag: `REVIEW_V2_CLIENT`.

## ORCHESTRATOR DECISIONS (recorded here; the fold implements them — do not re-litigate)
1. **READ-ONLY assembly variant: YES, dashboard-local, pure.** The card (DF2-33) demands this be
   stated: the Dashboard NEVER calls the session-entry pipeline (`initializeDailySession` or any
   write-performing path) to learn day status. It gets a pure derivation module with ZERO Firestore
   verbs (data injected by the caller), in the exact mold of `streakAuthority.js`. `deriveSessionState`
   (DF2-20) does not exist yet; when it lands, it absorbs this module — note that as a follow-on in
   the module header, do not build toward it now.
2. **E1 settlement (streak presentation): the streak renders ONCE, account-wide, in the hero** (that
   authority landed in `dashboard-streak-authority`). Per-list streak UI does not exist today and is
   NOT added. Nothing in this fold touches streak code.
3. **No new per-list markers.** Flag-on, the per-list rows change ONLY in what number feeds the
   existing "Day N" badge (and its ahead/behind inputs). No done-today ticks, no phase chips — that is
   later dashboard polish, not this fold.
4. **`determineStartingPhase` stays the phase oracle** on both flag legs (it already serves hero AND
   session entry). This fold changes WHO CONSUMES it, not what it computes.

## THE DISEASE (what "two-done-authorities" concretely is in Dashboard.jsx)
- HERO (Panel C memo ~:1620-1685): `currentStudyDay` = server-reconciled csd (flag-gated
  `SERVER_PROGRESS_WRITE`, non-demoting max) → `phase` via `determineStartingPhase(listAttempts,
  csd+1)` → `day = csd+1` (:1788), `doneToday = phase==='complete'` (:1792).
- PER-LIST ROWS (`ListProgressStats`, :177-227): `displayDay = (progress?.currentStudyDay ?? 0) + 1`
  from the RAW progress doc only — no attempts, no reconciliation. The focused list's own row can show
  a DIFFERENT Day number than the hero, on one screen, flag-on. The `+1` display convention lives in
  two places.

## THE FOLD
### New module: `src/utils/dayStatusAuthority.js` (pure; follow `streakAuthority.js` conventions)
`deriveListDayStatus({ progress, attempts, resolvedCsd, phaseOracle })` →
`{ currentStudyDay, displayDay, phase, doneToday }`
- `currentStudyDay = max(resolvedCsd ?? 0, progress?.currentStudyDay ?? 0)` — the NON-DEMOTING CSD
  contract (mirror the hero's exact semantics at :1656-1662, including the null/undefined handling).
- `displayDay = currentStudyDay + 1` — the +1 convention gets ONE home.
- `phaseOracle` is INJECTED (the Dashboard passes `determineStartingPhase`) — keeps the module
  import-pure for node fixtures, matching the `db`-injection convention.
- **`attempts: null` (not provided) → `phase: null, doneToday: null`** — explicit "not computed", so a
  caller that didn't supply attempts can never silently render a wrong done-state. `attempts: []` is a
  real value (computes normally).
- Also export the TWO shared predicates so they too have one home:
  `attemptsForList(attempts, classId, listId)` (the exact :1667-1669 filter) and
  `csdForRow(resolvedFocusCsd, classId, listId)` (returns the csd only when it matches this
  class+list — the :1656-1659 focus guard — else null).

### Dashboard.jsx rewiring — flag-gated, flag-OFF byte-identical BY CONSTRUCTION
Call-site pattern (the streak-fold precedent): `REVIEW_V2_CLIENT ? <one-derivation path> : <legacy
inline expression, untouched>`. Do not restructure the legacy expressions; do not touch streak code.
- Panel C (hero): flag-on, route through `deriveListDayStatus` (attempts = `attemptsForList(...)`,
  resolvedCsd = `csdForRow(resolvedFocusCsd, ...)`); flag-off, today's exact code.
- `ListProgressStats`: add props `userAttempts`, `resolvedFocusCsd` (parent passes what it already
  has — NO new reads, no new fetches). Flag-on, displayDay comes from `deriveListDayStatus` with
  `attempts: null` (rows render no phase output; see decision 3) and `resolvedCsd = csdForRow(...)`;
  flag-off, today's exact `(progress?.currentStudyDay ?? 0) + 1`. Ahead/behind badges keep their
  logic, fed flag-on by the unified `currentStudyDay`.
- If you find ANY other Dashboard site deriving a day number or done-state (grep
  `currentStudyDay + 1`, `phase ===`, `doneToday`), list it in the ledger and route it the same way —
  the card's claim is "one derivation"; an unrouted site falsifies it.

## FIXTURES (pure node, mirror the streak fold's harness + evidence-JSON pattern) + MUTANTS
1. Non-demoting: raw 3 / resolved 5 → csd 5, displayDay 6. 2. Never-demote: raw 5 / resolved 4 → 5.
3. resolved null → raw. 4. `attempts: null` → phase null, doneToday null. 5. stub oracle passthrough:
phase + doneToday derive from the oracle's return. 6. predicate fixtures: `attemptsForList` filters
exactly by classId+listId; `csdForRow` returns null on focus mismatch. 7. TRY importing the REAL
`determineStartingPhase` under node for an integration fixture (complete-day attempts → doneToday
true); if the import drags firebase side effects that won't load, SAY SO in the ledger and defer that
single fixture to the rehearsal — do NOT re-implement the oracle in the fixture (oracle drift).
MUTANTS (1 per new clause, killed + restored): (m1) drop the non-demoting max → fixture 2 reds;
(m2) displayDay off-by-one → fixture 1 reds; (m3) `attempts: null` treated as `[]` → fixture 4 reds.
Grep-proofs for the ledger: `REVIEW_V2_CLIENT` count/sites in Dashboard.jsx; `currentStudyDay + 1`
remaining sites = legacy flag-off inline + the module only; module has zero firebase/firestore imports.

## CONSTRAINTS (law)
- Touch ONLY: `src/utils/dayStatusAuthority.js` (new), `src/pages/Dashboard.jsx`, fixtures + evidence
  in the streak-fold's locations, and your fold ledger. NOTHING else — no `.claude/*`, no batons, no
  queue/RESUME, no `git add`, NO COMMIT.
- Flag-off must be byte-identical in BEHAVIOR: legacy expressions untouched inside the ternaries; the
  flag default stays `false`; `calculateStreak` and all streak paths BYTE-IDENTICAL (the orchestrator
  diffs them).
- No new Firestore reads/writes anywhere in the fold. The module imports nothing from firebase.
- WSL: no vite/build. Syntax-gate JSX via `npx eslint` (fallback `npx prettier <file> >/dev/null`);
  record which ran.
- Design tokens: any NEW classNames use tokens (`bg-muted`, `text-text-muted`, …) — though per
  decision 3 you should not be adding visible elements.

## Fold ledger + report
Ledger from `scripts/deepfix2/FOLD_LEDGER_TEMPLATE.md`: V-rows (verify the hero/row semantics cited
above BEFORE editing — line numbers drift), one row per call site routed, fixture/mutant rows with
evidence-JSON-derived numbers (never hand-typed), grep-proof rows, VISUAL row
`[ ] OWED — WinClaude order (flag-OFF: Dashboard loads, hero + row Day numbers unchanged; batched)`.
Report: per-decision compliance, every routed site, fixture/mutant results with the evidence path,
which syntax gate ran, whether the real-oracle import worked, and anything that surprised you. Your
report is a CLAIM — the orchestrator re-executes the evidence.
