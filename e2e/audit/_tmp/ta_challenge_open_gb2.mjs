/**
 * Follow the "Open Gradebook" button from class detail
 * Use client-side navigation instead of direct goto
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
  if (getApps().length === 0) initializeApp({ credential: cert(serviceAccount), projectId: 'vocaboost-879c2' })
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
  log('=== Teacher Open Gradebook + Challenge Review ===')

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
    log('Logged in. URL: ' + page.url())

    // Navigate to class detail using pushState (SPA routing)
    await page.evaluate((classId) => {
      history.pushState({}, '', `/classes/${classId}`)
      dispatchEvent(new PopStateEvent('popstate'))
    }, CLASS_ID)
    await new Promise(r => setTimeout(r, 5000))
    await screenshot(page, 'open_gb2_01_class_detail')
    const classContent = await page.evaluate(() => document.body.innerText.slice(0, 3000))
    log('Class detail: ' + classContent.slice(0, 500))

    // Find Gradebook tab/link in class detail
    const allClickables = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button, a, [role="tab"]')).map(el => ({
        tag: el.tagName, text: el.textContent?.trim()?.slice(0, 50), href: el.getAttribute('href') || '', id: el.id || ''
      })).filter(el => el.text)
    })
    log('Clickable elements: ' + JSON.stringify(allClickables.slice(0, 20)))

    // Find Gradebook tab
    const gbTabEls = allClickables.filter(el => el.text === 'Gradebook')
    log('Gradebook tab elements: ' + JSON.stringify(gbTabEls))

    if (gbTabEls.length > 0) {
      // Click it
      await page.locator('button, a, [role="tab"]').filter({ hasText: /^Gradebook$/ }).first().click()
      await new Promise(r => setTimeout(r, 2000))
      await screenshot(page, 'open_gb2_02_gb_tab')
      const gbTabContent = await page.evaluate(() => document.body.innerText.slice(0, 3000))
      log('GB tab content: ' + gbTabContent.slice(0, 500))

      // Find "Open Gradebook" button/link
      const openBtn = page.locator('button, a').filter({ hasText: /open gradebook/i }).first()
      log('Open Gradebook btn count: ' + await openBtn.count())

      if (await openBtn.count() > 0) {
        await openBtn.click()
        await new Promise(r => setTimeout(r, 5000))
        log('After clicking Open Gradebook, URL: ' + page.url())
        await screenshot(page, 'open_gb2_03_gradebook_opened')
        const openedContent = await page.evaluate(() => document.body.innerText.slice(0, 5000))
        log('Gradebook opened: ' + openedContent.slice(0, 1000))

        const viewBtns = await page.getByRole('button', { name: /view|details/i }).count()
        const pendingBadges = await page.getByText(/pending challenge/i).count()
        log(`View buttons: ${viewBtns}, Pending challenge badges: ${pendingBadges}`)

        if (viewBtns > 0) {
          // Open attempt with pending challenge if any, else just first
          if (pendingBadges > 0) {
            // Find the row with pending challenge
            let foundPending = false
            const allViewBtns = await page.getByRole('button', { name: /view|details/i }).all()
            for (const btn of allViewBtns) {
              // Go up to parent row/container and check for pending
              // Since DOM traversal is complex, just iterate through the content
              const idx = allViewBtns.indexOf(btn)
              const rowText = await page.evaluate((i) => {
                const btns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent?.trim().match(/view|details/i))
                if (!btns[i]) return ''
                let el = btns[i].parentElement
                for (let j = 0; j < 5; j++) {
                  if (el.textContent?.includes('Pending Challenge')) return 'PENDING: ' + el.textContent?.slice(0, 100)
                  el = el.parentElement
                  if (!el) break
                }
                return ''
              }, idx)
              if (rowText.includes('PENDING')) {
                await btn.click()
                foundPending = true
                break
              }
            }
            if (!foundPending) {
              await page.getByRole('button', { name: /view|details/i }).first().click()
            }
          } else {
            await page.getByRole('button', { name: /view|details/i }).first().click()
          }

          await new Promise(r => setTimeout(r, 2000))
          await screenshot(page, 'open_gb2_04_attempt_details')
          const detailContent = await page.evaluate(() => document.body.innerText.slice(0, 5000))
          log('Attempt details: ' + detailContent.slice(0, 1000))

          const acceptBtns = await page.getByRole('button', { name: /accept/i }).count()
          const rejectBtns = await page.getByRole('button', { name: /reject/i }).count()
          log(`Accept: ${acceptBtns}, Reject: ${rejectBtns}`)

          if (acceptBtns > 0) {
            const stateBefore = await readPersonaState('BEFORE_ACCEPT')
            log('ACCEPTING challenge...')
            await page.getByRole('button', { name: /accept/i }).first().click()
            await new Promise(r => setTimeout(r, 5000))
            await screenshot(page, 'open_gb2_05_after_accept')
            const stateAfterAccept = await readPersonaState('AFTER_ACCEPT')

            const expectedScore = Math.round(stateAfterAccept.correctCount / stateAfterAccept.totalQuestions * 100)
            log(`Score: ${stateBefore.score} -> ${stateAfterAccept.score}, expected ${expectedScore}`)
            if (stateAfterAccept.score !== expectedScore) {
              log(`FINDING[Blocker]: Score inflation after accept! got ${stateAfterAccept.score}, expected ${expectedScore}`)
            } else {
              log('PASS: Score correct after accept')
            }
            log(`CSD: ${stateBefore.csd} -> ${stateAfterAccept.csd}`)
            if (stateAfterAccept.csd !== stateBefore.csd) {
              log(`FINDING[High]: CSD changed after accept: ${stateBefore.csd} -> ${stateAfterAccept.csd}`)
            } else {
              log('PASS: CSD unchanged after accept (score below threshold)')
            }
            log(`Tokens: ${stateBefore.availableTokens} -> ${stateAfterAccept.availableTokens}`)
            if (stateAfterAccept.availableTokens !== stateBefore.availableTokens) {
              log(`FINDING[High]: Accept consumed token`)
            } else {
              log('PASS: Accept did not consume token')
            }

            // Also check for reject after accept
            await new Promise(r => setTimeout(r, 1000))
            const rejectBtnsNow = await page.getByRole('button', { name: /reject/i }).count()
            log(`Reject buttons now available: ${rejectBtnsNow}`)
          } else if (rejectBtns > 0) {
            // Only reject available
            const stateBefore = await readPersonaState('BEFORE_REJECT_ONLY')
            await page.getByRole('button', { name: /reject/i }).first().click()
            await new Promise(r => setTimeout(r, 5000))
            await screenshot(page, 'open_gb2_05_after_reject')
            const stateAfterReject = await readPersonaState('AFTER_REJECT_ONLY')
            log(`Reject - Tokens: ${stateBefore.availableTokens} -> ${stateAfterReject.availableTokens}`)
          } else {
            log('No Accept/Reject buttons found in attempt details')
          }
        }
      }
    }

  } finally {
    await ctx.close()
    await browser.close()
  }

  log('\n=== Console Errors ===')
  consoleMsgs.filter(m => m.type === 'error').forEach(m => log(`[ERROR] ${m.text}`))
  log('\n=== Console Relevant ===')
  consoleMsgs.filter(m =>
    m.text.toLowerCase().includes('attempt') ||
    m.text.toLowerCase().includes('challenge') ||
    m.text.toLowerCase().includes('query') ||
    m.text.toLowerCase().includes('permission') ||
    m.text.toLowerCase().includes('returned')
  ).forEach(m => log(`[${m.type}] ${m.text}`))

  process.exit(0)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
