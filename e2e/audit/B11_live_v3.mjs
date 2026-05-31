/**
 * B11 Live Browser Test v3 — Fix modal dismissal
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
  console.log('📸', name)
  return path
}

async function dismissCustomizeModal(page) {
  // The "Customize Your Flashcards" modal has "Start Studying" button
  const startStudying = page.getByRole('button', { name: /start studying/i })
  if (await startStudying.count() > 0) {
    console.log('Dismissing Customize Flashcards modal...')
    await startStudying.click()
    await page.waitForTimeout(1000)
    return true
  }
  return false
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  const consoleErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  const evidence = {}

  try {
    await loginAs(page, ANXIOUS_TOP)
    await screenshot(page, 'B11_v3_01_dashboard')

    // Start session
    await page.getByText('25WT 2차 TOP OFFLINE').first().waitFor({ timeout: 15000 })
    const startBtn = page.getByRole('button', { name: /start session/i }).first()
    await startBtn.click()
    await page.waitForTimeout(3000)
    await screenshot(page, 'B11_v3_02_after_start')

    // Dismiss the Customize Flashcards modal
    const dismissed = await dismissCustomizeModal(page)
    if (dismissed) {
      await page.waitForTimeout(2000)
      await screenshot(page, 'B11_v3_03_after_modal_dismiss')
    }

    console.log('URL:', page.url())

    // Now the session should be active - try Session Menu → Skip to Test
    // Use JS click to avoid intercept issues
    await page.evaluate(() => {
      const btn = document.querySelector('[aria-label="Session menu"]')
      if (btn) btn.click()
    })
    await page.waitForTimeout(1000)
    await screenshot(page, 'B11_v3_04_session_menu')

    const hasMenu = await page.getByText(/skip to test/i).count()
    console.log('Skip to Test visible:', hasMenu > 0)

    if (hasMenu > 0) {
      await page.getByText(/skip to test/i).click()
      await page.waitForTimeout(500)
      await screenshot(page, 'B11_v3_05_skip_confirm')

      // Confirm the skip dialog
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|skip/i }).first()
      if (await confirmBtn.count() > 0) {
        await confirmBtn.click()
      }
      await page.waitForTimeout(5000)
      await screenshot(page, 'B11_v3_06_test_screen')
      console.log('URL after skip:', page.url())

      // Check for test inputs
      const inputs = page.getByRole('textbox')
      const inputCount = await inputs.count()
      console.log('Test inputs:', inputCount)

      if (inputCount > 0) {
        // Fill all with wrong answers
        for (let i = 0; i < inputCount; i++) {
          await inputs.nth(i).click()
          await page.keyboard.type('zzz', { delay: 15 })
        }
        await screenshot(page, 'B11_v3_07_answers_filled')

        // Submit
        const submitBtn = page.getByRole('button', { name: /submit/i }).first()
        if (await submitBtn.count() > 0) {
          await submitBtn.click()
          await page.waitForTimeout(1000)

          // Handle submit confirmation
          const confirmSubmit = page.getByRole('button', { name: /confirm|yes/i }).first()
          if (await confirmSubmit.count() > 0) await confirmSubmit.click()

          await screenshot(page, 'B11_v3_08_after_submit')
          console.log('Waiting for Cloud Function grading (up to 120s)...')

          // Wait for results
          const gotResults = await page.waitForFunction(() => {
            const body = document.body.innerText
            return body.includes('Did not pass') || body.includes('Completed Day') || body.includes('Answers')
          }, { timeout: 120000 }).then(() => true).catch(() => false)

          await screenshot(page, 'B11_v3_09_results')
          console.log('Got results:', gotResults)

          if (gotResults) {
            // === S01: Results screen analysis ===
            const bodyText = await page.textContent('body')
            const hasDidNotPass = bodyText.includes('Did not pass')
            const hasCompleted = bodyText.includes('Completed Day')
            const scoreMatch = bodyText.match(/(\d+)%/)
            const hasAnswers = bodyText.includes('Answers')
            const challengeBtns = await page.getByRole('button', { name: /challenge/i }).count()
            const hasRetake = await page.getByRole('button', { name: /retake|try again|study again/i }).count() > 0
            const hasDashboard = await page.getByRole('button', { name: /go to dashboard|dashboard/i }).count() > 0

            // Score accuracy check
            const correctText = bodyText.match(/(\d+)\s+of\s+(\d+)\s+correct/)
            const correctCount = correctText ? parseInt(correctText[1]) : null
            const totalCount = correctText ? parseInt(correctText[2]) : null
            const displayedScore = scoreMatch ? parseInt(scoreMatch[1]) : null
            const calculatedScore = (correctCount !== null && totalCount > 0) ?
              Math.round(correctCount / totalCount * 100) : null
            const scoreAccurate = displayedScore !== null && calculatedScore !== null ?
              Math.abs(displayedScore - calculatedScore) <= 1 : null // allow 1% rounding

            console.log('=== S01: RESULTS SCREEN ===')
            console.log('hasDidNotPass:', hasDidNotPass)
            console.log('hasCompleted:', hasCompleted)
            console.log('Score shown:', scoreMatch?.[0])
            console.log('Correct:', correctCount, 'of', totalCount)
            console.log('Calculated score:', calculatedScore + '%')
            console.log('Score accurate:', scoreAccurate)
            console.log('hasAnswers:', hasAnswers)
            console.log('challengeBtns:', challengeBtns)
            console.log('hasRetake:', hasRetake)
            console.log('hasDashboard:', hasDashboard)

            evidence.S01 = {
              gotResults,
              hasDidNotPass,
              hasCompleted,
              displayedScore,
              correctCount,
              totalCount,
              calculatedScore,
              scoreAccurate,
              hasAnswers,
              challengeBtns,
              hasRetake,
              hasDashboard
            }
            writeFileSync(`${EVIDENCE_DIR}/B11_v3_S01_results.json`, JSON.stringify(evidence.S01, null, 2))

            // === S03: Challenge flow ===
            if (challengeBtns > 0) {
              console.log('\n=== S03: Challenge flow ===')

              const { initializeApp, cert, getApps } = await import('firebase-admin/app')
              const { getFirestore } = await import('firebase-admin/firestore')
              const sa = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'))
              if (!getApps().length) initializeApp({ credential: cert(sa) })
              const db = getFirestore()

              // Pre state
              const preUserDoc = await db.collection('users').doc(ANXIOUS_TOP.uid).get()
              const preHistory = preUserDoc.data()?.challenges?.history || []
              console.log('Pre-challenge history count:', preHistory.length)

              const latestAttempts = await db.collection('attempts')
                .where('studentId', '==', ANXIOUS_TOP.uid)
                .orderBy('submittedAt', 'desc')
                .limit(1)
                .get()
              const latestAttemptId = latestAttempts.empty ? null : latestAttempts.docs[0].id
              console.log('Latest attempt ID:', latestAttemptId)

              // Click first Challenge button
              const challengeBtn = page.getByRole('button', { name: /challenge/i }).first()
              await challengeBtn.click()
              await page.waitForTimeout(1000)
              await screenshot(page, 'B11_v3_S03_01_modal')

              // Check modal
              const modalOpen = await page.getByRole('button', { name: /submit challenge/i }).count() > 0
              console.log('Challenge modal open:', modalOpen)

              if (modalOpen) {
                // Add note
                const textarea = page.getByPlaceholder(/explain/i).first()
                if (await textarea.count() > 0) {
                  await textarea.fill('My answer captures the essential meaning. The AI grader was too strict.')
                }

                // Submit
                await page.getByRole('button', { name: /submit challenge/i }).click()
                await page.waitForTimeout(4000)
                await screenshot(page, 'B11_v3_S03_02_after_submit')

                // Check UI
                const pendingBadge = await page.getByText(/pending/i).count()
                console.log('Pending badge visible:', pendingBadge > 0)

                // Check Firestore
                await page.waitForTimeout(2000)

                const postUserDoc = await db.collection('users').doc(ANXIOUS_TOP.uid).get()
                const postHistory = postUserDoc.data()?.challenges?.history || []
                const historyGrew = postHistory.length > preHistory.length
                console.log('History grew:', historyGrew, preHistory.length + '->' + postHistory.length)

                let firestoreHasPending = false
                if (latestAttemptId) {
                  const attemptDoc = await db.collection('attempts').doc(latestAttemptId).get()
                  const attemptData = attemptDoc.data()
                  firestoreHasPending = attemptData?.answers?.some(a => a.challengeStatus === 'pending') || false

                  // Sample the challenged answers
                  const challengedAnswers = attemptData?.answers?.filter(a => a.challengeStatus === 'pending') || []
                  console.log('Answers with pending status in Firestore:', challengedAnswers.length)
                  if (challengedAnswers.length > 0) {
                    console.log('  Challenged word:', challengedAnswers[0].word)
                  }
                }
                console.log('Firestore has pending:', firestoreHasPending)

                evidence.S03 = {
                  pendingBadgeVisible: pendingBadge > 0,
                  challengeHistoryGrew: historyGrew,
                  firestoreHasPending,
                  preHistoryLength: preHistory.length,
                  postHistoryLength: postHistory.length,
                  latestAttemptId
                }
                writeFileSync(`${EVIDENCE_DIR}/B11_v3_S03_evidence.json`, JSON.stringify(evidence.S03, null, 2))

                // === S07: Navigate away and back ===
                console.log('\n=== S07: Pending persistence after nav ===')

                await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
                await page.waitForTimeout(3000)
                await screenshot(page, 'B11_v3_S07_01_dashboard')

                const pendingOnDash = await page.getByText(/pending/i).count()

                // Go back into session
                const startBtn2 = page.getByRole('button', { name: /start session/i }).first()
                if (await startBtn2.count() > 0) {
                  await startBtn2.click()
                  await page.waitForTimeout(3000)

                  // Dismiss customize modal if shown again
                  await dismissCustomizeModal(page)
                  await page.waitForTimeout(1000)

                  await screenshot(page, 'B11_v3_S07_02_back_in_session')
                  const pendingAfterReenter = await page.getByText(/pending/i).count()
                  const bodyAfterReenter = await page.textContent('body')
                  const hasResultsAfterReenter = bodyAfterReenter.includes('Answers') || bodyAfterReenter.includes('Did not pass')

                  console.log('Pending badges after reenter:', pendingAfterReenter)
                  console.log('Has results view after reenter:', hasResultsAfterReenter)

                  evidence.S07 = {
                    pendingOnDashboard: pendingOnDash > 0,
                    pendingBadgesAfterReenter: pendingAfterReenter,
                    hasResultsAfterReenter,
                    sessionPhase: bodyAfterReenter.includes('New Words') ? 'new_words' :
                                   bodyAfterReenter.includes('Did not pass') ? 'test_results' :
                                   bodyAfterReenter.includes('Ready for') ? 'ready_for_test' :
                                   'unknown'
                  }
                  writeFileSync(`${EVIDENCE_DIR}/B11_v3_S07_evidence.json`, JSON.stringify(evidence.S07, null, 2))
                }
              }
            }

            // === Check for retake button (B04-F01 verify) ===
            console.log('\n=== B04-F01 LIVE VERIFY: Retake button on fail ===')
            console.log('RESULT: hasRetake =', hasRetake, '| hasDashboard =', hasDashboard)
            if (hasDidNotPass && !hasRetake && hasDashboard) {
              console.log('CONFIRMED: B04-F01 reproduced - No retake on fail, only Go to Dashboard')
            }
          } else {
            console.log('Grading timed out or no results shown')
            const bodyText2 = await page.textContent('body')
            console.log('Page content (first 500 chars):', bodyText2.substring(0, 500))
          }
        }
      } else {
        console.log('No inputs on test screen')
        const bodyText = await page.textContent('body')
        console.log('Page:', bodyText.substring(0, 300))
      }
    } else {
      console.log('Session menu / Skip to Test not found')
      const bodyText = await page.textContent('body')
      console.log('Page:', bodyText.substring(0, 300))
    }

  } catch (err) {
    await screenshot(page, 'B11_v3_error').catch(() => {})
    console.error('Error:', err.message)
    evidence.error = err.message
  } finally {
    if (consoleErrors.length > 0) {
      writeFileSync(`${EVIDENCE_DIR}/B11_v3_console_errors.txt`, consoleErrors.join('\n'))
    }
    await ctx.close()
    await browser.close()
  }

  writeFileSync(`${EVIDENCE_DIR}/B11_v3_final_evidence.json`, JSON.stringify(evidence, null, 2))
  console.log('\n=== FINAL ===', JSON.stringify(evidence, null, 2))
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
