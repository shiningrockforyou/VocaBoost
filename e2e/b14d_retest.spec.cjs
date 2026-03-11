/**
 * B14D Retest - FIX Verification
 * Tests FIX-9 (B14D-001, B14D-002, B14D-003 fixes)
 * Student: student7@apboost.test / Student123!
 * Test: test_micro_full_1
 */
const { test, expect } = require('@playwright/test')

const BASE_URL = 'http://localhost:5173'
const EMAIL = 'student7@apboost.test'
const PASSWORD = 'Student123!'
const TEST_ID = 'test_micro_full_1'

test.setTimeout(180000) // 3 minutes

/**
 * Helper: login
 */
async function login(page) {
  await page.goto(`${BASE_URL}/login`)
  await page.waitForSelector('input[type="email"], input[placeholder*="email" i], input[name="email"]', { timeout: 10000 })

  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i], input[name="email"]').first()
  await emailInput.click()
  await emailInput.fill(EMAIL)

  const passInput = page.locator('input[type="password"]').first()
  await passInput.click()
  await passInput.fill(PASSWORD)

  await page.keyboard.press('Enter')
  await page.waitForURL('**', { timeout: 15000 })
  await page.screenshot({ path: 'e2e/screenshots/b14d_retest_01_login.png', fullPage: true })
  console.log('LOGIN: URL after login =', page.url())
}

