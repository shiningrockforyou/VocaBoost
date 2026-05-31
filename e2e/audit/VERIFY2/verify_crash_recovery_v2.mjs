/**
 * VERIFY2 v2 — Crash Recovery Fix Verification
 *
 * The crash recovery test must reach the NEW WORD TEST (typed test) phase.
 * Both personas have completed their latest sessions (phase=complete).
 *
 * Strategy:
 * 1. Use the date shim to simulate a FUTURE DAY (Day 19 for lazy, Day 26 for careful)
 * 2. The "Move On to Next Day" modal appears when re-entering a completed session
 * 3. After moving on, the session resets → new day starts → we get to the new-word study phase
 * 4. Use Skip to Test (session menu) to reach the typed test
 * 5. Type 3 answers without submitting
 * 6. Capture localStorage — look for lastPhase and answer storage
 * 7. Hard crash → reopen → check recovery
 *
 * Key fix to verify: lastPhase should be 'NEW_TEST' (was 'NEW_STUDY' before fix)
 */

import { chromium } from 'playwright'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const BASE_URL = 'https://vocaboostone.netlify.app'
// Use lazy for crash recovery (CSD=18, TWI=420, has session to advance)
const EMAIL = 'audit_lazy_01_top@vocaboost.test'
const PASSWORD = 'AuditPass2026!'
const UID = 'VBgBmlrlzXVPzURmABkdDBGtKd42'
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
const LIST_ID = '8RMews2H7C3UJUAsOBzR'
const CP_DOC_ID = `${CLASS_ID}_${LIST_ID}`
const CHROMIUM_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'
const SA_PATH = '/app/scripts/serviceAccountKey.json'

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/VERIFY2'
const AGENT_LOGS_DIR = '/app/audit/playwright/findings/agent_logs'
const JSONL_PATH = join(AGENT_LOGS_DIR, 'VERIFY2.jsonl')

mkdirSync(EVIDENCE_DIR, { recursive: true })
mkdirSync(AGENT_LOGS_DIR, { recursive: true })

function log(ev) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...ev })
  try { appendFileSync(JSONL_PATH, line + '\n') } catch (_) {}
  console.log('[VERIFY2-REC-v2]', JSON.stringify(ev).substring(0, 300))
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

const readSessionState = async () => {
  const s = await initAdmin().doc(`users/${UID}/session_states/${CP_DOC_ID}`).get()
  return s.exists ? s.data() : null
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

async function captureLocalStorage(page) {
  return page.evaluate(() => {
    const store = {}
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      try { store[k] = JSON.parse(localStorage.getItem(k)) } catch { store[k] = localStorage.getItem(k) }
    }
    return store
  }).catch(() => ({}))
}

async function login(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await wait(2000)
  const hasEmail = await page.getByLabel(/email/i).isVisible({ timeout: 3000 }).catch(() => false)
  if (!hasEmail) {
    const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
    if (await loginLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await loginLink.click()
      await wait(1000)
    } else {
      await page.evaluate(() => {
        history.pushState({}, '', '/login')
        dispatchEvent(new PopStateEvent('popstate'))
      })
      await wait(1200)
    }
  }
  const em = await page.getByLabel(/email/i).first()
  await em.waitFor({ timeout: 15000 }).catch(() => {})
  const emailVisible = await em.isVisible({ timeout: 3000 }).catch(() => false)
  if (emailVisible) {
    await em.fill(EMAIL)
    await page.getByLabel(/password/i).first().fill(PASSWORD)
    await page.getByLabel(/password/i).first().press('Enter')
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
      const b = page.getByRole('button', { name: /continue|log\s?in/i }).first()
      if (await b.isVisible({ timeout: 3000 }).catch(() => false)) {
        await b.click()
        await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(() => {})
      }
    })
  }
  await wait(2000)
  log({ type: 'logged_in' })
}

