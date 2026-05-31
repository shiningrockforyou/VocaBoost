const { chromium } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B14'
const BASE_URL = 'https://vocaboostone.netlify.app'
const SEEDED = JSON.parse(fs.readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
const CAREFUL_TOP = SEEDED.accounts.find(a => a.personaId === 'careful' && a.targetClass === 'TOP')

async function loginAndWaitDashboard(page, account) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)
  const bodyNow = await page.textContent('body').catch(() => '')
  if (bodyNow.includes('Weekly Goals') || bodyNow.includes('Start Session')) return
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.locator('input[type="email"]').first().fill(account.email)
  await page.locator('input[type="password"]').first().fill(account.password)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(1000)
    const txt = await page.textContent('body').catch(() => '')
    if (txt.includes('Weekly Goals') || txt.includes('Start Session') || txt.includes('Day ')) break
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    // Test S01/S02: Auth token validity after simulated long idle
    console.log('\n=== Auth Token Idle Test ===')
    {
      const context = await browser.newContext()
      const page = await context.newPage()
      
      // Install 65-min time shim (same as S02)
      await page.addInitScript(() => {
        const origNow = Date.now.bind(Date)
        const shimOffset = new Date('2026-06-01T09:00:00+09:00').getTime() - origNow()
        window.__VOCABOOST_TIME_OFFSET__ = 0
        Date.now = () => origNow() + window.__VOCABOOST_TIME_OFFSET__ + shimOffset
        window.__advanceTime = (ms) => { window.__VOCABOOST_TIME_OFFSET__ += ms }
      })
      
      const errors = []
      const warnings = []
      page.on('console', m => {
        if (m.type() === 'error') errors.push(m.text())
        if (m.type() === 'warning') warnings.push(m.text())
      })
      
      try {
        await loginAndWaitDashboard(page, CAREFUL_TOP)
        console.log('Logged in successfully')
        await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_S02_login_ok.png'), fullPage: true })
        
        // Click Start Session to enter session
        await page.getByRole('button', { name: /start session/i }).first().click()
        await page.waitForTimeout(3000)
        
        // Dismiss the "Start Studying" modal
        const startStudying = page.getByRole('button', { name: /start studying/i })
        if (await startStudying.count() > 0) {
          await startStudying.first().click()
          await page.waitForTimeout(2000)
        }
        
        await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_S02_in_session.png'), fullPage: true })
        console.log('Entered session (word card stage)')
        
        // Advance time by 65 minutes
        await page.evaluate(() => {
          if (window.__advanceTime) window.__advanceTime(65 * 60 * 1000)
        })
        console.log('Advanced 65 minutes')
        await page.waitForTimeout(3000)
        await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_S02_after_65min.png'), fullPage: true })
        
        // Check if still in session or if auth error
        const bodyText = await page.textContent('body')
        const hasAuthError = /sign in|log in|unauthorized|session expired|Please sign in/i.test(bodyText)
        const inSession = /Card \d+ of \d+|New Words Study|Step \d+ of/i.test(bodyText)
        
        console.log('After 65min idle:')
        console.log('  Auth error:', hasAuthError)
        console.log('  Still in session:', inSession)
        console.log('  Errors:', errors.length, errors.slice(0, 3))
        
        // Try to interact with the page
        const nextCard = page.locator('[aria-label="Next card"]')
        if (await nextCard.count() > 0) {
          console.log('Can still click Next card after 65min idle')
          await nextCard.click({ force: true })
          await page.waitForTimeout(1000)
          await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_S02_click_after_65min.png'), fullPage: true })
          console.log('Click succeeded - auth token still valid!')
        } else {
          console.log('No next card button - may have navigated away')
        }
        
      } catch (e) {
        console.error('Error:', e.message)
      } finally {
        await context.close()
      }
    }
    
  } finally {
    await browser.close()
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
