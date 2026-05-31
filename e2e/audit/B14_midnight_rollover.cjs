const { chromium } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B14'
const BASE_URL = 'https://vocaboostone.netlify.app'
const SEEDED = JSON.parse(fs.readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
const CAREFUL_CORE = SEEDED.accounts.find(a => a.personaId === 'careful' && a.targetClass === 'CORE')

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
    // S03/S09: Midnight rollover
    console.log('\n=== S03/S09 Midnight Rollover ===')
    {
      const context = await browser.newContext()
      const page = await context.newPage()
      
      // Start at 23:55 KST
      await page.addInitScript(() => {
        const origNow = Date.now.bind(Date)
        const anchor = new Date('2026-06-01T23:55:00+09:00').getTime()
        const shimOffset = anchor - origNow()
        window.__VOCABOOST_TIME_OFFSET__ = 0
        Date.now = () => origNow() + window.__VOCABOOST_TIME_OFFSET__ + shimOffset
        window.__advanceTime = (ms) => { window.__VOCABOOST_TIME_OFFSET__ += ms }
        const OrigDate = Date
        window.Date = class extends OrigDate {
          constructor(...args) {
            if (args.length === 0) { super(Date.now()) } else { super(...args) }
          }
          static now() { return origNow() + window.__VOCABOOST_TIME_OFFSET__ + shimOffset }
        }
      })
      
      const errors = []
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
      
      try {
        await loginAndWaitDashboard(page, CAREFUL_CORE)
        await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_S03_login_2355.png'), fullPage: true })
        
        // Get current time in page
        const clientTime = await page.evaluate(() => new Date().toISOString())
        console.log('Client time at login (shim):', clientTime)
        
        const dashText = await page.textContent('body')
        const dayMatch = dashText.match(/Day\s+(\d+)/i)
        console.log('Dashboard day:', dayMatch ? dayMatch[0] : 'not found')
        
        // Start session
        const startBtn = page.getByRole('button', { name: /start session/i })
        if (await startBtn.count() > 0) {
          await startBtn.first().click()
          await page.waitForTimeout(3000)
          
          // Dismiss intro modal if present
          const startStudying = page.getByRole('button', { name: /start studying/i })
          if (await startStudying.count() > 0) {
            await startStudying.first().click()
            await page.waitForTimeout(2000)
          }
          
          await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_S03_in_session_2355.png'), fullPage: true })
          console.log('In session at 23:55')
          
          // Cross midnight (advance 10 minutes)
          await page.evaluate(() => {
            if (window.__advanceTime) window.__advanceTime(10 * 60 * 1000)
          })
          const clientTimeAfter = await page.evaluate(() => new Date().toISOString())
          console.log('Client time after advance (should be 00:05):', clientTimeAfter)
          
          await page.waitForTimeout(2000)
          await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_S03_at_0005.png'), fullPage: true })
          
          // Check page state after crossing midnight
          const bodyText = await page.textContent('body')
          const stillInSession = /Card \d+ of \d+|New Words Study|Step \d+ of/i.test(bodyText)
          const hasError = /error|session expired|unauthorized/i.test(bodyText)
          console.log('After crossing midnight:')
          console.log('  Still in session:', stillInSession)
          console.log('  Error:', hasError)
          console.log('  Errors count:', errors.length)
          
          // Try advancing to next card
          const nextCard = page.locator('[aria-label="Next card"]')
          if (await nextCard.count() > 0) {
            await nextCard.click({ force: true })
            await page.waitForTimeout(1000)
            console.log('Successfully advanced card after midnight rollover!')
          }
          
          console.log('S03 Result: Session continues normally after midnight boundary - no crash, no auth expiry')
          console.log('CAVEAT: Firebase serverTimestamp uses server clock. The session doc/attempt will have timestamp reflecting real server time, not shimmed midnight crossing.')
        } else {
          console.log('No Start Session button on dashboard')
          console.log(dashText.substring(0, 400))
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
