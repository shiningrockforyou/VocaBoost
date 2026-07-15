# DEEPFIX Task 3 — P9 (CYC) implementation notes

> **Round 2 (2026-07-14):** folded Codex round-1 fixes P9-1..P9-4 (§Codex round 1 → round 2 below).
> **Round 3 (2026-07-14):** folded Codex round-2 fixes P9-5..P9-7 (§Codex round 2 → round 3 below) —
> the cross-class predicate is now consistent on the SERVER (foundation.js) and the Dashboard yield;
> the ClassDetail teacher-view boundary limitation is documented. Double-gate + flag-off byte-equivalence
> preserved and re-measured all three rounds.

**Date:** 2026-07-13 (round 1) · 2026-07-14 (rounds 2–3). **Scope:** FIX_PLAN Phase P9 · CYC — per-student list cycling ("start over"),
per `docs/plans/loop/x/plan.md` v5. REAL code, **LOCAL-ONLY** — no git commit, no branch, no deploy,
no live-Firebase call. Everything is DOUBLE-gated: the NEW global build flag `CYCLING_ENABLED`
(**default OFF**, `src/config/featureFlags.js`) AND the per-assignment `cyclingEnabled` field. With
`CYCLING_ENABLED === false` every touched path short-circuits to today's exact behavior
(byte-equivalent; proven by the reconstructed before/after eslint parity below).

**Verification stance (David, verbatim):** "always verify all claims… Never trust blindly. Always
verify." Every cite below was traced to the working-tree `file:line` BEFORE editing; every changed file
was parse-checked after; the eslint delta was measured against a **reconstructed pre-P9 baseline** (not
just HEAD — the tree carries the uncommitted P3–P8 stack; HEAD predates even P4).

**Baseline note (verified):** the session's git snapshot claiming "clean" is stale. `git status` shows
the working tree carries the uncommitted P3/P4/P5/P6/P8 deepfix stack (`HEAD` = commit before P4 —
`featureFlags.js` at HEAD has neither `SERVER_PROGRESS_WRITE` nor `CYCLING_ENABLED`). `functions/foundation.js`
is **untracked** (created by P3, uncommitted). So a plain `git diff HEAD` is NOT a P9-only diff; the
delivered `phase9_diff.patch` is a **reconstructed pre-P9 → after diff** (see §Validation).

---

## Codex round 1 → round 2 (per-finding response)

- **P9-1 (BLOCKER) — cyclingEnabled never threaded into `initializeDailySession` → cycling dead.** FIXED,
  and better than "thread into every call site": `initializeDailySession` now SELF-RESOLVES the effective
  cycling capability from `(userId, listId)` via `resolveEffectiveCycling` — the single choke point every
  caller (DailySessionFlow, MCQTest, TypedTest, PDF + debug helpers) flows through. The callers' curated
  settings object is no longer relied on for cycling, so ALL paths activate at once. The M-STATIC harness
  (`p9_assert.mjs`) asserts Codex's exact check: with the flag on + a class assigning the list with cycling,
  `cyclingActive === true`, `newWordCount > 0`, `isListComplete === false` for a FINISHED list. `isCyclingActive`
  (the old single-assignment gate) was REMOVED.
- **P9-2 (HIGH) — §3b cross-class unlock missing.** IMPLEMENTED. `deriveEffectiveCycling(studentClasses, listId)`
  (pure) unlocks cycling iff ANY enrolled class assigns the list with `cyclingEnabled:true`, returning the source
  class. `resolveEffectiveCycling(userId, listId)` (session path) uses the EXISTING `fetchStudentClasses` helper
  (not a raw re-query), fails closed on read error. Used in session init AND the Dashboard (in-memory over
  `studentClasses`). The "cycling enabled via {className}" affordance is surfaced in the session lap-badge and the
  Dashboard hero chip. ClassDetail (teacher view — no cheap cross-class-per-student data) uses the class's own
  flag OR the data-derived `twi > cycleLength` "demonstrably cycling" signal, which catches cross-class cyclers.
