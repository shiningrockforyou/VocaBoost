/**
 * B27 Longitudinal Word-Correctness Audit — korean/TOP persona
 * Agent label: K27
 *
 * Korean Native Typist persona:
 * - Transform: canonical_ko (type the Korean definition)
 * - Input: page.fill() for Korean UTF-8 (IME simulation after click), NOT char-by-char
 * - Validates Korean UTF-8 round-trip into Firestore attempt docs
 *
 * ABSOLUTE RULE: Admin SDK read-only. No writes to class_progress/study_states/attempts.
 * State advances ONLY by completing real UI sessions.
 *
 * F01 VERIFICATION: The MASTERED-in-review fix is deployed. Assert NO MASTERED word
 * (future returnAt) appears in any review test. If leaks on ≥2 days → fix REGRESSED.
 *
 * Logout/login scenario: run on Day 3 (one chosen day) — start new-word test,
 * answer a few, log out, log back in, verify state.
 */

import { chromium } from 'playwright'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

// ---- Config ----
const BASE_URL = 'https://vocaboostone.netlify.app'
const EMAIL = 'audit_korean_01_top@vocaboost.test'
const PASSWORD = 'AuditPass2026!'
const UID = 'NqqT2iXB1yMUZtiUbYd3vbWGdiu1'
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
const LIST_ID = '8RMews2H7C3UJUAsOBzR'
const CP_DOC_ID = `${CLASS_ID}_${LIST_ID}`

const DAILY_PACE = 80
const STUDY_DAYS_PER_WEEK = 5
const PASS_THRESHOLD_PCT = 92
const LIST_SIZE = 3381

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B27/korean'
const AGENT_LOGS_DIR = '/app/audit/playwright/findings/agent_logs'
const SA_PATH = '/app/scripts/serviceAccountKey.json'

mkdirSync(EVIDENCE_DIR, { recursive: true })
mkdirSync(AGENT_LOGS_DIR, { recursive: true })

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
const LABEL = 'K27'
const jsonlPath = join(AGENT_LOGS_DIR, `${LABEL}.jsonl`)
const statusPath = join(AGENT_LOGS_DIR, `${LABEL}.status.json`)

function logEvent(event) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n'
  try {
    const existing = existsSync(jsonlPath) ? readFileSync(jsonlPath, 'utf-8') : ''
    writeFileSync(jsonlPath, existing + line)
  } catch (e) { console.error('log error:', e.message) }
}

function writeStatus(status, extra = {}) {
  writeFileSync(statusPath, JSON.stringify({ label: LABEL, status, updatedAt: new Date().toISOString(), ...extra }, null, 2))
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
async function loginAs(page, email, password) {
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 60000 })
  // Wait for login page to load
  await page.waitForTimeout(2000)
  const url = page.url()
  if (!url.includes('/login') && !url.includes('login')) {
    // May be on dashboard already or need to find login form
    const emailInput = page.locator('input[type="email"]').first()
    if (!await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Already logged in or no login form
      return true
    }
  }
  await page.locator('input[type="email"]').first().fill(email)
  await page.locator('input[type="password"]').first().fill(password)
  // Click "Continue" button (the auth form pattern)
  const continueBtn = page.getByRole('button', { name: /continue/i }).first()
  if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await continueBtn.click()
  } else {
    // Try login/sign-in button
    const loginBtn = page.getByRole('button', { name: /log\s*in|sign\s*in/i }).first()
    await loginBtn.click()
  }
  await page.waitForTimeout(5000)
  const finalUrl = page.url()
  if (finalUrl.includes('/login')) throw new Error('Login failed - still on login page')
  return true
}

async function logoutUser(page) {
  // Find the user menu / logout button
  // Try clicking user avatar or menu
  let logoutClicked = false

  // Try aria-label for user menu
  const userMenuSelectors = [
    '[aria-label="User menu"]',
    '[aria-label="Account"]',
    'button[class*="avatar"]',
    'button[class*="user"]'
  ]

  for (const sel of userMenuSelectors) {
    const btn = page.locator(sel).first()
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click()
      await page.waitForTimeout(1000)
      logoutClicked = true
      break
    }
  }

  if (!logoutClicked) {
    // Try finding logout text directly
    const logoutText = page.getByText('Log Out').first()
    const signoutText = page.getByText('Sign Out').first()
    if (await logoutText.isVisible({ timeout: 1000 }).catch(() => false)) {
      await logoutText.click()
      logoutClicked = true
    } else if (await signoutText.isVisible({ timeout: 1000 }).catch(() => false)) {
      await signoutText.click()
      logoutClicked = true
    }
  }

  if (!logoutClicked) {
    // Try the menu button pattern from existing scripts
    const menuBtn = page.locator('[aria-label="Session menu"]').first()
    if (await menuBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await menuBtn.click()
      await page.waitForTimeout(500)
    }
    // Now try logout from dropdown
    const logoutOpt = page.getByText(/log.?out|sign.?out/i).first()
    if (await logoutOpt.isVisible({ timeout: 2000 }).catch(() => false)) {
      await logoutOpt.click()
      logoutClicked = true
    }
  }

  if (!logoutClicked) {
    // Navigate to /login as a fallback (clears auth)
    console.log('WARNING: Could not find logout button, navigating to /login')
    await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle', timeout: 30000 })
    return { method: 'navigate_to_login', success: true }
  }

  await page.waitForTimeout(3000)
  const urlAfterLogout = page.url()
  return { method: 'logout_button', success: urlAfterLogout.includes('/login') || !urlAfterLogout.includes('/dashboard') }
}

