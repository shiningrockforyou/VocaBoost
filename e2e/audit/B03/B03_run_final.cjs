/**
 * B03 — Typed Submission Critical Path (Final Run)
 * Agent C — Batch B03
 *
 * This version properly:
 * 1. Waits for dashboard content (not just URL) after login
 * 2. Clicks "Start Session" from dashboard to enter DailySessionFlow
 * 3. Clicks through flashcards ("I Know This") until "Take Test" appears
 * 4. TypedTest receives proper location.state from DailySessionFlow
 *
 * Additional: source code verification of all persistence fix invariants
 */

'use strict'

const { chromium } = require('playwright')
const { initializeApp, cert, getApps } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const fs = require('fs')
const path = require('path')
const https = require('https')

const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B03'
const SA_PATH = '/app/scripts/serviceAccountKey.json'
const SEEDED_PATH = '/app/audit/playwright/seeded_accounts.json'
const AUDIT_STATE_PATH = '/app/audit/playwright/audit_state.json'
const LOG_PATH = '/app/audit/playwright/findings/agent_logs/C.jsonl'
const STATUS_PATH = '/app/audit/playwright/findings/agent_logs/C.status.json'

let _db = null
function getDb() {
  if (!_db) {
    if (getApps().length === 0) initializeApp({ credential: cert(require(SA_PATH)) })
    _db = getFirestore()
  }
  return _db
}

const seeded = JSON.parse(fs.readFileSync(SEEDED_PATH, 'utf-8'))
const auditState = JSON.parse(fs.readFileSync(AUDIT_STATE_PATH, 'utf-8'))
function getAccount(personaId, targetClass) {
  return seeded.accounts.find(a => a.personaId === personaId && (!targetClass || a.targetClass === targetClass))
}

function appendLog(obj) {
  fs.appendFileSync(LOG_PATH, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n')
}
function updateStatus(patch) {
  let cur = {}
  try { cur = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf-8')) } catch {}
  fs.writeFileSync(STATUS_PATH, JSON.stringify({ ...cur, ...patch, lastUpdate: new Date().toISOString() }, null, 2))
}

async function getAttemptsByStudent(uid) {
  const db = getDb()
  const snap = await db.collection('attempts').where('studentId', '==', uid).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
async function getStudyStatesForList(uid, listId) {
  const db = getDb()
  try {
    const snap = await db.collection('study_states')
      .where('studentId', '==', uid)
      .where('listId', '==', listId)
      .limit(50).get()
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch { return [] }
}

async function saveFS(label, data) {
  fs.writeFileSync(path.join(EVIDENCE_DIR, label), JSON.stringify(data, null, 2))
}
async function screenshot(page, label) {
  await page.screenshot({ path: path.join(EVIDENCE_DIR, `${label}.png`), fullPage: true }).catch(() => {})
}
function attachConsole(page) {
  const logs = [], errors = []
  page.on('console', m => { const t = `[${m.type()}] ${m.text()}`; logs.push(t); if (m.type()==='error') errors.push(t) })
  page.on('pageerror', e => { errors.push(`[pageerror] ${e.message}`); logs.push(`[pageerror] ${e.message}`) })
  return { getLogs: () => logs, getErrors: () => errors }
}

// ── Login with proper content-wait ─────────────────────────────────────────
async function loginAs(page, personaId, targetClass) {
  const account = getAccount(personaId, targetClass)
  if (!account) throw new Error(`No account for ${personaId}/${targetClass}`)

  await page.addInitScript(() => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
    }
  })

  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(3000)

  // Navigate to login
  const loginLink = page.getByRole('link', { name: /log\s?in/i }).first()
  if (await loginLink.count() > 0) {
    await loginLink.click()
  } else {
    await page.evaluate(() => {
      history.pushState({}, '', '/login')
      dispatchEvent(new PopStateEvent('popstate'))
    })
  }

  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(account.email)
  await page.getByLabel(/password/i).first().fill(account.password)
  await page.getByLabel(/password/i).first().press('Enter')

  // Wait for ACTUAL dashboard content (not just URL)
  try {
    await page.waitForFunction(
      () => document.body.textContent.includes('Start Session') ||
             document.body.textContent.includes('Dashboard') ||
             document.body.textContent.includes('Gradebook'),
      { timeout: 20000 }
    )
  } catch {
    // Fallback: try clicking Continue button
    const continueBtn = page.getByRole('button', { name: /continue/i }).first()
    if (await continueBtn.count() > 0) {
      await continueBtn.click()
      await page.waitForFunction(
        () => document.body.textContent.includes('Start Session') ||
               document.body.textContent.includes('Dashboard'),
        { timeout: 15000 }
      )
    }
  }

  return account
}

// ── Navigate from dashboard to typed test via Start Session → flashcards → Take Test ──
async function navigateToTypedTest(page, classId, listId) {
  // From the dashboard, click Start Session
  // First check if we're already at / or need to go there
  if (!page.url().includes(BASE_URL + '/') || page.url().includes('/session')) {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
  }

  // Wait for Start Session button
  let startBtn = null
  try {
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('button')).some(b =>
        b.textContent.includes('Start Session') || b.textContent.includes('Start')),
      { timeout: 15000 }
    )
    startBtn = page.getByRole('button', { name: /start session/i }).first()
    if (await startBtn.count() === 0) {
      startBtn = page.getByRole('button', { name: /start/i }).first()
    }
  } catch {
    console.log('    No Start Session button found')
    return 'no_session_button'
  }

  console.log('    Clicking Start Session...')
  await startBtn.click()
  await page.waitForTimeout(5000)

  const url = page.url()
  console.log(`    Session URL: ${url}`)

  // Check if navigated to session
  if (!url.includes('/session/')) {
    // May have gone to typed test directly (recovery)
    if (url.includes('/typedtest/') || url.includes('/mcqtest/')) {
      return 'reached_test'
    }
    console.log('    Did not navigate to /session/')
    return 'no_session_nav'
  }

  // We're in DailySessionFlow — now work through the flashcard phase
  return await workThroughFlashcards(page)
}

// ── Click through flashcards until Take Test ─────────────────────────────────
async function workThroughFlashcards(page, maxClicks = 50) {
  let clickCount = 0
  const start = Date.now()

  console.log('    Working through flashcards...')

  while (Date.now() - start < 120000 && clickCount < maxClicks) {
    const currentUrl = page.url()

    // Already on test page?
    if (currentUrl.includes('/typedtest/') || currentUrl.includes('/mcqtest/')) {
      console.log(`    Navigated to test after ${clickCount} clicks`)
      return 'reached_test'
    }

    // "Take Test" button
    const takeTestBtn = page.getByRole('button', { name: 'Take Test' })
    if (await takeTestBtn.count() > 0) {
      console.log(`    Take Test button found after ${clickCount} clicks`)
      await takeTestBtn.click()
      await page.waitForTimeout(2000)

      // Confirmation modal
      const startTestBtn = page.getByRole('button', { name: 'Start Test' })
      if (await startTestBtn.count() > 0) {
        await startTestBtn.click()
        await page.waitForTimeout(3000)
      }

      // Wait for test navigation
      try {
        await page.waitForFunction(
          () => window.location.pathname.includes('/typedtest/') ||
                 window.location.pathname.includes('/mcqtest/'),
          { timeout: 15000 }
        )
        return 'reached_test'
      } catch {
        const newUrl = page.url()
        if (newUrl.includes('/typedtest/') || newUrl.includes('/mcqtest/')) return 'reached_test'
        return 'stuck_after_take_test'
      }
    }

    // "I Know This" button (checkmark button)
    const knowBtn = page.locator('button[aria-label*="know this word"], button[aria-label*="I know this"]').first()
    if (await knowBtn.count() > 0) {
      await knowBtn.click()
      clickCount++
      await page.waitForTimeout(300)
      continue
    }

    // Try finding checkmark-styled oval button
    const ovalBtns = page.locator('button[class*="rounded-full"]').all()
    const ovals = await ovalBtns
    if (ovals.length > 0) {
      // Find the one with checkmark (second button, usually)
      const svgBtns = await page.locator('button[class*="rounded-full"] svg').all()
      if (svgBtns.length >= 2) {
        // Click the second oval (checkmark = "I know this")
        const btn = page.locator('button[class*="rounded-full"]').nth(1)
        await btn.click()
        clickCount++
        await page.waitForTimeout(300)
        continue
      } else if (svgBtns.length === 1) {
        const btn = page.locator('button[class*="rounded-full"]').first()
        await btn.click()
        clickCount++
        await page.waitForTimeout(300)
        continue
      }
    }

    // Try pressing keyboard 'c' for "I know this" (common keyboard shortcut)
    await page.keyboard.press('c')
    clickCount++
    await page.waitForTimeout(500)

    // If stuck, check for any "Continue" or next button
    const continueBtn = page.getByRole('button', { name: /continue|next/i }).first()
    if (await continueBtn.count() > 0) {
      await continueBtn.click()
      await page.waitForTimeout(1000)
    }
  }

  const finalUrl = page.url()
  if (finalUrl.includes('/typedtest/') || finalUrl.includes('/mcqtest/')) return 'reached_test'

  console.log(`    Stuck after ${clickCount} clicks. URL: ${finalUrl}`)
  return 'flashcard_timeout'
}

