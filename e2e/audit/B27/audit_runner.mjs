/**
 * B27 Longitudinal Audit Runner — careful/TOP persona
 * Runs ~20 sessions starting from CSD=4 (real state after Day 4 completed manually).
 *
 * ABSOLUTE RULE: Admin SDK read-only. No writes. UI-only state advancement.
 */

import { chromium } from 'playwright'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

// ---- Config ----
const BASE_URL = 'https://vocaboostone.netlify.app'
const EMAIL = 'audit_careful_01_top@vocaboost.test'
const PASSWORD = 'AuditPass2026!'
const UID = 'EPnmY4FIXxVq19tQtxQCvE26p0F3'
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
const LIST_ID = '8RMews2H7C3UJUAsOBzR'
const CP_DOC_ID = `${CLASS_ID}_${LIST_ID}`

const DAILY_PACE = 80
const STUDY_DAYS_PER_WEEK = 5
const PASS_THRESHOLD_PCT = 92
const LIST_SIZE = 3381

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B27/careful'
const FINDINGS_DIR = '/app/audit/playwright/findings'
const AGENT_LOGS_DIR = '/app/audit/playwright/findings/agent_logs'
const SA_PATH = '/app/scripts/serviceAccountKey.json'

mkdirSync(EVIDENCE_DIR, { recursive: true })

// ---- Admin SDK ----
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

async function readAttempts() {
  const snap = await initAdmin().collection('attempts').where('studentId', '==', UID).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ---- Word lookup ----
const WORD_CACHE = JSON.parse(readFileSync('/app/e2e/audit/B27/word_position_cache.json', 'utf-8'))
const WORD_BY_TEXT = {}
const WORD_BY_POSITION = {}
for (const w of WORD_CACHE) {
  WORD_BY_TEXT[w.word.trim().toLowerCase()] = w
  WORD_BY_POSITION[w.position] = w
}
function lookupWord(text) {
  return WORD_BY_TEXT[text?.trim().toLowerCase()] || null
}

// ---- Expected words model ----
const {
  calculateInterventionLevel, newWordCount, expectedNewWordRange,
  calculateSegment, partitionReviewEligibility, checkPresentedWords
} = await import('/app/e2e/audit/helpers/expectedWords.js')

// ---- Logging ----
const jsonlPath = join(AGENT_LOGS_DIR, 'CW.jsonl')
function logEvent(event) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n'
  try {
    const existing = existsSync(jsonlPath) ? readFileSync(jsonlPath, 'utf-8') : ''
    writeFileSync(jsonlPath, existing + line)
  } catch (e) { console.error('log error:', e.message) }
}

// ---- Date utilities ----
function nextStudyDate(d) {
  const next = new Date(d.getTime() + 24 * 60 * 60 * 1000)
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1)
  }
  return next
}

// ---- Browser helpers ----
async function loginAndLoadDashboard(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 60000 })
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /continue/i }).first().click()
  await page.waitForTimeout(5000)
  const url = page.url()
  if (url.includes('/login')) throw new Error('Login failed - still on login page')
  return true
}

async function getDashboardDay(page) {
  const bodyText = await page.locator('body').textContent().catch(() => '')
  const match = bodyText.match(/Day\s+(\d+)\s*(?:Start Session|Complete)/i)
  return match ? parseInt(match[1]) : null
}

async function startSessionFromDashboard(page) {
  // Check for "Continue Session" (in-progress) or "Start Session"
  const continueBtn = page.getByRole('button', { name: /continue session/i }).first()
  if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await continueBtn.click()
    await page.waitForTimeout(3000)
    return { resumed: true }
  }

  const startBtns = page.getByRole('button', { name: 'Start Session' })
  const count = await startBtns.count()
  if (count === 0) return { error: 'No Start Session button' }
  await startBtns.first().click()
  await page.waitForTimeout(3000)
  return { resumed: false }
}

async function dismissFlashcardModal(page) {
  const btn = page.getByRole('button', { name: /start studying/i }).first()
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btn.click()
    await page.waitForTimeout(500)
    return true
  }
  return false
}

