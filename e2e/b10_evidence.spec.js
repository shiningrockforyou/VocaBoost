/**
 * B10 Evidence Gathering - Final screenshots for findings report
 */
import { test, expect } from '@playwright/test'

const TEACHER_EMAIL = 'teacher@apboost.test'
const TEACHER_PASSWORD = 'Teacher123!'

async function loginAsTeacher(page) {
  await page.goto('http://localhost:5173/login')
  await page.waitForSelector('input[type="email"]', { timeout: 10000 })
  await page.fill('input[type="email"]', TEACHER_EMAIL)
  await page.fill('input[type="password"]', TEACHER_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/localhost:5173/, { timeout: 15000 })
  await page.waitForTimeout(2000)
}

test('Evidence: E-01 error state screenshot', async ({ page }) => {
  await loginAsTeacher(page)
  await page.goto('http://localhost:5173/ap/test/nonexistent_test_id')
  await page.waitForTimeout(6000)

  await page.screenshot({ path: '/tmp/b10_evidence_e01.png', fullPage: true })

  const body = await page.locator('body').innerText()
  console.log('[Evidence E-01]', body.substring(0, 400))

  const h2 = await page.locator('h2').first().innerText().catch(() => '')
  const msg = await page.locator('p.text-error-text, p[class*="error"]').first().innerText().catch(() => 'NOT FOUND')

  console.log('[Evidence E-01] h2:', h2)
  console.log('[Evidence E-01] error msg paragraph:', msg)
  console.log('[Evidence E-01] has bg-error class:', body.includes('Error Loading Test'))
})

test('Evidence: E-02 error state screenshot', async ({ page }) => {
  const consoleErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  await loginAsTeacher(page)
  await page.goto('http://localhost:5173/ap/results/nonexistent_result_id')
  await page.waitForTimeout(8000)

  await page.screenshot({ path: '/tmp/b10_evidence_e02.png', fullPage: true })

  const body = await page.locator('body').innerText()
  console.log('[Evidence E-02]', body.substring(0, 400))

  const h2 = await page.locator('h2').first().innerText().catch(() => '')
  console.log('[Evidence E-02] h2:', h2)
  console.log('[Evidence E-02] console errors count:', consoleErrors.length)
  console.log('[Evidence E-02] logError fires:', consoleErrors.filter(e => e.includes('APReportCard.loadResult')).length)
})

test('Evidence: E-03 testing view showing instruction + duplicate modal', async ({ page }) => {
  await loginAsTeacher(page)
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1')
  await page.waitForTimeout(4000)
  await page.screenshot({ path: '/tmp/b10_evidence_e03_a.png', fullPage: true })

  const body = await page.locator('body').innerText()
  console.log('[Evidence E-03a]', body.substring(0, 400))

  // Take screenshot of Macro test instruction screen (fresh)
  await page.goto('http://localhost:5173/ap/test/test_macro_full_1')
  await page.waitForTimeout(4000)
  await page.screenshot({ path: '/tmp/b10_evidence_e03_b_macro.png', fullPage: true })

  const macroBody = await page.locator('body').innerText()
  console.log('[Evidence E-03b Macro]', macroBody.substring(0, 500))
})

test('Evidence: E-04 test session loaded (no crash)', async ({ page }) => {
  const consoleErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  await loginAsTeacher(page)
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1')
  await page.waitForTimeout(4000)
  await page.screenshot({ path: '/tmp/b10_evidence_e04.png', fullPage: true })

  const body = await page.locator('body').innerText()
  console.log('[Evidence E-04]', body.substring(0, 400))
  console.log('[Evidence E-04] console errors:', consoleErrors)
  console.log('[Evidence E-04] "Something went wrong" visible:', body.includes('Something went wrong'))
  console.log('[Evidence E-04] App has content:', body.length > 100)
})

test('Evidence: Login screenshot', async ({ page }) => {
  await loginAsTeacher(page)
  await page.goto('http://localhost:5173/ap')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/b10_evidence_login.png', fullPage: true })

  const body = await page.locator('body').innerText()
  console.log('[Evidence Login]', body.substring(0, 200))
  console.log('[Evidence Login] logged in as teacher:', body.includes('Ms. Thompson') || body.includes('AP Practice'))
})
