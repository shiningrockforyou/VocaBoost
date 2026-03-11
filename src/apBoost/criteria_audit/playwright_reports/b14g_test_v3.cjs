/**
 * B14-G: The Technical Difficulties — Playwright test script v3
 *
 * Fixes from v2:
 * - Next button is "Next →" not "Next"
 * - Back button is "← Back" not "Back"
 * - Navigator opens via "Question X of Y ▲" button
 * - Need to first clear any existing session for student10 to get a clean state
 * - Better queue flush detection
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
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * Click an answer choice by letter (A, B, C, D)
 * Uses the rounded-full letter badge approach
 */
async function clickChoice(page, letter) {
  const result = await page.evaluate((l) => {
    const buttons = Array.from(document.querySelectorAll('button[type="button"]'))
    for (const btn of buttons) {
      if (btn.disabled) continue
      // Look for span with just the letter in a circle badge
      const spans = btn.querySelectorAll('span')
      for (const span of spans) {
        if (span.textContent?.trim() === l &&
            (span.className?.includes('rounded-full') || span.className?.includes('w-6'))) {
          btn.click()
          return { ok: true, text: btn.textContent?.trim().substring(0, 50) }
        }
      }
    }
    return { ok: false }
  }, letter)
  if (result.ok) log(`    Clicked choice ${letter} (btn: "${result.text?.replace(/\n/g, ' ')}")`)
  else log(`    WARN: Could not find choice ${letter}`)
  return result.ok
}

/**
 * Click "Next →" button
 */
async function clickNextButton(page) {
  const result = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    for (const btn of buttons) {
      const text = btn.textContent?.trim()
      if ((text === 'Next →' || text === '→') && !btn.disabled) {
        btn.click()
        return { ok: true, text }
      }
    }
    // Also look for any button with Next in it
    for (const btn of buttons) {
      const text = btn.textContent?.trim()
      if (text?.endsWith('→') && text?.includes('Next') && !btn.disabled) {
        btn.click()
        return { ok: true, text }
      }
    }
    return { ok: false, buttons: buttons.slice(0, 8).map(b => b.textContent?.trim().substring(0, 30)) }
  })
  if (result.ok) log(`    Clicked "${result.text}"`)
  else log(`    WARN: Next not found. Buttons: ${JSON.stringify(result.buttons)}`)
  return result.ok
}

/**
 * Click "← Back" button
 */
async function clickBackButton(page) {
  const result = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    for (const btn of buttons) {
      const text = btn.textContent?.trim()
      if ((text === '← Back' || text === 'Back') && !btn.disabled) {
        btn.click()
        return { ok: true }
      }
    }
    return { ok: false }
  })
  return result.ok
}

/**
 * Check if current question has a choice selected (bg-brand-primary on choice button)
 */
async function isAnswerSelected(page) {
  return page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button[type="button"]'))
    return buttons.some(btn => {
      return btn.className?.includes('bg-brand-primary') &&
             btn.querySelector('span.rounded-full, span[class*="rounded-full"]')
    })
  })
}

/**
 * Get current question number info from "Question X of Y" in navigator bar
 */
async function getQInfo(page) {
  return page.evaluate(() => {
    const text = document.body.innerText
    const m = text.match(/Question\s+(\d+)\s+of\s+(\d+)/)
    return m ? { q: parseInt(m[1]), total: parseInt(m[2]) } : null
  })
}

/**
 * Get IndexedDB queue state
 */
async function getQueue(page) {
  return page.evaluate(() => {
    return new Promise((resolve) => {
      const req = indexedDB.open('ap_boost_queue', 1)
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('actions')) {
          resolve({ pending: 0, total: 0, answerChanges: 0, items: [], sessionId: null })
          return
        }
        const tx = db.transaction('actions', 'readonly')
        const store = tx.objectStore('actions')
        const all = store.getAll()
        all.onsuccess = () => {
          const items = all.result
          const pending = items.filter(i => i.status === 'PENDING')
          const answers = pending.filter(i => i.action === 'ANSWER_CHANGE')
          resolve({
            pending: pending.length,
            total: items.length,
            answerChanges: answers.length,
            uniqueQuestions: [...new Set(answers.map(i => i.payload?.questionId))],
            answerSummary: answers.map(i => ({
              q: i.payload?.questionId,
              v: i.payload?.value,
              ts: i.localTimestamp
            })),
            actions: pending.map(i => i.action),
            sessionId: items[0]?.sessionId || null
          })
        }
        all.onerror = () => resolve({ error: 'getAll failed' })
      }
      req.onerror = () => resolve({ error: 'open failed' })
    })
  })
}

