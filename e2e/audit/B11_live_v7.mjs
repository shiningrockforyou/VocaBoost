/**
 * B11 Live Browser Test v7 — Day 1 typed test → wrong answers → challenge + retake check
 * Uses slowlaptop student (fresh Day 1)
 * Key tests: S01 (results screen), S03 (challenge), S07 (persistence), B04-F01 (retake)
 */

import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B11'
mkdirSync(EVIDENCE_DIR, { recursive: true })

const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
const STUDENT = seeded.accounts.find(a => a.personaId === 'slowlaptop' && a.targetClass === 'TOP')
console.log('Student:', STUDENT.email, 'uid:', STUDENT.uid)

async function loginAs(page, account) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await loginLink.count() > 0) {
    await loginLink.click()
  } else {
    await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
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

async function ss(page, name) {
  const path = `${EVIDENCE_DIR}/${name}.png`
  await page.screenshot({ path, fullPage: true })
  console.log('📸', name)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  const consoleErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
    if (msg.type() === 'log' && msg.text().includes('DEBUG')) {
      console.log('[browser]', msg.text().substring(0, 200))
    }
  })

  const evidence = {}

  try {
    await loginAs(page, STUDENT)
    await ss(page, 'B11_v7_01_dashboard')

    // Start session
    await page.getByText('25WT 2차 TOP OFFLINE').first().waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: /start session/i }).first().click()
    await page.waitForTimeout(3000)

    // Dismiss customize modal
    const startStudying = page.getByRole('button', { name: /start studying/i })
    if (await startStudying.count() > 0) {
      await startStudying.click()
      await page.waitForTimeout(2000)
    }

    await ss(page, 'B11_v7_02_session')
    console.log('[browser debug from session]', await page.evaluate(() => {
      const debugLogs = window.__B11_DEBUG || []
      return 'URL: ' + window.location.pathname
    }))
    console.log('URL:', page.url())

    // Session menu → Skip to Test
    await page.evaluate(() => { document.querySelector('[aria-label="Session menu"]')?.click() })
    await page.waitForTimeout(1000)

    const skipItem = page.getByText('Skip to Test')
    if (await skipItem.count() > 0) {
      await skipItem.click()
      await page.waitForTimeout(1000)

      const confirmBtn = page.getByRole('button', { name: /confirm|yes/i }).first()
      if (await confirmBtn.count() > 0) await confirmBtn.click()
      await page.waitForTimeout(3000)

      // Handle Ready modal
      const body = await page.textContent('body')
      if (body.includes('Ready for the Test')) {
        const readyBtn = page.getByRole('button', { name: /ready|start/i }).first()
        if (await readyBtn.count() > 0) { await readyBtn.click(); await page.waitForTimeout(3000) }
      }

      await page.waitForURL(/typedtest/, { timeout: 15000 }).catch(() => {})
      await ss(page, 'B11_v7_03_test')
      console.log('Test URL:', page.url())

      const inputs = page.getByRole('textbox')
      const inputCount = await inputs.count()
      console.log('Inputs:', inputCount)

      if (inputCount > 0) {
        // The TOP list testMode = 'typed', testSizeNew = 30
        // Use clearly semantically wrong answers from opposite domains
        const wrongAnswers = [
          'a type of fruit that grows in tropical climates',
          'the process of building construction materials',
          'a musical instrument with strings',
          'a measurement of temperature in Celsius',
          'related to the orbit of planets around the sun',
        ]

        for (let i = 0; i < inputCount; i++) {
          await inputs.nth(i).click()
          await inputs.nth(i).fill('')  // clear first
          await page.keyboard.type(wrongAnswers[i % wrongAnswers.length], { delay: 10 })
        }
        await ss(page, 'B11_v7_04_filled')

        const submitBtn = page.getByRole('button', { name: /submit/i }).first()
        await submitBtn.click()
        await page.waitForTimeout(1000)

        const confirmSubmit = page.getByRole('button', { name: /confirm|yes/i }).first()
        if (await confirmSubmit.count() > 0) await confirmSubmit.click()

        console.log('Waiting for grading (up to 120s)...')
        await ss(page, 'B11_v7_05_submitted')

        const gotResults = await page.waitForFunction(() => {
          const body = document.body.innerText
          return body.includes('Did not pass') || body.includes('Completed Day') || body.includes('Answers')
        }, { timeout: 120000 }).then(() => true).catch(() => false)

        await ss(page, 'B11_v7_06_results')
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

          const correctText = bodyText.match(/(\d+)\s+of\s+(\d+)\s+correct/)
          const correctCount = correctText ? parseInt(correctText[1]) : null
          const totalCount = correctText ? parseInt(correctText[2]) : null
          const displayedScore = scoreMatch ? parseInt(scoreMatch[1]) : null
          const calcScore = (correctCount !== null && totalCount > 0) ? Math.round(correctCount / totalCount * 100) : null

          console.log('\n=== S01: RESULTS SCREEN ===')
          console.log('Did not pass:', hasDidNotPass, '| Completed:', hasCompleted)
          console.log('Score:', displayedScore + '% | ' + correctCount + '/' + totalCount)
          console.log('Score accurate:', displayedScore !== null && calcScore !== null ? Math.abs(displayedScore - calcScore) <= 1 : 'N/A')
          console.log('Answers section:', hasAnswers)
          console.log('Challenge buttons:', challengeBtns)
          console.log('Retake button:', hasRetake)
          console.log('Dashboard button:', hasDashboard)
          console.log('URL:', page.url())

          evidence.S01 = {
            hasDidNotPass, hasCompleted, displayedScore, correctCount, totalCount,
            calculatedScore: calcScore,
            scoreAccurate: displayedScore !== null && calcScore !== null ? Math.abs(displayedScore - calcScore) <= 1 : null,
            hasAnswers, challengeBtns, hasRetake, hasDashboard, url: page.url()
          }
          writeFileSync(`${EVIDENCE_DIR}/B11_v7_S01.json`, JSON.stringify(evidence.S01, null, 2))

          // B04-F01 check
          if (hasDidNotPass && !hasRetake && hasDashboard) {
            console.log('*** B04-F01 CONFIRMED LIVE: No Retake button on fail screen ***')
            evidence.B04F01 = { confirmed: true, live: true, url: page.url() }
          } else if (hasDidNotPass && hasRetake) {
            console.log('*** B04-F01 FIXED: Retake button found ***')
            evidence.B04F01 = { confirmed: false, retakeFound: true }
          } else if (hasCompleted && !hasRetake) {
            console.log('Passed (all wrong answers accepted) - no retake expected')
            evidence.AIGraderNote = { accepted_all_wrong: true, displayedScore }
          }

          // S03: Challenge flow
          if (challengeBtns > 0) {
            console.log('\n=== S03: Challenge flow ===')

            const { initializeApp, cert, getApps } = await import('firebase-admin/app')
            const { getFirestore } = await import('firebase-admin/firestore')
            const sa = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'))
            if (!getApps().length) initializeApp({ credential: cert(sa) })
            const db = getFirestore()

            const preUserDoc = await db.collection('users').doc(STUDENT.uid).get()
            const preHistory = preUserDoc.data()?.challenges?.history || []

            const latestAttempts = await db.collection('attempts')
              .where('studentId', '==', STUDENT.uid)
              .orderBy('submittedAt', 'desc')
              .limit(1)
              .get()
            const latestAttemptId = latestAttempts.empty ? null : latestAttempts.docs[0].id
            console.log('Attempt ID:', latestAttemptId)

            // Click challenge
            await page.getByRole('button', { name: /challenge/i }).first().click()
            await page.waitForTimeout(1000)
            await ss(page, 'B11_v7_S03_01_modal')

            const modalOpen = await page.getByRole('button', { name: /submit challenge/i }).count() > 0
            if (modalOpen) {
              const textarea = page.getByPlaceholder(/explain/i).first()
              if (await textarea.count() > 0) {
                await textarea.fill('My answer was correct because it describes the concept broadly.')
              }

              await page.getByRole('button', { name: /submit challenge/i }).click()
              await page.waitForTimeout(4000)
              await ss(page, 'B11_v7_S03_02_after_submit')

              const pendingBadge = await page.getByText(/pending/i).count()
              await page.waitForTimeout(2000)

              const postUserDoc = await db.collection('users').doc(STUDENT.uid).get()
              const postHistory = postUserDoc.data()?.challenges?.history || []
              const historyGrew = postHistory.length > preHistory.length

              let firestoreHasPending = false
              if (latestAttemptId) {
                const attemptDoc = await db.collection('attempts').doc(latestAttemptId).get()
                const aData = attemptDoc.data()
                firestoreHasPending = aData?.answers?.some(a => a.challengeStatus === 'pending') || false
              }

              const atomicityVerdict = historyGrew && firestoreHasPending ?
                'BOTH WRITES SUCCEEDED (happy path ok)' :
                historyGrew && !firestoreHasPending ?
                'GHOST DEPLETION - B23-F01 CONFIRMED' :
                'BOTH FAILED or PARTIAL'

              evidence.S03 = {
                pendingBadgeVisible: pendingBadge > 0,
                challengeHistoryGrew: historyGrew,
                firestoreHasPending,
                atomicityVerdict
              }
              writeFileSync(`${EVIDENCE_DIR}/B11_v7_S03.json`, JSON.stringify(evidence.S03, null, 2))
              console.log('S03 verdict:', atomicityVerdict)

              // S07: navigate away
              console.log('\n=== S07: Nav away + back ===')
              await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
              await page.waitForTimeout(3000)

              // Re-enter
              const startBtn2 = page.getByRole('button', { name: /start session/i }).first()
              if (await startBtn2.count() > 0) {
                await startBtn2.click()
                await page.waitForTimeout(4000)

                const startStudying2 = page.getByRole('button', { name: /start studying/i })
                if (await startStudying2.count() > 0) { await startStudying2.click(); await page.waitForTimeout(1000) }

                await ss(page, 'B11_v7_S07_after_reenter')
                const pendingAfterNav = await page.getByText(/pending/i).count()
                const bodyAfterNav = await page.textContent('body')
                const phaseAfter = bodyAfterNav.includes('Answers') ? 'results' :
                                    bodyAfterNav.includes('Did not pass') ? 'results_fail' :
                                    bodyAfterNav.includes('I Know') ? 'flashcards' :
                                    'other'

                console.log('Phase after re-enter:', phaseAfter)
                console.log('Pending badges after re-enter:', pendingAfterNav)

                evidence.S07 = {
                  phaseAfterReenter: phaseAfter,
                  pendingBadgesAfterReenter: pendingAfterNav,
                  verdict: phaseAfter.includes('result') && pendingAfterNav === 0 ?
                    'FAIL - pending badge lost on results screen after navigation (challengedWords reset)' :
                    phaseAfter.includes('result') && pendingAfterNav > 0 ?
                    'PASS - pending badge survived navigation' :
                    'INCONCLUSIVE'
                }
                writeFileSync(`${EVIDENCE_DIR}/B11_v7_S07.json`, JSON.stringify(evidence.S07, null, 2))
                console.log('S07 verdict:', evidence.S07.verdict)
              }
            }
          } else {
            console.log('No challenge buttons — AI grader accepted all wrong answers')
            evidence.S03 = { blocked: 'AI grader accepted all wrong answers, no challenge buttons available' }
            evidence.AIGraderIssue = {
              severity: 'BLOCKER for B26, HIGH for B11',
              description: 'AI grader accepted domain-irrelevant answers as correct for all 30 typed test questions',
              testCase: 'Answers like "a type of fruit that grows in tropical climates" accepted as correct for vocab definitions',
              impact: 'Students cannot challenge AI grades because challenge buttons only appear on wrong answers. Also: passing students on wrong answers corrupts progress data.'
            }
          }
        }
      }
    }

  } catch (err) {
    await ss(page, 'B11_v7_error').catch(() => {})
    console.error('Error:', err.message)
    evidence.error = err.message
  } finally {
    if (consoleErrors.length > 0) {
      writeFileSync(`${EVIDENCE_DIR}/B11_v7_console_errors.txt`, consoleErrors.join('\n'))
    }
    await ctx.close()
    await browser.close()
  }

  writeFileSync(`${EVIDENCE_DIR}/B11_v7_final.json`, JSON.stringify(evidence, null, 2))
  console.log('\n=== FINAL ===', JSON.stringify(evidence, null, 2))
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })
