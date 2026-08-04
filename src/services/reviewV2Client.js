/**
 * ============================================================================
 * DEEPFIX2 · DF2-51 — THE REVIEW-V2 CLIENT WRAPPER (the ONE call surface)
 * ============================================================================
 * Every client call into the review-v2 engine goes through this module. It
 * exists so the frozen server contracts (15_ H6 §8 retry responses + the
 * typed refusals the engine returns as DATA) are decoded in exactly ONE
 * place, and so the session flow never hand-rolls a callable invocation.
 *
 * DORMANT BY CONSTRUCTION — the established codebase idiom (SERVER_ATTEMPT_
 * WRITE / SERVER_CHALLENGE_WRITE / SERVER_REVIEW_MARKER): `REVIEW_V2_CLIENT`
 * ships FALSE, so nothing here is reachable until the flag flips. It flips
 * for the 25WT rehearsal (localhost client → deployed dark backend, the
 * rehearsal classes being the only ON path pre-launch).
 *
 * THE SERVER SPEAKS TWO LANGUAGES, and this module keeps them apart:
 *   - PROTOCOL STATUSES arrive as normal DATA `{status: ...}` — every
 *     refusal the engine can reach on a well-formed request. Callers switch
 *     on `result.status`; they are NEVER exceptions.
 *   - HttpsErrors mean the request itself was wrong (unauthenticated,
 *     invalid-argument, permission-denied, not-found) or the server broke.
 *     Those surface as thrown `ReviewV2Error`s.
 *
 * THE CLIENT CONTRACT VERSION [15_ §7, contract (5)]: every call carries
 * `clientContractVersion`. The server refuses with `client_version_stale`
 * (carrying `minClientVersion`) when a deploy has moved past this bundle —
 * the caller's contract is to FORCE A REFRESH, never to adapt. Bump this
 * constant in lockstep with any breaking change to the engine's request
 * shapes, and only then raise `system_config/review_v2.minClientVersion`.
 */

import { getFunctions, httpsCallable } from 'firebase/functions'

/** THE bundle's contract version — see the header. Bump deliberately. */
export const CLIENT_CONTRACT_VERSION = 1

/** Frozen protocol statuses (15_ §8 + the engine's typed refusals). Callers
 *  should switch on these rather than string-matching inline. */
export const RV2 = Object.freeze({
  // successes
  COMPOSED: 'composed',
  ATTEMPT_WRITTEN: 'attempt_written',
  COMPLETED: 'completed',
  VISIT_MINTED: 'visit_minted',
  // frozen retry/idempotency responses
  ALREADY_COMPLETED: 'already_completed',
  // posture / availability
  CONFIG_HOLD: 'config_hold',
  REVIEW_V2_DARK: 'review_v2_dark',
  CLIENT_VERSION_STALE: 'client_version_stale',
  // RETIRED BY THE SERVER (DF2-12, 18_ §4): the typed leg now grades and
  // writes, so no live callable returns this. Kept in the frozen list so a
  // client rolled back to an older backend still decodes it.
  TYPED_MODALITY_DEFERRED: 'typed_modality_deferred',
  // Typed grading runs OUTSIDE the submit transaction (18_TYPED_LEG_DESIGN §4):
  // a concurrent submit for the same presentation gets this instead of a second
  // attempt. TRANSIENT — the condition resolves itself. Retryable, zero
  // writes: the caller POLLS (retries the SAME submit); it does NOT re-submit
  // with a new composeKey (that would compose a different test). Contrast
  // GRADE_UNUSABLE below, its exact inverse.
  GRADING_IN_PROGRESS: 'grading_in_progress',
  // PERMANENT sibling of the above [rv2-refusal-status]: the cached
  // grading-job payload for this submit is unusable and always will be — it
  // failed the engine's acceptance test (engine provenance / this
  // presentation / this answer sheet; typedGrading.js `usableCachedResults`),
  // and a `graded` job never self-clears, so polling can NEVER succeed.
  // Contract: RECOMPOSE ONCE with a new composeKey (a new presentationId is a
  // new job key); do NOT poll. The exact inverse of GRADING_IN_PROGRESS above
  // — conflating the two either polls forever or recomposes a different test.
  GRADE_UNUSABLE: 'grade_unusable',
  // authority refusals
  DAY_GUARD_REJECTED: 'day_guard_rejected',
  NO_EVIDENCE: 'no_evidence',
  RESET_IN_PROGRESS: 'reset_in_progress',
  RESET_EPOCH_MISMATCH: 'reset_epoch_mismatch',
  COMPOSE_KEY_REUSED: 'compose_key_reused',
  INVALID_COMPOSE_KEY: 'invalid_compose_key',
  QUEUE_INVALID: 'queue_invalid',
  PRESENTATION_INVALID: 'presentation_invalid',
  VISIT_INVALID: 'visit_invalid',
  REUSE_ANCHOR_MISMATCH: 'reuse_anchor_mismatch',
  LIST_WORDS_MALFORMED: 'list_words_malformed',
  EMPTY_POOL: 'empty_pool',
  LIST_END: 'list_end',
  // [D1 truth repair — CUTOVER-A COMPOSE] The next three are DECLARED in the
  // frozen status list but are NEVER returned as data: `resolveAndGate`
  // (callables.js:158-160) THROWS them as HttpsError — not-found /
  // permission-denied / failed-precondition — so they surface as a
  // `ReviewV2Error` from `call()` below, never as `result.status`. A client
  // switching only on `result.status` will never see them; route the thrown
  // channel via `classifyThrownRefusal` (reviewV2Compose.js).
  CLASS_NOT_FOUND: 'class_not_found',
  NOT_ENROLLED: 'not_enrolled',
  LIST_NOT_ASSIGNED: 'list_not_assigned',
})

