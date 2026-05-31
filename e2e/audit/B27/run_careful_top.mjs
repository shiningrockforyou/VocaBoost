/**
 * B27 Longitudinal Word-Correctness Audit — careful/TOP persona
 * Agent label: CW
 *
 * Reads config, walks ~20 sessions forward from the app's current real day,
 * captures Firestore state per session, runs expectedWords.js checker.
 *
 * ABSOLUTE RULE: Admin SDK read-only. No writes to class_progress/study_states/attempts.
 * State advances ONLY by completing real UI sessions.
 */

import { chromium } from 'playwright'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
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

// Class config (from Admin SDK read)
const DAILY_PACE = 80
const STUDY_DAYS_PER_WEEK = 5
const TEST_MODE = 'typed'
const PASS_THRESHOLD_PCT = 92 // 92%
const TEST_SIZE_NEW = 30
const REVIEW_TEST_TYPE = 'mcq'

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B27/careful'
const FINDINGS_DIR = '/app/audit/playwright/findings'
const AGENT_LOGS_DIR = '/app/audit/playwright/findings/agent_logs'
const SA_PATH = '/app/scripts/serviceAccountKey.json'
const AUDIT_STATE_PATH = '/app/audit/playwright/audit_state.json'

const CHROMIUM_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'

// ---- Init dirs ----
mkdirSync(EVIDENCE_DIR, { recursive: true })
mkdirSync(FINDINGS_DIR, { recursive: true })
mkdirSync(AGENT_LOGS_DIR, { recursive: true })

// ---- Init Firebase Admin (read-only) ----
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

// ---- Load canonical word list ----
const auditState = JSON.parse(readFileSync(AUDIT_STATE_PATH, 'utf-8'))
const WORD_LIST = auditState.lists.topActiveList.words // array of {id, word, position, definition_en, definition_ko}
const LIST_SIZE = WORD_LIST.length // 3380

// ---- Import expectedWords model ----
const {
  calculateInterventionLevel,
  newWordCount,
  expectedNewWordRange,
  calculateSegment,
  partitionReviewEligibility,
  checkPresentedWords
} = await import('/app/e2e/audit/helpers/expectedWords.js')

// ---- Logging ----
const jsonlPath = join(AGENT_LOGS_DIR, 'CW.jsonl')
function logEvent(event) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event })
  try {
    const current = existsSync(jsonlPath) ? readFileSync(jsonlPath, 'utf-8') : ''
    writeFileSync(jsonlPath, current + line + '\n')
  } catch (e) {}
}

// ---- Admin SDK reads ----
async function readClassProgress() {
  const db = initAdmin()
  const snap = await db.doc(`users/${UID}/class_progress/${CP_DOC_ID}`).get()
  return snap.exists ? snap.data() : null
}

async function readAllClassProgressDocs() {
  const db = initAdmin()
  const snap = await db.collection(`users/${UID}/class_progress`).get()
  return snap.docs.map(d => ({ id: d.id, data: d.data() }))
}

async function readStudyStates() {
  const db = initAdmin()
  const snap = await db.collection(`users/${UID}/study_states`).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function readAttempts() {
  const db = initAdmin()
  const snap = await db.collection('attempts').where('studentId', '==', UID).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ---- Position map: wordId → position ----
function buildPositionMap(wordList) {
  const map = {}
  for (const w of wordList) {
    map[w.id] = w.position
  }
  return map
}
const POSITION_MAP = buildPositionMap(WORD_LIST)

// word lookup by position
function wordAtPosition(pos) {
  return WORD_LIST.find(w => w.position === pos)
}

// word lookup by word string
function findWordByText(wordText) {
  return WORD_LIST.find(w => w.word.toLowerCase() === wordText.toLowerCase())
}

// ---- Date utilities ----
function nextStudyDay(currentDate) {
  const next = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1)
  }
  return next
}

// Anchor date: June 2, 2026 09:00 KST (Monday = real study day for Day 4 onwards)
// Current server date: 2026-05-31. CSD=3 means sessions happened May 25-27.
// Next session (Day 4) should be May 28 or next M-F day.
// We'll anchor around June 2 for clean day walking.
const ANCHOR_DATE = new Date('2026-06-02T09:00:00+09:00')

// ---- Browser helpers ----
async function realisticType(locator, text, delayMs = 100) {
  // Character-by-character typing for careful persona
  for (const char of text) {
    await locator.type(char, { delay: delayMs })
  }
}

