import { useState, useCallback, useRef, useEffect, createContext, useContext } from 'react'
import {
  STUDENT_PROFILES,
  SIMULATION_SPEEDS,
  SIM_PHASES,
  generateTestScore,
  shouldDismissWord,
  calculateExpectedIntervention,
  calculateExpectedPace,
  EXPECTATIONS
} from '../utils/simulationConfig'
import { dateProvider } from '../utils/dateProvider'
import { useSimulationLog } from './useSimulationLog'

// Check if simulation mode is enabled
export const isSimulationEnabled = () => import.meta.env.VITE_SIMULATION_MODE === 'true'

/**
 * Simulation Context for sharing state across components
 */
const SimulationContext = createContext(null)

export function useSimulationContext() {
  return useContext(SimulationContext)
}

/**
 * Main simulation hook
 */
export function useSimulation() {
  // Simulation state
  const [phase, setPhase] = useState(SIM_PHASES.IDLE)
  const [profile, setProfile] = useState(STUDENT_PROFILES.CASEY)
  const [speed, setSpeed] = useState(SIMULATION_SPEEDS.FAST)
  const [autoAdvance, setAutoAdvance] = useState(false)
  const [currentDay, setCurrentDay] = useState(0)
  const [isAutoMode, setIsAutoMode] = useState(false)
  const [isFullSimulation, setIsFullSimulation] = useState(false)
  const [sessionTarget, setSessionTarget] = useState(null) // { classId, listId }

  // Navigation ref (set by SimulationPanel)
  const navigateRef = useRef(null)

  // Real-time state display
  const [liveStats, setLiveStats] = useState({
    dayNumber: 0,
    phase: 'idle',
    cardsStudied: 0,
    cardsTotal: 0,
    interventionLevel: 0,
    adjustedPace: EXPECTATIONS.DEFAULT_DAILY_PACE,
    recentScores: [],
    wordCounts: {
      NEW: 0,
      NEVER_TESTED: 0,
      PASSED: 0,
      FAILED: 0,
      MASTERED: 0,
      NEEDS_CHECK: 0
    }
  })

  // Logging
  const log = useSimulationLog()

  // Refs for callbacks
  const autoSwipeTimerRef = useRef(null)
  const autoAnswerTimerRef = useRef(null)
  const onCardSwipeRef = useRef(null)
  const onTestAnswerRef = useRef(null)
  const onSessionCompleteRef = useRef(null)

  /**
   * Update live stats
   */
  const updateLiveStats = useCallback((updates) => {
    setLiveStats(prev => ({ ...prev, ...updates }))
  }, [])

  /**
   * Start simulation
   */
  const startSimulation = useCallback(() => {
    setPhase(SIM_PHASES.RUNNING)
    log.clearLogs()
    setCurrentDay(1)
    log.startDay(1)
    updateLiveStats({ dayNumber: 1, phase: 'starting' })
  }, [log, updateLiveStats])

  /**
   * Start FULL simulation - enables auto-mode and navigates to session
   */
  const startFullSimulation = useCallback((classId, listId) => {
    // Set up simulation state
    setPhase(SIM_PHASES.RUNNING)
    setIsAutoMode(true)
    setIsFullSimulation(true)
    setSessionTarget({ classId, listId })
    log.clearLogs()
    setCurrentDay(1)
    log.startDay(1)
    updateLiveStats({ dayNumber: 1, phase: 'starting' })

    // Navigate to session
    if (navigateRef.current) {
      navigateRef.current(`/session/${classId}/${listId}`)
    }
  }, [log, updateLiveStats])

  /**
   * Called when session completes - restart if in full simulation mode
   */
  const onSessionComplete = useCallback(() => {
    if (!isFullSimulation || !sessionTarget) return

    // Advance the simulated date so next session calculates correct day
    dateProvider.advanceDays(1)

    // Advance day counter
    const nextDay = currentDay + 1
    setCurrentDay(nextDay)
    log.startDay(nextDay)
    updateLiveStats({ dayNumber: nextDay, phase: 'restarting' })

    // Navigate back to session after short delay
    setTimeout(() => {
      if (navigateRef.current && sessionTarget) {
        navigateRef.current(`/session/${sessionTarget.classId}/${sessionTarget.listId}`)
      }
    }, 500)
  }, [isFullSimulation, sessionTarget, currentDay, log, updateLiveStats])

  /**
   * Set navigate function (called from SimulationPanel)
   */
  const setNavigate = useCallback((nav) => {
    navigateRef.current = nav
  }, [])

  /**
   * Pause simulation
   */
  const pauseSimulation = useCallback(() => {
    setPhase(SIM_PHASES.PAUSED)
    clearTimeout(autoSwipeTimerRef.current)
    clearTimeout(autoAnswerTimerRef.current)
  }, [])

  /**
   * Resume simulation
   */
  const resumeSimulation = useCallback(() => {
    setPhase(SIM_PHASES.RUNNING)
  }, [])

  /**
   * Stop simulation
   */
  const stopSimulation = useCallback(() => {
    setPhase(SIM_PHASES.IDLE)
    clearTimeout(autoSwipeTimerRef.current)
    clearTimeout(autoAnswerTimerRef.current)
    setIsAutoMode(false)
    setIsFullSimulation(false)
    setSessionTarget(null)
  }, [])

  /**
   * Reset simulation
   */
  const resetSimulation = useCallback(() => {
    stopSimulation()
    log.clearLogs()
    dateProvider.reset()
    setCurrentDay(0)
    setLiveStats({
      dayNumber: 0,
      phase: 'idle',
      cardsStudied: 0,
      cardsTotal: 0,
      interventionLevel: 0,
      adjustedPace: EXPECTATIONS.DEFAULT_DAILY_PACE,
      recentScores: [],
      wordCounts: {
        NEW: 0,
        NEVER_TESTED: 0,
        PASSED: 0,
        FAILED: 0,
        MASTERED: 0,
        NEEDS_CHECK: 0
      }
    })
  }, [stopSimulation, log])

  /**
   * Advance to next day
   */
  const advanceDay = useCallback(() => {
    const nextDay = currentDay + 1
    setCurrentDay(nextDay)
    log.startDay(nextDay)
    updateLiveStats({ dayNumber: nextDay })
  }, [currentDay, log, updateLiveStats])

  /**
   * Advance time by days (for 21-day test)
   */
  const advanceTime = useCallback((days) => {
    dateProvider.advanceDays(days)
    log.logEvent('TIME_ADVANCE', { days, newDate: dateProvider.getDate().toISOString() })
  }, [log])

  /**
   * Get auto-answer for a test question based on profile accuracy
   */
  const getAutoAnswer = useCallback((correctIndex, optionsCount) => {
    // Generate score check
    const { score } = generateTestScore(profile, 1)

    if (score >= 0.5) {
      // Answer correctly
      return correctIndex
    } else {
      // Answer incorrectly - pick a random wrong answer
      let wrongIndex
      do {
        wrongIndex = Math.floor(Math.random() * optionsCount)
      } while (wrongIndex === correctIndex)
      return wrongIndex
    }
  }, [profile])

  /**
   * Check if a word should be dismissed
   */
  const shouldDismiss = useCallback(() => {
    return shouldDismissWord(profile)
  }, [profile])

  /**
   * Register auto-swipe callback
   */
  const registerAutoSwipe = useCallback((callback) => {
    onCardSwipeRef.current = callback
  }, [])

  /**
   * Register auto-answer callback
   */
  const registerAutoAnswer = useCallback((callback) => {
    onTestAnswerRef.current = callback
  }, [])

  /**
   * Trigger auto-swipe for flashcards
   */
  const triggerAutoSwipe = useCallback(() => {
    if (phase !== SIM_PHASES.RUNNING || !isAutoMode) return

    const delay = speed.cardDelay
    autoSwipeTimerRef.current = setTimeout(() => {
      if (onCardSwipeRef.current) {
        const dismiss = shouldDismiss()
        onCardSwipeRef.current(dismiss)
        log.incrementCardsStudied()
        // Continue auto-swiping
        triggerAutoSwipe()
      }
    }, delay)
  }, [phase, isAutoMode, speed, shouldDismiss, log])

  /**
   * Trigger auto-answer for tests
   */
  const triggerAutoAnswer = useCallback((questionIndex, correctIndex, optionsCount, totalQuestions) => {
    if (phase !== SIM_PHASES.RUNNING || !isAutoMode) return

    const delay = speed.testDelay
    autoAnswerTimerRef.current = setTimeout(() => {
      if (onTestAnswerRef.current) {
        const selectedIndex = getAutoAnswer(correctIndex, optionsCount)
        onTestAnswerRef.current(questionIndex, selectedIndex)
      }
    }, delay)
  }, [phase, isAutoMode, speed, getAutoAnswer])

  /**
   * Toggle auto mode
   */
  const toggleAutoMode = useCallback(() => {
    setIsAutoMode(prev => !prev)
  }, [])

  /**
   * Validate expectation
   */
  const validateExpectation = useCallback((name, expected, actual, tolerance = 0.05) => {
    const diff = Math.abs(expected - actual)
    const passed = diff <= tolerance * Math.max(expected, 1)

    if (!passed) {
      log.logMismatch(expected, actual, { check: name, tolerance })
    }

    return passed
  }, [log])

  /**
   * Complete current day
   */
  const completeCurrentDay = useCallback((extraData = {}) => {
    const summary = log.completeDay(currentDay, extraData)

    // Record word pool snapshot
    log.recordWordPoolSnapshot(
      currentDay,
      liveStats.wordCounts,
      liveStats.interventionLevel
    )

    if (autoAdvance) {
      advanceDay()
    }

    return summary
  }, [currentDay, log, liveStats, autoAdvance, advanceDay])

  /**
   * Handle session phase change
   */
  const onPhaseChange = useCallback((newPhase, data = {}) => {
    log.logPhaseTransition(liveStats.phase, newPhase, currentDay)
    updateLiveStats({ phase: newPhase, ...data })
  }, [log, liveStats.phase, currentDay, updateLiveStats])

  /**
   * Handle test completion
   */
  const onTestComplete = useCallback((testType, score, passed, attemptNumber) => {
    log.logTestAttempt(testType, score, passed, attemptNumber)

    if (testType === 'review') {
      log.setReviewScore(score)

      // Update recent scores
      const newScores = [...liveStats.recentScores, score].slice(-3)
      updateLiveStats({ recentScores: newScores })

      // Calculate expected intervention
      const expectedIntervention = calculateExpectedIntervention(newScores)
      const expectedPace = calculateExpectedPace(EXPECTATIONS.DEFAULT_DAILY_PACE, expectedIntervention)

      updateLiveStats({
        interventionLevel: expectedIntervention,
        adjustedPace: expectedPace
      })
    }
  }, [log, liveStats.recentScores, updateLiveStats])

  /**
   * Handle graduation
   */
  const onGraduation = useCallback((graduatedCount, totalEligible, score) => {
    log.logGraduation(graduatedCount, totalEligible, score)
  }, [log])

  /**
   * Update word counts
   */
  const updateWordCounts = useCallback((counts) => {
    updateLiveStats({ wordCounts: counts })
  }, [updateLiveStats])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(autoSwipeTimerRef.current)
      clearTimeout(autoAnswerTimerRef.current)
    }
  }, [])

  // Context value
  const contextValue = {
    // State
    isEnabled: isSimulationEnabled(),
    phase,
    profile,
    speed,
    currentDay,
    isAutoMode,
    autoAdvance,
    isFullSimulation,
    sessionTarget,
    liveStats,
    log,

    // State setters
    setProfile,
    setSpeed,
    setAutoAdvance,
    setNavigate,

    // Control functions
    startSimulation,
    startFullSimulation,
    pauseSimulation,
    resumeSimulation,
    stopSimulation,
    resetSimulation,
    advanceDay,
    advanceTime,
    toggleAutoMode,
    onSessionComplete,

    // Auto-mode functions
    getAutoAnswer,
    shouldDismiss,
    registerAutoSwipe,
    registerAutoAnswer,
    triggerAutoSwipe,
    triggerAutoAnswer,

    // Event handlers
    onPhaseChange,
    onTestComplete,
    onGraduation,
    updateWordCounts,
    updateLiveStats,
    completeCurrentDay,
    validateExpectation
  }

  return contextValue
}

/**
 * Simulation Provider component
 */
export function SimulationProvider({ children }) {
  const simulation = useSimulation()

  if (!isSimulationEnabled()) {
    return children
  }

  return (
    <SimulationContext.Provider value={simulation}>
      {children}
    </SimulationContext.Provider>
  )
}

export default useSimulation
