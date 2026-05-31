/**
 * B20 — Responsive Viewports Audit
 * Agent Z — Batch B20 only
 *
 * Tests mobile (375x812), tablet (768x1024), and desktop (1440x900) viewports
 * across key student-facing screens.
 */

import { chromium } from 'playwright'
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs'
import path from 'path'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B20'
const AGENT_LOG = '/app/audit/playwright/findings/agent_logs/Z.jsonl'
const STATUS_FILE = '/app/audit/playwright/findings/agent_logs/Z.status.json'

mkdirSync(EVIDENCE_DIR, { recursive: true })

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]

const SEEDED = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))

function getAccount(personaId, targetClass = null) {
  let candidates = SEEDED.accounts.filter(a => a.personaId === personaId)
  if (targetClass) candidates = candidates.filter(a => a.targetClass === targetClass)
  return candidates[0]
}

function logEvent(obj) {
  appendFileSync(AGENT_LOG, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n')
}

function updateStatus(patch) {
  let current = {}
  try { current = JSON.parse(readFileSync(STATUS_FILE, 'utf-8')) } catch (_) {}
  const next = { ...current, ...patch, lastUpdate: new Date().toISOString() }
  writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2))
}

const results = []

async function screenshot(page, label) {
  const filePath = path.join(EVIDENCE_DIR, `${label}.png`)
  await page.screenshot({ path: filePath, fullPage: false })
  return filePath
}

async function checkHorizontalScroll(page, vpName, screenName) {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth
  })
  return overflow
}

async function getConsoleErrors(page) {
  const errors = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  return errors
}

async function loginAs(page, personaId, targetClass = null) {
  const account = personaId === 'teacher'
    ? { email: 'veterans@vocaboost.com', password: 'veterans5944' }
    : getAccount(personaId, targetClass)

  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 })

  // Try to navigate to login
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await loginLink.count()) {
    await loginLink.click()
  } else {
    await page.evaluate(() => {
      history.pushState({}, '', '/login')
      dispatchEvent(new PopStateEvent('popstate'))
    })
  }
  await page.waitForTimeout(1000)

  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 })
  await page.getByLabel(/email/i).first().fill(account.email)
  await page.getByLabel(/password/i).first().fill(account.password)
  await page.getByLabel(/password/i).first().press('Enter')

  try {
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  } catch (_) {
    const btn = page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first()
    if (await btn.count()) await btn.click()
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  }
  return account
}

// ─── Core test runner ────────────────────────────────────────────────────────

async function runScenario(browser, scenarioId, scenarioDesc, fn) {
  updateStatus({ currentScenario: scenarioId })
  const start = Date.now()
  console.log(`\n[${scenarioId}] ${scenarioDesc}`)
  try {
    const result = await fn(browser)
    const durationMs = Date.now() - start
    results.push({ id: scenarioId, desc: scenarioDesc, result: result.status, issues: result.issues || [], durationMs })
    logEvent({ event: 'scenario', batch: 'B20', scenario: scenarioId, result: result.status, durationMs, ...(result.severity ? { severity: result.severity } : {}) })
    console.log(`  → ${result.status}${result.issues.length ? ' | Issues: ' + result.issues.join('; ') : ''}`)
    return result
  } catch (err) {
    const durationMs = Date.now() - start
    results.push({ id: scenarioId, desc: scenarioDesc, result: 'error', issues: [err.message], durationMs })
    logEvent({ event: 'scenario', batch: 'B20', scenario: scenarioId, result: 'blocked', reason: err.message, durationMs })
    console.error(`  → ERROR: ${err.message}`)
    return { status: 'error', issues: [err.message] }
  }
}

// ─── S01: Login page at 3 viewports ──────────────────────────────────────────
async function s01_login(browser) {
  const issues = []
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await ctx.newPage()
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
      // Navigate to login
      const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
      if (await loginLink.count()) {
        await loginLink.click()
        await page.waitForTimeout(1000)
      } else {
        await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
        await page.waitForTimeout(1000)
      }
      const overflow = await checkHorizontalScroll(page, vp.name, 'login')
      if (overflow) issues.push(`${vp.name}: horizontal overflow on login page`)
      await screenshot(page, `B20_S01_login_${vp.name}`)
      // Check email/password fields visible
      const emailField = page.getByLabel(/email/i).first()
      const pwField = page.getByLabel(/password/i).first()
      const emailVisible = await emailField.isVisible().catch(() => false)
      const pwVisible = await pwField.isVisible().catch(() => false)
      if (!emailVisible) issues.push(`${vp.name}: email field not visible`)
      if (!pwVisible) issues.push(`${vp.name}: password field not visible`)
      // Check button visibility
      const btn = page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first()
      const btnVisible = await btn.isVisible().catch(() => false)
      if (!btnVisible) issues.push(`${vp.name}: login button not visible`)
      // Check button tap target on mobile
      if (vp.name === 'mobile' && btnVisible) {
        const box = await btn.boundingBox()
        if (box && box.height < 44) issues.push(`${vp.name}: login button height ${box.height}px < 44px minimum`)
      }
    } finally {
      await ctx.close()
    }
  }
  return { status: issues.length === 0 ? 'pass' : 'fail', issues }
}

