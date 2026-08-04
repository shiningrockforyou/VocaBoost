/**
 * ============================================================================
 * DEEPFIX2 · CUTOVER-A COMPOSE — the flag-scoped session-composition adapter
 * ============================================================================
 * Behind `REVIEW_V2_CLIENT` (the CALLERS gate — this module carries no flag,
 * per the V6 doctrine: every new branch is gated at its call site), the review
 * STUDY set and the review/new TEST sets are sourced from the engine's
 * `composeSession` / `composeNewTest` instead of computed client-side. This
 * module owns the three laws that fold established:
 *
 *  1. THE COMPOSE KEY IS PERSISTED (V5). `newComposeKey()` mints a random
 *     token; held only in component state, a mid-test RELOAD would mint a new
 *     key — a legitimate fresh claim the server cannot distinguish — and the
 *     student would silently be handed a DIFFERENT test. The key is persisted
 *     in sessionStorage under a scope key {uid, classId, listId, logicalDay,
 *     kind} so the SAME test recovers it (server replays the presentation),
 *     and regenerated ONLY on a deliberate retake (`freshKey: true`).
 *
 *  2. REFUSALS ARRIVE ON TWO CHANNELS (V4/A2). Protocol refusals arrive as
 *     DATA `{status}`; but `class_not_found` / `not_enrolled` /
 *     `list_not_assigned` are THROWN as HttpsError by the server's
 *     `resolveAndGate` and surface as `ReviewV2Error` — `isNotServing(result)`
 *     can never see them. Both channels route here: the not-serving DATA
 *     statuses (`config_hold`, `review_v2_dark`) AND the thrown trio
 *     (not-found / permission-denied / failed-precondition) fall back to the
 *     LEGACY path silently (the normal pre-flip state / the ordinary dropped-
 *     from-class case). EVERY other refusal BLOCKS with a rendered reason —
 *     never a silent legacy fallback (that would hide an engine that is
 *     refusing), and an UNKNOWN status renders a generic reason, never a
 *     blank screen.
 *
 *  3. THE SERVED ORDER IS THE RENDERED ORDER (V3). `presentedWordIds` arrives
 *     with a priority PREFIX preserved (live review: shuffled remainder;
 *     new-day: canonical order). This module returns the ids VERBATIM and
 *     callers must render them in the given order — no re-shuffle (destroys
 *     the priority prefix), no re-sort, no re-sampling through
 *     `selectTestWords`.
 *
 * Refusal COPY here is deliberately minimal — fold 51d owns the final copy.
 */

// Explicit .js extension: this module is imported by the node-run fixture
// scripts (scripts/deepfix2/cutover-a-compose-*.mjs) as well as by Vite, and
// node ESM resolution requires the extension. Vite accepts both forms.
import {
  composeSession,
  composeNewTest,
  isNotServing,
  isStaleClient,
  newComposeKey,
  RV2,
} from './reviewV2Client.js'

// ---------------------------------------------------------------------------
// Compose-key persistence (V5)
// ---------------------------------------------------------------------------

/** Token law [r59-B6], mirrored from the server: 8-128 of [A-Za-z0-9._-].
 *  A stored value that violates it is discarded and re-minted. */
const COMPOSE_KEY_RE = /^[A-Za-z0-9._-]{8,128}$/

/** In-memory fallback when sessionStorage is unavailable (private-mode
 *  Safari, quota). DEGRADED: a reload then loses the key and composes a new
 *  presentation — the exact V5 danger — but within one page lifetime the
 *  retry/replay law still holds. */
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
      // Probe: storage can exist but throw on write (private mode).
      const probe = '__rv2ck_probe__'
      s.setItem(probe, '1')
      s.removeItem(probe)
      return s
    }
  } catch { /* fall through to memory */ }
  return memoryStorage
}

/** The storage scope of one composable test. Deliberately EXCLUDES resetEpoch
 *  (the client cannot know it pre-compose): after a reset the stored key's
 *  server fingerprint mismatches and the compose refuses `compose_key_reused`,
 *  which discards the key and BLOCKS with a reason — the next deliberate entry
 *  mints fresh. kind: 'review' (composeSession) | 'new' (composeNewTest). */
