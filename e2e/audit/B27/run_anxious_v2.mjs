/**
 * B27 anxious/TOP — v2 (corrected)
 * Agent: A27
 *
 * Key fixes over v1:
 * 1. Detect when the session is already in MCQ phase (Step 4) and complete it
 * 2. Handle "shown day X" < expected: the H2 guard now navigates dashboard + retry instead of blocking
 * 3. Proper MCQ completion via accessible button detection
 * 4. Logout/login scenario with proper MCQ-phase detection
 *
 * HARD RULES: Admin SDK READ-ONLY. No writes. UI-only state progression.
 */

import { chromium } from 'playwright'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

// ---- Config ----
const BASE_URL = 'https://vocaboostone.netlify.app'
const EMAIL = 'audit_anxious_01_top@vocaboost.test'
const PASSWORD = 'AuditPass2026!'
const UID = 'KsZv3zxcUEVTdFbdWKZ8oesDcj33'
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
const LIST_ID = '8RMews2H7C3UJUAsOBzR'
const CP_DOC_ID = `${CLASS_ID}_${LIST_ID}`

const DAILY_PACE = 80
const STUDY_DAYS_PER_WEEK = 5
const LIST_SIZE = 3380
const PASS_THRESHOLD_PCT = 92

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B27/anxious'
const AGENT_LOGS_DIR = '/app/audit/playwright/findings/agent_logs'
const SA_PATH = '/app/scripts/serviceAccountKey.json'
const CHROMIUM_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'

mkdirSync(EVIDENCE_DIR, { recursive: true })
mkdirSync(AGENT_LOGS_DIR, { recursive: true })

// ---- Firebase Admin (READ-ONLY) ----
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

async function readCP() {
  const snap = await initAdmin().doc(`users/${UID}/class_progress/${CP_DOC_ID}`).get()
  return snap.exists ? snap.data() : null
}
async function readAllCP() {
  const snap = await initAdmin().collection(`users/${UID}/class_progress`).get()
  return snap.docs.map(d => ({ id: d.id, data: d.data() }))
}
async function readSS() {
  const snap = await initAdmin().collection(`users/${UID}/study_states`).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
async function readAttempts() {
  const snap = await initAdmin().collection('attempts').where('studentId', '==', UID).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ---- Word cache ----
const WORD_CACHE = JSON.parse(readFileSync('/app/e2e/audit/B27/word_position_cache.json', 'utf-8'))
const WORD_BY_TEXT = {}
const WORD_BY_ID = {}
const WORD_BY_POSITION = {}
for (const w of WORD_CACHE) {
  const norm = w.word.split('\n')[0].trim().toLowerCase()
  WORD_BY_TEXT[norm] = w
  if (w.id) WORD_BY_ID[w.id] = w
  WORD_BY_POSITION[w.position] = w
}
function lookupWord(text) {
  if (!text) return null
  const norm = text.split('\n')[0].trim().toLowerCase()
  if (WORD_BY_TEXT[norm]) return WORD_BY_TEXT[norm]
  const stripped = norm.replace(/\s*\(old english\)/i, '').trim()
  if (WORD_BY_TEXT[stripped]) return WORD_BY_TEXT[stripped]
  // Partial match
  for (const [k, v] of Object.entries(WORD_BY_TEXT)) {
    if (k.startsWith(norm) || norm.startsWith(k)) return v
  }
  return null
}

// ---- expectedWords model ----
const {
  expectedNewWordRange,
  calculateSegment,
  partitionReviewEligibility,
  checkPresentedWords
} = await import('/app/e2e/audit/helpers/expectedWords.js')

// ---- Logging ----
const jsonlPath = join(AGENT_LOGS_DIR, 'A27.jsonl')
function logEvent(ev) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...ev }) + '\n'
  try {
    const cur = existsSync(jsonlPath) ? readFileSync(jsonlPath, 'utf-8') : ''
    writeFileSync(jsonlPath, cur + line)
  } catch (_) {}
}
logEvent({ type: 'agent_v2_start', label: 'A27', persona: 'anxious', class: 'TOP' })

// ---- Typing helper ----
async function typeChars(locator, text, delay = 5) {
  await locator.click()
  await locator.fill('')  // clear first
  for (const ch of text) {
    await locator.type(ch, { delay })
  }
}

// ---- Login ----
async function login(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(2000)

  const url = page.url()
  if (!url.includes('/login')) {
    await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(1000)
  }

  const emailInput = page.getByLabel(/email/i).first()
  if (!await emailInput.isVisible({ timeout: 8000 }).catch(() => false)) {
    // Already logged in, navigate to home
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 20000 })
    return true
  }

  await emailInput.fill(EMAIL)
  await page.getByLabel(/password/i).first().fill(PASSWORD)
  await page.getByLabel(/password/i).first().press('Enter')

  // Wait for dashboard
  try {
    await page.waitForURL(/\/(dashboard|)$/, { timeout: 20000 })
  } catch (_) {
    const btn = page.getByRole('button', { name: /continue|log\s?in/i }).first()
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click()
      await page.waitForURL(/\/(dashboard|)$/, { timeout: 15000 }).catch(() => {})
    }
  }
  await page.waitForTimeout(2000)
  return true
}

// ---- Start session from dashboard ----
async function startSession(page) {
  // Look for "Start Session" button on the class card
  const startBtns = page.getByRole('button', { name: /^Start Session$/i })
  if (await startBtns.count() > 0) {
    await startBtns.first().click()
    await page.waitForTimeout(3000)
    return 'started'
  }
  const continueBtn = page.getByRole('button', { name: /continue session/i }).first()
  if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await continueBtn.click()
    await page.waitForTimeout(3000)
    return 'continued'
  }
  return null
}

