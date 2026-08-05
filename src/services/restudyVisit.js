/**
 * ============================================================================
 * DEEPFIX2 · DF2-51-b — THE CLIENT VISIT LIFECYCLE (mint · persist · discard)
 * ============================================================================
 * A past-day RE-TEST is a *visit*: `functions/reviewV2/visits.js` records the
 * new+review halves against ONE server-minted `restudy_visits/{visitId}` doc
 * and flips `completed:true` only when BOTH land on the SAME visit — set-once
 * per half, the completion CAS increments the day's pip counter exactly once
 * (`visits.js:92-130`). Cross-visit pairing is impossible by construction, so
 * a lost/mismatched client `visitId` means a student can re-study and
 * re-test correctly and STILL never see the day complete — a silent,
 * confusing failure. This module exists to prevent that: it owns the ONE
 * client-side copy of "which visit is this?" for the (classId, listId, day,
 * resetEpoch) currently open.
 *
 * DECISION (b) = B2, RATIFIED (`docs/plans/deepfix2/22_DF2-51_PASTDAY_NAV_DESIGN.md`
 * §7): mint the visitId LAZILY AT THE FIRST RERUN COMPOSE, not at day-tile
 * open (B1, REJECTED — mints a doc per tap and silently breaks half-pairing:
 * leave and re-open mid-visit and the two halves land on different visits,
 * so the R2-40c-ii pip is never earned). Hold it in `sessionStorage` under a
 * scope key that MIRRORS `reviewV2Compose.js`'s `composeKeyScope` convention,
 * with one deliberate delta: **`resetEpoch` IS part of the scope** (the
 * compose-key scope deliberately excludes it — the client cannot know it
 * pre-compose, `reviewV2Compose.js:92-96`; a visit is different: the caller
 * DOES know its resetEpoch by mint time, and a reset must never resurrect a
 * stale visit under the old epoch — `visits.js:14`, "epoch-tagged ...
 * reset-reachable").
 *
 * SCOPE BOUNDARY (this fold's OWN — read before wiring a caller):
 *  - This module MINTS (calls the existing `reviewV2Client.js#mintVisit`
 *    wrapper — no edit to it; the wrapper and the callable it wraps are both
 *    already committed and dormant) and manages the identifier client-side.
 *    It does NOT call `composeRerun` — the call that RECEIVES the minted id
 *    — that is wired in a later fold (51-d).
 *  - It never reads Firestore. The "visit completed" discard trigger is fed
 *    by the CALLER from the `visitHalf` object a rerun's `attempt_written`
 *    response already carries (`functions/reviewV2/callables.js:824-838`,
 *    `recordRerunHalfInTxn` → `{recorded, completedVisit}`,
 *    `visits.js:92-130`) — never a `getDoc` on `restudy_visits/{id}`.
 *
 * CRASH/ABANDON LAW (state it, don't repair it): an unminted-to-completion
 * visit is INERT GARBAGE by contract, never load-bearing — the engine is the
 * one that TTL-cleans it (`visits.js:14-16`: "epoch-tagged + timestamped —
 * reset-reachable and TTL-cleanable; incomplete visits are inert garbage at
 * worst, never load-bearing"). This module never validates a cached visitId
 * against the server before handing it back (that would be treating an
 * incomplete visit as state to repair, which the design doc forbids) — it
 * trusts the cache until a REAL compose/submit (outside this fold) proves it
 * wrong via a refusal, which is the only signal `remintVisitOnRefusal` acts
 * on. `mintRestudyVisit` also has NO idempotency key (`visits.js:67`,
 * `db.collection(...).doc()` — a fresh id every call), so caching-before-mint
 * is not an optimization here, it is what keeps `restudy_visits` from
 * accumulating one orphan doc per page load/re-render.
 *
 * RE-MINT EXACTLY ONCE mirrors cutover-d's recompose-once law
 * (`reviewV2Submit.js` — `recomposeGuardScope`/`recomposeUsed`/
 * `markRecomposeUsed`/`clearRecomposeGuard`, `:104-124`; mark BEFORE acting so
 * a crash mid-flow fails closed, `:334-336`; the guard SURVIVES the one
 * remedial action and clears only on a LATER, separate confirmed-good signal
 * — never on the remedial action's own success, `:304-306` vs `:353-355`) —
 * the SAME storage-backed once-flag idiom, not a second one:
 * `visitRemintGuardScope` / `visitRemintUsed` / `markVisitRemintUsed` /
 * `clearVisitRemintGuard` below.
 *
 * STORAGE DEGRADES, NEVER THROWS: mirrors `reviewV2Compose.js`'s
 * `defaultStorage()` (probe-then-fallback to an in-memory Map) and wraps every
 * read/write in try/catch — private-mode Safari or a full quota loses
 * persistence (a reload forgets the visit; the feature just re-mints), but
 * nothing here can throw into a render or a submit.
 *
 * DARK BY CONSTRUCTION: nothing calls this module yet (51-c/51-d land the
 * callers). Not flag-gated — there is no call site to gate, and therefore no
 * flag-off-parity claim to make (matches the sibling 51-a fold's own note on
 * `pastDayAuthority.js`).
 */

