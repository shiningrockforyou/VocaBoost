/**
 * B14G FIX-2 Test — Reload WHILE OFFLINE to test reconcileQueue
 * Key: items must still be in IDB when page reloads (stay offline through reload)
 */

import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCREENSHOTS_DIR = join(__dirname, 'screenshots_B14G_fix2')
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
    const btns = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t && t.length < 80)
    const qMatch = body.match(/Question (\d+) of (\d+)/)
    return {
      buttons: btns,
      q: qMatch ? parseInt(qMatch[1]) : null,
      total: qMatch ? parseInt(qMatch[2]) : null,
      hasDupe: body.includes('Session Active Elsewhere') || body.includes('already open in another'),
      hasReview: body.includes('Review Your Answers'),
      hasInstruction: btns.some(b => b.includes('Begin') || b.includes('Resume')),
      body: body.substring(0, 200)
    }
  })
}

async function clickAnswerChoice(page, letter) {
  return page.evaluate(ltr => {
    const allBtns = Array.from(document.querySelectorAll('button[type="button"]'))
    for (const btn of allBtns) {
      if (btn.disabled) continue
      const cls = btn.className || ''
      if (!cls.includes('flex-1') && !cls.includes('items-start')) continue
      const spans = Array.from(btn.querySelectorAll('span'))
      for (const span of spans) {
        const spanCls = span.className || ''
        if (span.textContent.trim() === ltr && (spanCls.includes('rounded-full') || spanCls.includes('w-6') || spanCls.includes('h-6'))) {
          btn.click()
          return { ok: true, letter: ltr }
        }
      }
    }
    return { ok: false, letter: ltr }
  }, letter)
}

async function clickButton(page, textContains) {
  return page.evaluate(txt => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().includes(txt))
    if (btn) { btn.click(); return true }
    return false
  }, textContains)
}