export function composeKeyScope({ uid, classId, listId, logicalDay, kind }) {
  return `rv2ck.${uid}.${classId}.${listId}.d${logicalDay}.${kind}`
}

/** Recover the persisted key for this scope, or mint+persist a new one. */
export function getOrCreateComposeKey(scope, { storage, mint } = {}) {
  const store = storage ?? defaultStorage()
  const minter = mint ?? newComposeKey
  let stored = null
  try { stored = store.getItem(scope) } catch { stored = null }
  if (typeof stored === 'string' && COMPOSE_KEY_RE.test(stored)) return stored
  const fresh = minter()
  try { store.setItem(scope, fresh) } catch { /* memory-only degraded mode */ }
  return fresh
}

/** Forget the persisted key (deliberate retake, or a server-declared-dead
 *  key: compose_key_reused / invalid_compose_key). */
export function discardComposeKey(scope, { storage } = {}) {
  const store = storage ?? defaultStorage()
  try { store.removeItem(scope) } catch { /* nothing to do */ }
}

// ---------------------------------------------------------------------------
// Refusal classification (A2 — BOTH channels)
// ---------------------------------------------------------------------------

/** The THROWN channel of the not-serving trio (V4): `resolveAndGate` throws
 *  `class not found` → not-found, `not enrolled` → permission-denied,
 *  `list not assigned` → failed-precondition. The web SDK surfaces callable
 *  codes BOTH bare and 'functions/'-prefixed (see DailySessionFlow.jsx:891),
 *  so both forms are accepted. These fall back to LEGACY exactly like the
 *  data-channel `config_hold` / `review_v2_dark`. */
const LEGACY_FALLBACK_ERROR_CODES = new Set([
  'not-found', 'permission-denied', 'failed-precondition',
  'functions/not-found', 'functions/permission-denied', 'functions/failed-precondition',
])

/** 'legacy' when a THROWN error means "the engine is not serving this
 *  student" (fall back silently); null for every other thrown error. */
export function classifyThrownRefusal(err) {
  const code = typeof err?.code === 'string' ? err.code : null
  if (code && LEGACY_FALLBACK_ERROR_CODES.has(code)) return 'legacy'
  return null
}

/** Minimal rendered reasons (fold 51d owns the final copy). EVERY blocking
 *  refusal renders one of these — an unknown status gets the generic line,
 *  never a blank screen and never a silent legacy fallback. */
const REFUSAL_REASONS = {
  [RV2.CLIENT_VERSION_STALE]:
    '앱이 업데이트되었습니다. 페이지를 새로고침해 주세요. (The app was updated — please reload the page.)',
  [RV2.RESET_IN_PROGRESS]:
    '진행 기록 초기화가 진행 중입니다. 잠시 후 다시 시도해 주세요. (Your progress is being reset — try again in a moment.)',
  [RV2.RESET_EPOCH_MISMATCH]:
    '진행 기록이 초기화되었습니다. 페이지를 새로고침해 주세요. (Your progress was reset — please reload the page.)',
  [RV2.COMPOSE_KEY_REUSED]:
    '세션 정보가 만료되었습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요. (This session ticket expired — reload the page and try again.)',
  [RV2.INVALID_COMPOSE_KEY]:
    '세션 정보가 올바르지 않습니다. 페이지를 새로고침해 주세요. (This session ticket is invalid — please reload the page.)',
  [RV2.QUEUE_INVALID]:
    '오늘의 복습 세트를 불러오지 못했습니다. 페이지를 새로고침해 주세요. (Today\'s review set could not be loaded — please reload the page.)',
  [RV2.EMPTY_POOL]:
    '아직 복습할 단어가 없습니다. (No words to review yet.)',
  [RV2.LIST_END]:
    '이 목록의 모든 단어를 학습했습니다. (You have reached the end of this list.)',
  [RV2.DAY_GUARD_REJECTED]:
    '학습 날짜 정보가 갱신되었습니다. 페이지를 새로고침해 주세요. (Your study day advanced — please reload the page.)',
  [RV2.PRESENTATION_INVALID]:
    '시험 정보를 불러오지 못했습니다. 페이지를 새로고침해 주세요. (The test could not be loaded — please reload the page.)',
  [RV2.LIST_WORDS_MALFORMED]:
    '단어 목록에 문제가 있어 시험을 만들 수 없습니다. 선생님께 알려 주세요. (This word list has a data problem — please tell your teacher.)',
}

