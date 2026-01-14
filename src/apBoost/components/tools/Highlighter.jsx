import { useState, useRef, useCallback, useEffect } from 'react'
import { HIGHLIGHT_COLORS } from '../../hooks/useAnnotations'

/**
 * Color picker popup for highlight colors
 */
function ColorPicker({ position, onSelect, onClose }) {
  const colors = Object.keys(HIGHLIGHT_COLORS)

  return (
    <div
      className="absolute z-50 bg-surface rounded-[--radius-card] shadow-theme-lg border border-border-default p-2 flex gap-1"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {colors.map(color => (
        <button
          key={color}
          onClick={() => onSelect(color)}
          className={`w-6 h-6 rounded-[--radius-button-sm] border border-border-default hover:scale-110 transition-transform ${HIGHLIGHT_COLORS[color]}`}
          title={color.charAt(0).toUpperCase() + color.slice(1)}
        />
      ))}
      <button
        onClick={onClose}
        className="w-6 h-6 rounded-[--radius-button-sm] border border-border-default bg-surface hover:bg-hover text-text-muted text-xs"
        title="Cancel"
      >
        ✕
      </button>
    </div>
  )
}

/**
 * Render text with highlights applied
 */
function HighlightedText({ content, highlights, onHighlightClick }) {
  if (!highlights || highlights.length === 0) {
    return <span>{content}</span>
  }

  // Sort highlights by start position
  const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start)

  // Build segments
  const segments = []
  let lastEnd = 0

  sortedHighlights.forEach((highlight, idx) => {
    // Add non-highlighted text before this highlight
    if (highlight.start > lastEnd) {
      segments.push({
        type: 'normal',
        text: content.slice(lastEnd, highlight.start),
      })
    }

    // Add highlighted text
    segments.push({
      type: 'highlight',
      text: content.slice(highlight.start, highlight.end),
      color: highlight.color,
      index: idx,
    })

    lastEnd = Math.max(lastEnd, highlight.end)
  })

  // Add remaining text
  if (lastEnd < content.length) {
    segments.push({
      type: 'normal',
      text: content.slice(lastEnd),
    })
  }

  return (
    <>
      {segments.map((segment, idx) => {
        if (segment.type === 'highlight') {
          return (
            <span
              key={idx}
              className={`${HIGHLIGHT_COLORS[segment.color] || HIGHLIGHT_COLORS.yellow} cursor-pointer hover:opacity-70 transition-opacity`}
              onClick={(e) => {
                e.stopPropagation()
                onHighlightClick(segment.index)
              }}
              title="Click to remove highlight"
            >
              {segment.text}
            </span>
          )
        }
        return <span key={idx}>{segment.text}</span>
      })}
    </>
  )
}

/**
 * Highlighter - Text highlighting component for stimulus/passages
 *
 * Usage:
 * <Highlighter
 *   content={stimulus.content}
 *   highlights={highlights}
 *   onHighlight={(range, color) => addHighlight(questionId, range, color)}
 *   onRemove={(index) => removeHighlight(questionId, index)}
 *   disabled={false}
 * />
 */
export default function Highlighter({
  content,
  highlights = [],
  onHighlight,
  onRemove,
  disabled = false,
  className = '',
}) {
  const containerRef = useRef(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [colorPickerPosition, setColorPickerPosition] = useState({ x: 0, y: 0 })
  const [pendingRange, setPendingRange] = useState(null)

  // Handle text selection
  const handleMouseUp = useCallback(() => {
    if (disabled) return

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    const selectedText = selection.toString()
    if (!selectedText.trim()) return

    const range = selection.getRangeAt(0)
    const container = containerRef.current

    if (!container || !container.contains(range.commonAncestorContainer)) return

    // Calculate character offsets
    // This is simplified - for complex HTML, you'd need more sophisticated offset calculation
    const fullText = container.textContent || ''
    const selectionText = selection.toString()

    // Find start position by searching for the selected text
    let startOffset = -1
    const rangePreText = range.startContainer.textContent?.slice(0, range.startOffset) || ''

    // Walk through text nodes to find offset
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
    let currentOffset = 0
    let node

    while ((node = walker.nextNode())) {
      if (node === range.startContainer) {
        startOffset = currentOffset + range.startOffset
        break
      }
      currentOffset += node.textContent?.length || 0
    }

    if (startOffset === -1) return

    const endOffset = startOffset + selectionText.length

    // Get position for color picker
    const rect = range.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()

    setColorPickerPosition({
      x: Math.min(rect.left - containerRect.left, containerRect.width - 150),
      y: rect.bottom - containerRect.top + 5,
    })

    setPendingRange({ start: startOffset, end: endOffset })
    setShowColorPicker(true)

    // Clear selection
    selection.removeAllRanges()
  }, [disabled])

  // Handle color selection
  const handleColorSelect = useCallback((color) => {
    if (pendingRange && onHighlight) {
      onHighlight(pendingRange, color)
    }
    setShowColorPicker(false)
    setPendingRange(null)
  }, [pendingRange, onHighlight])

  // Handle highlight click (remove)
  const handleHighlightClick = useCallback((index) => {
    if (disabled) return
    if (onRemove) {
      onRemove(index)
    }
  }, [disabled, onRemove])

  // Close color picker on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showColorPicker && containerRef.current && !containerRef.current.contains(e.target)) {
        setShowColorPicker(false)
        setPendingRange(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showColorPicker])

  // Close color picker on escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showColorPicker) {
        setShowColorPicker(false)
        setPendingRange(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showColorPicker])

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onMouseUp={handleMouseUp}
    >
      <div className="whitespace-pre-wrap text-text-primary select-text">
        <HighlightedText
          content={content}
          highlights={highlights}
          onHighlightClick={handleHighlightClick}
        />
      </div>

      {/* Color picker popup */}
      {showColorPicker && (
        <ColorPicker
          position={colorPickerPosition}
          onSelect={handleColorSelect}
          onClose={() => {
            setShowColorPicker(false)
            setPendingRange(null)
          }}
        />
      )}
    </div>
  )
}