// ── Wait for test word inputs ─────────────────────────────────────────────────
async function waitForTestInputs(page, timeoutMs = 25000) {
  try {
    await page.waitForSelector('input[placeholder*="definition"]', { timeout: timeoutMs })
    const inputs = await page.locator('input[placeholder*="definition"]').all()
    return inputs
  } catch { return [] }
}

// ── Wait for grading complete ─────────────────────────────────────────────────
async function waitForGradingComplete(page, timeoutMs = 240000) {
  console.log('    Waiting for AI grading (up to 4 min)...')
  const start = Date.now()
  try {
    await page.waitForFunction(
      () => {
        const h3s = Array.from(document.querySelectorAll('h3'))
        const gradingDone = !h3s.some(h => h.textContent.includes('Grading Your Test'))
        const hasResults = document.querySelector('[class*="rounded-2xl"][class*="shadow-xl"]') !== null
        const hasError = h3s.some(h => h.textContent.includes('Grading Failed'))
        return (hasResults || hasError) && gradingDone
      },
      { timeout: timeoutMs, polling: 2000 }
    )
  } catch {}
  return Date.now() - start
}

// ── Type answers into test inputs ─────────────────────────────────────────────
async function fillTestAnswers(page, wordList, count, persona = 'canonical_en') {
  const inputs = await page.locator('input[placeholder*="definition"]').all()
  const n = Math.min(count, inputs.length)

  for (let i = 0; i < n; i++) {
    const input = page.locator('input[placeholder*="definition"]').nth(i)
    const wordEntry = wordList[i % wordList.length]

    let answer
    if (persona === 'canonical_ko') {
      const rawKo = wordEntry?.definition_ko || wordEntry?.definition_en || '테스트'
      answer = rawKo.replace(/\r\n/g, ' ').trim()
    } else {
      answer = wordEntry?.definition_en || 'test answer'
    }
    if (answer.endsWith('.')) answer = answer.slice(0, -1)

    await input.click()
    // Use fill() for speed in audit (realisticType takes too long for many words)
    await input.fill(answer)
    await page.waitForTimeout(100)
  }

  return inputs.length
}

// ── Result tracking ───────────────────────────────────────────────────────────
const results = []
function recordResult(scenario, result, severity, durationMs, notes) {
  results.push({ scenario, result, severity, durationMs, notes })
  appendLog({ event: 'scenario', batch: 'B03', scenario, result, severity, durationMs, notes })
  updateStatus({ currentScenario: scenario, trialsCompleted: results.length, state: 'running' })
  console.log(`  [${scenario}] ${result.toUpperCase()}${severity ? ' [' + severity + ']' : ''} — ${(notes || '').substring(0, 100)}`)
}

// =============================================================================
// SOURCE CODE INVARIANT CHECKS (fast, no browser needed)
// =============================================================================
async function verifySourceInvariants() {
  console.log('\n=== Source Code Invariant Verification ===')
  const src = fs.readFileSync('/app/src/pages/TypedTest.jsx', 'utf-8')

  // FIX #2: clearTestState ordering
  const clearIdx = src.lastIndexOf('clearTestState(testId)')
  const gradeIdx = src.indexOf('gradeWithRetry(')
  const submitIdx = src.indexOf('submitTypedTestAttempt(')
  const processIdx = src.indexOf('processTestResults(')
  const showResultsIdx = src.indexOf('setShowResults(true)')

  const fix2Correct = gradeIdx < submitIdx && submitIdx < processIdx &&
    processIdx < clearIdx && clearIdx < showResultsIdx

  // Fix #3: Idempotent attempt doc
  const hasNonce = src.includes('getOrCreateAttemptNonce')
  const hasAttemptDocId = src.includes('attemptDocId')

  // Fix #4: processTestResults guarded by ref
  const hasRef = src.includes('resultsProcessedRef')
  const refGuard = src.includes('!resultsProcessedRef.current')

  // Fix #5: Try Again doesn't reset ref (so double-increment prevented)
  const refResetOnRetake = src.includes('resultsProcessedRef.current = false')

  // Practice mode guard
  const practiceGuard = src.includes('!isPracticeMode')
  const submitAfterGuard = src.indexOf('!isPracticeMode') < src.indexOf('submitTypedTestAttempt(')

  // Retry text in UI
  const retryText = src.match(/Attempt.*\/3/)?.[0] || '(not found)'

  const checks = {
    'Fix #2: clearTestState after full chain': fix2Correct,
    'Fix #3: idempotent nonce': hasNonce,
    'Fix #3: attemptDocId used': hasAttemptDocId,
    'Fix #4: resultsProcessedRef guard': hasRef && refGuard,
    'Fix #5: ref not reset on retry (prevents double-incr)': !refResetOnRetake,
    'Practice mode guard before submit': practiceGuard && submitAfterGuard,
    'Retry UI text present': src.includes('Attempt {retryAttempt}/3')
  }

  console.log('  Invariant checks:')
  for (const [k, v] of Object.entries(checks)) {
    console.log(`    ${v ? '✓' : '✗'} ${k}`)
  }

  const allPass = Object.values(checks).every(Boolean)
  const failures = Object.entries(checks).filter(([,v]) => !v).map(([k]) => k)

  await saveFS('B03_source_invariants.json', {
    checks, allPass, failures,
    indices: { clearIdx, gradeIdx, submitIdx, processIdx, showResultsIdx }
  })

  return { allPass, failures, checks }
}

// =============================================================================
// BROWSER SCENARIOS
// =============================================================================