async function waitFor(page, textOrFn, timeout = 30000) {
  if (typeof textOrFn === 'string') {
    await page.waitForSelector(`text=${textOrFn}`, { timeout })
  } else {
    await textOrFn()
  }
}

// ---- Session flow ----
async function navigateToSession(page, attempt = 0) {
  // Start from dashboard, navigate to session
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })

  // Wait for dashboard to load
  await page.waitForTimeout(2000)

  // Look for "Start Session" or "Continue" button, or class card
  const startBtn = page.getByRole('button', { name: /start session|start today|begin session/i }).first()
  const continueBtn = page.getByRole('button', { name: /continue|resume/i }).first()

  if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await startBtn.click()
    return true
  } else if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await continueBtn.click()
    return true
  }

  // Try clicking on the class card
  const classCard = page.getByText('25WT 2차 TOP OFFLINE').first()
  if (await classCard.isVisible({ timeout: 3000 }).catch(() => false)) {
    await classCard.click()
    await page.waitForTimeout(1000)
    // Look for session button again
    const startBtn2 = page.getByRole('button', { name: /start session|start today|begin/i }).first()
    if (await startBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startBtn2.click()
      return true
    }
  }

  return false
}

async function skipToTest(page) {
  // Find Session menu button
  const menuBtn = page.getByRole('button', { name: /session menu/i }).first()
  if (await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await menuBtn.click()
    await page.waitForTimeout(500)

    const skipItem = page.getByRole('menuitem', { name: /skip to test/i }).first()
    if (await skipItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipItem.click()
      await page.waitForTimeout(500)

      // Confirm dialog
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|skip/i }).first()
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click()
        return true
      }
    }
  }
  return false
}

// ---- Typed test handling ----
async function handleTypedTest(page, sessionDay, wordList) {
  const presentedWords = []
  let questionNumber = 0
  const maxQuestions = TEST_SIZE_NEW + 5 // buffer

  for (let q = 0; q < maxQuestions; q++) {
    // Wait for question prompt
    const questionVisible = await page.waitForSelector('[class*="question"], [class*="prompt"], [class*="word-prompt"]', {
      timeout: 10000
    }).catch(() => null)

    if (!questionVisible) break

    // Try to get the word being tested
    const wordText = await page.locator('[class*="question"], [class*="prompt"], h2, h3').first().textContent().catch(() => '')
    const cleanWord = wordText?.trim()

    if (cleanWord) {
      const wordEntry = findWordByText(cleanWord)
      if (wordEntry) {
        presentedWords.push({ word: cleanWord, position: wordEntry.position })
      } else {
        presentedWords.push({ word: cleanWord, position: -1, notFound: true })
      }
    }

    // Find the text input
    const input = page.getByRole('textbox').first()
    if (!await input.isVisible({ timeout: 5000 }).catch(() => false)) break

    // Look up the canonical definition
    const wordEntry = findWordByText(cleanWord || '')
    const typedAnswer = wordEntry ? wordEntry.definition_en : 'a word meaning something'

    // Type carefully (careful persona: char by char, 80ms delay)
    await input.click()
    await realisticType(input, typedAnswer, 80)
    await page.waitForTimeout(200)

    // Submit this answer
    const nextBtn = page.getByRole('button', { name: /next|submit answer|check/i }).first()
    if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(300)
    } else {
      // Try pressing Enter
      await input.press('Enter')
      await page.waitForTimeout(300)
    }

    questionNumber++

    // Check if test complete
    const testDone = await page.getByText(/test complete|results|score|finished/i).isVisible({ timeout: 1000 }).catch(() => false)
    if (testDone) break

    // Also check for "Submit Test" button appearing
    const submitTest = page.getByRole('button', { name: /submit test|finish test|complete test/i }).first()
    if (await submitTest.isVisible({ timeout: 1000 }).catch(() => false)) {
      await submitTest.click()
      await page.waitForTimeout(2000)
      break
    }
  }

  return { presentedWords, questionCount: questionNumber }
}

