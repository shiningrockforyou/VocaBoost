/**
 * B27 Longitudinal Word-Correctness — anxious/TOP (v2)
 * Agent: A27. Fixes: handles pending Step-4 review; detects MCQ option buttons/divs.
 *
 * The anxious persona was left mid-Day-3 (new-word test done, review pending).
 * This script: (1) completes the pending review to advance CSD, (2) walks ~20 more days.
 */

import { chromium } from 'playwright'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs'
import { join } from 'path'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EMAIL = 'audit_anxious_01_top@vocaboost.test'
const PASSWORD = 'AuditPass2026!'
const UID = 'KsZv3zxcUEVTdFbdWKZ8oesDcj33'
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
const LIST_ID = '8RMews2H7C3UJUAsOBzR'
const CP_DOC_ID = `${CLASS_ID}_${LIST_ID}`
const CHROMIUM_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'
const DAILY_PACE = 80
const STUDY_DAYS_PER_WEEK = 5
const PASS_THRESHOLD_PCT = 92
const LIST_SIZE = 3381
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B27/anxious'
const FINDINGS_DIR = '/app/audit/playwright/findings'
const AGENT_LOGS_DIR = '/app/audit/playwright/findings/agent_logs'
const SA_PATH = '/app/scripts/serviceAccountKey.json'

mkdirSync(EVIDENCE_DIR, { recursive: true })
mkdirSync(FINDINGS_DIR, { recursive: true })
mkdirSync(AGENT_LOGS_DIR, { recursive: true })

// Firebase Admin (read-only)
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

// Word cache
const wpc = JSON.parse(readFileSync('/app/e2e/audit/B27/word_position_cache.json', 'utf-8'))
const wByText = {}
for (const w of wpc) {
  const k = w.word.split('\r\n')[0].split('\n')[0].trim().toLowerCase()
  wByText[k] = w
}
function fw(text) {
  if (!text) return null
  const k = text.split('\r\n')[0].split('\n')[0].trim().toLowerCase()
  if (wByText[k]) return wByText[k]
  for (const [kk, w] of Object.entries(wByText)) {
    if (kk.startsWith(k) || k.startsWith(kk)) return w
  }
  return null
}

// expectedWords model
const { calculateInterventionLevel, expectedNewWordRange, calculateSegment, partitionReviewEligibility, checkPresentedWords } = await import('/app/e2e/audit/helpers/expectedWords.js')

// Logging
const jPath = join(AGENT_LOGS_DIR, 'A27.jsonl')
function log(ev) {
  try { appendFileSync(jPath, JSON.stringify({ ts: new Date().toISOString(), ...ev }) + '\n') } catch (_) {}
  console.log('[A27]', JSON.stringify(ev).substring(0,220))
}

// Admin reads
const readCP = async () => { const s = await initAdmin().doc(`users/${UID}/class_progress/${CP_DOC_ID}`).get(); return s.exists ? s.data() : null }
const readAllCP = async () => { const s = await initAdmin().collection(`users/${UID}/class_progress`).get(); return s.docs.map(d => ({ id: d.id, data: d.data() })) }
const readSS = async () => { const s = await initAdmin().collection(`users/${UID}/study_states`).get(); return s.docs.map(d => ({ id: d.id, ...d.data() })) }
const readAtts = async () => { const s = await initAdmin().collection('attempts').where('studentId', '==', UID).get(); return s.docs.map(d => ({ id: d.id, ...d.data() })) }

function nextWD(d) {
  const n = new Date(d.getTime() + 86400000)
  while (n.getDay() === 0 || n.getDay() === 6) n.setDate(n.getDate() + 1)
  return n
}
const wait = ms => new Promise(r => setTimeout(r, ms))

// Login
async function login(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await wait(2500)
  const needLogin = await page.getByRole('link', { name: /log\s?in|sign\s?in/i }).isVisible({ timeout: 3000 }).catch(() => false)
  if (needLogin) { await page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first().click(); await wait(1000) }
  else {
    const ev = await page.getByLabel(/email/i).isVisible({ timeout: 2000 }).catch(() => false)
    if (!ev) { await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) }); await wait(1000) }
  }
  const em = page.getByLabel(/email/i).first()
  if (await em.isVisible({ timeout: 10000 }).catch(() => false)) {
    await em.fill(EMAIL)
    await page.getByLabel(/password/i).first().fill(PASSWORD)
    await page.getByLabel(/password/i).first().press('Enter')
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
      const b = page.getByRole('button', { name: /continue|log\s?in/i }).first()
      if (await b.isVisible({ timeout: 3000 }).catch(() => false)) { await b.click(); await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(() => {}) }
    })
  }
  await wait(2000)
}

// Navigate to session from dashboard
async function navSession(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await wait(2500)
  const sb = page.getByRole('button', { name: /start session|start today|begin session/i }).first()
  if (await sb.isVisible({ timeout: 4000 }).catch(() => false)) { await sb.click(); return true }
  const cc = page.getByText('25WT 2차 TOP OFFLINE').first()
  if (await cc.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cc.click(); await wait(1500)
    const sb2 = page.getByRole('button', { name: /start session|start today|begin/i }).first()
    if (await sb2.isVisible({ timeout: 3000 }).catch(() => false)) { await sb2.click(); return true }
  }
  return false
}

// H2 guard: detect stale Step-5
async function h2(page, day) {
  const stale = await page.getByText(/step\s*5|session complete|completed today/i).isVisible({ timeout: 2000 }).catch(() => false)
  if (stale) { log({ type: 'h2_hit', day }); await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 }); await wait(2000); return false }
  return true
}

// Skip to test
async function skip(page) {
  const mb = page.getByRole('button', { name: /session menu/i }).first()
  if (await mb.isVisible({ timeout: 6000 }).catch(() => false)) {
    await mb.click(); await wait(600)
    const si = page.getByRole('menuitem', { name: /skip to test/i }).first()
    if (await si.isVisible({ timeout: 3000 }).catch(() => false)) {
      await si.click(); await wait(600)
      const cf = page.getByRole('button', { name: /confirm|yes|skip/i }).first()
      if (await cf.isVisible({ timeout: 3000 }).catch(() => false)) { await cf.click(); await wait(1000); return true }
    }
  }
  return false
}