// Explicit .js extensions: this module is run by the node fixture scripts
// (scripts/deepfix2/df2-51b-visit-*.mjs) as well as by Vite, and node ESM
// resolution requires the extension. Vite accepts both forms.
import { mintVisit, RV2, isNotServing } from './reviewV2Client.js'
import { classifyThrownRefusal, refusalReasonText } from './reviewV2Compose.js'

// ---------------------------------------------------------------------------
// Storage — re-declared, not imported: `reviewV2Compose.js`/`reviewV2Submit.js`
// both keep theirs private (not exported), certified by their own cutover
// receipts and left byte-untouched by this fold.
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
      // Probe: storage can exist but throw on write (private mode).
      const probe = '__rv2visit_probe__'
      s.setItem(probe, '1')
      s.removeItem(probe)
      return s
    }
  } catch { /* fall through to memory */ }
  return memoryStorage
}

// ---------------------------------------------------------------------------
// Scope keys — mirrors composeKeyScope's `rv2ck.` shape (reviewV2Compose.js:97)
// ---------------------------------------------------------------------------

/** The visit's storage scope: (uid, classId, listId, day, resetEpoch). Unlike
 *  `composeKeyScope`, resetEpoch IS included (law, see header) — a reset must
 *  never resurrect a stale visit under the old epoch. */
export function visitScopeKey({ uid, classId, listId, day, resetEpoch }) {
  return `rv2visit.${uid}.${classId}.${listId}.d${day}.e${resetEpoch}`
}

/** The re-mint-once guard's OWN scope — a storage key SEPARATE from the visit
 *  itself (mirrors `recomposeGuardScope` living apart from the compose-key
 *  scope), so "discard the visit" and "discard the guard" stay independent
 *  operations even though several call sites below do both together. */
export function visitRemintGuardScope({ uid, classId, listId, day, resetEpoch }) {
  return `rv2vru.${uid}.${classId}.${listId}.d${day}.e${resetEpoch}`
}

const SCHEMA_VERSION = 1

/** Fail loud on a malformed handle — mirrors `reviewV2Submit.js:258-268` and
 *  the server's own `mintRestudyVisit` input law (`visits.js:42-47`): a junk
 *  scope ('rv2visit.undefined…') must never reach the network or storage. */
function isValidArgs({ uid, classId, listId, day, resetEpoch }) {
  return typeof uid === 'string' && uid.length > 0 &&
    typeof classId === 'string' && classId.length > 0 &&
    typeof listId === 'string' && listId.length > 0 &&
    Number.isInteger(day) && day >= 1 &&
    Number.isInteger(resetEpoch) && resetEpoch >= 0
}

// ---------------------------------------------------------------------------
// The stored envelope — the tuple is ECHOED alongside the visitId so a
// structurally-well-formed-but-STALE/foreign value (wrong tuple, older
// schema) is caught without relying on any assumption about Firestore's
// auto-id shape (no such shape is frozen anywhere in the engine contract).
// ---------------------------------------------------------------------------

function readStoredEnvelope(scope, store, { uid, classId, listId, day, resetEpoch }) {
  let raw = null
  try { raw = store.getItem(scope) } catch { return null }
  if (raw == null) return null // truly absent — nothing to read or heal
  let parsed = null
  if (typeof raw === 'string' && raw.length > 0) {
    try { parsed = JSON.parse(raw) } catch { parsed = null }
  }
  const ok = parsed && typeof parsed === 'object' &&
    parsed.schemaVersion === SCHEMA_VERSION &&
    typeof parsed.visitId === 'string' && parsed.visitId.length > 0 &&
    parsed.uid === uid && parsed.classId === classId && parsed.listId === listId &&
    parsed.day === day && parsed.resetEpoch === resetEpoch
  if (!ok) {
    // Stale/corrupt/foreign — discarded rather than used. Self-heals so a
    // corrupt entry does not linger and cost a JSON.parse on every read.
    try { store.removeItem(scope) } catch { /* best effort self-heal */ }
    return null
  }
  return parsed
}

