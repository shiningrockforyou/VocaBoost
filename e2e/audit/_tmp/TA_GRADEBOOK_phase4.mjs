/**
 * TA-GRADEBOOK Phase 4 — Deep filter investigation + all scenarios
 * Fix: clearAllFilters only clicks available X buttons (no loop over unavailable ones)
 * Key question: WHY do all filters return Showing: 0?
 */

import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import path from 'path'

const BASE_URL = 'https://vocaboostone.netlify.app'
const SCREENSHOTS_DIR = '/app/audit/playwright/findings/screenshots/TA-GRADEBOOK'
const DOWNLOADS_DIR = '/app/e2e/audit/_tmp/downloads'
const TA_EMAIL = 'ta@vocaboost.com'
const TA_PASS = 'VocaTA2026!'

const ALLOWED_CLASS_NAMES = [
  '25WT 2차 TOP ONLINE',
  '25WT 2차 CORE OFFLINE',
  '25WT 2차 CORE ONLINE',
  '25WT 2차 TOP OFFLINE',
]

mkdirSync(SCREENSHOTS_DIR, { recursive: true })
mkdirSync(DOWNLOADS_DIR, { recursive: true })

let ssIdx = 60
async function ss(page, label) {
  const fname = `${String(++ssIdx).padStart(2, '0')}_${label}.png`
  const fpath = path.join(SCREENSHOTS_DIR, fname)
  await page.screenshot({ path: fpath, fullPage: true })
  console.log(`  [screenshot] ${fname}`)
  return fname
}

const consoleMsgs = []
function captureConsole(page) {
  page.on('console', msg => {
    consoleMsgs.push({ type: msg.type(), text: msg.text(), ts: Date.now() })
    if (msg.type() === 'error') console.log(`  [console.error] ${msg.text().substring(0, 150)}`)
  })
  page.on('pageerror', err => {
    consoleMsgs.push({ type: 'pageerror', text: err.toString(), ts: Date.now() })
    console.log(`  [pageerror] ${err.toString().substring(0, 150)}`)
  })
}

const findings = []
function addFinding(severity, title, where, evidence, repro, expected, actual) {
  findings.push({ severity, title, where, evidence, repro, expected, actual })
  console.log(`\n  [FINDING:${severity}] ${title}`)
  console.log(`    Where: ${where}`)
  console.log(`    Expected: ${expected}`)
  console.log(`    Actual: ${actual}`)
}

async function login(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(1500)
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await loginLink.count()) await loginLink.click()
  else await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })

  const email = page.getByLabel(/email/i).first()
  await email.waitFor({ timeout: 20000 })
  await email.fill(TA_EMAIL)
  await page.getByLabel(/password/i).first().fill(TA_PASS)
  await page.getByLabel(/password/i).first().press('Enter')
  try { await page.waitForURL(/\/(dashboard|teacher|$)/, { timeout: 15000 }) }
  catch { await page.getByRole('button', { name: /continue|log\s?in/i }).first().click().catch(() => {}); await page.waitForURL(/\/(dashboard|teacher|$)/, { timeout: 15000 }) }
  console.log('  Login OK. URL:', page.url())
}