// ---- Dismiss any blocking modal ----
async function dismissModal(page) {
  // Wait for and dismiss the "Customize Your Flashcards" modal or any z-50 overlay
  for (let attempt = 0; attempt < 5; attempt++) {
    // Check if any fixed z-50 modal is blocking
    const modalVisible = await page.locator('.fixed.inset-0.z-50, [class*="z-50"]').isVisible({ timeout: 1000 }).catch(() => false)
    if (!modalVisible) break

    // Try "Start Studying" button
    const startBtn = page.getByRole('button', { name: /start studying/i }).first()
    if (await startBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await startBtn.click({ force: true })
      await page.waitForTimeout(800)
      continue
    }

    // Try pressing Escape
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Try any "X" close button inside the modal
    const closeBtn = page.locator('.fixed.inset-0.z-50 button, [class*="z-50"] button').first()
    if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await closeBtn.click({ force: true })
      await page.waitForTimeout(500)
    }
  }
}

// ---- Skip to Test ----
async function skipToTest(page) {
  // Dismiss any modal first
  await dismissModal(page)

  // Try Session menu aria-label
  let menuBtn = page.locator('[aria-label="Session menu"]').first()
  if (!await menuBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    menuBtn = page.getByRole('button', { name: /session menu/i }).first()
  }
  if (!await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) return false

  await menuBtn.click()
  await page.waitForTimeout(600)

  const skipItem = page.getByText('Skip to Test').first()
  if (!await skipItem.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.keyboard.press('Escape')
    return false
  }

  await skipItem.click()
  await page.waitForTimeout(1000)

  const confirmBtn = page.getByRole('button', { name: /start test/i }).first()
  if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await confirmBtn.click()
    await page.waitForTimeout(3000)
  }
  return true
}

// ---- Detect what step we're on ----
async function detectStep(page) {
  const body = await page.locator('body').textContent().catch(() => '')
  const hasTypedInput = await page.locator('input[placeholder="Type your definition..."]').count() > 0

  if (hasTypedInput) return { type: 'typed', body }

  // MCQ review: look for buttons that are answer choices
  // The review test has "Review Test" in the body and option buttons
  if (body.includes('Review Test') || body.includes('review test')) {
    return { type: 'mcq', body }
  }

  if (body.includes('Completed Day') || body.includes('Session Complete') || body.includes('All Done')) {
    return { type: 'complete', body }
  }

  if (body.includes('Step') && body.includes('of 5')) {
    const stepMatch = body.match(/Step (\d+) of 5/)
    if (stepMatch) {
      const step = parseInt(stepMatch[1])
      if (step === 1 || step === 3) return { type: 'flashcard', step, body }
      if (step === 2) return { type: 'typed', body }
      if (step === 4) return { type: 'mcq', body }
      if (step === 5) return { type: 'complete', body }
    }
  }

  return { type: 'unknown', body }
}

// ---- Complete MCQ review test ----
// Returns { presentedWords, questionCount, score }
// MCQ structure: word shown prominently, 4 answer buttons (definitions), Submit Test at end
async function completeMCQ(page) {
  const presented = []
  let answered = 0
  const MAX_Q = 60

  // Dismiss any modal that might be blocking
  await dismissModal(page)
  await page.waitForTimeout(500)

  for (let q = 0; q < MAX_Q; q++) {
    await page.waitForTimeout(300)

    const body = await page.locator('body').textContent().catch(() => '')

    // Check if done (moved off review test)
    if (/completed day \d+|session complete/i.test(body) && !body.includes('Review Test')) break
    if (!body.includes('Review Test') && q > 0) break

    // Check for Submit Test button (all answered)
    const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
    const canSubmit = await submitBtn.isVisible({ timeout: 300 }).catch(() => false)
    if (canSubmit) {
      const isDisabled = await submitBtn.isDisabled().catch(() => true)
      if (!isDisabled) {
        await submitBtn.click()
        await page.waitForTimeout(5000)
        break
      }
    }

    // Get the word being tested
    // MCQ: word is shown in a big text element before the 4 options
    // Use page.evaluate to get both the word and the option layout
    const mcqData = await page.evaluate(() => {
      // Find the MCQ options — they are buttons containing definition text
      // The app renders them as buttons with min-h-[80px] or similar large size
      // Look for buttons in the main content area (not in header/nav)
      const allBtns = Array.from(document.querySelectorAll('button'))

      // Filter to option buttons by looking for buttons with substantial text
      // that don't match common nav button names
      const navPattern = /^(submit test|next|skip|session menu|take|begin|continue|play audio|sign out|log out|start studying)$/i
      const optionBtns = allBtns.filter(btn => {
        const txt = btn.textContent?.trim() || ''
        return txt.length >= 5 && txt.length <= 300 && !navPattern.test(txt)
      })

      // Get the word text from the first visible large text element
      // MCQ word is typically in a p or span with font-bold class
      const wordCandidates = document.querySelectorAll('p.font-bold, span.font-bold, [class*="font-bold"]:not(button)')
      let wordText = ''
      for (const el of wordCandidates) {
        const t = el.textContent?.trim()
        if (t && t.length > 1 && t.length < 60 && !/^(Submit|Next|Skip|Test|Session|Review)/i.test(t)) {
          wordText = t
          break
        }
      }

      return {
        wordText,
        optionTexts: optionBtns.map(b => ({ text: b.textContent?.trim() || '', class: b.className }))
      }
    })

    const cleanWord = mcqData.wordText?.split('(')[0]?.trim() || ''
    const wordEntry = cleanWord ? lookupWord(cleanWord) : null

    if (wordEntry && cleanWord) {
      presented.push({ word: cleanWord, position: wordEntry.position })
    } else if (cleanWord && cleanWord.length > 1) {
      presented.push({ word: cleanWord, position: -1, notFound: true })
    }

    // Find and click the correct option button
    // Try all buttons on page and find option buttons by filtering
    const allPageBtns = page.locator('button')
    const btnCount = await allPageBtns.count()

    let clicked = false
    const navPattern = /^(submit test|next|skip|session menu|start studying|take|begin|continue|play audio|sign out|log out|🔊)$/i

    // First pass: look for the correct definition in button text
    for (let i = 0; i < btnCount && !clicked; i++) {
      const btn = allPageBtns.nth(i)
      const txt = await btn.textContent().catch(() => '')
      const trimmed = txt.trim()
      if (trimmed.length < 5 || trimmed.length > 300 || navPattern.test(trimmed)) continue

      if (wordEntry?.definition_en) {
        const defKey = wordEntry.definition_en.toLowerCase().substring(0, 15)
        if (trimmed.toLowerCase().includes(defKey)) {
          try {
            await btn.click({ timeout: 5000 })
            clicked = true
            logEvent({ type: 'mcq_correct', word: cleanWord, pos: wordEntry?.position, q })
          } catch (_) {}
        }
      }
    }

    // Second pass (fallback): click first valid option button
    if (!clicked) {
      for (let i = 0; i < btnCount && !clicked; i++) {
        const btn = allPageBtns.nth(i)
        const txt = await btn.textContent().catch(() => '')
        const trimmed = txt.trim()
        if (trimmed.length < 5 || trimmed.length > 300 || navPattern.test(trimmed)) continue
        try {
          await btn.click({ timeout: 5000 })
          clicked = true
          logEvent({ type: 'mcq_fallback', word: cleanWord, q, optText: trimmed.substring(0, 30) })
        } catch (_) {}
      }
    }

    if (!clicked) {
      logEvent({ type: 'mcq_no_click', q, word: cleanWord })
      await page.waitForTimeout(300)
    } else {
      answered++
      await page.waitForTimeout(200)

      // Click Next if it appears
      const nextBtn = page.getByRole('button', { name: /^next$/i }).first()
      if (await nextBtn.isVisible({ timeout: 600 }).catch(() => false)) {
        await nextBtn.click().catch(() => {})
        await page.waitForTimeout(200)
      }
    }
  }

  await page.waitForTimeout(3000)

  const finalBody = await page.locator('body').textContent().catch(() => '')
  const sm = finalBody.match(/(\d+)%/)
  const cm = finalBody.match(/(\d+) of (\d+) correct/i)
  let score = null
  if (sm) score = parseInt(sm[1])
  else if (cm) score = Math.round(parseInt(cm[1]) / parseInt(cm[2]) * 100)

  return { presentedWords: presented, questionCount: answered, score }
}

