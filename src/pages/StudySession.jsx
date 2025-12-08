import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext.jsx'
import { db } from '../firebase'
import Flashcard from '../components/Flashcard.jsx'
import { fetchSmartStudyQueue, saveStudyResult } from '../services/db'
import BackButton from '../components/BackButton.jsx'
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

const StudySession = () => {
  const { listId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const classId = searchParams.get('classId')

  const [listDetails, setListDetails] = useState(null)
  const [words, setWords] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingResult, setSavingResult] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [cardsReviewed, setCardsReviewed] = useState(0)
  const [autoPlay, setAutoPlay] = useState(false)

  const loadList = useCallback(async () => {
    if (!listId) return
    setLoading(true)
    setError('')
    try {
      const listRef = doc(db, 'lists', listId)
      const listSnap = await getDoc(listRef)
      if (!listSnap.exists()) {
        throw new Error('List not found.')
      }
      setListDetails({ id: listSnap.id, ...listSnap.data() })
      const listWords = await fetchSmartStudyQueue(listId, user?.uid, classId || null)
      setWords(listWords)
      setCurrentIndex(0)
      setCardsReviewed(0)
      setCompleted(false)
    } catch (err) {
      setError(err.message ?? 'Unable to load list.')
    } finally {
      setLoading(false)
    }
  }, [listId, user?.uid, classId])

  useEffect(() => {
    loadList()
  }, [loadList])

  const currentWord = words[currentIndex]

  const handleFlip = () => {
    setIsFlipped((prev) => !prev)
  }

  const handleResult = async (result) => {
    if (!user?.uid || !currentWord) return
    setSavingResult(true)
    try {
      await saveStudyResult(user.uid, currentWord.id, result)
      setCardsReviewed((prev) => prev + 1)
      const nextIndex = currentIndex + 1
      if (nextIndex >= words.length) {
        setCompleted(true)
      } else {
        setCurrentIndex(nextIndex)
        setIsFlipped(false)
      }
    } catch (err) {
      setError(err.message ?? 'Unable to save result.')
    } finally {
      setSavingResult(false)
    }
  }

  if (loading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-base">
        <Watermark />
        <p className="relative z-10 text-sm font-medium text-text-secondary">Loading study session...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-base px-4">
        <Watermark />
        <div className="relative z-10 max-w-md rounded-2xl bg-surface p-8 text-center shadow-lg">
          <p className="text-lg font-semibold text-text-primary">Something went wrong</p>
          <p className="mt-3 text-sm text-text-muted">{error}</p>
          <Button variant="outline" size="lg" onClick={() => navigate(-1)} className="mt-6">
            Go Back
          </Button>
        </div>
      </main>
    )
  }

  if (!words.length || completed) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-base px-4 py-10">
        <Watermark />
        <div className="relative z-10 w-full max-w-lg rounded-2xl bg-surface p-8 text-center shadow-xl ring-1 ring-border-default">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <span className="text-3xl">✓</span>
          </div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-500">
            Session Complete
          </p>
          <h1 className="mt-2 text-3xl font-bold text-text-primary">Great Job!</h1>
          <div className="mt-6 space-y-3 rounded-xl bg-muted p-6 text-left">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-secondary">List</span>
              <span className="text-sm font-semibold text-text-primary">
                {listDetails?.title || 'Study Session'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-secondary">Cards Reviewed</span>
              <span className="text-sm font-semibold text-text-primary">
                {cardsReviewed || words.length} {cardsReviewed === 1 ? 'card' : 'cards'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-secondary">Total Words</span>
              <span className="text-sm font-semibold text-text-primary">{words.length} words</span>
            </div>
          </div>
          <p className="mt-6 text-sm text-text-muted">
            {words.length
              ? 'Keep up the great work! Your progress has been saved.'
              : 'No words available yet. Ask your teacher to assign content.'}
          </p>
          <Button variant="primary-blue" size="lg" onClick={() => navigate('/')} className="mt-6 w-full">
            Back to Dashboard
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 px-4 py-10">
      <Watermark />
      <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-10">
        <BackButton text="← Exit Session" />
        <header className="flex flex-col items-center text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-500">
            Study Session
          </p>
          <h1 className="mt-2 text-4xl font-bold text-text-primary">{listDetails?.title}</h1>
          <p className="mt-2 text-base text-text-secondary">
            Card {currentIndex + 1} of {words.length}
          </p>
          <label className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoPlay}
              onChange={(e) => setAutoPlay(e.target.checked)}
              className="h-4 w-4 rounded border-border-strong text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-text-secondary">Auto-play audio</span>
          </label>
        </header>

        <div className="relative z-10">
          <Flashcard
            word={currentWord}
            isFlipped={isFlipped}
            onFlip={handleFlip}
            autoPlay={autoPlay}
          />
        </div>

        {isFlipped ? (
          <div className="relative z-10 flex flex-col gap-3 md:flex-row">
            <button
              type="button"
              disabled={savingResult}
              onClick={() => handleResult('again')}
              className="flex-1 rounded-2xl bg-red-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-red-100 transition hover:bg-red-600 disabled:opacity-60"
            >
              Again
            </button>
            <button
              type="button"
              disabled={savingResult}
              onClick={() => handleResult('hard')}
              className="flex-1 rounded-2xl bg-amber-400 px-6 py-4 text-base font-semibold text-slate-900 shadow-lg shadow-amber-100 transition hover:bg-amber-500 disabled:opacity-60"
            >
              Hard
            </button>
            <button
              type="button"
              disabled={savingResult}
              onClick={() => handleResult('easy')}
              className="flex-1 rounded-2xl bg-emerald-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-600 disabled:opacity-60"
            >
              Easy
            </button>
          </div>
        ) : (
          <p className="relative z-10 text-center text-sm text-text-muted">
            Tap the card to reveal the definition.
          </p>
        )}
      </div>
    </main>
  )
}

export default StudySession


