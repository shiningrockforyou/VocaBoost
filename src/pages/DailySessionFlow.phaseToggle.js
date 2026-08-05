/**
 * ============================================================================
 * DAILY SESSION FLOW — PHASE TOGGLE (DF2-51-e) — pure predicate module
 * ============================================================================
 * `DailySessionFlow.jsx` renders the within-day Review / New-words toggle
 * (R2-26 Q11 free-nav, RATIFIED `22_DF2-51_PASTDAY_NAV_DESIGN.md` §7(d)) on
 * today's two study screens, behind `REVIEW_V2_CLIENT`. This module holds
 * every piece of that toggle's logic that CAN be pure — which half is
 * offerable today, and whether a given tap should actually run a phase
 * transition — so it can be fixtured with plain `node`
 * (`scripts/deepfix2/df2-51e-toggle-fixtures.mjs`), exactly like this
 * program's other pure-derivation modules.
 *
 * WHY A SEPARATE FILE FROM THE .jsx (a judgment call, recorded here, in the
 * fold ledger, and in the fold report, per the brief's own instruction:
 * "51-c hit this and put its pure logic in a sibling .js module. Follow that
 * precedent if you need it, and say so"): this checkout cannot parse JSX
 * under plain node — confirmed independently this session, the same class of
 * fact as 51-c's own V11 finding (`ls node_modules/@esbuild/` shows only
 * `win32-x64`; no `@babel/plugin-transform-react-jsx` or
 * `@babel/preset-react` anywhere under `node_modules/@babel`) — so a `.jsx`
 * file cannot be `import`ed by plain Node AT ALL, not even to reach a
 * non-JSX export, because Node's parser fails on the FIRST JSX token in the
 * file. The brief's own fixture list ("a half with no work is not
 * offerable"; "toggling changes only the phase, never progress/day") is
 * therefore only satisfiable BY EXECUTION (not just source-text grep) if
 * this logic lives somewhere plain `node` can load. This is the ONLY new
 * file this fold adds outside its named build target; `DailySessionFlow.jsx`
 * imports these functions rather than reimplementing them, so the
 * availability/guard logic has exactly ONE source of truth (never a
 * parallel one — the brief's own anti-duplication instruction).
 *
 * PURE — zero imports (no React, no Firestore, no `../firebase.js`),
 * node-loadable, exercised directly by
 * `scripts/deepfix2/df2-51e-toggle-fixtures.mjs`. Every input is injected;
 * nothing here reads Firestore, calls the engine, or holds state.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// AVAILABILITY — is a given half offerable AT ALL today? Never "does the
// in-memory queue still have un-swiped cards" (that fluctuates every tap and
// is not "no work today" in the brief's sense) — only whether the DAY's
// config, fixed for the whole session (studyService.js#initializeDailySession),
// has this half at all. Brief: "if a half genuinely has no work (e.g. no new
// words today), the toggle must not offer a dead destination — disable with
// a reason" (mirrors RestudyBrowser.jsx's restudyDisabled/retestDisabled +
// title=, the 51-c precedent this brief names).
// ---------------------------------------------------------------------------

/**
 * Today's REVIEW half exists only when there is a segment to review — the
 * EXACT same source `DailySessionFlow.jsx#moveToReviewPhase` itself already
 * guards on (`if (!config?.segment) { ...skip... }`); read verbatim here
 * rather than re-derived, so there is one fact ("does review exist today"),
 * never two that could disagree. `segment` is `null` on Day 1 (no review
 * yet) and, more rarely, on a later day whose unmastered pool sliced to
 * nothing this day (studyService.js `initializeDailySession`: `segment`
 * stays `null` unless `cappedIds && cappedIds.length`).
 * @param {{segment: *}|null|undefined} sessionConfig
 * @returns {boolean}
 */
export function canOfferReviewPhase(sessionConfig) {
  return Boolean(sessionConfig?.segment)
}

/**
 * Today's NEW-WORDS half exists only when the day's allocation is positive.
 * `newWordCount` is set ONCE per session (studyService.js
 * `initializeDailySession`, field `nwCount`) — `0` on a review-only day
 * (throttle / list-end / NEED_TO_FIX #9 same-day-elsewhere resume), and per
 * that function's own comment may be transiently NEGATIVE on legacy
 * over-introduction; `> 0` treats every non-positive value as "nothing to
 * offer", matching the brief's "no dead destination".
 * @param {{newWordCount: number}|null|undefined} sessionConfig
 * @returns {boolean}
 */
export function canOfferNewWordsPhase(sessionConfig) {
  return Number(sessionConfig?.newWordCount ?? 0) > 0
}

// ---------------------------------------------------------------------------
// SELECTION GUARD — should tapping `targetPhase` actually run its transition
// (moveToReviewPhase / moveToNewWordsPhase), or no-op? Two INDEPENDENT
// clauses, each fixtured/mutated separately (every clause pinned on its
// own): (1) never select an unavailable half — belt-and-braces alongside
// the button's own `disabled` attribute, so the guard holds even if the
// disabled wiring is ever bypassed; (2) never re-run the transition for the
// phase that is ALREADY active — `moveToReviewPhase` unconditionally
// rebuilds the review study set from scratch every time it runs (by design;
// it also serves the deliberate-retake caller `handleReEntryRetake`), so a
// redundant tap on the already-active tab would silently discard this-visit
// review-dismiss progress for no reason.
// ---------------------------------------------------------------------------

/**
 * @param {{targetPhase: 'new'|'review', activePhase: 'new'|'review'|null,
 *   available: boolean}} args
 * @returns {boolean} true = run the transition; false = no-op this tap.
 */
export function shouldRunPhaseToggle({ targetPhase, activePhase, available } = {}) {
  if (!available) return false
  if (targetPhase === activePhase) return false
  return true
}

// ---------------------------------------------------------------------------
// COPY — the toggle's on-screen text, in the app's own voice (brief: "carry
// the on-screen rule from the wireframe... in the app's own voice"; wireframe
// source `mockups/df2-51-extended.html` §3, callout 2). ONE source for both
// the render and the fixture's content assertion (never hand-duplicated).
// ---------------------------------------------------------------------------
export const PHASE_TOGGLE_COPY = Object.freeze({
  rule: 'Both halves still need to be finished before tomorrow unlocks. Switching here only changes the order — not whether you need to finish them.',
  reviewUnavailable: 'No review half today',
  newWordsUnavailable: 'No new-word half today',
})
