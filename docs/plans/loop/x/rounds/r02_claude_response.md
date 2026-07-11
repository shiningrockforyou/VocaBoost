# Round 02 — Claude's response / synthesis (v2 → v3)

**Reviews of v2:** 3-agent audit (A correctness / B security / C UX) COMPLETE + code-verified. Codex was
HELD this round (cost discipline — agents on my budget every round; Codex sparingly on milestones).

## Design spine — CONFIRMED by all 3 agents
The monotonic virtual-index preserves reconciliation (greatest-nwei never re-selects a lap-1 anchor; twi
climbs). Verified at `db.js:3266-3298`, `progressService.js:148-150/231`. Unlike v1, v2's approach is sound
— findings are corrections, not approach-killers.

## Accepted (verified against code) → folded into v3
- **[BLOCKER] Flag placement** (B): `cyclingEnabled` on `lists/{listId}` is a shared write → re-introduces
  v1 blast radius. Per-student placement is student-writable (`rules:45-47`). → v3 §3f: **per-assignment**
  (`classes/{classId}.assignments[listId]`, teacher-only `rules:55`).
- **[HIGH] Forgery amplification** (B): cap removal removes the clamp that neutralizes forged `nwei`
  (`rules:106-107`, W3 not applied `:96-100`). → v3 §3g: **W3 attempt-write lockdown is a hard prerequisite**;
  gate the challenge path too (`db.js:2828-2836`).
- **[HIGH] §3c mod-mapping breaks on non-contiguous positions** (A): `deleteWord` doesn't renumber
  (`db.js:626-636`). → v3 §3c: wrap by **position-array index**, not `mod wordCount`.
- **[HIGH] study-state premise was backwards** (C, verified): re-intro already resets to NEW
  (`studyService.js:660-663`, `studyTypes.js:40`) — new-word tests work; the real problems are (i) empty
  review at lap start → existing "all mastered" dead-modal (21-day `returnAt`, `studyService.js:1065`),
  (ii) mastery % **regresses** (gated on PASSED/FAILED, `db.js:1084`), (iii) lap-1 history loss. → v3 §3d
  reframed; lap **FIELD** (not composite doc-id, which freezes mastery); clear `masteredAt/returnAt` at
  rollover; lap-aware mastery reader; full reader/writer inventory corrected.
- **[MED] Dual-enroll containment** (B): anchor query list-scoped, not class-scoped (`db.js:3266-3273`). →
  v3 §3f caveat + open-Q2.
- **[MED] Challenge path unclamped + ungated** (A+B+C, 3×): → v3 §3b/§3g.
- **[MED] isListComplete is dead / reconciliation reads no study_state** (A): false claims removed; retargeted
  to `newWordCount` + `DailySessionFlow.jsx:817-826` routing.
- **[MED] Display** (A+C): bars pin at 100% (not "106%"); add `StudySelectionModal.jsx:90`; re-cited. → v3 §3e.
- **[MED] No lap acknowledgement; Day unbounded** (C): → v3 §3h (rollover moment + Lap label).
- **[LOW] Intervention across laps** (C): → v3 open-Q3.

## Resolved (agent-confirmed, no change needed)
- MCQ/Blind-Spot cross-lap distractor risk **MOOT** (C-7, physical list untouched). → v3 §7.
- No-migration confirmed (twi already virtual) — but auto-unstick needs §3b+§3c, not the flag alone (C-11). → v3 §6.
- Teacher gradebook: no same-day collision (monotonic Day); only lap labels needed (C-8).

## Rejected
- None. All agent findings held under my code verification (a few had mis-cited line numbers, corrected in v3,
  but the substance was right).

## Verdict / diff
v2→v3: 1 blocker + 4 high + several medium folded; design spine intact; 2 items resolved. My resulting count
on v3: **0 blocker, 0 high open** (the highs are addressed; remaining are open *design questions* §5, not
defects). Candidate for a milestone Codex delta-pass next.