// ---- Complete typed new-word test ----
async function completeTyped(page) {
  const inputs = page.locator('input[placeholder="Type your definition..."]')
  const count = await inputs.count()

  if (count === 0) return { error: 'no inputs', presentedWords: [], questionCount: 0, score: null }

  // Read all word names from the DOM
  const wordNames = await page.evaluate(() => {
    const inps = document.querySelectorAll('input[placeholder="Type your definition..."]')
    return Array.from(inps).map(inp => {
      // Walk up looking for a span with the word text
      let el = inp.parentElement
      let depth = 0
      while (el && depth < 8) {
        // Look for font-medium spans (word name style)
        const candidates = el.querySelectorAll('span.font-medium, [class*="font-medium"]')
        for (const c of candidates) {
          const t = c.textContent.trim()
          if (t && t.length > 1 && t.length < 60 && !/type|your|definition|answer|\d+/i.test(t)) {
            return t
          }
        }
        el = el.parentElement
        depth++
      }
      return ''
    })
  })

  const presented = []

  for (let i = 0; i < count; i++) {
    const word = wordNames[i] || ''
    const entry = lookupWord(word)
    presented.push({ word, position: entry?.position ?? -1 })
    const def = entry?.definition_en || 'a word with a specific meaning'
    await inputs.nth(i).click()
    await inputs.nth(i).fill('')
    for (const ch of def) {
      await inputs.nth(i).type(ch, { delay: 5 })
    }
  }

  const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
  if (!await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    return { error: 'no submit button', presentedWords: presented, questionCount: count, score: null }
  }
  await submitBtn.click()
  logEvent({ type: 'typed_submitted', count })

  // Wait for AI grading (up to 75s)
  for (let t = 0; t < 15; t++) {
    await page.waitForTimeout(5000)
    const body = await page.locator('body').textContent().catch(() => '')
    if (body.match(/\d+%/) || body.includes('Test Results') || body.includes('Completed Day') ||
        body.match(/\d+ of \d+ correct/i) || body.includes('Your Answer')) break
    if (/failed to save|error saving/i.test(body)) {
      const retry = page.getByRole('button', { name: /try again/i }).first()
      if (await retry.isVisible({ timeout: 1000 }).catch(() => false)) {
        await retry.click()
        await page.waitForTimeout(15000)
      }
    }
  }

  const body = await page.locator('body').textContent().catch(() => '')
  const sm = body.match(/(\d+)%/)
  const cm = body.match(/(\d+) of (\d+) correct/i)
  let score = null
  if (sm) score = parseInt(sm[1])
  else if (cm) score = Math.round(parseInt(cm[1]) / parseInt(cm[2]) * 100)

  return { presentedWords: presented, questionCount: count, score }
}

// ---- Advance to next step (navigate forward in session) ----
async function advanceStep(page) {
  const selectors = [
    /take review test|review test/i,
    /continue to review/i,
    /continue/i,
    /next step/i,
    /^next$/i
  ]
  for (const sel of selectors) {
    const btn = page.getByRole('button', { name: sel }).first()
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click()
      await page.waitForTimeout(2000)
      return true
    }
  }
  return false
}

