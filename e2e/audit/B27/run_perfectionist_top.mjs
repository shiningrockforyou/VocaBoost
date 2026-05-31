/**
 * B27 Longitudinal Word-Correctness Audit — perfectionist/TOP persona
 * Agent label: PERF27
 * Batch: B27, persona: perfectionist, class: TOP
 *
 * Perfectionist transform: canonical_en_with_edits
 *   Type the canonical answer but with backspaces/retypes — type several chars,
 *   delete a few, retype them — to generate many onChange/autosave events.
 *   Verify the FINAL submitted answer is the canonical answer (not a stale mid-edit value).
 *   This stresses audit issue #10 (TypedTest reading state vs ref).
 *
 * ABSOLUTE RULE: Admin SDK read-only. No writes. UI-only state advancement.
 * F01 VERIFICATION: NO MASTERED word (future returnAt) in any review test.
 *
 * HARNESS FIXES APPLIED:
 * 1. REVIEW CHECK BY IDENTITY — checkReviewWords with preStatus/preReturnAt
 * 2. LOGOUT/LOGIN in FRESH context at the END of the walk (not inline)
 * 3. POST-TEST TWI for segment math (kills false positives)
 */

import { chromium } from 'playwright'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs'
import { join } from 'path'

// ---- Config ----
const BASE_URL = 'https://vocaboostone.netlify.app'
const EMAIL = 'audit_perfectionist_01_top@vocaboost.test'
const PASSWORD = 'AuditPass2026!'
const UID = 'aqhjGcTJIyWMY3xSjHqPOc95jch2'
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
const LIST_ID = '8RMews2H7C3UJUAsOBzR'
const CP_DOC_ID = `${CLASS_ID}_${LIST_ID}`

const DAILY_PACE = 80
const STUDY_DAYS_PER_WEEK = 5
const LIST_SIZE = 3381
const PASS_THRESHOLD = 0.92 // 92% = typed test pass threshold

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B27/perfectionist'
const AGENT_LOGS_DIR = '/app/audit/playwright/findings/agent_logs'
const SA_PATH = '/app/scripts/serviceAccountKey.json'
const CHROMIUM_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'

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
const WORD_BY_ID = {}
for (const w of WORD_CACHE) {
  WORD_BY_TEXT[w.word.trim().toLowerCase()] = w
  WORD_BY_POSITION[w.position] = w
  WORD_BY_ID[w.id] = w
}
function lookupWord(text) {
  if (!text) return null
  const norm = text.trim().toLowerCase()
  return WORD_BY_TEXT[norm] || null
}

// ---- Expected words model ----
const {
  calculateInterventionLevel,
  expectedNewWordRange,
  calculateSegment,
  partitionReviewEligibility,
  checkNewWords,
  checkReviewWords
} = await import('/app/e2e/audit/helpers/expectedWords.js')

// ---- Logging ----
const jsonlPath = join(AGENT_LOGS_DIR, 'PERF27.jsonl')
function logEvent(event) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n'
  try { appendFileSync(jsonlPath, line) } catch (e) { console.error('logEvent error:', e.message) }
}

function writeStatus(status) {
  writeFileSync(join(AGENT_LOGS_DIR, 'PERF27.status.json'), JSON.stringify(status, null, 2))
}

// ---- Date utilities ----
function nextStudyDate(d) {
  const next = new Date(d.getTime() + 24 * 60 * 60 * 1000)
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1)
  }
  return next
}

// ---- Perfectionist typing transform ----
// Type the canonical answer but with edit churn:
// Type N chars, backspace K, retype the deleted chars, then continue.
// FINAL value in the input = canonical answer (no truncation or stale state).
async function perfectionistType(locator, canonicalText, delayMs = 80) {
  await locator.click()
  // Clear the field first
  await locator.selectAll ? locator.selectAll() : null
  await locator.press('Control+a')
  await locator.press('Delete')
  await locator.press('Backspace')

  // Type with edit churn: every ~10 chars, do a backspace-retype cycle
  let typed = ''
  const chars = canonicalText.split('')
  let i = 0
  while (i < chars.length) {
    // Type a chunk of chars
    const chunkSize = 8 + Math.floor(Math.random() * 5) // 8-12 chars per chunk
    for (let c = 0; c < chunkSize && i < chars.length; c++, i++) {
      await locator.type(chars[i], { delay: delayMs })
      typed += chars[i]
    }

    // Edit churn: delete last few chars and retype them (if not at end)
    if (i < chars.length - 2 && typed.length >= 5) {
      const backspaceCount = 2 + Math.floor(Math.random() * 3) // 2-4 backspaces
      const actualBack = Math.min(backspaceCount, typed.length)
      const deletedChars = typed.slice(-actualBack)
      // Backspace
      for (let b = 0; b < actualBack; b++) {
        await locator.press('Backspace', { delay: Math.floor(delayMs * 0.8) })
      }
      typed = typed.slice(0, -actualBack)
      // Retype the deleted chars
      for (const ch of deletedChars) {
        await locator.type(ch, { delay: delayMs })
        typed += ch
      }
    }
  }

  // Verify final value matches canonical
  const finalValue = await locator.inputValue().catch(() => '')
  const matches = finalValue.trim() === canonicalText.trim()
  return { finalValue, matches, canonicalText }
}

