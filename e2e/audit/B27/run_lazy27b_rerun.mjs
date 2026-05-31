/**
 * B27 Longitudinal Audit Runner — LAZY27B (identity-based F01 re-verification)
 * Label: LAZY27B
 *
 * This agent REPLACES the prior L27 run which used a BROKEN position-based checker.
 * Corrections:
 *   1. Uses checkReviewWords (identity-based) NOT checkPresentedWords (position-based).
 *   2. Pre-session study_state lookup PER SERVED WORD (not post-session, not by position map).
 *   3. NEVER_TESTED words (no study_state doc) are valid review candidates — do NOT flag them.
 *   4. Build presentedWordStates from actual served wordIds + their OWN pre-session study_state.
 *
 * ABSOLUTE RULES: Admin SDK READ-ONLY. No writes. UI-only state advancement.
 * Single browser instance. browser.close() in finally.
 * Run from /app. ESM .mjs.
 */

import { chromium } from 'playwright'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs'
import { join } from 'path'
import * as expected from '/app/e2e/audit/helpers/expectedWords.js'

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

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B27/lazy_rerun'
const AGENT_LOGS_DIR = '/app/audit/playwright/findings/agent_logs'
const SA_PATH = '/app/scripts/serviceAccountKey.json'

mkdirSync(EVIDENCE_DIR, { recursive: true })
mkdirSync(AGENT_LOGS_DIR, { recursive: true })

// ---- Logging ----
const LABEL = 'LAZY27B'
const jsonlPath = join(AGENT_LOGS_DIR, `${LABEL}.jsonl`)
const statusPath = join(AGENT_LOGS_DIR, `${LABEL}.status.json`)

function logEvent(evt) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...evt }) + '\n'
  try { appendFileSync(jsonlPath, line) } catch (e) { console.error('log err:', e.message) }
}

function writeStatus(s) {
  writeFileSync(statusPath, JSON.stringify(s, null, 2))
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

// ---- Word lookup ----
const WORD_CACHE = JSON.parse(readFileSync('/app/e2e/audit/B27/word_position_cache.json', 'utf-8'))
const WORD_BY_TEXT = {}
const WORD_BY_ID = {}
const WORD_BY_POSITION = {}
for (const w of WORD_CACHE) {
  WORD_BY_TEXT[w.word.trim().toLowerCase()] = w
  WORD_BY_ID[w.id] = w
  WORD_BY_POSITION[w.position] = w
}
function lookupWordByText(text) {
  if (!text) return null
  // Try exact match
  let w = WORD_BY_TEXT[text.trim().toLowerCase()]
  if (w) return w
  // Try stripping "(old English)" suffix
  const cleaned = text.trim().replace(/\s*\([^)]+\)\s*$/, '').trim().toLowerCase()
  return WORD_BY_TEXT[cleaned] || null
}

// Build wordId -> study_state map from a study_states array
function buildSSMap(studyStates) {
  const byWordId = {}
  for (const ss of studyStates) {
    // study_state doc id IS the wordId (or .wordId field)
    const wid = ss.wordId || ss.id
    if (wid) byWordId[wid] = ss
  }
  return byWordId
}

function getReturnAtMs(ss) {
  if (!ss || !ss.returnAt) return null
  if (ss.returnAt._seconds != null) return ss.returnAt._seconds * 1000
  if (typeof ss.returnAt === 'number') return ss.returnAt
  return null
}

// Lazy persona
const IDK_SET = ['idk', 'I don\'t know', '모름', '?', 'pass']
function lazyAnswer() {
  return IDK_SET[Math.floor(Math.random() * IDK_SET.length)]
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
  if (!url.includes('/login')) {
    const bodyText = await page.locator('body').textContent().catch(() => '')
    if (bodyText.includes('Dashboard') || bodyText.includes('Day') || bodyText.includes('Session')) {
      return true
    }
  }
  await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1000)
  try {
    await page.locator('input[type="email"]').fill(EMAIL)
  } catch {
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)
    await page.locator('input[type="email"]').fill(EMAIL)
  }
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /continue/i }).first().click()
  await page.waitForTimeout(5000)
  const finalUrl = page.url()
  if (finalUrl.includes('/login')) throw new Error('Login failed')
  return true
}

async function getDashboardCSD(page) {
  const bodyText = await page.locator('body').textContent().catch(() => '')
  const match = bodyText.match(/Day\s+(\d+)\s*(?:Start Session|Complete|Continue|Upcoming)/i)
  return match ? parseInt(match[1]) : null
}

async function startSessionFromDashboard(page) {
  const continueBtn = page.getByRole('button', { name: /continue session/i }).first()
  if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await continueBtn.click()
    await page.waitForTimeout(3000)
    return { resumed: true }
  }
  const startBtns = page.getByRole('button', { name: /^Start Session$/i })
  const count = await startBtns.count()
  if (count === 0) {
    // Also try "Start"
    const startBtns2 = page.getByRole('button', { name: /^Start$/i })
    if (await startBtns2.count() > 0) {
      await startBtns2.first().click()
      await page.waitForTimeout(3000)
      return { resumed: false }
    }
    return { error: 'No Start Session button found' }
  }
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