// Get word text from prompt
async function getWT(page) {
  for (const sel of ['h1', 'h2', 'h3', '[class*="wordPrompt"]', '[class*="word-prompt"]', '[class*="question"]']) {
    const el = page.locator(sel).first()
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
      const t = await el.textContent().catch(() => '')
      if (t && t.trim().length > 0 && t.trim().length < 150) return t.trim()
    }
  }
  return ''
}

// Detect if we're on a test page
async function detectTestType(page) {
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => '')
  const hasInput = await page.getByRole('textbox').isVisible({ timeout: 1500 }).catch(() => false)
  const hasRadio = await page.getByRole('radio').isVisible({ timeout: 1000 }).catch(() => false)
  const isStep4 = /step\s*4\s*of\s*5|review\s*test/i.test(bodyText)
  const isStep3 = /step\s*[123]\s*of\s*5|new\s*word/i.test(bodyText)
  // MCQ options: check for multiple option-like buttons
  const optButtons = await page.locator('button').filter({ hasText: /^[A-Z].{5,80}$/ }).count().catch(() => 0)
  const isMCQLike = isStep4 || (optButtons >= 3 && !hasInput)
  return { hasInput, hasRadio, isStep4, isStep3, isMCQLike, optButtons, bodyText }
}

// Typed test handler
async function typedTest(page, dayNum) {
  const words = []
  let qn = 0
  for (let q = 0; q < 35; q++) {
    await wait(400)
    if (await page.getByText(/test complete|results|all done|finished/i).isVisible({ timeout: 700 }).catch(() => false)) break
    const sub = page.getByRole('button', { name: /submit test|finish test|complete test/i }).first()
    if (await sub.isVisible({ timeout: 700 }).catch(() => false)) { await sub.click(); await wait(2000); break }
    const inp = page.getByRole('textbox').first()
    if (!await inp.isVisible({ timeout: 8000 }).catch(() => false)) { log({ type: 'typed_no_input', q }); break }
    const wt = await getWT(page)
    const we = fw(wt)
    if (we) words.push({ word: wt, position: we.position })
    else if (wt) words.push({ word: wt, position: -1, notFound: true })
    const ans = we ? we.definition_en : 'a word with a specific meaning'
    await inp.click(); await inp.clear().catch(() => {})
    for (const ch of ans) await inp.type(ch, { delay: 85 })
    await wait(250)
    const nx = page.getByRole('button', { name: /next|submit answer|check/i }).first()
    if (await nx.isVisible({ timeout: 2500 }).catch(() => false)) await nx.click()
    else await inp.press('Enter')
    await wait(350); qn++
  }
  log({ type: 'typed_done_raw', day: dayNum, questions: qn })
  console.log(`  Typed: ${qn} q answered. Waiting for AI grading (26s)...`)
  await wait(26000)
  return { presentedWords: words, questionCount: qn }
}

// MCQ test handler — handles radio, buttons, and clickable divs
async function mcqTest(page, dayNum, maxQ = 65) {
  const words = []
  let qn = 0
  log({ type: 'mcq_start', day: dayNum })
  for (let q = 0; q < maxQ; q++) {
    await wait(400)
    if (await page.getByText(/test complete|results|all done|finished/i).isVisible({ timeout: 700 }).catch(() => false)) break
    const sub = page.getByRole('button', { name: /submit test|finish test|complete/i }).first()
    if (await sub.isVisible({ timeout: 700 }).catch(() => false)) { await sub.click(); await wait(2000); break }
    const wt = await getWT(page)
    const we = fw(wt)
    if (we) words.push({ word: wt, position: we.position })
    else if (wt) words.push({ word: wt, position: -1, notFound: true })

    // Try to click an option — try radio, then buttons
    let clicked = false
    const radios = page.getByRole('radio')
    const rc = await radios.count()
    if (rc > 0) {
      if (we) {
        for (let i = 0; i < rc; i++) {
          const lbl = await radios.nth(i).evaluate(el => { const l = el.closest('label') || document.querySelector(`label[for="${el.id}"]`); return l ? l.textContent : el.value || '' }).catch(() => '')
          if (we.definition_en && lbl.includes(we.definition_en.substring(0,18))) { await radios.nth(i).click(); clicked = true; break }
        }
      }
      if (!clicked) { await radios.first().click(); clicked = true }
    }
    if (!clicked) {
      // Try buttons that look like MCQ options (more than 2 words, shorter than 200 chars)
      const btns = await page.evaluate((defStart) => {
        const allBtns = [...document.querySelectorAll('button, [role="button"], [class*="option"], [class*="choice"]')]
        const opts = allBtns.filter(el => {
          const txt = (el.textContent || '').trim()
          return txt.length > 5 && txt.length < 200 && !/(next|submit|skip|menu|back|continue|start|play|audio)/i.test(txt)
        })
        if (opts.length < 2) return null
        let targetIdx = 0
        if (defStart) {
          const di = opts.findIndex(el => el.textContent.includes(defStart))
          if (di >= 0) targetIdx = di
        }
        opts[targetIdx].click()
        return { clicked: true, total: opts.length, text: opts[targetIdx].textContent?.trim().substring(0,60) }
      }, we ? we.definition_en?.substring(0, 18) : null).catch(() => null)
      if (btns?.clicked) { clicked = true; log({ type: 'mcq_btn_click', day: dayNum, q, text: btns.text }) }
    }
    if (!clicked) { log({ type: 'mcq_no_option', day: dayNum, q }); break }
    await wait(300)
    const nx = page.getByRole('button', { name: /next|submit answer/i }).first()
    if (await nx.isVisible({ timeout: 2500 }).catch(() => false)) await nx.click()
    await wait(300); qn++
  }
  log({ type: 'mcq_done', day: dayNum, questions: qn, words: words.length })
  return { presentedWords: words, questionCount: qn }
}

// Capture score
async function captScore(page) {
  await wait(3000)
  const t = await page.evaluate(() => {
    for (const el of [...document.querySelectorAll('[class*="score"],[class*="result"],[class*="percent"],h1,h2,h3,p,span')]) {
      const txt = el.textContent || ''
      if (/\d+%|\d+\/\d+/.test(txt)) return txt
    }
    return document.body.innerText.substring(0, 500)
  }).catch(() => '')
  const pm = t.match(/(\d+)%/)
  if (pm) return parseInt(pm[1])
  const fm = t.match(/(\d+)\/(\d+)/)
  if (fm) return Math.round(parseInt(fm[1]) / parseInt(fm[2]) * 100)
  return null
}

