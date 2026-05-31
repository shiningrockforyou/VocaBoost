/**
 * D1-08 — Day-1 Completion Test: Rushed Cadence, CORE class
 * Account: audit_rushed_01_core@vocaboost.test / AuditPass2026!
 * Class: LVjBTFuYE8FbPG34pVAt (CORE), List: aRGjnGXdU4aupiS8SlXR
 *
 * Flow: login → open session → H2 guard → new-word STUDY (rushed) → new-word TEST
 *       → answer quickly (mostly correct, char-by-char) → submit → grading → results → Day 1 complete
 *
 * Assertions:
 * - Reached + completed Day-1 test
 * - No B2 "Unsupported field value: undefined" error
 * - New words = Day-1 slice [0, pace=60) from CORE list
 * - CSD before=0 → after=1
 * - Exactly one Day-1 attempt total (no dup from rushed clicks)
 * - All questions actually answered (rushing didn't skip any)
 * - No orphan docs
 */

import { chromium } from 'playwright'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs'
import path from 'path'

// ─── Paths ────────────────────────────────────────────────────────────────
const CHROMIUM_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'
const BASE_URL = 'https://vocaboostone.netlify.app'
const SA_PATH = '/app/scripts/serviceAccountKey.json'

const EVIDENCE_DIR = '/app/findings/evidence/D1-08'
const FINDINGS_PATH = '/app/findings/day1/D1-08_rushed_core.md'
const AGENT_LOGS_DIR = '/app/findings/agent_logs'
const LOG_PATH = path.join(AGENT_LOGS_DIR, 'D1-08.jsonl')
const STATUS_PATH = path.join(AGENT_LOGS_DIR, 'D1-08.status.json')

mkdirSync(EVIDENCE_DIR, { recursive: true })
mkdirSync(AGENT_LOGS_DIR, { recursive: true })
mkdirSync('/app/findings/day1', { recursive: true })

// ─── Account config ───────────────────────────────────────────────────────
const EMAIL = 'audit_rushed_01_core@vocaboost.test'
const PASSWORD = 'AuditPass2026!'
const UID = 'QJ5AXP27u9exyxGRgnmU5ARsBRm2'
const CLASS_ID = 'LVjBTFuYE8FbPG34pVAt'
const LIST_ID = 'aRGjnGXdU4aupiS8SlXR'
const CP_DOC_ID = `${CLASS_ID}_${LIST_ID}`

// ─── CORE class config (confirmed from Firestore) ─────────────────────────
const DAILY_PACE = 60           // pace=60
const TEST_SIZE_NEW = 25        // testSizeNew=25
const PASS_THRESHOLD = 90       // 90%
const TEST_MODE = 'typed'       // testMode=typed

// ─── Firebase Admin (READ-ONLY) ───────────────────────────────────────────
const sa = JSON.parse(readFileSync(SA_PATH, 'utf-8'))
if (getApps().length === 0) initializeApp({ credential: cert(sa) })
const db = getFirestore()

// ─── Word cache (first 65 positions from CORE list) ───────────────────────
const CORE_WORDS = JSON.parse(readFileSync('/tmp/core_words_d1.json', 'utf-8'))
const WORD_BY_TEXT = {}
const WORD_BY_ID = {}
for (const w of CORE_WORDS) {
  const norm = w.word.trim().replace(/\r\n\(old English\)/i, '').replace(/\r\n/g, '').trim().toLowerCase()
  WORD_BY_TEXT[norm] = w
  WORD_BY_ID[w.id] = w
}

function lookupWord(wordStr) {
  if (!wordStr) return null
  const norm = wordStr.trim().replace(/\r\n\(old English\)/i, '').replace(/\r\n/g, '').trim().toLowerCase()
  return WORD_BY_TEXT[norm] || null
}

// ─── Logging ──────────────────────────────────────────────────────────────
const log = (event) => {
  const entry = { ts: new Date().toISOString(), ...event }
  appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n')
  console.log(`[${entry.ts}] ${event.event || event.step || JSON.stringify(event)}`)
}

// ─── Firestore helpers (READ-ONLY) ────────────────────────────────────────
async function snapshotState(label) {
  const [classProgress, studyStates, sessionStates, attempts] = await Promise.all([
    db.collection('users').doc(UID).collection('class_progress').get()
      .then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
    db.collection('users').doc(UID).collection('study_states').get()
      .then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
    db.collection('users').doc(UID).collection('session_states').get()
      .then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))).catch(() => []),
    db.collection('attempts').where('studentId', '==', UID).get()
      .then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
  ])
  const snap = { label, capturedAt: new Date().toISOString(), classProgress, studyStates: studyStates.length, sessionStates, attempts }
  writeFileSync(path.join(EVIDENCE_DIR, `${label}_state.json`), JSON.stringify(snap, null, 2))
  log({ event: 'snapshot', label, classProgressDocs: classProgress.length, studyStatesDocs: studyStates.length, sessionStatesDocs: sessionStates.length, attemptsDocs: attempts.length })
  return snap
}

