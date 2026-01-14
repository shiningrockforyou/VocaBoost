import { useState, useEffect } from 'react'
import { getTeacherClasses, getClassStudents, createAssignment } from '../../services/apTeacherService'
import { FRQ_SUBMISSION_TYPE } from '../../utils/apTypes'
import { logError } from '../../utils/logError'

/**
 * Class checkbox item
 */
function ClassCheckbox({ cls, checked, onChange }) {
  const studentCount = cls.studentIds?.length || 0

  return (
    <label className="flex items-center gap-3 py-2 px-3 rounded-[--radius-sm] hover:bg-hover cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-border-default text-brand-primary focus:ring-brand-primary"
      />
      <div className="flex-1">
        <span className="text-text-primary">{cls.name}</span>
        {cls.period && (
          <span className="text-text-muted text-sm ml-2">Period {cls.period}</span>
        )}
      </div>
      <span className="text-text-secondary text-sm">
        {studentCount} student{studentCount !== 1 ? 's' : ''}
      </span>
    </label>
  )
}

/**
 * AssignTestModal - Assign test to classes/students
 */
export default function AssignTestModal({ test, teacherId, onClose, onSuccess }) {
  // Data state
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Selection state
  const [selectedClassIds, setSelectedClassIds] = useState(new Set())

  // Assignment settings
  const [dueDate, setDueDate] = useState('')
  const [maxAttempts, setMaxAttempts] = useState(1)
  const [frqSubmissionType, setFrqSubmissionType] = useState(FRQ_SUBMISSION_TYPE.TYPED)

  // Load classes
  useEffect(() => {
    async function loadClasses() {
      try {
        setLoading(true)
        const data = await getTeacherClasses(teacherId)
        setClasses(data)
      } catch (err) {
        logError('AssignTestModal.loadClasses', { teacherId }, err)
        setError(err.message || 'Failed to load classes')
      } finally {
        setLoading(false)
      }
    }

    loadClasses()
  }, [teacherId])

  // Toggle class selection
  const handleToggleClass = (classId, checked) => {
    const newSelected = new Set(selectedClassIds)
    if (checked) {
      newSelected.add(classId)
    } else {
      newSelected.delete(classId)
    }
    setSelectedClassIds(newSelected)
  }

  // Calculate total students
  const getTotalStudents = () => {
    let total = 0
    classes.forEach(cls => {
      if (selectedClassIds.has(cls.id)) {
        total += cls.studentIds?.length || 0
      }
    })
    return total
  }

  // Handle assign
  const handleAssign = async () => {
    if (selectedClassIds.size === 0) {
      alert('Please select at least one class')
      return
    }

    try {
      setSaving(true)
      setError(null)

      // Collect all student IDs from selected classes
      const allStudentIds = new Set()
      classes.forEach(cls => {
        if (selectedClassIds.has(cls.id)) {
          (cls.studentIds || []).forEach(id => allStudentIds.add(id))
        }
      })

      const assignmentData = {
        testId: test.id,
        classIds: Array.from(selectedClassIds),
        studentIds: Array.from(allStudentIds),
        dueDate: dueDate ? new Date(dueDate) : null,
        maxAttempts,
        frqSubmissionType,
        assignedBy: teacherId,
      }

      await createAssignment(assignmentData)

      if (onSuccess) {
        onSuccess()
      }
      onClose()
    } catch (err) {
      logError('AssignTestModal.assign', { testId: test.id }, err)
      setError(err.message || 'Failed to create assignment')
    } finally {
      setSaving(false)
    }
  }

  const totalStudents = getTotalStudents()
  const hasFRQ = test?.hasFRQ

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface rounded-[--radius-card] shadow-theme-lg w-full max-w-lg max-h-[90vh] overflow-hidden z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default shrink-0">
          <h2 className="text-lg font-semibold text-text-primary">
            Assign Test: {test?.title}
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-xl"
          >
            X
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
            </div>
          ) : error ? (
            <div className="bg-error rounded-[--radius-card] p-4">
              <p className="text-error-text">{error}</p>
            </div>
          ) : (
            <>
              {/* Class selection */}
              <div className="mb-6">
                <h3 className="font-medium text-text-primary mb-3">Select Classes</h3>
                {classes.length === 0 ? (
                  <p className="text-text-muted text-sm">No classes found.</p>
                ) : (
                  <div className="border border-border-default rounded-[--radius-card] divide-y divide-border-muted">
                    {classes.map(cls => (
                      <ClassCheckbox
                        key={cls.id}
                        cls={cls}
                        checked={selectedClassIds.has(cls.id)}
                        onChange={(checked) => handleToggleClass(cls.id, checked)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Settings */}
              <div className="space-y-4">
                <h3 className="font-medium text-text-primary">Settings</h3>

                {/* Due date */}
                <div>
                  <label className="block text-text-secondary text-sm mb-1">
                    Due Date (optional)
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
                  />
                </div>

                {/* Max attempts */}
                <div>
                  <label className="block text-text-secondary text-sm mb-1">
                    Max Attempts
                  </label>
                  <select
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(parseInt(e.target.value))}
                    className="w-full px-3 py-2 rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={-1}>Unlimited</option>
                  </select>
                </div>

                {/* FRQ mode (only if test has FRQ) */}
                {hasFRQ && (
                  <div>
                    <label className="block text-text-secondary text-sm mb-1">
                      FRQ Submission Mode
                    </label>
                    <select
                      value={frqSubmissionType}
                      onChange={(e) => setFrqSubmissionType(e.target.value)}
                      className="w-full px-3 py-2 rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
                    >
                      <option value={FRQ_SUBMISSION_TYPE.TYPED}>Typed</option>
                      <option value={FRQ_SUBMISSION_TYPE.HANDWRITTEN}>Handwritten (Upload)</option>
                    </select>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border-default bg-muted shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={saving || selectedClassIds.size === 0}
            className="px-6 py-2 rounded-[--radius-button] bg-brand-primary text-white font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Assigning...' : `Assign to ${totalStudents} students`}
          </button>
        </div>
      </div>
    </>
  )
}
