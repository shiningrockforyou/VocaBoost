/**
 * AP Boost Type Constants
 */

// Question Types
export const QUESTION_TYPE = {
  MCQ: 'MCQ',
  MCQ_MULTI: 'MCQ_MULTI',
  FRQ: 'FRQ',
  SAQ: 'SAQ',
  DBQ: 'DBQ',
}

// Question Display Format
export const QUESTION_FORMAT = {
  VERTICAL: 'VERTICAL',     // Single column, no stimulus
  HORIZONTAL: 'HORIZONTAL', // Two columns with stimulus
}

// Test Types
export const TEST_TYPE = {
  EXAM: 'EXAM',     // Full test
  MODULE: 'MODULE', // Practice module (1-2 sections)
}

// Section Types
export const SECTION_TYPE = {
  MCQ: 'MCQ',
  FRQ: 'FRQ',
  MIXED: 'MIXED',
}

// Session Status
export const SESSION_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
}

// Grading Status
export const GRADING_STATUS = {
  NOT_NEEDED: 'NOT_NEEDED',
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETE: 'COMPLETE',
}

// FRQ Submission Type
export const FRQ_SUBMISSION_TYPE = {
  TYPED: 'TYPED',
  HANDWRITTEN: 'HANDWRITTEN',
}

// Stimulus Types
export const STIMULUS_TYPE = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  PASSAGE: 'PASSAGE',
  DOCUMENT: 'DOCUMENT',
  CHART: 'CHART',
}

// Question Order
export const QUESTION_ORDER = {
  FIXED: 'FIXED',
  RANDOMIZED: 'RANDOMIZED',
}

// Difficulty Levels
export const DIFFICULTY = {
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
}

// Answer choice letters
export const CHOICE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

// Default score ranges for AP 1-5 conversion
export const DEFAULT_SCORE_RANGES = {
  ap5: { min: 80, max: 100 },
  ap4: { min: 65, max: 79 },
  ap3: { min: 50, max: 64 },
  ap2: { min: 35, max: 49 },
  ap1: { min: 0, max: 34 },
}

// Collection names
export const COLLECTIONS = {
  TESTS: 'ap_tests',
  QUESTIONS: 'ap_questions',
  STIMULI: 'ap_stimuli',
  SESSION_STATE: 'ap_session_state',
  TEST_RESULTS: 'ap_test_results',
  CLASSES: 'ap_classes',
  ASSIGNMENTS: 'ap_assignments',
}
