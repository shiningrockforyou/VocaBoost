import { useEffect, useRef, useState } from 'react'
import { speak } from '../utils/tts'

const Flashcard = ({
  word,
  isFlipped,
  onFlip,
  autoPlay = false,
  showKoreanDef = true,
  showSampleSentence = true
}) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const isPlayingRef = useRef(false)

  // Calculate total visible content length for font scaling
  const defLength = word?.definition?.length || 0
  const korLength = showKoreanDef && word?.definitions?.ko ? word.definitions.ko.length : 0
  const sampleLength = showSampleSentence && word?.samples?.[0] ? word.samples[0].length : 0
  const totalLength = defLength + korLength + sampleLength

  // Proportional font sizing based on content density
  // Thresholds: ≤230 = default, 231-340 = medium, >340 = compact
  const getDefinitionSize = () => {
    if (totalLength > 340) return 'text-sm'   // Very dense - 14px
    if (totalLength > 230) return 'text-base' // Medium - 16px
    return 'text-lg'                           // Default - 18px
  }
  const getKoreanSize = () => {
    if (totalLength > 340) return 'text-xs'   // Very dense - 12px
    if (totalLength > 230) return 'text-xs'   // Medium - 12px
    return 'text-sm'                           // Default - 14px
  }
  const getSampleSize = () => {
    if (totalLength > 340) return 'text-xs'   // Very dense - 12px
    if (totalLength > 230) return 'text-sm'   // Medium - 14px
    return 'text-base'                         // Default - 16px
  }
  const definitionSize = getDefinitionSize()
  const koreanSize = getKoreanSize()
  const sampleSize = getSampleSize()

  useEffect(() => {
    if (autoPlay && word?.word && !isFlipped && !isPlayingRef.current) {
      const playAudio = async () => {
        if (isPlayingRef.current) return
        isPlayingRef.current = true
        setIsPlaying(true)
        try {
          await speak(word.word)
        } catch (error) {
          console.error('Failed to play audio:', error)
        } finally {
          isPlayingRef.current = false
          setIsPlaying(false)
        }
      }
      playAudio()
    }
  }, [word?.word, autoPlay, isFlipped])

  const handlePlayAudio = async () => {
    if (!word?.word || isPlayingRef.current) return
    isPlayingRef.current = true
    setIsPlaying(true)
    try {
      await speak(word.word)
    } catch (error) {
      console.error('Failed to play audio:', error)
    } finally {
      isPlayingRef.current = false
      setIsPlaying(false)
    }
  }

  if (!word) return null

  return (
    <div
      className="relative mx-auto h-96 w-full max-w-2xl cursor-pointer select-none rounded-3xl border border-border-muted bg-surface shadow-2xl transition-transform duration-150 active:scale-[0.98]"
      onClick={onFlip}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onFlip?.()
        }
      }}
    >
      {/* Front of card */}
      <div
        className={`absolute inset-0 p-10 flex flex-col items-center justify-center text-center transition-all duration-200 ${isFlipped ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}
      >
        {/* Play button - top right */}
        <button
          type="button"
          className={`absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 transition hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 ${isPlaying ? 'animate-pulse' : ''}`}
          onClick={(e) => { e.stopPropagation(); handlePlayAudio(); }}
          disabled={isPlaying}
          aria-label={isPlaying ? 'Playing audio' : 'Play audio'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        </button>

        <div className="flex items-baseline gap-3 flex-wrap justify-center">
          <p className={`font-bold text-text-primary ${word.word.length > 12 ? 'text-3xl' : 'text-5xl'}`}>
            {word.word}
          </p>
          {word.partOfSpeech && (
            <span className={`italic font-medium text-text-muted ${word.word.length > 12 ? 'text-base' : 'text-xl'}`}>
              ({word.partOfSpeech})
            </span>
          )}
        </div>
      </div>

      {/* Back of card */}
      <div
        className={`absolute inset-0 p-10 transition-all duration-200 ${isFlipped ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
      >
        {/* Play button - top right */}
        <button
          type="button"
          className={`absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 transition hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 ${isPlaying ? 'animate-pulse' : ''}`}
          onClick={(e) => { e.stopPropagation(); handlePlayAudio(); }}
          disabled={isPlaying}
          aria-label={isPlaying ? 'Playing audio' : 'Play audio'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        </button>

        <div className="flex h-full flex-col text-left overflow-y-auto">
          {/* Word + part of speech - stays at top */}
          <div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <p className={`font-bold text-text-primary ${word.word.length > 12 ? 'text-2xl' : 'text-4xl'}`}>
                {word.word}
              </p>
              {word.partOfSpeech && (
                <span className={`italic font-medium text-text-muted ${word.word.length > 12 ? 'text-sm' : 'text-lg'}`}>
                  ({word.partOfSpeech})
                </span>
              )}
            </div>
          </div>
          {/* Definition content area - flows naturally */}
          <div className="mt-4">
            <p className={`${definitionSize} text-text-primary`}>
              {word.definition}
            </p>
            {showKoreanDef && word.definitions && Object.keys(word.definitions).filter((lang) => lang !== 'en').length > 0 && (
              <div className="mt-4 space-y-2 border-t border-border-default pt-4">
                {Object.entries(word.definitions)
                  .filter(([lang]) => lang !== 'en')
                  .map(([lang, def]) => {
                    const flags = {
                      ko: '🇰🇷',
                      es: '🇪🇸',
                      fr: '🇫🇷',
                      de: '🇩🇪',
                      ja: '🇯🇵',
                      zh: '🇨🇳',
                      pt: '🇵🇹',
                      it: '🇮🇹',
                      ru: '🇷🇺',
                      ar: '🇸🇦',
                    }
                    const langNames = {
                      ko: 'Korean',
                      es: 'Spanish',
                      fr: 'French',
                      de: 'German',
                      ja: 'Japanese',
                      zh: 'Chinese',
                      pt: 'Portuguese',
                      it: 'Italian',
                      ru: 'Russian',
                      ar: 'Arabic',
                    }
                    return (
                      <div key={lang} className="flex items-start gap-2">
                        <span className="text-base text-text-primary">{flags[lang] || '🌐'}</span>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-text-muted">
                            {langNames[lang] || lang.toUpperCase()}
                          </p>
                          <p className={`mt-0.5 ${koreanSize} text-text-secondary`}>{def}</p>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
          {/* Sample sentence */}
          {showSampleSentence && (
            <div className="mt-4 border-t border-border-default pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">
                Sample Sentence
              </p>
              <p className={`mt-2 ${sampleSize} italic text-text-secondary`}>
                {word.samples?.[0] ?? 'No sample provided yet.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Flashcard
