/**
 * ============================================================================
 * DEEPFIX2 · DF2-51-d + 51-g — THE RE-TEST LAUNCH (compose · submit · the cap)
 * ============================================================================
 * Fold 4+7 of 8 in the DF2-51 train (`docs/plans/deepfix2/22_DF2-51_PASTDAY_
 * NAV_DESIGN.md` §7 RATIFIED — decisions (h) and (i) are this fold's). This is
 * the module the past-day browser's Re-test button and the two test pages both
 * call; it exists because this checkout cannot import JSX under plain node, so
 * every decision worth fixturing has to live in a `.js` sibling.
 *
 * CONSUMES, NEVER DUPLICATES (each import is the ONE authority for its thing):
 *  - `reviewV2Client.js` — the callable wrappers (`composeRerun`, `mintVisit`
 *    via 51-b, `submitAttempt`) and the frozen status classifiers, including
 *    this fold's own `practice_limit_reached` addition (decision (h)).
 *  - `reviewV2Compose.js` — `composeKeyScope`/`getOrCreateComposeKey`/
 *    `discardComposeKey` (the V5 compose-key persistence law), `rv2Distractor
 *    Pool` (the F3 full-pool law) and `refusalReasonText`/`classifyThrown
 *    Refusal`. A rerun gets its own compose-key KIND, not its own storage.
 *  - `reviewV2Submit.js` — the recompose-ONCE guard primitives
 *    (`recomposeGuardScope`/`recomposeUsed`/`markRecomposeUsed`/
 *    `clearRecomposeGuard`) and the poll bounds. Same once-flag idiom under a
 *    rerun-scoped key; NOT a second implementation.
 *  - `restudyVisit.js` (51-b) — mint/persist/discard/re-mint-once of the
 *    `visitId`. THIS MODULE IS ITS FIRST REAL CALLER: 51-b's header says the
 *    mint happens "at the FIRST RERUN COMPOSE" — that is `composeRerunHalf`.
 *  - `pastDayAuthority.js` (51-a) — `canRetestTyped`, the presentation-only cap
 *    predicate, read through `shouldPreemptTypedRetest` below.
 *  - `streakAuthority.js` — `kstDateString`, already mirrored byte-for-byte
 *    from the server's own day law; the cap window is a KST calendar day
 *    (`functions/aiMetering.js` `meterWindowKey`).
 *
 * WHY THE RERUN SUBMIT IS ITS OWN FUNCTION (and not `submitAttemptV2`). Three
 * hard differences, each verified in the engine:
 *   1. RECOMPOSE SURFACE. `submitAttemptV2`'s `grade_unusable` branch
 *      recomposes through `composeNewTestV2`/`composeReviewSessionV2`
 *      (`reviewV2Submit.js:345-347`) — LIVE composes. Routing a rerun there
 *      would compose a LIVE test for a PAST day. A rerun recomposes through
 *      `reviewV2ComposeRerun` against the SAME visit.
 *   2. REFUSAL SET. A rerun can be refused `visit_invalid`
 *      (`callables.js:747-757`) and `practice_limit_reached`
 *      (`typedGrading.js:323`); neither exists on the live legs.
 *   3. NO LEGACY FALLBACK. Restudy is a review-v2-ONLY feature — there is no
 *      legacy restudy path to fall back to, so "the engine is not serving"
 *      must BLOCK, never silently run the legacy submit (which would write a
 *      LIVE-looking attempt for a past day). 51-b made the same call and named
 *      the outcome `unavailable` rather than `legacy`; this module matches it.
 *
 * NON-ADVANCEMENT IS THE SERVER'S, NOT A CLIENT FLAG (brief, leg 1). A rerun
 * attempt is stamped `type:'retest'` BY THE SERVER from its own presentation
 * fingerprint (`callables.js:684` → `:769`), and a `type:'retest'` attempt
 * satisfies NEITHER half of the day advance (`completion.js:323` consumed
 * review, `:455` new test — both `no_evidence`); rerun halves are additionally
 * written RANGE-LESS (`callables.js:770-775`), so a rerun cannot move
 * `deriveDayAnchorRange`'s anchor either. What this module contributes is the
 * absence of a session: `rerunTestConfigOverride` STRIPS `dayNumber`/
 * `isFirstDay`/`segment`, so the test page's existing completion gate
 * (`MCQTest.jsx:952` `sessionContext?.dayNumber`) is structurally unreachable —
 * a missing session, not a "don't advance" special case bolted onto one.
 *
 * NTF-27 (decision (i)) lives here too — see `rv2PersistableHandle` /
 * `rebuildableHandle` and their header block below.
 */

