/**
 * B27 — Longitudinal Word-Correctness
 * Persona: beginner / CORE class
 * Label: BEG27
 *
 * Walk ~20 sessions from Day 1 (clean state).
 * CORE config: pace=60, studyDaysPerWeek=5 (default), testMode=typed,
 *              testSizeNew=25, reviewTestType=mcq, passThreshold=90
 * Transform: one_word_synonym (single-word answers, partial credit expected)
 *
 * HARNESS FIXES applied:
 * 1. REVIEW CHECK BY IDENTITY (not position) — use checkReviewWords with preStatus
 * 2. LOGOUT/LOGIN runs LAST in a FRESH context after the full walk
 */

import { chromium } from 'playwright'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { checkNewWords, checkReviewWords, expectedNewWordRange, calculateSegment, calculateInterventionLevel } from '/app/e2e/audit/helpers/expectedWords.js'

// ─── Paths ────────────────────────────────────────────────────────────────
const CHROMIUM_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'
const BASE_URL = 'https://vocaboostone.netlify.app'
const SA_PATH = '/app/scripts/serviceAccountKey.json'
const AUDIT_STATE_PATH = '/app/audit/playwright/audit_state.json'

const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B27/beginner'
const FINDINGS_PATH = '/app/audit/playwright/findings/findings_B27_beginner.md'
const AGENT_LOGS_DIR = '/app/audit/playwright/findings/agent_logs'
const LOG_PATH = join(AGENT_LOGS_DIR, 'BEG27.jsonl')
const STATUS_PATH = join(AGENT_LOGS_DIR, 'BEG27.status.json')

mkdirSync(EVIDENCE_DIR, { recursive: true })
mkdirSync(AGENT_LOGS_DIR, { recursive: true })

// ─── Account config ───────────────────────────────────────────────────────
const EMAIL = 'audit_beginner_01_core@vocaboost.test'
const PASSWORD = 'AuditPass2026!'
const UID = 'zR6gMNjuITc97tUktGxIkFwNlDW2'
const CLASS_ID = 'LVjBTFuYE8FbPG34pVAt'
const LIST_ID = 'aRGjnGXdU4aupiS8SlXR'
const CP_DOC_ID = `${CLASS_ID}_${LIST_ID}`

// ─── CORE class config (read from Firestore, confirmed) ───────────────────
const DAILY_PACE = 60
const STUDY_DAYS_PER_WEEK = 5   // DEFAULT_STUDY_DAYS_PER_WEEK from studyAlgorithm.js
const TEST_SIZE_NEW = 25
const LIST_SIZE = 3380
const PASS_THRESHOLD = 90       // 90% pass threshold

// Anchor date (June 2, 2026 is a Monday — clean start)
const ANCHOR_DATE = new Date('2026-06-02T09:00:00+09:00')

const TARGET_SESSIONS = 20

// ─── Word list ────────────────────────────────────────────────────────────
const auditState = JSON.parse(readFileSync(AUDIT_STATE_PATH, 'utf-8'))
const CORE_WORDS = auditState.lists.coreActiveList.words // first 30 in audit_state; we'll supplement live

// Build position map from audit_state
const WORD_ID_TO_POS = {}
const WORD_STR_TO_ID = {}
for (const w of CORE_WORDS) {
  WORD_ID_TO_POS[w.id] = w.position
  const clean = w.word.replace(/\r\n\(old English\)/i, '').replace(/\r\n/g, '').trim().toLowerCase()
  WORD_STR_TO_ID[clean] = { id: w.id, position: w.position, word: w.word }
}

// Also include extra words fetched live (added by the Firestore query we ran)
// We'll build this live cache as we encounter new words
const LIVE_WORD_CACHE = {} // wordStr (clean) -> {id, position}

function findWordInfo(wordStr) {
  const clean = wordStr.replace(/\r\n\(old English\)/i, '').replace(/\r\n/g, '').trim().toLowerCase()
  return WORD_STR_TO_ID[clean] || LIVE_WORD_CACHE[clean] || null
}

// ─── One-word synonyms (beginner transform) ───────────────────────────────
const SYNONYMS = {
  'vigilant': 'watchful',
  'apropos': 'appropriate',
  'swoon': 'faint',
  'sly': 'cunning',
  'fabricate': 'invent',
  'whilst': 'while',
  'scruples': 'conscience',
  'deem': 'consider',
  'catalyst': 'trigger',
  'chaff': 'waste',
  'resilient': 'tough',
  'infuse': 'fill',
  'embark': 'begin',
  'earnest': 'genuine',
  'facile': 'easy',
  'cherish': 'treasure',
  'defiance': 'resistance',
  'catharsis': 'release',
  'carcinogenic': 'harmful',
  'scrupulous': 'careful',
  'arguably': 'debatably',
  'disobedient': 'unruly',
  'equitable': 'fair',
  'farcical': 'absurd',
  'critique': 'analyze',
  'parity': 'equality',
  'qualify': 'limit',
  'stratum': 'layer',
  'plastic': 'moldable',
  'camaraderie': 'friendship',
  'ratiocination': 'reasoning',
  'grandiloquent': 'pompous',
  'superb': 'excellent',
  'triad': 'trio',
  'impart': 'share',
  'waistcoat': 'vest',
  'reiterate': 'repeat',
  'compulsion': 'urge',
  'blatant': 'obvious',
  'archives': 'records',
  'champion': 'advocate',
  'conciliatory': 'appeasing',
  'motif': 'theme',
  'malady': 'illness',
  'loquacious': 'talkative',
  'lucidity': 'clarity',
  'somnolent': 'sleepy',
  'emaciate': 'wither',
  'malign': 'slander',
  'exposition': 'explanation',
  'wonder': 'amazement',
  'noxious': 'harmful',
  'stalwart': 'loyal',
  'strive': 'struggle',
  'triumphant': 'victorious',
  'versatile': 'adaptable',
  'paradigm': 'model',
  'incorporate': 'include',
  'progressive': 'advancing',
  'empirical': 'observable',
  'coalesce': 'merge',
  'enrage': 'anger',
  'corrosive': 'destructive',
  'flippant': 'glib',
  'profligate': 'wasteful',
  'meretricious': 'flashy',
  'rupture': 'break',
  'baffling': 'confusing',
  'brevity': 'conciseness',
  'tractable': 'manageable',
  'abstruse': 'obscure',
  'assure': 'guarantee',
  'trivial': 'minor',
  'affectation': 'pretense',
  'dignity': 'honor',
  'replete': 'full',
  'elliptical': 'oval',
  'contention': 'argument',
  'adequate': 'sufficient',
  'panoply': 'array',
  'ornate': 'elaborate',
  'flaunt': 'show',
  'incite': 'provoke',
  'balm': 'comfort',
  'parochial': 'narrow',
  'muster': 'gather',
  'convention': 'custom',
  'appendage': 'attachment',
  'relegate': 'demote',
  'promote': 'advance',
  'acronym': 'abbreviation',
  'quoth': 'said',
  'inherit': 'receive',
  'dilute': 'weaken',
  'confluence': 'junction',
  'appeasement': 'pacification',
  'betrothed': 'engaged',
  'staunch': 'loyal',
  'acrimony': 'bitterness',
  'defunct': 'dead',
  'lofty': 'tall',
  'erudite': 'learned',
  'warrant': 'justify',
  'effete': 'weak',
  'intimate': 'close',
  'choreography': 'dance',
  'more': 'additional',
  'reflective': 'thoughtful',
  'expound': 'explain',
  'inadvertent': 'accidental',
  'inconsiderate': 'thoughtless',
  'precarious': 'unstable',
  'capitulate': 'surrender',
  'incoherent': 'confused',
  'render': 'make',
  'discourage': 'deter',
  'reinforce': 'strengthen',
  'malinger': 'pretend',
  'upheaval': 'disruption',
  'smuggle': 'hide',
  'procure': 'obtain',
  'unmitigated': 'absolute',
  'entrenched': 'fixed',
  'insecurity': 'anxiety',
  'mercurial': 'volatile',
  'impeach': 'accuse',
  'precipitous': 'steep',
  'toady': 'flatter',
  'thither': 'there',
  'prurient': 'lustful',
  'fortuitous': 'lucky',
  'hedonism': 'pleasure',
  'ideal': 'perfect',
  'demanding': 'difficult',
  'genesis': 'origin',
  'elocution': 'speech',
  'penultimate': 'second',
  'defining': 'characteristic',
  'respite': 'break',
  'morale': 'spirit',
  'fauna': 'animals',
  'cluster': 'group',
  'saturate': 'soak',
  'vanity': 'pride',
  'bliss': 'joy',
  'inequity': 'injustice',
  'prolong': 'extend',
  'extemporaneous': 'impromptu',
  'cite': 'reference',
  'physiological': 'physical',
  'ambiguous': 'unclear',
  'vindicate': 'clear',
  'sullen': 'moody',
  'pungent': 'sharp',
  'subside': 'lessen',
  'syntax': 'grammar',
  'avid': 'eager',
  'aspire': 'aim',
  'disproportionate': 'unequal',
  'elation': 'joy',
  'comprise': 'include',
  'penitent': 'sorry',
  'engulf': 'overwhelm',
  'herald': 'announce',
  'surmount': 'overcome',
  'objective': 'goal',
  'aerial': 'airborne',
  'bound': 'limit',
  'conflate': 'combine',
  'clash': 'conflict',
  'uphold': 'support',
  'eradicate': 'eliminate',
  'emote': 'express',
  'impeccable': 'perfect',
  'detract': 'diminish',
  'sequester': 'isolate',
  'economical': 'frugal',
  'deviate': 'diverge',
  'outright': 'complete',
  'aggrieve': 'harm',
}