// ---- MCQ review test handling ----
async function handleMCQTest(page) {
  const presentedWords = []
  let questionNumber = 0
  const maxQuestions = 60 // max review test size

  for (let q = 0; q < maxQuestions; q++) {
    // Wait for MCQ question
    const promptVisible = await page.waitForSelector('[class*="question"], [class*="prompt"], h2, h3', {
      timeout: 10000
    }).catch(() => null)

    if (!promptVisible) break

    // Get the word being tested (usually shown in the question)
    const promptText = await page.locator('[class*="question"], [class*="prompt"], h2, h3').first().textContent().catch(() => '')
    const cleanWord = promptText?.trim()

    if (cleanWord) {
      const wordEntry = findWordByText(cleanWord)
      if (wordEntry) {
        presentedWords.push({ word: cleanWord, position: wordEntry.position })
      } else {
        presentedWords.push({ word: cleanWord, position: -1, notFound: true })
      }
    }

    // Find all MCQ options
    const options = page.getByRole('radio')
    const optionCount = await options.count()

    if (optionCount === 0) {
      // Try buttons as options
      const btnOptions = page.getByRole('button').filter({ hasText: /^[A-D]\./ })
      const btnCount = await btnOptions.count()
      if (btnCount > 0) {
        // For careful persona: find the correct answer in options
        // Look at option text and match to canonical definition
        const wordEntry = findWordByText(cleanWord || '')
        if (wordEntry) {
          // Try to click the option that contains the canonical definition
          let clicked = false
          for (let i = 0; i < btnCount; i++) {
            const optText = await btnOptions.nth(i).textContent().catch(() => '')
            if (wordEntry.definition_en && optText.includes(wordEntry.definition_en.substring(0, 20))) {
              await btnOptions.nth(i).click()
              clicked = true
              break
            }
          }
          if (!clicked) await btnOptions.first().click()
        } else {
          await btnOptions.first().click()
        }
      } else break
    } else {
      // Radio options: try to find the correct one
      const wordEntry = findWordByText(cleanWord || '')
      let clicked = false
      if (wordEntry) {
        for (let i = 0; i < optionCount; i++) {
          const optLabel = await options.nth(i).evaluate(el => {
            const label = el.closest('label') || document.querySelector(`label[for="${el.id}"]`)
            return label ? label.textContent : el.value
          }).catch(() => '')
          if (wordEntry.definition_en && optLabel.includes(wordEntry.definition_en.substring(0, 15))) {
            await options.nth(i).click()
            clicked = true
            break
          }
        }
      }
      if (!clicked) await options.first().click()
    }

    await page.waitForTimeout(200)

    // Click Next
    const nextBtn = page.getByRole('button', { name: /next|submit answer/i }).first()
    if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(300)
    }

    questionNumber++

    // Check if test complete
    const testDone = await page.getByText(/test complete|results|score|finished/i).isVisible({ timeout: 1000 }).catch(() => false)
    if (testDone) break

    const submitTest = page.getByRole('button', { name: /submit test|finish test|complete/i }).first()
    if (await submitTest.isVisible({ timeout: 1000 }).catch(() => false)) {
      await submitTest.click()
      await page.waitForTimeout(2000)
      break
    }
  }

  return { presentedWords, questionCount: questionNumber }
}

// ---- Result score capture ----
async function captureScore(page) {
  // Wait for results page
  await page.waitForTimeout(3000)

  // Try to find score
  const scoreText = await page.getByText(/\d+%|\d+\/\d+/i).first().textContent().catch(() => '')

  // Try to extract numeric score
  const pctMatch = scoreText.match(/(\d+)%/)
  if (pctMatch) return parseInt(pctMatch[1])

  const fracMatch = scoreText.match(/(\d+)\/(\d+)/)
  if (fracMatch) return Math.round((parseInt(fracMatch[1]) / parseInt(fracMatch[2])) * 100)

  return null
}