// Explicit .js extensions: this module is loaded by the node fixture scripts
// (scripts/deepfix2/df2-51dg-retest-*.mjs) as well as by Vite.
import {
  composeRerun,
  submitAttempt,
  isNotServing,
  isStaleClient,
  isGradingInProgress,
  isGradeUnusable,
  isPracticeLimitReached,
  practiceLimitReason,
  RV2,
} from './reviewV2Client.js'
import {
  composeKeyScope,
  getOrCreateComposeKey,
  discardComposeKey,
  classifyThrownRefusal,
  refusalReasonText,
  rv2DistractorPool,
} from './reviewV2Compose.js'
import {
  recomposeGuardScope,
  recomposeUsed,
  markRecomposeUsed,
  clearRecomposeGuard,
  SUBMIT_POLL_RETRIES,
  SUBMIT_POLL_INTERVAL_MS,
} from './reviewV2Submit.js'
import {
  getOrMintVisit,
  remintVisitOnRefusal,
  isVisitInvalidatingStatus,
  noteVisitCompleted,
} from './restudyVisit.js'
import { canRetestTyped } from '../utils/pastDayAuthority.js'
import { kstDateString } from '../utils/streakAuthority.js'

// ---------------------------------------------------------------------------
// Storage — same probe-then-fallback idiom as reviewV2Compose.js /
// reviewV2Submit.js / restudyVisit.js (all four keep theirs private; those
// three are certified by their own receipts and stay byte-untouched).
// ---------------------------------------------------------------------------

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
      const probe = '__rv2rr_probe__'
      s.setItem(probe, '1')
      s.removeItem(probe)
      return s
    }
  } catch { /* fall through to memory */ }
  return memoryStorage
}

// ---------------------------------------------------------------------------
// THE RERUN SOURCE TAG — how every downstream reader knows "this is a rerun"
// ---------------------------------------------------------------------------

/** The `rv2.source` values a RERUN presentation carries. Deliberately distinct
 *  strings from the live pair (`composeNewTest` / `composeSession`), because
 *  `source` is what the test pages switch on to pick a submit leg, a recompose
 *  surface and a retake path — a rerun that reused a live tag would silently
 *  inherit all three. */
export const RERUN_SOURCE = Object.freeze({
  review: 'composeRerunReview',
  new: 'composeRerunNew',
})

const RERUN_SOURCES = new Set([RERUN_SOURCE.review, RERUN_SOURCE.new])

/** The rerun submit's "a fresh test was composed" outcome tag — the SAME
 *  string the live adapter uses, exported as a NAMED constant so the pages can
 *  branch on it without writing the literal a second time. Why that matters:
 *  cutover-d's certified fixture slices each page's live recompose branch
 *  between `} else if (out.outcome === 'recomposed') {` and its catch, and
 *  asserts that anchor occurs EXACTLY ONCE — a duplicate literal would turn a
 *  sibling fold's proof red without changing any behaviour. */
export const RERUN_RECOMPOSED = 'recomposed'

/** True for a rerun presentation handle's `source`. */
export function isRerunSource(source) {
  return RERUN_SOURCES.has(source)
}

/** 'review' | 'new' | null — the rerun half a source tag denotes. */
export function rerunHalfFromSource(source) {
  if (source === RERUN_SOURCE.review) return 'review'
  if (source === RERUN_SOURCE.new) return 'new'
  return null
}

/** The `rv2.source` values a page running THIS session type may accept from a
 *  stored handle: the live one it already accepted (byte-preserved) plus the
 *  rerun one for the same half. A 'new' page must never adopt a review
 *  presentation, rerun or not — that mis-route is what the original
 *  `wantSource` equality existed to prevent. */
export function wantedRv2Sources(currentTestType) {
  return currentTestType === 'new'
    ? ['composeNewTest', RERUN_SOURCE.new]
    : ['composeSession', RERUN_SOURCE.review]
}

/**
 * WHICH HALF does the row's single "Re-test" button compose? The wireframe has
 * ONE button per day, but a visit only reaches `completed:true` — and the day
 * only earns a pip — when BOTH halves land on the SAME visit
 * (`functions/reviewV2/visits.js:106-127`). So the button composes the half
 * that is still MISSING from the current visit, preferring the NEW half:
 *   · new pip 'off'  ⇒ the day HAS a new-word half and this visit has not
 *                      recorded it ⇒ compose 'new'
 *   · new pip 'on'   ⇒ already recorded in this visit ⇒ compose 'review'
 *   · new pip 'na'   ⇒ the day never had a new-word half (finding F3) ⇒
 *                      'review' forever; such a day can never be re-completed
 *                      (F4, already accepted by the pip fold)
 * Two taps therefore complete a visit, and a third starts a fresh one (the
 * completed visit was discarded — 51-b trigger 1).
 * @param {{newPipState?: string}} args the row's `pips.new` state, verbatim
 *   from `pastDayAuthority.js#derivePips` (never re-derived here).
 * @returns {'new'|'review'}
 */
export function nextRerunHalf({ newPipState } = {}) {
  return newPipState === 'off' ? 'new' : 'review'
}

// ---------------------------------------------------------------------------
// THE RESET EPOCH — a CACHE SCOPE, never authority (ledger V9)
// ---------------------------------------------------------------------------