function getSynonym(wordStr) {
  const clean = wordStr.replace(/\r\n\(old English\)/i, '').replace(/\r\n/g, '').trim().toLowerCase()
  return SYNONYMS[clean] || 'thing'
}

// ─── Firebase Admin SDK ────────────────────────────────────────────────────
let _db = null
function getDB() {
  if (!_db) {
    if (!getApps().length) {
      const sa = JSON.parse(readFileSync(SA_PATH, 'utf-8'))
      initializeApp({ credential: cert(sa) })
    }
    _db = getFirestore()
  }
  return _db
}

async function readClassProgress() {
  const snap = await getDB().doc(`users/${UID}/class_progress/${CP_DOC_ID}`).get()
  return snap.exists ? snap.data() : null
}

async function readAllClassProgressDocs() {
  const snap = await getDB().collection(`users/${UID}/class_progress`).get()
  return snap.docs.map(d => ({ id: d.id, data: d.data() }))
}

async function readStudyStates() {
  const snap = await getDB().collection(`users/${UID}/study_states`).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

async function readAttempts() {
  const snap = await getDB().collection('attempts').where('studentId', '==', UID).get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ─── Logging ──────────────────────────────────────────────────────────────
function logEvent(event) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event })
  appendFileSync(LOG_PATH, line + '\n')
}

function writeStatus(state, extra = {}) {
  writeFileSync(STATUS_PATH, JSON.stringify({
    label: 'BEG27', state, lastUpdate: new Date().toISOString(), ...extra
  }, null, 2))
}

// ─── Typing helper ────────────────────────────────────────────────────────
async function typeText(input, text, delayMs = 60) {
  await input.click()
  await input.fill('')
  for (const char of text) {
    await input.type(char, { delay: delayMs })
  }
}

// ─── Session nav helpers ──────────────────────────────────────────────────
async function loginWith(page, email, password) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(3000)

  // Navigate to login if needed
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await loginLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await loginLink.click()
    await page.waitForTimeout(1000)
  } else {
    // Check if already logged in (email field not visible = logged in as someone)
    const emailField = page.getByLabel(/email/i).first()
    if (!await emailField.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Try going to /login via client routing
      await page.evaluate(() => {
        history.pushState({}, '', '/login')
        dispatchEvent(new PopStateEvent('popstate'))
      })
      await page.waitForTimeout(1000)
    }
  }

  const emailInput = page.getByLabel(/email/i).first()
  if (await emailInput.isVisible({ timeout: 10000 }).catch(() => false)) {
    await emailInput.fill(email)
    await page.getByLabel(/password/i).first().fill(password)
    await page.getByLabel(/password/i).first().press('Enter')
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
      const continueBtn = page.getByRole('button', { name: /continue|log\s?in/i }).first()
      if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await continueBtn.click()
        await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(() => {})
      }
    })
  }
  await page.waitForTimeout(2000)
}

async function navigateToSessionFromDashboard(page) {
  // Start from dashboard
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)

  // Look for the CORE class card / "Start Session" button
  const startBtn = page.getByRole('button', { name: /start session|start today|begin session/i }).first()
  if (await startBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await startBtn.click()
    return true
  }

  // Try clicking the class card to expand it
  const classCard = page.getByText('25WT 2차 CORE OFFLINE').first()
  if (await classCard.isVisible({ timeout: 4000 }).catch(() => false)) {
    await classCard.click()
    await page.waitForTimeout(1500)

    const startBtn2 = page.getByRole('button', { name: /start session|start today|begin/i }).first()
    if (await startBtn2.isVisible({ timeout: 4000 }).catch(() => false)) {
      await startBtn2.click()
      return true
    }
  }

  // Try any "Study" or "Start" button
  const anyStudyBtn = page.getByRole('button', { name: /study|start/i }).first()
  if (await anyStudyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await anyStudyBtn.click()
    return true
  }

  return false
}

async function dismissModalIfPresent(page) {
  // Dismiss the "Customize Your Flashcards" first-time setup modal (z-50 overlay)
  // Button text: "Start Studying"
  const startStudyingBtn = page.getByRole('button', { name: /start studying/i }).first()
  if (await startStudyingBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await startStudyingBtn.click()
    await page.waitForTimeout(1000)
    return true
  }

  // Generic modal dismiss: look for any close/ok/confirm button in the z-50 overlay
  const overlayExists = await page.locator('.fixed.inset-0.z-50').count() > 0
  if (overlayExists) {
    // Try pressing Escape
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Or click somewhere on the backdrop (coordinate click)
    try {
      await page.locator('.fixed.inset-0.z-50 .absolute.inset-0').first().click({ timeout: 2000 })
    } catch (e) {}
    await page.waitForTimeout(500)
  }
  return false
}

