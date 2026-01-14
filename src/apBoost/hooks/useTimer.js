import { useState, useEffect, useCallback, useRef } from 'react'
import { formatTimeSeconds } from '../utils/apTestConfig'

/**
 * useTimer - Timer hook for test sections
 * @param {Object} options
 * @param {number} options.initialTime - Initial time in seconds
 * @param {Function} options.onExpire - Callback when timer reaches 0
 * @param {boolean} options.isPaused - External pause control
 * @param {Function} options.onTick - Optional callback on each tick (for saving)
 * @returns {Object} Timer state and controls
 */
export function useTimer({
  initialTime = 0,
  onExpire,
  isPaused = false,
  onTick,
}) {
  const [timeRemaining, setTimeRemaining] = useState(initialTime)
  const [isRunning, setIsRunning] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const intervalRef = useRef(null)
  const onExpireRef = useRef(onExpire)
  const onTickRef = useRef(onTick)

  // Keep callbacks fresh
  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    onTickRef.current = onTick
  }, [onTick])

  // Initialize timer
  useEffect(() => {
    setTimeRemaining(initialTime)
    setIsExpired(false)
  }, [initialTime])

  // Start the timer
  const start = useCallback(() => {
    setIsRunning(true)
  }, [])

  // Pause the timer
  const pause = useCallback(() => {
    setIsRunning(false)
  }, [])

  // Resume the timer
  const resume = useCallback(() => {
    if (!isExpired) {
      setIsRunning(true)
    }
  }, [isExpired])

  // Reset the timer
  const reset = useCallback((newTime) => {
    setTimeRemaining(newTime ?? initialTime)
    setIsExpired(false)
    setIsRunning(false)
  }, [initialTime])

  // Timer tick
  useEffect(() => {
    if (!isRunning || isPaused || isExpired) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 1

        // Call onTick for saving
        if (onTickRef.current) {
          onTickRef.current(newTime)
        }

        if (newTime <= 0) {
          setIsExpired(true)
          setIsRunning(false)
          if (onExpireRef.current) {
            onExpireRef.current()
          }
          return 0
        }

        return newTime
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isRunning, isPaused, isExpired])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    timeRemaining,
    formatted: formatTimeSeconds(Math.max(0, timeRemaining)),
    isExpired,
    isRunning,
    start,
    pause,
    resume,
    reset,
  }
}

export default useTimer