/**
 * The client's read of the list's reset epoch — MIRRORS
 * `functions/reviewV2/composer.js:198-201` (`effectiveResetEpoch`) exactly:
 * `max(progress_meta.resetEpoch, list_progress.resetEpoch)`, absent/0/malformed
 * reading as 0.
 *
 * WHY A CLIENT COPY IS SAFE HERE. 51-b's `visitScopeKey` needs the epoch
 * (`restudyVisit.js:117-119`) but the SERVER derives its own for the mint
 * (`callables.js:913`) and for every tuple check (`visits.js:63-64`,
 * `callables.js:753-757`). So this value can only ever pick the client's
 * sessionStorage bucket: a stale/wrong read costs a cache miss (one extra mint
 * — inert garbage by contract, `visits.js:14-16`) or a stale visitId that the
 * server refuses `visit_invalid`, which `composeRerunHalf` repairs by
 * re-minting once. It can never make a wrong write land.
 */
export function effectiveResetEpoch(pmData, lpData) {
  const e = (d) => (Number.isInteger(d?.resetEpoch) && d.resetEpoch > 0 ? d.resetEpoch : 0)
  return Math.max(e(pmData), e(lpData))
}

// ---------------------------------------------------------------------------
// Compose-key scope — reviewV2Compose.js's OWN function, with a rerun KIND
// ---------------------------------------------------------------------------

/** The rerun half's compose-key scope. Reuses `composeKeyScope` (so the V5
 *  persistence law has ONE implementation) with `kind: 'rerun-review'|
 *  'rerun-new'`, which can never collide with the live `'review'`/`'new'`
 *  scopes for the same day. */
export function rerunComposeScope({ uid, classId, listId, visitedDay, half }) {
  return composeKeyScope({ uid, classId, listId, logicalDay: visitedDay, kind: `rerun-${half}` })
}

/** The rerun half's recompose-once guard scope — `reviewV2Submit.js`'s own
 *  function with the same rerun kind (one once-flag idiom, two scopes). */
export function rerunRecomposeScope({ uid, classId, listId, visitedDay, half }) {
  return recomposeGuardScope({ uid, classId, listId, logicalDay: visitedDay, kind: `rerun-${half}` })
}

// ---------------------------------------------------------------------------
// Copy — this register's own (mirrors reviewV2Submit.js's separation: shared
// statuses reuse reviewV2Compose.js's REFUSAL_REASONS; the rerun-only ones get
// their line here). The CAP's copy is NOT here — it is `reviewV2Client.js`'s
// `PRACTICE_LIMIT_MESSAGE`, ratified verbatim in 22_ §7(h).
// ---------------------------------------------------------------------------

const REASON_NO_NEW_HALF =
  '이 날에는 다시 볼 새 단어 시험이 없습니다. 복습 재응시는 이용할 수 있습니다. ' +
  '(This day has no new-word test to retake — a review re-test is still available.)'

const REASON_RETEST_TICKET_INVALID =
  '재응시 정보가 만료되었습니다. 지난 학습일 목록에서 다시 시작해 주세요. ' +
  '(This retest ticket expired — please start the re-test again from Past Days.)'

const REASON_RETEST_SURRENDERED =
  '재응시를 준비하지 못했습니다. 페이지를 새로고침한 뒤에도 반복되면 선생님께 알려 주세요. ' +
  '(We could not prepare this retest — reload the page, and tell your teacher if it repeats.)'

const REASON_RETEST_UNAVAILABLE =
  '지금은 재응시를 이용할 수 없습니다. 잠시 후 다시 시도해 주세요. ' +
  "(Re-tests aren't available right now — please try again in a little while.)"

const REASON_STILL_GRADING =
  '채점이 아직 진행 중입니다. 잠시 후 다시 제출해 주세요 — 답안은 그대로 보존됩니다. ' +
  '(Grading is still in progress — submit again in a moment; your answers are kept.)'

const REASON_RETEST_RECOMPOSED =
  '이 재응시를 채점할 수 없어 새 재응시가 준비되었습니다. 새 시험을 풀고 다시 제출해 주세요. ' +
  '(This re-test could not be graded, so a fresh one was prepared — please take it and submit again.)'

const GENERIC_RETEST_REASON =
  '재응시를 진행하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요. ' +
  "(The re-test couldn't be completed — reload the page and try again.)"

/** The statuses whose compose-fold copy reads correctly for a rerun too. */
const SHARED_REASON_STATUSES = new Set([
  RV2.RESET_IN_PROGRESS, RV2.RESET_EPOCH_MISMATCH, RV2.DAY_GUARD_REJECTED,
  RV2.CLIENT_VERSION_STALE, RV2.COMPOSE_KEY_REUSED, RV2.INVALID_COMPOSE_KEY,
  RV2.PRESENTATION_INVALID, RV2.QUEUE_INVALID, RV2.LIST_WORDS_MALFORMED,
])

/** Human-rendered reason for a rerun refusal. Every blocking status renders
 *  one — an unknown status gets the generic line, never a blank screen. */
export function rerunRefusalReason(status) {
  if (SHARED_REASON_STATUSES.has(status)) return refusalReasonText(status)
  if (status === RV2.NO_EVIDENCE || status === RV2.EMPTY_POOL) return REASON_NO_NEW_HALF
  if (status === RV2.VISIT_INVALID) return REASON_RETEST_TICKET_INVALID
  return GENERIC_RETEST_REASON
}

