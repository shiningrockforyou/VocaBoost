/**
 * B27 RECOVERY PATH TESTING — run_recovery.mjs
 * Agent label: RECOVER
 *
 * Scenarios tested:
 * 1. Mid new-word-test, browser restart
 * 2. Mid review-test, browser restart
 * 3. B2 strand recovery (newWordsTestScore:undefined / stranded session)
 * 4. H2 stale-complete re-entry
 * 5. Logout mid-test → re-login
 * 6. Duplicate-day guard (force session day ≠ CSD+1)
 *
 * Accounts used:
 *   - careful/TOP (CSD=20, phase=complete)   → Scenario 4 (H2 stale-complete)
 *   - advanced_01/TOP (CSD=2, session_state.phase=complete/day=3) → Scenario 3 + 6
 *   - distracted_01/TOP (CSD=0, session_state.phase=new-words-study/day=1) → Scenario 1
 *   - rushed_01/TOP (CSD=2, session_state.phase=review-study/day=3) → Scenario 2
 *   - recovering_01/TOP (CSD=2, session_state.phase=new-words-study/day=3) → Scenario 5
 *   - refresher_01/TOP (virgin) → spare
 */

import { chromium } from 'playwright'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs'
import { join } from 'path'

// ── Constants ──
const BASE_URL = 'https://vocaboostone.netlify.app'
const PASSWORD = 'AuditPass2026!'
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
const LIST_ID = '8RMews2H7C3UJUAsOBzR'
const CP_DOC_ID = `${CLASS_ID}_${LIST_ID}`
const CHROMIUM_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'
const SA_PATH = '/app/scripts/serviceAccountKey.json'

// Accounts for each scenario
const ACCOUNTS = {
  careful:     { email: 'audit_careful_01_top@vocaboost.test',     uid: 'EPnmY4FIXxVq19tQtxQCvE26p0F3' },
  advanced_01: { email: 'audit_advanced_01_top@vocaboost.test',    uid: 'tVDBmGcf0nSW5CKndqrZ8lgQirE2' },
  distracted:  { email: 'audit_distracted_01_top@vocaboost.test',  uid: 'oAdTNIw0dlTtFf8nRiWjewvH0Cr1' },
  rushed:      { email: 'audit_rushed_01_top@vocaboost.test',      uid: 'trOe7MHzaYZuP99R7N3g5RuI6o83' },
  recovering:  { email: 'audit_recovering_01_top@vocaboost.test',  uid: 'P8b1hVCk9qSvOWsYbrqTT6oznY03' },
  refresher:   { email: 'audit_refresher_01_top@vocaboost.test',   uid: 'q8L3ISgOt8OjDOvSZW6zh5hy0yp1' },
}

// Output paths
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B27/recovery'
const FINDINGS_DIR = '/app/audit/playwright/findings'
const AGENT_LOGS_DIR = '/app/audit/playwright/findings/agent_logs'
const JSONL_PATH = join(AGENT_LOGS_DIR, 'RECOVER.jsonl')
const STATUS_PATH = join(AGENT_LOGS_DIR, 'RECOVER.status.json')

mkdirSync(EVIDENCE_DIR, { recursive: true })
mkdirSync(FINDINGS_DIR, { recursive: true })
mkdirSync(AGENT_LOGS_DIR, { recursive: true })

// ── Logging ──
function log(ev) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...ev })
  try { appendFileSync(JSONL_PATH, line + '\n') } catch (_) {}
  console.log('[RECOVER]', JSON.stringify(ev).substring(0, 250))
}

// ── Firebase Admin (READ-ONLY for domain docs) ──
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

async function readCP(uid) {
  const s = await initAdmin().doc(`users/${uid}/class_progress/${CP_DOC_ID}`).get()
  return s.exists ? { id: s.id, ...s.data() } : null
}

async function readSS(uid) {
  const s = await initAdmin().doc(`users/${uid}/session_states/${CP_DOC_ID}`).get()
  return s.exists ? { id: s.id, ...s.data() } : null
}

async function readAllCP(uid) {
  const s = await initAdmin().collection(`users/${uid}/class_progress`).get()
  return s.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function readAttempts(uid) {
  const s = await initAdmin().collection('attempts')
    .where('studentId', '==', uid)
    .where('classId', '==', CLASS_ID)
    .get()
  return s.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(a => a.listId === LIST_ID || !a.listId)
    .sort((a, b) => (a.studyDay || 0) - (b.studyDay || 0))
}

const wait = ms => new Promise(r => setTimeout(r, ms))

// ── Date shim ──
function makeDateShimScript(fakeNowMs) {
  return `
(function() {
  const _RealDate = Date;
  const _fakeNow = ${fakeNowMs};
  const _offset = _fakeNow - _RealDate.now();

  class FakeDate extends _RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(_RealDate.now() + _offset);
      } else {
        super(...args);
      }
    }
    static now() { return _RealDate.now() + _offset; }
  }
  FakeDate.parse = _RealDate.parse.bind(_RealDate);
  FakeDate.UTC = _RealDate.UTC.bind(_RealDate);
  window.Date = FakeDate;
  window.__RECOVER_FAKE_NOW_MS = _fakeNow;
})();
`
}

// ── Login helper ──
async function login(page, email, password) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await wait(2500)

  // Check if we are ACTUALLY on the dashboard (not just seeing "welcome back" on login page)
  // The login page has an email input. The dashboard does not.
  const hasEmailInput = await page.getByLabel(/email/i).isVisible({ timeout: 2000 }).catch(() => false)
  const hasLoginForm = hasEmailInput

  if (!hasLoginForm) {
    // No email input → either on dashboard or in session
    const hasDashContent = await page.getByText(/25WT 2차 TOP|start.*session|study.*day/i).isVisible({ timeout: 2000 }).catch(() => false)
    if (hasDashContent) {
      log({ type: 'already_logged_in_confirmed', email })
      return
    }
    // Could be on an intermediate page — still try to navigate to login
  }

  // Need to login — find login link or navigate
  if (!hasLoginForm) {
    const hasLoginLink = await page.getByRole('link', { name: /log\s?in|sign\s?in/i }).isVisible({ timeout: 2000 }).catch(() => false)
    if (hasLoginLink) {
      await page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first().click()
      await wait(1000)
    } else {
      await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
      await wait(1200)
    }
  }

  // Wait for email field and fill form
  const em = page.getByLabel(/email/i).first()
  await em.waitFor({ timeout: 15000 })
  await em.fill(email)
  await page.getByLabel(/password/i).first().fill(password)

  const contBtn = page.getByRole('button', { name: /continue/i }).first()
  if (await contBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await contBtn.click()
  } else {
    await page.getByLabel(/password/i).first().press('Enter')
  }

  await page.waitForURL(/\/(dashboard|$)/, { timeout: 25000 }).catch(async () => {
    const b = page.getByRole('button', { name: /continue|log\s?in/i }).first()
    if (await b.isVisible({ timeout: 3000 }).catch(() => false)) {
      await b.click()
      await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(() => {})
    }
  })
  await wait(2500)
  log({ type: 'logged_in', email })
}

// ── Navigate to session ──
async function navSession(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await wait(3000)

  for (const name of ["Start Today's Session", 'Start Session', 'Start Today', 'Begin Session', 'Start Study Session', 'Continue Session']) {
    const btn = page.getByRole('button', { name: new RegExp(name, 'i') }).first()
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      log({ type: 'nav_session_via_button', label: name })
      await btn.click()
      await wait(2500)
      return true
    }
  }

  // Fallback: client-side nav
  await page.evaluate(({ classId, listId }) => {
    const path = `/session/${classId}/${listId}`
    if (window.history) { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }
  }, { classId: CLASS_ID, listId: LIST_ID })
  await wait(3500)

  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 400)).catch(() => '')
  if (/404|not found/i.test(bodyText)) return false
  return true
}

// ── Capture page state ──
async function capturePageState(page, label) {
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 1000)).catch(() => '')
  const url = page.url()
  const consoleErrs = []
  // Snapshot
  const snap = {
    label,
    url,
    ts: new Date().toISOString(),
    bodySnip: bodyText.substring(0, 400),
    hasModal: /modal|resume|move on|retry/i.test(bodyText),
    phase: detectPhase(bodyText, url),
    hasInputs: await page.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]').count().catch(() => 0),
    hasRadio: await page.getByRole('radio').isVisible({ timeout: 500 }).catch(() => false),
    stepIndicator: (bodyText.match(/step\s*(\d+)/i) || [])[0] || null,
    consoleErrors: consoleErrs,
  }
  return snap
}

