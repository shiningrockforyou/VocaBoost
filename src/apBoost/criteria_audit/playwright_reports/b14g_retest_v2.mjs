/**
 * B14G Retest V2 — Verify FIX-1, FIX-2, FIX-10
 * Uses student10@apboost.test / Student123!
 *
 * Key corrections from V1:
 * - MCQ choices are <button> elements (not radio inputs)
 * - Connection banner text: "Connection unstable", "Reconnected", "Syncing your progress..."
 * - Need to start a FRESH test session (clear existing one)
 * - Track specific answer selections for FIX-2 verification
 */

import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCREENSHOTS_DIR = join(__dirname, 'screenshots_B14G_retest_v2')
const BASE_URL = 'http://localhost:5173'

try { mkdirSync(SCREENSHOTS_DIR, { recursive: true }) } catch {}

const results = {
  loginStatus: 'UNTESTED',
  fix1: { status: 'UNTESTED', evidence: '', notes: [] },
  fix2: { status: 'UNTESTED', evidence: '', notes: [] },
  fix10: { status: 'UNTESTED', evidence: '', notes: [] },
  codeStartsWith: { status: 'UNTESTED', notes: [] },
  tdzErrors: { found: false, messages: [] },
  consoleErrors: [],
  timeline: [],
}

let screenshotCount = 0

async function ss(page, label) {
  const filename = `${String(++screenshotCount).padStart(2, '0')}_${label}.png`
  await page.screenshot({ path: join(SCREENSHOTS_DIR, filename), fullPage: true })
  console.log(`[SS] ${filename}`)
  results.timeline.push({ event: `screenshot:${label}`, filename })
  return filename
}

function ts(label) {
  const t = new Date().toISOString()
  console.log(`\n[${t}] ${label}`)
  results.timeline.push({ event: label, time: t })
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * Read ALL items from IndexedDB (not filtered by session)
 */
async function getAllIDBItems(page) {
  return await page.evaluate(async () => {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('ap_boost_queue', 1)
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('actions')) {
            return resolve([])
          }
          const tx = db.transaction('actions', 'readonly')
          const store = tx.objectStore('actions')
          const allReq = store.getAll()
          allReq.onsuccess = () => resolve(allReq.result || [])
          allReq.onerror = () => resolve([])
        }
        req.onerror = () => resolve([])
        req.onblocked = () => resolve([])
      } catch (e) {
        resolve([])
      }
    })
  })
}

/**
 * Clear ALL IDB data for a clean start
 */
async function clearIDB(page) {
  return await page.evaluate(async () => {
    return new Promise((resolve) => {
      const req = indexedDB.open('ap_boost_queue', 1)
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('actions')) return resolve(0)
        const tx = db.transaction('actions', 'readwrite')
        const store = tx.objectStore('actions')
        const clearReq = store.clear()
        clearReq.onsuccess = () => resolve(clearReq.result)
        clearReq.onerror = () => resolve(-1)
        tx.oncomplete = () => resolve('cleared')
      }
      req.onerror = () => resolve(-2)
    })
  })
}

/**
 * Get current connection status from the banner
 */
async function getConnectionStatus(page) {
  return await page.evaluate(() => {
    const body = document.body.textContent
    return {
      isUnstable: body.includes('Connection unstable'),
      isReconnected: body.includes('Reconnected'),
      isSyncing: body.includes('Syncing your progress'),
      isExtendedOffline: body.includes('offline for over 5 minutes'),
      isStorageFull: body.includes('Local storage is full'),
      bannerFound: body.includes('Connection unstable') || body.includes('Reconnected') || body.includes('Syncing'),
    }
  })
}

/**
 * Click an MCQ answer choice by letter (A, B, C, D)
 */
async function clickChoice(page, letter) {
  // The answer choices have a letter badge inside each button
  // The button contains a <span> with the letter, surrounded by choice text
  const clicked = await page.evaluate((ltr) => {
    // Find buttons that contain the choice letter
    const buttons = Array.from(document.querySelectorAll('button[type="button"]'))
    for (const btn of buttons) {
      const spans = btn.querySelectorAll('span')
      for (const span of spans) {
        if (span.textContent.trim() === ltr && span.className.includes('rounded-full')) {
          btn.click()
          return { success: true, buttonText: btn.textContent.trim().substring(0, 50) }
        }
      }
    }
    return { success: false, available: buttons.map(b => b.textContent.trim().substring(0, 30)) }
  }, letter)
  return clicked
}