async function screenshot(page, name) {
  const fpath = path.join(EVIDENCE_DIR, `${name}.png`)
  await page.screenshot({ path: fpath, fullPage: true })
  log({ event: 'screenshot', name })
  return fpath
}

function setupConsoleCapture(page) {
  page._consoleErrors = []
  page._allConsoleMessages = []
  page.on('console', msg => {
    const text = msg.text()
    page._allConsoleMessages.push({ type: msg.type(), text })
    if (msg.type() === 'error') {
      page._consoleErrors.push(text)
    }
  })
}

// ─── Login helper ─────────────────────────────────────────────────────────
async function loginAs(page) {
  log({ event: 'login_start', email: EMAIL })
  // SPA nav: warm root, then client-route to /login
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await loginLink.count()) {
    await loginLink.click()
  } else {
    await page.evaluate(() => {
      history.pushState({}, '', '/login')
      dispatchEvent(new PopStateEvent('popstate'))
    })
  }
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(EMAIL)
  await page.getByLabel(/password/i).first().fill(PASSWORD)
  await page.getByLabel(/password/i).first().press('Enter')
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(async () => {
    await page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i })
      .first().click().catch(() => {})
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  })
  log({ event: 'login_success', url: page.url() })
}

// ─── Main test ────────────────────────────────────────────────────────────
const findings = []
const metrics = {
  account: EMAIL,
  uid: UID,
  classId: CLASS_ID,
  listId: LIST_ID,
  testMode: TEST_MODE,
  dailyPace: DAILY_PACE,
  testSizeNew: TEST_SIZE_NEW,
  reachedTest: false,
  testCompleted: false,
  submittedAt: null,
  classification: 'BLOCKED',
  b2Strand: false,
  newWordSliceCorrect: null,
  csdBefore: null,
  csdAfter: null,
  duplicateAttempts: false,
  skippedQuestions: false,
  consoleErrors: [],
  orphanDocs: false,
  day1OK: false,
  presentedWordPositions: [],
  questionCount: 0,
  questionsAnswered: 0,
  score: null,
  passed: null,
  attemptsBeforeCount: 0,
  attemptsAfterCount: 0,
  rushIssues: [],
}

