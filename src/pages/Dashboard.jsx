import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { Activity, BookOpen, Plus, RefreshCw, Trash2, FileText, ExternalLink } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import HeaderBar from '../components/HeaderBar.jsx'
import {
  deleteClass,
  deleteList,
  fetchAllWords,
  fetchDashboardStats,
  fetchSmartStudyQueue,
  fetchStudentClasses,
  fetchTeacherClasses,
  fetchTeacherLists,
  fetchUserAttempts,
  joinClass,
} from '../services/db'
import { getClassProgress } from '../services/progressService'
import { getBlindSpotCount } from '../services/studyService'
import { WORD_STATUS } from '../types/studyTypes'
import { db } from '../firebase'
import CreateClassModal from '../components/CreateClassModal.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { downloadListAsPDF } from '../utils/pdfGenerator.js'
import PDFOptionsModal from '../components/PDFOptionsModal.jsx'
import { getTodaysBatchForPDF } from '../services/studyService'
import MasterySquares from '../components/MasterySquares.jsx'
import StudySelectionModal from '../components/modals/StudySelectionModal.jsx'
import { Button, IconButton, CardButton } from '../components/ui'

const DEFAULT_MASTERY_TOTALS = { totalWords: 0, masteredWords: 0 }

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

function ListProgressStats({ classId, listId, progressData }) {
  const key = `${classId}_${listId}`
  const progress = progressData[key]

  const currentStudyDay = progress?.currentStudyDay ?? 0

  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-muted px-4 py-3 min-w-[80px] h-full">
      <span className="text-xs text-text-muted uppercase tracking-wide font-medium">Day</span>
      <span className="font-heading text-4xl font-bold text-brand-primary">{currentStudyDay}</span>
    </div>
  )
}

