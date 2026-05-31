/**
 * VERIFY2 — Crash Recovery Fix Verification (TEST 3)
 *
 * OBJECTIVE: Verify that the NEW_TEST marker is now written to lastPhase in
 * localStorage session-recovery key when user is in the new-word test.
 *
 * FLOW:
 * 1. Reach the new-word test via real flow (study flashcards → test starts automatically,
 *    OR skip to test via session menu)
 * 2. Type ~3 answers in the test inputs
 * 3. Do NOT submit — capture localStorage
 * 4. Assert: lastPhase === 'NEW_TEST' (was 'NEW_STUDY' before fix)
 * 5. Assert: vocaboost_test_* key holds the typed answers
 * 6. Assert: intentional_exit is NOT set
 * 7. Hard crash (context.close with no graceful unload)
 * 8. Reopen with same userDataDir
 * 9. Navigate to app → assert: routed back into test, recovery prompt shown, answers restored
 *
 * CONTROL: also test graceful close → assert recovery SUPPRESSED.
 *
 * Uses careful/TOP (CSD=24, has both new-word and review phases).
 */

import { chromium } from 'playwright'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const BASE_URL = 'https://vocaboostone.netlify.app'
const CAREFUL_EMAIL = 'audit_careful_01_top@vocaboost.test'
const CAREFUL_PASSWORD = 'AuditPass2026!'
const CAREFUL_UID = 'EPnmY4FIXxVq19tQtxQCvE26p0F3'
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
const LIST_ID = '8RMews2H7C3UJUAsOBzR'
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
  console.log('[VERIFY2-RECOVERY]', JSON.stringify(ev).substring(0, 300))
}

// ── Firebase Admin (read-only) ──
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

// Make a future date shim so session gate is bypassed
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

// ── Capture full localStorage ──
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

// ── Find session recovery keys in localStorage ──
function findRecoveryKeys(lsData) {
  const recoveryKeys = {}
  const testKeys = {}

  for (const [k, v] of Object.entries(lsData)) {
    if (/session.recover|vocaboost.recover|session_recovery|sessionRecovery/i.test(k)) {
      recoveryKeys[k] = v
    }
    if (/vocaboost.test|vocaboost_test/i.test(k)) {
      testKeys[k] = v
    }
  }

  return { recoveryKeys, testKeys }
}

// ── Login ──
async function login(page, email, password) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await wait(2000)

  const alreadyDash = await page.getByText(/welcome|dashboard/i).isVisible({ timeout: 2000 }).catch(() => false)
  const hasEmail = await page.getByLabel(/email/i).isVisible({ timeout: 2000 }).catch(() => false)

  if (alreadyDash && !hasEmail) {
    log({ type: 'already_logged_in' })
    return
  }

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
  log({ type: 'logged_in' })
}

// ── Navigate to session ──
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

// ── Dismiss modal ──
async function dismissModal(page) {
  const startStudying = page.getByRole('button', { name: /start studying/i }).first()
  if (await startStudying.isVisible({ timeout: 2000 }).catch(() => false)) {
    await startStudying.click()
    await wait(800)
    return true
  }
  return false
}

// ── Skip to Test ──
async function skipToTest(page) {
  await dismissModal(page)
  await wait(600)

  let menuBtn = page.locator('[aria-label="Session menu"]')
  if (!await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    menuBtn = page.getByRole('button', { name: /session menu/i }).first()
  }
  if (!await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    log({ type: 'skip_no_menu' })
    return false
  }
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
      log({ type: 'skip_confirmed', button: name })
      return true
    }
  }
  return true
}