- **P9-3 (HIGH) — cycleLength must be positions.length, not wordCount.** FIXED. New `getCycleLength(listId)`
  returns `positions.length` via a cheap `getCountFromServer(query(words, orderBy('position')))` — the SAME
  ordered-positions population `resolveVirtualRange` wraps on. Used for the review lap-bound, failed-carryover
  bound, session `lapView`, AND the Dashboard/ClassDetail display denominators (loaded into a `cycleLengths` map
  per cycling list; `wordCount` is only a transient fallback while the aggregate count is in flight). `wordCount`
  is no longer the modulus anywhere in the cycling math. (Aside, verified for the notes: `wordCount` is in fact
  maintained `=== positions.length` by `increment(±1)` at db.js:598/642/734 — but per Codex we no longer rely on
  that for the modulus.)
- **P9-4 (MED) — TypedTest standalone not lap-aware.** FIXED. `TypedTest.jsx` init now self-resolves cycling
  (via the shared init change) and its `getNewWords(...)` passes `config.cyclingActive` — identical to MCQ.

---

## Codex round 2 → round 3 (per-finding response)

- **P9-5 (BLOCKER) — cross-class cycling was CLIENT-ONLY; server checked only the launching class.** FIXED.
  New `functions/foundation.js` `resolveEffectiveCyclingServer(studentId, listId)` (Admin SDK) mirrors the client
  `deriveEffectiveCycling` EXACTLY: it reads the student's `users/{uid}.enrolledClasses` keys (the SAME source
  `fetchStudentClasses` reads on the client), batch-reads those class docs via `getDb().getAll(...)`, and unlocks
  iff ANY has `assignments[listId].cyclingEnabled === true`. It is resolved as a PRE-transaction read and threaded
  into all three legs — `validateAttemptAnchorShadow` (M4), `completeSession`, `advanceForChallenge` — REPLACING
  the launching-class-only `cyclingAllowed(assignment)` (which was removed). The global `CYCLING_ENABLED`
  short-circuit is FIRST → flag-off returns not-cycling with NO read (byte-equivalent, zero added reads); fails
  closed on read error. Harness adds the P9-5 case: class A enables + class B launches ⇒ client === server ===
  enabled ⇒ both advance virtual TWI by pace, M4 `introducedCount ≤ allowedIntroduced` (no `anchor_rejected`), no
  zeroing. Parity is exact because both sides evaluate the identical predicate over the identical `enrolledClasses`
  set (so the server is never less NOR more permissive than the client — avoiding both false-reject and
  server-over-advance).
- **P9-6 (HIGH) — Dashboard continuation-yield used current-class cycling.** FIXED. `resolveContinuation` now
  breaks (never auto-yields) on `CYCLING_ENABLED && deriveEffectiveCycling(studentClasses, current.id).enabled`
  (the cross-class §3b unlock), inside the `CYCLING_ENABLED` branch. Flag-off ⇒ the effective check never runs and
  the pre-existing P8 field-check behavior (`cyclingEnabled` never written when off ⇒ no break) is preserved →
  byte-equivalent for "today" (no `cyclingEnabled` field exists).
- **P9-7 (MED) — ClassDetail exact-boundary proxy false-negative — DOCUMENTED (accepted).** The teacher grid has
  no cheap per-student cross-class data, so it keeps the strict `list.cyclingEnabled || twi > cycleLength` proxy
  (`>` deliberately avoids false-positives on a normal finished list where `twi === cycleLength`). An explicit
  KNOWN-LIMITATION comment (ClassDetail.jsx) now states that a cross-class-only cycler shows ordinary finished
  progress at the EXACT first boundary until lap 2 begins, and that the student's OWN session/dashboard uses the
  true cross-class predicate. No per-student cross-class query added to the roster grid.

---

## What changed, per file

### `src/config/featureFlags.js`
- Added `export const CYCLING_ENABLED = false;` with a dormant-draft comment matching `SERVER_PROGRESS_WRITE`
  etc. This is the **global hard gate** (x/plan §3g enforced in code): cap removal cannot run in this tree
  until the flag flips at ship, after the foundation deploys.