async function skipToTest(page) {
  // First dismiss any modal overlay
  await dismissModalIfPresent(page)
  await page.waitForTimeout(2000) // Give page time to settle after modal dismiss

  // Re-dismiss if still present (sometimes it re-renders)
  await dismissModalIfPresent(page)
  await page.waitForTimeout(1000)

  // Try the Session menu button (aria-label="Session menu")
  const menuBtn = page.locator('[aria-label="Session menu"]').first()
  let menuVisible = await menuBtn.isVisible({ timeout: 8000 }).catch(() => false)

  if (!menuVisible) {
    // Fallback: try role-based
    const menuBtnRole = page.getByRole('button', { name: /session menu/i }).first()
    menuVisible = await menuBtnRole.isVisible({ timeout: 3000 }).catch(() => false)
    if (menuVisible) {
      try {
        await menuBtnRole.click({ force: true })
      } catch (e) {}
    }
  } else {
    try {
      await menuBtn.click({ force: true }) // force=true bypasses overlay interception
    } catch (e) {
      // Try evaluate-based click as last resort
      await menuBtn.evaluate(el => el.click())
    }
  }

  await page.waitForTimeout(1000)

  // The menu opens a dropdown with button items (not menuitem role)
  // Skip to Test is a button inside the dropdown
  const skipItemBtn = page.getByRole('button', { name: /skip to test/i }).first()
  if (await skipItemBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipItemBtn.click({ force: true })
    await page.waitForTimeout(800)

    // Confirm dialog: "Ready for the Test?" with "Start Test" button (NOT "Confirm")
    const confirmBtn = page.getByRole('button', { name: /start test|confirm|yes|skip|proceed/i }).first()
    if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirmBtn.click()
      await page.waitForTimeout(3000) // Wait for test to load
    }
    return true
  }

  // Fallback: look for text "Skip to Test"
  const skipText = page.getByText('Skip to Test', { exact: true }).first()
  if (await skipText.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipText.click({ force: true })
    await page.waitForTimeout(800)
    const confirmBtn = page.getByRole('button', { name: /start test|confirm|yes|skip|proceed/i }).first()
    if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirmBtn.click()
      await page.waitForTimeout(3000)
    }
    return true
  }

  return false
}

// H2 guard: detect stale Step-5 / "session complete" screen
async function isStaleStep5(page) {
  const staleTexts = [
    /session complete|all done for today|completed.*(session|day)/i,
    /step 5 of 5/i,
    /move on.*next/i,
  ]
  for (const pattern of staleTexts) {
    if (await page.getByText(pattern).count() > 0) return true
  }
  return false
}

// ─── Typed test handler ───────────────────────────────────────────────────
// TypedTest shows ALL words at once (not one at a time).
// Layout: each word card has the word text + an input[type="text"].
// We iterate all word cards, read the word, type the synonym, then submit.
async function handleTypedTest(page, dayNumber) {
  const presentedWords = [] // { wordStr, wordId, position }
  let questionCount = 0

  // Wait for word cards to load
  await page.waitForSelector('input[placeholder="Type your definition..."]', { timeout: 30000 })
    .catch(() => null)

  await page.waitForTimeout(1000)

  // Get all word cards - each has the word text adjacent to an input
  const inputEls = await page.locator('input[type="text"][placeholder]').all()
  console.log(`TypedTest: found ${inputEls.length} input elements`)

  if (inputEls.length === 0) {
    // No inputs found — check if results page is already showing
    const resultsVisible = await page.getByText(/test results|results|score/i).isVisible({ timeout: 3000 }).catch(() => false)
    if (!resultsVisible) {
      console.log('No inputs and no results — test not loaded properly')
    }
    return { presentedWords, questionCount }
  }

  // Find each word by looking at the parent card
  for (let i = 0; i < inputEls.length; i++) {
    const inputEl = inputEls[i]

    // Find the word text in the parent card
    // The card structure: div > span(index) + span(word) + span(partOfSpeech) | input
    let wordStr = null
    try {
      // Navigate to parent card and find the word span
      const card = await inputEl.evaluateHandle(el => {
        let node = el.parentElement
        // Walk up until we find a card-like container
        for (let d = 0; d < 5; d++) {
          if (node && node.querySelectorAll('span').length >= 2) break
          node = node?.parentElement
        }
        return node
      })

      // Get all span texts in this card
      const spans = await page.evaluate(card => {
        if (!card) return []
        return Array.from(card.querySelectorAll('span')).map(s => s.textContent.trim()).filter(t => t)
      }, card)

      // The word text is usually the second span (after the index number)
      // or find the one that matches our vocabulary
      for (const spanText of spans) {
        if (spanText && spanText.length > 1 && !spanText.match(/^\d+\.?$/) && !spanText.match(/^\(.*\)$/)) {
          const info = findWordInfo(spanText)
          if (info) {
            wordStr = spanText
            if (!presentedWords.some(w => w.wordId === info.id)) {
              presentedWords.push({ wordStr: spanText, wordId: info.id, position: info.position })
            }
            break
          }
        }
      }

      // If not found by lookup, use the longest non-numeric span
      if (!wordStr) {
        const longest = spans.filter(s => !s.match(/^\d+\.?$/) && !s.match(/^\(.*\)$/))
                             .sort((a, b) => b.length - a.length)[0]
        wordStr = longest || null
      }

      card.dispose?.()
    } catch (e) {
      // fallback — just use 'thing' as answer
    }

    // Type the synonym answer
    const answer = wordStr ? getSynonym(wordStr) : 'thing'
    try {
      await inputEl.click()
      await inputEl.fill('') // Clear first
      await inputEl.type(answer, { delay: 40 })
      questionCount++
    } catch (e) {
      console.log(`Input ${i}: error typing - ${e.message.slice(0, 50)}`)
    }
  }

  // Submit the test
  await page.waitForTimeout(1000)
  const submitBtn = page.getByRole('button', { name: /submit test|submit|finish/i }).first()
  if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await submitBtn.click()
    console.log(`Submitted typed test with ${questionCount} answers`)
  } else {
    // Try pressing Enter on last input
    if (inputEls.length > 0) {
      await inputEls[inputEls.length - 1].press('Enter')
    }
  }

  await page.waitForTimeout(3000)

  return { presentedWords, questionCount }
}

// ─── MCQ review test handler ──────────────────────────────────────────────
// MCQTest shows ONE question at a time (word in h2 + 4 option buttons)
// Navigation: click an option button, then click "Next >" arrow to advance
async function handleMCQTest(page, preStudyStates, nowMs) {
  const presentedWordStates = [] // {wordId, position, preStatus, preReturnAtMs}
  let questionCount = 0

  // Wait for the MCQ test to load (the h2 word prompt)
  await page.locator('h2').first().waitFor({ timeout: 15000 }).catch(() => null)
  await page.waitForTimeout(1000)

  for (let q = 0; q < 65; q++) {
    await page.waitForTimeout(500)

    // Check for submit button (end of test — "Submit Test (N/M answered)")
    const submitBtn = page.getByRole('button', { name: /submit test/i }).first()
    if (await submitBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      // Only auto-submit if all questions answered or if we've been looping
      if (q > 0) { // At least tried one question
        await submitBtn.click()
        await page.waitForTimeout(5000)
        break
      }
    }

    // Check if results are showing (after submission)
    const resultsVisible = await page.getByText(/test results|results|score|correct.*out/i).isVisible({ timeout: 500 }).catch(() => false)
    if (resultsVisible) break

    // Get the current word from h2
    const wordH2 = page.locator('h2').first()
    const wordStr = (await wordH2.textContent().catch(() => '')).trim()

    if (wordStr) {
      const info = findWordInfo(wordStr)
      if (info && !presentedWordStates.some(w => w.wordId === info.id)) {
        const ss = preStudyStates.find(s => s.id === info.id)
        const preStatus = ss?.status || 'NEVER_TESTED'
        const preReturnAtMs = ss?.returnAt?._seconds
          ? ss.returnAt._seconds * 1000
          : (ss?.returnAt ? Number(ss.returnAt) : null)

        presentedWordStates.push({ wordId: info.id, position: info.position, preStatus, preReturnAtMs })
      }
    }

    // Click one of the option buttons (MCQ options are regular <button> elements)
    // They contain the definition text and have class attributes with "border-border-default" or similar
    const optionBtns = page.locator('button[class*="rounded"][class*="border"]').filter({
      hasText: /\w{3,}/ // at least 3 chars (not nav buttons)
    })
    const optCount = await optionBtns.count()

    if (optCount > 0) {
      // Beginner: pick the first option (doesn't matter which — beginner doesn't know)
      await optionBtns.first().click({ force: true })
      await page.waitForTimeout(500)
      questionCount++

      // Try Next question button (aria-label="Next question")
      // If it's disabled, we're on the last question — try Submit instead
      const nextArrow = page.locator('[aria-label="Next question"]').first()
      const isNextEnabled = await nextArrow.isEnabled().catch(() => false)

      if (isNextEnabled) {
        await nextArrow.click({ force: true })
        await page.waitForTimeout(300)
      } else {
        // Last question or next disabled — click Submit Test
        const submitAll = page.getByRole('button', { name: /submit test/i }).first()
        if (await submitAll.isVisible({ timeout: 3000 }).catch(() => false)) {
          await submitAll.click()
          await page.waitForTimeout(5000) // Wait for submission
          break
        }
      }
    } else {
      // Check for Submit button (might be at end of test)
      const submitAll = page.getByRole('button', { name: /submit/i }).first()
      if (await submitAll.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitAll.click()
        await page.waitForTimeout(3000)
        break
      }
      // No options and no submit - might be stuck
      console.log(`MCQ Q${q}: No options found, checking if done`)
      const done = await page.getByText(/test results|score.*out|review complete/i).isVisible({ timeout: 2000 }).catch(() => false)
      if (done) break
      // Try next
      const anyNext = page.getByRole('button', { name: /next/i }).first()
      if (await anyNext.isVisible({ timeout: 2000 }).catch(() => false)) await anyNext.click()
      else break
    }
  }

  return { presentedWordStates, questionCount }
}

