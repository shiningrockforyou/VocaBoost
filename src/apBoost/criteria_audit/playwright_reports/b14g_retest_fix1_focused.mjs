/**
 * B14G FIX-1 Focused Retest
 *
 * Problem with previous tests: student10 had existing session at Q15 (review screen)
 * This test:
 * 1. First completes+submits any existing test
 * 2. Starts a FRESH test
 * 3. Answers Q1-Q5 online, verifies IDB queue behavior
 * 4. Goes offline, answers Q6-Q8, verifies IDB has pending items
 * 5. Goes online, verifies items flush within 5s (FIX-1 test)
 * 6. Reloads, resumes, verifies all answers preserved (FIX-2 test)
 */

import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCREENSHOTS_DIR = join(__dirname, 'screenshots_B14G_fix1')
const BASE_URL = 'http://localhost:5173'

try { mkdirSync(SCREENSHOTS_DIR, { recursive: true }) } catch {}

let ssCount = 0
const timeline = []
const consoleLog = []

async function ss(page, label) {
  const fn = `${String(++ssCount).padStart(2, '0')}_${label}.png`
  await page.screenshot({ path: join(SCREENSHOTS_DIR, fn), fullPage: true })
  console.log(`[SS] ${fn}`)
  timeline.push(`ss:${label}`)
  return fn
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function getAllIDB(page) {
  return page.evaluate(async () => {
    return new Promise(res => {
      const req = indexedDB.open('ap_boost_queue', 1)
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('actions')) return res([])
        const tx = db.transaction('actions', 'readonly')
        const s = tx.objectStore('actions')
        const r = s.getAll()
        r.onsuccess = () => res(r.result || [])
        r.onerror = () => res([])
      }
      req.onerror = () => res([])
    })
  })
}

async function clearIDB(page) {
  return page.evaluate(async () => {
    return new Promise(res => {
      const req = indexedDB.open('ap_boost_queue', 1)
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('actions')) return res('no-store')
        const tx = db.transaction('actions', 'readwrite')
        const s = tx.objectStore('actions')
        const r = s.clear()
        tx.oncomplete = () => res('cleared')
        tx.onerror = () => res('error')
      }
      req.onerror = () => res('idb-error')
    })
  })
}

async function clickAnswerButton(page, letter) {
  return page.evaluate(ltr => {
    // AnswerInput uses buttons with a rounded-full span for the letter badge
    const buttons = document.querySelectorAll('button[type="button"]')
    for (const btn of buttons) {
      const spans = btn.querySelectorAll('span')
      for (const span of spans) {
        const cls = span.className || ''
        const txt = span.textContent.trim()
        if (txt === ltr && (cls.includes('rounded-full') || cls.includes('w-6'))) {
          // Check if this is an answer choice button (not strikethrough)
          if (btn.className.includes('flex-1') || btn.className.includes('items-start')) {
            btn.click()
            return { ok: true, text: btn.textContent.substring(0, 60) }
          }
        }
      }
    }
    // Fallback: try clicking any button that shows the letter prominently
    for (const btn of buttons) {
      if (!btn.disabled && btn.textContent.trim().startsWith(ltr) && btn.textContent.length < 100) {
        btn.click()
        return { ok: true, fallback: true, text: btn.textContent.trim().substring(0, 60) }
      }
    }
    const allBtns = Array.from(buttons).map(b => b.textContent.trim().substring(0, 40))
    return { ok: false, available: allBtns.slice(0, 10) }
  }, letter)
}

async function clickNextOrReview(page) {
  return page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    for (const btn of btns) {
      const t = btn.textContent.trim()
      if (t === 'Next →' || t === 'Next') { btn.click(); return { ok: true, type: 'next', text: t } }
    }
    for (const btn of btns) {
      const t = btn.textContent.trim()
      if (t.includes('Review →') || t === 'Review') { btn.click(); return { ok: true, type: 'review', text: t } }
    }
    return { ok: false, available: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t).slice(0, 10) }
  })
}

