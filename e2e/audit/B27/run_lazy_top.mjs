/**
 * B27 Longitudinal Audit Runner — lazy/TOP persona
 * Label: L27
 * Batch: B27, persona: lazy, class: TOP
 *
 * Lazy persona transform: random_from_idk_set → types one of [idk, I don't know, 모름, ?, pass]
 * Deliberately FAILS tests → interventionLevel rises → fewer new words/day.
 * Day advancement must still occur under failure/suppression.
 *
 * ABSOLUTE RULE: Admin SDK read-only. No writes. UI-only state advancement.
 * F01 VERIFICATION: NO MASTERED word (future returnAt) in any review.
 */

import { chromium } from 'playwright'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'fs'
import { join } from 'path'

// ---- Config ----
const BASE_URL = 'https://vocaboostone.netlify.app'
const EMAIL = 'audit_lazy_01_top@vocaboost.test'
const PASSWORD = 'AuditPass2026!'
const UID = 'VBgBmlrlzXVPzURmABkdDBGtKd42'
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
const LIST_ID = '8RMews2H7C3UJUAsOBzR'
const CP_DOC_ID = `${CLASS_ID}_${LIST_ID}`

const DAILY_PACE = 80
const STUDY_DAYS_PER_WEEK = 5
const LIST_SIZE = 3381

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B27/lazy'
const AGENT_LOGS_DIR = '/app/audit/playwright/findings/agent_logs'
const SA_PATH = '/app/scripts/serviceAccountKey.json'

mkdirSync(EVIDENCE_DIR, { recursive: true })
mkdirSync(AGENT_LOGS_DIR, { recursive: true })

// Lazy persona idk set
const IDK_SET = ['idk', 'I don\'t know', '모름', '?', 'pass']
function lazyAnswer() {
  return IDK_SET[Math.floor(Math.random() * IDK_SET.length)]
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
  if (!text) return null
  return WORD_BY_TEXT[text.trim().toLowerCase()] || null
}

// ---- Expected words model ----
const {
  calculateInterventionLevel, expectedNewWordRange,
  calculateSegment, partitionReviewEligibility, checkPresentedWords
} = await import('/app/e2e/audit/helpers/expectedWords.js')

// ---- Logging ----
const jsonlPath = join(AGENT_LOGS_DIR, 'L27.jsonl')
function logEvent(event) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n'
  try { appendFileSync(jsonlPath, line) } catch (e) { console.error('log error:', e.message) }
}

function writeStatus(status) {
  writeFileSync(join(AGENT_LOGS_DIR, 'L27.status.json'), JSON.stringify(status, null, 2))
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
  await page.waitForTimeout(2000)
  const url = page.url()
  // If already redirected to dashboard (logged in), return
  if (!url.includes('/login') && !url.includes('login')) {
    // Check if we're actually logged in
    const bodyText = await page.locator('body').textContent().catch(() => '')
    if (bodyText.includes('Dashboard') || bodyText.includes('Day') || bodyText.includes('Session')) {
      return true
    }
  }
  // Navigate to login
  await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1000)
  // Fill credentials
  await page.locator('input[type="email"]').fill(EMAIL).catch(async () => {
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)
    await page.locator('input[type="email"]').fill(EMAIL)
  })
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /continue/i }).first().click()
  await page.waitForTimeout(5000)
  const finalUrl = page.url()
  if (finalUrl.includes('/login')) throw new Error('Login failed - still on login page')
  return true
}

async function getDashboardDay(page) {
  const bodyText = await page.locator('body').textContent().catch(() => '')
  const match = bodyText.match(/Day\s+(\d+)\s*(?:Start Session|Complete|Continue)/i)
  return match ? parseInt(match[1]) : null
}

async function verifyNewDayLoaded(page, expectedDay) {
  // H2 guard: ensure we're NOT on a stale Step 5 from prior day
  const bodyText = await page.locator('body').textContent().catch(() => '')
  const stepMatch = bodyText.match(/Step (\d+) of (\d+)/)
  if (stepMatch && parseInt(stepMatch[1]) === 5) {
    return { stale: true, step: 5 }
  }
  // Check for "Completed Day N" when we expected dayNumber
  if (bodyText.includes('Completed Day') && expectedDay) {
    const completedMatch = bodyText.match(/Completed Day (\d+)/)
    if (completedMatch && parseInt(completedMatch[1]) < expectedDay) {
      return { stale: true, completedDay: parseInt(completedMatch[1]) }
    }
  }
  return { stale: false }
}

async function startSessionFromDashboard(page) {
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
    await page.keyboard.press('Escape')
    return false
  }
  await skipText.click()
  await page.waitForTimeout(800)
  const startTestBtn = page.getByRole('button', { name: /start test/i }).first()
  if (await startTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await startTestBtn.click()
    await page.waitForTimeout(3000)
  }
  return true
}