// ---- Logout helper ----
async function doLogout(page) {
  // Try various logout paths
  const allBtns = await page.locator('button').all()
  for (const btn of allBtns) {
    const txt = await btn.textContent().catch(() => '')
    const lbl = await btn.getAttribute('aria-label').catch(() => '')
    if (/sign out|log out|logout/i.test(txt) || /sign out|log out|logout/i.test(lbl)) {
      await btn.click()
      await page.waitForTimeout(2000)
      return true
    }
  }
  // Try clicking user menu then logout
  const avatarBtns = await page.locator('button[aria-label*="menu"], button[aria-label*="account"], button[aria-label*="user"]').all()
  for (const ab of avatarBtns) {
    await ab.click()
    await page.waitForTimeout(500)
    const logoutItem = page.getByText(/sign out|log out/i).first()
    if (await logoutItem.isVisible({ timeout: 1500 }).catch(() => false)) {
      await logoutItem.click()
      await page.waitForTimeout(2000)
      return true
    }
    await page.keyboard.press('Escape')
  }
  // Force navigation to login as fallback
  await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 })
  return false
}

// ---- Main ----
async function main() {
  const initialCP = await readCP()
  const initialCSD = initialCP?.currentStudyDay ?? 1
  const initialTWI = initialCP?.totalWordsIntroduced ?? 0

  console.log(`Initial state: CSD=${initialCSD}, TWI=${initialTWI}`)
  logEvent({ type: 'initial_state', CSD: initialCSD, TWI: initialTWI })

  // Starting session = CSD+1
  const startingDay = initialCSD + 1
  console.log(`Starting at Day ${startingDay}`)

  // Anchor dates — Day 3 = June 2 2026 (Monday after lastStudyDate May 30)
  const ANCHOR_DATE = new Date('2026-06-02T09:00:00+09:00')
  let currentDate = new Date(ANCHOR_DATE)

  const TARGET = 20
  const dayTable = []
  const findingsList = []
  const retakeLog = []
  let h2Count = 0
  let logoutLoginResult = null
  let logoutLoginDone = false

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH
  })

  try {
    for (let idx = 0; idx < TARGET; idx++) {
      const dayNum = startingDay + idx

      // Weekend skip
      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      }

      console.log(`\n=== Day ${dayNum} | ${currentDate.toISOString().split('T')[0]} ===`)
      logEvent({ type: 'day_start', day: dayNum, date: currentDate.toISOString() })

      // Pre-session reads
      const preCP = await readCP()
      const preCSD = preCP?.currentStudyDay ?? (dayNum - 1)
      const preTWI = preCP?.totalWordsIntroduced ?? 0
      const preIL = preCP?.interventionLevel ?? 0
      const preRRS = preCP?.recentReviewScores ?? []

      const preSS = await readSS()
      const preHist = {}
      for (const s of preSS) preHist[s.status] = (preHist[s.status] || 0) + 1
      const preMastered = preHist['MASTERED'] || 0

      // Expected new word range (pre-test TWI)
      const expNew = expectedNewWordRange(preTWI, DAILY_PACE, preIL, LIST_SIZE)
      console.log(`Pre: CSD=${preCSD} TWI=${preTWI} IL=${preIL} MASTERED=${preMastered}`)
      console.log(`Exp new: ${expNew ? `[${expNew.startIndex}-${expNew.endIndex}] (${expNew.count})` : 'null (IL=1, pace*0=0)'}`)

      // Create context
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      await ctx.addInitScript((iso) => {
        const orig = Date.now.bind(Date)
        const off = new Date(iso).getTime() - orig()
        window.__VOC_OFF = 0
        Date.now = () => orig() + window.__VOC_OFF + off
        window.__advanceTime = ms => { window.__VOC_OFF += ms }
      }, currentDate.toISOString())
      await ctx.addInitScript(() => {
        if (navigator?.serviceWorker) {
          navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
        }
      })

      const page = await ctx.newPage()
      const consoleErrs = []
      page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()) })
      page.on('pageerror', e => consoleErrs.push(e.message))

      const session = {
        dayNum, date: currentDate.toISOString(),
        blocked: false, blockedReason: null,
        h2Hit: false,
        newTest: null, reviewTest: null,
        retakeAttempted: false, retakeScore: null,
        violations: [], f01Violations: [],
        errors: [], logoutLoginScenario: null
      }

      try {
        await login(page)
        await page.waitForTimeout(2000)

        // Detect session state
        const step = await detectStep(page)
        console.log(`Dashboard step: ${step.type}`)

        // ---- LOGOUT/LOGIN scenario — run on day 5 (idx=2), before session ----
        if (!logoutLoginDone && idx === 2) {
          logoutLoginDone = true
          console.log(`--- Logout/login scenario on Day ${dayNum} ---`)
          logEvent({ type: 'llo_start', day: dayNum })

          try {
            // Navigate to session
            await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
            await page.waitForTimeout(2000)

            const navd = await startSession(page)
            if (!navd) throw new Error('could not start session for LLO scenario')
            await page.waitForTimeout(2000)
            await dismissModal(page)
            await skipToTest(page)
            await page.waitForTimeout(2000)

            // Detect step
            const lloStep = await detectStep(page)
            console.log(`LLO step: ${lloStep.type}`)

            let answeredPartial = 0
            if (lloStep.type === 'typed') {
              // Type a few partial answers
              const inputs = page.locator('input[placeholder="Type your definition..."]')
              const ic = await inputs.count()
              const typedN = Math.min(3, ic)
              for (let i = 0; i < typedN; i++) {
                await inputs.nth(i).click()
                await inputs.nth(i).fill('partial answer typed by anxious student')
              }
              answeredPartial = typedN
            } else if (lloStep.type === 'mcq') {
              // Already on MCQ — that's fine, note it
              logEvent({ type: 'llo_on_mcq', day: dayNum })
            }

            // Capture localStorage
            const lsBefore = await page.evaluate(() => {
              const r = {}
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i)
                r[k] = localStorage.getItem(k)?.substring(0, 300)
              }
              return r
            })

            // Log out without submitting
            const didLogout = await doLogout(page)
            await page.waitForTimeout(2000)

            const lsAfterLogout = await page.evaluate(() => {
              const r = {}
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i)
                r[k] = localStorage.getItem(k)?.substring(0, 300)
              }
              return r
            })

            // Log back in
            await login(page)
            await page.waitForTimeout(2000)

            const bodyAfterLogin = await page.locator('body').textContent().catch(() => '')
            const hasRecovery = /recover|resume|continue where|in progress/i.test(bodyAfterLogin)
            const lsAfterLogin = await page.evaluate(() => {
              const r = {}
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i)
                if (/answer|session|recovery|test|progress/i.test(k)) {
                  r[k] = localStorage.getItem(k)?.substring(0, 300)
                }
              }
              return r
            })

            logoutLoginResult = {
              day: dayNum,
              sessionPhase: lloStep.type,
              answeredPartial,
              lsKeysBeforeLogout: Object.keys(lsBefore).length,
              lsKeysAfterLogout: Object.keys(lsAfterLogout).length,
              lsKeysAfterLogin: Object.keys(lsAfterLogin),
              recoveryPromptShown: hasRecovery,
              workPreserved: hasRecovery || Object.keys(lsAfterLogin).length > 0,
              severity: (!hasRecovery && answeredPartial > 0) ? 'HIGH' : 'INFO',
              logoutMethod: didLogout ? 'nav button' : 'forced /login navigation'
            }
            session.logoutLoginScenario = logoutLoginResult
            console.log(`LLO result: recovery=${hasRecovery}, lsKeys after login=${Object.keys(lsAfterLogin)}`)
            logEvent({ type: 'llo_complete', ...logoutLoginResult })

          } catch (e) {
            logoutLoginResult = { day: dayNum, error: e.message, workPreserved: null }
            logEvent({ type: 'llo_error', error: e.message })
            // Recover
            await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
            await page.waitForTimeout(2000)
          }
        }

        // ---- Normal session flow ----
        await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForTimeout(2000)

        // Re-check current step after navigation
        const curStep = await detectStep(page)

        // If we're already on Step 4 MCQ (e.g., Day 3 review pending), handle it
        if (curStep.type === 'mcq') {
          console.log(`On MCQ review phase directly (Day ${dayNum} session in progress)`)
          logEvent({ type: 'mcq_in_progress', day: dayNum })

          // Dismiss any modal that may be blocking (flashcard customizer, confirm dialog)
          await dismissModal(page)
          await page.waitForTimeout(500)

          // Read post-typed-test TWI (already updated)
          const postTypedCP = await readCP()
          const postTWI = postTypedCP?.totalWordsIntroduced ?? preTWI
          const postIL = postTypedCP?.interventionLevel ?? preIL

          const seg = calculateSegment(dayNum, STUDY_DAYS_PER_WEEK, postTWI, DAILY_PACE, postIL)
          const nowMs = currentDate.getTime()
          const postSS = await readSS()
          let eligibleIds = new Set(), retiredIds = new Set()
          if (seg) {
            const states = postSS.filter(s => s.wordIndex !== undefined).map(s => ({
              position: s.wordIndex, status: s.status,
              returnAtMs: s.returnAt ? s.returnAt._seconds * 1000 : null
            }))
            const p = partitionReviewEligibility(states, seg, nowMs)
            eligibleIds = p.eligibleIds; retiredIds = p.retiredIds
          }
          console.log(`Review seg: ${seg ? `[${seg.startIndex}-${seg.endIndex}]` : 'null'}, eligible=${eligibleIds.size}, retired=${retiredIds.size}`)

          const rev = await completeMCQ(page)
          session.reviewTest = rev
          logEvent({ type: 'review_done', day: dayNum, score: rev.score, words: rev.questionCount })
          console.log(`Review done: score=${rev.score}%, words=${rev.questionCount}`)

          // F01 check
          const f01 = []
          const revPositions = rev.presentedWords.map(w => w.position).filter(p => p >= 0)
          for (const pos of revPositions) {
            const ss = postSS.find(s => s.wordIndex === pos)
            if (ss && ss.status === 'MASTERED') {
              const retMs = ss.returnAt ? ss.returnAt._seconds * 1000 : null
              if (retMs == null || retMs > nowMs) {
                f01.push({ pos, id: ss.id, returnAtMs: retMs })
              }
            }
          }
          session.f01Violations = f01
          if (f01.length > 0) {
            console.log(`F01: ${f01.length} MASTERED words in review (Day ${dayNum})`)
            logEvent({ type: 'f01_violation', day: dayNum, count: f01.length })
            findingsList.push({ day: dayNum, type: 'F01', f01 })
          }

          // Review word-correctness check
          const revViol = seg ? checkPresentedWords({
            phase: 'review', presentedPositions: revPositions,
            expectedRange: seg, eligibleIds, retiredIds
          }) : []
          session.violations = [...revViol, ...f01.map(f => `F01: MASTERED pos ${f.pos} in review`)]
          session.reviewModel = { seg, eligibleIds: eligibleIds.size, retiredIds: retiredIds.size }

          await page.screenshot({ path: join(EVIDENCE_DIR, `day_${String(dayNum).padStart(2,'0')}_review_done.png`) }).catch(() => {})

        } else if (curStep.type === 'complete') {
          // Stale "Completed Day" — H2 scenario
          console.log(`H2: stale complete screen on Day ${dayNum}`)
          h2Count++
          session.h2Hit = true
          logEvent({ type: 'h2_stale', day: dayNum, h2Count })
          // Navigate and retry
          await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
          await page.waitForTimeout(3000)
          // Fall through to start session normally below
          const retryStep = await detectStep(page)
          if (retryStep.type === 'mcq') {
            // Same as above
            const rev = await completeMCQ(page)
            session.reviewTest = rev
          }
        } else {
          // Normal session: navigate to start
          const navd = await startSession(page)
          if (!navd) {
            // Check if already in a session
            const step2 = await detectStep(page)
            if (step2.type === 'mcq') {
              const rev = await completeMCQ(page)
              session.reviewTest = rev
            } else {
              session.blocked = true
              session.blockedReason = `No session start found; step type: ${step2.type}`
              logEvent({ type: 'session_blocked', day: dayNum, reason: session.blockedReason })
            }
          } else {
            await dismissModal(page)

            // H2 check — verify the day shown
            const bodyAfterStart = await page.locator('body').textContent().catch(() => '')
            const shownDayMatch = bodyAfterStart.match(/Day (\d+)/i)
            if (shownDayMatch) {
              const shownDay = parseInt(shownDayMatch[1])
              if (shownDay < dayNum - 1) {
                h2Count++
                session.h2Hit = true
                logEvent({ type: 'h2_day_mismatch', shown: shownDay, expected: dayNum, h2Count })
                console.log(`H2: shown day ${shownDay} vs expected ${dayNum}`)
              }
            }

            await skipToTest(page)
            await page.waitForTimeout(2000)

            const stepAfterSkip = await detectStep(page)
            console.log(`After skip: ${stepAfterSkip.type}`)

            if (stepAfterSkip.type === 'typed') {
              // Complete new-word test
              session.newTest = await completeTyped(page)
              logEvent({ type: 'new_done', day: dayNum, score: session.newTest.score })
              console.log(`New test: score=${session.newTest.score}%, words=${session.newTest.questionCount}`)

              await page.screenshot({ path: join(EVIDENCE_DIR, `day_${String(dayNum).padStart(2,'0')}_new_done.png`) }).catch(() => {})

              // Anxious: check retake
              if (session.newTest.score !== null && session.newTest.score < PASS_THRESHOLD_PCT) {
                session.retakeAttempted = true
                logEvent({ type: 'retake_check', score: session.newTest.score })
                const retakeBtn = page.getByRole('button', { name: /retake|try again|redo/i }).first()
                if (await retakeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                  await retakeBtn.click()
                  logEvent({ type: 'retake_started', day: dayNum, origScore: session.newTest.score })
                  await page.waitForTimeout(2000)
                  const retakeTyped = await completeTyped(page)
                  session.retakeScore = retakeTyped.score
                  retakeLog.push({
                    day: dayNum,
                    originalScore: session.newTest.score,
                    retakeScore: retakeTyped.score,
                    sameWords: JSON.stringify(retakeTyped.presentedWords.map(w => w.position).sort()) ===
                               JSON.stringify(session.newTest.presentedWords.map(w => w.position).sort())
                  })
                  logEvent({ type: 'retake_done', retakeScore: retakeTyped.score })
                  console.log(`Retake done: ${retakeTyped.score}%`)
                }
              }

              // Now get to review (Day 2+)
              if (dayNum >= 2) {
                await page.waitForTimeout(2000)

                // Check current step
                let stepNow = await detectStep(page)
                console.log(`After new test: step=${stepNow.type}`)

                // Try to get to review
                if (stepNow.type !== 'mcq') {
                  // Navigate forward
                  await advanceStep(page)
                  await page.waitForTimeout(2000)
                  stepNow = await detectStep(page)
                  console.log(`After advance: step=${stepNow.type}`)
                }

                if (stepNow.type === 'mcq') {
                  // Read post-test TWI
                  const postCP2 = await readCP()
                  const postTWI2 = postCP2?.totalWordsIntroduced ?? preTWI
                  const postIL2 = postCP2?.interventionLevel ?? preIL
                  const seg2 = calculateSegment(dayNum, STUDY_DAYS_PER_WEEK, postTWI2, DAILY_PACE, postIL2)
                  const nowMs2 = currentDate.getTime()
                  const postSS2 = await readSS()
                  let eligibleIds2 = new Set(), retiredIds2 = new Set()
                  if (seg2) {
                    const states2 = postSS2.filter(s => s.wordIndex !== undefined).map(s => ({
                      position: s.wordIndex, status: s.status,
                      returnAtMs: s.returnAt ? s.returnAt._seconds * 1000 : null
                    }))
                    const p2 = partitionReviewEligibility(states2, seg2, nowMs2)
                    eligibleIds2 = p2.eligibleIds; retiredIds2 = p2.retiredIds
                  }

                  // Skip to test for review flashcards
                  await skipToTest(page).catch(() => {})
                  await page.waitForTimeout(1000)

                  const rev2 = await completeMCQ(page)
                  session.reviewTest = rev2
                  logEvent({ type: 'review_done', day: dayNum, score: rev2.score })
                  console.log(`Review: score=${rev2.score}%, words=${rev2.questionCount}`)

                  // F01 check
                  const f012 = []
                  const revPos2 = rev2.presentedWords.map(w => w.position).filter(p => p >= 0)
                  for (const pos of revPos2) {
                    const ss2 = postSS2.find(s => s.wordIndex === pos)
                    if (ss2 && ss2.status === 'MASTERED') {
                      const retMs = ss2.returnAt ? ss2.returnAt._seconds * 1000 : null
                      if (retMs == null || retMs > nowMs2) {
                        f012.push({ pos, id: ss2.id, returnAtMs: retMs })
                      }
                    }
                  }
                  session.f01Violations = f012
                  if (f012.length > 0) {
                    console.log(`F01: ${f012.length} MASTERED in review (Day ${dayNum})`)
                    logEvent({ type: 'f01_violation', day: dayNum, count: f012.length })
                    findingsList.push({ day: dayNum, type: 'F01', f012 })
                  }

                  const revViol2 = seg2 ? checkPresentedWords({
                    phase: 'review', presentedPositions: revPos2,
                    expectedRange: seg2, eligibleIds: eligibleIds2, retiredIds: retiredIds2
                  }) : []
                  session.violations = [...revViol2, ...f012.map(f => `F01: MASTERED pos ${f.pos}`)]
                  session.reviewModel = { seg: seg2, eligibleIds: eligibleIds2.size, retiredIds: retiredIds2.size }

                  await page.screenshot({ path: join(EVIDENCE_DIR, `day_${String(dayNum).padStart(2,'0')}_review_done.png`) }).catch(() => {})
                }
              }

              // New-word violations (using pre-test TWI)
              const newPos = (session.newTest?.presentedWords ?? []).map(w => w.position).filter(p => p >= 0)
              const newViol = checkPresentedWords({ phase: 'new', presentedPositions: newPos, expectedRange: expNew })
              if (newViol.length > 0) {
                console.log(`NEW violations Day ${dayNum}:`, newViol)
                session.violations = [...(session.violations || []), ...newViol]
                findingsList.push({ day: dayNum, type: 'NEW_OUT_OF_RANGE', violations: newViol })
              }

            } else if (stepAfterSkip.type === 'mcq') {
              // Landed directly on review (new words already done this day)
              const postCP3 = await readCP()
              const postTWI3 = postCP3?.totalWordsIntroduced ?? preTWI
              const postIL3 = postCP3?.interventionLevel ?? preIL
              const seg3 = calculateSegment(dayNum, STUDY_DAYS_PER_WEEK, postTWI3, DAILY_PACE, postIL3)
              const nowMs3 = currentDate.getTime()
              const postSS3 = await readSS()
              let elig3 = new Set(), ret3 = new Set()
              if (seg3) {
                const states3 = postSS3.filter(s => s.wordIndex !== undefined).map(s => ({
                  position: s.wordIndex, status: s.status,
                  returnAtMs: s.returnAt ? s.returnAt._seconds * 1000 : null
                }))
                const p3 = partitionReviewEligibility(states3, seg3, nowMs3)
                elig3 = p3.eligibleIds; ret3 = p3.retiredIds
              }

              const rev3 = await completeMCQ(page)
              session.reviewTest = rev3
              session.newTest = { presentedWords: [], questionCount: 0, score: null, note: 'already_completed_before_session' }
              logEvent({ type: 'review_only', day: dayNum, score: rev3.score })
              console.log(`Review only: score=${rev3.score}%`)

              const f013 = []
              const revPos3 = rev3.presentedWords.map(w => w.position).filter(p => p >= 0)
              for (const pos of revPos3) {
                const ss3 = postSS3.find(s => s.wordIndex === pos)
                if (ss3 && ss3.status === 'MASTERED') {
                  const retMs = ss3.returnAt ? ss3.returnAt._seconds * 1000 : null
                  if (retMs == null || retMs > nowMs3) f013.push({ pos, id: ss3.id, returnAtMs: retMs })
                }
              }
              session.f01Violations = f013
              if (f013.length > 0) findingsList.push({ day: dayNum, type: 'F01', f013 })
              session.reviewModel = { seg: seg3, eligibleIds: elig3.size, retiredIds: ret3.size }

            } else {
              // Unknown state
              session.blocked = true
              session.blockedReason = `Unexpected step type: ${stepAfterSkip.type}`
              logEvent({ type: 'unexpected_step', day: dayNum, step: stepAfterSkip.type })
            }
          }
        }

        // Read post-session CSD
        await page.waitForTimeout(2000)
        const postCP = await readCP()
        const postCSD = postCP?.currentStudyDay ?? preCSD
        const postTWI = postCP?.totalWordsIntroduced ?? preTWI
        session.postCSD = postCSD
        session.postTWI = postTWI

      } catch (err) {
        console.error(`Day ${dayNum} error:`, err.message)
        session.errors.push(err.message)
        logEvent({ type: 'session_error', day: dayNum, error: err.message })
      } finally {
        await page.close().catch(() => {})
        await ctx.close().catch(() => {})
      }

      // Post-session reads
      await new Promise(r => setTimeout(r, 2000))
      const finalCP = await readCP()
      const finalCSD = finalCP?.currentStudyDay ?? (session.postCSD ?? preCSD)
      const finalTWI = finalCP?.totalWordsIntroduced ?? preTWI

      const finalSS = await readSS()
      const finalHist = {}
      for (const s of finalSS) finalHist[s.status] = (finalHist[s.status] || 0) + 1
      const finalMastered = finalHist['MASTERED'] || 0

      const expectedPostCSD = session.blocked ? preCSD : dayNum
      const csdOk = finalCSD === expectedPostCSD

      console.log(`Post: CSD ${preCSD}→${finalCSD} (exp ${expectedPostCSD} ok=${csdOk}), TWI ${preTWI}→${finalTWI}, MASTERED=${finalMastered}`)

      // Build day row
      const row = {
        day: dayNum,
        date: currentDate.toISOString().split('T')[0],
        preCSD, postCSD: finalCSD, expectedCSD: expectedPostCSD, csdOk,
        preTWI, postTWI: finalTWI,
        expNewRange: expNew ? `${expNew.startIndex}-${expNew.endIndex}` : 'null',
        expNewCount: expNew?.count ?? 0,
        newTestScore: session.newTest?.score ?? null,
        presentedNewCount: (session.newTest?.presentedWords ?? []).filter(w => w.position >= 0).length,
        retakeAttempted: session.retakeAttempted,
        retakeScore: session.retakeScore,
        expSegment: session.reviewModel?.seg ? `${session.reviewModel.seg.startIndex}-${session.reviewModel.seg.endIndex}` : 'null',
        eligibleCount: session.reviewModel?.eligibleIds ?? 0,
        retiredCount: session.reviewModel?.retiredIds ?? 0,
        reviewTestScore: session.reviewTest?.score ?? null,
        presentedReviewCount: (session.reviewTest?.presentedWords ?? []).filter(w => w.position >= 0).length,
        f01Violations: (session.f01Violations ?? []).length,
        preMastered, postMastered: finalMastered,
        violations: session.violations ?? [],
        blocked: session.blocked, blockedReason: session.blockedReason,
        h2Hit: session.h2Hit, errors: session.errors
      }

      dayTable.push(row)

      // Evidence
      const evidence = {
        dayNum, date: currentDate.toISOString(),
        preCSD, postCSD: finalCSD, preTWI, postTWI: finalTWI,
        csdOk, csdDrift: csdOk ? null : `exp ${expectedPostCSD} got ${finalCSD}`,
        expectedNewRange: expNew,
        newTest: session.newTest,
        reviewTest: session.reviewTest,
        retakeAttempted: session.retakeAttempted,
        retakeScore: session.retakeScore,
        f01Violations: session.f01Violations ?? [],
        reviewModel: session.reviewModel,
        violations: session.violations,
        statusHistPre: preHist, statusHistPost: finalHist,
        preMastered, postMastered: finalMastered,
        blocked: session.blocked, blockedReason: session.blockedReason,
        h2Hit: session.h2Hit, h2Count,
        logoutLoginScenario: session.logoutLoginScenario,
        errors: session.errors,
        consoleErrors: consoleErrs.slice(0, 5),
        capturedAt: new Date().toISOString()
      }
      writeFileSync(join(EVIDENCE_DIR, `day_${String(dayNum).padStart(2,'0')}.json`), JSON.stringify(evidence, null, 2))
      console.log(`Evidence: day_${String(dayNum).padStart(2,'0')}.json`)

      logEvent({
        type: 'session_complete', day: dayNum, postCSD: finalCSD, csdOk,
        f01: (session.f01Violations ?? []).length, mastered: finalMastered,
        blocked: session.blocked, h2Hit: session.h2Hit
      })

      currentDate = nextStudyDay(currentDate)
    }

    // ---- Final self-check ----
    const finalAllCP = await readAllCP()
    const finalAttempts = await readAttempts()
    const orphanDocs = finalAllCP.filter(d => !d.id.includes('_'))
    const wrongFormatAttempts = finalAttempts.filter(a => !a.id.includes(CLASS_ID) || !a.id.includes(LIST_ID))

    console.log('\n=== FINAL SELF-CHECK ===')
    console.log(`All CP docs: ${finalAllCP.map(d => d.id).join(', ')}`)
    console.log(`Orphan docs: ${orphanDocs.length}`)
    console.log(`Wrong format attempts: ${wrongFormatAttempts.length}`)
    console.log(`Total attempts: ${finalAttempts.length}`)
    logEvent({
      type: 'audit_complete', sessions: dayTable.length,
      completed: dayTable.filter(d => !d.blocked).length,
      h2Count, orphanDocs: orphanDocs.length,
      wrongFormatAttempts: wrongFormatAttempts.length,
      f01Days: findingsList.filter(f => f.type === 'F01').length,
      retakes: retakeLog.length
    })

    return { dayTable, findingsList, retakeLog, logoutLoginResult, h2Count, initialCSD, startingDay,
             orphanDocs: orphanDocs.length, wrongFormatAttempts: wrongFormatAttempts.length,
             totalAttempts: finalAttempts.length }

  } finally {
    await browser.close()
    console.log('Browser closed.')
  }
}