/** Statuses that mean "the engine is not serving this student right now" —
 *  the caller should fall back to the legacy path rather than show an error.
 *  (A dark/held engine is the NORMAL pre-flip state.)
 *  [D1 truth repair] Of the five, ONLY `config_hold` and `review_v2_dark`
 *  can actually arrive as data — the other three are THROWN as HttpsError
 *  (see the frozen-list note above), so `isNotServing(result)` can never
 *  match them. Callers MUST route the thrown trio to the SAME legacy
 *  fallback by error code (not-found / permission-denied /
 *  failed-precondition) — `classifyThrownRefusal` in reviewV2Compose.js is
 *  that router. The three stay listed here so the frozen intent ("these five
 *  mean not-serving") remains in one place. */
const NOT_SERVING = new Set([
  RV2.CONFIG_HOLD, RV2.REVIEW_V2_DARK, RV2.CLASS_NOT_FOUND,
  RV2.NOT_ENROLLED, RV2.LIST_NOT_ASSIGNED,
])

export class ReviewV2Error extends Error {
  constructor(code, message, details) {
    super(message || code)
    this.name = 'ReviewV2Error'
    this.code = code
    this.details = details ?? null
  }
}

/** True when the result means "engine not serving — use the legacy path".
 *  DATA channel only [D1]: this predicate sees `config_hold` /
 *  `review_v2_dark`; the thrown trio never reaches it (see NOT_SERVING). */
export function isNotServing(result) {
  return Boolean(result) && NOT_SERVING.has(result.status)
}

/** True when the engine is still grading this submission — TRANSIENT: retry
 *  the SAME submit, do not recompose [18_TYPED_LEG_DESIGN §4]. The inverse of
 *  `isGradeUnusable` below. */
export function isGradingInProgress(result) {
  return Boolean(result) && result.status === RV2.GRADING_IN_PROGRESS;
}

/** True when the cached grade for this submit is PERMANENTLY unusable
 *  (foreign/poisoned/stale — it can never become usable): recompose ONCE with
 *  a new composeKey, do NOT poll [rv2-refusal-status;
 *  18_TYPED_LEG_DESIGN §5.6]. The exact inverse of `isGradingInProgress`
 *  above — polling this status polls forever. */
export function isGradeUnusable(result) {
  return Boolean(result) && result.status === RV2.GRADE_UNUSABLE;
}

/** True when the result means "this bundle is too old — force a refresh"
 *  [contract (5): the forced-refresh branch is CHOSEN; no adapter ships]. */
export function isStaleClient(result) {
  return Boolean(result) && result.status === RV2.CLIENT_VERSION_STALE
}

/** A compose key: one per composed test, stable across retries of THAT test
 *  (the server's replay key), regenerated for a genuinely new retake.
 *  Token law [r59-B6]: 8-128 chars of [A-Za-z0-9._-]. */
export function newComposeKey() {
  const rand = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
  return `ck-${rand}`.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 128)
}

async function call(name, data, timeoutMs = 30000) {
  const fn = httpsCallable(getFunctions(), name, { timeout: timeoutMs })
  try {
    const res = await fn({ ...data, clientContractVersion: CLIENT_CONTRACT_VERSION })
    return res?.data ?? null
  } catch (err) {
    // HttpsError ⇒ the request was malformed/unauthorized, or the server
    // broke. Never a protocol status — those arrive as data.
    throw new ReviewV2Error(err?.code ?? 'internal', err?.message, err?.details)
  }
}

/** Compose (or replay) the day's live REVIEW session: the day-queue + this
 *  attempt's presentation. `composeKey` must be stable across retries. */
export function composeSession({ classId, listId, logicalDay, composeKey }) {
  return call('reviewV2ComposeSession', { classId, listId, logicalDay, composeKey })
}

/** Compose (or replay) the day's live NEW-WORD test. */
export function composeNewTest({ classId, listId, logicalDay, composeKey }) {
  return call('reviewV2ComposeNewTest', { classId, listId, logicalDay, composeKey })
}

/** Compose a RERUN half for a restudy visit (`half`: 'review' | 'new'). */
export function composeRerun({ classId, listId, visitedDay, half, visitId, composeKey }) {
  return call('reviewV2ComposeRerun', { classId, listId, visitedDay, half, visitId, composeKey })
}

/** Submit a composed test. `answers` = [{wordId, studentResponse}] — the
 *  server derives correctness, the denominator, and every label from its own
 *  presentation record; the client never sends a verdict or a score. */
export function submitAttempt({ presentationId, answers }) {
  return call('reviewV2SubmitAttempt', { presentationId, answers }, 60000)
}

/** Complete the shared logical day (the exactly-once CAS + graduation +
 *  streak + the canonical advance). A loser receives `already_completed`
 *  and MUST re-run nothing [A2/r53]. */
export function completeDay({
  classId, listId, logicalDay,
  consumedAttemptId = null, consumedAttemptClassId = null, newTestAttemptId = null,
}) {
  return call('reviewV2CompleteDay', {
    classId, listId, logicalDay, consumedAttemptId, consumedAttemptClassId, newTestAttemptId,
  })
}

/** Mint a restudy visit (server-minted visitId) at restudy-day entry. */
export function mintVisit({ classId, listId, day }) {
  return call('reviewV2MintVisit', { classId, listId, day })
}
