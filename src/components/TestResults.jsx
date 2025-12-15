import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { getAvailableChallengeTokens, submitChallenge } from '../services/db'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { Button, Card, Badge, Textarea, IconButton } from './ui'

const TestResults = ({
  testType,           // 'mcq' | 'typed'
  listTitle,          // Name of the vocabulary list
  words,              // Array of word objects with definitions
  responses,          // { wordId: 'student response/answer' }
  results,            // Array: [{ wordId, isCorrect, reasoning? }]
  attemptId,          // For challenge submission
}) => {
  const { user } = useAuth()
  const [availableTokens, setAvailableTokens] = useState(5)
  const [challengeModal, setChallengeModal] = useState({ isOpen: false, word: null })
  const [challengeNote, setChallengeNote] = useState('')
  const [isSubmittingChallenge, setIsSubmittingChallenge] = useState(false)
  const [challengedWords, setChallengedWords] = useState(new Set())

  // Fetch challenge tokens on mount (only for typed tests)
  useEffect(() => {
    const fetchTokens = async () => {
      if (testType === 'typed' && user?.uid) {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        const challengeHistory = userDoc.data()?.challenges?.history || []
        setAvailableTokens(getAvailableChallengeTokens(challengeHistory))
      }
    }
    fetchTokens()
  }, [testType, user?.uid])

  // ESC key handler for challenge modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && challengeModal.isOpen) {
        setChallengeModal({ isOpen: false, word: null })
        setChallengeNote('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [challengeModal.isOpen])

  const openChallengeModal = (word) => {
    setChallengeModal({ 
      isOpen: true, 
      word,
      wordId: word.id,
      studentResponse: responses[word.id] || '',
      correctAnswer: word.definition
    })
  }

  const handleSubmitChallenge = async () => {
    setIsSubmittingChallenge(true)
    try {
      await submitChallenge(user.uid, attemptId, challengeModal.wordId, challengeNote)
      setChallengedWords(prev => new Set([...prev, challengeModal.wordId]))
      setChallengeModal({ isOpen: false, word: null })
      setChallengeNote('')
    } catch (err) {
      alert(err.message || 'Failed to submit challenge')
    } finally {
      setIsSubmittingChallenge(false)
    }
  }

  return (
    <>
      {/* Detailed Results Card */}
      <Card variant="default" size="lg" className="overflow-hidden p-0">
        <div className="p-6 border-b border-border-default">
          <h2 className="text-xl font-heading font-bold text-text-primary">Answers</h2>
        </div>

        <div className="space-y-3 bg-surface p-3">
          {words.map((word, index) => {
            const result = results.find(r => r.wordId === word.id)
            const isCorrect = result?.isCorrect ?? false
            const studentAnswer = responses[word.id] || '(no answer)'
            const canChallenge = testType === 'typed' &&
                                 !isCorrect &&
                                 availableTokens > 0 &&
                                 !challengedWords.has(word.id)

            return (
              <div
                key={word.id}
                className="p-5 rounded-xl border bg-surface border-border-default"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Word Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface border border-border-default text-xs font-heading font-bold text-text-muted">
                        {index + 1}
                      </span>
                      <span className="text-lg font-heading font-bold text-text-primary">{word.word}</span>
                      <span className={`text-xl ${isCorrect ? 'text-text-success' : 'text-text-error'}`}>
                        {isCorrect ? '✓' : '✗'}
                      </span>
                    </div>

                    {/* Answers */}
                    <div className="space-y-2 ml-10">
                      <div>
                        <p className="text-xs font-medium text-text-muted mb-1">Correct Answer</p>
                        <p className="text-sm font-body text-text-secondary bg-surface rounded-lg px-3 py-2 border border-border-default">
                          {word.definition}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-text-muted mb-1">Your Answer</p>
                        <p className={`text-sm font-body rounded-lg px-3 py-2 ${
                          isCorrect
                            ? 'text-text-success-strong bg-success-subtle border border-border-success'
                            : 'text-text-error-strong bg-error-subtle border border-border-error'
                        }`}>
                          {studentAnswer}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Challenge UI for typed tests */}
                  <div className="flex-shrink-0">
                    {canChallenge && (
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => openChallengeModal(word)}
                      >
                        Challenge
                      </Button>
                    )}
                    {testType === 'typed' && !isCorrect && challengedWords.has(word.id) && (
                      <Badge variant="warning" shape="pill">Pending</Badge>
                    )}
                    {testType === 'typed' && !isCorrect && availableTokens === 0 && !challengedWords.has(word.id) && (
                      <span className="text-sm font-body text-text-faint">No tokens</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Challenge Modal */}
      {challengeModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          {/* Backdrop - click to close */}
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => {
              setChallengeModal({ isOpen: false, word: null })
              setChallengeNote('')
            }}
          />

          {/* Modal content */}
          <Card variant="default" size="lg" className="relative z-10 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-heading font-bold text-text-primary">Challenge</h3>
              <IconButton 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setChallengeModal({ isOpen: false, word: null })
                  setChallengeNote('')
                }}
              >
                <X size={18} />
              </IconButton>
            </div>

            <p className="text-lg font-heading font-bold text-brand-text mb-4">
              &quot;{challengeModal.word?.word}&quot;
            </p>
            
            <div className="space-y-3 mb-6">
              <div>
                <p className="text-xs font-medium text-text-muted mb-1">Your answer</p>
                <p className="text-sm font-body text-text-secondary bg-muted rounded-lg px-3 py-2">
                  {challengeModal.studentResponse || '(no answer)'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-text-muted mb-1">Correct answer</p>
                <p className="text-sm font-body text-text-secondary bg-muted rounded-lg px-3 py-2">
                  {challengeModal.correctAnswer}
                </p>
              </div>
            </div>
            
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Why should this be marked correct? (optional)
            </label>
            <Textarea
              value={challengeNote}
              onChange={(e) => setChallengeNote(e.target.value)}
              rows={3}
              placeholder="Explain why your answer is correct..."
              className="mb-4"
            />
            
            <div className="rounded-xl bg-warning border border-border-warning p-3 mb-6">
              <p className="text-sm font-body text-text-warning-strong">
                ⚠️ If rejected, you lose 1 token for 30 days
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => {
                  setChallengeModal({ isOpen: false, word: null })
                  setChallengeNote('')
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary-blue"
                size="lg"
                className="flex-1"
                onClick={handleSubmitChallenge}
                disabled={isSubmittingChallenge}
              >
                {isSubmittingChallenge ? 'Submitting...' : 'Submit Challenge'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}

export default TestResults

