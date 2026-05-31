/**
 * Time shimming for longitudinal day-walk tests (B14, B22).
 *
 * Install before page.goto(). Provides:
 * - Anchored Date.now()
 * - window.__advanceTime(ms) for skipping forward
 * - Weekend-skip helper for studyDaysPerWeek=5 lists
 *
 * IMPORTANT CAVEAT: this shim affects client-side Date only.
 * Firebase serverTimestamp() uses Google server clock and is NOT shimmed.
 * For B22 invariants that depend on server timestamps (e.g. recentSessions
 * ordering by submittedAt), use Admin SDK reads to compare, OR run the
 * affected scenarios against the Firebase emulator with --import / --export.
 */

/**
 * Install the time shim. Returns the offset relative to real now.
 */
export async function installTimeShim(context, anchorISO = '2026-06-01T09:00:00+09:00') {
  await context.addInitScript((anchor) => {
    const origNow = Date.now.bind(Date)
    const offsetAtAnchor = new Date(anchor).getTime() - origNow()
    window.__VOCABOOST_BASE_OFFSET__ = offsetAtAnchor
    window.__VOCABOOST_EXTRA_OFFSET__ = 0
    Date.now = () => origNow() + window.__VOCABOOST_BASE_OFFSET__ + window.__VOCABOOST_EXTRA_OFFSET__
    // Also patch new Date() with no args to use the shimmed now.
    const origDate = window.Date
    function PatchedDate(...args) {
      if (args.length === 0) {
        return new origDate(Date.now())
      }
      return new origDate(...args)
    }
    PatchedDate.now = () => Date.now()
    PatchedDate.parse = origDate.parse
    PatchedDate.UTC = origDate.UTC
    PatchedDate.prototype = origDate.prototype
    window.Date = PatchedDate
    window.__advanceTime = (ms) => { window.__VOCABOOST_EXTRA_OFFSET__ += ms }
    window.__resetTime = () => { window.__VOCABOOST_EXTRA_OFFSET__ = 0 }
  }, anchorISO)
}

/**
 * Advance the page's clock by N milliseconds.
 */
export async function advanceTime(page, ms) {
  await page.evaluate(ms => window.__advanceTime(ms), ms)
}

/**
 * Advance by 24h, skipping weekends if studyDaysPerWeek <= 5.
 */
export async function advanceToNextStudyDay(page, studyDaysPerWeek = 5) {
  await page.evaluate((sdpw) => {
    const ONE_DAY = 24 * 60 * 60 * 1000
    let ms = ONE_DAY
    if (sdpw <= 5) {
      const now = new Date(Date.now() + ONE_DAY)
      while (now.getDay() === 0 || now.getDay() === 6) {
        ms += ONE_DAY
        now.setDate(now.getDate() + 1)
      }
    }
    window.__advanceTime(ms)
  }, studyDaysPerWeek)
}

/**
 * Get the current shimmed Date as ISO string.
 */
export async function getShimmedNow(page) {
  return page.evaluate(() => new Date(Date.now()).toISOString())
}
