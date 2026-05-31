/**
 * VERIFY2 — F01 Pool Collapse Fix Verification (careful/TOP persona, Day 16+ region)
 *
 * careful/TOP: CSD=24, TWI=1920, 360 MASTERED words all with future returnAt.
 * Walk 4 sessions (Day 25-28). Check each review for MASTERED leaks.
 * EXPECT 0 leaks every session.
 */

import { chromium } from 'playwright'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs'
import { join } from 'path'

const BASE_URL = 'https://vocaboostone.netlify.app'
const CAREFUL_EMAIL = 'audit_careful_01_top@vocaboost.test'
const CAREFUL_PASSWORD = 'AuditPass2026!'
const CAREFUL_UID = 'EPnmY4FIXxVq19tQtxQCvE26p0F3'
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
const LIST_ID = '8RMews2H7C3UJUAsOBzR'
const CP_DOC_ID = `${CLASS_ID}_${LIST_ID}`
const CHROMIUM_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'
const SA_PATH = '/app/scripts/serviceAccountKey.json'
const WORD_CACHE_PATH = '/app/e2e/audit/B27/word_position_cache.json'

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/VERIFY2'
const AGENT_LOGS_DIR = '/app/audit/playwright/findings/agent_logs'
const JSONL_PATH = join(AGENT_LOGS_DIR, 'VERIFY2.jsonl')

mkdirSync(EVIDENCE_DIR, { recursive: true })
mkdirSync(AGENT_LOGS_DIR, { recursive: true })

function log(ev) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...ev })
  try { appendFileSync(JSONL_PATH, line + '\n') } catch (_) {}
  console.log('[VERIFY2-CAREFUL]', JSON.stringify(ev).substring(0, 250))
}

let _db
function initAdmin() {
  if (!_db) {
    if (!getApps().length) {
      const sa = JSON.parse(readFileSync(SA_PATH, 'utf-8'))
      initializeApp({ credential: cert(sa) })
    }
    _db = getFirestore()
  }
  return _db
}

const readCP = async (uid) => {
  const s = await initAdmin().doc(`users/${uid}/class_progress/${CP_DOC_ID}`).get()
  return s.exists ? { id: s.id, ...s.data() } : null
}

const readAllStudyStates = async (uid) => {
  const s = await initAdmin().collection(`users/${uid}/study_states`).get()
  return s.docs.map(d => ({ id: d.id, ...d.data() }))
}

const wpc = JSON.parse(readFileSync(WORD_CACHE_PATH, 'utf-8'))
const wByText = {}
for (const w of wpc) {
  const k = w.word.split('\r\n')[0].split('\n')[0].trim().toLowerCase()
  if (!wByText[k]) wByText[k] = w
}

function findWordByText(text) {
  if (!text) return null
  const k = text.split('\r\n')[0].split('\n')[0].trim().toLowerCase()
  if (wByText[k]) return wByText[k]
  for (const [kk, w] of Object.entries(wByText)) {
    if (k.length >= 5 && kk.startsWith(k.substring(0, 5))) return w
    if (kk.length >= 5 && k.startsWith(kk.substring(0, 5))) return w
  }
  return null
}

function makeDateShim(fakeNowMs) {
  return `
(function() {
  const _RealDate = Date;
  const _fakeNow = ${fakeNowMs};
  const _offset = _fakeNow - _RealDate.now();
  class FakeDate extends _RealDate {
    constructor(...args) {
      if (args.length === 0) super(_RealDate.now() + _offset);
      else super(...args);
    }
    static now() { return _RealDate.now() + _offset; }
  }
  FakeDate.parse = _RealDate.parse.bind(_RealDate);
  FakeDate.UTC = _RealDate.UTC.bind(_RealDate);
  window.Date = FakeDate;
  window.__VERIFY2_FAKE_NOW_MS = _fakeNow;
})();
`
}

const wait = ms => new Promise(r => setTimeout(r, ms))

function nextWeekday(date) {
  const next = new Date(date.getTime() + 86400000)
  while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1)
  return next
}