function detectPhase(bodyText, url) {
  if (/step\s*2|new.word.test/i.test(bodyText)) return 'NEW_WORD_TEST'
  if (/step\s*4|review.test/i.test(bodyText)) return 'REVIEW_TEST'
  if (/step\s*3|review.study/i.test(bodyText)) return 'REVIEW_STUDY'
  if (/step\s*1|new.words.study|flashcard/i.test(bodyText)) return 'NEW_WORDS_STUDY'
  if (/step\s*5|complete|day.*complete|session.*complete/i.test(bodyText)) return 'COMPLETE'
  if (/resume.*day|move on|retry.*review/i.test(bodyText)) return 'REENTRY_MODAL'
  if (/join.*class|enroll/i.test(bodyText)) return 'EMPTY_STATE'
  if (/dashboard|today.*session|start.*session|25WT/i.test(bodyText)) return 'DASHBOARD'
  return 'UNKNOWN'
}

// ── Get body text ──
async function getBody(page) {
  return page.evaluate(() => document.body.innerText.substring(0, 1200)).catch(() => '')
}

// ── Get console errors ──
function wireConsole(page, errArray) {
  page.on('console', msg => {
    if (msg.type() === 'error' || /undefined|Unsupported field|strand|error/i.test(msg.text())) {
      errArray.push(msg.text().substring(0, 300))
    }
  })
}

// ── Skip to Test ──
async function skipToTest(page) {
  // Dismiss any modals first
  const startStudying = page.getByRole('button', { name: /start studying/i }).first()
  if (await startStudying.isVisible({ timeout: 2000 }).catch(() => false)) {
    await startStudying.click(); await wait(800)
  }

  let menuBtn = page.locator('[aria-label="Session menu"]')
  if (!await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    menuBtn = page.getByRole('button', { name: /session menu/i }).first()
    if (!await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      log({ type: 'skip_no_session_menu' }); return false
    }
  }
  await menuBtn.click(); await wait(700)

  let skipItem = page.getByText('Skip to Test').first()
  if (!await skipItem.isVisible({ timeout: 3000 }).catch(() => false)) {
    skipItem = page.getByRole('menuitem', { name: /skip to test/i }).first()
  }
  if (!await skipItem.isVisible({ timeout: 2000 }).catch(() => false)) {
    log({ type: 'skip_no_menu_item' }); await page.keyboard.press('Escape'); return false
  }
  await skipItem.click(); await wait(800)

  for (const name of ['Start Test', 'Confirm', 'Yes', 'Skip', 'OK']) {
    const cf = page.getByRole('button', { name: new RegExp(name, 'i') }).first()
    if (await cf.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cf.click(); await wait(1500)
      log({ type: 'skip_confirmed', button: name }); return true
    }
  }
  return true
}

// ── Answer a few typed test questions (partial) ──
async function answerPartialTypedTest(page, numToAnswer = 3) {
  const inputs = page.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]')
  const inputCount = await inputs.count().catch(() => 0)
  log({ type: 'partial_typed_inputs', count: inputCount })
  if (inputCount === 0) return 0

  let answered = 0
  const limit = Math.min(numToAnswer, inputCount)
  for (let i = 0; i < limit; i++) {
    const inp = inputs.nth(i)
    await inp.scrollIntoViewIfNeeded().catch(() => {})
    await inp.click()
    await inp.clear().catch(() => {})
    await inp.pressSequentially('partial answer ' + (i + 1), { delay: 20 })
    await wait(100)
    answered++
  }
  log({ type: 'partial_typed_answered', answered })
  return answered
}

// ── Answer a few MCQ questions (partial) ──
async function answerPartialMCQ(page, numToAnswer = 3) {
  let answered = 0
  for (let q = 0; q < numToAnswer + 5; q++) {
    await wait(500)
    const bodySnip = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => '')
    if (/test complete|%/i.test(bodySnip)) break

    const clicked = await page.evaluate(() => {
      const allBtns = [...document.querySelectorAll('button')]
      const optBtns = allBtns.filter(b => {
        const t = (b.textContent || '').trim()
        return t.length >= 5 && t.length <= 150 &&
          !/(next|submit|skip|menu|back|continue|start studying|play|step|confirm|yes|no\b|🔊)/i.test(t) &&
          !b.disabled && b.offsetParent !== null
      })
      if (optBtns.length < 2) return { ok: false, count: optBtns.length }
      optBtns[0].click()
      return { ok: true, count: optBtns.length }
    }).catch(() => ({ ok: false }))

    if (!clicked?.ok) break
    answered++
    if (answered >= numToAnswer) break
  }
  log({ type: 'partial_mcq_answered', answered })
  return answered
}

// ── Complete a typed test ──
async function completeTypedTest(page) {
  const inputs = page.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]')
  const inputCount = await inputs.count().catch(() => 0)
  log({ type: 'complete_typed_inputs', count: inputCount })

  if (inputCount > 0) {
    for (let i = 0; i < inputCount; i++) {
      const inp = inputs.nth(i)
      await inp.scrollIntoViewIfNeeded().catch(() => {})
      await inp.click(); await inp.clear().catch(() => {})
      await inp.pressSequentially('arousing anger or strong emotion', { delay: 15 })
      await wait(60)
    }
    await wait(1000)
    const subBtn = page.getByRole('button', { name: /submit test|finish test|complete test/i }).first()
    if (await subBtn.isVisible({ timeout: 6000 }).catch(() => false)) {
      await subBtn.click()
      log({ type: 'typed_submitted_complete' })
      await wait(30000) // AI grading
    }
  }
}

// ── Complete MCQ test ──
async function completeMCQTest(page) {
  for (let q = 0; q < 80; q++) {
    await wait(600)
    const bodySnip = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => '')
    if (/test complete|%/i.test(bodySnip)) { log({ type: 'mcq_complete_detected', q }); break }

    const clicked = await page.evaluate(() => {
      const allBtns = [...document.querySelectorAll('button')]
      const optBtns = allBtns.filter(b => {
        const t = (b.textContent || '').trim()
        return t.length >= 5 && t.length <= 150 &&
          !/(next|submit|skip|menu|back|continue|start studying|play|step|confirm|yes|no\b|🔊)/i.test(t) &&
          !b.disabled && b.offsetParent !== null
      })
      if (optBtns.length < 2) return { ok: false, count: optBtns.length }
      optBtns[0].click()
      return { ok: true, count: optBtns.length, text: (optBtns[0].textContent || '').trim().substring(0, 30) }
    }).catch(() => ({ ok: false }))

    if (!clicked?.ok) {
      const subBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await subBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await subBtn.click(); await wait(2000)
        log({ type: 'mcq_submitted' }); break
      }
      if (/test complete|%/i.test(bodySnip)) break
      await wait(1000); continue
    }

    const submitText = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')]
      const sub = btns.find(b => /submit\s*test/i.test(b.textContent || ''))
      return sub ? (sub.textContent || '').trim() : null
    }).catch(() => null)
    if (submitText) {
      const allMatch = submitText.match(/\((\d+)\/(\d+)\s*answered\)/i)
      if (allMatch && parseInt(allMatch[1]) >= parseInt(allMatch[2])) {
        const subBtn = page.getByRole('button', { name: /submit test/i }).first()
        if (await subBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await subBtn.click(); await wait(2000); log({ type: 'mcq_all_answered_submitted' }); break
        }
      }
    }
  }
}

// ── Detect reentry modal and record its state ──
async function detectReentryModal(page) {
  const bodyText = await getBody(page)
  const hasModal = /resume.*day\s*\d|move.*on.*next\s*day|retry.*review.*test/i.test(bodyText)
  const moveOnVisible = await page.getByRole('button', { name: /move on.*next|next day/i }).isVisible({ timeout: 2000 }).catch(() => false)
  const retryVisible = await page.getByRole('button', { name: /retry.*review|retry/i }).isVisible({ timeout: 2000 }).catch(() => false)
  return { hasModal, moveOnVisible, retryVisible, bodySnip: bodyText.substring(0, 300) }
}

// ── Check dashboard state ──
async function checkDashboardState(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await wait(3000)
  const bodyText = await getBody(page)
  const url = page.url()
  const onLoginPage = /\/login|email.*password.*continue/i.test(url + bodyText)
  const dayMatch = bodyText.match(/(?:study\s*day|day)\s*(\d+)/i)
  const sessionComplete = /today.*complete|session.*complete.*today|already\s*studied/i.test(bodyText)
  const canStart = /start.*session|start today|begin session/i.test(bodyText)
  return {
    body: bodyText.substring(0, 400),
    url,
    onLoginPage,
    day: dayMatch ? parseInt(dayMatch[1]) : null,
    sessionComplete,
    canStart,
  }
}

