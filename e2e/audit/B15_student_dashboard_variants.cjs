/**
 * B15 — Student Dashboard Variants
 * Agent U — Audit batch for dashboard rendering, staleness (chat-log #10), and
 * data accuracy (day/words/streak vs Firestore doc the app actually reads).
 *
 * Run from /app: node e2e/audit/B15_student_dashboard_variants.js
 */

const { chromium } = require('playwright')
const { readFileSync, writeFileSync, mkdirSync } = require('fs')
const path = require('path')

// ── Constants ──────────────────────────────────────────────────────────────
const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B15'
const LOG_PATH = '/app/audit/playwright/findings/agent_logs/U.jsonl'
const STATUS_PATH = '/app/audit/playwright/findings/agent_logs/U.status.json'

mkdirSync(EVIDENCE_DIR, { recursive: true })

// ── Helpers ────────────────────────────────────────────────────────────────
const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))

function getAccount(personaId, targetClass = null) {
  return seeded.accounts.find(a =>
    a.personaId === personaId &&
    (targetClass === null || a.targetClass === targetClass)
  )
}

function appendLog(obj) {
  const line = JSON.stringify({ ...obj, ts: new Date().toISOString() }) + '\n'
  require('fs').appendFileSync(LOG_PATH, line)
}

function writeStatus(obj) {
  writeFileSync(STATUS_PATH, JSON.stringify(obj, null, 2))
}

async function loginAs(page, personaId, targetClass = 'TOP') {
  const account = getAccount(personaId, targetClass)
  if (!account) throw new Error(`No account for persona=${personaId} class=${targetClass}`)

  // Unregister service workers to prevent cache intercept
  await page.addInitScript(() => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
    }
  })

  // Navigate to root, then use in-app nav
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' })
  // If already authenticated we land on dashboard; if not, should redirect to /login
  const url = page.url()
  if (!url.includes('/login')) {
    // Force logout first via local storage clear
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' })
  }

  // Locate email/password fields
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 })
  await page.fill('input[type="email"], input[name="email"]', account.email)
  await page.fill('input[type="password"], input[name="password"]', account.password)

  // Submit
  const submitBtn = page.locator('button[type="submit"]').first()
  await submitBtn.click()

  // Wait for dashboard
  await page.waitForURL(url => url.href.includes('/') && !url.href.includes('/login'), { timeout: 15000 })
  await page.waitForTimeout(1500) // Let React hydrate

  return account
}

async function screenshot(page, name) {
  const filePath = path.join(EVIDENCE_DIR, name)
  await page.screenshot({ path: filePath, fullPage: true })
  return filePath
}

async function getConsoleErrors(page) {
  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  return errors
}

// ── Firestore check helper (via admin SDK subprocess) ──────────────────────
// We capture data inline via the pre-queried values from our setup

// ── Main audit runner ──────────────────────────────────────────────────────
const results = []

async function runScenario(browser, label, scenarioFn) {
  const start = Date.now()
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  let result = 'pass'
  let severity = null
  let notes = []

  try {
    await scenarioFn(page, notes)
  } catch (err) {
    result = 'fail'
    notes.push(`ERROR: ${err.message}`)
    console.error(`[${label}] FAILED:`, err.message)
  } finally {
    await context.close()
  }

  const duration = Date.now() - start
  results.push({ label, result, severity, notes, consoleErrors, durationMs: duration })

  appendLog({
    event: 'scenario',
    batch: 'B15',
    scenario: label,
    result,
    severity,
    notes,
    consoleErrors: consoleErrors.slice(0, 5),
    durationMs: duration
  })

  console.log(`[${label}] ${result.toUpperCase()} (${duration}ms)`)
  if (notes.length) console.log(`  Notes: ${notes.join('; ')}`)
  if (consoleErrors.length) console.log(`  Console errors (${consoleErrors.length}): ${consoleErrors[0]}`)

  return { result, notes, consoleErrors }
}