// Lazy persona: type random idk answer char-by-char
async function completeTypedTestLazy(page) {
  const typedInputs = page.locator('input[placeholder="Type your definition..."]')
  const inputCount = await typedInputs.count()
  if (inputCount === 0) return { error: 'no typed inputs', presentedWords: [], score: null, questionCount: 0 }

  // Get word-input pairs
  const items = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[placeholder="Type your definition..."]')
    return Array.from(inputs).map(inp => {
      const container = inp.closest('div.rounded-xl') || inp.closest('div[class*="rounded-xl"]') || inp.parentElement?.parentElement
      const wordSpan = container?.querySelector('span.font-medium')
      return { word: wordSpan ? wordSpan.textContent.trim() : '' }
    })
  })

  const presentedWords = []
  for (let i = 0; i < inputCount; i++) {
    const wordEntry = lookupWord(items[i]?.word)
    presentedWords.push({ word: items[i]?.word || '', position: wordEntry?.position ?? -1 })
    // Type a lazy idk answer
    const answer = lazyAnswer()
    await typedInputs.nth(i).click()
    for (const char of answer) {
      await typedInputs.nth(i).type(char, { delay: 30 })
    }
  }

  // Submit
  const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
  if (!await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    return { error: 'Submit button not found', presentedWords, score: null, questionCount: inputCount }
  }
  await submitBtn.click()

  // Wait for grading (lazy answers → low score, fast AI rejection → ~5-15s)
  let score = null
  for (let t = 0; t < 12; t++) {
    await page.waitForTimeout(5000)
    const body = await page.locator('body').textContent().catch(() => '')
    if (body.includes('Completed Day') || body.match(/\d+%/) || body.includes(' of 30 correct') || body.includes('Your Answer')) {
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

  return { presentedWords, questionCount: inputCount, score }
}

// MCQ review test — lazy persona still needs to click something; picks random option
async function completeMCQTestLazy(page) {
  const presentedWords = []
  let answeredCount = 0
  const maxQ = 80

  for (let q = 0; q < maxQ; q++) {
    const bodyText = await page.locator('body').textContent().catch(() => '')
    if (!bodyText.includes('Review Test')) break

    // Get option buttons
    const optionBtns = page.locator('button[class*="rounded-2xl"], button[class*="min-h-\\[80px\\]"]')
    const optionCount = await optionBtns.count()

    if (optionCount === 0) {
      // Maybe submit is visible
      const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click()
        await page.waitForTimeout(5000)
        break
      }
      break
    }

    // Get current word from prominent heading
    const wordText = await page.evaluate(() => {
      const els = document.querySelectorAll('h1, h2, h3, [class*="text-2xl"], [class*="text-3xl"], [class*="font-bold"]')
      for (const el of els) {
        const t = el.textContent.trim()
        if (t.length > 0 && t.length < 60 && !t.includes('Review Test') && !t.includes('Step ') && !t.includes('Answered') && !t.includes('%')) {
          return t
        }
      }
      return null
    }).catch(() => null)

    const wordClean = wordText ? wordText.split('\n')[0].replace(/\s*\([^)]+\)\s*$/, '').trim() : ''
    const wordEntry = lookupWord(wordClean)
    presentedWords.push({ word: wordClean, position: wordEntry?.position ?? -1, notFound: !wordEntry })

    // Lazy persona: pick a WRONG option (first option — likely wrong since we know the correct)
    // To be lazy: just click whichever option first
    await optionBtns.first().click()
    answeredCount++
    await page.waitForTimeout(300)

    // Check answered count vs total
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
async function runOneSession(browser, sessionDate, dayNumber, opts = {}) {
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
    h2StaleHit: false,
    logoutLoginScenario: opts.logoutLoginScenario || false
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

    // Dashboard day
    const dashDay = await getDashboardDay(page)
    result.steps.push(`dashboard_day_${dashDay}`)

    // H2 guard - check for stale Step 5
    const staleCheck = await verifyNewDayLoaded(page, dayNumber)
    if (staleCheck.stale) {
      result.h2StaleHit = true
      result.steps.push('H2_stale_detected')
      // Navigate back to root and retry
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(2000)
      const staleCheck2 = await verifyNewDayLoaded(page, dayNumber)
      if (staleCheck2.stale) {
        result.blocked = true
        result.blockedReason = 'H2: persistent stale Step 5 screen - session already completed'
        result.steps.push('H2_still_stale_blocked')
        return result
      }
    }

    // Start session
    const sessionStart = await startSessionFromDashboard(page)
    if (sessionStart.error) {
      result.blocked = true
      result.blockedReason = sessionStart.error
      return result
    }
    result.steps.push(sessionStart.resumed ? 'session_resumed' : 'session_started')

    // ---- LOGOUT/LOGIN SCENARIO (run once on day 5 approx) ----
    if (opts.logoutLoginScenario) {
      result.steps.push('logout_login_scenario_start')

      // Dismiss flashcard modal
      await dismissFlashcardModal(page)

      // Skip to new word test
      const skipped = await skipToTestMenu(page)
      result.steps.push(skipped ? 'skip_to_typed_test' : 'skip_failed_pre_logout')

      // Start answering - type 3 lazy answers
      const typedInputs = page.locator('input[placeholder="Type your definition..."]')
      const inputCount = await typedInputs.count()

      const preLogoutAnswers = []
      const answeredBeforeLogout = Math.min(3, inputCount)
      for (let i = 0; i < answeredBeforeLogout; i++) {
        const answer = lazyAnswer()
        preLogoutAnswers.push(answer)
        await typedInputs.nth(i).click()
        for (const char of answer) {
          await typedInputs.nth(i).type(char, { delay: 30 })
        }
      }
      result.logoutLoginData = {
        answeredBeforeLogout,
        preLogoutAnswers,
        questionCount: inputCount
      }
      result.steps.push(`answered_${answeredBeforeLogout}_before_logout`)

      // Capture localStorage before logout
      const localStorageBefore = await page.evaluate(() => {
        const items = {}
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          items[key] = localStorage.getItem(key)
        }
        return items
      }).catch(() => ({}))
      result.logoutLoginData.localStorageKeysBefore = Object.keys(localStorageBefore)
      result.logoutLoginData.hasRecoveryState = Object.keys(localStorageBefore).some(k =>
        k.toLowerCase().includes('session') || k.toLowerCase().includes('test') || k.toLowerCase().includes('recover')
      )

      // Logout via app UI
      // Try finding account/profile menu for logout
      let loggedOut = false
      const profileBtn = page.locator('[aria-label*="profile"], [aria-label*="account"], [aria-label*="user"], button[class*="avatar"], img[class*="avatar"]').first()
      if (await profileBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await profileBtn.click()
        await page.waitForTimeout(500)
        const logoutBtn = page.getByRole('button', { name: /log.?out|sign.?out/i }).first()
        if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await logoutBtn.click()
          loggedOut = true
        }
      }

      if (!loggedOut) {
        // Try navigating to logout endpoint
        await page.goto(BASE_URL + '/logout', { timeout: 10000 }).catch(() => {})
        await page.waitForTimeout(2000)
        const urlAfterNav = page.url()
        if (urlAfterNav.includes('/login') || urlAfterNav.includes('login')) {
          loggedOut = true
        }
      }

      if (!loggedOut) {
        // Try clicking nav logout if visible
        const navLogout = page.getByText(/log out|sign out/i).first()
        if (await navLogout.isVisible({ timeout: 2000 }).catch(() => false)) {
          await navLogout.click()
          loggedOut = true
        }
      }

      result.logoutLoginData.loggedOut = loggedOut
      result.steps.push(loggedOut ? 'logout_ok' : 'logout_failed')

      await page.waitForTimeout(2000)

      // Capture localStorage after logout
      const localStorageAfter = await page.evaluate(() => {
        const items = {}
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          items[key] = localStorage.getItem(key)
        }
        return items
      }).catch(() => ({}))
      result.logoutLoginData.localStorageKeysAfter = Object.keys(localStorageAfter)

      // Log back in
      await loginAndLoadDashboard(page)
      result.steps.push('login_after_logout_ok')

      // Check for recovery prompt
      await page.waitForTimeout(2000)
      const bodyAfterLogin = await page.locator('body').textContent().catch(() => '')
      const hasRecoveryPrompt = bodyAfterLogin.toLowerCase().includes('recover') ||
        bodyAfterLogin.toLowerCase().includes('resume') ||
        bodyAfterLogin.toLowerCase().includes('continue where')

      const localStorageAfterLogin = await page.evaluate(() => {
        const items = {}
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          items[key] = localStorage.getItem(key)
        }
        return items
      }).catch(() => ({}))

      result.logoutLoginData.hasRecoveryPromptAfterLogin = hasRecoveryPrompt
      result.logoutLoginData.localStorageKeysAfterLogin = Object.keys(localStorageAfterLogin)

      // Try to restart session fresh
      const sessionStart2 = await startSessionFromDashboard(page)
      result.steps.push(sessionStart2.resumed ? 'session_resumed_after_login' : 'session_fresh_after_login')

      await dismissFlashcardModal(page)
      await skipToTestMenu(page)
    }

    // Dismiss flashcard modal
    await dismissFlashcardModal(page)

    // Get current step
    const bodyText1 = await page.locator('body').textContent().catch(() => '')
    const stepMatch = bodyText1.match(/Step (\d+) of (\d+)/)
    const currentStep = stepMatch ? parseInt(stepMatch[1]) : 1
    result.steps.push(`at_step_${currentStep}`)

    if (currentStep <= 2) {
      if (currentStep === 1) {
        const skipped = await skipToTestMenu(page)
        result.steps.push(skipped ? 'skip_to_typed_test' : 'skip_failed')
      }

      // Complete typed test with lazy answers
      const typedResult = await completeTypedTestLazy(page)
      result.newTest = typedResult
      result.steps.push(`typed_done_score_${typedResult.score}`)

      if (typedResult.error) result.errors.push(typedResult.error)

      // Wait for grading and advance
      await page.waitForTimeout(2000)
      let bodyText2 = await page.locator('body').textContent().catch(() => '')
      let step2Match = bodyText2.match(/Step (\d+) of (\d+)/)
      let afterStep = step2Match ? parseInt(step2Match[1]) : null

      // Click Continue if on Step 2 results
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

      // Handle review flow
      if (afterStep === 3 || bodyText2.includes('Review Study')) {
        await dismissFlashcardModal(page)
        const skipped2 = await skipToTestMenu(page)
        result.steps.push(skipped2 ? 'skip_to_review_test' : 'review_skip_failed')

        const reviewResult = await completeMCQTestLazy(page)
        result.reviewTest = reviewResult
        result.steps.push(`review_done_score_${reviewResult.score}`)
        await page.waitForTimeout(2000)
      } else if (afterStep === 4 || bodyText2.includes('Review Test')) {
        const reviewResult = await completeMCQTestLazy(page)
        result.reviewTest = reviewResult
        result.steps.push(`review_done_score_${reviewResult.score}`)
        await page.waitForTimeout(2000)
      }
    } else if (currentStep === 3) {
      await dismissFlashcardModal(page)
      const skipped = await skipToTestMenu(page)
      result.steps.push(skipped ? 'skip_to_review_test' : 'review_skip_failed')
      const reviewResult = await completeMCQTestLazy(page)
      result.reviewTest = reviewResult
      result.steps.push(`review_done_score_${reviewResult.score}`)
      await page.waitForTimeout(2000)
    } else if (currentStep === 4) {
      const reviewResult = await completeMCQTestLazy(page)
      result.reviewTest = reviewResult
      result.steps.push(`review_done_score_${reviewResult.score}`)
      await page.waitForTimeout(2000)
    } else if (currentStep === 5) {
      result.steps.push('already_at_results_step')
      result.blocked = true
      result.blockedReason = 'H2: At Step 5 (complete) when entering session'
      result.h2StaleHit = true
    }

    // Handle Step 5 completion
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
  logEvent({ type: 'audit_start', label: 'L27', persona: 'lazy', class: 'TOP', batch: 'B27', startedAt: new Date().toISOString() })
  writeStatus({ label: 'L27', status: 'running', startedAt: new Date().toISOString() })

  // Read initial state
  const initialCP = await readClassProgress()
  const initialCSD = initialCP?.currentStudyDay ?? 3
  const initialTWI = initialCP?.totalWordsIntroduced ?? 240

  console.log(`=== B27 lazy/TOP audit (L27) ===`)
  console.log(`Initial CSD: ${initialCSD}, TWI: ${initialTWI}`)
  console.log(`interventionLevel: ${initialCP?.interventionLevel}`)
  console.log(`recentSessions: ${JSON.stringify(initialCP?.recentSessions)}`)
  console.log(`Starting from Day ${initialCSD + 1}`)

  // Orphan check at start
  const allCPDocsBefore = await readAllClassProgressDocs()
  console.log(`class_progress docs at start: ${allCPDocsBefore.map(d => d.id).join(', ')}`)
  const orphansBefore = allCPDocsBefore.filter(d => !d.id.includes('_'))
  console.log(`Orphan docs before (classId-only): ${orphansBefore.length}`)

  const startingDay = initialCSD + 1
  const TARGET_SESSIONS = 20

  // Anchor date: dynamically set based on startingDay.
  // Days 1-5 used June 9-13 for careful. Day 5 for lazy corresponds to June 13 (Friday).
  // Day 6 = June 16 (Monday). Day 5 = CSD=5, starting on Day 6.
  // CSD=5 means we ran days 1-5. Day 6 starts Monday June 16, 2026.
  // Map: startingDay=6 → June 16 (Mon), 7→June 17, 8→June 18, 9→June 19, 10→June 20,
  //       11→June 23 (Mon, skip weekend), 12→June 24, ...
  // Simple approach: start at June 16 (Day 6) and advance weekday-by-weekday
  let currentDate = new Date('2026-06-16T09:00:00+09:00') // Monday June 16 = Day 6

  // If startingDay > 6, advance currentDate accordingly
  let tempDate = new Date('2026-06-16T09:00:00+09:00')
  for (let d = 6; d < startingDay; d++) {
    tempDate = nextStudyDate(tempDate)
  }
  currentDate = tempDate

  const dayTable = []
  const findingsList = []
  const allSessionResults = []
  let h2StaleCount = 0
  let stopConditionHit = false
  let stopReason = null
  let masteredInReviewDays = []

  // Logout/login scenario: run on session index 3 (Day startingDay+3)
  // We already ran days 4-5, so do logout/login on Day 9 (session index 3)
  const LOGOUT_LOGIN_DAY_IDX = 3 // fourth session

  let browser = await chromium.launch({
    headless: true,
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome'
  })

  async function ensureBrowser() {
    try {
      // Check if browser is still alive by checking contexts
      if (browser && !browser.isConnected()) {
        console.log('Browser disconnected, relaunching...')
        browser = await chromium.launch({
          headless: true,
          executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome'
        })
      }
    } catch (e) {
      console.log('Browser check failed, relaunching:', e.message)
      browser = await chromium.launch({
        headless: true,
        executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome'
      })
    }
    return browser
  }

  try {
    for (let sessionIdx = 0; sessionIdx < TARGET_SESSIONS; sessionIdx++) {
      const dayNumber = startingDay + sessionIdx

      // Skip weekends
      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      }

      // Ensure browser is alive before each session
      browser = await ensureBrowser()

      console.log(`\n=== Day ${dayNumber} | ${currentDate.toISOString().split('T')[0]} ===`)
      logEvent({ type: 'session_start', day: dayNumber, date: currentDate.toISOString() })

      // Read pre-session state (READ ONLY)
      const preCP = await readClassProgress()
      const preCSD = preCP?.currentStudyDay ?? (dayNumber - 1)
      const preTWI = preCP?.totalWordsIntroduced ?? 0
      const preInterventionLevel = preCP?.interventionLevel ?? 0
      const preRecentSessions = preCP?.recentSessions ?? []

      // Compute interventionLevel from recentSessions using expectedWords.js
      const recentReviewScores = preRecentSessions.map(s => s.reviewScore).filter(s => s != null)
      const computedInterventionLevel = calculateInterventionLevel(recentReviewScores)

      // Use class_progress.interventionLevel (already computed by app) or our model
      const effectiveInterventionLevel = preInterventionLevel

      // Pre study_states
      const preStudyStates = await readStudyStates()
      const statusHistPre = {}
      for (const ss of preStudyStates) {
        const s = ss.status || 'UNKNOWN'
        statusHistPre[s] = (statusHistPre[s] || 0) + 1
      }

      // Expected new word range (uses pre-test TWI)
      const expNewRange = expectedNewWordRange(preTWI, DAILY_PACE, effectiveInterventionLevel, LIST_SIZE)

      // Review segment (pre-test TWI — will also compute post-test TWI later)
      const expSegmentPre = calculateSegment(dayNumber, STUDY_DAYS_PER_WEEK, preTWI, DAILY_PACE, effectiveInterventionLevel)

      // Compute review eligibility (pre)
      let eligibleIdsPre = new Set()
      let retiredIdsPre = new Set()
      const nowMs = currentDate.getTime()
      if (expSegmentPre) {
        const segStates = preStudyStates.map(ss => ({
          position: ss.wordIndex ?? -1,
          status: ss.status,
          returnAtMs: ss.returnAt ? (ss.returnAt._seconds ? ss.returnAt._seconds * 1000 : ss.returnAt) : null
        })).filter(ss => ss.position >= 0)
        const part = partitionReviewEligibility(segStates, expSegmentPre, nowMs)
        eligibleIdsPre = part.eligibleIds
        retiredIdsPre = part.retiredIds
      }

      // Check for MASTERED with future returnAt (F01 verification)
      const masteredWithFutureReturnAt = preStudyStates.filter(ss => {
        if (ss.status !== 'MASTERED') return false
        if (!ss.returnAt) return false
        const returnAtMs = ss.returnAt._seconds ? ss.returnAt._seconds * 1000 : ss.returnAt
        return returnAtMs > nowMs
      })

      console.log(`Pre: CSD=${preCSD}, TWI=${preTWI}, interventionLevel=${effectiveInterventionLevel} (computed=${computedInterventionLevel.toFixed(3)})`)
      console.log(`Expected new: ${expNewRange ? `pos [${expNewRange.startIndex},${expNewRange.endIndex}] count=${expNewRange.count}` : 'null'}`)
      console.log(`Expected segment pre: ${expSegmentPre ? `pos [${expSegmentPre.startIndex},${expSegmentPre.endIndex}]` : 'null'}`)
      console.log(`Eligible pre: ${eligibleIdsPre.size}, Retired (MASTERED w/ returnAt): ${retiredIdsPre.size}`)
      console.log(`MASTERED with FUTURE returnAt: ${masteredWithFutureReturnAt.length}`)

      // Run session
      const doLogoutLogin = (sessionIdx === LOGOUT_LOGIN_DAY_IDX)
      const sessionResult = await runOneSession(browser, currentDate, dayNumber, {
        logoutLoginScenario: doLogoutLogin
      })
      allSessionResults.push(sessionResult)

      if (sessionResult.h2StaleHit) h2StaleCount++

      // Wait for Firestore to settle
      await new Promise(r => setTimeout(r, 4000))

      // POST-session state (read-only)
      const postCP = await readClassProgress()
      const postCSD = postCP?.currentStudyDay ?? preCSD
      const postTWI = postCP?.totalWordsIntroduced ?? preTWI
      const postInterventionLevel = postCP?.interventionLevel ?? effectiveInterventionLevel
      const postRecentSessions = postCP?.recentSessions ?? []

      const postStudyStates = await readStudyStates()
      const statusHistPost = {}
      for (const ss of postStudyStates) {
        const s = ss.status || 'UNKNOWN'
        statusHistPost[s] = (statusHistPost[s] || 0) + 1
      }

      const masteredWords = postStudyStates.filter(ss => ss.status === 'MASTERED')
      const masteredCount = masteredWords.length
      const masteredWithReturnAt = masteredWords.filter(m => m.returnAt != null)

      // Post-test TWI for segment calculation (the spec-required approach)
      const expSegmentPost = calculateSegment(dayNumber, STUDY_DAYS_PER_WEEK, postTWI, DAILY_PACE, postInterventionLevel)

      // Compute post-test eligibility
      let eligibleIdsPost = new Set()
      let retiredIdsPost = new Set()
      if (expSegmentPost) {
        const segStatesPost = postStudyStates.map(ss => ({
          position: ss.wordIndex ?? -1,
          status: ss.status,
          returnAtMs: ss.returnAt ? (ss.returnAt._seconds ? ss.returnAt._seconds * 1000 : ss.returnAt) : null
        })).filter(ss => ss.position >= 0)
        const partPost = partitionReviewEligibility(segStatesPost, expSegmentPost, nowMs)
        eligibleIdsPost = partPost.eligibleIds
        retiredIdsPost = partPost.retiredIds
      }

      // Word correctness checks
      const newPresentedPositions = (sessionResult.newTest?.presentedWords ?? [])
        .map(w => w.position).filter(p => p >= 0)
      const reviewPresentedPositions = (sessionResult.reviewTest?.presentedWords ?? [])
        .map(w => w.position).filter(p => p >= 0)

      // NEW word check uses pre-test TWI range
      const newViolations = checkPresentedWords({
        phase: 'new',
        presentedPositions: newPresentedPositions,
        expectedRange: expNewRange
      })

      // REVIEW check uses POST-test TWI to avoid false positives (canary lesson)
      const reviewViolations = expSegmentPost ? checkPresentedWords({
        phase: 'review',
        presentedPositions: reviewPresentedPositions,
        expectedRange: expSegmentPost,
        eligibleIds: eligibleIdsPost,
        retiredIds: retiredIdsPost
      }) : []

      // F01 check: any MASTERED word with future returnAt in the review?
      const masteredInReview = []
      for (const pos of reviewPresentedPositions) {
        const wordEntry = WORD_BY_POSITION[pos]
        if (!wordEntry) continue
        const wordSS = postStudyStates.find(ss => ss.wordId === wordEntry.id || ss.id === wordEntry.id)
        if (wordSS && wordSS.status === 'MASTERED') {
          const retAt = wordSS.returnAt
          const returnAtMs = retAt ? (retAt._seconds ? retAt._seconds * 1000 : retAt) : null
          if (returnAtMs && returnAtMs > nowMs) {
            masteredInReview.push({ pos, wordId: wordEntry.id, word: wordEntry.word, returnAtMs })
          }
        }
      }

      if (masteredInReview.length > 0) {
        masteredInReviewDays.push(dayNumber)
        console.log(`F01 ALERT: ${masteredInReview.length} MASTERED words with future returnAt in review on Day ${dayNumber}`)
        if (masteredInReviewDays.length >= 2) {
          stopConditionHit = true
          stopReason = `F01 REGRESSION: MASTERED words with future returnAt in review on days ${masteredInReviewDays.join(', ')}`
        }
      }

      const allViolations = [...newViolations, ...reviewViolations]

      const expectedPostCSD = sessionResult.blocked ? preCSD : dayNumber
      const csdOk = !sessionResult.blocked ? (postCSD === dayNumber) : null

      // Intervention level check: does it rise when review scores are low?
      const recentReviewScoresPost = postRecentSessions.map(s => s.reviewScore).filter(s => s != null)
      const computedInterventionPost = calculateInterventionLevel(recentReviewScoresPost)

      // Expected new word count for next session (verifying suppression)
      const expNewCountNext = expNewRange ? expNewRange.count : 0
      const newWordCount = Math.round(DAILY_PACE * (1 - postInterventionLevel))

      const dayRow = {
        day: dayNumber,
        date: currentDate.toISOString().split('T')[0],
        preCSD,
        postCSD,
        csdOk,
        csdDrift: !sessionResult.blocked && postCSD !== dayNumber ? `expected ${dayNumber} got ${postCSD}` : null,
        preTWI,
        postTWI,
        preInterventionLevel: effectiveInterventionLevel,
        postInterventionLevel,
        computedInterventionLevel: computedInterventionPost.toFixed(3),
        expNewRange: expNewRange ? `[${expNewRange.startIndex},${expNewRange.endIndex}](${expNewRange.count})` : 'null',
        presentedNewCount: newPresentedPositions.length,
        newMatch: newViolations.length === 0,
        expSegmentPost: expSegmentPost ? `[${expSegmentPost.startIndex},${expSegmentPost.endIndex}]` : 'null',
        eligiblePostCount: eligibleIdsPost.size,
        retiredPostCount: retiredIdsPost.size,
        presentedReviewCount: reviewPresentedPositions.length,
        reviewMatch: reviewViolations.length === 0,
        masteredInReviewCount: masteredInReview.length,
        masteredCount,
        masteredWithReturnAtCount: masteredWithReturnAt.length,
        newTestScore: sessionResult.newTest?.score,
        reviewTestScore: sessionResult.reviewTest?.score,
        newWordCountNext: newWordCount,
        violations: allViolations,
        steps: sessionResult.steps,
        blocked: sessionResult.blocked,
        blockedReason: sessionResult.blockedReason,
        h2StaleHit: sessionResult.h2StaleHit,
        logoutLoginScenario: sessionResult.logoutLoginScenario,
        errors: sessionResult.errors.slice(0, 3)
      }

      dayTable.push(dayRow)

      if (allViolations.length > 0) {
        console.log(`VIOLATIONS: ${allViolations.join('; ')}`)
        findingsList.push({ day: dayNumber, violations: allViolations })
      }

      console.log(`Post: CSD=${postCSD}(ok:${csdOk}), TWI=${postTWI}, IL=${postInterventionLevel.toFixed(3)}, MASTERED=${masteredCount}, newScore=${sessionResult.newTest?.score}, reviewScore=${sessionResult.reviewTest?.score}, V=${allViolations.length}, F01=${masteredInReview.length}, blocked=${sessionResult.blocked}`)

      // Save day evidence JSON
      const evidenceData = {
        dayNumber,
        sessionDate: currentDate.toISOString(),
        persona: 'lazy',
        preCSD, postCSD, preTWI, postTWI,
        preInterventionLevel: effectiveInterventionLevel,
        postInterventionLevel,
        computedInterventionLevel: computedInterventionPost,
        recentReviewScores: recentReviewScoresPost,
        expectedNewRange: expNewRange,
        expectedSegmentPost: expSegmentPost,
        eligibleForReview: eligibleIdsPost.size,
        retiredFromReview: retiredIdsPost.size,
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
        masteredInReview,
        statusHistogramPre: statusHistPre,
        statusHistogramPost: statusHistPost,
        masteredCount,
        masteredWithReturnAtCount: masteredWithReturnAt.length,
        masteredSample: masteredWords.slice(0, 3).map(m => ({
          id: m.id, wordId: m.wordId, status: m.status,
          returnAtSec: m.returnAt?._seconds ?? m.returnAt
        })),
        logoutLoginData: sessionResult.logoutLoginData || null,
        steps: sessionResult.steps,
        errors: sessionResult.errors,
        blocked: sessionResult.blocked,
        blockedReason: sessionResult.blockedReason,
        h2StaleHit: sessionResult.h2StaleHit,
        capturedAt: new Date().toISOString()
      }

      const evidencePath = join(EVIDENCE_DIR, `day_${String(dayNumber).padStart(2, '0')}.json`)
      writeFileSync(evidencePath, JSON.stringify(evidenceData, null, 2))

      logEvent({
        type: 'session_complete',
        day: dayNumber,
        preCSD, postCSD, preTWI, postTWI,
        preInterventionLevel: effectiveInterventionLevel,
        postInterventionLevel,
        masteredCount,
        masteredInReviewCount: masteredInReview.length,
        violations: allViolations.length,
        newScore: sessionResult.newTest?.score,
        reviewScore: sessionResult.reviewTest?.score,
        blocked: sessionResult.blocked,
        h2StaleHit: sessionResult.h2StaleHit
      })

      if (sessionResult.blocked) {
        console.log(`Day ${dayNumber} BLOCKED: ${sessionResult.blockedReason}`)
      }

      // Stop condition: F01 regression (2+ days)
      if (stopConditionHit) {
        console.log(`STOP CONDITION HIT: ${stopReason}`)
        logEvent({ type: 'stop_condition_hit', reason: stopReason, day: dayNumber })
        break
      }

      // Advance to next study day
      currentDate = nextStudyDate(currentDate)
    }

    // ---- Final orphan check ----
    console.log('\n=== Final orphan check ===')
    const finalAllCPDocs = await readAllClassProgressDocs()
    const finalOrphans = finalAllCPDocs.filter(d => !d.id.includes('_'))
    const newOrphansCreated = finalOrphans.filter(d => !orphansBefore.find(x => x.id === d.id))
    console.log(`class_progress docs: ${finalAllCPDocs.map(d => d.id).join(', ')}`)
    console.log(`Orphan (classId-only) docs: ${finalOrphans.length} (${newOrphansCreated.length} new)`)

    // Final attempts check
    const finalAttempts = await readAttempts()
    console.log(`Total attempts: ${finalAttempts.length}`)

    logEvent({
      type: 'audit_complete',
      sessionsCompleted: allSessionResults.filter(s => !s.blocked).length,
      totalSessions: allSessionResults.length,
      newOrphansCreated: newOrphansCreated.length,
      h2StaleCount,
      stopConditionHit,
      finalCPDocs: finalAllCPDocs.map(d => d.id)
    })

    return {
      dayTable,
      findingsList,
      initialCSD,
      startingDay,
      finalCPDocs: finalAllCPDocs.map(d => d.id),
      newOrphansCreated: newOrphansCreated.length,
      orphansBefore: orphansBefore.length,
      orphansAfter: finalOrphans.length,
      sessionsCompleted: allSessionResults.filter(s => !s.blocked).length,
      totalSessions: allSessionResults.length,
      h2StaleCount,
      stopConditionHit,
      stopReason,
      masteredInReviewDays
    }

  } finally {
    await browser.close()
  }
}

