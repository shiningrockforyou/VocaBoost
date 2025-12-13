import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, collection, query, orderBy, getDocs } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { useAuth } from '../contexts/AuthContext.jsx'
import { db } from '../firebase'
import {
  initializeDailySession,
  getNewWords,
  getSegmentWords,
  processTestResults,
  selectTestWords
} from '../services/studyService'
import { STUDY_ALGORITHM_CONSTANTS } from '../utils/studyAlgorithm'
import {
  getTestId,
  saveTestState,
  getTestState,
  clearTestState,
  getRecoveryTimeRemaining
} from '../utils/testRecovery'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import TestResults from '../components/TestResults.jsx'
import Watermark from '../components/Watermark.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { Button } from '../components/ui'

const TypedTest = () => {
  const { classId, listId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  
  // Get navigation state
  const {
    testType = 'review',
    wordPool = null,
    returnPath = '/',
    sessionContext = null,
    practiceMode = false
  } = location.state || {}

  // Also check query params for backwards compatibility
  const searchParams = new URLSearchParams(location.search)
  const testTypeParam = searchParams.get('type') || testType
  const classIdParam = searchParams.get('classId') || classId

  const [listDetails, setListDetails] = useState(null)
  const [words, setWords] = useState([])
  const [originalWords, setOriginalWords] = useState([]) // Store original word list for retake
  const [responses, setResponses] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const inputRefs = useRef([])
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [attemptId, setAttemptId] = useState(null)
  const [currentTestType, setCurrentTestType] = useState(testTypeParam)
  const [canRetake, setCanRetake] = useState(false)
  const [retakeThreshold] = useState(0.95)
  const [showResults, setShowResults] = useState(false)
  const [testResultsData, setTestResultsData] = useState(null)

  // Modal states
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false)
  const [savedRecoveryState, setSavedRecoveryState] = useState(null)
  const [recoveryTimeRemaining, setRecoveryTimeRemaining] = useState(null)

  // Practice mode (after passing, test doesn't save)
  const [isPracticeMode] = useState(practiceMode)

  // Test ID for recovery
  const testId = getTestId(classIdParam || classId, listId, currentTestType)

  // Browser close warning
  useEffect(() => {
    const hasProgress = Object.keys(responses).length > 0 && !showResults

    const handleBeforeUnload = (e) => {
      if (hasProgress) {
        e.preventDefault()
        e.returnValue = 'You have unsaved test progress. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    if (hasProgress) {
      window.addEventListener('beforeunload', handleBeforeUnload)
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [responses, showResults])

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

  const loadTestWords = useCallback(async () => {
    if (!user?.uid || !listId) return
    setIsLoading(true)
    setError('')
    try {
      // If word pool provided (from DailySessionFlow), use it
      if (wordPool && wordPool.length > 0) {
        setOriginalWords(wordPool)
        setWords(wordPool)
        setResponses({})
        setResults(null)
        setShowResults(false)
        setCanRetake(false)
        setTestResultsData(null)
        setFocusedIndex(0)
        inputRefs.current = new Array(wordPool.length)
        setIsLoading(false)
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

      const testSize = currentTestType === 'new'
        ? (assignment.testSizeNew || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_NEW)
        : (assignment.testSizeReview || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_REVIEW)

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
          const snap = await getDocs(query(wordsRef, orderBy('createdAt', 'asc')))
          const allWords = snap.docs.map((d, i) => ({ id: d.id, wordIndex: i, ...d.data() }))
          wordsToTest = selectTestWords(allWords, testSize)
        }
      }

      if (wordsToTest.length === 0) {
        throw new Error('No words available for testing.')
      }

      setOriginalWords(wordsToTest)
      setWords(wordsToTest)
      setResponses({})
      setResults(null)
      setShowResults(false)
      setCanRetake(false)
      setTestResultsData(null)
      setFocusedIndex(0)
      inputRefs.current = new Array(wordsToTest.length)
    } catch (err) {
      setError(err.message ?? 'Unable to load test.')
    } finally {
      setIsLoading(false)
    }
  }, [user?.uid, listId, classIdParam, currentTestType, wordPool])

  useEffect(() => {
    loadTestWords()
  }, [loadTestWords])


  // Auto-focus first input when words load
  useEffect(() => {
    if (words.length > 0 && inputRefs.current[0] && !results) {
      inputRefs.current[0]?.focus()
    }
  }, [words.length, results])

  // Scroll to focused input
  useEffect(() => {
    if (inputRefs.current[focusedIndex] && !results) {
      inputRefs.current[focusedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [focusedIndex, results])

  // Check for recoverable test state on mount
  useEffect(() => {
    if (!testId || isLoading) return

    const saved = getTestState(testId)
    if (saved && Object.keys(saved.answers || {}).length > 0) {
      setSavedRecoveryState(saved)
      setRecoveryTimeRemaining(getRecoveryTimeRemaining(testId))
      setShowRecoveryPrompt(true)
    }
  }, [testId, isLoading])

  // Save test state on each answer (for recovery)
  useEffect(() => {
    if (!testId || words.length === 0 || showResults) return

    const wordIds = words.map(w => w.id)
    if (Object.keys(responses).length > 0) {
      saveTestState(testId, responses, wordIds, focusedIndex)
    }
  }, [responses, testId, words, focusedIndex, showResults])

  // Handle recovery - restore saved answers
  const handleRecoveryResume = () => {
    if (savedRecoveryState?.answers) {
      setResponses(savedRecoveryState.answers)
      if (savedRecoveryState.currentIndex !== undefined) {
        setFocusedIndex(savedRecoveryState.currentIndex)
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

  // Quit test with confirmation
  const handleQuitConfirm = () => {
    clearTestState(testId)
    setShowQuitConfirm(false)
    navigate(returnPath || '/')
  }

  const handleKeyDown = (e, index) => {
    if (results || isSubmitting) return

    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault()
      const nextIndex = index + 1
      if (nextIndex < words.length) {
        setFocusedIndex(nextIndex)
        inputRefs.current[nextIndex]?.focus()
      } else {
        // Last input - submit
        handleSubmit()
      }
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      const prevIndex = index - 1
      if (prevIndex >= 0) {
        setFocusedIndex(prevIndex)
        inputRefs.current[prevIndex]?.focus()
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIndex = Math.min(index + 1, words.length - 1)
      setFocusedIndex(nextIndex)
      inputRefs.current[nextIndex]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prevIndex = Math.max(index - 1, 0)
      setFocusedIndex(prevIndex)
      inputRefs.current[prevIndex]?.focus()
    }
  }

  const handleSubmit = async () => {
    if (!user?.uid || !listId || isSubmitting || showResults) return

    setIsSubmitting(true)
    setError('')

    try {
      // Clear saved test state
      clearTestState(testId)

      // Prepare answers for grading
      const answersToGrade = words.map((word) => ({
        wordId: word.id,
        word: word.word,
        correctDefinition: word.definition,
        studentResponse: responses[word.id] || '',
      }))

      // Call Cloud Function for AI grading
      const functions = getFunctions()
      const gradeTypedTest = httpsCallable(functions, 'gradeTypedTest')

      const gradingResult = await gradeTypedTest({ answers: answersToGrade })

      // Build results array for processTestResults
      const resultsArray = gradingResult.data.results.map(r => ({
        wordId: r.wordId,
        correct: r.isCorrect
      }))

      // Process test results (updates word statuses) - skip if practice mode
      let summary
      if (isPracticeMode) {
        // Calculate score locally without saving
        const correct = resultsArray.filter(r => r.correct).length
        summary = {
          score: correct / resultsArray.length,
          correct,
          total: resultsArray.length,
          failed: resultsArray.filter(r => !r.correct).map(r => r.wordId)
        }
      } else {
        summary = await processTestResults(user.uid, resultsArray, listId)
      }

      // Check if retake available
      if (currentTestType === 'new' && summary.score < retakeThreshold) {
        setCanRetake(true)
      }

      // Store for display
      setTestResultsData({
        score: Math.round(summary.score * 100),
        correct: summary.correct,
        total: summary.total,
        failed: summary.failed,
        gradedResults: gradingResult.data.results, // Include detailed grading for review
        testType: currentTestType
      })

      setResults(gradingResult.data.results)
      setShowResults(true)
    } catch (err) {
      console.error('Grading error:', err)
      setError(err.message ?? 'Failed to grade test. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRetake = () => {
    setResponses({})
    setFocusedIndex(0)
    setShowResults(false)
    setCanRetake(false)
    setTestResultsData(null)
    setResults(null)
    
    // Regenerate from original words
    const shuffled = [...originalWords].sort(() => Math.random() - 0.5)
    setWords(shuffled.slice(0, 50))
    inputRefs.current = new Array(50)
  }

  const answeredCount = Object.values(responses).filter((r) => r.trim() !== '').length


  if (isLoading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-muted">
        <Watermark />
        <div className="relative z-10">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    )
  }

  if (error && !showResults) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-muted px-4">
        <Watermark />
        <div className="relative z-10 max-w-md rounded-2xl bg-surface p-8 text-center shadow-lg">
          <p className="text-lg font-semibold text-text-primary">Something went wrong</p>
          <p className="mt-3 text-sm text-text-muted">{error}</p>
          <Button variant="primary-blue" size="lg" onClick={loadTestWords} className="mt-6">
            Try Again
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate(-1)} className="mt-4">
            Go Back
          </Button>
        </div>
      </main>
    )
  }

  if (!words.length) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-muted px-4">
        <Watermark />
        <div className="relative z-10 max-w-md rounded-2xl bg-surface p-8 text-center shadow-lg">
          <p className="text-lg font-semibold text-text-primary">No Test Content</p>
          <p className="mt-3 text-sm text-text-muted">Your teacher hasn't assigned enough words yet.</p>
          <Button variant="outline" size="lg" onClick={() => navigate(-1)} className="mt-6">
            Go Back
          </Button>
        </div>
      </main>
    )
  }

  // Results Mode
  if (showResults && testResultsData && results) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-base px-4 py-10">
        <Watermark />
        <div className="relative z-10 w-full max-w-lg rounded-2xl bg-surface p-8 text-center shadow-xl ring-1 ring-border-default">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <span className="text-3xl">✓</span>
          </div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-500">
            Test Complete
          </p>
          <h2 className="mt-2 text-2xl font-bold text-text-primary">
            {testResultsData.score}%
          </h2>
          <p className="text-text-secondary">
            {testResultsData.correct} of {testResultsData.total} correct
          </p>

          {/* Test type indicator */}
          <p className="mt-2 text-sm text-text-muted">
            {currentTestType === 'new' ? 'New Word Test' : 'Review Test'}
          </p>

          {/* Retake prompt for new word test below threshold */}
          {canRetake && (
            <div className="mt-4 rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Score below {Math.round(retakeThreshold * 100)}% — retake recommended
              </p>
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">
                New word tests require {Math.round(retakeThreshold * 100)}% to proceed.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex flex-col gap-3">
            {canRetake && (
              <Button
                variant="primary-blue"
                size="lg"
                onClick={handleRetake}
                className="w-full"
              >
                Retake Test
              </Button>
            )}
            <Button
              variant={canRetake ? "outline" : "primary-blue"}
              size="lg"
              onClick={() => {
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
              }}
              className="w-full"
            >
              {canRetake ? 'Continue Anyway' : (returnPath ? 'Continue' : 'Back to Dashboard')}
            </Button>
          </div>

          {/* Detailed results */}
          <div className="mt-6">
            <TestResults
              testType="typed"
              listTitle={listDetails?.title}
              words={words}
              responses={responses}
              results={results}
              attemptId={attemptId}
            />
          </div>
        </div>
      </main>
    )
  }

  // Test Mode
  return (
    <main className="relative min-h-screen bg-muted px-4 py-10">
      <Watermark />
      <div className="relative z-10 mx-auto max-w-4xl">
        {/* Practice Mode Banner */}
        {isPracticeMode && (
          <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-center">
            <p className="text-sm font-medium text-amber-800">
              Practice Mode — This attempt won't be recorded
            </p>
          </div>
        )}

        {/* Header */}
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-surface p-6 shadow-lg ring-1 ring-border-default">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => setShowQuitConfirm(true)} disabled={isSubmitting}>
              ← Quit
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">{listDetails?.title || 'Typed Test'}</h1>
              <p className="mt-1 text-sm text-text-secondary">
                Progress: {answeredCount}/{words.length} answered
              </p>
            </div>
          </div>
          <Button variant="primary-blue" size="lg" onClick={handleSubmit} disabled={isSubmitting || answeredCount === 0}>
            {isSubmitting ? 'Grading...' : 'Submit Test'}
          </Button>
        </div>

        {/* Words List */}
        <div className="space-y-4 rounded-2xl bg-surface p-6 shadow-lg ring-1 ring-border-default">
          {words.map((word, index) => (
            <div key={word.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="flex w-8 shrink-0 items-center justify-center text-sm font-semibold text-text-secondary">
                  {index + 1}.
                </span>
                <span className="font-medium text-text-primary">{word.word}</span>
                {word.partOfSpeech && (
                  <span className="text-sm italic text-text-muted">({word.partOfSpeech})</span>
                )}
              </div>
              <input
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                value={responses[word.id] || ''}
                onChange={(e) =>
                  setResponses((prev) => ({
                    ...prev,
                    [word.id]: e.target.value,
                  }))
                }
                onKeyDown={(e) => handleKeyDown(e, index)}
                onFocus={() => setFocusedIndex(index)}
                placeholder="Type your definition..."
                disabled={isSubmitting || results !== null}
                className="ml-11 rounded-lg border border-border-default bg-muted px-4 py-3 text-text-primary outline-none ring-border-strong transition focus:bg-surface focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
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

export default TypedTest

