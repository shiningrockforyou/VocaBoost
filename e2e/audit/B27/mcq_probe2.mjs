import { chromium } from 'playwright'
import { writeFileSync } from 'fs'

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
  await context.addInitScript(() => {
    const origNow = Date.now.bind(Date)
    const offset = new Date('2026-06-23T09:00:00+09:00').getTime() - origNow()
    Date.now = () => origNow() + offset
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
    }
  })
  
  const page = await context.newPage()
  
  // Load root and let client router work
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(3000)
  
  let bodyText = await page.locator('body').textContent().catch(() => '')
  console.log('Page URL:', page.url())
  console.log('Body (first 300 chars):', bodyText.substring(0, 300))
  
  // Check if on login
  if (page.url().includes('login') || bodyText.includes('Welcome back') || bodyText.includes('email') && bodyText.includes('password')) {
    console.log('On login page, filling credentials...')
    const emailInput = page.locator('input[type="email"]')
    await emailInput.waitFor({ timeout: 10000 })
    await emailInput.fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: /continue/i }).first().click()
    await page.waitForTimeout(6000)
    console.log('After login URL:', page.url())
  }
  
  bodyText = await page.locator('body').textContent().catch(() => '')
  console.log('Dashboard text (first 400):', bodyText.substring(0, 400))
  await page.screenshot({ path: OUT + '/probe_01_dashboard.png' })
  
  // Start session
  const startBtn = page.getByRole('button', { name: /Start Session|Continue Session/i }).first()
  if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Clicking start session...')
    await startBtn.click()
    await page.waitForTimeout(4000)
  } else {
    console.log('No start session button visible')
  }
  
  bodyText = await page.locator('body').textContent().catch(() => '')
  const stepMatch = bodyText.match(/Step (\d+) of (\d+)/)
  console.log('Current step:', stepMatch ? stepMatch[0] : 'none found')
  console.log('After start body (first 400):', bodyText.substring(0, 400))
  await page.screenshot({ path: OUT + '/probe_02_after_start.png' })

  // If we're at Step 3 (review study) or step 4, skip to test
  const step = stepMatch ? parseInt(stepMatch[1]) : null
  if (step === 3) {
    console.log('At step 3 (review study), skipping to review test...')
    const menuBtn = page.locator('[aria-label="Session menu"]')
    if (await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await menuBtn.click()
      await page.waitForTimeout(700)
      const skipBtn = page.getByText('Skip to Test').first()
      if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await skipBtn.click()
        await page.waitForTimeout(1000)
        const startTest = page.getByRole('button', { name: /start test/i }).first()
        if (await startTest.isVisible({ timeout: 3000 }).catch(() => false)) {
          await startTest.click()
          await page.waitForTimeout(4000)
        }
      }
    }
  }
  
  bodyText = await page.locator('body').textContent().catch(() => '')
  console.log('Review test body (first 500):', bodyText.substring(0, 500))
  await page.screenshot({ path: OUT + '/probe_03_review.png' })
  
  // Capture all text elements and buttons
  const domSnapshot = await page.evaluate(() => {
    const result = {
      url: location.href,
      h1: Array.from(document.querySelectorAll('h1')).map(e => e.textContent.trim()),
      h2: Array.from(document.querySelectorAll('h2')).map(e => e.textContent.trim()),
      h3: Array.from(document.querySelectorAll('h3')).map(e => e.textContent.trim()),
      largeBold: [],
      buttons: []
    }
    for (const el of document.querySelectorAll('*')) {
      const s = window.getComputedStyle(el)
      const fontSize = parseFloat(s.fontSize)
      if (fontSize >= 24 && el.children.length === 0) {
        const t = el.textContent.trim()
        if (t && t.length < 80) result.largeBold.push({ tag: el.tagName, fontSize, text: t })
      }
    }
    for (const btn of document.querySelectorAll('button')) {
      const t = btn.textContent.trim()
      if (t && t.length < 200) result.buttons.push(t.substring(0, 100))
    }
    return result
  })
  
  console.log('\nDOM Snapshot:')
  console.log('H1:', domSnapshot.h1)
  console.log('H2:', domSnapshot.h2)
  console.log('H3:', domSnapshot.h3)
  console.log('Large text:', JSON.stringify(domSnapshot.largeBold.slice(0, 15)))
  console.log('Buttons:', domSnapshot.buttons.slice(0, 15))
  
  writeFileSync(OUT + '/probe_dom.json', JSON.stringify(domSnapshot, null, 2))
  
} finally {
  await browser.close()
}