const result = await main()

console.log('\n=== B27 LAZY/TOP AUDIT COMPLETE ===')
console.log(`Starting day: ${result.startingDay}`)
console.log(`Sessions completed: ${result.sessionsCompleted}/${result.totalSessions}`)
console.log(`H2 stale hits: ${result.h2StaleCount}`)
console.log(`New orphan docs created: ${result.newOrphansCreated}`)
console.log(`Stop condition hit: ${result.stopConditionHit}`)
if (result.stopConditionHit) console.log(`Stop reason: ${result.stopReason}`)
console.log(`Mastered-in-review days: ${result.masteredInReviewDays.join(', ') || 'none'}`)
console.log(`Final class_progress docs: ${result.finalCPDocs.join(', ')}`)

console.log('\nDay table:')
for (const row of result.dayTable) {
  const f01 = row.masteredInReviewCount > 0 ? ` F01=${row.masteredInReviewCount}` : ''
  console.log(`  Day ${row.day}: CSD ${row.preCSD}→${row.postCSD}(ok:${row.csdOk}), IL=${row.preInterventionLevel.toFixed(2)}→${row.postInterventionLevel.toFixed(2)}, new=[${row.expNewRange}]→${row.presentedNewCount}(match:${row.newMatch}), review=${row.presentedReviewCount}(match:${row.reviewMatch}${f01}), MASTERED=${row.masteredCount}, newScore=${row.newTestScore}, reviewScore=${row.reviewTestScore}, V=${row.violations.length}, blocked=${row.blocked}`)
}

if (result.findingsList.length > 0) {
  console.log('\nViolations:')
  for (const f of result.findingsList) {
    console.log(`  Day ${f.day}: ${f.violations.join('; ')}`)
  }
}

// Write summary
const summaryPath = join('/app/audit/playwright/findings/evidence/B27/lazy', 'audit_summary.json')
writeFileSync(summaryPath, JSON.stringify(result, null, 2))
console.log(`\nSummary: ${summaryPath}`)