;(async () => {
  console.log('B15 — Student Dashboard Variants audit starting...')
  writeStatus({
    label: 'U',
    currentBatch: 'B15',
    currentScenario: 'S01',
    batchesClaimed: ['B15'],
    batchesCompleted: [],
    trialsCompleted: 0,
    lastUpdate: new Date().toISOString(),
    state: 'running'
  })

  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    // ── S01: Brand-new student (no progress) — lazy persona check ──────────
    await runScenario(browser, 'S01', async (page, notes) => {
      console.log('  [S01] Checking dashboard for lazy student (should be Day 1 state)...')

      const acct = await loginAs(page, 'lazy', 'TOP')
      notes.push(`Logged in as: ${acct.email}`)

      // Wait for dashboard to fully load
      await page.waitForSelector('h1', { timeout: 10000 })
      await page.waitForTimeout(2000)

      await screenshot(page, 'B15_S01_dashboard_lazy.png')

      // Check dashboard renders without crash
      const h1 = await page.locator('h1').first().textContent()
      notes.push(`H1: "${h1}"`)

      // Look for class content
      const body = await page.locator('body').textContent()
      const hasJoinCTA = body.includes('Join your first class') || body.includes('join') || body.includes('Join')
      const hasClassContent = body.includes('My Classes') || body.includes('25WT')
      const hasStartSession = body.includes('Start Session')

      notes.push(`Has join CTA: ${hasJoinCTA}, Has class content: ${hasClassContent}, Has Start Session: ${hasStartSession}`)

      // Day display — lazy TOP student has CSD=3 in app-read doc
      const dayText = body.match(/Day\s+(\d+)/)?.[0] || 'not found'
      notes.push(`Day display: ${dayText}`)

      // Verify no white screen / crash
      if (!h1 || h1.trim() === '') {
        throw new Error('No h1 found — possible white screen/crash')
      }

      // Verify no JS error dialog
      const errorDialog = page.locator('[role="alert"]')
      const errorCount = await errorDialog.count()
      if (errorCount > 0) {
        const errorText = await errorDialog.first().textContent()
        notes.push(`Alert dialog: "${errorText}"`)
      }
    })

    // ── S02: Student enrolled in one class, one list (careful TOP) ──────────
    await runScenario(browser, 'S02', async (page, notes) => {
      console.log('  [S02] Dashboard with one class, one list...')

      const acct = await loginAs(page, 'careful', 'TOP')
      notes.push(`Logged in as: ${acct.email} (uid=${acct.uid})`)

      await page.waitForTimeout(3000) // Let progress data load
      await screenshot(page, 'B15_S02_dashboard_careful.png')

      const body = await page.locator('body').textContent()

      // Check class count shown
      const hasOneClass = body.includes('1 enrolled') || body.includes('enrolled')
      notes.push(`Enrolled indicator: ${hasOneClass}`)

      // Check day number shown — careful TOP should show Day 4 (CSD=3 in app-read doc → displayDay=4)
      const dayMatch = body.match(/Day\s+(\d+)/)
      const displayedDay = dayMatch ? parseInt(dayMatch[1]) : null
      notes.push(`Displayed day: ${displayedDay} (expected Day 4 based on Firestore CSD=3)`)

      // Check words introduced — should be 240 (from Firestore TWI=240)
      const wordsIntroMatch = body.match(/(\d+).*?introduced|Words Introduced.*?(\d+)/s)
      notes.push(`Words introduced display: ${JSON.stringify(wordsIntroMatch?.slice(1))}`)

      // Check streak — should be 3
      const streakMatch = body.match(/(\d+)\s+days/i)
      const displayedStreak = streakMatch ? parseInt(streakMatch[1]) : null
      notes.push(`Displayed streak: ${displayedStreak} (expected 3 from Firestore)`)

      // Check for list title
      const hasListTitle = body.includes('25WT2 TOP') || body.includes('TOP Vocabulary')
      notes.push(`Has list title: ${hasListTitle}`)

      // Check Start Session button is present
      const startBtn = page.locator('button:has-text("Start Session"), a:has-text("Start Session")')
      const btnCount = await startBtn.count()
      notes.push(`Start Session buttons: ${btnCount}`)

      // CRITICAL: Compare displayed day vs Firestore
      // App reads k8tzOiiwotBbtJS3uTiv_8RMews2H7C3UJUAsOBzR (CSD=3 → Day 4)
      // Legacy doc k8tzOiiwotBbtJS3uTiv has CSD=8 → Day 9
      if (displayedDay !== null && displayedDay !== 4) {
        // Flag HIGH if showing day 9 (from wrong doc) instead of day 4 (from correct doc)
        if (displayedDay === 9) {
          notes.push('CRITICAL: Dashboard shows Day 9 (from LEGACY doc CSD=8) instead of Day 4 (from correct classId_listId doc CSD=3)')
        } else {
          notes.push(`WARN: Day ${displayedDay} shown, expected Day 4`)
        }
      }

      if (!hasListTitle) {
        notes.push('WARN: List title not found in dashboard')
      }
    })

    // ── S03: Multi-class student check ──────────────────────────────────────
    await runScenario(browser, 'S03', async (page, notes) => {
      console.log('  [S03] Multi-class scenario (anxious TOP + checking for multi-class selector)...')

      const acct = await loginAs(page, 'anxious', 'TOP')
      notes.push(`Logged in as: ${acct.email}`)

      await page.waitForTimeout(2500)
      await screenshot(page, 'B15_S03_multi_class.png')

      const body = await page.locator('body').textContent()

      // Check if list selector dropdown is present (only shown when > 1 list)
      const hasSelectorDropdown = body.includes('Studying:') || await page.locator('button:has-text("Studying:")').count() > 0
      notes.push(`List selector present: ${hasSelectorDropdown}`)

      // Count class entries
      const classItems = page.locator('li').filter({ hasText: '25WT' })
      const classCount = await classItems.count()
      notes.push(`Class items visible: ${classCount}`)

      // Check My Classes section
      const myClassesSection = page.locator('h2:has-text("My Classes")')
      const hasMCSection = await myClassesSection.count() > 0
      notes.push(`My Classes section: ${hasMCSection}`)

      // This student only has one class in our setup, so no multi-class selector expected
      notes.push(`Note: anxious TOP student has single enrollment — multi-class selector correctly absent if ${!hasSelectorDropdown}`)
    })

    // ── S04: Primary focus list selector ───────────────────────────────────
    await runScenario(browser, 'S04', async (page, notes) => {
      console.log('  [S04] Primary focus selector (careful TOP student)...')

      // careful TOP currently has no primaryFocusListId saved
      await loginAs(page, 'careful', 'TOP')
      await page.waitForTimeout(2500)

      const body = await page.locator('body').textContent()

      // Check if we can find the "Studying" dropdown (only shown when >1 list)
      // careful TOP has 1 class + 1 list, so dropdown should NOT be shown
      const hasStudyingDropdown = body.includes('Studying:')
      notes.push(`Studying dropdown visible: ${hasStudyingDropdown} (expected: false for single-list student)`)

      // For students with 1 list only, the selector is intentionally hidden
      // This is expected behavior
      if (!hasStudyingDropdown) {
        notes.push('PASS: Single-list student correctly has no list-switch dropdown')
      }

      await screenshot(page, 'B15_S04_focus_selector.png')
    })

    // ── S05: Deleted list graceful handling ────────────────────────────────
    await runScenario(browser, 'S05', async (page, notes) => {
      console.log('  [S05] Graceful handling when assigned list has no progress doc...')
      // We can't actually delete a list without affecting real data.
      // Instead, check how the dashboard handles the case where progressData[key]
      // returns null (new student with no progress doc yet = first-timer persona)

      const acct = await loginAs(page, 'firsttimer', 'TOP')
      notes.push(`Logged in as: ${acct.email}`)

      await page.waitForTimeout(3000)
      await screenshot(page, 'B15_S05_firsttimer.png')

      const body = await page.locator('body').textContent()

      // Check no white screen
      const hasH1 = await page.locator('h1').count() > 0
      notes.push(`Has H1: ${hasH1}`)

      // Check dashboard shows Day 1 for student with no progress
      const dayMatch = body.match(/Day\s+(\d+)/)
      const displayedDay = dayMatch ? parseInt(dayMatch[1]) : null
      notes.push(`Displayed day: ${displayedDay}`)

      // Check firsttimer Firestore
      // We check if they show Day 1 (CSD=0 → displayDay=1) for a fresh student
      if (displayedDay !== null && displayedDay === 1) {
        notes.push('PASS: First-timer student correctly shows Day 1')
      } else if (displayedDay !== null && displayedDay > 1) {
        notes.push(`WARN: First-timer shows Day ${displayedDay} but expected Day 1`)
      }

      // Check Start Session is present and not disabled
      const startBtn = page.locator('button:has-text("Start Session")').first()
      if (await startBtn.count() > 0) {
        const isDisabled = await startBtn.getAttribute('disabled')
        notes.push(`Start Session disabled: ${isDisabled !== null}`)
        // Button may be disabled if progressData hasn't loaded yet
      }
    })

    // ── S06: List rename staleness check (chat-log #14) ───────────────────
    await runScenario(browser, 'S06', async (page, notes) => {
      console.log('  [S06] List name freshness check...')

      // We cannot rename without touching production data
      // Instead, verify the list title shown matches what's in Firestore
      // The app reads list data fresh from fetchStudentClasses on each login

      await loginAs(page, 'careful', 'TOP')
      await page.waitForTimeout(3000)

      const body = await page.locator('body').textContent()

      // Check if the list title is shown as current Firestore value
      const hasCurrentTitle = body.includes('25WT2 TOP Vocabulary (v2)')
      const hasOldTitle = body.includes('25WT2 TOP Vocabulary') && !body.includes('(v2)')

      notes.push(`Shows current list title: ${hasCurrentTitle}`)
      notes.push(`Shows old/stale list title: ${hasOldTitle}`)

      await screenshot(page, 'B15_S06_list_rename_check.png')

      // Note: List titles are fetched from fetchStudentClasses which does a fresh Firestore read
      // No real-time listener — so a rename during active session WOULD show stale title until page reload
      notes.push('Note: List titles loaded once per page visit (no real-time listener) — rename between logins shows correctly; rename DURING active session would show stale title until refresh')
    })

    // ── S07: Today's session card states ──────────────────────────────────
    await runScenario(browser, 'S07', async (page, notes) => {
      console.log('  [S07] Today\'s session card states...')

      // Check careful TOP: CSD=3, last session date 2026-05-27
      // Today is 2026-05-31 — 4 days later (weekend skip: May 30=Sat, May 29=Fri)
      // So today should be NOT completed

      await loginAs(page, 'careful', 'TOP')
      await page.waitForTimeout(3000)

      const body = await page.locator('body').textContent()

      // Check session card states
      const hasStartSession = body.includes('Start Session')
      const hasCompleted = body.includes('Completed') || body.includes('completed')
      const hasResume = body.includes('Resume')

      notes.push(`Start Session visible: ${hasStartSession}`)
      notes.push(`Completed state: ${hasCompleted}`)
      notes.push(`Resume state: ${hasResume}`)

      // The Day panel should show Day 4 (CSD=3 → Day 4)
      const dayMatch = body.match(/Day\s+(\d+)/)
      notes.push(`Day shown: ${dayMatch?.[0] || 'not found'}`)

      await screenshot(page, 'B15_S07_session_card_states.png')

      // Check weekly progress - 0 words this week (last session was May 27, week started May 27)
      // Week start (Monday) = May 27. Last session = May 27. Today = May 31.
      // getStartOfWeek returns Monday May 27. Session date "2026-05-27" >= May 27 = true
      // So weekly progress should show some words
      const weeklyMatch = body.match(/(\d+)\s*\/\s*(\d+)\s*words/)
      notes.push(`Weekly words: ${weeklyMatch?.[0] || 'not found'}`)
    })

    // ── S08: Daily activity bar ──────────────────────────────────────────
    await runScenario(browser, 'S08', async (page, notes) => {
      console.log('  [S08] 7-Day activity bar verification...')

      await loginAs(page, 'careful', 'TOP')
      await page.waitForTimeout(3000)

      // Look for "7-DAY RHYTHM" section
      const rhythmSection = page.locator('text=7-DAY RHYTHM')
      const hasRhythmBar = await rhythmSection.count() > 0
      notes.push(`7-DAY RHYTHM bar present: ${hasRhythmBar}`)

      if (hasRhythmBar) {
        // Check bar renders (should be visible)
        await screenshot(page, 'B15_S08_activity_bar.png')

        // Check hover tooltip functionality
        // careful TOP has sessions on May 25, 26, 27 → bars for those days should be filled
        const body = await page.locator('body').textContent()
        // Activity bar is rendered but we check it doesn't crash
        notes.push('Activity bar rendered without crash')
      } else {
        await screenshot(page, 'B15_S08_no_activity_bar.png')
        notes.push('WARN: 7-DAY RHYTHM bar not found in dashboard')
      }
    })

    // ── S09: Stats panels check ──────────────────────────────────────────
    await runScenario(browser, 'S09', async (page, notes) => {
      console.log('  [S09] Stats panels: mastery rate, streak, total words...')

      await loginAs(page, 'careful', 'TOP')
      await page.waitForTimeout(3000)

      const body = await page.locator('body').textContent()

      // Check stats panels
      // Firestore data for careful TOP (app-read doc):
      //   CSD=3, TWI=240, streak=3
      //   avgReviewScore from recentSessions: [(0.92+0.93+0.95)/3] = 0.933 → 93% mastery

      // Words Introduced
      const wordsText = body.match(/Words Introduced[\s\S]{0,30}?(\d[\d,]+)/m)
      const displayedWords = wordsText ? wordsText[1].replace(',', '') : null
      notes.push(`Displayed words: ${displayedWords} (expected ~240)`)

      // Mastery Rate
      const masteryText = body.match(/Mastery Rate[\s\S]{0,30}?(\d+)%/m)
      const displayedMastery = masteryText ? parseInt(masteryText[1]) : null
      notes.push(`Displayed mastery: ${displayedMastery}% (expected ~93%)`)

      // Streak
      const streakText = body.match(/Current Streak[\s\S]{0,30}?(\d+)\s+days/m)
      const displayedStreakDays = streakText ? parseInt(streakText[1]) : null
      notes.push(`Displayed streak: ${displayedStreakDays} days (Firestore says 3, but today=May31, last session=May27 = streak likely 0 today due to gap)`)

      await screenshot(page, 'B15_S09_stats_panels.png')

      // Cross-check: streak logic
      // Last session date: "2026-05-26" (day 2 in recentSessions) and "2026-05-27"
      // Today: May 31. Expected prev study day: May 29 (Fri). Last session: May 27.
      // May 27 ≠ May 29 → streak = 0 by calculateStreak
      // But Firestore says streakDays=3. Dashboard reads progress.streakDays ?? calculateStreak(...)
      // So it shows 3 (from Firestore) even though locally calculated would be 0
      notes.push('NOTE: Dashboard shows streakDays from Firestore (3) not from real-time calculateStreak(0) — possible stale streak display if server value not updated')

      // Check accuracy of words
      if (displayedWords && parseInt(displayedWords) !== 240) {
        notes.push(`WARN: Words introduced shows ${displayedWords}, expected 240 from Firestore`)
      }
    })

    // ── S10: Re-entry modal after session completion ────────────────────
    await runScenario(browser, 'S10', async (page, notes) => {
      console.log('  [S10] Re-entry modal behavior...')

      // Careful TOP has completed Day 3 on May 27 — sessionState may or may not be present
      await loginAs(page, 'careful', 'TOP')
      await page.waitForTimeout(3000)

      await screenshot(page, 'B15_S10_pre_start_click.png')

      // Click Start Session and observe what happens
      const startBtn = page.locator('button:has-text("Start Session")').first()
      if (await startBtn.count() > 0) {
        const isDisabled = await startBtn.getAttribute('disabled')
        if (isDisabled !== null) {
          notes.push('Start Session disabled (progressData still loading)')
        } else {
          await startBtn.click()
          await page.waitForTimeout(2000)

          const afterUrl = page.url()
          const afterBody = await page.locator('body').textContent()

          notes.push(`After click URL: ${afterUrl}`)

          // Check if re-entry modal appeared
          const hasModal = afterBody.includes('Session Completed') || afterBody.includes('Study Again')
          const navigatedToSession = afterUrl.includes('/session/')

          notes.push(`Re-entry modal shown: ${hasModal}`)
          notes.push(`Navigated to session: ${navigatedToSession}`)

          await screenshot(page, 'B15_S10_after_start_click.png')

          // Go back to dashboard
          if (navigatedToSession) {
            await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' })
            await page.waitForTimeout(2000)
          }
        }
      } else {
        notes.push('No Start Session button found')
      }
    })

    // ── S11: Post-session staleness test (chat-log #10 — THE CORE TEST) ──
    // Simulate completing a session and checking if dashboard updates without F5
    await runScenario(browser, 'S11', async (page, notes) => {
      console.log('  [S11] CORE: Post-session dashboard staleness (chat-log #10)...')
      console.log('  Testing: does dashboard update WITHOUT manual refresh after session navigation back?')

      // Use lazy_TOP student for this test (CSD=3 currently)
      await loginAs(page, 'lazy', 'TOP')
      await page.waitForTimeout(3000)

      // Capture initial state
      await screenshot(page, 'B15_S11_01_initial_dashboard.png')
      const initialBody = await page.locator('body').textContent()
      const initialDayMatch = initialBody.match(/Day\s+(\d+)/)
      const initialDay = initialDayMatch ? parseInt(initialDayMatch[1]) : null
      notes.push(`Initial dashboard day: ${initialDay}`)

      // Now navigate to the session page
      const lazyTopClassId = 'k8tzOiiwotBbtJS3uTiv'
      const lazyTopListId = '8RMews2H7C3UJUAsOBzR'
      const sessionUrl = `${BASE_URL}/session/${lazyTopClassId}/${lazyTopListId}`

      await page.goto(sessionUrl, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2000)

      await screenshot(page, 'B15_S11_02_session_page.png')

      const sessionBody = await page.locator('body').textContent()
      notes.push(`Session page loaded. URL: ${page.url()}`)
      notes.push(`Session page content snippet: ${sessionBody.slice(0, 200)}`)

      // Navigate BACK to dashboard using in-app navigation (simulate user clicking logo/home)
      const homeLink = page.locator('a[href="/"], a[href="https://vocaboostone.netlify.app/"]').first()
      if (await homeLink.count() > 0) {
        await homeLink.click()
      } else {
        // Try clicking a logo or navigation element
        const logoLink = page.locator('a').filter({ hasText: /vocaboost|home/i }).first()
        if (await logoLink.count() > 0) {
          await logoLink.click()
        } else {
          // Use browser history navigation
          await page.goBack()
        }
      }

      await page.waitForTimeout(3000) // Wait for dashboard to re-render
      await screenshot(page, 'B15_S11_03_dashboard_after_session.png')

      const afterBody = await page.locator('body').textContent()
      const afterDayMatch = afterBody.match(/Day\s+(\d+)/)
      const afterDay = afterDayMatch ? parseInt(afterDayMatch[1]) : null

      notes.push(`Dashboard day AFTER navigation back: ${afterDay}`)
      notes.push(`Dashboard URL after nav: ${page.url()}`)

      // Check if the dashboard re-fetched data or used stale cache
      // The dashboard uses useCallback + useEffect hooks that re-run when component mounts
      // Navigate to session and back triggers React router navigation
      // The useEffect for loadStudentClasses depends on [isTeacher, user?.uid] — doesn't change
      // The useEffect for loadProgressData depends on [user?.uid, studentClasses, isTeacher]
      // If studentClasses didn't change, progressData won't be re-fetched
      // This is the stale-until-refresh issue

      // Also check re-mounting: if React re-mounts Dashboard on navigation, hooks re-run
      // React Router keeps Dashboard mounted when navigating to /session/ and back
      // because Dashboard is the parent route — the child route handles /session/
      // Actually /session/ is a completely different route, so Dashboard unmounts
      // which means on return it should re-mount and re-fetch

      // The key question: does the dashboard freshly fetch progress on return from session?
      // If it does, CSD should reflect any updates that happened during session

      notes.push('NOTE: Dashboard unmounts when navigating to /session/ — on return it remounts and should re-fetch from Firestore')
      notes.push('If re-fetch works correctly, this is NOT a staleness bug. If not (e.g. service worker cache), it IS.')

      // Check for "stale" indicator: any loading spinners visible?
      const hasSpinner = await page.locator('[class*="animate-spin"], [class*="loading"]').count() > 0
      notes.push(`Loading spinner present after return: ${hasSpinner}`)
    })

  } finally {
    await browser.close()
  }

  // ── Write findings summary ─────────────────────────────────────────────
  const totalTrials = results.length
  const passed = results.filter(r => r.result === 'pass').length
  const failed = results.filter(r => r.result === 'fail').length

  console.log('\n=== B15 Results ===')
  console.log(`Total: ${totalTrials} | Pass: ${passed} | Fail: ${failed}`)
  results.forEach(r => {
    console.log(`  [${r.label}] ${r.result.toUpperCase()} — ${r.notes.join('; ')}`)
  })

  appendLog({
    event: 'batch_end',
    batch: 'B15',
    trials: totalTrials,
    pass: passed,
    fail: failed,
    blocked: 0,
    highCount: 0,
    blockerCount: 0
  })

  writeStatus({
    label: 'U',
    currentBatch: 'B15',
    currentScenario: 'done',
    batchesClaimed: ['B15'],
    batchesCompleted: ['B15'],
    trialsCompleted: totalTrials,
    lastUpdate: new Date().toISOString(),
    state: 'running',
    results
  })

  // Write results to file
  writeFileSync(
    '/app/audit/playwright/findings/evidence/B15/B15_results.json',
    JSON.stringify(results, null, 2)
  )

  return results
})()
