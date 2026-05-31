/**
 * B27 Longitudinal Word-Correctness Audit — speedrunner/TOP persona
 * Label: SPD27
 * Batch: B27, persona: speedrunner, class: TOP
 *
 * Speedrunner persona:
 *   - transform: first_word_only (types only the first word of definition_en)
 *   - submitClickStyle: rapid_double (click Submit twice in rapid succession)
 *   - advanceVia: enter_key (press Enter to advance)
 *   - typing_delay_ms: 15 (fastest)
 *
 * KEY CHECKS:
 *   1. Rapid double-submit MUST NOT create duplicate attempt docs (cross-ref B02/B08 dedup holds)
 *   2. Rapid Enter advance MUST NOT skip/corrupt word selection
 *   3. F01 verification: no MASTERED+future-returnAt word in any review test
 *
 * ABSOLUTE RULE: Admin SDK read-only. UI-only state advancement. No writes.
 * HARNESS FIX 1: Review check by IDENTITY (checkReviewWords), not position.
 * HARNESS FIX 2: Logout/login LAST in a FRESH context, after the main walk.
 */

import { chromium } from 'playwright'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'fs'
import { join } from 'path'

// ---- Config ----
const BASE_URL = 'https://vocaboostone.netlify.app'
const EMAIL = 'audit_speedrunner_01_top@vocaboost.test'
const PASSWORD = 'AuditPass2026!'
const UID = 'YWSfNes3g7Mdo6tcg7h6ql4Youv2'
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
const LIST_ID = '8RMews2H7C3UJUAsOBzR'
const CP_DOC_ID = `${CLASS_ID}_${LIST_ID}`

const DAILY_PACE = 80
const STUDY_DAYS_PER_WEEK = 5
const LIST_SIZE = 3381

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B27/speedrunner'
const FINDINGS_DIR = '/app/audit/playwright/findings'
const AGENT_LOGS_DIR = '/app/audit/playwright/findings/agent_logs'
const SA_PATH = '/app/scripts/serviceAccountKey.json'
const CHROMIUM_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'

mkdirSync(EVIDENCE_DIR, { recursive: true })
mkdirSync(FINDINGS_DIR, { recursive: true })
mkdirSync(AGENT_LOGS_DIR, { recursive: true })

// ---- Speedrunner persona transform ----
// first_word_only: take only the first word of definition_en
function speedrunnerAnswer(definitionEn) {
  if (!definitionEn) return 'word'
  const firstWord = definitionEn.trim().split(/\s+/)[0].replace(/[,;.!?]$/, '')
  return firstWord || 'word'
}

// ---- Admin SDK (READ ONLY) ----
let db
function initAdmin() {
  if (!db) {
    if (!getApps().length) {
      const sa = JSON.parse(readFileSync(SA_PATH, 'utf-8'))
      initializeApp({ credential: cert(sa) })
    }
    db = getFirestore()
  }
  return db
}

async function readClassProgress() {
  const snap = await initAdmin().doc(`users/${UID}/class_progress/${CP_DOC_ID}`).get()
  return snap.exists ? snap.data() : null
}

async function readAllClassProgressDocs() {
  const snap = await initAdmin().collection(`users/${UID}/class_progress`).get()
  return snap.docs.map(d => ({ id: d.id, data: d.data() }))
}

async function readStudyStates() {
  const snap = await initAdmin().collection(`users/${UID}/study_states`).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function readStudyStateByWordId(wordId) {
  // study_states docs are keyed by listId_wordId or similar
  const snap = await initAdmin().collection(`users/${UID}/study_states`).get()
  for (const doc of snap.docs) {
    const data = doc.data()
    if (data.wordId === wordId || doc.id.endsWith(wordId)) {
      return { id: doc.id, ...data }
    }
  }
  return null
}

async function readAttempts() {
  const snap = await initAdmin().collection('attempts').where('studentId', '==', UID).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ---- Word lookup ----
const WORD_CACHE = JSON.parse(readFileSync('/app/e2e/audit/B27/word_position_cache.json', 'utf-8'))
const WORD_BY_TEXT = {}
const WORD_BY_POSITION = {}
const WORD_BY_ID = {}
for (const w of WORD_CACHE) {
  WORD_BY_TEXT[w.word.trim().toLowerCase()] = w
  // Also index by first word only (handles "jilt\r\n(old English)" etc.)
  const firstLine = w.word.split('\n')[0].trim().toLowerCase()
  WORD_BY_TEXT[firstLine] = w
  WORD_BY_POSITION[w.position] = w
  WORD_BY_ID[w.id] = w
}

function lookupWord(text) {
  if (!text) return null
  const key = text.trim().toLowerCase()
  return WORD_BY_TEXT[key] || null
}

// ---- Expected words model (ESM) ----
const {
  calculateInterventionLevel, expectedNewWordRange,
  calculateSegment, partitionReviewEligibility,
  checkNewWords, checkReviewWords
} = await import('/app/e2e/audit/helpers/expectedWords.js')

// ---- Logging ----
const jsonlPath = join(AGENT_LOGS_DIR, 'SPD27.jsonl')
function logEvent(event) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event })
  try {
    appendFileSync(jsonlPath, line + '\n')
  } catch(e) {}
  console.log('[LOG]', JSON.stringify(event).substring(0, 200))
}

// ---- Date utilities ----
function nextStudyDay(currentDate) {
  const next = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1)
  }
  return next
}

// ---- Login helper ----
async function loginToApp(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(2000)

  // Navigate to login
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  const emailVisible = await page.getByLabel(/email/i).isVisible({ timeout: 2000 }).catch(() => false)

  if (!emailVisible) {
    if (await loginLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginLink.click()
      await page.waitForTimeout(1500)
    } else {
      await page.evaluate(() => {
        history.pushState({}, '', '/login')
        dispatchEvent(new PopStateEvent('popstate'))
      })
      await page.waitForTimeout(1500)
    }
  }

  const emailInput = page.getByLabel(/email/i).first()
  await emailInput.waitFor({ timeout: 15000 })
  await emailInput.fill(EMAIL)
  await page.getByLabel(/password/i).first().fill(PASSWORD)
  await page.getByLabel(/password/i).first().press('Enter')

  await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
    const continueBtn = page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first()
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.click()
      await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(() => {})
    }
  })
  await page.waitForTimeout(2000)
}

