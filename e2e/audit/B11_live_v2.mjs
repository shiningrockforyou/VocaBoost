/**
 * B11 Live Browser Test v2 — Handle modal blocking, get to test and results
 */

import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B11'
mkdirSync(EVIDENCE_DIR, { recursive: true })

const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
const ANXIOUS_TOP = seeded.accounts.find(a => a.personaId === 'anxious' && a.targetClass === 'TOP')

console.log('Using account:', ANXIOUS_TOP.email)

async function loginAs(page, account) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
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
}

async function screenshot(page, name) {
  const path = `${EVIDENCE_DIR}/${name}.png`
  await page.screenshot({ path, fullPage: true })
  console.log('📸', name)
  return path
}

async function dismissAnyModal(page) {
  // Check for any blocking modals and dismiss them
  const modals = await page.locator('.fixed.inset-0').count()
  if (modals > 0) {
    console.log('Modal detected, attempting to dismiss...')

    // Try pressing Escape
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Check if still there
    const remaining = await page.locator('.fixed.inset-0').count()
    if (remaining > 0) {
      // Try clicking outside / Close button
      const closeBtn = page.getByRole('button', { name: /close|cancel|x|dismiss/i }).first()
      if (await closeBtn.count() > 0) await closeBtn.click()
      await page.waitForTimeout(500)
    }

    // Try clicking "Later" or "No thanks" or similar
    const laterBtn = page.getByRole('button', { name: /later|no thanks|skip|not now/i }).first()
    if (await laterBtn.count() > 0) {
      await laterBtn.click()
      await page.waitForTimeout(500)
    }

    // If "Customize" modal - dismiss it
    const customizeClose = page.getByRole('button', { name: /close/i }).first()
    if (await customizeClose.count() > 0) await customizeClose.click()
    await page.waitForTimeout(500)
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  const consoleErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
      console.log('Console error:', msg.text().substring(0, 100))
    }
  })

  const evidence = {}

  try {
    await loginAs(page, ANXIOUS_TOP)
    await screenshot(page, 'B11_v2_01_dashboard')

    // Navigate to session
    await page.getByText('25WT 2차 TOP OFFLINE').first().waitFor({ timeout: 15000 })

    const startBtn = page.getByRole('button', { name: /start session/i }).first()
    await startBtn.click()
    await page.waitForTimeout(3000)
    await screenshot(page, 'B11_v2_02_session_entered')

    console.log('URL after start:', page.url())

    // Check what's blocking
    const fixedElements = await page.locator('.fixed.inset-0').count()
    console.log('Fixed overlay elements:', fixedElements)

    if (fixedElements > 0) {
      // Get modal content
      const modalText = await page.locator('.fixed.inset-0').first().textContent()
      console.log('Modal text:', modalText.substring(0, 200))
      await screenshot(page, 'B11_v2_02b_modal')

      // Dismiss the modal
      await dismissAnyModal(page)
      await page.waitForTimeout(1000)
      await screenshot(page, 'B11_v2_02c_after_dismiss')
    }

    // Now try to access the Session Menu button
    const sessionMenuBtn = page.getByRole('button', { name: /session menu/i })
    const sessionMenuCount = await sessionMenuBtn.count()
    console.log('Session menu button count:', sessionMenuCount)

    if (sessionMenuCount > 0) {
      // Force click using JS to bypass any overlay
      await page.evaluate(() => {
        const btn = document.querySelector('[aria-label="Session menu"]')
        if (btn) btn.click()
      })
      await page.waitForTimeout(1000)
      await screenshot(page, 'B11_v2_03_session_menu')

      const menuText = await page.textContent('body')
      console.log('Has Skip to Test:', menuText.includes('Skip to Test'))

      // Click Skip to Test
      const skipItem = page.getByText(/skip to test/i)
      if (await skipItem.count() > 0) {
        await skipItem.click()
        await page.waitForTimeout(1000)

        // Confirm dialog
        await screenshot(page, 'B11_v2_04_skip_confirm')
        const confirmBtn = page.getByRole('button', { name: /confirm|yes|skip/i }).first()
        if (await confirmBtn.count() > 0) {
          await confirmBtn.click()
          await page.waitForTimeout(3000)
        }

        await screenshot(page, 'B11_v2_05_test_screen')
        console.log('URL after skip:', page.url())

        // Check for inputs
        const inputs = page.getByRole('textbox')
        const inputCount = await inputs.count()
        console.log('Text inputs on test screen:', inputCount)

        if (inputCount > 0) {
          // Type all wrong answers
          console.log('Typing wrong answers in', inputCount, 'inputs...')
          for (let i = 0; i < inputCount; i++) {
            await inputs.nth(i).click()
            await page.keyboard.type('xyz', { delay: 20 })
          }
          await screenshot(page, 'B11_v2_06_answers_filled')

          // Submit
          const submitBtn = page.getByRole('button', { name: /submit/i }).first()
          if (await submitBtn.count() > 0) {
            await submitBtn.click()
            await page.waitForTimeout(1000)

            // Handle confirmation
            const confirmSubmitBtn = page.getByRole('button', { name: /confirm|yes/i }).first()
            if (await confirmSubmitBtn.count() > 0) {
              await confirmSubmitBtn.click()
            }

            await screenshot(page, 'B11_v2_07_after_submit')
            console.log('Waiting for Cloud Function grading (up to 120s)...')

            // Wait for results
            const gotResults = await page.waitForFunction(() => {
              const body = document.body.innerText
              return body.includes('Did not pass') || body.includes('Completed Day') || body.includes('Answers')
            }, { timeout: 120000 }).then(() => true).catch(() => false)

            await screenshot(page, 'B11_v2_08_results')
            console.log('Got results:', gotResults)

            // Parse results
            const bodyText = await page.textContent('body')
            const hasDidNotPass = bodyText.includes('Did not pass')
            const hasCompleted = bodyText.includes('Completed Day')
            const scoreMatch = bodyText.match(/(\d+)%/)
            const hasAnswers = bodyText.includes('Answers')
            const hasChallengeBtn = await page.getByRole('button', { name: /challenge/i }).count() > 0
            const hasRetakeBtn = await page.getByRole('button', { name: /retake|try again|study again/i }).count() > 0
            const hasDashboardBtn = await page.getByRole('button', { name: /go to dashboard|dashboard/i }).count() > 0

            console.log('=== S01 RESULTS ===')
            console.log('Did not pass shown:', hasDidNotPass)
            console.log('Completed Day shown:', hasCompleted)
            console.log('Score %:', scoreMatch?.[0])
            console.log('Answers section:', hasAnswers)
            console.log('Challenge button:', hasChallengeBtn)
            console.log('Retake button:', hasRetakeBtn)
            console.log('Go to Dashboard button:', hasDashboardBtn)

            evidence.S01 = {
              gotResults,
              hasDidNotPass,
              hasCompleted,
              score: scoreMatch?.[0],
              hasAnswers,
              hasChallengeBtn,
              hasRetakeBtn,
              hasDashboardBtn
            }

            writeFileSync(`${EVIDENCE_DIR}/B11_v2_S01_results.json`, JSON.stringify(evidence.S01, null, 2))

            // === S03: Challenge flow ===
            if (hasChallengeBtn && gotResults) {
              console.log('\n=== S03: Challenge flow ===')

              // Import Firebase admin
              const { initializeApp, cert, getApps } = await import('firebase-admin/app')
              const { getFirestore } = await import('firebase-admin/firestore')
              const sa = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'))
              if (!getApps().length) initializeApp({ credential: cert(sa) })
              const db = getFirestore()

              // Pre-challenge state
              const preUserDoc = await db.collection('users').doc(ANXIOUS_TOP.uid).get()
              const preHistory = preUserDoc.data()?.challenges?.history || []
              console.log('Pre-challenge history count:', preHistory.length)

              // Get current attempt ID from Firestore
              const latestAttempts = await db.collection('attempts')
                .where('studentId', '==', ANXIOUS_TOP.uid)
                .orderBy('submittedAt', 'desc')
                .limit(1)
                .get()

              const latestAttemptId = latestAttempts.empty ? null : latestAttempts.docs[0].id
              console.log('Latest attempt ID:', latestAttemptId)

              // Check token count shown in UI (if any)
              const tokenText = bodyText.match(/(\d+)\s*token/i)
              console.log('Token text in UI:', tokenText?.[0])

              // Click Challenge button
              const challengeBtn = page.getByRole('button', { name: /challenge/i }).first()
              await challengeBtn.click()
              await page.waitForTimeout(1000)
              await screenshot(page, 'B11_v2_S03_01_modal_open')

              // Check modal content
              const modalText = await page.textContent('body')
              const modalOpen = modalText.includes('Submit Challenge')
              console.log('Challenge modal open:', modalOpen)

              // Check what word is shown in modal
              const wordInModal = await page.locator('p.text-lg, h3').first().textContent().catch(() => '')
              console.log('Word in modal:', wordInModal)

              // Fill note
              const textarea = page.getByPlaceholder(/explain/i).first()
              if (await textarea.count() > 0) {
                await textarea.fill('This definition is correct because the word means essentially the same thing. Please review.')
              }
              await screenshot(page, 'B11_v2_S03_02_note_filled')

              // Submit
              const submitChallengeBtn = page.getByRole('button', { name: /submit challenge/i })
              if (await submitChallengeBtn.count() > 0) {
                await submitChallengeBtn.click()
                await page.waitForTimeout(3000)
                await screenshot(page, 'B11_v2_S03_03_after_submit')

                // Check UI for Pending badge
                const pendingBadge = await page.getByText(/pending/i).count()
                console.log('Pending badge visible:', pendingBadge > 0)

                // Verify Firestore
                await page.waitForTimeout(2000)

                // Check user doc - history
                const postUserDoc = await db.collection('users').doc(ANXIOUS_TOP.uid).get()
                const postHistory = postUserDoc.data()?.challenges?.history || []
                const historyGrew = postHistory.length > preHistory.length

                // Check attempt doc - pending status
                let firestoreHasPending = false
                if (latestAttemptId) {
                  const attemptDoc = await db.collection('attempts').doc(latestAttemptId).get()
                  const attemptData = attemptDoc.data()
                  firestoreHasPending = attemptData?.answers?.some(a => a.challengeStatus === 'pending') || false
                  writeFileSync(`${EVIDENCE_DIR}/B11_v2_S03_attempt_post.json`, JSON.stringify({
                    id: latestAttemptId,
                    answers: attemptData?.answers?.map(a => ({
                      word: a.word,
                      challengeStatus: a.challengeStatus,
                      isCorrect: a.isCorrect
                    }))
                  }, null, 2))
                }

                console.log('=== S03 RESULTS ===')
                console.log('History grew:', historyGrew, preHistory.length, '->', postHistory.length)
                console.log('Firestore has pending:', firestoreHasPending)
                console.log('UI shows pending badge:', pendingBadge > 0)

                evidence.S03 = {
                  pendingBadgeVisible: pendingBadge > 0,
                  challengeHistoryGrew: historyGrew,
                  firestoreHasPending,
                  preHistoryLength: preHistory.length,
                  postHistoryLength: postHistory.length,
                  latestAttemptId
                }

                writeFileSync(`${EVIDENCE_DIR}/B11_v2_S03_evidence.json`, JSON.stringify(evidence.S03, null, 2))

                // === S07: Navigate away and check persistence ===
                console.log('\n=== S07: Pending badge persistence after navigation ===')

                // Save the current URL (results page)
                const resultsUrl = page.url()
                console.log('Results URL:', resultsUrl)

                // Navigate to dashboard
                await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
                await page.waitForTimeout(3000)
                await screenshot(page, 'B11_v2_S07_01_dashboard')

                // Check if any pending indicators on dashboard
                const pendingOnDash = await page.getByText(/pending/i).count()
                console.log('Pending on dashboard:', pendingOnDash)

                // Navigate back to session
                const startBtn2 = page.getByRole('button', { name: /start session/i }).first()
                if (await startBtn2.count() > 0) {
                  await startBtn2.click()
                  await page.waitForTimeout(3000)
                  await screenshot(page, 'B11_v2_S07_02_back_in_session')

                  // Dismiss any modal
                  await dismissAnyModal(page)
                  await page.waitForTimeout(1000)

                  const sessionBodyText = await page.textContent('body')
                  const pendingInSession = await page.getByText(/pending/i).count()
                  const hasResultsInSession = sessionBodyText.includes('Answers') || sessionBodyText.includes('Did not pass')

                  console.log('Back in session - pending badges:', pendingInSession)
                  console.log('Back in session - has results view:', hasResultsInSession)
                  await screenshot(page, 'B11_v2_S07_03_session_state')

                  evidence.S07 = {
                    pendingOnDashboard: pendingOnDash > 0,
                    pendingBadgesAfterReenter: pendingInSession,
                    hasResultsViewAfterReenter: hasResultsInSession,
                    verdict: pendingInSession > 0 ? 'PASS' : 'FAIL - pending badge gone after navigation'
                  }

                  writeFileSync(`${EVIDENCE_DIR}/B11_v2_S07_evidence.json`, JSON.stringify(evidence.S07, null, 2))
                }
              }
            }
          }
        } else {
          console.log('No text inputs found - may not be on test screen')
          const pageText = await page.textContent('body')
          console.log('Page text excerpt:', pageText.substring(0, 500))
        }
      }
    } else {
      console.log('Session menu button not found')
      const pageText = await page.textContent('body')
      console.log('Page text:', pageText.substring(0, 300))
    }

  } catch (err) {
    await screenshot(page, 'B11_v2_error').catch(() => {})
    console.error('Error:', err.message)
    evidence.error = err.message
  } finally {
    if (consoleErrors.length > 0) {
      writeFileSync(`${EVIDENCE_DIR}/B11_v2_console_errors.txt`, consoleErrors.join('\n'))
    }
    await ctx.close()
    await browser.close()
  }

  console.log('\n=== FINAL EVIDENCE ===')
  console.log(JSON.stringify(evidence, null, 2))

  writeFileSync(`${EVIDENCE_DIR}/B11_v2_final_evidence.json`, JSON.stringify(evidence, null, 2))
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