test('B14D-RETEST: Full verification of FIX B14D-001, B14D-002, B14D-003', async ({ page, context }) => {
  // Clear sessionStorage before start to simulate a fresh scenario
  await page.goto(`${BASE_URL}/login`)
  await page.evaluate(() => sessionStorage.clear())

  // --- STEP 1: Login ---
  console.log('\n=== STEP 1: Login ===')
  await login(page)

  const urlAfterLogin = page.url()
  console.log('URL after login:', urlAfterLogin)

  // Check console errors
  const consoleErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
    if (msg.text().includes('code.startsWith')) consoleErrors.push('CODE_STARTS_WITH_ERROR: ' + msg.text())
  })
  page.on('pageerror', err => {
    consoleErrors.push('PAGEERROR: ' + err.message)
  })

  // --- STEP 2: Navigate to AP Dashboard ---
  console.log('\n=== STEP 2: Navigate to /ap ===')
  await page.goto(`${BASE_URL}/ap`)
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await page.screenshot({ path: 'e2e/screenshots/b14d_retest_02_dashboard.png', fullPage: true })

  // --- STEP 3: Find and click the Micro test ---
  console.log('\n=== STEP 3: Find micro test card ===')
  // Look for a test card or button with the micro test
  const microTestCard = page.locator('[data-testid="test-card"], .test-card, article, .card').filter({ hasText: /micro|ap macro|economics/i }).first()
  const testCards = page.locator('[data-testid="test-card"], article.bg-surface, div.bg-surface').all()

  // Just click any "Start Test" or "Resume Test" button we can find for this test
  // First let's look for the test card that has test_micro_full_1 related content
  await page.screenshot({ path: 'e2e/screenshots/b14d_retest_03_dashboard_close.png', fullPage: true })

  // Find start/resume test button
  const allLinks = await page.locator('a, button').allTextContents()
  console.log('All buttons/links on dashboard:', allLinks.slice(0, 30).join(' | '))

  // Navigate directly to the test session
  console.log('\n=== STEP 4: Navigate to test session ===')
  await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`)
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'e2e/screenshots/b14d_retest_04_instruction_screen.png', fullPage: true })

  const pageContent = await page.content()
  console.log('PAGE URL:', page.url())

  // Check if DuplicateTabModal is visible
  const dupModal = page.locator('text=/duplicate tab|another tab|already open/i').first()
  const hasDupModal = await dupModal.isVisible().catch(() => false)
  console.log('FIX B14D-001 CHECK - DuplicateTabModal visible on instruction screen:', hasDupModal)

  // Check if there's a Resume Test button or Begin Test button
  const resumeBtn = page.locator('button:has-text("Resume Test"), button:has-text("Begin Test")').first()
  const hasResumeBtn = await resumeBtn.isVisible().catch(() => false)
  console.log('Resume/Begin button visible:', hasResumeBtn)

  await page.screenshot({ path: 'e2e/screenshots/b14d_retest_05_before_begin.png', fullPage: true })

  // --- STEP 5: FIX B14D-001 — Reload test (simulate returning tab) ---
  console.log('\n=== STEP 5: FIX B14D-001 TEST — Reload and check for DuplicateTabModal ===')

  // First, click Resume/Begin to enter the test
  if (hasResumeBtn) {
    await resumeBtn.click()
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'e2e/screenshots/b14d_retest_06_after_begin.png', fullPage: true })
    console.log('Clicked begin/resume. URL:', page.url())

    // Check for DuplicateTabModal after begin
    const dupAfterBegin = await page.locator('text=/duplicate tab|another tab|already open/i').first().isVisible().catch(() => false)
    console.log('DuplicateTabModal after begin:', dupAfterBegin)

    // Look for FRQ-related modal dialog
    const anyModal = await page.locator('[role="dialog"], .modal, .overlay').first().isVisible().catch(() => false)
    console.log('Any modal after begin:', anyModal)
  }

  // Now reload the page to simulate a tab reload
  console.log('Reloading page to test FIX B14D-001...')
  await page.reload()
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'e2e/screenshots/b14d_retest_07_after_reload.png', fullPage: true })
  console.log('After reload URL:', page.url())

  // Check if DuplicateTabModal appears after reload
  const dupAfterReload = await page.locator('text=/duplicate tab|another tab|already open/i').first().isVisible().catch(() => false)
  console.log('FIX B14D-001: DuplicateTabModal after reload:', dupAfterReload)

  // Wait up to 10 seconds for any modal to appear
  if (!dupAfterReload) {
    await page.waitForTimeout(10000)
    const dupAfterWait = await page.locator('text=/duplicate tab|another tab|already open/i').first().isVisible().catch(() => false)
    console.log('FIX B14D-001: DuplicateTabModal after 10s wait:', dupAfterWait)
    await page.screenshot({ path: 'e2e/screenshots/b14d_retest_08_after_10s_wait.png', fullPage: true })
  }

  // Click Resume Test to enter the test
  const resumeBtnAfterReload = page.locator('button:has-text("Resume Test"), button:has-text("Begin Test")').first()
  const hasResumeBtnAfterReload = await resumeBtnAfterReload.isVisible().catch(() => false)
  console.log('Resume/Begin visible after reload:', hasResumeBtnAfterReload)

  if (hasResumeBtnAfterReload) {
    await resumeBtnAfterReload.click()
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'e2e/screenshots/b14d_retest_09_after_reload_begin.png', fullPage: true })

    // Check critical: DuplicateTabModal MUST NOT appear after reload+begin
    await page.waitForTimeout(10000) // Wait the full 10 seconds mentioned in acceptance test
    const dupFinal = await page.locator('text=/duplicate tab|another tab|already open/i').first().isVisible().catch(() => false)
    console.log('FIX B14D-001 CRITICAL: DuplicateTabModal after reload+begin (should be FALSE):', dupFinal)
    await page.screenshot({ path: 'e2e/screenshots/b14d_retest_10_10s_check.png', fullPage: true })

    // Check if FRQ textarea and buttons are enabled (no isInvalidated = true)
    // First navigate to FRQ section if we're in MCQ
    const currentUrl = page.url()
    console.log('Current URL in testing view:', currentUrl)

    // Take DOM snapshot for evidence
    const pageTitle = await page.title()
    console.log('Page title:', pageTitle)

    // Check for any disabled inputs (would indicate isInvalidated = true)
    const disabledInputs = await page.locator('textarea[disabled], input[disabled]').count()
    console.log('Disabled inputs (should be 0 if fix works):', disabledInputs)

    await page.screenshot({ path: 'e2e/screenshots/b14d_retest_11_testing_state.png', fullPage: true })
  }

  // --- STEP 6: FIX B14D-002 — Navigate to FRQ choice screen ---
  console.log('\n=== STEP 6: FIX B14D-002 TEST — FRQ two-step confirmation ===')

  // If we're in MCQ testing, answer all questions and submit section
  // Check current view
  const viewSnapshot = await page.content()
  const isInMCQ = viewSnapshot.includes('Multiple Choice') || viewSnapshot.includes('Section 1')
  const isInFRQChoice = viewSnapshot.includes("Choose how you'd like") || viewSnapshot.includes('Free Response Section')

  console.log('Currently in MCQ:', isInMCQ)
  console.log('Currently in FRQ choice:', isInFRQChoice)

  if (!isInFRQChoice) {
    // Need to navigate to FRQ choice screen
    // Check if we can skip to the review screen
    const reviewBtn = page.locator('button:has-text("Review All"), button:has-text("Review")').first()
    const hasReviewBtn = await reviewBtn.isVisible().catch(() => false)
    console.log('Review button visible:', hasReviewBtn)

    // Try to go to review and submit MCQ section
    if (hasReviewBtn) {
      await reviewBtn.click()
      await page.waitForTimeout(2000)
      await page.screenshot({ path: 'e2e/screenshots/b14d_retest_12_review.png', fullPage: true })

      const submitSectionBtn = page.locator('button:has-text("Submit Section"), button:has-text("Submit")').first()
      const hasSubmitSectionBtn = await submitSectionBtn.isVisible().catch(() => false)
      console.log('Submit Section button visible:', hasSubmitSectionBtn)

      if (hasSubmitSectionBtn) {
        await submitSectionBtn.click()
        await page.waitForTimeout(3000)

        // Handle any confirm dialog
        page.once('dialog', async dialog => {
          console.log('Dialog appeared:', dialog.message())
          await dialog.accept()
        })

        await page.waitForTimeout(2000)
        await page.screenshot({ path: 'e2e/screenshots/b14d_retest_13_after_submit_section.png', fullPage: true })
        console.log('URL after submit section:', page.url())
      }
    }
  }

  // Check if we're now on FRQ choice screen
  await page.waitForTimeout(2000)
  const contentAfterSubmit = await page.content()
  const isOnFRQChoice = contentAfterSubmit.includes("Choose how you'd like") || contentAfterSubmit.includes('Free Response Section') || contentAfterSubmit.includes('Type Your Answers') || contentAfterSubmit.includes('Write by Hand')
  console.log('On FRQ choice screen:', isOnFRQChoice)

  if (isOnFRQChoice) {
    await page.screenshot({ path: 'e2e/screenshots/b14d_retest_14_frq_choice.png', fullPage: true })

    // TEST: Click "Type Your Answers" card — should highlight but NOT navigate immediately
    console.log('FIX B14D-002: Clicking Type Your Answers card...')
    const typeAnswersBtn = page.locator('button:has-text("Type Your Answers")').first()
    await typeAnswersBtn.click()
    await page.waitForTimeout(500)

    // Check that we're still on the choice screen (NOT navigated)
    const stillOnChoiceScreen = await page.locator('text=/Choose how you/i').first().isVisible().catch(() => false)
    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Confirm & Continue")').first()
    const confirmBtnVisible = await confirmBtn.isVisible().catch(() => false)

    await page.screenshot({ path: 'e2e/screenshots/b14d_retest_15_frq_card_clicked.png', fullPage: true })
    console.log('FIX B14D-002: Still on choice screen after card click (should be TRUE):', stillOnChoiceScreen)
    console.log('FIX B14D-002: Confirm & Continue button visible (should be TRUE):', confirmBtnVisible)

    // TEST: Check card is highlighted (border-brand-primary)
    const cardHTML = await typeAnswersBtn.evaluate(el => el.className)
    console.log('FIX B14D-002: Card class after click:', cardHTML)
    const isHighlighted = cardHTML.includes('border-brand-primary') || cardHTML.includes('bg-brand')
    console.log('FIX B14D-002: Card highlighted after click (should be TRUE):', isHighlighted)

    if (confirmBtnVisible) {
      // TEST: Click "Confirm & Continue" — should navigate to FRQ questions
      console.log('FIX B14D-002: Clicking Confirm & Continue...')
      await confirmBtn.click()
      await page.waitForTimeout(3000)

      const contentAfterConfirm = await page.content()
      const navigatedToFRQ = !contentAfterConfirm.includes("Choose how you'd like") &&
                              (contentAfterConfirm.includes('Free Response') || contentAfterConfirm.includes('Question') || contentAfterConfirm.includes('textarea'))
      console.log('FIX B14D-002: Navigated to FRQ questions after Confirm (should be TRUE):', navigatedToFRQ)
      await page.screenshot({ path: 'e2e/screenshots/b14d_retest_16_frq_questions.png', fullPage: true })

      // TEST: Check for "Change submission type" link in header
      const changeTypeLink = page.locator('button:has-text("Change submission type"), a:has-text("Change submission type")').first()
      const changeTypeLinkVisible = await changeTypeLink.isVisible().catch(() => false)
      console.log('FIX B14D-002: Change submission type link visible (should be TRUE):', changeTypeLinkVisible)

      // TEST: Type some text in FRQ textarea
      const frqTextarea = page.locator('textarea').first()
      const hasFRQTextarea = await frqTextarea.isVisible().catch(() => false)
      console.log('FRQ textarea visible:', hasFRQTextarea)

      if (hasFRQTextarea) {
        await frqTextarea.click()
        await frqTextarea.fill('This is a test answer for the FRQ question to test switching.')
        await page.waitForTimeout(500)

        // TEST: Click "Change submission type" — should show confirm dialog
        if (changeTypeLinkVisible) {
          console.log('FIX B14D-002: Clicking Change submission type link...')

          // Set up dialog handler BEFORE clicking
          let dialogMessage = null
          let dialogType = null
          page.once('dialog', async dialog => {
            dialogMessage = dialog.message()
            dialogType = dialog.type()
            console.log('Dialog appeared:', { type: dialogType, message: dialogMessage })
            // Cancel the dialog
            await dialog.dismiss()
          })

          await changeTypeLink.click()
          await page.waitForTimeout(2000)

          const hasWarningDialog = dialogMessage !== null
          console.log('FIX B14D-002: Warning dialog appeared (should be TRUE):', hasWarningDialog)
          console.log('FIX B14D-002: Dialog message:', dialogMessage)

          // Check we're still on FRQ (dialog was dismissed/cancelled)
          const stillOnFRQ = await page.locator('textarea').first().isVisible().catch(() => false)
          console.log('FIX B14D-002: Still on FRQ after cancel (should be TRUE):', stillOnFRQ)
          await page.screenshot({ path: 'e2e/screenshots/b14d_retest_17_after_cancel_dialog.png', fullPage: true })

          // TEST: Click Change type again and ACCEPT — should return to FRQ choice screen
          let dialogMessage2 = null
          page.once('dialog', async dialog => {
            dialogMessage2 = dialog.message()
            console.log('Dialog 2 appeared:', dialog.message())
            await dialog.accept()
          })

          await changeTypeLink.click()
          await page.waitForTimeout(2000)

          const contentAfterAccept = await page.content()
          const backOnChoiceScreen = contentAfterAccept.includes("Choose how you'd like") ||
                                      contentAfterAccept.includes('Type Your Answers')
          console.log('FIX B14D-002: Back on choice screen after accept (should be TRUE):', backOnChoiceScreen)
          await page.screenshot({ path: 'e2e/screenshots/b14d_retest_18_back_to_choice.png', fullPage: true })
        }
      } else {
        console.log('WARNING: No FRQ textarea found — may be in handwritten mode or wrong view')
        await page.screenshot({ path: 'e2e/screenshots/b14d_retest_16b_no_textarea.png', fullPage: true })
      }
    }
  } else {
    console.log('WARNING: Could not reach FRQ choice screen — skipping B14D-002 tests')
    await page.screenshot({ path: 'e2e/screenshots/b14d_retest_not_frq.png', fullPage: true })
    const currentPageContent = await page.content()
    console.log('Current page text excerpt:', currentPageContent.substring(0, 500))
  }

  // --- STEP 7: FIX B14D-003 — Check for code.startsWith errors ---
  console.log('\n=== STEP 7: FIX B14D-003 TEST — code.startsWith errors ===')
  console.log('Console errors collected throughout test:')
  consoleErrors.forEach((err, i) => console.log(`  [${i}] ${err}`))

  const startsWith_errors = consoleErrors.filter(e => e.includes('startsWith'))
  console.log('FIX B14D-003: code.startsWith errors (should be 0):', startsWith_errors.length)

  // --- STEP 8: SPA Navigation Guard check ---
  console.log('\n=== STEP 8: SPA Navigation Guard ===')
  // Navigate to test session in testing mode and try browser back
  await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`)
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(2000)

  const resumeBtnFinal = page.locator('button:has-text("Resume Test"), button:has-text("Begin Test")').first()
  const hasFinalResume = await resumeBtnFinal.isVisible().catch(() => false)

  if (hasFinalResume) {
    await resumeBtnFinal.click()
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'e2e/screenshots/b14d_retest_20_in_testing.png', fullPage: true })

    // Try pressing browser back while in testing view
    let blocker_dialog_appeared = false
    page.once('dialog', async dialog => {
      blocker_dialog_appeared = true
      console.log('SPA blocker dialog:', dialog.message())
      await dialog.dismiss()
    })

    await page.goBack().catch(() => {})
    await page.waitForTimeout(2000)

    // Check if "Leave Test?" modal appeared
    const leaveTestModal = await page.locator('text="Leave Test?"').first().isVisible().catch(() => false)
    console.log('SPA Guard: Leave Test modal visible after back:', leaveTestModal)
    await page.screenshot({ path: 'e2e/screenshots/b14d_retest_21_back_nav.png', fullPage: true })
  }

  // --- FINAL SUMMARY ---
  console.log('\n=== FINAL CONSOLE ERRORS ===')
  console.log('Total errors:', consoleErrors.length)
  consoleErrors.forEach((err, i) => console.log(`  [${i}] ${err}`))
})

