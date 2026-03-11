/**
 * B14G FIX-2 Debug Test
 * Adds console log capture to understand reconcileQueue behavior
 */

import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCREENSHOTS_DIR = join(__dirname, 'screenshots_B14G_debug')
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

async function getSelectedAnswer(page) {
  return page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[type="button"]'))
    for (const btn of btns) {
      if (btn.className.includes('bg-brand-primary')) {
        const spans = Array.from(btn.querySelectorAll('span'))
        for (const span of spans) {
          const cls = span.className || ''
          if ((cls.includes('rounded-full') || cls.includes('w-6')) && span.textContent.trim().length === 1) {
            return span.textContent.trim()
          }
        }
        return 'selected-noletter'
      }
    }
    return null
  })
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })

  const allConsoleLogs = []
  const reconcileLogs = []
  const findings = {
    reconciledRan: false,
    reconciledApplied: false,
    staleClassification: null,
    fix2Result: 'UNTESTED',
    notes: [],
  }

  function attachConsole(page) {
    page.on('console', m => {
      const txt = m.text()
      allConsoleLogs.push({ type: m.type(), text: txt.substring(0, 400) })

      // Track reconcileQueue messages
      if (txt.includes('reconcileQueue')) {
        reconcileLogs.push({ type: m.type(), text: txt })
        console.log(`[RECONCILE] ${txt}`)
      }

      // Track all APBoost debug logs
      if (txt.includes('[APBoost:')) {
        console.log(`[APP] ${txt}`)
      }
    })
    page.on('pageerror', e => {
      console.log(`[PAGE ERROR] ${e.message}`)
      allConsoleLogs.push({ type: 'pageerror', text: e.message })
    })
  }

  try {
    // === PAGE 1: LOGIN ===
    const page1 = await context.newPage()
    attachConsole(page1)

    await page1.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })
    await page1.waitForSelector('input[type="email"]', { timeout: 10000 })
    await page1.fill('input[type="email"]', 'student10@apboost.test')
    await page1.fill('input[type="password"]', 'Student123!')
    await page1.click('button[type="submit"]')
    await page1.waitForNavigation({ timeout: 15000 })
    await sleep(2000)
    console.log(`Login → ${page1.url()}`)

    // Navigate to test
    await page1.goto(`${BASE_URL}/ap/test/test_micro_full_1`, { waitUntil: 'domcontentloaded' })
    await sleep(2000)

    // Handle DuplicateTabModal and Instruction Screen
    const state1 = await page1.evaluate(() => {
      const body = document.body.textContent
      const btns = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())
      return {
        hasDupe: body.includes('Session Active Elsewhere') || body.includes('already open'),
        hasBegin: btns.some(b => b.includes('Begin') || b.includes('Resume')),
        btns,
      }
    })

    if (state1.hasDupe) {
      await page1.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().includes('Use This Tab'))
        if (btn) btn.click()
      })
      await sleep(1500)
    }

    if (state1.hasBegin) {
      await page1.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'))
        const btn = btns.find(b => b.textContent.trim().includes('Begin') || b.textContent.trim().includes('Resume'))
        if (btn) btn.click()
      })
      await sleep(2500)
      // Handle dupe again
      const s2 = await page1.evaluate(() => document.body.textContent.includes('Session Active'))
      if (s2) {
        await page1.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().includes('Use This Tab'))
          if (btn) btn.click()
        })
        await sleep(1500)
      }
    }

    await ss(page1, '01_page1_test')

    // Clear IDB
    await clearIDB(page1)

    // Answer Q15=A online
    const rA = await clickAnswerChoice(page1, 'A')
    console.log(`Page1: Q15=A: ${rA.ok}`)
    await sleep(4000) // Wait for flush

    const idbAfterA = await getAllIDB(page1)
    console.log(`IDB after A+4s: ${idbAfterA.filter(i=>i.status==='PENDING').length} pending`)

    // Verify state in Firestore by reading the session answers
    const sessionInfo = await page1.evaluate(async () => {
      // Can't directly read Firestore here — but we can check what answers the app has
      const body = document.body.textContent
      return {
        qNum: body.match(/Question (\d+)/)?.[1],
        selectedAnswer: (() => {
          const btns = Array.from(document.querySelectorAll('button[type="button"]'))
          for (const btn of btns) {
            if (btn.className.includes('bg-brand-primary')) {
              const spans = Array.from(btn.querySelectorAll('span'))
              for (const span of spans) {
                const cls = span.className || ''
                if ((cls.includes('rounded-full') || cls.includes('w-6')) && span.textContent.trim().length === 1) {
                  return span.textContent.trim()
                }
              }
            }
          }
          return null
        })()
      }
    })
    console.log('Page1 session info:', sessionInfo)

    // Get session ID
    const allIdbItems = await getAllIDB(page1)
    console.log('All IDB items:', allIdbItems.map(i => ({ a: i.action, s: i.status, sid: i.sessionId?.substring(0, 20) })))

    // === GO OFFLINE AND ANSWER Q15=B ===
    await context.setOffline(true)
    await sleep(200)

    const rB = await clickAnswerChoice(page1, 'B')
    console.log(`Page1: Q15=B offline: ${rB.ok}`)
    await sleep(300)

    const idbOffline = await getAllIDB(page1)
    const pendingOffline = idbOffline.filter(i => i.status === 'PENDING')
    console.log(`IDB offline: ${pendingOffline.length} pending`)
    pendingOffline.forEach(i => console.log(`  ${i.action}: q=${i.payload?.questionId} val=${i.payload?.value} ts=${i.localTimestamp}`))

    await ss(page1, '02_page1_offline_B')

    if (pendingOffline.length === 0) {
      findings.fix2Result = 'INCONCLUSIVE'
      findings.notes.push('No IDB items after offline answer — cannot test')
    } else {
      const sessionId = pendingOffline[0].sessionId
      const pendingTs = pendingOffline[0].localTimestamp
      console.log(`Session ID: ${sessionId}`)
      console.log(`Pending item ts: ${pendingTs}`)

      // CLOSE PAGE 1 (keep offline)
      await page1.close()
      console.log('Page1 closed')

      // Brief online to allow page2 to load, then check reconcileQueue behavior
      await context.setOffline(false)
      await sleep(300)

      // Open page2
      const page2 = await context.newPage()
      attachConsole(page2)

      // Go to test — IDB still has Q15=B pending from page1 (same context = shared IDB)
      await page2.goto(`${BASE_URL}/ap/test/test_micro_full_1`, { waitUntil: 'domcontentloaded' })
      await sleep(2500)

      // Check IDB before Resume
      const idbBeforeResume = await getAllIDB(page2)
      const pendingBeforeResume = idbBeforeResume.filter(i => i.status === 'PENDING')
      console.log(`IDB before Resume: ${pendingBeforeResume.length} pending`)
      pendingBeforeResume.forEach(i => console.log(`  ${i.action}: val=${i.payload?.value} ts=${i.localTimestamp}`))

      // Handle page load
      const pg2State = await page2.evaluate(() => {
        const body = document.body.textContent
        const btns = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())
        return { hasDupe: body.includes('Session Active'), hasBegin: btns.some(b => b.includes('Resume') || b.includes('Begin')), btns }
      })

      if (pg2State.hasDupe) {
        await page2.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().includes('Use This Tab'))
          if (btn) btn.click()
        })
        await sleep(1500)
      }

      await ss(page2, '03_page2_instruction')

      // Click Resume
      if (pg2State.hasBegin || pg2State.hasDupe) {
        const btns2 = await page2.evaluate(() =>
          Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())
        )
        const resumeBtn = btns2.find(b => b.includes('Resume') || b.includes('Begin'))
        if (resumeBtn) {
          await page2.evaluate(txt => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().includes(txt))
            if (btn) btn.click()
          }, resumeBtn.includes('Resume') ? 'Resume' : 'Begin')
          await sleep(3000) // Give time for session to load AND reconcileQueue to run
        }
      }

      // Check for dupe modal again
      const dupe2 = await page2.evaluate(() => document.body.textContent.includes('Session Active'))
      if (dupe2) {
        await page2.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().includes('Use This Tab'))
          if (btn) btn.click()
        })
        await sleep(2000)
      }

      await ss(page2, '04_page2_loaded')

      // Wait for reconcileQueue to run
      await sleep(2000)

      // Check selected answer
      const selectedOnPage2 = await getSelectedAnswer(page2)
      console.log(`\n=== PAGE 2 ANSWER: ${selectedOnPage2} ===`)
      findings.notes.push(`Answer in page2 after reconcile: ${selectedOnPage2}`)

      // Check IDB after reconcile
      const idbAfterReconcile = await getAllIDB(page2)
      const pendingAfterReconcile = idbAfterReconcile.filter(i => i.status === 'PENDING')
      console.log(`IDB after reconcile: ${pendingAfterReconcile.length} pending`)
      findings.notes.push(`IDB after reconcile: ${pendingAfterReconcile.length} pending`)

      // Check reconcile logs
      console.log(`\nReconcile logs (${reconcileLogs.length}):`)
      reconcileLogs.forEach(l => console.log(`  ${l.text}`))
      findings.reconciledRan = reconcileLogs.some(l => l.text.includes('reconcileQueue'))
      findings.reconciledApplied = reconcileLogs.some(l => l.text.includes('Applying'))
      findings.staleClassification = reconcileLogs.find(l => l.text.includes('stale') || l.text.includes('Discarding'))?.text || null

      findings.notes.push(`ReconcileQueue logs: ${JSON.stringify(reconcileLogs.map(l => l.text))}`)

      await ss(page2, '05_final_state')

      // Determine FIX-2 result
      if (pendingBeforeResume.length === 0) {
        findings.fix2Result = 'INCONCLUSIVE'
        findings.notes.push('INCONCLUSIVE: IDB was empty before Resume — items flushed on going online')
      } else if (selectedOnPage2 === 'B') {
        findings.fix2Result = 'PASS'
        findings.notes.push('PASS: Q15=B preserved in new page (reconcileQueue applied IDB item)')
      } else if (selectedOnPage2 === 'A') {
        findings.fix2Result = 'FAIL'
        findings.notes.push('FAIL: Q15=A shown — offline answer B was not applied by reconcileQueue')
        // Determine why
        if (reconcileLogs.some(l => l.text.includes('stale') || l.text.includes('Discarding'))) {
          findings.notes.push('Reason: reconcileQueue classified Q15=B as stale (Firestore already has B?)')
        } else if (!findings.reconciledRan) {
          findings.notes.push('Reason: reconcileQueue did not run (possibly reconciledRef already true)')
        } else if (!findings.reconciledApplied) {
          findings.notes.push('Reason: reconcileQueue ran but did not apply any items')
        }
      } else {
        findings.fix2Result = 'PARTIAL'
        findings.notes.push(`PARTIAL: Answer was ${selectedOnPage2} — could not determine B vs A`)
      }

      await page2.close()
    }

  } catch(err) {
    console.error('ERROR:', err.message)
    findings.notes.push(`ERROR: ${err.message}`)
  }

  await context.close()
  await browser.close()

  const outFile = join(__dirname, 'b14g_fix2_debug_results.json')
  writeFileSync(outFile, JSON.stringify({ findings, allConsoleLogs: allConsoleLogs.slice(0, 100), reconcileLogs }, null, 2))
  console.log(`\nResults: ${outFile}`)
  console.log('\nFIX-2:', findings.fix2Result)
  findings.notes.forEach(n => console.log(`  ${n}`))
  return findings
}

run().catch(err => { console.error('FATAL:', err); process.exit(1) })