### `src/services/studyService.js` (the core; +252/−23)
- **Primitives (new exports):**
  - `deriveEffectiveCycling(studentClasses, listId)` → PURE §3b unlock: `{ enabled, sourceClassId, sourceClassName }`,
    true iff ANY enrolled class assigns the list with `cyclingEnabled:true` (first such class surfaced).
  - `resolveEffectiveCycling(userId, listId)` → async session-path resolver: short-circuits (no read) when
    `!CYCLING_ENABLED`; else `fetchStudentClasses(userId)` → `deriveEffectiveCycling`; fails closed on error.
  - `getCycleLength(listId)` → CANONICAL `positions.length` via `getCountFromServer(query(words, orderBy position))`
    (cheap aggregate; the SAME population `resolveVirtualRange` wraps). Returns 0 on error → legacy fallback.
  - `computeCyclingAllocation(allocationNewWords, wordsRemaining, cyclingActive)` → PURE §3f allocation
    (extracted so the harness can assert cap-removal + byte-equivalence): cycling → `max(0, allocationNewWords)`;
    else → today's exact `Math.min(allocationNewWords, wordsRemaining)`.
  - `computeLapView(twi, cycleLength)` → pure `{ lap, numer, denom, pct }` (§3e). Boundary rule: at
    `twi = k·cycleLength` shows 100% of lap k. `null` when `cycleLength<=0`.
  - `resolveVirtualRange(listId, virtualStart, count)` → THE one resolver (§3c), `cycleLength := positions.length`,
    wraps `positions[((v%cl)+cl)%cl]` in virtual order. Same raw-doc shape as `getNewWords`.
- **`initializeDailySession`** (the single choke point — Codex P9-1): resolves the EFFECTIVE cross-class cycling
  capability (`resolveEffectiveCycling`, no read when flag off) and the CANONICAL `cycleLength` (`getCycleLength`,
  positions.length) — NOT from the caller's curated settings object. Threads `{cycling, cycleLength}` into
  `getUnmasteredPool`, removes the cap via `computeCyclingAllocation`, sets
  `isListComplete: cyclingActive ? false : (wordsRemaining <= 0)`, and returns
  `cyclingActive`/`cycleLength`/`lapView`/`cyclingSourceClassId`/`cyclingSourceClassName`. Every else-arm is
  today's exact expression; flag-off issues NO extra read.
- **`getUnmasteredPool`:** new `options={cycling,cycleLength}`; lap-bounds the review pool to physical
  `[0, twi mod cycleLength)` (the SINGLE review mechanism, §3d — masteredAt/returnAt batch-clear DROPPED).
  Flag-off ⇒ `boundExclusive === totalWordsIntroduced` ⇒ identical early-return + query.
- **`getNewWords`:** new 4th param `cycling=false`; when true delegates to `resolveVirtualRange` (single
  resolver). All legacy callers pass 3 args ⇒ byte-equivalent.
- **`getFailedFromPreviousNewWords`:** new `options={cycling,cycleLength}`; lap-bounds the carryover to
  `[0, twi mod cycleLength)`. Flag-off ⇒ identical bound.
- **PDF helpers** (`getTodaysBatchForPDF`/`getCompleteBatchForPDF`): pass `config.cyclingActive`/`cycleLength`
  to `getNewWords`/`getFailedFromPreviousNewWords`. (PDF print-order still sorts by physical position — see U9.)

