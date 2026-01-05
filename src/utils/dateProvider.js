/**
 * Date Provider - Abstraction layer for time control in simulation mode
 *
 * In production: Returns real Date.now()
 * In simulation: Can be overridden to "fast-forward" time
 */

let mockDate = null

export const dateProvider = {
  /**
   * Get current timestamp (milliseconds since epoch)
   * Returns mock date if set, otherwise real Date.now()
   */
  now: () => mockDate ?? Date.now(),

  /**
   * Get current Date object
   */
  getDate: () => new Date(mockDate ?? Date.now()),

  /**
   * Set a specific mock date
   * @param {Date|number|null} date - Date to set, or null to clear
   */
  setMockDate: (date) => {
    if (date === null) {
      mockDate = null
    } else if (date instanceof Date) {
      mockDate = date.getTime()
    } else if (typeof date === 'number') {
      mockDate = date
    }
  },

  /**
   * Advance the mock date by a number of days
   * If no mock date is set, starts from current time
   * @param {number} days - Number of days to advance
   */
  advanceDays: (days) => {
    const current = mockDate ?? Date.now()
    mockDate = current + (days * 24 * 60 * 60 * 1000)
  },

  /**
   * Advance the mock date by a number of hours
   * @param {number} hours - Number of hours to advance
   */
  advanceHours: (hours) => {
    const current = mockDate ?? Date.now()
    mockDate = current + (hours * 60 * 60 * 1000)
  },

  /**
   * Reset to real time (clear mock date)
   */
  reset: () => {
    mockDate = null
  },

  /**
   * Check if simulation time is active
   */
  isMocked: () => mockDate !== null,

  /**
   * Get the current mock date value (for debugging)
   */
  getMockValue: () => mockDate
}

export default dateProvider
