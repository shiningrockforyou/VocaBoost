/**
 * B27 Longitudinal Audit Runner — esl/TOP persona (Agent E27)
 *
 * ESL persona: esl_strip_articles_mispluralize transform
 * - Strip articles (a, an, the)
 * - Mis-pluralize nouns (add -s to non-plural, drop -s from plural)
 * - Swap one tense (keep otherwise correct)
 * - Type char-by-char (NEVER .fill())
 *
 * Verifies F01 fix: no MASTERED word (future returnAt) should appear in review.
 * Includes one logout/login mid-session scenario.
 *
 * ABSOLUTE RULE: Admin SDK read-only. UI-only state advancement.
 */

import { chromium } from 'playwright'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'fs'
import { join } from 'path'

// ---- Config ----
const BASE_URL = 'https://vocaboostone.netlify.app'
const EMAIL = 'audit_esl_01_top@vocaboost.test'
const PASSWORD = 'AuditPass2026!'
const UID = 'B6tBqzrCGNRevWvhRetX7F259IS2'
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
const LIST_ID = '8RMews2H7C3UJUAsOBzR'
const CP_DOC_ID = `${CLASS_ID}_${LIST_ID}`

const DAILY_PACE = 80
const STUDY_DAYS_PER_WEEK = 5
const PASS_THRESHOLD_PCT = 92
const LIST_SIZE = 3381

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B27/esl'
const FINDINGS_DIR = '/app/audit/playwright/findings'
const AGENT_LOGS_DIR = '/app/audit/playwright/findings/agent_logs'
const SA_PATH = '/app/scripts/serviceAccountKey.json'
const LABEL = 'E27'

mkdirSync(EVIDENCE_DIR, { recursive: true })
mkdirSync(AGENT_LOGS_DIR, { recursive: true })

// ---- Admin SDK (read-only) ----
let db
function initAdmin() {
  if (!db) {
    if (!getApps().length) {
      const sa = JSON.parse(readFileSync(SA_PATH, 'utf-8'))
      initializeApp({ credential: cert(sa) })
    }
    db = getFirestore()
  }
  return db
}

// Read the canonical class_progress doc (classId_listId format is created by the app on first session)
// Fallback to orphan doc if canonical doesn't exist yet.
async function readClassProgress() {
  const canonicalSnap = await initAdmin().doc(`users/${UID}/class_progress/${CP_DOC_ID}`).get()
  if (canonicalSnap.exists) return canonicalSnap.data()
  // Fallback to orphan doc
  const orphanSnap = await initAdmin().doc(`users/${UID}/class_progress/${CLASS_ID}`).get()
  if (orphanSnap.exists) return orphanSnap.data()
  return null
}

async function readAllClassProgressDocs() {
  const snap = await initAdmin().collection(`users/${UID}/class_progress`).get()
  return snap.docs.map(d => ({ id: d.id, data: d.data() }))
}

async function readStudyStates() {
  const snap = await initAdmin().collection(`users/${UID}/study_states`).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function readAttempts() {
  const snap = await initAdmin().collection('attempts').where('studentId', '==', UID).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ---- Word lookup ----
const WORD_CACHE = JSON.parse(readFileSync('/app/e2e/audit/B27/word_position_cache.json', 'utf-8'))
const WORD_BY_TEXT = {}
const WORD_BY_POSITION = {}
for (const w of WORD_CACHE) {
  const norm = w.word.trim().toLowerCase()
  WORD_BY_TEXT[norm] = w
  // Also index without parenthetical suffixes e.g. "jilt\r\n(old English)"
  const stripped = norm.split(/\r?\n/)[0].trim()
  if (stripped !== norm) WORD_BY_TEXT[stripped] = w
  WORD_BY_POSITION[w.position] = w
}
function lookupWord(text) {
  if (!text) return null
  const norm = text.trim().toLowerCase()
  return WORD_BY_TEXT[norm] || WORD_BY_TEXT[norm.split(/[\r\n]/)[0].trim()] || null
}

// ---- Expected words model ----
const {
  calculateInterventionLevel, expectedNewWordRange,
  calculateSegment, partitionReviewEligibility, checkPresentedWords
} = await import('/app/e2e/audit/helpers/expectedWords.js')

// ---- ESL transform (esl_strip_articles_mispluralize) ----
function eslTransform(definitionEn) {
  if (!definitionEn) return 'a word with meaning'
  let s = definitionEn
  // Strip leading articles
  s = s.replace(/^(a|an|the)\s+/i, '')
  // Strip mid-sentence articles (simpler: just the first one for authenticity)
  s = s.replace(/\b(a|an)\s+/i, '')
  // Mis-pluralize: if ends in word boundary that looks like a noun, add or drop -s
  // Simple approach: find first noun-looking word and mis-pluralize it
  s = s.replace(/\b(\w{4,})(s)\b/, '$1') // drop -s from plural
      .replace(/\b(\w{4,}[^s])\b/, (m) => m + 's') // add -s to non-plural
  // Limit to reasonable length
  return s.substring(0, 120)
}

// ---- Logging ----
const jsonlPath = join(AGENT_LOGS_DIR, `${LABEL}.jsonl`)
function logEvent(event) {
  const line = JSON.stringify({ ts: new Date().toISOString(), label: LABEL, ...event }) + '\n'
  try {
    appendFileSync(jsonlPath, line)
  } catch (e) { console.error('log error:', e.message) }
}

function writeStatus(status) {
  const statusPath = join(AGENT_LOGS_DIR, `${LABEL}.status.json`)
  writeFileSync(statusPath, JSON.stringify({ label: LABEL, updatedAt: new Date().toISOString(), ...status }, null, 2))
}

// ---- Date utilities ----
function nextStudyDate(d) {
  const next = new Date(d.getTime() + 24 * 60 * 60 * 1000)
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1)
  }
  return next
}

// ---- Browser helpers ----
async function loginAndLoadDashboard(page) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(2000)
  // Navigate to login
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
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
    const btn = page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first()
    if (await btn.count()) await btn.click()
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  })
  // Wait for dashboard to render
  await page.waitForTimeout(3000)
  return true
}

async function getDashboardDay(page) {
  const bodyText = await page.locator('body').textContent().catch(() => '')
  const match = bodyText.match(/Day\s+(\d+)\s*(?:Start Session|Complete|Continue)/i)
  return match ? parseInt(match[1]) : null
}

