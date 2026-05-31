/**
 * B05 — MCQ Review Test Verification
 * Focus: get past typed test to reach MCQ review test
 * Use careful TOP at Day 8 (Step 1 of 5, skip directly to test)
 *
 * Session structure confirmed from v3:
 * Step 1: NEW_WORDS Study (cards)
 * Step 2: NEW_WORD_TEST (typed, 30 questions)
 * Step 3: REVIEW_STUDY (review cards)
 * Step 4: REVIEW_TEST (MCQ)
 * Step 5: COMPLETE
 */

import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import path from 'path'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B05'
const LOG_PATH = '/app/audit/playwright/findings/agent_logs/J.jsonl'

const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
const auditState = JSON.parse(readFileSync('/app/audit/playwright/audit_state.json', 'utf-8'))

const CAREFUL_TOP = seeded.accounts.find(a => a.personaId === 'careful' && a.targetClass === 'TOP')

mkdirSync(EVIDENCE_DIR, { recursive: true })

function log(obj) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...obj })
  writeFileSync(LOG_PATH, line + '\n', { flag: 'a' })
  console.log(line)
}

async function ss(page, name) {
  const fp = path.join(EVIDENCE_DIR, `${name}.png`)
  await page.screenshot({ path: fp, fullPage: true }).catch(e => console.warn('SS fail:', e.message.substring(0, 50)))
  console.log('SS:', name)
}

async function loginAs(page, account) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await loginLink.count() > 0) await loginLink.click()
  else await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(account.email)
  await page.getByLabel(/password/i).first().fill(account.password)
  await page.getByLabel(/password/i).first().press('Enter')
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(async () => {
    await page.getByRole('button', { name: /continue|log\s?in/i }).first().click().catch(() => {})
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  })
  console.log('Logged in:', page.url())
}

// Lookup answer for a word
function lookupWord(prompt) {
  const allWords = [...auditState.lists.topActiveList.words, ...auditState.lists.coreActiveList.words]
  const p = prompt.toLowerCase().replace(/\(.*\)/, '').replace(/\r\n.*/,'').trim()
  const match = allWords.find(w => {
    const wn = w.word.toLowerCase().replace(/\r\n.*/,'').replace(/\(.*\)/,'').trim()
    return wn === p || p.startsWith(wn) || wn.startsWith(p)
  })
  return match
}

async function answerTyped(page, questionNumber) {
  const input = page.locator('input[type="text"]').first()
  if (await input.count() === 0) return false

  // Get word from page - look for bold or prominent word display
  let wordText = ''
  const wordEls = await page.locator('[class*="word"], [class*="Word"], strong, b, h1, h2, h3').all()
  for (const el of wordEls) {
    const t = await el.innerText().catch(() => '')
    if (t.trim() && t.trim().length < 60 && !/step|progress|answered|day/i.test(t)) {
      wordText = t.trim()
      break
    }
  }

  const wordInfo = lookupWord(wordText)
  const answer = wordInfo?.definition_en || 'a word meaning something'
  console.log(`  Q${questionNumber}: word="${wordText.substring(0, 30)}" → answer="${answer.substring(0, 50)}"`)

  await input.focus()
  // Type char by char
  for (const ch of answer.substring(0, 80)) {
    await input.press(ch)
    await page.waitForTimeout(20)
  }

  // Submit
  const submitBtn = page.getByRole('button', { name: /submit answer|check|submit/i }).first()
  if (await submitBtn.count() > 0 && await submitBtn.isEnabled()) {
    await submitBtn.click()
  } else {
    // Try click via keyboard
    await input.press('Tab')
    await page.waitForTimeout(200)
    const btn = page.locator('button[type="submit"], button').filter({ hasText: /submit|check/i }).first()
    if (await btn.count() > 0) await btn.click()
    else await input.press('Enter')
  }

  // Wait for grading
  await page.waitForTimeout(8000)
  // Check if still grading
  for (let i = 0; i < 5; i++) {
    const grading = await page.locator('*').filter({ hasText: /grading|wait|processing/i }).count()
    if (grading === 0) break
    await page.waitForTimeout(3000)
  }

  return true
}