// ---- H2 guard: verify new day loaded, not stale Step-5 ----
async function h2Guard(page, expectedDay) {
  // Check for stale Step-5 "Completed Day N" screen
  const bodyText = await page.locator('body').textContent().catch(() => '')

  // Signs of stale Step-5:
  const isStaleStep5 = (
    bodyText.includes('Completed Day') ||
    bodyText.includes('session complete') ||
    bodyText.includes('Move On') ||
    (bodyText.includes('Great job') && !bodyText.includes('Step'))
  )

  if (isStaleStep5) {
    logEvent({ type: 'h2_stale_step5_detected', expectedDay })
    // Try "Move On" button if present
    const moveOnBtn = page.getByRole('button', { name: /move on|next day|continue/i }).first()
    if (await moveOnBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moveOnBtn.click()
      await page.waitForTimeout(2000)
      return { stale: true, resolved: true }
    }
    // Navigate back to dashboard and try again
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    return { stale: true, resolved: false }
  }

  return { stale: false, resolved: true }
}

// ---- Navigate to session from dashboard ----
async function navigateToSession(page) {
  // Start from dashboard
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(2500)

  // Check for stale Step-5
  const h2 = await h2Guard(page, null)
  if (h2.stale && !h2.resolved) {
    // Already navigated back to dashboard
    await page.waitForTimeout(1500)
  }

  // Look for Start Session / Continue
  const startBtn = page.getByRole('button', { name: /start session/i }).first()
  const continueBtn = page.getByRole('button', { name: /continue session/i }).first()

  if (await startBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await startBtn.click()
    await page.waitForTimeout(3000)
    return { ok: true, resumed: false }
  }
  if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await continueBtn.click()
    await page.waitForTimeout(3000)
    return { ok: true, resumed: true }
  }

  // Try clicking the class card area
  const classCard = page.getByText('25WT 2차 TOP OFFLINE').first()
  if (await classCard.isVisible({ timeout: 3000 }).catch(() => false)) {
    await classCard.click()
    await page.waitForTimeout(1500)
    const startBtn2 = page.getByRole('button', { name: /start session/i }).first()
    if (await startBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startBtn2.click()
      await page.waitForTimeout(3000)
      return { ok: true, resumed: false }
    }
  }

  return { ok: false, error: 'No Start/Continue Session button found' }
}

// ---- Skip to Test via Session menu ----
async function skipToTest(page) {
  // Try aria-label first
  let menuBtn = page.locator('[aria-label="Session menu"]')
  if (!await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    // Try button text
    menuBtn = page.getByRole('button', { name: /session menu/i }).first()
  }
  if (!await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    return { ok: false, error: 'Session menu not found' }
  }

  await menuBtn.click()
  await page.waitForTimeout(600)

  // Look for "Skip to Test"
  const skipItem = page.getByText(/skip to test/i).first()
  if (!await skipItem.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Close menu and return
    await page.keyboard.press('Escape')
    return { ok: false, error: 'Skip to Test option not found' }
  }

  await skipItem.click()
  await page.waitForTimeout(800)

  // Confirm dialog
  const confirmBtn = page.getByRole('button', { name: /start test|confirm|yes|skip/i }).first()
  if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await confirmBtn.click()
    await page.waitForTimeout(2000)
  }

  return { ok: true }
}

// ---- Dismiss any modal that appears (flashcard customization, etc.) ----
async function dismissModal(page) {
  const startStudyBtn = page.getByRole('button', { name: /start studying/i }).first()
  if (await startStudyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await startStudyBtn.click()
    await page.waitForTimeout(500)
    return true
  }
  return false
}

