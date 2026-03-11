/**
 * B14D FRQ Test v2 - More precise navigation to FRQ choice screen
 */
const { test } = require('@playwright/test')
const fs = require('fs')

const BASE_URL = 'http://localhost:5173'
const EMAIL = 'student7@apboost.test'
const PASSWORD = 'Student123!'
const TEST_ID = 'test_micro_full_1'
const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/e2e/screenshots_b14d_retest'

test.setTimeout(360000) // 6 minutes

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

async function screenshot(page, name) {
  const p = `${SCREENSHOTS_DIR}/${name}.png`
  await page.screenshot({ path: p, fullPage: true }).catch(() => {})
  console.log(`[SCREENSHOT] ${name}.png`)
}

test('B14D-002: FRQ two-step confirmation - v2', async ({ page }) => {
  const consoleErrors = []
  const codeStartsWithErrors = []

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text()
      consoleErrors.push(text)
      if (text.toLowerCase().includes('startswith')) codeStartsWithErrors.push(text)
    }
  })
  page.on('pageerror', err => {
    const text = err.message
    consoleErrors.push('PAGEERROR: ' + text)
    if (text.toLowerCase().includes('startswith')) codeStartsWithErrors.push('PAGEERROR: ' + text)
  })

  // Login
  await page.goto(`${BASE_URL}/login`)
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.locator('input[type="email"]').first().fill(EMAIL)
  await page.locator('input[type="password"]').first().fill(PASSWORD)
  await page.keyboard.press('Enter')
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20000 })

  // Navigate to test
  await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`)
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2000)

  // Begin test
  const beginBtn = page.locator('button').filter({ hasText: /Resume Test|Begin Test/i }).first()
  if (!await beginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('ERROR: No Begin/Resume button found')
    return
  }
  await beginBtn.click()
  await page.waitForTimeout(2000)
  await screenshot(page, 'v2_01_started')

  // Answer all 15 MCQ questions quickly
  console.log('Answering all 15 MCQ questions...')
  for (let i = 1; i <= 15; i++) {
    await page.waitForTimeout(300)

    // Get all visible buttons and find the first answer choice (A)
    const allButtons = await page.locator('button').all()
    let answerClicked = false

    for (const btn of allButtons) {
      const text = await btn.textContent().catch(() => '')
      // Click first MCQ answer option (starts with "A")
      if (text.trim().startsWith('A') && text.trim() !== 'AP Practice') {
        await btn.click().catch(() => {})
        answerClicked = true
        break
      }
    }

    if (!answerClicked) {
      // Fallback: click the first answer option using aria or data attributes
      const firstOption = page.locator('[role="button"][class*="answer"], button[class*="answer"]').first()
      if (await firstOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        await firstOption.click().catch(() => {})
      }
    }

    // After last question, click Review
    if (i === 15) {
      await page.waitForTimeout(500)
      // Click the review button (bottom right on Q15)
      const reviewRightBtn = page.locator('button').filter({ hasText: /Review/i }).last()
      await reviewRightBtn.click({ timeout: 3000 }).catch(() => {})
      await page.waitForTimeout(2000)
      await screenshot(page, 'v2_02_after_review_click')
      break
    }

    // Click Next button
    const nextBtn = page.locator('button').filter({ hasText: /Next/i }).last()
    await nextBtn.click({ timeout: 3000 }).catch(() => {})
  }

  // Check if we're on the review screen
  await page.waitForTimeout(1500)
  const reviewContent = await page.locator('body').textContent()
  const isOnReview = reviewContent.includes('Review') && (reviewContent.includes('15/15') || reviewContent.includes('15 of 15') || reviewContent.includes('Answered'))
  console.log('On review screen:', isOnReview)
  console.log('Review content:', reviewContent.substring(0, 400))
  await screenshot(page, 'v2_03_review_check')

  // Find Submit Section button on review screen
  // The review screen might have different button text
  const allBtns = await page.locator('button').allTextContents()
  console.log('All buttons on review:', allBtns.join(' | '))

  // Try different Submit button texts
  const submitBtnSelectors = [
    'Submit Section 1',
    'Submit Section',
    'Submit & Continue',
    'Submit MCQ',
    'Finish Section',
    'Continue to FRQ',
    'Continue',
    'Submit',
  ]

  let submitted = false
  for (const btnText of submitBtnSelectors) {
    const btn = page.locator('button').filter({ hasText: new RegExp(btnText, 'i') }).first()
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`Found submit button: "${btnText}"`)
      page.once('dialog', async dialog => {
        console.log('Dialog:', dialog.message())
        await dialog.accept()
      })
      await btn.click()
      submitted = true
      break
    }
  }

  if (!submitted) {
    console.log('No submit button found. Current page:')
    const currentContent = await page.locator('body').textContent()
    console.log(currentContent.substring(0, 600))
    await screenshot(page, 'v2_04_no_submit')
    return
  }

  await page.waitForTimeout(3000)
  await screenshot(page, 'v2_04_after_submit')
  console.log('URL after submit:', page.url())

  // Wait for FRQ choice screen
  await page.waitForTimeout(2000)
  const postSubmitContent = await page.locator('body').textContent()
  const isOnFRQChoice = postSubmitContent.includes('Type Your Answers') ||
                         postSubmitContent.includes('Choose how you') ||
                         postSubmitContent.includes('Free Response Section') ||
                         postSubmitContent.includes('Write by Hand')
  console.log('On FRQ choice screen:', isOnFRQChoice)

  if (!isOnFRQChoice) {
    console.log('NOT on FRQ choice. Content:', postSubmitContent.substring(0, 600))
    await screenshot(page, 'v2_05_not_frq')
    return
  }

  await screenshot(page, 'v2_05_frq_choice')

  // ===========================
  // TEST B14D-002: Two-step confirmation
  // ===========================
  console.log('\n===== TESTING B14D-002: FRQ Two-Step Confirmation =====')

  // Step 1: Click "Type Your Answers" card
  const typeBtn = page.locator('button').filter({ hasText: /Type Your Answers/i }).first()
  if (!await typeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('ERROR: Type Your Answers button not found')
    return
  }

  await typeBtn.click()
  await page.waitForTimeout(800)
  await screenshot(page, 'v2_06_after_card_click')

  // CHECK 1: Still on choice screen
  const afterClickContent = await page.locator('body').textContent()
  const stillOnChoice = afterClickContent.includes('Type Your Answers') || afterClickContent.includes('Choose how you')
  console.log('CHECK 1 - Still on choice after card click (SHOULD=TRUE):', stillOnChoice)

  // CHECK 2: Card highlighted
  const cardClass = await typeBtn.evaluate(el => el.className)
  const highlighted = cardClass.includes('border-brand-primary') || cardClass.includes('bg-brand-primary')
  console.log('CHECK 2 - Card highlighted (SHOULD=TRUE):', highlighted)
  console.log('Card class:', cardClass)

  // CHECK 3: Confirm button appears
  const confirmBtn = page.locator('button').filter({ hasText: /Confirm/i }).first()
  const confirmVisible = await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)
  console.log('CHECK 3 - Confirm button visible (SHOULD=TRUE):', confirmVisible)
  if (confirmVisible) {
    const confirmText = await confirmBtn.textContent()
    console.log('Confirm button text:', confirmText)
  }

  await screenshot(page, 'v2_07_confirm_button')

  if (!confirmVisible) {
    console.log('FAIL: Confirm button NOT visible')
    return
  }

  // CHECK 4: Click Confirm — should navigate to FRQ
  await confirmBtn.click()
  await page.waitForTimeout(3000)
  await screenshot(page, 'v2_08_after_confirm')

  const afterConfirmContent = await page.locator('body').textContent()
  const navigatedToFRQ = !afterConfirmContent.includes('Choose how you') &&
    afterConfirmContent.length > 100
  console.log('CHECK 4 - Navigated away from choice screen (SHOULD=TRUE):', navigatedToFRQ)
  console.log('After confirm content (200 chars):', afterConfirmContent.substring(0, 200))

  // CHECK 5: "Change submission type" link in header
  const changeTypeBtn = page.locator('button, a').filter({ hasText: /Change submission type/i }).first()
  const changeTypeVisible = await changeTypeBtn.isVisible({ timeout: 5000 }).catch(() => false)
  console.log('CHECK 5 - Change submission type link (SHOULD=TRUE):', changeTypeVisible)

  if (!changeTypeVisible) {
    // Check header HTML
    const headerHTML = await page.locator('header').first().innerHTML().catch(() => 'no header')
    console.log('Header HTML:', headerHTML.substring(0, 600))
  }

  await screenshot(page, 'v2_09_frq_with_header')

  // CHECK 6: FRQ textarea
  const textarea = page.locator('textarea').first()
  const hasTextarea = await textarea.isVisible({ timeout: 5000 }).catch(() => false)
  console.log('FRQ textarea visible:', hasTextarea)

  if (hasTextarea) {
    await textarea.fill('Sample FRQ answer for testing change submission type.')
    await page.waitForTimeout(500)
    console.log('Typed text in textarea')
  }

  if (changeTypeVisible) {
    // CHECK 7: Click Change type — should show warning dialog (has text)
    let dialogMsg = null
    page.once('dialog', async dialog => {
      dialogMsg = dialog.message()
      console.log('Warning dialog:', dialogMsg)
      await dialog.dismiss()
    })

    await changeTypeBtn.click()
    await page.waitForTimeout(2000)
    await screenshot(page, 'v2_10_after_cancel')

    const hasDialog = dialogMsg !== null
    console.log('CHECK 6 - Warning dialog (SHOULD=TRUE if text typed):', hasDialog)
    console.log('Dialog message:', dialogMsg)

    const stillOnFRQ = await page.locator('textarea').first().isVisible({ timeout: 3000 }).catch(() => false)
    console.log('CHECK 7 - Still on FRQ after cancel (SHOULD=TRUE):', stillOnFRQ)

    // CHECK 8: Accept dialog and return to choice
    const changeTypeBtnAgain = page.locator('button, a').filter({ hasText: /Change submission type/i }).first()
    page.once('dialog', async dialog => {
      console.log('Dialog 2:', dialog.message())
      await dialog.accept()
    })
    await changeTypeBtnAgain.click()
    await page.waitForTimeout(2000)
    await screenshot(page, 'v2_11_after_accept')

    const backChoiceContent = await page.locator('body').textContent()
    const backOnChoice = backChoiceContent.includes('Choose how you') || backChoiceContent.includes('Type Your Answers')
    console.log('CHECK 8 - Back on choice screen (SHOULD=TRUE):', backOnChoice)
  }

  // B14D-003: code.startsWith check
  console.log('\n===== B14D-003: code.startsWith errors =====')
  console.log('code.startsWith errors (SHOULD=0):', codeStartsWithErrors.length)
  codeStartsWithErrors.forEach((e, i) => console.log(`  [${i}] ${e}`))

  // All non-Firestore errors
  const nonFsErrors = consoleErrors.filter(e => !e.includes('firestore') && !e.includes('Firebase') && !e.includes('Firestore'))
  console.log('Other console errors:', nonFsErrors.length)
  nonFsErrors.forEach((e, i) => console.log(`  [${i}] ${e.substring(0, 150)}`))
})