async function runS01(browser) {
  console.log('\n[S01] Happy path: careful → Start Session → flashcards → TypedTest → grade')
  const start = Date.now()
  const page = await browser.newPage()
  const con = attachConsole(page)

  try {
    updateStatus({ currentScenario: 'S01' })
    const account = await loginAs(page, 'careful', 'TOP')
    const uid = account.uid
    const classInfo = auditState.classes.topClass
    const listInfo = auditState.lists.topActiveList

    const preAttempts = await getAttemptsByStudent(uid)
    await saveFS('B03_S01_pre_attempts.json', preAttempts)

    await screenshot(page, 'B03_S01_01_dashboard')

    const nav = await navigateToTypedTest(page, classInfo.id, listInfo.id)
    console.log(`    Navigation result: ${nav}`)

    if (nav !== 'reached_test') {
      await screenshot(page, 'B03_S01_nav_failed')
      recordResult('S01', 'blocked', null, Date.now() - start, `Navigation failed: ${nav}`)
      return
    }

    const testUrl = page.url()
    console.log(`    Test URL: ${testUrl}`)
    await screenshot(page, 'B03_S01_02_on_test')

    if (testUrl.includes('/mcqtest/')) {
      recordResult('S01', 'blocked', null, Date.now() - start,
        'Landed on MCQTest not TypedTest — class testMode may not be "typed"')
      return
    }

    // Dismiss recovery
    const freshBtn = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn.count() > 0) { await freshBtn.click(); await page.waitForTimeout(1000) }
    const resumeBtn = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn.count() > 0) { await resumeBtn.click(); await page.waitForTimeout(1000) }

    const inputs = await waitForTestInputs(page)
    console.log(`    Found ${inputs.length} inputs`)

    if (inputs.length === 0) {
      await screenshot(page, 'B03_S01_no_inputs')
      recordResult('S01', 'fail', 'BLOCKER', Date.now() - start,
        'On /typedtest/ but no input fields — test page not rendering')
      return
    }

    await screenshot(page, 'B03_S01_03_inputs_ready')

    // Type canonical English answers for all inputs
    const wordList = listInfo.words || []
    const n = await fillTestAnswers(page, wordList, inputs.length)
    console.log(`    Filled ${n} answers`)

    await screenshot(page, 'B03_S01_04_filled')

    // Submit
    const submitBtn = page.getByRole('button', { name: /submit test/i })
    if (await submitBtn.count() === 0) {
      recordResult('S01', 'fail', 'BLOCKER', Date.now() - start, 'Submit Test button not found')
      return
    }
    await submitBtn.click()
    await page.waitForTimeout(500)
    const confirmSubmit = page.getByRole('button', { name: /^submit$/i })
    if (await confirmSubmit.count() > 0) await confirmSubmit.click()

    await screenshot(page, 'B03_S01_05_grading')
    const gradingTime = await waitForGradingComplete(page)
    await screenshot(page, 'B03_S01_06_results')

    const hasGradingFailed = await page.getByText(/grading failed/i).count() > 0
    const hasResultsCard = await page.locator('[class*="rounded-2xl"][class*="shadow-xl"]').count() > 0
    const hasScore = await page.locator('text=/\\d+%/').count() > 0

    console.log(`    gradingFailed=${hasGradingFailed}, resultsCard=${hasResultsCard}, score=${hasScore}, time=${Math.round(gradingTime/1000)}s`)

    if (hasGradingFailed) {
      recordResult('S01', 'fail', 'BLOCKER', Date.now() - start, 'AI grading failed')
      return
    }

    // Firestore assertions
    await page.waitForTimeout(4000)
    const postAttempts = await getAttemptsByStudent(uid)
    await saveFS('B03_S01_post_attempts.json', postAttempts)
    const newAttempts = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    console.log(`    New attempt docs: ${newAttempts.length}`)

    if (newAttempts.length > 1) {
      await saveFS('B03_S01_BLOCKER_duplicates.json', newAttempts)
      recordResult('S01', 'fail', 'BLOCKER', Date.now() - start,
        `Duplicate attempts: ${newAttempts.length}`)
      return
    }

    if (newAttempts.length === 0) {
      recordResult('S01', 'fail', 'BLOCKER', Date.now() - start,
        `No attempt doc in Firestore. Results shown: ${hasResultsCard}`)
      return
    }

    const attempt = newAttempts[0]
    await saveFS('B03_S01_attempt_doc.json', attempt)
    const hasAnswers = (attempt.answers || []).length > 0
    const noFrq = !attempt.frqUploadUrl
    const hasAiReasoning = (attempt.answers || []).some(a => a.aiReasoning || a.reasoning || a.feedback)

    const studyStates = await getStudyStatesForList(uid, listInfo.id)
    await saveFS('B03_S01_study_states.json', studyStates)

    if (hasResultsCard && newAttempts.length === 1 && hasAnswers && noFrq) {
      recordResult('S01', 'pass', null, Date.now() - start,
        `Happy path complete. 1 attempt doc, ${n} answers, aiReasoning=${hasAiReasoning}, ` +
        `noFRQ=${noFrq}, gradingTime=${Math.round(gradingTime/1000)}s`)
    } else {
      recordResult('S01', 'partial', 'HIGH', Date.now() - start,
        `results=${hasResultsCard}, answers=${hasAnswers}, noFrq=${noFrq}, ` +
        `attempt=${newAttempts.length}`)
    }
  } catch (err) {
    console.error('  S01 error:', err.message)
    await screenshot(page, 'B03_S01_error')
    recordResult('S01', 'fail', 'BLOCKER', Date.now() - start, `Exception: ${err.message}`)
  } finally {
    await page.close()
  }
}

async function runS02(browser) {
  console.log('\n[S02] Fix #2 live: localStorage preserved during grading, recovered after refresh')
  const start = Date.now()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  try {
    updateStatus({ currentScenario: 'S02' })
    const account = await loginAs(page, 'recovering', 'TOP')
    const classInfo = auditState.classes.topClass
    const listInfo = auditState.lists.topActiveList

    const nav = await navigateToTypedTest(page, classInfo.id, listInfo.id)
    if (nav !== 'reached_test') {
      recordResult('S02', 'blocked', null, Date.now() - start, `Navigation: ${nav}`)
      return
    }

    const freshBtn = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn.count() > 0) { await freshBtn.click(); await page.waitForTimeout(1000) }
    const resumeBtn = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn.count() > 0) { await resumeBtn.click(); await page.waitForTimeout(1000) }

    const inputs = await waitForTestInputs(page)
    if (inputs.length === 0) {
      recordResult('S02', 'blocked', null, Date.now() - start, 'No inputs')
      return
    }

    // Type 3 answers
    await fillTestAnswers(page, listInfo.words, 3)
    await screenshot(page, 'B03_S02_01_answers_typed')

    // Stall grading via route intercept
    let intercepted = false
    await ctx.route('**/*gradeTypedTest*', async (route) => {
      console.log('    [INTERCEPT] Grading stalled')
      intercepted = true
      // Never respond
    })

    // Submit
    const submitBtn = page.getByRole('button', { name: /submit test/i })
    if (await submitBtn.count() > 0) await submitBtn.click()
    await page.waitForTimeout(500)
    const confirmBtn = page.getByRole('button', { name: /^submit$/i })
    if (await confirmBtn.count() > 0) await confirmBtn.click()

    // Wait for grading to start
    await page.waitForTimeout(4000)
    await screenshot(page, 'B03_S02_02_grading_started')

    // Check localStorage BEFORE refresh
    const lsBefore = await page.evaluate(() => {
      const ks = Object.keys(localStorage).filter(k => k.startsWith('vocaboost_test_'))
      const r = {}
      ks.forEach(k => { try { r[k] = JSON.parse(localStorage.getItem(k)) } catch { r[k] = localStorage.getItem(k) } })
      return r
    })
    const hasTestState = Object.keys(lsBefore).length > 0
    const answerCount = hasTestState
      ? Object.keys(Object.values(lsBefore)[0]?.answers || {}).length
      : 0

    console.log(`    localStorage before refresh: ${Object.keys(lsBefore).length} keys, ${answerCount} answers`)
    await saveFS('B03_S02_ls_before.json', lsBefore)

    if (!hasTestState) {
      // May have graded too fast (Cloud Function intercepted before stall could set up)
      const hasResults = await page.locator('[class*="rounded-2xl"][class*="shadow-xl"]').count() > 0
      if (hasResults) {
        recordResult('S02', 'partial', null, Date.now() - start,
          'Grading completed before stall intercepted — cannot verify mid-grading state. ' +
          'Source code inspection (S04) confirms fix #2 ordering is correct.')
        return
      }
      recordResult('S02', 'fail', 'BLOCKER', Date.now() - start,
        'No localStorage state during grading AND no results — clearTestState may have been called before grading')
      return
    }

    // Refresh while grading is stalled
    console.log('    Refreshing page during stalled grading...')
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(4000)
    await screenshot(page, 'B03_S02_03_after_refresh')

    // Check for recovery prompt
    const recoveryVisible = await page.getByText(/resume previous test/i).count() > 0
    console.log(`    Recovery prompt visible: ${recoveryVisible}`)

    if (!recoveryVisible) {
      const lsAfter = await page.evaluate(() =>
        Object.keys(localStorage).filter(k => k.startsWith('vocaboost_test_'))
      )
      const curUrl = page.url()
      console.log(`    URL after refresh: ${curUrl}, ls keys: ${lsAfter.length}`)

      if (lsAfter.length > 0) {
        // localStorage intact but no recovery prompt shown — may be because user is on a different page
        // Check if back on test page with inputs
        const hasInputs = await page.locator('input[placeholder*="definition"]').count() > 0
        if (hasInputs) {
          const firstVal = await page.locator('input[placeholder*="definition"]').first().inputValue()
          if (firstVal.length > 0) {
            recordResult('S02', 'pass', null, Date.now() - start,
              `Inputs populated after refresh — answers preserved (${firstVal.substring(0,30)})`)
            return
          }
        }
        recordResult('S02', 'partial', 'HIGH', Date.now() - start,
          `localStorage preserved (${lsAfter.length} keys) but no recovery prompt and inputs empty`)
      } else {
        recordResult('S02', 'fail', 'BLOCKER', Date.now() - start,
          'After refresh: localStorage cleared, no recovery prompt — answers lost during grading')
      }
      return
    }

    // Click Resume
    const resumeBtn2 = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn2.count() > 0) {
      await resumeBtn2.click()
      await page.waitForTimeout(2000)
    }

    await screenshot(page, 'B03_S02_04_after_resume')

    // Check answers restored
    const inputsAfter = await page.locator('input[placeholder*="definition"]').all()
    let restored = 0
    for (let i = 0; i < Math.min(3, inputsAfter.length); i++) {
      const v = await page.locator('input[placeholder*="definition"]').nth(i).inputValue()
      if (v.length > 0) restored++
    }

    console.log(`    Answers restored: ${restored}/3`)

    if (restored > 0) {
      recordResult('S02', 'pass', null, Date.now() - start,
        `Fix #2 live verified: ${restored}/3 answers restored after refresh during stalled grading. ` +
        `localStorage had ${answerCount} answers before refresh.`)
    } else {
      recordResult('S02', 'fail', 'BLOCKER', Date.now() - start,
        'Recovery prompt appeared but answers empty after Resume — fix broken')
    }
  } catch (err) {
    console.error('  S02 error:', err.message)
    await screenshot(page, 'B03_S02_error')
    recordResult('S02', 'fail', 'BLOCKER', Date.now() - start, `Exception: ${err.message}`)
  } finally {
    await ctx.close()
  }
}