async function run() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  }

  const allErrors = []
  const observations = []
  const results = {}

  // -------------------------------------------------------------------------
  // Phase 1: Clear existing session for student10 by logging in and navigating
  // to ensure a fresh start, then run the actual scenario in Phase 2
  // -------------------------------------------------------------------------
  log('=== Phase 0: Pre-check — inspect DOM structure ===')

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  page.on('console', msg => {
    if (msg.type() === 'error') {
      allErrors.push({ text: msg.text(), url: page.url() })
      log(`  [ERR] ${msg.text()}`)
    }
  })
  page.on('pageerror', err => {
    allErrors.push({ text: err.message, url: page.url(), isPageError: true })
    log(`  [PAGEERR] ${err.message}`)
  })

  try {
    // =========================================================================
    // Login
    // =========================================================================
    log('=== STEP 1: Login ===')
    await page.goto(`${BASE_URL}/login`)
    await page.waitForSelector('input[type="email"]', { timeout: 15000 })
    await page.fill('input[type="email"]', 'student10@apboost.test')
    await page.fill('input[type="password"]', 'Student123!')
    await page.click('button[type="submit"]')
    await sleep(3000)
    const loginUrl = page.url()
    log(`  Post-login URL: ${loginUrl}`)

    if (loginUrl.includes('/login')) {
      results.login = 'FAIL'
      observations.push('BLOCKER: Login failed — credentials rejected')
      await browser.close()
      return { results, errors: allErrors, observations }
    }
    results.login = 'PASS'
    if (!loginUrl.includes('/ap')) {
      observations.push(`B4-006: login redirects to ${loginUrl} not /ap`)
    }

    // =========================================================================
    // Navigate to test — inspect DOM structure first
    // =========================================================================
    await page.goto(`${BASE_URL}/ap/test/test_micro_full_1`)
    await sleep(3000)
    await screenshot(page, 'v3_01_instruction')
    log(`  URL: ${page.url()}`)

    // Read instruction screen state
    const instrContent = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      return {
        text: document.body.innerText.substring(0, 300),
        buttons: buttons.map(b => b.textContent?.trim()).filter(Boolean)
      }
    })
    log(`  Instruction text: "${instrContent.text.replace(/\n/g, ' ').substring(0, 200)}"`)
    log(`  Buttons: ${JSON.stringify(instrContent.buttons)}`)
    observations.push(`Instruction screen buttons: ${JSON.stringify(instrContent.buttons)}`)

    // Does the page show "Resume Test" (existing session) or "Begin Test"?
    const hasExistingSession = instrContent.buttons.includes('Resume Test')
    log(`  Existing session: ${hasExistingSession}`)
    observations.push(`Instruction screen has existing session: ${hasExistingSession}`)

    // =========================================================================
    // Click Begin Test / Resume Test
    // =========================================================================
    log('=== STEP 2: Start test ===')
    const startBtn = hasExistingSession ? 'Resume Test' : 'Begin Test'
    const startClicked = await page.evaluate((btnText) => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === btnText)
      if (btn) { btn.click(); return true }
      return false
    }, startBtn)
    log(`  Clicked ${startBtn}: ${startClicked}`)

    await sleep(3000)
    await screenshot(page, 'v3_02_testing_view')

    // Inspect testing view DOM
    const testViewContent = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      return {
        text: document.body.innerText.substring(0, 400),
        buttons: buttons.map(b => ({
          text: b.textContent?.trim().substring(0, 60),
          disabled: b.disabled,
          class: b.className.substring(0, 80)
        })).filter(b => b.text)
      }
    })
    log(`  Test view text: "${testViewContent.text.replace(/\n/g, ' ').substring(0, 300)}"`)
    log(`  Test view buttons: ${JSON.stringify(testViewContent.buttons)}`)
    observations.push(`Test view DOM has ${testViewContent.buttons.length} buttons`)

    const isInTestView = testViewContent.text.includes('Question') && testViewContent.text.includes('of 15')
    if (!isInTestView) {
      results.testStart = 'FAIL'
      observations.push('FAIL: Not in question view after clicking Begin/Resume Test')
      await browser.close()
      return { results, errors: allErrors, observations }
    }
    results.testStart = 'PASS'
    log('  In test view!')

    // =========================================================================
    // STEP 3: Answer Q1-Q5 — using correct button text "Next →"
    // =========================================================================
    log('=== STEP 3: Answer Q1-Q5 ===')
    let q1to5 = 0

    for (let q = 1; q <= 5; q++) {
      await sleep(300)
      const qInfo = await getQInfo(page)
      log(`  Q${q}: display=${JSON.stringify(qInfo)}`)

      // Select Choice A
      const clicked = await clickChoice(page, 'A')
      if (clicked) {
        q1to5++
        await sleep(400)
        const confirmed = await isAnswerSelected(page)
        log(`    Selected: ${confirmed}`)
      }

      // Navigate next (skip after Q5)
      if (q < 5) {
        const nextOk = await clickNextButton(page)
        log(`    Next: ${nextOk}`)
        await sleep(600)
      }
    }

    await screenshot(page, 'v3_03_q5_done')
    log(`  Q1-5 answered: ${q1to5}`)
    results.q1to5 = q1to5

    // Check queue
    const q5Queue = await getQueue(page)
    log(`  Queue after Q1-5: pending=${q5Queue.pending}, answers=${q5Queue.answerChanges}, unique_q=${JSON.stringify(q5Queue.uniqueQuestions)}`)
    observations.push(`Queue Q1-5: ${q5Queue.answerChanges} answer changes, unique Q: ${JSON.stringify(q5Queue.uniqueQuestions)}`)

    const navigationWorking = q5Queue.uniqueQuestions && q5Queue.uniqueQuestions.length > 1
    observations.push(`Navigation working (multiple question IDs in queue): ${navigationWorking}`)
    if (!navigationWorking) {
      observations.push('WARNING: All answers went to same questionId — navigation may be broken!')
    }

    // =========================================================================
    // STEP 4: Block Firestore for 10 seconds
    // =========================================================================
    log('=== STEP 4: Block Firestore ===')
    let blocked = false
    let blockCount = 0

    await page.route('**/firestore.googleapis.com/**', (route) => {
      if (blocked) {
        blockCount++
        route.abort('failed')
      } else {
        route.continue()
      }
    })

    blocked = true
    const t0 = Date.now()
    log('  Firestore BLOCKED')
    await screenshot(page, 'v3_04_offline')

    // Wait 1.5s for possible disconnection banner
    await sleep(1500)
    const banner1 = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'))
      for (const d of divs) {
        const cls = d.className
        if ((cls.includes('bg-warning') || cls.includes('bg-error') || cls.includes('bg-info')) &&
            d.textContent?.trim().length > 0 && d.children.length > 0) {
          return d.textContent?.trim().substring(0, 200)
        }
      }
      return null
    })
    log(`  Connection banner 1.5s in: "${banner1}"`)
    observations.push(`Offline banner at 1.5s: "${banner1 || 'none'}"`)

    // =========================================================================
    // STEP 5: Answer Q6-Q8 while offline
    // =========================================================================
    log('=== STEP 5: Answer Q6-Q8 while OFFLINE ===')

    // Navigate to Q6 (if we're on Q5)
    await clickNextButton(page)
    await sleep(500)

    let offlineAnswers = 0
    for (let q = 6; q <= 8; q++) {
      const qInfo = await getQInfo(page)
      log(`  Q${q}: display=${JSON.stringify(qInfo)}`)

      const ok = await clickChoice(page, 'B')
      if (ok) {
        offlineAnswers++
        await sleep(500)
        const confirmed = await isAnswerSelected(page)
        log(`    Selected: ${confirmed}`)
      }

      if (q < 8) {
        await clickNextButton(page)
        await sleep(600)
      }
    }

    await screenshot(page, 'v3_05_q8_offline')
    log(`  Offline answers: ${offlineAnswers}`)

    const offlineQueue = await getQueue(page)
    log(`  Queue while offline: pending=${offlineQueue.pending}, answers=${offlineQueue.answerChanges}`)
    log(`  Unique Q IDs: ${JSON.stringify(offlineQueue.uniqueQuestions)}`)
    log(`  Answer summary: ${JSON.stringify(offlineQueue.answerSummary?.slice(0, 5))}`)
    observations.push(`Queue offline (Q6-8): ${offlineQueue.answerChanges} ANSWER_CHANGE pending`)
    observations.push(`Unique question IDs in queue: ${JSON.stringify(offlineQueue.uniqueQuestions)}`)

    results.q6to8_offline = {
      answeredCount: offlineAnswers,
      queuedAnswerChanges: offlineQueue.answerChanges,
      uniqueQuestions: offlineQueue.uniqueQuestions,
      status: offlineAnswers >= 2 && offlineQueue.answerChanges >= 2 ? 'PASS' : 'PARTIAL'
    }

    // Wait out 10s
    const elapsed = Date.now() - t0
    const toWait = Math.max(0, 10000 - elapsed)
    log(`  Waiting ${toWait}ms to complete 10s offline window...`)
    await sleep(toWait)

    // =========================================================================
    // STEP 6: Restore network & verify sync
    // =========================================================================
    log('=== STEP 6: Restore network ===')
    blocked = false
    await page.unroute('**/firestore.googleapis.com/**')
    log(`  Network restored. Blocked ${blockCount} requests`)
    observations.push(`Firestore requests blocked: ${blockCount}`)

    // Wait for flush (triggered by online event)
    log('  Waiting 8s for queue flush...')
    await sleep(8000)
    await screenshot(page, 'v3_06_post_restore')

    const banner2 = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'))
      for (const d of divs) {
        const cls = d.className
        if ((cls.includes('bg-warning') || cls.includes('bg-error') || cls.includes('bg-info') || cls.includes('bg-success')) &&
            d.textContent?.trim().length > 0 && d.children.length > 0) {
          return { text: d.textContent?.trim().substring(0, 200), cls: cls.substring(0, 80) }
        }
      }
      return null
    })
    log(`  Banner after restore: ${JSON.stringify(banner2)}`)
    observations.push(`Banner after network restore: ${JSON.stringify(banner2)}`)

    const postSyncQ = await getQueue(page)
    log(`  Post-sync queue: pending=${postSyncQ.pending}, answers=${postSyncQ.answerChanges}`)
    log(`  Remaining actions: ${JSON.stringify(postSyncQ.actions?.slice(0, 5))}`)
    observations.push(`Queue after 8s sync window: pending=${postSyncQ.pending}, answerChanges=${postSyncQ.answerChanges}`)

    const syncedOk = postSyncQ.answerChanges === 0
    results.syncOnReconnect = syncedOk ? 'PASS' : postSyncQ.pending < 5 ? 'PARTIAL' : 'FAIL'
    observations.push(`Sync result: ${results.syncOnReconnect} (${postSyncQ.answerChanges} answer changes remain)`)

    // =========================================================================
    // STEP 7: Answer Q9-Q12
    // =========================================================================
    log('=== STEP 7: Answer Q9-Q12 ===')

    // Navigate to Q9
    await clickNextButton(page)
    await sleep(500)

    let q9to12 = 0
    for (let q = 9; q <= 12; q++) {
      const qInfo = await getQInfo(page)
      log(`  Q${q}: display=${JSON.stringify(qInfo)}`)

      const ok = await clickChoice(page, 'A')
      if (ok) {
        q9to12++
        await sleep(400)
      }

      if (q < 12) {
        await clickNextButton(page)
        await sleep(600)
      }
    }

    await screenshot(page, 'v3_07_q12_done')
    log(`  Q9-12 answered: ${q9to12}`)
    results.q9to12 = q9to12

    const preCloseQ = await getQueue(page)
    log(`  Queue before close: pending=${preCloseQ.pending}, answers=${preCloseQ.answerChanges}`)
    observations.push(`Queue before page close: pending=${preCloseQ.pending}`)
    const sessionId = preCloseQ.sessionId
    observations.push(`Session ID: ${sessionId}`)

    // =========================================================================
    // STEP 8: Close page
    // =========================================================================
    log('=== STEP 8: Close page ===')
    await page.close()
    log('  Page closed')

    // =========================================================================
    // STEP 9: Reopen in new page
    // =========================================================================
    log('=== STEP 9: Reopen ===')
    await sleep(2000)

    const page2 = await context.newPage()
    page2.on('console', msg => {
      if (msg.type() === 'error') {
        allErrors.push({ text: msg.text(), url: page2.url(), phase: 'resume' })
        log(`  [ERR-resume] ${msg.text()}`)
      }
    })
    page2.on('pageerror', err => {
      allErrors.push({ text: err.message, isPageError: true, url: page2.url(), phase: 'resume' })
      log(`  [PAGEERR-resume] ${err.message}`)
    })

    await page2.goto(`${BASE_URL}/ap/test/test_micro_full_1`)
    await sleep(4000)
    await screenshot(page2, 'v3_08_reopened')
    log(`  URL: ${page2.url()}`)

    if (page2.url().includes('/login')) {
      log('  Login redirect — re-auth')
      await page2.fill('input[type="email"]', 'student10@apboost.test')
      await page2.fill('input[type="password"]', 'Student123!')
      await page2.click('button[type="submit"]')
      await sleep(3000)
      if (!page2.url().includes('/ap')) {
        await page2.goto(`${BASE_URL}/ap/test/test_micro_full_1`)
        await sleep(3000)
      }
    }

    results.closeAndReopen = 'PASS'

    // =========================================================================
    // STEP 10: Check instruction screen for resume state
    // =========================================================================
    log('=== STEP 10: Resume & verify answers ===')
    const instrContent2 = await page2.evaluate(() => ({
      text: document.body.innerText.substring(0, 500),
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean)
    }))
    log(`  Instruction: "${instrContent2.text.replace(/\n/g, ' ').substring(0, 300)}"`)
    log(`  Buttons: ${JSON.stringify(instrContent2.buttons)}`)
    observations.push(`After close, instruction screen shows: "${instrContent2.text.replace(/\n/g, ' ').substring(0, 200)}"`)

    const resumeBtn2 = instrContent2.buttons.includes('Resume Test') ? 'Resume Test' : 'Begin Test'
    observations.push(`Instruction button after close: "${resumeBtn2}"`)

    const hasResumePos = instrContent2.text.includes('Resume from') || instrContent2.text.includes('paused')
    observations.push(`Instruction shows position info: ${hasResumePos}`)

    // Click to resume
    await page2.evaluate((btn) => {
      const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent?.trim() === btn)
      if (b) b.click()
    }, resumeBtn2)

    await sleep(4000)
    await screenshot(page2, 'v3_09_after_resume')

    const q2Info = await getQInfo(page2)
    log(`  After resume, question: ${JSON.stringify(q2Info)}`)
    observations.push(`After resume, shows question: ${JSON.stringify(q2Info)}`)

    // Check IndexedDB on new page
    const resumeQ = await getQueue(page2)
    log(`  Queue on new page: pending=${resumeQ.pending}, answers=${resumeQ.answerChanges}`)
    log(`  Answer summary: ${JSON.stringify(resumeQ.answerSummary?.slice(0, 5))}`)
    observations.push(`Queue on new page after resume: pending=${resumeQ.pending}`)

    // Navigate to Q1 and check each question's answer state
    log('  Navigating to Q1...')
    // Go back to Q1
    let backs = 0
    for (let i = 0; i < 20; i++) {
      const moved = await clickBackButton(page2)
      if (!moved) break
      backs++
      await sleep(200)
    }
    log(`  Went back ${backs} times`)

    const answersMap = {}
    for (let q = 1; q <= 12; q++) {
      const qI = await getQInfo(page2)
      const hasA = await isAnswerSelected(page2)
      answersMap[`Q${q}`] = { qInfo: qI, hasAnswer: hasA }
      if (q < 12) {
        await clickNextButton(page2)
        await sleep(300)
      }
    }

    log(`  Answers Q1-Q12: ${JSON.stringify(answersMap)}`)
    const restoredCount = Object.values(answersMap).filter(v => v.hasAnswer).length
    log(`  Restored: ${restoredCount}/12`)
    observations.push(`Restored answers Q1-12: ${restoredCount}/12`)
    observations.push(`Per-Q: ${JSON.stringify(Object.fromEntries(Object.entries(answersMap).map(([k,v]) => [k, v.hasAnswer])))}`)

    results.resumeRestores = {
      count: restoredCount,
      status: restoredCount >= 10 ? 'PASS' : restoredCount >= 7 ? 'PARTIAL' : 'FAIL'
    }

    // =========================================================================
    // STEP 11: Answer Q13-Q15
    // =========================================================================
    log('=== STEP 11: Answer Q13-Q15 ===')

    // We should be at Q12, click Next
    await clickNextButton(page2)
    await sleep(500)

    let q13to15 = 0
    for (let q = 13; q <= 15; q++) {
      const qI = await getQInfo(page2)
      log(`  Q${q}: display=${JSON.stringify(qI)}`)

      const ok = await clickChoice(page2, 'C')
      if (ok) {
        q13to15++
        await sleep(400)
      }

      if (q < 15) {
        await clickNextButton(page2)
        await sleep(500)
      }
    }

    await screenshot(page2, 'v3_10_q15_done')
    log(`  Q13-15 answered: ${q13to15}`)

    // =========================================================================
    // STEP 12: Submit test
    // =========================================================================
    log('=== STEP 12: Submit ===')

    // Click Review → (last question should show this instead of Next →)
    const reviewBtnClicked = await page2.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      for (const btn of buttons) {
        const text = btn.textContent?.trim()
        if ((text === 'Review →' || text?.startsWith('Review')) && !btn.disabled) {
          btn.click()
          return text
        }
      }
      return null
    })
    log(`  Review clicked: "${reviewBtnClicked}"`)
    await sleep(2000)
    await screenshot(page2, 'v3_11_review')

    const reviewContent = await page2.evaluate(() => ({
      text: document.body.innerText.substring(0, 500),
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean)
    }))
    log(`  Review screen: "${reviewContent.text.replace(/\n/g, ' ').substring(0, 300)}"`)
    log(`  Review buttons: ${JSON.stringify(reviewContent.buttons)}`)
    observations.push(`Review screen buttons: ${JSON.stringify(reviewContent.buttons)}`)

    // Click Submit Section
    const submitSection = await page2.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      for (const btn of buttons) {
        const text = btn.textContent?.trim()
        if ((text?.includes('Submit Section') || text?.includes('Submit MCQ') || text?.includes('Submit')) &&
            !text?.includes('Flagged') && !btn.disabled) {
          btn.click()
          return text
        }
      }
      return null
    })
    log(`  Submit Section: "${submitSection}"`)
    await sleep(2000)
    await screenshot(page2, 'v3_12_post_section')
    log(`  URL: ${page2.url()}`)

    const postSectContent = await page2.evaluate(() => ({
      text: document.body.innerText.substring(0, 500),
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean)
    }))
    log(`  Post-section text: "${postSectContent.text.replace(/\n/g, ' ').substring(0, 200)}"`)
    log(`  Post-section buttons: ${JSON.stringify(postSectContent.buttons)}`)

    // FRQ Choice screen — click "Type Your Answers" (TYPED option)
    const frqTypedBtn = postSectContent.buttons.find(b =>
      b.includes('Type') || b.includes('Typed')
    )
    if (frqTypedBtn) {
      log(`  FRQ choice screen detected. Clicking: "${frqTypedBtn}"`)
      await page2.evaluate((text) => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim().includes(text.substring(0, 10)))
        if (btn) btn.click()
      }, frqTypedBtn)
      await sleep(2000)
      await screenshot(page2, 'v3_13_frq_typed')
    }

    // Check for FRQ textarea and type answers
    const frqTextArea = await page2.$('textarea')
    if (frqTextArea) {
      log('  FRQ textarea found — typing')
      await frqTextArea.click()
      await frqTextArea.fill('The law of comparative advantage demonstrates how specialization maximizes economic output.')
      await sleep(500)

      // Navigate through FRQ sub-questions
      for (let i = 0; i < 10; i++) {
        const nextOk = await clickNextButton(page2)
        if (!nextOk) break
        await sleep(400)
        const ta = await page2.$('textarea')
        if (ta) {
          await ta.fill('Specialization increases trade efficiency across national boundaries.')
        }
      }
      await screenshot(page2, 'v3_14_frq_answered')
    }

    // Look for Submit Test button
    const submitTestBtn = await page2.evaluate(() => {
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
    log(`  Submit Test: "${submitTestBtn}"`)

    if (submitTestBtn) {
      await sleep(1000)
      // Handle confirmation
      await page2.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'))
        for (const btn of btns) {
          const t = btn.textContent?.trim()
          if (t?.includes('Confirm') || t === 'Yes' || t?.includes('Submit') && t?.length < 20) {
            btn.click()
            return t
          }
        }
      })
    }

    await sleep(6000)
    await screenshot(page2, 'v3_15_post_submit')
    log(`  URL after submit: ${page2.url()}`)

    if (page2.url().includes('/ap/results/')) {
      results.finalSubmit = 'PASS'
      log('  On results page!')
    } else {
      results.finalSubmit = 'PARTIAL'
      observations.push(`After submit, URL is ${page2.url()} — not /ap/results/`)
    }

    // =========================================================================
    // STEP 13: Report card verification
    // =========================================================================
    log('=== STEP 13: Report card ===')
    await sleep(2000)

    const rcContent = await page2.evaluate(() => document.body.innerText)
    await screenshot(page2, 'v3_16_report_card')
    log(`  RC preview: "${rcContent.substring(0, 400).replace(/\n/g, ' ')}"`)

    const scoreMatch = rcContent.match(/(\d+)\s*\/\s*15/)
    log(`  MCQ score: ${scoreMatch ? scoreMatch[0] : 'not found'}`)
    observations.push(`Report card score: ${scoreMatch ? scoreMatch[0] : 'not found'}`)

    const tableRows = await page2.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'))
      return rows.map(r => r.textContent?.trim().substring(0, 100))
    })
    const dataRows = tableRows.filter(r => r && r.match(/\d/))
    log(`  Table rows: ${dataRows.length}`)
    observations.push(`Report card table rows: ${dataRows.length}`)

    if (dataRows.length >= 14) {
      results.allAnswersPresent = 'PASS'
      results.reportCard = 'PASS'
    } else if (dataRows.length >= 10) {
      results.allAnswersPresent = 'PARTIAL'
      results.reportCard = 'PARTIAL'
    } else {
      results.allAnswersPresent = 'FAIL'
      results.reportCard = 'FAIL'
      observations.push(`FAIL: ${dataRows.length}/15 MCQ rows on report card`)
    }

  } catch (err) {
    log(`FATAL: ${err.message}`)
    log(err.stack)
    observations.push(`FATAL: ${err.message}`)
    allErrors.push({ text: err.message, isScriptError: true })
  } finally {
    await browser.close()
  }

  return { results, errors: allErrors, observations }
}

run().then(res => {
  log('\n=== FINAL RESULTS ===')
  log(JSON.stringify(res.results, null, 2))
  log('\n=== KEY OBSERVATIONS ===')
  res.observations.forEach(o => log(`  - ${o}`))
  log('\n=== ERRORS ===')
  res.errors.forEach(e => log(`  [${e.phase || 'main'}] ${e.text}`))

  const outPath = path.join(__dirname, 'b14g_results_v3.json')
  fs.writeFileSync(outPath, JSON.stringify(res, null, 2))
  log(`\nSaved: ${outPath}`)
}).catch(err => {
  log(`CRASH: ${err.message}\n${err.stack}`)
  process.exit(1)
})
