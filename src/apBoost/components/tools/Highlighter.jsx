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
 * Render text with highlights applied using boundary-sweep algorithm
 * This handles overlapping highlights correctly without truncating text
 */
function HighlightedText({ content, highlights, onHighlightClick }) {
  if (!highlights || highlights.length === 0) {
    return <span>{content}</span>
  }

  // Create boundaries for each highlight (start and end points)
  const boundaries = []
  highlights.forEach((highlight, idx) => {
    boundaries.push({
      position: highlight.start,
      type: 'start',
      highlightIndex: idx,
      color: highlight.color,
    })
    boundaries.push({
      position: highlight.end,
      type: 'end',
      highlightIndex: idx,
      color: highlight.color,
    })
  })

  // Sort boundaries by position, with 'start' before 'end' at same position
  boundaries.sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position
    // At same position: 'start' comes before 'end'
    if (a.type === 'start' && b.type === 'end') return -1
    if (a.type === 'end' && b.type === 'start') return 1
    return 0
  })

  // Build segments using boundary sweep
  const segments = []
  const activeHighlights = [] // Stack of active highlight indices (most recent = top)
  let lastPosition = 0

  boundaries.forEach((boundary) => {
    const { position, type, highlightIndex } = boundary

    // Add segment from lastPosition to this position
    if (position > lastPosition) {
      if (activeHighlights.length > 0) {
        // Use the most recent (top of stack) highlight for this segment
        const topHighlightIdx = activeHighlights[activeHighlights.length - 1]
        const topHighlight = highlights[topHighlightIdx]
        segments.push({
          type: 'highlight',
          text: content.slice(lastPosition, position),
          color: topHighlight.color,
          index: topHighlightIdx, // For removal, target the top-most highlight
        })
      } else {
        segments.push({
          type: 'normal',
          text: content.slice(lastPosition, position),
        })
      }
    }

    // Update active highlights stack
    if (type === 'start') {
      activeHighlights.push(highlightIndex)
    } else {
      // Remove this highlight from stack
      const stackIdx = activeHighlights.indexOf(highlightIndex)
      if (stackIdx !== -1) {
        activeHighlights.splice(stackIdx, 1)
      }
    }

    lastPosition = position
  })

  // Add remaining text after all highlights
  if (lastPosition < content.length) {
    segments.push({
      type: 'normal',
      text: content.slice(lastPosition),
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
