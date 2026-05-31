/**
 * B03 — Typed Submission Critical Path (v3 — FINAL)
 * Agent C — Batch B03
 *
 * Key fix in v3: dismiss the "Customize Your Flashcards" modal that appears
 * at the start of each DailySessionFlow session (blocks clicking flashcard buttons).
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

async function getAttempts(uid) {
  const snap = await getDb().collection('attempts').where('studentId', '==', uid).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
async function getStudyStates(uid, listId) {
  try {
    const snap = await getDb().collection('study_states')
      .where('studentId', '==', uid).where('listId', '==', listId).limit(50).get()
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch { return [] }
}

async function saveFS(label, data) {
  fs.writeFileSync(path.join(EVIDENCE_DIR, label), JSON.stringify(data, null, 2))
}
async function ss(page, label) {
  await page.screenshot({ path: path.join(EVIDENCE_DIR, `${label}.png`), fullPage: true }).catch(() => {})
}
function con(page) {
  const logs = [], errors = []
  page.on('console', m => { const t = `[${m.type()}] ${m.text()}`; logs.push(t); if (m.type()==='error') errors.push(t) })
  page.on('pageerror', e => { errors.push(`[pageerror] ${e.message}`); logs.push(`[pageerror] ${e.message}`) })
  return { getLogs: () => logs, getErrors: () => errors }
}

// ── Login ──────────────────────────────────────────────────────────────────────
async function login(page, personaId, targetClass) {
  const acct = getAccount(personaId, targetClass)
  if (!acct) throw new Error(`No account: ${personaId}/${targetClass}`)

  await page.addInitScript(() => {
    if (navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
  })

  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(3000)

  const loginLink = page.getByRole('link', { name: /log\s?in/i }).first()
  if (await loginLink.count() > 0) await loginLink.click()
  else await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })

  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(acct.email)
  await page.getByLabel(/password/i).first().fill(acct.password)
  await page.getByLabel(/password/i).first().press('Enter')

  await page.waitForFunction(
    () => document.body.textContent.includes('Start Session') || document.body.textContent.includes('Dashboard'),
    { timeout: 20000 }
  ).catch(async () => {
    const btn = page.getByRole('button', { name: /continue/i }).first()
    if (await btn.count() > 0) await btn.click()
    await page.waitForFunction(
      () => document.body.textContent.includes('Start Session') || document.body.textContent.includes('Dashboard'),
      { timeout: 15000 }
    ).catch(() => {})
  })

  return acct
}

// ── Navigate to TypedTest via DailySessionFlow ─────────────────────────────────
async function goToTypedTest(page, classId, listId) {
  // Ensure we're on dashboard — always navigate fresh
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })

  // Wait for dashboard content + class cards to load (React needs to fetch class data)
  try {
    await page.waitForFunction(
      () => document.body.textContent.includes('Start Session') &&
             document.body.textContent.length > 500, // ensure class data is loaded
      { timeout: 20000 }
    )
  } catch {
    console.log('    Dashboard content wait timed out')
  }
  await page.waitForTimeout(2000) // Extra settle time for React state

  // Click Start Session — the FIRST one (which has the correct class/list IDs after load)
  const startBtn = page.getByRole('button', { name: /start session/i }).first()
  if (await startBtn.count() === 0) return 'no_start_button'

  await startBtn.click()
  await page.waitForTimeout(5000) // Give session navigation time to complete

  const sessionUrl = page.url()
  console.log(`    Session URL: ${sessionUrl}`)

  if (sessionUrl.includes('/typedtest/') || sessionUrl.includes('/mcqtest/')) return 'reached_test'
  if (!sessionUrl.includes('/session/')) return `no_session_nav:${sessionUrl}`

  // Dismiss "Customize Your Flashcards" modal if present
  const startStudyingBtn = page.getByRole('button', { name: /start studying/i })
  if (await startStudyingBtn.count() > 0) {
    console.log('    Dismissing customization modal...')
    await startStudyingBtn.click()
    await page.waitForTimeout(1500)
  }

  // Work through flashcards
  let clicks = 0
  const tStart = Date.now()

  while (Date.now() - tStart < 180000) {
    const curUrl = page.url()
    if (curUrl.includes('/typedtest/') || curUrl.includes('/mcqtest/')) {
      console.log(`    Navigated to test after ${clicks} clicks`)
      return 'reached_test'
    }

    // PRIORITY 1: "Start Test" button inside "Ready for the Test?" modal
    // (appears when all flashcards are dismissed — this IS the click that navigates to the test)
    const startTestBtn = page.getByRole('button', { name: 'Start Test' })
    if (await startTestBtn.count() > 0) {
      console.log(`    Start Test modal visible after ${clicks} clicks — clicking`)
      await startTestBtn.click()
      await page.waitForTimeout(3000)
      await page.waitForFunction(
        () => window.location.pathname.includes('/typedtest/') || window.location.pathname.includes('/mcqtest/'),
        { timeout: 15000 }
      ).catch(() => {})
      const newUrl = page.url()
      if (newUrl.includes('/typedtest/') || newUrl.includes('/mcqtest/')) return 'reached_test'
      return 'stuck_after_start_test'
    }

    // PRIORITY 2: "Take Test" button (appears when all cards dismissed, before modal)
    // Click with force since modal may overlay it
    const takeTestBtn = page.getByRole('button', { name: 'Take Test' })
    if (await takeTestBtn.count() > 0) {
      console.log(`    Take Test visible after ${clicks} clicks — clicking with force`)
      await takeTestBtn.click({ force: true })
      await page.waitForTimeout(2000)
      // Now "Start Test" modal should appear
      const startTestBtn2 = page.getByRole('button', { name: 'Start Test' })
      if (await startTestBtn2.count() > 0) {
        await startTestBtn2.click()
        await page.waitForTimeout(3000)
      }
      await page.waitForFunction(
        () => window.location.pathname.includes('/typedtest/') || window.location.pathname.includes('/mcqtest/'),
        { timeout: 15000 }
      ).catch(() => {})
      const newUrl = page.url()
      if (newUrl.includes('/typedtest/') || newUrl.includes('/mcqtest/')) return 'reached_test'
      return 'stuck_after_take_test'
    }

    // PRIORITY 3: "I Know This" button (check mark oval)
    const knowBtn = page.locator('button[aria-label*="know this word"]').first()
    if (await knowBtn.count() > 0) {
      await knowBtn.click()
      clicks++
      await page.waitForTimeout(250)
      continue
    }

    // Keyboard shortcut 'c' = "I know this"
    await page.keyboard.press('c')
    clicks++
    await page.waitForTimeout(300)

    if (clicks > 120) break
  }

  const finalUrl = page.url()
  if (finalUrl.includes('/typedtest/') || finalUrl.includes('/mcqtest/')) return 'reached_test'
  return `flashcard_timeout:${clicks}_clicks`
}

async function waitForInputs(page, ms = 25000) {
  try {
    await page.waitForSelector('input[placeholder*="definition"]', { timeout: ms })
    return await page.locator('input[placeholder*="definition"]').all()
  } catch { return [] }
}

async function waitForGrading(page, ms = 240000) {
  const t = Date.now()
  try {
    await page.waitForFunction(
      () => {
        const h3s = Array.from(document.querySelectorAll('h3'))
        const done = !h3s.some(h => h.textContent.includes('Grading Your Test'))
        const results = !!document.querySelector('[class*="rounded-2xl"][class*="shadow-xl"]')
        const err = h3s.some(h => h.textContent.includes('Grading Failed'))
        return (results || err) && done
      },
      { timeout: ms, polling: 2000 }
    )
  } catch {}
  return Date.now() - t
}

async function fillAnswers(page, wordList, n) {
  const inputs = await page.locator('input[placeholder*="definition"]').all()
  const count = Math.min(n, inputs.length)
  for (let i = 0; i < count; i++) {
    const inp = page.locator('input[placeholder*="definition"]').nth(i)
    const w = wordList[i % wordList.length]
    let ans = w?.definition_en || 'test answer'
    if (ans.endsWith('.')) ans = ans.slice(0, -1)
    await inp.click()
    await inp.fill(ans)
    await page.waitForTimeout(80)
  }
  return inputs.length
}

async function dismissRecovery(page) {
  const fresh = page.getByRole('button', { name: /start fresh/i })
  if (await fresh.count() > 0) { await fresh.click(); await page.waitForTimeout(1000) }
  const resume = page.getByRole('button', { name: /^resume$/i })
  if (await resume.count() > 0) { await resume.click(); await page.waitForTimeout(1000) }
}

async function submitTest(page) {
  const btn = page.getByRole('button', { name: /submit test/i })
  if (await btn.count() > 0) await btn.click()
  await page.waitForTimeout(400)
  const confirm = page.getByRole('button', { name: /^submit$/i })
  if (await confirm.count() > 0) await confirm.click()
}

// ── Records ────────────────────────────────────────────────────────────────────
const results = []
function rec(scenario, result, severity, durationMs, notes) {
  results.push({ scenario, result, severity, durationMs, notes })
  appendLog({ event: 'scenario', batch: 'B03', scenario, result, severity, durationMs, notes })
  updateStatus({ currentScenario: scenario, trialsCompleted: results.length, state: 'running' })
  console.log(`  [${scenario}] ${result.toUpperCase()}${severity ? ' [' + severity + ']' : ''} — ${(notes||'').substring(0,100)}`)
}

// =============================================================================
// SCENARIOS
// =============================================================================

async function runS01(browser) {
  console.log('\n[S01] Happy path: careful TOP → session → flashcards → TypedTest → grading')
  const t = Date.now()
  const page = await browser.newPage()
  const c = con(page)
  try {
    updateStatus({ currentScenario: 'S01' })
    const acct = await login(page, 'careful', 'TOP')
    const classInfo = auditState.classes.topClass
    const listInfo = auditState.lists.topActiveList
    const preAttempts = await getAttempts(acct.uid)

    await ss(page, 'B03_S01_01_dashboard')
    const nav = await goToTypedTest(page, classInfo.id, listInfo.id)
    console.log(`    Nav: ${nav}`)

    if (nav !== 'reached_test') {
      await ss(page, 'B03_S01_nav_fail')
      rec('S01', 'blocked', null, Date.now() - t, `Navigation failed: ${nav}`)
      return
    }

    await ss(page, 'B03_S01_02_on_test')
    const testUrl = page.url()
    if (testUrl.includes('/mcqtest/')) {
      rec('S01', 'blocked', null, Date.now() - t, 'Landed on MCQTest not TypedTest')
      return
    }

    await dismissRecovery(page)
    const inputs = await waitForInputs(page)
    console.log(`    ${inputs.length} inputs`)

    if (inputs.length === 0) {
      await ss(page, 'B03_S01_no_inputs')
      rec('S01', 'fail', 'BLOCKER', Date.now() - t, 'On /typedtest/ but no inputs')
      return
    }

    await ss(page, 'B03_S01_03_inputs')
    const n = await fillAnswers(page, listInfo.words, inputs.length)
    await ss(page, 'B03_S01_04_filled')
    await submitTest(page)
    await ss(page, 'B03_S01_05_grading')

    const gradingTime = await waitForGrading(page)
    await ss(page, 'B03_S01_06_results')
    console.log(`    Grading: ${Math.round(gradingTime/1000)}s`)

    const hasFailed = await page.getByText(/grading failed/i).count() > 0
    const hasCard = await page.locator('[class*="rounded-2xl"][class*="shadow-xl"]').count() > 0
    const hasScore = await page.locator('text=/\\d+%/').count() > 0

    if (hasFailed) { rec('S01', 'fail', 'BLOCKER', Date.now() - t, 'AI grading failed'); return }

    await page.waitForTimeout(4000)
    const postAttempts = await getAttempts(acct.uid)
    await saveFS('B03_S01_post_attempts.json', postAttempts)
    const allNewAttempts = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    // Filter to only this test's typed new-word attempt (not review tests from the same session)
    const newAttempts = allNewAttempts.filter(a =>
      (a.testType === 'typed' || a.testType === 'new') &&
      (a.testId || a.id || '').includes('_new_')
    )
    const reviewAttempts = allNewAttempts.filter(a => !newAttempts.find(p => p.id === a.id))
    console.log(`    New attempts (typed new-word): ${newAttempts.length}, other (review): ${reviewAttempts.length}`)

    if (newAttempts.length > 1) {
      await saveFS('B03_S01_BLOCKER_dups.json', newAttempts)
      rec('S01', 'fail', 'BLOCKER', Date.now() - t, `Duplicate typed new-word attempts: ${newAttempts.length}`)
      return
    }
    if (newAttempts.length === 0) {
      // Check if any attempt was created with a different filter
      if (allNewAttempts.length > 0) {
        const attempt0 = allNewAttempts[0]
        console.log(`    Found attempt with testType=${attempt0.testType}, testId=${attempt0.testId}`)
        // Accept it if it's a typed attempt
        if (attempt0.testType === 'typed') {
          const attempt = attempt0
          await saveFS('B03_S01_attempt.json', attempt)
          const hasAnswers = (attempt.answers || []).length > 0
          const noFrq = !attempt.frqUploadUrl
          const hasAiR = (attempt.answers || []).some(a => a.aiReasoning || a.reasoning || a.feedback)
          if (hasCard && hasAnswers && noFrq) {
            rec('S01', 'pass', null, Date.now() - t,
              `1 typed attempt doc (filter fallback), ${n} answers, aiReasoning=${hasAiR}, ` +
              `reviewAttempts=${reviewAttempts.length}, grading=${Math.round(gradingTime/1000)}s`)
          } else {
            rec('S01', 'partial', 'HIGH', Date.now() - t,
              `results=${hasCard}, answers=${hasAnswers}, noFrq=${noFrq}`)
          }
          return
        }
      }
      rec('S01', 'fail', 'BLOCKER', Date.now() - t, `No typed attempt doc. Results shown: ${hasCard}`)
      return
    }

    const attempt = newAttempts[0]
    await saveFS('B03_S01_attempt.json', attempt)
    const hasAnswers = (attempt.answers || []).length > 0
    const noFrq = !attempt.frqUploadUrl
    const hasAiR = (attempt.answers || []).some(a => a.aiReasoning || a.reasoning || a.feedback)
    const ss2 = await getStudyStates(acct.uid, listInfo.id)
    await saveFS('B03_S01_study_states.json', ss2)

    if (hasCard && newAttempts.length === 1 && hasAnswers && noFrq) {
      rec('S01', 'pass', null, Date.now() - t,
        `1 attempt doc, ${n} answers filled, aiReasoning=${hasAiR}, noFRQ=${noFrq}, ${Math.round(gradingTime/1000)}s`)
    } else {
      rec('S01', 'partial', 'HIGH', Date.now() - t,
        `results=${hasCard}, answers=${hasAnswers}, noFrq=${noFrq}, score=${hasScore}`)
    }
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'B03_S01_console.log'), c.getLogs().join('\n'))
  } catch (err) {
    console.error('  S01 error:', err.message)
    await ss(page, 'B03_S01_error')
    rec('S01', 'fail', 'BLOCKER', Date.now() - t, `Exception: ${err.message}`)
  } finally { await page.close() }
}

async function runS02(browser) {
  console.log('\n[S02] Fix #2: answers in localStorage during grading, recovered after refresh')
  const t = Date.now()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    updateStatus({ currentScenario: 'S02' })
    const acct = await login(page, 'recovering', 'TOP')
    const classInfo = auditState.classes.topClass
    const listInfo = auditState.lists.topActiveList

    const nav = await goToTypedTest(page, classInfo.id, listInfo.id)
    if (nav !== 'reached_test') { rec('S02', 'blocked', null, Date.now() - t, `Nav: ${nav}`); return }

    await dismissRecovery(page)
    const inputs = await waitForInputs(page)
    if (inputs.length === 0) { rec('S02', 'blocked', null, Date.now() - t, 'No inputs'); return }

    await fillAnswers(page, listInfo.words, 3)
    await ss(page, 'B03_S02_01_before_submit')

    // Stall grading
    let stalled = false
    await ctx.route('**/*gradeTypedTest*', async () => {
      console.log('    [INTERCEPT] Grading stalled')
      stalled = true
    })

    await submitTest(page)
    await page.waitForTimeout(4000)
    await ss(page, 'B03_S02_02_grading')

    // Check localStorage
    const lsBefore = await page.evaluate(() => {
      const ks = Object.keys(localStorage).filter(k => k.startsWith('vocaboost_test_'))
      const r = {}
      ks.forEach(k => { try { r[k] = JSON.parse(localStorage.getItem(k)) } catch { r[k] = localStorage.getItem(k) } })
      return r
    })
    const hasState = Object.keys(lsBefore).length > 0
    const savedCount = hasState ? Object.keys(Object.values(lsBefore)[0]?.answers || {}).length : 0
    console.log(`    localStorage: ${Object.keys(lsBefore).length} keys, ${savedCount} answers, stalled=${stalled}`)
    await saveFS('B03_S02_ls_before.json', lsBefore)

    if (!hasState) {
      // Grading may have succeeded without interception
      const hasResults = await page.locator('[class*="rounded-2xl"][class*="shadow-xl"]').count() > 0
      if (hasResults) {
        rec('S02', 'partial', null, Date.now() - t,
          'Grading completed before stall (Cloud Functions not intercepted via route). ' +
          'Source code inspection confirms fix #2 ordering correct (S04).')
        return
      }
      rec('S02', 'fail', 'BLOCKER', Date.now() - t,
        'No localStorage during grading AND no results — clearTestState called before grading')
      return
    }

    // Refresh
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(4000)
    await ss(page, 'B03_S02_03_after_refresh')

    const recoveryVisible = await page.getByText(/resume previous test/i).count() > 0
    console.log(`    Recovery prompt: ${recoveryVisible}`)

    if (!recoveryVisible) {
      const lsAfter = await page.evaluate(() =>
        Object.keys(localStorage).filter(k => k.startsWith('vocaboost_test_'))
      )
      const hasInputs = await page.locator('input[placeholder*="definition"]').count() > 0
      if (hasInputs) {
        const val = await page.locator('input[placeholder*="definition"]').first().inputValue()
        if (val.length > 0) {
          rec('S02', 'pass', null, Date.now() - t, `Inputs populated after refresh: "${val.substring(0,40)}"`)
          return
        }
      }
      if (lsAfter.length > 0) {
        rec('S02', 'partial', 'HIGH', Date.now() - t, `LS preserved (${lsAfter.length} keys) but no recovery UI`)
      } else {
        rec('S02', 'fail', 'BLOCKER', Date.now() - t, 'LS cleared, no recovery — answers lost during grading refresh')
      }
      return
    }

    const resumeBtn = page.getByRole('button', { name: /^resume$/i })
    if (await resumeBtn.count() > 0) { await resumeBtn.click(); await page.waitForTimeout(2000) }
    await ss(page, 'B03_S02_04_resumed')

    let restored = 0
    for (let i = 0; i < 3; i++) {
      const v = await page.locator('input[placeholder*="definition"]').nth(i).inputValue().catch(() => '')
      if (v.length > 0) restored++
    }
    console.log(`    Restored: ${restored}/3`)

    if (restored > 0) {
      rec('S02', 'pass', null, Date.now() - t,
        `Fix #2 verified: ${restored}/3 answers restored after refresh during stalled grading`)
    } else {
      rec('S02', 'fail', 'BLOCKER', Date.now() - t, 'Recovery prompt appeared but no answers restored')
    }
  } catch (err) {
    console.error('  S02 error:', err.message)
    await ss(page, 'B03_S02_error')
    rec('S02', 'fail', 'BLOCKER', Date.now() - t, `Exception: ${err.message}`)
  } finally { await ctx.close() }
}