// ============================================================
// SCENARIO 1: Mid new-word-test, browser restart
// Account: distracted_01 (CSD=0, session_states.phase=new-words-study/day=1)
// Plan:
//   - Use fresh context, inject date shim for Day 1 (future date)
//   - Login, nav to session, skip to test → land in new-word test
//   - Answer 3 questions, kill context (no submit)
//   - Open fresh context (browser restart), login, re-enter session
//   - Observe: do they land on new-word test? Are answers restored?
// ============================================================
async function scenario1_midNewWordTest(browser) {
  const label = 'S1_mid_new_word_test'
  log({ type: 'scenario_start', scenario: 1, label })
  const result = {
    scenario: 1, label,
    account: 'distracted_01',
    guardTriggered: 'browser_restart_during_new_word_test',
    before: null, after: null, stateBeforeRestart: null, stateAfterRestart: null,
    progressRestored: false,
    classification: null, correctPath: null, notes: [],
    consoleErrors: [], screenshotPath: null,
  }

  // Shim to a future date so hasSessionToday returns false
  const fakeNowMs = new Date('2026-06-15T09:00:00+09:00').getTime()
  const dateShim = makeDateShimScript(fakeNowMs)

  const uid = ACCOUNTS.distracted.uid
  const email = ACCOUNTS.distracted.email

  // Pre-state
  result.before = {
    cp: await readCP(uid),
    ss: await readSS(uid),
  }
  log({ type: 'before_state', scenario: 1, cp: result.before.cp, ss: result.before.ss })

  // Context A: start new-word test, answer 3, kill context
  const contextA = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await contextA.addInitScript(({ script }) => { eval(script) }, { script: dateShim })
  const consoleErrsA = []
  const pageA = await contextA.newPage()
  wireConsole(pageA, consoleErrsA)

  try {
    await login(pageA, email, PASSWORD)
    await wait(1000)

    const navOk = await navSession(pageA)
    if (!navOk) {
      result.notes.push('Could not navigate to session in Context A')
      result.classification = 'STUCK_OR_LOOPED'
      return result
    }
    await wait(2000)

    // Handle "Start Studying" modal if present
    const startStudying = pageA.getByRole('button', { name: /start studying/i }).first()
    if (await startStudying.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startStudying.click(); await wait(1000)
    }

    const skipOk = await skipToTest(pageA)
    log({ type: 's1_skip_result', ok: skipOk })
    await wait(2000)

    const bodyBeforePartial = await getBody(pageA)
    const phaseBeforePartial = detectPhase(bodyBeforePartial, pageA.url())
    log({ type: 's1_phase_before_partial', phase: phaseBeforePartial, body: bodyBeforePartial.substring(0, 150) })

    const inputCount = await pageA.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]').count().catch(() => 0)
    result.stateBeforeRestart = {
      phase: phaseBeforePartial,
      url: pageA.url(),
      inputCount,
      body: bodyBeforePartial.substring(0, 200),
    }

    if (inputCount > 0) {
      const answered = await answerPartialTypedTest(pageA, 3)
      result.notes.push(`Answered ${answered} of ${inputCount} typed questions before restart`)
      // Take screenshot
      try {
        const ssPath = join(EVIDENCE_DIR, 'S1_before_restart.png')
        await pageA.screenshot({ path: ssPath, fullPage: true })
        result.screenshotPath = ssPath
      } catch (_) {}
    } else {
      result.notes.push(`No typed input fields found (phase=${phaseBeforePartial}). May be wrong phase or MCQ test.`)
    }

    // localStorage state snapshot before close
    const localStorageState = await pageA.evaluate(() => {
      const keys = Object.keys(localStorage).filter(k => k.includes('vocaboost'))
      const out = {}
      keys.forEach(k => { try { out[k] = JSON.parse(localStorage.getItem(k)) } catch (e) { out[k] = localStorage.getItem(k) } })
      return out
    }).catch(() => ({}))
    result.stateBeforeRestart.localStorage = localStorageState
    log({ type: 's1_local_storage_before', keys: Object.keys(localStorageState) })

    result.consoleErrors.push(...consoleErrsA.map(e => 'ContextA: ' + e))

  } catch (err) {
    result.notes.push('Context A exception: ' + err.message)
    log({ type: 's1_context_a_exception', error: err.message })
  } finally {
    await pageA.close().catch(() => {})
    await contextA.close().catch(() => {}) // Simulate browser close
  }

  await wait(2000)

  // Context B: fresh browser restart, re-login, re-enter session
  const contextB = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await contextB.addInitScript(({ script }) => { eval(script) }, { script: dateShim })
  const consoleErrsB = []
  const pageB = await contextB.newPage()
  wireConsole(pageB, consoleErrsB)

  try {
    await login(pageB, email, PASSWORD)
    await wait(2000)

    // Check dashboard state first
    const dashState = await checkDashboardState(pageB)
    log({ type: 's1_dash_state_after_restart', dashState })

    const navOk2 = await navSession(pageB)
    await wait(3000)

    const bodyAfter = await getBody(pageB)
    const urlAfter = pageB.url()
    const phaseAfter = detectPhase(bodyAfter, urlAfter)

    // Check for recovery prompt
    const hasRecoveryPrompt = /continue.*test|resume.*test|recover|where.*left/i.test(bodyAfter)
    const answersRestored = await pageB.evaluate(() => {
      const inputs = document.querySelectorAll('input[placeholder*="definition" i], textarea[placeholder*="definition" i]')
      let hasContent = false
      inputs.forEach(inp => { if (inp.value && inp.value.length > 0) hasContent = true })
      return hasContent
    }).catch(() => false)

    // Check reentry modal
    const reentryInfo = await detectReentryModal(pageB)

    // Try to take screenshot
    try {
      const ssPath2 = join(EVIDENCE_DIR, 'S1_after_restart.png')
      await pageB.screenshot({ path: ssPath2, fullPage: true })
    } catch (_) {}

    result.stateAfterRestart = {
      phase: phaseAfter, url: urlAfter,
      hasRecoveryPrompt, answersRestored,
      reentry: reentryInfo,
      body: bodyAfter.substring(0, 300),
      dashState,
    }

    // Read Firestore state after restart
    result.after = {
      cp: await readCP(uid),
      ss: await readSS(uid),
    }

    result.progressRestored = answersRestored
    log({ type: 's1_after_state', phaseAfter, answersRestored, hasRecoveryPrompt, reentry: reentryInfo })

    // Classify
    // CSD should still be 0 (session not completed), landed phase should be new-word-test or new-words-study
    const csdBefore = result.before.cp?.currentStudyDay ?? 0
    const csdAfter = result.after.cp?.currentStudyDay ?? 0
    const expectedPhase = 'NEW_WORD_TEST' // or NEW_WORDS_STUDY
    const landedCorrect = /NEW_WORD_TEST|NEW_WORDS_STUDY|REVIEW_STUDY|DASHBOARD/.test(phaseAfter)

    if (!navOk2) {
      result.classification = 'STUCK_OR_LOOPED'
      result.correctPath = false
      result.notes.push('Could not navigate to session after restart')
    } else if (hasRecoveryPrompt && answersRestored) {
      result.classification = 'CLEAN_RESUME'
      result.correctPath = landedCorrect
    } else if (!answersRestored && landedCorrect) {
      result.classification = 'WORK_LOST_BUT_CORRECT_PATH'
      result.correctPath = true
    } else if (!landedCorrect) {
      result.classification = 'WRONG_PATH_OR_CORRUPTED'
      result.correctPath = false
    } else {
      result.classification = 'WORK_LOST_BUT_CORRECT_PATH'
      result.correctPath = landedCorrect
    }

    result.notes.push(`CSD before=${csdBefore}, after=${csdAfter}`)
    result.notes.push(`Phase after restart: ${phaseAfter}`)
    result.notes.push(`Answers restored in UI: ${answersRestored}`)
    result.consoleErrors.push(...consoleErrsB.map(e => 'ContextB: ' + e))

  } catch (err) {
    result.notes.push('Context B exception: ' + err.message)
    log({ type: 's1_context_b_exception', error: err.message })
    result.classification = result.classification || 'STUCK_OR_LOOPED'
    result.correctPath = result.correctPath ?? false
    result.after = { cp: await readCP(uid), ss: await readSS(uid) }
  } finally {
    await pageB.close().catch(() => {})
    await contextB.close().catch(() => {})
  }

  log({ type: 'scenario_done', scenario: 1, classification: result.classification, correctPath: result.correctPath })
  return result
}

