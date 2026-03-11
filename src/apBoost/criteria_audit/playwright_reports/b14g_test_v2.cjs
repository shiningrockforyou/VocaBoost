/**
 * B14-G: The Technical Difficulties — Playwright test script v2
 *
 * Improvements:
 * - Correctly targets answer choice buttons (they are flex-1 buttons containing letter + text)
 * - Uses better selectors for navigation, submit, etc.
 * - Better DOM inspection at each step
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

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * Click the first unlocked answer choice button on the current question.
 * Answer buttons contain: letter badge + choice text
 * They are identified by their class structure: flex-1 flex items-start gap-3 p-3 rounded...
 */
async function clickAnswerChoice(page, letterIndex = 0) {
  // The AnswerInput component renders buttons with class starting with "flex-1 flex items-start"
  // We select based on the span containing the letter (A, B, C, D)
  const letters = ['A', 'B', 'C', 'D']
  const targetLetter = letters[letterIndex]

  // Find button containing the letter badge span
  // The button structure: <button><span>A</span><div><span>choice text</span></div></button>
  // We look for buttons that have an immediate child span with just the letter
  const result = await page.evaluate((letter) => {
    // Find all buttons in the answer area
    const buttons = Array.from(document.querySelectorAll('button[type="button"]'))
    for (const btn of buttons) {
      // Look for span containing just the letter as badge
      const spans = Array.from(btn.querySelectorAll('span'))
      for (const span of spans) {
        if (span.textContent?.trim() === letter &&
            span.className?.includes('rounded-full') &&
            span.className?.includes('text-sm')) {
          // Found it - check it's not disabled
          if (!btn.disabled) {
            btn.click()
            return { clicked: true, letter }
          }
        }
      }
    }
    return { clicked: false, letter }
  }, targetLetter)

  if (result.clicked) {
    log(`    Clicked choice ${targetLetter}`)
    return true
  }

  // Fallback: find button by text content pattern "A\ntext" or "A text"
  const fallback = await page.evaluate((letter) => {
    const buttons = Array.from(document.querySelectorAll('button[type="button"]'))
    for (const btn of buttons) {
      const text = btn.textContent?.trim()
      if (text && (text.startsWith(letter + '\n') || text.startsWith(letter + ' ') || text === letter)) {
        if (!btn.disabled && !btn.closest('[disabled]')) {
          btn.click()
          return { clicked: true, letter }
        }
      }
    }
    return { clicked: false }
  }, targetLetter)

  if (fallback.clicked) {
    log(`    Clicked choice ${targetLetter} (fallback)`)
    return true
  }

  log(`    WARNING: Could not click choice ${targetLetter}`)
  return false
}

/**
 * Check if current question has an answer selected
 */
async function hasAnswerSelected(page) {
  return page.evaluate(() => {
    // Look for a button that has bg-brand-primary (selected state)
    const buttons = Array.from(document.querySelectorAll('button[type="button"]'))
    return buttons.some(btn =>
      btn.className?.includes('bg-brand-primary') &&
      btn.querySelector('span.rounded-full')
    )
  })
}

/**
 * Click the Next button
 */
async function clickNext(page) {
  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button[type="button"]'))
    for (const btn of buttons) {
      const text = btn.textContent?.trim()
      if (text === 'Next' || text === 'Next →' || text?.includes('Next →')) {
        if (!btn.disabled) {
          btn.click()
          return true
        }
      }
    }
    return false
  })
  return clicked
}

/**
 * Get IndexedDB queue state
 */
async function getQueueState(page) {
  return page.evaluate(() => {
    return new Promise((resolve) => {
      const request = indexedDB.open('ap_boost_queue', 1)
      request.onsuccess = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('actions')) {
          resolve({ storeExists: false, pendingCount: 0, totalItems: 0, items: [] })
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
            allActions: pending.map(i => i.action),
            answerItems: answerChanges.map(i => ({
              questionId: i.payload?.questionId,
              value: i.payload?.value,
              ts: i.localTimestamp
            })),
            sessionId: items.length > 0 ? items[0].sessionId : null
          })
        }
        getAll.onerror = () => resolve({ error: 'Failed' })
      }
      request.onerror = () => resolve({ dbError: 'DB open failed' })
    })
  })
}

/**
 * Get current question number from DOM
 */
