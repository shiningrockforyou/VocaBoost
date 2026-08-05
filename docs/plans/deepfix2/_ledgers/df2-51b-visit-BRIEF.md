# BRIEF — 51-b: the client visit lifecycle (`visitId` mint · persist · discard)
2026-08-05 · orchestrator → implementer · ledger `_ledgers/df2-51b-visit-fold-ledger.md`
Fold 2 of 8 in the DF2-51 train (`22_DF2-51_PASTDAY_NAV_DESIGN.md` §7 RATIFIED — read it first).
Runs in PARALLEL with 51-a; your file sets are disjoint. Do not touch 51-a's module.

## The decision you are implementing (ratified, do not re-litigate)
**(b) = B2:** mint the `visitId` **lazily at the first rerun compose**, persist it in `sessionStorage`
under a key that mirrors the existing `composeKeyScope` convention, and discard it when the visit reads
`completed:true`, on an explicit leave, or on a refusal — re-minting once. **B1 (mint on tile open) was
rejected**: it silently breaks half-pairing, so the student never earns the completion pip.

## Why this exists (the engine contract — verify each cite yourself)
A past-day re-test is a *visit*. `functions/reviewV2/visits.js` records the two halves (new + review)
against ONE visit doc and flips `completed:true` only when both land in the SAME visit — cross-visit
pairing is impossible by construction. The submit path REQUIRES a `visitId`
(`callables.js` rerun txn, ~:739-741 — refuses `visit_invalid` without one) and stamps `type:"retest"`
(~:761). So a lost/mismatched client `visitId` means a student can re-study and re-test correctly and
still never see the day complete — a silent, confusing failure. That is the bug this fold prevents.

## What to build — a small service + its storage helper
`src/services/restudyVisit.js` (new; name it as fits the `src/services/` conventions — read
`reviewV2Submit.js` and `reviewV2Client.js` first and match them):
- **mint/read/clear** for the current visit, scoped per `(classId, listId, day, resetEpoch)`. Mirror the
  existing compose-key scoping so a different list/day/epoch can never reuse a visit. **`resetEpoch`
  must be in the scope** — a reset must not resurrect a stale visit.
- **Crash/abandon behavior, stated explicitly in the header**: a half-finished visit is inert garbage,
  never load-bearing (the engine TTL-cleans it). Your client must never block on one.
- **Re-mint exactly once** on a refusal/invalid visit, then surrender to a rendered reason — never loop.
  The precedent is cutover-d's recompose-once law (`reviewV2Submit.js` — read how it persists its
  once-flag; match that idiom rather than inventing a second one).
- Storage must degrade safely where `sessionStorage` is unavailable/full (private mode, quota): the
  feature may become unavailable, but nothing may throw into a render or a submit.

## Constraints (law)
- **Touch ONLY**: `src/services/restudyVisit.js` (new), `scripts/deepfix2/df2-51b-visit-fixtures.mjs`
  (new), `scripts/deepfix2/df2-51b-visit-mutants.mjs` (new), their evidence JSONs, and your ledger.
  NOTHING else — no page, no route, no `MCQTest.jsx`/`TypedTest.jsx`/`DailySessionFlow.jsx`, no
  `functions/`, no flags, no `src/utils/pastDayAuthority.js` (that is 51-a's, in flight now).
- No Firestore calls in this fold — it manages a client-side identifier only. The compose call that
  RECEIVES the minted id is wired in 51-d, not here.
- No commit, no staging. A parallel CS session shares this tree; never `git add`.

## Fixtures + mutants
Pure node with an injected/faked storage (do not require a browser). Cases: mint-on-first-compose only
(never on browse) · same scope returns the SAME id · different day/list/class/**resetEpoch** returns a
DIFFERENT id · `completed:true` clears it · explicit leave clears it · refusal re-mints exactly ONCE
then stops · storage-unavailable degrades without throwing · a stale/corrupt stored value is discarded
rather than used. One mutant per new clause (at minimum: drop `resetEpoch` from the scope key, allow
unlimited re-mints, return a cached id across a completed visit) — each killed, restore clean.
Evidence JSON; numbers never hand-typed.

## Report back
The scope-key shape and why; the exact discard triggers; how you proved re-mint-once; storage-failure
behavior; fixture/mutant results with evidence paths; every judgment call; anything in `visits.js` that
contradicts this brief (a FINDING — report it, do not design around it). Your report is a CLAIM; the
orchestrator re-executes.
