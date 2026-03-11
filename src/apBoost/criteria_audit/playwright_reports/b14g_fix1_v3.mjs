/**
 * B14G FIX-1 Test V3
 * Key insight: student10 session is at Q15, Q1-Q6 already answered in Firestore
 * Strategy: Navigate to Q7 (first unanswered), answer Q7-Q11 online (track IDB),
 *           go offline and answer Q12-Q14, then test FIX-1 flush behavior
 */

import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCREENSHOTS_DIR = join(__dirname, 'screenshots_B14G_fix1v3')
const BASE_URL = 'http://localhost:5173'
try { mkdirSync(SCREENSHOTS_DIR, { recursive: true }) } catch {}

let ssCount = 0
const sleep = ms => new Promise(r => setTimeout(r, ms))

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
          const allR = tx.objectStore('actions').getAll()
          allR.onsuccess = () => res(allR.result || [])
          allR.onerror = () => res([])
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

// Click a navigator question number to jump to it
async function navigatorJumpTo(page, qNum) {
  return page.evaluate(num => {
    // Open navigator first
    const allBtns = Array.from(document.querySelectorAll('button'))

    // Check if navigator is already open
    const navBtns = allBtns.filter(b => {
      const t = b.textContent.trim()
      return /^\d+$/.test(t) && parseInt(t) === num
    })

    if (navBtns.length > 0) {
      navBtns[0].click()
      return { jumped: true, via: 'navigator-already-open' }
    }

    // Open navigator via chevron button
    const toggleBtn = allBtns.find(b => {
      const t = b.textContent.trim()
      return t === '▲' || t.endsWith('▲') || (t.includes('▲') && t.length < 40)
    })
    if (toggleBtn) {
      toggleBtn.click()
      return { opened: true, needsSecondClick: true }
    }

    return { failed: true }
  }, qNum)
}

// Click an answer choice
async function clickChoice(page, letter) {
  return page.evaluate(ltr => {
    const btns = Array.from(document.querySelectorAll('button[type="button"]'))
    for (const btn of btns) {
      // Skip disabled buttons
      if (btn.disabled) continue
      // AnswerInput buttons have flex-1 class and contain a rounded-full letter span
      if (!btn.className.includes('flex-1') && !btn.className.includes('items-start')) continue
      const spans = btn.querySelectorAll('span')
      for (const span of spans) {
        if (span.textContent.trim() === ltr &&
            (span.className.includes('rounded-full') || span.className.includes('w-6'))) {
          btn.click()
          return { ok: true, letter: ltr }
        }
      }
    }
    // More lenient fallback
    for (const btn of btns) {
      if (btn.disabled) continue
      const firstSpan = btn.querySelector('span')
      if (firstSpan && firstSpan.textContent.trim() === ltr) {
        btn.click()
        return { ok: true, letter: ltr, fallback: true }
      }
    }
    return { ok: false, letter: ltr }
  }, letter)
}

async function clickNext(page) {
  return page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    for (const btn of btns) {
      const t = btn.textContent.trim()
      if (t === 'Next →' || t === 'Next') { btn.click(); return 'next' }
    }
    for (const btn of btns) {
      const t = btn.textContent.trim()
      if (t.includes('Review →') || t === 'Review') { btn.click(); return 'review' }
    }
    return null
  })
}

async function getCurrentQ(page) {
  return page.evaluate(() => {
    const body = document.body.textContent
    const m = body.match(/Question (\d+) of (\d+)/)
    return { q: m ? parseInt(m[1]) : null, total: m ? parseInt(m[2]) : null }
  })
}