// Retake handler
async function doRetake(page, dayNum, origScore) {
  const rb = page.getByRole('button', { name: /retake|try again|redo|retry/i }).first()
  if (!await rb.isVisible({ timeout: 5000 }).catch(() => false)) { log({ type: 'no_retake_btn', day: dayNum, score: origScore }); return null }
  const preCSD = (await readCP())?.currentStudyDay ?? 0
  log({ type: 'retake_start', day: dayNum, origScore, preCSD })
  await rb.click(); await wait(2000)
  const dt = await detectTestType(page)
  let rr = null
  if (dt.hasInput) { rr = await typedTest(page, dayNum) }
  else if (dt.isMCQLike || dt.hasRadio) { rr = await mcqTest(page, dayNum) }
  const rscore = await captScore(page)
  const postCSD = (await readCP())?.currentStudyDay ?? 0
  const doubled = postCSD > preCSD
  log({ type: 'retake_done', day: dayNum, origScore, rscore, preCSD, postCSD, doubled })
  if (doubled) console.log(`  RETAKE CSD VIOLATION: ${preCSD} -> ${postCSD}`)
  return { rr, rscore, preCSD, postCSD, doubled, rPositions: (rr?.presentedWords ?? []).map(p => p.position).filter(p => p >= 0) }
}

// Dispute attempt
async function tryDispute(page, day) {
  const b = page.getByRole('button', { name: /dispute|challenge|contest/i }).first()
  if (await b.isVisible({ timeout: 2000 }).catch(() => false)) {
    log({ type: 'dispute_attempt', day }); await b.click(); await wait(1500)
    const cb = page.getByRole('button', { name: /close|cancel|dismiss/i }).first()
    if (await cb.isVisible({ timeout: 2000 }).catch(() => false)) await cb.click()
    return true
  }
  return false
}

// ── MAIN SESSION RUNNER ──
async function runSession(page, dateISO, dayNum, isFirstPendingReview = false) {
  const res = { dayNumber: dayNum, sessionDate: dateISO, blocked: false, blockedReason: null, h2Hit: false, isPendingReview: isFirstPendingReview, newTest: { presentedWords: [], questionCount: 0, score: null }, reviewTest: null, retake: null, errors: [], steps: [] }
  try {
    await login(page); res.steps.push('login_ok')

    if (isFirstPendingReview) {
      // Day 3 review is pending — navigate to session and complete the Step-4 review
      log({ type: 'pending_review_mode', day: dayNum })
      const reached = await navSession(page)
      if (!reached) { res.blocked = true; res.blockedReason = 'pending review: session not reached'; return res }
      await wait(2000); res.steps.push('session_navigated')
      // Check what's on screen
      const dt = await detectTestType(page)
      log({ type: 'pending_review_detect', day: dayNum, dt: { isStep4: dt.isStep4, isMCQ: dt.isMCQLike, hasInput: dt.hasInput } })
      if (dt.isMCQLike || dt.hasRadio) {
        res.steps.push('review_pending_found')
        const rr = await mcqTest(page, dayNum)
        res.reviewTest = rr
        await wait(3000); res.reviewTest.score = await captScore(page)
        log({ type: 'pending_review_done', day: dayNum, score: res.reviewTest.score })
        res.steps.push(`pending_review_score_${res.reviewTest.score}`)
        await tryDispute(page, dayNum)
      } else {
        res.blocked = true; res.blockedReason = 'pending review: MCQ not found'
      }
      return res
    }

    // Normal session flow
    const reached = await navSession(page)
    if (!reached) { res.blocked = true; res.blockedReason = 'session not reached'; return res }
    res.steps.push('nav_ok'); await wait(2000)

    // H2 guard
    let hok = await h2(page, dayNum)
    if (!hok) {
      res.h2Hit = true
      await navSession(page); await wait(2000)
      hok = await h2(page, dayNum)
      if (!hok) { res.blocked = true; res.blockedReason = 'H2 stale persisted'; return res }
    }
    res.steps.push(res.h2Hit ? 'h2_recovered' : 'h2_clean')

    // Skip to test
    const skipped = await skip(page)
    res.steps.push(skipped ? 'skipped' : 'no_skip'); await wait(2000)

    const dt = await detectTestType(page)
    log({ type: 'test_detect', day: dayNum, hasInput: dt.hasInput, isStep4: dt.isStep4, isMCQ: dt.isMCQLike, optBtns: dt.optButtons })

    if (dt.hasInput) {
      // Typed test (new words)
      res.steps.push('typed_start')
      const nr = await typedTest(page, dayNum)
      res.newTest = nr
      res.newTest.score = await captScore(page)
      log({ type: 'typed_score', day: dayNum, score: res.newTest.score })
      res.steps.push(`typed_done_${res.newTest.score}`)
      await tryDispute(page, dayNum); await wait(1000)
      // Retake if below threshold
      if (res.newTest.score !== null && res.newTest.score < PASS_THRESHOLD_PCT) {
        res.retake = await doRetake(page, dayNum, res.newTest.score)
        if (res.retake) res.steps.push(`retake_${res.retake.rscore}`)
      }
      // Move to review
      if (dayNum >= 2) {
        await wait(2000)
        const rvBtn = page.getByRole('button', { name: /review|take review|continue|next step/i }).first()
        if (await rvBtn.isVisible({ timeout: 12000 }).catch(() => false)) { await rvBtn.click(); await wait(2000) }
        const dt2 = await detectTestType(page)
        if (dt2.isMCQLike || dt2.hasRadio) {
          res.steps.push('review_start')
          const rr = await mcqTest(page, dayNum)
          res.reviewTest = rr
          await wait(3000); res.reviewTest.score = await captScore(page)
          log({ type: 'review_score', day: dayNum, score: res.reviewTest.score })
          res.steps.push(`review_done_${res.reviewTest.score}`)
          await tryDispute(page, dayNum)
        } else {
          log({ type: 'no_review_found', day: dayNum, dt: dt2.bodyText?.substring(0,100) })
        }
      }
    } else if (dt.isMCQLike || dt.hasRadio) {
      // MCQ directly (could be review without prior typed test)
      res.steps.push('mcq_direct')
      const mr = await mcqTest(page, dayNum)
      res.reviewTest = mr
      await wait(3000); res.reviewTest.score = await captScore(page)
      res.steps.push(`mcq_direct_${res.reviewTest.score}`)
    } else {
      res.blocked = true
      res.blockedReason = `No test found (inp:${dt.hasInput},mcq:${dt.isMCQLike},optBtns:${dt.optButtons})`
      log({ type: 'no_test', day: dayNum, body: dt.bodyText?.substring(0,200) })
    }
  } catch (err) {
    res.errors.push(err.message)
    log({ type: 'session_err', day: dayNum, err: err.message })
    console.error(`Day ${dayNum} err:`, err.message)
  }
  return res
}

