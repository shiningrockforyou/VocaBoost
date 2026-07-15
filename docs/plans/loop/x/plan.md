# PLAN — Per-student list cycling (finished-list continuation) — v5 (GATED CAPSTONE)

**Slug:** x · **Status:** HARDENED DESIGN — **gated on the student-owned-progress + server-authoritative-twi
foundation** (see §0/§3g). Not shippable standalone. · **Author:** Claude
**Decision (David):** per-student cycling; scope = per-student-per-list; lap-state = accept-reset; twi stays
monotonic (reconciliation untouched). Reviewed 3 loop rounds (Codex r001/r002 + two 3-agent audits).

> **Persona-fleet finding F2 (2026-07-12, Codex-triaged) — #6 scope narrowed.** L16 observed that a same-list,
> SAME-pace class move CARRIES csd/twi exactly under the currently-deployed LIST_SCOPED_RECON (before 4/320 →
> after-reconcile 4/320, carried=true). So the classic #6 "class change resets progress" does NOT reproduce for
> the same-list/same-pace reconciliation path. This foundation gate should NOT treat that case as an open
> blocker. #6 remains open only for narrower/untested paths: DIFFERENT-pace transitions, list switch / 2nd-list
> focus, flag-OFF, and stale/non-reconciled views. The broader durable list-owned-progress + server-auth-twi
> foundation is still required for CYCLING itself (cap removal → forgery), independent of #6's status.

## 0. THIS PLAN IS A CAPSTONE — read first
The v4 audit (Codex r002 + 3-agent) proved that safe cycling **requires removing the allocation cap**, which
**removes the only clamp that today makes progress-forgery self-defeating**. Closing that forge is NOT what
`W3` (attempt-write lockdown) delivers — anchors stay client-echoed and `class_progress` stays student-writable
(`PLAN_attempt_write_lockdown.md:107-123`). The real gate is **server-authoritative twi**: server-owned
progress writes + server-validated anchor. That is a natural companion to the **student-owned progress re-key**
(LIST_SCOPED_RECON Phase 2) David already needs for the class-change CS-ticket flood — same migration touches
the same write paths. **⇒ Cycling ships as the final phase ON TOP of that foundation, not before it.** Every
code change below assumes twi is server-owned. This doc is the hardened capstone spec to pick up once the
foundation lands.

## 1. Problem
Finished list dead-ends: `DailySessionFlow`→`COMPLETE` when no new words + no review segment
(`DailySessionFlow.jsx:817-826`); legacy `/mcqtest` throws (`MCQTest.jsx:322-324`). Root: `wordsRemaining =
totalListWords − twi → 0` (`studyService.js:234`) → `newWordCount = 0`. Live: 최도훈 (Base Camp 1200 @ Day 15),
안예진, 고아연. Goal: keep them studying the same list, same pace/tests, indefinitely, per student.

## 2. Approach — monotonic VIRTUAL index per student (physical list untouched)
`twi` climbs past `cycleLength` per student; fetch physical word by wrapping the LOOKUP, not the counter →
counter monotonic → reconciliation intact. NOT `twi % cycleLength` (wrapping the counter → nwei repeats →
re-sticks). **`cycleLength := positions.length`** is the ONE canonical modulus for lap math, display, AND
wrap — never `wordCount` (they coincide today only because `deleteWord` decrements both, `db.js:626-636`; pin
one definition to avoid drift — Lens A F5). Display lap = `floor(twi / cycleLength) + 1` (1-indexed; first pass
= "Lap 1"). Boundary render: at `twi = k·cycleLength` show 100% of lap k, not 0% of lap k+1 (Lens C nit).

> **Considered + rejected: reset-twi + lapCount** (David's alt). Would shrink §3c (within-lap twi = physical
> position) and preserve the nwei clamp — but requires reworking the certified reconciliation path + adding a
> `lap` field to attempts, and does NOT remove the class_progress forge (encoding-independent). Monotonic keeps
> risk in the shallow fetch/display layer; reconciliation stays at ZERO changes. Kept monotonic.

## 3. Design

### 3a. Reconciliation — UNCHANGED (all reviewers confirm)
Anchor = greatest `newWordEndIndex` (`db.js:3266-3298`); `twi = anchor.nwei+1` (`progressService.js:148-150`);
`safeTWI = hasValidData ? twi : max(stored,twi)` (`:231`). Lap-2 virtual nwei (1279,1359,…) > all lap-1 nwei →
greatest-nwei never re-selects lap-1 → twi climbs. Zero recon change. **twi writers (full inventory — Lens A
F1):** (1) reconciliation `progressService.js:261` (anchor-authoritative), (2) `updateProgressAfterSession`
`:462` (pace-increment, reconciliation-corrected next init), (3) challenge `db.js:2833` (pace-increment). The
claim is NOT "no pace math writes twi" — it's "the anchor is authoritative; direct writers are
reconciliation-corrected." Under the foundation, ALL three become server-owned.

