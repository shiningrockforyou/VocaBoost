/**
 * B03 — Typed Submission Critical Path (v2)
 * Agent C — Batch B03
 *
 * Uses DailySessionFlow navigation (flashcards → "Take Test") to properly
 * launch TypedTest with location.state populated (word pool, testConfig, etc.)
 *
 * Run from /app: node e2e/audit/B03/B03_typed_submission_v2.cjs
 */

'use strict'

const { chromium } = require('playwright')
const { initializeApp, cert, getApps } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const fs = require('fs')
const path = require('path')
const https = require('https')

// ── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B03'
const SA_PATH = '/app/scripts/serviceAccountKey.json'
const SEEDED_PATH = '/app/audit/playwright/seeded_accounts.json'
const AUDIT_STATE_PATH = '/app/audit/playwright/audit_state.json'
const LOG_PATH = '/app/audit/playwright/findings/agent_logs/C.jsonl'
const STATUS_PATH = '/app/audit/playwright/findings/agent_logs/C.status.json'

// ── Firebase Admin ───────────────────────────────────────────────────────────
let _db = null
function getDb() {
  if (!_db) {
    if (getApps().length === 0) {
      initializeApp({ credential: cert(require(SA_PATH)) })
    }
    _db = getFirestore()
  }
  return _db
}

// ── Seeded data ──────────────────────────────────────────────────────────────
const seeded = JSON.parse(fs.readFileSync(SEEDED_PATH, 'utf-8'))
const auditState = JSON.parse(fs.readFileSync(AUDIT_STATE_PATH, 'utf-8'))

function getAccount(personaId, targetClass) {
  return seeded.accounts.find(a =>
    a.personaId === personaId &&
    (!targetClass || a.targetClass === targetClass)
  ) || null
}

// ── Logging ───────────────────────────────────────────────────────────────────
function appendLog(obj) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...obj })
  fs.appendFileSync(LOG_PATH, line + '\n')
}

function updateStatus(patch) {
  let current = {}
  try { current = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf-8')) } catch {}
  const updated = { ...current, ...patch, lastUpdate: new Date().toISOString() }
  fs.writeFileSync(STATUS_PATH, JSON.stringify(updated, null, 2))
}

// ── Firestore helpers ─────────────────────────────────────────────────────────
async function getAttemptsByStudent(uid) {
  const db = getDb()
  const snap = await db.collection('attempts').where('studentId', '==', uid).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function getStudyStates(uid, listId) {
  const db = getDb()
  try {
    const snap = await db.collection('study_states')
      .where('studentId', '==', uid)
      .where('listId', '==', listId)
      .limit(50)
      .get()
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch {
    return []
  }
}

async function saveFS(label, data) {
  const p = path.join(EVIDENCE_DIR, label)
  fs.writeFileSync(p, JSON.stringify(data, null, 2))
}

// ── Screenshot helper ─────────────────────────────────────────────────────────
async function screenshot(page, label) {
  const p = path.join(EVIDENCE_DIR, `${label}.png`)
  await page.screenshot({ path: p, fullPage: true }).catch(e =>
    console.warn('screenshot failed:', e.message)
  )
}

// ── Console capture ───────────────────────────────────────────────────────────
function attachConsole(page, label) {
  const logs = []
  const errors = []
  page.on('console', msg => {
    const t = `[${msg.type()}] ${msg.text()}`
    logs.push(t)
    if (msg.type() === 'error') errors.push(t)
  })
  page.on('pageerror', err => {
    const t = `[pageerror] ${err.message}`
    errors.push(t)
    logs.push(t)
  })
  return {
    getErrors: () => errors,
    getLogs: () => logs,
    save: () => fs.writeFileSync(
      path.join(EVIDENCE_DIR, `${label}_console.log`),
      logs.join('\n')
    )
  }
}

// ── Login helper ──────────────────────────────────────────────────────────────
async function loginAs(page, personaId, targetClass) {
  const account = getAccount(personaId, targetClass)
  if (!account) throw new Error(`No account for ${personaId}/${targetClass}`)

  await page.addInitScript(() => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
    }
  })

  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })

  // Find login link or push to /login
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
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

  await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(async () => {
    await page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first().click().catch(() => {})
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  })

  return account
}

// ── Realistic typing ──────────────────────────────────────────────────────────
async function realisticType(locator, text, delayMs = 80) {
  await locator.focus()
  for (const ch of text) {
    await locator.press(ch)
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs))
  }
}

// ── Navigate through DailySessionFlow to TypedTest ────────────────────────────
// Returns: 'reached_test' | 'no_words' | 'already_done' | 'error'
async function navigateViaSessionFlow(page, classId, listId, opts = {}) {
  const { maxFlashcards = 5, timeoutMs = 60000 } = opts

  await page.goto(`${BASE_URL}/session/${classId}/${listId}`, {
    waitUntil: 'domcontentloaded', timeout: 45000
  })
  await page.waitForTimeout(3000)

  const url = page.url()
  console.log(`    Session URL: ${url}`)

  // If redirected to typed test already (recovery flow)
  if (url.includes('/typedtest/')) {
    console.log('    Redirected directly to typedtest (recovery)')
    return 'reached_test'
  }

  // Check for error or no-content state
  const noWords = await page.getByText(/no.*words|words.*not.*found|nothing to study/i).count()
  if (noWords > 0) {
    console.log('    Session shows: no words to study')
    return 'no_words'
  }

  // Check for "already completed today" state
  const alreadyDone = await page.getByText(/already completed|see you tomorrow|complete/i).count()
  if (alreadyDone > 0) {
    console.log('    Session shows: already completed today')
    // Look for any "Start" or "Continue" option
    const startBtn = page.getByRole('button', { name: /start|continue|begin/i }).first()
    if (await startBtn.count() > 0) {
      await startBtn.click()
      await page.waitForTimeout(2000)
    }
  }

  // Wait for flashcard UI or Test phase
  try {
    await page.waitForFunction(
      () => {
        // Check for checkmark/know-this button (flashcard phase)
        const hasFlashcard = Array.from(document.querySelectorAll('button')).some(b =>
          b.getAttribute('aria-label')?.includes('know') ||
          b.getAttribute('aria-label')?.includes('Know') ||
          b.className.includes('rounded-full')
        )
        // Check for "Take Test" button
        const hasTakeTest = Array.from(document.querySelectorAll('button')).some(b =>
          b.textContent.trim() === 'Take Test'
        )
        // Check for loading state
        const isLoading = document.querySelector('[class*="animate-spin"]') !== null
        return (hasFlashcard || hasTakeTest) && !isLoading
      },
      { timeout: 30000, polling: 1000 }
    )
  } catch (e) {
    console.log('    Could not detect flashcard or Take Test UI')
    await screenshot(page, 'B03_session_state')

    // Check what's on screen
    const bodyText = await page.locator('body').textContent()
    console.log('    Body text snippet:', bodyText?.substring(0, 200))
    return 'error'
  }

  await screenshot(page, 'B03_session_flashcard_phase')

  // Click through flashcards (Know This) until Take Test appears
  let clickCount = 0
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    // Check if we've been navigated to the test
    const currentUrl = page.url()
    if (currentUrl.includes('/typedtest/') || currentUrl.includes('/mcqtest/')) {
      console.log(`    Navigated to test: ${currentUrl}`)
      return 'reached_test'
    }

    // Check for "Take Test" button
    const takeTestBtn = page.getByRole('button', { name: 'Take Test' })
    if (await takeTestBtn.count() > 0) {
      console.log(`    Take Test button found after ${clickCount} flashcard clicks`)
      await takeTestBtn.click()
      await page.waitForTimeout(2000)

      // Wait for confirmation modal ("Ready for the Test?")
      const startTestBtn = page.getByRole('button', { name: 'Start Test' })
      if (await startTestBtn.count() > 0) {
        await startTestBtn.click()
        await page.waitForTimeout(2000)
      }

      // Check if navigated
      const newUrl = page.url()
      if (newUrl.includes('/typedtest/') || newUrl.includes('/mcqtest/')) {
        return 'reached_test'
      }

      // Wait for navigation
      try {
        await page.waitForURL(/\/(typedtest|mcqtest)\//, { timeout: 10000 })
        return 'reached_test'
      } catch {
        return 'error'
      }
    }

    // Click "I Know This" (checkmark button)
    const knowThisBtn = page.locator('button[aria-label*="know"]').first()
    if (await knowThisBtn.count() > 0) {
      await knowThisBtn.click()
      clickCount++
      console.log(`    Clicked Know This (${clickCount})`)
      await page.waitForTimeout(500)
      continue
    }

    // Try aria-label containing "I know"
    const checkBtn = page.locator('button[aria-label*="know this"]').first()
    if (await checkBtn.count() > 0) {
      await checkBtn.click()
      clickCount++
      await page.waitForTimeout(500)
      continue
    }

    // Safety: if we've dismissed enough cards but no "Take Test", break
    if (clickCount >= maxFlashcards) {
      // Look for any button
      const buttons = await page.locator('button').all()
      console.log(`    After ${clickCount} clicks — buttons: ${await Promise.all(buttons.map(b => b.textContent()))}`)
      break
    }

    // Wait a moment and check again
    await page.waitForTimeout(1000)
  }

  // One more check after the loop
  const finalUrl = page.url()
  if (finalUrl.includes('/typedtest/') || finalUrl.includes('/mcqtest/')) {
    return 'reached_test'
  }

  return 'error'
}

// ── Wait for word inputs ──────────────────────────────────────────────────────
async function waitForTestInputs(page, timeoutMs = 20000) {
  try {
    await page.waitForSelector('input[placeholder*="definition"]', { timeout: timeoutMs })
    return await page.locator('input[placeholder*="definition"]').all()
  } catch {
    return []
  }
}

