/**
 * B07 S16 recheck — what is the "34-char" content at offline time?
 */
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'fs'

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B07'
const SEEDED = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
const BASE_URL = 'https://vocaboostone.netlify.app'

function getAccount(personaId, targetClass = 'TOP') {
  return SEEDED.accounts.find(a => a.personaId === personaId && a.targetClass === targetClass)
}

async function loginAs(page, personaId, targetClass = 'TOP') {
  const account = getAccount(personaId, targetClass)
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.evaluate(async () => {
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const r of regs) await r.unregister()
    }
  })
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
    const btn = page.getByRole('button', { name: /continue|log\s?in/i }).first()
    if (await btn.isVisible().catch(() => false)) await btn.click()
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(() => {})
  })
  return account
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  const consoleLog = []
  const pageErrors = []
  page.on('console', msg => consoleLog.push({ type: msg.type(), text: msg.text().substring(0, 400) }))
  page.on('pageerror', e => pageErrors.push(e.message))

  try {
    const account = await loginAs(page, 'distracted', 'TOP')
    console.log(`Logged in as ${account.email}`)

    // Capture dashboard
    const dashContent = await page.evaluate(() => document.body?.innerText || '')
    console.log(`Dashboard content (first 200): "${dashContent.substring(0, 200)}"`)

    // Try to start a session
    const sessionBtns = await page.getByRole('button', { name: /start|begin|study|continue|resume/i }).all()
    console.log(`Session buttons: ${sessionBtns.length}`)

    if (sessionBtns.length > 0) {
      await sessionBtns[0].click()
      await page.waitForTimeout(3000)

      const sessionContent = await page.evaluate(() => document.body?.innerText || '')
      console.log(`Session content (first 300): "${sessionContent.substring(0, 300)}"`)
      console.log(`Session content length: ${sessionContent.length}`)

      await page.screenshot({ path: `${EVIDENCE_DIR}/B07_S16_recheck_01_in_session.png`, fullPage: true })

      // Now go offline
      await context.setOffline(true)
      console.log('Went offline')
      await page.waitForTimeout(5000)

      const offlineContent = await page.evaluate(() => document.body?.innerText || '')
      console.log(`OFFLINE content length: ${offlineContent.length}`)
      console.log(`OFFLINE content: "${offlineContent}"`)
      console.log(`OFFLINE title: ${await page.title()}`)
      console.log(`OFFLINE URL: ${page.url()}`)

      // Get HTML too for debugging
      const html = await page.evaluate(() => document.body?.innerHTML || '')
      console.log(`OFFLINE body HTML (first 500): ${html.substring(0, 500)}`)

      await page.screenshot({ path: `${EVIDENCE_DIR}/B07_S16_recheck_02_offline.png`, fullPage: true })

      // Come back online
      await context.setOffline(false)
      console.log('Back online')
      await page.waitForTimeout(5000)

      const onlineContent = await page.evaluate(() => document.body?.innerText || '')
      console.log(`ONLINE content length: ${onlineContent.length}`)
      console.log(`ONLINE content (first 300): "${onlineContent.substring(0, 300)}"`)

      await page.screenshot({ path: `${EVIDENCE_DIR}/B07_S16_recheck_03_online.png`, fullPage: true })
    } else {
      // No session button — capture what the dashboard shows
      await page.screenshot({ path: `${EVIDENCE_DIR}/B07_S16_recheck_00_no_session.png`, fullPage: true })
      console.log('No session buttons found')

      // Try going offline directly from dashboard
      await context.setOffline(true)
      console.log('Went offline from dashboard')
      await page.waitForTimeout(5000)

      const offlineContent = await page.evaluate(() => document.body?.innerText || '')
      console.log(`OFFLINE dashboard content length: ${offlineContent.length}`)
      console.log(`OFFLINE dashboard content: "${offlineContent.substring(0, 300)}"`)

      await page.screenshot({ path: `${EVIDENCE_DIR}/B07_S16_recheck_dash_offline.png`, fullPage: true })

      await context.setOffline(false)
      await page.waitForTimeout(3000)

      const onlineContent = await page.evaluate(() => document.body?.innerText || '')
      console.log(`ONLINE dashboard content length: ${onlineContent.length}`)
    }

    console.log('\nConsole errors:')
    consoleLog.filter(l => l.type === 'error').forEach(l => console.log(' -', l.text))
    console.log('\nPage errors:')
    pageErrors.forEach(e => console.log(' -', e))

    writeFileSync(`${EVIDENCE_DIR}/B07_S16_recheck.json`, JSON.stringify({
      account: account.email,
      consoleLog: consoleLog.slice(0, 30),
      pageErrors
    }, null, 2))

  } finally {
    await browser.close()
  }
}

main().then(() => process.exit(0)).catch(e => {
  console.error('Error:', e)
  process.exit(1)
})
