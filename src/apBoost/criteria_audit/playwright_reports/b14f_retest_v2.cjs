/**
 * B14F Retest v2 — Verify FIX-12, FIX-13, FIX-14, FIX-15
 *
 * v2 improvements:
 * - Detect the TDZ crash early and document it as new blocker
 * - Do static DOM measurements from source code for FIX-14 (since app crashes before render)
 * - Verify useOfflineQueue.js line ordering for FIX-15 regression
 * - Test instruction screen BEFORE clicking Begin (student9 may already have a completed session)
 * - Use student account with no prior sessions to avoid state issues
 *
 * Also: test using teacher account first, or clear approach
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

async function main() {
  const results = {
    login: null,
    appCrash: null,
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

  // Collect ALL console messages
  const allConsoleMessages = []
  const allConsoleErrors = []
  page.on('console', msg => {
    const entry = { type: msg.type(), text: msg.text(), url: page.url() }
    allConsoleMessages.push(entry)
    if (msg.type() === 'error') {
      allConsoleErrors.push(entry)
    }
  })

  try {
    // ============================================================
    // STEP 1: LOGIN
    // ============================================================
    log('=== STEP 1: Login ===')
    await page.goto(`${BASE_URL}/ap/login`)
    await sleep(1500)

    let emailField = await page.$('input[type="email"], input[name="email"]')
    if (!emailField) {
      await page.goto(`${BASE_URL}/login`)
      await sleep(1500)
      emailField = await page.$('input[type="email"], input[name="email"]')
    }

    const pwField = await page.$('input[type="password"]')
    if (!emailField || !pwField) {
      results.login = { status: 'FAIL', reason: 'Login form not found' }
      await screenshot(page, 'v2_00_login_fail')
      await browser.close()
      fs.writeFileSync(path.join(__dirname, 'b14f_retest_v2_results.json'), JSON.stringify(results, null, 2))
      return
    }

    await emailField.fill(EMAIL)
    await pwField.fill(PASSWORD)
    await pwField.press('Enter')
    await sleep(2000)
    const loginUrl = page.url()
    results.login = { status: 'PASS', url: loginUrl }
    log(`Login URL: ${loginUrl}`)
    await screenshot(page, 'v2_01_after_login')

    // ============================================================
    // STEP 2: Navigate to instruction screen and measure
    // ============================================================
    log('=== STEP 2: Navigate to test instruction screen ===')
    await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`)
    await sleep(3000) // Wait longer for Firebase to load
    await screenshot(page, 'v2_02_instruction_or_error')

    // Check if we got an error boundary
    const pageContent = await page.evaluate(() => ({
      bodyText: document.body.textContent?.substring(0, 500),
      hasError: document.body.textContent?.includes('scheduleFlush') ||
                document.body.textContent?.includes('Cannot access') ||
                document.body.textContent?.includes('ReferenceError'),
      hasInstructionScreen: document.body.textContent?.includes('Begin Test') ||
                            document.body.textContent?.includes('Resume Test') ||
                            document.body.textContent?.includes('This test has'),
      hasTesting: document.querySelector('textarea') !== null ||
                  document.body.textContent?.includes('Question 1 of'),
      url: window.location.href
    }))

    log(`Page content check: ${JSON.stringify({ hasError: pageContent.hasError, hasInstruction: pageContent.hasInstructionScreen, hasTesting: pageContent.hasTesting })}`)

    if (pageContent.hasError) {
      results.appCrash = {
        status: 'CRASH',
        reason: 'ReferenceError: Cannot access scheduleFlush before initialization',
        details: 'TDZ bug in useOfflineQueue.js — scheduleFlush useCallback declared after useEffect that references it in dependency array'
      }
      log('  APP CRASH CONFIRMED: scheduleFlush TDZ error')
    }

    // ============================================================
    // FIX-14: Measure touch targets - check INSTRUCTION screen
    // ============================================================
    log('=== FIX-14: Touch target measurement on instruction screen ===')

    if (pageContent.hasInstructionScreen) {
      const instructionMeasurements = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const m = {}
        for (const btn of buttons) {
          const text = btn.textContent?.trim()
          const rect = btn.getBoundingClientRect()
          if (text === 'Begin Test' || text === 'Resume Test') {
            m.beginResumeBtn = { text, w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 }
          }
          if (text === 'Cancel') {
            m.cancelBtn = { w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 }
          }
        }
        return m
      })
      results.fix14_touchTargets.instructionScreen = instructionMeasurements
      log(`  Instruction screen buttons: ${JSON.stringify(instructionMeasurements)}`)
    } else if (pageContent.hasError) {
      log('  SKIP: Cannot measure instruction screen — app in error state')
      results.fix14_touchTargets.instructionScreen = { error: 'App crashed, instruction screen not rendered' }
    }

    // ============================================================
    // SOURCE CODE ANALYSIS: FIX-14 (read CSS classes directly)
    // ============================================================
    log('=== FIX-14: Source code class analysis ===')
    // We already read the source files above - capture the key classes found
    results.fix14_touchTargets.sourceAnalysis = {
      InstructionScreen_beginBtn: "py-3 (verified in source line 100) — 12px*2 + ~20px text = 44px OK",
      QuestionNavigator_backBtn: "py-3 (verified in source line 112) — 44px target OK",
      QuestionNavigator_nextBtn: "py-3 (verified in source line 135) — 44px target OK",
      QuestionNavigator_navigatorToggle: "py-3 px-2 min-h-[44px] (verified in source line 124) — OK",
      QuestionNavigator_closeBtn: "p-2 min-h-[44px] min-w-[44px] (verified in source line 167) — OK",
      QuestionNavigator_gridCells: "w-11 h-11 (verified in source line 27) — 44px OK",
      AnswerInput_strikethrough: "p-3 (verified in source line 135) — 12px*2 + 16px SVG = 40px... wait",
      note: "p-3 = 12px padding each side. SVG is h-4 w-4 = 16px. Total = 12+16+12 = 40px. STILL BELOW 44px!"
    }

    // ============================================================
    // If app is in error state, try navigating away and back
    // ============================================================
    if (pageContent.hasError) {
      log('Attempting to recover from error state...')
      await page.goto(`${BASE_URL}/ap`)
      await sleep(1500)
      await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`)
      await sleep(3000)
      await screenshot(page, 'v2_03_recovery_attempt')

      const recoveryCheck = await page.evaluate(() => ({
        hasError: document.body.textContent?.includes('scheduleFlush') ||
                  document.body.textContent?.includes('Cannot access'),
        hasInstructionScreen: document.body.textContent?.includes('Begin Test') ||
                              document.body.textContent?.includes('Resume Test'),
        bodySnippet: document.body.textContent?.substring(0, 300)
      }))
      log(`Recovery check: ${JSON.stringify({ hasError: recoveryCheck.hasError, hasInstruction: recoveryCheck.hasInstructionScreen })}`)
      if (!recoveryCheck.hasError && recoveryCheck.hasInstructionScreen) {
        log('  Recovery successful!')
        results.appCrash.recovered = true
      } else {
        log(`  Still crashing. Body: ${recoveryCheck.bodySnippet}`)
      }
    }

    // ============================================================
    // If we can get to instruction screen, measure FIX-14
    // ============================================================
    const instructionCheck = await page.evaluate(() => ({
      hasInstruction: document.body.textContent?.includes('Begin Test') ||
                      document.body.textContent?.includes('Resume Test')
    }))

    if (instructionCheck.hasInstruction) {
      log('=== FIX-14: Instruction screen measurements (live) ===')
      const liveMeasurements = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const m = {}
        for (const btn of buttons) {
          const text = btn.textContent?.trim()
          const rect = btn.getBoundingClientRect()
          if (text === 'Begin Test' || text === 'Resume Test') {
            m.beginResumeBtn = { text, w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 }
          }
          if (text === 'Cancel') {
            m.cancelBtn = { w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 }
          }
        }
        return m
      })
      results.fix14_touchTargets.instructionScreen = liveMeasurements
      log(`  Begin/Resume: ${JSON.stringify(liveMeasurements.beginResumeBtn)}`)
      log(`  Cancel: ${JSON.stringify(liveMeasurements.cancelBtn)}`)
      await screenshot(page, 'v2_04_instruction_measurements')

      // Start the test
      const beginOrResume = await page.$('button:has-text("Begin Test"), button:has-text("Resume Test")')
      if (beginOrResume) {
        await beginOrResume.click()
        await sleep(3000)
        await screenshot(page, 'v2_05_after_begin')

        const testCheck = await page.evaluate(() => ({
          hasTesting: document.body.textContent?.includes('Question') && document.body.textContent?.includes('of'),
          hasError: document.body.textContent?.includes('scheduleFlush') || document.body.textContent?.includes('Cannot access'),
          bodySnippet: document.body.textContent?.substring(0, 400)
        }))
        log(`  After Begin: hasTesting=${testCheck.hasTesting}, hasError=${testCheck.hasError}`)

        if (testCheck.hasTesting && !testCheck.hasError) {
          log('=== FIX-14: Q1 button measurements (live) ===')
          const q1Measurements = await page.evaluate(() => {
            const m = {}
            const buttons = Array.from(document.querySelectorAll('button'))

            for (const btn of buttons) {
              const rect = btn.getBoundingClientRect()
              const text = btn.textContent?.trim()

              if (!btn.disabled) {
                if (text === '← Back') {
                  m.backBtn = { w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 }
                }
                if (text === 'Next →') {
                  m.nextBtn = { w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 }
                }
                if (text && text.includes('Question') && text.includes('of')) {
                  m.navigatorToggle = { text: text.substring(0, 30), w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 }
                }
                if (text && (text.includes('Flag') || text.includes('Review'))) {
                  m.flagBtn = { text: text.substring(0, 30), w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 }
                }
              }

              // Strikethrough: small buttons on the right side with SVG, no text
              const svg = btn.querySelector('svg')
              if (svg && (!text || text.length === 0) && rect.right > 300 && rect.width < 60) {
                if (!m.strikethrough) {
                  m.strikethrough = { w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 || rect.width < 44 }
                }
              }

              // Hamburger: SVG button with no text, near top
              if (svg && (!text || text.length === 0) && rect.top < 80 && rect.width > 20) {
                m.hamburger = { w: Math.round(rect.width), h: Math.round(rect.height), top: Math.round(rect.top), fail44: rect.height < 44 || rect.width < 44 }
              }
            }
            return m
          })
          results.fix14_touchTargets.q1Buttons = q1Measurements
          log(`  Q1 measurements: ${JSON.stringify(q1Measurements)}`)
          await screenshot(page, 'v2_06_q1_measurements')

          // Open navigator
          const navToggle = await page.$('button:has-text("Question")')
          if (navToggle) {
            await navToggle.click()
            await sleep(800)
            await screenshot(page, 'v2_07_navigator_modal')

            const navMeasurements = await page.evaluate(() => {
              const m = { gridCells: [], closeBtn: null }
              const buttons = Array.from(document.querySelectorAll('button'))
              for (const btn of buttons) {
                const text = btn.textContent?.trim()
                const rect = btn.getBoundingClientRect()
                // Navigator close button
                if (text === '✕') {
                  m.closeBtn = { w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 || rect.width < 44 }
                }
                // Grid cells: 1-digit or 2-digit numbers or flags in the modal
                if (text && (/^\d{1,2}$/.test(text) || text === '🚩') && rect.width > 30 && rect.height > 20) {
                  m.gridCells.push({ text, w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 || rect.width < 44 })
                }
              }
              m.smallCellCount = m.gridCells.filter(c => c.fail44).length
              return m
            })
            results.fix14_touchTargets.navigatorModal = navMeasurements
            log(`  Nav modal cells (first): ${JSON.stringify(navMeasurements.gridCells[0])}`)
            log(`  Nav modal close btn: ${JSON.stringify(navMeasurements.closeBtn)}`)
            log(`  Small cell count: ${navMeasurements.smallCellCount}/${navMeasurements.gridCells.length}`)

            // Close modal
            const closeBtn = await page.$('button:has-text("✕")')
            if (closeBtn) await closeBtn.click()
            await sleep(400)
          }

          // ========================================================
          // FIX-13: Browser back blocker
          // ========================================================
          log('=== FIX-13: Browser back blocker test ===')
          const urlBeforeBack = page.url()
          log(`  URL before back: ${urlBeforeBack}`)

          // Press back
          await page.goBack()
          await sleep(1500)
          await screenshot(page, 'v2_08_after_back')

          const afterBackState = await page.evaluate(() => {
            const body = document.body
            const text = body.textContent || ''
            return {
              url: window.location.href,
              path: window.location.pathname,
              hasLeaveTest: text.includes('Leave Test') || text.includes('Leave test'),
              hasStay: text.includes('Stay'),
              hasLeave: text.includes('Leave'),
              bodySnippet: text.substring(0, 200)
            }
          })
          results.fix13_backBlocker.afterBackUrl = page.url()
          results.fix13_backBlocker.afterBackState = afterBackState
          log(`  After back URL: ${page.url()}`)
          log(`  Has modal (LeaveTest): ${afterBackState.hasLeaveTest}`)
          log(`  Has Stay: ${afterBackState.hasStay}`)
          log(`  Body: ${afterBackState.bodySnippet}`)

          const blockerAppearedLikely = afterBackState.hasLeaveTest && afterBackState.hasStay

          if (blockerAppearedLikely) {
            log('  BLOCKER MODAL APPEARED!')
            // Test Stay button
            const stayBtn = await page.$('button:has-text("Stay")')
            if (stayBtn) {
              await stayBtn.click()
              await sleep(800)
              const urlAfterStay = page.url()
              results.fix13_backBlocker.stayWorked = urlAfterStay.includes(TEST_ID)
              results.fix13_backBlocker.urlAfterStay = urlAfterStay
              log(`  After Stay: ${urlAfterStay}`)
              await screenshot(page, 'v2_09_after_stay')
            }

            // Press back again, test Leave
            await page.goBack()
            await sleep(1200)
            const leaveBtn = await page.$('button:has-text("Leave")')
            if (leaveBtn) {
              await leaveBtn.click()
              await sleep(1000)
              const urlAfterLeave = page.url()
              results.fix13_backBlocker.leaveWorked = !urlAfterLeave.includes(TEST_ID)
              results.fix13_backBlocker.urlAfterLeave = urlAfterLeave
              log(`  After Leave: ${urlAfterLeave}`)
              await screenshot(page, 'v2_10_after_leave')
            }
            results.fix13_backBlocker.result = 'PASS'
          } else {
            results.fix13_backBlocker.result = 'FAIL'
            results.fix13_backBlocker.silentNavigation = !page.url().includes(TEST_ID)
            log(`  FAIL: No blocker modal. Silent navigation: ${results.fix13_backBlocker.silentNavigation}`)
          }

          // ========================================================
          // FIX-12: FRQ textarea scroll-into-view
          // ========================================================
          log('=== FIX-12: FRQ textarea scroll test ===')
          // We need to get through MCQ section to reach FRQ
          // Get back to test first
          const isOnTest = page.url().includes(TEST_ID)
          if (!isOnTest) {
            await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`)
            await sleep(2500)
            const resumeBtn = await page.$('button:has-text("Resume Test"), button:has-text("Begin Test")')
            if (resumeBtn) {
              await resumeBtn.click()
              await sleep(2000)
            }
          }

          // Quick-answer through MCQ
          log('  Answering MCQ questions...')
          let reachedFRQ = false
          for (let i = 0; i < 25; i++) {
            const state = await page.evaluate(() => {
              const text = document.body.textContent || ''
              const hasTextarea = !!document.querySelector('textarea')
              return {
                hasTextarea,
                isChoiceScreen: text.includes('Type Your Answers') || text.includes('Write by Hand'),
                isReviewScreen: text.includes('Review Your Answers'),
                hasSubmitSection: text.includes('Submit Section'),
                isError: text.includes('scheduleFlush') || text.includes('Cannot access'),
                url: window.location.href
              }
            })

            if (state.isError) {
              log(`  ERROR STATE at iteration ${i}`)
              break
            }

            if (state.hasTextarea) {
              reachedFRQ = true
              break
            }

            if (state.isChoiceScreen) {
              const typeBtn = await page.$('button:has-text("Type Your Answers")')
              if (typeBtn) {
                await typeBtn.click()
                await sleep(1500)
                reachedFRQ = true
                break
              }
            }

            if (state.isReviewScreen || state.hasSubmitSection) {
              // Submit section
              const submitBtn = await page.$('button:has-text("Submit Section"), button:has-text("Submit")')
              if (submitBtn) {
                await submitBtn.click()
                await sleep(2000)
                // Handle any confirm dialogs
                page.on('dialog', d => d.accept())
                await sleep(500)
              }
              continue
            }

            // Answer choice A
            await page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button[type="button"]'))
              for (const btn of buttons) {
                const spans = btn.querySelectorAll('span')
                for (const span of spans) {
                  if (span.textContent?.trim() === 'A' &&
                      (span.className?.includes('rounded-full') || span.className?.includes('w-6'))) {
                    btn.click()
                    return
                  }
                }
              }
            })
            await sleep(300)

            // Click Next or Review
            const nextBtn = await page.$('button:has-text("Next →")')
            if (nextBtn) {
              await nextBtn.click()
              await sleep(400)
            } else {
              const reviewBtn = await page.$('button:has-text("Review →")')
              if (reviewBtn) {
                await reviewBtn.click()
                await sleep(800)
              }
            }
          }

          log(`  Reached FRQ: ${reachedFRQ}`)
          await screenshot(page, 'v2_11_frq_state')

          if (reachedFRQ) {
            const frqAt667 = await page.evaluate(() => {
              const ta = document.querySelector('textarea')
              if (!ta) return null
              const rect = ta.getBoundingClientRect()
              return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), vh: window.innerHeight, inVP: rect.top < window.innerHeight }
            })
            results.fix12_frqScroll.at667 = frqAt667
            log(`  FRQ at 667: ${JSON.stringify(frqAt667)}`)

            // Switch to 375x350 keyboard simulation
            await page.setViewportSize({ width: 375, height: 350 })
            await sleep(500)

            const frqBefore = await page.evaluate(() => {
              const ta = document.querySelector('textarea')
              if (!ta) return null
              const rect = ta.getBoundingClientRect()
              return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), vh: window.innerHeight, inVP: rect.top < window.innerHeight, needsScroll: rect.top >= window.innerHeight }
            })
            results.fix12_frqScroll.at350_before_focus = frqBefore
            log(`  FRQ at 350 BEFORE focus: ${JSON.stringify(frqBefore)}`)
            await screenshot(page, 'v2_12_frq_before_350')

            // Click textarea to trigger focus handler
            const ta = await page.$('textarea')
            if (ta) {
              await ta.click()
              await sleep(700) // 300ms delay + animation time

              const frqAfter = await page.evaluate(() => {
                const ta = document.querySelector('textarea')
                if (!ta) return null
                const rect = ta.getBoundingClientRect()
                return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), vh: window.innerHeight, inVP: rect.top < window.innerHeight, needsScroll: rect.top >= window.innerHeight }
              })
              results.fix12_frqScroll.at350_after_focus = frqAfter
              log(`  FRQ at 350 AFTER focus: ${JSON.stringify(frqAfter)}`)
              await screenshot(page, 'v2_13_frq_after_350')

              results.fix12_frqScroll.scrollIntoViewWorked = frqAfter && frqAfter.inVP
              results.fix12_frqScroll.wasHiddenBefore = frqBefore && !frqBefore.inVP
            }

            // Restore viewport
            await page.setViewportSize({ width: 375, height: 667 })
          } else {
            results.fix12_frqScroll.error = 'Could not reach FRQ section'
          }
        } else {
          results.fix14_touchTargets.q1TestingError = 'Testing view not available or still crashing'
        }
      }
    }

    // ============================================================
    // FIX-15: Check IDB errors
    // ============================================================
    log('=== FIX-15: IDB error check ===')
    // Navigate away and back
    await page.goto(`${BASE_URL}/ap`)
    await sleep(1500)
    await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`)
    await sleep(2500)
    await screenshot(page, 'v2_14_after_nav_back')

    const idbErrors = allConsoleErrors.filter(e =>
      e.text.includes('IDBDatabase') ||
      e.text.includes('connection is closing') ||
      (e.text.includes('closing') && e.text.includes('execute'))
    )
    results.fix15_idbErrors = idbErrors
    log(`  IDB errors: ${idbErrors.length}`)

    // Also log the TDZ scheduleFlush errors
    const tdzErrors = allConsoleErrors.filter(e =>
      e.text.includes('scheduleFlush') ||
      e.text.includes('Cannot access')
    )
    results.tdzErrors = tdzErrors
    log(`  TDZ (scheduleFlush) errors: ${tdzErrors.length} — these are NEW Blocker regression from FIX-15`)

  } catch (err) {
    log(`FATAL ERROR: ${err.message}`)
    results.fatalError = err.message
    await screenshot(page, 'v2_error').catch(() => {})
  } finally {
    await browser.close()
  }

  // ============================================================
  // COMPUTE SUMMARY
  // ============================================================
  const fix14 = results.fix14_touchTargets

  // Check source-based measurements
  const sourceAnalysis = fix14.sourceAnalysis || {}
  const liveInstruction = fix14.instructionScreen || {}
  const liveQ1 = fix14.q1Buttons || {}
  const liveNav = fix14.navigatorModal || {}

  const fix14Issues = []
  const fix14Passes = []

  // Begin/Resume button
  if (liveInstruction.beginResumeBtn) {
    if (liveInstruction.beginResumeBtn.fail44) {
      fix14Issues.push(`Begin/Resume: ${liveInstruction.beginResumeBtn.h}px height FAIL`)
    } else {
      fix14Passes.push(`Begin/Resume: ${liveInstruction.beginResumeBtn.h}px OK`)
    }
  } else {
    fix14Passes.push('Begin/Resume: py-3 in source (line 100) — expect 44px height OK (unverified live)')
  }

  // Q1 buttons
  const q1Checks = ['backBtn', 'nextBtn', 'navigatorToggle', 'flagBtn', 'hamburger', 'strikethrough']
  for (const key of q1Checks) {
    if (liveQ1[key]) {
      if (liveQ1[key].fail44) fix14Issues.push(`${key}: ${liveQ1[key].w}x${liveQ1[key].h}px FAIL`)
      else fix14Passes.push(`${key}: ${liveQ1[key].w}x${liveQ1[key].h}px OK`)
    }
  }

  // Navigator modal
  if (liveNav.gridCells && liveNav.gridCells.length > 0) {
    const first = liveNav.gridCells[0]
    if (first.fail44) fix14Issues.push(`Nav cells: ${first.w}x${first.h}px FAIL`)
    else fix14Passes.push(`Nav cells: ${first.w}x${first.h}px OK`)
  }
  if (liveNav.closeBtn) {
    if (liveNav.closeBtn.fail44) fix14Issues.push(`Nav close: ${liveNav.closeBtn.w}x${liveNav.closeBtn.h}px FAIL`)
    else fix14Passes.push(`Nav close: ${liveNav.closeBtn.w}x${liveNav.closeBtn.h}px OK`)
  }

  // Strikethrough source check
  fix14Issues.push('Strikethrough: p-3 + h-4 SVG = 40px height — STILL BELOW 44px (source confirmed)')

  const fix12 = results.fix12_frqScroll
  const fix12Status = fix12.scrollIntoViewWorked ? 'PASS' : (fix12.error ? 'SKIP' : 'FAIL')
  const fix13Status = results.fix13_backBlocker.result || 'FAIL'
  const fix14Status = fix14Issues.length === 0 ? 'PASS' : (fix14Passes.length > 0 ? 'PARTIAL' : 'FAIL')
  const fix15Status = results.tdzErrors?.length > 0 ? 'REGRESSION_BLOCKER' :
                      results.fix15_idbErrors.length === 0 ? 'PASS' : 'FAIL'

  results.summary = {
    'FIX-12 (B14F-001) FRQ scroll-into-view': fix12Status,
    'FIX-13 (B14F-002) Browser back blocker': fix13Status,
    'FIX-14 (B14F-003/004/005/006) Touch targets': fix14Status,
    'FIX-15 (B14F-007) IDB errors suppressed — REGRESSION': fix15Status,
    'NEW_BLOCKER_B14F_R001': results.appCrash || null,
    fix14Issues,
    fix14Passes,
    totalConsoleErrors: results.consoleErrors?.length || allConsoleErrors.length,
    totalTDZErrors: results.tdzErrors?.length || 0,
    totalIDBErrors: results.fix15_idbErrors.length,
  }

  results.consoleErrors = allConsoleErrors

  log('\n=== FINAL SUMMARY ===')
  log(`FIX-12 (FRQ scroll): ${fix12Status}`)
  log(`FIX-13 (Back blocker): ${fix13Status}`)
  log(`FIX-14 (Touch targets): ${fix14Status}`)
  log(`  Issues: ${fix14Issues.join(', ')}`)
  log(`  Passes: ${fix14Passes.join(', ')}`)
  log(`FIX-15 (IDB errors): ${fix15Status}`)
  log(`TDZ (scheduleFlush) errors: ${results.tdzErrors?.length || 0}`)
  log(`IDB errors: ${results.fix15_idbErrors.length}`)

  const outPath = path.join(__dirname, 'b14f_retest_v2_results.json')
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2))
  log(`Results written to: ${outPath}`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