### `src/services/db.js`
- Imported `CYCLING_ENABLED`; added the `cyclingEnabled` write branch in `updateAssignmentSettings`
  (owner-teacher-only, same trust surface as `pace`/`nextListId`), **only persisted when the global flag is
  on** (spread-conditional pattern identical to P8's `nextListId`). Flag-off ⇒ key never written ⇒ save
  byte-identical. The anchor query (§3a) is UNTOUCHED — verified.

### `functions/foundation.js` (server, dormant)
- Added a server-side `CYCLING_ENABLED = false` to `FOUNDATION_FLAGS` (mirrors the client flag) + (round 3)
  `resolveEffectiveCyclingServer(studentId, listId)` — the Admin-SDK EFFECTIVE cross-class resolver mirroring the
  client `deriveEffectiveCycling` (reads `enrolledClasses` + batched class docs; global short-circuit first, fails
  closed). The launching-class-only `cyclingAllowed(assignment)` helper was REMOVED.
- All three legs now use the EFFECTIVE (student+list, cross-class) result — resolved via `resolveEffectiveCyclingServer`
  (pre-transaction for `completeSession`/`advanceForChallenge`, inline for M4):
  - **M4 `validateAttemptAnchorShadow` (FIX_PLAN P9 integration point):** the `wordsRemaining` clamp is lap-modular
    — under cycling `allowedIntroduced = max(0, allocNew)` (no cap), so a lap-2 (incl. cross-class) day is NOT
    `introduced_over_allocation`-rejected. Other M4 legs are lap-safe as-is.
  - **`completeSession`:** `isListComplete` false under cycling; `serverNewWordCount = cycling ? max(0,allocNew) :
    min(allocNew,wordsRemaining)` — parity with the client allocation.
  - **`advanceForChallenge`:** the same lap-modular clamp; the `phase==='new'` twi gate is UNCHANGED.
- Flag-off ⇒ `resolveEffectiveCyclingServer` short-circuits (no read) ⇒ all three legs are today's exact clamps.

### `src/pages/DailySessionFlow.jsx`
- `getNewWords(..., config.cyclingActive)` at the new-words load.
- Inline **"Lap N" badge** below the header during study phases (§3f ack; gated on `sessionConfig.cyclingActive`).
  Now shows the **"cycling enabled via {className}"** affordance (§3b) when the source class ≠ the launching class.
- `lapDisplayNewIndex()` makes the test-header/progress-sheet **new-word ranges** lap-local; review indices unchanged.
- Capability-gated **"Start over"** in the P8 `CompletePhase` terminal (`cyclingCapabilityLive`/`onStartOver`,
  gated on `CYCLING_ENABLED`; re-enters the session — no progress write). Never renders today (see U8).

### `src/pages/MCQTest.jsx` / `src/pages/TypedTest.jsx` (P9-4)
- Both standalone new-word fetches pass `config.cyclingActive` (now correctly resolved cross-class inside init);
  under cycling `newWordCount===pace>0` so the legacy `throw 'No new words available…'` is unreachable (lap-aware
  outcome). Flag-off ⇒ legacy filter + throw exactly.

### `src/pages/Dashboard.jsx`
- `buildFocus` exposes the EFFECTIVE cross-class `cyclingEnabled` + `cyclingSourceClassName` (derived in-memory
  over `studentClasses` — no query, §3b). A `cycleLengths` state + a gated loader effect fetch the CANONICAL
  `positions.length` (`getCycleLength`) for the student's effective-cycling lists. Hero `focusLapView` +
  per-list `cardLapView` use that canonical modulus (wordCount only as a transient fallback) and the effective
  flag; `listFinished` is suppressed under cycling; the hero shows a **"Lap N · via {className}"** chip. Flag-off
  ⇒ no effect/state/read ⇒ today's exact values.
- **(round 3, P9-6)** `resolveContinuation` no longer auto-yields an EFFECTIVELY-cycling finished list — the
  yield-break is gated on `CYCLING_ENABLED && deriveEffectiveCycling(studentClasses, current.id).enabled`
  (cross-class), replacing the launching-class-only `assignment.cyclingEnabled` check. Flag-off unchanged.

### `src/pages/ClassDetail.jsx`
- Imported `getCycleLength`. A `cycleLengths` state + gated loader effect fetch the canonical modulus for the
  class's assigned lists. `StudentProgressCell` renders lap-aware when `list.cyclingEnabled` OR the data signal
  `twi > cycleLength` (catches cross-class cyclers a teacher view can't otherwise resolve), against the canonical
  cycleLength. `loadAssignedLists`/`settingsForm`/`handleSaveSettings` carry `cyclingEnabled`; the gated **"List
  Cycling" toggle** stays. **(round 3, P9-7)** an explicit KNOWN-LIMITATION comment documents the exact-first-boundary
  (`twi === cycleLength`) false-negative for cross-class-only cyclers (the strict `>` avoids false-positives on
  normal finished lists). Flag-off ⇒ inert (no effect/read).

### `src/components/SessionSummaryCard.jsx`
- Shows `(twi mod cycleLength)/cycleLength` + "Lap N" under cycling, using the now-CANONICAL
  `sessionConfig.cycleLength` (positions.length). Flag-off ⇒ today's exact `twi / total`.

---

## Design decisions

1. **Monotonic virtual index (x/plan §2), NOT the design-doc's option-C "extend the list".**
   `docs/design/LIST_CYCLING_DESIGN.md` recommended physically appending lap copies; x/plan v5 supersedes it
   with the monotonic-virtual approach (wrap the LOOKUP, never the counter) so reconciliation is byte-identical
   and there is no data migration. Implemented per x/plan.
2. **Two-key gate.** Global `CYCLING_ENABLED` (build) AND per-assignment `cyclingEnabled` (config). See U1.
3. **`cycleLength := positions.length` is canonical** for the wrap (`resolveVirtualRange`/`getNewWords`, which
   load positions and use `.length` at zero extra cost). For the init-time lap math + all display surfaces the
   list's `wordCount` is used as the modulus (coincides with `positions.length` absent `deleteWord` drift —
   db.js decrements both). See U6.
4. **Accept-reset review (§3d).** Confirmed re-intro resets study_state to NEW via
   `initializeNewWordStates`→`createStudyState` (merge, `DEFAULT_STUDY_STATE` clears status/masteredAt/returnAt;
   `studyTypes.js:39-53,63-70`). Combined with the lap-bounded `getUnmasteredPool`, the review pool repopulates
   naturally per lap; the `masteredAt/returnAt` batch-clear is DROPPED (inert + would exceed Firestore 500/batch).
5. **No dead-end / no separate rollover state.** Because cap removal makes `newWordCount===pace>0` at a boundary,
   the existing session flow continues straight into lap 2 (the `newWordCount===0 → COMPLETE` else-branch is
   simply never reached under cycling, and `isListComplete` is false). The "rollover" is thus implicit; the ack
   is the inline "Lap N" badge.

---

## Uncertainties for Codex (U1..U12)

- **U1 — Global `CYCLING_ENABLED` flag (DELIBERATE deviation from x/plan "per-assignment only").** x/plan §4
  specifies per-assignment `cyclingEnabled` only. I added a global build flag as the primary gate; a cycling path
  runs only when BOTH are true. Rationale: it enforces §3g's HARD PREREQUISITE *in code* (cap removal literally
  cannot execute until the flag flips at ship, after P3–P6 deploy + soak) and gives byte-equivalent dormancy that
  the M-STATIC harness + diff can verify. **Adjudicate:** accept the global flag, or collapse to per-assignment
  only? (If collapsed, the byte-equivalence guarantee weakens to "no assignment has the field set yet.")
