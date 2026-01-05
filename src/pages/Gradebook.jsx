import { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Filter,
  Download,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  X,
  Search,
  Calendar,
  BookOpen,
  User,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { queryTeacherAttempts, fetchAttemptDetails, reviewChallenge, submitChallenge, getAvailableChallengeTokens, fetchClass } from '../services/db'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import HeaderBar from '../components/HeaderBar.jsx'
import { Button, IconButton, TagButton } from '../components/ui'

const Gradebook = ({
  role = 'teacher',
  queryFn = queryTeacherAttempts,
  showNameColumn = true,
  showNameFilter = true,
  showAiReasoning = true,
  challengeMode = 'review',
}) => {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const lockedClassId = searchParams.get('classId')
  const initialStudentName = searchParams.get('studentName')
  const [lockedClassName, setLockedClassName] = useState('')
  const [activeCategory, setActiveCategory] = useState('Class')
  const [filterInput, setFilterInput] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [activeTags, setActiveTags] = useState([])
  const [sortColumn, setSortColumn] = useState('date')
  const [sortDirection, setSortDirection] = useState('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedAttempts, setSelectedAttempts] = useState(new Set())
  const [viewDetailsId, setViewDetailsId] = useState(null)
  const [drawerClosing, setDrawerClosing] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [attemptDetails, setAttemptDetails] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [lastDoc, setLastDoc] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [challengeModal, setChallengeModal] = useState({ isOpen: false, answer: null })
  const [challengeNote, setChallengeNote] = useState('')
  const [isSubmittingChallenge, setIsSubmittingChallenge] = useState(false)
  const [availableTokens, setAvailableTokens] = useState(5)
  const [showTestTypePopup, setShowTestTypePopup] = useState(false)
  const [datePreset, setDatePreset] = useState(null) // 'today', 'yesterday', '7days', '30days', 'custom'
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [tempDateStart, setTempDateStart] = useState(null) // For two-click selection
  const [tempDateEnd, setTempDateEnd] = useState(null)

  // Fetch locked class name when classId is in URL and pre-fill student name filter
  useEffect(() => {
    const loadLockedClass = async () => {
      if (lockedClassId && role === 'teacher') {
        try {
          const classData = await fetchClass(lockedClassId)
          if (classData) {
            setLockedClassName(classData.name || 'Unknown Class')
            // Pre-select the class in filters (only if not already set)
            setActiveTags(prev => {
              const hasClassFilter = prev.some(tag => tag.category === 'Class' && tag.id === `locked_class_${lockedClassId}`)
              if (!hasClassFilter) {
                const classTag = {
                  id: `locked_class_${lockedClassId}`,
                  category: 'Class',
                  value: classData.name || 'Unknown Class',
                  label: classData.name || 'Unknown Class',
                }
                return [classTag, ...prev.filter(tag => tag.category !== 'Class')]
              }
              return prev
            })
          }
        } catch (err) {
          console.error('Error loading locked class:', err)
        }
      } else {
        setLockedClassName('')
      }

      // Pre-fill Name filter if studentName is in URL (for teacher view)
      if (initialStudentName && role === 'teacher') {
        setActiveTags(prev => {
          const hasNameFilter = prev.some(tag => tag.category === 'Name')
          if (!hasNameFilter) {
            const nameTag = {
              id: `name_${Date.now()}`,
              category: 'Name',
              value: initialStudentName,
              label: initialStudentName,
            }
            return [...prev, nameTag]
          }
          return prev
        })
      }
    }
    loadLockedClass()
  }, [lockedClassId, initialStudentName, role])

  // Prevent removing locked class filter
  const handleRemoveTag = (tagId) => {
    if (lockedClassId && tagId === `locked_class_${lockedClassId}`) {
      return // Don't allow removing locked class filter
    }
    setActiveTags(prev => prev.filter(tag => tag.id !== tagId))
  }

  // Date filter handlers
  const handleDatePreset = (preset) => {
    // Toggle behavior: if clicking the same preset, remove the date filter
    if (datePreset === preset) {
      setDatePreset(null)
      setDateStart('')
      setDateEnd('')
      setShowCalendar(false)
      setActiveTags(prev => prev.filter(tag => tag.category !== 'Date'))
      return
    }

    setDatePreset(preset)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    let startDate, endDate
    
    switch (preset) {
      case 'today':
        startDate = today
        endDate = today
        break
      case 'yesterday':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 1)
        endDate = new Date(startDate)
        break
      case '7days':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 6)
        endDate = today
        break
      case '30days':
        startDate = new Date(today)
        startDate.setDate(startDate.getDate() - 29)
        endDate = today
        break
      case 'custom':
        setShowCalendar(true)
        setTempDateStart(null)
        setTempDateEnd(null)
        return
      default:
        return
    }
    
    const formatDate = (d) => d.toISOString().split('T')[0]
    setDateStart(formatDate(startDate))
    setDateEnd(formatDate(endDate))
    setShowCalendar(false)
    
    const label = preset === 'today' ? 'Today' 
      : preset === 'yesterday' ? 'Yesterday'
      : preset === '7days' ? 'Past 7 days'
      : preset === '30days' ? 'Past 30 days'
      : `${formatDate(startDate)} to ${formatDate(endDate)}`
    
    setActiveTags(prev => {
      const filtered = prev.filter(tag => tag.category !== 'Date')
      return [...filtered, {
        id: `date_${Date.now()}`,
        category: 'Date',
        value: { start: formatDate(startDate), end: formatDate(endDate) },
        label,
      }]
    })
  }

  const handleCalendarDayClick = (date) => {
    const formatDate = (d) => d.toISOString().split('T')[0]
    
    if (!tempDateStart || (tempDateStart && tempDateEnd)) {
      setTempDateStart(date)
      setTempDateEnd(null)
    } else {
      let start = tempDateStart
      let end = date
      
      if (start > end) {
        [start, end] = [end, start]
      }
      
      setTempDateStart(start)
      setTempDateEnd(end)
      setDateStart(formatDate(start))
      setDateEnd(formatDate(end))
      
      const label = formatDate(start) === formatDate(end) 
        ? formatDate(start) 
        : `${formatDate(start)} to ${formatDate(end)}`
      
      setActiveTags(prev => {
        const filtered = prev.filter(tag => tag.category !== 'Date')
        return [...filtered, {
          id: `date_${Date.now()}`,
          category: 'Date',
          value: { start: formatDate(start), end: formatDate(end) },
          label,
        }]
      })
      
      setShowCalendar(false)
      setDatePreset('custom')
    }
  }

  const renderCalendar = () => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = firstDay.getDay()
    
    const days = []
    
    for (let i = 0; i < startPadding; i++) {
      days.push(<div key={`pad-${i}`} className="h-8" />)
    }
    
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day)
      date.setHours(0, 0, 0, 0)
      const isSelected = tempDateStart && date.getTime() === tempDateStart.getTime()
      const isEnd = tempDateEnd && date.getTime() === tempDateEnd.getTime()
      const isInRange = tempDateStart && tempDateEnd && date >= tempDateStart && date <= tempDateEnd
      const isToday = new Date().toDateString() === date.toDateString()
      
      days.push(
        <button
          key={day}
          type="button"
          onClick={() => handleCalendarDayClick(date)}
          className={`h-8 w-8 rounded-full text-sm font-medium transition-colors ${
            isSelected || isEnd
              ? 'bg-brand-primary text-white'
              : isInRange
              ? 'bg-blue-100 text-brand-text'
              : isToday
              ? 'border border-brand-primary text-brand-text'
              : 'text-text-secondary hover:bg-muted'
          }`}
        >
          {day}
        </button>
      )
    }
    
    return days
  }

  // Clear custom date filter
  const handleClearCustomDate = () => {
    setDatePreset(null)
    setDateStart('')
    setDateEnd('')
    setShowCalendar(false)
    setTempDateStart(null)
    setTempDateEnd(null)
    setActiveTags(prev => prev.filter(tag => tag.category !== 'Date'))
  }

  // Fetch attempts when filters change
  useEffect(() => {
    const loadAttempts = async () => {
      if (!user?.uid) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')
      setLastDoc(null)
      setSelectedAttempts(new Set())
      setCurrentPage(1)
      
      try {
        const result = await queryFn(user.uid, activeTags, null, itemsPerPage)
        setAttempts(result.attempts)
        setLastDoc(result.lastVisible)
        setHasMore(result.hasMore)
      } catch (err) {
        console.error('Error loading teacher attempts:', err)
        setError(err.message ?? 'Unable to load attempts. Please try again.')
        setAttempts([])
        setLastDoc(null)
        setHasMore(false)
      } finally {
        setLoading(false)
      }
    }

    loadAttempts()
  }, [user?.uid, activeTags, itemsPerPage])

  // Server-side filtering is handled in queryTeacherAttempts
  // No client-side filtering needed
  const filteredAttempts = attempts

  // Sorting
  const sortedAttempts = useMemo(() => {
    const sorted = [...filteredAttempts]
    sorted.sort((a, b) => {
      let aVal, bVal

      switch (sortColumn) {
        case 'class':
          aVal = a.class
          bVal = b.class
          break
        case 'list':
          aVal = a.list
          bVal = b.list
          break
        case 'date':
          // Handle Date objects and Firestore Timestamps
          if (a.date instanceof Date) {
            aVal = a.date.getTime()
          } else if (a.date?.toDate) {
            aVal = a.date.toDate().getTime()
          } else if (a.date?.toMillis) {
            aVal = a.date.toMillis()
          } else {
            aVal = new Date(a.date).getTime()
          }
          
          if (b.date instanceof Date) {
            bVal = b.date.getTime()
          } else if (b.date?.toDate) {
            bVal = b.date.toDate().getTime()
          } else if (b.date?.toMillis) {
            bVal = b.date.toMillis()
          } else {
            bVal = new Date(b.date).getTime()
          }
          break
        case 'name':
          aVal = a.name
          bVal = b.name
          break
        case 'score':
          aVal = a.score
          bVal = b.score
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [filteredAttempts, sortColumn, sortDirection])

  // Reset to page 1 when items per page changes
  useEffect(() => {
    setCurrentPage(1)
  }, [itemsPerPage])

  // Load next page
  const loadNextPage = async () => {
    if (!hasMore || isLoadingMore || !lastDoc || !user?.uid) return

    setIsLoadingMore(true)
    try {
      const result = await queryFn(user.uid, activeTags, lastDoc, itemsPerPage)
      setAttempts((prev) => [...prev, ...result.attempts])
      setLastDoc(result.lastVisible)
      setHasMore(result.hasMore)
      setCurrentPage((prev) => prev + 1)
    } catch (err) {
      console.error('Error loading more attempts:', err)
      setError(err.message ?? 'Unable to load more attempts.')
    } finally {
      setIsLoadingMore(false)
    }
  }

  // Load previous page (reset to beginning)
  const loadPreviousPage = async () => {
    if (currentPage === 1 || !user?.uid) return

    setLoading(true)
    setError('')
    setLastDoc(null)
    setSelectedAttempts(new Set())
    
    try {
      const result = await queryFn(user.uid, activeTags, null, itemsPerPage)
      setAttempts(result.attempts)
      setLastDoc(result.lastVisible)
      setHasMore(result.hasMore)
      setCurrentPage(1)
    } catch (err) {
      console.error('Error loading attempts:', err)
      setError(err.message ?? 'Unable to load attempts.')
      setAttempts([])
      setLastDoc(null)
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  // For display, we show all loaded attempts (no client-side pagination)
  const paginatedAttempts = sortedAttempts

  // Challenge modal helpers
  const openChallengeModal = (answer) => {
    setChallengeModal({ isOpen: true, answer })
  }

  const handleSubmitChallenge = async () => {
    if (!user?.uid || !attemptDetails?.id || !challengeModal.answer?.wordId) return

    setIsSubmittingChallenge(true)
    try {
      await submitChallenge(user.uid, attemptDetails.id, challengeModal.answer.wordId, challengeNote)
      // Refresh attempt details
      const details = await fetchAttemptDetails(attemptDetails.id)
      setAttemptDetails(details)
      setChallengeModal({ isOpen: false, answer: null })
      setChallengeNote('')
    } catch (err) {
      alert(err.message || 'Failed to submit challenge')
    } finally {
      setIsSubmittingChallenge(false)
    }
  }

  // Handle adding filter tag
  const handleAddFilter = () => {
    if (activeTags.length >= 10) {
      alert('Maximum 10 filters allowed')
      return
    }

    if (activeCategory === 'Date') {
      if (!dateStart || !dateEnd) {
        alert('Please select both start and end dates')
        return
      }
      if (new Date(dateStart) > new Date(dateEnd)) {
        alert('Start date must be before end date')
        return
      }
      const newTag = {
        id: `tag_${Date.now()}`,
        category: 'Date',
        value: { start: dateStart, end: dateEnd },
        label: `${new Date(dateStart).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })} - ${new Date(dateEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      }
      setActiveTags([...activeTags, newTag])
      setDateStart('')
      setDateEnd('')
    } else {
      if (!filterInput.trim()) {
        alert('Please enter a value')
        return
      }
      const newTag = {
        id: `tag_${Date.now()}`,
        category: activeCategory,
        value: filterInput.trim(),
        label: filterInput.trim(),
      }
      setActiveTags([...activeTags, newTag])
      setFilterInput('')
    }
  }

  // Handle removing filter tag

  // Handle sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Handle select all
  const handleSelectAll = () => {
    const allCurrentPageSelected = paginatedAttempts.every((a) => selectedAttempts.has(a.id))
    
    if (allCurrentPageSelected) {
      // Uncheck all on current page, but keep selections from other pages
      const newSet = new Set(selectedAttempts)
      paginatedAttempts.forEach((a) => newSet.delete(a.id))
      setSelectedAttempts(newSet)
    } else {
      // Check all on current page, preserving selections from other pages
      const newSet = new Set(selectedAttempts)
      paginatedAttempts.forEach((a) => newSet.add(a.id))
      setSelectedAttempts(newSet)
    }
  }

  // Handle export
  const handleExport = async () => {
    // Determine which data to export
    let exportData
    
    if (selectedAttempts.size > 0) {
      // Export only selected attempts (from currently loaded data)
      exportData = sortedAttempts.filter((a) => selectedAttempts.has(a.id))
    } else {
      // Export ALL matching records (fetch all pages)
      if (!user?.uid) {
        alert('Unable to export: User not found')
        return
      }

      try {
        // Fetch all matching records
        const allAttempts = []
        let currentLastDoc = null
        let hasMoreData = true

        while (hasMoreData) {
          const result = await queryFn(user.uid, activeTags, currentLastDoc, 100)
          allAttempts.push(...result.attempts)
          currentLastDoc = result.lastVisible
          hasMoreData = result.hasMore
        }

        exportData = allAttempts
      } catch (err) {
        console.error('Error fetching all attempts for export:', err)
        alert('Error fetching data for export. Please try again.')
        return
      }
    }

    if (exportData.length === 0) {
      alert('No data to export')
      return
    }

    // Format data for Excel
    const formattedData = exportData.map((attempt) => {
      // Format date
      let dateStr = ''
      if (attempt.date instanceof Date) {
        dateStr = attempt.date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      } else if (attempt.date?.toDate) {
        dateStr = attempt.date.toDate().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      } else if (attempt.date?.toMillis) {
        dateStr = new Date(attempt.date.toMillis()).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      } else {
        dateStr = new Date(attempt.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      }

      return {
        'Date': dateStr,
        'Student Name': attempt.name || '',
        'Class': attempt.class || '',
        'List': attempt.list || '',
        'Type': attempt.testType === 'typed' ? 'Written' : 'Multiple Choice',
        'Session': attempt.sessionType === 'new' ? 'New Words' : attempt.sessionType === 'review' ? 'Review' : '',
        'Day': attempt.studyDay ? `Day ${attempt.studyDay}` : '',
        'Score (%)': attempt.score || 0,
        'Raw Score': `${attempt.correctAnswers || 0} / ${attempt.totalQuestions || 0}`,
        'Total Questions': attempt.totalQuestions || 0,
      }
    })

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(formattedData)

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Append sheet
    XLSX.utils.book_append_sheet(wb, ws, 'Gradebook')

    // Download
    XLSX.writeFile(wb, 'VocaBoost_Gradebook_Export.xlsx')
  }

  // Format date
  const formatDate = (date) => {
    // Handle Firestore Timestamp or Date object
    let dateObj
    if (date instanceof Date) {
      dateObj = date
    } else if (date?.toDate) {
      dateObj = date.toDate()
    } else if (date?.toMillis) {
      dateObj = new Date(date.toMillis())
    } else {
      dateObj = new Date(date)
    }
    
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Get score color
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-600 font-bold'
    if (score >= 60) return 'text-amber-600 font-bold'
    return 'text-red-600 font-bold'
  }

  // Get tag color classes
  const getTagColorClasses = (category) => {
    switch (category) {
      case 'Class':
        return 'bg-accent-blue text-blue-700 dark:text-blue-300'
      case 'List':
        return 'bg-accent-purple text-purple-700 dark:text-purple-300'
      case 'Date':
        return 'bg-accent-amber text-amber-700 dark:text-amber-300'
      case 'Name':
        return 'bg-accent-green text-emerald-700 dark:text-emerald-300'
      default:
        return 'bg-muted text-text-secondary'
    }
  }


  return (
    <main className="min-h-screen bg-base px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <HeaderBar />

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-brand-text">Gradebook</h1>
          <p className="font-body mt-1 text-base text-text-muted">
            Search and filter student performance across all classes.
          </p>
        </div>

        {/* Filter Toolbox */}
        <div className="bg-surface border border-border-default rounded-3xl p-6 shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={20} className="text-text-muted" />
            <h2 className="text-lg font-heading font-bold text-text-primary">Filter Results</h2>
          </div>

          {/* Category Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {!lockedClassId && ['Class', ...(showNameFilter ? ['Name'] : []), 'List', 'Test Type', 'Date'].map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`h-10 px-4 rounded-button border font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95 ${
                  activeCategory === category
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'border-border-default text-text-secondary hover:border-brand-primary hover:text-brand-primary'
                }`}
              >
                {category === 'Class' && <BookOpen size={16} className="inline mr-1.5" />}
                {category === 'List' && <BookOpen size={16} className="inline mr-1.5" />}
                {category === 'Date' && <Calendar size={16} className="inline mr-1.5" />}
                {category === 'Name' && <User size={16} className="inline mr-1.5" />}
                {category === 'Test Type' && <CheckSquare size={16} className="inline mr-1.5" />}
                {category}
              </button>
            ))}
            {lockedClassId && (
              <>
                {[...(showNameFilter ? ['Name'] : []), 'List', 'Test Type', 'Date'].map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`h-10 px-4 rounded-button border font-medium transition-colors ${
                      activeCategory === category
                        ? 'bg-brand-primary text-white border-brand-primary'
                        : 'border-border-default text-text-secondary hover:border-brand-primary hover:text-brand-primary'
                    }`}
                  >
                    {category === 'List' && <BookOpen size={16} className="inline mr-1.5" />}
                    {category === 'Date' && <Calendar size={16} className="inline mr-1.5" />}
                    {category === 'Name' && <User size={16} className="inline mr-1.5" />}
                    {category === 'Test Type' && <CheckSquare size={16} className="inline mr-1.5" />}
                    {category}
                  </button>
                ))}
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                  <span className="text-sm text-text-secondary">Class:</span>
                  <span className="text-sm font-semibold text-text-primary">{lockedClassName || 'Loading...'}</span>
                </div>
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="mb-4">
            {activeCategory === 'Test Type' ? (
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'mcq', label: 'Multiple Choice' },
                  { value: 'typed', label: 'Written' },
                ].map((testType) => {
                  const isActive = activeTags.some(
                    tag => tag.category === 'Test Type' && tag.value === testType.value
                  )
                  return (
                    <TagButton
                      key={testType.value}
                      active={isActive}
                      onClick={() => {
                        if (isActive) {
                          // Remove the filter
                          setActiveTags(prev => prev.filter(
                            tag => !(tag.category === 'Test Type' && tag.value === testType.value)
                          ))
                        } else {
                          // Add the filter
                          setActiveTags(prev => [...prev, {
                            id: `testtype_${testType.value}_${Date.now()}`,
                            category: 'Test Type',
                            value: testType.value,
                            label: testType.label,
                          }])
                        }
                      }}
                    >
                      {testType.label}
                    </TagButton>
                  )
                })}
              </div>
            ) : activeCategory === 'Date' ? (
              <div className="space-y-4">
                {/* Preset Buttons */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'today', label: 'Today' },
                    { value: 'yesterday', label: 'Yesterday' },
                    { value: '7days', label: 'Past 7 days' },
                    { value: '30days', label: 'Past 30 days' },
                    { value: 'custom', label: 'Custom' },
                  ].map((preset) => (
                    <TagButton
                      key={preset.value}
                      active={datePreset === preset.value}
                      onClick={() => handleDatePreset(preset.value)}
                    >
                      {preset.label}
                    </TagButton>
                  ))}
                </div>
                
                {/* Calendar Popup */}
                {showCalendar && (
                  <div className="bg-surface border border-border-default rounded-xl p-4 shadow-lg max-w-xs">
                    {/* Calendar Header */}
                    <div className="flex items-center justify-between mb-4">
                      <button
                        type="button"
                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                        className="p-1 rounded hover:bg-muted"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <span className="font-semibold text-text-primary">
                        {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                        className="p-1 rounded hover:bg-muted"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                    
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                        <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-text-muted">
                          {day}
                        </div>
                      ))}
                    </div>
                    
                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-1">
                      {renderCalendar()}
                    </div>
                    
                    {/* Selection Hint */}
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs text-text-muted">
                        {!tempDateStart 
                          ? 'Click to select start date'
                          : !tempDateEnd 
                          ? 'Click to select end date'
                          : 'Click a day to start new selection'}
                      </p>
                      {(tempDateStart || dateStart) && (
                        <button
                          type="button"
                          onClick={handleClearCustomDate}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Selected Range Display */}
                {dateStart && dateEnd && !showCalendar && (
                  <p className="text-sm text-text-secondary">
                    Selected: <span className="font-semibold">{dateStart}</span> to <span className="font-semibold">{dateEnd}</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="relative">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-faint" />
                <input
                  type="text"
                  value={filterInput}
                  onChange={(e) => setFilterInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddFilter()
                    }
                  }}
                  placeholder={`Search by ${activeCategory.toLowerCase()}...`}
                  className="h-12 w-full rounded-xl border border-border-default bg-surface pl-12 pr-4 text-sm text-text-primary outline-none ring-border-strong focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            )}
          </div>

          {/* Add Filter Button - hide for Date and Test Type since they auto-add */}
          {activeCategory !== 'Date' && activeCategory !== 'Test Type' && (
            <Button
              variant="primary"
              size="md"
              onClick={handleAddFilter}
            >
              Add Filter
            </Button>
          )}

          {/* Active Tags Display */}
          {activeTags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {activeTags.map((tag) => {
                const isLockedClass = lockedClassId && tag.id === `locked_class_${lockedClassId}`
                return (
                  <span
                    key={tag.id}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${getTagColorClasses(
                      tag.category,
                    )}`}
                  >
                    <span>{tag.category}:</span>
                    <span>{tag.label}</span>
                    {!isLockedClass && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag.id)}
                        className="hover:opacity-70 transition-opacity"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* Results Table */}
        <div className="bg-surface border border-border-default rounded-3xl shadow-sm overflow-hidden">
          {/* Control Bar */}
          <div className="px-6 py-4 border-b border-border-default flex items-center justify-between">
            <div className="text-sm font-bold text-text-muted">
              Showing: <span className="text-brand-text">{attempts.length}</span>
              {hasMore && <span className="text-text-faint">+</span>}
            </div>
            <div className="flex items-center gap-4">
              {/* Rows Per Page Selector */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-text-secondary">Show:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="h-8 px-3 text-sm border border-border-default rounded-button text-text-secondary focus:ring-brand-primary focus:ring-2 focus:border-brand-primary cursor-pointer bg-surface"
                >
                  <option value={10}>10</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="h-10 px-3 rounded-button border border-border-default bg-surface text-sm font-medium text-text-secondary hover:bg-base transition-colors flex items-center gap-2"
                >
                  {paginatedAttempts.length > 0 && paginatedAttempts.every((a) => selectedAttempts.has(a.id)) ? (
                    <CheckSquare size={16} />
                  ) : (
                    <Square size={16} />
                  )}
                  {paginatedAttempts.length > 0 && paginatedAttempts.every((a) => selectedAttempts.has(a.id))
                    ? 'Uncheck All'
                    : 'Check All'}
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="h-10 px-4 rounded-button bg-brand-accent text-white text-sm font-bold hover:bg-brand-accent-hover transition-colors flex items-center gap-2"
                >
                  <Download size={16} />
                  Export ({selectedAttempts.size > 0 ? selectedAttempts.size : 'All'})
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="p-12 flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <p className="text-lg font-heading font-bold text-red-600 mb-4">{error}</p>
              <button
                type="button"
                onClick={async () => {
                  setError('')
                  setLoading(true)
                  try {
                    const result = await queryFn(user.uid, activeTags, null, itemsPerPage)
                    setAttempts(result.attempts)
                    setLastDoc(result.lastVisible)
                    setHasMore(result.hasMore)
                  } catch (err) {
                    setError(err.message ?? 'Unable to load attempts.')
                  } finally {
                    setLoading(false)
                  }
                }}
                className="h-10 px-4 rounded-button bg-brand-primary text-white text-sm font-bold hover:bg-brand-primary/90 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : attempts.length === 0 ? (
            <div className="p-12 text-center">
              {activeTags.length === 0 ? (
                <p className="text-4xl font-heading font-bold text-text-faint">Search for your students' results</p>
              ) : (
                <p className="text-lg font-heading font-bold text-text-secondary">Your search returned no results</p>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-base border-b border-border-default">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={paginatedAttempts.length > 0 && paginatedAttempts.every((a) => selectedAttempts.has(a.id))}
                          onChange={handleSelectAll}
                          className="rounded border-border-strong text-brand-primary focus:ring-2 focus:ring-brand-primary"
                        />
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-heading font-bold text-text-muted uppercase tracking-wider cursor-pointer hover:text-brand-primary transition-colors"
                        onClick={() => handleSort('class')}
                      >
                        Class {sortColumn === 'class' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-heading font-bold text-text-muted uppercase tracking-wider cursor-pointer hover:text-brand-primary transition-colors"
                        onClick={() => handleSort('list')}
                      >
                        List {sortColumn === 'list' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-heading font-bold text-text-muted uppercase tracking-wider cursor-pointer hover:text-brand-primary transition-colors"
                        onClick={() => handleSort('date')}
                      >
                        Date {sortColumn === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      {showNameColumn && (
                        <th
                          className="px-6 py-3 text-left text-xs font-heading font-bold text-text-muted uppercase tracking-wider cursor-pointer hover:text-brand-primary transition-colors"
                          onClick={() => handleSort('name')}
                        >
                          Name {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                      )}
                      <th
                        className="px-6 py-3 text-left text-xs font-heading font-bold text-text-muted uppercase tracking-wider cursor-pointer hover:text-brand-primary transition-colors"
                        onClick={() => handleSort('score')}
                      >
                        Score {sortColumn === 'score' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-heading font-bold text-text-muted uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-heading font-bold text-text-muted uppercase tracking-wider">
                        Session
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-heading font-bold text-text-muted uppercase tracking-wider">
                        Day
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-heading font-bold text-text-muted uppercase tracking-wider">
                        View
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedAttempts.map((attempt) => (
                      <tr
                        key={attempt.id}
                        className="hover:bg-base transition-colors"
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedAttempts.has(attempt.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedAttempts)
                              if (e.target.checked) {
                                newSet.add(attempt.id)
                              } else {
                                newSet.delete(attempt.id)
                              }
                              setSelectedAttempts(newSet)
                            }}
                            className="rounded border-border-strong text-brand-primary focus:ring-2 focus:ring-brand-primary"
                          />
                        </td>
                        <td className="px-6 py-4 text-sm font-body text-text-primary">{attempt.class}</td>
                        <td className="px-6 py-4 text-sm font-body text-text-primary">{attempt.list}</td>
                        <td className="px-6 py-4 text-sm font-body text-text-primary">{formatDate(attempt.date)}</td>
                        {showNameColumn && (
                          <td className="px-6 py-4 text-sm font-body text-text-primary">{attempt.name}</td>
                        )}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${getScoreColor(attempt.score)}`}>
                              {attempt.score}% ({attempt.correctAnswers}/{attempt.totalQuestions})
                            </span>
                            {attempt.answers?.some((a) => a.challengeStatus === 'pending') && (
                              <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-semibold">
                                Pending Challenge
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              attempt.testType === 'typed'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {attempt.testType === 'typed' ? 'Written' : 'Multiple Choice'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              attempt.sessionType === 'new'
                                ? 'bg-green-100 text-green-700'
                                : attempt.sessionType === 'review'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {attempt.sessionType === 'new' ? 'New Words' : attempt.sessionType === 'review' ? 'Review' : '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-body text-text-primary">
                          {attempt.studyDay ? `Day ${attempt.studyDay}` : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={async () => {
                              setDrawerClosing(false)
                              setViewDetailsId(attempt.id)
                              setDetailsLoading(true)
                              setAttemptDetails(null)
                              try {
                                const details = await fetchAttemptDetails(attempt.id)
                                setAttemptDetails(details)
                                
                                // Fetch challenge tokens if student mode
                                if (challengeMode === 'submit' && user?.uid) {
                                  try {
                                    const userDoc = await getDoc(doc(db, 'users', user.uid))
                                    const challengeHistory = userDoc.data()?.challenges?.history || []
                                    setAvailableTokens(getAvailableChallengeTokens(challengeHistory))
                                  } catch (err) {
                                    console.error('Error fetching challenge tokens:', err)
                                  }
                                }
                              } catch (err) {
                                console.error('Error fetching details:', err)
                                setAttemptDetails(null)
                              } finally {
                                setDetailsLoading(false)
                              }
                            }}
                            className="text-sm font-semibold text-brand-text hover:text-brand-accent transition-colors"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-6 py-4 border-t border-border-default flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={loadPreviousPage}
                  disabled={currentPage === 1 || loading}
                  className="h-10 w-10 flex items-center justify-center rounded-button border border-border-default bg-surface text-text-secondary hover:bg-base disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm font-medium text-text-secondary">
                  Showing {attempts.length} result{attempts.length !== 1 ? 's' : ''}
                  {hasMore && ' (more available)'}
                </span>
                <button
                  type="button"
                  onClick={loadNextPage}
                  disabled={!hasMore || isLoadingMore || loading}
                  className="h-10 w-10 flex items-center justify-center rounded-button border border-border-default bg-surface text-text-secondary hover:bg-base disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoadingMore ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <ChevronRight size={18} />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* View Details Modal/Drawer */}
      {(viewDetailsId || drawerClosing) && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-black/50 ${
              drawerClosing ? 'opacity-0 transition-opacity duration-300' : 'opacity-100'
            }`}
            onClick={() => {
              setDrawerClosing(true)
              setTimeout(() => {
                setViewDetailsId(null)
                setDrawerClosing(false)
              }, 300)
            }}
          />
          {/* Drawer */}
          <div
            key={viewDetailsId} // Force remount for fresh animation each time
            className={`absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-surface shadow-xl overflow-y-auto will-change-transform ${
              drawerClosing 
                ? 'translate-x-full transition-transform duration-300 ease-out' 
                : 'animate-[slideInFromRight_0.3s_ease-out]'
            }`}
          >
            <div className="sticky top-0 bg-surface border-b border-border-default px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-heading font-bold text-text-primary">Test Details</h2>
              <button
                type="button"
                onClick={() => {
                  setDrawerClosing(true)
                  setTimeout(() => {
                    setViewDetailsId(null)
                    setDrawerClosing(false)
                    setAttemptDetails(null)
                  }, 300)
                }}
                className="h-10 w-10 flex items-center justify-center rounded-lg text-text-faint hover:bg-muted hover:text-text-secondary transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              {detailsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : attemptDetails ? (
                <>
                  {/* Header Info */}
                  <div className="mb-6 pb-6 border-b border-border-default">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Student</p>
                        <p className="text-lg font-heading font-bold text-text-primary">
                          {attemptDetails.name || 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Date</p>
                        <p className="text-lg font-heading font-bold text-text-primary">
                          {attemptDetails.date ? formatDate(attemptDetails.date) : 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">List</p>
                        <p className="text-lg font-heading font-bold text-text-primary">
                          {attemptDetails.list || 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Class</p>
                        <p className="text-lg font-heading font-bold text-text-primary">
                          {attemptDetails.class || 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Score</p>
                      <p className={`text-2xl font-heading font-bold ${getScoreColor(attemptDetails.score || 0)}`}>
                        {attemptDetails.score || 0}% ({attemptDetails.correctAnswers || 0}/{attemptDetails.totalQuestions || 0})
                      </p>
                    </div>
                  </div>

                  {/* Challenge Tokens Display (Student Mode) */}
                  {challengeMode === 'submit' && (
                    <div className="mb-4 p-3 bg-muted rounded-lg">
                      <p className="text-sm text-text-secondary">
                        Challenge Tokens: <span className="font-bold text-text-primary">{availableTokens}/5</span> remaining
                      </p>
                    </div>
                  )}

                  {/* Questions List */}
                  <div>
                    <h3 className="text-lg font-heading font-bold text-text-primary mb-4">Questions</h3>
                    <div className="space-y-4">
                      {attemptDetails.answers && attemptDetails.answers.length > 0 ? (
                        attemptDetails.answers.map((answer, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-border-default bg-surface p-4"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <p className="text-sm font-medium text-text-muted">Question {idx + 1}</p>
                              {answer.isCorrect ? (
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                  Correct
                                </span>
                              ) : (
                                <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">
                                  Incorrect
                                </span>
                              )}
                            </div>
                            <p className="text-base font-heading font-bold text-text-primary mb-2">{answer.word}</p>
                            <div className="space-y-2">
                              <div>
                                <p className="text-xs font-medium text-text-muted mb-1">Correct Answer</p>
                                <p className="text-sm font-body text-text-secondary bg-base rounded-lg px-3 py-2">
                                  {answer.correctAnswer}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-text-muted mb-1">Student Answer</p>
                                <p
                                  className={`text-sm font-body rounded-lg px-3 py-2 ${
                                    answer.isCorrect
                                      ? 'text-emerald-700 bg-emerald-50'
                                      : 'text-red-700 bg-red-50'
                                  }`}
                                >
                                  {answer.studentAnswer || answer.studentResponse || '(no answer)'}
                                </p>
                              </div>
                              {/* AI Reasoning for typed tests */}
                              {showAiReasoning && attemptDetails.testType === 'typed' && answer.aiReasoning && (
                                <div>
                                  <p className="text-xs font-medium text-text-muted mb-1">AI Reasoning</p>
                                  <p className="text-sm font-body text-text-secondary bg-base rounded-lg px-3 py-2">
                                    {answer.aiReasoning}
                                  </p>
                                </div>
                              )}
                              {/* Challenge Status */}
                              {challengeMode === 'review' && answer.challengeStatus === 'pending' && (
                                <div className="mt-2">
                                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                    <p className="text-sm font-semibold text-amber-900 mb-2">Challenge Pending</p>
                                    {answer.challengeNote && (
                                      <p className="text-sm text-amber-800 mb-3">
                                        <span className="font-medium">Student note:</span> {answer.challengeNote}
                                      </p>
                                    )}
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await reviewChallenge(user.uid, attemptDetails.id, answer.wordId, true)
                                            // Refresh attempt details
                                            const details = await fetchAttemptDetails(attemptDetails.id)
                                            setAttemptDetails(details)
                                          } catch (err) {
                                            alert(err.message || 'Failed to review challenge')
                                          }
                                        }}
                                        className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 transition"
                                      >
                                        Accept ✓
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await reviewChallenge(user.uid, attemptDetails.id, answer.wordId, false)
                                            // Refresh attempt details
                                            const details = await fetchAttemptDetails(attemptDetails.id)
                                            setAttemptDetails(details)
                                          } catch (err) {
                                            alert(err.message || 'Failed to review challenge')
                                          }
                                        }}
                                        className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 transition"
                                      >
                                        Reject ✗
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {challengeMode === 'review' && answer.challengeStatus === 'accepted' && (
                                <div className="mt-2">
                                  <span className="inline-block text-sm font-semibold text-green-600 bg-green-50 px-2 py-1 rounded">
                                    Challenge accepted
                                  </span>
                                </div>
                              )}
                              {challengeMode === 'review' && answer.challengeStatus === 'rejected' && (
                                <div className="mt-2">
                                  <span className="inline-block text-sm font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">
                                    Challenge rejected
                                  </span>
                                </div>
                              )}
                              {/* Student challenge UI */}
                              {challengeMode === 'submit' && !answer.isCorrect && (
                                <div className="mt-2">
                                  {answer.challengeStatus === 'pending' && (
                                    <span className="inline-block text-sm font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                      Challenge Pending
                                    </span>
                                  )}
                                  {answer.challengeStatus === 'accepted' && (
                                    <span className="inline-block text-sm font-semibold text-green-600 bg-green-50 px-2 py-1 rounded">
                                      Challenge Accepted ✓
                                    </span>
                                  )}
                                  {answer.challengeStatus === 'rejected' && (
                                    <span className="inline-block text-sm font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">
                                      Challenge Rejected ✗
                                    </span>
                                  )}
                                  {!answer.challengeStatus && availableTokens > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => openChallengeModal(answer)}
                                      className="text-sm font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded transition"
                                    >
                                      Challenge
                                    </button>
                                  )}
                                  {!answer.challengeStatus && availableTokens === 0 && (
                                    <span className="text-sm text-text-faint">No tokens available</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-text-muted">No answers available</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-text-muted">Unable to load attempt details</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Challenge Modal for Students */}
      {challengeMode === 'submit' && challengeModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-text-primary">
                Challenge: &quot;{challengeModal.answer?.word}&quot;
              </h3>
              <IconButton 
                variant="close" 
                size="sm" 
                onClick={() => {
                  setChallengeModal({ isOpen: false, answer: null })
                  setChallengeNote('')
                }}
                aria-label="Close modal"
              >
                <X size={18} />
              </IconButton>
            </div>
            <div className="space-y-2 mb-4">
              <p className="text-sm text-text-secondary">
                <span className="font-medium">Your answer:</span>{' '}
                {challengeModal.answer?.studentAnswer ||
                  challengeModal.answer?.studentResponse ||
                  '(no answer)'}
              </p>
              <p className="text-sm text-text-secondary">
                <span className="font-medium">Correct answer:</span> {challengeModal.answer?.correctAnswer}
              </p>
            </div>

            <label className="block text-sm font-medium text-text-secondary mb-1">
              Why should this be marked correct? (optional)
            </label>
            <textarea
              value={challengeNote}
              onChange={(e) => setChallengeNote(e.target.value)}
              className="w-full border border-border-strong rounded-lg p-3 mb-4 text-sm"
              rows={3}
              placeholder="Explain why your answer is correct..."
            />

            <p className="text-amber-600 text-sm mb-4">
              ⚠️ If rejected, you lose 1 token for 30 days
            </p>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                size="lg" 
                className="flex-1" 
                onClick={() => {
                  setChallengeModal({ isOpen: false, answer: null })
                  setChallengeNote('')
                }}
                disabled={isSubmittingChallenge}
              >
                Cancel
              </Button>
              <Button 
                variant="primary-blue" 
                size="lg" 
                className="flex-1" 
                onClick={handleSubmitChallenge}
                disabled={isSubmittingChallenge}
              >
                {isSubmittingChallenge ? 'Submitting...' : 'Submit Challenge'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Gradebook

