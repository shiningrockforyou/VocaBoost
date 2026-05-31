/**
 * B18 — Teacher Gradebook Full Audit
 * Agent: V — Chat-log #13: teacher-sees-different-day-than-student
 */

import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B18'
const TEACHER_EMAIL = 'veterans@vocaboost.com'
const TEACHER_PASS = 'veterans5944'

// Key student credentials for cross-verification (chat-log #13: careful/TOP persona)
const CAREFUL_TOP = {
  email: 'audit_careful_01_top@vocaboost.test',
  password: 'AuditPass2026!',
  uid: 'EPnmY4FIXxVq19tQtxQCvE26p0F3',
  displayName: 'Audit Careful Student 01 (TOP)',
}

mkdirSync(EVIDENCE_DIR, { recursive: true })

let screenshotIndex = 0
async function screenshot(page, label) {
  const fname = `B18_${String(++screenshotIndex).padStart(2, '0')}_${label}.png`
  const fpath = path.join(EVIDENCE_DIR, fname)
  await page.screenshot({ path: fpath, fullPage: true })
  console.log('  [screenshot] ' + fname)
  return fname
}

const consoleLog = []

function captureConsole(page) {
  page.on('console', msg => {
    consoleLog.push({ type: msg.type(), text: msg.text(), ts: new Date().toISOString() })
  })
  page.on('pageerror', err => {
    consoleLog.push({ type: 'pageerror', text: err.toString(), ts: new Date().toISOString() })
  })
}

async function loginAs(page, email, password, label) {
  console.log(`\n--- loginAs: ${label} ---`)
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(1500)

  if (!page.url().includes('/login')) {
    const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
    if (await loginLink.count()) {
      await loginLink.click()
    } else {
      await page.evaluate(() => {
        history.pushState({}, '', '/login')
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
    }
    await page.waitForTimeout(1000)
  }

  const emailInput = page.getByLabel(/email/i).first()
  await emailInput.waitFor({ timeout: 15000 })
  await emailInput.fill(email)
  await page.getByLabel(/password/i).first().fill(password)
  await page.getByLabel(/password/i).first().press('Enter')

  try {
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  } catch (e) {
    const btn = page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first()
    if (await btn.count() > 0) await btn.click()
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 })
  }
  console.log('  Logged in. URL:', page.url())
}

