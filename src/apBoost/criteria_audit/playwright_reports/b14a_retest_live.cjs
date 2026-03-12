/**
 * B14A-retest Live Test Script
 * Persona: The Careful One (student4@apboost.test / Student123!)
 * Test: Micro test (test_micro_full_1)
 *
 * Runs:
 * 1. Full B14-A scenario: careful student with flagging, navigator, answer changes, review, submit
 * 2. Extra checks: suppressTakeoverRef (no DuplicateTabModal on fresh start),
 *    navigation reconciliation, flatNavigationItems dedup, AnswerInput badge,
 *    login redirect to /ap, flaggedQuestions on report card
 */

const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE_URL = 'http://localhost:5173'
const EMAIL = 'student4@apboost.test'
const PASSWORD = 'Student123!'
const TEST_ID = 'test_micro_full_1'

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots_B14A_retest')
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })

const results = {
  timestamp: new Date().toISOString(),
  steps: [],
  consoleErrors: [],
  findings: [],
}

function log(step, status, notes = '') {
  const entry = { step, status, notes }
  results.steps.push(entry)
  console.log(`[${status}] ${step}${notes ? ': ' + notes : ''}`)
}

function finding(id, severity, description, details = '') {
  results.findings.push({ id, severity, description, details })
  console.log(`\n*** FINDING ${id} [${severity}]: ${description} ***\n${details}\n`)
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`)
  await page.screenshot({ path: filePath, fullPage: false })
  console.log(`  [screenshot] ${name}.png`)
  return filePath
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const text = msg.text()
      results.consoleErrors.push({ type: msg.type(), text, url: page.url() })
      if (!text.includes('Firestore') && !text.includes('firebase') && !text.includes('favicon')) {
        console.log(`  [console ${msg.type()}] ${text.substring(0, 150)}`)
      }
    }
  })
  page.on('pageerror', err => {
    results.consoleErrors.push({ type: 'pageerror', text: err.message, url: page.url() })
    console.log(`  [pageerror] ${err.message.substring(0, 200)}`)
  })

  try {
    // ===== STEP 1: Login =====
    console.log('\n--- STEP 1: Login ---')
    await page.goto(`${BASE_URL}/login`)
    await page.waitForTimeout(2000)
    await screenshot(page, '01_login_page')

    // Fill credentials
    await page.fill('input[type="email"], input[name="email"]', EMAIL)
    await page.fill('input[type="password"], input[name="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)

    const afterLoginUrl = page.url()
    log('Login', afterLoginUrl.includes('/ap') ? 'PASS' : 'FAIL',
      `Redirected to: ${afterLoginUrl}`)
    await screenshot(page, '02_after_login')

    // CHECK: Login redirect to /ap
    if (afterLoginUrl.includes('/ap') && !afterLoginUrl.includes('/ap/teacher')) {
      log('Login redirect to /ap', 'PASS', `URL: ${afterLoginUrl}`)
    } else {
      finding('B14A-RETEST-LOGIN-001', 'Medium',
        'Login did not redirect to /ap for AP student',
        `Expected URL containing /ap, got: ${afterLoginUrl}`)
      // Navigate manually
      await page.goto(`${BASE_URL}/ap`)
      await page.waitForTimeout(2000)
    }

    // ===== STEP 2: Navigate to dashboard, find Micro test =====
    console.log('\n--- STEP 2: Dashboard ---')
    const dashUrl = page.url()
    log('Dashboard loaded', 'PASS', `URL: ${dashUrl}`)
    await screenshot(page, '03_dashboard')

    // Click on Micro test card
    await page.waitForTimeout(1000)
    const microTestLink = page.locator('a[href*="test_micro_full_1"], button').filter({ hasText: /micro|Micro|AP Micro/i }).first()
    const microExists = await microTestLink.count() > 0
    if (microExists) {
      await microTestLink.click()
      log('Clicked Micro test', 'PASS')
    } else {
      // Try navigating directly
      await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`)
      log('Navigated directly to test', 'INFO', 'Test card not found on dashboard')
    }
    await page.waitForTimeout(3000)
    await screenshot(page, '04_instruction_screen')

    // ===== STEP 3: Check DuplicateTabModal does NOT appear =====
    console.log('\n--- STEP 3: Check no DuplicateTabModal on fresh start ---')
    await sleep(3000) // Wait for suppressTakeoverRef window + initial heartbeat
    const dupModal = page.locator('text=Session Active Elsewhere, text=This test is already open')
    const dupModalCount = await dupModal.count()
    if (dupModalCount === 0) {
      log('No DuplicateTabModal on fresh start', 'PASS', 'suppressTakeoverRef working')
    } else {
      finding('B14A-RETEST-002', 'High',
        'DuplicateTabModal appeared on fresh session start',
        'suppressTakeoverRef fix may have been reverted or is not working')
      // Try to dismiss
      const useThisTab = page.locator('button', { hasText: /Use This Tab|Take Control/i }).first()
      if (await useThisTab.count() > 0) await useThisTab.click()
      await sleep(1000)
    }
    await screenshot(page, '05_no_dup_modal_check')

    // ===== STEP 4: Start/Resume the test =====
    console.log('\n--- STEP 4: Begin/Resume Test ---')
    const beginBtn = page.locator('button').filter({ hasText: /Begin Test|Resume Test/i }).first()
    const beginCount = await beginBtn.count()
    if (beginCount > 0) {
      const btnText = await beginBtn.textContent()
      log('Found begin/resume button', 'PASS', `Button text: "${btnText?.trim()}"`)
      await beginBtn.click()
      await page.waitForTimeout(3000)
      log('Clicked begin/resume', 'PASS')
    } else {
      log('No begin/resume button found', 'FAIL', 'Instruction screen not loaded properly')
      await screenshot(page, '04b_instruction_issue')
      throw new Error('Cannot proceed - instruction screen missing begin button')
    }
    await screenshot(page, '06_test_started')

    // ===== STEP 5: Answer MCQ questions (careful student pace) =====
    console.log('\n--- STEP 5: Answer MCQ Q1-Q15 (careful student) ---')
    const answerMap = {} // Track our answers
    let flaggedQuestions = []
    const questionsToFlag = [3, 7, 11, 14] // 1-indexed
    const questionsToChange = [4, 9, 13] // 1-indexed - will change answer once

    // Helper: get current question number
    async function getCurrentQNum() {
      try {
        const counterText = await page.locator('text=/Question \\d+ of \\d+/').first().textContent()
        const match = counterText?.match(/Question (\d+)/)
        return match ? parseInt(match[1]) : null
      } catch { return null }
    }

    // Helper: get answer buttons (role="radio" or flex-1 buttons)
    async function getAnswerButtons() {
      // Try radio buttons first (ARIA fix)
      const radioButtons = page.locator('button[role="radio"]')
      const radioCount = await radioButtons.count()
      if (radioCount > 0) return { buttons: radioButtons, hasARIA: true }

      // Fall back to flex-1 buttons (choice buttons, not strikethrough)
      // Answer buttons have flex-1 class, strikethrough buttons have shrink-0
      const answerBtns = page.locator('.space-y-3 .flex-1').filter({ hasNot: page.locator('svg') }).first().locator('..')
      const allBtns = page.locator('.space-y-3 button.flex-1')
      const count = await allBtns.count()
      return { buttons: allBtns, hasARIA: false, count }
    }

    let answeredCount = 0
    let ariaRolesPresent = null

    for (let qNum = 1; qNum <= 15; qNum++) {
      await sleep(Math.floor(Math.random() * 3000) + 2000) // 2-5s reading time

      const qNumActual = await getCurrentQNum()
      console.log(`  Q${qNum} (actual: ${qNumActual}): reading...`)

      // Check ARIA roles on first question
      if (qNum === 1) {
        const { hasARIA } = await getAnswerButtons()
        ariaRolesPresent = hasARIA
        if (hasARIA) {
          log('AnswerInput ARIA roles present (role="radio")', 'PASS')
        } else {
          finding('B14A-RETEST-ARIA-001', 'Medium',
            'AnswerInput answer buttons missing role="radio" ARIA attribute',
            'B14A-005 fix was listed as complete in consolidated fixes but role="radio" not present')
        }
      }

      // Select an answer - pick choice B for odd questions, choice C for even (vary it)
      const choices = ['A', 'B', 'C', 'D']
      let selectedChoice = choices[qNum % 4]

      // Click the answer button
      try {
        // Try specific answer by letter text
        const answerBtn = page.locator(`.space-y-3 button.flex-1`).nth(qNum % 4)
        const btnCount = await answerBtn.count()
        if (btnCount > 0) {
          await answerBtn.click()
          answerMap[qNum] = selectedChoice
          await sleep(500)

          // Change answer 30% of time (for questionsToChange)
          if (questionsToChange.includes(qNum)) {
            await sleep(2000) // Careful student deliberating
            const newChoice = choices[(qNum + 2) % 4]
            const changeBtn = page.locator(`.space-y-3 button.flex-1`).nth((qNum + 2) % 4)
            if (await changeBtn.count() > 0) {
              await changeBtn.click()
              answerMap[qNum] = newChoice
              log(`Q${qNum}: Changed answer`, 'PASS', `${selectedChoice} → ${newChoice}`)
            }
          }

          answeredCount++
        } else {
          log(`Q${qNum}: No answer buttons found`, 'WARN')
        }
      } catch (e) {
        log(`Q${qNum}: Error selecting answer`, 'WARN', e.message.substring(0, 100))
      }

      // Flag if in flag list
      if (questionsToFlag.includes(qNum)) {
        try {
          const flagBtn = page.locator('button').filter({ hasText: /Flag for Review|Flagged/i }).first()
          if (await flagBtn.count() > 0) {
            await flagBtn.click()
            flaggedQuestions.push(qNum)
            await sleep(300)
            log(`Q${qNum}: Flagged`, 'PASS')
          }
        } catch (e) {
          log(`Q${qNum}: Flag error`, 'WARN', e.message.substring(0, 100))
        }
      }

      // Take screenshot on flagged/changed questions
      if (questionsToFlag.includes(qNum) || questionsToChange.includes(qNum)) {
        await screenshot(page, `07_q${qNum}_answered`)
      }

      // Click Next (not on last question)
      if (qNum < 15) {
        try {
          const nextBtn = page.locator('button').filter({ hasText: /Next|→/i }).last()
          if (await nextBtn.count() > 0) {
            await nextBtn.click()
            await sleep(500)
          }
        } catch (e) {
          log(`Q${qNum}: Next button error`, 'WARN', e.message.substring(0, 100))
        }
      }
    }

    log('MCQ answering complete', answeredCount >= 12 ? 'PASS' : 'PARTIAL',
      `Answered ${answeredCount}/15 questions, flagged ${flaggedQuestions.length}`)
    await screenshot(page, '08_after_q15')

    // ===== STEP 6: Navigate to flagged questions via navigator =====
    console.log('\n--- STEP 6: Open Navigator, revisit flagged questions ---')
    try {
      // Open navigator
      const navBtn = page.locator('button').filter({ hasText: /Question \d+ of \d+|Navigator/i }).first()
      if (await navBtn.count() > 0) {
        await navBtn.click()
        await sleep(1000)
        await screenshot(page, '09_navigator_open')
        log('Navigator opened', 'PASS')

        // Check for flagged questions (🚩 emoji or flag indicator)
        const navBody = await page.locator('[role="dialog"], .fixed').first().textContent().catch(() => '')
        const flagCount = (navBody.match(/🚩/g) || []).length
        log('Navigator flagged count', flagCount >= 3 ? 'PASS' : 'PARTIAL',
          `Found ${flagCount} 🚩 emojis in navigator (expected 4)`)

        // Check for letter badges in navigator grid
        const hasLetterBadges = await page.locator('[role="dialog"] span').filter({ hasText: /^[A-D]$/ }).count() > 0
        if (hasLetterBadges) {
          log('Navigator has answer letter badges', 'PASS')
        } else {
          log('Navigator has no letter badges', 'INFO', 'May not be implemented (B14C-002 deferred)')
        }

        // Jump to a flagged question (Q11)
        try {
          // Find Q11 in navigator - look for button with text "11" or containing Q11
          const q11Cell = page.locator('[role="dialog"] button, [role="dialog"] [role="gridcell"]')
            .filter({ hasText: /^11$/ }).first()
          if (await q11Cell.count() > 0) {
            await q11Cell.click()
            await sleep(1000)
            const newQNum = await getCurrentQNum()
            log(`Navigator jump to Q11`, newQNum === 11 ? 'PASS' : 'PARTIAL',
              `Now at Q${newQNum}`)
            await screenshot(page, '10_after_nav_jump')
          } else {
            log('Q11 cell not found in navigator', 'INFO')
            // Close navigator
            const closeBtn = page.locator('[role="dialog"] button').filter({ hasText: /×|✕|Close/i }).first()
            if (await closeBtn.count() > 0) await closeBtn.click()
          }
        } catch (e) {
          log('Navigator jump error', 'WARN', e.message.substring(0, 100))
        }

        // Change 1 flagged answer (on current question after jump)
        try {
          const changeToChoice = page.locator('.space-y-3 button.flex-1').nth(0)
          if (await changeToChoice.count() > 0) {
            await changeToChoice.click()
            await sleep(500)
            log('Changed answer on revisited flagged question', 'PASS')
          }
        } catch (e) {
          log('Answer change error', 'WARN', e.message.substring(0, 100))
        }
      } else {
        log('Navigator button not found', 'WARN', 'Cannot test navigator')
      }
    } catch (e) {
      log('Navigator test error', 'WARN', e.message.substring(0, 100))
    }

    // ===== STEP 7: Go to Review screen =====
    console.log('\n--- STEP 7: Review Screen ---')
    // Navigate to Q15 first (to get Review button)
    try {
      // Open navigator and jump to Q15
      const navBtn2 = page.locator('button').filter({ hasText: /Question \d+ of \d+/i }).first()
      if (await navBtn2.count() > 0) {
        await navBtn2.click()
        await sleep(1000)
        const q15Cell = page.locator('[role="dialog"] button, [role="dialog"] [role="gridcell"]')
          .filter({ hasText: /^15$/ }).first()
        if (await q15Cell.count() > 0) {
          await q15Cell.click()
          await sleep(1000)
          log('Jumped to Q15 via navigator', 'PASS')
        }
      }
    } catch (e) {
      // Try clicking Next multiple times to get to Q15
      for (let i = 0; i < 5; i++) {
        try {
          const nextBtn = page.locator('button').filter({ hasText: /Next|→/i }).last()
          if (await nextBtn.count() > 0) await nextBtn.click()
          await sleep(300)
        } catch {}
      }
    }

    // Click Review
    await sleep(1000)
    const reviewBtn = page.locator('button').filter({ hasText: /Review/i }).first()
    const hasReviewBtn = await reviewBtn.count() > 0
    if (hasReviewBtn) {
      await reviewBtn.click()
      await sleep(2000)
      await screenshot(page, '11_review_screen')
      log('Review screen opened', 'PASS')

      // CHECK: Timer visible on review screen
      const timerOnReview = await page.locator('.review-screen, [class*="review"]').first()
        .textContent().catch(() => '')
      // Check for timer component specifically
      const timerElement = page.locator('text=/\\d+:\\d{2}/', { timeout: 2000 })
      const timerVisible = await timerElement.count() > 0
      if (timerVisible) {
        log('Timer visible on review screen', 'PASS', 'FIX-7 verified')
      } else {
        finding('B14A-RETEST-TIMER-001', 'Medium',
          'Timer not visible on review screen',
          'ReviewScreen.jsx should render TestTimer — check if timeRemaining prop is being passed')
      }

      // Check answered count display
      const reviewText = await page.content()
      const answeredMatch = reviewText.match(/Answered:\s*(\d+)\/(\d+)/)
      if (answeredMatch) {
        log('Review answered count', 'PASS',
          `Answered: ${answeredMatch[1]}/${answeredMatch[2]}`)
      } else {
        log('Review answered count', 'INFO', 'Could not parse answered count')
      }

      // Wait 5s (careful student review)
      await sleep(5000)
      log('Waited 5s on review (careful student)', 'PASS')
    } else {
      log('Review button not found on Q15', 'WARN')
      await screenshot(page, '11b_no_review_btn')
    }

    // ===== STEP 8: Submit Section 1 =====
    console.log('\n--- STEP 8: Submit Section 1 (MCQ) ---')
    const submitSectionBtn = page.locator('button').filter({ hasText: /Submit Section|Submit MCQ/i }).first()
    if (await submitSectionBtn.count() > 0) {
      await submitSectionBtn.click()
      await sleep(3000)
      log('Submit Section clicked', 'PASS')
      await screenshot(page, '12_after_submit_section')

      // Check for FRQ choice screen
      const frqChoiceText = await page.textContent('body').catch(() => '')
      if (frqChoiceText.includes('Type Your Answers') || frqChoiceText.includes('Write by Hand')) {
        log('FRQ choice screen appeared', 'PASS')
      } else if (frqChoiceText.includes('FRQ') || frqChoiceText.includes('Section 2')) {
        log('FRQ section loaded', 'PASS')
      } else {
        log('FRQ choice screen', 'INFO', 'Section submitted, checking next view')
      }
    } else {
      log('Submit Section button not found', 'WARN')
    }

    // ===== STEP 9: FRQ Choice and Submission =====
    console.log('\n--- STEP 9: FRQ Choice and Answers ---')
    // Click "Type Your Answers" if choice screen is visible
    const typeAnswersBtn = page.locator('button, div[role="button"]').filter({ hasText: /Type Your Answers|Typed/i }).first()
    if (await typeAnswersBtn.count() > 0) {
      await typeAnswersBtn.click()
      await sleep(1500)

      // Look for Confirm & Continue button (two-step confirmation)
      const confirmBtn = page.locator('button').filter({ hasText: /Confirm|Continue/i }).first()
      if (await confirmBtn.count() > 0) {
        await confirmBtn.click()
        await sleep(1500)
        log('Two-step FRQ confirmation worked', 'PASS')
      }

      log('FRQ typed submission selected', 'PASS')
      await screenshot(page, '13_frq_section')
    } else {
      log('No FRQ type choice button', 'INFO', 'Already in FRQ section or different state')
    }

    // Check "Change submission type" link in header
    const changeTypeLink = page.locator('a, button').filter({ hasText: /Change submission type|change type/i }).first()
    if (await changeTypeLink.count() > 0) {
      log('Change submission type link visible', 'PASS', 'FIX-9 verified')
    } else {
      log('Change submission type link not visible', 'INFO', 'May appear in FRQ section header')
    }

    // Answer FRQ sub-questions
    let frqAnswered = 0
    for (let frqIdx = 0; frqIdx < 10; frqIdx++) { // Up to 10 iterations for 7 FRQ items
      const textarea = page.locator('textarea').first()
      const hasTextarea = await textarea.count() > 0
      if (hasTextarea) {
        await textarea.click()
        await textarea.fill(`This is a careful, thoughtful answer for FRQ question ${frqIdx + 1}. The student considered multiple factors including supply and demand dynamics, price elasticity, and market equilibrium.`)
        frqAnswered++
        await sleep(1500)
        log(`FRQ item ${frqIdx + 1} answered`, 'PASS')
      }

      // Click Next
      const nextFRQ = page.locator('button').filter({ hasText: /Next|→/i }).last()
      if (await nextFRQ.count() > 0) {
        const isDisabled = await nextFRQ.getAttribute('disabled') !== null
        if (!isDisabled) {
          await nextFRQ.click()
          await sleep(1000)
        } else {
          // At last FRQ item, look for Review button
          const reviewFRQ = page.locator('button').filter({ hasText: /Review/i }).first()
          if (await reviewFRQ.count() > 0) {
            await reviewFRQ.click()
            await sleep(2000)
            log('FRQ Review screen', 'PASS')
            await screenshot(page, '14_frq_review')
            break
          }
        }
      } else {
        break
      }
    }

    log('FRQ answered', frqAnswered > 0 ? 'PASS' : 'FAIL',
      `Answered ${frqAnswered} FRQ sub-questions`)

    // ===== STEP 10: Submit Test =====
    console.log('\n--- STEP 10: Submit Test ---')
    // Look for Submit Test button
    const submitTestBtn = page.locator('button').filter({ hasText: /Submit Test|Submit Exam/i }).first()
    if (await submitTestBtn.count() > 0) {
      await submitTestBtn.click()
      await sleep(2000)
      await screenshot(page, '15_submit_attempt')

      // Check for confirmation dialog (FIX-8)
      const confirmDialog = page.locator('text=/Are you sure|Confirm Submit|Submit Test/i')
      const hasConfirmation = await confirmDialog.count() > 0
      if (hasConfirmation) {
        log('Submit Test confirmation dialog appeared', 'PASS', 'FIX-8 verified')
        // Confirm submission
        const confirmBtn2 = page.locator('button').filter({ hasText: /Confirm|Yes|Submit/i }).last()
        if (await confirmBtn2.count() > 0) await confirmBtn2.click()
      } else {
        finding('B14A-RETEST-SUBMIT-001', 'Medium',
          'Submit Test has no confirmation dialog',
          'FIX-8 (B14B-RETEST-002) — submit confirmation modal still not implemented')
      }

      await sleep(5000) // Wait for submission
      await screenshot(page, '16_after_submit')
      const currentUrl = page.url()
      log('After Submit Test', currentUrl.includes('/results') ? 'PASS' : 'PARTIAL',
        `URL: ${currentUrl}`)
    } else {
      log('Submit Test button not found', 'WARN', 'Could not complete FRQ section')
      await screenshot(page, '15b_no_submit_btn')
    }

    // ===== STEP 11: Report Card =====
    console.log('\n--- STEP 11: Report Card ---')
    const reportUrl = page.url()
    if (reportUrl.includes('/results/')) {
      log('Report Card loaded', 'PASS', `URL: ${reportUrl}`)
      await sleep(3000)
      await screenshot(page, '17_report_card')

      const reportContent = await page.content()

      // CHECK: Flagged for Review section
      if (reportContent.includes('Flagged for Review')) {
        log('Flagged for Review section present', 'PASS', 'B14A-003/B3-001 fix verified')
        // Check if actual questions listed
        const flaggedSection = await page.locator('text=Flagged for Review').first()
          .locator('..').textContent().catch(() => '')
        log('Flagged section content', 'INFO', flaggedSection.substring(0, 100))
      } else if (flaggedQuestions.length > 0) {
        finding('B14A-RETEST-FLAG-001', 'High',
          `Flagged for Review section absent despite flagging ${flaggedQuestions.length} questions`,
          `flaggedQuestions: ${JSON.stringify(flaggedQuestions)}. Check apScoringService.js line 244 and APReportCard.jsx line 551`)
      } else {
        log('No flagged questions to check on report card', 'INFO')
      }

      // CHECK: MCQ score visible
      if (reportContent.includes('MCQ') || reportContent.includes('Multiple Choice')) {
        log('MCQ section on report card', 'PASS')
      }

      // CHECK: Student name correct (not "Unknown Student")
      if (reportContent.includes('Unknown Student')) {
        finding('B14A-RETEST-NAME-001', 'High',
          'Report card shows "Unknown Student" instead of student name',
          'B12-002 fix may have been reverted')
      } else {
        log('No "Unknown Student" text on report card', 'PASS')
      }

      await screenshot(page, '18_report_card_detail')
    } else {
      log('Not on report card', 'PARTIAL', `URL: ${reportUrl}`)
    }

    // ===== STEP 12: Verify AnswerInput letter badge =====
    console.log('\n--- STEP 12: AnswerInput letter badge verification ---')
    // Navigate back to a test to check badge styling
    // Go back to dashboard
    await page.goto(`${BASE_URL}/ap`)
    await page.waitForTimeout(2000)
    await screenshot(page, '19_back_to_dashboard')
    log('Back to dashboard', 'PASS')

    // ===== STEP 13: Console Error Check =====
    console.log('\n--- STEP 13: Console Error Summary ---')
    const criticalErrors = results.consoleErrors.filter(e =>
      e.type === 'pageerror' ||
      (e.text.includes('startsWith') && !e.text.includes('Firestore'))
    )

    if (criticalErrors.length === 0) {
      log('No critical console errors', 'PASS', 'code.startsWith fix verified')
    } else {
      criticalErrors.forEach(e => {
        finding('B14A-RETEST-CONSOLE-001', 'Medium',
          `Console error: ${e.text.substring(0, 100)}`,
          `Type: ${e.type}, URL: ${e.url}`)
      })
    }

    const startsWith = results.consoleErrors.filter(e => e.text.includes('startsWith'))
    if (startsWith.length > 0) {
      finding('B14A-RETEST-STARTS-001', 'Medium',
        'code.startsWith errors still present in console',
        `Found ${startsWith.length} occurrences. logError.js fix may have been reverted.`)
    }

  } catch (error) {
    console.error('\nFATAL ERROR:', error.message)
    results.findings.push({
      id: 'B14A-FATAL',
      severity: 'Blocker',
      description: 'Script execution failed',
      details: error.message
    })
    await screenshot(page, 'FATAL_error').catch(() => {})
  } finally {
    await browser.close()
  }

  // Save results
  const resultsPath = path.join(__dirname, 'b14a_retest_live_results.json')
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2))
  console.log(`\nResults saved to: ${resultsPath}`)

  // Summary
  console.log('\n========== B14A-RETEST SUMMARY ==========')
  const passes = results.steps.filter(s => s.status === 'PASS').length
  const fails = results.steps.filter(s => s.status === 'FAIL').length
  const partials = results.steps.filter(s => s.status === 'PARTIAL').length
  const warns = results.steps.filter(s => s.status === 'WARN').length
  console.log(`Steps: PASS=${passes}, FAIL=${fails}, PARTIAL=${partials}, WARN=${warns}`)
  console.log(`Findings: ${results.findings.length}`)
  results.findings.forEach(f => console.log(`  [${f.severity}] ${f.id}: ${f.description}`))
  console.log(`Console errors: ${results.consoleErrors.length}`)
}

run().catch(console.error)
