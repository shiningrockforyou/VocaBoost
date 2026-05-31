/**
 * B27 Session Driver — reusable per-session helper
 *
 * Handles the full 5-step session flow:
 * Step 1: New word flashcards (skip to test)
 * Step 2: Typed new-word test (30 questions, fill answers)
 * Step 3: Review flashcards (skip to test)
 * Step 4: MCQ review test (one word at a time, click correct option)
 * Step 5: Results
 *
 * ABSOLUTE RULE: Admin SDK read-only. State advances via UI only.
 */

import { readFileSync } from 'fs'

const WORD_CACHE = JSON.parse(readFileSync('/app/e2e/audit/B27/word_position_cache.json', 'utf-8'))

// Build word lookup maps
const WORD_BY_TEXT = {}
const WORD_BY_ID = {}
const WORD_BY_POSITION = {}
for (const w of WORD_CACHE) {
  // Normalize word text (handle multi-line old English markers)
  const normalized = w.word.trim().toLowerCase()
  WORD_BY_TEXT[normalized] = w
  WORD_BY_ID[w.id] = w
  WORD_BY_POSITION[w.position] = w
}

export function lookupWord(wordText) {
  if (!wordText) return null
  const normalized = wordText.trim().toLowerCase()
  return WORD_BY_TEXT[normalized] || null
}

export function lookupWordByPosition(pos) {
  return WORD_BY_POSITION[pos] || null
}

// Navigate to session from dashboard
export async function startSession(page, baseUrl = 'https://vocaboostone.netlify.app') {
  // Prefer the class-card "Start Session" button (second one in DOM)
  // or "Continue Session" if in progress
  const continueBtn = page.getByRole('button', { name: /continue session/i }).first()
  if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await continueBtn.click()
    await page.waitForTimeout(3000)
    return { resumed: true }
  }

  const startBtns = page.getByRole('button', { name: 'Start Session' })
  const count = await startBtns.count()
  if (count === 0) {
    return { error: 'No Start Session button found' }
  }
  // Click the first Start Session button
  await startBtns.first().click()
  await page.waitForTimeout(3000)
  return { resumed: false }
}

// Dismiss the "Customize Your Flashcards" modal if present
export async function dismissFlashcardModal(page) {
  const startStudyingBtn = page.getByRole('button', { name: /start studying/i }).first()
  if (await startStudyingBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await startStudyingBtn.click()
    await page.waitForTimeout(500)
    return true
  }
  return false
}

// Click Session menu → Skip to Test → Start Test confirmation
export async function skipToTest(page) {
  const menuBtn = page.locator('[aria-label="Session menu"]')
  if (!await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    return { error: 'Session menu not found' }
  }

  await menuBtn.click()
  await page.waitForTimeout(500)

  const skipText = page.getByText('Skip to Test').first()
  if (!await skipText.isVisible({ timeout: 3000 }).catch(() => false)) {
    return { error: 'Skip to Test option not found in menu' }
  }

  await skipText.click()
  await page.waitForTimeout(1000)

  // Confirm dialog
  const startTestBtn = page.getByRole('button', { name: /start test/i }).first()
  if (await startTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await startTestBtn.click()
    await page.waitForTimeout(3000)
  }

  return { ok: true }
}

