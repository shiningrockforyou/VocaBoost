/**
 * Fix: Complete Day 5 MCQ review test and walk forward from Day 5
 * Uses correct MCQ button selectors: button.min-h-[80px] (from debug analysis)
 * Agent: A27
 */
import { chromium } from 'playwright'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

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

// Firebase Admin READ-ONLY
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
  const s = await initAdmin().doc(`users/${UID}/class_progress/${CP_DOC_ID}`).get()
  return s.exists ? s.data() : null
}
async function readAllCP() {
  const s = await initAdmin().collection(`users/${UID}/class_progress`).get()
  return s.docs.map(d => ({ id: d.id, data: d.data() }))
}
async function readSS() {
  const s = await initAdmin().collection(`users/${UID}/study_states`).get()
  return s.docs.map(d => ({ id: d.id, ...d.data() }))
}
async function readAttempts() {
  const s = await initAdmin().collection('attempts').where('studentId', '==', UID).get()
  return s.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Word cache
const WORD_CACHE = JSON.parse(readFileSync('/app/e2e/audit/B27/word_position_cache.json', 'utf-8'))
const BY_TEXT = {}
const BY_POS = {}
for (const w of WORD_CACHE) {
  const n = w.word.split('\n')[0].trim().toLowerCase()
  BY_TEXT[n] = w
  BY_POS[w.position] = w
}
function lu(text) {
  if (!text) return null
  const n = text.split('\n')[0].trim().toLowerCase()
  if (BY_TEXT[n]) return BY_TEXT[n]
  const s = n.replace(/\s*\(old english\)/i, '').trim()
  if (BY_TEXT[s]) return BY_TEXT[s]
  for (const [k, v] of Object.entries(BY_TEXT)) {
    if (k.startsWith(n) || n.startsWith(k)) return v
  }
  return null
}

// Expected words model
const { expectedNewWordRange, calculateSegment, partitionReviewEligibility, checkPresentedWords } =
  await import('/app/e2e/audit/helpers/expectedWords.js')

// Logging
const jsonlPath = join(AGENT_LOGS_DIR, 'A27.jsonl')
function logE(ev) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...ev }) + '\n'
  try { writeFileSync(jsonlPath, (existsSync(jsonlPath) ? readFileSync(jsonlPath, 'utf-8') : '') + line) } catch (_) {}
}
logE({ type: 'fix_start', label: 'A27', persona: 'anxious' })

