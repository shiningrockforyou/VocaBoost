/**
 * B14D Retest v2 - FIX Verification
 * Tests FIX-9 (B14D-001, B14D-002, B14D-003 fixes)
 * Student: student7@apboost.test / Student123!
 * Test: test_micro_full_1
 */
const { test, expect } = require('@playwright/test')

const BASE_URL = 'http://localhost:5173'
const EMAIL = 'student7@apboost.test'
const PASSWORD = 'Student123!'
const TEST_ID = 'test_micro_full_1'

test.setTimeout(240000) // 4 minutes

const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/e2e/screenshots_b14d_retest'
const fs = require('fs')
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

async function screenshot(page, name) {
  const p = `${SCREENSHOTS_DIR}/${name}.png`
  await page.screenshot({ path: p, fullPage: true }).catch(() => {})
  console.log(`[SCREENSHOT] ${name}.png`)
}

async function loginAsStudent7(page) {
  await page.goto(`${BASE_URL}/login`)
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.locator('input[type="email"]').first().fill(EMAIL)
  await page.locator('input[type="password"]').first().fill(PASSWORD)
  await page.keyboard.press('Enter')
  // Wait for redirect away from login
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20000 })
  console.log('[LOGIN] URL after login:', page.url())
}

test('B14D-RETEST-001: DuplicateTabModal false positive after reload', async ({ page }) => {
  const consoleErrors = []
  const codeStartsWithErrors = []

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text()
      consoleErrors.push(text)
      if (text.includes('startsWith')) codeStartsWithErrors.push(text)
      if (text.includes('code.startsWith')) codeStartsWithErrors.push(text)
    }
  })
  page.on('pageerror', err => {
    const text = err.message
    consoleErrors.push('PAGEERROR: ' + text)
    if (text.includes('startsWith')) codeStartsWithErrors.push('PAGEERROR: ' + text)
  })

  // Step 1: Login
  console.log('\n[B14D-001] Step 1: Login as student7')
  await loginAsStudent7(page)
  await screenshot(page, '001_01_after_login')

  // Step 2: Navigate to test session
  console.log('\n[B14D-001] Step 2: Navigate to test session')
  await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`)
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(3000)
  await screenshot(page, '001_02_test_page')

  const pageUrl = page.url()
  console.log('[B14D-001] URL after navigation:', pageUrl)

  // Step 3: Check instruction screen state
  const bodyText = await page.locator('body').textContent()
  const isOnLogin = pageUrl.includes('/login')
  const isOnDashboard = pageUrl.includes('/ap') && !pageUrl.includes('/test')
  const isOnTest = pageUrl.includes('/test/')
  console.log('[B14D-001] Page state - onLogin:', isOnLogin, 'onDashboard:', isOnDashboard, 'onTest:', isOnTest)

  // If redirected back to login, navigate to /ap then try test
  if (isOnLogin) {
    console.log('[B14D-001] ISSUE: Redirected to login after navigation to test. Navigating to /ap first...')
    await page.goto(`${BASE_URL}/ap`)
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(2000)
    await screenshot(page, '001_02b_dashboard')

    await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(3000)
    await screenshot(page, '001_02c_test_page_retry')
    console.log('[B14D-001] URL on retry:', page.url())
  }

  // Step 4: Look for instruction screen elements
  const resumeBtn = page.locator('button').filter({ hasText: /Resume Test|Begin Test/i }).first()
  const hasResumeBtn = await resumeBtn.isVisible({ timeout: 5000 }).catch(() => false)
  console.log('[B14D-001] Resume/Begin button visible:', hasResumeBtn)

  // Check for DuplicateTabModal BEFORE beginning
  const dupModalSelectors = [
    'text=/duplicate tab/i',
    'text=/another tab/i',
    'text=/already open/i',
    'text=/Use This Tab/i',
    'text=/Go to Dashboard/i',
  ]
  let dupOnInstruction = false
  for (const sel of dupModalSelectors) {
    const vis = await page.locator(sel).first().isVisible().catch(() => false)
    if (vis) {
      dupOnInstruction = true
      console.log('[B14D-001] DuplicateTabModal detected on instruction screen via:', sel)
      break
    }
  }
  console.log('[B14D-001] DuplicateTabModal on instruction (before Begin):', dupOnInstruction)
  await screenshot(page, '001_03_instruction_state')

  // Step 5: Click Resume/Begin
  if (hasResumeBtn) {
    console.log('[B14D-001] Clicking Resume/Begin button...')
    await resumeBtn.click()
    await page.waitForTimeout(3000)
    await screenshot(page, '001_04_after_begin')
    console.log('[B14D-001] URL after Begin:', page.url())

    // Check for DuplicateTabModal immediately after begin
    let dupAfterBegin = false
    for (const sel of dupModalSelectors) {
      const vis = await page.locator(sel).first().isVisible().catch(() => false)
      if (vis) { dupAfterBegin = true; break }
    }
    console.log('[B14D-001] DuplicateTabModal immediately after Begin:', dupAfterBegin)

    // Step 6: RELOAD — key test for B14D-001 fix
    console.log('\n[B14D-001] Step 6: RELOAD PAGE — key test for fix')
    await page.reload()
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(3000)
    await screenshot(page, '001_05_after_reload')
    console.log('[B14D-001] URL after reload:', page.url())

    // Check for DuplicateTabModal right after reload
    let dupAfterReload = false
    for (const sel of dupModalSelectors) {
      const vis = await page.locator(sel).first().isVisible().catch(() => false)
      if (vis) { dupAfterReload = true; break }
    }
    console.log('[B14D-001] DuplicateTabModal after reload (should be FALSE):', dupAfterReload)

    // Wait 10 seconds and check again (acceptance test: NO modal within 10 seconds)
    console.log('[B14D-001] Waiting 10 seconds to check for delayed modal...')
    await page.waitForTimeout(10000)
    await screenshot(page, '001_06_after_10s_wait')

    let dupAfter10s = false
    for (const sel of dupModalSelectors) {
      const vis = await page.locator(sel).first().isVisible().catch(() => false)
      if (vis) { dupAfter10s = true; break }
    }
    console.log('[B14D-001] DuplicateTabModal after 10s wait (SHOULD BE FALSE for PASS):', dupAfter10s)

    // Step 7: Click Resume Test again after reload
    const resumeBtnAfterReload = page.locator('button').filter({ hasText: /Resume Test|Begin Test/i }).first()
    const hasResumeAfterReload = await resumeBtnAfterReload.isVisible({ timeout: 3000 }).catch(() => false)
    console.log('[B14D-001] Resume/Begin visible after reload:', hasResumeAfterReload)

    if (hasResumeAfterReload) {
      await resumeBtnAfterReload.click()
      await page.waitForTimeout(3000)
      await screenshot(page, '001_07_after_reload_begin')

      // Wait another 10 seconds to check for delayed DuplicateTabModal
      console.log('[B14D-001] Waiting 10s after reload+begin for DuplicateTabModal...')
      await page.waitForTimeout(10000)

      let dupFinalCheck = false
      for (const sel of dupModalSelectors) {
        const vis = await page.locator(sel).first().isVisible().catch(() => false)
        if (vis) { dupFinalCheck = true; break }
      }
      console.log('[B14D-001] DuplicateTabModal 10s after reload+begin (SHOULD BE FALSE for PASS):', dupFinalCheck)
      await screenshot(page, '001_08_final_state')

      // Check FRQ textarea disabled state
      const disabledInputs = await page.locator('textarea[disabled], button[disabled]').count()
      console.log('[B14D-001] Disabled inputs in testing view:', disabledInputs)

      // Check if the testing view is functional (not locked)
      const testingViewText = await page.locator('body').textContent()
      const hasAnswerInput = testingViewText.includes('A.') || testingViewText.includes('(A)') ||
                              testingViewText.includes('Next') || testingViewText.includes('Back')
      console.log('[B14D-001] Testing view appears functional:', hasAnswerInput)
    }
  } else {
    console.log('[B14D-001] WARNING: No Resume/Begin button found — cannot test reload scenario')
    // Take body content snapshot
    const bodyContent = await page.locator('body').textContent()
    console.log('[B14D-001] Body text excerpt:', bodyContent.substring(0, 400))
  }

  // Summary
  console.log('\n[B14D-001] CONSOLE ERRORS COLLECTED:')
  consoleErrors.forEach((e, i) => console.log(`  [${i}] ${e.substring(0, 120)}`))
  console.log('[B14D-001] code.startsWith errors:', codeStartsWithErrors.length)
})

test('B14D-RETEST-002: FRQ two-step confirmation and Change submission type', async ({ page }) => {
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

  // Step 1: Login
  console.log('\n[B14D-002] Step 1: Login as student7')
  await loginAsStudent7(page)

  // Step 2: Navigate to test
  console.log('\n[B14D-002] Step 2: Navigate to test session')
  await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`)
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(3000)
  await screenshot(page, '002_01_test_page')
  console.log('[B14D-002] URL:', page.url())

  // If on login, do manual navigation
  if (page.url().includes('/login')) {
    await page.goto(`${BASE_URL}/ap`)
    await page.waitForTimeout(2000)
    await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(3000)
  }

  // Step 3: Begin test
  const resumeBtn = page.locator('button').filter({ hasText: /Resume Test|Begin Test/i }).first()
  const hasResumeBtn = await resumeBtn.isVisible({ timeout: 5000 }).catch(() => false)
  console.log('[B14D-002] Resume/Begin button visible:', hasResumeBtn)

  if (hasResumeBtn) {
    await resumeBtn.click()
    await page.waitForTimeout(3000)
    await screenshot(page, '002_02_after_begin')

    // Check if already in FRQ section
    let bodyText = await page.locator('body').textContent()
    const alreadyInFRQ = bodyText.includes('Free Response') && !bodyText.includes('Choose how you')
    const onFRQChoice = bodyText.includes('Choose how you') || bodyText.includes('Type Your Answers')
    const onMCQ = bodyText.includes('Multiple Choice') || bodyText.includes('Question 1')

    console.log('[B14D-002] Current state - alreadyInFRQ:', alreadyInFRQ, 'onFRQChoice:', onFRQChoice, 'onMCQ:', onMCQ)

    if (onFRQChoice) {
      console.log('[B14D-002] Already on FRQ choice screen!')
    } else if (onMCQ || alreadyInFRQ) {
      // Navigate through MCQ to get to FRQ choice
      console.log('[B14D-002] In MCQ or FRQ testing, navigating to FRQ choice...')

      // Try going to Review first
      const reviewBtn = page.locator('button').filter({ hasText: /Review All|Review/i }).first()
      const hasReviewBtn = await reviewBtn.isVisible({ timeout: 3000 }).catch(() => false)

      if (hasReviewBtn) {
        await reviewBtn.click()
        await page.waitForTimeout(2000)
        await screenshot(page, '002_03_review')

        // Submit section
        const submitSectionBtn = page.locator('button').filter({ hasText: /Submit Section|Submit MCQ/i }).first()
        const hasSubmitSection = await submitSectionBtn.isVisible({ timeout: 3000 }).catch(() => false)
        if (hasSubmitSection) {
          // Handle dialog
          page.once('dialog', dialog => dialog.accept().catch(() => {}))
          await submitSectionBtn.click()
          await page.waitForTimeout(3000)
          await screenshot(page, '002_04_after_submit_section')
        }
      }
    }
  }

  // Wait and check for FRQ choice screen
  await page.waitForTimeout(2000)
  const contentCheck = await page.locator('body').textContent()
  const isOnFRQChoice = contentCheck.includes('Choose how you') || contentCheck.includes('Type Your Answers') ||
                         contentCheck.includes('Write by Hand') || contentCheck.includes('Free Response Section')
  console.log('[B14D-002] On FRQ choice screen:', isOnFRQChoice)
  await screenshot(page, '002_05_frq_choice_check')

  if (isOnFRQChoice) {
    // TEST: Click "Type Your Answers" card
    console.log('\n[B14D-002] Testing two-step confirmation...')
    const typeAnswersBtn = page.locator('button').filter({ hasText: /Type Your Answers/i }).first()
    const hasTypeBtn = await typeAnswersBtn.isVisible({ timeout: 3000 }).catch(() => false)
    console.log('[B14D-002] Type Your Answers button visible:', hasTypeBtn)

    if (hasTypeBtn) {
      await typeAnswersBtn.click()
      await page.waitForTimeout(800)
      await screenshot(page, '002_06_after_card_click')

      // CHECK 1: Still on choice screen (did NOT immediately navigate)
      const stillOnChoice = (await page.locator('body').textContent())
        .includes('Choose how you') || (await page.locator('body').textContent()).includes('Type Your Answers')
      console.log('[B14D-002] PASS CHECK 1 - Still on choice screen after card click (SHOULD BE TRUE):', stillOnChoice)

      // CHECK 2: Card is highlighted
      const cardClass = await typeAnswersBtn.evaluate(el => el.className)
      const isHighlighted = cardClass.includes('border-brand-primary') || cardClass.includes('bg-brand')
      console.log('[B14D-002] PASS CHECK 2 - Card highlighted (SHOULD BE TRUE):', isHighlighted)
      console.log('[B14D-002] Card class:', cardClass.substring(0, 150))

      // CHECK 3: Confirm & Continue button appears
      const confirmBtn = page.locator('button').filter({ hasText: /Confirm.*Continue|Confirm &/i }).first()
      const confirmVisible = await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)
      console.log('[B14D-002] PASS CHECK 3 - Confirm & Continue button appears (SHOULD BE TRUE):', confirmVisible)

      if (confirmVisible) {
        // CHECK 4: Click Confirm & Continue — should navigate to FRQ questions
        await confirmBtn.click()
        await page.waitForTimeout(3000)
        await screenshot(page, '002_07_after_confirm')

        const afterConfirmText = await page.locator('body').textContent()
        const navigatedToFRQ = !afterConfirmText.includes('Choose how you') &&
          (afterConfirmText.includes('textarea') || afterConfirmText.includes('Question') ||
           afterConfirmText.includes('Free Response') || afterConfirmText.includes('Next'))
        console.log('[B14D-002] PASS CHECK 4 - Navigated to FRQ questions (SHOULD BE TRUE):', navigatedToFRQ)
        console.log('[B14D-002] Body text after confirm (first 200):', afterConfirmText.substring(0, 200))

        // CHECK 5: "Change submission type" link in header
        const changeTypeLink = page.locator('button, a').filter({ hasText: /Change submission type/i }).first()
        const changeTypeLinkVisible = await changeTypeLink.isVisible({ timeout: 5000 }).catch(() => false)
        console.log('[B14D-002] PASS CHECK 5 - Change submission type link (SHOULD BE TRUE):', changeTypeLinkVisible)
        await screenshot(page, '002_08_frq_with_header')

        // Get current page HTML for evidence
        const headerHTML = await page.locator('header, nav').first().innerHTML().catch(() => 'no header')
        console.log('[B14D-002] Header HTML:', headerHTML.substring(0, 500))

        // CHECK 6: Type in FRQ textarea
        const frqTextarea = page.locator('textarea').first()
        const hasTextarea = await frqTextarea.isVisible({ timeout: 5000 }).catch(() => false)
        console.log('[B14D-002] FRQ textarea visible:', hasTextarea)

        if (hasTextarea) {
          await frqTextarea.click()
          await frqTextarea.fill('This is my test answer for FRQ verification.')
          await page.waitForTimeout(500)
          console.log('[B14D-002] Typed text in FRQ textarea')

          if (changeTypeLinkVisible) {
            // CHECK 7: Click Change submission type — should show confirm dialog
            let dialogMsg = null
            let dialogDismissed = false
            page.once('dialog', async dialog => {
              dialogMsg = dialog.message()
              dialogDismissed = true
              console.log('[B14D-002] Dialog appeared:', dialog.message())
              await dialog.dismiss() // Cancel
            })

            await changeTypeLink.click()
            await page.waitForTimeout(2000)

            console.log('[B14D-002] PASS CHECK 6 - Warning dialog appeared (SHOULD BE TRUE):', dialogDismissed)
            console.log('[B14D-002] Dialog message:', dialogMsg)

            // CHECK 7b: Still on FRQ after cancel
            const stillOnFRQ = await page.locator('textarea').first().isVisible({ timeout: 3000 }).catch(() => false)
            console.log('[B14D-002] PASS CHECK 7 - Still on FRQ after cancel dialog (SHOULD BE TRUE):', stillOnFRQ)
            await screenshot(page, '002_09_after_cancel_dialog')

            // CHECK 8: Click Change type again and ACCEPT — back to choice screen
            const changeTypeLinkAgain = page.locator('button, a').filter({ hasText: /Change submission type/i }).first()
            let dialogAccepted = false
            page.once('dialog', async dialog => {
              dialogAccepted = true
              console.log('[B14D-002] Dialog 2 appeared:', dialog.message())
              await dialog.accept()
            })

            await changeTypeLinkAgain.click()
            await page.waitForTimeout(2000)
            await screenshot(page, '002_10_after_accept_dialog')

            const afterAcceptText = await page.locator('body').textContent()
            const backOnChoice = afterAcceptText.includes('Choose how you') || afterAcceptText.includes('Type Your Answers')
            console.log('[B14D-002] PASS CHECK 8 - Back on choice screen after accept (SHOULD BE TRUE):', backOnChoice)
          } else {
            console.log('[B14D-002] FAIL: Change submission type link NOT visible — fix not complete')
          }
        } else {
          console.log('[B14D-002] WARNING: No textarea visible — may be in wrong view')
          const bodyAfterConfirm = await page.locator('body').textContent()
          console.log('[B14D-002] Body after confirm:', bodyAfterConfirm.substring(0, 400))
        }
      }
    }
  } else {
    console.log('[B14D-002] SKIP: Could not reach FRQ choice screen')
    const bodyContent = await page.locator('body').textContent()
    console.log('[B14D-002] Current page content:', bodyContent.substring(0, 500))
    await screenshot(page, '002_skip')
  }

  // Summary
  console.log('\n[B14D-002] CONSOLE ERRORS:')
  consoleErrors.forEach((e, i) => console.log(`  [${i}] ${e.substring(0, 120)}`))
  console.log('[B14D-002] code.startsWith errors:', codeStartsWithErrors.length)
})

