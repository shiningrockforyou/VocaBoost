# P4 · FND-2 implementation notes — client cutover (REVIEWED DRAFT)

**Program:** deepfix Task 3 — FIX_PLAN.md Phase P4 (FND-2). **Date:** 2026-07-13.
**Status:** LOCAL-ONLY draft. NOT deployed, NOT committed, no live-Firebase call was made.
**Dormancy contract (the binding safety rule):** the NEW routing flags are **DEFAULT-FALSE** in this
tree — `SERVER_PROGRESS_WRITE=false`, `SERVER_RESET_PROGRESS=false`; `SERVER_CHALLENGE_WRITE` and
`SERVER_REVIEW_MARKER` are **left at their current `false`** with a comment that they flip at the
P4 **DEPLOY-time** cutover (David), sequenced AFTER the P3 functions deploy + soak. Nothing in this
draft arms the client against an undeployed callable. With all flags off, behavior is
byte-equivalent to today (Run-L) — the two deliberate, inert exceptions are itemized in
UNCERTAINTIES (U1: nonce F1/F3 degraded-storage path — the fix itself; U2: the always-on build
stamp — pure observability).

**Verified line-drift corrections vs the plan's cites (all `[V-P]` re-verified in this tree):**
- `gradeAttemptDocId`: plan says TypedTest.jsx:767 → actually **:771** (pre-edit).
- 2nd derivation to delete: plan says :869-870 → actually **:879-880** (pre-edit).
- `recordSessionCompletion`: prompt cites progressService.js — actually **studyService.js:578**.
- `impossible_phase_detected` "Dashboard emitter at :1461-1464": the emitter itself lives in
  **studyService.js:110** (inside `determineStartingPhase`); Dashboard's Panel C *call site* on raw
  un-reconciled csd was **Dashboard.jsx:1511+1519** (pre-edit). The retire is via the resolver read
  feeding that call site — the shared emitter is untouched (session paths still use it).

**Syntax checks:** all 12 changed files parse clean via `node_modules/@babel/parser`
(`sourceType:'module'`, plugins `['jsx']`) — featureFlags.js, testRecovery.js, buildStamp.js,
studyService.js, progressService.js, db.js, TypedTest.jsx, MCQTest.jsx, DailySessionFlow.jsx,
Dashboard.jsx, main.jsx, vite.config.js. (`node --check` cannot parse ESM `export`/JSX; the repo's
esbuild binary is win32 so `vite build` is not runnable in this env — flagged as U12.)
**ESLint delta (per-file HEAD-vs-tree comparison, measured):** testRecovery/featureFlags/
studyService/progressService/TypedTest/MCQTest/DailySessionFlow/main/vite.config/buildStamp →
ZERO new findings. db.js shows +1 vs HEAD (`assignments` unused, :1468) — that is in P2's
gradebook region, already in this tree before this session, not P4's. Dashboard.jsx → **+2
`react-hooks/rules-of-hooks`** for the new Panel C useState/useEffect (see U15 — the file
already carries 9 of the same class at HEAD).
No `phase4_diff.patch` was cut: the working tree carries the uncommitted P2/P3/P5/P8 drafts, and
several files (featureFlags, Dashboard, TypedTest, db.js) are shared across phases — a `git diff`
cannot isolate P4. Locations below are exact instead.

---

## Piece-by-piece (per-item: files+lines, gating flag, verification)

### 1 · NEW flags — `src/config/featureFlags.js`
- `SERVER_PROGRESS_WRITE = false` (:~91) — gates: completion routing (item 3), hydration routing
  (item 4), teacher read (item 5), Dashboard Panel C resolver read (item 8), and the
  `clientReviewOnlyDay` tripwire field (item 3). Doc block states the deploy-order dependency
  (P3 server flags `SERVER_COMPLETE_SESSION_ENABLED`/`SERVER_RESOLVE_LIST_PROGRESS_ENABLED` must
  be live first) and that completion still targets LEGACY `class_progress` until P5.
- `SERVER_RESET_PROGRESS = false` (:~107) — gates the reset route (item 6); doc block carries the
  [C5-5] pairing (server-move + P6 owner-delete-removal are two halves of one change).
- `SERVER_CHALLENGE_WRITE` (:25) / `SERVER_REVIEW_MARKER` (:36) — **values untouched (false)**;
  added the "[deepfix P4 · FND-2] flips TRUE at the P4 DEPLOY-time cutover" comments.
- P8's `CONTINUATION_LINKS` untouched.

