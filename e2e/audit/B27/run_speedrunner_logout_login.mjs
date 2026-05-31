/**
 * SPD27 Logout/login scenario — run in isolation as the main run crashed before it
 * Fresh browser context. Tests whether in-progress typed-test work is preserved after logout.
 */

import { chromium } from 'playwright'
import { writeFileSync, mkdirSync, appendFileSync } from 'fs'
import { join } from 'path'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EMAIL = 'audit_speedrunner_01_top@vocaboost.test'
const PASSWORD = 'AuditPass2026!'
const CHROMIUM_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B27/speedrunner'
const AGENT_LOGS_DIR = '/app/audit/playwright/findings/agent_logs'

mkdirSync(EVIDENCE_DIR, { recursive: true })
mkdirSync(AGENT_LOGS_DIR, { recursive: true })

const jsonlPath = join(AGENT_LOGS_DIR, 'SPD27.jsonl')
function log(event) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event })
  appendFileSync(jsonlPath, line + '\n')
  console.log('[LOG]', JSON.stringify(event).substring(0, 200))
}

const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH })

const result = {
  answeredCount: 0,
  logoutSucceeded: false,
  loginSucceeded: false,
  recoveryState: null,
  localStorageBeforeLogout: null,
  localStorageAfterLogin: null,
  errors: []
}

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()

