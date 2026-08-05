/**
 * ============================================================================
 * PAST-DAY AUTHORITY (DF2-51-a) — the pure past-day-browser derivation
 * ============================================================================
 * Fold 1 of 8 in the DF2-51 train (`docs/plans/deepfix2/22_DF2-51_PASTDAY_NAV_
 * DESIGN.md` §7 RATIFIED). Everything the past-day browser (51-c), the visit
 * lifecycle (51-b), and the retest launch (51-d) need to know about "what does
 * day N of this list currently look like" is derived HERE, once — the same
 * "one authority, not two divergent inline expressions" discipline
 * `dayStatusAuthority.js`'s header names as the df2-33 fix. NOTHING calls this
 * module yet (fold 1 of 8): it ships no user-visible change and needs no flag
 * gate, because there is no call site to gate (22_ §7 row (e); this fold's own
 * ledger states this plainly rather than claiming a flag-off parity check that
 * was never run).
 *
 * PURE — zero imports (no React, no Firestore, no `../firebase.js`, not even a
 * sibling `src/utils/*` module), node-loadable, exactly like
 * `streakAuthority.js` and `dayStatusAuthority.js` (whose own headers explain
 * why: a Vite-only import cannot load under plain node, and this module is
 * exercised directly by `scripts/deepfix2/df2-51a-model-fixtures.mjs` with
 * plain `node` — no emulator, no Vite, no browser). Every input is injected;
 * this module fetches nothing and writes nothing.
 *
 * THE ENGINE VOCABULARY THIS MIRRORS (so past-day state matches SERVER truth
 * instead of inventing a parallel one — every cite re-verified 2026-08-05,
 * this fold's ledger GROUP V):
 *   - `functions/reviewV2/visits.js` `recordRerunHalfInTxn` (:92-130): a
 *     rerun HALF sets ONE field on ONE visit doc (set-once); `completed:true`
 *     flips only when BOTH fields land on the SAME doc, in the SAME txn (the
 *     CAS, :112-117) — "cross-visit pairing is impossible by construction"
 *     (file header, :13-14). PIP-CANON below exists to keep the CLIENT'S
 *     display honoring that same impossibility (finding F4).
 *   - `functions/reviewV2/callables.js` `reviewV2ComposeRerun` (:404-486): the
 *     REVIEW half draws from the full introduced range, day-agnostic (:434-
 *     446, F2) — so `pips.review` below is NEVER `'na'`. The NEW half needs
 *     the visited day's own passed-new anchor (:447-458) and refuses
 *     (`no_evidence`/`empty_pool`) when the day never introduced words (F3) —
 *     mirrored below as `hasNewHalf`. The retest stamp `type:"retest"` is
 *     written at :769.
 *   - `functions/reviewV2/completion.js` (:323, :455): a `type:"retest"`
 *     attempt can NEVER satisfy either half of the day advance (`no_evidence`)
 *     — so a rerun attempt is never "the day's original completion".
 *     `originalAttemptsForDay` below excludes `type:"retest"` for exactly
 *     this reason (see its own doc comment for why the exclusion is
 *     load-bearing, not decorative).
 *   - `functions/foundation.js` `getDayNewPass`/`deriveDayAnchorRange`
 *     (:819-839, :996-1007): THE server's own definition of "does day N have
 *     a new-word half" is "a PASSED `sessionType:'new'` attempt exists for
 *     that `studyDay`" (:824,:831). `hasNewHalf` below is the exact same
 *     predicate, computed over the injected `attempts`.
 *   - `docs/plans/deepfix2/15_H6_SCHEMAS_AND_CONTRACTS.md:196`: the restudy
 *     bookmark is a SCALAR — `restudyBookmarks.{classId}_{listId} = day` (AT
 *     MOST one bookmarked day per list, not a per-day map). `bookmarkedDayFor
 *     List` below extracts that scalar; `derivePastDays`'s own `bookmarks`
 *     parameter (name fixed by the brief) IS that already-resolved scalar,
 *     not the raw map — see that function's doc comment.
 *   - `functions/reviewV2/reset.js` (:24, :54-55): a reset deletes STALE-EPOCH
 *     `restudy_visits`/`restudy_completions` docs, but that cleanup is
 *     async/best-effort, not a transactional read-time guarantee. This module
 *     has NO `resetEpoch` parameter (the brief's prescribed `derivePastDays`
 *     signature does not carry one) — epoch-correctness of the injected
 *     `attempts`/`visits` is the CALLER's responsibility. Documented, not
 *     silently assumed (see the fold report for this judgment call).
 *
 * THE FIVE STATES + PRECEDENCE (`DAY_STATES`, `deriveDayState`). Untouched →
 * studied → tested → re-completed is a RESTUDY-PROGRESS ladder — it is NOT
 * about the day's ORIGINAL (live) completion, which is already guaranteed for
 * every row this module emits (day 1..currentStudyDay can only exist because
 * it already advanced past). `studiedAt`/`testedAt` on the row carry that
 * original-completion metadata; `state` carries the RESTUDY ladder, derived
 * solely from `visits` (+ `bookmarked`) — never from `studiedAt`/`testedAt`.
 * Precedence: BOOKMARKED, when set, displaces the progress chip entirely
 * (wireframe Day 5: pips still show the underlying progress, only the CHIP
 * changes) — `deriveDayState` checks it FIRST and returns early. Below that,
 * highest-to-lowest: `re-completed` (some visit for the day has
 * `completed:true`) → `tested` (some evidence of a passed half, see PIP-CANON)
 * → `studied` (a visit exists for the day but no half is recorded on the
 * canonical one) → `untouched` (no visit at all). A day that can never reach
 * `re-completed` (F3/F4: no new-word half exists at all) is NOT a bug and is
 * NOT rendered as perpetually incomplete — it simply tops out at `tested`,
 * same as any day whose new half is merely not-yet-retested; the DASHED pip
 * (below) is what tells the student why, not the state/chip.
 *
 * PIP-CANON — the rule that keeps pips honest about F4. With no completed
 * visit for the day, pips reflect the SINGLE MOST RECENTLY CREATED visit only
 * — never an OR-aggregate of "was this half EVER recorded, in ANY visit for
 * this day". An OR-aggregate would let two abandoned, differently-halved
 * visits (review half passed in visit A, new half passed in a LATER visit B,
 * neither ever paired) light BOTH pips — visually indistinguishable from a
 * real re-completion even though `visits.js`'s CAS never flipped `completed`
 * for either doc. That is exactly the false signal finding F4 warns about, so
 * this module refuses to manufacture it: at most ONE visit's evidence is ever
 * shown until a real pairing (`completed:true`) exists, at which point EVERY
 * completed visit already carries both fields by construction and recency no
 * longer matters (a genuine re-completion is found regardless of whether a
 * newer, still-in-progress "just for practice" visit also exists — see
 * `summarizeDayVisits`).
 *
 * PIPS (`derivePips`, `PIP_STATES`). `review` is a 2-state pip (`on`/`off`) —
 * NEVER `na`, because the rerun review pool is day-agnostic (F2). `new` is a
 * 3-state pip: `on` (recorded on the canonical visit) → `off` (the day HAS a
 * new-word half, per `hasNewHalf`, just not yet retested) → `na` (the day
 * never had one — F3). Recorded evidence always outranks the `hasNewHalf`
 * default, so a (structurally-impossible-via-the-real-engine, but not
 * type-impossible-via-this-pure-function's-inputs) contradiction — a
 * completed visit whose OWN `newHalfAttemptId` is set despite `hasNewHalf`
 * reading false — still degrades to `'on'`, never a silently-wrong `'na'`.
 *
 * THE `type:"retest"` EXCLUSION. `originalAttemptsForDay` drops any attempt
 * carrying `type === 'retest'` before this module ever looks at
 * `sessionType`/`passed`/`submittedAt` — ABSENCE OF `type` READS AS LIVE
 * (mirrors the documented convention in `functions/aiMetering.js`'s header:
 * "undefined, null ... are all LIVE"). Without this, a LATER passing rerun
 * for the same (day, sessionType) could masquerade as the day's ORIGINAL
 * completion and corrupt `studiedAt`/`testedAt`/`hasNewHalf` with a retest's
 * date — fixtured explicitly (case C-RETEST-NOT-ORIGINAL).
 *
 * `canRetestTyped` — PRESENTATION ONLY, NEVER THE ENFORCEMENT POINT. The
 * spend cap is server-authoritative (`functions/aiMetering.js`, landed
 * d3dce7a — `decideMetering`, `practiceLimitRefusal`). Students cannot read
 * `ai_metering/*` themselves (teacher-gated read, `firestore.rules` per that
 * module's header) — there is no live "remaining count" this predicate can
 * consult. It exists ONLY so a caller who already learned about a refusal
 * (from a submit's `practice_limit_reached` response, decision (h)) can avoid
 * re-offering typed retests for the REST of that same KST window without
 * re-asking the server — and it must fail toward SHOWING the button, not
 * hiding it, whenever it lacks enough information to be sure (see its own
 * doc comment). The exact refusal STRING/shape is intentionally NOT imported
 * or re-declared here (that would duplicate a source of truth this program
 * has repeatedly found drifts) — the caller (51-d) translates the server's
 * `practice_limit_reached` response into the small `{refused, scope,
 * windowKey}` snapshot this predicate reads.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// time normalization — Firestore-Timestamp-tolerant epoch-ms extractor.
// Mirrors the established codebase idiom (`src/utils/reviewPairing.js`'s
// `tsMillis`, `src/utils/studyAlgorithm.js:301-302/375`, `src/services/db.js`)
// WITHOUT importing it — this module's convention (set by streakAuthority.js
// / dayStatusAuthority.js) is ZERO imports of anything, not just Firestore/
// React, so the idiom is reproduced locally rather than shared. Kept PRIVATE
// (not exported): the public surface below stays domain-shaped; this helper
// is exercised indirectly through the visit/attempt fixtures that feed it
// mixed `createdAt`/`submittedAt` shapes (numbers, ISO strings, `Date`s, and
// Firestore-Timestamp-like stand-ins). Never throws; unparseable/absent input
// sorts as the oldest possible value.
// ---------------------------------------------------------------------------
function toMillis(t) {
  if (t == null) return -Infinity
  if (typeof t === 'number') return Number.isFinite(t) ? t : -Infinity
  if (typeof t === 'string') {
    const ms = Date.parse(t)
    return Number.isFinite(ms) ? ms : -Infinity
  }
  if (t instanceof Date) return t.getTime()
  if (typeof t.toMillis === 'function') return t.toMillis()
  if (typeof t.toDate === 'function') {
    const d = t.toDate()
    return d instanceof Date ? d.getTime() : -Infinity
  }
  return -Infinity
}

// ---------------------------------------------------------------------------
// THE FIVE STATES + THE PIP STATES — documented, frozen enums.
// ---------------------------------------------------------------------------

/** The five per-day progress states (module header). Frozen so a typo'd
 *  literal fails loudly at the call site rather than silently rendering an
 *  unstyled chip. */