// ---- SPEEDRUNNER: Complete typed new-word test with rapid double-submit ----
// Returns: { presentedWords: [{wordId, word, position}], questionCount, score, rapidSubmitCount, duplicateAttempts }
async function completeTypedTestSpeedrunner(page, preAttemptIds) {
  const presentedWords = []
  let questionCount = 0
  let rapidSubmitCount = 0

  // Wait for test to load
  await page.waitForTimeout(1500)

  // Grab all questions at once (typed test shows all questions on one page)
  const allInputs = page.locator('input[placeholder*="definition"], input[type="text"]')
  const inputCount = await allInputs.count().catch(() => 0)

  if (inputCount === 0) {
    // Try to detect test structure from body
    const body = await page.locator('body').textContent().catch(() => '')
    if (!body.includes('Test') && !body.includes('definition')) {
      return { presentedWords: [], questionCount: 0, score: null, error: 'No typed inputs found', rapidSubmitCount: 0 }
    }
  }

  // Extract all word texts visible on the page
  const allWordData = await page.evaluate(() => {
    // Find all question containers
    const results = []

    // Try to find word+input pairs
    const inputs = document.querySelectorAll('input[placeholder*="definition"], input[type="text"]')
    for (const inp of inputs) {
      // Walk up to find the word text
      let container = inp.parentElement
      let wordText = null
      let wordId = null

      for (let depth = 0; depth < 8 && container; depth++) {
        // Look for span or heading with the word
        const spans = container.querySelectorAll('span, p, h1, h2, h3, div')
        for (const el of spans) {
          const t = el.textContent.trim()
          // Heuristic: word is short (< 50 chars), not the placeholder text
          if (t.length > 0 && t.length < 60 &&
              !t.includes('definition') && !t.includes('Definition') &&
              !t.includes('Type') && !t.includes('Answer') &&
              el.children.length === 0) {
            wordText = t
            break
          }
        }
        if (wordText) break
        container = container.parentElement
      }

      results.push({ wordText, inputIndex: Array.from(inputs).indexOf(inp) })
    }
    return results
  }).catch(() => [])

  // Fill answers as speedrunner (first word only of canonical def) — very fast
  const effectiveCount = Math.max(inputCount, allWordData.length)

  for (let i = 0; i < effectiveCount && i < 35; i++) {
    const wordData = allWordData[i]
    const wordText = wordData?.wordText || ''

    const wordEntry = lookupWord(wordText)
    const answer = wordEntry ? speedrunnerAnswer(wordEntry.definition_en) : 'word'

    if (wordEntry) {
      presentedWords.push({
        wordId: wordEntry.id,
        word: wordEntry.word,
        position: wordEntry.position
      })
    } else if (wordText) {
      presentedWords.push({ wordId: null, word: wordText, position: -1, notFound: true })
    }

    // Type the speedrunner answer (char-by-char, 15ms delay)
    try {
      const inp = allInputs.nth(i)
      await inp.click({ timeout: 3000 })
      for (const ch of answer) {
        await inp.type(ch, { delay: 15 })
      }
    } catch (e) {
      // Input may have scrolled; skip
    }

    questionCount++
  }

  // RAPID DOUBLE-SUBMIT: click Submit Test twice in rapid succession
  // This is the key speedrunner behavior to test dedup
  const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
  if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    logEvent({ type: 'rapid_double_submit_start', questionCount })

    // First click
    await submitBtn.click()
    rapidSubmitCount++

    // Immediately click again (rapid double-submit, no wait)
    await submitBtn.click().catch(() => {}) // May fail if button disappears
    rapidSubmitCount++

    logEvent({ type: 'rapid_double_submit_done', clicks: rapidSubmitCount })
  } else {
    // Try pressing Enter to submit
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter') // rapid double
    rapidSubmitCount = 2
  }

  // Wait for AI grading (~19s typical)
  logEvent({ type: 'waiting_for_grading' })
  let gradingDone = false
  for (let attempt = 0; attempt < 10; attempt++) {
    await page.waitForTimeout(5000)
    const bodyText = await page.locator('body').textContent().catch(() => '')
    if (bodyText.includes('correct') || bodyText.includes('%') ||
        bodyText.includes('Your Score') || bodyText.includes('Results') ||
        bodyText.includes('Completed')) {
      gradingDone = true
      break
    }
    if (bodyText.includes('Try Again') || bodyText.includes('Failed to save')) {
      const tryAgain = page.getByRole('button', { name: /try again/i }).first()
      if (await tryAgain.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tryAgain.click()
        await page.waitForTimeout(15000)
      }
      break
    }
  }

  // Extract score
  const bodyText = await page.locator('body').textContent().catch(() => '')
  let score = null
  const pctMatch = bodyText.match(/(\d+)%/)
  const fracMatch = bodyText.match(/(\d+)\s*(?:of|\/)\s*(\d+)\s*correct/i)
  if (pctMatch) score = parseInt(pctMatch[1])
  else if (fracMatch) score = Math.round(parseInt(fracMatch[1]) / parseInt(fracMatch[2]) * 100)

  // Check for duplicate attempts (key dedup verification)
  await new Promise(r => setTimeout(r, 2000)) // Let Firestore settle
  const postAttempts = await readAttempts()
  const postAttemptIds = new Set(postAttempts.map(a => a.id))
  const newAttemptIds = [...postAttemptIds].filter(id => !preAttemptIds.has(id))

  // Count new-word test attempts specifically
  const newWordAttempts = postAttempts.filter(a =>
    !preAttemptIds.has(a.id) &&
    (a.testType === 'new_words' || a.sessionType === 'new_words' || a.type === 'new_words')
  )

  logEvent({
    type: 'typed_test_result',
    score,
    questionCount,
    rapidSubmitCount,
    newAttemptIds: newAttemptIds.length,
    newWordAttempts: newWordAttempts.length
  })

  return {
    presentedWords,
    questionCount,
    score,
    gradingDone,
    rapidSubmitCount,
    newAttemptIds,
    newWordAttemptCount: newWordAttempts.length
  }
}

// ---- SPEEDRUNNER: Complete MCQ review test with rapid Enter advance ----
// Returns: { presentedWordsWithState: [{wordId, position, preStatus, preReturnAtMs}], score, questionCount }
async function completeMCQTestSpeedrunner(page, preStudyStatesByWordId, nowMs) {
  const presentedWordsWithState = []
  let questionCount = 0
  const maxQuestions = 65

  await page.waitForTimeout(1000)

  for (let q = 0; q < maxQuestions; q++) {
    // Detect test completion
    const bodyText = await page.locator('body').textContent().catch(() => '')

    if (bodyText.includes('Submit Test') && questionCount > 0) {
      const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click()
        await page.waitForTimeout(4000)
        break
      }
    }

    // Find the word being tested
    // Approach: look for the word label/heading
    const wordEl = await page.evaluate(() => {
      // MCQ shows the word prominently with options below
      const allText = document.querySelectorAll('h1, h2, h3, [class*="text-2xl"], [class*="text-3xl"], [class*="font-bold"]')
      for (const el of allText) {
        const t = el.textContent.trim()
        if (t.length > 0 && t.length < 60 && !t.includes('Review Test') && !t.includes('Progress')) {
          return t
        }
      }
      return null
    }).catch(() => null)

    const wordEntry = wordEl ? lookupWord(wordEl) : null

    if (wordEntry) {
      // Read pre-session study state for this word
      const preState = preStudyStatesByWordId[wordEntry.id] || null
      const preStatus = preState?.status || 'NEVER_TESTED'
      const preReturnAtMs = preState?.returnAt
        ? (preState.returnAt._seconds ? preState.returnAt._seconds * 1000 : preState.returnAt)
        : null

      presentedWordsWithState.push({
        wordId: wordEntry.id,
        position: wordEntry.position,
        preStatus,
        preReturnAtMs,
        word: wordEntry.word
      })
    }

    // Find option buttons and click one
    // Speedrunner: just click the first visible option (doesn't read carefully)
    const optionBtns = page.locator('button').filter({ hasNot: page.locator('button[aria-label], button[type="submit"]') })

    // Try various selectors for MCQ options
    let clicked = false

    // Try radio buttons
    const radios = page.getByRole('radio')
    const radioCount = await radios.count().catch(() => 0)
    if (radioCount > 0) {
      await radios.first().click().catch(() => {})
      clicked = true
    }

    if (!clicked) {
      // Try option buttons (typically have text content that looks like definitions)
      const allBtns = page.getByRole('button')
      const btnCount = await allBtns.count().catch(() => 0)
      for (let bi = 0; bi < btnCount && !clicked; bi++) {
        const btnText = await allBtns.nth(bi).textContent().catch(() => '')
        const btnRole = await allBtns.nth(bi).getAttribute('type').catch(() => '')
        // Skip Submit/Next buttons
        if (!btnText.includes('Submit') && !btnText.includes('Next') &&
            !btnText.includes('Session') && btnText.trim().length > 3) {
          await allBtns.nth(bi).click().catch(() => {})
          clicked = true
          break
        }
      }
    }

    if (!clicked) {
      // No option found — test may have ended
      break
    }

    questionCount++
    await page.waitForTimeout(200)

    // RAPID ENTER advance (speedrunner behavior)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(100)
    // Press Enter again (rapid)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)

    // Also try Next button
    const nextBtn = page.getByRole('button', { name: /^next$/i }).first()
    if (await nextBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(200)
    }
  }

  // Wait for results / submit
  await page.waitForTimeout(3000)
  const finalBody = await page.locator('body').textContent().catch(() => '')

  let score = null
  const pctMatch = finalBody.match(/(\d+)%/)
  const fracMatch = finalBody.match(/(\d+)\s*(?:of|\/)\s*(\d+)\s*correct/i)
  if (pctMatch) score = parseInt(pctMatch[1])
  else if (fracMatch) score = Math.round(parseInt(fracMatch[1]) / parseInt(fracMatch[2]) * 100)

  return { presentedWordsWithState, questionCount, score }
}

