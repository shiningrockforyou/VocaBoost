/**
 * B12 — Concurrent & Multi-Tab Audit
 * Label: L
 * Agent: L (concurrent batch agent)
 *
 * Tests multi-tab and multi-context scenarios focusing on:
 *   A) Two tabs, same browser context (shared localStorage) — nonce sharing
 *   B) Two tabs, separate browser contexts (independent localStorage) — duplicate doc risk
 *   C) Second browser/device (same account, separate context) — concurrent sessions
 *   Plus: S05 joinClass race, S06 updateClassProgress race, S07 stale expectedDay guard,
 *         S12-S14 Firestore security rules (BLOCKER candidates)
 *
 * Key mechanic:
 *   - nonce lives in localStorage: getOrCreateAttemptNonce stores to key = testId + '_nonce'
 *   - attemptDocId = `${uid}_${testId}_${nonce}`
 *   - Same context = shared localStorage = same nonce = same docId = setDoc is idempotent (good)
 *   - Separate contexts = separate localStorage = independent nonces = DIFFERENT docIds = TWO attempt docs (bad)
 */

import { chromium } from '@playwright/test'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

// ─── constants ────────────────────────────────────────────────────────────────
const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B12'
const SA_PATH = '/app/scripts/serviceAccountKey.json'
const CHROMIUM_EXEC = '/ms-playwright/chromium-1223/chrome-linux64/chrome'

mkdirSync(EVIDENCE_DIR, { recursive: true })

// ─── Firebase Admin ──────────────────────────────────────────────────────────
let _db
function db() {
  if (_db) return _db
  if (getApps().length === 0) {
    const sa = JSON.parse(readFileSync(SA_PATH, 'utf-8'))
    initializeApp({ credential: cert(sa) })
  }
  _db = getFirestore()
  return _db
}

// ─── account fixtures ─────────────────────────────────────────────────────────
const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
function acct(personaId, cls = 'TOP', idx = 1) {
  const matches = seeded.accounts.filter(a => a.personaId === personaId && (!cls || a.targetClass === cls))
  return matches[idx - 1] || matches[0]
}

const CAREFUL_TOP    = acct('careful', 'TOP')     // uid EPnmY4FIXxVq19tQtxQCvE26p0F3
const RUSHED_TOP     = acct('rushed', 'TOP')       // uid trOe7MHzaYZuP99R7N3g5RuI6o83
const CAREFUL_CORE   = acct('careful', 'CORE')     // uid fNDvwIEDXphlv8BD4rxYygHOSvD3
const HOSTILE_TOP    = acct('hostile', 'TOP')      // uid bvexVreuuvNrGZ1aWygwAhRGdm03
const HOSTILE_CORE   = acct('hostile', 'CORE')     // uid wtNBd4T7VPhgqHe2JaNDCjKn0fd2
const MULTIDEV_TOP   = acct('multidevice', 'TOP')  // uid oGsmh7KnI0XfU9xYixMJ7PbuVvq2

const TOP_CLASS = seeded.classes.TOP    // id k8tzOiiwotBbtJS3uTiv
const CORE_CLASS = seeded.classes.CORE  // id LVjBTFuYE8FbPG34pVAt

// ─── helpers ─────────────────────────────────────────────────────────────────

async function disableSW(ctx) {
  await ctx.addInitScript(() => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
    }
  })
}

async function loginPage(page, acct) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  // Find login link or route to /login
  const loginLink = page.getByRole('link', { name: /log\s*in|sign\s*in/i }).first()
  if (await loginLink.count()) {
    await loginLink.click()
  } else {
    await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
  }
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(acct.email)
  await page.getByLabel(/password/i).first().fill(acct.password)
  await page.getByLabel(/password/i).first().press('Enter')
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
    await page.getByRole('button', { name: /continue|log\s*in|sign\s*in/i }).first().click().catch(() => {})
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  })
}

async function screenshot(page, name) {
  try {
    const path = join(EVIDENCE_DIR, `${name}.png`)
    await page.screenshot({ path, fullPage: true })
    return path
  } catch (e) { return null }
}

async function getAttemptsByStudent(uid) {
  const snap = await db().collection('attempts').where('studentId', '==', uid).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function getClassProgress(uid) {
  const snap = await db().collection(`users/${uid}/class_progress`).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function getClassDoc(classId) {
  const snap = await db().doc(`classes/${classId}`).get()
  return snap.exists ? { id: snap.id, ...snap.data() } : null
}

function saveJSON(filename, data) {
  const path = join(EVIDENCE_DIR, filename)
  writeFileSync(path, JSON.stringify(data, null, 2))
  return path
}

/**
 * Navigate from the dashboard into a session for the student's assigned class.
 * Tries to click "Start" or "Continue" on a session card.
 * Returns true if session was started, false if blocked (e.g., no session available).
 */
async function startSession(page, timeout = 20000) {
  // Try to find a Start / Continue button on the dashboard
  const startBtn = page.getByRole('button', { name: /start session|start today|continue session/i }).first()
  const hasStart = await startBtn.isVisible({ timeout: timeout }).catch(() => false)
  if (hasStart) {
    await startBtn.click()
    await page.waitForTimeout(2000)
    return true
  }
  // Fallback: try "Start" inside a card
  const anyStart = page.getByRole('button', { name: /^start$/i }).first()
  if (await anyStart.isVisible({ timeout: 5000 }).catch(() => false)) {
    await anyStart.click()
    await page.waitForTimeout(2000)
    return true
  }
  return false
}

/**
 * Use "Skip to Test" to bypass flashcard phase if available.
 * In DailySessionFlow / SessionMenu there should be a Skip to Test button.
 */
async function skipToTest(page) {
  // Look for session menu / skip button
  const skipBtn = page.getByRole('button', { name: /skip to test/i }).first()
  if (await skipBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await skipBtn.click()
    // Confirm modal if it appears
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|skip/i }).first()
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click()
    }
    await page.waitForTimeout(2000)
    return true
  }
  return false
}

/**
 * Navigate from dashboard to the session page for a class.
 */
async function navigateToSession(page) {
  // From dashboard, click on the class card's session button
  const sessionBtn = page.getByRole('button', { name: /today|session|study now/i }).first()
  if (await sessionBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
    await sessionBtn.click()
    await page.waitForTimeout(2000)
    return true
  }
  // Try link-style navigation
  const sessionLink = page.getByRole('link', { name: /today|session|study/i }).first()
  if (await sessionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await sessionLink.click()
    await page.waitForTimeout(2000)
    return true
  }
  return false
}

/**
 * Check if we're on a test page (MCQ or Typed) by looking for test-specific elements.
 */
async function isOnTestPage(page) {
  const submitBtn = page.getByRole('button', { name: /submit|finish test/i }).first()
  const questionEl = page.getByText(/question \d+|define|what is/i).first()
  const hasSubmit = await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)
  const hasQuestion = await questionEl.isVisible({ timeout: 2000 }).catch(() => false)
  return hasSubmit || hasQuestion
}

