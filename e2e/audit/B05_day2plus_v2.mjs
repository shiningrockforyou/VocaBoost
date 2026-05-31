/**
 * B05 — Day 2+ Happy Path Audit — v2 (improved modal handling)
 * Agent: J
 *
 * Key lesson from v1: session page shows a "Customize Your Flashcards" modal
 * with "Start Studying" button that BLOCKS the session menu button.
 * Must dismiss it first before accessing session menu or Skip to Test.
 *
 * Also key finding: firsttimerTOP shows "Day 1" even though CSD=2 in Firestore
 * - indicates a Day 1 session is being shown (possibly lastStudyDate same day?)
 */

import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import path from 'path'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B05'
const LOG_PATH = '/app/audit/playwright/findings/agent_logs/J.jsonl'
const STATUS_PATH = '/app/audit/playwright/findings/agent_logs/J.status.json'

const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))
const auditState = JSON.parse(readFileSync('/app/audit/playwright/audit_state.json', 'utf-8'))

const CAREFUL_TOP = seeded.accounts.find(a => a.personaId === 'careful' && a.targetClass === 'TOP')
const FIRSTTIMER_TOP = seeded.accounts.find(a => a.personaId === 'firsttimer' && a.targetClass === 'TOP')

mkdirSync(EVIDENCE_DIR, { recursive: true })

function log(obj) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...obj })
  writeFileSync(LOG_PATH, line + '\n', { flag: 'a' })
  console.log(line)
}

function updateStatus(scenario, trialsCompleted, state = 'running') {
  writeFileSync(STATUS_PATH, JSON.stringify({
    label: 'J',
    currentBatch: 'B05',
    currentScenario: scenario,
    batchesClaimed: ['B05'],
    batchesCompleted: [],
    trialsCompleted,
    lastUpdate: new Date().toISOString(),
    state
  }, null, 2))
}

async function takeScreenshot(page, name) {
  const filepath = path.join(EVIDENCE_DIR, `${name}.png`)
  await page.screenshot({ path: filepath, fullPage: true }).catch(e => console.warn('Screenshot failed:', e.message))
  console.log(`Screenshot: ${filepath}`)
  return filepath
}

async function loginAs(page, account) {
  console.log(`Logging in as ${account.email}`)
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
    const btn = page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first()
    if (await btn.count() > 0) await btn.click()
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  })
  console.log('Logged in, URL:', page.url())
  return account
}

async function dismissFlashcardModal(page) {
  // The "Customize Your Flashcards" modal appears on session start
  // It has a "Start Studying" button - click it to dismiss
  const startStudyingBtn = page.getByRole('button', { name: /start studying/i }).first()
  if (await startStudyingBtn.count() > 0) {
    console.log('Dismissing flashcard customization modal...')
    await startStudyingBtn.click()
    await page.waitForTimeout(1000)
    console.log('Modal dismissed')
    return true
  }
  return false
}

async function navigateToSession(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  const startBtn = page.getByRole('button', { name: /start/i }).first()
  if (await startBtn.count() > 0) {
    await startBtn.click()
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    console.log('Navigated to session, URL:', page.url())
    return true
  }
  return false
}

async function useSkipToTest(page) {
  // First dismiss modal if present
  await dismissFlashcardModal(page)
  await page.waitForTimeout(500)

  // Now try session menu
  const menuBtn = page.locator('button[aria-label="Session menu"]').first()
  if (await menuBtn.count() > 0 && await menuBtn.isVisible()) {
    console.log('Clicking session menu...')
    await menuBtn.click()
    await page.waitForTimeout(800)
    await takeScreenshot(page, 'B05_v2_menu_open')

    // Look for Skip to Test in menu
    const skipBtn = page.getByRole('button', { name: /skip.*test|test.*skip/i }).first()
    const skipText = page.getByText(/skip.*test/i).first()
    if (await skipBtn.count() > 0) {
      console.log('Found Skip to Test button in menu')
      await skipBtn.click()
      await page.waitForTimeout(500)
      // Confirm dialog
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|skip/i }).first()
      if (await confirmBtn.count() > 0) {
        await confirmBtn.click()
      }
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      return 'skip_to_test'
    } else if (await skipText.count() > 0) {
      await skipText.click()
      await page.waitForTimeout(500)
      const confirmBtn = page.getByRole('button', { name: /confirm|yes/i }).first()
      if (await confirmBtn.count() > 0) await confirmBtn.click()
      return 'skip_to_test'
    } else {
      console.log('Skip to Test not in menu. Menu items:')
      const menuItems = await page.locator('[role="menuitem"], [role="button"]').all()
      for (const item of menuItems.slice(0, 10)) {
        console.log(' -', await item.innerText().catch(() => '?'))
      }
      // Close menu
      await page.keyboard.press('Escape')
    }
  } else {
    console.log('Session menu not found or not visible')
  }

  return 'no_skip'
}

