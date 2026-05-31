/**
 * B28T Follow-up — T3 Gradebook + T4 Hook re-check + T5 Class creation
 * Addresses gaps from initial run.
 */

import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'fs'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B28'
mkdirSync(EVIDENCE_DIR, { recursive: true })

const TEACHER_EMAIL = 'veterans@vocaboost.com'
const TEACHER_PASS = 'veterans5944'

const logs = []
function log(msg, data = {}) {
  const entry = { ts: new Date().toISOString(), msg, ...data }
  logs.push(entry)
  console.log(`[${entry.ts}] ${msg}`, Object.keys(data).length ? JSON.stringify(data) : '')
}

async function screenshot(page, name) {
  const path = `${EVIDENCE_DIR}/${name}.png`
  await page.screenshot({ path, fullPage: true })
  log(`Screenshot: ${name}`)
  return path
}

async function loginAsTeacher(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(2000)
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await loginLink.count()) {
    await loginLink.click()
    await page.waitForTimeout(1000)
  } else {
    await page.evaluate(() => { history.pushState({}, '', '/login'); window.dispatchEvent(new PopStateEvent('popstate')) })
    await page.waitForTimeout(1000)
  }
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(TEACHER_EMAIL)
  await page.getByLabel(/password/i).first().fill(TEACHER_PASS)
  await page.getByLabel(/password/i).first().press('Enter')
  try {
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  } catch {
    const btn = page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first()
    if (await btn.count()) await btn.click()
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  }
  log('Logged in', { url: page.url() })
}