### 3b. Cycling scope — PER-STUDENT-PER-LIST
Cycling is a fact about the student + list (consistent with LIST_SCOPED_RECON). Anchor query stays list-scoped
(`db.js:3266-3273`, studentId-filtered — verified same-student-only, no cross-student/teacher leak). Flag
`cyclingEnabled` on `classes/{classId}.assignments[listId]` (owner-teacher-only, `firestore.rules:55` — tighter
than "teacher"; student cannot flip). **Unlock rule (Codex C2-4):** *any* assigned class with cycling on
unlocks cycling for that student+list; ALL of that student's classes on the list then show lap-aware
continuation — with an **in-product affordance** ("cycling enabled via {className}"), not a support-doc
band-aid (Lens C C5).

### 3c. Virtual→physical fetch — ONE resolver + full consumer inventory
`resolveVirtualRange(listId, virtualStart, count)` → ordered physical words, wrapping by position-array index
`positions[i mod cycleLength]` (NOT `mod wordCount`). Straddle day (virtual 1180–1259) → tail(1180–1199) +
head(0–59) in virtual order (wrap verified off-by-one-free — Lens A F6).

| Consumer | file:line | Wants | Fix |
|---|---|---|---|
| `getNewWords` | `studyService.js:721-733` | virtual-order wrapped | resolver |
| segment materialization | `studyService.js:330-358` | virtual-order wrapped | resolver |
| `getUnmasteredPool` `position<twi` | `studyService.js:374-380` | **current-lap** `[lap·cL, twi)`→physical | lap-bound (SINGLE review mechanism — see §3d) |
| `getFailedFromPreviousNewWords` | `studyService.js:680-694` | current-lap previous | lap-bound |
| PDF batch helpers (sort by physical pos) | `studyService.js:937-970, 983-1010` | virtual order | sort by virtual, or mark full-PDF a base/lap-1 view |
| `getBlindSpotPool` + cached `blindSpotCount` | `studyService.js:814-923` | classify (accept-reset changes NEVER_TESTED semantics) | lap-aware or declare unaffected |
| `SessionSummaryCard` `twi/totalListWords` | `SessionSummaryCard.jsx:22` | lap-labeled | §3e |
| session/test range display | `DailySessionFlow.jsx:1113-1138,1711-1712` | lap-labeled virtual range | §3e |
Debug-only (no action): `getMasteredWordsInRange` (`studyService.js:1130`, debug-flagged), `calculateSegment`
(dead). `db.js:3062` `newWordStartIndex==expectedBase` is virtual-to-virtual — consistent.

### 3d. study_state / review pool / mastery — accept-reset, ONE review mechanism, mastery-% DROPPED
- **Re-intro resets to NEW** (verified `studyService.js:662-663` + `createStudyState` `studyTypes.js:63-70`,
  `merge:true`). Lap-1 history not retained in study_state (lives in `attempts`). Accepted.
- **Review re-seed — §3c lap-bounding is the SINGLE mechanism** (Codex C2-1 + Lens A F3 + Lens C C2): bounding
  `getUnmasteredPool` to the current lap means the pool holds only this-lap re-introduced (NEW) words →
  `selectReviewQueue`'s MASTERED filter (`studyAlgorithm.js:284`) is moot. **DROP the masteredAt/returnAt
  batch-clear** (inert with §3c; floods all words without it; and a 1200-doc clear exceeds Firestore's
  500/batch). Keep **modal-suppression** for the exact-boundary empty moment (`DailySessionFlow.jsx:807-812`).
- **Per-lap mastery % — DROPPED as a non-goal** (Codex C2-2 + Lens C C1): uncomputable under accept-reset (no
  `lap` field; a lap-1 PASSED word and a re-mastered lap-2 word are indistinguishable), and `fetchStudentStats`
  (`db.js:1053`) is DEAD CODE (zero callers). Display shows **introduction progress** `(twi mod cycleLength)/
  cycleLength` + "Lap N" only — NOT mastery. Teacher stat `fetchStudentAggregateStats` (`db.js:1114-1132`,
  `ClassDetail.jsx:185`) counts `status!==NEVER_TESTED` → cycling-safe as-is, no change (Lens C C6). A real
  cross-lap progress view would need attempts-based reporting — explicit non-goal unless separately scoped.

### 3e. Display — lap-aware (corrected surface list)
Fix all introduced/Day surfaces reading the virtual counter: bars clamp `Math.min(100,…)`
(`Dashboard.jsx:1890-1891`, `ClassDetail.jsx:81-82`) → pin at 100%; numerator overflow
(`Dashboard.jsx:1899-1900`, `ClassDetail.jsx:102`); Day tooltip `ClassDetail.jsx:55`; Dashboard day panels
(`Dashboard.jsx:1562,186`); `SessionSummaryCard.jsx:22`. **NOT** `StudySelectionModal.jsx:90` — it reads
list-doc stats (renders 0), not per-student (Lens C C4, drop that citation). Show `(twi mod cycleLength)/
cycleLength` + "Lap N".

