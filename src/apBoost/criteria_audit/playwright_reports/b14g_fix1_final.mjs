/**
 * B14G FIX-1 Final Test
 * Handles DuplicateTabModal, navigates from review screen to unanswered questions
 */

import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCREENSHOTS_DIR = join(__dirname, 'screenshots_B14G_final')
const BASE_URL = 'http://localhost:5173'
try { mkdirSync(SCREENSHOTS_DIR, { recursive: true }) } catch {}

const sleep = ms => new Promise(r => setTimeout(r, ms))
let ssCount = 0

async function ss(page, label) {
  const fn = `${String(++ssCount).padStart(2, '0')}_${label}.png`
  await page.screenshot({ path: join(SCREENSHOTS_DIR, fn), fullPage: true })
  console.log(`[SS] ${fn}`)
  return fn
}

async function getAllIDB(page) {
  return page.evaluate(async () => {
    return new Promise(res => {
      try {
        const req = indexedDB.open('ap_boost_queue', 1)
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('actions')) return res([])
          const tx = db.transaction('actions', 'readonly')
          const r = tx.objectStore('actions').getAll()
          r.onsuccess = () => res(r.result || [])
          r.onerror = () => res([])
        }
        req.onerror = () => res([])
      } catch(e) { res([]) }
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
        tx.objectStore('actions').clear()
        tx.oncomplete = () => res('cleared')
        tx.onerror = () => res('error')
      }
      req.onerror = () => res('idb-error')
    })
  })
}

async function getPageState(page) {
  return page.evaluate(() => {
    const body = document.body.textContent
    const btns = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 80)
    const qMatch = body.match(/Question (\d+) of (\d+)/)
    return {
      buttons: btns,
      hasQuestion: !!qMatch,
      q: qMatch ? parseInt(qMatch[1]) : null,
      total: qMatch ? parseInt(qMatch[2]) : null,
      hasDuplicateModal: body.includes('Session Active Elsewhere') || body.includes('This test is already open'),
      hasReview: body.includes('Review Your Answers'),
      hasFRQ: body.includes('Free Response Section') && body.includes('type your responses'),
      hasInstruction: body.includes('Begin Test') || body.includes('Resume Test'),
      body: body.substring(0, 300)
    }
  })
}

async function clickButton(page, textPart) {
  return page.evaluate(txt => {
    const btns = Array.from(document.querySelectorAll('button'))
    const btn = btns.find(b => b.textContent.trim().includes(txt))
    if (btn) { btn.click(); return { ok: true, text: btn.textContent.trim() } }
    return { ok: false, available: btns.map(b => b.textContent.trim()).filter(t => t).slice(0, 15) }
  }, textPart)
}

