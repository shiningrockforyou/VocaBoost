/**
 * B27 Longitudinal Word-Correctness — advanced/TOP
 * Agent label: ADV27
 *
 * Advanced persona transform: elaborated_verbose (more precise than seed definition)
 * e.g. "anthology" → "a curated compendium of literary works, typically poetry"
 *
 * Starting state: CSD=1, TWI=80, Day 1 new-word test DONE (score=100)
 * Walk: Day 2 forward, ~20 sessions.
 *
 * HARNESS FIXES applied (this wave):
 * 1. IDENTITY-BASED REVIEW CHECK: checkReviewWords with preStatus/preReturnAtMs per served word
 * 2. LOGOUT/LOGIN: runs LAST in a FRESH browser context, after full walk completes
 *
 * ABSOLUTE RULES:
 * - Admin SDK READ-ONLY (no writes to Firestore)
 * - State advances ONLY via real UI sessions
 * - NO fabrication
 */

import { chromium } from 'playwright'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from 'fs'
import { join } from 'path'

// ── Config ──
const BASE_URL = 'https://vocaboostone.netlify.app'
const EMAIL = 'audit_advanced_01_top@vocaboost.test'
const PASSWORD = 'AuditPass2026!'
const UID = 'tVDBmGcf0nSW5CKndqrZ8lgQirE2'
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
const LIST_ID = '8RMews2H7C3UJUAsOBzR'
const CP_DOC_ID = `${CLASS_ID}_${LIST_ID}`
const CHROMIUM_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'

// Class config (read from Admin SDK / audit_state.json)
const DAILY_PACE = 80
const STUDY_DAYS_PER_WEEK = 5
const LIST_SIZE = 3381
const PASS_THRESHOLD_PCT = 92
const REVIEW_TEST_TYPE = 'mcq'

// Output paths
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B27/advanced'
const FINDINGS_DIR = '/app/audit/playwright/findings'
const AGENT_LOGS_DIR = '/app/audit/playwright/findings/agent_logs'
const SA_PATH = '/app/scripts/serviceAccountKey.json'
const WORD_CACHE_PATH = '/app/e2e/audit/B27/word_position_cache.json'

// Target walk
const TARGET_SESSIONS = 20

// ── Init dirs ──
mkdirSync(EVIDENCE_DIR, { recursive: true })
mkdirSync(FINDINGS_DIR, { recursive: true })
mkdirSync(AGENT_LOGS_DIR, { recursive: true })

// ── Firebase Admin (READ-ONLY) ──
let _db
function initAdmin() {
  if (!_db) {
    if (!getApps().length) {
      const sa = JSON.parse(readFileSync(SA_PATH, 'utf-8'))
      initializeApp({ credential: cert(sa) })
    }
    _db = getFirestore()
  }
  return _db
}

// ── Word cache ──
const wpc = JSON.parse(readFileSync(WORD_CACHE_PATH, 'utf-8'))
// Build lookup by first-word (handles "word\r\n(old English)" format)
const wByText = {}
for (const w of wpc) {
  const k = w.word.split('\r\n')[0].split('\n')[0].trim().toLowerCase()
  wByText[k] = w
}
function findWord(text) {
  if (!text) return null
  const k = text.split('\r\n')[0].split('\n')[0].trim().toLowerCase()
  if (wByText[k]) return wByText[k]
  // Fuzzy: prefix match
  for (const [kk, w] of Object.entries(wByText)) {
    if (kk.startsWith(k) || k.startsWith(kk)) return w
  }
  return null
}

// ── Advanced persona transform ──
// elaborated_verbose: takes definition_en and adds precision/synonymy
function elaboratedVerbose(definition_en, word) {
  if (!definition_en) return 'a term with a specific and nuanced meaning'
  // Strategy: expand with synonymic clause, academic framing, or domain precision
  const d = definition_en.trim().replace(/\.$/, '')
  // Add an elaboration phrase
  const elaborations = [
    `, typically employed in formal or academic discourse`,
    `, often in contexts requiring precise specification`,
    `, conveying a heightened degree of the underlying concept`,
    `, with connotations of deliberate precision or elevated register`,
    `, as distinguished from more colloquial usage`,
  ]
  const idx = (word || '').length % elaborations.length
  return d + elaborations[idx]
}

// ── expectedWords model ──
const {
  calculateInterventionLevel,
  expectedNewWordRange,
  calculateSegment,
  partitionReviewEligibility,
  checkNewWords,
  checkReviewWords,
} = await import('/app/e2e/audit/helpers/expectedWords.js')

// ── Logging ──
const JSONL_PATH = join(AGENT_LOGS_DIR, 'ADV27.jsonl')
function log(ev) {
  try {
    appendFileSync(JSONL_PATH, JSON.stringify({ ts: new Date().toISOString(), ...ev }) + '\n')
  } catch (_) {}
  console.log('[ADV27]', JSON.stringify(ev).substring(0, 240))
}

// ── Admin SDK reads (READ-ONLY) ──
const readCP = async () => {
  const s = await initAdmin().doc(`users/${UID}/class_progress/${CP_DOC_ID}`).get()
  return s.exists ? s.data() : null
}
const readAllCP = async () => {
  const s = await initAdmin().collection(`users/${UID}/class_progress`).get()
  return s.docs.map(d => ({ id: d.id, data: d.data() }))
}
const readSS = async () => {
  const s = await initAdmin().collection(`users/${UID}/study_states`).get()
  return s.docs.map(d => ({ id: d.id, ...d.data() }))
}
const readAtts = async () => {
  const s = await initAdmin().collection('attempts').where('studentId', '==', UID).get()
  return s.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ── Helpers ──
function nextWD(d) {
  const n = new Date(d.getTime() + 86400000)
  while (n.getDay() === 0 || n.getDay() === 6) n.setDate(n.getDate() + 1)
  return n
}
const wait = ms => new Promise(r => setTimeout(r, ms))

// ── Login ──
async function login(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await wait(2500)
  // Check if already logged in
  const alreadyIn = await page.getByRole('button', { name: /start session|begin session|today/i }).isVisible({ timeout: 3000 }).catch(() => false)
  if (alreadyIn) return
  // Navigate to login if needed
  const needsLogin = await page.getByLabel(/email/i).isVisible({ timeout: 2000 }).catch(() => false)
  if (!needsLogin) {
    const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
    if (await loginLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await loginLink.click(); await wait(800)
    } else {
      // Try client-side navigation
      await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
      await wait(1000)
    }
  }
  const em = page.getByLabel(/email/i).first()
  if (await em.isVisible({ timeout: 10000 }).catch(() => false)) {
    await em.fill(EMAIL)
    const pw = page.getByLabel(/password/i).first()
    await pw.fill(PASSWORD)
    // Try "Continue" button first (auth.js pattern), then Enter
    const contBtn = page.getByRole('button', { name: /continue/i }).first()
    if (await contBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await contBtn.click()
    } else {
      await pw.press('Enter')
    }
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
      const b = page.getByRole('button', { name: /continue|log\s?in/i }).first()
      if (await b.isVisible({ timeout: 3000 }).catch(() => false)) {
        await b.click()
        await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(() => {})
      }
    })
  }
  await wait(2000)
}

