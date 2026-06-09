/**
 * TA-CHALLENGE Audit: End-to-end challenge filing and review lifecycle.
 *
 * Step 1: Student persona files a challenge via the Gradebook UI
 * Step 2: Teacher reviews via the Gradebook UI
 * Step 3: Verify score/CSD/token state changes
 */
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const SCREENSHOTS_DIR = 'audit/playwright/findings/screenshots/TA-CHALLENGE'
mkdirSync(SCREENSHOTS_DIR, { recursive: true })

const EXEC_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome'
const BASE_URL = 'https://vocaboostone.netlify.app'

// Accounts
const STUDENT_EMAIL = 'audit_careful_01_core@vocaboost.test'
const STUDENT_PASS = 'AuditPass2026!'
const STUDENT_UID = 'fNDvwIEDXphlv8BD4rxYygHOSvD3'
const TA_EMAIL = 'ta@vocaboost.com'
const TA_PASS = 'VocaTA2026!'

// Data
const CLASS_ID = 'LVjBTFuYE8FbPG34pVAt'
const CLASS_NAME_PATTERN = 'CORE OFFLINE'
const ATTEMPT_ID = 'fNDvwIEDXphlv8BD4rxYygHOSvD3_vocaboost_test_LVjBTFuYE8FbPG34pVAt_aRGjnGXdU4aupiS8SlXR_new_1780179723493_o00czrkub'

// Admin SDK (read-only verification)
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

const findings = []
const log = (msg) => {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}
const addFinding = (severity, title, details) => {
  log(`FINDING [${severity}] ${title}`)
  findings.push({ severity, title, details })
}

async function screenshot(page, name) {
  const path = `${SCREENSHOTS_DIR}/${name}.png`
  await page.screenshot({ path, fullPage: true })
  log(`Screenshot: ${path}`)
  return path
}

async function loginStudent(browser) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  log('Student login...')

  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })

  // Navigate to login
  try {
    const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
    if (await loginLink.count() > 0) {
      await loginLink.click()
    } else {
      await page.evaluate(() => {
        history.pushState({}, '', '/login')
        dispatchEvent(new PopStateEvent('popstate'))
      })
    }
  } catch(e) {
    await page.evaluate(() => {
      history.pushState({}, '', '/login')
      dispatchEvent(new PopStateEvent('popstate'))
    })
  }

  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(STUDENT_EMAIL)
  await page.getByLabel(/password/i).first().fill(STUDENT_PASS)
  await page.getByLabel(/password/i).first().press('Enter')

  await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
    await page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first().click().catch(() => {})
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  })

  log('Student logged in, URL: ' + page.url())
  await screenshot(page, '01_student_dashboard')
  return { ctx, page }
}

async function loginTeacher(browser) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  log('Teacher login...')

  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })

  try {
    const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
    if (await loginLink.count() > 0) {
      await loginLink.click()
    } else {
      await page.evaluate(() => {
        history.pushState({}, '', '/login')
        dispatchEvent(new PopStateEvent('popstate'))
      })
    }
  } catch(e) {
    await page.evaluate(() => {
      history.pushState({}, '', '/login')
      dispatchEvent(new PopStateEvent('popstate'))
    })
  }

  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(TA_EMAIL)
  await page.getByLabel(/password/i).first().fill(TA_PASS)
  await page.getByLabel(/password/i).first().press('Enter')

  await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
    await page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first().click().catch(() => {})
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  })

  log('Teacher logged in, URL: ' + page.url())
  await screenshot(page, '05_teacher_dashboard')
  return { ctx, page }
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