export const DAY_STATES = Object.freeze({
  UNTOUCHED: 'untouched',
  STUDIED: 'studied',
  TESTED: 'tested',
  RE_COMPLETED: 're-completed',
  BOOKMARKED: 'bookmarked',
})

/** The three pip states. `NOT_APPLICABLE` is F3's dashed pip — see the
 *  module header's PIPS section for exactly which pip may/may not use it. */
export const PIP_STATES = Object.freeze({
  ON: 'on',
  OFF: 'off',
  NOT_APPLICABLE: 'na',
})

// ---------------------------------------------------------------------------
// ATTEMPTS-SIDE — the day's ORIGINAL (live) completion evidence.
// ---------------------------------------------------------------------------

/**
 * True for a LIVE (non-retest) attempt. ABSENCE OF `type` READS AS LIVE —
 * mirrors `functions/aiMetering.js`'s documented convention in spirit
 * ("undefined, null, ... are all LIVE"). See module header.
 * @param {{type?: string}|null|undefined} a
 * @returns {boolean}
 */
export function isLiveAttempt(a) {
  return Boolean(a) && a.type !== 'retest'
}

/**
 * The day's ORIGINAL (non-retest) attempts — every later derivation in this
 * module reads `studyDay`/`sessionType`/`passed`/`submittedAt` ONLY through
 * this filter, never off the raw `attempts` array directly (module header,
 * "THE `type:\"retest\"` EXCLUSION").
 * @param {Array|null|undefined} attempts
 * @param {number} day
 * @returns {Array} attempts belonging to exactly this `studyDay`, live only.
 */