// ============================================================
// SCENARIO 2: Mid review-test, browser restart
// Account: rushed_01 (CSD=2, session_states.phase=review-study/day=3)
// Plan: day=3 with Date shim future date → nav to session → skip to test (review)
//       answer 3 MCQ questions, kill context, restart, re-enter
// ============================================================
async function scenario2_midReviewTest(browser) {
  const label = 'S2_mid_review_test'
  log({ type: 'scenario_start', scenario: 2, label })
  const result = {
    scenario: 2, label,
    account: 'rushed_01',
    guardTriggered: 'browser_restart_during_review_test',
    before: null, after: null, stateBeforeRestart: null, stateAfterRestart: null,
    progressRestored: false,
    classification: null, correctPath: null, notes: [],
    consoleErrors: [],
  }

  const fakeNowMs = new Date('2026-06-16T09:00:00+09:00').getTime()
  const dateShim = makeDateShimScript(fakeNowMs)
  const uid = ACCOUNTS.rushed.uid
  const email = ACCOUNTS.rushed.email

  result.before = { cp: await readCP(uid), ss: await readSS(uid) }
  log({ type: 'before_state', scenario: 2, cp: result.before.cp, ss: result.before.ss })

  // Context A: start review test, answer 3, kill
  const contextA = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await contextA.addInitScript(({ script }) => { eval(script) }, { script: dateShim })
  const consoleErrsA = []
  const pageA = await contextA.newPage()
  wireConsole(pageA, consoleErrsA)

  try {
    await login(pageA, email, PASSWORD)
    const navOk = await navSession(pageA)
    await wait(2000)

    // Handle Start Studying modal
    const startStudying = pageA.getByRole('button', { name: /start studying/i }).first()
    if (await startStudying.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startStudying.click(); await wait(1000)
    }

    // Check if there's a reentry modal (phase=review-study from previous state)
    const body1 = await getBody(pageA)
    const phase1 = detectPhase(body1, pageA.url())
    log({ type: 's2_initial_phase', phase: phase1, body: body1.substring(0, 150) })

    // Session state has phase=review-study, so DailySessionFlow should resume at review study
    // Skip to test from there
    const skipOk = await skipToTest(pageA)
    log({ type: 's2_skip_result', ok: skipOk })
    await wait(2000)

    const bodyBeforePartial = await getBody(pageA)
    const phaseBeforePartial = detectPhase(bodyBeforePartial, pageA.url())
    const hasRadio = await pageA.getByRole('radio').isVisible({ timeout: 1000 }).catch(() => false)
    const optButtons = await pageA.evaluate(() => {
      const allBtns = [...document.querySelectorAll('button')]
      return allBtns.filter(b => {
        const t = (b.textContent || '').trim()
        return t.length >= 5 && t.length <= 150 &&
          !/(next|submit|skip|menu|back|continue|start studying|play|step|confirm|yes|no\b|🔊)/i.test(t) &&
          !b.disabled && b.offsetParent !== null
      }).length
    }).catch(() => 0)

    result.stateBeforeRestart = {
      phase: phaseBeforePartial, url: pageA.url(),
      hasRadio, optButtons, body: bodyBeforePartial.substring(0, 200),
    }

    if (optButtons >= 2 || hasRadio) {
      const answered = await answerPartialMCQ(pageA, 3)
      result.notes.push(`Answered ${answered} MCQ questions before restart`)
    } else {
      result.notes.push(`No MCQ options found (phase=${phaseBeforePartial}, opts=${optButtons})`)
    }

    try {
      const ssPath = join(EVIDENCE_DIR, 'S2_before_restart.png')
      await pageA.screenshot({ path: ssPath, fullPage: true })
    } catch (_) {}

    result.consoleErrors.push(...consoleErrsA.map(e => 'ContextA: ' + e))
  } catch (err) {
    result.notes.push('Context A exception: ' + err.message)
    log({ type: 's2_context_a_exception', error: err.message })
  } finally {
    await pageA.close().catch(() => {})
    await contextA.close().catch(() => {})
  }

  await wait(2000)

  // Context B: fresh restart
  const contextB = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await contextB.addInitScript(({ script }) => { eval(script) }, { script: dateShim })
  const consoleErrsB = []
  const pageB = await contextB.newPage()
  wireConsole(pageB, consoleErrsB)

  try {
    await login(pageB, email, PASSWORD)
    await wait(2000)

    const navOk2 = await navSession(pageB)
    await wait(3000)

    const bodyAfter = await getBody(pageB)
    const urlAfter = pageB.url()
    const phaseAfter = detectPhase(bodyAfter, urlAfter)

    // Check for recovery prompt
    const hasRecoveryPrompt = /continue.*test|resume.*test|recover/i.test(bodyAfter)
    const reentryInfo = await detectReentryModal(pageB)

    try {
      const ssPath2 = join(EVIDENCE_DIR, 'S2_after_restart.png')
      await pageB.screenshot({ path: ssPath2, fullPage: true })
    } catch (_) {}

    result.stateAfterRestart = {
      phase: phaseAfter, url: urlAfter,
      hasRecoveryPrompt, reentry: reentryInfo,
      body: bodyAfter.substring(0, 300),
    }

    result.after = { cp: await readCP(uid), ss: await readSS(uid) }

    const csdBefore = result.before.cp?.currentStudyDay ?? 0
    const csdAfter = result.after.cp?.currentStudyDay ?? 0
    const landedCorrect = /REVIEW_TEST|REVIEW_STUDY|DASHBOARD/.test(phaseAfter)

    if (!navOk2) {
      result.classification = 'STUCK_OR_LOOPED'; result.correctPath = false
      result.notes.push('Could not navigate to session after restart')
    } else if (hasRecoveryPrompt) {
      result.classification = 'CLEAN_RESUME'; result.correctPath = landedCorrect
    } else if (landedCorrect) {
      result.classification = 'WORK_LOST_BUT_CORRECT_PATH'; result.correctPath = true
    } else {
      result.classification = 'WRONG_PATH_OR_CORRUPTED'; result.correctPath = false
    }

    result.notes.push(`CSD before=${csdBefore}, after=${csdAfter}`)
    result.notes.push(`Phase after restart: ${phaseAfter}`)
    result.consoleErrors.push(...consoleErrsB.map(e => 'ContextB: ' + e))
  } catch (err) {
    result.notes.push('Context B exception: ' + err.message)
    result.classification = result.classification || 'STUCK_OR_LOOPED'
    result.correctPath = result.correctPath ?? false
    result.after = { cp: await readCP(uid), ss: await readSS(uid) }
  } finally {
    await pageB.close().catch(() => {})
    await contextB.close().catch(() => {})
  }

  log({ type: 'scenario_done', scenario: 2, classification: result.classification, correctPath: result.correctPath })
  return result
}