// ─── S02: Signup page at 3 viewports ─────────────────────────────────────────
async function s02_signup(browser) {
  const issues = []
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await ctx.newPage()
    try {
      await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
      // Navigate to signup
      const signupLink = page.getByRole('link', { name: /sign\s?up|register|create account/i }).first()
      if (await signupLink.count()) {
        await signupLink.click()
        await page.waitForTimeout(1000)
      } else {
        await page.evaluate(() => { history.pushState({}, '', '/signup'); dispatchEvent(new PopStateEvent('popstate')) })
        await page.waitForTimeout(1000)
      }
      const overflow = await checkHorizontalScroll(page, vp.name, 'signup')
      if (overflow) issues.push(`${vp.name}: horizontal overflow on signup page`)
      await screenshot(page, `B20_S02_signup_${vp.name}`)
      // Check form fields
      const nameField = page.getByLabel(/name/i).first()
      const emailField = page.getByLabel(/email/i).first()
      const nameVisible = await nameField.isVisible().catch(() => false)
      const emailVisible = await emailField.isVisible().catch(() => false)
      if (!nameVisible && !emailVisible) issues.push(`${vp.name}: signup form fields not visible`)
    } finally {
      await ctx.close()
    }
  }
  return { status: issues.length === 0 ? 'pass' : 'fail', issues }
}

// ─── S03: Student Dashboard at 3 viewports ───────────────────────────────────
async function s03_dashboard(browser) {
  const issues = []
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await ctx.newPage()
    try {
      await loginAs(page, 'careful', 'TOP')
      await page.waitForTimeout(2000)
      const overflow = await checkHorizontalScroll(page, vp.name, 'dashboard')
      if (overflow) issues.push(`${vp.name}: horizontal overflow on student dashboard`)
      await screenshot(page, `B20_S03_dashboard_${vp.name}`)
      // Check class card visible
      const classCard = page.getByText(/TOP|CORE|Vocabulary/i).first()
      const visible = await classCard.isVisible().catch(() => false)
      if (!visible) issues.push(`${vp.name}: class card not visible on dashboard`)
      // Check CTA buttons (Start Test / Continue)
      const startBtn = page.getByRole('button', { name: /start|continue|오늘의|study/i }).first()
      const startVisible = await startBtn.isVisible().catch(() => false)
      if (vp.name === 'mobile' && startVisible) {
        const box = await startBtn.boundingBox()
        if (box && box.height < 44) issues.push(`${vp.name}: Start button height ${box.height}px < 44px`)
        if (box && box.width < 44) issues.push(`${vp.name}: Start button width ${box.width}px < 44px`)
      }
    } catch (err) {
      issues.push(`${vp.name}: error - ${err.message}`)
    } finally {
      await ctx.close()
    }
  }
  return { status: issues.length === 0 ? 'pass' : (issues.some(i => i.includes('error')) ? 'partial' : 'fail'), issues }
}

// ─── S04: Teacher Dashboard at 3 viewports ───────────────────────────────────
async function s04_teacher_dashboard(browser) {
  const issues = []
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await ctx.newPage()
    try {
      await loginAs(page, 'teacher')
      await page.waitForTimeout(2000)
      const overflow = await checkHorizontalScroll(page, vp.name, 'teacher_dashboard')
      if (overflow) issues.push(`${vp.name}: horizontal overflow on teacher dashboard`)
      await screenshot(page, `B20_S04_teacher_dashboard_${vp.name}`)
    } catch (err) {
      issues.push(`${vp.name}: error - ${err.message}`)
    } finally {
      await ctx.close()
    }
  }
  return { status: issues.length === 0 ? 'pass' : 'partial', issues }
}