export function originalAttemptsForDay(attempts, day) {
  return (Array.isArray(attempts) ? attempts : [])
    .filter((a) => a && a.studyDay === day && isLiveAttempt(a))
}

/**
 * The day's canonical PASSED original attempt of one `sessionType` — the
 * server can only have advanced the day past a required half by a PASSED
 * attempt (mirrors `foundation.js#getDayNewPass`'s own `passed === true`
 * filter, :831), so an unpassed attempt is never a candidate. Ties (multiple
 * passes of the same type/day — unusual; a LIVE test cannot normally recur
 * once a day is no longer the frontier, `callables.js:707-712`) resolve to
 * the EARLIEST submission — "when this day was completed" is read as a fixed
 * historical fact, not whichever attempt happens to sort last.
 * @param {Array} dayAttempts - already day-scoped + live-only (see above)
 * @param {'new'|'review'} sessionType
 * @returns {object|null} the attempt, or null when the day has no passed
 *   original attempt of this type (for `sessionType:'new'`, this IS finding
 *   F3 — "day has no new-word half").
 */
export function bestOriginalPass(dayAttempts, sessionType) {
  const passes = (Array.isArray(dayAttempts) ? dayAttempts : [])
    .filter((a) => a && a.sessionType === sessionType && a.passed === true)
  if (passes.length === 0) return null
  return passes.slice().sort((a, b) => toMillis(a.submittedAt) - toMillis(b.submittedAt))[0]
}

