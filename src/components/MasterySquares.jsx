const TOTAL_SQUARES = 7

/**
 * MasterySquares Component
 * 
 * Supports three modes:
 * 1. Streak mode: Pass `streak` prop (number) - colors last N days green
 * 2. Activity mode: Pass `data` prop (array of 7 numbers representing daily activity)
 * 3. Progress mode: Pass `total` and `mastered` props (legacy mode for backward compatibility)
 */
const MasterySquares = ({ total = 0, mastered = 0, data = null, streak = null, small = false }) => {
  // Streak mode: streak prop is a number representing consecutive days
  if (streak !== null && typeof streak === 'number') {
    const streakCount = Math.max(0, Math.min(7, Math.floor(streak)))
    return (
      <div className={`grid grid-cols-7 ${small ? 'gap-1' : 'gap-1.5'}`}>
        {Array.from({ length: 7 }).map((_, index) => {
          // Last N days (from right to left) are green, others are gray
          const dayIndex = 6 - index // Reverse order: day 7 (today) is index 6
          const isActive = dayIndex < streakCount
          
          return (
            <div
              key={`streak-square-${index}`}
              className={`${small ? 'w-3 h-3' : 'aspect-square'} rounded-md ${
                isActive ? 'bg-emerald-500' : 'bg-slate-200'
              }`}
              title={`Day ${index + 1}: ${isActive ? 'Active' : 'No activity'}`}
            />
          )
        })}
      </div>
    )
  }

  // Activity mode: data prop is an array of 7 days
  if (data && Array.isArray(data) && data.length === 7) {
    return (
      <div className={`grid grid-cols-7 ${small ? 'gap-1' : 'gap-1.5'}`}>
        {data.map((activity, index) => {
          // activity can be a number (words learned) or boolean (activity present)
          const hasActivity = typeof activity === 'number' ? activity > 0 : activity === true
          
          return (
            <div
              key={`activity-square-${index}`}
              className={`${small ? 'w-3 h-3' : 'aspect-square'} rounded-md ${
                hasActivity ? 'bg-emerald-500' : 'bg-slate-200'
              }`}
              title={`Day ${index + 1}: ${typeof activity === 'number' ? `${activity} words` : hasActivity ? 'Active' : 'No activity'}`}
            />
          )
        })}
      </div>
    )
  }

  // Legacy progress mode: total and mastered props
  const safeTotal = Math.max(1, total || 1)
  const progress = Math.min(Math.max(0, mastered), safeTotal)
  const percent = (progress / safeTotal) * 100
  const squaresFilled = Math.floor((percent / 100) * TOTAL_SQUARES)
  const partialSquareFraction = (percent / 100) * TOTAL_SQUARES - squaresFilled

  return (
    <div className="flex w-full items-center gap-1">
      {Array.from({ length: TOTAL_SQUARES }).map((_, index) => {
        const isFull = index < squaresFilled
        const isPartial = index === squaresFilled && partialSquareFraction > 0 && squaresFilled < TOTAL_SQUARES

        return (
          <div
            key={`mastery-square-${index}`}
            className={`relative h-6 flex-1 rounded-md border border-slate-200 ${
              isFull ? 'bg-brand-primary' : 'bg-slate-200'
            }`}
          >
            {isPartial && (
              <div
                className="absolute inset-y-0 left-0 rounded-md bg-brand-highlight"
                style={{ width: `${partialSquareFraction * 100}%` }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default MasterySquares