test('B14D-RETEST: FRQ choice screen isolated test', async ({ page }) => {
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE_ERROR:', msg.text())
    if (msg.text().includes('startsWith')) console.log('STARTSWITH_ERROR:', msg.text())
  })
  page.on('pageerror', err => {
    console.log('PAGEERROR:', err.message)
  })

  // Login fresh
  await page.goto(`${BASE_URL}/login`)
  await page.evaluate(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first()
  await emailInput.fill(EMAIL)
  const passInput = page.locator('input[type="password"]').first()
  await passInput.fill(PASSWORD)
  await page.keyboard.press('Enter')
  await page.waitForURL('**', { timeout: 15000 })

  // Navigate directly to FRQ choice screen by going through test
  await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`)
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(3000)

  await page.screenshot({ path: 'e2e/screenshots/b14d_retest_iso_01_test_page.png', fullPage: true })
  console.log('URL at test page:', page.url())

  // Get current page state
  const bodyText = await page.locator('body').textContent()
  console.log('Body text (first 500):', bodyText.substring(0, 500))

  // Check for FRQ choice screen
  const isFRQChoice = bodyText.includes('Type Your Answers') || bodyText.includes('Choose how you')
  console.log('Is on FRQ choice screen:', isFRQChoice)

  // Capture current page HTML structure for analysis
  await page.screenshot({ path: 'e2e/screenshots/b14d_retest_iso_02_snapshot.png', fullPage: true })
})
