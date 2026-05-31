/**
 * Per-persona answer transform rules and typing characteristics.
 *
 * Used by typed-test scenarios to convert a canonical English/Korean answer
 * into the response a given persona would actually type.
 */

const IDK_SET = ['idk', "I don't know", '모름', '?', 'pass']
const JOKE_SET = ['lol', '🤡', 'skibidi', 'based', 'asdfasdf', 'ㅋㅋㅋ']

/**
 * Pick one element from an array by seedable hash. Deterministic per (testRunId, wordId)
 * so a test rerun produces the same response — important for diffing AI grader output.
 */
function pick(arr, seed = Date.now()) {
  return arr[Math.abs(hash(seed)) % arr.length]
}
function hash(s) {
  s = String(s)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)
  return h
}

/**
 * Transform a canonical answer into a persona-specific response.
 * @param {Object} args
 * @param {string} args.canonicalEn
 * @param {string} args.canonicalKo
 * @param {string[]} [args.synonyms]
 * @param {string} args.personaId
 * @param {string} [args.seed] — wordId or similar for deterministic picks
 */
export function transformAnswer({ canonicalEn, canonicalKo, synonyms = [], personaId, seed }) {
  switch (personaId) {
    case 'careful':
    case 'recovering':
    case 'distracted':
    case 'phone':
    case 'slowlaptop':
    case 'academywifi':
    case 'mobiledata':
    case 'multidevice':
    case 'refresher':
    case 'cheater':
      return canonicalEn

    case 'korean':
      return canonicalKo || canonicalEn

    case 'codeswitch':
      // Replace one English noun with a Korean equivalent if recognizable.
      return canonicalEn
        .replace(/\bpoems?\b/i, '시')
        .replace(/\bcollection\b/i, '모음')
        .replace(/\bbook\b/i, '책')

    case 'esl':
      return canonicalEn
        .replace(/\ba\s+/gi, '')
        .replace(/\ban\s+/gi, '')
        .replace(/\bthe\s+/gi, '')
        .replace(/s\b/g, '')
        .replace(/\bto\s+/gi, '')

    case 'beginner':
      return synonyms[0] || canonicalEn.split(/\s+/)[0]

    case 'advanced':
      return `a carefully ${canonicalEn}, typically organized by theme or chronology`

    case 'lazy':
      return pick(IDK_SET, seed)

    case 'trolling':
      return pick(JOKE_SET, seed)

    case 'speedrunner':
      return canonicalEn.split(/\s+/)[0]

    case 'perfectionist':
      // The transform is the canonical; the realism comes from the typing pattern
      // (multiple backspaces+retypes). See perfectionistTyping below.
      return canonicalEn

    case 'firsttimer':
      return `something about ${canonicalEn.split(/\s+/).slice(-2).join(' ')}?`

    case 'rushed':
    case 'anxious':
      // Hurried / nervous: type the canonical, but the realism is in click cadence.
      return canonicalEn

    case 'hostile':
      // Hostile probes via devtools; their UI typing is just canonical.
      return canonicalEn

    case 'classswitcher':
      return canonicalEn

    default:
      return canonicalEn
  }
}

/**
 * Typing delays (ms between keystrokes) per persona.
 * Used by realisticType() in this file.
 */
export const TYPING_DELAY_MS = {
  careful: 100,
  rushed: 30,
  speedrunner: 15,
  korean: 80,
  codeswitch: 90,
  esl: 100,
  beginner: 140,
  advanced: 70,
  phone: 200,
  slowlaptop: 250,
  academywifi: 100,
  mobiledata: 100,
  multidevice: 100,
  perfectionist: 120,
  trolling: 30,
  cheater: 40,    // paste-like speed
  refresher: 100,
  classswitcher: 100,
  firsttimer: 130,
  distracted: 120,
  lazy: 50,
  anxious: 110,
  hostile: 60,
  recovering: 100,
  teacher: 100,
}

/**
 * Type text into a locator one character at a time at the persona's delay.
 * Banned: `locator.fill(text)` — it bypasses React onChange cascade and hides bugs.
 *
 * @param {import('@playwright/test').Locator} locator
 * @param {string} text
 * @param {string} personaId
 */
export async function realisticType(locator, text, personaId) {
  const delay = TYPING_DELAY_MS[personaId] ?? 80
  await locator.focus()
  for (const ch of text) {
    await locator.press(ch, { delay })
  }
}

/**
 * Perfectionist typing: type some, backspace, retype, until reaching target.
 * Simulates the "I keep editing my answer" pattern that exposes autosave races.
 */
export async function perfectionistTyping(locator, text, personaId = 'perfectionist') {
  const delay = TYPING_DELAY_MS[personaId] ?? 120
  await locator.focus()
  let cursor = 0
  while (cursor < text.length) {
    // Type 4-8 chars
    const chunk = Math.min(text.length - cursor, 4 + Math.floor(Math.random() * 5))
    for (let i = 0; i < chunk; i++) {
      await locator.press(text[cursor + i], { delay })
    }
    cursor += chunk
    // 30% chance to backspace 2-3 and retype
    if (cursor < text.length && Math.random() < 0.3) {
      const back = Math.min(cursor, 2 + Math.floor(Math.random() * 2))
      for (let i = 0; i < back; i++) {
        await locator.press('Backspace', { delay })
      }
      cursor -= back
    }
  }
}
