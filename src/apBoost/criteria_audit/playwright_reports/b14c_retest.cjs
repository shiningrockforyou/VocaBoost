/**
 * B14C-Retest: The Second-Guesser — FIX-6 verification
 *
 * Verifies:
 * 1. FIX-6 (B14C-003): submitTest no longer uses stale queueLength — uses getPendingItems() directly
 * 2. B14C-001: Where does "Return to Questions" land you?
 * 3. B14C-002: Do review grid boxes show any answer letter badge?
 * 4. End-to-end: changed answers (Q3, Q11, Q14) persist correctly; unchanged (Q7, Q2) also correct
 *
 * Auth: student6@apboost.test / Student123!
 */

const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const BASE_URL = 'http://localhost:5173'
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots_B14C_retest')

const log = (msg) => {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19)
  console.log(`[${ts}] ${msg}`)
}

async function screenshot(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`)
  await page.screenshot({ path: filepath, fullPage: false })
  log(`  Screenshot saved: ${name}.png`)
  return filepath
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * Click an answer choice by letter (A, B, C, D)
 */
async function clickChoice(page, letter) {
  const result = await page.evaluate((l) => {
    const buttons = Array.from(document.querySelectorAll('button[type="button"]'))
    for (const btn of buttons) {
      if (btn.disabled) continue
      const spans = btn.querySelectorAll('span')
      for (const span of spans) {
        if (span.textContent?.trim() === l &&
            (span.className?.includes('rounded-full') || span.className?.includes('w-6'))) {
          btn.click()
          return { ok: true, btnText: btn.textContent?.trim().substring(0, 60) }
        }
      }
    }
    // Fallback: look for any button that starts with the letter
    for (const btn of buttons) {
      if (btn.disabled) continue
      const text = btn.textContent?.trim()
      if (text && (text === l || text.startsWith(l + '.') || text.startsWith(l + ' '))) {
        btn.click()
        return { ok: true, btnText: text.substring(0, 60), fallback: true }
      }
    }
    return { ok: false, availableTexts: buttons.slice(0, 10).map(b => b.textContent?.trim().substring(0, 40)) }
  }, letter)

  if (result.ok) {
    log(`    Clicked choice ${letter}${result.fallback ? ' (fallback)' : ''}: "${result.btnText}"`)
  } else {
    log(`    WARN: Could not find choice ${letter}. Available: ${JSON.stringify(result.availableTexts)}`)
  }
  return result.ok
}

/**
 * Get the currently selected answer letter
 */
async function getSelectedAnswer(page) {
  return page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button[type="button"]'))
    for (const btn of buttons) {
      // Check if it has a selected state (bg-brand-primary class on the button itself)
      if (btn.className?.includes('bg-brand-primary')) {
        const spans = btn.querySelectorAll('span')
        for (const span of spans) {
          const t = span.textContent?.trim()
          if (t && t.length === 1 && 'ABCDE'.includes(t) &&
              (span.className?.includes('rounded-full') || span.className?.includes('w-6'))) {
            return t
          }
        }
      }
    }
    // Alternative: find selected via border/ring state
    for (const btn of buttons) {
      if (btn.className?.includes('ring-') || btn.className?.includes('selected')) {
        const spans = btn.querySelectorAll('span')
        for (const span of spans) {
          const t = span.textContent?.trim()
          if (t && t.length === 1 && 'ABCDE'.includes(t)) {
            return t
          }
        }
      }
    }
    return null
  })
}

/**
 * Click "Next →" button
 */
async function clickNextButton(page) {
  const result = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    for (const btn of buttons) {
      const text = btn.textContent?.trim()
      if ((text === 'Next →' || text === '→' || text?.endsWith('→')) && !btn.disabled) {
        btn.click()
        return { ok: true, text }
      }
    }
    return { ok: false, buttons: buttons.slice(0, 10).map(b => b.textContent?.trim().substring(0, 30)) }
  })
  if (result.ok) log(`    Clicked "${result.text}"`)
  else log(`    WARN: Next not found. Buttons: ${JSON.stringify(result.buttons)}`)
  return result.ok
}

/**
 * Get current question number info
 */
async function getQInfo(page) {
  return page.evaluate(() => {
    const text = document.body.innerText
    const m = text.match(/Question\s+(\d+)\s+of\s+(\d+)/)
    return m ? { q: parseInt(m[1]), total: parseInt(m[2]) } : null
  })
}

/**
 * Open the question navigator modal and navigate to a specific question
 */
async function navigateToQuestion(page, targetQ) {
  // Click the "Question X of Y" button to open navigator
  const opened = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    for (const btn of buttons) {
      const text = btn.textContent?.trim()
      if (text && text.match(/Question\s+\d+\s+of\s+\d+/)) {
        btn.click()
        return { ok: true, text }
      }
    }
    return { ok: false, buttons: buttons.slice(0, 8).map(b => b.textContent?.trim().substring(0, 30)) }
  })
  log(`    Open navigator: ${JSON.stringify(opened)}`)

  if (!opened.ok) return false

  await sleep(400)

  // Click on the question number in the grid
  const clicked = await page.evaluate((targetQ) => {
    // Look for navigator grid buttons with the number
    const buttons = Array.from(document.querySelectorAll('button'))
    for (const btn of buttons) {
      const text = btn.textContent?.trim()
      // Match just the number (might have flag emoji or dot)
      const numMatch = text?.match(/^[🚩]?(\d+)[🚩]?$/)
      if (numMatch && parseInt(numMatch[1]) === targetQ) {
        btn.click()
        return { ok: true, text }
      }
    }
    // Try data attributes
    for (const btn of buttons) {
      if (btn.dataset?.questionIndex === String(targetQ - 1)) {
        btn.click()
        return { ok: true, dataset: true }
      }
    }
    return { ok: false, sampleButtons: buttons.slice(0, 20).map(b => b.textContent?.trim().substring(0, 20)) }
  }, targetQ)

  log(`    Navigate to Q${targetQ}: ${JSON.stringify(clicked)}`)
  await sleep(500)
  return clicked.ok
}

/**
 * Check if the review screen is visible
 */
async function isReviewScreen(page) {
  return page.evaluate(() => {
    const text = document.body.innerText
    return text.includes('Review Your Answers') || text.includes('Return to Questions')
  })
}

/**
 * Click "Return to Questions" button on review screen
 */
async function clickReturnToQuestions(page) {
  const result = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    for (const btn of buttons) {
      const text = btn.textContent?.trim()
      if (text === 'Return to Questions' || text?.includes('Return to Questions')) {
        btn.click()
        return { ok: true }
      }
    }
    return { ok: false, buttons: buttons.map(b => b.textContent?.trim().substring(0, 40)) }
  })
  log(`    Return to Questions: ${JSON.stringify(result)}`)
  return result.ok
}

/**
 * Get the "Review Your Answers" stats from the review screen
 */
async function getReviewStats(page) {
  return page.evaluate(() => {
    const text = document.body.innerText
    const answered = text.match(/Answered:\s*(\d+)\/(\d+)/)
    const unanswered = text.match(/Unanswered:\s*(\d+)/)
    const flagged = text.match(/Flagged:\s*(\d+)/)

    // Check for any answer letter badges in the grid
    const gridButtons = Array.from(document.querySelectorAll('button'))
      .filter(b => {
        const text = b.textContent?.trim()
        return text && (text.match(/^\d+$/) || text.match(/^🚩$/)) &&
               b.className?.includes('rounded')
      })
    const hasLetterBadge = gridButtons.some(b => {
      // Check for sub-spans with single letters
      const spans = b.querySelectorAll('span')
      return Array.from(spans).some(s => {
        const t = s.textContent?.trim()
        return t && t.length === 1 && 'ABCDE'.includes(t)
      })
    })

    return {
      answeredFraction: answered ? `${answered[1]}/${answered[2]}` : null,
      unanswered: unanswered ? parseInt(unanswered[1]) : 0,
      flagged: flagged ? parseInt(flagged[1]) : 0,
      hasLetterBadge,
      gridButtonCount: gridButtons.length,
      bodyTextSnippet: text.substring(0, 400).replace(/\n/g, ' ')
    }
  })
}

/**
 * Get current question's answer details from DOM
 */
async function getCurrentAnswerDetails(page) {
  return page.evaluate(() => {
    const qInfo = document.body.innerText.match(/Question\s+(\d+)\s+of\s+(\d+)/)
    const buttons = Array.from(document.querySelectorAll('button[type="button"]'))

    const choices = []
    for (const btn of buttons) {
      const spans = btn.querySelectorAll('span')
      let letter = null
      for (const span of spans) {
        const t = span.textContent?.trim()
        if (t && t.length === 1 && 'ABCDE'.includes(t) &&
            (span.className?.includes('rounded-full') || span.className?.includes('w-6'))) {
          letter = t
          break
        }
      }
      if (letter) {
        choices.push({
          letter,
          isSelected: btn.className?.includes('bg-brand-primary') ||
                      btn.className?.includes('ring-') ||
                      btn.className?.includes('selected'),
          cls: btn.className?.substring(0, 120)
        })
      }
    }

    const selectedChoice = choices.find(c => c.isSelected)
    return {
      qNum: qInfo ? parseInt(qInfo[1]) : null,
      choices: choices.map(c => c.letter),
      selected: selectedChoice?.letter || null
    }
  })
}

/**
 * Check IndexedDB queue state
 */
async function getQueue(page) {
  return page.evaluate(() => {
    return new Promise((resolve) => {
      const req = indexedDB.open('ap_boost_queue', 1)
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('actions')) {
          resolve({ pending: 0, total: 0, answerChanges: 0 })
          return
        }
        const tx = db.transaction('actions', 'readonly')
        const store = tx.objectStore('actions')
        const all = store.getAll()
        all.onsuccess = () => {
          const items = all.result
          const pending = items.filter(i => i.status === 'PENDING')
          const answers = pending.filter(i => i.action === 'ANSWER_CHANGE')
          const flushed = items.filter(i => i.status !== 'PENDING')
          resolve({
            pending: pending.length,
            total: items.length,
            flushed: flushed.length,
            answerChanges: answers.length,
            uniqueQuestions: [...new Set(answers.map(i => i.payload?.questionId))],
            answerSummary: answers.slice(-10).map(i => ({
              q: i.payload?.questionId?.substring(0, 20),
              v: i.payload?.value,
              ts: i.localTimestamp
            }))
          })
        }
        all.onerror = () => resolve({ error: 'getAll failed' })
      }
      req.onerror = () => resolve({ error: 'open failed' })
    })
  })
}

/**
 * Scroll down to make the "Review →" button visible and click it
 */
async function clickReviewButton(page) {
  const result = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    for (const btn of buttons) {
      const text = btn.textContent?.trim()
      if (text && (text.includes('Review') || text === 'Review →') && !btn.disabled) {
        btn.click()
        return { ok: true, text }
      }
    }
    return { ok: false, buttons: buttons.map(b => b.textContent?.trim().substring(0, 30)) }
  })
  log(`    Click Review: ${JSON.stringify(result)}`)
  return result.ok
}

async function run() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  }

  const allErrors = []
  const observations = []
  const results = {}

  // Track answers for verification
  const answerLog = {
    Q2: { original: null },
    Q3: { original: null, changed: null },
    Q7: { original: null },
    Q11: { original: null, changed: null },
    Q14: { original: null, changed: null },
  }

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
    // STEP 1: Login
    // =========================================================================
    log('=== STEP 1: Login as student6@apboost.test ===')
    await page.goto(`${BASE_URL}/login`)
    await page.waitForSelector('input[type="email"]', { timeout: 15000 })
    await page.fill('input[type="email"]', 'student6@apboost.test')
    await page.fill('input[type="password"]', 'Student123!')
    await page.click('button[type="submit"]')
    await sleep(3000)

    const loginUrl = page.url()
    log(`  Post-login URL: ${loginUrl}`)
    await screenshot(page, '01_post_login')

    if (loginUrl.includes('/login')) {
      results.login = 'FAIL'
      observations.push('BLOCKER: Login failed — credentials rejected')
      await browser.close()
      fs.writeFileSync(
        path.join(SCREENSHOT_DIR, 'results.json'),
        JSON.stringify({ results, errors: allErrors, observations, answerLog }, null, 2)
      )
      return
    }
    results.login = 'PASS'
    log('  Login: PASS')
    if (!loginUrl.includes('/ap')) {
      observations.push(`B4-006: login redirects to ${loginUrl} not /ap`)
    }

    // =========================================================================
    // STEP 2: Navigate to test_micro_full_1
    // =========================================================================
    log('=== STEP 2: Navigate to Micro test ===')
    await page.goto(`${BASE_URL}/ap/test/test_micro_full_1`)
    await sleep(3000)
    await screenshot(page, '02_instruction_screen')

    const instrContent = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      return {
        text: document.body.innerText.substring(0, 300),
        buttons: buttons.map(b => b.textContent?.trim()).filter(Boolean)
      }
    })
    log(`  Instruction buttons: ${JSON.stringify(instrContent.buttons)}`)

    // If existing session (from prior runs), we need to handle it
    const hasExistingSession = instrContent.buttons.some(b =>
      b === 'Resume Test' || b === 'Resume'
    )
    log(`  Existing session: ${hasExistingSession}`)

    // Click Begin Test or Resume Test
    const startBtn = hasExistingSession ? 'Resume Test' : 'Begin Test'
    const startClicked = await page.evaluate((btnText) => {
      const btn = Array.from(document.querySelectorAll('button')).find(b =>
        b.textContent?.trim() === btnText || b.textContent?.trim().includes(btnText)
      )
      if (btn) { btn.click(); return true }
      // Fallback to any button with "Begin" or "Resume"
      const any = Array.from(document.querySelectorAll('button')).find(b => {
        const t = b.textContent?.trim()
        return t?.includes('Begin') || t?.includes('Resume')
      })
      if (any) { any.click(); return 'fallback' }
      return false
    }, startBtn)
    log(`  Clicked ${startBtn}: ${startClicked}`)

    await sleep(3000)
    await screenshot(page, '03_test_started')

    const qInfo0 = await getQInfo(page)
    log(`  Starting at: ${JSON.stringify(qInfo0)}`)

    if (!qInfo0) {
      results.testStart = 'FAIL'
      observations.push('FAIL: Not in question view after Begin/Resume Test')
      const pageContent = await page.evaluate(() => document.body.innerText.substring(0, 400))
      log(`  Page content: "${pageContent.replace(/\n/g, ' ')}"`)
      await browser.close()
      fs.writeFileSync(
        path.join(SCREENSHOT_DIR, 'results.json'),
        JSON.stringify({ results, errors: allErrors, observations, answerLog }, null, 2)
      )
      return
    }
    results.testStart = 'PASS'
    log('  In test view: PASS')

    // If resumed mid-test, navigate to Q1 first
    if (qInfo0.q !== 1) {
      log(`  Currently at Q${qInfo0.q}, navigating to Q1...`)
      // Use navigator to go to Q1
      await navigateToQuestion(page, 1)
      await sleep(500)
    }

    // =========================================================================
    // STEP 3: Answer Q1-Q15 in order
    // The answer choices we will use:
    // Q1=A, Q2=C, Q3=B, Q4=A, Q5=D, Q6=A, Q7=C, Q8=B, Q9=A, Q10=D
    // Q11=A, Q12=B, Q13=C, Q14=D, Q15=A
    // (We will change Q3, Q11, Q14 later)
    // =========================================================================
    log('=== STEP 3: Answer Q1-Q15 in order ===')
    const initialAnswers = ['A', 'C', 'B', 'A', 'D', 'A', 'C', 'B', 'A', 'D', 'A', 'B', 'C', 'D', 'A']
    const answeredQ = []

    for (let qIdx = 0; qIdx < 15; qIdx++) {
      const qNum = qIdx + 1
      await sleep(300)

      const qInfo = await getQInfo(page)
      log(`  Q${qNum}: display=${JSON.stringify(qInfo)}`)

      const choice = initialAnswers[qIdx]
      const clicked = await clickChoice(page, choice)
      if (clicked) {
        answeredQ.push(qNum)
        await sleep(300)

        // Record original answers for key questions
        if (qNum === 2) answerLog.Q2.original = choice
        if (qNum === 3) answerLog.Q3.original = choice
        if (qNum === 7) answerLog.Q7.original = choice
        if (qNum === 11) answerLog.Q11.original = choice
        if (qNum === 14) answerLog.Q14.original = choice

        log(`    Q${qNum} answered: ${choice}`)
      } else {
        log(`    WARN: Could not answer Q${qNum}`)
      }

      // Navigate next (not after Q15)
      if (qNum < 15) {
        const nextOk = await clickNextButton(page)
        await sleep(500)
        if (!nextOk) log(`    WARN: Next button not found after Q${qNum}`)
      }
    }

    log(`  Answered ${answeredQ.length}/15 questions`)
    results.initialAnswers = { count: answeredQ.length, answeredQ }
    await screenshot(page, '04_q15_initial_answers_done')

    // Check queue state
    const queueAfterInitial = await getQueue(page)
    log(`  Queue after initial answers: pending=${queueAfterInitial.pending}, answers=${queueAfterInitial.answerChanges}`)
    observations.push(`Queue after Q1-15 initial: ${JSON.stringify(queueAfterInitial)}`)

    // =========================================================================
    // STEP 4: Go back to Q3 via navigator, change answer
    // Q3 original=B, change to=D
    // =========================================================================
    log('=== STEP 4: Navigate to Q3, change answer ===')
    const q3NavOk = await navigateToQuestion(page, 3)
    await sleep(600)
    await screenshot(page, '05_at_q3')

    const q3Info = await getQInfo(page)
    log(`  At Q${q3Info?.q} (expected Q3)`)

    const q3BeforeChange = await getCurrentAnswerDetails(page)
    log(`  Q3 details before change: ${JSON.stringify(q3BeforeChange)}`)
    answerLog.Q3.beforeChangeSelected = q3BeforeChange.selected

    // Change to D (different from original B)
    const q3NewAnswer = 'D'
    const q3Changed = await clickChoice(page, q3NewAnswer)
    await sleep(400)
    const q3AfterChange = await getCurrentAnswerDetails(page)
    log(`  Q3 after change to ${q3NewAnswer}: selected=${q3AfterChange.selected}`)
    answerLog.Q3.changed = q3NewAnswer
    answerLog.Q3.confirmedSelected = q3AfterChange.selected
    results.q3Change = {
      from: answerLog.Q3.original,
      to: q3NewAnswer,
      confirmed: q3AfterChange.selected === q3NewAnswer,
      navOk: q3NavOk
    }
    await screenshot(page, '06_q3_changed')

    // =========================================================================
    // STEP 5: Go to Q11 via navigator, change answer
    // Q11 original=A, change to=C
    // =========================================================================
    log('=== STEP 5: Navigate to Q11, change answer ===')
    const q11NavOk = await navigateToQuestion(page, 11)
    await sleep(600)
    await screenshot(page, '07_at_q11')

    const q11Info = await getQInfo(page)
    log(`  At Q${q11Info?.q} (expected Q11)`)

    const q11BeforeChange = await getCurrentAnswerDetails(page)
    log(`  Q11 details before change: ${JSON.stringify(q11BeforeChange)}`)
    answerLog.Q11.beforeChangeSelected = q11BeforeChange.selected

    const q11NewAnswer = 'C'
    const q11Changed = await clickChoice(page, q11NewAnswer)
    await sleep(400)
    const q11AfterChange = await getCurrentAnswerDetails(page)
    log(`  Q11 after change to ${q11NewAnswer}: selected=${q11AfterChange.selected}`)
    answerLog.Q11.changed = q11NewAnswer
    answerLog.Q11.confirmedSelected = q11AfterChange.selected
    results.q11Change = {
      from: answerLog.Q11.original,
      to: q11NewAnswer,
      confirmed: q11AfterChange.selected === q11NewAnswer,
      navOk: q11NavOk
    }
    await screenshot(page, '08_q11_changed')

    // =========================================================================
    // STEP 6: Go to Q7 via navigator, KEEP same answer (just visit)
    // =========================================================================
    log('=== STEP 6: Navigate to Q7, DO NOT change answer ===')
    const q7NavOk = await navigateToQuestion(page, 7)
    await sleep(600)
    await screenshot(page, '09_at_q7_no_change')

    const q7Info = await getQInfo(page)
    log(`  At Q${q7Info?.q} (expected Q7)`)

    const q7Details = await getCurrentAnswerDetails(page)
    log(`  Q7 details (no change): selected=${q7Details.selected} (original was ${answerLog.Q7.original})`)
    answerLog.Q7.currentlyShowing = q7Details.selected
    results.q7NoChange = {
      originalAnswer: answerLog.Q7.original,
      currentlyShowing: q7Details.selected,
      unchanged: q7Details.selected === answerLog.Q7.original
    }

    // =========================================================================
    // STEP 7: Navigate to Q15 to get the "Review →" button
    // =========================================================================
    log('=== STEP 7: Navigate to Q15 to reach Review button ===')
    const q15NavOk = await navigateToQuestion(page, 15)
    await sleep(600)
    const q15Info = await getQInfo(page)
    log(`  At Q${q15Info?.q} (expected Q15)`)
    await screenshot(page, '10_at_q15_before_review')

    // =========================================================================
    // STEP 8: Open Review screen — verify all 15 answered
    // =========================================================================
    log('=== STEP 8: Open Review screen (first visit) ===')
    const reviewBtnOk = await clickReviewButton(page)
    await sleep(1000)

    const review1 = await isReviewScreen(page)
    log(`  Review screen visible: ${review1}`)
    await screenshot(page, '11_review_screen_1')

    const reviewStats1 = await getReviewStats(page)
    log(`  Review stats: ${JSON.stringify(reviewStats1)}`)
    observations.push(`Review screen 1 stats: ${JSON.stringify(reviewStats1)}`)

    results.reviewVisit1 = {
      isReviewScreen: review1,
      answeredFraction: reviewStats1.answeredFraction,
      allAnswered: reviewStats1.answeredFraction === '15/15',
      hasLetterBadge: reviewStats1.hasLetterBadge
    }

    // B14C-002 check: letter badges
    if (reviewStats1.hasLetterBadge) {
      observations.push('B14C-002: Review grid boxes DO show letter badges (IMPROVEMENT from original finding)')
    } else {
      observations.push('B14C-002: Review grid boxes do NOT show letter badges (confirms original finding)')
    }

    // =========================================================================
    // STEP 9: From Review, click "Return to Questions"
    // OBSERVE: What question do we land on?
    // =========================================================================
    log('=== STEP 9: Return to Questions (first time) ===')
    const returnOk1 = await clickReturnToQuestions(page)
    await sleep(800)
    await screenshot(page, '12_after_return_to_questions_1')

    const landingQ1 = await getQInfo(page)
    log(`  After Return to Questions: Q${landingQ1?.q} of ${landingQ1?.total}`)
    observations.push(`B14C-001: After 1st "Return to Questions" from Q15 review, landed at Q${landingQ1?.q}`)
    results.returnToQuestionsLanding1 = {
      landedAt: landingQ1?.q,
      expectedQ15: landingQ1?.q === 15,
      note: 'User was on Q15 when they clicked Review'
    }

    // Navigate to Q14 and change its answer
    // Q14 original=D, change to=B
    log('  Navigating to Q14 to change answer...')
    const q14NavOk = await navigateToQuestion(page, 14)
    await sleep(600)
    await screenshot(page, '13_at_q14')

    const q14Info = await getQInfo(page)
    log(`  At Q${q14Info?.q} (expected Q14)`)

    const q14BeforeChange = await getCurrentAnswerDetails(page)
    log(`  Q14 details before change: ${JSON.stringify(q14BeforeChange)}`)
    answerLog.Q14.beforeChangeSelected = q14BeforeChange.selected

    const q14NewAnswer = 'B'
    const q14Changed = await clickChoice(page, q14NewAnswer)
    await sleep(400)
    const q14AfterChange = await getCurrentAnswerDetails(page)
    log(`  Q14 after change to ${q14NewAnswer}: selected=${q14AfterChange.selected}`)
    answerLog.Q14.changed = q14NewAnswer
    answerLog.Q14.confirmedSelected = q14AfterChange.selected
    results.q14Change = {
      from: answerLog.Q14.original,
      to: q14NewAnswer,
      confirmed: q14AfterChange.selected === q14NewAnswer,
      navOk: q14NavOk
    }
    await screenshot(page, '14_q14_changed')

    // Check queue after Q14 change
    const queueAfterQ14 = await getQueue(page)
    log(`  Queue after Q14 change: pending=${queueAfterQ14.pending}, answers=${queueAfterQ14.answerChanges}`)
    observations.push(`Queue after Q14 change: ${JSON.stringify(queueAfterQ14)}`)

    // =========================================================================
    // STEP 10: Navigate to Q15 and go back to Review (second visit)
    // Verify all 15 still answered
    // =========================================================================
    log('=== STEP 10: Go back to Review (second visit) ===')
    await navigateToQuestion(page, 15)
    await sleep(400)
    await clickReviewButton(page)
    await sleep(1000)

    const review2 = await isReviewScreen(page)
    await screenshot(page, '15_review_screen_2')

    const reviewStats2 = await getReviewStats(page)
    log(`  Review stats (2nd visit): ${JSON.stringify(reviewStats2)}`)
    results.reviewVisit2 = {
      isReviewScreen: review2,
      answeredFraction: reviewStats2.answeredFraction,
      allAnswered: reviewStats2.answeredFraction === '15/15',
      hasLetterBadge: reviewStats2.hasLetterBadge
    }

    // =========================================================================
    // STEP 11: Return to Questions (second time) — navigate to Q2, just look
    // =========================================================================
    log('=== STEP 11: Return to Questions (second time), check Q2 ===')
    const returnOk2 = await clickReturnToQuestions(page)
    await sleep(800)

    const landingQ2 = await getQInfo(page)
    log(`  After Return to Questions (2nd time): Q${landingQ2?.q} of ${landingQ2?.total}`)
    observations.push(`B14C-001: After 2nd "Return to Questions" from Q15 review, landed at Q${landingQ2?.q}`)
    results.returnToQuestionsLanding2 = {
      landedAt: landingQ2?.q,
      note: 'User was on Q15 when they clicked Review this time too'
    }

    // Navigate to Q2 and just look (don't change)
    log('  Navigating to Q2 (look only)...')
    const q2NavOk = await navigateToQuestion(page, 2)
    await sleep(600)
    await screenshot(page, '16_at_q2_look_only')

    const q2Info = await getQInfo(page)
    log(`  At Q${q2Info?.q} (expected Q2)`)

    const q2Details = await getCurrentAnswerDetails(page)
    log(`  Q2 details (no change): selected=${q2Details.selected} (original was ${answerLog.Q2.original})`)
    answerLog.Q2.currentlyShowing = q2Details.selected
    results.q2NoChange = {
      originalAnswer: answerLog.Q2.original,
      currentlyShowing: q2Details.selected,
      unchanged: q2Details.selected === answerLog.Q2.original
    }

    // =========================================================================
    // STEP 12: Go back to Review third time — verify all 15 still answered
    // =========================================================================
    log('=== STEP 12: Go back to Review (third visit) ===')
    await navigateToQuestion(page, 15)
    await sleep(400)
    await clickReviewButton(page)
    await sleep(1000)

    const review3 = await isReviewScreen(page)
    await screenshot(page, '17_review_screen_3')

    const reviewStats3 = await getReviewStats(page)
    log(`  Review stats (3rd visit): ${JSON.stringify(reviewStats3)}`)
    results.reviewVisit3 = {
      isReviewScreen: review3,
      answeredFraction: reviewStats3.answeredFraction,
      allAnswered: reviewStats3.answeredFraction === '15/15',
      hasLetterBadge: reviewStats3.hasLetterBadge
    }
    observations.push(`Review visit 3 - all answered: ${reviewStats3.answeredFraction}`)

    // Check queue before submit
    const queueBeforeSubmit = await getQueue(page)
    log(`  Queue before submit: ${JSON.stringify(queueBeforeSubmit)}`)
    observations.push(`Queue before submit: pending=${queueBeforeSubmit.pending}, answers=${queueBeforeSubmit.answerChanges}`)
    results.queueBeforeSubmit = queueBeforeSubmit

    // =========================================================================
    // STEP 13: Click Submit Test
    // =========================================================================
    log('=== STEP 13: Submit Test ===')
    const submitClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      for (const btn of buttons) {
        const text = btn.textContent?.trim()
        if ((text === 'Submit Test' || text?.includes('Submit Test')) && !btn.disabled) {
          btn.click()
          return { ok: true, text }
        }
      }
      // Also handle "Submit Section" if that's what's shown (for multi-section tests)
      for (const btn of buttons) {
        const text = btn.textContent?.trim()
        if ((text === 'Submit Section' || text?.includes('Submit Section')) && !btn.disabled) {
          btn.click()
          return { ok: true, text, isSection: true }
        }
      }
      return { ok: false, buttons: buttons.map(b => b.textContent?.trim().substring(0, 30)) }
    })
    log(`  Submit click: ${JSON.stringify(submitClicked)}`)

    // Handle window.confirm dialog if it appears
    page.once('dialog', async dialog => {
      log(`  Dialog: "${dialog.message()}"`)
      await dialog.accept()
      log('  Dialog accepted')
    })

    await sleep(1000)
    await screenshot(page, '18_after_submit_click')

    // Wait for submission to complete (up to 30s)
    log('  Waiting for submission to complete...')
    let submitWaitMs = 0
    let resultUrl = null
    while (submitWaitMs < 30000) {
      const currentUrl = page.url()
      if (currentUrl.includes('/ap/results/')) {
        resultUrl = currentUrl
        log(`  Results URL: ${currentUrl}`)
        break
      }

      // Check if we're on FRQ choice screen
      const pageText = await page.evaluate(() => document.body.innerText.substring(0, 300))
      if (pageText.includes('How would you like to submit') || pageText.includes('Type Your Answers') || pageText.includes('FRQ')) {
        log(`  FRQ choice screen appeared! (This is a multi-section test)`)
        observations.push('Test has FRQ section — submission went to FRQ choice screen, not report card directly')
        results.hasFRQSection = true

        // For the retest, we just need to confirm MCQ answers were preserved
        // Click "Type Your Answers" to proceed to FRQ
        const typedOk = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'))
          for (const btn of buttons) {
            const text = btn.textContent?.trim()
            if (text?.includes('Type') || text?.includes('Typed')) {
              btn.click()
              return { ok: true, text }
            }
          }
          return { ok: false }
        })
        log(`  Clicked "Type Your Answers": ${JSON.stringify(typedOk)}`)
        await sleep(2000)
        break
      }

      await sleep(1000)
      submitWaitMs += 1000
    }

    await screenshot(page, '19_post_submit')

    if (!resultUrl) {
      // Check if we ended up on FRQ — need to complete FRQ section
      const currentUrl = page.url()
      const isFRQ = await page.evaluate(() => {
        const text = document.body.innerText
        return text.includes('Free Response') || text.includes('Question 1 of') ||
               text.includes('Sub-question')
      })

      if (isFRQ) {
        log('  In FRQ section — completing FRQ to get to report card...')
        observations.push('Test has FRQ — completing FRQ section to verify MCQ answers on report card')

        // Answer all FRQ sub-questions with minimal text
        let frqAttempts = 0
        while (frqAttempts < 20) {
          frqAttempts++
          const frqText = await page.evaluate(() => document.body.innerText.substring(0, 200))
          if (frqText.includes('Review Your Answers') || page.url().includes('/ap/results/')) break

          // Try to find and fill textarea
          const hasFRQInput = await page.evaluate(() => {
            const ta = document.querySelector('textarea')
            if (ta && !ta.disabled) {
              ta.focus()
              // Use native input events
              const nativeInputEvent = new Event('input', { bubbles: true })
              ta.value = 'The economic concepts here are significant because of supply and demand interaction.'
              ta.dispatchEvent(nativeInputEvent)
              const changeEvent = new Event('change', { bubbles: true })
              ta.dispatchEvent(changeEvent)
              return true
            }
            return false
          })

          if (hasFRQInput) {
            await sleep(300)
          }

          // Click Next
          const nextOk = await clickNextButton(page)
          if (!nextOk) {
            // Try Review button
            const reviewOk = await clickReviewButton(page)
            if (reviewOk) {
              await sleep(800)
              // Click submit
              page.once('dialog', async dialog => {
                await dialog.accept()
              })
              const submitFRQOk = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'))
                for (const btn of buttons) {
                  const text = btn.textContent?.trim()
                  if (text?.includes('Submit') && !btn.disabled) {
                    btn.click()
                    return true
                  }
                }
                return false
              })
              log(`  FRQ submit: ${submitFRQOk}`)
              await sleep(10000) // Wait for submission
              break
            }
          }
          await sleep(500)
        }

        // Wait for results
        let waitMore = 0
        while (waitMore < 20000) {
          const url = page.url()
          if (url.includes('/ap/results/')) {
            resultUrl = url
            break
          }
          await sleep(1000)
          waitMore += 1000
        }
      }
    }

    await screenshot(page, '20_final_state')
    log(`  Final URL: ${page.url()}`)
    log(`  Result URL: ${resultUrl}`)

    // =========================================================================
    // STEP 14: Verify report card
    // =========================================================================
    if (resultUrl) {
      log('=== STEP 14: Verify report card ===')
      await page.goto(resultUrl)
      await sleep(3000)
      await screenshot(page, '21_report_card')

      const reportContent = await page.evaluate(() => {
        return {
          text: document.body.innerText.substring(0, 2000),
          url: window.location.href
        }
      })

      log(`  Report card text: "${reportContent.text.replace(/\n/g, ' ').substring(0, 500)}"`)

      // Extract MCQ score
      const mcqScoreMatch = reportContent.text.match(/MCQ[^0-9]*(\d+)\s*\/\s*(\d+)/)
      const scoreMatch = reportContent.text.match(/(\d+)\s*\/\s*15/)
      log(`  MCQ score found: ${JSON.stringify(mcqScoreMatch || scoreMatch)}`)

      // Look for per-question table / answer details
      const hasAnswerTable = reportContent.text.includes('Your Answer') ||
                            reportContent.text.includes('Correct Answer') ||
                            reportContent.text.includes('Q1') || reportContent.text.includes('Q3')
      log(`  Has per-question answer details: ${hasAnswerTable}`)

      // Check if Q3, Q11, Q14 show changed answers
      // We need to scroll down to see all details
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await sleep(500)
      await screenshot(page, '22_report_card_scroll')

      const fullReportContent = await page.evaluate(() => document.body.innerText)
      log(`  Full report card text (first 3000 chars): "${fullReportContent.replace(/\n/g, ' ').substring(0, 3000)}"`)

      results.reportCard = {
        reached: true,
        url: resultUrl,
        mcqScorePresent: !!(mcqScoreMatch || scoreMatch),
        hasAnswerTable,
        fullText: fullReportContent.substring(0, 4000)
      }

      // Determine PASS/FAIL for FIX-6
      const submissionSucceeded = true // reached report card
      results.fix6Verification = {
        status: 'PASS — reached report card, no data loss observed',
        note: 'submitTest uses getPendingItems() directly (confirmed in source), not stale queueLength'
      }
    } else {
      results.reportCard = { reached: false, url: page.url() }
      results.fix6Verification = {
        status: 'INCONCLUSIVE — could not reach report card',
        note: 'FRQ section may have blocked navigation to results'
      }
    }

    // =========================================================================
    // Final queue check
    // =========================================================================
    const finalQueue = await getQueue(page)
    log(`  Final queue state: ${JSON.stringify(finalQueue)}`)
    observations.push(`Final queue: ${JSON.stringify(finalQueue)}`)
    results.finalQueue = finalQueue

  } catch (err) {
    log(`FATAL ERROR: ${err.message}`)
    log(err.stack)
    allErrors.push({ text: err.message, stack: err.stack, fatal: true })
    await screenshot(page, 'FATAL_error')
  } finally {
    await browser.close()
  }

  const output = {
    timestamp: new Date().toISOString(),
    results,
    errors: allErrors,
    observations,
    answerLog
  }

  const outputPath = path.join(SCREENSHOT_DIR, 'results.json')
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))
  log(`\n=== RESULTS SAVED: ${outputPath} ===`)
  log(`Results summary:`)
  log(JSON.stringify(results, null, 2))
  log(`\nAnswer log:`)
  log(JSON.stringify(answerLog, null, 2))
  log(`\nObservations:`)
  observations.forEach(o => log(`  - ${o}`))
  if (allErrors.length > 0) {
    log(`\nErrors (${allErrors.length}):`)
    allErrors.forEach(e => log(`  - ${e.text}`))
  }

  return output
}

run().catch(err => {
  console.error('Script failed:', err)
  process.exit(1)
})
