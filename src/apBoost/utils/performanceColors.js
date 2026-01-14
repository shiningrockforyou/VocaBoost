/**
 * Performance color utilities for analytics displays
 * Maps percentage scores to color codes for visual representation
 */

// Performance thresholds with corresponding Tailwind colors
export const PERFORMANCE_THRESHOLDS = [
  { min: 85, color: 'bg-green-500', textColor: 'text-green-500', label: 'Excellent' },
  { min: 70, color: 'bg-lime-400', textColor: 'text-lime-500', label: 'Good' },
  { min: 60, color: 'bg-yellow-400', textColor: 'text-yellow-500', label: 'Satisfactory' },
  { min: 50, color: 'bg-orange-400', textColor: 'text-orange-500', label: 'Needs Improvement' },
  { min: 0, color: 'bg-red-500', textColor: 'text-red-500', label: 'Critical' },
]

/**
 * Get background color class for a percentage
 * @param {number} percentage - Score percentage (0-100)
 * @returns {string} Tailwind background color class
 */
export function getPerformanceColor(percentage) {
  for (const threshold of PERFORMANCE_THRESHOLDS) {
    if (percentage >= threshold.min) {
      return threshold.color
    }
  }
  return 'bg-red-500'
}

/**
 * Get text color class for a percentage
 * @param {number} percentage - Score percentage (0-100)
 * @returns {string} Tailwind text color class
 */
export function getPerformanceTextColor(percentage) {
  for (const threshold of PERFORMANCE_THRESHOLDS) {
    if (percentage >= threshold.min) {
      return threshold.textColor
    }
  }
  return 'text-red-500'
}

/**
 * Get performance label for a percentage
 * @param {number} percentage - Score percentage (0-100)
 * @returns {string} Performance label
 */
export function getPerformanceLabel(percentage) {
  for (const threshold of PERFORMANCE_THRESHOLDS) {
    if (percentage >= threshold.min) {
      return threshold.label
    }
  }
  return 'Critical'
}

/**
 * Get full performance info for a percentage
 * @param {number} percentage - Score percentage (0-100)
 * @returns {Object} { color, textColor, label }
 */
export function getPerformanceInfo(percentage) {
  for (const threshold of PERFORMANCE_THRESHOLDS) {
    if (percentage >= threshold.min) {
      return {
        color: threshold.color,
        textColor: threshold.textColor,
        label: threshold.label,
      }
    }
  }
  return {
    color: 'bg-red-500',
    textColor: 'text-red-500',
    label: 'Critical',
  }
}

/**
 * AP Score color mapping
 * @param {number} apScore - AP score (1-5)
 * @returns {string} Tailwind background color class
 */
export function getAPScoreColor(apScore) {
  const colors = {
    5: 'bg-green-500',
    4: 'bg-lime-400',
    3: 'bg-yellow-400',
    2: 'bg-orange-400',
    1: 'bg-red-500',
  }
  return colors[apScore] || 'bg-muted'
}

/**
 * Get AP Score text color
 * @param {number} apScore - AP score (1-5)
 * @returns {string} Tailwind text color class
 */
export function getAPScoreTextColor(apScore) {
  const colors = {
    5: 'text-white',
    4: 'text-gray-900',
    3: 'text-gray-900',
    2: 'text-white',
    1: 'text-white',
  }
  return colors[apScore] || 'text-text-primary'
}
