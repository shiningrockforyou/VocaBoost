/**
 * ============================================================================
 * DEEPFIX2 · CUTOVER-B SUBMIT — the flag-scoped attempt-submission adapter
 * ============================================================================
 * Behind `REVIEW_V2_CLIENT` (the CALLERS gate — this module carries no flag,
 * per the V6 doctrine: every new branch is gated at its call site), an
 * engine-composed test submits through `submitAttempt({presentationId,
 * answers})` — the SERVER grades against its own presentation record and the
 * SERVER writes the attempt. This module owns the laws of that fold:
 *
 *  1. ONE CALL, TWO FIELDS (V1). The request carries `presentationId` and
 *     `answers` [{wordId, studentResponse}] and NOTHING else. Every field the
 *     legacy `context` carried is supplied server-side (studentId ⇐ auth,
 *     class/list/day/sessionType ⇐ the presentation, attemptDocId ⇐
 *     engineDocId, totalQuestions ⇐ the presentation, testType ⇐ the queue
 *     snapshot) — and the one purely client-invented field, the attemptDocId
 *     nonce (MCQTest.jsx:700), is the 06-29 outage root cause. Smuggling a
 *     client attemptDocId or totalQuestions alongside is the regression this
 *     module exists to make impossible.
 *
 *  2. THE STATUS CENSUS IS TOTAL (V4/A2). Terminal `attempt_written`
 *     (`replayed:true` included — a replay is a SUCCESS with zero writes) ·
 *     `grading_in_progress` is TRANSIENT: poll by retrying the SAME submit,
 *     bounded, never recompose (recomposing composes a DIFFERENT test) ·
 *     `grade_unusable` is PERMANENT: recompose EXACTLY ONCE, never poll ·
 *     the six authority refusals block with a rendered reason ·
 *     `config_hold`/`review_v2_dark` as DATA and the thrown trio
 *     (not-found / permission-denied / failed-precondition, both code forms,
 *     via `classifyThrownRefusal`) fall back to the LEGACY submit path —
 *     the student's answered test is preserved, not discarded · an UNKNOWN
 *     status blocks with a generic reason, never a blank screen.
 *
 *  3. RECOMPOSE EXACTLY ONCE (A2). A `graded` grading job never self-clears,
 *     so a client that loops recompose-on-unusable hammers a live AI grader.
 *     The once-guard is PERSISTED alongside the composeKey (same storage,
 *     parallel scope key), NOT held in component state, so it survives a
 *     reload between the refusal and the recompose, a recompose that itself
 *     refuses, and a user-initiated retry after the automatic one. It is set
 *     BEFORE the recompose runs (fail-closed across a crash mid-flow) and
 *     cleared only by a successful `attempt_written` (success closes the
 *     incident; an automatic tight loop is impossible because a second
 *     unusable without an intervening success is TERMINAL). sessionStorage is
 *     per-tab — exactly like the composeKey itself (cutover-a BS-TABS) — so
 *     two tabs are each bounded to one recompose, never a loop.
 *
 * Refusal COPY here is deliberately minimal and STAYS here — NOT superseded by
 * a later fold. SCOPE DECISION [cutover-d D1, 2026-08-04]: RV2 refusal copy
 * (why a request was refused) is a SEPARATE REGISTER from DF2-07's
 * `reviewOnlyReason` messaging (why review-only mode is active / threshold
 * copy) — different axes, rendered on the SAME screens, made coherent by
 * sharing design TOKENS (A3), never by a merged string source.
 */

// Explicit .js extensions: this module is imported by the node-run fixture
// scripts (scripts/deepfix2/cutover-b-submit-*.mjs) as well as by Vite, and
// node ESM resolution requires the extension. Vite accepts both forms.
import {
  submitAttempt,
  isNotServing,
  isStaleClient,
  isGradingInProgress,
  isGradeUnusable,
  RV2,
} from './reviewV2Client.js'
import {
  composeReviewSessionV2,
  composeNewTestV2,
  classifyThrownRefusal,
  refusalReasonText,
} from './reviewV2Compose.js'

// ---------------------------------------------------------------------------
// Storage (the recompose-once guard persists ALONGSIDE the composeKey)
// ---------------------------------------------------------------------------
// Mirrors reviewV2Compose.js defaultStorage (which is deliberately not
// exported — that module's bytes are certified by the cutover-a receipts and
// stay untouched). Same degraded mode: private-mode Safari falls back to a
// per-page-lifetime memory map; a reload then loses the guard, which fails
// SAFE here — a lost guard can allow at most one extra bounded recompose,
// never a loop (the guard is re-set before any recompose runs).

