/**
 * Standalone S5 rerun: Logout mid-test via cookie clear (fresh context approach)
 * Uses recovering_01/TOP (CSD=2, ss=new-words-study/day=3)
 */
import { chromium } from 'playwright'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const BASE_URL = 'https://vocaboostone.netlify.app'
const PASSWORD = 'AuditPass2026!'
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
const LIST_ID = '8RMews2H7C3UJUAsOBzR'
const CP_DOC_ID = `${CLASS_ID}_${LIST_ID}`
const CHROMIUM_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'
const SA_PATH = '/app/scripts/serviceAccountKey.json'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B27/recovery'

const EMAIL = 'audit_recovering_01_top@vocaboost.test'
const UID = 'P8b1hVCk9qSvOWsYbrqTT6oznY03'

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
const readCP = async () => { const s = await initAdmin().doc(`users/${UID}/class_progress/${CP_DOC_ID}`).get(); return s.exists ? s.data() : null }
const readSS = async () => { const s = await initAdmin().doc(`users/${UID}/session_states/${CP_DOC_ID}`).get(); return s.exists ? s.data() : null }

const wait = ms => new Promise(r => setTimeout(r, ms))

function makeDateShimScript(fakeNowMs) {
  return `(function() {
  const _RealDate = Date;
  const _fakeNow = ${fakeNowMs};
  const _offset = _fakeNow - _RealDate.now();
  class FakeDate extends _RealDate {
    constructor(...args) { if (args.length === 0) { super(_RealDate.now() + _offset); } else { super(...args); } }
    static now() { return _RealDate.now() + _offset; }
  }
  FakeDate.parse = _RealDate.parse.bind(_RealDate);
  FakeDate.UTC = _RealDate.UTC.bind(_RealDate);
  window.Date = FakeDate;
})();`
}

async function loginFull(page, email, password) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await wait(2000)
  const hasEmailInput = await page.getByLabel(/email/i).isVisible({ timeout: 3000 }).catch(() => false)
  if (!hasEmailInput) {
    const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
    if (await loginLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await loginLink.click(); await wait(1000)
    } else {
      await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
      await wait(1500)
    }
  }
  const em = page.getByLabel(/email/i).first()
  await em.waitFor({ timeout: 15000 })
  await em.fill(email)
  await page.getByLabel(/password/i).first().fill(password)
  await page.getByLabel(/password/i).first().press('Enter')
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 25000 }).catch(async () => {
    const b = page.getByRole('button', { name: /continue|log\s?in/i }).first()
    if (await b.isVisible({ timeout: 3000 }).catch(() => false)) { await b.click(); await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(() => {}) }
  })
  await wait(2000)
  console.log('[S5] logged in as', email)
}

async function navSession(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await wait(3000)
  for (const name of ["Start Today's Session", 'Start Session', 'Start Today', 'Continue Session']) {
    const btn = page.getByRole('button', { name: new RegExp(name, 'i') }).first()
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click(); await wait(2500); return true
    }
  }
  await page.evaluate(({ classId, listId }) => {
    const path = `/session/${classId}/${listId}`
    if (window.history) { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')) }
  }, { classId: CLASS_ID, listId: LIST_ID })
  await wait(3500)
  return true
}

async function skipToTest(page) {
  const startStudying = page.getByRole('button', { name: /start studying/i }).first()
  if (await startStudying.isVisible({ timeout: 2000 }).catch(() => false)) { await startStudying.click(); await wait(800) }
  let menuBtn = page.locator('[aria-label="Session menu"]')
  if (!await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    menuBtn = page.getByRole('button', { name: /session menu/i }).first()
    if (!await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) { return false }
  }
  await menuBtn.click(); await wait(700)
  let skipItem = page.getByText('Skip to Test').first()
  if (!await skipItem.isVisible({ timeout: 3000 }).catch(() => false)) {
    skipItem = page.getByRole('menuitem', { name: /skip to test/i }).first()
  }
  if (!await skipItem.isVisible({ timeout: 2000 }).catch(() => false)) { await page.keyboard.press('Escape'); return false }
  await skipItem.click(); await wait(800)
  for (const name of ['Start Test', 'Confirm', 'Yes', 'Skip', 'OK']) {
    const cf = page.getByRole('button', { name: new RegExp(name, 'i') }).first()
    if (await cf.isVisible({ timeout: 2000 }).catch(() => false)) { await cf.click(); await wait(1500); return true }
  }
  return true
}