// ---------------------------------------------------------------------------
// VISITS-SIDE — the day's RESTUDY (rerun) progress evidence.
// ---------------------------------------------------------------------------

/**
 * The day's restudy visits. Scoping to class/list/resetEpoch is the CALLER's
 * job (module header) — this only narrows by `day`.
 * @param {Array|null|undefined} visits
 * @param {number} day
 * @returns {Array}
 */
export function visitsForDay(visits, day) {
  return (Array.isArray(visits) ? visits : []).filter((v) => v && v.day === day)
}

/**
 * Summarize one day's visits into the evidence `deriveDayState`/`derivePips`
 * consume. See the module header's PIP-CANON for why this is NOT a simple
 * OR-aggregate across every visit.
 * @param {Array} dayVisits - already day-scoped (see `visitsForDay`)
 * @returns {{hasAnyVisit: boolean, hasCompletedVisit: boolean,
 *   reviewRecorded: boolean, newRecorded: boolean}}
 */
export function summarizeDayVisits(dayVisits) {
  const list = Array.isArray(dayVisits) ? dayVisits : []
  if (list.length === 0) {
    return { hasAnyVisit: false, hasCompletedVisit: false, reviewRecorded: false, newRecorded: false }
  }
  // A REAL re-completion, once earned, is found regardless of recency — even
  // if a newer "just for practice" visit for the same day also exists.
  const completed = list.find((v) => v && v.completed === true)
  if (completed) {
    return {
      hasAnyVisit: true,
      hasCompletedVisit: true,
      reviewRecorded: completed.reviewHalfAttemptId != null,
      newRecorded: completed.newHalfAttemptId != null,
    }
  }
  // No completed visit: PIP-CANON — the single MOST RECENTLY CREATED visit is
  // canonical for partial-progress display; ties (equal/missing timestamps)
  // keep the EARLIEST-encountered of the tied visits (a deterministic, if
  // arbitrary, tiebreak — real server `createdAt`s cannot collide in
  // practice, so this only matters for synthetic/malformed input).
  let canonical = null
  let canonicalMs = -Infinity
  for (const v of list) {
    if (!v) continue
    const ms = toMillis(v.createdAt)
    if (canonical === null || ms > canonicalMs) { canonical = v; canonicalMs = ms }
  }
  return {
    hasAnyVisit: true,
    hasCompletedVisit: false,
    reviewRecorded: canonical ? canonical.reviewHalfAttemptId != null : false,
    newRecorded: canonical ? canonical.newHalfAttemptId != null : false,
  }
}