// ─── Helper: enter session via Skip to Test ──────────────────────────────────
async function enterSessionAndSkipToTest(page, personaId = 'careful', targetClass = 'TOP') {
  await loginAs(page, personaId, targetClass)
  await page.waitForTimeout(2000)

  // Click the start/continue button on dashboard
  const startBtn = page.getByRole('button', { name: /start|continue|study|begin|오늘/i }).first()
  if (await startBtn.count()) {
    await startBtn.click()
    await page.waitForTimeout(3000)
  }
  return page
}

// ─── S05: NEW_WORDS flashcard at 3 viewports ─────────────────────────────────
async function s05_new_words_card(browser) {
  const issues = []
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await ctx.newPage()
    try {
      await loginAs(page, 'careful', 'TOP')
      await page.waitForTimeout(2000)

      // Try to start session
      const startBtn = page.getByRole('button', { name: /start|continue|study|begin|오늘/i }).first()
      if (await startBtn.isVisible().catch(() => false)) {
        await startBtn.click()
        await page.waitForTimeout(3000)
      }

      const overflow = await checkHorizontalScroll(page, vp.name, 'new_words')
      if (overflow) issues.push(`${vp.name}: horizontal overflow on new words screen`)
      await screenshot(page, `B20_S05_new_words_${vp.name}`)

      // Look for flashcard word or session indicators
      const hasSessionContent = await page.getByText(/word|vocabulary|new|review|test|학습|단어/i).first().isVisible().catch(() => false)
      if (!hasSessionContent) {
        // May already be done for the day
        issues.push(`${vp.name}: no session content visible (may be day-complete state)`)
      }
    } catch (err) {
      issues.push(`${vp.name}: error - ${err.message}`)
    } finally {
      await ctx.close()
    }
  }
  return { status: issues.length === 0 ? 'pass' : 'partial', issues }
}

// ─── S06: REVIEW_STUDY card at 3 viewports (screenshot only) ─────────────────
async function s06_review_study_card(browser) {
  // This reuses the session started in S05 — just capture the review study screen
  // In practice the careful student may be in new-words or review phase
  const issues = []
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await ctx.newPage()
    try {
      await loginAs(page, 'careful', 'CORE')
      await page.waitForTimeout(2000)
      const startBtn = page.getByRole('button', { name: /start|continue|study|begin|오늘/i }).first()
      if (await startBtn.isVisible().catch(() => false)) {
        await startBtn.click()
        await page.waitForTimeout(3000)
      }
      const overflow = await checkHorizontalScroll(page, vp.name, 'review_study')
      if (overflow) issues.push(`${vp.name}: horizontal overflow on review study screen`)
      await screenshot(page, `B20_S06_review_study_${vp.name}`)
    } catch (err) {
      issues.push(`${vp.name}: error - ${err.message}`)
    } finally {
      await ctx.close()
    }
  }
  return { status: issues.length === 0 ? 'pass' : 'partial', issues }
}

// ─── S07: MCQ Test at 3 viewports ────────────────────────────────────────────
async function s07_mcq_test(browser) {
  const issues = []
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await ctx.newPage()
    const consoleErrors = []
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
    try {
      await loginAs(page, 'careful', 'TOP')
      await page.waitForTimeout(2000)

      // Navigate into session
      const startBtn = page.getByRole('button', { name: /start|continue|study|begin|오늘/i }).first()
      if (await startBtn.isVisible().catch(() => false)) {
        await startBtn.click()
        await page.waitForTimeout(3000)
      }

      // Try "Skip to Test" from session menu
      // Look for menu/hamburger icon
      const menuBtn = page.locator('button').filter({ hasText: /menu|≡|☰/ }).first()
      const settingsBtn = page.locator('[aria-label*="menu" i], [aria-label*="setting" i]').first()
      const skipBtn = page.getByText(/skip to test/i).first()

      let skipped = false
      if (await skipBtn.isVisible().catch(() => false)) {
        await skipBtn.click()
        await page.waitForTimeout(2000)
        const confirmBtn = page.getByRole('button', { name: /confirm|yes|continue|skip/i }).first()
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click()
          await page.waitForTimeout(3000)
        }
        skipped = true
      } else {
        // Try clicking session progress / 3-dot menu
        const dots = page.locator('button[aria-label*="more" i], button[aria-label*="option" i], [data-testid*="menu"]').first()
        if (await dots.isVisible().catch(() => false)) {
          await dots.click()
          await page.waitForTimeout(1000)
          const skipItem = page.getByText(/skip to test/i).first()
          if (await skipItem.isVisible().catch(() => false)) {
            await skipItem.click()
            await page.waitForTimeout(2000)
            skipped = true
          }
        }
      }

      const overflow = await checkHorizontalScroll(page, vp.name, 'mcq_test')
      if (overflow) issues.push(`${vp.name}: horizontal overflow on MCQ test`)
      await screenshot(page, `B20_S07_mcq_test_${vp.name}`)

      // Check MCQ options visible and tappable
      const mcqOptions = page.locator('button, [role="radio"], [role="option"]').filter({ hasText: /[A-D]\.|option/i })
      const optCount = await mcqOptions.count()
      if (optCount === 0) {
        // May still be in study phase; just document
        issues.push(`${vp.name}: MCQ options not found (may be in study/flashcard phase)`)
      } else if (vp.name === 'mobile') {
        // Check tap targets
        const first = mcqOptions.first()
        const box = await first.boundingBox()
        if (box && box.height < 44) issues.push(`${vp.name}: MCQ option height ${box.height}px < 44px`)
      }
    } catch (err) {
      issues.push(`${vp.name}: error - ${err.message}`)
    } finally {
      await ctx.close()
    }
  }
  return { status: issues.length === 0 ? 'pass' : 'partial', issues }
}