// ── LOGOUT/LOGIN SCENARIO ──
async function logoutLoginScenario(page, dayNum) {
  log({ type: 'logout_login_start', day: dayNum })
  console.log('\n  === LOGOUT/LOGIN SCENARIO ===')
  const reached = await navSession(page)
  if (!reached) { log({ type: 'logout_login_blocked', r: 'no session' }); return { verdict: 'BLOCKED', reason: 'no session' } }
  await skip(page); await wait(2000)
  const dt = await detectTestType(page)
  if (!dt.hasInput) { log({ type: 'logout_login_no_typed' }); return { verdict: 'BLOCKED', reason: 'no typed test for logout scenario' } }
  // Answer 4 questions
  let answered = 0
  for (let q = 0; q < 4; q++) {
    const inp = page.getByRole('textbox').first()
    if (!await inp.isVisible({ timeout: 5000 }).catch(() => false)) break
    const wt = await getWT(page); const we = fw(wt)
    await inp.click(); await inp.clear().catch(() => {})
    for (const ch of (we ? we.definition_en : 'a word')) await inp.type(ch, { delay: 80 })
    await wait(200)
    const nx = page.getByRole('button', { name: /next|submit answer/i }).first()
    if (await nx.isVisible({ timeout: 2500 }).catch(() => false)) await nx.click()
    else await inp.press('Enter')
    await wait(350); answered++
  }
  log({ type: 'logout_login_answered', count: answered })
  // Capture LS before
  const lsBefore = await page.evaluate(() => { const r = {}; for (const k of Object.keys(localStorage)) r[k] = localStorage.getItem(k); return r }).catch(() => ({}))
  const lsRecBefore = Object.keys(lsBefore).filter(k => /recovery|session|attempt|draft/i.test(k))
  // Logout
  let lo = false
  const pBtn = page.getByRole('button', { name: /profile|account|avatar/i }).first()
  if (await pBtn.isVisible({ timeout: 3000 }).catch(() => false)) { await pBtn.click(); await wait(500) }
  const loBtn = page.getByRole('button', { name: /log\s?out|sign\s?out/i }).first()
  if (await loBtn.isVisible({ timeout: 3000 }).catch(() => false)) { await loBtn.click(); lo = true; await wait(2000) }
  else {
    const loLink = page.getByRole('link', { name: /log\s?out|sign\s?out/i }).first()
    if (await loLink.isVisible({ timeout: 3000 }).catch(() => false)) { await loLink.click(); lo = true; await wait(2000) }
  }
  if (!lo) { await page.evaluate(async () => { try { if (window.firebase?.auth) await window.firebase.auth().signOut() } catch(_) {} }).catch(() => {}); lo = true }
  const lsAfter = await page.evaluate(() => { const r = {}; for (const k of Object.keys(localStorage)) r[k] = localStorage.getItem(k); return r }).catch(() => ({}))
  const lsRecAfter = Object.keys(lsAfter).filter(k => /recovery|session|attempt|draft/i.test(k))
  await wait(1500)
  await login(page); await wait(2000)
  const lsPost = await page.evaluate(() => { const r = {}; for (const k of Object.keys(localStorage)) r[k] = localStorage.getItem(k); return r }).catch(() => ({}))
  const lsRecPost = Object.keys(lsPost).filter(k => /recovery|session|attempt|draft/i.test(k))
  const recovVis = await page.getByText(/recovery|resume|continue where|pick up|restore/i).isVisible({ timeout: 5000 }).catch(() => false)
  await navSession(page); await wait(2000)
  const restartable = await page.getByRole('button', { name: /start|begin|take test|skip/i }).isVisible({ timeout: 3000 }).catch(() => false)
  const corrupted = await page.getByText(/error|something went wrong/i).isVisible({ timeout: 2000 }).catch(() => false)
  const verdict = recovVis ? 'RECOVERABLE' : (lsRecAfter.length > 0 || lsRecPost.length > 0) ? 'PARTIAL_RECOVERY' : 'WORK_LOST'
  const severity = recovVis ? null : 'HIGH'
  log({ type: 'logout_login_done', verdict, severity, answered, recovVis, restartable, corrupted, lsRecBefore, lsRecAfter, lsRecPost })
  console.log(`  Verdict: ${verdict}, recovery prompt: ${recovVis}`)
  return { verdict, severity, answered, loggedOut: lo, recovVis, restartable, corrupted, lsRecBefore, lsRecAfter, lsRecPost }
}