async function getSessionPhase(page) {
  const bodyText = await page.innerText('body')
  if (/step 1 of|new words study/i.test(bodyText)) return 'NEW_WORDS'
  if (/review study/i.test(bodyText)) return 'REVIEW_STUDY'
  if (/review test/i.test(bodyText)) return 'REVIEW_TEST'
  if (/new.*word.*test|typing test/i.test(bodyText)) return 'NEW_WORD_TEST'
  if (/complete|congratulations|done for today/i.test(bodyText)) return 'COMPLETE'
  if (/step \d+ of \d+/i.test(bodyText)) {
    const steps = bodyText.match(/step (\d+) of (\d+)/i)
    return `STEP_${steps?.[1]}_OF_${steps?.[2]}`
  }
  return 'UNKNOWN'
}

async function dismissCards(page, maxCards = 5) {
  // Dismiss flashcards by clicking "Got it!" or card advance buttons
  let dismissed = 0
  for (let i = 0; i < maxCards; i++) {
    const gotIt = page.getByRole('button', { name: /got it|next|mark.*known|i know this/i }).first()
    const dontKnow = page.getByRole('button', { name: /don.?t know|again|still learning/i }).first()
    const flipBtn = page.getByRole('button', { name: /flip|show/i }).first()

    if (await gotIt.count() > 0 && await gotIt.isVisible()) {
      await gotIt.click()
      dismissed++
      await page.waitForTimeout(300)
    } else if (await flipBtn.count() > 0 && await flipBtn.isVisible()) {
      await flipBtn.click()
      await page.waitForTimeout(300)
      // After flip, try Got it
      const gotItAfter = page.getByRole('button', { name: /got it|know|correct/i }).first()
      if (await gotItAfter.count() > 0) {
        await gotItAfter.click()
        dismissed++
        await page.waitForTimeout(300)
      }
    } else {
      break
    }
  }
  return dismissed
}

// Results tracking
const findings = []
let trialsCompleted = 0