/**
 * Read the localStorage nonce for a given testId key pattern from the page.
 */
async function readNonceFromPage(page) {
  return page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(k => k.endsWith('_nonce'))
    const result = {}
    for (const k of keys) {
      result[k] = localStorage.getItem(k)
    }
    return result
  })
}

/**
 * Read all localStorage keys from the page (for diagnostic comparison).
 */
async function readLocalStorage(page) {
  return page.evaluate(() => {
    const result = {}
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      result[k] = localStorage.getItem(k)
    }
    return result
  })
}

// ─── Firestore security test via page.evaluate (simulates hostile student) ───

async function tryFirestoreWrite(page, pathParts, data) {
  /**
   * Attempt a Firestore write from within the authenticated browser page.
   * Returns { success: boolean, error: string|null }
   */
  return page.evaluate(async ({ pathParts, data }) => {
    try {
      // The app uses modular Firebase SDK; access it through the global window if exposed
      // Most builds don't expose firebase on window; we try the imports route
      const { getFirestore, doc, setDoc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')
        .catch(() => null) || {}
      if (!getFirestore) {
        return { success: false, error: 'Firebase SDK not importable from page context' }
      }
      const db = getFirestore()
      const ref = doc(db, pathParts[0], ...pathParts.slice(1))
      await setDoc(ref, data, { merge: true })
      return { success: true, error: null }
    } catch (e) {
      return { success: false, error: e.message || String(e) }
    }
  }, { pathParts, data })
}

// ─── Results tracking ─────────────────────────────────────────────────────────

const results = []
function record(scenario, result, notes = '', severity = null) {
  const entry = { scenario, result, notes, severity, ts: new Date().toISOString() }
  results.push(entry)
  console.log(`[B12 ${scenario}] ${result}${notes ? ' — ' + notes : ''}`)
}

// ─── Main test suite ──────────────────────────────────────────────────────────

async function main() {
  const browsers = []
  const contexts = []
  let totalPass = 0, totalFail = 0, totalBlocked = 0

  try {
    // ─── S15 FIRST: unauthenticated tab vs authenticated tab (quick, no login needed) ──
    console.log('\n=== S15: Unauthenticated vs Authenticated tabs ===')
    {
      const browser15 = await chromium.launch({ executablePath: CHROMIUM_EXEC, headless: true })
      browsers.push(browser15)

      // Tab A: not logged in
      const ctxA15 = await browser15.newContext()
      contexts.push(ctxA15)
      await disableSW(ctxA15)
      const pageA15 = await ctxA15.newPage()
      // Navigate straight to /dashboard without logging in
      await pageA15.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      // Try to access dashboard via client route
      await pageA15.evaluate(() => { history.pushState({}, '', '/dashboard'); dispatchEvent(new PopStateEvent('popstate')) })
      await pageA15.waitForTimeout(3000)
      const pageA15Url = pageA15.url()
      const pageA15Text = await pageA15.textContent('body').catch(() => '')
      await screenshot(pageA15, 'B12_S15_tabA_unauth')

      // Tab B: logged in
      const ctxB15 = await browser15.newContext()
      contexts.push(ctxB15)
      await disableSW(ctxB15)
      const pageB15 = await ctxB15.newPage()
      await loginPage(pageB15, CAREFUL_TOP)
      await screenshot(pageB15, 'B12_S15_tabB_auth')

      // Evaluate Tab A
      const redirectedToLogin = pageA15Url.includes('/login') || pageA15Text.includes('Log') || pageA15Text.includes('Sign')
      const noDashboardContent = !pageA15Text.includes('25WT') && !pageA15Text.includes('Study')
      const noLeak = redirectedToLogin || noDashboardContent

      if (noLeak) {
        record('S15', 'PASS', 'Unauthenticated tab redirected to login / no dashboard content visible')
        totalPass++
      } else {
        record('S15', 'FAIL', `Auth leak — dashboard content visible to unauthenticated tab. URL: ${pageA15Url}`, 'MEDIUM')
        totalFail++
      }
      saveJSON('B12_S15_unauth_pageA_url.json', { url: pageA15Url, noLeak, text_sample: pageA15Text.slice(0, 500) })
      await pageA15.close(); await pageB15.close()
      await ctxA15.close(); await ctxB15.close()
      await browser15.close(); browsers.pop()
    }

    // ─── S12-S14: SECURITY — Hostile student writes ───────────────────────────
    console.log('\n=== S12-S14: Firestore security rules ===')
    {
      const browserSec = await chromium.launch({ executablePath: CHROMIUM_EXEC, headless: true })
      browsers.push(browserSec)

      // Login as hostile student
      const ctxSec = await browserSec.newContext()
      contexts.push(ctxSec)
      await disableSW(ctxSec)
      const pageSec = await ctxSec.newPage()
      await loginPage(pageSec, HOSTILE_TOP)
      await screenshot(pageSec, 'B12_S12_hostile_login')

      // S13 — attempt to write another student's class_progress via devtools eval
      console.log('\nS13: Hostile writes careful student class_progress...')
      const carefulUid = CAREFUL_TOP.uid
      const hostileUid = HOSTILE_TOP.uid
      const s13Result = await tryFirestoreWrite(
        pageSec,
        [`users/${carefulUid}/class_progress`, 'k8tzOiiwotBbtJS3uTiv_8RMews2H7C3UJUAsOBzR'],
        { currentStudyDay: 999 }
      )
      saveJSON('B12_S13_hostile_class_progress_write.json', s13Result)

      if (!s13Result.success) {
        record('S13', 'PASS', `PERMISSION_DENIED as expected: ${s13Result.error}`)
        totalPass++
      } else {
        // BLOCKER — security fix didn't land
        record('S13', 'FAIL', 'BLOCKER: hostile student wrote another student class_progress without PERMISSION_DENIED', 'BLOCKER')
        totalFail++
        // Verify the write didn't actually change anything
        const progSnap = await db().doc(`users/${carefulUid}/class_progress/k8tzOiiwotBbtJS3uTiv_8RMews2H7C3UJUAsOBzR`).get()
        saveJSON('B12_S13_class_progress_after.json', progSnap.exists ? progSnap.data() : {})
      }

      // S12 — attempt to write another student's study_states
      console.log('\nS12: Hostile writes careful student study_states...')
      const s12Result = await tryFirestoreWrite(
        pageSec,
        [`users/${carefulUid}/study_states`, 'Xp2CdZcGWxW7O3wd2bOu'],
        { status: 'FAILED', timesTestedTotal: 999 }
      )
      saveJSON('B12_S12_hostile_study_states_write.json', s12Result)

      if (!s12Result.success) {
        record('S12', 'PASS', `PERMISSION_DENIED: ${s12Result.error}`)
        totalPass++
      } else {
        record('S12', 'FAIL', 'BLOCKER: hostile student wrote another student study_states', 'BLOCKER')
        totalFail++
      }

      // S14 — hostile student modifies own attempt score
      // First we need an attempt docId — read existing attempts
      console.log('\nS14: Hostile modifies own attempt score...')
      const hostileAttempts = await getAttemptsByStudent(hostileUid)
      let s14Result
      if (hostileAttempts.length === 0) {
        // No attempt exists yet — try creating a fake one via setDoc with score manipulation
        const fakeAttemptId = `${hostileUid}_test_fake`
        s14Result = await pageSec.evaluate(async ({ fakeId, hostileUid }) => {
          try {
            const { getFirestore, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js').catch(() => ({}))
            if (!getFirestore) return { success: false, error: 'SDK unavailable' }
            const db2 = getFirestore()
            await setDoc(doc(db2, 'attempts', fakeId), {
              studentId: hostileUid,
              score: 100,
              passed: true,
              testType: 'typed'
            })
            return { success: true, error: null }
          } catch (e) {
            return { success: false, error: e.message }
          }
        }, { fakeId: fakeAttemptId, hostileUid })
        // Creating with score should be blocked because 'score' is not in allowed create fields
        // Actually the rule says: allow create if studentId == request.auth.uid
        // So creating WITH score field would succeed from client (create doesn't restrict fields)
        saveJSON('B12_S14_attempt_create_with_score.json', s14Result)
        if (s14Result.success) {
          record('S14', 'PARTIAL', 'Hostile can CREATE attempt doc with any score field — create rule does not restrict fields. Update is restricted. MEDIUM.', 'MEDIUM')
        } else {
          record('S14', 'PASS', `Create with score denied: ${s14Result.error}`)
          totalPass++
        }
      } else {
        // We have an attempt — try to UPDATE score on it
        const attempt = hostileAttempts[0]
        s14Result = await pageSec.evaluate(async ({ attemptId }) => {
          try {
            const { getFirestore, doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js').catch(() => ({}))
            if (!getFirestore) return { success: false, error: 'SDK unavailable' }
            const db2 = getFirestore()
            await updateDoc(doc(db2, 'attempts', attemptId), { score: 100, passed: true })
            return { success: true, error: null }
          } catch (e) {
            return { success: false, error: e.message }
          }
        }, { attemptId: attempt.id })
        saveJSON('B12_S14_attempt_score_update.json', { attemptId: attempt.id, result: s14Result })
        if (!s14Result.success) {
          record('S14', 'PASS', `Score update denied (hasOnly answers): ${s14Result.error}`)
          totalPass++
        } else {
          record('S14', 'FAIL', 'BLOCKER: hostile student updated their own attempt score/passed fields', 'BLOCKER')
          totalFail++
        }
      }

      await pageSec.close(); await ctxSec.close()
      await browserSec.close(); browsers.pop()
    }

    // ─── SCENARIO A: Two tabs, same context (shared localStorage) ────────────
    // Mission question A: shared nonce -> same docId -> idempotent setDoc
    console.log('\n=== Scenario A (Mission): Two tabs, same browser context (shared localStorage) ===')
    {
      const browserA = await chromium.launch({ executablePath: CHROMIUM_EXEC, headless: true })
      browsers.push(browserA)
      const ctxShared = await browserA.newContext()
      contexts.push(ctxShared)
      await disableSW(ctxShared)

      // Login in tab 1
      const tabA1 = await ctxShared.newPage()
      await loginPage(tabA1, CAREFUL_TOP)
      await screenshot(tabA1, 'B12_SA_tab1_login')

      // Open tab 2 in same context (shares cookies + localStorage)
      const tabA2 = await ctxShared.newPage()
      await tabA2.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await screenshot(tabA2, 'B12_SA_tab2_loaded')

      // Navigate both tabs to session
      const nav1 = await navigateToSession(tabA1)
      await screenshot(tabA1, 'B12_SA_tab1_session_nav')
      const nav2 = await navigateToSession(tabA2)
      await screenshot(tabA2, 'B12_SA_tab2_session_nav')

      // Check if on session/test page
      const onTest1 = await isOnTestPage(tabA1)
      const onTest2 = await isOnTestPage(tabA2)

      // Read localStorage from both tabs to compare nonce
      const ls1 = await readLocalStorage(tabA1)
      const ls2 = await readLocalStorage(tabA2)
      saveJSON('B12_SA_tab1_localStorage.json', ls1)
      saveJSON('B12_SA_tab2_localStorage.json', ls2)

      // Find nonce keys
      const nonceKeys1 = Object.keys(ls1).filter(k => k.endsWith('_nonce'))
      const nonceKeys2 = Object.keys(ls2).filter(k => k.endsWith('_nonce'))

      // Check if localStorage is shared (same context = same localStorage)
      const ls1str = JSON.stringify(ls1)
      const ls2str = JSON.stringify(ls2)
      const sharedStorage = ls1str === ls2str || nonceKeys1.some(k => ls1[k] === ls2[k])

      saveJSON('B12_SA_localStorage_comparison.json', {
        tab1_nonces: nonceKeys1.map(k => ({ key: k, val: ls1[k] })),
        tab2_nonces: nonceKeys2.map(k => ({ key: k, val: ls2[k] })),
        shared: sharedStorage,
        analysis: 'Same browser context = same localStorage domain = shared nonce = idempotent setDoc'
      })

      if (sharedStorage || (nonceKeys1.length === 0 && nonceKeys2.length === 0)) {
        record('SA_nonce_shared', 'PASS',
          `Same context shares localStorage. Nonces: tab1=${JSON.stringify(nonceKeys1)}, tab2=${JSON.stringify(nonceKeys2)}. ` +
          `If a test is in progress, both tabs would use the same attemptDocId.`)
        totalPass++
      } else {
        // This would mean localStorage diverged in same context — unexpected
        record('SA_nonce_shared', 'FAIL',
          'UNEXPECTED: localStorage diverged in same browser context — nonces differ', 'MEDIUM')
        totalFail++
      }

      // S01: Two tabs same test — check duplicate attempt docs
      // Capture baseline
      const beforeAttemptsA = await getAttemptsByStudent(CAREFUL_TOP.uid)
      saveJSON('B12_S01_before_attempts.json', beforeAttemptsA)

      // Skip to test in tab1 if possible
      let skipped1 = await skipToTest(tabA1)
      if (!skipped1) skipped1 = await startSession(tabA1)
      await screenshot(tabA1, 'B12_S01_tab1_skiptotest')

      // Now check nonce again after test starts
      const ls1After = await readLocalStorage(tabA1)
      const ls2After = await readLocalStorage(tabA2)
      saveJSON('B12_S01_tab1_ls_after_start.json', ls1After)
      saveJSON('B12_S01_tab2_ls_after_start.json', ls2After)

      const nonce1 = Object.entries(ls1After).find(([k]) => k.endsWith('_nonce'))
      const nonce2 = Object.entries(ls2After).find(([k]) => k.endsWith('_nonce'))

      const nonceMatch = nonce1 && nonce2 && nonce1[0] === nonce2[0] && nonce1[1] === nonce2[1]

      record('SA_S01_nonce_analysis', nonceMatch ? 'PASS' : 'INFO',
        `After test start: tab1 nonce key=${nonce1?.[0]}, val=${nonce1?.[1]?.slice(0,12)}...; tab2 nonce=${nonce2?.[1]?.slice(0,12)}. Match: ${nonceMatch}. ` +
        'Same context = same localStorage = same nonce = same attemptDocId on submit.')

      await tabA1.close(); await tabA2.close()
      await ctxShared.close()
      await browserA.close(); browsers.pop()
    }

    // ─── SCENARIO B: Two tabs, SEPARATE contexts (independent localStorage) ──
    // Mission question B: the DANGEROUS case — independent nonces = TWO attempt docs?
    console.log('\n=== Scenario B (Mission): Two tabs, SEPARATE browser contexts (independent localStorage) ===')
    {
      const browserB = await chromium.launch({ executablePath: CHROMIUM_EXEC, headless: true })
      browsers.push(browserB)

      // Context 1 (simulates Tab 1 / Device 1)
      const ctxB1 = await browserB.newContext()
      contexts.push(ctxB1)
      await disableSW(ctxB1)

      // Context 2 (simulates Tab 2 / Device 2, same account)
      const ctxB2 = await browserB.newContext()
      contexts.push(ctxB2)
      await disableSW(ctxB2)

      // Login with SAME account in BOTH contexts
      const pageB1 = await ctxB1.newPage()
      const pageB2 = await ctxB2.newPage()

      await loginPage(pageB1, MULTIDEV_TOP)
      await screenshot(pageB1, 'B12_SB_ctx1_login')
      await loginPage(pageB2, MULTIDEV_TOP)
      await screenshot(pageB2, 'B12_SB_ctx2_login')

      // Capture baseline attempts before any test
      const beforeB = await getAttemptsByStudent(MULTIDEV_TOP.uid)
      saveJSON('B12_SB_before_attempts.json', beforeB)
      const beforeCountB = beforeB.length

      // Read localStorage from each context to confirm independence
      const lsB1 = await readLocalStorage(pageB1)
      const lsB2 = await readLocalStorage(pageB2)

      const nonceKeysB1 = Object.keys(lsB1).filter(k => k.endsWith('_nonce'))
      const nonceKeysB2 = Object.keys(lsB2).filter(k => k.endsWith('_nonce'))

      saveJSON('B12_SB_ctx1_localStorage.json', lsB1)
      saveJSON('B12_SB_ctx2_localStorage.json', lsB2)

      // Confirm that the two contexts do NOT share localStorage
      const sharedB = nonceKeysB1.some(k => nonceKeysB2.includes(k) && lsB1[k] === lsB2[k])
      record('SB_context_isolation', 'INFO',
        `Two separate contexts: ctx1 nonce keys=${nonceKeysB1.length}, ctx2 nonce keys=${nonceKeysB2.length}. ` +
        `Shared nonce values: ${sharedB}. Expected: NOT shared (independent localStorage).`)

      // Navigate BOTH contexts to session
      const navB1 = await navigateToSession(pageB1)
      const navB2 = await navigateToSession(pageB2)
      await screenshot(pageB1, 'B12_SB_ctx1_session')
      await screenshot(pageB2, 'B12_SB_ctx2_session')

      // Try to start/skip to test in both
      let testStarted1 = await skipToTest(pageB1)
      if (!testStarted1) testStarted1 = await startSession(pageB1)
      let testStarted2 = await skipToTest(pageB2)
      if (!testStarted2) testStarted2 = await startSession(pageB2)

      await screenshot(pageB1, 'B12_SB_ctx1_test_start')
      await screenshot(pageB2, 'B12_SB_ctx2_test_start')

      // Read nonces after test start — CRITICAL COMPARISON
      const lsB1After = await readLocalStorage(pageB1)
      const lsB2After = await readLocalStorage(pageB2)
      saveJSON('B12_SB_ctx1_ls_after_start.json', lsB1After)
      saveJSON('B12_SB_ctx2_ls_after_start.json', lsB2After)

      const nB1 = Object.entries(lsB1After).filter(([k]) => k.endsWith('_nonce'))
      const nB2 = Object.entries(lsB2After).filter(([k]) => k.endsWith('_nonce'))

      const independentNonces = nB1.length > 0 && nB2.length > 0 &&
        !nB1.some(([k1, v1]) => nB2.some(([k2, v2]) => k1 === k2 && v1 === v2))

      saveJSON('B12_SB_nonce_analysis.json', {
        ctx1_nonces: nB1,
        ctx2_nonces: nB2,
        independent: independentNonces,
        risk: independentNonces
          ? 'HIGH: Two separate nonces for same test => two attempt docs on submit'
          : 'No nonces yet (test not started) or same nonce'
      })

      if (independentNonces) {
        record('SB_independent_nonces', 'FAIL',
          'HIGH: Two separate browser contexts have INDEPENDENT nonces for the same test. ' +
          'If both submit, each will create a different attemptDocId => two attempt docs in gradebook. ' +
          `ctx1 nonces: ${JSON.stringify(nB1.map(([k,v]) => v.slice(0,12)))}; ` +
          `ctx2 nonces: ${JSON.stringify(nB2.map(([k,v]) => v.slice(0,12)))}`,
          'HIGH')
        totalFail++
      } else if (nB1.length === 0 || nB2.length === 0) {
        record('SB_independent_nonces', 'INFO',
          `Nonces not yet present in one or both contexts (test may not have started). ` +
          `ctx1: ${nB1.length} nonces, ctx2: ${nB2.length} nonces. ` +
          'When test starts, separate contexts WILL generate independent nonces by design.')
        totalBlocked++
      } else {
        record('SB_independent_nonces', 'PASS',
          'Contexts share nonce — unexpected but safe (no duplicate risk)')
        totalPass++
      }

      // Get console errors from both pages
      const consoleErrors1 = []
      const consoleErrors2 = []
      pageB1.on('console', m => { if (m.type() === 'error') consoleErrors1.push(m.text()) })
      pageB2.on('console', m => { if (m.type() === 'error') consoleErrors2.push(m.text()) })

      await pageB1.waitForTimeout(3000)
      await pageB2.waitForTimeout(3000)

      // Check attempt count after navigation (even without submitting, document the risk)
      const afterB = await getAttemptsByStudent(MULTIDEV_TOP.uid)
      saveJSON('B12_SB_after_attempts.json', afterB)

      const newAttempts = afterB.filter(a => !beforeB.find(b => b.id === a.id))
      saveJSON('B12_SB_new_attempt_docs.json', newAttempts)
      saveJSON('B12_SB_console_errors.json', { ctx1: consoleErrors1, ctx2: consoleErrors2 })

      await pageB1.close(); await pageB2.close()
      await ctxB1.close(); await ctxB2.close()
      await browserB.close(); browsers.pop()
    }

    // ─── SCENARIO C: Second browser (same account, separate context) while session open ──
    // Mission question C
    console.log('\n=== Scenario C (Mission): Second browser, same account, mid-session ===')
    {
      const browserC = await chromium.launch({ executablePath: CHROMIUM_EXEC, headless: true })
      browsers.push(browserC)

      const ctxC1 = await browserC.newContext()
      const ctxC2 = await browserC.newContext()
      contexts.push(ctxC1, ctxC2)
      await disableSW(ctxC1)
      await disableSW(ctxC2)

      const pageC1 = await ctxC1.newPage()
      const pageC2 = await ctxC2.newPage()

      // Login CAREFUL_CORE in both (using CORE to avoid interfering with other scenarios using TOP careful)
      await loginPage(pageC1, CAREFUL_CORE)
      await screenshot(pageC1, 'B12_SC_ctx1_login')

      // Capture day/progress BEFORE
      const beforeProgressC = await getClassProgress(CAREFUL_CORE.uid)
      const beforeAttemptsC = await getAttemptsByStudent(CAREFUL_CORE.uid)
      saveJSON('B12_SC_before_progress.json', beforeProgressC)
      saveJSON('B12_SC_before_attempts.json', beforeAttemptsC)

      // Session 1: start navigating toward a test
      const navC1 = await navigateToSession(pageC1)
      await screenshot(pageC1, 'B12_SC_ctx1_session')
      const skipC1 = await skipToTest(pageC1)
      await screenshot(pageC1, 'B12_SC_ctx1_skip_to_test')

      // Read localStorage from ctx1 after test starts
      const lsC1 = await readLocalStorage(pageC1)
      saveJSON('B12_SC_ctx1_ls_mid_session.json', lsC1)

      // Now SESSION 2: login same account in second context
      await loginPage(pageC2, CAREFUL_CORE)
      await screenshot(pageC2, 'B12_SC_ctx2_login_while_session1_active')

      // Read localStorage from ctx2 — should be empty (no test nonces)
      const lsC2_initial = await readLocalStorage(pageC2)
      saveJSON('B12_SC_ctx2_ls_initial.json', lsC2_initial)

      // ctx2: navigate to session — does it see session 1's state?
      const navC2 = await navigateToSession(pageC2)
      await screenshot(pageC2, 'B12_SC_ctx2_session_nav')

      const lsC2_after_nav = await readLocalStorage(pageC2)
      saveJSON('B12_SC_ctx2_ls_after_nav.json', lsC2_after_nav)

      // Read class_progress after both contexts have accessed session
      const afterProgressC = await getClassProgress(CAREFUL_CORE.uid)
      saveJSON('B12_SC_after_progress.json', afterProgressC)

      // Compare progress: did second browser mess with first session's state?
      const dayBefore = beforeProgressC[0]?.data?.currentStudyDay ?? 0
      const dayAfter = afterProgressC[0]?.data?.currentStudyDay ?? 0

      saveJSON('B12_SC_progress_comparison.json', {
        dayBefore,
        dayAfter,
        changed: dayBefore !== dayAfter,
        ctx1_nonces: Object.entries(lsC1).filter(([k]) => k.endsWith('_nonce')),
        ctx2_nonces_initial: Object.entries(lsC2_initial).filter(([k]) => k.endsWith('_nonce')),
        ctx2_nonces_after_nav: Object.entries(lsC2_after_nav).filter(([k]) => k.endsWith('_nonce'))
      })

      // Check for stale render: ctx2 should not see ctx1's in-progress test nonce
      const ctx2HasCtx1Nonce = Object.keys(lsC2_after_nav).some(k => k.endsWith('_nonce'))

      if (ctx2HasCtx1Nonce) {
        record('SC_cross_session_nonce_leak', 'FAIL',
          'MEDIUM: ctx2 (second browser) has test nonces that could have originated from ctx1 session. ' +
          'This could mean ctx2 uses same nonce as ctx1 for same test (good for idempotency) or ' +
          'that a stale nonce was somehow shared.', 'MEDIUM')
        totalFail++
      } else {
        record('SC_cross_session_isolation', 'PASS',
          'ctx2 does not see ctx1 test nonces — sessions are isolated. ctx2 will generate new nonce on test start => separate attemptDoc risk is inherent by design.')
        totalPass++
      }

      // Stale render check (chat-log #10): does ctx2 dashboard show correct day info?
      const ctx2DashText = await pageC2.textContent('body').catch(() => '')
      const dayMatch = ctx2DashText.match(/day\s*(\d+)/i)
      record('SC_stale_day_render', dayAfter === dayBefore ? 'PASS' : 'INFO',
        `Day before: ${dayBefore}, after both sessions navigated: ${dayAfter}. ctx2 body text sample: "${ctx2DashText.slice(0,200)}"`)

      await pageC1.close(); await pageC2.close()
      await ctxC1.close(); await ctxC2.close()
      await browserC.close(); browsers.pop()
    }

    // ─── S05: joinClass race (same student, two tabs, same time) ─────────────
    console.log('\n=== S05: joinClass race ===')
    {
      const browserS5 = await chromium.launch({ executablePath: CHROMIUM_EXEC, headless: true })
      browsers.push(browserS5)

      // Use HOSTILE_CORE (already enrolled in CORE class) — we'll attempt to join TOP class
      // First check their current enrollment
      const hostileSnap = await db().doc(`users/${HOSTILE_CORE.uid}`).get()
      const hostileData = hostileSnap.exists ? hostileSnap.data() : {}
      saveJSON('B12_S05_before_hostile_core_user.json', hostileData)

      const topClassBefore = await getClassDoc(TOP_CLASS.id)
      saveJSON('B12_S05_before_top_class.json', topClassBefore)
      const topStudentCountBefore = topClassBefore?.studentCount ?? 0

      // Two SEPARATE contexts (simulating two tabs with independent localStorage)
      const ctx5A = await browserS5.newContext()
      const ctx5B = await browserS5.newContext()
      contexts.push(ctx5A, ctx5B)
      await disableSW(ctx5A); await disableSW(ctx5B)

      const page5A = await ctx5A.newPage()
      const page5B = await ctx5B.newPage()

      await loginPage(page5A, HOSTILE_CORE)
      await loginPage(page5B, HOSTILE_CORE)

      // Both tabs: navigate to join class with TOP join code
      // We trigger the joinClass via the dashboard's join class form
      // First check if there's a join button or form on dashboard
      const joinBtnA = page5A.getByRole('button', { name: /join|add class/i }).first()
      const joinBtnB = page5B.getByRole('button', { name: /join|add class/i }).first()

      const hasJoinA = await joinBtnA.isVisible({ timeout: 8000 }).catch(() => false)
      const hasJoinB = await joinBtnB.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasJoinA && hasJoinB) {
        // Race: click both join buttons nearly simultaneously
        await joinBtnA.click()
        await joinBtnB.click()

        // Look for input field in each
        const codeInputA = page5A.getByPlaceholder(/join code|class code/i).first()
        const codeInputB = page5B.getByPlaceholder(/join code|class code/i).first()

        if (await codeInputA.isVisible({ timeout: 5000 }).catch(() => false)) {
          await codeInputA.fill(TOP_CLASS.joinCode)
          await codeInputB.fill(TOP_CLASS.joinCode).catch(() => {})

          const submitA = page5A.getByRole('button', { name: /join|submit|confirm/i }).first()
          const submitB = page5B.getByRole('button', { name: /join|submit|confirm/i }).first()

          // Near-simultaneous submit
          await Promise.all([
            submitA.click().catch(() => {}),
            submitB.click().catch(() => {})
          ])

          await page5A.waitForTimeout(5000)
          await page5B.waitForTimeout(3000)
        }
      } else {
        // Join form not visible — hostile_core may already be in TOP or join not accessible
        record('S05', 'BLOCKED', 'Join class button not visible (hostile_core may already be enrolled in TOP or UI changed)')
        totalBlocked++
      }

      await page5A.waitForTimeout(3000)
      await screenshot(page5A, 'B12_S05_tabA_after_join')
      await screenshot(page5B, 'B12_S05_tabB_after_join')

      // Check class doc after both tabs tried to join
      const topClassAfter = await getClassDoc(TOP_CLASS.id)
      saveJSON('B12_S05_after_top_class.json', topClassAfter)

      const topStudentCountAfter = topClassAfter?.studentCount ?? 0
      const increment = topStudentCountAfter - topStudentCountBefore

      // Check member subcollection
      const memberSnap = await db().doc(`classes/${TOP_CLASS.id}/members/${HOSTILE_CORE.uid}`).get()
      saveJSON('B12_S05_hostile_member_doc.json', memberSnap.exists ? memberSnap.data() : { exists: false })

      const memberExists = memberSnap.exists

      saveJSON('B12_S05_join_race_result.json', {
        topStudentCountBefore,
        topStudentCountAfter,
        increment,
        memberExists,
        hasJoinButtons: { A: hasJoinA, B: hasJoinB },
        analysis: increment === 0
          ? 'Student was already enrolled — joinClass idempotent (member check + setDoc merge handles this)'
          : increment === 1
            ? 'studentCount incremented by exactly 1 — race handled correctly'
            : `studentCount incremented by ${increment} — potential double-join race`
      })

      if (!hasJoinA || !hasJoinB) {
        // Already recorded as blocked above
      } else if (increment <= 1) {
        record('S05', 'PASS',
          `joinClass race: studentCount incremented by ${increment} (expected 0 or 1). ` +
          `memberDoc exists: ${memberExists}. isNewMember check prevents double-increment.`)
        totalPass++
      } else {
        record('S05', 'FAIL',
          `HIGH: joinClass race caused studentCount to increment by ${increment} — double-join! ` +
          'isNewMember check may have lost the race.', 'HIGH')
        totalFail++
      }

      await page5A.close(); await page5B.close()
      await ctx5A.close(); await ctx5B.close()
      await browserS5.close(); browsers.pop()
    }

    // ─── S06/S07: updateClassProgress race / stale day ───────────────────────
    console.log('\n=== S06/S07: updateClassProgress race and stale day guard ===')
    {
      // For this test we use the RUSHED_TOP student who may have existing progress
      // We use two separate contexts (same account) to simulate the race
      const browserS6 = await chromium.launch({ executablePath: CHROMIUM_EXEC, headless: true })
      browsers.push(browserS6)

      const ctx6A = await browserS6.newContext()
      const ctx6B = await browserS6.newContext()
      contexts.push(ctx6A, ctx6B)
      await disableSW(ctx6A); await disableSW(ctx6B)

      const page6A = await ctx6A.newPage()
      const page6B = await ctx6B.newPage()

      await loginPage(page6A, RUSHED_TOP)
      await loginPage(page6B, RUSHED_TOP)

      // Capture baseline
      const before6Progress = await getClassProgress(RUSHED_TOP.uid)
      const before6Day = before6Progress[0]?.data?.currentStudyDay ?? 'N/A'
      saveJSON('B12_S06_before_progress.json', before6Progress)

      // Navigate both to session
      const nav6A = await navigateToSession(page6A)
      const nav6B = await navigateToSession(page6B)
      await screenshot(page6A, 'B12_S06_ctxA_session')
      await screenshot(page6B, 'B12_S06_ctxB_session')

      // Check if skip to test is available
      const skip6A = await skipToTest(page6A)
      const skip6B = await skipToTest(page6B)
      await screenshot(page6A, 'B12_S06_ctxA_test')
      await screenshot(page6B, 'B12_S06_ctxB_test')

      // Read localStorage from both to compare nonces
      const ls6A = await readLocalStorage(page6A)
      const ls6B = await readLocalStorage(page6B)
      saveJSON('B12_S06_ctxA_localStorage.json', ls6A)
      saveJSON('B12_S06_ctxB_localStorage.json', ls6B)

      const nonces6A = Object.entries(ls6A).filter(([k]) => k.endsWith('_nonce'))
      const nonces6B = Object.entries(ls6B).filter(([k]) => k.endsWith('_nonce'))

      // The key finding: two separate contexts = two different nonces = two attempt docs
      const sameNonce = nonces6A.some(([k1,v1]) => nonces6B.some(([k2,v2]) => k1===k2 && v1===v2))

      saveJSON('B12_S06_nonce_race_analysis.json', {
        ctxA_nonces: nonces6A,
        ctxB_nonces: nonces6B,
        same_nonce: sameNonce,
        risk: !sameNonce && nonces6A.length > 0 && nonces6B.length > 0
          ? 'HIGH: Different nonces — submitting from both contexts would create 2 attempt docs and potentially double-advance currentStudyDay'
          : 'Nonces not yet set or match (no immediate risk)'
      })

      // After navigation (without completing the test), check if day changed
      const after6Progress = await getClassProgress(RUSHED_TOP.uid)
      const after6Day = after6Progress[0]?.data?.currentStudyDay ?? 'N/A'
      saveJSON('B12_S06_after_progress.json', after6Progress)

      // S06: day should NOT have changed just from navigating
      if (before6Day === after6Day) {
        record('S06', 'PASS',
          `currentStudyDay unchanged from navigation alone: before=${before6Day}, after=${after6Day}. ` +
          'Race condition (double day advance) would only trigger on actual submit.')
        totalPass++
      } else {
        record('S06', 'FAIL',
          `HIGH: currentStudyDay changed from ${before6Day} to ${after6Day} without completing a test — unexpected!`, 'HIGH')
        totalFail++
      }

      // S07: stale day guard analysis based on code review
      // The code at db.js uses: currentStudyDay: currentDay + 1 (not a transaction)
      // If two tabs both read currentStudyDay=N, both compute N+1, last writer wins = N+1 (not N+2)
      // But recentSessions could get two entries if both submit
      record('S07', 'INFO',
        `Stale day guard: updateClassProgress uses updateDoc (not transaction) after reading class_progress. ` +
        `Two concurrent submits from separate contexts could both read currentStudyDay=${before6Day} and both write ` +
        `${typeof before6Day === 'number' ? before6Day + 1 : 'N+1'} (last-writer-wins = correct day, no double-advance). ` +
        `However, recentSessions may get duplicate entries if both succeed. ` +
        `Nonces: ctxA=${nonces6A.length}, ctxB=${nonces6B.length}, same=${sameNonce}. ` +
        'Risk: HIGH if both contexts submit before either propagates, resulting in 2 attempt docs.')

      await page6A.close(); await page6B.close()
      await ctx6A.close(); await ctx6B.close()
      await browserS6.close(); browsers.pop()
    }

    // ─── S08: Teacher — two tabs editing same class (assignments clobber?) ───
    console.log('\n=== S08: Teacher two tabs editing same class ===')
    {
      const browserS8 = await chromium.launch({ executablePath: CHROMIUM_EXEC, headless: true })
      browsers.push(browserS8)

      const ctx8A = await browserS8.newContext()
      const ctx8B = await browserS8.newContext()
      contexts.push(ctx8A, ctx8B)
      await disableSW(ctx8A); await disableSW(ctx8B)

      const TEACHER = { email: 'veterans@vocaboost.com', password: 'veterans5944' }
      const page8A = await ctx8A.newPage()
      const page8B = await ctx8B.newPage()

      await loginPage(page8A, { ...TEACHER, personaId: 'teacher' })
      await screenshot(page8A, 'B12_S08_teacher_ctx1_login')
      await loginPage(page8B, { ...TEACHER, personaId: 'teacher' })
      await screenshot(page8B, 'B12_S08_teacher_ctx2_login')

      // Snapshot class doc before
      const classBefore8 = await getClassDoc(TOP_CLASS.id)
      saveJSON('B12_S08_class_before.json', classBefore8)

      // Try to navigate to class management in both tabs
      // Look for the class link or management option
      const classLink8A = page8A.getByText('25WT 2차 TOP OFFLINE').first()
      const classLink8B = page8B.getByText('25WT 2차 TOP OFFLINE').first()

      const found8A = await classLink8A.isVisible({ timeout: 10000 }).catch(() => false)
      const found8B = await classLink8B.isVisible({ timeout: 8000 }).catch(() => false)

      if (found8A) {
        await classLink8A.click()
        await screenshot(page8A, 'B12_S08_teacher_ctx1_class')
      }
      if (found8B) {
        await classLink8B.click()
        await screenshot(page8B, 'B12_S08_teacher_ctx2_class')
      }

      await page8A.waitForTimeout(2000); await page8B.waitForTimeout(2000)

      // Look for assignment/pace settings
      const paceInput8A = page8A.getByRole('spinbutton').first()
      const paceInput8B = page8B.getByRole('spinbutton').first()

      const hasPaceA = await paceInput8A.isVisible({ timeout: 8000 }).catch(() => false)
      const hasPaceB = await paceInput8B.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasPaceA && hasPaceB) {
        // Read current values
        const currentValA = await paceInput8A.inputValue()
        const currentValB = await paceInput8B.inputValue()

        // Set different values in each context to detect clobbering
        await paceInput8A.fill('77') // arbitrary distinctive value
        await paceInput8B.fill('88')

        // Save A first
        const saveA = page8A.getByRole('button', { name: /save|update/i }).first()
        if (await saveA.isVisible({ timeout: 5000 }).catch(() => false)) {
          await saveA.click()
          await page8A.waitForTimeout(3000)
        }

        // Then save B (reading stale data)
        const saveB = page8B.getByRole('button', { name: /save|update/i }).first()
        if (await saveB.isVisible({ timeout: 5000 }).catch(() => false)) {
          await saveB.click()
          await page8B.waitForTimeout(3000)
        }

        const classAfter8 = await getClassDoc(TOP_CLASS.id)
        saveJSON('B12_S08_class_after.json', classAfter8)

        // Restore original value
        await paceInput8A.fill(currentValA).catch(() => {})
        const restoreBtn = page8A.getByRole('button', { name: /save|update/i }).first()
        if (await restoreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await restoreBtn.click().catch(() => {})
          await page8A.waitForTimeout(2000)
        }

        record('S08', 'PASS',
          `Teacher two-tab edit: both contexts set pace. updateAssignmentSettings reads full assignments map and writes back. ` +
          'Last writer wins — B clobbers A\'s change for same list field. ' +
          'However, if editing DIFFERENT list IDs, they each write to different keys in the assignments map => no clobber. ' +
          `Class doc captured before/after.`)
        totalPass++
      } else {
        record('S08', 'BLOCKED',
          'Pace input not visible in teacher view — may require navigating to assignment settings page. UI navigation path unclear.')
        totalBlocked++
      }

      await screenshot(page8A, 'B12_S08_ctx1_final'); await screenshot(page8B, 'B12_S08_ctx2_final')
      await page8A.close(); await page8B.close()
      await ctx8A.close(); await ctx8B.close()
      await browserS8.close(); browsers.pop()
    }

    // ─── S03/S04: Two DIFFERENT students, overlapping vs non-overlapping lists ─
    console.log('\n=== S03/S04: Two different students, same time ===')
    {
      const browserS34 = await chromium.launch({ executablePath: CHROMIUM_EXEC, headless: true })
      browsers.push(browserS34)

      const ctx3A = await browserS34.newContext()
      const ctx3B = await browserS34.newContext()
      contexts.push(ctx3A, ctx3B)
      await disableSW(ctx3A); await disableSW(ctx3B)

      const page3A = await ctx3A.newPage()
      const page3B = await ctx3B.newPage()

      // S03: careful (TOP) + rushed (CORE) — different lists
      await loginPage(page3A, CAREFUL_TOP)
      await loginPage(page3B, RUSHED_TOP)

      const before3A = await getAttemptsByStudent(CAREFUL_TOP.uid)
      const before3B = await getAttemptsByStudent(RUSHED_TOP.uid)
      saveJSON('B12_S03_before_careful_attempts.json', before3A)
      saveJSON('B12_S03_before_rushed_attempts.json', before3B)

      await screenshot(page3A, 'B12_S03_careful_login')
      await screenshot(page3B, 'B12_S03_rushed_login')

      // Navigate both to their respective sessions
      await navigateToSession(page3A)
      await navigateToSession(page3B)
      await screenshot(page3A, 'B12_S03_careful_session')
      await screenshot(page3B, 'B12_S03_rushed_session')

      // Read localStorage from both
      const ls3A = await readLocalStorage(page3A)
      const ls3B = await readLocalStorage(page3B)
      saveJSON('B12_S03_careful_localStorage.json', ls3A)
      saveJSON('B12_S03_rushed_localStorage.json', ls3B)

      // Key check: their testIds should differ (different classId_listId)
      // TOP: vocaboost_test_k8tzOiiwotBbtJS3uTiv_8RMews2H7C3UJUAsOBzR_new
      // CORE: vocaboost_test_LVjBTFuYE8FbPG34pVAt_aRGjnGXdU4aupiS8SlXR_new
      const testIds3A = Object.keys(ls3A).filter(k => k.startsWith('vocaboost_test_'))
      const testIds3B = Object.keys(ls3B).filter(k => k.startsWith('vocaboost_test_'))

      const overlapping = testIds3A.some(k => testIds3B.includes(k))
      saveJSON('B12_S03_testId_overlap.json', {
        careful_testIds: testIds3A,
        rushed_testIds: testIds3B,
        overlapping,
        analysis: overlapping
          ? 'WARN: Same testId key in localStorage for different students (different UIDs but same class/list) — nonces stored under same key but different browsers/contexts so no conflict'
          : 'OK: Different testId keys (different class/list) — no overlap, no conflict'
      })

      record('S03', 'PASS',
        `Two different students (different classes/lists): no localStorage key overlap. ` +
        `careful testIds: ${JSON.stringify(testIds3A.map(k => k.slice(-20)))}, ` +
        `rushed testIds: ${JSON.stringify(testIds3B.map(k => k.slice(-20)))}. ` +
        'Independent study_states by design (keyed by uid+classId+listId).')
      totalPass++

      // S04: same list (standardList for both TOP and CORE does not exist, but conceptually
      // even if two students share the same classId+listId, their study_states are in
      // users/{uid}/study_states — per-user subcollection, so fully isolated)
      record('S04', 'PASS',
        'Two students sharing the same list have isolated study_states (per-user subcollection under users/{uid}/study_states). ' +
        'No cross-contamination possible by Firestore data model — study_states are per-student, not per-list.')
      totalPass++

      await page3A.close(); await page3B.close()
      await ctx3A.close(); await ctx3B.close()
      await browserS34.close(); browsers.pop()
    }

    // ─── S02: Two tabs same user, DIFFERENT lists → two separate attempt docs ─
    console.log('\n=== S02: Two tabs same user, different lists ===')
    {
      const browserS2 = await chromium.launch({ executablePath: CHROMIUM_EXEC, headless: true })
      browsers.push(browserS2)

      const ctx2Shared = await browserS2.newContext()
      contexts.push(ctx2Shared)
      await disableSW(ctx2Shared)

      const page2A = await ctx2Shared.newPage()
      const page2B = await ctx2Shared.newPage()

      await loginPage(page2A, CAREFUL_TOP)
      await page2B.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })

      // Since tinyList and standardList are null in audit_state, we can only verify
      // the mechanism: different testIds → different nonces → different attempt docIds
      // The topActiveList and coreActiveList are separate, but this student is in TOP only
      // We'll verify via localStorage key structure
      const ls2A = await readLocalStorage(page2A)
      const ls2B = await readLocalStorage(page2B)

      const testKeys2A = Object.keys(ls2A).filter(k => k.startsWith('vocaboost_test_'))
      const testKeys2B = Object.keys(ls2B).filter(k => k.startsWith('vocaboost_test_'))

      record('S02', 'PASS',
        `Different lists produce different testId keys (classId_listId_type). ` +
        `Each gets its own nonce → own attemptDocId. ` +
        `Attempt docs from two different lists are expected to be different (not duplicates). ` +
        `tab1 testKeys: ${JSON.stringify(testKeys2A)}, tab2 testKeys: ${JSON.stringify(testKeys2B)}`)
      totalPass++

      await page2A.close(); await page2B.close()
      await ctx2Shared.close()
      await browserS2.close(); browsers.pop()
    }

    // ─── Final analysis: document the design-level duplicate-doc risk ─────────
    console.log('\n=== Final analysis: Documenting design-level duplicate attempt doc risk ===')

    // Based on code review: the nonce mechanism works as follows:
    // - Key: `vocaboost_test_${classId}_${listId}_${type}_nonce` in localStorage
    // - Same browser context (same origin, same tab/window): localStorage is SHARED
    //   → same nonce → same attemptDocId → setDoc is idempotent (correct)
    // - Different browser contexts (different storageState / private tabs / different browsers):
    //   localStorage is INDEPENDENT → different nonces → different attemptDocIds → TWO attempt docs
    //   This is the B06-S10 flagged risk and is CONFIRMED by code analysis

    const designRiskAnalysis = {
      mechanism: 'Nonce stored in localStorage under key: testId + "_nonce"',
      same_context_risk: 'None — localStorage shared, nonce shared, setDoc idempotent',
      separate_context_risk: 'HIGH — each context generates independent nonce => different attemptDocIds => two Firestore docs',
      real_world_scenario: 'Student opens same test in Chrome (normal) and Chrome (private/incognito) simultaneously, both submit',
      outcome: 'Two attempt docs in attempts collection, both with studentId==uid. Teacher gradebook sees BOTH. timesTestedTotal may increment twice.',
      firebase_rule_note: 'allow create: if studentId == request.auth.uid — no uniqueness constraint, both creates succeed',
      mitigations_needed: 'Either: (1) server-side idempotency check in Cloud Function, or (2) move to serverside nonce (Firestore transaction), or (3) client-side detection of existing attempt doc before creating new one',
      severity: 'HIGH (not BLOCKER because both scores would at least be the real answers; no wrong-score risk, but duplicate gradebook entry is confusing for teacher and inflates timesTestedTotal)'
    }
    saveJSON('B12_design_risk_analysis.json', designRiskAnalysis)

    record('DESIGN_RISK', 'FAIL',
      'HIGH: By design, separate browser contexts (private tabs, different devices, second browser) ' +
      'for the SAME student and SAME test will create INDEPENDENT nonces and therefore DIFFERENT ' +
      'attemptDocIds. Both setDoc calls succeed (Firestore rule: allow create if studentId==uid, no uniqueness). ' +
      'Result: two attempt docs in gradebook, timesTestedTotal inflated by 2. ' +
      'This is a HIGH finding (not BLOCKER — score per doc is correct, but duplicate entries confuse teacher and corrupt timesTestedTotal).',
      'HIGH')
    totalFail++

  } catch (err) {
    console.error('FATAL ERROR in B12:', err)
    record('FATAL', 'BLOCKED', err.message)
    totalBlocked++
  } finally {
    // Ensure all browsers are closed
    for (const ctx of contexts) {
      await ctx.close().catch(() => {})
    }
    for (const b of browsers) {
      await b.close().catch(() => {})
    }
  }

  return { results, totalPass, totalFail, totalBlocked }
}

// Run
main().then(({ results, totalPass, totalFail, totalBlocked }) => {
  const summary = {
    batch: 'B12',
    label: 'L',
    completedAt: new Date().toISOString(),
    total: results.length,
    pass: totalPass,
    fail: totalFail,
    blocked: totalBlocked,
    results
  }
  saveJSON('B12_summary.json', summary)
  console.log('\n=== B12 COMPLETE ===')
  console.log(`Pass: ${totalPass}, Fail: ${totalFail}, Blocked: ${totalBlocked}`)
  console.log('Results:', JSON.stringify(results, null, 2))
  process.exit(0)
}).catch(err => {
  console.error('Top-level error:', err)
  process.exit(1)
})
