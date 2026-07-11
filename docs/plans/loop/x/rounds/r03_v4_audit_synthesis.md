# Round 3 — v4 audit synthesis (Codex r002 + 3-agent final pass), code-verified

Reviewers: Codex r002 (`codex_reviews/codex_review_002.md`) + the last 3-agent pass (A correctness /
B security / C UX). All findings traced to code by me. **Headline: the approach still holds, but the
SECURITY PREREQUISITE is both mis-cited and bigger than v4 states — a strategic finding.**

## STRATEGIC (must decide before v5 is meaningful)

### S1 · §3g cites the WRONG security gate — cycling's real prerequisite is server-authoritative twi (bigger than W3)
Multiple reviewers, verified:
- **W3 does not validate anchors.** `PLAN_attempt_write_lockdown.md:107-117` — W3 makes attempts
  *server-WRITTEN* only; "**Anchors are client-echoed… even server-written attempts can carry a client
  anchor**." So a student still submits a forged `newWordEndIndex`; reconciliation honors it
  (`progressService.js:150,231`). (Lens B blocker; Codex r001/r002 accepted §3g too readily — agent caught it.)
- **`class_progress` forge survives W3 entirely.** `users/{uid}/class_progress` is student-writable
  (`firestore.rules:35 isOwner`); delete own attempts → `hasValidData=false` → `safeTWI = max(storedTWI,
  twi)` honors a forged `storedTWI` (`progressService.js:231`). Closing it = "override plan D2" (server-owned
  twi), NOT W3 (`PLAN_attempt_write_lockdown.md:120-123`). (Lens B high.)
- **The cap doesn't "neutralize" forgery — it makes it self-defeating.** Removing the cap (§3f) *activates*
  the forge. (Lens B medium; §3g mechanism restated.)
- **twi-writer inventory incomplete:** the PRIMARY normal writer `updateProgressAfterSession`
  (`progressService.js:462`, pure pace-increment) is unmentioned; my "no independent pace math advances twi"
  claim is false (it's reconciliation-corrected, must be stated). (Lens A F1.)
**⇒ Safe per-student cycling is gated on the server-authoritative-twi workstream (validated anchor + locked
class_progress writes), which is arguably a bigger effort than the cycling feature itself.** Decision needed.

## BLOCKERS (design defects, fixable in v5)

### B1 · Per-lap mastery display is uncomputable under accept-reset AND targets dead code
Codex C2-2 + Lens C C1, verified: study_state has no `lap` field (`studyTypes.js:63-70`); mastery counts
PASSED/FAILED over the physical list (`db.js:1084`) — a lap-1 PASSED word and a re-mastered lap-2 word are
indistinguishable. Worse, `fetchStudentStats` (`db.js:1053`) has **zero callers** (dead code). "Lap 2: 50%"
is really *introduction* progress (`twi mod cycleLength`), not mastery.
**Fix:** DROP per-lap mastery %; show introduction progress + "Lap N" only. Per-lap mastery = **non-goal**
(needs a lap field → contradicts accept-reset). Real teacher stat is `fetchStudentAggregateStats`
(`db.js:1114-1132`, `ClassDetail.jsx:185`) which counts `status!==NEVER_TESTED` → cycling-safe as-is (Lens C C6).

### B2 · §3d batch-clear contradicts §3c lap-bounding (three reviewers)
Codex C2-1 + Lens A F3 + Lens C C2, verified: `selectReviewQueue` hard-filters `status==='MASTERED'`
(`studyAlgorithm.js:284`), so clearing dates doesn't re-seed review. But if §3c lap-bounds `getUnmasteredPool`
to the current lap, the pool holds only re-introduced (NEW) words anyway → the clear is inert; without §3c it
FLOODS all 1200 words. Also a 1200-doc clear exceeds Firestore's 500/batch.
**Fix:** §3c lap-bounding is the SINGLE review mechanism. DROP the batch-clear and the MASTERED-status-transition.
Keep modal-suppression for the exact-boundary empty moment.

### B3 · Challenge fix `attemptData.newWordEndIndex + 1` corrupts twi on the review-pass branch
Lens A F2, verified: the `isCurrentBoundary` branch fires on "New OR **Review** test pass" (`db.js:2822`);
a review attempt stores `newWordEndIndex: null` (`db.js:1230`) → `null+1 === 1` → silently resets the student
to Day-1 state.
**Fix:** gate the twi derivation to `phase==='new'`; on review-pass don't advance twi (or use the paired new anchor).

## HIGH / MEDIUM (fold into v5)
- **Consumer inventory additions** (Codex C2-3): `getBlindSpotPool` + cached `blindSpotCount`
  (`studyService.js:814-923`), `SessionSummaryCard.jsx:22` (user-visible `twi/totalListWords`). Lens A confirms
  `getMasteredWordsInRange` is debug-only (covered) and `calculateSegment` is dead — no action.
- **cycleLength canonical** (Lens A F5): define ONE `cycleLength := positions.length`; use for lap/display/wrap.
  Never mix `wordCount` into lap math (drift if they diverge).
- **§3e citation fixes** (Lens C C4, Lens A F4): `StudySelectionModal.jsx:90` reads list-doc stats (renders 0) —
  wrong citation; add `ClassDetail.jsx:55` Day tooltip + Dashboard day panels; touch-list item 5 cites the
  assignment WRITE site (`db.js:797-808`) — the flag must be ADDED there and threaded into the allocation READ
  (`initializeDailySession` consumes `assignmentSettings`, not the class doc).
- **Flag guardrail** (Codex C2-4, Lens C C5): "any assigned class with cycling on unlocks cycling for the
  student/list; all classes then show lap-aware continuation" + in-product affordance ("cycling enabled via
  {class}") instead of a support-doc band-aid.
- **Lap-rollover ack timing** (Lens C C3): boundary crossed MID-session (straddle day) → CompletePhase (day-end)
  fires after lap-2 head studied. Use a one-time interstitial when twi first crosses `lap*cycleLength`, or drop
  "completed" framing for an inline "Lap N" badge.
- **Lap indexing** (Lens C nit): display lap = `floor(twi/cycleLength)+1`; define boundary render (twi=1200 → 0%
  of new lap vs 100% of prior).
- **Intervention across laps** (Lens C nit, §5 Q1): decide reset-vs-carry BEFORE flipping the flag — hits the
  live unstuck students (최도훈 etc.).
- **Downgrade** challenge-path framing (Lens B B4): it's pace-bounded + teacher-gated, not `answers[]`-forgeable.

## CONFIRMED SAFE (verified — no action)
§3a reconciliation spine (anchor `db.js:3266-3298`, `twi=nwei+1` `progressService.js:150`); re-intro reset
(`studyService.js:662-663`); §3b same-student-only (studentId-filtered anchor, no cross-student/teacher leak);
§3f student cannot flip flag (owner-teacher-only, tighter than plan said); §3c wrap math off-by-one-free +
correct straddle order; `db.js:3062` virtual-to-virtual consistent; MCQ/blind distractor risk moot.

## RESET-TWI (David's alt) vs MONOTONIC — updated with this data
Reset-twi would shrink §3c (within-lap twi = physical position) AND preserve the forgery clamp (bounded nwei) —
but it does NOT remove S1's class_progress forge (that's encoding-independent), and it requires reworking the
certified reconciliation path + attempts schema (lap field). So it's not an escape from the security
prerequisite. Monotonic remains my recommendation unless David wants to trade §3c breadth for recon-rework.
