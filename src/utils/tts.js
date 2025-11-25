/**
 * Text-to-Speech utility using the Web Speech API
 * @param {string} text - The text to speak
 * @param {string} lang - Language code (default: 'en-US')
 * @returns {Promise<void>}
 */
export const speak = (text, lang = 'en-US') => {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis is not supported in this browser.'))
      return
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 0.9
    utterance.pitch = 1.0
    utterance.volume = 1.0

    utterance.onend = () => {
      resolve()
    }

    utterance.onerror = (event) => {
      reject(new Error(`Speech synthesis error: ${event.error}`))
    }

    try {
      window.speechSynthesis.speak(utterance)
    } catch (error) {
      reject(new Error(`Failed to speak: ${error.message}`))
    }
  })
}