const Dashboard = () => {
  const { user } = useAuth()
  const [error, setError] = useState('')
  const [classError, setClassError] = useState('')
  const [classes, setClasses] = useState([])
  const [classesLoading, setClassesLoading] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const displayName =
    user?.displayName || user?.email?.split('@')[0] || user?.email || 'Student'
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
  const [blindSpotCounts, setBlindSpotCounts] = useState({}) // keyed by `${classId}_${listId}`
  const [pdfModalOpen, setPdfModalOpen] = useState(false)
  const [pdfModalContext, setPdfModalContext] = useState(null) // { classId, listId, listTitle, assignment }

  const masteryTotals = useMemo(() => {
    if (!studentClasses.length) {
      return DEFAULT_MASTERY_TOTALS
    }

    let totalWords = 0
    let masteredWords = 0

    studentClasses.forEach((klass) => {
      ;(klass.assignedListDetails || []).forEach((list) => {
        totalWords += list?.stats?.totalWords ?? 0
        masteredWords += list?.stats?.masteredWords ?? 0
      })
    })

    return {
      totalWords,
      masteredWords,
    }
  }, [studentClasses])

  const masteredWordsCount = dashboardStats?.masteryCount ?? masteryTotals.masteredWords
  const weeklyGoalTarget = userSettings?.weeklyGoal ?? 100
  const weeklyProgress = dashboardStats?.weeklyProgress ?? 0
  const weeklyPercent =
    weeklyGoalTarget > 0 ? Math.min(100, Math.round((weeklyProgress / weeklyGoalTarget) * 100)) : 0
  
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
    setGeneratingPDF(listId)
    setPdfModalOpen(false)

    try {
      let words

      if (mode === 'today' && user?.uid) {
        // Smart selection for today's batch
        words = await getTodaysBatchForPDF(user.uid, classId, listId, assignment)
      } else {
        // Full list - need to add wordIndex
        const allWords = await fetchAllWords(listId)
        words = allWords.map((w, idx) => ({ ...w, wordIndex: w.wordIndex ?? idx }))
      }

      if (words.length === 0) {
        alert('This list has no words to export.')
        setGeneratingPDF(null)
        setPdfModalContext(null)
        return
      }

      const normalizedWords = words.map((word) => ({
        ...word,
        partOfSpeech: word?.partOfSpeech ?? word?.pos ?? word?.part_of_speech ?? '',
      }))

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
    setGeneratingPDF(listId)
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

  // Load progress and blind spot data for each class/list
  useEffect(() => {
    if (!user?.uid || !studentClasses.length || isTeacher) return

    const loadProgressData = async () => {
      const progressMap = {}
      const blindSpotMap = {}

      for (const cls of studentClasses) {
        const assignments = cls.assignments || {}
        for (const listId of Object.keys(assignments)) {
          const key = `${cls.id}_${listId}`
          try {
            const progress = await getClassProgress(user.uid, cls.id, listId)
            if (progress) {
              progressMap[key] = progress
            }
            const blindSpots = await getBlindSpotCount(user.uid, listId)
            blindSpotMap[key] = blindSpots
          } catch (err) {
            console.error(`Failed to load progress for ${key}:`, err)
            // Don't break the page, just show default state
          }
        }
      }

      setProgressData(progressMap)
      setBlindSpotCounts(blindSpotMap)
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
                              disabled={generatingPDF === list.id}
                              title="Download PDF"
                            >
                              {generatingPDF === list.id ? (
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

  // Helper: Get Primary Focus List (most recently assigned)
  const getPrimaryFocus = useMemo(() => {
    if (!studentClasses.length) {
      return null
    }

    let primaryList = null
    let latestAssignedAt = null

    studentClasses.forEach((klass) => {
      if (klass.assignedListDetails?.length) {
        const assignments = klass.assignments || {}
        
        klass.assignedListDetails.forEach((list) => {
          // Get assignment metadata (pace, assignedAt) from class's assignments map
          const assignment = assignments[list.id] || {}
          const assignedAt = assignment.assignedAt?.toDate?.() || assignment.assignedAt || list.assignedAt?.toDate?.() || list.assignedAt || null
          const pace = assignment.pace || list.pace || 7 // Default to 7 (≈50 words/week)
          
          if (!latestAssignedAt || (assignedAt && assignedAt > latestAssignedAt)) {
            latestAssignedAt = assignedAt
            primaryList = {
              id: list.id,
              title: list.title || 'Vocabulary List',
              classId: klass.id,
              className: klass.name,
              pace: pace,
              studyDaysPerWeek: assignment.studyDaysPerWeek || 5, // Default to 5 (M-F)
              wordCount: list.wordCount || 0,
              stats: list.stats || {},
            }
          }
        })
      }
    })

    // If no assignedAt found, use first available list
    if (!primaryList && studentClasses.length > 0) {
      for (const klass of studentClasses) {
        if (klass.assignedListDetails?.length > 0) {
          const firstList = klass.assignedListDetails[0]
          const assignments = klass.assignments || {}
          const assignment = assignments[firstList.id] || {}
          const pace = assignment.pace || firstList.pace || 7
          
          primaryList = {
            id: firstList.id,
            title: firstList.title || 'Vocabulary List',
            classId: klass.id,
            className: klass.name,
            pace: pace,
            studyDaysPerWeek: assignment.studyDaysPerWeek || 5, // Default to 5 (M-F)
            wordCount: firstList.wordCount || 0,
            stats: firstList.stats || {},
          }
          break
        }
      }
    }

    return primaryList
  }, [studentClasses])

  // Panel B: Vitals - calculated from progressData (new study system)
  const panelBState = useMemo(() => {
    try {
      if (!getPrimaryFocus) {
        return {
          wordsEstimate: 0,
          retentionPercent: null,
          streakDays: 0,
          error: false
        }
      }

      const key = `${getPrimaryFocus.classId}_${getPrimaryFocus.id}`
      const progress = progressData[key]

      if (!progress) {
        return {
          wordsEstimate: 0,
          retentionPercent: null,
          streakDays: 0,
          error: false
        }
      }

      const { totalWordsIntroduced, stats, recentSessions } = progress
      const avgReviewScore = stats?.avgReviewScore ?? null

      // Words Mastered estimate: totalWordsIntroduced × avgReviewScore
      // This represents our estimate of how many words the student knows
      const wordsEstimate = avgReviewScore !== null && totalWordsIntroduced > 0
        ? Math.round(totalWordsIntroduced * avgReviewScore)
        : totalWordsIntroduced || 0

      // Retention Rate: avgReviewScore as percentage
      const retentionPercent = avgReviewScore !== null
        ? Math.round(avgReviewScore * 100)
        : null

      // Current Streak: calculated from recentSessions with weekend skip logic
      const studyDaysPerWeek = getPrimaryFocus.studyDaysPerWeek || 5
      const streakDays = calculateStreak(recentSessions, studyDaysPerWeek)

      return {
        wordsEstimate,
        retentionPercent,
        streakDays,
        error: false
      }
    } catch (err) {
      console.error('Panel B calculation error:', err)
      return {
        wordsEstimate: 0,
        retentionPercent: null,
        streakDays: 0,
        error: true
      }
    }
  }, [getPrimaryFocus, progressData])

  // Destructure for easier access
  const { wordsEstimate: wordsMastered, retentionPercent, streakDays, error: panelBError } = panelBState

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

  // Helper: Get start of today (00:00:00)
  const getStartOfToday = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  }

  // Helper: Check if session was completed today
  const hasSessionToday = (recentSessions) => {
    if (!recentSessions || recentSessions.length === 0) return false

    const todayStart = getStartOfToday()

    return recentSessions.some(session => {
      if (!session.date) return false
      const sessionDate = session.date?.toDate?.() || session.date
      return sessionDate >= todayStart
    })
  }

  // Helper: Check if test was completed today (from userAttempts)
  const hasTestToday = (attempts) => {
    if (!attempts || attempts.length === 0) return false

    const todayStart = getStartOfToday()

    return attempts.some(attempt => {
      if (!attempt.submittedAt && !attempt.date) return false
      const attemptDate = attempt.submittedAt?.toDate?.() || attempt.submittedAt || attempt.date?.toDate?.() || attempt.date
      if (!attemptDate) return false
      const date = attemptDate instanceof Date ? attemptDate : new Date(attemptDate)
      return date >= todayStart
    })
  }

  // Retention status messages based on intervention level
  const RETENTION_MESSAGES = {
    excellent: [
      "Your retention is excellent!",
      "Past words are sticking well!",
      "Keep up the great work!"
    ],
    good: [
      "Retention looks solid",
      "You're remembering well",
      "Past words are on track"
    ],
    moderate: [
      "We're pacing things carefully",
      "Taking it steady to help retention",
      "Balancing new words and review"
    ],
    needsSupport: [
      "Focusing more on review right now",
      "Slowing down to strengthen retention",
      "More review to help you retain"
    ],
    highIntervention: [
      "Let's solidify what you've learned",
      "Extra review time to build your foundation",
      "Reinforcing before adding more"
    ]
  }

  // Get retention tier from intervention level
  const getRetentionTier = (interventionLevel) => {
    if (interventionLevel <= 0.15) return 'excellent'
    if (interventionLevel <= 0.3) return 'good'
    if (interventionLevel <= 0.5) return 'moderate'
    if (interventionLevel <= 0.75) return 'needsSupport'
    return 'highIntervention'
  }

  // Get a consistent message for today (changes daily, not on every render)
  const getRetentionMessage = (tier) => {
    const messages = RETENTION_MESSAGES[tier]
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24))
    return messages[dayOfYear % messages.length]
  }

  // Panel A: Weekly progress state with error handling
  const panelAState = useMemo(() => {
    try {
      const weeklyGoal = getPrimaryFocus ? (getPrimaryFocus.pace * 7) : 50

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

  // 7-Day Activity Data - Shows wordsIntroduced per study day (last 7 study days)
  const dailyActivity = useMemo(() => {
    const activity = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get settings from primary focus
    const primaryPace = getPrimaryFocus?.pace || 20
    const dailyPace = primaryPace > 0 ? primaryPace : 20
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

    // Create a map of session dates to wordsIntroduced
    const sessionsByDate = {}
    recentSessions.forEach(session => {
      if (!session.date) return
      const sessionDate = session.date?.toDate?.() || session.date
      const normalized = new Date(sessionDate)
      normalized.setHours(0, 0, 0, 0)
      const dateKey = normalized.getTime()
      // Sum wordsIntroduced for the same day (in case of multiple sessions)
      sessionsByDate[dateKey] = (sessionsByDate[dateKey] || 0) + (session.wordsIntroduced || 0)
    })

    // Walk backwards through study days (skipping weekends if needed)
    let currentDate = new Date(today)
    currentDate.setDate(currentDate.getDate() - 1) // Start from yesterday

    // Skip to last weekday if yesterday is weekend and we're skipping weekends
    if (skipWeekends) {
      while (isWeekend(currentDate)) {
        currentDate.setDate(currentDate.getDate() - 1)
      }
    }

    // Collect 7 study days
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentDate)
      const dateKey = date.getTime()
      const wordCount = sessionsByDate[dateKey] || 0

      // Format date string (e.g., "Mon, Oct 24")
      const dayName = dayNames[date.getDay()]
      const monthName = monthNames[date.getMonth()]
      const dayNumber = date.getDate()
      const formattedDate = `${dayName}, ${monthName} ${dayNumber}`

      activity.push({
        date,
        formattedDate,
        wordCount,
        dailyPace,
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
          interventionLevel: 0,
          retentionTier: 'good',
          retentionMessage: "Join a class to get started",
          sessionCompletedToday: false,
          testCompletedToday: false,
          dailyStatus: 'noList', // 'noList' | 'needsSession' | 'needsTest' | 'completed'
          error: false
        }
      }

      const key = `${getPrimaryFocus.classId}_${getPrimaryFocus.id}`
      const progress = progressData[key]

      const interventionLevel = progress?.interventionLevel ?? 0
      const retentionTier = getRetentionTier(interventionLevel)
      const retentionMessage = getRetentionMessage(retentionTier)

      const sessionCompletedToday = hasSessionToday(progress?.recentSessions)
      const testCompletedToday = hasTestToday(userAttempts)

      // Determine daily status
      let dailyStatus = 'needsSession'
      if (testCompletedToday) {
        dailyStatus = 'completed'
      } else if (sessionCompletedToday) {
        dailyStatus = 'needsTest'
      }

      return {
        interventionLevel,
        retentionTier,
        retentionMessage,
        sessionCompletedToday,
        testCompletedToday,
        dailyStatus,
        error: false
      }
    } catch (err) {
      console.error('Panel C calculation error:', err)
      return {
        interventionLevel: 0,
        retentionTier: 'good',
        retentionMessage: "Unable to load",
        sessionCompletedToday: false,
        testCompletedToday: false,
        dailyStatus: 'needsSession',
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
          <div className="mb-6 rounded-xl border-2 border-red-300 bg-red-50 p-4">
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          </div>
        )}

        {userStats && (userStats.retention ?? 1.0) < 0.6 && (
          <div className="mb-6 rounded-xl border-2 border-red-300 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="font-semibold text-red-900">Panic Mode Active</p>
                <p className="text-sm text-red-700">
                  Your retention is below 60%. Focus on reviewing words you've already learned.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-brand-text">Welcome, {displayName}</h1>
          <p className="font-body mt-1 text-base text-text-muted">
            Your personalized vocabulary journey starts here.
          </p>
        </div>

        {/* Command Deck - 3-Panel Grid */}
        <div className="grid grid-cols-12 gap-6 mb-6">
          {/* Panel A: The Focus Card (Col-Span-12 lg:Col-Span-6) */}
          <div className="col-span-12 lg:col-span-6 h-full">
            {panelAError ? (
              <PanelError message="Weekly progress unavailable" className="h-full min-h-[280px]" />
            ) : (
              <div className="bg-brand-primary text-white rounded-2xl shadow-lg relative overflow-hidden p-8 flex flex-col justify-center h-full">
                <div>
                  {/* Weekly Goals Header */}
                  <h2 className="font-heading text-xl font-bold text-white mb-4 pb-4 border-b border-white/20">
                    Weekly Goals
                  </h2>
                  <h3 className="font-heading text-4xl md:text-5xl font-bold text-white mb-8 leading-tight max-w-md">
                    {getPrimaryFocus ? getPrimaryFocus.title : 'No Active List'}
                  </h3>
                </div>

                {getPrimaryFocus && (
                  <>
                    {/* Hero Numbers */}
                    <div className="flex items-baseline mb-6">
                      <span className="text-6xl md:text-7xl font-heading font-bold text-white tracking-tighter">
                        {primaryFocusProgress}
                      </span>
                      <span className="text-3xl text-white/40 mx-2 font-light">/</span>
                      <span className="text-3xl text-white/60 font-heading font-medium">
                        {primaryFocusWeeklyGoal}
                      </span>
                      <span className="text-base text-white/60 font-body ml-2">words</span>
                    </div>

                    {/* Progress Labels */}
                    <div className="flex items-center justify-between text-sm text-white/70 mb-2">
                      <span>This Week</span>
                      <span>
                        {Math.max(0, primaryFocusWeeklyGoal - primaryFocusProgress)} more to hit your goal
                      </span>
                    </div>

                    {/* Thick Progress Bar */}
                    <div className="relative h-10 w-full overflow-hidden rounded-lg bg-black/20">
                      <div
                        className="h-full rounded-lg bg-gradient-to-r from-brand-accent to-orange-400 transition-all duration-500 relative shadow-[0_0_20px_rgba(251,146,60,0.4)]"
                        style={{ width: `${primaryFocusPercent}%` }}
                      >
                        {primaryFocusPercent > 10 && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-heading font-bold text-white">
                            {primaryFocusPercent}%
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Vitals + Launchpad + Activity Bar */}
          <div className="col-span-12 lg:col-span-6 flex flex-col gap-4 h-full">
            {/* Top Row: Launchpad & Vitals */}
            <div className="grid grid-cols-2 gap-6 flex-1">
              {/* Panel C: The Launchpad (Retention Status + Daily CTA) */}
              <div className="col-span-1">
                {panelCState.error ? (
                  <PanelError message="Daily status unavailable" className="h-full min-h-[280px]" />
                ) : (
                <div className={`py-4 px-6 min-h-[280px] flex flex-col justify-between h-full rounded-2xl border shadow-lg ${
                  panelCState.dailyStatus === 'completed'
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 border-teal-600 shadow-emerald-500/20'
                    : 'bg-gradient-to-br from-blue-500 to-brand-primary border-brand-primary shadow-blue-500/20'
                }`}>
                  {/* Top: Retention Status */}
                  <div className="mb-4 pb-4 border-b border-white/20">
                    <p className="font-body text-sm text-white/70 mb-1">Retention Status</p>
                    <p className="font-heading text-lg font-bold text-white">
                      {panelCState.retentionMessage}
                    </p>
                  </div>

                  {/* Bottom: Daily Task Status + CTA */}
                  <div className="flex-1 flex flex-col justify-center">
                    {panelCState.dailyStatus === 'completed' ? (
                      <>
                        <div className="text-center mb-4">
                          <span className="text-4xl mb-2 block">✓</span>
                          <h3 className="font-heading text-xl font-bold text-white">
                            You finished today's task!
                          </h3>
                          <p className="font-body text-sm text-white/80 mt-1">
                            Great work! Come back tomorrow.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setStudyModalOpen(true)}
                          className="w-full h-12 flex items-center justify-center gap-2 rounded-button bg-white/20 text-white font-semibold border border-white/30 hover:bg-white/30 transition-all active:scale-95"
                        >
                          <span>Practice More</span>
                        </button>
                      </>
                    ) : panelCState.dailyStatus === 'needsTest' ? (
                      <>
                        <div className="text-center mb-4">
                          <h3 className="font-heading text-xl font-bold text-white mb-1">
                            Ready to test your knowledge?
                          </h3>
                          <p className="font-body text-sm text-white/80">
                            You've completed today's study session.
                          </p>
                        </div>
                        <div className="space-y-3 max-w-[240px] mx-auto w-full">
                          <button
                            type="button"
                            onClick={() => setTestModalOpen(true)}
                            className="w-full h-14 flex items-center justify-center gap-2 rounded-button bg-surface text-brand-text font-bold border-none shadow-sm transition hover:bg-surface/90"
                          >
                            <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                            <span>Take Test</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setStudyModalOpen(true)}
                            className="w-full h-12 flex items-center justify-center gap-2 rounded-button bg-transparent text-white font-semibold border border-white/50 hover:bg-white/10 transition-all active:scale-95"
                          >
                            <span>Study More</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-center mb-4">
                          <h3 className="font-heading text-xl font-bold text-white mb-1">
                            Start today's session
                          </h3>
                          <p className="font-body text-sm text-white/80">
                            Learn new words and review past ones.
                          </p>
                        </div>
                        <div className="space-y-3 max-w-[240px] mx-auto w-full">
                          <button
                            type="button"
                            onClick={() => setStudyModalOpen(true)}
                            className="w-full h-14 flex items-center justify-center gap-2 rounded-button bg-surface text-brand-text font-bold border-none shadow-sm transition hover:bg-surface/90"
                          >
                            <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            <span>Study Now</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setTestModalOpen(true)}
                            className="w-full h-12 flex items-center justify-center gap-2 rounded-button bg-transparent text-white font-semibold border border-white/50 hover:bg-white/10 transition-all active:scale-95"
                          >
                            <span>Take Test</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                )}
              </div>

              {/* Panel B: The Vitals (Col-Span-1) */}
              <div className="col-span-1">
                {panelBError ? (
                  <PanelError message="Stats unavailable" className="h-full min-h-[280px]" />
                ) : (
                <div className="flex flex-col gap-3 h-full">
                  {/* Card 1: Words Mastered */}
                  <div className="bg-surface border border-border-default rounded-2xl flex items-center gap-4 p-4 flex-1 shadow-sm hover:shadow-md transition-shadow">
                    <div className="rounded-lg bg-brand-primary/10 w-14 h-14 flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-7 h-7 text-brand-text"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-body text-xs text-text-muted">Words Mastered</p>
                      <p className="font-heading text-2xl font-bold text-brand-text">
                        {wordsMastered.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Card 2: Retention Rate */}
                  <div className="bg-surface border border-border-default rounded-2xl flex items-center gap-4 p-4 flex-1 shadow-sm hover:shadow-md transition-shadow">
                    <div className="rounded-lg bg-brand-primary/10 w-14 h-14 flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-7 h-7 text-brand-text"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-body text-xs text-text-muted">Retention Rate</p>
                      <p className="font-heading text-2xl font-bold text-brand-text">
                        {retentionPercent !== null ? `${retentionPercent}%` : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Card 3: Current Streak */}
                  <div className="bg-surface border border-border-default rounded-2xl flex items-center gap-4 p-4 flex-1 shadow-sm hover:shadow-md transition-shadow">
                    <div className="rounded-lg bg-brand-accent/10 w-14 h-14 flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-7 h-7 text-brand-accent"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-body text-xs text-text-muted">Current Streak</p>
                      <p className="font-heading text-2xl font-bold text-brand-accent">{streakDays} days</p>
                    </div>
                  </div>
                </div>
                )}
              </div>
            </div>

            {/* Bottom Row: Panel D - The Activity Bar */}
            <div className="shrink-0">
              <div className="bg-surface border border-border-default rounded-3xl shadow-sm flex flex-row items-center justify-between gap-6 px-6 h-28">
                <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
                  <Activity size={24} className="text-brand-text" />
                  <p className="font-heading font-bold text-sm text-text-muted tracking-wider uppercase">
                    7-DAY RHYTHM
                  </p>
                </div>
                <div className="flex-1 flex items-end justify-between gap-2 h-16 relative">
                  {dailyActivity.map((day, index) => {
                    const dailyPace = day.dailyPace || 20
                    // Calculate height percentage, ensuring it doesn't exceed 100%
                    const heightPercent = day.wordCount > 0 && dailyPace > 0
                      ? Math.min(100, Math.round((day.wordCount / dailyPace) * 100))
                      : 0
                    // For non-zero values, ensure minimum 10% height for visibility
                    // For zero values, use 4px minimum
                    const barHeight = day.wordCount > 0
                      ? `${Math.max(10, heightPercent)}%`
                      : '4px'
                    
                    return (
                      <div
                        key={index}
                        className="flex-1 relative h-full flex flex-col justify-end"
                        onMouseEnter={() => setHoveredBarIndex(index)}
                        onMouseLeave={() => setHoveredBarIndex(null)}
                      >
                        <div
                          className={`w-full rounded-t-[4px] transition-all duration-300 ${
                            day.wordCount > 0
                              ? 'bg-brand-primary'
                              : 'bg-inset'
                          }`}
                          style={{
                            height: barHeight,
                            minHeight: '4px',
                          }}
                        />
                        {hoveredBarIndex === index && day.wordCount > 0 && (
                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 bg-surface text-text-primary text-xs rounded-lg py-1.5 px-3 shadow-xl w-max border border-border-default">
                            <div className="text-center">
                              <div className="font-semibold">{day.formattedDate}</div>
                              <div className="mt-0.5">
                                <span className="font-bold">{day.wordCount}</span> of {dailyPace} words
                              </div>
                            </div>
                            {/* Arrow pointer */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                              <div className="w-2 h-2 bg-surface border-r border-b border-border-default rotate-45"></div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

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
                                      {list.stats?.due > 0 && (
                                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                          {list.stats.due} due!
                                        </span>
                                      )}
                                    </div>
                                    <p className="font-body text-xs text-text-muted mb-3">
                                      {list.wordCount ?? 0} words · Assigned by your teacher.
                                    </p>
                                    {list.stats && (() => {
                                      const wordsLearned = list.stats.wordsLearned ?? 0
                                      const totalWords = list.stats.totalWords ?? 0
                                      const percentage = totalWords > 0
                                        ? Math.min(100, Math.max(0, Math.round((wordsLearned / totalWords) * 100)))
                                        : 0
                                      const barWidth = `${percentage}%`
                                      const isWideBar = percentage > 15

                                      return (
                                        <div className="space-y-1.5 text-xs text-text-secondary">
                                          <div className="flex items-center justify-between">
                                            <span>{wordsLearned} learned</span>
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
                                    />
                                  </div>

                                  {/* Column 3: Stacked Action Buttons */}
                                  <div className="flex flex-col gap-2 shrink-0 lg:min-w-[160px]">
                                    <Link
                                      to={`/session/${klass.id}/${list.id}`}
                                      className="h-10 flex items-center justify-center gap-2 rounded-button bg-brand-accent px-4 text-sm font-semibold text-white transition hover:bg-brand-accent-hover shadow-brand-accent/30"
                                    >
                                      <span className="truncate whitespace-nowrap">Start Session</span>
                                    </Link>
                                    {(() => {
                                      const mode = list.testMode || 'mcq'
                                      const showMcq = mode === 'mcq' || mode === 'both' || !mode
                                      const showTyped = mode === 'typed' || mode === 'both'
                                      const canTest = (list.wordCount ?? 0) > 10
                                      return (
                                        <>
                                          {showMcq && canTest && (
                                            <Link
                                              to={`/mcqtest/${klass.id}/${list.id}?type=review`}
                                              className="h-10 flex items-center justify-center gap-2 rounded-button bg-brand-primary px-4 text-sm font-heading font-bold text-white hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/20 transition-all active:scale-95"
                                            >
                                              <span className="truncate whitespace-nowrap">Take MCQ Test</span>
                                            </Link>
                                          )}
                                          {showTyped && canTest && (
                                            <Link
                                              to={`/typedtest/${klass.id}/${list.id}?type=review`}
                                              className="h-10 flex items-center justify-center gap-2 rounded-button border border-border-strong bg-surface px-4 text-sm font-heading font-bold text-brand-text hover:bg-accent-blue hover:border-brand-primary shadow-sm transition-all active:scale-95"
                                            >
                                              <span className="truncate whitespace-nowrap">Written Test</span>
                                            </Link>
                                          )}
                                        </>
                                      )
                                    })()}
                                    <Link
                                      to={`/blindspots/${klass.id}/${list.id}`}
                                      className="h-10 flex items-center justify-center gap-2 rounded-button border border-border-default bg-surface px-4 text-sm font-medium text-text-secondary hover:bg-muted transition"
                                    >
                                      <span>🔍</span>
                                      <span className="truncate whitespace-nowrap">Blind Spots</span>
                                    </Link>
                                  </div>

                                  {/* Column 4: Two PDF Buttons (Today + Full) */}
                                  <div className="shrink-0 lg:self-stretch flex flex-row lg:flex-col gap-2">
                                    {/* Today's Batch PDF */}
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
                                        handlePDFSelect('today', {
                                          classId: klass.id,
                                          listId: list.id,
                                          listTitle: list.title || 'Vocabulary List',
                                          assignment
                                        })
                                      }}
                                      disabled={generatingPDF === list.id}
                                      className="flex-1 lg:w-20 min-h-[40px] flex flex-col items-center justify-center gap-0.5 rounded-button border border-border-strong bg-surface px-3 py-2 text-xs font-semibold text-brand-text transition hover:bg-accent-blue hover:border-brand-primary disabled:opacity-60"
                                      title="Download Today's Batch as PDF"
                                    >
                                      {generatingPDF === list.id ? (
                                        <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                      ) : (
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
                                      disabled={generatingPDF === list.id}
                                      className="flex-1 lg:w-20 min-h-[40px] flex flex-col items-center justify-center gap-0.5 rounded-button border border-border-strong bg-surface px-3 py-2 text-xs font-semibold text-brand-text transition hover:bg-accent-blue hover:border-brand-primary disabled:opacity-60"
                                      title="Download Full List as PDF"
                                    >
                                      {generatingPDF === list.id ? (
                                        <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                      ) : (
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                      )}
                                      <span>Full</span>
                                    </button>
                                  </div>
                                </div>
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
      
      {/* PDF Options Modal */}
      <PDFOptionsModal
        isOpen={pdfModalOpen}
        onClose={() => { setPdfModalOpen(false); setPdfModalContext(null); }}
        onSelect={handlePDFSelect}
        listTitle={pdfModalContext?.listTitle || ''}
      />
    </main>
  )
}

export default Dashboard


