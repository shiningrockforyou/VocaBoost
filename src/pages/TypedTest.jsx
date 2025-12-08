import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { useAuth } from '../contexts/AuthContext.jsx'
import { db } from '../firebase'
import {
  generateTypedTest,
  submitTypedTestAttempt,
} from '../services/db'
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

const TypedTest = () => {
  const { listId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const searchParams = new URLSearchParams(location.search)
  const classIdParam = searchParams.get('classId')

  const [listDetails, setListDetails] = useState(null)
  const [words, setWords] = useState([])
  const [responses, setResponses] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const inputRefs = useRef([])
  const [focusedIndex, setFocusedIndex] = useState(0)
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
    setIsLoading(true)
    setError('')
    try {
      const testWords = await generateTypedTest(user.uid, listId, classIdParam)
      if (testWords.length === 0) {
        throw new Error('No words available for testing.')
      }
      setWords(testWords)
      setResponses({})
      setResults(null)
      setFocusedIndex(0)
      // Initialize refs array
      inputRefs.current = new Array(testWords.length)
    } catch (err) {
      setError(err.message ?? 'Unable to load test.')
    } finally {
      setIsLoading(false)
    }
  }, [user?.uid, listId, classIdParam])

  useEffect(() => {
    loadTestWords()
  }, [loadTestWords])

  // Fetch challenge tokens
  useEffect(() => {
    const loadChallengeTokens = async () => {
      if (!user?.uid) return
      try {
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const userData = userSnap.data()
          const challengeHistory = userData.challenges?.history || []
          const tokens = getAvailableChallengeTokens(challengeHistory)
          setAvailableTokens(tokens)
        }
      } catch (err) {
        console.error('Error loading challenge tokens:', err)
      }
    }
    loadChallengeTokens()
  }, [user?.uid])

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
    if (!user?.uid || !listId || isSubmitting || results) return

    setIsSubmitting(true)
    setError('')

    try {
      // Prepare answers for grading
      const answersToGrade = words.map((word) => ({
        wordId: word.id,
        word: word.word,
        correctDefinition: word.definition,
        studentResponse: responses[word.id] || '',
      }))

      // Call Cloud Function
      const functions = getFunctions()
      const gradeTypedTest = httpsCallable(functions, 'gradeTypedTest')

      const gradingResult = await gradeTypedTest({ answers: answersToGrade })

      // Save attempt to Firestore
      const testId = `typed_${listId}_${Date.now()}`
      const attemptResult = await submitTypedTestAttempt(
        user.uid,
        testId,
        words,
        responses,
        gradingResult.data.results,
        classIdParam || null,
      )

      // Store attempt ID for challenges
      setAttemptId(attemptResult.id)

      // Show results
      setResults(gradingResult.data.results)
    } catch (err) {
      console.error('Grading error:', err)
      setError(err.message ?? 'Failed to grade test. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
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

  if (error && !results) {
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
  if (results) {
    return (
      <TestResults
        testType="typed"
        listTitle={listDetails?.title}
        words={words}
        responses={responses}
        results={results}
        attemptId={attemptId}
      />
    )
  }

  // Test Mode
  return (
    <main className="relative min-h-screen bg-muted px-4 py-10">
      <Watermark />
      <div className="relative z-10 mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-surface p-6 shadow-lg ring-1 ring-border-default">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{listDetails?.title || 'Typed Test'}</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Progress: {answeredCount}/{words.length} answered
            </p>
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
    </main>
  )
}

export default TypedTest

