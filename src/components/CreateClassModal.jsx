import { useState } from 'react'
import { X } from 'lucide-react'
import { Button, IconButton } from './ui'
import { createClass } from '../services/db'

const CreateClassModal = ({ isOpen, onClose, ownerId, onCreated, canManage }) => {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) {
    return null
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canManage) {
      return
    }
    setError('')
    setIsSubmitting(true)
    try {
      const newClass = await createClass({ name, ownerTeacherId: ownerId })
      setName('')
      onCreated?.(newClass)
      onClose()
    } catch (err) {
      setError(err.message ?? 'Unable to create class right now.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Create New Class</h2>
            <p className="text-sm text-text-muted">Share the generated join code with students.</p>
          </div>
          <IconButton variant="close" size="sm" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </IconButton>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <label className="block text-sm font-medium text-slate-700">
            Class Name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              disabled={!canManage}
              className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2 disabled:opacity-60"
              placeholder="AP History Period 4"
            />
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
              disabled={isSubmitting || !canManage}
            >
              {isSubmitting ? 'Creating…' : 'Create Class'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateClassModal


