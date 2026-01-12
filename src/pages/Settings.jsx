import { useState, useEffect, useCallback } from 'react'
import { Moon, Sun, Circle, Square, RotateCcw, ArrowLeft, AlertTriangle, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import HeaderBar from '../components/HeaderBar'
import { Card, Button } from '../components/ui'
import { fetchStudentClasses, resetStudentProgress } from '../services/db'

const Settings = () => {
  const {
    theme, setLightMode, setDarkMode,
    roundness, setRoundness,
    borderWeight, setBorderWeight,
    resetToDefaults,
  } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()

  // Reset Progress state
  const [studentClasses, setStudentClasses] = useState([])
  const [classesLoading, setClassesLoading] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedListId, setSelectedListId] = useState('')
  const [showConfirmModal1, setShowConfirmModal1] = useState(false)
  const [showConfirmModal2, setShowConfirmModal2] = useState(false)
  const [resetInput, setResetInput] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const [resetSuccess, setResetSuccess] = useState('')
  const [resetError, setResetError] = useState('')

  // Load student classes
  const loadClasses = useCallback(async () => {
    if (!user?.uid || user?.role === 'teacher') return
    setClassesLoading(true)
    try {
      const classes = await fetchStudentClasses(user.uid)
      setStudentClasses(classes)
    } catch (err) {
      console.error('Failed to load classes:', err)
    } finally {
      setClassesLoading(false)
    }
  }, [user?.uid, user?.role])

  useEffect(() => {
    loadClasses()
  }, [loadClasses])

  // Get lists for selected class
  const selectedClass = studentClasses.find(c => c.id === selectedClassId)
  const availableLists = selectedClass?.assignedListDetails || []
  const selectedList = availableLists.find(l => l.id === selectedListId)

  // Handle class selection change
  const handleClassChange = (e) => {
    setSelectedClassId(e.target.value)
    setSelectedListId('') // Reset list selection when class changes
    setResetSuccess('')
    setResetError('')
  }

  // Handle list selection change
  const handleListChange = (e) => {
    setSelectedListId(e.target.value)
    setResetSuccess('')
    setResetError('')
  }

  // Handle reset button click - show first modal
  const handleResetClick = () => {
    setShowConfirmModal1(true)
    setResetError('')
  }

  // Handle first modal continue - show second modal
  const handleConfirm1Continue = () => {
    setShowConfirmModal1(false)
    setShowConfirmModal2(true)
    setResetInput('')
  }

  // Handle final reset confirmation
  const handleFinalReset = async () => {
    if (resetInput !== 'RESET') return

    setIsResetting(true)
    setResetError('')
    try {
      await resetStudentProgress(user.uid, selectedClassId, selectedListId)
      setResetSuccess(`Progress for "${selectedClass?.name} - ${selectedList?.title}" has been reset.`)
      setShowConfirmModal2(false)
      setSelectedClassId('')
      setSelectedListId('')
      setResetInput('')
    } catch (err) {
      setResetError(err.message || 'Failed to reset progress')
    } finally {
      setIsResetting(false)
    }
  }

  // Close modals
  const closeModals = () => {
    setShowConfirmModal1(false)
    setShowConfirmModal2(false)
    setResetInput('')
  }

  const isStudent = user?.role !== 'teacher'
  const canReset = selectedClassId && selectedListId

  return (
    <main className="min-h-screen bg-base px-4 py-10 transition-colors">
      <div className="mx-auto max-w-3xl">
        <HeaderBar />

        {/* Back Button */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm font-medium text-text-muted hover:text-text-primary transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold text-brand-text">
              Settings
            </h1>
            <p className="font-body mt-1 text-base text-text-muted">
              Customize your VocaBoost experience.
            </p>
          </div>
          <Button
            variant="outline"
            size="md"
            onClick={resetToDefaults}
          >
            <RotateCcw size={16} />
            Reset
          </Button>
        </div>

        {/* Settings Card */}
        <Card variant="section" className="space-y-8">

          {/* Theme Section */}
          <div>
            <h2 className="text-lg font-heading font-bold text-text-primary mb-2">
              Theme
            </h2>
            <p className="text-sm text-text-muted mb-4">
              Choose light or dark mode.
            </p>

            <div className="flex flex-wrap gap-3">
              <OptionButton
                active={theme === 'light'}
                onClick={setLightMode}
                icon={<Sun size={24} />}
                label="Light"
              />
              <OptionButton
                active={theme === 'dark'}
                onClick={setDarkMode}
                icon={<Moon size={24} />}
                label="Dark"
              />
            </div>
          </div>

          <hr className="border-border-default" />

          {/* Roundness Section */}
          <div>
            <h2 className="text-lg font-heading font-bold text-text-primary mb-2">
              Roundness
            </h2>
            <p className="text-sm text-text-muted mb-4">
              Adjust the corner radius of buttons and cards.
            </p>

            <div className="flex flex-wrap gap-3">
              <OptionButton
                active={roundness === 'sharp'}
                onClick={() => setRoundness('sharp')}
                icon={<Square size={24} />}
                label="Sharp"
              />
              <OptionButton
                active={roundness === 'normal'}
                onClick={() => setRoundness('normal')}
                icon={<RoundedSquare />}
                label="Normal"
              />
              <OptionButton
                active={roundness === 'rounded'}
                onClick={() => setRoundness('rounded')}
                icon={<Circle size={24} />}
                label="Rounded"
              />
            </div>
          </div>

          <hr className="border-border-default" />

          {/* Border Weight Section */}
          <div>
            <h2 className="text-lg font-heading font-bold text-text-primary mb-2">
              Border Weight
            </h2>
            <p className="text-sm text-text-muted mb-4">
              Adjust the visibility of borders.
            </p>

            <div className="flex flex-wrap gap-3">
              <OptionButton
                active={borderWeight === 'light'}
                onClick={() => setBorderWeight('light')}
                icon={<BorderIcon weight="light" />}
                label="Light"
              />
              <OptionButton
                active={borderWeight === 'normal'}
                onClick={() => setBorderWeight('normal')}
                icon={<BorderIcon weight="normal" />}
                label="Normal"
              />
              <OptionButton
                active={borderWeight === 'strong'}
                onClick={() => setBorderWeight('strong')}
                icon={<BorderIcon weight="strong" />}
                label="Strong"
              />
            </div>
          </div>

          <hr className="border-border-default" />

          {/* Preview Section */}
          <div>
            <h2 className="text-lg font-heading font-bold text-text-primary mb-2">
              Preview
            </h2>
            <p className="text-sm text-text-muted mb-4">
              See how your settings look.
            </p>

            <div className="flex flex-wrap gap-4">
              <Card variant="content" className="w-48">
                <p className="text-sm font-medium text-text-primary mb-2">Sample Card</p>
                <p className="text-xs text-text-muted">This is a preview of your current settings.</p>
              </Card>

              <div className="flex flex-col gap-2">
                <Button variant="primary" size="md">Primary Button</Button>
                <Button variant="outline" size="md">Outline Button</Button>
                <Button variant="ghost" size="md">Ghost Button</Button>
              </div>
            </div>
          </div>

          {/* Reset Progress Section - Only show for students */}
          {isStudent && (
            <>
              <hr className="border-border-default" />

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={20} className="text-red-500" />
                  <h2 className="text-lg font-heading font-bold text-red-600">
                    Reset Progress
                  </h2>
                </div>
                <p className="text-sm text-text-muted mb-4">
                  Reset your study progress for a specific class and list. This will delete all your study history and start fresh.
                </p>

                {classesLoading ? (
                  <p className="text-sm text-text-muted">Loading classes...</p>
                ) : studentClasses.length === 0 ? (
                  <p className="text-sm text-text-muted">No classes enrolled.</p>
                ) : (
                  <div className="space-y-4">
                    {/* Class Dropdown */}
                    <div>
                      <label htmlFor="reset-class" className="block text-sm font-medium text-text-primary mb-1">
                        Select Class
                      </label>
                      <select
                        id="reset-class"
                        value={selectedClassId}
                        onChange={handleClassChange}
                        className="w-full max-w-xs px-3 py-2 rounded-card border border-border-default bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                      >
                        <option value="">Choose a class...</option>
                        {studentClasses.map(cls => (
                          <option key={cls.id} value={cls.id}>{cls.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* List Dropdown - only show when class is selected */}
                    {selectedClassId && (
                      <div>
                        <label htmlFor="reset-list" className="block text-sm font-medium text-text-primary mb-1">
                          Select List
                        </label>
                        <select
                          id="reset-list"
                          value={selectedListId}
                          onChange={handleListChange}
                          className="w-full max-w-xs px-3 py-2 rounded-card border border-border-default bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        >
                          <option value="">Choose a list...</option>
                          {availableLists.map(list => (
                            <option key={list.id} value={list.id}>{list.title}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Success Message */}
                    {resetSuccess && (
                      <p className="text-sm text-green-600 font-medium">{resetSuccess}</p>
                    )}

                    {/* Error Message */}
                    {resetError && (
                      <p className="text-sm text-red-600 font-medium">{resetError}</p>
                    )}

                    {/* Reset Button */}
                    <Button
                      variant="outline"
                      size="md"
                      onClick={handleResetClick}
                      disabled={!canReset}
                      className="border-red-500 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <AlertTriangle size={16} />
                      Reset Progress
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

        </Card>
      </div>

      {/* First Confirmation Modal */}
      {showConfirmModal1 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-card border border-border-default max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={24} className="text-red-500" />
                <h3 className="text-lg font-heading font-bold text-text-primary">
                  Reset Progress?
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModals}
                className="text-text-muted hover:text-text-primary"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-text-secondary mb-2">
              Are you sure you want to reset your progress for:
            </p>
            <p className="font-semibold text-text-primary mb-4">
              {selectedClass?.name} — {selectedList?.title}
            </p>

            <div className="text-sm text-text-secondary mb-4">
              <p className="mb-2">
                This will <strong>permanently delete</strong>:
              </p>
              <ul className="list-disc list-inside space-y-1 mb-3">
                <li>Your current study progress for this list</li>
                <li>All vocabulary mastery records</li>
                <li className="text-red-600 font-medium">All test submissions and scores</li>
                <li className="text-red-600 font-medium">Your records in the teacher's gradebook</li>
              </ul>
              <p className="mb-2">
                You will start completely fresh from <strong>Day 0</strong>.
              </p>
              <p className="text-red-600 font-semibold">
                This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="md" onClick={closeModals}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleConfirm1Continue}
                className="bg-red-600 hover:bg-red-700"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Second Confirmation Modal - Type RESET */}
      {showConfirmModal2 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-card border border-border-default max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={24} className="text-red-500" />
                <h3 className="text-lg font-heading font-bold text-text-primary">
                  Final Confirmation
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModals}
                className="text-text-muted hover:text-text-primary"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-text-secondary mb-4">
              This action <span className="font-bold text-red-600">cannot be undone</span>. To confirm, type <span className="font-mono font-bold">RESET</span> below:
            </p>

            <input
              type="text"
              value={resetInput}
              onChange={(e) => setResetInput(e.target.value)}
              placeholder="Type RESET"
              className="w-full px-3 py-2 rounded-card border border-border-default bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-red-500 mb-6 font-mono"
              autoFocus
            />

            {resetError && (
              <p className="text-sm text-red-600 mb-4">{resetError}</p>
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="md" onClick={closeModals}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleFinalReset}
                disabled={resetInput !== 'RESET' || isResetting}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResetting ? 'Resetting...' : 'Reset Progress'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// Reusable option button component
const OptionButton = ({ active, onClick, icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex flex-col items-center gap-2 p-4 rounded-card border-2 transition-all min-w-[100px] hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95 ${
      active
        ? 'border-brand-primary bg-accent-blue'
        : 'border-border-default bg-surface hover:border-border-strong'
    }`}
  >
    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
      active
        ? 'bg-brand-primary text-white'
        : 'bg-muted text-text-muted'
    }`}>
      {icon}
    </div>
    <span className={`text-sm font-semibold ${
      active
        ? 'text-brand-text'
        : 'text-text-secondary'
    }`}>
      {label}
    </span>
  </button>
)

// Custom icon for "Normal" roundness (rounded square)
const RoundedSquare = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="4" ry="4" />
  </svg>
)

// Custom icon for border weight
const BorderIcon = ({ weight }) => {
  const strokeWidth = weight === 'light' ? 1 : weight === 'strong' ? 3 : 2
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    </svg>
  )
}

export default Settings