async function reachNewWordTest(page, dayFakeNowMs) {
  // Navigate to dashboard first
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await wait(3000)

  const bodyText0 = await page.evaluate(() => document.body.innerText.substring(0, 1000)).catch(() => '')
  log({ type: 'dashboard_state', bodySnip: bodyText0.substring(0, 200) })

  // If we see "Resume Day N?" modal (completed session re-entry), click "Move On to Next Day"
  if (/resume.*day\s*\d|move.*on.*next\s*day/i.test(bodyText0)) {
    log({ type: 'resume_modal_on_dashboard' })
    // This is unusual — navigate to session URL to trigger it
  }

  // Navigate to session — try button first
  let btnClicked = false
  for (const name of ["Start Today's Session", 'Start Session', 'Start Today', 'Begin Session']) {
    const btn = page.getByRole('button', { name: new RegExp(name, 'i') }).first()
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click()
      await wait(2500)
      btnClicked = true
      break
    }
  }

  if (!btnClicked) {
    // Try clicking class card to get session button
    const classCard = page.getByText('25WT 2차 TOP OFFLINE').first()
    if (await classCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await classCard.click()
      await wait(1500)
    }
    for (const name of ["Start Today's Session", 'Start Session']) {
      const btn = page.getByRole('button', { name: new RegExp(name, 'i') }).first()
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click()
        await wait(2500)
        btnClicked = true
        break
      }
    }
  }

  if (!btnClicked) {
    // Direct URL navigation
    log({ type: 'fallback_direct_url' })
    await page.goto(`${BASE_URL}/session/${CLASS_ID}/${LIST_ID}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {})
    await wait(3000)
  }

  // Check current state
  let bodyText1 = await page.evaluate(() => document.body.innerText.substring(0, 1000)).catch(() => '')
  log({ type: 'after_session_nav', bodySnip: bodyText1.substring(0, 200) })

  // Handle "Resume Day N?" modal (re-entry from completed session)
  if (/resume.*day\s*\d|move.*on.*next\s*day|retry.*review.*test/i.test(bodyText1)) {
    log({ type: 'resume_modal_found' })
    // Click "Move On to Next Day" to clear session and advance to next day
    const moveOnBtn = page.getByRole('button', { name: /move on.*next|next day/i }).first()
    if (await moveOnBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await moveOnBtn.click()
      await wait(3000)
      log({ type: 'moved_on_to_next_day' })

      // Now we should be on dashboard or the new day's session
      bodyText1 = await page.evaluate(() => document.body.innerText.substring(0, 1000)).catch(() => '')
      log({ type: 'after_move_on', bodySnip: bodyText1.substring(0, 200) })

      // If on dashboard, start session again
      if (/dashboard|welcome/i.test(bodyText1)) {
        for (const name of ["Start Today's Session", 'Start Session', 'Start Today']) {
          const btn = page.getByRole('button', { name: new RegExp(name, 'i') }).first()
          if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await btn.click()
            await wait(2500)
            break
          }
        }
        bodyText1 = await page.evaluate(() => document.body.innerText.substring(0, 1000)).catch(() => '')
        log({ type: 'after_start_new_day', bodySnip: bodyText1.substring(0, 200) })
      }
    }
  }

  // Dismiss flashcard customization modal if shown
  const startStudying = page.getByRole('button', { name: /start studying/i }).first()
  if (await startStudying.isVisible({ timeout: 2000 }).catch(() => false)) {
    await startStudying.click()
    await wait(1000)
    log({ type: 'dismissed_modal' })
  }

  await wait(1000)
  bodyText1 = await page.evaluate(() => document.body.innerText.substring(0, 800)).catch(() => '')
  log({ type: 'pre_skip_state', bodySnip: bodyText1.substring(0, 200) })

  // Use Skip to Test if we're on flashcard study phase
  const inputCount = await page.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]').count().catch(() => 0)
  if (inputCount > 0) {
    log({ type: 'already_on_test', inputCount })
    return { onTest: true, inputCount }
  }

  // Try session menu → Skip to Test
  let menuBtn = page.locator('[aria-label="Session menu"]')
  if (!await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    menuBtn = page.getByRole('button', { name: /session menu/i }).first()
  }

  if (await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await menuBtn.click()
    await wait(700)

    let skipItem = page.getByText('Skip to Test').first()
    if (!await skipItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      skipItem = page.getByRole('menuitem', { name: /skip to test/i }).first()
    }

    if (await skipItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipItem.click()
      await wait(800)

      for (const name of ['Start Test', 'Confirm', 'Yes', 'Skip', 'OK']) {
        const cf = page.getByRole('button', { name: new RegExp(name, 'i') }).first()
        if (await cf.isVisible({ timeout: 2000 }).catch(() => false)) {
          await cf.click()
          await wait(2000)
          log({ type: 'skip_confirmed', btn: name })
          break
        }
      }
    } else {
      await page.keyboard.press('Escape')
      log({ type: 'no_skip_item' })
    }
  } else {
    log({ type: 'no_session_menu' })
  }

  await wait(2000)
  const finalBody = await page.evaluate(() => document.body.innerText.substring(0, 800)).catch(() => '')
  const finalInputCount = await page.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]').count().catch(() => 0)
  log({ type: 'test_reach_result', inputCount: finalInputCount, bodySnip: finalBody.substring(0, 150) })

  return { onTest: finalInputCount > 0, inputCount: finalInputCount, bodySnip: finalBody.substring(0, 200) }
}

async function main() {
  log({ type: 'verify2_recovery_v2_start' })

  // Use a future date (Day 19 for lazy, session_state.phase=complete → will trigger "Move On" modal)
  const fakeNowMs = new Date('2026-07-14T09:00:00+09:00').getTime()

  // ── PHASE 1: CRASH TEST ──
  console.log('\n═══ PHASE 1: CRASH RECOVERY TEST ═══')

  const userDataDir1 = join(tmpdir(), `verify2_crash_v2_${Date.now()}`)
  mkdirSync(userDataDir1, { recursive: true })
  log({ type: 'userDataDir', dir: userDataDir1 })

  const crashContext = await chromium.launchPersistentContext(userDataDir1, {
    executablePath: CHROMIUM_PATH,
    headless: true,
    viewport: { width: 1440, height: 900 }
  })
  await crashContext.addInitScript({ content: makeDateShim(fakeNowMs) })
  await crashContext.addInitScript(() => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations()
        .then(regs => regs.forEach(r => r.unregister()))
        .catch(() => {})
    }
  })

  let lastPhaseValue = null
  let answersFoundInLS = false
  let intentionalExitSet = false
  let reachedTest = false
  let beforeCrashLSSnapshot = {}

  try {
    const page1 = await crashContext.newPage()

    // Listen for console messages about recovery/lastPhase
    page1.on('console', msg => {
      if (/lastPhase|NEW_TEST|NEW_STUDY|recovery/i.test(msg.text())) {
        log({ type: 'console_msg', text: msg.text().substring(0, 200) })
      }
    })

    await login(page1)

    const testResult = await reachNewWordTest(page1, fakeNowMs)
    reachedTest = testResult.onTest
    console.log(`Reached new-word test: ${reachedTest}, inputs: ${testResult.inputCount}`)

    if (reachedTest) {
      const inputs = page1.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]')
      const actualCount = await inputs.count().catch(() => 0)
      const typedCount = Math.min(3, actualCount)

      for (let i = 0; i < typedCount; i++) {
        const inp = inputs.nth(i)
        await inp.scrollIntoViewIfNeeded().catch(() => {})
        await inp.click()
        await inp.fill(`verify2_answer_${i + 1}`)
        await wait(300)
      }
      log({ type: 'typed_answers', count: typedCount })
      console.log(`Typed ${typedCount} test answers`)

      // Wait for localStorage to be written (the fix writes it during typing/focus)
      await wait(2000)
    } else {
      console.log('WARNING: Could not reach typed test. State:', testResult.bodySnip?.substring(0, 150))
    }

    // ── CAPTURE localStorage BEFORE CRASH ──
    const ls = await captureLocalStorage(page1)
    beforeCrashLSSnapshot = ls

    const allLSKeys = Object.keys(ls)
    console.log('All LS keys:', allLSKeys.join(', '))
    log({ type: 'ls_captured', keys: allLSKeys })

    // Search for session recovery data
    for (const [k, v] of Object.entries(ls)) {
      const strV = typeof v === 'string' ? v : JSON.stringify(v)

      // Check for lastPhase in any key's value
      if (/lastPhase/i.test(strV)) {
        const match = strV.match(/"lastPhase"\s*:\s*"([^"]+)"/)
        if (match) {
          lastPhaseValue = match[1]
          console.log(`Found lastPhase="${lastPhaseValue}" in key "${k}"`)
          log({ type: 'lastPhase_found', key: k, value: lastPhaseValue })
        }
      }

      // Check for typed answers
      if (/verify2_answer/i.test(strV)) {
        answersFoundInLS = true
        console.log(`Found verify2 answers in key "${k}": ${strV.substring(0, 100)}`)
      }

      // Check for session recovery structure
      if (/session|recover|phase/i.test(k)) {
        console.log(`Session-related key "${k}": ${strV.substring(0, 200)}`)
        log({ type: 'session_ls_key', key: k, value: strV.substring(0, 200) })
      }

      // Check intentional_exit
      if (/intentional.exit/i.test(k) && v) {
        intentionalExitSet = true
      }
    }

    // Save evidence
    writeFileSync(join(EVIDENCE_DIR, 'recovery_v2_before_crash.json'), JSON.stringify({
      reachedTest,
      lastPhaseValue,
      answersFoundInLS,
      intentionalExitSet,
      allKeys: allLSKeys,
      sessionRelatedData: Object.fromEntries(
        Object.entries(ls).filter(([k]) => /session|recover|phase|test|answer|exit|vocaboost/i.test(k))
      )
    }, null, 2))

  } catch (err) {
    log({ type: 'crash_phase_error', error: err.message, stack: err.stack?.substring(0, 300) })
    console.error('Crash phase error:', err)
  } finally {
    log({ type: 'simulating_crash' })
    console.log('Hard crash (context.close)...')
    await crashContext.close().catch(() => {})
    console.log('Crashed.')
  }

  // ── PHASE 2: REOPEN ──
  console.log('\n═══ PHASE 2: RECOVERY CHECK ═══')
  await wait(1500)

  const recoveryContext = await chromium.launchPersistentContext(userDataDir1, {
    executablePath: CHROMIUM_PATH,
    headless: true,
    viewport: { width: 1440, height: 900 }
  })
  await recoveryContext.addInitScript({ content: makeDateShim(fakeNowMs) })

  let recoveryResult = {
    url: '',
    routedToTest: false,
    recoveryPromptVisible: false,
    answersRestored: false,
    lsKeys: []
  }

  try {
    const page2 = await recoveryContext.newPage()
    await page2.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
    await wait(5000) // extra wait for recovery detection

    const url2 = page2.url()
    const body2 = await page2.evaluate(() => document.body.innerText.substring(0, 1500)).catch(() => '')
    recoveryResult.url = url2

    log({ type: 'after_reopen', url: url2, bodySnip: body2.substring(0, 300) })
    console.log('After reopen URL:', url2)
    console.log('After reopen body (first 300):', body2.substring(0, 300))

    // Check for test routing
    const inputCount2 = await page2.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]').count().catch(() => 0)
    recoveryResult.routedToTest = inputCount2 > 0 ||
      /typed.*test|new.*word.*test|step\s*2|type.*definition/i.test(body2) ||
      /typedtest|typed-test/i.test(url2)

    // Check for recovery prompt
    recoveryResult.recoveryPromptVisible = /resume.*session|recover.*answers|continue.*where|session.*interrupted|restore.*answers/i.test(body2) ||
      await page2.getByText(/resume.*session|recover.*answers|continue.*where you left/i).isVisible({ timeout: 3000 }).catch(() => false)

    // Check LS after reopen
    const ls2 = await captureLocalStorage(page2)
    recoveryResult.lsKeys = Object.keys(ls2)
    console.log('LS keys after reopen:', recoveryResult.lsKeys.join(', '))

    for (const [k, v] of Object.entries(ls2)) {
      const strV = typeof v === 'string' ? v : JSON.stringify(v)
      if (/verify2_answer/i.test(strV)) {
        recoveryResult.answersRestored = true
        console.log(`Answers in post-reopen LS key "${k}"`)
      }
      if (/session|recover|phase/i.test(k)) {
        console.log(`Post-reopen session key "${k}": ${strV.substring(0, 200)}`)
      }
    }

    writeFileSync(join(EVIDENCE_DIR, 'recovery_v2_after_crash.json'), JSON.stringify({
      url: url2,
      routedToTest: recoveryResult.routedToTest,
      recoveryPromptVisible: recoveryResult.recoveryPromptVisible,
      answersRestored: recoveryResult.answersRestored,
      lsKeys: recoveryResult.lsKeys,
      sessionRelatedData: Object.fromEntries(
        Object.entries(ls2).filter(([k]) => /session|recover|phase|test|answer|exit|vocaboost/i.test(k))
      )
    }, null, 2))

  } catch (err) {
    log({ type: 'recovery_phase_error', error: err.message })
    console.error('Recovery phase error:', err)
  } finally {
    await recoveryContext.close().catch(() => {})
  }

  // ── PHASE 3: GRACEFUL CLOSE CONTROL ──
  console.log('\n═══ PHASE 3: GRACEFUL CLOSE CONTROL ═══')

  const userDataDir3 = join(tmpdir(), `verify2_graceful_v2_${Date.now()}`)
  mkdirSync(userDataDir3, { recursive: true })

  const gracefulCtx = await chromium.launchPersistentContext(userDataDir3, {
    executablePath: CHROMIUM_PATH,
    headless: true,
    viewport: { width: 1440, height: 900 }
  })
  await gracefulCtx.addInitScript({ content: makeDateShim(fakeNowMs) })

  let gracefulSuppressed = false

  try {
    const page3 = await gracefulCtx.newPage()
    await login(page3)
    const testResult3 = await reachNewWordTest(page3, fakeNowMs)
    console.log(`Graceful test - reached test: ${testResult3.onTest}`)

    if (testResult3.onTest) {
      const inp3 = page3.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]').first()
      await inp3.click().catch(() => {})
      await inp3.fill('graceful_control_answer').catch(() => {})
      await wait(500)
    }

    // Graceful close: navigate away from test (triggers beforeunload)
    await page3.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
    await wait(2000)

    const afterNavLS = await captureLocalStorage(page3)
    const intentionalExitAfterGraceful = Object.entries(afterNavLS).some(([k, v]) =>
      /intentional.exit/i.test(k) && v
    )
    console.log('Intentional exit set after graceful nav:', intentionalExitAfterGraceful)
  } catch (err) {
    log({ type: 'graceful_error', error: err.message })
  } finally {
    await gracefulCtx.close().catch(() => {})
  }

  // Reopen and check suppression
  const gracefulReopenCtx = await chromium.launchPersistentContext(userDataDir3, {
    executablePath: CHROMIUM_PATH,
    headless: true,
    viewport: { width: 1440, height: 900 }
  })
  await gracefulReopenCtx.addInitScript({ content: makeDateShim(fakeNowMs) })

  try {
    const page4 = await gracefulReopenCtx.newPage()
    await page4.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
    await wait(4000)

    const body4 = await page4.evaluate(() => document.body.innerText.substring(0, 800)).catch(() => '')
    const inputCount4 = await page4.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]').count().catch(() => 0)
    const recoveryShown = /resume.*session|recover.*answers|session.*interrupted/i.test(body4)

    gracefulSuppressed = !recoveryShown && inputCount4 === 0
    console.log('Recovery shown after graceful close:', recoveryShown)
    console.log('Recovery correctly suppressed:', gracefulSuppressed)
  } finally {
    await gracefulReopenCtx.close().catch(() => {})
  }

  // ── SUMMARY ──
  const lastPhaseIsNewTest = lastPhaseValue === 'NEW_TEST'

  console.log('\n═══ VERIFY2 CRASH RECOVERY SUMMARY (v2) ═══')
  console.log(`Reached new-word test: ${reachedTest}`)
  console.log(`lastPhase captured: "${lastPhaseValue}"`)
  console.log(`lastPhase === 'NEW_TEST': ${lastPhaseIsNewTest}`)
  console.log(`Answers in LS before crash: ${answersFoundInLS}`)
  console.log(`intentional_exit NOT set: ${!intentionalExitSet}`)
  console.log(`Routed to test after crash: ${recoveryResult.routedToTest}`)
  console.log(`Recovery prompt shown: ${recoveryResult.recoveryPromptVisible}`)
  console.log(`Answers restored: ${recoveryResult.answersRestored}`)
  console.log(`Graceful close suppresses recovery: ${gracefulSuppressed}`)
  console.log(`CRASH RECOVERY VERIFIED: ${lastPhaseIsNewTest ? 'YES — PASS' : 'NO — FAIL (lastPhase=' + lastPhaseValue + ')'}`)

  const summary = {
    test: 'CRASH_RECOVERY_v2',
    reachedTest,
    lastPhaseValue,
    lastPhaseIsNewTest,
    answersFoundInLS,
    intentionalExitNotSet: !intentionalExitSet,
    routedToTestAfterCrash: recoveryResult.routedToTest,
    recoveryPromptShown: recoveryResult.recoveryPromptVisible,
    answersRestored: recoveryResult.answersRestored,
    gracefulCloseSuppressesRecovery: gracefulSuppressed,
    overallPass: lastPhaseIsNewTest
  }

  writeFileSync(join(EVIDENCE_DIR, 'recovery_v2_summary.json'), JSON.stringify(summary, null, 2))
  log({ type: 'recovery_v2_complete', summary })

  return summary
}

main().then(s => {
  console.log('\nCrash Recovery v2 Done:', JSON.stringify(s, null, 2))
  process.exit(0)
}).catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
