/**
 * Capture full stack trace of the scheduleFlush TDZ error
 */
const { test } = require('@playwright/test')

test.setTimeout(60000)

test('B14D: Capture full error trace', async ({ page }) => {
  const allConsoleMessages = []
  const pageErrors = []

  page.on('console', msg => {
    allConsoleMessages.push({ type: msg.type(), text: msg.text() })
  })
  page.on('pageerror', err => {
    pageErrors.push({ message: err.message, stack: err.stack })
    console.log('PAGE ERROR MESSAGE:', err.message)
    console.log('PAGE ERROR STACK:', err.stack)
  })

  // Login
  await page.goto('http://localhost:5173/login')
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.locator('input[type="email"]').first().fill('student7@apboost.test')
  await page.locator('input[type="password"]').first().fill('Student123!')
  await page.keyboard.press('Enter')
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20000 })
  console.log('URL after login:', page.url())

  // Navigate to test
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1')
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(3000)

  // Get full page source to see compiled output around scheduleFlush
  const errorContent = await page.locator('body').textContent()
  console.log('Page content:', errorContent.substring(0, 500))

  // Print all console messages
  console.log('\n=== ALL CONSOLE MESSAGES ===')
  allConsoleMessages.forEach((m, i) => {
    if (m.type === 'error' || m.text.includes('scheduleFlush') || m.text.includes('Error')) {
      console.log(`[${i}] ${m.type}: ${m.text.substring(0, 200)}`)
    }
  })

  console.log('\n=== PAGE ERRORS ===')
  pageErrors.forEach((e, i) => {
    console.log(`\n[${i}] ${e.message}`)
    console.log('Stack:', e.stack ? e.stack.substring(0, 1000) : 'no stack')
  })

  // Try to get eval from page
  const evalResult = await page.evaluate(() => {
    // Try to find what's happening in useOfflineQueue
    return window.__REACT_ERROR || 'no react error stored'
  })
  console.log('Eval result:', evalResult)

  await page.screenshot({ path: 'e2e/screenshots_b14d_retest/error_trace.png', fullPage: true })
})
