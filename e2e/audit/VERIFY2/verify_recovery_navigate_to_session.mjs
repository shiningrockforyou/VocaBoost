/**
 * VERIFY2 — Recovery prompt check: after crash, navigate to session URL
 * to see if recovery prompt appears when entering the session with stored recovery data.
 *
 * The crash recovery test showed:
 * - localStorage has lastPhase='NEW_TEST' and answers stored (correct)
 * - But after reopen → dashboard, no auto-prompt
 *
 * Now test: after reopen → click "Start Session" → does recovery prompt appear?
 * OR: the session_states.phase in Firestore might need to be checked.
 */

import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EMAIL = 'audit_lazy_01_top@vocaboost.test'
const PASSWORD = 'AuditPass2026!'
const UID = 'VBgBmlrlzXVPzURmABkdDBGtKd42'
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
const LIST_ID = '8RMews2H7C3UJUAsOBzR'
const CHROMIUM_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/VERIFY2'
const AGENT_LOGS_DIR = '/app/audit/playwright/findings/agent_logs'
const JSONL_PATH = join(AGENT_LOGS_DIR, 'VERIFY2.jsonl')

mkdirSync(EVIDENCE_DIR, { recursive: true })
mkdirSync(AGENT_LOGS_DIR, { recursive: true })

function log(ev) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...ev })
  try { appendFileSync(JSONL_PATH, line + '\n') } catch (_) {}
  console.log('[VERIFY2-REC-NAV]', JSON.stringify(ev).substring(0, 300))
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