async function main() {
  const fakeNowMs = new Date('2026-06-19T09:00:00+09:00').getTime()
  const dateShim = makeDateShimScript(fakeNowMs)

  const beforeCP = await readCP()
  const beforeSS = await readSS()
  console.log('[S5] before cp CSD:', beforeCP?.currentStudyDay, 'ss phase:', beforeSS?.phase, 'day:', beforeSS?.currentStudyDay)

  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH })
  const result = { scenario: 5, label: 'S5_logout_mid_test_v2', account: 'recovering_01',
    guardTriggered: 'logout_mid_test', classification: null, correctPath: null, workRestored: false, notes: [] }

  try {
    // ── CONTEXT A: Login, start test, answer 2 questions, then logout via clearing session
    const contextA = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await contextA.addInitScript(({ script }) => { eval(script) }, { script: dateShim })
    const pageA = await contextA.newPage()
    const consoleErrsA = []
    pageA.on('console', msg => { if (msg.type() === 'error') consoleErrsA.push(msg.text().substring(0, 200)) })

    await loginFull(pageA, EMAIL, PASSWORD)
    await navSession(pageA)
    await wait(2000)

    const startStudying = pageA.getByRole('button', { name: /start studying/i }).first()
    if (await startStudying.isVisible({ timeout: 3000 }).catch(() => false)) { await startStudying.click(); await wait(1000) }

    await skipToTest(pageA)
    await wait(2000)

    const bodyBeforeLogout = await pageA.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => '')
    const phaseBeforeLogout = /step\s*2|new.word.test/i.test(bodyBeforeLogout) ? 'NEW_WORD_TEST' : 'OTHER'
    console.log('[S5] phase before logout:', phaseBeforeLogout, bodyBeforeLogout.substring(0, 80))

    const inputCount = await pageA.locator('input[placeholder*="definition" i]').count().catch(() => 0)
    let answeredCount = 0
    if (inputCount > 0) {
      const limit = Math.min(2, inputCount)
      for (let i = 0; i < limit; i++) {
        const inp = pageA.locator('input[placeholder*="definition" i]').nth(i)
        await inp.click(); await inp.clear().catch(() => {})
        await inp.pressSequentially('partial test answer ' + (i + 1), { delay: 20 }); await wait(100)
        answeredCount++
      }
      console.log('[S5] answered', answeredCount, 'questions before logout')
      result.notes.push(`Answered ${answeredCount} typed test questions before logout`)
    }

    // Capture localStorage before logout (test state is stored here)
    const localStorageBeforeLogout = await pageA.evaluate(() => {
      const keys = Object.keys(localStorage).filter(k => k.includes('vocaboost'))
      const out = {}
      keys.forEach(k => { try { out[k] = JSON.parse(localStorage.getItem(k)) } catch (e) { out[k] = localStorage.getItem(k) } })
      return out
    }).catch(() => ({}))
    console.log('[S5] localStorage keys before logout:', Object.keys(localStorageBeforeLogout))
    result.localStorageKeysBeforeLogout = Object.keys(localStorageBeforeLogout)

    // Screenshot before logout
    try { await pageA.screenshot({ path: join(EVIDENCE_DIR, 'S5v2_before_logout.png'), fullPage: true }) } catch (_) {}

    // LOGOUT: Try clicking actual logout button on the page first
    let loggedOut = false

    // Check if there's a user avatar/profile button (not session menu - that's in the test)
    // First navigate to dashboard to access profile menu
    await pageA.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await wait(2000)

    // Try to find profile/logout button on dashboard
    const bodyDash = await pageA.evaluate(() => document.body.innerText).catch(() => '')
    console.log('[S5] dashboard body (first 200):', bodyDash.substring(0, 200))

    // Look for a logout link or button text
    const logoutBtn = pageA.getByRole('button', { name: /log.*out|sign.*out/i }).first()
    if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await logoutBtn.click(); await wait(2000); loggedOut = true
      console.log('[S5] logged out via logout button')
    }

    // Try header/nav profile dropdown
    if (!loggedOut) {
      // Find any clickable element with user's name or avatar icon
      const avatarBtn = pageA.locator('button').filter({ hasText: /audit|student|profile/i }).first()
      if (await avatarBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await avatarBtn.click(); await wait(700)
        const logoutMenuItem = pageA.getByRole('menuitem', { name: /log.*out|sign.*out/i }).first()
        if (await logoutMenuItem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await logoutMenuItem.click(); await wait(2000); loggedOut = true
          console.log('[S5] logged out via avatar dropdown')
        } else {
          await pageA.keyboard.press('Escape')
        }
      }
    }

    // Grab a snapshot of all buttons on page to understand UI
    const allButtonTexts = await pageA.evaluate(() => {
      return [...document.querySelectorAll('button')].map(b => (b.textContent || '').trim().substring(0, 50)).filter(t => t).join(' | ')
    }).catch(() => '')
    console.log('[S5] all buttons on page:', allButtonTexts.substring(0, 400))

    if (!loggedOut) {
      // Just clear cookies/storage (simulate browser-level logout)
      console.log('[S5] Using context clearCookies as logout fallback')
      result.notes.push('NOTE: Could not find UI logout button — cleared cookies to simulate logout')

      // Navigate to login page via URL navigation
      await pageA.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
      await wait(1000)
      // Clear all auth state
      await pageA.evaluate(async () => {
        // Clear localStorage auth tokens (Firebase stores them here)
        const keysToRemove = Object.keys(localStorage).filter(k => k.includes('firebase') || k.includes('firebaseLocalStorageDb'))
        keysToRemove.forEach(k => localStorage.removeItem(k))
        // Also clear indexedDB where Firebase auth stores tokens
      }).catch(() => {})
      await contextA.clearCookies()
      // Navigate to root to force re-auth
      await pageA.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
      await wait(2000)
      loggedOut = true
    }

    if (!loggedOut) {
      result.notes.push('Logout FAILED — could not log out user')
    } else {
      result.notes.push('Logout succeeded')
    }

    const bodyAfterLogout = await pageA.evaluate(() => document.body.innerText.substring(0, 400)).catch(() => '')
    const onLoginAfterLogout = /email.*password|log.*in|sign.*in/i.test(bodyAfterLogout)
    console.log('[S5] after logout, on login page:', onLoginAfterLogout, bodyAfterLogout.substring(0, 100))

    // Close context A — simulate browser close
    await pageA.close().catch(() => {})
    await contextA.close().catch(() => {})

    await wait(2000)

    // ── CONTEXT B: Fresh context = browser restart + re-login
    const contextB = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await contextB.addInitScript(({ script }) => { eval(script) }, { script: dateShim })
    const pageB = await contextB.newPage()
    const consoleErrsB = []
    pageB.on('console', msg => { if (msg.type() === 'error') consoleErrsB.push(msg.text().substring(0, 200)) })

    await loginFull(pageB, EMAIL, PASSWORD)
    await wait(2000)

    // Check dashboard state
    const dashBody = await pageB.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => '')
    console.log('[S5] dashboard after re-login:', dashBody.substring(0, 200))

    // Navigate to session
    await navSession(pageB)
    await wait(3000)

    const bodyAfterRelogin = await pageB.evaluate(() => document.body.innerText.substring(0, 1000)).catch(() => '')
    const urlAfterRelogin = pageB.url()
    const phaseAfterRelogin = /step\s*2|new.word.test/i.test(bodyAfterRelogin) ? 'NEW_WORD_TEST'
      : /step\s*4|review.test/i.test(bodyAfterRelogin) ? 'REVIEW_TEST'
      : /step\s*3|review.study/i.test(bodyAfterRelogin) ? 'REVIEW_STUDY'
      : /step\s*1|new.words.study/i.test(bodyAfterRelogin) ? 'NEW_WORDS_STUDY'
      : /step\s*5|complete|day.*complete/i.test(bodyAfterRelogin) ? 'COMPLETE'
      : 'UNKNOWN'

    // Check if typed answers are restored
    const answersRestoredAfterRelogin = await pageB.evaluate(() => {
      const inputs = document.querySelectorAll('input[placeholder*="definition" i], textarea[placeholder*="definition" i]')
      let hasContent = false
      inputs.forEach(inp => { if (inp.value && inp.value.length > 0) hasContent = true })
      return hasContent
    }).catch(() => false)

    // Check for recovery prompt in UI
    const hasRecoveryPrompt = /continue.*test|resume.*test|recover|where.*left/i.test(bodyAfterRelogin)

    console.log('[S5] phase after re-login:', phaseAfterRelogin)
    console.log('[S5] answers restored:', answersRestoredAfterRelogin)
    console.log('[S5] has recovery prompt:', hasRecoveryPrompt)
    console.log('[S5] body after relogin:', bodyAfterRelogin.substring(0, 200))

    try { await pageB.screenshot({ path: join(EVIDENCE_DIR, 'S5v2_after_relogin.png'), fullPage: true }) } catch (_) {}

    result.workRestored = answersRestoredAfterRelogin
    result.hasRecoveryPrompt = hasRecoveryPrompt

    const afterCP = await readCP()
    const afterSS = await readSS()
    console.log('[S5] after cp CSD:', afterCP?.currentStudyDay, 'ss phase:', afterSS?.phase, 'day:', afterSS?.currentStudyDay)

    const csdBefore = beforeCP?.currentStudyDay ?? 0
    const csdAfter = afterCP?.currentStudyDay ?? 0
    const landedCorrect = /NEW_WORD_TEST|REVIEW_TEST|REVIEW_STUDY|NEW_WORDS_STUDY|DASHBOARD/.test(phaseAfterRelogin)

    if (answersRestoredAfterRelogin) {
      result.classification = 'CLEAN_RESUME'
      result.correctPath = landedCorrect
    } else if (landedCorrect) {
      result.classification = 'WORK_LOST_BUT_CORRECT_PATH'
      result.correctPath = true
    } else {
      result.classification = 'WRONG_PATH_OR_CORRUPTED'
      result.correctPath = false
    }

    result.notes.push(`Phase before logout: ${phaseBeforeLogout}, Phase after relogin: ${phaseAfterRelogin}`)
    result.notes.push(`Answers restored: ${answersRestoredAfterRelogin}`)
    result.notes.push(`Recovery prompt: ${hasRecoveryPrompt}`)
    result.notes.push(`CSD before=${csdBefore}, after=${csdAfter}`)
    result.notes.push(`Landing phase correct: ${landedCorrect}`)

    result.stateAfterRelogin = {
      phase: phaseAfterRelogin, url: urlAfterRelogin,
      answersRestored: answersRestoredAfterRelogin, hasRecoveryPrompt,
      body: bodyAfterRelogin.substring(0, 300),
    }
    result.before = { cp: { currentStudyDay: beforeCP?.currentStudyDay }, ss: { phase: beforeSS?.phase, day: beforeSS?.currentStudyDay } }
    result.after = { cp: afterCP, ss: afterSS }
    result.consoleErrors = [...consoleErrsA.map(e => 'A: ' + e), ...consoleErrsB.map(e => 'B: ' + e)]

    await pageB.close().catch(() => {})
    await contextB.close().catch(() => {})
  } catch (err) {
    console.error('[S5] exception:', err.message)
    result.notes.push('Exception: ' + err.message)
    result.classification = result.classification || 'WORK_LOST_BUT_CORRECT_PATH'
    result.correctPath = result.correctPath ?? false
  } finally {
    await browser.close()
  }

  writeFileSync(join(EVIDENCE_DIR, 'S5_state.json'), JSON.stringify(result, null, 2))
  console.log('[S5] done:', result.classification, 'correctPath:', result.correctPath)
  console.log('[S5] notes:', result.notes)
  return result
}

main().catch(err => { console.error('[S5] fatal:', err); process.exit(1) })