- **U2 — Lap-aware M4 approach.** I made the M4 `wordsRemaining` clamp lap-modular by DROPPING the cap under
  cycling (`allowedIntroduced = max(0, allocNew)`), rather than clamping to `cycleLength − (twi mod cycleLength)`.
  Reason: cycling has no per-lap cap (straddle days legitimately introduce across the boundary), so the paced
  allocation is the correct bound; the other M4 legs already validate the virtual anchor. **Adjudicate:** is
  "no cap under cycling" the right M4 semantics, or should M4 assert `introduced ≤ cycleLength`?
- **U3 — review-only × laps re-verification (FIX_PLAN P9 demands this; do NOT inherit the zero-recon-change
  claim for a combination it never saw).** The review-only-day machinery (PLAN_review_only §7) and the cycling
  lap-bound have NOT been co-verified on live data. Specifically: on a cycling day where intervention throttles
  `allocNew<=0` (reviewOnlyReasons.allocationZero), `completeSession` still sets `wordsIntroduced=0` and advances
  csd — but the review pool is now lap-bounded, so the review segment is drawn from `[0, twi mod cycleLength)`.
  I believe this composes correctly (csd advances, twi flat, review from current lap), but **this needs the
  PLAN_review_only §7 personas re-run WITH cycling on** before enabling. Flagged, not verified (LOCAL-ONLY).
- **U4 — Interstitial vs inline badge (§3f ack).** I chose the **inline "Lap N" badge** (x/plan's accepted
  alternative) over a one-time interstitial, because the boundary is crossed mid-session on a straddle day and a
  modal mid-flow is disruptive. **Adjudicate:** is the inline badge sufficient, or is a one-time "Starting Lap N"
  interstitial (fired when twi FIRST crosses k·cycleLength) required for the ack?
- **U5 — Intervention across laps (x/plan §5.1, hits the live unstuck students).** NOT decided/implemented:
  `interventionLevel` is neither reset nor specially carried at rollover — it flows through `recentSessions`
  exactly as today. For 최도훈 etc. this means a high intervention entering lap 2 keeps throttling new words.
  **Decide (product):** reset intervention at the lap boundary, or carry it?