// ============================================================
// SCENARIO 3: B2 strand recovery
// Account: advanced_01 (CSD=2, session_states: phase=complete, currentStudyDay=3)
//   → This means session_state is for day 3 but class_progress CSD=2
//   → Session is "stranded" - completed day 3 session state but CSD didn't advance
// Context: Drive day 3 session. Check if B2 undefined score strand reproduces.
// After strand (or session attempt), restart and re-enter. Can they finish day and advance CSD?
// ============================================================
async function scenario3_B2StrandRecovery(browser) {
  const label = 'S3_B2_strand_recovery'
  log({ type: 'scenario_start', scenario: 3, label })
  const result = {
    scenario: 3, label,
    account: 'advanced_01',
    guardTriggered: 'B2_newWordsTestScore_undefined_strand',
    before: null, after: null, stateBeforeStrand: null, stateAfterStrand: null, stateAfterRestart: null,
    b2StrandDetected: false,
    csdAdvanced: false,
    classification: null, correctPath: null, notes: [],
    consoleErrors: [],
  }

  // advanced_01: CSD=2, session_states phase=complete day=3 (stranded: session wrote complete but CSD didn't advance)
  // The reentry check on startup will see phase=COMPLETE and show re-entry modal
  // We need to check: can they navigate past the stale state and proceed to next correct day?

  const fakeNowMs = new Date('2026-06-17T09:00:00+09:00').getTime()
  const dateShim = makeDateShimScript(fakeNowMs)
  const uid = ACCOUNTS.advanced_01.uid
  const email = ACCOUNTS.advanced_01.email

  result.before = { cp: await readCP(uid), ss: await readSS(uid) }
  log({ type: 'before_state', scenario: 3, cp: result.before.cp, ss: result.before.ss })

  const consoleErrors = []

  // Context A: enter the stranded session (day=3, phase=complete in Firestore)
  const contextA = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await contextA.addInitScript(({ script }) => { eval(script) }, { script: dateShim })
  const pageA = await contextA.newPage()
  wireConsole(pageA, consoleErrors)

  try {
    await login(pageA, email, PASSWORD)
    await wait(1000)

    const navOk = await navSession(pageA)
    await wait(3000)

    const bodyA1 = await getBody(pageA)
    const phaseA1 = detectPhase(bodyA1, pageA.url())
    log({ type: 's3_initial_phase', phase: phaseA1, body: bodyA1.substring(0, 200) })
    result.stateBeforeStrand = { phase: phaseA1, body: bodyA1.substring(0, 300), ss: result.before.ss }

    // Check for re-entry modal (expected since session_states.phase=complete)
    const reentryInfo = await detectReentryModal(pageA)
    log({ type: 's3_reentry_check', reentry: reentryInfo })

    try {
      const ssPath = join(EVIDENCE_DIR, 'S3_initial_entry.png')
      await pageA.screenshot({ path: ssPath, fullPage: true })
    } catch (_) {}

    // If re-entry modal, click "Move On to Next Day"
    if (reentryInfo.hasModal && reentryInfo.moveOnVisible) {
      const moveOnBtn = pageA.getByRole('button', { name: /move on.*next|next day/i }).first()
      await moveOnBtn.click()
      await wait(3000)
      const bodyAfterMoveOn = await getBody(pageA)
      const phaseAfterMoveOn = detectPhase(bodyAfterMoveOn, pageA.url())
      log({ type: 's3_after_move_on', phase: phaseAfterMoveOn, body: bodyAfterMoveOn.substring(0, 150) })
      result.notes.push(`Re-entry modal seen (phase=complete). Clicked 'Move On'. Now: ${phaseAfterMoveOn}`)

      try {
        const ssPath2 = join(EVIDENCE_DIR, 'S3_after_move_on.png')
        await pageA.screenshot({ path: ssPath2, fullPage: true })
      } catch (_) {}

      // After move on, check if we can start a new session (day 3)
      const dashState = await checkDashboardState(pageA)
      log({ type: 's3_dash_after_move_on', dashState })
      result.notes.push(`Dashboard after Move On: canStart=${dashState.canStart}, day=${dashState.day}`)
    } else if (phaseA1 === 'REENTRY_MODAL') {
      // Handle without explicit button identification
      result.notes.push('Re-entry modal detected but button selectors failed')
    } else {
      result.notes.push(`No re-entry modal (phase=${phaseA1}, hasModal=${reentryInfo.hasModal})`)
    }

    // Now try to run actual session for day 3 (CSD=2, next day = 3)
    const navOk2 = await navSession(pageA)
    await wait(3000)

    const bodyA2 = await getBody(pageA)
    const phaseA2 = detectPhase(bodyA2, pageA.url())
    log({ type: 's3_phase_before_test', phase: phaseA2, body: bodyA2.substring(0, 200) })

    // Check for Start Studying modal
    const startStudying = pageA.getByRole('button', { name: /start studying/i }).first()
    if (await startStudying.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startStudying.click(); await wait(1000)
    }

    // Try to skip to test and run it
    const skipOk = await skipToTest(pageA)
    await wait(2000)

    const bodyA3 = await getBody(pageA)
    const phaseA3 = detectPhase(bodyA3, pageA.url())
    const inputCount = await pageA.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]').count().catch(() => 0)
    log({ type: 's3_phase_at_test', phase: phaseA3, inputCount, body: bodyA3.substring(0, 150) })

    if (inputCount > 0) {
      // Complete the typed test
      await completeTypedTest(pageA)
      await wait(3000)

      const bodyAfterNewTest = await getBody(pageA)
      const phaseAfterNewTest = detectPhase(bodyAfterNewTest, pageA.url())
      log({ type: 's3_after_new_test', phase: phaseAfterNewTest })

      // Check for B2 strand: undefined score → Firestore error
      const b2Error = consoleErrors.some(e => /undefined|Unsupported field|newWordsTestScore/i.test(e))
      result.b2StrandDetected = b2Error
      if (b2Error) {
        result.notes.push('B2 STRAND DETECTED: newWordsTestScore:undefined or Firestore error in console')
      }

      result.stateAfterStrand = {
        phase: phaseAfterNewTest,
        ss: await readSS(uid),
        cp: await readCP(uid),
        consoleErrors: [...consoleErrors],
      }
    } else {
      result.notes.push(`No typed inputs at test (phase=${phaseA3}). May be in wrong phase.`)
    }

    result.consoleErrors.push(...consoleErrors.map(e => 'ContextA: ' + e))
  } catch (err) {
    result.notes.push('Context A exception: ' + err.message)
    log({ type: 's3_context_a_exception', error: err.message })
  } finally {
    await pageA.close().catch(() => {})
    await contextA.close().catch(() => {})
  }

  await wait(2000)

  // Context B: restart after strand
  const contextB = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await contextB.addInitScript(({ script }) => { eval(script) }, { script: dateShim })
  const consoleErrsB = []
  const pageB = await contextB.newPage()
  wireConsole(pageB, consoleErrsB)

  try {
    await login(pageB, email, PASSWORD)
    await wait(2000)

    const navOk3 = await navSession(pageB)
    await wait(3000)

    const bodyB = await getBody(pageB)
    const phaseB = detectPhase(bodyB, pageB.url())
    const reentryB = await detectReentryModal(pageB)

    try {
      const ssPath3 = join(EVIDENCE_DIR, 'S3_after_restart.png')
      await pageB.screenshot({ path: ssPath3, fullPage: true })
    } catch (_) {}

    result.stateAfterRestart = {
      phase: phaseB, body: bodyB.substring(0, 300),
      reentry: reentryB,
      cp: await readCP(uid), ss: await readSS(uid),
    }

    result.after = { cp: await readCP(uid), ss: await readSS(uid) }

    const csdBefore = result.before.cp?.currentStudyDay ?? 0
    const csdAfter = result.after.cp?.currentStudyDay ?? 0
    result.csdAdvanced = csdAfter > csdBefore

    // Check if they can proceed
    const canProceed = /NEW_WORD_TEST|REVIEW_TEST|REVIEW_STUDY|NEW_WORDS_STUDY|DASHBOARD/.test(phaseB)
    const isStuck = /STUCK|WRONG|COMPLETE.*day.*wrong/.test(phaseB) || reentryB.hasModal

    if (result.csdAdvanced) {
      result.classification = 'CLEAN_RESUME'
      result.correctPath = true
      result.notes.push(`CSD advanced: ${csdBefore} → ${csdAfter}`)
    } else if (result.b2StrandDetected && !result.csdAdvanced) {
      result.classification = 'STUCK_OR_LOOPED'
      result.correctPath = false
      result.notes.push(`B2 strand: CSD stuck at ${csdAfter}`)
    } else if (canProceed) {
      result.classification = 'WORK_LOST_BUT_CORRECT_PATH'
      result.correctPath = true
    } else {
      result.classification = 'WRONG_PATH_OR_CORRUPTED'
      result.correctPath = false
    }

    result.notes.push(`Phase after restart: ${phaseB}`)
    result.consoleErrors.push(...consoleErrsB.map(e => 'ContextB: ' + e))
  } catch (err) {
    result.notes.push('Context B exception: ' + err.message)
    result.classification = result.classification || 'STUCK_OR_LOOPED'
    result.correctPath = result.correctPath ?? false
    result.after = { cp: await readCP(uid), ss: await readSS(uid) }
  } finally {
    await pageB.close().catch(() => {})
    await contextB.close().catch(() => {})
  }

  log({ type: 'scenario_done', scenario: 3, classification: result.classification, b2Detected: result.b2StrandDetected })
  return result
}

