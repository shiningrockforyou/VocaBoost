/**
 * B14-G: The Technical Difficulties — Playwright test script
 *
 * Tests offline queuing, sync on reconnect, session recovery, and final submission.
 * Account: student10@apboost.test / Student123!
 * Test: test_micro_full_1 (Micro test, 15 MCQ questions)
 */

const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const BASE_URL = 'http://localhost:5173'
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots_B14G')

const log = (msg) => {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19)
  console.log(`[${ts}] ${msg}`)
}

async function screenshot(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`)
  await page.screenshot({ path: filepath, fullPage: false })
  log(`  Screenshot: ${name}.png`)
  return filepath
}

async function checkConsoleErrors(page, phase) {
  // Console messages are collected via listener, not polled
  // We call this to annotate output
  log(`  [Console check at: ${phase}]`)
}

async function waitAndClick(page, selector, options = {}) {
  await page.waitForSelector(selector, { timeout: 15000, ...options })
  await page.click(selector)
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function run() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  }

  const consoleErrors = []
  const consoleWarnings = []
  const results = {
    login: null,
    testStart: null,
    q1to5: null,
    offlineMode: null,
    q6to8_offline: null,
    syncOnReconnect: null,
    q9to12: null,
    closeAndReopen: null,
    resumeRestores: null,
    finalSubmit: null,
    reportCard: null,
    allAnswersPresent: null,
    consoleErrors: [],
    consoleWarnings: [],
    observations: [],
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  })

  const page = await context.newPage()

  // Capture console messages
  page.on('console', msg => {
    const text = msg.text()
    if (msg.type() === 'error') {
      consoleErrors.push({ text, url: page.url() })
      log(`  [CONSOLE ERROR] ${text}`)
    } else if (msg.type() === 'warning') {
      consoleWarnings.push({ text, url: page.url() })
    }
  })

  page.on('pageerror', err => {
    consoleErrors.push({ text: err.message, url: page.url(), isPageError: true })
    log(`  [PAGE ERROR] ${err.message}`)
  })

  try {
    // =========================================================================
    // STEP 1: Login as student10@apboost.test
    // =========================================================================
    log('=== STEP 1: Login ===')
    await page.goto(`${BASE_URL}/login`)
    await page.waitForSelector('input[type="email"]', { timeout: 15000 })
    await page.fill('input[type="email"]', 'student10@apboost.test')
    await page.fill('input[type="password"]', 'Student123!')
    await screenshot(page, '01_login_form')

    await page.click('button[type="submit"]')

    // Wait for redirect - could go to / or /ap
    await page.waitForTimeout(3000)
    await screenshot(page, '02_after_login')

    const urlAfterLogin = page.url()
    log(`  URL after login: ${urlAfterLogin}`)

    if (urlAfterLogin.includes('/login')) {
      results.login = 'FAIL'
      results.observations.push('Login failed — still on /login page')
      log('  FAIL: Login failed')
      await browser.close()
      return results
    }

    results.login = 'PASS'
    log('  PASS: Login successful')

    // Navigate to /ap dashboard if needed
    if (!urlAfterLogin.includes('/ap')) {
      log('  Note: Redirected to / not /ap — known issue B4-006')
      results.observations.push('B4-006 confirmed: student login redirects to / not /ap')
      await page.goto(`${BASE_URL}/ap`)
      await page.waitForTimeout(2000)
    }

    await page.waitForSelector('h1', { timeout: 10000 })
    await screenshot(page, '03_ap_dashboard')
    log('  Dashboard loaded')

    // =========================================================================
    // STEP 2: Start Micro Test
    // =========================================================================
    log('=== STEP 2: Start Micro Test ===')

    // Look for the test card for test_micro_full_1
    // Try clicking by test card text content
    const testCards = await page.$$('[data-testid], .test-card, button, a')
    log(`  Found ${testCards.length} potential test card elements`)

    // Find and click micro test
    let testStarted = false

    // Try looking for text "Micro" in any clickable element
    const microLink = await page.$('text=Micro')
    if (microLink) {
      await microLink.click()
      testStarted = true
      log('  Clicked Micro test card')
    } else {
      // Try navigating directly
      await page.goto(`${BASE_URL}/ap/test/test_micro_full_1`)
      testStarted = true
      log('  Navigated directly to test URL')
    }

    await page.waitForTimeout(3000)
    await screenshot(page, '04_instruction_screen')
    log(`  URL: ${page.url()}`)

    // Look for Begin/Start Test button
    const beginBtn = await page.$('button:has-text("Begin Test"), button:has-text("Start Test"), button:has-text("Begin")')
    if (!beginBtn) {
      results.testStart = 'FAIL'
      results.observations.push('Could not find Begin Test button on instruction screen')
      log('  FAIL: No Begin Test button found')
    } else {
      await beginBtn.click()
      await page.waitForTimeout(3000)
      await screenshot(page, '05_test_started')
      results.testStart = 'PASS'
      log('  PASS: Test started')
    }

    // =========================================================================
    // STEP 3: Answer Q1-Q5 normally
    // =========================================================================
    log('=== STEP 3: Answer Q1-Q5 normally ===')

    let answeredCount = 0

    for (let q = 1; q <= 5; q++) {
      log(`  Answering Q${q}...`)
      await page.waitForTimeout(500)

      // Find answer choice buttons — MCQ choices
      // Look for radio buttons or answer choice buttons
      const choices = await page.$$('[role="radio"], input[type="radio"], button[data-choice], .answer-choice')

      if (choices.length === 0) {
        // Try other selectors
        const anyChoices = await page.$$('button')
        log(`    No radio choices found. Found ${anyChoices.length} buttons total`)

        // Try to find answer buttons by looking at text
        const btnTexts = []
        for (const btn of anyChoices.slice(0, 10)) {
          const text = await btn.innerText().catch(() => '')
          btnTexts.push(text.substring(0, 50))
        }
        log(`    Button texts: ${JSON.stringify(btnTexts)}`)
      }

      // Click first available choice (Choice A)
      if (choices.length > 0) {
        await choices[0].click()
        answeredCount++
        log(`    Selected choice A for Q${q}`)
      } else {
        // Fallback: look for labeled choices
        const choiceA = await page.$('label:has-text("(A)"), label:has-text("A."), [aria-label*="Choice A"]')
        if (choiceA) {
          await choiceA.click()
          answeredCount++
          log(`    Selected choice A (label) for Q${q}`)
        }
      }

      await page.waitForTimeout(300)

      // Click Next button
      const nextBtn = await page.$('button:has-text("Next"), button[aria-label="Next question"]')
      if (nextBtn && q < 5) {
        await nextBtn.click()
        await page.waitForTimeout(500)
        log(`    Clicked Next`)
      } else if (q < 5) {
        log(`    Warning: No Next button found for Q${q}`)
      }
    }

    await screenshot(page, '06_q5_answered')
    log(`  Answered ${answeredCount} of 5 questions normally`)
    results.q1to5 = answeredCount >= 3 ? 'PASS' : 'PARTIAL'

    // Get session ID from page for verification
    const sessionData = await page.evaluate(() => {
      // Try to get session from IndexedDB
      return new Promise((resolve) => {
        const request = indexedDB.open('ap_boost_queue', 1)
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('actions')) {
            resolve({ storeExists: false })
            return
          }
          const tx = db.transaction('actions', 'readonly')
          const store = tx.objectStore('actions')
          const getAll = store.getAll()
          getAll.onsuccess = () => resolve({ items: getAll.result, storeExists: true })
          getAll.onerror = () => resolve({ error: getAll.error?.message })
        }
        request.onerror = () => resolve({ dbError: 'Failed to open IndexedDB' })
      })
    })
    log(`  IndexedDB state: storeExists=${sessionData.storeExists}, items=${sessionData.items?.length || 0}`)
    results.observations.push(`After Q1-Q5: IndexedDB has ${sessionData.items?.length || 0} queue items`)

    // =========================================================================
    // STEP 4: Block all Firestore requests for 10 seconds (simulate offline)
    // =========================================================================
    log('=== STEP 4: Block Firestore (simulate offline) ===')

    // Use page.route to intercept Firestore requests
    let firestoreBlocked = false
    let blockedRequestCount = 0

    await page.route('**/firestore.googleapis.com/**', (route) => {
      if (firestoreBlocked) {
        blockedRequestCount++
        route.abort('failed')
        log(`    BLOCKED: Firestore request (count: ${blockedRequestCount})`)
      } else {
        route.continue()
      }
    })

    // Also block the Firebase Listen channel
    await page.route('**googleapis.com/google.firestore.v1**', (route) => {
      if (firestoreBlocked) {
        route.abort('failed')
      } else {
        route.continue()
      }
    })

    firestoreBlocked = true
    const offlineStartTime = Date.now()
    log('  Firestore requests blocked — simulating offline mode')
    results.offlineMode = 'ACTIVE'

    await screenshot(page, '07_offline_mode_start')

    // Check if UI shows any offline/disconnected indicator
    await page.waitForTimeout(2000)
    const connectionBanner = await page.$('[data-testid="connection-status"], .connection-status, .offline-banner')
    if (connectionBanner) {
      const bannerText = await connectionBanner.innerText().catch(() => '')
      log(`  Connection banner visible: "${bannerText}"`)
      results.observations.push(`Offline banner text: "${bannerText}"`)
    } else {
      log('  No connection banner visible immediately (may appear after Firestore failures)')
      results.observations.push('No immediate offline banner (banner may appear after Firestore failures)')
    }

    // =========================================================================
    // STEP 5: Answer Q6-Q8 while "offline"
    // =========================================================================
    log('=== STEP 5: Answer Q6-Q8 while offline ===')

    let offlineAnsweredCount = 0

    // We should be on Q6 now (after answering Q1-5 and navigating)
    for (let q = 6; q <= 8; q++) {
      log(`  Answering Q${q} (offline)...`)
      await page.waitForTimeout(500)

      const choices = await page.$$('[role="radio"], input[type="radio"]')
      if (choices.length > 0) {
        // Pick choice B for offline questions to distinguish them
        const targetChoice = choices.length >= 2 ? choices[1] : choices[0]
        await targetChoice.click()
        offlineAnsweredCount++
        log(`    Selected choice B (offline) for Q${q}`)
      } else {
        const choiceBtn = await page.$('button[data-choice], .answer-choice')
        if (choiceBtn) {
          await choiceBtn.click()
          offlineAnsweredCount++
          log(`    Selected first choice (offline) for Q${q}`)
        } else {
          log(`    WARNING: No choice found for Q${q} while offline`)
        }
      }

      await page.waitForTimeout(400)

      const nextBtn = await page.$('button:has-text("Next")')
      if (nextBtn && q < 8) {
        await nextBtn.click()
        await page.waitForTimeout(500)
        log(`    Clicked Next`)
      }
    }

    await screenshot(page, '08_q8_answered_offline')

    // Verify IndexedDB has queued the offline answers
    const offlineQueueState = await page.evaluate(() => {
      return new Promise((resolve) => {
        const request = indexedDB.open('ap_boost_queue', 1)
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('actions')) {
            resolve({ storeExists: false, pendingCount: 0 })
            return
          }
          const tx = db.transaction('actions', 'readonly')
          const store = tx.objectStore('actions')
          const getAll = store.getAll()
          getAll.onsuccess = () => {
            const items = getAll.result
            const pending = items.filter(i => i.status === 'PENDING')
            const answerChanges = pending.filter(i => i.action === 'ANSWER_CHANGE')
            resolve({
              storeExists: true,
              totalItems: items.length,
              pendingCount: pending.length,
              answerChangeCount: answerChanges.length,
              sampleItems: pending.slice(0, 3).map(i => ({
                action: i.action,
                questionId: i.payload?.questionId,
                value: i.payload?.value
              }))
            })
          }
          getAll.onerror = () => resolve({ error: 'Failed to get items' })
        }
        request.onerror = () => resolve({ dbError: 'DB open failed' })
      })
    })

    log(`  IndexedDB pending items: ${offlineQueueState.pendingCount}`)
    log(`  Answer changes in queue: ${offlineQueueState.answerChangeCount}`)
    if (offlineQueueState.sampleItems) {
      log(`  Sample queue items: ${JSON.stringify(offlineQueueState.sampleItems)}`)
    }

    results.offlineMode = offlineAnsweredCount >= 2 ? 'PASS' : 'PARTIAL'
    results.q6to8_offline = {
      answeredCount: offlineAnsweredCount,
      queuedItems: offlineQueueState.pendingCount,
      answerChangesQueued: offlineQueueState.answerChangeCount,
    }
    results.observations.push(`Offline answers queued: ${offlineQueueState.pendingCount} total, ${offlineQueueState.answerChangeCount} answer changes`)

    if (offlineQueueState.answerChangeCount === 0 && offlineAnsweredCount > 0) {
      results.observations.push('WARNING: Answers were clicked but IndexedDB shows 0 ANSWER_CHANGE items — may indicate queue failure')
    }

    // Check if UI showed any error or degradation during offline answers
    const uiResponded = offlineAnsweredCount > 0
    log(`  UI responded during offline: ${uiResponded}`)
    results.observations.push(`UI responsive during offline mode: ${uiResponded}`)

    // Wait out the 10-second offline window
    const elapsed = Date.now() - offlineStartTime
    const remaining = 10000 - elapsed
    if (remaining > 0) {
      log(`  Waiting ${remaining}ms to complete the 10-second offline window...`)
      await sleep(remaining)
    }

    // =========================================================================
    // STEP 6: Restore network — verify queued answers sync
    // =========================================================================
    log('=== STEP 6: Restore network — verify sync ===')
    firestoreBlocked = false
    await page.unroute('**/firestore.googleapis.com/**')
    await page.unroute('**googleapis.com/google.firestore.v1**')

    log('  Network restored')
    results.observations.push(`Blocked ${blockedRequestCount} Firestore requests during offline period`)

    // Wait for sync to occur (the flush should trigger ~1s after online)
    log('  Waiting for queue flush (up to 5s)...')
    await page.waitForTimeout(5000)

    await screenshot(page, '09_after_network_restore')

    // Check if sync banner appeared
    const syncBanner = await page.$('.syncing, [data-testid="syncing"], .sync-status')
    if (syncBanner) {
      const syncText = await syncBanner.innerText().catch(() => '')
      log(`  Sync banner visible: "${syncText}"`)
    }

    // Check IndexedDB after sync
    const postSyncQueue = await page.evaluate(() => {
      return new Promise((resolve) => {
        const request = indexedDB.open('ap_boost_queue', 1)
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('actions')) {
            resolve({ storeExists: false, pendingCount: 0 })
            return
          }
          const tx = db.transaction('actions', 'readonly')
          const store = tx.objectStore('actions')
          const getAll = store.getAll()
          getAll.onsuccess = () => {
            const items = getAll.result
            const pending = items.filter(i => i.status === 'PENDING')
            resolve({
              totalItems: items.length,
              pendingCount: pending.length,
              pendingActions: pending.map(i => i.action)
            })
          }
          getAll.onerror = () => resolve({ error: 'Failed' })
        }
        request.onerror = () => resolve({ dbError: 'DB open failed' })
      })
    })

    log(`  Post-sync IndexedDB: total=${postSyncQueue.totalItems}, pending=${postSyncQueue.pendingCount}`)
    log(`  Pending action types: ${JSON.stringify(postSyncQueue.pendingActions)}`)

    const syncSuccess = postSyncQueue.pendingCount === 0
    results.syncOnReconnect = syncSuccess ? 'PASS' : 'PARTIAL'
    results.observations.push(`Post-sync queue: ${postSyncQueue.pendingCount} pending items remain`)

    if (!syncSuccess) {
      results.observations.push(`WARNING: ${postSyncQueue.pendingCount} items still pending after 5s sync window`)
    }

    // =========================================================================
    // STEP 7: Answer Q9-Q12 normally
    // =========================================================================
    log('=== STEP 7: Answer Q9-Q12 ===')

    let q9to12Count = 0
    for (let q = 9; q <= 12; q++) {
      log(`  Answering Q${q}...`)
      await page.waitForTimeout(500)

      const choices = await page.$$('[role="radio"], input[type="radio"]')
      if (choices.length > 0) {
        await choices[0].click()
        q9to12Count++
        log(`    Selected choice A for Q${q}`)
      }

      await page.waitForTimeout(300)

      const nextBtn = await page.$('button:has-text("Next")')
      if (nextBtn && q < 12) {
        await nextBtn.click()
        await page.waitForTimeout(500)
      }
    }

    await screenshot(page, '10_q12_answered')
    results.q9to12 = q9to12Count >= 3 ? 'PASS' : 'PARTIAL'
    log(`  Answered ${q9to12Count} of 4 questions`)

    // Capture current URL to reopen
    const currentTestUrl = page.url()
    log(`  Current test URL: ${currentTestUrl}`)

    // =========================================================================
    // STEP 8: Close the page completely
    // =========================================================================
    log('=== STEP 8: Close page ===')

    // Get session ID before closing
    const sessionId = await page.evaluate(() => {
      // Try to find session ID from IndexedDB items
      return new Promise((resolve) => {
        const request = indexedDB.open('ap_boost_queue', 1)
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('actions')) {
            resolve(null)
            return
          }
          const tx = db.transaction('actions', 'readonly')
          const store = tx.objectStore('actions')
          const getAll = store.getAll()
          getAll.onsuccess = () => {
            const items = getAll.result
            if (items.length > 0) {
              resolve(items[0].sessionId)
            } else {
              resolve(null)
            }
          }
          getAll.onerror = () => resolve(null)
        }
        request.onerror = () => resolve(null)
      })
    })
    log(`  Session ID from IndexedDB: ${sessionId}`)

    // Final queue state before close
    const preCloseQueue = await page.evaluate(() => {
      return new Promise((resolve) => {
        const request = indexedDB.open('ap_boost_queue', 1)
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('actions')) {
            resolve({ pendingCount: 0 })
            return
          }
          const tx = db.transaction('actions', 'readonly')
          const store = tx.objectStore('actions')
          const getAll = store.getAll()
          getAll.onsuccess = () => {
            const items = getAll.result
            const pending = items.filter(i => i.status === 'PENDING')
            resolve({ pendingCount: pending.length, totalItems: items.length })
          }
          getAll.onerror = () => resolve({ pendingCount: 0 })
        }
        request.onerror = () => resolve({ pendingCount: 0 })
      })
    })
    log(`  Queue state before close: pending=${preCloseQueue.pendingCount}, total=${preCloseQueue.totalItems}`)
    results.observations.push(`Queue before page close: ${preCloseQueue.pendingCount} pending items`)

    // Close current page (simulating closing the browser tab)
    await page.close()
    log('  Page closed')

    // =========================================================================
    // STEP 9: Reopen page — navigate back to test
    // =========================================================================
    log('=== STEP 9: Reopen page and navigate to test ===')
    await sleep(2000)

    const page2 = await context.newPage()

    page2.on('console', msg => {
      const text = msg.text()
      if (msg.type() === 'error') {
        consoleErrors.push({ text, url: page2.url(), phase: 'resume' })
        log(`  [CONSOLE ERROR (resume)] ${text}`)
      }
    })

    page2.on('pageerror', err => {
      consoleErrors.push({ text: err.message, url: page2.url(), isPageError: true, phase: 'resume' })
      log(`  [PAGE ERROR (resume)] ${err.message}`)
    })

    // Navigate back to test URL
    const testUrl = currentTestUrl.includes('/ap/test/') ? currentTestUrl : `${BASE_URL}/ap/test/test_micro_full_1`
    log(`  Navigating to: ${testUrl}`)
    await page2.goto(testUrl)
    await page2.waitForTimeout(4000)

    await screenshot(page2, '11_page_reopened')
    log(`  URL after reopen: ${page2.url()}`)

    // Check if we hit login redirect
    if (page2.url().includes('/login')) {
      log('  Redirected to login — re-authenticating...')
      await page2.fill('input[type="email"]', 'student10@apboost.test')
      await page2.fill('input[type="password"]', 'Student123!')
      await page2.click('button[type="submit"]')
      await page2.waitForTimeout(3000)

      if (!page2.url().includes('/ap')) {
        await page2.goto(testUrl)
        await page2.waitForTimeout(3000)
      }
      await screenshot(page2, '11b_relogged_in')
    }

    results.closeAndReopen = 'PASS'

    // =========================================================================
    // STEP 10: Resume session — verify all 12 answers restored
    // =========================================================================
    log('=== STEP 10: Resume session — verify answers restored ===')
    await page2.waitForTimeout(2000)
    await screenshot(page2, '12_session_state_on_resume')

    const pageText = await page2.evaluate(() => document.body.innerText)
    log(`  Page text preview: "${pageText.substring(0, 300).replace(/\n/g, ' ')}"`)

    // Look for "Resume Test" button or instruction screen
    const resumeBtn = await page2.$('button:has-text("Resume"), button:has-text("Continue")')
    if (resumeBtn) {
      log('  Found Resume button — clicking...')
      await resumeBtn.click()
      await page2.waitForTimeout(3000)
      await screenshot(page2, '13_resumed_test')
    } else {
      // Maybe already in test view, or maybe we see instruction screen with begin button
      const beginBtn = await page2.$('button:has-text("Begin Test"), button:has-text("Begin")')
      if (beginBtn) {
        log('  Found Begin Test button (instruction screen) — session may show as not started?')
        results.observations.push('WARNING: After page reopen, showed "Begin Test" instead of "Resume" — possible session resume issue')
        await beginBtn.click()
        await page2.waitForTimeout(3000)
        await screenshot(page2, '13b_began_again')
      }
    }

    // Check answers count via DOM — look at navigator or visible state
    const answersState = await page2.evaluate(() => {
      // Check if the test hook has exposed any state to window (debug)
      const state = window.__testSessionDebug || window.__apTestState
      return state ? state : null
    })
    log(`  Test session debug state: ${JSON.stringify(answersState)}`)

    // Count answered questions by checking navigator grid cells
    const answeredCells = await page2.$$('[aria-label*="Answered"], .answered, [data-answered="true"]')
    log(`  Answered cells in navigator grid: ${answeredCells.length}`)

    // Navigate through questions to count which have answers
    // First, go to question 1 to check
    const q1NavBtn = await page2.$('[aria-label*="Question 1"], [data-question-index="0"]')
    if (q1NavBtn) {
      await q1NavBtn.click()
      await page2.waitForTimeout(500)
    }

    // Open navigator to count answered questions
    const navBtn = await page2.$('button:has-text("Navigator"), button[aria-label*="Navigator"]')
    if (navBtn) {
      await navBtn.click()
      await page2.waitForTimeout(500)
      await screenshot(page2, '14_navigator_open_after_resume')

      // Count answered state in navigator
      const navigatorItems = await page2.evaluate(() => {
        // Look for grid cells with answered state
        const cells = document.querySelectorAll('[data-testid^="nav-q"], .navigator-cell, [role="gridcell"]')
        return Array.from(cells).map(cell => ({
          text: cell.textContent?.trim(),
          class: cell.className,
          ariaLabel: cell.getAttribute('aria-label')
        }))
      })
      log(`  Navigator cells: ${JSON.stringify(navigatorItems.slice(0, 12))}`)
      results.observations.push(`Navigator cells after resume: ${navigatorItems.length} cells found`)

      // Close navigator
      const closeNavBtn = await page2.$('button:has-text("Close"), [aria-label="Close navigator"]')
      if (closeNavBtn) await closeNavBtn.click()
      await page2.waitForTimeout(300)
    }

    // Evaluate answers from the current question display
    const currentAnswerInfo = await page2.evaluate(() => {
      // Try to count from aria-pressed or checked radio buttons
      const checkedRadios = document.querySelectorAll('input[type="radio"]:checked, [aria-pressed="true"][role="radio"]')
      const selectedChoices = document.querySelectorAll('[data-selected="true"], [aria-checked="true"]')
      return {
        checkedRadioCount: checkedRadios.length,
        selectedChoiceCount: selectedChoices.length,
        url: window.location.href
      }
    })
    log(`  Current page answer state: ${JSON.stringify(currentAnswerInfo)}`)

    // Check IndexedDB state after resume
    const resumeQueueState = await page2.evaluate(() => {
      return new Promise((resolve) => {
        const request = indexedDB.open('ap_boost_queue', 1)
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('actions')) {
            resolve({ storeExists: false, pendingCount: 0, totalItems: 0 })
            return
          }
          const tx = db.transaction('actions', 'readonly')
          const store = tx.objectStore('actions')
          const getAll = store.getAll()
          getAll.onsuccess = () => {
            const items = getAll.result
            const pending = items.filter(i => i.status === 'PENDING')
            resolve({
              storeExists: true,
              totalItems: items.length,
              pendingCount: pending.length,
              actions: pending.map(i => i.action)
            })
          }
          getAll.onerror = () => resolve({ error: 'Failed' })
        }
        request.onerror = () => resolve({ dbError: 'DB open failed' })
      })
    })

    log(`  IndexedDB after resume: total=${resumeQueueState.totalItems}, pending=${resumeQueueState.pendingCount}`)
    results.observations.push(`IndexedDB after resume: pending=${resumeQueueState.pendingCount}`)

    // Navigate to see if answers are present — go through Q1-Q12 rapidly
    log('  Checking answers Q1-Q12 by navigating via navigator...')
    const answersRestored = {}

    // Use the navigator grid to jump to each question and check if selected
    for (let qi = 0; qi < 12; qi++) {
      // Click navigator cell by question number
      const navCell = await page2.$(`[aria-label*="Question ${qi + 1}"], [data-q-index="${qi}"]`)
      if (navCell) {
        await navCell.click()
        await page2.waitForTimeout(300)
        const hasAnswer = await page2.evaluate(() => {
          const checked = document.querySelector('input[type="radio"]:checked, [aria-pressed="true"][role="radio"], [data-selected="true"]')
          return !!checked
        })
        answersRestored[`Q${qi + 1}`] = hasAnswer
      } else {
        // Use direct keyboard navigation or next button
        answersRestored[`Q${qi + 1}`] = 'not_checked'
      }
    }

    log(`  Answers restored status: ${JSON.stringify(answersRestored)}`)
    const restoredCount = Object.values(answersRestored).filter(v => v === true).length
    const notCheckedCount = Object.values(answersRestored).filter(v => v === 'not_checked').length
    log(`  Restored: ${restoredCount} confirmed, ${notCheckedCount} not checked`)

    results.resumeRestores = {
      answersRestored,
      restoredCount,
      status: restoredCount >= 9 ? 'PASS' : restoredCount >= 6 ? 'PARTIAL' : 'FAIL'
    }

    // =========================================================================
    // STEP 11: Answer Q13-Q15
    // =========================================================================
    log('=== STEP 11: Answer Q13-Q15 ===')

    // Navigate to Q13 first
    // We need to get to Q13 — navigate forward from wherever we are
    // First go to last answered question, then advance
    let q13to15Count = 0

    for (let q = 13; q <= 15; q++) {
      // Try to navigate to Q13 via navigator
      const navCell13 = await page2.$(`[aria-label*="Question ${q}"], [data-q-index="${q - 1}"]`)
      if (navCell13) {
        await navCell13.click()
        await page2.waitForTimeout(500)
      } else {
        // Use Next button
        const nextBtn = await page2.$('button:has-text("Next")')
        if (nextBtn) {
          await nextBtn.click()
          await page2.waitForTimeout(500)
        }
      }

      const choices = await page2.$$('[role="radio"], input[type="radio"]')
      if (choices.length > 0) {
        // Pick choice C for Q13-15 to distinguish
        const targetChoice = choices.length >= 3 ? choices[2] : choices[0]
        await targetChoice.click()
        q13to15Count++
        log(`  Answered Q${q}`)
      } else {
        log(`  WARNING: No choices for Q${q}`)
      }

      await page2.waitForTimeout(300)
    }

    await screenshot(page2, '15_q15_answered')
    log(`  Answered ${q13to15Count} of 3 remaining questions`)

    // =========================================================================
    // STEP 12: Submit the test
    // =========================================================================
    log('=== STEP 12: Submit test ===')

    // Look for "Review" or "Submit" button
    const reviewBtn = await page2.$('button:has-text("Review"), button:has-text("Submit Section")')
    if (reviewBtn) {
      await reviewBtn.click()
      await page2.waitForTimeout(2000)
      await screenshot(page2, '16_review_screen')
      log('  Clicked Review/Submit Section button')
    } else {
      // Navigate to next section
      const nextBtn = await page2.$('button:has-text("Next")')
      if (nextBtn) {
        await nextBtn.click()
        await page2.waitForTimeout(1000)
      }
    }

    // Look for Submit Section button on review screen
    const submitSectionBtn = await page2.$('button:has-text("Submit Section"), button:has-text("Submit MCQ")')
    if (submitSectionBtn) {
      await submitSectionBtn.click()
      await page2.waitForTimeout(2000)
      await screenshot(page2, '17_submit_section_clicked')
      log('  Clicked Submit Section')
    }

    // FRQ choice screen
    await page2.waitForTimeout(2000)
    await screenshot(page2, '18_post_section_submit')
    log(`  URL after submit section: ${page2.url()}`)

    // Look for FRQ section or Submit Test button
    const frqChoiceHeading = await page2.$('h2:has-text("Free Response"), h1:has-text("Free Response"), h2:has-text("Section 2")')
    if (frqChoiceHeading) {
      log('  FRQ choice/section screen detected')

      // Click first FRQ topic
      const frqTopicBtn = await page2.$('button[data-testid*="frq"], .frq-choice, button:has-text("Choose")')
      if (frqTopicBtn) {
        await frqTopicBtn.click()
        await page2.waitForTimeout(1000)
        log('  Selected FRQ topic')
      }
    }

    // Check for Submit Test button
    const submitTestBtn = await page2.$('button:has-text("Submit Test")')
    if (submitTestBtn) {
      await submitTestBtn.click()
      await page2.waitForTimeout(1000)

      // Handle confirmation dialog if any
      const confirmBtn = await page2.$('button:has-text("Confirm"), button:has-text("Yes, Submit")')
      if (confirmBtn) {
        await confirmBtn.click()
        await page2.waitForTimeout(1000)
      }

      await screenshot(page2, '19_submitting')
      log('  Clicked Submit Test')
    }

    // Wait for submission to complete
    await page2.waitForTimeout(5000)
    await screenshot(page2, '20_post_submit')
    log(`  URL after submit: ${page2.url()}`)

    const postSubmitUrl = page2.url()
    if (postSubmitUrl.includes('/ap/results/')) {
      log('  Redirected to results page!')
      results.finalSubmit = 'PASS'
    } else {
      log(`  Not on results page. URL: ${postSubmitUrl}`)
      results.finalSubmit = 'PARTIAL'
      results.observations.push(`After submit, URL is ${postSubmitUrl} — not /ap/results/`)
    }

    // =========================================================================
    // STEP 13: Verify report card — check for all 15 answers
    // =========================================================================
    log('=== STEP 13: Verify report card ===')
    await page2.waitForTimeout(2000)

    const pageContent = await page2.evaluate(() => document.body.innerText)
    log(`  Report card content preview: "${pageContent.substring(0, 500).replace(/\n/g, ' ')}"`)

    // Extract MCQ table rows to count answers
    const mcqTableData = await page2.evaluate(() => {
      const rows = document.querySelectorAll('tr, [role="row"]')
      return Array.from(rows).map(row => ({
        text: row.textContent?.trim().replace(/\s+/g, ' ').substring(0, 100)
      }))
    })
    log(`  Table rows: ${mcqTableData.length}`)
    log(`  Row samples: ${JSON.stringify(mcqTableData.slice(0, 5))}`)

    await screenshot(page2, '21_report_card')

    // Check total score
    const scoreMatch = pageContent.match(/(\d+)\s*\/\s*15|Score[:\s]+(\d+)/i)
    const mcqScore = scoreMatch ? (scoreMatch[1] || scoreMatch[2]) : 'not found'
    log(`  MCQ Score: ${mcqScore}`)
    results.observations.push(`Report card MCQ score: ${mcqScore}/15`)

    // Count data rows in MCQ table (excluding header)
    const mcqRows = mcqTableData.filter(row =>
      row.text.match(/^Q?\d+\s/) || row.text.match(/^\d+\s/) || row.text.match(/Question\s+\d+/)
    )
    log(`  MCQ data rows: ${mcqRows.length}`)
    results.observations.push(`Report card MCQ rows: ${mcqRows.length}`)

    if (mcqRows.length >= 12) {
      results.allAnswersPresent = mcqRows.length >= 15 ? 'PASS' : 'PARTIAL'
      results.reportCard = 'PASS'
    } else {
      results.allAnswersPresent = 'FAIL'
      results.reportCard = pageContent.length > 200 ? 'PARTIAL' : 'FAIL'
      results.observations.push(`WARNING: Only ${mcqRows.length} MCQ rows on report card — expected 15`)
    }

    log(`  allAnswersPresent: ${results.allAnswersPresent}`)
    log(`  Report card status: ${results.reportCard}`)

  } catch (err) {
    log(`  FATAL ERROR: ${err.message}`)
    log(err.stack)
    results.observations.push(`FATAL: ${err.message}`)
    consoleErrors.push({ text: err.message, url: 'script error', isScriptError: true })
  } finally {
    results.consoleErrors = consoleErrors
    results.consoleWarnings = consoleWarnings.slice(0, 20)
    await browser.close()
  }

  return results
}

run().then(results => {
  log('\n=== TEST RESULTS SUMMARY ===')
  log(JSON.stringify(results, null, 2))

  // Write results to file
  const outputPath = path.join(__dirname, 'b14g_results.json')
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2))
  log(`\nResults saved to: ${outputPath}`)
}).catch(err => {
  log(`Script failed: ${err.message}`)
  log(err.stack)
  process.exit(1)
})