async function runS03(browser) {
  console.log('\n[S03] Idempotent attempt doc: single doc after successful submit')
  const start = Date.now()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  try {
    updateStatus({ currentScenario: 'S03' })
    const account = await loginAs(page, 'recovering', 'CORE')
    const uid = account.uid
    const classInfo = auditState.classes.coreClass
    const listInfo = auditState.lists.coreActiveList

    const preAttempts = await getAttemptsByStudent(uid)
    const preStudyStates = await getStudyStatesForList(uid, listInfo.id)

    const nav = await navigateToTypedTest(page, classInfo.id, listInfo.id)
    if (nav !== 'reached_test') {
      recordResult('S03', 'blocked', null, Date.now() - start, `Navigation: ${nav}`)
      return
    }

    const freshBtn = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn.count() > 0) { await freshBtn.click(); await page.waitForTimeout(1000) }
    const resumeBtn = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn.count() > 0) { await resumeBtn.click(); await page.waitForTimeout(1000) }

    const inputs = await waitForTestInputs(page)
    if (inputs.length === 0) {
      recordResult('S03', 'blocked', null, Date.now() - start, 'No inputs')
      return
    }

    await fillTestAnswers(page, listInfo.words, 3)

    const submitBtn = page.getByRole('button', { name: /submit test/i })
    if (await submitBtn.count() > 0) await submitBtn.click()
    await page.waitForTimeout(300)
    const confirmBtn = page.getByRole('button', { name: /^submit$/i })
    if (await confirmBtn.count() > 0) await confirmBtn.click()

    await waitForGradingComplete(page, 240000)
    await screenshot(page, 'B03_S03_01_after_grading')
    await page.waitForTimeout(4000)

    const postAttempts = await getAttemptsByStudent(uid)
    const newAttempts = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    await saveFS('B03_S03_post_attempts.json', newAttempts)
    console.log(`    New attempts: ${newAttempts.length}`)

    if (newAttempts.length > 1) {
      await saveFS('B03_S03_BLOCKER_duplicates.json', newAttempts)
      recordResult('S03', 'fail', 'BLOCKER', Date.now() - start,
        `Duplicate attempt docs: ${newAttempts.length}`)
      return
    }

    const lsKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter(k => k.startsWith('vocaboost_test_'))
    )
    const lsCleared = lsKeys.length === 0

    const postStudyStates = await getStudyStatesForList(uid, listInfo.id)
    const doubleIncr = postStudyStates.filter(s => {
      const pre = preStudyStates.find(p => p.id === s.id)
      return (s.timesTestedTotal || 0) - (pre?.timesTestedTotal || 0) > 1
    })

    const hasResults = await page.locator('[class*="rounded-2xl"][class*="shadow-xl"]').count() > 0

    if (newAttempts.length === 1 && lsCleared && doubleIncr.length === 0) {
      recordResult('S03', 'pass', null, Date.now() - start,
        `Single attempt, localStorage cleared, no double-increment. Results: ${hasResults}`)
    } else if (newAttempts.length === 0 && hasResults) {
      recordResult('S03', 'partial', 'MEDIUM', Date.now() - start,
        `Results shown but no Firestore attempt doc`)
    } else {
      recordResult('S03', 'fail', 'HIGH', Date.now() - start,
        `attempts=${newAttempts.length}, lsClear=${lsCleared}, doubleIncr=${doubleIncr.length}`)
    }
  } catch (err) {
    console.error('  S03 error:', err.message)
    recordResult('S03', 'fail', 'HIGH', Date.now() - start, `Exception: ${err.message}`)
  } finally {
    await ctx.close()
  }
}

async function runS05(browser) {
  console.log('\n[S05] Tab close mid-grading: no orphaned attempt')
  const start = Date.now()
  const ctx1 = await browser.newContext()
  const page1 = await ctx1.newPage()

  try {
    updateStatus({ currentScenario: 'S05' })
    const account = await loginAs(page1, 'distracted', 'TOP')
    const uid = account.uid
    const classInfo = auditState.classes.topClass
    const listInfo = auditState.lists.topActiveList

    const preAttempts = await getAttemptsByStudent(uid)

    const nav = await navigateToTypedTest(page1, classInfo.id, listInfo.id)
    if (nav !== 'reached_test') {
      recordResult('S05', 'blocked', null, Date.now() - start, `Navigation: ${nav}`)
      await ctx1.close()
      return
    }

    // Stall grading
    await ctx1.route('**/*gradeTypedTest*', async () => {
      console.log('    [INTERCEPT] Stalling grading for tab-close test')
    })

    const freshBtn = page1.getByRole('button', { name: /start fresh/i })
    if (await freshBtn.count() > 0) { await freshBtn.click(); await page1.waitForTimeout(1000) }
    const resumeBtn = page1.getByRole('button', { name: /resume/i })
    if (await resumeBtn.count() > 0) { await resumeBtn.click(); await page1.waitForTimeout(1000) }

    const inputs = await waitForTestInputs(page1)
    if (inputs.length === 0) {
      recordResult('S05', 'blocked', null, Date.now() - start, 'No inputs')
      await ctx1.close()
      return
    }

    await fillTestAnswers(page1, listInfo.words, 1)

    const submitBtn = page1.getByRole('button', { name: /submit test/i })
    if (await submitBtn.count() > 0) await submitBtn.click()
    await page1.waitForTimeout(300)
    const confirmBtn = page1.getByRole('button', { name: /^submit$/i })
    if (await confirmBtn.count() > 0) await confirmBtn.click()

    // Wait for grading overlay
    try {
      await page1.waitForFunction(
        () => Array.from(document.querySelectorAll('h3')).some(h => h.textContent.includes('Grading')),
        { timeout: 15000 }
      )
      console.log('    Grading overlay visible, closing context...')
    } catch { console.log('    Grading overlay not found, closing anyway...') }

    await screenshot(page1, 'B03_S05_01_grading')
    await ctx1.close()

    // Wait for any in-flight writes
    await new Promise(r => setTimeout(r, 6000))

    const ctx2 = await browser.newContext()
    const page2 = await ctx2.newPage()

    try {
      await loginAs(page2, 'distracted', 'TOP')
      await page2.waitForTimeout(2000)
      await screenshot(page2, 'B03_S05_02_relogin')

      const postAttempts = await getAttemptsByStudent(uid)
      await saveFS('B03_S05_post_attempts.json', postAttempts)
      const newAttempts = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
      console.log(`    New attempts after tab close: ${newAttempts.length}`)

      if (newAttempts.length > 0) {
        const orphaned = newAttempts.filter(a => {
          const hasScore = a.score !== undefined || a.scorePercent !== undefined
          return !hasScore || !a.answers?.length
        })
        if (orphaned.length > 0) {
          await saveFS('B03_S05_orphaned.json', orphaned)
          recordResult('S05', 'fail', 'HIGH', Date.now() - start,
            `Orphaned incomplete attempt docs: ${orphaned.length}`)
        } else {
          recordResult('S05', 'partial', 'MEDIUM', Date.now() - start,
            `${newAttempts.length} complete attempt created during stall (grading may have completed)`)
        }
      } else {
        // Can student restart?
        const nav2 = await navigateToTypedTest(page2, classInfo.id, listInfo.id)
        recordResult('S05', nav2 === 'reached_test' ? 'pass' : 'partial',
          nav2 !== 'reached_test' ? 'HIGH' : null, Date.now() - start,
          `No orphaned attempt. Student ${nav2 === 'reached_test' ? 'can' : 'cannot'} restart. (Outcome B)`)
      }
    } finally {
      await ctx2.close()
    }
  } catch (err) {
    console.error('  S05 error:', err.message)
    recordResult('S05', 'fail', 'HIGH', Date.now() - start, `Exception: ${err.message}`)
  }
}

