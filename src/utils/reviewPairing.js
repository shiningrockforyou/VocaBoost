/**
 * Review⇄anchor pairing predicate + engagement gate (CS PR-1 · WI-2, I4 fix).
 *
 * Source of truth: docs/plans/CS_2026-07-17_ROOT_CAUSE_EFFORT.md — "Census result … predicate
 * LOCKED" (PHASE 3). The predicate below is the census-LOCKED reader predicate, validated
 * read-only over the full 26SM cohort by scripts/cs/census-i4-pairing.mjs (2026-07-17):
 * 13/14 truly-stuck I4 victims drain organically + 1 by-design skip-only retake (SfEVUpvi,
 * David decision #2) + 0 cross-class false-pairs (NEED_TO_FIX #9 cross-pace protection holds).
 *
 * Root cause it fixes (I4): reconciliation's getReviewForDay required an EXACT
 * newWordStartIndex/newWordEndIndex match to the anchor while determineStartingPhase matched
 * the day's review by studyDay alone — the predicate ASYMMETRY that pins csd at anchorDay−1
 * and loops "Session Complete" with no quiz. Both readers now adopt THIS one predicate
 * (under REVIEW_PAIRING_V2) so they finally agree.
 *
 * PURE MODULE — no Firebase imports, no I/O. Safe to import from services and pages.
 * All call sites are gated behind REVIEW_PAIRING_V2 (featureFlags.js); this module is
 * dead code until that flag flips (Run-L: flag-off behavior is byte-equivalent to today).
 */

// NOTE (Codex PR-1 HIGH-1, 2026-07-17): grandfathering (David decision #3) is DELIBERATELY NOT in the
// PR-1 pairing predicate. reviewPairsWithAnchor uses STRICT engagement — exactly the predicate the
// 2026-07-17 census certified (13/14 drain; SfEVUpvi → retake per decision #2 BECAUSE its skip is
// non-engaged; 0 false-pairs). Grandfathering pre-deploy skip-reviews (so old skip-completed days aren't
// re-offered) belongs to the PR-3/F3 COMPLETION reader, which will introduce its own grandfathered
// engagement there. Do NOT reintroduce a deploy-time grandfather into pairing — it would make SfEVUpvi's
// skip pair (violating decision #2) and deploy a different predicate than the one measured.

/**
 * F9 engagement bar: a review counts as "engaged" when >= 80% of its questions were answered
 * (any score — score does NOT gate engagement). Mirrors MIN_ENGAGED in
 * scripts/cs/census-i4-pairing.mjs.
 */
export const MIN_ENGAGED_ANSWER_RATIO = 0.8;

/**
 * RECENT_ATTEMPTS_WINDOW — reconciliation candidate window, raised 8 → 12 under
 * REVIEW_PAIRING_V2 (CS PR-1 · WI-2: "Raise the recent-attempts window 8→12 so multi-review
 * days keep the new-pass"). A day with several review attempts could push the day's passed
 * `new` attempt out of the 8-doc window and starve reconciliation of its anchor evidence.
 * Consumed flag-gated at db.js getRecentAttemptsForClassList (default) and the 4
 * progressService.js call sites; flag-off keeps the literal 8 everywhere.
 */
export const RECENT_ATTEMPTS_WINDOW = 12;

/**
 * Firestore-Timestamp-tolerant epoch-ms extractor (toMillis → toDate fallback → 0).
 * Mirror of `ms()` in scripts/cs/census-i4-pairing.mjs.
 * @param {*} t - Firestore Timestamp | {toDate} | null/undefined
 * @returns {number} epoch ms (0 when absent/unreadable)
 */
export function tsMillis(t) {
  return (t && typeof t.toMillis === 'function')
    ? t.toMillis()
    : (t?.toDate ? t.toDate().getTime() : 0);
}