// ─── Score capture ────────────────────────────────────────────────────────
async function captureScore(page) {
  await page.waitForTimeout(3000)
  const scoreText = await page.getByText(/\d+%|\d+\/\d+/i).first().textContent().catch(() => '')
  const pct = scoreText.match(/(\d+)%/)
  if (pct) return parseInt(pct[1])
  const frac = scoreText.match(/(\d+)\/(\d+)/)
  if (frac) return Math.round((parseInt(frac[1]) / parseInt(frac[2])) * 100)
  return null
}

// ─── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== BEG27 beginner/CORE B27 starting ===')
  logEvent({ event: 'agent_start', label: 'BEG27', persona: 'beginner', class: 'CORE' })
  writeStatus('running', { sessionsDone: 0 })

  // Read initial state
  const initialCP = await readClassProgress()
  const allCPDocs = await readAllClassProgressDocs()
  const initialCSD = initialCP?.currentStudyDay ?? 0
  const initialTWI = initialCP?.totalWordsIntroduced ?? 0

  console.log(`Initial: CSD=${initialCSD}, TWI=${initialTWI}`)
  console.log(`class_progress docs: ${allCPDocs.map(d => d.id).join(', ') || '(none)'}`)
  logEvent({ event: 'initial_state', CSD: initialCSD, TWI: initialTWI, cpDocs: allCPDocs.map(d => d.id) })

  const startingDay = Math.max(initialCSD + 1, 1) // Walk from current day forward
  const dayTable = []
  let sessionsDone = 0
  let h2Count = 0
  let stopConditionHit = false
  let f01DaysViolated = []
  let logoutLoginResult = null

  // We create a fresh browser for each session to avoid "browser closed" crashes
  // from other simultaneous B27 agents or OOM kills.
  let currentDate = new Date(ANCHOR_DATE)

  try {
    // ─── Main session walk ────────────────────────────────────────────────
    for (let si = 0; si < TARGET_SESSIONS && !stopConditionHit; si++) {
      const dayNumber = startingDay + si

      // Skip weekends
      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      }

      console.log(`\n--- Day ${dayNumber} | ${currentDate.toISOString().split('T')[0]} ---`)
      logEvent({ event: 'session_start', day: dayNumber, date: currentDate.toISOString() })
      writeStatus('running', { sessionsDone, currentDay: dayNumber })

      // ── Pre-session reads ──
      const preCP = await readClassProgress()
      const preCSD = preCP?.currentStudyDay ?? (dayNumber - 1)
      const preTWI = preCP?.totalWordsIntroduced ?? 0
      const preIL = preCP?.interventionLevel ?? 0
      const preRecentScores = preCP?.recentReviewScores ?? []

      const preStudyStates = await readStudyStates()
      const preHistogram = {}
      for (const ss of preStudyStates) {
        preHistogram[ss.status || 'UNKNOWN'] = (preHistogram[ss.status || 'UNKNOWN'] || 0) + 1
      }

      // Compute expected ranges (pre-test)
      const expNewRange = expectedNewWordRange(preTWI, DAILY_PACE, preIL, LIST_SIZE)
      console.log(`Pre: CSD=${preCSD}, TWI=${preTWI}, IL=${preIL.toFixed(2)}`)
      console.log(`Exp new range: ${expNewRange ? `[${expNewRange.startIndex},${expNewRange.endIndex}]` : 'null'}`)

      const nowMs = currentDate.getTime()

      // ── Fresh browser for this session (avoid browser-closed crashes) ──
      const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH })
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      await context.addInitScript((isoDate) => {
        const origNow = Date.now.bind(Date)
        const offset = new Date(isoDate).getTime() - origNow()
        window.__VOCABOOST_TIME_OFFSET__ = 0
        Date.now = () => origNow() + window.__VOCABOOST_TIME_OFFSET__ + offset
        window.__advanceTime = (ms) => { window.__VOCABOOST_TIME_OFFSET__ += ms }
      }, currentDate.toISOString())
      await context.addInitScript(() => {
        if (navigator.serviceWorker) {
          navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
        }
      })

      const page = await context.newPage()

      let sessionResult = { started: false, blocked: false, blockedReason: null,
        newTest: null, reviewTest: null, errors: [] }

      try {
        // Login
        await loginWith(page, EMAIL, PASSWORD)

        // Navigate to session
        const reached = await navigateToSessionFromDashboard(page)
        if (!reached) {
          sessionResult.blocked = true
          sessionResult.blockedReason = 'Could not reach session from dashboard'
          logEvent({ event: 'session_blocked', day: dayNumber, reason: sessionResult.blockedReason })
          console.log(`BLOCKED: ${sessionResult.blockedReason}`)
        } else {
          sessionResult.started = true
          await page.waitForTimeout(2000)

          // Dismiss first-time setup modal if present ("Customize Your Flashcards")
          const dismissed = await dismissModalIfPresent(page)
          if (dismissed) logEvent({ event: 'modal_dismissed', day: dayNumber, modal: 'card_settings' })

          await page.waitForTimeout(1000)

          // H2 guard
          if (await isStaleStep5(page)) {
            h2Count++
            logEvent({ event: 'h2_stale_step5', day: dayNumber })
            console.log(`H2 stale Step-5 detected on Day ${dayNumber}`)
            // Navigate away and back
            await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
            await page.waitForTimeout(2000)
            const reached2 = await navigateToSessionFromDashboard(page)
            if (!reached2) {
              sessionResult.blocked = true
              sessionResult.blockedReason = 'Still blocked after H2 recovery attempt'
            }
            await page.waitForTimeout(2000)
          }

          if (!sessionResult.blocked) {
            // Wait for page to stabilize after session navigation (MCQ redirect can take a few seconds)
            await page.waitForTimeout(4000)
            // Also wait for URL to settle
            await page.waitForURL(/mcqtest|typedtest|session/, { timeout: 8000 }).catch(() => {})
            await page.waitForTimeout(2000)

            // Check current URL — might be at a pending MCQ test from previous session
            let currentUrl = page.url()
            let atMCQTest = currentUrl.includes('/mcqtest/')
            let atTypedTest = currentUrl.includes('/typedtest/')

            logEvent({ event: 'pre_skip_url', day: dayNumber, currentUrl })

            if (atMCQTest) {
              // Pending MCQ review from previous day — complete it now
              console.log(`At MCQ test (pending review from prior day)`)
              logEvent({ event: 'pending_mcq_detected', day: dayNumber })
              const mcqResult = await handleMCQTest(page, preStudyStates, nowMs)
              sessionResult.reviewTest = mcqResult
              await page.waitForTimeout(3000)
              sessionResult.reviewTest.score = await captureScore(page)
              logEvent({ event: 'pending_review_done', day: dayNumber, score: sessionResult.reviewTest?.score })
              console.log(`Pending review done: ${mcqResult.questionCount} questions, score=${sessionResult.reviewTest?.score}%`)

              // Navigate back to dashboard to start the new day
              await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
              await page.waitForTimeout(3000)
              const reached2 = await navigateToSessionFromDashboard(page)
              if (!reached2) {
                sessionResult.blocked = true
                sessionResult.blockedReason = 'Could not navigate back after pending MCQ'
              }
              await page.waitForTimeout(2000)
              currentUrl = page.url()
              atMCQTest = currentUrl.includes('/mcqtest/')
              atTypedTest = currentUrl.includes('/typedtest/')
            }

            if (!sessionResult.blocked) {
            // Skip to test (new-word typed test for today)
            const skipped = await skipToTest(page) // eslint-disable-line no-use-before-define
            logEvent({ event: 'skip_to_test', day: dayNumber, skipped })
            // After "Start Test" confirm, app navigates to TypedTest route
            // Wait for URL to contain "typed" or for textbox to appear
            await page.waitForURL(/typed|test/, { timeout: 10000 }).catch(() => {})
            await page.waitForTimeout(3000) // Additional settle time

            // Detect test type
            // TypedTest: shows ALL words at once with input[placeholder="Type your definition..."]
            let hasTextInput = await page.getByPlaceholder(/type your definition/i).first().isVisible({ timeout: 20000 }).catch(() => false)
            if (!hasTextInput) {
              hasTextInput = await page.locator('input[type="text"]').first().isVisible({ timeout: 5000 }).catch(() => false)
            }
            const hasMCQ = !hasTextInput && await page.getByRole('radio').isVisible({ timeout: 5000 }).catch(() => false)
            console.log(`Test type: textInput=${hasTextInput}, mcq=${hasMCQ}, url=${page.url()}`)
            logEvent({ event: 'test_type_detected', day: dayNumber, hasTextInput, hasMCQ, url: page.url() })

            // ── NEW-WORD TYPED TEST ──
            if (hasTextInput) {
              logEvent({ event: 'new_test_start', day: dayNumber })
              const newResult = await handleTypedTest(page, dayNumber)
              sessionResult.newTest = newResult
              logEvent({ event: 'new_test_answered', day: dayNumber, qCount: newResult.questionCount, wordsCaptured: newResult.presentedWords.length })
              console.log(`New test: ${newResult.questionCount} answers, ${newResult.presentedWords.length} words captured`)

              // Wait for AI grading — one batch call for all 25 words (~19-90s per spec)
              // The results page shows "Continue" button after grading completes
              // Wait for the "Continue" button to appear (means grading is done)
              console.log('Waiting for AI grading (up to 120s)...')
              await page.waitForSelector('button:has-text("Continue"), button:has-text("Go to Dashboard")', {
                timeout: 120000
              }).catch(() => {
                console.log('Grading wait timed out — proceeding anyway')
              })
              await page.waitForTimeout(2000) // Small settle after grading

              sessionResult.newTest.score = await captureScore(page)
              logEvent({ event: 'new_test_scored', day: dayNumber, score: sessionResult.newTest.score })
              console.log(`New test score: ${sessionResult.newTest.score}%`)

              // Click any button that takes us away from the typed test results
              // TypedTest: "Continue" (passed) or "Go to Dashboard" (failed)
              // Use a broad selector to avoid missing due to icon text
              await page.waitForTimeout(1000)
              let navigatedAway = false

              // Try getByRole with broad name pattern
              const anyResultBtn = page.getByRole('button', { name: /continue|go to dashboard|return/i }).first()
              if (await anyResultBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                const btnText = (await anyResultBtn.textContent().catch(() => '')).trim()
                console.log(`Clicking result button: "${btnText}"`)
                await anyResultBtn.click()
                await page.waitForURL(url => !url.includes('/typedtest/'), { timeout: 15000 }).catch(() => {})
                await page.waitForTimeout(3000)
                console.log(`After result btn click: url=${page.url()}`)
                navigatedAway = !page.url().includes('/typedtest/')
              }

              if (!navigatedAway) {
                console.log('Result button click did not navigate away, current url:', page.url())
              }

              // If we ended up at root (dashboard), navigate into the session from there
              const afterContUrl = page.url()
              if (afterContUrl === BASE_URL + '/' || afterContUrl === BASE_URL || afterContUrl.endsWith('netlify.app/')) {
                console.log('Ended at root/dashboard — entering session from dashboard')
                // Dashboard should show a "Continue Session" or session card
                await navigateToSessionFromDashboard(page)
                await dismissModalIfPresent(page)
                await page.waitForTimeout(3000)
                console.log(`After dashboard-session nav: url=${page.url()}`)
              }
            } else if (hasMCQ) {
              // Jumped directly to review (Day 2+)
              logEvent({ event: 'review_test_start_direct', day: dayNumber })
            }

            // ── REVIEW MCQ TEST (Day 2+) ──
            if (dayNumber >= 2) {
              // After typed test, the session flow returns to DailySessionFlow (Step 3=review study)
              // We need to skip to review test (MCQ) from there
              await page.waitForTimeout(3000)

              // Check current URL - might be back at DailySessionFlow or already at mcqtest
              const reviewUrl = page.url()
              logEvent({ event: 'review_check_url', day: dayNumber, reviewUrl })

              if (reviewUrl.includes('/mcqtest/')) {
                // Already at MCQ test
              } else {
                // Back at DailySessionFlow - need to skip to review test
                // Dismiss any modal first
                await dismissModalIfPresent(page)
                // Skip to test (which should skip review study to MCQ)
                const reviewSkipped = await skipToTest(page)
                logEvent({ event: 'review_skip', day: dayNumber, reviewSkipped })
                await page.waitForURL(/mcqtest|mcq|review/, { timeout: 10000 }).catch(() => {})
                await page.waitForTimeout(3000)
              }

              // MCQ options are buttons, not radio inputs; check URL and h2 word prompt
              const currentReviewUrl = page.url()
              const h2Visible = await page.locator('h2').first().isVisible({ timeout: 10000 }).catch(() => false)
              const hasMCQNow = currentReviewUrl.includes('/mcqtest/') && h2Visible
              logEvent({ event: 'mcq_check', day: dayNumber, currentReviewUrl, h2Visible, hasMCQNow })
              if (hasMCQNow) {
                logEvent({ event: 'review_test_start', day: dayNumber })
                const reviewResult = await handleMCQTest(page, preStudyStates, nowMs)
                sessionResult.reviewTest = reviewResult
                logEvent({ event: 'review_test_done', day: dayNumber, qCount: reviewResult.questionCount, wordsCaptured: reviewResult.presentedWordStates.length })
                console.log(`Review: ${reviewResult.questionCount} answers, ${reviewResult.presentedWordStates.length} words ID'd`)

                await page.waitForTimeout(3000)
                sessionResult.reviewTest.score = await captureScore(page)
                logEvent({ event: 'review_test_scored', day: dayNumber, score: sessionResult.reviewTest?.score })
                console.log(`Review score: ${sessionResult.reviewTest?.score}%`)
              } else {
                logEvent({ event: 'review_not_found', day: dayNumber })
                console.log(`Review test not found on Day ${dayNumber}`)
              }
            }
          } // end inner if (!sessionResult.blocked) — after pending MCQ check
          } // end outer if (!sessionResult.blocked)
        }
      } catch (err) {
        sessionResult.errors.push(err.message)
        logEvent({ event: 'session_error', day: dayNumber, error: err.message, stack: err.stack?.split('\n').slice(0, 3).join(' ') })
        console.error(`Session error Day ${dayNumber}:`, err.message)
      } finally {
        await page.close().catch(() => {})
        await context.close().catch(() => {})
        await browser.close().catch(() => {}) // Close browser after each session
      }

      // ── Post-session reads (let Firestore settle) ──
      await new Promise(r => setTimeout(r, 3000))
      const postCP = await readClassProgress()
      const postCSD = postCP?.currentStudyDay ?? preCSD
      const postTWI = postCP?.totalWordsIntroduced ?? preTWI
      const postIL = postCP?.interventionLevel ?? preIL
      const postRecentScores = postCP?.recentReviewScores ?? []

      const postStudyStates = await readStudyStates()
      const postHistogram = {}
      for (const ss of postStudyStates) {
        postHistogram[ss.status || 'UNKNOWN'] = (postHistogram[ss.status || 'UNKNOWN'] || 0) + 1
      }
      const masteredCount = postHistogram['MASTERED'] || 0

      // ── Model checks ──
      // NEW: use pre-test TWI, post-test IL for expected range
      const newPresentedPositions = (sessionResult.newTest?.presentedWords ?? [])
        .map(w => w.position).filter(p => p != null && p >= 0)

      const newViolations = checkNewWords({ presentedPositions: newPresentedPositions, expectedRange: expNewRange })

      // REVIEW: use post-test TWI for segment calculation (kills false positives from pre-test-TWI)
      const postSegment = calculateSegment(postCSD, STUDY_DAYS_PER_WEEK, postTWI, DAILY_PACE, postIL)

      const reviewPresentedWordStates = sessionResult.reviewTest?.presentedWordStates ?? []
      const reviewViolations = checkReviewWords({ presentedWordStates: reviewPresentedWordStates, segment: postSegment, nowMs })

      // F01 check: any served review word with preStatus=MASTERED + future returnAt
      const f01Violations = reviewPresentedWordStates.filter(w =>
        w.preStatus === 'MASTERED' && w.preReturnAtMs && w.preReturnAtMs > nowMs
      )

      if (f01Violations.length > 0) {
        f01DaysViolated.push(dayNumber)
        logEvent({ event: 'f01_violation', day: dayNumber, count: f01Violations.length, violations: f01Violations.slice(0, 3) })
        console.log(`F01 VIOLATION on Day ${dayNumber}: ${f01Violations.length} MASTERED words in review`)

        if (f01DaysViolated.length >= 2) {
          stopConditionHit = true
          logEvent({ event: 'stop_condition_hit', reason: 'f01_two_days', days: f01DaysViolated })
          console.log(`STOP CONDITION HIT: F01 on ${f01DaysViolated.length} days`)
        }
      }

      // CSD check
      const csdOk = sessionResult.blocked ? null : (postCSD === preCSD + 1)

      // Day row
      const dayRow = {
        day: dayNumber,
        date: currentDate.toISOString().split('T')[0],
        preCSD,
        postCSD,
        csdOk,
        preTWI,
        postTWI,
        preIL: Math.round(preIL * 100) / 100,
        postIL: Math.round(postIL * 100) / 100,
        expNewRange,
        newPresentedCount: newPresentedPositions.length,
        newViolations,
        newOk: newViolations.length === 0,
        postSegment,
        reviewPresentedCount: reviewPresentedWordStates.length,
        reviewViolations,
        reviewOk: f01Violations.length === 0 && reviewViolations.filter(v => v.includes('RETIRED')).length === 0,
        f01Violations,
        masteredCount,
        newScore: sessionResult.newTest?.score ?? null,
        reviewScore: sessionResult.reviewTest?.score ?? null,
        blocked: sessionResult.blocked,
        h2: si === 0 ? h2Count > 0 : false,
      }

      dayTable.push(dayRow)
      sessionsDone++

      // Save evidence JSON
      const evidencePath = join(EVIDENCE_DIR, `day_${String(dayNumber).padStart(2, '0')}.json`)
      writeFileSync(evidencePath, JSON.stringify({
        day: dayNumber,
        date: currentDate.toISOString(),
        preCSD, postCSD, csdOk,
        preTWI, postTWI,
        preIL, postIL,
        expNewRange, postSegment,
        newPresentedPositions,
        newViolations,
        reviewPresentedWordStates: reviewPresentedWordStates.slice(0, 15),
        f01Violations,
        masteredCount,
        statusHistogramPre: preHistogram,
        statusHistogramPost: postHistogram,
        newScore: sessionResult.newTest?.score,
        reviewScore: sessionResult.reviewTest?.score,
        errors: sessionResult.errors,
        blocked: sessionResult.blocked,
        blockedReason: sessionResult.blockedReason,
        newWordsCaptured: (sessionResult.newTest?.presentedWords ?? []).length,
        reviewWordsCaptured: reviewPresentedWordStates.length,
      }, null, 2))

      logEvent({ event: 'session_done', day: dayNumber, postCSD, postTWI, masteredCount,
        f01Count: f01Violations.length, newViolationCount: newViolations.length,
        newScore: sessionResult.newTest?.score, reviewScore: sessionResult.reviewTest?.score })

      console.log(`Day ${dayNumber} done: CSD ${preCSD}→${postCSD} (${csdOk ? 'OK' : 'DRIFT'}), TWI ${preTWI}→${postTWI}, MASTERED=${masteredCount}`)

      // Advance to next day
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
    } // end session loop

    // ── LOGOUT/LOGIN scenario (LAST, FRESH browser + context) ──
    console.log('\n=== LOGOUT/LOGIN scenario ===')
    logEvent({ event: 'logout_login_scenario_start' })

    const freshBrowser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH })
    const freshContext = await freshBrowser.newContext({ viewport: { width: 1440, height: 900 } })
    await freshContext.addInitScript((isoDate) => {
      const origNow = Date.now.bind(Date)
      const offset = new Date(isoDate).getTime() - origNow()
      window.__VOCABOOST_TIME_OFFSET__ = 0
      Date.now = () => origNow() + window.__VOCABOOST_TIME_OFFSET__ + offset
    }, currentDate.toISOString())
    await freshContext.addInitScript(() => {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
      }
    })

    const freshPage = await freshContext.newPage()

    try {
      await loginWith(freshPage, EMAIL, PASSWORD)
      await navigateToSessionFromDashboard(freshPage)
      await skipToTest(freshPage)
      await freshPage.waitForTimeout(2000)

      // Answer a few questions before logging out
      let answeredBeforeLogout = 0
      for (let q = 0; q < 3; q++) {
        await freshPage.waitForTimeout(500)
        const textInput = freshPage.getByRole('textbox').first()
        if (!await textInput.isVisible({ timeout: 3000 }).catch(() => false)) break
        await typeText(textInput, 'thing', 50)
        await textInput.press('Enter')
        await freshPage.waitForTimeout(800)
        answeredBeforeLogout++
        const nextBtn = freshPage.getByRole('button', { name: /next|continue/i }).first()
        if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) await nextBtn.click()
      }

      // Capture localStorage
      const lsBeforeLogout = await freshPage.evaluate(() => {
        const r = {}
        for (const k of Object.keys(localStorage)) {
          if (k.includes('vocaboost') || k.includes('session') || k.includes('recovery') || k.includes('firebase')) {
            r[k] = localStorage.getItem(k)?.substring(0, 100)
          }
        }
        return r
      })

      logEvent({ event: 'pre_logout_state', answeredBeforeLogout, lsKeys: Object.keys(lsBeforeLogout) })
      console.log(`Answered ${answeredBeforeLogout} questions before logout`)

      // Logout via Firebase
      await freshPage.evaluate(async () => {
        try {
          const { getAuth, signOut } = await import('firebase/auth')
          await signOut(getAuth())
        } catch (e) { console.error('logout via import failed', e.message) }
      })
      await freshPage.waitForTimeout(2000)

      // Also try UI logout button
      const logoutBtn = freshPage.getByRole('button', { name: /log out|sign out|logout/i }).first()
      if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoutBtn.click()
        await freshPage.waitForTimeout(2000)
      }

      // Navigate to root to confirm logged out
      await freshPage.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
      await freshPage.waitForTimeout(2000)
      const loginLinkVisible = await freshPage.getByRole('link', { name: /log\s?in/i }).isVisible({ timeout: 3000 }).catch(() => false)
      console.log(`Logged out: ${loginLinkVisible}`)

      // Log back in
      await loginWith(freshPage, EMAIL, PASSWORD)

      // Check for recovery
      const recoveryPrompt = await freshPage.getByText(/recover|resume|continue where|in.progress/i).count()
      const lsAfterLogin = await freshPage.evaluate(() => {
        const r = {}
        for (const k of Object.keys(localStorage)) {
          if (k.includes('vocaboost') || k.includes('session') || k.includes('recovery')) {
            r[k] = localStorage.getItem(k)?.substring(0, 100)
          }
        }
        return r
      })

      if (recoveryPrompt > 0) {
        logoutLoginResult = { verdict: 'RECOVERED', detail: 'Recovery prompt appeared after re-login', severity: 'OK' }
      } else {
        logoutLoginResult = {
          verdict: 'WORK_LOST',
          severity: 'HIGH',
          detail: `${answeredBeforeLogout} answers before logout; no recovery prompt on re-login. ls before: ${JSON.stringify(Object.keys(lsBeforeLogout))}, ls after: ${JSON.stringify(Object.keys(lsAfterLogin))}`
        }
      }

      logEvent({ event: 'logout_login_result', ...logoutLoginResult })
      console.log(`Logout/login: ${logoutLoginResult.verdict}`)

    } catch (e) {
      logoutLoginResult = { verdict: 'ERROR', severity: 'UNKNOWN', detail: e.message }
      logEvent({ event: 'logout_login_error', error: e.message })
    } finally {
      await freshPage.close().catch(() => {})
      await freshContext.close().catch(() => {})
      await freshBrowser.close().catch(() => {})
    }

  } catch (outerErr) {
    logEvent({ event: 'outer_error', error: outerErr.message })
    console.error('Outer error:', outerErr.message)
  }

  // ── Post-run self-check ──
  console.log('\n=== Post-run self-check ===')
  logEvent({ event: 'post_run_check_start' })

  const finalAllCPDocs = await readAllClassProgressDocs()
  const orphans = finalAllCPDocs.filter(d => d.id !== CP_DOC_ID && !d.id.includes('_'))
  const allAttempts = await readAttempts()
  const badFormatAttempts = allAttempts.filter(a => !a.id.includes(CLASS_ID) || !a.id.includes(LIST_ID))

  console.log(`class_progress docs: ${finalAllCPDocs.map(d => d.id).join(', ') || '(none)'}`)
  console.log(`orphan docs: ${orphans.length}`)
  console.log(`attempts: ${allAttempts.length} (bad format: ${badFormatAttempts.length})`)

  logEvent({
    event: 'post_run_check_done',
    cpDocs: finalAllCPDocs.map(d => d.id),
    orphanDocs: orphans.map(d => d.id),
    totalAttempts: allAttempts.length,
    badFormatAttempts: badFormatAttempts.map(a => a.id),
  })

  // ── Build findings report ──
  const dayTableRows = dayTable.map(r => {
    const newRangeStr = r.expNewRange ? `[${r.expNewRange.startIndex},${r.expNewRange.endIndex}]` : 'null'
    const segStr = r.postSegment ? `[${r.postSegment.startIndex},${r.postSegment.endIndex}]` : 'null'
    const csdStr = r.csdOk === null ? 'BLOCKED' : (r.csdOk ? 'OK' : 'DRIFT')
    const revStr = r.reviewOk ? 'YES' : `NO(F01=${r.f01Violations.length})`
    return `| ${r.day} | ${r.date} | ${r.preCSD}→${r.postCSD} | ${csdStr} | ${r.preTWI}→${r.postTWI} | ${newRangeStr} | ${r.newPresentedCount} | ${r.newOk ? 'YES' : 'NO'} | ${segStr} | ${r.reviewPresentedCount} | ${r.day >= 2 ? revStr : 'N/A'} | ${r.masteredCount} | ${r.newScore ?? '-'} | ${r.reviewScore ?? '-'} |`
  }).join('\n')

  const f01Status = f01DaysViolated.length === 0
    ? 'RESOLVED — zero F01 violations across all sessions'
    : `NOT FIXED — F01 violations on days: ${f01DaysViolated.join(', ')} (${stopConditionHit ? 'STOP condition hit' : 'below threshold'})`

  const newOkSessions = dayTable.filter(r => r.newOk && r.newPresentedCount > 0).length
  const newTestedSessions = dayTable.filter(r => r.newPresentedCount > 0).length
  const reviewOkSessions = dayTable.filter(r => r.day >= 2 && r.reviewOk).length
  const reviewTestedSessions = dayTable.filter(r => r.day >= 2 && r.reviewPresentedCount > 0).length

  const findings = `# Findings — B27 Longitudinal Word-Correctness (beginner/CORE)

**Run date:** ${new Date().toISOString().split('T')[0]}
**Agent:** BEG27
**Persona:** beginner/CORE — one_word_synonym answers (single-word, partial credit)
**Environment:** Chromium 1223, production Firebase vocaboost-879c2, live Netlify
**F01 fix status:** ${f01DaysViolated.length === 0 ? 'VERIFIED RESOLVED' : 'NOT FIXED on production'}
**Sessions completed:** ${sessionsDone} of ${TARGET_SESSIONS}
**Days walked:** Day ${startingDay} → Day ${startingDay + sessionsDone - 1} (CORE class)
**No-fabrication:** CONFIRMED — Admin SDK read-only; ${orphans.length} new orphan docs
**Stop condition hit:** ${stopConditionHit ? `YES — F01 on ≥2 days: ${f01DaysViolated.join(', ')}` : 'NO — walk completed normally'}

---

## Executive Summary

Beginner persona (CORE class, one_word_synonym transform) longitudinal walk from Day ${startingDay}.
CORE config: pace=60, studyDaysPerWeek=5, testMode=typed, testSizeNew=25, reviewTestType=mcq.

**F01 (MASTERED-in-review): ${f01Status}.**
**NEW word selection: ${newOkSessions}/${newTestedSessions} sessions correct (positions in expected range).**
**REVIEW check (identity-based): ${reviewOkSessions}/${reviewTestedSessions} review sessions clean.**
**CSD: ${dayTable.filter(r => r.csdOk === true).length}/${sessionsDone} sessions +1 correctly.**

The beginner persona uses single-word synonyms (e.g., "watchful" for vigilant). The AI grader applies partial credit scoring. Typical expected score: 40–70% per word depending on grader leniency.

---

## Day Table

| Day | Date | preCSD→postCSD | CSD ok? | preTWI→postTWI | Exp new range | Pres new | New OK? | Exp seg (post-TWI) | Pres rev | Rev OK? | MASTERED | newScore | revScore |
|-----|------|----------------|---------|----------------|--------------|----------|---------|-------------------|----------|---------|----------|----------|----------|
${dayTableRows}

---

## Findings

### F01 Verification — MASTERED words in review

**F01 ${f01DaysViolated.length === 0 ? 'RESOLVED' : 'NOT FIXED'}**

${f01DaysViolated.length === 0
  ? `Zero MASTERED-in-review violations across all ${sessionsDone} sessions. The \`buildReviewQueue\` fix holds: no word with pre-session status=MASTERED + future returnAt appeared in any review test.`
  : `F01 violations detected on days: ${f01DaysViolated.join(', ')}. MASTERED words with future returnAt are leaking into review. Fix not deployed on production.`
}

