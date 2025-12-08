import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext.jsx'
import { db } from '../firebase'
import { generateTest, submitTestAttempt } from '../services/db'
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

const TakeTest = () => {
  const { listId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const searchParams = new URLSearchParams(location.search)
  const classIdParam = searchParams.get('classId')

  const [listDetails, setListDetails] = useState(null)
  const [testWords, setTestWords] = useState([])
  const [answers, setAnswers] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState(null)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [attemptId, setAttemptId] = useState(null)

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
    setLoading(true)
    setError('')
    try {
      const testWordsWithOptions = await generateTest(user.uid, listId, classIdParam)
      if (testWordsWithOptions.length === 0) {
        throw new Error('No words available for testing.')
      }
      setTestWords(testWordsWithOptions)
      setCurrentIndex(0)
      setAnswers({})
    } catch (err) {
      setError(err.message ?? 'Unable to load test.')
    } finally {
      setLoading(false)
    }
  }, [user?.uid, listId, classIdParam])

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
    if (!user?.uid || !listId) return

    const answerArray = Object.entries(answers).map(([wordId, option]) => {
      const testWord = testWords.find((w) => w.id === wordId)
      return {
      wordId,
        word: testWord?.word || '',
        correctAnswer: testWord?.definition || '', // Store the correct definition
      studentResponse: option?.definition || '',
      isCorrect: option?.isCorrect || false,
      }
    })

    if (answerArray.length === 0) {
      setError('Please answer at least one question before submitting.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const testId = `test_${listId}_${Date.now()}`
      const result = await submitTestAttempt(user.uid, testId, answerArray, testWords.length, classIdParam || null)
      setAttemptId(result.id)
      setResults(result)
    } catch (err) {
      setError(err.message ?? 'Unable to submit test.')
    } finally {
      setSubmitting(false)
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

  if (error && !results) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-base px-4">
        <Watermark />
        <div className="relative z-10 max-w-md rounded-2xl bg-surface p-8 text-center shadow-lg">
          <p className="text-lg font-semibold text-text-primary">Something went wrong</p>
          <p className="mt-3 text-sm text-text-muted">{error}</p>
          <Button variant="primary-blue" size="lg" onClick={loadTestWords} className="mt-6">
            Try Again
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate(-1)} className="mt-6">
            Go Back
          </Button>
        </div>
      </main>
    )
  }

  if (results) {
    // Format data for TestResults component
    // words: array of { id, word, definition }
    const formattedWords = testWords.map(w => ({
      id: w.id,
      word: w.word,
      definition: w.definition,
    }))

    // responses: { wordId: 'selected answer text' }
    const userAnswers = {}
    Object.entries(answers).forEach(([wordId, option]) => {
      userAnswers[wordId] = option?.definition || ''
    })

    // results: array of { wordId, isCorrect }
    const testResults = Object.entries(answers).map(([wordId, option]) => ({
      wordId,
      isCorrect: option?.isCorrect || false,
    }))

    return (
      <TestResults
        testType="mcq"
        listTitle={listDetails?.title}
        words={formattedWords}
        responses={userAnswers}
        results={testResults}
        attemptId={attemptId}
      />
    )
  }

  if (!testWords.length) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-base px-4">
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
            <Button variant="outline" size="sm" onClick={() => navigate('/')} disabled={submitting}>
              ← Quit to Dashboard
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

export default TakeTest