// ---- Main session runner ----
async function runSession(browser, sessionDate, dayNumber, preCSD, preStudyStates) {
  const result = {
    dayNumber,
    sessionDate: sessionDate.toISOString(),
    started: false,
    h2Hit: false,
    h2Count: 0,
    newTest: { presentedWords: [], questionCount: 0, score: null, rapidSubmitCount: 0 },
    reviewTest: null,
    postCSD: null,
    violations: [],
    errors: [],
    blocked: false,
    blockedReason: null
  }

  // Build pre-session study state index by wordId
  const preStudyStatesByWordId = {}
  for (const ss of preStudyStates) {
    const wordId = ss.wordId || ss.id?.split('_').pop()
    if (wordId) {
      preStudyStatesByWordId[wordId] = ss
    }
  }

  // Read pre-attempt IDs for dedup check
  const preAttempts = await readAttempts()
  const preAttemptIds = new Set(preAttempts.map(a => a.id))

  // Create context with Date.now shim
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })

  await context.addInitScript((isoDate) => {
    const origNow = Date.now.bind(Date)
    const offset = new Date(isoDate).getTime() - origNow()
    window.__VOCABOOST_TIME_OFFSET__ = 0
    Date.now = () => origNow() + window.__VOCABOOST_TIME_OFFSET__ + offset
    window.__advanceTime = (ms) => { window.__VOCABOOST_TIME_OFFSET__ += ms }
  }, sessionDate.toISOString())

  await context.addInitScript(() => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
    }
  })

  const page = await context.newPage()

  try {
    // Login
    await loginToApp(page)

    result.started = true
    logEvent({ type: 'logged_in', day: dayNumber })

    // Navigate to session
    const navResult = await navigateToSession(page)
    if (!navResult.ok) {
      result.blocked = true
      result.blockedReason = navResult.error || 'Could not navigate to session'
      return result
    }

    await page.waitForTimeout(2000)

    // H2 guard: check for stale Step-5
    let h2Total = 0
    for (let h2Attempt = 0; h2Attempt < 3; h2Attempt++) {
      const bodyText = await page.locator('body').textContent().catch(() => '')
      const isStaleStep5 = (
        (bodyText.includes('Completed Day') || bodyText.includes('Move On') ||
         bodyText.includes('session complete')) &&
        !bodyText.includes('Step 1') && !bodyText.includes('New Words')
      )

      if (!isStaleStep5) break

      h2Total++
      result.h2Hit = true
      logEvent({ type: 'h2_stale_detected', day: dayNumber, attempt: h2Attempt })

      // Click Move On if available
      const moveOnBtn = page.getByRole('button', { name: /move on/i }).first()
      if (await moveOnBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await moveOnBtn.click()
        await page.waitForTimeout(2000)
        // Re-navigate to session
        const reNav = await navigateToSession(page)
        if (!reNav.ok) {
          result.blocked = true
          result.blockedReason = `H2 recovery failed: ${reNav.error}`
          break
        }
        await page.waitForTimeout(2000)
      } else {
        // Re-navigate
        const reNav = await navigateToSession(page)
        if (!reNav.ok) break
        await page.waitForTimeout(2000)
      }
    }
    result.h2Count = h2Total

    if (result.blocked) return result

    // Dismiss any modal
    await dismissModal(page)

    // Skip to Test (skip new-word flashcards)
    const skipResult = await skipToTest(page)
    if (!skipResult.ok) {
      logEvent({ type: 'skip_to_test_failed', day: dayNumber, error: skipResult.error })
      // Try to find test directly
      const testBody = await page.locator('body').textContent().catch(() => '')
      if (!testBody.includes('Test')) {
        result.blocked = true
        result.blockedReason = `Cannot reach test: ${skipResult.error}`
        return result
      }
    }

    await page.waitForTimeout(2000)

    // Determine what test we're on
    const pageBody = await page.locator('body').textContent().catch(() => '')
    const isTypedTest = pageBody.includes('Type your definition') ||
                        await page.locator('input[type="text"]').count().then(c => c > 0).catch(() => false)
    const isMCQReview = pageBody.includes('Review Test') || pageBody.includes('MCQ')

    if (isTypedTest) {
      logEvent({ type: 'new_word_test_start', day: dayNumber })

      const typedResult = await completeTypedTestSpeedrunner(page, preAttemptIds)
      result.newTest = typedResult

      logEvent({
        type: 'new_word_test_done',
        day: dayNumber,
        score: typedResult.score,
        words: typedResult.questionCount,
        rapidSubmits: typedResult.rapidSubmitCount,
        duplicateCheck: typedResult.newWordAttemptCount
      })

      // After typed test, look for review test (Day 2+)
      if (dayNumber >= 2) {
        await page.waitForTimeout(3000)

        // Look for review/continue button
        const reviewBtn = page.getByRole('button', { name: /take review|start review|review test|continue/i }).first()
        const hasReviewBtn = await reviewBtn.isVisible({ timeout: 8000 }).catch(() => false)

        if (hasReviewBtn) {
          await reviewBtn.click()
          await page.waitForTimeout(2000)
        } else {
          // Check if review test appeared automatically
          const bodyAfter = await page.locator('body').textContent().catch(() => '')
          if (!bodyAfter.includes('Review Test') && !bodyAfter.includes('MCQ')) {
            logEvent({ type: 'no_review_test_found', day: dayNumber })
          }
        }

        // Check if we're on MCQ review
        const reviewBody = await page.locator('body').textContent().catch(() => '')
        if (reviewBody.includes('Review Test') || reviewBody.includes('MCQ')) {
          logEvent({ type: 'review_test_start', day: dayNumber })
          const reviewResult = await completeMCQTestSpeedrunner(page, preStudyStatesByWordId, sessionDate.getTime())
          result.reviewTest = reviewResult
          logEvent({ type: 'review_test_done', day: dayNumber, score: reviewResult.score, words: reviewResult.questionCount })
        }
      }

    } else if (isMCQReview) {
      // Landed directly on review
      logEvent({ type: 'mcq_review_direct', day: dayNumber })
      const reviewResult = await completeMCQTestSpeedrunner(page, preStudyStatesByWordId, sessionDate.getTime())
      result.reviewTest = reviewResult
    } else {
      result.blocked = true
      result.blockedReason = 'Could not identify test type from page content'
      logEvent({ type: 'cannot_identify_test', day: dayNumber, bodySnippet: pageBody.substring(0, 200) })
    }

    // Post-session screenshot
    const ssPath = join(EVIDENCE_DIR, `day_${String(dayNumber).padStart(2, '0')}_end.png`)
    await page.screenshot({ path: ssPath, fullPage: false }).catch(() => {})

  } catch (err) {
    result.errors.push(err.message)
    logEvent({ type: 'session_error', day: dayNumber, error: err.message })
    const ssPath = join(EVIDENCE_DIR, `day_${String(dayNumber).padStart(2, '0')}_error.png`)
    await page.screenshot({ path: ssPath, fullPage: false }).catch(() => {})
  } finally {
    await page.close().catch(() => {})
    await context.close().catch(() => {})
  }

  return result
}