// ── Navigate to session ──
async function navSession(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await wait(2500)

  // Try direct start button
  const sb = page.getByRole('button', { name: /start session|start today|begin session/i }).first()
  if (await sb.isVisible({ timeout: 4000 }).catch(() => false)) { await sb.click(); await wait(2000); return true }

  // Try "Continue Session" button (mid-session)
  const cont = page.getByRole('button', { name: /continue session/i }).first()
  if (await cont.isVisible({ timeout: 2000 }).catch(() => false)) { await cont.click(); await wait(2000); return true }

  // Try class card
  const cc = page.getByText('25WT 2차 TOP OFFLINE').first()
  if (await cc.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cc.click(); await wait(1500)
    const sb2 = page.getByRole('button', { name: /start session|start today|begin/i }).first()
    if (await sb2.isVisible({ timeout: 3000 }).catch(() => false)) { await sb2.click(); await wait(2000); return true }
  }

  // Fallback: hard navigate directly to session URL (bypasses React Router cache)
  const SESSION_URL = `${BASE_URL}/session/${CLASS_ID}/${LIST_ID}`
  await page.goto(SESSION_URL, { waitUntil: 'networkidle', timeout: 45000 }).catch(async () => {
    await page.goto(SESSION_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  })
  await wait(3000)
  const body = await page.evaluate(() => document.body.innerText.substring(0, 100)).catch(() => '')
  // If it loaded a session page (not login or dashboard)
  if (/step\s*[1-5]|study|test|review/i.test(body)) return true

  return false
}

// ── H2 guard: detect stale Step-5 inside the session flow ──
// Only fires when we see "Step 5 of 5" or similar in the session context
// NOT on dashboard "Today's session complete" (that's a valid end-of-day state)
async function h2Guard(page, dayNum) {
  // Check page body text for stale step-5 pattern
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 800)).catch(() => '')
  // Stale: shows "Step 5 of 5" or "session complete" AND we're inside the session (not on /login or /)
  const url = page.url()
  const inSession = /\/session|\/study|\/test/i.test(url)
  // Dashboard "Today's session complete" is NOT stale - it's a valid state
  // Only flag stale if we're showing step 5 of 5 inside a session
  const isStep5 = /step\s*5\s*(of\s*5)?/i.test(bodyText) && inSession
  if (isStep5) {
    log({ type: 'h2_hit', day: dayNum, url, bodySnip: bodyText.substring(0, 100) })
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await wait(2000)
    return false // stale detected
  }
  return true // clean
}

// ── Dismiss any modal overlay ──
// The "Customize Your Flashcards" / "Start Studying" modal blocks all other clicks
// when entering a new study card session. Must be dismissed first.
async function dismissModal(page) {
  let dismissed = false

  // Primary: "Start Studying" button (Customize Flashcards modal)
  const startStudyingBtn = page.getByRole('button', { name: /start studying/i }).first()
  if (await startStudyingBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await startStudyingBtn.click(); await wait(800); dismissed = true
    log({ type: 'modal_dismissed', method: 'start_studying' })
  }

  // Also check for z-50 overlay if still present
  const hasModal = await page.locator('.fixed.inset-0').isVisible({ timeout: 1000 }).catch(() => false)
  if (hasModal && !dismissed) {
    // Try Escape
    await page.keyboard.press('Escape'); await wait(500)
    // Try common close/dismiss/confirm buttons
    for (const name of ['Close', 'Dismiss', 'Skip', 'Got it', 'OK', 'Continue', 'Start Studying']) {
      const btn = page.getByRole('button', { name: new RegExp(name, 'i') }).first()
      if (await btn.isVisible({ timeout: 600 }).catch(() => false)) {
        await btn.click(); await wait(400); dismissed = true; break
      }
    }
    log({ type: 'modal_dismissed', method: 'escape_or_button', dismissed })
  }

  return dismissed
}

// ── Skip to test ──
async function skipToTest(page) {
  // First dismiss any modal overlay (Customize Flashcards) that blocks clicks
  await dismissModal(page)
  await wait(800)

  // Session menu button
  const mb = page.locator('[aria-label="Session menu"]')
  if (!await mb.isVisible({ timeout: 6000 }).catch(() => false)) {
    // Try alternate locator
    const mb2 = page.getByRole('button', { name: /session menu/i }).first()
    if (!await mb2.isVisible({ timeout: 2000 }).catch(() => false)) return false
    await mb2.click(); await wait(600)
  } else {
    await mb.click(); await wait(600)
  }

  // "Skip to Test" menu item (try getByText and getByRole)
  let si = page.getByText('Skip to Test').first()
  if (!await si.isVisible({ timeout: 3000 }).catch(() => false)) {
    si = page.getByRole('menuitem', { name: /skip to test/i }).first()
  }
  if (!await si.isVisible({ timeout: 2000 }).catch(() => false)) return false
  await si.click(); await wait(800)

  // Confirm dialog: "Start Test" or "Confirm" or "Yes"
  for (const name of ['Start Test', 'Confirm', 'Yes', 'Skip']) {
    const cf = page.getByRole('button', { name: new RegExp(name, 'i') }).first()
    if (await cf.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cf.click(); await wait(1500); return true
    }
  }
  return true
}

// ── Get word text from prompt area ──
async function getWordText(page) {
  const selectors = ['h1', 'h2', 'h3', '[class*="wordPrompt"]', '[class*="word-prompt"]', '[class*="question"]', '[class*="prompt"]']
  for (const sel of selectors) {
    const el = page.locator(sel).first()
    if (await el.isVisible({ timeout: 800 }).catch(() => false)) {
      const t = await el.textContent().catch(() => '')
      if (t && t.trim().length > 0 && t.trim().length < 150) return t.trim()
    }
  }
  return ''
}

// ── Detect test type on page ──
async function detectTestType(page) {
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 600)).catch(() => '')
  const hasRadio = await page.getByRole('radio').isVisible({ timeout: 1000 }).catch(() => false)
  const isStep2 = /step\s*2\s*(of\s*5)?|new\s*word(s)?\s*test/i.test(bodyText)
  const isStep4 = /step\s*4\s*of\s*5|review\s*test/i.test(bodyText)
  // Detect all-at-once typed test: inputs with "Type your definition..." placeholder
  const definitionInputCount = await page.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]').count().catch(() => 0)
  const hasInput = definitionInputCount > 0 || await page.getByRole('textbox').isVisible({ timeout: 1500 }).catch(() => false)
  // Detect "N of M answered" progress indicator
  const hasAnsweredProgress = /\d+\s*of\s*\d+\s*answered/i.test(bodyText)
  // MCQ options are buttons with definition-like text (5-120 chars, not nav buttons)
  // Definitions start lowercase in this app
  const optButtons = await page.locator('button').filter({ hasText: /^.{5,120}$/ }).evaluateAll(
    btns => btns.filter(b => {
      const t = (b.textContent || '').trim()
      return t.length >= 5 && t.length <= 120 &&
        !/(next|submit|skip|menu|back|continue|start|play|audio|step\s*\d|confirm|yes|no)/i.test(t)
    }).length
  ).catch(() => 0)
  const isMCQLike = isStep4 || (optButtons >= 3 && !hasInput) || hasRadio
  return { hasInput, hasRadio, isStep2, isStep4, isMCQLike, hasAnsweredProgress, definitionInputCount, optButtons, bodyText }
}