function writeVisit(scope, store, { visitId, uid, classId, listId, day, resetEpoch }) {
  const envelope = {
    schemaVersion: SCHEMA_VERSION, visitId, uid, classId, listId, day, resetEpoch,
    mintedAt: Date.now(),
  }
  try { store.setItem(scope, JSON.stringify(envelope)) } catch { /* degraded: next read just misses and re-mints */ }
}

// ---------------------------------------------------------------------------
// Read-only accessor — NEVER mints. A "browse" caller (e.g. rendering the
// past-day list) must be able to ask "is a visit already open here?" without
// side effects.
// ---------------------------------------------------------------------------

/** The currently-stored visitId for this scope, or null. Pure read — never
 *  mints, never touches the network. Corrupt/stale/foreign values return null
 *  (and are dropped from storage as a side effect of validating them). */
export function peekVisitId({ uid, classId, listId, day, resetEpoch }, { storage } = {}) {
  const store = storage ?? defaultStorage()
  const scope = visitScopeKey({ uid, classId, listId, day, resetEpoch })
  const env = readStoredEnvelope(scope, store, { uid, classId, listId, day, resetEpoch })
  return env ? env.visitId : null
}

// ---------------------------------------------------------------------------
// Discard — the raw primitive, and the two named/fixtured triggers
// ---------------------------------------------------------------------------

/** Unconditionally forget the stored visit (idempotent on an already-empty
 *  scope). Exported for a caller with its own reason to discard; the two
 *  named triggers below are the documented, fixtured ones. Tolerant of a
 *  malformed handle by design (mirrors `discardComposeKey` — a discard is a
 *  safe no-op either way, so it does not need the fail-loud gate a network
 *  call or a guard decision does). */
export function discardVisit({ uid, classId, listId, day, resetEpoch }, { storage } = {}) {
  const store = storage ?? defaultStorage()
  const scope = visitScopeKey({ uid, classId, listId, day, resetEpoch })
  try { store.removeItem(scope) } catch { /* nothing to do */ }
}

/** True when this scope has already consumed its ONE automatic re-mint. */
export function visitRemintUsed(scope, { storage } = {}) {
  const store = storage ?? defaultStorage()
  try { return store.getItem(scope) === '1' } catch { return false }
}

/** Consume the scope's one automatic re-mint — set BEFORE re-minting. */
export function markVisitRemintUsed(scope, { storage } = {}) {
  const store = storage ?? defaultStorage()
  try { store.setItem(scope, '1') } catch { /* memory-only degraded mode */ }
}

/** Clear the guard — a LATER, independent confirmed-good signal only (never
 *  the remedial re-mint's own success — see the header + V6 in the ledger). */
export function clearVisitRemintGuard(scope, { storage } = {}) {
  const store = storage ?? defaultStorage()
  try { store.removeItem(scope) } catch { /* nothing to do */ }
}

/** Trigger 1 — "the visit reads completed:true" (decision b). Feed it the
 *  submit response's `visitHalf` verbatim; it discards ONLY when
 *  `completedVisit === true` (a lone `recorded:true` — one half only — is
 *  NOT completion and must not discard the visit the other half still
 *  needs). Also closes any open re-mint incident for this scope (JUDGMENT
 *  CALL — see the report: a visit that reached completion is the strongest
 *  possible "this scope is healthy" signal, so a stale guard must not
 *  outlive it and block a legitimate FUTURE re-completion visit — the same
 *  scope is revisited many times over a list's life, R2-45 overflow display
 *  ">5 pips"). */
export function noteVisitCompleted({ uid, classId, listId, day, resetEpoch }, visitHalf, { storage } = {}) {
  if (!visitHalf || visitHalf.completedVisit !== true) return { discarded: false }
  const store = storage ?? defaultStorage()
  discardVisit({ uid, classId, listId, day, resetEpoch }, { storage: store })
  clearVisitRemintGuard(visitRemintGuardScope({ uid, classId, listId, day, resetEpoch }), { storage: store })
  return { discarded: true }
}

