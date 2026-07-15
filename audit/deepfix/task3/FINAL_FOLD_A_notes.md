# FINAL FOLD A — foundation server-security findings (stream A)

**Program:** deepfix Task 3 — FINAL whole-surface review fold, **stream A (foundation server security)**.
**Date:** 2026-07-14. **Status:** LOCAL-ONLY draft. No git commit/branch, no deploy, no live-Firebase
write. `change_action_log.md` NOT touched (per binding constraint).

Folds F-2, F-4, F-3, F-6, F-5, F-7, F-12 from `FINAL_REVIEW_FINDINGS.md`. All in
`functions/foundation.js` + `functions/index.js`, plus ONE careful live-reader touch in
`src/services/db.js` (F-6). Diff: `audit/deepfix/task3/final_fold_a.patch` (git-apply-clean +
byte-identical round-trip verified against a pre-fold baseline).

## Validation performed
| Check | Result |
|---|---|
| `node --check functions/foundation.js` | OK |
| `node --check functions/index.js` | OK |
| `src/services/db.js` (ESM) | parses under eslint's module parser (OK) |
| **eslint delta vs reconstructed pre-fold baseline** | **0 / 0 / 0** (foundation 9→9, index 33→33, db 8→8 — all pre-existing `no-undef` env noise / `_`-unused idiom; NONE added) |
| `final_fold_a.patch` `git apply --check` (on fresh baselines) | CLEAN |
| Patch round-trip (`cmp` post-apply vs current) | byte-identical for all 3 files |

To keep the eslint delta at 0, the two `catch` blocks I added use **optional catch binding**
(`} catch {`) — the functions config flags `catch (_)` as `no-unused-vars` (4 pre-existing) and the
src config flags `catch (metaErr)`; optional binding adds neither.

## Dormancy posture (why the fold is safe to merge dark)
Every foundation callable stays gated behind `FOUNDATION_FLAGS` (all `false`):
`SERVER_COMPLETE_SESSION_ENABLED`, `SERVER_RESOLVE_LIST_PROGRESS_ENABLED`,
`SERVER_RESET_PROGRESS_ENABLED`, `SERVER_OVERRIDE_ENABLED`, `ANCHOR_VALIDATION_SHADOW`,
`ANCHOR_VALIDATION_ENFORCE`, `LIST_PROGRESS_CANONICAL`. **No flag flipped.** Reachability re-verified:
`getListAnchor` ← `computeAnchorPosition` ← `resolveListProgress` ONLY (foundation.js:1431) → dormant;
`validateAttemptAnchorShadow` is a bare `await` in `writeAttemptTxn` whose return is ignored.

---

## F-2 (HIGH) — wire the M4 enforce branch  [foundation.js `validateAttemptAnchorShadow`; index.js comment]
**Change.** Completed the P3-U9-deferred enforcement. The function now:
- runs when `ANCHOR_VALIDATION_SHADOW` **OR** `ANCHOR_VALIDATION_ENFORCE` is armed (guard was
  `!SHADOW` → now `!SHADOW && !ENFORCE`) so enforce can't be silently skipped if someone flips only
  ENFORCE;
- logs `anchor_rejected` with `shadow: !ENFORCE, enforced: ENFORCE` (was hard-coded `shadow:true,
  enforced:false`);
- accumulates `detectedViolations`, and **AFTER** the read try/catch (so it is not swallowed) throws
  `failed-precondition` when `ENFORCE && violations.length>0` → the write is REJECTED (aborts before
  `writeAttemptTxn`'s transaction). Returns `{violations}` (caller ignores it; the throw is the
  enforcement leg). Chose **reject** over clamp: reject is the conservative, non-invasive close of
  C-31; clamp (rewriting the anchor) is riskier and the shadow soak has not yet decided clamp-vs-deny.

**Byte-equivalence (flag-off).** Both flags `false` → the guard returns `{violations:[]}` immediately
with ZERO reads; the ignored return value changes nothing. **SHADOW-only** (`SHADOW=true,
ENFORCE=false`, the P3–P6 soak state): `shadow:!false=true`, `enforced:false` — byte-identical log to
before; the enforce `if` is false → never throws. Enforcement fires ONLY when `ENFORCE=true` (P6).
Read-error path fails **open** (`{violations:[], readError:true}`, never throws) — a legit write is
never blocked by our own infra hiccup.

