/**
 * Forced-Pathway (CS PR-3) — binary throttle + grandfathered completion-engagement.
 *
 * Source of truth (LOCKED): docs/plans/FORCED_PATHWAY_FIX_PLAN_2026-07-16.md (David's binary
 * throttle) + docs/plans/CS_2026-07-17_ROOT_CAUSE_EFFORT.md (PHASE 3 conflict resolutions:
 * F1 deriveThrottleMode / hold-csd, F3 engagement, decision-#3 grandfather).
 *
 * This is the PURE logic PR-3 layers on top of the existing engine. Every CALL SITE is gated
 * behind the FORCED_PATHWAY flag (src/config/featureFlags.js); this module is dead code until
 * that flag flips (Run-L: flag-off behavior is byte-equivalent to today). It NEVER mutates the
 * PR-1 pairing predicate — it CONSUMES isEngagedReview / tsMillis from reviewPairing.js.
 *
 * The three pieces:
 *   1. deriveThrottleMode(recentSessions, priorMode) — the BINARY throttle with hysteresis
 *      (enter <0.30 / exit >0.50). Replaces the graduated calculateInterventionLevel ramp when
 *      FORCED_PATHWAY is on: review mode ⇒ 0 new words (via deriveBinaryInterventionLevel → 1).
 *      The `priorMode` argument is the persisted class_progress.reviewMode bit — reading it (not
 *      recomputing from scratch every init) is what KILLS the whack-a-mole (I5): CS can durably
 *      clear a throttle by setting reviewMode:false, and a hysteresis-band average holds.
 *   2. isCompletionEngaged(attempt, epoch) — the F3 COMPLETION-reader engagement predicate WITH
 *      the decision-#3 grandfather (pre-deploy reviews count as engaged; only post-deploy skips
 *      are gated). DELIBERATELY separate from reviewPairing.isEngagedReview, which PR-1 keeps
 *      STRICT (Codex PR-1 HIGH-1). Prefers the PR-2 server stamp (engagedReview) when present.
 *   3. FORCED_PATHWAY_GRANDFATHER_EPOCH_MS — the grandfather constant (set at flip).
 */

import { isEngagedReview, tsMillis, MIN_ENGAGED_ANSWER_RATIO } from './reviewPairing';

/**
 * Binary-throttle hysteresis bounds (David-locked 2026-07-16 / CS_2026-07-17 I5):
 *   ENTER review mode when the last-3 review average is BELOW 0.30;
 *   EXIT  review mode when it is ABOVE 0.50;
 *   in the [0.30, 0.50] band the mode is UNCHANGED (hysteresis — no flapping).
 * These reuse the existing STUDY_ALGORITHM_CONSTANTS.INTERVENTION_LOW_SCORE (0.30) enter point;
 * the 0.50 exit point is the new hysteresis bar (the graduated model had a single 0.75 knee).
 */
export const FORCED_PATHWAY_ENTER_THRESHOLD = 0.30;
export const FORCED_PATHWAY_EXIT_THRESHOLD = 0.50;

/**
 * FORCED_PATHWAY_GRANDFATHER_EPOCH_MS — decision-#3 grandfather constant (David LOCKED 2026-07-17,
 * CS_2026-07-17 "Engagement backfill → grandfather pre-deploy docs"). A review whose submittedAt
 * is BEFORE this epoch counts as engaged in the COMPLETION reader, so old skip-completed days are
 * NOT re-offered when F3 goes live (zero disruption to existing students; only post-deploy skips
 * are gated). SET AT FLIP to the FORCED_PATHWAY deploy timestamp (epoch ms). NULL here = no
 * grandfather effect (the reader is dead code until the flag flips anyway) — the value is provided
 * at flip so PR-3 never ships a live grandfather that would, e.g., mis-credit a pre-epoch skip.
 * @type {number|null}
 */
export const FORCED_PATHWAY_GRANDFATHER_EPOCH_MS = 1784333239063; // PR-3 client-flip deploy epoch (2026-07-18T00:07:19Z). functions/foundation.js MUST be set to this SAME value at the P4 server flip.

/**
 * reviewAvgLastN — the last-N non-null review-score average, or null when fewer than N valid
 * scores exist. Byte-faithful to calculateInterventionLevel's window (studyAlgorithm.js:71-78):
 * filter non-null reviewScore, slice(-N), require length === N. Returning null for < N valid
 * scores makes deriveThrottleMode default to full pace — matching calculateInterventionLevel,
 * which returns 0.0 (no intervention) for < 3 scores.
 *
 * @param {Array<{reviewScore?:number|null}>} recentSessions
 * @param {number} [n=3]
 * @returns {number|null}
 */
