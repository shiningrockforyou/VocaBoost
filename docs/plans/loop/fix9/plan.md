# PLAN — Fix NEED_TO_FIX #9 (flag-ON cross-class review completion) — v2 (loop draft)

**Slug:** fix9 · **Status:** DRAFT for the Claude⇄Codex review loop · **Author:** Claude
**Fixes** `NEED_TO_FIX #9` — the three-part coupled bug the Run S loop uncovered. **Acceptance:** the Run S
S-1/S-3 oracle (`docs/plans/loop/runs/plan.md` v5) flips EXPECTED-RED → PASS. All changes behind
`LIST_SCOPED_RECON` (already ON) — flag-off path byte-unchanged.

## 0. The bug (recap, all verified against code)
A student passes Day-D new words in class A → leaves before review → resumes the same list in class B →
completes the Day-D review in B. Three coupled failures:
1. **Spurious retake** — the completion gate can't find A's pass (wrong `expectedBase`).
2. **TWI double-advance** — completing the B review re-adds a new-word count → `twi 2p → 3p` (day skip).
3. **A/B divergence** — the review (done in B) isn't seen when reconciling the anchor in A → A stays
   review-pending while B is done.

## 1. Root cause
`initializeDailySession` (`studyService.js:169-264`) builds the new-word allocation **unconditionally** from
the reconciled `totalWordsIntroduced`:
- `newWordCount = min(allocation.newWords, wordsRemaining)` (`:235`)
- `newWordStartIndex = totalWordsIntroduced` (`:253`), `newWordEndIndex = totalWordsIntroduced + newWordCount − 1`
It does this **even when `determineStartingPhase` (`:238`) says the day is a REVIEW resume** — i.e. the day's
new words were already passed (possibly in another class). So the session carries a bogus new-word window
(base = the already-advanced twi `2p`, count = `pace`). That single wrong allocation is the shared root of
bugs 1 & 2:
- `completeSessionFromTest` passes `expectedBase = sessionConfig.newWordStartIndex = 2p` to the gate
  (`studyService.js:1319`), but A's passed attempt is at the day base `p` → no match → retake (**bug 1**).
- `wordsIntroduced = sessionConfig.newWordCount = pace` (`studyService.js:1269`) → `recordSessionCompletion`
  adds it (`progressService.js:462`) → `twi 2p → 3p` (**bug 2**).
Bug 3 is separate: `getReviewForDay` pairs the review to the **anchor's class** only.

## 2. Fix A (bugs 1 & 2) — REVIEW-resume allocation: count=0 but PRESERVE the anchor range
In `initializeDailySession`, after `determineStartingPhase`, when the phase is `REVIEW_STUDY` (a passed `new`
attempt exists for `currentStudyDay`), OVERRIDE the new-word fields from that attempt. **Split "introduced
now" (count=0) from "the day's anchor range" (start/end = the passed attempt's) [Codex F9-2]:**
```
// after phaseInfo = determineStartingPhase(attempts, currentStudyDay)
let nwCount = newWordCount, nwStart = totalWordsIntroduced, nwEnd = totalWordsIntroduced + newWordCount - 1;
if (LIST_SCOPED_RECON && phaseInfo.phase === SESSION_PHASE.REVIEW_STUDY) {
  const dayNewPass = attempts
    .filter(a => a.studyDay === currentStudyDay && a.sessionType === 'new')
    .sort((a,b) => (Number(b.passed===true)-Number(a.passed===true)) || ((b.score??0)-(a.score??0)))[0];
  if (dayNewPass) {
    nwCount = 0;                                   // new already introduced — do NOT re-count
    // Preserve the DAY's anchor range on the (subsequent) review attempt so Fix B can verify
    // position-consistency. Prefer stored indices; derive defensively for legacy attempts.
    nwEnd   = Number.isInteger(dayNewPass.newWordEndIndex)   ? dayNewPass.newWordEndIndex   : (totalWordsIntroduced - 1);
    nwStart = Number.isInteger(dayNewPass.newWordStartIndex) ? dayNewPass.newWordStartIndex
              : (Number.isInteger(dayNewPass.newWordEndIndex) ? dayNewPass.newWordEndIndex - (dailyPace - 1) : nwEnd + 1 - 0);
  }
}
// return: newWordCount: nwCount, newWordStartIndex: nwStart, newWordEndIndex: nwEnd
```
- **`newWordEndIndex = dayNewPass.newWordEndIndex` (NOT `nwStart-1`)** [F9-2]: the review attempt persists
  `newWordStartIndex/newWordEndIndex` from sessionContext (`db.js:1229-1230, 1393-1394` — verified), so the B
  review attempt now carries the anchor range `p..2p-1`, which Fix B needs to prove B's review completed A's
  anchor day. An empty `nwStart-1` range would destroy that lineage.