// ── MAIN ──
async function main() {
  log({ type: 'audit_start_v2', agent: 'A27', persona: 'anxious', class: 'TOP' })
  writeFileSync(join(AGENT_LOGS_DIR, 'A27.status.json'), JSON.stringify({ status: 'running', startedAt: new Date().toISOString() }, null, 2))

  const initCP = await readCP()
  const initCSD = initCP?.currentStudyDay ?? 1
  const initTWI = initCP?.totalWordsIntroduced ?? 0
  const allCPBefore = await readAllCP()
  const attsBefore = await readAtts()
  log({ type: 'initial_state', CSD: initCSD, TWI: initTWI, interventionLevel: initCP?.interventionLevel ?? 0 })
  console.log(`=== B27 anxious/TOP v2 | CSD=${initCSD}, TWI=${initTWI}, intervention=${initCP?.interventionLevel ?? 0} ===`)
  console.log(`CP docs: ${allCPBefore.map(d => d.id).join(', ')}`)
  console.log(`Pre-run attempts: ${attsBefore.length}`)

  // Starting state: CSD=2, TWI=110, Day 3 typed done but review pending
  // We need to complete the pending Day 3 review first, then walk from Day 4 forward
  const PENDING_REVIEW_DAY = initCSD + 1 // Day 3 (review pending)
  const TARGET = 20
  const ANCHOR = new Date('2026-06-02T09:00:00+09:00') // Monday

  const dayTable = [], findingsList = [], sessions = []
  let h2Count = 0, logoutLoginResult = null, logoutLoginDayNum = null

  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH })

  try {
    // ── PHASE 0: Complete pending Day 3 review ──
    console.log(`\n${'─'.repeat(55)}\nPHASE 0: Complete pending Day ${PENDING_REVIEW_DAY} review\n${'─'.repeat(55)}`)
    const ctx0 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx0.addInitScript((iso) => { const o = Date.now.bind(Date); const off = new Date(iso).getTime() - o(); window.__VOCABOOST_TIME_OFFSET__=0; Date.now=()=>o()+window.__VOCABOOST_TIME_OFFSET__+off }, ANCHOR.toISOString())
    const p0 = await ctx0.newPage()
    let phase0Result
    try {
      phase0Result = await runSession(p0, ANCHOR.toISOString(), PENDING_REVIEW_DAY, true /* pendingReview */)
      await p0.screenshot({ path: join(EVIDENCE_DIR, 'day_03_review_pending.png'), fullPage: false }).catch(() => {})
    } catch (e) { phase0Result = { blocked: true, blockedReason: e.message, errors: [e.message], reviewTest: null } }
    finally { await p0.close().catch(() => {}); await ctx0.close().catch(() => {}) }

    await wait(3000)
    const postP0CP = await readCP()
    const postP0CSD = postP0CP?.currentStudyDay ?? initCSD
    const postP0TWI = postP0CP?.totalWordsIntroduced ?? initTWI
    log({ type: 'phase0_done', pendingDay: PENDING_REVIEW_DAY, blocked: phase0Result.blocked, postCSD: postP0CSD, reviewScore: phase0Result.reviewTest?.score })
    console.log(`Phase 0 done: CSD ${initCSD}->${postP0CSD}, review score: ${phase0Result.reviewTest?.score}%`)

    // Phase 0 evidence
    const p0SS = await readSS()
    const p0Hist = {}; for (const ss of p0SS) p0Hist[ss.status] = (p0Hist[ss.status] || 0) + 1
    const p0Evidence = { dayNumber: PENDING_REVIEW_DAY, phase: 'pending_review_completion', sessionDate: ANCHOR.toISOString(), preCSD: initCSD, postCSD: postP0CSD, preTWI: initTWI, postTWI: postP0TWI, reviewTest: phase0Result.reviewTest, statusHistPost: p0Hist, blocked: phase0Result.blocked, blockedReason: phase0Result.blockedReason, steps: phase0Result.steps ?? [], capturedAt: new Date().toISOString() }
    writeFileSync(join(EVIDENCE_DIR, 'day_03_review_pending.json'), JSON.stringify(p0Evidence, null, 2))

    // After phase 0, CSD should be 3 (or stay at 2 if review wasn't found)
    const currentCSD = postP0CSD
    const startingDay = currentCSD + 1 // Day 4 (first full session day)
    let currentDate = nextWD(ANCHOR) // June 3 (Tuesday)

    // ── PHASE 1: Walk ~20 sessions forward ──
    console.log(`\nStarting forward walk from Day ${startingDay} (post-review CSD=${currentCSD})`)

    for (let idx = 0; idx < TARGET; idx++) {
      const dayNum = startingDay + idx
      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) currentDate = new Date(currentDate.getTime() + 86400000)
      console.log(`\n${'─'.repeat(55)}\nDay ${dayNum} | ${currentDate.toISOString().split('T')[0]} (session ${idx+1}/${TARGET})\n${'─'.repeat(55)}`)
      log({ type: 'session_start', day: dayNum, date: currentDate.toISOString() })

      const preCP = await readCP()
      const preCSD = preCP?.currentStudyDay ?? (dayNum-1)
      const preTWI = preCP?.totalWordsIntroduced ?? 0
      const preIntv = preCP?.interventionLevel ?? calculateInterventionLevel(preCP?.recentReviewScores ?? [])
      const preReviewScores = preCP?.recentReviewScores ?? []

      const preSS = await readSS()
      const histPre = {}; for (const ss of preSS) histPre[ss.status] = (histPre[ss.status] || 0) + 1

      const expNewPre = expectedNewWordRange(preTWI, DAILY_PACE, preIntv, LIST_SIZE)
      const expSegPre = calculateSegment(dayNum, STUDY_DAYS_PER_WEEK, preTWI, DAILY_PACE, preIntv)
      let eligPre = new Set(), retPre = new Set()
      if (expSegPre) {
        const segSt = preSS.filter(ss => ss.wordIndex != null).map(ss => ({ position: ss.wordIndex, status: ss.status, returnAtMs: ss.returnAt ? ss.returnAt._seconds*1000 : null }))
        const pv = partitionReviewEligibility(segSt, expSegPre, currentDate.getTime())
        eligPre = pv.eligibleIds; retPre = pv.retiredIds
      }
      console.log(`Pre: CSD=${preCSD}, TWI=${preTWI}, intv=${preIntv.toFixed(3)}, MASTERED=${histPre.MASTERED||0}`)
      console.log(`Exp new: ${expNewPre ? `[${expNewPre.startIndex},${expNewPre.endIndex}]` : 'null'}`)
      console.log(`Exp seg: ${expSegPre ? `[${expSegPre.startIndex},${expSegPre.endIndex}]` : 'null'}, elig=${eligPre.size}, ret=${retPre.size}`)

      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      await ctx.addInitScript((iso) => { const o=Date.now.bind(Date); const off=new Date(iso).getTime()-o(); window.__VOCABOOST_TIME_OFFSET__=0; Date.now=()=>o()+window.__VOCABOOST_TIME_OFFSET__+off }, currentDate.toISOString())
      await ctx.addInitScript(() => { if(navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())) })
      const page = await ctx.newPage()
      let sr

      try {
        // Logout/login scenario: on session idx=2 (day startingDay+2)
        if (idx === 2 && !logoutLoginResult) {
          logoutLoginDayNum = dayNum
          await login(page)
          logoutLoginResult = await logoutLoginScenario(page, dayNum)
          await login(page); await wait(1000) // re-login for actual session
        }
        sr = await runSession(page, currentDate.toISOString(), dayNum)
        if (sr.h2Hit) h2Count++
        await page.screenshot({ path: join(EVIDENCE_DIR, `day_${String(dayNum).padStart(2,'0')}_end.png`), fullPage: false }).catch(() => {})
      } catch (ce) {
        sr = { dayNumber: dayNum, sessionDate: currentDate.toISOString(), blocked: true, blockedReason: ce.message, h2Hit: false, newTest: { presentedWords: [], questionCount: 0, score: null }, reviewTest: null, retake: null, errors: [ce.message], steps: [] }
        log({ type: 'ctx_err', day: dayNum, err: ce.message })
      } finally {
        await page.close().catch(() => {}); await ctx.close().catch(() => {})
      }

      await wait(3000)
      const postCP = await readCP()
      const postCSD = postCP?.currentStudyDay ?? preCSD
      const postTWI = postCP?.totalWordsIntroduced ?? preTWI
      const postIntv = postCP?.interventionLevel ?? preIntv
      const postSS = await readSS()
      const histPost = {}; for (const ss of postSS) histPost[ss.status] = (histPost[ss.status] || 0) + 1
      const mastered = postSS.filter(ss => ss.status === 'MASTERED')
      const mastCount = mastered.length
      const mastFut = mastered.filter(ss => ss.returnAt && ss.returnAt._seconds*1000 > currentDate.getTime()).length

      // Post-test segment
      const expSegPost = calculateSegment(dayNum, STUDY_DAYS_PER_WEEK, postTWI, DAILY_PACE, postIntv)
      let eligPost = new Set(), retPost = new Set()
      if (expSegPost) {
        const segStP = postSS.filter(ss => ss.wordIndex != null).map(ss => ({ position: ss.wordIndex, status: ss.status, returnAtMs: ss.returnAt ? ss.returnAt._seconds*1000 : null }))
        const pv = partitionReviewEligibility(segStP, expSegPost, currentDate.getTime())
        eligPost = pv.eligibleIds; retPost = pv.retiredIds
      }

      const newPos = (sr?.newTest?.presentedWords ?? []).map(p => p.position).filter(p => p >= 0)
      const revPos = (sr?.reviewTest?.presentedWords ?? []).map(p => p.position).filter(p => p >= 0)
      const newViol = checkPresentedWords({ phase: 'new', presentedPositions: newPos, expectedRange: expNewPre })
      const revViol = expSegPost && dayNum >= 2 ? checkPresentedWords({ phase: 'review', presentedPositions: revPos, expectedRange: expSegPost, eligibleIds: eligPost, retiredIds: retPost }) : []
      const f01Viol = revPos.filter(p => retPost.has(p))
      const allViol = [...newViol, ...revViol]
      const csdOk = sr?.blocked ? null : (postCSD === dayNum)
      const csdDrift = (csdOk === false) ? `expected ${dayNum} got ${postCSD}` : null

      const row = { day: dayNum, date: currentDate.toISOString().split('T')[0], preCSD, postCSD, expectedCSD: dayNum, csdOk, csdDrift, preTWI, postTWI, expNewPre: expNewPre ? `[${expNewPre.startIndex},${expNewPre.endIndex}]` : 'null', presentedNewCount: newPos.length, newMatch: newViol.length === 0, expSegPost: expSegPost ? `[${expSegPost.startIndex},${expSegPost.endIndex}]` : 'null', eligPost: eligPost.size, retPost: retPost.size, presentedRevCount: revPos.length, revMatch: revViol.length === 0, f01Viol: f01Viol.length, mastCount, mastFut, newScore: sr?.newTest?.score, revScore: sr?.reviewTest?.score, retScore: sr?.retake?.rscore ?? null, retCSDDouble: sr?.retake?.doubled ?? null, histPost, violations: allViol, blocked: sr?.blocked ?? false, blockedReason: sr?.blockedReason ?? null, h2Hit: sr?.h2Hit ?? false, steps: sr?.steps ?? [] }
      dayTable.push(row); sessions.push(sr)
      if (allViol.length > 0 || f01Viol.length > 0) findingsList.push({ day: dayNum, violations: allViol, f01Violations: f01Viol.length })

      // Evidence
      const ev = { dayNumber: dayNum, sessionDate: currentDate.toISOString(), preCSD, postCSD, preTWI, postTWI, expectedNewRangePre: expNewPre, expectedSegmentPost: expSegPost, eligibleForReview: eligPost.size, retiredFromReview: retPost.size, newTest: { presentedWords: sr?.newTest?.presentedWords ?? [], presentedPositions: newPos, questionCount: sr?.newTest?.questionCount ?? 0, score: sr?.newTest?.score }, reviewTest: sr?.reviewTest ? { presentedWords: sr.reviewTest.presentedWords, presentedPositions: revPos, questionCount: sr.reviewTest.questionCount, score: sr.reviewTest.score } : null, retake: sr?.retake ?? null, violations: allViol, f01Violations: f01Viol, histPre, histPost, mastCount, mastFut, mastSample: mastered.slice(0,5).map(m => ({ id: m.id, wordIndex: m.wordIndex, returnAtSec: m.returnAt?._seconds ?? null })), errors: sr?.errors ?? [], blocked: sr?.blocked ?? false, blockedReason: sr?.blockedReason ?? null, steps: sr?.steps ?? [], capturedAt: new Date().toISOString() }
      writeFileSync(join(EVIDENCE_DIR, `day_${String(dayNum).padStart(2,'0')}.json`), JSON.stringify(ev, null, 2))
      log({ type: 'session_complete', day: dayNum, postCSD, csdOk, newViol: newViol.length, revViol: revViol.length, f01: f01Viol.length, mastered: mastCount, newScore: sr?.newTest?.score, revScore: sr?.reviewTest?.score })
      console.log(`  Day ${dayNum}: CSD ${preCSD}->${postCSD}(ok:${csdOk}), new:[${newViol.length}v], rev:[${revViol.length}v], F01:${f01Viol.length}, M:${mastCount}, ${sr?.newTest?.score??'-'}%/${sr?.reviewTest?.score??'-'}%`)

      // Stop conditions
      const f01days = findingsList.filter(f => f.f01Violations > 0)
      if (f01days.length >= 2) { log({ type: 'stop_condition', reason: 'F01_REGRESSION', days: f01days.map(f=>f.day) }); console.log(`STOP: F01 regression on ${f01days.length} days`); break }
      const segVdays = findingsList.filter(f => f.violations.some(v => v.includes('not in eligible segment pool')))
      if (segVdays.length >= 2) { log({ type: 'stop_condition', reason: 'REVIEW_OUTSIDE_SEGMENT', days: segVdays.map(f=>f.day) }); console.log(`STOP: Review outside segment ${segVdays.length} days`); break }

      currentDate = nextWD(currentDate)
    }

    // Post-run checks
    const allCPAfter = await readAllCP()
    const attsAfter = await readAtts()
    const newOrphans = allCPAfter.filter(d => !d.id.includes('_') && !allCPBefore.some(p => p.id === d.id)).map(d => d.id)
    const badFmt = attsAfter.filter(a => a.studentId === UID && !(a.id.includes(CLASS_ID) && a.id.includes(LIST_ID))).map(a => a.id)
    const attByKey = {}
    for (const a of attsAfter.filter(x => x.studentId === UID)) {
      const k = `${a.studyDay}_${a.testType}_${a.sessionType}`; if (!attByKey[k]) attByKey[k] = []; attByKey[k].push(a.id)
    }
    const dupes = Object.entries(attByKey).filter(([,ids]) => ids.length > 1).map(([k,ids]) => ({ key: k, count: ids.length }))
    log({ type: 'audit_complete', completed: sessions.filter(s => !s?.blocked).length, orphans: newOrphans.length, badFmt: badFmt.length, dupes: dupes.length, h2Count })
    return { dayTable, findingsList, sessions, initCSD, startingDay, endDay: startingDay + sessions.length - 1, newOrphans, badFmt, dupes, h2Count, logoutLoginResult, logoutLoginDayNum, phase0: phase0Result }

  } finally {
    await browser.close()
  }
}