async function skipToTestViaMenu(page) {
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

async function getCurrentStep(page) {
  const bodyText = await page.locator('body').textContent().catch(() => '')
  const stepMatch = bodyText.match(/Step (\d+) of (\d+)/)
  return stepMatch ? parseInt(stepMatch[1]) : null
}

// Complete typed new-word test with lazy answers; returns presentedWords [{word,wordId,position}]
async function completeTypedTestLazy(page) {
  const typedInputs = page.locator('input[placeholder="Type your definition..."]')
  const inputCount = await typedInputs.count().catch(() => 0)
  if (inputCount === 0) return { error: 'no typed inputs', presentedWords: [], score: null, questionCount: 0 }

  // Extract word texts from the page
  const items = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[placeholder="Type your definition..."]')
    return Array.from(inputs).map(inp => {
      // Walk up to find the word label
      let el = inp.parentElement
      for (let i = 0; i < 6; i++) {
        const spans = el?.querySelectorAll('span.font-medium, span.font-bold, [class*="font-medium"], [class*="font-bold"]')
        if (spans && spans.length > 0) {
          for (const sp of spans) {
            const t = sp.textContent.trim()
            if (t && t.length < 80 && !t.includes('Type')) return { word: t }
          }
        }
        el = el?.parentElement
      }
      // Fallback: look for any h2/h3 in the card
      const card = inp.closest('[class*="card"], [class*="rounded"], [class*="bg-"]')
      const hd = card?.querySelector('h2,h3,[class*="text-2xl"],[class*="text-xl"]')
      return { word: hd ? hd.textContent.trim() : '' }
    })
  }).catch(() => [])

  const presentedWords = []
  for (let i = 0; i < inputCount; i++) {
    const wordText = items[i]?.word || ''
    const wordEntry = lookupWordByText(wordText)
    presentedWords.push({
      word: wordText,
      wordId: wordEntry?.id ?? null,
      position: wordEntry?.position ?? -1
    })
    const answer = lazyAnswer()
    await typedInputs.nth(i).click()
    for (const char of answer) {
      await typedInputs.nth(i).type(char, { delay: 30 })
    }
  }

  // Submit
  const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
  if (!await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    return { error: 'submit btn not found', presentedWords, score: null, questionCount: inputCount }
  }
  await submitBtn.click()

  // Wait for grading
  let score = null
  for (let t = 0; t < 14; t++) {
    await page.waitForTimeout(5000)
    const body = await page.locator('body').textContent().catch(() => '')
    if (body.includes('Completed Day') || body.match(/\d+%/) || body.includes(' of ') && body.includes('correct') || body.includes('Your Answer')) {
      const m = body.match(/(\d+)%/)
      const m2 = body.match(/(\d+) of (\d+) correct/)
      if (m) score = parseInt(m[1])
      else if (m2) score = Math.round(parseInt(m2[1]) / parseInt(m2[2]) * 100)
      break
    }
  }

  return { presentedWords, questionCount: inputCount, score }
}

// Complete MCQ review test; returns presentedWords [{word,wordId,position}]
// CRITICAL: capture served word IDENTITY (wordId from screen text -> cache lookup)
async function completeMCQTestLazy(page) {
  const presentedWords = []
  let answeredCount = 0
  const maxQ = 100

  for (let q = 0; q < maxQ; q++) {
    const bodyText = await page.locator('body').textContent().catch(() => '')
    if (!bodyText.includes('Review Test') && !bodyText.includes('review test')) break

    // Get option buttons (MCQ)
    const optionBtns = page.locator('button').filter({ hasText: /\w{3,}/ }).filter({
      // filter out nav/submit buttons
      hasNot: page.locator('[aria-label]')
    })

    // Better: use role=button with option-like styling
    const allBtns = await page.locator('button').all()
    let optionButtons = []
    for (const btn of allBtns) {
      const text = await btn.textContent().catch(() => '')
      const cls = await btn.getAttribute('class').catch(() => '')
      // MCQ option buttons typically have min-height or rounded styling and contain definition text
      if (text && text.length > 5 && text.length < 200 &&
          !text.match(/submit|next|back|skip|continue|start|cancel|review test/i) &&
          (cls?.includes('rounded') || cls?.includes('border'))) {
        optionButtons.push(btn)
      }
    }

    if (optionButtons.length === 0) {
      // Try submit
      const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click()
        await page.waitForTimeout(5000)
        break
      }
      break
    }

    // Get current word from page - look for prominent word display
    const wordText = await page.evaluate(() => {
      // Try h1, h2, h3 first
      for (const tag of ['h1', 'h2', 'h3']) {
        const els = document.querySelectorAll(tag)
        for (const el of els) {
          const t = el.textContent.trim()
          if (t && t.length > 1 && t.length < 80 &&
              !t.includes('Review Test') && !t.includes('Step ') &&
              !t.includes('%') && !t.includes('of ') && !t.match(/^\d/)) {
            return t
          }
        }
      }
      // Fallback: large text
      const largeEls = document.querySelectorAll('[class*="text-3xl"], [class*="text-4xl"], [class*="text-2xl"]')
      for (const el of largeEls) {
        const t = el.textContent.trim()
        if (t && t.length > 1 && t.length < 80 &&
            !t.includes('Review Test') && !t.includes('Step ') && !t.match(/^\d/)) {
          return t
        }
      }
      return null
    }).catch(() => null)

    const wordClean = wordText ? wordText.split('\n')[0].replace(/\s*\([^)]+\)\s*$/, '').trim() : ''
    const wordEntry = lookupWordByText(wordClean)
    presentedWords.push({
      word: wordClean,
      wordId: wordEntry?.id ?? null,
      position: wordEntry?.position ?? -1,
      notFound: !wordEntry
    })

    // Lazy: click first available option
    if (optionButtons.length > 0) {
      await optionButtons[0].click().catch(() => {})
      answeredCount++
      await page.waitForTimeout(300)
    }

    // Check if all answered
    const afterBody = await page.locator('body').textContent().catch(() => '')
    const m = afterBody.match(/(\d+)\s*of\s*(\d+)\s*answered/i)
    if (m && parseInt(m[1]) >= parseInt(m[2])) {
      const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitBtn.click()
        await page.waitForTimeout(5000)
        break
      }
    }
  }

  const finalBody = await page.locator('body').textContent().catch(() => '')
  const m1 = finalBody.match(/(\d+)%/)
  const m2 = finalBody.match(/(\d+)\s*of\s*(\d+)\s*correct/i)
  const score = m1 ? parseInt(m1[1]) : (m2 ? Math.round(parseInt(m2[1]) / parseInt(m2[2]) * 100) : null)

  return { presentedWords, questionCount: answeredCount, score }
}