- **Bug 1 fixed:** `expectedBase = sessionConfig.newWordStartIndex = p` → matches A's attempt → gate finds it.
- **Bug 2 fixed:** but `newWordCount=0` is FALSY, and `completeSessionFromTest` computes
  `wordsIntroduced = sessionConfig.newWordCount || newWords.length || 0` (`studyService.js:1269`) → falls
  through to `newWords.length`. Harmless in the primary path (`newWords: []`) BUT the **reload-to-test
  recovery** persists `newWords = the review pool` (`DailySessionFlow.jsx:700`), so a reload mid-review would
  re-add `reviewCount` to twi (edge-agent BLOCKER — verified). **So Fix A MUST also patch `:1269`** to treat
  an explicit `0` as authoritative: `wordsIntroduced = Number.isFinite(sessionConfig?.newWordCount) ?
  sessionConfig.newWordCount : (newWords?.length || 0)`.
- **Legacy attempts** [edge MED / correctness NIT]: `determineStartingPhase` keys REVIEW_STUDY on
  `newTest.passed` only — a legacy passed attempt missing the index fields still yields REVIEW_STUDY. The
  override now still forces `nwCount=0` (new was provably introduced) and derives the range defensively rather
  than reverting to the post-pass twi.
- **Selection mirrors `determineStartingPhase`** (passed-first, score-desc) → same attempt the phase decision
  used; failed-then-passed picks the PASSED base (S-2/S-3 safe — verified, both share base `p`).
- **No regression to a normal new-word day:** phase there is `NEW_WORDS_STUDY` → override doesn't fire.

## 3. Fix B (bug 3) — POSITION-consistent cross-class review pairing (not just studyDay+time)
**v1 was WRONG** [Codex F9-1, accepted]: dropping classId while keeping only `studyDay` + `submittedAt >=
anchor` re-introduces the exact cross-progression bug the anchor-class restriction (V4/C3-6) prevented —
`studyDay` is a session COUNTER, not a position identity. Across classes with different paces / pre-flag
history, a Day-D review in class B can be later than the anchor yet cover a DIFFERENT word-position range →
false "day complete" advancement.

**The fix pairs on POSITION lineage, enabled by Fix A** (which now stores the anchor range `p..2p-1` on the B
review attempt). `getReviewForDay` under `LIST_SCOPED_RECON`:
1. **Pass anchor position fields in** [F9-3]: reconciliation passes `anchorNewWordStartIndex`,
   `anchorNewWordEndIndex` (from `anchorTest`, `progressService.js:164`) alongside `anchorClassId`/
   `anchorSubmittedAt` (the missing-lineage guard is RETAINED).
2. **Candidate stream, not `limit(1)`** [F9-4]: query the existing indexed candidates
   `(studentId, listId, sessionType='review', studyDay, submittedAt >= anchorSubmittedAt)` ordered by
   `submittedAt` — **paginate** and **client-filter** for the first candidate whose `newWordStartIndex ==
   anchorNewWordStartIndex && newWordEndIndex == anchorNewWordEndIndex`. Return `found` on a position match,
   `none` on exhaustion (NOT the newest unverified review), `query-error` preserved.
- **Bug 3 fixed safely:** B's Day-D review carries A's anchor range (via Fix A) → position-matches → A sees it
  → both converge to `csd=D, twi=D·p`. A B-review at a DIFFERENT position (cross-pace/pre-flag) does NOT match
  → no false advancement.
- **Index:** the candidate query `(studentId, listId, sessionType, studyDay, submittedAt)` reuses the existing
  live+READY composite; position match is CLIENT-side → **no new index** [F9-4]. (Adding the position equality
  to the Firestore query WOULD need a new index — so keep it client-side.)
