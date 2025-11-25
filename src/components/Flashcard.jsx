import { useEffect, useRef, useState } from 'react'
import { speak } from '../utils/tts'

const Flashcard = ({ word, isFlipped, onFlip, autoPlay = false }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const isPlayingRef = useRef(false)

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
      className="relative mx-auto h-96 w-full max-w-2xl cursor-pointer select-none rounded-3xl border border-slate-100 bg-white p-10 text-center shadow-2xl transition hover:shadow-blue-100"
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
      {!isFlipped ? (
        <div className="flex h-full flex-col items-center justify-center">
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-400">Word</p>
          <div className="mt-4 flex items-baseline gap-3 flex-wrap justify-center">
            <p className={`font-bold text-slate-900 ${word.word.length > 12 ? 'text-3xl' : 'text-5xl'}`}>
              {word.word}
            </p>
            {word.partOfSpeech && (
              <span className={`italic font-medium text-slate-500 ${word.word.length > 12 ? 'text-base' : 'text-xl'}`}>
                ({word.partOfSpeech})
              </span>
            )}
          </div>
          <p className="mt-4 text-sm text-slate-500">Tap to reveal the definition</p>
        </div>
      ) : (
        <div className="flex h-full flex-col justify-between text-left">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-400">Word</p>
            <div className="mt-2 flex items-baseline gap-3 flex-wrap">
              <p className={`font-bold text-slate-900 ${word.word.length > 12 ? 'text-2xl' : 'text-4xl'}`}>
                {word.word}
              </p>
              {word.partOfSpeech && (
                <span className={`italic font-medium text-slate-500 ${word.word.length > 12 ? 'text-sm' : 'text-lg'}`}>
                  ({word.partOfSpeech})
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Definition</p>
            <div className="mt-2 flex items-start gap-2">
              {word.partOfSpeech && (
                <span className="text-slate-500 italic mr-2">({word.partOfSpeech})</span>
              )}
              <p className="text-lg text-slate-800">{word.definition}</p>
            </div>
            {word.definitions && Object.keys(word.definitions).filter((lang) => lang !== 'en').length > 0 && (
              <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
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
                        <span className="text-base">{flags[lang] || '🌐'}</span>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-slate-500">
                            {langNames[lang] || lang.toUpperCase()}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-600">{def}</p>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">
              Sample Sentence
            </p>
            <p className="mt-2 text-base italic text-slate-700">
              {word.samples?.[0] ?? 'No sample provided yet.'}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            onClick={(event) => {
              event.stopPropagation()
              handlePlayAudio()
            }}
            disabled={isPlaying}
          >
            {isPlaying ? '🔊 Playing...' : '🔊 Play Audio'}
          </button>
        </div>
      )}
    </div>
  )
}

export default Flashcard