// ---------------------------------------------------------------------------
// THE CAP — decision (h)'s presentation leg (51-a's predicate is the reader)
// ---------------------------------------------------------------------------

/** The KST window a cap refusal was learned in. `canRetestTyped` compares this
 *  against the CURRENT window to decide whether a remembered refusal has
 *  rolled over (`pastDayAuthority.js:496-503`); the server's refusal payload
 *  carries no window key of its own, so the client stamps it. */
export function currentCapWindowKey(nowMs) {
  return kstDateString(Number.isFinite(nowMs) ? nowMs : Date.now())
}

function capScopeKey({ uid, classId, listId }) {
  return `rv2cap.${uid}.${classId}.${listId}`
}

/**
 * Remember a `practice_limit_reached` refusal for the rest of THIS KST window,
 * so the browser can stop offering typed re-tests without re-asking the server.
 * PRESENTATION ONLY — the server is the enforcement point; this is a hint that
 * is allowed to be wrong in the "offer it anyway" direction (51-a's predicate
 * fails toward SHOWING the button).
 * @returns {{refused: true, scope: string, windowKey: string}|null}
 */
export function recordPracticeCap({ uid, classId, listId }, result, { storage, nowMs } = {}) {
  const parsed = practiceLimitReason(result)
  if (!parsed) return null
  const snapshot = { refused: true, scope: parsed.scope, windowKey: currentCapWindowKey(nowMs) }
  const store = storage ?? defaultStorage()
  try { store.setItem(capScopeKey({ uid, classId, listId }), JSON.stringify(snapshot)) } catch { /* degraded */ }
  return snapshot
}

/** The remembered cap snapshot for this (uid, class, list), or null. Corrupt/
 *  foreign values read as null (no cap known ⇒ offer typed). */
export function readPracticeCap({ uid, classId, listId }, { storage } = {}) {
  const store = storage ?? defaultStorage()
  let raw = null
  try { raw = store.getItem(capScopeKey({ uid, classId, listId })) } catch { return null }
  if (typeof raw !== 'string' || raw.length === 0) return null
  let parsed = null
  try { parsed = JSON.parse(raw) } catch { return null }
  if (!parsed || parsed.refused !== true || typeof parsed.windowKey !== 'string') return null
  return { refused: true, scope: typeof parsed.scope === 'string' ? parsed.scope : 'student', windowKey: parsed.windowKey }
}

/**
 * Should the client PRE-EMPT a typed re-test it already knows is capped?
 *
 * THE MCQ LAW (brief, leg 1): MCQ re-tests are UNMETERED and must remain
 * available even when typed is capped — `functions/reviewV2/callables.js:558`
 * gates the whole metered typed leg on `pres.testType === "typed"`, so an MCQ
 * rerun can never be refused by the cap. Hence the modality is checked FIRST
 * and an MCQ class is never pre-empted, no matter what snapshot is stored.
 *
 * @param {{reviewTestType?: string, metering?: object|null,
 *   currentWindowKey?: string}} args `reviewTestType` is the class's rerun
 *   modality (`assignments[listId].reviewTestType`, the same field the engine
 *   composes with — `callables.js:445,467`).
 */
export function shouldPreemptTypedRetest({ reviewTestType, metering, currentWindowKey } = {}) {
  if (reviewTestType !== 'typed') return false
  return !canRetestTyped({ metering, currentWindowKey })
}

// ---------------------------------------------------------------------------
// NTF-27 (decision (i)) — THE RELOAD REBUILD
// ---------------------------------------------------------------------------
// THE GAP (cutover-d, NEED_TO_FIX 27, re-verified in the bytes): the
// sessionStorage blob persisted only the presentation HANDLE
// ({presentationId,testType,logicalDay,resetEpoch,source}); the WORDS lived in
// `location.state.testConfig`, which a hard reload drops. The page then
// rebuilt a DIFFERENT word set from the legacy smart-selection path while
// `getRv2SubmitHandle()` still returned the blob's handle ⇒ the next submit
// answered the new presentationId with the old/other words ⇒ server
// drift-reject (`callables.js:527-529`): safe, but a dead end.
//
// THE CHOICE: PERSIST, not re-compose on reload. Reasons, in order:
//   1. A recompose-on-reload turns a local recovery into a NETWORK dependency
//      mid-test, and it can REFUSE (day_guard_rejected once the day advances,
//      reset_epoch_mismatch, config_hold) — replacing a confusing dead end
//      with a blocking one, in the exact moment the student has answers on
//      screen.
//   2. It is not even a pure replay in the case NTF-27 names: after a
//      `grade_unusable` recompose the key was re-minted with `freshKey:true`,
//      so which presentation a reload-recompose returns depends on storage
//      state the reload may have lost.
//   3. The blob ALREADY is this page's reload-recovery mechanism (it carries
//      newWords/reviewQueue/sessionConfig for exactly this reason). Persisting
//      ids is the same mechanism, not a new one — and it is what NTF-27's own
//      "Fix direction" names first.
// The stored handle therefore carries the presented ids, the FULL distractor
// pool ids (F3: rebuilding with the presented subset alone would shrink MCQ
// options and move the guess odds) and the two scalars the page would
// otherwise have to re-read the class doc for.

