/**
 * B18 — SPA Navigation for Teacher Gradebook
 * Navigates IN-APP (not by direct URL) because Netlify has no SPA fallback for deep links
 */

import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B18'
const TEACHER_EMAIL = 'veterans@vocaboost.com'
const TEACHER_PASS = 'veterans5944'

const CAREFUL_TOP = {
  email: 'audit_careful_01_top@vocaboost.test',
  password: 'AuditPass2026!',
  uid: 'EPnmY4FIXxVq19tQtxQCvE26p0F3',
  displayName: 'Audit Careful Student 01 (TOP)',
}

mkdirSync(EVIDENCE_DIR, { recursive: true })

let ssIdx = 0
async function ss(page, label) {
  const fname = `B18_nav_${String(++ssIdx).padStart(2,'0')}_${label}.png`
  await page.screenshot({ path: path.join(EVIDENCE_DIR, fname), fullPage: true })
  console.log('  [ss]', fname)
  return fname
}

const consoleLog = []
function cap(page) {
  page.on('console', m => consoleLog.push({ type: m.type(), text: m.text() }))
  page.on('pageerror', e => consoleLog.push({ type: 'pageerror', text: e.toString() }))
}

async function loginAsTeacher(page) {
  // Warm SPA at root
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(2000)

  const url = page.url()
  if (url.includes('/login')) {
    // Already on login page
  } else {
    // Look for login link
    const loginLink = page.getByRole('link', { name: /log\s?in/i }).first()
    if (await loginLink.count()) await loginLink.click()
    else {
      await page.evaluate(() => {
        history.pushState({}, '', '/login')
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
    }
    await page.waitForTimeout(1000)
  }

  await page.getByLabel(/email/i).first().waitFor({ timeout: 10000 })
  await page.getByLabel(/email/i).first().fill(TEACHER_EMAIL)
  await page.getByLabel(/password/i).first().fill(TEACHER_PASS)
  await page.getByLabel(/password/i).first().press('Enter')

  try {
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  } catch {
    const btn = page.getByRole('button', { name: /continue|log\s?in/i }).first()
    if (await btn.count()) await btn.click()
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  }
  console.log('  Teacher logged in. URL:', page.url())
}

async function loginAsStudent(page, email, password) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(2000)

  if (!page.url().includes('/login')) {
    await page.evaluate(() => {
      history.pushState({}, '', '/login')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await page.waitForTimeout(1000)
  }

  await page.getByLabel(/email/i).first().waitFor({ timeout: 10000 })
  await page.getByLabel(/email/i).first().fill(email)
  await page.getByLabel(/password/i).first().fill(password)
  await page.getByLabel(/password/i).first().press('Enter')

  try {
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  } catch {
    const btn = page.getByRole('button', { name: /continue|log\s?in/i }).first()
    if (await btn.count()) await btn.click()
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  }
  console.log('  Student logged in. URL:', page.url())
}

async function run() {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
  })

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  cap(page)

  const findings = {}

  try {
    // ---- STUDENT DASHBOARD ----
    console.log('\n=== Student Dashboard (careful/TOP) ===')
    await loginAsStudent(page, CAREFUL_TOP.email, CAREFUL_TOP.password)
    await page.waitForTimeout(2000)
    await ss(page, 'student_dash')

    // Extract ALL text, look for day number
    const studentBody = await page.locator('body').textContent()
    const studentDayMatches = studentBody.match(/[Dd]ay\s*(\d+)/g) || []
    console.log('  Student day matches:', studentDayMatches)

    // Look for progress indicators
    const progressBar = await page.locator('[class*="progress"], [aria-label*="progress"]').all()
    console.log('  Progress bars:', progressBar.length)

    // Look for "current day" label
    const currentDayText = studentBody.match(/current.*day[\s:]*(\d+)|day\s*(\d+)\s*(of|\/)/gi) || []
    console.log('  Current day patterns:', currentDayText)

    // Find any numbers after "Day" keyword
    const dayNums = [...studentBody.matchAll(/[Dd]ay\s*(\d+)/g)].map(m => parseInt(m[1]))
    console.log('  Extracted day numbers:', dayNums)

    // Check specific text patterns
    const startStudyPattern = studentBody.match(/start.*study|study day|today.*day|next.*day/gi) || []
    console.log('  Study patterns:', startStudyPattern.slice(0, 5))

    findings.student_dashboard_day_numbers = dayNums
    findings.student_first_day_shown = dayNums[0] || null

    writeFileSync(
      path.join(EVIDENCE_DIR, 'B18_student_dashboard_analysis.json'),
      JSON.stringify({
        uid: CAREFUL_TOP.uid,
        studentDayMatches,
        dayNums,
        url: page.url(),
        timestamp: new Date().toISOString(),
      }, null, 2)
    )

    // Sign out before teacher login
    // Use Firebase sign out via page evaluation
    await page.evaluate(async () => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.context().clearCookies()

    // ---- TEACHER LOGIN ----
    console.log('\n=== Teacher Login and Navigation ===')
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1000)

    // At root, should show login since we cleared storage
    if (!page.url().includes('/login')) {
      await page.evaluate(() => {
        history.pushState({}, '', '/login')
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
      await page.waitForTimeout(1000)
    }

    await page.getByLabel(/email/i).first().waitFor({ timeout: 10000 })
    await page.getByLabel(/email/i).first().fill(TEACHER_EMAIL)
    await page.getByLabel(/password/i).first().fill(TEACHER_PASS)
    await page.getByLabel(/password/i).first().press('Enter')

    try {
      await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
    } catch {
      const btn = page.getByRole('button', { name: /continue|log\s?in/i }).first()
      if (await btn.count()) await btn.click()
      await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
    }

    await page.waitForTimeout(2000)
    await ss(page, 'teacher_home')
    console.log('  Teacher home URL:', page.url())

    // ---- FIND AND CLICK GRADEBOOK LINK ----
    console.log('\n=== Finding Gradebook ===')

    // Get all links
    const allLinks = await page.getByRole('link').all()
    const linkData = []
    for (const link of allLinks) {
      const text = await link.textContent().catch(() => '')
      const href = await link.getAttribute('href').catch(() => '')
      linkData.push({ text: text?.trim(), href })
    }
    console.log('  All links on teacher home:')
    linkData.forEach(l => console.log(`    "${l.text}" -> ${l.href}`))

    // Find and click gradebook link
    const gbLink = page.getByRole('link', { name: /gradebook/i }).first()
    if (await gbLink.count() > 0) {
      console.log('  Clicking Gradebook link...')
      await gbLink.click()
      await page.waitForTimeout(3000)
      console.log('  URL after click:', page.url())
      await ss(page, 'S01_gradebook')
    } else {
      console.log('  NO GRADEBOOK LINK FOUND')
      findings.S01 = 'FAIL: no gradebook link'
    }

    const gbBody = await page.locator('body').textContent()
    console.log('  Gradebook page (first 800 chars):')
    console.log(gbBody.substring(0, 800))

    findings.S01_url = page.url()
    findings.S01_is_404 = gbBody.includes('Page not found') || gbBody.includes("doesn't exist")
    findings.S01_result = findings.S01_is_404 ? 'FAIL: 404' : 'checking'

    // If it's a 404, check if teacher needs to navigate within the SPA differently
    if (findings.S01_is_404) {
      console.log('\n  !!! GRADEBOOK ROUTE IS 404 !!!')
      console.log('  This is the known B03 issue: Netlify no SPA fallback for deep links')
      console.log('  But wait - teacher clicked the link IN-app, not a direct URL...')
      console.log('  This means the React Router link pushState should have worked.')
      console.log('  Let me check if the link was a React Router Link or external...')

      // Go back to home and try again
      await page.goBack()
      await page.waitForTimeout(1500)
      console.log('  Back at:', page.url())

      // Check if link has data-discover attribute (React Router)
      const gbLinkEl = page.getByRole('link', { name: /gradebook/i }).first()
      if (await gbLinkEl.count() > 0) {
        const dataDiscover = await gbLinkEl.getAttribute('data-discover')
        const href2 = await gbLinkEl.getAttribute('href')
        console.log('  Gradebook link href:', href2, 'data-discover:', dataDiscover)

        // Try React Router navigation
        await page.evaluate((href) => {
          // Find the React Router navigate function
          const link = document.querySelector(`a[href="${href}"]`)
          if (link) link.click()
        }, '/teacher/gradebook')

        await page.waitForTimeout(2000)
        console.log('  After programmatic click, URL:', page.url())
        await ss(page, 'gradebook_after_programmatic')

        const body2 = await page.locator('body').textContent()
        console.log('  Content:', body2.substring(0, 300))
        findings.S01_programmatic = !body2.includes('Page not found')
      }
    }

    // ---- EXPLORE CLASS PAGES ----
    console.log('\n=== Exploring Class Page (TOP OFFLINE) ===')
    await page.goBack().catch(() => {})
    await page.waitForTimeout(1000)

    // Navigate to TOP OFFLINE class via in-app link
    const topClassLink = page.getByRole('link', { name: /TOP OFFLINE/i }).first()
    if (await topClassLink.count() > 0) {
      console.log('  Clicking TOP OFFLINE class link...')
      await topClassLink.click()
      await page.waitForTimeout(3000)
      console.log('  URL:', page.url())
      await ss(page, 'top_class_page')

      const classBody = await page.locator('body').textContent()
      console.log('  Class page (first 1000):')
      console.log(classBody.substring(0, 1000))

      // Is there a gradebook section?
      const hasGradebook = classBody.toLowerCase().includes('gradebook')
      const hasProgress = classBody.toLowerCase().includes('progress')
      const hasStudents = classBody.toLowerCase().includes('student')
      console.log('  Has gradebook section:', hasGradebook)
      console.log('  Has progress section:', hasProgress)
      console.log('  Has students section:', hasStudents)

      // Look for student list with days
      const dayMatches = classBody.match(/[Dd]ay\s*(\d+)/g) || []
      console.log('  Day matches in class page:', dayMatches)

      // Look for tabs
      const tabs = await page.getByRole('tab').all()
      console.log('  Tabs:', (await Promise.all(tabs.map(t => t.textContent()))).map(t => t?.trim()))

      // Check class student count display
      const studentCountMatch = classBody.match(/(\d+)\s*student/gi) || []
      console.log('  Student count mentions:', studentCountMatch.slice(0, 5))

      // Navigate through tabs if available
      for (const tab of tabs) {
        const tabName = await tab.textContent()
        console.log('\n  Clicking tab:', tabName?.trim())
        await tab.click()
        await page.waitForTimeout(1500)
        await ss(page, `tab_${(tabName || 'unknown').trim().replace(/\s+/g, '_')}`)
        const tabBody = await page.locator('body').textContent()
        const tabDays = tabBody.match(/[Dd]ay\s*(\d+)/g) || []
        console.log('  Days in tab:', tabDays.slice(0, 10))
        console.log('  Tab content (first 300):', tabBody.substring(0, 300))

        // Look for careful student
        const hasCareful = tabBody.includes('Audit Careful') || tabBody.includes('careful')
        console.log('  Careful student in tab:', hasCareful)

        if (tabDays.length > 0 || hasCareful) {
          findings.class_tab_with_days = tabName?.trim()
          findings.class_tab_days = tabDays
        }
      }

      // Detailed examination: look for any student rows in the class page
      const allRows = await page.locator('tr, [role="row"], li[class*="student"], div[class*="student"]').all()
      console.log('\n  Student-like rows:', allRows.length)
      for (let i = 0; i < Math.min(allRows.length, 5); i++) {
        const rowText = await allRows[i].textContent()
        console.log(`  Row ${i}:`, rowText?.trim().substring(0, 150))
      }

      findings.class_page_url = page.url()
    } else {
      console.log('  No TOP OFFLINE link found')
      findings.class_page_url = 'not_found'
    }

    // ---- CHECK IF THERE IS A GRADEBOOK-LIKE SECTION ANYWHERE ----
    console.log('\n=== Searching for Gradebook Content ===')
    const allPageText = await page.locator('body').textContent()

    // Navigate home and look at the full teacher dashboard
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    await ss(page, 'teacher_home_2')

    const homeBody = await page.locator('body').textContent()
    console.log('  Teacher home full content:')
    console.log(homeBody)

    writeFileSync(
      path.join(EVIDENCE_DIR, 'B18_teacher_home_full.txt'),
      homeBody
    )

  } catch (e) {
    console.error('Error:', e.message)
    console.error(e.stack)
    await ss(page, 'error')
  } finally {
    writeFileSync(
      path.join(EVIDENCE_DIR, 'B18_console_v2.json'),
      JSON.stringify(consoleLog, null, 2)
    )
    await ctx.close()
    await browser.close()
  }

  console.log('\n=== FINDINGS SUMMARY ===')
  console.log(JSON.stringify(findings, null, 2))
}

run().catch(e => { console.error('Fatal:', e); process.exit(1) })