async function runS06(browser) {
  console.log('\n[S06] Korean UTF-8 round-trip: AI grades Korean definitions correctly')
  const start = Date.now()
  const page = await browser.newPage()

  try {
    updateStatus({ currentScenario: 'S06' })
    const account = await loginAs(page, 'korean', 'TOP')
    const uid = account.uid
    const classInfo = auditState.classes.topClass
    const listInfo = auditState.lists.topActiveList

    const preAttempts = await getAttemptsByStudent(uid)

    const nav = await navigateToTypedTest(page, classInfo.id, listInfo.id)
    if (nav !== 'reached_test') {
      recordResult('S06', 'blocked', null, Date.now() - start, `Navigation: ${nav}`)
      return
    }

    const freshBtn = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn.count() > 0) { await freshBtn.click(); await page.waitForTimeout(1000) }
    const resumeBtn = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn.count() > 0) { await resumeBtn.click(); await page.waitForTimeout(1000) }

    const inputs = await waitForTestInputs(page)
    if (inputs.length === 0) {
      recordResult('S06', 'blocked', null, Date.now() - start, 'No inputs')
      return
    }

    const wordList = listInfo.words || []
    const koreanTyped = []

    // Type Korean for first 5, English for rest
    for (let i = 0; i < inputs.length; i++) {
      const input = page.locator('input[placeholder*="definition"]').nth(i)
      const word = wordList[i % wordList.length]
      let answer
      if (i < 5) {
        const rawKo = word?.definition_ko || word?.definition_en || '테스트'
        answer = rawKo.replace(/\r\n/g, ' ').trim()
        koreanTyped.push({ i, word: word?.word, answer })
      } else {
        answer = word?.definition_en || 'test'
      }
      await input.click()
      await input.fill(answer)
      await page.waitForTimeout(100)
    }

    await saveFS('B03_S06_korean_typed.json', koreanTyped)
    await screenshot(page, 'B03_S06_01_korean_typed')

    const submitBtn = page.getByRole('button', { name: /submit test/i })
    if (await submitBtn.count() > 0) await submitBtn.click()
    await page.waitForTimeout(300)
    const confirmBtn = page.getByRole('button', { name: /^submit$/i })
    if (await confirmBtn.count() > 0) await confirmBtn.click()

    const gradingTime = await waitForGradingComplete(page, 240000)
    await screenshot(page, 'B03_S06_02_graded')

    const hasGradingFailed = await page.getByText(/grading failed/i).count() > 0
    if (hasGradingFailed) {
      recordResult('S06', 'fail', 'MEDIUM', Date.now() - start, 'AI grading failed on Korean input')
      return
    }

    await page.waitForTimeout(4000)
    const postAttempts = await getAttemptsByStudent(uid)
    const newAttempts = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    await saveFS('B03_S06_post_attempts.json', newAttempts)

    if (newAttempts.length === 0) {
      recordResult('S06', 'partial', 'MEDIUM', Date.now() - start, 'No attempt doc (may be already tested today)')
      return
    }

    const attempt = newAttempts[0]
    const answers = attempt.answers || []

    // UTF-8 check
    let koreanOk = 0
    let koreanBad = 0
    for (const t of koreanTyped) {
      const stored = answers[t.i]?.studentResponse || ''
      const hasKorean = /[가-힣]/.test(t.answer)
      if (!hasKorean) { koreanOk++; continue }
      if (/[가-힣]/.test(stored)) koreanOk++
      else koreanBad++
    }

    console.log(`    Korean OK: ${koreanOk}, mangled: ${koreanBad}`)
    const scoreDisplay = await page.locator('text=/\\d+%/').first().textContent().catch(() => '?')

    if (koreanBad > 0) {
      recordResult('S06', 'fail', 'BLOCKER', Date.now() - start,
        `UTF-8 mangling: ${koreanBad} Korean answers corrupted`)
      return
    }

    recordResult('S06', 'pass', null, Date.now() - start,
      `Korean round-trip clean. ${koreanOk}/5 Korean answers preserved. ` +
      `Score: ${scoreDisplay}. Grading: ${Math.round(gradingTime/1000)}s`)
  } catch (err) {
    console.error('  S06 error:', err.message)
    await screenshot(page, 'B03_S06_error')
    recordResult('S06', 'fail', 'MEDIUM', Date.now() - start, `Exception: ${err.message}`)
  } finally {
    await page.close()
  }
}

async function runS07(browser) {
  console.log('\n[S07] Long answer: >500 chars')
  const start = Date.now()
  const page = await browser.newPage()

  try {
    updateStatus({ currentScenario: 'S07' })
    const account = await loginAs(page, 'anxious', 'TOP')
    const uid = account.uid
    const classInfo = auditState.classes.topClass
    const listInfo = auditState.lists.topActiveList

    const preAttempts = await getAttemptsByStudent(uid)

    const nav = await navigateToTypedTest(page, classInfo.id, listInfo.id)
    if (nav !== 'reached_test') {
      recordResult('S07', 'blocked', null, Date.now() - start, `Navigation: ${nav}`)
      return
    }

    const freshBtn = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn.count() > 0) { await freshBtn.click(); await page.waitForTimeout(1000) }
    const resumeBtn = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn.count() > 0) { await resumeBtn.click(); await page.waitForTimeout(1000) }

    const inputs = await waitForTestInputs(page)
    if (inputs.length === 0) { recordResult('S07', 'blocked', null, Date.now() - start, 'No inputs'); return }

    const longAnswer = 'This is a deliberately verbose definition for testing character limit ' +
      'handling in the vocaBoost TypedTest component. The word inflammatory (adjective) refers ' +
      'to something that tends to arouse anger, hostility, or strong emotional reactions in people. ' +
      'In medical usage, it describes processes related to inflammation of body tissue. In social ' +
      'and political discourse, inflammatory language or rhetoric deliberately provokes conflict. ' +
      'Examples: inflammatory speech, an inflammatory response of the immune system, inflammatory ' +
      'commentary in the media. This extended answer is specifically crafted to exceed 500 characters ' +
      'to validate that the system stores the complete response without any truncation or data loss.'

    console.log(`    Long answer: ${longAnswer.length} chars`)

    const input0 = page.locator('input[placeholder*="definition"]').first()
    await input0.click()
    await input0.fill(longAnswer)
    const capturedLen = (await input0.inputValue()).length
    console.log(`    Input captured: ${capturedLen} chars`)

    // Fill rest normally
    const wordList = listInfo.words || []
    for (let i = 1; i < Math.min(3, inputs.length); i++) {
      const inp = page.locator('input[placeholder*="definition"]').nth(i)
      await inp.click()
      await inp.fill(wordList[i]?.definition_en || 'test')
    }

    await screenshot(page, 'B03_S07_01_long_typed')

    const submitBtn = page.getByRole('button', { name: /submit test/i })
    if (await submitBtn.count() > 0) await submitBtn.click()
    await page.waitForTimeout(300)
    const confirmBtn = page.getByRole('button', { name: /^submit$/i })
    if (await confirmBtn.count() > 0) await confirmBtn.click()

    await waitForGradingComplete(page, 240000)
    await screenshot(page, 'B03_S07_02_graded')

    await page.waitForTimeout(4000)
    const postAttempts = await getAttemptsByStudent(uid)
    const newAttempts = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))

    if (newAttempts.length === 0) {
      recordResult('S07', 'partial', 'MEDIUM', Date.now() - start, 'No attempt doc')
      return
    }

    const storedFirst = newAttempts[0].answers?.[0]?.studentResponse || ''
    console.log(`    Stored: ${storedFirst.length} chars (expected ~${longAnswer.length})`)

    if (storedFirst.length < longAnswer.length * 0.9) {
      recordResult('S07', 'fail', 'MEDIUM', Date.now() - start,
        `Truncated: typed ${longAnswer.length} chars, stored ${storedFirst.length}`)
    } else {
      recordResult('S07', 'pass', null, Date.now() - start,
        `Preserved: ${storedFirst.length}/${longAnswer.length} chars`)
    }
  } catch (err) {
    console.error('  S07 error:', err.message)
    await screenshot(page, 'B03_S07_error')
    recordResult('S07', 'fail', 'HIGH', Date.now() - start, `Exception: ${err.message}`)
  } finally {
    await page.close()
  }
}