/** Trigger 2 — an explicit leave (the student backs out of the retest flow
 *  before either half lands). Unconditional discard, same guard-clearing as
 *  completion (see above) — a future deliberate re-entry into this scope is
 *  a NEW visit attempt and deserves its own fresh one-shot re-mint budget,
 *  not a stale surrender inherited from an abandoned attempt. */
export function noteVisitLeft({ uid, classId, listId, day, resetEpoch }, { storage } = {}) {
  const store = storage ?? defaultStorage()
  discardVisit({ uid, classId, listId, day, resetEpoch }, { storage: store })
  clearVisitRemintGuard(visitRemintGuardScope({ uid, classId, listId, day, resetEpoch }), { storage: store })
}

// ---------------------------------------------------------------------------
// Refusal copy — this register's own (mirrors reviewV2Submit.js's
// separation: shared statuses reuse reviewV2Compose.js's REFUSAL_REASONS;
// VISIT_INVALID has no entry there, so it gets its own line here).
// ---------------------------------------------------------------------------

const SHARED_REASON_STATUSES = new Set([
  RV2.RESET_IN_PROGRESS, RV2.RESET_EPOCH_MISMATCH, RV2.DAY_GUARD_REJECTED, RV2.CLIENT_VERSION_STALE,
])

const REASON_VISIT_INVALID =
  '재응시 정보가 올바르지 않습니다. 페이지를 새로고침해 주세요. ' +
  '(This retest ticket is invalid — please reload the page.)'

const REASON_VISIT_SURRENDERED =
  '재응시를 준비하지 못했습니다. 페이지를 새로고침한 뒤에도 반복되면 선생님께 알려 주세요. ' +
  '(We could not prepare this retest — reload the page, and tell your teacher if it repeats.)'

const GENERIC_VISIT_REASON =
  '지금은 재응시를 시작할 수 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요. ' +
  "(This retest can't start right now — reload the page and try again.)"

function visitRefusalReason(status) {
  if (SHARED_REASON_STATUSES.has(status)) return refusalReasonText(status)
  if (status === RV2.VISIT_INVALID) return REASON_VISIT_INVALID
  return GENERIC_VISIT_REASON
}

// ---------------------------------------------------------------------------
// The mint entrypoint — "lazily at the FIRST rerun compose"
// ---------------------------------------------------------------------------

/** One remedial/initial mint attempt against the network (or `deps.mintVisitFn`
 *  fake) — shared by `getOrMintVisit` (first mint) and `remintVisitOnRefusal`
 *  (the one-shot repair). */
async function mintFresh({ uid, classId, listId, day, resetEpoch }, scope, store, deps) {
  const mintFn = deps.mintVisitFn ?? mintVisit
  let result
  try {
    result = await mintFn({ classId, listId, day })
  } catch (err) {
    if (classifyThrownRefusal(err) === 'legacy') {
      // The thrown trio (class_not_found/not_enrolled/list_not_assigned):
      // restudy is a review-v2-ONLY feature (no legacy restudy path exists),
      // so this is reported as 'unavailable', not 'legacy' — a deliberate
      // rename from the compose/submit vocabulary (see the report).
      return { outcome: 'unavailable', via: 'error', code: err?.code ?? null }
    }
    return { outcome: 'blocked', status: 'error', code: err?.code ?? null, reason: GENERIC_VISIT_REASON }
  }
  if (result?.status === RV2.VISIT_MINTED && typeof result.visitId === 'string' && result.visitId.length > 0) {
    writeVisit(scope, store, { visitId: result.visitId, uid, classId, listId, day, resetEpoch })
    return { outcome: 'minted', visitId: result.visitId }
  }
  // Not-serving, DATA channel: config_hold/review_v2_dark are the two
  // reachable from a well-formed preflight; the other three NOT_SERVING
  // statuses can ALSO arrive as data here on the in-txn re-check race
  // (ledger V7 finding) — `isNotServing` unions all five regardless of
  // channel, so this branch already covers it.
  if (isNotServing(result)) {
    return { outcome: 'unavailable', via: 'status', status: result.status }
  }
  const status = typeof result?.status === 'string' ? result.status : 'malformed_response'
  return { outcome: 'blocked', status, reason: visitRefusalReason(status) }
}