async function skipToTestMenu(page) {
  const menuBtn = page.locator('[aria-label="Session menu"]')
  if (!await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) return false
  await menuBtn.click()
  await page.waitForTimeout(500)
  const skipText = page.getByText('Skip to Test').first()
  if (!await skipText.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Close menu by pressing Escape
    await page.keyboard.press('Escape')
    return false
  }
  await skipText.click()
  await page.waitForTimeout(800)
  // Confirm
  const startTestBtn = page.getByRole('button', { name: /start test/i }).first()
  if (await startTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await startTestBtn.click()
    await page.waitForTimeout(3000)
  }
  return true
}

async function completeTypedTest(page) {
  const typedInputs = page.locator('input[placeholder="Type your definition..."]')
  const inputCount = await typedInputs.count()
  if (inputCount === 0) return { error: 'no typed inputs', presentedWords: [], score: null }

  // Get word-input pairs
  const items = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[placeholder="Type your definition..."]')
    return Array.from(inputs).map(inp => {
      const container = inp.closest('div.rounded-xl') || inp.parentElement?.parentElement
      const wordSpan = container?.querySelector('span.font-medium')
      return { word: wordSpan ? wordSpan.textContent.trim() : '' }
    })
  })

  const presentedWords = []
  for (let i = 0; i < inputCount; i++) {
    const wordEntry = lookupWord(items[i]?.word)
    presentedWords.push({ word: items[i]?.word || '', position: wordEntry?.position ?? -1 })
    const def = wordEntry?.definition_en || 'a word with a specific meaning'
    await typedInputs.nth(i).click()
    // Type with moderate delay (careful persona, but fast for automation)
    for (const char of def) {
      await typedInputs.nth(i).type(char, { delay: 3 })
    }
  }

  // Submit
  const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
  if (!await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    return { error: 'Submit button not found', presentedWords, score: null }
  }
  await submitBtn.click()

  // Wait for grading (up to 50s)
  let score = null
  for (let t = 0; t < 10; t++) {
    await page.waitForTimeout(5000)
    const body = await page.locator('body').textContent().catch(() => '')
    if (body.includes('Completed Day') || body.includes(' of 30 correct') || body.includes('Your Answer')) {
      const m = body.match(/(\d+)%/)
      const m2 = body.match(/(\d+) of (\d+) correct/)
      if (m) score = parseInt(m[1])
      else if (m2) score = Math.round(parseInt(m2[1]) / parseInt(m2[2]) * 100)
      break
    }
    // Handle save failure - try again
    if (body.includes('Failed to save') || body.includes('Try Again')) {
      const tryBtn = page.getByRole('button', { name: /try again/i }).first()
      if (await tryBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tryBtn.click()
        await page.waitForTimeout(15000)
      }
    }
  }

  return { presentedWords, questionCount: inputCount, score }
}

async function completeMCQTest(page) {
  const presentedWords = []
  let answeredCount = 0

  for (let q = 0; q < 50; q++) {
    const bodyText = await page.locator('body').textContent().catch(() => '')
    if (!bodyText.includes('Review Test')) break

    const optionBtns = page.locator('button[class*="rounded-2xl"], button[class*="min-h-\\[80px\\]"]')
    const optionCount = await optionBtns.count()

    if (optionCount === 0) {
      // Check for submit button (all answered)
      const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click()
        await page.waitForTimeout(5000)
        break
      }
      break
    }

    // Get word text from the page
    const wordText = await page.evaluate(() => {
      // Find text before option buttons
      const optBtns = document.querySelectorAll('button[class*="rounded-2xl"]')
      if (optBtns.length === 0) return null

      // Walk up to find word
      let container = optBtns[0].closest('div[class*="flex-col"], div[class*="gap"], main')
      if (!container) return null

      // Find heading/large text in container
      const els = container.querySelectorAll('h1, h2, h3, [class*="text-2xl"], [class*="text-3xl"], [class*="font-bold"]')
      for (const el of els) {
        const t = el.textContent.trim()
        if (t.length > 1 && t.length < 60 && !t.includes('Review Test') && !t.includes('Step ')) {
          return t
        }
      }

      // Fallback: use body text pattern
      const body = document.body.textContent
      const match = body.match(/(\d+) of (\d+) answered\s*(.+?)(?:\s*🔊|\s*Play)/)
      return match ? match[3].trim() : null
    })

    const wordClean = wordText ? wordText.split('\n')[0].replace(/\s*\([^)]+\)\s*$/, '').trim() : ''
    const wordEntry = lookupWord(wordClean)
    presentedWords.push({ word: wordClean, position: wordEntry?.position ?? -1, notFound: !wordEntry })

    // Find and click correct option
    let clicked = false
    if (wordEntry?.definition_en) {
      for (let i = 0; i < optionCount; i++) {
        const optText = await optionBtns.nth(i).textContent().catch(() => '')
        if (optText.toLowerCase().includes(wordEntry.definition_en.toLowerCase().substring(0, 15))) {
          await optionBtns.nth(i).click()
          clicked = true
          break
        }
      }
    }
    if (!clicked) await optionBtns.first().click()

    answeredCount++
    await page.waitForTimeout(300)

    // Check if all answered
    const afterBody = await page.locator('body').textContent().catch(() => '')
    const m = afterBody.match(/(\d+) of (\d+) answered/)
    if (m && parseInt(m[1]) >= parseInt(m[2])) {
      const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click()
        await page.waitForTimeout(5000)
        break
      }
    }
  }

  // Extract score
  const finalBody = await page.locator('body').textContent().catch(() => '')
  const m1 = finalBody.match(/(\d+)%/)
  const m2 = finalBody.match(/(\d+) of (\d+) correct/)
  const score = m1 ? parseInt(m1[1]) : (m2 ? Math.round(parseInt(m2[1]) / parseInt(m2[2]) * 100) : null)

  return { presentedWords, questionCount: answeredCount, score }
}