/**
 * isEngagedReview — the F9 engagement predicate over a STORED review attempt (STRICT — no grandfather).
 * Mirror of `isEngaged()` in scripts/cs/census-i4-pairing.mjs — the EXACT predicate the 2026-07-17 census
 * certified. Grandfathering (decision #3) is NOT here (see the note above); it belongs to PR-3's completion reader.
 *
 * true when:
 *  - `autoCompleted === true` (the designed automarker — nothing to answer), OR
 *  - `totalQuestions` is not a positive integer (tq:0 automarkers / legacy docs — carve-out), OR
 *  - >= 80% of questions were answered. `answered` prefers counting non-empty
 *    `answers[].studentResponse` (the stored evidence); falls back to
 *    `totalQuestions - skipped` when no answers array was stored.
 *
 * @param {Object} a - stored attempt doc data
 * @returns {boolean}
 */
export function isEngagedReview(a) {
  if (!a || a.sessionType !== 'review') return false;
  if (a.autoCompleted === true) return true;
  if (!Number.isInteger(a.totalQuestions) || a.totalQuestions === 0) return true;
  const answered = Array.isArray(a.answers)
    ? a.answers.filter(x => String(x?.studentResponse ?? '').trim() !== '').length
    : (a.totalQuestions - (a.skipped ?? 0));
  return answered / a.totalQuestions >= MIN_ENGAGED_ANSWER_RATIO;
}

/**
 * reviewPairsWithAnchor — does `review` complete the day anchored by `anchor`?
 *
 * The census-LOCKED tiered predicate (CS_2026-07-17_ROOT_CAUSE_EFFORT.md PHASE 3 census
 * result; the `pairs(..., 'PC')`-family leg of scripts/cs/census-i4-pairing.mjs with the
 * mode param dropped):
 *
 *  0. Gate: `review.sessionType === 'review'` AND same `studyDay` (a session counter — a
 *     different day never pairs).
 *  1. EXACT range AND (temporal OR same-class) → pair. Exact
 *     newWordStartIndex/newWordEndIndex match is definitive positional proof; the same-class
 *     leg covers a retake-refreshed anchor whose review is temporally PRE-anchor.
 *  2. else require same-class AND engaged:
 *       temporal (submittedAt >= anchor's) → pair (next-allocation range drift — a review
 *       completed in a later session carries the NEXT range).
 *  3. else (same-class AND engaged AND pre-anchor):
 *       the inverted throttle-day stub `[anchor.nwsi, anchor.nwsi-1]` OR a null range
 *       (state lost) → pair. These are the ~9 relief-minted `[twi,twi-1]` stubs.
 *
 * A skip (non-engaged) never pairs on the relaxed legs → routes to a real retake (David
 * decision #2). A cross-CLASS review fails every relaxed leg (range differs AND class
 * differs) → NEED_TO_FIX #9 cross-pace protection preserved (census: 0 false-pairs).
 *
 * @param {Object} review - candidate review attempt doc data
 * @param {Object} anchor - the day's passed-new anchor:
 *   {studyDay, classId, submittedAt, newWordStartIndex, newWordEndIndex}
 * @returns {boolean}
 */
export function reviewPairsWithAnchor(review, anchor) {
  if (!review || !anchor) return false;
  if (review.sessionType !== 'review' || review.studyDay !== anchor.studyDay) return false;
  const exact = review.newWordStartIndex === anchor.newWordStartIndex
    && review.newWordEndIndex === anchor.newWordEndIndex;
  const sameClass = review.classId === anchor.classId;
  const temporal = tsMillis(review.submittedAt) >= tsMillis(anchor.submittedAt);
  const engaged = isEngagedReview(review);
  // Tier 1 — exact positional proof (strict superset of the legacy exact+temporal predicate:
  // nothing that pairs today ever un-pairs under V2).
  if (exact && (temporal || sameClass)) return true;
  // Tiers 2/3 both require same-class AND engaged.
  if (!sameClass || !engaged) return false;
  // Tier 2 — post-anchor, same class, engaged (range drift).
  if (temporal) return true;
  // Tier 3 — pre-anchor inverted stub or null range, same class, engaged.
  return (review.newWordStartIndex === anchor.newWordStartIndex
      && review.newWordEndIndex === anchor.newWordStartIndex - 1)
    || (review.newWordStartIndex == null && review.newWordEndIndex == null);
}
