import { useState, useEffect, useRef } from 'react'

/**
 * Multi-select dropdown component
 */
function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Select...',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleOption = (id) => {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id))
    } else {
      onChange([...selected, id])
    }
  }

  const selectAll = () => {
    onChange(options.map(o => o.id))
  }

  const clearAll = () => {
    onChange([])
  }

  const selectedCount = selected.length
  const allSelected = selectedCount === options.length && options.length > 0

  return (
    <div ref={dropdownRef} className="relative">
      <label className="block text-text-secondary text-sm font-medium mb-1">
        {label}
      </label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 rounded-[--radius-input] border border-border-default bg-surface text-text-primary text-left flex items-center justify-between hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-brand-primary"
      >
        <span className={selectedCount === 0 ? 'text-text-muted' : ''}>
          {selectedCount === 0
            ? placeholder
            : allSelected
              ? `All ${options.length} selected`
              : `${selectedCount} selected`
          }
        </span>
        <span className="text-text-muted">▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-surface border border-border-default rounded-[--radius-card] shadow-theme-lg max-h-60 overflow-auto">
          {/* Select/Clear all */}
          <div className="p-2 border-b border-border-default flex gap-2">
            <button
              onClick={selectAll}
              className="text-xs text-brand-primary hover:underline"
            >
              Select All
            </button>
            <button
              onClick={clearAll}
              className="text-xs text-text-muted hover:underline"
            >
              Clear
            </button>
          </div>

          {/* Options */}
          <div className="py-1">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-text-muted text-sm">
                No options available
              </div>
            ) : (
              options.map(option => (
                <label
                  key={option.id}
                  className="flex items-center px-3 py-2 hover:bg-hover cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option.id)}
                    onChange={() => toggleOption(option.id)}
                    className="mr-2 rounded border-border-default"
                  />
                  <span className="text-text-primary text-sm">
                    {option.name}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * FilterBar - Multi-select filters for classes and students
 */
export default function FilterBar({
  classes = [],
  students = [],
  selectedClasses = [],
  selectedStudents = [],
  onClassChange,
  onStudentChange,
  onApply,
}) {
  return (
    <div className="bg-surface rounded-[--radius-card] border border-border-default p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-text-secondary font-medium">Filters:</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Classes filter */}
        <MultiSelectDropdown
          label="Classes"
          options={classes.map(c => ({ id: c.id, name: c.name }))}
          selected={selectedClasses}
          onChange={onClassChange}
          placeholder="Select classes..."
        />

        {/* Students filter */}
        <MultiSelectDropdown
          label="Students"
          options={students.map(s => ({ id: s.id, name: s.name }))}
          selected={selectedStudents}
          onChange={onStudentChange}
          placeholder="Select students..."
        />
      </div>

      {/* Apply button */}
      {onApply && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={onApply}
            className="px-4 py-2 bg-brand-primary text-white rounded-[--radius-button] font-medium hover:opacity-90"
          >
            Apply Filters
          </button>
        </div>
      )}
    </div>
  )
}