test('B14D-RETEST-003: SPA navigation guard (Leave Test modal)', async ({ page }) => {
  const consoleErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', err => { consoleErrors.push('PAGEERROR: ' + err.message) })

  console.log('\n[B14D-003] Testing SPA navigation guard...')

  await loginAsStudent7(page)
  await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`)
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(3000)

  if (page.url().includes('/login')) {
    await page.goto(`${BASE_URL}/ap`)
    await page.waitForTimeout(2000)
    await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(3000)
  }

  const resumeBtn = page.locator('button').filter({ hasText: /Resume Test|Begin Test/i }).first()
  const hasResume = await resumeBtn.isVisible({ timeout: 5000 }).catch(() => false)

  if (!hasResume) {
    console.log('[B14D-003] SKIP: Cannot find Resume/Begin button')
    await screenshot(page, '003_skip')
    return
  }

  await resumeBtn.click()
  await page.waitForTimeout(3000)
  await screenshot(page, '003_01_in_testing')

  const bodyText = await page.locator('body').textContent()
  const isInTesting = bodyText.includes('Question') || bodyText.includes('Back') || bodyText.includes('Next')
  console.log('[B14D-003] In testing view:', isInTesting)
  console.log('[B14D-003] URL in testing:', page.url())

  // Test SPA back navigation guard
  console.log('[B14D-003] Navigating back to test browser back...')
  await page.goBack()
  await page.waitForTimeout(2000)
  await screenshot(page, '003_02_after_back')

  // Check for Leave Test modal
  const leaveTestModal = page.locator('text=Leave Test').first()
  const leaveModalVisible = await leaveTestModal.isVisible({ timeout: 3000 }).catch(() => false)
  console.log('[B14D-003] Leave Test modal visible after back nav (SHOULD BE TRUE):', leaveModalVisible)

  const currentUrl = page.url()
  console.log('[B14D-003] URL after back nav:', currentUrl)
  const stayedOnTest = currentUrl.includes('/test/')
  console.log('[B14D-003] Still on test page:', stayedOnTest)

  if (leaveModalVisible) {
    // Take screenshot of the modal
    await screenshot(page, '003_03_leave_modal')

    // Check for Stay / Leave buttons
    const stayBtn = page.locator('button').filter({ hasText: /Stay|Cancel|Stay on Test/i }).first()
    const leaveBtn = page.locator('button').filter({ hasText: /Leave|Exit/i }).first()
    const stayVisible = await stayBtn.isVisible({ timeout: 2000 }).catch(() => false)
    const leaveVisible = await leaveBtn.isVisible({ timeout: 2000 }).catch(() => false)
    console.log('[B14D-003] Stay button visible:', stayVisible)
    console.log('[B14D-003] Leave button visible:', leaveVisible)

    // Click Stay
    if (stayVisible) {
      await stayBtn.click()
      await page.waitForTimeout(1000)
      await screenshot(page, '003_04_after_stay')
      const urlAfterStay = page.url()
      console.log('[B14D-003] URL after Stay:', urlAfterStay)
      console.log('[B14D-003] Still on test after Stay:', urlAfterStay.includes('/test/'))
    }
  } else {
    console.log('[B14D-003] Leave Test modal NOT visible — checking if navigated away or stayed')
    const urlAfterBack = page.url()
    console.log('[B14D-003] URL after back:', urlAfterBack)

    if (urlAfterBack.includes('/test/')) {
      console.log('[B14D-003] Stayed on test (URL unchanged) — blocker may be working via different mechanism')
    } else {
      console.log('[B14D-003] FAIL: Navigated away from test without confirmation modal')
    }
  }

  console.log('\n[B14D-003] CONSOLE ERRORS:')
  consoleErrors.forEach((e, i) => console.log(`  [${i}] ${e.substring(0, 120)}`))
})
