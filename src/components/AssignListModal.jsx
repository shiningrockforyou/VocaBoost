import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button, IconButton } from './ui'

const AssignListModal = ({ isOpen, onClose, lists = [], onAssign, isSubmitting }) => {
  const [selectedListId, setSelectedListId] = useState('')
  const [pace, setPace] = useState(20)
  const [testOptionsCount, setTestOptionsCount] = useState(4)
  const [testMode, setTestMode] = useState('mcq')
  const [passThreshold, setPassThreshold] = useState(95)
  const [testSizeNew, setTestSizeNew] = useState(50)

  useEffect(() => {
    if (isOpen) {
      setSelectedListId(lists[0]?.id ?? '')
      setPace(20)
      setTestOptionsCount(4)
      setTestMode('mcq')
      setPassThreshold(95)
      setTestSizeNew(50)
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
    onAssign?.(selectedListId, pace, testOptionsCount, testMode, passThreshold, testSizeNew)
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


