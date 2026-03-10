import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import APHeader from '../components/APHeader'
import {
  getTeacherClasses,
  getClassStudents,
  createClass,
  deleteClass,
  addStudentToClass,
  removeStudentFromClass,
} from '../services/apTeacherService'
import { AP_SUBJECTS } from '../utils/apTestConfig'
import { logError } from '../utils/logError'

/**
 * APClassManager - Teacher class management page
 */
export default function APClassManager() {
  const { user } = useAuth()

  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Create class form
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPeriod, setNewPeriod] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [creating, setCreating] = useState(false)

  // Add student
  const [studentEmail, setStudentEmail] = useState('')
  const [addingStudent, setAddingStudent] = useState(false)

  useEffect(() => {
    async function loadClasses() {
      if (!user) return
      try {
        setLoading(true)
        const data = await getTeacherClasses(user.uid)
        setClasses(data)
      } catch (err) {
        logError('APClassManager.loadClasses', { userId: user.uid }, err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadClasses()
  }, [user])

  // Load students when class selected
  useEffect(() => {
    async function loadStudents() {
      if (!selectedClass) {
        setStudents([])
        return
      }
      try {
        const data = await getClassStudents(selectedClass.id)
        setStudents(data)
      } catch (err) {
        logError('APClassManager.loadStudents', { classId: selectedClass.id }, err)
      }
    }
    loadStudents()
  }, [selectedClass])

  const handleCreateClass = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      setCreating(true)
      const newClass = await createClass(user.uid, {
        name: newName.trim(),
        period: newPeriod.trim() || null,
        subject: newSubject || null,
      })
      setClasses(prev => [...prev, newClass])
      setNewName('')
      setNewPeriod('')
      setNewSubject('')
      setShowCreate(false)
    } catch (err) {
      logError('APClassManager.createClass', {}, err)
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteClass = async (classId) => {
    if (!confirm('Delete this class? This cannot be undone.')) return
    try {
      await deleteClass(classId)
      setClasses(prev => prev.filter(c => c.id !== classId))
      if (selectedClass?.id === classId) setSelectedClass(null)
    } catch (err) {
      logError('APClassManager.deleteClass', { classId }, err)
    }
  }

  const handleAddStudent = async (e) => {
    e.preventDefault()
    if (!studentEmail.trim() || !selectedClass) return
    try {
      setAddingStudent(true)
      // Use email as student ID placeholder — in production, resolve email to uid
      await addStudentToClass(selectedClass.id, studentEmail.trim())
      setStudentEmail('')
      // Reload students
      const data = await getClassStudents(selectedClass.id)
      setStudents(data)
    } catch (err) {
      logError('APClassManager.addStudent', {}, err)
      setError(err.message)
    } finally {
      setAddingStudent(false)
    }
  }

  const handleRemoveStudent = async (studentId) => {
    if (!selectedClass) return
    try {
      await removeStudentFromClass(selectedClass.id, studentId)
      setStudents(prev => prev.filter(s => s.id !== studentId))
    } catch (err) {
      logError('APClassManager.removeStudent', {}, err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-base">
        <APHeader />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-6" />
            <div className="h-32 bg-muted rounded mb-4" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base">
      <APHeader />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Manage Classes</h1>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 rounded-[--radius-button] bg-brand-primary text-white hover:opacity-90 text-sm"
          >
            + New Class
          </button>
        </div>

        {error && (
          <div className="bg-error rounded-[--radius-alert] p-3 mb-4">
            <p className="text-error-text text-sm">{error}</p>
          </div>
        )}

        {/* Create class form */}
        {showCreate && (
          <form onSubmit={handleCreateClass} className="bg-surface rounded-[--radius-card] border border-border-default p-4 mb-6">
            <h3 className="font-medium text-text-primary mb-3">Create New Class</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Class name"
                required
                className="px-3 py-2 rounded-[--radius-input] border border-border-default bg-surface text-text-primary text-sm"
              />
              <input
                type="text"
                value={newPeriod}
                onChange={(e) => setNewPeriod(e.target.value)}
                placeholder="Period (optional)"
                className="px-3 py-2 rounded-[--radius-input] border border-border-default bg-surface text-text-primary text-sm"
              />
              <select
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="px-3 py-2 rounded-[--radius-input] border border-border-default bg-surface text-text-primary text-sm"
              >
                <option value="">Subject (optional)</option>
                {Object.values(AP_SUBJECTS).map(s => (
                  <option key={s.id} value={s.id}>{s.shortName}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 rounded-[--radius-button] bg-brand-primary text-white text-sm hover:opacity-90 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-[--radius-button] border border-border-default text-text-secondary text-sm hover:bg-hover"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Class list */}
          <div className="md:col-span-1">
            <h2 className="font-medium text-text-secondary text-sm mb-3">
              Your Classes ({classes.length})
            </h2>
            <div className="space-y-2">
              {classes.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClass(cls)}
                  className={`
                    w-full text-left p-3 rounded-[--radius-card] border transition-colors
                    ${selectedClass?.id === cls.id
                      ? 'border-brand-primary bg-brand-primary/5'
                      : 'border-border-default bg-surface hover:bg-hover'
                    }
                  `}
                >
                  <div className="font-medium text-text-primary text-sm">{cls.name}</div>
                  {cls.period && (
                    <div className="text-text-muted text-xs">Period {cls.period}</div>
                  )}
                  <div className="text-text-muted text-xs">
                    {cls.studentIds?.length || 0} students
                  </div>
                </button>
              ))}
              {classes.length === 0 && (
                <p className="text-text-muted text-sm">No classes yet. Create one above.</p>
              )}
            </div>
          </div>

          {/* Class detail */}
          <div className="md:col-span-2">
            {selectedClass ? (
              <div className="bg-surface rounded-[--radius-card] border border-border-default p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-text-primary">{selectedClass.name}</h2>
                    {selectedClass.period && (
                      <p className="text-text-muted text-sm">Period {selectedClass.period}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteClass(selectedClass.id)}
                    className="text-error-text text-xs hover:underline"
                  >
                    Delete Class
                  </button>
                </div>

                {/* Add student form */}
                <form onSubmit={handleAddStudent} className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    placeholder="Student email or ID"
                    className="flex-1 px-3 py-2 rounded-[--radius-input] border border-border-default bg-surface text-text-primary text-sm"
                  />
                  <button
                    type="submit"
                    disabled={addingStudent || !studentEmail.trim()}
                    className="px-4 py-2 rounded-[--radius-button] bg-brand-primary text-white text-sm hover:opacity-90 disabled:opacity-50"
                  >
                    Add
                  </button>
                </form>

                {/* Student list */}
                <h3 className="text-text-secondary text-sm font-medium mb-2">
                  Students ({students.length})
                </h3>
                <div className="space-y-2">
                  {students.map(student => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between py-2 px-3 bg-muted rounded-[--radius-sm]"
                    >
                      <div>
                        <span className="text-text-primary text-sm">
                          {student.profile?.displayName || student.displayName || student.email || student.id}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveStudent(student.id)}
                        className="text-error-text text-xs hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {students.length === 0 && (
                    <p className="text-text-muted text-sm">No students yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-surface rounded-[--radius-card] border border-border-default p-8 text-center">
                <p className="text-text-muted">Select a class to manage students</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
