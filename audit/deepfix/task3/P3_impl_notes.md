# P3 · FND-1 implementation notes — additive server surface (REVIEWED DRAFT)

**Program:** deepfix Task 3 — FIX_PLAN.md Phase P3 (FND-1). **Date:** 2026-07-13.
**Status:** LOCAL-ONLY draft for Codex + verifier review, then Task-6 sandbox testing. NOT deployed,
NOT committed, no live-Firebase call was made. **Everything ships dormant:** every new callable is
gated on a server flag that is `false` in this tree; the M4 shadow validator's flag is `false`; the
only two edits inside existing live functions are (a) an additive field on the grade-only return
(F2) and (b) the W2 marker upgrade inside a callable that has NO client traffic
(`SERVER_REVIEW_MARKER=false`, `src/config/featureFlags.js:28`). `GRADE_TOKEN_ENFORCED` remains
`false` (`functions/index.js:66` after the require-block insertion) — PRESERVED, untouched.

**Files changed:**
- `functions/foundation.js` — NEW (~1,670 lines): the P3 server surface + flags + helpers.
- `functions/index.js` — 5 edits: foundation require (:23-30), M4 shadow hook in `writeAttemptTxn`,
  W2 delegation in `markReviewComplete`, F2 `attemptDocId` echo in the grade-only payload,
  callable re-exports + `version` probe flag extension.

**`node --check` results:** `functions/foundation.js` → OK. `functions/index.js` → OK.
(eslint: only the repo's pre-existing `no-undef` env-resolution noise — `require`/`exports`/`Buffer`
fire identically on unchanged `index.js` lines; the project lint script is `eslint . || exit 0`.
No unused-var or real findings on the new code.)

---

## Server flags (all in `functions/foundation.js`, exported as `FOUNDATION_FLAGS` through the
`version` probe so the I-5 G1 flag-assertion table covers them)

| Flag | Draft value | Flipped by | Gates |
|---|---|---|---|
| `SERVER_COMPLETE_SESSION_ENABLED` | false | P4 (with client `SERVER_PROGRESS_WRITE`) | `completeSession` callable |
| `SERVER_RESOLVE_LIST_PROGRESS_ENABLED` | false | P4 (with client `LIST_PROGRESS_PERSIST`) | `resolveListProgress` callable |
| `SERVER_RESET_PROGRESS_ENABLED` | false | P4 (with client `SERVER_RESET_PROGRESS`) | `resetProgress` callable |
| `SERVER_ADVANCE_FOR_CHALLENGE_ENABLED` | false | P4 (with `SERVER_CHALLENGE_WRITE` routing) | `advanceForChallenge` callable |
| `LIST_PROGRESS_CANONICAL` | false | **P5 ONLY** (atomic with the migration script — F4-4) | resolver write-capable mode + the completion/challenge writers' legacy→canonical write-target |
| `ANCHOR_VALIDATION_SHADOW` | false | the P3 **deploy** (declared in the G1 table) | M4 log-only validation in `writeAttemptTxn` |
| `ANCHOR_VALIDATION_ENFORCE` | false | **P6 ONLY** after the ≥14-day shadow soak | (declared; NOT yet consumed — see Uncertainty U9) |

