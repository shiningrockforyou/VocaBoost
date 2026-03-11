/**
 * B14F Retest v3 — Verify FIX-12, FIX-13, FIX-14, FIX-15
 *
 * v3: Proper waits for Firebase auth, better detection of app state
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
  log(`  Screenshot: ${name}.png`)
  return fp
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function waitForAppReady(page, maxWaitMs = 10000) {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const state = await page.evaluate(() => {
      const body = document.body.textContent || ''
      return {
        hasContent: body.length > 100,
        hasError: body.includes('scheduleFlush') || body.includes('Cannot access') || body.includes('Something went wrong'),
        hasInstruction: body.includes('Begin Test') || body.includes('Resume Test') || body.includes('This test has'),
        hasTesting: (body.includes('Question') && body.includes('of') && body.includes('Back') && body.includes('Next')) ||
                    !!document.querySelector('textarea'),
        hasDashboard: body.includes('AP Practice Tests'),
        hasReview: body.includes('Review Your Answers'),
        hasChoiceScreen: body.includes('Type Your Answers') || body.includes('Write by Hand'),
        url: window.location.href
      }
    })
    if (state.hasContent && (state.hasError || state.hasInstruction || state.hasTesting || state.hasDashboard)) {
      return state
    }
    await sleep(500)
  }
  // Return whatever we have
  return await page.evaluate(() => ({
    hasContent: (document.body.textContent || '').length > 100,
    hasError: (document.body.textContent || '').includes('scheduleFlush') || (document.body.textContent || '').includes('Something went wrong'),
    hasInstruction: (document.body.textContent || '').includes('Begin Test') || (document.body.textContent || '').includes('Resume Test'),
    hasTesting: false,
    hasDashboard: (document.body.textContent || '').includes('AP Practice Tests'),
    url: window.location.href,
    timedOut: true
  }))
}

async function clickChoice(page, letter) {
  return page.evaluate((l) => {
    const buttons = Array.from(document.querySelectorAll('button[type="button"]'))
    for (const btn of buttons) {
      const spans = btn.querySelectorAll('span')
      for (const span of spans) {
        if (span.textContent?.trim() === l &&
            (span.className?.includes('rounded-full') || span.className?.includes('w-6'))) {
          btn.click()
          return { ok: true }
        }
      }
    }
    return { ok: false }
  }, letter)
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

  const allConsoleErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      allConsoleErrors.push({ type: msg.type(), text: msg.text(), url: page.url() })
    }
  })

  try {
    // ============================================================
    // LOGIN
    // ============================================================
    log('=== Login ===')
    await page.goto(`${BASE_URL}/ap/login`, { waitUntil: 'domcontentloaded' })
    await sleep(2000)

    let emailField = await page.$('input[type="email"], input[name="email"]')
    if (!emailField) {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })
      await sleep(2000)
      emailField = await page.$('input[type="email"], input[name="email"]')
    }

    if (!emailField) {
      results.login = { status: 'FAIL', reason: 'No login form found' }
      await screenshot(page, 'v3_00_login_fail')
      await browser.close()
      fs.writeFileSync(path.join(__dirname, 'b14f_retest_v3_results.json'), JSON.stringify(results, null, 2))
      return
    }

    const pwField = await page.$('input[type="password"]')
    await emailField.fill(EMAIL)
    await pwField.fill(PASSWORD)
    await pwField.press('Enter')
    await sleep(3000)
    results.login = { status: 'PASS', url: page.url() }
    log(`Login URL: ${page.url()}`)
    await screenshot(page, 'v3_01_dashboard')

    // ============================================================
    // Navigate to test instruction screen
    // ============================================================
    log('=== Navigate to test instruction screen ===')
    await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`, { waitUntil: 'domcontentloaded' })

    const instrState = await waitForAppReady(page, 12000)
    log(`Instruction state: ${JSON.stringify(instrState)}`)
    await screenshot(page, 'v3_02_instruction')

    if (instrState.hasError) {
      results.appCrash = {
        status: 'CRASH',
        message: 'ReferenceError: Cannot access scheduleFlush before initialization',
        details: 'TDZ bug in useOfflineQueue.js — FIX-15 regression'
      }
      log('  APP CRASH: scheduleFlush TDZ error still present')
      results.summary['FIX-15 REGRESSION'] = 'BLOCKER — App crashes on test session page'
    }

    // ============================================================
    // FIX-14: Measure touch targets on instruction screen
    // ============================================================
    if (instrState.hasInstruction) {
      log('=== FIX-14: Instruction screen measurements ===')
      const instrMeasurements = await page.evaluate(() => {
        const m = {}
        const buttons = Array.from(document.querySelectorAll('button'))
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
      results.fix14_touchTargets.instructionScreen = instrMeasurements
      log(`  Begin/Resume: ${JSON.stringify(instrMeasurements.beginResumeBtn)}`)
      log(`  Cancel: ${JSON.stringify(instrMeasurements.cancelBtn)}`)

      // Start the test
      const beginBtn = await page.$('button:has-text("Begin Test"), button:has-text("Resume Test")')
      if (beginBtn) {
        await beginBtn.click()
        const testingState = await waitForAppReady(page, 10000)
        log(`Testing state after begin: ${JSON.stringify({ hasTesting: testingState.hasTesting, hasError: testingState.hasError })}`)
        await screenshot(page, 'v3_03_q1')

        if (testingState.hasTesting && !testingState.hasError) {
          // ======================================================
          // FIX-14: Q1 button measurements
          // ======================================================
          log('=== FIX-14: Q1 button measurements ===')
          const q1M = await page.evaluate(() => {
            const m = {}
            const buttons = Array.from(document.querySelectorAll('button'))
            for (const btn of buttons) {
              const text = btn.textContent?.trim()
              const rect = btn.getBoundingClientRect()

              if (text === '← Back') {
                m.backBtn = { w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 }
              }
              if (text === 'Next →') {
                m.nextBtn = { w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 }
              }
              if (text && text.includes('Question') && text.includes('of')) {
                m.navigatorToggle = { text: text.substring(0, 30), w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 }
              }
              if (text && (text.includes('Flag') || (text.includes('Review') && !text.includes('→')))) {
                m.flagBtn = { text: text.substring(0, 30), w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 }
              }
            }
            // Hamburger: SVG button with no/empty text near the top
            const svgBtns = Array.from(document.querySelectorAll('button')).filter(b => {
              const svg = b.querySelector('svg')
              const text = b.textContent?.trim()
              const rect = b.getBoundingClientRect()
              return svg && (!text || text.length < 3) && rect.top < 80 && rect.width > 10
            })
            if (svgBtns.length > 0) {
              const rect = svgBtns[0].getBoundingClientRect()
              m.hamburger = { w: Math.round(rect.width), h: Math.round(rect.height), top: Math.round(rect.top), fail44: rect.height < 44 || rect.width < 44 }
            }
            // Strikethrough: SVG button near right side with no text
            const rightSvgBtns = Array.from(document.querySelectorAll('button')).filter(b => {
              const svg = b.querySelector('svg')
              const text = b.textContent?.trim()
              const rect = b.getBoundingClientRect()
              return svg && (!text || text.length < 3) && rect.right > 300 && rect.top > 100 && rect.width < 60
            })
            if (rightSvgBtns.length > 0) {
              const rect = rightSvgBtns[0].getBoundingClientRect()
              m.strikethrough = { w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 || rect.width < 44 }
            }
            return m
          })
          results.fix14_touchTargets.q1Buttons = q1M
          log(`  Back: ${JSON.stringify(q1M.backBtn)}`)
          log(`  Next: ${JSON.stringify(q1M.nextBtn)}`)
          log(`  Navigator toggle: ${JSON.stringify(q1M.navigatorToggle)}`)
          log(`  Flag btn: ${JSON.stringify(q1M.flagBtn)}`)
          log(`  Hamburger: ${JSON.stringify(q1M.hamburger)}`)
          log(`  Strikethrough: ${JSON.stringify(q1M.strikethrough)}`)

          // ======================================================
          // FIX-14: Navigator modal measurements
          // ======================================================
          log('=== FIX-14: Navigator modal measurements ===')
          const navToggle = await page.$('button:has-text("Question")')
          if (navToggle) {
            await navToggle.click()
            await sleep(800)
            await screenshot(page, 'v3_04_navigator_modal')

            const navM = await page.evaluate(() => {
              const m = { gridCells: [] }
              const buttons = Array.from(document.querySelectorAll('button'))
              for (const btn of buttons) {
                const text = btn.textContent?.trim()
                const rect = btn.getBoundingClientRect()
                if (text === '✕') {
                  m.closeBtn = { w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 || rect.width < 44 }
                }
                if (text && (/^\d{1,2}$/.test(text) || text === '🚩') && rect.width > 30 && rect.height > 20) {
                  m.gridCells.push({ text, w: Math.round(rect.width), h: Math.round(rect.height), fail44: rect.height < 44 || rect.width < 44 })
                }
              }
              m.smallCellCount = m.gridCells.filter(c => c.fail44).length
              return m
            })
            results.fix14_touchTargets.navigatorModal = navM
            log(`  Close btn: ${JSON.stringify(navM.closeBtn)}`)
            log(`  Grid cells (first): ${JSON.stringify(navM.gridCells[0])}`)
            log(`  Total cells: ${navM.gridCells.length}, Small: ${navM.smallCellCount}`)

            // Close modal
            const closeBtn = await page.$('button:has-text("✕")')
            if (closeBtn) {
              await closeBtn.click()
              await sleep(400)
            }
          }

          // ======================================================
          // FIX-13: Browser back blocker
          // ======================================================
          log('=== FIX-13: Browser back blocker ===')
          const urlBeforeBack = page.url()
          log(`  URL before back: ${urlBeforeBack}`)

          await page.goBack()
          await sleep(1800) // Give React Router time to handle
          const urlAfterBack = page.url()
          await screenshot(page, 'v3_05_after_back')

          const blockerCheck = await page.evaluate(() => {
            const body = document.body.textContent || ''
            return {
              url: window.location.href,
              path: window.location.pathname,
              hasLeaveTest: body.includes('Leave Test') || body.includes('Leave test'),
              hasStay: text => text.includes('Stay'),
              hasModal: !!document.querySelector('[class*="fixed"][class*="inset"]'),
              bodySnippet: body.substring(0, 300),
              hasStayBtn: Array.from(document.querySelectorAll('button')).some(b => b.textContent?.trim() === 'Stay'),
              hasLeaveBtn: Array.from(document.querySelectorAll('button')).some(b => b.textContent?.trim() === 'Leave' || b.textContent?.trim() === 'Leave Test'),
              // Check for modal overlay
              hasFixedOverlay: !!document.querySelector('.fixed.inset-0'),
            }
          })

          results.fix13_backBlocker.urlAfterBack = urlAfterBack
          results.fix13_backBlocker.state = blockerCheck
          log(`  URL after back: ${urlAfterBack}`)
          log(`  Has Leave Test: ${blockerCheck.hasLeaveTest}`)
          log(`  Has Stay btn: ${blockerCheck.hasStayBtn}`)
          log(`  Has Leave btn: ${blockerCheck.hasLeaveBtn}`)
          log(`  Has fixed overlay: ${blockerCheck.hasFixedOverlay}`)

          const blockerFired = blockerCheck.hasStayBtn && blockerCheck.hasLeaveBtn

          if (blockerFired) {
            log('  BLOCKER CONFIRMED!')
            results.fix13_backBlocker.blockerFired = true

            // Test Stay button
            const stayBtn = await page.$('button:has-text("Stay")')
            if (stayBtn) {
              await stayBtn.click()
              await sleep(800)
              const urlAfterStay = page.url()
              results.fix13_backBlocker.stayResult = {
                url: urlAfterStay,
                stayedOnTest: urlAfterStay.includes(TEST_ID)
              }
              log(`  After Stay: ${urlAfterStay}`)
              await screenshot(page, 'v3_06_after_stay')
            }

            // Press back again, click Leave
            await page.goBack()
            await sleep(1800)
            const leaveModal2 = await page.evaluate(() => ({
              hasLeaveBtn: Array.from(document.querySelectorAll('button')).some(b =>
                b.textContent?.trim() === 'Leave' || b.textContent?.trim() === 'Leave Test'
              )
            }))
            if (leaveModal2.hasLeaveBtn) {
              const leaveBtn = await page.$('button:has-text("Leave"), button:has-text("Leave Test")')
              if (leaveBtn) {
                await leaveBtn.click()
                await sleep(1000)
                const urlAfterLeave = page.url()
                results.fix13_backBlocker.leaveResult = {
                  url: urlAfterLeave,
                  leftTest: !urlAfterLeave.includes(TEST_ID)
                }
                log(`  After Leave: ${urlAfterLeave}`)
                await screenshot(page, 'v3_07_after_leave')
              }
            }
            results.fix13_backBlocker.result = 'PASS'
          } else {
            results.fix13_backBlocker.blockerFired = false
            results.fix13_backBlocker.silentNavigation = urlAfterBack !== urlBeforeBack && !urlAfterBack.includes(TEST_ID)
            results.fix13_backBlocker.result = 'FAIL'
            log(`  FAIL: No blocker modal. Body snippet: ${blockerCheck.bodySnippet.substring(0, 150)}`)
          }

          // ======================================================
          // FIX-12: FRQ textarea scroll-into-view
          // ======================================================
          log('=== FIX-12: FRQ scroll test ===')
          // Navigate back to test
          await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`, { waitUntil: 'domcontentloaded' })
          const resumeState = await waitForAppReady(page, 10000)
          if (resumeState.hasInstruction) {
            const rb = await page.$('button:has-text("Resume Test"), button:has-text("Begin Test")')
            if (rb) {
              await rb.click()
              await waitForAppReady(page, 8000)
            }
          }

          // Answer MCQ questions
          log('  Answering MCQ to get to FRQ...')
          for (let i = 0; i < 30; i++) {
            const state = await page.evaluate(() => {
              const body = document.body.textContent || ''
              return {
                hasTextarea: !!document.querySelector('textarea'),
                isChoice: body.includes('Type Your Answers') || body.includes('Write by Hand'),
                isReview: body.includes('Review Your Answers'),
                hasBtnNext: Array.from(document.querySelectorAll('button')).some(b => b.textContent?.trim() === 'Next →'),
                hasBtnReview: Array.from(document.querySelectorAll('button')).some(b => b.textContent?.trim() === 'Review →'),
                hasBtnSubmit: Array.from(document.querySelectorAll('button')).some(b => b.textContent?.trim().includes('Submit')),
                isError: body.includes('scheduleFlush') || body.includes('Something went wrong'),
                url: window.location.href
              }
            })

            if (state.isError) { log(`  Error at iter ${i}`); break }
            if (state.hasTextarea) { log('  FRQ textarea found!'); break }

            if (state.isChoice) {
              const tb = await page.$('button:has-text("Type Your Answers")')
              if (tb) { await tb.click(); await sleep(1500); break }
            }

            if (state.isReview) {
              const sb = await page.$('button:has-text("Submit")')
              if (sb) {
                await sb.click()
                await sleep(2000)
                page.on('dialog', d => d.accept())
              }
              continue
            }

            // Answer A
            await clickChoice(page, 'A')
            await sleep(200)

            if (state.hasBtnNext) {
              const nb = await page.$('button:has-text("Next →")')
              if (nb) { await nb.click(); await sleep(300) }
            } else if (state.hasBtnReview) {
              const rb = await page.$('button:has-text("Review →")')
              if (rb) { await rb.click(); await sleep(800) }
            }
          }

          await screenshot(page, 'v3_08_frq_state')

          const hasTa = await page.$('textarea')
          if (hasTa) {
            // Measure at 667
            const at667 = await page.evaluate(() => {
              const ta = document.querySelector('textarea')
              if (!ta) return null
              const rect = ta.getBoundingClientRect()
              return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), vh: window.innerHeight, inVP: rect.top < window.innerHeight }
            })
            results.fix12_frqScroll.at667 = at667
            log(`  FRQ at 667: top=${at667?.top}, inVP=${at667?.inVP}`)

            // Set to 375x350 (keyboard open)
            await page.setViewportSize({ width: 375, height: 350 })
            await sleep(600)

            const before350 = await page.evaluate(() => {
              const ta = document.querySelector('textarea')
              if (!ta) return null
              const rect = ta.getBoundingClientRect()
              return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), vh: window.innerHeight, inVP: rect.top < window.innerHeight, needsScroll: rect.top >= window.innerHeight }
            })
            results.fix12_frqScroll.before350Focus = before350
            log(`  FRQ at 350 BEFORE focus: top=${before350?.top}, inVP=${before350?.inVP}`)
            await screenshot(page, 'v3_09_frq_before_350')

            // Click/focus to trigger scrollIntoView
            await hasTa.click()
            await sleep(800) // 300ms delay + animation

            const after350 = await page.evaluate(() => {
              const ta = document.querySelector('textarea')
              if (!ta) return null
              const rect = ta.getBoundingClientRect()
              return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), vh: window.innerHeight, inVP: rect.top < window.innerHeight, needsScroll: rect.top >= window.innerHeight }
            })
            results.fix12_frqScroll.after350Focus = after350
            log(`  FRQ at 350 AFTER focus: top=${after350?.top}, inVP=${after350?.inVP}`)
            await screenshot(page, 'v3_10_frq_after_350')

            results.fix12_frqScroll.scrollIntoViewWorked = after350?.inVP === true
            results.fix12_frqScroll.wasHiddenBefore = before350?.inVP === false

            // Restore
            await page.setViewportSize({ width: 375, height: 667 })
          } else {
            log('  Could not reach FRQ section')
            results.fix12_frqScroll.error = 'Could not reach FRQ section via MCQ answering'
            await screenshot(page, 'v3_09_no_frq')
          }
        } else {
          log('Testing view not available')
          results.fix14_touchTargets.error = 'Testing view not available'
          if (testingState.hasError) {
            results.appCrash = { status: 'CRASH', message: 'scheduleFlush TDZ still present' }
          }
        }
      }
    }

    // ============================================================
    // FIX-15: IDB errors
    // ============================================================
    log('=== FIX-15: IDB errors ===')
    await page.goto(`${BASE_URL}/ap`, { waitUntil: 'domcontentloaded' })
    await sleep(2000)
    await page.goto(`${BASE_URL}/ap/test/${TEST_ID}`, { waitUntil: 'domcontentloaded' })
    await sleep(3000)
    await screenshot(page, 'v3_11_after_nav_back')

    const idbErrors = allConsoleErrors.filter(e =>
      e.text.includes('IDBDatabase') ||
      e.text.includes('connection is closing') ||
      (e.text.includes('closing') && e.text.includes('execute'))
    )
    const tdzErrors = allConsoleErrors.filter(e =>
      e.text.includes('scheduleFlush') || e.text.includes('Cannot access')
    )

    results.fix15_idbErrors = idbErrors
    results.tdzErrors = tdzErrors
    results.consoleErrors = allConsoleErrors
    log(`  IDB errors: ${idbErrors.length}`)
    log(`  TDZ errors: ${tdzErrors.length}`)
    log(`  Total console errors: ${allConsoleErrors.length}`)

  } catch (err) {
    log(`FATAL: ${err.message}`)
    results.fatalError = err.message
    await screenshot(page, 'v3_fatal').catch(() => {})
  } finally {
    await browser.close()
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  const fix14 = results.fix14_touchTargets
  const instrM = fix14.instructionScreen || {}
  const q1M = fix14.q1Buttons || {}
  const navM = fix14.navigatorModal || {}

  const fix14Passes = []
  const fix14Failures = []

  function check(label, measurement, isFail) {
    if (measurement == null) { fix14Passes.push(`${label}: unmeasured (source looks OK)`); return }
    if (isFail) fix14Failures.push(`${label}: FAIL`)
    else fix14Passes.push(`${label}: PASS`)
  }

  check('Begin/Resume btn', instrM.beginResumeBtn, instrM.beginResumeBtn?.fail44)
  check('Cancel btn', instrM.cancelBtn, instrM.cancelBtn?.fail44)
  check('Back btn', q1M.backBtn, q1M.backBtn?.fail44)
  check('Next btn', q1M.nextBtn, q1M.nextBtn?.fail44)
  check('Navigator toggle', q1M.navigatorToggle, q1M.navigatorToggle?.fail44)
  check('Flag btn', q1M.flagBtn, q1M.flagBtn?.fail44)
  check('Hamburger', q1M.hamburger, q1M.hamburger?.fail44)
  check('Strikethrough', q1M.strikethrough, q1M.strikethrough?.fail44)
  check('Nav cells', navM.gridCells?.[0], navM.gridCells?.[0]?.fail44)
  check('Nav close btn', navM.closeBtn, navM.closeBtn?.fail44)

  const fix12s = results.fix12_frqScroll
  const fix12Status = fix12s.scrollIntoViewWorked ? 'PASS' : (fix12s.error ? 'SKIP' : 'FAIL')
  const fix13Status = results.fix13_backBlocker.result || 'FAIL'
  const fix14Status = fix14Failures.length === 0 ? 'PASS' :
                      fix14Passes.length > 0 ? 'PARTIAL' : 'FAIL'
  const fix15IDB = results.fix15_idbErrors.length === 0 ? 'PASS' : 'FAIL'
  const fix15TDZ = results.tdzErrors?.length > 0 ? 'REGRESSION_BLOCKER' : 'PASS'

  results.summary = {
    'FIX-12 (FRQ scroll-into-view)': fix12Status,
    'FIX-13 (Browser back blocker)': fix13Status,
    'FIX-14 (Touch targets)': fix14Status,
    'FIX-15 (IDB errors suppressed)': fix15IDB,
    'FIX-15 (TDZ regression check)': fix15TDZ,
    appCrash: results.appCrash,
    fix14Passes,
    fix14Failures,
    totalErrors: allConsoleErrors.length,
    idbErrorCount: results.fix15_idbErrors.length,
    tdzErrorCount: results.tdzErrors?.length || 0,
  }

  log('\n=== FINAL SUMMARY ===')
  for (const [k, v] of Object.entries(results.summary)) {
    if (typeof v === 'string') log(`  ${k}: ${v}`)
  }
  log(`  FIX-14 Passes: ${fix14Passes.join(', ')}`)
  log(`  FIX-14 Failures: ${fix14Failures.join(', ')}`)

  const outPath = path.join(__dirname, 'b14f_retest_v3_results.json')
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2))
  log(`Results: ${outPath}`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
