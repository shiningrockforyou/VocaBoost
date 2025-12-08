import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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

  // Calculate score
  const correctCount = results.filter(r => r.isCorrect).length
  const totalCount = results.length
  const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0

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

  const getScoreColor = (pct) => {
    if (pct >= 90) return 'text-emerald-600'
    if (pct >= 70) return 'text-amber-600'
    return 'text-red-600'
  }

  const getScoreBg = (pct) => {
    if (pct >= 90) return 'bg-emerald-50 border-emerald-200'
    if (pct >= 70) return 'bg-amber-50 border-amber-200'
    return 'bg-red-50 border-red-200'
  }

  return (
    <main className="min-h-screen bg-muted px-4 py-10">
      <div className="mx-auto max-w-4xl">
        
        {/* Summary Card */}
        <Card variant="default" size="xl" className="mb-6">
          <h1 className="text-3xl font-heading font-bold text-brand-text mb-2">Results</h1>
          {listTitle && (
            <p className="text-base font-body text-text-muted mb-6">{listTitle}</p>
          )}
          
          {/* Score Display */}
          <div className={`rounded-2xl border p-6 ${getScoreBg(percentage)}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-body text-text-muted mb-1">Your Score</p>
                <p className={`text-4xl font-heading font-bold ${getScoreColor(percentage)}`}>
                  {percentage}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-body text-text-muted mb-1">Correct Answers</p>
                <p className="text-2xl font-heading font-bold text-text-primary">
                  {correctCount} / {totalCount}
                </p>
              </div>
            </div>
          </div>

          {/* Challenge tokens for typed tests */}
          {testType === 'typed' && (
            <div className="mt-4 rounded-xl bg-muted p-4">
              <p className="text-sm font-body text-text-secondary">
                Challenge Tokens: <span className="font-heading font-bold text-text-primary">{availableTokens}/5</span> remaining
              </p>
            </div>
          )}
        </Card>

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
                  className={`p-5 rounded-xl border ${isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Word Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface border border-border-default text-xs font-heading font-bold text-text-muted">
                          {index + 1}
                        </span>
                        <span className="text-lg font-heading font-bold text-text-primary">{word.word}</span>
                        <span className={`text-xl ${isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>
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
                              ? 'text-emerald-700 bg-emerald-100 border border-emerald-200' 
                              : 'text-red-700 bg-red-100 border border-red-200'
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

        {/* Spacer to prevent content from being hidden behind sticky bar */}
        <div className="h-24" />
      </div>

      {/* Sticky Back Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border-default p-4 shadow-lg">
        <div className="mx-auto max-w-4xl text-center">
          <Link to="/">
            <Button variant="primary" size="lg">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Challenge Modal */}
      {challengeModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <Card variant="default" size="lg" className="max-w-md w-full shadow-2xl">
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
            
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mb-6">
              <p className="text-sm font-body text-amber-800">
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
    </main>
  )
}

export default TestResults