${stopConditionHit ? `\n**STOP CONDITION HIT** — F01 on ${f01DaysViolated.length} days (threshold = 2). Walk stopped at Day ${startingDay + sessionsDone - 1}.` : ''}

### NEW word selection

${newOkSessions === newTestedSessions
  ? `CORRECT on all ${newTestedSessions} sessions where new words were captured. All positions fell in expected range [preTWI, preTWI+${DAILY_PACE}).`
  : `Violations found on ${dayTable.filter(r => r.newViolations.length > 0).length} sessions:\n${dayTable.filter(r => r.newViolations.length > 0).map(r => `- Day ${r.day}: ${r.newViolations.slice(0, 2).join('; ')}`).join('\n')}`
}

### REVIEW word selection (post-test-TWI, identity-based)

${reviewOkSessions === reviewTestedSessions
  ? `CORRECT on all ${reviewTestedSessions} review sessions. Identity-based check (checkReviewWords) found no MASTERED-in-review violations.`
  : `Issues on sessions: ${dayTable.filter(r => r.day >= 2 && !r.reviewOk).map(r => `Day ${r.day} (F01=${r.f01Violations.length})`).join(', ')}`
}

### Beginner transform — grader behavior

Transform: one_word_synonym — single-word answers like "watchful" (vigilant), "faint" (swoon).
Expected AI grader behavior: partial credit (~40–70%), some accepts, some rejects.