/**
 * The handle to persist in the sessionStorage blob — the live cutover handle
 * plus everything a reload needs to rebuild the SAME on-screen test.
 * @param {{rv2: object, words: Array, poolWords: Array,
 *   testOptionsCount?: number, passThresholdDecimal?: number}} args
 */
export function rv2PersistableHandle({ rv2, words, poolWords, testOptionsCount, passThresholdDecimal } = {}) {
  const ids = (list) => (Array.isArray(list) ? list : [])
    .map((w) => (typeof w === 'string' ? w : w?.id))
    .filter((id) => typeof id === 'string' && id.length > 0)
  const presentedWordIds = ids(words)
  const poolIds = ids(poolWords)
  return {
    ...rv2,
    presentedWordIds,
    // The pool ALWAYS contains the presented set (rv2DistractorPool puts it
    // first); a caller that passes no pool degrades to presented-only rather
    // than to an empty pool.
    poolWordIds: poolIds.length > 0 ? poolIds : presentedWordIds,
    ...(Number.isFinite(testOptionsCount) ? { testOptionsCount } : {}),
    ...(Number.isFinite(passThresholdDecimal) ? { passThresholdDecimal } : {}),
  }
}

/**
 * Can this stored handle rebuild its test after a reload? Returns the id lists
 * (and the two optional scalars) or null — null means "fall through to the
 * page's existing path", never a throw and never a half-rebuild.
 */
export function rebuildableHandle(handle) {
  const ok = (v) => Array.isArray(v) && v.length > 0 &&
    v.every((id) => typeof id === 'string' && id.length > 0)
  if (!handle || typeof handle.presentationId !== 'string' || handle.presentationId.length === 0) return null
  if (!ok(handle.presentedWordIds)) return null
  const poolWordIds = ok(handle.poolWordIds) ? handle.poolWordIds : handle.presentedWordIds
  return {
    presentedWordIds: handle.presentedWordIds,
    poolWordIds,
    testOptionsCount: Number.isFinite(handle.testOptionsCount) ? handle.testOptionsCount : null,
    passThresholdDecimal: Number.isFinite(handle.passThresholdDecimal) ? handle.passThresholdDecimal : null,
  }
}

/** The sessionStorage key of the LIVE daily-session blob (DailySessionFlow's,
 *  untouched by this fold) and of the RESTUDY blob. They are SEPARATE keys on
 *  purpose: a re-test taken in the middle of a live session must not clobber
 *  the session's own recovery blob (newWords/reviewQueue/sessionConfig). */
export const LIVE_BLOB_KEY = 'dailySessionState'
export const RESTUDY_BLOB_KEY = 'restudyTestState'

/** The blob a re-test launch writes. Deliberately minimal: identity + the
 *  handle. It carries NO session fields — there is no session to complete. */
export function restudyBlobPayload({ classId, listId, visitedDay, half, rv2 }) {
  return { classId, listId, visitedDay, half, rv2Presentation: rv2 }
}

/**
 * The PURE core of the pages' `getRv2SubmitHandle`: the engine presentation a
 * stored blob offers this page, or null. Identity-checked against the page's
 * class/list, and the `source` must match the phase (extended to the rerun
 * tag for the same half — `wantedRv2Sources`), so a stale blob can never
 * mis-route a submit.
 */
export function rv2HandleFromBlob({ blob, classId, listId, currentTestType }) {
  const h = blob?.rv2Presentation
  if (!h || typeof h.presentationId !== 'string' || h.presentationId.length === 0) return null
  if (!wantedRv2Sources(currentTestType).includes(h.source)) return null
  if (blob.classId !== classId || blob.listId !== listId) return null
  return h
}

/** 'new' | 'review' | null — the SESSION TYPE a handle's source denotes, live
 *  or rerun. The reload rebuild needs this because a hard reload also drops the
 *  page's knowledge of which half it was running: the URL's `?type=` is
 *  optional on the live route (`DailySessionFlow.jsx:1585` navigates without
 *  it), so the stored handle is the only reliable witness. */
export function rv2SessionTypeFromSource(source) {
  if (source === 'composeNewTest' || source === RERUN_SOURCE.new) return 'new'
  if (source === 'composeSession' || source === RERUN_SOURCE.review) return 'review'
  return null
}

/** The blob's handle WITHOUT a phase filter — identity-checked (class/list) and
 *  restricted to the four known sources, but not to a particular half. ONLY the
 *  reload rebuild may use this (see `rv2SessionTypeFromSource`); a submit must
 *  keep using `rv2HandleFromBlob`, whose phase equality is what stops a stale
 *  blob mis-routing an answer sheet. */
export function rv2HandleFromBlobAny({ blob, classId, listId }) {
  const h = blob?.rv2Presentation
  if (!h || typeof h.presentationId !== 'string' || h.presentationId.length === 0) return null
  if (rv2SessionTypeFromSource(h.source) === null) return null
  if (blob.classId !== classId || blob.listId !== listId) return null
  return h
}

/** The same acceptance test for the `location.state` handle (no blob identity
 *  to check — the page's own route params ARE its identity). */