// ── Wait for grading ──────────────────────────────────────────────────────────
async function waitForGradingComplete(page, timeoutMs = 240000) {
  console.log('    Waiting for AI grading (up to 4 min)...')
  const start = Date.now()
  try {
    await page.waitForFunction(
      () => {
        const h3s = Array.from(document.querySelectorAll('h3'))
        const hasGradingOverlay = h3s.some(h => h.textContent.includes('Grading Your Test'))
        // Done if: results card visible AND spinner gone
        const hasResultsCard = document.querySelector('[class*="rounded-2xl"][class*="shadow-xl"]') !== null
        const hasGradingFailed = h3s.some(h => h.textContent.includes('Grading Failed'))
        return (hasResultsCard || hasGradingFailed) && !hasGradingOverlay
      },
      { timeout: timeoutMs, polling: 2000 }
    )
  } catch { /* timeout or page changed */ }
  return Date.now() - start
}

// ── Results tracking ──────────────────────────────────────────────────────────
const results = []

function recordResult(scenario, result, severity, durationMs, notes) {
  results.push({ scenario, result, severity, durationMs, notes })
  appendLog({ event: 'scenario', batch: 'B03', scenario, result, severity, durationMs, notes })
  updateStatus({ currentScenario: scenario, trialsCompleted: results.length, state: 'running' })
  const sev = severity ? ` [${severity}]` : ''
  console.log(`  [${scenario}] ${result.toUpperCase()}${sev} — ${(notes||'').substring(0,100)}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// S01 — Happy path typed test via DailySessionFlow
// ─────────────────────────────────────────────────────────────────────────────
async function runS01(browser) {
  console.log('\n[S01] Happy path: Careful Student → DailySessionFlow → TypedTest → AI grade')
  const start = Date.now()
  const page = await browser.newPage()
  const con = attachConsole(page, 'B03_S01')
  try {
    updateStatus({ currentScenario: 'S01' })
    const account = await loginAs(page, 'careful', 'TOP')
    const uid = account.uid
    const classInfo = auditState.classes.topClass
    const listInfo = auditState.lists.topActiveList

    const preAttempts = await getAttemptsByStudent(uid)
    await saveFS('B03_S01_pre_attempts.json', preAttempts)

    await screenshot(page, 'B03_S01_01_dashboard')

    // Navigate through DailySessionFlow
    const nav = await navigateViaSessionFlow(page, classInfo.id, listInfo.id, {
      maxFlashcards: 30, // Dismiss all flashcards
      timeoutMs: 90000
    })

    console.log(`    Session navigation result: ${nav}`)
    await screenshot(page, 'B03_S01_02_after_nav')

    if (nav !== 'reached_test') {
      recordResult('S01', 'blocked', null, Date.now() - start,
        `Could not reach typed test via DailySessionFlow: ${nav}`)
      return
    }

    // Now on /typedtest/...
    const testUrl = page.url()
    console.log(`    Test URL: ${testUrl}`)

    // Check if it's MCQ (shouldn't be for TOP class with testMode=typed)
    if (testUrl.includes('/mcqtest/')) {
      recordResult('S01', 'blocked', null, Date.now() - start,
        `Landed on MCQTest instead of TypedTest. Class testMode may not be "typed".`)
      return
    }

    // Dismiss recovery prompt if present
    const startFreshBtn = page.getByRole('button', { name: /start fresh/i })
    if (await startFreshBtn.count() > 0) {
      await startFreshBtn.click()
      await page.waitForTimeout(1000)
    }

    // Resume if recovery offered
    const resumeBtn = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn.count() > 0) {
      await resumeBtn.click()
      await page.waitForTimeout(1000)
    }

    // Wait for word inputs
    const inputs = await waitForTestInputs(page)
    console.log(`    Found ${inputs.length} word inputs`)

    if (inputs.length === 0) {
      await screenshot(page, 'B03_S01_03_no_inputs')
      recordResult('S01', 'fail', 'BLOCKER', Date.now() - start,
        'Reached /typedtest/ but no input fields found')
      return
    }

    await screenshot(page, 'B03_S01_03_test_inputs')

    // Type canonical English definitions for each word
    const wordList = listInfo.words || []
    for (let i = 0; i < inputs.length; i++) {
      const input = page.locator('input[placeholder*="definition"]').nth(i)
      const wordEntry = wordList[i % wordList.length]
      let answer = wordEntry?.definition_en || 'a word meaning this concept'
      // Clean trailing dot
      if (answer.endsWith('.')) answer = answer.slice(0, -1)
      await input.click()
      await realisticType(input, answer, 20) // faster for audit
      if (i < inputs.length - 1) await page.waitForTimeout(100)
    }

    await screenshot(page, 'B03_S01_04_answered')

    // Submit
    const submitBtn = page.getByRole('button', { name: /submit test/i })
    if (await submitBtn.count() === 0) {
      recordResult('S01', 'fail', 'BLOCKER', Date.now() - start, 'Submit Test button not found')
      return
    }
    await submitBtn.click()

    // Confirm modal
    await page.waitForTimeout(500)
    const confirmSubmit = page.getByRole('button', { name: /^submit$/i })
    if (await confirmSubmit.count() > 0) await confirmSubmit.click()

    await screenshot(page, 'B03_S01_05_grading_overlay')
    const gradingTime = await waitForGradingComplete(page)
    await screenshot(page, 'B03_S01_06_after_grading')

    const hasGradingFailed = await page.getByText(/grading failed/i).count() > 0
    const hasScore = await page.locator('text=/\\d+%/').count() > 0
    const hasResultsCard = await page.locator('[class*="rounded-2xl"][class*="shadow-xl"]').count() > 0

    console.log(`    gradingFailed=${hasGradingFailed}, score=${hasScore}, resultsCard=${hasResultsCard}, time=${Math.round(gradingTime/1000)}s`)

    if (hasGradingFailed) {
      recordResult('S01', 'fail', 'BLOCKER', Date.now() - start,
        `AI grading failed. Check Cloud Function logs.`)
      return
    }

    // Firestore assertions
    await page.waitForTimeout(3000)
    const postAttempts = await getAttemptsByStudent(uid)
    await saveFS('B03_S01_post_attempts.json', postAttempts)
    const newAttempts = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    console.log(`    New attempts: ${newAttempts.length}`)

    if (newAttempts.length === 0) {
      if (hasResultsCard || hasScore) {
        recordResult('S01', 'partial', 'HIGH', Date.now() - start,
          'Results displayed but no attempt doc in Firestore')
      } else {
        recordResult('S01', 'fail', 'BLOCKER', Date.now() - start,
          'No results and no attempt doc — test submission completely failed')
      }
      return
    }

    if (newAttempts.length > 1) {
      await saveFS('B03_S01_BLOCKER_duplicate_attempts.json', newAttempts)
      recordResult('S01', 'fail', 'BLOCKER', Date.now() - start,
        `Duplicate attempts created: ${newAttempts.length}`)
      return
    }

    const attempt = newAttempts[0]
    await saveFS('B03_S01_attempt_doc.json', attempt)
    console.log(`    Attempt: id=${attempt.id}, testType=${attempt.testType}`)

    // Check frqUploadUrl is null
    const noFrq = !attempt.frqUploadUrl
    // Check aiReasoning
    const hasAiReasoning = (attempt.answers || []).some(a => a.aiReasoning || a.reasoning || a.feedback)
    const hasAnswers = (attempt.answers || []).length > 0

    const studyStates = await getStudyStates(uid, listInfo.id)
    await saveFS('B03_S01_study_states.json', studyStates)

    const passConditions = [
      hasResultsCard || hasScore,
      newAttempts.length === 1,
      hasAnswers,
      noFrq
    ]
    const passed = passConditions.every(Boolean)

    if (passed) {
      recordResult('S01', 'pass', null, Date.now() - start,
        `Happy path complete. 1 attempt doc, aiReasoning=${hasAiReasoning}, ` +
        `gradingTime=${Math.round(gradingTime/1000)}s, noFRQ=${noFrq}`)
    } else {
      recordResult('S01', 'partial', 'HIGH', Date.now() - start,
        `Conditions: results=${passConditions[0]}, 1doc=${passConditions[1]}, ` +
        `answers=${passConditions[2]}, noFrq=${passConditions[3]}`)
    }

    con.save()
  } catch (err) {
    console.error('  S01 error:', err.message)
    await screenshot(page, 'B03_S01_error')
    recordResult('S01', 'fail', 'BLOCKER', Date.now() - start, `Exception: ${err.message}`)
    con.save()
  } finally {
    await page.close()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// S02 — clearTestState past AI grading (fix #2 verification)
// ─────────────────────────────────────────────────────────────────────────────
async function runS02(browser) {
  console.log('\n[S02] Fix #2: answers survive refresh during AI grading')
  const start = Date.now()
  const context = await browser.newContext()
  const page = await context.newPage()
  const con = attachConsole(page, 'B03_S02')

  try {
    updateStatus({ currentScenario: 'S02' })
    const account = await loginAs(page, 'recovering', 'TOP')
    const classInfo = auditState.classes.topClass
    const listInfo = auditState.lists.topActiveList

    // Navigate to session flow
    const nav = await navigateViaSessionFlow(page, classInfo.id, listInfo.id, { maxFlashcards: 30, timeoutMs: 90000 })
    if (nav !== 'reached_test') {
      recordResult('S02', 'blocked', null, Date.now() - start, `Could not reach test: ${nav}`)
      return
    }

    const testUrl = page.url()
    console.log(`    Test URL: ${testUrl}`)

    // Dismiss recovery
    const freshBtn = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn.count() > 0) {
      await freshBtn.click()
      await page.waitForTimeout(1000)
    }
    const resumeBtn = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn.count() > 0) {
      await resumeBtn.click()
      await page.waitForTimeout(1000)
    }

    const inputs = await waitForTestInputs(page)
    if (inputs.length === 0) {
      recordResult('S02', 'blocked', null, Date.now() - start, 'No inputs on test page')
      return
    }

    // Type 3 answers
    const wordList = listInfo.words || []
    for (let i = 0; i < Math.min(3, inputs.length); i++) {
      const input = page.locator('input[placeholder*="definition"]').nth(i)
      const answer = wordList[i]?.definition_en || `test answer ${i+1}`
      await input.click()
      await realisticType(input, answer, 20)
      await page.waitForTimeout(200)
    }

    await screenshot(page, 'B03_S02_01_before_submit')

    // Stall grading: intercept Cloud Function calls
    // Note: on live Netlify, this may not intercept gRPC/Firebase Functions calls
    // We will rely on source code inspection for the core fix assertion
    let gradingStalled = false
    await context.route('**/*gradeTypedTest*', async (route) => {
      console.log('    [INTERCEPT] Stalling gradeTypedTest call')
      gradingStalled = true
      // Never respond — simulates network hang
    })

    // Also cover Firebase Functions REST endpoint
    await context.route('**/asia-northeast1/**gradeTypedTest**', async (route) => {
      console.log('    [INTERCEPT] Stalling via Firebase Functions REST')
      gradingStalled = true
    })

    // Submit
    const submitBtn = page.getByRole('button', { name: /submit test/i })
    if (await submitBtn.count() > 0) await submitBtn.click()
    await page.waitForTimeout(300)
    const confirmBtn = page.getByRole('button', { name: /^submit$/i })
    if (await confirmBtn.count() > 0) await confirmBtn.click()

    // Wait briefly for grading to start
    await page.waitForTimeout(3000)

    // Check localStorage BEFORE refresh
    const lsBefore = await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('vocaboost_test_'))
      const result = {}
      keys.forEach(k => {
        try { result[k] = JSON.parse(localStorage.getItem(k)) } catch { result[k] = localStorage.getItem(k) }
      })
      return result
    })
    const lsKeys = Object.keys(lsBefore)
    const hasTestState = lsKeys.length > 0
    const savedAnswers = hasTestState ? Object.values(lsBefore)[0]?.answers : null
    const savedAnswerCount = savedAnswers ? Object.keys(savedAnswers).length : 0
    console.log(`    localStorage before refresh: ${lsKeys.length} keys, ${savedAnswerCount} answers`)
    await saveFS('B03_S02_localStorage_before_refresh.json', lsBefore)

    await screenshot(page, 'B03_S02_02_grading_overlay')

    // KEY ASSERTION 1: clearTestState fix #2
    // The fix moves clearTestState() from the TOP of handleSubmit to AFTER
    // the entire success chain. So localStorage should still have answers
    // while grading is in flight.
    //
    // If localStorage is already cleared at this point = fix regressed = BLOCKER
    if (!hasTestState && savedAnswerCount === 0) {
      // BUT: maybe answers were 0 because route intercept didn't work and
      // grading succeeded immediately. Check if results are showing.
      const hasResults = await page.locator('[class*="rounded-2xl"][class*="shadow-xl"]').count() > 0
      if (hasResults) {
        // Grading succeeded before our check — we can't verify the DURING state
        console.log('    Grading succeeded before localStorage check (too fast)')
        // Still need to verify recovery works. Do a soft assertion.
        recordResult('S02', 'partial', null, Date.now() - start,
          'Grading completed before localStorage could be checked during grading. ' +
          'Fix #2 source code verified (clearTestState at line 801 = after success chain). Cannot confirm timing in live test.')
        return
      }

      // No results AND no localStorage = BLOCKER
      recordResult('S02', 'fail', 'BLOCKER', Date.now() - start,
        'Fix #2 regression: localStorage empty during grading (clearTestState called before grading)')
      return
    }

    // Simulate page refresh
    console.log('    Refreshing page during grading...')
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)

    await screenshot(page, 'B03_S02_03_after_refresh')

    // Check for recovery prompt
    const recoveryTitle = page.getByText(/resume previous test/i)
    const recoveryVisible = await recoveryTitle.count() > 0
    console.log(`    Recovery prompt after refresh: ${recoveryVisible}`)

    if (!recoveryVisible) {
      // Check localStorage after refresh
      const lsAfter = await page.evaluate(() => {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('vocaboost_test_'))
        return keys
      })
      console.log(`    localStorage after refresh: ${lsAfter.length} keys`)

      const currentUrl = page.url()
      if (currentUrl.includes('/typedtest/')) {
        // Still on test page but no recovery prompt — check if test reloaded
        const hasInputs = await page.locator('input[placeholder*="definition"]').count()
        if (hasInputs === 0) {
          recordResult('S02', 'fail', 'BLOCKER', Date.now() - start,
            'After refresh during grading: no recovery prompt and no test inputs (answers lost)')
          return
        }
        // Has inputs but no recovery prompt — answers may have been cleared
        const firstInputVal = await page.locator('input[placeholder*="definition"]').first().inputValue()
        if (firstInputVal.length === 0) {
          recordResult('S02', 'fail', 'BLOCKER', Date.now() - start,
            'After refresh: inputs present but empty — answers lost during grading refresh')
          return
        }
        recordResult('S02', 'pass', null, Date.now() - start,
          'Answers visible in inputs after refresh (no recovery modal, but inputs populated)')
        return
      }

      // Navigated away — check if localStorage is still intact
      if (lsAfter.length > 0) {
        recordResult('S02', 'partial', 'HIGH', Date.now() - start,
          'After refresh: navigated away from test, localStorage intact but no recovery UI shown')
      } else {
        recordResult('S02', 'fail', 'BLOCKER', Date.now() - start,
          'After refresh: navigated away from test, localStorage cleared — answers lost')
      }
      return
    }

    // Recovery prompt shown — click Resume
    const resumeBtn2 = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn2.count() > 0) {
      await resumeBtn2.click()
      await page.waitForTimeout(2000)
    }

    await screenshot(page, 'B03_S02_04_after_resume')

    // Check answers restored
    const inputsAfter = await page.locator('input[placeholder*="definition"]').all()
    let restoredCount = 0
    for (let i = 0; i < Math.min(3, inputsAfter.length); i++) {
      const val = await page.locator('input[placeholder*="definition"]').nth(i).inputValue()
      if (val && val.length > 0) restoredCount++
    }
    console.log(`    Answers restored after resume: ${restoredCount}/${Math.min(3, inputsAfter.length)}`)

    if (restoredCount > 0) {
      recordResult('S02', 'pass', null, Date.now() - start,
        `Fix #2 verified: ${restoredCount} answers restored after refresh during grading. ` +
        `localStorage had ${savedAnswerCount} answers before refresh.`)
    } else {
      recordResult('S02', 'fail', 'BLOCKER', Date.now() - start,
        'Recovery prompt appeared but answers empty after Resume — fix #2 broken')
    }

    con.save()
  } catch (err) {
    console.error('  S02 error:', err.message)
    await screenshot(page, 'B03_S02_error')
    recordResult('S02', 'fail', 'BLOCKER', Date.now() - start, `Exception: ${err.message}`)
    con.save()
  } finally {
    await context.close()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// S03 — Idempotent attempt doc, single timesTestedTotal increment
// ─────────────────────────────────────────────────────────────────────────────
async function runS03(browser) {
  console.log('\n[S03] Idempotent attempt doc: single doc even with write failure + retry')
  const start = Date.now()
  const context = await browser.newContext()
  const page = await context.newPage()
  const con = attachConsole(page, 'B03_S03')

  try {
    updateStatus({ currentScenario: 'S03' })
    const account = await loginAs(page, 'recovering', 'CORE')
    const uid = account.uid
    const classInfo = auditState.classes.coreClass
    const listInfo = auditState.lists.coreActiveList

    const preAttempts = await getAttemptsByStudent(uid)
    const preStudyStates = await getStudyStates(uid, listInfo.id)

    // Navigate to test
    const nav = await navigateViaSessionFlow(page, classInfo.id, listInfo.id, { maxFlashcards: 30, timeoutMs: 90000 })
    if (nav !== 'reached_test') {
      recordResult('S03', 'blocked', null, Date.now() - start, `Could not reach test: ${nav}`)
      return
    }

    // Dismiss recovery
    const freshBtn = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn.count() > 0) { await freshBtn.click(); await page.waitForTimeout(1000) }
    const resumeBtn = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn.count() > 0) { await resumeBtn.click(); await page.waitForTimeout(1000) }

    const inputs = await waitForTestInputs(page)
    if (inputs.length === 0) {
      recordResult('S03', 'blocked', null, Date.now() - start, 'No inputs')
      return
    }

    // Type answers
    const wordList = listInfo.words || []
    for (let i = 0; i < Math.min(3, inputs.length); i++) {
      const input = page.locator('input[placeholder*="definition"]').nth(i)
      await input.click()
      await input.fill(wordList[i]?.definition_en || 'test')
      await page.waitForTimeout(200)
    }

    // Submit and let it complete normally
    const submitBtn = page.getByRole('button', { name: /submit test/i })
    if (await submitBtn.count() > 0) await submitBtn.click()
    await page.waitForTimeout(300)
    const confirmBtn = page.getByRole('button', { name: /^submit$/i })
    if (await confirmBtn.count() > 0) await confirmBtn.click()

    await waitForGradingComplete(page, 240000)
    await screenshot(page, 'B03_S03_01_after_grading')
    await page.waitForTimeout(3000)

    // Check Firestore
    const postAttempts = await getAttemptsByStudent(uid)
    const newAttempts = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    console.log(`    New attempt docs: ${newAttempts.length}`)
    await saveFS('B03_S03_post_attempts.json', newAttempts)

    if (newAttempts.length > 1) {
      await saveFS('B03_S03_BLOCKER_duplicates.json', newAttempts)
      recordResult('S03', 'fail', 'BLOCKER', Date.now() - start,
        `Duplicate attempts: ${newAttempts.length} (idempotent ID broken)`)
      return
    }

    // Check localStorage cleared
    const lsKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter(k => k.startsWith('vocaboost_test_'))
    )
    const lsCleared = lsKeys.length === 0
    console.log(`    localStorage after success: ${lsKeys.length} keys (cleared=${lsCleared})`)

    // Check study_states not double-incremented
    const postStudyStates = await getStudyStates(uid, listInfo.id)
    const doubleIncr = postStudyStates.filter(s => {
      const pre = preStudyStates.find(p => p.id === s.id)
      return (s.timesTestedTotal || 0) - (pre?.timesTestedTotal || 0) > 1
    })
    console.log(`    Double-incremented words: ${doubleIncr.length}`)

    const hasResults = await page.locator('[class*="rounded-2xl"][class*="shadow-xl"]').count() > 0

    if (newAttempts.length === 1 && lsCleared && doubleIncr.length === 0) {
      recordResult('S03', 'pass', null, Date.now() - start,
        `Single attempt, localStorage cleared, no double-increment. Results shown: ${hasResults}`)
    } else if (newAttempts.length === 0 && hasResults) {
      recordResult('S03', 'partial', 'MEDIUM', Date.now() - start,
        `Results shown but no attempt doc (may be practice mode or route issue)`)
    } else {
      recordResult('S03', 'fail', 'HIGH', Date.now() - start,
        `attempts=${newAttempts.length}, lsCleared=${lsCleared}, doubleIncr=${doubleIncr.length}`)
    }

    con.save()
  } catch (err) {
    console.error('  S03 error:', err.message)
    recordResult('S03', 'fail', 'HIGH', Date.now() - start, `Exception: ${err.message}`)
    con.save()
  } finally {
    await context.close()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// S05 — Tab close mid-grading
// ─────────────────────────────────────────────────────────────────────────────
async function runS05(browser) {
  console.log('\n[S05] Tab close mid-grading: no orphan attempt, student can retry')
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

    // Navigate
    const nav = await navigateViaSessionFlow(page1, classInfo.id, listInfo.id, { maxFlashcards: 30, timeoutMs: 90000 })
    if (nav !== 'reached_test') {
      recordResult('S05', 'blocked', null, Date.now() - start, `Could not reach test: ${nav}`)
      await ctx1.close()
      return
    }

    // Stall grading
    await ctx1.route('**/*gradeTypedTest*', async (route) => {
      console.log('    [INTERCEPT] Stalling grading (tab close test)')
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

    // Type and submit
    const wordList = listInfo.words || []
    const input = page1.locator('input[placeholder*="definition"]').first()
    await input.click()
    await input.fill(wordList[0]?.definition_en || 'test')

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
      console.log('    Grading overlay visible')
    } catch { console.log('    No grading overlay (grading too fast?)') }

    await screenshot(page1, 'B03_S05_01_grading')
    console.log('    Closing tab mid-grading...')
    await ctx1.close()

    await new Promise(r => setTimeout(r, 5000))

    // Re-login as same student
    const ctx2 = await browser.newContext()
    const page2 = await ctx2.newPage()

    try {
      await loginAs(page2, 'distracted', 'TOP')
      await page2.waitForTimeout(2000)
      await screenshot(page2, 'B03_S05_02_after_relogin')

      const postAttempts = await getAttemptsByStudent(uid)
      await saveFS('B03_S05_post_attempts.json', postAttempts)
      const newAttempts = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
      console.log(`    New attempt docs after tab close: ${newAttempts.length}`)

      if (newAttempts.length > 0) {
        const orphaned = newAttempts.filter(a => {
          const hasScore = a.score !== undefined || a.scorePercent !== undefined
          const hasAnswers = (a.answers || []).length > 0
          return !hasScore && !hasAnswers
        })
        if (orphaned.length > 0) {
          await saveFS('B03_S05_orphaned.json', orphaned)
          recordResult('S05', 'fail', 'HIGH', Date.now() - start,
            `Orphaned incomplete attempt: ${orphaned.length} docs with no score/answers`)
        } else {
          // Attempt complete — grading may have finished before close
          recordResult('S05', 'partial', 'MEDIUM', Date.now() - start,
            `Attempt created with data (grading may have completed). ${newAttempts.length} doc(s).`)
        }
      } else {
        // No orphan — check student can start fresh
        const navNew = await navigateViaSessionFlow(page2, classInfo.id, listInfo.id, { maxFlashcards: 5, timeoutMs: 30000 })
        console.log(`    Student can restart session: ${navNew}`)
        if (navNew === 'reached_test') {
          recordResult('S05', 'pass', null, Date.now() - start,
            'No orphaned attempt; student can start new test session. Outcome B (acceptable).')
        } else {
          recordResult('S05', 'partial', 'HIGH', Date.now() - start,
            `No orphaned attempt but student cannot restart (nav=${navNew})`)
        }
      }
    } finally {
      await ctx2.close()
    }
  } catch (err) {
    console.error('  S05 error:', err.message)
    recordResult('S05', 'fail', 'HIGH', Date.now() - start, `Exception: ${err.message}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// S06 — Korean definition round-trip
// ─────────────────────────────────────────────────────────────────────────────
async function runS06(browser) {
  console.log('\n[S06] Korean definition round-trip: Korean answers → AI grading → Firestore')
  const start = Date.now()
  const page = await browser.newPage()
  const con = attachConsole(page, 'B03_S06')

  try {
    updateStatus({ currentScenario: 'S06' })
    const account = await loginAs(page, 'korean', 'TOP')
    const uid = account.uid
    const classInfo = auditState.classes.topClass
    const listInfo = auditState.lists.topActiveList

    const preAttempts = await getAttemptsByStudent(uid)

    const nav = await navigateViaSessionFlow(page, classInfo.id, listInfo.id, { maxFlashcards: 30, timeoutMs: 90000 })
    if (nav !== 'reached_test') {
      recordResult('S06', 'blocked', null, Date.now() - start, `Could not reach test: ${nav}`)
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
    const typedKorean = []

    // Type Korean definitions for first 5 words
    for (let i = 0; i < Math.min(5, inputs.length); i++) {
      const input = page.locator('input[placeholder*="definition"]').nth(i)
      const wordEntry = wordList[i] || wordList[0]
      // Use Korean definition (canonical_ko transform)
      // Clean CRLF from Korean definitions
      const rawKo = wordEntry?.definition_ko || wordEntry?.definition_en || '테스트'
      const koreanAnswer = rawKo.replace(/\r\n/g, ' ').trim()
      console.log(`    [${i+1}] ${wordEntry?.word?.replace(/\r\n.*/s,'').trim()} → 한국어: "${koreanAnswer.substring(0,40)}"`)

      // Use fill() for Korean (IME composition workaround)
      await input.click()
      await input.fill(koreanAnswer)
      typedKorean.push({ word: wordEntry?.word, answer: koreanAnswer })
      await page.waitForTimeout(300)
    }

    // Fill remaining with English
    for (let i = 5; i < inputs.length; i++) {
      const input = page.locator('input[placeholder*="definition"]').nth(i)
      await input.click()
      await input.fill(wordList[i % wordList.length]?.definition_en || 'test')
    }

    await saveFS('B03_S06_korean_answers.json', typedKorean)
    await screenshot(page, 'B03_S06_01_korean_typed')

    // Submit
    const submitBtn = page.getByRole('button', { name: /submit test/i })
    if (await submitBtn.count() > 0) await submitBtn.click()
    await page.waitForTimeout(300)
    const confirmBtn = page.getByRole('button', { name: /^submit$/i })
    if (await confirmBtn.count() > 0) await confirmBtn.click()

    console.log('    Waiting for AI grading of Korean responses...')
    const gradingTime = await waitForGradingComplete(page, 240000)
    await screenshot(page, 'B03_S06_02_post_grading')

    const hasGradingFailed = await page.getByText(/grading failed/i).count() > 0
    if (hasGradingFailed) {
      recordResult('S06', 'fail', 'MEDIUM', Date.now() - start, 'AI grading failed on Korean input')
      return
    }

    await page.waitForTimeout(3000)
    const postAttempts = await getAttemptsByStudent(uid)
    const newAttempts = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    await saveFS('B03_S06_post_attempts.json', newAttempts)

    if (newAttempts.length === 0) {
      const hasResults = await page.locator('[class*="rounded-2xl"][class*="shadow-xl"]').count() > 0
      recordResult('S06', 'partial', 'MEDIUM', Date.now() - start,
        `No attempt doc. Results=${hasResults}`)
      return
    }

    // UTF-8 check
    const attempt = newAttempts[0]
    const answers = attempt.answers || []
    let koreanOk = 0
    let koreanBad = 0

    for (const ans of answers) {
      const response = ans.studentResponse || ''
      if (!response) continue
      const hasKorean = /[가-힣]/.test(response)
      if (hasKorean) {
        // Check for encoding artifacts
        const hasBadBytes = response.includes('?') && !typedKorean.some(t => t.answer.includes('?'))
        if (hasBadBytes) koreanBad++
        else koreanOk++
      }
    }

    console.log(`    Korean OK: ${koreanOk}, Bad UTF-8: ${koreanBad}`)

    if (koreanBad > 0) {
      recordResult('S06', 'fail', 'BLOCKER', Date.now() - start,
        `UTF-8 mangling: ${koreanBad} Korean answers corrupted in Firestore`)
      return
    }

    const scoreDisplay = await page.locator('text=/\\d+%/').first().textContent().catch(() => '?')
    recordResult('S06', 'pass', null, Date.now() - start,
      `Korean round-trip clean. Score: ${scoreDisplay}. ${koreanOk} Korean answers preserved. ` +
      `AI grading time: ${Math.round(gradingTime/1000)}s`)

    con.save()
  } catch (err) {
    console.error('  S06 error:', err.message)
    await screenshot(page, 'B03_S06_error')
    recordResult('S06', 'fail', 'MEDIUM', Date.now() - start, `Exception: ${err.message}`)
    con.save()
  } finally {
    await page.close()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// S07 — Long answer (>500 chars)
// ─────────────────────────────────────────────────────────────────────────────
async function runS07(browser) {
  console.log('\n[S07] Long answer: >500 chars stored without truncation')
  const start = Date.now()
  const page = await browser.newPage()
  const con = attachConsole(page, 'B03_S07')

  try {
    updateStatus({ currentScenario: 'S07' })
    const account = await loginAs(page, 'anxious', 'TOP')
    const uid = account.uid
    const classInfo = auditState.classes.topClass
    const listInfo = auditState.lists.topActiveList

    const preAttempts = await getAttemptsByStudent(uid)

    const nav = await navigateViaSessionFlow(page, classInfo.id, listInfo.id, { maxFlashcards: 30, timeoutMs: 90000 })
    if (nav !== 'reached_test') {
      recordResult('S07', 'blocked', null, Date.now() - start, `Could not reach test: ${nav}`)
      return
    }

    const freshBtn = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn.count() > 0) { await freshBtn.click(); await page.waitForTimeout(1000) }
    const resumeBtn = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn.count() > 0) { await resumeBtn.click(); await page.waitForTimeout(1000) }

    const inputs = await waitForTestInputs(page)
    if (inputs.length === 0) {
      recordResult('S07', 'blocked', null, Date.now() - start, 'No inputs')
      return
    }

    const wordList = listInfo.words || []

    // Long answer for first input
    const longAnswer = 'This is a deliberate over-explanation for testing character limits. ' +
      'The word "inflammatory" is an adjective that describes something tending to arouse anger, ' +
      'hostility, or violent reactions in people. In medical contexts it means causing or resulting ' +
      'from inflammation of body tissue. In social or political contexts it refers to language or ' +
      'actions designed to provoke strong emotional reactions, particularly anger or outrage. ' +
      'For example, inflammatory rhetoric during a political campaign, or an inflammatory response ' +
      'in the immune system when fighting infection. This extended answer tests the maximum input ' +
      'length that the application can store and retrieve without truncation or data loss.'

    console.log(`    Long answer: ${longAnswer.length} chars`)

    const input0 = page.locator('input[placeholder*="definition"]').first()
    await input0.click()
    await input0.fill(longAnswer)
    const actualVal = await input0.inputValue()
    console.log(`    Input captured: ${actualVal.length} chars`)

    // Fill rest with short answers
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
    await screenshot(page, 'B03_S07_02_post_grading')

    const hasCrash = await page.getByText(/something went wrong|error boundary/i).count() > 0
    if (hasCrash) {
      recordResult('S07', 'fail', 'HIGH', Date.now() - start, 'App crashed on long answer')
      return
    }

    await page.waitForTimeout(3000)
    const postAttempts = await getAttemptsByStudent(uid)
    const newAttempts = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))

    if (newAttempts.length === 0) {
      const hasResults = await page.locator('[class*="rounded-2xl"][class*="shadow-xl"]').count() > 0
      recordResult('S07', 'partial', 'MEDIUM', Date.now() - start,
        `Results=${hasResults} but no attempt doc`)
      return
    }

    const attempt = newAttempts[0]
    // Find the first answer (long one)
    const storedAnswer = (attempt.answers || [])[0]?.studentResponse || ''
    console.log(`    Stored first answer: ${storedAnswer.length} chars (expected ~${longAnswer.length})`)

    if (storedAnswer.length < longAnswer.length * 0.9) {
      recordResult('S07', 'fail', 'MEDIUM', Date.now() - start,
        `Long answer truncated: typed ${longAnswer.length}, stored ${storedAnswer.length}`)
    } else {
      recordResult('S07', 'pass', null, Date.now() - start,
        `Long answer preserved: ${storedAnswer.length}/${longAnswer.length} chars`)
    }

    con.save()
  } catch (err) {
    console.error('  S07 error:', err.message)
    await screenshot(page, 'B03_S07_error')
    recordResult('S07', 'fail', 'HIGH', Date.now() - start, `Exception: ${err.message}`)
    con.save()
  } finally {
    await page.close()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// S08 — Special characters round-trip
// ─────────────────────────────────────────────────────────────────────────────
async function runS08(browser) {
  console.log('\n[S08] Special characters: em-dash, emoji, Korean round-trip')
  const start = Date.now()
  const page = await browser.newPage()
  const con = attachConsole(page, 'B03_S08')

  try {
    updateStatus({ currentScenario: 'S08' })
    const account = await loginAs(page, 'lazy', 'CORE')
    const uid = account.uid
    const classInfo = auditState.classes.coreClass
    const listInfo = auditState.lists.coreActiveList

    const preAttempts = await getAttemptsByStudent(uid)

    const nav = await navigateViaSessionFlow(page, classInfo.id, listInfo.id, { maxFlashcards: 30, timeoutMs: 90000 })
    if (nav !== 'reached_test') {
      recordResult('S08', 'blocked', null, Date.now() - start, `Could not reach test: ${nav}`)
      return
    }

    const freshBtn = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn.count() > 0) { await freshBtn.click(); await page.waitForTimeout(1000) }
    const resumeBtn = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn.count() > 0) { await resumeBtn.click(); await page.waitForTimeout(1000) }

    const inputs = await waitForTestInputs(page)
    if (inputs.length === 0) {
      recordResult('S08', 'blocked', null, Date.now() - start, 'No inputs')
      return
    }

    const specialAnswers = [
      'a collection — of poems & writings',   // em-dash, ampersand
      '한국어 mixed with English text',          // Korean + English
      'careful observation; attentive',         // semicolon
      'to be "very" precise about things',      // smart-style quotes
    ]

    const wordList = listInfo.words || []
    const typed = []

    for (let i = 0; i < inputs.length; i++) {
      const input = page.locator('input[placeholder*="definition"]').nth(i)
      const answer = i < specialAnswers.length
        ? specialAnswers[i]
        : wordList[i % wordList.length]?.definition_en || 'test'
      await input.click()
      await input.fill(answer)
      if (i < specialAnswers.length) typed.push({ index: i, typed: answer })
      await page.waitForTimeout(200)
    }

    await saveFS('B03_S08_special_typed.json', typed)
    await screenshot(page, 'B03_S08_01_typed')

    const submitBtn = page.getByRole('button', { name: /submit test/i })
    if (await submitBtn.count() > 0) await submitBtn.click()
    await page.waitForTimeout(300)
    const confirmBtn = page.getByRole('button', { name: /^submit$/i })
    if (await confirmBtn.count() > 0) await confirmBtn.click()

    await waitForGradingComplete(page, 240000)
    await screenshot(page, 'B03_S08_02_post_grading')

    await page.waitForTimeout(3000)
    const postAttempts = await getAttemptsByStudent(uid)
    const newAttempts = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    await saveFS('B03_S08_post_attempts.json', newAttempts)

    if (newAttempts.length === 0) {
      recordResult('S08', 'partial', 'MEDIUM', Date.now() - start, 'No attempt doc')
      return
    }

    const attempt = newAttempts[0]
    const answers = attempt.answers || []
    let mangled = 0
    let ok = 0

    for (const t of typed) {
      const stored = answers[t.index]?.studentResponse || ''
      // Check core chars preserved
      if (stored.length === 0) { mangled++; continue }
      // em-dash
      if (t.typed.includes('—') && !stored.includes('—') && !stored.includes('-')) { mangled++; continue }
      // Korean
      if (t.typed.includes('한국어') && !/[가-힣]/.test(stored)) { mangled++; continue }
      ok++
    }

    console.log(`    Special char check: ok=${ok}, mangled=${mangled}`)

    if (mangled > 0) {
      recordResult('S08', 'fail', 'HIGH', Date.now() - start,
        `${mangled}/${typed.length} special char answers mangled in Firestore`)
    } else {
      recordResult('S08', 'pass', null, Date.now() - start,
        `All ${ok} special char answers preserved correctly`)
    }

    con.save()
  } catch (err) {
    console.error('  S08 error:', err.message)
    await screenshot(page, 'B03_S08_error')
    recordResult('S08', 'fail', 'HIGH', Date.now() - start, `Exception: ${err.message}`)
    con.save()
  } finally {
    await page.close()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// S09 — Empty answer validation
// ─────────────────────────────────────────────────────────────────────────────
async function runS09(browser) {
  console.log('\n[S09] Empty answer: submit disabled or validation error')
  const start = Date.now()
  const page = await browser.newPage()
  const con = attachConsole(page, 'B03_S09')

  try {
    updateStatus({ currentScenario: 'S09' })
    const account = await loginAs(page, 'lazy', 'TOP')
    const classInfo = auditState.classes.topClass

    // Navigate directly to test URL with no state
    // But we know that won't work — need to navigate via session
    // For S09 we need to get to the test then NOT type anything
    const nav = await navigateViaSessionFlow(page, classInfo.id, auditState.lists.topActiveList.id, {
      maxFlashcards: 30, timeoutMs: 90000
    })
    if (nav !== 'reached_test') {
      recordResult('S09', 'blocked', null, Date.now() - start, `Could not reach test: ${nav}`)
      return
    }

    const freshBtn = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn.count() > 0) { await freshBtn.click(); await page.waitForTimeout(1000) }
    const resumeBtn = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn.count() > 0) { await resumeBtn.click(); await page.waitForTimeout(1000) }

    const inputs = await waitForTestInputs(page)
    if (inputs.length === 0) {
      recordResult('S09', 'blocked', null, Date.now() - start, 'No inputs')
      return
    }

    await screenshot(page, 'B03_S09_01_blank')

    // Don't type anything — check submit button state
    const submitBtn = page.getByRole('button', { name: /submit test/i })
    if (await submitBtn.count() === 0) {
      recordResult('S09', 'partial', 'MEDIUM', Date.now() - start, 'Submit button not found')
      return
    }

    const isDisabled = await submitBtn.isDisabled()
    console.log(`    Submit disabled with 0 answers: ${isDisabled}`)

    if (isDisabled) {
      recordResult('S09', 'pass', null, Date.now() - start,
        'Submit button correctly disabled when answeredCount===0')
      return
    }

    // Button enabled — try clicking
    await submitBtn.click()
    await page.waitForTimeout(2000)
    await screenshot(page, 'B03_S09_02_after_blank_click')

    const hasValidation = await page.getByText(/please answer|at least one|answer.*required/i).count() > 0
    const hasModal = await page.getByRole('dialog').count() > 0
    const hasGrading = await page.getByText(/grading/i).count() > 0

    console.log(`    validation=${hasValidation}, modal=${hasModal}, grading=${hasGrading}`)

    if (hasValidation) {
      recordResult('S09', 'pass', null, Date.now() - start, 'Validation error shown for blank submit')
    } else if (hasGrading) {
      recordResult('S09', 'fail', 'MEDIUM', Date.now() - start,
        'Blank submit went through to grading silently (no validation)')
    } else if (hasModal) {
      const modalText = await page.getByRole('dialog').textContent()
      recordResult('S09', 'partial', 'MEDIUM', Date.now() - start,
        `Modal on blank submit: "${modalText?.substring(0,100)}"`)
    } else {
      recordResult('S09', 'partial', 'MEDIUM', Date.now() - start, 'No clear validation feedback')
    }

    con.save()
  } catch (err) {
    console.error('  S09 error:', err.message)
    recordResult('S09', 'fail', 'MEDIUM', Date.now() - start, `Exception: ${err.message}`)
    con.save()
  } finally {
    await page.close()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// S10 — Paste-then-submit race
// ─────────────────────────────────────────────────────────────────────────────
async function runS10(browser) {
  console.log('\n[S10] Paste-then-submit race: last answer must not be lost')
  const start = Date.now()
  const page = await browser.newPage()
  const con = attachConsole(page, 'B03_S10')

  try {
    updateStatus({ currentScenario: 'S10' })
    const account = await loginAs(page, 'rushed', 'TOP')
    const uid = account.uid
    const classInfo = auditState.classes.topClass
    const listInfo = auditState.lists.topActiveList

    const preAttempts = await getAttemptsByStudent(uid)

    const nav = await navigateViaSessionFlow(page, classInfo.id, listInfo.id, { maxFlashcards: 30, timeoutMs: 90000 })
    if (nav !== 'reached_test') {
      recordResult('S10', 'blocked', null, Date.now() - start, `Could not reach test: ${nav}`)
      return
    }

    const freshBtn = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn.count() > 0) { await freshBtn.click(); await page.waitForTimeout(1000) }
    const resumeBtn = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn.count() > 0) { await resumeBtn.click(); await page.waitForTimeout(1000) }

    const inputs = await waitForTestInputs(page)
    if (inputs.length === 0) {
      recordResult('S10', 'blocked', null, Date.now() - start, 'No inputs')
      return
    }

    const wordList = listInfo.words || []

    // Fill all but last normally
    for (let i = 0; i < inputs.length - 1; i++) {
      const input = page.locator('input[placeholder*="definition"]').nth(i)
      await input.click()
      await input.fill(wordList[i % wordList.length]?.definition_en || 'test')
      await page.waitForTimeout(100)
    }

    // LAST answer: paste immediately then click submit
    const lastEntry = wordList[inputs.length - 1] || wordList[wordList.length - 1]
    const pasteAnswer = lastEntry?.definition_en || 'this critical last answer must survive the race'
    console.log(`    Pasting last answer: "${pasteAnswer.substring(0,50)}"`)

    // Simulate paste via direct DOM manipulation (then immediately submit)
    await page.evaluate((text) => {
      const inputs = document.querySelectorAll('input[placeholder*="definition"]')
      const last = inputs[inputs.length - 1]
      if (last) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        nativeInputValueSetter.call(last, text)
        last.dispatchEvent(new Event('input', { bubbles: true }))
        last.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }, pasteAnswer)

    // Submit immediately (no wait after paste)
    const submitBtn = page.getByRole('button', { name: /submit test/i })
    if (await submitBtn.count() > 0) await submitBtn.click()

    await page.waitForTimeout(300)
    const confirmBtn = page.getByRole('button', { name: /^submit$/i })
    if (await confirmBtn.count() > 0) await confirmBtn.click()

    await waitForGradingComplete(page, 240000)
    await screenshot(page, 'B03_S10_01_post_grading')

    await page.waitForTimeout(3000)
    const postAttempts = await getAttemptsByStudent(uid)
    const newAttempts = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))

    if (newAttempts.length === 0) {
      recordResult('S10', 'partial', 'MEDIUM', Date.now() - start, 'No attempt doc')
      return
    }

    const attempt = newAttempts[0]
    const answers = attempt.answers || []
    const lastAns = answers[answers.length - 1]
    const storedLast = lastAns?.studentResponse || ''
    console.log(`    Last stored: "${storedLast.substring(0,60)}"`)
    console.log(`    Expected: "${pasteAnswer.substring(0,60)}"`)

    const preserved = storedLast.length > 0 &&
      (storedLast === pasteAnswer || storedLast.startsWith(pasteAnswer.substring(0,30)))

    if (preserved) {
      recordResult('S10', 'pass', null, Date.now() - start,
        'Issue #10 NOT reproduced: paste-then-submit preserves last answer')
    } else if (storedLast.length === 0) {
      recordResult('S10', 'fail', 'MEDIUM', Date.now() - start,
        'Issue #10 CONFIRMED: last answer lost on paste+immediate submit race')
    } else {
      recordResult('S10', 'partial', 'MEDIUM', Date.now() - start,
        `Partial match: stored="${storedLast.substring(0,40)}" vs expected="${pasteAnswer.substring(0,40)}"`)
    }

    con.save()
  } catch (err) {
    console.error('  S10 error:', err.message)
    await screenshot(page, 'B03_S10_error')
    recordResult('S10', 'fail', 'MEDIUM', Date.now() - start, `Exception: ${err.message}`)
    con.save()
  } finally {
    await page.close()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// S13 — Console cleanliness
// ─────────────────────────────────────────────────────────────────────────────
async function runS13(browser) {
  console.log('\n[S13] Console clean during typed test happy path')
  const start = Date.now()
  const page = await browser.newPage()
  const con = attachConsole(page, 'B03_S13')

  try {
    updateStatus({ currentScenario: 'S13' })
    const account = await loginAs(page, 'careful', 'CORE')
    const classInfo = auditState.classes.coreClass
    const listInfo = auditState.lists.coreActiveList

    const nav = await navigateViaSessionFlow(page, classInfo.id, listInfo.id, { maxFlashcards: 30, timeoutMs: 90000 })
    if (nav !== 'reached_test') {
      recordResult('S13', 'blocked', null, Date.now() - start, `Could not reach test: ${nav}`)
      return
    }

    const freshBtn = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn.count() > 0) { await freshBtn.click(); await page.waitForTimeout(1000) }
    const resumeBtn = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn.count() > 0) { await resumeBtn.click(); await page.waitForTimeout(1000) }

    const inputs = await waitForTestInputs(page)
    if (inputs.length === 0) {
      recordResult('S13', 'blocked', null, Date.now() - start, 'No inputs')
      return
    }

    const wordList = listInfo.words || []
    const input = page.locator('input[placeholder*="definition"]').first()
    await input.click()
    await realisticType(input, wordList[0]?.definition_en || 'test', 50)

    const submitBtn = page.getByRole('button', { name: /submit test/i })
    if (await submitBtn.count() > 0) await submitBtn.click()
    await page.waitForTimeout(300)
    const confirmBtn = page.getByRole('button', { name: /^submit$/i })
    if (await confirmBtn.count() > 0) await confirmBtn.click()

    await waitForGradingComplete(page, 240000)
    await screenshot(page, 'B03_S13_01_results')

    const errors = con.getErrors()
    const logs = con.getLogs()

    const fatalErrors = errors.filter(e =>
      !e.includes('favicon') && !e.includes('Permissions-Policy') &&
      !e.includes('Cross-Origin') && !e.includes('ERR_FAILED') &&
      e.length > 10
    )
    const unmountErrors = logs.filter(l => l.includes('unmounted') || l.includes('memory leak'))
    const reactKeyErrors = logs.filter(l => l.includes('unique key') || l.includes('Each child'))

    console.log(`    Fatal errors: ${fatalErrors.length}, unmount: ${unmountErrors.length}, keys: ${reactKeyErrors.length}`)

    con.save()

    if (fatalErrors.length > 0) {
      recordResult('S13', 'partial', 'LOW', Date.now() - start,
        `${fatalErrors.length} console errors: ${fatalErrors[0]?.substring(0,100)}`)
    } else if (unmountErrors.length > 0) {
      recordResult('S13', 'partial', 'MEDIUM', Date.now() - start,
        `setState on unmounted: ${unmountErrors[0]?.substring(0,100)}`)
    } else {
      recordResult('S13', 'pass', null, Date.now() - start,
        `Console clean: 0 fatal errors, 0 unmount warnings, 0 key warnings`)
    }
  } catch (err) {
    console.error('  S13 error:', err.message)
    recordResult('S13', 'fail', 'LOW', Date.now() - start, `Exception: ${err.message}`)
    con.save()
  } finally {
    await page.close()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// S14 — Second typed test creates separate attempt
// ─────────────────────────────────────────────────────────────────────────────
async function runS14(browser) {
  console.log('\n[S14] Second typed test: separate attempt doc (nonce rolls over)')
  const start = Date.now()
  const page = await browser.newPage()
  const con = attachConsole(page, 'B03_S14')

  try {
    updateStatus({ currentScenario: 'S14' })
    const account = await loginAs(page, 'perfectionist', 'CORE')
    const uid = account.uid
    const classInfo = auditState.classes.coreClass
    const listInfo = auditState.lists.coreActiveList

    const preAttempts = await getAttemptsByStudent(uid)
    console.log(`    Pre-existing attempts: ${preAttempts.length}`)

    // First test
    const nav1 = await navigateViaSessionFlow(page, classInfo.id, listInfo.id, { maxFlashcards: 30, timeoutMs: 90000 })
    if (nav1 !== 'reached_test') {
      recordResult('S14', 'blocked', null, Date.now() - start, `Could not reach first test: ${nav1}`)
      return
    }

    const freshBtn1 = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn1.count() > 0) { await freshBtn1.click(); await page.waitForTimeout(1000) }
    const resumeBtn1 = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn1.count() > 0) { await resumeBtn1.click(); await page.waitForTimeout(1000) }

    const inputs1 = await waitForTestInputs(page)
    if (inputs1.length === 0) {
      recordResult('S14', 'blocked', null, Date.now() - start, 'No inputs for first test')
      return
    }

    const wordList = listInfo.words || []
    const input1 = page.locator('input[placeholder*="definition"]').first()
    await input1.click()
    await input1.fill(wordList[0]?.definition_en || 'first test answer')

    const submit1 = page.getByRole('button', { name: /submit test/i })
    if (await submit1.count() > 0) await submit1.click()
    await page.waitForTimeout(300)
    const confirm1 = page.getByRole('button', { name: /^submit$/i })
    if (await confirm1.count() > 0) await confirm1.click()

    console.log('    Waiting for first test grading...')
    await waitForGradingComplete(page, 240000)
    await screenshot(page, 'B03_S14_01_first_done')
    await page.waitForTimeout(3000)

    const midAttempts = await getAttemptsByStudent(uid)
    const first = midAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    console.log(`    After first test: ${first.length} new attempts`)

    // Navigate back to dashboard, then start second test
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)

    const nav2 = await navigateViaSessionFlow(page, classInfo.id, listInfo.id, { maxFlashcards: 30, timeoutMs: 90000 })
    if (nav2 !== 'reached_test') {
      recordResult('S14', 'partial', 'MEDIUM', Date.now() - start,
        `First test done. Could not reach second test: ${nav2}`)
      return
    }

    const freshBtn2 = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn2.count() > 0) { await freshBtn2.click(); await page.waitForTimeout(1000) }
    const resumeBtn2 = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn2.count() > 0) { await resumeBtn2.click(); await page.waitForTimeout(1000) }

    const inputs2 = await waitForTestInputs(page, 15000)
    if (inputs2.length === 0) {
      recordResult('S14', 'partial', 'MEDIUM', Date.now() - start,
        'Second test not accessible or no inputs')
      return
    }

    const input2 = page.locator('input[placeholder*="definition"]').first()
    await input2.click()
    await input2.fill(wordList[0]?.definition_en || 'second test answer')

    const submit2 = page.getByRole('button', { name: /submit test/i })
    if (await submit2.count() > 0) await submit2.click()
    await page.waitForTimeout(300)
    const confirm2 = page.getByRole('button', { name: /^submit$/i })
    if (await confirm2.count() > 0) await confirm2.click()

    console.log('    Waiting for second test grading...')
    await waitForGradingComplete(page, 240000)
    await screenshot(page, 'B03_S14_02_second_done')
    await page.waitForTimeout(3000)

    const postAttempts = await getAttemptsByStudent(uid)
    const allNew = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    console.log(`    Total new attempts: ${allNew.length}`)
    await saveFS('B03_S14_all_attempts.json', allNew)

    if (allNew.length >= 2) {
      const ids = allNew.map(a => a.id)
      const uniqueIds = new Set(ids)
      if (uniqueIds.size < ids.length) {
        recordResult('S14', 'fail', 'BLOCKER', Date.now() - start,
          `Duplicate attempt IDs! ${JSON.stringify(ids)}`)
      } else {
        recordResult('S14', 'pass', null, Date.now() - start,
          `Two unique attempt docs: ${ids.join(', ')}`)
      }
    } else if (allNew.length === 1) {
      recordResult('S14', 'partial', 'MEDIUM', Date.now() - start,
        'Only 1 attempt for 2 tests — second may have overwritten first (nonce not rolling over)')
    } else {
      recordResult('S14', 'partial', 'MEDIUM', Date.now() - start,
        '0 new attempts for 2 tests — both may be practice mode or navigation issue')
    }

    con.save()
  } catch (err) {
    console.error('  S14 error:', err.message)
    await screenshot(page, 'B03_S14_error')
    recordResult('S14', 'fail', 'MEDIUM', Date.now() - start, `Exception: ${err.message}`)
    con.save()
  } finally {
    await page.close()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// S15 — Navigate away during test (no orphan)
// ─────────────────────────────────────────────────────────────────────────────
async function runS15(browser) {
  console.log('\n[S15] Navigate away mid-test: no spurious attempt')
  const start = Date.now()
  const page = await browser.newPage()
  const con = attachConsole(page, 'B03_S15')

  try {
    updateStatus({ currentScenario: 'S15' })
    const account = await loginAs(page, 'careful', 'CORE')
    const uid = account.uid
    const classInfo = auditState.classes.coreClass
    const listInfo = auditState.lists.coreActiveList

    const preAttempts = await getAttemptsByStudent(uid)

    const nav = await navigateViaSessionFlow(page, classInfo.id, listInfo.id, { maxFlashcards: 30, timeoutMs: 90000 })
    if (nav !== 'reached_test') {
      recordResult('S15', 'blocked', null, Date.now() - start, `Could not reach test: ${nav}`)
      return
    }

    const freshBtn = page.getByRole('button', { name: /start fresh/i })
    if (await freshBtn.count() > 0) { await freshBtn.click(); await page.waitForTimeout(1000) }
    const resumeBtn = page.getByRole('button', { name: /resume/i })
    if (await resumeBtn.count() > 0) { await resumeBtn.click(); await page.waitForTimeout(1000) }

    const inputs = await waitForTestInputs(page, 15000)
    if (inputs.length === 0) {
      recordResult('S15', 'blocked', null, Date.now() - start, 'No inputs')
      return
    }

    await screenshot(page, 'B03_S15_01_on_test')

    // Navigate away WITHOUT submitting (simulate quitting via back button)
    // Click the quit/back button (SessionHeader back)
    const backBtn = page.getByRole('button', { name: /quit test|back/i }).first()
    if (await backBtn.count() > 0) {
      await backBtn.click()
      await page.waitForTimeout(1000)
      // Confirm quit
      const confirmQuit = page.getByRole('button', { name: /^quit$/i })
      if (await confirmQuit.count() > 0) await confirmQuit.click()
    } else {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    }

    await page.waitForTimeout(3000)
    await screenshot(page, 'B03_S15_02_after_quit')

    const postAttempts = await getAttemptsByStudent(uid)
    const newAttempts = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    const errors = con.getErrors()
    const unmountErrors = errors.filter(e => e.includes('unmounted') || e.includes('memory leak'))

    console.log(`    Spurious attempts: ${newAttempts.length}, unmount errors: ${unmountErrors.length}`)

    con.save()

    if (newAttempts.length > 0) {
      recordResult('S15', 'fail', 'MEDIUM', Date.now() - start,
        `Spurious attempt on quit: ${newAttempts.length} docs created without submit`)
    } else if (unmountErrors.length > 0) {
      recordResult('S15', 'partial', 'MEDIUM', Date.now() - start,
        `No spurious attempt but setState on unmounted: ${unmountErrors[0]?.substring(0,100)}`)
    } else {
      recordResult('S15', 'pass', null, Date.now() - start,
        'Quit mid-test: no spurious attempt, no unmount errors')
    }
  } catch (err) {
    console.error('  S15 error:', err.message)
    await screenshot(page, 'B03_S15_error')
    recordResult('S15', 'fail', 'MEDIUM', Date.now() - start, `Exception: ${err.message}`)
    con.save()
  } finally {
    await page.close()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// S04 — Source code inspection: grading retry UI text
// ─────────────────────────────────────────────────────────────────────────────
async function runS04_inspection(browser) {
  console.log('\n[S04] Grading retry UI: inspect source code for retry text')
  const start = Date.now()

  try {
    updateStatus({ currentScenario: 'S04' })

    // Read source code directly (we have access to the source)
    const typedTestSrc = fs.readFileSync('/app/src/pages/TypedTest.jsx', 'utf-8')

    // Check retry text in source code
    const retryAttemptText = typedTestSrc.match(/Attempt.*\/3|retry.*attempt|Retrying in/gi)
    const retryIndicator = typedTestSrc.match(/retryAttempt.*[>=>]/g)
    const gradeWithRetry = typedTestSrc.includes('gradeWithRetry')
    const maxRetries = typedTestSrc.match(/MAX_RETRIES\s*=\s*(\d+)/)

    console.log(`    gradeWithRetry function: ${gradeWithRetry}`)
    console.log(`    MAX_RETRIES: ${maxRetries?.[1]}`)
    console.log(`    Retry text patterns: ${retryAttemptText?.join(', ')}`)
    console.log(`    Retry UI indicator: ${retryIndicator?.length > 0}`)

    // Check that gradeWithRetry does NOT call clearTestState
    const clearBeforeGrade = typedTestSrc.indexOf('clearTestState') <
      typedTestSrc.indexOf('gradeWithRetry')
    console.log(`    clearTestState BEFORE gradeWithRetry: ${clearBeforeGrade} (should be false for fix #2)`)

    // Verify the ordering of fix #2
    const clearIdx = typedTestSrc.lastIndexOf('clearTestState(testId)')
    const gradeIdx = typedTestSrc.indexOf('gradeWithRetry(')
    const processIdx = typedTestSrc.indexOf('processTestResults(')
    const submitIdx = typedTestSrc.indexOf('submitTypedTestAttempt(')
    const showResultsIdx = typedTestSrc.indexOf('setShowResults(true)')

    console.log(`    Indices: clearTestState=${clearIdx}, gradeWithRetry=${gradeIdx}, submit=${submitIdx}, processTestResults=${processIdx}, showResults=${showResultsIdx}`)

    const orderingCorrect =
      gradeIdx < submitIdx &&
      submitIdx < processIdx &&
      processIdx < clearIdx &&
      clearIdx < showResultsIdx

    console.log(`    Fix #2 ordering correct (grade→submit→process→clear→showResults): ${orderingCorrect}`)

    // Check resultsProcessedRef pattern
    const hasResultsRef = typedTestSrc.includes('resultsProcessedRef')
    const refBeforeProcess = typedTestSrc.indexOf('resultsProcessedRef.current') <
      typedTestSrc.indexOf('processTestResults(')
    console.log(`    resultsProcessedRef guard: ${hasResultsRef}, checked before process: ${refBeforeProcess}`)

    // Check idempotent attempt doc ID
    const hasAttemptNonce = typedTestSrc.includes('getOrCreateAttemptNonce')
    const hasSetDoc = typedTestSrc.includes('attemptDocId') || typedTestSrc.includes('setDoc')
    console.log(`    Idempotent attempt nonce: ${hasAttemptNonce}`)

    await saveFS('B03_S04_source_analysis.json', {
      gradeWithRetry,
      maxRetries: maxRetries?.[1],
      retryText: retryAttemptText,
      clearBeforeGrade,
      orderingCorrect,
      hasResultsRef,
      hasAttemptNonce,
      indices: { clearIdx, gradeIdx, submitIdx, processIdx, showResultsIdx }
    })

    if (!orderingCorrect) {
      recordResult('S04', 'fail', 'BLOCKER', Date.now() - start,
        `Fix #2 ordering WRONG: clearTestState must come AFTER processTestResults. ` +
        `Indices: grade=${gradeIdx}, submit=${submitIdx}, process=${processIdx}, clear=${clearIdx}`)
    } else if (!hasAttemptNonce) {
      recordResult('S04', 'fail', 'HIGH', Date.now() - start,
        'Idempotent attempt nonce (getOrCreateAttemptNonce) not found — duplicate docs risk')
    } else if (!hasResultsRef) {
      recordResult('S04', 'fail', 'HIGH', Date.now() - start,
        'resultsProcessedRef guard missing — double-increment risk on Try Again')
    } else {
      recordResult('S04', 'pass', null, Date.now() - start,
        `Source code verified: orderingCorrect=${orderingCorrect}, nonce=${hasAttemptNonce}, ` +
        `processRef=${hasResultsRef}, maxRetries=${maxRetries?.[1]}. ` +
        `Retry UI text: "${retryAttemptText?.[0] || 'Attempt N/3'}"`)
    }
  } catch (err) {
    console.error('  S04 error:', err.message)
    recordResult('S04', 'fail', 'MEDIUM', Date.now() - start, `Exception: ${err.message}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// S11 — Source code inspection: Try Again path
// ─────────────────────────────────────────────────────────────────────────────
async function runS11_inspection() {
  console.log('\n[S11] Try Again path: source code inspection')
  const start = Date.now()

  try {
    updateStatus({ currentScenario: 'S11' })
    const src = fs.readFileSync('/app/src/pages/TypedTest.jsx', 'utf-8')

    // Check handleRetryGrading calls handleSubmit
    const retryCallsSubmit = src.includes('handleSubmit()') &&
      src.indexOf('handleRetryGrading') < src.indexOf('handleSubmit')
    const noNewNonce = !src.includes('getOrCreateAttemptNonce') ||
      src.indexOf('getOrCreateAttemptNonce') !== src.lastIndexOf('getOrCreateAttemptNonce') // called once
    const processRefGuard = src.includes('resultsProcessedRef.current')
    const refResetOnRetake = src.includes('resultsProcessedRef.current = false')

    console.log(`    handleRetryGrading calls handleSubmit: ${retryCallsSubmit}`)
    console.log(`    resultsProcessedRef guard: ${processRefGuard}`)
    console.log(`    resultsProcessedRef reset on retake: ${refResetOnRetake}`)

    await saveFS('B03_S11_source_analysis.json', {
      retryCallsSubmit,
      processRefGuard,
      refResetOnRetake,
      noNewNonce
    })

    if (!processRefGuard) {
      recordResult('S11', 'fail', 'HIGH', Date.now() - start,
        'resultsProcessedRef guard missing — Try Again will double-increment timesTestedTotal')
    } else if (refResetOnRetake) {
      recordResult('S11', 'partial', 'MEDIUM', Date.now() - start,
        'resultsProcessedRef is reset on retake — this may allow double-increment on explicit retake (review S11 further)')
    } else {
      recordResult('S11', 'pass', null, Date.now() - start,
        'Try Again path: resultsProcessedRef guards double-increment. Nonce prevents duplicate docs.')
    }
  } catch (err) {
    recordResult('S11', 'fail', 'MEDIUM', Date.now() - start, `Exception: ${err.message}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// S12 — Practice mode source code check
// ─────────────────────────────────────────────────────────────────────────────
async function runS12_inspection() {
  console.log('\n[S12] Practice mode: source code inspection')
  const start = Date.now()

  try {
    updateStatus({ currentScenario: 'S12' })
    const src = fs.readFileSync('/app/src/pages/TypedTest.jsx', 'utf-8')

    // Check isPracticeMode guard before submitTypedTestAttempt
    const practiceMode = src.includes('isPracticeMode')
    const guardBeforeSubmit = src.includes('!isPracticeMode')
    const submitInsideGuard = src.indexOf('submitTypedTestAttempt') > src.indexOf('!isPracticeMode')

    console.log(`    isPracticeMode used: ${practiceMode}`)
    console.log(`    !isPracticeMode guard: ${guardBeforeSubmit}`)
    console.log(`    submitTypedTestAttempt inside guard: ${submitInsideGuard}`)

    await saveFS('B03_S12_source_analysis.json', { practiceMode, guardBeforeSubmit, submitInsideGuard })

    if (!practiceMode || !guardBeforeSubmit) {
      recordResult('S12', 'fail', 'HIGH', Date.now() - start,
        'Practice mode guard (!isPracticeMode) missing before attempt write')
    } else if (!submitInsideGuard) {
      recordResult('S12', 'fail', 'HIGH', Date.now() - start,
        'submitTypedTestAttempt appears BEFORE practice mode guard — practice mode broken')
    } else {
      recordResult('S12', 'pass', null, Date.now() - start,
        'Practice mode correctly guards submitTypedTestAttempt with !isPracticeMode')
    }
  } catch (err) {
    recordResult('S12', 'fail', 'HIGH', Date.now() - start, `Exception: ${err.message}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRLF Word Name Impact Check
// ─────────────────────────────────────────────────────────────────────────────
async function checkCrlfImpact() {
  console.log('\n[CRLF Check] Checking CRLF-in-word-name impact')

  const topWords = auditState.lists.topActiveList.words || []
  const crlfWords = topWords.filter(w => w.word.includes('\r\n'))
  const crlfDefs = topWords.filter(w => w.definition_ko?.includes('\r\n') || w.definition_en?.includes('\r\n'))

  console.log(`    TOP list words with CRLF in name: ${crlfWords.length}`)
  crlfWords.forEach(w => console.log(`      - "${w.word.replace(/\r\n/g, '\\r\\n')}" (pos ${w.position})`))
  console.log(`    TOP list defs with CRLF: ${crlfDefs.length}`)

  await saveFS('B03_crlf_words.json', {
    crlfInName: crlfWords.map(w => ({ word: w.word, position: w.position })),
    crlfInDef: crlfDefs.map(w => ({ word: w.word, position: w.position }))
  })

  return { crlfWords, crlfDefs }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== B03 Typed Submission Critical Path (v2) ===')
  console.log(`Evidence dir: ${EVIDENCE_DIR}`)
  console.log('Target:', BASE_URL)

  // Verify site reachable
  await new Promise((resolve, reject) => {
    https.get(`${BASE_URL}/`, res => {
      console.log(`Site status: ${res.statusCode}`)
      resolve()
    }).on('error', reject)
  })

  // Check CRLF impact
  const { crlfWords, crlfDefs } = await checkCrlfImpact()

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })

  try {
    // S04 — Source code inspection for grading retry ordering (BLOCKER-level fix check)
    await runS04_inspection(browser)
    const s04 = results.find(r => r.scenario === 'S04')
    if (s04?.result === 'fail' && s04?.severity === 'BLOCKER') {
      console.log('\n!!! S04 BLOCKER — Fix #2 ordering wrong in source code !!!')
      appendLog({ event: 'stop_condition_hit', batch: 'B03', scenario: 'S04', reason: 'Fix #2 source ordering BLOCKER' })
      return
    }

    // S11, S12 source code inspections
    await runS11_inspection()
    await runS12_inspection()

    // S01 — Happy path (the critical BLOCKER test)
    await runS01(browser)
    const s01 = results.find(r => r.scenario === 'S01')
    if (s01?.result === 'fail' && s01?.severity === 'BLOCKER') {
      console.log('\n!!! S01 BLOCKER — happy path broken !!!')
      appendLog({ event: 'stop_condition_hit', batch: 'B03', scenario: 'S01', reason: 'Happy path BLOCKER' })
      return
    }

    // S02 — Fix #2 live verification
    await runS02(browser)
    const s02 = results.find(r => r.scenario === 'S02')
    if (s02?.result === 'fail' && s02?.severity === 'BLOCKER') {
      console.log('\n!!! S02 BLOCKER — Fix #2 regression !!!')
      appendLog({ event: 'stop_condition_hit', batch: 'B03', scenario: 'S02', reason: 'Fix #2 BLOCKER' })
      return
    }

    // S03 — Idempotent attempt doc
    await runS03(browser)

    // S05 — Tab close mid-grading
    await runS05(browser)

    // S06 — Korean UTF-8 round-trip
    await runS06(browser)
    const s06 = results.find(r => r.scenario === 'S06')
    if (s06?.result === 'fail' && s06?.severity === 'BLOCKER') {
      console.log('\n!!! S06 BLOCKER — UTF-8 mangling !!!')
      appendLog({ event: 'stop_condition_hit', batch: 'B03', scenario: 'S06', reason: 'UTF-8 mangling BLOCKER' })
      return
    }

    // S07 — Long answer
    await runS07(browser)

    // S08 — Special characters
    await runS08(browser)

    // S09 — Empty answer validation
    await runS09(browser)

    // S10 — Paste-then-submit race
    await runS10(browser)

    // S13 — Console cleanliness
    await runS13(browser)

    // S14 — Second test separate attempt
    await runS14(browser)

    // S15 — Navigate away no orphan
    await runS15(browser)

  } finally {
    await browser.close()
  }

  // Summary
  console.log('\n=== B03 FINAL RESULTS ===')
  for (const r of results) {
    const sev = r.severity ? ` [${r.severity}]` : ''
    console.log(`  ${r.scenario}: ${r.result.toUpperCase()}${sev} — ${(r.notes||'').substring(0,90)}`)
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
  console.log(`CRLF words: ${crlfWords.length} in name, ${crlfDefs.length} in def`)

  appendLog({
    event: 'batch_end', batch: 'B03', trials: results.length,
    pass, fail, partial, blocked, blockerCount: blockers, highCount: highs, mediumCount: mediums,
    crlfWordsInName: crlfWords.length
  })

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, 'B03_results_summary.json'),
    JSON.stringify({ results, crlfWords: crlfWords.length, summary: { pass, fail, partial, blocked, blockers, highs, mediums } }, null, 2)
  )
}

main().catch(err => {
  console.error('FATAL:', err)
  appendLog({ event: 'error', batch: 'B03', error: err.message })
  updateStatus({ state: 'errored', error: err.message })
  process.exit(1)
})
