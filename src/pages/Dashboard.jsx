import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { Activity, BookOpen, ChevronDown, Plus, RefreshCw, Trash2, FileText, ExternalLink } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import HeaderBar from '../components/HeaderBar.jsx'
import {
  deleteClass,
  deleteList,
  fetchAllWords,
  fetchDashboardStats,
  fetchStudentClasses,
  fetchTeacherClasses,
  fetchTeacherLists,
  fetchUserAttempts,
  joinClass,
  updateUserSettings,
} from '../services/db'
import { getClassProgress } from '../services/progressService'
import { WORD_STATUS, calculateExpectedStudyDay } from '../types/studyTypes'
import { db } from '../firebase'
import CreateClassModal from '../components/CreateClassModal.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { downloadListAsPDF } from '../utils/pdfGenerator.js'
import { getTodaysBatchForPDF, getCompleteBatchForPDF, determineStartingPhase } from '../services/studyService'
import { getSessionState, shouldShowReEntryModal, clearSessionState } from '../services/sessionService'
import MasterySquares from '../components/MasterySquares.jsx'
import StudySelectionModal from '../components/modals/StudySelectionModal.jsx'
import { Button, IconButton, CardButton } from '../components/ui'
import SegmentDebugPanel from '../components/dev/SegmentDebugPanel.jsx'

// Show debug panel in dev mode or when VITE_SHOW_DEBUG is set
const showDebugPanel = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEBUG === 'true'

// Helper: Calculate streak from recentSessions with weekend skip logic
const calculateStreak = (recentSessions, studyDaysPerWeek) => {
  if (!recentSessions || recentSessions.length === 0) return 0

  // Sort sessions by date descending (most recent first)
  const sortedSessions = [...recentSessions]
    .filter(s => s.date)
    .map(s => {
      const date = s.date?.toDate?.() || s.date
      return { ...s, dateObj: date instanceof Date ? date : new Date(date) }
    })
    .sort((a, b) => b.dateObj - a.dateObj)

  if (sortedSessions.length === 0) return 0

  const skipWeekends = studyDaysPerWeek <= 5

  // Helper to check if a date is a weekend
  const isWeekend = (date) => {
    const day = date.getDay()
    return day === 0 || day === 6 // Sunday = 0, Saturday = 6
  }

  // Helper to get the previous expected study day
  const getPreviousStudyDay = (date) => {
    const prev = new Date(date)
    prev.setDate(prev.getDate() - 1)
    prev.setHours(0, 0, 0, 0)

    if (skipWeekends) {
      // Skip backwards over weekends
      while (isWeekend(prev)) {
        prev.setDate(prev.getDate() - 1)
      }
    }
    return prev
  }

  // Normalize a date to start of day for comparison
  const normalizeDate = (date) => {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
  }

  // Create a set of session dates for quick lookup
  const sessionDates = new Set(
    sortedSessions.map(s => normalizeDate(s.dateObj).getTime())
  )

  // Start from the most recent session date
  let streak = 1
  let currentDate = normalizeDate(sortedSessions[0].dateObj)

  // Walk backwards checking for consecutive study days
  while (true) {
    const expectedPrevDate = getPreviousStudyDay(currentDate)

    if (sessionDates.has(expectedPrevDate.getTime())) {
      streak++
      currentDate = expectedPrevDate
    } else {
      break
    }
  }

  // Only count streak if the most recent session was today or yesterday (or last weekday if skipping weekends)
  const today = normalizeDate(new Date())
  const mostRecentSession = normalizeDate(sortedSessions[0].dateObj)

  // Calculate expected "yesterday" (accounting for weekend skip)
  const getYesterday = () => {
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (skipWeekends) {
      while (isWeekend(yesterday)) {
        yesterday.setDate(yesterday.getDate() - 1)
      }
    }
    return yesterday
  }

  const yesterday = getYesterday()

  if (mostRecentSession.getTime() === today.getTime() ||
      mostRecentSession.getTime() === yesterday.getTime()) {
    return streak
  }

  // Streak is broken - most recent session is too old
  return 0
}

const extractListIdFromTestId = (testId = '') => {
  const match = /^test_([^_]+)_/.exec(testId)
  return match ? match[1] : null
}

// Error state component for dashboard panels
function PanelError({ message = "Unable to load", className = "" }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-muted border border-border-default ${className}`}>
      {/* Diagonal stripes background */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            currentColor 10px,
            currentColor 12px
          )`
        }}
      />
      {/* Content */}
      <div className="relative flex flex-col items-center justify-center h-full p-6 text-center">
        <svg
          className="w-8 h-8 text-text-muted mb-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="text-sm text-text-muted font-medium">{message}</p>
      </div>
    </div>
  )
}

function ListProgressStats({ classId, listId, progressData, assignment }) {
  const key = `${classId}_${listId}`

  // Key doesn't exist = still loading
  if (!(key in progressData)) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg bg-muted px-3 py-2 min-w-[90px] h-full">
        <div className="h-3 w-8 bg-text-muted/20 rounded animate-pulse mb-1" />
        <div className="h-8 w-10 bg-text-muted/20 rounded animate-pulse" />
      </div>
    )
  }

  const progress = progressData[key]
  // null = new user (Day 1), object = has progress
  const completedDays = progress?.currentStudyDay ?? 0
  const studyDaysPerWeek = assignment?.studyDaysPerWeek ?? 5
  const programStartDate = progress?.programStartDate?.toDate?.() || progress?.programStartDate
  const expectedDay = calculateExpectedStudyDay(programStartDate, studyDaysPerWeek)

  const difference = completedDays - expectedDay
  const isAhead = difference > 0
  const isBehind = difference < 0
  const isOnTrack = difference === 0

  // Display day = currentStudyDay + 1 (consistent with session view)
  // currentStudyDay=0 means on Day 1, currentStudyDay=1 means on Day 2, etc.
  const displayDay = completedDays + 1

  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-muted px-3 py-2 min-w-[90px] h-full">
      <span className="text-xs text-text-muted uppercase tracking-wide font-medium">Day</span>
      <span className="font-heading text-3xl font-bold text-brand-text">{displayDay}</span>
      {isBehind && (
        <span className="text-[10px] font-medium text-red-500 whitespace-nowrap">
          {Math.abs(difference)} behind
        </span>
      )}
      {isAhead && (
        <span className="text-[10px] font-medium text-emerald-500 whitespace-nowrap">
          {difference} ahead
        </span>
      )}
      {isOnTrack && completedDays > 0 && (
        <span className="text-[10px] font-medium text-blue-500 whitespace-nowrap">
          On track
        </span>
      )}
    </div>
  )
}

