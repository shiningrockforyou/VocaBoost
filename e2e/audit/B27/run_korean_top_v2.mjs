/**
 * B27 Longitudinal Word-Correctness Audit — korean/TOP persona v2
 * Agent label: K27
 *
 * v2 fixes:
 * 1. H2 stale Step 5: instead of page.goto (which times out with networkidle),
 *    click the completion button directly, then wait for dashboard to load.
 * 2. H2 guard happens INSIDE runOneSession, BEFORE starting session nav.
 * 3. Logout scenario moved to Day 5 (Day 3 was blocked in v1 by H2).
 * 4. MCQ word extraction improved.
 * 5. page.goto uses 'load' not 'networkidle' to avoid Netlify SPA timeouts.
 *
 * Korean Native Typist persona:
 * - Transform: canonical_ko (Korean definition via page.fill after click)
 * - Validates Korean UTF-8 round-trip
 *
 * ABSOLUTE RULE: Admin SDK read-only. UI-only state advancement.
 * F01 VERIFICATION: Assert NO MASTERED word (future returnAt) in any review test.
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
// Also index with normalized word (no trailing annotations like "\r\n(old English)")
for (const w of WORD_CACHE) {
  const normalized = w.word.split(/\r?\n/)[0].trim().toLowerCase()
  if (!WORD_BY_TEXT[normalized]) WORD_BY_TEXT[normalized] = w
}

function lookupWord(text) {
  if (!text) return null
  const clean = text.trim().toLowerCase()
  if (WORD_BY_TEXT[clean]) return WORD_BY_TEXT[clean]
  // Try just the first line
  const firstLine = clean.split(/\r?\n/)[0].trim()
  return WORD_BY_TEXT[firstLine] || null
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

// ---- Safe navigation: load instead of networkidle ----
async function safeGoto(page, url, timeoutMs = 15000) {
  try {
    await page.goto(url, { waitUntil: 'load', timeout: timeoutMs })
  } catch (e) {
    // If load times out (rare), just wait and continue
    console.log(`  safeGoto: timeout for ${url}, continuing`)
  }
  await page.waitForTimeout(2000)
}

// ---- Browser helpers ----
async function loginAs(page, email, password) {
  await safeGoto(page, BASE_URL + '/')
  await page.waitForTimeout(2000)

  // Check if already at dashboard
  if (!page.url().includes('/login')) {
    const emailInput = page.locator('input[type="email"]').first()
    if (!await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      return true // Already logged in
    }
  }

  // Fill credentials
  await page.locator('input[type="email"]').first().fill(email)
  await page.locator('input[type="password"]').first().fill(password)

  // Click Continue or Login
  const continueBtn = page.getByRole('button', { name: /continue/i }).first()
  if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await continueBtn.click()
  } else {
    await page.getByRole('button', { name: /log\s*in|sign\s*in/i }).first().click()
  }

  await page.waitForTimeout(5000)
  if (page.url().includes('/login')) throw new Error('Login failed - still on login page')
  return true
}

// Dismiss any "start studying" modal that appears
async function dismissFlashcardModal(page) {
  const btn = page.getByRole('button', { name: /start studying/i }).first()
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btn.click()
    await page.waitForTimeout(800)
    return true
  }
  return false
}

// H2 fix: handle stale completion screen by clicking through it
async function handleStaleCompletionScreen(page) {
  const body = await page.locator('body').textContent().catch(() => '')
  const stepMatch = body.match(/Step (\d+) of (\d+)/)
  const isStep5 = stepMatch ? parseInt(stepMatch[1]) === 5 : false
  const isCompletion = isStep5 || body.includes('Session Summary') || body.includes('Back to Dashboard') || body.includes('Completed Day')

  if (!isCompletion) return false

  console.log('  H2: completion/Step-5 screen detected, clicking through')

  // Try "Move On to Next Day" first, then "Back to Dashboard"
  const moveOnBtn = page.getByRole('button', { name: /move on to next day/i }).first()
  const backBtn = page.getByRole('button', { name: /back to dashboard/i }).first()
  const continueBtn = page.getByRole('button', { name: /continue/i }).first()

  if (await moveOnBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await moveOnBtn.click()
    await page.waitForTimeout(3000)
    return true
  } else if (await backBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await backBtn.click()
    await page.waitForTimeout(3000)
    return true
  } else if (await continueBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await continueBtn.click()
    await page.waitForTimeout(2000)
    return true
  }

  // If no button found, navigate to dashboard
  await safeGoto(page, BASE_URL + '/')
  return true
}

async function startSessionFromDashboard(page) {
  // First handle any stale completion screen
  await handleStaleCompletionScreen(page)
  await page.waitForTimeout(1000)

  // Now try to start
  const continueBtn = page.getByRole('button', { name: /continue session/i }).first()
  if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await continueBtn.click()
    await page.waitForTimeout(3000)
    return { resumed: true }
  }

  // IMPORTANT (harness fix): there are TWO "Start Session" buttons on the dashboard —
  // the big hero-card one (~252x56) which enters the session correctly, and a smaller
  // one in the class list (~160x53). Clicking the wrong one led to a stale Step 5.
  // Pick the LARGEST visible Start Session button.
  const startBtns = page.getByRole('button', { name: /start session/i })
  const count = await startBtns.count()
  if (count > 0) {
    let bestIdx = 0, bestArea = -1
    for (let i = 0; i < count; i++) {
      const box = await startBtns.nth(i).boundingBox().catch(() => null)
      if (box && box.width * box.height > bestArea) { bestArea = box.width * box.height; bestIdx = i }
    }
    await startBtns.nth(bestIdx).click().catch(() => {})
    await page.waitForTimeout(4000)
    return { resumed: false }
  }

  return { error: 'No Start Session button found on dashboard' }
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

  // Confirm dialog
  const startTestBtn = page.getByRole('button', { name: /start test/i }).first()
  if (await startTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await startTestBtn.click()
    await page.waitForTimeout(3000)
  }
  return true
}

// Korean typed test: fill with canonical_ko definition
async function completeTypedTestKorean(page, opts = {}) {
  const { logoutAfterN = null } = opts
  await page.waitForTimeout(2000)

  // Wait for test to load
  let typedInputs = page.locator('input[placeholder="Type your definition..."]')
  let inputCount = 0

  // Poll for inputs up to 10s
  for (let t = 0; t < 5; t++) {
    inputCount = await typedInputs.count()
    if (inputCount > 0) break
    await page.waitForTimeout(2000)
    typedInputs = page.locator('input[placeholder="Type your definition..."]')
  }

  if (inputCount === 0) {
    const body = await page.locator('body').textContent().catch(() => '')
    return {
      error: 'no typed inputs found',
      presentedWords: [],
      score: null,
      bodySnippet: body.substring(0, 300),
      loggedOutAt: null
    }
  }

  // Extract word-input pairs from DOM
  const items = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[placeholder="Type your definition..."]')
    return Array.from(inputs).map(inp => {
      // Walk up to find word container
      let el = inp.parentElement
      for (let depth = 0; depth < 6 && el; depth++, el = el.parentElement) {
        const spans = el.querySelectorAll('[class*="font-medium"], [class*="font-bold"], [class*="font-semibold"]')
        for (const span of spans) {
          const t = span.textContent.trim()
          if (t.length > 1 && t.length < 100) return { word: t }
        }
      }
      return { word: '' }
    })
  })

  const presentedWords = []
  let loggedOutAt = null

  for (let i = 0; i < inputCount; i++) {
    const wordText = (items[i]?.word || '').split(/\r?\n/)[0].trim()
    const wordEntry = lookupWord(wordText)
    const position = wordEntry?.position ?? -1
    presentedWords.push({ word: wordText, position, notFound: !wordEntry })

    // Korean definition (UTF-8 round-trip)
    const koreanDef = wordEntry?.definition_ko || '모르겠습니다'

    try {
      await typedInputs.nth(i).click()
      await page.waitForTimeout(80)
      // fill() for Korean — IME direct input after establishing focus
      await typedInputs.nth(i).fill(koreanDef)
      await page.waitForTimeout(80)
    } catch (e) {
      console.log(`  Input ${i} fill error: ${e.message.substring(0, 80)}`)
    }

    // Logout scenario: stop mid-test
    if (logoutAfterN !== null && i + 1 === logoutAfterN) {
      loggedOutAt = i + 1
      const localStorageMid = await page.evaluate(() => {
        const r = {}
        for (let j = 0; j < localStorage.length; j++) {
          const k = localStorage.key(j)
          r[k] = localStorage.getItem(k)
        }
        return r
      }).catch(() => ({}))
      return { presentedWords, score: null, questionCount: i + 1, loggedOutAt, localStorageMid, partial: true }
    }
  }

  // Submit
  const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
  if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await submitBtn.click()
  } else {
    return { error: 'Submit button not found', presentedWords, score: null, loggedOutAt }
  }

  // Wait for grading (AI grading ~19s per submission)
  let score = null
  for (let t = 0; t < 14; t++) {
    await page.waitForTimeout(5000)
    const body = await page.locator('body').textContent().catch(() => '')
    if (body.includes('Completed Day') || body.includes(' correct') || body.includes('Your Answer') || body.includes('Test Results')) {
      const m = body.match(/(\d+)%/)
      const m2 = body.match(/(\d+) of (\d+) correct/)
      if (m) score = parseInt(m[1])
      else if (m2) score = Math.round(parseInt(m2[1]) / parseInt(m2[2]) * 100)
      break
    }
    // Handle retry
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

  for (let q = 0; q < 60; q++) {
    await page.waitForTimeout(500)
    const bodyText = await page.locator('body').textContent().catch(() => '')

    // Done?
    if (bodyText.includes('Test Results') || bodyText.includes('Session Summary')) break

    // Find option buttons (MCQ choices)
    // The MCQ buttons are typically large rounded buttons in a grid
    const optionBtns = page.locator('button').filter({
      has: page.locator('text=/[A-Za-z]/').first()
    }).filter({ hasNotText: /submit|skip|menu|back|continue|dashboard/i })

    // Try specific MCQ layout selectors
    let mcqBtns = page.locator('[class*="grid"] button, [class*="option"] button, button[class*="rounded-2xl"], button[class*="min-h"]')
    let mcqCount = await mcqBtns.count()

    if (mcqCount === 0) {
      // No MCQ buttons — check for submit
      const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click()
        await page.waitForTimeout(5000)
        break
      }
      // Check if test is done
      if (bodyText.match(/(\d+) of (\d+) correct/) || bodyText.includes('Test Results')) break
      await page.waitForTimeout(1000)
      continue
    }

    // Extract the word being tested
    const wordInfo = await page.evaluate(() => {
      // MCQ: find the question word — usually displayed prominently above options
      const main = document.querySelector('main') || document.body
      const candidates = main.querySelectorAll('h1, h2, h3, p[class*="text-2xl"], p[class*="text-3xl"], span[class*="text-2xl"], div[class*="text-3xl"], div[class*="text-2xl"], [class*="font-bold"]')

      for (const el of candidates) {
        const t = el.textContent.trim()
        // Skip step indicators and instructions
        if (t.match(/^\d+$/) || t.includes('Review Test') || t.includes('Step ') || t.includes('of ') || t.length > 80 || t.length < 2) continue
        // A vocabulary word is usually 1-3 words
        const wordCount = t.split(/\s+/).length
        if (wordCount <= 4) return { word: t, method: 'heading' }
      }

      // Fallback: look for text in "of N answered" pattern context
      const progressText = main.textContent.match(/(\d+) of (\d+) answered/)
      if (progressText) {
        // Find word-like text before the options
        const allText = main.textContent
        const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0)
        for (const line of lines) {
          if (line.length > 1 && line.length < 50 && !line.match(/^\d/) && !line.includes('answered') && !line.includes('Review')) {
            return { word: line, method: 'fallback' }
          }
        }
      }
      return { word: '', method: 'none' }
    }).catch(() => ({ word: '', method: 'error' }))

    const wordClean = wordInfo.word.split(/\r?\n/)[0].replace(/\s*\([^)]+\)\s*$/, '').trim()
    const wordEntry = lookupWord(wordClean)
    presentedWords.push({ word: wordClean, position: wordEntry?.position ?? -1, notFound: !wordEntry, method: wordInfo.method })

    // Select correct answer
    let clicked = false
    if (wordEntry?.definition_en) {
      const optCount = await mcqBtns.count()
      for (let i = 0; i < optCount; i++) {
        const optText = await mcqBtns.nth(i).textContent().catch(() => '')
        const defSnippet = wordEntry.definition_en.substring(0, 20).toLowerCase()
        if (optText.toLowerCase().includes(defSnippet)) {
          await mcqBtns.nth(i).click()
          clicked = true
          break
        }
      }
    }
    if (!clicked) {
      // Click first option as fallback
      await mcqBtns.first().click()
    }

    answeredCount++
    await page.waitForTimeout(400)

    // Check progress and auto-submit when all answered
    const afterBody = await page.locator('body').textContent().catch(() => '')
    const m = afterBody.match(/(\d+) of (\d+) answered/)
    if (m && parseInt(m[1]) >= parseInt(m[2])) {
      await page.waitForTimeout(500)
      const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitBtn.click()
        await page.waitForTimeout(5000)
        break
      }
    }
  }

  // Extract final score
  const finalBody = await page.locator('body').textContent().catch(() => '')
  const m1 = finalBody.match(/(\d+)%/)
  const m2 = finalBody.match(/(\d+) of (\d+) correct/)
  const score = m1 ? parseInt(m1[1]) : (m2 ? Math.round(parseInt(m2[1]) / parseInt(m2[2]) * 100) : null)

  return { presentedWords, questionCount: answeredCount, score }
}

// ---- Logout scenario ----
async function runLogoutScenario(page, dayNumber, logoutAfterN) {
  console.log(`  Logout scenario Day ${dayNumber}: will logout after ${logoutAfterN} answers`)

  // Capture localStorage start
  const localStorageStart = await page.evaluate(() => {
    const r = {}
    for (let j = 0; j < localStorage.length; j++) {
      const k = localStorage.key(j)
      r[k] = localStorage.getItem(k)
    }
    return r
  }).catch(() => ({}))

  // Answer a few questions
  const partialResult = await completeTypedTestKorean(page, { logoutAfterN })

  // Capture localStorage mid-test
  const localStorageMid = partialResult.localStorageMid || {}

  // Firestore state before logout
  const attemptsBeforeLogout = await readAttempts()

  // Find logout button
  let logoutSuccess = false
  let logoutMethod = 'unknown'

  // Try user menu approaches
  const userMenuCandidates = [
    () => page.locator('[aria-label="User menu"]').first(),
    () => page.locator('[aria-label="Account"]').first(),
    () => page.getByRole('button', { name: /account|profile|user/i }).first()
  ]

  for (const getBtn of userMenuCandidates) {
    const btn = getBtn()
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click()
      await page.waitForTimeout(1000)
      const logoutOpt = page.getByText(/log.?out|sign.?out/i).first()
      if (await logoutOpt.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoutOpt.click()
        logoutSuccess = true
        logoutMethod = 'user_menu'
        break
      }
    }
  }

  if (!logoutSuccess) {
    // Try navigation menu for logout
    const navMenus = page.locator('[aria-label*="menu"], [aria-label*="navigation"]')
    const navCount = await navMenus.count()
    for (let i = 0; i < navCount && !logoutSuccess; i++) {
      if (await navMenus.nth(i).isVisible({ timeout: 500 }).catch(() => false)) {
        await navMenus.nth(i).click()
        await page.waitForTimeout(500)
        const logoutOpt = page.getByText(/log.?out|sign.?out/i).first()
        if (await logoutOpt.isVisible({ timeout: 1500 }).catch(() => false)) {
          await logoutOpt.click()
          logoutSuccess = true
          logoutMethod = 'nav_menu'
          break
        }
        await page.keyboard.press('Escape')
      }
    }
  }

  if (!logoutSuccess) {
    // Last resort: navigate to login URL (simulates logout)
    await safeGoto(page, BASE_URL + '/login')
    logoutSuccess = true
    logoutMethod = 'navigate_login'
  }

  await page.waitForTimeout(3000)

  // Capture state after logout
  const urlAfterLogout = page.url()
  const localStorageAfterLogout = await page.evaluate(() => {
    const r = {}
    for (let j = 0; j < localStorage.length; j++) {
      const k = localStorage.key(j)
      r[k] = localStorage.getItem(k)
    }
    return r
  }).catch(() => ({}))
  const attemptsAfterLogout = await readAttempts()

  // Log back in
  await loginAs(page, EMAIL, PASSWORD)
  await page.waitForTimeout(3000)

  // Check for recovery prompt
  const bodyAfterLogin = await page.locator('body').textContent().catch(() => '')
  const hasRecoveryPrompt = /recover|resume|in.progress|continue.*test/i.test(bodyAfterLogin)

  // Capture localStorage after re-login
  const localStorageAfterRelogin = await page.evaluate(() => {
    const r = {}
    for (let j = 0; j < localStorage.length; j++) {
      const k = localStorage.key(j)
      r[k] = localStorage.getItem(k)
    }
    return r
  }).catch(() => ({}))

  const attemptsAfterRelogin = await readAttempts()

  // Determine verdict
  const midKeyCount = Object.keys(localStorageMid).length
  const postLogoutKeyCount = Object.keys(localStorageAfterLogout).length
  const workLost = midKeyCount > 0 && postLogoutKeyCount < midKeyCount
  const verdict = hasRecoveryPrompt ? 'RECOVERABLE' : (workLost ? 'LOST' : 'CLEAN_RESTART')

  console.log(`  Logout scenario result: verdict=${verdict}, recovery=${hasRecoveryPrompt}, localStorage keys: ${midKeyCount}→${postLogoutKeyCount}→${Object.keys(localStorageAfterRelogin).length}`)

  return {
    logoutAfterN,
    logoutMethod,
    logoutSuccess,
    urlAfterLogout,
    localStorageStartKeys: Object.keys(localStorageStart).length,
    localStorageMidKeys: midKeyCount,
    localStorageAfterLogoutKeys: postLogoutKeyCount,
    localStorageAfterReloginKeys: Object.keys(localStorageAfterRelogin).length,
    localStorageMidSample: Object.keys(localStorageMid).slice(0, 5),
    attemptsBeforeLogout: attemptsBeforeLogout.length,
    attemptsAfterLogout: attemptsAfterLogout.length,
    attemptsAfterRelogin: attemptsAfterRelogin.length,
    recoveryPromptVisible: hasRecoveryPrompt,
    workLost,
    verdict,
    bodyAfterLoginSnippet: bodyAfterLogin.substring(0, 400)
  }
}

// ---- Run one full session ----
async function runOneSession(browser, sessionDate, dayNumber, opts = {}) {
  const { doLogoutScenario = false, logoutAfterNAnswers = 5 } = opts

  const result = {
    dayNumber,
    sessionDate: sessionDate.toISOString(),
    newTest: { presentedWords: [], score: null, questionCount: 0 },
    reviewTest: null,
    errors: [],
    blocked: false,
    blockedReason: null,
    steps: [],
    logoutScenario: null,
    h2StaleStep5: false,
    h2Count: 0
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

  // Unregister service workers early
  await context.addInitScript(() => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
    }
  })

  const page = await context.newPage()
  const consoleMsgs = []
  page.on('console', msg => { if (msg.type() === 'error') consoleMsgs.push(msg.text()) })

  try {
    // Login
    await loginAs(page, EMAIL, PASSWORD)
    result.steps.push('login_ok')

    // ---- H2 GUARD: handle stale completion screen before starting new session ----
    // This fires if the prior session's Step 5 is still cached in the SPA
    let h2Retries = 0
    while (h2Retries < 3) {
      const body = await page.locator('body').textContent().catch(() => '')
      const step = body.match(/Step (\d+) of (\d+)/)
      const stepNum = step ? parseInt(step[1]) : 0
      const isStaleStep5 = stepNum === 5 || body.includes('Session Summary') || (body.includes('Back to Dashboard') && !body.includes('Start Session'))

      if (!isStaleStep5) break

      console.log(`  H2 guard (retry ${h2Retries + 1}): stale Step ${stepNum}/completion screen`)
      result.h2StaleStep5 = true
      result.h2Count++
      result.steps.push(`h2_stale_step${stepNum}_retry${h2Retries + 1}`)

      // Click through the completion screen
      const handled = await handleStaleCompletionScreen(page)
      if (!handled) {
        await safeGoto(page, BASE_URL + '/')
      }
      await page.waitForTimeout(2000)
      h2Retries++
    }

    // ---- Start session ----
    const sessionStart = await startSessionFromDashboard(page)
    if (sessionStart.error) {
      result.blocked = true
      result.blockedReason = sessionStart.error
      result.errors.push(sessionStart.error)
      return result
    }
    result.steps.push(sessionStart.resumed ? 'session_resumed' : 'session_started')

    // Dismiss flashcard modal (Step 1 = new word cards)
    await dismissFlashcardModal(page)
    await page.waitForTimeout(1000)

    // Get current step
    const bodyText1 = await page.locator('body').textContent().catch(() => '')
    const stepMatch1 = bodyText1.match(/Step (\d+) of (\d+)/)
    const currentStep = stepMatch1 ? parseInt(stepMatch1[1]) : 1
    result.steps.push(`at_step_${currentStep}`)

    // Another H2 check: if we got to Step 5 again after starting (stale completion).
    // Click through it ("Move On to Next Day"/"Back to Dashboard") and re-enter via the
    // LARGEST Start Session button. Retry up to 2 times before giving up.
    let curStep = currentStep
    let h2tries = 0
    while (curStep === 5 && h2tries < 2) {
      result.h2StaleStep5 = true
      result.h2Count++
      result.steps.push(`h2_step5_after_start_retry${h2tries + 1}`)
      await handleStaleCompletionScreen(page)
      await page.waitForTimeout(2000)
      const ss = await startSessionFromDashboard(page)
      if (ss.error) break
      await dismissFlashcardModal(page)
      await page.waitForTimeout(1000)
      const b = await page.locator('body').textContent().catch(() => '')
      const m = b.match(/Step (\d+) of (\d+)/)
      curStep = m ? parseInt(m[1]) : 1
      result.steps.push(`reentry_step_${curStep}`)
      h2tries++
    }
    if (curStep === 5) {
      result.blocked = true
      result.blockedReason = 'H2 persistent: Step 5 even after re-entry attempts'
      return result
    }
    // reset currentStep handling below to the resolved step
    const resolvedStep = curStep

    // ---- Handle based on current step ----
    if (resolvedStep <= 2) {
      // Skip to typed test if on flashcards (Step 1)
      if (resolvedStep === 1) {
        const skipped = await skipToTestMenu(page)
        result.steps.push(skipped ? 'skip_to_typed_test' : 'skip_failed_continuing')
      }

      // ---- LOGOUT SCENARIO ----
      if (doLogoutScenario) {
        const logoutResult = await runLogoutScenario(page, dayNumber, logoutAfterNAnswers)
        result.logoutScenario = logoutResult
        result.steps.push(`logout_scenario_${logoutResult.verdict}`)

        // After logout/login, navigate back and re-start the day's session
        await safeGoto(page, BASE_URL + '/')
        await page.waitForTimeout(2000)
        await handleStaleCompletionScreen(page)

        const sessionStart2 = await startSessionFromDashboard(page)
        if (!sessionStart2.error) {
          await dismissFlashcardModal(page)
          const body2 = await page.locator('body').textContent().catch(() => '')
          const step2 = body2.match(/Step (\d+) of (\d+)/)
          const step2Num = step2 ? parseInt(step2[1]) : 1
          if (step2Num === 1) await skipToTestMenu(page)
        }
      }

      // ---- Complete typed test ----
      const typedResult = await completeTypedTestKorean(page)
      result.newTest = typedResult
      result.steps.push(`typed_done_score_${typedResult.score}`)
      if (typedResult.error) result.errors.push(typedResult.error)

      // Click Continue after typed test results
      await page.waitForTimeout(2000)
      let bodyText2 = await page.locator('body').textContent().catch(() => '')
      let step2Match = bodyText2.match(/Step (\d+) of (\d+)/)
      let afterStep = step2Match ? parseInt(step2Match[1]) : null

      if (afterStep === 2 || (bodyText2.includes('Completed Day') && afterStep !== 3 && afterStep !== 4)) {
        const continueBtn = page.getByRole('button', { name: /^continue$/i }).first()
        if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await continueBtn.click()
          result.steps.push('continue_after_typed')
          await page.waitForTimeout(3000)
          bodyText2 = await page.locator('body').textContent().catch(() => '')
          step2Match = bodyText2.match(/Step (\d+) of (\d+)/)
          afterStep = step2Match ? parseInt(step2Match[1]) : null
        }
      }

      result.steps.push(`post_typed_step_${afterStep}`)

      // ---- Review test ----
      if (afterStep === 3 || bodyText2.includes('Review Study')) {
        await dismissFlashcardModal(page)
        const skipped2 = await skipToTestMenu(page)
        result.steps.push(skipped2 ? 'skip_to_review' : 'review_skip_failed')
        const reviewResult = await completeMCQTest(page)
        result.reviewTest = reviewResult
        result.steps.push(`review_done_score_${reviewResult.score}`)
        await page.waitForTimeout(2000)
      } else if (afterStep === 4 || bodyText2.includes('Review Test')) {
        const reviewResult = await completeMCQTest(page)
        result.reviewTest = reviewResult
        result.steps.push(`review_done_score_${reviewResult.score}`)
        await page.waitForTimeout(2000)
      } else if (dayNumber === 1) {
        result.steps.push('day1_no_review_expected')
      }

    } else if (resolvedStep === 3) {
      await dismissFlashcardModal(page)
      const skipped = await skipToTestMenu(page)
      result.steps.push(skipped ? 'skip_to_review' : 'review_skip_failed')
      const reviewResult = await completeMCQTest(page)
      result.reviewTest = reviewResult
      result.steps.push(`review_done_score_${reviewResult.score}`)
    } else if (resolvedStep === 4) {
      const reviewResult = await completeMCQTest(page)
      result.reviewTest = reviewResult
      result.steps.push(`review_done_score_${reviewResult.score}`)
    }

    // ---- Handle completion/Step 5 ----
    await page.waitForTimeout(1000)
    const bodyFinal = await page.locator('body').textContent().catch(() => '')
    const stepFinal = bodyFinal.match(/Step (\d+) of (\d+)/)
    if ((stepFinal && parseInt(stepFinal[1]) === 5) || bodyFinal.includes('Session Summary') || bodyFinal.includes('Back to Dashboard')) {
      result.steps.push('at_completion')
      await handleStaleCompletionScreen(page)
    }

    if (consoleMsgs.length > 0) result.errors.push(...consoleMsgs.slice(0, 5))

  } catch (err) {
    result.blocked = true
    result.blockedReason = err.message
    result.errors.push(err.message)
    console.error(`Session Day ${dayNumber} error:`, err.message.substring(0, 200))
    logEvent({ type: 'session_error', day: dayNumber, error: err.message.substring(0, 200) })
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
  writeStatus('running', { startedAt: new Date().toISOString(), version: 'v2' })
  logEvent({ type: 'audit_start', persona: 'korean', class: 'TOP', batch: 'B27', label: LABEL, version: 'v2', startedAt: new Date().toISOString() })

  // Read initial state
  const initialCPDocs = await readAllClassProgressDocs()
  console.log(`Initial class_progress docs: ${initialCPDocs.map(d => d.id).join(', ')}`)

  const initialCP = await readClassProgress()
  const initialCSD = initialCP?.currentStudyDay ?? 0
  const initialTWI = initialCP?.totalWordsIntroduced ?? 0

  console.log(`=== B27 korean/TOP audit (K27 v2) ===`)
  console.log(`Initial CSD: ${initialCSD}, TWI: ${initialTWI}`)

  const startingDay = initialCSD + 1
  console.log(`Starting from Day ${startingDay}`)

  const TARGET_SESSIONS = 22 // slightly over 20 to account for any blocked days

  // Anchor date: June 2, 2026 = Monday (fresh student — Day 1 first)
  // Use the REAL current date for the anchor: May 31, 2026 + start next weekday
  // v1 already completed Days 1 and 2 with these dates:
  //   Day 1 = June 2 (CSD went 0→1)
  //   Day 2 = June 3 (CSD went 1→2)
  // v2 picks up from Day 3 (current CSD=2)
  let currentDate = new Date('2026-06-04T09:00:00+09:00') // Day 3 = June 4 (Wednesday)

  const dayTable = []
  const findingsList = []
  const allSessionResults = []
  let h2StaleCount = 0
  let masteredInReviewDays = []
  let stopConditionHit = false
  let logoutScenarioDone = false
  let logoutScenarioResult = null

  // Korean UTF-8 round-trip tracking
  const koreanRoundTripSample = []

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome'
  })

  try {
    // We already have Days 1 and 2 from v1 — add them to dayTable for reference
    const day1Evidence = JSON.parse(readFileSync(join(EVIDENCE_DIR, 'day_01.json'), 'utf-8'))
    const day2Evidence = JSON.parse(readFileSync(join(EVIDENCE_DIR, 'day_02.json'), 'utf-8'))

    dayTable.push({
      day: 1, date: '2026-06-02', preCSD: 0, postCSD: 1, csdOk: true,
      preTWI: 0, postTWI: 80,
      expNewRange: '[0,79]', presentedNewCount: 30, newMatch: true,
      expSegmentPost: 'null', presentedReviewCount: 0, reviewMatch: true,
      masteredCount: 0, masteredInReviewCount: 0,
      newTestScore: 100, reviewTestScore: null,
      violations: [], blocked: false, fromV1: true
    })
    dayTable.push({
      day: 2, date: '2026-06-03', preCSD: 1, postCSD: 2, csdOk: true,
      preTWI: 80, postTWI: 160,
      expNewRange: '[80,159]', presentedNewCount: 30, newMatch: true,
      expSegmentPost: '[0,99]', presentedReviewCount: 30, reviewMatch: true,
      masteredCount: 18, masteredInReviewCount: 0,
      newTestScore: 100, reviewTestScore: 23,
      violations: [], blocked: false, fromV1: true
    })

    for (let sessionIdx = 0; sessionIdx < TARGET_SESSIONS; sessionIdx++) {
      const dayNumber = startingDay + sessionIdx // Starts at 3

      // Skip weekends
      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      }

      console.log(`\n=== Day ${dayNumber} | ${currentDate.toISOString().split('T')[0]} ===`)
      logEvent({ type: 'session_start', day: dayNumber, date: currentDate.toISOString() })

      // Pre-session Firestore read
      const preCP = await readClassProgress()
      const preCSD = preCP?.currentStudyDay ?? (dayNumber - 1)
      const preTWI = preCP?.totalWordsIntroduced ?? 0
      const preInterventionLevel = preCP?.interventionLevel ?? 0

      const preStudyStates = await readStudyStates()
      const statusHistPre = {}
      for (const ss of preStudyStates) {
        statusHistPre[ss.status || 'UNKNOWN'] = (statusHistPre[ss.status || 'UNKNOWN'] || 0) + 1
      }

      const expNewRange = expectedNewWordRange(preTWI, DAILY_PACE, preInterventionLevel, LIST_SIZE)
      const expSegmentPre = calculateSegment(dayNumber, STUDY_DAYS_PER_WEEK, preTWI, DAILY_PACE, preInterventionLevel)
      const nowMs = currentDate.getTime()

      console.log(`Pre-state: CSD=${preCSD}, TWI=${preTWI}, IL=${preInterventionLevel}`)
      console.log(`Expected new: ${expNewRange ? `[${expNewRange.startIndex},${expNewRange.endIndex}]` : 'null'}`)

      // Logout scenario on Day 5 (avoid Day 3 which had H2 issues in v1)
      const doLogoutScenario = !logoutScenarioDone && dayNumber === 5

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

      if (sessionResult.h2StaleStep5) h2StaleCount += sessionResult.h2Count || 1

      // Wait for Firestore
      await new Promise(r => setTimeout(r, 4000))

      // Post-session Firestore read
      const postCP = await readClassProgress()
      const postCSD = postCP?.currentStudyDay ?? preCSD
      const postTWI = postCP?.totalWordsIntroduced ?? preTWI
      const postInterventionLevel = postCP?.interventionLevel ?? preInterventionLevel

      const postStudyStates = await readStudyStates()
      const statusHistPost = {}
      for (const ss of postStudyStates) {
        statusHistPost[ss.status || 'UNKNOWN'] = (statusHistPost[ss.status || 'UNKNOWN'] || 0) + 1
      }

      const masteredWords = postStudyStates.filter(ss => ss.status === 'MASTERED')
      const masteredCount = masteredWords.length

      // POST-test TWI review segment (correct per canary lessons)
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

      console.log(`Post: CSD=${postCSD}, TWI=${postTWI}, seg=${expSegmentPost ? `[${expSegmentPost.startIndex},${expSegmentPost.endIndex}]` : 'null'}, eligible=${eligibleIds.size}, retired=${retiredIds.size}`)

      // Word correctness
      const newPresentedPositions = (sessionResult.newTest?.presentedWords ?? []).map(w => w.position).filter(p => p >= 0)
      const reviewPresentedPositions = (sessionResult.reviewTest?.presentedWords ?? []).map(w => w.position).filter(p => p >= 0)

      // Track Korean UTF-8 round-trip
      for (const w of (sessionResult.newTest?.presentedWords ?? [])) {
        if (w.word && w.position >= 0) {
          const cached = WORD_BY_POSITION[w.position]
          if (cached?.definition_ko && koreanRoundTripSample.length < 20) {
            koreanRoundTripSample.push({
              day: dayNumber, word: w.word, position: w.position,
              koreanDef: cached.definition_ko.substring(0, 30),
              hasKorean: /[가-힣]/.test(cached.definition_ko)
            })
          }
        }
      }

      // Violations
      const newViolations = checkPresentedWords({
        phase: 'new', presentedPositions: newPresentedPositions, expectedRange: expNewRange
      })
      const reviewViolations = expSegmentPost ? checkPresentedWords({
        phase: 'review', presentedPositions: reviewPresentedPositions,
        expectedRange: expSegmentPost, eligibleIds, retiredIds
      }) : []

      // F01 check: MASTERED words in review (post-fix should be ZERO)
      const masteredInReviewThisDay = []
      for (const rPos of reviewPresentedPositions) {
        const word = postStudyStates.find(ss => (ss.wordIndex ?? -1) === rPos)
        if (word && word.status === 'MASTERED') {
          const returnAtMs = word.returnAt ? (word.returnAt._seconds ? word.returnAt._seconds * 1000 : word.returnAt) : null
          if (returnAtMs && returnAtMs > nowMs) {
            masteredInReviewThisDay.push({ position: rPos, returnAtMs, word: WORD_BY_POSITION[rPos]?.word })
          }
        }
      }

      if (masteredInReviewThisDay.length > 0) {
        console.log(`F01 CHECK: ${masteredInReviewThisDay.length} MASTERED words in review on Day ${dayNumber}!`)
        masteredInReviewDays.push({ day: dayNumber, count: masteredInReviewThisDay.length, words: masteredInReviewThisDay })
        if (masteredInReviewDays.length >= 2) {
          stopConditionHit = true
          logEvent({ type: 'stop_condition_hit', reason: 'F01_regressed', day: dayNumber, masteredInReviewDays })
        }
      }

      const allViolations = [...newViolations, ...reviewViolations]
      const csdOk = sessionResult.blocked ? null : (postCSD === dayNumber)

      const dayRow = {
        day: dayNumber,
        date: currentDate.toISOString().split('T')[0],
        preCSD, postCSD, csdOk,
        csdDrift: !sessionResult.blocked && postCSD !== dayNumber ? `expected ${dayNumber} got ${postCSD}` : null,
        preTWI, postTWI,
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

      console.log(`Result: CSD=${postCSD}(ok:${csdOk}), TWI=${postTWI}, MASTERED=${masteredCount}, F01=${masteredInReviewThisDay.length}, newScore=${sessionResult.newTest?.score}, reviewScore=${sessionResult.reviewTest?.score}, V=${allViolations.length}, blocked=${sessionResult.blocked}`)

      // Save evidence
      const evidenceData = {
        dayNumber, sessionDate: currentDate.toISOString(),
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

      writeFileSync(join(EVIDENCE_DIR, `day_${String(dayNumber).padStart(2, '0')}.json`), JSON.stringify(evidenceData, null, 2))

      logEvent({
        type: 'session_complete', day: dayNumber, preCSD, postCSD, preTWI, postTWI,
        masteredCount, masteredInReview: masteredInReviewThisDay.length,
        violations: allViolations.length,
        newScore: sessionResult.newTest?.score, reviewScore: sessionResult.reviewTest?.score,
        blocked: sessionResult.blocked
      })

      if (stopConditionHit) {
        console.log(`STOP CONDITION HIT: F01 regressed`)
        writeStatus('stopped', { reason: 'F01_regressed', masteredInReviewDays: masteredInReviewDays.map(d => d.day) })
        break
      }

      // Check: have we done enough real sessions?
      const realSessions = allSessionResults.filter(s => !s.blocked).length
      if (realSessions >= 20) {
        console.log(`Reached 20 real sessions — stopping`)
        break
      }

      currentDate = nextStudyDate(currentDate)
    }

    // ---- Final orphan check ----
    console.log('\n=== Final orphan check ===')
    const finalCPDocs = await readAllClassProgressDocs()
    const finalOrphans = finalCPDocs.filter(d => !d.id.includes('_'))
    const orphansBefore = initialCPDocs.filter(d => !d.id.includes('_')).length
    const orphansAfter = finalOrphans.length
    const newOrphansCreated = orphansAfter - orphansBefore

    console.log(`class_progress docs: ${finalCPDocs.map(d => d.id).join(', ')}`)
    console.log(`Orphans before: ${orphansBefore}, after: ${orphansAfter}, new: ${newOrphansCreated}`)

    const finalAttempts = await readAttempts()
    console.log(`Total attempts: ${finalAttempts.length}`)

    // Verify attempt IDs use correct format
    const orphanAttempts = finalAttempts.filter(a => {
      // Correct format: uid_vocaboost_test_classId_listId_...
      return !a.id.includes(LIST_ID) && !a.id.includes('_day')
    })
    console.log(`Attempts with possibly wrong format: ${orphanAttempts.length}`)

    logEvent({
      type: 'audit_complete', version: 'v2',
      sessionsCompleted: allSessionResults.filter(s => !s.blocked).length,
      totalSessions: allSessionResults.length,
      newOrphansCreated,
      stopConditionHit,
      masteredInReviewDays: masteredInReviewDays.map(d => d.day),
      h2StaleCount
    })

    writeStatus(stopConditionHit ? 'stopped' : 'finished', {
      sessionsCompleted: allSessionResults.filter(s => !s.blocked).length,
      totalSessions: allSessionResults.length,
      finishedAt: new Date().toISOString()
    })

    return {
      dayTable,
      findingsList,
      initialCSD,
      startingDay: 1, // includes v1 days
      finalCPDocs: finalCPDocs.map(d => d.id),
      newOrphansCreated,
      orphansBefore,
      orphansAfter,
      sessionsCompleted: 2 + allSessionResults.filter(s => !s.blocked).length, // +2 from v1
      totalSessions: 2 + allSessionResults.length,
      h2StaleCount,
      masteredInReviewDays,
      stopConditionHit,
      logoutScenarioResult,
      koreanRoundTripSample,
      koreanWordsWithKorean: koreanRoundTripSample.filter(w => w.hasKorean).length
    }

  } finally {
    await browser.close()
  }
}

const result = await main()

console.log('\n=== K27 v2 AUDIT COMPLETE ===')
console.log(`Sessions completed: ${result.sessionsCompleted} (including 2 from v1)`)
console.log(`H2 stale-Step-5 count: ${result.h2StaleCount}`)
console.log(`F01 RESOLVED: ${result.masteredInReviewDays.length === 0 ? 'YES — no MASTERED words in review' : 'NO — REGRESSED on days: ' + result.masteredInReviewDays.map(d => d.day).join(', ')}`)
console.log(`New orphan docs created: ${result.newOrphansCreated}`)
console.log(`Korean UTF-8 words sampled: ${result.koreanRoundTripSample.length} (${result.koreanWordsWithKorean} with Korean chars)`)
console.log(`Logout scenario: ${JSON.stringify(result.logoutScenarioResult?.verdict)}`)
console.log(`Stop condition hit: ${result.stopConditionHit}`)

console.log('\nDay table:')
for (const row of result.dayTable) {
  console.log(`  Day ${row.day}${row.fromV1 ? '(v1)' : ''}: CSD ${row.preCSD}->${row.postCSD}(ok:${row.csdOk}), TWI ${row.preTWI}->${row.postTWI}, new=${row.expNewRange}(${row.presentedNewCount} shown,match:${row.newMatch}), review=${row.expSegmentPost}(${row.presentedReviewCount} shown,match:${row.reviewMatch}), MASTERED=${row.masteredCount}, F01=${row.masteredInReviewCount}, newScore=${row.newTestScore}, reviewScore=${row.reviewTestScore}, V=${row.violations.length}, blocked=${row.blocked}`)
}

if (result.findingsList.length > 0) {
  console.log('\nViolations:')
  for (const f of result.findingsList) {
    console.log(`  Day ${f.day}: ${f.violations.join('; ')}`)
  }
}