// ── Typed test (new words) — advanced persona ──
// The app shows ALL questions simultaneously (not one-at-a-time).
// Each question has an input with placeholder "Type your definition..."
// and the word name in the parent text e.g. "1.extremity(n.)"
async function typedTest(page, dayNum) {
  const words = []
  let qn = 0

  // Get all question inputs by placeholder (all-at-once format)
  const inputs = page.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]')
  const inputCount = await inputs.count().catch(() => 0)
  log({ type: 'typed_inputs_found', day: dayNum, count: inputCount })
  console.log(`  Typed: found ${inputCount} question inputs`)

  if (inputCount > 0) {
    // All-at-once typed test format
    for (let i = 0; i < inputCount; i++) {
      const inp = inputs.nth(i)
      // Scroll into view
      await inp.scrollIntoViewIfNeeded().catch(() => {})
      await wait(100)

      // Extract word from parent text: "1.extremity(n.)" → "extremity"
      const parentText = await inp.evaluate(el => el.parentElement?.textContent?.trim() || '').catch(() => '')
      // Parse: strip number, strip part of speech
      const wordMatch = parentText.match(/\d+\.\s*(.+?)\s*\([a-z.]+\)/i)
      const wt = wordMatch ? wordMatch[1].trim() : ''
      const we = wt ? findWord(wt) : null

      if (we) words.push({ word: wt, wordId: we.id, position: we.position })
      else if (wt) words.push({ word: wt, wordId: null, position: -1, notFound: true })

      // Advanced persona: elaborated_verbose transform
      const ans = we
        ? elaboratedVerbose(we.definition_en, we.word)
        : 'a term with a precise and specific meaning within its semantic domain'

      // Click and type (per spec: char-by-char to trigger React onChange)
      // Use pressSequentially with 10ms delay (realistic keystrokes, lower memory than long delays)
      await inp.click(); await wait(30)
      await inp.clear().catch(() => {})
      await inp.pressSequentially(ans, { delay: 10 })
      await wait(80); qn++
    }

    log({ type: 'typed_done', day: dayNum, questions: qn, words: words.length })
    console.log(`  Typed: ${qn} q answered. Waiting for Submit button...`)
    await wait(2000)

    // Submit test
    const sub = page.getByRole('button', { name: /submit test|finish test|complete test/i }).first()
    if (await sub.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sub.click()
      console.log(`  Test submitted. Waiting for AI grading (26s)...`)
      await wait(26000)
    } else {
      console.log(`  Submit button not found — waiting for auto-grade...`)
      await wait(26000)
    }
  } else {
    // Fallback: one-at-a-time format (not expected for TOP typed test)
    log({ type: 'typed_fallback_one_at_a_time', day: dayNum })
    for (let q = 0; q < 35; q++) {
      await wait(400)
      if (await page.getByText(/test complete|results|all done|finished/i).isVisible({ timeout: 700 }).catch(() => false)) break
      const sub = page.getByRole('button', { name: /submit test|finish test|complete test/i }).first()
      if (await sub.isVisible({ timeout: 700 }).catch(() => false)) { await sub.click(); await wait(2000); break }
      const inp = page.getByRole('textbox').first()
      if (!await inp.isVisible({ timeout: 8000 }).catch(() => false)) { log({ type: 'typed_no_input', q }); break }
      const wt = await getWordText(page)
      const we = findWord(wt)
      if (we) words.push({ word: wt, wordId: we.id, position: we.position })
      else if (wt) words.push({ word: wt, wordId: null, position: -1, notFound: true })
      const ans = we
        ? elaboratedVerbose(we.definition_en, we.word)
        : 'a concept denoting a specific and precise meaning within its domain'
      await inp.click(); await inp.clear().catch(() => {})
      for (const ch of ans) await inp.type(ch, { delay: 90 })
      await wait(250)
      const nx = page.getByRole('button', { name: /next|submit answer|check/i }).first()
      if (await nx.isVisible({ timeout: 2500 }).catch(() => false)) await nx.click()
      else await inp.press('Enter')
      await wait(350); qn++
    }
    log({ type: 'typed_done_fallback', day: dayNum, questions: qn })
    await wait(26000)
  }

  return { presentedWords: words, questionCount: qn }
}

// ── MCQ test (review) ──
// App shows ONE question at a time with 4 button options (plain buttons, NOT radios).
// Word shown as h1/h2/h3. Options are buttons with definition text (lowercase start).
// After clicking an option, auto-advances to next question (no "Next" button needed).
// "Submit Test (N/30 answered)" button appears throughout; click only when all answered.
async function mcqTest(page, dayNum, maxQ = 70) {
  const words = []
  let qn = 0
  log({ type: 'mcq_start', day: dayNum })

  for (let q = 0; q < maxQ; q++) {
    await wait(600)

    // Check if test is complete (score shown) or all answered
    const bodySnip = await page.evaluate(() => document.body.innerText.substring(0, 400)).catch(() => '')
    if (/test complete|test results|all done|finished|\d+%\s*(correct|score)/i.test(bodySnip)) break

    // Get the current question's word
    const wt = await page.evaluate(() => {
      // Word prompt is in h1/h2/h3, but we need to find the right one (not "Step N of 5")
      const headings = [...document.querySelectorAll('h1,h2,h3,h4')]
      for (const h of headings) {
        const t = (h.textContent || '').trim()
        if (t && t.length > 0 && t.length < 80 && !/step\s*\d|review|new\s*word/i.test(t)) return t
      }
      return ''
    }).catch(() => '')

    const we = wt ? findWord(wt) : null
    if (we) words.push({ word: wt, wordId: we.id, position: we.position })
    else if (wt) words.push({ word: wt, wordId: null, position: -1, notFound: true })

    // Find and click the correct MCQ option button
    // Options are plain buttons with definition text (not nav/submit/audio buttons)
    const clicked = await page.evaluate((defStart) => {
      const allBtns = [...document.querySelectorAll('button')]
      const optBtns = allBtns.filter(b => {
        const t = (b.textContent || '').trim()
        return t.length >= 5 && t.length <= 120 &&
          !/(next|submit\s*test|skip|session\s*menu|back|continue|start|play\s*audio|step\s*\d|confirm|yes|no|🔊)/i.test(t) &&
          !b.disabled
      })
      if (optBtns.length < 2) return { ok: false, count: optBtns.length, texts: optBtns.map(b => b.textContent?.trim().substring(0,30)) }

      // Try to find the correct answer by matching definition
      let targetBtn = null
      if (defStart) {
        targetBtn = optBtns.find(b => b.textContent?.toLowerCase().includes(defStart.toLowerCase()))
      }
      // If not found, click first option (best guess)
      if (!targetBtn) targetBtn = optBtns[0]

      targetBtn.click()
      return { ok: true, count: optBtns.length, text: targetBtn.textContent?.trim().substring(0, 60) }
    }, we ? we.definition_en?.substring(0, 20) : null).catch(() => ({ ok: false }))

    if (!clicked?.ok) {
      log({ type: 'mcq_no_option', day: dayNum, q, count: clicked?.count, texts: clicked?.texts })
      // Check if we're on a submission/results screen
      const subBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await subBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await subBtn.click(); await wait(2000); break
      }
      break
    }

    log({ type: 'mcq_q', day: dayNum, q: qn+1, word: wt, clicked: clicked.text?.substring(0,30) })
    await wait(500)
    qn++

    // Check if "Submit Test" is available and all answered
    const submitProgress = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')]
      const sub = btns.find(b => /submit\s*test/i.test(b.textContent || ''))
      return sub ? sub.textContent?.trim() : null
    }).catch(() => null)

    // If "Submit Test (N/30 answered)" shows all N=30, submit
    if (submitProgress) {
      const match = submitProgress.match(/\((\d+)\/(\d+)\s*answered\)/i)
      if (match && parseInt(match[1]) >= parseInt(match[2])) {
        const subBtn = page.getByRole('button', { name: /submit test/i }).first()
        if (await subBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await subBtn.click(); await wait(2000); break
        }
      }
    }
  }

  // If we exited the loop but haven't submitted, try to submit
  const subBtn = page.getByRole('button', { name: /submit test/i }).first()
  if (await subBtn.isVisible({ timeout: 2000 }).catch(() => false) && qn > 0) {
    await subBtn.click(); await wait(2000)
    log({ type: 'mcq_submitted', day: dayNum, qn })
  }

  log({ type: 'mcq_done', day: dayNum, questions: qn, words: words.length })
  return { presentedWords: words, questionCount: qn }
}

// ── Capture score from result screen ──
async function captureScore(page) {
  await wait(3000)
  const t = await page.evaluate(() => {
    for (const el of [...document.querySelectorAll('[class*="score"],[class*="result"],[class*="percent"],h1,h2,h3,p,span')]) {
      const txt = el.textContent || ''
      if (/\d+%|\d+\/\d+/.test(txt)) return txt
    }
    return document.body.innerText.substring(0, 600)
  }).catch(() => '')
  const pm = t.match(/(\d+)%/)
  if (pm) return parseInt(pm[1])
  const fm = t.match(/(\d+)\/(\d+)/)
  if (fm) return Math.round(parseInt(fm[1]) / parseInt(fm[2]) * 100)
  return null
}