const Dashboard = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [classError, setClassError] = useState('')
  const [classes, setClasses] = useState([])
  const [classesLoading, setClassesLoading] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const displayName =
    user?.profile?.displayName || user?.displayName || user?.email?.split('@')[0] || user?.email || 'Student'
  const isTeacher = user?.role === 'teacher'
  const [studentClasses, setStudentClasses] = useState([])
  const [studentClassesLoading, setStudentClassesLoading] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joinSuccess, setJoinSuccess] = useState('')
  const [joining, setJoining] = useState(false)
  const [userStats, setUserStats] = useState(null)
  const [userSettings, setUserSettings] = useState(null)
  const [dashboardStats, setDashboardStats] = useState(null)
  const [teacherLists, setTeacherLists] = useState([])
  const [listsLoading, setListsLoading] = useState(false)
  const [listsError, setListsError] = useState('')
  const [generatingPDF, setGeneratingPDF] = useState(null)
  const pdfDataCache = useRef({})
  const [deletingClassId, setDeletingClassId] = useState(null)
  const [deletingListId, setDeletingListId] = useState(null)
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null)
  const [userAttempts, setUserAttempts] = useState([])
  const [progressData, setProgressData] = useState({}) // keyed by `${classId}_${listId}`
  const [pdfModalOpen, setPdfModalOpen] = useState(false)
  const [pdfModalContext, setPdfModalContext] = useState(null) // { classId, listId, listTitle, assignment }
  const [showTodayPdfModal, setShowTodayPdfModal] = useState(false)
  const [showReEntryModal, setShowReEntryModal] = useState(false)
  const [reEntryContext, setReEntryContext] = useState(null) // { classId, listId, score }
  const [showListSelector, setShowListSelector] = useState(false)

  // Build list of all available lists for the selector dropdown
  const availableLists = useMemo(() => {
    const lists = []
    studentClasses.forEach((klass) => {
      klass.assignedListDetails?.forEach((list) => {
        lists.push({
          id: list.id,
          title: list.title || 'Vocabulary List',
          classId: klass.id,
          className: klass.name,
        })
      })
    })
    return lists
  }, [studentClasses])

  // Handler for selecting a new primary focus list
  const handleListSelection = async (list) => {
    setShowListSelector(false)
    await updateUserSettings(user.uid, {
      primaryFocusListId: list.id,
      primaryFocusClassId: list.classId,
    })
    setUserSettings((prev) => ({
      ...prev,
      primaryFocusListId: list.id,
      primaryFocusClassId: list.classId,
    }))
  }

  // List title lookup - must be defined before latestTestTitle uses it
  const listTitleLookup = useMemo(() => {
    const lookup = {}
    studentClasses.forEach((klass) => {
      ;(klass.assignedListDetails || []).forEach((list) => {
        lookup[list.id] = list.title || 'Vocabulary Test'
      })
    })
    return lookup
  }, [studentClasses])

  const latestTest = dashboardStats?.latestTest || null
  const latestTestListId = latestTest ? extractListIdFromTestId(latestTest.testId) : null
  const latestTestTitle =
    (latestTestListId && listTitleLookup[latestTestListId]) || latestTest?.testName || 'Vocabulary Test'
  const missedWords = latestTest?.answers?.filter((answer) => !answer.isCorrect) ?? []

  const loadTeacherClasses = useCallback(async () => {
    if (!isTeacher || !user?.uid) {
      return
    }
    setClassError('')
    setClassesLoading(true)
    try {
      const teacherClasses = await fetchTeacherClasses(user.uid)
      setClasses(teacherClasses)
    } catch (err) {
      setClassError(err.message ?? 'Unable to load your classes.')
    } finally {
      setClassesLoading(false)
    }
  }, [isTeacher, user?.uid])

  useEffect(() => {
    loadTeacherClasses()
  }, [loadTeacherClasses])

  const loadDashboardStats = useCallback(async () => {
    if (isTeacher || !user?.uid) {
      return
    }
    try {
      const stats = await fetchDashboardStats(user.uid)
      setDashboardStats(stats)
    } catch (err) {
      console.error('Unable to fetch dashboard stats', err)
      setDashboardStats(null)
    }
  }, [isTeacher, user?.uid])

  const loadUserAttempts = useCallback(async () => {
    if (!user?.uid || isTeacher) {
      return
    }
    try {
      const attempts = await fetchUserAttempts(user.uid)
      setUserAttempts(attempts)
    } catch (err) {
      console.error('Unable to fetch user attempts', err)
      setUserAttempts([])
    }
  }, [user?.uid, isTeacher])

  const loadTeacherLists = useCallback(async () => {
    if (!isTeacher || !user?.uid) {
      return
    }
    setListsError('')
    setListsLoading(true)
    try {
      const lists = await fetchTeacherLists(user.uid)
      setTeacherLists(lists)
    } catch (err) {
      setListsError(err.message ?? 'Unable to load your lists.')
    } finally {
      setListsLoading(false)
    }
  }, [isTeacher, user?.uid])

  useEffect(() => {
    if (isTeacher) {
      loadTeacherLists()
    }
  }, [isTeacher, loadTeacherLists])

  useEffect(() => {
    loadDashboardStats()
    loadUserAttempts()
  }, [loadDashboardStats, loadUserAttempts])

  const handlePDFClick = (classId, listId, listTitle, assignment) => {
    setPdfModalContext({ classId, listId, listTitle, assignment })
    setPdfModalOpen(true)
  }

  const handlePDFSelect = async (mode, directContext = null) => {
    const context = directContext || pdfModalContext
    if (!context) return

    const { classId, listId, listTitle, assignment } = context
    setGeneratingPDF({ listId, mode })
    setPdfModalOpen(false)

    try {
      let words

      if (mode === 'today-fast' && user?.uid) {
        // Smart selection for today's batch (fast mode)
        words = await getTodaysBatchForPDF(user.uid, classId, listId, assignment)
      } else if (mode === 'today-complete' && user?.uid) {
        // All words in segment (complete mode)
        words = await getCompleteBatchForPDF(user.uid, classId, listId, assignment)
      } else if (mode === 'today' && user?.uid) {
        // Legacy support - treat as fast mode
        words = await getTodaysBatchForPDF(user.uid, classId, listId, assignment)
      } else {
        // Full list - need to add wordIndex
        const allWords = await fetchAllWords(listId)
        words = allWords.map((w, idx) => ({ ...w, wordIndex: w.wordIndex ?? idx }))
      }

      // Handle structured format { newWords, failedCarryover } or flat array
      const isStructured = words && !Array.isArray(words) && 'newWords' in words
      const wordCount = isStructured
        ? (words.newWords?.length || 0) + (words.failedCarryover?.length || 0)
        : (words?.length || 0)

      if (wordCount === 0) {
        alert('This list has no words to export.')
        setGeneratingPDF(null)
        setPdfModalContext(null)
        return
      }

      // Normalize words while preserving structured format
      const normalizeWord = (word) => ({
        ...word,
        partOfSpeech: word?.partOfSpeech ?? word?.pos ?? word?.part_of_speech ?? '',
      })

      const normalizedWords = isStructured
        ? {
            newWords: words.newWords?.map(normalizeWord) || [],
            failedCarryover: words.failedCarryover?.map(normalizeWord) || [],
            reviewWords: words.reviewWords?.map(normalizeWord) || []
          }
        : words.map(normalizeWord)

      await downloadListAsPDF(listTitle, normalizedWords, mode)
    } catch (err) {
      console.error('PDF generation failed:', err)
      alert('Failed to generate PDF')
    } finally {
      setGeneratingPDF(null)
      setPdfModalContext(null)
    }
  }

  // Legacy handler for teachers (no modal)
  const handleDownloadPDF = async (listId, listTitle, classId = null, isStudent = false) => {
    if (!listId) return
    
    // If student, show modal instead
    if (isStudent && user?.uid) {
      // Find assignment from student classes
      const klass = studentClasses.find(c => c.id === classId)
      const assignment = klass?.assignments?.[listId]
      if (assignment) {
        handlePDFClick(classId, listId, listTitle, assignment)
        return
      }
    }
    
    // Teacher or fallback: direct download
    setGeneratingPDF({ listId, mode: 'full' })
    try {
      const allWords = await fetchAllWords(listId)
      const wordsWithIndex = allWords.map((w, idx) => ({ 
        ...w, 
        wordIndex: w.wordIndex ?? idx 
      }))
      
      const normalizedWords = wordsWithIndex.map((word) => ({
        ...word,
        partOfSpeech: word?.partOfSpeech ?? word?.pos ?? word?.part_of_speech ?? '',
      }))
      
      if (normalizedWords.length === 0) {
        alert('This list has no words to export.')
        setGeneratingPDF(null)
        return
      }
      
      await downloadListAsPDF(listTitle, normalizedWords, 'full')
    } catch (err) {
      console.error('Error generating PDF:', err)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setGeneratingPDF(null)
    }
  }

  const handleDeleteClass = async (klassId) => {
    if (!klassId) return
    const confirmed = window.confirm('Delete this class entirely? This cannot be undone.')
    if (!confirmed) return

    setClassError('')
    setDeletingClassId(klassId)
    try {
      await deleteClass(klassId)
      setClasses((prev) => prev.filter((klass) => klass.id !== klassId))
    } catch (err) {
      setClassError(err.message ?? 'Unable to delete class.')
    } finally {
      setDeletingClassId(null)
    }
  }

  const handleDeleteList = async (listId) => {
    if (!listId) return
    const confirmed = window.confirm('Delete this list and ALL words inside it? This destroys the content.')
    if (!confirmed) return

    setListsError('')
    setDeletingListId(listId)
    try {
      await deleteList(listId)
      setTeacherLists((prev) => prev.filter((list) => list.id !== listId))
    } catch (err) {
      setListsError(err.message ?? 'Unable to delete list.')
    } finally {
      setDeletingListId(null)
    }
  }

  const loadStudentClasses = useCallback(async () => {
    if (isTeacher || !user?.uid) {
      return
    }
    setStudentClassesLoading(true)
    try {
      const classesData = await fetchStudentClasses(user.uid)
      setStudentClasses(classesData)
    } finally {
      setStudentClassesLoading(false)
    }
  }, [isTeacher, user?.uid])

  useEffect(() => {
    loadStudentClasses()
  }, [loadStudentClasses])

  // Load progress data for each class/list (parallelized for speed)
  useEffect(() => {
    if (!user?.uid || !studentClasses.length || isTeacher) return

    const loadProgressData = async () => {
      // Build array of all class/list pairs to fetch
      const fetchTasks = []
      for (const cls of studentClasses) {
        const assignments = cls.assignments || {}
        for (const listId of Object.keys(assignments)) {
          fetchTasks.push({
            key: `${cls.id}_${listId}`,
            classId: cls.id,
            listId,
          })
        }
      }

      // Fetch all progress data in parallel
      const results = await Promise.all(
        fetchTasks.map(async ({ key, classId, listId }) => {
          try {
            const progress = await getClassProgress(user.uid, classId, listId)
            return { key, progress: progress ?? null }
          } catch (err) {
            console.error(`Failed to load progress for ${key}:`, err)
            return { key, progress: null }
          }
        })
      )

      // Build map from results
      const progressMap = {}
      for (const { key, progress } of results) {
        progressMap[key] = progress
      }

      setProgressData(progressMap)
    }

    loadProgressData()
  }, [user?.uid, studentClasses, isTeacher])

  useEffect(() => {
    const loadUserStats = async () => {
      if (isTeacher || !user?.uid) return
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        const data = userSnap.exists() ? userSnap.data() : {}
        setUserStats(data.stats ?? {})
        setUserSettings(data.settings ?? {})
      } catch {
        setUserStats({})
        setUserSettings({})
      }
    }
    loadUserStats()
  }, [isTeacher, user?.uid])

  // ESC key handler for Today's PDF Modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showTodayPdfModal) {
        setShowTodayPdfModal(false)
        setPdfModalContext(null)
      }
    }
    if (showTodayPdfModal) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showTodayPdfModal])

  const handleJoinClass = async (event) => {
    event.preventDefault()
    if (!joinCode.trim() || !user?.uid) {
      return
    }
    setJoinError('')
    setJoinSuccess('')
    setJoining(true)
    try {
      await joinClass(user.uid, joinCode.trim())
      setJoinSuccess('Class joined successfully.')
      setJoinCode('')
      await loadStudentClasses()
    } catch (err) {
      setJoinError(err.message ?? 'Unable to join class.')
    } finally {
      setJoining(false)
    }
  }

  // Handle Start Session click - check if review test already completed
  const handleStartSession = async (classId, listId) => {
    if (!user?.uid) return

    try {
      const sessionState = await getSessionState(user.uid, classId, listId)

      if (shouldShowReEntryModal(sessionState)) {
        // User already completed review test - show re-entry modal
        setReEntryContext({
          classId,
          listId,
          score: sessionState.reviewTestScore
        })
        setShowReEntryModal(true)
      } else {
        // No completed session - go directly to session
        navigate(`/session/${classId}/${listId}`)
      }
    } catch (err) {
      console.error('Failed to check session state:', err)
      // On error, just go to session
      navigate(`/session/${classId}/${listId}`)
    }
  }

  // Handle moving to next day from re-entry modal
  const handleMoveToNextDay = async () => {
    if (!user?.uid || !reEntryContext) return

    try {
      // Clear the session state so next session starts fresh
      await clearSessionState(user.uid, reEntryContext.classId, reEntryContext.listId)
      setShowReEntryModal(false)
      setReEntryContext(null)
      // Navigate to session (which will now start the next day)
      navigate(`/session/${reEntryContext.classId}/${reEntryContext.listId}`)
    } catch (err) {
      console.error('Failed to clear session state:', err)
    }
  }

  if (isTeacher) {
    return (
      <main className="min-h-screen bg-base px-4 py-10">
        <div className="mx-auto max-w-7xl">
          {/* Global Header Bar */}
          <HeaderBar />

          {error && (
            <div className="mb-6 rounded-xl border-2 border-red-300 bg-red-50 p-4">
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            </div>
          )}

          {/* Page Header */}
          <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-heading font-bold text-brand-text">Welcome, {displayName}</h1>
              <p className="font-body mt-1 text-base text-text-muted">
                Manage classes, lists, and upcoming assessments.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* My Classes Section */}
            <div className="col-span-12">
              <div className="bg-surface border border-border-default rounded-3xl p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <h2 className="text-xl font-heading font-bold text-text-primary">My Classes</h2>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => setIsCreateModalOpen(true)}
                  >
                    <Plus size={20} />
                    Create New Class
                  </Button>
                </div>

                {classError && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {classError}
                  </div>
                )}

                {classesLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner size="md" />
                  </div>
                ) : classes.length ? (
                  <ul className="grid gap-4 md:grid-cols-2">
                    {classes.map((klass) => (
                      <li key={klass.id}>
                        <CardButton 
                          to={`/classes/${klass.id}`}
                          className="flex flex-col justify-between rounded-2xl border border-border-default bg-surface p-5"
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1">
                              <h3 className="font-heading text-lg font-bold text-text-primary">
                                {klass.name}
                              </h3>
                              <div className="mt-2 space-y-1">
                                <p className="font-body text-sm text-text-muted">
                                  Join Code:{' '}
                                  <span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-bold text-text-secondary">
                                    {klass.joinCode}
                                  </span>
                                </p>
                                <p className="font-body text-sm text-text-muted">
                                  Students enrolled: <span className="font-semibold text-text-primary">{klass.studentCount ?? klass.students?.length ?? 0}</span>
                                </p>
                              </div>
                            </div>
                            <IconButton
                              variant="danger"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleDeleteClass(klass.id)
                              }}
                              disabled={deletingClassId === klass.id}
                              title="Delete class"
                            >
                              {deletingClassId === klass.id ? (
                                <RefreshCw size={16} className="animate-spin" />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </IconButton>
                          </div>
                        </CardButton>
                      </li>
                    ))}
                </ul>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border-strong bg-base p-8 text-center">
                      <p className="font-body text-sm text-text-muted">
                        You have not created any classes yet. Use the button above to get started.
                      </p>
                    </div>
                  )}
              </div>
            </div>

            {/* My Vocabulary Lists Section */}
            <div className="col-span-12">
              <div className="bg-surface border border-border-default rounded-3xl p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <h2 className="text-xl font-heading font-bold text-text-primary">My Vocabulary Lists</h2>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="lg" to="/lists">
                      <BookOpen size={18} />
                      View All Lists
                    </Button>
                    <Button variant="primary" size="lg" to="/lists/new">
                      <Plus size={20} />
                      Create New List
                    </Button>
                  </div>
                </div>

                {listsError && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {listsError}
                  </div>
                )}

                {listsLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner size="md" />
                  </div>
                ) : teacherLists.length ? (
                  <ul className="grid gap-4 md:grid-cols-2">
                    {teacherLists.map((list) => (
                      <li key={list.id}>
                        <CardButton 
                          to={`/lists/${list.id}`}
                          className="group relative flex flex-col gap-3 rounded-2xl border border-border-default bg-surface p-5 transition-all hover:shadow-md hover:border-brand-primary/30"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-heading text-lg font-bold text-text-primary group-hover:text-brand-primary transition-colors truncate">
                                {list.title}
                              </h3>
                              <p className="mt-1 font-body text-sm text-text-muted line-clamp-2">{list.description || list.title}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-sm text-text-muted">{list.wordCount ?? 0} words</span>
                              <IconButton 
                                variant="danger" 
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleDeleteList(list.id)
                                }}
                                disabled={deletingListId === list.id}
                                title="Delete list"
                              >
                                {deletingListId === list.id ? (
                                  <RefreshCw size={16} className="animate-spin" />
                                ) : (
                                  <Trash2 size={16} />
                                )}
                              </IconButton>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleDownloadPDF(list.id, list.title, null, false)
                              }}
                              disabled={generatingPDF?.listId === list.id}
                              title="Download PDF"
                            >
                              {generatingPDF?.listId === list.id ? (
                                <>
                                  <RefreshCw size={16} className="animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <FileText size={14} />
                                  PDF
                                </>
                              )}
                            </Button>
                          </div>
                        </CardButton>
                      </li>
                    ))}
                </ul>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border-strong bg-base p-8 text-center">
                      <p className="font-body text-sm text-text-muted">
                        You have not created any lists yet. Click &quot;Create New List&quot; to start.
                      </p>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>

        <CreateClassModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          ownerId={user?.uid}
          onCreated={loadTeacherClasses}
          canManage={isTeacher}
        />
      </main>
    )
  }

  // Helper: Get Primary Focus List (user preference or most recently assigned)
  const getPrimaryFocus = useMemo(() => {
    if (!studentClasses.length) {
      return null
    }

    const buildFocus = (klass, list) => {
      const assignment = klass.assignments?.[list.id] || {}
      return {
        id: list.id,
        title: list.title || 'Vocabulary List',
        classId: klass.id,
        className: klass.name,
        pace: assignment.pace || list.pace || 7, // Default to 7 (≈50 words/week)
        studyDaysPerWeek: assignment.studyDaysPerWeek || 5, // Default to 5 (M-F)
        wordCount: list.wordCount || 0,
        stats: list.stats || {},
      }
    }

    // 1. Check user preference first. Resolve by saved CLASS + LIST: a student can be in
    //    two classes that assign the same list, so the list id alone is ambiguous.
    if (userSettings?.primaryFocusListId) {
      // 1a. Exact saved class + list.
      if (userSettings.primaryFocusClassId) {
        const savedClass = studentClasses.find((k) => k.id === userSettings.primaryFocusClassId)
        const savedList = savedClass?.assignedListDetails?.find(
          (l) => l.id === userSettings.primaryFocusListId
        )
        if (savedClass && savedList) {
          return buildFocus(savedClass, savedList)
        }
        // saved class gone / no longer has the list -> fall through to legacy list-only
      }
      // 1b. Legacy fallback: match by list id in any class (first match). Covers older
      //     saved prefs with no classId, and a student removed from the saved class whose
      //     list is still assigned elsewhere. (Must reach here, NOT skip to auto-select.)
      for (const klass of studentClasses) {
        const list = klass.assignedListDetails?.find((l) => l.id === userSettings.primaryFocusListId)
        if (list) {
          return buildFocus(klass, list)
        }
      }
      // Preference no longer valid - fall through to auto-select
    }

    // 2. Fallback: most recently assigned list; first list seen if none carry a date.
    let primaryList = null
    let latestAssignedAt = null

    studentClasses.forEach((klass) => {
      if (!klass.assignedListDetails?.length) return
      const assignments = klass.assignments || {}

      klass.assignedListDetails.forEach((list) => {
        const assignment = assignments[list.id] || {}
        const assignedAt = assignment.assignedAt?.toDate?.() || assignment.assignedAt || list.assignedAt?.toDate?.() || list.assignedAt || null

        if (assignedAt && (!latestAssignedAt || assignedAt > latestAssignedAt)) {
          // A dated assignment: newest wins.
          latestAssignedAt = assignedAt
          primaryList = buildFocus(klass, list)
        } else if (!primaryList) {
          // No dated winner yet: keep the FIRST list seen as the null-date fallback.
          primaryList = buildFocus(klass, list)
        }
      })
    })

    return primaryList
  }, [studentClasses, userSettings])

  // Panel B: Vitals - calculated from progressData (new study system)
  const panelBState = useMemo(() => {
    try {
      if (!getPrimaryFocus) {
        return {
          totalWordsIntroduced: 0,
          masteryRate: 0,
          streakDays: 0,
          error: false
        }
      }

      const key = `${getPrimaryFocus.classId}_${getPrimaryFocus.id}`
      const progress = progressData[key]

      if (!progress) {
        return {
          totalWordsIntroduced: 0,
          masteryRate: 0,
          streakDays: 0,
          error: false
        }
      }

      const { totalWordsIntroduced: wordsIntro, stats, recentSessions } = progress
      const avgReviewScore = stats?.avgReviewScore ?? null

      // Mastery Rate: avgReviewScore as percentage (0-100)
      const masteryRate = avgReviewScore !== null
        ? Math.round(avgReviewScore * 100)
        : 0

      // Current Streak: read from persisted class_progress (calculated on session completion)
      // Falls back to client-side calculation if not yet persisted
      const streakDays = progress.streakDays ?? calculateStreak(recentSessions, getPrimaryFocus.studyDaysPerWeek || 5)

      return {
        totalWordsIntroduced: wordsIntro || 0,
        masteryRate,
        streakDays,
        error: false
      }
    } catch (err) {
      console.error('Panel B calculation error:', err)
      return {
        totalWordsIntroduced: 0,
        masteryRate: 0,
        streakDays: 0,
        error: true
      }
    }
  }, [getPrimaryFocus, progressData])

  // Destructure for easier access
  const { totalWordsIntroduced, masteryRate, streakDays, error: panelBError } = panelBState

  // Helper: Get start of current calendar week (Monday 00:00:00)
  const getStartOfWeek = () => {
    const now = new Date()
    const day = now.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const diff = day === 0 ? 6 : day - 1 // Days since Monday
    const monday = new Date(now)
    monday.setDate(now.getDate() - diff)
    monday.setHours(0, 0, 0, 0)
    return monday
  }

  // Helper: Calculate words introduced this week from recentSessions
  const getWeeklyWordsIntroduced = (recentSessions) => {
    if (!recentSessions || recentSessions.length === 0) return 0

    const weekStart = getStartOfWeek()

    return recentSessions
      .filter(session => {
        if (!session.date) return false
        // Handle Firestore Timestamp or Date object
        const sessionDate = session.date?.toDate?.() || session.date
        return sessionDate >= weekStart
      })
      .reduce((sum, session) => sum + (session.wordsIntroduced || 0), 0)
  }

  // Panel A: Weekly progress state with error handling
  const panelAState = useMemo(() => {
    try {
      const weeklyGoal = getPrimaryFocus
        ? (getPrimaryFocus.pace * (getPrimaryFocus.studyDaysPerWeek || 5))
        : 50

      if (!getPrimaryFocus) {
        return {
          weeklyGoal,
          progress: 0,
          percent: 0,
          error: false
        }
      }

      const key = `${getPrimaryFocus.classId}_${getPrimaryFocus.id}`
      const progress = progressData[key]

      const weeklyProgress = progress?.recentSessions
        ? getWeeklyWordsIntroduced(progress.recentSessions)
        : 0

      const percent = weeklyGoal > 0
        ? Math.min(100, Math.round((weeklyProgress / weeklyGoal) * 100))
        : 0

      return {
        weeklyGoal,
        progress: weeklyProgress,
        percent,
        error: false
      }
    } catch (err) {
      console.error('Panel A calculation error:', err)
      return {
        weeklyGoal: 50,
        progress: 0,
        percent: 0,
        error: true
      }
    }
  }, [getPrimaryFocus, progressData])

  // Destructure for easier access
  const {
    weeklyGoal: primaryFocusWeeklyGoal,
    progress: primaryFocusProgress,
    percent: primaryFocusPercent,
    error: panelAError
  } = panelAState

  // 7-Day Activity Data - Shows reviewScore per study day (last 7 study days)
  const dailyActivity = useMemo(() => {
    const activity = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get settings from primary focus
    const studyDaysPerWeek = getPrimaryFocus?.studyDaysPerWeek || 5
    const skipWeekends = studyDaysPerWeek <= 5

    // Day and month names for formatting
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    // Helper to check if a date is a weekend
    const isWeekend = (date) => {
      const day = date.getDay()
      return day === 0 || day === 6 // Sunday = 0, Saturday = 6
    }

    // Get recentSessions from progressData
    const key = getPrimaryFocus ? `${getPrimaryFocus.classId}_${getPrimaryFocus.id}` : null
    const progress = key ? progressData[key] : null
    const recentSessions = progress?.recentSessions || []

    // Create a map of session dates to reviewScore (average if multiple sessions)
    const sessionsByDate = {}
    recentSessions.forEach(session => {
      if (!session.date) return
      // Only include sessions that have a review score
      if (session.reviewScore === null || session.reviewScore === undefined) return
      const sessionDate = session.date?.toDate?.() || session.date
      const normalized = new Date(sessionDate)
      normalized.setHours(0, 0, 0, 0)
      const dateKey = normalized.getTime()
      // Track scores and count for averaging
      if (!sessionsByDate[dateKey]) {
        sessionsByDate[dateKey] = { total: 0, count: 0 }
      }
      sessionsByDate[dateKey].total += session.reviewScore
      sessionsByDate[dateKey].count += 1
    })

    // Walk backwards through study days (starting from today)
    let currentDate = new Date(today)

    // Collect 7 study days
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentDate)
      const dateKey = date.getTime()
      const sessionData = sessionsByDate[dateKey]
      // Average review score for the day (as percentage 0-100), null if no review
      const reviewScore = sessionData
        ? Math.round((sessionData.total / sessionData.count) * 100)
        : null

      // Format date string (e.g., "Mon, Oct 24")
      const dayName = dayNames[date.getDay()]
      const monthName = monthNames[date.getMonth()]
      const dayNumber = date.getDate()
      const formattedDate = `${dayName}, ${monthName} ${dayNumber}`

      activity.push({
        date,
        formattedDate,
        reviewScore, // percentage 0-100 or null
      })

      // Move to previous study day
      currentDate.setDate(currentDate.getDate() - 1)
      if (skipWeekends) {
        while (isWeekend(currentDate)) {
          currentDate.setDate(currentDate.getDate() - 1)
        }
      }
    }

    return activity
  }, [getPrimaryFocus, progressData])

  // Panel C: Retention status and daily task status
  const panelCState = useMemo(() => {
    try {
      if (!getPrimaryFocus) {
        return {
          currentStudyDay: 0,
          phase: 'new-words-study',
          error: false
        }
      }

      const key = `${getPrimaryFocus.classId}_${getPrimaryFocus.id}`
      const progress = progressData[key]

      const currentStudyDay = progress?.currentStudyDay ?? 0

      // Phase-aware "what to do today" for the hero CTA — derived from attempts
      // (authoritative), scoped to the active list. One of:
      // 'new-words-study' | 'review-study' | 'complete'
      const listAttempts = (userAttempts || []).filter(
        (a) => a.classId === getPrimaryFocus.classId && a.listId === getPrimaryFocus.id
      )
      const phase = determineStartingPhase(listAttempts, currentStudyDay + 1).phase

      return {
        currentStudyDay,
        phase,
        error: false
      }
    } catch (err) {
      console.error('Panel C calculation error:', err)
      return {
        currentStudyDay: 0,
        phase: 'new-words-study',
        error: true
      }
    }
  }, [getPrimaryFocus, progressData, userAttempts])


  // Modal state
  const [studyModalOpen, setStudyModalOpen] = useState(false)
  const [testModalOpen, setTestModalOpen] = useState(false)

  return (
    <main className="min-h-screen bg-base px-4 py-10">
      <div className="mx-auto max-w-7xl">
        {/* Global Header Bar */}
        <HeaderBar />

        {error && (
          <div className="mb-6 rounded-xl border-2 border-border-error bg-error-subtle p-4">
            <p className="text-sm text-text-error" role="alert">
              {error}
            </p>
          </div>
        )}

        {/* Welcome Header */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold text-brand-text">Welcome, {displayName}</h1>
            <p className="font-body mt-1 text-base text-text-muted">
              Your personalized vocabulary journey starts here.
            </p>
          </div>

          {/* List Selector - Right Side */}
          {availableLists.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowListSelector(!showListSelector)}
                className="flex items-center gap-2 px-4 py-2 bg-surface border border-border-default rounded-lg shadow-sm hover:bg-muted transition-colors"
              >
                <span className="text-sm text-text-muted">Studying:</span>
                <span className="font-medium text-text-primary">{getPrimaryFocus?.title || 'No List'}</span>
                <ChevronDown className="w-4 h-4 text-text-faint" />
              </button>

              {showListSelector && (
                <div className="absolute right-0 mt-2 w-64 bg-surface rounded-lg shadow-lg border border-border-default p-2 z-50">
                  {availableLists.map((list) => (
                    <button
                      key={`${list.classId}_${list.id}`}
                      onClick={() => handleListSelection(list)}
                      className={`w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors ${
                        list.classId === getPrimaryFocus?.classId && list.id === getPrimaryFocus?.id ? 'bg-brand-primary/10' : ''
                      }`}
                    >
                      <div className="font-medium text-text-primary">{list.title}</div>
                      <div className="text-xs text-text-muted">{list.className}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* === Redesigned dashboard: consolidated hero + honest tiles + weekly activity === */}
        {(() => {
          const listTotal = getPrimaryFocus?.wordCount || 0
          const listPct = listTotal > 0 ? Math.min(100, Math.round((totalWordsIntroduced / listTotal) * 100)) : 0
          const wordsLeft = Math.max(0, listTotal - totalWordsIntroduced)
          const day = (panelCState?.currentStudyDay ?? 0) + 1
          const newCount = getPrimaryFocus?.pace || null
          const phase = panelCState?.phase
          const reviewStage = phase === 'review-study'   // passed today's new words, review left
          const doneToday = phase === 'complete'          // new + review both done today
          return (
            <>
              {/* Hero: list progress + today's session, in one card (replaces the duplicated Focus/Launchpad/Vitals panels) */}
              {getPrimaryFocus ? (
                <div className="rounded-2xl shadow-lg overflow-hidden mb-5 grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-8 items-center p-7 lg:p-8 bg-gradient-to-br from-brand-primary via-brand-primary to-brand-primary text-white">
                  <div
                    className="mx-auto lg:mx-0 w-[150px] h-[150px] rounded-full grid place-items-center"
                    style={{ background: `conic-gradient(#ffffff ${listPct}%, rgba(255,255,255,0.18) 0)` }}
                  >
                    <div className="w-[118px] h-[118px] rounded-full bg-brand-primary/90 grid place-items-center text-center">
                      <div>
                        <div className="font-heading text-4xl font-bold leading-none">{listPct}%</div>
                        <div className="text-[11px] text-white/70 mt-1 font-semibold">
                          {totalWordsIntroduced.toLocaleString()} / {listTotal.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-center lg:text-left">
                    <p className="font-body text-[11px] font-bold tracking-[0.08em] uppercase text-white/70">
                      {getPrimaryFocus.className || 'Your class'}
                    </p>
                    <h2 className="font-heading text-2xl font-bold mt-1 leading-tight">{getPrimaryFocus.title}</h2>
                    <div className="flex flex-wrap gap-2 justify-center lg:justify-start mt-3">
                      <span className="bg-white/15 border border-white/20 rounded-full px-3 py-1.5 text-xs font-semibold">🔥 {streakDays}-day streak</span>
                      <span className="bg-white/15 border border-white/20 rounded-full px-3 py-1.5 text-xs font-semibold">{wordsLeft.toLocaleString()} words left</span>
                    </div>
                  </div>
                  <div className="w-full lg:w-[320px] text-center lg:text-left">
                    {/* step badge */}
                    <span className={`inline-block font-body text-[11px] font-extrabold tracking-[0.06em] rounded-full px-2.5 py-1 mb-2.5 ${doneToday ? 'bg-white/20 text-white/80' : 'bg-white/90 text-brand-primary'}`}>
                      DAY {day} · {doneToday ? 'COMPLETE' : reviewStage ? 'STEP 2 OF 2' : 'STEP 1 OF 2'}
                    </span>
                    {/* directive */}
                    <h3 className="font-heading text-xl font-extrabold leading-snug mb-1">
                      {doneToday ? `Day ${day} done 🎉` : reviewStage ? 'One step left — review' : newCount ? `Learn ${newCount} new words` : "Start today's new words"}
                    </h3>
                    {/* help line */}
                    <p className="font-body text-[13px] text-white/80 font-medium mb-3.5">
                      {doneToday
                        ? "You're all caught up. Come back tomorrow."
                        : reviewStage
                          ? `Pass today's review test to complete Day ${day}.`
                          : 'Study them, then pass the test to unlock review.'}
                    </p>
                    {/* 2-step day tracker */}
                    <div className="flex items-center gap-2 justify-center lg:justify-start mb-4">
                      <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-[10px] ${(reviewStage || doneToday) ? 'text-white' : 'bg-white text-brand-primary shadow'}`}>
                        <span className={`w-4 h-4 rounded-full grid place-items-center text-[10px] ${(reviewStage || doneToday) ? 'bg-btn-success text-white' : 'bg-brand-primary text-white'}`}>{(reviewStage || doneToday) ? '✓' : '1'}</span>
                        New words
                      </span>
                      <span className="text-white/50 font-extrabold">›</span>
                      <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-[10px] ${doneToday ? 'text-white' : reviewStage ? 'bg-white text-brand-primary shadow' : 'bg-white/10 text-white/80'}`}>
                        <span className={`w-4 h-4 rounded-full grid place-items-center text-[10px] ${doneToday ? 'bg-btn-success text-white' : reviewStage ? 'bg-brand-primary text-white' : 'bg-white/25'}`}>{doneToday ? '✓' : '2'}</span>
                        Review
                      </span>
                    </div>
                    {/* action CTA — label reflects the next step */}
                    <button
                      type="button"
                      onClick={() => navigate(`/session/${getPrimaryFocus.classId}/${getPrimaryFocus.id}`)}
                      className={`w-full font-extrabold rounded-button py-3.5 transition-colors ${doneToday ? 'bg-white/12 hover:bg-white/20 text-white' : 'bg-brand-accent hover:bg-brand-accent-hover text-white shadow-lg shadow-brand-accent/30'}`}
                    >
                      {doneToday ? 'Practice again' : reviewStage ? 'Start review →' : 'Start new words →'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-surface border border-border-default p-8 text-center text-text-muted mb-5">
                  No active list yet — join a class below to begin.
                </div>
              )}

              {/* Honest stat tiles (real data; renamed the misleading "Mastery Rate") */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                <div className="bg-surface border border-border-default rounded-xl p-4 shadow-sm">
                  <p className="font-body text-xs font-semibold text-text-muted uppercase tracking-wide">Words Introduced</p>
                  <p className="font-heading text-2xl font-bold text-brand-text mt-1.5">{totalWordsIntroduced.toLocaleString()}</p>
                  <p className="font-body text-xs text-text-secondary mt-1">{listPct}% of list</p>
                </div>
                <div className="bg-surface border border-border-default rounded-xl p-4 shadow-sm">
                  <p className="font-body text-xs font-semibold text-text-muted uppercase tracking-wide">Avg Review Score</p>
                  <p className="font-heading text-2xl font-bold text-brand-primary mt-1.5">{masteryRate}%</p>
                  <p className="font-body text-xs text-text-secondary mt-1">recent reviews</p>
                </div>
                <div className="bg-surface border border-border-default rounded-xl p-4 shadow-sm">
                  <p className="font-body text-xs font-semibold text-text-muted uppercase tracking-wide">Words Left</p>
                  <p className="font-heading text-2xl font-bold text-text-primary mt-1.5">{wordsLeft.toLocaleString()}</p>
                  <p className="font-body text-xs text-text-secondary mt-1">to finish the list</p>
                </div>
                <div className="bg-surface border border-border-default rounded-xl p-4 shadow-sm">
                  <p className="font-body text-xs font-semibold text-text-muted uppercase tracking-wide">Streak</p>
                  <p className="font-heading text-2xl font-bold text-brand-accent mt-1.5">{streakDays} <span className="text-base text-text-muted font-semibold">days</span></p>
                  <p className="font-body text-xs text-text-secondary mt-1">keep it going</p>
                </div>
              </div>

              {/* Weekly activity (replaces the empty "7-Day Rhythm" placeholder) */}
              <div className="bg-surface border border-border-default rounded-2xl p-5 shadow-sm mb-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading text-sm font-bold text-text-primary">This week</h3>
                  <span className="font-body text-xs text-text-muted">avg review score per day</span>
                </div>
                <div className="flex items-end justify-between gap-2 h-20">
                  {dailyActivity.map((d, i) => {
                    const has = d.reviewScore !== null
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div
                          className={`w-full max-w-[42px] rounded-t-[6px] rounded-b-[3px] transition-all ${has ? 'bg-brand-primary/90' : 'bg-inset'}`}
                          style={{ height: has ? `${Math.max(8, Math.round(d.reviewScore * 0.6))}px` : '6px' }}
                        />
                        <span className="text-[11px] font-semibold text-text-muted">{(d.formattedDate || '').slice(0, 6)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )
        })()}

        {/* Recent Classes (Col-span-12) */}
        <div className="col-span-12">
          <div className="bg-surface border border-border-default rounded-card-lg p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-heading text-xl font-bold text-text-primary">My Classes</h2>
                {studentClasses.length > 0 && (
                  <p className="font-body text-sm text-text-muted">
                    {studentClasses.length} enrolled
                  </p>
                )}
              </div>

              {studentClassesLoading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner size="md" />
                </div>
              ) : studentClasses.length === 0 ? (
                <div className="bg-surface border border-border-default rounded-card-lg p-12 text-center shadow-sm">
                  <h3 className="font-heading text-xl font-bold text-text-primary">Welcome! Join your first class</h3>
                  <p className="font-body mt-2 text-sm text-text-muted">
                    Enter the 6-character code your teacher shared to get started.
                  </p>
                  <form onSubmit={handleJoinClass} className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-center">
                    <label className="flex-1 max-w-md text-sm font-medium text-text-secondary">
                      Class Code
                      <input
                        type="text"
                        value={joinCode}
                        onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                        placeholder="ABC123"
                        maxLength={6}
                        className="mt-1 w-full rounded-button border border-border-strong bg-surface px-3 py-2 text-center text-2xl font-bold tracking-[0.4em] text-text-primary outline-none ring-border-strong focus:ring-2 focus:ring-brand-primary"
                        required
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={joining}
                      className="h-12 flex items-center justify-center rounded-button bg-brand-primary px-6 text-sm font-semibold text-white transition hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/20 disabled:opacity-60"
                    >
                      <span className="truncate whitespace-nowrap max-w-full">{joining ? 'Joining…' : 'Join Class'}</span>
                    </button>
                  </form>
                  {joinError && (
                    <p className="mt-4 text-sm text-red-600" role="alert">
                      {joinError}
                    </p>
                  )}
                  {joinSuccess && (
                    <p className="mt-4 text-sm text-emerald-600" role="status">
                      {joinSuccess}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {/* Join Class Form */}
                  <div className="mb-6 bg-surface border border-border-default rounded-card-lg p-4 shadow-sm">
                    <form onSubmit={handleJoinClass} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <label className="flex-1 text-sm font-medium text-text-secondary">
                        <span className="font-body">Join a new class</span>
                        <input
                          type="text"
                          value={joinCode}
                          onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                          placeholder="ABC123"
                          maxLength={6}
                          className="mt-1 w-full rounded-button border border-border-strong bg-surface px-3 py-2 text-center text-xl font-bold tracking-[0.4em] text-text-primary outline-none ring-border-strong focus:ring-2 focus:ring-brand-primary"
                          required
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={joining}
                        className="h-12 flex items-center justify-center rounded-button bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/20 disabled:opacity-60"
                      >
                        <span className="truncate whitespace-nowrap max-w-full">{joining ? 'Joining…' : 'Join'}</span>
                      </button>
                    </form>
                    {joinError && (
                      <p className="mt-3 text-sm text-red-600" role="alert">
                        {joinError}
                      </p>
                    )}
                    {joinSuccess && (
                      <p className="mt-3 text-sm text-emerald-600" role="status">
                        {joinSuccess}
                      </p>
                    )}
                  </div>

                  {/* Classes List */}
                  <ul className="space-y-4">
                    {studentClasses.map((klass) => (
                      <li
                        key={klass.id}
                        className="bg-surface border border-border-default rounded-card-lg p-5 shadow-sm transition hover:shadow-md"
                      >
                        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                          <div>
                            <h3 className="font-heading text-lg font-bold text-text-primary">{klass.name}</h3>
                            <p className="font-body text-sm text-text-muted">
                              Joined:{' '}
                              <span className="font-semibold text-text-primary">
                                {klass.joinedAt?.toDate
                                  ? klass.joinedAt.toDate().toLocaleDateString()
                                  : 'Today'}
                              </span>
                            </p>
                          </div>
                          <p className="font-body text-sm font-medium text-brand-text">
                            {klass.assignedLists?.length ?? 0} assigned lists
                          </p>
                        </div>
                        {klass.assignedListDetails?.length ? (
                          <div className="mt-4 space-y-3">
                            {klass.assignedListDetails.map((list) => (
                              <div
                                key={list.id}
                                className="rounded-card border border-border-strong bg-surface px-4 py-4"
                              >
                                {/* 4-Column Layout */}
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
                                  {/* Column 1: List Info + Progress Bar (min 50%) */}
                                  <div className="flex-1 lg:min-w-[50%]">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="font-heading text-sm font-semibold text-text-primary">
                                        {list.title || 'Vocabulary List'}
                                      </p>
                                    </div>
                                    <p className="font-body text-xs text-text-muted mb-3">
                                      {list.wordCount ?? 0} words
                                    </p>
                                    {(() => {
                                      const progressKey = `${klass.id}_${list.id}`
                                      const progress = progressData[progressKey]
                                      const wordsIntroduced = progress?.totalWordsIntroduced ?? 0
                                      const totalWords = list.wordCount ?? 0
                                      const percentage = totalWords > 0
                                        ? Math.min(100, Math.max(0, Math.round((wordsIntroduced / totalWords) * 100)))
                                        : 0
                                      const barWidth = `${percentage}%`
                                      const isWideBar = percentage > 15

                                      return (
                                        <div className="space-y-1.5 text-xs text-text-secondary">
                                          <div className="flex items-center justify-between">
                                            <span>{wordsIntroduced} introduced</span>
                                            <span>{totalWords} total</span>
                                          </div>
                                          <div className="relative h-10 w-full rounded-lg bg-inset flex items-center overflow-hidden">
                                            <div
                                              className="h-full rounded-lg bg-brand-primary transition-all duration-1000 ease-out flex items-center"
                                              style={{ width: barWidth }}
                                            >
                                              {isWideBar && (
                                                <span className="text-xs font-bold text-white pr-3 ml-auto">
                                                  {percentage}%
                                                </span>
                                              )}
                                            </div>
                                            {!isWideBar && (
                                              <span className="text-xs font-bold text-text-secondary ml-2">
                                                {percentage}%
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })()}
                                  </div>

                                  {/* Column 2: Day Card */}
                                  <div className="shrink-0">
                                    <ListProgressStats
                                      classId={klass.id}
                                      listId={list.id}
                                      progressData={progressData}
                                      assignment={klass.assignments?.[list.id]}
                                    />
                                  </div>

                                  {/* Column 3: Stacked Action Buttons */}
                                  <div className="flex flex-col gap-2 shrink-0 lg:min-w-[160px] lg:self-stretch">
                                    <button
                                      type="button"
                                      onClick={() => handleStartSession(klass.id, list.id)}
                                      disabled={!(`${klass.id}_${list.id}` in progressData)}
                                      className="flex-1 flex items-center justify-center gap-2 rounded-button bg-brand-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-accent-hover shadow-brand-accent/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                      </svg>
                                      <span className="truncate whitespace-nowrap">Start Session</span>
                                    </button>
                                    <Link
                                      to={`/blindspots/${klass.id}/${list.id}`}
                                      className="flex-1 flex items-center justify-center gap-2 rounded-button bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-primary/90"
                                    >
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                      </svg>
                                      <span className="truncate whitespace-nowrap">Blind Spots</span>
                                    </Link>
                                  </div>

                                  {/* Column 4: PDF Buttons */}
                                  <div className="shrink-0 lg:self-stretch flex flex-col gap-2">
                                      {/* Today's Batch PDF - opens modal */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const assignment = klass.assignments?.[list.id] || {
                                            pace: list.pace || 20,
                                            testMode: list.testMode || 'mcq',
                                            testSizeNew: 50,
                                            testSizeReview: 30,
                                            newWordRetakeThreshold: 0.95
                                          }
                                          setPdfModalContext({
                                            classId: klass.id,
                                            listId: list.id,
                                            listTitle: list.title || 'Vocabulary List',
                                            assignment
                                          })
                                          setShowTodayPdfModal(true)
                                        }}
                                        disabled={generatingPDF?.listId === list.id}
                                        className="flex-1 flex items-center justify-center gap-2 rounded-button border border-border-strong bg-surface px-3 py-2 text-xs font-semibold text-brand-text transition hover:bg-accent-blue hover:border-brand-primary disabled:opacity-60"
                                        title="Download Today's Batch as PDF"
                                      >
                                        {generatingPDF?.listId === list.id && (generatingPDF?.mode === 'today-fast' || generatingPDF?.mode === 'today-complete') ? (
                                          <svg className="h-5 w-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                          </svg>
                                        ) : (
                                          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                            <text x="6.5" y="17" fontSize="6" fontWeight="bold" fill="currentColor" stroke="none">PDF</text>
                                          </svg>
                                        )}
                                        <span>Today</span>
                                      </button>
                                      {/* Full List PDF */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const assignment = klass.assignments?.[list.id] || {
                                            pace: list.pace || 20,
                                            testMode: list.testMode || 'mcq',
                                            testSizeNew: 50,
                                            testSizeReview: 30,
                                            newWordRetakeThreshold: 0.95
                                          }
                                          handlePDFSelect('full', {
                                            classId: klass.id,
                                            listId: list.id,
                                            listTitle: list.title || 'Vocabulary List',
                                            assignment
                                          })
                                        }}
                                        disabled={generatingPDF?.listId === list.id}
                                        className="flex-1 flex items-center justify-center gap-2 rounded-button border border-border-strong bg-surface px-3 py-2 text-xs font-semibold text-brand-text transition hover:bg-accent-blue hover:border-brand-primary disabled:opacity-60"
                                        title="Download Full List as PDF"
                                      >
                                        {generatingPDF?.listId === list.id && generatingPDF?.mode === 'full' ? (
                                          <svg className="h-5 w-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                          </svg>
                                        ) : (
                                          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                            <text x="6.5" y="17" fontSize="6" fontWeight="bold" fill="currentColor" stroke="none">PDF</text>
                                          </svg>
                                        )}
                                        <span>Full</span>
                                      </button>
                                  </div>
                                </div>

                                {/* Debug Panel - Dev only */}
                                {showDebugPanel && (
                                  <SegmentDebugPanel
                                    classId={klass.id}
                                    listId={list.id}
                                    userId={user.uid}
                                    assignment={klass.assignments?.[list.id]}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 rounded-lg border border-dashed border-border-strong bg-base p-4 text-center">
                            <p className="font-body text-sm text-text-muted">
                              Waiting for teacher to assign content...
                            </p>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
      </div>

      {/* Study Selection Modals */}
      <StudySelectionModal
        isOpen={studyModalOpen}
        onClose={() => setStudyModalOpen(false)}
        classes={studentClasses}
        mode="study"
      />
      <StudySelectionModal
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        classes={studentClasses}
        mode="test"
      />
      

      {/* Today's PDF Modal */}
      {showTodayPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop - click to close */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => { setShowTodayPdfModal(false); setPdfModalContext(null); }}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl">
            <h3 className="text-lg font-bold text-text-primary">
              Today&apos;s Study Words
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              This will generate a PDF with the recommended words you should study today.
            </p>

            <Button
              onClick={() => {
                setShowTodayPdfModal(false)
                handlePDFSelect('today-fast', pdfModalContext)
              }}
              variant="primary-blue"
              size="lg"
              className="mt-6 w-full"
            >
              Generate PDF
            </Button>

            <p className="mt-4 text-center text-xs text-text-muted">
              For a list of ALL words you might be tested on today,{' '}
              <button
                type="button"
                onClick={() => {
                  setShowTodayPdfModal(false)
                  handlePDFSelect('today-complete', pdfModalContext)
                }}
                className="text-brand-primary underline hover:text-brand-primary/80"
              >
                click here
              </button>
              .
            </p>

            <Button
              onClick={() => { setShowTodayPdfModal(false); setPdfModalContext(null); }}
              variant="ghost"
              size="lg"
              className="mt-4 w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Re-Entry Modal (Already completed today's session) */}
      {showReEntryModal && reEntryContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <span className="text-2xl">✓</span>
              </div>
            </div>

            <h3 className="text-center text-lg font-bold text-text-primary">
              Session Completed
            </h3>
            <p className="mt-2 text-center text-sm text-text-secondary">
              You scored <span className="font-bold text-emerald-600">{Math.round((reEntryContext.score || 0) * 100)}%</span> on your review test.
            </p>
            <p className="mt-2 text-center text-sm text-text-muted">
              Would you like to study again or move on?
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <Button
                onClick={() => {
                  setShowReEntryModal(false)
                  setReEntryContext(null)
                  navigate(`/session/${reEntryContext.classId}/${reEntryContext.listId}`)
                }}
                variant="primary"
                size="lg"
                className="w-full"
              >
                Study Again
              </Button>
              <Button
                onClick={handleMoveToNextDay}
                variant="outline"
                size="lg"
                className="w-full"
              >
                Move to Next Day
              </Button>
            </div>

            <p className="mt-4 text-center text-xs text-text-faint">
              Moving to the next day will start fresh with new words.
            </p>
          </div>
        </div>
      )}
    </main>
  )
}

export default Dashboard