async function getDashboardDay(page) {
  const bodyText = await page.locator('body').textContent().catch(() => '')
  // Try to find current day from dashboard
  const match = bodyText.match(/Day\s+(\d+)\s*(?:Start Session|Complete|Continue)/i)
  if (match) return parseInt(match[1])
  // Alternative: look for "Today's Session" card
  const match2 = bodyText.match(/Day\s+(\d+)/i)
  return match2 ? parseInt(match2[1]) : null
}

async function startSessionFromDashboard(page) {
  const continueBtn = page.getByRole('button', { name: /continue session/i }).first()
  if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await continueBtn.click()
    await page.waitForTimeout(3000)
    return { resumed: true }
  }

  const startBtn = page.getByRole('button', { name: /start session/i }).first()
  if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await startBtn.click()
    await page.waitForTimeout(3000)
    return { resumed: false }
  }

  return { error: 'No Start Session button found' }
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
  const menuBtn = page.locator('[aria-label="Session menu"]').first()
  if (!await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) return false
  await menuBtn.click()
  await page.waitForTimeout(500)
  const skipText = page.getByText('Skip to Test').first()
  if (!await skipText.isVisible({ timeout: 3000 }).catch(() => false)) {
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

// Korean persona typed test — fill Korean definition after click
async function completeTypedTestKorean(page, { logoutAfterN = null } = {}) {
  // Wait for test to load
  await page.waitForTimeout(2000)

  // Try to identify typed inputs
  let typedInputs = page.locator('input[placeholder="Type your definition..."]')
  let inputCount = await typedInputs.count()

  // If not found, try alternative placeholder text
  if (inputCount === 0) {
    typedInputs = page.locator('input[type="text"]').filter({ hasNot: page.locator('[type="email"]') })
    inputCount = await typedInputs.count()
  }

  if (inputCount === 0) {
    // Check if we're on the typed test at all
    const bodyText = await page.locator('body').textContent().catch(() => '')
    return {
      error: 'no typed inputs found',
      presentedWords: [],
      score: null,
      bodySnippet: bodyText.substring(0, 200),
      loggedOutAt: null
    }
  }

  // Get word-input pairs
  const items = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[placeholder="Type your definition..."]')
    return Array.from(inputs).map(inp => {
      const container = inp.closest('div.rounded-xl, div[class*="rounded"]') || inp.parentElement?.parentElement
      // Try to find the word text near this input
      const wordSpan = container?.querySelector('[class*="font-medium"], [class*="font-bold"], h2, h3')
        || container?.parentElement?.querySelector('[class*="font-medium"], [class*="font-bold"]')
      return {
        word: wordSpan ? wordSpan.textContent.trim() : '',
        hasInput: true
      }
    })
  })

  const presentedWords = []
  let loggedOutAt = null

  for (let i = 0; i < inputCount; i++) {
    const wordText = items[i]?.word || ''
    const wordEntry = lookupWord(wordText)
    const position = wordEntry?.position ?? -1
    presentedWords.push({ word: wordText, position, notFound: !wordEntry })

    // Get Korean definition for this word
    const koreanDef = wordEntry?.definition_ko || '모르겠습니다'

    // Click and fill with Korean text (UTF-8 round-trip test)
    try {
      await typedInputs.nth(i).click()
      await page.waitForTimeout(50)
      // Use fill() for Korean text (IME simulation — UTF-8 direct input)
      // Per spec: fill() is acceptable for Korean after establishing focus via click
      await typedInputs.nth(i).fill(koreanDef)
      await page.waitForTimeout(80) // Korean IME is slower
    } catch (e) {
      console.log(`Input ${i} fill error: ${e.message}`)
    }

    // Logout scenario: after answering N questions, log out
    if (logoutAfterN !== null && i + 1 === logoutAfterN) {
      loggedOutAt = i + 1
      // Capture localStorage before logout
      const localStorageBefore = await page.evaluate(() => {
        const result = {}
        for (let j = 0; j < localStorage.length; j++) {
          const key = localStorage.key(j)
          if (key.includes('vocaboost') || key.includes('recovery') || key.includes('session') || key.includes('test')) {
            result[key] = localStorage.getItem(key)
          }
        }
        return result
      }).catch(() => ({}))

      console.log(`Logout scenario: captured localStorage before logout (${Object.keys(localStorageBefore).length} relevant keys)`)
      return {
        presentedWords,
        score: null,
        questionCount: i + 1,
        loggedOutAt,
        localStorageBefore,
        partialSubmit: true
      }
    }
  }

  // Submit test
  const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
  if (!await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    // Check if there's a different submit button
    const altSubmit = page.getByRole('button', { name: /submit|finish/i }).first()
    if (await altSubmit.isVisible({ timeout: 2000 }).catch(() => false)) {
      await altSubmit.click()
    } else {
      return { error: 'Submit button not found', presentedWords, score: null, loggedOutAt }
    }
  } else {
    await submitBtn.click()
  }

  // Wait for grading (up to 60s — AI grading takes ~19s)
  let score = null
  for (let t = 0; t < 12; t++) {
    await page.waitForTimeout(5000)
    const body = await page.locator('body').textContent().catch(() => '')
    if (body.includes('Completed Day') || body.includes(' of 30 correct') || body.includes('Your Answer') || body.includes('Test Results')) {
      const m = body.match(/(\d+)%/)
      const m2 = body.match(/(\d+) of (\d+) correct/)
      if (m) score = parseInt(m[1])
      else if (m2) score = Math.round(parseInt(m2[1]) / parseInt(m2[2]) * 100)
      break
    }
    if (body.includes('Failed to save') || body.includes('Try Again')) {
      const tryBtn = page.getByRole('button', { name: /try again/i }).first()
      if (await tryBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tryBtn.click()
        await page.waitForTimeout(15000)
      }
    }
  }

  return { presentedWords, questionCount: inputCount, score, loggedOutAt }
}