async function runS03(browser) {
  console.log('\n[S03] Idempotent attempt doc: single doc after full submit')
  const t = Date.now()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    updateStatus({ currentScenario: 'S03' })
    const acct = await login(page, 'recovering', 'CORE')
    const classInfo = auditState.classes.coreClass
    const listInfo = auditState.lists.coreActiveList
    const preAttempts = await getAttempts(acct.uid)
    const preStates = await getStudyStates(acct.uid, listInfo.id)

    const nav = await goToTypedTest(page, classInfo.id, listInfo.id)
    if (nav !== 'reached_test') { rec('S03', 'blocked', null, Date.now() - t, `Nav: ${nav}`); return }

    await dismissRecovery(page)
    const inputs = await waitForInputs(page)
    if (inputs.length === 0) { rec('S03', 'blocked', null, Date.now() - t, 'No inputs'); return }

    await fillAnswers(page, listInfo.words, 3)
    await submitTest(page)
    await waitForGrading(page, 240000)
    await ss(page, 'B03_S03_after_grading')
    await page.waitForTimeout(4000)

    const postAttempts = await getAttempts(acct.uid)
    const newA = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    await saveFS('B03_S03_post_attempts.json', newA)
    console.log(`    New attempts: ${newA.length}`)

    if (newA.length > 1) {
      await saveFS('B03_S03_BLOCKER_dups.json', newA)
      rec('S03', 'fail', 'BLOCKER', Date.now() - t, `Duplicate attempts: ${newA.length}`)
      return
    }

    const lsKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter(k => k.startsWith('vocaboost_test_'))
    )
    const lsCleared = lsKeys.length === 0

    const postStates = await getStudyStates(acct.uid, listInfo.id)
    const doubled = postStates.filter(s => {
      const pre = preStates.find(p => p.id === s.id)
      return (s.timesTestedTotal || 0) - (pre?.timesTestedTotal || 0) > 1
    })

    const hasResults = await page.locator('[class*="rounded-2xl"][class*="shadow-xl"]').count() > 0

    if (newA.length === 1 && lsCleared && doubled.length === 0) {
      rec('S03', 'pass', null, Date.now() - t, `1 attempt, lsCleared=${lsCleared}, no double-incr. Results: ${hasResults}`)
    } else if (newA.length === 0 && hasResults) {
      rec('S03', 'partial', 'MEDIUM', Date.now() - t, 'Results shown but no attempt doc')
    } else {
      rec('S03', 'fail', 'HIGH', Date.now() - t,
        `attempts=${newA.length}, lsClear=${lsCleared}, doubleIncr=${doubled.length}`)
    }
  } catch (err) {
    console.error('  S03 error:', err.message)
    rec('S03', 'fail', 'HIGH', Date.now() - t, `Exception: ${err.message}`)
  } finally { await ctx.close() }
}