// ---- Browser helpers ----
async function loginAndLoadDashboard(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2000)
  const url = page.url()
  const bodyText = await page.locator('body').textContent().catch(() => '')
  if (!url.includes('/login') && (bodyText.includes('Dashboard') || bodyText.includes('Day') || bodyText.includes('Session'))) {
    return true
  }
  await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1000)
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
  const match = bodyText.match(/Day\s+(\d+)/i)
  return match ? parseInt(match[1]) : null
}

// H2 guard: verify we're NOT on a stale Step 5
async function verifyNewDayLoaded(page, expectedDay) {
  const bodyText = await page.locator('body').textContent().catch(() => '')
  const stepMatch = bodyText.match(/Step (\d+) of (\d+)/)
  if (stepMatch && parseInt(stepMatch[1]) === 5) {
    return { stale: true, step: 5 }
  }
  if (bodyText.includes('Session Summary') || bodyText.includes('Back to Dashboard')) {
    return { stale: true, step: 5 }
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

// Complete typed test with perfectionist edit churn
// Returns: { presentedWords, score, questionCount, finalAnswerIntegrity }
async function completeTypedTestPerfectionist(page) {
  const typedInputs = page.locator('input[placeholder="Type your definition..."]')
  const inputCount = await typedInputs.count()
  if (inputCount === 0) return { error: 'no typed inputs', presentedWords: [], score: null, questionCount: 0, finalAnswerIntegrity: [] }

  // Get word-input pairs from DOM
  const items = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[placeholder="Type your definition..."]')
    return Array.from(inputs).map(inp => {
      const container = inp.closest('div.rounded-xl') || inp.closest('div[class*="rounded-xl"]') || inp.parentElement?.parentElement
      const wordSpan = container?.querySelector('span.font-medium')
      return { word: wordSpan ? wordSpan.textContent.trim() : '' }
    })
  })

  const presentedWords = []
  const finalAnswerIntegrity = []

  for (let i = 0; i < inputCount; i++) {
    const wordEntry = lookupWord(items[i]?.word)
    presentedWords.push({ word: items[i]?.word || '', position: wordEntry?.position ?? -1 })

    const canonicalDef = wordEntry?.definition_en || 'a word with a specific meaning'

    // Perfectionist: type with edit churn
    const typeResult = await perfectionistType(typedInputs.nth(i), canonicalDef, 80)
    finalAnswerIntegrity.push({
      word: items[i]?.word || '',
      canonical: canonicalDef,
      finalValue: typeResult.finalValue,
      matches: typeResult.matches
    })
  }

  // Submit
  const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
  if (!await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    return { error: 'Submit button not found', presentedWords, score: null, questionCount: inputCount, finalAnswerIntegrity }
  }
  await submitBtn.click()

  // Wait for AI grading (~19s per question, batch graded, timeout 90s)
  let score = null
  for (let t = 0; t < 18; t++) {
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

  return { presentedWords, questionCount: inputCount, score, finalAnswerIntegrity }
}

// MCQ review test — perfectionist clicks carefully on correct option
async function completeMCQTestPerfectionist(page) {
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
      const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click()
        await page.waitForTimeout(5000)
        break
      }
      break
    }

    // Get current word from heading
    const wordText = await page.evaluate(() => {
      const els = document.querySelectorAll('h1, h2, h3, [class*="text-2xl"], [class*="text-3xl"], [class*="font-bold"]')
      for (const el of els) {
        const t = el.textContent.trim()
        if (t.length > 0 && t.length < 60 && !t.includes('Review Test') && !t.includes('Step ') && !t.includes('Answered') && !t.includes('%') && !t.includes('Back')) {
          return t
        }
      }
      return null
    }).catch(() => null)

    const wordClean = wordText ? wordText.split('\n')[0].replace(/\s*\([^)]+\)\s*$/, '').trim() : ''
    const wordEntry = lookupWord(wordClean)
    if (wordEntry) {
      presentedWords.push({ word: wordClean, position: wordEntry.position, wordId: wordEntry.id })
    } else {
      presentedWords.push({ word: wordClean, position: -1, wordId: null, notFound: true })
    }

    // Perfectionist: find and click the CORRECT option (reads definition carefully)
    let clicked = false
    if (wordEntry?.definition_en) {
      const defStart = wordEntry.definition_en.toLowerCase().substring(0, 20)
      for (let i = 0; i < optionCount; i++) {
        const optText = (await optionBtns.nth(i).textContent().catch(() => '')).toLowerCase()
        if (optText.includes(defStart)) {
          await optionBtns.nth(i).click()
          clicked = true
          break
        }
      }
    }
    if (!clicked) {
      // Try matching first few words of definition
      if (wordEntry?.definition_en) {
        const firstWord = wordEntry.definition_en.toLowerCase().split(' ')[0]
        for (let i = 0; i < optionCount; i++) {
          const optText = (await optionBtns.nth(i).textContent().catch(() => '')).toLowerCase()
          if (optText.includes(firstWord)) {
            await optionBtns.nth(i).click()
            clicked = true
            break
          }
        }
      }
      if (!clicked) await optionBtns.first().click()
    }

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
async function runOneSession(browser, sessionDate, dayNumber) {
  const result = {
    dayNumber,
    sessionDate: sessionDate.toISOString(),
    newTest: { presentedWords: [], score: null, questionCount: 0, finalAnswerIntegrity: [] },
    reviewTest: null,
    postCSD: null,
    errors: [],
    blocked: false,
    blockedReason: null,
    steps: [],
    h2StaleHit: false
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
  const consoleErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  try {
    // Login
    await loginAndLoadDashboard(page)
    result.steps.push('login_ok')

    // Dashboard day
    const dashDay = await getDashboardDay(page)
    result.steps.push(`dashboard_day_${dashDay}`)

    // H2 guard — check for stale Step 5
    const staleCheck = await verifyNewDayLoaded(page, dayNumber)
    if (staleCheck.stale) {
      result.h2StaleHit = true
      result.steps.push('H2_stale_detected')
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(3000)
      const staleCheck2 = await verifyNewDayLoaded(page, dayNumber)
      if (staleCheck2.stale) {
        result.blocked = true
        result.blockedReason = 'H2: persistent stale Step 5 screen'
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

    // Dismiss flashcard modal
    await dismissFlashcardModal(page)

    // Get current step
    const bodyText1 = await page.locator('body').textContent().catch(() => '')
    const stepMatch = bodyText1.match(/Step (\d+) of (\d+)/)
    const currentStep = stepMatch ? parseInt(stepMatch[1]) : 1
    result.steps.push(`at_step_${currentStep}`)

    if (currentStep === 5) {
      // Stale step 5 we didn't catch with H2 guard
      result.h2StaleHit = true
      result.blocked = true
      result.blockedReason = 'H2: At Step 5 when entering session after start'
      result.steps.push('H2_stale_post_start')
      return result
    }

    // Step 1-2: New words test
    if (currentStep <= 2) {
      if (currentStep === 1) {
        const skipped = await skipToTestMenu(page)
        result.steps.push(skipped ? 'skip_to_typed_test' : 'skip_failed')
        await page.waitForTimeout(1000)
      }

      // Verify on typed test
      const bodyCheck = await page.locator('body').textContent().catch(() => '')
      if (!bodyCheck.includes('Type your definition') && !bodyCheck.includes('New Words Test')) {
        // Maybe we need to dismiss another modal
        await dismissFlashcardModal(page)
        await skipToTestMenu(page)
      }

      // Complete typed test with perfectionist edit churn
      const typedResult = await completeTypedTestPerfectionist(page)
      result.newTest = typedResult
      result.steps.push(`typed_done_score_${typedResult.score}`)
      if (typedResult.error) result.errors.push(typedResult.error)

      // Wait for results and continue
      await page.waitForTimeout(2000)
      let bodyAfterTyped = await page.locator('body').textContent().catch(() => '')
      let afterStepMatch = bodyAfterTyped.match(/Step (\d+) of (\d+)/)
      let afterStep = afterStepMatch ? parseInt(afterStepMatch[1]) : null

      // Click Continue if on Step 2 results
      if (afterStep === 2 || (afterStep === null && (bodyAfterTyped.includes('Completed Day') || bodyAfterTyped.includes('% correct')))) {
        const continueBtn = page.getByRole('button', { name: /^continue$/i }).first()
        if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await continueBtn.click()
          result.steps.push('clicked_continue_after_typed')
          await page.waitForTimeout(3000)
          bodyAfterTyped = await page.locator('body').textContent().catch(() => '')
          afterStepMatch = bodyAfterTyped.match(/Step (\d+) of (\d+)/)
          afterStep = afterStepMatch ? parseInt(afterStepMatch[1]) : null
        }
      }

      result.steps.push(`after_typed_step_${afterStep}`)

      // Handle review flow
      if (afterStep === 3 || bodyAfterTyped.includes('Review Study')) {
        await dismissFlashcardModal(page)
        const skipped2 = await skipToTestMenu(page)
        result.steps.push(skipped2 ? 'skip_to_review_test' : 'review_skip_failed')
        await page.waitForTimeout(1000)
        const reviewResult = await completeMCQTestPerfectionist(page)
        result.reviewTest = reviewResult
        result.steps.push(`review_done_score_${reviewResult.score}`)
        await page.waitForTimeout(2000)
      } else if (afterStep === 4 || bodyAfterTyped.includes('Review Test')) {
        const reviewResult = await completeMCQTestPerfectionist(page)
        result.reviewTest = reviewResult
        result.steps.push(`review_done_score_${reviewResult.score}`)
        await page.waitForTimeout(2000)
      }
    } else if (currentStep === 3) {
      await dismissFlashcardModal(page)
      const skipped = await skipToTestMenu(page)
      result.steps.push(skipped ? 'skip_to_review_test' : 'review_skip_failed')
      const reviewResult = await completeMCQTestPerfectionist(page)
      result.reviewTest = reviewResult
      result.steps.push(`review_done_score_${reviewResult.score}`)
      await page.waitForTimeout(2000)
    } else if (currentStep === 4) {
      const reviewResult = await completeMCQTestPerfectionist(page)
      result.reviewTest = reviewResult
      result.steps.push(`review_done_score_${reviewResult.score}`)
      await page.waitForTimeout(2000)
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

    // Navigate back to dashboard
    const finalUrl = page.url()
    if (finalUrl.includes('session') || finalUrl.includes('test')) {
      await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
      await page.waitForTimeout(2000)
    }

    result.errors.push(...consoleErrors.slice(0, 5))

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

// ---- Logout/Login scenario (run in FRESH context, LAST) ----
// Per HARNESS FIX 2: isolated from the main walk to avoid poisoning day state
async function runLogoutLoginScenario(browser, sessionDate) {
  console.log('\n=== LOGOUT/LOGIN SCENARIO (fresh context) ===')
  const result = {
    started: true,
    sessionDate: sessionDate.toISOString(),
    answeredBeforeLogout: 0,
    preLogoutLocalStorageKeys: [],
    postLogoutLocalStorageKeys: [],
    loggedOut: false,
    loginAfterLogout: false,
    hasRecoveryPrompt: false,
    postLoginLocalStorageKeys: [],
    workPreserved: null, // null=unknown, true=yes, false=lost
    severity: null,
    notes: []
  }

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
    // Login and navigate to a session
    await loginAndLoadDashboard(page)
    result.notes.push('logged_in_ok')

    // Start session
    const sessionStart = await startSessionFromDashboard(page)
    if (sessionStart.error) {
      result.notes.push(`start_session_failed: ${sessionStart.error}`)
      return result
    }

    await dismissFlashcardModal(page)

    // Skip to typed test
    const skipped = await skipToTestMenu(page)
    result.notes.push(skipped ? 'skip_to_typed_test_ok' : 'skip_failed')
    await page.waitForTimeout(1000)

    // Type a few answers (perfectionist style) — answer 3 questions
    const typedInputs = page.locator('input[placeholder="Type your definition..."]')
    const inputCount = await typedInputs.count()
    result.notes.push(`typed_inputs_visible: ${inputCount}`)

    if (inputCount > 0) {
      const items = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[placeholder="Type your definition..."]')
        return Array.from(inputs).map(inp => {
          const container = inp.closest('div.rounded-xl') || inp.parentElement?.parentElement
          const wordSpan = container?.querySelector('span.font-medium')
          return { word: wordSpan ? wordSpan.textContent.trim() : '' }
        })
      })

      const answersToType = Math.min(3, inputCount)
      for (let i = 0; i < answersToType; i++) {
        const wordEntry = lookupWord(items[i]?.word)
        const canonicalDef = wordEntry?.definition_en || 'a word with meaning'
        // Type with perfectionist edit churn
        await perfectionistType(typedInputs.nth(i), canonicalDef, 60)
        result.answeredBeforeLogout++
      }
      result.notes.push(`answered_${result.answeredBeforeLogout}_before_logout`)
    }

    // Capture localStorage before logout
    const lsBefore = await page.evaluate(() => {
      const items = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        items[key] = localStorage.getItem(key)
      }
      return items
    }).catch(() => ({}))
    result.preLogoutLocalStorageKeys = Object.keys(lsBefore)
    result.hasRecoveryState = Object.keys(lsBefore).some(k =>
      k.toLowerCase().includes('session') || k.toLowerCase().includes('test') ||
      k.toLowerCase().includes('recover') || k.toLowerCase().includes('draft')
    )
    result.notes.push(`pre_logout_ls_keys: ${result.preLogoutLocalStorageKeys.length} (recovery state: ${result.hasRecoveryState})`)

    // Logout via app UI
    let loggedOut = false

    // Try user/avatar menu first
    const avatarSelectors = [
      '[aria-label*="profile"]', '[aria-label*="account"]', '[aria-label*="user"]',
      '[aria-label*="menu"]', 'img[alt*="avatar"]', 'button[class*="rounded-full"]'
    ]
    for (const sel of avatarSelectors) {
      const el = page.locator(sel).first()
      if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
        await el.click()
        await page.waitForTimeout(500)
        const logoutBtn = page.getByRole('button', { name: /log.?out|sign.?out/i }).first()
        if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await logoutBtn.click()
          loggedOut = true
          break
        }
        // Close menu
        await page.keyboard.press('Escape')
        break
      }
    }

    if (!loggedOut) {
      // Try text-based logout link
      const logoutLink = page.getByText(/log out|sign out/i).first()
      if (await logoutLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoutLink.click()
        loggedOut = true
      }
    }

    if (!loggedOut) {
      result.notes.push('logout_button_not_found_by_harness')
      // Try navigating to /logout
      await page.goto(BASE_URL + '/logout', { timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(2000)
      if (page.url().includes('/login')) {
        loggedOut = true
        result.notes.push('logout_via_url_nav')
      }
    }

    result.loggedOut = loggedOut
    result.notes.push(loggedOut ? 'logout_ok' : 'logout_failed')

    await page.waitForTimeout(2000)

    // Capture localStorage after logout
    const lsAfter = await page.evaluate(() => {
      const items = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        items[key] = localStorage.getItem(key)
      }
      return items
    }).catch(() => ({}))
    result.postLogoutLocalStorageKeys = Object.keys(lsAfter)

    // Log back in
    await loginAndLoadDashboard(page)
    result.loginAfterLogout = true
    result.notes.push('login_after_logout_ok')

    await page.waitForTimeout(3000)
    const bodyAfterLogin = await page.locator('body').textContent().catch(() => '')
    result.hasRecoveryPrompt = (
      bodyAfterLogin.toLowerCase().includes('recover') ||
      bodyAfterLogin.toLowerCase().includes('resume') ||
      bodyAfterLogin.toLowerCase().includes('continue where')
    )

    // Capture localStorage after login
    const lsAfterLogin = await page.evaluate(() => {
      const items = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        items[key] = localStorage.getItem(key)
      }
      return items
    }).catch(() => ({}))
    result.postLoginLocalStorageKeys = Object.keys(lsAfterLogin)

    // Determine work preservation
    if (result.answeredBeforeLogout > 0) {
      if (result.hasRecoveryPrompt) {
        result.workPreserved = true
        result.notes.push('work_preserved_recovery_prompt_shown')
      } else {
        // Check if answers reappear in the test
        const testSessionStart = await startSessionFromDashboard(page)
        await dismissFlashcardModal(page)
        await skipToTestMenu(page)
        await page.waitForTimeout(1000)
        const testInputs = page.locator('input[placeholder="Type your definition..."]')
        const testInputCount = await testInputs.count()
        if (testInputCount > 0) {
          const firstInputValue = await testInputs.first().inputValue().catch(() => '')
          if (firstInputValue && firstInputValue.length > 3) {
            result.workPreserved = true
            result.notes.push('answers_restored_in_test_inputs')
          } else {
            result.workPreserved = false
            result.notes.push('test_inputs_empty_after_login_work_lost')
          }
        } else {
          result.workPreserved = false
          result.notes.push('no_test_inputs_visible_after_login')
        }
      }
    }

    // Severity assessment
    if (result.answeredBeforeLogout > 0 && result.workPreserved === false) {
      result.severity = 'HIGH'
      result.notes.push('SEVERITY_HIGH: in-progress typed answers lost on logout/login')
    } else if (result.workPreserved === true) {
      result.severity = 'INFO'
      result.notes.push('work_preserved_ok')
    } else {
      result.severity = 'INFO'
    }

    console.log(`Logout/Login result: loggedOut=${result.loggedOut}, loginOk=${result.loginAfterLogout}, hasRecovery=${result.hasRecoveryPrompt}, workPreserved=${result.workPreserved}, severity=${result.severity}`)

  } catch (err) {
    result.notes.push(`error: ${err.message}`)
    result.severity = 'MEDIUM'
    console.error('Logout/Login scenario error:', err.message)
  } finally {
    await page.screenshot({ path: join(EVIDENCE_DIR, 'logout_login_scenario.png'), fullPage: false }).catch(() => {})
    await page.close().catch(() => {})
    await context.close().catch(() => {})
  }

  return result
}