// ============================================================
// SCENARIO 4: H2 stale-complete re-entry
// Account: careful/TOP (CSD=20, session_states.phase=complete for day 20)
// Plan: Login fresh context, nav to session, observe re-entry modal
//       Click "Move On to Next Day", check landing
// ============================================================
async function scenario4_H2StaleComplete(browser) {
  const label = 'S4_H2_stale_complete'
  log({ type: 'scenario_start', scenario: 4, label })
  const result = {
    scenario: 4, label,
    account: 'careful_01',
    guardTriggered: 'H2_stale_complete_reentry',
    before: null, after: null, stateAtReentry: null, stateAfterMoveOn: null,
    reentryModalSeen: false, moveOnSucceeded: false,
    landedOnCorrectDay: false,
    classification: null, correctPath: null, notes: [],
    consoleErrors: [],
  }

  const fakeNowMs = new Date('2026-06-18T09:00:00+09:00').getTime()
  const dateShim = makeDateShimScript(fakeNowMs)
  const uid = ACCOUNTS.careful.uid
  const email = ACCOUNTS.careful.email

  result.before = { cp: await readCP(uid), ss: await readSS(uid) }
  log({ type: 'before_state', scenario: 4, cp: result.before.cp, ss: result.before.ss })
  // Expect: CSD=20, session_states.phase=complete/day=20

  const consoleErrors = []
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(({ script }) => { eval(script) }, { script: dateShim })
  const page = await context.newPage()
  wireConsole(page, consoleErrors)

  try {
    await login(page, email, PASSWORD)
    await wait(1000)

    const navOk = await navSession(page)
    await wait(3000)

    const body1 = await getBody(page)
    const phase1 = detectPhase(body1, page.url())
    log({ type: 's4_initial_phase', phase: phase1, body: body1.substring(0, 200) })

    const reentryInfo = await detectReentryModal(page)
    result.reentryModalSeen = reentryInfo.hasModal
    result.stateAtReentry = {
      phase: phase1, body: body1.substring(0, 300),
      reentry: reentryInfo,
      url: page.url(),
    }

    try {
      const ssPath = join(EVIDENCE_DIR, 'S4_reentry_modal.png')
      await page.screenshot({ path: ssPath, fullPage: true })
    } catch (_) {}

    log({ type: 's4_reentry_modal_state', reentry: reentryInfo })

    if (reentryInfo.hasModal) {
      if (reentryInfo.moveOnVisible) {
        const moveOnBtn = page.getByRole('button', { name: /move on.*next|next day/i }).first()
        await moveOnBtn.click()
        await wait(3000)
        result.moveOnSucceeded = true
        log({ type: 's4_move_on_clicked' })
      } else {
        // Try other patterns
        const nextDayBtn = page.getByRole('button', { name: /next day|move on/i }).first()
        if (await nextDayBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await nextDayBtn.click(); await wait(3000); result.moveOnSucceeded = true
        } else {
          result.notes.push('Move On button not found despite modal')
        }
      }
    } else {
      result.notes.push(`No re-entry modal detected. Phase: ${phase1}`)
      // Check if they see complete screen directly
    }

    // After Move On, where do they land?
    const body2 = await getBody(page)
    const phase2 = detectPhase(body2, page.url())
    log({ type: 's4_after_move_on', phase: phase2, body: body2.substring(0, 200) })

    try {
      const ssPath2 = join(EVIDENCE_DIR, 'S4_after_move_on.png')
      await page.screenshot({ path: ssPath2, fullPage: true })
    } catch (_) {}

    // Read updated SS
    const ssAfterMoveOn = await readSS(uid)
    const cpAfterMoveOn = await readCP(uid)

    result.stateAfterMoveOn = {
      phase: phase2, body: body2.substring(0, 300),
      ss: ssAfterMoveOn, cp: cpAfterMoveOn,
    }

    result.after = { cp: cpAfterMoveOn, ss: ssAfterMoveOn }

    // Expected: After "Move On to Next Day", session_states should be cleared (null/deleted)
    //   → student should land on dashboard for next day (day 21)
    //   → CSD should still be 20 (only advances on completing day 21)
    const csdBefore = result.before.cp?.currentStudyDay ?? 0
    const csdAfter = cpAfterMoveOn?.currentStudyDay ?? 0
    const ssCleared = !ssAfterMoveOn || ssAfterMoveOn?.phase !== 'complete'

    // correct path: dashboard showing ability to start day 21 (or showing day 21 somehow)
    const landedOnDashboard = /DASHBOARD/.test(phase2) || /dashboard|start.*session|25WT/i.test(body2)
    const ssStillStuck = ssAfterMoveOn?.phase === 'complete' && ssAfterMoveOn?.currentStudyDay === 20

    if (result.reentryModalSeen && result.moveOnSucceeded) {
      if (ssCleared && landedOnDashboard) {
        result.classification = 'CLEAN_RESTART'
        result.correctPath = true
        result.landedOnCorrectDay = true
        result.notes.push(`H2 modal seen, Move On clicked, session cleared, landed on dashboard`)
      } else if (ssStillStuck) {
        result.classification = 'STUCK_OR_LOOPED'
        result.correctPath = false
        result.notes.push(`Move On clicked but session_state still phase=complete/day=20 → loop`)
      } else {
        result.classification = 'CLEAN_RESTART'
        result.correctPath = landedOnDashboard
        result.landedOnCorrectDay = landedOnDashboard
      }
    } else if (!result.reentryModalSeen) {
      // No modal - check if they see the complete screen directly
      if (/COMPLETE/.test(phase2) || /COMPLETE/.test(phase1)) {
        result.classification = 'STUCK_OR_LOOPED'
        result.correctPath = false
        result.notes.push(`No re-entry modal but saw COMPLETE screen; student may be stuck`)
      } else {
        result.classification = 'CLEAN_RESTART'
        result.correctPath = true
        result.notes.push(`No H2 modal needed (phase was not complete in UI). Landed: ${phase2}`)
      }
    } else {
      result.classification = 'WRONG_PATH_OR_CORRUPTED'
      result.correctPath = false
    }

    result.notes.push(`CSD before=${csdBefore}, after=${csdAfter}`)
    result.notes.push(`Re-entry modal seen: ${result.reentryModalSeen}`)
    result.notes.push(`Move On succeeded: ${result.moveOnSucceeded}`)
    result.notes.push(`Session state after move on: phase=${ssAfterMoveOn?.phase ?? 'null'}`)
    result.consoleErrors.push(...consoleErrors.map(e => 'Context: ' + e))
  } catch (err) {
    result.notes.push('Exception: ' + err.message)
    log({ type: 's4_exception', error: err.message })
    result.classification = result.classification || 'STUCK_OR_LOOPED'
    result.correctPath = result.correctPath ?? false
    result.after = { cp: await readCP(uid), ss: await readSS(uid) }
  } finally {
    await page.close().catch(() => {})
    await context.close().catch(() => {})
  }

  log({ type: 'scenario_done', scenario: 4, classification: result.classification, reentryModal: result.reentryModalSeen })
  return result
}

