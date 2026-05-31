/**
 * B11 Live Browser Test — Results Screen + Challenge Flow
 * Focuses on: S01 (results screen), S03 (raise challenge), retake button check
 */

import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B11'
mkdirSync(EVIDENCE_DIR, { recursive: true })

const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
const ANXIOUS_TOP = seeded.accounts.find(a => a.personaId === 'anxious' && a.targetClass === 'TOP')

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
  console.log('Screenshot:', name)
  return path
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const evidence = {}

  try {
    // ===== S01: Navigate to results screen as anxious student =====
    console.log('\n=== S01: Typed test results screen ===')
    const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page1 = await ctx1.newPage()

    const consoleErrors = []
    page1.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    try {
      await loginAs(page1, ANXIOUS_TOP)
      await screenshot(page1, 'B11_S01_live_01_dashboard')

      // Wait for the class to appear
      await page1.getByText('25WT 2차 TOP OFFLINE').first().waitFor({ timeout: 15000 })
      await screenshot(page1, 'B11_S01_live_02_class_visible')

      // Look for Start/Continue button for the session
      const sessionArea = page1.locator('.space-y-4, [class*="session"], [class*="card"]').first()
      const buttons = page1.getByRole('button')
      const btnCount = await buttons.count()
      console.log('Buttons on dashboard:', btnCount)

      // Try to find the start button text
      const allBtnTexts = []
      for (let i = 0; i < Math.min(btnCount, 10); i++) {
        const text = await buttons.nth(i).textContent().catch(() => '')
        allBtnTexts.push(text.trim())
      }
      console.log('Button texts:', allBtnTexts)

      // Try clicking on the class area to navigate to session
      const topClass = page1.getByText('25WT 2차 TOP OFFLINE').first()

      // Look for a Start Session or View Session button near the class
      const startSessionBtn = page1.getByRole('button', { name: /start session|begin|start/i }).first()
      if (await startSessionBtn.count() > 0) {
        console.log('Found start session button')
        await startSessionBtn.click()
        await page1.waitForTimeout(3000)
        await screenshot(page1, 'B11_S01_live_03_after_start')
      } else {
        // Try clicking any button visible
        const continueBtn = page1.getByRole('button', { name: /continue/i }).first()
        const anyBtn = page1.getByRole('button').first()
        if (await continueBtn.count() > 0) {
          await continueBtn.click()
        } else {
          await anyBtn.click()
        }
        await page1.waitForTimeout(3000)
        await screenshot(page1, 'B11_S01_live_03_after_click')
      }

      const url1 = page1.url()
      console.log('Current URL:', url1)

      // Check if we're in a session or DailySessionFlow
      const pageText = await page1.textContent('body')
      const isInSession = url1.includes('/session') || pageText.includes('New Words') || pageText.includes('Ready for the Test')
      const hasSessionMenu = await page1.getByRole('button', { name: /session menu/i }).count() > 0
      console.log('isInSession:', isInSession, 'hasSessionMenu:', hasSessionMenu)

      if (hasSessionMenu) {
        await page1.getByRole('button', { name: /session menu/i }).click()
        await page1.waitForTimeout(500)
        await screenshot(page1, 'B11_S01_live_04_session_menu_open')

        // Find Skip to Test
        const skipToTest = page1.getByText(/skip to test/i)
        if (await skipToTest.count() > 0) {
          console.log('Found Skip to Test')
          await skipToTest.click()
          await page1.waitForTimeout(500)

          // Confirm
          const confirmBtn = page1.getByRole('button', { name: /confirm|yes|skip/i }).first()
          if (await confirmBtn.count() > 0) await confirmBtn.click()
          await page1.waitForTimeout(5000)
          await screenshot(page1, 'B11_S01_live_05_test_screen')

          const testUrl = page1.url()
          console.log('Test URL:', testUrl)

          // Fill in all inputs with garbage (to get wrong answers for challenging)
          const inputs = page1.getByRole('textbox')
          const inputCount = await inputs.count()
          console.log('Test inputs found:', inputCount)

          if (inputCount > 0) {
            // Type wrong answers
            for (let i = 0; i < inputCount; i++) {
              await inputs.nth(i).click()
              await page1.keyboard.type('wrong', { delay: 20 })
            }
            await screenshot(page1, 'B11_S01_live_06_answers_typed')

            // Submit
            const submitBtn = page1.getByRole('button', { name: /submit/i }).first()
            if (await submitBtn.count() > 0) {
              await submitBtn.click()
              await page1.waitForTimeout(1000)

              // Confirm dialog if shown
              const confirmSubmit = page1.getByRole('button', { name: /confirm|yes/i }).first()
              if (await confirmSubmit.count() > 0) await confirmSubmit.click()

              console.log('Waiting for grading... (up to 90s)')
              await screenshot(page1, 'B11_S01_live_07_submitted')

              // Wait for results
              await page1.waitForFunction(() => {
                const body = document.body.innerText
                return body.includes('Did not pass') || body.includes('Completed Day') || body.includes('Answers') || body.includes('Challenge')
              }, { timeout: 120000 }).catch(() => {
                console.log('Grading timeout - proceeding')
              })

              await screenshot(page1, 'B11_S01_live_08_results')
              const resultsUrl = page1.url()
              console.log('Results URL:', resultsUrl)

              // Check results screen elements
              const resultsBody = await page1.textContent('body')
              const hasDidNotPass = resultsBody.includes('Did not pass')
              const hasCompleted = resultsBody.includes('Completed Day')
              const hasScore = resultsBody.match(/\d+%/)
              const hasAnswersSection = resultsBody.includes('Answers')
              const hasChallengeBtn = await page1.getByRole('button', { name: /challenge/i }).count() > 0
              const hasRetakeBtn = await page1.getByRole('button', { name: /retake|try again|study again/i }).count() > 0
              const hasGoToDashboard = await page1.getByRole('button', { name: /go to dashboard|dashboard/i }).count() > 0

              console.log('Results check:')
              console.log('  hasDidNotPass:', hasDidNotPass)
              console.log('  hasCompleted:', hasCompleted)
              console.log('  hasScore:', hasScore?.[0])
              console.log('  hasAnswersSection:', hasAnswersSection)
              console.log('  hasChallengeBtn:', hasChallengeBtn)
              console.log('  hasRetakeBtn:', hasRetakeBtn)
              console.log('  hasGoToDashboard:', hasGoToDashboard)

              evidence.S01 = {
                hasDidNotPass,
                hasCompleted,
                hasScore: hasScore?.[0] || null,
                hasAnswersSection,
                hasChallengeBtn,
                hasRetakeBtn,
                hasGoToDashboard,
                url: resultsUrl
              }

              writeFileSync(`${EVIDENCE_DIR}/B11_S01_live_results.json`, JSON.stringify(evidence.S01, null, 2))

              // If challenge button exists, test the challenge flow (S03)
              if (hasChallengeBtn) {
                console.log('\n=== S03 inline: Challenge flow ===')

                // Get current challenge count in Firestore before challenge
                const { initializeApp, cert, getApps } = await import('firebase-admin/app')
                const { getFirestore } = await import('firebase-admin/firestore')
                const sa = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'))
                if (!getApps().length) initializeApp({ credential: cert(sa) })
                const db = getFirestore()

                const userDoc = await db.collection('users').doc(ANXIOUS_TOP.uid).get()
                const preHistory = userDoc.data()?.challenges?.history || []
                console.log('Pre-challenge history length:', preHistory.length)

                // Click Challenge on first wrong answer
                const challengeBtn = page1.getByRole('button', { name: /challenge/i }).first()
                await challengeBtn.click()
                await page1.waitForTimeout(500)
                await screenshot(page1, 'B11_S03_live_01_challenge_modal')

                // Check modal opened
                const modalTitle = await page1.getByText('Challenge').count()
                console.log('Modal opened:', modalTitle > 0)

                // Fill in note
                const textarea = page1.getByPlaceholder(/explain/i).first()
                if (await textarea.count() > 0) {
                  await textarea.fill('My answer was semantically correct — the AI grader was too strict.')
                }
                await screenshot(page1, 'B11_S03_live_02_note_filled')

                // Submit challenge
                const submitChallenge = page1.getByRole('button', { name: /submit challenge/i })
                if (await submitChallenge.count() > 0) {
                  await submitChallenge.click()
                  await page1.waitForTimeout(3000)
                  await screenshot(page1, 'B11_S03_live_03_after_submit')

                  // Check for Pending badge
                  const pendingBadge = await page1.getByText(/pending/i).count()
                  console.log('Pending badge visible:', pendingBadge > 0)

                  // Verify Firestore
                  await page1.waitForTimeout(2000)

                  // Get latest attempt from Firestore
                  const latestAttempts = await db.collection('attempts')
                    .where('studentId', '==', ANXIOUS_TOP.uid)
                    .orderBy('submittedAt', 'desc')
                    .limit(1)
                    .get()

                  let firestoreChallengePending = false
                  let challengeHistoryGrew = false
                  let latestAttemptId = null

                  if (!latestAttempts.empty) {
                    const latestData = latestAttempts.docs[0].data()
                    latestAttemptId = latestAttempts.docs[0].id
                    firestoreChallengePending = latestData.answers?.some(a => a.challengeStatus === 'pending') || false
                    console.log('Latest attempt ID:', latestAttemptId)
                    console.log('Firestore has pending challenge:', firestoreChallengePending)

                    // Save attempt with challenge
                    writeFileSync(`${EVIDENCE_DIR}/B11_S03_post_challenge_attempt.json`, JSON.stringify({
                      id: latestAttemptId,
                      score: latestData.score,
                      passed: latestData.passed,
                      answers: latestData.answers?.map(a => ({
                        word: a.word,
                        challengeStatus: a.challengeStatus,
                        isCorrect: a.isCorrect
                      }))
                    }, null, 2))
                  }

                  const postUserDoc = await db.collection('users').doc(ANXIOUS_TOP.uid).get()
                  const postHistory = postUserDoc.data()?.challenges?.history || []
                  challengeHistoryGrew = postHistory.length > preHistory.length
                  console.log('Challenge history grew:', challengeHistoryGrew, '(' + preHistory.length + ' → ' + postHistory.length + ')')

                  writeFileSync(`${EVIDENCE_DIR}/B11_S03_live_evidence.json`, JSON.stringify({
                    pendingBadgeVisible: pendingBadge > 0,
                    firestoreChallengePending,
                    challengeHistoryGrew,
                    preHistoryLength: preHistory.length,
                    postHistoryLength: postHistory.length,
                    latestAttemptId
                  }, null, 2))

                  evidence.S03 = {
                    pendingBadgeVisible: pendingBadge > 0,
                    firestoreChallengePending,
                    challengeHistoryGrew
                  }

                  // Now test S07: navigate away and check if pending badge persists
                  console.log('\n=== S07 inline: Navigate away and back ===')
                  await page1.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
                  await page1.waitForTimeout(2000)
                  await screenshot(page1, 'B11_S07_live_01_navigated_away')

                  // Can we get back to the results page?
                  // The results page is only accessible during an active test session
                  // After navigating away, we can't return to the same test results page
                  // This is the key S07 question: does pending state persist?

                  // Navigate back to dashboard and check if any results/history is shown
                  const currentUrl = page1.url()
                  console.log('After nav-away URL:', currentUrl)

                  // Check if any pending challenge indicators appear on dashboard
                  const pendingOnDashboard = await page1.getByText(/pending/i).count()
                  console.log('Pending badges on dashboard (after nav):', pendingOnDashboard)
                  await screenshot(page1, 'B11_S07_live_02_dashboard_after_nav')

                  // Try to go back to the session to see results
                  const startBtn2 = page1.getByRole('button', { name: /start|continue|resume/i }).first()
                  if (await startBtn2.count() > 0) {
                    await startBtn2.click()
                    await page1.waitForTimeout(3000)
                    await screenshot(page1, 'B11_S07_live_03_back_in_session')

                    // The DailySessionFlow will show the current phase
                    // Since we just finished a test, it might show results or move to next phase
                    const sessionBody = await page1.textContent('body')
                    const hasAnswersSection = sessionBody.includes('Answers')
                    const hasPendingInSession = await page1.getByText(/pending/i).count()

                    console.log('hasAnswersSection after re-enter:', hasAnswersSection)
                    console.log('pendingBadges after re-enter session:', hasPendingInSession)

                    evidence.S07 = {
                      pendingOnDashboard: pendingOnDashboard > 0,
                      hasAnswersSectionAfterReenter: hasAnswersSection,
                      pendingBadgesAfterReenter: hasPendingInSession,
                      verdict: hasPendingInSession > 0 ? 'PASS - pending persists' : 'LIKELY FAIL - no pending badge visible after nav'
                    }
                    writeFileSync(`${EVIDENCE_DIR}/B11_S07_live_evidence.json`, JSON.stringify(evidence.S07, null, 2))
                  }
                }
              }
            }
          }
        }
      }

      // Capture any console errors
      if (consoleErrors.length > 0) {
        writeFileSync(`${EVIDENCE_DIR}/B11_live_console_errors.txt`, consoleErrors.join('\n'))
        console.log('Console errors captured:', consoleErrors.length)
      }
    } catch (err) {
      await screenshot(page1, 'B11_live_error').catch(() => {})
      console.error('Live test error:', err.message)
      evidence.error = err.message
    } finally {
      await ctx1.close()
    }

    // Save full evidence
    writeFileSync(`${EVIDENCE_DIR}/B11_live_summary.json`, JSON.stringify(evidence, null, 2))

    console.log('\n=== Live Test Evidence Summary ===')
    console.log(JSON.stringify(evidence, null, 2))

  } finally {
    await browser.close()
  }
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