const GENERIC_REFUSAL_REASON =
  '지금은 학습 세션을 시작할 수 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요. ' +
  '(The study session can\'t start right now — reload the page and try again.)'

/** Human-rendered reason for a blocking refusal. UNKNOWN statuses (a future
 *  server status this client does not know) get the generic reason. */
export function refusalReasonText(status) {
  return REFUSAL_REASONS[status] ?? GENERIC_REFUSAL_REASON
}

// ---------------------------------------------------------------------------
// The flag-on testConfig boundary (OPUS AUDIT FOLD F2/F3/F4 — 2026-08-04)
// ---------------------------------------------------------------------------
// The object handed to MCQTest/TypedTest is assembled HERE, in pure functions,
// so the node fixture suite can assert it and the mutant driver can break it.
// The pages call these at REVIEW_V2_CLIENT-gated call sites only.

/** F3 — the DISTRACTOR pool must remain the FULL available pool, exactly as
 *  legacy passes the full `wordPool` as `originalWordPool` while `wordsToTest`
 *  is the sized subset (testConfig.js:50). The engine presents a SUBSET;
 *  narrowing the pool to it shrank MCQ options (an N-word presentation ⇒ at
 *  most N−1 distractors, so a 3-word test rendered 3-option questions) and
 *  moved the guess odds — a SCORING change. Pool = the presented words
 *  VERBATIM first, then the rest of the day's serving universe (review: the
 *  DAY QUEUE — the segment is dead flag-on, V1.3; new: the day's introduced
 *  words — exactly legacy's pool), de-duped, so the legacy invariant
 *  wordsToTest ⊆ originalWordPool holds by construction. */
export function rv2DistractorPool({ words = [], poolWords = [] } = {}) {
  const pool = [...words]
  const seen = new Set(pool.map((w) => w?.id))
  for (const w of Array.isArray(poolWords) ? poolWords : []) {
    if (!w || w.id == null || seen.has(w.id)) continue
    seen.add(w.id)
    pool.push(w)
  }
  return pool
}

/** F4 — NEVER truncate a SERVER-COMPOSED typed set. The engine derives the
 *  score denominator from its own presentation record, so a client cap
 *  (TypedTest's MAX_TYPED_TEST_WORDS=50) on a 51-60-word presentation caps
 *  the score at ≤ 83% — a guaranteed fail at a 95% threshold the moment the
 *  submit fold lands. Decision (ledger F4): HONOUR the full presented set —
 *  refusing would hard-block every legitimately-configured 51-60-word class
 *  at the flip, and a bigger silent cap would recreate the same bug at a new
 *  number. The ENGINE is the sizer. Defensive copy; no slice at ANY size. */
export function rv2ServedTypedWords(words = []) {
  return [...words]
}

/** F2+F3 — the single flag-on testConfig override, spread over the REAL
 *  buildTestConfig output:
 *   · wordsToTest = the presentation VERBATIM (V3: served order = rendered
 *     order; buildTestConfig's selectTestWords re-sample is discarded).
 *   · originalWordPool = rv2DistractorPool(...) — the FULL pool (F3).
 *   · REVIEW ONLY: wordRangeStart/End = null (F2). Flag-on the test set is
 *     the engine's rotation over the whole introduced range, so a segment
 *     label ("Words #21–30") describes a set that no longer exists. Both
 *     consumers (SessionProgressSheet:152, SessionSteps:106) hide the whole
 *     line on falsy, so the header honestly reads "Day N" with zero new
 *     markup. null, not undefined: the keys survive JSON so the
 *     sessionStorage blob shape stays stable. NEW-test labels are untouched
 *     (newWordStart/EndIndex remain meaningful for new words — V1.3).
 *   · rv2 = the SUBMIT fold's handle (presentationId → reviewV2SubmitAttempt).
 */