// Helper
function nextStudyDay(d) {
  const n = new Date(d.getTime() + 86400000)
  while (n.getDay() === 0 || n.getDay() === 6) n.setDate(n.getDate() + 1)
  return n
}

// ---- Run ----
console.log('B27 anxious/TOP audit v2 starting (A27)...')
const result = await main()

console.log('\n=== AUDIT COMPLETE ===')
console.log(`Sessions: ${result.dayTable.length} | Completed: ${result.dayTable.filter(d => !d.blocked).length}`)
console.log(`Day range: ${result.startingDay} → ${result.startingDay + result.dayTable.length - 1}`)
console.log(`H2 hits: ${result.h2Count}`)
console.log(`F01 violation days: ${result.findingsList.filter(f => f.type === 'F01').length}`)
console.log(`Retake events: ${result.retakeLog.length}`)
console.log(`Orphan docs: ${result.orphanDocs}`)
console.log(`Total attempts: ${result.totalAttempts}`)
console.log('')
console.log('Day table:')
for (const r of result.dayTable) {
  const flags = [
    r.blocked ? 'BLOCKED' : '',
    r.h2Hit ? 'H2' : '',
    r.f01Violations > 0 ? `F01(${r.f01Violations})` : '',
    r.retakeAttempted ? `RETAKE(${r.retakeScore}%)` : '',
    (r.violations?.length ?? 0) > 0 ? `VIOL(${r.violations.length})` : '',
  ].filter(Boolean).join(' ')
  console.log(`  D${String(r.day).padStart(2,'0')}: CSD${r.preCSD}→${r.postCSD}(ok=${r.csdOk}) | ` +
    `NEW[${r.expNewRange}] got=${r.presentedNewCount} score=${r.newTestScore}% | ` +
    `SEG[${r.expSegment}] elig=${r.eligibleCount} ret=${r.retiredCount} rev=${r.presentedReviewCount} score=${r.reviewTestScore}% | ` +
    `MAST ${r.preMastered}→${r.postMastered} ${flags}`)
}