async function getConnectionBanner(page) {
  return page.evaluate(() => {
    const body = document.body.textContent
    return {
      unstable: body.includes('Connection unstable'),
      reconnected: body.includes('Reconnected'),
      syncing: body.includes('Syncing your progress'),
    }
  })
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  const findings = {
    login: null,
    fix1: { result: 'UNTESTED', pendingOffline: 0, pendingAfterFlush: 0, flushTimeSeconds: null, notes: [] },
    fix2: { result: 'UNTESTED', answeredOnline: {}, answeredOffline: {}, preservedAfterResume: null, reviewData: null, notes: [] },
    fix10: { result: 'DOCUMENTED', notes: [] },
    codeStartsWith: 'PASS',
    tdzError: false,
    consoleErrors: [],
  }

  page.on('console', m => {
    if (m.type() === 'error') {
      const t = m.text()
      findings.consoleErrors.push({ text: t.substring(0, 200), url: page.url() })
      if (t.includes('Cannot access') || t.includes('before initialization')) findings.tdzError = true
      if (t.includes('startsWith') && !t.includes('ERR_') && !t.includes('APBoost')) findings.codeStartsWith = 'FAIL'
    }
  })

  try {
    // LOGIN
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
      return findings
    }
    findings.login = 'PASS'
    console.log(`Logged in → ${loginUrl}`)
    await ss(page, '01_login')

    // NAVIGATE TO TEST
    await page.goto(`${BASE_URL}/ap/test/test_micro_full_1`, { waitUntil: 'domcontentloaded' })
    await sleep(2500)

    // Click Begin/Resume
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      const btn = btns.find(b => b.textContent.trim().includes('Begin') || b.textContent.trim().includes('Resume'))
      if (btn) btn.click()
    })
    await sleep(2500)
    await ss(page, '02_test_started')

    let qi = await getCurrentQ(page)
    console.log(`Starting at Q${qi.q}/${qi.total}`)

    // NAVIGATE TO Q7 (first unanswered based on review screen data)
    // Strategy: Open navigator, click Q7
    console.log('\n=== NAVIGATE TO Q7 ===')

    // Open navigator
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      const navBtn = btns.find(b => {
        const t = b.textContent.trim()
        return t === '▲' || (t.includes('Question') && t.includes('▲'))
      })
      if (navBtn) navBtn.click()
    })
    await sleep(800)
    await ss(page, '03_navigator_open')

    // Click Q7 in navigator
    const q7Click = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      const q7btn = btns.find(b => b.textContent.trim() === '7')
      if (q7btn) {
        q7btn.click()
        return { clicked: true }
      }
      const numBtns = btns.filter(b => /^\d+$/.test(b.textContent.trim())).map(b => b.textContent.trim())
      return { clicked: false, numBtns }
    })
    console.log('Q7 click:', q7Click)
    await sleep(1000)
    await ss(page, '04_after_q7_jump')

    qi = await getCurrentQ(page)
    console.log(`Now at Q${qi.q}`)

    // If not at Q7, keep navigating
    if (qi.q === null || qi.q > 7) {
      // Try clicking Back multiple times
      for (let i = 0; i < 10 && qi.q !== 7; i++) {
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'))
          const backBtn = btns.find(b => b.textContent.trim().includes('Back') || b.textContent.trim() === '← Back')
          if (backBtn) backBtn.click()
        })
        await sleep(400)
        qi = await getCurrentQ(page)
        if (qi.q === 7) break
      }
    }

    qi = await getCurrentQ(page)
    console.log(`Final position: Q${qi.q}`)

    // CLEAR IDB FOR CLEAN TRACKING
    const cleared = await clearIDB(page)
    console.log(`IDB cleared: ${cleared}`)

    // ANSWER Q7-Q11 ONLINE
    console.log('\n=== ANSWER Q7-Q11 ONLINE ===')
    const answeredOnline = {}

    for (let attempt = 0; attempt < 5; attempt++) {
      await sleep(500)
      qi = await getCurrentQ(page)
      if (!qi.q) break
      console.log(`Answering Q${qi.q}`)

      // Try choice A
      let picked = await clickChoice(page, 'A')
      if (!picked.ok) picked = await clickChoice(page, 'B')
      if (!picked.ok) picked = await clickChoice(page, 'C')
      if (!picked.ok) picked = await clickChoice(page, 'D')

      if (picked.ok) {
        answeredOnline[qi.q] = picked.letter
        console.log(`  Q${qi.q} = ${picked.letter}`)
      } else {
        console.log(`  Could not answer Q${qi.q}`)
      }

      await sleep(300)
      const nextResult = await clickNext(page)
      if (nextResult === 'review') {
        console.log('Reached review — stopping online answering')
        break
      }
      await sleep(400)
    }

    console.log('Online answers:', answeredOnline)
    const onlineCount = Object.keys(answeredOnline).length

    // Wait for online flush
    await sleep(3000)
    const idbAfterOnline = await getAllIDB(page)
    console.log(`IDB pending after online+3s: ${idbAfterOnline.filter(i => i.status === 'PENDING').length}`)

    await ss(page, '05_after_online')

    // ===== GO OFFLINE =====
    console.log('\n=== GO OFFLINE ===')
    await ctx.setOffline(true)
    await sleep(600)

    const isOffline = !(await page.evaluate(() => navigator.onLine))
    console.log(`Offline confirmed: ${isOffline}`)

    const answeredOffline = {}
    for (let attempt = 0; attempt < 3; attempt++) {
      await sleep(700)
      qi = await getCurrentQ(page)
      if (!qi.q) {
        console.log('No question number while offline')
        break
      }
      console.log(`Answering Q${qi.q} offline`)

      let picked = await clickChoice(page, 'C')
      if (!picked.ok) picked = await clickChoice(page, 'D')
      if (!picked.ok) picked = await clickChoice(page, 'B')

      if (picked.ok) {
        answeredOffline[qi.q] = picked.letter
        console.log(`  Q${qi.q} = ${picked.letter} (offline)`)
      } else {
        console.log(`  Could not answer Q${qi.q} offline`)
      }

      await sleep(300)
      const r = await clickNext(page)
      if (r === 'review') break
      await sleep(400)
    }

    console.log('Offline answers:', answeredOffline)
    const offlineCount = Object.keys(answeredOffline).length

    // Check IDB during offline
    const idbOffline = await getAllIDB(page)
    const pendingOffline = idbOffline.filter(i => i.status === 'PENDING')
    console.log(`IDB pending during offline: ${pendingOffline.length}`)
    console.log('Items:', pendingOffline.map(i => `${i.action}:${i.payload?.questionId}`))

    findings.fix1.pendingOffline = pendingOffline.length

    await ss(page, '06_during_offline')

    // ===== RESTORE NETWORK - FIX-1 TEST =====
    console.log('\n=== RESTORE NETWORK (FIX-1) ===')
    await ctx.setOffline(false)
    const restoreAt = Date.now()

    let flushAt = null
    for (let sec = 1; sec <= 10; sec++) {
      await sleep(1000)
      const idb = await getAllIDB(page)
      const pending = idb.filter(i => i.status === 'PENDING')
      console.log(`  ${sec}s: ${pending.length} pending (was ${pendingOffline.length})`)

      if (pending.length === 0 && pendingOffline.length > 0) {
        flushAt = sec
        console.log(`  FLUSHED at ${sec}s`)
        break
      }
    }

    const idbFinal = await getAllIDB(page)
    findings.fix1.pendingAfterFlush = idbFinal.filter(i => i.status === 'PENDING').length
    findings.fix1.flushTimeSeconds = flushAt

    if (pendingOffline.length === 0 && offlineCount === 0) {
      findings.fix1.result = 'INCONCLUSIVE'
      findings.fix1.notes.push('No offline answers captured into IDB — navigation/UI detection issue')
    } else if (pendingOffline.length === 0 && offlineCount > 0) {
      findings.fix1.result = 'INCONCLUSIVE'
      findings.fix1.notes.push(`${offlineCount} offline answers clicked but none appeared in IDB — possibly already flushed or IDB tracking issue`)
    } else if (flushAt !== null) {
      findings.fix1.result = 'PASS'
      findings.fix1.notes.push(`PASS: ${pendingOffline.length} offline items flushed in ${flushAt}s of network restore`)
    } else {
      findings.fix1.result = 'FAIL'
      findings.fix1.notes.push(`FAIL: ${findings.fix1.pendingAfterFlush}/${pendingOffline.length} still pending after 10s`)
    }

    findings.fix1.notes.push(findings.tdzError ? 'TDZ errors detected!' : 'No TDZ errors')
    await ss(page, '07_after_restore')

    // ===== FIX-2 TEST: RELOAD =====
    console.log('\n=== RELOAD (FIX-2) ===')
    findings.fix2.answeredOnline = answeredOnline
    findings.fix2.answeredOffline = answeredOffline
    const totalExpected = onlineCount + offlineCount

    await ss(page, '08_before_reload')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await sleep(2500)

    // Resume
    const hasResume = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      return btns.some(b => b.textContent.trim().includes('Resume'))
    })
    if (hasResume) {
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().includes('Resume'))
        if (btn) btn.click()
      })
      await sleep(2500)
    }
    await ss(page, '09_after_resume')

    // Wait for sync
    await sleep(2000)

    // Open navigator and read answered state
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b =>
        b.textContent.trim() === '▲' || (b.textContent.trim().includes('▲') && b.textContent.length < 30)
      )
      if (btn) btn.click()
    })
    await sleep(1000)
    await ss(page, '10_navigator')

    const navState = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      const qBtns = btns.filter(b => /^\d+$/.test(b.textContent.trim()) && parseInt(b.textContent.trim()) <= 20)
      return qBtns.map(b => ({
        q: parseInt(b.textContent.trim()),
        answered: b.className.includes('bg-brand-primary'),
      }))
    })

    const answeredQNums = navState.filter(q => q.answered).map(q => q.q)
    console.log('Answered questions:', answeredQNums)

    // Navigate to review
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      const reviewBtn = btns.find(b => b.textContent.trim() === 'Go to Review Screen' || b.textContent.trim().includes('Go to Review'))
      if (reviewBtn) reviewBtn.click()
    })
    await sleep(1500)
    await ss(page, '11_review')

    const reviewText = await page.evaluate(() => {
      const body = document.body.textContent
      const m = body.match(/Answered:\s*(\d+)\/(\d+)/)
      return {
        answered: m ? parseInt(m[1]) : null,
        total: m ? parseInt(m[2]) : null,
        body: body.substring(0, 500)
      }
    })
    console.log('Review:', reviewText)

    findings.fix2.preservedAfterResume = {
      navigatorAnsweredQs: answeredQNums,
      reviewAnswered: reviewText.answered,
      reviewTotal: reviewText.total,
    }
    findings.fix2.reviewData = reviewText.body.substring(0, 200)

    // Evaluate FIX-2
    // The online answers we added were Q7-Q11 (if successfully clicked)
    // The offline answers were Q12-Q14 (if successfully clicked)
    // After resume, we need to see those questions answered in navigator

    const onlineQNums = Object.keys(answeredOnline).map(Number)
    const offlineQNums = Object.keys(answeredOffline).map(Number)
    const onlinePreserved = onlineQNums.filter(q => answeredQNums.includes(q))
    const offlinePreserved = offlineQNums.filter(q => answeredQNums.includes(q))

    findings.fix2.notes.push(`Online answers: Q${JSON.stringify(onlineQNums)} (${onlineQNums.length})`)
    findings.fix2.notes.push(`Offline answers: Q${JSON.stringify(offlineQNums)} (${offlineQNums.length})`)
    findings.fix2.notes.push(`Online preserved: Q${JSON.stringify(onlinePreserved)} (${onlinePreserved.length}/${onlineQNums.length})`)
    findings.fix2.notes.push(`Offline preserved: Q${JSON.stringify(offlinePreserved)} (${offlinePreserved.length}/${offlineQNums.length})`)
    findings.fix2.notes.push(`All answered in navigator: ${JSON.stringify(answeredQNums)}`)
    findings.fix2.notes.push(`Review screen: ${reviewText.answered}/${reviewText.total}`)

    if (totalExpected === 0) {
      findings.fix2.result = 'INCONCLUSIVE'
      findings.fix2.notes.push('No answers recorded — navigation blocked the test')
    } else if (offlineQNums.length === 0) {
      // Only online answers to verify
      if (onlinePreserved.length === onlineQNums.length) {
        findings.fix2.result = 'PARTIAL'
        findings.fix2.notes.push(`PARTIAL: Online answers preserved (${onlinePreserved.length}/${onlineQNums.length}) but could not test offline answer preservation`)
      } else {
        findings.fix2.result = 'FAIL'
        findings.fix2.notes.push(`FAIL: Only ${onlinePreserved.length}/${onlineQNums.length} online answers preserved`)
      }
    } else if (offlinePreserved.length === offlineQNums.length && onlinePreserved.length === onlineQNums.length) {
      findings.fix2.result = 'PASS'
      findings.fix2.notes.push(`PASS: All ${totalExpected} answers preserved (${onlineQNums.length} online + ${offlineQNums.length} offline)`)
    } else if (offlinePreserved.length < offlineQNums.length) {
      findings.fix2.result = 'FAIL'
      findings.fix2.notes.push(`FAIL: Offline answers lost! ${offlinePreserved.length}/${offlineQNums.length} preserved`)
    } else {
      findings.fix2.result = 'PARTIAL'
    }

    await ss(page, '12_final')

  } catch(err) {
    console.error('ERROR:', err.message)
    findings.consoleErrors.push({ text: 'SCRIPT: ' + err.message })
  }

  await ctx.close()
  await browser.close()

  const outFile = join(__dirname, 'b14g_fix1_v3_results.json')
  writeFileSync(outFile, JSON.stringify(findings, null, 2))
  console.log(`\nResults: ${outFile}`)

  console.log('\n=== RESULTS ===')
  console.log(`Login: ${findings.login}`)
  console.log(`FIX-1: ${findings.fix1.result}`)
  findings.fix1.notes.forEach(n => console.log(`  ${n}`))
  console.log(`FIX-2: ${findings.fix2.result}`)
  findings.fix2.notes.forEach(n => console.log(`  ${n}`))
  console.log(`code.startsWith: ${findings.codeStartsWith}`)
  console.log(`TDZ errors: ${findings.tdzError}`)
  console.log(`Console errors: ${findings.consoleErrors.length}`)

  return findings
}

run().catch(err => { console.error('FATAL:', err); process.exit(1) })
