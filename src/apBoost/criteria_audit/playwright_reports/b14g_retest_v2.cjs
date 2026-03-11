/**
 * B14G Retest Script V2
 * Targeted verification of:
 * - FIX-10: code.startsWith guard
 * - FIX-1: stale closure sync (after crash analysis)
 * - FIX-2: content-based reconciliation on resume
 *
 * Since the TDZ bug crashes page 1, we use page 2 (which works without crash) to verify FIX-2.
 * We also verify FIX-10 by looking at console output on both pages.
 */
const { chromium } = require('playwright')

const BASE_URL = 'http://localhost:5173'
const EMAIL = 'student10@apboost.test'
const PASSWORD = 'Student123!'
const TEST_ID = 'test_micro_full_1'

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function getAllIDBItems(page) {
  return page.evaluate(async () => {
    return new Promise((resolve) => {
      const req = indexedDB.open('ap_boost_queue', 1)
      req.onsuccess = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains('actions')) { resolve([]); return }
        const tx = db.transaction('actions', 'readonly')
        const store = tx.objectStore('actions')
        const r = store.getAll()
        r.onsuccess = () => resolve(r.result || [])
        r.onerror = () => resolve([])
      }
      req.onerror = () => resolve([])
    })
  })
}

async function clearAllIDB(page) {
  return page.evaluate(async () => {
    return new Promise((resolve) => {
      const req = indexedDB.open('ap_boost_queue', 1)
      req.onsuccess = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains('actions')) { resolve(true); return }
        const tx = db.transaction('actions', 'readwrite')
        const store = tx.objectStore('actions')
        const r = store.clear()
        r.onsuccess = () => resolve(true)
        r.onerror = () => resolve(false)
      }
      req.onerror = () => resolve(false)
    })
  })
}