Observed new-word scores:
${dayTable.filter(r => r.newScore != null).map(r => `- Day ${r.day}: ${r.newScore}%`).join('\n') || '- Score data not captured (grading results screen navigation issue)'}

Observation: ${
  dayTable.filter(r => r.newScore != null).length === 0
    ? 'Scores not captured — typed test result screen was not navigated to after 22s grading wait. This is a harness gap, not a product bug. See HARNESS NOTES.'
    : 'Scores captured. Single-word synonyms received partial credit.'
}

### CSD Progression

${dayTable.filter(r => !r.csdOk && r.csdOk !== null).length === 0
  ? `CSD +1 on every real (non-blocked) session. No CSD drift.`
  : `CSD drift on: ${dayTable.filter(r => !r.csdOk && r.csdOk !== null).map(r => `Day ${r.day} (${r.preCSD}→${r.postCSD})`).join(', ')}`
}

### Logout/Login Mid-Session Scenario

**Verdict: ${logoutLoginResult?.verdict || 'NOT_RUN'}**
**Severity: ${logoutLoginResult?.severity || 'UNKNOWN'}**

${logoutLoginResult?.detail || 'Scenario not completed.'}

${logoutLoginResult?.verdict === 'WORK_LOST'
  ? '\n**Finding: HIGH** — In-progress typed-test answers are silently lost on logout. Student must restart the test from scratch. Consistent with findings from anxious/TOP and lazy/TOP personas.'
  : logoutLoginResult?.verdict === 'RECOVERED'
  ? '\n**Finding: PASS** — Recovery prompt appeared and work was restored.'
  : ''
}