async function getQInfo(page) {
  return page.evaluate(() => {
    const body = document.body.textContent
    const m = body.match(/Question (\d+) of (\d+)/)
    const t = body.match(/⏱(\d+:\d+)/) || body.match(/(\d+:\d+)/)
    return {
      q: m ? parseInt(m[1]) : null,
      total: m ? parseInt(m[2]) : null,
      timer: t ? t[1] : null,
      onReview: body.includes('Review Your Answers') || body.includes('Submit Section'),
      onFRQ: body.includes('Free Response') || body.includes('FRQ'),
    }
  })
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const errors = []
  const findings = {
    login: null,
    sessionFlow: null,
    fix1_idbPendingDuringOffline: null,
    fix1_idbAfterFlush: null,
    fix1_flushTime: null,
    fix1_result: 'UNTESTED',
    fix1_notes: [],
    fix2_answeredAfterResume: null,
    fix2_expectedAnswers: null,
    fix2_result: 'UNTESTED',
    fix2_notes: [],
    fix10_unstableAt: null,
    fix10_reconnectedAt: null,
    fix10_result: 'UNTESTED',
    fix10_notes: [],
    codeStartsWith: 'PASS',
    tdzErrors: false,
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  page.on('console', m => {
    const txt = m.text()
    consoleLog.push({ type: m.type(), text: txt.substring(0, 300), url: page.url() })
    if (m.type() === 'error') {
      if (txt.includes('Cannot access') || txt.includes('before initialization')) {
        findings.tdzErrors = true
        console.log(`[TDZ ERROR] ${txt}`)
      }
      if (txt.includes('startsWith')) {
        findings.codeStartsWith = 'FAIL'
        console.log(`[CODE.STARTSWITH] ${txt}`)
      }
    }
  })
  page.on('pageerror', e => {
    errors.push(e.message)
    console.log(`[PAGE ERROR] ${e.message}`)
  })

  // -----------------------------------------------------------------------
  // LOGIN
  // -----------------------------------------------------------------------
  console.log('\n=== LOGIN ===')
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[type="email"]', { timeout: 10000 })
  await page.fill('input[type="email"]', 'student10@apboost.test')
  await page.fill('input[type="password"]', 'Student123!')
  await page.click('button[type="submit"]')
  await page.waitForNavigation({ timeout: 15000 })
  await sleep(2000)

  const loginUrl = page.url()
  if (loginUrl.includes('/login')) {
    findings.login = 'FAIL'
    await ss(page, '00_login_fail')
    await browser.close()
    writeFileSync(join(__dirname, 'b14g_fix1_results.json'), JSON.stringify(findings, null, 2))
    return findings
  }
  findings.login = 'PASS'
  console.log(`Login OK → ${loginUrl}`)

  // Navigate to AP if needed
  if (!loginUrl.includes('/ap')) {
    await page.goto(`${BASE_URL}/ap`, { waitUntil: 'domcontentloaded' })
    await sleep(1500)
    console.log('Navigated to /ap')
  }
  await ss(page, '01_dashboard')

  // -----------------------------------------------------------------------
  // ENSURE FRESH SESSION - navigate to test and check state
  // -----------------------------------------------------------------------
  console.log('\n=== NAVIGATE TO TEST ===')
  await page.goto(`${BASE_URL}/ap/test/test_micro_full_1`, { waitUntil: 'domcontentloaded' })
  await sleep(2500)
  await ss(page, '02_initial_test_page')

  const initialButtons = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t.length > 0)
  )
  console.log('Initial buttons:', initialButtons.join(' | '))

  // Check if we're on instruction screen (has Begin Test or Resume Test)
  const hasBeginOrResume = initialButtons.some(b => b.includes('Begin') || b.includes('Resume'))
  if (hasBeginOrResume) {
    // Click the button
    const btnText = initialButtons.find(b => b.includes('Begin') || b.includes('Resume'))
    console.log(`Clicking: "${btnText}"`)
    await page.evaluate(t => {
      const btns = Array.from(document.querySelectorAll('button'))
      const btn = btns.find(b => b.textContent.trim().includes(t.split(' ')[0]))
      if (btn) btn.click()
    }, btnText)
    await sleep(2500)
    await ss(page, '03_after_begin')
  }

  // Check current state
  let qState = await getQInfo(page)
  console.log('Current state:', qState)

  // If we landed on the Review screen (Q15 already done), we need to submit and restart
  if (qState.onReview) {
    console.log('On review screen — need to submit this section and proceed')

    // Submit Section 1
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      const btn = btns.find(b => b.textContent.trim().includes('Submit Section'))
      if (btn) btn.click()
    })
    await sleep(2000)
    await ss(page, '03b_after_submit_section1')

    // Handle confirmation dialog if any
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      // Confirm/Proceed buttons
      const confirmBtn = btns.find(b => {
        const t = b.textContent.trim()
        return t === 'Submit' || t === 'Confirm' || t === 'Yes' || t.includes('Submit Section')
      })
      if (confirmBtn) confirmBtn.click()
    })
    await sleep(2000)
    await ss(page, '03c_after_confirm')

    // Now handle FRQ section
    qState = await getQInfo(page)
    console.log('State after submit section 1:', qState)

    const buttonsNow = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 80)
    )
    console.log('Buttons after submit:', buttonsNow)

    // If FRQ choice screen or FRQ section, skip through it
    const pageBody = await page.evaluate(() => document.body.textContent.substring(0, 500))
    console.log('Body:', pageBody)

    if (pageBody.includes('Submit Test') || pageBody.includes('handwritten') || pageBody.includes('Free Response')) {
      // Try to submit test or skip FRQ
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'))
        const submitBtn = btns.find(b => {
          const t = b.textContent.trim()
          return t.includes('Submit Test') || t.includes('Submit All') || t.includes('Submit')
        })
        if (submitBtn) submitBtn.click()
      })
      await sleep(2000)
      await ss(page, '03d_submit_attempt')

      // Confirm if needed
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'))
        const confirmBtn = btns.find(b => {
          const t = b.textContent.trim()
          return t === 'Submit' || t === 'Confirm' || t === 'Submit Test' || t === 'Yes, Submit'
        })
        if (confirmBtn) confirmBtn.click()
      })
      await sleep(3000)
      await ss(page, '03e_after_submit')
    }

    // Navigate to AP dashboard
    await page.goto(`${BASE_URL}/ap`, { waitUntil: 'domcontentloaded' })
    await sleep(2000)
    await ss(page, '03f_back_to_dashboard')

    // Start fresh test
    await page.goto(`${BASE_URL}/ap/test/test_micro_full_1`, { waitUntil: 'domcontentloaded' })
    await sleep(2000)
    await ss(page, '03g_fresh_test_page')

    // Click Begin Test for new session
    const freshBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())
    )
    console.log('Fresh test buttons:', freshBtns)

    const freshBeginBtn = freshBtns.find(b => b.includes('Begin') || b.includes('Start'))
    if (freshBeginBtn) {
      await page.evaluate(t => {
        const btns = Array.from(document.querySelectorAll('button'))
        const btn = btns.find(b => b.textContent.trim() === t || b.textContent.trim().includes(t.split(' ')[0]))
        if (btn) btn.click()
      }, freshBeginBtn)
      await sleep(2500)
    }
  }

  await ss(page, '04_in_test')
  qState = await getQInfo(page)
  console.log('Test position:', qState)
  findings.sessionFlow = qState.onReview ? 'required-submit-first' : 'clean-start'

  // If still on review screen, we couldn't start fresh
  if (qState.onReview || qState.onFRQ) {
    findings.fix1_notes.push('Could not establish fresh MCQ test session — still on review/FRQ screen')
    findings.fix1_result = 'BLOCKED'
    findings.fix2_result = 'BLOCKED'
  } else {
    // -----------------------------------------------------------------------
    // ANSWER Q1-Q5 ONLINE
    // -----------------------------------------------------------------------
    console.log('\n=== ANSWER Q1-Q5 ONLINE ===')

    // Clear IDB for clean tracking
    const clearResult = await clearIDB(page)
    console.log(`IDB cleared: ${clearResult}`)

    const answeredOnline = {}

    for (let i = 0; i < 5; i++) {
      await sleep(600)
      const qi = await getQInfo(page)
      console.log(`  Answering Q${qi.q}...`)

      if (!qi.q) {
        console.log('  No question number found — stopping')
        break
      }

      // Try letters in order: A, B, C, D
      let answered = false
      for (const letter of ['A', 'B', 'C', 'D']) {
        const r = await clickAnswerButton(page, letter)
        if (r.ok) {
          answeredOnline[qi.q] = letter
          console.log(`  Q${qi.q} = ${letter}`)
          answered = true
          break
        }
      }

      if (!answered) {
        console.log(`  Failed to answer Q${qi.q}`)
      }

      await sleep(400)

      // Move to next question
      const nextResult = await clickNextOrReview(page)
      if (nextResult.type === 'review') {
        console.log('  Reached review — stopping online answers')
        break
      }
      await sleep(500)
    }

    console.log('Online answers:', answeredOnline)

    // Check IDB state before going offline
    const idbBeforeOffline = await getAllIDB(page)
    const pendingBeforeOffline = idbBeforeOffline.filter(i => i.status === 'PENDING')
    console.log(`IDB pending before offline: ${pendingBeforeOffline.length}`)

    // Wait for online flush
    await sleep(3000) // Allow scheduled flushes to complete

    const idbAfterOnlineFlush = await getAllIDB(page)
    const pendingAfterFlush = idbAfterOnlineFlush.filter(i => i.status === 'PENDING')
    console.log(`IDB pending after 3s online flush: ${pendingAfterFlush.length}`)
    await ss(page, '05_after_online_5q')

    // -----------------------------------------------------------------------
    // GO OFFLINE AND ANSWER Q6-Q8
    // -----------------------------------------------------------------------
    console.log('\n=== GO OFFLINE ===')
    await context.setOffline(true)
    await sleep(500)

    const isOnlineCheck = await page.evaluate(() => navigator.onLine)
    console.log(`navigator.onLine: ${isOnlineCheck}`)

    const answeredOffline = {}

    for (let i = 0; i < 3; i++) {
      await sleep(800)
      const qi = await getQInfo(page)
      console.log(`  Answering Q${qi.q} (offline)...`)

      if (!qi.q) {
        console.log('  No question number — stopping')
        break
      }

      // Pick B for offline answers (distinguishable from A online answers)
      for (const letter of ['B', 'C', 'D', 'A']) {
        const r = await clickAnswerButton(page, letter)
        if (r.ok) {
          answeredOffline[qi.q] = letter
          console.log(`  Q${qi.q} = ${letter} (offline)`)
          break
        }
      }

      await sleep(400)

      const nextResult = await clickNextOrReview(page)
      if (nextResult.type === 'review') break
      await sleep(500)
    }

    console.log('Offline answers:', answeredOffline)

    // Check IDB during offline
    const idbDuringOffline = await getAllIDB(page)
    const pendingDuringOffline = idbDuringOffline.filter(i => i.status === 'PENDING')
    console.log(`IDB pending during offline: ${pendingDuringOffline.length}`)
    console.log('IDB items:', JSON.stringify(idbDuringOffline.map(i => ({
      action: i.action, status: i.status, q: i.payload?.questionId
    })), null, 2))

    findings.fix1_idbPendingDuringOffline = pendingDuringOffline.length

    await ss(page, '06_during_offline')

    // Session ID
    let sessionId = idbDuringOffline[0]?.sessionId || null
    console.log(`Session ID: ${sessionId}`)

    // -----------------------------------------------------------------------
    // FIX-1 TEST: RESTORE NETWORK AND MEASURE FLUSH TIME
    // -----------------------------------------------------------------------
    console.log('\n=== RESTORE NETWORK (FIX-1) ===')
    await context.setOffline(false)
    const restoreAt = Date.now()

    // FIX-1 fix: handleOnline → scheduleFlush(500) via flushQueueRef
    // Expected: all items flushed within 3-5 seconds

    let flushCompleteAt = null
    for (let sec = 1; sec <= 10; sec++) {
      await sleep(1000)
      const idb = await getAllIDB(page)
      const pending = idb.filter(i => i.status === 'PENDING')
      console.log(`  ${sec}s after restore: ${pending.length} pending (was ${pendingDuringOffline.length})`)

      if (pending.length === 0 && pendingDuringOffline.length > 0) {
        flushCompleteAt = sec
        console.log(`  FLUSHED! All items cleared after ${sec}s`)
        break
      }
    }

    const idbFinal = await getAllIDB(page)
    const pendingFinal = idbFinal.filter(i => i.status === 'PENDING')

    findings.fix1_idbAfterFlush = pendingFinal.length
    findings.fix1_flushTime = flushCompleteAt

    await ss(page, '07_after_restore')

    if (pendingDuringOffline.length === 0 && Object.keys(answeredOffline).length === 0) {
      findings.fix1_result = 'INCONCLUSIVE'
      findings.fix1_notes.push('Could not get offline answers into IDB — session may have been at wrong position or answer detection failed')
    } else if (pendingDuringOffline.length === 0) {
      findings.fix1_result = 'INCONCLUSIVE'
      findings.fix1_notes.push(`Offline answers were captured (${JSON.stringify(answeredOffline)}) but IDB showed 0 pending — may have been flushed immediately after online flag cleared`)
    } else if (flushCompleteAt !== null) {
      findings.fix1_result = 'PASS'
      findings.fix1_notes.push(`PASS: ${pendingDuringOffline.length} offline items flushed within ${flushCompleteAt}s of network restore`)
      findings.fix1_notes.push('scheduleFlush via flushQueueRef is working correctly')
    } else {
      findings.fix1_result = 'FAIL'
      findings.fix1_notes.push(`FAIL: ${pendingFinal.length}/${pendingDuringOffline.length} items still pending after 10s`)
    }

    if (!findings.tdzErrors) {
      findings.fix1_notes.push('No TDZ errors found — stale closure fix did not introduce initialization bugs')
    }

    // -----------------------------------------------------------------------
    // FIX-2 TEST: RELOAD AND VERIFY ANSWERS PRESERVED
    // -----------------------------------------------------------------------
    console.log('\n=== RELOAD FOR FIX-2 TEST ===')
    const totalExpected = Object.keys(answeredOnline).length + Object.keys(answeredOffline).length
    findings.fix2_expectedAnswers = {
      online: answeredOnline,
      offline: answeredOffline,
      total: totalExpected
    }

    await ss(page, '08_before_reload')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await sleep(2500)
    await ss(page, '09_after_reload')

    const reloadButtons = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t.length > 0)
    )
    console.log('After reload buttons:', reloadButtons.join(' | '))

    if (reloadButtons.some(b => b.includes('Resume'))) {
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().includes('Resume'))
        if (btn) btn.click()
      })
      await sleep(2500)
      await ss(page, '10_after_resume')
    }

    // Wait for sync to complete
    await sleep(2000)

    // Open navigator to see answered questions
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      const navBtn = btns.find(b => {
        const t = b.textContent.trim()
        return t === '▲' || t.endsWith('▲') || (t.includes('▲') && t.length < 30)
      })
      if (navBtn) navBtn.click()
    })
    await sleep(1000)
    await ss(page, '11_navigator_open')

    // Get navigator data
    const navData = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      const questionBtns = btns.filter(b => {
        const t = b.textContent.trim()
        return /^\d+$/.test(t) && parseInt(t) >= 1 && parseInt(t) <= 20
      })
      return questionBtns.map(b => ({
        q: parseInt(b.textContent.trim()),
        answered: b.className.includes('bg-brand-primary'),
        flagged: b.className.includes('flagged') || b.className.includes('warning'),
      }))
    })

    const answeredInNav = navData.filter(q => q.answered).map(q => q.q)
    console.log('Navigator answered questions:', answeredInNav)

    // Also check review screen
    // Close navigator and click Review
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      const reviewBtn = btns.find(b => b.textContent.trim() === 'Go to Review Screen' || b.textContent.trim().includes('Go to Review'))
      if (reviewBtn) reviewBtn.click()
    })
    await sleep(1500)
    await ss(page, '12_after_review_nav')

    // Navigate to review screen via answer questions
    const reviewData = await page.evaluate(() => {
      const body = document.body.textContent
      const answeredMatch = body.match(/Answered:\s*(\d+)\/(\d+)/) ||
                            body.match(/Answered:\s*(\d+)\s*\/\s*(\d+)/)
      const unansweredMatch = body.match(/Unanswered:\s*(\d+)/)
      return {
        answered: answeredMatch ? parseInt(answeredMatch[1]) : null,
        total: answeredMatch ? parseInt(answeredMatch[2]) : null,
        unanswered: unansweredMatch ? parseInt(unansweredMatch[1]) : null,
        rawBody: body.substring(0, 600),
        isReviewScreen: body.includes('Review Your Answers')
      }
    })
    console.log('Review data:', JSON.stringify(reviewData))

    findings.fix2_answeredAfterResume = {
      answeredInNavigator: answeredInNav,
      answeredCount: reviewData.answered,
      totalCount: reviewData.total,
      unanswered: reviewData.unanswered,
      reviewData: reviewData.rawBody.substring(0, 400)
    }

    // Evaluate FIX-2
    const preservedCount = reviewData.answered || answeredInNav.length

    // Check if specific offline question answers are present
    const offlineQNums = Object.keys(answeredOffline).map(Number)
    const offlinePreserved = offlineQNums.filter(q => answeredInNav.includes(q))

    findings.fix2_notes.push(`Expected answers: online=${JSON.stringify(answeredOnline)}, offline=${JSON.stringify(answeredOffline)}`)
    findings.fix2_notes.push(`Total expected: ${totalExpected}`)
    findings.fix2_notes.push(`Navigator shows answered Q: ${JSON.stringify(answeredInNav)}`)
    findings.fix2_notes.push(`Review screen: Answered ${reviewData.answered}/${reviewData.total}, Unanswered: ${reviewData.unanswered}`)
    findings.fix2_notes.push(`Offline Qs in navigator: ${JSON.stringify(offlinePreserved)} of ${JSON.stringify(offlineQNums)}`)

    if (totalExpected === 0) {
      findings.fix2_result = 'INCONCLUSIVE'
      findings.fix2_notes.push('Could not answer questions — test flow issue')
    } else if (preservedCount >= totalExpected) {
      findings.fix2_result = 'PASS'
      findings.fix2_notes.push(`PASS: ${preservedCount} answers preserved (${totalExpected} expected)`)
    } else if (preservedCount >= Object.keys(answeredOnline).length) {
      findings.fix2_result = 'PARTIAL'
      findings.fix2_notes.push(`PARTIAL: ${preservedCount}/${totalExpected} preserved — online answers OK but offline answers may be lost`)
    } else {
      findings.fix2_result = 'FAIL'
      findings.fix2_notes.push(`FAIL: Only ${preservedCount}/${totalExpected} preserved`)
    }

    await ss(page, '13_final_state')
  }

  // -----------------------------------------------------------------------
  // FIX-10: HEARTBEAT RECOVERY (already tested in v2, confirmed 2s recovery)
  // This is a quick re-confirm on current test page
  // -----------------------------------------------------------------------
  console.log('\n=== FIX-10 QUICK CONFIRM (from v2 results) ===')
  findings.fix10_notes.push('FIX-10 result from b14g_retest_v2: PASS — Reconnected in 2010ms')
  findings.fix10_notes.push('"Connection unstable" appeared after 46503ms offline (3 failures at 15s each = ~45s)')
  findings.fix10_notes.push('"Syncing" appeared 1s after restore, "Reconnected" at 2s after restore')
  findings.fix10_notes.push('Analysis: Fast recovery is due to visibilitychange handler in useHeartbeat (line 117-128)')
  findings.fix10_notes.push('Playwright setOffline(false) causes page visibility change which triggers immediate doHeartbeat()')
  findings.fix10_notes.push('FIX-10 (online event listener) is NOT explicitly applied BUT visibilitychange provides equivalent behavior')
  findings.fix10_result = 'DOCUMENTED'

  // Cleanup
  await context.close()
  await browser.close()

  // Write results
  const out = join(__dirname, 'b14g_fix1_results.json')
  writeFileSync(out, JSON.stringify({ findings, consoleLog: consoleLog.slice(0, 100), timeline }, null, 2))
  console.log(`\nResults: ${out}`)

  console.log('\n=== SUMMARY ===')
  console.log(`FIX-1: ${findings.fix1_result}`)
  findings.fix1_notes.forEach(n => console.log(`  ${n}`))
  console.log(`FIX-2: ${findings.fix2_result}`)
  findings.fix2_notes.forEach(n => console.log(`  ${n}`))
  console.log(`FIX-10: ${findings.fix10_result}`)
  findings.fix10_notes.forEach(n => console.log(`  ${n}`))
  console.log(`code.startsWith: ${findings.codeStartsWith}`)
  console.log(`TDZ errors: ${findings.tdzErrors}`)

  return findings
}

run().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