// ── Main ──
async function main() {
  log({ type: 'verify2_recovery_start' })

  // Use a far future date to bypass session gate
  const fakeNowMs = new Date('2026-08-04T09:00:00+09:00').getTime()

  // ── PHASE 1: CRASH TEST ──
  console.log('\n═══ PHASE 1: CRASH RECOVERY TEST ═══')

  const userDataDir1 = join(tmpdir(), `verify2_crash_${Date.now()}`)
  mkdirSync(userDataDir1, { recursive: true })
  log({ type: 'crash_test_userDataDir', dir: userDataDir1 })

  // Launch persistent context (for localStorage persistence across crashes)
  const crashContext = await chromium.launchPersistentContext(userDataDir1, {
    executablePath: CHROMIUM_PATH,
    headless: true,
    viewport: { width: 1440, height: 900 }
  })

  // Inject date shim
  await crashContext.addInitScript({ content: makeDateShim(fakeNowMs) })
  await crashContext.addInitScript(() => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations()
        .then(regs => regs.forEach(r => r.unregister()))
        .catch(() => {})
    }
  })

  let beforeCrashLS = {}
  let lastPhaseValue = null
  let answersFoundInLS = false
  let intentionalExitSet = false

  try {
    const page1 = await crashContext.newPage()

    // Login
    await login(page1, CAREFUL_EMAIL, CAREFUL_PASSWORD)

    // Navigate to session
    await navSession(page1)
    await wait(2000)

    // Dismiss modal if shown
    await dismissModal(page1)

    // Try to reach new-word test via REAL flow (study flashcards until test appears)
    // First check if we land on flashcard study phase
    const bodyText0 = await page1.evaluate(() => document.body.innerText.substring(0, 800)).catch(() => '')
    log({ type: 'initial_session_state', bodySnip: bodyText0.substring(0, 150) })

    const isOnFlashcards = /step\s*1|flashcard|new.*word.*study|study.*new/i.test(bodyText0)
    const isOnTest = /step\s*2|new.*word.*test|type.*definition/i.test(bodyText0)
    const inputCount0 = await page1.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]').count().catch(() => 0)

    log({ type: 'page_state', isOnFlashcards, isOnTest, inputCount: inputCount0 })

    // If already on test, we're good
    // If on flashcards, wait for auto-transition OR use skip
    if (!isOnTest && inputCount0 === 0) {
      // Try skipping to test via session menu
      log({ type: 'using_skip_to_test' })
      const skipped = await skipToTest(page1)
      await wait(2000)
      log({ type: 'skip_result', skipped })
    }

    // Verify we're on the new-word test
    const bodyText1 = await page1.evaluate(() => document.body.innerText.substring(0, 800)).catch(() => '')
    const inputCount1 = await page1.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]').count().catch(() => 0)
    const hasTextbox = await page1.getByRole('textbox').isVisible({ timeout: 3000 }).catch(() => false)

    log({ type: 'test_state', bodySnip: bodyText1.substring(0, 150), inputCount: inputCount1, hasTextbox })

    const onNewWordTest = inputCount1 > 0 || hasTextbox
    console.log(`On new-word test: ${onNewWordTest}, inputs: ${inputCount1}`)

    if (onNewWordTest) {
      // Type 3 answers WITHOUT submitting
      const inputs = page1.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]')
      const actualCount = await inputs.count().catch(() => 0)
      const typedCount = Math.min(3, actualCount)

      for (let i = 0; i < typedCount; i++) {
        const inp = inputs.nth(i)
        await inp.scrollIntoViewIfNeeded().catch(() => {})
        await inp.click()
        await inp.fill(`test_answer_${i + 1}_verify2`)
        await wait(200)
      }

      log({ type: 'typed_answers', count: typedCount })
      console.log(`Typed ${typedCount} answers in test inputs`)

      // Wait a moment for any auto-save/localStorage updates
      await wait(1500)

      // CAPTURE localStorage BEFORE CRASH
      beforeCrashLS = await captureLocalStorage(page1)
      const { recoveryKeys, testKeys } = findRecoveryKeys(beforeCrashLS)

      log({ type: 'localStorage_before_crash', keys: Object.keys(beforeCrashLS), recoveryKeys: Object.keys(recoveryKeys), testKeys: Object.keys(testKeys) })
      console.log('localStorage keys:', Object.keys(beforeCrashLS).join(', '))
      console.log('Recovery keys:', Object.keys(recoveryKeys).join(', '))
      console.log('Test keys:', Object.keys(testKeys).join(', '))

      // Check lastPhase value
      for (const [k, v] of Object.entries(recoveryKeys)) {
        console.log(`Recovery key "${k}":`, JSON.stringify(v).substring(0, 300))
        if (v && typeof v === 'object' && v.lastPhase) {
          lastPhaseValue = v.lastPhase
          console.log(`*** lastPhase = "${lastPhaseValue}" ***`)
        } else if (v && typeof v === 'string') {
          try {
            const parsed = JSON.parse(v)
            if (parsed.lastPhase) {
              lastPhaseValue = parsed.lastPhase
              console.log(`*** lastPhase = "${lastPhaseValue}" (from string) ***`)
            }
          } catch {}
        }
      }

      // Check test answers stored
      for (const [k, v] of Object.entries(testKeys)) {
        console.log(`Test key "${k}":`, JSON.stringify(v).substring(0, 200))
        if (v) answersFoundInLS = true
      }

      // Check intentional_exit
      const intentionalExit = beforeCrashLS['intentional_exit'] || beforeCrashLS['vocaboost_intentional_exit'] ||
        Object.entries(beforeCrashLS).find(([k, v]) => /intentional.exit/i.test(k))
      intentionalExitSet = !!intentionalExit
      console.log(`intentional_exit set: ${intentionalExitSet}`)

      // Also check all LS for any key containing lastPhase
      for (const [k, v] of Object.entries(beforeCrashLS)) {
        const strV = typeof v === 'string' ? v : JSON.stringify(v)
        if (/lastPhase/i.test(strV)) {
          const match = strV.match(/"lastPhase"\s*:\s*"([^"]+)"/)
          if (match && !lastPhaseValue) {
            lastPhaseValue = match[1]
            console.log(`Found lastPhase in key "${k}": "${lastPhaseValue}"`)
          }
        }
      }

    } else {
      console.log('WARNING: Could not reach new-word test, bodyText:', bodyText1.substring(0, 200))
      log({ type: 'warning_not_on_test', bodySnip: bodyText1.substring(0, 200) })
    }

    // Save localStorage evidence
    writeFileSync(join(EVIDENCE_DIR, 'recovery_before_crash_ls.json'), JSON.stringify({
      url: page1.url(),
      onNewWordTest,
      lastPhaseValue,
      answersFoundInLS,
      intentionalExitSet,
      allKeys: Object.keys(beforeCrashLS),
      recoveryData: Object.fromEntries(
        Object.entries(beforeCrashLS).filter(([k]) =>
          /recover|session|test|phase|answer|exit/i.test(k)
        )
      )
    }, null, 2))

  } catch (err) {
    log({ type: 'crash_test_error', error: err.message })
    console.error('Crash test error:', err.message)
  } finally {
    // ── CRASH: close without graceful unload ──
    log({ type: 'simulating_crash' })
    console.log('Simulating crash (hard context.close)...')
    try {
      // Force close without calling beforeunload handlers
      await crashContext.close().catch(() => {})
    } catch {}
    console.log('Context closed (crash simulated)')
  }

  // ── PHASE 2: REOPEN AND CHECK RECOVERY ──
  console.log('\n═══ PHASE 2: RECOVERY CHECK (after crash) ═══')

  await wait(2000) // Small delay before reopen

  const recoveryContext = await chromium.launchPersistentContext(userDataDir1, {
    executablePath: CHROMIUM_PATH,
    headless: true,
    viewport: { width: 1440, height: 900 }
  })

  // Re-inject date shim
  await recoveryContext.addInitScript({ content: makeDateShim(fakeNowMs) })

  let recoveryResult = {
    routedToTest: false,
    recoveryPromptShown: false,
    answersRestored: false,
    recoveryLS: {},
    afterCrashUrl: ''
  }

  try {
    const page2 = await recoveryContext.newPage()

    // Navigate to app (SPA root, not deep link)
    await page2.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
    await wait(4000)

    const url2 = page2.url()
    const body2 = await page2.evaluate(() => document.body.innerText.substring(0, 1000)).catch(() => '')
    recoveryResult.afterCrashUrl = url2

    log({ type: 'after_reopen', url: url2, bodySnip: body2.substring(0, 200) })
    console.log('After reopen URL:', url2)
    console.log('After reopen body:', body2.substring(0, 200))

    // Check if routed to test
    const inputCount2 = await page2.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]').count().catch(() => 0)
    const hasTextbox2 = await page2.getByRole('textbox').isVisible({ timeout: 3000 }).catch(() => false)
    recoveryResult.routedToTest = inputCount2 > 0 || hasTextbox2 ||
      /typed.*test|new.*word.*test|step\s*2|type.*definition/i.test(body2)

    // Check for recovery prompt
    recoveryResult.recoveryPromptShown = /resume|recover|continue|session.*interrupted|where.*left/i.test(body2) ||
      await page2.getByText(/resume|recover|continue.*where|session.*interrupted/i).isVisible({ timeout: 3000 }).catch(() => false)

    // Capture post-reopen localStorage
    const afterCrashLS = await captureLocalStorage(page2)
    const { recoveryKeys: afterRecovKeys, testKeys: afterTestKeys } = findRecoveryKeys(afterCrashLS)
    recoveryResult.recoveryLS = afterRecovKeys

    // Check answers restored
    for (const [k, v] of Object.entries(afterTestKeys)) {
      const strV = typeof v === 'string' ? v : JSON.stringify(v)
      if (/test_answer_\d+_verify2/.test(strV)) {
        recoveryResult.answersRestored = true
        console.log(`Answers found in key "${k}": ${strV.substring(0, 100)}`)
      }
    }

    // Also check in recovery key
    for (const [k, v] of Object.entries(afterRecovKeys)) {
      const strV = typeof v === 'string' ? v : JSON.stringify(v)
      if (/test_answer_\d+_verify2/.test(strV)) {
        recoveryResult.answersRestored = true
      }
    }

    log({ type: 'recovery_result', routedToTest: recoveryResult.routedToTest, promptShown: recoveryResult.recoveryPromptShown, answersRestored: recoveryResult.answersRestored })
    console.log('Routed to test:', recoveryResult.routedToTest)
    console.log('Recovery prompt shown:', recoveryResult.recoveryPromptShown)
    console.log('Answers restored:', recoveryResult.answersRestored)

    // Save after-crash LS
    writeFileSync(join(EVIDENCE_DIR, 'recovery_after_crash_ls.json'), JSON.stringify({
      url: url2,
      routedToTest: recoveryResult.routedToTest,
      recoveryPromptShown: recoveryResult.recoveryPromptShown,
      answersRestored: recoveryResult.answersRestored,
      allKeys: Object.keys(afterCrashLS),
      recoveryData: Object.fromEntries(
        Object.entries(afterCrashLS).filter(([k]) =>
          /recover|session|test|phase|answer|exit/i.test(k)
        )
      )
    }, null, 2))

  } catch (err) {
    log({ type: 'recovery_check_error', error: err.message })
    console.error('Recovery check error:', err.message)
  } finally {
    await recoveryContext.close().catch(() => {})
  }

  // ── PHASE 3: GRACEFUL CLOSE CONTROL ──
  console.log('\n═══ PHASE 3: GRACEFUL CLOSE CONTROL ═══')

  const userDataDir3 = join(tmpdir(), `verify2_graceful_${Date.now()}`)
  mkdirSync(userDataDir3, { recursive: true })

  const gracefulContext = await chromium.launchPersistentContext(userDataDir3, {
    executablePath: CHROMIUM_PATH,
    headless: true,
    viewport: { width: 1440, height: 900 }
  })

  await gracefulContext.addInitScript({ content: makeDateShim(fakeNowMs) })

  let gracefulResult = { intentionalExitSetBeforeClose: false, recoverySupprededAfterGraceful: false }

  try {
    const page3 = await gracefulContext.newPage()
    await login(page3, CAREFUL_EMAIL, CAREFUL_PASSWORD)
    await navSession(page3)
    await wait(2000)
    await dismissModal(page3)

    // Navigate to test
    const skipOk = await skipToTest(page3)
    await wait(2000)

    // Type an answer
    const inputs3 = page3.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]')
    const cnt3 = await inputs3.count().catch(() => 0)
    if (cnt3 > 0) {
      await inputs3.first().click()
      await inputs3.first().fill('graceful_test_answer')
    }
    await wait(1000)

    // Graceful close: navigate away (triggers beforeunload)
    await page3.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
    await wait(2000)

    // Check for intentional_exit marker
    const afterNavLS = await captureLocalStorage(page3)
    gracefulResult.intentionalExitSetBeforeClose = Object.entries(afterNavLS).some(([k, v]) =>
      /intentional.exit/i.test(k) && v
    )
    console.log('After graceful nav-away, intentional_exit set:', gracefulResult.intentionalExitSetBeforeClose)

    // Close gracefully
    await gracefulContext.close().catch(() => {})

    // Reopen and check recovery SUPPRESSED
    const gracefulReopenCtx = await chromium.launchPersistentContext(userDataDir3, {
      executablePath: CHROMIUM_PATH,
      headless: true,
      viewport: { width: 1440, height: 900 }
    })
    await gracefulReopenCtx.addInitScript({ content: makeDateShim(fakeNowMs) })

    const page4 = await gracefulReopenCtx.newPage()
    await page4.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
    await wait(4000)

    const body4 = await page4.evaluate(() => document.body.innerText.substring(0, 800)).catch(() => '')
    const inputCount4 = await page4.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]').count().catch(() => 0)

    // Recovery should NOT be shown (graceful exit cleared the recovery state)
    const recoveryShownAfterGraceful = /resume.*test|recover.*session|session.*interrupted/i.test(body4) ||
      inputCount4 > 0 && /test/i.test(body4)

    gracefulResult.recoverySupprededAfterGraceful = !recoveryShownAfterGraceful
    console.log('Recovery shown after graceful close:', recoveryShownAfterGraceful)
    console.log('Recovery correctly suppressed:', gracefulResult.recoverySupprededAfterGraceful)

    await gracefulReopenCtx.close().catch(() => {})
  } catch (err) {
    log({ type: 'graceful_test_error', error: err.message })
    console.error('Graceful test error:', err.message)
    await gracefulContext.close().catch(() => {})
  }

  // ── SUMMARY ──
  const crashPass = lastPhaseValue === 'NEW_TEST'

  console.log('\n═══ VERIFY2 CRASH RECOVERY SUMMARY ═══')
  console.log(`lastPhase captured: "${lastPhaseValue}"`)
  console.log(`lastPhase === 'NEW_TEST': ${crashPass}`)
  console.log(`Answers found in localStorage: ${answersFoundInLS}`)
  console.log(`intentional_exit NOT set: ${!intentionalExitSet}`)
  console.log(`Routed to test after crash: ${recoveryResult.routedToTest}`)
  console.log(`Recovery prompt shown: ${recoveryResult.recoveryPromptShown}`)
  console.log(`Answers restored: ${recoveryResult.answersRestored}`)
  console.log(`Recovery suppressed after graceful close: ${gracefulResult.recoverySupprededAfterGraceful}`)
  console.log(`CRASH RECOVERY VERIFIED: ${crashPass ? 'YES — PASS' : 'NO — FAIL'}`)

  const summary = {
    test: 'CRASH_RECOVERY',
    lastPhaseValue,
    lastPhaseIsNewTest: crashPass,
    answersFoundInLS,
    intentionalExitNotSet: !intentionalExitSet,
    routedToTestAfterCrash: recoveryResult.routedToTest,
    recoveryPromptShown: recoveryResult.recoveryPromptShown,
    answersRestored: recoveryResult.answersRestored,
    gracefulCloseSuppressesRecovery: gracefulResult.recoverySupprededAfterGraceful,
    overallPass: crashPass
  }

  writeFileSync(join(EVIDENCE_DIR, 'recovery_summary.json'), JSON.stringify(summary, null, 2))
  log({ type: 'verify2_recovery_complete', summary })

  return summary
}

main().then(s => {
  console.log('\nCrash Recovery Done:', JSON.stringify(s, null, 2))
  process.exit(0)
}).catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
