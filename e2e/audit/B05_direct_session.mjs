/**
 * B05 — Direct session test targeting the review test (MCQ)
 * Uses direct navigation to the known session URL
 * Then navigates through phases to reach MCQ review test
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

// Known from v3 output: session URL is /session/k8tzOiiwotBbtJS3uTiv/8RMews2H7C3UJUAsOBzR
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv'
const LIST_ID = '8RMews2H7C3UJUAsOBzR'

mkdirSync(EVIDENCE_DIR, { recursive: true })

function log(obj) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...obj })
  writeFileSync(LOG_PATH, line + '\n', { flag: 'a' })
  console.log(line)
}

async function ss(page, name) {
  await page.screenshot({ path: path.join(EVIDENCE_DIR, `${name}.png`), fullPage: true }).catch(() => {})
  console.log('SS:', name)
}

function lookupWord(prompt) {
  const all = [...auditState.lists.topActiveList.words, ...auditState.lists.coreActiveList.words]
  const p = prompt.toLowerCase().replace(/\(.*?\)/g,'').replace(/\r\n.*/,'').trim()
  return all.find(w => {
    const wn = w.word.toLowerCase().replace(/\r\n.*/,'').replace(/\(.*?\)/g,'').trim()
    return wn === p || p.includes(wn) || wn.includes(p.split(' ')[0])
  })
}

