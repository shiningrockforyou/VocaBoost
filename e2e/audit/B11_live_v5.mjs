/**
 * B11 Live Browser Test v5 — Lazy student (fresh) → fail test → challenge flow
 * Uses lazy_TOP student who has no attempts yet
 */

import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B11'
mkdirSync(EVIDENCE_DIR, { recursive: true })

const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
const LAZY_TOP = seeded.accounts.find(a => a.personaId === 'lazy' && a.targetClass === 'TOP')
console.log('Lazy student:', LAZY_TOP.email, 'uid:', LAZY_TOP.uid)

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
      if (text.includes('DEBUG') || text.includes('navigate')) console.log('[browser]', text.substring(0, 150))
    }
  })

  const evidence = {}

  try {
    await loginAs(page, LAZY_TOP)
    await screenshot(page, 'B11_v5_01_dashboard')

    // Start session
    await page.getByText('25WT 2차 TOP OFFLINE').first().waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: /start session/i }).first().click()
    await page.waitForTimeout(3000)

    // Dismiss Customize Flashcards modal
    const startStudying = page.getByRole('button', { name: /start studying/i })
    if (await startStudying.count() > 0) {
      await startStudying.click()
      await page.waitForTimeout(2000)
    }

    await screenshot(page, 'B11_v5_02_in_session')
    console.log('URL in session:', page.url())

    // Open session menu via JS (avoids overlay issues)
    await page.evaluate(() => {
      const btn = document.querySelector('[aria-label="Session menu"]')
      if (btn) btn.click()
    })
    await page.waitForTimeout(1000)
    await screenshot(page, 'B11_v5_03_session_menu')

    const menuText = await page.textContent('body')
    const hasSkip = menuText.includes('Skip to Test')
    console.log('Skip to Test visible:', hasSkip)

    if (hasSkip) {
      await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll('span, button, li'))
        const el = spans.find(e => e.textContent.trim() === 'Skip to Test')
        if (el) el.click()
      })
      await page.waitForTimeout(1000)
      await screenshot(page, 'B11_v5_04_confirm')

      const confirmBtn = page.getByRole('button', { name: /confirm|yes/i }).first()
      if (await confirmBtn.count() > 0) {
        await confirmBtn.click()
        await page.waitForTimeout(3000)
      }

      await screenshot(page, 'B11_v5_05_after_confirm')
      console.log('URL after confirm:', page.url())

      // The DailySessionFlow sets state and navigates; wait for navigation or Ready modal
      await page.waitForTimeout(2000)

      // Check if we need to click "Ready for Test"
      const body1 = await page.textContent('body')
      if (body1.includes('Ready for the Test') || body1.includes('Start Test')) {
        const readyBtn = page.getByRole('button', { name: /ready|start test/i }).first()
        if (await readyBtn.count() > 0) {
          await readyBtn.click()
          await page.waitForTimeout(3000)
        }
      }

      // Wait for test URL
      await page.waitForURL(/typedtest/, { timeout: 15000 }).catch(() => console.log('URL not changed to typedtest'))
      await screenshot(page, 'B11_v5_06_test_screen')
      console.log('Final URL:', page.url())

      const inputs = page.getByRole('textbox')
      const inputCount = await inputs.count()
      console.log('Test inputs:', inputCount)

      if (inputCount > 0) {
        // Fill with lazy answers — "idk" style (clearly wrong/empty)
        // But type each individually so they're submitted
        // The lazy persona skips 50% — but for testing, we fill ALL with wrong answers
        // to ensure some are wrong and we can challenge
        for (let i = 0; i < inputCount; i++) {
          await inputs.nth(i).click()
          // Type clearly wrong answers - not empty (empty might be special case)
          await page.keyboard.type('idk', { delay: 20 })
        }
        await screenshot(page, 'B11_v5_07_answers_filled')

        const submitBtn = page.getByRole('button', { name: /submit/i }).first()
        if (await submitBtn.count() > 0) {
          await submitBtn.click()
          await page.waitForTimeout(1000)

          const confirmSubmit = page.getByRole('button', { name: /confirm|yes/i }).first()
          if (await confirmSubmit.count() > 0) await confirmSubmit.click()

          await screenshot(page, 'B11_v5_08_submitted')
          console.log('Waiting for grading (up to 90s)...')

          const gotResults = await page.waitForFunction(() => {
            const body = document.body.innerText
            return body.includes('Did not pass') || body.includes('Completed Day') || body.includes('Answers')
          }, { timeout: 90000 }).then(() => true).catch(() => false)

          await screenshot(page, 'B11_v5_09_results')
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

            // Score accuracy
            const correctText = bodyText.match(/(\d+)\s+of\s+(\d+)\s+correct/)
            const correctCount = correctText ? parseInt(correctText[1]) : null
            const totalCount = correctText ? parseInt(correctText[2]) : null
            const displayedScore = scoreMatch ? parseInt(scoreMatch[1]) : null
            const calcScore = (correctCount !== null && totalCount > 0) ? Math.round(correctCount / totalCount * 100) : null
            const scoreAccurate = (displayedScore !== null && calcScore !== null) ? Math.abs(displayedScore - calcScore) <= 1 : null

            console.log('=== S01 RESULTS (Lazy TOP) ===')
            console.log('Did not pass:', hasDidNotPass, '| Completed:', hasCompleted)
            console.log('Score:', scoreMatch?.[0], '| Correct:', correctCount, 'of', totalCount)
            console.log('Score accurate:', scoreAccurate)
            console.log('Answers section:', hasAnswers)
            console.log('Challenge buttons:', challengeBtns)
            console.log('Retake button:', hasRetake, '| Dashboard:', hasDashboard)

            evidence.S01 = {
              hasDidNotPass, hasCompleted, displayedScore, correctCount, totalCount,
              calculatedScore: calcScore, scoreAccurate, hasAnswers, challengeBtns, hasRetake, hasDashboard
            }
            writeFileSync(`${EVIDENCE_DIR}/B11_v5_S01.json`, JSON.stringify(evidence.S01, null, 2))

            // === S03: Challenge flow (only if there are challenge buttons = wrong answers) ===
            if (challengeBtns > 0) {
              console.log('\n=== S03: Challenge flow ===')

              const { initializeApp, cert, getApps } = await import('firebase-admin/app')
              const { getFirestore } = await import('firebase-admin/firestore')
              const sa = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'))
              if (!getApps().length) initializeApp({ credential: cert(sa) })
              const db = getFirestore()

              const preUserDoc = await db.collection('users').doc(LAZY_TOP.uid).get()
              const preHistory = preUserDoc.data()?.challenges?.history || []
              console.log('Pre-challenge history:', preHistory.length)

              const latestAttempts = await db.collection('attempts')
                .where('studentId', '==', LAZY_TOP.uid)
                .orderBy('submittedAt', 'desc')
                .limit(1)
                .get()
              const latestAttemptId = latestAttempts.empty ? null : latestAttempts.docs[0].id
              console.log('Attempt ID:', latestAttemptId)

              // Click first Challenge button
              await page.getByRole('button', { name: /challenge/i }).first().click()
              await page.waitForTimeout(1000)
              await screenshot(page, 'B11_v5_S03_01_modal')

              const submitChallengeBtn = page.getByRole('button', { name: /submit challenge/i })
              const modalOpen = await submitChallengeBtn.count() > 0
              console.log('Modal open:', modalOpen)

              if (modalOpen) {
                // Note the word being challenged
                const wordInModal = await page.locator('p.text-lg').first().textContent().catch(() => '')
                console.log('Word being challenged:', wordInModal)

                // Fill note
                const textarea = page.getByPlaceholder(/explain/i).first()
                if (await textarea.count() > 0) {
                  await textarea.fill('idk means I understand it roughly — please accept this.')
                }
                await screenshot(page, 'B11_v5_S03_02_note_filled')

                // Submit challenge
                await submitChallengeBtn.click()
                await page.waitForTimeout(4000)
                await screenshot(page, 'B11_v5_S03_03_after_submit')

                const pendingBadge = await page.getByText(/pending/i).count()
                console.log('Pending badge visible:', pendingBadge > 0)

                // Firestore check
                await page.waitForTimeout(2000)
                const postUserDoc = await db.collection('users').doc(LAZY_TOP.uid).get()
                const postHistory = postUserDoc.data()?.challenges?.history || []
                const historyGrew = postHistory.length > preHistory.length
                console.log('History grew:', historyGrew, preHistory.length + '->' + postHistory.length)

                let firestoreHasPending = false
                if (latestAttemptId) {
                  const attemptDoc = await db.collection('attempts').doc(latestAttemptId).get()
                  const aData = attemptDoc.data()
                  firestoreHasPending = aData?.answers?.some(a => a.challengeStatus === 'pending') || false
                  console.log('Firestore pending:', firestoreHasPending)

                  // Token count check
                  const challengeHist = postUserDoc.data()?.challenges?.history || []
                  const activeRejections = challengeHist.filter(h => {
                    const replenishAt = h.replenishAt?.toMillis?.() || 0
                    return h.status === 'rejected' && replenishAt > Date.now()
                  }).length
                  const tokens = Math.max(0, 5 - activeRejections)
                  console.log('Available tokens after challenge:', tokens)

                  writeFileSync(`${EVIDENCE_DIR}/B11_v5_S03_attempt.json`, JSON.stringify({
                    id: latestAttemptId,
                    score: aData?.score,
                    passed: aData?.passed,
                    challengedAnswers: aData?.answers?.filter(a => a.challengeStatus === 'pending').map(a => ({
                      word: a.word, challengeStatus: a.challengeStatus, challengeNote: a.challengeNote
                    }))
                  }, null, 2))
                }

                const atomicityVerdict = historyGrew && firestoreHasPending ? 'ATOMIC - both writes succeeded' :
                                        historyGrew && !firestoreHasPending ? 'NON-ATOMIC - B23-F01 - history grew but attempt not updated' :
                                        !historyGrew && !firestoreHasPending ? 'BOTH FAILED' :
                                        'PARTIAL'

                evidence.S03 = {
                  pendingBadgeVisible: pendingBadge > 0,
                  challengeHistoryGrew: historyGrew,
                  firestoreHasPending,
                  preHistoryLength: preHistory.length,
                  postHistoryLength: postHistory.length,
                  latestAttemptId,
                  atomicityVerdict
                }
                writeFileSync(`${EVIDENCE_DIR}/B11_v5_S03.json`, JSON.stringify(evidence.S03, null, 2))
                console.log('S03 atomicity verdict:', atomicityVerdict)
                console.log('S03 UI verdict: pending badge =', pendingBadge > 0)

                // === S07: Navigate away and check pending badge persistence ===
                console.log('\n=== S07: Pending badge persistence after navigation ===')

                await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
                await page.waitForTimeout(3000)
                await screenshot(page, 'B11_v5_S07_01_dashboard')

                const pendingOnDash = await page.getByText(/pending/i).count()
                console.log('Pending on dashboard:', pendingOnDash)

                // Re-enter session
                const startBtn2 = page.getByRole('button', { name: /start session/i }).first()
                if (await startBtn2.count() > 0) {
                  await startBtn2.click()
                  await page.waitForTimeout(4000)

                  const startStudying2 = page.getByRole('button', { name: /start studying/i })
                  if (await startStudying2.count() > 0) {
                    await startStudying2.click()
                    await page.waitForTimeout(1000)
                  }

                  await screenshot(page, 'B11_v5_S07_02_back_in_session')
                  const pendingAfterReenter = await page.getByText(/pending/i).count()
                  const bodyAfter = await page.textContent('body')
                  const phaseAfter = bodyAfter.includes('Answers') ? 'results' :
                                      bodyAfter.includes('I Know') ? 'flashcards' :
                                      bodyAfter.includes('Submit') ? 'test' :
                                      bodyAfter.includes('Ready for') ? 'ready' : 'unknown'

                  console.log('Phase after reenter:', phaseAfter)
                  console.log('Pending badges after reenter:', pendingAfterReenter)

                  evidence.S07 = {
                    pendingOnDashboard: pendingOnDash > 0,
                    pendingBadgesAfterReenter: pendingAfterReenter,
                    phaseAfterReenter: phaseAfter,
                    verdict: phaseAfter === 'results' && pendingAfterReenter === 0 ?
                              'FAIL - pending badge lost on reenter to results screen' :
                              phaseAfter === 'results' && pendingAfterReenter > 0 ?
                              'PASS - pending badge survived navigation' :
                              'INCONCLUSIVE - not on results after reenter'
                  }
                  writeFileSync(`${EVIDENCE_DIR}/B11_v5_S07.json`, JSON.stringify(evidence.S07, null, 2))
                  console.log('S07 verdict:', evidence.S07.verdict)
                }
              } else {
                console.log('Challenge modal did not open properly')
              }
            } else {
              // No challenge buttons — AI grader accepted "idk" answers
              console.log('NO CHALLENGE BUTTONS — AI grader accepted all "idk" answers as correct')
              console.log('Score:', displayedScore + '%')

              // This is an AI grading finding (B26 territory) but documenting here too
              evidence.AIGradingNote = {
                finding: 'AI grader accepted "idk" answers as correct',
                score: displayedScore,
                hasDidNotPass,
                hasCompleted,
                note: 'This is primarily B26 territory but affects B11 challenge flow'
              }
              writeFileSync(`${EVIDENCE_DIR}/B11_v5_AI_grading_note.json`, JSON.stringify(evidence.AIGradingNote, null, 2))
            }
          }
        }
      } else {
        console.log('No inputs on test')
        evidence.blocked = 'no test inputs'
      }
    } else {
      console.log('No Skip to Test option')
      evidence.blocked = 'no Skip to Test'
    }

  } catch (err) {
    await screenshot(page, 'B11_v5_error').catch(() => {})
    console.error('Error:', err.message)
    evidence.error = err.message
  } finally {
    if (consoleErrors.length > 0) {
      writeFileSync(`${EVIDENCE_DIR}/B11_v5_console_errors.txt`, consoleErrors.join('\n'))
    }
    await ctx.close()
    await browser.close()
  }

  writeFileSync(`${EVIDENCE_DIR}/B11_v5_final.json`, JSON.stringify(evidence, null, 2))
  console.log('\n=== FINAL ===', JSON.stringify(evidence, null, 2))
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
