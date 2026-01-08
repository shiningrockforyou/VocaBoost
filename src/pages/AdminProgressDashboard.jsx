import { useState, useEffect, useMemo } from 'react'
import { Download, Edit2, ChevronUp, ChevronDown, Search, X, AlertTriangle } from 'lucide-react'
import * as XLSX from 'xlsx'
import Card from '../components/ui/Card'
import { Button } from '../components/ui/buttons'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import LoadingSpinner from '../components/LoadingSpinner'
import {
  fetchAllAdminData,
  formatProgressForDisplay,
  updateClassProgressAdmin
} from '../services/adminService'

const PAGE_SIZES = [10, 25, 50, 100]

export default function AdminProgressDashboard() {
  // Data state
  const [rawData, setRawData] = useState(null)
  const [displayData, setDisplayData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedList, setSelectedList] = useState('')
  const [showHighIntervention, setShowHighIntervention] = useState(false)

  // Sort state
  const [sortField, setSortField] = useState('studentName')
  const [sortDirection, setSortDirection] = useState('asc')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [showAll, setShowAll] = useState(false)

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  // Fetch data on mount
  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchAllAdminData()
      setRawData(data)
      const formatted = formatProgressForDisplay(
        data.progressRecords,
        data.usersMap,
        data.classesMap,
        data.listsMap,
        data.sessionStatesMap
      )
      setDisplayData(formatted)
    } catch (err) {
      console.error('Error loading admin data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Get unique classes and lists for filter dropdowns
  const { classOptions, listOptions } = useMemo(() => {
    if (!rawData) return { classOptions: [], listOptions: [] }

    const classes = Object.values(rawData.classesMap).map(c => ({
      id: c.id,
      name: c.name || c.id
    }))

    const lists = Object.values(rawData.listsMap).map(l => ({
      id: l.id,
      name: l.name || l.id
    }))

    return {
      classOptions: classes.sort((a, b) => a.name.localeCompare(b.name)),
      listOptions: lists.sort((a, b) => a.name.localeCompare(b.name))
    }
  }, [rawData])

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let result = [...displayData]

    // Apply filters
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(r =>
        r.studentName.toLowerCase().includes(term) ||
        r.studentEmail.toLowerCase().includes(term)
      )
    }

    if (selectedClass) {
      result = result.filter(r => r.classId === selectedClass)
    }

    if (selectedList) {
      result = result.filter(r => r.listId === selectedList)
    }

    if (showHighIntervention) {
      result = result.filter(r => r.interventionLevel >= 0.5)
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]

      // Handle null/undefined values
      if (aVal === null || aVal === undefined) aVal = ''
      if (bVal === null || bVal === undefined) bVal = ''

      // Handle dates
      if (aVal instanceof Date) aVal = aVal.getTime()
      if (bVal instanceof Date) bVal = bVal.getTime()

      // Handle strings
      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [displayData, searchTerm, selectedClass, selectedList, showHighIntervention, sortField, sortDirection])

  // Paginated data
  const paginatedData = useMemo(() => {
    if (showAll) return filteredAndSortedData

    const startIndex = (currentPage - 1) * pageSize
    return filteredAndSortedData.slice(startIndex, startIndex + pageSize)
  }, [filteredAndSortedData, currentPage, pageSize, showAll])

  const totalPages = Math.ceil(filteredAndSortedData.length / pageSize)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedClass, selectedList, showHighIntervention, pageSize])

  // Handle sort
  function handleSort(field) {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Handle edit
  function openEditModal(record) {
    setEditingRecord(record)
    setEditForm({
      currentStudyDay: record.currentStudyDay || 0,
      totalWordsIntroduced: record.totalWordsIntroduced || 0,
      streakDays: record.streakDays || 0,
      interventionLevel: record.interventionLevel || 0,
      avgNewWordScore: record.avgNewWordScore ?? '',
      avgReviewScore: record.avgReviewScore ?? '',
      lastStudyDate: record.lastStudyDate ? formatDateForInput(record.lastStudyDate) : '',
      lastSessionAt: record.lastSessionAt ? formatDateTimeForInput(record.lastSessionAt) : ''
    })
    setEditModalOpen(true)
  }

  function formatDateForInput(date) {
    if (!date) return ''
    const d = date instanceof Date ? date : new Date(date)
    return d.toISOString().split('T')[0]
  }

  function formatDateTimeForInput(date) {
    if (!date) return ''
    const d = date instanceof Date ? date : new Date(date)
    return d.toISOString().slice(0, 16)
  }

  async function handleSaveEdit() {
    if (!editingRecord) return

    try {
      setSaving(true)

      const updates = {
        currentStudyDay: parseInt(editForm.currentStudyDay) || 0,
        totalWordsIntroduced: parseInt(editForm.totalWordsIntroduced) || 0,
        streakDays: parseInt(editForm.streakDays) || 0,
        interventionLevel: parseFloat(editForm.interventionLevel) || 0,
        avgNewWordScore: editForm.avgNewWordScore !== '' ? parseFloat(editForm.avgNewWordScore) : null,
        avgReviewScore: editForm.avgReviewScore !== '' ? parseFloat(editForm.avgReviewScore) : null,
        lastStudyDate: editForm.lastStudyDate || null,
        lastSessionAt: editForm.lastSessionAt || null
      }

      await updateClassProgressAdmin(
        editingRecord.userId,
        editingRecord.classId,
        editingRecord.listId,
        updates
      )

      // Reload data
      await loadData()
      setEditModalOpen(false)
      setEditingRecord(null)
    } catch (err) {
      console.error('Error saving edit:', err)
      alert('Error saving changes: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Export functions
  function exportToCSV() {
    const headers = [
      'Student Name', 'Email', 'Class', 'List', 'Study Day', 'Session Stage', 'Words Introduced',
      'Streak', 'Intervention', 'Avg New Score', 'Avg Review Score', 'Last Study', 'Last Session'
    ]

    const rows = filteredAndSortedData.map(r => [
      r.studentName,
      r.studentEmail,
      r.className,
      r.listName,
      r.currentStudyDay,
      r.sessionPhaseLabel,
      r.totalWordsIntroduced,
      r.streakDays,
      r.interventionLevel,
      r.avgNewWordScore !== null ? (r.avgNewWordScore * 100).toFixed(1) + '%' : '',
      r.avgReviewScore !== null ? (r.avgReviewScore * 100).toFixed(1) + '%' : '',
      r.lastStudyDate ? formatDateForInput(r.lastStudyDate) : '',
      r.lastSessionAt ? formatDateTimeForInput(r.lastSessionAt) : ''
    ])

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    downloadFile(csvContent, 'progress-export.csv', 'text/csv')
  }

  function exportToExcel() {
    const data = filteredAndSortedData.map(r => ({
      'Student Name': r.studentName,
      'Email': r.studentEmail,
      'Class': r.className,
      'List': r.listName,
      'Study Day': r.currentStudyDay,
      'Session Stage': r.sessionPhaseLabel,
      'Words Introduced': r.totalWordsIntroduced,
      'Streak': r.streakDays,
      'Intervention': r.interventionLevel,
      'Avg New Score': r.avgNewWordScore !== null ? r.avgNewWordScore : '',
      'Avg Review Score': r.avgReviewScore !== null ? r.avgReviewScore : '',
      'Last Study': r.lastStudyDate ? formatDateForInput(r.lastStudyDate) : '',
      'Last Session': r.lastSessionAt ? formatDateTimeForInput(r.lastSessionAt) : ''
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Progress')
    XLSX.writeFile(wb, 'progress-export.xlsx')
  }

  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // Format display values
  function formatScore(value) {
    if (value === null || value === undefined) return '-'
    return (value * 100).toFixed(0) + '%'
  }

  function formatDate(date) {
    if (!date) return '-'
    const d = date instanceof Date ? date : new Date(date)
    return d.toLocaleDateString()
  }

  function formatDateTime(date) {
    if (!date) return '-'
    const d = date instanceof Date ? date : new Date(date)
    return d.toLocaleString()
  }

  // Render sort icon
  function SortIcon({ field }) {
    if (sortField !== field) return <ChevronUp className="w-4 h-4 opacity-30" />
    return sortDirection === 'asc'
      ? <ChevronUp className="w-4 h-4" />
      : <ChevronDown className="w-4 h-4" />
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center p-4">
        <Card variant="alert-error" className="max-w-md">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div>
              <p className="font-semibold text-red-800">Error loading data</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={loadData} className="mt-3">
            Retry
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base p-4 md:p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <Card variant="header" size="lg" className="mb-6">
          <h1 className="text-2xl font-heading font-bold text-text-primary">
            Admin: Student Progress Dashboard
          </h1>
          <p className="text-text-secondary mt-1">
            Viewing {filteredAndSortedData.length} progress records
          </p>
        </Card>

        {/* Filters and Export */}
        <Card variant="section" className="mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Search Student
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Class filter */}
            <div className="w-48">
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Class
              </label>
              <Select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                <option value="">All Classes</option>
                {classOptions.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>

            {/* List filter */}
            <div className="w-48">
              <label className="block text-sm font-medium text-text-secondary mb-1">
                List
              </label>
              <Select value={selectedList} onChange={(e) => setSelectedList(e.target.value)}>
                <option value="">All Lists</option>
                {listOptions.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </Select>
            </div>

            {/* High intervention filter */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="highIntervention"
                checked={showHighIntervention}
                onChange={(e) => setShowHighIntervention(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
              />
              <label htmlFor="highIntervention" className="text-sm text-text-secondary">
                Needs Attention
              </label>
            </div>

            {/* Export buttons */}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="w-4 h-4" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportToExcel}>
                <Download className="w-4 h-4" />
                Excel
              </Button>
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card variant="section" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-muted">
                  <SortableHeader field="studentName" label="Student" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                  <SortableHeader field="studentEmail" label="Email" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                  <SortableHeader field="className" label="Class" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                  <SortableHeader field="listName" label="List" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                  <SortableHeader field="currentStudyDay" label="Day" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                  <SortableHeader field="sessionPhase" label="Stage" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                  <SortableHeader field="totalWordsIntroduced" label="Words" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                  <SortableHeader field="streakDays" label="Streak" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                  <SortableHeader field="interventionLevel" label="Intervention" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                  <SortableHeader field="avgNewWordScore" label="Avg New" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                  <SortableHeader field="avgReviewScore" label="Avg Review" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                  <SortableHeader field="lastSessionAt" label="Last Active" onSort={handleSort} currentField={sortField} direction={sortDirection} />
                  <th className="px-3 py-3 text-left font-semibold text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((record, idx) => (
                  <tr
                    key={`${record.userId}-${record.classId}-${record.listId}`}
                    className={`border-b border-border-default hover:bg-muted/50 ${
                      record.interventionLevel >= 0.5 ? 'bg-red-50' : ''
                    }`}
                  >
                    <td className="px-3 py-3 font-medium text-text-primary">{record.studentName}</td>
                    <td className="px-3 py-3 text-text-secondary">{record.studentEmail}</td>
                    <td className="px-3 py-3 text-text-secondary">{record.className}</td>
                    <td className="px-3 py-3 text-text-secondary">{record.listName}</td>
                    <td className="px-3 py-3 text-center">{record.currentStudyDay}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        record.sessionPhase === 'complete' ? 'bg-emerald-100 text-emerald-700' :
                        record.sessionPhase === 'not-started' ? 'bg-slate-100 text-slate-600' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {record.sessionPhaseLabel}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">{record.totalWordsIntroduced}</td>
                    <td className="px-3 py-3 text-center">{record.streakDays}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        record.interventionLevel >= 0.7 ? 'bg-red-100 text-red-700' :
                        record.interventionLevel >= 0.5 ? 'bg-amber-100 text-amber-700' :
                        record.interventionLevel >= 0.3 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {(record.interventionLevel * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">{formatScore(record.avgNewWordScore)}</td>
                    <td className="px-3 py-3 text-center">{formatScore(record.avgReviewScore)}</td>
                    <td className="px-3 py-3 text-text-secondary text-xs">{formatDateTime(record.lastSessionAt)}</td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => openEditModal(record)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 hover:text-brand-primary transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={13} className="px-3 py-8 text-center text-text-secondary">
                      No records found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-4 border-t border-border-default">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary">Rows per page:</span>
                <Select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="w-20"
                  size="sm"
                >
                  {PAGE_SIZES.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </Select>
              </div>
              <Button
                variant={showAll ? 'primary-blue' : 'outline'}
                size="sm"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? 'Paginate' : 'Load All'}
              </Button>
            </div>

            {!showAll && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-text-secondary px-2">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Next
                </Button>
              </div>
            )}

            <span className="text-sm text-text-secondary">
              {showAll
                ? `Showing all ${filteredAndSortedData.length} records`
                : `Showing ${((currentPage - 1) * pageSize) + 1}-${Math.min(currentPage * pageSize, filteredAndSortedData.length)} of ${filteredAndSortedData.length}`
              }
            </span>
          </div>
        </Card>

        {/* Edit Modal */}
        <Modal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title="Edit Progress Record"
          size="lg"
        >
          {editingRecord && (
            <div className="space-y-4">
              {/* Student info (read-only) */}
              <div className="bg-muted rounded-lg p-3">
                <p className="font-medium text-text-primary">{editingRecord.studentName}</p>
                <p className="text-sm text-text-secondary">{editingRecord.studentEmail}</p>
                <p className="text-sm text-text-secondary">
                  {editingRecord.className} / {editingRecord.listName}
                </p>
              </div>

              {/* Editable fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Current Study Day
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={editForm.currentStudyDay}
                    onChange={(e) => setEditForm(f => ({ ...f, currentStudyDay: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Total Words Introduced
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={editForm.totalWordsIntroduced}
                    onChange={(e) => setEditForm(f => ({ ...f, totalWordsIntroduced: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Streak Days
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={editForm.streakDays}
                    onChange={(e) => setEditForm(f => ({ ...f, streakDays: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Intervention Level (0-1)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={editForm.interventionLevel}
                    onChange={(e) => setEditForm(f => ({ ...f, interventionLevel: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Avg New Word Score (0-1)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    placeholder="Leave empty for null"
                    value={editForm.avgNewWordScore}
                    onChange={(e) => setEditForm(f => ({ ...f, avgNewWordScore: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Avg Review Score (0-1)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    placeholder="Leave empty for null"
                    value={editForm.avgReviewScore}
                    onChange={(e) => setEditForm(f => ({ ...f, avgReviewScore: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Last Study Date
                  </label>
                  <Input
                    type="date"
                    value={editForm.lastStudyDate}
                    onChange={(e) => setEditForm(f => ({ ...f, lastStudyDate: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">
                    Last Session At
                  </label>
                  <Input
                    type="datetime-local"
                    value={editForm.lastSessionAt}
                    onChange={(e) => setEditForm(f => ({ ...f, lastSessionAt: e.target.value }))}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setEditModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary-blue"
                  size="md"
                  onClick={handleSaveEdit}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  )
}

// Sortable header component
function SortableHeader({ field, label, onSort, currentField, direction }) {
  const isActive = currentField === field

  return (
    <th
      className="px-3 py-3 text-left font-semibold text-text-secondary cursor-pointer hover:bg-slate-200 select-none"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          direction === 'asc' ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )
        ) : (
          <ChevronUp className="w-4 h-4 opacity-30" />
        )}
      </div>
    </th>
  )
}
