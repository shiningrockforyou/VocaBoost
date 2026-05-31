/**
 * B15 Follow-up — Focused tests on findings from first run
 * Investigates:
 * 1. Session state console error on Start Session (newWordsTestScore: undefined)
 * 2. Weekly words 0/400 despite sessions in range
 * 3. Dashboard post-session re-mount staleness (chat-log #10)
 * 4. Stale streak display (Firestore vs client-calculated)
 */

const { chromium } = require('playwright')
const { readFileSync, writeFileSync } = require('fs')
const path = require('path')

const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B15'
const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'))

function getAccount(personaId, targetClass = 'TOP') {
  return seeded.accounts.find(a => a.personaId === personaId && a.targetClass === targetClass)
}

async function loginAs(page, personaId, targetClass = 'TOP') {
  const account = getAccount(personaId, targetClass)
  if (!account) throw new Error(`No account for ${personaId}/${targetClass}`)

  await page.addInitScript(() => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
    }
  })

  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' })

  await page.waitForSelector('input[type="email"]', { timeout: 10000 })
  await page.fill('input[type="email"]', account.email)
  await page.fill('input[type="password"]', account.password)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(url => url.href.includes('/') && !url.href.includes('/login'), { timeout: 15000 })
  await page.waitForTimeout(1500)

  return account
}