// ---- Main session runner ----
async function runSession(page, sessionDate, dayNumber, preCSD, preStudyStates) {
  const result = {
    dayNumber,
    sessionDate: sessionDate.toISOString(),
    started: false,
    newTest: { presentedWords: [], questionCount: 0, score: null },
    reviewTest: null,
    postCSD: null,
    violations: [],
    errors: [],
    blocked: false,
    blockedReason: null
  }

  try {
    // Install Date.now shim at context level (context addInitScript not available here, use page evaluate)
    // Actually for this driver we use page.addInitScript at context creation time instead

    // Navigate to session from dashboard
    const sessionReached = await navigateToSession(page)
    if (!sessionReached) {
      result.blocked = true
      result.blockedReason = 'Could not reach session from dashboard'
      return result
    }
    result.started = true

    await page.waitForTimeout(2000)

    // Skip to test (Skip new-word card review, go straight to typed test)
    const skipped = await skipToTest(page)
    if (!skipped) {
      // Try to find "Start Test" or similar
      const testBtn = page.getByRole('button', { name: /start test|take test/i }).first()
      if (await testBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await testBtn.click()
      }
    }

    await page.waitForTimeout(2000)

    // Determine if we're on new-word test or review test
    // New word test first (typed)
    const isTypedTest = await page.getByRole('textbox').isVisible({ timeout: 5000 }).catch(() => false)
    const isMCQTest = await page.getByRole('radio').isVisible({ timeout: 2000 }).catch(() => false)

    if (isTypedTest) {
      logEvent({ type: 'session_new_test_start', day: dayNumber })
      const newTestResult = await handleTypedTest(page, dayNumber, WORD_LIST)
      result.newTest = newTestResult

      // Wait for grading (~19s per spec note)
      await page.waitForTimeout(22000)

      // Capture score
      result.newTest.score = await captureScore(page)
      logEvent({ type: 'session_new_test_done', day: dayNumber, score: result.newTest.score, words: newTestResult.questionCount })

      // If Day >= 2, look for review test
      if (dayNumber >= 2) {
        await page.waitForTimeout(2000)

        // Navigate to review test if available
        const reviewBtn = page.getByRole('button', { name: /review|take review|start review/i }).first()
        if (await reviewBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
          await reviewBtn.click()
          await page.waitForTimeout(2000)

          const isMCQ = await page.getByRole('radio').isVisible({ timeout: 5000 }).catch(() => false)
          if (isMCQ) {
            logEvent({ type: 'session_review_test_start', day: dayNumber })
            const reviewResult = await handleMCQTest(page)
            result.reviewTest = reviewResult

            await page.waitForTimeout(3000)
            result.reviewTest.score = await captureScore(page)
            logEvent({ type: 'session_review_test_done', day: dayNumber, score: result.reviewTest?.score })
          }
        }
      }
    } else if (isMCQTest) {
      // Might have jumped to review test directly
      logEvent({ type: 'session_mcq_test_start', day: dayNumber })
      const mcqResult = await handleMCQTest(page)
      result.reviewTest = mcqResult
      await page.waitForTimeout(3000)
      result.reviewTest.score = await captureScore(page)
    }

    // Read post-session Firestore state
    await page.waitForTimeout(3000)

    const postCP = await readClassProgress()
    result.postCSD = postCP?.currentStudyDay ?? null

  } catch (err) {
    result.errors.push(err.message)
    logEvent({ type: 'session_error', day: dayNumber, error: err.message })
  }

  return result
}

