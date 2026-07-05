# PLAN — List progress is student-owned (class confers access + daily quota only)

**Status:** **v3.7 — AUDIT-CLEAN** (Codex round 8: "architecture-ready," final rollout-risk statement
corrected here). Model settled; v3 re-audited (3 fresh reviewers + orchestrator pass) → v3.1; Codex rounds
3-8 → v3.2-v3.7 (2026-07-04). **v3.7 [C8-1]: the cutoff's old-bundle detection is stated honestly as
evidence-not-proof — a concrete 14-day no-legacy-write window + build-version census, with the explicit
accepted residual that a dormant pre-gate tab can wake post-cutoff into ONE false-success completion; data
integrity is carried by the rules cutoff, recovery is a reload.** Implementation-ready under the explicitly
accepted §13 risks. Owner deploys.
**Created:** 2026-07-04 · **Audit trail:** v1/v2 (3-agent Lens A/B/C + Codex ×2 → Appendix A), v3 re-audit
(3 reviewers + self-pass → [V*]), Codex rounds 3-4 (→ [C3-*]/[C4-*], §13).
**Tracks:** `NEED_TO_FIX.md` #6 (data model, HIGH).

> ## The principle (settled with David)
> **List progress lives ONLY with the student (student + list). A class confers exactly two things:
> (1) ACCESS to a list, and (2) the daily quota / session policy (pace, pass threshold, test mode) for a
> session launched under it.** A class owns *no* progress state. There is exactly **one** progress record per
> (student, list); every class the student takes that list in reads and advances that one record.
>
> This is the model `study_states` (mastery) already uses. Because no class owns progress state, there is
> nothing to arbitrate *between* classes — no server-claim/epoch machinery is needed (Appendix A). What IS
> needed — and what v3 missed — is making every reader/writer *around* the progress record list-aware.

---

## 1. Problem (one line)

Progress is keyed `class + list`, so changing classes on the same list resets the day counter and word
position to Day 1 — the app re-feeds already-studied words, even though mastery (`study_states`) is intact.
Hand-fixed 3× (이주헌 CS-2026-06-30; 손진욱 + 박주하 CS-2026-07-02b). This makes it structural.