**Docs now match reality (note only — NOT edited by stream A):** `firestore.rules` header, the P6
notes, and FIX_PLAN P6d all describe an enforcing M4 backstop; it is now actually wired (dormant).

**Uncertainty.** Read-error fail-OPEN means a forger who could induce anchor-read errors would bypass
enforcement. This is a much narrower attack than the open forward-anchor F-2 closes, and matches the
"shadow must never affect the live write path" rule; P6 can tighten to fail-closed with soak data if
desired. Flagged, not guessed.

## F-4 (HIGH) — completeSession evidence requirement  [foundation.js `completeSession`, `countPostAnchorReviewDays`]
**Change (two legs).**
1. **Evidence gate inside the txn** (after `reviewOnlyDay` is derived, before any write): advance ONLY
   when `hasNewAnchor` (a day-N passed `new` attempt — `dayNewPass`, list-wide under LIST_SCOPED_RECON)
   **OR** `reviewOnlyDay` (a server-verified review-only reason: allocationZero / listComplete /
   reviewStudyResume — all already computed). Otherwise the txn returns `{status:"no_evidence"}` and
   writes NOTHING. Post-txn: logs `complete_session_no_evidence` and returns a non-advancing result;
   the session_states doc is **not** cleared (unlike a day-guard collision) so a student who simply
   needs to pass the day's test can retry. The transactional day-guard + idempotency (`already_completed`
   / `day_guard_rejected`) legs are untouched — the gate sits only on the actual-advance path.
2. **Exclude `autoCompleted` markers from `evidencedReviewDays`**: `countPostAnchorReviewDays` now skips
   review attempts with `autoCompleted === true` (the client automarker `DailySessionFlow.jsx:1080` and
   the server W2 marker `foundation.js:818` both set it). Auto-markers are "no review available"
   stand-ins, not durable student review evidence, so they must not legitimise a pumped CSD in the
   plausibility screen.

**Byte-equivalence (flag-off).** `completeSession` is behind `SERVER_COMPLETE_SESSION_ENABLED=false`
and `countPostAnchorReviewDays` is reached only via `resolveListProgress`
(`SERVER_RESOLVE_LIST_PROGRESS_ENABLED=false`) — both dormant. No reachable path changes.

