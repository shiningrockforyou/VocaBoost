import { useState, useRef, useEffect } from 'react'

const CollapsibleCard = ({ title, children, minHeight = 'h-64' }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const contentRef = useRef(null)
  const innerRef = useRef(null)
  const [showFade, setShowFade] = useState(false)

  useEffect(() => {
    if (!isExpanded && contentRef.current && innerRef.current) {
      const checkOverflow = () => {
        const container = contentRef.current
        const inner = innerRef.current
        if (container && inner) {
          // Check if inner content height exceeds container height
          const containerHeight = container.clientHeight
          const innerHeight = inner.scrollHeight
          setShowFade(innerHeight > containerHeight + 10) // Small buffer for rounding
        }
      }
      // Check after a brief delay to ensure layout is complete
      const timeoutId = setTimeout(checkOverflow, 100)
      window.addEventListener('resize', checkOverflow)
      return () => {
        clearTimeout(timeoutId)
        window.removeEventListener('resize', checkOverflow)
      }
    } else {
      setShowFade(false)
    }
  }, [isExpanded, children])

  return (
    <div className="rounded-xl bg-white p-6 shadow-md ring-1 ring-slate-100">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <div
        ref={contentRef}
        className={`mt-4 transition-all duration-300 ${
          isExpanded ? 'h-auto' : `${minHeight} overflow-hidden relative`
        }`}
      >
        <div ref={innerRef}>
          {children}
        </div>
        {!isExpanded && showFade && (
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        )}
      </div>
      {showFade && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {isExpanded ? 'Show Less ▴' : 'Show More ▾'}
          </button>
        </div>
      )}
    </div>
  )
}

export default CollapsibleCard

