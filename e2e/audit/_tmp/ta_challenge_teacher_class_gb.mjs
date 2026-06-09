/**
 * Navigate teacher through Class Detail -> Gradebook tab
 * and verify challenge review capability
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const SCREENSHOTS_DIR = 'audit/playwright/findings/screenshots/TA-CHALLENGE'
mkdirSync(SCREENSHOTS_DIR, { recursive: true })

const EXEC_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'
const BASE_URL = 'https://vocaboostone.netlify.app'
const TA_EMAIL = 'ta@vocaboost.com'
const TA_PASS = 'VocaTA2026!'
const CLASS_ID = 'LVjBTFuYE8FbPG34pVAt'
const STUDENT_UID = 'fNDvwIEDXphlv8BD4rxYygHOSvD3'

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`)

let db
function getDB() {
  if (db) return db
  const serviceAccount = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'))
  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount), projectId: 'vocaboost-879c2' })
  }
  db = getFirestore()
  return db
}

async function readPersonaState(label) {
  const db = getDB()
  const userSnap = await db.doc(`users/${STUDENT_UID}`).get()
  const userData = userSnap.data()
  const challengeHistory = userData.challenges?.history || []
  const now = Date.now()
  const activeRejections = challengeHistory.filter(h => {
    if (h.status !== 'rejected') return false
    const t = h.replenishAt?.toMillis ? h.replenishAt.toMillis() : 0
    return t > now
  })
  const availableTokens = Math.max(0, 5 - activeRejections.length)

  const progressSnap = await db.doc(`users/${STUDENT_UID}/class_progress/LVjBTFuYE8FbPG34pVAt_aRGjnGXdU4aupiS8SlXR`).get()
  const csd = progressSnap.exists ? progressSnap.data().currentStudyDay : 'N/A'

  const ATTEMPT_ID = 'fNDvwIEDXphlv8BD4rxYygHOSvD3_vocaboost_test_LVjBTFuYE8FbPG34pVAt_aRGjnGXdU4aupiS8SlXR_new_1780179723493_o00czrkub'
  const attemptSnap = await db.doc(`attempts/${ATTEMPT_ID}`).get()
  const attemptData = attemptSnap.data()
  const answers = attemptData.answers || []
  const correctCount = answers.filter(a => a.isCorrect).length
  const pendingChallenges = answers.filter(a => a.challengeStatus === 'pending').length
  const acceptedChallenges = answers.filter(a => a.challengeStatus === 'accepted').length
  const rejectedChallenges = answers.filter(a => a.challengeStatus === 'rejected').length

  const state = {
    label,
    availableTokens,
    challengeHistoryCount: challengeHistory.length,
    activeRejections: activeRejections.length,
    csd,
    score: attemptData.score,
    passed: attemptData.passed,
    totalQuestions: attemptData.totalQuestions,
    correctCount,
    pendingChallenges,
    acceptedChallenges,
    rejectedChallenges,
  }
  log(`STATE [${label}]: tokens=${availableTokens}, csd=${csd}, score=${attemptData.score}, correct=${correctCount}/25, pending=${pendingChallenges}, accepted=${acceptedChallenges}, rejected=${rejectedChallenges}`)
  return state
}

async function screenshot(page, name) {
  const path = `${SCREENSHOTS_DIR}/${name}.png`
  await page.screenshot({ path, fullPage: true })
  log(`Screenshot: ${path}`)
  return path
}

async function main() {
  log('=== Teacher Class Gradebook Investigation ===')

  const browser = await chromium.launch({
    headless: true,
    executablePath: EXEC_PATH,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '/ms-playwright' }
  })

  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  // Collect console
  const consoleMsgs = []
  page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text().slice(0, 200) }))

  try {
    // Login as teacher
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
    await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
    await page.getByLabel(/email/i).first().fill(TA_EMAIL)
    await page.getByLabel(/password/i).first().fill(TA_PASS)
    await page.getByLabel(/password/i).first().press('Enter')
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
      await page.getByRole('button', { name: /continue/i }).first().click().catch(() => {})
      await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
    })
    log('Logged in as teacher')

    // Navigate to class detail
    await page.evaluate((classId) => {
      history.pushState({}, '', `/classes/${classId}`)
      dispatchEvent(new PopStateEvent('popstate'))
    }, CLASS_ID)
    await new Promise(r => setTimeout(r, 3000))
    await screenshot(page, 'teacher_class_01_detail')

    // Click on Gradebook tab
    const gradebookTab = page.getByRole('button', { name: /^gradebook$/i }).first()
    const gradebookTabByText = page.getByText(/^Gradebook$/).first()
    const gradebookLink = page.getByRole('link', { name: /gradebook/i }).first()

    log('Gradebook tab (button):', await gradebookTab.count())
    log('Gradebook tab (text):', await gradebookTabByText.count())
    log('Gradebook link:', await gradebookLink.count())

    // Try clicking
    let clicked = false
    if (await gradebookTab.count() > 0) {
      await gradebookTab.click()
      clicked = true
    } else if (await gradebookTabByText.count() > 0) {
      await gradebookTabByText.click()
      clicked = true
    } else if (await gradebookLink.count() > 0) {
      await gradebookLink.click()
      clicked = true
    }

    log('Clicked gradebook tab:', clicked)
    await new Promise(r => setTimeout(r, 3000))
    await screenshot(page, 'teacher_class_02_after_gb_tab')

    const afterTabContent = await page.evaluate(() => document.body.innerText.slice(0, 5000))
    log('After Gradebook tab: ' + afterTabContent.slice(0, 1000))

    // Current URL
    log('URL after tab click: ' + page.url())

    // Look for attempt rows
    const viewBtns = await page.getByRole('button', { name: /view|details/i }).count()
    const tableRows = await page.locator('tr').count()
    log(`View buttons: ${viewBtns}, Table rows: ${tableRows}`)

    // Look for pending challenge badge
    const pendingBadges = await page.getByText(/pending challenge/i).count()
    log(`Pending challenge badges: ${pendingBadges}`)

    // If we see attempts, try opening one
    if (viewBtns > 0) {
      log('Opening first attempt...')
      await page.getByRole('button', { name: /view|details/i }).first().click()
      await new Promise(r => setTimeout(r, 2000))
      await screenshot(page, 'teacher_class_03_attempt_details')

      const detailContent = await page.evaluate(() => document.body.innerText.slice(0, 5000))
      log('Attempt details: ' + detailContent.slice(0, 1000))

      // Look for accept/reject
      const acceptBtns = await page.getByRole('button', { name: /accept/i }).count()
      const rejectBtns = await page.getByRole('button', { name: /reject/i }).count()
      log(`Accept: ${acceptBtns}, Reject: ${rejectBtns}`)

      // State before
      const stateBefore = await readPersonaState('BEFORE_ACCEPT')

      if (acceptBtns > 0) {
        log('ACCEPTING first challenge...')
        await page.getByRole('button', { name: /accept/i }).first().click()
        await new Promise(r => setTimeout(r, 4000))
        await screenshot(page, 'teacher_class_04_after_accept')

        const stateAfterAccept = await readPersonaState('AFTER_ACCEPT')

        // Verify score
        const expectedScore = Math.round(stateAfterAccept.correctCount / stateAfterAccept.totalQuestions * 100)
        log(`Score check: ${stateBefore.score} -> ${stateAfterAccept.score}, expected ${expectedScore}`)

        // Verify CSD
        log(`CSD: ${stateBefore.csd} -> ${stateAfterAccept.csd}`)

        // Verify tokens
        log(`Tokens: ${stateBefore.availableTokens} -> ${stateAfterAccept.availableTokens}`)

        // Check for 2nd pending challenge
        const pendingBtnsAfter = await page.getByRole('button', { name: /accept|reject/i }).count()
        log(`Accept/Reject buttons after first accept: ${pendingBtnsAfter}`)

        if (pendingBtnsAfter > 0) {
          const stateBeforeReject = await readPersonaState('BEFORE_REJECT')

          log('REJECTING second challenge...')
          await page.getByRole('button', { name: /reject/i }).first().click()
          await new Promise(r => setTimeout(r, 4000))
          await screenshot(page, 'teacher_class_05_after_reject')

          const stateAfterReject = await readPersonaState('AFTER_REJECT')
          log(`Reject - Tokens: ${stateBeforeReject.availableTokens} -> ${stateAfterReject.availableTokens}`)
          log(`Reject - CSD: ${stateBeforeReject.csd} -> ${stateAfterReject.csd}`)
          log(`Reject - Score: ${stateBeforeReject.score} -> ${stateAfterReject.score}`)
        }
      }
    } else {
      log('No view buttons - trying to look for the persona specifically')

      // The class detail gradebook might need to navigate to student-specific view
      // Try clicking on a student name
      const personaName = page.getByText(/Audit Careful/i).first()
      if (await personaName.count() > 0) {
        await personaName.click()
        await new Promise(r => setTimeout(r, 2000))
        await screenshot(page, 'teacher_class_03_persona_view')
      }

      // Try the main gradebook but with a Name filter for the persona
      await page.evaluate(() => {
        history.pushState({}, '', '/gradebook?studentName=Audit+Careful+Student+01')
        dispatchEvent(new PopStateEvent('popstate'))
      })
      await new Promise(r => setTimeout(r, 5000))
      await screenshot(page, 'teacher_class_03_name_filter_gradebook')
      const nameGbContent = await page.evaluate(() => document.body.innerText.slice(0, 3000))
      log('Name filter gradebook: ' + nameGbContent.slice(0, 500))
    }

  } finally {
    await ctx.close()
    await browser.close()
  }

  log('\n=== Console (relevant) ===')
  consoleMsgs
    .filter(m => m.type === 'error' || m.text.toLowerCase().includes('attempt') || m.text.toLowerCase().includes('challenge') || m.text.toLowerCase().includes('query'))
    .forEach(m => log(`[${m.type}] ${m.text}`))

  process.exit(0)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
