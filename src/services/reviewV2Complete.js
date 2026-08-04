/**
 * ============================================================================
 * DEEPFIX2 · CUTOVER-C COMPLETE — the flag-scoped day-completion adapter
 * ============================================================================
 * Behind `REVIEW_V2_CLIENT` (the CALLERS gate — this module carries no flag,
 * per the V6 doctrine established by cutover-a/b: every new branch is gated
 * at its call site), the TEST-DRIVEN day completion — CSD/TWI advance,
 * graduation, streak — moves from the client (`completeSessionFromTest` /
 * `updateClassProgress` / `graduateSegmentWords`) to the engine's
 * `completeDay` callable (wrapped by `reviewV2Client.js`). This module owns
 * the laws of that fold:
 *
 *  1. SEND IDS, NEVER COMPUTED VALUES (V1). The request carries
 *     {classId, listId, logicalDay, consumedAttemptId, consumedAttemptClassId,
 *     newTestAttemptId} — the SERVER re-derives the CSD/TWI advance, the
 *     graduation, and the streak entirely inside its own transaction
 *     (functions/reviewV2/completion.js). The client never computes any of
 *     the three; it only resolves WHICH attempt ids satisfy the day.
 *
 *  2. THE V2 SLOT MAPPING (verified in code against completion.js before any
 *     edit — cutover-c ledger V2). THIS submission's own engine attempt id
 *     fills `consumedAttemptId` (kind 'review' — classId-bound,
 *     completion.js :329) or `newTestAttemptId` (kind 'new' — NOT
 *     classId-bound) — `rv2CompletionAttemptIds` is the pure mapper for that
 *     half. The OTHER slot's id, on a new-word day completing via the REVIEW
 *     submit, is NOT resolvable in-memory: the 'new' test that earned it
 *     submitted in an EARLIER, separate page mount (MCQTest/TypedTest is
 *     re-mounted per test phase), so its `out.attemptId` is gone from JS
 *     state by the time the review completes the day. Unlike today's legacy
 *     `completeSessionFromTest`, which self-derives it via
 *     `getNewWordAttemptForDay` (studyService.js) INSIDE itself (AFTER the
 *     completion call already started), the CALL SITE here resolves it via
 *     the SAME Firestore query BEFORE calling `completeDayV2` — both ids are
 *     in hand at/before the RPC, never after. `getNewWordAttemptForDay`
 *     queries the plain `attempts` collection (studentId/listId/sessionType/
 *     studyDay [+ classId, or a cross-class position-proven pass under
 *     LIST_SCOPED_RECON]) and finds engine-written attempts too — they land
 *     in that SAME collection with the same field shape (functions/reviewV2/
 *     callables.js reviewV2SubmitAttempt, the `attempt` object) — so reusing
 *     it needs no new query design. That lookup is Firestore Web-SDK I/O
 *     (`src/services/db.js`, which cannot be imported by a plain-node fixture
 *     — it transitively pulls in `../firebase.js`'s `import.meta.env` client
 *     bootstrap), so — mirroring reviewV2Submit.js's OWN posture of never
 *     doing a direct Firestore read itself — this module does not import it;
 *     the PAGE resolves `dayNewTestAttemptId` and passes it in.
 *
 *  3. `already_completed` IS A TERMINAL SUCCESS (V3/A2) — the SAME day-DONE
 *     success path as `completed`, NEVER the error-shaped `dayGuardRejected`
 *     branch (that is a DIFFERENT completeDay status — the frontier moved
 *     out from under this request — and stays a `blocked` refusal below). A
 *     concurrent loser re-runs NOTHING. `translateCompletedOutcome`
 *     normalizes BOTH response shapes (the fresh winner's top-level fields,
 *     and a loser's pre-existing `.completion` record, completion.js
 *     :296/:298) into ONE outward envelope so the caller never branches on
 *     which one arrived — the same idiom cutover-b established for
 *     `attempt_written{replayed:true}`.
 *
 *  4. THE STATUS CENSUS IS TOTAL (V4), exhaustively re-verified against
 *     completion.js + callables.js:847-887's resolveAndGate/deriveEpoch/
 *     loadCanonicalWordsStrict — NOT by grep alone (grep can miss a status
 *     that passes through from a shared helper). Terminal: `completed` ·
 *     `already_completed`. Not-serving (→ LEGACY, `isNotServing`):
 *     `config_hold` · `review_v2_dark` · (an in-txn race only)
 *     `class_not_found`/`not_enrolled`/`list_not_assigned` as DATA, PLUS the
 *     SAME trio THROWN as HttpsError in the ordinary preflight case
 *     (`classifyThrownRefusal`). Stale client (→ blocked, force refresh):
 *     `client_version_stale`. Refusals as DATA (→ blocked, rendered reason):
 *     `no_evidence` · `day_guard_rejected` · `reset_in_progress` ·
 *     `reset_epoch_mismatch` · `list_words_malformed`. Unknown/malformed →
 *     blocked with a generic reason — never a blank screen, never a silent
 *     legacy fallback (that would hide an engine that is genuinely refusing).
 *     CORRECTION TO THE LEDGER'S V4 ROW TEXT: `queue_invalid` and
 *     `presentation_invalid` do NOT arise from `completeDay` — grepping
 *     completion.js and callables.js:847-887 exhaustively (`status:` almost
 *     every line) shows both are SUBMIT-only statuses
 *     (`reviewV2SubmitAttempt`, callables.js :638/:690/:695-730). They are
 *     over-inclusive in the ledger, not under — the same catch-all that
 *     handles a truly-unknown status already absorbs them safely (dead
 *     branches, never a mis-route), so this is a documented correction, not
 *     a plumbing contradiction (see the fold report for the full census).
 *
 * Refusal COPY here is deliberately minimal — fold 51d owns the final copy
 * (matches reviewV2Submit.js's own posture). `no_evidence`'s reason text is
 * copied VERBATIM from the EXISTING `completionNotApplied` UX (MCQTest.jsx/
 * TypedTest.jsx today) — the same user-facing situation ("this day can't
 * complete yet, your answers are saved"), not a new message.
 */