async function main() {
  log('=== TA-CHALLENGE Audit Starting ===')

  // Pre-flight state capture
  const stateBeforeAll = await readPersonaState('BEFORE_ANY')

  const browser = await chromium.launch({
    headless: true,
    executablePath: EXEC_PATH,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '/ms-playwright' }
  })

  let studentCtx, teacherCtx
  let loginStudentOK = false
  let loginTeacherOK = false
  let challengeFiledWordId = null
  let challengeFiledWordId2 = null
  let acceptResult = null
  let rejectResult = null

  try {
    // ============================================================
    // STEP 1: Student files a challenge
    // ============================================================
    log('\n=== STEP 1: Student files a challenge ===')
    const { ctx: sCtx, page: sPage } = await loginStudent(browser)
    studentCtx = sCtx
    loginStudentOK = true

    // Navigate to gradebook / results
    // Try finding a "Grades" or "Gradebook" link
    log('Looking for Gradebook navigation...')
    await screenshot(sPage, '02_student_post_login')

    // Check current URL and page content
    const currentUrl = sPage.url()
    log('Current URL: ' + currentUrl)

    // Look for navigation links
    const allLinks = await sPage.evaluate(() => {
      return Array.from(document.querySelectorAll('a, button')).slice(0, 30).map(el => ({
        tag: el.tagName, text: el.textContent?.trim()?.slice(0, 50), href: el.href || ''
      }))
    })
    log('Page elements (first 30):', JSON.stringify(allLinks))

    // Try to navigate to gradebook
    // First check if there's a class card for CORE OFFLINE
    const coreOfflineLink = sPage.getByText(CLASS_NAME_PATTERN).first()
    if (await coreOfflineLink.count() > 0) {
      log('Found CORE OFFLINE class card')
      await screenshot(sPage, '03_student_class_visible')
    } else {
      log('CORE OFFLINE not found on dashboard, looking for class section')
      const pageContent = await sPage.evaluate(() => document.body.innerText.slice(0, 2000))
      log('Page text: ' + pageContent)
    }

    // Navigate to gradebook via URL (SPA routing should work)
    log('Navigating to gradebook...')
    await sPage.evaluate(() => {
      history.pushState({}, '', '/gradebook')
      dispatchEvent(new PopStateEvent('popstate'))
    })
    await sPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    await new Promise(r => setTimeout(r, 2000))

    const gradebookUrl = sPage.url()
    log('After gradebook nav, URL: ' + gradebookUrl)
    await screenshot(sPage, '04_student_gradebook')

    const gbContent = await sPage.evaluate(() => document.body.innerText.slice(0, 3000))
    log('Gradebook content: ' + gbContent.slice(0, 500))

    // Check if gradebook has attempt rows
    // Look for rows with "View" or "Written" (testType typed)
    const viewButtons = await sPage.getByRole('button', { name: /view|details/i }).count()
    log(`View buttons found: ${viewButtons}`)

    // Check for challenge-related text
    const pendingBadge = await sPage.getByText(/pending challenge/i).count()
    const challengeButtons = await sPage.getByRole('button', { name: /challenge/i }).count()
    log(`Pending challenge badges: ${pendingBadge}`)
    log(`Challenge buttons: ${challengeButtons}`)

    // Try clicking first attempt "View" button to see details
    if (viewButtons > 0) {
      log('Opening attempt details...')
      await sPage.getByRole('button', { name: /view|details/i }).first().click()
      await new Promise(r => setTimeout(r, 2000))
      await screenshot(sPage, '05_student_attempt_details_open')

      const detailsContent = await sPage.evaluate(() => document.body.innerText.slice(0, 5000))
      log('Details panel content: ' + detailsContent.slice(0, 500))

      // Look for Challenge button on an incorrect answer
      const challengeBtnsInDrawer = await sPage.getByRole('button', { name: /^challenge$/i }).count()
      log(`Challenge buttons in drawer: ${challengeBtnsInDrawer}`)

      if (challengeBtnsInDrawer > 0) {
        log('Challenge button found! Filing first challenge...')
        await sPage.getByRole('button', { name: /^challenge$/i }).first().click()
        await new Promise(r => setTimeout(r, 1000))
        await screenshot(sPage, '06_student_challenge_modal_open')

        // Get wordId from current state
        const modalContent = await sPage.evaluate(() => document.body.innerText.slice(0, 2000))
        log('Modal content: ' + modalContent.slice(0, 300))

        // Add a note and submit
        const noteInput = sPage.getByPlaceholder(/note|reason|explain/i).first()
        const textareaCount = await sPage.locator('textarea').count()
        log(`Textareas in modal: ${textareaCount}`)

        if (await noteInput.count() > 0) {
          await noteInput.fill('Audit test challenge - testing challenge review lifecycle')
        } else if (textareaCount > 0) {
          await sPage.locator('textarea').first().fill('Audit test challenge - testing challenge review lifecycle')
        }

        await screenshot(sPage, '07_student_challenge_note_filled')

        // Find submit button
        const submitBtn = sPage.getByRole('button', { name: /submit/i }).first()
        const submitCount = await submitBtn.count()
        log(`Submit buttons: ${submitCount}`)

        if (submitCount > 0) {
          await submitBtn.click()
          await new Promise(r => setTimeout(r, 3000))
          await screenshot(sPage, '08_student_challenge_submitted')

          const afterContent = await sPage.evaluate(() => document.body.innerText.slice(0, 3000))
          log('After submission: ' + afterContent.slice(0, 300))

          // Check for "Challenge Pending" text
          const pendingText = await sPage.getByText(/challenge pending/i).count()
          log(`"Challenge Pending" visible: ${pendingText}`)

          if (pendingText > 0) {
            log('SUCCESS: Challenge filed and showing as pending')
            challengeFiledWordId = 'filed_via_ui'
          } else {
            addFinding('High', 'Challenge submission unclear', 'Submitted challenge but no "Challenge Pending" badge visible in UI after submission')
          }
        } else {
          addFinding('High', 'No submit button in challenge modal', 'Challenge modal opened but no submit button found')
        }
      } else {
        // Check for "No tokens" or other blocking messages
        const noTokens = await sPage.getByText(/no tokens/i).count()
        const tokenText = await sPage.getByText(/token/i).all()
        for (const el of tokenText) {
          log('Token text: ' + await el.textContent())
        }

        if (noTokens > 0) {
          addFinding('Medium', 'Challenge tokens exhausted in UI', 'Student sees "No tokens available" despite DB showing 5 tokens')
        } else {
          addFinding('High', 'No Challenge button found in attempt details', 'No challenge button visible on incorrect answers in attempt details drawer')
        }
        await screenshot(sPage, '06_student_no_challenge_btn')
      }
    } else {
      // Maybe gradebook doesn't load for student, check page content
      const noData = await sPage.getByText(/no attempts|no tests|no results/i).count()
      log(`No data message: ${noData}`)
      addFinding('High', 'No view buttons in gradebook', 'Student gradebook shows no attempt rows with View buttons')
      await screenshot(sPage, '06_student_gradebook_empty')
    }

    // Try also navigating to challenge via TestResults page
    // The student results page is at /results or within session flow
    // Let's try the class-specific gradebook
    log('\nAttempting to navigate to class-specific gradebook...')
    await sPage.evaluate((classId) => {
      history.pushState({}, '', `/gradebook?classId=${classId}`)
      dispatchEvent(new PopStateEvent('popstate'))
    }, CLASS_ID)
    await new Promise(r => setTimeout(r, 3000))
    await screenshot(sPage, '09_student_class_gradebook')

    const classGbContent = await sPage.evaluate(() => document.body.innerText.slice(0, 5000))
    log('Class gradebook content: ' + classGbContent.slice(0, 1000))

    // Also try direct attempt lookup via hash/param
    const viewBtns2 = await sPage.getByRole('button', { name: /view|details/i }).count()
    log(`View buttons in class gradebook: ${viewBtns2}`)

    // State after challenge filing attempt
    const stateAfterFiling = await readPersonaState('AFTER_FILING')

    // ============================================================
    // STEP 2: Teacher reviews challenges
    // ============================================================
    log('\n=== STEP 2: Teacher reviews ===')
    await studentCtx.close()

    const { ctx: tCtx, page: tPage } = await loginTeacher(browser)
    teacherCtx = tCtx
    loginTeacherOK = true

    // Navigate to gradebook
    log('Navigating teacher to gradebook...')
    await tPage.evaluate(() => {
      history.pushState({}, '', '/gradebook')
      dispatchEvent(new PopStateEvent('popstate'))
    })
    await new Promise(r => setTimeout(r, 3000))
    await screenshot(tPage, '10_teacher_gradebook')

    const tGbContent = await tPage.evaluate(() => document.body.innerText.slice(0, 5000))
    log('Teacher gradebook: ' + tGbContent.slice(0, 500))

    // Look for class selector
    const classSelector = await tPage.getByText(CLASS_NAME_PATTERN).count()
    log(`CORE OFFLINE visible in teacher view: ${classSelector}`)

    // Look for pending challenge badges
    const pendingBadges = await tPage.getByText(/pending challenge/i).count()
    log(`Pending challenge badges in teacher view: ${pendingBadges}`)

    // Check for "Accept" and "Reject" buttons
    const acceptBtns = await tPage.getByRole('button', { name: /accept/i }).count()
    const rejectBtns = await tPage.getByRole('button', { name: /reject/i }).count()
    log(`Accept buttons: ${acceptBtns}, Reject buttons: ${rejectBtns}`)

    await screenshot(tPage, '11_teacher_challenge_view')

    // Navigate to class gradebook
    await tPage.evaluate((classId) => {
      history.pushState({}, '', `/gradebook?classId=${classId}`)
      dispatchEvent(new PopStateEvent('popstate'))
    }, CLASS_ID)
    await new Promise(r => setTimeout(r, 3000))
    await screenshot(tPage, '12_teacher_class_gradebook')

    const tClassGbContent = await tPage.evaluate(() => document.body.innerText.slice(0, 5000))
    log('Teacher class gradebook: ' + tClassGbContent.slice(0, 1000))

    const tViewBtns = await tPage.getByRole('button', { name: /view|details/i }).count()
    const tPendingBadges = await tPage.getByText(/pending challenge/i).count()
    log(`View buttons: ${tViewBtns}, Pending badges: ${tPendingBadges}`)

    // Record teacher challenge inbox findings
    if (tPendingBadges > 0) {
      log('SUCCESS: Teacher sees pending challenge badge(s)')
    } else {
      log('NOTE: No pending challenge badges visible (expected if student challenge was not filed)')
    }

    // Try to find the persona's attempt row and view it
    // Look for the audit persona student's name
    const personaRow = await tPage.getByText(/Audit Careful Student/i).count()
    log(`Persona name visible in teacher view: ${personaRow}`)

    if (tViewBtns > 0) {
      // Click view on first attempt with pending challenge if any
      if (tPendingBadges > 0) {
        // Find the row with pending challenge and click view
        const rows = await tPage.locator('tr, [data-row]').all()
        for (const row of rows) {
          const hasPending = await row.getByText(/pending challenge/i).count()
          if (hasPending > 0) {
            const viewBtn = await row.getByRole('button', { name: /view|details/i }).first()
            if (await viewBtn.count() > 0) {
              log('Opening attempt with pending challenge...')
              await viewBtn.click()
              await new Promise(r => setTimeout(r, 2000))
              break
            }
          }
        }
      } else {
        // Open first attempt
        await tPage.getByRole('button', { name: /view|details/i }).first().click()
        await new Promise(r => setTimeout(r, 2000))
      }

      await screenshot(tPage, '13_teacher_attempt_details')

      // Look for Accept/Reject buttons
      const acceptBtnsDrawer = await tPage.getByRole('button', { name: /accept/i }).count()
      const rejectBtnsDrawer = await tPage.getByRole('button', { name: /reject/i }).count()
      log(`Accept/Reject buttons in drawer: ${acceptBtnsDrawer}/${rejectBtnsDrawer}`)

      if (acceptBtnsDrawer > 0 || rejectBtnsDrawer > 0) {
        log('Challenge review UI found in teacher view!')

        // ACCEPT one challenge
        if (acceptBtnsDrawer > 0) {
          const stateBefore = await readPersonaState('BEFORE_ACCEPT')

          log('Clicking ACCEPT on first challenge...')
          await tPage.getByRole('button', { name: /accept/i }).first().click()
          await new Promise(r => setTimeout(r, 3000))
          await screenshot(tPage, '14_after_accept')

          const stateAfterAccept = await readPersonaState('AFTER_ACCEPT')

          // Verify score recalculation
          const oldScore = stateBefore.score
          const newScore = stateAfterAccept.score
          const oldCorrect = stateBefore.correctCount
          const newCorrect = stateAfterAccept.correctCount
          const totalQ = stateAfterAccept.totalQuestions

          log(`Score: ${oldScore} -> ${newScore} (expected: round(${newCorrect}/${totalQ}*100)=${Math.round(newCorrect/totalQ*100)})`)

          const expectedScore = Math.round(newCorrect / totalQ * 100)
          if (newScore !== expectedScore) {
            addFinding('Blocker', 'Score inflation on accept', `After accepting challenge: score=${newScore} but expected=${expectedScore} (${newCorrect}/${totalQ})`)
          } else {
            log('PASS: Score correctly recalculated after accept')
          }

          // Verify CSD did NOT incorrectly advance
          const oldCsd = stateBefore.csd
          const newCsd = stateAfterAccept.csd
          // studyDay=1, currentStudyDay=0 before. After accept of new-word test,
          // since score was 0 and now 4%, still below threshold (90%) - so CSD should NOT change
          log(`CSD: ${oldCsd} -> ${newCsd}`)

          // The attempt has studyDay=1, currentStudyDay=0, so it IS the current boundary
          // But score goes from 0% to 4% (1/25), still below 90% threshold
          // So CSD should not advance (score below threshold)
          if (newCsd !== oldCsd) {
            addFinding('High', 'CSD advanced incorrectly on accept', `CSD changed from ${oldCsd} to ${newCsd} after accepting challenge that did not push score past threshold`)
          } else {
            log('PASS: CSD correctly did not advance (score still below threshold)')
          }

          // Verify tokens (accept = no token cost)
          const oldTokens = stateBefore.availableTokens
          const newTokens = stateAfterAccept.availableTokens
          log(`Tokens: ${oldTokens} -> ${newTokens} (accept should cost 0 tokens)`)
          if (newTokens !== oldTokens) {
            addFinding('High', 'Token cost on accepted challenge', `Accepted challenge consumed a token: was ${oldTokens}, now ${newTokens}`)
          } else {
            log('PASS: Accepted challenge did not consume a token')
          }

          acceptResult = { oldScore, newScore, expectedScore, oldCsd, newCsd, oldTokens, newTokens, stateAfterAccept }
        }

        // REJECT another challenge if available
        const rejectBtnsAfterAccept = await tPage.getByRole('button', { name: /reject/i }).count()
        log(`Reject buttons remaining: ${rejectBtnsAfterAccept}`)

        if (rejectBtnsAfterAccept > 0) {
          const stateBefore2 = await readPersonaState('BEFORE_REJECT')

          log('Clicking REJECT on another challenge...')
          await tPage.getByRole('button', { name: /reject/i }).first().click()
          await new Promise(r => setTimeout(r, 3000))
          await screenshot(tPage, '15_after_reject')

          const stateAfterReject = await readPersonaState('AFTER_REJECT')

          // Verify reject = 30-day hold applied (token consumed)
          const oldTokens2 = stateBefore2.availableTokens
          const newTokens2 = stateAfterReject.availableTokens
          log(`Tokens: ${oldTokens2} -> ${newTokens2} (reject should cost 1 token via 30-day hold)`)

          if (newTokens2 >= oldTokens2) {
            addFinding('High', 'No token cost on rejected challenge', `Rejected challenge did not consume a token: was ${oldTokens2}, now ${newTokens2}`)
          } else {
            log('PASS: Rejected challenge consumed a token (30-day hold applied)')
          }

          // Verify CSD did NOT change on reject
          const oldCsd2 = stateBefore2.csd
          const newCsd2 = stateAfterReject.csd
          log(`CSD on reject: ${oldCsd2} -> ${newCsd2}`)
          if (newCsd2 !== oldCsd2) {
            addFinding('High', 'CSD changed on rejected challenge', `CSD changed from ${oldCsd2} to ${newCsd2} after rejecting challenge`)
          } else {
            log('PASS: CSD unchanged after reject')
          }

          // Score should not change on reject
          const oldScore2 = stateBefore2.score
          const newScore2 = stateAfterReject.score
          log(`Score on reject: ${oldScore2} -> ${newScore2} (should be same)`)
          if (newScore2 !== oldScore2) {
            addFinding('High', 'Score changed on rejected challenge', `Score changed from ${oldScore2} to ${newScore2} after rejecting challenge (should be unchanged)`)
          } else {
            log('PASS: Score unchanged after reject')
          }

          rejectResult = { oldTokens: oldTokens2, newTokens: newTokens2, oldCsd: oldCsd2, newCsd: newCsd2, stateAfterReject }
        } else {
          log('No reject buttons available (only 1 pending challenge was filed or all consumed)')
        }
      } else {
        log('No Accept/Reject buttons in attempt details - no pending challenges in this view')
        addFinding('Medium', 'Teacher cannot see challenge review UI', 'No Accept/Reject buttons visible in attempt details drawer even after student filed challenge')
      }
    }

    // STEP 3: Verify student-side reflection
    log('\n=== STEP 3: Student-side reflection check ===')
    await teacherCtx.close()

    const { ctx: sCtx2, page: sPage2 } = await loginStudent(browser)

    await sPage2.evaluate((classId) => {
      history.pushState({}, '', `/gradebook?classId=${classId}`)
      dispatchEvent(new PopStateEvent('popstate'))
    }, CLASS_ID)
    await new Promise(r => setTimeout(r, 3000))
    await screenshot(sPage2, '16_student_post_review_gradebook')

    // Check for "Challenge Accepted" or "Challenge Rejected" badges
    const acceptedBadge = await sPage2.getByText(/challenge accepted/i).count()
    const rejectedBadge = await sPage2.getByText(/challenge rejected/i).count()
    const pendingBadgeAfter = await sPage2.getByText(/challenge pending/i).count()
    log(`Post-review: accepted=${acceptedBadge}, rejected=${rejectedBadge}, pending=${pendingBadgeAfter}`)

    await screenshot(sPage2, '17_student_gradebook_after_review')

    if (acceptResult && acceptedBadge === 0) {
      // Check in attempt details
      const viewBtns3 = await sPage2.getByRole('button', { name: /view|details/i }).count()
      if (viewBtns3 > 0) {
        await sPage2.getByRole('button', { name: /view|details/i }).first().click()
        await new Promise(r => setTimeout(r, 2000))
        await screenshot(sPage2, '18_student_attempt_details_after_review')
        const acceptedInDrawer = await sPage2.getByText(/challenge accepted/i).count()
        log(`"Challenge Accepted" in drawer: ${acceptedInDrawer}`)
      }
    }

    await sCtx2.close()

  } catch (err) {
    log('ERROR: ' + err.message)
    log(err.stack)
    addFinding('Blocker', 'Audit script error', err.message)
  } finally {
    if (studentCtx) await studentCtx.close().catch(() => {})
    if (teacherCtx) await teacherCtx.close().catch(() => {})
    await browser.close()
  }

  // Final state
  let stateFinal
  try {
    stateFinal = await readPersonaState('FINAL')
  } catch(e) {
    log('Error reading final state: ' + e.message)
  }

  // Output results
  log('\n=== FINDINGS SUMMARY ===')
  findings.forEach(f => log(`[${f.severity}] ${f.title}: ${f.details}`))

  const result = {
    loginStudentOK,
    loginTeacherOK,
    challengeFiledWordId,
    acceptResult,
    rejectResult,
    stateBeforeAll,
    stateFinal,
    findings
  }

  writeFileSync(`${SCREENSHOTS_DIR}/audit_result.json`, JSON.stringify(result, null, 2))
  log(`\nAudit complete. Findings: ${findings.length}`)
  findings.forEach(f => log(`  [${f.severity}] ${f.title}`))

  process.exit(0)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