// ─── S08: Typed Test at 3 viewports ──────────────────────────────────────────
async function s08_typed_test(browser) {
  const issues = []
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      ...(vp.name === 'mobile' ? {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      } : {})
    })
    const page = await ctx.newPage()
    try {
      await loginAs(page, 'phone', vp.name === 'mobile' ? null : 'TOP')
      await page.waitForTimeout(2000)

      const startBtn = page.getByRole('button', { name: /start|continue|study|begin|오늘/i }).first()
      if (await startBtn.isVisible().catch(() => false)) {
        await startBtn.click()
        await page.waitForTimeout(3000)
      }

      // Try to find Skip to Test
      const skipLink = page.getByText(/skip to test/i).first()
      if (await skipLink.isVisible().catch(() => false)) {
        await skipLink.click()
        await page.waitForTimeout(2000)
        const confirmBtn = page.getByRole('button', { name: /confirm|yes|skip|continue/i }).first()
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click()
          await page.waitForTimeout(3000)
        }
      }

      const overflow = await checkHorizontalScroll(page, vp.name, 'typed_test')
      if (overflow) issues.push(`${vp.name}: horizontal overflow on typed test`)
      await screenshot(page, `B20_S08_typed_test_${vp.name}`)

      // Check text input visible
      const textInput = page.locator('input[type="text"], textarea').first()
      const inputVisible = await textInput.isVisible().catch(() => false)
      if (inputVisible) {
        // Check input not obscured — get its bounding box
        const box = await textInput.boundingBox()
        if (box) {
          // On mobile, if input is in bottom half, likely covered by keyboard
          // At least check it's in viewport
          if (box.y > vp.height) {
            issues.push(`${vp.name}: text input is below viewport (y=${box.y}, viewport=${vp.height})`)
          }
        }
        // Check submit button
        const submitBtn = page.getByRole('button', { name: /submit|next|continue|제출/i }).first()
        const submitVisible = await submitBtn.isVisible().catch(() => false)
        if (!submitVisible) {
          issues.push(`${vp.name}: Submit button not visible on typed test`)
        } else if (vp.name === 'mobile') {
          const subBox = await submitBtn.boundingBox()
          if (subBox && subBox.height < 44) issues.push(`${vp.name}: Submit button height ${subBox.height}px < 44px`)
        }
      } else {
        issues.push(`${vp.name}: typed test input not visible (may be in study/flashcard phase)`)
      }
    } catch (err) {
      issues.push(`${vp.name}: error - ${err.message}`)
    } finally {
      await ctx.close()
    }
  }
  return { status: issues.length === 0 ? 'pass' : 'partial', issues }
}