const memoryStore = new Map()
const memoryStorage = {
  getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k) : null),
  setItem: (k, v) => { memoryStore.set(k, v) },
  removeItem: (k) => { memoryStore.delete(k) },
}

function defaultStorage() {
  try {
    const s = globalThis.sessionStorage
    if (s) {
      const probe = '__rv2ru_probe__'
      s.setItem(probe, '1')
      s.removeItem(probe)
      return s
    }
  } catch { /* fall through to memory */ }
  return memoryStorage
}

/** The guard scope of one submittable test — the composeKey scope's parallel
 *  (`rv2ru.` = review-v2 recompose-used). kind: 'review' | 'new'. */
export function recomposeGuardScope({ uid, classId, listId, logicalDay, kind }) {
  return `rv2ru.${uid}.${classId}.${listId}.d${logicalDay}.${kind}`
}

/** True when this scope has already consumed its ONE automatic recompose. */
export function recomposeUsed(scope, { storage } = {}) {
  const store = storage ?? defaultStorage()
  try { return store.getItem(scope) === '1' } catch { return false }
}

/** Consume the scope's one automatic recompose — set BEFORE recomposing. */
export function markRecomposeUsed(scope, { storage } = {}) {
  const store = storage ?? defaultStorage()
  try { store.setItem(scope, '1') } catch { /* memory-only degraded mode */ }
}

/** Clear the guard — ONLY a successful attempt_written closes the incident. */
export function clearRecomposeGuard(scope, { storage } = {}) {
  const store = storage ?? defaultStorage()
  try { store.removeItem(scope) } catch { /* nothing to do */ }
}

// ---------------------------------------------------------------------------
// Copy (this register's own — separate from DF2-07, D1)
// ---------------------------------------------------------------------------

const REASON_RECOMPOSED =
  '이 시험을 채점할 수 없어 새 시험이 준비되었습니다. 새 시험을 풀고 다시 제출해 주세요. ' +
  '(This test could not be graded, so a fresh test was prepared — please take it and submit again.)'

const REASON_UNUSABLE_TERMINAL =
  '채점 기록에 문제가 있어 제출을 완료할 수 없습니다. 페이지를 새로고침한 뒤에도 반복되면 선생님께 알려 주세요. ' +
  '(A grading-record problem is blocking this submission — reload the page, and tell your teacher if it repeats.)'

const REASON_STILL_GRADING =
  '채점이 아직 진행 중입니다. 잠시 후 다시 제출해 주세요 — 답안은 그대로 보존됩니다. ' +
  '(Grading is still in progress — submit again in a moment; your answers are kept.)'

const GENERIC_SUBMIT_REASON =
  '제출을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요 — 답안은 그대로 보존됩니다. ' +
  '(The submission could not be completed — try again in a moment; your answers are kept.)'

/** The blocking statuses whose compose-fold copy is accurate for a submit too
 *  (reload/refresh framing). Everything else blocking gets the SUBMIT generic
 *  — the compose generic says "the session can't START", which would mislead
 *  mid-submit. */
const SUBMIT_KNOWN_REASON_STATUSES = new Set([
  RV2.DAY_GUARD_REJECTED, RV2.RESET_IN_PROGRESS, RV2.RESET_EPOCH_MISMATCH,
  RV2.PRESENTATION_INVALID, RV2.QUEUE_INVALID, RV2.CLIENT_VERSION_STALE,
])

function submitRefusalReason(status) {
  return SUBMIT_KNOWN_REASON_STATUSES.has(status)
    ? refusalReasonText(status)
    : GENERIC_SUBMIT_REASON
}

// ---------------------------------------------------------------------------
// Page-boundary builders (C6 — pure, fixtured; the pages call these at
// REVIEW_V2_CLIENT-gated call sites only)
// ---------------------------------------------------------------------------

/** MCQ answer sheet from page state: the PRESENTED words (testWords, flag-on
 *  = the presentation verbatim) × the selected options. One row per ANSWERED
 *  word — an absent row IS the blank row server-side (blank-is-fail is the
 *  server's law [R2-17], never re-encoded here). The studentResponse is the
 *  selected option's definition STRING — exactly what the server compares to
 *  the canonical definition. De-duped defensively: a duplicate row is a
 *  server-side drift-rule REFUSAL, so one here would brick the submit. */
export function rv2McqAnswers(testWords = [], answersByWordId = {}) {
  const rows = []
  const seen = new Set()
  for (const w of Array.isArray(testWords) ? testWords : []) {
    const id = w?.id
    if (typeof id !== 'string' || id.length === 0 || seen.has(id)) continue
    seen.add(id)
    const response = String(answersByWordId?.[id]?.definition ?? '')
    if (response.trim() === '') continue
    rows.push({ wordId: id, studentResponse: response })
  }
  return rows
}

