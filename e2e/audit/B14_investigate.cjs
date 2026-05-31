const { chromium } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B14'
const BASE_URL = 'https://vocaboostone.netlify.app'
const SEEDED = JSON.parse(fs.readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
const DISTRACTED_TOP = SEEDED.accounts.find(a => a.personaId === 'distracted' && a.targetClass === 'TOP')
const CAREFUL_TOP = SEEDED.accounts.find(a => a.personaId === 'careful' && a.targetClass === 'TOP')

async function loginAs(page, account) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  const emailInput = page.locator('input[type="email"]').first()
  await emailInput.fill(account.email)
  const passwordInput = page.locator('input[type="password"]').first()
  await passwordInput.fill(account.password)
  // Use exact "Continue" button
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.waitForURL(/\/$|\/dashboard/, { timeout: 20000 })
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    // Test 1: Distracted TOP - check dashboard after login (this account has sessions from B22)
    console.log('\n=== INVESTIGATE: Distracted TOP Dashboard ===')
    {
      const context = await browser.newContext()
      const page = await context.newPage()
      const errors = []
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
      
      try {
        await loginAs(page, DISTRACTED_TOP)
        await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_investigate_distracted_dashboard.png'), fullPage: true })
        const bodyText = await page.textContent('body')
        console.log('Distracted TOP dashboard text:', bodyText.substring(0, 600))
        console.log('Console errors:', errors.length, errors.slice(0, 5))
        
        // Look for session card / start button
        const buttons = await page.getByRole('button').all()
        const buttonTexts = await Promise.all(buttons.map(b => b.textContent().catch(() => '')))
        console.log('Buttons on page:', buttonTexts.filter(t => t.trim().length > 0))
        
        // Check if there's a session to start
        await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_S01_rerun_dashboard.png'), fullPage: true })
      } catch (e) {
        console.error('ERROR:', e.message)
      } finally {
        await context.close()
      }
    }

    // Test 2: Navigate to session for Careful TOP
    console.log('\n=== INVESTIGATE: Careful TOP session navigation ===')
    {
      const context = await browser.newContext()
      const page = await context.newPage()
      const errors = []
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
      
      try {
        await loginAs(page, CAREFUL_TOP)
        await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_investigate_careful_dashboard.png'), fullPage: true })
        const bodyText = await page.textContent('body')
        console.log('Careful TOP dashboard:', bodyText.substring(0, 800))
        
        // Look for Start button
        const startBtn = await page.getByRole('button', { name: /start/i }).count()
        console.log('Start buttons:', startBtn)
        
        // Try clicking any start button
        if (startBtn > 0) {
          await page.getByRole('button', { name: /start/i }).first().click()
          await page.waitForTimeout(3000)
          await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_investigate_careful_session.png'), fullPage: true })
          const sessionText = await page.textContent('body')
          console.log('Session page:', sessionText.substring(0, 500))
          
          // Check for skip to test
          const skipBtn = await page.getByRole('button', { name: /skip/i }).count()
          console.log('Skip buttons:', skipBtn)
          
          if (skipBtn > 0) {
            await page.getByRole('button', { name: /skip/i }).first().click()
            await page.waitForTimeout(3000)
            await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_investigate_careful_test.png'), fullPage: true })
            const testText = await page.textContent('body')
            console.log('Test page:', testText.substring(0, 500))
          }
        }
      } catch (e) {
        console.error('ERROR:', e.message)
      } finally {
        await context.close()
      }
    }
    
  } finally {
    await browser.close()
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