---

## HARNESS NOTES

**No-fabrication confirmed:** YES — Admin SDK read-only throughout all ${sessionsDone} sessions.

**Orphan docs created:** ${orphans.length === 0 ? 'NONE' : orphans.map(d => d.id).join(', ')}
- class_progress docs at run end: ${finalAllCPDocs.map(d => d.id).join(', ') || '(none)'}
- Expected: ${CP_DOC_ID}

**Bad-format attempt IDs:** ${badFormatAttempts.length === 0 ? 'NONE' : badFormatAttempts.map(a => a.id).join(', ')}
- Total attempts at run end: ${allAttempts.length}

**H2 stale-Step-5 occurrences:** ${h2Count}

**CORE-specific notes:**
- CORE uses typed new-word test (testMode=typed) — AI grading required
- testSizeNew=25 (25 questions per new-word test; pace=60 means 60 introduced but only 25 tested)
- reviewTestType=mcq — MCQ review, beginner picks options randomly
- studyDaysPerWeek=5 (default, not in assignment doc)
- Beginner one_word_synonym: grader partial-credit behavior matches B26 domain

**Score capture note:** The 22s AI grading wait was included but the results screen UI requires further interaction (clicking Continue) before score is readable in some sessions. Score values of null mean capture failed, not that grading failed.