// ---- Logout/login mid-session scenario (LAST, fresh context) ----
async function runLogoutLoginScenario(browser, dayNumber) {
  logEvent({ type: 'logout_login_scenario_start', day: dayNumber })
  const result = {
    day: dayNumber,
    answeredCount: 0,
    logoutSucceeded: false,
    loginSucceeded: false,
    recoveryState: null, // 'recovered' | 'clean_restart' | 'lost' | 'error'
    localStorageBeforeLogout: null,
    localStorageAfterLogin: null,
    errors: []
  }

  // Fresh context — must NOT share state with main walk
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  try {
    await loginToApp(page)

    // Navigate to session
    const navResult = await navigateToSession(page)
    if (!navResult.ok) {
      result.errors.push(`Cannot reach session: ${navResult.error}`)
      return result
    }
    await page.waitForTimeout(2000)

    // Skip to test
    await dismissModal(page)
    await skipToTest(page)
    await page.waitForTimeout(2000)

    // Answer a few questions (3-5)
    const inputs = page.locator('input[type="text"]')
    const inputCount = await inputs.count().catch(() => 0)
    const answersGiven = Math.min(inputCount, 4)

    for (let i = 0; i < answersGiven; i++) {
      await inputs.nth(i).click().catch(() => {})
      await inputs.nth(i).type('word', { delay: 15 }).catch(() => {})
      result.answeredCount++
    }

    // Capture localStorage before logout
    result.localStorageBeforeLogout = await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter(k => k.includes('vocaboost') || k.includes('session'))
      const out = {}
      for (const k of keys) out[k] = localStorage.getItem(k)?.substring(0, 100)
      return out
    }).catch(() => null)

    logEvent({ type: 'before_logout', answeredCount: result.answeredCount, lsKeys: Object.keys(result.localStorageBeforeLogout || {}) })

    // Log out (find logout button via avatar/user menu)
    let loggedOut = false

    // Try user avatar / profile menu
    const avatarBtn = page.locator('[aria-label="User menu"], [aria-label="Profile"], [aria-label="Account"]').first()
    if (await avatarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await avatarBtn.click()
      await page.waitForTimeout(500)
    } else {
      // Try any button in the nav area that could be logout
      const navArea = page.locator('nav, header').first()
      const navBtns = navArea.getByRole('button')
      const btnCount = await navBtns.count().catch(() => 0)
      for (let bi = 0; bi < btnCount; bi++) {
        await navBtns.nth(bi).click().catch(() => {})
        await page.waitForTimeout(400)
        const logoutItem = page.getByText(/log out|sign out|logout/i).first()
        if (await logoutItem.isVisible({ timeout: 1000 }).catch(() => false)) {
          await logoutItem.click()
          loggedOut = true
          break
        }
      }
    }

    if (!loggedOut) {
      // Try finding logout text directly
      const logoutBtn = page.getByText(/log out|sign out|logout/i).first()
      if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoutBtn.click()
        loggedOut = true
      }
    }

    if (!loggedOut) {
      // Use Firebase signOut via page JS as fallback
      await page.evaluate(async () => {
        try {
          const { getAuth, signOut } = await import('https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js')
          // Actually use the app's auth instance
          if (window.__firebase_auth || window._auth) {
            const auth = window.__firebase_auth || window._auth
            await auth.signOut()
          }
        } catch(e) {}
        // Clear IndexedDB auth
        const dbs = await indexedDB.databases()
        for (const db of dbs) {
          if (db.name?.includes('firebase') || db.name?.includes('auth')) {
            indexedDB.deleteDatabase(db.name)
          }
        }
      }).catch(() => {})
      await page.waitForTimeout(1000)
      // Navigate to home to force logout state
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(2000)

      const body = await page.locator('body').textContent().catch(() => '')
      loggedOut = body.includes('Log in') || body.includes('Sign in') || !body.includes('Dashboard')
    }

    result.logoutSucceeded = loggedOut
    logEvent({ type: 'logout_result', success: loggedOut })

    if (!loggedOut) {
      result.errors.push('Could not log out — logout button not found')
      result.recoveryState = 'error'
      return result
    }

    // Wait for logged-out state
    await page.waitForTimeout(2000)

    // Log back in
    await loginToApp(page)
    result.loginSucceeded = true

    // Capture localStorage after login
    result.localStorageAfterLogin = await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter(k => k.includes('vocaboost') || k.includes('session'))
      const out = {}
      for (const k of keys) out[k] = localStorage.getItem(k)?.substring(0, 100)
      return out
    }).catch(() => null)

    // Navigate to session and see if recovery is offered
    const navResult2 = await navigateToSession(page)
    await page.waitForTimeout(2000)

    const bodyAfterLogin = await page.locator('body').textContent().catch(() => '')

    // Check for recovery prompt
    const hasRecoveryPrompt = bodyAfterLogin.includes('recover') ||
                               bodyAfterLogin.includes('Resume') ||
                               bodyAfterLogin.includes('Continue where') ||
                               bodyAfterLogin.includes('in-progress')

    const hasCleanStart = bodyAfterLogin.includes('Start Session') ||
                          bodyAfterLogin.includes('Step 1') ||
                          bodyAfterLogin.includes('New Words')

    if (hasRecoveryPrompt) {
      result.recoveryState = 'recovered'
    } else if (hasCleanStart) {
      // Check if any answers were preserved
      const lsAfter = result.localStorageAfterLogin || {}
      const lsBefore = result.localStorageBeforeLogout || {}
      const sessionKeysPreserved = Object.keys(lsBefore).some(k => lsAfter[k] !== undefined)
      result.recoveryState = sessionKeysPreserved ? 'clean_restart' : 'lost'
    } else {
      result.recoveryState = 'lost'
    }

    logEvent({
      type: 'logout_login_result',
      recoveryState: result.recoveryState,
      lsBeforeKeys: Object.keys(result.localStorageBeforeLogout || {}),
      lsAfterKeys: Object.keys(result.localStorageAfterLogin || {})
    })

    const ssPath = join(EVIDENCE_DIR, 'logout_login_after.png')
    await page.screenshot({ path: ssPath, fullPage: false }).catch(() => {})

  } catch (err) {
    result.errors.push(err.message)
    result.recoveryState = 'error'
    logEvent({ type: 'logout_login_error', error: err.message })
  } finally {
    await page.close().catch(() => {})
    await context.close().catch(() => {})
  }

  return result
}