// Login helper
async function login(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(2000)
  let emailInput = page.getByLabel(/email/i).first()
  let ev = await emailInput.isVisible({ timeout: 5000 }).catch(() => false)
  if (!ev) {
    const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
    if (await loginLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginLink.click()
      await page.waitForTimeout(2000)
      emailInput = page.getByLabel(/email/i).first()
      ev = await emailInput.isVisible({ timeout: 5000 }).catch(() => false)
    }
  }
  if (ev) {
    await emailInput.fill(EMAIL)
    await page.getByLabel(/password/i).first().fill(PASSWORD)
    await page.getByLabel(/password/i).first().press('Enter')
    await page.waitForURL(/\/(dashboard|)$/, { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(2000)
    return true
  }
  return false
}

// Start session
async function startSession(page) {
  // Reload dashboard
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)
  const btns = page.getByRole('button', { name: /^Start Session$/i })
  if (await btns.count() > 0) {
    await btns.first().click()
    await page.waitForTimeout(3000)
    return 'started'
  }
  return null
}

// Skip flashcards to get to test
async function skipToTestFromFlashcards(page) {
  // If on Step 1 or Step 3 (flashcards), use Session menu → Skip to Test
  const menuBtn = page.locator('[aria-label="Session menu"]').first()
  if (!await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) return false
  await menuBtn.click()
  await page.waitForTimeout(500)
  const skipItem = page.getByText('Skip to Test').first()
  if (!await skipItem.isVisible({ timeout: 2000 }).catch(() => false)) {
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

// Complete MCQ review test using the correct selector: button.min-h-\[80px\]
// Returns { presentedWords, questionCount, score }
async function completeMCQTest(page) {
  const presented = []
  let answered = 0

  console.log('Starting MCQ completion...')

  for (let q = 0; q < 60; q++) {
    await page.waitForTimeout(300)

    const body = await page.locator('body').textContent().catch(() => '')

    // Check if we left review test
    if (!body.includes('Review Test') && q > 0) {
      console.log(`MCQ: left review at q=${q}`)
      break
    }

    // Get the word being tested — it's shown before the 4 option buttons
    // The word display area contains the word, POS, and audio button
    const wordText = await page.evaluate(() => {
      // The word is in the body of the question before the options
      // Look for element with font-bold or similar that's not inside a button
      const allElements = document.querySelectorAll('p, span, h1, h2, h3, h4, div')
      for (const el of allElements) {
        if (el.querySelector('button')) continue // skip containers with buttons
        const text = el.textContent?.trim()
        if (text && text.length > 1 && text.length < 60 &&
            !/^(step|progress|submit|review|day|quiz|test|play audio|🔊)/i.test(text) &&
            !/^\d/.test(text)) {
          // Check if this element contains only text (no child elements with significant content)
          const children = el.childElementCount
          if (children <= 2) return text
        }
      }
      return ''
    })

    const cleanWord = wordText.split('(')[0].trim()
    const wordEntry = cleanWord ? lu(cleanWord) : null
    if (wordEntry && cleanWord.length > 1) {
      presented.push({ word: cleanWord, position: wordEntry.position })
    } else if (cleanWord && cleanWord.length > 1 && cleanWord.length < 50) {
      presented.push({ word: cleanWord, position: -1, notFound: true })
    }

    // Find MCQ option buttons using the correct selector
    const optionBtns = page.locator('button.min-h-\\[80px\\], button[class*="min-h-\\[80px\\]"]')
    let optCount = await optionBtns.count()

    if (optCount === 0) {
      // Try rounded-2xl buttons
      const roundedBtns = page.locator('button[class*="rounded-2xl"]')
      optCount = await roundedBtns.count()
      if (optCount > 0) {
        // Check submit button
        const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
        const canSubmit = await submitBtn.isVisible({ timeout: 300 }).catch(() => false)
        if (canSubmit) {
          const isDisabled = await submitBtn.isDisabled().catch(() => true)
          // Only submit if questions answered
          if (!isDisabled && answered >= 25) {
            await submitBtn.click()
            await page.waitForTimeout(5000)
            break
          }
        }
        await page.waitForTimeout(300)
        continue
      }
      // No options — check if Submit Test button available with enough answered
      const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await submitBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        const isDisabled = await submitBtn.isDisabled().catch(() => true)
        if (!isDisabled && answered >= 25) {
          await submitBtn.click()
          await page.waitForTimeout(5000)
          break
        }
      }
      await page.waitForTimeout(300)
      continue
    }

    console.log(`MCQ q=${q+1} word="${cleanWord}" options=${optCount}`)

    // Click the correct option (canonical definition match)
    let clicked = false
    if (wordEntry?.definition_en) {
      const defKey = wordEntry.definition_en.toLowerCase().substring(0, 20)
      for (let i = 0; i < optCount; i++) {
        const btn = optionBtns.nth(i)
        const txt = await btn.textContent().catch(() => '')
        if (txt.toLowerCase().includes(defKey)) {
          await btn.click()
          clicked = true
          console.log(`  Clicked correct option: "${txt.substring(0, 40)}"`)
          logE({ type: 'mcq_correct', word: cleanWord, pos: wordEntry.position })
          break
        }
      }
    }
    if (!clicked) {
      // Fallback: click first option
      await optionBtns.first().click()
      clicked = true
      const fallbackTxt = await optionBtns.first().textContent().catch(() => '')
      console.log(`  Fallback click: "${fallbackTxt.substring(0, 40)}"`)
      logE({ type: 'mcq_fallback', word: cleanWord })
    }

    answered++
    await page.waitForTimeout(300)

    // After clicking an option, the MCQ may auto-advance OR show a Next button
    // Try the "Next question" navigation arrow (short timeout)
    const nextBtn = page.locator('[aria-label="Next question"]').first()
    const nextVisible = await nextBtn.isVisible({ timeout: 1000 }).catch(() => false)
    if (nextVisible) {
      const nextDisabled = await nextBtn.isDisabled().catch(() => true)
      if (!nextDisabled) {
        await nextBtn.click().catch(() => {})
        await page.waitForTimeout(300)
      }
    }
    // Also try a regular "Next" button text
    const nextTextBtn = page.getByRole('button', { name: /^Next$/i }).first()
    const nextTextVisible = await nextTextBtn.isVisible({ timeout: 500 }).catch(() => false)
    if (nextTextVisible) {
      await nextTextBtn.click().catch(() => {})
      await page.waitForTimeout(300)
    }

    // Check Submit Test (when all answered)
    const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
    if (await submitBtn.isVisible({ timeout: 300 }).catch(() => false)) {
      const submitTxt = await submitBtn.textContent().catch(() => '')
      // The text shows "Submit Test (X/30 answered)" — submit if all answered
      const matchAnswered = submitTxt.match(/\((\d+)\/(\d+)\s*answered\)/)
      if (matchAnswered && matchAnswered[1] === matchAnswered[2]) {
        const isDisabled = await submitBtn.isDisabled().catch(() => true)
        if (!isDisabled) {
          await submitBtn.click()
          console.log(`Submitted: all ${matchAnswered[1]}/${matchAnswered[2]} answered`)
          await page.waitForTimeout(5000)
          break
        }
      }
      // Also: if answered >= expected count
      if (answered >= 30) {
        const isDisabled = await submitBtn.isDisabled().catch(() => true)
        if (!isDisabled) {
          await submitBtn.click()
          console.log(`Submitted after 30+ answers`)
          await page.waitForTimeout(5000)
          break
        }
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
  console.log(`MCQ done: answered=${answered}, score=${score}%`)
  return { presentedWords: presented, questionCount: answered, score }
}

// Complete typed new-word test
async function completeTypedTest(page) {
  const inputs = page.locator('input[placeholder="Type your definition..."]')
  const count = await inputs.count()
  if (count === 0) return { error: 'no inputs', presentedWords: [], questionCount: 0, score: null }

  const wordNames = await page.evaluate(() => {
    const inps = document.querySelectorAll('input[placeholder="Type your definition..."]')
    return Array.from(inps).map(inp => {
      let el = inp.parentElement
      let depth = 0
      while (el && depth < 8) {
        const spans = el.querySelectorAll('span.font-medium, [class*="font-medium"]')
        for (const s of spans) {
          const t = s.textContent?.trim()
          if (t && t.length > 1 && t.length < 60 && !/type|definition|answer|\d+/i.test(t)) return t
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
    const entry = lu(word)
    presented.push({ word, position: entry?.position ?? -1 })
    const def = entry?.definition_en || 'a word with a specific meaning'
    await inputs.nth(i).click()
    await inputs.nth(i).fill('')
    for (const ch of def) await inputs.nth(i).type(ch, { delay: 5 })
  }

  const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
  if (!await submitBtn.isVisible({ timeout: 5000 }).catch(() => false))
    return { error: 'no submit btn', presentedWords: presented, questionCount: count, score: null }
  await submitBtn.click()
  logE({ type: 'typed_submitted', count })

  // Wait for AI grading
  for (let t = 0; t < 15; t++) {
    await page.waitForTimeout(5000)
    const body = await page.locator('body').textContent().catch(() => '')
    if (body.match(/\d+%/) || body.includes('Test Results') || body.includes('Completed Day') ||
        body.match(/\d+ of \d+ correct/i)) break
    if (/failed to save/i.test(body)) {
      const retry = page.getByRole('button', { name: /try again/i }).first()
      if (await retry.isVisible({ timeout: 1000 }).catch(() => false)) { await retry.click(); await page.waitForTimeout(15000) }
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

function nextStudyDay(d) {
  const n = new Date(d.getTime() + 86400000)
  while (n.getDay() === 0 || n.getDay() === 6) n.setDate(n.getDate() + 1)
  return n
}

async function detectStep(page) {
  const body = await page.locator('body').textContent().catch(() => '')
  const hasTyped = await page.locator('input[placeholder="Type your definition..."]').count() > 0
  if (hasTyped) return { type: 'typed', body }
  if (/review test/i.test(body)) return { type: 'mcq', body }
  if (/completed day|session complete/i.test(body)) return { type: 'complete', body }
  const sm = body.match(/Step (\d+) of 5/i)
  if (sm) {
    const s = parseInt(sm[1])
    if (s === 2) return { type: 'typed', body }
    if (s === 4) return { type: 'mcq', body }
    if (s === 5) return { type: 'complete', body }
    return { type: 'flashcard', step: s, body }
  }
  return { type: 'unknown', body }
}

async function main() {
  // Determine current state
  let cp = await readCP()
  let currentCSD = cp?.currentStudyDay ?? 4
  let currentTWI = cp?.totalWordsIntroduced ?? 270

  console.log(`Starting state: CSD=${currentCSD}, TWI=${currentTWI}`)
  logE({ type: 'fix_initial', CSD: currentCSD, TWI: currentTWI })

  // We start at Day 5 (CSD=4 means Day 5 is next, anchored to June 2)
  const START_DAY = currentCSD + 1
  const ANCHOR = new Date('2026-06-02T09:00:00+09:00')
  let currentDate = new Date(ANCHOR)

  const TARGET = 20
  const dayTable = []
  const findingsList = []
  const retakeLog = []
  let h2Count = 0
  let logoutLoginResult = null
  let logoutLoginDone = false

  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH })

  try {
    for (let idx = 0; idx < TARGET; idx++) {
      const dayNum = START_DAY + idx

      // Skip weekends
      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate = new Date(currentDate.getTime() + 86400000)
      }

      console.log(`\n=== Day ${dayNum} | ${currentDate.toISOString().split('T')[0]} ===`)
      logE({ type: 'day_start', day: dayNum, date: currentDate.toISOString() })

      // Pre-reads
      cp = await readCP()
      const preCSD = cp?.currentStudyDay ?? (dayNum - 1)
      const preTWI = cp?.totalWordsIntroduced ?? 0
      const preIL = cp?.interventionLevel ?? 0
      const preSS = await readSS()
      const preHist = {}
      for (const s of preSS) preHist[s.status] = (preHist[s.status] || 0) + 1
      const preMastered = preHist['MASTERED'] || 0

      const expNew = expectedNewWordRange(preTWI, DAILY_PACE, preIL, LIST_SIZE)
      console.log(`Pre: CSD=${preCSD} TWI=${preTWI} IL=${preIL.toFixed(2)} MASTERED=${preMastered}`)
      console.log(`ExpNew: ${expNew ? `[${expNew.startIndex}-${expNew.endIndex}] (${expNew.count})` : 'null (IL=1)'}`)

      // Create context with Date.now shim
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      await ctx.addInitScript((iso) => {
        const orig = Date.now.bind(Date)
        const off = new Date(iso).getTime() - orig()
        window.__VO = 0
        Date.now = () => orig() + window.__VO + off
        window.__advanceTime = ms => { window.__VO += ms }
      }, currentDate.toISOString())
      await ctx.addInitScript(() => {
        if (navigator?.serviceWorker) {
          navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
        }
      })

      const page = await ctx.newPage()
      const consoleErrs = []
      page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text().substring(0, 100)) })

      const session = {
        dayNum, blocked: false, blockedReason: null,
        newTest: null, reviewTest: null,
        retakeAttempted: false, retakeScore: null,
        h2Hit: false, violations: [], f01Violations: [],
        errors: [], logoutLoginScenario: null
      }

      try {
        await login(page)
        await page.waitForTimeout(2000)

        // ---- LOGOUT/LOGIN scenario (Day 7 = idx 2) ----
        if (!logoutLoginDone && idx === 2) {
          logoutLoginDone = true
          logE({ type: 'llo_start', day: dayNum })
          console.log(`--- Logout/login scenario on Day ${dayNum} ---`)

          try {
            // Navigate to session
            const navd = await startSession(page)
            await page.waitForTimeout(2000)

            // Check step
            let lloStep = await detectStep(page)

            // If on flashcards, skip to test
            if (lloStep.type === 'flashcard') {
              await skipToTestFromFlashcards(page)
              await page.waitForTimeout(2000)
              lloStep = await detectStep(page)
            }

            console.log(`LLO step: ${lloStep.type}`)
            let answeredPartial = 0

            if (lloStep.type === 'typed') {
              const inputs = page.locator('input[placeholder="Type your definition..."]')
              const ic = await inputs.count()
              const typedN = Math.min(3, ic)
              for (let i = 0; i < typedN; i++) {
                await inputs.nth(i).click()
                await inputs.nth(i).fill('anxious partial answer')
              }
              answeredPartial = typedN
            }

            // Capture localStorage before logout
            const lsBefore = await page.evaluate(() => {
              const r = {}
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i)
                r[k] = localStorage.getItem(k)?.substring(0, 200)
              }
              return r
            })

            // Logout: look for logout button
            let didLogout = false
            const allBtns = await page.locator('button').all()
            for (const btn of allBtns) {
              const txt = await btn.textContent().catch(() => '')
              const lbl = await btn.getAttribute('aria-label').catch(() => '')
              if (/sign out|log out|logout/i.test(txt) || /sign out|log out|logout/i.test(lbl)) {
                await btn.click()
                await page.waitForTimeout(2000)
                didLogout = true
                break
              }
            }
            if (!didLogout) {
              // Try user menu
              const avatarBtns = page.locator('button[aria-label*="menu"], button[aria-label*="user"], button[aria-label*="account"]')
              const abc = await avatarBtns.count()
              for (let i = 0; i < abc && !didLogout; i++) {
                await avatarBtns.nth(i).click()
                await page.waitForTimeout(500)
                const logoutItem = page.getByText(/sign out|log out/i).first()
                if (await logoutItem.isVisible({ timeout: 1500 }).catch(() => false)) {
                  await logoutItem.click()
                  await page.waitForTimeout(2000)
                  didLogout = true
                }
                await page.keyboard.press('Escape')
              }
            }

            const lsAfterLogout = await page.evaluate(() => {
              const r = {}
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i)
                r[k] = localStorage.getItem(k)?.substring(0, 200)
              }
              return r
            })

            // Re-login
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
              phase: lloStep.type,
              answeredPartial,
              lsKeysBefore: Object.keys(lsBefore).length,
              lsKeysAfterLogout: Object.keys(lsAfterLogout).length,
              lsRecoveryKeys: Object.keys(lsAfterLogin),
              recoveryPromptShown: hasRecovery,
              workPreserved: Object.keys(lsAfterLogin).length > 0 || hasRecovery,
              severity: (!hasRecovery && answeredPartial > 0) ? 'HIGH' : 'LOW',
              didLogout
            }
            session.logoutLoginScenario = logoutLoginResult
            console.log(`LLO: recovery=${hasRecovery}, lsAfterLogin=${JSON.stringify(Object.keys(lsAfterLogin))}`)
            logE({ type: 'llo_complete', ...logoutLoginResult })

          } catch (lloErr) {
            logoutLoginResult = { day: dayNum, error: lloErr.message, workPreserved: null }
            logE({ type: 'llo_error', error: lloErr.message })
          }

          // Back to dashboard
          await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
          await page.waitForTimeout(2000)
        }

        // ---- Normal session ----
        // Check current step from dashboard
        const dashBody = await page.locator('body').textContent().catch(() => '')
        const currentStep = await detectStep(page)

        if (currentStep.type === 'mcq') {
          // Already on review test — complete it
          console.log('On MCQ review from dashboard')
          const postCP2 = await readCP()
          const postTWI2 = postCP2?.totalWordsIntroduced ?? preTWI
          const postIL2 = postCP2?.interventionLevel ?? preIL
          const seg2 = calculateSegment(dayNum, STUDY_DAYS_PER_WEEK, postTWI2, DAILY_PACE, postIL2)
          const nowMs = currentDate.getTime()
          const postSS2 = await readSS()
          let elig = new Set(), ret = new Set()
          if (seg2) {
            const states = postSS2.filter(s => s.wordIndex != null).map(s => ({
              position: s.wordIndex, status: s.status,
              returnAtMs: s.returnAt ? s.returnAt._seconds * 1000 : null
            }))
            const p = partitionReviewEligibility(states, seg2, nowMs)
            elig = p.eligibleIds; ret = p.retiredIds
          }
          console.log(`Seg: ${seg2 ? `[${seg2.startIndex}-${seg2.endIndex}]` : 'null'}, elig=${elig.size}, ret=${ret.size}`)

          const rev = await completeMCQTest(page)
          session.reviewTest = rev
          session.newTest = { presentedWords: [], questionCount: 0, score: null, note: 'typed_already_done' }
          logE({ type: 'review_only', day: dayNum, score: rev.score })
          console.log(`Review: score=${rev.score}%, answered=${rev.questionCount}`)

          // F01 check
          const f01 = []
          const revPos = rev.presentedWords.map(w => w.position).filter(p => p >= 0)
          for (const pos of revPos) {
            const ss = postSS2.find(s => s.wordIndex === pos)
            if (ss?.status === 'MASTERED') {
              const retMs = ss.returnAt ? ss.returnAt._seconds * 1000 : null
              if (retMs == null || retMs > nowMs) f01.push({ pos, id: ss.id, returnAtMs: retMs })
            }
          }
          session.f01Violations = f01
          if (f01.length > 0) { findingsList.push({ day: dayNum, type: 'F01', f01 }); logE({ type: 'f01', day: dayNum, count: f01.length }) }
          const revViol = seg2 ? checkPresentedWords({ phase: 'review', presentedPositions: revPos, expectedRange: seg2, eligibleIds: elig, retiredIds: ret }) : []
          session.violations = [...revViol, ...f01.map(f => `F01: MASTERED pos ${f.pos}`)]
          session.reviewModel = { seg: seg2, eligibleIds: elig.size, retiredIds: ret.size, postTWI: postTWI2 }

        } else {
          // Start a new session
          const navd = await startSession(page)
          await page.waitForTimeout(2000)

          // After start, check step
          let step = await detectStep(page)
          console.log(`After start: step=${step.type} (${step.step || ''})`)

          // H2 check
          const dayMatch = step.body.match(/Day (\d+)/i)
          if (dayMatch && parseInt(dayMatch[1]) < dayNum - 1) {
            h2Count++
            session.h2Hit = true
            logE({ type: 'h2', day: dayNum, shown: parseInt(dayMatch[1]), h2Count })
            console.log(`H2: shown day ${dayMatch[1]} vs expected ${dayNum}`)
          }

          // If on flashcards (Step 1 or 3), skip to test
          if (step.type === 'flashcard' || step.type === 'unknown') {
            await skipToTestFromFlashcards(page)
            await page.waitForTimeout(2000)
            step = await detectStep(page)
            console.log(`After skip: step=${step.type}`)
          }

          if (step.type === 'typed') {
            // Complete new-word typed test
            const newResult = await completeTypedTest(page)
            session.newTest = newResult
            logE({ type: 'new_done', day: dayNum, score: newResult.score, words: newResult.questionCount })
            console.log(`New test: score=${newResult.score}%, words=${newResult.questionCount}`)

            await page.screenshot({ path: join(EVIDENCE_DIR, `day_${String(dayNum).padStart(2,'0')}_new_done.png`) }).catch(() => {})

            // Anxious: retake if below threshold
            if (newResult.score !== null && newResult.score < PASS_THRESHOLD_PCT) {
              session.retakeAttempted = true
              logE({ type: 'retake_check', score: newResult.score })
              const retakeBtn = page.getByRole('button', { name: /retake|try again|redo/i }).first()
              if (await retakeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await retakeBtn.click()
                await page.waitForTimeout(2000)
                const rt = await completeTypedTest(page)
                session.retakeScore = rt.score
                retakeLog.push({ day: dayNum, origScore: newResult.score, retakeScore: rt.score,
                  sameWords: JSON.stringify(rt.presentedWords.map(w=>w.position).sort()) ===
                             JSON.stringify(newResult.presentedWords.map(w=>w.position).sort()) })
                logE({ type: 'retake_done', day: dayNum, retakeScore: rt.score })
                console.log(`Retake: score=${rt.score}%`)
              }
            }

            // Now proceed to review (Day 2+)
            if (dayNum >= 2) {
              await page.waitForTimeout(2000)
              step = await detectStep(page)
              console.log(`After new test: step=${step.type}`)

              // If on "complete" (typed test results), navigate forward to review
              if (step.type === 'complete' || step.type === 'flashcard' || step.type === 'unknown') {
                // Try "Continue to Review" or "Take Review Test"
                const reviewBtnSelectors = [
                  page.getByRole('button', { name: /continue to review|take review|review test|next step/i }).first(),
                  page.getByRole('button', { name: /continue/i }).first(),
                ]
                for (const btn of reviewBtnSelectors) {
                  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await btn.click()
                    await page.waitForTimeout(2000)
                    step = await detectStep(page)
                    break
                  }
                }
                console.log(`After advance: step=${step.type}`)
              }

              if (step.type === 'flashcard') {
                // On review flashcards — skip to MCQ test
                await skipToTestFromFlashcards(page)
                await page.waitForTimeout(2000)
                step = await detectStep(page)
                console.log(`After review skip: step=${step.type}`)
              }

              if (step.type === 'mcq') {
                // Read post-test TWI for model accuracy
                const postCP3 = await readCP()
                const postTWI3 = postCP3?.totalWordsIntroduced ?? preTWI
                const postIL3 = postCP3?.interventionLevel ?? preIL
                const seg3 = calculateSegment(dayNum, STUDY_DAYS_PER_WEEK, postTWI3, DAILY_PACE, postIL3)
                const nowMs3 = currentDate.getTime()
                const postSS3 = await readSS()
                let elig3 = new Set(), ret3 = new Set()
                if (seg3) {
                  const states3 = postSS3.filter(s => s.wordIndex != null).map(s => ({
                    position: s.wordIndex, status: s.status,
                    returnAtMs: s.returnAt ? s.returnAt._seconds * 1000 : null
                  }))
                  const p3 = partitionReviewEligibility(states3, seg3, nowMs3)
                  elig3 = p3.eligibleIds; ret3 = p3.retiredIds
                }
                console.log(`Seg: ${seg3 ? `[${seg3.startIndex}-${seg3.endIndex}]` : 'null'}, elig=${elig3.size}, ret=${ret3.size}`)

                const rev3 = await completeMCQTest(page)
                session.reviewTest = rev3
                logE({ type: 'review_done', day: dayNum, score: rev3.score, answered: rev3.questionCount })
                console.log(`Review: score=${rev3.score}%, answered=${rev3.questionCount}`)

                // F01 check
                const f013 = []
                const revPos3 = rev3.presentedWords.map(w => w.position).filter(p => p >= 0)
                for (const pos of revPos3) {
                  const ss3 = postSS3.find(s => s.wordIndex === pos)
                  if (ss3?.status === 'MASTERED') {
                    const retMs = ss3.returnAt ? ss3.returnAt._seconds * 1000 : null
                    if (retMs == null || retMs > nowMs3) f013.push({ pos, id: ss3.id, returnAtMs: retMs })
                  }
                }
                session.f01Violations = f013
                if (f013.length > 0) { findingsList.push({ day: dayNum, type: 'F01', f013 }); logE({ type: 'f01', day: dayNum, count: f013.length }) }
                const revViol3 = seg3 ? checkPresentedWords({ phase: 'review', presentedPositions: revPos3, expectedRange: seg3, eligibleIds: elig3, retiredIds: ret3 }) : []
                session.violations = [...revViol3, ...f013.map(f => `F01: MASTERED pos ${f.pos}`)]
                session.reviewModel = { seg: seg3, eligibleIds: elig3.size, retiredIds: ret3.size, postTWI: postTWI3 }

                await page.screenshot({ path: join(EVIDENCE_DIR, `day_${String(dayNum).padStart(2,'0')}_review_done.png`) }).catch(() => {})
              }
            }

            // New-word violations
            const newPos = (session.newTest?.presentedWords ?? []).map(w => w.position).filter(p => p >= 0)
            const newViol = checkPresentedWords({ phase: 'new', presentedPositions: newPos, expectedRange: expNew })
            if (newViol.length > 0) {
              console.log(`NEW violations Day ${dayNum}:`, newViol.slice(0, 2))
              session.violations = [...(session.violations || []), ...newViol]
              findingsList.push({ day: dayNum, type: 'NEW_VIOL', violations: newViol })
            }

          } else if (step.type === 'mcq') {
            // Landed on MCQ directly (typed already done earlier)
            const postCP4 = await readCP()
            const postTWI4 = postCP4?.totalWordsIntroduced ?? preTWI
            const postIL4 = postCP4?.interventionLevel ?? preIL
            const seg4 = calculateSegment(dayNum, STUDY_DAYS_PER_WEEK, postTWI4, DAILY_PACE, postIL4)
            const nowMs4 = currentDate.getTime()
            const postSS4 = await readSS()
            let elig4 = new Set(), ret4 = new Set()
            if (seg4) {
              const states4 = postSS4.filter(s => s.wordIndex != null).map(s => ({
                position: s.wordIndex, status: s.status,
                returnAtMs: s.returnAt ? s.returnAt._seconds * 1000 : null
              }))
              const p4 = partitionReviewEligibility(states4, seg4, nowMs4)
              elig4 = p4.eligibleIds; ret4 = p4.retiredIds
            }

            const rev4 = await completeMCQTest(page)
            session.reviewTest = rev4
            session.newTest = { presentedWords: [], questionCount: 0, score: null, note: 'typed_done_earlier' }
            logE({ type: 'review_only_v2', day: dayNum, score: rev4.score })
            console.log(`Review only: score=${rev4.score}%`)

            const f014 = []
            const revPos4 = rev4.presentedWords.map(w => w.position).filter(p => p >= 0)
            for (const pos of revPos4) {
              const ss4 = postSS4.find(s => s.wordIndex === pos)
              if (ss4?.status === 'MASTERED') {
                const retMs = ss4.returnAt ? ss4.returnAt._seconds * 1000 : null
                if (retMs == null || retMs > nowMs4) f014.push({ pos, id: ss4.id, returnAtMs: retMs })
              }
            }
            session.f01Violations = f014
            if (f014.length > 0) { findingsList.push({ day: dayNum, type: 'F01', f014 }); logE({ type: 'f01', day: dayNum, count: f014.length }) }
            session.reviewModel = { seg: seg4, eligibleIds: elig4.size, retiredIds: ret4.size, postTWI: postTWI4 }

          } else {
            session.blocked = true
            session.blockedReason = `Unexpected step: ${step.type}`
            logE({ type: 'blocked', day: dayNum, step: step.type })
            console.log(`Blocked on Day ${dayNum}: step=${step.type}`)
          }
        }

        // Read post-CSD
        await page.waitForTimeout(2000)
        const postCP = await readCP()
        session.postCSD = postCP?.currentStudyDay ?? preCSD
        session.postTWI = postCP?.totalWordsIntroduced ?? preTWI

      } catch (err) {
        console.error(`Day ${dayNum} error:`, err.message.substring(0, 100))
        session.errors.push(err.message.substring(0, 200))
        logE({ type: 'error', day: dayNum, error: err.message.substring(0, 100) })
      } finally {
        await page.close().catch(() => {})
        await ctx.close().catch(() => {})
      }

      // Post-reads
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

      const row = {
        day: dayNum, date: currentDate.toISOString().split('T')[0],
        preCSD, postCSD: finalCSD, expectedCSD: expectedPostCSD, csdOk,
        preTWI, postTWI: finalTWI,
        expNewRange: expNew ? `${expNew.startIndex}-${expNew.endIndex}` : 'null',
        expNewCount: expNew?.count ?? 0,
        newTestScore: session.newTest?.score ?? null,
        presentedNewCount: (session.newTest?.presentedWords ?? []).filter(w => w.position >= 0).length,
        retakeAttempted: session.retakeAttempted, retakeScore: session.retakeScore,
        expSegment: session.reviewModel?.seg ? `${session.reviewModel.seg.startIndex}-${session.reviewModel.seg.endIndex}` : 'null',
        eligibleCount: session.reviewModel?.eligibleIds ?? 0,
        retiredCount: session.reviewModel?.retiredIds ?? 0,
        reviewTestScore: session.reviewTest?.score ?? null,
        presentedReviewCount: (session.reviewTest?.presentedWords ?? []).filter(w => w.position >= 0).length,
        f01Violations: (session.f01Violations ?? []).length,
        preMastered, postMastered: finalMastered,
        violations: session.violations ?? [], blocked: session.blocked,
        blockedReason: session.blockedReason, h2Hit: session.h2Hit, errors: session.errors
      }
      dayTable.push(row)

      const evidence = {
        dayNum, date: currentDate.toISOString(),
        preCSD, postCSD: finalCSD, preTWI, postTWI: finalTWI,
        csdOk, csdDrift: csdOk ? null : `exp ${expectedPostCSD} got ${finalCSD}`,
        expectedNewRange: expNew,
        newTest: session.newTest, reviewTest: session.reviewTest,
        retakeAttempted: session.retakeAttempted, retakeScore: session.retakeScore,
        f01Violations: session.f01Violations ?? [],
        reviewModel: session.reviewModel, violations: session.violations,
        statusHistPre: preHist, statusHistPost: finalHist,
        preMastered, postMastered: finalMastered,
        blocked: session.blocked, blockedReason: session.blockedReason,
        h2Hit: session.h2Hit, h2Count,
        logoutLoginScenario: session.logoutLoginScenario,
        errors: session.errors, consoleErrors: consoleErrs.slice(0, 5),
        capturedAt: new Date().toISOString()
      }
      writeFileSync(join(EVIDENCE_DIR, `day_${String(dayNum).padStart(2,'0')}.json`), JSON.stringify(evidence, null, 2))
      console.log(`Evidence: day_${String(dayNum).padStart(2,'0')}.json`)

      logE({ type: 'session_done', day: dayNum, postCSD: finalCSD, csdOk, f01: (session.f01Violations ?? []).length, mastered: finalMastered, blocked: session.blocked })

      currentDate = nextStudyDay(currentDate)
    }

    // Self-check
    const allCP = await readAllCP()
    const atts = await readAttempts()
    const orphans = allCP.filter(d => !d.id.includes('_'))
    const wrongFmt = atts.filter(a => !a.id.includes(CLASS_ID) || !a.id.includes(LIST_ID))

    console.log('\n=== SELF-CHECK ===')
    console.log(`CP docs: ${allCP.map(d => d.id).join(', ')}`)
    console.log(`Orphan docs: ${orphans.length}`)
    console.log(`Wrong format attempts: ${wrongFmt.length}`)
    console.log(`Total attempts: ${atts.length}`)

    logE({ type: 'audit_done', sessions: dayTable.length, completed: dayTable.filter(d => !d.blocked).length, h2Count, orphans: orphans.length, wrongFmt: wrongFmt.length, f01Days: findingsList.filter(f => f.type === 'F01').length })

    return { dayTable, findingsList, retakeLog, logoutLoginResult, h2Count, startDay: START_DAY, orphans: orphans.length, wrongFmt: wrongFmt.length, totalAttempts: atts.length }

  } finally {
    await browser.close()
  }
}

// Run
console.log('B27 anxious/TOP fix run starting...')
const result = await main()

console.log('\n=== AUDIT COMPLETE ===')
console.log(`Sessions: ${result.dayTable.length} | Completed: ${result.dayTable.filter(d => !d.blocked).length}`)
console.log(`Day range: ${result.startDay} → ${result.startDay + result.dayTable.length - 1}`)
console.log(`H2 hits: ${result.h2Count}`)
console.log(`F01 days: ${result.findingsList.filter(f => f.type === 'F01').length}`)
console.log(`Retakes: ${result.retakeLog.length}`)
console.log(`Orphan docs: ${result.orphans}`)
console.log(`Total attempts: ${result.totalAttempts}`)
console.log('')
console.log('Day table summary:')
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
    `SEG[${r.expSegment}] elig=${r.eligibleCount} ret=${r.retiredCount} review=${r.presentedReviewCount} score=${r.reviewTestScore}% | ` +
    `MAST ${r.preMastered}→${r.postMastered} ${flags}`)
}