try {
  log({ type: 'logout_login_scenario_start' })

  // Login
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(2000)

  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await loginLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await loginLink.click()
    await page.waitForTimeout(1500)
  }

  const emailInput = page.getByLabel(/email/i).first()
  await emailInput.waitFor({ timeout: 15000 })
  await emailInput.fill(EMAIL)
  await page.getByLabel(/password/i).first().fill(PASSWORD)
  await page.getByLabel(/password/i).first().press('Enter')

  await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
    const btn = page.getByRole('button', { name: /continue|log\s?in/i }).first()
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click()
      await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(() => {})
    }
  })
  await page.waitForTimeout(2000)
  log({ type: 'logged_in' })

  // Screenshot dashboard
  await page.screenshot({ path: join(EVIDENCE_DIR, 'logout_login_dashboard.png'), fullPage: false }).catch(() => {})

  // Navigate to session
  const startBtn = page.getByRole('button', { name: /start session/i }).first()
  const continueBtn = page.getByRole('button', { name: /continue session/i }).first()

  if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await startBtn.click()
  } else if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await continueBtn.click()
  } else {
    // Try class card
    const classCard = page.getByText('25WT 2차 TOP OFFLINE').first()
    if (await classCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await classCard.click()
      await page.waitForTimeout(1000)
      const sb = page.getByRole('button', { name: /start session/i }).first()
      if (await sb.isVisible({ timeout: 3000 }).catch(() => false)) await sb.click()
    }
  }
  await page.waitForTimeout(3000)

  // Dismiss modal
  const startStudying = page.getByRole('button', { name: /start studying/i }).first()
  if (await startStudying.isVisible({ timeout: 2000 }).catch(() => false)) {
    await startStudying.click()
    await page.waitForTimeout(500)
  }

  // Skip to test
  let menuBtn = page.locator('[aria-label="Session menu"]')
  if (!await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    menuBtn = page.getByRole('button', { name: /session menu/i }).first()
  }

  if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await menuBtn.click()
    await page.waitForTimeout(500)
    const skipText = page.getByText(/skip to test/i).first()
    if (await skipText.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipText.click()
      await page.waitForTimeout(800)
      const confirmBtn = page.getByRole('button', { name: /start test|confirm/i }).first()
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click()
      }
    }
  }
  await page.waitForTimeout(2000)

  // Screenshot: on test page
  await page.screenshot({ path: join(EVIDENCE_DIR, 'logout_login_test_page.png'), fullPage: false }).catch(() => {})

  // Answer a few questions (speedrunner: type fast, first word)
  const inputs = page.locator('input[type="text"]')
  const inputCount = await inputs.count().catch(() => 0)
  log({ type: 'test_page_inputs', count: inputCount })

  const answersGiven = Math.min(inputCount, 4)
  for (let i = 0; i < answersGiven; i++) {
    const inp = inputs.nth(i)
    await inp.click({ timeout: 3000 }).catch(() => {})
    await inp.type('word', { delay: 15 }).catch(() => {})
    result.answeredCount++
  }

  // Capture localStorage before logout
  result.localStorageBeforeLogout = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(k =>
      k.includes('vocaboost') || k.includes('session') || k.includes('firebase')
    )
    const out = {}
    for (const k of keys) {
      out[k] = localStorage.getItem(k)?.substring(0, 100)
    }
    return out
  }).catch(() => null)

  log({
    type: 'before_logout',
    answeredCount: result.answeredCount,
    lsKeys: Object.keys(result.localStorageBeforeLogout || {})
  })

  // Screenshot before logout
  await page.screenshot({ path: join(EVIDENCE_DIR, 'logout_login_before_logout.png'), fullPage: false }).catch(() => {})

  // === LOG OUT ===
  // Try to find logout via user/profile menu in header
  let loggedOut = false

  // Strategy 1: Look for account/avatar menu
  const headerBtns = page.locator('header button, nav button').all().catch(() => [])
  const hBtns = await headerBtns
  for (const btn of hBtns.slice(0, 5)) {
    const label = await btn.getAttribute('aria-label').catch(() => '')
    const text = await btn.textContent().catch(() => '')
    if (/logout|sign out|account|user|profile|menu/i.test(label + text)) {
      await btn.click().catch(() => {})
      await page.waitForTimeout(500)
      const logoutItem = page.getByText(/log out|sign out|logout/i).first()
      if (await logoutItem.isVisible({ timeout: 1000 }).catch(() => false)) {
        await logoutItem.click()
        loggedOut = true
        break
      }
    }
  }

  // Strategy 2: Look for any visible logout text directly
  if (!loggedOut) {
    const logoutLink = page.getByText(/log out|sign out/i).first()
    if (await logoutLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await logoutLink.click()
      loggedOut = true
    }
  }

  // Strategy 3: Click any button-like thing near the user name
  if (!loggedOut) {
    // Try to find initials/avatar button (often shows user's first letter)
    const allBtns = page.getByRole('button')
    const btnCount = await allBtns.count().catch(() => 0)
    for (let i = 0; i < Math.min(btnCount, 10) && !loggedOut; i++) {
      const btnText = await allBtns.nth(i).textContent().catch(() => '')
      // Click buttons that look like avatar (single char) or profile-related
      if (btnText.trim().length === 1 || /A|Sp|S|Speed/i.test(btnText.trim())) {
        await allBtns.nth(i).click().catch(() => {})
        await page.waitForTimeout(400)
        const logoutItem = page.getByText(/log out|sign out|logout/i).first()
        if (await logoutItem.isVisible({ timeout: 1000 }).catch(() => false)) {
          await logoutItem.click()
          loggedOut = true
          break
        }
        // Close menu
        await page.keyboard.press('Escape').catch(() => {})
      }
    }
  }

  if (!loggedOut) {
    // Take screenshot to document the failed logout attempt
    await page.screenshot({ path: join(EVIDENCE_DIR, 'logout_login_logout_fail.png'), fullPage: false }).catch(() => {})
    // DOM snapshot
    const bodyText = await page.locator('body').textContent().catch(() => '')
    log({ type: 'logout_failed', bodySnippet: bodyText.substring(0, 300), inputCount })

    result.logoutSucceeded = false
    result.recoveryState = 'error'
    result.errors.push('Could not find logout button — UI logout locator failed')
  } else {
    result.logoutSucceeded = true
    await page.waitForTimeout(2000)
    await page.screenshot({ path: join(EVIDENCE_DIR, 'logout_login_after_logout.png'), fullPage: false }).catch(() => {})
    log({ type: 'logout_succeeded' })

    // Re-login
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)

    const loginLink2 = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
    if (await loginLink2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginLink2.click()
      await page.waitForTimeout(1500)
    }

    const emailInput2 = page.getByLabel(/email/i).first()
    if (await emailInput2.isVisible({ timeout: 10000 }).catch(() => false)) {
      await emailInput2.fill(EMAIL)
      await page.getByLabel(/password/i).first().fill(PASSWORD)
      await page.getByLabel(/password/i).first().press('Enter')
      await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(() => {})
      result.loginSucceeded = true
    }
    await page.waitForTimeout(2000)

    // Capture localStorage after login
    result.localStorageAfterLogin = await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter(k =>
        k.includes('vocaboost') || k.includes('session') || k.includes('firebase')
      )
      const out = {}
      for (const k of keys) {
        out[k] = localStorage.getItem(k)?.substring(0, 100)
      }
      return out
    }).catch(() => null)

    // Navigate to session to check recovery
    const startBtn2 = page.getByRole('button', { name: /start session/i }).first()
    const continueBtn2 = page.getByRole('button', { name: /continue session/i }).first()
    if (await startBtn2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startBtn2.click()
      await page.waitForTimeout(2000)
    } else if (await continueBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn2.click()
      await page.waitForTimeout(2000)
    }

    const bodyAfterLogin = await page.locator('body').textContent().catch(() => '')
    await page.screenshot({ path: join(EVIDENCE_DIR, 'logout_login_after_relogin.png'), fullPage: false }).catch(() => {})

    const hasRecovery = /recover|resume|continue where|in.progress/i.test(bodyAfterLogin)
    const hasClean = /start session|step 1|new words/i.test(bodyAfterLogin)
    const lsBefore = result.localStorageBeforeLogout || {}
    const lsAfter = result.localStorageAfterLogin || {}
    const preservedKeys = Object.keys(lsBefore).filter(k => lsAfter[k] !== undefined)

    if (hasRecovery) {
      result.recoveryState = 'recovered'
    } else {
      // Check if answers might be in localStorage
      result.recoveryState = preservedKeys.length > 0 ? 'clean_restart' : 'lost'
    }

    log({
      type: 'logout_login_result',
      recoveryState: result.recoveryState,
      lsBeforeKeys: Object.keys(lsBefore),
      lsAfterKeys: Object.keys(lsAfter),
      preservedKeys
    })
  }

} catch(err) {
  result.errors.push(err.message)
  result.recoveryState = 'error'
  log({ type: 'logout_login_error', error: err.message })
  await page.screenshot({ path: join(EVIDENCE_DIR, 'logout_login_error.png'), fullPage: false }).catch(() => {})
} finally {
  await page.close().catch(() => {})
  await context.close().catch(() => {})
  await browser.close()
}

console.log('\n=== Logout/Login Result ===')
console.log(JSON.stringify(result, null, 2))

// Save result to evidence
writeFileSync(join(EVIDENCE_DIR, 'logout_login_result.json'), JSON.stringify({
  ...result,
  capturedAt: new Date().toISOString()
}, null, 2))
log({ type: 'logout_login_scenario_done', result })