async function runDirectSession() {
  const browser = await chromium.launch({ headless: true })
  const results = {
    phases: [],
    typedTestFound: false,
    mcqTestFound: false,
    reviewStudyFound: false,
    sessionComplete: false,
    questionsAnswered: 0,
    errors: [],
  }

  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx.addInitScript(() => {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
      }
    })
    const page = await ctx.newPage()
    page.on('console', msg => {
      if (msg.type() === 'error') results.errors.push(msg.text().substring(0, 100))
    })

    // Login via root
    console.log('Logging in...')
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
    if (await loginLink.count() > 0) await loginLink.click()
    else await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
    await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
    await page.getByLabel(/email/i).first().fill(CAREFUL_TOP.email)
    await page.getByLabel(/password/i).first().fill(CAREFUL_TOP.password)
    await page.getByLabel(/password/i).first().press('Enter')
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(async () => {
      await page.getByRole('button', { name: /continue/i }).first().click().catch(() => {})
      await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
    })
    console.log('Logged in:', page.url())

    // Navigate to session via client-side routing (not deep link reload)
    await page.evaluate((url) => {
      history.pushState({}, '', url)
      dispatchEvent(new PopStateEvent('popstate'))
    }, `/session/${CLASS_ID}/${LIST_ID}`)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(2000)

    let url = page.url()
    console.log('Session URL:', url)
    await ss(page, 'B05_direct_01_session')

    let body = await page.innerText('body')
    console.log('Session body (400):', body.substring(0, 400))

    // Dismiss "Customize Flashcards" modal
    const startStudyingBtn = page.getByRole('button', { name: /start studying/i }).first()
    if (await startStudyingBtn.count() > 0) {
      console.log('Dismissing flashcard modal...')
      await startStudyingBtn.click()
      await page.waitForTimeout(800)
    }

    // Session menu → Skip to Test
    const menuBtn = page.locator('button[aria-label="Session menu"]').first()
    if (await menuBtn.isVisible().catch(() => false)) {
      await menuBtn.click()
      await page.waitForTimeout(500)
      await ss(page, 'B05_direct_02_menu')

      const skipText = page.getByText('Skip to Test').first()
      if (await skipText.count() > 0) {
        await skipText.click()
        await page.waitForTimeout(800)

        // "Ready for the Test?" modal - click "Start Test"
        const startTestBtn = page.getByRole('button', { name: /start test/i }).first()
        if (await startTestBtn.count() > 0) {
          await startTestBtn.click()
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
          console.log('Skipped to test! URL:', page.url())
        }
      }
    }

    await ss(page, 'B05_direct_03_post_skip')
    body = await page.innerText('body')
    console.log('Post-skip body (400):', body.substring(0, 400))

    // We should be on Step 2 (typed test). Answer up to 30 questions.
    let iteration = 0
    const MAX = 60

    while (iteration < MAX) {
      body = await page.innerText('body')
      const hasTyped = await page.locator('input[type="text"]').count() > 0
      const hasMCQ = (await page.locator('[role="radio"]').count() > 0) ||
                     (await page.locator('button[class*="option"]').count() > 0)
      const isComplete = /congratulations|done.*today|great job|keep it up|well done/i.test(body)
      const stepMatch = body.match(/step (\d+) of (\d+)/i)
      const progressMatch = body.match(/(\d+) of (\d+) answered/i)

      console.log(`Iter ${iteration}: typed=${hasTyped} mcq=${hasMCQ} complete=${isComplete} step=${stepMatch?.[1]}/${stepMatch?.[2]} progress=${progressMatch?.[1]}/${progressMatch?.[2]}`)

      if (isComplete) {
        results.sessionComplete = true
        results.phases.push('COMPLETE')
        await ss(page, 'B05_direct_complete')
        console.log('SESSION COMPLETE!')
        break
      }

      // Track phases
      if (hasTyped && !results.typedTestFound) {
        results.typedTestFound = true
        results.phases.push('NEW_WORD_TEST')
        await ss(page, 'B05_direct_typed_test_start')
        console.log('NEW_WORD_TEST confirmed at step', stepMatch?.[1])
      }

      if (hasMCQ && !results.mcqTestFound) {
        results.mcqTestFound = true
        results.phases.push('REVIEW_TEST_MCQ')
        await ss(page, 'B05_direct_mcq_start')
        body = await page.innerText('body')
        console.log('MCQ REVIEW TEST confirmed at step', stepMatch?.[1])
        console.log('MCQ body:', body.substring(0, 500))
      }

      // Handle "Submit Test?" dialog
      const submitTestModal = await page.locator('*').filter({ hasText: /submit.*test\?|are you sure/i }).count()
      if (submitTestModal > 0) {
        console.log('Submit Test dialog detected')
        // Find submit/yes button
        const allBtns = await page.locator('button').all()
        for (const btn of allBtns) {
          const text = await btn.innerText().catch(() => '')
          if (/^submit test$|^yes$/i.test(text.trim()) && await btn.isVisible()) {
            await btn.click()
            await page.waitForTimeout(2000)
            break
          }
        }
        iteration++
        continue
      }

      // Handle Leave Session dialog
      const leaveModal = await page.locator('*').filter({ hasText: /leave study session\?/i }).count()
      if (leaveModal > 0) {
        console.log('Leave session dialog - clicking Keep Studying')
        const keepStudying = page.getByText(/keep studying/i).first()
        if (await keepStudying.count() > 0) await keepStudying.click()
        await page.waitForTimeout(1000)
        iteration++
        continue
      }

      // Handle Review Study phase
      if (/review.*study/i.test(body) && !hasTyped && !hasMCQ) {
        if (!results.reviewStudyFound) {
          results.reviewStudyFound = true
          results.phases.push('REVIEW_STUDY')
          await ss(page, 'B05_direct_review_study')
          console.log('REVIEW_STUDY confirmed at step', stepMatch?.[1])
        }
        // Try to advance past review cards
        const nextBtn = page.getByRole('button', { name: /start test|begin test/i }).first()
        if (await nextBtn.count() > 0) {
          await nextBtn.click()
          await page.waitForTimeout(1500)
          iteration++
          continue
        }
        // Dismiss card
        const gotIt = page.getByRole('button', { name: /got it|know/i }).first()
        if (await gotIt.count() > 0) {
          await gotIt.click()
          await page.waitForTimeout(300)
          iteration++
          continue
        }
      }

      // Handle typed question
      if (hasTyped) {
        // Get word text
        let wordText = ''
        const headings = await page.locator('h1, h2, h3, [class*="word"]').all()
        for (const h of headings) {
          const t = await h.innerText().catch(() => '')
          if (t.trim() && t.length < 80 && !/step|progress|day/i.test(t)) {
            wordText = t.trim()
            break
          }
        }

        const wordInfo = lookupWord(wordText)
        const answer = wordInfo?.definition_en || 'a definition of the word'
        console.log(`  Answer: "${answer.substring(0, 50)}"`)

        const input = page.locator('input[type="text"]').first()
        await input.focus()
        for (const ch of answer.substring(0, 80)) {
          await input.press(ch)
          await page.waitForTimeout(15)
        }

        // Find submit button
        const submitBtn = page.locator('button').filter({ hasText: /^submit answer$|^submit$/i }).first()
        if (await submitBtn.count() > 0 && await submitBtn.isEnabled()) {
          await submitBtn.click()
        } else {
          await input.press('Enter')
        }

        // Wait for grading
        await page.waitForTimeout(8000)
        for (let g = 0; g < 4; g++) {
          const grading = await page.locator('*').filter({ hasText: /grading|processing/i }).count()
          if (grading === 0) break
          await page.waitForTimeout(3000)
        }

        results.questionsAnswered++
        await ss(page, `B05_direct_typed_q${results.questionsAnswered}`)
        iteration++
        continue
      }

      // Handle MCQ question
      if (hasMCQ) {
        const radios = page.locator('[role="radio"]')
        if (await radios.count() > 0) {
          await radios.first().click()
          await page.waitForTimeout(300)
        } else {
          const optBtns = page.locator('button[class*="option"], button').filter({ hasText: /^[A-D]\./ }).first()
          if (await optBtns.count() > 0) await optBtns.click()
        }
        const nextBtn = page.getByRole('button', { name: /next|submit/i }).first()
        if (await nextBtn.count() > 0) {
          await nextBtn.click()
          await page.waitForTimeout(1000)
        }
        results.questionsAnswered++
        iteration++
        continue
      }

      // Generic next/continue button
      const nextBtn = page.getByRole('button', { name: /^next$|^continue$|^proceed$/i }).first()
      if (await nextBtn.count() > 0 && await nextBtn.isVisible()) {
        await nextBtn.click()
        await page.waitForTimeout(1500)
        iteration++
        continue
      }

      // If nothing, capture state and break
      console.log('No action available. Body:', body.substring(0, 200))
      await ss(page, `B05_direct_stuck_${iteration}`)
      break
    }

    await ss(page, 'B05_direct_final')

    console.log('\n=== DIRECT SESSION RESULTS ===')
    console.log('Phases visited:', results.phases)
    console.log('Typed test found:', results.typedTestFound)
    console.log('MCQ review test found:', results.mcqTestFound)
    console.log('Review study found:', results.reviewStudyFound)
    console.log('Session complete:', results.sessionComplete)
    console.log('Questions answered:', results.questionsAnswered)

    await ctx.close()
  } finally {
    await browser.close()
  }

  // Final assessment
  const allGood = results.typedTestFound && results.mcqTestFound
  log({
    event: 'scenario',
    batch: 'B05',
    scenario: 'S01_final',
    result: allGood ? 'pass' : results.typedTestFound ? 'partial' : 'fail',
    typedTestFound: results.typedTestFound,
    mcqTestFound: results.mcqTestFound,
    sessionComplete: results.sessionComplete,
    phases: results.phases,
  })

  writeFileSync('/app/audit/playwright/findings/evidence/B05/B05_direct_results.json',
    JSON.stringify({ results, completedAt: new Date().toISOString() }, null, 2))

  return results
}

runDirectSession().catch(err => {
  console.error('FATAL:', err.message)
  log({ event: 'error', batch: 'B05', error: err.message })
  process.exit(1)
})