// ---- Main audit loop ----
async function main() {
  logEvent({ type: 'audit_start', persona: 'careful', class: 'TOP', batch: 'B27' })

  // Read initial state
  const initialCP = await readClassProgress()
  const initialCSD = initialCP?.currentStudyDay ?? 1
  const initialTWI = initialCP?.totalWordsIntroduced ?? 0

  logEvent({ type: 'initial_state', CSD: initialCSD, TWI: initialTWI })
  console.log(`=== B27 careful/TOP audit starting ===`)
  console.log(`Initial CSD: ${initialCSD}, TWI: ${initialTWI}`)

  // Read all class_progress docs to check for orphan
  const allCPDocs = await readAllClassProgressDocs()
  console.log(`class_progress docs: ${allCPDocs.map(d => d.id).join(', ')}`)

  const orphanDoc = allCPDocs.find(d => d.id === CLASS_ID && d.id !== CP_DOC_ID)
  if (orphanDoc) {
    console.log(`ORPHAN DOC found: ${orphanDoc.id} (classId-only style, from prior pollution)`)
    logEvent({ type: 'orphan_doc_found', id: orphanDoc.id })
  }

  // The real starting day for the next session
  const startingDay = initialCSD + 1
  console.log(`Starting at Day ${startingDay} (next after CSD=${initialCSD})`)

  // Plan sessions
  const TARGET_SESSIONS = 20
  const sessions = []

  let currentDate = new Date(ANCHOR_DATE)

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH
  })

  const dayTable = [] // For findings report
  const findingsList = []

  try {
    for (let sessionIdx = 0; sessionIdx < TARGET_SESSIONS; sessionIdx++) {
      const dayNumber = startingDay + sessionIdx

      // Weekend skip
      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      }

      console.log(`\n--- Day ${dayNumber} | ${currentDate.toISOString().split('T')[0]} ---`)
      logEvent({ type: 'session_start', day: dayNumber, date: currentDate.toISOString() })

      // Read pre-session state
      const preCP = await readClassProgress()
      const preCSD = preCP?.currentStudyDay ?? dayNumber - 1
      const preTWI = preCP?.totalWordsIntroduced ?? 0
      const preRecentSessions = preCP?.recentSessions ?? []
      const preInterventionLevel = preCP?.interventionLevel ?? 0

      // Read study_states pre-session
      const preStudyStates = await readStudyStates()
      const statusHistPre = {}
      for (const ss of preStudyStates) {
        statusHistPre[ss.status] = (statusHistPre[ss.status] || 0) + 1
      }

      // Compute expected new word range
      const expNewRange = expectedNewWordRange(preTWI, DAILY_PACE, preInterventionLevel, LIST_SIZE)

      // Compute expected review segment
      const expSegment = calculateSegment(dayNumber, STUDY_DAYS_PER_WEEK, preTWI, DAILY_PACE, preInterventionLevel)

      // Compute review eligibility
      let eligibleIds = new Set()
      let retiredIds = new Set()
      if (expSegment) {
        const segmentStates = preStudyStates
          .filter(ss => ss.wordIndex !== undefined && ss.wordIndex !== null)
          .map(ss => ({
            position: ss.wordIndex,
            status: ss.status,
            returnAtMs: ss.returnAt ? (ss.returnAt._seconds * 1000) : null
          }))
        const nowMs = currentDate.getTime()
        const part = partitionReviewEligibility(segmentStates, expSegment, nowMs)
        eligibleIds = part.eligibleIds
        retiredIds = part.retiredIds
      }

      console.log(`Pre-state: CSD=${preCSD}, TWI=${preTWI}, intervention=${preInterventionLevel}`)
      console.log(`Expected new range: ${expNewRange ? `pos ${expNewRange.startIndex}-${expNewRange.endIndex} (${expNewRange.count} words)` : 'null'}`)
      console.log(`Expected segment: ${expSegment ? `pos ${expSegment.startIndex}-${expSegment.endIndex}` : 'null'}`)
      console.log(`Eligible for review: ${eligibleIds.size}, Retired (MASTERED): ${retiredIds.size}`)

      // Create browser context with Date.now shim
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 }
      })

      // Install Date.now shim
      await context.addInitScript((isoDate) => {
        const origNow = Date.now.bind(Date)
        const offset = new Date(isoDate).getTime() - origNow()
        window.__VOCABOOST_TIME_OFFSET__ = 0
        Date.now = () => origNow() + window.__VOCABOOST_TIME_OFFSET__ + offset
        window.__advanceTime = (ms) => { window.__VOCABOOST_TIME_OFFSET__ += ms }
      }, currentDate.toISOString())

      const page = await context.newPage()

      // Disable service workers
      await context.addInitScript(() => {
        if (navigator.serviceWorker) {
          navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
        }
      })

      let sessionResult

      try {
        // Login
        await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
        await page.waitForTimeout(2000)

        // Check if already logged in or need to login
        const needsLogin = await page.getByRole('link', { name: /log\s?in|sign\s?in/i }).isVisible({ timeout: 3000 }).catch(() => false)
        const emailField = await page.getByLabel(/email/i).isVisible({ timeout: 2000 }).catch(() => false)

        if (needsLogin) {
          await page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first().click()
        } else if (!emailField) {
          // Check if logged in as someone else, try evaluating
          await page.evaluate(() => {
            history.pushState({}, '', '/login')
            dispatchEvent(new PopStateEvent('popstate'))
          })
        }

        // Fill login form
        const emailInput = page.getByLabel(/email/i).first()
        if (await emailInput.isVisible({ timeout: 10000 }).catch(() => false)) {
          await emailInput.fill(EMAIL)
          await page.getByLabel(/password/i).first().fill(PASSWORD)
          await page.getByLabel(/password/i).first().press('Enter')

          // Wait for dashboard
          await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(async () => {
            const continueBtn = page.getByRole('button', { name: /continue|log\s?in/i }).first()
            if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await continueBtn.click()
              await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(() => {})
            }
          })
        }

        await page.waitForTimeout(2000)

        // Take screenshot of dashboard
        const screenshotPath = join(EVIDENCE_DIR, `day_${String(dayNumber).padStart(2, '0')}_dashboard.png`)
        await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {})

        // Run the session
        sessionResult = await runSession(page, currentDate, dayNumber, preCSD, preStudyStates)

        // Take post-session screenshot
        const postScreenPath = join(EVIDENCE_DIR, `day_${String(dayNumber).padStart(2, '0')}_post_session.png`)
        await page.screenshot({ path: postScreenPath, fullPage: false }).catch(() => {})

      } catch (loginErr) {
        sessionResult = {
          dayNumber,
          sessionDate: currentDate.toISOString(),
          started: false,
          newTest: { presentedWords: [], questionCount: 0, score: null },
          reviewTest: null,
          postCSD: null,
          violations: [],
          errors: [loginErr.message],
          blocked: true,
          blockedReason: `Login/navigation error: ${loginErr.message}`
        }
        logEvent({ type: 'login_error', day: dayNumber, error: loginErr.message })
      } finally {
        await page.close().catch(() => {})
        await context.close().catch(() => {})
      }

      // Read post-session state
      await new Promise(r => setTimeout(r, 2000)) // Let Firestore settle
      const postCP = await readClassProgress()
      const postCSD = postCP?.currentStudyDay ?? preCSD
      const postTWI = postCP?.totalWordsIntroduced ?? preTWI
      const postRecentSessions = postCP?.recentSessions ?? []

      // Read post study_states
      const postStudyStates = await readStudyStates()
      const statusHistPost = {}
      for (const ss of postStudyStates) {
        statusHistPost[ss.status] = (statusHistPost[ss.status] || 0) + 1
      }

      // MASTERED count and returnAt check
      const masteredWords = postStudyStates.filter(ss => ss.status === 'MASTERED')
      const masteredCount = masteredWords.length

      // Run word-correctness checks
      const newPresentedPositions = (sessionResult?.newTest?.presentedWords ?? [])
        .map(pw => pw.position)
        .filter(p => p >= 0)

      const reviewPresentedPositions = (sessionResult?.reviewTest?.presentedWords ?? [])
        .map(pw => pw.position)
        .filter(p => p >= 0)

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
      const csdAdvanced = sessionResult?.blocked ? null : (postCSD === dayNumber)
      const csdDrift = sessionResult?.blocked ? null : (!csdAdvanced ? `expected ${dayNumber} got ${postCSD}` : null)

      // Build day row
      const dayRow = {
        day: dayNumber,
        date: currentDate.toISOString().split('T')[0],
        preCSD,
        postCSD,
        expectedCSD: dayNumber,
        csdOk: csdAdvanced,
        csdDrift,
        preTWI,
        postTWI,
        expNewRange: expNewRange ? `${expNewRange.startIndex}-${expNewRange.endIndex}` : 'null',
        presentedNewCount: newPresentedPositions.length,
        newMatch: newViolations.length === 0,
        expSegment: expSegment ? `${expSegment.startIndex}-${expSegment.endIndex}` : 'null',
        eligibleCount: eligibleIds.size,
        retiredCount: retiredIds.size,
        presentedReviewCount: reviewPresentedPositions.length,
        reviewMatch: reviewViolations.length === 0,
        masteredCount,
        statusHistPost,
        violations: allViolations,
        newTestScore: sessionResult?.newTest?.score,
        reviewTestScore: sessionResult?.reviewTest?.score,
        blocked: sessionResult?.blocked ?? false,
        blockedReason: sessionResult?.blockedReason ?? null
      }

      dayTable.push(dayRow)
      sessions.push(sessionResult)

      // Save evidence JSON
      const evidenceData = {
        dayNumber,
        sessionDate: currentDate.toISOString(),
        preCSD,
        postCSD,
        preTWI,
        postTWI,
        expectedNewRange: expNewRange,
        expectedSegment: expSegment,
        eligibleForReview: eligibleIds.size,
        retiredFromReview: retiredIds.size,
        newTest: {
          presentedWords: sessionResult?.newTest?.presentedWords ?? [],
          presentedPositions: newPresentedPositions,
          questionCount: sessionResult?.newTest?.questionCount ?? 0,
          score: sessionResult?.newTest?.score
        },
        reviewTest: sessionResult?.reviewTest ? {
          presentedWords: sessionResult.reviewTest.presentedWords,
          presentedPositions: reviewPresentedPositions,
          questionCount: sessionResult.reviewTest.questionCount,
          score: sessionResult.reviewTest.score
        } : null,
        violations: allViolations,
        statusHistogramPost: statusHistPost,
        masteredWords: masteredWords.map(m => ({
          id: m.id,
          listId: m.listId,
          wordIndex: m.wordIndex,
          status: m.status,
          returnAt: m.returnAt,
          masteredAt: m.masteredAt
        })),
        errors: sessionResult?.errors ?? [],
        blocked: sessionResult?.blocked ?? false,
        blockedReason: sessionResult?.blockedReason ?? null,
        capturedAt: new Date().toISOString()
      }

      const evidencePath = join(EVIDENCE_DIR, `day_${String(dayNumber).padStart(2, '0')}.json`)
      writeFileSync(evidencePath, JSON.stringify(evidenceData, null, 2))
      console.log(`Day ${dayNumber} evidence saved: ${evidencePath}`)

      if (allViolations.length > 0) {
        console.log(`VIOLATIONS day ${dayNumber}:`, allViolations)
        findingsList.push({ day: dayNumber, violations: allViolations })
      }

      logEvent({ type: 'session_complete', day: dayNumber, postCSD, csdOk: csdAdvanced, violations: allViolations.length, masteredCount })

      // If blocked, still continue (don't abort walk)
      if (sessionResult?.blocked) {
        console.log(`Day ${dayNumber} BLOCKED: ${sessionResult.blockedReason}`)
        logEvent({ type: 'session_blocked', day: dayNumber, reason: sessionResult.blockedReason })
      }

      // Advance date for next session (skip weekends)
      currentDate = nextStudyDay(currentDate)
    }

    // ---- Final verification ----
    console.log('\n=== Final orphan doc check ===')
    const finalCPDocs = await readAllClassProgressDocs()
    const finalOrphan = finalCPDocs.find(d => d.id === CLASS_ID)
    const hasNewOrphan = finalCPDocs.filter(d => d.id !== CP_DOC_ID && !d.id.includes('_')).length > 0

    // Check attempts for orphan classId-only docs
    const finalAttempts = await readAttempts()
    const classIdOnlyAttempts = finalAttempts.filter(a => {
      const hasCorrectFormat = a.id.includes(`${CLASS_ID}_${LIST_ID}`) ||
                               a.id.includes(`vocaboost_test_${CLASS_ID}_${LIST_ID}`)
      return !hasCorrectFormat && a.studentId === UID
    })

    console.log(`All class_progress doc IDs: ${finalCPDocs.map(d => d.id).join(', ')}`)
    console.log(`Has new orphan docs: ${hasNewOrphan}`)
    console.log(`Attempts with non-standard IDs: ${classIdOnlyAttempts.length}`)

    logEvent({
      type: 'audit_complete',
      sessionsCompleted: sessions.filter(s => !s?.blocked).length,
      hasNewOrphan,
      classIdOnlyAttempts: classIdOnlyAttempts.length
    })

    return {
      dayTable,
      findingsList,
      sessions,
      initialCSD,
      startingDay,
      finalCPDocs: finalCPDocs.map(d => ({ id: d.id })),
      hasNewOrphan,
      classIdOnlyAttempts: classIdOnlyAttempts.length
    }

  } finally {
    await browser.close()
  }
}

// Run main
const result = await main()
console.log('\n=== AUDIT COMPLETE ===')
console.log(`Sessions completed: ${result.sessions.filter(s => !s?.blocked).length}/${result.sessions.length}`)
console.log(`Starting day: ${result.startingDay}`)
console.log(`Orphan docs created: ${result.hasNewOrphan}`)
console.log(`Day table:`)
for (const row of result.dayTable) {
  console.log(`  Day ${row.day}: CSD ${row.preCSD}→${row.postCSD} (ok:${row.csdOk}), newMatch:${row.newMatch}, reviewMatch:${row.reviewMatch}, MASTERED:${row.masteredCount}, blocked:${row.blocked}`)
}