;(async () => {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const followupResults = {}

  try {
    // ── Test A: Console error investigation (S10 finding) ─────────────────
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()
      const consoleErrors = []
      const consoleLogs = []
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text())
        if (msg.text().includes('persist') || msg.text().includes('session') || msg.text().includes('undefined')) {
          consoleLogs.push(`[${msg.type()}] ${msg.text()}`)
        }
      })

      await loginAs(page, 'careful', 'TOP')
      await page.waitForTimeout(3000)

      // Capture initial state
      const initialBody = await page.locator('body').textContent()
      const dayMatch = initialBody.match(/Day\s+(\d+)/)
      const initialDay = dayMatch ? dayMatch[1] : 'unknown'

      // Navigate to session - but don't use direct URL (Netlify 404 on SPA)
      // Use in-app Start Session button
      const startBtn = page.locator('button:has-text("Start Session")').first()
      const isDisabled = await startBtn.getAttribute('disabled')

      await page.screenshot({ path: `${EVIDENCE_DIR}/B15_followup_A1_before_click.png`, fullPage: true })

      if (isDisabled === null) {
        await startBtn.click()
        await page.waitForTimeout(3000)

        const afterUrl = page.url()
        const afterBody = await page.locator('body').textContent()

        await page.screenshot({ path: `${EVIDENCE_DIR}/B15_followup_A2_after_click.png`, fullPage: true })

        // Wait a bit more to let session state persist attempt fire
        await page.waitForTimeout(2000)

        followupResults.testA = {
          initialDay,
          afterUrl,
          consoleErrors,
          consoleLogs,
          sessionPageLoaded: afterUrl.includes('/session/'),
          sessionPageContent: afterBody.slice(0, 300)
        }

        // If we're on session page, navigate back and check dashboard staleness
        if (afterUrl.includes('/session/')) {
          // Use browser back (in-app navigation equivalent)
          await page.goBack()
          await page.waitForTimeout(3000)

          const backUrl = page.url()
          const backBody = await page.locator('body').textContent()
          const backDayMatch = backBody.match(/Day\s+(\d+)/)
          const dayAfterReturn = backDayMatch ? backDayMatch[1] : 'unknown'

          await page.screenshot({ path: `${EVIDENCE_DIR}/B15_followup_A3_back_to_dashboard.png`, fullPage: true })

          followupResults.testA.returnUrl = backUrl
          followupResults.testA.dayAfterReturn = dayAfterReturn
          followupResults.testA.dayUnchanged = dayAfterReturn === initialDay
          followupResults.testA.staleness = dayAfterReturn === initialDay
            ? 'Dashboard day same before/after session nav (expected — no new session completed)'
            : `Dashboard day changed: ${initialDay} → ${dayAfterReturn}`
        }
      } else {
        followupResults.testA = { error: 'Start Session button was disabled' }
      }

      await ctx.close()
    }

    // ── Test B: Weekly words calculation via date comparison ─────────────
    // Verify the dashboard renders correct weekly word count
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()

      await loginAs(page, 'careful', 'TOP')
      await page.waitForTimeout(4000)

      const body = await page.locator('body').textContent()

      // Find the weekly goals section
      const weeklySection = await page.locator('h2:has-text("Weekly Goals")').count() > 0
      const weeklyText = body.match(/(\d+)\s*\/\s*(\d+)\s*words/)

      // The careful TOP student has sessions on May 25-27
      // Today=May 31 (Sun). getStartOfWeek() returns Monday
      // If today is Sunday (getDay()=0), diff = 6, Monday = May 25
      // Session dates are strings: '2026-05-25', '2026-05-26', '2026-05-27'
      // Code: sessionDate = session.date?.toDate?.() || session.date → string '2026-05-25'
      // Filter: sessionDate >= weekStart (Date object) → string >= Date → false
      // So 0 words shown despite sessions existing this week

      await page.screenshot({ path: `${EVIDENCE_DIR}/B15_followup_B1_weekly_words.png`, fullPage: true })

      followupResults.testB = {
        weeklySection,
        weeklyDisplay: weeklyText?.[0] || 'not found',
        wordsThisWeek: weeklyText ? parseInt(weeklyText[1]) : null,
        weeklyGoal: weeklyText ? parseInt(weeklyText[2]) : null,
        expected: 'Sessions from May 25-27 should count for this week (week starts May 25 when today=May31/Sun)',
        bugNote: 'Session dates stored as strings (not Timestamps) cause date comparison to fail in getWeeklyWordsIntroduced'
      }

      await ctx.close()
    }

    // ── Test C: Stale streak — Firestore vs calculated ───────────────────
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()

      await loginAs(page, 'careful', 'TOP')
      await page.waitForTimeout(4000)

      const body = await page.locator('body').textContent()
      const streakText = body.match(/Current Streak[\s\S]{0,100}?(\d+)\s+days/m)
      const displayedStreak = streakText ? parseInt(streakText[1]) : null

      await page.screenshot({ path: `${EVIDENCE_DIR}/B15_followup_C1_streak.png`, fullPage: true })

      // Analysis:
      // Firestore streakDays=3 (written May 27 after completing Day 3)
      // Today=May 31 (Sun). Last study day=May 27.
      // calculateStreak: most recent session = May 27, yesterday = May 30 (Fri, skipping Sat)
      // May 27 !== May 30 → streak=0
      // But dashboard shows progress.streakDays ?? calculateStreak() = 3 (from Firestore)
      // This is STALE: Firestore has 3, but real current streak should be 0

      followupResults.testC = {
        displayedStreak,
        firestoreStreak: 3, // from our earlier query
        lastSession: '2026-05-27',
        today: '2026-05-31',
        lastStudyDayBeforeToday: '2026-05-29 (Fri)', // skip weekend
        calculatedStreak: 0, // May 27 !== May 29
        isStale: displayedStreak === 3 && 0 !== 3,
        bugNote: 'Dashboard shows Firestore streakDays=3 not recalculated from recentSessions. Since sessions ended May 27 and today is May 31 (3 calendar days, 2 study days ago), streak should show 0. Real students who studied Mon-Wed will see Wed\'s streak on Thu instead of seeing it reset.'
      }

      await ctx.close()
    }

    // ── Test D: Session nav URL via in-app click (not direct URL) ─────────
    // The Netlify B03 F01/F02 issue: direct /session/ URL returns 404
    // But in-app button navigation should work via React Router
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()

      await loginAs(page, 'firsttimer', 'TOP')
      await page.waitForTimeout(3000)

      // Click Start Session in-app
      const startBtn = page.locator('button:has-text("Start Session")').first()
      const btnCount = await startBtn.count()

      if (btnCount > 0) {
        await startBtn.click()
        await page.waitForTimeout(3000)

        const sessionUrl = page.url()
        const sessionBody = await page.locator('body').textContent()
        const hasNotFound = sessionBody.includes('Page not found') || sessionBody.includes('404')

        await page.screenshot({ path: `${EVIDENCE_DIR}/B15_followup_D1_session_nav.png`, fullPage: true })

        followupResults.testD = {
          sessionUrl,
          hasNotFound,
          sessionBodySnippet: sessionBody.slice(0, 200),
          note: hasNotFound
            ? 'FAIL: In-app Start Session click leads to 404 — Netlify SPA routing issue'
            : 'PASS: In-app navigation to session works correctly'
        }
      } else {
        followupResults.testD = { error: 'No Start Session button found' }
      }

      await ctx.close()
    }

  } finally {
    await browser.close()
  }

  console.log('\n=== Follow-up Results ===')
  console.log(JSON.stringify(followupResults, null, 2))

  writeFileSync(
    `${EVIDENCE_DIR}/B15_followup_results.json`,
    JSON.stringify(followupResults, null, 2)
  )
})()