// ---- Main audit loop ----
async function main() {
  logEvent({ type: 'audit_start', persona: 'speedrunner', class: 'TOP', label: 'SPD27', uid: UID })

  // Read initial state
  const initialCP = await readClassProgress()
  const initialCSD = initialCP?.currentStudyDay ?? 1
  const initialTWI = initialCP?.totalWordsIntroduced ?? 0
  const initialInterventionLevel = initialCP?.interventionLevel ?? 0

  logEvent({ type: 'initial_state', CSD: initialCSD, TWI: initialTWI, IL: initialInterventionLevel })
  console.log(`=== B27 speedrunner/TOP audit (SPD27) ===`)
  console.log(`Initial CSD: ${initialCSD}, TWI: ${initialTWI}, IL: ${initialInterventionLevel}`)

  // Pre-run: check for orphan docs
  const allCPDocsPre = await readAllClassProgressDocs()
  console.log(`class_progress docs (pre-run): ${allCPDocsPre.map(d => d.id).join(', ')}`)
  const orphanDocPre = allCPDocsPre.find(d => d.id === CLASS_ID || (!d.id.includes('_') && d.id !== CP_DOC_ID))

  // Starting day for this walk
  const startingDay = initialCSD + 1
  const TARGET_SESSIONS = 20
  console.log(`Starting walk at Day ${startingDay}, target ${TARGET_SESSIONS} sessions`)

  // Anchor date: June 2, 2026 09:00 KST (Monday)
  // Speedrunner account is fresh — will likely start at low day numbers
  let currentDate = new Date('2026-06-02T09:00:00+09:00')

  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH })

  const dayTable = []
  const findingsList = []
  let totalH2Count = 0
  let f01LeakDays = 0
  let totalDuplicateAttempts = 0
  let logoutLoginResult = null
  let logoutLoginDayUsed = null

  // For stop condition: track F01 leaks
  let stopConditionHit = false

  try {
    for (let sessionIdx = 0; sessionIdx < TARGET_SESSIONS; sessionIdx++) {
      const dayNumber = startingDay + sessionIdx

      // Skip weekends
      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      }

      console.log(`\n--- Session ${sessionIdx + 1}/${TARGET_SESSIONS}: Day ${dayNumber} | ${currentDate.toISOString().split('T')[0]} ---`)
      logEvent({ type: 'session_start', day: dayNumber, date: currentDate.toISOString(), sessionIdx })

      // Read pre-session state
      const preCP = await readClassProgress()
      const preCSD = preCP?.currentStudyDay ?? (dayNumber - 1)
      const preTWI = preCP?.totalWordsIntroduced ?? 0
      const preRecentSessions = preCP?.recentSessions ?? []
      const preInterventionLevel = preCP?.interventionLevel ?? initialInterventionLevel

      // Read study_states pre-session
      const preStudyStates = await readStudyStates()
      const statusHistPre = {}
      for (const ss of preStudyStates) {
        statusHistPre[ss.status] = (statusHistPre[ss.status] || 0) + 1
      }

      // Compute expected ranges BEFORE session (use pre-TWI for new words)
      const expNewRange = expectedNewWordRange(preTWI, DAILY_PACE, preInterventionLevel, LIST_SIZE)

      // Compute expected review segment (use pre-TWI)
      const expSegment = calculateSegment(dayNumber, STUDY_DAYS_PER_WEEK, preTWI, DAILY_PACE, preInterventionLevel)

      // Compute review eligibility using pre-session states
      const nowMs = currentDate.getTime()
      let eligibleIds = new Set()
      let retiredIds = new Set()

      if (expSegment) {
        const segmentStates = preStudyStates.map(ss => ({
          position: ss.wordIndex ?? -1,
          status: ss.status,
          returnAtMs: ss.returnAt ? (ss.returnAt._seconds ? ss.returnAt._seconds * 1000 : ss.returnAt) : null
        })).filter(s => s.position >= 0)

        const part = partitionReviewEligibility(segmentStates, expSegment, nowMs)
        eligibleIds = part.eligibleIds
        retiredIds = part.retiredIds
      }

      console.log(`Pre: CSD=${preCSD}, TWI=${preTWI}, IL=${preInterventionLevel}`)
      console.log(`Expected new: ${expNewRange ? `[${expNewRange.startIndex},${expNewRange.endIndex}]` : 'null'}`)
      console.log(`Expected segment: ${expSegment ? `[${expSegment.startIndex},${expSegment.endIndex}]` : 'null'}`)
      console.log(`Eligible: ${eligibleIds.size}, Retired (MASTERED): ${retiredIds.size}`)

      // Run session
      const sessionResult = await runSession(browser, currentDate, dayNumber, preCSD, preStudyStates)

      // Let Firestore settle
      await new Promise(r => setTimeout(r, 3000))

      // Read post-session state
      const postCP = await readClassProgress()
      const postCSD = postCP?.currentStudyDay ?? preCSD
      const postTWI = postCP?.totalWordsIntroduced ?? preTWI

      // Read post study_states
      const postStudyStates = await readStudyStates()
      const statusHistPost = {}
      for (const ss of postStudyStates) {
        statusHistPost[ss.status] = (statusHistPost[ss.status] || 0) + 1
      }

      const masteredWords = postStudyStates.filter(ss => ss.status === 'MASTERED')
      const masteredCount = masteredWords.length
      const masteredWithFutureReturn = masteredWords.filter(m => {
        const retMs = m.returnAt ? (m.returnAt._seconds ? m.returnAt._seconds * 1000 : m.returnAt) : null
        return retMs && retMs > nowMs
      }).length

      // Use POST-test TWI for model checks (fixes false positives)
      const expNewRangePost = expectedNewWordRange(postTWI, DAILY_PACE, preInterventionLevel, LIST_SIZE)
      const expSegmentPost = calculateSegment(dayNumber, STUDY_DAYS_PER_WEEK, postTWI, DAILY_PACE, preInterventionLevel)

      // --- NEW WORD CHECK (position-based, use pre-TWI range since those are the words shown) ---
      const newPresentedPositions = (sessionResult.newTest?.presentedWords ?? [])
        .map(pw => pw.position)
        .filter(p => p >= 0)

      const newViolations = checkNewWords({
        presentedPositions: newPresentedPositions,
        expectedRange: expNewRange
      })

      // --- REVIEW CHECK BY IDENTITY (HARNESS FIX 1) ---
      const reviewViolations = []
      let f01LeakThisDay = 0

      if (sessionResult.reviewTest?.presentedWordsWithState) {
        const presented = sessionResult.reviewTest.presentedWordsWithState
        const rvViolations = checkReviewWords({
          presentedWordStates: presented,
          segment: expSegmentPost || expSegment,
          nowMs
        })

        for (const v of rvViolations) {
          reviewViolations.push(v)
          if (v.startsWith('review: RETIRED (MASTERED)')) {
            f01LeakThisDay++
          }
        }
      }

      if (f01LeakThisDay > 0) {
        f01LeakDays++
        logEvent({ type: 'f01_leak', day: dayNumber, leakCount: f01LeakThisDay })
        console.log(`F01 LEAK on Day ${dayNumber}: ${f01LeakThisDay} MASTERED words served in review`)
      }

      // Stop condition: F01 leak on >= 2 days
      if (f01LeakDays >= 2 && !stopConditionHit) {
        stopConditionHit = true
        logEvent({ type: 'stop_condition_hit', reason: 'F01_leak_2_days', day: dayNumber })
        console.log(`STOP CONDITION HIT: F01 leak on ${f01LeakDays} days`)
      }

      // Check for duplicate attempts (key speedrunner dedup test)
      const postAttempts = await readAttempts()
      const preAttemptIds = new Set() // We'll do this check per-session in completeTypedTestSpeedrunner

      // Actually check: count new attempts since this session
      // We compute this by checking sessionResult.newTest.newAttemptIds
      const duplicateCheck = sessionResult.newTest?.newWordAttemptCount ?? 0
      if (duplicateCheck > 1) {
        totalDuplicateAttempts += (duplicateCheck - 1)
        logEvent({ type: 'duplicate_attempt_detected', day: dayNumber, count: duplicateCheck })
        console.log(`DUPLICATE ATTEMPT on Day ${dayNumber}: ${duplicateCheck} new-word attempt docs created`)
      }

      // CSD check
      const csdOk = sessionResult.blocked ? null : (postCSD >= dayNumber)
      const csdDrift = sessionResult.blocked ? null : (!csdOk ? `expected=${dayNumber} got=${postCSD}` : null)

      totalH2Count += sessionResult.h2Count

      // Assemble day row
      const allViolations = [...newViolations, ...reviewViolations]
      const dayRow = {
        day: dayNumber,
        date: currentDate.toISOString().split('T')[0],
        preCSD,
        postCSD,
        preTWI,
        postTWI,
        expNewRange: expNewRange ? `[${expNewRange.startIndex},${expNewRange.endIndex}](${expNewRange.count})` : 'null',
        newMatch: newViolations.length === 0,
        expSegment: expSegment ? `[${expSegment.startIndex},${expSegment.endIndex}]` : 'null',
        eligibleCount: eligibleIds.size,
        retiredCount: retiredIds.size,
        f01Leak: f01LeakThisDay,
        reviewOk: reviewViolations.filter(v => v.startsWith('review: RETIRED')).length === 0,
        masteredCount,
        masteredWithFutureReturn,
        newTestScore: sessionResult.newTest?.score,
        reviewTestScore: sessionResult.reviewTest?.score,
        rapidSubmitCount: sessionResult.newTest?.rapidSubmitCount ?? 0,
        duplicateAttempts: duplicateCheck > 1 ? (duplicateCheck - 1) : 0,
        h2Hit: sessionResult.h2Hit,
        h2Count: sessionResult.h2Count,
        blocked: sessionResult.blocked,
        blockedReason: sessionResult.blockedReason,
        violations: allViolations,
        errors: sessionResult.errors
      }

      dayTable.push(dayRow)

      if (allViolations.length > 0) {
        findingsList.push({ day: dayNumber, violations: allViolations })
      }

      // Mastered sample for evidence
      const masteredSample = masteredWords.slice(0, 5).map(m => ({
        id: m.id,
        wordId: m.wordId,
        wordIndex: m.wordIndex,
        status: m.status,
        returnAtMs: m.returnAt ? (m.returnAt._seconds ? m.returnAt._seconds * 1000 : m.returnAt) : null
      }))

      // Save evidence JSON
      const evidenceData = {
        dayNumber,
        sessionDate: currentDate.toISOString(),
        preCSD, postCSD, preTWI, postTWI,
        expectedNewRange: expNewRange,
        expectedSegment: expSegment,
        expSegmentPostTWI: expSegmentPost,
        eligibleForReview: eligibleIds.size,
        retiredFromReview: retiredIds.size,
        f01LeakThisDay,
        newTest: {
          presentedWords: sessionResult.newTest?.presentedWords ?? [],
          presentedPositions: newPresentedPositions,
          questionCount: sessionResult.newTest?.questionCount ?? 0,
          score: sessionResult.newTest?.score,
          rapidSubmitCount: sessionResult.newTest?.rapidSubmitCount ?? 0,
          newWordAttemptCount: sessionResult.newTest?.newWordAttemptCount ?? 0
        },
        reviewTest: sessionResult.reviewTest ? {
          presentedWordsWithState: sessionResult.reviewTest.presentedWordsWithState,
          questionCount: sessionResult.reviewTest.questionCount,
          score: sessionResult.reviewTest.score
        } : null,
        violations: allViolations,
        statusHistogramPre: statusHistPre,
        statusHistogramPost: statusHistPost,
        masteredCount,
        masteredWithFutureReturn,
        masteredSample,
        h2Hit: sessionResult.h2Hit,
        h2Count: sessionResult.h2Count,
        errors: sessionResult.errors,
        blocked: sessionResult.blocked,
        blockedReason: sessionResult.blockedReason,
        capturedAt: new Date().toISOString()
      }

      const evidencePath = join(EVIDENCE_DIR, `day_${String(dayNumber).padStart(2, '0')}.json`)
      writeFileSync(evidencePath, JSON.stringify(evidenceData, null, 2))
      console.log(`Saved evidence: day_${String(dayNumber).padStart(2, '0')}.json`)

      logEvent({
        type: 'session_complete',
        day: dayNumber,
        preCSD, postCSD,
        csdOk,
        csdDrift,
        newMatch: dayRow.newMatch,
        f01Leak: f01LeakThisDay,
        masteredCount,
        rapidSubmits: dayRow.rapidSubmitCount,
        blocked: sessionResult.blocked
      })

      // Stop condition: halt walk but still run logout/login last
      if (stopConditionHit) {
        console.log('Stop condition hit — halting day walk early. Will still run logout/login scenario.')
        break
      }

      // Advance date for next session
      currentDate = nextStudyDay(currentDate)
    }

    // ---- LOGOUT/LOGIN SCENARIO (LAST, fresh context) ----
    // Choose a day after the walk (or the last completed day)
    const lastDay = dayTable.length > 0 ? dayTable[dayTable.length - 1].day : startingDay
    logoutLoginDayUsed = lastDay + 1
    console.log(`\n--- Logout/login scenario (Day ${logoutLoginDayUsed}, fresh context) ---`)

    logoutLoginResult = await runLogoutLoginScenario(browser, logoutLoginDayUsed)
    logEvent({ type: 'logout_login_scenario_done', result: logoutLoginResult })

  } finally {
    await browser.close()
  }

  // ---- Final orphan doc check ----
  const allCPDocsPost = await readAllClassProgressDocs()
  const newOrphanDocs = allCPDocsPost.filter(d => {
    const isOrphan = !d.id.includes('_') || d.id === CLASS_ID
    const wasPreExisting = allCPDocsPre.some(pre => pre.id === d.id)
    return isOrphan && !wasPreExisting
  })
  const hasNewOrphan = newOrphanDocs.length > 0

  // Attempt ID format check
  const finalAttempts = await readAttempts()
  const malformedAttempts = finalAttempts.filter(a => {
    return !a.id.includes(CLASS_ID) || !a.id.includes(LIST_ID)
  })

  console.log('\n=== SPD27 AUDIT COMPLETE ===')
  console.log(`Sessions completed: ${dayTable.filter(d => !d.blocked).length}/${dayTable.length}`)
  console.log(`New orphan docs: ${hasNewOrphan ? 'YES (PROBLEM)' : 'NO (clean)'}`)
  console.log(`F01 leak days: ${f01LeakDays}`)
  console.log(`Stop condition hit: ${stopConditionHit}`)
  console.log(`Total H2 stale-Step-5: ${totalH2Count}`)
  console.log(`Duplicate attempts: ${totalDuplicateAttempts}`)
  console.log(`Logout/login: ${logoutLoginResult?.recoveryState}`)

  logEvent({
    type: 'audit_final',
    sessionsCompleted: dayTable.filter(d => !d.blocked).length,
    hasNewOrphan,
    f01LeakDays,
    stopConditionHit,
    totalH2Count,
    totalDuplicateAttempts,
    logoutLoginResult: logoutLoginResult?.recoveryState
  })

  return {
    dayTable,
    findingsList,
    initialCSD,
    startingDay,
    hasNewOrphan,
    newOrphanDocs: newOrphanDocs.map(d => d.id),
    f01LeakDays,
    stopConditionHit,
    totalH2Count,
    totalDuplicateAttempts,
    logoutLoginResult,
    logoutLoginDayUsed,
    malformedAttempts: malformedAttempts.length
  }
}