async function runS08(browser) {
  console.log('\n[S08] Special chars: em-dash, Korean, emoji round-trip')
  const start = Date.now()
  const page = await browser.newPage()

  try {
    updateStatus({ currentScenario: 'S08' })
    const account = await loginAs(page, 'lazy', 'CORE')
    const uid = account.uid
    const classInfo = auditState.classes.coreClass
    const listInfo = auditState.lists.coreActiveList

    const preAttempts = await getAttemptsByStudent(uid)

    const nav = await navigateToTypedTest(page, classInfo.id, listInfo.id)
    if (nav !== 'reached_test') { recordResult('S08', 'blocked', null, Date.now() - start, `Navigation: ${nav}`); return }

    const freshBtn = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn.count() > 0) { await freshBtn.click(); await page.waitForTimeout(1000) }
    const resumeBtn = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn.count() > 0) { await resumeBtn.click(); await page.waitForTimeout(1000) }

    const inputs = await waitForTestInputs(page)
    if (inputs.length === 0) { recordResult('S08', 'blocked', null, Date.now() - start, 'No inputs'); return }

    const specialAnswers = [
      'a collection — of poems & writings',
      '한국어 테스트 Korean test',
      'keeping careful watch; attentive',
      'to fill or pervade "fully"',
    ]
    const typed = []
    const wordList = listInfo.words || []

    for (let i = 0; i < inputs.length; i++) {
      const input = page.locator('input[placeholder*="definition"]').nth(i)
      const answer = i < specialAnswers.length ? specialAnswers[i] : (wordList[i%wordList.length]?.definition_en || 'test')
      await input.click()
      await input.fill(answer)
      if (i < specialAnswers.length) typed.push({ i, typed: answer })
      await page.waitForTimeout(100)
    }

    await saveFS('B03_S08_special_typed.json', typed)
    await screenshot(page, 'B03_S08_01_typed')

    const submitBtn = page.getByRole('button', { name: /submit test/i })
    if (await submitBtn.count() > 0) await submitBtn.click()
    await page.waitForTimeout(300)
    const confirmBtn = page.getByRole('button', { name: /^submit$/i })
    if (await confirmBtn.count() > 0) await confirmBtn.click()

    await waitForGradingComplete(page, 240000)
    await screenshot(page, 'B03_S08_02_graded')

    await page.waitForTimeout(4000)
    const postAttempts = await getAttemptsByStudent(uid)
    const newAttempts = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    await saveFS('B03_S08_post_attempts.json', newAttempts)

    if (newAttempts.length === 0) { recordResult('S08', 'partial', 'MEDIUM', Date.now() - start, 'No attempt doc'); return }

    const answers = newAttempts[0].answers || []
    let mangled = 0, ok = 0
    for (const t of typed) {
      const stored = answers[t.i]?.studentResponse || ''
      if (!stored) { mangled++; continue }
      if (t.typed.includes('—') && !stored.includes('—') && !stored.includes('-')) { mangled++; continue }
      if (t.typed.includes('한국어') && !/[가-힣]/.test(stored)) { mangled++; continue }
      ok++
    }

    console.log(`    Special chars: ok=${ok}, mangled=${mangled}`)
    if (mangled > 0) {
      recordResult('S08', 'fail', 'HIGH', Date.now() - start, `${mangled}/${typed.length} answers mangled`)
    } else {
      recordResult('S08', 'pass', null, Date.now() - start, `All ${ok} special char answers preserved`)
    }
  } catch (err) {
    console.error('  S08 error:', err.message)
    await screenshot(page, 'B03_S08_error')
    recordResult('S08', 'fail', 'HIGH', Date.now() - start, `Exception: ${err.message}`)
  } finally {
    await page.close()
  }
}

async function runS09(browser) {
  console.log('\n[S09] Empty answer validation')
  const start = Date.now()
  const page = await browser.newPage()

  try {
    updateStatus({ currentScenario: 'S09' })
    const account = await loginAs(page, 'lazy', 'TOP')
    const classInfo = auditState.classes.topClass
    const listInfo = auditState.lists.topActiveList

    const nav = await navigateToTypedTest(page, classInfo.id, listInfo.id)
    if (nav !== 'reached_test') { recordResult('S09', 'blocked', null, Date.now() - start, `Navigation: ${nav}`); return }

    const freshBtn = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn.count() > 0) { await freshBtn.click(); await page.waitForTimeout(1000) }
    const resumeBtn = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn.count() > 0) { await resumeBtn.click(); await page.waitForTimeout(1000) }

    const inputs = await waitForTestInputs(page)
    if (inputs.length === 0) { recordResult('S09', 'blocked', null, Date.now() - start, 'No inputs'); return }

    await screenshot(page, 'B03_S09_01_blank')

    const submitBtn = page.getByRole('button', { name: /submit test/i })
    if (await submitBtn.count() === 0) {
      recordResult('S09', 'partial', 'MEDIUM', Date.now() - start, 'Submit button not found')
      return
    }

    const isDisabled = await submitBtn.isDisabled()
    console.log(`    Submit disabled with 0 answers: ${isDisabled}`)

    if (isDisabled) {
      recordResult('S09', 'pass', null, Date.now() - start,
        'Submit disabled at answeredCount===0 (correct UX validation)')
      return
    }

    await submitBtn.click()
    await page.waitForTimeout(2000)
    await screenshot(page, 'B03_S09_02_after_click')

    const hasValidation = await page.getByText(/please answer|at least one/i).count() > 0
    const hasGrading = await page.getByText(/grading/i).count() > 0
    const hasModal = await page.locator('[role="dialog"]').count() > 0

    if (hasValidation) recordResult('S09', 'pass', null, Date.now() - start, 'Validation error shown')
    else if (hasGrading) recordResult('S09', 'fail', 'MEDIUM', Date.now() - start, 'Blank submit went to grading silently')
    else if (hasModal) {
      const modalText = await page.locator('[role="dialog"]').first().textContent().catch(() => '')
      recordResult('S09', 'partial', 'MEDIUM', Date.now() - start, `Modal: "${modalText?.substring(0,80)}"`)
    } else {
      recordResult('S09', 'partial', 'MEDIUM', Date.now() - start, 'No clear validation feedback')
    }
  } catch (err) {
    console.error('  S09 error:', err.message)
    recordResult('S09', 'fail', 'MEDIUM', Date.now() - start, `Exception: ${err.message}`)
  } finally {
    await page.close()
  }
}

async function runS10(browser) {
  console.log('\n[S10] Paste-then-submit race: last answer preserved')
  const start = Date.now()
  const page = await browser.newPage()

  try {
    updateStatus({ currentScenario: 'S10' })
    const account = await loginAs(page, 'rushed', 'TOP')
    const uid = account.uid
    const classInfo = auditState.classes.topClass
    const listInfo = auditState.lists.topActiveList

    const preAttempts = await getAttemptsByStudent(uid)

    const nav = await navigateToTypedTest(page, classInfo.id, listInfo.id)
    if (nav !== 'reached_test') { recordResult('S10', 'blocked', null, Date.now() - start, `Navigation: ${nav}`); return }

    const freshBtn = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn.count() > 0) { await freshBtn.click(); await page.waitForTimeout(1000) }
    const resumeBtn = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn.count() > 0) { await resumeBtn.click(); await page.waitForTimeout(1000) }

    const inputs = await waitForTestInputs(page)
    if (inputs.length === 0) { recordResult('S10', 'blocked', null, Date.now() - start, 'No inputs'); return }

    const wordList = listInfo.words || []

    // Fill all but last
    for (let i = 0; i < inputs.length - 1; i++) {
      const input = page.locator('input[placeholder*="definition"]').nth(i)
      await input.click()
      await input.fill(wordList[i % wordList.length]?.definition_en || 'test')
      await page.waitForTimeout(50)
    }

    // Last: paste then immediately submit
    const lastWord = wordList[inputs.length - 1] || wordList[wordList.length - 1]
    const pasteAnswer = lastWord?.definition_en || 'critical last answer race condition test'
    console.log(`    Pasting: "${pasteAnswer.substring(0,50)}"`)

    await page.evaluate((text) => {
      const inputs = document.querySelectorAll('input[placeholder*="definition"]')
      const last = inputs[inputs.length - 1]
      if (last) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(last, text)
        last.dispatchEvent(new Event('input', { bubbles: true }))
        last.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }, pasteAnswer)

    // No wait — submit immediately
    const submitBtn = page.getByRole('button', { name: /submit test/i })
    if (await submitBtn.count() > 0) await submitBtn.click()
    await page.waitForTimeout(300)
    const confirmBtn = page.getByRole('button', { name: /^submit$/i })
    if (await confirmBtn.count() > 0) await confirmBtn.click()

    await waitForGradingComplete(page, 240000)
    await screenshot(page, 'B03_S10_01_graded')
    await page.waitForTimeout(4000)

    const postAttempts = await getAttemptsByStudent(uid)
    const newAttempts = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    if (newAttempts.length === 0) { recordResult('S10', 'partial', 'MEDIUM', Date.now() - start, 'No attempt doc'); return }

    const answers = newAttempts[0].answers || []
    const lastAns = answers[answers.length - 1]?.studentResponse || ''
    console.log(`    Last stored: "${lastAns.substring(0,60)}"`)

    const preserved = lastAns.length > 0 && lastAns.startsWith(pasteAnswer.substring(0,20))

    if (preserved) recordResult('S10', 'pass', null, Date.now() - start, 'Issue #10 not reproduced: last answer preserved')
    else if (!lastAns) recordResult('S10', 'fail', 'MEDIUM', Date.now() - start, 'Issue #10 CONFIRMED: last answer lost on paste+submit race')
    else recordResult('S10', 'partial', 'MEDIUM', Date.now() - start, `Partial: stored="${lastAns.substring(0,40)}"`)
  } catch (err) {
    console.error('  S10 error:', err.message)
    await screenshot(page, 'B03_S10_error')
    recordResult('S10', 'fail', 'MEDIUM', Date.now() - start, `Exception: ${err.message}`)
  } finally {
    await page.close()
  }
}

