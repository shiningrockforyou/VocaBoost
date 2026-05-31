/**
 * B03 routing investigation
 * Check if the app can navigate from dashboard to session to typed test
 * through client-side routing (not direct URL access)
 */
'use strict'

const { chromium } = require('playwright')
const fs = require('fs')
const https = require('https')

const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B03'
const SEEDED_PATH = '/app/audit/playwright/seeded_accounts.json'
const AUDIT_STATE_PATH = '/app/audit/playwright/audit_state.json'

const seeded = JSON.parse(fs.readFileSync(SEEDED_PATH, 'utf-8'))
const auditState = JSON.parse(fs.readFileSync(AUDIT_STATE_PATH, 'utf-8'))

async function screenshot(page, label) {
  const p = `${EVIDENCE_DIR}/${label}.png`
  await page.screenshot({ path: p, fullPage: true }).catch(() => {})
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()

  // Unregister service workers
  await page.addInitScript(() => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
    }
  })

  const account = seeded.accounts.find(a => a.personaId === 'careful' && a.targetClass === 'TOP')
  console.log('Logging in as:', account.email)

  // Login
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(2000)
  await screenshot(page, 'B03_routing_01_dashboard')

  // Find login link
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await loginLink.count() > 0) {
    await loginLink.click()
  } else {
    await page.evaluate(() => {
      history.pushState({}, '', '/login')
      dispatchEvent(new PopStateEvent('popstate'))
    })
  }

  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(account.email)
  await page.getByLabel(/password/i).first().fill(account.password)
  await page.getByLabel(/password/i).first().press('Enter')

  await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(async () => {
    await page.getByRole('button', { name: /continue|log\s?in/i }).first().click().catch(() => {})
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  })

  console.log('Logged in. URL:', page.url())
  await screenshot(page, 'B03_routing_02_logged_in')

  // See what's on the dashboard
  const bodyText = await page.locator('body').textContent()
  console.log('Dashboard content (first 500 chars):', bodyText?.substring(0, 500))

  // Find any "Start" or "Today" button or class card
  const buttons = await page.locator('button').all()
  const buttonTexts = await Promise.all(buttons.map(b => b.textContent()))
  console.log('Buttons on dashboard:', buttonTexts.filter(t => t?.trim()).join(' | '))

  // Look for a "Start" button or session link
  const startBtn = page.getByRole('button', { name: /start|study|session|begin|continue/i }).first()
  const sessionLink = page.getByRole('link', { name: /start|study|session|begin|today/i }).first()

  if (await startBtn.count() > 0) {
    console.log('Found Start button')
    await startBtn.click()
    await page.waitForTimeout(3000)
    console.log('After clicking Start, URL:', page.url())
    await screenshot(page, 'B03_routing_03_after_start')
  } else if (await sessionLink.count() > 0) {
    console.log('Found session link')
    await sessionLink.click()
    await page.waitForTimeout(3000)
    console.log('After clicking link, URL:', page.url())
    await screenshot(page, 'B03_routing_03_after_link')
  } else {
    console.log('No Start button or session link found directly')

    // Try client-side navigation
    const classInfo = auditState.classes.topClass
    const listInfo = auditState.lists.topActiveList

    console.log('Trying client-side navigate via pushState...')
    await page.evaluate((url) => {
      history.pushState({}, '', url)
      dispatchEvent(new PopStateEvent('popstate'))
    }, `/session/${classInfo.id}/${listInfo.id}`)
    await page.waitForTimeout(3000)
    console.log('After pushState, URL:', page.url())
    await screenshot(page, 'B03_routing_04_after_pushstate')

    const bodyAfter = await page.locator('body').textContent()
    console.log('Content after pushState:', bodyAfter?.substring(0, 300))
  }

  // One more check — look for any class cards with clickable areas
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)
  await screenshot(page, 'B03_routing_05_dashboard_again')

  // Check if there are class cards with progress
  const classCards = await page.locator('[class*="card"], [class*="surface"], [class*="rounded"]').all()
  console.log(`Dashboard cards: ${classCards.length}`)

  // Look for clickable areas that might start a session
  const allLinks = await page.locator('a').all()
  for (const link of allLinks) {
    const href = await link.getAttribute('href')
    const text = await link.textContent()
    if (href && (href.includes('session') || href.includes('test'))) {
      console.log(`  Link: "${text?.trim()}" → ${href}`)
    }
  }

  // Check for Dashboard component content more specifically
  const classContent = await page.locator('text=/25WT|TOP|CORE|Offline/i').all()
  console.log(`Class content elements: ${classContent.length}`)
  for (const el of classContent.slice(0, 5)) {
    console.log(`  Element: "${await el.textContent()}"`)
  }

  await browser.close()
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