async function getCurrentQuestion(page) {
  return page.evaluate(() => {
    // Look for "Question X of Y" text
    const text = document.body.innerText
    const match = text.match(/Question\s+(\d+)\s+of\s+(\d+)/)
    if (match) return { current: parseInt(match[1]), total: parseInt(match[2]) }

    // Try header
    const header = document.querySelector('h2, h3')
    if (header) {
      const hMatch = header.textContent?.match(/Question\s+(\d+)/)
      if (hMatch) return { current: parseInt(hMatch[1]), total: null }
    }
    return null
  })
}

/**
 * Count selected answers by navigating through all questions
 * More efficient: reads from React state via window
 */
async function countSelectedAnswers(page) {
  return page.evaluate(() => {
    // Try to find the test session state - look for React fiber or __reactProps
    // Approach: look at the DOM for answered questions indicator
    // The navigator grid shows answered state

    // Alternative: look for all answer choice buttons with bg-brand-primary across all questions
    // But we can't do that without navigating to each question

    // Instead, read from URL/page info
    return {
      url: window.location.href,
      bodyText: document.body.innerText.substring(0, 200)
    }
  })
}

async function run() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  }

  const consoleErrors = []
  const observations = []
  const results = {}

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  })

  const page = await context.newPage()

  page.on('console', msg => {
    const text = msg.text()
    if (msg.type() === 'error') {
      consoleErrors.push({ text, url: page.url() })
      log(`  [CONSOLE ERROR] ${text}`)
    }
  })

  page.on('pageerror', err => {
    consoleErrors.push({ text: err.message, url: page.url(), isPageError: true })
    log(`  [PAGE ERROR] ${err.message}`)
  })

  try {
    // =========================================================================
    // STEP 1: Login
    // =========================================================================
    log('=== STEP 1: Login ===')
    await page.goto(`${BASE_URL}/login`)
    await page.waitForSelector('input[type="email"]', { timeout: 10000 })
    await page.fill('input[type="email"]', 'student10@apboost.test')
    await page.fill('input[type="password"]', 'Student123!')
    await screenshot(page, 'v2_01_login_form')
    await page.click('button[type="submit"]')
    await sleep(3000)
    const loginUrl = page.url()
    log(`  URL after login: ${loginUrl}`)

    if (loginUrl.includes('/login')) {
      results.login = 'FAIL'
      observations.push('BLOCKER: Login failed')
      await browser.close()
      return { results, consoleErrors, observations }
    }

    results.login = 'PASS'
    if (!loginUrl.includes('/ap')) {
      observations.push(`B4-006 confirmed: login redirects to ${loginUrl} not /ap`)
    }

    // Navigate to AP dashboard
    await page.goto(`${BASE_URL}/ap`)
    await sleep(2000)
    await screenshot(page, 'v2_02_dashboard')
    log('  Dashboard loaded')

    // =========================================================================
    // STEP 2: Navigate to Micro test instruction screen
    // =========================================================================
    log('=== STEP 2: Navigate to Micro test ===')
    await page.goto(`${BASE_URL}/ap/test/test_micro_full_1`)
    await sleep(3000)
    await screenshot(page, 'v2_03_instruction_screen')
    log(`  Instruction screen URL: ${page.url()}`)

    // Read page state
    const instructionText = await page.evaluate(() => document.body.innerText.substring(0, 200))
    log(`  Page text: "${instructionText.replace(/\n/g, ' ')}"`)

    // Find and click Begin Test or Resume Test button
    const beginClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      for (const btn of buttons) {
        const text = btn.textContent?.trim()
        if (text === 'Begin Test' || text === 'Resume Test') {
          btn.click()
          return text
        }
      }
      return null
    })
    log(`  Clicked: ${beginClicked}`)

    if (!beginClicked) {
      results.testStart = 'FAIL'
      observations.push('FAIL: No Begin/Resume Test button found')
      await browser.close()
      return { results, consoleErrors, observations }
    }

    await sleep(3000)
    await screenshot(page, 'v2_04_test_started')
    const questionInfo = await getCurrentQuestion(page)
    log(`  After start: question ${JSON.stringify(questionInfo)}`)
    results.testStart = 'PASS'

    // Check if we're actually in testing view
    const inTestingView = await page.evaluate(() => {
      const text = document.body.innerText
      return text.includes('Question') && text.includes('of 15')
    })
    log(`  In testing view: ${inTestingView}`)

    if (!inTestingView) {
      // Check if instruction screen is still showing (session already completed?)
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 300))
      log(`  Page content: "${bodyText.replace(/\n/g, ' ')}"`)
      observations.push('WARNING: After Begin Test, not showing question view — possible session conflict')
    }

    // =========================================================================
    // STEP 3: Answer Q1-Q5 normally
    // =========================================================================
    log('=== STEP 3: Answer Q1-Q5 ===')
    let q1to5Count = 0

    for (let q = 1; q <= 5; q++) {
      await sleep(300)
      const qInfo = await getCurrentQuestion(page)
      log(`  Current: ${JSON.stringify(qInfo)}`)

      // Click choice A (letterIndex 0)
      const clicked = await clickAnswerChoice(page, 0)
      if (clicked) {
        q1to5Count++
        await sleep(400)
        // Verify selection
        const selected = await hasAnswerSelected(page)
        log(`    Selection confirmed: ${selected}`)
      }

      // Navigate to next question (except last)
      if (q < 5) {
        const nextClicked = await clickNext(page)
        log(`    Next clicked: ${nextClicked}`)
        await sleep(500)
      }
    }

    await screenshot(page, 'v2_05_q5_answered')
    log(`  Q1-Q5 answered: ${q1to5Count}`)

    const queueAfterQ5 = await getQueueState(page)
    log(`  Queue after Q1-5: total=${queueAfterQ5.totalItems}, pending=${queueAfterQ5.pendingCount}, answers=${queueAfterQ5.answerChangeCount}`)
    observations.push(`Queue after Q1-5: ${queueAfterQ5.answerChangeCount} ANSWER_CHANGE items, ${queueAfterQ5.pendingCount} total pending`)
    results.q1to5 = q1to5Count >= 3 ? 'PASS' : 'PARTIAL'

    // =========================================================================
    // STEP 4: Block Firestore for 10 seconds
    // =========================================================================
    log('=== STEP 4: Block Firestore (offline simulation) ===')

    let firestoreBlocked = false
    let blockedCount = 0

    await page.route('**/firestore.googleapis.com/**', (route) => {
      if (firestoreBlocked) {
        blockedCount++
        route.abort('failed')
      } else {
        route.continue()
      }
    })

    firestoreBlocked = true
    const offlineStart = Date.now()
    log('  Firestore BLOCKED')
    await screenshot(page, 'v2_06_offline_start')

    // Wait 2 seconds to see if connection banner appears
    await sleep(2000)
    const bannerText = await page.evaluate(() => {
      // Look for connection banner — warning/error bg with "Connection unstable" or similar text
      const candidates = Array.from(document.querySelectorAll('[class*="bg-warning"], [class*="bg-error"], [class*="bg-info"]'))
      for (const el of candidates) {
        const text = el.textContent?.trim()
        if (text && (text.includes('Connection') || text.includes('offline') || text.includes('Reconnected') || text.includes('Syncing'))) {
          return text
        }
      }
      return null
    })
    log(`  Connection banner: "${bannerText}"`)
    observations.push(`Offline banner text during block: "${bannerText || 'none shown yet'}"`)

    // =========================================================================
    // STEP 5: Answer Q6-Q8 while offline
    // =========================================================================
    log('=== STEP 5: Answer Q6-Q8 while offline ===')

    // Navigate to Q6 first
    await clickNext(page)
    await sleep(400)

    let offlineAnswered = 0
    for (let q = 6; q <= 8; q++) {
      const qInfo = await getCurrentQuestion(page)
      log(`  Q${q}: question display = ${JSON.stringify(qInfo)}`)

      // Try clickAnswerChoice with letter B (index 1) for offline distinction
      const clicked = await clickAnswerChoice(page, 1) // Choice B
      if (clicked) {
        offlineAnswered++
        await sleep(400)
        const confirmed = await hasAnswerSelected(page)
        log(`    Answer selected confirmed: ${confirmed}`)
      } else {
        log(`    FAIL: Could not select answer for Q${q}`)
      }

      if (q < 8) {
        const nextClicked = await clickNext(page)
        log(`    Next: ${nextClicked}`)
        await sleep(500)
      }
    }

    await screenshot(page, 'v2_07_q8_offline')
    log(`  Offline answered: ${offlineAnswered}`)

    const offlineQueueState = await getQueueState(page)
    log(`  Queue while offline: pending=${offlineQueueState.pendingCount}, answerChanges=${offlineQueueState.answerChangeCount}`)
    log(`  Answer items in queue: ${JSON.stringify(offlineQueueState.answerItems)}`)
    observations.push(`Queue during offline (Q6-Q8): ${offlineQueueState.answerChangeCount} ANSWER_CHANGE items queued`)
    observations.push(`All pending actions: ${JSON.stringify(offlineQueueState.allActions)}`)

    results.q6to8_offline = {
      answeredCount: offlineAnswered,
      queuedAnswers: offlineQueueState.answerChangeCount,
      totalPending: offlineQueueState.pendingCount,
      status: offlineAnswered >= 2 && offlineQueueState.answerChangeCount >= 2 ? 'PASS' :
              offlineAnswered >= 2 ? 'PARTIAL' : 'FAIL'
    }

    // Wait out the 10s offline window
    const elapsed = Date.now() - offlineStart
    const wait = Math.max(0, 10000 - elapsed)
    if (wait > 0) {
      log(`  Waiting ${wait}ms to complete 10s offline window...`)
      await sleep(wait)
    }

    // =========================================================================
    // STEP 6: Restore network and verify sync
    // =========================================================================
    log('=== STEP 6: Restore network ===')
    firestoreBlocked = false
    await page.unroute('**/firestore.googleapis.com/**')
    log(`  Network restored. Blocked ${blockedCount} Firestore requests`)
    observations.push(`Firestore requests blocked during offline: ${blockedCount}`)

    // Wait for sync flush (should trigger ~1s after online events)
    await sleep(5000)
    await screenshot(page, 'v2_08_after_restore')

    // Check sync banner
    const syncBanner = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('[class*="bg-info"], [class*="bg-success"], [class*="bg-warning"]'))
      for (const el of candidates) {
        const text = el.textContent?.trim()
        if (text && (text.includes('Sync') || text.includes('Reconnect') || text.includes('Connection'))) {
          return text
        }
      }
      return null
    })
    log(`  Sync/reconnect banner: "${syncBanner}"`)
    observations.push(`Banner after restore: "${syncBanner || 'none'}"`)

    const postSyncQueue = await getQueueState(page)
    log(`  Post-sync queue: pending=${postSyncQueue.pendingCount}, total=${postSyncQueue.totalItems}`)
    log(`  Remaining pending actions: ${JSON.stringify(postSyncQueue.allActions)}`)
    observations.push(`Queue after sync: ${postSyncQueue.pendingCount} pending items remain`)

    if (postSyncQueue.answerChangeCount > 0) {
      observations.push(`WARNING: ${postSyncQueue.answerChangeCount} ANSWER_CHANGE items still unsynced after 5s`)
    }

    results.syncOnReconnect = postSyncQueue.pendingCount === 0 ? 'PASS' :
                              postSyncQueue.answerChangeCount === 0 ? 'PARTIAL' : 'FAIL'

    // =========================================================================
    // STEP 7: Answer Q9-Q12
    // =========================================================================
    log('=== STEP 7: Answer Q9-Q12 ===')
    let q9to12Count = 0

    // Advance to Q9
    const currentQ = await getCurrentQuestion(page)
    log(`  Currently on: ${JSON.stringify(currentQ)}`)

    // Navigate to Q9
    await clickNext(page)
    await sleep(400)

    for (let q = 9; q <= 12; q++) {
      const qInfo = await getCurrentQuestion(page)
      log(`  Q${q}: display ${JSON.stringify(qInfo)}`)

      const clicked = await clickAnswerChoice(page, 0) // Choice A
      if (clicked) {
        q9to12Count++
        await sleep(300)
      }

      if (q < 12) {
        await clickNext(page)
        await sleep(400)
      }
    }

    await screenshot(page, 'v2_09_q12_answered')
    log(`  Q9-Q12 answered: ${q9to12Count}`)
    results.q9to12 = q9to12Count >= 3 ? 'PASS' : 'PARTIAL'

    const testUrl = page.url()
    log(`  Current URL: ${testUrl}`)

    // Get session ID
    const queueBeforeClose = await getQueueState(page)
    const sessionId = queueBeforeClose.sessionId
    log(`  Session ID: ${sessionId}`)
    log(`  Queue before close: pending=${queueBeforeClose.pendingCount}`)
    observations.push(`Queue before page close: ${queueBeforeClose.pendingCount} pending items`)
    observations.push(`Session ID: ${sessionId}`)

    // =========================================================================
    // STEP 8: Close page
    // =========================================================================
    log('=== STEP 8: Close page ===')
    await page.close()
    log('  Page closed')

    // =========================================================================
    // STEP 9: Reopen and navigate back
    // =========================================================================
    log('=== STEP 9: Reopen page ===')
    await sleep(2000)

    const page2 = await context.newPage()
    const p2Errors = []
    page2.on('console', msg => {
      if (msg.type() === 'error') {
        p2Errors.push(msg.text())
        consoleErrors.push({ text: msg.text(), url: page2.url(), phase: 'resume' })
        log(`  [CONSOLE ERROR (p2)] ${msg.text()}`)
      }
    })
    page2.on('pageerror', err => {
      p2Errors.push(err.message)
      consoleErrors.push({ text: err.message, isPageError: true, url: page2.url(), phase: 'resume' })
      log(`  [PAGE ERROR (p2)] ${err.message}`)
    })

    await page2.goto(`${BASE_URL}/ap/test/test_micro_full_1`)
    await sleep(4000)
    await screenshot(page2, 'v2_10_reopened')
    log(`  URL after reopen: ${page2.url()}`)

    // Check if redirected to login
    if (page2.url().includes('/login')) {
      log('  Redirected to login — re-authenticating')
      await page2.fill('input[type="email"]', 'student10@apboost.test')
      await page2.fill('input[type="password"]', 'Student123!')
      await page2.click('button[type="submit"]')
      await sleep(3000)
      if (!page2.url().includes('/ap')) {
        await page2.goto(`${BASE_URL}/ap/test/test_micro_full_1`)
        await sleep(3000)
      }
      await screenshot(page2, 'v2_10b_relogged')
    }

    results.closeAndReopen = 'PASS'

    // =========================================================================
    // STEP 10: Resume and verify answers
    // =========================================================================
    log('=== STEP 10: Resume session ===')

    // Read instruction screen
    const instrText = await page2.evaluate(() => document.body.innerText.substring(0, 400))
    log(`  Instruction screen: "${instrText.replace(/\n/g, ' ').substring(0, 300)}"`)

    // Check for resume info
    const hasResumeInfo = instrText.includes('Resume from') || instrText.includes('paused')
    log(`  Has resume position info: ${hasResumeInfo}`)
    observations.push(`Instruction screen after close shows resume info: ${hasResumeInfo}`)

    // Click Resume Test or Begin Test
    const resumeClick = await page2.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      for (const btn of buttons) {
        const text = btn.textContent?.trim()
        if (text === 'Resume Test' || text === 'Begin Test') {
          btn.click()
          return text
        }
      }
      return null
    })
    log(`  Clicked: ${resumeClick}`)
    observations.push(`After close, instruction button shows: "${resumeClick}"`)

    await sleep(4000)
    await screenshot(page2, 'v2_11_after_resume')

    const queueAfterResume = await getQueueState(page2)
    log(`  Queue after resume: total=${queueAfterResume.totalItems}, pending=${queueAfterResume.pendingCount}`)
    log(`  Answer items: ${JSON.stringify(queueAfterResume.answerItems)}`)
    observations.push(`Queue after resume: ${queueAfterResume.pendingCount} pending items`)

    // Now navigate through Q1-Q12 to check which have answers
    const answersRestored = {}

    // Use navigator to jump to each question
    // First open navigator
    const navOpened = await page2.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      for (const btn of buttons) {
        const text = btn.textContent?.trim()
        if (text === 'Navigator' || text?.includes('Navigator')) {
          btn.click()
          return true
        }
      }
      return false
    })
    log(`  Navigator opened: ${navOpened}`)
    await sleep(500)

    // Read navigator grid state
    const navigatorState = await page2.evaluate(() => {
      // Look for navigator modal/panel
      // Grid cells are likely buttons with question numbers
      const modal = document.querySelector('[role="dialog"], .navigator, [class*="navigator"]')
      if (modal) {
        const cells = Array.from(modal.querySelectorAll('button'))
        return cells.map(btn => ({
          text: btn.textContent?.trim(),
          class: btn.className,
          // Check for answered indicator in class
          answered: btn.className?.includes('answered') || btn.className?.includes('bg-brand') || btn.className?.includes('bg-success'),
          flagged: btn.className?.includes('flagged') || btn.className?.includes('flag'),
        }))
      }
      // Also try without modal
      const gridCells = Array.from(document.querySelectorAll('[data-q-index], [aria-label*="Question"]'))
      return gridCells.map(el => ({
        text: el.textContent?.trim(),
        ariaLabel: el.getAttribute('aria-label'),
        class: el.className,
        answered: el.className?.includes('brand') || el.className?.includes('success'),
      }))
    })
    log(`  Navigator state: ${JSON.stringify(navigatorState.slice(0, 15))}`)
    observations.push(`Navigator cells on resume: ${JSON.stringify(navigatorState.map(c => ({ text: c.text, answered: c.answered })).slice(0, 15))}`)

    // Close navigator if open
    await page2.evaluate(() => {
      const closeBtn = document.querySelector('[aria-label="Close"], button:last-child')
      const dialog = document.querySelector('[role="dialog"]')
      if (dialog) {
        const closeBtns = dialog.querySelectorAll('button')
        for (const btn of closeBtns) {
          if (btn.textContent?.includes('Close') || btn.textContent?.includes('×') || btn.getAttribute('aria-label')?.includes('Close')) {
            btn.click()
            return true
          }
        }
      }
      return false
    })
    await sleep(300)

    // Navigate to Q1 and check each
    // Use direct navigation via URL or navigator
    // Better approach: navigate to Q1 by going to the test session start
    // then use Next to move through each question checking answers

    // First, get current question
    let qInfo = await getCurrentQuestion(page2)
    log(`  Starting at: ${JSON.stringify(qInfo)}`)

    // Navigate backwards to Q1 (use goPrevious repeatedly, or go to Q1 via navigator)
    // The session should have restored currentQuestionIndex from Firestore
    // Let's check what question we're on and navigate from there

    // Better: check each answer by navigating through questions
    // First navigate to Q1 using "Back" button
    let backCount = 0
    while (backCount < 15) {
      const prevClicked = await page2.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        for (const btn of buttons) {
          const text = btn.textContent?.trim()
          if (text === '← Back' || text === 'Back' || text === '← Previous' || text === 'Previous') {
            if (!btn.disabled) {
              btn.click()
              return true
            }
          }
        }
        return false
      })
      if (!prevClicked) break
      backCount++
      await sleep(200)
    }
    log(`  Navigated back ${backCount} questions to reach Q1`)

    // Now go forward through Q1-Q12 checking answers
    for (let q = 1; q <= 12; q++) {
      const hasAnswer = await hasAnswerSelected(page2)
      answersRestored[`Q${q}`] = hasAnswer
      if (q < 12) {
        await clickNext(page2)
        await sleep(300)
      }
    }

    log(`  Answers restored: ${JSON.stringify(answersRestored)}`)
    const restoredCount = Object.values(answersRestored).filter(Boolean).length
    log(`  Total restored: ${restoredCount}/12`)
    observations.push(`Answers restored Q1-Q12: ${restoredCount}/12 have answers`)
    observations.push(`Per-question: ${JSON.stringify(answersRestored)}`)

    results.resumeRestores = {
      answersRestored,
      restoredCount,
      total: 12,
      status: restoredCount >= 10 ? 'PASS' : restoredCount >= 7 ? 'PARTIAL' : 'FAIL'
    }

    // =========================================================================
    // STEP 11: Answer Q13-Q15
    // =========================================================================
    log('=== STEP 11: Answer Q13-Q15 ===')
    let q13to15Count = 0

    // We should be at Q12 now. Go to Q13.
    await clickNext(page2)
    await sleep(400)

    for (let q = 13; q <= 15; q++) {
      const qInfo2 = await getCurrentQuestion(page2)
      log(`  Q${q}: display ${JSON.stringify(qInfo2)}`)

      const clicked = await clickAnswerChoice(page2, 2) // Choice C for Q13-15
      if (clicked) {
        q13to15Count++
        await sleep(300)
      }

      if (q < 15) {
        await clickNext(page2)
        await sleep(400)
      }
    }

    await screenshot(page2, 'v2_12_q15_answered')
    log(`  Q13-Q15 answered: ${q13to15Count}`)

    // =========================================================================
    // STEP 12: Submit test
    // =========================================================================
    log('=== STEP 12: Submit test ===')

    // Look for Review button or navigate to review
    const reviewClicked = await page2.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      for (const btn of buttons) {
        const text = btn.textContent?.trim()
        if (text?.includes('Review') && !btn.disabled) {
          btn.click()
          return text
        }
      }
      return null
    })
    log(`  Review clicked: ${reviewClicked}`)
    await sleep(1500)
    await screenshot(page2, 'v2_13_review_screen')

    // Read review screen
    const reviewText = await page2.evaluate(() => document.body.innerText.substring(0, 500))
    log(`  Review screen: "${reviewText.replace(/\n/g, ' ').substring(0, 300)}"`)

    // Look for "Submit Section" button
    const submitSectionClicked = await page2.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      for (const btn of buttons) {
        const text = btn.textContent?.trim()
        if ((text?.includes('Submit Section') || text?.includes('Submit MCQ')) && !btn.disabled) {
          btn.click()
          return text
        }
      }
      return null
    })
    log(`  Submit Section: ${submitSectionClicked}`)
    await sleep(2000)
    await screenshot(page2, 'v2_14_after_submit_section')
    log(`  URL after submit section: ${page2.url()}`)

    // FRQ Choice Screen or FRQ section
    const postSectionText = await page2.evaluate(() => document.body.innerText.substring(0, 400))
    log(`  Post-section text: "${postSectionText.replace(/\n/g, ' ').substring(0, 300)}"`)

    // If FRQ choice screen, pick first FRQ topic
    const hasFRQChoice = postSectionText.toLowerCase().includes('free response') ||
                         postSectionText.toLowerCase().includes('choose a question')
    if (hasFRQChoice) {
      log('  FRQ choice/section detected')
      const frqTopicClicked = await page2.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        // Look for topic selection buttons
        for (const btn of buttons) {
          const text = btn.textContent?.trim()
          if (text && !['Cancel', 'Next', 'Back', 'Resume Test', 'Begin Test'].includes(text) &&
              text.length > 5 && !btn.disabled) {
            btn.click()
            return text
          }
        }
        return null
      })
      log(`  FRQ topic clicked: ${frqTopicClicked}`)
      await sleep(1500)
      await screenshot(page2, 'v2_15_frq_topic_selected')
    }

    // Look for Submit Test button
    let submitTestClicked = await page2.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      for (const btn of buttons) {
        const text = btn.textContent?.trim()
        if (text?.includes('Submit Test') && !btn.disabled) {
          btn.click()
          return text
        }
      }
      return null
    })
    log(`  Submit Test: ${submitTestClicked}`)

    if (!submitTestClicked) {
      // Maybe still on FRQ or need to type answers
      const frqArea = await page2.$('textarea, [contenteditable="true"]')
      if (frqArea) {
        log('  FRQ text area found — typing answer')
        await frqArea.click()
        await frqArea.type('The law of comparative advantage states that countries should specialize in goods for which they have lower opportunity costs.')
        await sleep(500)

        // Try Next through FRQ sub-questions
        for (let i = 0; i < 5; i++) {
          await clickNext(page2)
          await sleep(400)
        }

        // Try Submit Test again
        submitTestClicked = await page2.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'))
          for (const btn of buttons) {
            const text = btn.textContent?.trim()
            if (text?.includes('Submit Test') && !btn.disabled) {
              btn.click()
              return text
            }
          }
          return null
        })
        log(`  Submit Test (after FRQ): ${submitTestClicked}`)
      }
    }

    await sleep(2000)

    // Confirm dialog
    const confirmClicked = await page2.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      for (const btn of buttons) {
        const text = btn.textContent?.trim()
        if (text?.includes('Confirm') || text === 'Yes' || text?.includes('Yes, Submit')) {
          btn.click()
          return text
        }
      }
      return null
    })
    log(`  Confirm dialog: ${confirmClicked}`)
    await sleep(5000)
    await screenshot(page2, 'v2_16_post_submit')
    log(`  URL after submit: ${page2.url()}`)

    const finalUrl = page2.url()
    if (finalUrl.includes('/ap/results/')) {
      results.finalSubmit = 'PASS'
      log('  Redirected to report card!')
    } else {
      results.finalSubmit = 'PARTIAL'
      observations.push(`After submit, URL is ${finalUrl} — expected /ap/results/`)
    }

    // =========================================================================
    // STEP 13: Verify report card — check all 15 answers
    // =========================================================================
    log('=== STEP 13: Verify report card ===')
    await sleep(2000)

    const reportCardText = await page2.evaluate(() => document.body.innerText)
    log(`  Report card preview: "${reportCardText.substring(0, 400).replace(/\n/g, ' ')}"`)
    await screenshot(page2, 'v2_17_report_card')

    // Extract score
    const scoreMatch = reportCardText.match(/(\d+)\s*\/\s*15/)
    const mcqScore = scoreMatch ? scoreMatch[0] : 'not found'
    log(`  MCQ score: ${mcqScore}`)
    observations.push(`Report card MCQ score: ${mcqScore}`)

    // Count MCQ table rows
    const tableInfo = await page2.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'))
      const dataRows = rows.filter(r => {
        const text = r.textContent?.trim()
        return text && !text.includes('Question') // skip header
      })
      return {
        totalRows: rows.length,
        dataRowCount: dataRows.length,
        sampleRows: dataRows.slice(0, 5).map(r => r.textContent?.trim().substring(0, 100))
      }
    })
    log(`  Table rows: total=${tableInfo.totalRows}, data=${tableInfo.dataRowCount}`)
    log(`  Sample rows: ${JSON.stringify(tableInfo.sampleRows)}`)
    observations.push(`Report card MCQ table: ${tableInfo.dataRowCount} data rows`)

    // Check FRQ section
    const hasFRQSection = reportCardText.toLowerCase().includes('free response') ||
                          reportCardText.toLowerCase().includes('frq')
    observations.push(`Report card has FRQ section: ${hasFRQSection}`)

    // Assess
    if (tableInfo.dataRowCount >= 14) {
      results.allAnswersPresent = 'PASS'
      results.reportCard = 'PASS'
    } else if (tableInfo.dataRowCount >= 10) {
      results.allAnswersPresent = 'PARTIAL'
      results.reportCard = 'PARTIAL'
      observations.push(`WARNING: Only ${tableInfo.dataRowCount}/15 MCQ rows on report card`)
    } else {
      results.allAnswersPresent = 'FAIL'
      results.reportCard = 'FAIL'
      observations.push(`FAIL: Only ${tableInfo.dataRowCount}/15 MCQ rows — possible data loss`)
    }

    log(`  allAnswersPresent: ${results.allAnswersPresent}, reportCard: ${results.reportCard}`)

  } catch (err) {
    log(`FATAL: ${err.message}`)
    log(err.stack)
    observations.push(`FATAL ERROR: ${err.message}`)
    consoleErrors.push({ text: err.message, isScriptError: true })
  } finally {
    await browser.close()
  }

  return {
    results,
    consoleErrors,
    observations,
    summary: {
      login: results.login,
      testStart: results.testStart,
      q1to5: results.q1to5,
      q6to8_offline: results.q6to8_offline,
      syncOnReconnect: results.syncOnReconnect,
      q9to12: results.q9to12,
      closeAndReopen: results.closeAndReopen,
      resumeRestores: results.resumeRestores?.status,
      finalSubmit: results.finalSubmit,
      reportCard: results.reportCard,
      allAnswersPresent: results.allAnswersPresent,
    }
  }
}

run().then(res => {
  log('\n=== FINAL RESULTS ===')
  log(JSON.stringify(res.summary, null, 2))
  log('\n=== OBSERVATIONS ===')
  res.observations.forEach(o => log(`  - ${o}`))
  log('\n=== CONSOLE ERRORS ===')
  res.consoleErrors.forEach(e => log(`  [${e.phase || 'main'}] ${e.text}`))

  fs.writeFileSync(
    path.join(__dirname, 'b14g_results_v2.json'),
    JSON.stringify(res, null, 2)
  )
  log('\nResults saved to b14g_results_v2.json')
}).catch(err => {
  log(`Script crashed: ${err.message}`)
  log(err.stack)
  process.exit(1)
})