/**
 * Check if any answer choice is selected on current question
 */
async function getSelectedAnswer(page) {
  return await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button[type="button"]'))
    for (const btn of buttons) {
      // Selected buttons have bg-brand-primary class
      if (btn.className.includes('bg-brand-primary')) {
        const spans = btn.querySelectorAll('span')
        for (const span of spans) {
          if (span.className.includes('rounded-full') && span.textContent.trim().length === 1) {
            return span.textContent.trim()
          }
        }
        return 'selected-but-unknown'
      }
    }
    return null
  })
}

/**
 * Get current question info from page
 */
async function getQuestionInfo(page) {
  return await page.evaluate(() => {
    const body = document.body.textContent
    const qMatch = body.match(/Question (\d+) of (\d+)/)
    const timerMatch = body.match(/(\d+:\d+)/)
    return {
      current: qMatch ? parseInt(qMatch[1]) : null,
      total: qMatch ? parseInt(qMatch[2]) : null,
      timer: timerMatch ? timerMatch[1] : null,
      body: body.substring(0, 200),
    }
  })
}

/**
 * Click the Next button
 */
async function clickNext(page) {
  try {
    // Try various Next button patterns
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      for (const btn of buttons) {
        const txt = btn.textContent.trim()
        if (txt === 'Next →' || txt === 'Next' || txt.includes('Next →')) {
          btn.click()
          return { success: true, text: txt }
        }
      }
      // Also try "Review →" button (last question)
      for (const btn of buttons) {
        const txt = btn.textContent.trim()
        if (txt.includes('Review →') || txt === 'Review') {
          btn.click()
          return { success: true, text: txt, isReview: true }
        }
      }
      return { success: false, available: buttons.map(b => b.textContent.trim()).filter(t => t.length < 50) }
    })
    return clicked
  } catch (e) {
    return { success: false, error: e.message }
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const consoleMessages = []

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    })
    const page = await context.newPage()

    // Capture all console messages
    page.on('console', msg => {
      const text = msg.text()
      const entry = { type: msg.type(), text, url: page.url() }
      consoleMessages.push(entry)

      if (msg.type() === 'error') {
        results.consoleErrors.push(entry)

        // Check for TDZ errors
        if (text.includes('Cannot access') || text.includes('before initialization') || text.includes('ReferenceError')) {
          results.tdzErrors.found = true
          results.tdzErrors.messages.push(text)
        }
      }
    })
    page.on('pageerror', err => {
      const entry = { type: 'pageerror', text: err.message, url: page.url() }
      results.consoleErrors.push(entry)
      console.log(`[PAGE ERROR] ${err.message}`)
    })

    // ==============================================================
    // STEP 1: Login
    // ==============================================================
    ts('STEP 1: LOGIN')
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('input[type="email"]', { timeout: 10000 })
    await page.fill('input[type="email"]', 'student10@apboost.test')
    await page.fill('input[type="password"]', 'Student123!')
    await page.click('button[type="submit"]')
    await page.waitForNavigation({ timeout: 15000 })
    await sleep(1500)

    const loginUrl = page.url()
    console.log(`Login redirect: ${loginUrl}`)

    if (loginUrl.includes('/login')) {
      results.loginStatus = 'FAIL'
      await ss(page, 'login_failed')
      throw new Error('Login failed — still on login page')
    }

    // Check if we landed on AP or regular dashboard
    if (loginUrl === `${BASE_URL}/` || loginUrl.includes('vocaboost') || !loginUrl.includes('/ap')) {
      console.log('WARNING: Redirected to non-AP dashboard — navigating to /ap')
      await page.goto(`${BASE_URL}/ap`, { waitUntil: 'domcontentloaded' })
      await sleep(1500)
    }

    results.loginStatus = 'PASS'
    await ss(page, '01_after_login')

    // ==============================================================
    // STEP 2: Navigate to test and START it (clean session)
    // ==============================================================
    ts('STEP 2: NAVIGATE TO TEST')

    await page.goto(`${BASE_URL}/ap/test/test_micro_full_1`, { waitUntil: 'domcontentloaded' })
    await sleep(2000)

    await ss(page, '02_test_page_initial')

    // Check what's on the page
    const initialState = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      return {
        buttons: btns.map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 80),
        body: document.body.textContent.substring(0, 500)
      }
    })
    console.log('Initial page buttons:', initialState.buttons)

    // If there's an existing in-progress session at Q6, we're already in the test
    // If instruction screen is showing, click Begin/Resume
    const inInstructionScreen = initialState.buttons.some(b => b.includes('Begin') || b.includes('Resume'))
    if (inInstructionScreen) {
      const btnText = initialState.buttons.find(b => b.includes('Resume') || b.includes('Begin'))
      console.log(`Clicking: "${btnText}"`)
      await page.evaluate((txt) => {
        const btns = Array.from(document.querySelectorAll('button'))
        const btn = btns.find(b => b.textContent.trim().includes(txt.split(' ')[0]))
        if (btn) btn.click()
      }, btnText)
      await sleep(2000)
    }

    await ss(page, '03_test_started')

    // Get current question position
    const startPos = await getQuestionInfo(page)
    console.log('Starting position:', startPos)

    // ==============================================================
    // STEP 3: Clear IDB and establish clean baseline
    // ==============================================================
    ts('STEP 3: CLEAR IDB FOR CLEAN TEST')
    const cleared = await clearIDB(page)
    console.log(`IDB cleared: ${cleared}`)

    const idbAfterClear = await getAllIDBItems(page)
    console.log(`IDB count after clear: ${idbAfterClear.length}`)

    // ==============================================================
    // STEP 4: Answer several questions online to establish a session
    // ==============================================================
    ts('STEP 4: ANSWER QUESTIONS ONLINE (Q1-Q5)')

    // Navigate to Q1 first (use navigator or go back)
    // Actually, let's just answer from current position
    const answeredQuestions = {}
    let currentQ = startPos.current || 1

    // Answer 5 questions online
    for (let i = 0; i < 5; i++) {
      await sleep(800)

      const qi = await getQuestionInfo(page)
      console.log(`Current Q: ${qi.current} of ${qi.total}`)

      // Pick answer A for online questions (distinguishable)
      const result = await clickChoice(page, 'A')
      if (result.success) {
        answeredQuestions[qi.current] = 'A'
        console.log(`Answered Q${qi.current} = A`)
      } else {
        console.log(`Could not click choice A: ${JSON.stringify(result)}`)
        // Try B
        const r2 = await clickChoice(page, 'B')
        if (r2.success) {
          answeredQuestions[qi.current] = 'B'
          console.log(`Answered Q${qi.current} = B (fallback)`)
        }
      }
      await sleep(500)

      // Click next
      const nextResult = await clickNext(page)
      console.log(`Next: ${JSON.stringify(nextResult)}`)
      await sleep(600)
    }

    console.log('Online answers:', answeredQuestions)
    await ss(page, '04_after_online_answers')

    // Check IDB after online answering
    const idbAfterOnline = await getAllIDBItems(page)
    const pendingAfterOnline = idbAfterOnline.filter(i => i.status === 'PENDING')
    console.log(`IDB pending after online answering: ${pendingAfterOnline.length}`)

    // ==============================================================
    // STEP 5: GO OFFLINE
    // ==============================================================
    ts('STEP 5: GO OFFLINE')
    await context.setOffline(true)
    await sleep(500)

    const onlineCheck = await page.evaluate(() => navigator.onLine)
    console.log(`navigator.onLine after offline: ${onlineCheck}`)

    // Check IDB before offline answers
    const idbBeforeOfflineAnswers = await getAllIDBItems(page)
    console.log(`IDB total items before offline answering: ${idbBeforeOfflineAnswers.length}`)

    // Wait for online flush to complete or fail
    await sleep(2000)

    // Answer 3 more questions offline (Q6-Q8 equivalent)
    const offlineAnswers = {}
    for (let i = 0; i < 3; i++) {
      await sleep(800)

      const qi = await getQuestionInfo(page)
      console.log(`Offline Q: ${qi.current}`)

      // Pick answer C for offline questions (distinguishable from online)
      const result = await clickChoice(page, 'C')
      if (result.success) {
        offlineAnswers[qi.current] = 'C'
        console.log(`Answered Q${qi.current} = C (offline)`)
      } else {
        // Try D
        const r2 = await clickChoice(page, 'D')
        if (r2.success) {
          offlineAnswers[qi.current] = 'D'
          console.log(`Answered Q${qi.current} = D (offline fallback)`)
        } else {
          console.log(`Could not answer Q${qi.current} offline`)
        }
      }
      await sleep(400)

      const nextResult = await clickNext(page)
      console.log(`Next offline: ${JSON.stringify(nextResult)}`)
      await sleep(600)
    }

    console.log('Offline answers:', offlineAnswers)
    await ss(page, '05_after_offline_answers')

    // Check IDB during offline
    const idbDuringOffline = await getAllIDBItems(page)
    const pendingDuringOffline = idbDuringOffline.filter(i => i.status === 'PENDING')
    console.log(`IDB pending during offline: ${pendingDuringOffline.length}`)
    console.log('Offline IDB items:', JSON.stringify(idbDuringOffline.map(i => ({
      action: i.action, status: i.status,
      questionId: i.payload?.questionId, value: i.payload?.value
    })), null, 2))

    // Extract session ID
    let sessionId = null
    if (idbDuringOffline.length > 0) {
      sessionId = idbDuringOffline[0].sessionId
      console.log(`Session ID: ${sessionId}`)
    }

    // Record pre-restore state for FIX-1 evaluation
    results.fix1.notes.push(`Online answers: ${JSON.stringify(answeredQuestions)}`)
    results.fix1.notes.push(`Offline answers: ${JSON.stringify(offlineAnswers)}`)
    results.fix1.notes.push(`IDB pending before restore: ${pendingDuringOffline.length}`)

    if (pendingDuringOffline.length === 0) {
      results.fix1.notes.push('WARNING: No pending items during offline — queue may have been flushed already or answers not captured')
    }

    // ==============================================================
    // STEP 6: GO ONLINE — test FIX-1 (stale closure fix)
    // ==============================================================
    ts('STEP 6: RESTORE NETWORK (FIX-1 TEST)')

    await context.setOffline(false)
    const restoreTimestamp = Date.now()
    console.log(`Network restored at ${restoreTimestamp}`)

    // With FIX-1 applied: scheduleFlush(500) should fire via flushQueueRef
    // Expected: IDB pending count = 0 within 3-5 seconds
    await sleep(500)

    let fix1PassedAt = null

    for (let i = 1; i <= 10; i++) {
      await sleep(1000)

      const idbCurrent = await getAllIDBItems(page)
      const pending = idbCurrent.filter(i => i.status === 'PENDING')
      console.log(`${i}s after restore: ${pending.length} pending items`)

      if (pending.length === 0 && pendingDuringOffline.length > 0) {
        fix1PassedAt = i
        console.log(`ALL ITEMS FLUSHED after ${i}s!`)
        break
      } else if (pending.length === 0 && pendingDuringOffline.length === 0) {
        console.log('No items to flush — test inconclusive')
        break
      }
    }

    await ss(page, '06_after_restore_10s')

    const idbFinal = await getAllIDBItems(page)
    const pendingFinal = idbFinal.filter(i => i.status === 'PENDING')
    console.log(`Final pending after 10s: ${pendingFinal.length}`)

    if (pendingDuringOffline.length === 0) {
      results.fix1.status = 'INCONCLUSIVE'
      results.fix1.notes.push('IDB had no pending items during offline — could not verify flush behavior. MCQ answers may have been flushed immediately (online context)')
    } else if (fix1PassedAt !== null) {
      results.fix1.status = 'PASS'
      results.fix1.notes.push(`PASS: All ${pendingDuringOffline.length} offline items flushed within ${fix1PassedAt}s of network restore`)
    } else {
      results.fix1.status = 'FAIL'
      results.fix1.notes.push(`FAIL: ${pendingFinal.length}/${pendingDuringOffline.length} items still pending after 10s online`)
    }

    // Check TDZ errors
    const tdzMessages = consoleMessages.filter(m =>
      m.text.includes('Cannot access') || m.text.includes('before initialization')
    )
    if (tdzMessages.length === 0) {
      results.fix1.notes.push('No TDZ/ReferenceError errors — FIX-1 stale closure appears resolved')
    } else {
      results.fix1.notes.push(`TDZ errors found: ${tdzMessages.map(m => m.text).join('; ')}`)
    }

    // ==============================================================
    // STEP 7: FIX-2 TEST — Reload page, resume, check answers
    // ==============================================================
    ts('STEP 7: PAGE RELOAD (FIX-2 TEST)')

    // Take screenshot showing current state with answers
    await ss(page, '07_before_reload')

    const currentQBeforeReload = await getQuestionInfo(page)
    console.log(`Position before reload: Q${currentQBeforeReload.current}/${currentQBeforeReload.total}`)

    const totalAnswered = Object.keys(answeredQuestions).length + Object.keys(offlineAnswers).length
    console.log(`Expected total answered: ${totalAnswered}`)
    console.log(`Online: ${JSON.stringify(answeredQuestions)}`)
    console.log(`Offline: ${JSON.stringify(offlineAnswers)}`)

    // Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' })
    await sleep(2500)

    await ss(page, '08_after_reload')

    const postReloadState = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      return {
        buttons: btns.map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 80),
        body: document.body.textContent.substring(0, 500)
      }
    })
    console.log('Post-reload buttons:', postReloadState.buttons)

    // Click Resume
    const hasResume = postReloadState.buttons.some(b => b.includes('Resume'))
    if (hasResume) {
      console.log('Clicking Resume Test')
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'))
        const btn = btns.find(b => b.textContent.trim().includes('Resume'))
        if (btn) btn.click()
      })
      await sleep(2000)
    } else {
      console.log('No Resume button found — may already be in test or on different screen')
      // Try Begin Test
      const hasBegin = postReloadState.buttons.some(b => b.includes('Begin'))
      if (hasBegin) {
        console.log('Clicking Begin Test')
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'))
          const btn = btns.find(b => b.textContent.trim().includes('Begin'))
          if (btn) btn.click()
        })
        await sleep(2000)
      }
    }

    await ss(page, '09_after_resume')

    // Wait for "Syncing your progress" to clear
    await sleep(3000)

    // Now navigate to Q1 and check each question's answer state
    // Use the hamburger menu or navigator to jump to Q1
    ts('STEP 7b: CHECK ANSWER PRESERVATION')

    // First, navigate to the review screen to see the summary
    // Navigate through remaining questions to reach Review
    let reachedReview = false
    const reviewAnswerCount = { answered: null, total: null }

    // Try to click the navigator to jump to Q1
    const jumpResult = await page.evaluate(() => {
      // Look for navigator button
      const btns = Array.from(document.querySelectorAll('button'))
      const navBtn = btns.find(b => {
        const txt = b.textContent.trim()
        return txt.includes('▲') || txt.includes('▼') || txt.includes('Navigator') ||
               (b.title && b.title.includes('navigator'))
      })
      if (navBtn) {
        navBtn.click()
        return { clicked: true, text: navBtn.textContent.trim() }
      }

      // Try chevron up/down buttons
      const chevronBtns = btns.filter(b => {
        const rect = b.getBoundingClientRect()
        return rect.width > 0 && (b.textContent.trim() === '▲' || b.textContent.trim() === '▼')
      })
      if (chevronBtns.length > 0) {
        chevronBtns[0].click()
        return { clicked: true, text: 'chevron' }
      }

      return { clicked: false, available: btns.map(b => b.textContent.trim()).filter(t => t.length < 30) }
    })
    console.log('Navigator click:', jumpResult)
    await sleep(1000)

    await ss(page, '10_navigator_state')

    // Check answered state from navigator
    const navigatorData = await page.evaluate(() => {
      const body = document.body.textContent

      // Look for Answered count
      const answeredMatch = body.match(/Answered[:\s]+(\d+)\s*\/\s*(\d+)/i) ||
                            body.match(/(\d+)\s*\/\s*(\d+)\s*answered/i)

      // Get question states from navigator grid
      const allButtons = Array.from(document.querySelectorAll('button'))
      const qButtons = allButtons.filter(b => {
        const txt = b.textContent.trim()
        return /^\d+$/.test(txt) && parseInt(txt) <= 20
      })

      const buttonStates = qButtons.map(b => ({
        num: b.textContent.trim(),
        className: b.className,
        isAnswered: b.className.includes('bg-brand') || b.className.includes('answered') || b.className.includes('success'),
      }))

      return {
        answered: answeredMatch ? parseInt(answeredMatch[1]) : null,
        total: answeredMatch ? parseInt(answeredMatch[2]) : null,
        rawMatch: answeredMatch ? answeredMatch[0] : null,
        questionButtonStates: buttonStates,
        body: body.substring(0, 800),
      }
    })
    console.log('Navigator data:', JSON.stringify(navigatorData, null, 2))

    // Close navigator if open and navigate to review
    await page.evaluate(() => {
      // Close navigator
      const allBtns = Array.from(document.querySelectorAll('button'))
      const closeBtn = allBtns.find(b => {
        const txt = b.textContent.trim()
        return txt === '✕' || txt === 'Close' || txt.includes('close') ||
               (b.getAttribute('aria-label') || '').toLowerCase().includes('close')
      })
      if (closeBtn) closeBtn.click()
    })
    await sleep(500)

    // Navigate to review screen - answer any unanswered questions and click Next
    // Or directly look for Review button
    let clickedReview = false
    for (let navStep = 0; navStep < 20 && !clickedReview; navStep++) {
      const pageState = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'))
        const btnTexts = btns.map(b => b.textContent.trim()).filter(t => t.length < 80)
        const hasReview = btnTexts.some(t => t.includes('Review →') || t === 'Review')
        const hasNext = btnTexts.some(t => t.includes('Next →') || t === 'Next')
        return { hasReview, hasNext, btnTexts }
      })

      if (pageState.hasReview) {
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'))
          const btn = btns.find(b => b.textContent.trim().includes('Review →') || b.textContent.trim() === 'Review')
          if (btn) btn.click()
        })
        await sleep(1500)
        clickedReview = true
        console.log('Clicked Review button')
      } else if (pageState.hasNext) {
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'))
          const btn = btns.find(b => b.textContent.trim().includes('Next →') || b.textContent.trim() === 'Next')
          if (btn) btn.click()
        })
        await sleep(500)
      } else {
        console.log('No Next or Review button — stopping navigation')
        break
      }
    }

    await ss(page, '11_review_screen')

    // Extract data from review screen
    const reviewScreenData = await page.evaluate(() => {
      const body = document.body.textContent

      // Review screen patterns
      const answeredMatch = body.match(/Answered[:\s]+(\d+)\s*(?:\/|of)\s*(\d+)/i) ||
                            body.match(/(\d+)\s+(?:of|\/)\s+(\d+)\s+answered/i) ||
                            body.match(/(\d+)\/(\d+)/g)

      const flaggedMatch = body.match(/Flagged[:\s]+(\d+)/i)
      const unansweredMatch = body.match(/Unanswered[:\s]+(\d+)/i)

      return {
        rawBody: body.substring(0, 1000),
        hasAnsweredText: body.includes('Answered'),
        hasReviewContent: body.includes('Review') && body.includes('Submit'),
        answeredRaw: answeredMatch ? (Array.isArray(answeredMatch) ? answeredMatch[0] : answeredMatch[0]) : null,
        flagged: flaggedMatch ? parseInt(flaggedMatch[1]) : null,
        unanswered: unansweredMatch ? parseInt(unansweredMatch[1]) : null,
      }
    })
    console.log('Review screen data:', JSON.stringify(reviewScreenData, null, 2))

    await ss(page, '12_review_final')

    // Evaluate FIX-2
    // The key check: were our specific answers (online + offline) preserved?
    const hasQ1Answer = navigatorData.answered !== null
    const preservedAnswerCount = navigatorData.answered

    // Check if the answer count matches what we expected
    const expectedMin = Object.keys(answeredQuestions).length // at minimum, online answers should survive
    const expectedAll = totalAnswered // ideally all answers survive

    results.fix2.notes.push(`Expected answered online: ${Object.keys(answeredQuestions).length}`)
    results.fix2.notes.push(`Expected answered offline: ${Object.keys(offlineAnswers).length}`)
    results.fix2.notes.push(`Total expected: ${totalAnswered}`)
    results.fix2.notes.push(`Navigator showed: answered=${navigatorData.answered}/${navigatorData.total}`)
    results.fix2.notes.push(`Review screen raw: ${reviewScreenData.rawBody.substring(0, 200)}`)

    if (preservedAnswerCount === null) {
      results.fix2.status = 'PARTIAL'
      results.fix2.notes.push('Could not extract answered count — check screenshots manually')
    } else if (preservedAnswerCount >= expectedAll) {
      results.fix2.status = 'PASS'
      results.fix2.notes.push(`PASS: ${preservedAnswerCount} answers preserved (expected ${totalAnswered})`)
    } else if (preservedAnswerCount >= expectedMin) {
      results.fix2.status = 'PARTIAL'
      results.fix2.notes.push(`PARTIAL: ${preservedAnswerCount} answers preserved, expected ${totalAnswered} — some offline answers may be lost`)
    } else {
      results.fix2.status = 'FAIL'
      results.fix2.notes.push(`FAIL: Only ${preservedAnswerCount}/${totalAnswered} answers preserved`)
    }

    // ==============================================================
    // STEP 8: FIX-10 TEST — Heartbeat recovery timing
    // ==============================================================
    ts('STEP 8: FIX-10 HEARTBEAT RECOVERY TEST')

    // Navigate back to test (fresh state for heartbeat test)
    await page.goto(`${BASE_URL}/ap/test/test_micro_full_1`, { waitUntil: 'domcontentloaded' })
    await sleep(2000)

    // Click Resume if needed
    const hbInitState = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      return btns.map(b => b.textContent.trim()).filter(t => t.length < 60)
    })
    console.log('HB test init buttons:', hbInitState)

    if (hbInitState.some(b => b.includes('Resume') || b.includes('Begin'))) {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'))
        const btn = btns.find(b => b.textContent.trim().includes('Resume') || b.textContent.trim().includes('Begin'))
        if (btn) btn.click()
      })
      await sleep(2000)
    }

    await ss(page, '13_hb_test_initial')

    // Read initial connection state
    const hbInitConnection = await getConnectionStatus(page)
    console.log('Initial connection state:', hbInitConnection)

    // HEARTBEAT_INTERVAL = 15000ms, MAX_FAILURES = 3
    // To trigger "Connection unstable" we need 3 failures at 15s intervals = 45s minimum
    // BUT: the initial heartbeat fires immediately, so:
    // Failure 1: ~5s (heartbeat timeout)
    // Failure 2: ~20s (15s interval + 5s timeout)
    // Failure 3: ~35s (30s interval + 5s timeout)
    // isConnected = false at ~35-45s

    console.log('Going offline for 50 seconds to trigger 3 heartbeat failures...')
    await context.setOffline(true)
    const offlineTime = Date.now()

    let unstableBannerDetectedAt = null
    let pollingData = []

    // Poll for 55 seconds checking for "Connection unstable" banner
    for (let i = 0; i < 55; i++) {
      await sleep(1000)

      const connState = await getConnectionStatus(page)
      if (connState.isUnstable && !unstableBannerDetectedAt) {
        unstableBannerDetectedAt = Date.now() - offlineTime
        console.log(`"Connection unstable" appeared after ${unstableBannerDetectedAt}ms!`)
        await ss(page, '14_unstable_banner')
      }

      if (i % 5 === 0 || connState.bannerFound) {
        const elapsed = i + 1
        console.log(`${elapsed}s offline: ${JSON.stringify(connState)}`)
        pollingData.push({ elapsed, ...connState })
      }
    }

    console.log('Offline polling done. Unstable detected at:', unstableBannerDetectedAt)
    await ss(page, '15_after_50s_offline')

    results.fix10.notes.push(`Offline duration: 50s`)
    results.fix10.notes.push(`"Connection unstable" banner appeared at: ${unstableBannerDetectedAt ? unstableBannerDetectedAt + 'ms' : 'NEVER'}`)
    results.fix10.notes.push(`HEARTBEAT_INTERVAL=15000ms, MAX_FAILURES=3 (FIX-10 NOT applied)`)

    // Now restore network and measure reconnection time
    console.log('\nRestoring network, measuring reconnection time...')
    await context.setOffline(false)
    const networkRestoreTime = Date.now()

    let reconnectedBannerAt = null
    let unstableGoneAt = null

    for (let i = 0; i < 45; i++) {
      await sleep(1000)

      const connState = await getConnectionStatus(page)

      if (connState.isReconnected && !reconnectedBannerAt) {
        reconnectedBannerAt = Date.now() - networkRestoreTime
        console.log(`"Reconnected" banner appeared after ${reconnectedBannerAt}ms!`)
        await ss(page, '16_reconnected_banner')
      }

      if (!connState.isUnstable && !connState.isReconnected && unstableBannerDetectedAt && !unstableGoneAt) {
        unstableGoneAt = Date.now() - networkRestoreTime
        console.log(`"Connection unstable" banner cleared after ${unstableGoneAt}ms`)
      }

      if (i % 5 === 0 || connState.bannerFound) {
        console.log(`${i+1}s after restore: ${JSON.stringify(connState)}`)
        pollingData.push({ elapsed: -(i+1), ...connState })
      }

      // If reconnected banner appeared AND disappeared, we're done
      if (reconnectedBannerAt && !connState.isReconnected && i > 3) {
        console.log('Reconnection banner completed — test done')
        break
      }
    }

    await ss(page, '17_after_recovery')

    results.fix10.notes.push(`"Reconnected" banner appeared at: ${reconnectedBannerAt ? reconnectedBannerAt + 'ms' : 'NEVER'}`)
    results.fix10.notes.push(`"Connection unstable" cleared at: ${unstableGoneAt ? unstableGoneAt + 'ms' : 'not tracked'}`)

    // Evaluate FIX-10
    // FIX-10 is NOT yet applied per context
    // FIX-10 would add an 'online' event listener to useHeartbeat to immediately doHeartbeat
    // WITHOUT FIX-10: recovery = next heartbeat interval (up to 15s)
    // WITH FIX-10: recovery = immediate on online event (<5s)

    if (!unstableBannerDetectedAt) {
      // Banner never appeared — maybe MAX_FAILURES wasn't reached
      results.fix10.status = 'PARTIAL'
      results.fix10.notes.push('PARTIAL: "Connection unstable" banner never appeared during 50s offline')
      results.fix10.notes.push('This suggests MAX_FAILURES=3 at 15s interval needs 45s+ to trigger banner')
    } else if (!reconnectedBannerAt) {
      results.fix10.status = 'FAIL'
      results.fix10.notes.push(`FAIL: "Connection unstable" appeared at ${unstableBannerDetectedAt}ms but "Reconnected" never appeared within 45s`)
      results.fix10.notes.push('FIX-10 NOT applied: no online event listener in useHeartbeat.js')
    } else if (reconnectedBannerAt <= 5000) {
      results.fix10.status = 'PASS'
      results.fix10.notes.push(`PASS: Reconnected in ${reconnectedBannerAt}ms — FIX-10 appears to be applied`)
    } else {
      results.fix10.status = 'DOCUMENTED'
      results.fix10.notes.push(`DOCUMENTED: Reconnected in ${reconnectedBannerAt}ms — consistent with FIX-10 NOT applied`)
      results.fix10.notes.push('Expected behavior: reconnect on next heartbeat interval (15s max)')
    }

    // ==============================================================
    // STEP 9: code.startsWith check (regression test)
    // ==============================================================
    ts('STEP 9: CHECK code.startsWith REGRESSION')
    const codeStartsWithErrors = consoleMessages.filter(m => m.text.includes('startsWith'))
    if (codeStartsWithErrors.length === 0) {
      results.codeStartsWith.status = 'PASS'
      results.codeStartsWith.notes.push('No code.startsWith errors found — logError.js fix verified')
    } else {
      results.codeStartsWith.status = 'FAIL'
      results.codeStartsWith.notes.push(`FAIL: code.startsWith errors found: ${JSON.stringify(codeStartsWithErrors)}`)
    }

    await ss(page, '18_final_state')

    await context.close()

  } catch (err) {
    console.error('SCRIPT ERROR:', err.message)
    results.consoleErrors.push({ type: 'script_error', text: err.message })
  } finally {
    await browser.close()
  }

  // Write results
  const out = join(__dirname, 'b14g_retest_v2_results.json')
  writeFileSync(out, JSON.stringify({ results, consoleMessages: consoleMessages.slice(0, 100) }, null, 2))
  console.log(`\nResults: ${out}`)

  console.log('\n=== FINAL RESULTS ===')
  console.log(`Login: ${results.loginStatus}`)
  console.log(`FIX-1 (stale closure): ${results.fix1.status}`)
  console.log(`  ${results.fix1.notes.join('\n  ')}`)
  console.log(`FIX-2 (reconcileQueue): ${results.fix2.status}`)
  console.log(`  ${results.fix2.notes.join('\n  ')}`)
  console.log(`FIX-10 (heartbeat): ${results.fix10.status}`)
  console.log(`  ${results.fix10.notes.join('\n  ')}`)
  console.log(`code.startsWith: ${results.codeStartsWith.status}`)
  console.log(`TDZ errors: ${results.tdzErrors.found}`)
  console.log(`Console errors: ${results.consoleErrors.length}`)

  return results
}

run().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
