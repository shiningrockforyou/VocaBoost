import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, collection, query, orderBy, getDocs } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext.jsx'
import { db } from '../firebase'
import { submitTestAttempt } from '../services/db'
import { useSimulationContext, isSimulationEnabled } from '../hooks/useSimulation.jsx'
import {
  initializeDailySession,
  getNewWords,
  getSegmentWords,
  processTestResults,
  selectTestWords
} from '../services/studyService'
import { getOrCreateClassProgress } from '../services/progressService'
import { speak } from '../utils/tts'
import { STUDY_ALGORITHM_CONSTANTS, shuffleArray } from '../utils/studyAlgorithm'
import {
  getTestId,
  saveTestState,
  getTestState,
  clearTestState,
  getRecoveryTimeRemaining,
  markIntentionalExit,
  wasIntentionalExit,
  clearIntentionalExitFlag
} from '../utils/testRecovery'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import TestResults from '../components/TestResults.jsx'
import Watermark from '../components/Watermark.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import SessionHeader, { GreyedMenuIcon } from '../components/SessionHeader.jsx'
import SessionProgressSheet from '../components/SessionProgressSheet.jsx'
import { Button } from '../components/ui'
import { Trophy, X, LayoutGrid, TrendingUp, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'

const MCQTest = () => {
  const { classId, listId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  
  // Get navigation state
  const {
    testConfig = null,
    returnPath = '/',
    practiceMode = false,
    // Legacy props for backwards compatibility
    testType: legacyTestType = 'review',
    wordPool: legacyWordPool = null,
    sessionContext: legacySessionContext = null,
    assignmentSettings: legacyAssignmentSettings = null
  } = location.state || {}

  // Derive values from testConfig or legacy props
  const testType = testConfig?.testType || legacyTestType
  const wordPool = testConfig?.wordsToTest || legacyWordPool
  const sessionContext = testConfig || legacySessionContext
  const assignmentSettings = legacyAssignmentSettings

  // Also check query params for backwards compatibility
  const searchParams = new URLSearchParams(location.search)
  const testTypeParam = searchParams.get('type') || testType
  const classIdParam = searchParams.get('classId') || classId

  const [listDetails, setListDetails] = useState(null)
  const [testWords, setTestWords] = useState([])
  const [originalWords, setOriginalWords] = useState([])
  const [answers, setAnswers] = useState({})
  const answersRef = useRef({})  // Sync copy to avoid race condition on submit
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [testResultsData, setTestResultsData] = useState(null)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [attemptId, setAttemptId] = useState(null)
  const [currentTestType, setCurrentTestType] = useState(testTypeParam)
  const [canRetake, setCanRetake] = useState(false)
  const [retakeThreshold, setRetakeThreshold] = useState(0.95)
  const [optionsCount, setOptionsCount] = useState(4)
  const [showResults, setShowResults] = useState(false)
  const [configuredTestSize, setConfiguredTestSize] = useState(30)

  // Modal states
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false)
  const [savedRecoveryState, setSavedRecoveryState] = useState(null)
  const [recoveryTimeRemaining, setRecoveryTimeRemaining] = useState(null)
  const [showProgressSheet, setShowProgressSheet] = useState(false)

  // Practice mode (after passing, test doesn't save)
  const [isPracticeMode] = useState(practiceMode)

  // Test ID for recovery
  const testId = getTestId(classIdParam || classId, listId, currentTestType)

  // Simulation mode integration
  const sim = useSimulationContext()
  const autoAnswerTimerRef = useRef(null)

  // Auto-answer effect for simulation mode
  useEffect(() => {
    if (!sim?.isAutoMode || !isSimulationEnabled()) return
    if (loading || showResults || submitting) return
    if (testWords.length === 0) return

    const currentWord = testWords[currentIndex]
    if (!currentWord || answers[currentWord.id]) return // Already answered

    // Find the correct answer index
    const correctIndex = currentWord.options.findIndex(opt => opt.isCorrect)

    // Get auto-answer based on simulation profile accuracy
    const selectedIndex = sim.getAutoAnswer(correctIndex, currentWord.options.length)
    const selectedOption = currentWord.options[selectedIndex]

    // Delay based on simulation speed
    const delay = sim.speed?.testDelay ?? 100

    autoAnswerTimerRef.current = setTimeout(() => {
      // Select the answer
      handleAnswerSelect(currentWord.id, selectedOption)

      // Move to next question or submit
      if (currentIndex < testWords.length - 1) {
        setCurrentIndex(prev => prev + 1)
      } else {
        // All questions answered, auto-submit
        setTimeout(() => {
          handleSubmit()
        }, delay)
      }
    }, delay)

    return () => clearTimeout(autoAnswerTimerRef.current)
  }, [sim?.isAutoMode, currentIndex, testWords, answers, loading, showResults, submitting])

  // Browser close warning + intentional exit tracking
  useEffect(() => {
    const hasProgress = Object.keys(answers).length > 0 && !showResults

    const handleBeforeUnload = (e) => {
      if (hasProgress) {
        // Mark as intentional exit - if user clicks "Leave", this flag tells us
        // If user clicks "Stay", we clear it on next interaction
        markIntentionalExit(testId)
        e.preventDefault()
        e.returnValue = 'You have unsaved test progress. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    // Clear intentional exit flag on any user interaction (handles "Stay" case)
    const handleInteraction = () => {
      clearIntentionalExitFlag(testId)
    }

    if (hasProgress) {
      window.addEventListener('beforeunload', handleBeforeUnload)
      // Listen for user interaction to clear flag if they chose "Stay"
      window.addEventListener('click', handleInteraction, { once: true })
      window.addEventListener('keydown', handleInteraction, { once: true })
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
    }
  }, [answers, showResults, testId])

  const loadList = useCallback(async () => {
    if (!listId) return
    try {
      const listRef = doc(db, 'lists', listId)
      const listSnap = await getDoc(listRef)
      if (!listSnap.exists()) {
        throw new Error('List not found.')
      }
      setListDetails({ id: listSnap.id, ...listSnap.data() })
    } catch (err) {
      setError(err.message ?? 'Unable to load list.')
    }
  }, [listId])

  useEffect(() => {
    loadList()
  }, [loadList])

  const generateQuestions = (words, numOptions = null) => {
    const effectiveOptionsCount = numOptions ?? optionsCount
    const testWordsWithOptions = words.map(word => {
      const otherWords = originalWords.length > 0
        ? originalWords.filter(w => w.id !== word.id)
        : words.filter(w => w.id !== word.id)
      const shuffledOthers = shuffleArray(otherWords)
      // Use optionsCount from assignment (optionsCount - 1 distractors + 1 correct = optionsCount total)
      const distractors = shuffledOthers.slice(0, effectiveOptionsCount - 1).map(w => ({
        wordId: w.id,
        definition: w.definition,
        isCorrect: false
      }))

      const options = shuffleArray([
        { wordId: word.id, definition: word.definition, isCorrect: true },
        ...distractors
      ])

      return {
        ...word,
        options
      }
    })

    setTestWords(testWordsWithOptions)
    setCurrentIndex(0)
    setAnswers({})
    answersRef.current = {}
    setShowResults(false)
    setCanRetake(false)
  }

  const loadTestWords = useCallback(async () => {
    if (!user?.uid || !listId) return
    setLoading(true)
    setError('')
    try {
      // PATH A: TestConfig provided (from DailySessionFlow with new flow)
      if (testConfig) {
        // All settings come from testConfig - no need to fetch or apply manually
        setOptionsCount(testConfig.testOptionsCount)
        setRetakeThreshold(testConfig.passThresholdDecimal)
        setCurrentTestType(testConfig.testType)
        const effectiveTestSize = testConfig.testType === 'new' ? testConfig.testSizeNew : testConfig.testSizeReview
        setConfiguredTestSize(effectiveTestSize)
        setOriginalWords(testConfig.originalWordPool)
        generateQuestions(testConfig.wordsToTest, testConfig.testOptionsCount)
        setLoading(false)
        return
      }

      // PATH B: Legacy wordPool provided (backwards compatibility)
      if (wordPool && wordPool.length > 0) {
        // Apply assignment settings if provided
        const numOptions = assignmentSettings?.testOptionsCount || 4
        const threshold = (assignmentSettings?.passThreshold || 95) / 100
        setOptionsCount(numOptions)
        setRetakeThreshold(threshold)
        setOriginalWords(wordPool)
        generateQuestions(wordPool, numOptions)
        setLoading(false)
        return
      }

      // Otherwise, use smart selection based on test type
      if (!classIdParam) {
        throw new Error('Class ID required for smart selection')
      }

      const classRef = doc(db, 'classes', classIdParam)
      const classSnap = await getDoc(classRef)
      if (!classSnap.exists()) {
        throw new Error('Class not found')
      }

      const assignment = classSnap.data()?.assignments?.[listId]
      if (!assignment) {
        throw new Error('Assignment not found')
      }

      // Set pass threshold from assignment (stored as percentage, convert to decimal)
      setRetakeThreshold((assignment.passThreshold || 95) / 100)
      // Set MCQ options count from assignment
      setOptionsCount(assignment.testOptionsCount || 4)

      const testSize = currentTestType === 'new'
        ? (assignment.testSizeNew || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_NEW)
        : (assignment.testSizeReview || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_REVIEW)
      setConfiguredTestSize(testSize)

      let wordsToTest = []

      if (currentTestType === 'new') {
        // Get today's new words
        const config = await initializeDailySession(user.uid, classIdParam, listId, {
          weeklyPace: assignment.pace * 7 || STUDY_ALGORITHM_CONSTANTS.DEFAULT_WEEKLY_PACE,
          studyDaysPerWeek: STUDY_ALGORITHM_CONSTANTS.DEFAULT_STUDY_DAYS_PER_WEEK,
          testSizeNew: assignment.testSizeNew || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_NEW,
          testSizeReview: assignment.testSizeReview || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_REVIEW,
          newWordRetakeThreshold: STUDY_ALGORITHM_CONSTANTS.DEFAULT_RETAKE_THRESHOLD
        })

        if (config.newWordCount > 0) {
          const newWords = await getNewWords(listId, config.newWordStartIndex, config.newWordCount)
          wordsToTest = selectTestWords(newWords, testSize)
        } else {
          throw new Error('No new words available for testing')
        }
      } else {
        // Get review segment words
        const config = await initializeDailySession(user.uid, classIdParam, listId, {
          weeklyPace: assignment.pace * 7 || STUDY_ALGORITHM_CONSTANTS.DEFAULT_WEEKLY_PACE,
          studyDaysPerWeek: STUDY_ALGORITHM_CONSTANTS.DEFAULT_STUDY_DAYS_PER_WEEK,
          testSizeNew: assignment.testSizeNew || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_NEW,
          testSizeReview: assignment.testSizeReview || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_REVIEW,
          newWordRetakeThreshold: STUDY_ALGORITHM_CONSTANTS.DEFAULT_RETAKE_THRESHOLD
        })
        
        if (config.segment) {
          const segmentWords = await getSegmentWords(
            user.uid,
            listId,
            config.segment.startIndex,
            config.segment.endIndex
          )
          wordsToTest = selectTestWords(segmentWords, testSize)
        } else {
          // Fallback: load all words if no segment (day 1)
          const wordsRef = collection(db, 'lists', listId, 'words')
          const snap = await getDocs(query(wordsRef, orderBy('position', 'asc')))
          const allWords = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          wordsToTest = selectTestWords(allWords, testSize)
        }
      }

      if (wordsToTest.length === 0) {
        throw new Error('No words available for testing.')
      }

      setOriginalWords(wordsToTest)
      generateQuestions(wordsToTest)
    } catch (err) {
      setError(err.message || 'Failed to load test')
    } finally {
      setLoading(false)
    }
  }, [user?.uid, listId, classIdParam, currentTestType, wordPool, testConfig])

  useEffect(() => {
    loadTestWords()
  }, [loadTestWords])

  // Check for recoverable test state on mount
  useEffect(() => {
    if (!testId || loading) return

    const saved = getTestState(testId)
    if (saved && Object.keys(saved.answers || {}).length > 0) {
      // Check if user left intentionally (via beforeunload dialog)
      if (wasIntentionalExit(testId)) {
        // User intentionally left - clear saved state and start fresh
        clearTestState(testId)
        return
      }
      // Unintentional exit (crash/disconnect) - offer recovery
      setSavedRecoveryState(saved)
      setRecoveryTimeRemaining(getRecoveryTimeRemaining(testId))
      setShowRecoveryPrompt(true)
    }
  }, [testId, loading])

  // Save test state on each answer (for recovery)
  useEffect(() => {
    if (!testId || testWords.length === 0 || showResults) return

    const wordIds = testWords.map(w => w.id)
    if (Object.keys(answers).length > 0) {
      saveTestState(testId, answers, wordIds, currentIndex)
    }
  }, [answers, testId, testWords, currentIndex, showResults])

  // Handle recovery - restore saved answers
  const handleRecoveryResume = () => {
    // Clear any stale intentional exit flag
    clearIntentionalExitFlag(testId)
    if (savedRecoveryState?.answers) {
      setAnswers(savedRecoveryState.answers)
      answersRef.current = { ...savedRecoveryState.answers }
      if (savedRecoveryState.currentIndex !== undefined) {
        setCurrentIndex(savedRecoveryState.currentIndex)
      }
    }
    setShowRecoveryPrompt(false)
    setSavedRecoveryState(null)
  }

  // Handle recovery - start fresh
  const handleRecoveryStartFresh = () => {
    clearTestState(testId)
    setShowRecoveryPrompt(false)
    setSavedRecoveryState(null)
  }

  const handleAnswerSelect = (wordId, option) => {
    // Update ref synchronously (for reliable submit)
    answersRef.current[wordId] = option
    // Update state for UI
    setAnswers((prev) => ({
      ...prev,
      [wordId]: option,
    }))

    // Auto-advance to next question (unless on last question)
    if (currentIndex < testWords.length - 1) {
      setCurrentIndex(prev => prev + 1)
    }
  }

  // Navigation functions
  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const goToNext = () => {
    if (currentIndex < testWords.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showResults || submitting) return
      if (e.key === 'ArrowLeft') {
        goToPrev()
      } else if (e.key === 'ArrowRight') {
        goToNext()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, testWords.length, showResults, submitting])

  const handleSubmit = async () => {
    if (submitting || !user?.uid || !listId) return

    setSubmitting(true)
    setError('')

    try {
      // Clear saved test state
      clearTestState(testId)

      // Build results array (read from ref for sync access)
      const currentAnswers = answersRef.current
      const results = testWords.map((word) => {
        const selectedOption = currentAnswers[word.id]
        return {
          wordId: word.id,
          correct: selectedOption?.isCorrect || false
        }
      })

      // DEBUG: Log all results to find the mismatch
      console.log('DEBUG MCQ Results:', {
        testWordsCount: testWords.length,
        answersCount: Object.keys(currentAnswers).length,
        results: results.map((r, i) => ({
          index: i + 1,
          wordId: r.wordId,
          correct: r.correct,
          hasAnswer: !!currentAnswers[r.wordId],
          answerIsCorrect: currentAnswers[r.wordId]?.isCorrect
        }))
      })

      if (results.length === 0) {
        setError('Please answer at least one question before submitting.')
        setSubmitting(false)
        return
      }

      // Process test results (updates word statuses) - skip if practice mode
      let summary
      if (isPracticeMode) {
        // Calculate score locally without saving
        const correct = results.filter(r => r.correct).length
        summary = {
          score: correct / results.length,
          correct,
          total: results.length,
          failed: results.filter(r => !r.correct).map(r => r.wordId)
        }
      } else {
        summary = await processTestResults(user.uid, results, listId)
      }

      // Calculate score
      const score = summary.score
      const percentage = Math.round(score * 100)

      // Check if retake is available (new word test below threshold)
      if (currentTestType === 'new' && score < retakeThreshold) {
        setCanRetake(true)
      }

      // Store results for display
      const answerArray = Object.entries(answers).map(([wordId, option]) => {
        const testWord = testWords.find((w) => w.id === wordId)
        return {
          wordId,
          word: testWord?.word || '',
          correctAnswer: testWord?.definition || '',
          studentResponse: option?.definition || '',
          isCorrect: option?.isCorrect || false,
        }
      })

      // Submit attempt for gradebook (non-practice mode only)
      if (!isPracticeMode) {
        // Get studyDay from sessionContext, or fetch from progress if standalone test
        let studyDay = sessionContext?.dayNumber
        if (!studyDay && user?.uid && classIdParam && listId) {
          try {
            const progress = await getOrCreateClassProgress(user.uid, classIdParam, listId)
            studyDay = (progress.currentStudyDay || 0) + 1
          } catch (err) {
            console.error('Failed to fetch studyDay from progress:', err)
          }
        }

        const result = await submitTestAttempt(
          user.uid,
          testId,
          answerArray,
          testWords.length,
          classIdParam,
          'mcq',
          currentTestType,
          studyDay || null
        )
        setAttemptId(result.id)
      }

      setTestResultsData({
        score: summary.score, // Store as decimal (0-1), not percentage
        correct: summary.correct,
        total: summary.total,
        failed: summary.failed,
        testType: currentTestType,
        answerArray
      })

      setShowResults(true)
    } catch (err) {
      setError(err.message || 'Failed to submit test')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetake = () => {
    // Reset test state
    setAnswers({})
    answersRef.current = {}
    setCurrentIndex(0)
    setShowResults(false)
    setCanRetake(false)
    setTestResultsData(null)

    // Re-shuffle words for retake - use configured test size, not full pool size
    const shuffled = selectTestWords(originalWords, configuredTestSize)
    generateQuestions(shuffled)
  }

  const handleFinish = () => {
    if (returnPath) {
      navigate(returnPath, {
        state: {
          testCompleted: true,
          testType: currentTestType,
          results: testResultsData
        }
      })
    } else {
      navigate('/')
    }
  }

  // Quit test with confirmation - always go to Dashboard
  const handleQuitConfirm = () => {
    clearTestState(testId)
    setShowQuitConfirm(false)
    navigate('/')
  }

  const handlePlayAudio = async (word) => {
    if (!word || isPlayingAudio) return
    setIsPlayingAudio(true)
    try {
      await speak(word)
    } catch (error) {
      console.error('Failed to play audio:', error)
    } finally {
      setIsPlayingAudio(false)
    }
  }

  if (loading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-base">
        <Watermark />
        <div className="relative z-10">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    )
  }

  if (error && !showResults) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-base px-4">
        <Watermark />
        <div className="relative z-10 max-w-md rounded-2xl bg-surface p-8 text-center shadow-lg">
          <p className="text-lg font-semibold text-text-primary">Something went wrong</p>
          <p className="mt-3 text-sm text-text-muted">{error}</p>
          <Button variant="primary-blue" size="lg" onClick={loadTestWords} className="mt-6">
            Try Again
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate(returnPath || '/')} className="mt-4">
            Go Back
          </Button>
        </div>
      </main>
    )
  }

  if (showResults && testResultsData) {
    // Format data for TestResults component
    const formattedWords = testWords.map(w => ({
      id: w.id,
      word: w.word,
      definition: w.definition,
    }))

    const userAnswers = {}
    Object.entries(answers).forEach(([wordId, option]) => {
      userAnswers[wordId] = option?.definition || ''
    })

    const resultsArray = Object.entries(answers).map(([wordId, option]) => ({
      wordId,
      isCorrect: option?.isCorrect || false,
    }))

    // Calculate step numbers for SessionHeader
    const resultsStepNumber = sessionContext?.phase === 'new' ? 2 : 4
    const resultsTotalSteps = sessionContext?.isFirstDay ? 3 : 5

    const score = testResultsData.score // Decimal 0-1
    const scorePercent = Math.round(score * 100)
    const dayNumber = sessionContext?.dayNumber || 1

    // Render results card based on test type
    const renderResultsCard = () => {
      // New Word Test: Pass/Fail based on threshold
      if (currentTestType === 'new') {
        const passed = score >= retakeThreshold

        return (
          <div className={`rounded-2xl p-8 text-center shadow-xl ${
            passed
              ? 'bg-success ring-2 ring-ring-success'
              : 'bg-error ring-2 ring-ring-error'
          }`}>
            {/* Icon */}
            <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
              passed ? 'bg-success-subtle' : 'bg-error-subtle border-2 border-white'
            }`}>
              {passed ? (
                <Trophy className="w-8 h-8 text-text-on-success" />
              ) : (
                <X className="w-8 h-8 text-text-on-error" />
              )}
            </div>

            {/* Header */}
            <h2 className={`text-xl font-bold ${passed ? 'text-text-on-success' : 'text-text-on-error'}`}>
              {passed ? 'New Words Test Passed!' : 'Did not pass'}
            </h2>

            {!passed && (
              <p className="mt-1 text-sm text-text-on-error-muted">
                Your score is below {Math.round(retakeThreshold * 100)}%
              </p>
            )}

            {/* Score */}
            <p className={`mt-4 text-4xl font-bold ${passed ? 'text-text-on-success' : 'text-text-on-error'}`}>
              {scorePercent}%
            </p>
            <p className={passed ? 'text-text-on-success-muted' : 'text-text-on-error-muted'}>
              {testResultsData.correct} of {testResultsData.total} correct
            </p>

            {/* Buttons */}
            <div className="mt-6">
              {passed ? (
                <Button
                  variant="primary-blue"
                  size="lg"
                  onClick={handleFinish}
                  className="inline-flex items-center gap-2"
                >
                  <LayoutGrid className="w-5 h-5" />
                  Continue
                </Button>
              ) : (
                <div className="flex justify-center gap-4">
                  <Button
                    variant="primary-blue"
                    size="lg"
                    onClick={handleRetake}
                    className="flex-1 max-w-[140px]"
                  >
                    Retake
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => navigate('/')}
                    className="flex-1 max-w-[140px]"
                  >
                    Dashboard
                  </Button>
                </div>
              )}
            </div>
          </div>
        )
      }

      // Review Test: 4-tier system (compare percentage values)
      const tier = scorePercent >= 85 ? 'excellent'
                 : scorePercent >= 70 ? 'good'
                 : scorePercent >= 50 ? 'needs-work'
                 : 'critical'

      const tierConfig = {
        excellent: {
          bg: 'bg-success ring-2 ring-ring-success',
          iconBg: 'bg-success-subtle',
          icon: <Trophy className="w-8 h-8 text-text-on-success" />,
          header: 'Great Work!',
          headerColor: 'text-text-on-success',
          subtext: "You're mastering these words",
          subtextColor: 'text-text-on-success-muted',
          scoreColor: 'text-text-on-success',
        },
        good: {
          bg: 'bg-warning ring-2 ring-ring-warning',
          iconBg: 'bg-warning-subtle',
          icon: <TrendingUp className="w-8 h-8 text-text-on-warning" />,
          header: 'Room for Improvement',
          headerColor: 'text-text-on-warning',
          subtext: 'Consider reviewing before moving on',
          subtextColor: 'text-text-on-warning-muted',
          scoreColor: 'text-text-on-warning',
        },
        'needs-work': {
          bg: 'bg-error ring-2 ring-ring-error',
          iconBg: 'bg-error-subtle border-2 border-white',
          icon: <X className="w-8 h-8 text-text-on-error" />,
          header: 'Keep Practicing',
          headerColor: 'text-text-on-error',
          subtext: 'Your score affects tomorrow\'s pacing',
          subtextColor: 'text-text-on-error-muted',
          scoreColor: 'text-text-on-error',
        },
        critical: {
          bg: 'bg-error-critical ring-2 ring-ring-error-critical',
          iconBg: 'bg-error-subtle',
          icon: <AlertTriangle className="w-8 h-8 text-white" />,
          header: 'Needs Attention',
          headerColor: 'text-white',
          subtext: 'Low scores significantly slow your progress',
          subtextColor: 'text-white/80',
          scoreColor: 'text-white',
        },
      }

      const config = tierConfig[tier]

      return (
        <div className={`rounded-2xl p-8 text-center shadow-xl ${config.bg}`}>
          {/* Icon */}
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${config.iconBg}`}>
            {config.icon}
          </div>

          {/* Header */}
          <h2 className={`text-xl font-bold ${config.headerColor}`}>
            {config.header}
          </h2>
          <p className={`mt-1 text-sm ${config.subtextColor}`}>
            {config.subtext}
          </p>

          {/* Score */}
          <p className={`mt-4 text-4xl font-bold ${config.scoreColor}`}>
            {scorePercent}%
          </p>
          <p className={config.subtextColor}>
            {testResultsData.correct} of {testResultsData.total} correct
          </p>

          {/* Buttons based on tier */}
          <div className="mt-6">
            {tier === 'excellent' && (
              <Button
                variant="primary"
                size="lg"
                onClick={handleFinish}
                className="inline-flex items-center gap-2"
              >
                <LayoutGrid className="w-5 h-5" />
                Return to Dashboard
              </Button>
            )}

            {tier === 'good' && (
              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleFinish}
                  className="flex-1 max-w-[140px]"
                >
                  Continue
                </Button>
                <Button
                  variant="warning"
                  size="lg"
                  onClick={handleRetake}
                  className="flex-1 max-w-[160px]"
                >
                  Review Again
                </Button>
              </div>
            )}

            {tier === 'needs-work' && (
              <div className="flex justify-center gap-4">
                <Button
                  variant="danger"
                  size="lg"
                  onClick={handleRetake}
                  className="flex-1 max-w-[160px]"
                >
                  Retake Test
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleFinish}
                  className="flex-1 max-w-[160px]"
                >
                  Dashboard
                </Button>
              </div>
            )}

            {tier === 'critical' && (
              <div className="flex justify-center gap-4">
                <Button
                  variant="danger"
                  size="lg"
                  onClick={handleRetake}
                  className="flex-1 max-w-[160px]"
                >
                  Retake Test
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleFinish}
                  className="flex-1 max-w-[160px]"
                >
                  Dashboard
                </Button>
              </div>
            )}
          </div>
        </div>
      )
    }

    return (
      <main className="relative flex min-h-screen flex-col bg-muted">
        <Watermark />

        <SessionHeader
          onBack={handleFinish}
          backAriaLabel="Back to session"
          stepText={`Step ${resultsStepNumber} of ${resultsTotalSteps}`}
          onStepClick={() => setShowProgressSheet(true)}
          rightSlot={<GreyedMenuIcon />}
          sessionTitle={currentTestType === 'new' ? 'New Words Test' : 'Review Test'}
          dayNumber={dayNumber}
        />

        {/* Scrollable content area */}
        <div className="relative z-10 flex-1 overflow-y-auto px-4 py-8">
          <div className="mx-auto w-full max-w-2xl space-y-6">
            {/* Card 1: Results Summary */}
            {renderResultsCard()}

            {/* Card 2: Detailed results */}
            <TestResults
              testType="mcq"
              listTitle={listDetails?.title}
              words={formattedWords}
              responses={userAnswers}
              results={resultsArray}
              attemptId={attemptId}
            />
          </div>
        </div>

        <SessionProgressSheet
          isOpen={showProgressSheet}
          onClose={() => setShowProgressSheet(false)}
          currentPhase={currentTestType === 'new' ? 'new_word_test' : 'review_test'}
          isFirstDay={sessionContext?.isFirstDay}
        />
      </main>
    )
  }

  if (!testWords.length) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-base px-4">
        <Watermark />
        <div className="relative z-10 max-w-md rounded-2xl bg-surface p-8 text-center shadow-lg">
          <p className="text-lg font-semibold text-text-primary">No Test Content</p>
          <p className="mt-3 text-sm text-text-muted">Your teacher hasn't assigned enough words yet.</p>
          <Button variant="outline" size="lg" onClick={() => navigate(returnPath || '/')} className="mt-6">
            Go Back
          </Button>
        </div>
      </main>
    )
  }

  // Active Test Screen
  const currentWord = testWords[currentIndex]
  const progress = ((currentIndex + 1) / testWords.length) * 100
  const answeredCount = Object.keys(answers).length

  return (
    <main className="relative flex min-h-screen flex-col bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-900">
      <Watermark />
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Progress Bar & Quit Button */}
        <div className="sticky top-0 z-10 border-b border-border-default bg-surface/80 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between text-xs text-text-secondary">
                <span>
                  Question {currentIndex + 1} of {testWords.length}
                </span>
                <span>{answeredCount} answered</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-inset">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowQuitConfirm(true)} disabled={submitting}>
              ← Quit
            </Button>
          </div>
        </div>

        {/* Session Context Header */}
        {sessionContext && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-center dark:bg-blue-900/20 dark:border-blue-800">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
              {currentTestType === 'new' ? 'New Words Test' : 'Review Test'} — Day {sessionContext?.dayNumber}
            </p>
            {sessionContext.wordRangeStart && sessionContext.wordRangeEnd && (
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Words #{sessionContext.wordRangeStart}–{sessionContext.wordRangeEnd}
              </p>
            )}
          </div>
        )}

        {/* Practice Mode Banner */}
        {isPracticeMode && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center">
            <p className="text-sm font-medium text-amber-800">
              Practice Mode — This attempt won't be recorded
            </p>
          </div>
        )}

        {/* Main Content */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-4 py-6">
          {/* Navigation arrows + Question Card */}
          <div className="flex items-center gap-2 w-full max-w-2xl">
            {/* Left arrow */}
            <button
              onClick={goToPrev}
              disabled={currentIndex === 0}
              className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-muted active:scale-95 transition flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous question"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>

            {/* Question Card */}
            <div className="flex-1">
              <div className="flex aspect-[2/1] flex-col items-center justify-center rounded-3xl border-2 border-border-default bg-surface p-8 shadow-xl">
                <div className="text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <h2 className="text-4xl font-bold text-text-primary md:text-5xl">{currentWord.word}</h2>
                    {currentWord.partOfSpeech && (
                      <p className="text-lg italic text-text-muted md:text-xl">({currentWord.partOfSpeech})</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePlayAudio(currentWord.word)}
                    disabled={isPlayingAudio}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-200 disabled:opacity-60"
                  >
                    {isPlayingAudio ? '🔊 Playing...' : '🔊 Play Audio'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right arrow */}
            <button
              onClick={goToNext}
              disabled={currentIndex === testWords.length - 1}
              className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-muted active:scale-95 transition flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next question"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          </div>

          {/* Answer Grid */}
          <div
            className={`relative z-10 grid w-full max-w-2xl gap-3 ${
              currentWord.options.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
            }`}
          >
            {currentWord.options.map((option, optIndex) => {
              const isSelected = answers[currentWord.id]?.wordId === option.wordId
              return (
                <button
                  key={optIndex}
                  type="button"
                  onClick={() => handleAnswerSelect(currentWord.id, option)}
                  disabled={submitting}
                  className={`min-h-[80px] rounded-2xl border-2 p-4 text-left transition-all ${
                    isSelected
                      ? 'scale-105 border-blue-500 bg-blue-50 shadow-lg'
                      : 'border-border-default bg-surface hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-md'
                  } disabled:opacity-60`}
                >
                  <span className="text-sm font-medium text-text-secondary">{option.definition}</span>
                </button>
              )
            })}
          </div>

          {/* Submit Button */}
          <div className="w-full max-w-2xl pt-4">
            <div className="flex justify-center">
              <Button
                variant="primary-blue"
                size="lg"
                className="w-1/2"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : `Submit Test (${answeredCount}/${testWords.length} answered)`}
              </Button>
            </div>
            {answeredCount < testWords.length && (
              <p className="mt-2 text-center text-sm text-amber-600">
                Unanswered questions will be marked as incorrect
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="px-4 pb-4">
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Quit Confirmation Modal */}
      <ConfirmModal
        isOpen={showQuitConfirm}
        title="Quit Test?"
        message="Are you sure you want to quit? All progress on this test will be lost."
        confirmLabel="Quit"
        cancelLabel="Continue Test"
        onConfirm={handleQuitConfirm}
        onCancel={() => setShowQuitConfirm(false)}
        variant="danger"
      />

      {/* Recovery Prompt Modal */}
      <ConfirmModal
        isOpen={showRecoveryPrompt}
        title="Resume Previous Test?"
        message={`You have an unfinished test from ${recoveryTimeRemaining || 'a few'} minutes ago. Would you like to resume where you left off?`}
        confirmLabel="Resume"
        cancelLabel="Start Fresh"
        onConfirm={handleRecoveryResume}
        onCancel={handleRecoveryStartFresh}
        variant="info"
      />
    </main>
  )
}

export default MCQTest