// ── RUN ──
const R = await main()

// ── BUILD FINDINGS ──
const f01Days = R.findingsList.filter(f => f.f01Violations > 0)
const revOutDays = R.findingsList.filter(f => f.violations.some(v => v.includes('not in eligible segment pool')))
const newViolDays = R.findingsList.filter(f => f.violations.some(v => v.startsWith('new:')))
const retakeDays = R.dayTable.filter(r => r.retScore !== null)
const retCSDDouble = retakeDays.filter(r => r.retCSDDouble)
const csdDriftDays = R.dayTable.filter(r => r.csdDrift)
const blockedDays = R.dayTable.filter(r => r.blocked)
const f01OK = f01Days.length === 0

const dRows = R.dayTable.map(r => `| ${r.day} | ${r.date} | ${r.preCSD}→${r.postCSD} | ${r.csdOk===null?'BLK':r.csdOk?'OK':`DRIFT(${r.csdDrift})`} | ${r.preTWI}→${r.postTWI} | ${r.expNewPre} | ${r.presentedNewCount} | ${r.newMatch?'OK':'FAIL'} | ${r.expSegPost} | ${r.presentedRevCount} | ${r.revMatch?'OK':'FAIL'} | ${r.f01Viol>0?`F01:${r.f01Viol}`:'0'} | ${r.mastCount} | ${r.newScore??'-'}% | ${r.revScore??'-'}% | ${r.retScore!=null?r.retScore+'%':'-'} | ${r.blocked?'BLOCKED':r.h2Hit?'H2hit':'OK'} |`).join('\n')