/**
 * Read the cached visit for this scope, or mint one — THE lazy-mint
 * entrypoint (decision b). Call this ONLY at the moment a rerun compose is
 * about to happen; a mere "browse" render must use `peekVisitId` instead so
 * it never mints.
 *
 * @returns {Promise<object>} one of:
 *   {outcome:'cached', visitId}           — a valid visit was already stored
 *   {outcome:'minted', visitId}           — freshly minted and stored
 *   {outcome:'unavailable', via, status?|code?} — the engine is not serving
 *     this student right now (restudy has no legacy fallback to use instead)
 *   {outcome:'blocked', status, reason}   — render `reason`; do not retry
 *     automatically (that budget is `remintVisitOnRefusal`'s, and only for a
 *     visit-invalidating refusal on an ALREADY-minted visit)
 */
export async function getOrMintVisit({ uid, classId, listId, day, resetEpoch }, deps = {}) {
  if (!isValidArgs({ uid, classId, listId, day, resetEpoch })) {
    return { outcome: 'blocked', status: 'malformed_request', reason: GENERIC_VISIT_REASON }
  }
  const store = deps.storage ?? defaultStorage()
  const scope = visitScopeKey({ uid, classId, listId, day, resetEpoch })
  const cached = readStoredEnvelope(scope, store, { uid, classId, listId, day, resetEpoch })
  if (cached) return { outcome: 'cached', visitId: cached.visitId }
  return mintFresh({ uid, classId, listId, day, resetEpoch }, scope, store, deps)
}

// ---------------------------------------------------------------------------
// Re-mint exactly once on a refusal that means THIS visit is bad
// ---------------------------------------------------------------------------

const VISIT_INVALIDATING_STATUSES = new Set([
  RV2.VISIT_INVALID, RV2.RESET_EPOCH_MISMATCH, RV2.RESET_IN_PROGRESS,
])

/** decision (b): "on any visit_invalid / reset_epoch_mismatch /
 *  reset_in_progress refusal" — the three statuses that mean THIS STORED
 *  visit is bad (as opposed to "the engine/day itself is refusing", a
 *  different family that must not spend the one-shot re-mint budget). */
export function isVisitInvalidatingStatus(status) {
  return VISIT_INVALIDATING_STATUSES.has(status)
}

/**
 * Re-mint exactly once on a refusal that means the CURRENTLY-STORED visit is
 * bad — mirrors `submitAttemptV2`'s `grade_unusable` branch: mark the guard
 * BEFORE acting (fail-closed across a crash), attempt ONE remedial mint, and
 * surrender to a rendered reason on the SECOND such refusal — never loop.
 * Call this from wherever a rerun compose/submit (51-d) observes
 * `refusalStatus` against an already-minted visit.
 *
 * @returns {Promise<object>} one of:
 *   {outcome:'ignored', status}         — refusalStatus isn't visit-invalidating;
 *     nothing touched (the caller routed a different refusal family here)
 *   {outcome:'reminted', visitId}       — the one-shot repair succeeded
 *   {outcome:'surrendered', status, reason} — the budget was already spent;
 *     render `reason`, never mint again for this scope until it is
 *     discarded (completed/left) or the resetEpoch changes
 *   {outcome:'unavailable'|'blocked', ...} — the repair mint ITSELF refused
 *     (guard stays set; see mintFresh)
 */
export async function remintVisitOnRefusal({ uid, classId, listId, day, resetEpoch, refusalStatus }, deps = {}) {
  if (!isValidArgs({ uid, classId, listId, day, resetEpoch })) {
    return { outcome: 'blocked', status: 'malformed_request', reason: GENERIC_VISIT_REASON }
  }
  if (!isVisitInvalidatingStatus(refusalStatus)) {
    return { outcome: 'ignored', status: refusalStatus ?? null }
  }
  const store = deps.storage ?? defaultStorage()
  const scope = visitScopeKey({ uid, classId, listId, day, resetEpoch })
  const guardScope = visitRemintGuardScope({ uid, classId, listId, day, resetEpoch })
  // The stored visit is now known-bad regardless of guard state — never hand
  // it out again.
  discardVisit({ uid, classId, listId, day, resetEpoch }, { storage: store })
  if (visitRemintUsed(guardScope, { storage: store })) {
    return { outcome: 'surrendered', status: refusalStatus, reason: REASON_VISIT_SURRENDERED }
  }
  markVisitRemintUsed(guardScope, { storage: store }) // BEFORE minting — fail-closed
  const result = await mintFresh({ uid, classId, listId, day, resetEpoch }, scope, store, deps)
  if (result.outcome === 'minted') return { outcome: 'reminted', visitId: result.visitId }
  return result
}