// ---------------------------------------------------------------------------
// BOOKMARK — the H6 scalar (schema :196), not a per-day map.
// ---------------------------------------------------------------------------

/**
 * Resolve the raw `users/{uid}.restudyBookmarks` field down to the single
 * bookmarked day (or `null`) for ONE class+list — mirrors
 * `dayStatusAuthority.js#attemptsForList`'s purpose (a small per-list
 * extraction helper the caller runs BEFORE calling the main deriver). The
 * schema (`15_H6_SCHEMAS_AND_CONTRACTS.md:196`) allows AT MOST one
 * bookmarked day per (classId,listId) — this is not a per-day flag map.
 * @param {Record<string, number>|null|undefined} restudyBookmarks - the raw
 *   `restudyBookmarks` map field, keyed `{classId}_{listId}`.
 * @param {string} classId
 * @param {string} listId
 * @returns {number|null} the bookmarked day, or null (no bookmark / bad input).
 */
export function bookmarkedDayForList(restudyBookmarks, classId, listId) {
  if (!restudyBookmarks || typeof restudyBookmarks !== 'object') return null
  if (typeof classId !== 'string' || classId.length === 0) return null
  if (typeof listId !== 'string' || listId.length === 0) return null
  const raw = restudyBookmarks[`${classId}_${listId}`]
  return Number.isInteger(raw) && raw > 0 ? raw : null
}

// ---------------------------------------------------------------------------
// THE STATE — one derivation function (module header: precedence).
// ---------------------------------------------------------------------------

/**
 * THE single derivation for the five-way day state. Inputs: the
 * `summarizeDayVisits` evidence (`hasAnyVisit`/`hasCompletedVisit`/
 * `reviewRecorded`/`newRecorded` — the last two consulted only via their
 * disjunction, for the `tested` tier) plus `bookmarked`. Never consults
 * `studiedAt`/`testedAt`/`hasNewHalf` — the state is a RESTUDY ladder, not a
 * reflection of the day's original (already-guaranteed) completion.
 * @param {{hasAnyVisit?: boolean, hasCompletedVisit?: boolean,
 *   reviewRecorded?: boolean, newRecorded?: boolean, bookmarked?: boolean}} args
 * @returns {string} one of `DAY_STATES`
 */
export function deriveDayState({ hasAnyVisit, hasCompletedVisit, reviewRecorded, newRecorded, bookmarked } = {}) {
  // PRECEDENCE: bookmark displaces the progress chip (wireframe Day 5) —
  // pips are unaffected (see derivePips) — checked FIRST, returns early.
  if (bookmarked) return DAY_STATES.BOOKMARKED
  if (hasCompletedVisit) return DAY_STATES.RE_COMPLETED
  if (reviewRecorded || newRecorded) return DAY_STATES.TESTED
  if (hasAnyVisit) return DAY_STATES.STUDIED
  return DAY_STATES.UNTOUCHED
}

// ---------------------------------------------------------------------------
// PIPS — the per-day progress dots (module header: PIP-CANON + the F3 rule).
// ---------------------------------------------------------------------------

