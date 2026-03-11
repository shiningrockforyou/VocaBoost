/**
 * B14D FRQ Test - Test the FRQ two-step confirmation flow
 * Quickly answer MCQ and get to FRQ choice screen
 */
const { test } = require('@playwright/test')
const fs = require('fs')

const BASE_URL = 'http://localhost:5173'
const EMAIL = 'student7@apboost.test'
const PASSWORD = 'Student123!'
const TEST_ID = 'test_micro_full_1'
const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/e2e/screenshots_b14d_retest'

test.setTimeout(300000) // 5 minutes

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

async function screenshot(page, name) {
  const p = `${SCREENSHOTS_DIR}/${name}.png`
  await page.screenshot({ path: p, fullPage: true }).catch(() => {})
  console.log(`[SCREENSHOT] ${name}.png`)
}

async function waitAndClick(page, selector, timeout = 5000) {
  try {
    await page.locator(selector).first().click({ timeout })
    return true
  } catch {
    return false
  }
}

test('B14D-002: FRQ two-step confirmation flow', async ({ page }) => {
  const consoleErrors = []
  const codeStartsWithErrors = []

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text()
      consoleErrors.push(text)
      if (text.includes('startsWith')) codeStartsWithErrors.push(text)
    }
  })
  page.on('pageerror', err => {
    const text = err.message
    consoleErrors.push('PAGEERROR: ' + text)
    if (text.includes('startsWith')) codeStartsWithErrors.push('PAGEERROR: ' + text)
  })

  // Login
  await page.goto(`${BASE_URL}/login`)
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.locator('input[type="email"]').first().fill(EMAIL)
  await page.locator('input[type="password"]').first().fill(PASSWORD)
  await page.keyboard.press('Enter')
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20000 })
  console.log('[B14D-002] Logged in. URL:', page.url())

  // Navigate to test
  await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`)
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2000)
  await screenshot(page, 'frq_01_test_page')

  // Begin test
  const beginBtn = page.locator('button').filter({ hasText: /Resume Test|Begin Test/i }).first()
  if (!await beginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('[B14D-002] ERROR: No Begin/Resume button found')
    const bodyText = await page.locator('body').textContent()
    console.log('[B14D-002] Body text:', bodyText.substring(0, 400))
    return
  }

  await beginBtn.click()
  await page.waitForTimeout(2000)
  await screenshot(page, 'frq_02_started')

  // Answer all 15 MCQ questions quickly by clicking option A for each
  console.log('[B14D-002] Answering all 15 MCQ questions...')
  for (let i = 1; i <= 15; i++) {
    console.log(`[B14D-002] Answering Q${i}...`)

    // Wait for question to load
    await page.waitForTimeout(500)

    // Click answer A
    const answerA = page.locator('button').filter({ hasText: /^A\b|^A\s/ }).first()
    const clicked = await answerA.click({ timeout: 3000 }).then(() => true).catch(() => false)

    if (!clicked) {
      // Try text-based selector
      const altA = page.locator('[data-testid*="answer"], button.answer, .answer-option').first()
      await altA.click({ timeout: 3000 }).catch(() => {})
    }

    await page.waitForTimeout(300)

    // Click Next (except on last question)
    if (i < 15) {
      const nextBtn = page.locator('button').filter({ hasText: /Next →|Next/i }).first()
      await nextBtn.click({ timeout: 3000 }).catch(async () => {
        // Try keyboard
        await page.keyboard.press('ArrowRight')
      })
    }
  }

  await screenshot(page, 'frq_03_after_q15')
  console.log('[B14D-002] Finished answering MCQ. Current body text:', (await page.locator('body').textContent()).substring(0, 200))

  // Click Review All or go to review
  await page.waitForTimeout(1000)
  const reviewBtn = page.locator('button').filter({ hasText: /Review All|Review/i }).first()
  const hasReview = await reviewBtn.isVisible({ timeout: 3000 }).catch(() => false)
  console.log('[B14D-002] Review button visible:', hasReview)

  if (hasReview) {
    await reviewBtn.click()
    await page.waitForTimeout(2000)
    await screenshot(page, 'frq_04_review')
  }

  // Click Submit Section
  await page.waitForTimeout(1000)
  const submitSectionBtn = page.locator('button').filter({ hasText: /Submit Section 1|Submit Section|Submit MCQ/i }).first()
  const hasSubmitSection = await submitSectionBtn.isVisible({ timeout: 5000 }).catch(() => false)
  console.log('[B14D-002] Submit Section button visible:', hasSubmitSection)

  // Also check for any "Submit" buttons
  const allBtns = await page.locator('button').allTextContents()
  console.log('[B14D-002] All buttons:', allBtns.join(' | '))

  if (hasSubmitSection) {
    // Handle dialog if any
    page.once('dialog', async dialog => {
      console.log('[B14D-002] Dialog:', dialog.message())
      await dialog.accept()
    })

    await submitSectionBtn.click()
    await page.waitForTimeout(3000)
    await screenshot(page, 'frq_05_after_submit_section')
    console.log('[B14D-002] URL after submit section:', page.url())
  } else {
    // Try clicking any button with "Submit" in text
    const anySubmit = page.locator('button').filter({ hasText: /Submit/i }).first()
    const hasAnySubmit = await anySubmit.isVisible({ timeout: 3000 }).catch(() => false)
    if (hasAnySubmit) {
      page.once('dialog', async dialog => {
        console.log('[B14D-002] Dialog:', dialog.message())
        await dialog.accept()
      })
      await anySubmit.click()
      await page.waitForTimeout(3000)
      await screenshot(page, 'frq_05b_after_any_submit')
    }
  }

  // Check if on FRQ choice screen
  await page.waitForTimeout(2000)
  const pageContent = await page.locator('body').textContent()
  const isOnFRQChoice = pageContent.includes('Type Your Answers') || pageContent.includes('Choose how you') ||
                         pageContent.includes('Free Response Section') || pageContent.includes('Write by Hand')
  console.log('\n[B14D-002] On FRQ choice screen:', isOnFRQChoice)
  await screenshot(page, 'frq_06_frq_choice_check')

  if (!isOnFRQChoice) {
    console.log('[B14D-002] NOT on FRQ choice. Page content:', pageContent.substring(0, 500))
    return
  }

  // ===========================
  // TEST B14D-002 FIX VERIFICATION
  // ===========================
  console.log('\n[B14D-002] ===== TESTING FRQ TWO-STEP CONFIRMATION =====')

  // TEST 1: Click "Type Your Answers" — should HIGHLIGHT but NOT navigate
  const typeAnswersBtn = page.locator('button').filter({ hasText: /Type Your Answers/i }).first()
  const hasTypeBtn = await typeAnswersBtn.isVisible({ timeout: 3000 }).catch(() => false)
  console.log('[B14D-002] Type Your Answers button visible:', hasTypeBtn)

  if (!hasTypeBtn) {
    console.log('[B14D-002] ERROR: Type Your Answers button not found')
    const content = await page.locator('body').textContent()
    console.log('[B14D-002] Current content:', content.substring(0, 400))
    return
  }

  await typeAnswersBtn.click()
  await page.waitForTimeout(800)
  await screenshot(page, 'frq_07_after_card_click')

  // Check 1: Still on choice screen
  const afterClickContent = await page.locator('body').textContent()
  const stillOnChoice1 = afterClickContent.includes('Type Your Answers') || afterClickContent.includes('Choose how you')
  console.log('[B14D-002] CHECK 1 - Still on choice after card click (SHOULD BE TRUE):', stillOnChoice1)

  // Check 2: Card is highlighted
  const cardClasses = await typeAnswersBtn.evaluate(el => el.className)
  const isHighlighted = cardClasses.includes('border-brand-primary') || cardClasses.includes('bg-brand-primary')
  console.log('[B14D-002] CHECK 2 - Card highlighted (SHOULD BE TRUE):', isHighlighted)
  console.log('[B14D-002] Card classes:', cardClasses.substring(0, 200))

  // Check 3: Confirm & Continue button appears
  const confirmBtn = page.locator('button').filter({ hasText: /Confirm/i }).first()
  const confirmVisible = await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)
  console.log('[B14D-002] CHECK 3 - Confirm button visible (SHOULD BE TRUE):', confirmVisible)

  // Get Confirm button text
  if (confirmVisible) {
    const confirmText = await confirmBtn.textContent()
    console.log('[B14D-002] Confirm button text:', confirmText)
  }

  await screenshot(page, 'frq_08_with_confirm_button')

  if (!confirmVisible) {
    console.log('[B14D-002] FAIL: Confirm button not visible — two-step confirmation not implemented')
    return
  }

  // Check 4: Click Confirm & Continue — should navigate to FRQ questions
  await confirmBtn.click()
  await page.waitForTimeout(3000)
  await screenshot(page, 'frq_09_after_confirm')

  const afterConfirmContent = await page.locator('body').textContent()
  const navigatedToFRQ = !afterConfirmContent.includes('Choose how you') &&
    (afterConfirmContent.includes('Free Response') || afterConfirmContent.includes('Question') ||
     afterConfirmContent.includes('Next') || afterConfirmContent.includes('Back'))
  console.log('[B14D-002] CHECK 4 - Navigated to FRQ questions (SHOULD BE TRUE):', navigatedToFRQ)
  console.log('[B14D-002] After confirm content:', afterConfirmContent.substring(0, 300))

  // Check 5: Change submission type link in header
  const changeTypeBtn = page.locator('button, a').filter({ hasText: /Change submission type/i }).first()
  const changeTypeVisible = await changeTypeBtn.isVisible({ timeout: 5000 }).catch(() => false)
  console.log('[B14D-002] CHECK 5 - Change submission type link (SHOULD BE TRUE):', changeTypeVisible)

  if (!changeTypeVisible) {
    // Check if header has any change-related text
    const headerText = await page.locator('header').first().textContent().catch(() => 'no header')
    console.log('[B14D-002] Header text:', headerText)
  }

  await screenshot(page, 'frq_10_frq_view_with_header')

  // Check 6: Type text in FRQ textarea
  const textarea = page.locator('textarea').first()
  const hasTextarea = await textarea.isVisible({ timeout: 5000 }).catch(() => false)
  console.log('[B14D-002] FRQ textarea visible:', hasTextarea)

  if (hasTextarea && changeTypeVisible) {
    await textarea.fill('Testing the change submission type flow with this sample answer text.')
    await page.waitForTimeout(500)
    console.log('[B14D-002] Typed text in textarea')

    // Check 6: Click Change submission type — should show confirm dialog
    let dialogMsg = null
    page.once('dialog', async dialog => {
      dialogMsg = dialog.message()
      console.log('[B14D-002] Warning dialog:', dialogMsg)
      await dialog.dismiss() // Cancel
    })

    await changeTypeBtn.click()
    await page.waitForTimeout(2000)
    await screenshot(page, 'frq_11_after_change_type_cancel')

    const hasWarningDialog = dialogMsg !== null
    console.log('[B14D-002] CHECK 6 - Warning dialog with typed content (SHOULD BE TRUE):', hasWarningDialog)
    console.log('[B14D-002] Dialog message:', dialogMsg)

    // Still on FRQ after cancel?
    const stillOnFRQ = await page.locator('textarea').first().isVisible({ timeout: 3000 }).catch(() => false)
    console.log('[B14D-002] CHECK 7 - Still on FRQ after cancel (SHOULD BE TRUE):', stillOnFRQ)

    // Accept the dialog and go back to choice screen
    const changeTypeBtnAgain = page.locator('button, a').filter({ hasText: /Change submission type/i }).first()
    let dialogAccepted = false
    page.once('dialog', async dialog => {
      dialogAccepted = true
      console.log('[B14D-002] Accepting dialog')
      await dialog.accept()
    })

    await changeTypeBtnAgain.click()
    await page.waitForTimeout(2000)
    await screenshot(page, 'frq_12_after_change_type_accept')

    const afterAcceptContent = await page.locator('body').textContent()
    const backOnChoice = afterAcceptContent.includes('Choose how you') || afterAcceptContent.includes('Type Your Answers')
    console.log('[B14D-002] CHECK 8 - Back on choice screen after accept (SHOULD BE TRUE):', backOnChoice)
  } else if (!changeTypeVisible) {
    console.log('[B14D-002] FAIL: Change submission type link NOT visible in header')
    // Take header snapshot
    const headerHTML = await page.locator('header').first().innerHTML().catch(() => 'no header found')
    console.log('[B14D-002] Header HTML:', headerHTML.substring(0, 500))
  }

  // ===========================
  // B14D-003: Check for code.startsWith errors
  // ===========================
  console.log('\n[B14D-003] ===== CHECK code.startsWith ERRORS =====')
  console.log('[B14D-003] Total console errors:', consoleErrors.length)
  console.log('[B14D-003] code.startsWith errors (SHOULD BE 0):', codeStartsWithErrors.length)
  if (codeStartsWithErrors.length > 0) {
    codeStartsWithErrors.forEach((e, i) => console.log(`  [${i}] ${e}`))
  }
  consoleErrors.forEach((e, i) => {
    if (!e.includes('firestore') && !e.includes('Firebase')) {
      console.log(`  [${i}] ${e.substring(0, 120)}`)
    }
  })
})
