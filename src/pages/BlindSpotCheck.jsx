/**
 * BlindSpotCheck.jsx
 * 
 * Tests words that are NEVER_TESTED or stale (>21 days since test).
 * Helps students verify words that might have slipped through.
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui'
import {
  getBlindSpotPool,
  processTestResults,
  selectTestWords
} from '../services/studyService'
import { STUDY_ALGORITHM_CONSTANTS } from '../utils/studyAlgorithm'

const Watermark = () => (
  <div className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vmin] h-[90vmin] opacity-5 z-0">
    <img
      src="/logo_square_vector.svg"
      alt="VocaBoost watermark"
      className="h-full w-full object-contain"
    />
  </div>
)

const TEST_SIZE = 30 // Max words per blind spot test

export default function BlindSpotCheck() {
  const { classId, listId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  // State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [listDetails, setListDetails] = useState(null)
  
  // Pool state
  const [blindSpotPool, setBlindSpotPool] = useState([])
  const [poolLoaded, setPoolLoaded] = useState(false)
  
  // Test state
  const [testStarted, setTestStarted] = useState(false)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState(null)

  // Load blind spot pool
  useEffect(() => {
    if (!user?.uid || !listId) return

    const load = async () => {
      setLoading(true)
      try {
        // Get list details
        const listRef = doc(db, 'lists', listId)
        const listSnap = await getDoc(listRef)
        if (listSnap.exists()) {
          setListDetails({ id: listSnap.id, ...listSnap.data() })
        }

        // Get blind spot pool
        const pool = await getBlindSpotPool(user.uid, listId)
        setBlindSpotPool(pool)
        setPoolLoaded(true)
      } catch (err) {
        setError(err.message || 'Failed to load blind spots')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?.uid, listId])

  // Start test
  const handleStartTest = () => {
    const testWords = selectTestWords(blindSpotPool, TEST_SIZE)
    const generatedQuestions = generateMCQQuestions(testWords, blindSpotPool)
    setQuestions(generatedQuestions)
    setAnswers({})
    setCurrentQuestion(0)
    setTestStarted(true)
  }

  // Generate MCQ questions
  const generateMCQQuestions = (testWords, allWords) => {
    const optionsCount = 4

    return testWords.map(word => {
      const others = allWords.filter(w => w.id !== word.id)
      const shuffledOthers = [...others].sort(() => Math.random() - 0.5)
      const distractors = shuffledOthers.slice(0, optionsCount - 1)

      const options = [
        { text: word.definition, isCorrect: true },
        ...distractors.map(d => ({ text: d.definition, isCorrect: false }))
      ].sort(() => Math.random() - 0.5)

      const correctIndex = options.findIndex(o => o.isCorrect)

      return {
        wordId: word.id,
        word: word.word,
        options: options.map(o => o.text),
        correctIndex
      }
    })
  }

  // Handle answer
  const handleAnswer = (questionIndex, answerIndex) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: answerIndex
    }))
  }

  // Submit test
  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)

    try {
      const testResults = questions.map((q, idx) => ({
        wordId: q.wordId,
        correct: answers[idx] === q.correctIndex
      }))

      const summary = await processTestResults(user.uid, testResults, listId)
      setResults(summary)
    } catch (err) {
      setError(err.message || 'Failed to submit test')
    } finally {
      setSubmitting(false)
    }
  }

  // Render loading
  if (loading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-base">
        <Watermark />
        <div className="relative z-10 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="mt-4 text-text-secondary">Scanning for blind spots...</p>
        </div>
      </main>
    )
  }

  // Render error
  if (error) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-base p-4">
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

  // Render pool status (before test)
  if (!testStarted) {
    const neverTestedCount = blindSpotPool.filter(
      w => w.studyState?.status === 'NEVER_TESTED'
    ).length
    const staleCount = blindSpotPool.length - neverTestedCount

    return (
      <main className="relative min-h-screen bg-base">
        <Watermark />
        <div className="relative z-10 mx-auto max-w-lg px-4 py-12">
          <div className="rounded-2xl bg-surface p-8 shadow-lg ring-1 ring-border-default">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <span className="text-3xl">🔍</span>
              </div>
              
              <h1 className="text-2xl font-bold text-text-primary">
                Check for Blind Spots
              </h1>
              <p className="mt-2 text-text-secondary">
                {listDetails?.title}
              </p>
            </div>

            {blindSpotPool.length === 0 ? (
              <div className="mt-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <span className="text-2xl">✓</span>
                </div>
                <p className="font-medium text-emerald-600 dark:text-emerald-400">
                  All words verified!
                </p>
                <p className="mt-2 text-sm text-text-muted">
                  No blind spots found. All words have been tested recently.
                </p>
                <Button 
                  onClick={() => navigate('/')} 
                  variant="outline"
                  className="mt-6"
                >
                  Back to Dashboard
                </Button>
              </div>
            ) : (
              <div className="mt-8">
                <div className="rounded-lg bg-muted p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Never tested:</span>
                    <span className="font-medium text-text-primary">{neverTestedCount}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-text-secondary">
                      Stale (&gt;{STUDY_ALGORITHM_CONSTANTS.STALE_DAYS_THRESHOLD} days):
                    </span>
                    <span className="font-medium text-text-primary">{staleCount}</span>
                  </div>
                  <div className="mt-3 border-t border-border-default pt-3">
                    <div className="flex justify-between">
                      <span className="font-medium text-text-secondary">Total to verify:</span>
                      <span className="font-bold text-text-primary">{blindSpotPool.length}</span>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-center text-sm text-text-muted">
                  {blindSpotPool.length <= TEST_SIZE
                    ? `Test all ${blindSpotPool.length} words`
                    : `Test ${TEST_SIZE} of ${blindSpotPool.length} words`}
                </p>

                <div className="mt-6 flex flex-col gap-3">
                  <Button onClick={handleStartTest} variant="primary" size="lg">
                    Start Blind Spot Test
                  </Button>
                  <Button onClick={() => navigate('/')} variant="ghost">
                    Back to Dashboard
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    )
  }

  // Render results
  if (results) {
    const percentage = Math.round(results.score * 100)
    const remainingBlindSpots = blindSpotPool.length - questions.length + results.failed.length

    return (
      <main className="relative min-h-screen bg-base">
        <Watermark />
        <div className="relative z-10 mx-auto max-w-lg px-4 py-12">
          <div className="rounded-2xl bg-surface p-8 shadow-lg ring-1 ring-border-default text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
              <span className="text-3xl">📊</span>
            </div>
            
            <h2 className="text-2xl font-bold text-text-primary">
              Blind Spot Results
            </h2>

            <div className="mt-6 rounded-xl bg-muted p-6">
              <p className="text-4xl font-bold text-text-primary">{percentage}%</p>
              <p className="text-text-secondary">
                {results.correct} of {results.total} correct
              </p>
            </div>

            <div className="mt-6 rounded-lg bg-muted p-4 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Words verified:</span>
                <span className="font-medium text-emerald-600">{results.correct}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-text-secondary">Need more practice:</span>
                <span className="font-medium text-amber-600">{results.failed.length}</span>
              </div>
              {remainingBlindSpots > 0 && (
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-text-secondary">Remaining blind spots:</span>
                  <span className="font-medium text-text-primary">{remainingBlindSpots}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              {remainingBlindSpots > 0 && (
                <Button 
                  onClick={async () => {
                    setTestStarted(false)
                    setResults(null)
                    // Reload pool
                    const pool = await getBlindSpotPool(user.uid, listId)
                    setBlindSpotPool(pool)
                  }} 
                  variant="outline"
                >
                  Test More Blind Spots
                </Button>
              )}
              <Button onClick={() => navigate('/')} variant="primary-blue">
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Render test
  const question = questions[currentQuestion]
  const allAnswered = Object.keys(answers).length === questions.length

  return (
    <main className="relative min-h-screen bg-base">
      <Watermark />
      
      {/* Header */}
      <div className="relative z-10 border-b border-border-default bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <p className="text-sm font-medium text-text-secondary">
            Blind Spot Test
          </p>
          <p className="text-sm text-text-muted">
            {currentQuestion + 1} / {questions.length}
          </p>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-8">
        {/* Question */}
        <div className="rounded-xl bg-surface p-6 shadow ring-1 ring-border-default">
          <p className="text-center text-xl font-bold text-text-primary">
            {question?.word}
          </p>

          <div className="mt-6 space-y-3">
            {question?.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswer(currentQuestion, idx)}
                className={`w-full rounded-lg border p-4 text-left transition ${
                  answers[currentQuestion] === idx
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-border-default hover:border-blue-300'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <Button
            onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
            disabled={currentQuestion === 0}
            variant="ghost"
          >
            ← Previous
          </Button>

          {currentQuestion < questions.length - 1 ? (
            <Button
              onClick={() => setCurrentQuestion(currentQuestion + 1)}
              disabled={answers[currentQuestion] === undefined}
            >
              Next →
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!allAnswered || submitting}
              variant="primary-blue"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </Button>
          )}
        </div>

        {/* Question dots */}
        <div className="mt-6 flex justify-center gap-1">
          {questions.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentQuestion(idx)}
              className={`h-2 w-2 rounded-full ${
                answers[idx] !== undefined
                  ? 'bg-blue-500'
                  : idx === currentQuestion
                  ? 'bg-blue-300'
                  : 'bg-border-default'
              }`}
            />
          ))}
        </div>
      </div>
    </main>
  )
}