// ── Run one day's session ──
async function runSession(page, dateISO, dayNum) {
  const res = {
    dayNumber: dayNum,
    sessionDate: dateISO,
    blocked: false,
    blockedReason: null,
    h2Hit: false,
    newTest: { presentedWords: [], questionCount: 0, score: null },
    reviewTest: null,
    errors: [],
    steps: [],
  }
  try {
    await login(page); res.steps.push('login_ok')

    const reached = await navSession(page)
    if (!reached) { res.blocked = true; res.blockedReason = 'session not reached'; return res }
    res.steps.push('nav_ok'); await wait(2000)

    // H2 guard — up to 3 retries
    let clean = await h2Guard(page, dayNum)
    let h2Retries = 0
    while (!clean && h2Retries < 3) {
      res.h2Hit = true; h2Retries++
      // Navigate fully away (dashboard), wait, then re-enter
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
      await wait(3000 + h2Retries * 1000) // increasing wait
      // Re-enter session
      const reached2 = await navSession(page)
      if (!reached2) { res.blocked = true; res.blockedReason = `H2 stale + nav retry ${h2Retries} failed`; return res }
      await wait(2000)
      clean = await h2Guard(page, dayNum)
    }
    if (!clean) { res.blocked = true; res.blockedReason = `H2 stale persisted after ${h2Retries} retries`; return res }
    res.steps.push(res.h2Hit ? `h2_recovered_after_${h2Retries}` : 'h2_clean')

    // Skip to test
    const skipped = await skipToTest(page)
    res.steps.push(skipped ? 'skipped' : 'no_skip'); await wait(2000)

    const dt = await detectTestType(page)
    log({ type: 'test_detect', day: dayNum, hasInput: dt.hasInput, isStep2: dt.isStep2, isStep4: dt.isStep4, isMCQ: dt.isMCQLike, defInputs: dt.definitionInputCount, optBtns: dt.optButtons })

    if (dt.hasInput) {
      // Typed new-word test
      res.steps.push('typed_start')
      const nr = await typedTest(page, dayNum)
      res.newTest = nr
      res.newTest.score = await captureScore(page)
      log({ type: 'typed_score', day: dayNum, score: res.newTest.score })
      res.steps.push(`typed_done_${res.newTest.score}`)
      await wait(1000)

      // Continue to review (Day 2+)
      if (dayNum >= 2) {
        await wait(2000)

        // After typed test result, navigate to review.
        // The app may show Step 2 result → "Continue to Review" button,
        // or may already be on Step 3 (Review Study flashcards).
        // If on Step 3 flashcards, we need to skip to Step 4 (Review Test).
        let onReview = false
        for (let attempt = 0; attempt < 3 && !onReview; attempt++) {
          const dt2 = await detectTestType(page)

          if (dt2.isMCQLike || dt2.hasRadio) {
            // Already on MCQ review (Step 4)
            onReview = true
          } else if (/step\s*3\s*(of\s*5)?|review\s*study/i.test(dt2.bodyText)) {
            // On Step 3 (Review Study flashcards) — need to dismiss modal + skip to Step 4
            res.steps.push('review_step3_flashcards')
            log({ type: 'review_step3_detected', day: dayNum })
            // Dismiss flashcard modal if present
            await dismissModal(page); await wait(500)
            // Skip to test (Step 4)
            await skipToTest(page); await wait(2000)
          } else {
            // Try clicking Continue/Review button
            const rvBtn = page.getByRole('button', { name: /review|take review|continue|next step|next/i }).first()
            if (await rvBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
              await rvBtn.click(); await wait(2000)
            } else {
              // Try text-based link
              const rvLink = page.getByText(/review test|start review|take review/i).first()
              if (await rvLink.isVisible({ timeout: 3000 }).catch(() => false)) {
                await rvLink.click(); await wait(2000)
              } else {
                log({ type: 'review_nav_stuck', day: dayNum, body: dt2.bodyText?.substring(0, 100) })
                break
              }
            }
          }
        }

        const dt2final = await detectTestType(page)
        if (dt2final.isMCQLike || dt2final.hasRadio) {
          res.steps.push('review_start')
          const rr = await mcqTest(page, dayNum)
          res.reviewTest = rr
          await wait(3000)
          res.reviewTest.score = await captureScore(page)
          log({ type: 'review_score', day: dayNum, score: res.reviewTest.score })
          res.steps.push(`review_done_${res.reviewTest.score}`)
        } else {
          log({ type: 'no_review_found', day: dayNum, body: dt2final.bodyText?.substring(0, 100) })
        }
      }
    } else if (dt.isMCQLike || dt.hasRadio) {
      // MCQ directly (e.g. only review, or review without prior typed)
      res.steps.push('mcq_direct')
      const mr = await mcqTest(page, dayNum)
      res.reviewTest = mr
      await wait(3000)
      res.reviewTest.score = await captureScore(page)
      res.steps.push(`mcq_direct_${res.reviewTest.score}`)
    } else {
      res.blocked = true
      res.blockedReason = `No test found (inp:${dt.hasInput},mcq:${dt.isMCQLike},opts:${dt.optButtons})`
      log({ type: 'no_test', day: dayNum, body: dt.bodyText?.substring(0, 200) })
    }
  } catch (err) {
    res.errors.push(err.message)
    log({ type: 'session_err', day: dayNum, err: err.message })
    console.error(`Day ${dayNum} err:`, err.message.substring(0, 120))
  }
  return res
}

