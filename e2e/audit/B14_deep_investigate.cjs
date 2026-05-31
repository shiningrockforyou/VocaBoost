const { chromium } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B14'
const BASE_URL = 'https://vocaboostone.netlify.app'
const SEEDED = JSON.parse(fs.readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
const DISTRACTED_TOP = SEEDED.accounts.find(a => a.personaId === 'distracted' && a.targetClass === 'TOP')
const CAREFUL_TOP = SEEDED.accounts.find(a => a.personaId === 'careful' && a.targetClass === 'TOP')
const CAREFUL_CORE = SEEDED.accounts.find(a => a.personaId === 'careful' && a.targetClass === 'CORE')

async function loginAndWaitDashboard(page, account) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)
  const bodyNow = await page.textContent('body').catch(() => '')
  if (bodyNow.includes('Weekly Goals') || bodyNow.includes('Start Session')) {
    return
  }
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
    // === Test 1: Navigate to session flow and investigate MCQ selector ===
    console.log('\n=== TEST 1: Session flow and MCQ investigation ===')
    {
      const context = await browser.newContext()
      const page = await context.newPage()
      const errors = []
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
      
      try {
        await loginAndWaitDashboard(page, CAREFUL_TOP)
        await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_deep_01_dashboard.png'), fullPage: true })
        
        const dashText = await page.textContent('body')
        console.log('Dashboard text:', dashText.substring(0, 500))
        
        // Click Start Session
        const startBtn = page.getByRole('button', { name: /start session/i })
        if (await startBtn.count() > 0) {
          console.log('Clicking Start Session')
          await startBtn.first().click()
          await page.waitForTimeout(3000)
          await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_deep_02_after_start.png'), fullPage: true })
          
          const step1Text = await page.textContent('body')
          console.log('After start text:', step1Text.substring(0, 500))
          console.log('URL:', page.url())
          
          // Check for word cards
          const wordCardBtns = await page.getByRole('button').all()
          const wordCardBtnTexts = await Promise.all(wordCardBtns.map(b => b.textContent().catch(() => '')))
          console.log('Buttons available:', wordCardBtnTexts.filter(t => t.trim()))
          
          // Try Skip to Test
          const skipBtn = page.getByRole('button', { name: /skip/i })
          if (await skipBtn.count() > 0) {
            console.log('Found Skip button, clicking')
            await skipBtn.first().click()
            await page.waitForTimeout(3000)
            await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_deep_03_after_skip.png'), fullPage: true })
            
            const skipText = await page.textContent('body')
            console.log('After skip text:', skipText.substring(0, 500))
            
            // Look for MCQ options
            const radioOptions = page.locator('[role="radio"], input[type="radio"], button[data-selected]')
            const radioCount = await radioOptions.count()
            console.log('Radio options count:', radioCount)
            
            // Look for all buttons
            const allBtns = await page.getByRole('button').all()
            const allBtnTexts = await Promise.all(allBtns.map(b => b.textContent().catch(() => '')))
            console.log('All buttons after skip:', allBtnTexts.filter(t => t.trim()))
            
            // Check for MCQ-like elements
            const listItems = page.locator('li, [role="option"], .mcq-option, [class*="option"]')
            console.log('List items:', await listItems.count())
            
            await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_deep_04_test_page.png'), fullPage: true })
          } else {
            // Try to click through word cards
            console.log('No skip button, trying to advance through cards')
            for (let i = 0; i < 5; i++) {
              const nextBtn = page.getByRole('button', { name: /next|got it|continue|i know/i })
              if (await nextBtn.count() > 0) {
                await nextBtn.first().click()
                await page.waitForTimeout(1000)
              } else {
                break
              }
            }
            await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_deep_03b_after_cards.png'), fullPage: true })
            const cardText = await page.textContent('body')
            console.log('After advancing cards:', cardText.substring(0, 400))
          }
        } else {
          console.log('No Start Session button found')
          const allBtns = await page.getByRole('button').all()
          const allBtnTexts = await Promise.all(allBtns.map(b => b.textContent().catch(() => '')))
          console.log('Available buttons:', allBtnTexts.filter(t => t.trim()))
        }
        
        console.log('Console errors:', errors.length, errors.slice(0, 3))
      } catch (e) {
        console.error('Error in test 1:', e.message)
      } finally {
        await context.close()
      }
    }

    // === Test 2: Weekend behavior - Saturday ===
    console.log('\n=== TEST 2: Saturday weekend behavior ===')
    {
      const context = await browser.newContext()
      const page = await context.newPage()
      
      // Saturday shim
      await page.addInitScript(() => {
        const origNow = Date.now.bind(Date)
        const anchor = new Date('2026-05-30T10:00:00+09:00').getTime() // Saturday
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
      
      try {
        await loginAndWaitDashboard(page, DISTRACTED_TOP)
        await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_S05_saturday_dashboard.png'), fullPage: true })
        
        const satText = await page.textContent('body')
        console.log('Saturday dashboard:', satText.substring(0, 800))
        
        // Check for Start Session button on Saturday
        const startBtn = page.getByRole('button', { name: /start session/i })
        const hasStart = await startBtn.count() > 0
        console.log('Saturday has Start Session button:', hasStart)
        
        // Look for any weekend/rest day indicator
        const hasWeekendMsg = /weekend|rest day|no study|saturday|sunday/i.test(satText)
        console.log('Has weekend message:', hasWeekendMsg)
        
        if (hasStart) {
          console.log('FINDING: Saturday allows session start despite studyDaysPerWeek=5')
          // Try clicking start to confirm it works
          await startBtn.first().click()
          await page.waitForTimeout(3000)
          await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_S05_saturday_session_start.png'), fullPage: true })
          const sessionText = await page.textContent('body')
          console.log('After clicking start on Saturday:', sessionText.substring(0, 400))
        }
      } catch (e) {
        console.error('Error in test 2:', e.message)
      } finally {
        await context.close()
      }
    }
    
    // === Test 3: Dual class_progress document investigation ===
    console.log('\n=== TEST 3: Dashboard shows which class_progress doc? ===')
    {
      const context = await browser.newContext()
      const page = await context.newPage()
      
      try {
        await loginAndWaitDashboard(page, CAREFUL_TOP)
        await page.screenshot({ path: path.join(EVIDENCE_DIR, 'B14_S15_careful_top_dashboard.png'), fullPage: true })
        const dashText = await page.textContent('body')
        // Extract key stats
        const dayMatch = dashText.match(/Day\s+(\d+)/i)
        const streakMatch = dashText.match(/Current Streak[:\s]+(\d+)/i)
        const csdMatch = dashText.match(/currentStudyDay[:\s]+(\d+)/i)
        console.log('Dashboard stats:')
        console.log('  Day match:', dayMatch ? dayMatch[0] : 'not found')
        console.log('  Streak match:', streakMatch ? streakMatch[0] : 'not found')
        // Firestore shows CSD=8,streak=7 (classId doc) vs CSD=3,streak=3 (classId_listId doc)
        console.log('Full dashboard text:', dashText.substring(0, 1000))
      } catch (e) {
        console.error('Error in test 3:', e.message)
      } finally {
        await context.close()
      }
    }

  } finally {
    await browser.close()
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