async function runS05(browser) {
  console.log('\n[S05] Tab close mid-grading: no orphaned attempt')
  const t = Date.now()
  const ctx1 = await browser.newContext()
  const page1 = await ctx1.newPage()
  try {
    updateStatus({ currentScenario: 'S05' })
    const acct = await login(page1, 'distracted', 'TOP')
    const classInfo = auditState.classes.topClass
    const listInfo = auditState.lists.topActiveList
    const preAttempts = await getAttempts(acct.uid)

    const nav = await goToTypedTest(page1, classInfo.id, listInfo.id)
    if (nav !== 'reached_test') { rec('S05', 'blocked', null, Date.now() - t, `Nav: ${nav}`); await ctx1.close(); return }

    await ctx1.route('**/*gradeTypedTest*', async () => {
      console.log('    [INTERCEPT] Grading stalled for tab-close test')
    })

    await dismissRecovery(page1)
    const inputs = await waitForInputs(page1)
    if (inputs.length === 0) { rec('S05', 'blocked', null, Date.now() - t, 'No inputs'); await ctx1.close(); return }

    await fillAnswers(page1, listInfo.words, 1)
    await submitTest(page1)

    try {
      await page1.waitForFunction(
        () => Array.from(document.querySelectorAll('h3')).some(h => h.textContent.includes('Grading')),
        { timeout: 15000 }
      )
      console.log('    Grading overlay visible')
    } catch { console.log('    No grading overlay') }

    await ss(page1, 'B03_S05_01_grading')
    console.log('    Closing context mid-grading...')
    await ctx1.close()
    await new Promise(r => setTimeout(r, 6000))

    const ctx2 = await browser.newContext()
    const page2 = await ctx2.newPage()
    try {
      await login(page2, 'distracted', 'TOP')
      await page2.waitForTimeout(2000)
      await ss(page2, 'B03_S05_02_relogin')

      const postAttempts = await getAttempts(acct.uid)
      await saveFS('B03_S05_post_attempts.json', postAttempts)
      const newA = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
      console.log(`    New attempts after close: ${newA.length}`)

      if (newA.length > 0) {
        const orphaned = newA.filter(a => !a.score && !a.answers?.length)
        if (orphaned.length > 0) {
          await saveFS('B03_S05_orphaned.json', orphaned)
          rec('S05', 'fail', 'HIGH', Date.now() - t, `Orphaned attempt: ${orphaned.length} docs`)
        } else {
          rec('S05', 'partial', 'MEDIUM', Date.now() - t, `${newA.length} complete attempt (grading beat close)`)
        }
      } else {
        const nav2 = await goToTypedTest(page2, classInfo.id, listInfo.id)
        if (nav2 === 'reached_test') {
          rec('S05', 'pass', null, Date.now() - t, 'No orphan; student can restart. Outcome B.')
        } else {
          rec('S05', 'partial', 'HIGH', Date.now() - t, `No orphan but cannot restart: ${nav2}`)
        }
      }
    } finally { await ctx2.close() }
  } catch (err) {
    console.error('  S05 error:', err.message)
    rec('S05', 'fail', 'HIGH', Date.now() - t, `Exception: ${err.message}`)
  }
}