async function clickNext(page) {
  return page.evaluate(() => {
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
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  const findings = {
    fix2: {
      result: 'UNTESTED',
      scenario: 'Reload WHILE OFFLINE to test reconcileQueue content-based comparison',
      notes: []
    },
    consoleErrors: []
  }

  const consoleLog = []
  page.on('console', m => {
    consoleLog.push({ type: m.type(), text: m.text().substring(0, 200) })
    if (m.type() === 'error') {
      findings.consoleErrors.push({ text: m.text().substring(0, 200) })
    }
  })
  page.on('pageerror', e => {
    findings.consoleErrors.push({ text: 'page: ' + e.message.substring(0, 200) })
  })

  try {
    // === LOGIN ===
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('input[type="email"]', { timeout: 10000 })
    await page.fill('input[type="email"]', 'student10@apboost.test')
    await page.fill('input[type="password"]', 'Student123!')
    await page.click('button[type="submit"]')
    await page.waitForNavigation({ timeout: 15000 })
    await sleep(2000)
    console.log(`Login → ${page.url()}`)
    await ss(page, '01_login')

    // === NAVIGATE TO TEST ===
    await page.goto(`${BASE_URL}/ap/test/test_micro_full_1`, { waitUntil: 'domcontentloaded' })
    await sleep(2000)

    let state = await getPageState(page)
    if (state.hasDupe) {
      await clickButton(page, 'Use This Tab')
      await sleep(1500)
      state = await getPageState(page)
    }

    if (state.hasInstruction) {
      const btnTxt = state.buttons.find(b => b.includes('Resume') || b.includes('Begin'))
      if (btnTxt) {
        await clickButton(page, btnTxt.includes('Resume') ? 'Resume' : 'Begin')
        await sleep(2500)
      }
    }

    state = await getPageState(page)
    if (state.hasDupe) {
      await clickButton(page, 'Use This Tab')
      await sleep(1500)
      state = await getPageState(page)
    }

    await ss(page, '02_test_state')
    console.log(`Test state: Q${state.q}/${state.total}`)

    // === CLEAR IDB ===
    await clearIDB(page)
    console.log('IDB cleared')

    // === ANSWER Q15 ONLINE (get a clean answer) ===
    // First, go back to Q15 if on review
    if (state.hasReview) {
      await clickButton(page, 'Return to Questions')
      await sleep(1000)
      state = await getPageState(page)
    }

    // Answer Q15 = A (this will flush immediately since we're online)
    console.log('\n=== ANSWER Q15=A ONLINE ===')
    let r = await clickAnswerChoice(page, 'A')
    console.log(`Q15=A clicked: ${r.ok}`)
    await sleep(2000) // Let it flush

    const idbAfterOnline = await getAllIDB(page)
    console.log(`IDB after online answer+2s: ${idbAfterOnline.length} total, ${idbAfterOnline.filter(i=>i.status==='PENDING').length} pending`)

    // Wait for flush to complete
    await sleep(2000)
    const idbFlushed = await getAllIDB(page)
    console.log(`IDB after 4s: ${idbFlushed.filter(i=>i.status==='PENDING').length} pending`)

    // === NOW GO OFFLINE AND CHANGE THE ANSWER ===
    console.log('\n=== GO OFFLINE AND CHANGE ANSWER TO B ===')
    await context.setOffline(true)
    await sleep(300)

    const r2 = await clickAnswerChoice(page, 'B')
    console.log(`Q15=B offline clicked: ${r2.ok}`)
    await sleep(500)

    // Check IDB immediately after offline click
    const idbOffline = await getAllIDB(page)
    const pendingOffline = idbOffline.filter(i => i.status === 'PENDING')
    console.log(`IDB after offline answer: ${pendingOffline.length} pending`)
    console.log('Items:', pendingOffline.map(i => ({ action: i.action, q: i.payload?.questionId, val: i.payload?.value })))

    findings.fix2.notes.push(`Q15=A answered online, flushed. Then Q15=B answered offline.`)
    findings.fix2.notes.push(`IDB pending after offline answer: ${pendingOffline.length}`)

    if (pendingOffline.length === 0) {
      findings.fix2.notes.push('WARNING: No pending items after offline answer — IDB write may not be working')
    }

    await ss(page, '03_offline_answered')

    // === RELOAD WHILE STILL OFFLINE ===
    console.log('\n=== RELOAD WHILE OFFLINE (FIX-2 KEY TEST) ===')
    // This is the critical test: IDB has Q15=B pending
    // Firestore has Q15=A (last flushed)
    // reconcileQueue should:
    //   OLD behavior (bug): discard Q15=B because localTimestamp < lastAction (WRONG — data loss!)
    //   NEW behavior (FIX-2): keep Q15=B because Firestore value (A) != IDB value (B) (CORRECT)

    // Reload the page WHILE OFFLINE
    await page.reload({ waitUntil: 'domcontentloaded' })
    await sleep(2500)

    state = await getPageState(page)
    console.log('Post-reload (offline) state:', state.buttons.join('|').substring(0, 200))

    // Handle DuplicateTabModal if shown
    if (state.hasDupe) {
      await clickButton(page, 'Use This Tab')
      await sleep(1500)
      state = await getPageState(page)
    }

    // Resume
    if (state.hasInstruction) {
      const btn = state.buttons.find(b => b.includes('Resume') || b.includes('Begin'))
      if (btn) {
        await clickButton(page, btn.includes('Resume') ? 'Resume' : 'Begin')
        await sleep(2500)
      }
    }

    await ss(page, '04_after_reload_resume')
    state = await getPageState(page)

    // Check the current answer for Q15 WHILE OFFLINE
    const currentAnswer = await page.evaluate(() => {
      // Look for selected answer button
      const btns = Array.from(document.querySelectorAll('button[type="button"]'))
      for (const btn of btns) {
        if (btn.className.includes('bg-brand-primary')) {
          // This is selected — get the letter
          const spans = Array.from(btn.querySelectorAll('span'))
          for (const span of spans) {
            const cls = span.className || ''
            if ((cls.includes('rounded-full') || cls.includes('w-6')) && span.textContent.trim().length === 1) {
              return { selected: span.textContent.trim() }
            }
          }
          return { selected: 'found-but-no-letter' }
        }
      }
      return { selected: null }
    })
    console.log('Current answer after offline reload:', currentAnswer)

    // Also check IDB
    const idbAfterReload = await getAllIDB(page)
    const pendingAfterReload = idbAfterReload.filter(i => i.status === 'PENDING')
    console.log(`IDB after reload: ${pendingAfterReload.length} pending`)
    console.log('Items:', pendingAfterReload.map(i => ({ action: i.action, q: i.payload?.questionId, val: i.payload?.value })))

    findings.fix2.notes.push(`After offline reload: selected answer = ${currentAnswer.selected}`)
    findings.fix2.notes.push(`IDB pending after reload: ${pendingAfterReload.length}`)

    // The reconcileQueue runs after session loads
    // If FIX-2 is applied: Q15=B (from IDB) should be applied to UI since Firestore has A!=B
    // If FIX-2 is NOT applied: Q15=B discarded (timestamp < lastAction), UI shows A (from Firestore)

    await ss(page, '05_current_state')

    // Wait for reconcileQueue to complete
    await sleep(2000)
    const answerAfterReconcile = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button[type="button"]'))
      for (const btn of btns) {
        if (btn.className.includes('bg-brand-primary')) {
          const spans = Array.from(btn.querySelectorAll('span'))
          for (const span of spans) {
            const cls = span.className || ''
            if ((cls.includes('rounded-full') || cls.includes('w-6')) && span.textContent.trim().length === 1) {
              return { selected: span.textContent.trim() }
            }
          }
        }
      }
      return { selected: null }
    })
    console.log('Answer after reconcile:', answerAfterReconcile)
    findings.fix2.notes.push(`After reconcileQueue: selected = ${answerAfterReconcile.selected}`)

    // === GO ONLINE AND CHECK FINAL STATE ===
    console.log('\n=== GO ONLINE AND VERIFY ===')
    await context.setOffline(false)
    await sleep(3000) // Let flush happen

    const answerAfterOnline = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button[type="button"]'))
      for (const btn of btns) {
        if (btn.className.includes('bg-brand-primary')) {
          const spans = Array.from(btn.querySelectorAll('span'))
          for (const span of spans) {
            const cls = span.className || ''
            if ((cls.includes('rounded-full') || cls.includes('w-6')) && span.textContent.trim().length === 1) {
              return { selected: span.textContent.trim() }
            }
          }
        }
      }
      return { selected: null }
    })
    console.log('Answer after online:', answerAfterOnline)

    const idbAfterOnline2 = await getAllIDB(page)
    console.log(`IDB after online+3s: ${idbAfterOnline2.filter(i=>i.status==='PENDING').length} pending`)

    findings.fix2.notes.push(`After going online: selected = ${answerAfterOnline.selected}`)
    findings.fix2.notes.push(`IDB pending after online flush: ${idbAfterOnline2.filter(i=>i.status==='PENDING').length}`)

    await ss(page, '06_after_online')

    // Evaluate FIX-2
    // Expected with FIX-2: selected = 'B' (the offline answer was preserved through reload)
    // Expected without FIX-2: selected = 'A' (the online answer from Firestore overwrote)

    if (pendingOffline.length === 0) {
      findings.fix2.result = 'INCONCLUSIVE'
      findings.fix2.notes.push('INCONCLUSIVE: No items were in IDB offline — could not test reconcileQueue')
    } else {
      const selectedAfterReconcile = answerAfterReconcile.selected || currentAnswer.selected

      if (selectedAfterReconcile === 'B') {
        findings.fix2.result = 'PASS'
        findings.fix2.notes.push(`PASS: Offline answer 'B' preserved through reload (reconcileQueue kept IDB item)`)
        findings.fix2.notes.push('FIX-2 content-based comparison works: kept item because Firestore had A != IDB B')
      } else if (selectedAfterReconcile === 'A') {
        findings.fix2.result = 'FAIL'
        findings.fix2.notes.push(`FAIL: Offline answer 'B' was LOST — UI shows 'A' from Firestore after reload`)
        findings.fix2.notes.push('reconcileQueue discarded Q15=B as stale (timestamp-based — FIX-2 not applied)')
      } else if (!selectedAfterReconcile) {
        findings.fix2.result = 'PARTIAL'
        findings.fix2.notes.push(`PARTIAL: Could not detect selected answer (null) — check screenshots`)
      } else {
        findings.fix2.result = 'PARTIAL'
        findings.fix2.notes.push(`PARTIAL: Unexpected answer '${selectedAfterReconcile}' — expected A or B`)
      }
    }

    await ss(page, '07_final')

  } catch(err) {
    console.error('ERROR:', err.message)
    findings.consoleErrors.push({ text: err.message })
  }

  await context.close()
  await browser.close()

  const outFile = join(__dirname, 'b14g_fix2_results.json')
  writeFileSync(outFile, JSON.stringify({ findings, consoleLog: consoleLog.slice(0, 50) }, null, 2))
  console.log(`\nResults: ${outFile}`)
  console.log('\nFIX-2:', findings.fix2.result)
  findings.fix2.notes.forEach(n => console.log(`  ${n}`))
  return findings
}

run().catch(err => { console.error('FATAL:', err); process.exit(1) })