- **Preserve the [Codex-P1-1] missing-lineage guard** (`db.js:3403-3406`): still require `anchorClassId` +
  `anchorSubmittedAt` present as lineage sentinels (return `query-error` if absent) even though `classId` no
  longer appears in the WHERE clause. Update the stale [C4-5] `asc`-rationale comment (`db.js:3374-3378`) since
  selection is now position-match, not earliest-time (existence-only for the caller).

## 4. Files touched (all `LIST_SCOPED_RECON`-gated)
1. `src/services/studyService.js` — (a) `initializeDailySession` review-resume allocation override:
   count=0, start/end = the passed attempt's anchor range (§2); (b) `completeSessionFromTest:1269`
   `wordsIntroduced` read treats explicit `0` as authoritative (the reload-path bug-2 facet).
2. `src/services/db.js` — `getReviewForDay` position-consistent cross-class pairing (candidate stream +
   client-side range match) under the flag (§3).
3. `src/services/progressService.js` — pass `anchorNewWordStartIndex/EndIndex` into `getReviewForDay` (§3.1).
No new indexes (position match is client-side). No migration. No flag change (already ON).

## 4.1 Run S acceptance addition [Codex F9-5]
Run S S-1/S-3 postverify must additionally assert **the B review attempt's stored `newWordStartIndex/
newWordEndIndex` equal A's passed-new anchor range** (`p..2p-1`) — proving the lineage that makes the
cross-class pairing position-safe, not just the CSD/TWI/attempt-count oracles. (Fold into `runs/plan.md`.)

## 5. Acceptance & regression
- **Acceptance:** Run S S-1/S-3 (`docs/plans/loop/runs/plan.md`) — B completes the review with no retake,
  `twi` stays `2p`, and A-after-B converges to `csd=2, twi=2p`. (Run S goes EXPECTED-RED → PASS.)
- **Regression (must stay green):** normal fresh new-word day (phase NEW_WORDS_STUDY — override doesn't fire);
  single-class same-session review (persisted sessionConfig already carries the correct base; §2 only changes a
  FRESH re-init); Day-1 completion (no review phase); the existing Run L flag-off equivalence (all changes are
  flag-gated). CSD non-demotion (`Math.max`) unchanged.
- **Also verify these overlooked consumers of the overridden allocation [regression agent MED]:** the PDF
  helpers `getTodaysBatchForPDF` (`studyService.js:939-957`) + `getCompleteBatchForPDF` (`:985-996`) and
  `getDebugSessionData` (`:1179`) read `config.newWordCount`/`newWordStartIndex`. On a review-resume day the
  override makes the PDF omit the day's new-word section and narrows the failed-carryover window (base `p` not
  `2p`) — this appears CORRECTIVE (pre-fix the sheet printed not-yet-due words at `2p`) but is a teacher-facing
  behavior change to CONFIRM, not a silent regression. Add to the acceptance checklist.

## 6. Resolved by the audit / open questions
- **RESOLVED — gating (was Q1):** LOCKED to **flag-gated** (`if (LIST_SCOPED_RECON && phase===REVIEW_STUDY)`).
  Universal would change flag-off `initializeDailySession` output → break Run-L equivalence. Regression agent
  confirmed both fixes are inside `LIST_SCOPED_RECON` branches; flag-off else-branches byte-unchanged.
- **RESOLVED — endIndex (was Q2):** no longer `nwStart-1` — v2 preserves `newWordEndIndex = dayNewPass.newWordEndIndex`
  (the anchor range), required by Fix B's position check. Regression agent confirmed the review-resume never
  reads `newWordCount` for a new-word test and `wordsIntroduced=0` is durably inert (overwritten by anchor twi).
- **Open Q — Fix B boundary:** confirm `>=` vs `>` on `anchorSubmittedAt` (anchor is `new`, review later → `>=`
  safe, but confirm) — now moot since position-match is the real discriminator, but keep the temporal filter as
  a cheap pre-narrow.
- **Open Q — gradebook/analytics** reading a REVIEW attempt's `newWordStartIndex/EndIndex` for display (regression
  agent NIT): the review attempt now carries the anchor range `p..2p-1` (intentional, for lineage) — confirm no
  view mis-renders it.
