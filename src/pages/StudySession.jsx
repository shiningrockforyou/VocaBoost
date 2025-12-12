import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { doc, getDoc, collection, query, orderBy, getDocs } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext.jsx'
import { db } from '../firebase'
import Flashcard from '../components/Flashcard.jsx'
import { 
  initializeDailySession,
  getNewWords,
  getSegmentWords,
  buildReviewQueue,
  updateQueueTracking
} from '../services/studyService'
import BackButton from '../components/BackButton.jsx'
import Watermark from '../components/Watermark.jsx'
import { Button } from '../components/ui'

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
  // Session queue management
  const [sessionQueue, setSessionQueue] = useState([])      // Full queue for this session
  const [currentQueue, setCurrentQueue] = useState([])      // Active queue (not dismissed)
  const [dismissedIds, setDismissedIds] = useState(new Set()) // Dismissed word IDs
  const [sessionPhase, setSessionPhase] = useState('loading') // 'loading' | 'study' | 'complete'
  const [cardsReviewed, setCardsReviewed] = useState(0)
  const [autoPlay, setAutoPlay] = useState(false)

  const loadSession = useCallback(async () => {
    if (!listId || !user?.uid) return

    setLoading(true)
    setError('')
    setSessionPhase('loading')

    try {
      // Get list details
      const listRef = doc(db, 'lists', listId)
      const listSnap = await getDoc(listRef)
      if (!listSnap.exists()) {
        throw new Error('List not found.')
      }
      setListDetails({ id: listSnap.id, ...listSnap.data() })

      // For now, load all words for simple study mode
      // (Full session flow with phases will come in Block E)
      const wordsRef = collection(db, 'lists', listId, 'words')
      const wordsQuery = query(wordsRef, orderBy('createdAt', 'asc'))
      const wordsSnap = await getDocs(wordsQuery)

      const allWords = wordsSnap.docs.map((docSnap, index) => ({
        id: docSnap.id,
        wordIndex: index,
        ...docSnap.data()
      }))

      if (allWords.length === 0) {
        setWords([])
        setSessionQueue([])
        setCurrentQueue([])
        setSessionPhase('complete')
      } else {
        setWords(allWords)
        setSessionQueue(allWords)
        setCurrentQueue(allWords)
        setDismissedIds(new Set())
        setCurrentIndex(0)
        setCardsReviewed(0)
        setSessionPhase('study')
      }
    } catch (err) {
      setError(err.message ?? 'Unable to load session.')
    } finally {
      setLoading(false)
    }
  }, [listId, user?.uid])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  const currentWord = currentQueue[currentIndex]

  const handleFlip = () => {
    setIsFlipped((prev) => !prev)
  }

  // Handle "I Know This" - dismiss from current session
  const handleKnowThis = () => {
    if (!currentWord) return

    const wordId = currentWord.id

    // Add to dismissed set
    setDismissedIds(prev => new Set([...prev, wordId]))

    // Remove from current queue
    setCurrentQueue(prev => prev.filter(w => w.id !== wordId))

    // Track cards reviewed
    setCardsReviewed(prev => prev + 1)

    // Move to next card or complete
    if (currentQueue.length <= 1) {
      setSessionPhase('complete')
    } else {
      // Stay at same index (next card shifts into position)
      // Unless we're at the end
      if (currentIndex >= currentQueue.length - 1) {
        setCurrentIndex(0)
      }
    }

    setIsFlipped(false)
  }

  // Handle "Not Sure" - keep in queue, move to end
  const handleNotSure = () => {
    if (!currentWord) return

    // Move current word to end of queue
    setCurrentQueue(prev => {
      const word = prev.find(w => w.id === currentWord.id)
      if (!word) return prev
      const filtered = prev.filter(w => w.id !== currentWord.id)
      return [...filtered, word]
    })

    // Track cards reviewed
    setCardsReviewed(prev => prev + 1)

    // Move to next card (which is now at current index)
    // If we were at the last card, go to beginning
    if (currentIndex >= currentQueue.length - 1) {
      setCurrentIndex(0)
    }

    setIsFlipped(false)
  }

  // Handle "Reset Session" - start over with full queue
  const handleResetSession = () => {
    setDismissedIds(new Set())
    setCurrentQueue([...sessionQueue])
    setCurrentIndex(0)
    setCardsReviewed(0)
    setIsFlipped(false)
    setSessionPhase('study')
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

  if (sessionPhase === 'complete' || currentQueue.length === 0) {
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
                {cardsReviewed}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-secondary">Dismissed (Knew)</span>
              <span className="text-sm font-semibold text-text-primary">
                {dismissedIds.size}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-secondary">Total Words</span>
              <span className="text-sm font-semibold text-text-primary">
                {sessionQueue.length}
              </span>
            </div>
          </div>

          <p className="mt-6 text-sm text-text-muted">
            Your study session is complete. Take a test to update your mastery!
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {dismissedIds.size < sessionQueue.length && (
              <Button 
                variant="outline" 
                size="lg" 
                onClick={handleResetSession}
                className="w-full"
              >
                Study Again ({sessionQueue.length - dismissedIds.size} remaining)
              </Button>
            )}
            <Button 
              variant="primary-blue" 
              size="lg" 
              onClick={() => navigate('/')} 
              className="w-full"
            >
              Back to Dashboard
            </Button>
          </div>
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
            Card {currentIndex + 1} of {currentQueue.length}
            {dismissedIds.size > 0 && (
              <span className="text-text-muted"> ({dismissedIds.size} dismissed)</span>
            )}
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
          <div className="relative z-10 flex flex-col gap-3">
            {/* Main action buttons */}
            <div className="flex flex-col gap-3 md:flex-row">
              <button
                type="button"
                onClick={handleNotSure}
                className="flex-1 rounded-2xl bg-amber-400 px-6 py-4 text-base font-semibold text-slate-900 shadow-lg shadow-amber-100 transition hover:bg-amber-500 active:scale-95"
              >
                Not Sure
              </button>
              <button
                type="button"
                onClick={handleKnowThis}
                className="flex-1 rounded-2xl bg-emerald-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-600 active:scale-95"
              >
                I Know This
              </button>
            </div>

            {/* Reset session button */}
            {dismissedIds.size > 0 && (
              <button
                type="button"
                onClick={handleResetSession}
                className="rounded-xl border border-border-default bg-surface px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-muted"
              >
                Reset Session ({dismissedIds.size} dismissed)
              </button>
            )}
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