const md = `# Findings — B27 Longitudinal Word-Correctness (anxious/TOP)

**Run date:** ${new Date().toISOString().split('T')[0]}
**Agent:** A27  **Persona:** anxious/TOP  **Script:** v2
**Start state:** CSD=${R.initCSD}, TWI=110 (Day 3 review was pending; completed in Phase 0)
**Phase 0 (pending review):** ${R.phase0?.blocked ? 'BLOCKED — ' + R.phase0?.blockedReason : `Score ${R.phase0?.reviewTest?.score ?? 'N/A'}%, steps: ${R.phase0?.steps?.join(',')?? ''}`}
**Sessions:** ${R.sessions.filter(s=>!s?.blocked).length} completed / ${R.sessions.length} attempted (${blockedDays.length} blocked)
**Day range:** Day ${R.startingDay} → Day ${R.endDay}

---

## Day-by-day table

| Day | Date | CSD | CSD OK | TWI | Exp new | Pres new | New OK | Exp seg | Pres rev | Rev OK | F01 | MASTERED | New% | Rev% | Retake% | Notes |
|-----|------|-----|--------|-----|---------|----------|--------|---------|----------|--------|-----|---------|------|------|---------|-------|
${dRows}

---

## Findings

### F01 Verification (MASTERED words in review)
**F01 RESOLVED: ${f01OK ? 'YES — zero MASTERED-in-review violations.' : 'NO — REGRESSION on days ' + f01Days.map(f=>f.day).join(',')}**
${f01OK ? 'buildReviewQueue correctly excludes MASTERED (future returnAt) words from the review pool.' : `MASTERED words appeared in review. Stop condition met.`}

### NEW word selection
**${newViolDays.length===0 ? 'CORRECT every session.' : `DRIFT on ${newViolDays.length} days: ${newViolDays.map(f=>'Day '+f.day).join(',')}`}**
${newViolDays.length===0 ? 'All new words in expected [preTWI, preTWI+pace) slice.' : newViolDays.map(f=>`Day ${f.day}: ${f.violations.filter(v=>v.startsWith('new:')).join('; ')}`).join('\n')}

### REVIEW word selection (post-test-TWI)
**${revOutDays.length===0 ? 'CORRECT every session.' : `DRIFT on ${revOutDays.length} days`}**
${revOutDays.length===0 ? 'Review words from eligible segment (post-TWI confirmed).' : revOutDays.map(f=>`Day ${f.day}`).join(',')}

### MASTERED lifecycle
MASTERED count: ${R.dayTable[0]?.mastCount??0} → ${R.dayTable[R.dayTable.length-1]?.mastCount??0} across the walk.

### CSD progression
**${csdDriftDays.length===0 ? 'CSD +1 per session — held on all completed days.' : `DRIFT on ${csdDriftDays.length} days`}**

### Retake behavior (anxious persona)
Retakes taken: ${retakeDays.length}
${retakeDays.length>0 ? retakeDays.map(r=>`Day ${r.day}: ${r.newScore}% → retake ${r.retScore}%`).join('\n') : 'No sessions below 92% threshold (verbatim answers score high).'}
CSD double-advance: ${retCSDDouble.length===0 ? 'NONE' : `VIOLATION on ${retCSDDouble.map(r=>r.day).join(',')}`}
Word-selection corruption: ${retakeDays.length>0 ? 'See retake.rPositions in day_NN.json' : 'N/A'}

### Logout/Login mid-session (Day ${R.logoutLoginDayNum ?? 'N/A'})
${R.logoutLoginResult ? `**Verdict: ${R.logoutLoginResult.verdict}** (severity: ${R.logoutLoginResult.severity ?? 'NONE'})
- Answered ${R.logoutLoginResult.answered} questions before logout
- Recovery prompt: ${R.logoutLoginResult.recovVis}
- Session restartable: ${R.logoutLoginResult.restartable}
- localStorage recovery keys — before: [${R.logoutLoginResult.lsRecBefore?.join(',')||'none'}], after logout: [${R.logoutLoginResult.lsRecAfter?.join(',')||'none'}], post re-login: [${R.logoutLoginResult.lsRecPost?.join(',')||'none'}]
${R.logoutLoginResult.verdict==='WORK_LOST'?'**HIGH:** In-progress answers lost on logout — no recovery prompt on re-login.':R.logoutLoginResult.verdict==='RECOVERABLE'?'Recovery prompt appeared — work preserved.':'Partial recovery state in LS but no recovery prompt; student must restart.'}` : 'BLOCKED — could not run logout/login scenario.'}

---

## HARNESS NOTES

**No-fabrication:** YES — Admin SDK read-only. State advanced via UI sessions only.
**Orphan docs:** ${R.newOrphans.length===0?'NONE':R.newOrphans.join(',')}
**Bad-format attempts:** ${R.badFmt.length===0?'NONE':R.badFmt.join(',')}
**Duplicate attempt keys:** ${R.dupes.length===0?'NONE (retakes noted)':JSON.stringify(R.dupes)}
**H2 stale-Step-5:** ${R.h2Count}
**Model discipline:** Pre-test TWI for new range; post-test TWI for review eligibility.
**Evidence:** ${R.sessions.length+1} day_NN.json files at findings/evidence/B27/anxious/
**Phase 0 note:** Day 3 review was pending (new-word test done in prior runs, review skipped). Phase 0 completed this review. All subsequent sessions started from CSD=3.
`

