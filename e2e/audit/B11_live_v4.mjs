/**
 * B11 Live Browser Test v4 — Direct TypedTest navigation
 * The anxious student needs to do flashcards first, then Skip to Test will work
 * OR we can navigate directly to /typedtest/ after session storage is set
 */

import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B11'
mkdirSync(EVIDENCE_DIR, { recursive: true })

const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
const ANXIOUS_TOP = seeded.accounts.find(a => a.personaId === 'anxious' && a.targetClass === 'TOP')
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
const LIST_ID = '8RMews2H7C3UJUAsOBzR'

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

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  const consoleErrors = []
  const networkErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
    if (msg.type() === 'log') {
      const text = msg.text()
      if (text.includes('DEBUG') || text.includes('navigateToTest') || text.includes('phase')) {
        console.log('Browser log:', text.substring(0, 200))
      }
    }
  })

  const evidence = {}

  try {
    await loginAs(page, ANXIOUS_TOP)
    await screenshot(page, 'B11_v4_01_dashboard')

    // Start session to warm up state
    await page.getByText('25WT 2차 TOP OFFLINE').first().waitFor({ timeout: 15000 })
    const startBtn = page.getByRole('button', { name: /start session/i }).first()
    await startBtn.click()
    await page.waitForTimeout(3000)

    // Dismiss Customize Flashcards modal with "Start Studying"
    const startStudying = page.getByRole('button', { name: /start studying/i })
    if (await startStudying.count() > 0) {
      await startStudying.click()
      await page.waitForTimeout(2000)
    }

    await screenshot(page, 'B11_v4_02_session_flashcards')
    console.log('Current URL:', page.url())

    // Now we're in the flashcard phase (Step 1 of N)
    // Dismiss ALL flashcards rapidly using keyboard "I Know" (press C or click I Know)
    // Let's check what's on screen
    const pageText = await page.textContent('body')
    const hasFlashcards = pageText.includes('I Know') || pageText.includes('Don\'t Know')
    console.log('Has flashcards:', hasFlashcards)

    if (hasFlashcards) {
      // Rapidly dismiss cards using "I Know" button
      let cardsLeft = true
      let cardCount = 0
      const maxCards = 100

      while (cardsLeft && cardCount < maxCards) {
        const iKnowBtn = page.getByRole('button', { name: /i know/i }).first()
        const hasiKnow = await iKnowBtn.count() > 0

        if (hasiKnow) {
          await iKnowBtn.click({ force: true })
          cardCount++
          if (cardCount % 10 === 0) console.log('Dismissed', cardCount, 'cards...')
          await page.waitForTimeout(100)
        } else {
          // Check if we've reached a different phase
          const currentText = await page.textContent('body')
          const onTest = currentText.includes('Submit') || currentText.includes('Your Answer')
          const onReady = currentText.includes('Ready for the Test')
          console.log('No I Know button. onTest:', onTest, 'onReady:', onReady)

          if (onReady) {
            // Click Ready for Test
            const readyBtn = page.getByRole('button', { name: /ready|start test|take test/i }).first()
            if (await readyBtn.count() > 0) {
              await readyBtn.click()
              await page.waitForTimeout(3000)
            }
          }
          cardsLeft = false
        }
      }
      console.log('Total cards dismissed:', cardCount)
    }

    await screenshot(page, 'B11_v4_03_after_flashcards')
    console.log('URL after flashcards:', page.url())

    // Now try Session Menu -> Skip to Test
    const sessionMenuBtn = await page.evaluate(() => {
      const btn = document.querySelector('[aria-label="Session menu"]')
      return btn ? true : false
    })
    console.log('Session menu exists in DOM:', sessionMenuBtn)

    if (sessionMenuBtn) {
      // Click via evaluate to avoid overlay issues
      await page.evaluate(() => {
        document.querySelector('[aria-label="Session menu"]').click()
      })
      await page.waitForTimeout(1000)
      await screenshot(page, 'B11_v4_04_session_menu_open')

      const menuText = await page.textContent('body')
      console.log('Skip to Test visible:', menuText.includes('Skip to Test'))

      if (menuText.includes('Skip to Test')) {
        // Find and click Skip to Test
        await page.evaluate(() => {
          // Find the button or span containing "Skip to Test"
          const spans = Array.from(document.querySelectorAll('span, button'))
          const skipSpan = spans.find(el => el.textContent.includes('Skip to Test'))
          if (skipSpan) skipSpan.click()
        })
        await page.waitForTimeout(1000)
        await screenshot(page, 'B11_v4_05_skip_confirm')

        // Confirm
        const confirmBtn = page.getByRole('button', { name: /confirm|yes/i }).first()
        if (await confirmBtn.count() > 0) {
          await confirmBtn.click()
          await page.waitForTimeout(3000)
        }

        await screenshot(page, 'B11_v4_06_after_confirm')
        console.log('URL after confirm:', page.url())
      }
    }

    // After Skip to Test, should navigate to /typedtest/...
    // Wait for navigation
    await page.waitForURL(/typedtest/, { timeout: 15000 }).catch(() => {
      console.log('URL did not change to /typedtest/ - current:', page.url())
    })

    await screenshot(page, 'B11_v4_07_test_url')
    console.log('Final URL:', page.url())

    // Check for text inputs
    const inputs = page.getByRole('textbox')
    const inputCount = await inputs.count()
    console.log('Text inputs:', inputCount)

    const currentPage = await page.textContent('body')
    console.log('Page excerpt:', currentPage.substring(0, 300))

    // If we're not on a test yet, check what phase we're on
    if (inputCount === 0) {
      const hasReadyForTest = currentPage.includes('Ready for the Test') || currentPage.includes('Start Test')
      const hasResults = currentPage.includes('Did not pass') || currentPage.includes('Completed Day')

      if (hasReadyForTest) {
        const readyBtn = page.getByRole('button', { name: /ready|start test|start/i }).first()
        if (await readyBtn.count() > 0) {
          await readyBtn.click()
          await page.waitForTimeout(3000)
          await screenshot(page, 'B11_v4_08_after_ready')
        }
      } else if (hasResults) {
        console.log('Already on results screen!')
      }
    }

    // Try again to get inputs
    const inputs2 = page.getByRole('textbox')
    const inputCount2 = await inputs2.count()
    console.log('Text inputs after any nav:', inputCount2)

    if (inputCount2 > 0) {
      // We're on the typed test! Fill all with wrong answers.
      console.log('On typed test! Filling', inputCount2, 'inputs with wrong answers...')
      for (let i = 0; i < inputCount2; i++) {
        await inputs2.nth(i).click()
        await page.keyboard.type('xyz', { delay: 15 })
      }
      await screenshot(page, 'B11_v4_09_filled')

      // Submit
      const submitBtn = page.getByRole('button', { name: /submit/i }).first()
      if (await submitBtn.count() > 0) {
        await submitBtn.click()
        await page.waitForTimeout(1000)

        const confirmBtn = page.getByRole('button', { name: /confirm|yes/i }).first()
        if (await confirmBtn.count() > 0) await confirmBtn.click()

        await screenshot(page, 'B11_v4_10_submitted')
        console.log('Waiting for grading (up to 90s)...')

        const gotResults = await page.waitForFunction(() => {
          const body = document.body.innerText
          return body.includes('Did not pass') || body.includes('Completed Day') || body.includes('Answers')
        }, { timeout: 90000 }).then(() => true).catch(() => false)

        await screenshot(page, 'B11_v4_11_results')
        console.log('Got results:', gotResults)

        if (gotResults) {
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
          const calcScore = (correctCount !== null && totalCount > 0) ?
            Math.round(correctCount / totalCount * 100) : null

          console.log('=== S01 RESULTS ANALYSIS ===')
          console.log('Did not pass:', hasDidNotPass)
          console.log('Completed Day:', hasCompleted)
          console.log('Score:', scoreMatch?.[0])
          console.log('Correct:', correctCount, 'of', totalCount)
          console.log('Calculated:', calcScore + '%')
          console.log('Score accurate:', displayedScore !== null && calcScore !== null ? Math.abs(displayedScore - calcScore) <= 1 : 'N/A')
          console.log('Answers section:', hasAnswers)
          console.log('Challenge buttons:', challengeBtns)
          console.log('Retake button:', hasRetake)
          console.log('Dashboard button:', hasDashboard)

          evidence.S01 = {
            didNotPass: hasDidNotPass,
            completed: hasCompleted,
            displayedScore,
            correctCount,
            totalCount,
            calculatedScore: calcScore,
            scoreAccurate: displayedScore !== null && calcScore !== null ? Math.abs(displayedScore - calcScore) <= 1 : null,
            hasAnswers,
            challengeBtns,
            hasRetake,
            hasDashboard,
            url: page.url()
          }

          writeFileSync(`${EVIDENCE_DIR}/B11_v4_S01.json`, JSON.stringify(evidence.S01, null, 2))

          // === S03: Challenge flow ===
          if (challengeBtns > 0) {
            console.log('\n=== S03: Challenge flow ===')

            const { initializeApp, cert, getApps } = await import('firebase-admin/app')
            const { getFirestore } = await import('firebase-admin/firestore')
            const sa = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'))
            if (!getApps().length) initializeApp({ credential: cert(sa) })
            const db = getFirestore()

            const preUserDoc = await db.collection('users').doc(ANXIOUS_TOP.uid).get()
            const preHistory = preUserDoc.data()?.challenges?.history || []
            console.log('Pre-challenge history:', preHistory.length)

            const latestAttempts = await db.collection('attempts')
              .where('studentId', '==', ANXIOUS_TOP.uid)
              .orderBy('submittedAt', 'desc')
              .limit(1)
              .get()
            const latestAttemptId = latestAttempts.empty ? null : latestAttempts.docs[0].id
            console.log('Latest attempt ID:', latestAttemptId)

            // Click first Challenge button
            await page.getByRole('button', { name: /challenge/i }).first().click()
            await page.waitForTimeout(1000)
            await screenshot(page, 'B11_v4_S03_01_modal')

            const modalOpen = await page.getByRole('button', { name: /submit challenge/i }).count() > 0
            console.log('Modal open:', modalOpen)

            if (modalOpen) {
              const textarea = page.getByPlaceholder(/explain/i).first()
              if (await textarea.count() > 0) {
                await textarea.fill('I believe my answer is essentially correct. Please reconsider.')
              }
              await screenshot(page, 'B11_v4_S03_02_note')

              await page.getByRole('button', { name: /submit challenge/i }).click()
              await page.waitForTimeout(4000)
              await screenshot(page, 'B11_v4_S03_03_submitted')

              const pendingBadge = await page.getByText(/pending/i).count()
              console.log('Pending badge visible:', pendingBadge > 0)

              // Verify Firestore
              await page.waitForTimeout(2000)

              const postUserDoc = await db.collection('users').doc(ANXIOUS_TOP.uid).get()
              const postHistory = postUserDoc.data()?.challenges?.history || []
              const historyGrew = postHistory.length > preHistory.length
              console.log('History grew:', historyGrew, preHistory.length + '->' + postHistory.length)

              let firestoreHasPending = false
              if (latestAttemptId) {
                const attemptDoc = await db.collection('attempts').doc(latestAttemptId).get()
                const data = attemptDoc.data()
                firestoreHasPending = data?.answers?.some(a => a.challengeStatus === 'pending') || false
                console.log('Firestore pending:', firestoreHasPending)

                const pendingAnswers = data?.answers?.filter(a => a.challengeStatus === 'pending') || []
                console.log('Pending answers:', pendingAnswers.map(a => a.word))

                writeFileSync(`${EVIDENCE_DIR}/B11_v4_S03_attempt.json`, JSON.stringify({
                  id: latestAttemptId,
                  score: data?.score,
                  passed: data?.passed,
                  answers: data?.answers?.map(a => ({
                    word: a.word,
                    isCorrect: a.isCorrect,
                    challengeStatus: a.challengeStatus
                  }))
                }, null, 2))
              }

              evidence.S03 = {
                pendingBadgeVisible: pendingBadge > 0,
                challengeHistoryGrew: historyGrew,
                firestoreHasPending,
                preHistoryLength: preHistory.length,
                postHistoryLength: postHistory.length,
                atomicityVerdict: (historyGrew && firestoreHasPending) ? 'BOTH WRITES SUCCEEDED' :
                                   (!historyGrew && !firestoreHasPending) ? 'BOTH WRITES FAILED' :
                                   (historyGrew && !firestoreHasPending) ? 'GHOST DEPLETION - B23-F01 CONFIRMED' :
                                   'PARTIAL'
              }
              writeFileSync(`${EVIDENCE_DIR}/B11_v4_S03.json`, JSON.stringify(evidence.S03, null, 2))
              console.log('S03 verdict:', evidence.S03.atomicityVerdict)

              // === S07: Nav away persistence ===
              console.log('\n=== S07: Pending persistence after nav ===')
              const resultsUrl = page.url()

              await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
              await page.waitForTimeout(3000)
              await screenshot(page, 'B11_v4_S07_01_dashboard')

              const pendingOnDash = await page.getByText(/pending/i).count()
              console.log('Pending on dashboard:', pendingOnDash)

              // Re-enter session
              const startBtn2 = page.getByRole('button', { name: /start session/i }).first()
              if (await startBtn2.count() > 0) {
                await startBtn2.click()
                await page.waitForTimeout(4000)

                // Dismiss modal if shown
                const startStudying2 = page.getByRole('button', { name: /start studying/i })
                if (await startStudying2.count() > 0) {
                  await startStudying2.click()
                  await page.waitForTimeout(1000)
                }

                await screenshot(page, 'B11_v4_S07_02_back_in_session')
                const pendingAfterReenter = await page.getByText(/pending/i).count()
                const sessionBody = await page.textContent('body')
                const hasResults = sessionBody.includes('Answers') || sessionBody.includes('Did not pass') || sessionBody.includes('Completed Day')
                const currentPhase = sessionBody.includes('I Know') ? 'flashcards' :
                                      sessionBody.includes('Answers') ? 'test_results' :
                                      sessionBody.includes('Ready for') ? 'ready' :
                                      sessionBody.includes('Submit') ? 'test' : 'unknown'

                console.log('After re-enter: phase =', currentPhase, '| pending badges =', pendingAfterReenter)

                // Key question: if we're back on results, are pending badges shown?
                // TestResults.jsx initializes challengedWords as empty Set() on mount
                // So after nav-away and back, pending badges would ONLY show if:
                // 1. We read challenge state from Firestore on mount, OR
                // 2. We're using the same component instance (in-memory)

                evidence.S07 = {
                  pendingOnDashboard: pendingOnDash > 0,
                  pendingAfterReenter,
                  currentPhaseAfterReenter: currentPhase,
                  hasResultsView: hasResults,
                  verdict: pendingAfterReenter > 0 ? 'PASS - pending survives nav' :
                            currentPhase === 'test_results' && pendingAfterReenter === 0 ?
                              'FAIL - pending badge lost after nav even though Firestore has it' :
                              'INCONCLUSIVE - not on results view after reenter'
                }
                writeFileSync(`${EVIDENCE_DIR}/B11_v4_S07.json`, JSON.stringify(evidence.S07, null, 2))
                console.log('S07 verdict:', evidence.S07.verdict)
              }
            } else {
              console.log('Challenge modal did not open')
            }
          } else {
            console.log('No challenge buttons on results screen')
          }
        }
      }
    } else {
      console.log('No test inputs found - cannot run typed test')
      const bodyText = await page.textContent('body')
      console.log('Current state:', bodyText.substring(0, 500))
      evidence.blocked = 'No typed test inputs found'
    }

  } catch (err) {
    await screenshot(page, 'B11_v4_error').catch(() => {})
    console.error('Error:', err.message)
    evidence.error = err.message
  } finally {
    if (consoleErrors.length > 0) {
      writeFileSync(`${EVIDENCE_DIR}/B11_v4_console_errors.txt`, consoleErrors.join('\n'))
    }
    await ctx.close()
    await browser.close()
  }

  writeFileSync(`${EVIDENCE_DIR}/B11_v4_final.json`, JSON.stringify(evidence, null, 2))
  console.log('\n=== FINAL EVIDENCE ===')
  console.log(JSON.stringify(evidence, null, 2))
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