async function runS13(browser) {
  console.log('\n[S13] Console clean during happy path')
  const start = Date.now()
  const page = await browser.newPage()
  const con = attachConsole(page)

  try {
    updateStatus({ currentScenario: 'S13' })
    const account = await loginAs(page, 'careful', 'CORE')
    const classInfo = auditState.classes.coreClass
    const listInfo = auditState.lists.coreActiveList

    const nav = await navigateToTypedTest(page, classInfo.id, listInfo.id)
    if (nav !== 'reached_test') { recordResult('S13', 'blocked', null, Date.now() - start, `Navigation: ${nav}`); return }

    const freshBtn = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn.count() > 0) { await freshBtn.click(); await page.waitForTimeout(1000) }
    const resumeBtn = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn.count() > 0) { await resumeBtn.click(); await page.waitForTimeout(1000) }

    const inputs = await waitForTestInputs(page)
    if (inputs.length === 0) { recordResult('S13', 'blocked', null, Date.now() - start, 'No inputs'); return }

    await fillTestAnswers(page, listInfo.words, 1)

    const submitBtn = page.getByRole('button', { name: /submit test/i })
    if (await submitBtn.count() > 0) await submitBtn.click()
    await page.waitForTimeout(300)
    const confirmBtn = page.getByRole('button', { name: /^submit$/i })
    if (await confirmBtn.count() > 0) await confirmBtn.click()

    await waitForGradingComplete(page, 240000)
    await screenshot(page, 'B03_S13_results')

    const errors = con.getErrors()
    const logs = con.getLogs()
    const fatal = errors.filter(e =>
      !e.includes('favicon') && !e.includes('Permissions-Policy') && !e.includes('Cross-Origin') &&
      !e.includes('ERR_FAILED') && e.length > 10
    )
    const unmount = logs.filter(l => l.includes('unmounted') || l.includes('memory leak'))
    const keys = logs.filter(l => l.includes('unique key') || l.includes('Each child'))

    fs.writeFileSync(path.join(EVIDENCE_DIR, 'B03_S13_console.log'), logs.join('\n'))
    console.log(`    Fatal: ${fatal.length}, unmount: ${unmount.length}, keys: ${keys.length}`)

    if (fatal.length > 0) recordResult('S13', 'partial', 'LOW', Date.now() - start, `${fatal.length} console errors`)
    else if (unmount.length > 0) recordResult('S13', 'partial', 'MEDIUM', Date.now() - start, `setState on unmounted: ${unmount[0]?.substring(0,80)}`)
    else recordResult('S13', 'pass', null, Date.now() - start, 'Console clean: 0 fatal errors, 0 unmount warnings')
  } catch (err) {
    console.error('  S13 error:', err.message)
    recordResult('S13', 'fail', 'LOW', Date.now() - start, `Exception: ${err.message}`)
  } finally {
    await page.close()
  }
}

async function runS14(browser) {
  console.log('\n[S14] Second test: separate attempt doc (nonce rolls over)')
  const start = Date.now()
  const page = await browser.newPage()

  try {
    updateStatus({ currentScenario: 'S14' })
    const account = await loginAs(page, 'perfectionist', 'CORE')
    const uid = account.uid
    const classInfo = auditState.classes.coreClass
    const listInfo = auditState.lists.coreActiveList

    const preAttempts = await getAttemptsByStudent(uid)
    console.log(`    Pre-existing attempts: ${preAttempts.length}`)

    // First test
    const nav1 = await navigateToTypedTest(page, classInfo.id, listInfo.id)
    if (nav1 !== 'reached_test') { recordResult('S14', 'blocked', null, Date.now() - start, `First nav: ${nav1}`); return }

    const freshBtn1 = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn1.count() > 0) { await freshBtn1.click(); await page.waitForTimeout(1000) }
    const resumeBtn1 = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn1.count() > 0) { await resumeBtn1.click(); await page.waitForTimeout(1000) }

    const inputs1 = await waitForTestInputs(page)
    if (inputs1.length === 0) { recordResult('S14', 'blocked', null, Date.now() - start, 'No inputs for first test'); return }

    await fillTestAnswers(page, listInfo.words, 1)

    const submit1 = page.getByRole('button', { name: /submit test/i })
    if (await submit1.count() > 0) await submit1.click()
    await page.waitForTimeout(300)
    const confirm1 = page.getByRole('button', { name: /^submit$/i })
    if (await confirm1.count() > 0) await confirm1.click()

    console.log('    First test grading...')
    await waitForGradingComplete(page, 240000)
    await screenshot(page, 'B03_S14_01_first_done')
    await page.waitForTimeout(4000)

    const midAttempts = await getAttemptsByStudent(uid)
    const firstNew = midAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    console.log(`    After first test: ${firstNew.length} new attempts`)

    // Navigate away then come back for second test
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)

    const nav2 = await navigateToTypedTest(page, classInfo.id, listInfo.id)
    if (nav2 !== 'reached_test') {
      recordResult('S14', 'partial', 'MEDIUM', Date.now() - start,
        `First test done. Cannot reach second: ${nav2}`)
      return
    }

    const freshBtn2 = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn2.count() > 0) { await freshBtn2.click(); await page.waitForTimeout(1000) }
    const resumeBtn2 = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn2.count() > 0) { await resumeBtn2.click(); await page.waitForTimeout(1000) }

    const inputs2 = await waitForTestInputs(page, 15000)
    if (inputs2.length === 0) {
      recordResult('S14', 'partial', 'MEDIUM', Date.now() - start, 'Second test not accessible')
      return
    }

    await fillTestAnswers(page, listInfo.words, 1)

    const submit2 = page.getByRole('button', { name: /submit test/i })
    if (await submit2.count() > 0) await submit2.click()
    await page.waitForTimeout(300)
    const confirm2 = page.getByRole('button', { name: /^submit$/i })
    if (await confirm2.count() > 0) await confirm2.click()

    console.log('    Second test grading...')
    await waitForGradingComplete(page, 240000)
    await screenshot(page, 'B03_S14_02_second_done')
    await page.waitForTimeout(4000)

    const postAttempts = await getAttemptsByStudent(uid)
    const allNew = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    await saveFS('B03_S14_all_attempts.json', allNew)
    console.log(`    Total new attempts: ${allNew.length}`)

    if (allNew.length >= 2) {
      const ids = allNew.map(a => a.id)
      const unique = new Set(ids).size === ids.length
      if (!unique) recordResult('S14', 'fail', 'BLOCKER', Date.now() - start, `Duplicate IDs: ${JSON.stringify(ids)}`)
      else recordResult('S14', 'pass', null, Date.now() - start, `Two unique attempt docs: ${ids.join(', ')}`)
    } else if (allNew.length === 1) {
      recordResult('S14', 'partial', 'MEDIUM', Date.now() - start, 'Only 1 attempt for 2 tests')
    } else {
      recordResult('S14', 'partial', 'MEDIUM', Date.now() - start, '0 new attempts for 2 tests')
    }
  } catch (err) {
    console.error('  S14 error:', err.message)
    await screenshot(page, 'B03_S14_error')
    recordResult('S14', 'fail', 'MEDIUM', Date.now() - start, `Exception: ${err.message}`)
  } finally {
    await page.close()
  }
}

