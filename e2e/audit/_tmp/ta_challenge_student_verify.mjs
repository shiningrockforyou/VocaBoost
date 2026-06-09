/**
 * Student-side verification: check the pending challenge is visible
 * Also file a second challenge to test the token system
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const SCREENSHOTS_DIR = 'audit/playwright/findings/screenshots/TA-CHALLENGE'
mkdirSync(SCREENSHOTS_DIR, { recursive: true })

const EXEC_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'
const BASE_URL = 'https://vocaboostone.netlify.app'
const STUDENT_EMAIL = 'audit_careful_01_core@vocaboost.test'
const STUDENT_PASS = 'AuditPass2026!'
const CLASS_ID = 'LVjBTFuYE8FbPG34pVAt'

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`)

async function screenshot(page, name) {
  const path = `${SCREENSHOTS_DIR}/${name}.png`
  await page.screenshot({ path, fullPage: true })
  log(`Screenshot: ${path}`)
  return path
}

async function main() {
  log('=== Student Challenge Verification ===')

  const browser = await chromium.launch({
    headless: true,
    executablePath: EXEC_PATH,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '/ms-playwright' }
  })

  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  try {
    // Login as student
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
    await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
    await page.getByLabel(/email/i).first().fill(STUDENT_EMAIL)
    await page.getByLabel(/password/i).first().fill(STUDENT_PASS)
    await page.getByLabel(/password/i).first().press('Enter')
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
      await page.getByRole('button', { name: /continue/i }).first().click().catch(() => {})
      await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
    })
    log('Logged in. URL: ' + page.url())
    await screenshot(page, 'student_verify_01_dashboard')

    // Navigate to gradebook
    await page.evaluate(() => { history.pushState({}, '', '/gradebook'); dispatchEvent(new PopStateEvent('popstate')) })
    await new Promise(r => setTimeout(r, 3000))
    await screenshot(page, 'student_verify_02_gradebook')

    const gbContent = await page.evaluate(() => document.body.innerText.slice(0, 5000))
    log('Gradebook: ' + gbContent.slice(0, 500))

    // Check for Pending Challenge badge in table row
    const pendingBadge = await page.getByText(/pending challenge/i).count()
    log(`"Pending Challenge" badge in table: ${pendingBadge}`)

    await screenshot(page, 'student_verify_03_challenge_badge_in_row')

    // View the attempt details to see the pending challenge
    const viewBtn = page.getByRole('button', { name: /view|details/i }).first()
    if (await viewBtn.count() > 0) {
      await viewBtn.click()
      await new Promise(r => setTimeout(r, 2000))
      await screenshot(page, 'student_verify_04_attempt_details')

      const detailContent = await page.evaluate(() => document.body.innerText.slice(0, 5000))
      log('Attempt details: ' + detailContent.slice(0, 1000))

      // Check for challenge status in details
      const pendingInDrawer = await page.getByText(/challenge pending/i).count()
      const challengeBtns = await page.getByRole('button', { name: /^challenge$/i }).count()
      const tokenDisplay = await page.getByText(/tokens/i).first().textContent().catch(() => '')
      log(`"Challenge Pending" in drawer: ${pendingInDrawer}`)
      log(`Challenge buttons in drawer: ${challengeBtns}`)
      log(`Token display: ${tokenDisplay}`)

      // File a second challenge on a different word
      if (challengeBtns > 0) {
        log('Filing second challenge on different word...')
        await page.getByRole('button', { name: /^challenge$/i }).first().click()
        await new Promise(r => setTimeout(r, 1000))
        await screenshot(page, 'student_verify_05_second_challenge_modal')

        const modalContent = await page.evaluate(() => document.body.innerText.slice(0, 2000))
        log('Second challenge modal: ' + modalContent.slice(0, 300))

        // Fill note
        const textareas = await page.locator('textarea').all()
        if (textareas.length > 0) {
          await textareas[0].fill('Second audit challenge test')
        }
        await screenshot(page, 'student_verify_06_second_note_filled')

        // Submit
        const submitBtn = page.getByRole('button', { name: /submit/i }).first()
        if (await submitBtn.count() > 0) {
          await submitBtn.click()
          await new Promise(r => setTimeout(r, 3000))
          await screenshot(page, 'student_verify_07_second_submitted')
          const afterContent = await page.evaluate(() => document.body.innerText.slice(0, 3000))
          log('After second submit: ' + afterContent.slice(0, 300))
          const pending2 = await page.getByText(/challenge pending/i).count()
          log(`"Challenge Pending" count after second: ${pending2}`)
        }
      } else {
        log('No more challenge buttons in drawer (first word already challenged)')
      }

      // Check tokens display
      await screenshot(page, 'student_verify_08_final_state')
      const finalContent = await page.evaluate(() => document.body.innerText)
      const tokenMatch = finalContent.match(/(\d+)\/5 remaining/) || finalContent.match(/(\d+) tokens/)
      log('Token display in UI: ' + (tokenMatch ? tokenMatch[0] : 'not found in: ' + finalContent.slice(0, 500)))
    }

  } finally {
    await ctx.close()
    await browser.close()
  }

  process.exit(0)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