export function rv2HandleFromTestConfig({ testConfig, currentTestType }) {
  const h = testConfig?.rv2
  if (!h || typeof h.presentationId !== 'string' || h.presentationId.length === 0) return null
  return wantedRv2Sources(currentTestType).includes(h.source) ? h : null
}

/** Replace a blob's presentation handle without disturbing anything else. */
export function blobWithRv2Presentation(blob, rv2) {
  if (!blob || typeof blob !== 'object') return null
  return { ...blob, rv2Presentation: rv2 }
}

// ---------------------------------------------------------------------------
// THE TEST CONFIG a rerun hands the test page
// ---------------------------------------------------------------------------

/**
 * The rerun's testConfig — the live `rv2TestConfigOverride`'s sibling
 * (`reviewV2Compose.js:246-261`), with three deliberate differences:
 *
 *  · `source` is the RERUN tag (so the page picks the rerun submit leg).
 *  · `visitId`/`visitedDay` ride on the handle — the submit needs the visit to
 *    close its half (`visits.js:92-130`), and the page must not have to
 *    re-derive it.
 *  · IT CARRIES NO SESSION. `dayNumber`/`isFirstDay`/`segment` are STRIPPED,
 *    not merely omitted: they are what the pages' completion gate reads
 *    (`MCQTest.jsx:952`, `TypedTest.jsx:1250`), and a rerun has no day to
 *    complete. This is the absence of a session, not a "don't advance" flag —
 *    the SERVER is what makes a retest non-advancing (`completion.js:323,455`).
 *
 * The range labels are nulled for BOTH halves (F2's reason applies doubly to a
 * rerun: the review pool is the full introduced range, and the new half is a
 * historical anchor range, so "Words #a-b" would describe neither).
 */
export function rerunTestConfigOverride({ baseConfig = {}, rerun } = {}) {
  const safeBase = { ...baseConfig }
  delete safeBase.dayNumber
  delete safeBase.isFirstDay
  delete safeBase.segment
  const half = rerun.half === 'new' ? 'new' : 'review'
  return {
    ...safeBase,
    testType: half,
    wordsToTest: [...rerun.words],
    originalWordPool: rv2DistractorPool({ words: rerun.words, poolWords: rerun.poolWords }),
    wordRangeStart: null,
    wordRangeEnd: null,
    rv2: {
      presentationId: rerun.presentationId,
      testType: rerun.testType,
      logicalDay: rerun.visitedDay,
      visitedDay: rerun.visitedDay,
      visitId: rerun.visitId,
      resetEpoch: rerun.resetEpoch ?? null,
      source: RERUN_SOURCE[half],
    },
  }
}

// ---------------------------------------------------------------------------
// COMPOSE — "lazily mint the visit at the FIRST rerun compose" (51-b's law)
// ---------------------------------------------------------------------------

function argsValid({ uid, classId, listId, visitedDay, half, resetEpoch }) {
  return typeof uid === 'string' && uid.length > 0 &&
    typeof classId === 'string' && classId.length > 0 &&
    typeof listId === 'string' && listId.length > 0 &&
    Number.isInteger(visitedDay) && visitedDay >= 1 &&
    (half === 'review' || half === 'new') &&
    Number.isInteger(resetEpoch) && resetEpoch >= 0
}

/**
 * Compose (or replay) ONE rerun half for a past day.
 *
 * @returns {Promise<object>} one of:
 *   {outcome:'composed', presentationId, presentedWordIds, testType, visitId,
 *    visitedDay, half, composeKey, resetEpoch}
 *   {outcome:'unavailable', via, status?|code?} — the engine is not serving
 *     this student right now; restudy has NO legacy fallback, so the caller
 *     renders `reason` and stops (never a silent legacy path)
 *   {outcome:'blocked', status, reason}
 */