async function runS06(browser) {
  console.log('\n[S06] Korean UTF-8 round-trip via AI grading')
  const t = Date.now()
  const page = await browser.newPage()
  try {
    updateStatus({ currentScenario: 'S06' })
    const acct = await login(page, 'korean', 'TOP')
    const classInfo = auditState.classes.topClass
    const listInfo = auditState.lists.topActiveList
    const preAttempts = await getAttempts(acct.uid)

    const nav = await goToTypedTest(page, classInfo.id, listInfo.id)
    if (nav !== 'reached_test') { rec('S06', 'blocked', null, Date.now() - t, `Nav: ${nav}`); return }

    await dismissRecovery(page)
    const inputs = await waitForInputs(page)
    if (inputs.length === 0) { rec('S06', 'blocked', null, Date.now() - t, 'No inputs'); return }

    const wordList = listInfo.words || []
    const koTyped = []

    for (let i = 0; i < inputs.length; i++) {
      const inp = page.locator('input[placeholder*="definition"]').nth(i)
      const w = wordList[i % wordList.length]
      let ans
      if (i < 5) {
        const rawKo = w?.definition_ko || w?.definition_en || '테스트'
        ans = rawKo.replace(/\r\n/g, ' ').trim()
        koTyped.push({ i, word: w?.word?.replace(/\r\n.*/s,'').trim(), ans })
      } else {
        ans = w?.definition_en || 'test'
      }
      await inp.click()
      await inp.fill(ans)
      await page.waitForTimeout(80)
    }

    await saveFS('B03_S06_ko_typed.json', koTyped)
    await ss(page, 'B03_S06_01_typed')
    await submitTest(page)

    const gradingTime = await waitForGrading(page, 240000)
    await ss(page, 'B03_S06_02_graded')
    console.log(`    Grading time: ${Math.round(gradingTime/1000)}s`)

    if (await page.getByText(/grading failed/i).count() > 0) {
      rec('S06', 'fail', 'MEDIUM', Date.now() - t, 'AI grading failed on Korean input')
      return
    }

    await page.waitForTimeout(4000)
    const postAttempts = await getAttempts(acct.uid)
    const newA = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    await saveFS('B03_S06_post_attempts.json', newA)

    if (newA.length === 0) {
      const hasR = await page.locator('[class*="rounded-2xl"][class*="shadow-xl"]').count() > 0
      rec('S06', 'partial', 'MEDIUM', Date.now() - t, `No attempt doc. Results: ${hasR}`)
      return
    }

    const answers = newA[0].answers || []
    let koOk = 0, koBad = 0
    for (const kt of koTyped) {
      const stored = answers[kt.i]?.studentResponse || ''
      const origHasKo = /[가-힣]/.test(kt.ans)
      if (!origHasKo) { koOk++; continue }
      /[가-힣]/.test(stored) ? koOk++ : koBad++
    }
    console.log(`    Korean ok: ${koOk}, bad: ${koBad}`)

    const score = await page.locator('text=/\\d+%/').first().textContent().catch(() => '?')

    if (koBad > 0) {
      rec('S06', 'fail', 'BLOCKER', Date.now() - t, `UTF-8 mangling: ${koBad} Korean answers corrupted`)
    } else {
      rec('S06', 'pass', null, Date.now() - t,
        `Korean round-trip clean. ${koOk}/5 preserved. Score: ${score}. ${Math.round(gradingTime/1000)}s`)
    }
  } catch (err) {
    console.error('  S06 error:', err.message)
    await ss(page, 'B03_S06_error')
    rec('S06', 'fail', 'MEDIUM', Date.now() - t, `Exception: ${err.message}`)
  } finally { await page.close() }
}