// ---- Find logout button ----
async function findAndClickLogout(page) {
  // Strategy 1: profile/avatar icon
  const selectors = [
    '[aria-label*="profile" i]', '[aria-label*="account" i]', '[aria-label*="user" i]',
    'button[class*="avatar"]', 'img[class*="avatar"]', '[aria-label*="menu" i]',
    'button[aria-label]'
  ]
  for (const sel of selectors) {
    const btn = page.locator(sel).first()
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click()
      await page.waitForTimeout(500)
      const logoutBtn = page.getByRole('button', { name: /log.?out|sign.?out/i }).first()
      if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoutBtn.click()
        return { method: sel, ok: true }
      }
      await page.keyboard.press('Escape').catch(() => {})
    }
  }

  // Strategy 2: navigate to /logout
  await page.goto(BASE_URL + '/logout', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(2000)
  if (page.url().includes('/login')) return { method: '/logout route', ok: true }

  // Strategy 3: direct link/text
  const logoutLink = page.getByText(/^log.?out$|^sign.?out$/i).first()
  if (await logoutLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutLink.click()
    await page.waitForTimeout(2000)
    return { method: 'text link', ok: true }
  }

  return { method: 'none', ok: false }
}

// ---- Run one day session ----
async function runOneSession(browser, sessionDate, dayNumber, preStudyStateMap, opts = {}) {
  const result = {
    dayNumber,
    sessionDate: sessionDate.toISOString(),
    newTest: { presentedWords: [], score: null, questionCount: 0 },
    reviewTest: null,
    // presentedWordStates for checkReviewWords: filled in below
    presentedWordStates: [],
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

  // Unregister service workers
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
    await loginAndLoadDashboard(page)
    result.steps.push('login_ok')

    // Dashboard CSD
    const dashCSD = await getDashboardCSD(page)
    result.steps.push(`dashboard_shows_day_${dashCSD}`)

    // H2 guard: check for stale Step 5
    let bodyCheck = await page.locator('body').textContent().catch(() => '')
    const isOnSessionPage = page.url().includes('/session') || bodyCheck.includes('Step ')
    if (isOnSessionPage) {
      const stepMatch = bodyCheck.match(/Step (\d+) of (\d+)/)
      if (stepMatch && parseInt(stepMatch[1]) === 5) {
        result.h2StaleHit = true
        result.steps.push('H2_stale_step5')
        // Click Move On / Back to Dashboard to clear stale state
        const moveOnBtn = page.getByRole('button', { name: /move on to next day/i }).first()
        const backBtn = page.getByRole('button', { name: /back to dashboard/i }).first()
        if (await moveOnBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await moveOnBtn.click()
          result.steps.push('H2_cleared_via_move_on')
        } else if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await backBtn.click()
          result.steps.push('H2_cleared_via_back')
        } else {
          await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 })
          result.steps.push('H2_cleared_via_nav')
        }
        await page.waitForTimeout(2000)
        // Re-check
        bodyCheck = await page.locator('body').textContent().catch(() => '')
        const stepMatch2 = bodyCheck.match(/Step (\d+) of (\d+)/)
        if (stepMatch2 && parseInt(stepMatch2[1]) === 5) {
          result.blocked = true
          result.blockedReason = 'H2: persistent stale Step 5 after clear attempt'
          result.steps.push('H2_still_stale_blocked')
          return result
        }
      }
    }

    // ---- LOGOUT/LOGIN SCENARIO (LAST, in separate context per HARNESS FIX 2) ----
    // Handled separately after main walk — see bottom of main()

    // Start session
    const sessionStart = await startSessionFromDashboard(page)
    if (sessionStart.error) {
      result.blocked = true
      result.blockedReason = sessionStart.error
      result.steps.push('start_session_failed')
      return result
    }
    result.steps.push(sessionStart.resumed ? 'session_resumed' : 'session_started')

    // Check what step we're at
    await page.waitForTimeout(1500)
    let currentStep = await getCurrentStep(page)
    if (currentStep === null) {
      // Maybe we're at flashcard phase
      bodyCheck = await page.locator('body').textContent().catch(() => '')
      if (bodyCheck.includes('Step')) {
        const sm = bodyCheck.match(/Step (\d+)/)
        currentStep = sm ? parseInt(sm[1]) : 1
      } else {
        currentStep = 1
      }
    }
    result.steps.push(`at_step_${currentStep}`)

    if (currentStep === 5) {
      // H2 stale — already at completion
      result.h2StaleHit = true
      result.steps.push('H2_step5_after_start')
      const moveOnBtn = page.getByRole('button', { name: /move on to next day/i }).first()
      const backBtn = page.getByRole('button', { name: /back to dashboard/i }).first()
      if (await moveOnBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await moveOnBtn.click()
        result.steps.push('moved_to_next_day')
      } else if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await backBtn.click()
        result.steps.push('back_to_dashboard')
      }
      result.blocked = true
      result.blockedReason = 'H2: session already complete (Step 5) on entry'
      return result
    }

    // ---- NEW WORD PHASE ----
    if (currentStep <= 2) {
      // Dismiss flashcard if needed
      await dismissFlashcardModal(page)

      if (currentStep === 1) {
        const skipped = await skipToTestViaMenu(page)
        result.steps.push(skipped ? 'skipped_to_typed_test' : 'skip_failed')
      }

      const typedResult = await completeTypedTestLazy(page)
      result.newTest = typedResult
      if (typedResult.error) result.errors.push(typedResult.error)
      result.steps.push(`typed_done_score_${typedResult.score}`)

      // Wait for step transition
      await page.waitForTimeout(2000)
      let bodyAfterTyped = await page.locator('body').textContent().catch(() => '')
      let afterStep = await getCurrentStep(page)

      // Click Continue if on Step 2 results
      const continueBtn = page.getByRole('button', { name: /^continue$/i }).first()
      if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await continueBtn.click()
        result.steps.push('clicked_continue')
        await page.waitForTimeout(3000)
        afterStep = await getCurrentStep(page)
        bodyAfterTyped = await page.locator('body').textContent().catch(() => '')
      }

      result.steps.push(`after_typed_step_${afterStep}`)

      if (afterStep === 3 || bodyAfterTyped.includes('Review Study') || bodyAfterTyped.includes('review study')) {
        await dismissFlashcardModal(page)
        const skipped2 = await skipToTestViaMenu(page)
        result.steps.push(skipped2 ? 'skipped_to_review_test' : 'review_skip_failed')
        const revResult = await completeMCQTestLazy(page)
        result.reviewTest = revResult
        result.steps.push(`review_done_score_${revResult.score}`)
      } else if (afterStep === 4 || bodyAfterTyped.includes('Review Test')) {
        const revResult = await completeMCQTestLazy(page)
        result.reviewTest = revResult
        result.steps.push(`review_done_score_${revResult.score}`)
      }
    } else if (currentStep === 3) {
      await dismissFlashcardModal(page)
      const skipped = await skipToTestViaMenu(page)
      result.steps.push(skipped ? 'skipped_to_review_test' : 'review_skip_failed')
      const revResult = await completeMCQTestLazy(page)
      result.reviewTest = revResult
      result.steps.push(`review_done_score_${revResult.score}`)
    } else if (currentStep === 4) {
      const revResult = await completeMCQTestLazy(page)
      result.reviewTest = revResult
      result.steps.push(`review_done_score_${revResult.score}`)
    }

    // ---- CRITICAL: Build presentedWordStates for identity-based F01 check ----
    // Each review word: { wordId, position, preStatus, preReturnAtMs }
    // preStatus/preReturnAtMs from the PRE-session study_state map (passed in as preStudyStateMap)
    if (result.reviewTest && result.reviewTest.presentedWords.length > 0) {
      const pwStates = []
      for (const pw of result.reviewTest.presentedWords) {
        if (!pw.wordId) continue  // Could not resolve wordId from text — skip (log as warning)
        const preSS = preStudyStateMap[pw.wordId]  // undefined = NEVER_TESTED (fine, not a violation)
        const preStatus = preSS?.status ?? undefined
        const preReturnAtMs = getReturnAtMs(preSS)
        pwStates.push({
          wordId: pw.wordId,
          position: pw.position,
          preStatus,
          preReturnAtMs
        })
      }
      result.presentedWordStates = pwStates
    }

    // Handle Step 5 completion
    await page.waitForTimeout(1000)
    const bodyFinal = await page.locator('body').textContent().catch(() => '')
    const finalStep = await getCurrentStep(page)
    if (finalStep === 5 || bodyFinal.includes('Session Summary') || bodyFinal.includes('Back to Dashboard') || bodyFinal.includes('Move On')) {
      result.steps.push('at_completion')
      const moveOnBtn = page.getByRole('button', { name: /move on to next day/i }).first()
      const backBtn = page.getByRole('button', { name: /back to dashboard/i }).first()
      if (await moveOnBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await moveOnBtn.click()
        result.steps.push('moved_to_next_day')
      } else if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await backBtn.click()
        result.steps.push('back_to_dashboard')
      }
      await page.waitForTimeout(2000)
    }

    if (consoleMsgs.length > 0) result.errors.push(...consoleMsgs.slice(0, 5))

  } catch (err) {
    result.blocked = true
    result.blockedReason = err.message
    result.errors.push(err.message)
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
async function runLogoutLoginScenario(browser, sessionDate, csd) {
  const result = {
    ran: true,
    loggedOut: false,
    logoutMethod: null,
    answeredBeforeLogout: 0,
    localStorageKeysBefore: [],
    localStorageKeysAfter: [],
    localStorageKeysAfterLogin: [],
    hasTypedTestState: false,
    hasRecoveryPromptAfterLogin: false,
    verdict: null,
    errors: []
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript((isoDate) => {
    const origNow = Date.now.bind(Date)
    const offset = new Date(isoDate).getTime() - origNow()
    window.__VOCABOOST_TIME_OFFSET__ = 0
    Date.now = () => origNow() + window.__VOCABOOST_TIME_OFFSET__ + offset
  }, sessionDate.toISOString())

  const page = await context.newPage()

  try {
    await loginAndLoadDashboard(page)

    // Start session if possible — go to typed test
    const ss = await startSessionFromDashboard(page)
    if (ss.error) { result.errors.push(ss.error); return result }

    await dismissFlashcardModal(page)
    const skipped = await skipToTestViaMenu(page)

    await page.waitForTimeout(2000)
    const typedInputs = page.locator('input[placeholder="Type your definition..."]')
    const inputCount = await typedInputs.count().catch(() => 0)

    // Answer 2-3 questions
    const toAnswer = Math.min(3, inputCount)
    result.answeredBeforeLogout = toAnswer
    for (let i = 0; i < toAnswer; i++) {
      const answer = lazyAnswer()
      await typedInputs.nth(i).click()
      for (const char of answer) await typedInputs.nth(i).type(char, { delay: 20 })
    }

    // Capture localStorage before logout
    const lsBefore = await page.evaluate(() => {
      const items = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        items[k] = localStorage.getItem(k)
      }
      return items
    }).catch(() => ({}))
    result.localStorageKeysBefore = Object.keys(lsBefore)
    result.hasTypedTestState = Object.keys(lsBefore).some(k =>
      k.toLowerCase().includes('test') || k.toLowerCase().includes('typed') || k.toLowerCase().includes('session')
    )

    // Logout
    const logoutRes = await findAndClickLogout(page)
    result.loggedOut = logoutRes.ok
    result.logoutMethod = logoutRes.method

    await page.waitForTimeout(2000)

    const lsAfterLogout = await page.evaluate(() => {
      const items = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        items[k] = localStorage.getItem(k)
      }
      return items
    }).catch(() => ({}))
    result.localStorageKeysAfter = Object.keys(lsAfterLogout)

    // Log back in
    if (result.loggedOut || page.url().includes('/login')) {
      await loginAndLoadDashboard(page)
      await page.waitForTimeout(2000)

      const bodyAfter = await page.locator('body').textContent().catch(() => '')
      result.hasRecoveryPromptAfterLogin = /recover|resume|continue where|in.progress/i.test(bodyAfter)

      const lsAfterLogin = await page.evaluate(() => {
        const items = {}
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          items[k] = localStorage.getItem(k)
        }
        return items
      }).catch(() => ({}))
      result.localStorageKeysAfterLogin = Object.keys(lsAfterLogin)
    }

    // Verdict
    if (!result.loggedOut) {
      result.verdict = 'INCONCLUSIVE: logout could not be triggered'
    } else if (result.hasRecoveryPromptAfterLogin) {
      result.verdict = 'PASS: recovery prompt shown after re-login'
    } else if (result.hasTypedTestState && !result.hasRecoveryPromptAfterLogin) {
      result.verdict = 'POSSIBLE_LOSS: typed test answers in localStorage before logout but no recovery prompt after login'
    } else {
      result.verdict = 'CLEAN_RESTART: no typed-test in-progress state before logout; clean restart expected'
    }

  } catch (err) {
    result.errors.push(err.message)
    result.verdict = `ERROR: ${err.message}`
  } finally {
    const screenshotPath = join(EVIDENCE_DIR, 'logout_login_end.png')
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {})
    await page.close().catch(() => {})
    await context.close().catch(() => {})
  }

  return result
}