// ─── S09: Blind Spot Test at 3 viewports ─────────────────────────────────────
async function s09_blind_spot(browser) {
  // Blind spot test is triggered from results when certain words are missed
  // We'll navigate to the app and look for blind spot state
  const issues = []
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await ctx.newPage()
    try {
      await loginAs(page, 'careful', 'TOP')
      await page.waitForTimeout(2000)
      // Navigate via client-side routing to see if blind spot route exists
      await page.evaluate(() => { history.pushState({}, '', '/session'); dispatchEvent(new PopStateEvent('popstate')) })
      await page.waitForTimeout(2000)
      const overflow = await checkHorizontalScroll(page, vp.name, 'blind_spot')
      if (overflow) issues.push(`${vp.name}: horizontal overflow on blind spot / session screen`)
      await screenshot(page, `B20_S09_blind_spot_${vp.name}`)
    } catch (err) {
      issues.push(`${vp.name}: error - ${err.message}`)
    } finally {
      await ctx.close()
    }
  }
  return { status: 'partial', issues: issues.length > 0 ? issues : ['blind spot test requires completed failed test to trigger — captured session screen instead'] }
}

// ─── S10: Test Results screen at 3 viewports ─────────────────────────────────
async function s10_results_screen(browser) {
  const issues = []
  // We need to complete a test to get results. The results screen may have been
  // captured by other agents (B02/B03). We'll navigate to the dashboard and see
  // if there's a recent results link, or capture what we can.
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await ctx.newPage()
    try {
      await loginAs(page, 'careful', 'TOP')
      await page.waitForTimeout(2000)

      // Look for a "Results" or "View Results" link on dashboard
      const resultsLink = page.getByRole('link', { name: /result|view|성적|점수/i }).first()
      const resultsBtn = page.getByRole('button', { name: /result|view|성적|점수/i }).first()

      if (await resultsLink.isVisible().catch(() => false)) {
        await resultsLink.click()
        await page.waitForTimeout(2000)
      } else if (await resultsBtn.isVisible().catch(() => false)) {
        await resultsBtn.click()
        await page.waitForTimeout(2000)
      }

      const overflow = await checkHorizontalScroll(page, vp.name, 'results')
      if (overflow) issues.push(`${vp.name}: horizontal overflow on results screen`)
      await screenshot(page, `B20_S10_results_${vp.name}`)
    } catch (err) {
      issues.push(`${vp.name}: error - ${err.message}`)
    } finally {
      await ctx.close()
    }
  }
  return { status: 'partial', issues: issues.length > 0 ? issues : ['results screen may not be accessible without completing a test'] }
}

// ─── S11: Teacher List Editor at 3 viewports ─────────────────────────────────
async function s11_list_editor(browser) {
  const issues = []
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await ctx.newPage()
    try {
      await loginAs(page, 'teacher')
      await page.waitForTimeout(2000)

      // Navigate to list management
      const listsLink = page.getByRole('link', { name: /list|vocabulary|단어/i }).first()
      if (await listsLink.isVisible().catch(() => false)) {
        await listsLink.click()
        await page.waitForTimeout(2000)
      }

      const overflow = await checkHorizontalScroll(page, vp.name, 'list_editor')
      if (overflow) issues.push(`${vp.name}: horizontal overflow on list editor`)
      await screenshot(page, `B20_S11_list_editor_${vp.name}`)
    } catch (err) {
      issues.push(`${vp.name}: error - ${err.message}`)
    } finally {
      await ctx.close()
    }
  }
  return { status: issues.length === 0 ? 'pass' : 'partial', issues }
}

// ─── S12: Teacher Gradebook at 3 viewports ───────────────────────────────────
async function s12_gradebook(browser) {
  const issues = []
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await ctx.newPage()
    try {
      await loginAs(page, 'teacher')
      await page.waitForTimeout(2000)

      // Navigate to gradebook
      const gbLink = page.getByRole('link', { name: /gradebook|grade|성적/i }).first()
      if (await gbLink.isVisible().catch(() => false)) {
        await gbLink.click()
        await page.waitForTimeout(2000)
      }

      const overflow = await checkHorizontalScroll(page, vp.name, 'gradebook')
      if (overflow) issues.push(`${vp.name}: horizontal overflow on gradebook`)
      await screenshot(page, `B20_S12_gradebook_${vp.name}`)

      // For mobile, gradebook tables are notoriously hard to use
      if (vp.name === 'mobile') {
        // Check if table is scrollable or responsive
        const table = page.locator('table').first()
        if (await table.isVisible().catch(() => false)) {
          const tableBox = await table.boundingBox()
          if (tableBox && tableBox.width > vp.width) {
            issues.push(`${vp.name}: gradebook table wider than viewport (${tableBox.width}px > ${vp.width}px) — needs horizontal scroll container`)
          }
        }
      }
    } catch (err) {
      issues.push(`${vp.name}: error - ${err.message}`)
    } finally {
      await ctx.close()
    }
  }
  return { status: issues.length === 0 ? 'pass' : 'partial', issues }
}