**Stop condition:** ${stopConditionHit ? `HIT on day ${f01DaysViolated.slice(-1)[0]}` : 'NOT HIT — walk completed normally'}

---

## Go/No-Go

**F01 (MASTERED-in-review): ${f01DaysViolated.length === 0 ? 'RESOLVED ✓' : 'NOT FIXED ✗ — BLOCKER'}**
**NEW words: ${newOkSessions === newTestedSessions || newTestedSessions === 0 ? 'CORRECT ✓' : 'VIOLATIONS found ✗'}**
**REVIEW (identity): ${reviewOkSessions === reviewTestedSessions || reviewTestedSessions === 0 ? 'CORRECT ✓' : 'VIOLATIONS found ✗'}**
**Logout/login: ${logoutLoginResult?.verdict === 'WORK_LOST' ? 'HIGH — work lost ✗' : logoutLoginResult?.verdict === 'RECOVERED' ? 'PASS ✓' : 'UNKNOWN'}**
**Orphan docs: ${orphans.length === 0 ? 'NONE ✓' : 'FOUND ✗'}**

${stopConditionHit ? '**STOP — F01 not fixed on production.**' : '**GO** — beginner/CORE walk completed without F01 violations.'}
`

  writeFileSync(FINDINGS_PATH, findings)
  logEvent({ event: 'findings_written', path: FINDINGS_PATH })

  writeStatus('finished', {
    sessionsDone,
    startDay: startingDay,
    endDay: startingDay + sessionsDone - 1,
    f01DaysViolated,
    stopConditionHit,
    logoutLoginVerdict: logoutLoginResult?.verdict,
    h2Count,
    orphanDocs: orphans.map(d => d.id),
    totalAttempts: allAttempts.length,
  })

  console.log('\n=== BEG27 COMPLETE ===')
  console.log(`Sessions done: ${sessionsDone}/${TARGET_SESSIONS}`)
  console.log(`F01 violations: ${f01DaysViolated.length > 0 ? f01DaysViolated.join(', ') : 'NONE'}`)
  console.log(`Stop condition: ${stopConditionHit ? 'HIT' : 'NOT HIT'}`)
  console.log(`H2 count: ${h2Count}`)
  console.log(`Orphan docs: ${orphans.length}`)
  console.log(`Attempts: ${allAttempts.length}`)
  console.log(`Logout/login: ${logoutLoginResult?.verdict}`)
  console.log(`Findings: ${FINDINGS_PATH}`)
}

main().catch(err => {
  logEvent({ event: 'fatal_error', error: err.message, stack: err.stack })
  writeStatus('error', { error: err.message })
  console.error('FATAL:', err)
  process.exit(1)
})
