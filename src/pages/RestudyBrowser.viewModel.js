/**
 * ============================================================================
 * RESTUDY BROWSER — VIEW MODEL (DF2-51-c) — presentation adapter, PURE
 * ============================================================================
 * `RestudyBrowser.jsx` (the page, this fold) renders the past-days list at
 * `/restudy/:classId/:listId`. This module holds every piece of that page's
 * logic that CAN be pure — the rows→props assembly, the empty/loading/error
 * branch choice, the bookmark-toggle precedence, and the "today is never
 * actionable" gate — so it can be fixtured with plain `node`
 * (`scripts/deepfix2/df2-51c-browser-fixtures.mjs`), exactly like this
 * program's other pure-derivation modules.
 *
 * WHY A SEPARATE FILE FROM THE .jsx (a judgment call, recorded here and in
 * the fold report): the brief's touch-list names "the new page file"
 * (singular), and the house style for this train is normally "one new
 * module" (51-a, 51-b). This fold needed a second, small one because of a
 * concrete environment fact, verified this session: this checkout's
 * `node_modules` carries the WINDOWS esbuild binary only (`@esbuild/win32-
 * x64`; no `@esbuild/linux-x64`) and no full JSX-emitting Babel plugin is
 * installed (`@babel/plugin-transform-react-jsx` is absent; only the
 * `-jsx-self`/`-jsx-source` dev-helper plugins ride in as `@vitejs/plugin-
 * react`'s own deps). A `.jsx` file cannot be `import`ed by plain Node in
 * this environment AT ALL — not even to reach a non-JSX named export —
 * because Node's parser fails on the FIRST JSX syntax anywhere in the file,
 * before any export is reachable. The brief explicitly asks this fold to
 * fixture "the pure view-model assembly (rows → props), the flag-off gate,
 * the empty/loading/error branch selection, and the bookmark precedence"
 * (fixtures section) — satisfying that literally requires this logic to live
 * somewhere plain `node` can load, so it was extracted here rather than left
 * un-fixtured inside the component. This mirrors the program's own
 * established discipline (`dayStatusAuthority.js`/`streakAuthority.js` exist
 * BECAUSE `Dashboard.jsx` itself cannot be fixtured) — applied one layer
 * lower, to a single new page instead of an existing shared one. Nothing
 * here duplicates `pastDayAuthority.js` (51-a) or `restudyVisit.js` (51-b):
 * every function below consumes THEIR output (a day `state`, a `pips`
 * object, a `bookmarked` day) and maps it to presentation-only values
 * (labels, Badge variants, dot classes, disabled flags) — it never derives a
 * state, a pip, or a visit lifecycle decision itself.
 *
 * PURE — zero imports (no React, no Firestore, no `../firebase.js`, no
 * sibling `src/utils/*`), node-loadable, exercised directly by
 * `scripts/deepfix2/df2-51c-browser-fixtures.mjs`. Every input is injected.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// time normalization — the SAME documented codebase idiom `pastDayAuthority.
// js`'s private (unexported) `toMillis` mirrors from `reviewPairing.js`/
// `studyAlgorithm.js`/`db.js` — reproduced locally rather than imported,
// because (a) it is not exported by `pastDayAuthority.js` and (b) this
// module's own zero-import convention (mirrors 51-a/51-b) means every pure
// module keeps its own copy rather than sharing one. Never throws;
// unparseable/absent input formats as `null` (module degrades safely).
// ---------------------------------------------------------------------------
function toMillis(t) {
  if (t == null) return null
  if (typeof t === 'number') return Number.isFinite(t) ? t : null
  if (typeof t === 'string') {
    const ms = Date.parse(t)
    return Number.isFinite(ms) ? ms : null
  }
  if (t instanceof Date) return t.getTime()
  if (typeof t.toMillis === 'function') return t.toMillis()
  if (typeof t.toDate === 'function') {
    const d = t.toDate()
    return d instanceof Date ? d.getTime() : null
  }
  return null
}

/**
 * Format one timestamp as the wireframe's short date ("Jul 20"), or `null`
 * when there is nothing to format (module header — degrade, never throw).
 * @param {*} t - a Firestore-Timestamp-like value, Date, ISO string, epoch ms
 * @returns {string|null}
 */