A disabled callable throws `failed-precondition` before any read/write ("server flags off →
callables idle", FIX_PLAN P3 Ship/Test/Revert).

---

## Piece-by-piece

### 1 · `completeSession({classId, listId, sessionContext})` — FIX_PLAN P3 change 1 (M3+M5)
`functions/foundation.js` (callable `completeSession`).
- **Transactional day-guard:** `expectedDay = (stored.currentStudyDay||0)+1` inside ONE Admin-SDK
  transaction over the durable progress doc — semantics of `progressService.js:441-452` (verified:
  `:442` expectedDay, `:443` mismatch branch), now atomic (closes persist [C3-2]).
- **Write target:** `durableProgressRef()` = legacy `users/{uid}/class_progress/{classId}_{listId}`
  while `LIST_PROGRESS_CANONICAL=false` (P3→P5), canonical `users/{uid}/list_progress/{listId}`
  after the P5 flip — the F4-4 three-flag cutover has a single switch point in code.
- **Server allocation recompute (its OWN state):** intervention from the txn snapshot's
  `recentSessions` (port of `studyAlgorithm.js:66-98`); dailyPace replicates the LIVE derivation
  chain `DailySessionFlow.jsx:558` (`weeklyPace = assignment.pace * dpw`) →
  `studyService.js:170-179` (`ceil((weeklyPace||400)/max(2,dpw||5))`); `wordsRemaining =
  lists/{listId}.wordCount − storedTwi` (`studyService.js:228-235`).
- **reviewOnlyDay replicates ALL THREE client reasons (F4-2)**, pinned to
  `studyService.js:1329-1335`:
  - reason 1 `allocation.newWords <= 0` → `round(dailyPace·(1−interv)) <= 0` (S3 throttle);
  - reason 2 `isListComplete === true` → `wordsRemaining <= 0` (S4/S5 list-end/over-introduced);
  - reason 3 `startPhase === REVIEW_STUDY` (#9/S8 resume) → **derived at completion time as "the
    day's passed `new` attempt is already ABSORBED into stored twi"** (`dayNewPass.newWordEndIndex
    <= storedTwi − 1`), where `dayNewPass` is the twi-defining pick (max valid `newWordEndIndex`,
    mirroring `studyService.js:258-262`). Rationale: the client's reason 3 is an INIT-time fact
    (startPhase) not visible server-side at completion; its observable consequence — reconciliation
    already advanced twi past the day's anchor, so counting allocation again would double-introduce
    (the exact F4-2 hazard) — IS visible. See Uncertainty U1.
- **Clamp:** `wordsIntroduced = reviewOnlyDay ? 0 : max(0, min(allocNew, wordsRemaining))`
  (`studyService.js:1339-1342` parity — TWI exactly flat on review-only days, never negative).
- **Summary/stats/streak:** `createSessionSummary` shape (`studyTypes.js:266-287`), slice(-10)
  (`MAX_RECENT_SESSIONS`, `studyTypes.js:292`), stats port of `progressService.js:347-364`, streak
  port of `:373-422` (timezone caveat — U3), `interventionLevel` stored = the session's own level
  (parity with `progressService.js:468` receiving `sessionData.interventionLevel`). New-word score
  is literal `null` when no real new attempt exists on a review-only day
  (`studyService.js:1405-1410`); an S8 resume day keeps its real score (`:1444-1449`).
- **Idempotency (v3 MED):** a retry where `dayNumber === storedCsd` AND the LAST `recentSessions`
  entry is that day returns `status:'already_completed'` (no second `+1`); anything else off the
  expected day is a genuine collision → `status:'day_guard_rejected'`. See U2.
- **Rejection leg:** deletes `users/{uid}/session_states/{classId}_{listId}` (clearSessionState
  parity incl. the one retry, `studyService.js:632-635`) and logs
  `day_guard_rejected_session_cleared` / `day_guard_session_clear_FAILED` **WITH uid** to
  `system_logs` (same event names/fields as `studyService.js:637-645`, plus `source`).
- **W2 marker leg:** on a Day-2+ completion with NO review attempt for the day (list-wide
  pre-query), writes the upgraded marker via the shared writer (same deterministic id as
  `markReviewComplete`, so the two P4 routes converge on one doc). See U4.
- **Mismatch tripwire (P4 fold, server leg):** when `sessionContext.clientReviewOnlyDay` is a
  boolean and disagrees with the server verdict → `reviewonly_derivation_mismatch` system event
  with both verdicts + the server's three reason booleans.
- **sessionContext contract (for the P4 client shim):** `{dayNumber:int, newWordScore?:0..1,
  reviewScore?:0..1, segmentStartIndex?:int, segmentEndIndex?:int, wordsReviewed?:int,
  wordsTested?:int, clientReviewOnlyDay?:bool, clientWordsIntroduced?:number}`. The server OWNS
  csd/twi/wordsIntroduced/interventionLevel; client fields feed only display/stats (scores clamped
  to [0,1]).

### 2 · `resolveListProgress({listId, classId?})` — FIX_PLAN P3 change 2 (two modes; v2 BLOCKER + F4-1)
- **Both modes:** canonical doc read first; else enumerate ALL legacy `class_progress` docs for the
  list (body `listId` field — includes dropped classes, `studyTypes.js:240-251`), compute the
  list anchor (port of `getMostRecentPassedNewTest` `db.js:3248-3333`: position-desc pagination for
  the first valid integer anchor + studyDay-ordered sparse fallback + discriminated statuses) and
  exact-range review pairing (port of `getReviewForDay` `db.js:3400-3496`: lineage-required,
  paginated, fail-closed) — all IN MEMORY.
- **READ-ONLY mode (`LIST_PROGRESS_CANONICAL=false`):**
  - **F4-1 preserved write:** when `classId` (the launching class) is supplied, performs TODAY's
    legacy entry-time reconciliation on that doc, byte-parity semantics: create-on-miss
    (`progressService.js:114-127`), per-doc `safeCSD = reviewLookupFailed ? stored :
    max(stored, anchorCsd)`; `safeTWI = hasValidData ? anchorTwi : max(stored, anchorTwi)`
    (`:233-236`), `csd_twi_reconciled` log + the `:264-271`-equivalent update. This keeps the
    day-guard baseline current (the F4-1 BLOCKER).
  - **Creates NO canonical doc on any load** (`canonicalWritten:false` hard-returned) — the P4
    acceptance ("list_progress stays empty until P5") holds by construction; reset's epoch stamp
    also avoids the collection pre-P5 (see piece 3).
  - **#12 tripwire:** EVERY resolution logs `resolve_list_progress {userId, listId, mode,
    anchorStatus, applied{csd,twi}, merged{csd,twi}, sources[], reviewEvidenceDays,
    quarantineCandidateCount}` to `system_logs` (FIX_PLAN §6.1 hedge a).
  - **Quarantine = LOG-ONLY candidates** in this mode (`list_progress_quarantine_candidate`) —
    blocking study pre-P5 would be a live behavior change P3 forbids; the write-capable mode blocks.
  - **Returned position:** top-level `csd/twi` = the **LAUNCH view** (today's per-class
    reconciliation semantics) so P4 session paths stay byte-consistent with the day-guard; the
    **MERGED cross-doc view** rides alongside (`merged{csd,twi}` + `sources[]`) for render paths /
    the P5 dry-run preview. See U5 — this is an interpretation the plan under-specifies.
- **WRITE-CAPABLE mode (P5 flips):** quarantine BLOCKS (`{mode:'quarantined'}` +
  `list_progress_quarantined` error log — persist §5.2 backstop contract); anchor `query-error`
  ABORTS hydration (errored lookups move nothing); else hydrate-on-miss via the persist §5.2
  [C4-4] transactional algorithm (pre-query candidate refs outside; `tx.getAll` re-read inside;
  merge recomputed from txn snapshots; create only if destination still absent) with the §8 merge
  (anchor-validated TWI; screened max CSD; ancillary from the max-twi→max-csd→newest-lastSessionAt
  winner; `programStartDate = min`; `lastActiveClassId` informational; `hydratedAt` stamps on the
  canonical doc AND consumed sources — distinct from the migration's `migratedAt`, U6).
- **CSD plausibility screen ([C4-2] + the P5 amendment / §3 constraint 4):** per-doc, own-anchor
  baseline `anchorDay + distinctPostAnchorReviewDays + slack(7)` with the DURABLE evidence =
  distinct `studyDay`s of review attempts `submittedAt > anchor.submittedAt` (capped
  one-per-studyDay), AND the `implausibleStudyDayThreshold` calendar/TWI ceiling when computable
  (port of `studyTypes.js:215-232`, see U7). A doc is implausible only when it exceeds the
  evidence-adjusted anchor baseline and (when computable) the ceiling.

### 3 · `resetProgress({listId})` — FIX_PLAN P3 change 3 (I-6 M7; persist §5.3 [C5-5])
Self-service (uid = caller — parity with `resetStudentProgress`'s self-check `db.js:2896-2900`),
LIST-WIDE (the persist §5.3 fix for the class-filtered legacy reset), in the plan's order:
1. **attempts FIRST, all classes:** `(studentId, listId)` field query PLUS a full-history
   testId-parse sweep for legacy docs missing the `listId` field (both testId formats — the
   `db.js:2980-2992` parse and the gradebook `:1977-1984` regexes), batched deletes;
2. **session_states:** every `*_{listId}` doc (docId `{classId}_{listId}`,
   `sessionService.js:54-56`; Firestore ids contain no `_` so suffix-match is exact);
3. **study_states** `where listId ==` (parity `db.js:2930-2960`);
4. **legacy class_progress docs, all classes** (field query ∪ id-suffix sweep);
5. **reset-epoch stamp** `{resetEpoch: increment(1), resetAt}` — pre-P5 written to
   `users/{uid}/progress_meta/{listId}` (NOT `list_progress` — preserving the P4
   empty-collection assert), post-P5 (`LIST_PROGRESS_CANONICAL=true`) onto the canonical doc.
   **Deliberate deviation from I-6 M7's literal "stamp on list_progress" — see U8.**
Logs `reset_progress_server` with per-collection delete counts. Anchor-query consumers of the
epoch (excluding pre-epoch attempts) land with P5/P6 per the plan; the tombstone is durable now.

### 4 · W1 `submitChallenge` — **already in tree; verified, no change**
`functions/index.js:629-681` (pre-edit numbering :621-673) already implements W1 exactly as the
plan specifies: one transaction over history-append + single-answer challenge metadata, all gates
inside the txn, `alreadyPending` idempotency. **Token parity verified line-by-line** against
`db.js:188-194` (`getAvailableChallengeTokens`): server `availableChallengeTokens`
(`functions/index.js:609-615`) counts `status==='rejected' && replenishAt.toMillis() > now`, cap
`max(0, 5 − activeRejections)`; the `(h.replenishAt?.toMillis?.() ?? 0) > now` null-coalesce is
behavior-identical to the client's `h.replenishAt?.toMillis?.() > now` (`undefined > now` is false;
`0 > now` is false). Client routing stays off (`SERVER_CHALLENGE_WRITE=false`,
`featureFlags.js:20`).

### 5 · W2 `markReviewComplete` — UPGRADED (C-14/C-34 fix)
`functions/index.js` `markReviewComplete` now delegates its write to
`foundation.writeUpgradedReviewMarker` (same validation/auth/deterministic-id/idempotency/ownership
as before — the auth gate via `assertCanWriteAttempt` with the marker-shaped full ctx is kept
verbatim). The upgraded marker adds, versus the legacy write (old `:583-600`, which had NO testId
and NO range):
- **`testId: vocaboost_test_{classId}_{listId}_review`** — the live `getTestId` shape
  (`testRecovery.js:20-22`), which SURVIVES the gradebook parse (`db.js:1977-1984`
  `^vocaboost_test_[^_]+_([^_]+)_` captures listId) and the reset parse (`db.js:2985-2989`
  parts[3]) — the C-34 leg;
- **`newWordStartIndex`/`newWordEndIndex` = the day's anchor range**, derived SERVER-side (never
  client-echoed) from the day's twi-defining passed `new` attempt (max valid `newWordEndIndex`,
  list-wide, `studyService.js:258-262` semantics) — satisfies exact-range pairing
  (`db.js:3449-3450`: `review.nwsi === anchor.nwsi && review.nwei === anchor.nwei`) plus the
  pairing query's other legs (sessionType `review`, `studyDay` = the anchor's day, serverTimestamp
  `submittedAt` ≥ anchor's) — the C-14 leg;
- `wordsIntroduced: 0` on the marker (it introduces nothing; the range is pairing lineage only).
When the day has NO valid passed new attempt (a pure review-only day — no same-day anchor exists to
pair against; those days are anchor-invisible by design, I-2 §1.2 last row), the marker is still
written (day completion must not break) with null range + a `review_marker_anchor_missing` log.
**Output shape for the P3 acceptance (v2 MED-6):** parseable testId ✓, integer nwsi/nwei == the
day's anchor ✓, `getReviewForDay` pairs it (all five query/filter legs satisfied) ✓,
gradebook-visible (regex + the P2 C-34 field-first fallback both hit) ✓.

### 6 · M4 anchor validation — SHADOW, inside the existing writer
Hook at the top of `writeAttemptTxn` (`functions/index.js`, right after the auth resolve — covers
BOTH live writers: `submitVocabAttempt` and `gradeTypedTest`'s direct-write path; F-9: 96% of live
attempts). `foundation.validateAttemptAnchorShadow(uid, ctx, classData)`:
- only `sessionType === 'new'` (the anchor writers);
- asserts the I-6 M4 set against server state: `newWordStartIndex === serverTwi`,
  `newWordEndIndex === nwsi + introducedCount − 1`, `introducedCount ≤ max(0, min(allocation,
  wordsRemaining))`, `studyDay === serverCsd + 1`;
- LOG-ONLY: `anchor_rejected {shadow:true, enforced:false, userId, classId, listId, attemptDocId,
  violations[], observed{}, expected{}}` — **never throws, never blocks**; the whole body is
  try/caught and the flag (`ANCHOR_VALIDATION_SHADOW=false`) makes it a no-op in this draft, so the
  merged code has ZERO live-path change until the P3 deploy flips the flag per the G1 table.

### 7 · Nonce F2 server leg — grade-only return echoes `attemptDocId`
`functions/index.js`, `gradeTypedTest`'s grade-only branch: the payload is now
`{results, gradeToken, gradeTokenCreatedAt, attemptDocId: bindCtx?.attemptDocId ?? null}` — exactly
the inv_I5 §2 F2 spec. Because this same `payload` object is what `persistGradingJobResult` caches
on the grading job, the recovery paths (`getGradingStatus`/`pollForGrade`) return the echoed id
too — one change covers both F2 legs. Additive: today's client ignores the extra field; the
consuming client legs (F1/F3, `context.attemptDocId = gradingResult.data?.attemptDocId ??
attemptDocId` + the memoized nonce) are P4 work.

### 9 · `advanceForChallenge({attemptId, previousScore})` — FIX_PLAN P3 change 9 (F5-HIGH-2)
Server port of the challenge-accept day-progression block (`db.js:2769-2855`; in today's tree the
plan's `:2790-2833` cites sit at `:2782-2846` — cosmetic drift, semantics verified):
- teacher-only + **teacher-of-record** (`attempt.teacherId === caller`) — the same surface today's
  rules gate the client update on (`firestore.rules:114-118`); the I-10 §6 enrollment UNION is
  P10's;
- fail→pass transition check (`previousScore < passThreshold && attempt.score >= passThreshold`,
  threshold parity `assignment?.passThreshold || 95`, `db.js:2793`);
- stale-day boundary guard (`attempt.studyDay === currentDay + 1`, `db.js:2809-2817`);
- Day-2+ `new` pass → session_states `review-study` advance (same doc/fields, `db.js:2819-2829`);
- boundary completion → transactional `csd+1` on the record the foundation owns
  (`durableProgressRef` — legacy pre-P5, canonical post-P5), with the twi increment **CLAMPED** to
  `[0, wordsRemaining]` (closing the I-6 §3-row-8 unclamped defect at `db.js:2840-2845`; unknown
  list size fails OPEN to the legacy non-negative unclamped count, never silently zero) and
  **PHASE-GATED to `phase === 'new'`** (the x/plan §3g review-pass hazard) — see U10 for the
  review-branch semantic delta this creates vs the client;
- `exists()`-guard parity on the progress doc (`db.js:2804`) + `challenge_day_advance` audit log.
Client routing (calling this instead of the `db.js` block) is P4; the FULL `reviewChallenge`
migration + C-19 authz union stays P10.

### 8 · `exports.version` — foundation flags folded in
The probe (`functions/index.js:1930+`) now reports `FOUNDATION_FLAGS` alongside the grading flags,
so the P0/I-5 G1 assertion table can check the full server posture in one call. (The probe itself
was already in tree; P3 change 8's "delivers exports.version live" is a deploy fact, not new code.)

---

## Constraint compliance (FIX_PLAN §3, the ones binding P3)
- **§3.1 (G1):** no deploy performed; `GRADE_TOKEN_ENFORCED=false` preserved; `GRADE_JOB_ENABLED`
  untouched (`true`, the deliberate activation the P3 deploy validates).
- **§3.5 (resolver read-only until P5):** `LIST_PROGRESS_CANONICAL=false`; read-only mode cannot
  write a canonical doc on any path; the F4-1 legacy recon write is preserved with today's exact
  per-doc semantics; reset's epoch stamp avoids `list_progress` pre-P5.
- **§3.7 (3 write-targets migrate together):** all three server writers (`completeSession`,
  `advanceForChallenge`, and P5's migration) share ONE write-target switch
  (`durableProgressRef`/`LIST_PROGRESS_CANONICAL`).
- **§5 rows:** TWI clamp server-side (`max(0,…)`); CSD non-demoting preserved (launch-view `max`);
  anchor identity `twi = nwei + 1` (`computeAnchorPosition`); errored lookups move nothing
  (discriminated statuses ported; completeSession aborts retryable on attempt-query error;
  hydration aborts on anchor query-error); day-guard transactional; review pairing untouched
  (the marker now satisfies it).

## What P3 acceptance still needs (not runnable in this env — Task 6)
Sandbox E2E (day-guard rebuild; the S3/S4/S5/S8 fixture diff-check of the server reviewOnlyDay
derivation vs `studyService.js:1329-1335`; the double-retry idempotency assert); the 7-transition
grading-job suite + typed smoke; the W2 marker output-shape assert (pairs + gradebook-visible);
M4 shadow soak. The grading-job suite (`dsg-edits/srv_validate/grading_job_tests.mjs`) was NOT run
here (no emulator in this env); F2 only adds a field to the cached payload shape — flag for the
suite to re-run since cached payloads now carry `attemptDocId`.

---

## UNCERTAINTIES — explicit list for the reviewers (implement-to-spec vs verified)

- **U1 (reason-3 derivation).** The client's predicate reason 3 is `startPhase === REVIEW_STUDY`
  (an init-time sessionConfig fact). The server derives it at completion time as "day's passed
  `new` attempt already absorbed into stored twi" (`nwei <= twi−1`, twi-defining pick). I could not
  find a plan-pinned server-side formula for reason 3 — this is my construction of "the server
  re-derives from ITS OWN state" (X1). It matches S8 mechanics (reconciliation advanced twi at the
  resume-init before completion) and cannot double-introduce, but a fixture diff-check (S8 + an
  ordinary day with a mid-session reload) MUST confirm equivalence. Edge: a day with TWO same-day
  new passes at different positions (degenerate) — the max-nwei pick mirrors the anchor rule, but
  the client's `=== twi−1` equality pick could disagree with my `<= twi−1` on malformed data.
- **U2 (idempotency vs collision ambiguity).** A retry is recognized by `dayNumber === storedCsd &&
  lastRecentSession.day === dayNumber`. A GENUINE collision in which another entry advanced csd to
  exactly this day is indistinguishable and returns `already_completed` instead of
  `day_guard_rejected`. State outcome is identical (no second advance, nothing corrupted); only the
  client-facing status differs (success-shaped vs rebuild-shaped). Flagged for the P3 sandbox
  suite to characterize; a stronger discriminator (e.g., a client completion nonce echoed into the
  summary) would resolve it if reviewers want exactness.
- **U3 (streak timezone).** Client streaks use the STUDENT's local clock
  (`progressService.js:373-422`); Cloud Functions run UTC. Ported with a fixed KST offset
  (`STREAK_TZ_OFFSET_MINUTES = 540`) matching the live cohort. Display-only field, but it is a
  semantic drift for any non-KST user; alternatives (client-supplied tz, per-user setting) need a
  product call.
- **U4 (completeSession's internal marker condition).** The plan says the marker is written "on a
  review-only-no-review-attempt day"; I write it on ANY Day-2+ completion with no review attempt
  for the day (list-wide). Rationale: the recon counts a Day-2+ day complete only via a pairable
  day-N review, and the S7 (non-review-only) automarker day is exactly the C-14 class — the
  markReviewComplete route covers it at P4, but the completeSession route converging on the SAME
  deterministic doc id is belt-and-braces, idempotent, and never double-writes. Also: a cross-class
  same-day review at a DIFFERENT range would suppress the marker while not pairing (day survives
  in place via non-demoting CSD) — accepted, flagged.
- **U5 (read-only resolver: launch view vs merged view).** The plan says the read-only resolver
  "RETURNS the computed {csd,twi,…}" (merged), but P3/P4's completion day-guard baselines on the
  LAUNCHING class's legacy doc. If session paths consumed a merged csd that exceeds the launching
  doc's stored csd (possible cross-doc), every completion would day-guard-reject — an F4-1-shaped
  trap on the cross-doc axis. I therefore return the LAUNCH view as the top-level position (byte-
  parity with today's entry reconciliation → guard-consistent) and the MERGED view alongside for
  render/diagnosis. If reviewers prefer the merged view as primary, the F4-1 legacy write must
  then write the merged values into the launching doc (a pre-P5 cross-doc csd carry — a semantics
  change the plan did not authorize). Needs adjudication.
- **U6 (hydration stamps).** Write-capable hydration stamps `hydratedAt` on the canonical doc AND
  consumed legacy sources. The §8 `migratedAt` re-run guard belongs to the P5 script; I used a
  DISTINCT field so hydration cannot trip the script's idempotency check. Not plan-specified.
- **U7 (implausibleStudyDayThreshold port).** The calendar ceiling approximates the client's
  weekday-walk (`studyTypes.js:159-196`) as `ceil((daysElapsed+1)·5/7)` — an upper bound, not
  byte-parity (observability-only input to the screen). Also, the per-source screen uses DEFAULT
  pace (80) rather than each source class's assignment pace (avoiding N class reads per resolve);
  the launching class's real pace is available if reviewers want it exact.
- **U8 (reset epoch location pre-P5).** I-6 M7 says stamp `resetEpoch/resetAt` on `list_progress`;
  the v2-BLOCKER/P4 acceptance says the `list_progress` collection must stay EMPTY until P5. These
  conflict once `SERVER_RESET_PROGRESS` flips at P4. Resolution implemented: pre-P5 the epoch lives
  at `users/{uid}/progress_meta/{listId}`; post-P5 it stamps the canonical doc; P5's migration
  should fold `progress_meta` in. Needs reviewer sign-off (alternative: exempt reset tombstones
  from the empty-collection assert).
- **U9 (enforce flag declared, not wired).** `ANCHOR_VALIDATION_ENFORCE` exists (so the G1 table
  can assert it stays false) but the clamp-or-reject branch is deliberately NOT implemented — P6
  work, after the shadow soak defines what a rejection should do (clamp vs deny) with data.
- **U10 (advanceForChallenge phase gate = a semantic delta).** The client adds the pace-derived
  count to twi on BOTH the day-1-new and the review boundary branches (`db.js:2830-2845`); the plan
  orders the twi derivation gated to `phase==='new'`, so my review-branch completion advances csd
  but leaves twi FLAT. For a genuinely-lost review-day completion this under-adds vs the client —
  self-healing at next entry (TWI is anchor-authoritative bidirectionally under LIST_SCOPED_RECON,
  `progressService.js:236`), and it can never over-add (the hazard the gate targets). Flagged for
  adjudication. Also: `previousScore` is caller-supplied (the client updates the attempt before
  calling, so the pre-acceptance score is otherwise lost) — teacher-trust level unchanged vs
  today's client block; P10's full migration should recompute it server-side.
- **U11 (invalid-anchor divergence, safe direction).** For a studyDay-fallback anchor with a
  MALFORMED `newWordEndIndex` (non-integer), the client computes junk `twi = nwei+1` and
  `max(stored, junk)` could ADVANCE twi on junk; my `computeAnchorPosition` treats invalid anchors
  as twi 0 → stored value preserved. Deliberate safe-direction divergence (real data is
  integer-only per the Phase-0 audit / `db.js:3270-3272` comment); flagged because it is NOT
  byte-parity.
- **U12 (index dependence).** Every new server query was shape-matched to an EXISTING composite
  index in `firestore.indexes.json` (verified: `(studentId,listId,sessionType,passed,
  newWordEndIndex DESC,submittedAt DESC)`, `(…,passed,studyDay DESC)`, `(…,sessionType,studyDay,
  submittedAt DESC)`, `(…,sessionType,submittedAt DESC)`, `(studentId,listId,submittedAt DESC)`).
  I did NOT verify these indexes are LIVE in prod (the tree's indexes file vs deployed state);
  F-9's "853 csd_twi_reconciled logs + indexes proven live" covers the recon set, which is the
  same set — but assert at the P3 deploy gate.
- **U13 (`assignment` may be legacy-null).** `assertEnrolledAssigned` admits legacy
  `assignedLists`-only classes (parity with `assertCanWriteAttempt`); `deriveDailyPace(null)`
  then yields the 400/5→80 default chain exactly as the client would (`weeklyPace NaN||400`). The
  MAIN client flow can't reach that state (`DailySessionFlow.jsx:532-535` throws first) — edge
  documented, not invented behavior.
- **U14 (testId underscore assumption).** The marker's parseable testId (and the gradebook regex
  generally) assumes classId contains no `_` (`[^_]+`). True for Firestore auto-ids; identical
  exposure to every live testId, so parity holds — noted only because the marker now participates
  in the parse.

---

## Codex review fold — W2 marker path (2026-07-13, NEEDS_FIXES → 2 HIGH, both verified against code)

Codex validated the design (U5 launch-view correct; 13/14 uncertainties accepted; resolver read-only,
transaction, dormancy, G1 all confirmed). Two correctness holes in the C-14 marker path were folded into
`functions/foundation.js` (nothing else changed; `node --check` OK on both files after).

### HIGH-1 — `writeUpgradedReviewMarker` now UPGRADES an existing legacy marker in place
Before: an existing deterministic-id marker returned `{alreadyWritten:true}` immediately, so a pre-existing
LEGACY marker (no parseable testId, no `newWordStartIndex/EndIndex`) stayed unpairable while the callable
reported success — the exact C-14 defect. Now, when the existing marker is owned by the same uid:
- if it already carries the upgraded shape (`testIdMatchesList(testId, listId)` AND integer nwsi/nwei) →
  true no-op `{alreadyWritten:true, upgraded:false}`;
- else derive the day's anchor range and MERGE the missing upgraded fields in place
  (`ref.update({testId?, newWordStartIndex?, newWordEndIndex?})`) → `{success:true, upgraded:true}`;
- if the range is NOT derivable (pure review-only day, no same-day passed new anchor) → log
  `review_marker_anchor_missing {existing:true}` and LEAVE it (never fabricate a range).

### HIGH-2 — `completeSession` marker suppression is now PAIRABILITY, not bare existence
Before: the marker was written only when `dayReviewExists(uid, listId, dayNumber) === false` — a query with
NO anchor-range / lineage — so a same-day review from a DIFFERENT class/pace/range (which will NOT pair to
the anchor, `db.js:3449-3450`) suppressed the only upgraded marker → a future fresh/reset doc reconciles to
`anchorDay−1` (the phantom-loop, CONSOLIDATED C-03 / :208-214). Now, for Day-2+ completions:
- when the day HAS an anchor (`dayNewPass` with integer nwei) → call the ported pairing logic
  `getReviewForDayServer(uid, listId, dayNumber, {anchorSubmittedAt, anchorNewWordStartIndex,
  anchorNewWordEndIndex})`; suppress the marker ONLY on `status:'found'` (a proven range-pairing review);
- `status:'none'` → write/upgrade the marker; `status:'query-error'` → FAIL SAFE: write/upgrade anyway
  (never silently suppress on an unverified lookup) + log `review_marker_pairing_query_error`;
- when the day has NO anchor (pure review-only day, reason 1/2 — no range to pair against) → fall back to
  the coarse `dayReviewExists` existence check (any review completes such a day; it survives via
  non-demoting CSD), same fail-safe on its `null` (query-error) return.
`markerWritten` now counts an in-place UPGRADE as written (`marker.alreadyWritten !== true`).

### Acceptance assertions to add (P3 sandbox suite, Task 6)
- **(a) legacy-marker upgrade in place:** seed a day-N marker in the OLD shape (no `testId`, null
  nwsi/nwei) for a day that HAS a passed new attempt → call `markReviewComplete` (or `completeSession`) →
  assert the SAME doc now has `testId === vocaboost_test_{classId}_{listId}_review` (parseable) and integer
  `newWordStartIndex/newWordEndIndex` == the day's anchor range, and `getReviewForDay` now PAIRS it +
  it is gradebook-visible; a second call is a true no-op (`upgraded:false`).
- **(b) different-range review does NOT suppress the marker:** seed a same-day `review` attempt at a
  DIFFERENT range/class than the day's anchor → complete the day via `completeSession` → assert the upgraded
  marker IS written (not suppressed), and that `getReviewForDay` pairs the MARKER (the different-range
  review does not), so a fresh/reset doc reconciles to the completed day, not `anchorDay−1`.
- **(c) query-error fail-safe:** force the pairing lookup to error (missing/incomplete anchor lineage) →
  assert the marker is written (never suppressed) and `review_marker_pairing_query_error` is logged.

Everything Codex accepted stays as-is (U1 still needs the S8 fixture diff-check; U5 launch-view; the
transaction; dormancy; G1).
