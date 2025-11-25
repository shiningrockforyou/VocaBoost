const TOTAL_SQUARES = 7

const MasterySquares = ({ total = 0, mastered = 0 }) => {
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
            className={`relative h-6 flex-1 rounded-sm border border-slate-200 ${
              isFull ? 'bg-blue-600' : 'bg-slate-200'
            }`}
          >
            {isPartial && (
              <div
                className="absolute inset-y-0 left-0 rounded-sm bg-blue-500"
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

