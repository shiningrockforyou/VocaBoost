import { useEffect, useCallback, useRef, useState } from 'react'

/**
 * LineReader - Focus line reader overlay for long passages
 *
 * Creates a darkened overlay with a clear "window" that follows
 * the current reading position, helping focus on specific lines.
 * Supports scroll tracking and drag interaction.
 *
 * Props:
 * - contentRef: Ref to the content element being read
 * - enabled: Whether line reader is active
 * - position: Current line position (0-indexed)
 * - onPositionChange: Callback when position changes
 * - lineHeight: Height of each line in pixels (default 24)
 * - visibleLines: Number of lines visible at once (1-3, default 2)
 */
export default function LineReader({
  contentRef,
  enabled,
  position,
  onPositionChange,
  lineHeight = 24,
  visibleLines = 2,
}) {
  const overlayRef = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ y: 0, position: 0 })

  // Calculate max position based on content
  const contentScrollHeight = contentRef.current?.scrollHeight || 0
  const maxPosition = Math.max(0, Math.floor(contentScrollHeight / lineHeight) - visibleLines)

  // Calculate visible window dimensions
  const windowHeight = lineHeight * visibleLines
  // Scroll-relative position for rendering
  const windowTopRelative = position * lineHeight - scrollTop

  // Track scroll position
  useEffect(() => {
    if (!enabled || !contentRef.current) return

    const handleScroll = () => {
      if (contentRef.current) {
        setScrollTop(contentRef.current.scrollTop)
      }
    }

    const content = contentRef.current
    // Initial scroll position
    setScrollTop(content.scrollTop)

    content.addEventListener('scroll', handleScroll, { passive: true })
    return () => content.removeEventListener('scroll', handleScroll)
  }, [enabled, contentRef])

  // Handle keyboard navigation
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        onPositionChange(Math.max(0, position - 1))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        onPositionChange(Math.min(maxPosition, position + 1))
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled, position, onPositionChange, maxPosition])

  // Drag handlers using Pointer Events
  const handlePointerDown = useCallback((e) => {
    // Only start drag on the clear window area (not dark overlays)
    const rect = overlayRef.current?.getBoundingClientRect()
    if (!rect) return

    const clickY = e.clientY - rect.top
    const windowStart = windowTopRelative
    const windowEnd = windowTopRelative + windowHeight

    // Check if click is on the clear window
    if (clickY >= windowStart && clickY <= windowEnd) {
      setIsDragging(true)
      dragStartRef.current = { y: e.clientY, position }
      e.currentTarget.setPointerCapture(e.pointerId)
      e.preventDefault()
    }
  }, [windowTopRelative, windowHeight, position])

  const handlePointerMove = useCallback((e) => {
    if (!isDragging) return

    const deltaY = e.clientY - dragStartRef.current.y
    const deltaLines = Math.round(deltaY / lineHeight)
    const newPosition = dragStartRef.current.position + deltaLines
    const clampedPosition = Math.max(0, Math.min(maxPosition, newPosition))

    onPositionChange(clampedPosition)
  }, [isDragging, lineHeight, maxPosition, onPositionChange])

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Handle click on overlay to reposition (only if not dragging)
  const handleOverlayClick = useCallback((e) => {
    if (isDragging) return
    if (!contentRef.current || !overlayRef.current) return

    const rect = overlayRef.current.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    // Account for scroll when calculating line position
    const newPosition = Math.floor((clickY + scrollTop) / lineHeight)
    const clampedPosition = Math.max(0, Math.min(maxPosition, newPosition))

    onPositionChange(clampedPosition)
  }, [lineHeight, onPositionChange, contentRef, isDragging, scrollTop, maxPosition])

  if (!enabled) return null

  // Clamp overlay heights to prevent negative values when scrolled
  const topHeight = Math.max(0, windowTopRelative)
  const bottomTop = Math.max(0, windowTopRelative + windowHeight)

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-auto"
      onClick={handleOverlayClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ cursor: isDragging ? 'grabbing' : 'pointer', touchAction: 'none' }}
    >
      {/* Top dark overlay */}
      <div
        className="absolute left-0 right-0 bg-black/60 transition-all duration-150"
        style={{
          top: 0,
          height: topHeight,
          pointerEvents: 'none',
        }}
      />

      {/* Clear reading window - draggable */}
      <div
        className="absolute left-0 right-0 border-y-2 border-brand-primary/50 transition-all duration-150"
        style={{
          top: Math.max(0, windowTopRelative),
          height: windowHeight,
          pointerEvents: 'none',
          boxShadow: '0 0 10px rgba(var(--brand-primary-rgb), 0.3)',
          cursor: 'grab',
        }}
      />

      {/* Bottom dark overlay */}
      <div
        className="absolute left-0 right-0 bg-black/60 transition-all duration-150"
        style={{
          top: bottomTop,
          bottom: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Position indicator */}
      <div
        className="absolute right-2 text-white/70 text-xs font-mono bg-black/50 px-2 py-1 rounded-[--radius-button-sm] pointer-events-none"
        style={{ top: Math.max(4, windowTopRelative + 4) }}
      >
        Line {position + 1}
      </div>
    </div>
  )
}

/**
 * LineReaderControls - Standalone controls for line reader
 */
export function LineReaderControls({
  enabled,
  onToggle,
  visibleLines,
  onVisibleLinesChange,
  position,
  onMoveUp,
  onMoveDown,
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggle}
        className={`
          px-3 py-1 rounded-[--radius-button] text-sm flex items-center gap-2 transition-colors
          ${enabled
            ? 'bg-brand-primary text-white'
            : 'bg-surface border border-border-default text-text-secondary hover:bg-hover'
          }
        `}
        title={enabled ? 'Disable line reader' : 'Enable line reader'}
      >
        <span>📖</span>
        <span className="hidden sm:inline">Reader</span>
      </button>

      {enabled && (
        <>
          {/* Line count selector */}
          <select
            value={visibleLines}
            onChange={(e) => onVisibleLinesChange(Number(e.target.value))}
            className="px-2 py-1 rounded-[--radius-input] border border-border-default bg-surface text-text-primary text-sm"
            title="Visible lines"
          >
            <option value={1}>1 line</option>
            <option value={2}>2 lines</option>
            <option value={3}>3 lines</option>
          </select>

          {/* Navigation buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={onMoveUp}
              disabled={position <= 0}
              className="px-2 py-1 rounded-[--radius-button] border border-border-default bg-surface text-text-secondary hover:bg-hover disabled:opacity-50 text-sm"
              title="Move up (↑)"
            >
              ↑
            </button>
            <button
              onClick={onMoveDown}
              className="px-2 py-1 rounded-[--radius-button] border border-border-default bg-surface text-text-secondary hover:bg-hover text-sm"
              title="Move down (↓)"
            >
              ↓
            </button>
          </div>
        </>
      )}
    </div>
  )
}
