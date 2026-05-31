/**
 * B18 — Teacher Gradebook audit
 * Agent: V
 * Chat-log #13: gradebook day vs student day mismatch
 */

import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B18'
const TEACHER_EMAIL = 'veterans@vocaboost.com'
const TEACHER_PASS = 'veterans5944'

mkdirSync(EVIDENCE_DIR, { recursive: true })

let screenshotIndex = 0
async function screenshot(page, label) {
  const fname = `B18_${String(++screenshotIndex).padStart(2, '0')}_${label}.png`
  const fpath = path.join(EVIDENCE_DIR, fname)
  await page.screenshot({ path: fpath, fullPage: true })
  console.log('Screenshot:', fname)
  return fname
}

async function consoleMessages(page) {
  // Returns any stored console messages
  return page._consoleMessages || []
}

const consoleLog = []

async function loginAsTeacher(page) {
  console.log('Navigating to root to warm SPA...')
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(2000)

  // Check if already redirected to login
  const currentUrl = page.url()
  console.log('Current URL after root nav:', currentUrl)

  if (!currentUrl.includes('/login')) {
    // Navigate to login via link or pushState
    const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
    const linkCount = await loginLink.count()
    if (linkCount > 0) {
      await loginLink.click()
    } else {
      await page.evaluate(() => {
        history.pushState({}, '', '/login')
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
    }
    await page.waitForTimeout(1500)
  }

  console.log('URL before login form:', page.url())
  await screenshot(page, 'pre_login')

  // Fill email
  const emailInput = page.getByLabel(/email/i).first()
  await emailInput.waitFor({ timeout: 15000 })
  await emailInput.fill(TEACHER_EMAIL)

  const passwordInput = page.getByLabel(/password/i).first()
  await passwordInput.fill(TEACHER_PASS)

  // Submit
  await passwordInput.press('Enter')

  // Wait for dashboard
  try {
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  } catch (e) {
    // Try clicking a button
    const btn = page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first()
    if (await btn.count() > 0) await btn.click()
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  }

  console.log('Logged in. URL:', page.url())
  await screenshot(page, 'post_login')
}

async function navigateToGradebook(page) {
  // Teacher should see class list on dashboard
  // Look for teacher panel / class management
  await screenshot(page, 'teacher_dashboard')

  const snap = await page.content()
  console.log('Page content snippet (first 2000 chars):')
  console.log(snap.substring(0, 2000))

  // Look for navigation to classes or gradebook
  // Common patterns: Classes link, Gradebook link, Manage Classes
  const classesLink = page.getByRole('link', { name: /class|gradebook|manage/i }).first()
  const classesLinkCount = await classesLink.count()
  console.log('Classes/gradebook link count:', classesLinkCount)

  if (classesLinkCount > 0) {
    const linkText = await classesLink.textContent()
    console.log('First nav link text:', linkText)
  }

  return snap
}

async function run() {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
  })

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })

  // Capture console messages
  const page = await context.newPage()
  page.on('console', msg => {
    consoleLog.push({ type: msg.type(), text: msg.text(), ts: new Date().toISOString() })
  })
  page.on('pageerror', err => {
    consoleLog.push({ type: 'pageerror', text: err.toString(), ts: new Date().toISOString() })
  })

  const results = {
    S01: null, S02: null, S03: null, S04: null, S05: null,
    S06: null, S07: null, S08: null, S09: null, S10: null,
    S11: null, S12: null, S13: null,
  }

  try {
    // S01 — Login as teacher and examine gradebook
    console.log('\n=== S01: Teacher login and gradebook access ===')
    await loginAsTeacher(page)

    const dashboardContent = await navigateToGradebook(page)
    await screenshot(page, 'S01_teacher_nav')

    // Identify all navigation links
    const allLinks = await page.getByRole('link').all()
    console.log('All navigation links:')
    for (const link of allLinks) {
      const text = await link.textContent().catch(() => '')
      const href = await link.getAttribute('href').catch(() => '')
      if (text || href) console.log(' ', text?.trim(), '->', href)
    }

    // Look for class links or teacher UI elements
    const classCards = await page.locator('[class*="class"], [class*="Class"]').all()
    console.log('Class card elements:', classCards.length)

    results.S01 = 'checking'

  } catch (e) {
    console.error('S01 error:', e.message)
    results.S01 = 'error: ' + e.message
    await screenshot(page, 'S01_error')
  } finally {
    // Save console log
    writeFileSync(
      path.join(EVIDENCE_DIR, 'B18_console.json'),
      JSON.stringify(consoleLog, null, 2)
    )
    await browser.close()
  }

  return results
}

run().then(r => {
  console.log('\nResults:', JSON.stringify(r, null, 2))
}).catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