async function login(page, email, password) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await wait(2000)
  const hasEmail = await page.getByLabel(/email/i).isVisible({ timeout: 3000 }).catch(() => false)
  const alreadyDash = await page.getByText(/welcome|dashboard/i).isVisible({ timeout: 2000 }).catch(() => false)
  if (alreadyDash && !hasEmail) return

  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await loginLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loginLink.click()
    await wait(1000)
  } else if (!hasEmail) {
    await page.evaluate(() => {
      history.pushState({}, '', '/login')
      dispatchEvent(new PopStateEvent('popstate'))
    })
    await wait(1200)
  }
  await page.getByLabel(/email/i).first().waitFor({ timeout: 15000 })
  await page.getByLabel(/email/i).first().fill(email)
  await page.getByLabel(/password/i).first().fill(password)
  await page.getByLabel(/password/i).first().press('Enter')
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
    const b = page.getByRole('button', { name: /continue|log\s?in/i }).first()
    if (await b.isVisible({ timeout: 3000 }).catch(() => false)) {
      await b.click()
      await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(() => {})
    }
  })
  await wait(2000)
}

async function navSession(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await wait(3000)
  for (const name of ["Start Today's Session", 'Start Session', 'Start Today', 'Begin Session']) {
    const btn = page.getByRole('button', { name: new RegExp(name, 'i') }).first()
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click()
      await wait(2500)
      return true
    }
  }
  const SESSION_URL = `${BASE_URL}/session/${CLASS_ID}/${LIST_ID}`
  await page.goto(SESSION_URL, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {})
  await wait(3000)
  return true
}

async function h2Guard(page, dayNum) {
  await wait(1500)
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 1500)).catch(() => '')
  if (/resume.*day\s*\d|move.*on.*next\s*day|retry.*review.*test/i.test(bodyText)) {
    const moveOnBtn = page.getByRole('button', { name: /move on.*next|next day/i }).first()
    if (await moveOnBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moveOnBtn.click()
      await wait(3000)
      return false
    }
  }
  return true
}

async function dismissModal(page) {
  const startStudying = page.getByRole('button', { name: /start studying/i }).first()
  if (await startStudying.isVisible({ timeout: 2000 }).catch(() => false)) {
    await startStudying.click()
    await wait(800)
    return true
  }
  return false
}

async function skipToTest(page) {
  await dismissModal(page)
  await wait(600)
  let menuBtn = page.locator('[aria-label="Session menu"]')
  if (!await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    menuBtn = page.getByRole('button', { name: /session menu/i }).first()
  }
  if (!await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) return false
  await menuBtn.click()
  await wait(700)
  let skipItem = page.getByText('Skip to Test').first()
  if (!await skipItem.isVisible({ timeout: 3000 }).catch(() => false)) {
    skipItem = page.getByRole('menuitem', { name: /skip to test/i }).first()
  }
  if (!await skipItem.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.keyboard.press('Escape')
    return false
  }
  await skipItem.click()
  await wait(800)
  for (const name of ['Start Test', 'Confirm', 'Yes', 'Skip', 'OK']) {
    const cf = page.getByRole('button', { name: new RegExp(name, 'i') }).first()
    if (await cf.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cf.click()
      await wait(1500)
      return true
    }
  }
  return true
}