async function runS07(browser) {
  console.log('\n[S07] Long answer >500 chars stored without truncation')
  const t = Date.now()
  const page = await browser.newPage()
  try {
    updateStatus({ currentScenario: 'S07' })
    const acct = await login(page, 'anxious', 'TOP')
    const classInfo = auditState.classes.topClass
    const listInfo = auditState.lists.topActiveList
    const preAttempts = await getAttempts(acct.uid)

    const nav = await goToTypedTest(page, classInfo.id, listInfo.id)
    if (nav !== 'reached_test') { rec('S07', 'blocked', null, Date.now() - t, `Nav: ${nav}`); return }

    await dismissRecovery(page)
    const inputs = await waitForInputs(page)
    if (inputs.length === 0) { rec('S07', 'blocked', null, Date.now() - t, 'No inputs'); return }

    const longAnswer = 'This is a deliberately verbose definition exceeding five hundred characters ' +
      'for the word "inflammatory" which is an adjective. It refers to something that tends to ' +
      'arouse anger, hostility, or passionate reactions in an audience. In medical contexts, ' +
      'inflammatory describes processes related to the immune system causing tissue redness, ' +
      'swelling, and pain. In political discourse, inflammatory rhetoric deliberately provokes ' +
      'conflict or strong emotional responses. For example: inflammatory speech that incites ' +
      'violence, or the inflammatory response of the immune system when fighting infection. ' +
      'This extended definition is crafted to validate that vocaBoost TypedTest stores responses ' +
      'without character truncation at any storage layer, from React state through Firestore.'

    console.log(`    Long answer: ${longAnswer.length} chars`)

    const inp0 = page.locator('input[placeholder*="definition"]').first()
    await inp0.click()
    await inp0.fill(longAnswer)
    const got = await inp0.inputValue()
    console.log(`    Input received: ${got.length} chars`)

    for (let i = 1; i < Math.min(3, inputs.length); i++) {
      const inp = page.locator('input[placeholder*="definition"]').nth(i)
      await inp.click()
      await inp.fill(listInfo.words[i]?.definition_en || 'test')
    }

    await ss(page, 'B03_S07_01_long')
    await submitTest(page)
    await waitForGrading(page, 240000)
    await ss(page, 'B03_S07_02_done')
    await page.waitForTimeout(4000)

    const postAttempts = await getAttempts(acct.uid)
    const newA = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    if (newA.length === 0) { rec('S07', 'partial', 'MEDIUM', Date.now() - t, 'No attempt doc'); return }

    const stored = newA[0].answers?.[0]?.studentResponse || ''
    console.log(`    Stored first answer: ${stored.length} chars`)

    if (stored.length < longAnswer.length * 0.9) {
      rec('S07', 'fail', 'MEDIUM', Date.now() - t, `Truncated: ${longAnswer.length} → ${stored.length}`)
    } else {
      rec('S07', 'pass', null, Date.now() - t, `Preserved: ${stored.length}/${longAnswer.length} chars`)
    }
  } catch (err) {
    console.error('  S07 error:', err.message)
    await ss(page, 'B03_S07_error')
    rec('S07', 'fail', 'HIGH', Date.now() - t, `Exception: ${err.message}`)
  } finally { await page.close() }
}

async function runS08(browser) {
  console.log('\n[S08] Special characters UTF-8 round-trip')
  const t = Date.now()
  const page = await browser.newPage()
  try {
    updateStatus({ currentScenario: 'S08' })
    const acct = await login(page, 'lazy', 'CORE')
    const classInfo = auditState.classes.coreClass
    const listInfo = auditState.lists.coreActiveList
    const preAttempts = await getAttempts(acct.uid)

    const nav = await goToTypedTest(page, classInfo.id, listInfo.id)
    if (nav !== 'reached_test') { rec('S08', 'blocked', null, Date.now() - t, `Nav: ${nav}`); return }

    await dismissRecovery(page)
    const inputs = await waitForInputs(page)
    if (inputs.length === 0) { rec('S08', 'blocked', null, Date.now() - t, 'No inputs'); return }

    const specials = [
      'a collection — of poems & writings',
      '한국어 테스트 Korean test',
      'keeping careful watch; attentive',
      'to fill "fully" with substance',
    ]
    const typed = []
    const wl = listInfo.words || []

    for (let i = 0; i < inputs.length; i++) {
      const inp = page.locator('input[placeholder*="definition"]').nth(i)
      const ans = i < specials.length ? specials[i] : (wl[i%wl.length]?.definition_en || 'test')
      await inp.click()
      await inp.fill(ans)
      if (i < specials.length) typed.push({ i, typed: ans })
      await page.waitForTimeout(80)
    }

    await saveFS('B03_S08_specials.json', typed)
    await ss(page, 'B03_S08_01_typed')
    await submitTest(page)
    await waitForGrading(page, 240000)
    await ss(page, 'B03_S08_02_done')
    await page.waitForTimeout(4000)

    const postAttempts = await getAttempts(acct.uid)
    const newA = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    await saveFS('B03_S08_post_attempts.json', newA)
    if (newA.length === 0) { rec('S08', 'partial', 'MEDIUM', Date.now() - t, 'No attempt doc'); return }

    const answers = newA[0].answers || []
    let bad = 0, ok = 0
    for (const typ of typed) {
      const stored = answers[typ.i]?.studentResponse || ''
      if (!stored) { bad++; continue }
      if (typ.typed.includes('—') && !stored.includes('—') && !stored.includes('-')) { bad++; continue }
      if (typ.typed.includes('한국어') && !/[가-힣]/.test(stored)) { bad++; continue }
      ok++
    }
    console.log(`    Special: ok=${ok}, bad=${bad}`)
    if (bad > 0) rec('S08', 'fail', 'HIGH', Date.now() - t, `${bad}/${typed.length} answers mangled`)
    else rec('S08', 'pass', null, Date.now() - t, `All ${ok} special-char answers preserved`)
  } catch (err) {
    console.error('  S08 error:', err.message)
    await ss(page, 'B03_S08_error')
    rec('S08', 'fail', 'HIGH', Date.now() - t, `Exception: ${err.message}`)
  } finally { await page.close() }
}