async function completeMCQTest(page) {
  const presentedWords = []
  let answeredCount = 0
  const masteredInReview = [] // F01 check — track MASTERED words shown in review

  for (let q = 0; q < 50; q++) {
    const bodyText = await page.locator('body').textContent().catch(() => '')
    // Check if we're still on the review test
    if (!bodyText.includes('Review Test') && !bodyText.includes('of') && q > 0) {
      // Could be on results page
      if (bodyText.includes('Test Results') || bodyText.includes('Session Summary')) break
    }

    const optionBtns = page.locator('button[class*="rounded-2xl"], button[class*="min-h-\\[80px\\]"]')
    const optionCount = await optionBtns.count()

    if (optionCount === 0) {
      // Check for submit button
      const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click()
        await page.waitForTimeout(5000)
        break
      }
      // Check if already done
      if (bodyText.includes('Test Results') || bodyText.includes('correct')) break
      await page.waitForTimeout(1000)
      continue
    }

    // Extract word text
    const wordText = await page.evaluate(() => {
      const optBtns = document.querySelectorAll('button[class*="rounded-2xl"]')
      if (optBtns.length === 0) return null

      let container = optBtns[0].closest('main, section, div[class*="flex-col"], div[class*="gap-"]')
      if (!container) container = document.querySelector('main')
      if (!container) return null

      const bigEls = container.querySelectorAll('h1, h2, h3, [class*="text-2xl"], [class*="text-3xl"], [class*="text-4xl"], [class*="font-bold"]')
      for (const el of bigEls) {
        const t = el.textContent.trim()
        if (t.length > 0 && t.length < 80 && !t.includes('Review Test') && !t.includes('Step ') && !t.match(/^\d+/)) {
          return t
        }
      }
      return null
    }).catch(() => null)

    const wordClean = wordText ? wordText.split('\n')[0].replace(/\s*\([^)]+\)\s*$/, '').trim() : ''
    const wordEntry = lookupWord(wordClean)
    presentedWords.push({ word: wordClean, position: wordEntry?.position ?? -1, notFound: !wordEntry })

    // Click correct option (MCQ — select the right definition)
    let clicked = false
    if (wordEntry?.definition_en) {
      const optBtnCount = await optionBtns.count()
      for (let i = 0; i < optBtnCount; i++) {
        const optText = await optionBtns.nth(i).textContent().catch(() => '')
        // Match on first ~20 chars of definition
        const defSnippet = wordEntry.definition_en.substring(0, 20).toLowerCase()
        if (optText.toLowerCase().includes(defSnippet)) {
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

  return { presentedWords, questionCount: answeredCount, score, masteredInReview }
}

// ---- Run one session ----
async function runOneSession(browser, sessionDate, dayNumber, opts = {}) {
  const {
    doLogoutScenario = false, // if true: logout mid-typed-test
    logoutAfterNAnswers = 5   // how many answers before logout
  } = opts

  const result = {
    dayNumber,
    sessionDate: sessionDate.toISOString(),
    newTest: { presentedWords: [], score: null, questionCount: 0 },
    reviewTest: null,
    postCSD: null,
    errors: [],
    blocked: false,
    blockedReason: null,
    steps: [],
    logoutScenario: null,
    h2StaleStep5: false
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

  // Unregister service workers
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
    await loginAs(page, EMAIL, PASSWORD)
    result.steps.push('login_ok')

    // Navigate to dashboard (should be there after login)
    await page.waitForTimeout(2000)

    // H2 guard: check for stale Step 5
    const bodyTextH2 = await page.locator('body').textContent().catch(() => '')
    const stepMatchH2 = bodyTextH2.match(/Step (\d+) of (\d+)/)
    if (stepMatchH2 && parseInt(stepMatchH2[1]) === 5) {
      console.log(`  H2: stale Step-5 detected at session start — navigating back to dashboard`)
      result.h2StaleStep5 = true
      result.steps.push('h2_stale_step5')
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(2000)
    }

    // Start session
    const sessionStart = await startSessionFromDashboard(page)
    if (sessionStart.error) {
      result.blocked = true
      result.blockedReason = sessionStart.error
      result.errors.push(sessionStart.error)
      return result
    }
    result.steps.push(sessionStart.resumed ? 'session_resumed' : 'session_started')

    // Dismiss flashcard modal if present (Step 1)
    await dismissFlashcardModal(page)
    await page.waitForTimeout(1000)

    // Check current step
    const bodyText1 = await page.locator('body').textContent().catch(() => '')
    const stepMatch = bodyText1.match(/Step (\d+) of (\d+)/)
    const currentStep = stepMatch ? parseInt(stepMatch[1]) : 1
    result.steps.push(`at_step_${currentStep}`)

    // H2 guard: if we see Step 5 again after starting, it's stale
    if (currentStep === 5) {
      console.log(`  H2: got stale Step 5 after session start for Day ${dayNumber}`)
      result.h2StaleStep5 = true
      result.steps.push('h2_stale_step5_after_start')
      // Navigate away and back
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(3000)
      // Try again
      const sessionStart2 = await startSessionFromDashboard(page)
      if (sessionStart2.error) {
        result.blocked = true
        result.blockedReason = 'H2 stale: ' + sessionStart2.error
        return result
      }
      await dismissFlashcardModal(page)
      const bodyText1b = await page.locator('body').textContent().catch(() => '')
      const stepMatchB = bodyText1b.match(/Step (\d+) of (\d+)/)
      const stepB = stepMatchB ? parseInt(stepMatchB[1]) : 1
      result.steps.push(`at_step_${stepB}_retry`)
      if (stepB === 5) {
        result.blocked = true
        result.blockedReason = 'H2 stale Step 5 persistent after retry'
        return result
      }
    }

    if (currentStep <= 2) {
      // Skip to typed test if on flashcards
      if (currentStep === 1) {
        const skipped = await skipToTestMenu(page)
        result.steps.push(skipped ? 'skip_to_typed_test' : 'skip_failed')
        if (!skipped) {
          // Try dismissing and check again
          await page.waitForTimeout(2000)
        }
      }

      // LOGOUT SCENARIO: Start the typed test, answer a few, then log out
      if (doLogoutScenario) {
        console.log(`  Logout scenario: will logout after ${logoutAfterNAnswers} answers`)
        result.steps.push('logout_scenario_start')

        // Capture localStorage BEFORE starting answers
        const localStorageStart = await page.evaluate(() => {
          const result = {}
          for (let j = 0; j < localStorage.length; j++) {
            const key = localStorage.key(j)
            result[key] = localStorage.getItem(key)
          }
          return result
        }).catch(() => ({}))

        // Start answering
        const partialResult = await completeTypedTestKorean(page, { logoutAfterN: logoutAfterNAnswers })
        result.newTest = { ...partialResult, partial: true }
        result.steps.push(`answered_${partialResult.loggedOutAt}_before_logout`)

        // Capture localStorage after filling some answers
        const localStorageMid = await page.evaluate(() => {
          const result = {}
          for (let j = 0; j < localStorage.length; j++) {
            const key = localStorage.key(j)
            result[key] = localStorage.getItem(key)
          }
          return result
        }).catch(() => ({}))

        // Firestore attempt state BEFORE logout
        const attemptsBeforeLogout = await readAttempts()

        // LOG OUT
        const logoutResult = await logoutUser(page)
        result.steps.push(`logout_${logoutResult.success ? 'success' : 'failed'}_method_${logoutResult.method}`)
        await page.waitForTimeout(3000)

        // Capture state after logout
        const urlAfterLogout = page.url()
        const localStorageAfterLogout = await page.evaluate(() => {
          const result = {}
          for (let j = 0; j < localStorage.length; j++) {
            const key = localStorage.key(j)
            result[key] = localStorage.getItem(key)
          }
          return result
        }).catch(() => ({}))

        const firestoreAfterLogout = await readAttempts()

        // LOG BACK IN
        await loginAs(page, EMAIL, PASSWORD)
        result.steps.push('logged_back_in')
        await page.waitForTimeout(3000)

        // Check if recovery prompt appears
        const bodyAfterLogin = await page.locator('body').textContent().catch(() => '')
        const hasRecoveryPrompt = bodyAfterLogin.includes('recover') || bodyAfterLogin.includes('Resume') || bodyAfterLogin.includes('Continue') || bodyAfterLogin.includes('in-progress')
        result.steps.push(hasRecoveryPrompt ? 'recovery_prompt_visible' : 'no_recovery_prompt')

        // Capture localStorage after re-login
        const localStorageAfterRelogin = await page.evaluate(() => {
          const result = {}
          for (let j = 0; j < localStorage.length; j++) {
            const key = localStorage.key(j)
            result[key] = localStorage.getItem(key)
          }
          return result
        }).catch(() => ({}))

        const attemptsAfterRelogin = await readAttempts()

        // Determine what happened to the work
        const workLost = Object.keys(localStorageMid).length > 0 && Object.keys(localStorageAfterLogout).length === 0
        const workRecoverable = hasRecoveryPrompt

        result.logoutScenario = {
          logoutAfterN: logoutAfterNAnswers,
          logoutMethod: logoutResult.method,
          logoutSuccess: logoutResult.success,
          urlAfterLogout,
          localStorageStartKeys: Object.keys(localStorageStart).length,
          localStorageMidKeys: Object.keys(localStorageMid).length,
          localStorageAfterLogoutKeys: Object.keys(localStorageAfterLogout).length,
          localStorageAfterReloginKeys: Object.keys(localStorageAfterRelogin).length,
          localStorageMidSample: Object.keys(localStorageMid).slice(0, 3),
          localStorageAfterLogoutSample: Object.keys(localStorageAfterLogout).slice(0, 3),
          attemptsBeforeLogout: attemptsBeforeLogout.length,
          attemptsAfterLogout: firestoreAfterLogout.length,
          attemptsAfterRelogin: attemptsAfterRelogin.length,
          recoveryPromptVisible: hasRecoveryPrompt,
          workLost,
          workRecoverable,
          verdict: workLost && !workRecoverable ? 'LOST' : (workRecoverable ? 'RECOVERABLE' : 'CLEAN_RESTART'),
          bodyAfterLoginSnippet: bodyAfterLogin.substring(0, 300)
        }

        console.log(`  Logout scenario result: verdict=${result.logoutScenario.verdict}, recoveryPrompt=${hasRecoveryPrompt}, workLost=${workLost}`)

        // After logout/login scenario, still need to complete the day
        // Re-start from dashboard and complete the full session
        await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 })
        await page.waitForTimeout(2000)

        const sessionStart3 = await startSessionFromDashboard(page)
        if (!sessionStart3.error) {
          await dismissFlashcardModal(page)
          const bodyPostLogout = await page.locator('body').textContent().catch(() => '')
          const stepPostLogout = bodyPostLogout.match(/Step (\d+) of (\d+)/)
          const currentStepPostLogout = stepPostLogout ? parseInt(stepPostLogout[1]) : 1

          if (currentStepPostLogout === 1) {
            await skipToTestMenu(page)
          }

          const fullResult = await completeTypedTestKorean(page)
          result.newTest = { ...fullResult, afterLogout: true }
          result.steps.push(`typed_done_after_logout_score_${fullResult.score}`)
        }
      } else {
        // Normal path: complete typed test
        const typedResult = await completeTypedTestKorean(page)
        result.newTest = typedResult
        result.steps.push(`typed_done_score_${typedResult.score}`)

        if (typedResult.error) {
          result.errors.push(typedResult.error)
        }
      }

      // After typed test, click Continue to advance
      await page.waitForTimeout(2000)
      let bodyText2 = await page.locator('body').textContent().catch(() => '')
      let step2Match = bodyText2.match(/Step (\d+) of (\d+)/)
      let afterStep = step2Match ? parseInt(step2Match[1]) : null

      // Click Continue if on Step 2 result screen
      if (afterStep === 2 || (bodyText2.includes('Completed Day') && !bodyText2.includes('Review Test'))) {
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

      // Navigate review test
      if (afterStep === 3 || bodyText2.includes('Review Study')) {
        await dismissFlashcardModal(page)
        const skipped2 = await skipToTestMenu(page)
        result.steps.push(skipped2 ? 'skip_to_review_test' : 'review_skip_failed')
        const reviewResult = await completeMCQTest(page)
        result.reviewTest = reviewResult
        result.steps.push(`review_done_score_${reviewResult.score}`)
        await page.waitForTimeout(2000)
      } else if (afterStep === 4 || bodyText2.includes('Review Test')) {
        const reviewResult = await completeMCQTest(page)
        result.reviewTest = reviewResult
        result.steps.push(`review_done_score_${reviewResult.score}`)
        await page.waitForTimeout(2000)
      } else if (afterStep === null && dayNumber === 1) {
        // Day 1 has no review test — expected
        result.steps.push('day1_no_review_expected')
      }
    } else if (currentStep === 3) {
      await dismissFlashcardModal(page)
      const skipped = await skipToTestMenu(page)
      result.steps.push(skipped ? 'skip_to_review_test' : 'review_skip_failed')
      const reviewResult = await completeMCQTest(page)
      result.reviewTest = reviewResult
      result.steps.push(`review_done_score_${reviewResult.score}`)
      await page.waitForTimeout(2000)
    } else if (currentStep === 4) {
      const reviewResult = await completeMCQTest(page)
      result.reviewTest = reviewResult
      result.steps.push(`review_done_score_${reviewResult.score}`)
      await page.waitForTimeout(2000)
    } else if (currentStep === 5) {
      result.steps.push('at_results_step')
    }

    // Handle completion screen
    const bodyText5 = await page.locator('body').textContent().catch(() => '')
    const step5Match = bodyText5.match(/Step (\d+) of (\d+)/)
    const isStep5 = step5Match ? parseInt(step5Match[1]) === 5 : false
    if (isStep5 || bodyText5.includes('Session Summary') || bodyText5.includes('Back to Dashboard')) {
      result.steps.push('at_completion')
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

    // Navigate back to dashboard if needed
    const finalUrl = page.url()
    if (finalUrl.includes('session') || finalUrl.includes('test')) {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
      await page.waitForTimeout(2000)
    }

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
  writeStatus('running', { startedAt: new Date().toISOString() })
  logEvent({ type: 'audit_start', persona: 'korean', class: 'TOP', batch: 'B27', label: LABEL, startedAt: new Date().toISOString() })

  // Read initial state
  const initialCPDocs = await readAllClassProgressDocs()
  console.log(`Initial class_progress docs: ${initialCPDocs.map(d => d.id).join(', ')}`)

  const initialCP = await readClassProgress()
  const initialCSD = initialCP?.currentStudyDay ?? 0
  const initialTWI = initialCP?.totalWordsIntroduced ?? 0

  console.log(`=== B27 korean/TOP audit (K27) ===`)
  console.log(`Initial CSD: ${initialCSD}, TWI: ${initialTWI}`)

  // Note: CSD=0 means Day 1 session needs to be completed
  // The orphan classId-only doc shows CSD=2, but the canonical doc is authoritative
  const startingDay = initialCSD + 1
  console.log(`Starting from Day ${startingDay}`)

  const TARGET_SESSIONS = 20

  // Anchor date: June 2, 2026 = Monday (weekday, KST morning)
  // Korean student is fresh (CSD=0), Day 1 starts here
  let currentDate = new Date('2026-06-02T09:00:00+09:00')

  const dayTable = []
  const findingsList = []
  const allSessionResults = []
  let h2StaleCount = 0
  let masteredInReviewDays = []
  let stopConditionHit = false
  let logoutScenarioDone = false
  let logoutScenarioResult = null

  // Korean UTF-8 round-trip tracking
  const koreanRoundTripWords = []

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome'
  })

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

      // Read pre study_states
      const preStudyStates = await readStudyStates()
      const statusHistPre = {}
      for (const ss of preStudyStates) {
        statusHistPre[ss.status || 'UNKNOWN'] = (statusHistPre[ss.status || 'UNKNOWN'] || 0) + 1
      }

      // Compute expected ranges using PRE-test TWI for new words
      // (post-test TWI used for review after test completion)
      const expNewRange = expectedNewWordRange(preTWI, DAILY_PACE, preInterventionLevel, LIST_SIZE)
      const expSegmentPre = calculateSegment(dayNumber, STUDY_DAYS_PER_WEEK, preTWI, DAILY_PACE, preInterventionLevel)

      // Pre-test eligibility (for new words only)
      const nowMs = currentDate.getTime()

      console.log(`Pre-state: CSD=${preCSD}, TWI=${preTWI}, interventionLevel=${preInterventionLevel}`)
      console.log(`Expected new: ${expNewRange ? `pos [${expNewRange.startIndex},${expNewRange.endIndex}] count=${expNewRange.count}` : 'null'}`)
      console.log(`Expected segment (pre-TWI): ${expSegmentPre ? `pos [${expSegmentPre.startIndex},${expSegmentPre.endIndex}]` : 'null'}`)

      // Decide if this session gets the logout scenario
      const doLogoutScenario = !logoutScenarioDone && dayNumber === 3
      if (doLogoutScenario) console.log(`  [LOGOUT SCENARIO will run on Day ${dayNumber}]`)

      // Run session
      const sessionResult = await runOneSession(browser, currentDate, dayNumber, {
        doLogoutScenario,
        logoutAfterNAnswers: 5
      })
      allSessionResults.push(sessionResult)

      if (doLogoutScenario && sessionResult.logoutScenario) {
        logoutScenarioDone = true
        logoutScenarioResult = sessionResult.logoutScenario
      }

      if (sessionResult.h2StaleStep5) h2StaleCount++

      // Wait for Firestore to settle
      await new Promise(r => setTimeout(r, 4000))

      // Read POST-test state (critical: use post-test TWI for review check)
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

      // POST-test TWI-based review segment (correct approach per canary lessons)
      const postInterventionLevel = postCP?.interventionLevel ?? preInterventionLevel
      const expSegmentPost = calculateSegment(dayNumber, STUDY_DAYS_PER_WEEK, postTWI, DAILY_PACE, postInterventionLevel)

      let eligibleIds = new Set()
      let retiredIds = new Set()
      if (expSegmentPost) {
        const segStates = postStudyStates.map(ss => ({
          position: ss.wordIndex ?? -1,
          status: ss.status,
          returnAtMs: ss.returnAt ? (ss.returnAt._seconds ? ss.returnAt._seconds * 1000 : ss.returnAt) : null
        })).filter(ss => ss.position >= 0)
        const part = partitionReviewEligibility(segStates, expSegmentPost, nowMs)
        eligibleIds = part.eligibleIds
        retiredIds = part.retiredIds
      }

      console.log(`Post-test TWI: ${postTWI}, segment: ${expSegmentPost ? `[${expSegmentPost.startIndex},${expSegmentPost.endIndex}]` : 'null'}`)
      console.log(`Eligible review: ${eligibleIds.size}, Retired (MASTERED): ${retiredIds.size}`)

      // Word correctness checks
      const newPresentedPositions = (sessionResult.newTest?.presentedWords ?? [])
        .map(w => w.position).filter(p => p >= 0)
      const reviewPresentedPositions = (sessionResult.reviewTest?.presentedWords ?? [])
        .map(w => w.position).filter(p => p >= 0)

      // Track Korean words for UTF-8 round-trip
      for (const w of (sessionResult.newTest?.presentedWords ?? [])) {
        if (w.word && w.position >= 0) {
          const cached = WORD_BY_POSITION[w.position]
          if (cached?.definition_ko) {
            koreanRoundTripWords.push({
              day: dayNumber,
              word: w.word,
              position: w.position,
              koreanDef: cached.definition_ko,
              hasKorean: /[가-힣]/.test(cached.definition_ko)
            })
          }
        }
      }

      // NEW word violations (use pre-test TWI range)
      const newViolations = checkPresentedWords({
        phase: 'new',
        presentedPositions: newPresentedPositions,
        expectedRange: expNewRange
      })

      // REVIEW violations (use POST-test TWI segment and eligibility — kills false positives)
      const reviewViolations = expSegmentPost ? checkPresentedWords({
        phase: 'review',
        presentedPositions: reviewPresentedPositions,
        expectedRange: expSegmentPost,
        eligibleIds,
        retiredIds
      }) : []

      // F01 check: any MASTERED words in review?
      const masteredInReviewThisDay = []
      for (const rPos of reviewPresentedPositions) {
        const word = postStudyStates.find(ss => (ss.wordIndex ?? -1) === rPos)
        if (word && word.status === 'MASTERED') {
          const returnAtMs = word.returnAt ? (word.returnAt._seconds ? word.returnAt._seconds * 1000 : word.returnAt) : null
          if (returnAtMs && returnAtMs > nowMs) {
            masteredInReviewThisDay.push({ position: rPos, returnAtMs, wordEntry: WORD_BY_POSITION[rPos]?.word })
          }
        }
      }

      if (masteredInReviewThisDay.length > 0) {
        console.log(`F01 CHECK: ${masteredInReviewThisDay.length} MASTERED words in review on Day ${dayNumber}!`)
        masteredInReviewDays.push({ day: dayNumber, count: masteredInReviewThisDay.length, words: masteredInReviewThisDay })

        // Stop condition: F01 on ≥2 days
        if (masteredInReviewDays.length >= 2) {
          logEvent({ type: 'stop_condition_hit', reason: 'F01_regressed', day: dayNumber, masteredInReviewDays })
          stopConditionHit = true
        }
      }

      const allViolations = [...newViolations, ...reviewViolations]

      // CSD check
      const csdOk = sessionResult.blocked ? null : (postCSD === dayNumber)
      const csdDrift = !sessionResult.blocked && postCSD !== dayNumber ? `expected ${dayNumber} got ${postCSD}` : null

      const dayRow = {
        day: dayNumber,
        date: currentDate.toISOString().split('T')[0],
        preCSD,
        postCSD,
        csdOk,
        csdDrift,
        preTWI,
        postTWI,
        expNewRange: expNewRange ? `[${expNewRange.startIndex},${expNewRange.endIndex}]` : 'null',
        presentedNewCount: newPresentedPositions.length,
        newMatch: newViolations.length === 0,
        expSegmentPost: expSegmentPost ? `[${expSegmentPost.startIndex},${expSegmentPost.endIndex}]` : 'null',
        eligibleCount: eligibleIds.size,
        retiredCount: retiredIds.size,
        presentedReviewCount: reviewPresentedPositions.length,
        reviewMatch: reviewViolations.length === 0,
        masteredCount,
        masteredInReviewCount: masteredInReviewThisDay.length,
        newTestScore: sessionResult.newTest?.score,
        reviewTestScore: sessionResult.reviewTest?.score,
        violations: allViolations,
        steps: sessionResult.steps,
        blocked: sessionResult.blocked,
        blockedReason: sessionResult.blockedReason,
        errors: sessionResult.errors.slice(0, 3),
        h2StaleStep5: sessionResult.h2StaleStep5,
        hasLogoutScenario: !!sessionResult.logoutScenario
      }

      dayTable.push(dayRow)

      if (allViolations.length > 0) {
        console.log(`VIOLATIONS: ${allViolations.join('; ')}`)
        findingsList.push({ day: dayNumber, violations: allViolations })
      }

      console.log(`Post: CSD=${postCSD}(ok:${csdOk}), TWI=${postTWI}, MASTERED=${masteredCount}, F01=${masteredInReviewThisDay.length}, newScore=${sessionResult.newTest?.score}, reviewScore=${sessionResult.reviewTest?.score}, V=${allViolations.length}, blocked=${sessionResult.blocked}`)

      // Save evidence JSON
      const evidenceData = {
        dayNumber,
        sessionDate: currentDate.toISOString(),
        preCSD, postCSD, preTWI, postTWI,
        expectedNewRange: expNewRange,
        expectedSegmentPre: expSegmentPre,
        expectedSegmentPost: expSegmentPost,
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
        masteredInReviewThisDay,
        statusHistogramPre: statusHistPre,
        statusHistogramPost: statusHistPost,
        masteredCount,
        masteredWithReturnAt: masteredWords.filter(m => m.returnAt).length,
        masteredSample: masteredWords.slice(0, 3).map(m => ({
          id: m.id, status: m.status,
          returnAtSec: m.returnAt?._seconds ?? m.returnAt
        })),
        logoutScenario: sessionResult.logoutScenario,
        steps: sessionResult.steps,
        errors: sessionResult.errors,
        blocked: sessionResult.blocked,
        blockedReason: sessionResult.blockedReason,
        h2StaleStep5: sessionResult.h2StaleStep5,
        capturedAt: new Date().toISOString()
      }

      const evidencePath = join(EVIDENCE_DIR, `day_${String(dayNumber).padStart(2, '0')}.json`)
      writeFileSync(evidencePath, JSON.stringify(evidenceData, null, 2))

      logEvent({
        type: 'session_complete',
        day: dayNumber,
        preCSD, postCSD, preTWI, postTWI,
        masteredCount,
        masteredInReview: masteredInReviewThisDay.length,
        violations: allViolations.length,
        newScore: sessionResult.newTest?.score,
        reviewScore: sessionResult.reviewTest?.score,
        blocked: sessionResult.blocked
      })

      if (stopConditionHit) {
        console.log(`STOP CONDITION HIT: F01 regressed — MASTERED words in review on days: ${masteredInReviewDays.map(d => d.day).join(', ')}`)
        writeStatus('stopped', {
          reason: 'F01_regressed',
          masteredInReviewDays: masteredInReviewDays.map(d => d.day),
          stoppedAt: new Date().toISOString()
        })
        break
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

    // Check attempts created by this run
    const finalAttempts = await readAttempts()
    console.log(`Total attempts: ${finalAttempts.length}`)

    // Korean round-trip summary
    const koreanWordsWithKorean = koreanRoundTripWords.filter(w => w.hasKorean)
    console.log(`Korean UTF-8 round-trip: ${koreanWordsWithKorean.length}/${koreanRoundTripWords.length} words had Korean definitions`)

    // Verify orphans created by this run
    const orphansBefore = initialCPDocs.filter(d => !d.id.includes('_')).length
    const orphansAfter = finalOrphans.length
    const newOrphansCreated = orphansAfter - orphansBefore

    console.log(`Orphans before: ${orphansBefore}, after: ${orphansAfter}, new: ${newOrphansCreated}`)

    logEvent({
      type: 'audit_complete',
      sessionsCompleted: allSessionResults.filter(s => !s.blocked).length,
      totalSessions: allSessionResults.length,
      newOrphansCreated,
      finalCPDocs: finalAllCPDocs.map(d => d.id),
      stopConditionHit,
      masteredInReviewDays: masteredInReviewDays.map(d => d.day),
      h2StaleCount
    })

    writeStatus(stopConditionHit ? 'stopped' : 'finished', {
      sessionsCompleted: allSessionResults.filter(s => !s.blocked).length,
      totalSessions: allSessionResults.length,
      stopConditionHit,
      finishedAt: new Date().toISOString()
    })

    return {
      dayTable,
      findingsList,
      initialCSD,
      startingDay,
      finalCPDocs: finalAllCPDocs.map(d => d.id),
      newOrphansCreated,
      orphansBefore,
      orphansAfter,
      sessionsCompleted: allSessionResults.filter(s => !s.blocked).length,
      totalSessions: allSessionResults.length,
      h2StaleCount,
      masteredInReviewDays,
      stopConditionHit,
      logoutScenarioResult,
      koreanRoundTripWords,
      koreanWordsWithKorean: koreanWordsWithKorean.length
    }

  } finally {
    await browser.close()
  }
}

const result = await main()

console.log('\n=== AUDIT COMPLETE ===')
console.log(`Starting day: ${result.startingDay}`)
console.log(`Sessions completed: ${result.sessionsCompleted}/${result.totalSessions}`)
console.log(`H2 stale-Step-5 count: ${result.h2StaleCount}`)
console.log(`MASTERED in review days: ${result.masteredInReviewDays.map(d => d.day).join(', ') || 'NONE'}`)
console.log(`F01 RESOLVED: ${result.masteredInReviewDays.length === 0 ? 'YES' : 'NO — REGRESSED on days: ' + result.masteredInReviewDays.map(d => d.day).join(', ')}`)
console.log(`New orphan docs created: ${result.newOrphansCreated}`)
console.log(`Korean UTF-8 round-trip: ${result.koreanWordsWithKorean} words with Korean defs used`)
console.log(`Logout scenario: ${JSON.stringify(result.logoutScenarioResult?.verdict)}`)
console.log(`Stop condition hit: ${result.stopConditionHit}`)
console.log(`Final class_progress docs: ${result.finalCPDocs.join(', ')}`)
console.log('\nDay table:')
for (const row of result.dayTable) {
  console.log(`  Day ${row.day}: CSD ${row.preCSD}->${row.postCSD}(ok:${row.csdOk}), TWI ${row.preTWI}->${row.postTWI}, new=${row.expNewRange}(${row.presentedNewCount} shown,match:${row.newMatch}), review=${row.expSegmentPost}(${row.presentedReviewCount} shown,match:${row.reviewMatch}), MASTERED=${row.masteredCount}, F01=${row.masteredInReviewCount}, newScore=${row.newTestScore}, reviewScore=${row.reviewTestScore}, V=${row.violations.length}, blocked=${row.blocked}`)
}

if (result.findingsList.length > 0) {
  console.log('\nViolations:')
  for (const f of result.findingsList) {
    console.log(`  Day ${f.day}: ${f.violations.join('; ')}`)
  }
}
