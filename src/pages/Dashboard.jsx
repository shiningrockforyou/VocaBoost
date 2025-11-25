import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext.jsx'
import {
  deleteClass,
  deleteList,
  fetchAllWords,
  fetchDashboardStats,
  fetchSmartStudyQueue,
  fetchStudentClasses,
  fetchTeacherClasses,
  fetchTeacherLists,
  joinClass,
} from '../services/db'
import { db } from '../firebase'
import CreateClassModal from '../components/CreateClassModal.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import CollapsibleCard from '../components/CollapsibleCard.jsx'
import { downloadListAsPDF } from '../utils/pdfGenerator.js'
import MasterySquares from '../components/MasterySquares.jsx'

const DEFAULT_MASTERY_TOTALS = { totalWords: 0, masteredWords: 0 }

const extractListIdFromTestId = (testId = '') => {
  const match = /^test_([^_]+)_/.exec(testId)
  return match ? match[1] : null
}

const Dashboard = () => {
  const { user, logout } = useAuth()
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
  const streakDays = userStats?.streakDays ?? 0
  const retentionPercent = Math.round(((dashboardStats?.retention ?? userStats?.retention ?? 1) || 0) * 100)
  const latestTest = dashboardStats?.latestTest || null
  const latestTestListId = latestTest ? extractListIdFromTestId(latestTest.testId) : null
  const latestTestTitle =
    (latestTestListId && listTitleLookup[latestTestListId]) || latestTest?.testName || 'Vocabulary Test'
  const missedWords = latestTest?.answers?.filter((answer) => !answer.isCorrect) ?? []

  const listTitleLookup = useMemo(() => {
    const lookup = {}
    studentClasses.forEach((klass) => {
      ;(klass.assignedListDetails || []).forEach((list) => {
        lookup[list.id] = list.title || 'Vocabulary Test'
      })
    })
    return lookup
  }, [studentClasses])

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
  }, [loadDashboardStats])

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

  const handleLogout = async () => {
    setError('')
    try {
      await logout()
    } catch (err) {
      setError(err.message ?? 'Unable to log out right now.')
    }
  }

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
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <img src="/logo_vector.svg" alt="VocaBoost" className="w-32 md:w-48 h-auto" />
          <header className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-500">
                  Teacher Dashboard
                </p>
                <h1 className="mt-2 text-4xl font-bold text-slate-900">Welcome, {displayName}</h1>
                <p className="mt-2 text-base text-slate-600">
                  Manage classes, lists, and upcoming assessments.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Create New Class
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Log Out
                </button>
              </div>
            </div>
            {error && (
              <p className="mt-4 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </header>

          <div className="flex flex-col gap-6">
            <CollapsibleCard title="My Classes" minHeight="h-64">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <p className="text-sm text-slate-500">Share the join code with students.</p>
                <button
                  type="button"
                  onClick={loadTeacherClasses}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Refresh
                </button>
              </div>

              {classError && (
                <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {classError}
                </p>
              )}

              {classesLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="md" />
                </div>
              ) : classes.length ? (
                <ul className="grid gap-4 md:grid-cols-2">
                  {classes.map((klass) => (
                    <li
                      key={klass.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 transition hover:border-slate-200 hover:bg-white"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">{klass.name}</h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Join Code:{' '}
                            <span className="font-semibold tracking-wide text-slate-900">
                              {klass.joinCode}
                            </span>
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Students enrolled: <span className="font-semibold text-slate-900">—</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteClass(klass.id)}
                          disabled={deletingClassId === klass.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                        >
                          {deletingClassId === klass.id ? (
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
                              Deleting…
                            </>
                          ) : (
                            <>
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                              Delete
                            </>
                          )}
                        </button>
                      </div>
                      <Link
                        to={`/classes/${klass.id}`}
                        className="mt-3 inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-500"
                      >
                        Open Class →
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">
                  You have not created any classes yet. Use the button above to get started.
                </p>
              )}
            </CollapsibleCard>

            <CollapsibleCard title="My Vocabulary Lists" minHeight="h-64">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <p className="text-sm text-slate-500">Manage content for your classes.</p>
                <Link
                  to="/lists/new"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Create New List
                </Link>
              </div>

              {listsError && (
                <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {listsError}
                </p>
              )}

              {listsLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="md" />
                </div>
              ) : teacherLists.length ? (
                <ul className="grid gap-4 md:grid-cols-2">
                  {teacherLists.map((list) => (
                    <li
                      key={list.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 p-5 transition hover:border-slate-200 hover:bg-white"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">{list.title}</h3>
                          <p className="mt-1 text-sm text-slate-500 line-clamp-2">{list.description}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                            {list.wordCount ?? 0} words
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteList(list.id)}
                            disabled={deletingListId === list.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                          >
                            {deletingListId === list.id ? (
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
                                Deleting…
                              </>
                            ) : (
                              <>
                                <svg
                                  className="h-3 w-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                                Delete
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                        <Link
                          to={`/lists/${list.id}`}
                          className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-500"
                        >
                          Edit List →
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDownloadPDF(list.id, list.title, null, false)}
                          disabled={generatingPDF === list.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
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
                            <>
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
                              Download PDF
                            </>
                          )}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">
                  You have not created any lists yet. Click &quot;Create New List&quot; to start.
                </p>
              )}
            </CollapsibleCard>
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

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <img src="/logo_vector.svg" alt="VocaBoost" className="w-32 md:w-48 h-auto" />
        <header className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-500">
            Dashboard
          </p>
          <h1 className="mt-3 text-4xl font-bold text-slate-900">Welcome, {displayName}</h1>
          <p className="mt-2 text-base text-slate-600">
            Your personalized vocabulary journey starts here.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-6 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Log Out
          </button>
          {error && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </header>

        {userStats && (userStats.retention ?? 1.0) < 0.6 && (
          <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
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

        <div className="flex flex-col gap-6">
          <CollapsibleCard title="My Stats" minHeight="h-64">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <p className="text-sm uppercase tracking-wide text-slate-500">Mastered Words</p>
                <p className="mt-3 text-4xl font-bold text-slate-900">{masteredWordsCount}</p>
                <p className="mt-1 text-xs text-slate-500">Total words in Box 4+</p>
              </div>
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <p className="text-sm uppercase tracking-wide text-slate-500">Weekly Goal</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {weeklyProgress} / {weeklyGoalTarget} words
                </p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${weeklyPercent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">{weeklyPercent}% complete</p>
              </div>
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <p className="text-sm uppercase tracking-wide text-slate-500">Current Streak</p>
                <p className="mt-3 text-4xl font-bold text-slate-900">{streakDays}</p>
                <p className="mt-1 text-xs text-slate-500">consecutive days</p>
              </div>
              <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <p className="text-sm uppercase tracking-wide text-slate-500">Retention</p>
                <p className="mt-3 text-4xl font-bold text-slate-900">{retentionPercent}%</p>
                <p className="mt-1 text-xs text-slate-500">last 30 days</p>
              </div>
            </div>
          </CollapsibleCard>

          {latestTest && (
            <section className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-100">
              <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Latest Test Analysis
                  </p>
                  <h3 className="mt-1 text-2xl font-bold text-slate-900">{latestTestTitle}</h3>
                  <p className="text-sm text-slate-500">
                    {latestTest.submittedAt?.toDate
                      ? latestTest.submittedAt
                          .toDate()
                          .toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Score</p>
                  <p
                    className={`text-3xl font-bold ${
                      latestTest.score >= 90
                        ? 'text-emerald-600'
                        : latestTest.score >= 70
                          ? 'text-blue-600'
                          : latestTest.score >= 50
                            ? 'text-amber-600'
                            : 'text-red-600'
                    }`}
                  >
                    {latestTest.score}%
                  </p>
                </div>
              </header>
              <dl className="mt-6 grid gap-4 md:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Type</dt>
                  <dd className="text-base font-semibold text-slate-900">{latestTest.testType || 'Multiple Choice'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Questions Answered</dt>
                  <dd className="text-base font-semibold text-slate-900">
                    {latestTest.totalQuestions ?? (latestTest.answers?.length || 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Retention Boost</dt>
                  <dd className="text-base font-semibold text-slate-900">
                    {latestTest.retention ? `${Math.round(latestTest.retention * 100)}%` : `${retentionPercent}%`}
                  </dd>
                </div>
              </dl>
              {latestTest.answers && (
                <div className="mt-6">
                  <p className="text-sm font-semibold text-slate-700">Words to Review</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {missedWords.length ? (
                      missedWords.map((answer) => (
                        <span
                          key={answer.wordId}
                          className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700"
                        >
                          {answer.word || answer.wordId}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">You answered every word correctly 🎯</span>
                    )}
                  </div>
                </div>
              )}
              <div className="mt-6 flex flex-wrap justify-between gap-3">
                <p className="text-sm text-slate-500">
                  Keep reviewing the words above to solidify your mastery.
                </p>
                {latestTestListId && (
                  <Link
                    to={`/test/${latestTestListId}`}
                    className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    Retake Test
                  </Link>
                )}
              </div>
            </section>
          )}

          {studentClasses.length === 0 && !studentClassesLoading ? (
            <section className="rounded-2xl bg-white p-8 shadow-md ring-1 ring-slate-100 text-center">
              <h2 className="text-2xl font-bold text-slate-900">Welcome! Join your first class</h2>
              <p className="mt-2 text-sm text-slate-500">
                Enter the 6-character code your teacher shared to get started.
              </p>
              <form onSubmit={handleJoinClass} className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-center">
                <label className="flex-1 max-w-md text-sm font-medium text-slate-700">
                  Class Code
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                    placeholder="ABC123"
                    maxLength={6}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-2xl font-bold tracking-[0.4em] text-slate-900 outline-none ring-slate-300 focus:bg-white focus:ring-2"
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={joining}
                  className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {joining ? 'Joining…' : 'Join Class'}
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
            </section>
          ) : (
            <>
              <section className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-100">
                <h2 className="text-xl font-semibold text-slate-900">Join a Class</h2>
                <p className="text-sm text-slate-500">Enter the 6-character code your teacher shared.</p>
                <form onSubmit={handleJoinClass} className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
                  <label className="flex-1 text-sm font-medium text-slate-700">
                    Class Code
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                      placeholder="ABC123"
                      maxLength={6}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-2xl font-bold tracking-[0.4em] text-slate-900 outline-none ring-slate-300 focus:bg-white focus:ring-2"
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={joining}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    {joining ? 'Joining…' : 'Join'}
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
              </section>

              <CollapsibleCard title="My Classes" minHeight="h-64">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">
                {studentClassesLoading ? 'Loading…' : `${studentClasses.length} enrolled`}
              </p>
            </div>
            {studentClassesLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            ) : studentClasses.length ? (
              <ul className="space-y-6">
                {studentClasses.map((klass) => (
                  <li
                    key={klass.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5"
                  >
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{klass.name}</h3>
                        <p className="text-sm text-slate-500">
                          Joined:{' '}
                          <span className="font-semibold text-slate-900">
                            {klass.joinedAt?.toDate
                              ? klass.joinedAt.toDate().toLocaleDateString()
                              : 'Today'}
                          </span>
                        </p>
                      </div>
                      <p className="text-sm font-medium text-blue-600">
                        {klass.assignedLists?.length ?? 0} assigned lists
                      </p>
                    </div>
                    {klass.assignedListDetails?.length ? (
                      <div className="mt-4 space-y-3">
                        {klass.assignedListDetails.map((list) => (
                          <div
                            key={list.id}
                            className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3"
                          >
                            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-800">
                                    {list.title || 'Vocabulary List'}
                                  </p>
                                  {list.stats?.due > 0 && (
                                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                                      {list.stats.due} due!
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500">
                                  {list.wordCount ?? 0} words · Assigned by your teacher.
                                </p>
                                {list.stats && (
                                  <div className="mt-3 space-y-2 text-xs text-slate-600">
                                    <div className="flex items-center justify-between">
                                      <span>{list.stats.wordsLearned ?? 0} learned</span>
                                      <span>{list.stats.totalWords ?? 0} total</span>
                                    </div>
                                    <MasterySquares
                                      total={list.stats.totalWords ?? 0}
                                      mastered={list.stats.masteredWords ?? list.stats.masteryCount ?? 0}
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                <Link
                                  to={`/study/${list.id}?classId=${klass.id}`}
                                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                                >
                                  Study Now
                                </Link>
                                {(list.wordCount ?? 0) > 10 && (
                                  <Link
                                    to={`/test/${list.id}?classId=${klass.id}`}
                                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                  >
                                    Take Test
                                  </Link>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDownloadPDF(list.id, list.title, klass.id, true)}
                                  disabled={generatingPDF === list.id}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
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
                                  <span className="hidden sm:inline">PDF</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                        <p className="text-sm text-slate-500">
                          Waiting for teacher to assign content...
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </CollapsibleCard>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

export default Dashboard


