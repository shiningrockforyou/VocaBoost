import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext.jsx'
import { db } from '../firebase'
import { generateTest, submitTestAttempt } from '../services/db'
import { speak } from '../utils/tts'
import LoadingSpinner from '../components/LoadingSpinner.jsx'

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
      <main className="relative flex min-h-screen items-center justify-center bg-slate-50">
        <Watermark />
        <div className="relative z-10">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    )
  }

  if (error && !results) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Watermark />
        <div className="relative z-10 max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <p className="text-lg font-semibold text-slate-900">Something went wrong</p>
          <p className="mt-3 text-sm text-slate-500">{error}</p>
          <button
            type="button"
            onClick={loadTestWords}
            className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-6 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Go Back
          </button>
        </div>
      </main>
    )
  }

  if (results) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <Watermark />
        <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-xl ring-1 ring-slate-200">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <span className="text-3xl">📊</span>
          </div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-500">Test Complete</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Results</h1>
          <div className="mt-6 space-y-3 rounded-xl bg-slate-50 p-6 text-left">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">Score</span>
              <span className="text-lg font-semibold text-slate-900">{results.score}%</span>
            </div>
            {results.skipped > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Skipped</span>
                <span className="text-lg font-semibold text-slate-500">{results.skipped} questions</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">New Trust Score</span>
              <span className="text-lg font-semibold text-blue-600">
                {Math.round(results.credibility * 100)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">Retention</span>
              <span className="text-lg font-semibold text-slate-900">
                {Math.round(results.retention * 100)}%
              </span>
            </div>
          </div>
          <p className="mt-6 text-sm text-slate-500">
            Your progress has been saved. Keep studying to improve your scores!
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </main>
    )
  }

  if (!testWords.length) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Watermark />
        <div className="relative z-10 max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <p className="text-lg font-semibold text-slate-900">No Test Content</p>
          <p className="mt-3 text-sm text-slate-500">Your teacher hasn't assigned enough words yet.</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-6 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Go Back
          </button>
        </div>
      </main>
    )
  }

  // Active Test Screen
  const currentWord = testWords[currentIndex]
  const progress = ((currentIndex + 1) / testWords.length) * 100
  const answeredCount = Object.keys(answers).length

  return (
    <main className="relative flex min-h-screen flex-col bg-gradient-to-b from-blue-50 to-white">
      <Watermark />
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Progress Bar & Quit Button */}
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Question {currentIndex + 1} of {testWords.length}
                </span>
                <span>{answeredCount} answered</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              ← Quit to Dashboard
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-4 py-6">
          {/* Top Half: Question Card */}
          <div className="relative z-10 w-full max-w-2xl">
            <div className="flex aspect-[2/1] flex-col items-center justify-center rounded-3xl border-2 border-slate-200 bg-white p-8 shadow-xl">
              <div className="text-center">
                <div className="flex flex-col items-center justify-center gap-2">
                  <h2 className="text-5xl font-bold text-slate-900 md:text-6xl">{currentWord.word}</h2>
                  {currentWord.partOfSpeech && (
                    <p className="text-xl italic text-slate-500 md:text-2xl">({currentWord.partOfSpeech})</p>
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
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-md'
                  } disabled:opacity-60`}
                >
                  <span className="text-sm font-medium text-slate-700">{option.definition}</span>
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
