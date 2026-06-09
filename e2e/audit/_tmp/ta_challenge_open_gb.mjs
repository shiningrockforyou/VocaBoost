/**
 * Follow the "Open Gradebook" button from class detail
 * and try to get challenge review working
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
const ATTEMPT_ID = 'fNDvwIEDXphlv8BD4rxYygHOSvD3_vocaboost_test_LVjBTFuYE8FbPG34pVAt_aRGjnGXdU4aupiS8SlXR_new_1780179723493_o00czrkub'

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
  const attemptSnap = await db.doc(`attempts/${ATTEMPT_ID}`).get()
  const attemptData = attemptSnap.data()
  const answers = attemptData.answers || []
  const correctCount = answers.filter(a => a.isCorrect).length
  const pendingChallenges = answers.filter(a => a.challengeStatus === 'pending').length
  const acceptedChallenges = answers.filter(a => a.challengeStatus === 'accepted').length
  const rejectedChallenges = answers.filter(a => a.challengeStatus === 'rejected').length
  const state = {
    label, availableTokens, challengeHistoryCount: challengeHistory.length,
    activeRejections: activeRejections.length, csd, score: attemptData.score,
    passed: attemptData.passed, totalQuestions: attemptData.totalQuestions,
    correctCount, pendingChallenges, acceptedChallenges, rejectedChallenges,
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
  log('=== Open Gradebook from Class Detail + Challenge Review ===')

  const browser = await chromium.launch({
    headless: true,
    executablePath: EXEC_PATH,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '/ms-playwright' }
  })

  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  const consoleMsgs = []
  page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text().slice(0, 300) }))

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

    // Go to class detail
    await page.goto(`${BASE_URL}/classes/${CLASS_ID}`, { waitUntil: 'networkidle', timeout: 30000 })
    await new Promise(r => setTimeout(r, 3000))
    await screenshot(page, 'open_gb_01_class_detail')

    // Find and click the Gradebook tab
    const allTextElements = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent?.trim()
        return text === 'Gradebook' || text === 'Students' || text === 'Assigned Lists'
      }).map(el => ({ tag: el.tagName, text: el.textContent?.trim(), class: el.className?.slice(0, 50) }))
    })
    log('Tab elements found: ' + JSON.stringify(allTextElements.slice(0, 10)))

    // Click Gradebook tab by finding it in tabs
    const tabs = await page.locator('[role="tab"], button, a').filter({ hasText: /^Gradebook$/ }).all()
    log('Gradebook tabs: ' + tabs.length)
    if (tabs.length > 0) {
      await tabs[0].click()
      await new Promise(r => setTimeout(r, 2000))
    }

    await screenshot(page, 'open_gb_02_gb_tab_clicked')
    const tabContent = await page.evaluate(() => document.body.innerText.slice(0, 3000))
    log('After Gradebook tab click: ' + tabContent.slice(0, 500))

    // Find "Open Gradebook" button
    const openGbBtn = page.getByRole('button', { name: /open gradebook/i }).first()
    const openGbLink = page.getByRole('link', { name: /open gradebook/i }).first()
    log('Open Gradebook button: ' + await openGbBtn.count())
    log('Open Gradebook link: ' + await openGbLink.count())

    let navigatedToGradebook = false
    if (await openGbBtn.count() > 0) {
      await openGbBtn.click()
      navigatedToGradebook = true
    } else if (await openGbLink.count() > 0) {
      await openGbLink.click()
      navigatedToGradebook = true
    }

    if (navigatedToGradebook) {
      await new Promise(r => setTimeout(r, 5000))
      log('After Open Gradebook, URL: ' + page.url())
      await screenshot(page, 'open_gb_03_opened')
      const gbContent = await page.evaluate(() => document.body.innerText.slice(0, 5000))
      log('Opened gradebook: ' + gbContent.slice(0, 1000))

      // Look for attempts
      const viewBtns = await page.getByRole('button', { name: /view|details/i }).count()
      const pendingBadges = await page.getByText(/pending challenge/i).count()
      log(`View buttons: ${viewBtns}, Pending badges: ${pendingBadges}`)

      if (viewBtns > 0 && pendingBadges > 0) {
        log('Found pending challenge in teacher gradebook!')
        // Get state before
        const stateBefore = await readPersonaState('BEFORE_REVIEW')

        // Find the attempt with pending challenge
        // Try to click the view button in the row with pending challenge
        const rows = await page.locator('tbody tr, [data-testid*="row"]').all()
        let found = false
        for (const row of rows) {
          const hasPending = await row.getByText(/pending challenge/i).count()
          if (hasPending > 0) {
            const viewBtn = row.getByRole('button', { name: /view|details/i })
            if (await viewBtn.count() > 0) {
              await viewBtn.click()
              found = true
              break
            }
          }
        }
        if (!found) {
          // Try opening first attempt that has the pending challenge
          await page.getByRole('button', { name: /view|details/i }).first().click()
        }
        await new Promise(r => setTimeout(r, 2000))
        await screenshot(page, 'open_gb_04_attempt_with_challenge')

        const drawerContent = await page.evaluate(() => document.body.innerText.slice(0, 5000))
        log('Attempt drawer: ' + drawerContent.slice(0, 500))

        const acceptBtns = await page.getByRole('button', { name: /accept/i }).count()
        const rejectBtns = await page.getByRole('button', { name: /reject/i }).count()
        log(`Accept: ${acceptBtns}, Reject: ${rejectBtns}`)

        if (acceptBtns > 0) {
          log('ACCEPTING challenge...')
          await page.getByRole('button', { name: /accept/i }).first().click()
          await new Promise(r => setTimeout(r, 5000))
          await screenshot(page, 'open_gb_05_after_accept')
          const stateAfterAccept = await readPersonaState('AFTER_ACCEPT')

          // Verify score
          const expectedScore = Math.round(stateAfterAccept.correctCount / stateAfterAccept.totalQuestions * 100)
          log(`Score: ${stateBefore.score} -> ${stateAfterAccept.score}, expected ${expectedScore}`)
          if (stateAfterAccept.score !== expectedScore) {
            log(`FINDING[Blocker]: Score inflation! got ${stateAfterAccept.score}, expected ${expectedScore}`)
          } else {
            log(`PASS: Score correct after accept`)
          }

          log(`CSD: ${stateBefore.csd} -> ${stateAfterAccept.csd}`)
          if (stateAfterAccept.csd !== stateBefore.csd) {
            log(`FINDING[High]: CSD changed after accept: ${stateBefore.csd} -> ${stateAfterAccept.csd}`)
          } else {
            log(`PASS: CSD unchanged (score did not reach pass threshold)`)
          }

          log(`Tokens (accept): ${stateBefore.availableTokens} -> ${stateAfterAccept.availableTokens}`)
          if (stateAfterAccept.availableTokens !== stateBefore.availableTokens) {
            log(`FINDING[High]: Accept consumed a token!`)
          } else {
            log(`PASS: Accept did not consume token`)
          }

          // Check for 2nd pending (we only filed 1 challenge)
          const rejectBtnsNow = await page.getByRole('button', { name: /reject/i }).count()
          log(`Reject buttons now: ${rejectBtnsNow}`)
        }
      } else if (viewBtns > 0) {
        log('View buttons found but no pending challenge badge visible')
        await page.getByRole('button', { name: /view|details/i }).first().click()
        await new Promise(r => setTimeout(r, 2000))
        await screenshot(page, 'open_gb_04_attempt_no_challenge')
        const drawerContent = await page.evaluate(() => document.body.innerText.slice(0, 3000))
        log('Attempt drawer: ' + drawerContent.slice(0, 500))
      }
    } else {
      log('No Open Gradebook button found')
    }

  } finally {
    await ctx.close()
    await browser.close()
  }

  log('\n=== Console Errors ===')
  consoleMsgs.filter(m => m.type === 'error').forEach(m => log(`[ERROR] ${m.text}`))
  log('\n=== Console Relevant ===')
  consoleMsgs.filter(m => m.text.toLowerCase().includes('attempt') || m.text.toLowerCase().includes('challenge') || m.text.toLowerCase().includes('query') || m.text.toLowerCase().includes('permission')).forEach(m => log(`[${m.type}] ${m.text}`))

  process.exit(0)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