/** Typed answer sheet from page state: presented words × free-text responses.
 *  Same laws as rv2McqAnswers — answered rows only, presentation order,
 *  de-duped; blanks are the server's business. */
export function rv2TypedAnswers(words = [], responsesByWordId = {}) {
  const rows = []
  const seen = new Set()
  for (const w of Array.isArray(words) ? words : []) {
    const id = w?.id
    if (typeof id !== 'string' || id.length === 0 || seen.has(id)) continue
    seen.add(id)
    const response = String(responsesByWordId?.[id] ?? '')
    if (response.trim() === '') continue
    rows.push({ wordId: id, studentResponse: response })
  }
  return rows
}

/** Map the engine-written attempt's stored rows (typedGrading buildTypedRows
 *  shape: {wordId, isCorrect, aiReasoning, …}) to the result-card shape the
 *  typed page renders ({wordId, isCorrect, reasoning}). The read-back is the
 *  ONLY per-word source flag-on — the client never holds a grade (V5). A
 *  missing/malformed read-back degrades to [] (summary numbers still render
 *  from the submit response); verdicts are NEVER fabricated client-side. */
export function rv2RowsToTypedResults(rows) {
  if (!Array.isArray(rows)) return []
  return rows
    .filter((r) => r && typeof r.wordId === 'string' && r.wordId.length > 0)
    .map((r) => ({
      wordId: r.wordId,
      isCorrect: r.isCorrect === true,
      reasoning: String(r.aiReasoning ?? ''),
    }))
}

// ---------------------------------------------------------------------------
// The submit surface
// ---------------------------------------------------------------------------

/** Bounded patience for `grading_in_progress` (a live lease held by a
 *  concurrent worker): retry the SAME submit — the retry lands the winner's
 *  cached grade or re-claims an expired lease; it never re-composes and never
 *  double-charges the grader (metering-once is the job machinery's law). */
export const SUBMIT_POLL_RETRIES = 8
export const SUBMIT_POLL_INTERVAL_MS = 5000

/**
 * Submit a composed test to the engine — THE one call surface for the fold.
 *
 * @param {{uid: string, classId: string, listId: string, logicalDay: number,
 *   kind: 'review'|'new', presentationId: string,
 *   answers: Array<{wordId: string, studentResponse: string}>}} args —
 *   `kind` picks the recompose surface (composeSession vs composeNewTest)
 *   and scopes the once-guard; it comes from the rv2 handle's `source`.
 * @param {object} [deps] — fixture seams: `submitFn`, `storage`, `sleepFn`,
 *   `pollRetries`, `pollIntervalMs`, `composeSessionFn`, `composeNewTestFn`,
 *   `logInvalidDay` (the compose deps pass through to the recompose).
 * @returns {Promise<object>} one of:
 *   {outcome:'written', replayed, attemptId, score, passed, totalQuestions,
 *    correctCount}                       — terminal success (server verdict)
 *   {outcome:'legacy', via, status?|code?} — engine not serving: run the
 *    LEGACY submit path with the same on-screen answers
 *   {outcome:'recomposed', reason, compose} — grade_unusable consumed its ONE
 *    recompose; `compose` is the fresh composeReviewSessionV2/composeNewTestV2
 *    envelope — swap the on-screen test to it and render `reason`
 *   {outcome:'blocked', status, reason, retryable?} — render `reason`; the
 *    answers stay on the page (a re-submit is replay-safe server-side)
 */