### 3f. Completion / lap-rollover
Replace `newWordCount===0`→`COMPLETE` (`DailySessionFlow.jsx:817-826`) + legacy throw (`MCQTest.jsx:322-324`)
with lap rollover when `cyclingEnabled`: allocation `newWordCount = pace` (× intervention), no cap; non-cycling
lists keep `Math.min(pace, wordsRemaining)` clamped ≥0. **Ack timing (Lens C C3):** the boundary is crossed
MID-session on a straddle day, so a day-end CompletePhase message arrives after lap-2 head is studied — fire a
one-time interstitial when twi FIRST crosses `k·cycleLength` (before showing the head segment), or accept an
inline "Lap N" badge and drop "you completed the list" framing.

### 3g. HARD PREREQUISITE — server-authoritative twi (NOT W3) — the gate
Removing the cap (§3f) activates progress-forgery. **Correct prerequisite = the foundation, NOT W3:**
- **Server-owned progress writes:** `class_progress`/list-progress must stop being student-writable
  (`firestore.rules:35 isOwner` → server/Admin-SDK only). Today a student deletes their attempts →
  `hasValidData=false` → `safeTWI=max(storedTWI,twi)` honors a forged `storedTWI` (`progressService.js:231`) →
  unbounded skip-ahead once the cap is gone. **This is the item the student-owned re-key naturally closes if it
  moves progress writes server-side.**
- **Server-validated anchor:** attempts' `newWordEndIndex` must be server-derived/validated, not client-echoed
  (`PLAN_attempt_write_lockdown.md:117` — W3 does NOT do this; the "override plan D2" does).
- **Challenge path (Lens A F2, B4):** make it attempt-boundary-authoritative — but GATE the twi derivation to
  `phase==='new'`; a review-pass attempt has `newWordEndIndex:null` (`db.js:1230`) → `null+1===1` would reset
  the student to Day-1. On review-pass, don't advance twi. (It's pace-bounded + teacher-gated today, so lower
  urgency than the anchor/class_progress forge — Lens B B4.)
**Until server-authoritative twi lands, cycling MUST stay flag-off.**

## 4. Code touch-list (all deploy; behind per-assignment `cyclingEnabled`; ON TOP of the foundation)
1. Allocation: cap removal under cycling + non-cycling clamp≥0 (`studyService.js:234-235,253-254`).
2. `resolveVirtualRange` + route all §3c consumers (incl. getBlindSpotPool, SessionSummaryCard).
3. Lap rollover: modal suppression + interstitial ack (§3f); NO batch-clear.
4. Lap-aware display, introduction-progress only (§3e); canonical `cycleLength`.
5. Flag: ADD `cyclingEnabled` to the assignment write (`db.js:797-808` is the WRITE site — Lens A F4) + unlock
   rule (§3b) + thread into the allocation READ (`initializeDailySession` consumes `assignmentSettings`, not
   the class doc — new plumbing).
6. Challenge path gated to `phase==='new'` (§3g).
7. **FOUNDATION PREREQUISITE (separate plan): server-authoritative twi — server-owned progress writes +
   server-validated anchor. Cycling does not ship before it.**

## 5. Open questions (product/perf — not correctness gates)
1. **Intervention across laps** (Lens C, hits the live unstuck students): reset or carry `interventionLevel`
   (`studyService.js:182`) at rollover? Decide before enabling for 최도훈 etc.
2. **Rollover ack prominence** (§3f): interstitial vs inline badge.
3. **cycleLength caching:** compute per session vs store a read-only cache on the list (not a per-student write).

## 6. Rollback / safety
Behind per-assignment `cyclingEnabled` (default off) → zero change off; no shared data mutated, no migration
(existing twi already the unwrapped virtual index; flag alone won't unstick — needs §3b+§3c+§3f + the
foundation). Rollback = flip off; mid-lap student re-dead-ends at boundary (no corruption). Sweep before/after.
**HARD GATE: do not enable before server-authoritative twi (§3g).**

## 7. Resolved / non-goals
- **Resolved:** approach (monotonic virtual index preserves reconciliation); scope (per-student-per-list);
  lap-state (accept-reset); MCQ/blind distractor risk moot; teacher aggregate stat cycling-safe; wrap math
  correct; §3b same-student-only.
- **Non-goals:** advancing between lists; per-lap mastery % (needs a lap field, contradicts accept-reset);
  cross-lap longitudinal progress view (would need attempts reporting); the student-owned re-key +
  server-auth-twi FOUNDATION itself (its own plan — this rides on it).