async function startSession(page) {
  const continueBtn = page.getByRole('button', { name: /continue session/i }).first()
  if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await continueBtn.click()
    await page.waitForTimeout(3000)
    return { resumed: true }
  }
  const startBtns = page.getByRole('button', { name: 'Start Session' })
  const count = await startBtns.count()
  if (count === 0) return { error: 'No Start Session button' }
  await startBtns.first().click()
  await page.waitForTimeout(3000)
  return { resumed: false }
}

async function dismissFlashcardModal(page) {
  const btn = page.getByRole('button', { name: /start studying/i }).first()
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btn.click()
    await page.waitForTimeout(500)
    return true
  }
  return false
}

async function skipToTest(page) {
  const menuBtn = page.locator('[aria-label="Session menu"]')
  if (!await menuBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    return { error: 'Session menu not found' }
  }
  await menuBtn.click()
  await page.waitForTimeout(500)
  const skipText = page.getByText('Skip to Test').first()
  if (!await skipText.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.keyboard.press('Escape')
    return { error: 'Skip to Test not in menu' }
  }
  await skipText.click()
  await page.waitForTimeout(800)
  const startTestBtn = page.getByRole('button', { name: /start test/i }).first()
  if (await startTestBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await startTestBtn.click()
    await page.waitForTimeout(3000)
  }
  return { ok: true }
}

// ESL typed test: char-by-char, using ESL-transformed definition
async function completeTypedTest(page) {
  const typedInputs = page.locator('input[placeholder="Type your definition..."]')
  const inputCount = await typedInputs.count()
  if (inputCount === 0) {
    return { error: 'no typed inputs', presentedWords: [], questionCount: 0, score: null }
  }

  // Get word text for each input
  const items = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[placeholder="Type your definition..."]')
    return Array.from(inputs).map(inp => {
      const container = inp.closest('div.rounded-xl') || inp.parentElement?.parentElement
      const wordSpan = container?.querySelector('span.font-medium')
      return { word: wordSpan ? wordSpan.textContent.trim() : '' }
    })
  })

  const presentedWords = []
  const eslFairnessNotes = []

  for (let i = 0; i < inputCount; i++) {
    const wordEntry = lookupWord(items[i]?.word)
    presentedWords.push({ word: items[i]?.word || '', position: wordEntry?.position ?? -1 })

    // Apply ESL transform
    const canonicalDef = wordEntry?.definition_en || 'a word with specific meaning'
    const eslDef = eslTransform(canonicalDef)

    await typedInputs.nth(i).click()
    // Type char-by-char (ESL persona: ~80ms between chars, but faster for run budget)
    for (const char of eslDef) {
      await typedInputs.nth(i).type(char, { delay: 4 })
    }
  }

  // Submit
  const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
  if (!await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    return { error: 'Submit button not found', presentedWords, questionCount: inputCount, score: null }
  }
  await submitBtn.click()

  // Wait for AI grading (up to 90s for ESL — grader may be slower on imperfect English)
  let score = null
  let gradingDone = false
  for (let t = 0; t < 18; t++) {
    await page.waitForTimeout(5000)
    const body = await page.locator('body').textContent().catch(() => '')
    if (body.includes('Completed Day') || body.includes('%') || body.includes('of 30 correct') || body.includes('Your Answer')) {
      const m = body.match(/(\d+)%/)
      const m2 = body.match(/(\d+) of (\d+) correct/)
      if (m) score = parseInt(m[1])
      else if (m2) score = Math.round(parseInt(m2[1]) / parseInt(m2[2]) * 100)
      gradingDone = true
      break
    }
    if (body.includes('Failed to save') || body.includes('Try Again')) {
      const tryBtn = page.getByRole('button', { name: /try again/i }).first()
      if (await tryBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tryBtn.click()
        await page.waitForTimeout(15000)
      }
    }
  }

  // Capture grader results for ESL fairness assessment
  const bodyAfter = await page.locator('body').textContent().catch(() => '')
  // Look for any indication of grader rejections on ESL answers
  const rejectedPattern = (bodyAfter.match(/incorrect|wrong|rejected/gi) || []).length
  const acceptedPattern = (bodyAfter.match(/correct|accepted/gi) || []).length

  return {
    presentedWords,
    questionCount: inputCount,
    score,
    gradingDone,
    eslFairnessNote: score !== null ? `ESL transform score: ${score}% (rejected signals: ${rejectedPattern}, accepted signals: ${acceptedPattern})` : 'grading incomplete'
  }
}

// MCQ review test - click correct answer
async function completeMCQTest(page) {
  const presentedWords = []
  let answeredCount = 0
  const masteredInReviewViolations = []

  for (let q = 0; q < 60; q++) {
    const bodyText = await page.locator('body').textContent().catch(() => '')
    if (!bodyText.includes('Review Test') && !bodyText.includes('MCQ Test')) break

    // Get current word
    const pageTitle = await page.locator('[class*="text-2xl"], [class*="text-xl"], h1, h2').first().textContent().catch(() => '')
    const wordTitleMatch = pageTitle.match(/^(.+?)\s*\(([^)]+)\)/)
    const testedWord = (wordTitleMatch ? wordTitleMatch[1].trim() : pageTitle.trim()).split('\n')[0].trim()

    const wordEntry = testedWord ? lookupWord(testedWord) : null
    if (wordEntry) {
      presentedWords.push({ word: testedWord, position: wordEntry.position })
    } else if (testedWord && testedWord.length > 0 && !testedWord.includes('Review Test') && !testedWord.includes('Step')) {
      presentedWords.push({ word: testedWord, position: -1, notFound: true })
    }

    // Get option buttons
    const optionBtns = page.locator('button.min-h-\\[80px\\], button[class*="rounded-2xl"]')
    const optionCount = await optionBtns.count()

    if (optionCount === 0) {
      // Check for submit button
      const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click()
        await page.waitForTimeout(5000)
      }
      break
    }

    // Click correct option
    let clicked = false
    if (wordEntry?.definition_en) {
      const optionTexts = []
      for (let i = 0; i < optionCount; i++) {
        const t = await optionBtns.nth(i).textContent().catch(() => '')
        optionTexts.push(t.trim())
      }
      const defStart = wordEntry.definition_en.toLowerCase().substring(0, 20)
      for (let i = 0; i < optionCount; i++) {
        if (optionTexts[i].toLowerCase().includes(defStart)) {
          await optionBtns.nth(i).click()
          clicked = true
          break
        }
      }
    }
    if (!clicked) await optionBtns.first().click()

    answeredCount++
    await page.waitForTimeout(300)

    // Check Next button
    const nextBtn = page.getByRole('button', { name: /^next$/i }).first()
    if (await nextBtn.isVisible({ timeout: 800 }).catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(300)
    }

    // Check if all answered
    const afterBody = await page.locator('body').textContent().catch(() => '')
    const m = afterBody.match(/(\d+) of (\d+) answered/)
    if (m && parseInt(m[1]) >= parseInt(m[2])) {
      const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click()
        await page.waitForTimeout(5000)
        break
      }
    }
  }

  await page.waitForTimeout(2000)
  const finalBody = await page.locator('body').textContent().catch(() => '')
  const m1 = finalBody.match(/(\d+)%/)
  const m2 = finalBody.match(/(\d+) of (\d+) correct/)
  const score = m1 ? parseInt(m1[1]) : (m2 ? Math.round(parseInt(m2[1]) / parseInt(m2[2]) * 100) : null)

  return { presentedWords, questionCount: answeredCount, score, masteredInReviewViolations }
}

