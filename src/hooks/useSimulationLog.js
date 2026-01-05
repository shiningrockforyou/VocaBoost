import { useState, useCallback, useRef } from 'react'
import { WORD_STATUSES } from '../utils/simulationConfig'

/**
 * Hook for tracking simulation events, generating summaries, and detecting issues
 */
export function useSimulationLog() {
  const [events, setEvents] = useState([])
  const [daySummaries, setDaySummaries] = useState([])
  const [issues, setIssues] = useState([])
  const [wordPoolHistory, setWordPoolHistory] = useState([])

  // Track current day's data
  const currentDayData = useRef({
    dayNumber: 0,
    cardsStudied: 0,
    testAttempts: [],
    reviewScore: null,
    graduated: 0,
    interventionLevel: 0,
    wordCounts: {}
  })

  /**
   * Log a simulation event
   */
  const logEvent = useCallback((type, data) => {
    const event = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      type,
      data
    }
    setEvents(prev => [...prev, event])
    return event
  }, [])

  /**
   * Log phase transition
   */
  const logPhaseTransition = useCallback((fromPhase, toPhase, dayNumber) => {
    logEvent('PHASE_TRANSITION', { fromPhase, toPhase, dayNumber })
  }, [logEvent])

  /**
   * Log test attempt
   */
  const logTestAttempt = useCallback((testType, score, passed, attemptNumber) => {
    const attempt = { testType, score, passed, attemptNumber }
    currentDayData.current.testAttempts.push(attempt)
    logEvent('TEST_ATTEMPT', attempt)
  }, [logEvent])

  /**
   * Log word status change
   */
  const logWordStatusChange = useCallback((wordId, fromStatus, toStatus) => {
    logEvent('WORD_STATUS_CHANGE', { wordId, fromStatus, toStatus })
  }, [logEvent])

  /**
   * Log graduation
   */
  const logGraduation = useCallback((graduatedCount, totalEligible, score) => {
    currentDayData.current.graduated = graduatedCount
    logEvent('GRADUATION', { graduatedCount, totalEligible, score })
  }, [logEvent])

  /**
   * Log intervention level change
   */
  const logInterventionChange = useCallback((previousLevel, newLevel, recentScores) => {
    currentDayData.current.interventionLevel = newLevel
    logEvent('INTERVENTION_CHANGE', { previousLevel, newLevel, recentScores })
  }, [logEvent])

  /**
   * Log error (simulation pauses)
   */
  const logError = useCallback((error, context) => {
    const issue = {
      id: Date.now(),
      type: 'ERROR',
      severity: 'error',
      message: error.message || String(error),
      stack: error.stack,
      context
    }
    setIssues(prev => [...prev, issue])
    logEvent('ERROR', issue)
    return issue
  }, [logEvent])

  /**
   * Log expectation mismatch (simulation continues)
   */
  const logMismatch = useCallback((expected, actual, context) => {
    const issue = {
      id: Date.now(),
      type: 'MISMATCH',
      severity: 'warning',
      expected,
      actual,
      context,
      message: `Expected ${expected}, got ${actual}`
    }
    setIssues(prev => [...prev, issue])
    logEvent('MISMATCH', issue)
    return issue
  }, [logEvent])

  /**
   * Record word pool snapshot
   */
  const recordWordPoolSnapshot = useCallback((dayNumber, wordCounts, interventionLevel) => {
    const snapshot = {
      day: dayNumber,
      timestamp: Date.now(),
      ...wordCounts,
      interventionLevel
    }
    setWordPoolHistory(prev => [...prev, snapshot])
    currentDayData.current.wordCounts = wordCounts
    logEvent('WORD_POOL_SNAPSHOT', snapshot)
  }, [logEvent])

  /**
   * Complete a day and generate summary
   */
  const completeDay = useCallback((dayNumber, extraData = {}) => {
    const data = currentDayData.current
    const summary = {
      dayNumber,
      cardsStudied: data.cardsStudied,
      testAttempts: [...data.testAttempts],
      reviewScore: data.reviewScore,
      graduated: data.graduated,
      interventionLevel: data.interventionLevel,
      wordCounts: { ...data.wordCounts },
      issues: issues.filter(i => i.context?.dayNumber === dayNumber),
      passed: data.testAttempts.length === 0 || data.testAttempts[data.testAttempts.length - 1]?.passed,
      ...extraData
    }

    setDaySummaries(prev => [...prev, summary])
    logEvent('DAY_COMPLETE', summary)

    // Reset for next day
    currentDayData.current = {
      dayNumber: dayNumber + 1,
      cardsStudied: 0,
      testAttempts: [],
      reviewScore: null,
      graduated: 0,
      interventionLevel: data.interventionLevel,
      wordCounts: {}
    }

    return summary
  }, [issues, logEvent])

  /**
   * Start a new day
   */
  const startDay = useCallback((dayNumber) => {
    currentDayData.current.dayNumber = dayNumber
    logEvent('DAY_START', { dayNumber })
  }, [logEvent])

  /**
   * Increment cards studied count
   */
  const incrementCardsStudied = useCallback((count = 1) => {
    currentDayData.current.cardsStudied += count
  }, [])

  /**
   * Set review score
   */
  const setReviewScore = useCallback((score) => {
    currentDayData.current.reviewScore = score
  }, [])

  /**
   * Generate final summary report
   */
  const generateSummary = useCallback((profileName) => {
    const errorCount = issues.filter(i => i.type === 'ERROR').length
    const mismatchCount = issues.filter(i => i.type === 'MISMATCH').length
    const totalChecks = daySummaries.length * 5 // Approximate checks per day

    return {
      profile: profileName,
      daysCompleted: daySummaries.length,
      totalEvents: events.length,
      issues: {
        errors: errorCount,
        mismatches: mismatchCount,
        total: issues.length
      },
      passRate: totalChecks > 0 ? ((totalChecks - issues.length) / totalChecks * 100).toFixed(1) : 100,
      daySummaries,
      wordPoolHistory,
      allIssues: issues
    }
  }, [daySummaries, events, issues, wordPoolHistory])

  /**
   * Export log as JSON
   */
  const exportLog = useCallback(() => {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      events,
      daySummaries,
      issues,
      wordPoolHistory
    }, null, 2)
  }, [events, daySummaries, issues, wordPoolHistory])

  /**
   * Export word pool history as CSV
   */
  const exportWordPoolCSV = useCallback((profileName) => {
    if (wordPoolHistory.length === 0) return ''

    const headers = ['day', 'profile', 'NEW', 'NEVER_TESTED', 'PASSED', 'FAILED', 'MASTERED', 'NEEDS_CHECK', 'intervention']
    const rows = wordPoolHistory.map(snapshot => [
      snapshot.day,
      profileName,
      snapshot[WORD_STATUSES.NEW] || 0,
      snapshot[WORD_STATUSES.NEVER_TESTED] || 0,
      snapshot[WORD_STATUSES.PASSED] || 0,
      snapshot[WORD_STATUSES.FAILED] || 0,
      snapshot[WORD_STATUSES.MASTERED] || 0,
      snapshot[WORD_STATUSES.NEEDS_CHECK] || 0,
      Math.round((snapshot.interventionLevel || 0) * 100)
    ])

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  }, [wordPoolHistory])

  /**
   * Clear all logs
   */
  const clearLogs = useCallback(() => {
    setEvents([])
    setDaySummaries([])
    setIssues([])
    setWordPoolHistory([])
    currentDayData.current = {
      dayNumber: 0,
      cardsStudied: 0,
      testAttempts: [],
      reviewScore: null,
      graduated: 0,
      interventionLevel: 0,
      wordCounts: {}
    }
  }, [])

  return {
    // State
    events,
    daySummaries,
    issues,
    wordPoolHistory,
    hasErrors: issues.some(i => i.type === 'ERROR'),
    hasMismatches: issues.some(i => i.type === 'MISMATCH'),

    // Logging functions
    logEvent,
    logPhaseTransition,
    logTestAttempt,
    logWordStatusChange,
    logGraduation,
    logInterventionChange,
    logError,
    logMismatch,
    recordWordPoolSnapshot,

    // Day management
    startDay,
    completeDay,
    incrementCardsStudied,
    setReviewScore,

    // Export functions
    generateSummary,
    exportLog,
    exportWordPoolCSV,
    clearLogs
  }
}

export default useSimulationLog
