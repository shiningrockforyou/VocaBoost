const rows = 4
const cols = 7
const totalSquares = rows * cols
const rowColors = ['bg-blue-400', 'bg-blue-500', 'bg-blue-600', 'bg-blue-700']

const MasteryBars = ({ totalWords = 0, masteredCount = 0 }) => {
  const safeTotalWords = Math.max(0, totalWords)
  const safeMastered = Math.min(Math.max(0, masteredCount), safeTotalWords || masteredCount)
  const wordsPerSquare = safeTotalWords > 0 ? safeTotalWords / totalSquares : 1
  const rawFullSquares = Math.floor(safeMastered / wordsPerSquare)
  const fullSquares = Math.min(rawFullSquares, totalSquares)
  const remainder = safeMastered - fullSquares * wordsPerSquare
  const partialPercentage =
    fullSquares >= totalSquares
      ? 0
      : Math.max(0, Math.min(100, (remainder / wordsPerSquare) * 100))

  const masteryPercent =
    safeTotalWords > 0 ? Math.round((safeMastered / safeTotalWords) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>{masteryPercent}% Mastered</span>
        <span>
          {safeMastered} / {safeTotalWords || '—'} words
        </span>
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex gap-2">
            {Array.from({ length: cols }).map((__, colIndex) => {
              const squareIndex = rowIndex * cols + colIndex
              const isFull = squareIndex < fullSquares
              const isPartial = squareIndex === fullSquares && partialPercentage > 0
              const fillColor = rowColors[rowIndex] || 'bg-blue-500'

              return (
                <div
                  key={`square-${squareIndex}`}
                  className={`relative h-8 w-8 overflow-hidden rounded border border-slate-300 ${
                    isFull ? fillColor : 'bg-slate-200'
                  }`}
                >
                  {isPartial && (
                    <div
                      className={`absolute inset-y-0 left-0 ${fillColor}`}
                      style={{ width: `${partialPercentage}%` }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default MasteryBars

