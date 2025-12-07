import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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
import { queryTeacherAttempts, fetchAttemptDetails } from '../services/db'
import LoadingSpinner from '../components/LoadingSpinner.jsx'

const TeacherGradebook = () => {
  const { user, logout } = useAuth()
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
        const result = await queryTeacherAttempts(user.uid, activeTags, null, itemsPerPage)
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
      const result = await queryTeacherAttempts(user.uid, activeTags, lastDoc, itemsPerPage)
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
      const result = await queryTeacherAttempts(user.uid, activeTags, null, itemsPerPage)
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
  const handleRemoveTag = (tagId) => {
    setActiveTags(activeTags.filter((tag) => tag.id !== tagId))
  }

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
          const result = await queryTeacherAttempts(user.uid, activeTags, currentLastDoc, 100)
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
        return 'bg-blue-50 text-blue-700'
      case 'List':
        return 'bg-purple-50 text-purple-700'
      case 'Date':
        return 'bg-amber-50 text-amber-700'
      case 'Name':
        return 'bg-emerald-50 text-emerald-700'
      default:
        return 'bg-slate-50 text-slate-700'
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (err) {
      console.error('Failed to log out', err)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-7xl">
        {/* Global Top Bar */}
        <div className="mb-8 flex items-center justify-between">
          <img src="/logo_vector.svg" alt="VocaBoost" className="w-32 md:w-48 h-auto" />
          <button
            type="button"
            onClick={handleLogout}
            className="h-12 flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Log Out
          </button>
        </div>

        {/* Page Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold text-brand-primary">Gradebook</h1>
            <p className="font-body mt-1 text-base text-slate-500">
              Search and filter student performance across all classes.
            </p>
          </div>
          <Link
            to="/"
            className="h-12 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft size={18} />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        {/* Filter Toolbox */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={20} className="text-slate-500" />
            <h2 className="text-lg font-heading font-bold text-slate-900">Filter Results</h2>
          </div>

          {/* Category Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {['Class', 'List', 'Date', 'Name'].map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`h-10 px-4 rounded-xl border font-medium transition-colors ${
                  activeCategory === category
                    ? 'bg-brand-primary text-white border-brand-primary'
                    : 'border-slate-200 text-slate-600 hover:border-brand-primary hover:text-brand-primary'
                }`}
              >
                {category === 'Class' && <BookOpen size={16} className="inline mr-1.5" />}
                {category === 'List' && <BookOpen size={16} className="inline mr-1.5" />}
                {category === 'Date' && <Calendar size={16} className="inline mr-1.5" />}
                {category === 'Name' && <User size={16} className="inline mr-1.5" />}
                {category}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <div className="mb-4">
            {activeCategory === 'Date' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none ring-slate-300 focus:ring-2 focus:ring-brand-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none ring-slate-300 focus:ring-2 focus:ring-brand-primary"
                  />
                </div>
              </div>
            ) : (
              <div className="relative">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
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
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none ring-slate-300 focus:ring-2 focus:ring-brand-primary"
                />
              </div>
            )}
          </div>

          {/* Add Filter Button */}
          <button
            type="button"
            onClick={handleAddFilter}
            className="h-10 px-4 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accent-hover transition-colors"
          >
            Add Filter
          </button>
        </div>

        {/* Active Tags Display */}
        {activeTags.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {activeTags.map((tag) => (
              <span
                key={tag.id}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${getTagColorClasses(
                  tag.category,
                )}`}
              >
                <span>{tag.category}:</span>
                <span>{tag.label}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag.id)}
                  className="hover:opacity-70 transition-opacity"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Results Table */}
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          {/* Control Bar */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="text-sm font-bold text-slate-500">
              Showing: <span className="text-brand-primary">{attempts.length}</span>
              {hasMore && <span className="text-slate-400">+</span>}
            </div>
            <div className="flex items-center gap-4">
              {/* Rows Per Page Selector */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">Show:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="h-8 px-3 text-sm border border-slate-200 rounded-lg text-slate-600 focus:ring-brand-primary focus:ring-2 focus:border-brand-primary cursor-pointer bg-white"
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
                  className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
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
                  className="h-10 px-4 rounded-xl bg-brand-accent text-white text-sm font-bold hover:bg-brand-accent-hover transition-colors flex items-center gap-2"
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
                onClick={() => {
                  setError('')
                  setLoading(true)
                  fetchAllTeacherAttempts(user?.uid)
                    .then((data) => {
                      setAttempts(data)
                      setLoading(false)
                    })
                    .catch((err) => {
                      setError(err.message ?? 'Unable to load attempts.')
                      setLoading(false)
                    })
                }}
                className="h-10 px-4 rounded-xl bg-brand-primary text-white text-sm font-bold hover:bg-brand-primary/90 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : attempts.length === 0 ? (
            <div className="p-12 text-center">
              {activeTags.length === 0 ? (
                <p className="text-4xl font-heading font-bold text-slate-300">Search for your students' results</p>
              ) : (
                <p className="text-lg font-heading font-bold text-slate-600">Your search returned no results</p>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={paginatedAttempts.length > 0 && paginatedAttempts.every((a) => selectedAttempts.has(a.id))}
                          onChange={handleSelectAll}
                          className="rounded border-slate-300 text-brand-primary focus:ring-2 focus:ring-brand-primary"
                        />
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-heading font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-brand-primary transition-colors"
                        onClick={() => handleSort('class')}
                      >
                        Class {sortColumn === 'class' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-heading font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-brand-primary transition-colors"
                        onClick={() => handleSort('list')}
                      >
                        List {sortColumn === 'list' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-heading font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-brand-primary transition-colors"
                        onClick={() => handleSort('date')}
                      >
                        Date {sortColumn === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-heading font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-brand-primary transition-colors"
                        onClick={() => handleSort('name')}
                      >
                        Name {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-heading font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-brand-primary transition-colors"
                        onClick={() => handleSort('score')}
                      >
                        Score {sortColumn === 'score' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-heading font-bold text-slate-500 uppercase tracking-wider">
                        View
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedAttempts.map((attempt) => (
                      <tr
                        key={attempt.id}
                        className="hover:bg-slate-50 transition-colors"
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
                            className="rounded border-slate-300 text-brand-primary focus:ring-2 focus:ring-brand-primary"
                          />
                        </td>
                        <td className="px-6 py-4 text-sm font-body text-slate-900">{attempt.class}</td>
                        <td className="px-6 py-4 text-sm font-body text-slate-900">{attempt.list}</td>
                        <td className="px-6 py-4 text-sm font-body text-slate-900">{formatDate(attempt.date)}</td>
                        <td className="px-6 py-4 text-sm font-body text-slate-900">{attempt.name}</td>
                        <td className="px-6 py-4">
                          <span className={`text-sm ${getScoreColor(attempt.score)}`}>
                            {attempt.score}% ({attempt.correctAnswers}/{attempt.totalQuestions})
                          </span>
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
                              } catch (err) {
                                console.error('Error fetching details:', err)
                                setAttemptDetails(null)
                              } finally {
                                setDetailsLoading(false)
                              }
                            }}
                            className="text-sm font-semibold text-brand-primary hover:text-brand-accent transition-colors"
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
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={loadPreviousPage}
                  disabled={currentPage === 1 || loading}
                  className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm font-medium text-slate-600">
                  Showing {attempts.length} result{attempts.length !== 1 ? 's' : ''}
                  {hasMore && ' (more available)'}
                </span>
                <button
                  type="button"
                  onClick={loadNextPage}
                  disabled={!hasMore || isLoadingMore || loading}
                  className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            className={`absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-xl overflow-y-auto will-change-transform ${
              drawerClosing 
                ? 'translate-x-full transition-transform duration-300 ease-out' 
                : 'animate-[slideInFromRight_0.3s_ease-out]'
            }`}
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-heading font-bold text-slate-900">Test Details</h2>
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
                className="h-10 w-10 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
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
                  <div className="mb-6 pb-6 border-b border-slate-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Student</p>
                        <p className="text-lg font-heading font-bold text-slate-900">
                          {attemptDetails.name || 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Date</p>
                        <p className="text-lg font-heading font-bold text-slate-900">
                          {attemptDetails.date ? formatDate(attemptDetails.date) : 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">List</p>
                        <p className="text-lg font-heading font-bold text-slate-900">
                          {attemptDetails.list || 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Class</p>
                        <p className="text-lg font-heading font-bold text-slate-900">
                          {attemptDetails.class || 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Score</p>
                      <p className={`text-2xl font-heading font-bold ${getScoreColor(attemptDetails.score || 0)}`}>
                        {attemptDetails.score || 0}% ({attemptDetails.correctAnswers || 0}/{attemptDetails.totalQuestions || 0})
                      </p>
                    </div>
                  </div>

                  {/* Questions List */}
                  <div>
                    <h3 className="text-lg font-heading font-bold text-slate-900 mb-4">Questions</h3>
                    <div className="space-y-4">
                      {attemptDetails.answers && attemptDetails.answers.length > 0 ? (
                        attemptDetails.answers.map((answer, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-slate-200 bg-white p-4"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <p className="text-sm font-medium text-slate-500">Question {idx + 1}</p>
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
                            <p className="text-base font-heading font-bold text-slate-900 mb-2">{answer.word}</p>
                            <div className="space-y-2">
                              <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">Correct Answer</p>
                                <p className="text-sm font-body text-slate-700 bg-slate-50 rounded-lg px-3 py-2">
                                  {answer.correctAnswer}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-slate-500 mb-1">Student Answer</p>
                                <p
                                  className={`text-sm font-body rounded-lg px-3 py-2 ${
                                    answer.isCorrect
                                      ? 'text-emerald-700 bg-emerald-50'
                                      : 'text-red-700 bg-red-50'
                                  }`}
                                >
                                  {answer.studentAnswer}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No answers available</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">Unable to load attempt details</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default TeacherGradebook