// Complete the typed new-word test
// Returns: { presentedWords: [{word, position}], score, questionCount, error? }
export async function completeTypedTest(page, delayMs = 5) {
  // Verify we're on a typed test
  const typedInputs = page.locator('input[placeholder="Type your definition..."]')
  const inputCount = await typedInputs.count()

  if (inputCount === 0) {
    // Check if we're on the test page at all
    const bodyText = await page.locator('body').textContent().catch(() => '')
    const isTypedTest = bodyText.includes('New Words Test') || bodyText.includes('Typed Test')
    if (!isTypedTest) {
      return { error: 'Not on typed test page', presentedWords: [], questionCount: 0, score: null }
    }
    return { error: 'No typed inputs found', presentedWords: [], questionCount: inputCount, score: null }
  }

  // Get all words from the test
  const items = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[placeholder="Type your definition..."]')
    return Array.from(inputs).map((inp) => {
      const container = inp.closest('div.rounded-xl') || inp.closest('div[class*="rounded-xl"]')
      const wordSpan = container?.querySelector('span.font-medium')
      const posSpan = container?.querySelector('span.text-sm.italic, span[class*="italic"]')
      return {
        word: wordSpan ? wordSpan.textContent.trim() : '',
        pos: posSpan ? posSpan.textContent.trim() : ''
      }
    })
  })

  const presentedWords = []

  for (let i = 0; i < inputCount; i++) {
    const item = items[i]
    const wordEntry = lookupWord(item.word)

    presentedWords.push({
      word: item.word,
      position: wordEntry?.position ?? -1
    })

    // Type the canonical definition
    const definition = wordEntry?.definition_en || 'a word with a specific meaning'
    await typedInputs.nth(i).click()

    // Careful persona: char-by-char but fast (5ms per char to keep runtime manageable)
    for (const char of definition) {
      await typedInputs.nth(i).type(char, { delay: delayMs })
    }
  }

  // Click Submit Test
  const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
  if (!await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    return { error: 'Submit Test button not visible', presentedWords, questionCount: inputCount, score: null }
  }

  await submitBtn.click()

  // Wait for AI grading (can take ~19s per spec)
  // Wait up to 45s for completion
  let gradingDone = false
  for (let attempt = 0; attempt < 9; attempt++) {
    await page.waitForTimeout(5000)
    const bodyText = await page.locator('body').textContent().catch(() => '')
    if (bodyText.includes('Completed Day') || bodyText.includes('% ') ||
        bodyText.includes(' of 30 correct') || bodyText.includes('Your Answer')) {
      gradingDone = true
      break
    }
    if (bodyText.includes('Failed to save') || bodyText.includes('Try Again')) {
      // Click Try Again
      const tryAgainBtn = page.getByRole('button', { name: /try again/i }).first()
      if (await tryAgainBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tryAgainBtn.click()
        await page.waitForTimeout(15000)
      }
    }
  }

  // Extract score
  const bodyText = await page.locator('body').textContent().catch(() => '')
  const scoreMatch = bodyText.match(/(\d+)%/)
  const correctMatch = bodyText.match(/(\d+) of (\d+) correct/)

  let score = null
  if (scoreMatch) {
    score = parseInt(scoreMatch[1])
  } else if (correctMatch) {
    score = Math.round(parseInt(correctMatch[1]) / parseInt(correctMatch[2]) * 100)
  }

  return { presentedWords, questionCount: inputCount, score, gradingDone }
}

