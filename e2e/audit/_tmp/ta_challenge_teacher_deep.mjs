/**
 * Deeper teacher-side investigation:
 * 1. Verify teacher can see their classes
 * 2. Verify teacher gradebook shows 0 attempts (teacherId mismatch bug)
 * 3. Verify reviewChallenge Auth error
 * 4. Check console errors
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const SCREENSHOTS_DIR = 'audit/playwright/findings/screenshots/TA-CHALLENGE'
mkdirSync(SCREENSHOTS_DIR, { recursive: true })

const EXEC_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'
const BASE_URL = 'https://vocaboostone.netlify.app'
const TA_EMAIL = 'ta@vocaboost.com'
const TA_PASS = 'VocaTA2026!'
const CLASS_ID = 'LVjBTFuYE8FbPG34pVAt'
const CLASS_NAME = '25WT 2차 CORE OFFLINE'

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`)

async function screenshot(page, name) {
  const path = `${SCREENSHOTS_DIR}/${name}.png`
  await page.screenshot({ path, fullPage: true })
  log(`Screenshot: ${path}`)
  return path
}

async function main() {
  log('=== Teacher Deep Investigation ===')

  const browser = await chromium.launch({
    headless: true,
    executablePath: EXEC_PATH,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '/ms-playwright' }
  })

  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  // Collect console messages
  const consoleMsgs = []
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('teacherId') || msg.text().includes('Challenge') || msg.text().includes('query') || msg.text().includes('returned')) {
      consoleMsgs.push({ type: msg.type(), text: msg.text() })
    }
  })

  try {
    // Login as teacher
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    try {
      const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
      if (await loginLink.count() > 0) await loginLink.click()
      else {
        await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
      }
    } catch(e) {
      await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
    }

    await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
    await page.getByLabel(/email/i).first().fill(TA_EMAIL)
    await page.getByLabel(/password/i).first().fill(TA_PASS)
    await page.getByLabel(/password/i).first().press('Enter')
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
      await page.getByRole('button', { name: /continue/i }).first().click().catch(() => {})
      await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
    })
    log('Logged in as teacher. URL: ' + page.url())
    await screenshot(page, 'teacher_01_dashboard')

    // Check Classes page
    await page.evaluate(() => { history.pushState({}, '', '/classes'); dispatchEvent(new PopStateEvent('popstate')) })
    await new Promise(r => setTimeout(r, 3000))
    await screenshot(page, 'teacher_02_classes')
    const classesContent = await page.evaluate(() => document.body.innerText.slice(0, 2000))
    log('Classes page: ' + classesContent.slice(0, 500))

    // Navigate to gradebook without filter - look at "Search for students"
    await page.evaluate(() => { history.pushState({}, '', '/gradebook'); dispatchEvent(new PopStateEvent('popstate')) })
    await new Promise(r => setTimeout(r, 5000))
    await screenshot(page, 'teacher_03_gradebook_nofilter')
    const gbContent = await page.evaluate(() => document.body.innerText.slice(0, 3000))
    log('Gradebook no filter: ' + gbContent.slice(0, 1000))

    // Try selecting CORE OFFLINE class from filter
    log('Looking for Class filter...')
    const classFilterBtn = page.getByRole('button', { name: /^class$/i }).first()
    const addFilterBtn = page.getByRole('button', { name: /add filter/i }).first()
    const classDropdown = page.getByText(/class/i).first()

    log('Class filter button count: ' + await classFilterBtn.count())
    log('Add filter button count: ' + await addFilterBtn.count())

    // Check if there's a class selector in the filter area
    const filterArea = await page.locator('[class*="filter"], form, [aria-label*="filter"]').count()
    log('Filter areas: ' + filterArea)

    // Dump all buttons on the page
    const allBtns = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()?.slice(0, 50)).filter(Boolean))
    log('All buttons: ' + JSON.stringify(allBtns))

    // Try clicking Add Filter
    if (await addFilterBtn.count() > 0) {
      await addFilterBtn.click()
      await new Promise(r => setTimeout(r, 1000))
      await screenshot(page, 'teacher_04_filter_open')
    }

    // Navigate directly to class gradebook
    await page.evaluate((classId) => {
      history.pushState({}, '', `/gradebook?classId=${classId}`)
      dispatchEvent(new PopStateEvent('popstate'))
    }, CLASS_ID)
    await new Promise(r => setTimeout(r, 5000))
    await screenshot(page, 'teacher_05_class_gradebook')
    const tClassGb = await page.evaluate(() => document.body.innerText.slice(0, 5000))
    log('Teacher class gradebook (5s wait): ' + tClassGb.slice(0, 1000))

    // Wait longer for loading
    await new Promise(r => setTimeout(r, 5000))
    await screenshot(page, 'teacher_06_class_gradebook_10s')
    const tClassGb2 = await page.evaluate(() => document.body.innerText.slice(0, 5000))
    log('Teacher class gradebook (10s wait): ' + tClassGb2.slice(0, 1000))

    // Try navigating to specific class in Classes
    await page.evaluate((classId) => {
      history.pushState({}, '', `/classes/${classId}`)
      dispatchEvent(new PopStateEvent('popstate'))
    }, CLASS_ID)
    await new Promise(r => setTimeout(r, 3000))
    await screenshot(page, 'teacher_07_class_detail')
    const classDetail = await page.evaluate(() => document.body.innerText.slice(0, 3000))
    log('Class detail: ' + classDetail.slice(0, 1000))

    // Look for a "Gradebook" link or "View Results" within class
    const gradeLinks = await page.getByRole('link', { name: /gradebook|results|attempts/i }).count()
    log('Gradebook links in class detail: ' + gradeLinks)

  } finally {
    await ctx.close()
    await browser.close()
  }

  log('\n=== Console Messages ===')
  consoleMsgs.forEach(m => log(`[${m.type}] ${m.text}`))

  process.exit(0)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