let browser
try {
  // ─── Step 0: Baseline Firestore state ───────────────────────────────────
  log({ step: 'S0', event: 'baseline_firestore' })
  const beforeState = await snapshotState('before')
  const cpBefore = beforeState.classProgress.find(c => c.id === CP_DOC_ID)
  metrics.csdBefore = cpBefore?.currentStudyDay ?? 0
  metrics.attemptsBeforeCount = beforeState.attempts.length
  log({ event: 'baseline', csdBefore: metrics.csdBefore, attemptsBeforeCount: metrics.attemptsBeforeCount })

  // ─── Launch browser ──────────────────────────────────────────────────────
  browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block',
  })
  const page = await context.newPage()
  setupConsoleCapture(page)

  // ─── Step 1: Login ───────────────────────────────────────────────────────
  log({ step: 'S1', event: 'login' })
  await loginAs(page)
  await screenshot(page, '01_dashboard')

  // Check H2 guard: confirm we see CORE class listed on dashboard
  await page.waitForTimeout(2000)
  const dashText = await page.locator('body').textContent().catch(() => '')
  const hasClassCard = /25WT|CORE|OFFLINE/i.test(dashText)
  log({ event: 'h2_guard', hasClassCard, dashTextSnippet: dashText.slice(0, 300) })
  if (!hasClassCard) {
    findings.push({ severity: 'BLOCKER', title: 'CORE class card not found on dashboard after login' })
  }

  // ─── Step 2: Start Session ───────────────────────────────────────────────
  log({ step: 'S2', event: 'start_session' })
  await page.waitForTimeout(1000)

  // Look for "Start Session" button or "Continue Session"
  let sessionStarted = false
  const continueBtn = page.getByRole('button', { name: /continue session/i }).first()
  if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    log({ event: 'continue_session_found' })
    await continueBtn.click()
    sessionStarted = true
  } else {
    const startBtns = page.getByRole('button', { name: 'Start Session' })
    const btnCount = await startBtns.count()
    log({ event: 'start_session_buttons_found', count: btnCount })
    if (btnCount > 0) {
      await startBtns.first().click()
      sessionStarted = true
    } else {
      // Try broader search
      const anyStart = page.getByRole('button', { name: /start.*(session|today)/i }).first()
      if (await anyStart.isVisible({ timeout: 3000 }).catch(() => false)) {
        await anyStart.click()
        sessionStarted = true
      }
    }
  }

  if (!sessionStarted) {
    const bodyText = await page.locator('body').textContent().catch(() => '')
    log({ event: 'session_start_failed', bodyText: bodyText.slice(0, 500) })
    findings.push({ severity: 'BLOCKER', title: 'Could not find session start button', detail: bodyText.slice(0, 500) })
    metrics.classification = 'BLOCKED(no_start_button)'
    throw new Error('Session start button not found')
  }

  await page.waitForTimeout(3000)
  await screenshot(page, '02_session_opened')

  // ─── Dismiss flashcard customization modal if present ───────────────────
  const startStudyingBtn = page.getByRole('button', { name: /start studying/i }).first()
  if (await startStudyingBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    log({ event: 'flashcard_modal_dismiss' })
    await startStudyingBtn.click()
    await page.waitForTimeout(500)
  }

  // ─── Step 3: STUDY phase — rushed: click through fast ───────────────────
  log({ step: 'S3', event: 'study_phase_start' })
  await screenshot(page, '03_study_phase')

  // Verify we're in study phase
  const studyPageText = await page.locator('body').textContent().catch(() => '')
  const isStudyPhase = /New Words|Study|flashcard|got it|show definition|know|flip/i.test(studyPageText)
  log({ event: 'study_phase_check', isStudyPhase, pageSnippet: studyPageText.slice(0, 300) })

  // Check if already at test or results (session may have been in progress)
  const isAlreadyAtTest = /New Words Test|Type your definition|type.*answer/i.test(studyPageText)
  const isAtResults = /Completed Day|Day \d+.*Complete|Results/i.test(studyPageText)
  log({ event: 'phase_detect', isAlreadyAtTest, isAtResults })

  if (!isAlreadyAtTest && !isAtResults) {
    // RUSHED: click through flashcards fast (minimal dwell)
    let cardsDismissed = 0
    const MAX_CARDS = 150 // pace=60 but study may show more

    for (let i = 0; i < MAX_CARDS; i++) {
      // Check if moved to test
      const bodyText = await page.locator('body').textContent().catch(() => '')
      const atTest = /New Words Test|Type your definition|type.*answer|Submit Test/i.test(bodyText)
      const atResults = /Completed Day|Day \d+.*Complete|Pass|Fail/i.test(bodyText)
      if (atTest || atResults) {
        log({ event: 'moved_to_test_or_results', cardsDismissed, atTest, atResults })
        break
      }

      // RUSHED: try "Got It" first (fastest), then "Show Definition" → "Got It"
      // Also check for session menu / skip to test
      const gotItBtn = page.locator('button').filter({ hasText: /^Got It$|^I Know$|^Next$/ }).first()
      const showDefBtn = page.locator('button').filter({ hasText: /^Show Definition$|^Show$|^Flip$/ }).first()
      const knowBtn = page.locator('button').filter({ hasText: /^I Know This!$|^Know It$/ }).first()

      const gotItVis = await gotItBtn.isVisible({ timeout: 300 }).catch(() => false)
      const showDefVis = await showDefBtn.isVisible({ timeout: 300 }).catch(() => false)
      const knowVis = await knowBtn.isVisible({ timeout: 300 }).catch(() => false)

      if (gotItVis) {
        await gotItBtn.click()
        cardsDismissed++
        await page.waitForTimeout(80) // RUSHED: minimal dwell
      } else if (knowVis) {
        await knowBtn.click()
        cardsDismissed++
        await page.waitForTimeout(80)
      } else if (showDefVis) {
        await showDefBtn.click()
        await page.waitForTimeout(200)
        // After showing, click Got It / Next
        const nextAfterShow = page.locator('button').filter({ hasText: /^Got It$|^Next$|^Continue$|^I Know/ }).first()
        if (await nextAfterShow.isVisible({ timeout: 500 }).catch(() => false)) {
          await nextAfterShow.click()
          cardsDismissed++
          await page.waitForTimeout(80)
        }
      } else {
        // No clear button — check for session menu to skip
        const menuBtn = page.locator('[aria-label="Session menu"]').first()
        if (await menuBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          log({ event: 'session_menu_visible_using_skip', cardsDismissed })
          await menuBtn.click()
          await page.waitForTimeout(400)
          const skipText = page.getByText('Skip to Test').first()
          if (await skipText.isVisible({ timeout: 2000 }).catch(() => false)) {
            await skipText.click()
            await page.waitForTimeout(800)
            const confirmBtn = page.getByRole('button', { name: /start test/i }).first()
            if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await confirmBtn.click()
              await page.waitForTimeout(2000)
            }
          }
          break
        }
        // Try any "Next" button
        const anyNext = page.locator('button').filter({ hasText: /next|continue|advance/i }).first()
        if (await anyNext.isVisible({ timeout: 300 }).catch(() => false)) {
          await anyNext.click()
          cardsDismissed++
          await page.waitForTimeout(80)
        } else {
          log({ event: 'no_advance_button', iteration: i, bodySnippet: bodyText.slice(0, 200) })
          await page.waitForTimeout(500)
          // One more try after wait
          const retryGotIt = page.locator('button').filter({ hasText: /got it|know|next/i }).first()
          if (await retryGotIt.isVisible({ timeout: 500 }).catch(() => false)) {
            await retryGotIt.click()
            cardsDismissed++
            await page.waitForTimeout(80)
          } else {
            break
          }
        }
      }

      // Periodic screenshot to capture state
      if (i === 0 || i === 9 || cardsDismissed === DAILY_PACE - 1) {
        await screenshot(page, `03_study_card_${i}`)
      }
    }

    log({ event: 'study_phase_end', cardsDismissed })
    await screenshot(page, '04_after_study')
  } else {
    log({ event: 'study_phase_skipped', reason: isAlreadyAtTest ? 'already_at_test' : 'at_results' })
  }

  // ─── Step 4: Check we're at the test ────────────────────────────────────
  log({ step: 'S4', event: 'test_phase_check' })
  await page.waitForTimeout(2000)
  await screenshot(page, '05_test_phase_start')

  let testPageText = await page.locator('body').textContent().catch(() => '')
  let atTest = /New Words Test|Type your definition|Submit Test/i.test(testPageText)
  log({ event: 'test_phase_detected', atTest, textSnippet: testPageText.slice(0, 400) })

  if (!atTest) {
    // Try using session menu to skip to test
    const menuBtn = page.locator('[aria-label="Session menu"]').first()
    if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      log({ event: 'using_session_menu_to_skip' })
      await menuBtn.click()
      await page.waitForTimeout(400)
      const skipText = page.getByText('Skip to Test').first()
      if (await skipText.isVisible({ timeout: 2000 }).catch(() => false)) {
        await skipText.click()
        await page.waitForTimeout(800)
        const confirmBtn = page.getByRole('button', { name: /start test/i }).first()
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmBtn.click()
          await page.waitForTimeout(3000)
        }
      }
    }

    testPageText = await page.locator('body').textContent().catch(() => '')
    atTest = /New Words Test|Type your definition|Submit Test/i.test(testPageText)
    log({ event: 'test_phase_after_skip', atTest })
  }

  if (!atTest) {
    // Check if we're already at results (day completed)
    const atResults = /Completed Day|Day \d+.*Complete|You (passed|failed)/i.test(testPageText)
    if (atResults) {
      log({ event: 'already_at_results', textSnippet: testPageText.slice(0, 300) })
      metrics.reachedTest = true
      metrics.testCompleted = true
      // Jump to results processing
    } else {
      findings.push({
        severity: 'BLOCKER',
        title: 'Test phase not reached after study phase',
        detail: testPageText.slice(0, 500)
      })
      log({ event: 'test_not_reached', textSnippet: testPageText.slice(0, 500) })
      metrics.classification = 'BLOCKED(test_not_reached)'
      throw new Error('Test phase not reached')
    }
  } else {
    metrics.reachedTest = true
    log({ event: 'test_reached' })
  }

  // ─── Step 5: Typed test — answer quickly, mostly correct ────────────────
  if (atTest) {
    log({ step: 'S5', event: 'typed_test_start' })

    // Get all inputs (whole test may be shown at once for typed tests)
    const typedInputs = page.locator('input[placeholder="Type your definition..."]')
    await page.waitForTimeout(1000)
    let inputCount = await typedInputs.count()
    log({ event: 'typed_inputs_count', inputCount })

    if (inputCount === 0) {
      // Maybe test loads one question at a time
      log({ event: 'no_bulk_inputs_checking_sequential' })
      const singleInput = page.getByRole('textbox').first()
      const singleVisible = await singleInput.isVisible({ timeout: 3000 }).catch(() => false)
      log({ event: 'single_input_visible', singleVisible })
      // Will handle in sequential flow below
    }

    metrics.questionCount = inputCount

    // Extract word-position data from the test
    if (inputCount > 0) {
      const testItems = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[placeholder="Type your definition..."]')
        return Array.from(inputs).map((inp, i) => {
          const container = inp.closest('div.rounded-xl') ||
                           inp.closest('div[class*="rounded"]') ||
                           inp.parentElement?.parentElement
          const wordSpan = container?.querySelector('span.font-medium, h2, h3, [class*="word"], [class*="term"]')
          const posSpan = container?.querySelector('span.text-sm, span[class*="italic"]')
          return {
            index: i,
            word: wordSpan ? wordSpan.textContent.trim() : '',
            pos: posSpan ? posSpan.textContent.trim() : '',
          }
        })
      })
      log({ event: 'test_items_extracted', count: testItems.length, sample: testItems.slice(0, 3) })

      // Validate word slice
      const presentedPositions = []
      for (const item of testItems) {
        const wordEntry = lookupWord(item.word)
        if (wordEntry) {
          presentedPositions.push(wordEntry.position)
        }
      }
      metrics.presentedWordPositions = presentedPositions

      const sliceViolations = presentedPositions.filter(p => p < 0 || p >= DAILY_PACE)
      metrics.newWordSliceCorrect = sliceViolations.length === 0 && presentedPositions.length > 0
      log({ event: 'slice_validation', presentedPositions, sliceViolations, newWordSliceCorrect: metrics.newWordSliceCorrect })

      if (sliceViolations.length > 0) {
        findings.push({
          severity: 'HIGH',
          title: `New word slice violation: ${sliceViolations.length} words outside [0,${DAILY_PACE})`,
          detail: `Positions outside range: ${sliceViolations.join(', ')}`
        })
      }

      // RUSHED: answer each input quickly with correct definition
      // Type char-by-char as instructed, but at rushed speed (minimal delay)
      let answeredCount = 0
      for (let i = 0; i < inputCount; i++) {
        const item = testItems[i]
        const wordEntry = lookupWord(item.word)
        const definition = wordEntry?.definition_en || 'a specific word with meaning'

        const inp = typedInputs.nth(i)
        if (!await inp.isVisible({ timeout: 1000 }).catch(() => false)) {
          log({ event: 'input_not_visible', index: i })
          continue
        }

        await inp.click()
        // Char-by-char as required (NOT .fill()), rushed speed
        for (const ch of definition) {
          await inp.type(ch, { delay: 5 }) // 5ms/char = rushed
        }
        answeredCount++

        if (i === 0) {
          await screenshot(page, '06_first_answer_typed')
        }
        if (i === inputCount - 1) {
          await screenshot(page, '07_last_answer_typed')
        }
      }

      metrics.questionsAnswered = answeredCount
      log({ event: 'all_inputs_filled', answeredCount, totalInputs: inputCount })

      // Check for skipped questions (rushed clicks may have missed some)
      const allFilled = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[placeholder="Type your definition..."]')
        return Array.from(inputs).filter(inp => !inp.value.trim()).length
      })
      metrics.skippedQuestions = allFilled > 0
      log({ event: 'skip_check', emptyInputsRemaining: allFilled, skippedQuestions: metrics.skippedQuestions })

      if (metrics.skippedQuestions) {
        findings.push({
          severity: 'HIGH',
          title: `${allFilled} inputs left empty after rushed typing`,
          detail: 'Rushed cadence may have skipped some question inputs'
        })
      }

      // RUSHED Submit: click quickly (watch for double-submit)
      await screenshot(page, '08_before_submit')
      const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        log({ event: 'submit_click', rushed: true })
        await submitBtn.click()
        // RUSHED: don't double-click (check for disabled state after first click)
        await page.waitForTimeout(500)
        const submitStillEnabled = await submitBtn.isEnabled().catch(() => false)
        log({ event: 'submit_button_state_after_click', submitStillEnabled })
        if (submitStillEnabled) {
          // Check if we're already submitting (loading state)
          const bodyCheck = await page.locator('body').textContent().catch(() => '')
          const isSubmitting = /submitting|grading|please wait|loading/i.test(bodyCheck)
          log({ event: 'double_submit_guard', isSubmitting })
          if (isSubmitting) {
            log({ event: 'submit_in_progress_no_double_click' })
          }
          // DO NOT click again — guard against double-submit
        }
        metrics.submittedAt = new Date().toISOString()
      } else {
        log({ event: 'submit_button_not_found' })
        findings.push({ severity: 'BLOCKER', title: 'Submit Test button not found' })
      }

    } else {
      // Sequential (one question at a time) — handle differently
      log({ event: 'sequential_test_mode' })
      let questionsAnswered = 0
      const MAX_Q = 30

      for (let q = 0; q < MAX_Q; q++) {
        const bodyText = await page.locator('body').textContent().catch(() => '')
        const isResults = /Completed Day|You (passed|failed)|Day \d+.*Complete|Results/i.test(bodyText)
        const isGrading = /Grading|Please wait|Analyzing/i.test(bodyText)
        if (isResults) {
          log({ event: 'sequential_results_reached', questionsAnswered })
          break
        }
        if (isGrading) {
          log({ event: 'grading_wait', q })
          await page.waitForTimeout(10000)
          continue
        }

        const inp = page.getByRole('textbox').first()
        if (!await inp.isVisible({ timeout: 2000 }).catch(() => false)) break

        // Extract word from page
        const wordText = await page.evaluate(() => {
          const els = document.querySelectorAll('h1, h2, h3, span.font-medium, [class*="word"]')
          for (const el of els) {
            const t = el.textContent?.trim()
            if (t && t.length < 60 && !t.includes(' ') && !/question|answer|submit/i.test(t)) return t
          }
          return null
        })

        const wordEntry = lookupWord(wordText || '')
        const definition = wordEntry?.definition_en || 'a word with a specific meaning'
        if (wordEntry) {
          metrics.presentedWordPositions.push(wordEntry.position)
        }

        await inp.click()
        for (const ch of definition) {
          await inp.type(ch, { delay: 5 })
        }
        questionsAnswered++

        const submitBtn = page.getByRole('button', { name: /submit|next|check/i }).first()
        if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await submitBtn.click()
        } else {
          await inp.press('Enter')
        }
        await page.waitForTimeout(200) // rushed: minimal delay between questions
      }

      metrics.questionsAnswered = questionsAnswered
      metrics.questionCount = questionsAnswered
      log({ event: 'sequential_test_done', questionsAnswered })
      metrics.submittedAt = new Date().toISOString()
    }
  }

  // ─── Step 6: Wait for grading / results ─────────────────────────────────
  log({ step: 'S6', event: 'wait_for_grading' })
  await screenshot(page, '09_post_submit')

  // AI grading can take up to ~25s per question batch
  let gradingDone = false
  const GRADING_TIMEOUT_MS = 120000 // 2 min max
  const startWait = Date.now()

  while (Date.now() - startWait < GRADING_TIMEOUT_MS) {
    const bodyText = await page.locator('body').textContent().catch(() => '')
    const atResults = /Completed Day|Day \d+.*Complete|You (passed|failed)|Results|Pass|Fail|\d+\s*%|\d+ of \d+ correct/i.test(bodyText)
    const grading = /Grading|Please wait|Analyzing|Processing/i.test(bodyText)

    if (atResults) {
      gradingDone = true
      log({ event: 'grading_done', elapsedMs: Date.now() - startWait })
      break
    }
    if (!grading) {
      // Check for error states
      const hasError = /failed to save|try again|error/i.test(bodyText)
      if (hasError) {
        log({ event: 'grading_error_state', bodyText: bodyText.slice(0, 300) })
        const tryAgainBtn = page.getByRole('button', { name: /try again/i }).first()
        if (await tryAgainBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await tryAgainBtn.click()
          await page.waitForTimeout(5000)
        }
      }
    }
    await page.waitForTimeout(5000)
  }

  await screenshot(page, '10_results')

  // ─── Step 7: Extract results ─────────────────────────────────────────────
  log({ step: 'S7', event: 'results_extraction' })
  const resultsText = await page.locator('body').textContent().catch(() => '')
  log({ event: 'results_page_text', text: resultsText.slice(0, 1000) })

  // Extract score
  const scoreMatch = resultsText.match(/(\d+)\s*%/)
  const correctMatch = resultsText.match(/(\d+)\s*of\s*(\d+)\s*correct/)
  const completedMatch = resultsText.match(/Completed Day|Day \d+.*Complete/i)
  const passedMatch = resultsText.match(/passed|You passed/i)
  const failedMatch = resultsText.match(/failed|You failed|Not Passed/i)

  if (scoreMatch) metrics.score = parseInt(scoreMatch[1])
  if (correctMatch) metrics.score = Math.round(parseInt(correctMatch[1]) / parseInt(correctMatch[2]) * 100)

  metrics.testCompleted = gradingDone && (completedMatch || scoreMatch || correctMatch) ? true : false
  metrics.passed = passedMatch ? true : failedMatch ? false : null

  log({
    event: 'results_parsed',
    score: metrics.score,
    passed: metrics.passed,
    testCompleted: metrics.testCompleted,
    completedMatch: !!completedMatch,
  })

  // ─── Step 8: Post-test Firestore verification ────────────────────────────
  log({ step: 'S8', event: 'post_test_firestore' })
  await page.waitForTimeout(5000) // let writes propagate

  const afterState = await snapshotState('after')
  const cpAfter = afterState.classProgress.find(c => c.id === CP_DOC_ID)
  metrics.csdAfter = cpAfter?.currentStudyDay ?? metrics.csdBefore
  metrics.attemptsAfterCount = afterState.attempts.length

  // Check for B2 "Unsupported field value: undefined" in console errors
  const allErrors = page._consoleErrors
  metrics.consoleErrors = allErrors.slice(0, 20)
  const b2Errors = allErrors.filter(e => /Unsupported field value: undefined|undefined.*field|field.*undefined/i.test(e))
  metrics.b2Strand = b2Errors.length > 0
  log({ event: 'console_errors', total: allErrors.length, b2Errors: b2Errors.length, errors: allErrors.slice(0, 5) })

  if (metrics.b2Strand) {
    findings.push({
      severity: 'BLOCKER',
      title: 'B2 "Unsupported field value: undefined" detected',
      detail: b2Errors.join('; ')
    })
  }

  // Check duplicate attempts
  const day1Attempts = afterState.attempts.filter(a => a.studyDay === 1)
  metrics.duplicateAttempts = day1Attempts.length > 1
  log({
    event: 'duplicate_check',
    day1AttemptsTotal: day1Attempts.length,
    duplicateAttempts: metrics.duplicateAttempts,
    attemptIds: day1Attempts.map(a => a.id),
  })

  if (metrics.duplicateAttempts) {
    findings.push({
      severity: 'HIGH',
      title: `Duplicate Day-1 attempts: ${day1Attempts.length} found`,
      detail: `Attempt IDs: ${day1Attempts.map(a => a.id).join(', ')}`
    })
  }

  // Check CSD advancement (only if passed; if failed it stays at 0 until pass)
  const expectedCsdAfter = metrics.passed ? 1 : 0
  const csdCorrect = cpAfter?.currentStudyDay === expectedCsdAfter
  log({
    event: 'csd_check',
    csdBefore: metrics.csdBefore,
    csdAfter: metrics.csdAfter,
    passed: metrics.passed,
    expectedCsdAfter,
    csdCorrect,
  })

  if (!csdCorrect && metrics.testCompleted) {
    findings.push({
      severity: 'HIGH',
      title: `CSD not advanced correctly: expected ${expectedCsdAfter}, got ${metrics.csdAfter}`,
      detail: `passed=${metrics.passed}, csdBefore=${metrics.csdBefore}`
    })
  }

  // Check orphan docs (session_states should be cleared or updated after completion)
  const sessionStatesAfter = afterState.sessionStates
  const orphanSession = sessionStatesAfter.filter(s => s.phase === 'new-words-study' && (cpAfter?.currentStudyDay ?? 0) > 0)
  metrics.orphanDocs = orphanSession.length > 0
  log({ event: 'orphan_check', sessionStatesAfter: sessionStatesAfter.length, orphanDocs: metrics.orphanDocs })

  // ─── Determine classification ────────────────────────────────────────────
  metrics.day1OK = metrics.reachedTest && metrics.testCompleted && !metrics.b2Strand &&
                   !metrics.duplicateAttempts && !metrics.skippedQuestions

  if (metrics.passed) {
    metrics.classification = 'COMPLETED_PASS'
  } else if (metrics.testCompleted) {
    metrics.classification = 'COMPLETED_NOPASS'
  } else {
    metrics.classification = `BLOCKED(grading_not_complete)`
  }

  log({ event: 'classification', classification: metrics.classification, day1OK: metrics.day1OK })

  // Check rushed-cadence specific issues
  if (metrics.duplicateAttempts) metrics.rushIssues.push('duplicate_attempt_from_rushed_submit')
  if (metrics.skippedQuestions) metrics.rushIssues.push('questions_skipped_from_fast_clicks')
  if (metrics.questionsAnswered < metrics.questionCount) {
    metrics.rushIssues.push(`questions_answered(${metrics.questionsAnswered})<expected(${metrics.questionCount})`)
  }

  await screenshot(page, '11_final_state')

} catch (err) {
  log({ event: 'fatal_error', error: err.message, stack: err.stack })
  metrics.classification = `BLOCKED(${err.message.slice(0, 80)})`
  findings.push({ severity: 'BLOCKER', title: 'Fatal error', detail: err.message })
} finally {
  if (browser) await browser.close()
  log({ event: 'browser_closed' })
}