### 2 · Nonce F1 + F2 client leg — `src/pages/TypedTest.jsx` (UNFLAGGED — see U1)
- **F1** (:~874-897): the second `getOrCreateAttemptNonce`/`attemptDocId` derivation (pre-edit
  :879-880) is DELETED; the write identity is now `const attemptDocId = serverEchoedAttemptDocId
  ?? gradeAttemptDocId`, where `gradeAttemptDocId` is the single derivation computed before
  grading (:771). Mirrors MCQTest's existing single derivation (MCQTest.jsx:610-611 — verified,
  MCQ needed no change). Both write branches (`context.attemptDocId` for `submitVocabAttempt`,
  and the legacy `submitTypedTestAttempt(..., attemptDocId)` arg) already consumed the variable —
  they now receive the F1 identity with zero further edits.
- **F2 client leg**: `serverEchoedAttemptDocId = gradingResult.data?.attemptDocId ?? null` — the
  id the gradeToken was minted against wins. The P3 server leg (grade-only payload + cached
  grading-job payload carry `attemptDocId`) is already in this tree (`functions/index.js`,
  P3 notes §7), so recovery paths (`tryRecoverGrade`/`pollForGrade`) echo it too. Against the
  CURRENTLY-DEPLOYED functions (no echo field) the `??` falls back to the local id — inert.
- **Tripwire**: `nonce_identity_divergence` system event (error) when the echo exists and differs
  — impossible after F1 by construction; the log exists to prove it stays impossible.
- Placement: the block sits OUTSIDE `doWriteAndFinalize` (same position as the deleted lines), so
  "Retry Save" re-runs the write with the SAME identity and the divergence check runs once per
  submit, not per retry.

### 3 · Completion routing — `src/services/studyService.js` (flag: `SERVER_PROGRESS_WRITE`)
- `recordSessionCompletion` (:~585): flag-on → early-return into NEW
  `recordSessionCompletionViaServer(userId, sessionData)`; flag-off path byte-identical.
- The helper calls `completeSession({classId, listId, sessionContext})` per the P3 contract
  (verified against `functions/foundation.js:880-1133`): sessionContext =
  `{dayNumber, newWordScore, reviewScore, segmentStartIndex, segmentEndIndex, wordsReviewed,
  wordsTested}` + optional `clientReviewOnlyDay`/`clientWordsIntroduced` (added ONLY when the
  boolean exists — the callable serializer never sees `undefined`). The server OWNS
  csd/twi/wordsIntroduced/interventionLevel.
- **Return mapping onto today's exact sentinel shapes** (consumers verified:
  `completeSessionFromTest` studyService.js:1481 checks `result?.dayGuardRejected`;
  DailySessionFlow.jsx:1484+ uses `result.progress`/`result.sessionId`):
  - `day_guard_rejected` → `{sessionId:null, progress:{id, currentStudyDay:progressDay,
    dayGuardRejected:true}, dayGuardRejected:true, sessionCleared}` — the SERVER already cleared
    session_states + logged `day_guard_rejected_session_cleared` WITH uid inside the callable
    (foundation.js:1015-1040), so the client does NOT re-clear/re-log.
  - `already_completed` → success-shaped `{sessionId:null, progress}` (idempotent retry; no
    duplicate sessions-history record).
  - `completed` → the legacy `users/{uid}/sessions` history record is still written client-side
    (client-owned audit trail, NOT a progress write; + `serverWordsIntroduced`/
    `serverReviewOnlyDay` truth fields), returns `{sessionId, progress}`.
- **Tripwire client leg**: `completeSessionFromTest`'s summary gains
  `...(SERVER_PROGRESS_WRITE ? { clientReviewOnlyDay: reviewOnlyDay } : {})` (:~1478) — the
  client's #11 predicate rides along as the UX preview; the server compares and logs
  `reviewonly_derivation_mismatch` (server leg already in foundation.js:1054-1064). Flag-off:
  spread of `{}` → summary byte-identical.