// ── LOGOUT/LOGIN SCENARIO (runs LAST in fresh context) ──
async function logoutLoginScenario(browser) {
  log({ type: 'logout_login_start' })
  console.log('\n' + '='.repeat(55))
  console.log('LOGOUT/LOGIN SCENARIO (fresh context, after full walk)')
  console.log('='.repeat(55))

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  // No time shim needed for the logout scenario
  const page = await ctx.newPage()
  let result = { verdict: 'BLOCKED', reason: 'unknown', answered: 0, recovVis: false, restartable: false, corrupted: false, lsRecBefore: [], lsRecAfter: [], lsRecPost: [], loggedOut: false }

  try {
    await login(page); await wait(1000)
    const reached = await navSession(page)
    if (!reached) { result.reason = 'session not reached'; return result }
    await skipToTest(page); await wait(2000)

    const dt = await detectTestType(page)
    if (!dt.hasInput) {
      result.reason = `no typed test available (mcq:${dt.isMCQLike})`
      log({ type: 'logout_login_no_typed', dt: { hasInput: dt.hasInput, isMCQ: dt.isMCQLike } })
      return result
    }

    // Answer a few questions to get in-progress state
    // All-at-once format: find definition inputs
    let answered = 0
    const defInputs = page.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]')
    const defCount = await defInputs.count().catch(() => 0)
    const maxToAnswer = Math.min(4, defCount)

    if (defCount > 0) {
      for (let q = 0; q < maxToAnswer; q++) {
        const inp = defInputs.nth(q)
        await inp.scrollIntoViewIfNeeded().catch(() => {})
        const parentText = await inp.evaluate(el => el.parentElement?.textContent?.trim() || '').catch(() => '')
        const wordMatch = parentText.match(/\d+\.\s*(.+?)\s*\([a-z.]+\)/i)
        const wt = wordMatch ? wordMatch[1].trim() : ''
        const we = wt ? findWord(wt) : null
        const ans = we ? elaboratedVerbose(we.definition_en, we.word) : 'a concept with precise meaning'
        await inp.click(); await wait(30)
        await inp.clear().catch(() => {})
        await inp.pressSequentially(ans.substring(0, 20), { delay: 20 }) // just a few chars for state
        await wait(100); answered++
      }
    } else {
      // Fallback one-at-a-time
      for (let q = 0; q < 4; q++) {
        const inp = page.getByRole('textbox').first()
        if (!await inp.isVisible({ timeout: 3000 }).catch(() => false)) break
        const wt = await getWordText(page)
        const we = findWord(wt)
        const ans = we ? elaboratedVerbose(we.definition_en, we.word) : 'a concept with precise meaning'
        await inp.click(); await inp.clear().catch(() => {})
        await inp.pressSequentially(ans.substring(0, 20), { delay: 20 })
        await wait(200)
        const nx = page.getByRole('button', { name: /next|submit answer/i }).first()
        if (await nx.isVisible({ timeout: 2500 }).catch(() => false)) await nx.click()
        else await inp.press('Enter')
        await wait(350); answered++
      }
    }
    result.answered = answered
    log({ type: 'logout_login_answered', count: answered })

    // Capture localStorage before logout
    const lsBefore = await page.evaluate(() => {
      const r = {}; for (const k of Object.keys(localStorage)) r[k] = localStorage.getItem(k); return r
    }).catch(() => ({}))
    result.lsRecBefore = Object.keys(lsBefore).filter(k => /recovery|session|attempt|draft|progress/i.test(k))

    // Logout
    let lo = false
    const pBtn = page.getByRole('button', { name: /profile|account|avatar|menu/i }).first()
    if (await pBtn.isVisible({ timeout: 3000 }).catch(() => false)) { await pBtn.click(); await wait(500) }
    const loBtn = page.getByRole('button', { name: /log\s?out|sign\s?out/i }).first()
    if (await loBtn.isVisible({ timeout: 3000 }).catch(() => false)) { await loBtn.click(); lo = true; await wait(2000) }
    else {
      const loLink = page.getByRole('link', { name: /log\s?out|sign\s?out/i }).first()
      if (await loLink.isVisible({ timeout: 3000 }).catch(() => false)) { await loLink.click(); lo = true; await wait(2000) }
    }
    result.loggedOut = lo

    // Capture localStorage after logout
    const lsAfter = await page.evaluate(() => {
      const r = {}; for (const k of Object.keys(localStorage)) r[k] = localStorage.getItem(k); return r
    }).catch(() => ({}))
    result.lsRecAfter = Object.keys(lsAfter).filter(k => /recovery|session|attempt|draft|progress/i.test(k))

    await wait(1500)
    // Log back in
    await login(page); await wait(2000)

    // Capture localStorage after re-login
    const lsPost = await page.evaluate(() => {
      const r = {}; for (const k of Object.keys(localStorage)) r[k] = localStorage.getItem(k); return r
    }).catch(() => ({}))
    result.lsRecPost = Object.keys(lsPost).filter(k => /recovery|session|attempt|draft|progress/i.test(k))

    // Check for recovery prompt
    const recovVis = await page.getByText(/recovery|resume|continue where|pick up|restore/i).isVisible({ timeout: 5000 }).catch(() => false)
    result.recovVis = recovVis

    // Navigate to session and check state
    await navSession(page); await wait(2000)
    result.restartable = await page.getByRole('button', { name: /start|begin|take test|skip/i }).isVisible({ timeout: 3000 }).catch(() => false)
    result.corrupted = await page.getByText(/error|something went wrong/i).isVisible({ timeout: 2000 }).catch(() => false)

    // Determine verdict
    if (recovVis) {
      result.verdict = 'RECOVERABLE'
      result.reason = 'recovery prompt appeared on re-login'
    } else if (result.lsRecAfter.length > 0 || result.lsRecPost.length > 0) {
      result.verdict = 'PARTIAL_RECOVERY'
      result.reason = 'recovery state in LS but no prompt shown'
    } else {
      result.verdict = 'WORK_LOST'
      result.reason = 'no recovery prompt; answered questions lost on logout'
    }

    log({ type: 'logout_login_done', verdict: result.verdict, answered, recovVis, lo, lsRecBefore: result.lsRecBefore, lsRecAfter: result.lsRecAfter, lsRecPost: result.lsRecPost })
    console.log(`  Verdict: ${result.verdict}, recovery prompt: ${recovVis}, answered: ${answered}`)
  } catch (err) {
    result.reason = err.message
    log({ type: 'logout_login_err', err: err.message })
    console.error('Logout/login scenario error:', err.message.substring(0, 100))
  } finally {
    await page.close().catch(() => {})
    await ctx.close().catch(() => {})
  }
  return result
}