// Explicit .js extensions: mirrors reviewV2Submit.js — this module is
// imported by the node-run fixture scripts as well as by Vite, and node ESM
// resolution requires the extension. Vite accepts both forms.
import {
  completeDay,
  isNotServing,
  isStaleClient,
  RV2,
} from './reviewV2Client.js'
import {
  classifyThrownRefusal,
  refusalReasonText,
} from './reviewV2Compose.js'

// ---------------------------------------------------------------------------
// Copy (fold 51d owns the final copy)
// ---------------------------------------------------------------------------

// Copied VERBATIM from the existing `completionNotApplied` UX (MCQTest.jsx
// line ~1028 / TypedTest.jsx line ~1322) — the SAME situation under the
// engine (`no_evidence`): the attempt is saved, the day did not complete.
const REASON_NO_EVIDENCE =
  '아직 이 날을 완료할 수 없습니다. 답안은 저장되었어요. 새 단어 시험을 통과했는지 확인한 뒤 다시 시도하거나, 문제가 계속되면 페이지를 새로고침해 주세요. ' +
  '(This day can\'t be completed yet — your answers are saved. Make sure the new-word test was passed, then retry; reload the page if this repeats.)'

const GENERIC_COMPLETE_REASON =
  '학습을 완료하지 못했습니다. 답안은 저장되었으니, 잠시 후 다시 시도해 주세요. ' +
  '(This day could not be completed — your answers are saved. Please try again in a moment.)'

/** The blocking statuses whose compose-fold copy (`refusalReasonText`) is
 *  accurate for a completion refusal too (reload framing). `no_evidence` gets
 *  its OWN reason (above, matching the existing completionNotApplied UX);
 *  everything else blocking gets the completion generic — mirrors
 *  reviewV2Submit.js's `SUBMIT_KNOWN_REASON_STATUSES` idiom exactly. */
const COMPLETE_KNOWN_REASON_STATUSES = new Set([
  RV2.DAY_GUARD_REJECTED, RV2.RESET_IN_PROGRESS, RV2.RESET_EPOCH_MISMATCH, RV2.LIST_WORDS_MALFORMED,
])

function completeRefusalReason(status) {
  if (status === RV2.NO_EVIDENCE) return REASON_NO_EVIDENCE
  return COMPLETE_KNOWN_REASON_STATUSES.has(status) ? refusalReasonText(status) : GENERIC_COMPLETE_REASON
}

