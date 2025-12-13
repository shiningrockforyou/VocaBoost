/**
 * DailySessionFlow.jsx
 *
 * Orchestrates the complete daily study session with phases:
 * New Words Study → New Words Test → Review Study → Review Test → Complete
 *
 * Key features:
 * - Session progress persists (can leave and resume)
 * - Test progress does NOT persist (exit = reset)
 * - Day 1 has no review phase
 * - PDF buttons available in study screens
 * - Blind spots shown at completion
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import Flashcard from '../components/Flashcard'
import Watermark from '../components/Watermark'
import ConfirmModal from '../components/ConfirmModal'
import SessionProgressBanner from '../components/SessionProgressBanner'
import BlindSpotsCard from '../components/BlindSpotsCard'
import { Button } from '../components/ui'

// Services
import {
  initializeDailySession,
  getNewWords,
  getFailedFromPreviousNewWords,
  getSegmentWords,
  buildReviewQueue,
  updateQueueTracking,
  recordSessionCompletion,
  initializeNewWordStates,
  getTodaysBatchForPDF,
  getCompleteBatchForPDF
} from '../services/studyService'
import { fetchAllWords } from '../services/db'
import {
  getSessionState,
  saveSessionState,
  clearSessionState,
  SESSION_PHASE,
  getReviewTestType
} from '../services/sessionService'
import { downloadListAsPDF } from '../utils/pdfGenerator'
import { STUDY_ALGORITHM_CONSTANTS } from '../utils/studyAlgorithm'

// Constants
const PHASES = {
  LOADING: 'loading',
  NEW_WORDS: 'new_words',
  NEW_WORD_TEST: 'new_word_test',
  REVIEW_STUDY: 'review_study',
  REVIEW_TEST: 'review_test',
  COMPLETE: 'complete'
}

export default function DailySessionFlow() {
  const { classId, listId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Session state
  const [phase, setPhase] = useState(PHASES.LOADING)
  const [sessionConfig, setSessionConfig] = useState(null)
  const [error, setError] = useState('')
  const [listTitle, setListTitle] = useState('')

  // New words phase
  const [newWords, setNewWords] = useState([])
  const [failedCarryover, setFailedCarryover] = useState([])
  const [newWordsQueue, setNewWordsQueue] = useState([])
  const [newWordsDismissed, setNewWordsDismissed] = useState(new Set())

  // New word test results
  const [newWordTestResults, setNewWordTestResults] = useState(null)
  const [newWordFailedIds, setNewWordFailedIds] = useState([])

  // Review phase
  const [reviewQueue, setReviewQueue] = useState([])
  const [reviewQueueCurrent, setReviewQueueCurrent] = useState([])
  const [reviewDismissed, setReviewDismissed] = useState(new Set())

  // Review test results
  const [reviewTestResults, setReviewTestResults] = useState(null)
  const [reviewTestAttempts, setReviewTestAttempts] = useState(0)

  // Shared flashcard state
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [cardsReviewed, setCardsReviewed] = useState(0)

  // Assignment settings
  const [assignmentSettings, setAssignmentSettings] = useState(null)

  // Session summary
  const [sessionSummary, setSessionSummary] = useState(null)

  // PDF generation state
  const [generatingPDF, setGeneratingPDF] = useState(null)

  // Confirmation modals
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  const [showTestConfirm, setShowTestConfirm] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showReEntryModal, setShowReEntryModal] = useState(false)
  const [showMoveOnConfirm, setShowMoveOnConfirm] = useState(false)

  // Review mode
  const [reviewMode, setReviewMode] = useState('fast')
  const [showCompleteModeModal, setShowCompleteModeModal] = useState(false)
  const [showFastModeModal, setShowFastModeModal] = useState(false)
  const [isSwitchingMode, setIsSwitchingMode] = useState(false)

  // Re-entry state (for modal)
  const [savedSessionState, setSavedSessionState] = useState(null)

  // ============================================================
  // Browser Close Warning
  // ============================================================

  useEffect(() => {
    const isActivePhase = phase === PHASES.NEW_WORDS || phase === PHASES.REVIEW_STUDY

    const handleBeforeUnload = (e) => {
      if (isActivePhase) {
        e.preventDefault()
        e.returnValue = 'You have unsaved progress. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    if (isActivePhase) {
      window.addEventListener('beforeunload', handleBeforeUnload)
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [phase])

  // ============================================================
  // Session State Persistence
  // ============================================================

  const persistSessionState = useCallback(async (updates = {}) => {
    if (!user?.uid || !classId || !listId) return

    const currentPhaseMap = {
      [PHASES.NEW_WORDS]: SESSION_PHASE.NEW_WORDS_STUDY,
      [PHASES.NEW_WORD_TEST]: SESSION_PHASE.NEW_WORDS_TEST,
      [PHASES.REVIEW_STUDY]: SESSION_PHASE.REVIEW_STUDY,
      [PHASES.REVIEW_TEST]: SESSION_PHASE.REVIEW_TEST,
      [PHASES.COMPLETE]: SESSION_PHASE.COMPLETE
    }

    try {
      await saveSessionState(user.uid, classId, listId, {
        phase: currentPhaseMap[phase] || SESSION_PHASE.NEW_WORDS_STUDY,
        currentStudyDay: sessionConfig?.dayNumber || 1,
        newWordsTestPassed: !!newWordTestResults && newWordTestResults.score >= (sessionConfig?.retakeThreshold || 0.95),
        newWordsTestScore: newWordTestResults?.score || null,
        reviewTestScore: reviewTestResults?.score || null,
        reviewTestAttempts,
        dismissedWordIds: [...newWordsDismissed, ...reviewDismissed],
        ...updates
      })
    } catch (err) {
      console.error('Failed to persist session state:', err)
    }
  }, [user?.uid, classId, listId, phase, sessionConfig, newWordTestResults, reviewTestResults, reviewTestAttempts, newWordsDismissed, reviewDismissed])

  // Auto-save on phase changes
  useEffect(() => {
    if (phase !== PHASES.LOADING) {
      persistSessionState()
    }
  }, [phase, persistSessionState])

  // ============================================================
  // PDF Generation
  // ============================================================

  const handlePDFDownload = async (mode) => {
    if (!user?.uid || !classId || !listId || !assignmentSettings) return

    setGeneratingPDF(mode)

    try {
      let words

      if (mode === 'today') {
        words = await getTodaysBatchForPDF(user.uid, classId, listId, assignmentSettings)
      } else if (mode === 'complete') {
        words = await getCompleteBatchForPDF(user.uid, classId, listId, assignmentSettings)
      } else {
        const allWords = await fetchAllWords(listId)
        words = allWords.map((w, idx) => ({ ...w, wordIndex: w.wordIndex ?? idx }))
      }

      if (words.length === 0) {
        alert('No words available to export.')
        return
      }

      const normalizedWords = words.map((word) => ({
        ...word,
        partOfSpeech: word?.partOfSpeech ?? word?.pos ?? word?.part_of_speech ?? '',
      }))

      await downloadListAsPDF(listTitle || 'Vocabulary List', normalizedWords, mode)
    } catch (err) {
      console.error('PDF generation failed:', err)
      alert('Failed to generate PDF')
    } finally {
      setGeneratingPDF(null)
    }
  }

  // ============================================================
  // Helper: Load Review Queue
  // ============================================================

  const loadReviewQueue = useCallback(async (config) => {
    if (!config?.segment || !user?.uid) return

    const queue = await buildReviewQueue(
      user.uid,
      listId,
      config.segment,
      config.reviewCount,
      newWordFailedIds
    )

    setReviewQueue(queue)
    setReviewQueueCurrent(queue)
    setCurrentIndex(0)
  }, [user?.uid, listId, newWordFailedIds])

  // ============================================================
  // Mode Switch Handlers
  // ============================================================

  const handleSwitchToCompleteMode = useCallback(async () => {
    if (!sessionConfig || !user?.uid) return

    setIsSwitchingMode(true)
    setShowCompleteModeModal(false)

    try {
      if (phase === PHASES.REVIEW_STUDY && sessionConfig.segment) {
        const allWords = await getSegmentWords(
          user.uid,
          listId,
          sessionConfig.segment.startIndex,
          sessionConfig.segment.endIndex
        )
        setReviewQueue(allWords)
        setReviewQueueCurrent(allWords)
        setReviewDismissed(new Set())
        setCurrentIndex(0)
        setIsFlipped(false)
      }

      setReviewMode('complete')
    } catch (err) {
      console.error('Failed to switch to complete mode:', err)
    } finally {
      setIsSwitchingMode(false)
    }
  }, [sessionConfig, user?.uid, listId, phase])

  const handleSwitchToFastMode = useCallback(async () => {
    if (!sessionConfig || !user?.uid) return

    setIsSwitchingMode(true)
    setShowFastModeModal(false)

    try {
      if (phase === PHASES.REVIEW_STUDY && sessionConfig.segment) {
        const queue = await buildReviewQueue(
          user.uid,
          listId,
          sessionConfig.segment,
          sessionConfig.reviewCount,
          newWordFailedIds
        )
        setReviewQueue(queue)
        setReviewQueueCurrent(queue)
        setReviewDismissed(new Set())
        setCurrentIndex(0)
        setIsFlipped(false)
      }

      setReviewMode('fast')
    } catch (err) {
      console.error('Failed to switch to fast mode:', err)
    } finally {
      setIsSwitchingMode(false)
    }
  }, [sessionConfig, user?.uid, listId, phase, newWordFailedIds])

  // ============================================================
  // PHASE 0: Initialize Session
  // ============================================================

  useEffect(() => {
    if (!user?.uid || !classId || !listId) return

    const init = async () => {
      try {
        // Get class to find assignment settings
        const classRef = doc(db, 'classes', classId)
        const classSnap = await getDoc(classRef)
        if (!classSnap.exists()) {
          throw new Error('Class not found')
        }
        const classData = classSnap.data()
        const assignment = classData.assignments?.[listId]
        if (!assignment) {
          throw new Error('List not assigned to this class')
        }

        setAssignmentSettings(assignment)

        // Get list title
        const listRef = doc(db, 'lists', listId)
        const listSnap = await getDoc(listRef)
        if (listSnap.exists()) {
          setListTitle(listSnap.data().title || 'Vocabulary List')
        }

        // Check for existing session state
        const existingState = await getSessionState(user.uid, classId, listId)

        // Initialize session config
        const config = await initializeDailySession(
          user.uid,
          classId,
          listId,
          {
            weeklyPace: assignment.pace * 7 || STUDY_ALGORITHM_CONSTANTS.DEFAULT_WEEKLY_PACE,
            studyDaysPerWeek: STUDY_ALGORITHM_CONSTANTS.DEFAULT_STUDY_DAYS_PER_WEEK,
            testSizeNew: assignment.testSizeNew || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_NEW,
            testSizeReview: assignment.testSizeReview || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_REVIEW,
            newWordRetakeThreshold: assignment.newWordRetakeThreshold || STUDY_ALGORITHM_CONSTANTS.DEFAULT_RETAKE_THRESHOLD
          }
        )

        setSessionConfig(config)

        // Load new words
        if (config.newWordCount > 0) {
          const words = await getNewWords(
            listId,
            config.newWordStartIndex,
            config.newWordCount
          )

          const failedWords = await getFailedFromPreviousNewWords(
            user.uid,
            listId,
            config.newWordStartIndex
          )
          setFailedCarryover(failedWords)

          const combinedWords = [...failedWords, ...words]
          setNewWords(combinedWords)
          setNewWordsQueue(combinedWords)

          await initializeNewWordStates(
            user.uid,
            listId,
            words,
            config.dayNumber
          )
        }

        // Handle re-entry: check if user already completed review test
        if (existingState && existingState.phase === SESSION_PHASE.COMPLETE && existingState.reviewTestScore !== null) {
          setSavedSessionState(existingState)
          setReviewTestResults({ score: existingState.reviewTestScore })
          setReviewTestAttempts(existingState.reviewTestAttempts || 0)
          setShowReEntryModal(true)
          setPhase(PHASES.COMPLETE)
          return
        }

        // Restore session state if exists
        if (existingState) {
          setReviewTestAttempts(existingState.reviewTestAttempts || 0)

          if (existingState.newWordsTestScore !== null) {
            setNewWordTestResults({ score: existingState.newWordsTestScore })
          }
          if (existingState.reviewTestScore !== null) {
            setReviewTestResults({ score: existingState.reviewTestScore })
          }

          // Restore dismissed words
          if (existingState.dismissedWordIds?.length > 0) {
            setNewWordsDismissed(new Set(existingState.dismissedWordIds))
          }
        }

        // Determine starting phase
        if (existingState?.phase === SESSION_PHASE.REVIEW_STUDY || existingState?.phase === SESSION_PHASE.REVIEW_TEST) {
          // Resume at review phase
          if (config.segment) {
            const queue = await buildReviewQueue(
              user.uid,
              listId,
              config.segment,
              config.reviewCount,
              []
            )
            setReviewQueue(queue)
            setReviewQueueCurrent(queue)
          }
          setPhase(PHASES.REVIEW_STUDY)
        } else if (config.newWordCount > 0) {
          setPhase(PHASES.NEW_WORDS)
        } else if (config.segment) {
          const queue = await buildReviewQueue(
            user.uid,
            listId,
            config.segment,
            config.reviewCount,
            []
          )
          setReviewQueue(queue)
          setReviewQueueCurrent(queue)
          setPhase(PHASES.REVIEW_STUDY)
        } else {
          setPhase(PHASES.COMPLETE)
        }
      } catch (err) {
        setError(err.message || 'Failed to initialize session')
      }
    }

    init()
  }, [user?.uid, classId, listId])

  // ============================================================
  // PHASE 1: New Words Study
  // ============================================================

  const currentNewWord = newWordsQueue[currentIndex]

  const handleNewWordKnowThis = () => {
    if (!currentNewWord) return
    setNewWordsDismissed(prev => new Set([...prev, currentNewWord.id]))
    setNewWordsQueue(prev => prev.filter(w => w.id !== currentNewWord.id))
    setCardsReviewed(prev => prev + 1)

    if (newWordsQueue.length <= 1) {
      // All cards reviewed - prompt for test
      setShowTestConfirm(true)
    } else if (currentIndex >= newWordsQueue.length - 1) {
      setCurrentIndex(0)
    }
    setIsFlipped(false)
  }

  const handleNewWordNotSure = () => {
    if (!currentNewWord) return
    setNewWordsQueue(prev => {
      const word = prev.find(w => w.id === currentNewWord.id)
      const filtered = prev.filter(w => w.id !== currentNewWord.id)
      return [...filtered, word]
    })
    setCardsReviewed(prev => prev + 1)
    if (currentIndex >= newWordsQueue.length - 1) {
      setCurrentIndex(0)
    }
    setIsFlipped(false)
  }

  const handleNewWordReset = () => {
    setNewWordsDismissed(new Set())
    setNewWordsQueue([...newWords])
    setCurrentIndex(0)
    setIsFlipped(false)
  }

  const goToNewWordTest = () => {
    const testMode = assignmentSettings?.testMode || 'mcq'
    const actualMode = testMode === 'typed' ? 'typed' : 'mcq'
    navigateToTest('new', actualMode)
  }

  // ============================================================
  // PHASE 2: New Word Test Navigation
  // ============================================================

  const handleContinueToReview = async () => {
    await moveToReviewPhase()
  }

  const handleNewWordTestRetake = () => {
    const testMode = assignmentSettings?.testMode || 'mcq'
    navigateToTest('new', testMode === 'typed' ? 'typed' : 'mcq')
  }

  // ============================================================
  // PHASE 3: Review Study
  // ============================================================

  const moveToReviewPhase = async () => {
    if (!sessionConfig?.segment) {
      // No review (day 1), go to complete
      await completeSession()
      return
    }

    const queue = await buildReviewQueue(
      user.uid,
      listId,
      sessionConfig.segment,
      sessionConfig.reviewCount,
      newWordFailedIds
    )
    setReviewQueue(queue)
    setReviewQueueCurrent(queue)
    setReviewDismissed(new Set())
    setCurrentIndex(0)
    setIsFlipped(false)
    setPhase(PHASES.REVIEW_STUDY)
  }

  const currentReviewWord = reviewQueueCurrent[currentIndex]

  const handleReviewKnowThis = () => {
    if (!currentReviewWord) return
    setReviewDismissed(prev => new Set([...prev, currentReviewWord.id]))
    setReviewQueueCurrent(prev => prev.filter(w => w.id !== currentReviewWord.id))
    setCardsReviewed(prev => prev + 1)

    if (reviewQueueCurrent.length <= 1) {
      setShowTestConfirm(true)
    } else if (currentIndex >= reviewQueueCurrent.length - 1) {
      setCurrentIndex(0)
    }
    setIsFlipped(false)
  }

  const handleReviewNotSure = () => {
    if (!currentReviewWord) return
    setReviewQueueCurrent(prev => {
      const word = prev.find(w => w.id === currentReviewWord.id)
      const filtered = prev.filter(w => w.id !== currentReviewWord.id)
      return [...filtered, word]
    })
    setCardsReviewed(prev => prev + 1)
    if (currentIndex >= reviewQueueCurrent.length - 1) {
      setCurrentIndex(0)
    }
    setIsFlipped(false)
  }

  const handleReviewReset = () => {
    setReviewDismissed(new Set())
    setReviewQueueCurrent([...reviewQueue])
    setCurrentIndex(0)
    setIsFlipped(false)
  }

  const handleFinishReviewStudy = async () => {
    const studiedIds = reviewQueue.map(w => w.id)
    await updateQueueTracking(user.uid, studiedIds)
    goToReviewTest()
  }

  const goToReviewTest = () => {
    const testMode = assignmentSettings?.testMode || 'mcq'
    const actualMode = getReviewTestType(reviewTestAttempts, testMode)
    navigateToTest('review', actualMode)
  }

  // ============================================================
  // Test Navigation
  // ============================================================

  const navigateToTest = (testPhase, mode) => {
    const wordPool = testPhase === 'new' ? newWords : null

    // Build context for test header
    const wordRangeStart = testPhase === 'new'
      ? (sessionConfig?.newWordStartIndex || 0) + 1
      : (sessionConfig?.segment?.startIndex || 0) + 1
    const wordRangeEnd = testPhase === 'new'
      ? (sessionConfig?.newWordEndIndex || 0) + 1
      : (sessionConfig?.segment?.endIndex || 0) + 1

    const route = mode === 'typed' ? '/typedtest' : '/mcqtest'

    // Store session state in sessionStorage for return
    sessionStorage.setItem('dailySessionState', JSON.stringify({
      classId,
      listId,
      dayNumber: sessionConfig?.dayNumber,
      phase: testPhase === 'new' ? PHASES.NEW_WORD_TEST : PHASES.REVIEW_TEST,
      newWords,
      newWordTestResults,
      reviewQueue,
      sessionConfig,
      assignmentSettings,
      reviewTestAttempts
    }))

    navigate(`${route}/${classId}/${listId}`, {
      state: {
        testType: testPhase,
        wordPool: testPhase === 'new' ? newWords : null,
        returnPath: `/session/${classId}/${listId}`,
        sessionContext: {
          dayNumber: sessionConfig?.dayNumber,
          phase: testPhase,
          wordRangeStart,
          wordRangeEnd,
          listTitle
        }
      }
    })
  }

  // Handle return from test
  useEffect(() => {
    if (!location.state?.testCompleted) return

    const handleReturnFromTest = async () => {
      const savedState = sessionStorage.getItem('dailySessionState')
      if (!savedState) return

      try {
        const state = JSON.parse(savedState)
        const results = location.state?.results

        // Restore session state
        setSessionConfig(state.sessionConfig)
        setNewWords(state.newWords)
        setReviewQueue(state.reviewQueue)
        setAssignmentSettings(state.assignmentSettings)
        setReviewTestAttempts(state.reviewTestAttempts || 0)

        // Handle test results
        if (location.state?.testType === 'new') {
          setNewWordTestResults(results)
          setNewWordFailedIds(results?.failed || [])

          if (results?.score < state.sessionConfig?.retakeThreshold) {
            setPhase(PHASES.NEW_WORD_TEST)
          } else {
            // Check if Day 1 (no review phase)
            if (state.sessionConfig?.isFirstDay) {
              await completeSession()
            } else {
              await moveToReviewPhase()
            }
          }
        } else {
          setReviewTestResults(results)
          setReviewTestAttempts(prev => prev + 1)
          await completeSession()
        }

        sessionStorage.removeItem('dailySessionState')
      } catch (err) {
        console.error('Failed to restore session state:', err)
        setError('Failed to restore session. Please start over.')
      }
    }

    handleReturnFromTest()
  }, [location.state])

  // ============================================================
  // PHASE 5: Complete
  // ============================================================

  const completeSession = async () => {
    try {
      const summary = {
        classId,
        listId,
        dayNumber: sessionConfig?.dayNumber,
        interventionLevel: sessionConfig?.interventionLevel,
        newWordScore: newWordTestResults?.score || null,
        reviewScore: reviewTestResults?.score || null,
        segment: sessionConfig?.segment,
        wordsIntroduced: newWords.length,
        wordsReviewed: reviewQueue.length,
        wordsTested: (newWordTestResults?.total || 0) + (reviewTestResults?.total || 0)
      }

      const result = await recordSessionCompletion(user.uid, summary)

      setSessionSummary({
        ...summary,
        progress: result.progress
      })

      setPhase(PHASES.COMPLETE)
    } catch (err) {
      setError(err.message || 'Failed to record session')
    }
  }

  // ============================================================
  // Re-entry and Move On Handlers
  // ============================================================

  const handleReEntryRetake = () => {
    setShowReEntryModal(false)
    setPhase(PHASES.REVIEW_STUDY)
  }

  const handleReEntryMoveOn = async () => {
    setShowReEntryModal(false)
    await handleMoveToNextDay()
  }

  const handleMoveToNextDay = async () => {
    try {
      // Clear session state for this list
      await clearSessionState(user.uid, classId, listId)
      // Navigate to dashboard
      navigate('/')
    } catch (err) {
      console.error('Failed to move to next day:', err)
    }
  }

  const handleRetakeReviewTest = () => {
    setPhase(PHASES.REVIEW_STUDY)
  }

  // ============================================================
  // Confirmation Handlers
  // ============================================================

  const handleQuitConfirm = () => {
    setShowQuitConfirm(false)
    navigate('/')
  }

  const handleTestConfirm = () => {
    setShowTestConfirm(false)
    if (phase === PHASES.NEW_WORDS) {
      goToNewWordTest()
    } else if (phase === PHASES.REVIEW_STUDY) {
      handleFinishReviewStudy()
    }
  }

  const handleResetConfirm = () => {
    setShowResetConfirm(false)
    if (phase === PHASES.NEW_WORDS) {
      handleNewWordReset()
    } else if (phase === PHASES.REVIEW_STUDY) {
      handleReviewReset()
    }
  }

  // Get current counts for confirmation messages
  const currentQueueLength = phase === PHASES.NEW_WORDS ? newWordsQueue.length : reviewQueueCurrent.length
  const currentDismissedCount = phase === PHASES.NEW_WORDS ? newWordsDismissed.size : reviewDismissed.size

  // ============================================================
  // RENDER
  // ============================================================

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-base p-4">
        <Watermark />
        <div className="relative z-10 rounded-xl bg-red-50 p-6 text-center dark:bg-red-900/20">
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </main>
    )
  }

  if (phase === PHASES.LOADING) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-base">
        <Watermark />
        <div className="relative z-10 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="mt-4 text-text-secondary">Preparing your session...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen bg-base">
      <Watermark />

      {/* Phase indicator with navigation */}
      <div className="relative z-10 border-b border-border-default bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          {/* Left: Quit button */}
          {(phase === PHASES.NEW_WORDS || phase === PHASES.REVIEW_STUDY) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQuitConfirm(true)}
            >
              ← Quit
            </Button>
          )}

          {/* Center: Day info and phase indicator */}
          <div className="flex flex-1 items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-secondary">
                Day {sessionConfig?.dayNumber} · {listTitle}
              </p>
              <p className="text-xs text-text-muted">
                Words #{(sessionConfig?.newWordStartIndex || 0) + 1}–{(sessionConfig?.newWordEndIndex || 0) + 1}
              </p>
            </div>
            <PhaseIndicator phase={phase} hasReview={!!sessionConfig?.segment} />
          </div>

          {/* Right: Skip to Test button */}
          {(phase === PHASES.NEW_WORDS || phase === PHASES.REVIEW_STUDY) && currentQueueLength > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTestConfirm(true)}
            >
              Test →
            </Button>
          )}
        </div>
      </div>

      {/* Phase content */}
      <div className="relative z-10 mx-auto max-w-2xl px-4 py-8">
        {phase === PHASES.NEW_WORDS && (
          <StudyPhase
            title="Study New Words"
            subtitle="Review each word. If you already know it, tap 'I Know This' to remove it from your study list."
            currentWord={currentNewWord}
            currentIndex={currentIndex}
            totalCount={newWordsQueue.length}
            dismissedCount={newWordsDismissed.size}
            isFlipped={isFlipped}
            onFlip={() => setIsFlipped(!isFlipped)}
            onKnowThis={handleNewWordKnowThis}
            onNotSure={handleNewWordNotSure}
            onReset={() => setShowResetConfirm(true)}
            onReadyForTest={() => setShowTestConfirm(true)}
            onPDFDownload={handlePDFDownload}
            generatingPDF={generatingPDF}
          />
        )}

        {phase === PHASES.NEW_WORD_TEST && (
          <div className="text-center">
            <SessionProgressBanner
              currentPhase="new-words-test"
              newWordsTestScore={newWordTestResults?.score}
              isFirstDay={sessionConfig?.isFirstDay}
            />

            {newWordTestResults ? (
              <RetakePrompt
                results={newWordTestResults}
                threshold={sessionConfig?.retakeThreshold}
                onRetake={handleNewWordTestRetake}
                onContinue={handleContinueToReview}
                isFirstDay={sessionConfig?.isFirstDay}
              />
            ) : (
              <div className="space-y-4 mt-6">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                <p className="text-text-secondary">Loading test...</p>
              </div>
            )}
          </div>
        )}

        {phase === PHASES.REVIEW_STUDY && (
          <>
            <StudyPhase
              title="Review Words"
              subtitle="Review words from previous days. Mark the ones you're confident about."
              currentWord={currentReviewWord}
              currentIndex={currentIndex}
              totalCount={reviewQueueCurrent.length}
              dismissedCount={reviewDismissed.size}
              isFlipped={isFlipped}
              onFlip={() => setIsFlipped(!isFlipped)}
              onKnowThis={handleReviewKnowThis}
              onNotSure={handleReviewNotSure}
              onReset={() => setShowResetConfirm(true)}
              onReadyForTest={() => setShowTestConfirm(true)}
              onPDFDownload={handlePDFDownload}
              generatingPDF={generatingPDF}
            />

            {/* Mode Toggle */}
            <div className="mt-8 border-t border-border-default pt-6">
              {reviewMode === 'fast' ? (
                <button
                  onClick={() => setShowCompleteModeModal(true)}
                  disabled={isSwitchingMode}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface/50 px-4 py-3 text-sm text-text-muted transition hover:bg-surface hover:text-text-secondary disabled:opacity-50"
                >
                  {isSwitchingMode ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <span>📚</span>
                  )}
                  Want a more complete review?
                </button>
              ) : (
                <button
                  onClick={() => setShowFastModeModal(true)}
                  disabled={isSwitchingMode}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 px-4 py-3 text-sm text-amber-600 transition hover:bg-amber-500/10 disabled:opacity-50"
                >
                  {isSwitchingMode ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <span>⚡</span>
                  )}
                  Return to fast review mode
                </button>
              )}
            </div>
          </>
        )}

        {phase === PHASES.REVIEW_TEST && (
          <div className="text-center">
            <div className="space-y-4">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
              <p className="text-text-secondary">Loading test...</p>
            </div>
          </div>
        )}

        {phase === PHASES.COMPLETE && (
          <CompletePhase
            summary={sessionSummary}
            sessionConfig={sessionConfig}
            newWordTestResults={newWordTestResults}
            reviewTestResults={reviewTestResults}
            userId={user?.uid}
            classId={classId}
            listId={listId}
            onRetakeReview={handleRetakeReviewTest}
            onMoveOn={() => setShowMoveOnConfirm(true)}
            onDashboard={() => navigate('/')}
          />
        )}
      </div>

      {/* Quit Confirmation */}
      <ConfirmModal
        isOpen={showQuitConfirm}
        title="Leave Study Session?"
        message="Your study progress will be saved. You can resume later."
        confirmLabel="Leave"
        cancelLabel="Keep Studying"
        onConfirm={handleQuitConfirm}
        onCancel={() => setShowQuitConfirm(false)}
        variant="warning"
      />

      {/* Ready for Test Confirmation */}
      <ConfirmModal
        isOpen={showTestConfirm}
        title="Ready for the Test?"
        message={currentQueueLength > 0
          ? `You still have ${currentQueueLength} cards remaining. Once you start the test, you can't return to study.`
          : "Once you start the test, you can't return to study these words."
        }
        confirmLabel="Start Test"
        cancelLabel="Keep Studying"
        onConfirm={handleTestConfirm}
        onCancel={() => setShowTestConfirm(false)}
        variant="warning"
      />

      {/* Reset Confirmation */}
      <ConfirmModal
        isOpen={showResetConfirm}
        title="Reset Progress?"
        message={`This will restore all ${currentDismissedCount} dismissed cards.`}
        confirmLabel="Reset"
        cancelLabel="Cancel"
        onConfirm={handleResetConfirm}
        onCancel={() => setShowResetConfirm(false)}
        variant="warning"
      />

      {/* Re-entry Modal */}
      <ConfirmModal
        isOpen={showReEntryModal}
        title={`Resume Day ${savedSessionState?.currentStudyDay || sessionConfig?.dayNumber}?`}
        message={`You scored ${savedSessionState?.reviewTestScore ? Math.round(savedSessionState.reviewTestScore * 100) : reviewTestResults?.score ? Math.round(reviewTestResults.score * 100) : '—'}% on the review test. Would you like to retry the review test or move on to the next day?`}
        confirmLabel="Retry Review Test"
        cancelLabel="Move On to Next Day"
        onConfirm={handleReEntryRetake}
        onCancel={handleReEntryMoveOn}
        variant="info"
      />

      {/* Move On Confirmation */}
      <ConfirmModal
        isOpen={showMoveOnConfirm}
        title="Complete This Day?"
        message={`Once you move on to Day ${(sessionConfig?.dayNumber || 0) + 1}, you can't return to Day ${sessionConfig?.dayNumber}. Are you sure?`}
        confirmLabel="Complete & Move On"
        cancelLabel="Stay"
        onConfirm={handleMoveToNextDay}
        onCancel={() => setShowMoveOnConfirm(false)}
        variant="success"
      />

      {/* Complete Mode Modal */}
      <ReviewModeModal
        isOpen={showCompleteModeModal}
        mode="complete"
        wordCount={sessionConfig?.segment ? (sessionConfig.segment.endIndex - sessionConfig.segment.startIndex + 1) : 0}
        onConfirm={handleSwitchToCompleteMode}
        onCancel={() => setShowCompleteModeModal(false)}
      />

      {/* Fast Mode Modal */}
      <ReviewModeModal
        isOpen={showFastModeModal}
        mode="fast"
        wordCount={sessionConfig?.reviewCount || 0}
        onConfirm={handleSwitchToFastMode}
        onCancel={() => setShowFastModeModal(false)}
      />
    </main>
  )
}