// ---- Main ----
async function main() {
  logEvent({ type: 'audit_start', label: 'PERF27', persona: 'perfectionist', class: 'TOP', batch: 'B27', startedAt: new Date().toISOString() })
  writeStatus({ label: 'PERF27', status: 'running', startedAt: new Date().toISOString() })

  // Read initial state (READ ONLY)
  const initialCP = await readClassProgress()
  const initialCSD = initialCP?.currentStudyDay ?? 0
  const initialTWI = initialCP?.totalWordsIntroduced ?? 0
  const initialIL = initialCP?.interventionLevel ?? 0

  console.log(`=== B27 perfectionist/TOP audit (PERF27) ===`)
  console.log(`Initial CSD: ${initialCSD}, TWI: ${initialTWI}, IL: ${initialIL}`)
  console.log(`recentSessions: ${JSON.stringify(initialCP?.recentSessions)}`)
  console.log(`Starting from Day ${initialCSD + 1}`)

  // Orphan check at start
  const allCPDocsBefore = await readAllClassProgressDocs()
  console.log(`class_progress docs at start: ${allCPDocsBefore.map(d => d.id).join(', ')}`)
  const orphansBefore = allCPDocsBefore.filter(d => !d.id.includes('_'))
  console.log(`Orphan docs before (classId-only): ${orphansBefore.length}`)

  const startingDay = initialCSD + 1
  const TARGET_SESSIONS = 20

  // Anchor date: June 9, 2026 (Monday) for Day 1 of perfectionist.
  // perfectionist CSD=0 → starts at Day 1.
  // We anchor at June 9 to be safe (prior personas used June 2-16 for their days).
  // June 9 = Monday = Day 1. Day 2 = June 10, Day 3 = June 11, Day 4 = June 12,
  // Day 5 = June 13 (Fri), Day 6 = June 16 (Mon), Day 7 = June 17...
  const ANCHOR_DATE = new Date('2026-06-09T09:00:00+09:00')

  let currentDate = new Date(ANCHOR_DATE)
  // Advance currentDate by (startingDay - 1) weekdays from anchor
  for (let d = 1; d < startingDay; d++) {
    currentDate = nextStudyDate(currentDate)
  }
  // Ensure not on weekend
  while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
  }

  console.log(`Starting date: ${currentDate.toISOString()}`)

  const dayTable = []
  const findingsList = []
  const allSessionResults = []
  let h2StaleCount = 0
  let stopConditionHit = false
  let stopReason = null
  let masteredInReviewDays = []
  let finalAnswerIntegrityFails = []

  let browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH
  })

  async function ensureBrowser() {
    try {
      if (browser && !browser.isConnected()) {
        console.log('Browser disconnected, relaunching...')
        browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH })
      }
    } catch (e) {
      browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH })
    }
    return browser
  }

  try {
    for (let sessionIdx = 0; sessionIdx < TARGET_SESSIONS; sessionIdx++) {
      const dayNumber = startingDay + sessionIdx

      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      }

      browser = await ensureBrowser()

      console.log(`\n=== Day ${dayNumber} | ${currentDate.toISOString().split('T')[0]} ===`)
      logEvent({ type: 'session_start', day: dayNumber, date: currentDate.toISOString() })

      // Read pre-session state (READ ONLY)
      const preCP = await readClassProgress()
      const preCSD = preCP?.currentStudyDay ?? (dayNumber - 1)
      const preTWI = preCP?.totalWordsIntroduced ?? 0
      const preIL = preCP?.interventionLevel ?? 0
      const preRecentSessions = preCP?.recentSessions ?? []

      // Compute IL from recentReviewScores
      const recentReviewScores = preRecentSessions.map(s => s.reviewScore).filter(s => s != null)
      const computedIL = calculateInterventionLevel(recentReviewScores)
      const effectiveIL = preIL

      // Pre study_states (for review identity check)
      const preStudyStates = await readStudyStates()
      const preStudyStateMap = {}
      for (const ss of preStudyStates) {
        const wid = ss.wordId || ss.id
        preStudyStateMap[wid] = {
          wordId: wid,
          status: ss.status,
          returnAtMs: ss.returnAt ? (ss.returnAt._seconds ? ss.returnAt._seconds * 1000 : ss.returnAt) : null,
          wordIndex: ss.wordIndex
        }
      }

      const statusHistPre = {}
      for (const ss of preStudyStates) {
        statusHistPre[ss.status || 'UNKNOWN'] = (statusHistPre[ss.status || 'UNKNOWN'] || 0) + 1
      }

      // Expected new word range (pre-test TWI)
      const expNewRange = expectedNewWordRange(preTWI, DAILY_PACE, effectiveIL, LIST_SIZE)

      const nowMs = currentDate.getTime()

      // MASTERED with future returnAt (F01 pre-check)
      const masteredWithFutureReturnAt = preStudyStates.filter(ss => {
        if (ss.status !== 'MASTERED') return false
        if (!ss.returnAt) return false
        const rMs = ss.returnAt._seconds ? ss.returnAt._seconds * 1000 : ss.returnAt
        return rMs > nowMs
      })

      console.log(`Pre: CSD=${preCSD}, TWI=${preTWI}, IL=${effectiveIL} (computed=${computedIL.toFixed(3)})`)
      console.log(`Expected new: ${expNewRange ? `pos [${expNewRange.startIndex},${expNewRange.endIndex}] count=${expNewRange.count}` : 'null'}`)
      console.log(`MASTERED with FUTURE returnAt: ${masteredWithFutureReturnAt.length}`)

      // Run session
      const sessionResult = await runOneSession(browser, currentDate, dayNumber)
      allSessionResults.push(sessionResult)

      if (sessionResult.h2StaleHit) h2StaleCount++

      // Check final answer integrity for perfectionist persona
      const integrityChecks = sessionResult.newTest?.finalAnswerIntegrity || []
      const integrityFails = integrityChecks.filter(c => !c.matches)
      if (integrityFails.length > 0) {
        finalAnswerIntegrityFails.push({ day: dayNumber, fails: integrityFails })
        console.log(`INTEGRITY FAIL: ${integrityFails.length} answers had stale/truncated values after edit churn`)
      }

      // Wait for Firestore to settle
      await new Promise(r => setTimeout(r, 5000))

      // POST-session state (read-only)
      const postCP = await readClassProgress()
      const postCSD = postCP?.currentStudyDay ?? preCSD
      const postTWI = postCP?.totalWordsIntroduced ?? preTWI
      const postIL = postCP?.interventionLevel ?? effectiveIL
      const postRecentSessions = postCP?.recentSessions ?? []

      const postStudyStates = await readStudyStates()
      const statusHistPost = {}
      for (const ss of postStudyStates) {
        statusHistPost[ss.status || 'UNKNOWN'] = (statusHistPost[ss.status || 'UNKNOWN'] || 0) + 1
      }

      const masteredWords = postStudyStates.filter(ss => ss.status === 'MASTERED')
      const masteredCount = masteredWords.length
      const masteredWithReturnAt = masteredWords.filter(m => m.returnAt != null)

      // Post-test TWI for segment calculation (HARNESS FIX: post-test, not pre-test)
      const expSegmentPost = calculateSegment(dayNumber, STUDY_DAYS_PER_WEEK, postTWI, DAILY_PACE, postIL)

      // Compute post eligibility
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

      // NEW word check (range-based)
      const newPresentedPositions = (sessionResult.newTest?.presentedWords ?? [])
        .map(w => w.position).filter(p => p >= 0)
      const newViolations = checkNewWords({
        presentedPositions: newPresentedPositions,
        expectedRange: expNewRange
      })

      // REVIEW check by IDENTITY (HARNESS FIX 1)
      // Build presentedWordStates from served review words with PRE-session status
      const reviewPresentedWords = (sessionResult.reviewTest?.presentedWords ?? [])
      const reviewPresentedWordStates = reviewPresentedWords.map(w => {
        const wEntry = WORD_BY_POSITION[w.position] || (w.wordId ? WORD_BY_ID[w.wordId] : null)
        const preState = wEntry ? preStudyStateMap[wEntry.id] : null
        return {
          wordId: wEntry?.id || w.wordId || null,
          position: w.position,
          preStatus: preState?.status || 'UNKNOWN',
          preReturnAtMs: preState?.returnAtMs || null
        }
      })

      const reviewViolations = checkReviewWords({
        presentedWordStates: reviewPresentedWordStates,
        segment: expSegmentPost,
        nowMs
      })

      // F01 check: MASTERED with future returnAt in review (by served word identity)
      const masteredInReview = []
      for (const ws of reviewPresentedWordStates) {
        if (ws.preStatus === 'MASTERED' && ws.preReturnAtMs && ws.preReturnAtMs > nowMs) {
          masteredInReview.push({
            wordId: ws.wordId,
            position: ws.position,
            preReturnAtMs: ws.preReturnAtMs
          })
        }
      }

      if (masteredInReview.length > 0) {
        masteredInReviewDays.push(dayNumber)
        console.log(`F01 ALERT: ${masteredInReview.length} MASTERED words (future returnAt) in review on Day ${dayNumber}`)
        if (masteredInReviewDays.length >= 2) {
          stopConditionHit = true
          stopReason = `F01 REGRESSION: MASTERED words with future returnAt in review on days ${masteredInReviewDays.join(', ')}`
        }
      }

      const allViolations = [...newViolations, ...reviewViolations.filter(v => !v.startsWith('review-info:'))]

      const csdOk = !sessionResult.blocked ? (postCSD === dayNumber) : null

      const reviewPresentedPositions = reviewPresentedWords.map(w => w.position).filter(p => p >= 0)

      const recentReviewScoresPost = postRecentSessions.map(s => s.reviewScore).filter(s => s != null)
      const computedILPost = calculateInterventionLevel(recentReviewScoresPost)

      const dayRow = {
        day: dayNumber,
        date: currentDate.toISOString().split('T')[0],
        preCSD, postCSD, csdOk,
        csdDrift: !sessionResult.blocked && postCSD !== dayNumber ? `expected ${dayNumber} got ${postCSD}` : null,
        preTWI, postTWI,
        preIL: effectiveIL, postIL,
        computedILPost: computedILPost.toFixed(3),
        expNewRange: expNewRange ? `[${expNewRange.startIndex},${expNewRange.endIndex}](${expNewRange.count})` : 'null',
        presentedNewCount: newPresentedPositions.length,
        newMatch: newViolations.length === 0,
        expSegmentPost: expSegmentPost ? `[${expSegmentPost.startIndex},${expSegmentPost.endIndex}]` : 'null',
        eligiblePostCount: eligibleIdsPost.size,
        retiredPostCount: retiredIdsPost.size,
        presentedReviewCount: reviewPresentedPositions.length,
        reviewMatch: reviewViolations.filter(v => !v.startsWith('review-info:')).length === 0,
        masteredInReviewCount: masteredInReview.length,
        masteredCount,
        masteredWithReturnAtCount: masteredWithReturnAt.length,
        newTestScore: sessionResult.newTest?.score,
        reviewTestScore: sessionResult.reviewTest?.score,
        integrityChecksTotal: integrityChecks.length,
        integrityFails: integrityFails.length,
        violations: allViolations,
        steps: sessionResult.steps,
        blocked: sessionResult.blocked,
        blockedReason: sessionResult.blockedReason,
        h2StaleHit: sessionResult.h2StaleHit,
        errors: sessionResult.errors.slice(0, 3)
      }

      dayTable.push(dayRow)

      if (allViolations.length > 0) {
        console.log(`VIOLATIONS: ${allViolations.join('; ')}`)
        findingsList.push({ day: dayNumber, violations: allViolations })
      }

      console.log(`Post: CSD=${postCSD}(ok:${csdOk}), TWI=${postTWI}, IL=${postIL.toFixed(3)}, MASTERED=${masteredCount}, newScore=${sessionResult.newTest?.score}, reviewScore=${sessionResult.reviewTest?.score}, V=${allViolations.length}, F01=${masteredInReview.length}, integrity_fails=${integrityFails.length}, blocked=${sessionResult.blocked}`)

      // Save day evidence JSON
      const evidenceData = {
        dayNumber,
        sessionDate: currentDate.toISOString(),
        persona: 'perfectionist',
        preCSD, postCSD, preTWI, postTWI,
        preIL: effectiveIL, postIL,
        computedILPost,
        recentReviewScores: recentReviewScoresPost,
        expectedNewRange: expNewRange,
        expectedSegmentPost: expSegmentPost,
        eligibleForReview: eligibleIdsPost.size,
        retiredFromReview: retiredIdsPost.size,
        newTest: {
          presentedWords: sessionResult.newTest?.presentedWords ?? [],
          presentedPositions: newPresentedPositions,
          score: sessionResult.newTest?.score,
          questionCount: sessionResult.newTest?.questionCount ?? 0,
          finalAnswerIntegrity: integrityChecks
        },
        reviewTest: sessionResult.reviewTest ? {
          presentedWords: sessionResult.reviewTest.presentedWords,
          presentedWordStates: reviewPresentedWordStates,
          presentedPositions: reviewPresentedPositions,
          score: sessionResult.reviewTest.score,
          questionCount: sessionResult.reviewTest.questionCount
        } : null,
        violations: allViolations,
        reviewInfoViolations: reviewViolations.filter(v => v.startsWith('review-info:')),
        masteredInReview,
        f01MasteredInReview: masteredInReview.length,
        statusHistogramPre: statusHistPre,
        statusHistogramPost: statusHistPost,
        masteredCount,
        masteredWithReturnAtCount: masteredWithReturnAt.length,
        masteredSample: masteredWords.slice(0, 3).map(m => ({
          id: m.id, wordId: m.wordId, status: m.status,
          returnAtSec: m.returnAt?._seconds ?? m.returnAt
        })),
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
        preIL: effectiveIL, postIL,
        masteredCount,
        masteredInReviewCount: masteredInReview.length,
        violations: allViolations.length,
        integrityFails: integrityFails.length,
        newScore: sessionResult.newTest?.score,
        reviewScore: sessionResult.reviewTest?.score,
        blocked: sessionResult.blocked,
        h2StaleHit: sessionResult.h2StaleHit
      })

      if (sessionResult.blocked) {
        console.log(`Day ${dayNumber} BLOCKED: ${sessionResult.blockedReason}`)
      }

      if (stopConditionHit) {
        console.log(`STOP CONDITION HIT: ${stopReason}`)
        logEvent({ type: 'stop_condition_hit', reason: stopReason, day: dayNumber })
        break
      }

      currentDate = nextStudyDate(currentDate)
    }

    // ---- Logout/Login scenario (LAST, in fresh context) ----
    console.log('\nRunning logout/login scenario in fresh context (last)...')
    const llDate = new Date(currentDate.getTime()) // use current date for scenario
    const logoutLoginResult = await runLogoutLoginScenario(browser, llDate)

    // Save logout/login evidence
    writeFileSync(join(EVIDENCE_DIR, 'logout_login_scenario.json'), JSON.stringify(logoutLoginResult, null, 2))
    logEvent({ type: 'logout_login_scenario_complete', ...logoutLoginResult })

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

    // Check attempt id format (must be classId+listId format, not classId-only)
    const badFormatAttempts = finalAttempts.filter(a => {
      // Attempt IDs should contain both classId and listId
      return !a.id.includes(LIST_ID)
    })
    console.log(`Attempts with bad id format: ${badFormatAttempts.length}`)

    logEvent({
      type: 'audit_complete',
      sessionsCompleted: allSessionResults.filter(s => !s.blocked).length,
      totalSessions: allSessionResults.length,
      newOrphansCreated: newOrphansCreated.length,
      h2StaleCount,
      stopConditionHit,
      finalCPDocs: finalAllCPDocs.map(d => d.id),
      finalAnswerIntegrityFails: finalAnswerIntegrityFails.length,
      logoutLoginSeverity: logoutLoginResult.severity
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
      masteredInReviewDays,
      finalAnswerIntegrityFails,
      logoutLoginResult
    }

  } finally {
    await browser.close()
  }
}

