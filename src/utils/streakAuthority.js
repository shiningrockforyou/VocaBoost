/**
 * ============================================================================
 * DASHBOARD-STREAK-AUTHORITY (NTF-25, A1) — the ACCOUNT-WIDE streak derivation
 * ============================================================================
 * Behind `REVIEW_V2_CLIENT`, the Dashboard reads the server's account-wide
 * `streak_credits` ledger (`users/{uid}/streak_credits/{kstDate}`,
 * `functions/reviewV2/completion.js:679/744-748`, frozen shape at
 * `docs/plans/deepfix2/15_H6_SCHEMAS_AND_CONTRACTS.md:192`) instead of
 * computing a per-list streak client-side (`Dashboard.jsx` `calculateStreak`,
 * left UNTOUCHED — that stays the flag-off path, ledger V4).
 *
 * PURE — zero imports, zero Firestore, zero `../firebase.js` (which requires
 * Vite's `import.meta.env` and therefore cannot be loaded by a plain-node
 * fixture; see `src/services/streakCredits.js`'s header and
 * `scripts/deepfix2/cutover-c-complete-emulator.mjs:22-30` for the estab-
 * lished precedent). This module is exercised directly by
 * `scripts/deepfix2/dashboard-streak-authority-fixtures.mjs` with `node
 * scripts/deepfix2/dashboard-streak-authority-fixtures.mjs` — no emulator.
 *
 * THE WALK [ledger V3/A1]: `streak_credits` docIds are KST `YYYY-MM-DD`
 * strings, lexicographic === chronological (completion.js:87-90), and AT MOST
 * ONE credit per date, ACCOUNT-WIDE (any class/list — completion.js:744, R2-21
 * `create()`-if-absent). Given `creditDates` already ordered DESCENDING (the
 * caller's query contract — `orderBy(documentId(), 'desc')`,
 * `src/services/streakCredits.js`), walk backward from the most recent date,
 * matching each next entry against the FIXED Sat/Sun-skipping "previous
 * expected study day" (R2-21 has no per-student `studyDaysPerWeek` — the
 * server ledger carries no such field, so unlike `calculateStreak`'s
 * `skipWeekends = studyDaysPerWeek <= 5` the skip here is unconditional).
 * "Weekend absences never break the streak"
 * (`docs/plans/deepfix2/11_REDESIGN_VERIFICATION_AND_FOLD_PLAN.md:64`, R2-21).
 * The walk stops at the first date that does not match — a gap of any other
 * size ends the count there (it does not zero it; only the freshness gate
 * below can zero it).
 *
 * THE FRESHNESS GATE mirrors `calculateStreak` EXACTLY in spirit
 * (`Dashboard.jsx:99-119` — "only count the streak if the most recent session
 * was today or yesterday [or last weekday]"): the derived count is discarded
 * (⇒ 0) unless the MOST RECENT credit is KST-today or KST-yesterday
 * (weekend-adjusted). A long-but-stale internal chain still zeroes.
 *
 * ACCOUNT-WIDE BY CONSTRUCTION: `deriveAccountStreak` takes bare date
 * strings — it never receives `classId`/`listId`, so it is structurally
 * incapable of being filtered to one list (C5's mutant target lives at the
 * READ layer, `streakCredits.js`, which is where `classId`/`listId` would
 * have to be reintroduced to filter by).
 */

const DAY_MS = 86400000
const KST_OFFSET_MS = 9 * 3600000

/**
 * KST calendar date string for a UTC-epoch millisecond instant. MIRRORS
 * `functions/reviewV2/completion.js:88-90` (`kstDateString`) BYTE-FOR-BYTE —
 * this is the same formula the server uses to mint `streak_credits` docIds,
 * so "today" here and "today" at write time always agree regardless of the
 * running machine's own local timezone (unlike `calculateStreak`, which uses
 * the BROWSER's local calendar — left that way deliberately, V4: this module
 * does not touch it). A drift here would silently misalign every derived
 * streak against the server's actual credited dates.
 * @param {number} ms - epoch milliseconds
 * @returns {string} 'YYYY-MM-DD' in KST (UTC+9, DST-free)
 */
export function kstDateString(ms) {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10)
}

/** Shift a 'YYYY-MM-DD' string by `deltaDays`, parsed/formatted as UTC
 *  midnight so the result never depends on the running machine's local
 *  timezone (these strings are already KST calendar dates; further
 *  local-zone interpretation would only introduce drift). */
function shiftDateStr(dateStr, deltaDays) {
  const ms = Date.parse(`${dateStr}T00:00:00Z`) + deltaDays * DAY_MS
  return new Date(ms).toISOString().slice(0, 10)
}

/** Sat/Sun in the KST calendar the date string already represents. */
function isWeekendDateStr(dateStr) {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay()
  return day === 0 || day === 6 // Sunday | Saturday
}

/** The previous EXPECTED credit date: one calendar day back, then skip
 *  backward over a FIXED Sat/Sun weekend (R2-21 — no per-student
 *  `studyDaysPerWeek` on this ledger, so unlike `calculateStreak` the skip is
 *  unconditional, not gated on `studyDaysPerWeek <= 5`). */
function previousExpectedDate(dateStr) {
  let prev = shiftDateStr(dateStr, -1)
  while (isWeekendDateStr(prev)) prev = shiftDateStr(prev, -1)
  return prev
}

/**
 * A single cheap indexed range read (docId desc) generously covers any
 * realistic streak (~13 months of daily credits) while bounding read cost.
 * Also used as the Firestore `limit()` in `streakCredits.js`. If a streak is
 * genuinely longer than this, the walk simply hits the fetched boundary and
 * returns the (still-correct, just capped) count — it never fabricates a
 * longer streak than what was actually fetched.
 */
export const ACCOUNT_STREAK_QUERY_LIMIT = 400

/**
 * Derive the R2-21 account-wide streak length from a DESCENDING list of KST
 * `streak_credits` docIds (date strings). Deterministic — `now` is injected
 * (defaults to the real clock) so callers/fixtures can pin "today".
 *
 * @param {string[]} creditDates - `streak_credits` docIds, ALREADY sorted
 *   descending (the query's contract — this function does not re-sort; a
 *   differently-ordered array is a caller bug, not something to silently fix
 *   here, matching the "trust the query shape" posture the fold ledger's A2
 *   fixtures exist to pin).
 * @param {{now?: Date}} [opts]
 * @returns {number} the streak length, or 0 if empty/stale.
 */
export function deriveAccountStreak(creditDates, { now = new Date() } = {}) {
  if (!Array.isArray(creditDates) || creditDates.length === 0) return 0

  const mostRecent = creditDates[0]
  let streak = 1
  let cursor = mostRecent
  for (let i = 1; i < creditDates.length; i++) {
    const expected = previousExpectedDate(cursor)
    if (creditDates[i] !== expected) break // the gap ends the count HERE, not at 0
    streak++
    cursor = expected
  }

  // FRESHNESS GATE (mirrors calculateStreak, Dashboard.jsx:99-119): the count
  // only stands if the MOST RECENT credit is today or yesterday (weekend-
  // adjusted) — a stale streak (however long internally) reports 0.
  const today = kstDateString(now.getTime())
  const yesterday = previousExpectedDate(today)
  return (mostRecent === today || mostRecent === yesterday) ? streak : 0
}
