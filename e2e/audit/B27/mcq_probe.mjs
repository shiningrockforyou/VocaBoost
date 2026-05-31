/**
 * Targeted probe: log in, enter session review test, 
 * take a screenshot and DOM snapshot of FIRST MCQ question,
 * then STOP without submitting.
 * Goal: verify what word is actually shown in MCQ question and how to extract it.
 */
import { chromium } from 'playwright'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EMAIL = 'audit_lazy_01_top@vocaboost.test'
const PASSWORD = 'AuditPass2026!'
const OUT = '/app/audit/playwright/findings/evidence/B27/lazy_rerun'

const browser = await chromium.launch({
  headless: true,
  executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome'
})

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  // Shim date to Day 11 (June 23 2026)
  await context.addInitScript(() => {
    const origNow = Date.now.bind(Date)
    const offset = new Date('2026-06-23T09:00:00+09:00').getTime() - origNow()
    Date.now = () => origNow() + offset
  })
  
  const page = await context.newPage()
  
  // Login
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2000)
  if (page.url().includes('/login') || !(await page.locator('body').textContent().catch(()=>'')).includes('Day')) {
    await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle', timeout: 30000 })
    await page.locator('input[type="email"]').fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: /continue/i }).first().click()
    await page.waitForTimeout(5000)
  }
  
  const body1 = await page.locator('body').textContent()
  console.log('Dashboard text snippet:', body1.substring(0, 200))
  
  await page.screenshot({ path: OUT + '/probe_01_dashboard.png', fullPage: false })
  
  // Start session
  const startBtn = page.getByRole('button', { name: /Start Session|Continue Session/i }).first()
  if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await startBtn.click()
    await page.waitForTimeout(3000)
  }
  
  await page.screenshot({ path: OUT + '/probe_02_after_start.png', fullPage: false })
  const body2 = await page.locator('body').textContent()
  console.log('After start text snippet:', body2.substring(0, 300))
  
  // Check step
  const stepMatch = body2.match(/Step (\d+) of (\d+)/)
  console.log('Current step:', stepMatch ? stepMatch[0] : 'unknown')
  
  // If step 3 (review flashcards), skip to review test
  if (stepMatch && (parseInt(stepMatch[1]) === 3 || parseInt(stepMatch[1]) === 4)) {
    const menuBtn = page.locator('[aria-label="Session menu"]')
    if (await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await menuBtn.click()
      await page.waitForTimeout(500)
      const skipBtn = page.getByText('Skip to Test').first()
      if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await skipBtn.click()
        await page.waitForTimeout(800)
        const startTest = page.getByRole('button', { name: /start test/i }).first()
        if (await startTest.isVisible({ timeout: 3000 }).catch(() => false)) {
          await startTest.click()
          await page.waitForTimeout(3000)
        }
      }
    }
  }
  
  await page.screenshot({ path: OUT + '/probe_03_review_test.png', fullPage: false })
  const body3 = await page.locator('body').textContent()
  console.log('Review test text:', body3.substring(0, 500))
  
  // Capture the actual DOM structure near options
  const domInfo = await page.evaluate(() => {
    // Find what appears to be the question word
    const result = { possibleQuestionWords: [], optionTexts: [], allH1H2H3: [] }
    
    // All h1,h2,h3
    for (const tag of ['h1','h2','h3']) {
      for (const el of document.querySelectorAll(tag)) {
        result.allH1H2H3.push({ tag, text: el.textContent.trim().substring(0, 100) })
      }
    }
    
    // Elements with large font (likely question word)
    for (const el of document.querySelectorAll('[class*="text-3xl"],[class*="text-4xl"],[class*="text-5xl"],[class*="font-bold"]')) {
      const t = el.textContent.trim()
      if (t && t.length < 60 && !t.includes('\n')) {
        result.possibleQuestionWords.push({ cls: el.className.substring(0,50), text: t })
      }
    }
    
    // Buttons (options)
    for (const btn of document.querySelectorAll('button')) {
      const t = btn.textContent.trim()
      if (t && t.length > 5 && t.length < 200) {
        result.optionTexts.push({ cls: btn.className.substring(0,50), text: t.substring(0,80) })
      }
    }
    
    return result
  })
  
  console.log('\nAll H1/H2/H3:', JSON.stringify(domInfo.allH1H2H3, null, 2))
  console.log('\nPossible question words:', JSON.stringify(domInfo.possibleQuestionWords.slice(0, 10), null, 2))
  console.log('\nButton texts:', JSON.stringify(domInfo.optionTexts.slice(0, 10), null, 2))
  
  await page.screenshot({ path: OUT + '/probe_04_review_dom.png', fullPage: true })
  
} finally {
  await browser.close()
}
