import { useState, useCallback, useEffect } from 'react'
import { logError } from '../utils/logError'

/**
 * Highlight colors available
 */
export const HIGHLIGHT_COLORS = {
  yellow: 'bg-yellow-200',
  green: 'bg-green-200',
  pink: 'bg-pink-200',
  blue: 'bg-blue-200',
}

/**
 * useAnnotations - Manage highlights, strikethroughs, and line reader state
 * @param {string} sessionId - Current session ID
 * @param {Function} addToQueue - Queue function for persisting changes
 * @returns {Object} Annotation state and controls
 */
export function useAnnotations(sessionId, addToQueue = null) {
  // Highlights: Map<questionId, HighlightRange[]>
  const [highlights, setHighlights] = useState(new Map())

  // Strikethroughs: Map<questionId, Set<choiceId>>
  const [strikethroughs, setStrikethroughs] = useState(new Map())

  // Line reader state
  const [lineReaderEnabled, setLineReaderEnabled] = useState(false)
  const [lineReaderPosition, setLineReaderPosition] = useState(0)
  const [lineReaderLines, setLineReaderLines] = useState(2) // 1, 2, or 3 visible lines

  // Current highlight color
  const [highlightColor, setHighlightColor] = useState('yellow')

  // Add a highlight to a question's text
  const addHighlight = useCallback((questionId, range, color = 'yellow') => {
    setHighlights(prev => {
      const next = new Map(prev)
      const existing = next.get(questionId) || []
      next.set(questionId, [...existing, { ...range, color }])
      return next
    })

    // Queue for persistence
    if (sessionId && addToQueue) {
      addToQueue({
        action: 'ANNOTATION_UPDATE',
        payload: { type: 'ADD_HIGHLIGHT', questionId, range, color }
      })
    }
  }, [sessionId, addToQueue])

  // Remove a highlight by index
  const removeHighlight = useCallback((questionId, index) => {
    setHighlights(prev => {
      const next = new Map(prev)
      const existing = next.get(questionId) || []
      next.set(questionId, existing.filter((_, i) => i !== index))
      return next
    })

    // Queue for persistence
    if (sessionId && addToQueue) {
      addToQueue({
        action: 'ANNOTATION_UPDATE',
        payload: { type: 'REMOVE_HIGHLIGHT', questionId, index }
      })
    }
  }, [sessionId, addToQueue])

  // Clear all highlights for a question
  const clearHighlights = useCallback((questionId) => {
    setHighlights(prev => {
      const next = new Map(prev)
      next.delete(questionId)
      return next
    })

    // Queue for persistence
    if (sessionId && addToQueue) {
      addToQueue({
        action: 'ANNOTATION_UPDATE',
        payload: { type: 'CLEAR_HIGHLIGHTS', questionId }
      })
    }
  }, [sessionId, addToQueue])

  // Get highlights for a specific question
  const getHighlights = useCallback((questionId) => {
    return highlights.get(questionId) || []
  }, [highlights])

  // Toggle strikethrough on an answer choice
  const toggleStrikethrough = useCallback((questionId, choiceId) => {
    setStrikethroughs(prev => {
      const next = new Map(prev)
      const existing = next.get(questionId) || new Set()
      const newSet = new Set(existing)

      if (newSet.has(choiceId)) {
        newSet.delete(choiceId)
      } else {
        newSet.add(choiceId)
      }

      next.set(questionId, newSet)
      return next
    })

    // Queue for persistence
    if (sessionId && addToQueue) {
      addToQueue({
        action: 'ANNOTATION_UPDATE',
        payload: { type: 'TOGGLE_STRIKETHROUGH', questionId, choiceId }
      })
    }
  }, [sessionId, addToQueue])

  // Get strikethroughs for a specific question
  const getStrikethroughs = useCallback((questionId) => {
    return strikethroughs.get(questionId) || new Set()
  }, [strikethroughs])

  // Clear strikethroughs for a question
  const clearStrikethroughs = useCallback((questionId) => {
    setStrikethroughs(prev => {
      const next = new Map(prev)
      next.delete(questionId)
      return next
    })

    if (sessionId && addToQueue) {
      addToQueue({
        action: 'ANNOTATION_UPDATE',
        payload: { type: 'CLEAR_STRIKETHROUGHS', questionId }
      })
    }
  }, [sessionId, addToQueue])

  // Toggle line reader on/off
  const toggleLineReader = useCallback(() => {
    setLineReaderEnabled(prev => !prev)
  }, [])

  // Move line reader position
  const moveLineReader = useCallback((position) => {
    setLineReaderPosition(Math.max(0, position))
  }, [])

  // Move line reader up
  const moveLineReaderUp = useCallback(() => {
    setLineReaderPosition(prev => Math.max(0, prev - 1))
  }, [])

  // Move line reader down
  const moveLineReaderDown = useCallback(() => {
    setLineReaderPosition(prev => prev + 1)
  }, [])

  // Set visible lines for line reader
  const setVisibleLines = useCallback((lines) => {
    setLineReaderLines(Math.min(3, Math.max(1, lines)))
  }, [])

  // Clear all annotations for all questions
  const clearAllAnnotations = useCallback(() => {
    setHighlights(new Map())
    setStrikethroughs(new Map())
    setLineReaderEnabled(false)
    setLineReaderPosition(0)

    if (sessionId && addToQueue) {
      addToQueue({
        action: 'ANNOTATION_UPDATE',
        payload: { type: 'CLEAR_ALL' }
      })
    }
  }, [sessionId, addToQueue])

  // Load annotations from session data
  const loadAnnotations = useCallback((annotationData) => {
    if (!annotationData) return

    try {
      // Load highlights
      if (annotationData.highlights) {
        const highlightsMap = new Map()
        Object.entries(annotationData.highlights).forEach(([qId, ranges]) => {
          highlightsMap.set(qId, ranges)
        })
        setHighlights(highlightsMap)
      }

      // Load strikethroughs
      if (annotationData.strikethroughs) {
        const strikethroughsMap = new Map()
        Object.entries(annotationData.strikethroughs).forEach(([qId, choices]) => {
          strikethroughsMap.set(qId, new Set(choices))
        })
        setStrikethroughs(strikethroughsMap)
      }
    } catch (err) {
      logError('useAnnotations.loadAnnotations', { sessionId }, err)
    }
  }, [sessionId])

  // Export annotations for persistence
  const exportAnnotations = useCallback(() => {
    const highlightsObj = {}
    highlights.forEach((ranges, qId) => {
      highlightsObj[qId] = ranges
    })

    const strikethroughsObj = {}
    strikethroughs.forEach((choices, qId) => {
      strikethroughsObj[qId] = Array.from(choices)
    })

    return {
      highlights: highlightsObj,
      strikethroughs: strikethroughsObj,
    }
  }, [highlights, strikethroughs])

  return {
    // Highlights
    highlights,
    addHighlight,
    removeHighlight,
    clearHighlights,
    getHighlights,
    highlightColor,
    setHighlightColor,

    // Strikethroughs
    strikethroughs,
    toggleStrikethrough,
    getStrikethroughs,
    clearStrikethroughs,

    // Line reader
    lineReaderEnabled,
    lineReaderPosition,
    lineReaderLines,
    toggleLineReader,
    moveLineReader,
    moveLineReaderUp,
    moveLineReaderDown,
    setVisibleLines,

    // General
    clearAllAnnotations,
    loadAnnotations,
    exportAnnotations,
  }
}

export default useAnnotations
