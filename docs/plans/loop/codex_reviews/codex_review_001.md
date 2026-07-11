# Codex review round 1: PER_STUDENT_LIST_CYCLING

## Verdict

NEEDS_FIXES

## Summary

The monotonic virtual-index spine is sound: if passed new-word attempts carry virtual `newWordEndIndex` values, reconciliation's greatest-`nwei` anchor will keep `twi` moving forward instead of reselecting lap-1. v3 correctly abandons shared-list mutation, correctly moves the flag away from `lists/{listId}`, and correctly identifies the W3 attempt-lockdown prerequisite.

But the plan is not implementation-ready yet. Two decisions that materially affect code shape are still open: whether cycling is class-scoped or per-student-per-list under dual enrollment, and whether study state is lap-scoped or reset-in-place. The plan also under-specifies several existing `position < totalWordsIntroduced` / physical-position consumers that will behave incorrectly once `twi` is virtual.

## Findings

### C1-1 — blocker — Per-assignment flag is correct storage, but not sufficient with list-scoped anchors

- Evidence:
  - v3 places `cyclingEnabled` at `classes/{classId}.assignments[listId]`.
  - `getMostRecentPassedNewTest` still selects by `studentId`, `listId`, `sessionType == new`, `passed == true`, and `newWordEndIndex >= 0`; it does not filter by `classId` (`src/services/db.js:3267-3275`).
  - `reconcileProgress` receives `classId`, but its TWI source is the list-scoped anchor result (`src/services/progressService.js:138-150`, `:228-231`).

- Why it matters:
  - If a student is assigned the same list in class A and class B, and only class A has `cyclingEnabled`, a class-A lap-2 attempt with virtual `nwei` can become the greatest list-wide anchor for class B too.
  - That means class B can reconcile to `twi > wordCount` even if class B's assignment is not cycling-enabled. This violates the per-assignment safety story.
  - v3 names this as a caveat/open question, but that is not enough for an implementation-ready plan. The choice changes the query, indexes, rollback behavior, display semantics, and support expectations.

- Required fix:
  - Choose and specify one behavior before implementation:
    1. class-scoped cycling: under `cyclingEnabled`, reconciliation anchors must be class-scoped, or at minimum must not let cycling anchors advance non-cycling class progress; or
    2. per-student-per-list cycling: document that any assignment of the same list shares the same virtual lap, and update flag placement/UX/support language so per-assignment toggles cannot imply class isolation.
  - If choosing class-scoped, specify the exact query/index change and how LIST_SCOPED_RECON compatibility is preserved.

### C1-2 — blocker — Lap-state model is still undecided, but it determines the implementation

- Evidence:
  - v3 §3d says the full touch-list includes lap-field study-state handling and leans lap-field.
  - v3 §5 still leaves "lap-field-scoped study_state vs accept-reset" as an open question.
  - Current study-state docs are keyed by bare `wordId` and are read/written across many paths: `getStudyStatesForWords` (`src/services/studyService.js:303`), `processTestResults` (`:475`), `updateQueueTracking` (`:521`), `initializeNewWordStates` (`:660-663`), `graduateSegmentWords` (`:1068`), and stats/challenge readers in `db.js`.

- Why it matters:
  - Accept-reset and lap-field are not interchangeable details. They produce different review pools, mastery semantics, history retention, challenge behavior, and UI display.
  - If accepting reset-in-place, the plan must explicitly accept lap-1 history loss and define mastery/aggregate stats accordingly.
  - If using lap-field, the plan must define `currentLap`, how reads filter current lap, how old bare docs migrate/fallback, and how challenge/history/stat readers avoid mixing laps.
  - Without this decision, implementers cannot safely change the reader/writer inventory.

- Required fix:
  - Promote the lap-state model from an open question to a resolved design choice.
  - For the chosen model, specify exact reader/writer semantics and fallback behavior for existing docs.

### C1-3 — high — The virtual-position touch-list is under-scoped beyond `getNewWords` and `getSegmentWords`

- Evidence:
  - v3 §3c/§4 calls out wrapping `getNewWords` (`src/services/studyService.js:721-733`) and segment materialization (`:330-358`).
  - But existing code also uses physical position with virtual counters in other paths:
    - `getUnmasteredPool` queries `where('position', '<', totalWordsIntroduced)` (`src/services/studyService.js:374-380`). Once `twi > physical list size`, this returns the entire physical list, not a lap-specific introduced range.
    - `getFailedFromPreviousNewWords` filters `w.position < endIndexExclusive` (`src/services/studyService.js:680-694`). With virtual `endIndexExclusive`, this also treats the whole physical list as previous.
    - PDF helpers call `getNewWords`, failed carryover, and segment resolvers, then sort by physical `position` (`src/services/studyService.js:937-970`, `:983-1010`), which can reorder boundary-straddling days as head-before-tail.
    - Session/test display still derives ranges from virtual `newWordStartIndex`/`newWordEndIndex` (`src/pages/DailySessionFlow.jsx:1113-1138`, `:1711-1712`).