// ---- Logout/login mid-session scenario ----
async function runLogoutLoginScenario(browser, sessionDate, dayNumber) {
  console.log('\n=== LOGOUT/LOGIN MID-SESSION SCENARIO ===')
  const result = {
    scenario: 'logout_login_mid_session',
    day: dayNumber,
    sessionDate: sessionDate.toISOString(),
    steps: [],
    workPreserved: null,
    severity: null,
    notes: []
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript((isoDate) => {
    const origNow = Date.now.bind(Date)
    const offset = new Date(isoDate).getTime() - origNow()
    window.__VOCABOOST_TIME_OFFSET__ = 0
    Date.now = () => origNow() + window.__VOCABOOST_TIME_OFFSET__ + offset
    window.__advanceTime = (ms) => { window.__VOCABOOST_TIME_OFFSET__ += ms }
  }, sessionDate.toISOString())
  await context.addInitScript(() => {
    if (navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
  })

  const page = await context.newPage()

  try {
    // Login and start session
    await loginAndLoadDashboard(page)
    result.steps.push('login_ok')

    const sessionStart = await startSession(page)
    if (sessionStart.error) {
      result.steps.push('session_start_failed: ' + sessionStart.error)
      result.notes.push('Could not start session for logout/login test')
      return result
    }
    result.steps.push('session_started')

    await dismissFlashcardModal(page)
    const skipResult = await skipToTest(page)
    if (skipResult.error) {
      result.steps.push('skip_failed: ' + skipResult.error)
    } else {
      result.steps.push('skipped_to_typed_test')
    }

    // Check we're on typed test
    const typedInputs = page.locator('input[placeholder="Type your definition..."]')
    const inputCount = await typedInputs.count()
    result.steps.push(`typed_inputs_visible: ${inputCount}`)

    if (inputCount > 0) {
      // Answer a few questions (5 out of 30)
      const answerCount = Math.min(5, inputCount)
      const items = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[placeholder="Type your definition..."]')
        return Array.from(inputs).slice(0, 5).map(inp => {
          const container = inp.closest('div.rounded-xl') || inp.parentElement?.parentElement
          const wordSpan = container?.querySelector('span.font-medium')
          return { word: wordSpan ? wordSpan.textContent.trim() : '' }
        })
      })

      for (let i = 0; i < answerCount; i++) {
        const wordEntry = lookupWord(items[i]?.word)
        const def = wordEntry ? eslTransform(wordEntry.definition_en) : 'a specific meaning'
        await typedInputs.nth(i).click()
        for (const char of def.substring(0, 20)) { // Short answers to save time
          await typedInputs.nth(i).type(char, { delay: 3 })
        }
      }
      result.steps.push(`answered_${answerCount}_questions`)

      // Capture localStorage before logout
      const localStorageBefore = await page.evaluate(() => {
        const items = {}
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && (key.includes('session') || key.includes('recovery') || key.includes('attempt') || key.includes('vocaboost'))) {
            items[key] = localStorage.getItem(key)
          }
        }
        return items
      })
      result.localStorageBefore = Object.keys(localStorageBefore)
      result.steps.push(`localStorage_keys_before: ${Object.keys(localStorageBefore).join(', ')}`)

      // LOGOUT via app (clears IndexedDB auth)
      // Find logout button in nav/menu
      const logoutBtn = page.getByRole('button', { name: /sign out|log out|logout/i }).first()
      const profileMenu = page.locator('[aria-label*="profile" i], [aria-label*="user" i], [aria-label*="account" i]').first()

      let loggedOut = false

      // Try profile menu first
      if (await profileMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
        await profileMenu.click()
        await page.waitForTimeout(500)
        const signOutInMenu = page.getByText(/sign out|log out/i).first()
        if (await signOutInMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
          await signOutInMenu.click()
          loggedOut = true
        }
      }

      // Try direct logout button
      if (!loggedOut && await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoutBtn.click()
        loggedOut = true
      }

      // If no UI logout, use Firebase SDK
      if (!loggedOut) {
        await page.evaluate(async () => {
          try {
            const { getAuth, signOut } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js')
            // Try window.__firebase_auth
            if (window.__firebase_auth) await signOut(window.__firebase_auth)
          } catch (e) { console.log('Firebase logout failed:', e.message) }
          // Clear IndexedDB auth
          const dbs = await indexedDB.databases?.() || []
          for (const db of dbs) {
            if (db.name?.includes('firebaseLocalStorage')) {
              indexedDB.deleteDatabase(db.name)
            }
          }
        })
        result.steps.push('forced_firebase_signout')
      }

      await page.waitForTimeout(2000)

      // Capture localStorage after logout (before re-login)
      const localStorageAfterLogout = await page.evaluate(() => {
        const items = {}
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && (key.includes('session') || key.includes('recovery') || key.includes('attempt') || key.includes('vocaboost'))) {
            items[key] = localStorage.getItem(key)
          }
        }
        return items
      })
      result.localStorageAfterLogout = Object.keys(localStorageAfterLogout)
      result.steps.push(`localStorage_after_logout: ${Object.keys(localStorageAfterLogout).join(', ')}`)

      // LOG BACK IN
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
      await page.waitForTimeout(2000)

      // Navigate to login
      const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
      if (await loginLink.count()) await loginLink.click()
      else {
        await page.evaluate(() => {
          history.pushState({}, '', '/login')
          dispatchEvent(new PopStateEvent('popstate'))
        })
      }

      await page.getByLabel(/email/i).first().waitFor({ timeout: 15000 })
      await page.getByLabel(/email/i).first().fill(EMAIL)
      await page.getByLabel(/password/i).first().fill(PASSWORD)
      await page.getByLabel(/password/i).first().press('Enter')
      await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(3000)

      result.steps.push('logged_back_in')

      // Check localStorage after re-login
      const localStorageAfterLogin = await page.evaluate(() => {
        const items = {}
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && (key.includes('session') || key.includes('recovery') || key.includes('attempt') || key.includes('vocaboost'))) {
            items[key] = localStorage.getItem(key)
          }
        }
        return items
      })
      result.localStorageAfterLogin = Object.keys(localStorageAfterLogin)
      result.steps.push(`localStorage_after_relogin: ${Object.keys(localStorageAfterLogin).join(', ')}`)

      // Check for recovery prompt
      const bodyText = await page.locator('body').textContent().catch(() => '')
      const hasRecoveryPrompt = /recover|resume|continue|in.progress|unsaved/i.test(bodyText)
      result.steps.push(`recovery_prompt_visible: ${hasRecoveryPrompt}`)

      // Check dashboard shows same day
      const dashDay = await getDashboardDay(page)
      result.steps.push(`dashboard_day_after_login: ${dashDay}`)

      // Try to start session again — does the app know it was in progress?
      const sessionStart2 = await startSession(page)
      result.steps.push(`session_start_after_relogin: ${JSON.stringify(sessionStart2)}`)

      // Check if we're back to test start (inputs=0 answered) or recovery
      const typedInputsAfter = page.locator('input[placeholder="Type your definition..."]')
      const inputCountAfter = await typedInputsAfter.count()
      result.steps.push(`typed_inputs_after_relogin: ${inputCountAfter}`)

      // Determine work preservation
      if (hasRecoveryPrompt) {
        result.workPreserved = 'recovered'
        result.severity = 'PASS'
        result.notes.push('Recovery prompt shown after logout/re-login — work recovery UI visible')
      } else if (inputCountAfter > 0) {
        // Check if previously answered inputs are pre-filled
        const filledCount = await page.evaluate(() => {
          const inputs = document.querySelectorAll('input[placeholder="Type your definition..."]')
          return Array.from(inputs).filter(inp => inp.value.length > 0).length
        })
        if (filledCount > 0) {
          result.workPreserved = 'partial'
          result.severity = 'MEDIUM'
          result.notes.push(`Some answers preserved in inputs after re-login (${filledCount} filled)`)
        } else {
          result.workPreserved = 'lost'
          result.severity = 'HIGH'
          result.notes.push('Typed answers LOST after logout/login — inputs empty, no recovery prompt')
        }
      } else {
        result.workPreserved = 'lost_clean'
        result.severity = 'HIGH'
        result.notes.push('In-progress test state LOST after logout/login — started from scratch, no recovery prompt')
      }
    } else {
      result.steps.push('could_not_reach_typed_test_for_logout_scenario')
      result.workPreserved = 'unknown'
      result.severity = 'INFO'
    }

    // Screenshot
    await page.screenshot({ path: join(EVIDENCE_DIR, 'logout_login_scenario.png'), fullPage: false })
    result.steps.push('screenshot_saved')

  } catch (err) {
    result.steps.push('error: ' + err.message)
    result.notes.push('Error during logout/login scenario: ' + err.message)
    result.workPreserved = 'error'
    result.severity = 'INFO'
  } finally {
    await page.close().catch(() => {})
    await context.close().catch(() => {})
  }

  return result
}

