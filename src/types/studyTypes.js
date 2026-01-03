/**
 * Type definitions for the study system.
 * Used for documentation and IDE support.
 */

/**
 * Word status values
 */
export const WORD_STATUS = {
  NEW: 'NEW',                    // Just introduced, not yet tested
  NEVER_TESTED: 'NEVER_TESTED',  // Introduced but never appeared in a test
  FAILED: 'FAILED',              // Last test result was incorrect
  PASSED: 'PASSED'               // Last test result was correct
};

/**
 * Study state document structure (new system)
 * Collection: users/{userId}/study_states/{wordId}
 * 
 * @typedef {Object} StudyState
 * @property {string} status - WORD_STATUS value
 * @property {number} timesTestedTotal - Lifetime test appearances
 * @property {number} timesCorrectTotal - Lifetime correct answers
 * @property {Timestamp|null} lastTestedAt - Last test timestamp
 * @property {boolean|null} lastTestResult - true = correct, false = incorrect
 * @property {Timestamp|null} dismissedUntil - Dismissed from study until this date
 * @property {Timestamp|null} lastQueuedAt - When last appeared in review queue
 * @property {number} queueAppearances - Times in queue since last test
 * @property {number} wordIndex - 0-indexed position in list
 * @property {number} introducedOnDay - Which study day this was introduced
 * @property {string} listId - Reference to parent list
 */

/**
 * Default values for new study state
 */
export const DEFAULT_STUDY_STATE = {
  status: WORD_STATUS.NEW,
  timesTestedTotal: 0,
  timesCorrectTotal: 0,
  lastTestedAt: null,
  lastTestResult: null,
  dismissedUntil: null,
  lastQueuedAt: null,
  queueAppearances: 0,
  wordIndex: 0,
  introducedOnDay: 1,
  listId: ''
};

/**
 * Create a new study state for a word
 * @param {string} wordId - Word document ID
 * @param {string} listId - List document ID
 * @param {number} wordIndex - 0-indexed position in list
 * @param {number} introducedOnDay - Study day when word was introduced
 * @returns {Object} New study state object
 */
export function createStudyState(wordId, listId, wordIndex, introducedOnDay) {
  return {
    ...DEFAULT_STUDY_STATE,
    listId,
    wordIndex,
    introducedOnDay
  };
}

/**
 * Session summary (stored in recentSessions array)
 * 
 * @typedef {Object} SessionSummary
 * @property {number} day - Study day number
 * @property {Timestamp} date - Session date
 * @property {number|null} newWordScore - Score on new word test (0-1)
 * @property {number|null} reviewScore - Score on review test (0-1)
 * @property {number} segmentStartIndex - Start of review segment
 * @property {number} segmentEndIndex - End of review segment
 * @property {number} wordsIntroduced - New words introduced this session
 * @property {number} wordsReviewed - Words in review queue
 * @property {number} wordsTested - Total words tested
 */

/**
 * Progress stats
 * 
 * @typedef {Object} ProgressStats
 * @property {number|null} avgNewWordScore - Rolling average of new word scores
 * @property {number|null} avgReviewScore - Rolling average of review scores
 * @property {number|null} estimatedMastery - Estimated % of corpus mastered
 * @property {number|null} recoveryRate - FAILED → PASSED rate
 * @property {number|null} discoveryFailureRate - NEVER_TESTED → FAILED rate
 */

/**
 * Class progress document structure
 * Collection: users/{userId}/class_progress/{classId}_{listId}
 * 
 * @typedef {Object} ClassProgress
 * @property {string} classId - Class ID
 * @property {string} listId - List ID
 * @property {number} currentStudyDay - 1-indexed study day count
 * @property {number} totalWordsIntroduced - Words introduced so far
 * @property {Timestamp} programStartDate - When student started this list
 * @property {number} interventionLevel - Current intervention (0.0 to 1.0)
 * @property {SessionSummary[]} recentSessions - Last 10 sessions
 * @property {ProgressStats} stats - Aggregate statistics
 * @property {Timestamp} lastSessionAt - Last session timestamp
 * @property {Timestamp} createdAt - Document creation timestamp
 * @property {Timestamp} updatedAt - Last update timestamp
 */