export async function composeRerunHalf(
  { uid, classId, listId, visitedDay, half, resetEpoch, freshKey = false },
  deps = {}
) {
  if (!argsValid({ uid, classId, listId, visitedDay, half, resetEpoch })) {
    return { outcome: 'blocked', status: 'malformed_request', reason: GENERIC_RETEST_REASON }
  }
  const composeFn = deps.composeRerunFn ?? composeRerun
  const scope = rerunComposeScope({ uid, classId, listId, visitedDay, half })
  const visitArgs = { uid, classId, listId, day: visitedDay, resetEpoch }

  // 51-b, THE FIRST REAL CALL: mint lazily, HERE, at the first rerun compose.
  const visit = await getOrMintVisit(visitArgs, deps)
  if (visit.outcome !== 'cached' && visit.outcome !== 'minted') {
    // 'unavailable' | 'blocked' — pass 51-b's own envelope through unchanged;
    // it already carries a rendered reason for the blocked family.
    return visit
  }

  const runCompose = async (visitId, wantFreshKey) => {
    if (wantFreshKey) discardComposeKey(scope, deps)
    const composeKey = getOrCreateComposeKey(scope, deps)
    let result
    try {
      result = await composeFn({ classId, listId, visitedDay, half, visitId, composeKey })
    } catch (err) {
      if (classifyThrownRefusal(err) === 'legacy') {
        // The thrown trio. Restudy has no legacy path (see the header), so this
        // is 'unavailable', not 'legacy' — 51-b's vocabulary, deliberately.
        return { outcome: 'unavailable', via: 'error', code: err?.code ?? null, reason: REASON_RETEST_UNAVAILABLE }
      }
      return { outcome: 'blocked', status: 'error', code: err?.code ?? null, reason: GENERIC_RETEST_REASON }
    }
    if (result?.status === RV2.COMPOSED) {
      const presentedWordIds = result?.presentation?.presentedWordIds
      if (!Array.isArray(presentedWordIds) || presentedWordIds.length === 0) {
        return { outcome: 'blocked', status: 'malformed_response', reason: GENERIC_RETEST_REASON }
      }
      return {
        outcome: 'composed',
        presentationId: result.presentation.presentationId,
        // VERBATIM (V3): the served order is the rendered order.
        presentedWordIds: [...presentedWordIds],
        testType: result.presentation.testType === 'typed' ? 'typed' : 'mcq',
        visitId,
        visitedDay,
        half,
        resetEpoch,
        composeKey,
      }
    }
    if (isNotServing(result)) {
      return { outcome: 'unavailable', via: 'status', status: result.status, reason: REASON_RETEST_UNAVAILABLE }
    }
    if (isStaleClient(result)) {
      return { outcome: 'blocked', status: result.status, reason: refusalReasonText(result.status) }
    }
    if (result?.status === RV2.COMPOSE_KEY_REUSED || result?.status === RV2.INVALID_COMPOSE_KEY) {
      // The stored key can never serve this request again — discard so the next
      // deliberate entry mints fresh; BLOCK now rather than silently composing
      // a different test (the cutover-a law, applied to the rerun scope).
      discardComposeKey(scope, deps)
      return { outcome: 'blocked', status: result.status, reason: refusalReasonText(result.status) }
    }
    const status = typeof result?.status === 'string' ? result.status : 'malformed_response'
    return { outcome: 'blocked', status, reason: rerunRefusalReason(status) }
  }

  const first = await runCompose(visit.visitId, freshKey)
  if (first.outcome !== 'blocked' || !isVisitInvalidatingStatus(first.status)) return first

  // 51-b's re-mint-once contract: visit_invalid / reset_epoch_mismatch /
  // reset_in_progress mean THIS visit is bad. One remedial mint, then retry —
  // and the retry MUST use a FRESH composeKey, because the server's compose-key
  // fingerprint includes the visitId (`presentations.js:345` → `:347`
  // compose_key_reused), so the stored key is bound to the dead visit.
  const remint = await remintVisitOnRefusal({ ...visitArgs, refusalStatus: first.status }, deps)
  if (remint.outcome === 'reminted') return runCompose(remint.visitId, true)
  if (remint.outcome === 'surrendered') {
    return { outcome: 'blocked', status: remint.status, reason: REASON_RETEST_SURRENDERED }
  }
  // The repair mint ITSELF refused (unavailable/blocked) — surface that.
  return remint
}

// ---------------------------------------------------------------------------
// SUBMIT — the rerun's own status census
// ---------------------------------------------------------------------------

function submitArgsValid({ uid, classId, listId, visitedDay, half, resetEpoch, visitId, presentationId, answers }) {
  return argsValid({ uid, classId, listId, visitedDay, half, resetEpoch }) &&
    typeof visitId === 'string' && visitId.length > 0 &&
    typeof presentationId === 'string' && presentationId.length > 0 &&
    Array.isArray(answers)
}

/**
 * Submit ONE rerun half — THE one call surface for a re-test submission.
 *
 * THE STATUS CENSUS (every branch fixtured):
 *   · `attempt_written` — terminal success. The response's `visitHalf`
 *     ({recorded, completedVisit} — `callables.js:824-838`) is fed VERBATIM to
 *     51-b's `noteVisitCompleted`, which discards the stored visit only on a
 *     real completion (a lone `recorded:true` is one half and must not).
 *   · `grading_in_progress` — TRANSIENT: poll the SAME submit, bounded, using
 *     `reviewV2Submit.js`'s own bounds. Never recompose.
 *   · `practice_limit_reached` — THE CAP (decision (h)): NOT transient and NOT
 *     repairable. NO poll, NO recompose, no guard consumed — render and stop.
 *   · `grade_unusable` — PERMANENT: recompose EXACTLY ONCE, through the RERUN
 *     compose against the SAME visit (never the live compose — see the header).
 *   · `visit_invalid`/`reset_*` — the stored visit is bad: 51-b's re-mint-once
 *     runs so the NEXT deliberate entry is clean, and the compose key is
 *     discarded with it (the key is fingerprinted to the dead visit, V7). The
 *     CURRENT presentation is bound to the dead visit and can never succeed,
 *     so this blocks — it does not silently re-submit.
 *   · not-serving — `unavailable`: restudy has no legacy path.
 *   · anything else / unknown — blocked with a rendered reason.
 *
 * @returns {Promise<object>} {outcome:'written'|'capped'|'recomposed'|
 *   'unavailable'|'blocked', ...}
 */
