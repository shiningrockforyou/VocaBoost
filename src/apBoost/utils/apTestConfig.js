/**
 * AP Boost Subject Configurations
 */

export const AP_SUBJECTS = {
  AP_US_HISTORY: {
    id: 'AP_US_HISTORY',
    name: 'AP United States History',
    shortName: 'APUSH',
    color: '#1a365d', // Navy blue
  },
  AP_WORLD_HISTORY: {
    id: 'AP_WORLD_HISTORY',
    name: 'AP World History',
    shortName: 'World',
    color: '#2d3748', // Dark gray
  },
  AP_EURO_HISTORY: {
    id: 'AP_EURO_HISTORY',
    name: 'AP European History',
    shortName: 'Euro',
    color: '#4a5568', // Gray
  },
  AP_LANG: {
    id: 'AP_LANG',
    name: 'AP English Language',
    shortName: 'Lang',
    color: '#2b6cb0', // Blue
  },
  AP_LIT: {
    id: 'AP_LIT',
    name: 'AP English Literature',
    shortName: 'Lit',
    color: '#3182ce', // Light blue
  },
  AP_GOV: {
    id: 'AP_GOV',
    name: 'AP Government',
    shortName: 'Gov',
    color: '#c53030', // Red
  },
  AP_PSYCH: {
    id: 'AP_PSYCH',
    name: 'AP Psychology',
    shortName: 'Psych',
    color: '#805ad5', // Purple
  },
  AP_BIO: {
    id: 'AP_BIO',
    name: 'AP Biology',
    shortName: 'Bio',
    color: '#38a169', // Green
  },
  AP_CHEM: {
    id: 'AP_CHEM',
    name: 'AP Chemistry',
    shortName: 'Chem',
    color: '#d69e2e', // Yellow
  },
  AP_PHYSICS: {
    id: 'AP_PHYSICS',
    name: 'AP Physics',
    shortName: 'Physics',
    color: '#00b5d8', // Cyan
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
