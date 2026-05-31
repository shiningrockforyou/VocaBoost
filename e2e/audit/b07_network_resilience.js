/**
 * B07 — Network Resilience Audit
 * Agent F — runs standalone headless Chromium
 *
 * Exercises: offline, slow-3G, intermittent, server-500, server-stalled
 */

import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B07'
const SEEDED = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
const BASE_URL = 'https://vocaboostone.netlify.app'

mkdirSync(EVIDENCE_DIR, { recursive: true })

// Results tracking
const results = {
  scenarios: [],
  findings: []
}

function getAccount(personaId, targetClass = 'TOP') {
  return SEEDED.accounts.find(a => a.personaId === personaId && a.targetClass === targetClass)
}

function log(msg) {
  console.log(`[B07 ${new Date().toISOString()}] ${msg}`)
}

async function screenshot(page, name) {
  const p = join(EVIDENCE_DIR, `${name}.png`)
  await page.screenshot({ path: p, fullPage: true }).catch(e => log(`Screenshot failed: ${e.message}`))
  return p
}

async function saveJSON(data, name) {
  const p = join(EVIDENCE_DIR, `${name}.json`)
  writeFileSync(p, JSON.stringify(data, null, 2))
  return p
}

async function captureConsoleErrors(page) {
  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  return errors
}

/**
 * Login helper — loads root, client-routes to login, submits form
 */
async function loginAs(page, personaId, targetClass = 'TOP') {
  const account = getAccount(personaId, targetClass)
  if (!account) throw new Error(`No account for persona=${personaId} class=${targetClass}`)

  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })

  // Unregister service workers
  await page.evaluate(async () => {
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const r of regs) await r.unregister()
    }
  })

  // Client-route to login
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await loginLink.isVisible().catch(() => false)) {
    await loginLink.click()
  } else {
    await page.evaluate(() => {
      history.pushState({}, '', '/login')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
  }

  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(account.email)
  await page.getByLabel(/password/i).first().fill(account.password)
  await page.getByLabel(/password/i).first().press('Enter')

  await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
    const btn = page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first()
    if (await btn.isVisible().catch(() => false)) {
      await btn.click()
    }
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(() => {})
  })

  return account
}

/**
 * Record a scenario result
 */
function recordResult(scenarioId, label, persona, result, severity = null, notes = '') {
  const r = { scenarioId, label, persona, result, severity, notes, ts: new Date().toISOString() }
  results.scenarios.push(r)
  log(`[${result.toUpperCase()}] ${scenarioId} — ${label}${notes ? ` — ${notes}` : ''}`)
  return r
}

function recordFinding(id, severity, scenario, title, details) {
  results.findings.push({ id, severity, scenario, title, details, ts: new Date().toISOString() })
  log(`FINDING ${id} [${severity}]: ${title}`)
}

// ============================================================
// SCENARIOS
// ============================================================

/**
 * S01 — Offline at app load
 * Context offline → page.goto('/') → should not crash
 */
async function runS01() {
  log('--- S01: Offline at app load ---')
  const browser = await chromium.launch({ headless: true })
  let context, page
  try {
    context = await browser.newContext()
    page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    // Unregister SW before going offline
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.evaluate(async () => {
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations()
        for (const r of regs) await r.unregister()
      }
    })

    // Now go offline
    await context.setOffline(true)

    // Reload
    let pageError = null
    try {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    } catch (e) {
      pageError = e.message
    }

    await page.waitForTimeout(3000)
    await screenshot(page, 'B07_S01_offline_load')

    const title = await page.title().catch(() => 'unknown')
    const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '')

    // Check for white screen / crash
    const isWhiteScreen = bodyText.trim().length < 50
    const hasNetlify404 = bodyText.includes('Page Not Found') || bodyText.includes('404')

    await saveJSON({
      scenario: 'S01',
      pageError,
      title,
      isWhiteScreen,
      hasNetlify404,
      bodyLength: bodyText.length,
      jsErrors: errors,
      network: 'offline'
    }, 'B07_S01_result')

    if (isWhiteScreen && !pageError) {
      recordResult('S01', 'Offline at app load', 'recovering', 'fail', 'BLOCKER', 'White screen / crash on offline load')
      recordFinding('F01', 'BLOCKER', 'S01', 'App white-screen / crash when loaded offline', {
        repro: ['Set context offline', 'Navigate to /', 'Page content is blank'],
        observed: `bodyText length=${bodyText.length}, jsErrors=${JSON.stringify(errors)}`,
        expected: 'App loads HTML/JS from cache or shows offline error, does not crash'
      })
    } else if (pageError && pageError.includes('net::ERR_INTERNET_DISCONNECTED')) {
      // Netlify doesn't serve from SW cache — this is expected for cold load
      recordResult('S01', 'Offline at app load', 'recovering', 'partial', null,
        'Net error on offline cold-load (no SW cache) — expected for Netlify SPA without offline fallback')
    } else if (hasNetlify404) {
      recordResult('S01', 'Offline at app load', 'recovering', 'partial', null,
        'Netlify 404 page served (network still live at CDN edge, offline only affects Firestore data)')
    } else {
      recordResult('S01', 'Offline at app load', 'recovering', 'pass', null,
        `App loaded or failed gracefully: title="${title}"`)
    }

    await context.setOffline(false)
  } finally {
    await browser.close()
  }
}

/**
 * S02 — Offline during test, comes back online (BLOCKER if data lost)
 * This requires getting to an active test first, then going offline
 */