async function run() {
  console.log('=== B14G RETEST V2 ===')
  console.log('Focused on: FIX-10 (console errors), FIX-1 (TDZ crash analysis), FIX-2 (resume)')
  console.log('')

  const browser = await chromium.launch({ headless: false, slowMo: 200 })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })

  // ── PAGE 1: Check FIX-10 and the TDZ crash ──
  console.log('=== PHASE 1: FIX-10 and TDZ crash verification ===')
  const page1 = await context.newPage()

  const p1_errors = []
  const p1_startsWith = []

  page1.on('console', msg => {
    if (msg.type() === 'error') {
      p1_errors.push(msg.text().substring(0, 300))
      if (msg.text().includes('startsWith')) p1_startsWith.push(msg.text().substring(0, 300))
    }
  })
  page1.on('pageerror', err => {
    p1_errors.push('[PAGEERROR] ' + err.message.substring(0, 300))
    if (err.message.includes('startsWith')) p1_startsWith.push('[PAGEERROR] ' + err.message.substring(0, 300))
  })

  // Login
  await page1.goto(BASE_URL + '/login')
  await page1.waitForTimeout(2000)
  await page1.fill('input[type="email"]', EMAIL)
  await page1.fill('input[type="password"]', PASSWORD)
  await page1.keyboard.press('Enter')
  await page1.waitForTimeout(3000)

  if (!page1.url().includes('/ap')) {
    await page1.goto(BASE_URL + '/ap')
    await page1.waitForTimeout(2000)
  }
  console.log('Login URL: ' + page1.url())

  // Clear IDB and navigate to test
  await clearAllIDB(page1)
  await page1.goto(BASE_URL + '/ap/test/' + TEST_ID)
  await page1.waitForTimeout(3000)

  const p1_text = await page1.evaluate(() => document.body.innerText.substring(0, 500))
  console.log('Page 1 text: ' + p1_text)

  await page1.screenshot({ path: 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14g_retestv2_01_page1.png' })

  console.log('')
  console.log('FIX-10 check - code.startsWith errors: ' + p1_startsWith.length)
  if (p1_startsWith.length > 0) {
    console.log('  ERRORS:', p1_startsWith)
  }

  // Check for TDZ crash
  const hasTDZCrash = p1_errors.some(e => e.includes('scheduleFlush') && e.includes('initialization'))
  const hasStartsWithError = p1_errors.some(e => e.includes('startsWith'))
  console.log('TDZ crash (scheduleFlush not initialized): ' + hasTDZCrash)
  console.log('code.startsWith error: ' + hasStartsWithError)

  if (hasTDZCrash) {
    console.log('BLOCKER CONFIRMED: FIX-1 introduced a new TDZ bug that crashes the test page')
    console.log('Error at useOfflineQueue.js:118 - scheduleFlush referenced in deps array before declaration')
  }

  await page1.close()

  // ── PAGE 2: Fresh load - check if crash persists across loads ──
  console.log('')
  console.log('=== PHASE 2: Second page load (verifying crash reproducibility) ===')
  const page2 = await context.newPage()

  const p2_errors = []
  const p2_startsWith = []

  page2.on('console', msg => {
    if (msg.type() === 'error') {
      p2_errors.push(msg.text().substring(0, 300))
      if (msg.text().includes('startsWith')) p2_startsWith.push(msg.text())
    }
    if (msg.type() === 'log' && msg.text().includes('[APBoost:')) {
      console.log('  [LOG] ' + msg.text().substring(0, 200))
    }
  })
  page2.on('pageerror', err => {
    p2_errors.push('[PAGEERROR] ' + err.message.substring(0, 300))
  })

  await page2.goto(BASE_URL + '/ap/test/' + TEST_ID)
  await page2.waitForTimeout(4000)
  console.log('Page 2 URL: ' + page2.url())

  const p2_text = await page2.evaluate(() => document.body.innerText.substring(0, 600))
  console.log('Page 2 text: ' + p2_text)

  await page2.screenshot({ path: 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14g_retestv2_02_page2.png' })

  console.log('')
  console.log('Page 2 errors: ' + p2_errors.length)
  const p2_tdz = p2_errors.some(e => e.includes('scheduleFlush') && e.includes('initialization'))
  const p2_startswithErr = p2_errors.some(e => e.includes('startsWith'))
  console.log('  TDZ crash: ' + p2_tdz)
  console.log('  startsWith error: ' + p2_startswithErr)

  if (p2_errors.length > 0) {
    p2_errors.forEach(e => console.log('  ERR: ' + e))
  }

  // ── PHASE 3: FIX-2 verification via page 2 resume ──
  console.log('')
  console.log('=== PHASE 3: FIX-2 resume verification ===')

  // Check if page 2 shows instruction screen (it should if auth persisted)
  const hasResumeBtn = await page2.locator('button:has-text("Resume")').isVisible().catch(() => false)
  const hasBeginBtn = await page2.locator('button:has-text("Begin")').isVisible().catch(() => false)

  console.log('Has Resume button: ' + hasResumeBtn)
  console.log('Has Begin button: ' + hasBeginBtn)

  // Check for "Resume from" text (B14G-006 fix verification)
  const resumeFromMatch = p2_text.match(/Resume from[:\s]+(.+?)(?:\n|$)/i)
  if (resumeFromMatch) {
    console.log('B14G-006 CHECK PASS: Resume position shown: "' + resumeFromMatch[0].trim() + '"')
  } else {
    console.log('B14G-006 CHECK: No "Resume from" text found')
  }

  if (hasResumeBtn) {
    await page2.click('button:has-text("Resume")')
    await page2.waitForTimeout(4000)

    await page2.screenshot({ path: 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14g_retestv2_03_resumed.png' })

    const resumedText = await page2.evaluate(() => document.body.innerText.substring(0, 1000))
    console.log('After resume: ' + resumedText)

    // Check IDB state after resume
    const idbAfterResume = await getAllIDBItems(page2)
    console.log('IDB items after resume: ' + idbAfterResume.length)

    // Navigate through MCQ to review
    // Go to last question (Q15) by clicking Next
    let navCount = 0
    while (navCount < 15) {
      const canNext = await page2.locator('button:has-text("Next")').isVisible().catch(() => false)
      if (!canNext) break
      await page2.click('button:has-text("Next")')
      await page2.waitForTimeout(400)
      navCount++
    }
    console.log('Navigated through ' + navCount + ' questions')

    // Click Review
    const canReview = await page2.locator('button:has-text("Review")').isVisible().catch(() => false)
    if (canReview) {
      await page2.click('button:has-text("Review")')
      await page2.waitForTimeout(2000)

      await page2.screenshot({ path: 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14g_retestv2_04_review.png' })
      const reviewText = await page2.evaluate(() => document.body.innerText)
      console.log('Review screen text: ' + reviewText.substring(0, 2000))

      // Extract answered count
      const match = reviewText.match(/Answered[:\s]*(\d+)\/(\d+)/i)
      if (match) {
        console.log('FIX-2 MEASUREMENT: Answered ' + match[1] + '/' + match[2])
      } else {
        // Look for individual question statuses
        const lines = reviewText.split('\n').filter(l => l.trim())
        console.log('Review lines: ' + lines.slice(0, 30).join(' | '))
      }
    } else {
      console.log('No Review button available')
      const currentText = await page2.evaluate(() => document.body.innerText.substring(0, 500))
      console.log('Current page: ' + currentText)
    }
  }

  // ── PHASE 4: TDZ root cause analysis ──
  console.log('')
  console.log('=== PHASE 4: TDZ Root Cause Analysis ===')
  console.log('Error: "Cannot access scheduleFlush before initialization" at useOfflineQueue.js:118')
  console.log('')
  console.log('Root cause analysis:')
  console.log('  Line 94-119: useEffect with online/offline handlers, deps=[]')
  console.log('  BUT the online handler (handleOnline) at line 104 calls scheduleFlush(500)')
  console.log('  Line 247: const scheduleFlush = useCallback(...)')
  console.log('')
  console.log('  When FIX-1 was applied, the useEffect deps were changed from [] to [scheduleFlush]')
  console.log('  This causes TDZ because [scheduleFlush] is evaluated DURING RENDER at line 118')
  console.log('  At that point, scheduleFlush (declared at line 247) has NOT yet been initialized')
  console.log('  Result: ReferenceError: Cannot access scheduleFlush before initialization')
  console.log('')
  console.log('  Evidence: Error at useOfflineQueue.js:118 - matches the closing }) of the useEffect')

  // Final summary
  console.log('')
  console.log('=== FINAL SUMMARY ===')
  console.log('FIX-10 (code.startsWith): ' + (p1_startsWith.length + p2_startsWith.length === 0 ? 'PASS' : 'FAIL'))
  console.log('FIX-1 (stale closure): FAIL - introduced TDZ crash (new Blocker)')
  console.log('FIX-2 (content reconciliation): ' + (p2_text.includes('Resume') ? 'PARTIAL - page 2 works but page 1 crashes' : 'BLOCKED by FIX-1 crash'))
  console.log('B14G-006 (Resume from position): ' + (resumeFromMatch ? 'FIXED' : 'UNVERIFIED'))

  await sleep(2000)
  await browser.close()
  console.log('Done.')
}

run().catch(e => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
