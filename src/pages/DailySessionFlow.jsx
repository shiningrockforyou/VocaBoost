/**
 * DailySessionFlow.jsx
 * 
 * Orchestrates the complete daily study session with phases:
 * New Words → New Word Test → Review Study → Review Test → Complete
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import Flashcard from '../components/Flashcard'
import Watermark from '../components/Watermark'
import ConfirmModal from '../components/ConfirmModal'
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
  initializeNewWordStates
} from '../services/studyService'
import { STUDY_ALGORITHM_CONSTANTS } from '../utils/studyAlgorithm'
import { calculateExpectedStudyDay } from '../types/studyTypes'
import { getClassProgress } from '../services/progressService'

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

  // New words phase
  const [newWords, setNewWords] = useState([])
  const [failedCarryover, setFailedCarryover] = useState([]) // FAILED from previous tests
  const [newWordsQueue, setNewWordsQueue] = useState([])
  const [newWordsDismissed, setNewWordsDismissed] = useState(new Set())

  // New word test phase (results only, no inline test)
  const [newWordTestResults, setNewWordTestResults] = useState(null)
  const [newWordFailedIds, setNewWordFailedIds] = useState([])

  // Review phase
  const [reviewQueue, setReviewQueue] = useState([])
  const [reviewQueueCurrent, setReviewQueueCurrent] = useState([])
  const [reviewDismissed, setReviewDismissed] = useState(new Set())

  // Review test phase (results only, no inline test)
  const [reviewTestResults, setReviewTestResults] = useState(null)

  // Shared flashcard state
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [cardsReviewed, setCardsReviewed] = useState(0)

  // Test navigation state
  const [showTestTypeModal, setShowTestTypeModal] = useState(false)
  const [pendingTestPhase, setPendingTestPhase] = useState(null) // 'new' | 'review'
  const [assignmentSettings, setAssignmentSettings] = useState(null)

  // Track typed test passes (to disable re-taking typed after 95%+)
  const [typedTestPassed, setTypedTestPassed] = useState({
    new: false,
    review: false
  })

  // Session summary
  const [sessionSummary, setSessionSummary] = useState(null)

  // Confirmation modals
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Review mode: 'fast' (smart selection) or 'complete' (all words)
  const [reviewMode, setReviewMode] = useState('fast')
  const [showCompleteModeModal, setShowCompleteModeModal] = useState(false)
  const [showFastModeModal, setShowFastModeModal] = useState(false)
  const [isSwitchingMode, setIsSwitchingMode] = useState(false)

  // Next session modal (on complete screen)
  const [showNextSessionModal, setShowNextSessionModal] = useState(false)
  const [progressInfo, setProgressInfo] = useState(null) // { completedDays, expectedDay, difference, isOnTrack }

  // ============================================================
  // Browser Close Warning
  // ============================================================

  useEffect(() => {
    // Only warn during active study phases (not loading, complete, or test phases)
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
      // Load ALL words in the segment instead of smart selection
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
      // Reload with smart selection
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

        // Store assignment settings
        setAssignmentSettings(assignment)

        // Initialize session
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

          // Also get FAILED words from previous tests (carryover)
          const failedWords = await getFailedFromPreviousNewWords(
            user.uid,
            listId,
            config.newWordStartIndex // Words before today's new words
          )
          setFailedCarryover(failedWords)

          // Combine: failed carryover + today's new words
          // Failed words go first so they appear in the test
          const combinedWords = [...failedWords, ...words]
          setNewWords(combinedWords)
          setNewWordsQueue(combinedWords)

          // Initialize study states for new words only (failed words already have states)
          await initializeNewWordStates(
            user.uid,
            listId,
            words,
            config.dayNumber
          )
        }

        // Determine starting phase
        if (config.newWordCount > 0) {
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
          // No new words and no review (shouldn't happen normally)
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
      // Done with new words, move to test
      prepareNewWordTest()
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

  const handleFinishNewWordsStudy = () => {
    goToNewWordTest()
  }

  const goToNewWordTest = () => {
    const testMode = assignmentSettings?.testMode || 'mcq'
    
    if (testMode === 'both') {
      setPendingTestPhase('new')
      setShowTestTypeModal(true)
    } else {
      navigateToTest('new', testMode)
    }
  }

  // ============================================================
  // PHASE 2: New Word Test (Navigation)
  // ============================================================

  const handleContinueToReview = async () => {
    await moveToReviewPhase()
  }

  const handleNewWordTestRetake = () => {
    const testMode = assignmentSettings?.testMode || 'mcq'
    navigateToTest('new', testMode)
  }

  // ============================================================
  // PHASE 3: Review Study
  // ============================================================

  const moveToReviewPhase = async () => {
    if (!sessionConfig.segment) {
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
      prepareReviewTest()
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
    // Update queue tracking for words that were studied
    const studiedIds = reviewQueue.map(w => w.id)
    await updateQueueTracking(user.uid, studiedIds)
    goToReviewTest()
  }

  const goToReviewTest = async () => {
    const testMode = assignmentSettings?.testMode || 'mcq'
    
    if (testMode === 'both') {
      setPendingTestPhase('review')
      setShowTestTypeModal(true)
    } else {
      navigateToTest('review', testMode)
    }
  }

  // ============================================================
  // PHASE 4: Review Test (Navigation)
  // ============================================================

  // Navigation to test
  const navigateToTest = (testPhase, mode) => {
    const wordPool = testPhase === 'new' ? newWords : null // Review uses smart selection
    let actualMode = mode
    let practiceMode = false

    // Check if typed test was already passed - redirect to MCQ practice mode
    if (mode === 'typed' && typedTestPassed[testPhase]) {
      actualMode = 'mcq'
      practiceMode = true
    }

    const route = actualMode === 'typed' ? '/typedtest' : '/mcqtest'

    // Store session state in sessionStorage for return
    sessionStorage.setItem('dailySessionState', JSON.stringify({
      classId,
      listId,
      dayNumber: sessionConfig.dayNumber,
      phase: testPhase === 'new' ? PHASES.NEW_WORD_TEST : PHASES.REVIEW_TEST,
      newWords,
      newWordTestResults,
      reviewQueue,
      sessionConfig,
      assignmentSettings
    }))

    navigate(`${route}/${classId}/${listId}`, {
      state: {
        testType: testPhase,
        wordPool: testPhase === 'new' ? newWords : null,
        returnPath: `/session/${classId}/${listId}`,
        practiceMode,
        wasTypedTest: actualMode === 'typed',
        sessionContext: {
          dayNumber: sessionConfig.dayNumber,
          phase: testPhase
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
        
        // Handle test results
        if (location.state?.testType === 'new') {
          setNewWordTestResults(results)
          setNewWordFailedIds(results?.failed || [])

          // Track if typed test was passed (95%+)
          const wasTypedTest = location.state?.wasTypedTest
          if (wasTypedTest && results?.score >= state.sessionConfig?.retakeThreshold) {
            setTypedTestPassed(prev => ({ ...prev, new: true }))
          }

          // Check if retake needed
          if (results?.score < state.sessionConfig?.retakeThreshold) {
            // Stay in new word test phase, show retake option
            setPhase(PHASES.NEW_WORD_TEST)
          } else {
            // Move to review
            await moveToReviewPhase()
          }
        } else {
          setReviewTestResults(results)

          // Track if typed test was passed (95%+) for review
          const wasTypedTest = location.state?.wasTypedTest
          if (wasTypedTest && results?.score >= 0.95) {
            setTypedTestPassed(prev => ({ ...prev, review: true }))
          }

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
        dayNumber: sessionConfig.dayNumber,
        interventionLevel: sessionConfig.interventionLevel,
        newWordScore: newWordTestResults?.score || null,
        reviewScore: reviewTestResults?.score || null,
        segment: sessionConfig.segment,
        wordsIntroduced: newWords.length,
        wordsReviewed: reviewQueue.length,
        wordsTested: (newWordTestResults?.total || 0) + (reviewTestResults?.total || 0)
      }

      const result = await recordSessionCompletion(user.uid, summary)

      setSessionSummary({
        ...summary,
        progress: result.progress
      })

      // Calculate progress info for "Next" button
      const progress = await getClassProgress(user.uid, classId, listId)
      const completedDays = progress?.currentStudyDay ?? 0
      const studyDaysPerWeek = assignmentSettings?.studyDaysPerWeek ?? 5
      const programStartDate = progress?.programStartDate?.toDate?.() || progress?.programStartDate
      const expectedDay = calculateExpectedStudyDay(programStartDate, studyDaysPerWeek)
      const difference = completedDays - expectedDay
      setProgressInfo({
        completedDays,
        expectedDay,
        difference,
        isOnTrack: difference >= 0
      })

      setPhase(PHASES.COMPLETE)
    } catch (err) {
      setError(err.message || 'Failed to record session')
    }
  }

  // ============================================================
  // Test Type Modal
  // ============================================================

  const handleTestTypeSelect = (mode) => {
    setShowTestTypeModal(false)
    navigateToTest(pendingTestPhase, mode)
  }

  // ============================================================
  // Confirmation Handlers
  // ============================================================

  const handleQuitConfirm = () => {
    setShowQuitConfirm(false)
    navigate('/')
  }

  const handleSkipConfirm = () => {
    setShowSkipConfirm(false)
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

  // Render based on current phase
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
                Day {sessionConfig?.dayNumber}
              </p>
              {sessionConfig?.interventionLevel > 0.25 && (
                <p className={`text-xs ${
                  sessionConfig.interventionLevel > 0.5
                    ? 'text-red-500'
                    : 'text-amber-500'
                }`}>
                  {sessionConfig.interventionLevel > 0.5 ? '⚠️ High' : '📊'} Intervention: {Math.round(sessionConfig.interventionLevel * 100)}%
                </p>
              )}
            </div>
            <PhaseIndicator phase={phase} hasReview={!!sessionConfig?.segment} />
          </div>

          {/* Right: Skip to Test button */}
          {(phase === PHASES.NEW_WORDS || phase === PHASES.REVIEW_STUDY) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSkipConfirm(true)}
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
            title="New Words"
            subtitle={`${newWordsQueue.length} words remaining`}
            currentWord={currentNewWord}
            currentIndex={currentIndex}
            totalCount={newWordsQueue.length}
            dismissedCount={newWordsDismissed.size}
            isFlipped={isFlipped}
            onFlip={() => setIsFlipped(!isFlipped)}
            onKnowThis={handleNewWordKnowThis}
            onNotSure={handleNewWordNotSure}
            onReset={() => setShowResetConfirm(true)}
            onFinish={handleFinishNewWordsStudy}
          />
        )}

        {phase === PHASES.NEW_WORD_TEST && (
          <div className="text-center">
            {newWordTestResults ? (
              // Show retake option if below threshold
              <RetakePrompt
                results={newWordTestResults}
                threshold={sessionConfig?.retakeThreshold}
                onRetake={handleNewWordTestRetake}
                onContinue={handleContinueToReview}
              />
            ) : (
              // Redirecting to test
              <div className="space-y-4">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                <p className="text-text-secondary">Loading test...</p>
              </div>
            )}
          </div>
        )}

        {phase === PHASES.REVIEW_STUDY && (
          <>
            <StudyPhase
              title="Review"
              subtitle={`${reviewQueueCurrent.length} words remaining`}
              currentWord={currentReviewWord}
              currentIndex={currentIndex}
              totalCount={reviewQueueCurrent.length}
              dismissedCount={reviewDismissed.size}
              isFlipped={isFlipped}
              onFlip={() => setIsFlipped(!isFlipped)}
              onKnowThis={handleReviewKnowThis}
              onNotSure={handleReviewNotSure}
              onReset={() => setShowResetConfirm(true)}
              onFinish={handleFinishReviewStudy}
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
            {reviewTestResults ? (
              // Auto-complete
              <div className="space-y-4">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                <p className="text-text-secondary">Completing session...</p>
              </div>
            ) : (
              // Redirecting to test
              <div className="space-y-4">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                <p className="text-text-secondary">Loading test...</p>
              </div>
            )}
          </div>
        )}

        {phase === PHASES.COMPLETE && (
          <CompletePhase
            summary={sessionSummary}
            onDashboard={() => navigate('/')}
            progressInfo={progressInfo}
            onNext={() => {
              if (progressInfo?.isOnTrack) {
                setShowNextSessionModal(true)
              } else {
                // Behind - reload the page to start new session
                window.location.reload()
              }
            }}
          />
        )}
      </div>

      {/* Test Type Selection Modal */}
      <TestTypeModal
        isOpen={showTestTypeModal}
        onClose={() => setShowTestTypeModal(false)}
        onSelect={handleTestTypeSelect}
        testPhase={pendingTestPhase}
        typedTestPassed={typedTestPassed[pendingTestPhase]}
      />

      {/* Quit Confirmation */}
      <ConfirmModal
        isOpen={showQuitConfirm}
        title="Leave Study Session?"
        message="Your flashcard progress will be lost. Test progress is saved separately."
        confirmLabel="Leave"
        cancelLabel="Keep Studying"
        onConfirm={handleQuitConfirm}
        onCancel={() => setShowQuitConfirm(false)}
        variant="danger"
      />

      {/* Skip to Test Confirmation */}
      <ConfirmModal
        isOpen={showSkipConfirm}
        title="Skip to Test?"
        message={`You still have ${currentQueueLength} cards remaining. Are you ready to test?`}
        confirmLabel="Start Test"
        cancelLabel="Keep Studying"
        onConfirm={handleSkipConfirm}
        onCancel={() => setShowSkipConfirm(false)}
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

      {/* Complete Mode Explanation */}
      <ReviewModeModal
        isOpen={showCompleteModeModal}
        mode="complete"
        wordCount={sessionConfig?.segment ? (sessionConfig.segment.endIndex - sessionConfig.segment.startIndex + 1) : 0}
        onConfirm={handleSwitchToCompleteMode}
        onCancel={() => setShowCompleteModeModal(false)}
      />

      {/* Fast Mode Explanation */}
      <ReviewModeModal
        isOpen={showFastModeModal}
        mode="fast"
        wordCount={sessionConfig?.reviewCount || 0}
        onConfirm={handleSwitchToFastMode}
        onCancel={() => setShowFastModeModal(false)}
      />

      {/* Next Session Modal (On Track Prompt) */}
      {showNextSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <span className="text-2xl">✓</span>
              </div>
            </div>

            <h3 className="text-center text-lg font-bold text-text-primary">
              You&apos;re on track!
            </h3>
            <p className="mt-2 text-center text-sm text-text-secondary">
              {progressInfo?.difference > 0
                ? `You're ${progressInfo.difference} day${progressInfo.difference > 1 ? 's' : ''} ahead. Great work!`
                : 'You\'ve completed today\'s session.'}
            </p>
            <p className="mt-2 text-center text-sm text-text-muted">
              Starting another session isn&apos;t necessary, but you can get ahead if you want.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <Button
                onClick={() => {
                  setShowNextSessionModal(false)
                  window.location.reload()
                }}
                variant="primary-blue"
                size="lg"
                className="w-full"
              >
                Start Next Session
              </Button>
              <button
                type="button"
                onClick={() => {
                  setShowNextSessionModal(false)
                  navigate('/')
                }}
                className="w-full text-center text-sm text-text-muted hover:text-text-secondary"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
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
  onFinish
}) {
  if (!currentWord) {
    return (
      <div className="text-center">
        <p className="text-text-secondary">All cards reviewed!</p>
        <Button onClick={onFinish} className="mt-4">
          Continue to Test
        </Button>
      </div>
    )
  }

  // Handle "Not Sure" - if not flipped, flip the card; if flipped, move to end
  const handleNotSure = () => {
    if (!isFlipped) {
      onFlip()
    } else {
      onNotSure()
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-text-primary">{title}</h2>
        <p className="text-sm text-text-secondary">{subtitle}</p>
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

      {/* Action Buttons - always visible */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <Button onClick={handleNotSure} variant="outline" className="flex-1">
            {isFlipped ? 'Not Sure' : 'Show Definition'}
          </Button>
          <Button onClick={onKnowThis} variant="success" className="flex-1">
            I Know This
          </Button>
        </div>

        {/* Reset button - only show when there are dismissed cards */}
        {dismissedCount > 0 && (
          <Button onClick={onReset} variant="ghost" className="w-full text-text-muted">
            Reset ({dismissedCount} dismissed)
          </Button>
        )}
      </div>
    </div>
  )
}

function RetakePrompt({ results, threshold, onRetake, onContinue }) {
  const percentage = Math.round(results.score * 100)
  const needsRetake = results.score < threshold

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-surface p-6 shadow ring-1 ring-border-default">
        <p className="text-4xl font-bold text-text-primary">{percentage}%</p>
        <p className="text-text-secondary">
          {results.correct} of {results.total} correct
        </p>
      </div>

      {needsRetake && (
        <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            Score below {Math.round(threshold * 100)}%
          </p>
          <p className="mt-1 text-sm text-amber-600 dark:text-amber-300">
            Retake recommended for new word tests
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {needsRetake && (
          <Button onClick={onRetake} variant="primary-blue">
            Retake Test
          </Button>
        )}
        <Button onClick={onContinue} variant={needsRetake ? 'outline' : 'primary-blue'}>
          {needsRetake ? 'Continue Anyway' : 'Continue to Review'}
        </Button>
      </div>
    </div>
  )
}

function TestTypeModal({ isOpen, onClose, onSelect, testPhase, typedTestPassed }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl">
        <h3 className="text-lg font-bold text-text-primary">
          Choose Test Type
        </h3>
        <p className="mt-2 text-sm text-text-secondary">
          {testPhase === 'new' ? 'New Word Test' : 'Review Test'}
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Button
            onClick={() => { onClose(); onSelect('mcq'); }}
            variant="outline"
            size="lg"
            className="w-full"
          >
            Multiple Choice
          </Button>
          <div className="relative">
            <Button
              onClick={() => { onClose(); onSelect('typed'); }}
              variant="outline"
              size="lg"
              className="w-full"
            >
              Written
            </Button>
            {typedTestPassed && (
              <p className="mt-1 text-center text-xs text-amber-600">
                (You passed — this will be practice mode)
              </p>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full text-center text-sm text-text-muted hover:text-text-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function CompletePhase({ summary, onDashboard, progressInfo, onNext }) {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
        <span className="text-3xl">✓</span>
      </div>

      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
          Session Complete
        </p>
        <h2 className="mt-1 text-2xl font-bold text-text-primary">Great Job!</h2>
      </div>

      {/* Progress indicator */}
      {progressInfo && (
        <div className={`rounded-lg px-4 py-2 text-sm font-medium ${
          progressInfo.isOnTrack
            ? progressInfo.difference > 0
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
              : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
            : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
        }`}>
          {progressInfo.isOnTrack
            ? progressInfo.difference > 0
              ? `${progressInfo.difference} day${progressInfo.difference > 1 ? 's' : ''} ahead!`
              : 'On track!'
            : `${Math.abs(progressInfo.difference)} day${Math.abs(progressInfo.difference) > 1 ? 's' : ''} behind`}
        </div>
      )}

      <div className="rounded-xl bg-surface p-6 shadow ring-1 ring-border-default">
        <div className="grid grid-cols-2 gap-4 text-left">
          <div>
            <p className="text-sm text-text-muted">Day</p>
            <p className="font-semibold text-text-primary">{summary?.dayNumber}</p>
          </div>
          <div>
            <p className="text-sm text-text-muted">New Words</p>
            <p className="font-semibold text-text-primary">{summary?.wordsIntroduced}</p>
          </div>
          <div>
            <p className="text-sm text-text-muted">New Word Score</p>
            <p className="font-semibold text-text-primary">
              {summary?.newWordScore ? `${Math.round(summary.newWordScore * 100)}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-sm text-text-muted">Review Score</p>
            <p className="font-semibold text-text-primary">
              {summary?.reviewScore ? `${Math.round(summary.reviewScore * 100)}%` : '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Button onClick={onDashboard} variant="primary-blue" size="lg" className="w-full">
          Back to Dashboard
        </Button>
        <Button onClick={onNext} variant="outline" size="lg" className="w-full">
          Next
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
                Recommended if you&apos;re struggling with review tests.
              </p>
              <p className="text-blue-600 dark:text-blue-400">
                You&apos;ll study all {wordCount} words before testing.
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Smart selection based on your performance
              </p>
              <p className="text-amber-700 dark:text-amber-300">
                If you&apos;re doing well on tests, this minimal review is sufficient.
                Focuses on words you&apos;ve struggled with.
              </p>
              <p className="text-amber-600 dark:text-amber-400">
                Prioritizes ~{wordCount} words that need attention.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1"
          >
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