// ---- MAIN ----
async function main() {
  logEvent({ type: 'audit_start', label: LABEL, persona: 'lazy', class: 'TOP', batch: 'B27', rerun: true, startedAt: new Date().toISOString() })
  writeStatus({ label: LABEL, status: 'running', startedAt: new Date().toISOString() })

  // Read initial state
  const initialCP = await readClassProgress()
  const initialCSD = initialCP?.currentStudyDay ?? 9
  const initialTWI = initialCP?.totalWordsIntroduced ?? 240

  console.log(`=== B27 LAZY27B RE-RUN (identity-based F01 check) ===`)
  console.log(`Current CSD: ${initialCSD}, TWI: ${initialTWI}`)
  console.log(`recentSessions: ${JSON.stringify((initialCP?.recentSessions ?? []).slice(-5).map(s => ({ day: s.studyDay, rev: s.reviewScore })))}`)

  // Orphan check at start
  const allCPDocsBefore = await readAllClassProgressDocs()
  console.log(`class_progress docs at start: ${allCPDocsBefore.map(d => d.id).join(', ')}`)
  const orphansBefore = allCPDocsBefore.filter(d => !d.id.includes('_'))
  console.log(`Orphan docs before (classId-only): ${orphansBefore.length} — expected 1 pre-existing`)

  // Starting from day AFTER current CSD
  const startingDay = initialCSD + 1
  console.log(`Starting from Day ${startingDay}`)

  // Date mapping: CSD=9 means we completed days 1-9.
  // Day 1 started June 9, day 5 = June 13 (Fri), day 6 = June 16 (Mon)
  // Day 9 = June 19 (Thu), so Day 10 = June 20 (Fri), Day 11 = June 23 (Mon)
  // Map: day 10 → June 20; day 11 → June 23; day 12 → June 24; etc.
  let currentDate = new Date('2026-06-20T09:00:00+09:00') // Day 10
  // If startingDay > 10, advance
  for (let d = 10; d < startingDay; d++) {
    currentDate = nextStudyDate(currentDate)
  }
  console.log(`First session date: ${currentDate.toISOString()}`)

  const TARGET_SESSIONS = 12  // ~Days 10-21
  const dayTable = []
  const findingsList = []
  let h2Count = 0
  let stopConditionHit = false
  let stopReason = null
  const masteredLeakDays = []

  // Single browser instance
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome'
  })

  let logoutLoginResult = null

  try {
    for (let sessionIdx = 0; sessionIdx < TARGET_SESSIONS; sessionIdx++) {
      const dayNumber = startingDay + sessionIdx

      // Skip weekends
      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate = nextStudyDate(currentDate)
      }

      console.log(`\n=== Day ${dayNumber} | ${currentDate.toISOString().split('T')[0]} ===`)
      logEvent({ type: 'session_start', day: dayNumber, date: currentDate.toISOString() })

      // --- PRE-SESSION READS (READ ONLY) ---
      const preCP = await readClassProgress()
      const preCSD = preCP?.currentStudyDay ?? (dayNumber - 1)
      const preTWI = preCP?.totalWordsIntroduced ?? 240
      const preIL = preCP?.interventionLevel ?? 1.0
      const preRecentSessions = preCP?.recentSessions ?? []

      // Compute effective IL
      const recentRevScoresPre = preRecentSessions.map(s => s.reviewScore).filter(s => s != null)
      const computedIL = expected.calculateInterventionLevel(recentRevScoresPre)

      // Read pre-session study_states — CRITICAL for identity-based F01 check
      const preStudyStates = await readStudyStates()
      const preSSMap = buildSSMap(preStudyStates)  // wordId -> study_state

      const nowMs = currentDate.getTime()

      // Pre-session status histogram
      const preHist = {}
      for (const ss of preStudyStates) {
        const s = ss.status || 'UNKNOWN'
        preHist[s] = (preHist[s] || 0) + 1
      }

      // Expected new range (uses pre-test TWI, interventionLevel)
      const expNewRange = expected.expectedNewWordRange(preTWI, DAILY_PACE, preIL, LIST_SIZE)

      console.log(`Pre: CSD=${preCSD}, TWI=${preTWI}, IL=${preIL}(computed=${computedIL.toFixed(3)})`)
      console.log(`Expected new: ${expNewRange ? `[${expNewRange.startIndex},${expNewRange.endIndex}] count=${expNewRange.count}` : 'null'}`)
      console.log(`Pre study_states: ${JSON.stringify(preHist)}`)
      const preMasteredFuture = preStudyStates.filter(ss => ss.status === 'MASTERED' && getReturnAtMs(ss) > nowMs)
      console.log(`MASTERED with future returnAt (pre): ${preMasteredFuture.length}`)

      // Run session
      const sessionResult = await runOneSession(browser, currentDate, dayNumber, preSSMap, {})
      if (sessionResult.h2StaleHit) h2Count++

      // Wait for Firestore to settle
      await new Promise(r => setTimeout(r, 4000))

      // --- POST-SESSION READS ---
      const postCP = await readClassProgress()
      const postCSD = postCP?.currentStudyDay ?? preCSD
      const postTWI = postCP?.totalWordsIntroduced ?? preTWI
      const postIL = postCP?.interventionLevel ?? preIL
      const postRecentSessions = postCP?.recentSessions ?? []

      const postStudyStates = await readStudyStates()
      const postHist = {}
      for (const ss of postStudyStates) {
        const s = ss.status || 'UNKNOWN'
        postHist[s] = (postHist[s] || 0) + 1
      }

      const masteredWords = postStudyStates.filter(ss => ss.status === 'MASTERED')
      const masteredWithFutureReturnAt = masteredWords.filter(m => getReturnAtMs(m) > nowMs)

      // Post-test TWI for segment calculation (spec requirement)
      const expSegmentPost = expected.calculateSegment(dayNumber, STUDY_DAYS_PER_WEEK, postTWI, DAILY_PACE, postIL)

      // New word check (range-based, pre-test TWI)
      const newPresentedPositions = (sessionResult.newTest?.presentedWords ?? [])
        .map(w => w.position).filter(p => p >= 0)
      const newViolations = expected.checkNewWords({ presentedPositions: newPresentedPositions, expectedRange: expNewRange })

      // ---- IDENTITY-BASED REVIEW CHECK (THE DECISIVE F01 CHECK) ----
      // presentedWordStates: filled by runOneSession using PRE-session study_states
      const presentedWordStates = sessionResult.presentedWordStates || []

      let reviewViolations = []
      let f01MasteredServed = []  // words that are F01 leaks

      if (presentedWordStates.length > 0) {
        reviewViolations = expected.checkReviewWords({ presentedWordStates, segment: expSegmentPost, nowMs })
        // F01: extract actual MASTERED+futureReturnAt violations
        f01MasteredServed = presentedWordStates.filter(pw =>
          pw.preStatus === 'MASTERED' && (pw.preReturnAtMs == null || pw.preReturnAtMs > nowMs)
        )
      } else if (sessionResult.reviewTest && sessionResult.reviewTest.presentedWords.length > 0) {
        // Fallback: wordId resolution failed for some words
        const unresolved = sessionResult.reviewTest.presentedWords.filter(w => !w.wordId)
        if (unresolved.length > 0) {
          reviewViolations.push(`review-warn: ${unresolved.length} served words had unresolvable wordId (screen text not in cache) — F01 check INCONCLUSIVE for those`)
        }
      }

      // Additional diagnostics: count presented words with each preStatus
      const preStatusBreakdown = {}
      for (const pw of presentedWordStates) {
        const s = pw.preStatus ?? 'NEVER_TESTED'
        preStatusBreakdown[s] = (preStatusBreakdown[s] || 0) + 1
      }

      // Verify unresolved words
      const unresolvedWordIds = (sessionResult.reviewTest?.presentedWords ?? []).filter(w => !w.wordId)

      // CSD check
      const csdOk = sessionResult.blocked ? null : (postCSD === dayNumber)
      const csdDrift = (!sessionResult.blocked && !csdOk) ? `expected ${dayNumber} got ${postCSD}` : null

      // Segment eligibility (for informational purposes only — NOT used in F01 verdict)
      let eligibleCount = 0
      let retiredCount = 0
      if (expSegmentPost) {
        // Count segment words: those in range with study_states
        const segStates = postStudyStates.map(ss => ({
          position: ss.wordIndex ?? -1,
          status: ss.status,
          returnAtMs: getReturnAtMs(ss)
        })).filter(ss => ss.position >= (expSegmentPost?.startIndex ?? 0) && ss.position <= (expSegmentPost?.endIndex ?? 0))
        // NEVER_TESTED words (no doc) in segment = segment size - docs in segment range
        const segSize = expSegmentPost.endIndex - expSegmentPost.startIndex + 1
        const docsInSeg = segStates.length
        const neverTestedInSeg = Math.max(0, segSize - docsInSeg)
        const { eligibleIds, retiredIds } = expected.partitionReviewEligibility(segStates, expSegmentPost, nowMs)
        // Eligible = docs marked eligible + never_tested
        eligibleCount = eligibleIds.size + neverTestedInSeg
        retiredCount = retiredIds.size
      }

      // F01 decision
      if (f01MasteredServed.length > 0) {
        masteredLeakDays.push({ day: dayNumber, count: f01MasteredServed.length, words: f01MasteredServed })
        console.log(`F01 ALERT Day ${dayNumber}: ${f01MasteredServed.length} MASTERED words with future returnAt served in review`)
        for (const w of f01MasteredServed) {
          console.log(`  wordId=${w.wordId} pos=${w.position} preStatus=${w.preStatus} returnAt=${new Date(w.preReturnAtMs).toISOString()}`)
        }
        if (masteredLeakDays.length >= 2) {
          stopConditionHit = true
          stopReason = `F01 NOT FIXED: MASTERED-future-returnAt words served in review on days ${masteredLeakDays.map(d => d.day).join(', ')}`
        }
      }

      // Compute next new word count
      const recentRevScoresPost = postRecentSessions.map(s => s.reviewScore).filter(s => s != null)
      const computedILPost = expected.calculateInterventionLevel(recentRevScoresPost)
      const nextNewCount = Math.round(DAILY_PACE * (1 - postIL))

      const dayRow = {
        day: dayNumber,
        date: currentDate.toISOString().split('T')[0],
        preCSD, postCSD, csdOk, csdDrift,
        preTWI, postTWI,
        preIL, postIL,
        computedILPost: computedILPost.toFixed(3),
        expNewRange: expNewRange ? `[${expNewRange.startIndex},${expNewRange.endIndex}](${expNewRange.count})` : 'null',
        newPresentedCount: newPresentedPositions.length,
        newOk: newViolations.length === 0,
        expSegmentPost: expSegmentPost ? `[${expSegmentPost.startIndex},${expSegmentPost.endIndex}]` : 'null',
        eligibleCount,
        retiredCount,
        presentedReviewCount: presentedWordStates.length,
        unresolvedWordIds: unresolvedWordIds.length,
        f01MasteredServedCount: f01MasteredServed.length,
        reviewViolations: reviewViolations.length,
        reviewOk: reviewViolations.length === 0 && f01MasteredServed.length === 0,
        preStatusBreakdown,
        masteredCount: masteredWords.length,
        masteredFutureCount: masteredWithFutureReturnAt.length,
        newTestScore: sessionResult.newTest?.score,
        reviewTestScore: sessionResult.reviewTest?.score,
        nextNewCount,
        steps: sessionResult.steps,
        blocked: sessionResult.blocked,
        blockedReason: sessionResult.blockedReason,
        h2StaleHit: sessionResult.h2StaleHit,
        errors: sessionResult.errors.slice(0, 3)
      }
      dayTable.push(dayRow)

      if (reviewViolations.length > 0 || f01MasteredServed.length > 0 || newViolations.length > 0) {
        findingsList.push({ day: dayNumber, newViolations, reviewViolations, f01MasteredServed })
      }

      const f01Label = f01MasteredServed.length > 0 ? ` F01=LEAK(${f01MasteredServed.length})` : ' F01=clean'
      console.log(`Post: CSD=${postCSD}(ok:${csdOk}), TWI=${postTWI}, IL=${postIL.toFixed(2)}, MASTERED=${masteredWords.length}(fut=${masteredWithFutureReturnAt.length}), reviewed=${presentedWordStates.length}${f01Label}, revScore=${sessionResult.reviewTest?.score}, blocked=${sessionResult.blocked}`)

      // Save per-day evidence JSON
      const evidenceData = {
        dayNumber,
        sessionDate: currentDate.toISOString(),
        persona: 'lazy',
        label: LABEL,
        preCSD, postCSD,
        preTWI, postTWI,
        preIL, postIL,
        expNewRange,
        expSegmentPost,
        eligibleCount,
        retiredCount,
        newTest: {
          presentedWords: sessionResult.newTest?.presentedWords ?? [],
          presentedPositions: newPresentedPositions,
          score: sessionResult.newTest?.score,
          questionCount: sessionResult.newTest?.questionCount ?? 0
        },
        reviewTest: sessionResult.reviewTest ? {
          presentedWords: sessionResult.reviewTest.presentedWords,
          questionCount: sessionResult.reviewTest.questionCount,
          score: sessionResult.reviewTest.score
        } : null,
        // THE DECISIVE DATA
        presentedWordStates,
        preStatusBreakdown,
        f01MasteredServed,
        unresolvedWordCount: unresolvedWordIds.length,
        reviewViolations,
        newViolations,
        statusHistPre: preHist,
        statusHistPost: postHist,
        masteredCount: masteredWords.length,
        masteredFutureCount: masteredWithFutureReturnAt.length,
        masteredSample: masteredWords.slice(0, 3).map(m => ({
          id: m.id, wordId: m.wordId, wordIndex: m.wordIndex, status: m.status,
          returnAtMs: getReturnAtMs(m)
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
        type: 'session_complete', day: dayNumber,
        preCSD, postCSD, preTWI, postTWI, preIL, postIL,
        masteredCount: masteredWords.length, masteredFutureCount: masteredWithFutureReturnAt.length,
        presentedReviewCount: presentedWordStates.length, f01MasteredServedCount: f01MasteredServed.length,
        reviewViolations: reviewViolations.length, newViolations: newViolations.length,
        newScore: sessionResult.newTest?.score, reviewScore: sessionResult.reviewTest?.score,
        blocked: sessionResult.blocked, h2StaleHit: sessionResult.h2StaleHit
      })

      if (stopConditionHit) {
        console.log(`STOP CONDITION: ${stopReason}`)
        logEvent({ type: 'stop_condition_hit', reason: stopReason })
        break
      }

      // Advance date
      currentDate = nextStudyDate(currentDate)
    }

    // ---- LOGOUT/LOGIN SCENARIO (LAST, FRESH CONTEXT per HARNESS FIX 2) ----
    console.log('\n=== Running logout/login scenario in fresh context (LAST) ===')
    const llDate = nextStudyDate(currentDate)
    logoutLoginResult = await runLogoutLoginScenario(browser, llDate, initialCSD)
    console.log(`Logout/login verdict: ${logoutLoginResult.verdict}`)
    logEvent({ type: 'logout_login_complete', ...logoutLoginResult })

    // Save logout/login evidence
    writeFileSync(join(EVIDENCE_DIR, 'logout_login.json'), JSON.stringify(logoutLoginResult, null, 2))

    // ---- Final orphan check ----
    console.log('\n=== Final orphan check ===')
    const finalAllCPDocs = await readAllClassProgressDocs()
    const finalOrphans = finalAllCPDocs.filter(d => !d.id.includes('_'))
    const newOrphansCreated = finalOrphans.filter(d => !orphansBefore.find(x => x.id === d.id))
    console.log(`class_progress docs final: ${finalAllCPDocs.map(d => d.id).join(', ')}`)
    console.log(`Orphan docs final: ${finalOrphans.length} (new: ${newOrphansCreated.length})`)

    const summaryData = {
      label: LABEL,
      persona: 'lazy', class: 'TOP',
      initialCSD, startingDay,
      dayTable,
      findingsList,
      masteredLeakDays,
      logoutLoginResult,
      orphansBefore: orphansBefore.length,
      orphansAfter: finalOrphans.length,
      newOrphansCreated: newOrphansCreated.length,
      h2Count,
      sessionsCompleted: dayTable.filter(d => !d.blocked).length,
      totalSessions: dayTable.length,
      stopConditionHit,
      stopReason,
      finalCPDocs: finalAllCPDocs.map(d => d.id),
      finishedAt: new Date().toISOString()
    }

    writeFileSync(join(EVIDENCE_DIR, 'audit_summary.json'), JSON.stringify(summaryData, null, 2))

    logEvent({
      type: 'audit_complete',
      sessionsCompleted: summaryData.sessionsCompleted,
      totalSessions: summaryData.totalSessions,
      h2Count,
      stopConditionHit,
      masteredLeakDays: masteredLeakDays.map(d => d.day),
      newOrphansCreated: newOrphansCreated.length
    })
    writeStatus({
      label: LABEL, status: 'complete',
      finishedAt: new Date().toISOString(),
      sessionsCompleted: summaryData.sessionsCompleted,
      totalSessions: summaryData.totalSessions,
      stopConditionHit,
      masteredLeakDays: masteredLeakDays.map(d => d.day)
    })

    return summaryData

  } finally {
    await browser.close()
  }
}

