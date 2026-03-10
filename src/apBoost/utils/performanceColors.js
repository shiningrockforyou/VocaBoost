/**
 * Performance color utilities for analytics displays
 * Maps percentage scores to color codes for visual representation
 * Uses design tokens from index.css
 */

// Performance thresholds with corresponding design token colors
export const PERFORMANCE_THRESHOLDS = [
  { min: 85, color: 'bg-success', textColor: 'text-success-text-strong', label: 'Excellent' },
  { min: 70, color: 'bg-success', textColor: 'text-success-text', label: 'Good' },
  { min: 60, color: 'bg-warning', textColor: 'text-warning-text-strong', label: 'Satisfactory' },
  { min: 50, color: 'bg-warning', textColor: 'text-warning-text-strong', label: 'Needs Improvement' },
  { min: 0, color: 'bg-error', textColor: 'text-error-text', label: 'Critical' },
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
  return 'bg-error'
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
  return 'text-error-text'
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
    color: 'bg-error',
    textColor: 'text-error-text',
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
    5: 'bg-success',
    4: 'bg-success',
    3: 'bg-warning',
    2: 'bg-warning',
    1: 'bg-error',
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
    5: 'text-success-text-strong',
    4: 'text-success-text',
    3: 'text-warning-text-strong',
    2: 'text-warning-text-strong',
    1: 'text-error-text',
  }
  return colors[apScore] || 'text-text-primary'
}