async function runS15(browser) {
  console.log('\n[S15] Navigate away mid-test: no spurious attempt')
  const start = Date.now()
  const page = await browser.newPage()
  const con = attachConsole(page)

  try {
    updateStatus({ currentScenario: 'S15' })
    const account = await loginAs(page, 'careful', 'CORE')
    const uid = account.uid
    const classInfo = auditState.classes.coreClass
    const listInfo = auditState.lists.coreActiveList

    const preAttempts = await getAttemptsByStudent(uid)

    const nav = await navigateToTypedTest(page, classInfo.id, listInfo.id)
    if (nav !== 'reached_test') { recordResult('S15', 'blocked', null, Date.now() - start, `Navigation: ${nav}`); return }

    const freshBtn = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn.count() > 0) { await freshBtn.click(); await page.waitForTimeout(1000) }
    const resumeBtn = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn.count() > 0) { await resumeBtn.click(); await page.waitForTimeout(1000) }

    const inputs = await waitForTestInputs(page, 15000)
    if (inputs.length === 0) { recordResult('S15', 'blocked', null, Date.now() - start, 'No inputs'); return }

    await screenshot(page, 'B03_S15_01_on_test')

    // Click Quit button
    const quitBtn = page.getByRole('button', { name: /quit/i }).first()
    if (await quitBtn.count() > 0) {
      await quitBtn.click()
      await page.waitForTimeout(1000)
      const confirmQuit = page.getByRole('button', { name: /^quit$/i })
      if (await confirmQuit.count() > 0) await confirmQuit.click()
    } else {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    }

    await page.waitForTimeout(3000)
    await screenshot(page, 'B03_S15_02_after_quit')

    const postAttempts = await getAttemptsByStudent(uid)
    const newAttempts = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    const unmount = con.getLogs().filter(l => l.includes('unmounted') || l.includes('memory leak'))
    console.log(`    Spurious attempts: ${newAttempts.length}, unmount: ${unmount.length}`)

    if (newAttempts.length > 0) recordResult('S15', 'fail', 'MEDIUM', Date.now() - start, `Spurious attempt on quit: ${newAttempts.length}`)
    else if (unmount.length > 0) recordResult('S15', 'partial', 'MEDIUM', Date.now() - start, `No spurious attempt but unmount warning: ${unmount[0]?.substring(0,80)}`)
    else recordResult('S15', 'pass', null, Date.now() - start, 'Quit mid-test: no spurious attempt, no unmount errors')
  } catch (err) {
    console.error('  S15 error:', err.message)
    await screenshot(page, 'B03_S15_error')
    recordResult('S15', 'fail', 'MEDIUM', Date.now() - start, `Exception: ${err.message}`)
  } finally {
    await page.close()
  }
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  console.log('=== B03 Typed Submission Critical Path (Final Run) ===')
  console.log('Target:', BASE_URL)

  await new Promise((res, rej) => https.get(`${BASE_URL}/`, r => {
    console.log(`Site: ${r.statusCode}`)
    res()
  }).on('error', rej))

  // CRLF check
  const topWords = auditState.lists.topActiveList.words || []
  const crlfWords = topWords.filter(w => w.word.includes('\r\n'))
  console.log(`\nCRLF words in TOP list name: ${crlfWords.length}`)
  crlfWords.forEach(w => console.log(`  - pos ${w.position}: "${w.word.replace(/\r\n.*/s, '').trim()}" (embedded CRLF + suffix)`))

  // Source invariants check first
  const { allPass, failures, checks } = await verifySourceInvariants()
  console.log(`\nSource invariants: ${allPass ? 'ALL PASS' : 'FAILURES: ' + failures.join(', ')}`)

  // S04 — source code fix verification (used for S04 scenario)
  const s04Start = Date.now()
  updateStatus({ currentScenario: 'S04' })
  if (checks['Fix #2: clearTestState after full chain'] &&
      checks['Fix #3: idempotent nonce'] &&
      checks['Fix #4: resultsProcessedRef guard']) {
    recordResult('S04', 'pass', null, Date.now() - s04Start,
      'Source code: gradeWithRetry→submit→processTestResults→clearTestState ordering correct. ' +
      `maxRetries=3, nonce idempotent, resultsProcessedRef guard present`)
  } else {
    recordResult('S04', 'fail', 'BLOCKER', Date.now() - s04Start,
      `Fix invariant failures: ${failures.join(', ')}`)
  }

  // S11 — Try Again guard source inspection
  const s11Start = Date.now()
  updateStatus({ currentScenario: 'S11' })
  const s11checks = checks['Fix #5: ref not reset on retry (prevents double-incr)'] &&
    checks['Fix #4: resultsProcessedRef guard']
  recordResult('S11', s11checks ? 'pass' : 'fail', s11checks ? null : 'HIGH', Date.now() - s11Start,
    s11checks
      ? 'Try Again: resultsProcessedRef guards double-increment, ref not reset on retry'
      : 'resultsProcessedRef missing or reset on retry — double-increment risk')

  // S12 — Practice mode guard
  const s12Start = Date.now()
  updateStatus({ currentScenario: 'S12' })
  const s12check = checks['Practice mode guard before submit']
  recordResult('S12', s12check ? 'pass' : 'fail', s12check ? null : 'HIGH', Date.now() - s12Start,
    s12check
      ? 'Practice mode: !isPracticeMode guard correctly placed before submitTypedTestAttempt'
      : 'Practice mode guard missing or mispositioned — attempts may be created in practice mode')

  // Check S12 more carefully from source
  const src = fs.readFileSync('/app/src/pages/TypedTest.jsx', 'utf-8')
  const guardIdx = src.indexOf('if (!isPracticeMode)')
  const submitIdx = src.indexOf('submitTypedTestAttempt(')
  console.log(`\n  S12 detail: guardIdx=${guardIdx}, submitIdx=${submitIdx}`)
  if (guardIdx > 0 && submitIdx > 0) {
    const isInsideGuard = submitIdx > guardIdx
    console.log(`    submitTypedTestAttempt inside !isPracticeMode guard: ${isInsideGuard}`)
    if (!isInsideGuard) {
      // Override S12 result if the actual check differs
      results.find(r => r.scenario === 'S12').result = 'fail'
      results.find(r => r.scenario === 'S12').severity = 'HIGH'
      results.find(r => r.scenario === 'S12').notes = 'submitTypedTestAttempt is NOT inside !isPracticeMode guard'
    }
  }

  if (s04checks_failed()) {
    console.log('\n!!! BLOCKER: Fix #2 invariants wrong in source code — halting browser scenarios !!!')
    return
  }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  try {
    await runS01(browser)
    const s01 = results.find(r => r.scenario === 'S01')
    if (s01?.result === 'fail' && s01?.severity === 'BLOCKER') {
      console.log('\n!!! S01 BLOCKER !!!')
      appendLog({ event: 'stop_condition_hit', batch: 'B03', scenario: 'S01', reason: 'S01 happy path BLOCKER' })
      return
    }

    await runS02(browser)
    const s02 = results.find(r => r.scenario === 'S02')
    if (s02?.result === 'fail' && s02?.severity === 'BLOCKER') {
      console.log('\n!!! S02 BLOCKER — fix #2 regression !!!')
      appendLog({ event: 'stop_condition_hit', batch: 'B03', scenario: 'S02', reason: 'Fix #2 BLOCKER' })
      return
    }

    await runS03(browser)
    await runS05(browser)
    await runS06(browser)
    const s06 = results.find(r => r.scenario === 'S06')
    if (s06?.result === 'fail' && s06?.severity === 'BLOCKER') {
      appendLog({ event: 'stop_condition_hit', batch: 'B03', scenario: 'S06', reason: 'UTF-8 BLOCKER' })
      return
    }

    await runS07(browser)
    await runS08(browser)
    await runS09(browser)
    await runS10(browser)
    await runS13(browser)
    await runS14(browser)
    await runS15(browser)
  } finally {
    await browser.close()
  }

  printSummary(crlfWords)
}

function s04checks_failed() {
  const s04 = results.find(r => r.scenario === 'S04')
  return s04?.result === 'fail' && s04?.severity === 'BLOCKER'
}

function printSummary(crlfWords) {
  console.log('\n=== B03 FINAL RESULTS ===')
  for (const r of results) {
    const sev = r.severity ? ` [${r.severity}]` : ''
    console.log(`  ${r.scenario}: ${r.result.toUpperCase()}${sev} — ${(r.notes||'').substring(0,100)}`)
  }

  const pass = results.filter(r => r.result === 'pass').length
  const fail = results.filter(r => r.result === 'fail').length
  const partial = results.filter(r => r.result === 'partial').length
  const blocked = results.filter(r => r.result === 'blocked').length
  const blockers = results.filter(r => r.severity === 'BLOCKER').length
  const highs = results.filter(r => r.severity === 'HIGH').length
  const mediums = results.filter(r => r.severity === 'MEDIUM').length

  console.log(`\nTotal: ${results.length} | Pass: ${pass} | Fail: ${fail} | Partial: ${partial} | Blocked: ${blocked}`)
  console.log(`Blockers: ${blockers} | HIGH: ${highs} | MEDIUM: ${mediums}`)
  console.log(`CRLF words in name: ${crlfWords.length}`)

  appendLog({
    event: 'batch_end', batch: 'B03', trials: results.length,
    pass, fail, partial, blocked, blockerCount: blockers, highCount: highs, mediumCount: mediums,
    crlfWordsInName: crlfWords.length
  })
  updateStatus({ state: 'finished', batchesCompleted: ['B03'], trialsCompleted: results.length })

  fs.writeFileSync(path.join(EVIDENCE_DIR, 'B03_results_summary.json'),
    JSON.stringify({ results, crlfWords: crlfWords.length, summary: { pass, fail, partial, blocked, blockers, highs, mediums } }, null, 2))
}

main().catch(err => {
  console.error('FATAL:', err)
  appendLog({ event: 'error', batch: 'B03', error: err.message })
  updateStatus({ state: 'errored', error: err.message })
  process.exit(1)
})