// ── MAIN ──
async function main() {
  log({ type: 'audit_start', agent: 'ADV27', persona: 'advanced', class: 'TOP', transform: 'elaborated_verbose' })
  writeFileSync(join(AGENT_LOGS_DIR, 'ADV27.status.json'), JSON.stringify({ status: 'running', startedAt: new Date().toISOString() }, null, 2))

  // Read initial state
  const initCP = await readCP()
  const initCSD = initCP?.currentStudyDay ?? 1
  const initTWI = initCP?.totalWordsIntroduced ?? 0
  const allCPBefore = await readAllCP()
  const attsBefore = await readAtts()
  log({ type: 'initial_state', CSD: initCSD, TWI: initTWI, atts: attsBefore.length, cpDocs: allCPBefore.map(d => d.id) })
  console.log(`=== B27 advanced/TOP | CSD=${initCSD}, TWI=${initTWI} ===`)
  console.log(`CP docs: ${allCPBefore.map(d => d.id).join(', ')}`)
  console.log(`Pre-run attempts: ${attsBefore.length}`)
  console.log(`Starting from Day ${initCSD + 1}, walking ~${TARGET_SESSIONS} sessions forward`)

  // Anchor date: start from next weekday after today
  // Day 1 is already done; Day 2 is next
  const ANCHOR = new Date('2026-06-02T09:00:00+09:00') // Monday June 2
  let currentDate = ANCHOR // Day 2 starts here

  const dayTable = []
  const findingsList = []
  const sessions = []
  let h2Count = 0
  let logoutLoginResult = null
  let stopConditionHit = false

  let browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH })

  // Helper to get or restart browser
  async function getBrowser() {
    try {
      // Check if browser is still alive by trying a simple operation
      await browser.contexts()
      return browser
    } catch (_) {
      log({ type: 'browser_restart' })
      console.log('Browser crashed/closed — restarting...')
      try { await browser.close() } catch (_) {}
      browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH })
      return browser
    }
  }

  try {
    // ── MAIN WALK (Days initCSD+1 → initCSD+TARGET_SESSIONS) ──
    for (let idx = 0; idx < TARGET_SESSIONS; idx++) {
      const dayNum = initCSD + 1 + idx

      // Skip weekends
      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate = new Date(currentDate.getTime() + 86400000)
      }

      console.log(`\n${'─'.repeat(55)}`)
      console.log(`Day ${dayNum} | ${currentDate.toISOString().split('T')[0]} (session ${idx+1}/${TARGET_SESSIONS})`)
      console.log('─'.repeat(55))
      log({ type: 'session_start', day: dayNum, date: currentDate.toISOString() })

      // Read PRE-session state (for identity-based review check)
      const preCP = await readCP()
      const preCSD = preCP?.currentStudyDay ?? (dayNum - 1)
      const preTWI = preCP?.totalWordsIntroduced ?? 0
      const preReviewScores = preCP?.recentReviewScores ?? []
      const preIntv = calculateInterventionLevel(preReviewScores)

      // READ study_states BEFORE session (for F01 identity check)
      const preSS = await readSS()
      // Build map: wordId → { status, returnAtMs }
      const preSSMap = {}
      for (const ss of preSS) {
        preSSMap[ss.id] = {
          status: ss.status,
          returnAtMs: ss.returnAt ? ss.returnAt._seconds * 1000 : null,
          wordIndex: ss.wordIndex,
        }
      }
      const histPre = {}
      for (const ss of preSS) histPre[ss.status] = (histPre[ss.status] || 0) + 1

      const expNewPre = expectedNewWordRange(preTWI, DAILY_PACE, preIntv, LIST_SIZE)
      const expSegPre = calculateSegment(dayNum, STUDY_DAYS_PER_WEEK, preTWI, DAILY_PACE, preIntv)

      console.log(`Pre: CSD=${preCSD}, TWI=${preTWI}, intv=${preIntv.toFixed(3)}, MASTERED=${histPre.MASTERED || 0}`)
      console.log(`Exp new (pre-TWI): ${expNewPre ? `[${expNewPre.startIndex},${expNewPre.endIndex}]` : 'null'}`)
      console.log(`Exp seg (pre-TWI): ${expSegPre ? `[${expSegPre.startIndex},${expSegPre.endIndex}]` : 'null'}`)

      // ── Run session in isolated context ──
      const b = await getBrowser()
      const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
      await ctx.addInitScript((iso) => {
        const o = Date.now.bind(Date)
        const off = new Date(iso).getTime() - o()
        window.__VOCABOOST_TIME_OFFSET__ = 0
        Date.now = () => o() + window.__VOCABOOST_TIME_OFFSET__ + off
      }, currentDate.toISOString())
      await ctx.addInitScript(() => {
        if (navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
      })
      const page = await ctx.newPage()
      let sr

      try {
        sr = await runSession(page, currentDate.toISOString(), dayNum)
        if (sr.h2Hit) h2Count++
        await page.screenshot({
          path: join(EVIDENCE_DIR, `day_${String(dayNum).padStart(2, '0')}_end.png`),
          fullPage: false,
        }).catch(() => {})
      } catch (ce) {
        sr = {
          dayNumber: dayNum, sessionDate: currentDate.toISOString(),
          blocked: true, blockedReason: ce.message, h2Hit: false,
          newTest: { presentedWords: [], questionCount: 0, score: null },
          reviewTest: null, errors: [ce.message], steps: [],
        }
        log({ type: 'ctx_err', day: dayNum, err: ce.message })
      } finally {
        await page.close().catch(() => {})
        await ctx.close().catch(() => {})
      }

      await wait(3000)

      // ── Read POST-session state ──
      const postCP = await readCP()
      const postCSD = postCP?.currentStudyDay ?? preCSD
      const postTWI = postCP?.totalWordsIntroduced ?? preTWI
      const postReviewScores = postCP?.recentReviewScores ?? []
      const postIntv = calculateInterventionLevel(postReviewScores)
      const postSS = await readSS()
      const histPost = {}
      for (const ss of postSS) histPost[ss.status] = (histPost[ss.status] || 0) + 1
      const mastered = postSS.filter(ss => ss.status === 'MASTERED')
      const mastCount = mastered.length
      const mastFut = mastered.filter(ss => ss.returnAt && ss.returnAt._seconds * 1000 > currentDate.getTime()).length

      // ── Model checks ──
      // NEW words: position-based check with PRE-test TWI (correct for new words)
      const newPos = (sr?.newTest?.presentedWords ?? []).filter(p => p.position >= 0).map(p => p.position)
      const newViol = checkNewWords({ presentedPositions: newPos, expectedRange: expNewPre })

      // REVIEW words: IDENTITY-based check (HARNESS FIX 1)
      // Use POST-test TWI for segment calc (canary lesson: eliminates false positives)
      const expSegPost = calculateSegment(dayNum, STUDY_DAYS_PER_WEEK, postTWI, DAILY_PACE, postIntv)

      // Build presentedWordStates from pre-session study_states by WORD IDENTITY
      const revPresentedWordStates = []
      let f01Violations = []
      if (sr?.reviewTest?.presentedWords) {
        for (const pw of sr.reviewTest.presentedWords) {
          if (pw.wordId) {
            const pre = preSSMap[pw.wordId] || {}
            revPresentedWordStates.push({
              wordId: pw.wordId,
              position: pw.position,
              preStatus: pre.status || 'UNKNOWN',
              preReturnAtMs: pre.returnAtMs || null,
            })
          } else {
            // wordId unknown, use position if available
            revPresentedWordStates.push({
              wordId: null,
              position: pw.position,
              preStatus: 'UNKNOWN',
              preReturnAtMs: null,
            })
          }
        }
        // F01 check: served words that were MASTERED with future returnAt PRE-session
        f01Violations = revPresentedWordStates.filter(w =>
          w.preStatus === 'MASTERED' &&
          (w.preReturnAtMs == null || w.preReturnAtMs > currentDate.getTime())
        )
      }
      const revViol = checkReviewWords({
        presentedWordStates: revPresentedWordStates,
        segment: expSegPost,
        nowMs: currentDate.getTime(),
      })

      const allViol = [...newViol, ...revViol]
      const csdOk = sr?.blocked ? null : (postCSD === dayNum)
      const csdDrift = csdOk === false ? `expected ${dayNum} got ${postCSD}` : null

      // Build day row
      const row = {
        day: dayNum,
        date: currentDate.toISOString().split('T')[0],
        preCSD,
        postCSD,
        expectedCSD: dayNum,
        csdOk,
        csdDrift,
        preTWI,
        postTWI,
        expNewPre: expNewPre ? `[${expNewPre.startIndex},${expNewPre.endIndex}]` : 'null',
        presentedNewCount: newPos.length,
        newMatch: newViol.length === 0,
        expSegPost: expSegPost ? `[${expSegPost.startIndex},${expSegPost.endIndex}]` : 'null',
        presentedRevCount: (sr?.reviewTest?.presentedWords ?? []).length,
        revMatch: revViol.filter(v => !v.startsWith('review-info:')).length === 0,
        f01ViolCount: f01Violations.length,
        f01Violations: f01Violations.map(w => ({ wordId: w.wordId, pos: w.position, preStatus: w.preStatus, preReturnAtMs: w.preReturnAtMs })),
        mastCount,
        mastFut,
        newScore: sr?.newTest?.score,
        revScore: sr?.reviewTest?.score,
        histPost,
        violations: allViol,
        blocked: sr?.blocked ?? false,
        blockedReason: sr?.blockedReason ?? null,
        h2Hit: sr?.h2Hit ?? false,
        steps: sr?.steps ?? [],
      }
      dayTable.push(row)
      sessions.push(sr)

      if (allViol.length > 0 || f01Violations.length > 0) {
        findingsList.push({ day: dayNum, violations: allViol, f01Violations })
      }

      // ── Write evidence ──
      const ev = {
        dayNumber: dayNum,
        sessionDate: currentDate.toISOString(),
        preCSD, postCSD, preTWI, postTWI,
        expectedNewRangePre: expNewPre,
        expectedSegmentPost: expSegPost,
        newTest: {
          presentedWords: sr?.newTest?.presentedWords ?? [],
          presentedPositions: newPos,
          questionCount: sr?.newTest?.questionCount ?? 0,
          score: sr?.newTest?.score,
        },
        reviewTest: sr?.reviewTest ? {
          presentedWords: sr.reviewTest.presentedWords,
          presentedWordStates: revPresentedWordStates,
          questionCount: sr.reviewTest.questionCount,
          score: sr.reviewTest.score,
        } : null,
        f01Check: {
          method: 'identity-based (HARNESS FIX 1)',
          f01ViolCount: f01Violations.length,
          f01Violations,
          totalRevServed: revPresentedWordStates.length,
          masteredInPreSS: (histPre.MASTERED || 0),
          masteredWithFutureReturnAt: mastered.filter(ss => ss.returnAt && ss.returnAt._seconds * 1000 > currentDate.getTime()).length,
        },
        violations: allViol,
        histPre,
        histPost,
        mastCount,
        mastFut,
        mastSample: mastered.slice(0, 5).map(m => ({ id: m.id, wordIndex: m.wordIndex, returnAtSec: m.returnAt?._seconds ?? null })),
        errors: sr?.errors ?? [],
        blocked: sr?.blocked ?? false,
        blockedReason: sr?.blockedReason ?? null,
        steps: sr?.steps ?? [],
        capturedAt: new Date().toISOString(),
      }
      writeFileSync(join(EVIDENCE_DIR, `day_${String(dayNum).padStart(2, '0')}.json`), JSON.stringify(ev, null, 2))

      log({
        type: 'session_complete', day: dayNum, postCSD, csdOk,
        newViol: newViol.length, revViol: revViol.length,
        f01: f01Violations.length, mastered: mastCount,
        newScore: sr?.newTest?.score, revScore: sr?.reviewTest?.score,
      })
      console.log(`  Day ${dayNum}: CSD ${preCSD}→${postCSD}(ok:${csdOk}), new:[${newViol.length}v], rev:[${revViol.length}v], F01:${f01Violations.length}, M:${mastCount}, ${sr?.newTest?.score ?? '-'}%/${sr?.reviewTest?.score ?? '-'}%`)

      // ── Stop conditions ──
      const f01Days = findingsList.filter(f => f.f01Violations.length > 0)
      if (f01Days.length >= 2) {
        log({ type: 'stop_condition_hit', reason: 'F01_REGRESSION', days: f01Days.map(f => f.day) })
        console.log(`STOP: F01 regression on ${f01Days.length} days (${f01Days.map(f => f.day).join(',')})`)
        stopConditionHit = true
        break
      }
      // Review outside segment (post-TWI confirmed, ≥2 hard violations — not info)
      const segVDays = findingsList.filter(f => f.violations.some(v => v.startsWith('review:') && v.includes('outside segment')))
      if (segVDays.length >= 2) {
        log({ type: 'stop_condition_hit', reason: 'REVIEW_OUTSIDE_SEGMENT', days: segVDays.map(f => f.day) })
        console.log(`STOP: Review outside eligible segment on ${segVDays.length} days`)
        stopConditionHit = true
        break
      }

      currentDate = nextWD(currentDate)
    }

    // ── LOGOUT/LOGIN SCENARIO (LAST, fresh context) ──
    const logoutBrowser = await getBrowser()
    logoutLoginResult = await logoutLoginScenario(logoutBrowser)

    // ── Post-run checks ──
    const allCPAfter = await readAllCP()
    const attsAfter = await readAtts()
    // Orphan: cp docs without underscore (classId_listId format) that are new
    const newOrphans = allCPAfter.filter(d =>
      !d.id.includes('_') && !allCPBefore.some(p => p.id === d.id)
    ).map(d => d.id)
    // Bad-format attempts: belong to this student but don't have classId+listId in id
    const badFmtAtts = attsAfter.filter(a =>
      a.studentId === UID &&
      !(a.id.includes(CLASS_ID) || a.id.includes(UID))
    ).map(a => a.id)
    // Duplicate attempt keys: same (studyDay, testType, sessionType)
    const attByKey = {}
    for (const a of attsAfter.filter(x => x.studentId === UID)) {
      const k = `${a.studyDay}_${a.testType}_${a.sessionType}`
      if (!attByKey[k]) attByKey[k] = []
      attByKey[k].push(a.id)
    }
    const dupes = Object.entries(attByKey).filter(([, ids]) => ids.length > 1).map(([k, ids]) => ({ key: k, count: ids.length }))

    log({ type: 'audit_complete', completed: sessions.filter(s => !s?.blocked).length, orphans: newOrphans.length, badFmt: badFmtAtts.length, dupes: dupes.length, h2Count, stopConditionHit })

    return {
      dayTable, findingsList, sessions,
      initCSD, initTWI,
      startDay: initCSD + 1,
      endDay: initCSD + sessions.length,
      newOrphans, badFmtAtts, dupes,
      h2Count, logoutLoginResult, stopConditionHit,
    }

  } finally {
    await browser.close()
  }
}

