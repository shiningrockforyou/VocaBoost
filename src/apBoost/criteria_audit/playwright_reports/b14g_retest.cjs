/**
 * B14G Retest Script
 * Verifies FIX-1 (stale closure), FIX-2 (content-based reconciliation), FIX-10 (logError)
 */
const { chromium } = require('playwright')

const BASE_URL = 'http://localhost:5173'
const EMAIL = 'student10@apboost.test'
const PASSWORD = 'Student123!'
const TEST_ID = 'test_micro_full_1'

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function clearAllIDB(page) {
  return page.evaluate(async () => {
    return new Promise((resolve) => {
      const req = indexedDB.open('ap_boost_queue', 1)
      req.onsuccess = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains('actions')) { resolve(0); return }
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

async function clickFirstAnswer(page) {
  const strategies = [
    'button[class*="answer"]',
    '[data-testid*="choice"]',
  ]
  for (const sel of strategies) {
    try {
      const els = await page.locator(sel).all()
      if (els.length > 0) {
        await els[0].click()
        return true
      }
    } catch(e) {}
  }
  // Find all buttons and click the one containing (A) or just "A"
  try {
    const allBtns = await page.locator('button').all()
    for (const btn of allBtns) {
      const text = await btn.textContent().catch(() => '')
      if (text && (text.includes('(A)') || text.match(/^\s*A[\s.]\s*/))) {
        await btn.click()
        return true
      }
    }
  } catch(e) {}
  // Last resort: click second button (often the first answer)
  try {
    const btns = await page.locator('button').all()
    if (btns.length >= 2) {
      await btns[1].click()
      return true
    }
  } catch(e) {}
  return false
}

async function run() {
  const browser = await chromium.launch({ headless: false, slowMo: 150 })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  const consoleErrors = []
  const startsWith_errors = []

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text()
      consoleErrors.push(text)
      if (text.includes('startsWith')) startsWith_errors.push(text)
    }
    if (msg.type() === 'log' && msg.text().includes('[APBoost:')) {
      process.stdout.write('    [LOG] ' + msg.text().substring(0, 150) + '\n')
    }
  })

  page.on('pageerror', err => {
    consoleErrors.push('[PAGEERROR] ' + err.message)
    if (err.message.includes('startsWith')) startsWith_errors.push('[PAGEERROR] ' + err.message)
  })

  console.log('=== B14G RETEST: FIX-1, FIX-2, FIX-10 ===')
  console.log('')

  // STEP 1: Login
  console.log('[1] Navigating to login...')
  await page.goto(BASE_URL + '/login')
  await page.waitForTimeout(2000)

  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(3000)

  console.log('    URL after login: ' + page.url())
  if (!page.url().includes('/ap')) {
    await page.goto(BASE_URL + '/ap')
    await page.waitForTimeout(2000)
  }
  console.log('    Final URL: ' + page.url())
  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14g_retest_01_login.png' })

  // STEP 2: Clear IDB and navigate to test
  console.log('[2] Clearing IDB and navigating to test...')
  await clearAllIDB(page)
  await page.goto(BASE_URL + '/ap/test/' + TEST_ID)
  await page.waitForTimeout(4000)
  console.log('    URL: ' + page.url())

  const instrText = await page.evaluate(() => document.body.innerText.substring(0, 500))
  console.log('    Page text: ' + instrText)

  // Check for startsWith errors on load (FIX-10)
  console.log('[FIX-10] startsWith errors on initial load: ' + startsWith_errors.length)
  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14g_retest_02_instruction.png' })

  // STEP 3: Click Resume or Begin
  console.log('[3] Starting test...')
  try {
    await page.click('button:has-text("Resume")')
  } catch(e) {
    try {
      await page.click('button:has-text("Begin")')
    } catch(e2) {
      console.log('    Could not find Begin/Resume: ' + e2.message)
    }
  }
  await page.waitForTimeout(3000)
  console.log('    URL after begin: ' + page.url())
  const testText = await page.evaluate(() => document.body.innerText.substring(0, 600))
  console.log('    Test page: ' + testText)
  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14g_retest_03_started.png' })

  // STEP 4: Answer Q1-Q5 normally
  console.log('[4] Answering Q1-Q5 online...')
  for (let q = 1; q <= 5; q++) {
    if (q > 1) {
      try { await page.click('button:has-text("Next")') } catch(e) {}
      await page.waitForTimeout(800)
    }
    const answered = await clickFirstAnswer(page)
    console.log('    Q' + q + ': ' + (answered ? 'answered' : 'FAILED to answer'))
    await page.waitForTimeout(700)
  }

  const idbQ5 = await getAllIDBItems(page)
  console.log('    IDB after Q5: total=' + idbQ5.length + ', pending=' + idbQ5.filter(i => i.status === 'PENDING').length)
  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14g_retest_04_q5.png' })

  // STEP 5: Block Firestore, answer Q6-Q8
  console.log('[5] BLOCKING Firestore (offline simulation)...')
  await page.route('**/firestore.googleapis.com/**', route => route.abort())

  for (let q = 6; q <= 8; q++) {
    try { await page.click('button:has-text("Next")') } catch(e) {}
    await page.waitForTimeout(700)
    const answered = await clickFirstAnswer(page)
    console.log('    Q' + q + ' (OFFLINE): ' + (answered ? 'answered' : 'FAILED'))
    await page.waitForTimeout(600)
  }

  await page.waitForTimeout(1000)
  const idbOffline = await getAllIDBItems(page)
  const pendingOffline = idbOffline.filter(i => i.status === 'PENDING')
  const answerChanges = pendingOffline.filter(i => i.action === 'ANSWER_CHANGE')
  console.log('    IDB (offline): total=' + idbOffline.length + ', pending=' + pendingOffline.length + ', answerChanges=' + answerChanges.length)
  console.log('    Queued items: ' + JSON.stringify(pendingOffline.map(i => ({ action: i.action, qId: i.payload && i.payload.questionId }))))
  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14g_retest_05_offline.png' })

  // STEP 6: Restore network — FIX-1 verification
  console.log('[6] Restoring network — FIX-1 sync verification...')
  await page.unroute('**/firestore.googleapis.com/**')

  let syncComplete = false
  let syncTime = -1
  const pendingAtTimes = []
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(1000)
    const idbNow = await getAllIDBItems(page)
    const pendingNow = idbNow.filter(x => x.status === 'PENDING')
    pendingAtTimes.push(pendingNow.length)
    console.log('    t+' + (i+1) + 's: pending=' + pendingNow.length)
    if (pendingNow.length === 0) {
      syncComplete = true
      syncTime = i + 1
      console.log('    FIX-1 SYNC COMPLETE at t+' + syncTime + 's!')
      break
    }
  }

  if (!syncComplete) {
    const idbFinal = await getAllIDBItems(page)
    const pendingFinal = idbFinal.filter(x => x.status === 'PENDING')
    console.log('    FIX-1 FAIL: ' + pendingFinal.length + ' pending after 15s')
    console.log('    Stuck items: ' + JSON.stringify(pendingFinal.map(i => ({ action: i.action, qId: i.payload && i.payload.questionId }))))
  }

  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14g_retest_06_post_restore.png' })

  // STEP 7: Answer Q9-Q12
  console.log('[7] Answering Q9-Q12...')
  for (let q = 9; q <= 12; q++) {
    try { await page.click('button:has-text("Next")') } catch(e) {}
    await page.waitForTimeout(700)
    const answered = await clickFirstAnswer(page)
    console.log('    Q' + q + ': ' + (answered ? 'answered' : 'FAILED'))
    await page.waitForTimeout(600)
  }

  const idbAfterQ12 = await getAllIDBItems(page)
  const pendingQ12 = idbAfterQ12.filter(i => i.status === 'PENDING')
  console.log('    IDB after Q12: total=' + idbAfterQ12.length + ', pending=' + pendingQ12.length)

  let sessionId = null
  if (idbAfterQ12.length > 0) {
    sessionId = idbAfterQ12[0].sessionId
    console.log('    Session ID: ' + sessionId)
  }

  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14g_retest_07_q12.png' })

  // STEP 8: Close page
  console.log('[8] Closing page...')
  await page.close()
  await sleep(2000)

  // STEP 9: Reopen — FIX-2 verification
  console.log('[9] Reopening page (FIX-2 verification)...')
  const page2 = await context.newPage()
  const consoleErrors2 = []
  const startsWith_errors2 = []

  page2.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text()
      consoleErrors2.push(text)
      if (text.includes('startsWith')) startsWith_errors2.push(text)
    }
    if (msg.type() === 'log' && msg.text().includes('[APBoost:')) {
      process.stdout.write('    [LOG2] ' + msg.text().substring(0, 200) + '\n')
    }
  })

  page2.on('pageerror', err => {
    consoleErrors2.push('[PAGEERROR] ' + err.message)
    if (err.message.includes('startsWith')) startsWith_errors2.push('[PAGEERROR] ' + err.message)
  })

  await page2.goto(BASE_URL + '/ap/test/' + TEST_ID)
  await page2.waitForTimeout(5000)
  console.log('    URL after reopen: ' + page2.url())
  console.log('[FIX-10] startsWith errors on reopen: ' + startsWith_errors2.length)

  const instrText2 = await page2.evaluate(() => document.body.innerText.substring(0, 600))
  console.log('    Page text: ' + instrText2)
  await page2.screenshot({ path: 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14g_retest_08_reopen.png' })

  // STEP 10: Click Resume
  console.log('[10] Clicking Resume (FIX-2 check)...')
  try {
    await page2.click('button:has-text("Resume")')
  } catch(e) {
    try { await page2.click('button:has-text("Begin")') } catch(e2) {}
  }
  await page2.waitForTimeout(5000)
  console.log('    URL after resume: ' + page2.url())

  const resumedText = await page2.evaluate(() => document.body.innerText.substring(0, 800))
  console.log('    Resumed page text: ' + resumedText)
  await page2.screenshot({ path: 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14g_retest_09_resumed.png' })

  // STEP 11: Navigate to review for answer count (FIX-2)
  console.log('[11] Checking answer count via navigator (FIX-2)...')
  // Try to open navigator modal
  try {
    const navBtns = await page2.locator('button').all()
    for (const btn of navBtns) {
      const txt = await btn.textContent().catch(() => '')
      if (txt && (txt.includes('Navigator') || txt.includes('navigator'))) {
        await btn.click()
        break
      }
    }
    await page2.waitForTimeout(1500)
    await page2.screenshot({ path: 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14g_retest_10_navigator.png' })
    const navText = await page2.evaluate(() => document.body.innerText.substring(0, 2000))
    console.log('    Navigator content: ' + navText.substring(0, 1000))
  } catch(e) {
    console.log('    Navigator error: ' + e.message)
  }

  // Navigate to last MCQ question then click Review
  console.log('[12] Navigating to MCQ review...')
  // Click Next multiple times to reach end
  let clickCount = 0
  while (clickCount < 12) {
    const nextVisible = await page2.locator('button:has-text("Next")').isVisible().catch(() => false)
    if (!nextVisible) break
    await page2.click('button:has-text("Next")').catch(() => {})
    await page2.waitForTimeout(500)
    clickCount++
  }
  console.log('    Clicked Next ' + clickCount + ' times')

  // Now try clicking Review
  try {
    await page2.click('button:has-text("Review")')
    await page2.waitForTimeout(2000)
    await page2.screenshot({ path: 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14g_retest_11_review.png' })
    const reviewText = await page2.evaluate(() => document.body.innerText)
    console.log('    Review screen full text: ' + reviewText.substring(0, 3000))

    // Try to extract answered count
    const match = reviewText.match(/Answered[:\s]*(\d+)\/(\d+)/i)
    if (match) {
      const answered = parseInt(match[1])
      const total = parseInt(match[2])
      console.log('    FIX-2 CHECK: Answered ' + answered + '/' + total + ' on MCQ review')
      if (answered >= 12) {
        console.log('    FIX-2 PASS: 12+ answers present after resume!')
      } else {
        console.log('    FIX-2 FAIL: Only ' + answered + ' answers (expected 12)')
      }
    } else {
      // Count lines with "Answered" status
      const lines = reviewText.split('\n')
      const answeredLines = lines.filter(l => l.match(/answered|selected/i) && !l.match(/unanswered/i))
      console.log('    Answered-status lines: ' + answeredLines.length)
      const unansweredLines = lines.filter(l => l.match(/unanswered/i))
      console.log('    Unanswered lines: ' + unansweredLines.join(' | '))
    }
  } catch(e) {
    console.log('    Could not reach review: ' + e.message)
  }

  // FINAL SUMMARY
  console.log('')
  console.log('=== FINAL SUMMARY ===')
  const totalStartsWith = startsWith_errors.length + startsWith_errors2.length
  console.log('FIX-10 (code.startsWith): ' + (totalStartsWith === 0 ? 'PASS - 0 errors' : 'FAIL - ' + totalStartsWith + ' errors'))
  console.log('FIX-1 (sync on reconnect): ' + (syncComplete ? 'PASS - completed at t+' + syncTime + 's' : 'FAIL - items stuck after 15s'))
  console.log('Pending counts over time: ' + pendingAtTimes.join(', '))
  console.log('')
  console.log('All console errors (page 1, ' + consoleErrors.length + ' total):')
  consoleErrors.slice(0, 20).forEach(e => console.log('  ERR: ' + e.substring(0, 200)))
  console.log('')
  console.log('All console errors (page 2, ' + consoleErrors2.length + ' total):')
  consoleErrors2.slice(0, 20).forEach(e => console.log('  ERR: ' + e.substring(0, 200)))

  await sleep(2000)
  await browser.close()
  console.log('Script complete.')
}

run().catch(e => {
  console.error('FATAL ERROR:', e.message)
  process.exit(1)
})