const result = await main()

console.log('\n=== B27 PERFECTIONIST/TOP AUDIT COMPLETE ===')
console.log(`Starting day: ${result.startingDay}`)
console.log(`Sessions completed: ${result.sessionsCompleted}/${result.totalSessions}`)
console.log(`H2 stale hits: ${result.h2StaleCount}`)
console.log(`New orphan docs created: ${result.newOrphansCreated}`)
console.log(`Stop condition hit: ${result.stopConditionHit}`)
if (result.stopConditionHit) console.log(`Stop reason: ${result.stopReason}`)
console.log(`Mastered-in-review days: ${result.masteredInReviewDays.join(', ') || 'none'}`)
console.log(`Final answer integrity fails: ${result.finalAnswerIntegrityFails.length} sessions`)
console.log(`Logout/login result: workPreserved=${result.logoutLoginResult?.workPreserved}, severity=${result.logoutLoginResult?.severity}`)
console.log(`Final class_progress docs: ${result.finalCPDocs.join(', ')}`)

console.log('\nDay table:')
for (const row of result.dayTable) {
  const f01 = row.masteredInReviewCount > 0 ? ` F01=${row.masteredInReviewCount}` : ''
  const integ = row.integrityFails > 0 ? ` INTEGRITY_FAIL=${row.integrityFails}` : ''
  console.log(`  Day ${row.day}: CSD ${row.preCSD}→${row.postCSD}(ok:${row.csdOk}), IL=${row.preIL.toFixed(2)}→${row.postIL.toFixed(2)}, new=[${row.expNewRange}]→${row.presentedNewCount}(match:${row.newMatch}), review=${row.presentedReviewCount}(match:${row.reviewMatch}${f01}), MASTERED=${row.masteredCount}, newScore=${row.newTestScore}, reviewScore=${row.reviewTestScore}, V=${row.violations.length}${integ}, blocked=${row.blocked}`)
}

if (result.findingsList.length > 0) {
  console.log('\nViolations:')
  for (const f of result.findingsList) {
    console.log(`  Day ${f.day}: ${f.violations.join('; ')}`)
  }
}

// Write summary
const summaryPath = join(EVIDENCE_DIR, 'audit_summary.json')
writeFileSync(summaryPath, JSON.stringify(result, null, 2))
console.log(`\nSummary: ${summaryPath}`)
