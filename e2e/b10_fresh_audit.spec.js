/**
 * B10 Fresh Audit - Full live test of E-01, E-02, E-03, E-04
 * Run by B10 audit agent on 2026-03-09
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

test.describe('B10 Fresh Audit: Error Handling', () => {

  // =====================================================================
  // E-01: Error State - Invalid Test ID
  // =====================================================================
  test('E-01: Full validation of invalid test ID error state', async ({ page }) => {
    const consoleErrors = []
    const consoleWarnings = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
      if (msg.type() === 'warning') consoleWarnings.push(msg.text())
    })

    await loginAsTeacher(page)
    await page.goto('http://localhost:5173/ap/test/nonexistent_test_id')
    await page.waitForTimeout(6000)

    await page.screenshot({ path: '/tmp/b10_fresh_e01_error.png', fullPage: true })

    // Check 1: heading
    const h2Text = await page.locator('h2').first().innerText().catch(() => 'NOT FOUND')
    console.log('[E-01] h2 heading:', h2Text)

    // Check 2: error message text (should distinguish not_found from unauthorized)
    const fullBodyText = await page.locator('body').innerText().catch(() => '')
    console.log('[E-01] full body:', fullBodyText.substring(0, 600))

    // Check 3: button presence
    const backButtonVisible = await page.locator('button:has-text("Back to Dashboard")').isVisible().catch(() => false)
    console.log('[E-01] back button visible:', backButtonVisible)

    // Check 4: message distinguishes not_found vs unauthorized
    const hasNotExist = fullBodyText.includes('does not exist') || fullBodyText.includes('no longer available')
    const hasUnauthorized = fullBodyText.includes('not authorized')
    console.log('[E-01] message check - not_found message:', hasNotExist, '| unauthorized message:', hasUnauthorized)

    // Check 5: back button navigation
    if (backButtonVisible) {
      await page.locator('button:has-text("Back to Dashboard")').click()
      await page.waitForTimeout(2000)
      const urlAfterClick = page.url()
      console.log('[E-01] URL after back click:', urlAfterClick)
      await page.screenshot({ path: '/tmp/b10_fresh_e01_after_back.png', fullPage: true })
    }

    // Console errors check
    console.log('[E-01] console errors:', consoleErrors)
    console.log('[E-01] console warnings:', consoleWarnings)

    // Summary
    console.log('[E-01] SUMMARY:', {
      headingCorrect: h2Text === 'Error Loading Test',
      messageCorrect: hasNotExist && !hasUnauthorized,
      backButtonPresent: backButtonVisible,
      noConsoleErrors: consoleErrors.length === 0
    })
  })

  // =====================================================================
  // E-02: Error State - Invalid Result ID
  // =====================================================================
  test('E-02: Full validation of invalid result ID error state', async ({ page }) => {
    const consoleErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await loginAsTeacher(page)
    await page.goto('http://localhost:5173/ap/results/nonexistent_result_id')
    await page.waitForTimeout(6000)

    await page.screenshot({ path: '/tmp/b10_fresh_e02_error.png', fullPage: true })

    // Check 1: heading
    const h2Text = await page.locator('h2').first().innerText().catch(() => 'NOT FOUND')
    console.log('[E-02] h2 heading:', h2Text)

    // Check 2: specific error message
    const fullBodyText = await page.locator('body').innerText().catch(() => '')
    console.log('[E-02] full body:', fullBodyText.substring(0, 600))

    // Check 3: "Result not found" message
    const hasResultNotFound = fullBodyText.includes('Result not found')
    console.log('[E-02] has "Result not found":', hasResultNotFound)

    // Check 4: back button
    const backButtonVisible = await page.locator('button:has-text("Back to Dashboard")').isVisible().catch(() => false)
    console.log('[E-02] back button visible:', backButtonVisible)

    // Check 5: navigate back
    if (backButtonVisible) {
      await page.locator('button:has-text("Back to Dashboard")').click()
      await page.waitForTimeout(2000)
      console.log('[E-02] URL after back click:', page.url())
    }

    // Check 6: console errors (logError should fire exactly once in production)
    console.log('[E-02] console errors:', consoleErrors)
    const logErrorFiredCount = consoleErrors.filter(e => e.includes('APReportCard.loadResult')).length
    console.log('[E-02] logError fire count:', logErrorFiredCount)

    // Summary
    console.log('[E-02] SUMMARY:', {
      headingCorrect: h2Text === 'Error Loading Results',
      messageCorrect: hasResultNotFound,
      backButtonPresent: backButtonVisible,
      logErrorFiredTwice: logErrorFiredCount === 2
    })
  })

  // =====================================================================
  // E-03: SubmitProgressModal - structure check
  // =====================================================================
  test('E-03: SubmitProgressModal placement in review branch', async ({ page }) => {
    await loginAsTeacher(page)
    await page.goto('http://localhost:5173/ap/test/test_micro_full_1')
    await page.waitForTimeout(4000)

    await page.screenshot({ path: '/tmp/b10_fresh_e03_initial.png', fullPage: true })

    // Handle DuplicateTabModal if present
    const dupModalVisible = await page.locator('text=Session Active Elsewhere').isVisible().catch(() => false)
    console.log('[E-03] DuplicateTabModal visible:', dupModalVisible)

    if (dupModalVisible) {
      await page.locator('button:has-text("Use This Tab")').click()
      await page.waitForTimeout(2000)
      console.log('[E-03] Took control of tab')
    }

    // Check we are now in the testing view (not instruction screen)
    const bodyText = await page.locator('body').innerText().catch(() => '')
    const isInTestingView = bodyText.includes('Question 1') || bodyText.includes('Flag for Review')
    console.log('[E-03] in testing view:', isInTestingView)

    // Check SubmitProgressModal is NOT visible initially (isSubmitting = false)
    const submitModalVisible = await page.locator('text=Submitting Test').isVisible().catch(() => false)
    console.log('[E-03] SubmitProgressModal visible (should be false):', submitModalVisible)

    // Count instances of the modal in DOM (should only be 1 now after fix)
    const submitModalCount = await page.locator('[data-testid="submit-progress-modal"]').count().catch(() => 0)
    console.log('[E-03] SubmitProgressModal DOM instances via testid:', submitModalCount)

    // Navigate to review screen
    // Find the "Go to Review Screen" button (accessible from QuestionNavigator)
    const reviewBtns = await page.locator('button:has-text("Review"), button:has-text("Go to Review"), button:has-text("Submit Section")').allInnerTexts().catch(() => [])
    console.log('[E-03] review-related buttons:', reviewBtns)

    // Try to navigate to review directly
    const reviewBtn = page.locator('button:has-text("Review Section")')
    const reviewBtnAlt = page.locator('button:has-text("Go to Review")')
    const reviewBtnAlt2 = page.locator('button:has-text("Review")')
    const allReviewBtns = page.locator('button').filter({ hasText: /review/i })
    const allReviewCount = await allReviewBtns.count()
    console.log('[E-03] review buttons matching /review/i:', allReviewCount)

    for (let i = 0; i < Math.min(allReviewCount, 5); i++) {
      const text = await allReviewBtns.nth(i).innerText().catch(() => '')
      console.log(`[E-03] review button ${i}:`, text.trim())
    }

    // Navigate to the review screen by looking for specific go-to-review button
    const goToReviewBtn = page.locator('button').filter({ hasText: /go to review|review section/i }).first()
    const goToReviewVisible = await goToReviewBtn.isVisible().catch(() => false)
    console.log('[E-03] go to review button visible:', goToReviewVisible)

    if (goToReviewVisible) {
      await goToReviewBtn.click()
      await page.waitForTimeout(2000)
      console.log('[E-03] Clicked go to review')
      await page.screenshot({ path: '/tmp/b10_fresh_e03_review_screen.png', fullPage: true })

      const bodyAfterReview = await page.locator('body').innerText().catch(() => '')
      console.log('[E-03] body after clicking review:', bodyAfterReview.substring(0, 800))

      // Check if we're on review screen
      const onReviewScreen = bodyAfterReview.includes('Submit') && (
        bodyAfterReview.includes('Review') ||
        bodyAfterReview.includes('review')
      )
      console.log('[E-03] on review screen:', onReviewScreen)
    }

    await page.screenshot({ path: '/tmp/b10_fresh_e03_check.png', fullPage: true })
  })

  // =====================================================================
  // E-03: SubmitProgressModal - test that it renders in review branch
  // =====================================================================
  test('E-03: Check SubmitProgressModal renders in review view branch', async ({ page }) => {
    await loginAsTeacher(page)
    await page.goto('http://localhost:5173/ap/test/test_micro_full_1')
    await page.waitForTimeout(4000)

    // Handle DuplicateTabModal
    const dupModalVisible = await page.locator('text=Session Active Elsewhere').isVisible().catch(() => false)
    if (dupModalVisible) {
      await page.locator('button:has-text("Use This Tab")').click()
      await page.waitForTimeout(2000)
    }

    // Click through to the review screen (try the navigator popup)
    // First look for the "next" button to navigate to last question, or find "Review" in navigator
    const allBtns = await page.locator('button').allInnerTexts().catch(() => [])
    console.log('[E-03 review] All buttons on page:', allBtns.filter(b => b.trim().length > 0).slice(0, 20))

    // Check APTestSession source to verify SubmitProgressModal is in review branch
    // We use page.evaluate to check if SubmitProgressModal is rendered in the DOM
    const pageHTML = await page.content()

    // The SubmitProgressModal should be present as a DOM element (even if not visible)
    // It's rendered with isVisible={isSubmitting} which means it has isVisible=false in the DOM
    // We need to check if the modal element exists in the review view

    // Navigate to a known "Go to Review Screen" path
    // Look at the navigator bottom bar for a link
    await page.screenshot({ path: '/tmp/b10_fresh_e03_buttons.png', fullPage: true })

    // The QuestionNavigator has a "Go to Review Screen" button at bottom
    const navReviewBtn = page.locator('button[aria-label*="review"], button[title*="review"]')
    const navReviewCount = await navReviewBtn.count()
    console.log('[E-03 review] Navigator review buttons with aria-label:', navReviewCount)

    // Try clicking the last navigation button which should say "Go to Review Screen"
    const lastNavBtns = page.locator('button').filter({ hasText: /go to review screen|review screen/i })
    const lastNavCount = await lastNavBtns.count()
    console.log('[E-03 review] "Go to Review Screen" buttons:', lastNavCount)
  })

  // =====================================================================
  // E-04: APErrorBoundary - code verification + runtime attempt
  // =====================================================================
  test('E-04: ErrorBoundary code verification and dev trigger attempt', async ({ page }) => {
    const consoleErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await loginAsTeacher(page)
    await page.goto('http://localhost:5173/ap/test/test_micro_full_1')
    await page.waitForTimeout(4000)

    // Handle DuplicateTabModal
    const dupModalVisible = await page.locator('text=Session Active Elsewhere').isVisible().catch(() => false)
    if (dupModalVisible) {
      await page.locator('button:has-text("Use This Tab")').click()
      await page.waitForTimeout(2000)
    }

    await page.screenshot({ path: '/tmp/b10_fresh_e04_before.png', fullPage: true })

    // Find React fiber on DOM elements
    const fiberInfo = await page.evaluate(() => {
      // Search for fiber keys on various DOM elements
      const elements = document.querySelectorAll('div, button, header, main')
      const results = []
      for (const el of elements) {
        const keys = Object.keys(el)
        const fiberKey = keys.find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternals'))
        if (fiberKey) {
          results.push({ tag: el.tagName, key: fiberKey, classes: el.className.substring(0, 50) })
          if (results.length >= 3) break
        }
      }
      return results
    })
    console.log('[E-04] React fiber info:', JSON.stringify(fiberInfo))

    // Try to trigger a render error using React DevTools approach
    // This involves directly manipulating the fiber tree to cause a throw
    const triggerResult = await page.evaluate(() => {
      try {
        // Try the window.__triggerTestError approach (if dev hook is set up)
        if (typeof window.__triggerTestError !== 'undefined') {
          window.__triggerTestError = true
          return { triggered: true, method: 'window.__triggerTestError' }
        }

        // Try triggering via React synthetic event corruption
        // This is not reliable but worth trying
        return { triggered: false, msg: 'No test trigger hook available' }
      } catch (e) {
        return { triggered: false, error: e.message }
      }
    })
    console.log('[E-04] trigger result:', triggerResult)

    // Verify ErrorFallback is NOT visible (no error has occurred)
    const errorFallbackVisible = await page.locator('text=Something went wrong').isVisible().catch(() => false)
    const returnToDashboardVisible = await page.locator('a:has-text("Return to Dashboard")').isVisible().catch(() => false)
    const tryAgainVisible = await page.locator('button:has-text("Try Again")').isVisible().catch(() => false)

    console.log('[E-04] ErrorFallback visible:', errorFallbackVisible)
    console.log('[E-04] Return to Dashboard visible:', returnToDashboardVisible)
    console.log('[E-04] Try Again visible:', tryAgainVisible)

    // Note: We cannot easily trigger the boundary from outside React
    // Verify normal app is functioning (not crashed)
    const bodyText = await page.locator('body').innerText().catch(() => '')
    const hasContent = bodyText.length > 100
    console.log('[E-04] app has content (not crashed):', hasContent)

    // Console errors during this test
    console.log('[E-04] console errors:', consoleErrors)

    // Summary
    console.log('[E-04] SUMMARY:', {
      appNotCrashed: hasContent,
      errorFallbackNotVisible: !errorFallbackVisible,
      noConsoleErrors: consoleErrors.length === 0
    })
  })

  // =====================================================================
  // E-03 extended: Try to get to Review Screen and check for Submit modal
  // =====================================================================
  test('E-03: Navigate to review screen and verify modal presence', async ({ page }) => {
    await loginAsTeacher(page)
    await page.goto('http://localhost:5173/ap/test/test_micro_full_1')
    await page.waitForTimeout(4000)

    // Handle DuplicateTabModal
    const dupModalVisible = await page.locator('text=Session Active Elsewhere').isVisible().catch(() => false)
    if (dupModalVisible) {
      await page.locator('button:has-text("Use This Tab")').click()
      await page.waitForTimeout(2000)
    }

    // Check if we are in the testing view
    const isTestingView = await page.locator('text=Flag for Review').isVisible().catch(() => false)
    console.log('[E-03 nav] in testing view:', isTestingView)

    if (!isTestingView) {
      console.log('[E-03 nav] NOT in testing view, bailing')
      const bodyText = await page.locator('body').innerText().catch(() => '')
      console.log('[E-03 nav] body:', bodyText.substring(0, 500))
      return
    }

    // Get all visible buttons
    const allBtns = await page.locator('button').allInnerTexts()
    console.log('[E-03 nav] all visible buttons:', allBtns.filter(b => b.trim()).slice(0, 20))

    // Find the navigator "Go to Review Screen" button - usually at the bottom
    // QuestionNavigator shows a "Go to Review Screen" button
    const reviewScreenBtns = await page.locator('button').filter({ hasText: /review screen/i }).count()
    console.log('[E-03 nav] buttons matching "review screen":', reviewScreenBtns)

    // Try to navigate to review via the QuestionNavigator's "Go to Review Screen" button
    const reviewScreenBtn = page.locator('button').filter({ hasText: /review screen/i }).first()
    const reviewScreenBtnVisible = await reviewScreenBtn.isVisible().catch(() => false)
    console.log('[E-03 nav] "review screen" button visible:', reviewScreenBtnVisible)

    if (reviewScreenBtnVisible) {
      await reviewScreenBtn.click()
      await page.waitForTimeout(2000)

      await page.screenshot({ path: '/tmp/b10_fresh_e03_review.png', fullPage: true })
      const bodyAfterReview = await page.locator('body').innerText().catch(() => '')
      console.log('[E-03 nav] body after review click:', bodyAfterReview.substring(0, 600))

      // Verify SubmitProgressModal is present in DOM (even if not visible because isSubmitting=false)
      // The modal renders when isSubmitting=true. When isSubmitting=false, it should be hidden but
      // the component should still be in the DOM tree.
      // We'll verify by checking for the submit button's state
      const submitBtnVisible = await page.locator('button:has-text("Submit Section"), button:has-text("Submit Test")').isVisible().catch(() => false)
      console.log('[E-03 nav] Submit button visible on review screen:', submitBtnVisible)

      // Check the current view state
      const reviewTitle = await page.locator('h2').first().innerText().catch(() => 'NOT FOUND')
      console.log('[E-03 nav] h2 on review screen:', reviewTitle)
    }

    // Also check the QuestionNavigator for the review button path
    const navSnapshot = await page.evaluate(() => {
      // Get all button text content
      const buttons = Array.from(document.querySelectorAll('button'))
      return buttons.map(b => ({
        text: b.textContent?.trim().substring(0, 50),
        visible: b.offsetParent !== null,
        disabled: b.disabled
      })).filter(b => b.text && b.text.length > 0)
    })
    console.log('[E-03 nav] All buttons in DOM:', JSON.stringify(navSnapshot.slice(0, 20)))
  })

  // =====================================================================
  // Verify APReportCard logError fires correct number of times
  // =====================================================================
  test('E-02 logError: Count error fires for nonexistent result', async ({ page }) => {
    const errors = []
    page.on('console', msg => {
      errors.push({ type: msg.type(), text: msg.text() })
    })

    await loginAsTeacher(page)
    await page.goto('http://localhost:5173/ap/results/nonexistent_result_id')
    await page.waitForTimeout(8000) // Extra time for any delayed effects

    const logErrorFires = errors.filter(e =>
      e.type === 'error' && e.text.includes('APReportCard.loadResult')
    )
    console.log('[E-02 logError] fires:', logErrorFires.length)
    console.log('[E-02 logError] details:', JSON.stringify(logErrorFires))

    const allErrors = errors.filter(e => e.type === 'error')
    console.log('[E-02 logError] total errors:', allErrors.length)
    console.log('[E-02 logError] all error texts:', allErrors.map(e => e.text.substring(0, 100)))
  })

})