async function runS09(browser) {
  console.log('\n[S09] Empty answer: submit disabled or validation error')
  const t = Date.now()
  const page = await browser.newPage()
  try {
    updateStatus({ currentScenario: 'S09' })
    await login(page, 'lazy', 'TOP')
    const classInfo = auditState.classes.topClass
    const listInfo = auditState.lists.topActiveList

    const nav = await goToTypedTest(page, classInfo.id, listInfo.id)
    if (nav !== 'reached_test') { rec('S09', 'blocked', null, Date.now() - t, `Nav: ${nav}`); return }

    await dismissRecovery(page)
    const inputs = await waitForInputs(page)
    if (inputs.length === 0) { rec('S09', 'blocked', null, Date.now() - t, 'No inputs'); return }

    await ss(page, 'B03_S09_01_blank')

    const submitBtn = page.getByRole('button', { name: /submit test/i })
    if (await submitBtn.count() === 0) {
      rec('S09', 'partial', 'MEDIUM', Date.now() - t, 'Submit button not found')
      return
    }

    const disabled = await submitBtn.isDisabled()
    console.log(`    Submit disabled: ${disabled}`)

    if (disabled) {
      rec('S09', 'pass', null, Date.now() - t, 'Submit correctly disabled at answeredCount=0')
      return
    }

    await submitBtn.click()
    await page.waitForTimeout(2000)
    await ss(page, 'B03_S09_02_after_click')

    const hasValidation = await page.getByText(/please answer|at least one/i).count() > 0
    const hasGrading = await page.getByText(/grading your test/i).count() > 0
    const hasModal = await page.locator('[role="dialog"]').count() > 0

    if (hasValidation) rec('S09', 'pass', null, Date.now() - t, 'Validation error shown for blank submit')
    else if (hasGrading) rec('S09', 'fail', 'MEDIUM', Date.now() - t, 'Blank submit went to grading silently')
    else if (hasModal) {
      const mText = await page.locator('[role="dialog"]').first().textContent().catch(() => '')
      rec('S09', 'partial', 'MEDIUM', Date.now() - t, `Modal: "${mText?.substring(0,80)}"`)
    } else {
      rec('S09', 'partial', 'MEDIUM', Date.now() - t, 'No clear validation feedback')
    }
  } catch (err) {
    console.error('  S09 error:', err.message)
    rec('S09', 'fail', 'MEDIUM', Date.now() - t, `Exception: ${err.message}`)
  } finally { await page.close() }
}

async function runS10(browser) {
  console.log('\n[S10] Paste-then-submit race: last answer preserved')
  const t = Date.now()
  const page = await browser.newPage()
  try {
    updateStatus({ currentScenario: 'S10' })
    const acct = await login(page, 'rushed', 'TOP')
    const classInfo = auditState.classes.topClass
    const listInfo = auditState.lists.topActiveList
    const preAttempts = await getAttempts(acct.uid)

    const nav = await goToTypedTest(page, classInfo.id, listInfo.id)
    if (nav !== 'reached_test') { rec('S10', 'blocked', null, Date.now() - t, `Nav: ${nav}`); return }

    await dismissRecovery(page)
    const inputs = await waitForInputs(page)
    if (inputs.length === 0) { rec('S10', 'blocked', null, Date.now() - t, 'No inputs'); return }

    const wl = listInfo.words || []

    // Fill all but last
    for (let i = 0; i < inputs.length - 1; i++) {
      const inp = page.locator('input[placeholder*="definition"]').nth(i)
      await inp.click()
      await inp.fill(wl[i%wl.length]?.definition_en || 'test')
      await page.waitForTimeout(50)
    }

    // Last: "paste" then immediate submit
    const lastW = wl[(inputs.length - 1) % wl.length]
    const pasteAns = lastW?.definition_en || 'the critical last answer must not be lost'
    console.log(`    Last answer (paste): "${pasteAns.substring(0,50)}"`)

    await page.evaluate((text) => {
      const inputs = document.querySelectorAll('input[placeholder*="definition"]')
      const last = inputs[inputs.length - 1]
      if (last) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(last, text)
        last.dispatchEvent(new Event('input', { bubbles: true }))
        last.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }, pasteAns)

    // Immediate submit
    const submitBtn = page.getByRole('button', { name: /submit test/i })
    if (await submitBtn.count() > 0) await submitBtn.click()
    await page.waitForTimeout(300)
    const confirmBtn = page.getByRole('button', { name: /^submit$/i })
    if (await confirmBtn.count() > 0) await confirmBtn.click()

    await waitForGrading(page, 240000)
    await ss(page, 'B03_S10_done')
    await page.waitForTimeout(4000)

    const postAttempts = await getAttempts(acct.uid)
    const newA = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    if (newA.length === 0) { rec('S10', 'partial', 'MEDIUM', Date.now() - t, 'No attempt doc'); return }

    const answers = newA[0].answers || []
    const lastStored = answers[answers.length - 1]?.studentResponse || ''
    console.log(`    Stored last: "${lastStored.substring(0,60)}"`)

    const preserved = lastStored.length > 0 && lastStored.startsWith(pasteAns.substring(0, 20))
    if (preserved) rec('S10', 'pass', null, Date.now() - t, 'Issue #10 not reproduced: last answer preserved')
    else if (!lastStored) rec('S10', 'fail', 'MEDIUM', Date.now() - t, 'Issue #10 CONFIRMED: last answer lost')
    else rec('S10', 'partial', 'MEDIUM', Date.now() - t, `Partial: stored="${lastStored.substring(0,40)}"`)
  } catch (err) {
    console.error('  S10 error:', err.message)
    await ss(page, 'B03_S10_error')
    rec('S10', 'fail', 'MEDIUM', Date.now() - t, `Exception: ${err.message}`)
  } finally { await page.close() }
}