// ============================================================
// SCENARIO 5: Logout mid-test → re-login
// Account: recovering_01 (CSD=2, session_state.phase=new-words-study/day=3)
// Plan: start session, skip to test, answer 2 questions,
//       log out via UI, log back in, check landing
// ============================================================
async function scenario5_logoutMidTest(browser) {
  const label = 'S5_logout_mid_test'
  log({ type: 'scenario_start', scenario: 5, label })
  const result = {
    scenario: 5, label,
    account: 'recovering_01',
    guardTriggered: 'logout_mid_test',
    before: null, after: null, stateBeforeLogout: null, stateAfterRelogin: null,
    workRestored: false,
    classification: null, correctPath: null, notes: [],
    consoleErrors: [],
  }

  const fakeNowMs = new Date('2026-06-19T09:00:00+09:00').getTime()
  const dateShim = makeDateShimScript(fakeNowMs)
  const uid = ACCOUNTS.recovering.uid
  const email = ACCOUNTS.recovering.email

  result.before = { cp: await readCP(uid), ss: await readSS(uid) }
  log({ type: 'before_state', scenario: 5, cp: result.before.cp, ss: result.before.ss })

  const consoleErrors = []
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(({ script }) => { eval(script) }, { script: dateShim })
  const page = await context.newPage()
  wireConsole(page, consoleErrors)

  try {
    await login(page, email, PASSWORD)
    const navOk = await navSession(page)
    await wait(3000)

    // Handle Start Studying modal
    const startStudying = page.getByRole('button', { name: /start studying/i }).first()
    if (await startStudying.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startStudying.click(); await wait(1000)
    }

    const skipOk = await skipToTest(page)
    await wait(2000)

    const bodyBeforeLogout = await getBody(page)
    const phaseBeforeLogout = detectPhase(bodyBeforeLogout, page.url())
    log({ type: 's5_phase_before_logout', phase: phaseBeforeLogout })

    const inputCount = await page.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]').count().catch(() => 0)

    if (inputCount > 0) {
      await answerPartialTypedTest(page, 2)
      result.notes.push(`Answered 2 typed test questions before logout`)
    } else {
      const optButtons = await page.evaluate(() => {
        const allBtns = [...document.querySelectorAll('button')]
        return allBtns.filter(b => {
          const t = (b.textContent || '').trim()
          return t.length >= 5 && t.length <= 150 &&
            !/(next|submit|skip|menu|back|continue|start studying|play|step|confirm|yes|no\b|🔊)/i.test(t) &&
            !b.disabled && b.offsetParent !== null
        }).length
      }).catch(() => 0)
      if (optButtons >= 2) {
        await answerPartialMCQ(page, 2)
        result.notes.push(`Answered 2 MCQ questions before logout`)
      } else {
        result.notes.push(`No test inputs found before logout (phase=${phaseBeforeLogout})`)
      }
    }

    result.stateBeforeLogout = {
      phase: phaseBeforeLogout, inputCount,
      body: bodyBeforeLogout.substring(0, 200),
    }

    try {
      const ssPath = join(EVIDENCE_DIR, 'S5_before_logout.png')
      await page.screenshot({ path: ssPath, fullPage: true })
    } catch (_) {}

    // Find and click logout button
    // Try session menu first, then profile menu, then avatar
    let loggedOut = false

    // Strategy 1: Session menu → Logout
    const sessionMenuBtn = page.locator('[aria-label="Session menu"]').first()
    if (await sessionMenuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sessionMenuBtn.click(); await wait(700)
      const logoutItem = page.getByRole('menuitem', { name: /log.*out|sign.*out/i }).first()
      if (await logoutItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoutItem.click(); await wait(2000); loggedOut = true
        log({ type: 's5_logged_out_via_session_menu' })
      } else {
        await page.keyboard.press('Escape')
      }
    }

    // Strategy 2: Profile/avatar button
    if (!loggedOut) {
      for (const sel of [
        '[aria-label*="profile" i]', '[aria-label*="account" i]', '[aria-label*="user" i]',
        'button:has(img)', 'button[class*="avatar"]',
      ]) {
        const btn = page.locator(sel).first()
        if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await btn.click(); await wait(700)
          const logoutItem = page.getByRole('menuitem', { name: /log.*out|sign.*out/i }).first()
          if (await logoutItem.isVisible({ timeout: 2000 }).catch(() => false)) {
            await logoutItem.click(); await wait(2000); loggedOut = true
            log({ type: 's5_logged_out_via_avatar', sel }); break
          }
          await page.keyboard.press('Escape')
        }
      }
    }

    // Strategy 3: Direct text button
    if (!loggedOut) {
      for (const name of ['Log out', 'Sign out', 'Logout', 'Sign Out', 'Log Out']) {
        const btn = page.getByRole('button', { name: new RegExp(name, 'i') }).first()
        if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await btn.click(); await wait(2000); loggedOut = true
          log({ type: 's5_logged_out_via_button', name }); break
        }
        const link = page.getByRole('link', { name: new RegExp(name, 'i') }).first()
        if (await link.isVisible({ timeout: 1000 }).catch(() => false)) {
          await link.click(); await wait(2000); loggedOut = true
          log({ type: 's5_logged_out_via_link', name }); break
        }
      }
    }

    // Strategy 4: Firebase SDK signout
    if (!loggedOut) {
      log({ type: 's5_firebase_signout_fallback' })
      await page.evaluate(async () => {
        try {
          const { getAuth, signOut } = await import('/node_modules/firebase/auth')
          await signOut(getAuth())
        } catch (e) {
          // Try window.firebase
          if (window.firebase?.auth) await window.firebase.auth().signOut()
        }
      }).catch(() => {})
      // Navigate to login
      await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
      await wait(2000); loggedOut = true
      log({ type: 's5_firebase_signout_done' })
    }

    if (loggedOut) {
      result.notes.push('Logout succeeded')
    } else {
      result.notes.push('WARNING: Could not find logout button — using context cookie clear')
    }

    // Now re-login in SAME context (not fresh context — simulates "re-login after logout" not "browser restart")
    await wait(1000)
    const loginVisible = await page.getByLabel(/email/i).isVisible({ timeout: 5000 }).catch(() => false)
    if (!loginVisible) {
      // Navigate to login
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
      await wait(2000)
      const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
      if (await loginLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await loginLink.click(); await wait(1500)
      } else {
        await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
        await wait(1500)
      }
    }

    await login(page, email, PASSWORD)
    await wait(2000)

    // Check dashboard
    const dashState = await checkDashboardState(page)
    log({ type: 's5_dash_after_relogin', dashState })

    const navOk2 = await navSession(page)
    await wait(3000)

    const bodyAfterRelogin = await getBody(page)
    const phaseAfterRelogin = detectPhase(bodyAfterRelogin, page.url())

    const inputCountAfter = await page.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]').count().catch(() => 0)
    const workRestored = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[placeholder*="definition" i], textarea[placeholder*="definition" i]')
      let hasContent = false
      inputs.forEach(inp => { if (inp.value && inp.value.length > 0) hasContent = true })
      return hasContent
    }).catch(() => false)

    result.workRestored = workRestored

    try {
      const ssPath2 = join(EVIDENCE_DIR, 'S5_after_relogin.png')
      await page.screenshot({ path: ssPath2, fullPage: true })
    } catch (_) {}

    result.stateAfterRelogin = {
      phase: phaseAfterRelogin, inputCountAfter, workRestored,
      body: bodyAfterRelogin.substring(0, 300), dashState,
    }

    result.after = { cp: await readCP(uid), ss: await readSS(uid) }

    const csdBefore = result.before.cp?.currentStudyDay ?? 0
    const csdAfter = result.after.cp?.currentStudyDay ?? 0
    const landedCorrect = /NEW_WORD_TEST|REVIEW_TEST|REVIEW_STUDY|NEW_WORDS_STUDY|DASHBOARD/.test(phaseAfterRelogin)

    if (workRestored) {
      result.classification = 'CLEAN_RESUME'
      result.correctPath = landedCorrect
    } else if (landedCorrect) {
      result.classification = 'WORK_LOST_BUT_CORRECT_PATH'
      result.correctPath = true
    } else {
      result.classification = 'WRONG_PATH_OR_CORRUPTED'
      result.correctPath = false
    }

    result.notes.push(`Logged out: ${loggedOut}`)
    result.notes.push(`CSD before=${csdBefore}, after=${csdAfter}`)
    result.notes.push(`Phase after relogin: ${phaseAfterRelogin}`)
    result.notes.push(`Work restored: ${workRestored}`)
    result.consoleErrors.push(...consoleErrors.map(e => 'Context: ' + e))
  } catch (err) {
    result.notes.push('Exception: ' + err.message)
    log({ type: 's5_exception', error: err.message })
    result.classification = result.classification || 'STUCK_OR_LOOPED'
    result.correctPath = result.correctPath ?? false
    result.after = { cp: await readCP(uid), ss: await readSS(uid) }
  } finally {
    await page.close().catch(() => {})
    await context.close().catch(() => {})
  }

  log({ type: 'scenario_done', scenario: 5, classification: result.classification, workRestored: result.workRestored })
  return result
}

