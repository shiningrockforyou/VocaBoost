import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getTestWithQuestions, getQuestion, canAccessTest } from '../services/apTestService'
import {
  createOrResumeSession,
  getActiveSession,
  saveAnswer as saveAnswerToFirestore,
  toggleQuestionFlag,
  updatePosition,
  updateTimer,
  updateSession,
} from '../services/apSessionService'
import { createTestResult } from '../services/apScoringService'
import { useTimer } from './useTimer'
import { useOfflineQueue } from './useOfflineQueue'
import { useHeartbeat } from './useHeartbeat'
import { useDuplicateTabGuard } from './useDuplicateTabGuard'
import { SESSION_STATUS, QUESTION_TYPE } from '../utils/apTypes'
import { logError } from '../utils/logError'

/**
 * useTestSession - Core session state management hook
 * Handles test loading, session management, answers, navigation, timer, and resilience
 */
export function useTestSession(testId, assignmentId = null) {
  const { user } = useAuth()

  // Core state
  const [session, setSession] = useState(null)
  const [test, setTest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Submission retry state
  const [submitError, setSubmitError] = useState(null)
  const [isSubmitTimedOut, setIsSubmitTimedOut] = useState(false)
  const submitStartTimeRef = useRef(null)
  const pendingFrqDataRef = useRef(null)

  // Position state
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [currentSubQuestionLabel, setCurrentSubQuestionLabel] = useState(null) // For FRQ sub-questions

  // Answers state (Map for fast lookup)
  const [answers, setAnswers] = useState(new Map())

  // Flags state (Set for fast lookup)
  const [flags, setFlags] = useState(new Set())

  // Debounce ref for answer saving
  const saveTimeoutRef = useRef(null)
  const timerSaveRef = useRef(null)

  // Auto-submit state (for timer expiry)
  const autoSubmitTriggeredRef = useRef(false)
  const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false)
  const [autoSubmitResultId, setAutoSubmitResultId] = useState(null)

  // Ref to hold submit functions (avoids circular dependency with timer)
  const submitFunctionsRef = useRef({ submitTest: null, submitSection: null })

  // Resilience hooks
  const { addToQueue, flushQueue, queueLength, isOnline, isFlushing, getPendingItems, deleteItems } = useOfflineQueue(session?.id)
  const { instanceToken, isInvalidated, takeControl } = useDuplicateTabGuard(session?.id)
  const { isConnected, failureCount, sessionTakenOver } = useHeartbeat(session?.id, instanceToken)

  // Combined invalidation check
  const isSessionInvalidated = isInvalidated || sessionTakenOver

  // Current section and question
  const currentSection = useMemo(() => {
    return test?.sections?.[currentSectionIndex] || null
  }, [test, currentSectionIndex])

  const currentQuestion = useMemo(() => {
    if (!currentSection?.questionIds || !test?.questions) return null
    const questionId = currentSection.questionIds[currentQuestionIndex]
    return test.questions[questionId] || null
  }, [currentSection, currentQuestionIndex, test])

  // Position object
  const position = useMemo(() => ({
    sectionIndex: currentSectionIndex,
    questionIndex: currentQuestionIndex,
    questionId: currentSection?.questionIds?.[currentQuestionIndex] || null,
    subQuestionLabel: currentSubQuestionLabel, // null for MCQ
  }), [currentSectionIndex, currentQuestionIndex, currentSection, currentSubQuestionLabel])

  // Check if current question is FRQ type
  const isFRQQuestion = useMemo(() => {
    if (!currentQuestion) return false
    const frqTypes = [QUESTION_TYPE.FRQ, QUESTION_TYPE.SAQ, QUESTION_TYPE.DBQ]
    return frqTypes.includes(currentQuestion.questionType)
  }, [currentQuestion])

  // Compute flat navigation items for the section (handles FRQ sub-questions)
  const flatNavigationItems = useMemo(() => {
    if (!currentSection?.questionIds || !test?.questions) return []

    const items = []
    currentSection.questionIds.forEach((qId, qIdx) => {
      const question = test.questions[qId]
      if (!question) return

      const frqTypes = [QUESTION_TYPE.FRQ, QUESTION_TYPE.SAQ, QUESTION_TYPE.DBQ]
      const isFRQ = frqTypes.includes(question.questionType)

      if (isFRQ && question.subQuestions?.length > 0) {
        // Add each sub-question as separate item
        question.subQuestions.forEach((sq) => {
          items.push({
            questionId: qId,
            questionIndex: qIdx,
            subQuestionLabel: sq.label,
            displayLabel: `${qIdx + 1}${sq.label}`, // e.g., "1a", "1b"
          })
        })
      } else {
        // MCQ or FRQ without sub-questions
        items.push({
          questionId: qId,
          questionIndex: qIdx,
          subQuestionLabel: null,
          displayLabel: `${qIdx + 1}`,
        })
      }
    })
    return items
  }, [currentSection, test])

  // Current flat index (for navigator)
  const currentFlatIndex = useMemo(() => {
    return flatNavigationItems.findIndex(item =>
      item.questionIndex === currentQuestionIndex &&
      item.subQuestionLabel === currentSubQuestionLabel
    )
  }, [flatNavigationItems, currentQuestionIndex, currentSubQuestionLabel])

  // Timer setup
  const initialTime = useMemo(() => {
    if (!currentSection) return 0
    // Check if we have saved time remaining
    const savedTime = session?.sectionTimeRemaining?.[currentSection.id]
    if (savedTime != null) return savedTime
    // Otherwise use section time limit (minutes to seconds)
    return (currentSection.timeLimit || 45) * 60
  }, [currentSection, session])

  const handleTimerExpire = useCallback(async () => {
    // Single-flight guard - prevent race with manual submit
    if (isSubmitting || autoSubmitTriggeredRef.current) return
    autoSubmitTriggeredRef.current = true
    setAutoSubmitTriggered(true)

    console.log('Timer expired, auto-submitting...')

    const isLastSection = currentSectionIndex >= (test?.sections?.length || 1) - 1

    // Queue AUTO_SUBMIT action for offline persistence
    addToQueue({
      action: 'AUTO_SUBMIT',
      payload: {
        isLastSection,
        sectionIndex: currentSectionIndex,
        expiredAt: Date.now()
      }
    })

    // If online, submit immediately
    if (isOnline) {
      if (isLastSection) {
        const resultId = await submitFunctionsRef.current.submitTest?.()
        if (resultId) {
          setAutoSubmitResultId(resultId)
        }
      } else {
        await submitFunctionsRef.current.submitSection?.()
      }
    }
    // If offline, the AUTO_SUBMIT action will be processed on reconnect
  }, [isSubmitting, currentSectionIndex, test?.sections?.length, isOnline, addToQueue])

  const handleTimerTick = useCallback((newTime) => {
    // Save timer every 30 seconds via queue
    if (session?.id && currentSection?.id && newTime % 30 === 0) {
      addToQueue({
        action: 'TIMER_SYNC',
        payload: { sectionTimeRemaining: { [currentSection.id]: newTime } }
      })
    }
  }, [session?.id, currentSection?.id, addToQueue])

  const timer = useTimer({
    initialTime,
    onExpire: handleTimerExpire,
    onTick: handleTimerTick,
    isPaused: false,
  })

  // Load test and session on mount
  useEffect(() => {
    async function loadTestAndSession() {
      if (!testId || !user) return

      try {
        setLoading(true)
        setError(null)

        // Verify user has access to this test before loading content
        const access = await canAccessTest(testId, user.uid)
        if (!access.allowed) {
          setError('You are not authorized to access this test')
          setLoading(false)
          return
        }

        // Load test with questions
        const testData = await getTestWithQuestions(testId)
        if (!testData) {
          throw new Error('Test not found')
        }
        setTest(testData)

        // Check for existing session
        const existingSession = await getActiveSession(testId, user.uid)
        if (existingSession) {
          setSession(existingSession)

          // Restore state from session
          setCurrentSectionIndex(existingSession.currentSectionIndex || 0)
          setCurrentQuestionIndex(existingSession.currentQuestionIndex || 0)

          // Restore answers
          const answersMap = new Map()
          if (existingSession.answers) {
            Object.entries(existingSession.answers).forEach(([qId, ans]) => {
              answersMap.set(qId, ans)
            })
          }
          setAnswers(answersMap)

          // Restore flags
          const flagsSet = new Set(existingSession.flaggedQuestions || [])
          setFlags(flagsSet)

          // Check for pause marker (indicates tab was closed mid-session)
          // Apply PAUSED status if marker exists and session isn't completed
          try {
            const pauseMarker = localStorage.getItem(`ap_session_pause_${existingSession.id}`)
            if (pauseMarker && existingSession.status !== SESSION_STATUS.COMPLETED) {
              // Update session status to PAUSED (best effort)
              await updateSession(existingSession.id, {
                status: SESSION_STATUS.PAUSED,
                pausedAt: new Date(Number(pauseMarker))
              })
              // Clear the marker after applying
              localStorage.removeItem(`ap_session_pause_${existingSession.id}`)
            }
          } catch (e) {
            // Non-critical - don't fail session load if pause marker handling fails
            console.warn('Failed to process pause marker:', e)
          }

          // Set session back to IN_PROGRESS on resume (user is actively viewing)
          if (existingSession.status === SESSION_STATUS.PAUSED) {
            try {
              await updateSession(existingSession.id, {
                status: SESSION_STATUS.IN_PROGRESS
              })
            } catch (e) {
              console.warn('Failed to update session status to IN_PROGRESS:', e)
            }
          }
        }
      } catch (err) {
        logError('useTestSession.loadTestAndSession', { testId, userId: user?.uid }, err)
        setError(err.message || 'Failed to load test')
      } finally {
        setLoading(false)
      }
    }

    loadTestAndSession()
  }, [testId, user])

  // beforeunload handler - warn if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (queueLength > 0) {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [queueLength])

  // Start test
  const startTest = useCallback(async () => {
    if (!user || !testId) return

    try {
      setLoading(true)
      const newSession = await createOrResumeSession(testId, user.uid, assignmentId)
      setSession(newSession)

      // Start timer
      timer.start()
    } catch (err) {
      logError('useTestSession.startTest', { testId, userId: user?.uid, assignmentId }, err)
      setError(err.message || 'Failed to start test')
    } finally {
      setLoading(false)
    }
  }, [user, testId, assignmentId, timer])

  // Navigation - go to specific flat index (handles sub-questions)
  const goToFlatIndex = useCallback((flatIndex) => {
    if (flatIndex < 0 || flatIndex >= flatNavigationItems.length) return

    const item = flatNavigationItems[flatIndex]
    setCurrentQuestionIndex(item.questionIndex)
    setCurrentSubQuestionLabel(item.subQuestionLabel)

    // Queue position update
    if (session?.id) {
      addToQueue({
        action: 'NAVIGATION',
        payload: {
          currentSectionIndex,
          currentQuestionIndex: item.questionIndex,
          currentSubQuestionLabel: item.subQuestionLabel
        }
      })
    }
  }, [flatNavigationItems, currentSectionIndex, session?.id, addToQueue])

  // Navigation - go to question by question index (for MCQ, also initializes first sub-question for FRQ)
  const goToQuestion = useCallback((index) => {
    if (!currentSection?.questionIds) return
    if (index < 0 || index >= currentSection.questionIds.length) return

    const questionId = currentSection.questionIds[index]
    const question = test?.questions?.[questionId]

    setCurrentQuestionIndex(index)

    // For FRQ, set to first sub-question
    const frqTypes = [QUESTION_TYPE.FRQ, QUESTION_TYPE.SAQ, QUESTION_TYPE.DBQ]
    if (question && frqTypes.includes(question.questionType) && question.subQuestions?.length > 0) {
      setCurrentSubQuestionLabel(question.subQuestions[0].label)
    } else {
      setCurrentSubQuestionLabel(null)
    }

    // Queue position update
    if (session?.id) {
      addToQueue({
        action: 'NAVIGATION',
        payload: { currentSectionIndex, currentQuestionIndex: index }
      })
    }
  }, [currentSection, currentSectionIndex, session?.id, addToQueue, test])

  const goNext = useCallback(() => {
    const nextIndex = currentFlatIndex + 1
    if (nextIndex < flatNavigationItems.length) {
      goToFlatIndex(nextIndex)
    }
  }, [currentFlatIndex, flatNavigationItems.length, goToFlatIndex])

  const goPrevious = useCallback(() => {
    const prevIndex = currentFlatIndex - 1
    if (prevIndex >= 0) {
      goToFlatIndex(prevIndex)
    }
  }, [currentFlatIndex, goToFlatIndex])

  const canGoNext = useMemo(() => {
    return currentFlatIndex < flatNavigationItems.length - 1
  }, [currentFlatIndex, flatNavigationItems.length])

  const canGoPrevious = useMemo(() => {
    return currentFlatIndex > 0
  }, [currentFlatIndex])

  // Current answer - handles FRQ sub-question answers
  const currentAnswer = useMemo(() => {
    const questionId = position.questionId
    if (!questionId) return null

    const answer = answers.get(questionId)
    if (!answer) return null

    // For FRQ with sub-questions, answer is an object { a: "...", b: "...", c: "..." }
    if (isFRQQuestion && position.subQuestionLabel && typeof answer === 'object') {
      return answer[position.subQuestionLabel] || null
    }

    return answer
  }, [answers, position.questionId, position.subQuestionLabel, isFRQQuestion])

  // Set answer with queue - handles FRQ sub-question answers
  const setAnswer = useCallback((answer) => {
    const questionId = position.questionId
    if (!questionId || !session?.id) return

    // Update local state immediately (optimistic)
    setAnswers(prev => {
      const next = new Map(prev)

      // For FRQ with sub-questions, store as object
      if (isFRQQuestion && position.subQuestionLabel) {
        const existing = next.get(questionId) || {}
        next.set(questionId, {
          ...existing,
          [position.subQuestionLabel]: answer
        })
      } else {
        next.set(questionId, answer)
      }

      return next
    })

    // Queue for sync
    addToQueue({
      action: 'ANSWER_CHANGE',
      payload: {
        questionId,
        value: answer,
        subQuestionLabel: position.subQuestionLabel // null for MCQ
      }
    })
  }, [position.questionId, position.subQuestionLabel, session?.id, addToQueue, isFRQQuestion])

  // Toggle flag
  const toggleFlag = useCallback((questionId) => {
    if (!questionId || !session?.id) return

    const wasFlagged = flags.has(questionId)

    // Update local state immediately
    setFlags(prev => {
      const next = new Set(prev)
      if (wasFlagged) {
        next.delete(questionId)
      } else {
        next.add(questionId)
      }
      return next
    })

    // Queue for sync
    addToQueue({
      action: 'FLAG_TOGGLE',
      payload: { questionId, markedForReview: !wasFlagged }
    })
  }, [flags, session?.id, addToQueue])

  // Submit section (placeholder for multi-section tests)
  const submitSection = useCallback(async () => {
    // For Phase 1, we just go to next section
    // In future, this would lock the section and start next timer
    if (currentSectionIndex < (test?.sections?.length || 1) - 1) {
      setCurrentSectionIndex(prev => prev + 1)
      setCurrentQuestionIndex(0)
    }
  }, [currentSectionIndex, test?.sections?.length])

  // Submit test with retry logic
  const submitTest = useCallback(async (frqData = null) => {
    if (!session?.id || isSubmitting) return null

    // Store frqData for potential retry
    pendingFrqDataRef.current = frqData

    setIsSubmitting(true)
    setSubmitError(null)
    setIsSubmitTimedOut(false)
    submitStartTimeRef.current = Date.now()

    // Stop timer
    timer.pause()

    // Attempt submission with 2s retry interval, max 30s
    const attemptSubmission = async () => {
      // 1. Flush queue if needed (guard: don't call if already flushing)
      if (queueLength > 0 && !isFlushing) {
        await flushQueue()
      }

      // 2. Create result (idempotent via deterministic ID)
      return await createTestResult(session.id, frqData)
    }

    // Retry loop
    while (true) {
      try {
        const resultId = await attemptSubmission()
        setIsSubmitting(false)
        setSubmitError(null)
        return resultId
      } catch (err) {
        const errorMessage = err.message || 'Failed to submit test'
        setSubmitError(errorMessage)
        logError('useTestSession.submitTest', { sessionId: session?.id, elapsed: Date.now() - submitStartTimeRef.current }, err)

        const elapsed = Date.now() - submitStartTimeRef.current
        if (elapsed >= 30000) {
          // 30s timeout reached - stop auto-retry
          setIsSubmitTimedOut(true)
          // Keep isSubmitting true so modal stays visible
          return null
        }

        // Wait 2s before retry
        await new Promise(r => setTimeout(r, 2000))
      }
    }
  }, [session?.id, isSubmitting, timer, queueLength, isFlushing, flushQueue])

  // Manual retry function (for "Keep Trying" button)
  const retrySubmit = useCallback(async () => {
    // Reset timeout state and restart the submission loop
    setIsSubmitTimedOut(false)
    setSubmitError(null)
    submitStartTimeRef.current = Date.now()

    const frqData = pendingFrqDataRef.current

    // Retry loop (same as submitTest but without the initial setup)
    const attemptSubmission = async () => {
      if (queueLength > 0 && !isFlushing) {
        await flushQueue()
      }
      return await createTestResult(session.id, frqData)
    }

    while (true) {
      try {
        const resultId = await attemptSubmission()
        setIsSubmitting(false)
        setSubmitError(null)
        return resultId
      } catch (err) {
        const errorMessage = err.message || 'Failed to submit test'
        setSubmitError(errorMessage)
        logError('useTestSession.retrySubmit', { sessionId: session?.id, elapsed: Date.now() - submitStartTimeRef.current }, err)

        const elapsed = Date.now() - submitStartTimeRef.current
        if (elapsed >= 30000) {
          setIsSubmitTimedOut(true)
          return null
        }

        await new Promise(r => setTimeout(r, 2000))
      }
    }
  }, [session?.id, queueLength, isFlushing, flushQueue])

  // Keep submitFunctionsRef updated to avoid circular dependency with timer
  useEffect(() => {
    submitFunctionsRef.current = { submitTest, submitSection }
  }, [submitTest, submitSection])

  // Check for pending AUTO_SUBMIT on reconnect (offline timer expiry)
  useEffect(() => {
    const checkPendingAutoSubmit = async () => {
      if (!isOnline || !session?.id || autoSubmitTriggeredRef.current) return

      const pendingAutoSubmit = await getPendingItems('AUTO_SUBMIT')
      if (pendingAutoSubmit.length > 0) {
        // Found pending auto-submit from offline timer expiry
        autoSubmitTriggeredRef.current = true
        setAutoSubmitTriggered(true)

        const item = pendingAutoSubmit[0]
        const { isLastSection } = item.payload

        if (isLastSection) {
          const resultId = await submitTest()
          if (resultId) {
            setAutoSubmitResultId(resultId)
          }
        } else {
          await submitSection()
        }

        // Delete processed AUTO_SUBMIT items
        await deleteItems(pendingAutoSubmit.map(i => i.id))
      }
    }

    checkPendingAutoSubmit()
  }, [isOnline, session?.id, getPendingItems, deleteItems, submitTest, submitSection])

  // Visibility change handler - pause timer if backgrounded >30s on mobile
  useEffect(() => {
    let backgroundedAt = null

    const handleVisibilityChange = () => {
      if (document.hidden) {
        backgroundedAt = Date.now()
        // Write pause marker when tab becomes hidden (for tab close detection)
        if (session?.id) {
          try {
            localStorage.setItem(`ap_session_pause_${session.id}`, Date.now().toString())
          } catch (e) {
            // localStorage might be unavailable
          }
        }
      } else if (backgroundedAt) {
        const elapsed = Date.now() - backgroundedAt
        // Clear pause marker since we're back (tab wasn't closed)
        if (session?.id) {
          try {
            localStorage.removeItem(`ap_session_pause_${session.id}`)
          } catch (e) {
            // localStorage might be unavailable
          }
        }
        if (elapsed > 30000) {
          // Backgrounded for >30s, pause timer and sync
          timer.pause()
          if (session?.id && currentSection?.id) {
            addToQueue({
              action: 'TIMER_SYNC',
              payload: { sectionTimeRemaining: { [currentSection.id]: timer.timeRemaining } }
            })
          }
        }
        backgroundedAt = null
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [timer, session?.id, currentSection?.id, addToQueue])

  // Pagehide handler - reliable timer sync on mobile Safari + pause marker
  useEffect(() => {
    const handlePageHide = () => {
      if (session?.id && currentSection?.id) {
        // Sync timer state
        addToQueue({
          action: 'TIMER_SYNC',
          payload: { sectionTimeRemaining: { [currentSection.id]: timer.timeRemaining } }
        })
        // Write pause marker for reliable PAUSED status detection on next load
        // This survives tab close even if Firestore write fails
        try {
          localStorage.setItem(`ap_session_pause_${session.id}`, Date.now().toString())
        } catch (e) {
          // localStorage might be unavailable in some contexts
        }
      }
    }

    window.addEventListener('pagehide', handlePageHide)
    return () => window.removeEventListener('pagehide', handlePageHide)
  }, [timer, session?.id, currentSection?.id, addToQueue])

  // Handle take control (from duplicate tab modal)
  const handleTakeControl = useCallback(async () => {
    const success = await takeControl()
    if (success) {
      // Re-claim was successful
      // Could refresh session state here if needed
    }
    return success
  }, [takeControl])

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      if (timerSaveRef.current) {
        clearTimeout(timerSaveRef.current)
      }
    }
  }, [])

  // Status
  const status = session?.status || SESSION_STATUS.NOT_STARTED

  return {
    // State
    session,
    test,
    loading,
    error,

    // Position
    currentSection,
    currentQuestion,
    position,

    // Navigation
    goToQuestion,
    goToFlatIndex,
    goNext,
    goPrevious,
    canGoNext,
    canGoPrevious,

    // FRQ Navigation
    flatNavigationItems,
    currentFlatIndex,
    isFRQQuestion,
    subQuestionLabel: currentSubQuestionLabel,

    // Answers
    answers,
    currentAnswer,
    setAnswer,

    // Flags
    flags,
    toggleFlag,

    // Session control
    startTest,
    submitSection,
    submitTest,
    retrySubmit,

    // Status
    status,
    isSubmitting,
    submitError,
    isSubmitTimedOut,

    // Timer
    timeRemaining: timer.timeRemaining,
    timerFormatted: timer.formatted,
    isTimerExpired: timer.isExpired,

    // Resilience - connection state
    isConnected,
    isOnline,
    isSyncing: isFlushing,
    queueLength,

    // Resilience - duplicate tab
    isInvalidated: isSessionInvalidated,
    takeControl: handleTakeControl,

    // Queue access for annotations
    addToQueue,

    // Auto-submit state (for timer expiry navigation)
    autoSubmitTriggered,
    autoSubmitResultId,
  }
}

export default useTestSession