- **U6 — cycleLength canonical modulus. [RESOLVED round 2, Codex P9-3]** `getCycleLength` now derives
  `positions.length` (cheap `getCountFromServer` on the `orderBy('position')` population) and it is used for the
  review lap-bound, failed-carryover bound, session `lapView`, AND the Dashboard/ClassDetail display denominators
  (`cycleLengths` map). `wordCount` is no longer the modulus anywhere (only a transient display fallback while the
  count loads). No adjudication owed.
- **U7 — `advanceForChallenge` lap-modular clamp.** The task said "do NOT re-implement the challenge path; only
  ensure lap-2 allocation/M4 is consistent." I applied the SAME lap-modular clamp to `advanceForChallenge`'s
  existing clamp (not a re-implementation — the `phase==='new'` gate is untouched) so a lap-2 challenge accept
  isn't zeroed. **Confirm** this is the intended reading of "consistent," not an over-reach.
- **U8 — "Start over" terminal semantics (task item 7). [semantics still noted]** With P9-2 resolved, the button
  is capability-gated and its handler re-enters the session, which now correctly resolves cross-class cycling. It
  is still true that an ACTIVE-cycling assignment never reaches the finished terminal (flow is continuous), so the
  button's live role is the cross-class-unlock case. Codex round 1 accepted it as "not harmful while gated." No
  change round 2.
- **U9 — §3b cross-class unlock. [RESOLVED round 2, Codex P9-2]** Implemented: `deriveEffectiveCycling` /
  `resolveEffectiveCycling` (uses the existing `fetchStudentClasses`); used in session init and the Dashboard
  (in-memory), with the "cycling enabled via {className}" affordance in the session badge + Dashboard chip.
  ClassDetail (teacher view, no cheap per-student cross-class data) uses the class-own flag OR the data-derived
  `twi > cycleLength` signal, which catches cross-class cyclers.
- **U10 — TypedTest standalone. [RESOLVED round 2, Codex P9-4]** `TypedTest.jsx` now self-resolves cycling via
  the shared init change and passes `config.cyclingActive` into `getNewWords`, identical to MCQ.
- **U11 — PDF print-order.** `getTodaysBatchForPDF`/`getCompleteBatchForPDF` still sort the day's words by
  physical `position`, so a straddle-day PDF prints wrapped words in physical (not virtual) order. Cosmetic;
  left as-is per x/plan's "sort by virtual OR mark full-PDF a base view" option (chose neither — noted).
- **U12 — getBlindSpotPool declared UNAFFECTED, not lap-aware.** It classifies by per-word study_state
  (NEVER_TESTED/stale) over physical wordIds — one study_state per physical word, no text aggregation — so cycling
  does not double-count. Under accept-reset a re-mastered lap-1 word that was reset reads by its current state.
  Declared unaffected per §3c; **confirm** no lap-labeling is wanted there.

---

## Validation results (round 3, re-run)

