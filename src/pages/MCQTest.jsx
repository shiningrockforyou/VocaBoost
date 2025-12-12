import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, collection, query, orderBy, getDocs } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext.jsx'
import { db } from '../firebase'
import {
  initializeDailySession,
  getNewWords,
  getSegmentWords,
  processTestResults,
  selectTestWords
} from '../services/studyService'
import { speak } from '../utils/tts'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import TestResults from '../components/TestResults.jsx'
import { Button } from '../components/ui'

const Watermark = () => (
  <div className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vmin] h-[90vmin] opacity-5 z-0">
    <img
      src="/logo_square_vector.svg"
      alt="VocaBoost watermark"
      className="h-full w-full object-contain"
    />
  </div>
)

const MCQTest = () => {
  const { classId, listId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  
  // Get navigation state
  const {
    testType = 'review',
    wordPool = null,
    returnPath = '/',
    sessionContext = null
  } = location.state || {}

  // Also check query params for backwards compatibility
  const searchParams = new URLSearchParams(location.search)
  const testTypeParam = searchParams.get('type') || testType
  const classIdParam = searchParams.get('classId') || classId

  const [listDetails, setListDetails] = useState(null)
  const [testWords, setTestWords] = useState([])
  const [originalWords, setOriginalWords] = useState([])
  const [answers, setAnswers] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [testResultsData, setTestResultsData] = useState(null)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [attemptId, setAttemptId] = useState(null)
  const [currentTestType, setCurrentTestType] = useState(testTypeParam)
  const [canRetake, setCanRetake] = useState(false)
  const [retakeThreshold] = useState(0.95)
  const [showResults, setShowResults] = useState(false)

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

  const generateQuestions = (words) => {
    const testWordsWithOptions = words.map(word => {
      const otherWords = originalWords.length > 0 
        ? originalWords.filter(w => w.id !== word.id)
        : words.filter(w => w.id !== word.id)
      const shuffledOthers = [...otherWords].sort(() => Math.random() - 0.5)
      const distractors = shuffledOthers.slice(0, 3).map(w => ({
        wordId: w.id,
        definition: w.definition,
        isCorrect: false
      }))
      
      const options = [
        { wordId: word.id, definition: word.definition, isCorrect: true },
        ...distractors
      ].sort(() => Math.random() - 0.5)

      return {
        ...word,
        options
      }
    })

    setTestWords(testWordsWithOptions)
    setCurrentIndex(0)
    setAnswers({})
    setShowResults(false)
    setCanRetake(false)
  }

  const loadTestWords = useCallback(async () => {
    if (!user?.uid || !listId) return
    setLoading(true)
    setError('')
    try {
      // If word pool provided (from DailySessionFlow), use it
      if (wordPool && wordPool.length > 0) {
        setOriginalWords(wordPool)
        generateQuestions(wordPool)
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

      const testSize = currentTestType === 'new'
        ? (assignment.testSizeNew || 50)
        : (assignment.testSizeReview || 30)

      let wordsToTest = []

      if (currentTestType === 'new') {
        // Get today's new words
        const config = await initializeDailySession(user.uid, classIdParam, listId, {
          weeklyPace: assignment.pace * 7 || 400,
          studyDaysPerWeek: 5,
          testSizeNew: assignment.testSizeNew || 50,
          testSizeReview: assignment.testSizeReview || 30,
          newWordRetakeThreshold: 0.95
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
          weeklyPace: assignment.pace * 7 || 400,
          studyDaysPerWeek: 5,
          testSizeNew: assignment.testSizeNew || 50,
          testSizeReview: assignment.testSizeReview || 30,
          newWordRetakeThreshold: 0.95
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
      generateQuestions(wordsToTest)
    } catch (err) {
      setError(err.message || 'Failed to load test')
    } finally {
      setLoading(false)
    }
  }, [user?.uid, listId, classIdParam, currentTestType, wordPool])

  useEffect(() => {
    loadTestWords()
  }, [loadTestWords])

  const handleAnswerSelect = (wordId, option) => {
    setAnswers((prev) => ({
      ...prev,
      [wordId]: option,
    }))

    // Auto-advance to next question
    setTimeout(() => {
      if (currentIndex < testWords.length - 1) {
        setCurrentIndex(currentIndex + 1)
      } else {
        // Last question - auto submit
        handleSubmit()
      }
    }, 300)
  }

  const handleSubmit = async () => {
    if (submitting || !user?.uid || !listId) return

    setSubmitting(true)
    setError('')

    try {
      // Build results array
      const results = testWords.map((word) => {
        const selectedOption = answers[word.id]
        return {
          wordId: word.id,
          correct: selectedOption?.isCorrect || false
        }
      })

      if (results.length === 0) {
        setError('Please answer at least one question before submitting.')
        setSubmitting(false)
        return
      }

      // Process test results (updates word statuses)
      const summary = await processTestResults(user.uid, results, listId)

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

      setTestResultsData({
        score: percentage,
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
    setCurrentIndex(0)
    setShowResults(false)
    setCanRetake(false)
    setTestResultsData(null)

    // Regenerate questions from original words
    generateQuestions(originalWords)
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

          <p className="mt-2 text-sm text-text-muted">
            {currentTestType === 'new' ? 'New Word Test' : 'Review Test'}
          </p>

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
              onClick={handleFinish}
              className="w-full"
            >
              {canRetake ? 'Continue Anyway' : (returnPath ? 'Continue' : 'Back to Dashboard')}
            </Button>
          </div>

          <div className="mt-6">
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
            <Button variant="outline" size="sm" onClick={() => navigate(returnPath || '/')} disabled={submitting}>
              ← {returnPath ? 'Quit' : 'Quit to Dashboard'}
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-4 py-6">
          {/* Top Half: Question Card */}
          <div className="relative z-10 w-full max-w-2xl">
            <div className="flex aspect-[2/1] flex-col items-center justify-center rounded-3xl border-2 border-border-default bg-surface p-8 shadow-xl">
              <div className="text-center">
                <div className="flex flex-col items-center justify-center gap-2">
                  <h2 className="text-5xl font-bold text-text-primary md:text-6xl">{currentWord.word}</h2>
                  {currentWord.partOfSpeech && (
                    <p className="text-xl italic text-text-muted md:text-2xl">({currentWord.partOfSpeech})</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handlePlayAudio(currentWord.word)}
                  disabled={isPlayingAudio}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-200 disabled:opacity-60"
                >
                  {isPlayingAudio ? '🔊 Playing...' : '🔊 Play Audio'}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Half: Answer Grid */}
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
        </div>

        {error && (
          <div className="px-4 pb-4">
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default MCQTest

