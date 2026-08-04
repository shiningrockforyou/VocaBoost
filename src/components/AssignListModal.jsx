import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button, IconButton } from './ui'
import { REVIEW_V2_CLIENT } from '../config/featureFlags'

const AssignListModal = ({ isOpen, onClose, lists = [], onAssign, isSubmitting }) => {
  const [selectedListId, setSelectedListId] = useState('')
  const [pace, setPace] = useState(20)
  const [testOptionsCount, setTestOptionsCount] = useState(4)
  const [testMode, setTestMode] = useState('mcq')
  const [passThreshold, setPassThreshold] = useState(95)
  const [testSizeNew, setTestSizeNew] = useState(50)
  // Review test settings
  const [reviewTestType, setReviewTestType] = useState('mcq')
  const [reviewTestSizeMin, setReviewTestSizeMin] = useState(30)
  const [reviewTestSizeMax, setReviewTestSizeMax] = useState(60)
  // DF2-11 · REVIEW_V2_CLIENT review-settings group (rendered + written flag-ON only).
  const [reviewPassThreshold, setReviewPassThreshold] = useState(92)
  const [reviewQueueSize, setReviewQueueSize] = useState(60)
  const [reviewTestSize, setReviewTestSize] = useState(30)
  const [reviewGateEnabled, setReviewGateEnabled] = useState(true)

  useEffect(() => {
    if (isOpen) {
      setSelectedListId(lists[0]?.id ?? '')
      setPace(20)
      setTestOptionsCount(4)
      setTestMode('mcq')
      setPassThreshold(95)
      setTestSizeNew(50)
      setReviewTestType('mcq')
      setReviewTestSizeMin(30)
      setReviewTestSizeMax(60)
      setReviewPassThreshold(92)
      setReviewQueueSize(60)
      setReviewTestSize(30)
      setReviewGateEnabled(true)
    }
  }, [isOpen, lists])

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!selectedListId) return
    // DF2-11 · REVIEW_V2_CLIENT: the nine positional args are UNCHANGED; the review-settings
    // group rides an appended options object. Flag-OFF this 10th arg is `undefined`, so the
    // writer's spread-conditional keeps today's reviewTestSizeMin/Max ⇒ byte-identical write.
    onAssign?.(
      selectedListId, pace, testOptionsCount, testMode, passThreshold, testSizeNew,
      reviewTestType, reviewTestSizeMin, reviewTestSizeMax,
      REVIEW_V2_CLIENT
        ? { reviewPassThreshold, reviewQueueSize, reviewTestSize, reviewGateEnabled }
        : undefined,
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop - click to close */}
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />

      {/* Modal content */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Assign a List</h2>
            <p className="text-sm text-slate-500">Pick a list from your library for this class.</p>
          </div>
          <IconButton variant="close" size="sm" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </IconButton>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            List
            <select
              value={selectedListId}
              onChange={(event) => setSelectedListId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
            >
              {lists.length === 0 && <option value="">No lists available</option>}
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.title} · {list.wordCount ?? 0} words
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Daily New Words (Pace)
            <input
              type="number"
              min="1"
              max="100"
              value={pace}
              onChange={(event) => setPace(parseInt(event.target.value, 10) || 20)}
              className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
              placeholder="20"
            />
            <p className="mt-1 text-xs text-slate-500">
              Number of new words students can learn per day from this list.
            </p>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Test Options (choices per question)
            <input
              type="number"
              min="4"
              max="10"
              value={testOptionsCount}
              onChange={(event) =>
                setTestOptionsCount(Math.min(10, Math.max(4, parseInt(event.target.value, 10) || 4)))
              }
              className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
              placeholder="4"
            />
            <p className="mt-1 text-xs text-slate-500">Students will see this many answer choices on tests.</p>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Test Mode
            <select
              value={testMode}
              onChange={(event) => setTestMode(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
            >
              <option value="mcq">Multiple Choice Only</option>
              <option value="typed">Written Only</option>
              <option value="both">Both</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Choose which test format students will use for this list.
            </p>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Pass Threshold (%)
            <input
              type="number"
              min="50"
              max="100"
              value={passThreshold}
              onChange={(event) =>
                setPassThreshold(Math.min(100, Math.max(50, parseInt(event.target.value, 10) || 95)))
              }
              className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
              placeholder="95"
            />
            <p className="mt-1 text-xs text-slate-500">
              Students must score this % or higher to pass new word tests.
            </p>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            New Word Test Size
            <input
              type="number"
              min="10"
              max="100"
              value={testSizeNew}
              onChange={(event) =>
                setTestSizeNew(Math.min(100, Math.max(10, parseInt(event.target.value, 10) || 50)))
              }
              className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
              placeholder="50"
            />
            <p className="mt-1 text-xs text-slate-500">
              Max words per new word test (actual count depends on daily pace).
            </p>
          </label>

          {/* DF2-11 · REVIEW_V2_CLIENT: flag-scoped min/max → review-group SWAP. Flag-OFF renders
              today's "Review Test Settings" (min/max) section BYTE-IDENTICALLY (the physical delete
              rides the flip release, ledger E1); flag-ON renders the review-v2 settings group. */}
          {REVIEW_V2_CLIENT ? (
            <div className="border-t border-border-default pt-4 mt-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Review Settings</h3>

              <label className="block text-sm font-medium text-slate-700 mb-3">
                Review Test Mode
                <select
                  value={reviewTestType}
                  onChange={(event) => setReviewTestType(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
                >
                  <option value="mcq">Multiple Choice Only</option>
                  <option value="typed">Written Only</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">Test format for review tests (past words).</p>
              </label>

              <label className="block text-sm font-medium text-slate-700 mb-3">
                Review Pass Threshold (%)
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={reviewPassThreshold}
                  onChange={(event) =>
                    setReviewPassThreshold(Math.min(100, Math.max(1, parseInt(event.target.value, 10) || 92)))
                  }
                  className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
                  placeholder="92"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Students must score this % or higher to pass a review test (separate from the new-word threshold).
                </p>
              </label>

              <label className="block text-sm font-medium text-slate-700 mb-3">
                Review Queue Size
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={reviewQueueSize}
                  onChange={(event) =>
                    setReviewQueueSize(Math.min(500, Math.max(1, parseInt(event.target.value, 10) || 60)))
                  }
                  className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
                  placeholder="60"
                />
                <p className="mt-1 text-xs text-slate-500">How many past words are eligible for review each day.</p>
              </label>

              <label className="block text-sm font-medium text-slate-700 mb-3">
                Review Test Size
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={reviewTestSize}
                  onChange={(event) =>
                    setReviewTestSize(Math.min(500, Math.max(1, parseInt(event.target.value, 10) || 30)))
                  }
                  className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
                  placeholder="30"
                />
                <p className="mt-1 text-xs text-slate-500">How many words appear on each review test.</p>
              </label>

              <label className="flex items-start gap-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={reviewGateEnabled}
                  onChange={(event) => setReviewGateEnabled(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border-strong text-brand-primary focus:ring-2 focus:ring-border-strong"
                />
                <span>
                  Require a passing review test to advance
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    When on, a student must pass the review test to move ahead. Turn off to record the review without gating the day.
                  </span>
                </span>
              </label>
            </div>
          ) : (
          <div className="border-t border-border-default pt-4 mt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Review Test Settings</h3>

            <label className="block text-sm font-medium text-slate-700 mb-3">
              Review Test Mode
              <select
                value={reviewTestType}
                onChange={(event) => setReviewTestType(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
              >
                <option value="mcq">Multiple Choice Only</option>
                <option value="typed">Written Only</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Test format for review tests (past words).
              </p>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-slate-700">
                Min Questions
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={reviewTestSizeMin}
                  onChange={(event) =>
                    setReviewTestSizeMin(Math.min(100, Math.max(10, parseInt(event.target.value, 10) || 30)))
                  }
                  className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
                  placeholder="30"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Max Questions
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={reviewTestSizeMax}
                  onChange={(event) =>
                    setReviewTestSizeMax(Math.min(100, Math.max(10, parseInt(event.target.value, 10) || 60)))
                  }
                  className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
                  placeholder="60"
                />
              </label>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Review test size scales with intervention (min at 0%, max at 100%).
            </p>
          </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              variant="primary-blue" 
              size="lg" 
              className="flex-1" 
              type="submit"
              disabled={!selectedListId || isSubmitting || lists.length === 0}
            >
              {isSubmitting ? 'Assigning…' : 'Assign List'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AssignListModal