**CS tickets closed:** CS-2026-06-30, CS-2026-07-02b fully; CS-2026-07-03 (김나연) partially (progress
ambiguity only — the displayed-fail is `NEED_TO_FIX.md` #5). **Not this plan:** CS-2026-06-24b/-06-28b
(`getPrimaryFocus` list-selection footgun; nice-to-haves #3b).

---

## 2. Product decisions (settled with David — design points, not open questions)

1. **Teacher visibility = shared truth.** Any teacher who assigns the list sees the student's *real* list
   position and student-level performance state — including what was earned in another teacher's class.
   **Confirmed fine.** [V3] Concretely this means the teacher gradebook's "last session" cell
   (`ClassDetail.jsx:955` `PreviousSessionCell`) may show a session studied in another class — consistent
   with shared truth. Per-class *history* remains naturally available because `attempts` are class-tagged.
2. **"Day" = number of sessions studied** on the list, not a pace-derived label. **Confirmed fine.**
   `currentStudyDay` is a stored counter (`studyService.js:184`, `progressService.js:415`) that also drives
   the review slice (`computeUnmasteredSegmentIds`, `studyService.js:200`) — carried verbatim, never
   relabeled from pace. The "behind/ahead" pacing badge is a per-enrollment *view*: it should read the
   student's **enrollment date in the viewing class** (class membership), not the stored student-level
   `programStartDate` (which after migration = earliest start across classes). [V17]
3. **Policy bundle follows the launching class** (pace + threshold + testMode) — the routed/active class the
   Dashboard selector sets. Move A→B → B's policy; multi-enrolled operating under B → B's policy. Note the
   authoritative `passed` flag on an attempt was computed against the **submit-time** class's threshold
   (`functions/index.js:340/377`) — under shared truth a pass earned in A counts in B (accepted under this
   decision; uniform 92/0.92 today per CS-2026-07-04b makes it moot in practice). [V4]

### 2.1 Field disposition (resolves the v3 §2.1↔§4 contradiction — [V3, blocker])

**Every student-level field is stored SHARED on `list_progress`. There is NO projection builder and NO
per-class performance doc.** (v3 said "class-filtered projections over attempts" in one section and "stored
student-level state" in another — mutually exclusive. Resolution per David's shared-truth decision: stored
shared, full stop.)

| Field | Disposition | Consumers (verified) |
|---|---|---|
| `currentStudyDay`, `totalWordsIntroduced` | stored, shared (reconciliation-authoritative) | session init, gates, reconciliation |
| `interventionLevel` | stored, shared — **load-bearing**: seeds daily allocation (`studyService.js:181`) and the challenge-accept TWI bump (`db.js:2824,2829`) | migration must carry it [V3] |
| `recentSessions[]`, `stats` | stored, shared — feed allocation **live at session init** (`calculateInterventionLevel` `studyService.js:166`, `calculateReviewCount` `:221`), Dashboard vitals/weekly chart (`Dashboard.jsx:1150-1288`), teacher `PreviousSessionCell` (`ClassDetail.jsx:955`) | shared display is the accepted semantics (§2.1) |
| `streakDays`, `lastStudyDate` | stored, shared (the student's streak, not a class's) | Dashboard `:1160` |
| `programStartDate` | stored, shared = **earliest** across collapsed docs; pacing badge reads per-class enrollment date instead (§2.2) | `implausibleStudyDayThreshold` (`progressService.js:267`) |
| `progressSnapshot`, `blindSpotCount` | **dropped at migration**, regenerated by normal operation | TypedTest/MCQTest snapshot machinery |

---

## 3. Current data model (grounded in code)

| State | Path / id | Scope today |
|---|---|---|
| **Mastery** | `users/{uid}/study_states/{wordId}` (`listId`, no `classId`) | ✅ student+list — already the target model |
| **Progress** (position + §2.1 fields) | `users/{uid}/class_progress/{classId}_{listId}` | ❌ student+**class**+list |
| **In-flight session** | `users/{uid}/session_states/{classId}_{listId}` | launch-scoped (owns no progress) |
| **Attempts** | `attempts` — `classId`,`listId`,`studyDay`,`newWordEndIndex`,`passed` | server-written; readers **classId-filtered** |
| **Settings / quota** | `classes/{classId}.assignments[listId]` | per class — this IS "access + quota," keep |

**Progress-doc composition surface** (route through the new helper; see the [V10] gate):
- Helpers: `getProgressDocId` `progressService.js:32` (callers 101/390/448); `getSessionDocId`
  `sessionService.js:55` (callers 70/95/120/153/177 — **unchanged**, sessions stay launch-scoped).
- Hardcoded progress/session doc-ids (note: they use `classIdParam` / `attemptData.classId`, NOT the literal
  `${classId}_${listId}` — see [V10]): `studyService.js:835`/`:862` (blindSpot; hand-edit);
  `db.js:2791/2813/2831` (`reviewChallenge` read + session write + progress write);
  `db.js:2900`/`:2911` (`resetStudentProgress`); `TypedTest.jsx:851/989/1116/1257`;
  `MCQTest.jsx:578/727/835/922`.
- **NOT progress surface — do NOT route through the list helper** [V11]: `DailySessionFlow.jsx:969` is an
  **`attempts` doc id** (`${uid}_${classId}_${listId}_day…_review_automarker`) — it stays class-scoped
  (class-tagged gradebook + §11-deferred); `functions/index.js:559` same; localStorage recovery keys
  (`sessionRecovery.js:20/31`, `testRecovery.js:21`, `DailySessionFlow` local ids) — nonce/ephemeral;
  `Dashboard.jsx:172/319/649` **and `:1138/1225/1282`** are local React map keys resolved via
  `getClassProgress`, fine once the helper flips.
- Reconciliation/anchor readers, classId-filtered, to be list-scoped (§5): `getMostRecentPassedNewTest`
  `db.js:3209`, `getReviewForDay` `:3268`, `getRecentAttemptsForClassList` `:3089`, `getNewWordAttemptForDay`
  `:3044`, `getMostRecentNewTest` `:3155`.

---

## 4. Target model

| State | Path / id | Notes |
|---|---|---|
| **Progress** (position + §2.1 fields) | `users/{uid}/list_progress/{listId}` | one record per student+list. **Schema note [F3]:** `createClassProgress` spreads a `classId` field into the doc body — the shared doc must **drop it** (or rename to informational `lastActiveClassId`); a stale embedded `classId` on a shared doc invites future misuse |
| **Mastery** | unchanged | — |
| **In-flight session** | **KEEP** `session_states/{classId}_{listId}` | ephemeral, launch-scoped; day-guarded on restore [V5] |
| **Attempts + reconciliation** | attempts unchanged; readers list-scoped with **pairing rules** (§5) | anchor by `newWordEndIndex` with null-fallback [V7] |
| **Settings / quota** | unchanged | launching class's assignment (§2.3) |

---

## 5. The real work

1. **List-scope reconciliation with explicit pairing rules** (§5.1) — the load-bearing piece.
2. **`class_progress` → `list_progress/{listId}`** with **hydrate-on-miss** (§5.2) — not a bare read-fallback.
3. **List-aware reset** (§5.3).
4. **Concurrent same-day guards** (§5.4).
5. **One-time migration** (§8) + indexes (§6 Phase 1) + small ripple fixes (§7).

### 5.1 List-scoped reconciliation — with the pairing rules v3 lacked

- Convert the five readers (§3) to query by `(studentId, listId)` — **decision: drop the `classId` filter
  (single query), not per-class union** — with the four new composite indexes deployed first (§6 Phase 1).
- **Anchor selection:** order passed-`new` attempts by **`newWordEndIndex` DESC, `submittedAt` DESC**
  (deterministic doc-ID as the final implicit tie-break) [C5-3 — position alone leaves equal-position
  attempts implicitly doc-ID-ordered, which can select an OLDER anchor and pair the wrong review via the
  temporal-lineage rule], replacing `orderBy('studyDay','desc')` (`db.js:3213`). **Sparse-index hazard
  [V7]:** legacy attempts missing `newWordEndIndex` vanish from a position-ordered index; when the position
  query returns none/invalid, fall back to the current `studyDay`-ordered query and log
  `csd_anchor_invalid` (existing event, `progressService.js:250-256`).
- **Review pairing rule [V4 + C3-6]:** the CSD derivation
  (`csd = reviewForAnchorDay ? anchorDay : anchorDay-1`, `progressService.js:154`) must pair the review to
  the **anchor attempt's own `classId`** — `getReviewForDay` gains a classId parameter sourced from the
  anchor, NOT the launching class — **plus temporal lineage: `review.submittedAt >= anchor.submittedAt`**
  (same class + same studyDay can otherwise match a review from an earlier progression/pre-reset history).
  Cross-pace, "any review with studyDay==N" can belong to a different progression (`db.js:3270-3272` matches
  studyDay equality only). **`getReviewForDay` must also return a discriminated `found | none | query-error`
  status** (like `getMostRecentPassedNewTest` already does): a query error today reads as "no review" and
  silently decrements CSD — an error must leave the stored CSD untouched [C3-6]. Failure mode of the pairing
  rule is safe: an unpaired review ⇒ `csd = anchorDay − 1` ⇒ the student re-does a review — never skips ahead.
- **CSD merge rule [C3-5 — v3.1's "matching CSD from the winning twi doc" contradicted the product
  definition]:** under "day = session count" (§2.2), the position-max anchor may carry a LOWER `studyDay`
  than a slower-pace class's day counter (pace-80 Day 8 / word 639 beats pace-20 Day 15 / word 299 on
  position — but the student *has studied* 15+ sessions). Merging or reconciling must therefore treat the
  two axes separately: **twi = greatest anchor-validated position (bidirectional, anchor-authoritative);
  CSD = non-demoting `Math.max(storedCSD, anchorDerivedCSD)`.** A too-high CSD is harmless (the next session
  is just numbered `csd+1`; the review slice rotates mod `studyDaysPerWeek`; `determineStartingPhase` finds
  no attempts for the new day → NEW_WORDS, correct). Trade-off, documented: making CSD non-demoting removes
  the anchor's *downward* self-heal for a forged/corrupt CSD — that case remains visible via the existing
  `csd_implausible` observability (`progressService.js:258-285`) and is handled by manual triage.
- **Completion-gate pairing [V4]:** `getNewWordAttemptForDay` (`studyService.js:1273` gate consumer) accepts
  a same-day passed `new` attempt list-wide **only if position-consistent** with the current shared position
  (its `newWordStartIndex` matches the day's base twi); mixed-history same-`studyDay` attempts at other
  positions are ignored.
- **Enumerate ALL callers before flipping a reader's scope [F1]:** `getNewWordAttemptForDay` is ALSO called
  from the **day-stamping / next-day paths** in `TypedTest.jsx:833/855` and `MCQTest.jsx:552/582` (stale-
  context re-derivation) — list-scoping the function globally changes those semantics too. Correct under
  shared truth, but each call site gets the same position-consistency rule and an explicit per-site
  decision (pass scope as a parameter rather than silently flipping a shared function). Rule for
  implementation: before changing any of the five readers, grep its full caller set and disposition each
  call site.
- **Orphan cleanup goes LOG-ONLY [V6 + C5-2 — data-loss vector]:** `cleanupOrphanedReviews` deletes reviews
  with `studyDay > anchorDay` (`progressService.js:174-176`). List-scoped, a position-max anchor can carry a
  LOWER `studyDay` than legitimate reviews — cross-class (pace-20 Day 15 = word 299 loses to pace-80 Day 8 =
  word 639) **and even same-class** (a pace change, or pre-reset/imported history without generation
  metadata), so v3.3's `classId === anchor.classId` restriction is insufficient [C5-2]. **During
  mixed-history / list-scoped reconciliation, cleanup logs and deletes NOTHING.** Deletion resumes only once
  attempts carry a reliable generation/reset-epoch tag (grading rework). Orphaned reviews are harmless to
  correctness in the interim (the anchor, not the review count, drives position).
- **Observability [V13]:** `csd_implausible` threshold seeding (`progressService.js:263-272`) reads a single
  class's pace — use the **launching** class's assignment and log the enrolled-class set instead of a single
  `classId`. Flood risk itself is resolved by list-scoping (anchorless now means genuinely anchorless).

### 5.2 Hydrate-on-miss, not read-fallback [V2 — blocker in v3]

v3 said "read `list_progress` with legacy fallback." But the primary read site **creates a fresh Day-0 doc
on miss** (`getOrCreateClassProgress`, `progressService.js:110-121` `setDoc(createClassProgress(...))`;
same in `updateClassProgress` `:426-435`), and reconciliation then rewrites only csd/twi (`:219-223`) — so a
straggler/quarantined student at flag-on gets **Day-0 forked** (anchorless) or loses
streak/`programStartDate`/`recentSessions` (anchored). And `reviewChallenge`'s `progressSnap.exists()` gate
(`db.js:2795`) would silently no-op the teacher's day-advance on a miss.

**One centralized resolver for EVERY path — reads included [C6-1]:** all progress access goes through a
single `resolveListProgress(uid, listId, launchClassId) → {mode: 'canonical'|'legacy'|'quarantined'|'none',
progressRef, data, sourceClassId?}`. v3.4 applied hydration only to the session/write paths — but
`getClassProgress` is a **pure read returning `null` on miss** (verified), so post-flip the Dashboard
(`Dashboard.jsx:651`) and teacher gradebook (`fetchStudentsProgressForClass`, `progressService.js:467`)
would show **Day 0 / no progress** for any un-migrated, not-yet-hydrated, or quarantined student. Contract:
- **Read paths** (`getClassProgress`, `fetchStudentsProgressForClass`, Dashboard, gradebook): resolve
  canonical → else compute the merged view from legacy docs **in memory, writing nothing** (no hydration
  from render paths) → else quarantine/none. Display always shows the student's real position.
- **Write paths** (`getOrCreateClassProgress`, `updateClassProgress`, `reviewChallenge`): resolve canonical
  → else **hydrate** (below) → else quarantine branch.

**Hydration rule:** when `list_progress/{listId}` is absent, **hydrate** it using the **unified merge rule
(§8 — identical for migration and hydration [C4-1]):** ancillary fields from the anchor-validated max-twi winner;
**TWI = max validated; CSD = max plausible across EVERY source doc** (not the winner's — the winner's CSD
can be lower cross-pace, and the runtime non-demoting rule cannot recover a value that was never stored);
`programStartDate` = min. **Create-fresh runs only when no legacy doc exists for any class on that list.**
Apply at `progressService.js:110`, `:426`, and the `reviewChallenge` read (`db.js:2795`). Hardening
requirements [C3-7, C4-4]:
- **Implementable transaction algorithm [C4-4]** (the Web SDK's `runTransaction` reads doc *references*,
  not queries):
  1. **Pre-query** all legacy candidates OUTSIDE the transaction (`users/{uid}/class_progress`
     `where('listId','==',listId)`) → candidate ref list.
  2. **In the transaction**, re-read the destination `list_progress/{listId}` AND every candidate by
     reference.
  3. **Recompute the merge from the transactional snapshots** (not the pre-query data).
  4. **Create only if the destination is still absent**; otherwise abort (another client hydrated first).
  (Alternative if this proves heavy client-side: a server callable that queries + hydrates transactionally.)
- **Enumerate ALL legacy docs, including dropped classes:** legacy `class_progress` docs carry a `listId`
  field (verified — `createClassProgress` stores `classId` + `listId` in the doc body), so the pre-query
  covers docs from classes the student has left — NOT just current enrollments. A student whose richest
  history sits under a dropped class (이주헌 pattern) must hydrate from it.
**Quarantine branch — resolve-before-flip, block as runtime backstop [C5-1 + C6-3 + C7-2]:** (History:
v3.3 contradicted itself on validated-vs-preserved values; v3.5 tried "pin to the launching class's legacy
doc" — rejected by C7-2 on two grounds, both accepted: it **perpetuates per-class divergence as an
operational mode**, contradicting the one-live-position goal; and it **has a hole** — the launching class
may have NO legacy doc (progress under dropped class A, student launches class B), where every fallback is
either ambiguity or the Day-0 fork. Continuing class-scoped progress is not an acceptable mode.)

The corrected contract, in two parts:
1. **Primary — the quarantine set is resolved to ZERO before the flag flips.** Phase 0 enumerates it;
   resolving every flagged doc (CS manual triage applying the §8 merge with human judgment) becomes a
   **hard Phase-4/Phase-5 precondition**. Expected set is near-zero (Phase 0 will confirm); this is
   bounded, scheduled work, not an ongoing mode.
2. **Runtime backstop — BLOCK, don't route.** If the resolver ever hits a quarantined state post-flip (a
   should-never-event: data corrupted after triage, or new suspect legacy data from a straggler bundle), it
   returns `{mode:'quarantined'}` and the app **blocks study on that list** with a "문의해 주세요 — contact
   your teacher" state, logging `list_progress_quarantined {uid, listId, reason}` (server-visible, CS
   responds same-day). Blocking is acceptable *because* of part 1: by flip time it only ever fires on
   genuine corruption, where continuing to write is worse than pausing.