async function signOut(page) {
  // Try clicking a sign out / logout button
  const signOutBtn = page.getByRole('button', { name: /sign\s?out|log\s?out/i }).first()
  if (await signOutBtn.count() > 0) {
    await signOutBtn.click()
    await page.waitForTimeout(1500)
  } else {
    // Use Firebase JS SDK
    await page.evaluate(async () => {
      try {
        const { getAuth, signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js')
        // Try window.firebase or use cookie clearing
      } catch {}
    })
  }
  await page.context().clearCookies()
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  console.log('  Signed out')
}

async function run() {
  const results = {}
  const findings = []

  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
  })

  // ============================================================
  // PHASE 1: Check what student dashboard shows for careful/TOP
  // ============================================================

  const studentCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const studentPage = await studentCtx.newPage()
  captureConsole(studentPage)

  let studentDashboardDay = null
  let studentDashboardContent = ''

  try {
    console.log('\n=== PHASE 1: Student Dashboard (careful/TOP) ===')
    await loginAs(studentPage, CAREFUL_TOP.email, CAREFUL_TOP.password, 'careful/TOP student')
    await screenshot(studentPage, 'S_student_dashboard')

    // Capture dashboard content
    studentDashboardContent = await studentPage.content()

    // Look for day number displayed on dashboard
    // Common patterns: "Day 3", "Day N", current study day
    const dayTexts = await studentPage.getByText(/day\s*\d+/i).all()
    console.log('  Day text elements found:', dayTexts.length)
    for (const el of dayTexts) {
      const t = await el.textContent()
      console.log('    Day text:', t?.trim())
    }

    // Look for currentStudyDay or similar display
    const bodyText = await studentPage.locator('body').textContent()

    // Extract all "Day N" occurrences
    const dayMatches = bodyText.match(/[Dd]ay\s*(\d+)/g) || []
    console.log('  All "Day N" occurrences on student dashboard:', dayMatches)

    // Find the number shown as "current day"
    const dayNumbers = dayMatches.map(m => {
      const n = m.match(/(\d+)/)?.[1]
      return n ? parseInt(n) : null
    }).filter(Boolean)

    studentDashboardDay = dayNumbers.length > 0 ? dayNumbers[0] : null
    console.log('  Student dashboard day (first occurrence):', studentDashboardDay)

    // Save evidence
    writeFileSync(
      path.join(EVIDENCE_DIR, 'B18_S01_student_dashboard_day.json'),
      JSON.stringify({
        uid: CAREFUL_TOP.uid,
        email: CAREFUL_TOP.email,
        dayTexts: dayMatches,
        inferredDay: studentDashboardDay,
        timestamp: new Date().toISOString(),
      }, null, 2)
    )

    results.S01_student_day = studentDashboardDay
  } catch (e) {
    console.error('Student phase error:', e.message)
    await screenshot(studentPage, 'student_error')
    results.S01_student_day = 'error: ' + e.message
  } finally {
    await studentCtx.close()
  }

  // ============================================================
  // PHASE 2: Teacher gradebook
  // ============================================================

  const teacherCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const teacherPage = await teacherCtx.newPage()
  captureConsole(teacherPage)

  try {
    console.log('\n=== PHASE 2: Teacher Gradebook ===')

    // S01: Login and navigate to gradebook
    console.log('\n--- S01: Teacher login + gradebook access ---')
    await loginAs(teacherPage, TEACHER_EMAIL, TEACHER_PASS, 'teacher')
    await screenshot(teacherPage, 'S01_teacher_home')

    // Navigate to gradebook
    const gradebookLink = teacherPage.getByRole('link', { name: /gradebook/i }).first()
    if (await gradebookLink.count() > 0) {
      await gradebookLink.click()
      await teacherPage.waitForURL(/\/teacher\/gradebook/, { timeout: 10000 })
      console.log('  Navigated to gradebook:', teacherPage.url())
      results.S01 = 'pass'
    } else {
      // Try direct navigation
      await teacherPage.goto(`${BASE_URL}/teacher/gradebook`, { waitUntil: 'domcontentloaded' })
      console.log('  Direct nav to gradebook:', teacherPage.url())
      results.S01 = teacherPage.url().includes('gradebook') ? 'pass' : 'fail - no gradebook route'
    }

    await teacherPage.waitForTimeout(2000) // Let data load
    await screenshot(teacherPage, 'S01_gradebook_loaded')

    const gradebookContent = await teacherPage.locator('body').textContent()
    console.log('  Gradebook body text (first 500):', gradebookContent.substring(0, 500))

    // Check for student listing
    const studentsListed = []

    // Look for table rows, student names, day numbers
    const tableRows = await teacherPage.locator('tr, [role="row"]').all()
    console.log('  Table rows found:', tableRows.length)

    // Look for day numbers shown in gradebook
    const dayOccurrences = gradebookContent.match(/[Dd]ay\s*(\d+)/g) || []
    console.log('  Day occurrences in gradebook:', dayOccurrences.slice(0, 10))

    // S02: Filter by class — check if filter exists
    console.log('\n--- S02: Filter by class ---')
    const classFilter = teacherPage.getByRole('combobox', { name: /class/i }).first()
    const classFilterCount = await classFilter.count()
    console.log('  Class filter found:', classFilterCount > 0)
    if (classFilterCount > 0) {
      const options = await classFilter.locator('option').all()
      console.log('  Class filter options:')
      for (const opt of options) {
        const text = await opt.textContent()
        const val = await opt.getAttribute('value')
        console.log('   ', text, '->', val)
      }
      results.S02 = 'filter_exists'
    } else {
      // Try other filter patterns
      const selects = await teacherPage.locator('select').all()
      console.log('  All select elements:', selects.length)
      for (let i = 0; i < selects.length; i++) {
        const sel = selects[i]
        const selText = await sel.textContent()
        console.log('    Select', i, ':', selText.substring(0, 100))
      }
      results.S02 = selects.length > 0 ? 'filter_found_generic' : 'no_filter_ui'
    }

    await screenshot(teacherPage, 'S02_filter_check')

    // S03: Check what classes appear in the gradebook
    console.log('\n--- S03/S04: Check gradebook content and students ---')

    // Capture full gradebook HTML for analysis
    const gradebookHtml = await teacherPage.content()
    writeFileSync(
      path.join(EVIDENCE_DIR, 'B18_S03_gradebook_html.html'),
      gradebookHtml
    )

    // Look for student names / IDs
    const carefulStudentMentions = gradebookContent.includes('Audit Careful') ||
      gradebookContent.includes('careful') ||
      gradebookContent.includes(CAREFUL_TOP.uid)
    console.log('  Careful student mentioned in gradebook:', carefulStudentMentions)

    // Look for TOP class specific data
    const topClassMentions = gradebookContent.includes('TOP') ||
      gradebookContent.includes('k8tzOiiwotBbtJS3uTiv')
    console.log('  TOP class data present:', topClassMentions)

    // S07: Default sort (newest first)
    console.log('\n--- S07: Default sort (newest first) ---')
    const dateTexts = await teacherPage.getByText(/\d{4}-\d{2}-\d{2}|\d+\/\d+\/\d+|today|yesterday/i).all()
    console.log('  Date elements found:', dateTexts.length)
    results.S07 = dateTexts.length > 0 ? 'dates_visible' : 'no_dates_visible'

    // Navigate to TOP class to check its gradebook
    console.log('\n--- Navigating to TOP class page ---')
    await teacherPage.goto(`${BASE_URL}/classes/k8tzOiiwotBbtJS3uTiv`, { waitUntil: 'domcontentloaded' })
    await teacherPage.waitForTimeout(2000)
    await screenshot(teacherPage, 'S03_top_class_page')

    const topClassContent = await teacherPage.locator('body').textContent()
    console.log('  TOP class page (first 500):', topClassContent.substring(0, 500))

    // Look for gradebook tab/section within class
    const gradebookTab = teacherPage.getByRole('tab', { name: /gradebook|progress|students/i }).first()
    if (await gradebookTab.count() > 0) {
      console.log('  Gradebook tab found, clicking...')
      await gradebookTab.click()
      await teacherPage.waitForTimeout(1500)
      await screenshot(teacherPage, 'S03_top_class_gradebook_tab')
    }

    // Check all tabs
    const tabs = await teacherPage.getByRole('tab').all()
    console.log('  Tabs on class page:')
    for (const tab of tabs) {
      const t = await tab.textContent()
      console.log('    Tab:', t?.trim())
    }

    // Look for class-level gradebook/progress link
    const progressLinks = await teacherPage.getByRole('link', { name: /gradebook|progress|students/i }).all()
    console.log('  Progress/gradebook links:', progressLinks.length)
    for (const link of progressLinks) {
      const t = await link.textContent()
      const h = await link.getAttribute('href')
      console.log('    Link:', t?.trim(), '->', h)
    }

    // S08: Check attempt detail view
    console.log('\n--- S08: Look for attempt detail in gradebook ---')
    await teacherPage.goto(`${BASE_URL}/teacher/gradebook`, { waitUntil: 'domcontentloaded' })
    await teacherPage.waitForTimeout(2000)

    // Check all links in gradebook
    const gradebookLinks = await teacherPage.getByRole('link').all()
    console.log('  Links in gradebook page:', gradebookLinks.length)
    const attemptLinks = []
    for (const link of gradebookLinks) {
      const href = await link.getAttribute('href') || ''
      const text = await link.textContent() || ''
      if (href.includes('attempt') || href.includes('student') || text.includes('View')) {
        attemptLinks.push({ href, text: text.trim() })
      }
    }
    console.log('  Attempt/detail links:', JSON.stringify(attemptLinks.slice(0, 5)))

    // Try clicking the first table row (if any) to get to student detail
    const firstClickableRow = teacherPage.locator('tr[class*="cursor"], tr:has(td)').first()
    if (await firstClickableRow.count() > 0) {
      console.log('  Clicking first table row...')
      await firstClickableRow.click()
      await teacherPage.waitForTimeout(1500)
      await screenshot(teacherPage, 'S08_attempt_detail')
      console.log('  URL after row click:', teacherPage.url())
    }

    // S12: Performance check - check load time
    console.log('\n--- S12: Gradebook load time ---')
    const startTime = Date.now()
    await teacherPage.goto(`${BASE_URL}/teacher/gradebook`, { waitUntil: 'networkidle', timeout: 30000 })
    const loadTime = Date.now() - startTime
    console.log('  Gradebook load time (networkidle):', loadTime, 'ms')
    results.S12 = loadTime < 3000 ? 'pass' : `slow_${loadTime}ms`
    await screenshot(teacherPage, 'S12_gradebook_final')

    // S13: Export check
    console.log('\n--- S13: Export (CSV/PDF) ---')
    const exportBtn = teacherPage.getByRole('button', { name: /export|csv|pdf|download/i }).first()
    const exportCount = await exportBtn.count()
    console.log('  Export button found:', exportCount > 0)
    results.S13 = exportCount > 0 ? 'export_button_present' : 'no_export_button'

    // Now look at the gradebook for THE KEY QUESTION:
    // What day does the teacher see for the careful student?
    console.log('\n=== KEY QUESTION: Teacher-vs-Student day mismatch ===')

    // Navigate to teacher gradebook page
    await teacherPage.goto(`${BASE_URL}/teacher/gradebook`, { waitUntil: 'domcontentloaded' })
    await teacherPage.waitForTimeout(2500)

    const finalGradebookBody = await teacherPage.locator('body').textContent()

    // Find day numbers
    const gradebookDayMatches = finalGradebookBody.match(/[Dd]ay\s*(\d+)/g) || []
    console.log('  All day references in gradebook:', gradebookDayMatches)

    // Try to find if there's a student list with day numbers
    // Look for specific student display name
    const studentDisplayed = finalGradebookBody.includes('Audit Careful')
    console.log('  "Audit Careful" in gradebook body:', studentDisplayed)

    // Save final evidence
    writeFileSync(
      path.join(EVIDENCE_DIR, 'B18_final_teacher_gradebook.json'),
      JSON.stringify({
        gradebookUrl: teacherPage.url(),
        dayOccurrences: gradebookDayMatches,
        studentsListed: finalGradebookBody.length > 100,
        studentDashboardDay,
        consoleErrors: consoleLog.filter(m => m.type === 'error' || m.type === 'pageerror').length,
        timestamp: new Date().toISOString(),
      }, null, 2)
    )

    // Check what the page actually shows in detail
    console.log('\n  Final gradebook content (500 chars):', finalGradebookBody.substring(0, 500))

    // Check for class selector in gradebook
    await screenshot(teacherPage, 'S_final_gradebook')

    // Look for pagination, table headers, etc.
    const headers = await teacherPage.locator('th, [role="columnheader"]').all()
    console.log('  Table headers:', (await Promise.all(headers.map(h => h.textContent()))).map(t => t?.trim()).filter(Boolean))

    // See if we need to select a class first
    const classDropdown = await teacherPage.locator('select').all()
    if (classDropdown.length > 0) {
      console.log('  Found dropdowns, selecting TOP OFFLINE class...')
      // Select TOP OFFLINE class
      await classDropdown[0].selectOption({ label: '25WT 2차 TOP OFFLINE' }).catch(async () => {
        await classDropdown[0].selectOption({ value: 'k8tzOiiwotBbtJS3uTiv' }).catch(() => {
          console.log('  Could not select TOP class in dropdown')
        })
      })
      await teacherPage.waitForTimeout(2000)
      await screenshot(teacherPage, 'S02_top_class_selected')

      const afterSelect = await teacherPage.locator('body').textContent()
      const dayMatchesAfterSelect = afterSelect.match(/[Dd]ay\s*(\d+)/g) || []
      console.log('  Day occurrences after class selection:', dayMatchesAfterSelect)

      const carefulStudentRow = afterSelect.includes('Audit Careful')
      console.log('  Careful student shown after filter:', carefulStudentRow)
    }

  } catch (e) {
    console.error('Teacher phase error:', e.message)
    console.error(e.stack)
    await screenshot(teacherPage, 'teacher_error')
  } finally {
    await teacherCtx.close()
  }

  // ============================================================
  // PHASE 3: Re-login as student to capture current dashboard day
  // (fresh context to get clean read)
  // ============================================================

  console.log('\n=== PHASE 3: Student Dashboard Day (fresh login) ===')
  const studentCtx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const studentPage2 = await studentCtx2.newPage()
  captureConsole(studentPage2)

  let studentDayFresh = null
  try {
    await loginAs(studentPage2, CAREFUL_TOP.email, CAREFUL_TOP.password, 'careful/TOP fresh')
    await studentPage2.waitForTimeout(2000)
    await screenshot(studentPage2, 'S_student_fresh_dashboard')

    const bodyText = await studentPage2.locator('body').textContent()
    const dayMatches = bodyText.match(/[Dd]ay\s*(\d+)/g) || []
    console.log('  Student dashboard day occurrences:', dayMatches)

    // Get the class card content specifically
    const classCardText = await studentPage2.locator('[class*="card"], article, section').first().textContent().catch(() => bodyText)
    const cardDayMatches = classCardText.match(/[Dd]ay\s*(\d+)/g) || []
    console.log('  Class card day references:', cardDayMatches)

    studentDayFresh = dayMatches.length > 0 ? parseInt(dayMatches[0].match(/\d+/)?.[0]) : null
    console.log('  Inferred student current day (fresh):', studentDayFresh)

    writeFileSync(
      path.join(EVIDENCE_DIR, 'B18_S_student_day.json'),
      JSON.stringify({
        uid: CAREFUL_TOP.uid,
        email: CAREFUL_TOP.email,
        dayMatches,
        inferredDay: studentDayFresh,
        timestamp: new Date().toISOString(),
      }, null, 2)
    )
  } catch (e) {
    console.error('Student phase 3 error:', e.message)
    await screenshot(studentPage2, 'student_phase3_error')
  } finally {
    await studentCtx2.close()
  }

  // ============================================================
  // Save console log and close
  // ============================================================
  writeFileSync(
    path.join(EVIDENCE_DIR, 'B18_console.json'),
    JSON.stringify(consoleLog, null, 2)
  )

  await browser.close()

  // Summary
  console.log('\n==============================')
  console.log('SUMMARY')
  console.log('==============================')
  console.log('Student dashboard day (initial):', studentDashboardDay)
  console.log('Student dashboard day (fresh):', studentDayFresh)
  console.log('Results:', JSON.stringify(results, null, 2))
  console.log('Console errors:', consoleLog.filter(m => m.type === 'error' || m.type === 'pageerror').length)

  return {
    studentDashboardDay,
    studentDayFresh,
    results,
  }
}

run().then(r => {
  console.log('\nDone.')
}).catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
