# Claude handoff round 2: PER_STUDENT_LIST_CYCLING

## Objective
Re-review **plan v4** (`docs/plans/loop/x/plan.md`) — the response to your r001 `NEEDS_FIXES`. This is a
DELTA review: you already understand the plan; focus on whether v4 correctly closes your 5 findings.
Decision requested: `GO` or `NEEDS_FIXES`.

## What changed since v3 (your r001 targets)
- **C1-1 (blocker) RESOLVED — decision made:** cycling scope = **per-student-per-list** (David). The
  list-scoped anchor query (`db.js:3266-3273`) is now the *intended* behavior. `cyclingEnabled` on
  `classes/{classId}.assignments[listId]` means "allow this student to cycle this list"; a dual-enrolled
  student cycling via class A continuing in class B is documented as intended (they finished the list).
  See §3b.
- **C1-2 (blocker) RESOLVED — decision made:** lap-state = **accept-reset + lap-aware display** (David).
  No lap field / no study_state doc-id surgery. Re-intro resets to NEW (already happens); mastery DISPLAY
  becomes lap-aware; lap-1 history lives in `attempts`, not study_state. See §3d.
- **C1-3 (high) FOLDED:** added a single `resolveVirtualRange` resolver + a **full physical-position
  consumer inventory table** (§3c) classifying each: getNewWords, segment, getUnmasteredPool
  (`position<twi`), getFailedFromPreviousNewWords, PDF helpers, range display — each marked
  virtual-wrapped / current-lap / debug. Wrap by position-array index (cycleLength), not `mod wordCount`.
- **C1-4 (high) FOLDED into the W3 prerequisite:** §3g now requires the challenge path
  (`db.js:2821-2836`) become **attempt-boundary-authoritative** (twi = `attemptData.newWordEndIndex+1` or
  defer to reconciliation) — no independent pace math advancing virtual twi. Part of W3 scope, not a loose clamp.
- **C1-5 (medium) FOLDED:** §3h adds boundary-straddle acceptance criteria (order, range label, lap label,
  PDF order, attempt indices).

## Claims (what I believe is now true)
1. Both your blockers are now resolved DECISIONS with specified semantics, not open questions.
2. The §3c consumer inventory is complete for virtual-twi correctness (getUnmasteredPool /
   getFailedFromPreviousNewWords / PDF sort now explicitly lap-bounded or virtual-ordered).
3. The challenge path is now inside the W3 prerequisite as attempt-boundary-authoritative.
4. Remaining §5 open questions (intervention-across-laps, rollover-UX prominence, cycleLength caching) are
   genuine product/perf choices, not correctness gaps blocking implementation-readiness.

## Verification performed
- Verified against code this round: `getUnmasteredPool` uses `where('position','<',twi)`
  (`studyService.js:374-380`) → returns whole list when twi>listSize (your C1-3, confirmed);
  `getFailedFromPreviousNewWords` filters `position<endIdx` (`:680-694`, confirmed); challenge path writes
  twi from recomputed pace (`db.js:2821-2836`, confirmed). All your r001 code claims held.
- A fresh 3-agent audit is also running on v4 in parallel (my side) — I'll reconcile its findings with yours.

## Known limitations / deferred scope
3 open questions (§5), all product/perf, not correctness. W3 attempt-write lockdown is a stated hard
prerequisite (separate plan) — cycling must not ship before it.

## Questions for Codex
1. Are C1-1 and C1-2's **resolutions** (not just the decisions, but the specified semantics in §3b/§3d)
   actually implementation-complete, or is anything still under-specified?
2. Is the §3c consumer inventory **complete** — any other physical-position/`totalWordsIntroduced`
   consumer that breaks under virtual twi that I still missed?
3. Does §3d accept-reset + lap-aware display have an internal contradiction — CAN "within-lap mastered"
   be computed WITHOUT a lap field on study_state? (My concern: the display may need lap info the
   accept-reset model doesn't store.)
4. Is §3g now airtight, or does making the challenge path attempt-authoritative leave any residual
   forge/advance path?

## Requested decision
`GO` (implementation-ready; §5 are honest product/perf open questions) or `NEEDS_FIXES` (name them for v5).
