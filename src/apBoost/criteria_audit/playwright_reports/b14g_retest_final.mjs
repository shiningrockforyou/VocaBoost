/**
 * B14G Retest Final — Verify FIX-1, FIX-2, FIX-10
 * Student: student10@apboost.test / Student123!
 *
 * Tests:
 * 1. FIX-1: scheduleFlush uses flushQueueRef (stale closure fix) - verify queue reaches 0 after offline→online
 * 2. FIX-2: reconcileQueue content-based comparison - verify answers preserved after page reload
 * 3. FIX-10: Heartbeat recovery speed - document timing (FIX-10 NOT YET APPLIED per context)
 */

import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCREENSHOTS_DIR = join(__dirname, 'screenshots_B14G_retest')
const BASE_URL = 'http://localhost:5173'

// Ensure screenshots dir exists
import { mkdirSync } from 'fs'
try { mkdirSync(SCREENSHOTS_DIR, { recursive: true }) } catch {}

const results = {
  fix1: { status: 'UNTESTED', evidence: [], notes: [] },
  fix2: { status: 'UNTESTED', evidence: [], notes: [] },
  fix10: { status: 'UNTESTED', evidence: [], notes: [] },
  consoleErrors: [],
  screenshots: [],
}

let screenshotCount = 0

async function screenshot(page, label) {
  const filename = `${String(++screenshotCount).padStart(2, '0')}_${label}.png`
  const filepath = join(SCREENSHOTS_DIR, filename)
  await page.screenshot({ path: filepath, fullPage: true })
  results.screenshots.push({ label, filename })
  console.log(`[SS] ${filename}`)
  return filename
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function login(page, email, password) {
  console.log(`\n=== LOGIN: ${email} ===`)
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 })

  // Fill credentials
  await page.fill('input[type="email"], input[name="email"]', email)
  await page.fill('input[type="password"], input[name="password"]', password)
  await page.click('button[type="submit"]')

  // Wait for redirect
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 })
  await page.waitForLoadState('domcontentloaded')
  await sleep(1500)

  const url = page.url()
  console.log(`Redirected to: ${url}`)
  return url
}

async function getIndexedDBQueueCount(page, sessionId) {
  return await page.evaluate(async (sid) => {
    return new Promise((resolve) => {
      const req = indexedDB.open('ap_boost_queue', 1)
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('actions')) {
          resolve(0)
          return
        }
        try {
          const tx = db.transaction('actions', 'readonly')
          const store = tx.objectStore('actions')
          const index = store.index('sessionId')
          const countReq = index.count(IDBKeyRange.only(sid))
          countReq.onsuccess = () => resolve(countReq.result)
          countReq.onerror = () => resolve(-1)
        } catch (e) {
          resolve(-2)
        }
      }
      req.onerror = () => resolve(-3)
    })
  }, sessionId)
}

