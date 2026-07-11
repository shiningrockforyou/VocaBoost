# Claude handoff round 1: PER_STUDENT_LIST_CYCLING

## Objective
Review **plan v3** at `docs/plans/loop/x/plan.md` — per-student list cycling (a student who finishes a
vocab list re-studies it at the same pace/tests via a monotonic *virtual* index, no shared-list mutation).
"Ready" for this round = the design is implementation-ready or you name the remaining blocker/high defects.
This is the milestone external check after two full 3-agent audit rounds (v1→v2→v3).

## History (so you can build, not re-derive)
- **v1** (extend the shared list) — WITHDRAWN. 3 agents + your r01 review proved shared-list blast radius
  (dilutes every student's progress bar, dup PDF, position collision). See `x/rounds/r01_*`.
- **v2** (per-student virtual index) — approach CONFIRMED sound by all 3 round-2 agents.
- **v3** — folds the round-2 agent audit (`x/rounds/r02_agents_audit.md`, `x/rounds/r02_claude_response.md`):
  flag placement, forgery prerequisite, fetch mapping, corrected study-state model.

## Changed/relevant files
- `docs/plans/loop/x/plan.md` — the plan under review (v3). **The only "diff" that matters this round.**
- Evidence (my prior work, read if useful): `x/rounds/r01_agents_audit.md`, `x/rounds/r01_claude_response.md`,
  `x/codex-out/reviews/r01_codex_review.md` (your v1 review), `x/rounds/r02_claude_response.md`.
- Code anchors the plan cites (verify against these): `src/services/studyService.js` (231-254, 277,
  330-358, 660-663, 721-733, 1065), `src/services/progressService.js` (148-150, 231),
  `src/services/db.js` (626-636, 1076/1084/1149, 2828-2836, 3266-3298, 797-808), `firestore.rules`
  (45-47, 55, 85, 96-107), `src/pages/DailySessionFlow.jsx` (817-826, 2191).

## Claims (what I believe is now true)
1. The monotonic virtual index preserves reconciliation UNCHANGED — lap-2 virtual `newWordEndIndex`
   (1279,1359,…) strictly exceeds all lap-1 nwei (≤1199), so greatest-nwei anchor selection never
   re-selects lap-1 and `twi = nwei+1` keeps climbing. (All 3 agents verified; §3a.)
2. `cyclingEnabled` belongs on the **per-assignment** slot `classes/{classId}.assignments[listId]`
   (teacher-only, class-scoped) — NOT on `lists/{listId}` (shared write = blast radius) nor the student
   progress doc (student-writable). (§3f.)
3. Fetch must wrap by **position-array index** (`positions[virtualIndex mod positions.length]`), not
   `mod wordCount`, because `deleteWord` decrements wordCount without renumbering positions. (§3c.)
4. Re-introducing a word ALREADY resets its study_state to NEW (merge of `createStudyState`), so new-word
   tests work in lap 2; the real problems are consequences: empty review pool at lap start (21-day
   `returnAt`), mastery % regressing, lap-1 history loss. (§0, §3d.)
5. The W3 attempt-write lockdown is a HARD PREREQUISITE — removing the allocation cap removes the clamp
   that today neutralizes forged unbounded `nwei`. (§3g.)

## Verification performed
- 3 independent Explore agents (correctness / security / UX) audited v1 and v2; I traced every accepted
  finding to `file:line` myself (rejected none — all held; a few mis-cited lines corrected in v3).
- Specifically code-verified this round: `deleteWord` no-renumber (`db.js:631-633`); re-intro resets to
  NEW (`studyService.js:660-663` + `studyTypes.js:40`); mastery gated on PASSED/FAILED (`db.js:1084`);
  reconciliation reads no study_state (grep of `progressService.js`); `isListComplete` has zero consumers.
- NOT run: no code written yet (this is a plan review, not an implementation).

## Known limitations / deferred scope
5 open DESIGN questions (plan §5), several are product calls for the owner, not defects:
lap-history model (lap-field vs accept-reset); dual-enroll containment (the anchor query is list-scoped,
not class-scoped, `db.js:3266-3273`); intervention reset at lap rollover; lap-rollover UX prominence;
mastery display semantics. These are intentionally open, not omissions.

## Questions for Codex (pressure-test these)
1. **Is the reconciliation-preservation claim (Claim 1) truly airtight** across ALL twi-writing paths —
   including the challenge day-advance (`db.js:2828-2836`, unclamped) and `safeTWI` (`progressService.js:231`)?
   Any path where a lap boundary makes greatest-nwei mis-select or twi clamp?
2. **Is per-assignment flag placement (Claim 2) sufficient**, given the anchor query is list-scoped
   (dual-enrolled student cycling in class A drives twi in class B)? Is my §3f caveat the right resolution?
3. **Is the W3-lockdown prerequisite (Claim 5) correctly scoped** — does removing the cap actually open
   unbounded self-forgery, and does the lockbox close it? Any other clamp I'm removing unknowingly?
4. **Is the position-array wrap (Claim 3) correct** at the lap boundary (a day straddling 1199→0)?
5. **False-green / missed path:** any code path that reads `wordCount`/`twi`/position that v3's touch-list
   (§4) misses and would break under virtual twi > wordCount?

## Requested decision
`GO` (design is implementation-ready; remaining items are the honest open §5 questions) or `NEEDS_FIXES`
(name the blocker/high defects to fold into v4).
