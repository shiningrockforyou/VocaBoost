/**
 * BlindSpotsCard
 *
 * Displays blind spot status and allows starting a blind spot test.
 * Used at the end of the daily session flow.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBlindSpotPool } from '../services/studyService'
import { STUDY_ALGORITHM_CONSTANTS } from '../utils/studyAlgorithm'
import { Button } from './ui'

const BlindSpotsCard = ({ userId, classId, listId, compact = false }) => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [blindSpotData, setBlindSpotData] = useState({
    total: 0,
    neverTested: 0,
    stale: 0
  })

  useEffect(() => {
    if (!userId || !listId) {
      setLoading(false)
      return
    }

    const loadBlindSpots = async () => {
      try {
        const pool = await getBlindSpotPool(userId, listId)

        const neverTested = pool.filter(
          w => w.studyState?.status === 'NEVER_TESTED'
        ).length
        const stale = pool.length - neverTested

        setBlindSpotData({
          total: pool.length,
          neverTested,
          stale
        })
      } catch (err) {
        console.error('Failed to load blind spots:', err)
      } finally {
        setLoading(false)
      }
    }

    loadBlindSpots()
  }, [userId, listId])

  const handleStartTest = () => {
    navigate(`/blindspots/${classId}/${listId}`)
  }

  if (loading) {
    return (
      <div className="rounded-xl bg-surface border border-border-default p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-3 w-32 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  // No blind spots - show success state
  if (blindSpotData.total === 0) {
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 shadow-sm dark:bg-emerald-900/20 dark:border-emerald-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-800">
            <span className="text-lg">✓</span>
          </div>
          <div>
            <p className="font-medium text-emerald-800 dark:text-emerald-200">
              All words verified
            </p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              No blind spots detected
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Compact mode - just show count and button
  if (compact) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 shadow-sm dark:bg-amber-900/20 dark:border-amber-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔍</span>
            <span className="font-medium text-amber-800 dark:text-amber-200">
              {blindSpotData.total} blind spot{blindSpotData.total !== 1 ? 's' : ''}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartTest}
          >
            Check
          </Button>
        </div>
      </div>
    )
  }

  // Full mode - show breakdown
  return (
    <div className="rounded-xl bg-surface border border-border-default p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <span className="text-2xl">🔍</span>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-text-primary">Blind Spots</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Words that might need extra attention
          </p>

          <div className="mt-3 rounded-lg bg-muted p-3">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Never tested:</span>
              <span className="font-medium text-text-primary">
                {blindSpotData.neverTested}
              </span>
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-text-muted">
                Stale (&gt;{STUDY_ALGORITHM_CONSTANTS.STALE_DAYS_THRESHOLD} days):
              </span>
              <span className="font-medium text-text-primary">
                {blindSpotData.stale}
              </span>
            </div>
            <div className="mt-2 border-t border-border-default pt-2">
              <div className="flex justify-between">
                <span className="font-medium text-text-secondary">Total:</span>
                <span className="font-bold text-text-primary">
                  {blindSpotData.total}
                </span>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="md"
            onClick={handleStartTest}
            className="mt-4 w-full"
          >
            Check Blind Spots
          </Button>
        </div>
      </div>
    </div>
  )
}

export default BlindSpotsCard
