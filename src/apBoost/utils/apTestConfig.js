/**
 * AP Boost Subject Configurations
 */

export const AP_SUBJECTS = {
  AP_US_HISTORY: {
    id: 'AP_US_HISTORY',
    name: 'AP United States History',
    shortName: 'APUSH',
    color: '#1a365d',
    defaultTimeLimits: { mcq: 55, frq: 100 },
  },
  AP_WORLD_HISTORY: {
    id: 'AP_WORLD_HISTORY',
    name: 'AP World History',
    shortName: 'World',
    color: '#2d3748',
    defaultTimeLimits: { mcq: 55, frq: 100 },
  },
  AP_EURO_HISTORY: {
    id: 'AP_EURO_HISTORY',
    name: 'AP European History',
    shortName: 'Euro',
    color: '#4a5568',
    defaultTimeLimits: { mcq: 55, frq: 100 },
  },
  AP_LANG: {
    id: 'AP_LANG',
    name: 'AP English Language',
    shortName: 'Lang',
    color: '#2b6cb0',
    defaultTimeLimits: { mcq: 60, frq: 135 },
  },
  AP_LIT: {
    id: 'AP_LIT',
    name: 'AP English Literature',
    shortName: 'Lit',
    color: '#3182ce',
    defaultTimeLimits: { mcq: 60, frq: 120 },
  },
  AP_GOV: {
    id: 'AP_GOV',
    name: 'AP Government',
    shortName: 'Gov',
    color: '#c53030',
    defaultTimeLimits: { mcq: 80, frq: 100 },
  },
  AP_PSYCH: {
    id: 'AP_PSYCH',
    name: 'AP Psychology',
    shortName: 'Psych',
    color: '#805ad5',
    defaultTimeLimits: { mcq: 70, frq: 50 },
  },
  AP_BIO: {
    id: 'AP_BIO',
    name: 'AP Biology',
    shortName: 'Bio',
    color: '#38a169',
    defaultTimeLimits: { mcq: 90, frq: 90 },
  },
  AP_CHEM: {
    id: 'AP_CHEM',
    name: 'AP Chemistry',
    shortName: 'Chem',
    color: '#d69e2e',
    defaultTimeLimits: { mcq: 90, frq: 105 },
  },
  AP_PHYSICS: {
    id: 'AP_PHYSICS',
    name: 'AP Physics',
    shortName: 'Physics',
    color: '#00b5d8',
    defaultTimeLimits: { mcq: 90, frq: 90 },
  },
  AP_MICRO: {
    id: 'AP_MICRO',
    name: 'AP Microeconomics',
    shortName: 'Micro',
    color: '#2f855a',
    defaultTimeLimits: { mcq: 70, frq: 60 },
  },
  AP_MACRO: {
    id: 'AP_MACRO',
    name: 'AP Macroeconomics',
    shortName: 'Macro',
    color: '#276749',
    defaultTimeLimits: { mcq: 70, frq: 60 },
  },
  AP_CALC_AB: {
    id: 'AP_CALC_AB',
    name: 'AP Calculus AB',
    shortName: 'Calc AB',
    color: '#744210',
    defaultTimeLimits: { mcq: 105, frq: 90 },
  },
  AP_CALC_BC: {
    id: 'AP_CALC_BC',
    name: 'AP Calculus BC',
    shortName: 'Calc BC',
    color: '#975a16',
    defaultTimeLimits: { mcq: 105, frq: 90 },
  },
}

/**
 * Section type configuration
 */
export const SECTION_TYPE_CONFIG = {
  MCQ: {
    label: 'Multiple Choice',
    defaultQuestionCount: 55,
    allowCalculator: false,
    hasStimuli: true,
  },
  MCQ_CALC: {
    label: 'Multiple Choice (Calculator)',
    defaultQuestionCount: 30,
    allowCalculator: true,
    hasStimuli: true,
  },
  FRQ: {
    label: 'Free Response',
    defaultQuestionCount: 4,
    allowCalculator: false,
    hasStimuli: true,
  },
  FRQ_CALC: {
    label: 'Free Response (Calculator)',
    defaultQuestionCount: 2,
    allowCalculator: true,
    hasStimuli: true,
  },
  SAQ: {
    label: 'Short Answer',
    defaultQuestionCount: 4,
    allowCalculator: false,
    hasStimuli: false,
  },
  DBQ: {
    label: 'Document-Based Question',
    defaultQuestionCount: 1,
    allowCalculator: false,
    hasStimuli: true,
  },
}

/**
 * Get subject config by ID
 */
export function getSubjectConfig(subjectId) {
  return AP_SUBJECTS[subjectId] || {
    id: subjectId,
    name: subjectId,
    shortName: subjectId.slice(0, 6),
    color: '#718096',
    defaultTimeLimits: { mcq: 45, frq: 45 },
  }
}

/**
 * Get all subjects as array
 */
export function getAllSubjects() {
  return Object.values(AP_SUBJECTS)
}

/**
 * Format time in minutes to display string
 */
export function formatTimeMinutes(minutes) {
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) {
    return `${hours} hr`
  }
  return `${hours} hr ${mins} min`
}

/**
 * Format seconds to MM:SS display
 */
export function formatTimeSeconds(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Calculate total test time from sections
 */
export function calculateTotalTime(sections) {
  return sections.reduce((total, section) => total + (section.timeLimit || 0), 0)
}
