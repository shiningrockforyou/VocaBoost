import { useRef } from 'react'
import Highlighter from './Highlighter'
import LineReader from './LineReader'
import ToolsToolbar from './ToolsToolbar'
import { STIMULUS_TYPE } from '../../utils/apTypes'

/**
 * PassageDisplay - Stimulus/passage display with integrated annotation tools
 *
 * Combines:
 * - Highlighter for text selection/highlighting
 * - Line reader overlay for focus
 * - Toolbar for tool controls
 *
 * Props:
 * - stimulus: Stimulus object { type, content, source, imageAlt, title }
 * - highlights: Array of highlight ranges
 * - onHighlight: Callback when text is highlighted
 * - onRemoveHighlight: Callback when highlight is removed
 * - highlightColor: Current highlight color
 * - onHighlightColorChange: Callback to change highlight color
 * - lineReaderEnabled: Whether line reader is active
 * - lineReaderPosition: Current line position
 * - lineReaderLines: Number of visible lines
 * - onLineReaderToggle: Callback to toggle line reader
 * - onLineReaderMove: Callback when line reader position changes
 * - onLineReaderLinesChange: Callback to change visible lines
 * - onClearAll: Callback to clear all annotations
 * - showToolbar: Whether to show the toolbar (default true)
 * - disabled: Whether tools are disabled
 */
export default function PassageDisplay({
  stimulus,
  highlights = [],
  onHighlight,
  onRemoveHighlight,
  highlightColor = 'yellow',
  onHighlightColorChange,
  lineReaderEnabled = false,
  lineReaderPosition = 0,
  lineReaderLines = 2,
  onLineReaderToggle,
  onLineReaderMove,
  onLineReaderLinesChange,
  onClearAll,
  showToolbar = true,
  disabled = false,
}) {
  const contentRef = useRef(null)

  if (!stimulus) return null

  const { type, content, source, imageAlt, title } = stimulus
  const isImage = type === STIMULUS_TYPE.IMAGE || type === STIMULUS_TYPE.CHART
  const isText = !isImage

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar - sticky within scroll container */}
      {showToolbar && isText && (
        <div className="sticky top-0 z-10 bg-surface shrink-0 pb-3 mb-3 border-b border-border-default">
          <ToolsToolbar
            highlightColor={highlightColor}
            onHighlightColorChange={onHighlightColorChange}
            lineReaderEnabled={lineReaderEnabled}
            onLineReaderToggle={onLineReaderToggle}
            lineReaderLines={lineReaderLines}
            onLineReaderLinesChange={onLineReaderLinesChange}
            onClearAll={onClearAll}
            disabled={disabled}
          />
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-auto relative" ref={contentRef}>
        {/* Image stimulus */}
        {isImage && (
          <div className="prose prose-sm max-w-none">
            {title && (
              <h3 className="text-base font-semibold text-text-primary mb-3">{title}</h3>
            )}
            <img
              src={content}
              alt={imageAlt || 'Stimulus image'}
              className="max-w-full h-auto rounded-[--radius-sm]"
            />
            {source && (
              <p className="text-text-muted text-xs mt-2 italic">{source}</p>
            )}
          </div>
        )}

        {/* Text stimulus with highlighter */}
        {isText && (
          <div className="relative">
            {title && (
              <h3 className="text-base font-semibold text-text-primary mb-3">{title}</h3>
            )}
            <Highlighter
              content={content}
              highlights={highlights}
              onHighlight={onHighlight}
              onRemove={onRemoveHighlight}
              disabled={disabled}
              className="prose prose-sm max-w-none"
            />

            {/* Source attribution */}
            {source && (
              <p className="text-text-muted text-xs mt-4 italic border-t border-border-default pt-2">
                — {source}
              </p>
            )}

            {/* Line reader overlay */}
            {isText && (
              <LineReader
                contentRef={contentRef}
                enabled={lineReaderEnabled}
                position={lineReaderPosition}
                onPositionChange={onLineReaderMove}
                lineHeight={24}
                visibleLines={lineReaderLines}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