**No hydration of suspect docs, ever** — only validated values enter `list_progress` automatically; nothing
suspect is zeroed or silently promoted. Same contract when every source doc is quarantined.

### 5.3 List-aware reset [V1 — blocker; v3 §7.3 was factually wrong]

v3 claimed `resetStudentProgress` already "deletes all attempts." **False:** the attempts delete is
**class-filtered** (`db.js:2960-2964` `where('classId','==',classId)` + testId parse), while the
`study_states` wipe is list-wide (`:2921-2923`). Under list-scoped reconciliation, a reset from Class A
leaves Class B's passed attempts alive → the next session **resurrects csd/twi from B's anchor onto a
student with zero mastery** (bidirectional trust path, `progressService.js:190-193`). Reset is silently
undone for exactly the multi-class students this plan serves.

**Fix (a *complete* wipe is self-distinguishing — completeness is the whole game):**
- Attempts delete becomes **list-wide across all classes** (`studentId + listId` — the same list-scoped
  query shape as §5.1).
- Delete **all** `session_states/{*}_{listId}`, not just the launching class's (`db.js:2911`).
- **Delete ALL legacy `class_progress` docs for the list too** (`where('listId','==',listId)`) [C3-3a]:
  during the transition window legacy docs still exist, and §5.2's hydrate-on-miss would otherwise
  *resurrect the reset progress from a surviving legacy doc* on the very next session. Reset and hydration
  must be mutually consistent.