// ---- Run one full session ----
async function runOneSession(browser, sessionDate, dayNumber) {
  const result = {
    dayNumber,
    sessionDate: sessionDate.toISOString(),
    newTest: { presentedWords: [], score: null, questionCount: 0 },
    reviewTest: null,
    postCSD: null,
    errors: [],
    blocked: false,
    blockedReason: null,
    steps: []
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })

  // Date.now shim
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
  const consoleMsgs = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleMsgs.push(msg.text())
  })

  try {
    // Login
    await loginAndLoadDashboard(page)
    result.steps.push('login_ok')

    // Check dashboard day
    const dashDay = await getDashboardDay(page)
    result.steps.push(`dashboard_day_${dashDay}`)

    // Start session
    const sessionStart = await startSessionFromDashboard(page)
    if (sessionStart.error) {
      result.blocked = true
      result.blockedReason = sessionStart.error
      return result
    }
    result.steps.push(sessionStart.resumed ? 'session_resumed' : 'session_started')

    // Dismiss flashcard modal if present
    await dismissFlashcardModal(page)

    // Get current step
    const bodyText1 = await page.locator('body').textContent().catch(() => '')
    const stepMatch = bodyText1.match(/Step (\d+) of (\d+)/)
    const currentStep = stepMatch ? parseInt(stepMatch[1]) : 1
    result.steps.push(`at_step_${currentStep}`)

    // Handle based on current step
    if (currentStep <= 2) {
      // Step 1 or 2: new word cards or typed test
      // Skip to typed test if on Step 1
      if (currentStep === 1) {
        const skipped = await skipToTestMenu(page)
        result.steps.push(skipped ? 'skip_to_typed_test' : 'skip_failed')
      }

      // Complete typed test
      const typedResult = await completeTypedTest(page)
      result.newTest = typedResult
      result.steps.push(`typed_done_score_${typedResult.score}`)

      if (typedResult.error) {
        result.errors.push(typedResult.error)
      }

      // After typed test, click Continue to advance to Step 3 (review flashcards)
      await page.waitForTimeout(2000)
      let bodyText2 = await page.locator('body').textContent().catch(() => '')
      let step2Match = bodyText2.match(/Step (\d+) of (\d+)/)
      let afterStep = step2Match ? parseInt(step2Match[1]) : null

      // If still on Step 2 (typed test results), click Continue to advance
      if (afterStep === 2 || (afterStep === null && bodyText2.includes('Completed Day'))) {
        const continueBtn = page.getByRole('button', { name: /^continue$/i }).first()
        if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await continueBtn.click()
          result.steps.push('clicked_continue_after_typed')
          await page.waitForTimeout(3000)
          bodyText2 = await page.locator('body').textContent().catch(() => '')
          step2Match = bodyText2.match(/Step (\d+) of (\d+)/)
          afterStep = step2Match ? parseInt(step2Match[1]) : null
        }
      }

      result.steps.push(`after_typed_step_${afterStep}`)

      // If we're on step 3 (review cards), skip to review test
      if (afterStep === 3 || bodyText2.includes('Review Study')) {
        await dismissFlashcardModal(page)
        const skipped2 = await skipToTestMenu(page)
        result.steps.push(skipped2 ? 'skip_to_review_test' : 'review_skip_failed')

        // Complete MCQ review test
        const reviewResult = await completeMCQTest(page)
        result.reviewTest = reviewResult
        result.steps.push(`review_done_score_${reviewResult.score}`)

        await page.waitForTimeout(2000)
      } else if (afterStep === 4 || bodyText2.includes('Review Test')) {
        // Direct to review test
        const reviewResult = await completeMCQTest(page)
        result.reviewTest = reviewResult
        result.steps.push(`review_done_score_${reviewResult.score}`)
        await page.waitForTimeout(2000)
      }
    } else if (currentStep === 3) {
      // Resuming at review cards
      await dismissFlashcardModal(page)
      const skipped = await skipToTestMenu(page)
      result.steps.push(skipped ? 'skip_to_review_test' : 'review_skip_failed')

      const reviewResult = await completeMCQTest(page)
      result.reviewTest = reviewResult
      result.steps.push(`review_done_score_${reviewResult.score}`)
      await page.waitForTimeout(2000)
    } else if (currentStep === 4) {
      // Resuming at MCQ review test
      const reviewResult = await completeMCQTest(page)
      result.reviewTest = reviewResult
      result.steps.push(`review_done_score_${reviewResult.score}`)
      await page.waitForTimeout(2000)
    } else if (currentStep === 5) {
      // Already at results step - just navigate away
      result.steps.push('at_results_step')
    }

    // Handle Step 5 completion (Step 5 = final results with Back to Dashboard button)
    const bodyText5 = await page.locator('body').textContent().catch(() => '')
    const step5Match = bodyText5.match(/Step (\d+) of (\d+)/)
    const isActuallyStep5 = step5Match ? parseInt(step5Match[1]) === 5 : false
    if (isActuallyStep5 || bodyText5.includes('Session Summary') || bodyText5.includes('Back to Dashboard')) {
      result.steps.push('at_completion')

      // Check for "Move On to Next Day" or "Back to Dashboard"
      const moveOnBtn = page.getByRole('button', { name: /move on to next day/i }).first()
      const backBtn = page.getByRole('button', { name: /back to dashboard/i }).first()

      if (await moveOnBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await moveOnBtn.click()
        result.steps.push('moved_to_next_day')
      } else if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await backBtn.click()
        result.steps.push('back_to_dashboard')
      }

      await page.waitForTimeout(2000)
    }

    // If still on completion page, navigate back to dashboard
    const finalUrl = page.url()
    if (!finalUrl.includes('vocaboostone.netlify.app/') || finalUrl.includes('session') || finalUrl.includes('test')) {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
      await page.waitForTimeout(2000)
    }

    // Capture console errors
    if (consoleMsgs.length > 0) {
      result.errors.push(...consoleMsgs.slice(0, 5))
    }

  } catch (err) {
    result.blocked = true
    result.blockedReason = err.message
    result.errors.push(err.message)
    console.error(`Session Day ${dayNumber} error:`, err.message)
    logEvent({ type: 'session_error', day: dayNumber, error: err.message })
  } finally {
    const screenshotPath = join(EVIDENCE_DIR, `day_${String(dayNumber).padStart(2, '0')}_end.png`)
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {})
    await page.close().catch(() => {})
    await context.close().catch(() => {})
  }

  return result
}