async function runB05v2() {
  const browser = await chromium.launch({ headless: true })

  try {
    // ═══════════════════════════════════════════════════════════════
    // DEEP SESSION EXPLORATION: understand the session structure
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== DEEP SESSION EXPLORATION: careful TOP (Day 8) ===')

    const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx1.addInitScript(() => {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
      }
    })
    const page1 = await ctx1.newPage()
    const consoleErrors1 = []
    page1.on('console', msg => { if (msg.type() === 'error') consoleErrors1.push(msg.text()) })

    const sessionStructure = {
      phases: [],
      stepsInfo: null,
      reviewTestFound: false,
      newWordTestFound: false,
      mcqFound: false,
      typedInputFound: false,
      sessionMenuItems: [],
      skipToTestAvailable: false,
    }

    try {
      await loginAs(page1, CAREFUL_TOP)
      await navigateToSession(page1)
      await page1.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})

      // Dismiss modal first
      const modalDismissed = await dismissFlashcardModal(page1)
      console.log('Modal dismissed:', modalDismissed)
      await page1.waitForTimeout(1000)

      await takeScreenshot(page1, 'B05_v2_S01_01_after_modal_dismiss')

      // Get full body text after modal dismissed
      let bodyText = await page1.innerText('body')
      console.log('Session after modal dismiss (first 800):', bodyText.substring(0, 800))

      // Get step information
      const stepMatch = bodyText.match(/step (\d+) of (\d+)/i)
      if (stepMatch) {
        sessionStructure.stepsInfo = { current: stepMatch[1], total: stepMatch[2] }
        console.log(`Session has ${stepMatch[2]} steps total (currently on step ${stepMatch[1]})`)
      }

      const phase1 = await getSessionPhase(page1)
      sessionStructure.phases.push(phase1)
      console.log('Current phase:', phase1)

      // Try session menu
      const menuBtn = page1.locator('button[aria-label="Session menu"]').first()
      if (await menuBtn.count() > 0 && await menuBtn.isVisible()) {
        await menuBtn.click()
        await page1.waitForTimeout(800)
        await takeScreenshot(page1, 'B05_v2_S01_02_menu')

        bodyText = await page1.innerText('body')
        console.log('Menu content:', bodyText.substring(0, 400))

        // Extract menu items
        const menuLinks = await page1.locator('[role="menuitem"], [role="button"], li').all()
        for (const link of menuLinks.slice(0, 15)) {
          const txt = await link.innerText().catch(() => '')
          if (txt.trim()) {
            sessionStructure.sessionMenuItems.push(txt.trim().substring(0, 60))
          }
        }
        console.log('Menu items found:', sessionStructure.sessionMenuItems)

        // Check for Skip to Test
        if (bodyText.includes('Skip to Test') || bodyText.includes('Skip')) {
          sessionStructure.skipToTestAvailable = true
          console.log('Skip to Test IS available in menu')

          // Click it
          const skipItem = page1.getByText(/skip.*test/i).first()
          if (await skipItem.count() > 0) {
            await skipItem.click()
            await page1.waitForTimeout(500)
            const confirmBtn = page1.getByRole('button', { name: /confirm|yes|skip/i }).first()
            if (await confirmBtn.count() > 0) {
              await confirmBtn.click()
            }
            await page1.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})

            await takeScreenshot(page1, 'B05_v2_S01_03_after_skip')
            bodyText = await page1.innerText('body')
            console.log('After skip (first 600):', bodyText.substring(0, 600))

            const phase2 = await getSessionPhase(page1)
            sessionStructure.phases.push(phase2)
            console.log('Phase after skip:', phase2)
          }
        } else {
          console.log('Skip to Test NOT in menu')
          await page1.keyboard.press('Escape')
          await page1.waitForTimeout(500)
        }
      }

      // Check for typed input (new word test)
      const typedInputs = await page1.locator('input[type="text"], textarea').count()
      if (typedInputs > 0) {
        sessionStructure.typedInputFound = true
        sessionStructure.newWordTestFound = true
        console.log('TYPED INPUT FOUND - in NEW_WORD_TEST')
      }

      // Check for MCQ options
      const mcqCount = await page1.locator('[role="radio"]').count()
      const mcqBtns = await page1.locator('button').filter({ hasText: /^[A-D]\./ }).count()
      if (mcqCount > 0 || mcqBtns > 0) {
        sessionStructure.mcqFound = true
        sessionStructure.reviewTestFound = true
        console.log('MCQ OPTIONS FOUND - in REVIEW_TEST')
      }

      // Store findings
      findings.push({
        type: 'session_structure',
        data: sessionStructure,
        consoleErrors: consoleErrors1,
      })

      await takeScreenshot(page1, 'B05_v2_S01_04_final')

    } finally {
      await ctx1.close()
    }

    // ═══════════════════════════════════════════════════════════════
    // S01/S04: Navigate through session steps to find review test
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== S01 PHASE WALK: Navigate all session steps ===')
    updateStatus('S01_phase_walk', trialsCompleted)

    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx2.addInitScript(() => {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
      }
    })
    const page2 = await ctx2.newPage()
    const consoleErrors2 = []
    page2.on('console', msg => { if (msg.type() === 'error') consoleErrors2.push(msg.text()) })

    const phaseWalk = {
      phasesVisited: [],
      reviewTestEncountered: false,
      newWordTestEncountered: false,
      mcqOptionsVisible: false,
      sessionComplete: false,
      dayAfterSession: null,
    }

    try {
      await loginAs(page2, CAREFUL_TOP)
      await navigateToSession(page2)
      await page2.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})

      // Dismiss initial modal
      await dismissFlashcardModal(page2)
      await page2.waitForTimeout(500)

      await takeScreenshot(page2, 'B05_v2_phasewalk_01_start')
      let bodyText = await page2.innerText('body')

      // Track step navigation
      let stepNum = 0
      const maxSteps = 8

      while (stepNum < maxSteps) {
        stepNum++
        bodyText = await page2.innerText('body')
        const phase = await getSessionPhase(page2)
        console.log(`Step ${stepNum}: Phase = ${phase}`)

        // Log what's visible
        const stepMatch = bodyText.match(/step (\d+) of (\d+)/i)
        if (stepMatch) {
          console.log(`  Step indicator: ${stepMatch[1]} of ${stepMatch[2]}`)
        }

        // Check for phase indicators
        if (phase !== 'UNKNOWN') {
          if (!phaseWalk.phasesVisited.includes(phase)) {
            phaseWalk.phasesVisited.push(phase)
          }
        }

        if (/review test/i.test(bodyText)) {
          phaseWalk.reviewTestEncountered = true
          console.log('  ** REVIEW TEST ENCOUNTERED **')
        }
        if (/new.*word.*test|typing test/i.test(bodyText) || await page2.locator('input[type="text"]').count() > 0) {
          phaseWalk.newWordTestEncountered = true
          console.log('  ** NEW WORD TEST (typed) ENCOUNTERED **')
        }
        if (/multiple choice|MCQ/i.test(bodyText) || await page2.locator('[role="radio"]').count() > 0) {
          phaseWalk.mcqOptionsVisible = true
          console.log('  ** MCQ OPTIONS VISIBLE **')
        }
        if (/complete|congratulations|done for today/i.test(bodyText)) {
          phaseWalk.sessionComplete = true
          console.log('  ** SESSION COMPLETE **')
          break
        }

        await takeScreenshot(page2, `B05_v2_phasewalk_step${stepNum}`)

        // Try to advance via session menu > Skip or via next button
        const menuBtn = page2.locator('button[aria-label="Session menu"]').first()
        if (await menuBtn.isVisible().catch(() => false)) {
          await menuBtn.click()
          await page2.waitForTimeout(600)

          const skipInMenu = page2.getByText(/skip.*test|next.*phase/i).first()
          if (await skipInMenu.count() > 0) {
            await skipInMenu.click()
            await page2.waitForTimeout(500)
            const confirm = page2.getByRole('button', { name: /confirm|yes/i }).first()
            if (await confirm.count() > 0) await confirm.click()
            await page2.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
            continue
          } else {
            await page2.keyboard.press('Escape')
            await page2.waitForTimeout(300)
          }
        }

        // Try to advance via typed answer (if in typed test)
        const typedInput = page2.locator('input[type="text"]').first()
        if (await typedInput.count() > 0 && await typedInput.isVisible()) {
          console.log('  Answering typed question...')
          await typedInput.focus()
          // Get word and look up canonical answer
          const heading = await page2.locator('h1, h2, h3').first().innerText().catch(() => '')
          const wordMatch = auditState.lists.topActiveList.words.find(w =>
            heading.toLowerCase().includes(w.word.toLowerCase().replace(/\r\n.*/, '').trim())
          )
          const answer = wordMatch?.definition_en || 'test answer'
          for (const ch of answer.substring(0, 50)) {
            await typedInput.press(ch)
            await page2.waitForTimeout(30) // 30ms typing delay for speed
          }
          const submitBtn = page2.getByRole('button', { name: /submit|check/i }).first()
          if (await submitBtn.count() > 0) {
            await submitBtn.click()
            await page2.waitForTimeout(5000) // Wait for AI grading
          } else {
            await typedInput.press('Enter')
            await page2.waitForTimeout(5000)
          }
          continue
        }

        // Try MCQ option (if in review test)
        const mcqOptions = page2.locator('[role="radio"], button').filter({ hasText: /^[A-D]/ }).first()
        if (await mcqOptions.count() > 0 && await mcqOptions.isVisible()) {
          console.log('  Answering MCQ question...')
          await mcqOptions.click()
          await page2.waitForTimeout(500)
          const nextBtn = page2.getByRole('button', { name: /next|submit|check/i }).first()
          if (await nextBtn.count() > 0) {
            await nextBtn.click()
            await page2.waitForTimeout(1500)
          }
          continue
        }

        // Try clicking a flashcard to advance
        const cardArea = page2.locator('[class*="card"], [class*="flash"]').first()
        if (await cardArea.count() > 0) {
          await cardArea.click()
          await page2.waitForTimeout(500)
        }

        // Try generic Next button
        const nextBtn = page2.getByRole('button', { name: /next|continue|proceed/i }).first()
        if (await nextBtn.count() > 0 && await nextBtn.isVisible()) {
          await nextBtn.click()
          await page2.waitForTimeout(1000)
          continue
        }

        // If nothing worked, break
        console.log('  No advancement mechanism found, stopping phase walk')
        break
      }

      await takeScreenshot(page2, 'B05_v2_phasewalk_final')
      console.log('Phases visited:', phaseWalk.phasesVisited)
      console.log('Review test encountered:', phaseWalk.reviewTestEncountered)
      console.log('New word test encountered:', phaseWalk.newWordTestEncountered)
      console.log('Session complete:', phaseWalk.sessionComplete)

      findings.push({
        type: 'phase_walk',
        data: phaseWalk,
        consoleErrors: consoleErrors2,
      })

    } finally {
      await ctx2.close()
    }

    // ═══════════════════════════════════════════════════════════════
    // S04: firsttimerTOP Day insight - why does it show Day 1?
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== S04: firsttimerTOP Day Analysis ===')
    updateStatus('S04_day_analysis', trialsCompleted)

    const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx3.addInitScript(() => {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()))
      }
    })
    const page3 = await ctx3.newPage()

    const firsttimerFindings = {
      dashboardText: '',
      sessionDayShown: null,
      sessionStepsTotal: null,
      reviewMentioned: false,
      reviewTestPresent: false,
    }

    try {
      await loginAs(page3, FIRSTTIMER_TOP)
      await takeScreenshot(page3, 'B05_v2_firsttimer_01_dashboard')

      const dashText = await page3.innerText('body')
      firsttimerFindings.dashboardText = dashText.substring(0, 400)
      console.log('firsttimerTOP dashboard:', dashText.substring(0, 400))

      // Check if session is available
      const startBtn = page3.getByRole('button', { name: /start/i }).first()
      if (await startBtn.count() > 0) {
        await startBtn.click()
        await page3.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
        await dismissFlashcardModal(page3)
        await page3.waitForTimeout(500)

        await takeScreenshot(page3, 'B05_v2_firsttimer_02_session')
        const sessionBody = await page3.innerText('body')
        console.log('firsttimerTOP session body (first 600):', sessionBody.substring(0, 600))

        // Extract day number from session
        const dayMatch = sessionBody.match(/day (\d+)/i)
        if (dayMatch) {
          firsttimerFindings.sessionDayShown = parseInt(dayMatch[1])
          console.log('Day shown in session:', firsttimerFindings.sessionDayShown)
        }

        // Extract step count
        const stepMatch = sessionBody.match(/step \d+ of (\d+)/i)
        if (stepMatch) {
          firsttimerFindings.sessionStepsTotal = parseInt(stepMatch[1])
          console.log('Total steps in session:', firsttimerFindings.sessionStepsTotal)
        }

        // Check for review mention
        firsttimerFindings.reviewMentioned = /review/i.test(sessionBody)

        // Day 1 has 2 steps (NEW_WORDS + NEW_WORD_TEST), Day 2+ has more steps (includes review)
        // If firsttimer shows "Day 1" with 3 steps, that's an error
        // If shows "Day 2" with 3+ steps (NEW_WORDS + NEW_WORD_TEST + REVIEW_STUDY + REVIEW_TEST), correct

        findings.push({
          type: 'firsttimer_analysis',
          data: firsttimerFindings,
        })
      }

    } finally {
      await ctx3.close()
    }

    // Write findings summary
    const summary = {
      completedAt: new Date().toISOString(),
      findings,
      sessionStructure: findings.find(f => f.type === 'session_structure')?.data,
      phaseWalk: findings.find(f => f.type === 'phase_walk')?.data,
      firsttimerAnalysis: findings.find(f => f.type === 'firsttimer_analysis')?.data,
    }

    writeFileSync('/app/audit/playwright/findings/evidence/B05/B05_v2_results.json',
      JSON.stringify(summary, null, 2))

    console.log('\n=== V2 SUMMARY ===')
    console.log('Session structure:', JSON.stringify(summary.sessionStructure, null, 2))
    console.log('Phase walk:', JSON.stringify(summary.phaseWalk, null, 2))
    console.log('Firsttimer:', JSON.stringify(summary.firsttimerAnalysis, null, 2))

  } finally {
    await browser.close()
  }
}

runB05v2().then(() => {
  console.log('B05 v2 complete')
}).catch(err => {
  console.error('FATAL:', err)
  log({ event: 'error', error: err.message })
  process.exit(1)
})