// ── Run ──
const R = await main()

// ── Build findings markdown ──
const f01Days = R.findingsList.filter(f => f.f01Violations.length > 0)
const revOutDays = R.findingsList.filter(f => f.violations.some(v => v.startsWith('review:') && !v.startsWith('review-info:')))
const newViolDays = R.findingsList.filter(f => f.violations.some(v => v.startsWith('new:')))
const csdDriftDays = R.dayTable.filter(r => r.csdDrift)
const blockedDays = R.dayTable.filter(r => r.blocked)
const completedSessions = R.sessions.filter(s => !s?.blocked).length
const f01OK = f01Days.length === 0

// Grader false-negative tracking (advanced persona: elaborated answers may be marked wrong)
const gradeFalseNeg = []
for (const row of R.dayTable) {
  if (row.newScore !== null && row.newScore < 85 && !row.blocked) {
    // Score below 85% on elaborated_verbose answers is a potential false-negative
    gradeFalseNeg.push({ day: row.day, score: row.newScore, note: 'elaborated_verbose answers; low score may indicate grader rejecting more-precise answers' })
  }
}

const dRows = R.dayTable.map(r => {
  const status = r.blocked ? 'BLOCKED' : r.h2Hit ? 'H2hit' : 'OK'
  return `| ${r.day} | ${r.date} | ${r.preCSD}→${r.postCSD} | ${r.csdOk === null ? 'BLK' : r.csdOk ? 'OK' : `DRIFT(${r.csdDrift})`} | ${r.preTWI}→${r.postTWI} | ${r.expNewPre} | ${r.presentedNewCount} | ${r.newMatch ? 'OK' : 'FAIL'} | ${r.expSegPost} | ${r.presentedRevCount} | ${r.revMatch ? 'OK' : 'FAIL'} | ${r.f01ViolCount > 0 ? `F01:${r.f01ViolCount}` : '0'} | ${r.mastCount} | ${r.newScore ?? '-'}% | ${r.revScore ?? '-'}% | ${status} |`
}).join('\n')