- **Ordering:** delete attempts FIRST; if that partially fails, ABORT before wiping mastery/progress
  (otherwise partial deletion = partial resurrection).
- Keep the confirm dialog; label it "reset your progress on this list (all classes)."
- Real unenroll (`removeStudentFromClass` `db.js:394`) deletes no progress — correct, unchanged.
- **Residual race, documented [C3-3b → §13]:** an in-flight grading job can write an attempt seconds after
  the wipe (the student racing their own reset from another tab) → position resurrects from that attempt.
  Failure mode is visible (progress reappears) and recoverable (re-run reset). The clean fix is an epoch
  tombstone — which is exactly the grading rework's server-side `resetProgress` (RESUME P2 precondition #3);
  it lands there, not here (§13).
- **Coordination with the `#1c` lockdown track [F2, corrected per C5-5]:** client-side reset works because
  `firestore.rules` allows students to delete their own attempts ("for progress reset" — verbatim). The W3
  lockdown as currently specced **preserves** that permission (`PLAN_attempt_write_lockdown.md:91-92`,
  "reset — unchanged") — so there is **no present collision** (v3.3 wrongly claimed W3 removes it). The
  constraint activates only if/when reset moves server-side (grading rework `resetProgress`) and owner
  delete is finally removed — at that point the two changes must ship together. Standing note for whichever
  track gets there first.

### 5.4 Concurrent same-day guards [V5 — v3's §11-deferral note understated this]

