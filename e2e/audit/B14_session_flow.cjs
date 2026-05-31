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
    // Test with careful TOP - see what session flow looks like and find MCQ selectors
    const context = await browser.newContext()
    const page = await context.newPage()
    const errors = []
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    
    try {
      await loginAndWaitDashboard(page, CAREFUL_TOP)
      
      // Click Start Session
      await page.getByRole('button', { name: /start session/i }).first().click()
      await page.waitForTimeout(3000)
      await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_flow_01_word_cards.png'), fullPage: true })
      
      // Check for "Start Studying" button on word card page 
      const startStudying = page.getByRole('button', { name: /start studying/i })
      if (await startStudying.count() > 0) {
        console.log('Found "Start Studying" button - this is the intro modal')
        await startStudying.first().click()
        await page.waitForTimeout(2000)
        await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_flow_02_after_start_studying.png'), fullPage: true })
        
        const text2 = await page.textContent('body')
        console.log('After Start Studying:', text2.substring(0, 400))
        
        // Check for modal overlay 
        const modal = page.locator('.fixed.inset-0, [class*="modal"], [role="dialog"]')
        console.log('Modals:', await modal.count())
        
        // Look for "Got It", "Next", arrow buttons
        const allBtns = await page.getByRole('button').all()
        const btnData = await Promise.all(allBtns.map(async b => {
          const txt = await b.textContent().catch(() => '')
          const aria = await b.getAttribute('aria-label').catch(() => '')
          return { txt: txt.trim(), aria }
        }))
        console.log('Buttons after Start Studying:', btnData.filter(b => b.txt || b.aria))
      }
      
      // Look for navigation buttons (arrows, Next card)
      await page.waitForTimeout(1000)
      const arrowBtns = page.locator('[aria-label*="Next"], [aria-label*="next"], [aria-label*="card"]')
      console.log('Arrow buttons:', await arrowBtns.count())
      
      // Try to find the "Skip to test" button
      const skipBtns = await page.locator('button').all()
      const skipBtnTexts = await Promise.all(skipBtns.map(async b => {
        const txt = await b.textContent().catch(() => '')
        return txt.trim()
      }))
      console.log('All button texts:', skipBtnTexts.filter(t => t.length > 0))
      
      // Try clicking the specific "Start Studying" button in modal to dismiss
      await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_flow_03_current_state.png'), fullPage: true })
      
      // Navigate through word cards rapidly (click "Next card" 80 times to reach test)
      // The word card page shows "Card X of 80"
      const snapshot = await page.textContent('body')
      const cardMatch = snapshot.match(/Card (\d+) of (\d+)/)
      console.log('Card progress:', cardMatch ? `${cardMatch[1]} of ${cardMatch[2]}` : 'not found')
      
      if (cardMatch) {
        const total = parseInt(cardMatch[2])
        console.log(`Need to advance through ${total} cards`)
        
        // Click next card button repeatedly
        for (let i = 0; i < Math.min(total, 5); i++) {
          const nextCard = page.locator('[aria-label="Next card"]')
          if (await nextCard.count() > 0) {
            await nextCard.click({ force: true })
            await page.waitForTimeout(200)
          }
        }
        await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_flow_04_after_next_cards.png'), fullPage: true })
        const afterCards = await page.textContent('body')
        console.log('After clicking next cards:', afterCards.substring(0, 300))
        
        // Look for "Skip to Test" link/button
        const skipTest = page.locator('button, a').filter({ hasText: /skip.*test|go to test/i })
        console.log('Skip to test buttons:', await skipTest.count())
        
        // Check for any navigation link that says "Take Test"
        const testLinks = page.locator('a, button').filter({ hasText: /take test|start test|begin test/i })
        console.log('Test links:', await testLinks.count())
      }
      
      console.log('Console errors:', errors.length, errors.slice(0, 5))
    } catch (e) {
      console.error('Error:', e.message)
    } finally {
      await context.close()
    }
  } finally {
    await browser.close()
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
