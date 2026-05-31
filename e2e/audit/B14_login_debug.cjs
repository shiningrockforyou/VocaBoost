const { chromium } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B14'
const BASE_URL = 'https://vocaboostone.netlify.app'
const SEEDED = JSON.parse(fs.readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
const CAREFUL_TOP = SEEDED.accounts.find(a => a.personaId === 'careful' && a.targetClass === 'TOP')

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    
    // Listen to navigation events
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        console.log('Navigated to:', frame.url())
      }
    })
    
    const errors = []
    const logs = []
    page.on('console', m => {
      logs.push(`[${m.type()}] ${m.text()}`)
      if (m.type() === 'error') errors.push(m.text())
    })
    
    console.log('Step 1: Navigate to base URL')
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    console.log('Current URL:', page.url())
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_login_debug_01.png'), fullPage: true })
    
    const bodyText1 = await page.textContent('body')
    console.log('Page text after goto:', bodyText1.substring(0, 300))
    
    // Check if we're on login page or dashboard
    const onLogin = bodyText1.includes('Sign in') || bodyText1.includes('Email') || bodyText1.includes('Login')
    const onDashboard = bodyText1.includes('Dashboard') || bodyText1.includes('Weekly Goals')
    console.log('On login?', onLogin, 'On dashboard?', onDashboard)
    
    if (onLogin) {
      console.log('Step 2: Fill login form')
      const emailInput = page.locator('input[type="email"]').first()
      await emailInput.fill(CAREFUL_TOP.email)
      const passwordInput = page.locator('input[type="password"]').first()
      await passwordInput.fill(CAREFUL_TOP.password)
      
      console.log('Step 3: Click Continue button')
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      
      console.log('Step 4: Wait for navigation...')
      // Wait a bit to see what happens
      await page.waitForTimeout(5000)
      console.log('URL after 5s:', page.url())
      await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_login_debug_02.png'), fullPage: true })
      
      const bodyText2 = await page.textContent('body')
      console.log('Page text after login:', bodyText2.substring(0, 500))
      console.log('Console logs:', logs.slice(0, 10))
    } else if (onDashboard) {
      console.log('Already on dashboard!')
    }
    
    await context.close()
  } finally {
    await browser.close()
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