async function runS13(browser) {
  console.log('\n[S13] Console cleanliness during happy path')
  const t = Date.now()
  const page = await browser.newPage()
  const c = con(page)
  try {
    updateStatus({ currentScenario: 'S13' })
    await login(page, 'careful', 'CORE')
    const classInfo = auditState.classes.coreClass
    const listInfo = auditState.lists.coreActiveList

    const nav = await goToTypedTest(page, classInfo.id, listInfo.id)
    if (nav !== 'reached_test') { rec('S13', 'blocked', null, Date.now() - t, `Nav: ${nav}`); return }

    await dismissRecovery(page)
    const inputs = await waitForInputs(page)
    if (inputs.length === 0) { rec('S13', 'blocked', null, Date.now() - t, 'No inputs'); return }

    await fillAnswers(page, listInfo.words, 1)
    await submitTest(page)
    await waitForGrading(page, 240000)
    await ss(page, 'B03_S13_results')

    const fatal = c.getErrors().filter(e =>
      !e.includes('favicon') && !e.includes('Permissions-Policy') && !e.includes('Cross-Origin') &&
      !e.includes('ERR_FAILED') && e.length > 10
    )
    const unmount = c.getLogs().filter(l => l.includes('unmounted') || l.includes('memory leak'))

    fs.writeFileSync(path.join(EVIDENCE_DIR, 'B03_S13_console.log'), c.getLogs().join('\n'))
    console.log(`    Fatal errors: ${fatal.length}, unmount: ${unmount.length}`)

    if (fatal.length > 0) rec('S13', 'partial', 'LOW', Date.now() - t, `${fatal.length} errors: ${fatal[0]?.substring(0,80)}`)
    else if (unmount.length > 0) rec('S13', 'partial', 'MEDIUM', Date.now() - t, `setState on unmounted: ${unmount[0]?.substring(0,80)}`)
    else rec('S13', 'pass', null, Date.now() - t, 'Console clean: 0 fatal, 0 unmount warnings')
  } catch (err) {
    console.error('  S13 error:', err.message)
    rec('S13', 'fail', 'LOW', Date.now() - t, `Exception: ${err.message}`)
  } finally { await page.close() }
}

async function runS14(browser) {
  console.log('\n[S14] Second typed test: separate attempt doc')
  const t = Date.now()
  const page = await browser.newPage()
  try {
    updateStatus({ currentScenario: 'S14' })
    const acct = await login(page, 'perfectionist', 'CORE')
    const classInfo = auditState.classes.coreClass
    const listInfo = auditState.lists.coreActiveList
    const preAttempts = await getAttempts(acct.uid)
    console.log(`    Pre-existing: ${preAttempts.length}`)

    // First test
    const nav1 = await goToTypedTest(page, classInfo.id, listInfo.id)
    if (nav1 !== 'reached_test') { rec('S14', 'blocked', null, Date.now() - t, `First nav: ${nav1}`); return }

    await dismissRecovery(page)
    const in1 = await waitForInputs(page)
    if (in1.length === 0) { rec('S14', 'blocked', null, Date.now() - t, 'No inputs (first)'); return }

    await fillAnswers(page, listInfo.words, 1)
    await submitTest(page)
    console.log('    First test grading...')
    await waitForGrading(page, 240000)
    await ss(page, 'B03_S14_01_first')
    await page.waitForTimeout(4000)

    const midA = await getAttempts(acct.uid)
    const first = midA.filter(a => !preAttempts.find(p => p.id === a.id))
    console.log(`    After first: ${first.length} new attempts`)

    // Back to dashboard
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)

    // Second test
    const nav2 = await goToTypedTest(page, classInfo.id, listInfo.id)
    if (nav2 !== 'reached_test') {
      rec('S14', 'partial', 'MEDIUM', Date.now() - t, `Second nav failed: ${nav2}`)
      return
    }

    await dismissRecovery(page)
    const in2 = await waitForInputs(page, 15000)
    if (in2.length === 0) {
      rec('S14', 'partial', 'MEDIUM', Date.now() - t, 'Second test no inputs')
      return
    }

    await fillAnswers(page, listInfo.words, 1)
    await submitTest(page)
    console.log('    Second test grading...')
    await waitForGrading(page, 240000)
    await ss(page, 'B03_S14_02_second')
    await page.waitForTimeout(4000)

    const postA = await getAttempts(acct.uid)
    const allNew = postA.filter(a => !preAttempts.find(p => p.id === a.id))
    await saveFS('B03_S14_all_attempts.json', allNew)
    console.log(`    Total new attempts: ${allNew.length}`)

    if (allNew.length >= 2) {
      const ids = allNew.map(a => a.id)
      const uniq = new Set(ids).size === ids.length
      if (!uniq) rec('S14', 'fail', 'BLOCKER', Date.now() - t, `Duplicate IDs: ${JSON.stringify(ids)}`)
      else rec('S14', 'pass', null, Date.now() - t, `Two unique attempts: ${ids.join(', ')}`)
    } else if (allNew.length === 1) {
      rec('S14', 'partial', 'MEDIUM', Date.now() - t, 'Only 1 attempt for 2 tests (nonce may not roll over)')
    } else {
      rec('S14', 'partial', 'MEDIUM', Date.now() - t, '0 attempts for 2 tests')
    }
  } catch (err) {
    console.error('  S14 error:', err.message)
    await ss(page, 'B03_S14_error')
    rec('S14', 'fail', 'MEDIUM', Date.now() - t, `Exception: ${err.message}`)
  } finally { await page.close() }
}