// ─── S13: Challenge Dispute Modal at 3 viewports ─────────────────────────────
async function s13_challenge_modal(browser) {
  const issues = []
  // Challenge modal appears on results screen — we need to be on results page
  // We'll capture the dashboard and any accessible modal state
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await ctx.newPage()
    try {
      await loginAs(page, 'anxious', 'TOP')
      await page.waitForTimeout(2000)

      // Look for challenge/dispute option
      const challengeBtn = page.getByRole('button', { name: /challenge|dispute|이의/i }).first()
      if (await challengeBtn.isVisible().catch(() => false)) {
        await challengeBtn.click()
        await page.waitForTimeout(1500)
        // Check modal visible and not cut off
        const modal = page.locator('[role="dialog"], .modal, [aria-modal]').first()
        if (await modal.isVisible().catch(() => false)) {
          const overflow = await checkHorizontalScroll(page, vp.name, 'challenge_modal')
          if (overflow) issues.push(`${vp.name}: horizontal overflow with modal open`)
          // Check modal not cut off on mobile
          const modalBox = await modal.boundingBox()
          if (modalBox && vp.name === 'mobile') {
            if (modalBox.y + modalBox.height > vp.height) {
              issues.push(`${vp.name}: challenge modal extends below viewport (${modalBox.y + modalBox.height}px > ${vp.height}px)`)
            }
          }
        }
      }

      await screenshot(page, `B20_S13_challenge_${vp.name}`)
    } catch (err) {
      issues.push(`${vp.name}: error - ${err.message}`)
    } finally {
      await ctx.close()
    }
  }
  return { status: 'partial', issues: issues.length > 0 ? issues : ['challenge modal requires completed test with gradeable answers to trigger'] }
}

// ─── S14: Class Roster at 3 viewports ────────────────────────────────────────
async function s14_class_roster(browser) {
  const issues = []
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await ctx.newPage()
    try {
      await loginAs(page, 'teacher')
      await page.waitForTimeout(2000)

      // Navigate to class/roster
      const classLink = page.getByRole('link', { name: /class|roster|student|학생/i }).first()
      if (await classLink.isVisible().catch(() => false)) {
        await classLink.click()
        await page.waitForTimeout(2000)
      }

      const overflow = await checkHorizontalScroll(page, vp.name, 'class_roster')
      if (overflow) issues.push(`${vp.name}: horizontal overflow on class roster`)
      await screenshot(page, `B20_S14_class_roster_${vp.name}`)
    } catch (err) {
      issues.push(`${vp.name}: error - ${err.message}`)
    } finally {
      await ctx.close()
    }
  }
  return { status: issues.length === 0 ? 'pass' : 'partial', issues }
}