// ============================================================
// Sub-components
// ============================================================

function PhaseIndicator({ phase, hasReview }) {
  const phases = [
    { key: PHASES.NEW_WORDS, label: 'Study' },
    { key: PHASES.NEW_WORD_TEST, label: 'Test' },
    ...(hasReview ? [
      { key: PHASES.REVIEW_STUDY, label: 'Review' },
      { key: PHASES.REVIEW_TEST, label: 'Test' }
    ] : []),
    { key: PHASES.COMPLETE, label: 'Done' }
  ]

  const currentIdx = phases.findIndex(p => p.key === phase)

  return (
    <div className="flex items-center gap-2">
      {phases.map((p, idx) => (
        <div key={p.key} className="flex items-center">
          <div className={`h-2 w-2 rounded-full ${
            idx <= currentIdx ? 'bg-blue-500' : 'bg-border-default'
          }`} />
          {idx < phases.length - 1 && (
            <div className={`h-0.5 w-4 ${
              idx < currentIdx ? 'bg-blue-500' : 'bg-border-default'
            }`} />
          )}
        </div>
      ))}
    </div>
  )
}

function StudyPhase({
  title,
  subtitle,
  currentWord,
  currentIndex,
  totalCount,
  dismissedCount,
  isFlipped,
  onFlip,
  onKnowThis,
  onNotSure,
  onReset,
  onReadyForTest,
  onPDFDownload,
  generatingPDF
}) {
  if (!currentWord) {
    return (
      <div className="text-center space-y-6">
        <div className="rounded-xl bg-emerald-50 p-6 dark:bg-emerald-900/20">
          <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
            All cards reviewed!
          </p>
          <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
            You're ready to take the test.
          </p>
        </div>
        <Button onClick={onReadyForTest} variant="primary-blue" size="lg" className="w-full">
          I'm Ready for the Test
        </Button>
      </div>
    )
  }

  const handleNotSure = () => {
    if (!isFlipped) {
      onFlip()
    } else {
      onNotSure()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-text-primary">{title}</h2>
        <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
      </div>

      {/* Progress */}
      <p className="text-center text-sm text-text-muted">
        Card {currentIndex + 1} of {totalCount}
        {dismissedCount > 0 && ` (${dismissedCount} dismissed)`}
      </p>

      {/* Flashcard */}
      <div onClick={onFlip} className="cursor-pointer">
        <Flashcard
          word={currentWord}
          isFlipped={isFlipped}
          onFlip={onFlip}
        />
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <Button onClick={handleNotSure} variant="outline" className="flex-1">
            {isFlipped ? 'Not Sure' : 'Show Definition'}
          </Button>
          <Button onClick={onKnowThis} variant="success" className="flex-1">
            I Know This
          </Button>
        </div>

        {dismissedCount > 0 && (
          <Button onClick={onReset} variant="ghost" className="w-full text-text-muted">
            Reset ({dismissedCount} dismissed)
          </Button>
        )}
      </div>

      {/* Ready for Test Button */}
      <div className="pt-4 border-t border-border-default">
        <Button
          onClick={onReadyForTest}
          variant="primary-blue"
          size="lg"
          className="w-full"
        >
          I'm Ready for the Test
        </Button>
      </div>

      {/* PDF Buttons */}
      <div className="pt-4 border-t border-border-default">
        <p className="text-xs text-text-muted text-center mb-3">
          Prefer to study offline? Download a PDF.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() => onPDFDownload('today')}
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={generatingPDF !== null}
          >
            {generatingPDF === 'today' ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              "Today's Words"
            )}
          </Button>
          <Button
            onClick={() => onPDFDownload('full')}
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={generatingPDF !== null}
          >
            {generatingPDF === 'full' ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              'Full List'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function RetakePrompt({ results, threshold, onRetake, onContinue, isFirstDay }) {
  const percentage = Math.round((results?.score || 0) * 100)
  const needsRetake = (results?.score || 0) < threshold

  return (
    <div className="space-y-6 mt-6">
      <div className="rounded-xl bg-surface p-6 shadow ring-1 ring-border-default">
        <p className="text-4xl font-bold text-text-primary">{percentage}%</p>
        <p className="text-text-secondary">
          {results?.correct || 0} of {results?.total || 0} correct
        </p>
      </div>

      {needsRetake && (
        <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            Score below {Math.round(threshold * 100)}%
          </p>
          <p className="mt-1 text-sm text-amber-600 dark:text-amber-300">
            You need to score at least {Math.round(threshold * 100)}% to continue.
          </p>
        </div>
      )}

      {isFirstDay && !needsRetake && (
        <div className="rounded-lg bg-emerald-50 p-4 dark:bg-emerald-900/20">
          <p className="font-medium text-emerald-800 dark:text-emerald-200">
            Great job on Day 1!
          </p>
          <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-300">
            Since this is your first day, you're done! Starting tomorrow, you'll also review these words.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {needsRetake ? (
          <>
            <Button onClick={onRetake} variant="primary-blue" size="lg">
              Study Again & Retake
            </Button>
            <Button onClick={onContinue} variant="outline" size="lg">
              Continue Anyway
            </Button>
          </>
        ) : (
          <Button onClick={onContinue} variant="primary-blue" size="lg">
            {isFirstDay ? 'Complete Day 1' : 'Continue to Review'}
          </Button>
        )}
      </div>
    </div>
  )
}

function CompletePhase({
  summary,
  sessionConfig,
  newWordTestResults,
  reviewTestResults,
  userId,
  classId,
  listId,
  onRetakeReview,
  onMoveOn,
  onDashboard
}) {
  const isFirstDay = sessionConfig?.isFirstDay
  const reviewScore = reviewTestResults?.score
  const showRetakeOption = !isFirstDay && reviewScore !== null && reviewScore < 0.95

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <span className="text-3xl">✓</span>
        </div>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-emerald-600">
          Day {summary?.dayNumber || sessionConfig?.dayNumber} Complete
        </p>
        <h2 className="mt-1 text-2xl font-bold text-text-primary">Great Job!</h2>
      </div>

      {/* Session Progress Banner */}
      <SessionProgressBanner
        currentPhase="complete"
        newWordsTestScore={newWordTestResults?.score}
        reviewTestScore={reviewTestResults?.score}
        isFirstDay={isFirstDay}
        showNextStep={false}
      />

      {/* Day 1 Message */}
      {isFirstDay && (
        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
          <p className="font-medium text-blue-800 dark:text-blue-200">
            Welcome to your first day!
          </p>
          <p className="mt-1 text-sm text-blue-600 dark:text-blue-300">
            Starting tomorrow, you'll also review these words to help you remember them long-term.
          </p>
        </div>
      )}

      {/* Retake Option for Low Review Score */}
      {showRetakeOption && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 dark:bg-amber-900/20 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <p className="font-semibold text-amber-800 dark:text-amber-200">
                Your review score affects future pacing
              </p>
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                A lower score means the system will slow down and give you more review tomorrow.
                Retaking can help you progress faster.
              </p>
              <Button
                onClick={onRetakeReview}
                variant="outline"
                size="md"
                className="mt-4"
              >
                Retake Review Test
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Blind Spots Card */}
      {!isFirstDay && (
        <BlindSpotsCard
          userId={userId}
          classId={classId}
          listId={listId}
        />
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 pt-4">
        <Button onClick={onMoveOn} variant="primary-blue" size="lg" className="w-full">
          Complete Day {summary?.dayNumber || sessionConfig?.dayNumber} & Move On
        </Button>
        <Button onClick={onDashboard} variant="outline" size="lg" className="w-full">
          Stay in Session
        </Button>
      </div>
    </div>
  )
}

function ReviewModeModal({ isOpen, mode, wordCount, onConfirm, onCancel }) {
  if (!isOpen) return null

  const isComplete = mode === 'complete'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
            isComplete ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
          }`}>
            <span className="text-2xl">{isComplete ? '📚' : '⚡'}</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-primary">
              {isComplete ? 'Complete Review Mode' : 'Fast Review Mode'}
            </h3>
            <p className="text-sm text-text-muted">
              {isComplete ? `${wordCount} words in this segment` : `~${wordCount} priority words`}
            </p>
          </div>
        </div>

        <div className={`mb-6 rounded-lg p-4 ${
          isComplete ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-amber-50 dark:bg-amber-900/20'
        }`}>
          {isComplete ? (
            <div className="space-y-3 text-sm">
              <p className="font-medium text-blue-800 dark:text-blue-200">
                Review every word in the segment
              </p>
              <p className="text-blue-700 dark:text-blue-300">
                This is more work, but leads to better retention over time.
                Recommended if you're struggling with review tests.
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Smart selection based on your performance
              </p>
              <p className="text-amber-700 dark:text-amber-300">
                If you're doing well on tests, this minimal review is sufficient.
                Focuses on words you've struggled with.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button onClick={onCancel} variant="outline" className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            variant={isComplete ? 'primary-blue' : 'primary'}
            className="flex-1"
          >
            {isComplete ? 'Switch to Complete' : 'Switch to Fast'}
          </Button>
        </div>
      </div>
    </div>
  )
}