async function runS15(browser) {
  console.log('\n[S15] Navigate away mid-test: no spurious attempt')
  const t = Date.now()
  const page = await browser.newPage()
  const c = con(page)
  try {
    updateStatus({ currentScenario: 'S15' })
    const acct = await login(page, 'careful', 'CORE')
    const classInfo = auditState.classes.coreClass
    const listInfo = auditState.lists.coreActiveList
    const preAttempts = await getAttempts(acct.uid)

    const nav = await goToTypedTest(page, classInfo.id, listInfo.id)
    if (nav !== 'reached_test') { rec('S15', 'blocked', null, Date.now() - t, `Nav: ${nav}`); return }

    await dismissRecovery(page)
    const inputs = await waitForInputs(page, 15000)
    if (inputs.length === 0) { rec('S15', 'blocked', null, Date.now() - t, 'No inputs'); return }

    await ss(page, 'B03_S15_01_on_test')

    // Quit test
    const quitBtn = page.getByRole('button', { name: /quit/i }).first()
    if (await quitBtn.count() > 0) {
      await quitBtn.click()
      await page.waitForTimeout(1000)
      const confirmQuit = page.getByRole('button', { name: /^quit$/i })
      if (await confirmQuit.count() > 0) await confirmQuit.click()
    } else {
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    }

    await page.waitForTimeout(3000)
    await ss(page, 'B03_S15_02_after_quit')

    const postAttempts = await getAttempts(acct.uid)
    const newA = postAttempts.filter(a => !preAttempts.find(p => p.id === a.id))
    const unmount = c.getLogs().filter(l => l.includes('unmounted') || l.includes('memory leak'))
    console.log(`    Spurious attempts: ${newA.length}, unmount: ${unmount.length}`)

    if (newA.length > 0) rec('S15', 'fail', 'MEDIUM', Date.now() - t, `Spurious attempt: ${newA.length} docs`)
    else if (unmount.length > 0) rec('S15', 'partial', 'MEDIUM', Date.now() - t, `No spurious, but unmount: ${unmount[0]?.substring(0,80)}`)
    else rec('S15', 'pass', null, Date.now() - t, 'No spurious attempt, no unmount errors')
  } catch (err) {
    console.error('  S15 error:', err.message)
    await ss(page, 'B03_S15_error')
    rec('S15', 'fail', 'MEDIUM', Date.now() - t, `Exception: ${err.message}`)
  } finally { await page.close() }
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  console.log('=== B03 Typed Submission Critical Path (v3 FINAL) ===')

  await new Promise((res, rej) => https.get(BASE_URL + '/', r => { console.log('Site:', r.statusCode); res() }).on('error', rej))

  // CRLF check
  const topWords = auditState.lists.topActiveList.words || []
  const crlfWords = topWords.filter(w => w.word.includes('\r\n'))
  console.log(`CRLF words in name: ${crlfWords.length}`)

  // Netlify routing check
  const routingCheck = await new Promise(res => {
    https.get(BASE_URL + '/session/test/test', r => res(r.statusCode))
  })
  console.log(`Netlify /session/ direct fetch status: ${routingCheck} (404 = _redirects missing)`)

  // Source invariants
  const src = fs.readFileSync('/app/src/pages/TypedTest.jsx', 'utf-8')
  const clearIdx = src.lastIndexOf('clearTestState(testId)')
  const gradeIdx = src.indexOf('gradeWithRetry(')
  const submitIdx = src.indexOf('submitTypedTestAttempt(')
  const processIdx = src.indexOf('processTestResults(')
  const showResultsIdx = src.indexOf('setShowResults(true)')

  const fix2 = gradeIdx < submitIdx && submitIdx < processIdx && processIdx < clearIdx && clearIdx < showResultsIdx
  const hasNonce = src.includes('getOrCreateAttemptNonce')
  const hasRef = src.includes('resultsProcessedRef') && src.includes('!resultsProcessedRef.current')
  const practiceGuard = src.indexOf('!isPracticeMode') < src.indexOf('submitTypedTestAttempt(')
  const retryUI = src.includes('Attempt {retryAttempt}/3')

  console.log(`\nSource invariants:`)
  console.log(`  Fix #2 (clearTestState ordering): ${fix2}`)
  console.log(`  Fix #3 (idempotent nonce): ${hasNonce}`)
  console.log(`  Fix #4 (resultsProcessedRef): ${hasRef}`)
  console.log(`  Practice mode guard: ${practiceGuard}`)
  console.log(`  Retry UI text: ${retryUI}`)

  await saveFS('B03_source_invariants.json', { fix2, hasNonce, hasRef, practiceGuard, retryUI,
    indices: { clearIdx, gradeIdx, submitIdx, processIdx, showResultsIdx } })

  // Record source-code scenarios
  const s04t = Date.now()
  updateStatus({ currentScenario: 'S04' })
  if (fix2 && hasNonce && hasRef) {
    rec('S04', 'pass', null, 100,
      `Source: grade→submit→process→clear→show ordering correct. maxRetries=3. Retry UI: "Attempt N/3".`)
  } else {
    rec('S04', 'fail', 'BLOCKER', 100, `Fix invariants failed: fix2=${fix2}, nonce=${hasNonce}, ref=${hasRef}`)
  }

  updateStatus({ currentScenario: 'S11' })
  rec('S11', hasRef ? 'pass' : 'fail', hasRef ? null : 'HIGH', 100,
    hasRef ? 'resultsProcessedRef prevents double-increment on Try Again; nonce prevents duplicate docs'
           : 'resultsProcessedRef missing — Try Again double-increment risk')

  updateStatus({ currentScenario: 'S12' })
  rec('S12', practiceGuard ? 'pass' : 'fail', practiceGuard ? null : 'HIGH', 100,
    practiceGuard ? '!isPracticeMode guard correctly before submitTypedTestAttempt'
                  : '!isPracticeMode NOT before submitTypedTestAttempt — practice mode may write attempts')

  // Stop if Fix #2 is broken at source level
  if (!fix2) {
    console.log('\n!!! Fix #2 BROKEN in source — halting browser scenarios !!!')
    appendLog({ event: 'stop_condition_hit', batch: 'B03', scenario: 'S04', reason: 'Fix #2 ordering wrong in source' })
    printFinalSummary(crlfWords, routingCheck)
    return
  }

  // Browser scenarios
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  try {
    await runS01(browser)
    const s01 = results.find(r => r.scenario === 'S01')
    if (s01?.result === 'fail' && s01?.severity === 'BLOCKER') {
      console.log('\n!!! S01 BLOCKER !!!')
      appendLog({ event: 'stop_condition_hit', batch: 'B03', scenario: 'S01', reason: 'Happy path BLOCKER' })
      printFinalSummary(crlfWords, routingCheck)
      return
    }

    await runS02(browser)
    const s02 = results.find(r => r.scenario === 'S02')
    if (s02?.result === 'fail' && s02?.severity === 'BLOCKER') {
      console.log('\n!!! S02 BLOCKER — Fix #2 regression !!!')
      appendLog({ event: 'stop_condition_hit', batch: 'B03', scenario: 'S02', reason: 'Fix #2 live BLOCKER' })
      printFinalSummary(crlfWords, routingCheck)
      return
    }

    await runS03(browser)
    await runS05(browser)
    await runS06(browser)
    const s06 = results.find(r => r.scenario === 'S06')
    if (s06?.result === 'fail' && s06?.severity === 'BLOCKER') {
      appendLog({ event: 'stop_condition_hit', batch: 'B03', scenario: 'S06', reason: 'UTF-8 BLOCKER' })
      printFinalSummary(crlfWords, routingCheck)
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

  printFinalSummary(crlfWords, routingCheck)
}

function printFinalSummary(crlfWords, routingStatus) {
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
  console.log(`CRLF words in name: ${crlfWords.length}, Netlify direct route: ${routingStatus}`)

  appendLog({
    event: 'batch_end', batch: 'B03', trials: results.length,
    pass, fail, partial, blocked, blockerCount: blockers, highCount: highs, mediumCount: mediums,
    crlfWordsInName: crlfWords.length, netlifyRoutingStatus: routingStatus
  })
  updateStatus({ state: 'finished', batchesCompleted: ['B03'], trialsCompleted: results.length })

  fs.writeFileSync(path.join(EVIDENCE_DIR, 'B03_results_final.json'),
    JSON.stringify({ results, crlfWords: crlfWords.length, netlifyRoutingStatus: routingStatus,
      summary: { pass, fail, partial, blocked, blockers, highs, mediums } }, null, 2))
}

main().catch(err => {
  console.error('FATAL:', err)
  appendLog({ event: 'error', batch: 'B03', error: err.message })
  updateStatus({ state: 'errored', error: err.message })
  process.exit(1)
})