// ─── Write output files ───────────────────────────────────────────────────
// .status.json
const statusJson = {
  label: 'D1-08',
  account: EMAIL,
  classification: metrics.classification,
  day1OK: metrics.day1OK,
  completedAt: new Date().toISOString(),
}
writeFileSync(STATUS_PATH, JSON.stringify(statusJson, null, 2))

// findings/day1/D1-08_rushed_core.md
const md = `# D1-08 — Rushed Cadence, CORE Class

**Account**: \`${EMAIL}\`
**UID**: \`${UID}\`
**Class**: CORE (\`${CLASS_ID}\`)
**List**: \`${LIST_ID}\`
**Tested**: ${new Date().toISOString()}
**Prod bundle**: index-CflgDyCK.js (confirmed on https://vocaboostone.netlify.app)

---

## STATUS BLOCK

| Field | Value |
|---|---|
| Account | \`${EMAIL}\` |
| CORE testMode | \`${TEST_MODE}\` |
| Reached test? | ${metrics.reachedTest ? 'YES' : 'NO'} |
| Classification | **${metrics.classification}** |
| B2 strand? | ${metrics.b2Strand ? 'YES (DETECTED)' : 'NO'} |
| New-word slice correct? | ${metrics.newWordSliceCorrect === null ? 'N/A' : metrics.newWordSliceCorrect ? 'YES [0,60)' : 'NO — VIOLATION'} |
| CSD before→after | ${metrics.csdBefore} → ${metrics.csdAfter} |
| Duplicate/skipped under rush? | ${(metrics.duplicateAttempts || metrics.skippedQuestions) ? 'YES' : 'NO'} |
| Console errors | ${metrics.consoleErrors.length === 0 ? 'NONE' : metrics.consoleErrors.length + ' error(s)'} |
| Orphan docs | ${metrics.orphanDocs ? 'YES' : 'NONE'} |
| Day-1 OK? | ${metrics.day1OK ? 'YES' : 'NO'} |

---

## CORE Config (confirmed from Firestore)

- pace: **${DAILY_PACE}** (new words per day = positions 0–59)
- testMode: **${TEST_MODE}**
- testSizeNew: **${TEST_SIZE_NEW}** questions
- passThreshold: **${PASS_THRESHOLD}%**
- reviewTestType: **mcq** (not needed for Day 1)

---

## Test Execution

- Questions presented: ${metrics.questionCount}
- Questions answered: ${metrics.questionsAnswered}
- Score: ${metrics.score !== null ? metrics.score + '%' : 'N/A'}
- Passed: ${metrics.passed !== null ? metrics.passed : 'N/A'}
- Submitted at: ${metrics.submittedAt || 'N/A'}
- Grading completed: ${metrics.testCompleted}

### New Word Slice
- Expected: positions [0, ${DAILY_PACE}) = positions 0–${DAILY_PACE - 1}
- Presented positions: ${metrics.presentedWordPositions.length > 0 ? metrics.presentedWordPositions.slice(0, 10).join(', ') + (metrics.presentedWordPositions.length > 10 ? '...' : '') : 'N/A'}
- Slice correct: ${metrics.newWordSliceCorrect === null ? 'N/A' : metrics.newWordSliceCorrect ? 'YES' : 'NO'}

### Attempt Count
- Before session: ${metrics.attemptsBeforeCount} attempt(s)
- After session: ${metrics.attemptsAfterCount} attempt(s)
- Day-1 attempts total: check after run

### Rushed-Cadence Issues
${metrics.rushIssues.length === 0 ? '- None detected' : metrics.rushIssues.map(r => `- ${r}`).join('\n')}

---

## Console Errors

${metrics.consoleErrors.length === 0 ? 'None.' : metrics.consoleErrors.map(e => `- \`${e}\``).join('\n')}

---

## Findings

${findings.length === 0 ? 'No findings.' : findings.map((f, i) => `### F${String(i+1).padStart(2,'0')} [${f.severity}] ${f.title}\n${f.detail || ''}`).join('\n\n')}

---

## Evidence

Screenshots saved to: \`/app/findings/evidence/D1-08/\`
Log: \`/app/findings/agent_logs/D1-08.jsonl\`
`

writeFileSync(FINDINGS_PATH, md)
log({ event: 'output_written', findingsPath: FINDINGS_PATH, statusPath: STATUS_PATH })

console.log('\n' + '='.repeat(60))
console.log('D1-08 COMPLETE')
console.log('Classification:', metrics.classification)
console.log('Day-1 OK?', metrics.day1OK)
console.log('CSD:', metrics.csdBefore, '→', metrics.csdAfter)
console.log('B2 strand:', metrics.b2Strand)
console.log('Duplicate attempts:', metrics.duplicateAttempts)
console.log('Skipped questions:', metrics.skippedQuestions)
console.log('Console errors:', metrics.consoleErrors.length)
console.log('='.repeat(60))
