/**
 * B10 Audit - Error Handling Scenarios
 * Tests: E-01, E-02, E-03, E-04
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
  // Login redirects to '/', then we navigate manually to /ap routes
  await page.waitForURL(/localhost:5173/, { timeout: 15000 })
  await page.waitForTimeout(2000) // Let auth settle
}

test.describe('B10: Error Handling', () => {

  test('E-01: Invalid test ID shows error state', async ({ page }) => {
    const consoleErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await loginAsTeacher(page)

    // Navigate to invalid test ID
    await page.goto('http://localhost:5173/ap/test/nonexistent_test_id')

    // Wait for error state to appear (loading skeleton should resolve)
    await page.waitForTimeout(6000)

    console.log('E-01 page URL:', page.url())

    // Take screenshot
    await page.screenshot({ path: '/tmp/b10_e01_error_test.png', fullPage: true })

    // Check for error heading
    const errorHeading = await page.locator('h2:has-text("Error Loading Test")').isVisible().catch(() => false)
    const backButton = await page.locator('button:has-text("Back to Dashboard")').isVisible().catch(() => false)

    console.log('E-01 results:', { errorHeading, backButton })
    console.log('E-01 console errors:', consoleErrors)

    const bodyText = await page.locator('body').innerText().catch(() => '')
    console.log('E-01 body text:', bodyText.substring(0, 800))
  })

  test('E-01 button: Back to Dashboard navigates to /ap', async ({ page }) => {
    await loginAsTeacher(page)
    await page.goto('http://localhost:5173/ap/test/nonexistent_test_id')
    await page.waitForTimeout(6000)

    const backButton = page.locator('button:has-text("Back to Dashboard")')
    const isVisible = await backButton.isVisible().catch(() => false)

    console.log('E-01 back button visible:', isVisible)

    if (isVisible) {
      await backButton.click()
      await page.waitForTimeout(2000)
      console.log('E-01 after click URL:', page.url())
      await page.screenshot({ path: '/tmp/b10_e01_after_back.png', fullPage: true })
    } else {
      console.log('E-01 back button NOT VISIBLE. Current body text:')
      const bodyText = await page.locator('body').innerText().catch(() => '')
      console.log(bodyText.substring(0, 500))
      await page.screenshot({ path: '/tmp/b10_e01_no_button.png', fullPage: true })
    }
  })

  test('E-02: Invalid result ID shows error state', async ({ page }) => {
    const consoleErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await loginAsTeacher(page)

    // Navigate to invalid result ID
    await page.goto('http://localhost:5173/ap/results/nonexistent_result_id')

    // Wait for error state
    await page.waitForTimeout(6000)

    console.log('E-02 page URL:', page.url())

    // Take screenshot
    await page.screenshot({ path: '/tmp/b10_e02_error_results.png', fullPage: true })

    const errorHeading = await page.locator('h2:has-text("Error Loading Results")').isVisible().catch(() => false)
    const backButton = await page.locator('button:has-text("Back to Dashboard")').isVisible().catch(() => false)
    const resultNotFound = await page.locator('text=Result not found').isVisible().catch(() => false)

    console.log('E-02 results:', { errorHeading, backButton, resultNotFound })
    console.log('E-02 console errors:', consoleErrors)

    const bodyText = await page.locator('body').innerText().catch(() => '')
    console.log('E-02 body text:', bodyText.substring(0, 800))
  })

  test('E-02 button: Back to Dashboard navigates to /ap', async ({ page }) => {
    await loginAsTeacher(page)
    await page.goto('http://localhost:5173/ap/results/nonexistent_result_id')
    await page.waitForTimeout(6000)

    const backButton = page.locator('button:has-text("Back to Dashboard")')
    const isVisible = await backButton.isVisible().catch(() => false)

    console.log('E-02 back button visible:', isVisible)

    if (isVisible) {
      await backButton.click()
      await page.waitForTimeout(2000)
      console.log('E-02 after click URL:', page.url())
      await page.screenshot({ path: '/tmp/b10_e02_after_back.png', fullPage: true })
    }
  })

  test('E-03: Dashboard and test session load check', async ({ page }) => {
    await loginAsTeacher(page)

    // Navigate to dashboard
    await page.goto('http://localhost:5173/ap')
    await page.waitForTimeout(3000)

    console.log('E-03 dashboard URL:', page.url())

    // Take screenshot
    await page.screenshot({ path: '/tmp/b10_e03_dashboard.png', fullPage: true })

    const bodyText = await page.locator('body').innerText().catch(() => '')
    console.log('E-03 dashboard body:', bodyText.substring(0, 1000))

    // Check for any test cards or buttons
    const allButtons = await page.locator('button').allInnerTexts().catch(() => [])
    console.log('E-03 buttons found:', allButtons.slice(0, 10))
  })

  test('E-03: SubmitProgressModal - navigate to test and check submit flow', async ({ page }) => {
    await loginAsTeacher(page)

    await page.goto('http://localhost:5173/ap/test/test_micro_full_1')
    await page.waitForTimeout(3000)

    console.log('E-03 test session URL:', page.url())
    await page.screenshot({ path: '/tmp/b10_e03_test_session.png', fullPage: true })

    const bodyText = await page.locator('body').innerText().catch(() => '')
    console.log('E-03 test session body:', bodyText.substring(0, 1000))

    // Look for Begin Test button on instruction screen
    const beginBtn = page.locator('button:has-text("Begin Test"), button:has-text("Start Test")')
    const beginVisible = await beginBtn.isVisible().catch(() => false)
    console.log('E-03 Begin Test button visible:', beginVisible)

    if (beginVisible) {
      await beginBtn.click()
      await page.waitForTimeout(2000)
      await page.screenshot({ path: '/tmp/b10_e03_after_begin.png', fullPage: true })

      const bodyAfter = await page.locator('body').innerText().catch(() => '')
      console.log('E-03 after begin body:', bodyAfter.substring(0, 500))
    }
  })

  test('E-04: APErrorBoundary - code verification and runtime check', async ({ page }) => {
    const consoleErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await loginAsTeacher(page)
    await page.goto('http://localhost:5173/ap/test/test_micro_full_1')
    await page.waitForTimeout(3000)

    console.log('E-04 URL:', page.url())
    await page.screenshot({ path: '/tmp/b10_e04_before.png', fullPage: true })

    const bodyText = await page.locator('body').innerText().catch(() => '')
    console.log('E-04 body text:', bodyText.substring(0, 500))

    // Try to trigger a render error via page.evaluate
    // We'll throw an error in a way that React's error boundary should catch
    const triggerResult = await page.evaluate(() => {
      try {
        // Find the React app root
        const root = document.getElementById('root')
        const fiberKey = Object.keys(root).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternals'))
        if (!fiberKey) {
          return { found: false, msg: 'No React fiber found on root' }
        }
        return { found: true, msg: 'React fiber found: ' + fiberKey }
      } catch (e) {
        return { error: e.message }
      }
    })
    console.log('E-04 fiber check:', triggerResult)

    // Check if page has any content (not a white screen)
    const hasContent = (await page.locator('body').innerText()).length > 50
    console.log('E-04 has content (not white screen):', hasContent)

    // Check console errors during the session
    console.log('E-04 console errors so far:', consoleErrors)
  })

  test('E-04: Attempt to trigger ErrorFallback', async ({ page }) => {
    await loginAsTeacher(page)
    await page.goto('http://localhost:5173/ap/test/test_micro_full_1')
    await page.waitForTimeout(3000)

    const beforeText = await page.locator('body').innerText().catch(() => '')
    console.log('E-04 before text:', beforeText.substring(0, 300))

    // Try to trigger a render error by corrupting a React state object
    // This attempts to cause APErrorBoundary to catch something
    await page.evaluate(() => {
      // Override React's createElement to throw after a few renders (not practical)
      // Instead, throw a real JS error from within a React event handler
      // We'll dispatch a click on a corrupted element
      window.__b10TestError = true
    })

    // Try setting up a scenario where a component would crash on next render
    // Best approach: navigate to a broken state
    // Let's just verify the error boundary is PRESENT in the DOM tree by checking
    // if APErrorBoundary wraps the content
    const pageSource = await page.content()
    // Look for any data attributes or wrapper divs that might indicate error boundary
    const hasErrorBoundaryWrapper = pageSource.includes('APErrorBoundary') || pageSource.includes('ErrorFallback')
    console.log('E-04 page source has ErrorBoundary refs:', hasErrorBoundaryWrapper)

    await page.screenshot({ path: '/tmp/b10_e04_runtime.png', fullPage: true })

    // Now check if we can trigger an error - navigate to a JS error via eval
    const errorTriggered = await page.evaluate(() => {
      try {
        // Simulate what would happen if a component threw during render
        // by using React's test utilities or by forcing an error
        // We can try to find and invoke a render-breaking action
        const event = new CustomEvent('__testRenderError', { detail: { corrupt: null } })
        window.dispatchEvent(event)

        // Check if there are any global error handlers
        const hasErrorHandler = !!window.onerror
        return { triggered: false, hasErrorHandler, msg: 'Custom event dispatched' }
      } catch (e) {
        return { triggered: true, error: e.message }
      }
    })
    console.log('E-04 error trigger attempt:', errorTriggered)
  })

  test('Console errors comprehensive check across all E-routes', async ({ page }) => {
    const allErrors = []
    const allWarnings = []

    page.on('console', msg => {
      if (msg.type() === 'error') allErrors.push({ route: 'pending', text: msg.text() })
      if (msg.type() === 'warning') allWarnings.push({ route: 'pending', text: msg.text() })
    })

    await loginAsTeacher(page)

    // Check E-01 route
    const routes = [
      { name: 'E-01 invalid test', url: 'http://localhost:5173/ap/test/nonexistent_test_id' },
      { name: 'E-02 invalid result', url: 'http://localhost:5173/ap/results/nonexistent_result_id' },
      { name: 'E-04 valid test session', url: 'http://localhost:5173/ap/test/test_micro_full_1' },
    ]

    for (const route of routes) {
      const routeErrors = []
      page.on('console', msg => {
        if (msg.type() === 'error') routeErrors.push(msg.text())
      })

      await page.goto(route.url)
      await page.waitForTimeout(5000)

      console.log(`Route ${route.name}:`)
      console.log('  URL:', page.url())
      console.log('  Errors:', routeErrors)

      await page.screenshot({ path: `/tmp/b10_console_${route.name.replace(/\s+/g, '_')}.png`, fullPage: true })
    }

    console.log('All errors across routes:', JSON.stringify(allErrors))
    console.log('All warnings across routes:', JSON.stringify(allWarnings.slice(0, 10)))
  })
})