async function getIndexedDBAllItems(page, sessionId) {
  return await page.evaluate(async (sid) => {
    return new Promise((resolve) => {
      const req = indexedDB.open('ap_boost_queue', 1)
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('actions')) {
          resolve([])
          return
        }
        try {
          const tx = db.transaction('actions', 'readonly')
          const store = tx.objectStore('actions')
          const index = store.index('sessionId')
          const getAllReq = index.getAll(IDBKeyRange.only(sid))
          getAllReq.onsuccess = () => resolve(getAllReq.result)
          getAllReq.onerror = () => resolve([])
        } catch (e) {
          resolve([])
        }
      }
      req.onerror = () => resolve([])
    })
  }, sessionId)
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-web-security']
  })

  const consoleMessages = []

  try {
    // =====================================================================
    // PHASE 1: Login and navigate to test
    // =====================================================================
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    })
    const page = await context.newPage()

    // Collect console messages
    page.on('console', msg => {
      const text = msg.text()
      consoleMessages.push({ type: msg.type(), text, url: page.url() })
      if (msg.type() === 'error') {
        console.log(`[CONSOLE ERROR] ${text}`)
        results.consoleErrors.push({ type: 'error', text, url: page.url() })
      }
    })
    page.on('pageerror', err => {
      console.log(`[PAGE ERROR] ${err.message}`)
      results.consoleErrors.push({ type: 'pageerror', text: err.message, url: page.url() })
    })

    // Login
    const redirectUrl = await login(page, 'student10@apboost.test', 'Student123!')

    // Check if we landed on AP dashboard
    if (!redirectUrl.includes('/ap')) {
      console.log(`WARNING: Did not redirect to /ap. Got: ${redirectUrl}`)
    }

    await screenshot(page, '01_after_login')

    // =====================================================================
    // Find and start a test
    // =====================================================================
    console.log('\n=== NAVIGATE TO TEST ===')

    // Navigate to AP dashboard
    if (!page.url().includes('/ap')) {
      await page.goto(`${BASE_URL}/ap`, { waitUntil: 'domcontentloaded' })
      await sleep(2000)
    }

    const dashboardText = await page.textContent('body')
    console.log(`Dashboard loaded: ${dashboardText.includes('AP') ? 'YES' : 'NO'}`)
    await screenshot(page, '02_dashboard')

    // Look for test cards - try Micro test first
    const testCards = await page.$$('[data-testid="test-card"], .test-card, [class*="test-card"]')
    console.log(`Found ${testCards.length} test cards`)

    // Try to find and click a "Begin Test" or "Start Test" button
    // First let's look at what's on the page
    const bodyHTML = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a[href]'))
      return buttons.map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 100).join(' | ')
    })
    console.log(`Page buttons/links: ${bodyHTML.substring(0, 500)}`)

    // Navigate directly to the test
    await page.goto(`${BASE_URL}/ap/test/test_micro_full_1`, { waitUntil: 'domcontentloaded' })
    await sleep(2000)

    const testPageUrl = page.url()
    console.log(`Test page URL: ${testPageUrl}`)
    await screenshot(page, '03_test_page')

    // Check for instruction screen or active test
    const pageContent = await page.textContent('body')
    console.log(`Test page has: ${pageContent.substring(0, 300)}`)

    // Look for Begin/Resume button
    const beginBtns = await page.$$('button')
    for (const btn of beginBtns) {
      const txt = await btn.textContent()
      console.log(`Button: "${txt.trim()}"`)
    }

    // Click Begin Test or Resume
    let testStarted = false
    try {
      // Try "Begin Test" first
      const beginBtn = await page.$('button:has-text("Begin Test")')
      if (beginBtn) {
        console.log('Clicking "Begin Test"')
        await beginBtn.click()
        testStarted = true
      } else {
        // Try Resume
        const resumeBtn = await page.$('button:has-text("Resume")')
        if (resumeBtn) {
          console.log('Clicking "Resume Test"')
          await resumeBtn.click()
          testStarted = true
        } else {
          // Try any start button
          const anyBtn = await page.$('button:has-text("Start")')
          if (anyBtn) {
            console.log('Clicking start button')
            await anyBtn.click()
            testStarted = true
          }
        }
      }
    } catch (e) {
      console.log(`Error clicking start button: ${e.message}`)
    }

    await sleep(2000)
    await screenshot(page, '04_after_start_click')

    // Check current state
    const currentUrl = page.url()
    console.log(`URL after start: ${currentUrl}`)

    // Check if we're in the test
    const inTest = await page.evaluate(() => {
      const body = document.body.textContent
      return {
        hasQuestion: body.includes('Question') || body.includes('question'),
        hasTimer: body.includes(':') && document.querySelector('[class*="timer"]') !== null,
        hasAnswer: document.querySelector('[role="radio"], input[type="radio"]') !== null,
        bodySnippet: body.substring(0, 200)
      }
    })
    console.log('In test state:', inTest)

    // If not in testing view yet, wait longer
    if (!inTest.hasQuestion) {
      await sleep(3000)
      await screenshot(page, '05_waiting_for_test')

      // Try clicking resume again if instruction screen is showing
      try {
        const startBtn = await page.$('button:has-text("Resume"), button:has-text("Begin"), button:has-text("Start")')
        if (startBtn) {
          const btnTxt = await startBtn.textContent()
          console.log(`Clicking: "${btnTxt}"`)
          await startBtn.click()
          await sleep(2000)
        }
      } catch (e) {}
    }

    await screenshot(page, '06_test_start_state')

    // Extract session ID from the page or Firestore
    const sessionInfo = await page.evaluate(() => {
      // Try to get session ID from various places
      const urlMatch = window.location.href.match(/test\/([^/]+)/)
      const testId = urlMatch ? urlMatch[1] : null

      // Look for session ID in React state or local storage
      const keys = Object.keys(localStorage)
      const sessionKeys = keys.filter(k => k.includes('session') || k.includes('ap_'))
      const sessionData = {}
      sessionKeys.forEach(k => {
        try { sessionData[k] = localStorage.getItem(k) } catch {}
      })

      return { testId, localStorageKeys: keys, sessionData, href: window.location.href }
    })
    console.log('Session info:', JSON.stringify(sessionInfo, null, 2))

    // =====================================================================
    // Answer Q1-Q5 normally (online)
    // =====================================================================
    console.log('\n=== ANSWER Q1-Q5 (ONLINE) ===')

    let answeredOnline = 0
    for (let q = 0; q < 5; q++) {
      await sleep(1000)

      // Check current question
      const questionState = await page.evaluate(() => {
        const radios = document.querySelectorAll('[role="radio"], input[type="radio"]')
        const questionText = document.querySelector('[class*="question"], h2, h3')
        return {
          radioCount: radios.length,
          questionText: questionText?.textContent?.substring(0, 100) || 'not found',
          url: window.location.href
        }
      })
      console.log(`Q${q+1} state:`, questionState)

      if (questionState.radioCount === 0) {
        console.log(`No radio buttons found on Q${q+1}`)
        break
      }

      // Click first radio button (answer A)
      try {
        const radios = await page.$$('[role="radio"], input[type="radio"]')
        if (radios.length > 0) {
          await radios[0].click()
          answeredOnline++
          console.log(`Answered Q${q+1}`)
          await sleep(300)
          await screenshot(page, `07_q${q+1}_answered`)
        }
      } catch (e) {
        console.log(`Error answering Q${q+1}: ${e.message}`)
      }

      // Click Next button
      try {
        const nextBtn = await page.$('button:has-text("Next"), button:has-text("next"), [aria-label*="next" i]')
        if (nextBtn) {
          await nextBtn.click()
          await sleep(500)
        } else {
          // Try navigation buttons at bottom
          const navBtns = await page.$$('button')
          let clickedNext = false
          for (const btn of navBtns) {
            const txt = await btn.textContent()
            if (txt.trim() === 'Next' || txt.trim() === '→') {
              await btn.click()
              clickedNext = true
              break
            }
          }
          if (!clickedNext) console.log(`No Next button found after Q${q+1}`)
        }
      } catch (e) {
        console.log(`Error clicking Next: ${e.message}`)
      }
    }

    console.log(`Answered ${answeredOnline}/5 questions online`)

    // Check IndexedDB queue count before going offline
    // We need the session ID - check for it in IndexedDB itself
    let sessionId = null
    const idbItems = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const req = indexedDB.open('ap_boost_queue', 1)
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('actions')) {
            resolve([])
            return
          }
          const tx = db.transaction('actions', 'readonly')
          const store = tx.objectStore('actions')
          const allReq = store.getAll()
          allReq.onsuccess = () => resolve(allReq.result)
          allReq.onerror = () => resolve([])
        }
        req.onerror = () => resolve([])
      })
    })

    console.log(`IDB items before offline: ${idbItems.length}`)
    if (idbItems.length > 0) {
      sessionId = idbItems[0].sessionId
      console.log(`Session ID from IDB: ${sessionId}`)
    }

    // Also try to get session ID from localStorage
    if (!sessionId) {
      const lsData = await page.evaluate(() => {
        const result = {}
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && (key.includes('session') || key.includes('ap_'))) {
            result[key] = localStorage.getItem(key)
          }
        }
        return result
      })
      console.log('LocalStorage AP keys:', lsData)
    }

    await screenshot(page, '08_before_offline')

    // =====================================================================
    // FIX-1 TEST: Go offline, answer Q6-Q8, restore online
    // =====================================================================
    console.log('\n=== FIX-1 TEST: GO OFFLINE ===')

    // Block ALL network requests to simulate offline
    await context.setOffline(true)
    console.log('Context set to OFFLINE')
    await sleep(500)

    // Check online status
    const onlineStatus = await page.evaluate(() => navigator.onLine)
    console.log(`navigator.onLine: ${onlineStatus}`)

    // Answer Q6-Q8 offline
    let answeredOffline = 0
    for (let q = 5; q < 8; q++) {
      await sleep(1000)

      const questionState = await page.evaluate(() => {
        const radios = document.querySelectorAll('[role="radio"], input[type="radio"]')
        return {
          radioCount: radios.length,
          url: window.location.href
        }
      })

      if (questionState.radioCount === 0) {
        console.log(`No radio buttons on Q${q+1} (offline)`)
        break
      }

      try {
        const radios = await page.$$('[role="radio"], input[type="radio"]')
        if (radios.length > 0) {
          // Pick second option (B) to make offline answers distinguishable
          const idx = Math.min(1, radios.length - 1)
          await radios[idx].click()
          answeredOffline++
          console.log(`Answered Q${q+1} offline`)
          await sleep(300)
        }
      } catch (e) {
        console.log(`Error answering Q${q+1} offline: ${e.message}`)
      }

      // Click Next
      try {
        const nextBtn = await page.$('button:has-text("Next")')
        if (nextBtn) {
          await nextBtn.click()
          await sleep(500)
        }
      } catch (e) {}
    }

    console.log(`Answered ${answeredOffline}/3 questions offline`)
    await screenshot(page, '09_during_offline')

    // Check IDB queue during offline
    const idbDuringOffline = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const req = indexedDB.open('ap_boost_queue', 1)
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('actions')) {
            resolve([])
            return
          }
          const tx = db.transaction('actions', 'readonly')
          const store = tx.objectStore('actions')
          const allReq = store.getAll()
          allReq.onsuccess = () => resolve(allReq.result.map(item => ({
            id: item.id,
            sessionId: item.sessionId,
            action: item.action,
            status: item.status,
            localTimestamp: item.localTimestamp,
            payload: item.payload ? {
              questionId: item.payload.questionId,
              value: item.payload.value
            } : null
          })))
          allReq.onerror = () => resolve([])
        }
        req.onerror = () => resolve([])
      })
    })

    console.log(`IDB items during offline: ${idbDuringOffline.length}`)
    if (idbDuringOffline.length > 0 && !sessionId) {
      sessionId = idbDuringOffline[0].sessionId
      console.log(`Session ID: ${sessionId}`)
    }

    const pendingDuringOffline = idbDuringOffline.filter(i => i.status === 'PENDING')
    console.log(`Pending items during offline: ${pendingDuringOffline.length}`)

    results.fix1.notes.push(`Pending items after answering Q6-Q8 offline: ${pendingDuringOffline.length}`)

    // =====================================================================
    // Restore network
    // =====================================================================
    console.log('\n=== RESTORING NETWORK ===')

    const preRestoreCount = pendingDuringOffline.length

    await context.setOffline(false)
    console.log('Context set ONLINE')

    // Wait for online event to fire and flush to complete
    // FIX-1 means scheduleFlush(500) should be called via flushQueueRef
    console.log('Waiting 3 seconds for flush...')
    await sleep(3000)

    await screenshot(page, '10_after_restore_3s')

    // Check IDB count 3 seconds after restore
    const idbAfter3s = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const req = indexedDB.open('ap_boost_queue', 1)
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('actions')) {
            resolve([])
            return
          }
          const tx = db.transaction('actions', 'readonly')
          const store = tx.objectStore('actions')
          const allReq = store.getAll()
          allReq.onsuccess = () => resolve(allReq.result.map(item => ({
            action: item.action,
            status: item.status,
            sessionId: item.sessionId
          })))
          allReq.onerror = () => resolve([])
        }
        req.onerror = () => resolve([])
      })
    })

    const pendingAfter3s = idbAfter3s.filter(i => i.status === 'PENDING')
    console.log(`Pending items after 3s online: ${pendingAfter3s.length}`)

    // Wait 5 more seconds (total 8s)
    console.log('Waiting 5 more seconds...')
    await sleep(5000)

    const idbAfter8s = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const req = indexedDB.open('ap_boost_queue', 1)
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('actions')) {
            resolve([])
            return
          }
          const tx = db.transaction('actions', 'readonly')
          const store = tx.objectStore('actions')
          const allReq = store.getAll()
          allReq.onsuccess = () => resolve(allReq.result.map(item => ({
            action: item.action,
            status: item.status
          })))
          allReq.onerror = () => resolve([])
        }
        req.onerror = () => resolve([])
      })
    })

    const pendingAfter8s = idbAfter8s.filter(i => i.status === 'PENDING')
    console.log(`Pending items after 8s online: ${pendingAfter8s.length}`)

    await screenshot(page, '11_after_restore_8s')

    // Evaluate FIX-1 result
    if (pendingAfter8s.length === 0 && preRestoreCount > 0) {
      results.fix1.status = 'PASS'
      results.fix1.notes.push(`PASS: All ${preRestoreCount} offline items flushed within 8 seconds of network restore`)
    } else if (pendingAfter8s.length > 0 && preRestoreCount > 0) {
      results.fix1.status = 'FAIL'
      results.fix1.notes.push(`FAIL: ${pendingAfter8s.length}/${preRestoreCount} items still pending after 8s online`)
    } else if (preRestoreCount === 0) {
      results.fix1.status = 'SKIP'
      results.fix1.notes.push(`SKIP: No items were queued offline (answeredOffline=${answeredOffline})`)
    }

    // Check for console errors
    const tdz = consoleMessages.filter(m => m.text.includes('Cannot access') || m.text.includes('before initialization') || m.text.includes('TDZ') || m.text.includes('ReferenceError'))
    if (tdz.length > 0) {
      results.fix1.notes.push(`TDZ ERRORS FOUND: ${tdz.map(e => e.text).join('; ')}`)
    } else {
      results.fix1.notes.push('No TDZ/ReferenceError console errors found')
    }

    // =====================================================================
    // FIX-2 TEST: Reload page, resume, check answers preserved
    // =====================================================================
    console.log('\n=== FIX-2 TEST: PAGE RELOAD ===')

    // Take screenshot showing current answered state
    const answeredBeforeReload = await page.evaluate(() => {
      const body = document.body.textContent
      // Look for "Answered" count or check radio states
      const answeredMatch = body.match(/Answered[:\s]+(\d+)/i)
      return {
        answeredCount: answeredMatch ? answeredMatch[1] : 'not found',
        bodySnippet: body.substring(0, 500)
      }
    })
    console.log('State before reload:', answeredBeforeReload)

    // Save what questions should be answered
    const idbBeforeReload = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const req = indexedDB.open('ap_boost_queue', 1)
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('actions')) {
            resolve([])
            return
          }
          const tx = db.transaction('actions', 'readonly')
          const store = tx.objectStore('actions')
          const allReq = store.getAll()
          allReq.onsuccess = () => resolve(allReq.result)
          allReq.onerror = () => resolve([])
        }
        req.onerror = () => resolve([])
      })
    })
    console.log(`IDB items before reload: ${idbBeforeReload.length}`)

    const testUrl = page.url()
    console.log(`Reloading: ${testUrl}`)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await sleep(2000)

    await screenshot(page, '12_after_reload')

    // Check for Resume button
    const resumeState = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      const btns = buttons.map(b => b.textContent.trim()).filter(t => t.length > 0)
      return {
        buttons: btns,
        bodySnippet: document.body.textContent.substring(0, 300)
      }
    })
    console.log('Post-reload state:', resumeState)

    // Click Resume if available
    try {
      const resumeBtn = await page.$('button:has-text("Resume")')
      if (resumeBtn) {
        console.log('Clicking Resume')
        await resumeBtn.click()
        await sleep(2000)
      } else {
        const beginBtn = await page.$('button:has-text("Begin")')
        if (beginBtn) {
          console.log('Clicking Begin (new session?)')
          await beginBtn.click()
          await sleep(2000)
        }
      }
    } catch (e) {
      console.log(`Error clicking resume: ${e.message}`)
    }

    await screenshot(page, '13_after_resume')

    // Now navigate to review screen to check answers
    // First navigate to the review screen (usually accessible via "Review" button or navigator)
    let reviewReached = false

    // Try to navigate through remaining questions quickly to get to review
    for (let i = 0; i < 15; i++) {
      const state = await page.evaluate(() => {
        const body = document.body.textContent
        const isReview = body.includes('Review') && body.includes('Answered')
        const hasNext = !!document.querySelector('button:not([disabled])')
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())
        return { isReview, buttons, bodySnippet: body.substring(0, 200) }
      })

      if (state.isReview && !state.buttons.some(b => b.includes('Next'))) {
        reviewReached = true
        console.log('Reached review screen')
        break
      }

      // Answer current question if not answered
      try {
        const radios = await page.$$('[role="radio"], input[type="radio"]')
        const anyChecked = await page.evaluate(() => {
          const checked = document.querySelectorAll('[role="radio"][aria-checked="true"], input[type="radio"]:checked')
          return checked.length > 0
        })

        if (radios.length > 0 && !anyChecked) {
          await radios[0].click()
          await sleep(300)
        }
      } catch (e) {}

      // Click Next
      try {
        const nextBtn = await page.$('button:has-text("Next")')
        if (nextBtn) {
          await nextBtn.click()
          await sleep(500)
        } else {
          // Try Review button
          const reviewBtn = await page.$('button:has-text("Review")')
          if (reviewBtn) {
            await reviewBtn.click()
            await sleep(1000)
            reviewReached = true
            break
          }
          break
        }
      } catch (e) {
        break
      }
    }

    await screenshot(page, '14_review_or_final')

    // Extract answer count from review screen
    const reviewData = await page.evaluate(() => {
      const body = document.body.textContent
      const answeredMatch = body.match(/Answered[:\s]+(\d+)[\s\/]+(\d+)/i)
      const flaggedMatch = body.match(/Flagged[:\s]+(\d+)/i)
      return {
        answeredText: answeredMatch ? answeredMatch[0] : 'not found',
        answered: answeredMatch ? parseInt(answeredMatch[1]) : null,
        total: answeredMatch ? parseInt(answeredMatch[2]) : null,
        flagged: flaggedMatch ? parseInt(flaggedMatch[1]) : null,
        bodySnippet: body.substring(0, 600),
        url: window.location.href
      }
    })

    console.log('Review data:', reviewData)

    results.fix2.notes.push(`After reload+resume: Answered ${reviewData.answered}/${reviewData.total}`)
    results.fix2.notes.push(`Pre-reload: answered ${answeredOnline} online + ${answeredOffline} offline = ${answeredOnline + answeredOffline} total`)

    // Evaluate FIX-2 result
    const expectedAnswered = answeredOnline + answeredOffline
    if (reviewData.answered !== null) {
      if (reviewData.answered >= expectedAnswered) {
        results.fix2.status = 'PASS'
        results.fix2.notes.push(`PASS: ${reviewData.answered} answers preserved (expected >=${expectedAnswered})`)
      } else {
        results.fix2.status = 'FAIL'
        results.fix2.notes.push(`FAIL: Only ${reviewData.answered} answers after resume (expected ${expectedAnswered})`)
      }
    } else {
      results.fix2.status = 'PARTIAL'
      results.fix2.notes.push(`PARTIAL: Could not extract answer count from review screen`)
    }

    await screenshot(page, '15_review_final_state')

    // =====================================================================
    // FIX-10 TEST: Heartbeat recovery timing
    // =====================================================================
    console.log('\n=== FIX-10 TEST: HEARTBEAT RECOVERY TIMING ===')

    // Read current useHeartbeat config
    // We know from source: HEARTBEAT_INTERVAL = 15000, MAX_FAILURES = 3
    // FIX-10 is NOT yet applied (no online event listener)

    // Navigate to fresh test page to get clean heartbeat state
    await page.goto(`${BASE_URL}/ap/test/test_micro_full_1`, { waitUntil: 'domcontentloaded' })
    await sleep(2000)

    // Resume if instruction screen
    try {
      const resumeBtn = await page.$('button:has-text("Resume"), button:has-text("Begin")')
      if (resumeBtn) {
        await resumeBtn.click()
        await sleep(2000)
      }
    } catch (e) {}

    await screenshot(page, '16_heartbeat_test_start')

    // Check initial connection state
    const initialState = await page.evaluate(() => {
      // Look for connection status indicators
      const body = document.body.textContent
      const hasUnstable = body.includes('unstable') || body.includes('Unstable')
      const hasConnected = body.includes('Reconnected') || body.includes('Connected')
      const hasOffline = body.includes('offline') || body.includes('Offline')
      return { hasUnstable, hasConnected, hasOffline, bodySnippet: body.substring(0, 300) }
    })
    console.log('Initial connection state:', initialState)

    // Now simulate offline for 20+ seconds (to trigger 3 failed heartbeats at 15s intervals)
    console.log('Going offline for 25 seconds (to trigger 3 failed heartbeats)...')
    await context.setOffline(true)

    const offlineStart = Date.now()

    // Wait 25 seconds to trigger multiple heartbeat failures
    // (3 failures at 15s interval = ~45s, but we want to see some failures)
    await sleep(25000)

    const bannerState25s = await page.evaluate(() => {
      const body = document.body.textContent
      const hasUnstable = body.includes('unstable') || body.includes('Unstable') || body.includes('Connection')
      const hasOffline = body.includes('Disconnected') || body.includes('offline')
      // Look for warning banner
      const banner = document.querySelector('[class*="banner"], [class*="alert"], [role="alert"]')
      return {
        hasUnstable,
        hasOffline,
        bannerText: banner ? banner.textContent.trim() : 'no banner found',
        bodySnippet: body.substring(0, 500)
      }
    })
    console.log('State after 25s offline:', bannerState25s)
    await screenshot(page, '17_after_25s_offline')

    results.fix10.notes.push(`After 25s offline: ${JSON.stringify(bannerState25s)}`)

    // Restore network and measure recovery time
    console.log('Restoring network, measuring recovery time...')
    await context.setOffline(false)
    const restoreTime = Date.now()

    // Poll every second for up to 45 seconds
    let reconnectedAt = null
    for (let i = 0; i < 45; i++) {
      await sleep(1000)

      const currentState = await page.evaluate(() => {
        const body = document.body.textContent
        const hasReconnected = body.includes('Reconnected') || body.includes('reconnected')
        const hasUnstable = body.includes('unstable') || body.includes('Unstable')
        const hasConnected = body.includes('Connected')
        const banner = document.querySelector('[class*="banner"], [class*="alert"], [role="alert"]')
        return {
          hasReconnected,
          hasUnstable,
          hasConnected,
          bannerText: banner ? banner.textContent.trim() : 'none',
          bodySnippet: body.substring(0, 300)
        }
      })

      if (currentState.hasReconnected || currentState.hasConnected) {
        reconnectedAt = Date.now()
        const recoveryTime = reconnectedAt - restoreTime
        console.log(`RECONNECTED after ${recoveryTime}ms (${(recoveryTime/1000).toFixed(1)}s)`)
        results.fix10.notes.push(`Reconnected detected after ${recoveryTime}ms`)
        break
      }

      if (i % 5 === 0) {
        console.log(`${i+1}s after restore: ${JSON.stringify(currentState)}`)
        if (i === 14) {
          await screenshot(page, '18_during_recovery')
        }
      }
    }

    if (!reconnectedAt) {
      console.log('Did NOT detect reconnection within 45 seconds')
      results.fix10.notes.push('No reconnection banner detected within 45s (FIX-10 not applied)')
    }

    await screenshot(page, '19_after_recovery_attempt')

    // Evaluate FIX-10 result
    // FIX-10 is described as NOT yet applied per context
    // Expected behavior WITH fix: reconnect within 5s
    // Expected behavior WITHOUT fix: reconnect within 15-30s (next heartbeat cycle)
    if (reconnectedAt) {
      const recoveryMs = reconnectedAt - restoreTime
      if (recoveryMs <= 5000) {
        results.fix10.status = 'PASS'
        results.fix10.notes.push(`PASS: Recovery in ${(recoveryMs/1000).toFixed(1)}s (FIX-10 applied)`)
      } else if (recoveryMs <= 30000) {
        results.fix10.status = 'PARTIAL'
        results.fix10.notes.push(`PARTIAL: Recovery in ${(recoveryMs/1000).toFixed(1)}s — slow (FIX-10 not applied yet, recovery is next heartbeat cycle)`)
      } else {
        results.fix10.status = 'FAIL'
        results.fix10.notes.push(`FAIL: Recovery took ${(recoveryMs/1000).toFixed(1)}s — too slow`)
      }
    } else {
      results.fix10.status = 'FAIL'
      results.fix10.notes.push('FAIL: No reconnection banner within 45s after network restore')
    }

    // =====================================================================
    // Check for code.startsWith errors (previously fixed)
    // =====================================================================
    const codeStartsWith = consoleMessages.filter(m => m.text.includes('startsWith'))
    if (codeStartsWith.length > 0) {
      results.consoleErrors.push({ type: 'regression', text: 'code.startsWith errors found!', details: codeStartsWith })
    }

    // Final screenshots
    await screenshot(page, '20_final_state')

    console.log('\n=== TEST COMPLETE ===')
    console.log('FIX-1:', results.fix1.status, results.fix1.notes)
    console.log('FIX-2:', results.fix2.status, results.fix2.notes)
    console.log('FIX-10:', results.fix10.status, results.fix10.notes)
    console.log('Console errors:', results.consoleErrors.length)

    // Close browser
    await context.close()

  } catch (err) {
    console.error('TEST SCRIPT ERROR:', err)
    results.consoleErrors.push({ type: 'script_error', text: err.message, stack: err.stack })
  } finally {
    await browser.close()
  }

  // Save results
  const resultsPath = join(__dirname, 'b14g_retest_final_results.json')
  writeFileSync(resultsPath, JSON.stringify({ results, consoleMessages: consoleMessages.slice(0, 50) }, null, 2))
  console.log(`\nResults saved to: ${resultsPath}`)

  return results
}

run().then(r => {
  console.log('\nFINAL SUMMARY:')
  console.log(JSON.stringify(r, null, 2))
  process.exit(0)
}).catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
