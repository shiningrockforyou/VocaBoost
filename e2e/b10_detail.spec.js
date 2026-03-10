/**
 * B10 Detailed Checks - Additional evidence gathering
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

test.describe('B10 Detailed Checks', () => {

  test('E-01 detail: exact error message for invalid test ID', async ({ page }) => {
    await loginAsTeacher(page)
    await page.goto('http://localhost:5173/ap/test/nonexistent_test_id')
    await page.waitForTimeout(6000)

    // Check exact content of error panel
    const errorPanelText = await page.locator('[class*="bg-error"]').innerText().catch(() => 'NOT FOUND')
    console.log('E-01 exact error panel text:', errorPanelText)

    // Check the heading specifically
    const h2Text = await page.locator('h2').first().innerText().catch(() => 'NOT FOUND')
    console.log('E-01 h2 text:', h2Text)

    // Check the error message paragraph
    const errorMsgText = await page.locator('p[class*="text-error"]').innerText().catch(() => 'NOT FOUND')
    console.log('E-01 error message paragraph:', errorMsgText)

    await page.screenshot({ path: '/tmp/b10_e01_detail.png', fullPage: true })
  })

  test('E-01 detail: check if "Test not found" vs "not authorized" distinction matters', async ({ page }) => {
    await loginAsTeacher(page)

    // Check with teacher account accessing a test they own vs nonexistent
    await page.goto('http://localhost:5173/ap/test/nonexistent_test_id')
    await page.waitForTimeout(6000)

    const fullText = await page.locator('body').innerText()
    const hasNotFound = fullText.includes('not found') || fullText.includes('Not Found')
    const hasNotAuthorized = fullText.includes('not authorized') || fullText.includes('Not authorized')
    const hasErrorHeading = fullText.includes('Error Loading Test')

    console.log('E-01 message check:', { hasNotFound, hasNotAuthorized, hasErrorHeading })
    console.log('E-01 full text:', fullText.substring(0, 600))
  })

  test('E-02 detail: exact error messages', async ({ page }) => {
    await loginAsTeacher(page)
    await page.goto('http://localhost:5173/ap/results/nonexistent_result_id')
    await page.waitForTimeout(6000)

    const h2Text = await page.locator('h2').first().innerText().catch(() => 'NOT FOUND')
    console.log('E-02 h2 text:', h2Text)

    const errorPanel = await page.locator('[class*="bg-error"]').innerText().catch(() => 'NOT FOUND')
    console.log('E-02 error panel text:', errorPanel)

    await page.screenshot({ path: '/tmp/b10_e02_detail.png', fullPage: true })
  })

  test('E-03 detail: SubmitProgressModal rendered twice check', async ({ page }) => {
    await loginAsTeacher(page)
    await page.goto('http://localhost:5173/ap/test/test_micro_full_1')
    await page.waitForTimeout(3000)

    // Click Begin Test
    const beginBtn = page.locator('button:has-text("Begin Test")')
    const beginVisible = await beginBtn.isVisible().catch(() => false)
    console.log('Begin Test visible:', beginVisible)

    if (beginVisible) {
      // Check for DuplicateTabModal first
      const dupModal = page.locator('text=Session Active Elsewhere')
      const dupVisible = await dupModal.isVisible().catch(() => false)
      console.log('Duplicate tab modal visible:', dupVisible)

      if (dupVisible) {
        await page.locator('button:has-text("Use This Tab")').click()
        await page.waitForTimeout(2000)
      }

      await beginBtn.click()
      await page.waitForTimeout(2000)
    }

    // Check the page content after starting test
    const bodyText = await page.locator('body').innerText().catch(() => '')
    console.log('Body after begin:', bodyText.substring(0, 500))

    await page.screenshot({ path: '/tmp/b10_e03_in_test.png', fullPage: true })

    // Look for navigate to review screen
    // First answer a question
    const questionText = await page.locator('text=Question 1').isVisible().catch(() => false)
    console.log('Question 1 visible:', questionText)

    // Check for SubmitProgressModal (should not be visible when not submitting)
    const modalVisible = await page.locator('text=Submitting Test').isVisible().catch(() => false)
    console.log('Submit modal visible (should be false):', modalVisible)

    // Check for duplicate SubmitProgressModal in DOM
    const allModalInstances = await page.locator('text=Submitting Test').count()
    console.log('Submit modal instance count in DOM:', allModalInstances)
  })

  test('E-04 detail: Attempt to trigger ErrorFallback via React', async ({ page }) => {
    await loginAsTeacher(page)
    await page.goto('http://localhost:5173/ap/test/test_micro_full_1')
    await page.waitForTimeout(3000)

    // Handle duplicate tab modal if present
    const dupModal = page.locator('text=Session Active Elsewhere')
    const dupVisible = await dupModal.isVisible().catch(() => false)
    if (dupVisible) {
      await page.locator('button:has-text("Use This Tab")').click()
      await page.waitForTimeout(1000)
    }

    // Check if we can cause a render error using React DevTools mechanism
    // React 18 with fiber exposes internals via __reactFiber on DOM nodes
    const triggerError = await page.evaluate(() => {
      // Try React's experimental error triggering
      try {
        // Find a React-rendered element
        const elements = document.querySelectorAll('[class*="bg-surface"]')
        let found = null
        for (const el of elements) {
          const keys = Object.keys(el)
          const fiberKey = keys.find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternals'))
          if (fiberKey) {
            found = { element: el.tagName, key: fiberKey }
            break
          }
        }
        return { result: 'searched', found }
      } catch (e) {
        return { error: e.message }
      }
    })
    console.log('E-04 React fiber search:', triggerError)

    await page.screenshot({ path: '/tmp/b10_e04_detail.png', fullPage: true })

    // Check ErrorFallback in DOM
    const errorFallbackVisible = await page.locator('text=Something went wrong').isVisible().catch(() => false)
    console.log('E-04 ErrorFallback visible:', errorFallbackVisible)

    // Note: We cannot easily trigger the error boundary without actually
    // causing a render exception in a child component
    console.log('E-04 Note: Error boundary verification is code-level only for this test')
  })

  test('Overall console errors check on all B10 routes', async ({ page }) => {
    const errors = []
    page.on('console', msg => {
      errors.push({ type: msg.type(), text: msg.text().substring(0, 200) })
    })

    await loginAsTeacher(page)

    await page.goto('http://localhost:5173/ap/test/nonexistent_test_id')
    await page.waitForTimeout(5000)
    console.log('Errors after E-01 route:', errors.filter(e => e.type === 'error'))

    await page.goto('http://localhost:5173/ap/results/nonexistent_result_id')
    await page.waitForTimeout(5000)
    console.log('Errors after E-02 route:', errors.filter(e => e.type === 'error'))

    await page.goto('http://localhost:5173/ap/test/test_micro_full_1')
    await page.waitForTimeout(4000)
    console.log('Errors after E-04 route:', errors.filter(e => e.type === 'error'))

    console.log('All console messages:', JSON.stringify(errors.slice(0, 30)))
  })
})