export function reviewAvgLastN(recentSessions, n = 3) {
  if (!Array.isArray(recentSessions) || recentSessions.length === 0) return null;
  const valid = recentSessions
    .filter((s) => s?.reviewScore !== null && s?.reviewScore !== undefined)
    .map((s) => s.reviewScore)
    .slice(-n);
  if (valid.length < n) return null;
  return valid.reduce((sum, x) => sum + x, 0) / valid.length;
}

/**
 * deriveThrottleMode — the BINARY throttle decision with hysteresis (David-locked). Returns the
 * review-mode bit for THIS session given the recent review history and the PRIOR persisted mode.
 *
 *   avg == null (< 3 valid scores) → false  (full pace; parity with calculateInterventionLevel → 0)
 *   avg <  0.30                    → true   (ENTER review mode — genuine low reviewer)
 *   avg >  0.50                    → false  (EXIT review mode — recovered)
 *   0.30 <= avg <= 0.50            → priorMode  (hysteresis band — hold, no flapping)
 *
 * @param {Array<{reviewScore?:number|null}>} recentSessions
 * @param {boolean} priorMode - the persisted class_progress.reviewMode bit (default false)
 * @returns {boolean} review-mode bit for this session
 */
export function deriveThrottleMode(recentSessions, priorMode = false) {
  const avg = reviewAvgLastN(recentSessions, 3);
  if (avg == null) return false;
  if (avg < FORCED_PATHWAY_ENTER_THRESHOLD) return true;
  if (avg > FORCED_PATHWAY_EXIT_THRESHOLD) return false;
  return priorMode === true;
}

/**
 * deriveBinaryInterventionLevel — the derived {0,1} interventionLevel from the review-mode bit.
 * Review mode ⇒ 1.0 ⇒ calculateDailyAllocation(pace, 1) = round(pace·0) = 0 new words (the hard
 * binary throttle). Keeping interventionLevel as a real derived {0,1} field (NOT a bespoke
 * "reviewMode-only" allocation) means every stored-interventionLevel reader — the review test
 * size, the challenge-accept advance, the dormant server mirrors — stays coherent unchanged.
 *
 * @param {boolean} reviewMode
 * @returns {number} 1 when review mode, else 0
 */
export function deriveBinaryInterventionLevel(reviewMode) {
  return reviewMode === true ? 1 : 0;
}

/**
 * isCompletionEngaged — the F3 COMPLETION-reader engagement predicate (grandfathered).
 *
 * "Does this review count toward advancing the day?" Distinct from reviewPairing.isEngagedReview
 * (STRICT, used by the PR-1 pairing readers) — this adds the decision-#3 grandfather so old
 * pre-deploy reviews are never re-gated when F3 goes live.
 *
 *   1. GRANDFATHER: submittedAt earlier than the epoch → engaged (any score/answer count). Guarded
 *      by tsMillis > 0 so a null/0 timestamp does NOT spuriously grandfather (0 < epoch is true).
 *   2. STAMP: the PR-2 server stamp `engagedReview` (computeReviewEngagementStamp output) when it
 *      is present on the stored attempt — the authoritative post-deploy signal.
 *   3. FALLBACK: reviewPairing.isEngagedReview (>= 80% answered, tq:0 / autoCompleted carve-out) —
 *      the census-locked predicate, consumed unmodified, for docs written before the stamp.
 *
 * @param {Object} attempt - stored (or synthetic fresh) review attempt data
 * @param {number|null} [epochMs=FORCED_PATHWAY_GRANDFATHER_EPOCH_MS] - grandfather epoch (ms)
 * @returns {boolean}
 */
export function isCompletionEngaged(attempt, epochMs = FORCED_PATHWAY_GRANDFATHER_EPOCH_MS) {
  if (!attempt) return false;
  if (epochMs != null) {
    const ms = tsMillis(attempt.submittedAt);
    if (ms > 0 && ms < epochMs) return true; // decision-#3 grandfather
  }
  if (typeof attempt.engagedReview === 'boolean') return attempt.engagedReview; // PR-2 stamp
  return isEngagedReview(attempt); // STRICT census predicate (fallback)
}

// Re-export the shared 80% bar so callers computing engagement from a fresh answered-count don't
// re-declare it (single source: reviewPairing.MIN_ENGAGED_ANSWER_RATIO).
export { MIN_ENGAGED_ANSWER_RATIO };
