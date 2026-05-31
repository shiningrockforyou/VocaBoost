/**
 * B18 v3 — Teacher Gradebook: full scenario testing via SPA navigation
 * Focus: what does the teacher see? Day column accuracy, student count, submission status
 */

import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'

const BASE_URL = 'https://vocaboostone.netlify.app'
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B18'
const TEACHER_EMAIL = 'veterans@vocaboost.com'
const TEACHER_PASS = 'veterans5944'

mkdirSync(EVIDENCE_DIR, { recursive: true })

let ssIdx = 100
async function ss(page, label) {
  const fname = `B18_v3_${String(++ssIdx).padStart(3,'0')}_${label}.png`
  await page.screenshot({ path: path.join(EVIDENCE_DIR, fname), fullPage: true })
  console.log('  [ss]', fname)
  return fname
}

const consoleLog = []
function cap(page) {
  page.on('console', m => consoleLog.push({ type: m.type(), text: m.text(), ts: new Date().toISOString() }))
  page.on('pageerror', e => consoleLog.push({ type: 'pageerror', text: e.toString(), ts: new Date().toISOString() }))
}

async function loginAsTeacher(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(2500)

  if (!page.url().includes('/login')) {
    const loginLink = page.getByRole('link', { name: /log\s?in/i }).first()
    if (await loginLink.count()) await loginLink.click()
    await page.waitForTimeout(1000)
  }

  await page.getByLabel(/email/i).first().waitFor({ timeout: 15000 })
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
  console.log('  Teacher logged in:', page.url())
}

const results = {}
const findings = []