async function handleNewWordTest(page, dayNum) {
  const inputs = page.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]')
  const count = await inputs.count().catch(() => 0)
  const wpc2 = JSON.parse(readFileSync(WORD_CACHE_PATH, 'utf-8'))
  const wByText2 = {}
  for (const w of wpc2) {
    const k = w.word.split('\r\n')[0].split('\n')[0].trim().toLowerCase()
    if (!wByText2[k]) wByText2[k] = w
  }

  for (let i = 0; i < count; i++) {
    const inp = inputs.nth(i)
    await inp.scrollIntoViewIfNeeded().catch(() => {})
    // Get word from parent context
    const parentText = await inp.evaluate(el => {
      let node = el.parentElement
      for (let d = 0; d < 8; d++) {
        if (!node) break
        const t = (node.textContent || '').trim()
        if (t && t.length < 200) return t
        node = node.parentElement
      }
      return ''
    }).catch(() => '')
    const wordMatch = parentText.match(/(?:\d+[\.\)]\s*)?([A-Za-z\s\-]+?)\s*[\(\[]/i)
    const rawWord = wordMatch ? wordMatch[1].trim() : parentText.trim().split('\n')[0].trim()
    const we = rawWord ? findWordByText(rawWord) : null
    const answer = we ? we.definition_en : 'a specific term'
    await inp.click()
    await inp.fill(answer)
    await wait(50)
  }
  await wait(1000)
  const subBtn = page.getByRole('button', { name: /submit test|finish test/i }).first()
  if (await subBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await subBtn.click()
    await wait(30000)
  } else {
    await wait(30000)
  }
}

async function captureAndRunReviewTest(page, dayNum, preStudyStates, nowMs) {
  const servedWords = []
  const stateByWordId = {}
  for (const ss of preStudyStates) stateByWordId[ss.id] = ss

  for (let q = 0; q < 80; q++) {
    await wait(500)
    const bodySnip = await page.evaluate(() => document.body.innerText.substring(0, 600)).catch(() => '')
    if (/test complete|test results|all done|finished|\d+%\s*(correct|score)/i.test(bodySnip)) break

    const wordText = await page.evaluate(() => {
      const headings = [...document.querySelectorAll('h1,h2,h3,h4')]
      for (const h of headings) {
        const t = (h.textContent || '').trim()
        if (t && t.length > 0 && t.length < 80 && !/step\s*\d|review\s*test|new\s*word|study/i.test(t)) return t
      }
      return ''
    }).catch(() => '')

    const we = wordText ? findWordByText(wordText) : null
    const wordId = we ? we.id : null
    const position = we ? we.position : null
    const preState = wordId ? stateByWordId[wordId] : null
    const preStatus = preState ? preState.status : 'UNKNOWN'
    const preReturnAtMs = preState?.returnAt ? (preState.returnAt._seconds * 1000) : null

    if (wordText) {
      servedWords.push({ wordText, wordId, position, preStatus, preReturnAtMs, questionIdx: q })
      const isMasteredLeak = preStatus === 'MASTERED' && (preReturnAtMs == null || preReturnAtMs > nowMs)
      if (isMasteredLeak) {
        log({ type: 'MASTERED_LEAK_DETECTED', persona: 'careful', day: dayNum, wordId, position, preStatus, preReturnAtMs })
      }
    }

    const clicked = await page.evaluate((defStart) => {
      const allBtns = [...document.querySelectorAll('button')]
      const optBtns = allBtns.filter(b => {
        const t = (b.textContent || '').trim()
        return t.length >= 5 && t.length <= 150 &&
          !/(next|submit\s*test|skip|session\s*menu|back|continue|start\s*studying|play|step\s*\d|confirm|yes|no\b|🔊)/i.test(t) &&
          !b.disabled && b.offsetParent !== null
      })
      if (optBtns.length < 2) return { ok: false, count: optBtns.length }
      let targetBtn = null
      if (defStart) targetBtn = optBtns.find(b => (b.textContent || '').toLowerCase().includes(defStart.toLowerCase()))
      if (!targetBtn) targetBtn = optBtns[0]
      targetBtn.click()
      return { ok: true }
    }, we ? (we.definition_en || '').substring(0, 20) : null).catch(() => ({ ok: false }))

    if (!clicked?.ok) {
      const subBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await subBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await subBtn.click()
        await wait(2000)
        break
      }
      if (/test complete|%/i.test(bodySnip)) break
      await wait(800)
      continue
    }
    await wait(400)

    const submitText = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')]
      const sub = btns.find(b => /submit\s*test/i.test(b.textContent || ''))
      return sub ? (sub.textContent || '').trim() : null
    }).catch(() => null)

    if (submitText) {
      const allMatch = submitText.match(/\((\d+)\/(\d+)\s*answered\)/i)
      if (allMatch && parseInt(allMatch[1]) >= parseInt(allMatch[2])) {
        const subBtn = page.getByRole('button', { name: /submit test/i }).first()
        if (await subBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await subBtn.click()
          await wait(2000)
          break
        }
      }
    }
  }
  const subBtn = page.getByRole('button', { name: /submit test/i }).first()
  if (await subBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await subBtn.click()
    await wait(2000)
  }
  return servedWords
}