// ─── S15: Mobile bottom-sheet modals ─────────────────────────────────────────
async function s15_mobile_modals(browser) {
  const issues = []
  const vp = { width: 375, height: 812 }
  const ctx = await browser.newContext({ viewport: vp, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' })
  const page = await ctx.newPage()
  try {
    await loginAs(page, 'phone')
    await page.waitForTimeout(2000)

    // Navigate to session
    const startBtn = page.getByRole('button', { name: /start|continue|study|begin|오늘/i }).first()
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click()
      await page.waitForTimeout(3000)
    }
    await screenshot(page, 'B20_S15_mobile_session_start')

    // Look for any drawer/sheet controls
    const drawerTriggers = page.locator('[aria-label*="progress" i], [aria-label*="menu" i], button[aria-expanded]')
    const count = await drawerTriggers.count()
    for (let i = 0; i < Math.min(count, 3); i++) {
      try {
        const trigger = drawerTriggers.nth(i)
        if (await trigger.isVisible().catch(() => false)) {
          await trigger.click()
          await page.waitForTimeout(1000)
          // Check any open modal/drawer
          const modal = page.locator('[role="dialog"], [data-state="open"], .sheet, .drawer').first()
          if (await modal.isVisible().catch(() => false)) {
            const box = await modal.boundingBox()
            if (box && box.y + box.height > vp.height + 10) {
              issues.push(`modal extends ${box.y + box.height - vp.height}px below viewport at mobile`)
            }
            await screenshot(page, `B20_S15_mobile_modal_${i}`)
            // Close it
            const closeBtn = page.getByRole('button', { name: /close|cancel|×/i }).first()
            if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click()
            await page.keyboard.press('Escape')
          }
        }
      } catch (_) {}
    }
  } catch (err) {
    issues.push(`error - ${err.message}`)
  } finally {
    await ctx.close()
  }
  return { status: issues.length === 0 ? 'pass' : 'partial', issues }
}

// ─── S16: Mobile SessionProgressSheet drawer ──────────────────────────────────
async function s16_mobile_progress_sheet(browser) {
  const issues = []
  const vp = { width: 375, height: 812 }
  const ctx = await browser.newContext({ viewport: vp, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' })
  const page = await ctx.newPage()
  try {
    await loginAs(page, 'phone')
    await page.waitForTimeout(2000)

    const startBtn = page.getByRole('button', { name: /start|continue|study|begin|오늘/i }).first()
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click()
      await page.waitForTimeout(3000)
    }

    // Look for session progress drawer — could be a hamburger, progress bar click, etc.
    const possibleTriggers = [
      page.locator('[aria-label*="progress" i]').first(),
      page.locator('[aria-label*="session" i]').first(),
      page.locator('button').filter({ hasText: /\d+\/\d+|\d+%/ }).first(),
      page.locator('[data-testid*="progress"]').first(),
    ]

    let drawerFound = false
    for (const trigger of possibleTriggers) {
      if (await trigger.isVisible().catch(() => false)) {
        await trigger.click()
        await page.waitForTimeout(1000)
        const sheet = page.locator('[role="dialog"], [data-state="open"], [class*="sheet" i], [class*="drawer" i]').first()
        if (await sheet.isVisible().catch(() => false)) {
          drawerFound = true
          await screenshot(page, 'B20_S16_progress_sheet_mobile')
          // Verify "Skip to Test" button is reachable
          const skipBtn = page.getByText(/skip to test/i).first()
          if (await skipBtn.isVisible().catch(() => false)) {
            const box = await skipBtn.boundingBox()
            if (box && box.height < 44) issues.push(`Skip to Test button height ${box.height}px < 44px on mobile`)
          } else {
            issues.push('Skip to Test button not visible in mobile progress sheet')
          }
          break
        }
      }
    }

    if (!drawerFound) {
      // Check if there's a visible "Skip to Test" text anywhere
      const skipText = page.getByText(/skip to test/i).first()
      if (await skipText.isVisible().catch(() => false)) {
        await screenshot(page, 'B20_S16_skip_to_test_visible')
      } else {
        issues.push('SessionProgressSheet drawer not found / not accessible at mobile viewport — no drawer trigger found')
      }
    }

    await screenshot(page, 'B20_S16_mobile_full')
  } catch (err) {
    issues.push(`error - ${err.message}`)
  } finally {
    await ctx.close()
  }
  return { status: issues.length === 0 ? 'pass' : 'partial', issues }
}

// ─── S17: Tablet split-view simulation ───────────────────────────────────────
async function s17_tablet_splitview(browser) {
  const issues = []
  const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 } })
  const page = await ctx.newPage()
  try {
    await loginAs(page, 'careful', 'TOP')
    await page.waitForTimeout(2000)

    // Start session
    const startBtn = page.getByRole('button', { name: /start|continue|study|begin|오늘/i }).first()
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click()
      await page.waitForTimeout(3000)
    }

    // Simulate split-view: resize to half-iPad width
    await page.setViewportSize({ width: 375, height: 1024 })
    await page.waitForTimeout(1000)
    const overflow1 = await checkHorizontalScroll(page, 'split_narrow', 'session')
    if (overflow1) issues.push('horizontal overflow when window shrinks to 375px mid-session (split-view)')
    await screenshot(page, 'B20_S17_split_narrow')

    // Check for crashes (error boundaries)
    const errorBoundary = page.getByText(/something went wrong|error|crash/i).first()
    if (await errorBoundary.isVisible().catch(() => false)) {
      issues.push('Error boundary visible after viewport resize mid-session')
    }

    // Restore
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(1000)
    const overflow2 = await checkHorizontalScroll(page, 'split_restored', 'session')
    if (overflow2) issues.push('horizontal overflow after restoring to 768px')
    await screenshot(page, 'B20_S17_split_restored')
  } catch (err) {
    issues.push(`error - ${err.message}`)
  } finally {
    await ctx.close()
  }
  return { status: issues.length === 0 ? 'pass' : 'partial', issues }
}

