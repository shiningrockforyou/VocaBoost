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
import { db } from '../firebase'
import CreateClassModal from '../components/CreateClassModal.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { downloadListAsPDF } from '../utils/pdfGenerator.js'
import MasterySquares from '../components/MasterySquares.jsx'
import StudySelectionModal from '../components/modals/StudySelectionModal.jsx'
import { Button, IconButton, CardButton } from '../components/ui'

const DEFAULT_MASTERY_TOTALS = { totalWords: 0, masteredWords: 0 }

const extractListIdFromTestId = (testId = '') => {
  const match = /^test_([^_]+)_/.exec(testId)
  return match ? match[1] : null
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
  
  // Vitals Panel Data - from user.stats directly
  const wordsMastered = user?.stats?.totalWordsLearned ?? 0
  const retentionRate = user?.stats?.retention ?? null
  const retentionPercent = retentionRate !== null ? Math.round(retentionRate * 100) : null
  const streakDays = user?.stats?.streakDays ?? 0
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

  const handleDownloadPDF = async (listId, listTitle, classId = null, isStudent = false) => {
    if (!listId) return
    setGeneratingPDF(listId)
    try {
      console.log('Fetching words for...', listId, 'isStudent:', isStudent)
      let words
      let mode
      
      if (isStudent && user?.uid) {
        if (pdfDataCache.current[listId]) {
          words = pdfDataCache.current[listId]
        } else {
          words = await fetchSmartStudyQueue(listId, user.uid, classId)
          pdfDataCache.current[listId] = words
        }
        mode = 'Daily Worksheet'
      } else {
        if (pdfDataCache.current[listId]) {
          words = pdfDataCache.current[listId]
        } else {
          words = await fetchAllWords(listId)
          pdfDataCache.current[listId] = words
        }
        mode = 'Full List'
      }
      
      const normalizedWords = (Array.isArray(words) ? words : Object.values(words || {})).map((word) => ({
        ...word,
        partOfSpeech: word?.partOfSpeech ?? word?.pos ?? word?.part_of_speech ?? '',
      }))
      console.log('Fetched words:', normalizedWords)
      console.log('PDF Button Data:', normalizedWords)
      console.log('Words count:', normalizedWords?.length || 0)
      
      if (normalizedWords.length === 0) {
        alert('This list has no words to export.')
        setGeneratingPDF(null)
        return
      }
      
      // Log data before generating PDF
      console.log('PDF Generator Data:', normalizedWords)
      console.log('Words count:', normalizedWords.length)
      console.log('Sample word:', normalizedWords[0] || 'No words')
      
      // Generate PDF
      await downloadListAsPDF(listTitle, normalizedWords, mode)
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
            wordCount: firstList.wordCount || 0,
            stats: firstList.stats || {},
          }
          break
        }
      }
    }

    return primaryList
  }, [studentClasses])

  // Calculate weekly goal from pace
  const primaryFocusWeeklyGoal = getPrimaryFocus ? (getPrimaryFocus.pace * 7) : 50
  const primaryFocusProgress = getPrimaryFocus?.stats?.wordsLearned || 0
  const primaryFocusPercent = primaryFocusWeeklyGoal > 0 
    ? Math.min(100, Math.round((primaryFocusProgress / primaryFocusWeeklyGoal) * 100)) 
    : 0

  // 7-Day Activity Data (Yesterday to 7 days ago, left to right)
  const dailyActivity = useMemo(() => {
    const activity = []
    const today = new Date()
    
    // Get daily pace from primary focus, or default to 20
    const primaryPace = getPrimaryFocus?.pace || 20
    const dailyPace = primaryPace > 0 ? primaryPace : 20
    
    // Day and month names for formatting
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    // Create buckets for the last 7 days (Index 0 = Yesterday, Index 6 = 7 days ago)
    const dayBuckets = {}
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      // Normalize to start of day for comparison
      date.setHours(0, 0, 0, 0)
      dayBuckets[date.getTime()] = 0
    }
    
    // Aggregate word counts from attempts
    if (userAttempts.length > 0) {
      userAttempts.forEach((attempt) => {
        if (!attempt.date) return
        
        const attemptDate = attempt.date instanceof Date 
          ? attempt.date 
          : (attempt.date?.toDate ? attempt.date.toDate() : new Date(attempt.date))
        
        // Normalize to start of day
        const normalizedDate = new Date(attemptDate)
        normalizedDate.setHours(0, 0, 0, 0)
        const dateKey = normalizedDate.getTime()
        
        // If this date is in our 7-day window, add the word count
        if (dayBuckets.hasOwnProperty(dateKey)) {
          // Use totalQuestions from attempt, or count of answers
          const wordCount = attempt.totalQuestions || attempt.answers?.length || 0
          dayBuckets[dateKey] += wordCount
        }
      })
    }
    
    // Create array: Index 0 = Yesterday, Index 6 = 7 days ago
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const dateKey = date.getTime()
      
      let wordCount = dayBuckets[dateKey] || 0
      
      // If no real data, show 0 (no mock data fallback)
      // This ensures the chart accurately reflects actual user activity
      
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
    }
    
    return activity
  }, [getPrimaryFocus, userAttempts])

  // Calculate Smart CTA status for Panel C
  const currentDayOfWeek = useMemo(() => {
    const day = new Date().getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    // Convert to 1-7 where Monday is 1
    return day === 0 ? 7 : day
  }, [])

  const expectedProgress = useMemo(() => {
    return (primaryFocusWeeklyGoal / 7) * currentDayOfWeek
  }, [primaryFocusWeeklyGoal, currentDayOfWeek])

  const delta = useMemo(() => {
    return primaryFocusProgress - expectedProgress
  }, [primaryFocusProgress, expectedProgress])

  // Debug: Force a specific status for visual testing
  // Options: 'behind', 'onTrack', 'ahead', or null (to use real data)
  const DEBUG_STATUS = null; // Change this to test different states

  const smartCTAStatus = useMemo(() => {
    // Use debug status if set, otherwise calculate from delta
    if (DEBUG_STATUS !== null) {
      return DEBUG_STATUS
    }
    if (delta < -5) {
      return 'behind'
    } else if (delta > 5) {
      return 'ahead'
    } else {
      return 'onTrack'
    }
  }, [delta, DEBUG_STATUS])


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
                    <span>Progress</span>
                    <span>
                      {Math.max(0, primaryFocusWeeklyGoal - primaryFocusProgress)} words remaining
                    </span>
                  </div>

                  {/* Thick Progress Bar */}
                  <div className="relative h-6 w-full overflow-hidden rounded-full bg-black/20">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-accent to-orange-400 transition-all duration-500 relative"
                      style={{ width: `${primaryFocusPercent}%` }}
                    >
                      {primaryFocusPercent > 10 && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-heading font-bold text-white">
                          {primaryFocusPercent}%
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Column: Vitals + Launchpad + Activity Bar */}
          <div className="col-span-12 lg:col-span-6 flex flex-col gap-4 h-full">
            {/* Top Row: Launchpad & Vitals */}
            <div className="grid grid-cols-2 gap-6 flex-1">
              {/* Panel C: The Launchpad (Smart CTA) (Col-Span-1) */}
              <div className="col-span-1">
            <div className={`py-4 px-6 min-h-[280px] flex flex-col justify-center h-full rounded-2xl border shadow-lg ${
              smartCTAStatus === 'behind' 
                ? 'bg-gradient-to-br from-rose-500 to-orange-600 border-orange-600 shadow-orange-500/20' 
                : smartCTAStatus === 'ahead' 
                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 border-teal-600 shadow-emerald-500/20' 
                : 'bg-gradient-to-br from-blue-500 to-brand-primary border-brand-primary shadow-blue-500/20'
            }`}>
              <div className="mb-6">
                <h3 className="font-heading text-xl font-bold text-white mb-2">
                  {smartCTAStatus === 'behind' 
                    ? "Let's catch up!" 
                    : smartCTAStatus === 'ahead' 
                    ? "Wow, you're flying!" 
                    : "Right on track!"}
                </h3>
                <p className="font-body text-base text-white/90">
                  {smartCTAStatus === 'behind' 
                    ? `You're roughly ${Math.abs(Math.round(delta))} words behind schedule.`
                    : smartCTAStatus === 'ahead' 
                    ? `You're ${Math.round(delta)} words ahead of schedule!`
                    : "You're meeting your daily goals perfectly."}
                </p>
              </div>
              <div className="space-y-3 max-w-[240px] mx-auto w-full">
                <button
                  type="button"
                  onClick={() => setStudyModalOpen(true)}
                  className={`w-full h-14 flex items-center justify-center gap-2 rounded-button px-6 text-base font-bold border-none shadow-sm transition hover:bg-surface/90 ${
                    smartCTAStatus === 'behind'
                      ? 'bg-surface text-rose-600'
                      : smartCTAStatus === 'ahead'
                      ? 'bg-surface text-emerald-600'
                      : 'bg-surface text-brand-text'
                  }`}
                >
                  <svg
                    className="h-5 w-5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                  <span className="truncate whitespace-nowrap max-w-full">Study Now</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTestModalOpen(true)}
                  className="w-full h-14 flex items-center justify-center gap-2 rounded-button bg-transparent text-white font-bold border-2 border-white hover:bg-surface/20 transition-all active:scale-95"
                >
                  <svg
                    className="h-5 w-5 flex-shrink-0"
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
                  <span className="truncate whitespace-nowrap max-w-full">Take Test</span>
                </button>
              </div>
            </div>
              </div>

              {/* Panel B: The Vitals (Col-Span-1) */}
              <div className="col-span-1">
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
                                className="flex flex-col gap-3 rounded-card border border-border-strong bg-surface px-4 py-3"
                              >
                                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-heading text-sm font-semibold text-text-primary">
                                        {list.title || 'Vocabulary List'}
                                      </p>
                                      {list.stats?.due > 0 && (
                                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                          {list.stats.due} due!
                                        </span>
                                      )}
                                    </div>
                                    <p className="font-body text-xs text-text-muted">
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
                                        <div className="mt-3 space-y-2 text-xs text-text-secondary">
                                          <div className="flex items-center justify-between">
                                            <span>{wordsLearned} learned</span>
                                            <span>{totalWords} total</span>
                                          </div>
                                          <div className="relative h-12 w-full rounded-xl bg-inset flex items-center overflow-hidden">
                                            <div
                                              className="h-full rounded-xl bg-brand-primary transition-all duration-1000 ease-out flex items-center"
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
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
                                    <Link
                                      to={`/study/${list.id}?classId=${klass.id}`}
                                      className="h-12 flex items-center justify-center gap-2 rounded-button bg-brand-accent px-4 text-sm font-semibold text-white transition hover:bg-brand-accent-hover shadow-brand-accent/30"
                                    >
                                      <span className="truncate whitespace-nowrap max-w-full">Study Now</span>
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
                                              to={`/test/${list.id}?classId=${klass.id}`}
                                              className="h-12 flex items-center justify-center gap-2 rounded-button bg-brand-primary px-4 text-sm font-heading font-bold text-white hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/20 transition-all active:scale-95"
                                            >
                                              <span className="truncate whitespace-nowrap max-w-full">Take Test</span>
                                            </Link>
                                          )}
                                          {showTyped && canTest && (
                                            <Link
                                              to={`/typed-test/${list.id}?classId=${klass.id}`}
                                              className="h-12 flex items-center justify-center gap-2 rounded-button border border-border-strong bg-surface px-4 text-sm font-heading font-bold text-brand-text hover:bg-accent-blue hover:border-brand-primary shadow-sm transition-all active:scale-95"
                                            >
                                              <span className="truncate whitespace-nowrap max-w-full">Typed Test</span>
                                            </Link>
                                          )}
                                        </>
                                      )
                                    })()}
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadPDF(list.id, list.title, klass.id, true)}
                                      disabled={generatingPDF === list.id}
                                      className="h-12 flex items-center justify-center gap-1.5 rounded-button border border-border-strong bg-surface px-4 text-sm font-semibold text-brand-text transition hover:bg-accent-blue hover:border-brand-primary disabled:opacity-60"
                                      title="Download PDF"
                                    >
                                      {generatingPDF === list.id ? (
                                        <>
                                          <svg
                                            className="h-3 w-3 animate-spin"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                            />
                                          </svg>
                                          Generating...
                                        </>
                                      ) : (
                                        <svg
                                          className="h-3 w-3"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                          xmlns="http://www.w3.org/2000/svg"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                          />
                                        </svg>
                                      )}
                                      <span>PDF</span>
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
    </main>
  )
}

export default Dashboard