### 4 · Hydration routing — `src/services/progressService.js` (flag: `SERVER_PROGRESS_WRITE`)
- `getOrCreateClassProgress` (:~103): flag-on AND `auth.currentUser?.uid === userId` (the callable
  is SELF-SERVICE — any other caller falls through to legacy) → NEW
  `getOrCreateClassProgressViaResolver`: calls READ-ONLY `resolveListProgress({listId, classId})`
  — the SERVER performs today's entry reconciliation (create-on-miss + the F4-1 per-doc
  safeCSD/safeTWI recon write on the launching legacy doc, byte-parity semantics — verified
  foundation.js:1284-1325) and logs `resolve_list_progress`/quarantine candidates (the #12
  tripwire) — then reads the now-reconciled legacy doc LOCALLY (real client `Timestamp` instances;
  the callable's serialized timestamps are plain objects — see U5) + fetches
  `getRecentAttemptsForClassList(..., 8)` for the unchanged `{progress, attempts}` return
  contract. On ANY resolver failure → returns null → caller falls through to the FULL legacy
  client path (fail-open: rules keep the legacy path legal through the whole P4 soak by design).
- NO canonical `list_progress` doc is created on any load — the callable hard-returns
  `canonicalWritten:false` pre-P5 (P3 contract); this draft adds no client writer either, so the
  P4 acceptance ("list_progress stays empty until P5") holds.

### 5 · Teacher read path (F6-2) — `src/services/progressService.js` (flag: `SERVER_PROGRESS_WRITE`)
- `fetchStudentsProgressForClass` (:~575, plan cite :518 pre-edit): per (student, list), flag-on
  reads canonical `users/{studentId}/list_progress/{listId}` FIRST (the resolveListProgress read
  ORDER — the callable itself is self-service, so the teacher surface reads the doc directly;
  authz verified: the generic `/users/{userId}/{subcollection}/{docId}` rule allows teacher reads,
  firestore.rules:45-48) and falls back to legacy `getClassProgress` when the canonical doc is
  absent or the read fails. Pre-P5 the canonical collection is empty → flag-on output is
  IDENTICAL to today; at P5 the canonical doc wins (teacher Students view can't freeze on stale
  class_progress; survives P7's deletion). Canonical rows carry `source:'list_progress'`.
- Caller verified: ClassDetail.jsx:199 (pre-edit :198-199) — signature unchanged, no edit needed.
- Residual teacher-surface class_progress reader (NOT in this draft's assignment — see
  "Not in this draft"): the reviewChallenge day-progression read/write block, db.js:2857-2904.

### 6 · Reset cutover (F6-3) — `src/services/db.js` (flag: `SERVER_RESET_PROGRESS`)
- `resetStudentProgress` (:~2970, plan cite :2886 pre-edit): after the unchanged self-check +
  param validation, flag-on routes to the `resetProgress({listId})` callable (verified
  foundation.js:1490-1560: self-service uid=caller — same guarantee as the client self-check;
  LIST-WIDE across all classes; attempts FIRST with the legacy testId-parse sweep; session_states/
  study_states/class_progress; reset-epoch tombstone in `progress_meta` pre-P5) and maps
  `resp.data.deleted` totals onto the legacy `{success, deletedCount}` return. Flag-off: the
  legacy client batch-delete below, byte-identical.
- Reset callers inventoried: **Settings.jsx:90 is the ONLY UI caller** (grep-verified) — signature
  unchanged, no edit needed. Support-side reset paths are Node Admin-SDK scripts under
  `scripts/cs/` (not client-bundle code; SUPPORT_RUNBOOK governs those — the F6-3 CS-toolchain
  retarget is P5 work).
- **Bundle-grep note (v2 HIGH-3 acceptance):** client `attempts`-delete sites after this draft:
  (a) db.js:3079 batch delete — DEAD when `SERVER_RESET_PROGRESS=true` (early-return above it;
  retained as the flag-off rollback fallback, so the grep must assert LIVE-path reachability by
  flag value, not string absence); (b) progressService.js:85 `cleanupOrphanedReviews` — behind
  `if (!logOnly)` with `logOnly: LIST_SCOPED_RECON` (=true, prod posture), i.e., log-only; also
  unreachable from the resolver-routed hydration path. **With both P4 flags ON there is no live
  client attempt-delete path.** No other `deleteDoc`/`batch.delete` in `/src` targets `attempts`
  (full inventory grep run; remaining sites are classes/lists/members/sessions).

### 7 · Permission-denied completion handler + `legacy_write_denied` (DORMANT by construction)
Per persist §"Old-client UX at the cutoff" [C6-2] (PLAN_list_progress_persist.md:365-400):
detect `permission-denied` (and `functions/permission-denied`) in the completion catches, emit
the server-visible event, and BLOCK with a reload prompt instead of the results screen.
- TypedTest.jsx (:~1090-1110): inside the `catch (completionErr)` that wrapped
  `completeSessionFromTest` — logs `legacy_write_denied {userId, classId, listId, dayNumber,
  testType:'typed', errCode, errMessage}` (error), `setGradingError(reload prompt)`,
  `setIsSubmitting(false)`, `return` (results screen NOT shown).
- MCQTest.jsx (:~816-836): same, via `setSubmitError` + `return` (the page's `finally` resets
  submitting).
- DailySessionFlow.jsx (:~1550-1565): the `completeSession` catch gains the same detection →
  event (`testType:'session-flow'`) + reload-prompt `setError` (covers the
  `recordSessionCompletion`/`updateClassProgress` caller leg the persist spec names).
  `logSystemEvent` newly imported from services/db (:66).
- Dormancy: today's rules allow every owner write these catches wrap (firestore.rules:45-48
  subcollections; attempts create :106-108) — the branch is UNREACHABLE until the P6 rules
  deploy. Non-permission-denied errors keep today's exact swallow behavior.

### 8 · Client build stamp + probe (I-5 G3) — `vite.config.js`, `src/utils/buildStamp.js` (NEW),
`src/main.jsx` (UNFLAGGED, inert — see U2)
- vite.config.js: `define: { __VOCABOOST_BUILD_INFO__: JSON.stringify({sha, shortSha, branch,
  dirty, builtAt}) }` computed via git at build time (never fails the build: missing git →
  'unknown'; mirrors scripts/stamp-build.mjs:20-35 semantics incl. the `dirty` yellow-flag).
- src/utils/buildStamp.js: exposes `BUILD_INFO`, sets `window.__VOCABOOST_BUILD__` + one
  console.info line; whole body try/caught (provenance can never break boot); `/* global */`
  pragma for lint. Side-effect import in main.jsx (:4).
- The G2-style consult step for hosting: post-deploy, `window.__VOCABOOST_BUILD__.sha ===
  git rev-parse HEAD && dirty === false` in the deployed page's console; the sha is also
  bundle-greppable (supersedes the G3 interim fix-string grep).

### 9 · Dashboard Panel C resolver read — `src/pages/Dashboard.jsx` (flag: `SERVER_PROGRESS_WRITE`)
- NEW state+effect (:~1193-1230, after the `getPrimaryFocus` memo): flag-on, student, focused →
  calls `resolveListProgress({listId})` — deliberately **WITHOUT classId**, so the callable takes
  the pure-read leg (NO F4-1 recon write from a render path; verified foundation.js:1195+1287:
  the legacy write requires classId) and returns the resolver's IN-MEMORY reconciled (merged)
  csd, per the P4 read contract ("render paths … consume the resolver's in-memory
  reconciliation"). Focus-keyed + cancellation-guarded; any failure → null → raw fallback.
- Panel C (:~1540-1556): `currentStudyDay = max(resolvedCsd, stored)` when the resolution matches
  the CURRENT focus (non-demoting, the CSD contract; a stale prior-focus resolution can never
  leak in), else today's `progress?.currentStudyDay ?? 0`. The reconciled dayNumber is what stops
  `determineStartingPhase`'s day-1-passed branch (studyService.js:105-119) from firing on stale
  docs → `impossible_phase` Dashboard emissions ≈ 0 for updated clients (the P4 acceptance
  metric). The shared emitter is NOT removed (session paths still legitimately use it).
- Flag-off: effect exits before any work, state stays null forever, memo output byte-identical
  (the added dep never changes).

### 10 · 3rd twi writer routing (F5-HIGH-2) — `src/services/db.js` (flag: `SERVER_CHALLENGE_WRITE`)
Closes U13. VERIFIED gap: `reviewChallenge`'s challenge-accept day-advance wrote
`currentStudyDay: currentDay+1` + `totalWordsIntroduced: (twi||0)+newWordCount` DIRECTLY to
`class_progress` (pre-edit db.js:2898-2903), unclamped and unrouted — the 3rd twi writer.
- **Callable contract VERIFIED before wiring** (foundation.js:1594-1723, read in full, not
  assumed): `advanceForChallenge({attemptId, previousScore})` — teacher-of-record authz
  (`attempt.teacherId === caller`), reads the attempt FRESH, requires the fail→pass transition
  `previousScore < passThreshold && attempt.score >= passThreshold` (else returns
  `{advanced:false, reason}` harmlessly), stale-day boundary guard (`attempt.studyDay ===
  currentDay+1`), Day-2+ `new` → session `review-study` advance / boundary → transactional csd+1
  with the twi add CLAMPED to `[0, wordsRemaining]` and PHASE-GATED to `phase==='new'`, on the
  record the foundation owns (`durableProgressRef` — legacy pre-P5, canonical post-P5).
- **Wiring** (db.js:~2845, inside the existing `if (listId) { try {`): flag-on →
  `httpsCallable(getFunctions(),'advanceForChallenge',{timeout:30000})({ attemptId,
  previousScore: attemptData.score || 0 })`. `previousScore` = the PRE-acceptance score:
  `attemptData` is the snapshot read at db.js:2730 BEFORE the client's own
  `updateDoc(attemptRef,{score:newScore,passed})` at :2794, so `attemptData.score` still holds
  the old score, while the server reads the doc AFTER that write and sees `newScore` — exactly
  the transition the callable checks (matches P3 U10: `previousScore` is caller-supplied because
  the client already overwrote the attempt). Always a finite number (`|| 0`).
- **Flag-off fallback:** the entire original threshold-fetch + class_progress read/write block
  is preserved verbatim in the `else` branch (bodies NOT reindented — the `} else {` wraps them
  at the existing indentation; valid JS, kept minimal-diff so the flag-off path is byte-for-byte
  the pre-edit code). Existing `catch (err)` (non-fatal "don't fail the challenge review")
  unchanged — also absorbs a callable-not-yet-deployed throw during the deploy window.
- **Imports:** `getFunctions`/`httpsCallable` (db.js:23) and `SERVER_CHALLENGE_WRITE` (:24)
  already present (submitChallenge uses the same pattern). node babel-parse OK; eslint delta
  on db.js vs HEAD = zero NEW findings from this edit (the sole +1 is P2's pre-existing
  `assignments` unused var at :1468).
- **Delta vs client (from P3 U10, inherited):** on a genuinely-lost REVIEW-day boundary
  completion the server under-adds twi (phase-gated to 0) vs the client's unclamped add —
  self-heals at next entry (twi anchor-authoritative under LIST_SCOPED_RECON) and can never
  over-add (the hazard the gate targets). Behavior identical for the common `new`-pass case.

### 11 · R1 over-deny — hydration fails CLOSED, not into a P6-denied client write
Closes Codex's P6 R1 BLOCKER (the rules are correct; the fix is client-side). VERIFIED gap: the
item-4 hydration route returned null on resolver failure and FELL THROUGH to the legacy client
`setDoc`(progressService.js:134)/`updateDoc`(:283) — which the P6 rules cutoff DENIES on
`class_progress`/`list_progress`/`progress_meta`. A resolver outage post-P6 would therefore strand
a live 26SM student with a RAW Firestore permission error at session entry (DailySessionFlow.jsx
init catch showed only `err.message`); the prior P4 `legacy_write_denied` handler covered only the
COMPLETION write, not entry-time hydration.
- **Part 1 (fail-closed) — `progressService.js:111-129`:** under `SERVER_PROGRESS_WRITE` AND
  `auth.currentUser?.uid === userId`, the resolver route now retries ONCE, then — instead of
  falling through to a client write — throws a typed Error with `code:'progress_resolver_unavailable'`.
  NO client write happens on this path. The exact legacy fall-through is preserved ONLY when the
  flag is OFF (byte-equivalent). Helper header (:356) updated to state the new contract.
- **Part 3 (CS signal) — `progressService.js`:** the fail-closed path emits
  `logSystemEvent('progress_resolver_unavailable', {userId, classId, listId, source})` (error)
  before throwing (wrapped so a logging failure can't mask the typed error).
- **Part 2 (controlled entry-time UX, not a raw permission error):**
  - `DailySessionFlow.jsx` init catch (the `:872-874` site): recognizes
    `progress_resolver_unavailable` AND raw `permission-denied`/`functions/permission-denied` →
    controlled reload/retry `setError`; logs `legacy_write_denied` for the RAW-denial case only
    (the resolver event is already logged at source — no double-count). The typed error
    propagates cleanly through `initializeDailySession` (studyService.js:159, verified: no catch).
  - `TypedTest.jsx` / `MCQTest.jsx` studyDay-derivation catch (the entry-time hydration point in
    the test pages, runs only when sessionContext lost the day): same code recognition →
    controlled `setGradingError`/`setSubmitError` + `setIsSubmitting(false)`/`setSubmitting(false)`
    + return, instead of the old silent `console.error` swallow (which would stamp the attempt
    with an unresolved day).
- **Flag-off equivalence:** every branch is gated on `SERVER_PROGRESS_WRITE` (Part 1) or on error
  CODES that cannot occur pre-P6 with the flag off (Part 2 — today's rules allow the owner write,
  so `permission-denied` never fires; and the typed code is only thrown by Part 1, which is
  flag-gated). Flag OFF → hydration falls through exactly as before; the page catches hit only
  their original `console.error`. node babel-parse OK on all 4; eslint delta vs HEAD = 0 new
  findings on all 4.

### Task-6 persona (Part 4) — add to the P4/P6 acceptance suite
**"Resolver-unavailable at entry under P6 rules."** With `SERVER_PROGRESS_WRITE=on` + P6 rules
live (client `class_progress`/`list_progress`/`progress_meta` writes denied), force
`resolveListProgress` to fail (dark/timeout) for a student whose progress doc is MISSING or
needs reconciliation → assert: (a) NO client write is attempted (no permission-denied in the
network log from the app's own hydration); (b) the student sees the controlled reload/retry
message, NOT a raw Firestore permission error, on the session-entry screen AND on a
studyDay-fallback test submit; (c) a `progress_resolver_unavailable` system_log event is written
(source `getOrCreateClassProgress`); (d) recovery is a reload once the resolver is back. Pair
with the existing "dormant pre-gate tab wakes post-cutoff" residual persona.

### 12 · P6-2 — resolver adapter now CONSUMES the callable result (canonical-success no longer false-fails)
Closes Codex's P6 round-2 BLOCKER. VERIFIED gap: `getOrCreateClassProgressViaResolver`
(progressService.js) did `await resolveFn(...)`, DISCARDED the return, then read the launching
`class_progress` doc and returned null if absent → the caller failed closed with a FALSE
`progress_resolver_unavailable`. Post-P5 canonical `list_progress/{listId}` exists while the
launching `class_progress` doc may not (migration-collapsed / fresh class-list) → a HEALTHY
resolver stranded a live student under P6.
- **Verified return shapes before wiring** (foundation.js, read — not assumed): canonical
  early-return `{mode:'canonical', csd, twi, data}` (:1204-1212); read-only mode
  `{mode:'legacy'|'none', csd, twi, launch:{classId,csd,twi,data}|null, merged, ...}`
  (:1344-1357); write-capable `{mode:'quarantined', reasons}` (:1366). Confirmed the read-only
  F4-1 leg (:1287-1325) ALWAYS create-on-misses the launching `class_progress` when `classId`
  is supplied → legacy mode's local read always hits (the current path was correct there; only
  canonical mode was broken).
- **Fix (adapter rewritten):** branch on `result.data.mode` —
  - `canonical` → read `users/{uid}/list_progress/{listId}` LOCALLY (real Timestamps; wire
    timestamps are serialized), fallback to the callable's `result.data.data`; SYNTHESIZE
    `progress = {id: `${classId}_${listId}`, classId, listId, ...canonicalData}`. Resolver
    SUCCEEDED → never fail here (the P6-2 fix, point 3).
  - `quarantined` → return null → caller fails closed (safe; deliberate study block, P5/P6 UX
    is out of P4 scope — flagged).
  - `legacy`/default → read the launching `class_progress` locally (as today); if unexpectedly
    absent, SYNTHESIZE from `result.data.launch.data` rather than false-failing; only a truly
    empty result returns null.
  - `catch` → genuine resolver error/unavailable → null → caller fails closed.
- **`attempts`:** kept `getRecentAttemptsForClassList(userId, classId, listId, 8)` (P4 parity,
  point 2). NOTE flagged: post-P5 the canonical record is list-scoped, so a list-scoped attempts
  fetch may be more correct — a P5 follow-up (U16), NOT changed here.
- **Flag-off equivalence:** the helper runs ONLY under `SERVER_PROGRESS_WRITE` — flag off, this
  code is unreachable (byte-equivalent). node babel-parse OK; eslint delta vs HEAD = 0.

### 13 · P6-3 — raw-denial logging made consistent
Closes the MED. `TypedTest.jsx` + `MCQTest.jsx` studyDay-derivation catches now split
`isResolverDown` vs `isDenied` (mirroring DailySessionFlow) and log `legacy_write_denied`
(with `phase:'test-entry-studyday'`, testType) on the RAW `permission-denied` case — the
resolver-unavailable case stays logged only at its source (no double-count). Controlled UX
unchanged. eslint delta vs HEAD = 0 on both.

### Task-6 personas (added)
- **P6-2 canonical-success:** canonical `list_progress` EXISTS, launching `class_progress`
  MISSING (post-P5 fresh/collapsed) → session entry SUCCEEDS via the synthesized progress with
  NO client write and NO `progress_resolver_unavailable` (regression guard for the exact bug).
- **(from item 11) resolver-unavailable:** genuine resolver outage → controlled reload + log,
  no client write.

---

## Flag-off byte-equivalence audit (Run-L)
| Change | Flag-off behavior |
|---|---|
| featureFlags additions | comments + two unused `false` consts — inert |
| studyService routing + summary field | early-return not taken; `...( false ? {..} : {} )` spreads nothing |
| progressService hydration + teacher read | guards short-circuit; legacy code paths untouched byte-for-byte |
| db.js reset routing | guard short-circuits after the identical pre-checks |
| Dashboard effect/memo | effect no-ops; memo adds a never-changing null dep |
| permission-denied handlers | inside existing catches, on a today-unreachable error code |
| TypedTest F1/F2 | healthy storage: both old derivations read the SAME persisted nonce → identical docId; echo absent from deployed prod → `??` fallback. Degraded storage differs BY DESIGN (U1) |
| db.js challenge day-advance (item 10) | flag-off runs the original direct-write block verbatim in the `else` branch — byte-for-byte pre-edit behavior |
| R1 fail-closed + entry-time handlers (item 11) | Part 1 gated on `SERVER_PROGRESS_WRITE`; Part 2 gated on error codes that can't fire pre-P6 with the flag off → flag-off hydration falls through unchanged, page catches hit only `console.error` |
| testRecovery F3/F4 | healthy storage: same read/mint/persist sequence, same values (U1 covers the deltas) |
| build stamp | always-on but observability-only (U2) |

## What P4 acceptance still needs (not runnable here — Task 6 / deploy gate)
Bundle greps as LIVE-path asserts (item 6 note); persist §9 personas + reset-via-callable +
teacher-Students-view + storage-stubbed nonce run (Storage getItem/setItem throw → typed
grade→save keeps ONE docId — the F5 gate before any GRADE_TOKEN_ENFORCED re-arm);
`list_progress` empty-collection assert on every load; `impossible_phase` trend; C-14 sandbox
path; the G0-G5 deploy-gate checklist with the NEW flags added to the G1 table (both must read
`false` at the P3 deploy, `true` only at the P4 hosting cutover).

---

## UNCERTAINTIES — explicit list for reviewers

- **U1 (nonce F1/F3/F4 ship UNFLAGGED — deliberate, but it is the one behavior delta with flags
  off).** The plan treats F1/F3 as correctness fixes, not routing (I-5 §2: "smallest-diff",
  gating the RE-ARM on F5 acceptance — not gating the fix itself), and the healthy-storage path
  is value-identical. The deltas, all confined to broken-storage scenarios: (a) degraded storage
  now yields ONE docId per page load instead of a fresh one per call — the fix; (b) if some
  out-of-band actor clears the localStorage nonce mid-session, the old code minted anew, the new
  code returns the memoized value (correct for idempotency; different); (c) storage that fails on
  read but works on write behaves as (a). If reviewers want strict Run-L, F3 could check a flag —
  but then the 06-29 class of bug persists until the flip, and F5's storage-stubbed acceptance
  would gate on the flag too. Needs sign-off, not code change, in my view.
- **U2 (build stamp always-on).** Not flag-gated (a provenance probe that's off is not a probe).
  Bundle content changes on every build by design (`builtAt`). Zero behavioral surface; whole
  probe body try/caught.
- **U3 (completion-return shape under the flag).** The server 'completed'/'already_completed'
  `progress` carries `{id, currentStudyDay, totalWordsIntroduced, interventionLevel, stats,
  streakDays}` — NOT the full legacy doc (no recentSessions/lastStudyDate/programStartDate).
  Verified consumers only read the carried fields (+`dayGuardRejected`); DailySessionFlow
  re-reads `getClassProgress` for its progress-info panel anyway (:1507). Any FUTURE consumer of
  `result.progress.recentSessions` would break flag-on — flagged for the P4 persona suite.
- **U4 ('already_completed' lets graduation re-run).** Legacy treated every non-expected-day as a
  rejection sentinel → `completeSessionFromTest` aborted before `graduateSegmentWords`. The
  server discriminates a committed-retry as success-shaped, so the caller proceeds to graduation
  — acceptable because graduation is status-idempotent (same segment, same score → same MASTERED
  set), but it is a semantic delta on the retry path. P3's U2 (collision ambiguity) also folds in
  here: an ambiguous genuine collision returns already_completed and would graduate the CLIENT's
  segment. Characterize in the sandbox suite.
- **U5 (resolver-routed hydration does a local re-read instead of consuming the callable's doc).**
  The callable's returned doc crosses the wire with serialized timestamps (plain objects, no
  `.toDate()`), which would break every Timestamp consumer — so the route re-reads the reconciled
  legacy doc locally (1 extra read; a concurrent write between the resolve and the read yields a
  NEWER doc, same as today's non-transactional entry path). Post-P5 canonical mode leaves no
  legacy doc for the launching class on fresh students → the route falls back to the LEGACY
  client path (which would then create a legacy doc — pre-P5 semantics). **The P5 cutover must
  revisit this client leg** (make the canonical doc the local read target). Fine for P4's
  pre-P5 window, explicitly flagged for P5.
- **U6 (hydration fail behavior) — SUPERSEDED by items 11+12 (Codex P6 R1 + P6-2 fixes).** The
  original draft failed OPEN (resolver outage → legacy client recon write). That is now a
  fail-CLOSED typed `progress_resolver_unavailable` under the flag (item 11), and the adapter now
  consumes the callable result so a canonical-mode SUCCESS never false-fails (item 12). Flag-on
  performs NO client recon write on any path. The only residual client recon write with the flag
  on is if `auth.currentUser?.uid !== userId` (no such caller exists — getOrCreateClassProgress is
  self-only), which the guard leaves on the legacy path.
- **U16 (post-P5 list-scoped attempts).** The resolver adapter's canonical branch (item 12) still
  fetches `attempts` class+list-scoped (`getRecentAttemptsForClassList`), matching P4. Post-P5 the
  canonical record is list-scoped (one per student+list across classes), so a list-scoped attempts
  fetch may be more correct for downstream phase/orphan use. Left as a P5 follow-up (P4 parity now);
  flagged for the P5 client-leg revisit (same revisit as U5). Also: `mode:'quarantined'` currently
  fails closed with the generic reload UX — a quarantine is a deliberate manual-triage block that a
  reload won't clear; a dedicated quarantine UX is P5/P6 work, out of P4 scope.
- **U7 (teacher canonical read maps the RAW canonical doc, not a per-class view).** Post-P5 the
  canonical doc is list-scoped: `classId`-specific fields are gone and csd/twi reflect the merged
  record. ClassDetail renders per-(student,list) numbers, so semantics match the migration's
  intent (day = session count for the list), but a teacher of a SLOWER class sees the cross-class
  merged day, not "their class's" day. That IS the foundation model (one record per student+list)
  — noting it as a product-visible change at P5, not P4 (pre-P5 the branch never hits).
- **U8 (Dashboard uses the MERGED view; Panel C only).** Without classId the resolver returns the
  merged cross-doc csd — correct for the foundation model and safe for the day-guard (Panel C is
  render-only; session entry still resolves per launching class via item 4). Weekly-goal Panel A
  and the activity chart still read raw progressData — the plan's "Dashboard panel C" scoping was
  taken literally; extending to A/B is trivial if reviewers want it.
- **U9 (blocking UX of the legacy_write_denied handler).** Persist [C6-2] mandates "blocking
  reload state, NOT the results screen". Implemented as the pages' existing error banners +
  early-return (no results, no navigation) — not a modal. The banner text is bilingual per house
  style. If reviewers want the full-screen takeover, that's a P6-adjacent UX task; the
  server-visible event (the load-bearing leg) is in.
- **U10 (`clientWordsIntroduced` only flows on the completeSessionFromTest path).**
  DailySessionFlow's direct `recordSessionCompletion` caller (:1484) has no computed
  reviewOnlyDay preview → no tripwire fields from that path (server still derives + acts
  authoritatively; only the mismatch LOG loses that leg's client vote). The plan's
  "reviewonly_derivation_mismatch" fold is otherwise complete (server leg P3, client leg here).
- **U11 (callable timeouts assumed).** `completeSession`/`resolveListProgress` 30s,
  `resetProgress` 60s — chosen to match the house pattern (submitVocabAttempt 30s) and the
  reset's batched-delete worst case. Not plan-specified.
- **U12 (no build/runtime execution).** `vite build`/dev-server can't run here (esbuild binary is
  win32); Playwright/emulator unavailable. Verification = babel parse + line-by-line contract
  tracing against foundation.js/index.js in this tree. The define-identifier
  (`__VOCABOOST_BUILD_INFO__`) replacement and the Dashboard effect need one real build + smoke
  on the Windows env before the cutover build is cut.
- **U13 — CLOSED (F5-HIGH-2, 3rd-twi-writer routing) + remaining open items.**
  **CLOSED:** `reviewChallenge`'s day-advance now routes to `advanceForChallenge` under
  `SERVER_CHALLENGE_WRITE` — see the "Item 10" section below. Remaining open FIX_PLAN-P4 items
  still OUTSIDE this draft: (b) the persist §6 P2 bundle-grep harness itself (an audit artifact,
  Task 4/6); (c) the G1-table extension for the two new flags (deploy-runbook doc). Flagged so
  the P4 deploy checklist can't miss them.
- **U15 (Dashboard hooks after the teacher early-return — +2 rules-of-hooks findings).**
  Dashboard.jsx returns the ENTIRE teacher dashboard early (~:815-1034), so every student-side
  hook after it is "conditionally called" — 9 pre-existing violations at HEAD (getPrimaryFocus
  :1038, panel memos, the modal useStates). My Panel C useState/useEffect (:1203-1204) must sit
  AFTER `getPrimaryFocus` (the effect's dep array reads it inline — hoisting above the early
  return would hit the const TDZ), so it inherits the same pattern: +2 findings of the identical
  class. Benign for the same reason the existing 9 are: `isTeacher` derives from `user.role` and
  is stable for a mounted Dashboard, so hook ORDER never actually changes between renders of one
  mount. The real fix (hoist the teacher branch into a separate component) is a refactor outside
  P4's scope — flagged, not attempted.
- **U14 (F6-2 letter vs implementation).** The plan says route the teacher read "through the
  READ-ONLY resolveListProgress"; the callable is self-service (`uid = request.auth.uid`,
  foundation.js:1181-1182 — no studentId param), so a teacher literally cannot call it for a
  student. Implemented as the callable's own read ORDER done client-side (canonical-first,
  legacy fallback) under the teacher-read rule. Alternatives if reviewers want the literal
  callable: add a teacher-authorized `studentId` param to resolveListProgress (P3 surface change
  + N×M callable fan-out cost on the Students view). Needs adjudication; the failure mode the
  plan targets (freeze at P5 / break at P7) is closed either way.