// Complete the MCQ review test
// Returns: { presentedWords: [{word, position}], score, questionCount }
export async function completeMCQTest(page) {
  const presentedWords = []
  let answeredCount = 0
  const maxQuestions = 50

  for (let q = 0; q < maxQuestions; q++) {
    // Check if still on MCQ test
    const bodyText = await page.locator('body').textContent().catch(() => '')
    if (!bodyText.includes('Review Test') && !bodyText.includes('MCQ Test')) break

    // Get the current word being tested
    // The word is shown prominently before the 4 option buttons
    const currentWordText = await page.evaluate(() => {
      // Find word text - it's typically in a large element before the option buttons
      const buttons = Array.from(document.querySelectorAll('button.min-h-\\[80px\\], button[class*="rounded-2xl"]'))
      if (buttons.length === 0) return null

      // Walk up from first option button to find word text
      const firstOption = buttons[0]
      let container = firstOption.parentElement
      while (container && container.tagName !== 'BODY') {
        // Look for h1/h2/h3 or large text in container
        const wordEl = container.querySelector('h1, h2, h3, [class*="text-2xl"], [class*="text-3xl"], [class*="font-bold"]')
        if (wordEl && wordEl.textContent.trim().length < 50) {
          return wordEl.textContent.trim()
        }
        container = container.parentElement
      }
      return null
    })

    // Also try getting it from body text patterns
    const wordMatch = bodyText.match(/(?:Review Test — Day \d+.*?Progress.*?\n)(.*?)(?:\n|🔊)/)

    // Get option buttons
    const optionBtns = page.locator('button.min-h-\\[80px\\], button[class*="rounded-2xl"]')
    const optionCount = await optionBtns.count()

    if (optionCount === 0) {
      // Check if the test has ended
      if (bodyText.includes('Submit Test')) {
        // All questions answered, submit
        const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
        if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await submitBtn.click()
          await page.waitForTimeout(5000)
        }
        break
      }
      break
    }

    // Get all option texts
    const optionTexts = []
    for (let i = 0; i < optionCount; i++) {
      const t = await optionBtns.nth(i).textContent().catch(() => '')
      optionTexts.push(t.trim())
    }

    // Find the correct answer for careful persona
    // The word is in the page title/header area
    const pageTitle = await page.locator('[class*="text-2xl"], [class*="text-xl"], h1, h2').first().textContent().catch(() => '')

    // Extract word from title (format: "word(pos)")
    const wordTitleMatch = pageTitle.match(/^(.+?)\s*\(([^)]+)\)/)
    const testedWord = wordTitleMatch ? wordTitleMatch[1].trim() : pageTitle.trim()

    const wordEntry = testedWord ? lookupWord(testedWord) : null

    if (wordEntry) {
      presentedWords.push({ word: testedWord, position: wordEntry.position })
    } else if (testedWord) {
      presentedWords.push({ word: testedWord, position: -1, notFound: true })
    }

    // Click the correct option (matches canonical definition)
    let clicked = false
    if (wordEntry?.definition_en) {
      for (let i = 0; i < optionCount; i++) {
        const optText = optionTexts[i].toLowerCase()
        const defStart = wordEntry.definition_en.toLowerCase().substring(0, 20)
        if (optText.includes(defStart)) {
          await optionBtns.nth(i).click()
          clicked = true
          break
        }
      }
    }
    if (!clicked) {
      // Fallback: click first option
      await optionBtns.first().click()
    }

    answeredCount++
    await page.waitForTimeout(300)

    // Check for Next button (individual MCQ may have it) or auto-advance
    const nextBtn = page.getByRole('button', { name: /next/i }).first()
    if (await nextBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(300)
    }

    // Check submit button appearance (all answered)
    const submitText = await page.locator('body').textContent().catch(() => '')
    if (submitText.includes(`${answeredCount}/`) && submitText.includes('Submit Test')) {
      // Check if all answered
      const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        const submitBtnText = await submitBtn.textContent().catch(() => '')
        // Only submit if all answered
        if (!submitBtnText.includes('Unanswered') || answeredCount >= 30) {
          await submitBtn.click()
          await page.waitForTimeout(5000)
          break
        }
      }
    }
  }

  // Wait for results
  await page.waitForTimeout(3000)

  const finalBodyText = await page.locator('body').textContent().catch(() => '')
  const scoreMatch = finalBodyText.match(/(\d+)%/)
  const correctMatch = finalBodyText.match(/(\d+) of (\d+) correct/)

  let score = null
  if (scoreMatch) score = parseInt(scoreMatch[1])
  else if (correctMatch) score = Math.round(parseInt(correctMatch[1]) / parseInt(correctMatch[2]) * 100)

  return { presentedWords, questionCount: answeredCount, score }
}

// Capture console messages helper
export function attachConsoleListener(page) {
  const messages = []
  page.on('console', msg => messages.push({ type: msg.type(), text: msg.text() }))
  page.on('pageerror', err => messages.push({ type: 'pageerror', text: err.message }))
  return messages
}
