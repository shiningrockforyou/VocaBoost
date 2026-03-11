/**
 * B14F Retest — Verify FIX-12, FIX-13, FIX-14, FIX-15
 *
 * Tests:
 *   FIX-12 (B14F-001): FRQ textarea scrollIntoView on focus at 375x350
 *   FIX-13 (B14F-002): useBlocker shows confirmation modal on browser back
 *   FIX-14 (B14F-003/004/005/006): Touch targets >= 44px
 *   FIX-15 (B14F-007): IDBDatabase "closing" errors suppressed
 *
 * Student: student9@apboost.test / Student123!
 * Test: test_micro_full_1
 */

const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const BASE_URL = 'http://localhost:5173'
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots_B14F_retest')
const TEST_ID = 'test_micro_full_1'
const EMAIL = 'student9@apboost.test'
const PASSWORD = 'Student123!'

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

const log = (msg) => {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19)
  console.log(`[${ts}] ${msg}`)
}

async function screenshot(page, name) {
  const fp = path.join(SCREENSHOT_DIR, `${name}.png`)
  await page.screenshot({ path: fp, fullPage: false })
  log(`  Screenshot saved: ${name}.png`)
  return fp
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function getConsoleErrors(page) {
  // Returns the accumulated console errors
  return page._consoleErrors || []
}

async function main() {
  const results = {
    login: null,
    fix14_touchTargets: {},
    fix13_backBlocker: {},
    fix12_frqScroll: {},
    fix15_idbErrors: [],
    consoleErrors: [],
    summary: {}
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }
  })
  const page = await context.newPage()

  // Collect console errors throughout the session
  const allConsoleErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error' || (msg.type() === 'log' && msg.text().toLowerCase().includes('error'))) {
      allConsoleErrors.push({ type: msg.type(), text: msg.text(), url: page.url() })
    }
  })

  try {
    // ============================================================
    // STEP 1: LOGIN
    // ============================================================
    log('=== STEP 1: Login ===')
    await page.goto(`${BASE_URL}/ap/login`)
    await sleep(1500)

    // Try to find login form
    const emailInput = await page.$('input[type="email"], input[name="email"]')
    if (!emailInput) {
      // Try /login
      await page.goto(`${BASE_URL}/login`)
      await sleep(1500)
    }

    const emailField = await page.$('input[type="email"], input[name="email"]')
    const pwField = await page.$('input[type="password"]')

    if (!emailField || !pwField) {
      results.login = { status: 'FAIL', reason: 'Login form not found at /ap/login or /login' }
      await screenshot(page, '00_login_not_found')
      await browser.close()
      fs.writeFileSync(
        path.join(__dirname, 'b14f_retest_results.json'),
        JSON.stringify(results, null, 2)
      )
      return
    }

    await emailField.fill(EMAIL)
    await pwField.fill(PASSWORD)
    await pwField.press('Enter')
    await sleep(2000)

    const currentUrl = page.url()
    results.login = { status: 'PASS', url: currentUrl }
    log(`Login URL: ${currentUrl}`)
    await screenshot(page, '01_after_login')

    // Navigate to AP dashboard if not already there
    if (!currentUrl.includes('/ap')) {
      await page.goto(`${BASE_URL}/ap`)
      await sleep(1500)
    }
    await screenshot(page, '02_dashboard')

    // ============================================================
    // STEP 2: Navigate to instruction screen
    // ============================================================
    log('=== STEP 2: Navigate to Micro test instruction screen ===')
    await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`)
    await sleep(2000)
    await screenshot(page, '03_instruction_screen')

    // ============================================================
    // FIX-14 RETEST: Touch targets
    // ============================================================
    log('=== FIX-14 RETEST: Measure touch targets ===')

    // Measure Begin/Resume button
    const beginBtnSize = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      for (const btn of buttons) {
        const text = btn.textContent?.trim()
        if (text === 'Begin Test' || text === 'Resume Test') {
          const rect = btn.getBoundingClientRect()
          return { text, w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 }
        }
      }
      return null
    })
    results.fix14_touchTargets.beginResumeBtn = beginBtnSize
    log(`  Begin/Resume button: ${JSON.stringify(beginBtnSize)}`)

    // Cancel button
    const cancelBtnSize = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      for (const btn of buttons) {
        if (btn.textContent?.trim() === 'Cancel') {
          const rect = btn.getBoundingClientRect()
          return { w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 }
        }
      }
      return null
    })
    results.fix14_touchTargets.cancelBtn = cancelBtnSize
    log(`  Cancel button: ${JSON.stringify(cancelBtnSize)}`)

    // Start the test
    log('Starting test...')
    const beginBtn = await page.$('button:has-text("Begin Test"), button:has-text("Resume Test")')
    if (beginBtn) {
      await beginBtn.click()
      await sleep(2500)
    }
    await screenshot(page, '04_q1_testing')

    // Measure toolbar buttons on Q1
    const q1Measurements = await page.evaluate(() => {
      const measurements = {}

      // Hamburger menu button
      const allButtons = Array.from(document.querySelectorAll('button'))

      // Look for hamburger (3 horizontal lines SVG)
      for (const btn of allButtons) {
        const svg = btn.querySelector('svg')
        if (svg) {
          // Check for hamburger-like SVG (no text, in header area, w-8 h-8 or similar)
          const btnText = btn.textContent?.trim()
          if (!btnText || btnText.length === 0) {
            const rect = btn.getBoundingClientRect()
            if (rect.top < 100 && rect.width > 20 && rect.width < 80) {
              measurements.hamburger = {
                w: Math.round(rect.width), h: Math.round(rect.height),
                top: Math.round(rect.top), fail44: rect.height < 44 || rect.width < 44
              }
              break
            }
          }
        }
      }

      // Back button
      for (const btn of allButtons) {
        if (btn.textContent?.trim() === '← Back') {
          const rect = btn.getBoundingClientRect()
          measurements.backBtn = { w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 }
          break
        }
      }

      // Next button
      for (const btn of allButtons) {
        if (btn.textContent?.trim() === 'Next →') {
          const rect = btn.getBoundingClientRect()
          measurements.nextBtn = { w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 }
          break
        }
      }

      // Navigator toggle
      for (const btn of allButtons) {
        const text = btn.textContent?.trim()
        if (text && text.includes('Question') && text.includes('of')) {
          const rect = btn.getBoundingClientRect()
          measurements.navigatorToggle = {
            text: text.substring(0, 30),
            w: Math.round(rect.width), h: Math.round(rect.height),
            fail44: rect.height < 44
          }
          break
        }
      }

      // Flag button
      for (const btn of allButtons) {
        const text = btn.textContent?.trim()
        if (text && (text.includes('Flag') || text.includes('Flagged'))) {
          const rect = btn.getBoundingClientRect()
          measurements.flagBtn = { text: text.substring(0, 30), w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 }
          break
        }
      }

      // Strikethrough button (small X button next to answer choices)
      for (const btn of allButtons) {
        const svg = btn.querySelector('svg')
        const rect = btn.getBoundingClientRect()
        // Strikethrough buttons are small, near the right side
        if (svg && rect.width < 60 && rect.height < 60 && rect.right > 300) {
          measurements.strikethrough = { w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 || rect.width < 44 }
          break
        }
      }

      return measurements
    })
    results.fix14_touchTargets.q1Buttons = q1Measurements
    log(`  Q1 button measurements: ${JSON.stringify(q1Measurements)}`)
    await screenshot(page, '05_q1_buttons')

    // Open navigator modal
    log('Opening navigator modal...')
    const navToggle = await page.$('button:has-text("Question")')
    if (navToggle) {
      await navToggle.click()
      await sleep(800)
      await screenshot(page, '06_navigator_modal')

      // Measure navigator grid cells and close button
      const navModalMeasurements = await page.evaluate(() => {
        const results = {}
        const allButtons = Array.from(document.querySelectorAll('button'))

        // Find grid cells (small numbered buttons in navigator)
        const cells = []
        for (const btn of allButtons) {
          const text = btn.textContent?.trim()
          // Navigator cells: numbers 1-15 or flags
          if (text && (text === '🚩' || (/^\d{1,2}$/.test(text) && parseInt(text) <= 20))) {
            const rect = btn.getBoundingClientRect()
            if (rect.width > 30 && rect.height > 20) {
              cells.push({ text, w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 || rect.width < 44 })
            }
          }
        }
        results.gridCells = cells
        results.smallCellCount = cells.filter(c => c.fail44).length

        // Close button (✕)
        for (const btn of allButtons) {
          if (btn.textContent?.trim() === '✕') {
            const rect = btn.getBoundingClientRect()
            results.closeBtn = { w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 || rect.width < 44 }
            break
          }
        }

        return results
      })
      results.fix14_touchTargets.navigatorModal = navModalMeasurements
      log(`  Navigator modal: closedBtn=${JSON.stringify(navModalMeasurements.closeBtn)}, smallCells=${navModalMeasurements.smallCellCount}/${navModalMeasurements.gridCells?.length}`)

      // Close the navigator
      const closeBtn = await page.$('button:has-text("✕")')
      if (closeBtn) {
        await closeBtn.click()
        await sleep(500)
      } else {
        // Click backdrop
        await page.keyboard.press('Escape')
        await sleep(500)
      }
    }

    // ============================================================
    // FIX-13 RETEST: Browser back blocker
    // ============================================================
    log('=== FIX-13 RETEST: Browser back blocker ===')

    // Verify we are on the test page with status IN_PROGRESS
    const currentTestUrl = page.url()
    log(`Current URL before back: ${currentTestUrl}`)

    // Try pressing browser back
    await page.goBack()
    await sleep(1200)

    const afterBackUrl = page.url()
    const afterBackScreenshot = await screenshot(page, '07_after_back')

    // Check if a modal/blocker appeared
    const blockerState = await page.evaluate(() => {
      // Look for modal content that indicates the blocker triggered
      const allElements = Array.from(document.querySelectorAll('*'))
      let foundLeaveTest = false
      let foundStay = false
      let foundLeaveBtn = false

      for (const el of allElements) {
        const text = el.textContent?.trim()
        if (text === 'Leave Test?' || text === 'Leave test?' || text === 'Leave Test' || text === 'Exit Test') {
          foundLeaveTest = true
        }
        if (text === 'Stay' || text === 'Stay on Test') {
          foundStay = true
        }
        if (text === 'Leave Test' || text === 'Leave') {
          foundLeaveBtn = true
        }
      }

      return {
        currentUrl: window.location.href,
        urlAfterBack: window.location.pathname,
        foundLeaveTest,
        foundStay,
        foundLeaveBtn,
        blockerAppearedLikely: foundLeaveTest && foundStay
      }
    })

    results.fix13_backBlocker.afterBackUrl = afterBackUrl
    results.fix13_backBlocker.blockerState = blockerState
    log(`  After back URL: ${afterBackUrl}`)
    log(`  Blocker appeared: ${blockerState.blockerAppearedLikely}`)
    log(`  Found 'Leave Test?': ${blockerState.foundLeaveTest}, 'Stay': ${blockerState.foundStay}`)

    // If modal appeared, test "Stay" button
    if (blockerState.blockerAppearedLikely) {
      const stayBtn = await page.$('button:has-text("Stay")')
      if (stayBtn) {
        await stayBtn.click()
        await sleep(800)
        const urlAfterStay = page.url()
        results.fix13_backBlocker.urlAfterStay = urlAfterStay
        results.fix13_backBlocker.stayWorked = urlAfterStay.includes(TEST_ID)
        log(`  After Stay click URL: ${urlAfterStay}`)
        await screenshot(page, '08_after_stay')
      }

      // Now test "Leave" (press back again)
      await page.goBack()
      await sleep(1200)
      const leaveModal = await page.$('button:has-text("Leave")')
      if (leaveModal) {
        await leaveModal.click()
        await sleep(1000)
        const urlAfterLeave = page.url()
        results.fix13_backBlocker.urlAfterLeave = urlAfterLeave
        results.fix13_backBlocker.leaveWorked = !urlAfterLeave.includes(TEST_ID)
        log(`  After Leave click URL: ${urlAfterLeave}`)
        await screenshot(page, '09_after_leave')
      }
    } else {
      // No blocker appeared - check if we navigated away silently
      results.fix13_backBlocker.silentNavigation = !afterBackUrl.includes(TEST_ID)
      log(`  WARNING: No blocker modal appeared! Silent navigation: ${results.fix13_backBlocker.silentNavigation}`)
    }

    // ============================================================
    // FIX-12 RETEST: FRQ textarea scroll-into-view
    // ============================================================
    log('=== FIX-12 RETEST: FRQ textarea scroll-into-view ===')

    // Navigate back to the test, go through MCQ section, then get to FRQ
    const isOnTest = page.url().includes(TEST_ID)
    if (!isOnTest) {
      await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`)
      await sleep(2000)
      // Resume test
      const resumeBtn = await page.$('button:has-text("Resume Test"), button:has-text("Begin Test")')
      if (resumeBtn) {
        await resumeBtn.click()
        await sleep(2000)
      }
    }

    // Answer all MCQ questions quickly
    log('Answering MCQ questions to get to FRQ section...')
    let reachedFRQ = false
    for (let i = 0; i < 20; i++) {
      const currentContent = await page.evaluate(() => {
        const body = document.body.textContent
        const isFRQ = body.includes('Type your response') || body.includes('FRQ') ||
                      document.querySelector('textarea') !== null
        const isReview = body.includes('Review Your Answers') || body.includes('review')
        const isSectionSubmit = body.includes('Submit Section') || body.includes('submit')
        const isChoiceScreen = body.includes('Type Your Answers') || body.includes('Write by Hand')
        return { isFRQ, isReview, isSectionSubmit, isChoiceScreen, url: window.location.href }
      })

      if (currentContent.isFRQ && document.querySelector) {
        // Check if textarea is visible
        const hasTa = await page.$('textarea')
        if (hasTa) {
          reachedFRQ = true
          break
        }
      }

      if (currentContent.isChoiceScreen) {
        // Click "Type Your Answers"
        const typeBtn = await page.$('button:has-text("Type Your Answers")')
        if (typeBtn) {
          await typeBtn.click()
          await sleep(1500)
          reachedFRQ = true
          break
        }
      }

      if (currentContent.isReview) {
        // Submit section
        const submitSectionBtn = await page.$('button:has-text("Submit Section 1")')
        if (submitSectionBtn) {
          await submitSectionBtn.click()
          await sleep(1500)
        } else {
          const anySubmitBtn = await page.$('button:has-text("Submit")')
          if (anySubmitBtn) {
            await anySubmitBtn.click()
            await sleep(1500)
          }
        }
        continue
      }

      // Try to answer current question
      const answered = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button[type="button"]'))
        for (const btn of buttons) {
          const spans = btn.querySelectorAll('span')
          for (const span of spans) {
            if (span.textContent?.trim() === 'A' &&
                (span.className?.includes('rounded-full') || span.className?.includes('w-6'))) {
              btn.click()
              return true
            }
          }
        }
        return false
      })

      await sleep(300)

      // Click Next or Review
      const nextBtn = await page.$('button:has-text("Next →")')
      if (nextBtn) {
        await nextBtn.click()
        await sleep(500)
      } else {
        const reviewBtn = await page.$('button:has-text("Review →")')
        if (reviewBtn) {
          await reviewBtn.click()
          await sleep(1000)
        }
      }
    }

    log(`  Reached FRQ section: ${reachedFRQ}`)

    // Wait for FRQ view
    await sleep(1500)
    const hasFRQTextarea = await page.$('textarea')

    if (hasFRQTextarea) {
      await screenshot(page, '10_frq_at_667')
      log('  FRQ textarea found at 375x667')

      // Measure position at 667 height
      const frqAt667 = await page.evaluate(() => {
        const ta = document.querySelector('textarea')
        if (!ta) return null
        const rect = ta.getBoundingClientRect()
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          vh: window.innerHeight,
          inVP: rect.top < window.innerHeight && rect.bottom > 0
        }
      })
      results.fix12_frqScroll.at667 = frqAt667
      log(`  FRQ at 667: ${JSON.stringify(frqAt667)}`)

      // Resize to 375x350 (keyboard open simulation)
      await page.setViewportSize({ width: 375, height: 350 })
      await sleep(500)

      const frqBefore350 = await page.evaluate(() => {
        const ta = document.querySelector('textarea')
        if (!ta) return null
        const rect = ta.getBoundingClientRect()
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          vh: window.innerHeight,
          inVP: rect.top < window.innerHeight && rect.bottom > 0,
          needsScroll: rect.top >= window.innerHeight
        }
      })
      results.fix12_frqScroll.before350Focus = frqBefore350
      log(`  FRQ BEFORE focus at 350: ${JSON.stringify(frqBefore350)}`)
      await screenshot(page, '11_frq_before_focus_350')

      // Click/focus the textarea to trigger scrollIntoView
      await hasFRQTextarea.click()
      await sleep(700) // Wait for 300ms delay + animation

      const frqAfter350 = await page.evaluate(() => {
        const ta = document.querySelector('textarea')
        if (!ta) return null
        const rect = ta.getBoundingClientRect()
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          vh: window.innerHeight,
          inVP: rect.top < window.innerHeight && rect.bottom > 0,
          needsScroll: rect.top >= window.innerHeight
        }
      })
      results.fix12_frqScroll.after350Focus = frqAfter350
      log(`  FRQ AFTER focus at 350: ${JSON.stringify(frqAfter350)}`)
      await screenshot(page, '12_frq_after_focus_350')

      // Determine if the scroll-into-view worked
      const scrollWorked = frqAfter350 && frqAfter350.inVP && !frqAfter350.needsScroll
      results.fix12_frqScroll.scrollIntoViewWorked = scrollWorked
      log(`  FIX-12 SCROLL WORKED: ${scrollWorked}`)

      // Restore viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await sleep(300)
    } else {
      log('  WARNING: No textarea found for FRQ test')
      results.fix12_frqScroll.error = 'No textarea found — could not reach FRQ section'
      await screenshot(page, '10_no_frq_textarea')
    }

    // ============================================================
    // FIX-15 RETEST: IDB errors after navigation
    // ============================================================
    log('=== FIX-15 RETEST: IDB errors after navigation ===')

    // Navigate away from test and back
    await page.goto(`${BASE_URL}/ap`)
    await sleep(1500)
    log('  Navigated away from test to /ap')
    await screenshot(page, '13_after_nav_away')

    // Now go back to the test
    await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`)
    await sleep(2000)
    log('  Navigated back to test')
    await screenshot(page, '14_after_nav_back')

    // Check for IDBDatabase errors in accumulated console errors
    const idbErrors = allConsoleErrors.filter(e =>
      e.text.includes('IDBDatabase') ||
      e.text.includes('connection is closing') ||
      e.text.includes('Failed to execute') && e.text.includes('IDB')
    )
    results.fix15_idbErrors = idbErrors
    results.consoleErrors = allConsoleErrors
    log(`  IDB errors found: ${idbErrors.length}`)
    if (idbErrors.length > 0) {
      log(`  IDB error messages: ${idbErrors.map(e => e.text.substring(0, 100)).join('; ')}`)
    }

    // Wait a bit more and check again for any delayed IDB errors
    await sleep(2000)
    const idbErrorsFinal = allConsoleErrors.filter(e =>
      e.text.includes('IDBDatabase') ||
      e.text.includes('connection is closing') ||
      e.text.includes('closing')
    )
    results.fix15_idbErrors = idbErrorsFinal
    log(`  Final IDB error count: ${idbErrorsFinal.length}`)

    await screenshot(page, '15_final_state')

  } catch (err) {
    log(`ERROR: ${err.message}`)
    results.error = err.message
    await screenshot(page, 'error_state').catch(() => {})
  } finally {
    await browser.close()
  }

  // ============================================================
  // COMPUTE SUMMARY
  // ============================================================
  const fix14 = results.fix14_touchTargets
  const q1 = fix14.q1Buttons || {}
  const navModal = fix14.navigatorModal || {}

  const fix14Failures = []
  const fix14Passes = []

  if (fix14.beginResumeBtn) {
    if (fix14.beginResumeBtn.fail44) fix14Failures.push(`Begin/Resume btn: ${fix14.beginResumeBtn.h}px`)
    else fix14Passes.push(`Begin/Resume btn: ${fix14.beginResumeBtn.h}px OK`)
  }
  if (q1.hamburger) {
    if (q1.hamburger.fail44) fix14Failures.push(`Hamburger: ${q1.hamburger.w}x${q1.hamburger.h}`)
    else fix14Passes.push(`Hamburger: ${q1.hamburger.w}x${q1.hamburger.h} OK`)
  }
  if (q1.flagBtn) {
    if (q1.flagBtn.fail44) fix14Failures.push(`Flag btn: ${q1.flagBtn.h}px`)
    else fix14Passes.push(`Flag btn: ${q1.flagBtn.h}px OK`)
  }
  if (q1.backBtn) {
    if (q1.backBtn.fail44) fix14Failures.push(`Back btn: ${q1.backBtn.h}px`)
    else fix14Passes.push(`Back btn: ${q1.backBtn.h}px OK`)
  }
  if (q1.nextBtn) {
    if (q1.nextBtn.fail44) fix14Failures.push(`Next btn: ${q1.nextBtn.h}px`)
    else fix14Passes.push(`Next btn: ${q1.nextBtn.h}px OK`)
  }
  if (q1.navigatorToggle) {
    if (q1.navigatorToggle.fail44) fix14Failures.push(`Navigator toggle: ${q1.navigatorToggle.h}px`)
    else fix14Passes.push(`Navigator toggle: ${q1.navigatorToggle.h}px OK`)
  }
  if (q1.strikethrough) {
    if (q1.strikethrough.fail44) fix14Failures.push(`Strikethrough: ${q1.strikethrough.w}x${q1.strikethrough.h}`)
    else fix14Passes.push(`Strikethrough: ${q1.strikethrough.w}x${q1.strikethrough.h} OK`)
  }
  if (navModal.gridCells && navModal.gridCells.length > 0) {
    const firstCell = navModal.gridCells[0]
    if (firstCell.fail44) fix14Failures.push(`Nav cells: ${firstCell.w}x${firstCell.h}`)
    else fix14Passes.push(`Nav cells: ${firstCell.w}x${firstCell.h} OK`)
  }
  if (navModal.closeBtn) {
    if (navModal.closeBtn.fail44) fix14Failures.push(`Close btn: ${navModal.closeBtn.w}x${navModal.closeBtn.h}`)
    else fix14Passes.push(`Close btn: ${navModal.closeBtn.w}x${navModal.closeBtn.h} OK`)
  }

  const fix13Status = results.fix13_backBlocker.blockerState?.blockerAppearedLikely ? 'PASS' : 'FAIL'
  const fix12Status = results.fix12_frqScroll.scrollIntoViewWorked ? 'PASS' :
                      results.fix12_frqScroll.error ? 'SKIP' : 'FAIL'
  const fix15Status = results.fix15_idbErrors.length === 0 ? 'PASS' : 'FAIL'
  const fix14Status = fix14Failures.length === 0 ? 'PASS' :
                      fix14Passes.length > 0 ? 'PARTIAL' : 'FAIL'

  results.summary = {
    'FIX-12 (B14F-001) FRQ scroll-into-view': fix12Status,
    'FIX-13 (B14F-002) Browser back blocker': fix13Status,
    'FIX-14 (B14F-003/004/005/006) Touch targets': fix14Status,
    'FIX-15 (B14F-007) IDB errors suppressed': fix15Status,
    fix14Failures,
    fix14Passes,
  }

  log('\n=== SUMMARY ===')
  log(`FIX-12 (FRQ scroll): ${fix12Status}`)
  log(`FIX-13 (Back blocker): ${fix13Status}`)
  log(`FIX-14 (Touch targets): ${fix14Status}`)
  log(`  Passes: ${fix14Passes.join(', ')}`)
  log(`  Failures: ${fix14Failures.join(', ')}`)
  log(`FIX-15 (IDB errors): ${fix15Status} (${results.fix15_idbErrors.length} errors)`)
  log(`Total console errors: ${allConsoleErrors.length}`)

  const outPath = path.join(__dirname, 'b14f_retest_results.json')
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2))
  log(`\nResults written to: ${outPath}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
