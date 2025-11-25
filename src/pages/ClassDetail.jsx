import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext.jsx'
import { db } from '../firebase'
import {
  assignListToClass,
  fetchAllWords,
  fetchClass,
  fetchClassAttempts,
  fetchStudentAggregateStats,
  fetchTeacherLists,
  unassignListFromClass,
  updateAssignmentSettings,
} from '../services/db'
import AssignListModal from '../components/AssignListModal.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import BackButton from '../components/BackButton.jsx'
import { downloadListAsPDF } from '../utils/pdfGenerator.js'

const ClassDetail = () => {
  const { classId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [classInfo, setClassInfo] = useState(null)
  const [members, setMembers] = useState([])
  const [assignedLists, setAssignedLists] = useState([])
  const [teacherLists, setTeacherLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [activeTab, setActiveTab] = useState('lists')
  const [attempts, setAttempts] = useState([])
  const [attemptsLoading, setAttemptsLoading] = useState(false)
  const [listFilter, setListFilter] = useState('all')
  const [generatingPDF, setGeneratingPDF] = useState(null)
const [settingsModalList, setSettingsModalList] = useState(null)
const [settingsForm, setSettingsForm] = useState({ pace: 20, testOptionsCount: 4 })
const [savingSettings, setSavingSettings] = useState(false)
const [unassigningListId, setUnassigningListId] = useState(null)

  const isOwner = useMemo(
    () => classInfo?.ownerTeacherId === user?.uid,
    [classInfo?.ownerTeacherId, user?.uid],
  )

  const loadClass = useCallback(async () => {
    if (!classId || !user?.uid) return

    setLoading(true)
    setError('')
    try {
      const data = await fetchClass(classId)
      if (!data) {
        throw new Error('Class not found.')
      }
      if (data.ownerTeacherId !== user.uid) {
        throw new Error('You do not have access to this class.')
      }
      setClassInfo(data)
    } catch (err) {
      setError(err.message ?? 'Unable to load class.')
    } finally {
      setLoading(false)
    }
  }, [classId, user?.uid])

  const loadMembers = useCallback(async () => {
    if (!classId) return

    const membersRef = collection(db, 'classes', classId, 'members')
    const membersQuery = query(membersRef, orderBy('joinedAt', 'desc'))
    const snapshot = await getDocs(membersQuery)
    const membersData = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const memberData = { id: docSnap.id, ...docSnap.data() }
        const stats = await fetchStudentAggregateStats(docSnap.id)
        return { ...memberData, stats }
      }),
    )
    setMembers(membersData)
  }, [classId])

  const loadAssignedLists = useCallback(async (classData) => {
    // Support both old assignedLists array and new assignments map
    const assignments = classData.assignments || {}
    const assignedListIds = classData.assignedLists || Object.keys(assignments)
    
    if (!assignedListIds?.length) {
      setAssignedLists([])
      return
    }

    const listData = await Promise.all(
      assignedListIds.map(async (id) => {
        const listSnap = await getDoc(doc(db, 'lists', id))
        if (!listSnap.exists()) return null
        
        const assignment = assignments[id] || { pace: 20, testOptionsCount: 4 }
        return {
          id: listSnap.id,
          ...listSnap.data(),
          pace: assignment.pace,
          testOptionsCount: assignment.testOptionsCount ?? 4,
        }
      }),
    )

    setAssignedLists(listData.filter(Boolean))
  }, [])

  useEffect(() => {
    loadClass()
  }, [loadClass])

  useEffect(() => {
    if (classInfo) {
      loadAssignedLists(classInfo)
    } else {
      setAssignedLists([])
    }
    if (classInfo?.id) {
      loadMembers()
    }
  }, [classInfo, loadAssignedLists, loadMembers])

  useEffect(() => {
    if (user?.uid) {
      fetchTeacherLists(user.uid).then(setTeacherLists).catch(() => {})
    }
  }, [user?.uid])

  const loadAttempts = useCallback(async () => {
    if (!classId) return
    setAttemptsLoading(true)
    try {
      const attemptsData = await fetchClassAttempts(classId)
      setAttempts(attemptsData)
    } catch (err) {
      console.error('Error loading attempts:', err)
      setAttempts([])
    } finally {
      setAttemptsLoading(false)
    }
  }, [classId])

  useEffect(() => {
    if (activeTab === 'gradebook' && classId) {
      loadAttempts()
    }
  }, [activeTab, classId, loadAttempts])

  const availableLists = useMemo(() => {
    const assignedIds = new Set(
      classInfo?.assignedLists ?? Object.keys(classInfo?.assignments || {})
    )
    return teacherLists.filter((list) => !assignedIds.has(list.id))
  }, [classInfo?.assignedLists, classInfo?.assignments, teacherLists])

  const handleAssignList = async (listId, pace = 20, testOptionsCount = 4) => {
    if (!classId) return
    setAssigning(true)
    setFeedback('')
    try {
      await assignListToClass(classId, listId, pace, testOptionsCount)
      setAssignModalOpen(false)
      setFeedback('List assigned successfully.')
      await loadClass()
    } catch (err) {
      setFeedback(err.message ?? 'Unable to assign list.')
    } finally {
      setAssigning(false)
    }
  }

  const openSettingsModal = (list) => {
    setSettingsModalList(list)
    setSettingsForm({
      pace: list.pace ?? 20,
      testOptionsCount: list.testOptionsCount ?? 4,
    })
  }

  const closeSettingsModal = () => {
    setSettingsModalList(null)
  }

  const handleSaveSettings = async () => {
    if (!classId || !settingsModalList) return
    setFeedback('')
    setSavingSettings(true)
    try {
      await updateAssignmentSettings(classId, settingsModalList.id, {
        pace: settingsForm.pace,
        testOptionsCount: settingsForm.testOptionsCount,
      })
      setFeedback('List settings updated successfully.')
      await loadClass()
      closeSettingsModal()
    } catch (err) {
      setFeedback(err.message ?? 'Unable to update settings.')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleUnassignList = async (listId) => {
    if (!classId || !listId) return
    const confirmed = window.confirm('Remove this list from the class? Student progress is saved.')
    if (!confirmed) return

    setFeedback('')
    setUnassigningListId(listId)
    try {
      await unassignListFromClass(classId, listId)
      setFeedback('List removed from class.')
      await loadClass()
    } catch (err) {
      setFeedback(err.message ?? 'Unable to remove list.')
    } finally {
      setUnassigningListId(null)
    }
  }

  const handleDownloadPDF = async (listId, listTitle) => {
    if (!listId) return
    setGeneratingPDF(listId)
    try {
      console.log('Fetching words for...', listId)
      // Teacher view: Always get full list
      const words = await fetchAllWords(listId)
      console.log('Fetched words:', words)
      console.log('Words count:', words?.length || 0)
      
      if (words.length === 0) {
        alert('This list has no words to export.')
        setGeneratingPDF(null)
        return
      }
      
      // Log data before generating PDF
      console.log('PDF Generator Data:', words)
      console.log('Words count:', words.length)
      console.log('Sample word:', words[0] || 'No words')
      
      // Generate PDF with Full List mode
      await downloadListAsPDF(listTitle, words, 'Full List')
    } catch (err) {
      console.error('Error generating PDF:', err)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setGeneratingPDF(null)
    }
  }

  const handleCopyJoinCode = () => {
    if (classInfo?.joinCode) {
      navigator.clipboard.writeText(classInfo.joinCode)
      setFeedback('Join code copied to clipboard!')
      setTimeout(() => setFeedback(''), 3000)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <p className="text-lg font-semibold text-slate-900">Something went wrong</p>
          <p className="mt-3 text-sm text-slate-500">{error}</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-6 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Go Back
          </button>
        </div>
      </main>
    )
  }

  if (!classInfo || !isOwner) {
    return null
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <BackButton />
        <header className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-500">
                Class Detail
              </p>
              <h1 className="mt-2 text-4xl font-bold text-slate-900">{classInfo.name}</h1>
              <p className="mt-2 text-base text-slate-600">
                Share the join code for students to enroll.
              </p>
            </div>
            <Link
              to="/lists"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Manage Lists
            </Link>
          </div>
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-4 text-center">
            <p className="text-sm uppercase tracking-wide text-slate-500">Join Code</p>
            <p className="mt-2 text-4xl font-bold tracking-[0.35em] text-slate-900">
              {classInfo.joinCode}
            </p>
          </div>
          {feedback && (
            <p className="mt-4 text-sm text-emerald-600" role="status">
              {feedback}
            </p>
          )}
        </header>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('lists')}
            className={`px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'lists'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Assigned Lists
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'students'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Students
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gradebook')}
            className={`px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'gradebook'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Gradebook
          </button>
        </div>

        {/* Assigned Lists Tab */}
        {activeTab === 'lists' && (
        <section className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Assigned Lists</h2>
              <p className="text-sm text-slate-500">These lists appear in class study plans.</p>
            </div>
            <button
              type="button"
              onClick={() => setAssignModalOpen(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              disabled={availableLists.length === 0}
            >
              Assign List
            </button>
          </div>
          {assignedLists.length ? (
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {assignedLists.map((list) => (
                <li
                  key={list.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 transition hover:border-slate-200 hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-900">{list.title}</h3>
                      <p className="mt-1 text-sm text-slate-500 line-clamp-2">{list.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold">
                        <span className="uppercase tracking-wide text-slate-500">
                          {list.wordCount ?? 0} words
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="text-blue-600">Pace: {list.pace ?? 20} words/day</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-emerald-600">
                          Test Options: {list.testOptionsCount ?? 4} choices
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadPDF(list.id, list.title)}
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
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openSettingsModal(list)}
                        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                        title="Edit Settings"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnassignList(list.id)}
                        disabled={unassigningListId === list.id}
                        className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
                        title="Remove from class"
                      >
                        {unassigningListId === list.id ? (
                          <svg
                            className="h-4 w-4 animate-spin"
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
                        ) : (
                          <svg
                            className="h-4 w-4"
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
                        )}
                        <span className="sr-only">Remove list</span>
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm text-slate-500">No content assigned.</p>
              <p className="mt-1 text-sm text-slate-500">Click 'Assign List' to start.</p>
            </div>
          )}
        </section>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && (
        <section className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Student Roster</h2>
            <p className="text-sm text-slate-500">{members.length} enrolled</p>
          </div>
          {members.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Words Learned</th>
                    <th className="px-3 py-2 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td className="px-3 py-2 font-semibold text-slate-900">
                        {member.displayName || 'Unnamed Student'}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{member.email || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">
                        <span className="font-semibold text-slate-900">
                          {member.stats?.totalWordsLearned ?? 0}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {member.joinedAt?.toDate
                          ? member.joinedAt.toDate().toLocaleDateString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-semibold text-slate-700">No students enrolled yet</p>
              <p className="mt-2 text-sm text-slate-500">
                Share the join code below for students to enroll.
              </p>
              <div className="mt-6 rounded-xl border border-slate-300 bg-white px-6 py-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Join Code</p>
                <div className="mt-3 flex items-center justify-center gap-3">
                  <p className="text-3xl font-bold tracking-[0.35em] text-slate-900">
                    {classInfo?.joinCode || '—'}
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyJoinCode}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
        )}

        {/* Gradebook Tab */}
        {activeTab === 'gradebook' && (
        <section className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Gradebook</h2>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600">Filter:</label>
              <select
                value={listFilter}
                onChange={(e) => setListFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none ring-slate-300 focus:ring-2"
              >
                <option value="all">All Lists</option>
                {assignedLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {attemptsLoading ? (
            <div className="mt-6 flex justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : attempts.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm text-slate-500">No test attempts recorded yet.</p>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="px-3 py-2 font-medium">Student Name</th>
                    <th className="px-3 py-2 font-medium">Test (List Name)</th>
                    <th className="px-3 py-2 font-medium">Score</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attempts
                    .filter((attempt) => listFilter === 'all' || attempt.listId === listFilter)
                    .map((attempt) => (
                      <tr key={attempt.id}>
                        <td className="px-3 py-2 font-semibold text-slate-900">
                          {attempt.studentName}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{attempt.listName}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`font-semibold ${
                              attempt.score < 60 ? 'text-red-600' : 'text-slate-900'
                            }`}
                          >
                            {attempt.score}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {attempt.submittedAt?.toDate
                            ? attempt.submittedAt.toDate().toLocaleDateString()
                            : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        )}
      </div>

      <AssignListModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        lists={availableLists}
        onAssign={handleAssignList}
        isSubmitting={assigning}
      />

      {settingsModalList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Edit List Settings</h3>
                <p className="text-sm text-slate-500">
                  Control pacing and test options for "{settingsModalList.title}".
                </p>
              </div>
              <button
                type="button"
                onClick={closeSettingsModal}
                className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Daily New Words (Pace)
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={settingsForm.pace}
                  onChange={(event) =>
                    setSettingsForm((prev) => ({
                      ...prev,
                      pace: Math.max(1, parseInt(event.target.value, 10) || 20),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-slate-300 focus:bg-white focus:ring-2"
                  placeholder="20"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Test Options (choices per question)
                <input
                  type="number"
                  min="4"
                  max="10"
                  value={settingsForm.testOptionsCount}
                  onChange={(event) =>
                    setSettingsForm((prev) => ({
                      ...prev,
                      testOptionsCount: Math.min(
                        10,
                        Math.max(4, parseInt(event.target.value, 10) || 4),
                      ),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-slate-300 focus:bg-white focus:ring-2"
                  placeholder="4"
                />
                <p className="mt-1 text-xs text-slate-500">Students will see this many answer choices.</p>
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeSettingsModal}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                disabled={savingSettings}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {savingSettings ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default ClassDetail