async function main() {
  // We need a userDataDir that has the crash state from the previous test
  // Instead, let's simulate a fresh crash state by:
  // 1. Create persistent context
  // 2. Login, reach test, type answers (set lastPhase=NEW_TEST in LS)
  // 3. Hard crash
  // 4. Reopen, login, go to dashboard
  // 5. Click "Start Session"
  // 6. Check if recovery prompt appears in the session flow

  const fakeNowMs = new Date('2026-07-14T09:00:00+09:00').getTime()
  const userDataDir = join(tmpdir(), `verify2_rec_nav_${Date.now()}`)
  mkdirSync(userDataDir, { recursive: true })

  // Phase 1: Setup crash state
  console.log('Setting up crash state...')
  const setupCtx = await chromium.launchPersistentContext(userDataDir, {
    executablePath: CHROMIUM_PATH,
    headless: true,
    viewport: { width: 1440, height: 900 }
  })
  await setupCtx.addInitScript({ content: makeDateShim(fakeNowMs) })

  let setupPage = await setupCtx.newPage()

  try {
    // Login
    await setupPage.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
    await wait(2000)
    const loginLink = setupPage.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
    if (await loginLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await loginLink.click()
      await wait(1000)
    }
    const hasEmail = await setupPage.getByLabel(/email/i).isVisible({ timeout: 5000 }).catch(() => false)
    if (hasEmail) {
      await setupPage.getByLabel(/email/i).first().fill(EMAIL)
      await setupPage.getByLabel(/password/i).first().fill(PASSWORD)
      await setupPage.getByLabel(/password/i).first().press('Enter')
      await setupPage.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(() => {})
    }
    await wait(2000)
    log({ type: 'logged_in_setup' })

    // Navigate to session
    await setupPage.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await wait(3000)

    // Handle resume modal
    const body0 = await setupPage.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => '')
    let sessionBtn = setupPage.getByRole('button', { name: /start.*session|start today/i }).first()

    if (await sessionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sessionBtn.click()
      await wait(2000)
    } else {
      await setupPage.goto(`${BASE_URL}/session/${CLASS_ID}/${LIST_ID}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
      await wait(3000)
    }

    const body1 = await setupPage.evaluate(() => document.body.innerText.substring(0, 800)).catch(() => '')
    log({ type: 'session_state', bodySnip: body1.substring(0, 150) })

    if (/resume.*day\s*\d|move.*on.*next/i.test(body1)) {
      const moveOnBtn = setupPage.getByRole('button', { name: /move on.*next|next day/i }).first()
      if (await moveOnBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await moveOnBtn.click()
        await wait(3000)
        // Start session again
        const newBody = await setupPage.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => '')
        if (/dashboard/i.test(newBody)) {
          sessionBtn = setupPage.getByRole('button', { name: /start.*session|start today/i }).first()
          if (await sessionBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await sessionBtn.click()
            await wait(2500)
          }
        }
      }
    }

    // Dismiss study modal
    const startStudying = setupPage.getByRole('button', { name: /start studying/i }).first()
    if (await startStudying.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startStudying.click()
      await wait(800)
    }

    // Skip to test
    let menuBtn = setupPage.locator('[aria-label="Session menu"]')
    if (!await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      menuBtn = setupPage.getByRole('button', { name: /session menu/i }).first()
    }
    if (await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await menuBtn.click()
      await wait(700)
      const skipItem = setupPage.getByText('Skip to Test').first()
      if (await skipItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await skipItem.click()
        await wait(800)
        const cf = setupPage.getByRole('button', { name: /start test|confirm|yes/i }).first()
        if (await cf.isVisible({ timeout: 2000 }).catch(() => false)) {
          await cf.click()
          await wait(2000)
        }
      } else {
        await setupPage.keyboard.press('Escape')
      }
    }

    // Type answers
    const inputs = setupPage.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]')
    const cnt = await inputs.count().catch(() => 0)
    log({ type: 'inputs_found', count: cnt })
    for (let i = 0; i < Math.min(3, cnt); i++) {
      await inputs.nth(i).click()
      await inputs.nth(i).fill(`recovery_nav_test_answer_${i + 1}`)
      await wait(200)
    }
    await wait(1500)

    const lsBefore = await captureLocalStorage(setupPage)
    const sessionKey = Object.keys(lsBefore).find(k => /vocaboost_session/.test(k))
    const testKey = Object.keys(lsBefore).find(k => /vocaboost_test/.test(k))
    log({ type: 'ls_before_crash', sessionKey, testKey, sessionVal: sessionKey ? JSON.stringify(lsBefore[sessionKey]).substring(0, 200) : null })
    console.log('sessionKey:', sessionKey, 'testKey:', testKey)

    if (sessionKey) {
      const sessionData = lsBefore[sessionKey]
      console.log('lastPhase in session data:', typeof sessionData === 'object' ? sessionData.lastPhase : 'not object')
    }
  } catch (err) {
    console.error('Setup error:', err.message)
  } finally {
    await setupCtx.close().catch(() => {})
    console.log('Crashed (context closed)')
  }

  // Phase 2: Reopen, login, navigate to session, check recovery
  await wait(1500)
  console.log('\nReopening after crash...')

  const reopenCtx = await chromium.launchPersistentContext(userDataDir, {
    executablePath: CHROMIUM_PATH,
    headless: true,
    viewport: { width: 1440, height: 900 }
  })
  await reopenCtx.addInitScript({ content: makeDateShim(fakeNowMs) })

  try {
    const page2 = await reopenCtx.newPage()
    await page2.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
    await wait(4000)

    const body2 = await page2.evaluate(() => document.body.innerText.substring(0, 800)).catch(() => '')
    const url2 = page2.url()
    log({ type: 'after_reopen', url: url2, bodySnip: body2.substring(0, 200) })
    console.log('After reopen URL:', url2)
    console.log('Body:', body2.substring(0, 200))

    // Check LS
    const ls2 = await captureLocalStorage(page2)
    const sessionKey2 = Object.keys(ls2).find(k => /vocaboost_session/.test(k))
    console.log('Session LS key present:', !!sessionKey2)

    // Now navigate to session to trigger recovery
    const startBtn = page2.getByRole('button', { name: /start.*session|start today/i }).first()
    if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startBtn.click()
      await wait(3000)
    } else {
      // Client-side nav to session
      await page2.evaluate(({ classId, listId }) => {
        window.history.pushState({}, '', `/session/${classId}/${listId}`)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }, { classId: CLASS_ID, listId: LIST_ID })
      await wait(3000)
    }

    const body3 = await page2.evaluate(() => document.body.innerText.substring(0, 1200)).catch(() => '')
    const url3 = page2.url()
    log({ type: 'after_session_nav', url: url3, bodySnip: body3.substring(0, 300) })
    console.log('After session nav URL:', url3)
    console.log('Body:', body3.substring(0, 300))

    // Check for recovery indicators
    const recoveryPromptShown = /resume.*test|recover.*answers|session.*interrupted|where you left|restore.*answer/i.test(body3) ||
      await page2.getByText(/resume.*test|recover.*answers|session.*interrupted/i).isVisible({ timeout: 3000 }).catch(() => false)
    const inputCount3 = await page2.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]').count().catch(() => 0)
    const routedToTest = inputCount3 > 0

    // Check if answers are pre-filled
    let answersPreFilled = false
    if (routedToTest) {
      const firstInput = page2.locator('input[placeholder*="definition" i], textarea[placeholder*="definition" i]').first()
      const firstVal = await firstInput.inputValue().catch(() => '')
      answersPreFilled = /recovery_nav_test_answer/i.test(firstVal)
      console.log('First input value:', firstVal.substring(0, 50))
    }

    log({ type: 'session_recovery_check', recoveryPromptShown, routedToTest, answersPreFilled, inputCount: inputCount3 })
    console.log('Recovery prompt shown:', recoveryPromptShown)
    console.log('Routed to test (inputs present):', routedToTest)
    console.log('Answers pre-filled:', answersPreFilled)

    // Save results
    writeFileSync(join(EVIDENCE_DIR, 'recovery_nav_session_check.json'), JSON.stringify({
      afterReopenUrl: url2,
      afterSessionNavUrl: url3,
      sessionKeyInLS: sessionKey2,
      recoveryPromptShown,
      routedToTest,
      answersPreFilled,
      inputCount: inputCount3,
      bodySnip: body3.substring(0, 400)
    }, null, 2))

    console.log('\nSUMMARY: Recovery after navigating to session:')
    console.log('  Recovery prompt:', recoveryPromptShown ? 'YES' : 'NO')
    console.log('  Routed to test:', routedToTest ? 'YES' : 'NO')
    console.log('  Answers pre-filled:', answersPreFilled ? 'YES' : 'NO')

  } finally {
    await reopenCtx.close().catch(() => {})
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