const result = await main()

console.log('\n=== LAZY27B COMPLETE ===')
console.log(`Sessions completed: ${result.sessionsCompleted}/${result.totalSessions}`)
console.log(`H2 stale hits: ${result.h2Count}`)
console.log(`New orphan docs created: ${result.newOrphansCreated}`)
console.log(`Stop condition hit: ${result.stopConditionHit}`)
if (result.stopConditionHit) console.log(`Stop reason: ${result.stopReason}`)
console.log(`F01 MASTERED-leak days: ${result.masteredLeakDays.map(d => `Day${d.day}(${d.count}words)`).join(', ') || 'NONE'}`)
console.log(`Logout/login: ${result.logoutLoginResult?.verdict}`)

console.log('\n=== DAY TABLE ===')
for (const row of result.dayTable) {
  const f01 = row.f01MasteredServedCount > 0 ? ` F01=LEAK(${row.f01MasteredServedCount})` : ' F01=0'
  const seg = row.expSegmentPost
  console.log(`  Day ${row.day}(${row.date}): CSD ${row.preCSD}→${row.postCSD}(${row.csdOk}), IL=${row.preIL.toFixed(2)}, seg=${seg}, elig=${row.eligibleCount}+NEVER_TESTED, reviewed=${row.presentedReviewCount}, unresolved=${row.unresolvedWordIds}${f01}, revScore=${row.reviewTestScore}, blocked=${row.blocked}`)
}

console.log('\n=== F01 VERDICT ===')
if (result.masteredLeakDays.length === 0) {
  console.log('F01: RESOLVED — No MASTERED words with future returnAt were served in any review session.')
} else {
  console.log(`F01: NOT FIXED — Leaked on days: ${result.masteredLeakDays.map(d => d.day).join(', ')}`)
  for (const leak of result.masteredLeakDays) {
    console.log(`  Day ${leak.day}: ${leak.count} words:`)
    for (const w of leak.words) {
      console.log(`    wordId=${w.wordId} pos=${w.position} preStatus=${w.preStatus} preReturnAt=${w.preReturnAtMs ? new Date(w.preReturnAtMs).toISOString() : 'null'}`)
    }
  }
}