Two classes with different paces starting the same uncompleted day introduce **different word ranges**
(`[base..base+80]` vs `[base..base+100]`); anchor-by-position then jumps the shared position past words seen
in only one class. This is a real (if rare) progress bug, not a cosmetic duplicate row. Cheap client guards,
no server machinery:
- **New-word serve guard:** before serving new words for day N, check list-wide for an existing passed `new`
  attempt for that day/position — if present, route to the review phase (join the day, don't re-introduce).
- **Stale-session day-guard:** on session-state restore, require `existingState.currentStudyDay ===
  config.dayNumber`, else drop the restored display state (scores/dismissed-ids) — today Day-9 leftovers
  bleed into a Day-11 session (`DailySessionFlow.jsx:751-785`).
- **Duplicate-day-guard rejection handling [V9]:** when `updateClassProgress` rejects a completion because
  reconciliation advanced the shared day mid-flight (`progressService.js:396-401` returns unchanged), force a
  session rebuild instead of silently returning — otherwise the student is stuck unable to complete.
- Accepted + documented: `recentSessions`/`streak` are last-write-wins-lossy under simultaneous completion
  (both writers `+1` from the same base so the **day cannot double-advance**; twi self-heals via anchor).
  A true cross-device transactional guarantee arrives with the grading rework (§11) — Phase 2 must NOT imply
  it exists before then [V14].

---

## 6. Implementation phases

**Phase 0 — Read-only audit. ✅ RUN 2026-07-04** — script `dsg-edits/srv_validate/list_progress_audit.mjs`,
full report `dsg-edits/srv_validate/list_progress_audit_2026-07-04.json`. Enumerates collision/dual-enroll/
twi-conflict sets, anchor-validates every doc's twi, screens CSDs against `implausibleStudyDayThreshold`
[C4-2]. **Results (all / 26SM):**
- 47 classes, 1112 `class_progress` docs, 766 students, 1043 (student,list) pairs.
- **Collision set (migration collapse): 69 / 62** — small, scriptable. Spreads confirm the day-reset bug at
  scale (e.g. `d1/t100 | d4/t400` — the moved-and-reset pattern).
- **Dual-enrolled: 61 / 54** — see the §13.1 correction; this is a real standing stock, not ≈zero.
- twi conflicts: 58 / 54.
- **TWI quarantine: 7 / 0 · CSD quarantine: 0 / 0 · anchorless-nonzero-twi: 63 / 0** →
  **QUARANTINE TOTAL 70 — every single one in EXTERNAL/legacy cohorts; the active 26SM cohort is
  quarantine-CLEAN.** The [C7-2] resolve-to-zero precondition is already satisfied for 26SM; the 70 ext
  items (legacy lists `7Is5UdS4`/`aRGjnGXd`/`8RMews2H`/`bTqQUs4x`, mostly pre-anchor-era data with no
  attempts) need a **scope decision** (§12-open): triage them, or exclude retired cohorts from migration
  and leave their legacy docs in place.
- Invalid-anchor passed-new attempts (sparse-index hazard V7): **26, all ext** — the §5.1 studyDay-fallback
  matters only for legacy cohorts.

**Phase 1 — List-scoped reconciliation (§5.1) + indexes.** Deploy the composite indexes FIRST [V7] —
**five total** (the four below + `getReviewForDay`'s [C4-5]):
- `attempts(studentId, listId, submittedAt DESC)`
- `attempts(studentId, listId, sessionType, studyDay, submittedAt DESC)`
- `attempts(studentId, listId, sessionType, submittedAt DESC)`
- `attempts(studentId, listId, sessionType, passed, newWordEndIndex DESC, submittedAt DESC)` [C5-3]
(None of the four exist in `firestore.indexes.json` — all current attempt indexes are classId-leading and
unusable once the filter drops. **`getReviewForDay` is NO LONGER all-equality [C4-5]:** the §5.1 pairing
rule adds a `submittedAt >= anchor.submittedAt` range, so it needs its own **class-inclusive** composite —
`attempts(studentId, classId, listId, sessionType, studyDay, submittedAt ASC)` (classId stays: it's the
anchor's class per the pairing rule) — queried `orderBy submittedAt ASC, limit(1)` = the earliest
post-anchor review, which is the lineage-correct selection.)
**Phase-1-alone is a deliberate early feature [V9] — but flag-gated [C3-9]:** with docs still class-keyed,
list-scoped bidirectional reconciliation carries position UP to the list-wide anchor at session entry — the
manual carry-forward, automated, demotion-safe (list-wide anchor ≥ any class anchor). Because this starts
writing cross-class reconciliation results derived from (today client-forgeable, `#1c`) attempts, it ships
behind its own flag (`LIST_SCOPED_RECON`, default off → on after validation) so rollback exists — not
always-on as v3.1 had it. Known interim artifacts, accepted + validated: the promoted class doc keeps its
fresh `programStartDate`/streak until migration (pacing badge off); Dashboard shows stale position until
first session entry (`getClassProgress` doesn't reconcile); both docs accumulate stats until collapsed. The
§5.4 guard-rejection handling ships here too.

**Phase 2 — `list_progress` behind flag `LIST_PROGRESS_PERSIST` (default off).**
- `getListProgressDocId(listId) => listId`; route the §3 surface; **hydrate-on-miss** per §5.2.
- **Acceptance gate [V10]:** not a literal grep — assert **zero non-helper references to the
  `class_progress` collection** (regex over `${classId}_`, `${classIdParam}_`, `${attemptData.classId}_`,
  and direct collection-path strings). The automarker and recovery keys are exempt (§3 not-surface list).
- §5.4 guards land here. Flag-off = LEGACY invariant test (identical doc ids; zero `list_progress` writes).

**Phase 3 — Firestore rules (§10).**

**Phase 4 — One-time migration (§8).** `--dry` → diff → `--commit`; sweep before/after; logged
(`system_logs` per student+list, `SUPPORT_RUNBOOK.md` CS entry, `change_action_log.md` row).
**Hard precondition for Phase 5 [C7-2]:** the Phase-0 quarantine set is manually resolved to ZERO (CS
triage per §5.2) — the flag does not flip while any student+list remains quarantined.

**Phase 5 — Flip + verify (§9), then retire legacy with a REAL write barrier [C4-3].** A stamp check /
forced-refresh is not a barrier — an old open bundle can write legacy again right after a catch-up pass.
Retirement sequence:
1. **Monitor** legacy writes (any legacy doc with `lastSessionAt > migratedAt`) until the rate is ~zero
   (old bundles expired) — repeat catch-up merges (§8) as needed during this window.
2. **Rules cutoff — by RESTRUCTURING the wildcard, not adding a deny match [C5-4]:** Firestore rules are a
   permissive union — a separate restrictive `class_progress` match **cannot** override the broad
   `/users/{userId}/{subcollection}/{docId}` write allowance (`firestore.rules:45-48`); this plan's own §10
   lineage states that principle. The cutoff must **condition the wildcard itself** to exclude
   `class_progress` from client writes (e.g. `allow write: if (isOwner || isTeacher) && subcollection !=
   'class_progress'`, or convert to an explicit subcollection allowlist). Deliberately not done earlier —
   flag-off bundles legitimately write legacy during the soak.
   **Old-client UX at the cutoff — current behavior does NOT surface it [C6-2, verified]:** the completion
   failure paths in BOTH test pages swallow errors — `TypedTest.jsx:1040-1042` `catch (completionErr) {
   console.error…; /* Don't fail the whole submit - attempt is already saved */ }` then shows results;
   MCQTest same pattern. v3.4's claim that the "existing save-failure modal" would surface a denied legacy
   write was WRONG: the student would see success, keep studying, and their day would never advance again —
   silently. And no server-visible event exists for it. Required (ships in Phase 2, activates at cutoff):
   - **Detect `permission-denied` specifically** in every post-attempt progress/completion catch —
     `TypedTest`, `MCQTest`, and every `DailySessionFlow` completion path (grep `completeSessionFromTest` +
     `updateClassProgress` callers).
   - On detection, show a **blocking "The app was updated — reload to continue"** state (not the results
     screen), since the attempt is safe but nothing further will persist.
   - Emit a dedicated **`legacy_write_denied`** `system_logs` event (server-visible monitoring signal —
     `console.error` is invisible to ops).
   - **Sequencing reality check [C7-1]: none of this retrofits into bundles that predate it.** A cached
     pre-Phase-2 bundle has neither the version gate nor the permission-denied handler — it will swallow
     the error exactly as today's code does, emit nothing, and show success. So the handler protects
     **gate-aware bundles only**; genuinely old bundles must be *gone*, not handled. Cutoff ordering:
     1. The **min-client-version gate ships in the Phase-2 release** (early — checked at session start),
        so it is deployed long before it is ever tightened.
     2. **Observe a concrete no-legacy-write window — stated honestly: this is evidence, not proof
        [C8-1].** Post-flip, any write to a legacy `class_progress` doc IS an old-bundle signal (flag-on
        bundles never write legacy). Cutoff criteria: (a) **zero legacy writes for 14 consecutive days**
        (covers all weekly class-schedule patterns in this cohort), AND (b) a **build-version census where
        available** — gate-aware bundles stamp their version into session-start logs, so active users
        resolving to known-good versions corroborates (pre-gate bundles are visible only by absence).
        **A dormant pre-gate tab can defeat both signals** — produce no writes during the window, then
        resume after cutoff and silently swallow the denied write (its swallow behavior is baked in).
     3. **Only then** deny `class_progress` writes (the wildcard restructure above). **Accepted residual
        [C8-1]:** a dormant pre-gate tab that wakes post-cutoff experiences **one false-success
        completion** — results screen shown, progress not advanced, no client signal. **Data integrity is
        carried by the rules cutoff, not the client** (the attempt is server-written; the denied legacy
        write changes nothing durable); **recovery is a reload** (any navigation/revisit loads the current
        bundle), and the stale tab is self-limiting — it re-serves the same frozen day until reloaded.
        Monitor denied-write counts server-side post-cutoff; a nonzero trickle is this residual, not a
        rollout failure.
   Treat a sustained `legacy_write_denied` spike as "old clients not yet expired — reopen step 2."
3. **Final catch-up pass** (now race-free behind the barrier), then delete legacy docs.
Catch-up merges are per-doc **transactions** so they cannot clobber a concurrent `list_progress` update
[C4-3]. Audit for `collectionGroup('class_progress')` consumers (none in-repo today [V15]).

**Phase 6 — List-aware reset (§5.3).** Can land with Phase 2 (it's client code behind the same flag).

---

## 7. Ripple checks

1. `reviewChallenge` (`db.js:2791/2813/2831`): route through the helper + hydrate-on-miss; its boundary guard
   compares the challenged attempt's `studyDay` to the shared counter (`:2807-2808`) — same cross-pace
   `studyDay` collision §5.1 fixes; apply the position/pairing logic or explicitly accept that a stale-day
   challenge no-ops the advance (safe direction) [V12]. Note `:2824` reads `interventionLevel` (§2.1).
2. blindSpot cache (`studyService.js:835/862`) — hardcoded, hand-edit.
3. Teacher reads: `fetchStudentsProgressForClass` (`progressService.js:467`) is helper-routed → OK;
   `ClassDetail.jsx:198` (progress) / **`:281` is `fetchStudentsSessionStates` (sessions — stays
   class-scoped)** [V17]; the real performance consumer is `PreviousSessionCell` `:955` → shows shared
   last-session per §2.1 (no code change; semantics accepted). `db.js:542` is a stale comment, not a read.
4. Pacing badge: per-enrollment view reading the viewing class's enrollment date (§2.2), not stored
   `programStartDate`. **All four consumer sites, so the conversion isn't partial [C5-6]:**
   `Dashboard.jsx:188-189` and `DailySessionFlow.jsx:1292-1293`, `:1334-1335`, `:1431-1432` — every one
   feeds `calculateExpectedStudyDay(programStartDate, studyDaysPerWeek)`.
5. Mid-session at migration: migrate students with no in-flight session, or rebuild on next entry.

---

## 8. Migration (one-time, backed up, idempotent)

Collapse legacy `{classId}_{listId}` docs → `list_progress/{listId}` per student+list, with the **unified
merge rule — identical to §5.2 hydration [C4-1]:**
- **TWI:** anchor-validated max `totalWordsIntroduced` (quarantine anchorless/forged highs — their
  terminal state is §5.2 hydration, preserved + flagged, never zeroed [V8]).
- **CSD = max PLAUSIBLE `currentStudyDay` across EVERY source doc** — NOT the max-twi winner's [C4-1].
  (v3.2 carried the winner's CSD; in the pace-80-Day-8 vs pace-20-Day-15 case that stores 8 and
  **permanently loses Day 15**, because the runtime non-demoting rule can only `max()` against what was
  stored.) "Plausible" = passes the [C4-2] screen below. Tie-break for the *ancillary* winner remains:
  max twi → max csd → newest `lastSessionAt`.
- **CSD corruption screen [C4-2]:** non-demoting CSD means a forged/corrupt CSD (999) would survive
  forever. Phase 0 therefore quarantines implausible CSDs too — any source CSD exceeding
  `implausibleStudyDayThreshold` (`studyTypes.js`, seeded from `programStartDate`/pace) or wildly exceeding
  its own doc's anchor-derived day + slack is EXCLUDED from the max and flagged for triage. Same rule in
  the §5.2 hydration merge.
- **§2.1 fields [V3]:** `interventionLevel`, `streakDays`, `recentSessions`, `stats` from the **winning
  doc** (lossy for the loser's history — accepted; the durable choices are these + `programStartDate`, since
  position self-heals but these do NOT — no attempt anchor exists for them [V8]).
- `programStartDate` = **min()** across sources (the student-level record; badge reads enrollment dates).
- **Drop** `progressSnapshot` / blindSpot.
- **Idempotency [V8]:** stamp `migratedAt` INTO each collapsed legacy doc; a re-run refuses any
  legacy doc already stamped, and compares **anchor-validated twi** (not wall-clock "newer") before ever
  overwriting an existing `list_progress`. A flag-off client writing a stamped legacy doc post-migration
  must not resurrect it.
- **Pre-retire catch-up merge [C3-4 — the stamp alone silently discards flag-off writes]:** a flag-off
  client can legitimately *advance* a stamped legacy doc between migration and its own cutover. Position
  self-heals (the completion also wrote a server attempt → anchor reconciliation), but the ancillary fields
  (`recentSessions`/`streak`/`interventionLevel`) have no anchor and would be silently discarded. So Phase 5,
  BEFORE deleting legacy docs, runs a **catch-up pass**: any legacy doc with `lastSessionAt > migratedAt`
  gets its ancillary deltas merged into `list_progress` (recentSessions union-by-date; streak/intervention
  from the newer doc). This is Codex-3's "migrate → catch-up" step adopted without the full 5-mode
  shadow-write machinery — position never needed shadowing (attempts are the ledger), only the
  anchor-less ancillary fields do, and a terminal catch-up covers them.
- Back up every source doc → `dsg-edits/srv_validate/list_progress_backups/{uid}_{listId}.json`.

---

## 9. Validation

- **Reconciliation:** same anchor resolved from either class; pairing rules — review paired to the anchor's
  class (cross-pace mixed history does NOT pair a wrong Day-N review, and legit slower-pace reviews are NOT
  deleted by orphan cleanup [V6]); anchor null-`newWordEndIndex` fallback works.
- **Move persona (이주헌/손진욱):** Day 8 in A → move to B → position persists, quota/threshold = B's.
- **Dual-enroll persona (박주하):** studying under either class advances the one record; no ping-pong.
- **Same-day concurrency [V5]:** two classes/tabs, different paces, same uncompleted day → second session
  joins the day (review phase), no double-introduction, no position jump.
- **Stale session:** return to old class after advancing elsewhere → day-guard drops stale display state;
  completion under a stale in-flight day → guard rejection forces session rebuild (student never stuck) [V9].
- **Reset [V1]:** multi-enrolled student resets from class A → position does NOT resurrect from class B's
  attempts; mastery + attempts + all session docs gone; unenroll→re-enroll keeps progress.
- **Hydration [V2]:** un-migrated student at flag-on → full legacy doc hydrated (streak/startDate intact),
  NOT Day-0-forked; **two tabs hydrating concurrently → exactly one winner (the §5.2 create-if-absent
  transaction), no clobber [F4]**.
- **Quarantine [C7-2]:** pre-flip — quarantine set enumerated and resolved to zero (Phase-5 precondition
  verified); post-flip backstop — a synthetically quarantined doc BLOCKS study with the contact-teacher
  state and emits `list_progress_quarantined` (no legacy routing, no fresh doc, no silent continue).
- **Mixed bundles [V8]:** flag-off client writing legacy post-migration does not resurrect on re-run.
- **Phase-1-alone artifacts [V9]:** carry-forward at session entry verified; pacing-badge/streak interim
  divergence observed and bounded; Dashboard staleness until first entry noted.
- **Teacher view:** shared position + shared last-session cell render as designed (§2.1).
- **Launching-class policy:** selected class == launch `classId`; session pace/threshold = that class's.
- **Data:** sweep clean before/after; 0 twi regressions. **Regression:** LEGACY invariant test.

---

## 10. Firestore rules

- Teacher/student direct-doc reads and writes of `list_progress` are already covered by the wildcard
  subcollection rule (`firestore.rules:45-48`) — `fetchStudentsProgressForClass` needs **no** new rule.
- **Teacher-visibility authorization, stated precisely [C4-6]:** §2.1's product statement ("teachers who
  assign the list see progress") is narrower than what the wildcard rule enforces (**any** teacher account
  can read **any** student's subcollections — pre-existing, `firestore.rules:45-48` + the rules:39-44 TODO).
  **Accepted as-is for now:** within a single-academy trust domain all teachers are colleagues, and this
  plan does not widen the rule — it inherits it. Enforcing a real class/list/student relationship (rules
  `get()` checks or a server read API) belongs to the `#1b` role/rules-tightening track, where it applies to
  every subcollection, not just this one. Documented so the §2.1 wording is not mistaken for an enforced
  boundary.
- The `class_progress` collection-group rule (`firestore.rules:27-29`) has **no in-repo consumer** [V15];
  add a `list_progress` mirror **only if** an out-of-repo admin tool actually issues
  `collectionGroup('list_progress')` — verify with the owner rather than cargo-culting the rule.
- **Sequencing (David, Option B):** ship on the current client-writable footing; the `#1c`/`#1b`
  attempt-write lockdown + role tightening land as a parallel high-priority track. Accepted risk: the
  pre-existing forgeability now reaches the student list-wide (single source of truth) instead of per-class.
  Re-narrow when server-owned writes land.

---

## 11. Cross-plan touch — grading session key (DEFERRED, with two coupling notes)

Deferred to the grading rework (David): drop `classId` from
`test_sessions/{uid}_{classId}_{listId}_day…_e${resetEpoch}` so two classes sharing a list cannot
double-grade one list-day. Two couplings the rework must honor [V14]:
1. The grading plan's `resetEpoch` is **scoped on the `class_progress`/session doc** (grading plan :252) —
   it must rebase onto `list_progress` once this plan lands.
2. Until §11 lands there is **no cross-device transactional guarantee** — this plan's §5.4 guards narrow the
   window client-side but do not close it; Phase 2 must not claim otherwise.
Interim exposure after §5.4 guards: bounded to a duplicate attempt row (the position jump is closed by the
serve guard).

---

## 12. Decisions — all settled (David, 2026-07-04)

Principle (student-owned; class = access + quota) · teacher visibility = shared truth incl. shared
last-session cell (§2.1) · day = session count; pacing badge per-enrollment (§2.2) · policy bundle follows
the launching class, `passed` is submit-time-class (§2.3) · §11 deferred to grading rework · Option B
sequencing vs `#1c` (§10) · `getPrimaryFocus` de-scoped (nice-to-haves #3b) · no claim/epoch machinery here
(Appendix A + §13). **Nothing gates Phase 1** (behind its own flag, [C3-9]).

---

## 13. Residual concurrency races — accepted-risk inventory (Codex-3 findings 1/2/3b)

Codex round 3 re-demanded three server primitives: a list-day claim (start-time race), server-transactional
advancement (last-write-wins), and a `resetEpoch` (reset vs in-flight submission). **These are real races.
They are consciously NOT built here** — they are exactly the grading rework's Phase-2 substrate
(`PLAN_grading_idempotent_concurrency.md` §3: `startTest`/generation, finalize effect ledger with
"day-advance idempotent," server `resetProgress` with epoch tombstone), which David deferred; building them
twice, or building them here first, inverts the ownership.

### 13.1 Why deferral is the right call AT THIS APP'S SCALE (decision rationale, David 2026-07-04)

This is a risk-priced decision, not an oversight. The reasoning, so a future reader (or reviewer) doesn't
mistake it for corner-cutting:

- **Incidence math — CORRECTED by Phase-0 data (2026-07-04).** These races require the *same student*
  running *two simultaneous live sessions* on the *same list and day* under *two classes with different
  paces*. The original rationale claimed dual-enrollment was "transient, ≈zero" — **the Phase-0 audit
  measured a standing stock of 54 dual-enrolled (student,list) pairs in 26SM** (mostly moved-but-not-dropped
  leftovers — the 박주하 pattern at scale, i.e. this plan's beneficiaries, not schedule-driven true dual
  attendance). The race exposure base is therefore real, not zero — but the race still additionally requires
  *simultaneous* live sessions on the *same uncompleted day*, which the CS log has never recorded, and the
  **§5.4 serve guard closes the common sequential path**. Consequence: the §5.4 guards are load-bearing
  (not optional polish), and the migration itself shrinks the exposed set toward zero by collapsing the 54
  into single positions. Every class-change ticket to date was a data-model/config issue — which is what
  this plan fixes.
- **Where concurrency HAS bitten — and where the primitives are being built.** The grading pipeline: every
  student submits daily on flaky mobile webviews (06-22 incident: 313 failures / 21 students; lost-response
  re-grade loops; double-submits). That is hundreds of daily concurrency opportunities vs. a dual-enrolled
  edge case — so the claim/txn/epoch machinery lives in the grading rework (Phase 1a already live +
  validated), where the incident data says it pays. The architecture is not being skipped; it is being
  placed where it's earned.
- **The bigger real risk at this scale is forgery, not races.** A §13 race needs improbable coincidences; a
  `#1c` exploit needs one motivated student with devtools writing `{passed:true}` — and recurs silently once
  discovered. That's why the Option-B **parallel lockdown track** (`PLAN_attempt_write_lockdown.md`)
  outranks these races in priority.
- **Complexity budget.** One owner-developer deploying manually from a working tree, no CI, client-side
  flags. Every server primitive is permanent deploy/ops surface for a two-person operation; unneeded
  machinery is where the next incident comes from. At a multi-tenant SaaS this machinery is table stakes —
  here it is a liability until earned.
- **Flip conditions — revisit this section if ANY of these occur:** multi-academy / SaaS; ~10× students;
  self-serve teachers outside the known cohort; or the **first genuinely race-shaped CS ticket**. The
  upgrade path is a sequencing change, not a redesign: build grading-rework Phase 2 first (with the §11
  list-scoped key), and this plan rides it — §13.2's table is that rework's acceptance checklist.

### 13.2 The races themselves — verified damage bounds

What makes deferral defensible is that the damage is bounded and self-healing, on verified mechanics:

**Why the damage is bounded (verified, not asserted):**
1. **Attempts are the ledger; the progress doc is a reconciled cache.** Attempts are server-written; every
   session init reconciles the doc from the anchor BEFORE building the session
   (`initializeDailySession` → `getOrCreateClassProgress`, `studyService.js:157`). A racy doc value is
   display-only until the next init.
2. **Skipped words are not lost.** `getUnmasteredPool` (`studyService.js:373-395`) is **position-based**:
   every list word with `position < twi` and no MASTERED study_state enters the review pool — including
   words never actually presented. A position jump past unseen words converts them into review material; it
   does not skip them permanently.
3. **The day counter cannot double-advance** — concurrent completers both write `+1` from the same read
   base (`progressService.js:415`); last-write-wins converges to the same value.

**The inventory (worst cases, all rare — require the same student in two simultaneous live sessions or
racing their own reset):**

| Race | Worst case | Repair |
|---|---|---|
| [C3-1] Two classes start the same uncompleted day before either passes (serve guard §5.4 sees nothing) | Different paces allocate different ranges from one base; both finish; anchor takes the larger → the delta range (~pace difference, e.g. 20 words) gets one exposure instead of the full new-word flow; duplicate attempt row for the day | Under-exposed words return via the unmastered pool (#2); duplicate row is cosmetic + class-tagged; closed for good by the list-scoped `startTest` (§11 / grading rework) |
| [C3-2] Simultaneous completions, non-transactional `updateClassProgress` | One completion's `recentSessions`/streak entry lost (last-write-wins); twi briefly wrong on the doc | twi re-derived from the anchor at next init (#1); ancillary loss = one session's stats; closed by the grading rework's transactional finalize |
| [C3-3b] In-flight grading job writes an attempt seconds after a reset wipe | Reset visibly "doesn't take" (position resurrects from the straggler attempt) | Re-run reset; closed by the server-side epoch-tombstoned `resetProgress` (grading rework) |

**Standing instruction:** when the grading rework Phase 2 lands, this table is its acceptance checklist —
the list-scoped session key must be `{uid}_{listId}_…` (§11), the finalize ledger owns day-advance, and
`resetProgress` epoch-tombstones list-wide. Until then, §5.4's client guards narrow (not close) these
windows, and this plan must not claim otherwise. If a §13.1 flip condition fires, re-open this section
before scaling — not after.

---

## Appendix A — v1/v2 audit lineage (why the server-claim architecture was dropped)

v1/v2 (3-agent + Codex ×2) audited a design that kept shared position AND per-class progress semantics —
that genuinely required a server-owned list-day claim, resetEpoch scoping, one-transaction advancement, and
a 5-mode rollout (Codex R1-R10). David's principle removed class-scoped progress state, so inter-class
arbitration has nothing to arbitrate. Findings that survived are folded in: list-scoped reconciliation +
anchor-by-position (→§5.1), stored-counter CSD (→§2.2), the full composition surface (→§3), reset semantics
(→§5.3), migration field rules (→§8), rules notes (→§10), grading-key convergence (→§11).

**v3 re-audit (v3.1):** 3 fresh reviewers + orchestrator self-pass verified which v1/v2 drops were
truly dissolved. Verdicts: canonical-claim R1/R2-as-substrate DISSOLVED (sequential cross-class switch works:
`determineStartingPhase` resolves list-wide, `studyService.js:93-101`; day counter converges, twi
self-heals); resetEpoch R4 DISSOLVED contingent on §5.3; session-semantics PARTIAL → §5.4 guards;
rollout R5/R6 PARTIAL → hydrate-on-miss + `migratedAt` sentinel + retire-time write-freeze (§5.2/§8);
reset R10 STILL BIT → §5.3. Plus new: field-disposition contradiction (→§2.1), review/gate pairing rules
(→§5.1), orphan-cleanup data-loss (→§5.1), index enumeration + sparse hazard (→§6 P1), automarker
miscategorization (→§3), grep-gate pattern (→§6 P2).

**Codex round 3 (v3.2):** re-demanded the claim/txn/epoch primitives (findings 1/2/3b) and found five
concrete gaps. Accepted + fixed: reset-hydration resurrection [C3-3a →§5.3], migration catch-up merge
[C3-4 →§8], CSD merge rule contradiction [C3-5 →§5.1], review-pairing temporal lineage + discriminated
`getReviewForDay` status [C3-6 →§5.1], transactional + dropped-class-aware hydration [C3-7 →§5.2], Phase-1
flag-gating [C3-9 →§6 P1]. Findings 1/2/3b: NOT restored — see §13 for the verified damage bounds and the
explicit hand-off to the grading rework, which owns those primitives. Finding 8 (rules/roles) is the settled
Option-B decision (§10), tracked as the parallel `#1b`/`#1c` lockdown, not re-litigated here.

**Codex round 8 (v3.7) — AUDIT-CLEAN:** verdict "architecture-ready"; quarantine, centralized reads,
hydration, migration, cutoff ordering all confirmed coherent. One medium fixed [C8-1]: "pre-gate bundles
expired from telemetry" was unprovable (a dormant tab writes nothing during monitoring, then resumes
post-cutoff and silently swallows the denial). Corrected to: concrete 14-day no-legacy-write window +
build-version census (evidence, not proof), explicit accepted residual of one false-success completion per
dormant tab, integrity carried by the rules cutoff, recovery = reload (→§6 P5).

**Codex round 7 (v3.6):** [C7-1] the v3.5 cutoff assumed the permission-denied handler/version gate could
protect old bundles — but cached pre-Phase-2 bundles contain neither; corrected sequencing: gate ships early
(Phase-2 release), cutoff waits for pre-gate bundles to expire (post-flip legacy writes are the detector),
then denies (→§6 P5). [C7-2] v3.5's quarantine continue-on-legacy routing withdrawn — it kept per-class
divergence alive as an operational mode (contradicting one-live-position) and had a hole (launching class
with no legacy doc); corrected: quarantine set resolved to ZERO as a hard pre-flip precondition, runtime
backstop BLOCKS study with a contact-teacher state (→§5.2, §6 P4).

**Codex round 6 (v3.5):** [C6-1] hydration/fallback was write-path-only — `getClassProgress` is a pure
null-on-miss read (verified), so Dashboard + `fetchStudentsProgressForClass` would show Day 0/no-progress
post-flip for un-migrated/lazy/quarantined students → centralized `resolveListProgress` resolver, reads
fall back in-memory (no writes from render paths), writes hydrate (→§5.2). [C6-2] v3.4's cutoff UX claim
was factually wrong — completion failures are console-swallowed (`TypedTest.jsx:1040-1042`, MCQTest same;
verified), no modal, no observable event → permission-denied detection in every completion path, blocking
reload state, `legacy_write_denied` system_logs event, min-client-version gate preferred (→§6 P5).
[C6-3] quarantine operational contract made precise — deterministic `{mode, sourceClassId, progressRef}`
pinned to the launching class's legacy doc (status-quo per-class semantics; blocking documented as the
safer alternative if David prefers) (→§5.2).

**Codex round 5 (v3.4) — zero blockers:** [C5-1] explicit quarantine branch — suspect docs never hydrate;
read-through legacy + `list_progress_quarantined` log until CS resolves (fixes v3.3's validated-TWI vs
preserved-stored-values contradiction, →§5.2); [C5-2] orphan cleanup log-only during mixed history — even
same-class history can be invalid (pace change, pre-reset) so the classId restriction was insufficient
(→§5.1); [C5-3] anchor tie-break `newWordEndIndex DESC, submittedAt DESC` + index update (→§5.1/§6 P1);
[C5-4] Phase-5 cutoff must restructure the wildcard rule (additive deny can't override — the plan's own §10
principle) + old-client permission-denied UX defined (→§6 P5); [C5-5] W3 note corrected — the lockdown
preserves owner attempt-delete (`PLAN_attempt_write_lockdown.md:91-92`), no present collision (→§5.3);
[C5-6] pacing-badge consumers enumerated: Dashboard.jsx:188 + DailySessionFlow.jsx:1292/1334/1431 (→§7.4).

**Codex round 4 (v3.3) — convergence:** accepted §13 (stopped re-reporting the deferred races); verdict
"implementable under the explicitly accepted §13 risks" after six internal-consistency fixes, all applied:
[C4-1] unified merge rule at migration AND hydration (CSD = max plausible across ALL sources — v3.2 fixed
only the runtime layer, which would have permanently lost Day 15 in the plan's own cross-pace example,
→§5.2/§8); [C4-2] CSD corruption screen in Phase 0 (non-demoting CSD must not immortalize a forged 999,
→§6 P0/§8); [C4-3] real cutover barrier — monitor → rules-deny legacy writes → final transactional catch-up
→ delete (a stamp check is not a write barrier, →§6 P5); [C4-4] implementable 4-step hydration transaction
(Web SDK txns read refs, not queries, →§5.2); [C4-5] `getReviewForDay`'s temporal pairing makes it a range
query → its own class-inclusive composite index (→§6 P1); [C4-6] teacher-visibility authorization stated
precisely — global-teacher read is pre-existing and accepted within the single-academy trust domain,
enforcement belongs to `#1b` (→§10).