**Coordination / uncertainty.** The P5 migration's own review-evidence counter (stream C,
`scripts/cs/deepfix-migrate-list-progress.mjs`) must apply the SAME `autoCompleted` exclusion — noted
in-code and here; NOT changed by stream A. Also: the P4 client shim must handle the new `no_evidence`
status. Theoretical async-grading race (completeSession called before the day's attempt is queryable)
— Firestore reads/queries are strongly consistent, but flag for the P4 sandbox to confirm the day's
passed-new attempt is always visible at completion time.

## F-3 (HIGH) — resetProgress canonical zero  [foundation.js `resetProgress` step 5]
**Change.** Split the epoch-stamp `set()`. In canonical mode (`LIST_PROGRESS_CANONICAL=true`), the SAME
`set(canonicalProgressRef, …, {merge:true})` that stamps `{resetEpoch, resetAt, resetBy}` now ALSO
writes default-shape zeros: `currentStudyDay:0, totalWordsIntroduced:0, interventionLevel:0,
recentSessions:[], stats:{avgNewWordScore:null,avgReviewScore:null}, streakDays:0, lastStudyDate:null,
lastSessionAt:null`, a fresh `programStartDate: mondayOfWeekTimestamp()`, `updatedAt`. The legacy/pre-P5
branch (epoch tombstone in `users/{uid}/progress_meta/{listId}`, merge:true) is **unchanged**.

**Byte-equivalence (flag-off + pre-P5).** Whole callable behind `SERVER_RESET_PROGRESS_ENABLED=false`.
Additionally, `LIST_PROGRESS_CANONICAL=false` in this tree → the canonical branch is unreachable; the
else-branch is character-identical to the old single `set(progress_meta, epochStamp, {merge:true})`.

## F-6 (HIGH, CAREFUL — touches a LIVE reader) — reset-epoch filter
**Server `getListAnchor` (foundation.js).** Added `getResetAtServer(uid, listId)` (reads the tombstone
from the canonical doc when `LIST_PROGRESS_CANONICAL`, else `progress_meta` — mirrors
`durableProgressRef` / `resetProgress` step 5) and an in-memory `notPreReset` predicate. The position
loop's `validDoc` predicate and the studyDay fallback now exclude attempts with `submittedAt < resetAt`.
Reached only via the dormant resolver.

**Live client reader `getMostRecentPassedNewTest` (db.js).** Same filter, **gated behind
`SERVER_RESET_PROGRESS`** (already imported): when the flag is off (today) there is ZERO extra read and
`notPreReset` never fires → byte-IDENTICAL. This is the "careful db.js anchor-reader touch" the task
header calls for.

**Byte-equivalence (pre-reset / flag-off) — the key argument.** The reset-epoch tombstone has EXACTLY
ONE writer: the dormant server `resetProgress` (`SERVER_RESET_PROGRESS_ENABLED=false`). The legacy
client reset (`db.js resetStudentProgress`, the reachable path) batch-deletes and writes NO tombstone.
Therefore **no `resetAt` exists anywhere in prod**, so:
- foundation `getResetAtServer` → null → `resetMs=null` → `notPreReset` always true → the `validDoc`
  predicate reduces to the exact original `Number.isInteger(v) && v>=0`; the fallback returns the same
  doc. (Also unreachable: resolver dormant.)
- db.js: the tombstone read is inside `if (SERVER_RESET_PROGRESS)` (false) → skipped entirely →
  `resetMs=null` → identical selection, zero added reads.
The filter activates exactly when tombstones can exist (server reset routed on), so writer and consumer
turn on together — no window where a tombstone is ignored.

**Decision on the ambiguity (flagged).** The F-6 fold text says "note the client
`getMostRecentPassedNewTest` for stream C," but the task header lists "a careful `db.js` anchor-reader
touch" as part of stream A and the binding constraint states "F-6 touches a LIVE anchor reader … MUST
stay byte-equivalent for data with no `resetAt`" — which only applies to the live db.js reader
(`getListAnchor` is dormant). I resolved this by implementing the db.js touch **flag-gated** (fully
dormant/byte-identical now) rather than the always-read form the finding describes; this is strictly
more conservative and matches the dormant-draft philosophy. If the orchestrator intended the db.js
reader to be stream C's, this hunk can be dropped without affecting the other six fixes.

**Uncertainties.** (a) The db.js filter reads the **pre-P5** tombstone location (`progress_meta`);
post-P5 the tombstone moves to the canonical doc, but by then the client reconciles via
`resolveListProgress`, not this reader — a post-P5 canonical-location fold for this reader is a
follow-up (note for stream C / P5). (b) The studyDay-fallback leg is `limit(1)`: a pre-reset straggler
there yields `status:'none'` rather than paginating to a deeper post-reset anchor — conservative
(preserves the reset), byte-equivalent when no `resetAt`, flagged. (c) **`progress_meta` → P5 migration
canonical read**: the migration must fold `progress_meta` (resetAt/resetEpoch) into the canonical doc
it writes — this is stream C's / the migration's (`deepfix-migrate-list-progress.mjs`), NOT foundation.js
— NOTED, not implemented.

## F-5 (MED) — overrideAttempt anchor list-match + clamp  [foundation.js `overrideAttempt`]
**Change.** (1) The day-1 pace finder's `.find` now matches `a.listId === tListId` in addition to
`a.classId === tClassId` (deterministic — the old class-only match could pick a day-1 anchor from a
DIFFERENT list under the same class and derive a wrong pace). (2) Hoisted the list-size read + effective
cycling resolve ABOVE the range computation; on a NON-cycling list the anchor's `newWordEndIndex` is
clamped to `totalListWords − 1` (so reconciliation `twi = nwei+1` can never exceed the list — the
"twi 400 on a 300-word list" forgery), and `newWordStartIndex` is clamped to `≤ newWordEndIndex` so the
clamp cannot produce a negative `wordsIntroduced`. Under cycling the virtual index legitimately climbs
past the list each lap → NOT clamped (parity with the M4/allocation lap logic). The later `if (passed)`
block now REUSES the hoisted `totalListWords`/`cycling` (removed a duplicate list read + cycling
resolve).

**Byte-equivalence (flag-off).** `overrideAttempt` is behind `SERVER_OVERRIDE_ENABLED=false` → dormant.
The `newWordStartIndex ≤ newWordEndIndex` guard is a minimal consistency addition (prevents my own
clamp from minting a negative `wordsIntroduced`); flagged as slightly beyond the finding's literal
"clamp nwei" but necessary to avoid introducing a defect via the fix.

## F-7 (MED) — resolver quarantine align  [foundation.js `resolveListProgress` hydration]
**Change.** The `twiSuspect` second leg went from `anchor.anchorStatus === "none" && stored>0` to
`!anchor.hasValidData && stored>0`. Now it fires for ANY not-valid-anchor status (none **or
invalid-anchor** or query-error), aligning the resolver with the P5 migration's `ANCHORLESS_TWI` rule
(`!hasValidData && twi>0`). Previously an `invalid-anchor` stored `twi>0` could canonicalise here while
the migration would quarantine it — resolver looser than migration.

**Byte-equivalence (flag-off).** Reached only via the dormant `resolveListProgress` → no reachable
change. `hasValidData===true` still routes through the first leg (`stored > anchor.twi`), unchanged.

## F-12 (LOW) — assertOverrideTargetAuthz legacy assignedLists  [foundation.js]
**Change.** The "class assigns the list" gate now accepts legacy `assignedLists.includes(listId)` in
addition to `assignments[listId]`, matching the sibling gates (`assertEnrolledAssigned` :291-293,
`computeTeacherIdsForAttempt` :1889-1892). A legitimate legacy-assigned target is no longer wrongly
rejected.

**Byte-equivalence (flag-off).** Behind `SERVER_OVERRIDE_ENABLED=false` (no-attemptId override path) →
dormant. The change only ADMITS more (legacy) assignments; a class assigning via `assignments[listId]`
is unaffected.

---

## Could NOT / did NOT safely fix (flagged, not guessed)
- **F-6 db.js scope ambiguity** (see F-6 above) — implemented flag-gated + flagged for orchestrator
  confirmation; droppable in isolation.
- **F-6 progress_meta → P5 migration canonical read** — belongs to stream C / the migration script;
  NOTED only.
- **F-4 migration counter `autoCompleted` exclusion** — stream C's; NOTED only.
- **F-2 read-error fail-open** — deliberate; P6 owner may tighten with soak data.

## Streams NOT touched (confirmed)
Stream A edited ONLY `functions/foundation.js`, `functions/index.js`, `src/services/db.js`
(`getMostRecentPassedNewTest`). **Not touched:** `firestore.rules` (stream B / F-1), `src/pages/Signup.jsx`
(F-8), any `scripts/` (F-13), ClassDetail/DailySessionFlow (N-1/2/F-10), the migration script
(N-3/F-4-counter/F-6-progress_meta). `change_action_log.md` NOT touched (binding constraint).

---

# ADDENDUM — F-4 CLIENT counterpart (Codex FINAL2-1 blocker) → `final_fold_a2.patch`

**Date:** 2026-07-14. Codex delta re-review (`codex_deepfix_task3_final_002.md`) cleared everything
except **FINAL2-1**: the F-4 server evidence gate was server-only — `completeSession` correctly returns
`{status:'no_evidence', advanced:false}` and writes nothing, but the CLIENT fell through to the
success/`completed` path, wrote a `users/{uid}/sessions` history record, and could `graduateSegmentWords`
for a completion the server refused. This addendum wires the client half. Second patch:
`audit/deepfix/task3/final_fold_a2.patch` (git-apply-clean + byte-identical round-trip).

**Files.** `src/services/studyService.js` (LF), `src/pages/TypedTest.jsx` (LF), `src/pages/MCQTest.jsx`
(LF), `src/pages/DailySessionFlow.jsx` (CRLF). 4 files.

**Changes.**
1. `recordSessionCompletionViaServer` (studyService.js): explicit `if (data.status === 'no_evidence')`
   branch BEFORE the `completed` path → returns the blocking sentinel
   `{sessionId:null, progress:null, completionNotApplied:true, reason:'no_evidence'}` and writes NO
   session-history record. Plus a **fail-closed** guard: `data.status != null && data.status !== 'completed'`
   → same blocking sentinel (`reason:<status>`). Only `'completed'` — or a legacy payload that omits
   `status` (pre-status callable contract) — takes the success + history-write path. Docstring
   (:910-925) updated to document `no_evidence` + the fail-closed unknown-status contract +
   `completionNotApplied`.
2. `completeSessionFromTest` (studyService.js): propagates `completionNotApplied` (mirroring the
   `dayGuardRejected` block) BEFORE `graduateSegmentWords` → returns
   `{sessionId:null, progress:null, graduated:0, completionNotApplied:true, reason}` so no words
   graduate and no success is presented.
3. `TypedTest.jsx` / `MCQTest.jsx`: added a `completion?.completionNotApplied` block after
   `requiresSessionRebuild`, showing the same class of blocking UX (`setGradingError` /
   `setSubmitError` + early return; TypedTest also `setIsSubmitting(false)`, matching its siblings) —
   a bilingual "this day can't be completed yet — pass the new-word test, then retry/reload" message,
   never a results screen.
4. `DailySessionFlow.jsx` (`completeSession`, after `recordSessionCompletion` :1529): added an
   `if (result?.completionNotApplied)` guard BEFORE `graduateSegmentWords` and the `PHASES.COMPLETE`
   advance → does NOT graduate, does NOT present the COMPLETE screen; instead `setError(...)` with the
   same bilingual "pass the new-word test, then retry/reload" message (the file's existing blocking-
   error mechanism, mirroring its legacy-write-cutoff path) and early-returns. This closes the
   FINAL2-1 gap via the DSF direct-completion path (the parallel one flagged in round 2).

**Byte-equivalence (flag-off — `SERVER_PROGRESS_WRITE=false`).** `recordSessionCompletion` routes to
`recordSessionCompletionViaServer` ONLY under `SERVER_PROGRESS_WRITE` (studyService.js:796); the legacy
path NEVER sets `completionNotApplied` (verified :790-875 — it returns success shapes or
`dayGuardRejected` only). So `completionNotApplied` is produced solely on the flag-ON path. Therefore:
`completeSessionFromTest`'s new `if (result?.completionNotApplied)`, the two test-page
`if (completion?.completionNotApplied)` branches, and the DSF `if (result?.completionNotApplied)` guard
are all **unreachable when the flag is off** → the legacy client flow is byte-identical to today. (The
`recordSessionCompletionViaServer` edits are themselves in the flag-ON-only function.) DSF specifically:
`completionNotApplied` is produced only by `recordSessionCompletionViaServer`, reached only under
`SERVER_PROGRESS_WRITE`; flag-off ⇒ DSF's `result.completionNotApplied` is always falsy ⇒ graduation +
`PHASES.COMPLETE` run exactly as today.

**Validation.** eslint delta **0** vs reconstructed pre-fix baselines (studyService 4→4, TypedTest 5→5,
MCQTest 6→6, DailySessionFlow 4→4 — pre-existing findings only). All 4 parse cleanly under eslint (no
parsing errors; `esbuild` CLI unavailable in this env — win32 native binary in a WSL/linux
node_modules, unrelated to the code). `final_fold_a2.patch` `git apply --check` CLEAN on fresh
baselines; round-trip `cmp` byte-identical for all 4 files (DSF hunk carries CRLF context to match the
file).

## FLAGGED SEPARATE FINDING (NOT fixed here) — DSF `dayGuardRejected` false-success (PRE-EXISTING)
`src/pages/DailySessionFlow.jsx` `completeSession` (after `recordSessionCompletion` :1529) checks
neither the day-guard rejection sentinel. Unlike `completionNotApplied` (dormant behind
`SERVER_PROGRESS_WRITE`), `dayGuardRejected` can be set **in CURRENT production**: the legacy
`recordSessionCompletion` path returns `{dayGuardRejected:true}` under `LIST_SCOPED_RECON` (ON in prod)
when the day counter moved out from under the session (a stale/duplicate DSF completion). So today, that
rare case falsely graduates + presents `PHASES.COMPLETE` instead of routing to a session rebuild.
Adding a `dayGuardRejected` block at :1529 would therefore **change live behavior** (false-success →
blocked) — OUTSIDE the deepfix byte-equivalence scope, and explicitly **out of scope** per the
coordinator. **Recommendation:** David fix it in a dedicated, non-byte-equivalent change (mirror the
`requiresSessionRebuild` UX the test pages already use for this exact case). Not introduced by F-4;
documented here so it is not lost.