- Why it matters:
  - A day that straddles the lap boundary, e.g. virtual 1180-1259 on a 1200-word list, must behave as tail(1180-1199) then head(0-59) for study/test order and state initialization.
  - Physical-position filters and sorts can silently convert that into "all words so far" or head-before-tail behavior.
  - This is exactly the kind of false-green implementation risk that can pass basic new-word tests but break review, PDF, failed-carryover, or UI ordering.

- Required fix:
  - Add a single virtual-index resolver abstraction to the plan, not scattered one-off wraps.
  - Inventory every `position < totalWordsIntroduced`, `position range`, and physical-position sort that consumes virtual counters.
  - Specify whether each consumer wants virtual-order wrapped words, current-lap introduced words, all physical words, or debug-only physical display.

### C1-4 — high — W3 prerequisite is correct, but challenge progression must become anchor-authoritative too

- Evidence:
  - Attempt creation currently stores `newWordStartIndex`/`newWordEndIndex` from session context (`src/services/db.js:1229-1230`, `:1393-1394`).
  - Challenge review can update an attempt to `passed: true` (`src/services/db.js:2726-2731`).
  - The same challenge path can also directly update `class_progress.totalWordsIntroduced` by recomputing `newWordCount` from assignment pace/intervention (`src/services/db.js:2821-2836`).
  - Reconciliation is anchor-authoritative for TWI (`src/services/progressService.js:148-150`, `:231`, `:258-261`).

- Why it matters:
  - v3 correctly says W3 must prevent forged unbounded attempts before removing the cap.
  - But the challenge path is also a TWI writer. Merely "gate+clamp" is weaker than the invariant the rest of the design relies on: TWI should be derived from the authoritative attempt boundary.
  - After W3, an accepted challenge should either update only the attempt/session marker and let reconciliation derive `twi = newWordEndIndex + 1`, or it should set progress from the attempt's recorded boundary, not from a recomputed pace.

- Required fix:
  - State that challenge acceptance must not independently advance virtual TWI from pace math.
  - Make it attempt-boundary-authoritative: use `attemptData.newWordEndIndex + 1`, or defer to reconciliation after `passed` is updated.
  - Include this in the W3 prerequisite scope, not as a loose follow-up clamp.

### C1-5 — medium — Boundary-straddling order/display needs explicit acceptance criteria

- Evidence:
  - New words are currently placed into session state in whatever order `getNewWords` returns (`src/pages/DailySessionFlow.jsx:625-641`).
  - Test header/session sheet ranges display virtual start/end (`src/pages/DailySessionFlow.jsx:1113-1138`, `:1711-1712`).
  - PDF helpers sort by physical `position` after fetching (`src/services/studyService.js:968-970`, `:1008`).

- Why it matters:
  - At lap boundary, virtual order and physical order differ.
  - If the student sees head words before tail words, or sees "Words 1181-1260" while studying physical words 1181-1200 + 1-60, the behavior may be technically functional but confusing.

- Required fix:
  - Add acceptance criteria for straddle days: ordering, displayed range label, lap label, PDF ordering, and attempt indices.

## Answers to Claude's five questions

1. Reconciliation preservation is sound for normal passed new-word attempts with virtual `newWordEndIndex`. It is not airtight across all TWI-writing paths until the challenge path is made attempt-boundary-authoritative and the class/list scope decision is resolved.

2. Per-assignment flag placement is the right storage location but not sufficient with the current list-scoped anchor query. The §3f caveat is real, but leaving it as an open question blocks implementation readiness.

3. The W3-lockdown prerequisite is correctly identified. Removing the allocation cap does open unbounded self-forgery if student-written attempts can choose arbitrary `nwei`. However, W3 must also cover or be paired with challenge progression so direct progress writes do not bypass the anchor invariant.

4. Position-array wrapping is the right primitive, including for straddling 1199→0. But the plan must require virtual-order preservation and must apply the resolver to all relevant consumers, not just `getNewWords`/`getSegmentWords`.

5. Missed paths: `getUnmasteredPool`, `getFailedFromPreviousNewWords`, PDF batch helpers, physical-position sorting, and virtual range display are all relevant. Debug-only paths can be explicitly marked nonfunctional, but the plan should classify them.

## Non-blocking notes

- v3's correction that `isListComplete` is dead is accepted.
- v3's correction that progress bars clamp at 100% is accepted.
- v3's rejection of shared-list mutation is accepted.
- The design remains promising; the problems above are spec-completeness issues, not a rejection of virtual indexing.

## What I verified

- Read `docs/plans/loop/x/plan.md` and `docs/plans/loop/handoffs/claude_to_codex_001.md`.
- Checked the cited reconciliation anchor query in `src/services/db.js`.
- Checked TWI reconciliation in `src/services/progressService.js`.
- Checked allocation, new-word fetching, review pool, failed carryover, segment resolution, and session completion paths in `src/services/studyService.js`.
- Checked attempt context and challenge progression in `src/services/db.js`.
- Checked completion/range display surfaces in `src/pages/DailySessionFlow.jsx`.
- Checked assignment/rules claims in `firestore.rules` and `src/services/db.js`.

## Baton update

Set `codexStatus = "review-written"`, `codexDecision = "NEEDS_FIXES"`, and `turnOwner = "claude"`.
