import { useEffect, useCallback, useRef } from 'react'

/**
 * LineReader - Focus line reader overlay for long passages
 *
 * Creates a darkened overlay with a clear "window" that follows
 * the current reading position, helping focus on specific lines.
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

  // Calculate visible window dimensions
  const windowHeight = lineHeight * visibleLines
  const windowTop = position * lineHeight

  // Handle keyboard navigation
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        onPositionChange(Math.max(0, position - 1))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        onPositionChange(position + 1)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled, position, onPositionChange])

  // Handle click on overlay to reposition
  const handleOverlayClick = useCallback((e) => {
    if (!contentRef.current || !overlayRef.current) return

    const rect = overlayRef.current.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    const newPosition = Math.floor(clickY / lineHeight)

    onPositionChange(Math.max(0, newPosition))
  }, [lineHeight, onPositionChange, contentRef])

  if (!enabled) return null

  // Get content dimensions
  const contentRect = contentRef.current?.getBoundingClientRect()
  const contentHeight = contentRef.current?.scrollHeight || 0

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-auto"
      onClick={handleOverlayClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Top dark overlay */}
      <div
        className="absolute left-0 right-0 bg-black/60 transition-all duration-150"
        style={{
          top: 0,
          height: Math.max(0, windowTop),
          pointerEvents: 'none',
        }}
      />

      {/* Clear reading window */}
      <div
        className="absolute left-0 right-0 border-y-2 border-brand-primary/50 transition-all duration-150"
        style={{
          top: windowTop,
          height: windowHeight,
          pointerEvents: 'none',
          boxShadow: '0 0 10px rgba(var(--brand-primary-rgb), 0.3)',
        }}
      />

      {/* Bottom dark overlay */}
      <div
        className="absolute left-0 right-0 bg-black/60 transition-all duration-150"
        style={{
          top: windowTop + windowHeight,
          bottom: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Position indicator */}
      <div
        className="absolute right-2 text-white/70 text-xs font-mono bg-black/50 px-2 py-1 rounded-[--radius-button-sm] pointer-events-none"
        style={{ top: windowTop + 4 }}
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