/**
 * Default values for new class progress
 */
export const DEFAULT_CLASS_PROGRESS = {
  classId: '',
  listId: '',
  currentStudyDay: 0,
  totalWordsIntroduced: 0,
  programStartDate: null,
  interventionLevel: 0,
  recentSessions: [],
  stats: {
    avgNewWordScore: null,
    avgReviewScore: null,
    estimatedMastery: null,
    recoveryRate: null,
    discoveryFailureRate: null
  },
  lastSessionAt: null,
  createdAt: null,
  updatedAt: null
};

/**
 * Get the Monday of the week for a given date
 * @param {Date} date - The date to get Monday for
 * @returns {Date} Monday of that week (at midnight)
 */
export function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  // getDay() returns 0 for Sunday, 1 for Monday, etc.
  // We want to go back to Monday (day 1)
  const diff = day === 0 ? -6 : 1 - day; // If Sunday, go back 6 days; otherwise go back to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calculate the expected study day based on program start and study days per week
 * @param {Date} programStartDate - Monday of the week student started
 * @param {number} studyDaysPerWeek - Number of study days per week (default 5 = weekdays)
 * @returns {number} Expected study day number (1-based)
 */
export function calculateExpectedStudyDay(programStartDate, studyDaysPerWeek = 5) {
  if (!programStartDate) return 1;

  const start = new Date(programStartDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);

  // Calculate days elapsed since program start
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysElapsed = Math.floor((today - start) / msPerDay);

  if (daysElapsed < 0) return 1;

  if (studyDaysPerWeek >= 7) {
    // Study every day
    return daysElapsed + 1;
  }

  // Calculate study days (skip weekends if studyDaysPerWeek <= 5)
  let studyDays = 0;
  const current = new Date(start);

  for (let i = 0; i <= daysElapsed; i++) {
    const dayOfWeek = current.getDay();
    // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (studyDaysPerWeek <= 5 && isWeekend) {
      // Skip weekends
    } else {
      studyDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  return Math.max(studyDays, 1);
}

/**
 * Create a new class progress document
 * @param {string} classId - Class document ID
 * @param {string} listId - List document ID
 * @returns {Object} New class progress object
 */
export function createClassProgress(classId, listId) {
  const now = new Date();
  const mondayOfWeek = getMondayOfWeek(now);
  return {
    ...DEFAULT_CLASS_PROGRESS,
    classId,
    listId,
    programStartDate: mondayOfWeek,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Create a session summary object
 * @param {Object} params - Session parameters
 * @param {number} params.day - Study day number
 * @param {number|null} [params.newWordScore] - Score on new word test (0-1)
 * @param {number|null} [params.reviewScore] - Score on review test (0-1)
 * @param {number} [params.segmentStartIndex] - Start of review segment
 * @param {number} [params.segmentEndIndex] - End of review segment
 * @param {number} [params.wordsIntroduced] - New words introduced this session
 * @param {number} [params.wordsReviewed] - Words in review queue
 * @param {number} [params.wordsTested] - Total words tested
 * @returns {Object} Session summary object
 */
export function createSessionSummary({
  day,
  newWordScore = null,
  reviewScore = null,
  segmentStartIndex = 0,
  segmentEndIndex = 0,
  wordsIntroduced = 0,
  wordsReviewed = 0,
  wordsTested = 0
}) {
  return {
    day,
    date: new Date(),
    newWordScore,
    reviewScore,
    segmentStartIndex,
    segmentEndIndex,
    wordsIntroduced,
    wordsReviewed,
    wordsTested
  };
}

/**
 * Maximum number of sessions to keep in recentSessions
 */
export const MAX_RECENT_SESSIONS = 10;