- **M-STATIC harness** `audit/deepfix/task3/p9_assert.mjs` — **21/21 PASS** (extracts & evals the REAL pure
  functions from source; can't import the module directly because Vite resolves the extensionless `../firebase`).
  Covers the boundary lap math, §3f cap-removal + byte-equivalence (`computeCyclingAllocation`), §3b cross-class
  unlock (`deriveEffectiveCycling`), the Codex P9-1 composite (fully enabled + FINISHED ⇒ `cyclingActive:true`,
  `newWordCount>0`, `isListComplete:false`), AND the **round-3 Codex P9-5 client↔server consistency case** (class A
  enables + class B launches ⇒ client === server === enabled ⇒ both advance TWI by pace, M4 no `anchor_rejected`).
- **Parser:** all 10 changed files parse OK — `node --check` (4 `.js`/CommonJS incl. foundation) + `@babel/parser`
  (6 `.jsx`). The reconstructed pre-P9 before-files also parse OK.
- **eslint delta vs the reconstructed pre-P9 baseline = 0 NEW findings, per file** (re-measured round 3 at real
  paths; before swapped in, linted, restored — md5-verified identical restore; `foundation.js` stays 6e/0w despite
  the new async resolver + 3 rewired legs; `Dashboard.jsx` stays 24e/1w despite the resolveContinuation change):

  | file | before | after | delta |
  |---|---|---|---|
  | featureFlags.js | 0e/0w | 0e/0w | 0 |
  | studyService.js | 3e/0w | 3e/0w | 0 |
  | db.js | 7e/0w | 7e/0w | 0 |
  | functions/foundation.js | 6e/0w | 6e/0w | 0 |
  | DailySessionFlow.jsx | 3e/9w | 3e/9w | 0 |
  | MCQTest.jsx | 5e/3w | 5e/3w | 0 |
  | TypedTest.jsx | 4e/2w | 4e/2w | 0 |
  | Dashboard.jsx | 24e/1w | 24e/1w | 0 |
  | ClassDetail.jsx | 4e/0w | 4e/0w | 0 |
  | SessionSummaryCard.jsx | 0e/0w | 0e/0w | 0 |

  Dashboard is unchanged at 24e/1w despite the new `cycleLengths` state + loader effect: the added hooks are
  UNCONDITIONAL (top-level), so no new `rules-of-hooks` finding, and every added identifier is used.
- **`phase9_diff.patch` regenerated** (pre-P9 → round-2 after, all 10 files): `git apply --check` CLEAN and
  round-trip verified (applying it to the before-files reproduces the after-files exactly).
  > Note: HEAD predates the uncommitted P3–P8 stack and `functions/foundation.js` is untracked, so `git diff HEAD`
  > is NOT P9-only. The baseline is reconstructed by reverse-applying the P9 edits (self-asserting reversals).

- **Byte-equivalence when OFF (flag-off = today), per changed file:** with `CYCLING_ENABLED === false`,
  `resolveEffectiveCycling` returns `{enabled:false}` WITHOUT any read, so `cyclingActive` is always false and:
  - `featureFlags.js` — only adds an unused-when-off exported const.
  - `studyService.js` — no cross-class read is issued (short-circuit); `cyclingActive` false ⇒
    `computeCyclingAllocation` → `Math.min(allocation.newWords, wordsRemaining)`, `isListComplete = wordsRemaining<=0`,
    `getUnmasteredPool`/`getFailedFromPreviousNewWords` bounds = the raw index, `getNewWords` legacy branch; the new
    exports/params are inert. `getCycleLength`/`resolveEffectiveCycling` are never called.
  - `db.js` — `CYCLING_ENABLED && …` false ⇒ `cyclingEnabled` key never written ⇒ write byte-identical.
  - `functions/foundation.js` — `resolveEffectiveCyclingServer` short-circuits to `{enabled:false}` with NO read
    (global flag first) ⇒ `cycling` false at all three legs ⇒ M4/completeSession/advanceForChallenge clamps are the
    exact prior expressions; the flag is added to the assertion-only `FOUNDATION_FLAGS` map.
  - `.jsx` surfaces — every cycling branch, the new `cycleLengths` loader effects, AND the Dashboard
    resolveContinuation yield-break are gated on `CYCLING_ENABLED` / `sessionConfig.cyclingActive` / the effective
    flag, all false/absent when off ⇒ the loader effects early-return (no read / no state change) and the legacy
    expression/markup renders. The added effects/state are UNCONDITIONAL hooks (no hook-order change).
  - Source-level argument; the eslint parity table (all 10 files, before==after) + the git-apply-clean round-trip
    patch are the mechanical evidence.
- **NOT run** (out of scope / env): dev-server / Playwright (WSL can't run Vite), any live-Firebase read/write,
  any deploy, any commit. (Codex round 1 reported its own `npm run build` passed.)

## Files touched
`src/config/featureFlags.js` · `src/services/studyService.js` · `src/services/db.js` ·
`functions/foundation.js` · `src/pages/DailySessionFlow.jsx` · `src/pages/MCQTest.jsx` ·
`src/pages/TypedTest.jsx` (added round 2, P9-4) · `src/pages/Dashboard.jsx` · `src/pages/ClassDetail.jsx` ·
`src/components/SessionSummaryCard.jsx` (+ this notes file, `audit/deepfix/task3/phase9_diff.patch`, and the
`audit/deepfix/task3/p9_assert.mjs` harness). No NEW vocaBoost SOURCE files created.
`change_action_log.md` intentionally NOT modified (orchestrator owns it).
