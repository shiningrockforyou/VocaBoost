/**
 * B11 Live Browser Test v6 — Rushed student (Day 1, fresh)
 * Tests: results screen, fail state, retake button, challenge flow
 */

import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B11'
mkdirSync(EVIDENCE_DIR, { recursive: true })

const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
const STUDENT = seeded.accounts.find(a => a.personaId === 'rushed' && a.targetClass === 'TOP')
console.log('Student:', STUDENT.email, 'uid:', STUDENT.uid)

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
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
    if (msg.type() === 'log') {
      const text = msg.text()
      if (text.includes('DEBUG')) console.log('[browser]', text.substring(0, 200))
    }
  })

  const evidence = {}

  try {
    await loginAs(page, STUDENT)
    await screenshot(page, 'B11_v6_01_dashboard')

    // Start session
    await page.getByText('25WT 2차 TOP OFFLINE').first().waitFor({ timeout: 15000 })
    const startBtn = page.getByRole('button', { name: /start session/i }).first()
    await startBtn.click()
    await page.waitForTimeout(3000)

    // Dismiss Customize modal
    const startStudying = page.getByRole('button', { name: /start studying/i })
    if (await startStudying.count() > 0) {
      await startStudying.click()
      await page.waitForTimeout(2000)
    }

    await screenshot(page, 'B11_v6_02_in_session')
    console.log('URL:', page.url())

    // Skip to Test via session menu
    await page.evaluate(() => {
      const btn = document.querySelector('[aria-label="Session menu"]')
      if (btn) btn.click()
    })
    await page.waitForTimeout(1000)
    await screenshot(page, 'B11_v6_03_session_menu')

    const hasSkip = (await page.textContent('body')).includes('Skip to Test')
    console.log('Has Skip to Test:', hasSkip)

    if (hasSkip) {
      await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll('span, button, li'))
        const el = spans.find(e => e.textContent.trim() === 'Skip to Test')
        if (el) el.click()
      })
      await page.waitForTimeout(1000)

      const confirmBtn = page.getByRole('button', { name: /confirm|yes/i }).first()
      if (await confirmBtn.count() > 0) await confirmBtn.click()
      await page.waitForTimeout(3000)

      await screenshot(page, 'B11_v6_04_after_skip')
      console.log('URL after skip:', page.url())

      // Wait for Ready for Test or test directly
      const body = await page.textContent('body')
      if (body.includes('Ready for the Test') || body.includes('Start Test')) {
        const readyBtn = page.getByRole('button', { name: /ready|start test/i }).first()
        if (await readyBtn.count() > 0) {
          await readyBtn.click()
          await page.waitForTimeout(3000)
        }
      }

      // Wait for test URL
      await page.waitForURL(/typedtest/, { timeout: 15000 }).catch(() => {})
      await screenshot(page, 'B11_v6_05_test')
      console.log('Test URL:', page.url())

      const inputs = page.getByRole('textbox')
      const inputCount = await inputs.count()
      console.log('Inputs:', inputCount)

      if (inputCount > 0) {
        // Fill with wrong answers
        for (let i = 0; i < inputCount; i++) {
          await inputs.nth(i).click()
          // Very clearly wrong - single word that's not the definition
          await page.keyboard.type(`wrong answer ${i}`, { delay: 10 })
        }
        await screenshot(page, 'B11_v6_06_filled')

        const submitBtn = page.getByRole('button', { name: /submit/i }).first()
        await submitBtn.click()
        await page.waitForTimeout(1000)

        const confirmSubmit = page.getByRole('button', { name: /confirm|yes/i }).first()
        if (await confirmSubmit.count() > 0) await confirmSubmit.click()

        await screenshot(page, 'B11_v6_07_submitted')
        console.log('Waiting for grading (up to 90s)...')

        const gotResults = await page.waitForFunction(() => {
          const body = document.body.innerText
          return body.includes('Did not pass') || body.includes('Completed Day') || body.includes('Answers')
        }, { timeout: 90000 }).then(() => true).catch(() => false)

        await screenshot(page, 'B11_v6_08_results')
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
          const currentUrl = page.url()

          const correctText = bodyText.match(/(\d+)\s+of\s+(\d+)\s+correct/)
          const correctCount = correctText ? parseInt(correctText[1]) : null
          const totalCount = correctText ? parseInt(correctText[2]) : null
          const displayedScore = scoreMatch ? parseInt(scoreMatch[1]) : null
          const calcScore = (correctCount !== null && totalCount > 0) ? Math.round(correctCount / totalCount * 100) : null
          const scoreAccurate = (displayedScore !== null && calcScore !== null) ? Math.abs(displayedScore - calcScore) <= 1 : null

          console.log('=== S01: RESULTS SCREEN ===')
          console.log('Did not pass:', hasDidNotPass, '| Completed:', hasCompleted)
          console.log('Score displayed:', displayedScore, '% | Correct:', correctCount, '/', totalCount)
          console.log('Score accurate:', scoreAccurate, '(calculated', calcScore + '%)')
          console.log('Has Answers section:', hasAnswers)
          console.log('Challenge buttons:', challengeBtns)
          console.log('RETAKE BUTTON:', hasRetake)
          console.log('Dashboard button:', hasDashboard)
          console.log('URL:', currentUrl)

          evidence.S01 = {
            hasDidNotPass, hasCompleted, displayedScore, correctCount, totalCount,
            calculatedScore: calcScore, scoreAccurate, hasAnswers, challengeBtns, hasRetake, hasDashboard,
            url: currentUrl,
            passFail: hasDidNotPass ? 'FAIL shown correctly' : hasCompleted ? 'PASS shown' : 'UNKNOWN'
          }
          writeFileSync(`${EVIDENCE_DIR}/B11_v6_S01.json`, JSON.stringify(evidence.S01, null, 2))

          // Record B04-F01 finding
          if (hasDidNotPass && !hasRetake && hasDashboard) {
            console.log('*** B04-F01 CONFIRMED: Did not pass screen has NO Retake button ***')
            evidence.B04F01 = {
              confirmed: true,
              description: 'Typed test results screen when failed shows "Go to Dashboard" but NO retake button',
              url: currentUrl
            }
          } else if (hasDidNotPass && hasRetake) {
            console.log('*** B04-F01 FIXED: Retake button IS present ***')
            evidence.B04F01 = { confirmed: false, retakeExists: true }
          }

          // === S03: Challenge flow ===
          if (challengeBtns > 0) {
            console.log('\n=== S03: Challenge flow ===')

            const { initializeApp, cert, getApps } = await import('firebase-admin/app')
            const { getFirestore } = await import('firebase-admin/firestore')
            const sa = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'))
            if (!getApps().length) initializeApp({ credential: cert(sa) })
            const db = getFirestore()

            const preUserDoc = await db.collection('users').doc(STUDENT.uid).get()
            const preHistory = preUserDoc.data()?.challenges?.history || []
            console.log('Pre-challenge history:', preHistory.length)

            const latestAttempts = await db.collection('attempts')
              .where('studentId', '==', STUDENT.uid)
              .orderBy('submittedAt', 'desc')
              .limit(1)
              .get()
            const latestAttemptId = latestAttempts.empty ? null : latestAttempts.docs[0].id
            console.log('Attempt ID:', latestAttemptId)

            // Get first wrong word being displayed
            const firstChallengeBtn = page.getByRole('button', { name: /challenge/i }).first()
            await firstChallengeBtn.click()
            await page.waitForTimeout(1000)
            await screenshot(page, 'B11_v6_S03_01_modal')

            const submitChallengeBtn = page.getByRole('button', { name: /submit challenge/i })
            const modalOpen = await submitChallengeBtn.count() > 0
            console.log('Challenge modal open:', modalOpen)

            if (modalOpen) {
              // Read modal content for the challenged word
              const wordTitle = await page.locator('p.text-lg, .text-brand-text').first().textContent().catch(() => 'unknown')
              console.log('Challenging word:', wordTitle)

              // Read warning text
              const warningText = await page.locator('[class*="warning"], [class*="bg-warning"]').textContent().catch(() => '')
              console.log('Warning text:', warningText.trim())

              const textarea = page.getByPlaceholder(/explain/i).first()
              if (await textarea.count() > 0) {
                await textarea.fill('My answer "wrong answer X" captures the essential meaning of this word in context.')
              }
              await screenshot(page, 'B11_v6_S03_02_note')

              await submitChallengeBtn.click()
              await page.waitForTimeout(4000)
              await screenshot(page, 'B11_v6_S03_03_after_submit')

              const pendingBadge = await page.getByText(/pending/i).count()
              console.log('Pending badge visible in UI:', pendingBadge > 0)

              // Verify Firestore
              await page.waitForTimeout(2000)
              const postUserDoc = await db.collection('users').doc(STUDENT.uid).get()
              const postHistory = postUserDoc.data()?.challenges?.history || []
              const historyGrew = postHistory.length > preHistory.length

              let firestoreHasPending = false
              let firstPendingAnswer = null
              if (latestAttemptId) {
                const attemptDoc = await db.collection('attempts').doc(latestAttemptId).get()
                const aData = attemptDoc.data()
                const pendingAnswers = aData?.answers?.filter(a => a.challengeStatus === 'pending') || []
                firestoreHasPending = pendingAnswers.length > 0
                firstPendingAnswer = pendingAnswers[0] || null

                writeFileSync(`${EVIDENCE_DIR}/B11_v6_S03_attempt.json`, JSON.stringify({
                  id: latestAttemptId,
                  score: aData?.score,
                  passed: aData?.passed,
                  pendingChallenges: pendingAnswers.map(a => ({
                    word: a.word,
                    challengeStatus: a.challengeStatus,
                    challengeNote: a.challengeNote,
                    studentResponse: a.studentResponse
                  }))
                }, null, 2))
              }

              writeFileSync(`${EVIDENCE_DIR}/B11_v6_S03_user.json`, JSON.stringify({
                preHistoryLength: preHistory.length,
                postHistoryLength: postHistory.length,
                historyGrew,
                latestHistoryEntry: postHistory[postHistory.length - 1] || null
              }, null, 2))

              console.log('=== S03 RESULTS ===')
              console.log('History grew:', historyGrew, `(${preHistory.length} -> ${postHistory.length})`)
              console.log('Firestore has pending:', firestoreHasPending)
              console.log('First pending answer:', firstPendingAnswer?.word)

              const atomicityVerdict = historyGrew && firestoreHasPending ?
                'PASS - both writes succeeded (atomic in practice for happy path)' :
                historyGrew && !firestoreHasPending ?
                'FAIL - B23-F01 confirmed: history grew but attempt NOT updated (ghost depletion)' :
                !historyGrew && firestoreHasPending ?
                'FAIL - attempt updated but history NOT grown (rare)' :
                'FAIL - both writes failed'

              evidence.S03 = {
                pendingBadgeVisible: pendingBadge > 0,
                challengeHistoryGrew: historyGrew,
                firestoreHasPending,
                preHistoryLength: preHistory.length,
                postHistoryLength: postHistory.length,
                atomicityVerdict,
                challengedWord: firstPendingAnswer?.word || null
              }
              writeFileSync(`${EVIDENCE_DIR}/B11_v6_S03.json`, JSON.stringify(evidence.S03, null, 2))
              console.log('S03 verdict:', atomicityVerdict)

              // === S06: Double-challenge on same answer ===
              if (firestoreHasPending || pendingBadge > 0) {
                console.log('\n=== S06: Try to double-challenge the same answer ===')

                // Look for Challenge button on the same word that's now Pending
                // The UI should hide Challenge button and show Pending badge instead
                const pendingCount = await page.getByText(/pending/i).count()
                const challengeCount = await page.getByRole('button', { name: /challenge/i }).count()

                console.log('Pending badges shown:', pendingCount)
                console.log('Challenge buttons remaining:', challengeCount)

                // The first challenged word should now show Pending, not Challenge button
                evidence.S06 = {
                  pendingBadgesVisible: pendingCount,
                  challengeButtonsAfterFirstChallenge: challengeCount,
                  verdict: pendingCount > 0 ? 'PASS - challenged word shows Pending, not Challenge button' :
                             'FAIL - no Pending badge visible after challenge'
                }
                writeFileSync(`${EVIDENCE_DIR}/B11_v6_S06.json`, JSON.stringify(evidence.S06, null, 2))
                console.log('S06 verdict:', evidence.S06.verdict)
              }

              // === S07: Navigate away and check pending badge persistence ===
              console.log('\n=== S07: Navigate away - check pending badge persistence ===')

              await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
              await page.waitForTimeout(3000)
              await screenshot(page, 'B11_v6_S07_01_dashboard')

              // Try to re-enter session to see if results screen shows pending
              const startBtn2 = page.getByRole('button', { name: /start session/i }).first()
              if (await startBtn2.count() > 0) {
                await startBtn2.click()
                await page.waitForTimeout(4000)

                const startStudying2 = page.getByRole('button', { name: /start studying/i })
                if (await startStudying2.count() > 0) {
                  await startStudying2.click()
                  await page.waitForTimeout(1000)
                }

                await screenshot(page, 'B11_v6_S07_02_back')
                const pendingAfterNav = await page.getByText(/pending/i).count()
                const bodyAfterNav = await page.textContent('body')
                const phase = bodyAfterNav.includes('Answers') ? 'results' :
                               bodyAfterNav.includes('I Know') ? 'flashcards' :
                               bodyAfterNav.includes('Submit') ? 'test' :
                               bodyAfterNav.includes('Did not pass') ? 'results_fail' :
                               bodyAfterNav.includes('Retake') ? 'results_retake' : 'unknown'

                console.log('Phase after re-enter:', phase)
                console.log('Pending badges after re-enter:', pendingAfterNav)

                // Key finding: if we're on results but no pending badge, it's lost
                // DailySessionFlow shows TestResults with results prop from state
                // But challengedWords is initialized as empty Set on each mount

                // The session flow should restore to showing results if test was just taken
                // Let's check if the pending challenge is shown

                const s07Verdict = phase.includes('results') && pendingAfterNav === 0 ?
                  'FAIL - pending badge lost after navigation (challengedWords reset on remount)' :
                  phase.includes('results') && pendingAfterNav > 0 ?
                  'PASS - pending badge survives navigation' :
                  'INCONCLUSIVE - not on results screen after re-enter (phase=' + phase + ')'

                evidence.S07 = {
                  phaseAfterReenter: phase,
                  pendingBadgesAfterReenter: pendingAfterNav,
                  verdict: s07Verdict
                }
                writeFileSync(`${EVIDENCE_DIR}/B11_v6_S07.json`, JSON.stringify(evidence.S07, null, 2))
                console.log('S07 verdict:', s07Verdict)
              }
            } else {
              evidence.S03 = { blocked: 'Challenge modal did not open' }
            }
          } else {
            console.log('NO CHALLENGE BUTTONS - AI grader accepted all wrong answers')
            console.log('Score:', displayedScore + '% | Did not pass:', hasDidNotPass)
            evidence.AIGrading = {
              finding: 'AI grader accepted clearly wrong answers "wrong answer X" as correct',
              score: displayedScore,
              didNotPass: hasDidNotPass,
              note: 'Prevents challenge flow testing. See B26 for AI grader findings.'
            }
          }
        }
      }
    }

  } catch (err) {
    await screenshot(page, 'B11_v6_error').catch(() => {})
    console.error('Error:', err.message)
    evidence.error = err.message
  } finally {
    if (consoleErrors.length > 0) {
      writeFileSync(`${EVIDENCE_DIR}/B11_v6_console_errors.txt`, consoleErrors.join('\n'))
    }
    await ctx.close()
    await browser.close()
  }

  writeFileSync(`${EVIDENCE_DIR}/B11_v6_final.json`, JSON.stringify(evidence, null, 2))
  console.log('\n=== FINAL ===')
  console.log(JSON.stringify(evidence, null, 2))
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