export async function submitRerunAttempt(
  { uid, classId, listId, visitedDay, half, resetEpoch, visitId, presentationId, answers },
  deps = {}
) {
  if (!submitArgsValid({ uid, classId, listId, visitedDay, half, resetEpoch, visitId, presentationId, answers })) {
    return { outcome: 'blocked', status: 'malformed_request', reason: GENERIC_RETEST_REASON }
  }
  const submitFn = deps.submitFn ?? submitAttempt
  const sleep = deps.sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  const pollRetries = Number.isInteger(deps.pollRetries) ? deps.pollRetries : SUBMIT_POLL_RETRIES
  const pollIntervalMs = Number.isInteger(deps.pollIntervalMs) ? deps.pollIntervalMs : SUBMIT_POLL_INTERVAL_MS
  const visitArgs = { uid, classId, listId, day: visitedDay, resetEpoch }
  const guardScope = rerunRecomposeScope({ uid, classId, listId, visitedDay, half })

  // V1 (cutover-b's law, unchanged): the payload is EXACTLY {presentationId,
  // answers}. The visitId is NOT sent — it rides on the SERVER's presentation
  // record (`callables.js:749` reads `p.visitId` from its own in-txn snapshot),
  // which is exactly why the compose had to attach it.
  const payload = { presentationId, answers }

  let result
  for (let attempt = 0; ; attempt++) {
    try {
      result = await submitFn(payload)
    } catch (err) {
      if (classifyThrownRefusal(err) === 'legacy') {
        return { outcome: 'unavailable', via: 'error', code: err?.code ?? null, reason: REASON_RETEST_UNAVAILABLE }
      }
      return { outcome: 'blocked', status: 'error', code: err?.code ?? null, reason: GENERIC_RETEST_REASON, retryable: true }
    }
    if (!isGradingInProgress(result)) break
    if (attempt >= pollRetries) {
      return { outcome: 'blocked', status: RV2.GRADING_IN_PROGRESS, reason: REASON_STILL_GRADING, retryable: true }
    }
    await sleep(pollIntervalMs)
  }

  if (result?.status === RV2.ATTEMPT_WRITTEN) {
    clearRecomposeGuard(guardScope, deps)
    // 51-b trigger 1, fed the response's own visitHalf — never a getDoc.
    const visit = noteVisitCompleted(visitArgs, result.visitHalf, deps)
    return {
      outcome: 'written',
      replayed: result.replayed === true,
      attemptId: typeof result.attemptId === 'string' ? result.attemptId : null,
      score: Number.isFinite(result.score) ? result.score : null,
      passed: result.passed === true,
      totalQuestions: Number.isFinite(result.totalQuestions) ? result.totalQuestions : null,
      correctCount: Number.isFinite(result.correctCount) ? result.correctCount : null,
      visitHalf: result.visitHalf ?? null,
      visitDiscarded: visit.discarded === true,
    }
  }

  if (isPracticeLimitReached(result)) {
    // DECISION (h). Terminal for today: the KST window is the only thing that
    // clears it. NOTHING is retried, nothing is recomposed, and the once-guard
    // is deliberately NOT consumed — a cap is not a grading incident.
    const parsed = practiceLimitReason(result)
    recordPracticeCap({ uid, classId, listId }, result, deps)
    return {
      outcome: 'capped',
      status: RV2.PRACTICE_LIMIT_REACHED,
      scope: parsed.scope,
      reason: parsed.message,
    }
  }

  if (isNotServing(result)) {
    return { outcome: 'unavailable', via: 'status', status: result.status, reason: REASON_RETEST_UNAVAILABLE }
  }

  if (isStaleClient(result)) {
    return { outcome: 'blocked', status: result.status, reason: refusalReasonText(result.status) }
  }

  if (isGradeUnusable(result)) {
    if (recomposeUsed(guardScope, deps)) {
      return { outcome: 'blocked', status: RV2.GRADE_UNUSABLE, reason: REASON_RETEST_SURRENDERED }
    }
    // Mark BEFORE recomposing — fail-closed across a crash mid-flow.
    markRecomposeUsed(guardScope, deps)
    const composed = await composeRerunHalf(
      { uid, classId, listId, visitedDay, half, resetEpoch, freshKey: true },
      deps
    )
    if (composed.outcome === 'composed') {
      return { outcome: 'recomposed', reason: REASON_RETEST_RECOMPOSED, compose: composed }
    }
    return composed
  }

  if (isVisitInvalidatingStatus(result?.status)) {
    // The visit this presentation is bound to is dead — the CURRENT submit can
    // never succeed. Re-mint once (51-b) and discard the key fingerprinted to
    // the dead visit, so the student's next entry from Past Days is clean.
    await remintVisitOnRefusal({ ...visitArgs, refusalStatus: result.status }, deps)
    discardComposeKey(rerunComposeScope({ uid, classId, listId, visitedDay, half }), deps)
    return { outcome: 'blocked', status: result.status, reason: REASON_RETEST_TICKET_INVALID }
  }

  const status = typeof result?.status === 'string' ? result.status : 'malformed_response'
  return { outcome: 'blocked', status, reason: rerunRefusalReason(status) }
}