// ---- Run and write status ----
const runResult = await main()

// Write status.json
const statusPath = join(AGENT_LOGS_DIR, 'SPD27.status.json')
writeFileSync(statusPath, JSON.stringify({
  label: 'SPD27',
  persona: 'speedrunner',
  class: 'TOP',
  status: runResult.stopConditionHit ? 'stopped' : 'completed',
  sessionsCompleted: runResult.dayTable.filter(d => !d.blocked).length,
  totalSessions: runResult.dayTable.length,
  startDay: runResult.startingDay,
  endDay: runResult.dayTable.length > 0 ? runResult.dayTable[runResult.dayTable.length - 1].day : null,
  f01LeakDays: runResult.f01LeakDays,
  stopConditionHit: runResult.stopConditionHit,
  totalH2Count: runResult.totalH2Count,
  totalDuplicateAttempts: runResult.totalDuplicateAttempts,
  hasNewOrphan: runResult.hasNewOrphan,
  logoutLoginRecoveryState: runResult.logoutLoginResult?.recoveryState,
  completedAt: new Date().toISOString()
}, null, 2))

// Print day table summary
console.log('\nDay Table Summary:')
console.log('Day | Date | preCSD→postCSD | NewOK? | F01Leaks | ReviewOK? | MASTERED | Score | RapidSubmits | Dup | H2 | Blocked')
for (const row of runResult.dayTable) {
  console.log(
    `${row.day} | ${row.date} | ${row.preCSD}→${row.postCSD} | ${row.newMatch ? 'Y' : 'N'} | ` +
    `${row.f01Leak} | ${row.reviewOk ? 'Y' : row.f01Leak > 0 ? 'NO' : '—'} | ${row.masteredCount} | ` +
    `${row.newTestScore ?? '—'} | ${row.rapidSubmitCount} | ${row.duplicateAttempts} | ${row.h2Count} | ${row.blocked ? row.blockedReason?.substring(0, 30) : 'No'}`
  )
}