// ---- Run one full session ----
async function runOneSession(browser, sessionDate, dayNumber) {
  const result = {
    dayNumber,
    sessionDate: sessionDate.toISOString(),
    newTest: { presentedWords: [], score: null, questionCount: 0 },
    reviewTest: null,
    postCSD: null,
    h2StaleStep5: false,
    eslFairnessNote: null,
    errors: [],
    blocked: false,
    blockedReason: null,
    steps: []
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })

  await context.addInitScript((isoDate) => {
    const origNow = Date.now.bind(Date)
    const offset = new Date(isoDate).getTime() - origNow()
    window.__VOCABOOST_TIME_OFFSET__ = 0
    Date.now = () => origNow() + window.__VOCABOOST_TIME_OFFSET__ + offset
    window.__advanceTime = (ms) => { window.__VOCABOOST_TIME_OFFSET__ += ms }
  }, sessionDate.toISOString())

  await context.addInitScript(() => {
    if (navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
  })

  const page = await context.newPage()
  const consoleMsgs = []
  page.on('console', msg => { if (msg.type() === 'error') consoleMsgs.push(msg.text()) })

  try {
    await loginAndLoadDashboard(page)
    result.steps.push('login_ok')

    const dashDay = await getDashboardDay(page)
    result.steps.push(`dashboard_day_${dashDay}`)

    // H2 guard: check if dashboard shows the right day before starting
    if (dashDay !== null && dashDay < dayNumber) {
      result.steps.push(`h2_potential: dashboard_shows_day_${dashDay}_expected_${dayNumber}`)
    }

    const sessionStart = await startSession(page)
    if (sessionStart.error) {
      result.blocked = true
      result.blockedReason = sessionStart.error
      return result
    }
    result.steps.push(sessionStart.resumed ? 'session_resumed' : 'session_started')

    await dismissFlashcardModal(page)

    // H2 guard: detect stale Step 5 before proceeding
    const bodyText0 = await page.locator('body').textContent().catch(() => '')
    const stepMatch0 = bodyText0.match(/Step (\d+) of (\d+)/)
    const currentStep0 = stepMatch0 ? parseInt(stepMatch0[1]) : 0

    if (currentStep0 === 5 || bodyText0.includes('Session Summary') || bodyText0.includes('Back to Dashboard')) {
      result.h2StaleStep5 = true
      result.steps.push('h2_stale_step5_detected')
      // Navigate back to dashboard and re-enter
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(3000)
      const sessionStart2 = await startSession(page)
      if (sessionStart2.error) {
        result.blocked = true
        result.blockedReason = 'H2: stale Step 5 and re-entry failed: ' + sessionStart2.error
        return result
      }
      result.steps.push('h2_re_entered_session')
      await dismissFlashcardModal(page)
    }

    // Get current step
    const bodyText1 = await page.locator('body').textContent().catch(() => '')
    const stepMatch1 = bodyText1.match(/Step (\d+) of (\d+)/)
    const currentStep = stepMatch1 ? parseInt(stepMatch1[1]) : 1
    result.steps.push(`at_step_${currentStep}`)

    if (currentStep <= 2) {
      // Step 1 or 2: new words
      if (currentStep === 1) {
        const skipResult = await skipToTest(page)
        result.steps.push(skipResult.ok ? 'skip_to_typed_test_ok' : 'skip_failed:' + skipResult.error)
      }

      const typedResult = await completeTypedTest(page)
      result.newTest = typedResult
      result.eslFairnessNote = typedResult.eslFairnessNote
      result.steps.push(`typed_done_score_${typedResult.score}`)
      if (typedResult.error) result.errors.push(typedResult.error)

      // Advance past typed test results
      await page.waitForTimeout(2000)
      let bodyText2 = await page.locator('body').textContent().catch(() => '')
      let step2Match = bodyText2.match(/Step (\d+) of (\d+)/)
      let afterStep = step2Match ? parseInt(step2Match[1]) : null

      if (afterStep === 2 || (afterStep === null && bodyText2.includes('Completed Day'))) {
        const continueBtn = page.getByRole('button', { name: /^continue$/i }).first()
        if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await continueBtn.click()
          result.steps.push('clicked_continue_after_typed')
          await page.waitForTimeout(3000)
          bodyText2 = await page.locator('body').textContent().catch(() => '')
          step2Match = bodyText2.match(/Step (\d+) of (\d+)/)
          afterStep = step2Match ? parseInt(step2Match[1]) : null
        }
      }

      result.steps.push(`after_typed_step_${afterStep}`)

      if (afterStep === 3 || bodyText2.includes('Review Study')) {
        await dismissFlashcardModal(page)
        const skipResult2 = await skipToTest(page)
        result.steps.push(skipResult2.ok ? 'skip_to_review_ok' : 'review_skip_failed:' + skipResult2.error)
        const reviewResult = await completeMCQTest(page)
        result.reviewTest = reviewResult
        result.steps.push(`review_done_score_${reviewResult.score}`)
        await page.waitForTimeout(2000)
      } else if (afterStep === 4 || bodyText2.includes('Review Test')) {
        const reviewResult = await completeMCQTest(page)
        result.reviewTest = reviewResult
        result.steps.push(`review_done_score_${reviewResult.score}`)
        await page.waitForTimeout(2000)
      }
    } else if (currentStep === 3) {
      await dismissFlashcardModal(page)
      const skipResult = await skipToTest(page)
      result.steps.push(skipResult.ok ? 'skip_to_review_ok' : 'review_skip_failed')
      const reviewResult = await completeMCQTest(page)
      result.reviewTest = reviewResult
      result.steps.push(`review_done_score_${reviewResult.score}`)
      await page.waitForTimeout(2000)
    } else if (currentStep === 4) {
      const reviewResult = await completeMCQTest(page)
      result.reviewTest = reviewResult
      result.steps.push(`review_done_score_${reviewResult.score}`)
      await page.waitForTimeout(2000)
    } else if (currentStep === 5) {
      result.h2StaleStep5 = true
      result.steps.push('h2_at_step5_again_marking_blocked')
      result.blocked = true
      result.blockedReason = 'H2: still at Step 5 after re-entry'
      return result
    }

    // Handle completion / advance to next day
    const bodyText5 = await page.locator('body').textContent().catch(() => '')
    const step5Match = bodyText5.match(/Step (\d+) of (\d+)/)
    const isStep5 = step5Match ? parseInt(step5Match[1]) === 5 : false

    if (isStep5 || bodyText5.includes('Session Summary') || bodyText5.includes('Back to Dashboard') || bodyText5.includes('Move On')) {
      result.steps.push('at_completion')
      const moveOnBtn = page.getByRole('button', { name: /move on to next day/i }).first()
      const backBtn = page.getByRole('button', { name: /back to dashboard/i }).first()
      if (await moveOnBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await moveOnBtn.click()
        result.steps.push('moved_to_next_day')
      } else if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await backBtn.click()
        result.steps.push('back_to_dashboard')
      }
      await page.waitForTimeout(2000)
    }

    if (consoleMsgs.length > 0) result.errors.push(...consoleMsgs.slice(0, 5))

  } catch (err) {
    result.blocked = true
    result.blockedReason = err.message
    result.errors.push(err.message)
    console.error(`Session Day ${dayNumber} error:`, err.message)
    logEvent({ type: 'session_error', day: dayNumber, error: err.message })
  } finally {
    const screenshotPath = join(EVIDENCE_DIR, `day_${String(dayNumber).padStart(2, '0')}_end.png`)
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {})
    await page.close().catch(() => {})
    await context.close().catch(() => {})
  }

  return result
}