export async function submitAttemptV2(
  { uid, classId, listId, logicalDay, kind, presentationId, answers },
  deps = {}
) {
  // Fail loud on a malformed handle — a junk guard scope ('rv2ru.undefined…')
  // or a malformed request must never reach the engine or the storage.
  if (typeof uid !== 'string' || uid.length === 0 ||
      typeof classId !== 'string' || classId.length === 0 ||
      typeof listId !== 'string' || listId.length === 0 ||
      !Number.isInteger(logicalDay) || logicalDay < 1 ||
      (kind !== 'review' && kind !== 'new') ||
      typeof presentationId !== 'string' || presentationId.length === 0 ||
      !Array.isArray(answers)) {
    return { outcome: 'blocked', status: 'malformed_request', reason: GENERIC_SUBMIT_REASON }
  }

  const submitFn = deps.submitFn ?? submitAttempt
  const sleep = deps.sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  const pollRetries = Number.isInteger(deps.pollRetries) ? deps.pollRetries : SUBMIT_POLL_RETRIES
  const pollIntervalMs = Number.isInteger(deps.pollIntervalMs) ? deps.pollIntervalMs : SUBMIT_POLL_INTERVAL_MS

  // V1: the payload is EXACTLY {presentationId, answers} — nothing rides along.
  const payload = { presentationId, answers }

  let result
  for (let attempt = 0; ; attempt++) {
    try {
      result = await submitFn(payload)
    } catch (err) {
      if (classifyThrownRefusal(err) === 'legacy') {
        // The thrown trio (V4): fall back to the legacy submit path — the
        // student's answered test is preserved, exactly like the compose fold.
        return { outcome: 'legacy', via: 'error', code: err?.code ?? null }
      }
      // Transport/server failure: render a retryable reason — the answers
      // stay on the page and a re-submit is replay-safe (idempotent) server-side.
      return { outcome: 'blocked', status: 'error', code: err?.code ?? null, reason: GENERIC_SUBMIT_REASON, retryable: true }
    }
    if (!isGradingInProgress(result)) break
    // TRANSIENT [18_ §4]: poll the SAME submit, bounded — NEVER recompose here
    // (a new composeKey composes a DIFFERENT test; conflating the two is the
    // exact inverse-status bug the refusal-status fold closed).
    if (attempt >= pollRetries) {
      return { outcome: 'blocked', status: RV2.GRADING_IN_PROGRESS, reason: REASON_STILL_GRADING, retryable: true }
    }
    await sleep(pollIntervalMs)
  }

  const guardScope = recomposeGuardScope({ uid, classId, listId, logicalDay, kind })

  if (result?.status === RV2.ATTEMPT_WRITTEN) {
    // SUCCESS closes any open grade-unusable incident for this scope.
    clearRecomposeGuard(guardScope, deps)
    return {
      outcome: 'written',
      replayed: result.replayed === true,
      attemptId: typeof result.attemptId === 'string' ? result.attemptId : null,
      score: Number.isFinite(result.score) ? result.score : null,
      passed: result.passed === true,
      totalQuestions: Number.isFinite(result.totalQuestions) ? result.totalQuestions : null,
      correctCount: Number.isFinite(result.correctCount) ? result.correctCount : null,
    }
  }

  if (isNotServing(result)) {
    // DATA channel: config_hold / review_v2_dark — the legacy path serves
    // this submission (the normal pre-flip / mid-rollback state).
    return { outcome: 'legacy', via: 'status', status: result.status }
  }

  if (isStaleClient(result)) {
    return { outcome: 'blocked', status: result.status, reason: refusalReasonText(result.status) }
  }

  if (isGradeUnusable(result)) {
    // PERMANENT [rv2-refusal-status]: the cached grade can never become
    // usable and polling can never succeed. Recompose EXACTLY ONCE.
    if (recomposeUsed(guardScope, deps)) {
      return { outcome: 'blocked', status: RV2.GRADE_UNUSABLE, reason: REASON_UNUSABLE_TERMINAL }
    }
    // Mark BEFORE recomposing — fail-closed: a crash/reload between the mark
    // and the recompose costs the automatic retry, never mints a loop.
    markRecomposeUsed(guardScope, deps)
    const composeDeps = {
      storage: deps.storage,
      composeSessionFn: deps.composeSessionFn,
      composeNewTestFn: deps.composeNewTestFn,
      logInvalidDay: deps.logInvalidDay,
    }
    let composed
    try {
      composed = kind === 'new'
        ? await composeNewTestV2({ uid, classId, listId, logicalDay, freshKey: true }, composeDeps)
        : await composeReviewSessionV2({ uid, classId, listId, logicalDay, freshKey: true }, composeDeps)
    } catch (err) {
      // A recompose that itself throws: surface a reason; the guard stays set
      // (no second automatic attempt — the user path is a deliberate retake).
      return { outcome: 'blocked', status: 'error', code: err?.code ?? null, reason: GENERIC_SUBMIT_REASON }
    }
    if (composed?.outcome === 'composed') {
      return { outcome: 'recomposed', reason: REASON_RECOMPOSED, compose: composed }
    }
    if (composed?.outcome === 'legacy') {
      // The engine stopped serving between the refusal and the recompose —
      // same fallback family as any other not-serving moment.
      return { outcome: 'legacy', via: composed.via ?? 'status', status: composed.status ?? null, code: composed.code ?? null }
    }
    // A recompose that itself REFUSES: surface ITS reason; guard stays set.
    return {
      outcome: 'blocked',
      status: composed?.status ?? 'error',
      reason: composed?.reason ?? GENERIC_SUBMIT_REASON,
    }
  }

  // The six authority refusals + anything unknown/malformed: BLOCK with a
  // rendered reason — never a silent legacy fallback (that would hide a
  // refusing engine), never a blank screen.
  const status = typeof result?.status === 'string' ? result.status : 'malformed_response'
  return { outcome: 'blocked', status, reason: submitRefusalReason(status) }
}