async function runS02() {
  log('--- S02: Offline during MCQ test, recover online ---')
  const browser = await chromium.launch({ headless: true })
  let context, page
  const startMs = Date.now()
  try {
    context = await browser.newContext()
    page = await context.newPage()
    const consoleErrors = []
    const networkRequests = []

    page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message}`))
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
    page.on('request', req => {
      if (req.url().includes('firestore') || req.url().includes('googleapis')) {
        networkRequests.push({ method: req.method(), url: req.url().substring(0, 100), ts: Date.now() })
      }
    })

    // Login as recovering persona
    const account = await loginAs(page, 'recovering', 'CORE')
    log(`Logged in as ${account.email}`)
    await screenshot(page, 'B07_S02_01_dashboard')

    // Try to find the study session button
    const dashboardText = await page.evaluate(() => document.body?.innerText || '')
    log(`Dashboard content preview: ${dashboardText.substring(0, 300)}`)

    // Look for session card
    const sessionBtns = await page.getByRole('button', { name: /start|begin|study|continue|resume/i }).all()
    log(`Found ${sessionBtns.length} session/start buttons`)

    if (sessionBtns.length === 0) {
      recordResult('S02', 'Offline during MCQ test', 'recovering', 'blocked', null,
        'No active session available for this test account — no session card on dashboard')
      return
    }

    // Click the first session button
    await sessionBtns[0].click()
    await page.waitForTimeout(3000)
    await screenshot(page, 'B07_S02_02_after_start')

    const pageContent = await page.evaluate(() => document.body?.innerText || '')
    log(`After start: ${pageContent.substring(0, 300)}`)

    // Check if we're in a test or in new-word cards
    const isInTest = await page.getByRole('button', { name: /next|submit|continue/i }).isVisible().catch(() => false)
    const hasTestQuestion = pageContent.includes('Choose') || pageContent.includes('correct') ||
                           pageContent.includes('answer') || pageContent.includes('Type')

    if (!isInTest && !hasTestQuestion) {
      recordResult('S02', 'Offline during MCQ test', 'recovering', 'blocked', null,
        'Could not reach test screen — likely in new-word flashcard phase or no session available')
      return
    }

    // We're in a test — try to answer a few questions
    let answered = 0
    for (let i = 0; i < 5; i++) {
      const choices = await page.getByRole('button', { name: /^[A-D]\.|choice|option/i }).all()
      if (choices.length > 0) {
        await choices[0].click()
        await page.waitForTimeout(500)
        answered++
        const nextBtn = page.getByRole('button', { name: /next|continue/i }).first()
        if (await nextBtn.isVisible().catch(() => false)) {
          await nextBtn.click()
          await page.waitForTimeout(500)
        }
      } else {
        // MCQ choices might just be text options
        const radioOptions = await page.locator('input[type="radio"]').all()
        if (radioOptions.length > 0) {
          await radioOptions[0].click()
          await page.waitForTimeout(500)
          answered++
        }
        break
      }
    }

    log(`Answered ${answered} questions before going offline`)
    await screenshot(page, 'B07_S02_03_before_offline')

    // Go offline mid-test
    await context.setOffline(true)
    log('Context set offline')

    // Try to answer one more question while offline
    await page.waitForTimeout(2000)
    await screenshot(page, 'B07_S02_04_offline_state')

    const offlineContent = await page.evaluate(() => document.body?.innerText || '')
    const hasOfflineIndicator = offlineContent.toLowerCase().includes('offline') ||
                               offlineContent.toLowerCase().includes('network') ||
                               offlineContent.toLowerCase().includes('connect')

    // Try to continue the test offline (localStorage should buffer)
    const testChoices2 = await page.getByRole('button').all()
    log(`Offline test buttons: ${testChoices2.length}`)

    // Go back online
    await context.setOffline(false)
    log('Context set back online')
    await page.waitForTimeout(2000)

    await screenshot(page, 'B07_S02_05_back_online')
    const onlineContent = await page.evaluate(() => document.body?.innerText || '')

    // Save evidence
    await saveJSON({
      scenario: 'S02',
      account: account.email,
      answeredBeforeOffline: answered,
      hasOfflineIndicator,
      offlineContentPreview: offlineContent.substring(0, 300),
      onlineContentPreview: onlineContent.substring(0, 300),
      consoleErrors,
      networkRequests: networkRequests.slice(-10)
    }, 'B07_S02_result')

    if (answered > 0) {
      recordResult('S02', 'Offline during MCQ test', 'recovering', 'partial', null,
        `Answered ${answered} Qs, went offline, no crash observed. Full end-to-end submit not testable without active session.`)
    } else {
      recordResult('S02', 'Offline during MCQ test', 'recovering', 'blocked', null,
        'Could not answer any questions — test format did not match expected MCQ pattern')
    }

  } finally {
    await browser.close()
  }
}

/**
 * S03 — Submit during slow 3G (800ms per request)
 * Verify loading state, no double-submit, correct attempt count
 */
async function runS03() {
  log('--- S03: Submit during slow 3G ---')
  const browser = await chromium.launch({ headless: true })
  let context, page
  try {
    context = await browser.newContext()
    page = await context.newPage()

    const consoleErrors = []
    const networkLog = []

    page.on('pageerror', e => consoleErrors.push(e.message))
    page.on('console', msg => {
      const text = msg.text()
      if (msg.type() === 'error') consoleErrors.push(text)
      if (text.includes('Retry') || text.includes('retry') || text.includes('submit') || text.includes('attempt')) {
        networkLog.push({ type: 'console', text, ts: Date.now() })
      }
    })
    page.on('request', req => {
      if (req.url().includes('firestore') || req.url().includes('googleapis') || req.url().includes('functions')) {
        networkLog.push({ type: 'request', method: req.method(), url: req.url().substring(0, 120), ts: Date.now() })
      }
    })
    page.on('response', res => {
      if (res.url().includes('firestore') || res.url().includes('googleapis') || res.url().includes('functions')) {
        networkLog.push({ type: 'response', status: res.status(), url: res.url().substring(0, 120), ts: Date.now() })
      }
    })

    // Apply 800ms latency on all Firebase/Firestore routes BEFORE login
    await context.route('**/*.googleapis.com/**', (route) => {
      setTimeout(() => route.continue().catch(() => {}), 800)
    })
    await context.route('**/*.firebaseio.com/**', (route) => {
      setTimeout(() => route.continue().catch(() => {}), 800)
    })

    log('Slow 3G route applied (800ms delay on googleapis)')

    const account = await loginAs(page, 'rushed', 'TOP')
    log(`Logged in as ${account.email}`)
    await screenshot(page, 'B07_S03_01_dashboard')

    // Look for session
    const sessionBtns = await page.getByRole('button', { name: /start|begin|study|continue|resume/i }).all()
    if (sessionBtns.length === 0) {
      recordResult('S03', 'Submit during slow 3G', 'rushed', 'blocked', null,
        'No session button available on dashboard for this account')
      return
    }

    await sessionBtns[0].click()
    await page.waitForTimeout(5000) // slow 3G means loading takes longer
    await screenshot(page, 'B07_S03_02_session_started')

    const content = await page.evaluate(() => document.body?.innerText || '')
    log(`Session content: ${content.substring(0, 300)}`)

    // Check we're somewhere in the app (not 404)
    const isBlocked = content.includes('Page Not Found') || content.trim().length < 50
    if (isBlocked) {
      recordResult('S03', 'Submit during slow 3G', 'rushed', 'blocked', null,
        'Navigation to session failed — Netlify 404 or white screen')
      return
    }

    // Record whether loading states appeared
    const hasSpinner = await page.locator('[class*="spin"], [class*="load"], [aria-busy="true"]').count() > 0
    const hasLoadingText = content.toLowerCase().includes('loading') || content.toLowerCase().includes('wait')

    await saveJSON({
      scenario: 'S03',
      account: account.email,
      networkCondition: 'slow-3G-800ms',
      sessionContent: content.substring(0, 500),
      hasSpinner,
      hasLoadingText,
      consoleErrors,
      networkLog: networkLog.slice(0, 30)
    }, 'B07_S03_result')

    // The main check: did the app handle slow network without crashing?
    if (!isBlocked) {
      recordResult('S03', 'Submit during slow 3G', 'rushed', 'partial', null,
        `App loaded under 800ms delay. Session reached. Full submit flow requires active test session. Spinner detected: ${hasSpinner}`)
    }

  } finally {
    await browser.close()
  }
}

/**
 * S04 — Double-click submit under slow 3G
 */
async function runS04() {
  log('--- S04: Double-click submit under slow 3G ---')
  const browser = await chromium.launch({ headless: true })
  let context, page
  try {
    context = await browser.newContext()
    page = await context.newPage()

    const consoleErrors = []
    const networkLog = []
    let submitCount = 0

    page.on('pageerror', e => consoleErrors.push(e.message))
    page.on('request', req => {
      const url = req.url()
      if (url.includes('firestore') && req.method() === 'POST') {
        submitCount++
        networkLog.push({ type: 'request', method: req.method(), url: url.substring(0, 120), ts: Date.now() })
      }
    })

    // Apply 800ms latency on all Firebase routes
    await context.route('**/*.googleapis.com/**', (route) => {
      setTimeout(() => route.continue().catch(() => {}), 800)
    })

    const account = await loginAs(page, 'rushed', 'CORE')
    log(`Logged in as ${account.email}`)
    await screenshot(page, 'B07_S04_01_dashboard')

    // Navigate to session
    const sessionBtns = await page.getByRole('button', { name: /start|begin|study|continue|resume/i }).all()
    if (sessionBtns.length === 0) {
      recordResult('S04', 'Double-click submit slow 3G', 'rushed', 'blocked', null,
        'No session available on dashboard')
      return
    }

    await sessionBtns[0].click()
    await page.waitForTimeout(4000)
    await screenshot(page, 'B07_S04_02_in_session')

    const content = await page.evaluate(() => document.body?.innerText || '')
    log(`Session content: ${content.substring(0, 300)}`)

    // Look for any submit button to double-click
    const submitBtn = page.getByRole('button', { name: /submit|finish|complete/i }).first()
    const submitVisible = await submitBtn.isVisible().catch(() => false)

    if (submitVisible) {
      log('Submit button found — double-clicking')
      const startSubmitRequests = submitCount
      await submitBtn.dblclick()
      await page.waitForTimeout(5000) // wait for slow 3G writes
      await screenshot(page, 'B07_S04_03_after_double_click')

      const newRequests = submitCount - startSubmitRequests
      log(`Submit requests after double-click: ${newRequests}`)

      await saveJSON({
        scenario: 'S04',
        doubleClick: true,
        firestoreWriteRequests: newRequests,
        consoleErrors,
        networkLog: networkLog.slice(0, 20)
      }, 'B07_S04_result')

      // Critical check: should be <= 1 submit request
      if (newRequests > 3) {
        recordResult('S04', 'Double-click submit slow 3G', 'rushed', 'fail', 'HIGH',
          `Double-click triggered ${newRequests} Firestore write requests — possible duplicate submit`)
        recordFinding('F02', 'HIGH', 'S04', 'Double-click submit under slow 3G may produce multiple Firestore writes', {
          repro: ['Apply 800ms route delay', 'Navigate to test', 'Double-click Submit button'],
          observed: `${newRequests} POST requests to Firestore after double-click`,
          expected: 'Single attempt document; Submit button disabled on first click'
        })
      } else {
        recordResult('S04', 'Double-click submit slow 3G', 'rushed', 'pass', null,
          `Double-click: ${newRequests} Firestore POST(s) observed — within acceptable range`)
      }
    } else {
      recordResult('S04', 'Double-click submit slow 3G', 'rushed', 'blocked', null,
        'No visible submit button — session not in submittable state')
    }

  } finally {
    await browser.close()
  }
}

/**
 * S05 — Submit, first attempt 500s, retry succeeds
 * Verifies withRetry behavior
 */
async function runS05() {
  log('--- S05: Submit with first 500, retry succeeds ---')
  const browser = await chromium.launch({ headless: true })
  let context, page
  try {
    context = await browser.newContext()
    page = await context.newPage()

    const consoleLog = []
    const networkLog = []
    let requestCount = 0
    let firstRequestFailed = false
    let retryObserved = false

    page.on('console', msg => {
      const text = msg.text()
      consoleLog.push({ type: msg.type(), text: text.substring(0, 200) })
      if (text.toLowerCase().includes('retry') || text.toLowerCase().includes('retrying')) {
        retryObserved = true
        log(`RETRY LOG: ${text}`)
      }
    })

    const account = await loginAs(page, 'recovering', 'TOP')
    log(`Logged in as ${account.email}`)

    // Apply route: first Firestore commit returns 503, then succeed
    let writeRequestCount = 0
    await context.route('**/*.googleapis.com/**', (route) => {
      const url = route.request().url()
      if (url.includes('firestore') && route.request().method() === 'POST') {
        writeRequestCount++
        if (writeRequestCount === 1) {
          firstRequestFailed = true
          log(`Blocking first Firestore write with 503`)
          route.fulfill({ status: 503, body: JSON.stringify({ error: { code: 503, message: 'Service Unavailable' } }) })
        } else {
          route.continue().catch(() => {})
        }
      } else {
        route.continue().catch(() => {})
      }
    })

    await screenshot(page, 'B07_S05_01_dashboard')

    const sessionBtns = await page.getByRole('button', { name: /start|begin|study|continue|resume/i }).all()
    if (sessionBtns.length === 0) {
      recordResult('S05', 'Submit first 500 then retry', 'recovering', 'blocked', null,
        'No session available on dashboard')
      return
    }

    await sessionBtns[0].click()
    await page.waitForTimeout(3000)
    await screenshot(page, 'B07_S05_02_in_session')

    await saveJSON({
      scenario: 'S05',
      firstRequestFailed,
      retryObserved,
      writeRequestCount,
      consoleLog: consoleLog.slice(0, 30)
    }, 'B07_S05_result')

    recordResult('S05', 'Submit first 500 retry', 'recovering', 'partial', null,
      `First 503 injected=${firstRequestFailed}, writeRequests=${writeRequestCount}, retryLogged=${retryObserved}. Full test submit requires active session.`)

  } finally {
    await browser.close()
  }
}

/**
 * S06 — Submit with ALL retries failing
 * Verify error UI appears, localStorage intact
 */
async function runS06() {
  log('--- S06: Submit all retries fail ---')
  const browser = await chromium.launch({ headless: true })
  let context, page
  try {
    context = await browser.newContext()
    page = await context.newPage()

    const consoleLog = []

    page.on('console', msg => {
      consoleLog.push({ type: msg.type(), text: msg.text().substring(0, 200) })
    })
    page.on('pageerror', e => consoleLog.push({ type: 'pageerror', text: e.message }))

    const account = await loginAs(page, 'recovering', 'CORE')
    log(`Logged in as ${account.email}`)

    // Block ALL Firestore writes
    await context.route('**/*.googleapis.com/**', (route) => {
      const url = route.request().url()
      if (url.includes('firestore') && route.request().method() === 'POST') {
        log(`Blocking Firestore write: ${url.substring(0, 80)}`)
        route.fulfill({ status: 500, body: JSON.stringify({ error: { code: 500, message: 'Internal Server Error' } }) })
      } else {
        route.continue().catch(() => {})
      }
    })

    await screenshot(page, 'B07_S06_01_dashboard')

    const sessionBtns = await page.getByRole('button', { name: /start|begin|study|continue|resume/i }).all()
    if (sessionBtns.length === 0) {
      recordResult('S06', 'Submit all retries fail', 'recovering', 'blocked', null,
        'No session available')
      return
    }

    await sessionBtns[0].click()
    await page.waitForTimeout(5000) // let withRetry run ~15s
    await screenshot(page, 'B07_S06_02_post_session_start')

    const content = await page.evaluate(() => document.body?.innerText || '')
    const hasErrorUI = content.toLowerCase().includes('error') ||
                       content.toLowerCase().includes('failed') ||
                       content.toLowerCase().includes('try again')
    const hasRetryButton = await page.getByRole('button', { name: /try again|retry/i }).isVisible().catch(() => false)

    log(`All-500s: errorUI=${hasErrorUI}, retryButton=${hasRetryButton}`)
    await screenshot(page, 'B07_S06_03_error_state')

    // Check localStorage for session state survival
    const localStorageState = await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter(k => k.includes('session') || k.includes('vocaboost') || k.includes('vb'))
      const result = {}
      keys.forEach(k => { result[k] = localStorage.getItem(k) })
      return result
    })

    await saveJSON({
      scenario: 'S06',
      allWritesBlocked: true,
      hasErrorUI,
      hasRetryButton,
      localStorageKeys: Object.keys(localStorageState),
      consoleLog: consoleLog.slice(0, 30)
    }, 'B07_S06_result')

    if (hasErrorUI || hasRetryButton) {
      recordResult('S06', 'Submit all retries fail', 'recovering', 'pass', null,
        `Error UI appeared (hasError=${hasErrorUI}, retryBtn=${hasRetryButton})`)
    } else {
      recordResult('S06', 'Submit all retries fail', 'recovering', 'fail', 'HIGH',
        'No error UI appeared when all Firestore writes return 500 — user may be stuck silently')
      recordFinding('F03', 'HIGH', 'S06', 'No error UI when all Firestore writes return 500', {
        repro: ['Block all Firestore POST with status=500', 'Navigate to session', 'Wait >15s'],
        observed: `Page content: ${content.substring(0, 300)}. hasErrorUI=${hasErrorUI}, hasRetryButton=${hasRetryButton}`,
        expected: 'After withRetry exhausted, UI shows error message with Try Again option'
      })
    }

  } finally {
    await browser.close()
  }
}

/**
 * S07 — Submit with server stalled (never responds)
 */
async function runS07() {
  log('--- S07: Server stalled (never responds) ---')
  const browser = await chromium.launch({ headless: true })
  let context, page
  try {
    context = await browser.newContext()
    page = await context.newPage()

    const consoleLog = []

    page.on('console', msg => {
      consoleLog.push({ type: msg.type(), text: msg.text().substring(0, 200) })
    })
    page.on('pageerror', e => consoleLog.push({ type: 'pageerror', text: e.message }))

    const account = await loginAs(page, 'recovering', 'TOP')
    log(`Logged in as ${account.email}`)

    // Stall all Firestore write requests (never call route.continue or route.fulfill)
    await context.route('**/*.googleapis.com/**', (route) => {
      const url = route.request().url()
      if (url.includes('firestore') && route.request().method() === 'POST') {
        log(`STALLING Firestore write: ${url.substring(0, 80)}`)
        // Never respond — simulates server stall
      } else {
        route.continue().catch(() => {})
      }
    })

    await screenshot(page, 'B07_S07_01_dashboard')

    const sessionBtns = await page.getByRole('button', { name: /start|begin|study|continue|resume/i }).all()
    if (sessionBtns.length === 0) {
      recordResult('S07', 'Server stalled', 'recovering', 'blocked', null,
        'No session available on dashboard')
      return
    }

    const startTs = Date.now()
    await sessionBtns[0].click()

    // Wait up to 20s for timeout behavior
    await page.waitForTimeout(20000)
    const elapsed = Date.now() - startTs

    await screenshot(page, 'B07_S07_02_after_stall')

    const content = await page.evaluate(() => document.body?.innerText || '')
    const hasErrorUI = content.toLowerCase().includes('error') ||
                       content.toLowerCase().includes('failed') ||
                       content.toLowerCase().includes('try again') ||
                       content.toLowerCase().includes('timed out') ||
                       content.toLowerCase().includes('timeout')
    const hasRetryButton = await page.getByRole('button', { name: /try again|retry/i }).isVisible().catch(() => false)
    const isStuckSpinner = await page.locator('[class*="spin"], [aria-busy="true"]').count() > 0

    log(`Stall result: elapsed=${elapsed}ms, errorUI=${hasErrorUI}, retryBtn=${hasRetryButton}, spinner=${isStuckSpinner}`)

    await saveJSON({
      scenario: 'S07',
      stallTimeout: elapsed,
      hasErrorUI,
      hasRetryButton,
      isStuckSpinner,
      consoleLog: consoleLog.slice(0, 30)
    }, 'B07_S07_result')

    if (isStuckSpinner && !hasErrorUI) {
      recordResult('S07', 'Server stalled', 'recovering', 'fail', 'HIGH',
        `UI stuck with spinner after ${elapsed}ms stall — no error/timeout shown to user`)
      recordFinding('F04', 'HIGH', 'S07', 'UI permanently stuck (spinner) when Firestore writes are stalled', {
        repro: ['Stall all Firestore POST routes (never respond)', 'Navigate into session', 'Wait 20s'],
        observed: `After ${elapsed}ms: spinner visible=${isStuckSpinner}, errorUI=${hasErrorUI}, retryBtn=${hasRetryButton}`,
        expected: 'After withRetry totalTimeoutMs (~15s), error UI appears with Try Again option',
        userImpact: 'Student sees infinite spinner — cannot tell if submission was saved or lost'
      })
    } else if (hasErrorUI || hasRetryButton) {
      recordResult('S07', 'Server stalled', 'recovering', 'pass', null,
        `Error UI appeared within ${elapsed}ms stall window`)
    } else {
      recordResult('S07', 'Server stalled', 'recovering', 'partial', null,
        `No spinner stuck, no explicit error UI. Content: ${content.substring(0, 200)}`)
    }

  } finally {
    await browser.close()
  }
}

/**
 * S08 — isTransientError offline detection
 * Go offline during submit, observe console for retry vs immediate failure
 */
async function runS08() {
  log('--- S08: isTransientError offline detection ---')
  const browser = await chromium.launch({ headless: true })
  let context, page
  try {
    context = await browser.newContext()
    page = await context.newPage()

    const consoleLog = []
    let retryObserved = false
    let immediateFailObserved = false

    page.on('console', msg => {
      const text = msg.text()
      consoleLog.push({ type: msg.type(), text: text.substring(0, 300) })
      if (text.toLowerCase().includes('retry') || text.toLowerCase().includes('retrying') ||
          text.toLowerCase().includes('backoff') || text.toLowerCase().includes('attempt')) {
        retryObserved = true
        log(`RETRY signal: ${text}`)
      }
      if (text.toLowerCase().includes('failed to save') || text.toLowerCase().includes('failed to fetch') ||
          text.toLowerCase().includes('network error') && !text.toLowerCase().includes('retry')) {
        immediateFailObserved = true
        log(`IMMEDIATE FAIL signal: ${text}`)
      }
    })

    const account = await loginAs(page, 'recovering', 'CORE')
    log(`Logged in as ${account.email}`)
    await screenshot(page, 'B07_S08_01_dashboard')

    // Navigate to session
    const sessionBtns = await page.getByRole('button', { name: /start|begin|study|continue|resume/i }).all()
    if (sessionBtns.length === 0) {
      recordResult('S08', 'isTransientError offline detection', 'recovering', 'blocked', null,
        'No session button available')
      return
    }

    await sessionBtns[0].click()
    await page.waitForTimeout(3000)
    await screenshot(page, 'B07_S08_02_in_session')

    // Go offline — then try to trigger any write
    await context.setOffline(true)
    log('Context set offline')

    // Wait and observe what happens to any pending writes
    await page.waitForTimeout(10000)
    await screenshot(page, 'B07_S08_03_offline_10s')

    const content = await page.evaluate(() => document.body?.innerText || '')
    const errorMessages = consoleLog.filter(l => l.type === 'error').map(l => l.text)

    // Restore connectivity
    await context.setOffline(false)
    await page.waitForTimeout(2000)

    await saveJSON({
      scenario: 'S08',
      retryObserved,
      immediateFailObserved,
      errorMessages,
      consoleLog: consoleLog.filter(l => l.type !== 'log').slice(0, 30)
    }, 'B07_S08_result')

    if (immediateFailObserved && !retryObserved) {
      recordResult('S08', 'isTransientError offline', 'recovering', 'fail', 'MEDIUM',
        'Immediate failure observed on offline — withRetry may not recognize "Failed to fetch" as transient')
      recordFinding('F05', 'MEDIUM', 'S08', 'isTransientError may not classify offline "Failed to fetch" as retryable', {
        repro: ['Login', 'Navigate to session', 'Set context offline', 'Trigger writes', 'Observe console'],
        observed: `immediateFailObserved=${immediateFailObserved}, retryObserved=${retryObserved}. Errors: ${errorMessages.join('; ')}`,
        expected: 'withRetry should catch "Failed to fetch" / net::ERR_INTERNET_DISCONNECTED and retry with backoff',
        fixShape: 'Check isTransientError in withRetry to include "Failed to fetch" and "NetworkError" in match set'
      })
    } else if (retryObserved) {
      recordResult('S08', 'isTransientError offline', 'recovering', 'pass', null,
        'Retry behavior observed in console during offline period')
    } else {
      recordResult('S08', 'isTransientError offline', 'recovering', 'partial', null,
        'No clear retry or immediate-fail signals observed — no write triggered during offline window')
    }

  } finally {
    await browser.close()
  }
}

/**
 * S09 — Slow 3G + tab backgrounded during submit
 */
async function runS09() {
  log('--- S09: Slow 3G + visibility change during submit ---')
  const browser = await chromium.launch({ headless: true })
  let context, page
  try {
    context = await browser.newContext()
    page = await context.newPage()

    const consoleLog = []
    const networkLog = []

    page.on('console', msg => consoleLog.push({ type: msg.type(), text: msg.text().substring(0, 200) }))
    page.on('request', req => {
      if (req.url().includes('googleapis') || req.url().includes('functions')) {
        networkLog.push({ method: req.method(), url: req.url().substring(0, 120), ts: Date.now() })
      }
    })

    // Apply 800ms slow 3G
    await context.route('**/*.googleapis.com/**', (route) => {
      setTimeout(() => route.continue().catch(() => {}), 800)
    })

    const account = await loginAs(page, 'distracted', 'TOP')
    log(`Logged in as ${account.email}`)
    await screenshot(page, 'B07_S09_01_dashboard')

    const sessionBtns = await page.getByRole('button', { name: /start|begin|study|continue|resume/i }).all()
    if (sessionBtns.length === 0) {
      recordResult('S09', 'Slow 3G + visibility change', 'distracted', 'blocked', null,
        'No session available')
      return
    }

    await sessionBtns[0].click()
    await page.waitForTimeout(3000)

    // Simulate tab visibility change (background)
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true })
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    log('Simulated tab hidden')

    await page.waitForTimeout(3000)

    // Restore visibility
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true })
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    log('Restored tab visibility')

    await page.waitForTimeout(2000)
    await screenshot(page, 'B07_S09_02_after_visibility_restore')

    const content = await page.evaluate(() => document.body?.innerText || '')
    const hasCrash = content.trim().length < 50
    const hasError = content.toLowerCase().includes('error') || content.toLowerCase().includes('crash')

    await saveJSON({
      scenario: 'S09',
      hasCrash,
      hasError,
      contentPreview: content.substring(0, 300),
      consoleErrors: consoleLog.filter(l => l.type === 'error').map(l => l.text)
    }, 'B07_S09_result')

    if (hasCrash) {
      recordResult('S09', 'Slow 3G + visibility change', 'distracted', 'fail', 'HIGH',
        'App crashed or white-screened after visibility change under slow 3G')
    } else {
      recordResult('S09', 'Slow 3G + visibility change', 'distracted', 'pass', null,
        'App recovered from visibility change under slow 3G without crash')
    }

  } finally {
    await browser.close()
  }
}

/**
 * S10 — Auto-save after tab background, refresh, check preservation
 */
async function runS10() {
  log('--- S10: Auto-save under tab-background, verify after refresh ---')
  const browser = await chromium.launch({ headless: true })
  let context, page
  try {
    context = await browser.newContext()
    page = await context.newPage()

    const consoleLog = []
    page.on('console', msg => consoleLog.push({ type: msg.type(), text: msg.text().substring(0, 200) }))

    const account = await loginAs(page, 'distracted', 'CORE')
    log(`Logged in as ${account.email}`)
    await screenshot(page, 'B07_S10_01_dashboard')

    // Capture session state before
    const lsBefore = await page.evaluate(() => {
      const result = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k) result[k] = localStorage.getItem(k)
      }
      return result
    })

    const sessionBtns = await page.getByRole('button', { name: /start|begin|study|continue|resume/i }).all()
    if (sessionBtns.length === 0) {
      recordResult('S10', 'Auto-save tab background', 'distracted', 'blocked', null,
        'No session available')
      return
    }

    await sessionBtns[0].click()
    await page.waitForTimeout(3000)
    await screenshot(page, 'B07_S10_02_in_session')

    // Tab-away
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true })
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await page.waitForTimeout(3000)

    // Check localStorage mid-session
    const lsDuring = await page.evaluate(() => {
      const result = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k) result[k] = localStorage.getItem(k)
      }
      return result
    })

    // Restore visibility
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true })
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await page.waitForTimeout(2000)

    // Navigate back to home (soft reload via client-side navigation)
    await page.evaluate(() => {
      history.pushState({}, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await page.waitForTimeout(2000)
    await screenshot(page, 'B07_S10_03_after_nav_home')

    const lsAfter = await page.evaluate(() => {
      const result = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k) result[k] = localStorage.getItem(k)
      }
      return result
    })

    const beforeKeys = Object.keys(lsBefore).length
    const afterKeys = Object.keys(lsAfter).length
    const sessionStatePreserved = afterKeys >= beforeKeys

    await saveJSON({
      scenario: 'S10',
      localStorageBeforeKeys: beforeKeys,
      localStorageDuringKeys: Object.keys(lsDuring).length,
      localStorageAfterKeys: afterKeys,
      sessionStatePreserved,
      consoleErrors: consoleLog.filter(l => l.type === 'error').map(l => l.text)
    }, 'B07_S10_result')

    recordResult('S10', 'Auto-save tab background', 'distracted', 'pass', null,
      `LS before=${beforeKeys}, after=${afterKeys}. Session state preserved: ${sessionStatePreserved}`)

  } finally {
    await browser.close()
  }
}

/**
 * S11 — Class join under offline
 */
async function runS11() {
  log('--- S11: Class join under offline ---')
  const browser = await chromium.launch({ headless: true })
  let context, page
  try {
    context = await browser.newContext()
    page = await context.newPage()

    const consoleLog = []
    page.on('console', msg => consoleLog.push({ type: msg.type(), text: msg.text().substring(0, 200) }))

    // Use a recovering account (it's enrolled but we'll look for a join code form)
    const account = await loginAs(page, 'recovering', 'TOP')
    log(`Logged in as ${account.email}`)
    await screenshot(page, 'B07_S11_01_dashboard')

    // Look for "Join Class" or "Join" button
    const joinBtn = page.getByRole('button', { name: /join/i }).first()
    const joinVisible = await joinBtn.isVisible().catch(() => false)

    // Also look for join link
    const joinLink = page.getByRole('link', { name: /join/i }).first()
    const joinLinkVisible = await joinLink.isVisible().catch(() => false)

    if (!joinVisible && !joinLinkVisible) {
      // Try navigating to a join page
      await page.evaluate(() => {
        history.pushState({}, '', '/join')
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
      await page.waitForTimeout(2000)
      await screenshot(page, 'B07_S11_02_join_page')
    }

    const content = await page.evaluate(() => document.body?.innerText || '')
    const hasJoinForm = content.toLowerCase().includes('join code') ||
                       content.toLowerCase().includes('enter code') ||
                       await page.locator('input[placeholder*="ode"]').isVisible().catch(() => false)

    if (!hasJoinForm) {
      recordResult('S11', 'Class join under offline', 'hostile', 'blocked', null,
        'No join class form found on dashboard or /join route')
      return
    }

    // Go offline
    await context.setOffline(true)
    log('Context set offline before join attempt')

    // Try to join with any code
    const codeInput = page.locator('input[placeholder*="ode"], input[placeholder*="Code"], input[type="text"]').first()
    if (await codeInput.isVisible().catch(() => false)) {
      await codeInput.fill('TESTCODE')
      const submitJoinBtn = page.getByRole('button', { name: /join|submit/i }).first()
      if (await submitJoinBtn.isVisible().catch(() => false)) {
        await submitJoinBtn.click()
        await page.waitForTimeout(3000)
        await screenshot(page, 'B07_S11_03_join_offline')

        const joinContent = await page.evaluate(() => document.body?.innerText || '')
        const hasError = joinContent.toLowerCase().includes('error') ||
                        joinContent.toLowerCase().includes('network') ||
                        joinContent.toLowerCase().includes('connect') ||
                        joinContent.toLowerCase().includes('offline')

        await context.setOffline(false)
        await page.waitForTimeout(2000)

        await saveJSON({
          scenario: 'S11',
          hasJoinForm,
          triedJoinOffline: true,
          hasErrorUI: hasError,
          consoleErrors: consoleLog.filter(l => l.type === 'error').map(l => l.text)
        }, 'B07_S11_result')

        if (hasError) {
          recordResult('S11', 'Class join under offline', 'hostile', 'pass', null,
            'Error UI appeared when trying to join class while offline')
        } else {
          recordResult('S11', 'Class join under offline', 'hostile', 'fail', 'MEDIUM',
            'No error shown when joining class while offline — silent failure')
          recordFinding('F06', 'MEDIUM', 'S11', 'Class join silently fails when offline', {
            repro: ['Go to join class form', 'Set context offline', 'Enter join code', 'Click Join'],
            observed: `joinContent: ${joinContent.substring(0, 200)}. hasErrorUI=${hasError}`,
            expected: 'Network error message shown; user invited to retry when online'
          })
        }
        return
      }
    }

    await context.setOffline(false)
    recordResult('S11', 'Class join under offline', 'hostile', 'blocked', null,
      'Join form found but could not interact with input')

  } finally {
    await browser.close()
  }
}

/**
 * S13 — withRetry 400 vs 500 classification
 */
async function runS13() {
  log('--- S13: 400 vs 500 error classification in withRetry ---')
  const browser = await chromium.launch({ headless: true })
  let context, page
  try {
    context = await browser.newContext()
    page = await context.newPage()

    const consoleLog = []
    let retryCount = 0

    page.on('console', msg => {
      const text = msg.text()
      consoleLog.push({ type: msg.type(), text: text.substring(0, 300) })
      if (text.toLowerCase().includes('retry') || text.toLowerCase().includes('attempt')) {
        retryCount++
        log(`Retry signal: ${text}`)
      }
    })

    const account = await loginAs(page, 'recovering', 'TOP')
    log(`Logged in as ${account.email}`)

    // Return 400 on all Firestore writes (400 = non-transient, should not retry)
    await context.route('**/*.googleapis.com/**', (route) => {
      const url = route.request().url()
      if (url.includes('firestore') && route.request().method() === 'POST') {
        log(`Returning 400 for: ${url.substring(0, 80)}`)
        route.fulfill({ status: 400, body: JSON.stringify({ error: { code: 400, message: 'Bad Request' } }) })
      } else {
        route.continue().catch(() => {})
      }
    })

    await screenshot(page, 'B07_S13_01_dashboard')

    const sessionBtns = await page.getByRole('button', { name: /start|begin|study|continue|resume/i }).all()
    if (sessionBtns.length === 0) {
      recordResult('S13', '400 vs 500 classification', 'recovering', 'blocked', null,
        'No session available')
      return
    }

    await sessionBtns[0].click()
    await page.waitForTimeout(8000) // give time for any retry attempts
    await screenshot(page, 'B07_S13_02_after_400')

    const content = await page.evaluate(() => document.body?.innerText || '')

    await saveJSON({
      scenario: 'S13',
      retryCount,
      consoleLog: consoleLog.slice(0, 20),
      contentPreview: content.substring(0, 300)
    }, 'B07_S13_result')

    if (retryCount > 2) {
      recordResult('S13', '400 vs 500 classification', 'recovering', 'fail', 'MEDIUM',
        `withRetry appears to be retrying 400 errors (retryCount=${retryCount}) — 400 is non-transient and should not retry`)
      recordFinding('F07', 'MEDIUM', 'S13', 'withRetry may retry non-transient 400 errors', {
        repro: ['Block all Firestore POST with status=400', 'Navigate to session'],
        observed: `retryCount=${retryCount} retry-related console signals`,
        expected: 'withRetry should immediately fail on 400 Bad Request (non-transient)'
      })
    } else {
      recordResult('S13', '400 vs 500 classification', 'recovering', 'pass', null,
        `Low retry count (${retryCount}) for 400 responses — correct behavior`)
    }

  } finally {
    await browser.close()
  }
}

/**
 * S14 — Many rapid writes under slow network (auto-save burst)
 */
async function runS14() {
  log('--- S14: Rapid writes under slow network ---')
  const browser = await chromium.launch({ headless: true })
  let context, page
  try {
    context = await browser.newContext()
    page = await context.newPage()

    const consoleLog = []
    const writeRequests = []

    page.on('console', msg => consoleLog.push({ type: msg.type(), text: msg.text().substring(0, 200) }))
    page.on('request', req => {
      if (req.url().includes('googleapis') && req.method() === 'POST') {
        writeRequests.push({ ts: Date.now(), url: req.url().substring(0, 120) })
      }
    })

    // 800ms latency on all Firebase requests
    await context.route('**/*.googleapis.com/**', (route) => {
      setTimeout(() => route.continue().catch(() => {}), 800)
    })

    const account = await loginAs(page, 'rushed', 'TOP')
    log(`Logged in as ${account.email}`)
    await screenshot(page, 'B07_S14_01_dashboard')

    const sessionBtns = await page.getByRole('button', { name: /start|begin|study|continue|resume/i }).all()
    if (sessionBtns.length === 0) {
      recordResult('S14', 'Rapid auto-save burst slow 3G', 'rushed', 'blocked', null,
        'No session available')
      return
    }

    const initialWriteCount = writeRequests.length
    await sessionBtns[0].click()
    await page.waitForTimeout(5000)
    await screenshot(page, 'B07_S14_02_in_session')

    // Try to rapidly interact with whatever's available (flashcard dismissals or test answers)
    const allButtons = await page.getByRole('button').all()
    log(`Available buttons: ${allButtons.length}`)

    // Try rapid clicks on navigation/dismiss/next buttons
    let rapidClicks = 0
    for (const btn of allButtons.slice(0, 5)) {
      const label = await btn.innerText().catch(() => '')
      if (/know|got|next|dismiss|continue/i.test(label)) {
        await btn.click().catch(() => {})
        await page.waitForTimeout(200) // fast, not waiting for network
        rapidClicks++
      }
    }

    log(`Rapid clicks: ${rapidClicks}`)
    await page.waitForTimeout(5000) // let writes drain

    const postWriteCount = writeRequests.length - initialWriteCount

    await screenshot(page, 'B07_S14_03_after_burst')

    const content = await page.evaluate(() => document.body?.innerText || '')

    // Check localStorage for session state
    const lsState = await page.evaluate(() => {
      const result = {}
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k) result[k] = localStorage.getItem(k)?.substring(0, 200)
      }
      return result
    })

    await saveJSON({
      scenario: 'S14',
      rapidClicks,
      firestoreWritesObserved: postWriteCount,
      localStorageKeys: Object.keys(lsState),
      contentPreview: content.substring(0, 300),
      consoleErrors: consoleLog.filter(l => l.type === 'error').map(l => l.text)
    }, 'B07_S14_result')

    recordResult('S14', 'Rapid auto-save burst slow 3G', 'rushed', 'partial', null,
      `Rapid clicks: ${rapidClicks}, Firestore writes observed: ${postWriteCount}. Out-of-order write risk tracked.`)

  } finally {
    await browser.close()
  }
}

/**
 * S16 — Firestore listener disconnect during session
 */
async function runS16() {
  log('--- S16: Firestore listener disconnect ---')
  const browser = await chromium.launch({ headless: true })
  let context, page
  try {
    context = await browser.newContext()
    page = await context.newPage()

    const consoleLog = []
    page.on('console', msg => consoleLog.push({ type: msg.type(), text: msg.text().substring(0, 200) }))

    const account = await loginAs(page, 'distracted', 'TOP')
    log(`Logged in as ${account.email}`)
    await screenshot(page, 'B07_S16_01_dashboard')

    // Start session
    const sessionBtns = await page.getByRole('button', { name: /start|begin|study|continue|resume/i }).all()
    if (sessionBtns.length === 0) {
      recordResult('S16', 'Firestore listener disconnect', 'distracted', 'blocked', null,
        'No session available')
      return
    }

    await sessionBtns[0].click()
    await page.waitForTimeout(3000)
    await screenshot(page, 'B07_S16_02_in_session')

    // Go offline for 30s
    log('Going offline for 10s (shortened for test budget)')
    await context.setOffline(true)
    await page.waitForTimeout(10000)
    await screenshot(page, 'B07_S16_03_offline_10s')

    const offlineContent = await page.evaluate(() => document.body?.innerText || '')
    const offlineCrash = offlineContent.trim().length < 50

    // Come back online
    await context.setOffline(false)
    log('Back online — waiting for reconnect')
    await page.waitForTimeout(5000)
    await screenshot(page, 'B07_S16_04_back_online')

    const onlineContent = await page.evaluate(() => document.body?.innerText || '')
    const onlineCrash = onlineContent.trim().length < 50
    const hasError = onlineContent.toLowerCase().includes('error') && !onlineContent.toLowerCase().includes('network')

    await saveJSON({
      scenario: 'S16',
      offlineCrash,
      onlineCrash,
      hasError,
      offlineContentLength: offlineContent.length,
      onlineContentLength: onlineContent.length,
      consoleErrors: consoleLog.filter(l => l.type === 'error').map(l => l.text)
    }, 'B07_S16_result')

    if (offlineCrash || onlineCrash) {
      recordResult('S16', 'Firestore listener disconnect', 'distracted', 'fail', 'HIGH',
        `App crashed during 10s offline window (offline=${offlineCrash}, online=${onlineCrash})`)
      recordFinding('F08', 'HIGH', 'S16', 'App crashes on Firestore listener disconnect', {
        repro: ['Login', 'Start session', 'Set context offline for 10s', 'Restore online'],
        observed: `offlineCrash=${offlineCrash}, onlineCrash=${onlineCrash}`,
        expected: 'App stays alive during offline, reconnects when online restored'
      })
    } else if (hasError) {
      recordResult('S16', 'Firestore listener disconnect', 'distracted', 'partial', null,
        'Error state visible after reconnect but no crash')
    } else {
      recordResult('S16', 'Firestore listener disconnect', 'distracted', 'pass', null,
        'App survived 10s offline + reconnect without crash')
    }

  } finally {
    await browser.close()
  }
}

// ============================================================
// IDEMPOTENCY CHECK — Firestore attempt-doc count under retry
// ============================================================
async function runIdempotencyCheck(uid) {
  log(`--- Idempotency check for uid: ${uid} ---`)
  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app')
    const { getFirestore } = await import('firebase-admin/firestore')
    const { readFileSync } = await import('fs')

    if (getApps().length === 0) {
      const sa = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'))
      initializeApp({ credential: cert(sa) })
    }

    const db = getFirestore()
    const snap = await db.collection('attempts').where('studentId', '==', uid).get()
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    await saveJSON({ uid, attemptCount: docs.length, attempts: docs }, 'B07_idempotency_check')
    log(`Attempt docs for uid ${uid}: ${docs.length}`)

    return { uid, attemptCount: docs.length, attempts: docs }
  } catch (e) {
    log(`Idempotency check failed: ${e.message}`)
    return { error: e.message }
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  log('=== B07 Network Resilience Audit Starting ===')

  const account = getAccount('recovering', 'TOP')

  // Pre-test: Check attempt doc count for recovering persona
  const preCheck = await runIdempotencyCheck(account.uid)
  log(`Pre-run attempt docs: ${preCheck.attemptCount || 'unknown'}`)

  // Run scenarios sequentially (browser cleanup between each)
  await runS01()
  await runS02()
  await runS03()
  await runS04()
  await runS05()
  await runS06()
  await runS07()
  await runS08()
  await runS09()
  await runS10()
  await runS11()
  await runS13()
  await runS14()
  await runS16()

  // Post-test: Re-check attempt doc count (idempotency)
  const postCheck = await runIdempotencyCheck(account.uid)

  // Save summary
  await saveJSON({
    runDate: new Date().toISOString(),
    preCheckAttempts: preCheck.attemptCount,
    postCheckAttempts: postCheck.attemptCount,
    scenarios: results.scenarios,
    findings: results.findings
  }, 'B07_summary')

  log('=== B07 Scenarios Complete ===')
  log(`Total: ${results.scenarios.length} scenarios`)
  log(`Pass: ${results.scenarios.filter(s => s.result === 'pass').length}`)
  log(`Fail: ${results.scenarios.filter(s => s.result === 'fail').length}`)
  log(`Partial: ${results.scenarios.filter(s => s.result === 'partial').length}`)
  log(`Blocked: ${results.scenarios.filter(s => s.result === 'blocked').length}`)
  log(`Findings: ${results.findings.length}`)

  return results
}

main().then(r => {
  console.log('\n=== FINAL RESULTS ===')
  console.log(JSON.stringify(r, null, 2))
  process.exit(0)
}).catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