// ---- Main ----
async function main() {
  logEvent({ type: 'audit_start', persona: 'esl', class: 'TOP', batch: 'B27', label: LABEL, startedAt: new Date().toISOString() })
  writeStatus({ status: 'running', phase: 'init' })

  // Read initial state
  const initialCPDocs = await readAllClassProgressDocs()
  console.log(`=== B27 esl/TOP audit (${LABEL}) ===`)
  console.log(`class_progress docs at start: ${initialCPDocs.map(d => d.id).join(', ')}`)

  const orphanBefore = initialCPDocs.filter(d => !d.id.includes('_'))
  console.log(`Orphan docs at start: ${orphanBefore.length} (${orphanBefore.map(d => d.id).join(', ')})`)

  // The ESL user has the classId-only orphan doc with CSD=6, TWI=undefined
  // The real run will start from where the app picks up — likely Day 6
  // We read the effective starting state
  const initialCP = await readClassProgress()
  const initialCSD = initialCP?.currentStudyDay ?? 1
  const initialTWI = initialCP?.totalWordsIntroduced ?? 0
  console.log(`Initial CSD: ${initialCSD}, TWI: ${initialTWI}`)

  // Starting day: current CSD + 1 (app will show this day)
  // But the orphan has CSD=6, so next day = 6 (if CSD means "last completed" = 5)
  // Actually CSD=6 means Day 6 is next to be completed
  const startingDay = initialCSD  // app will show Day 6
  const TARGET_SESSIONS = 20

  // Anchor: June 9, 2026 (Monday) — same anchor as canary to align with weekday calendar
  let currentDate = new Date('2026-06-09T09:00:00+09:00')

  console.log(`Starting from Day ${startingDay}, date ${currentDate.toISOString()}`)

  const dayTable = []
  const findingsList = []
  const allSessionResults = []
  let h2Count = 0
  let stopConditionHit = false
  let stopReason = null
  let masteredInReviewDays = []
  let logoutLoginResult = null
  const eslFairnessNotes = []

  const CHROMIUM_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    for (let sessionIdx = 0; sessionIdx < TARGET_SESSIONS && !stopConditionHit; sessionIdx++) {
      const dayNumber = startingDay + sessionIdx

      // Skip weekends
      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      }

      console.log(`\n=== Day ${dayNumber} | ${currentDate.toISOString().split('T')[0]} ===`)
      logEvent({ type: 'session_start', day: dayNumber, date: currentDate.toISOString() })
      writeStatus({ status: 'running', phase: `day_${dayNumber}`, sessionsComplete: sessionIdx })

      // Run logout/login scenario on Day 8 (mid-walk, will have some MASTERED words)
      if (dayNumber === startingDay + 2 && logoutLoginResult === null) {
        logoutLoginResult = await runLogoutLoginScenario(browser, currentDate, dayNumber)
        console.log(`Logout/login scenario: workPreserved=${logoutLoginResult.workPreserved}, severity=${logoutLoginResult.severity}`)
        logEvent({ type: 'logout_login_scenario', result: logoutLoginResult })
        writeFileSync(join(EVIDENCE_DIR, 'logout_login_scenario.json'), JSON.stringify(logoutLoginResult, null, 2))
      }

      // Read pre-session Firestore state
      const preCP = await readClassProgress()
      const preCSD = preCP?.currentStudyDay ?? (dayNumber - 1)
      const preTWI = preCP?.totalWordsIntroduced ?? 0
      const preInterventionLevel = preCP?.interventionLevel ?? 0
      const preRecentReviewScores = preCP?.recentReviewScores ?? []

      const preStudyStates = await readStudyStates()
      const statusHistPre = {}
      for (const ss of preStudyStates) {
        statusHistPre[ss.status || 'UNKNOWN'] = (statusHistPre[ss.status || 'UNKNOWN'] || 0) + 1
      }

      // Compute expected ranges
      const expNewRange = expectedNewWordRange(preTWI, DAILY_PACE, preInterventionLevel, LIST_SIZE)
      const expSegment = calculateSegment(dayNumber, STUDY_DAYS_PER_WEEK, preTWI, DAILY_PACE, preInterventionLevel)

      // Compute review eligibility (pre-session)
      let eligibleIds = new Set()
      let retiredIds = new Set()
      const nowMs = currentDate.getTime()
      if (expSegment) {
        const segStates = preStudyStates.map(ss => ({
          position: ss.wordIndex ?? -1,
          status: ss.status,
          returnAtMs: ss.returnAt ? (ss.returnAt._seconds ? ss.returnAt._seconds * 1000 : ss.returnAt) : null
        })).filter(ss => ss.position >= 0)
        const part = partitionReviewEligibility(segStates, expSegment, nowMs)
        eligibleIds = part.eligibleIds
        retiredIds = part.retiredIds
      }

      console.log(`Pre-state: CSD=${preCSD}, TWI=${preTWI}, interventionLevel=${preInterventionLevel}`)
      console.log(`Expected new: ${expNewRange ? `pos [${expNewRange.startIndex},${expNewRange.endIndex}]` : 'null'}`)
      console.log(`Expected segment: ${expSegment ? `pos [${expSegment.startIndex},${expSegment.endIndex}]` : 'null'}`)
      console.log(`Eligible review: ${eligibleIds.size}, Retired (MASTERED): ${retiredIds.size}`)

      // Run session
      const sessionResult = await runOneSession(browser, currentDate, dayNumber)
      allSessionResults.push(sessionResult)

      if (sessionResult.h2StaleStep5) h2Count++
      if (sessionResult.eslFairnessNote) eslFairnessNotes.push(`Day ${dayNumber}: ${sessionResult.eslFairnessNote}`)

      // Wait for Firestore to settle
      await new Promise(r => setTimeout(r, 3000))

      // Read post-session state
      const postCP = await readClassProgress()
      const postCSD = postCP?.currentStudyDay ?? preCSD
      const postTWI = postCP?.totalWordsIntroduced ?? preTWI

      const postStudyStates = await readStudyStates()
      const statusHistPost = {}
      for (const ss of postStudyStates) {
        statusHistPost[ss.status || 'UNKNOWN'] = (statusHistPost[ss.status || 'UNKNOWN'] || 0) + 1
      }

      const masteredWords = postStudyStates.filter(ss => ss.status === 'MASTERED')
      const masteredCount = masteredWords.length

      // Word correctness checks
      const newPresentedPositions = (sessionResult.newTest?.presentedWords ?? [])
        .map(w => w.position).filter(p => p >= 0)

      const reviewPresentedPositions = (sessionResult.reviewTest?.presentedWords ?? [])
        .map(w => w.position).filter(p => p >= 0)

      // For review check: use POST-test TWI (canary lesson)
      let postExpSegment = expSegment
      let postEligibleIds = eligibleIds
      let postRetiredIds = retiredIds

      if (!sessionResult.blocked && postTWI !== preTWI) {
        // Recompute segment with post-test TWI
        const postInterventionLevel = postCP?.interventionLevel ?? preInterventionLevel
        postExpSegment = calculateSegment(dayNumber, STUDY_DAYS_PER_WEEK, postTWI, DAILY_PACE, postInterventionLevel)
        if (postExpSegment) {
          const postSegStates = postStudyStates.map(ss => ({
            position: ss.wordIndex ?? -1,
            status: ss.status,
            returnAtMs: ss.returnAt ? (ss.returnAt._seconds ? ss.returnAt._seconds * 1000 : ss.returnAt) : null
          })).filter(ss => ss.position >= 0)
          const postPart = partitionReviewEligibility(postSegStates, postExpSegment, nowMs)
          postEligibleIds = postPart.eligibleIds
          postRetiredIds = postPart.retiredIds
        }
      }

      const newViolations = checkPresentedWords({
        phase: 'new',
        presentedPositions: newPresentedPositions,
        expectedRange: expNewRange
      })

      const reviewViolations = postExpSegment ? checkPresentedWords({
        phase: 'review',
        presentedPositions: reviewPresentedPositions,
        expectedRange: postExpSegment,
        eligibleIds: postEligibleIds,
        retiredIds: postRetiredIds
      }) : []

      // F01 check: detect MASTERED words in review (future returnAt)
      const masteredInReview = []
      if (sessionResult.reviewTest?.presentedWords) {
        for (const pw of sessionResult.reviewTest.presentedWords) {
          if (pw.position < 0) continue
          const ss = postStudyStates.find(s => s.wordIndex === pw.position)
          if (ss && ss.status === 'MASTERED') {
            const returnAtMs = ss.returnAt ? (ss.returnAt._seconds ? ss.returnAt._seconds * 1000 : ss.returnAt) : null
            if (returnAtMs && returnAtMs > nowMs) {
              masteredInReview.push({ position: pw.position, word: pw.word, returnAtMs })
            }
          }
        }
      }

      if (masteredInReview.length > 0) {
        masteredInReviewDays.push({ day: dayNumber, count: masteredInReview.length, words: masteredInReview.slice(0, 3) })
        console.log(`F01 CHECK: ${masteredInReview.length} MASTERED word(s) in review on Day ${dayNumber}`)
        logEvent({ type: 'f01_mastered_in_review', day: dayNumber, count: masteredInReview.length })
      }

      // Stop condition: F01 on >=2 days = fix regressed
      if (masteredInReviewDays.length >= 2) {
        stopConditionHit = true
        stopReason = `F01 REGRESSED: MASTERED words appeared in review on ${masteredInReviewDays.length} days (${masteredInReviewDays.map(d => `Day ${d.day}`).join(', ')})`
        console.log(`STOP: ${stopReason}`)
        logEvent({ type: 'stop_condition_hit', reason: stopReason, masteredInReviewDays })
      }

      const allViolations = [...newViolations, ...reviewViolations]

      // CSD check
      const csdOk = sessionResult.blocked ? null : (postCSD === dayNumber)

      const dayRow = {
        day: dayNumber,
        date: currentDate.toISOString().split('T')[0],
        preCSD, postCSD, csdOk,
        csdDrift: !sessionResult.blocked && postCSD !== dayNumber ? `expected ${dayNumber} got ${postCSD}` : null,
        preTWI, postTWI,
        expNewRange: expNewRange ? `[${expNewRange.startIndex},${expNewRange.endIndex}]` : 'null',
        presentedNewCount: newPresentedPositions.length,
        newMatch: newViolations.length === 0,
        expSegment: postExpSegment ? `[${postExpSegment.startIndex},${postExpSegment.endIndex}]` : 'null',
        eligibleCount: postEligibleIds.size,
        retiredCount: postRetiredIds.size,
        presentedReviewCount: reviewPresentedPositions.length,
        reviewMatch: reviewViolations.length === 0,
        masteredInReviewCount: masteredInReview.length,
        masteredCount,
        newTestScore: sessionResult.newTest?.score,
        reviewTestScore: sessionResult.reviewTest?.score,
        violations: allViolations,
        steps: sessionResult.steps,
        blocked: sessionResult.blocked,
        blockedReason: sessionResult.blockedReason,
        h2StaleStep5: sessionResult.h2StaleStep5,
        eslFairnessNote: sessionResult.eslFairnessNote,
        errors: sessionResult.errors.slice(0, 3)
      }

      dayTable.push(dayRow)

      if (allViolations.length > 0) {
        console.log(`VIOLATIONS: ${allViolations.join('; ')}`)
        findingsList.push({ day: dayNumber, violations: allViolations })
      }

      console.log(`Post: CSD=${postCSD}(ok:${csdOk}), TWI=${postTWI}, MASTERED=${masteredCount}, masteredInReview=${masteredInReview.length}, newScore=${sessionResult.newTest?.score}, reviewScore=${sessionResult.reviewTest?.score}, violations=${allViolations.length}, blocked=${sessionResult.blocked}, h2=${sessionResult.h2StaleStep5}`)

      // Save evidence JSON
      const evidenceData = {
        dayNumber,
        sessionDate: currentDate.toISOString(),
        preCSD, postCSD, preTWI, postTWI,
        expectedNewRange: expNewRange,
        expectedSegment: postExpSegment,
        eligibleForReview: postEligibleIds.size,
        retiredFromReview: postRetiredIds.size,
        newTest: {
          presentedWords: sessionResult.newTest?.presentedWords ?? [],
          presentedPositions: newPresentedPositions,
          score: sessionResult.newTest?.score,
          questionCount: sessionResult.newTest?.questionCount ?? 0,
          eslFairnessNote: sessionResult.eslFairnessNote
        },
        reviewTest: sessionResult.reviewTest ? {
          presentedWords: sessionResult.reviewTest.presentedWords,
          presentedPositions: reviewPresentedPositions,
          score: sessionResult.reviewTest.score,
          questionCount: sessionResult.reviewTest.questionCount
        } : null,
        f01MasteredInReview: masteredInReview,
        violations: allViolations,
        statusHistogramPre: statusHistPre,
        statusHistogramPost: statusHistPost,
        masteredCount,
        masteredWithReturnAt: masteredWords.filter(m => m.returnAt).length,
        masteredSample: masteredWords.slice(0, 3).map(m => ({
          id: m.id, wordIndex: m.wordIndex, status: m.status,
          returnAtSec: m.returnAt?._seconds ?? m.returnAt
        })),
        steps: sessionResult.steps,
        errors: sessionResult.errors,
        blocked: sessionResult.blocked,
        blockedReason: sessionResult.blockedReason,
        h2StaleStep5: sessionResult.h2StaleStep5,
        capturedAt: new Date().toISOString()
      }

      const evidencePath = join(EVIDENCE_DIR, `day_${String(dayNumber).padStart(2, '0')}.json`)
      writeFileSync(evidencePath, JSON.stringify(evidenceData, null, 2))

      logEvent({
        type: 'session_complete',
        day: dayNumber,
        preCSD, postCSD, preTWI, postTWI,
        masteredCount,
        masteredInReviewCount: masteredInReview.length,
        violations: allViolations.length,
        newScore: sessionResult.newTest?.score,
        reviewScore: sessionResult.reviewTest?.score,
        blocked: sessionResult.blocked,
        h2: sessionResult.h2StaleStep5
      })

      if (stopConditionHit) break

      // Advance to next study day
      currentDate = nextStudyDate(currentDate)
    }

    // ---- Final orphan check ----
    console.log('\n=== Final orphan check ===')
    const finalAllCPDocs = await readAllClassProgressDocs()
    const finalOrphans = finalAllCPDocs.filter(d => !d.id.includes('_'))
    const newOrphansCreated = finalOrphans.filter(d => !orphanBefore.find(x => x.id === d.id))
    console.log(`class_progress docs after: ${finalAllCPDocs.map(d => d.id).join(', ')}`)
    console.log(`Pre-existing orphan docs: ${orphanBefore.length}`)
    console.log(`New orphan docs created by this run: ${newOrphansCreated.length}`)

    // Check attempts
    const finalAttempts = await readAttempts()
    console.log(`Total attempts in Firestore: ${finalAttempts.length}`)
    const seededAttempts = finalAttempts.filter(a => a.id.match(/_day\d+_(typed|mcq)_/))
    const realAttempts = finalAttempts.filter(a => !a.id.match(/_day\d+_(typed|mcq)_/))
    console.log(`Seeded attempts (prior): ${seededAttempts.length}`)
    console.log(`Real UI attempts: ${realAttempts.length}`)

    logEvent({
      type: 'audit_complete',
      sessionsCompleted: allSessionResults.filter(s => !s.blocked).length,
      totalSessions: allSessionResults.length,
      newOrphansCreated: newOrphansCreated.length,
      h2Count,
      masteredInReviewDays: masteredInReviewDays.length,
      stopConditionHit,
      stopReason
    })

    return {
      dayTable,
      findingsList,
      initialCSD,
      startingDay,
      finalCPDocs: finalAllCPDocs.map(d => d.id),
      orphansBefore: orphanBefore.length,
      orphansAfter: finalOrphans.length,
      newOrphansCreated: newOrphansCreated.length,
      sessionsCompleted: allSessionResults.filter(s => !s.blocked).length,
      totalSessions: allSessionResults.length,
      h2Count,
      masteredInReviewDays,
      stopConditionHit,
      stopReason,
      logoutLoginResult,
      eslFairnessNotes,
      realAttempts: realAttempts.length
    }

  } finally {
    await browser.close()
  }
}