// ---- Main ----
async function main() {
  logEvent({ type: 'audit_start', persona: 'careful', class: 'TOP', batch: 'B27', startedAt: new Date().toISOString() })

  // Read initial state
  const initialCP = await readClassProgress()
  const initialCSD = initialCP?.currentStudyDay ?? 4
  const initialTWI = initialCP?.totalWordsIntroduced ?? 320

  console.log(`=== B27 careful/TOP audit ===`)
  console.log(`Initial CSD: ${initialCSD}, TWI: ${initialTWI}`)
  console.log(`Starting from Day ${initialCSD + 1}`)

  // Verify orphan doc situation at start
  const allCPDocs = await readAllClassProgressDocs()
  console.log(`class_progress docs: ${allCPDocs.map(d => d.id).join(', ')}`)
  const orphanBefore = allCPDocs.filter(d => d.id === CLASS_ID && d.id !== CP_DOC_ID)
  console.log(`Orphan docs (classId-only): ${orphanBefore.length}`)

  const startingDay = initialCSD + 1
  const TARGET_SESSIONS = 20

  // Anchor date: June 9, 2026 = Monday (restart after partial run)
  // Current state: CSD=5 (Days 1-5 completed). Day 6 = next session.
  let currentDate = new Date('2026-06-09T09:00:00+09:00')

  const dayTable = []
  const findingsList = []
  const allSessionResults = []

  const browser = await chromium.launch({ headless: true })

  try {
    for (let sessionIdx = 0; sessionIdx < TARGET_SESSIONS; sessionIdx++) {
      const dayNumber = startingDay + sessionIdx

      // Skip weekends
      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      }

      console.log(`\n=== Day ${dayNumber} | ${currentDate.toISOString().split('T')[0]} ===`)
      logEvent({ type: 'session_start', day: dayNumber, date: currentDate.toISOString() })

      // Read pre-session state
      const preCP = await readClassProgress()
      const preCSD = preCP?.currentStudyDay ?? (dayNumber - 1)
      const preTWI = preCP?.totalWordsIntroduced ?? 0
      const preInterventionLevel = preCP?.interventionLevel ?? 0
      const preRecentSessions = preCP?.recentSessions ?? []

      // Read pre study_states
      const preStudyStates = await readStudyStates()
      const statusHistPre = {}
      for (const ss of preStudyStates) {
        statusHistPre[ss.status || 'UNKNOWN'] = (statusHistPre[ss.status || 'UNKNOWN'] || 0) + 1
      }

      // Compute expected ranges
      const expNewRange = expectedNewWordRange(preTWI, DAILY_PACE, preInterventionLevel, LIST_SIZE)
      const expSegment = calculateSegment(dayNumber, STUDY_DAYS_PER_WEEK, preTWI, DAILY_PACE, preInterventionLevel)

      // Compute review eligibility
      let eligibleIds = new Set()
      let retiredIds = new Set()
      const nowMs = currentDate.getTime()
      if (expSegment) {
        const segStates = preStudyStates.map(ss => ({
          position: ss.wordIndex ?? -1,
          status: ss.status,
          returnAtMs: ss.returnAt ? (ss.returnAt._seconds ? ss.returnAt._seconds * 1000 : ss.returnAt) : null
        })).filter(ss => ss.position >= 0)
        const part = partitionReviewEligibility(segStates, expSegment, nowMs)
        eligibleIds = part.eligibleIds
        retiredIds = part.retiredIds
      }

      console.log(`Pre-state: CSD=${preCSD}, TWI=${preTWI}, interventionLevel=${preInterventionLevel}`)
      console.log(`Expected new: ${expNewRange ? `pos [${expNewRange.startIndex},${expNewRange.endIndex}] count=${expNewRange.count}` : 'null'}`)
      console.log(`Expected segment: ${expSegment ? `pos [${expSegment.startIndex},${expSegment.endIndex}]` : 'null'}`)
      console.log(`Eligible review: ${eligibleIds.size}, Retired (MASTERED): ${retiredIds.size}`)

      // Run session
      const sessionResult = await runOneSession(browser, currentDate, dayNumber)
      allSessionResults.push(sessionResult)

      // Wait for Firestore to settle
      await new Promise(r => setTimeout(r, 3000))

      // Read post-session state
      const postCP = await readClassProgress()
      const postCSD = postCP?.currentStudyDay ?? preCSD
      const postTWI = postCP?.totalWordsIntroduced ?? preTWI

      const postStudyStates = await readStudyStates()
      const statusHistPost = {}
      for (const ss of postStudyStates) {
        statusHistPost[ss.status || 'UNKNOWN'] = (statusHistPost[ss.status || 'UNKNOWN'] || 0) + 1
      }

      const masteredWords = postStudyStates.filter(ss => ss.status === 'MASTERED')
      const masteredCount = masteredWords.length

      // Word correctness checks
      const newPresentedPositions = (sessionResult.newTest?.presentedWords ?? [])
        .map(w => w.position).filter(p => p >= 0)
      const reviewPresentedPositions = (sessionResult.reviewTest?.presentedWords ?? [])
        .map(w => w.position).filter(p => p >= 0)

      // Note: audit_state.json only has 30 words in positions [0,29].
      // HARNESS BUG: expNewRange uses preTWI as startIndex, but for Day 5+ sessions,
      // words are at positions 320+ which are NOT in the 30-word audit_state word list.
      // We use WORD_CACHE (full 3381 words from Firestore) for position lookup.
      // expectedNewWordRange still works correctly as a RANGE check.

      const newViolations = checkPresentedWords({
        phase: 'new',
        presentedPositions: newPresentedPositions,
        expectedRange: expNewRange
      })

      const reviewViolations = expSegment ? checkPresentedWords({
        phase: 'review',
        presentedPositions: reviewPresentedPositions,
        expectedRange: expSegment,
        eligibleIds,
        retiredIds
      }) : []

      const allViolations = [...newViolations, ...reviewViolations]

      // CSD check
      const expectedPostCSD = sessionResult.blocked ? preCSD : dayNumber
      const csdOk = postCSD === expectedPostCSD || (postCSD === preCSD + 1 && !sessionResult.blocked)

      const dayRow = {
        day: dayNumber,
        date: currentDate.toISOString().split('T')[0],
        preCSD,
        postCSD,
        csdOk: !sessionResult.blocked ? (postCSD === dayNumber) : null,
        csdDrift: !sessionResult.blocked && postCSD !== dayNumber ? `expected ${dayNumber} got ${postCSD}` : null,
        preTWI,
        postTWI,
        expNewRange: expNewRange ? `[${expNewRange.startIndex},${expNewRange.endIndex}]` : 'null',
        presentedNewCount: newPresentedPositions.length,
        newMatch: newViolations.length === 0,
        expSegment: expSegment ? `[${expSegment.startIndex},${expSegment.endIndex}]` : 'null',
        eligibleCount: eligibleIds.size,
        retiredCount: retiredIds.size,
        presentedReviewCount: reviewPresentedPositions.length,
        reviewMatch: reviewViolations.length === 0,
        masteredCount,
        newTestScore: sessionResult.newTest?.score,
        reviewTestScore: sessionResult.reviewTest?.score,
        violations: allViolations,
        steps: sessionResult.steps,
        blocked: sessionResult.blocked,
        blockedReason: sessionResult.blockedReason,
        errors: sessionResult.errors.slice(0, 3)
      }

      dayTable.push(dayRow)

      // Print violations
      if (allViolations.length > 0) {
        console.log(`VIOLATIONS: ${allViolations.join('; ')}`)
        findingsList.push({ day: dayNumber, violations: allViolations })
      }

      console.log(`Post: CSD=${postCSD}(ok:${dayRow.csdOk}), TWI=${postTWI}, MASTERED=${masteredCount}, newScore=${sessionResult.newTest?.score}, reviewScore=${sessionResult.reviewTest?.score}, violations=${allViolations.length}, blocked=${sessionResult.blocked}`)

      // Save evidence JSON
      const evidenceData = {
        dayNumber,
        sessionDate: currentDate.toISOString(),
        preCSD, postCSD, preTWI, postTWI,
        expectedNewRange: expNewRange,
        expectedSegment: expSegment,
        eligibleForReview: eligibleIds.size,
        retiredFromReview: retiredIds.size,
        newTest: {
          presentedWords: sessionResult.newTest?.presentedWords ?? [],
          presentedPositions: newPresentedPositions,
          score: sessionResult.newTest?.score,
          questionCount: sessionResult.newTest?.questionCount ?? 0
        },
        reviewTest: sessionResult.reviewTest ? {
          presentedWords: sessionResult.reviewTest.presentedWords,
          presentedPositions: reviewPresentedPositions,
          score: sessionResult.reviewTest.score,
          questionCount: sessionResult.reviewTest.questionCount
        } : null,
        violations: allViolations,
        statusHistogramPre: statusHistPre,
        statusHistogramPost: statusHistPost,
        masteredCount,
        masteredWithReturnAt: masteredWords.filter(m => m.returnAt).length,
        masteredSample: masteredWords.slice(0, 3).map(m => ({
          id: m.id, status: m.status,
          returnAtSec: m.returnAt?._seconds ?? m.returnAt
        })),
        steps: sessionResult.steps,
        errors: sessionResult.errors,
        blocked: sessionResult.blocked,
        blockedReason: sessionResult.blockedReason,
        capturedAt: new Date().toISOString()
      }

      const evidencePath = join(EVIDENCE_DIR, `day_${String(dayNumber).padStart(2, '0')}.json`)
      writeFileSync(evidencePath, JSON.stringify(evidenceData, null, 2))

      logEvent({
        type: 'session_complete',
        day: dayNumber,
        preCSD, postCSD, preTWI, postTWI,
        masteredCount,
        violations: allViolations.length,
        newScore: sessionResult.newTest?.score,
        reviewScore: sessionResult.reviewTest?.score,
        blocked: sessionResult.blocked
      })

      if (sessionResult.blocked) {
        console.log(`Day ${dayNumber} BLOCKED: ${sessionResult.blockedReason}`)
      }

      // Advance to next study day
      currentDate = nextStudyDate(currentDate)
    }

    // ---- Final orphan check ----
    console.log('\n=== Final orphan check ===')
    const finalAllCPDocs = await readAllClassProgressDocs()
    const finalOrphans = finalAllCPDocs.filter(d => !d.id.includes('_'))
    console.log(`class_progress docs: ${finalAllCPDocs.map(d => d.id).join(', ')}`)
    console.log(`Orphan (classId-only) docs: ${finalOrphans.length}`)

    // Check attempts created
    const finalAttempts = await readAttempts()
    const seededAttempts = finalAttempts.filter(a => a.id.includes(`_day`) && a.id.includes(`_typed_`) || a.id.includes(`_mcq_`))
    const realAttempts = finalAttempts.filter(a => a.id.includes('vocaboost_test_'))
    console.log(`Total attempts: ${finalAttempts.length}`)
    console.log(`Seeded attempts (prior): ${seededAttempts.length}`)
    console.log(`Real UI attempts: ${realAttempts.length}`)

    // Verify no new classId-only orphan docs were created by us
    const newOrphansCreated = finalOrphans.filter(d => {
      const orphanBefore = allCPDocs.find(x => x.id === d.id)
      return !orphanBefore
    })
    console.log(`New orphan docs created by this run: ${newOrphansCreated.length}`)

    logEvent({
      type: 'audit_complete',
      sessionsCompleted: allSessionResults.filter(s => !s.blocked).length,
      totalSessions: allSessionResults.length,
      newOrphansCreated: newOrphansCreated.length,
      finalCPDocs: finalAllCPDocs.map(d => d.id)
    })

    return {
      dayTable,
      findingsList,
      initialCSD,
      startingDay,
      finalCPDocs: finalAllCPDocs.map(d => d.id),
      newOrphansCreated: newOrphansCreated.length,
      orphansBefore: orphanBefore.length,
      orphansAfter: finalOrphans.length,
      sessionsCompleted: allSessionResults.filter(s => !s.blocked).length,
      totalSessions: allSessionResults.length
    }

  } finally {
    await browser.close()
  }
}