async function spaNavigate(page, path) {
  await page.evaluate((p) => {
    history.pushState({}, '', p)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await page.waitForTimeout(2000)
}

async function run() {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  // ---- T3 Gradebook Deep Test ----
  log('=== T3 FOLLOWUP: Gradebook ===')
  const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page3 = await ctx3.newPage()

  const consoleErrors3 = []
  page3.on('console', msg => { if (msg.type() === 'error') consoleErrors3.push(msg.text()) })
  page3.on('pageerror', err => consoleErrors3.push(`PAGE_ERROR: ${err.message}`))

  await loginAsTeacher(page3)
  await spaNavigate(page3, '/gradebook')
  // Wait longer for data to load
  await page3.waitForTimeout(8000)
  await screenshot(page3, 'T3F_01_gradebook_loaded')

  const bodyText = await page3.textContent('body')
  const showingMatch = bodyText.match(/Showing[:\s]*(\d+)/)
  const showingCount = showingMatch ? parseInt(showingMatch[1]) : null
  const hasMore = bodyText.includes('more available') || bodyText.includes('hasMore')
  log('T3: Gradebook data', { showingCount, bodyLen: bodyText.length, hasMore })

  // Check for Korean in table
  const hasKorean = /[가-힣]/.test(bodyText)
  log('T3: Korean text', { present: hasKorean })

  // Try applying a Name filter to trigger the pagination+filter bug
  const filterCategoryBtns = await page3.getByRole('button', { name: /name|class|list|filter/i }).all()
  log('T3: Filter buttons', { count: filterCategoryBtns.length })

  // Look for filter UI — check what's on the page
  const filterSection = await page3.locator('input[placeholder*="filter"], input[placeholder*="search"], input[placeholder*="Search"]').all()
  log('T3: Filter inputs', { count: filterSection.length })

  if (filterSection.length > 0) {
    // Click the first filter input
    await filterSection[0].click()
    await page3.waitForTimeout(500)
    await screenshot(page3, 'T3F_02_filter_focused')

    // Type a class name filter
    await filterSection[0].fill('TOP')
    await page3.waitForTimeout(500)

    // Look for dropdown options or press enter
    const dropdownOption = page3.getByRole('option').first()
    if (await dropdownOption.count()) {
      log('T3: Dropdown option found')
      await screenshot(page3, 'T3F_03_filter_dropdown')
    } else {
      await page3.keyboard.press('Enter')
      await page3.waitForTimeout(3000)
      await screenshot(page3, 'T3F_03_after_filter_enter')
    }
  }

  // Check category selector (Class/Name/List tabs)
  const categoryBtns = await page3.locator('[class*="category"], [class*="Category"]').all()
  log('T3: Category elements', { count: categoryBtns.length })

  // Look for the specific filter tag UI
  const filterArea = await page3.locator('form, [role="search"], .filter').all()
  log('T3: Form/search elements', { count: filterArea.length })

  // Get snapshot of the gradebook HTML
  const gbHtml = await page3.evaluate(() => document.body.innerHTML.substring(0, 5000))

  // Try clicking Class category
  const classBtn = page3.getByRole('button', { name: /^class$/i })
  if (await classBtn.count()) {
    await classBtn.click()
    await page3.waitForTimeout(1500)
    await screenshot(page3, 'T3F_04_class_category_clicked')
  }

  // Check initial Showing count vs after filter
  await screenshot(page3, 'T3F_05_final_state')
  const finalBodyText = await page3.textContent('body')
  const finalShowingMatch = finalBodyText.match(/Showing[:\s]*(\d+)/)
  const finalShowingCount = finalShowingMatch ? parseInt(finalShowingMatch[1]) : null
  log('T3: Final showing count', { count: finalShowingCount })

  log('T3: Console errors', { count: consoleErrors3.length, errors: consoleErrors3.slice(0, 3) })
  await ctx3.close()

  // ---- T4 Hook Order Re-check with React strict analysis ----
  log('=== T4 FOLLOWUP: Dashboard Hook-Order ===')
  const ctx4 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page4 = await ctx4.newPage()

  const hookErrors4 = []
  const allConsole4 = []
  page4.on('console', msg => {
    const t = msg.text()
    allConsole4.push({ type: msg.type(), text: t.slice(0, 200) })
    if (t.toLowerCase().includes('hook') || t.includes('rendered fewer hooks') ||
        t.includes('rendered more hooks') || t.includes('rules of Hooks') ||
        t.includes('Warning: React')) {
      hookErrors4.push(t)
    }
  })
  page4.on('pageerror', err => {
    allConsole4.push({ type: 'pageerror', text: err.message })
    hookErrors4.push(`PAGE_ERROR: ${err.message}`)
  })

  await loginAsTeacher(page4)
  await page4.waitForTimeout(3000)
  await screenshot(page4, 'T4F_01_teacher_dash')

  // Navigate to gradebook (non-teacher route) and back
  await spaNavigate(page4, '/gradebook')
  await page4.waitForTimeout(2000)
  await spaNavigate(page4, '/dashboard')
  await page4.waitForTimeout(3000)
  await screenshot(page4, 'T4F_02_back_to_dash')

  // Force multiple navigations to trigger hook count mismatch
  for (let i = 0; i < 3; i++) {
    await spaNavigate(page4, '/list-library')
    await page4.waitForTimeout(1000)
    await spaNavigate(page4, '/dashboard')
    await page4.waitForTimeout(1500)
  }
  await screenshot(page4, 'T4F_03_after_stress_nav')

  const dashText4 = await page4.textContent('body')
  const dashRendered = dashText4.includes('Welcome') || dashText4.includes('Manage classes')
  const dashBlank = dashText4.trim().length < 100

  log('T4: Final state', {
    rendered: dashRendered,
    blank: dashBlank,
    hookErrors: hookErrors4.length,
    hookErrorTexts: hookErrors4,
    allErrorCount: allConsole4.filter(m => m.type === 'error').length
  })

  await ctx4.close()

  // ---- T5 Re-run: Class creation with proper modal interaction ----
  log('=== T5 FOLLOWUP: Class Creation ===')
  const ctx5 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page5 = await ctx5.newPage()
  let testClassCreated = false

  const consoleErrors5 = []
  page5.on('console', msg => { if (msg.type() === 'error') consoleErrors5.push(msg.text()) })
  page5.on('pageerror', err => consoleErrors5.push(`PAGE_ERROR: ${err.message}`))

  await loginAsTeacher(page5)
  await spaNavigate(page5, '/dashboard')
  await page5.waitForTimeout(4000)
  await screenshot(page5, 'T5F_01_teacher_dash')

  // Look for create class button
  const createBtn = page5.getByRole('button', { name: /create.*class|new.*class|\+.*class|add.*class/i }).first()
  const createBtnCount = await createBtn.count()
  log('T5: Create class button', { found: createBtnCount > 0 })

  if (createBtnCount > 0) {
    await createBtn.click()
    await page5.waitForTimeout(2000)
    await screenshot(page5, 'T5F_02_create_modal')

    // Find all inputs in the modal
    const inputs = await page5.locator('input[type="text"], input:not([type])').all()
    log('T5: Modal inputs found', { count: inputs.length })

    if (inputs.length > 0) {
      // Fill the first text input (likely class name)
      await inputs[0].click()
      await inputs[0].fill('AUDIT_B28_THROWAWAY')
      await page5.waitForTimeout(500)
      await screenshot(page5, 'T5F_03_name_filled')

      // Click the modal's submit button specifically (not the backdrop)
      const modalEl = page5.locator('[role="dialog"], .modal, [class*="modal"]').first()
      if (await modalEl.count()) {
        const modalSubmit = modalEl.getByRole('button', { name: /create|save|submit|confirm/i }).first()
        if (await modalSubmit.count()) {
          await modalSubmit.click()
          await page5.waitForTimeout(5000)
          testClassCreated = true
          await screenshot(page5, 'T5F_04_after_submit')
          const t = await page5.textContent('body')
          log('T5: After class create', { hasClassName: t.includes('AUDIT_B28'), url: page5.url() })
        } else {
          // Try pressing Enter on the name input
          await inputs[0].press('Enter')
          await page5.waitForTimeout(5000)
          testClassCreated = true
          await screenshot(page5, 'T5F_04_after_enter')
          log('T5: Used Enter to submit')
        }
      } else {
        // Try to click the submit button using force click to bypass overlay
        const submitBtn = page5.getByRole('button').filter({ hasText: /create|save/i }).last()
        if (await submitBtn.count()) {
          await submitBtn.click({ force: true })
          await page5.waitForTimeout(5000)
          testClassCreated = true
          await screenshot(page5, 'T5F_04_force_clicked')
          log('T5: Force clicked submit')
        }
      }
    }
  }

  // Check for assignment config UI
  await spaNavigate(page5, '/dashboard')
  await page5.waitForTimeout(3000)
  const dashBody = await page5.textContent('body')
  const hasAuditClass = dashBody.includes('AUDIT_B28_THROWAWAY')
  log('T5: Throwaway class visible', { visible: hasAuditClass })

  // Try to clean up if created
  if (testClassCreated && hasAuditClass) {
    // Look for a settings/delete button on the class card
    const classCard = page5.getByText('AUDIT_B28_THROWAWAY').first()
    if (await classCard.count()) {
      // Look nearby for settings/delete
      const parent = classCard.locator('..').locator('..')
      const settingsBtn = parent.getByRole('button', { name: /setting|edit|delete|remove|trash|gear/i }).first()
      if (await settingsBtn.count()) {
        await settingsBtn.click()
        await page5.waitForTimeout(1000)
        const deleteBtn = page5.getByRole('button', { name: /delete|remove/i }).first()
        if (await deleteBtn.count()) {
          await deleteBtn.click()
          await page5.waitForTimeout(1000)
          const confirmBtn = page5.getByRole('button', { name: /confirm|yes|delete/i }).first()
          if (await confirmBtn.count()) {
            await confirmBtn.click()
            await page5.waitForTimeout(3000)
            log('T5: Cleanup attempted via UI')
          }
        }
      }
    }
  }

  await screenshot(page5, 'T5F_05_cleanup_attempted')
  log('T5: Console errors', { count: consoleErrors5.slice(0, 5) })
  await ctx5.close()

  await browser.close()

  // Summary
  const summary = {
    T3: { showingCount, finalShowingCount, hasKorean, errors: consoleErrors3.length },
    T4: { dashRendered, hookErrors: hookErrors4.length, hookErrorTexts: hookErrors4 },
    T5: { createBtnFound: createBtnCount > 0, testClassCreated, hasAuditClass }
  }

  writeFileSync('/app/audit/playwright/agent_logs/B28T_followup.json', JSON.stringify(summary, null, 2))
  console.log('\n=== FOLLOWUP SUMMARY ===')
  console.log(JSON.stringify(summary, null, 2))
}

run().catch(e => {
  console.error('FATAL:', e)
  process.exit(1)
})
