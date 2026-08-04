/**
 * ============================================================================
 * DAY-STATUS AUTHORITY (df2-33) — the ONE pure derivation for "Day N" + phase
 * ============================================================================
 * Behind `REVIEW_V2_CLIENT`, BOTH the Dashboard hero (Panel C) and each
 * per-list `ListProgressStats` row derive their "Day N" number (and, hero
 * only, the done-today phase) from this ONE module instead of two divergent
 * inline expressions (`Dashboard.jsx`'s Panel C memo vs `ListProgressStats`'s
 * own `(progress?.currentStudyDay ?? 0) + 1`, raw-doc-only, no reconciliation)
 * — the "two-done-authorities" disease the df2-33 card names: on one screen,
 * flag-on, the focused list's own row could show a DIFFERENT Day number than
 * the hero.
 *
 * READ-ONLY ASSEMBLY, PURE (orchestrator decision 1, df2-33 BRIEF): the
 * Dashboard NEVER calls the session-entry pipeline (`initializeDailySession`
 * or any write-performing path) to learn day status. This module has ZERO
 * Firestore verbs and ZERO imports — every input (`progress`, `attempts`,
 * `resolvedCsd`, `phaseOracle`) is injected by the caller, matching the
 * `db`-injection convention `streakCredits.js` established (see that file's
 * header for the fuller rationale). Exercised directly by
 * `scripts/deepfix2/dashboard-df2-33-fixtures.mjs` under plain node — no
 * emulator, no Vite.
 *
 * FOLLOW-ON (do not build toward this now): `deriveSessionState` (DF2-20)
 * does not exist yet. When it lands it ABSORBS this module — the session-
 * entry pipeline's own day/phase derivation becomes the single upstream
 * source the Dashboard reads from, instead of this dashboard-local
 * derivation. This fold only unifies the Dashboard's OWN two divergent call
 * sites (orchestrator decision 1); it does not attempt to anticipate DF2-20's
 * shape.
 *
 * THE NON-DEMOTING CSD CONTRACT [mirrors Dashboard.jsx's hero exactly — see
 * this fold's ledger V1/V3 for the re-verified line citation, since line
 * numbers drift]:
 *   `currentStudyDay = max(resolvedCsd ?? 0, progress?.currentStudyDay ?? 0)`
 * `resolvedCsd` is expected to already be FOCUS-GUARDED by the caller via
 * `csdForRow` below (or equivalently `null` when there is no trustworthy
 * resolved value for this row) — this function does not re-check
 * classId/listId itself, it only takes the max. `csdForRow` returns `null`
 * in every state where the hero's original combined guard would also have
 * fallen through to the raw doc value, and `Math.max(0, x) === x` for the
 * non-negative `currentStudyDay` domain this codebase already assumes
 * elsewhere (e.g. `ListProgressStats`'s pre-existing `completedDays + 1` with
 * no floor) — so composing `csdForRow` + this max reproduces the hero's
 * original combined expression across every reachable state (ledger V3 has
 * the 4-case truth table).
 *
 * `displayDay = currentStudyDay + 1` — the "+1" convention (Day 1 for a
 * brand-new list, `currentStudyDay = 0`) now has exactly ONE home.
 *
 * `phaseOracle` IS INJECTED (the Dashboard passes the real
 * `determineStartingPhase` from `services/studyService.js`) rather than
 * imported here, for two independent reasons: (1) it keeps this module
 * import-pure for node fixtures — `studyService.js` imports `../firebase.js`,
 * which reads Vite's `import.meta.env` and cannot load under plain node
 * (ledger V4 reproduces the exact node error); (2) `determineStartingPhase`
 * has REAL side effects — console logging on every call, and on an
 * "impossible phase" day-1 branch, `logSystemEvent(...)` (`services/db.js`),
 * a Firestore WRITE — so the call site (Dashboard.jsx) must invoke it AT MOST
 * ONCE per render via a genuinely lazy `REVIEW_V2_CLIENT ? ... : ...` ternary
 * (never once per branch), or flag-off would silently gain a second write it
 * never had today.
 *
 * `attempts: null` (explicitly, not merely omitted/undefined) means "the
 * caller did not supply attempts" — `phaseOracle` is then NEVER CALLED (not
 * just its result discarded: `ListProgressStats` renders ONE ROW PER LIST, so
 * calling the real oracle there unconditionally would multiply its
 * console/Firestore side effects by the row count) and `phase`/`doneToday`
 * come back explicit `null` ("not computed"), so a caller that forgot to pass
 * attempts can never silently render a wrong done-state. `attempts: []` (or
 * any array) IS a real value — it computes normally (an empty list simply has
 * no attempts to match, same as today).
 * ============================================================================
 */

/**
 * The per-list attempts filter, given one home (mirrors the hero's own
 * pre-existing inline filter, which stays untouched as the flag-off leg).
 * @param {Array<{classId: string, listId: string}>|null|undefined} attempts
 * @param {string} classId
 * @param {string} listId
 * @returns {Array} attempts belonging to exactly this class+list (never null).
 */
export function attemptsForList(attempts, classId, listId) {
  return (attempts || []).filter((a) => a.classId === classId && a.listId === listId)
}

/**
 * The focus guard, given one home: the resolved csd is only trustworthy for
 * THIS row when it was resolved for this exact class+list (a stale
 * resolution from a previously-focused list must never leak into a different
 * row). Returns `null` on any mismatch or when `resolvedFocusCsd` itself is
 * absent — the caller's flag gate is already baked in upstream (the state
 * this reads can only be non-null while the resolving flag is on; ledger V3
 * cites the setter sites), so this predicate does not need to re-check it.
 * @param {{classId: string, listId: string, csd: number}|null|undefined} resolvedFocusCsd
 * @param {string} classId
 * @param {string} listId
 * @returns {number|null}
 */
export function csdForRow(resolvedFocusCsd, classId, listId) {
  if (resolvedFocusCsd && resolvedFocusCsd.classId === classId && resolvedFocusCsd.listId === listId) {
    return resolvedFocusCsd.csd
  }
  return null
}

/**
 * The ONE day-status derivation. Pure; `phaseOracle` is invoked AT MOST ONCE,
 * and only when `attempts` is a real (non-nullish) value — see the module
 * header: `attempts: null` skips it entirely, not just its result.
 * @param {{
 *   progress: {currentStudyDay?: number}|null|undefined,
 *   attempts: Array|null|undefined,
 *   resolvedCsd: number|null|undefined,
 *   phaseOracle: (attempts: Array, dayNumber: number) => {phase: string}
 * }} args
 * @returns {{currentStudyDay: number, displayDay: number, phase: string|null, doneToday: boolean|null}}
 */
export function deriveListDayStatus({ progress, attempts, resolvedCsd, phaseOracle }) {
  const currentStudyDay = Math.max(resolvedCsd ?? 0, progress?.currentStudyDay ?? 0)
  const displayDay = currentStudyDay + 1

  // "not computed" sentinel: attempts nullish (null or omitted/undefined) ⇒
  // phaseOracle is never called at all (module header — avoids multiplying a
  // real side-effecting oracle's calls across N per-list rows).
  if (attempts == null) {
    return { currentStudyDay, displayDay, phase: null, doneToday: null }
  }

  const phase = phaseOracle(attempts, displayDay).phase
  const doneToday = phase === 'complete'
  return { currentStudyDay, displayDay, phase, doneToday }
}