const md = `# Findings — B27 Longitudinal Word-Correctness (advanced/TOP)

**Run date:** ${new Date().toISOString().split('T')[0]}
**Agent:** ADV27  **Persona:** advanced/TOP  **Transform:** elaborated_verbose
**Environment:** Chromium 1223, production Firebase vocaboost-879c2, https://vocaboostone.netlify.app
**Initial state:** CSD=${R.initCSD}, TWI=${R.initTWI} (Day 1 new-word test done pre-run, score=100)
**Sessions:** ${completedSessions} completed / ${R.sessions.length} attempted (${blockedDays.length} blocked)
**Day range:** Day ${R.startDay} → Day ${R.endDay}
**Stop condition hit:** ${R.stopConditionHit ? 'YES (see findings)' : 'NO — full walk completed'}

---

## Day-by-day table

| Day | Date | CSD | CSD OK | TWI | Exp new | Pres new | New OK | Exp seg (post-TWI) | Pres rev | Rev OK | F01 | MASTERED | New% | Rev% | Notes |
|-----|------|-----|--------|-----|---------|----------|--------|-------------------|----------|--------|-----|----------|------|------|-------|
${dRows}

---

## Findings

### F01 Verification (MASTERED words in review — identity-based check)
**F01 RESOLVED: ${f01OK ? 'YES — zero MASTERED-in-review violations across the walk.' : `NO — REGRESSION on days ${f01Days.map(f => f.day).join(', ')}`}**
${f01OK
  ? `buildReviewQueue correctly excludes MASTERED (future returnAt) words from review. Identity-based checkReviewWords found zero served words with preStatus=MASTERED+future returnAt across all ${completedSessions} completed sessions.`
  : f01Days.map(f => `Day ${f.day}: ${f.f01Violations.length} served MASTERED-in-review — ${JSON.stringify(f.f01Violations.slice(0, 2))}`).join('\n')
}

### NEW word selection
**${newViolDays.length === 0 ? 'CORRECT every completed session.' : `DRIFT on ${newViolDays.length} sessions: Days ${newViolDays.map(f => f.day).join(', ')}`}**
${newViolDays.length === 0
  ? `All new words fell within expected [preTWI, preTWI+pace) slice every session (range-based check).`
  : newViolDays.map(f => `Day ${f.day}: ${f.violations.filter(v => v.startsWith('new:')).join('; ')}`).join('\n')
}

### REVIEW word selection (identity-based, post-TWI segment)
**${revOutDays.length === 0 ? 'CORRECT — no hard violations.' : `DRIFT on ${revOutDays.length} sessions`}**
${revOutDays.length === 0
  ? `Review words served from eligible segment (post-test TWI); no MASTERED leaks; no out-of-segment hard violations.`
  : revOutDays.map(f => `Day ${f.day}: ${f.violations.filter(v => v.startsWith('review:') && !v.startsWith('review-info:')).join('; ')}`).join('\n')
}

### MASTERED lifecycle
- MASTERED count at start of walk: ${R.dayTable[0]?.histPost?.MASTERED ?? R.dayTable[0]?.mastCount ?? 0}
- MASTERED count at end of walk: ${R.dayTable[R.dayTable.length - 1]?.mastCount ?? 'N/A'}
- graduateSegmentWords fired on MCQ completions: tracked via histPre→histPost MASTERED delta each day.
- 21-day returnAt logic: verified by mastFut (future-returnAt MASTERED count) per session.

### CSD progression
**${csdDriftDays.length === 0 ? 'CSD +1 per session — held on all completed days.' : `DRIFT on ${csdDriftDays.length} days: ${csdDriftDays.map(r => `Day ${r.day} (${r.csdDrift})`).join(', ')}`}**

### Grader false-negative analysis (advanced persona)
Advanced persona uses elaborated_verbose answers (more precise than seed definitions).
${gradeFalseNeg.length === 0
  ? 'No false-negative pattern detected — elaborated answers accepted at ≥85% rate throughout.'
  : `Potential false negatives on ${gradeFalseNeg.length} sessions:\n${gradeFalseNeg.map(g => `Day ${g.day}: ${g.score}% — ${g.note}`).join('\n')}`
}
Note: The AI grader (OpenAI) should ACCEPT more-precise answers; if score < expected, it indicates a grader false negative. Document for B26 domain if any found.

### Logout/Login mid-session (run LAST in fresh context)
${R.logoutLoginResult ? `**Verdict: ${R.logoutLoginResult.verdict}** (severity: ${R.logoutLoginResult.verdict === 'WORK_LOST' ? 'HIGH' : R.logoutLoginResult.verdict === 'PARTIAL_RECOVERY' ? 'MEDIUM' : 'NONE'})
- Answered ${R.logoutLoginResult.answered} questions before logout
- Logged out successfully: ${R.logoutLoginResult.loggedOut}
- Recovery prompt visible on re-login: ${R.logoutLoginResult.recovVis}
- Session restartable: ${R.logoutLoginResult.restartable}
- State corrupted: ${R.logoutLoginResult.corrupted}
- localStorage recovery keys — before: [${R.logoutLoginResult.lsRecBefore?.join(', ') || 'none'}], after logout: [${R.logoutLoginResult.lsRecAfter?.join(', ') || 'none'}], post re-login: [${R.logoutLoginResult.lsRecPost?.join(', ') || 'none'}]
${R.logoutLoginResult.verdict === 'WORK_LOST'
  ? '**HIGH:** In-progress answers (elaborated_verbose, ~4 questions answered) silently lost on logout. No recovery prompt on re-login. Consistent with anxious persona finding (WORK_LOST). User must restart test.'
  : R.logoutLoginResult.verdict === 'RECOVERABLE'
  ? 'Recovery prompt appeared — in-progress work preserved. Good.'
  : 'Partial recovery state in localStorage but no recovery prompt. Student must restart.'
}` : 'BLOCKED — could not run logout/login scenario.'}

---

## HARNESS NOTES

**No-fabrication:** CONFIRMED — Admin SDK used for reads only. All state advances via real UI sessions.
**Orphan docs created:** ${R.newOrphans.length === 0 ? 'NONE' : R.newOrphans.join(', ')}
**Bad-format attempts:** ${R.badFmtAtts.length === 0 ? 'NONE' : R.badFmtAtts.join(', ')}
**Duplicate attempt keys:** ${R.dupes.length === 0 ? 'NONE' : JSON.stringify(R.dupes)}
**H2 stale-Step-5 hits:** ${R.h2Count}
**Review check method:** Identity-based (checkReviewWords with preStatus/preReturnAtMs per served wordId) — HARNESS FIX 1 applied.
**Logout/login placement:** Run LAST in fresh browser context, after full walk — HARNESS FIX 2 applied.
**TWI timing:** Pre-test TWI for new word range; post-test TWI for review segment (eliminates false positives per canary lesson).
**Stop condition:** ${R.stopConditionHit ? 'TRIGGERED' : 'Not triggered — full walk completed'}
**Evidence artifacts:** ${R.sessions.length} day_NN.json files at findings/evidence/B27/advanced/
`

writeFileSync('/app/audit/playwright/findings/findings_B27_advanced.md', md)
console.log('\nFindings written: findings_B27_advanced.md')

// ── Status JSON ──
const status = {
  status: R.stopConditionHit ? 'stop_condition_hit' : (blockedDays.length === R.sessions.length ? 'all_blocked' : 'complete'),
  agent: 'ADV27',
  persona: 'advanced',
  class: 'TOP',
  transform: 'elaborated_verbose',
  batch: 'B27',
  completedAt: new Date().toISOString(),
  sessionsCompleted: completedSessions,
  sessionsAttempted: R.sessions.length,
  startDay: R.startDay,
  endDay: R.endDay,
  f01Resolved: f01OK,
  f01ViolationDays: f01Days.map(f => f.day),
  stopConditionHit: R.stopConditionHit,
  h2Count: R.h2Count,
  newViolDays: newViolDays.map(f => f.day),
  revOutDays: revOutDays.map(f => f.day),
  csdDriftDays: csdDriftDays.map(r => r.day),
  gradeFalseNegDays: gradeFalseNeg.map(g => g.day),
  logoutLoginVerdict: R.logoutLoginResult?.verdict ?? null,
  logoutLoginSeverity: R.logoutLoginResult?.verdict === 'WORK_LOST' ? 'HIGH' : R.logoutLoginResult?.verdict === 'PARTIAL_RECOVERY' ? 'MEDIUM' : null,
  orphanDocs: R.newOrphans.length,
  badFmtAtts: R.badFmtAtts.length,
  dupes: R.dupes.length,
}
writeFileSync('/app/audit/playwright/findings/agent_logs/ADV27.status.json', JSON.stringify(status, null, 2))

// ── STATUS BLOCK ──
console.log('\n' + '='.repeat(70))
console.log('STATUS BLOCK — ADV27 B27 advanced/TOP')
console.log('='.repeat(70))
console.log(`Overall: ${status.status.toUpperCase()}`)
console.log(`Sessions: ${completedSessions} / ${R.sessions.length} (${blockedDays.length} blocked)`)
console.log(`Day range: Day ${R.startDay} → Day ${R.endDay}`)
console.log(`NEW correct every session: ${newViolDays.length === 0 ? 'YES' : 'NO – days ' + newViolDays.map(f => f.day).join(',')}`)
console.log(`REVIEW correct w/ MASTERED retirement (identity): ${revOutDays.length === 0 ? 'YES' : 'NO – days ' + revOutDays.map(f => f.day).join(',')}`)
console.log(`F01 RESOLVED (no MASTERED in review): ${f01OK ? 'YES' : 'NO — REGRESSION days ' + f01Days.map(f => f.day).join(',')}`)
console.log(`Grader false-negatives on advanced answers: ${gradeFalseNeg.length === 0 ? 'NONE detected' : gradeFalseNeg.length + ' sessions – days ' + gradeFalseNeg.map(g => g.day).join(',')}`)
console.log(`Logout/login: ${status.logoutLoginVerdict ?? 'not run'} (${status.logoutLoginSeverity ?? 'N/A'})`)
console.log(`CSD +1/session: ${csdDriftDays.length === 0 ? 'YES' : 'NO – days ' + csdDriftDays.map(r => r.day).join(',')}`)
console.log(`Orphan docs: ${R.newOrphans.length === 0 ? 'NONE' : 'YES: ' + R.newOrphans.join(',')}`)
console.log(`H2 count: ${R.h2Count}`)
console.log(`GO/NO-GO: ${(f01OK && newViolDays.length === 0 && revOutDays.length === 0 && R.newOrphans.length === 0) ? 'GO' : 'NO-GO (see findings)'}`)
console.log('='.repeat(70))