// ---------------------------------------------------------------------------
// Page-boundary builder (C6 — pure, fixtured; the pages call this at
// REVIEW_V2_CLIENT-gated call sites only)
// ---------------------------------------------------------------------------

/**
 * V2 — THE ATTEMPT-ID SLOT MAPPING (pure). `kind` is THIS submission's own
 * test type ('review'|'new' — the SAME discriminator submitAttemptV2 uses:
 * `rv2Handle.source === 'composeNewTest' ? 'new' : 'review'`); `attemptId` is
 * THIS submission's own engine attempt id (`out.attemptId` / `result.id` at
 * the call site). `dayNewTestAttemptId` is the day's OTHER (new-word) attempt
 * id — resolved by the CALLER via a Firestore query BEFORE calling this
 * (null on a review-only day, or when none is found yet); ignored when
 * kind==='new' — a new-word completion NEVER has a prior review this day
 * (isSessionFinalTest only ever treats 'new' as the completing test on
 * isFirstDay, and Day 1 has no review pool yet — every evidenceKindFor kind
 * with hasNewTest-only requires !hasConsumed).
 *
 * @returns {{consumedAttemptId: string|null, consumedAttemptClassId: string|null,
 *   newTestAttemptId: string|null}}
 */
export function rv2CompletionAttemptIds({ kind, attemptId, classId, dayNewTestAttemptId = null }) {
  const id = typeof attemptId === 'string' && attemptId.length > 0 ? attemptId : null
  if (kind === 'new') {
    return { consumedAttemptId: null, consumedAttemptClassId: null, newTestAttemptId: id }
  }
  const cid = typeof classId === 'string' && classId.length > 0 ? classId : null
  return {
    consumedAttemptId: id,
    // [r57 binding, completion.js:218] consumedAttemptClassId is null IFF
    // consumedAttemptId is null — never send a class for a null attempt.
    consumedAttemptClassId: id ? cid : null,
    newTestAttemptId: typeof dayNewTestAttemptId === 'string' && dayNewTestAttemptId.length > 0
      ? dayNewTestAttemptId : null,
  }
}

// ---------------------------------------------------------------------------
// The completion surface
// ---------------------------------------------------------------------------

/** V3/A2 — normalize `completed` (the fresh winner) and `already_completed`
 *  (a terminal SUCCESS, re-run nothing) into ONE outward envelope so the
 *  caller never branches on which one arrived. A loser's fields live under
 *  `.completion` (the EXISTING record, completion.js :296/:298) under
 *  DIFFERENT names (completedTwi/logicalDay vs newTwi/advancedToDay) than a
 *  fresh winner's top-level fields — translated here so both shapes agree. */
function translateCompletedOutcome(result) {
  const c = result?.completion ?? null
  const graduated = Number.isFinite(result?.graduationCount)
    ? result.graduationCount
    : (Number.isFinite(c?.graduationCount) ? c.graduationCount : 0)
  const totalWordsIntroduced = Number.isFinite(result?.newTwi)
    ? result.newTwi
    : (Number.isFinite(c?.completedTwi) ? c.completedTwi : null)
  const currentStudyDay = Number.isInteger(result?.advancedToDay)
    ? result.advancedToDay
    : (Number.isInteger(c?.logicalDay) ? c.logicalDay : null)
  return {
    outcome: 'completed',
    replayed: result?.status === RV2.ALREADY_COMPLETED,
    // No legacy `sessions`-doc concept under the engine — verified DEAD
    // beyond assembly: only studyService.js:2027 itself ever reads
    // `result.sessionId` in this codebase (grepped), never the two call
    // sites this fold gates.
    sessionId: null,
    // A2: translate the completeDay success payload onto what the UI
    // consumes. PARTIAL analog of the legacy `progress` object — only the
    // two fields SessionSummaryCard.jsx:23 reads (totalWordsIntroduced) plus
    // its day counterpart; never a full class_progress mirror. Traced (fold
    // report): SessionSummaryCard's `summary` prop is actually populated by
    // DailySessionFlow.jsx re-reading class_progress FRESH from Firestore
    // after navigating back (getClassProgress, :1646/:1688), not from this
    // return value — completeDay's txn writes the SAME doc (V1), so that
    // fresh read already reflects this completion regardless of this
    // object's exact shape. This translation is still built to spec (A2)
    // for API-shape parity and any future direct consumer.
    progress: { currentStudyDay, totalWordsIntroduced },
    graduated,
    streakCredited: result?.streakCredited === true,
    evidenceKind: result?.evidenceKind ?? c?.evidenceKind ?? null,
  }
}

