import { useState } from 'react'
import { HIGHLIGHT_COLORS } from '../../hooks/useAnnotations'

/**
 * Color picker dropdown for highlighting
 */
function HighlightDropdown({ currentColor, onColorChange, isOpen, onToggle }) {
  const colors = Object.keys(HIGHLIGHT_COLORS)

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`
          px-3 py-1.5 rounded-[--radius-button] text-sm flex items-center gap-2 transition-colors
          ${isOpen
            ? 'bg-brand-primary text-white'
            : 'bg-surface border border-border-default text-text-secondary hover:bg-hover'
          }
        `}
        title="Highlight tool"
      >
        <span className={`w-4 h-4 rounded ${HIGHLIGHT_COLORS[currentColor]}`} />
        <span className="hidden sm:inline">Highlight</span>
        <span className="text-xs">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-surface rounded-[--radius-card] shadow-theme-lg border border-border-default p-2 z-50">
          <p className="text-text-muted text-xs mb-2 px-1">Select text to highlight</p>
          <div className="flex gap-1">
            {colors.map(color => (
              <button
                key={color}
                onClick={() => {
                  onColorChange(color)
                  onToggle()
                }}
                className={`
                  w-8 h-8 rounded-[--radius-button-sm] border-2 transition-transform hover:scale-110
                  ${HIGHLIGHT_COLORS[color]}
                  ${currentColor === color ? 'border-brand-primary' : 'border-transparent'}
                `}
                title={color.charAt(0).toUpperCase() + color.slice(1)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * ToolsToolbar - Floating toolbar for annotation tools
 *
 * Provides controls for:
 * - Highlighter color selection
 * - Line reader toggle
 * - Clear all annotations
 *
 * Props:
 * - highlightColor: Current highlight color
 * - onHighlightColorChange: Callback when color changes
 * - lineReaderEnabled: Whether line reader is on
 * - onLineReaderToggle: Callback to toggle line reader
 * - lineReaderLines: Number of visible lines (1-3)
 * - onLineReaderLinesChange: Callback to change visible lines
 * - onClearAll: Callback to clear all annotations
 * - disabled: Whether tools are disabled
 */
export default function ToolsToolbar({
  highlightColor = 'yellow',
  onHighlightColorChange,
  lineReaderEnabled = false,
  onLineReaderToggle,
  lineReaderLines = 2,
  onLineReaderLinesChange,
  onClearAll,
  disabled = false,
}) {
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)
  const [showConfirmClear, setShowConfirmClear] = useState(false)

  const handleClearAll = () => {
    if (showConfirmClear) {
      onClearAll?.()
      setShowConfirmClear(false)
    } else {
      setShowConfirmClear(true)
      // Auto-reset confirm state after 3 seconds
      setTimeout(() => setShowConfirmClear(false), 3000)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Highlight tool */}
      <HighlightDropdown
        currentColor={highlightColor}
        onColorChange={onHighlightColorChange}
        isOpen={showHighlightPicker}
        onToggle={() => setShowHighlightPicker(!showHighlightPicker)}
      />

      {/* Line reader toggle */}
      <button
        onClick={onLineReaderToggle}
        disabled={disabled}
        className={`
          px-3 py-1.5 rounded-[--radius-button] text-sm flex items-center gap-2 transition-colors
          ${lineReaderEnabled
            ? 'bg-brand-primary text-white'
            : 'bg-surface border border-border-default text-text-secondary hover:bg-hover'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        title={lineReaderEnabled ? 'Disable line reader' : 'Enable line reader'}
      >
        <span>📖</span>
        <span className="hidden sm:inline">Reader</span>
      </button>

      {/* Line reader options (when enabled) */}
      {lineReaderEnabled && (
        <select
          value={lineReaderLines}
          onChange={(e) => onLineReaderLinesChange?.(Number(e.target.value))}
          disabled={disabled}
          className="px-2 py-1.5 rounded-[--radius-input] border border-border-default bg-surface text-text-primary text-sm"
          title="Visible lines"
        >
          <option value={1}>1 line</option>
          <option value={2}>2 lines</option>
          <option value={3}>3 lines</option>
        </select>
      )}

      {/* Divider */}
      <div className="w-px h-6 bg-border-default hidden sm:block" />

      {/* Clear all button */}
      <button
        onClick={handleClearAll}
        disabled={disabled}
        className={`
          px-3 py-1.5 rounded-[--radius-button] text-sm flex items-center gap-2 transition-colors
          ${showConfirmClear
            ? 'bg-error text-white'
            : 'bg-surface border border-border-default text-text-muted hover:text-error-text hover:border-error-ring'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        title={showConfirmClear ? 'Click again to confirm' : 'Clear all annotations'}
      >
        <span>🗑️</span>
        <span className="hidden sm:inline">
          {showConfirmClear ? 'Confirm?' : 'Clear'}
        </span>
      </button>

      {/* Keyboard hint */}
      {lineReaderEnabled && (
        <span className="text-text-muted text-xs hidden md:inline">
          Use ↑↓ keys to navigate
        </span>
      )}
    </div>
  )
}