async function runMCQVerify() {
  const browser = await chromium.launch({ headless: true })
  const results = {
    typedTestConfirmed: false,
    mcqTestConfirmed: false,
    reviewStudyConfirmed: false,
    reviewTestConfirmed: false,
    sessionCompleted: false,
    stepsVisited: [],
    questionsAnswered: 0,
    notes: [],
  }

  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx.addInitScript(() => {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
      }
    })
    const page = await ctx.newPage()
    const errors = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await loginAs(page, CAREFUL_TOP)
    await ss(page, 'B05_mcq_01_dashboard')

    // Start session
    const startBtn = page.getByRole('button', { name: /start/i }).first()
    await startBtn.click()
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
    console.log('Session:', page.url())

    // Dismiss "Customize Flashcards" modal
    await page.getByRole('button', { name: /start studying/i }).first().click()
    await page.waitForTimeout(500)

    // Skip directly to test via session menu
    const menuBtn = page.locator('button[aria-label="Session menu"]').first()
    await menuBtn.click()
    await page.waitForTimeout(500)
    await page.getByText('Skip to Test').first().click()
    await page.waitForTimeout(800)

    // Handle "Ready for the Test?" dialog
    const startTestBtn = page.getByRole('button', { name: /start test/i }).first()
    if (await startTestBtn.count() > 0) {
      await startTestBtn.click()
      await page.waitForTimeout(1000)
    }

    await ss(page, 'B05_mcq_02_typed_test')
    let body = await page.innerText('body')
    console.log('After skip state (300):', body.substring(0, 300))

    // We should now be on Step 2: NEW_WORD_TEST (typed)
    const step2Match = body.match(/step 2 of/i)
    results.typedTestConfirmed = step2Match !== null || await page.locator('input[type="text"]').count() > 0
    if (results.typedTestConfirmed) {
      results.stepsVisited.push('STEP_2_TYPED_TEST')
      results.notes.push('Step 2 (NEW_WORD_TEST typed) confirmed')
    }

    // Answer typed test questions - need to answer them all OR skip to step 3
    // First try to answer a few then see if we can navigate forward
    let qNum = 0
    const MAX_TYPED = 35

    while (qNum < MAX_TYPED) {
      body = await page.innerText('body')

      // Check current state
      const hasTyped = await page.locator('input[type="text"]').count() > 0
      const hasMCQ = (await page.locator('[role="radio"]').count() > 0) ||
                     (await page.locator('button').filter({hasText: /^[A-D]\./}).count() > 0)
      const isComplete = /complete|congratulations|done.*today|great job|keep it up/i.test(body)
      const isReviewStudy = /review.*study|study.*review/i.test(body) && !hasTyped && !hasMCQ
      const isReviewTest = /review.*test|test.*review/i.test(body) && !hasTyped
      const stepMatch = body.match(/step (\d+) of/i)

      console.log(`Iter ${qNum}: typed=${hasTyped} mcq=${hasMCQ} complete=${isComplete} step=${stepMatch?.[1]} review=${isReviewStudy || isReviewTest}`)

      if (isComplete) {
        results.sessionCompleted = true
        results.stepsVisited.push('COMPLETE')
        results.notes.push('Session completed!')
        await ss(page, 'B05_mcq_complete')
        break
      }

      if (isReviewStudy && !results.reviewStudyConfirmed) {
        results.reviewStudyConfirmed = true
        results.stepsVisited.push('REVIEW_STUDY')
        results.notes.push(`Review Study phase at step ${stepMatch?.[1]}`)
        await ss(page, 'B05_mcq_review_study')
        // Try to advance past review study cards
        const nextBtn = page.getByRole('button', { name: /start test|next.*test|skip.*study/i }).first()
        if (await nextBtn.count() > 0) {
          await nextBtn.click()
          await page.waitForTimeout(1000)
        }
        qNum++
        continue
      }

      if (hasMCQ || isReviewTest) {
        if (!results.mcqTestConfirmed) {
          results.mcqTestConfirmed = true
          results.reviewTestConfirmed = true
          results.stepsVisited.push('REVIEW_TEST_MCQ')
          results.notes.push(`MCQ Review Test found at step ${stepMatch?.[1]}!`)
          await ss(page, 'B05_mcq_review_test_MCQ')
          console.log('MCQ REVIEW TEST CONFIRMED - Step', stepMatch?.[1])
          console.log('MCQ body:', body.substring(0, 400))
        }

        // Answer MCQ question
        const opts = page.locator('[role="radio"]')
        const btnOpts = page.locator('button').filter({ hasText: /^[A-D]\./ })
        if (await opts.count() > 0) {
          await opts.first().click()
          await page.waitForTimeout(500)
        } else if (await btnOpts.count() > 0) {
          await btnOpts.first().click()
          await page.waitForTimeout(500)
        }

        const nextBtn = page.getByRole('button', { name: /next|submit/i }).first()
        if (await nextBtn.count() > 0) {
          await nextBtn.click()
          await page.waitForTimeout(1500)
        }
        qNum++
        results.questionsAnswered++
        continue
      }

      if (hasTyped) {
        await answerTyped(page, qNum + 1)
        results.questionsAnswered++
        qNum++
        continue
      }

      // Check for "Submit Test?" modal (appeared when we tried to submit after last Q in v3)
      const submitTestBtn = page.getByRole('button', { name: /submit test|yes.*submit/i }).first()
      const cancelBtn = page.getByRole('button', { name: /cancel|no|keep|reviewing/i }).first()
      if (await submitTestBtn.count() > 0 && await submitTestBtn.isVisible()) {
        console.log('Submit Test dialog - clicking Submit')
        await submitTestBtn.click()
        await page.waitForTimeout(2000)
        qNum++
        continue
      }

      // Check for "Review Answers" / "Retake" / results page after typed test
      const resultsText = /results|score|pass|fail|retake|continue/i.test(body)
      if (resultsText) {
        results.notes.push('Typed test results page reached')
        const continueBtn = page.getByRole('button', { name: /continue|next|proceed/i }).first()
        if (await continueBtn.count() > 0) {
          await continueBtn.click()
          await page.waitForTimeout(2000)
          await ss(page, `B05_mcq_after_continue_${qNum}`)
          qNum++
          continue
        }
      }

      // Nothing to do
      console.log('No action - breaking loop. Body:', body.substring(0, 200))
      await ss(page, `B05_mcq_stuck_${qNum}`)
      break
    }

    await ss(page, 'B05_mcq_final')

    // Final state
    body = await page.innerText('body')
    results.notes.push(`Final URL: ${page.url()}`)
    results.notes.push(`Total questions answered: ${results.questionsAnswered}`)
    results.notes.push(`Steps visited: ${results.stepsVisited.join(', ')}`)
    results.notes.push(`Console errors: ${errors.length}`)
    if (errors.length > 0) {
      results.notes.push(`Errors: ${errors.slice(0, 3).join('; ')}`)
    }

    console.log('\n=== MCQ VERIFY RESULTS ===')
    console.log('Typed test confirmed:', results.typedTestConfirmed)
    console.log('MCQ Review test confirmed:', results.mcqTestConfirmed)
    console.log('Review study confirmed:', results.reviewStudyConfirmed)
    console.log('Session completed:', results.sessionCompleted)
    console.log('Steps visited:', results.stepsVisited)
    console.log('Questions answered:', results.questionsAnswered)

    await ctx.close()
  } finally {
    await browser.close()
  }

  writeFileSync('/app/audit/playwright/findings/evidence/B05/B05_mcq_verify.json',
    JSON.stringify({ results, completedAt: new Date().toISOString() }, null, 2))

  log({ event: 'scenario', batch: 'B05', scenario: 'S01_mcq_final',
        result: results.mcqTestConfirmed ? 'pass' : results.typedTestConfirmed ? 'partial' : 'fail',
        typedTestConfirmed: results.typedTestConfirmed,
        mcqTestConfirmed: results.mcqTestConfirmed,
        notes: results.notes })

  return results
}

runMCQVerify().then(r => {
  console.log('MCQ verification done. MCQ found:', r.mcqTestConfirmed)
}).catch(err => {
  console.error('FATAL:', err.message)
  log({ event: 'error', batch: 'B05', error: err.message })
})