const result = await main()

console.log('\n=== AUDIT COMPLETE ===')
console.log(`Starting day: ${result.startingDay}`)
console.log(`Sessions completed: ${result.sessionsCompleted}/${result.totalSessions}`)
console.log(`New orphan docs created: ${result.newOrphansCreated}`)
console.log(`H2 stale-Step-5 count: ${result.h2Count}`)
console.log(`MASTERED-in-review days: ${result.masteredInReviewDays.length}`)
console.log(`Stop condition hit: ${result.stopConditionHit}`)
if (result.stopConditionHit) console.log(`Stop reason: ${result.stopReason}`)
console.log(`Final class_progress docs: ${result.finalCPDocs.join(', ')}`)

console.log('\nDay table:')
for (const row of result.dayTable) {
  console.log(`  Day ${row.day}: CSD ${row.preCSD}→${row.postCSD}(ok:${row.csdOk}), new=[${row.expNewRange}](${row.presentedNewCount} shown, match:${row.newMatch}), review=[${row.expSegment}](${row.presentedReviewCount} shown, match:${row.reviewMatch}), MASTERED=${row.masteredCount}(inReview:${row.masteredInReviewCount}), newScore=${row.newTestScore}, reviewScore=${row.reviewTestScore}, V=${row.violations.length}, blocked=${row.blocked}, h2=${row.h2StaleStep5}`)
}

if (result.findingsList.length > 0) {
  console.log('\nViolations:')
  for (const f of result.findingsList) {
    console.log(`  Day ${f.day}: ${f.violations.join('; ')}`)
  }
}

if (result.logoutLoginResult) {
  console.log('\nLogout/Login scenario:')
  console.log(`  workPreserved: ${result.logoutLoginResult.workPreserved}`)
  console.log(`  severity: ${result.logoutLoginResult.severity}`)
  console.log(`  notes: ${result.logoutLoginResult.notes.join('; ')}`)
}

if (result.eslFairnessNotes.length > 0) {
  console.log('\nESL Grader Fairness Notes:')
  for (const note of result.eslFairnessNotes) console.log(`  ${note}`)
}

// Save summary
const summaryPath = join(EVIDENCE_DIR, 'audit_summary.json')
writeFileSync(summaryPath, JSON.stringify(result, null, 2))
console.log(`\nSummary: ${summaryPath}`)

// Write final status
writeFileSync(join(AGENT_LOGS_DIR, 'E27.status.json'), JSON.stringify({
  label: 'E27',
  status: result.stopConditionHit ? 'stopped' : 'complete',
  updatedAt: new Date().toISOString(),
  sessionsCompleted: result.sessionsCompleted,
  totalSessions: result.totalSessions,
  startDay: result.startingDay,
  endDay: result.startingDay + result.totalSessions - 1,
  stopConditionHit: result.stopConditionHit,
  stopReason: result.stopReason,
  newOrphansCreated: result.newOrphansCreated,
  h2Count: result.h2Count,
  masteredInReviewDays: result.masteredInReviewDays.length,
  logoutLoginSeverity: result.logoutLoginResult?.severity
}, null, 2))