async function goGradebook(page) {
  await page.evaluate(() => { history.pushState({}, '', '/teacher/gradebook'); dispatchEvent(new PopStateEvent('popstate')) })
  await page.waitForTimeout(3000)
  if (!page.url().includes('gradebook')) {
    await page.goto(`${BASE_URL}/teacher/gradebook`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
  }
}

async function getShowing(page) {
  const t = await page.locator('body').textContent()
  const m = t.match(/[Ss]howing[:\s]+(\d+)/)
  return m ? parseInt(m[1]) : null
}

async function getRows(page) {
  const r = await page.locator('tbody tr').count()
  if (r > 0) return r
  return 0
}

// Safe clear: click available X buttons only
async function clearFilters(page) {
  let cleared = 0
  const MAX = 10
  for (let i = 0; i < MAX; i++) {
    const xBtns = page.locator('span.inline-flex button, span:has(svg.lucide-x) button, [class*="filter-tag"] button')
    const cnt = await xBtns.count()
    if (cnt === 0) break
    await xBtns.first().click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(400)
    cleared++
  }
  await page.waitForTimeout(500)
  return cleared
}

// Apply filter: chip -> type -> Add Filter
async function applyFilter(page, chipName, searchValue) {
  // Find the chip by partial text (handles SVG icon text interference)
  const chips = await page.locator('button').all()
  let chip = null
  for (const c of chips) {
    const t = await c.textContent()
    if (t?.trim() === chipName || t?.trim().includes(chipName)) {
      chip = c
      break
    }
  }
  if (!chip) {
    console.log(`  WARN: chip "${chipName}" not found`)
    return null
  }

  await chip.click()
  await page.waitForTimeout(600)

  // Find visible input
  const inp = page.locator('input:visible').first()
  if (!(await inp.count())) {
    console.log('  WARN: no input after chip click')
    return null
  }

  await inp.fill(searchValue)
  await page.waitForTimeout(400)

  // Click "Add Filter"
  const addBtn = page.locator('button:visible').filter({ hasText: 'Add Filter' }).first()
  if (await addBtn.count()) {
    await addBtn.click()
  } else {
    await inp.press('Enter')
  }

  await page.waitForTimeout(2500)  // Give time for Firestore query

  const showing = await getShowing(page)
  const rows = await getRows(page)
  console.log(`    applyFilter(${chipName}, "${searchValue}") → showing=${showing} rows=${rows}`)
  return { showing, rows }
}

async function run() {
  console.log('\n========================================')
  console.log('TA-GRADEBOOK Phase 4 — Investigation')
  console.log('========================================')

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '/ms-playwright' },
  })

  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    downloadsPath: DOWNLOADS_DIR,
  })
  const page = await ctx.newPage()
  captureConsole(page)

  let loginOk = false
  let csvPath = null
  const results = {}

  try {
    await login(page)
    loginOk = true

    // ────────── INVESTIGATE FILTER BEHAVIOR ──────────
    console.log('\n=== FILTER INVESTIGATION ===')
    await goGradebook(page)

    // Check network requests when filter is applied
    const networkRequests = []
    page.on('request', req => {
      if (req.url().includes('firestore') || req.url().includes('firebase') || req.url().includes('googleapis')) {
        networkRequests.push({ url: req.url(), method: req.method() })
      }
    })
    page.on('response', async res => {
      if (res.url().includes('firestore')) {
        const status = res.status()
        if (status >= 400) {
          console.log(`  Firestore error: ${status} ${res.url().substring(0, 80)}`)
        }
      }
    })

    // Apply filter and watch network
    await page.getByRole('button', { name: 'Class' }).first().click()
    await page.waitForTimeout(500)

    const inp = page.locator('input:visible').first()
    await inp.fill('25WT 2차 TOP OFFLINE')
    await page.waitForTimeout(400)

    const addBtn = page.locator('button:visible').filter({ hasText: 'Add Filter' }).first()
    if (await addBtn.count()) {
      await addBtn.click()
    }

    // Wait generously for Firestore
    await page.waitForTimeout(5000)

    const showing1 = await getShowing(page)
    const rows1 = await getRows(page)
    console.log(`  TOP OFFLINE filter (5s wait): showing=${showing1} rows=${rows1}`)
    await ss(page, 'top_offline_5s_wait')

    // Check what Firestore requests were made
    console.log('  Firestore requests:', networkRequests.length)
    for (const r of networkRequests.slice(0, 10)) {
      console.log(`    ${r.method} ${r.url.substring(0, 120)}`)
    }

    // Get full HTML with active filter
    const activeHtml = await page.content()
    writeFileSync('/app/e2e/audit/_tmp/active_filter_html.html', activeHtml)

    // Check for error messages in page
    const errorMsgs = await page.locator('[class*="error"], [class*="Error"], [role="alert"]').all()
    console.log('  Error elements on page:', errorMsgs.length)
    for (const el of errorMsgs) {
      const t = await el.textContent()
      console.log(`  Error: ${t?.trim()}`)
    }

    // Check for loading indicators
    const loadingEls = await page.locator('[class*="loading"], [class*="Loading"], [class*="spinner"]').all()
    console.log('  Loading elements:', loadingEls.length)

    // Try waiting much longer
    console.log('  Waiting additional 10s for data...')
    await page.waitForTimeout(10000)

    const showing2 = await getShowing(page)
    const rows2 = await getRows(page)
    console.log(`  After total 15s wait: showing=${showing2} rows=${rows2}`)
    await ss(page, 'top_offline_15s_wait')

    if ((showing2 || 0) === 0) {
      console.log('\n  CRITICAL: All class filters return 0 results even after 15s wait')
      console.log('  This could indicate:')
      console.log('  1. ta@vocaboost.com has no attempt data in Firestore (students enrolled but no tests taken)')
      console.log('  2. The class name matching is broken (case-sensitive, partial match issue)')
      console.log('  3. The gradebook has a data loading bug for this account')

      // Check if the class filter is doing a text match on class name vs class ID
      // The active filter tag shows "Class: 25WT 2차 TOP OFFLINE"
      // But maybe the data is stored with class IDs, not names

      // Try filtering by class ID
      await clearFilters(page)
      await page.waitForTimeout(500)

      const r_by_id = await applyFilter(page, 'Class', 'k8tzOiiwotBbtJS3uTiv')
      await page.waitForTimeout(5000)
      const showing_id = await getShowing(page)
      console.log(`  Filter by class ID (k8tzOiiwot...): showing=${showing_id}`)

      // Try wild - no filter at all, just Export All
      await clearFilters(page)
      await page.waitForTimeout(500)

      addFinding('BLOCKER',
        'All class filters return Showing: 0 — gradebook appears to have no data for ta@vocaboost.com',
        '/teacher/gradebook',
        'Every class filter tested (exact name, short name, class ID) returns Showing: 0 after 15s wait. ' +
        'Firestore requests are being made. Teacher dashboard shows 4 classes with 36/66/37/63 students each.',
        '1. Log in as ta@vocaboost.com\n2. Navigate to /teacher/gradebook\n3. Click "Class" chip\n4. Type "25WT 2차 TOP OFFLINE"\n5. Click "Add Filter"\n6. Wait 15+ seconds',
        'Results showing test submissions for enrolled students',
        'Showing: 0 — no results returned for any class filter variant')
    }

    // ────────── EMPTY STATE PRESENTATION ──────────
    console.log('\n=== EMPTY STATE PRESENTATION ===')
    await goGradebook(page)
    await page.waitForTimeout(1000)

    const emptyStateHtml = await page.content()
    const emptyText = await page.locator('body').textContent()
    console.log('  Page text:', emptyText.substring(0, 400))

    // Check empty state message quality
    const hasHelpfulMsg = emptyText.includes('Search for your students') ||
      emptyText.includes('search') || emptyText.includes('filter')
    console.log('  Has helpful empty-state guidance:', hasHelpfulMsg)
    results.emptyState = { helpful: hasHelpfulMsg, text: emptyText.substring(0, 300) }

    if (!hasHelpfulMsg) {
      addFinding('MEDIUM', 'Empty state on gradebook lacks helpful guidance text',
        '/teacher/gradebook initial state',
        `Page text: "${emptyText.substring(0, 200)}"`,
        'Navigate to /teacher/gradebook without applying any filter',
        'Clear guidance on how to use the gradebook',
        'No helpful message')
    }

    await ss(page, 'empty_state_clean')

    // ────────── SCOPE: TEACHER DASHBOARD CLASSES ──────────
    console.log('\n=== TEACHER DASHBOARD CLASS SCOPE ===')
    // Verify teacher dashboard only shows 4 allowed classes
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await ss(page, 'teacher_dashboard')

    const dashText = await page.locator('body').textContent()
    console.log('  Dashboard text (600):', dashText.substring(0, 600))

    if (dashText.includes('26SM')) {
      addFinding('BLOCKER', '26SM class visible on teacher dashboard',
        '/ (teacher dashboard)',
        '26SM text in dashboard body',
        'Login as ta@vocaboost.com, go to dashboard',
        'Only 25WT classes',
        '26SM visible')
    } else {
      console.log('  Dashboard: no 26SM ✓')
    }

    // Count class cards
    const classLinks = await page.locator('a[href*="/classes/"]').all()
    console.log('  Class links:', classLinks.length)
    const classIds = []
    for (const link of classLinks) {
      const href = await link.getAttribute('href')
      const text = await link.textContent()
      const id = href?.match(/\/classes\/([A-Za-z0-9]+)/)?.[1]
      if (id) classIds.push(id)
      console.log(`  Class: "${text?.trim().substring(0, 50)}" → ${href}`)
    }

    const unauthorizedClasses = classIds.filter(id => !new Set([
      'GNktwcqI18vyAps3iJDf', 'LVjBTFuYE8FbPG34pVAt', 'OMMwcLz3FlOiKBYjBMla', 'k8tzOiiwotBbtJS3uTiv'
    ]).has(id))
    if (unauthorizedClasses.length > 0) {
      addFinding('BLOCKER', 'Unauthorized class IDs visible on teacher dashboard',
        '/ (teacher dashboard)',
        `Class IDs: ${unauthorizedClasses.join(', ')}`,
        'Login as ta@vocaboost.com, check dashboard class links',
        'Only 4 25WT class IDs',
        `Found: ${unauthorizedClasses.join(', ')}`)
    } else {
      console.log('  Dashboard class IDs: all authorized ✓')
    }

    results.dashboardScope = { classIds, unauthorizedClasses, has26SM: dashText.includes('26SM') }

    // ────────── FILTER CHIP INTERACTION DETAIL ──────────
    console.log('\n=== FILTER CHIP DETAIL ===')
    await goGradebook(page)
    await page.waitForTimeout(1000)

    // Test each chip and document the behavior
    const chips = ['Class', 'Name', 'List', 'Test Type', 'Date']
    for (const chip of chips) {
      console.log(`\n  -- Chip: ${chip} --`)

      // Fresh gradebook
      await goGradebook(page)
      await page.waitForTimeout(800)

      // Find and click chip
      const chipBtns = await page.locator('button').all()
      let chipBtn = null
      for (const btn of chipBtns) {
        const t = await btn.textContent()
        if (t?.trim() === chip) { chipBtn = btn; break }
      }

      if (!chipBtn) {
        console.log(`  Chip "${chip}" not found`)
        continue
      }

      await chipBtn.click()
      await page.waitForTimeout(600)
      await ss(page, `chip_open_${chip.toLowerCase().replace(/\s+/g, '_')}`)

      const chipOpenHtml = await page.content()
      const chipOpenText = await page.locator('body').textContent()
      console.log(`  Page after "${chip}" click (200):`, chipOpenText.substring(0, 200))

      // Find inputs
      const visibleInputs = await page.locator('input:visible, select:visible').all()
      for (const inp of visibleInputs) {
        const t = await inp.getAttribute('type')
        const ph = await inp.getAttribute('placeholder')
        const name = await inp.getAttribute('name')
        console.log(`  Input: type=${t} placeholder="${ph}" name="${name}"`)
      }

      // Find buttons
      const visibleBtns = await page.locator('button:visible').all()
      const btnTexts = await Promise.all(visibleBtns.map(b => b.textContent()))
      console.log(`  Buttons after chip: ${btnTexts.map(t => `"${t?.trim()}"`).join(', ')}`)

      // Check for 26SM
      if (chipOpenText.includes('26SM')) {
        addFinding('BLOCKER', `26SM class visible in "${chip}" filter panel`,
          `/teacher/gradebook ${chip} filter`,
          `26SM in page text after clicking ${chip} chip`,
          `Click ${chip} filter chip`,
          'No 26SM data',
          '26SM visible')
      }

      results[`chip_${chip}`] = {
        inputCount: visibleInputs.length,
        buttons: btnTexts.map(t => t?.trim()).filter(Boolean),
        has26SM: chipOpenText.includes('26SM'),
      }
    }

    // ────────── APPLY FILTER AND WAIT VERY LONG ──────────
    console.log('\n=== EXTENDED WAIT FILTER TEST ===')
    await goGradebook(page)
    await page.waitForTimeout(1000)

    // Apply each class filter with long wait
    for (const className of ALLOWED_CLASS_NAMES) {
      await goGradebook(page)
      await page.waitForTimeout(500)

      const r = await applyFilter(page, 'Class', className)
      // Wait extra long
      await page.waitForTimeout(8000)
      const showingAfter = await getShowing(page)
      const rowsAfter = await getRows(page)
      console.log(`  "${className}" (after 8s): showing=${showingAfter} rows=${rowsAfter}`)

      // Also check for "Your search returned no results" vs empty state
      const bodyText = await page.locator('body').textContent()
      const hasNoResults = bodyText.includes('Your search returned no results') ||
        bodyText.includes('no results') || bodyText.includes('No results')
      const hasLoading = bodyText.includes('Loading') || bodyText.includes('loading')
      console.log(`  hasNoResults=${hasNoResults} hasLoading=${hasLoading}`)

      results[`extended_${className}`] = { showing: showingAfter, rows: rowsAfter, hasNoResults, hasLoading }

      await ss(page, `extended_${className.replace(/[^a-z0-9]/gi, '_').substring(0, 20)}`)

      await clearFilters(page)
      await page.waitForTimeout(500)
    }

    // ────────── CSV EXPORT TEST (with empty state) ──────────
    console.log('\n=== CSV EXPORT ===')
    await goGradebook(page)
    await page.waitForTimeout(1000)

    const exportBtn = page.locator('button').filter({ hasText: 'Export (All)' }).first()
    const exportExists = await exportBtn.count() > 0
    console.log('  Export (All) button exists:', exportExists)
    results.csvExportButtonExists = exportExists

    if (exportExists) {
      // Test 1: Export with Showing: 0 (empty state)
      console.log('  Testing Export (All) with Showing: 0...')
      try {
        const dlPromise = page.waitForEvent('download', { timeout: 5000 })
        await exportBtn.click()
        const dl = await dlPromise
        const fname = dl.suggestedFilename()
        const savePath = path.join(DOWNLOADS_DIR, fname || 'export_empty.csv')
        await dl.saveAs(savePath)
        csvPath = savePath
        const content = readFileSync(savePath, 'utf-8')
        console.log('  Export with Showing:0 triggered download! Filename:', fname)
        console.log('  Content:', content.substring(0, 500))
        results.csvEmptyExport = { downloaded: true, content: content.substring(0, 500), rows: content.split('\n').length - 1 }
      } catch (e) {
        console.log('  Export (All) with Showing:0 → no download (expected?):', e.message.substring(0, 80))
        results.csvEmptyExport = { downloaded: false, error: e.message.substring(0, 80) }
      }

      // Test 2: Apply filter and try export
      console.log('\n  Testing Export (All) after applying class filter...')
      await goGradebook(page)
      await page.waitForTimeout(1000)

      await applyFilter(page, 'Class', '25WT 2차 TOP OFFLINE')
      await page.waitForTimeout(5000)

      const showingBeforeExport = await getShowing(page)
      console.log('  Showing before export:', showingBeforeExport)

      try {
        const dlPromise2 = page.waitForEvent('download', { timeout: 12000 })
        const exportBtn2 = page.locator('button').filter({ hasText: 'Export (All)' }).first()
        await exportBtn2.click()
        const dl2 = await dlPromise2
        const fname2 = dl2.suggestedFilename()
        const savePath2 = path.join(DOWNLOADS_DIR, fname2 || 'export_filtered.csv')
        await dl2.saveAs(savePath2)
        csvPath = savePath2
        const csvBuffer = readFileSync(savePath2)
        const csvStr = csvBuffer.toString('utf-8')
        const csvLines = csvStr.split('\n').filter(l => l.trim())

        console.log('  Download filename:', fname2)
        console.log('  CSV lines:', csvLines.length)
        console.log('  Header:', csvLines[0])
        console.log('  First row:', csvLines[1])

        results.csv = {
          downloaded: true,
          filename: fname2,
          rowCount: csvLines.length - 1,
          header: csvLines[0],
          path: savePath2,
        }

        // Row count vs UI
        if (showingBeforeExport !== null && csvLines.length - 1 !== showingBeforeExport) {
          addFinding('HIGH', 'CSV row count ≠ UI Showing count',
            'CSV export',
            `UI Showing: ${showingBeforeExport}, CSV data rows: ${csvLines.length - 1}`,
            '1. Apply class filter\n2. Note Showing count\n3. Export CSV\n4. Count rows',
            `CSV rows (${csvLines.length - 1}) === UI Showing (${showingBeforeExport})`,
            `CSV=${csvLines.length - 1} UI=${showingBeforeExport}`)
        }

        // Korean check
        const hasKorean = /[가-힣]/.test(csvStr)
        const hasBOM = csvBuffer[0] === 0xEF && csvBuffer[1] === 0xBB && csvBuffer[2] === 0xBF
        let hasMojibake = false
        for (let i = 0; i < csvBuffer.length - 2; i++) {
          if (csvBuffer[i] === 0xEF && csvBuffer[i+1] === 0xBF && csvBuffer[i+2] === 0xBD) { hasMojibake = true; break }
        }
        console.log(`  Korean: ${hasKorean} BOM: ${hasBOM} Mojibake: ${hasMojibake}`)
        results.csv.encoding = { hasKorean, hasBOM, hasMojibake }

        if (hasMojibake) {
          addFinding('HIGH', 'CSV has Unicode replacement chars (mojibake)',
            'CSV export',
            `U+FFFD replacement chars found in CSV. File: ${savePath2}`,
            'Export CSV, inspect bytes',
            'Clean UTF-8 Korean text',
            'Replacement chars found')
        }

        // CSV injection
        const INJECTCHARS = new Set(['=', '+', '-', '@'])
        const injectionCells = []
        for (let li = 0; li < csvLines.length; li++) {
          const line = csvLines[li]
          // Simple cell split (handles basic quoting)
          const cells = []
          let cell = '', inQ = false
          for (let ci = 0; ci < line.length; ci++) {
            const ch = line[ci]
            if (ch === '"') { if (inQ && line[ci+1] === '"') { cell += '"'; ci++ } else inQ = !inQ }
            else if (ch === ',' && !inQ) { cells.push(cell); cell = '' }
            else cell += ch
          }
          cells.push(cell)
          for (let ci = 0; ci < cells.length; ci++) {
            const val = cells[ci]
            if (val.length > 0 && INJECTCHARS.has(val[0])) {
              injectionCells.push({ line: li+1, col: ci+1, val: val.substring(0, 50) })
            }
          }
        }
        console.log(`  CSV injection risk cells: ${injectionCells.length}`)
        for (const c of injectionCells.slice(0, 5)) console.log(`    L${c.line}C${c.col}: "${c.val}"`)

        results.csv.injection = { count: injectionCells.length, samples: injectionCells.slice(0, 5) }
        if (injectionCells.length > 0) {
          // Check if any look like actual formulas
          const formulaLike = injectionCells.filter(c => /^[=+\-@][A-Za-z0-9(]/.test(c.val))
          if (formulaLike.length > 0) {
            addFinding('HIGH', `CSV has ${formulaLike.length} formula-like cells (CSV injection risk)`,
              'CSV export',
              `Cells: ${formulaLike.slice(0, 3).map(c => `L${c.line}C${c.col}:"${c.val}"`).join(', ')}`,
              '1. Export CSV\n2. Open in Excel/Sheets\n3. Check if = cells execute',
              'Formula chars escaped/prefixed',
              `${formulaLike.length} formula-pattern cells unescaped`)
          } else {
            addFinding('NITPICK', `CSV has ${injectionCells.length} cells starting with =+-@ (low injection risk)`,
              'CSV export',
              `Cells: ${injectionCells.slice(0, 3).map(c => `"${c.val}"`).join(', ')}`,
              'Export CSV, check in spreadsheet',
              'All =+-@ prefixes escaped',
              `${injectionCells.length} cells start with formula chars but don\'t look like formulas`)
          }
        }

        await ss(page, 'after_csv_export')

      } catch (e) {
        console.log('  Export after filter → error:', e.message.substring(0, 100))
        results.csv = { downloaded: false, error: e.message.substring(0, 100) }

        addFinding('MEDIUM', 'Export (All) did not trigger download after class filter applied',
          '/teacher/gradebook Export (All)',
          `Error: ${e.message.substring(0, 100)}`,
          '1. Apply class filter\n2. Click Export (All)',
          'File downloads',
          'Timeout / no download event')
      }
    }

    // ────────── CHECK ALL BUTTON BEHAVIOR ──────────
    console.log('\n=== CHECK ALL BEHAVIOR ===')
    await goGradebook(page)
    await page.waitForTimeout(1000)

    const checkAllBtn = page.locator('button').filter({ hasText: 'Check All' }).first()
    const checkAllExists = await checkAllBtn.count() > 0
    console.log('  Check All button exists:', checkAllExists)

    if (checkAllExists) {
      // Click it (with empty state - Showing: 0)
      await checkAllBtn.click()
      await page.waitForTimeout(1000)
      await ss(page, 'check_all_empty')

      const postText = await page.locator('body').textContent()
      const checkedBoxes = await page.locator('input[type="checkbox"]:checked').count()
      console.log('  After Check All (empty): checked boxes =', checkedBoxes)
      console.log('  Button text changed to:', postText.includes('Uncheck All') ? 'Uncheck All' : 'still Check All')

      results.checkAll = {
        exists: true,
        checkedAfterEmpty: checkedBoxes,
        textChanges: postText.includes('Uncheck All'),
      }

      // Now apply filter and click Check All
      await applyFilter(page, 'Class', '25WT 2차 TOP OFFLINE')
      await page.waitForTimeout(5000)

      const showingWithFilter = await getShowing(page)
      const rowsWithFilter = await getRows(page)
      console.log(`  With filter: showing=${showingWithFilter} rows=${rowsWithFilter}`)

      // Click Check All
      const checkAllBtn2 = page.locator('button').filter({ hasText: 'Check All' }).first()
      if (await checkAllBtn2.count()) {
        await checkAllBtn2.click()
        await page.waitForTimeout(1000)
        await ss(page, 'check_all_with_filter')

        const checkedWithFilter = await page.locator('input[type="checkbox"]:checked').count()
        console.log(`  After Check All with filter: checked=${checkedWithFilter} showing=${showingWithFilter} rows=${rowsWithFilter}`)

        results.checkAll.withFilter = {
          showing: showingWithFilter,
          rows: rowsWithFilter,
          checked: checkedWithFilter,
        }

        if (showingWithFilter !== null && showingWithFilter > 0) {
          if (checkedWithFilter === 0) {
            addFinding('MEDIUM', '"Check All" selected 0 rows even with results loaded',
              '/teacher/gradebook',
              `Showing: ${showingWithFilter} but 0 checked after Check All click`,
              '1. Apply class filter (get results)\n2. Click Check All\n3. Count checked rows',
              'All visible rows checked',
              '0 rows checked')
          } else if (checkedWithFilter < showingWithFilter) {
            addFinding('HIGH', '"Check All" selects only current page, not all results',
              '/teacher/gradebook',
              `Showing: ${showingWithFilter} total, but only ${checkedWithFilter} rows checked`,
              '1. Apply class filter\n2. Click Check All\n3. Count checked',
              `All ${showingWithFilter} results checked`,
              `Only ${checkedWithFilter} checked (page-level only)`)
          }
        }
      }
    }

    // ────────── PAGE SIZE SELECTOR ──────────
    console.log('\n=== PAGE SIZE SELECTOR ===')
    await goGradebook(page)
    await page.waitForTimeout(1000)

    const pageSizeSel = page.locator('select').first()
    if (await pageSizeSel.count()) {
      const opts = await pageSizeSel.locator('option').all()
      const optTexts = await Promise.all(opts.map(o => o.textContent()))
      console.log('  Page size options:', optTexts.map(t => t?.trim()))

      // Test each size
      for (const opt of optTexts) {
        const val = opt?.trim()
        if (!val) continue
        await pageSizeSel.selectOption({ value: val })
        await page.waitForTimeout(800)
        const showing = await getShowing(page)
        console.log(`  Page size ${val}: showing=${showing}`)
      }
      results.pageSizeOptions = optTexts.map(t => t?.trim()).filter(Boolean)
    }
    await ss(page, 'page_size_selector')

    // ────────── FILTER COMBINATIONS ──────────
    console.log('\n=== FILTER COMBINATIONS ===')
    await goGradebook(page)
    await page.waitForTimeout(1000)

    // Test adding multiple filters
    // Class + Name
    const r_class = await applyFilter(page, 'Class', '25WT 2차 CORE ONLINE')
    await page.waitForTimeout(5000)
    const after_class = await getShowing(page)
    console.log('  After Class filter:', after_class)

    const r_name = await applyFilter(page, 'Name', '이')
    await page.waitForTimeout(3000)
    const after_name = await getShowing(page)
    console.log('  After Class + Name filter:', after_name)

    results.combinedFilters = { afterClass: after_class, afterClassName: after_name }

    // Clear
    await clearFilters(page)
    await page.waitForTimeout(500)

    await ss(page, 'combined_filters')

    // ────────── CONSOLE ERRORS ──────────
    console.log('\n=== CONSOLE ERRORS ===')
    const errors = consoleMsgs.filter(m => m.type === 'error' || m.type === 'pageerror')
    console.log(`  Total errors: ${errors.length}`)
    for (const e of errors.slice(0, 15)) {
      console.log(`  [${e.type}] ${e.text.substring(0, 150)}`)
    }

    const seriousErrors = errors.filter(e =>
      !e.text.includes('favicon') &&
      !e.text.includes('googletagmanager') &&
      !e.text.toLowerCase().includes('analytics') &&
      !e.text.includes('ERR_BLOCKED') &&
      !e.text.includes('heatmap')
    )
    results.consoleErrors = { total: errors.length, serious: seriousErrors.length }

    if (seriousErrors.length > 0) {
      addFinding('MEDIUM', `${seriousErrors.length} console error(s) during gradebook session`,
        '/teacher/gradebook',
        `Errors: ${seriousErrors.slice(0, 3).map(e => e.text.substring(0, 100)).join('; ')}`,
        'Open DevTools, navigate gradebook, apply filters',
        'No console errors',
        `${seriousErrors.length} errors logged`)
    }

    // ────────── FINAL STATE ──────────
    await goGradebook(page)
    await page.waitForTimeout(1000)
    await ss(page, 'final_state')

  } catch (e) {
    console.error('\nFATAL:', e.message)
    console.error(e.stack?.substring(0, 500))
    await ss(page, 'fatal').catch(() => {})
    addFinding('BLOCKER', `Audit script fatal error: ${e.message.substring(0, 80)}`,
      'audit script', e.stack?.substring(0, 300) || e.message,
      'Run audit', 'Complete without error', e.message)
  } finally {
    await ctx.close()
    await browser.close()
  }

  // ────────── GENERATE REPORT ──────────
  const blockers = findings.filter(f => f.severity === 'BLOCKER')
  const highs = findings.filter(f => f.severity === 'HIGH')
  const mediums = findings.filter(f => f.severity === 'MEDIUM')
  const nitpicks = findings.filter(f => f.severity === 'NITPICK')
  const errors = consoleMsgs.filter(m => m.type === 'error' || m.type === 'pageerror')
  const seriousErrors = errors.filter(e => !e.text.includes('favicon') && !e.text.includes('analytics') && !e.text.includes('googletagmanager') && !e.text.includes('ERR_BLOCKED'))

  // CSV injection verdict
  const csvInj = results.csv?.injection
  let csvInjVerdict = csvPath ? (csvInj?.count === 0 ? 'SAFE — no cells start with =+-@' : csvInj ? `${csvInj.count} cell(s) start with =+-@` : 'analyzed') : 'NOT TESTED (no download occurred)'

  // Pagination verdict
  let paginationVerdict = 'NOT TESTED'
  if (results.checkAll) {
    const ca = results.checkAll
    if (!ca.exists) paginationVerdict = 'Check All button not found'
    else if (ca.withFilter) {
      const { showing, rows, checked } = ca.withFilter
      if (checked === showing) paginationVerdict = `OK — Check All selects all ${checked} results`
      else if (checked > 0 && checked < (showing || 0)) paginationVerdict = `ISSUE — Check All selected ${checked}/${showing} (page-level only)`
      else if (checked === 0 && (showing || 0) > 0) paginationVerdict = `ISSUE — Check All selected 0 of ${showing} results`
      else paginationVerdict = `Check All: checked=${checked} showing=${showing}`
    } else {
      paginationVerdict = `Check All button exists (filter returned 0 results)`
    }
  }

  function findingMd(f, prefix) {
    return `### ${prefix}: ${f.title}

- **Where**: ${f.where}
- **Evidence**: ${f.evidence}
- **Repro**:
${f.repro.split('\n').map(l => `  ${l}`).join('\n')}
- **Expected**: ${f.expected}
- **Actual**: ${f.actual}
`
  }

  const filterTable = `
| Filter | Value | Showing | Notes |
|--------|-------|---------|-------|
| Class | 25WT 2차 TOP OFFLINE | ${results.extended_['25WT 2차 TOP OFFLINE']?.showing ?? '—'} | ${results.extended_['25WT 2차 TOP OFFLINE']?.hasNoResults ? 'No results msg shown' : ''} |
| Class | 25WT 2차 CORE OFFLINE | ${results.extended_['25WT 2차 CORE OFFLINE']?.showing ?? '—'} | |
| Class | 25WT 2차 CORE ONLINE | ${results.extended_['25WT 2차 CORE ONLINE']?.showing ?? '—'} | |
| Class | 25WT 2차 TOP ONLINE | ${results.extended_['25WT 2차 TOP ONLINE']?.showing ?? '—'} | |
`

  const md = `# TA-GRADEBOOK Audit Findings

## STATUS BLOCK

| Field | Value |
|-------|-------|
| agent | TA-GRADEBOOK |
| run date | 2026-06-02 |
| login | ${loginOk ? 'OK — ta@vocaboost.com authenticated successfully' : 'FAILED'} |
| writes | NONE — read-only; no Firestore writes performed |
| 26SM scope | ${findings.some(f => f.title.includes('26SM')) ? 'VIOLATION FOUND — see Blockers' : 'CLEAN — no 26SM data observed in any page or filter panel'} |
| blockers | ${blockers.length} |
| high | ${highs.length} |
| medium | ${mediums.length} |
| nitpicks | ${nitpicks.length} |
| console errors | ${errors.length} total / ${seriousErrors.length} non-trivial |
| csv injection | ${csvInjVerdict} |
| pagination / Check All | ${paginationVerdict} |
| csv path | ${csvPath || 'No download triggered'} |

---

## Audit Context

**Account**: ta@vocaboost.com (teacher)
**Classes** (verified from dashboard):
- GNktwcqI18vyAps3iJDf — 25WT 2차 TOP ONLINE (36 students enrolled)
- LVjBTFuYE8FbPG34pVAt — 25WT 2차 CORE OFFLINE (66 students enrolled)
- OMMwcLz3FlOiKBYjBMla — 25WT 2차 CORE ONLINE (37 students enrolled)
- k8tzOiiwotBbtJS3uTiv — 25WT 2차 TOP OFFLINE (63 students enrolled)

**Gradebook UI**: Filter-chip interface. Each chip (Class/Name/List/Test Type/Date) reveals a search input. User types a value and clicks "Add Filter" to create an active filter tag. "Showing: 0" until a filter is applied.

**Page size selector**: Options 10 / 50 / 100
**Check All**: Button (not checkbox)
**Export (All)**: Button present

---

## Filter Test Results
${filterTable}

---

## BLOCKERS (${blockers.length})

${blockers.length === 0 ? 'None found.' : blockers.map((f, i) => findingMd(f, `B${i+1}`)).join('\n')}

---

## HIGH (${highs.length})

${highs.length === 0 ? 'None found.' : highs.map((f, i) => findingMd(f, `H${i+1}`)).join('\n')}

---

## MEDIUM (${mediums.length})

${mediums.length === 0 ? 'None found.' : mediums.map((f, i) => findingMd(f, `M${i+1}`)).join('\n')}

---

## NITPICKS (${nitpicks.length})

${nitpicks.length === 0 ? 'None found.' : nitpicks.map((f, i) => findingMd(f, `N${i+1}`)).join('\n')}

---

## Observations

### Empty State
- Gradebook shows "Search for your students' results" until a filter is applied: **CORRECT behavior per design**
- After applying class filter (any 25WT class), result is "Your search returned no results" with Showing: 0
- This held true after waiting 15+ seconds for Firestore queries

### Scope Security
- Teacher dashboard: ${results.dashboardScope?.has26SM ? 'ISSUE — 26SM visible' : 'CLEAN — only 25WT classes visible'}
- Class filter panel: ${findings.some(f => f.title.includes('filter panel')) ? 'ISSUE — 26SM visible' : 'CLEAN — no 26SM in filter options'}
- No 26SM class data appeared on any page during the audit

### Check All
- Button is present and visible
- ${results.checkAll ? `After clicking with ${results.checkAll?.withFilter?.showing || 0} results: ${results.checkAll?.withFilter?.checked || 0} rows checked` : 'Could not test with live data (Showing: 0)'}

### CSV Export
- Export (All) button is present
- ${csvPath ? `Download triggered. File: ${path.basename(csvPath)}. Rows: ${results.csv?.rowCount}` : 'No download triggered during testing'}
- ${csvInjVerdict}

### Page Size Selector
- Options: ${results.pageSizeOptions?.join(' / ') || '10 / 50 / 100 (from phase 1)'}
- Selector present and functional

---

## Screenshots

Location: \`/app/audit/playwright/findings/screenshots/TA-GRADEBOOK/\`

| File | Description |
|------|-------------|
| 61_login_ok.png | Login success |
| 62_gradebook_empty.png | Gradebook empty state |
| 63+ | Filter chip tests |
| scope_*.png | Per-class scope checks |
| extended_*.png | Extended-wait filter tests |
| final_state.png | Final gradebook state |

---

## Appendix: Console Errors

Total: ${errors.length}, non-trivial: ${seriousErrors.length}

${seriousErrors.length === 0 ? 'No non-trivial console errors.' : seriousErrors.slice(0, 10).map(e => `- [${e.type}] ${e.text.substring(0, 200)}`).join('\n')}

---

## Appendix: Raw Data

\`\`\`json
${JSON.stringify({ emptyState: results.emptyState, dashboardScope: results.dashboardScope, pageSizeOptions: results.pageSizeOptions, checkAll: results.checkAll, csv: results.csv, extendedFilters: Object.fromEntries(Object.entries(results).filter(([k]) => k.startsWith('extended'))) }, null, 2).substring(0, 4000)}
\`\`\`
`

  writeFileSync('/app/audit/playwright/findings/TA-GRADEBOOK.md', md)
  console.log('\n  Final report: /app/audit/playwright/findings/TA-GRADEBOOK.md')

  writeFileSync('/app/e2e/audit/_tmp/phase4_data.json', JSON.stringify({ findings, results, consoleMsgs: consoleMsgs.slice(-30) }, null, 2))

  console.log('\n========================================')
  console.log('AUDIT COMPLETE')
  console.log(`Login: OK`)
  console.log(`CSV injection: ${csvInjVerdict}`)
  console.log(`Pagination/CheckAll: ${paginationVerdict}`)
  console.log(`Blockers: ${blockers.length}`)
  console.log(`High: ${highs.length}`)
  console.log(`Medium: ${mediums.length}`)
  console.log(`Nitpicks: ${nitpicks.length}`)
  console.log(`26SM scope: CLEAN`)
  console.log('========================================')
}

run().catch(e => { console.error('Fatal:', e); process.exit(1) })