export function rv2TestConfigOverride({ baseConfig = {}, rv2, testPhase }) {
  const isNew = testPhase === 'new'
  return {
    ...baseConfig,
    wordsToTest: [...rv2.words],
    originalWordPool: rv2DistractorPool({ words: rv2.words, poolWords: rv2.poolWords }),
    ...(isNew ? {} : { wordRangeStart: null, wordRangeEnd: null }),
    rv2: {
      presentationId: rv2.presentationId,
      testType: rv2.testType,
      logicalDay: rv2.logicalDay,
      resetEpoch: rv2.resetEpoch ?? null,
      source: isNew ? 'composeNewTest' : 'composeSession',
    },
  }
}

// ---------------------------------------------------------------------------
// The two compose surfaces
// ---------------------------------------------------------------------------

/** F5 — the day guard, shared by BOTH compose surfaces so they cannot
 *  disagree again (the audit found the review chokepoint guarding inline and
 *  SILENTLY falling to legacy, while prepareRv2NewTest passed the raw value
 *  through — two surfaces, two behaviours, same missing input). An invalid
 *  logicalDay means the engine CANNOT be asked; that must be OBSERVABLE
 *  (ledger A2: a silent fallback hides an engine that is not serving), never
 *  a silent slide: the outcome names itself (`via:'invalid_day'`) and logs
 *  BEFORE any key mint (no junk `d<undefined>` storage scopes). Callers keep
 *  the ordinary legacy fall-through — the student still gets a working
 *  session — and additionally report to system_logs at the call site. */
function invalidDayOutcome(logicalDay, kind, deps) {
  const log = deps.logInvalidDay ?? console.error
  log('[RV2] compose skipped — invalid logicalDay; the legacy path serves this session', {
    logicalDay: Number.isFinite(logicalDay) ? logicalDay : null,
    kind,
  })
  return {
    outcome: 'legacy',
    via: 'invalid_day',
    logicalDay: Number.isFinite(logicalDay) ? logicalDay : null,
  }
}

/** Shared refusal→outcome mapping for a compose result that is NOT composed.
 *  `scope` lets a server-declared-dead key be discarded so the next
 *  deliberate entry mints fresh (never a silent auto-recompose loop). */
function refusalOutcome(result, scope, deps) {
  if (isNotServing(result)) {
    // DATA channel: only config_hold / review_v2_dark actually arrive as
    // data (the other three NOT_SERVING statuses are thrown — see V4).
    return { outcome: 'legacy', via: 'status', status: result.status }
  }
  if (isStaleClient(result)) {
    return { outcome: 'blocked', status: result.status, reason: refusalReasonText(result.status) }
  }
  if (result?.status === RV2.COMPOSE_KEY_REUSED || result?.status === RV2.INVALID_COMPOSE_KEY) {
    // The stored key can never serve this request again (fingerprint moved —
    // day advanced or epoch changed under it). Discard so the NEXT deliberate
    // entry mints fresh; BLOCK now rather than silently composing a
    // different test out from under the student.
    discardComposeKey(scope, deps)
    return { outcome: 'blocked', status: result.status, reason: refusalReasonText(result.status) }
  }
  const status = typeof result?.status === 'string' ? result.status : 'malformed_response'
  return { outcome: 'blocked', status, reason: refusalReasonText(status) }
}

function thrownOutcome(err) {
  if (classifyThrownRefusal(err) === 'legacy') {
    return { outcome: 'legacy', via: 'error', code: err?.code ?? null }
  }
  // Transport/server failure or a request-shape bug: render a reason (retry
  // copy), never a blank screen, never a silent legacy fallback.
  return { outcome: 'blocked', status: 'error', code: err?.code ?? null, reason: GENERIC_REFUSAL_REASON }
}

/**
 * Compose (or replay) the day's live REVIEW session — called at REVIEW-PHASE
 * ENTRY, never at session start (V2): the day queue is created by the FIRST
 * `composeSession` of the logical day and then PINNED (day-scoped docId), so
 * composing early pins it before the day's new-test labels/anchor exist and
 * no later call can repair it. Up-front counts render from teacher config.
 *
 * @returns {Promise<object>} one of:
 *   {outcome:'composed', presentationId, presentedWordIds, queueWordIds,
 *    testType, logicalDay, resetEpoch, composeKey}
 *   {outcome:'legacy', via, status?|code?}   — use the legacy client path
 *   {outcome:'blocked', status, reason}      — render `reason`, do NOT fall back
 */
