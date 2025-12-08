import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button, IconButton } from './ui'

const AssignListModal = ({ isOpen, onClose, lists = [], onAssign, isSubmitting }) => {
  const [selectedListId, setSelectedListId] = useState('')
  const [pace, setPace] = useState(20)
  const [testOptionsCount, setTestOptionsCount] = useState(4)
  const [testMode, setTestMode] = useState('mcq')

  useEffect(() => {
    if (isOpen) {
      setSelectedListId(lists[0]?.id ?? '')
      setPace(20)
      setTestOptionsCount(4)
      setTestMode('mcq')
    }
  }, [isOpen, lists])

  if (!isOpen) {
    return null
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!selectedListId) return
    onAssign?.(selectedListId, pace, testOptionsCount, testMode)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-2xl">
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