const result = await main()

console.log('\n=== AUDIT COMPLETE ===')
console.log(`Starting day: ${result.startingDay}`)
console.log(`Sessions completed: ${result.sessionsCompleted}/${result.totalSessions}`)
console.log(`New orphan docs created: ${result.newOrphansCreated}`)
console.log(`Final class_progress docs: ${result.finalCPDocs.join(', ')}`)
console.log('\nDay table:')
for (const row of result.dayTable) {
  console.log(`  Day ${row.day}: CSD ${row.preCSD}→${row.postCSD}(ok:${row.csdOk}), new=[${row.expNewRange}](${row.presentedNewCount} shown, match:${row.newMatch}), review=[${row.expSegment}](${row.presentedReviewCount} shown, match:${row.reviewMatch}), MASTERED=${row.masteredCount}, newScore=${row.newTestScore}, reviewScore=${row.reviewTestScore}, V=${row.violations.length}, blocked=${row.blocked}`)
}

if (result.findingsList.length > 0) {
  console.log('\nViolations:')
  for (const f of result.findingsList) {
    console.log(`  Day ${f.day}: ${f.violations.join('; ')}`)
  }
}

// Write final summary
const summaryPath = join(EVIDENCE_DIR, 'audit_summary.json')
writeFileSync(summaryPath, JSON.stringify(result, null, 2))
console.log(`\nSummary: ${summaryPath}`)