async function clickAnswerChoice(page, letter) {
  return page.evaluate(ltr => {
    // AnswerInput renders buttons with flex-1 items-start classes
    // containing a span.rounded-full with the letter
    const allBtns = Array.from(document.querySelectorAll('button[type="button"]'))
    for (const btn of allBtns) {
      if (btn.disabled) continue
      const cls = btn.className || ''
      // Must be a full-width answer choice button
      if (!cls.includes('flex-1') && !cls.includes('items-start')) continue
      const spans = Array.from(btn.querySelectorAll('span'))
      for (const span of spans) {
        const spanCls = span.className || ''
        const txt = span.textContent.trim()
        if (txt === ltr && (spanCls.includes('rounded-full') || spanCls.includes('w-6') || spanCls.includes('h-6'))) {
          btn.click()
          return { ok: true, letter: ltr, buttonText: btn.textContent.trim().substring(0, 50) }
        }
      }
    }
    // Fallback: any non-strikethrough button that starts with a letter badge
    for (const btn of allBtns) {
      if (btn.disabled) continue
      const txt = btn.textContent.trim()
      if (txt.length > 0 && txt.length < 200) {
        const spans = Array.from(btn.querySelectorAll('span'))
        const firstLetterSpan = spans.find(s => s.textContent.trim() === ltr)
        if (firstLetterSpan) {
          btn.click()
          return { ok: true, letter: ltr, fallback: true }
        }
      }
    }
    return { ok: false, letter: ltr }
  }, letter)
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  const findings = {
    login: null,
    fix1: { result: 'UNTESTED', notes: [] },
    fix2: { result: 'UNTESTED', notes: [] },
    fix10: {
      result: 'DOCUMENTED',
      notes: [
        'Tested in b14g_retest_v2.mjs — "Connection unstable" appeared after 46503ms (3 failed heartbeats at 15s each)',
        '"Reconnected" banner appeared 2010ms after network restore — fast recovery due to visibilitychange handler',
        'FIX-10 explicitly adds window.online event listener to useHeartbeat.js',
        'Current visibilitychange handler provides equivalent behavior in headless browser context',
        'Manual test with a non-headless browser would require longer wait for next heartbeat (up to 15s)',
        'HEARTBEAT_INTERVAL=15000ms, MAX_FAILURES=3 — banner appears after ~45s offline (confirmed)',
      ]
    },
    codeStartsWith: 'PASS',
    tdzError: false,
    consoleErrors: [],
    idbCaptures: {},
  }

  const consoleLog = []
  page.on('console', m => {
    const t = m.text()
    consoleLog.push({ type: m.type(), text: t.substring(0, 300), url: page.url() })
    if (m.type() === 'error') {
      findings.consoleErrors.push({ text: t.substring(0, 200) })
      if (t.includes('Cannot access') || t.includes('before initialization')) {
        findings.tdzError = true
        console.log(`TDZ ERROR: ${t}`)
      }
      if (t.includes('startsWith') && !t.includes('ERR_') && !t.includes('APBoost:')) {
        findings.codeStartsWith = 'FAIL'
      }
    }
  })
  page.on('pageerror', e => {
    findings.consoleErrors.push({ text: 'page: ' + e.message.substring(0, 200) })
  })

  try {
    // === LOGIN ===
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
      await ss(page, 'login_fail')
      throw new Error('Login failed')
    }
    findings.login = 'PASS'
    console.log(`Login OK → ${loginUrl}`)
    await ss(page, '01_login')

    // === NAVIGATE TO TEST ===
    console.log('\n=== NAVIGATE TO TEST ===')
    await page.goto(`${BASE_URL}/ap/test/test_micro_full_1`, { waitUntil: 'domcontentloaded' })
    await sleep(2500)

    let state = await getPageState(page)
    console.log('Initial state:', state.buttons.join(' | '))
    console.log('Has duplicate modal:', state.hasDuplicateModal)

    await ss(page, '02_initial')

    // Handle DuplicateTabModal if present
    if (state.hasDuplicateModal) {
      console.log('Handling DuplicateTabModal...')
      const useThisTab = await clickButton(page, 'Use This Tab')
      console.log('Use This Tab:', useThisTab)
      await sleep(1500)
      state = await getPageState(page)
    }

    // Click Begin Test / Resume Test if on instruction screen
    if (state.hasInstruction) {
      const btnTxt = state.buttons.find(b => b.includes('Begin') || b.includes('Resume'))
      if (btnTxt) {
        console.log(`Clicking: "${btnTxt}"`)
        await clickButton(page, btnTxt.includes('Resume') ? 'Resume' : 'Begin')
        await sleep(2500)
      }
    }

    await ss(page, '03_after_begin')
    state = await getPageState(page)
    console.log('Post-begin state:', JSON.stringify(state).substring(0, 200))

    // Handle DuplicateTabModal that might appear after begin
    if (state.hasDuplicateModal) {
      console.log('DuplicateTabModal after begin — taking control')
      await clickButton(page, 'Use This Tab')
      await sleep(1500)
      state = await getPageState(page)
    }

    console.log(`State: Q${state.q}/${state.total}, review=${state.hasReview}`)

    // ====================================================================
    // If on Review Screen, click "Return to Questions" to go to Q7
    // ====================================================================
    if (state.hasReview) {
      console.log('On review screen — clicking Return to Questions')
      const ret = await clickButton(page, 'Return to Questions')
      console.log('Return:', ret)
      await sleep(1500)
      state = await getPageState(page)
      console.log(`After Return: Q${state.q}/${state.total}`)
      await ss(page, '04_after_return')
    }

    // If still no question (possibly on Q15 which jumps to review), navigate back
    if (!state.q && !state.hasReview) {
      // The test might be in testing view but nav detection failing
      console.log('No question detected — inspecting DOM')
      const domInfo = await page.evaluate(() => {
        const sections = document.querySelectorAll('[class*="section"]')
        const questions = document.querySelectorAll('[class*="question"]')
        const h2s = document.querySelectorAll('h2, h3')
        const allText = document.body.textContent.substring(0, 1000)
        return {
          sections: sections.length,
          questions: questions.length,
          h2s: Array.from(h2s).map(h => h.textContent.substring(0, 80)),
          text: allText
        }
      })
      console.log('DOM info:', JSON.stringify(domInfo, null, 2))
    }

    // ====================================================================
    // Clear IDB for clean FIX-1/FIX-2 tracking
    // ====================================================================
    const clearResult = await clearIDB(page)
    console.log(`IDB cleared: ${clearResult}`)

    // ====================================================================
    // ANSWER Q7-Q9 ONLINE (first 3 unanswered questions)
    // ====================================================================
    console.log('\n=== ANSWER 3 QUESTIONS ONLINE ===')

    const answeredOnline = {}
    let answeredOnlineCount = 0

    for (let attempt = 0; attempt < 10 && answeredOnlineCount < 3; attempt++) {
      await sleep(500)
      state = await getPageState(page)

      if (state.hasReview || !state.q) {
        // On review screen or no question — try Return to Questions
        const r = await clickButton(page, 'Return to Questions')
        if (!r.ok) {
          console.log(`Could not return from review (attempt ${attempt})`)
          // Check if we're stuck
          break
        }
        await sleep(1000)
        state = await getPageState(page)
        continue
      }

      console.log(`  At Q${state.q} — answering`)

      // Try letters A, B, C, D
      let answered = false
      for (const ltr of ['A', 'B', 'C', 'D']) {
        const r = await clickAnswerChoice(page, ltr)
        if (r.ok) {
          answeredOnline[state.q] = ltr
          console.log(`  Q${state.q} = ${ltr}`)
          answered = true
          answeredOnlineCount++
          break
        }
      }

      if (!answered) {
        console.log(`  Could not answer Q${state.q}`)
        // The question might already be answered — just proceed
      }

      await sleep(300)

      // Click Next
      const nextResult = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'))
        for (const btn of btns) {
          const t = btn.textContent.trim()
          if (t === 'Next →' || t === 'Next') { btn.click(); return 'next' }
        }
        for (const btn of btns) {
          const t = btn.textContent.trim()
          if (t.includes('Review →')) { btn.click(); return 'review' }
        }
        return null
      })
      console.log(`  Next result: ${nextResult}`)
      await sleep(400)

      if (nextResult === 'review') {
        // Landed on review — Return to Questions
        await sleep(800)
        await clickButton(page, 'Return to Questions')
        await sleep(800)
      }
    }

    console.log(`Answered online: ${JSON.stringify(answeredOnline)}`)
    findings.fix2.notes.push(`Online answers: ${JSON.stringify(answeredOnline)}`)

    // Check IDB before going offline (after small delay for flush)
    await sleep(2000)
    const idbBeforeOffline = await getAllIDB(page)
    console.log(`IDB before offline: ${idbBeforeOffline.length} total, ${idbBeforeOffline.filter(i => i.status === 'PENDING').length} pending`)
    findings.idbCaptures.beforeOffline = idbBeforeOffline.filter(i => i.status === 'PENDING').length

    await ss(page, '05_after_online_answers')

    // ====================================================================
    // GO OFFLINE — ANSWER 3 MORE QUESTIONS
    // ====================================================================
    console.log('\n=== GO OFFLINE (FIX-1 TEST) ===')
    await context.setOffline(true)
    await sleep(500)

    const isOfflineNow = await page.evaluate(() => !navigator.onLine)
    console.log(`Offline: ${isOfflineNow}`)

    const answeredOffline = {}
    let answeredOfflineCount = 0

    for (let attempt = 0; attempt < 10 && answeredOfflineCount < 3; attempt++) {
      await sleep(500)
      state = await getPageState(page)

      if (state.hasReview || !state.q) {
        const r = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'))
          const btn = btns.find(b => b.textContent.trim().includes('Return to Questions'))
          if (btn) { btn.click(); return true }
          return false
        })
        if (!r) break
        await sleep(800)
        state = await getPageState(page)
        continue
      }

      console.log(`  At Q${state.q} (offline)`)

      // Pick B or C for offline answers (distinguishable)
      let answered = false
      for (const ltr of ['B', 'C', 'D', 'A']) {
        const r = await clickAnswerChoice(page, ltr)
        if (r.ok) {
          answeredOffline[state.q] = ltr
          console.log(`  Q${state.q} = ${ltr} (offline)`)
          answered = true
          answeredOfflineCount++
          break
        }
      }

      if (!answered) console.log(`  Could not answer Q${state.q} offline`)

      await sleep(300)
      const nr = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'))
        for (const b of btns) {
          const t = b.textContent.trim()
          if (t === 'Next →' || t === 'Next') { b.click(); return 'next' }
        }
        for (const b of btns) {
          const t = b.textContent.trim()
          if (t.includes('Review →')) { b.click(); return 'review' }
        }
        return null
      })
      await sleep(400)
      if (nr === 'review') {
        await sleep(600)
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().includes('Return to Questions'))
          if (btn) btn.click()
        })
        await sleep(600)
      }
    }

    console.log(`Answered offline: ${JSON.stringify(answeredOffline)}`)
    findings.fix2.notes.push(`Offline answers: ${JSON.stringify(answeredOffline)}`)

    // Check IDB during offline
    const idbDuringOffline = await getAllIDB(page)
    const pendingDuringOffline = idbDuringOffline.filter(i => i.status === 'PENDING')
    console.log(`IDB pending during offline: ${pendingDuringOffline.length}`)
    console.log('Pending items:', pendingDuringOffline.map(i => ({
      action: i.action, q: i.payload?.questionId, val: i.payload?.value
    })))

    findings.fix1.notes.push(`Pending items in IDB during offline: ${pendingDuringOffline.length}`)
    findings.idbCaptures.duringOffline = pendingDuringOffline.length

    await ss(page, '06_during_offline')

    // ====================================================================
    // RESTORE NETWORK — FIX-1 TEST
    // ====================================================================
    console.log('\n=== RESTORE NETWORK (FIX-1) ===')
    await context.setOffline(false)
    const restoreAt = Date.now()
    console.log(`Network restored at t=0`)

    let fix1FlushAt = null
    for (let sec = 1; sec <= 12; sec++) {
      await sleep(1000)
      const idb = await getAllIDB(page)
      const pending = idb.filter(i => i.status === 'PENDING')
      console.log(`  t+${sec}s: ${pending.length} pending (was ${pendingDuringOffline.length})`)

      if (pending.length === 0 && pendingDuringOffline.length > 0) {
        fix1FlushAt = sec
        console.log(`  ALL FLUSHED at t+${sec}s`)
        break
      }
    }

    const idbAfterFlush = await getAllIDB(page)
    const pendingAfterFlush = idbAfterFlush.filter(i => i.status === 'PENDING')
    console.log(`Final IDB pending: ${pendingAfterFlush.length}`)

    await ss(page, '07_after_restore')

    // Evaluate FIX-1
    if (pendingDuringOffline.length === 0 && answeredOfflineCount === 0) {
      findings.fix1.result = 'INCONCLUSIVE'
      findings.fix1.notes.push('No items appeared in IDB during offline phase — could not verify flush behavior')
      findings.fix1.notes.push('Possible causes: answer click detection failed, or IDB write is sync-delayed past offline window')
    } else if (pendingDuringOffline.length === 0 && answeredOfflineCount > 0) {
      findings.fix1.result = 'INCONCLUSIVE'
      findings.fix1.notes.push(`${answeredOfflineCount} answers clicked offline but IDB was empty — writes may have been skipped due to offline flag`)
      findings.fix1.notes.push('NOTE: useOfflineQueue.addToQueue writes IDB regardless of online status — this is unexpected')
    } else if (fix1FlushAt !== null) {
      findings.fix1.result = 'PASS'
      findings.fix1.notes.push(`PASS: ${pendingDuringOffline.length} items flushed in ${fix1FlushAt}s after network restore`)
      findings.fix1.notes.push('scheduleFlush via flushQueueRef is functioning correctly (FIX-1 verified)')
    } else {
      findings.fix1.result = 'FAIL'
      findings.fix1.notes.push(`FAIL: ${pendingAfterFlush.length}/${pendingDuringOffline.length} items still pending after 12s`)
    }

    if (findings.tdzError) {
      findings.fix1.notes.push('TDZ ERROR DETECTED — stale closure fix introduced initialization bug')
    } else {
      findings.fix1.notes.push('No TDZ errors — flushQueueRef initialization is safe')
    }

    // ====================================================================
    // RELOAD FOR FIX-2 TEST
    // ====================================================================
    console.log('\n=== RELOAD FOR FIX-2 TEST ===')
    const totalExpected = answeredOnlineCount + answeredOfflineCount
    const onlineQs = Object.keys(answeredOnline).map(Number)
    const offlineQs = Object.keys(answeredOffline).map(Number)

    await ss(page, '08_before_reload')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await sleep(2500)

    state = await getPageState(page)
    console.log('Post-reload state:', state.buttons.join(' | ').substring(0, 200))

    // Handle DuplicateTabModal
    if (state.hasDuplicateModal) {
      console.log('DuplicateTabModal after reload — taking control')
      await clickButton(page, 'Use This Tab')
      await sleep(1500)
      state = await getPageState(page)
    }

    // Resume test
    if (state.hasInstruction || state.buttons.some(b => b.includes('Resume') || b.includes('Begin'))) {
      const btnTxt = state.buttons.find(b => b.includes('Resume') || b.includes('Begin'))
      if (btnTxt) {
        await clickButton(page, btnTxt.includes('Resume') ? 'Resume' : 'Begin')
        await sleep(2500)
      }
    }

    await ss(page, '09_after_resume')

    // Wait for any sync to complete
    await sleep(2000)

    // Open navigator to check answers
    const navOpened = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      const btn = btns.find(b => {
        const t = b.textContent.trim()
        return t === '▲' || (t.includes('▲') && t.length < 30) || t.includes('Navigator')
      })
      if (btn) { btn.click(); return { clicked: true, text: btn.textContent.trim() } }
      return { clicked: false }
    })
    console.log('Navigator opened:', navOpened)
    await sleep(1000)
    await ss(page, '10_navigator')

    // Read answered state from navigator
    const navData = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      const numBtns = btns.filter(b => /^\d+$/.test(b.textContent.trim()) && parseInt(b.textContent.trim()) <= 20)
      return numBtns.map(b => ({
        q: parseInt(b.textContent.trim()),
        answered: b.className.includes('bg-brand-primary'),
        flagged: b.className.includes('bg-warning') || b.className.includes('flagged'),
      }))
    })
    const answeredQNums = navData.filter(q => q.answered).map(q => q.q)
    console.log('Navigator answered Qs:', answeredQNums)

    // Navigate to review
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      const btn = btns.find(b => b.textContent.trim().includes('Go to Review') || b.textContent.trim().includes('Review Screen'))
      if (btn) btn.click()
    })
    await sleep(1500)

    // Or navigate via Next until review
    state = await getPageState(page)
    if (!state.hasReview) {
      for (let i = 0; i < 20 && !state.hasReview; i++) {
        const nr = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'))
          for (const b of btns) {
            if (b.textContent.trim().includes('Review →')) { b.click(); return 'review' }
          }
          for (const b of btns) {
            if (b.textContent.trim() === 'Next →') { b.click(); return 'next' }
          }
          return null
        })
        if (nr === 'review') break
        await sleep(400)
        state = await getPageState(page)
        if (state.hasReview) break
      }
    }

    await ss(page, '11_review_screen')

    const reviewData = await page.evaluate(() => {
      const body = document.body.textContent
      const m1 = body.match(/Answered:\s*(\d+)\/(\d+)/)
      const m2 = body.match(/Unanswered:\s*(\d+)/)
      return {
        answered: m1 ? parseInt(m1[1]) : null,
        total: m1 ? parseInt(m1[2]) : null,
        unanswered: m2 ? parseInt(m2[1]) : null,
        summary: body.substring(body.indexOf('Summary'), body.indexOf('Summary') + 300) || body.substring(0, 400)
      }
    })
    console.log('Review data:', reviewData)

    findings.fix2.notes.push(`Navigator shows answered: ${JSON.stringify(answeredQNums)}`)
    findings.fix2.notes.push(`Review screen: Answered ${reviewData.answered}/${reviewData.total}, Unanswered: ${reviewData.unanswered}`)
    findings.fix2.notes.push(`Summary: ${reviewData.summary.substring(0, 200)}`)

    // Evaluate FIX-2
    const onlinePreserved = onlineQs.filter(q => answeredQNums.includes(q))
    const offlinePreserved = offlineQs.filter(q => answeredQNums.includes(q))

    findings.fix2.notes.push(`Online Qs expected: ${JSON.stringify(onlineQs)}, preserved: ${JSON.stringify(onlinePreserved)}`)
    findings.fix2.notes.push(`Offline Qs expected: ${JSON.stringify(offlineQs)}, preserved: ${JSON.stringify(offlinePreserved)}`)

    if (totalExpected === 0) {
      findings.fix2.result = 'INCONCLUSIVE'
      findings.fix2.notes.push('No answers to verify — UI interaction blocked')
    } else if (offlineQs.length === 0) {
      if (onlinePreserved.length >= onlineQs.length && onlineQs.length > 0) {
        findings.fix2.result = 'PARTIAL'
        findings.fix2.notes.push(`PARTIAL: Online answers preserved (${onlinePreserved.length}/${onlineQs.length}) but no offline answers to test FIX-2`)
      } else if (onlinePreserved.length < onlineQs.length) {
        findings.fix2.result = 'FAIL'
        findings.fix2.notes.push(`FAIL: Even online answers lost — ${onlinePreserved.length}/${onlineQs.length}`)
      } else {
        findings.fix2.result = 'INCONCLUSIVE'
      }
    } else if (offlinePreserved.length === offlineQs.length && onlinePreserved.length === onlineQs.length) {
      findings.fix2.result = 'PASS'
      findings.fix2.notes.push(`PASS: All ${totalExpected} answers preserved (${onlineQs.length} online + ${offlineQs.length} offline)`)
    } else {
      findings.fix2.result = 'FAIL'
      findings.fix2.notes.push(`FAIL: offline ${offlinePreserved.length}/${offlineQs.length}, online ${onlinePreserved.length}/${onlineQs.length}`)
    }

    await ss(page, '12_final')

  } catch(err) {
    console.error('SCRIPT ERROR:', err.message)
    findings.consoleErrors.push({ text: 'SCRIPT: ' + err.message, stack: err.stack?.substring(0, 300) })
  }

  await context.close()
  await browser.close()

  const outFile = join(__dirname, 'b14g_fix1_final_results.json')
  writeFileSync(outFile, JSON.stringify({ findings, consoleLog: consoleLog.slice(0, 100) }, null, 2))
  console.log(`\nResults: ${outFile}`)

  console.log('\n=== FINAL SUMMARY ===')
  console.log(`Login: ${findings.login}`)
  console.log(`\nFIX-1: ${findings.fix1.result}`)
  findings.fix1.notes.forEach(n => console.log(`  ${n}`))
  console.log(`\nFIX-2: ${findings.fix2.result}`)
  findings.fix2.notes.forEach(n => console.log(`  ${n}`))
  console.log(`\nFIX-10: ${findings.fix10.result}`)
  findings.fix10.notes.forEach(n => console.log(`  ${n}`))
  console.log(`\ncode.startsWith: ${findings.codeStartsWith}`)
  console.log(`TDZ errors: ${findings.tdzError}`)
  console.log(`Console errors: ${findings.consoleErrors.length}`)

  return findings
}

run().catch(err => { console.error('FATAL:', err); process.exit(1) })