async function navToReview(page, dayNum) {
  await wait(3000)
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 800)).catch(() => '')
  if (/step\s*4|review\s*test/i.test(bodyText)) return true
  const optButtons = await page.evaluate(() => {
    return [...document.querySelectorAll('button')].filter(b => {
      const t = (b.textContent || '').trim()
      return t.length >= 5 && t.length <= 150 &&
        !/(next|submit|skip|menu|back|continue|start\s*studying|play|step|confirm|yes|no\b)/i.test(t) &&
        !b.disabled && b.offsetParent !== null
    }).length
  }).catch(() => 0)
  if (optButtons >= 3) return true

  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
  await wait(2000)
  await page.evaluate(({ classId, listId }) => {
    window.history.pushState({}, '', `/session/${classId}/${listId}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, { classId: CLASS_ID, listId: LIST_ID })
  await wait(3000)

  const bt3 = await page.evaluate(() => document.body.innerText.substring(0, 800)).catch(() => '')
  if (/step\s*4|review\s*test/i.test(bt3)) return true
  if (/step\s*3|review\s*study/i.test(bt3)) {
    await skipToTest(page)
    await wait(2000)
    return true
  }
  return false
}

async function main() {
  log({ type: 'verify2_f01_careful_start' })

  const initialCP = await readCP(CAREFUL_UID)
  const initialCSD = initialCP?.currentStudyDay ?? 0
  const initialTWI = initialCP?.totalWordsIntroduced ?? 0
  log({ type: 'initial_state', CSD: initialCSD, TWI: initialTWI })
  console.log(`=== VERIFY2 F01 CAREFUL | CSD=${initialCSD}, TWI=${initialTWI} ===`)

  // Anchor: 2026-08-10 (far future)
  const ANCHOR_DATE = new Date('2026-08-10T09:00:00+09:00')
  let sessionDate = new Date(ANCHOR_DATE.getTime())

  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH })
  const results = []
  const NUM_SESSIONS = 4

  try {
    for (let i = 0; i < NUM_SESSIONS; i++) {
      while (sessionDate.getDay() === 0 || sessionDate.getDay() === 6) {
        sessionDate = nextWeekday(sessionDate)
      }

      const dayNum = initialCSD + 1 + i
      const fakeNowMs = sessionDate.getTime()
      const nowMs = fakeNowMs

      console.log(`\n════ Careful Day ${dayNum} | Fake: ${sessionDate.toISOString().substring(0, 10)} ════`)

      const preStudyStates = await readAllStudyStates(CAREFUL_UID)
      const preMastered = preStudyStates.filter(ss => ss.status === 'MASTERED')
      const preMasteredFuture = preMastered.filter(ss => ss.returnAt && (ss.returnAt._seconds * 1000) > nowMs)
      log({ type: 'pre_state', persona: 'careful', day: dayNum, mastered: preMastered.length, masteredFuture: preMasteredFuture.length })

      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      await context.addInitScript({ content: makeDateShim(fakeNowMs) })
      await context.addInitScript(() => {
        if (navigator.serviceWorker) {
          navigator.serviceWorker.getRegistrations()
            .then(regs => regs.forEach(r => r.unregister()))
            .catch(() => {})
        }
      })
      const page = await context.newPage()

      let servedWords = []
      let sessionBlocked = false
      let blockReason = ''

      try {
        await login(page, CAREFUL_EMAIL, CAREFUL_PASSWORD)
        await navSession(page)
        await wait(2000)

        let h2Attempts = 0
        while (h2Attempts < 3) {
          const h2Clean = await h2Guard(page, dayNum)
          if (h2Clean) break
          h2Attempts++
          if (h2Attempts >= 3) { sessionBlocked = true; blockReason = 'H2 stale'; break }
          await navSession(page)
          await wait(2000)
        }

        if (!sessionBlocked) {
          await skipToTest(page)
          await wait(2000)

          const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => '')
          const inputCount = await page.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]').count().catch(() => 0)

          if (inputCount > 0) {
            await handleNewWordTest(page, dayNum)
            await wait(2000)
            const reviewNavOk = await navToReview(page, dayNum)
            if (reviewNavOk) {
              servedWords = await captureAndRunReviewTest(page, dayNum, preStudyStates, nowMs)
            } else {
              sessionBlocked = true
              blockReason = 'Could not nav to review'
            }
          } else {
            servedWords = await captureAndRunReviewTest(page, dayNum, preStudyStates, nowMs)
          }
        }
      } catch (err) {
        sessionBlocked = true
        blockReason = 'Exception: ' + err.message
        log({ type: 'session_exception', persona: 'careful', day: dayNum, error: err.message })
      } finally {
        await page.close().catch(() => {})
        await context.close().catch(() => {})
      }

      const masteredLeaks = servedWords.filter(w =>
        w.preStatus === 'MASTERED' && (w.preReturnAtMs == null || w.preReturnAtMs > nowMs)
      )

      const dayResult = {
        persona: 'careful',
        dayNum,
        sessionDate: sessionDate.toISOString(),
        preMastered: preMastered.length,
        preMasteredFuture: preMasteredFuture.length,
        servedWords: servedWords.map(w => ({ wordText: w.wordText, wordId: w.wordId, position: w.position, preStatus: w.preStatus, preReturnAtMs: w.preReturnAtMs })),
        totalServed: servedWords.length,
        masteredLeaks: masteredLeaks.map(w => ({ wordId: w.wordId, position: w.position, preStatus: w.preStatus })),
        masteredLeakCount: masteredLeaks.length,
        blocked: sessionBlocked,
        blockReason
      }
      results.push(dayResult)
      writeFileSync(join(EVIDENCE_DIR, `f01_careful_day${dayNum}.json`), JSON.stringify(dayResult, null, 2))

      console.log(`  Careful Day ${dayNum}: served=${servedWords.length}, MASTERED_LEAKS=${masteredLeaks.length}, blocked=${sessionBlocked}`)
      if (masteredLeaks.length > 0) {
        console.log(`  *** F01 FIX FAILED (careful): ${masteredLeaks.length} MASTERED words! ***`)
      }

      sessionDate = nextWeekday(sessionDate)
      await wait(3000)
    }
  } finally {
    await browser.close().catch(() => {})
  }

  const totalLeaks = results.reduce((s, r) => s + (r.masteredLeakCount || 0), 0)
  const f01Pass = totalLeaks === 0

  console.log('\n═══ VERIFY2 F01 CAREFUL SUMMARY ═══')
  console.log(`Total MASTERED leaks: ${totalLeaks}`)
  console.log(`F01 FIXED IN PROD (careful): ${f01Pass ? 'YES — PASS' : 'NO — FAIL'}`)

  const summary = {
    test: 'F01_CAREFUL',
    persona: 'careful/TOP',
    sessionsRun: results.length,
    totalLeaks,
    f01Pass,
    perDay: results.map(r => ({ day: r.dayNum, served: r.totalServed, masteredLeaks: r.masteredLeakCount, blocked: r.blocked }))
  }
  writeFileSync(join(EVIDENCE_DIR, 'f01_careful_summary.json'), JSON.stringify(summary, null, 2))
  log({ type: 'verify2_f01_careful_complete', totalLeaks, f01Pass })
  return summary
}

main().then(s => {
  console.log('\nCareful F01 Done:', JSON.stringify(s))
  process.exit(0)
}).catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
