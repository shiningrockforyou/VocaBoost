// Expected-word model for the B27 longitudinal word-correctness audit.
// PURE, READ-ONLY. Mirrors src/utils/studyAlgorithm.js so the audit can compute
// what words SHOULD appear vs what the UI presents. Update if the app algorithm changes.
// NOTE: /app/package.json has "type":"module" — this file is an ES module.

export const C = {
  INTERVENTION_HIGH_SCORE: 0.75,
  INTERVENTION_LOW_SCORE: 0.30,
  REVIEW_COUNT_BASE: 100,
  REVIEW_COUNT_MIN: 15,
  REVIEW_TEST_SIZE_MIN: 30,
  REVIEW_TEST_SIZE_MAX: 60,
  STALE_DAYS_THRESHOLD: 21,
};

export function calculateInterventionLevel(recentReviewScores) {
  const scores = (recentReviewScores || []).filter((s) => s != null).slice(-3);
  if (scores.length < 3) return 0.0;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg >= C.INTERVENTION_HIGH_SCORE) return 0.0;
  if (avg <= C.INTERVENTION_LOW_SCORE) return 1.0;
  return (C.INTERVENTION_HIGH_SCORE - avg) / (C.INTERVENTION_HIGH_SCORE - C.INTERVENTION_LOW_SCORE);
}

export function newWordCount(dailyPace, interventionLevel) {
  return Math.round(dailyPace * (1 - interventionLevel));
}

// New words = next contiguous slice starting at words-introduced-so-far.
export function expectedNewWordRange(totalWordsIntroducedBefore, dailyPace, interventionLevel, listSize) {
  const count = newWordCount(dailyPace, interventionLevel);
  if (count <= 0) return null;
  const startIndex = totalWordsIntroducedBefore;
  if (startIndex >= listSize) return null;
  const endIndex = Math.min(startIndex + count, listSize) - 1;
  return { startIndex, endIndex, count: endIndex - startIndex + 1 };
}

// Review segment range, verbatim from studyAlgorithm.js:118. Null on week1-day1.
export function calculateSegment(currentStudyDay, studyDaysPerWeek, totalWordsIntroduced, dailyPace, interventionLevel) {
  const weekNumber = Math.ceil(currentStudyDay / studyDaysPerWeek);
  const dayOfWeek = ((currentStudyDay - 1) % studyDaysPerWeek) + 1;
  if (weekNumber === 1 && dayOfWeek === 1) return null;
  const adjustedPace = dailyPace * (1 - interventionLevel);
  const daysRemaining = studyDaysPerWeek - dayOfWeek;
  const projectedTotal = totalWordsIntroduced + (daysRemaining * adjustedPace);
  if (projectedTotal === 0) return null;
  const divisor = (weekNumber === 1) ? (studyDaysPerWeek - 1) : studyDaysPerWeek;
  const segmentSize = Math.ceil(projectedTotal / divisor);
  const segmentPosition = (weekNumber === 1) ? (dayOfWeek - 2) : (dayOfWeek - 1);
  const startIndex = segmentPosition * segmentSize;
  const endIndex = Math.min((segmentPosition + 1) * segmentSize, totalWordsIntroduced) - 1;
  if (startIndex >= totalWordsIntroduced) return null;
  return { startIndex, endIndex };
}

// Partition segment words into eligible vs retired (MASTERED within 21-day window).
// segmentWordStates: [{ position, status, returnAtMs }]
export function partitionReviewEligibility(segmentWordStates, segment, nowMs) {
  const eligibleIds = new Set();
  const retiredIds = new Set();
  for (const w of segmentWordStates) {
    if (w.position < segment.startIndex || w.position > segment.endIndex) continue;
    const isMastered = w.status === 'MASTERED' && (w.returnAtMs == null || w.returnAtMs > nowMs);
    if (isMastered) retiredIds.add(w.position);
    else eligibleIds.add(w.position);
  }
  return { eligibleIds, retiredIds };
}

// NEW-word position check (range-based is correct for new words).
export function checkNewWords({ presentedPositions = [], expectedRange }) {
  const v = [];
  if (!expectedRange) {
    if (presentedPositions.length > 0) v.push(`new: expected NO new words (null range) but UI showed ${presentedPositions.length}`);
    return v;
  }
  for (const p of presentedPositions) {
    if (p < expectedRange.startIndex || p > expectedRange.endIndex)
      v.push(`new: word at position ${p} outside expected [${expectedRange.startIndex},${expectedRange.endIndex}]`);
  }
  return v;
}

// REVIEW check by WORD IDENTITY (wordId), judged against PRE-session study_states.
// Fixes the position-based false positive: a MASTERED word existing at some
// position does NOT mean the word the UI served at that position is mastered.
// Only the actual served word's pre-session status matters.
// @param presentedWordStates [{ wordId, position, preStatus, preReturnAtMs }]  (preStatus/returnAt captured BEFORE this session's grading)
// @param segment {startIndex,endIndex} | null
// @param nowMs   session clock
export function checkReviewWords({ presentedWordStates = [], segment, nowMs }) {
  const v = [];
  if (!segment) {
    if (presentedWordStates.length > 0) v.push(`review: expected NO review (null segment) but UI showed ${presentedWordStates.length}`);
    return v;
  }
  for (const w of presentedWordStates) {
    const retired = w.preStatus === 'MASTERED' && (w.preReturnAtMs == null || w.preReturnAtMs > nowMs);
    if (retired) {
      v.push(`review: RETIRED (MASTERED) word ${w.wordId} (pos ${w.position}, returnAt ${w.preReturnAtMs}) served before returnAt`);
    } else if (w.position != null && (w.position < segment.startIndex || w.position > segment.endIndex)) {
      // out-of-segment is informational, not a hard MASTERED-leak; tag distinctly
      v.push(`review-info: word ${w.wordId} pos ${w.position} outside segment [${segment.startIndex},${segment.endIndex}] (verify CSD/TWI not lagged before trusting)`);
    }
  }
  return v;
}

// DEPRECATED position-based checker — kept for back-compat; prefer checkNewWords + checkReviewWords.
// The review branch here caused false positives (position != served-word identity). Do not use for review.
export function checkPresentedWords({ phase, presentedPositions = [], expectedRange, eligibleIds, retiredIds }) {
  if (phase === 'new') return checkNewWords({ presentedPositions, expectedRange });
  const v = [];
  if (!expectedRange) {
    if (presentedPositions.length > 0) v.push(`${phase}: expected NO words (null range) but UI showed ${presentedPositions.length}`);
    return v;
  }
  for (const p of presentedPositions) {
    if (retiredIds && retiredIds.has(p)) v.push(`review(DEPRECATED-position-check): position ${p} maps to a retired word — VERIFY served-word identity before trusting`);
    else if (eligibleIds && !eligibleIds.has(p)) v.push(`review(DEPRECATED-position-check): position ${p} not in eligible pool — likely CSD-lag noise`);
  }
  return v;
}