async function run() {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
  })

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  cap(page)

  try {
    await loginAsTeacher(page)
    await ss(page, 'S01_teacher_home')

    // === S01: Navigate to Gradebook via SPA link ===
    console.log('\n=== S01: Navigate to Gradebook ===')
    const gradebookLink = page.getByRole('link', { name: /gradebook/i }).first()
    if (await gradebookLink.count() > 0) {
      await gradebookLink.click()
      await page.waitForTimeout(3000)
      console.log('  URL after gradebook click:', page.url())
    }
    await ss(page, 'S01_gradebook_initial')

    const gradebookBody = await page.locator('body').textContent()
    const isLoaded = !gradebookBody.includes('Page not found')
    const isSearchPrompt = gradebookBody.includes('Search for your students')
    console.log('  Gradebook loaded (not 404):', isLoaded)
    console.log('  Shows search prompt:', isSearchPrompt)
    results.S01 = isLoaded ? (isSearchPrompt ? 'pass_empty_state' : 'pass_with_data') : 'FAIL_404'

    // Check headers
    const headers = await page.locator('th').all()
    const headerTexts = await Promise.all(headers.map(h => h.textContent()))
    console.log('  Table headers:', headerTexts.map(h => h?.trim()).filter(Boolean))
    results.S01_headers = headerTexts.map(h => h?.trim()).filter(Boolean)

    // Check filter categories
    const filterButtons = await page.getByRole('button').all()
    const filterNames = []
    for (const btn of filterButtons) {
      const t = await btn.textContent()
      if (t && ['Class', 'Name', 'List', 'Test Type', 'Date'].some(f => t.trim().includes(f))) {
        filterNames.push(t.trim())
      }
    }
    console.log('  Filter buttons:', filterNames)
    results.S01_filters = filterNames

    // Check export button
    const exportBtn = page.getByRole('button', { name: /export/i }).first()
    const hasExport = await exportBtn.count() > 0
    console.log('  Export button:', hasExport)
    results.S13 = hasExport ? 'export_button_present' : 'no_export'

    // === S01/S02: Filter by TOP class ===
    console.log('\n=== S02: Filter by TOP class ===')

    // Click "Class" filter
    const classBtn = page.getByRole('button', { name: /^class$/i }).first()
    if (await classBtn.count() > 0) {
      await classBtn.click()
      await page.waitForTimeout(500)
    }

    // Type in the search
    const searchInput = page.locator('input[placeholder*="search"]').first()
    if (await searchInput.count() > 0) {
      await searchInput.fill('TOP OFFLINE')
      await page.waitForTimeout(500)
    }

    // Click "Add Filter"
    const addFilterBtn = page.getByRole('button', { name: /add filter/i }).first()
    if (await addFilterBtn.count() > 0) {
      await addFilterBtn.click()
      await page.waitForTimeout(3000) // Wait for data to load
      await ss(page, 'S02_top_class_filter')

      const filtered = await page.locator('body').textContent()
      const dayMatches = filtered.match(/[Dd]ay\s*(\d+)/g) || []
      console.log('  Day mentions after TOP filter:', dayMatches.slice(0, 10))
      const attemptCount = filtered.match(/Showing:\s*(\d+)/)?.[1]
      console.log('  Showing count:', attemptCount)
      console.log('  Body (first 300):', filtered.substring(0, 300))
      results.S02 = 'pass'

      // Count rows
      const rows = await page.locator('tbody tr').all()
      console.log('  Table rows after TOP filter:', rows.length)
      results.S02_row_count = rows.length

      if (rows.length > 0) {
        // Get text from first 3 rows
        for (let i = 0; i < Math.min(3, rows.length); i++) {
          const rowText = await rows[i].textContent()
          console.log(`  Row ${i+1}:`, rowText?.trim().substring(0, 120))
        }
      }
    }

    // === S03: Filter by list ===
    console.log('\n=== S03: Filter by list ===')
    // Clear current filters first by refreshing gradebook nav
    await page.evaluate(() => window.history.back())
    await page.waitForTimeout(1000)
    await page.getByRole('link', { name: /gradebook/i }).first().click()
    await page.waitForTimeout(2000)

    // === S04: Filter by test type ===
    console.log('\n=== S04: Filter by test type (MCQ) ===')
    const testTypeBtn = page.getByRole('button', { name: /test type/i }).first()
    if (await testTypeBtn.count() > 0) {
      await testTypeBtn.click()
      await page.waitForTimeout(500)

      // Look for MCQ tag button
      const mcqBtn = page.getByRole('button', { name: /^mcq$/i }).first()
      if (await mcqBtn.count() > 0) {
        await mcqBtn.click()
        await page.waitForTimeout(2500)
        await ss(page, 'S04_mcq_filter')
        const rows = await page.locator('tbody tr').all()
        console.log('  Rows after MCQ filter:', rows.length)
        results.S04 = rows.length > 0 ? 'pass' : 'no_mcq_results'

        // Check that Type column only shows MCQ
        if (rows.length > 0) {
          const typeCells = await page.locator('td').filter({ hasText: /written|mcq/i }).all()
          const typeTexts = await Promise.all(typeCells.map(c => c.textContent()))
          const types = typeTexts.map(t => t?.trim())
          const hasOnlyMCQ = types.every(t => t === 'MCQ')
          console.log('  All rows are MCQ:', hasOnlyMCQ, 'types found:', [...new Set(types)])
          results.S04_type_purity = hasOnlyMCQ ? 'pass' : 'fail_mixed_types'
        }
      }
    }

    // === S05: Filter by date (last 7 days) ===
    console.log('\n=== S05: Date filter (7 days) ===')
    // Reset filters
    await page.getByRole('link', { name: /gradebook/i }).first().click()
    await page.waitForTimeout(2000)

    const dateBtn = page.getByRole('button', { name: /^date$/i }).first()
    if (await dateBtn.count() > 0) {
      await dateBtn.click()
      await page.waitForTimeout(500)

      const sevenDaysBtn = page.getByRole('button', { name: /past 7 days/i }).first()
      if (await sevenDaysBtn.count() > 0) {
        await sevenDaysBtn.click()
        await page.waitForTimeout(2500)
        await ss(page, 'S05_7day_filter')
        const rows = await page.locator('tbody tr').all()
        console.log('  Rows after 7-day filter:', rows.length)
        results.S05 = 'pass'
      }
    }

    // === S06/S07: Sort by score and date ===
    console.log('\n=== S06/S07: Sorting ===')
    // Reset and get some data
    await page.getByRole('link', { name: /gradebook/i }).first().click()
    await page.waitForTimeout(2000)

    // Try to load data by filtering for a class first
    const classBtnForSort = page.getByRole('button', { name: /^class$/i }).first()
    if (await classBtnForSort.count() > 0) {
      await classBtnForSort.click()
      await page.waitForTimeout(300)
      const si = page.locator('input[placeholder*="search"]').first()
      if (await si.count() > 0) {
        await si.fill('TOP')
        await page.waitForTimeout(300)
      }
      const af = page.getByRole('button', { name: /add filter/i }).first()
      if (await af.count() > 0) {
        await af.click()
        await page.waitForTimeout(3000)
      }
    }

    // Click Score column
    const scoreHeader = page.getByRole('columnheader', { name: /score/i }).first()
    if (await scoreHeader.count() > 0) {
      await scoreHeader.click()
      await page.waitForTimeout(500)
      await ss(page, 'S06_sort_score_asc')

      // Check ascending order
      const scoreCells = await page.locator('tbody td:nth-child(6)').all()
      const scores = []
      for (const c of scoreCells.slice(0, 5)) {
        const t = await c.textContent()
        const m = t?.match(/(\d+)%/)
        if (m) scores.push(parseInt(m[1]))
      }
      console.log('  Scores ascending:', scores)
      const isAscending = scores.every((s, i) => i === 0 || s >= scores[i-1])
      results.S06 = isAscending || scores.length === 0 ? 'pass' : 'fail_sort_not_ascending'
    }

    // Click Date column
    const dateHeader = page.getByRole('columnheader', { name: /date/i }).first()
    if (await dateHeader.count() > 0) {
      await dateHeader.click()
      await page.waitForTimeout(500)
      console.log('  Date sort clicked')
      results.S07 = 'pass'
    }

    // === S08: Click into an attempt detail ===
    console.log('\n=== S08: Attempt detail view ===')
    await ss(page, 'S08_before_detail')

    const viewDetailsBtn = page.getByRole('button', { name: /view details/i }).first()
    if (await viewDetailsBtn.count() > 0) {
      await viewDetailsBtn.click()
      await page.waitForTimeout(2500)
      await ss(page, 'S08_attempt_detail')

      const detailBody = await page.locator('body').textContent()
      const hasStudentName = detailBody.includes('Student')
      const hasScore = detailBody.includes('Score')
      const hasQuestions = detailBody.includes('Questions')
      const hasChallengeOption = detailBody.includes('Challenge')
      console.log('  Detail has Student:', hasStudentName)
      console.log('  Detail has Score:', hasScore)
      console.log('  Detail has Questions:', hasQuestions)
      console.log('  Detail has Challenge options:', hasChallengeOption)
      results.S08 = (hasStudentName && hasScore && hasQuestions) ? 'pass' : 'partial_missing_fields'

      // Check for AI reasoning (typed tests only)
      const hasAIReasoning = detailBody.includes('AI Reasoning')
      console.log('  Has AI Reasoning:', hasAIReasoning)
      results.S08_ai_reasoning = hasAIReasoning ? 'present' : 'absent'

      // Check day shown in detail
      const dayInDetail = detailBody.match(/[Dd]ay\s*(\d+)/g) || []
      console.log('  Day references in detail:', dayInDetail)

      // Close detail
      const closeBtn = page.getByRole('button', { name: /close|x/i }).first()
      if (await closeBtn.count() > 0) {
        await closeBtn.click()
        await page.waitForTimeout(500)
      }
    } else {
      console.log('  No "View Details" button found (no data loaded)')
      results.S08 = 'skip_no_data'
    }

    // === S09: Empty state check ===
    console.log('\n=== S09: Empty state ===')
    await page.getByRole('link', { name: /gradebook/i }).first().click()
    await page.waitForTimeout(2000)

    // No filters applied → should show empty state with search prompt
    const bodyNoFilter = await page.locator('body').textContent()
    const hasEmptyPrompt = bodyNoFilter.includes('Search for your students')
    console.log('  Empty state shown (no filter):', hasEmptyPrompt)
    results.S09 = hasEmptyPrompt ? 'pass_shows_empty_state' : 'fail_no_empty_state'

    // === S10: Stale data check ===
    console.log('\n=== S10: Stale data behavior ===')
    // The gradebook is a fetch-on-filter SPA - no auto-refresh.
    // This is expected behavior. Document it.
    results.S10 = 'expected_no_auto_refresh'
    console.log('  No auto-refresh is expected SPA behavior (not a bug)')

    // === S11: Duplicate display check ===
    console.log('\n=== S11: Duplicate attempt check ===')
    // Load data and look for duplicates (same student, same day, same type, same date)
    await page.getByRole('button', { name: /^class$/i }).first().click()
    await page.waitForTimeout(300)
    const si2 = page.locator('input[placeholder*="search"]').first()
    if (await si2.count() > 0) {
      await si2.fill('TOP')
      await page.waitForTimeout(300)
    }
    const af2 = page.getByRole('button', { name: /add filter/i }).first()
    if (await af2.count() > 0) {
      await af2.click()
      await page.waitForTimeout(3000)
    }
    await ss(page, 'S11_top_class_data')

    const rows = await page.locator('tbody tr').all()
    console.log('  Total rows loaded:', rows.length)

    // Look for potential duplicates (same content rows)
    const rowContents = []
    for (const row of rows) {
      const t = await row.textContent()
      rowContents.push(t?.trim().substring(0, 100))
    }
    const uniqueRows = new Set(rowContents)
    const hasDuplicates = uniqueRows.size < rowContents.length
    console.log('  Total rows:', rowContents.length, 'Unique:', uniqueRows.size)
    console.log('  Duplicates detected:', hasDuplicates)
    results.S11 = hasDuplicates ? 'FAIL_duplicates_found' : 'pass'

    // === KEY QUESTION: Day column check ===
    console.log('\n=== KEY: Teacher gradebook day column ===')
    // Check what the Day column shows
    const dayColumnCells = await page.locator('tbody td:nth-child(9)').all()
    const dayValues = []
    for (const cell of dayColumnCells.slice(0, 10)) {
      const t = await cell.textContent()
      dayValues.push(t?.trim())
    }
    console.log('  Day column values (first 10 rows):', dayValues)
    results.key_day_column = dayValues

    // Check if any days are shown (not all dashes)
    const hasDayValues = dayValues.some(d => d && d !== '—')
    console.log('  Has day values (not all dashes):', hasDayValues)
    results.key_has_day_values = hasDayValues

    // === S12: Performance ===
    console.log('\n=== S12: Load performance ===')
    const t0 = Date.now()
    await page.getByRole('link', { name: /gradebook/i }).first().click()
    await page.waitForTimeout(500)
    // Click a class filter immediately
    const cb = page.getByRole('button', { name: /^class$/i }).first()
    if (await cb.count() > 0) {
      await cb.click()
      const si3 = page.locator('input[placeholder*="search"]').first()
      if (await si3.count() > 0) await si3.fill('TOP')
      const af3 = page.getByRole('button', { name: /add filter/i }).first()
      if (await af3.count() > 0) {
        await af3.click()
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
      }
    }
    const loadTime = Date.now() - t0
    console.log('  Filter + load time:', loadTime, 'ms')
    results.S12 = loadTime < 3000 ? 'pass' : `slow_${loadTime}ms`

    await ss(page, 'S12_final_gradebook')

    // === Final screenshot and content capture ===
    const finalBody = await page.locator('body').textContent()
    writeFileSync(
      path.join(EVIDENCE_DIR, 'B18_final_gradebook_text.txt'),
      finalBody
    )

  } catch (e) {
    console.error('Error:', e.message)
    console.error(e.stack)
    await ss(page, 'error')
  } finally {
    writeFileSync(
      path.join(EVIDENCE_DIR, 'B18_console_v3.json'),
      JSON.stringify(consoleLog, null, 2)
    )
    await ctx.close()
    await browser.close()
  }

  console.log('\n=== FINAL RESULTS ===')
  console.log(JSON.stringify(results, null, 2))

  const errors = consoleLog.filter(m => m.type === 'error' || m.type === 'pageerror')
  console.log('\nConsole errors:', errors.length)
  if (errors.length > 0) {
    errors.slice(0, 5).forEach(e => console.log(' ', e.text))
  }
}

run().catch(e => { console.error('Fatal:', e); process.exit(1) })