// ─── S18: Desktop extra horizontal space ─────────────────────────────────────
async function s18_desktop_space(browser) {
  const issues = []
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  try {
    await loginAs(page, 'careful', 'TOP')
    await page.waitForTimeout(2000)

    // Check main content width — should not be a tiny centered strip
    const main = page.locator('main, [role="main"], .container, #root > *').first()
    if (await main.isVisible().catch(() => false)) {
      const box = await main.boundingBox()
      if (box) {
        // If main content is less than 600px on a 1440px screen, that's wasted space
        if (box.width < 600) {
          issues.push(`Desktop: main content only ${box.width}px wide on 1440px viewport — possible narrow-strip layout`)
        }
        // If it's the full 1440, that's fine; if it's capped at ~1200, also fine
      }
    }
    await screenshot(page, 'B20_S18_desktop_1440')

    // Navigate into session
    const startBtn = page.getByRole('button', { name: /start|continue|study|begin|오늘/i }).first()
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click()
      await page.waitForTimeout(3000)
      await screenshot(page, 'B20_S18_desktop_session')
      const sessionMain = page.locator('main, [role="main"], .container').first()
      if (await sessionMain.isVisible().catch(() => false)) {
        const sbox = await sessionMain.boundingBox()
        if (sbox && sbox.width < 600) {
          issues.push(`Desktop session: main content only ${sbox.width}px wide on 1440px — wasted horizontal space`)
        }
      }
    }
  } catch (err) {
    issues.push(`error - ${err.message}`)
  } finally {
    await ctx.close()
  }
  return { status: issues.length === 0 ? 'pass' : 'partial', issues }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('B20 Responsive Viewports Audit — Agent Z')
  console.log('='.repeat(50))

  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  const startTime = Date.now()

  try {
    await runScenario(browser, 'S01', 'Login page at 3 viewports', s01_login)
    await runScenario(browser, 'S02', 'Signup page at 3 viewports', s02_signup)
    await runScenario(browser, 'S03', 'Student dashboard at 3 viewports', s03_dashboard)
    await runScenario(browser, 'S04', 'Teacher dashboard at 3 viewports', s04_teacher_dashboard)
    await runScenario(browser, 'S05', 'NEW_WORDS flashcard at 3 viewports', s05_new_words_card)
    await runScenario(browser, 'S06', 'REVIEW_STUDY card at 3 viewports', s06_review_study_card)
    await runScenario(browser, 'S07', 'MCQ test at 3 viewports', s07_mcq_test)
    await runScenario(browser, 'S08', 'Typed test at 3 viewports', s08_typed_test)
    await runScenario(browser, 'S09', 'Blind spot test at 3 viewports', s09_blind_spot)
    await runScenario(browser, 'S10', 'Results screen at 3 viewports', s10_results_screen)
    await runScenario(browser, 'S11', 'Teacher list editor at 3 viewports', s11_list_editor)
    await runScenario(browser, 'S12', 'Teacher gradebook at 3 viewports', s12_gradebook)
    await runScenario(browser, 'S13', 'Challenge dispute modal at 3 viewports', s13_challenge_modal)
    await runScenario(browser, 'S14', 'Class roster at 3 viewports', s14_class_roster)
    await runScenario(browser, 'S15', 'Mobile: bottom-sheet modals', s15_mobile_modals)
    await runScenario(browser, 'S16', 'Mobile: SessionProgressSheet drawer', s16_mobile_progress_sheet)
    await runScenario(browser, 'S17', 'Tablet: split-view resize mid-session', s17_tablet_splitview)
    await runScenario(browser, 'S18', 'Desktop: horizontal space usage at 1440px', s18_desktop_space)
  } finally {
    await browser.close()
  }

  const totalMs = Date.now() - startTime
  console.log('\n' + '='.repeat(50))
  console.log(`Completed in ${Math.round(totalMs / 1000)}s`)
  console.log('\nResults:')
  for (const r of results) {
    const icon = r.result === 'pass' ? '✅' : r.result === 'partial' ? '🟡' : r.result === 'fail' ? '❌' : '⛔'
    console.log(`  ${icon} ${r.id}: ${r.result}`)
    if (r.issues.length > 0) {
      for (const issue of r.issues) console.log(`       ⚠ ${issue}`)
    }
  }

  // Write results JSON
  writeFileSync(
    path.join(EVIDENCE_DIR, 'B20_results.json'),
    JSON.stringify({ run: new Date().toISOString(), totalMs, results }, null, 2)
  )

  return results
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