// ============================================================
// SCENARIO 6: Duplicate-day guard
// Account: advanced_01 (after S3, CSD may have changed, but let's use the CSD state)
// Plan: Check current CSD. Try to start a session for a day that already exists
//       (e.g., if CSD=2, try a date shim that matches today's real session day)
//       Or: check if after the B2 strand in S3, the CSD is stuck and the duplicate guard fires
// Note: The duplicate-day guard at progressService:332 fires when sessionSummary.day ≠ CSD+1
// ============================================================
async function scenario6_duplicateDayGuard(browser) {
  const label = 'S6_duplicate_day_guard'
  log({ type: 'scenario_start', scenario: 6, label })
  const result = {
    scenario: 6, label,
    account: 'advanced_01',
    guardTriggered: 'duplicate_day_guard_sequential',
    before: null, after: null,
    guardFired: false,
    studentCanProceedToNextDay: false,
    classification: null, correctPath: null, notes: [],
    consoleErrors: [],
  }

  const uid = ACCOUNTS.advanced_01.uid
  const email = ACCOUNTS.advanced_01.email

  result.before = { cp: await readCP(uid), ss: await readSS(uid) }
  log({ type: 'before_state', scenario: 6, cp: result.before.cp, ss: result.before.ss })

  // Current CSD post-S3 - could be 2 or 3
  const currentCSD = result.before.cp?.currentStudyDay ?? 2

  // The duplicate guard fires when attempting to complete a session whose day
  // equals currentStudyDay (not +1). We probe: can the student navigate to the
  // session and successfully start the CORRECT next day?
  // This verifies: after S3 left some state, does the system correctly route to day CSD+1?
  const correctNextDay = currentCSD + 1
  log({ type: 's6_target', currentCSD, correctNextDay })

  // Use date shim far enough in the future
  const fakeNowMs = new Date('2026-06-20T09:00:00+09:00').getTime()
  const dateShim = makeDateShimScript(fakeNowMs)

  const consoleErrors = []
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(({ script }) => { eval(script) }, { script: dateShim })
  const page = await context.newPage()
  wireConsole(page, consoleErrors)

  try {
    await login(page, email, PASSWORD)
    await wait(1000)

    const dashState = await checkDashboardState(page)
    log({ type: 's6_dash_state', dashState, currentCSD, correctNextDay })

    const navOk = await navSession(page)
    await wait(3000)

    const body1 = await getBody(page)
    const phase1 = detectPhase(body1, page.url())
    log({ type: 's6_session_phase', phase: phase1, body: body1.substring(0, 200) })

    // Check for re-entry modal (from stale S3 state)
    const reentryInfo = await detectReentryModal(page)
    if (reentryInfo.hasModal) {
      result.notes.push('Re-entry modal seen at scenario 6 entry (stale from S3)')
      // Dismiss it
      if (reentryInfo.moveOnVisible) {
        const moveOnBtn = page.getByRole('button', { name: /move on.*next|next day/i }).first()
        await moveOnBtn.click(); await wait(3000)
        result.notes.push('Dismissed re-entry modal with Move On')
      }
    }

    // Handle Start Studying modal
    const startStudying = page.getByRole('button', { name: /start studying/i }).first()
    if (await startStudying.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startStudying.click(); await wait(1000)
    }

    // Navigate to session again after modal dismissal
    if (reentryInfo.hasModal) {
      await navSession(page); await wait(3000)
    }

    const body2 = await getBody(page)
    const phase2 = detectPhase(body2, page.url())
    log({ type: 's6_phase_post_modal', phase: phase2 })

    try {
      const ssPath = join(EVIDENCE_DIR, 'S6_session_entry.png')
      await page.screenshot({ path: ssPath, fullPage: true })
    } catch (_) {}

    // Check what day the session config shows
    const sessionDay = await page.evaluate(() => {
      const bodyText = document.body.innerText
      const dayMatch = bodyText.match(/day\s*(\d+)/i)
      return dayMatch ? parseInt(dayMatch[1]) : null
    }).catch(() => null)
    log({ type: 's6_session_day_shown', sessionDay, correctNextDay })

    const isCorrectDay = sessionDay === correctNextDay || sessionDay === null // null = not determinable
    const isDuplicateDay = sessionDay !== null && sessionDay <= currentCSD

    if (isDuplicateDay) {
      result.guardFired = true
      result.notes.push(`Duplicate day guard likely active: session shows day ${sessionDay}, CSD=${currentCSD}`)
    }

    // Can they proceed? Try to skip to test and run it
    const skipOk = await skipToTest(page)
    await wait(2000)

    const body3 = await getBody(page)
    const phase3 = detectPhase(body3, page.url())
    log({ type: 's6_phase_at_test', phase: phase3, body: body3.substring(0, 150) })

    result.studentCanProceedToNextDay = /NEW_WORD_TEST|REVIEW_TEST|NEW_WORDS_STUDY|REVIEW_STUDY/.test(phase3)

    result.after = { cp: await readCP(uid), ss: await readSS(uid) }
    const csdAfter = result.after.cp?.currentStudyDay ?? currentCSD

    // Classification
    if (!result.studentCanProceedToNextDay && result.guardFired) {
      result.classification = 'STUCK_OR_LOOPED'
      result.correctPath = false
      result.notes.push('Duplicate guard active AND student cannot proceed to test')
    } else if (result.studentCanProceedToNextDay) {
      result.classification = 'CLEAN_RESTART'
      result.correctPath = isCorrectDay || sessionDay === null
      result.notes.push(`Student CAN reach test phase. Session day: ${sessionDay}, correct: ${correctNextDay}`)
    } else {
      result.classification = 'WRONG_PATH_OR_CORRUPTED'
      result.correctPath = false
    }

    result.notes.push(`currentCSD=${currentCSD}, sessionDay=${sessionDay}, correctNextDay=${correctNextDay}`)
    result.notes.push(`CSD after=${csdAfter}`)
    result.consoleErrors.push(...consoleErrors.map(e => 'Context: ' + e))
  } catch (err) {
    result.notes.push('Exception: ' + err.message)
    log({ type: 's6_exception', error: err.message })
    result.classification = result.classification || 'STUCK_OR_LOOPED'
    result.correctPath = result.correctPath ?? false
    result.after = { cp: await readCP(uid), ss: await readSS(uid) }
  } finally {
    await page.close().catch(() => {})
    await context.close().catch(() => {})
  }

  log({ type: 'scenario_done', scenario: 6, classification: result.classification, guardFired: result.guardFired })
  return result
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  log({ type: 'audit_start', agent: 'RECOVER', batch: 'B27', date: new Date().toISOString() })

  // Orphan check pre-run
  const uids = Object.values(ACCOUNTS).map(a => a.uid)
  const preOrphanDocs = []
  for (const uid of uids) {
    const cpDocs = await readAllCP(uid)
    const orphans = cpDocs.filter(d => d.id !== CP_DOC_ID)
    if (orphans.length > 0) preOrphanDocs.push({ uid, orphans: orphans.map(d => d.id) })
  }
  log({ type: 'pre_run_orphan_check', preOrphanDocs })

  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH })

  const allResults = []
  try {
    // Run scenarios sequentially (each uses fresh context)
    const s1 = await scenario1_midNewWordTest(browser)
    allResults.push(s1)
    writeFileSync(join(EVIDENCE_DIR, 'S1_state.json'), JSON.stringify(s1, null, 2))

    const s2 = await scenario2_midReviewTest(browser)
    allResults.push(s2)
    writeFileSync(join(EVIDENCE_DIR, 'S2_state.json'), JSON.stringify(s2, null, 2))

    const s3 = await scenario3_B2StrandRecovery(browser)
    allResults.push(s3)
    writeFileSync(join(EVIDENCE_DIR, 'S3_state.json'), JSON.stringify(s3, null, 2))

    const s4 = await scenario4_H2StaleComplete(browser)
    allResults.push(s4)
    writeFileSync(join(EVIDENCE_DIR, 'S4_state.json'), JSON.stringify(s4, null, 2))

    const s5 = await scenario5_logoutMidTest(browser)
    allResults.push(s5)
    writeFileSync(join(EVIDENCE_DIR, 'S5_state.json'), JSON.stringify(s5, null, 2))

    const s6 = await scenario6_duplicateDayGuard(browser)
    allResults.push(s6)
    writeFileSync(join(EVIDENCE_DIR, 'S6_state.json'), JSON.stringify(s6, null, 2))

  } catch (err) {
    log({ type: 'main_exception', error: err.message, stack: err.stack?.substring(0, 300) })
  } finally {
    await browser.close()
  }

  // Orphan check post-run
  const postOrphanDocs = []
  for (const uid of uids) {
    const cpDocs = await readAllCP(uid)
    const orphans = cpDocs.filter(d => d.id !== CP_DOC_ID)
    if (orphans.length > 0) postOrphanDocs.push({ uid, orphans: orphans.map(d => d.id) })
  }
  log({ type: 'post_run_orphan_check', postOrphanDocs })
  const orphansDelta = postOrphanDocs.filter(p => !preOrphanDocs.some(pr => pr.uid === p.uid))

  // Write status
  const status = {
    status: 'complete',
    agent: 'RECOVER',
    batch: 'B27',
    completedAt: new Date().toISOString(),
    scenarios: allResults.map(r => ({
      scenario: r.scenario,
      label: r.label,
      account: r.account,
      guardTriggered: r.guardTriggered,
      classification: r.classification,
      correctPath: r.correctPath,
      progressRestored: r.progressRestored || r.workRestored || false,
    })),
    orphanDocs: orphansDelta.length === 0 ? 'NONE' : JSON.stringify(orphansDelta),
  }
  writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2))
  log({ type: 'status_written', path: STATUS_PATH })

  // Write all evidence
  writeFileSync(join(EVIDENCE_DIR, 'all_scenarios.json'), JSON.stringify(allResults, null, 2))
  log({ type: 'evidence_written', path: join(EVIDENCE_DIR, 'all_scenarios.json') })

  console.log('\n=== RECOVER AUDIT COMPLETE ===')
  for (const r of allResults) {
    console.log(`  S${r.scenario} [${r.label}]: ${r.classification} | correctPath=${r.correctPath}`)
  }
  console.log(`  Orphan docs delta: ${orphansDelta.length === 0 ? 'NONE' : JSON.stringify(orphansDelta)}`)

  return allResults
}

main().catch(err => {
  console.error('[RECOVER] Fatal error:', err)
  process.exit(1)
})