export function formatShortDate(t) {
  const ms = toMillis(t)
  if (ms === null) return null
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * "Studied {date} · Tested {date}" (wireframe §2) — either half may be
 * absent (F3: a day can lack a new-word half; a day can lack a review half
 * only on Day 1, `pastDayAuthority.js` V-notes). Never throws; both-absent
 * degrades to an empty string, rendered by the caller as an em dash.
 * @param {{studiedAt?: *, testedAt?: *}} row
 * @returns {string}
 */
export function formatDayDateLabel({ studiedAt, testedAt } = {}) {
  const parts = []
  const studied = formatShortDate(studiedAt)
  const tested = formatShortDate(testedAt)
  if (studied) parts.push(`Studied ${studied}`)
  if (tested) parts.push(`Tested ${tested}`)
  return parts.join(' · ')
}

// ---------------------------------------------------------------------------
// CHIP — DAY_STATES (pastDayAuthority.js) -> {label, symbol, Badge variant}.
// Mirrors the wireframe's status legend (mockups/df2-51-extended.html §2)
// exactly (symbols + labels); `variant` picks one of the EXISTING
// `src/components/ui/Badge.jsx` variants (default/info/warning/success/
// purple) rather than any new color — no raw Tailwind color is introduced by
// this module (it emits variant NAMES, never class strings).
// ---------------------------------------------------------------------------
export const CHIP_CONFIG = Object.freeze({
  untouched: Object.freeze({ label: 'Untouched', symbol: '○', variant: 'default' }),
  studied: Object.freeze({ label: 'Studied', symbol: '◐', variant: 'info' }),
  tested: Object.freeze({ label: 'Tested', symbol: '✓', variant: 'warning' }),
  're-completed': Object.freeze({ label: 'Re-completed', symbol: '✓✓', variant: 'success' }),
  bookmarked: Object.freeze({ label: 'Bookmarked', symbol: '★', variant: 'purple' }),
})

const UNKNOWN_CHIP = Object.freeze({ label: 'Unknown', symbol: '?', variant: 'default' })

/**
 * `DAY_STATES` value -> chip config. An unrecognized state (should never
 * happen against a real `pastDayAuthority.js` row; guarded so a future
 * six-state addition fails VISIBLY as "Unknown" instead of throwing or
 * silently mis-rendering as a real state) -> `UNKNOWN_CHIP`.
 * @param {string|null|undefined} state - one of pastDayAuthority's DAY_STATES
 * @returns {{label: string, symbol: string, variant: string}}
 */
export function dayStateChipConfig(state) {
  return CHIP_CONFIG[state] ?? UNKNOWN_CHIP
}

// ---------------------------------------------------------------------------
// PIPS — PIP_STATES ('on'/'off'/'na') -> a title string per pip kind
// ('review'/'new'). Mirrors the wireframe's pip `title` attributes exactly
// (§2 mockup). `pastDayAuthority.js`'s own header: `review` never reads
// `'na'` (F2 — day-agnostic) — the 'na' label below exists only so an
// out-of-contract value degrades to SOMETHING legible rather than blank.
// ---------------------------------------------------------------------------
export const PIP_TITLES = Object.freeze({
  review: Object.freeze({ on: 'Review half done', off: 'Review half not done', na: 'Review half not applicable' }),
  new: Object.freeze({ on: 'New-word half done', off: 'New-word half not done', na: 'No new-word half exists for this day' }),
})

/**
 * @param {'review'|'new'} kind
 * @param {'on'|'off'|'na'|*} pipState
 * @returns {string}
 */
export function pipTitle(kind, pipState) {
  const labels = PIP_TITLES[kind]
  if (!labels) return ''
  return labels[pipState] ?? labels.off
}

// ---------------------------------------------------------------------------
// "TODAY IS NEVER ACTIONABLE" — the one clause this fold owns that isn't
// already guaranteed by 51-a. `derivePastDays`/`deriveTodayRow` keep today
// structurally SEPARATE (51-a's own header), but nothing stops a future
// caller from concatenating them into one rows array before handing it to a
// generic per-day renderer. This predicate is what the component consults to
// decide "buttons, or the wireframe's muted placeholder" — expressed as a
// pure, fixtured, mutable clause instead of an inline JSX condition, per the
// brief's fixture list ("today rendered as actionable" is the named mutant).
// @param {{today?: boolean}|null|undefined} row
// @returns {boolean} true = show Re-study/Re-test; false = today's
//   non-actionable placeholder row.
// ---------------------------------------------------------------------------
export function isDayActionable(row) {
  return !row?.today
}

// ---------------------------------------------------------------------------
// ROWS -> PROPS — one past-day row (pastDayAuthority#deriveDayRow shape) ->
// exactly what the table row needs to render. Never recomputes `state` or
// `pips` — reads them verbatim off the injected row (module header).
// ---------------------------------------------------------------------------

/**
 * @param {{day: number, studiedAt: *, testedAt: *, state: string,
 *   pips: {review: string, new: string}, bookmarked: boolean,
 *   canRestudy: boolean, canRetest: boolean}} row - one derivePastDays() entry
 * @returns {{day: number, dateLabel: string, chip: {label: string, symbol:
 *   string, variant: string}, pips: {review: {state: string, title: string},
 *   new: {state: string, title: string}}, bookmarked: boolean,
 *   restudyDisabled: boolean, retestDisabled: boolean}}
 */
export function buildDayRowViewModel(row) {
  const r = row || {}
  const pips = r.pips || {}
  return {
    day: r.day,
    dateLabel: formatDayDateLabel(r),
    chip: dayStateChipConfig(r.state),
    pips: {
      review: { state: pips.review, title: pipTitle('review', pips.review) },
      new: { state: pips.new, title: pipTitle('new', pips.new) },
    },
    bookmarked: Boolean(r.bookmarked),
    restudyDisabled: !r.canRestudy,
    retestDisabled: !r.canRetest,
  }
}

/**
 * The full past-days row list -> view models. `pastDays` MUST be
 * `derivePastDays()`'s own output (today excluded by construction there) —
 * this function does not filter `today` rows itself; see `isDayActionable`
 * for the belt-and-braces guard the component ALSO applies per row.
 * @param {{pastDays: Array|null|undefined}} args
 * @returns {Array} view models, see `buildDayRowViewModel`.
 */
export function buildRestudyRows({ pastDays } = {}) {
  return (Array.isArray(pastDays) ? pastDays : []).map(buildDayRowViewModel)
}

// ---------------------------------------------------------------------------
// BRANCH SELECTION — loading / error / empty / list. "Empty" means no PAST
// days yet (a brand-new list, currentStudyDay 0) — independent of whether a
// non-actionable "today" row also renders (the caller always may show that
// regardless of branch, once loading/error are past).
// ---------------------------------------------------------------------------

/**
 * @param {{loading: boolean, error: string|null|undefined,
 *   pastDays: Array|null|undefined}} args
 * @returns {'loading'|'error'|'empty'|'list'}
 */
export function selectBranch({ loading, error, pastDays } = {}) {
  if (loading) return 'loading'
  if (error) return 'error'
  if (!Array.isArray(pastDays) || pastDays.length === 0) return 'empty'
  return 'list'
}

// ---------------------------------------------------------------------------
// BOOKMARK TOGGLE PRECEDENCE — the WRITE-side counterpart of
// `pastDayAuthority.js#bookmarkedDayForList` (the READ side). The H6 schema
// (`15_H6_SCHEMAS_AND_CONTRACTS.md:196`) is a SCALAR — at most one
// bookmarked day per (classId,listId) — so a toggle click must decide
// "replace" vs "clear", never "add".
// ---------------------------------------------------------------------------

/**
 * @param {{currentBookmarkedDay: number|null|undefined, clickedDay: number}} args
 * @returns {number|null} the NEXT bookmarked day to persist (`null` = clear
 *   the field). Clicking the ALREADY-bookmarked day clears it; clicking any
 *   other valid day MOVES the (single) bookmark there. An invalid
 *   `clickedDay` (not a positive integer) is a no-op — returns the current
 *   value unchanged, never corrupts the stored scalar.
 */
export function computeBookmarkToggleTarget({ currentBookmarkedDay, clickedDay } = {}) {
  if (!Number.isInteger(clickedDay) || clickedDay <= 0) {
    return Number.isInteger(currentBookmarkedDay) ? currentBookmarkedDay : null
  }
  return currentBookmarkedDay === clickedDay ? null : clickedDay
}