export async function composeReviewSessionV2(
  { uid, classId, listId, logicalDay, freshKey = false },
  deps = {}
) {
  // F5: guard FIRST — before key mint/discard, so an invalid day never
  // touches storage and never reaches the engine as a malformed request.
  if (!Number.isInteger(logicalDay) || logicalDay < 1) {
    return invalidDayOutcome(logicalDay, 'review', deps)
  }
  const composeFn = deps.composeSessionFn ?? composeSession
  const scope = composeKeyScope({ uid, classId, listId, logicalDay, kind: 'review' })
  if (freshKey) discardComposeKey(scope, deps) // deliberate retake ⇒ NEW presentation
  const composeKey = getOrCreateComposeKey(scope, deps)
  let result
  try {
    result = await composeFn({ classId, listId, logicalDay, composeKey })
  } catch (err) {
    return thrownOutcome(err)
  }
  if (result?.status === RV2.COMPOSED) {
    const presentedWordIds = result?.presentation?.presentedWordIds
    const queueWordIds = result?.queue?.orderedQueueWordIds
    if (!Array.isArray(presentedWordIds) || presentedWordIds.length === 0 ||
        !Array.isArray(queueWordIds) || queueWordIds.length === 0) {
      return { outcome: 'blocked', status: 'malformed_response', reason: GENERIC_REFUSAL_REASON }
    }
    return {
      outcome: 'composed',
      presentationId: result.presentation.presentationId,
      // VERBATIM (V3): the served order is the rendered order.
      presentedWordIds: [...presentedWordIds],
      queueWordIds: [...queueWordIds],
      testType: result.presentation.testType === 'typed' ? 'typed' : 'mcq',
      logicalDay,
      resetEpoch: result.queue.resetEpoch ?? null,
      composeKey,
    }
  }
  return refusalOutcome(result, scope, deps)
}

/**
 * Compose (or replay) the day's live NEW-WORD test. Does NOT create/pin the
 * day queue (only `composeSession` does), so calling this at new-test entry
 * cannot violate the V2 timing law.
 *
 * @returns {Promise<object>} same envelope as composeReviewSessionV2, minus
 *   queueWordIds, plus rangeStartIndex/rangeEndIndex when the server sent them.
 */
export async function composeNewTestV2(
  { uid, classId, listId, logicalDay, freshKey = false },
  deps = {}
) {
  // F5: same guard as composeReviewSessionV2 — the two surfaces must never
  // again disagree about the same missing input.
  if (!Number.isInteger(logicalDay) || logicalDay < 1) {
    return invalidDayOutcome(logicalDay, 'new', deps)
  }
  const composeFn = deps.composeNewTestFn ?? composeNewTest
  const scope = composeKeyScope({ uid, classId, listId, logicalDay, kind: 'new' })
  if (freshKey) discardComposeKey(scope, deps) // deliberate retake ⇒ NEW presentation
  const composeKey = getOrCreateComposeKey(scope, deps)
  let result
  try {
    result = await composeFn({ classId, listId, logicalDay, composeKey })
  } catch (err) {
    return thrownOutcome(err)
  }
  if (result?.status === RV2.COMPOSED) {
    const presentedWordIds = result?.presentation?.presentedWordIds
    if (!Array.isArray(presentedWordIds) || presentedWordIds.length === 0) {
      return { outcome: 'blocked', status: 'malformed_response', reason: GENERIC_REFUSAL_REASON }
    }
    return {
      outcome: 'composed',
      presentationId: result.presentation.presentationId,
      // VERBATIM (V3): new-day order is the server's (canonical range order).
      presentedWordIds: [...presentedWordIds],
      testType: result.presentation.testType === 'typed' ? 'typed' : 'mcq',
      logicalDay,
      rangeStartIndex: Number.isInteger(result.presentation.rangeStartIndex)
        ? result.presentation.rangeStartIndex : null,
      rangeEndIndex: Number.isInteger(result.presentation.rangeEndIndex)
        ? result.presentation.rangeEndIndex : null,
      composeKey,
    }
  }
  return refusalOutcome(result, scope, deps)
}
