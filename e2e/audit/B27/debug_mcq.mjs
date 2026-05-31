/**
 * Debug MCQ page structure for anxious/TOP persona
 * Identifies the actual button selectors and page layout
 */
import { chromium } from 'playwright'
import { readFileSync } from 'fs'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EMAIL = 'audit_anxious_01_top@vocaboost.test'
const PASSWORD = 'AuditPass2026!'
const CHROMIUM_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'

const browser = await chromium.launch({ headless: false, executablePath: CHROMIUM_PATH }).catch(() =>
  chromium.launch({ headless: true, executablePath: CHROMIUM_PATH })
)

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  // Login
  await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)
  await page.getByLabel(/email/i).first().fill(EMAIL)
  await page.getByLabel(/password/i).first().fill(PASSWORD)
  await page.getByLabel(/password/i).first().press('Enter')
  await page.waitForURL(/\/(dashboard|)$/, { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(3000)

  console.log('Page URL after login:', page.url())

  // Check current page state
  const body = await page.locator('body').textContent().catch(() => '')
  console.log('Body snippet:', body.substring(0, 500))

  // Start session
  const startBtns = page.getByRole('button', { name: /^Start Session$/i })
  const cnt = await startBtns.count()
  console.log('Start Session buttons:', cnt)

  if (cnt > 0) {
    await startBtns.first().click()
    await page.waitForTimeout(3000)
  }

  // Check for modal
  const modalBody = await page.locator('body').textContent().catch(() => '')
  console.log('After start body snippet:', modalBody.substring(0, 500))

  const modal = page.locator('.fixed.inset-0.z-50')
  const modalVisible = await modal.isVisible({ timeout: 2000 }).catch(() => false)
  console.log('Modal visible:', modalVisible)

  if (modalVisible) {
    const modalText = await modal.textContent().catch(() => '')
    console.log('Modal text:', modalText.substring(0, 300))

    // Try clicking Start Studying
    const startStudying = page.getByRole('button', { name: /start studying/i }).first()
    if (await startStudying.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Clicking Start Studying...')
      await startStudying.click({ force: true })
      await page.waitForTimeout(2000)
    } else {
      console.log('No Start Studying button')
      // Click escape
      await page.keyboard.press('Escape')
      await page.waitForTimeout(1000)
    }
  }

  // Try Skip to Test
  const sessionMenu = page.locator('[aria-label="Session menu"]').first()
  const menuVisible = await sessionMenu.isVisible({ timeout: 5000 }).catch(() => false)
  console.log('Session menu visible:', menuVisible)

  if (menuVisible) {
    await sessionMenu.click()
    await page.waitForTimeout(500)
    const skipItem = page.getByText('Skip to Test').first()
    const skipVisible = await skipItem.isVisible({ timeout: 2000 }).catch(() => false)
    if (skipVisible) {
      await skipItem.click()
      await page.waitForTimeout(1000)
      const confirmBtn = page.getByRole('button', { name: /start test/i }).first()
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click()
        await page.waitForTimeout(3000)
      }
    }
  }

  // Now on MCQ test — analyze page structure
  const mcqBody = await page.locator('body').textContent().catch(() => '')
  console.log('\n=== MCQ PAGE ===')
  console.log('Body snippet:', mcqBody.substring(0, 800))

  // Check all buttons
  const allBtns = await page.locator('button').all()
  console.log('\nAll buttons on page:')
  for (const btn of allBtns) {
    const txt = await btn.textContent().catch(() => '')
    const cls = await btn.getAttribute('class').catch(() => '')
    const lbl = await btn.getAttribute('aria-label').catch(() => '')
    if (txt?.trim() || lbl?.trim()) {
      console.log(`  Button: "${txt?.trim().substring(0, 60)}" cls="${cls?.substring(0, 40)}" lbl="${lbl}"`)
    }
  }

  // Check h1/h2/h3 elements (word display)
  const headings = await page.locator('h1, h2, h3, p.font-bold, [class*="text-2xl"]').all()
  console.log('\nHeadings:')
  for (const h of headings) {
    const txt = await h.textContent().catch(() => '')
    const cls = await h.getAttribute('class').catch(() => '')
    console.log(`  "${txt?.trim().substring(0, 60)}" cls="${cls?.substring(0, 40)}"`)
  }

  // Take screenshot
  await page.screenshot({ path: '/app/audit/playwright/findings/evidence/B27/anxious/mcq_debug.png', fullPage: false })
  console.log('\nScreenshot saved.')

  // DOM analysis
  const domInfo = await page.evaluate(() => {
    // Find all clickable elements with substantial text
    const result = []
    const elems = document.querySelectorAll('button, [role="button"]')
    for (const el of elems) {
      const txt = el.textContent?.trim() || ''
      if (txt.length > 5 && txt.length < 200) {
        result.push({
          tag: el.tagName,
          text: txt.substring(0, 80),
          class: el.className?.substring(0, 60),
          disabled: el.disabled,
          ariaLabel: el.getAttribute('aria-label')
        })
      }
    }
    return result
  })
  console.log('\nClickable elements with text:')
  domInfo.forEach(e => console.log(`  [${e.tag}] "${e.text}" cls="${e.class}" disabled=${e.disabled}`))

  await page.waitForTimeout(3000)
} finally {
  await browser.close()
}