/**
 * The two pips. `review` never reads `na` (F2 — the review half is
 * day-agnostic, always retestable for any real past day). `new` reads `na`
 * ONLY as a fallback when there is neither recorded evidence NOR an
 * available new-word half — recorded evidence always outranks the
 * `hasNewHalf` default (module header, PIPS).
 * @param {{hasNewHalf: boolean, reviewRecorded: boolean, newRecorded: boolean}} args
 * @returns {{review: string, new: string}} values from `PIP_STATES`
 */
export function derivePips({ hasNewHalf, reviewRecorded, newRecorded } = {}) {
  return {
    review: reviewRecorded ? PIP_STATES.ON : PIP_STATES.OFF,
    new: newRecorded ? PIP_STATES.ON : (hasNewHalf ? PIP_STATES.OFF : PIP_STATES.NOT_APPLICABLE),
  }
}

// ---------------------------------------------------------------------------
// THE ROW + THE LIST.
// ---------------------------------------------------------------------------

/**
 * One day's full row — composes every derivation above for a single `day`.
 * Exposed independently of `derivePastDays` so a caller (or a fixture) can
 * exercise one day without building a whole `1..csd` range.
 * @param {{day: number, attempts: Array|null|undefined,
 *   visits: Array|null|undefined, bookmarkedDay: number|null|undefined}} args
 *   `bookmarkedDay` is the ALREADY-RESOLVED scalar (see `bookmarkedDayForList`),
 *   not the raw `restudyBookmarks` map.
 * @returns {{day: number, studiedAt: *, testedAt: *, state: string,
 *   pips: {review: string, new: string}, bookmarked: boolean,
 *   canRestudy: boolean, canRetest: boolean, hasNewHalf: boolean}}
 */
export function deriveDayRow({ day, attempts, visits, bookmarkedDay } = {}) {
  const dayAttempts = originalAttemptsForDay(attempts, day)
  const studiedAttempt = bestOriginalPass(dayAttempts, 'new')
  const testedAttempt = bestOriginalPass(dayAttempts, 'review')
  const hasNewHalf = studiedAttempt !== null

  const dayVisits = visitsForDay(visits, day)
  const ev = summarizeDayVisits(dayVisits)
  const bookmarked = Number.isInteger(bookmarkedDay) && bookmarkedDay === day

  return {
    day,
    studiedAt: studiedAttempt ? (studiedAttempt.submittedAt ?? null) : null,
    testedAt: testedAttempt ? (testedAttempt.submittedAt ?? null) : null,
    state: deriveDayState({ ...ev, bookmarked }),
    pips: derivePips({ hasNewHalf, reviewRecorded: ev.reviewRecorded, newRecorded: ev.newRecorded }),
    bookmarked,
    // F3: nothing day-specific to re-study via flashcards without a new-word
    // anchor for this day (module header).
    canRestudy: hasNewHalf,
    // F2: the review half is ALWAYS retestable for any real past day,
    // independent of `hasNewHalf` — the retest launcher (51-d) offers
    // per-half using `hasNewHalf`; this row-level flag only gates whether
    // the "Re-test" affordance appears AT ALL (wireframe Day 4 still shows
    // it). This module has no input that could ever make it false for a row
    // it emits (see the fold report for this judgment call).
    canRetest: true,
    hasNewHalf,
  }
}

/**
 * THE past-day list — one row per completed day, `1..currentStudyDay`
 * (inclusive), never a phantom `currentStudyDay + 1` row (module header;
 * mirrors the `displayDay` discipline `dayStatusAuthority.js` names — the
 * "phantom chapter" R2-40(b) forbids). TODAY IS NOT A PAST DAY — the
 * day-guard means restudy targets `1..csd` only (`visits.js:64-66`,
 * `day_guard_rejected`); this function never emits a row for
 * `currentStudyDay + 1`. Use `deriveTodayRow` separately for that row (the
 * brief's "if you emit it at all" — kept as a DELIBERATELY SEPARATE, tiny
 * function so this function's own contract stays exactly "day 1..csd,
 * nothing else" — see the fold report for this judgment call).
 * @param {{currentStudyDay: number|null|undefined,
 *   attempts: Array|null|undefined, visits: Array|null|undefined,
 *   bookmarks: number|null|undefined}} args `bookmarks` is the ALREADY-
 *   RESOLVED single bookmarked day for this list (see `bookmarkedDayForList`
 *   — module header, BOOKMARK), matching the H6 scalar schema; not a raw map.
 * @returns {Array} day rows, see `deriveDayRow`.
 */