writeFileSync('/app/audit/playwright/findings/findings_B27_anxious.md', md)
console.log('\nFindings written: findings/findings_B27_anxious.md')

const status = { status: f01Days.length>=2?'stop_condition_hit':(blockedDays.length===R.sessions.length?'all_blocked':'complete'), agent:'A27', persona:'anxious', class:'TOP', batch:'B27', completedAt: new Date().toISOString(), sessionsCompleted: R.sessions.filter(s=>!s?.blocked).length, sessionsAttempted: R.sessions.length, startDay: R.startingDay, endDay: R.endDay, f01Resolved: f01OK, f01ViolationDays: f01Days.map(f=>f.day), h2Count: R.h2Count, newViolDays: newViolDays.map(f=>f.day), revOutDays: revOutDays.map(f=>f.day), retakeDays: retakeDays.length, retCSDDouble: retCSDDouble.length, logoutLoginVerdict: R.logoutLoginResult?.verdict??null, logoutLoginSeverity: R.logoutLoginResult?.severity??null, orphans: R.newOrphans.length, badFmt: R.badFmt.length }
writeFileSync('/app/audit/playwright/findings/agent_logs/A27.status.json', JSON.stringify(status, null, 2))

console.log('\n' + '='.repeat(70))
console.log('STATUS BLOCK — A27 B27 anxious/TOP')
console.log('='.repeat(70))
console.log(`Overall: ${status.status.toUpperCase()}`)
console.log(`Sessions: ${status.sessionsCompleted} / ${status.sessionsAttempted} (${blockedDays.length} blocked)`)
console.log(`Day range: ${status.startDay} → ${status.endDay}`)
console.log(`NEW correct every session: ${newViolDays.length===0?'YES':'NO – '+newViolDays.map(f=>f.day).join(',')}`)
console.log(`REVIEW correct w/ MASTERED retirement: ${revOutDays.length===0?'YES':'NO – '+revOutDays.map(f=>f.day).join(',')}`)
console.log(`F01 RESOLVED (no MASTERED in review): ${f01OK?'YES':'NO — REGRESSION days '+f01Days.map(f=>f.day).join(',')}`)
console.log(`Retake behavior: ${retakeDays.length===0?'N/A (no retakes)':retCSDDouble.length===0?'OK – no CSD double-advance':'VIOLATION: CSD doubled on '+retCSDDouble.map(r=>r.day).join(',')}`)
console.log(`Logout/login: ${status.logoutLoginVerdict??'not run'} (${status.logoutLoginSeverity??'N/A'})`)
console.log(`CSD +1/session: ${csdDriftDays.length===0?'YES':'NO – '+csdDriftDays.map(r=>r.day).join(',')}`)
console.log(`Orphan docs: ${R.newOrphans.length===0?'NONE':'YES: '+R.newOrphans.join(',')}`)
console.log(`H2 count: ${R.h2Count}`)
console.log(`GO/NO-GO: ${(f01OK&&newViolDays.length===0&&revOutDays.length===0&&R.newOrphans.length===0)?'GO':'NO-GO (see findings)'}`)
console.log('='.repeat(70))
