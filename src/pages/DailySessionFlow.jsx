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
      
      {/* Phase indicator */}
      <div className="relative z-10 border-b border-border-default bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
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
            onReset={handleNewWordReset}
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
            onReset={handleReviewReset}
            onFinish={handleFinishReviewStudy}
          />
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

      {/* Buttons */}
      {isFlipped ? (
        <div className="space-y-3">
          <div className="flex gap-3">
            <Button onClick={onNotSure} variant="outline" className="flex-1">
              Not Sure
            </Button>
            <Button onClick={onKnowThis} variant="success" className="flex-1">
              I Know This
            </Button>
          </div>
          {dismissedCount > 0 && (
            <Button onClick={onReset} variant="ghost" className="w-full">
              Reset Session ({dismissedCount} dismissed)
            </Button>
          )}
          <Button onClick={onFinish} variant="outline" className="w-full">
            Skip to Test →
          </Button>
        </div>
      ) : (
        <p className="text-center text-sm text-text-muted">
          Tap the card to reveal
        </p>
      )}
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

function CompletePhase({ summary, onDashboard }) {
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

      <Button onClick={onDashboard} variant="primary-blue" size="lg" className="w-full">
        Back to Dashboard
      </Button>
    </div>
  )
}