export function derivePastDays({ currentStudyDay, attempts, visits, bookmarks } = {}) {
  const csd = Number.isInteger(currentStudyDay) && currentStudyDay > 0 ? currentStudyDay : 0
  const safeAttempts = Array.isArray(attempts) ? attempts : []
  const safeVisits = Array.isArray(visits) ? visits : []
  const rows = []
  for (let day = 1; day <= csd; day++) {
    rows.push(deriveDayRow({ day, attempts: safeAttempts, visits: safeVisits, bookmarkedDay: bookmarks }))
  }
  return rows
}

/**
 * The explicit, non-actionable "today" row (wireframe §2's last row, "Day 6
 * … Today … In progress") — day `currentStudyDay + 1`, deliberately SEPARATE
 * from `derivePastDays` (see that function's doc comment). A caller wanting
 * the wireframe's combined list composes `[...derivePastDays(x),
 * deriveTodayRow(x)]` itself.
 * @param {{currentStudyDay: number|null|undefined}} args
 * @returns {{day: number, studiedAt: null, testedAt: null, state: null,
 *   pips: null, bookmarked: false, canRestudy: false, canRetest: false,
 *   hasNewHalf: null, today: true}}
 */
export function deriveTodayRow({ currentStudyDay } = {}) {
  const csd = Number.isInteger(currentStudyDay) && currentStudyDay >= 0 ? currentStudyDay : 0
  return {
    day: csd + 1,
    studiedAt: null,
    testedAt: null,
    state: null,
    pips: null,
    bookmarked: false,
    canRestudy: false,
    canRetest: false,
    hasNewHalf: null,
    today: true,
  }
}

// ---------------------------------------------------------------------------
// THE TYPED-RETEST CAP PREDICATE — presentation only (module header).
// ---------------------------------------------------------------------------

/**
 * Is a typed re-test currently offerable, given what the UI already knows
 * about a PRIOR server refusal? PRESENTATION ONLY — see the module header;
 * this function must NEVER be treated as the enforcement point, and it fails
 * TOWARD OFFERING typed whenever it lacks enough information to be sure
 * (never hides the button on a guess).
 *
 * `metering: {refused: true, scope, windowKey}` records the LAST server
 * refusal the caller observed (`practice_limit_reached`, decision (h)) and
 * the KST window it was learned in — the caller stamps `windowKey` itself
 * (e.g. the SAME `kstDateString` formula `streakAuthority.js` mirrors from
 * the server) at the moment it receives the refusal; the server response
 * itself carries no window key (`functions/aiMetering.js#practiceLimitRefusal`
 * returns only `{status, scope, message}`).
 * @param {{metering?: {refused?: boolean, scope?: string,
 *   windowKey?: string}|null, currentWindowKey?: string}} args
 * @returns {boolean} true = offer typed; false = MCQ only.
 */
export function canRetestTyped({ metering, currentWindowKey } = {}) {
  if (!metering || metering.refused !== true) return true
  // The KST window rolled over since the refusal was learned (mirrors
  // `functions/aiMetering.js#counterAt`'s own rollover-by-comparison: "a
  // counter stamped with any other windowStart ... reads as 0"). Only acts
  // when BOTH window keys are known strings — missing information keeps the
  // conservative "still refused" answer rather than guessing it is stale.
  if (typeof currentWindowKey === 'string' && currentWindowKey.length > 0 &&
      typeof metering.windowKey === 'string' && metering.windowKey !== currentWindowKey) {
    return true
  }
  return false
}
