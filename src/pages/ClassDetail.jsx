import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
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
  fetchTeacherClasses,
  unassignListFromClass,
  updateAssignmentSettings,
} from '../services/db'
import AssignListModal from '../components/AssignListModal.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import HeaderBar from '../components/HeaderBar.jsx'
import { downloadListAsPDF } from '../utils/pdfGenerator.js'
import { Button, IconButton, TabButton, LinkButton } from '../components/ui'
import { X, Settings, Copy, Check, RefreshCw, FileText, Trash2, Download } from 'lucide-react'

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
  const [settingsForm, setSettingsForm] = useState({ pace: 20, testOptionsCount: 4, testMode: 'mcq', studyDaysPerWeek: 5, passThreshold: 95, testSizeNew: 50 })
const [savingSettings, setSavingSettings] = useState(false)
const [unassigningListId, setUnassigningListId] = useState(null)
  const [removingStudentId, setRemovingStudentId] = useState(null)
  const [selectedStudents, setSelectedStudents] = useState([])
  const [allClasses, setAllClasses] = useState([])
  const [classSwitcherOpen, setClassSwitcherOpen] = useState(false)

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
        
        const assignment = assignments[id] || { pace: 20, testOptionsCount: 4, testMode: 'mcq', studyDaysPerWeek: 5 }
        return {
          id: listSnap.id,
          ...listSnap.data(),
          pace: assignment.pace,
          testOptionsCount: assignment.testOptionsCount ?? 4,
          testMode: assignment.testMode || 'mcq',
          studyDaysPerWeek: assignment.studyDaysPerWeek ?? 5,
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

  useEffect(() => {
    const loadAllClasses = async () => {
      if (user?.uid) {
        const classes = await fetchTeacherClasses(user.uid)
        setAllClasses(classes)
      }
    }
    loadAllClasses()
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

  const handleAssignList = async (listId, pace = 20, testOptionsCount = 4, testMode = 'mcq', passThreshold = 95, testSizeNew = 50) => {
    if (!classId) return
    setAssigning(true)
    setFeedback('')
    try {
      await assignListToClass(classId, listId, pace, testOptionsCount, testMode, passThreshold, testSizeNew)
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
      testMode: list.testMode || 'mcq',
      studyDaysPerWeek: list.studyDaysPerWeek ?? 5,
      passThreshold: list.passThreshold ?? 95,
      testSizeNew: list.testSizeNew ?? 50,
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
        testMode: settingsForm.testMode,
        studyDaysPerWeek: settingsForm.studyDaysPerWeek,
        passThreshold: settingsForm.passThreshold,
        testSizeNew: settingsForm.testSizeNew,
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

  const handleRemoveStudent = async (studentId) => {
    if (!window.confirm('Are you sure you want to remove this student from the class?')) {
      return
    }
    
    setRemovingStudentId(studentId)
    try {
      const { removeStudentFromClass } = await import('../services/db')
      await removeStudentFromClass(classId, studentId)
      // Refresh the class data to update student list
      loadClass()
      // Remove from selected if it was selected
      setSelectedStudents(prev => prev.filter(id => id !== studentId))
    } catch (err) {
      console.error('Failed to remove student:', err)
      alert('Failed to remove student. Please try again.')
    } finally {
      setRemovingStudentId(null)
    }
  }

  const handleSelectStudent = (studentId) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
  }

  const handleSelectAllStudents = () => {
    const membersList = members || []
    if (selectedStudents.length === membersList.length && membersList.length > 0) {
      setSelectedStudents([])
    } else {
      setSelectedStudents(membersList.map(m => m.id))
    }
  }

  const handleRemoveSelectedStudents = async () => {
    if (selectedStudents.length === 0) return
    
    const confirmMessage = `Are you sure you want to remove ${selectedStudents.length} student${selectedStudents.length > 1 ? 's' : ''} from this class?`
    if (!window.confirm(confirmMessage)) return
    
    setRemovingStudentId('bulk')
    try {
      const { removeStudentFromClass } = await import('../services/db')
      for (const studentId of selectedStudents) {
        await removeStudentFromClass(classId, studentId)
      }
      setSelectedStudents([])
      loadClass()
    } catch (err) {
      console.error('Failed to remove students:', err)
      alert('Failed to remove some students. Please try again.')
    } finally {
      setRemovingStudentId(null)
    }
  }

  const handleExportSelectedStudents = () => {
    const membersList = members || []
    const selectedData = membersList.filter(m => selectedStudents.includes(m.id))
    const csvContent = [
      ['Name', 'Email'].join(','),
      ...selectedData.map(m => [
        m.displayName || 'N/A',
        m.email || 'N/A'
      ].join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `students-${classInfo?.name || 'class'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPDF = async (listId, listTitle) => {
    if (!listId) return
    setGeneratingPDF(listId)
    try {
      console.log('Fetching words for...', listId)
      // Teacher view: Always get full list
      const allWords = await fetchAllWords(listId)
      
      // Add wordIndex if not present
      const wordsWithIndex = allWords.map((w, idx) => ({ 
        ...w, 
        wordIndex: w.wordIndex ?? idx 
      }))
      
      console.log('Fetched words:', wordsWithIndex)
      console.log('Words count:', wordsWithIndex?.length || 0)
      
      if (wordsWithIndex.length === 0) {
        alert('This list has no words to export.')
        setGeneratingPDF(null)
        return
      }
      
      // Normalize words
      const normalizedWords = wordsWithIndex.map((word) => ({
        ...word,
        partOfSpeech: word?.partOfSpeech ?? word?.pos ?? word?.part_of_speech ?? '',
      }))
      
      // Generate PDF with Full List mode
      await downloadListAsPDF(listTitle, normalizedWords, 'full')
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
      <main className="flex min-h-screen items-center justify-center bg-base">
        <LoadingSpinner size="lg" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-base px-4">
        <div className="max-w-md rounded-2xl bg-surface p-8 text-center shadow-lg">
          <p className="text-lg font-semibold text-text-primary">Something went wrong</p>
          <p className="mt-3 text-sm text-text-muted">{error}</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-6 rounded-lg border border-border-default px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-base"
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
    <main className="min-h-screen bg-base px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <HeaderBar />
        <header className="rounded-2xl bg-surface p-8 shadow-lg ring-1 ring-border-default">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-500">
                Class Detail
              </p>
              <div className="relative mt-2">
                {/* Clickable class name */}
                <button
                  type="button"
                  onClick={() => setClassSwitcherOpen(!classSwitcherOpen)}
                  className="flex items-center gap-2 text-3xl font-heading font-bold text-text-primary hover:text-brand-primary transition-colors"
                >
                  {classInfo.name}
                  {allClasses.length > 1 && (
                    <svg 
                      className={`w-5 h-5 text-text-faint transition-transform ${classSwitcherOpen ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>

                {/* Popover */}
                {classSwitcherOpen && allClasses.length > 1 && (
                  <>
                    {/* Backdrop to close */}
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setClassSwitcherOpen(false)} 
                    />
                    
                    {/* Menu */}
                    <div className="absolute top-full left-0 mt-2 z-20 w-72 bg-surface rounded-xl border border-border-default shadow-lg overflow-hidden">
                      <div className="p-2">
                        <p className="px-3 py-2 text-xs font-medium text-text-muted uppercase tracking-wide">
                          Switch Class
                        </p>
                        {allClasses.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              navigate(`/classes/${c.id}`)
                              setClassSwitcherOpen(false)
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              c.id === classId 
                                ? 'bg-brand-primary/10 text-brand-text' 
                                : 'text-text-secondary hover:bg-muted'
                            }`}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <p className="mt-2 text-base text-text-secondary">
                Share the join code for students to enroll.
              </p>
            </div>
            <Button variant="outline" size="md" to="/lists">
              Manage Lists
            </Button>
          </div>
          <div className="mt-6 rounded-xl border border-dashed border-border-strong bg-base px-6 py-4 text-center">
            <p className="text-sm uppercase tracking-wide text-text-muted">Join Code</p>
            <p className="mt-2 text-4xl font-bold tracking-[0.35em] text-text-primary">
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
        <div className="flex gap-2 border-b border-border-default">
          <TabButton active={activeTab === 'lists'} onClick={() => setActiveTab('lists')}>
            Assigned Lists
          </TabButton>
          <TabButton active={activeTab === 'students'} onClick={() => setActiveTab('students')}>
            Students
          </TabButton>
          <TabButton active={activeTab === 'gradebook'} onClick={() => setActiveTab('gradebook')}>
            Gradebook
          </TabButton>
        </div>

        {/* Assigned Lists Tab */}
        {activeTab === 'lists' && (
        <section className="rounded-2xl bg-surface p-6 shadow-md ring-1 ring-border-muted">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Assigned Lists</h2>
              <p className="text-sm text-text-muted">These lists appear in class study plans.</p>
            </div>
            <Button variant="primary-blue" size="md" onClick={() => setAssignModalOpen(true)} disabled={availableLists.length === 0}>
              Assign List
            </Button>
          </div>
          {assignedLists.length ? (
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {assignedLists.map((list) => (
                <li
                  key={list.id}
                  className="rounded-xl border border-border-muted bg-base/60 p-4 transition hover:border-border-default hover:bg-surface"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-text-primary">{list.title}</h3>
                      <p className="mt-1 text-sm text-text-muted line-clamp-2">{list.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold">
                        <span className="uppercase tracking-wide text-text-muted">
                          {list.wordCount ?? 0} words
                        </span>
                        <span className="text-text-muted">|</span>
                        <span className="text-blue-600">Pace: {list.pace ?? 20} words/day</span>
                        <span className="text-text-muted">|</span>
                        <span className="text-emerald-600">
                          Test Options: {list.testOptionsCount ?? 4} choices
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleDownloadPDF(list.id, list.title)
                        }}
                        disabled={generatingPDF === list.id}
                        title="Download PDF"
                      >
                        {generatingPDF === list.id ? (
                          '...'
                        ) : (
                          <>
                            <FileText size={14} />
                            PDF
                          </>
                        )}
                      </Button>
                      <IconButton variant="default" size="sm" onClick={() => openSettingsModal(list)} title="Edit Settings">
                        <Settings size={16} />
                      </IconButton>
                      <IconButton 
                        variant="danger" 
                        size="sm" 
                        onClick={() => handleUnassignList(list.id)}
                        disabled={unassigningListId === list.id}
                        title="Unassign list"
                      >
                        {unassigningListId === list.id ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </IconButton>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-border-strong bg-base p-8 text-center">
              <p className="text-sm text-text-muted">No content assigned.</p>
              <p className="mt-1 text-sm text-text-muted">Click 'Assign List' to start.</p>
            </div>
          )}
        </section>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && (
        <section className="rounded-2xl bg-surface p-6 shadow-md ring-1 ring-border-muted">
          <div className="space-y-4">
            {/* Control bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleSelectAllStudents}
                  disabled={!members || members.length === 0}
                >
                  {selectedStudents.length === members?.length && members?.length > 0 
                    ? 'Uncheck All' 
                    : 'Check All'}
                </Button>
                {selectedStudents.length > 0 && (
                  <span className="text-sm text-text-muted">
                    {selectedStudents.length} selected
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleExportSelectedStudents}
                  disabled={selectedStudents.length === 0}
                >
                  <Download size={16} />
                  Export{selectedStudents.length > 0 ? ` (${selectedStudents.length})` : ''}
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  onClick={handleRemoveSelectedStudents}
                  disabled={selectedStudents.length === 0 || removingStudentId === 'bulk'}
                >
                  {removingStudentId === 'bulk' ? 'Removing...' : `Remove${selectedStudents.length > 0 ? ` (${selectedStudents.length})` : ''}`}
                </Button>
              </div>
            </div>

            {/* Students table */}
            {!members ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            ) : members.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-border-default">
                <table className="w-full text-left text-sm">
                  <thead className="bg-base text-xs uppercase text-text-muted">
                    <tr>
                      <th className="px-4 py-3 w-12">
                        <input
                          type="checkbox"
                          checked={selectedStudents.length === members?.length && members?.length > 0}
                          onChange={handleSelectAllStudents}
                          className="h-4 w-4 rounded border-border-strong text-brand-primary focus:ring-brand-primary"
                        />
                      </th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Joined</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default">
                    {members.map((member) => (
                      <tr 
                        key={member.id} 
                        className={`bg-surface hover:bg-base transition-colors ${
                          selectedStudents.includes(member.id) ? 'bg-accent-blue' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(member.id)}
                            onChange={() => handleSelectStudent(member.id)}
                            className="h-4 w-4 rounded border-border-strong text-brand-primary focus:ring-brand-primary"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-text-primary">
                          {member.displayName || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {member.email || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-text-muted">
                          {member.joinedAt 
                            ? (member.joinedAt?.toDate 
                              ? member.joinedAt.toDate().toLocaleDateString()
                              : new Date(member.joinedAt.seconds ? member.joinedAt.seconds * 1000 : member.joinedAt).toLocaleDateString())
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <LinkButton
                            variant="danger"
                            onClick={() => handleRemoveStudent(member.id)}
                            disabled={removingStudentId === member.id}
                          >
                            {removingStudentId === member.id ? 'Removing...' : 'Remove'}
                          </LinkButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border-strong bg-base p-8 text-center">
                <p className="text-sm text-text-muted">No students enrolled yet.</p>
                <p className="mt-1 text-xs text-text-faint">Share the join code with your students to get started.</p>
                <div className="mt-6 rounded-xl border border-border-strong bg-surface px-6 py-4">
                  <p className="text-xs uppercase tracking-wide text-text-muted">Join Code</p>
                  <div className="mt-3 flex items-center justify-center gap-3">
                    <p className="text-3xl font-bold tracking-[0.35em] text-text-primary">
                      {classInfo?.joinCode || '—'}
                    </p>
                    <Button variant="outline" size="sm" onClick={handleCopyJoinCode}>
                      <Copy size={16} />
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
        )}

        {/* Gradebook Tab */}
        {activeTab === 'gradebook' && (
        <section className="rounded-2xl bg-surface p-6 shadow-md ring-1 ring-border-muted">
          <div className="text-center py-12">
            <p className="font-body text-text-secondary mb-6">
              View all test attempts for this class in the gradebook.
            </p>
            <Link to={`/teacher/gradebook?classId=${classId}`}>
              <Button variant="primary-blue" size="lg">
                <ClipboardList size={20} />
                Open Gradebook
              </Button>
            </Link>
          </div>
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
          <div className="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-text-primary">Edit List Settings</h3>
                <p className="text-sm text-text-muted">
                  Control pacing and test options for "{settingsModalList.title}".
                </p>
              </div>
              <IconButton variant="close" size="sm" onClick={closeSettingsModal} aria-label="Close modal">
                <X size={18} />
              </IconButton>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-text-secondary">
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
                  className="mt-1 w-full rounded-lg border border-border-default bg-base px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
                  placeholder="20"
                />
              </label>
              <label className="block text-sm font-medium text-text-secondary">
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
                  className="mt-1 w-full rounded-lg border border-border-default bg-base px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
                  placeholder="4"
                />
                <p className="mt-1 text-xs text-text-muted">Students will see this many answer choices.</p>
              </label>
              <label className="block text-sm font-medium text-text-secondary">
                Test Mode
                <select
                  value={settingsForm.testMode}
                  onChange={(event) =>
                    setSettingsForm((prev) => ({
                      ...prev,
                      testMode: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-text-primary outline-none ring-border-strong focus:ring-2"
                >
                  <option value="mcq">Multiple Choice Only</option>
                  <option value="typed">Written Only</option>
                  <option value="both">Both</option>
                </select>
                <p className="mt-1 text-xs text-text-muted">Choose how students take tests for this list.</p>
              </label>
              <label className="block text-sm font-medium text-text-secondary">
                Study Days Per Week
                <input
                  type="number"
                  min="1"
                  max="7"
                  value={settingsForm.studyDaysPerWeek}
                  onChange={(event) =>
                    setSettingsForm((prev) => ({
                      ...prev,
                      studyDaysPerWeek: Math.min(7, Math.max(1, parseInt(event.target.value, 10) || 5)),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-border-default bg-base px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
                  placeholder="5"
                />
                <p className="mt-1 text-xs text-text-muted">How many days per week students study (5 = weekdays only).</p>
              </label>
              <label className="block text-sm font-medium text-text-secondary">
                Pass Threshold (%)
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={settingsForm.passThreshold}
                  onChange={(event) =>
                    setSettingsForm((prev) => ({
                      ...prev,
                      passThreshold: Math.min(100, Math.max(50, parseInt(event.target.value, 10) || 95)),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-border-default bg-base px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
                  placeholder="95"
                />
                <p className="mt-1 text-xs text-text-muted">Students must score this % or higher to pass new word tests.</p>
              </label>
              <label className="block text-sm font-medium text-text-secondary">
                New Word Test Size
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={settingsForm.testSizeNew}
                  onChange={(event) =>
                    setSettingsForm((prev) => ({
                      ...prev,
                      testSizeNew: Math.min(100, Math.max(10, parseInt(event.target.value, 10) || 50)),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-border-default bg-base px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
                  placeholder="50"
                />
                <p className="mt-1 text-xs text-text-muted">Max words per new word test (actual count depends on daily pace).</p>
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="outline" size="lg" className="flex-1" onClick={closeSettingsModal} disabled={savingSettings}>
                Cancel
              </Button>
              <Button variant="primary-blue" size="lg" className="flex-1" onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? 'Saving…' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default ClassDetail