/**
 * Complete the shared logical day through the engine — THE one call surface
 * for the fold (A1/A2). Takes the FINAL {classId, listId, logicalDay,
 * consumedAttemptId, consumedAttemptClassId, newTestAttemptId} shape (see
 * `rv2CompletionAttemptIds` to build it at the call site) and calls
 * `completeDay` (reviewV2Client.js).
 *
 * @param {object} args
 * @param {object} [deps] — fixture seam: `completeDayFn` (defaults to the
 *   real `completeDay` RPC).
 * @returns {Promise<object>} one of:
 *   {outcome:'completed', replayed, sessionId, progress, graduated,
 *    streakCredited, evidenceKind}       — terminal success (V3: `completed`
 *                                           AND `already_completed` both land
 *                                           here; `replayed` distinguishes)
 *   {outcome:'legacy', via, status?|code?} — engine not serving: the CALLER
 *    must NOT retry completeDay and must NOT present success — the attempt
 *    itself is already saved (it went through the engine submit leg), but
 *    completion could not run; surface a reload prompt
 *   {outcome:'blocked', status, reason, retryable?} — render `reason`; the
 *    attempt is already saved, the day did NOT complete
 */
export async function completeDayV2(
  { classId, listId, logicalDay, consumedAttemptId = null, consumedAttemptClassId = null, newTestAttemptId = null },
  deps = {}
) {
  const s = (v) => typeof v === 'string' && v.length > 0
  // Fail loud on a malformed request — mirrors completion.js's OWN r57
  // binding law client-side, before it ever reaches the engine.
  if (!s(classId) || !s(listId) || !Number.isInteger(logicalDay) || logicalDay < 1 ||
      (consumedAttemptId !== null && !s(consumedAttemptId)) ||
      (consumedAttemptClassId !== null && !s(consumedAttemptClassId)) ||
      (newTestAttemptId !== null && !s(newTestAttemptId)) ||
      (consumedAttemptId === null) !== (consumedAttemptClassId === null)) {
    return { outcome: 'blocked', status: 'malformed_request', reason: GENERIC_COMPLETE_REASON }
  }

  const completeFn = deps.completeDayFn ?? completeDay
  let result
  try {
    result = await completeFn({ classId, listId, logicalDay, consumedAttemptId, consumedAttemptClassId, newTestAttemptId })
  } catch (err) {
    if (classifyThrownRefusal(err) === 'legacy') {
      // The thrown trio (V4): the engine stopped serving between the submit
      // and this completion call — the attempt itself is already saved.
      return { outcome: 'legacy', via: 'error', code: err?.code ?? null }
    }
    // Transport/server failure: the attempt is already saved and a re-call is
    // replay-safe (idempotent) server-side.
    return { outcome: 'blocked', status: 'error', code: err?.code ?? null, reason: GENERIC_COMPLETE_REASON, retryable: true }
  }

  if (result?.status === RV2.COMPLETED || result?.status === RV2.ALREADY_COMPLETED) {
    return translateCompletedOutcome(result)
  }
  if (isNotServing(result)) {
    // DATA channel: config_hold / review_v2_dark (+ the in-txn race trio,
    // completion.js assertServableInTxn — same status names as the thrown
    // trio, already covered by isNotServing's NOT_SERVING set — V4).
    return { outcome: 'legacy', via: 'status', status: result.status }
  }
  if (isStaleClient(result)) {
    return { outcome: 'blocked', status: result.status, reason: refusalReasonText(result.status) }
  }
  // no_evidence / day_guard_rejected / reset_in_progress / reset_epoch_mismatch
  // / list_words_malformed + anything unknown/malformed: BLOCK with a
  // rendered reason — never a silent legacy fallback (that would hide an
  // engine that is refusing), never a blank screen.
  const status = typeof result?.status === 'string' ? result.status : 'malformed_response'
  return { outcome: 'blocked', status, reason: completeRefusalReason(status) }
}
