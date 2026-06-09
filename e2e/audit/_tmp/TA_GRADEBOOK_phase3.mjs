/**
 * TA-GRADEBOOK Phase 3 — Proper filter workflow:
 * 1. Click chip (Class/Name/etc.)
 * 2. Type in search input
 * 3. Click "Add Filter" button
 * 4. Results should appear
 *
 * Also: export, check all, pagination, scope leakage, scores
 */

import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import path from 'path'

const BASE_URL = 'https://vocaboostone.netlify.app'
const SCREENSHOTS_DIR = '/app/audit/playwright/findings/screenshots/TA-GRADEBOOK'
const DOWNLOADS_DIR = '/app/e2e/audit/_tmp/downloads'
const TA_EMAIL = 'ta@vocaboost.com'
const TA_PASS = 'VocaTA2026!'

const ALLOWED_CLASS_IDS = new Set([
  'GNktwcqI18vyAps3iJDf',
  'LVjBTFuYE8FbPG34pVAt',
  'OMMwcLz3FlOiKBYjBMla',
  'k8tzOiiwotBbtJS3uTiv',
])
const ALLOWED_CLASS_NAMES = [
  '25WT 2차 TOP ONLINE',
  '25WT 2차 CORE OFFLINE',
  '25WT 2차 CORE ONLINE',
  '25WT 2차 TOP OFFLINE',
]

mkdirSync(SCREENSHOTS_DIR, { recursive: true })
mkdirSync(DOWNLOADS_DIR, { recursive: true })

let ssIdx = 40
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
    if (msg.type() === 'error') console.log(`  [console.error] ${msg.text().substring(0, 120)}`)
  })
  page.on('pageerror', err => {
    consoleMsgs.push({ type: 'pageerror', text: err.toString(), ts: Date.now() })
    console.log(`  [pageerror] ${err.toString().substring(0, 120)}`)
  })
}

const findings = []
function addFinding(severity, title, where, evidence, repro, expected, actual) {
  findings.push({ severity, title, where, evidence, repro, expected, actual })
  console.log(`  [FINDING:${severity}] ${title}`)
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
  await page.waitForTimeout(2500)
  if (!page.url().includes('gradebook')) {
    await page.goto(`${BASE_URL}/teacher/gradebook`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
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
  const t = await page.locator('table tr').count()
  return t > 1 ? t - 1 : 0
}

/**
 * Apply a filter: click chip, type value, click Add Filter
 * Returns true if filter was applied and data loaded
 */
async function applyFilter(page, chipName, searchValue) {
  console.log(`\n  applyFilter("${chipName}", "${searchValue}")`)

  // Click the chip button
  const chip = page.getByRole('button', { name: chipName })
  if (!(await chip.count())) {
    console.log(`  WARN: chip "${chipName}" not found`)
    return false
  }
  await chip.first().click()
  await page.waitForTimeout(500)

  // Find the search input that appeared
  const input = page.locator('input:visible').first()
  if (!(await input.count())) {
    console.log('  WARN: no visible input after chip click')
    return false
  }

  const ph = await input.getAttribute('placeholder')
  console.log(`  Input placeholder: "${ph}"`)

  // Clear and type
  await input.fill(searchValue)
  await page.waitForTimeout(500)

  // Click "Add Filter" button
  const addFilterBtn = page.getByRole('button', { name: /add filter/i })
  if (!(await addFilterBtn.count())) {
    console.log('  WARN: Add Filter button not found')
    // Try pressing Enter
    await input.press('Enter')
    await page.waitForTimeout(1500)
  } else {
    await addFilterBtn.click()
    await page.waitForTimeout(2000)
  }

  const showing = await getShowing(page)
  const rows = await getRows(page)
  console.log(`  After filter "${chipName}=${searchValue}": showing=${showing} rows=${rows}`)
  return { showing, rows }
}

/**
 * Clear all active filters by clicking X on filter tags
 */
async function clearAllFilters(page) {
  // Active filter tags have an X button child inside a span
  const xBtns = await page.locator('span:has(button) button').all()
  console.log(`  Clearing ${xBtns.length} active filters`)
  for (const btn of xBtns) {
    await btn.click()
    await page.waitForTimeout(300)
  }
  await page.waitForTimeout(500)
  const showing = await getShowing(page)
  console.log(`  After clear: showing=${showing}`)
}

async function run() {
  console.log('\n========================================')
  console.log('TA-GRADEBOOK Phase 3 — Comprehensive Audit')
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
  let csvContent = null
  const results = {}

  try {
    // LOGIN
    await login(page)
    loginOk = true
    await ss(page, 'login_ok')

    // GRADEBOOK INITIAL STATE
    await goGradebook(page)
    await ss(page, 'gradebook_empty')
    console.log('\n=== EMPTY STATE ===')
    const emptyShowing = await getShowing(page)
    const emptyText = await page.locator('body').textContent()
    console.log('  Showing on load:', emptyShowing)
    const hasEmptyMsg = emptyText.includes('Search for your students') || emptyText.includes('no results') || emptyText.includes('No results')
    console.log('  Has empty state message:', hasEmptyMsg)
    results.emptyState = { showing: emptyShowing, hasMessage: hasEmptyMsg }

    // SCOPE LEAKAGE CHECK - initial
    if (emptyText.includes('26SM')) {
      addFinding('BLOCKER', '26SM class data visible on gradebook without any filter',
        '/teacher/gradebook initial load',
        '26SM text found in page body on load',
        'Login as ta@vocaboost.com, navigate to /teacher/gradebook',
        'Page should not contain 26SM class data',
        '26SM present in page body')
    } else {
      console.log('  Scope check (initial): CLEAN — no 26SM')
    }

    // ────────── FILTER TESTS ──────────
    console.log('\n=== FILTER AUDIT ===')

    // ── Test 1: Class filter with exact class name ──
    console.log('\n-- Test 1: Class filter (exact class name) --')
    await goGradebook(page)
    await page.waitForTimeout(1000)

    const r1 = await applyFilter(page, 'Class', '25WT 2차 TOP OFFLINE')
    await ss(page, 'filter_class_top_offline')
    results.filter_class_exact = r1

    if (r1 && (r1.showing || 0) > 0) {
      console.log('  SUCCESS: Class filter with exact name works!')

      // Scope leakage check with filter active
      const pageText = await page.locator('body').textContent()
      if (pageText.includes('26SM')) {
        addFinding('BLOCKER', '26SM data visible after applying 25WT class filter',
          '/teacher/gradebook with Class=25WT 2차 TOP OFFLINE filter',
          '26SM text in page body after class filter',
          'Apply Class filter for TOP OFFLINE',
          'Only TOP OFFLINE data',
          '26SM data leaked')
      }

      // Showing vs rows check
      const rowCount = await getRows(page)
      if (r1.showing !== null && rowCount > 0 && r1.showing !== rowCount) {
        addFinding('HIGH', '"Showing" count does not match rendered row count',
          '/teacher/gradebook with Class filter',
          `ss: filter_class_top_offline.png — Showing: ${r1.showing} but row count: ${rowCount}`,
          'Apply class filter, compare UI Showing count to rendered rows',
          `Showing (${r1.showing}) === rows (${rowCount})`,
          `Showing=${r1.showing} rows=${rowCount}`)
      }

      // Look at row data - check for NaN, undefined, >100%
      const bodyText2 = await page.locator('body').textContent()
      if (bodyText2.includes('NaN')) {
        addFinding('HIGH', 'NaN values visible in gradebook results',
          '/teacher/gradebook results',
          'Text "NaN" in page body after filter',
          'Apply class filter and inspect results',
          'All numbers valid',
          'NaN visible')
      }
      if (bodyText2.includes('undefined')) {
        addFinding('MEDIUM', '"undefined" string visible in gradebook results',
          '/teacher/gradebook results',
          'Text "undefined" in page body',
          'Apply class filter and inspect results',
          'No undefined text',
          '"undefined" visible')
      }
      const pcts = bodyText2.match(/(\d+)%/g) || []
      const over100 = pcts.filter(p => parseInt(p) > 100)
      if (over100.length > 0) {
        addFinding('HIGH', 'Score percentages > 100% found',
          '/teacher/gradebook results',
          `Values: ${over100.join(', ')}`,
          'Apply class filter, inspect percentage scores',
          'All scores 0–100%',
          `Found: ${over100.join(', ')}`)
      }
      results.scores = { hasNaN: bodyText2.includes('NaN'), hasUndefined: bodyText2.includes('undefined'), over100 }

    } else {
      console.log(`  Class filter with exact name returned showing=${r1?.showing} rows=${r1?.rows}`)

      // Try shorter search
      await clearAllFilters(page)
      await page.waitForTimeout(500)

      const r1b = await applyFilter(page, 'Class', 'TOP OFFLINE')
      await ss(page, 'filter_class_top_offline_short')
      results.filter_class_short = r1b

      if (r1b && (r1b.showing || 0) > 0) {
        console.log('  SUCCESS with shorter class name!')
      } else {
        // Try just "TOP"
        await clearAllFilters(page)
        const r1c = await applyFilter(page, 'Class', 'TOP')
        results.filter_class_top = r1c
        console.log(`  Filter "TOP": showing=${r1c?.showing}`)
      }
    }

    // ── Test 2: Name filter ──
    console.log('\n-- Test 2: Name filter --')
    await goGradebook(page)
    await page.waitForTimeout(1000)

    const r2 = await applyFilter(page, 'Name', '김')
    await ss(page, 'filter_name_korean')
    results.filter_name = r2

    // Clear and try English name
    await clearAllFilters(page)
    const r2b = await applyFilter(page, 'Name', 'Park')
    await ss(page, 'filter_name_english')
    results.filter_name_english = r2b
    console.log('  Name filter "Park":', r2b)

    // ── Test 3: List filter ──
    console.log('\n-- Test 3: List filter --')
    await goGradebook(page)
    await page.waitForTimeout(1000)

    const r3 = await applyFilter(page, 'List', 'List 1')
    await ss(page, 'filter_list')
    results.filter_list = r3

    // ── Test 4: Test Type filter ──
    console.log('\n-- Test 4: Test Type filter --')
    await goGradebook(page)
    await page.waitForTimeout(1000)

    const r4 = await applyFilter(page, 'Test Type', 'new')
    await ss(page, 'filter_testtype_new')
    results.filter_testtype = r4

    // ── Test 5: Date filter ──
    console.log('\n-- Test 5: Date filter --')
    await goGradebook(page)
    await page.waitForTimeout(1000)

    // Click Date chip
    const dateChip = page.getByRole('button', { name: 'Date' })
    if (await dateChip.count()) {
      await dateChip.click()
      await page.waitForTimeout(700)
      await ss(page, 'filter_date_open')
      const dateHtml = await page.locator('body').innerHTML()

      // Look for date inputs
      const dateInputs = await page.locator('input[type="date"], input[type="text"][placeholder*="date" i]').all()
      console.log('  Date filter inputs:', dateInputs.length)

      for (const inp of dateInputs) {
        const t = await inp.getAttribute('type')
        const ph = await inp.getAttribute('placeholder')
        console.log(`  Date input: type="${t}" placeholder="${ph}"`)
      }

      // Try filling date
      if (dateInputs.length > 0) {
        await dateInputs[0].fill('2026-01-01').catch(() => dateInputs[0].fill('01/01/2026').catch(() => {}))
        await page.waitForTimeout(300)
        const addFilter = page.getByRole('button', { name: /add filter/i })
        if (await addFilter.count()) {
          await addFilter.click()
          await page.waitForTimeout(2000)
          const r5 = { showing: await getShowing(page), rows: await getRows(page) }
          results.filter_date = r5
          await ss(page, 'filter_date_applied')
          console.log('  Date filter result:', r5)
        }
      } else {
        console.log('  No date inputs found — skipping date test')
      }
    }

    // ── Test 6: Combined filters ──
    console.log('\n-- Test 6: Combined filters --')
    await goGradebook(page)
    await page.waitForTimeout(1000)

    // Apply class filter then name filter
    const class1 = await applyFilter(page, 'Class', '25WT 2차 TOP OFFLINE')
    if (class1 && (class1.showing || 0) > 0) {
      // Now add name filter on top
      const combined = await applyFilter(page, 'Name', '김')
      results.filter_combined = combined
      await ss(page, 'filter_combined_class_name')
      console.log('  Combined filter result:', combined)

      // Verify combined should be ≤ class-only result
      if (combined && class1 && combined.showing !== null && class1.showing !== null) {
        if (combined.showing > class1.showing) {
          addFinding('HIGH', 'Combined filters return MORE results than single class filter',
            '/teacher/gradebook combined filters',
            `Class filter: ${class1.showing} results; Class + Name filter: ${combined.showing} results`,
            'Apply class filter, then add name filter',
            'Adding more filters should reduce or maintain count',
            `Count increased from ${class1.showing} to ${combined.showing}`)
        }
      }
    }

    // ────────── PAGE SIZE TESTS ──────────
    console.log('\n=== PAGE SIZE TESTS ===')
    await goGradebook(page)
    await page.waitForTimeout(1000)

    // Get a dataset by applying class filter
    const classResult = await applyFilter(page, 'Class', '25WT 2차 CORE OFFLINE')
    results.coreOfflineFilter = classResult
    console.log('  CORE OFFLINE filter result:', classResult)

    if (classResult && (classResult.showing || 0) > 0) {
      const totalCount = classResult.showing

      // Test page size changes
      const pageSizeSel = page.locator('select')
      if (await pageSizeSel.count()) {
        // Default
        const defaultRows = await getRows(page)
        console.log(`  Default rows shown: ${defaultRows}, total: ${totalCount}`)
        await ss(page, 'page_size_default')

        // Change to 10
        await pageSizeSel.selectOption({ value: '10' })
        await page.waitForTimeout(1500)
        const rows10 = await getRows(page)
        const showing10 = await getShowing(page)
        console.log(`  Page size 10: rows=${rows10} showing=${showing10}`)
        await ss(page, 'page_size_10')

        // KEY CHECK: Does "Showing" count still reflect TOTAL or just visible?
        if (showing10 !== null && showing10 !== totalCount) {
          addFinding('HIGH', '"Showing" count changes when page size changes — showing page count not total',
            '/teacher/gradebook pagination',
            `Total with no page-size = ${totalCount}; after page-size=10, Showing = ${showing10}`,
            '1. Apply class filter (note total count)\n2. Change page size to 10\n3. Check "Showing" count',
            'Showing count reflects total results regardless of page size',
            `Showing changed from ${totalCount} to ${showing10} on page-size change`)
        }

        results.pageSizes = { total: totalCount, default: defaultRows, size10: { rows: rows10, showing: showing10 } }

        // Change to 100
        await pageSizeSel.selectOption({ value: '100' })
        await page.waitForTimeout(1500)
        const rows100 = await getRows(page)
        const showing100 = await getShowing(page)
        console.log(`  Page size 100: rows=${rows100} showing=${showing100}`)
        await ss(page, 'page_size_100')
        results.pageSizes.size100 = { rows: rows100, showing: showing100 }

        // Known concern: Does filtering after page-size change work on full set?
        // Apply another filter on top of class filter
        const nameFilterResult = await applyFilter(page, 'Name', 'a')
        await ss(page, 'filter_after_page_size_change')
        console.log(`  Name filter "a" after page-size change: showing=${nameFilterResult?.showing} rows=${nameFilterResult?.rows}`)
        results.filterAfterPageSizeChange = nameFilterResult

        // Clear
        await clearAllFilters(page)
      }
    } else {
      console.log('  No CORE OFFLINE data loaded — skipping page size tests')

      // Still test page size selector existence
      await goGradebook(page)
      const pageSizeSel2 = page.locator('select')
      if (await pageSizeSel2.count()) {
        const opts = await pageSizeSel2.locator('option').all()
        results.pageSizeSelectorOptions = await Promise.all(opts.map(o => o.textContent()))
        console.log('  Page size options:', results.pageSizeSelectorOptions)
      }
    }

    // ────────── CHECK ALL ──────────
    console.log('\n=== CHECK ALL ===')
    await goGradebook(page)
    await page.waitForTimeout(1000)

    // Load some data first
    const checkAllClassResult = await applyFilter(page, 'Class', '25WT 2차 TOP OFFLINE')
    results.checkAllClass = checkAllClassResult

    const checkAllBtn = page.getByRole('button', { name: /check all/i }).first()
    if (await checkAllBtn.count()) {
      console.log('  Check All button found')

      // Screenshot before
      await ss(page, 'before_check_all')

      await checkAllBtn.click()
      await page.waitForTimeout(1000)
      await ss(page, 'after_check_all')

      // Count checked checkboxes
      const checked = await page.locator('input[type="checkbox"]:checked').count()
      const totalCheckboxes = await page.locator('input[type="checkbox"]').count()
      console.log(`  After Check All: checked=${checked} totalBoxes=${totalCheckboxes}`)
      console.log(`  Showing was: ${checkAllClassResult?.showing}`)

      results.checkAll = { checked, totalBoxes: totalCheckboxes, totalShowing: checkAllClassResult?.showing }

      // KEY TEST: If showing=N and checked < N, then Check All only selected page
      if (checkAllClassResult?.showing !== null && checked < (checkAllClassResult?.showing || 0)) {
        addFinding('HIGH', '"Check All" selects only visible page rows, not all results',
          '/teacher/gradebook Check All',
          `Showing: ${checkAllClassResult?.showing} total results, but Check All only checked ${checked} boxes`,
          '1. Apply class filter with >page-size results\n2. Click Check All\n3. Count checked checkboxes',
          'Check All should select all N results (or clearly state it selects current page)',
          `${checked} checked but ${checkAllClassResult?.showing} total results`)
      } else if (checked === 0 && (checkAllClassResult?.showing || 0) > 0) {
        addFinding('MEDIUM', '"Check All" checked 0 checkboxes even with results visible',
          '/teacher/gradebook Check All',
          `Showing: ${checkAllClassResult?.showing} results but 0 checkboxes checked after Check All click`,
          '1. Load class data\n2. Click Check All',
          'Rows should become checked',
          '0 checkboxes checked')
      } else {
        console.log(`  Check All: ${checked} checked vs ${checkAllClassResult?.showing} total — OK`)
      }

      // Also look for "Export (selected)" after checking
      const exportSelBtn = page.getByRole('button', { name: /export.*select/i })
      if (await exportSelBtn.count()) {
        console.log('  "Export (selected)" button appeared after Check All')
        results.exportSelectedButtonAppears = true
      }

    } else {
      console.log('  Check All button NOT found')
      results.checkAll = { found: false }
    }

    // ────────── CSV EXPORT ──────────
    console.log('\n=== CSV EXPORT ===')
    await goGradebook(page)
    await page.waitForTimeout(1000)

    // Load data
    await applyFilter(page, 'Class', '25WT 2차 TOP OFFLINE')
    await page.waitForTimeout(1000)

    const uiShowing = await getShowing(page)
    console.log('  UI showing count before export:', uiShowing)

    const exportBtn = page.getByRole('button', { name: /export.*all/i }).first()
    if (await exportBtn.count()) {
      console.log('  Export (All) button found')

      // Grab screenshot before export
      await ss(page, 'before_csv_export')

      try {
        const dlPromise = page.waitForEvent('download', { timeout: 15000 })
        await exportBtn.click()
        const dl = await dlPromise

        const fname = dl.suggestedFilename()
        console.log('  Download filename:', fname)
        const savePath = path.join(DOWNLOADS_DIR, fname || 'gradebook_export.csv')
        await dl.saveAs(savePath)
        csvPath = savePath
        console.log('  Saved to:', savePath)

        // Read and analyze
        csvContent = readFileSync(savePath)  // Read as Buffer for byte-level analysis
        const csvStr = csvContent.toString('utf-8')
        const csvLines = csvStr.split('\n').filter(l => l.trim())
        const headerLine = csvLines[0]
        const dataRows = csvLines.slice(1)

        console.log('  CSV rows (header + data):', csvLines.length)
        console.log('  Header:', headerLine)
        console.log('  First data row:', dataRows[0])
        console.log('  Last data row:', dataRows[dataRows.length - 1])

        results.csv = {
          found: true,
          downloaded: true,
          filename: fname,
          headers: headerLine,
          rowCount: dataRows.length,
          totalLines: csvLines.length,
        }

        // ── Row count vs UI Showing ──
        if (uiShowing !== null && dataRows.length !== uiShowing) {
          addFinding('HIGH', 'CSV row count does not match UI "Showing" count',
            'CSV export vs /teacher/gradebook',
            `CSV has ${dataRows.length} data rows; UI Showing: ${uiShowing}`,
            '1. Apply class filter\n2. Note Showing count\n3. Export CSV\n4. Count CSV rows',
            `CSV rows (${dataRows.length}) === UI Showing (${uiShowing})`,
            `CSV=${dataRows.length} UI=${uiShowing}`)
        } else if (uiShowing !== null) {
          console.log(`  CSV row count matches UI showing (${dataRows.length} = ${uiShowing}) ✓`)
        }

        // ── Korean character check ──
        const hasKorean = /[가-힣]/.test(csvStr)
        console.log('  CSV has Korean chars:', hasKorean)

        // Check for UTF-8 BOM (Excel-friendly)
        const hasBOM = csvContent[0] === 0xEF && csvContent[1] === 0xBB && csvContent[2] === 0xBF
        console.log('  CSV has UTF-8 BOM:', hasBOM)

        // Check for replacement character (U+FFFD = EF BF BD in UTF-8) — mojibake indicator
        let hasReplacementChar = false
        for (let i = 0; i < csvContent.length - 2; i++) {
          if (csvContent[i] === 0xEF && csvContent[i+1] === 0xBF && csvContent[i+2] === 0xBD) {
            hasReplacementChar = true
            break
          }
        }
        console.log('  CSV has Unicode replacement chars (mojibake):', hasReplacementChar)

        // Check for Latin1 interpretation of Korean (common mojibake pattern)
        // In Latin1, Korean chars encode to multi-byte sequences that look like garbage
        // We detect this by checking if non-ASCII chars are valid Korean/Chinese
        let suspectEncoding = false
        for (let i = 0; i < csvStr.length; i++) {
          const code = csvStr.charCodeAt(i)
          if (code > 127 && code < 0x1100) {
            // Non-ASCII but not Korean — could be Latin1 mojibake of Korean
            // Only flag if we also have Korean class names that should be there
            if (code >= 0xC0 && code <= 0xFF) {
              suspectEncoding = true
              break
            }
          }
        }

        results.csv.korean = { hasKorean, hasBOM, hasReplacementChar, suspectEncoding }

        if (hasReplacementChar) {
          addFinding('HIGH', 'CSV export has Unicode replacement characters — Korean names may be corrupted',
            'CSV export file',
            `Unicode replacement char (U+FFFD) found in CSV bytes. File: ${savePath}`,
            '1. Export CSV\n2. Check for ??? or replacement chars in Korean name fields',
            'Korean names render correctly (UTF-8)',
            'Replacement chars found — encoding issue')
        } else if (hasKorean) {
          console.log('  Korean chars render correctly in CSV ✓')
        }

        // ── CSV injection check ──
        console.log('\n  -- CSV Injection Check --')

        const injectionRiskCells = []
        const INJECTION_CHARS = new Set(['=', '+', '-', '@'])

        for (let lineIdx = 0; lineIdx < csvLines.length; lineIdx++) {
          const line = csvLines[lineIdx]
          // Parse CSV cells properly (basic: split on comma, handle quoted fields)
          const cells = []
          let cell = ''
          let inQuote = false
          for (let ci = 0; ci < line.length; ci++) {
            const ch = line[ci]
            if (ch === '"') {
              if (inQuote && line[ci+1] === '"') { cell += '"'; ci++ }
              else inQuote = !inQuote
            } else if (ch === ',' && !inQuote) {
              cells.push(cell)
              cell = ''
            } else {
              cell += ch
            }
          }
          cells.push(cell)

          for (let ci = 0; ci < cells.length; ci++) {
            const raw = cells[ci]
            if (raw.length > 0 && INJECTION_CHARS.has(raw[0])) {
              injectionRiskCells.push({
                line: lineIdx + 1,
                col: ci + 1,
                raw: raw.substring(0, 50),
                firstChar: raw[0],
                isFormula: /^[=+\-@].*[A-Z0-9(]/.test(raw),  // looks like a formula
              })
            }
          }
        }

        console.log('  Cells starting with =+-@:', injectionRiskCells.length)
        if (injectionRiskCells.length > 0) {
          console.log('  Injection risk cells (first 5):')
          for (const c of injectionRiskCells.slice(0, 5)) {
            console.log(`    Line ${c.line} Col ${c.col}: "${c.raw}" isFormula=${c.isFormula}`)
          }
          results.csv.injectionRisk = injectionRiskCells.length
          results.csv.injectionSamples = injectionRiskCells.slice(0, 5)

          const formulaLike = injectionRiskCells.filter(c => c.isFormula)
          if (formulaLike.length > 0) {
            addFinding('HIGH', `CSV export has ${formulaLike.length} cells that look like spreadsheet formulas (CSV injection risk)`,
              'CSV export file',
              `Cells with formula patterns: ${formulaLike.slice(0, 3).map(c => `line${c.line} col${c.col}: "${c.raw}"`).join(', ')}`,
              '1. Export CSV\n2. Open in Excel/LibreOffice\n3. Check if cells with = + - @ execute as formulas',
              'Formula chars should be escaped (prefixed with tab/apostrophe or sanitized)',
              `${formulaLike.length} potentially executable formula cells found`)
          } else {
            addFinding('NITPICK', `CSV has ${injectionRiskCells.length} cells starting with =+-@ but none look like full formulas`,
              'CSV export file',
              `Cells: ${injectionRiskCells.slice(0, 3).map(c => `"${c.raw}"`).join(', ')}`,
              'Export CSV and check in spreadsheet for formula execution',
              'All cells starting with =+-@ should be escaped',
              `${injectionRiskCells.length} cells start with formula chars but don't appear to be full formulas`)
          }
        } else {
          console.log('  CSV injection check: CLEAN ✓')
          results.csv.injectionSafe = true
        }

        await ss(page, 'after_csv_export')

      } catch (e) {
        console.log('  CSV export error:', e.message)
        results.csv = { found: true, downloaded: false, error: e.message }

        if (e.message.includes('Timeout') || e.message.includes('timeout')) {
          // Possible that export with data triggers no download, or is disabled
          addFinding('MEDIUM', 'CSV "Export (All)" click did not trigger file download',
            '/teacher/gradebook Export (All) button',
            `Download event timed out (15s) after clicking Export (All) with Showing: ${uiShowing}`,
            '1. Apply class filter\n2. Click "Export (All)"\n3. Check for file download',
            'File download triggers',
            `Timeout — no download event fired`)
        }
      }
    } else {
      console.log('  Export (All) button NOT found')
      results.csv = { found: false }
      addFinding('MEDIUM', '"Export (All)" button not found on gradebook page',
        '/teacher/gradebook',
        'Button with text "Export (All)" not found by Playwright',
        'Navigate to /teacher/gradebook',
        'Export (All) button visible',
        'Not found')
    }

    // ────────── ACTIVE FILTER TAGS SCOPE CHECK ──────────
    console.log('\n=== ACTIVE FILTER TAG SCOPE CHECK ===')
    await goGradebook(page)
    await page.waitForTimeout(1000)

    // Click Class and look for scope leakage in any dropdown/suggestions
    await page.getByRole('button', { name: 'Class' }).click()
    await page.waitForTimeout(600)
    await ss(page, 'class_filter_open_scope')

    const openText = await page.locator('body').textContent()
    if (openText.includes('26SM')) {
      addFinding('BLOCKER', '26SM appears in class filter panel/suggestions',
        '/teacher/gradebook class filter panel',
        '26SM text in page after opening Class filter',
        'Click Class filter button',
        'No 26SM classes in suggestions',
        '26SM text visible')
    } else {
      console.log('  Class filter open: no 26SM ✓')
    }

    // ────────── DETAILED CLASS FILTER SCOPE TEST ──────────
    // Apply each of the 4 allowed class filters and verify results
    console.log('\n=== CLASS SCOPE VERIFICATION ===')
    for (const className of ALLOWED_CLASS_NAMES) {
      await goGradebook(page)
      await page.waitForTimeout(800)

      const r = await applyFilter(page, 'Class', className)
      await ss(page, `scope_class_${className.replace(/[^a-z0-9]/gi, '_').substring(0, 20)}`)
      console.log(`  "${className}": showing=${r?.showing} rows=${r?.rows}`)
      results[`scope_${className}`] = r

      // Check no 26SM in results
      const scopeText = await page.locator('body').textContent()
      if (scopeText.includes('26SM')) {
        addFinding('BLOCKER', `26SM data visible when filtering by "${className}"`,
          `/teacher/gradebook with Class="${className}"`,
          '26SM in page text',
          `Apply class filter "${className}"`,
          'Only that class data',
          '26SM data leaked')
      }
    }

    // ────────── FILTER CHIP: "Add Filter" BUTTON BEHAVIOR ──────────
    console.log('\n=== ADD FILTER BUTTON ===')
    await goGradebook(page)
    await page.waitForTimeout(1000)

    // Click Class chip, fill value, check if "Add Filter" button exists
    await page.getByRole('button', { name: 'Class' }).click()
    await page.waitForTimeout(500)

    const input = page.locator('input:visible').first()
    if (await input.count()) {
      await input.fill('25WT 2차 CORE ONLINE')
      await page.waitForTimeout(400)

      const addBtn = page.getByRole('button', { name: /add filter/i })
      const addBtnExists = await addBtn.count() > 0
      console.log('  Add Filter button exists after typing:', addBtnExists)

      if (addBtnExists) {
        // Is it enabled?
        const isDisabled = await addBtn.first().isDisabled()
        console.log('  Add Filter button disabled:', isDisabled)
        results.addFilterButton = { exists: true, disabled: isDisabled }

        if (isDisabled) {
          addFinding('MEDIUM', '"Add Filter" button is disabled even with text in class search',
            '/teacher/gradebook Class filter',
            'Add Filter button is disabled after typing class name',
            '1. Click Class chip\n2. Type class name\n3. Check Add Filter button state',
            'Add Filter button should be enabled',
            'Button is disabled')
        }
      }
    }

    // ────────── TEST "CLEAR FILTERS" / RESET ──────────
    console.log('\n=== FILTER CLEAR / RESET ===')
    await goGradebook(page)
    await page.waitForTimeout(1000)

    // Apply a filter
    const filterApplied = await applyFilter(page, 'Class', '25WT 2차 TOP ONLINE')
    if (filterApplied) {
      // Find and click the X on the active filter tag
      const xBtn = page.locator('span button').first()  // X button on filter tag
      if (await xBtn.count()) {
        await xBtn.click()
        await page.waitForTimeout(1000)
        const afterClear = await getShowing(page)
        console.log('  After clearing filter: showing=', afterClear)
        await ss(page, 'after_filter_clear')
        results.filterClear = { afterClear }
      }
    }

    // ────────── CONSOLE ERRORS FINAL ──────────
    console.log('\n=== CONSOLE ERRORS ===')
    const errors = consoleMsgs.filter(m => m.type === 'error' || m.type === 'pageerror')
    console.log(`  Total errors: ${errors.length}`)
    for (const e of errors.slice(0, 10)) {
      console.log(`  [${e.type}] ${e.text.substring(0, 150)}`)
    }
    results.consoleErrors = errors.length

    const seriousErrors = errors.filter(e =>
      !e.text.includes('favicon') && !e.text.includes('googletagmanager') &&
      !e.text.toLowerCase().includes('analytics') && !e.text.includes('ERR_BLOCKED') &&
      !e.text.includes('heatmap') && !e.text.includes('hotjar')
    )
    if (seriousErrors.length > 0) {
      addFinding('MEDIUM', `${seriousErrors.length} console error(s) on gradebook page`,
        '/teacher/gradebook',
        `Errors: ${seriousErrors.slice(0, 3).map(e => e.text.substring(0, 80)).join('; ')}`,
        'Open DevTools while browsing /teacher/gradebook',
        'No console errors',
        `${seriousErrors.length} errors`)
    }

    // ────────── FINAL STATE SCREENSHOT ──────────
    await goGradebook(page)
    await page.waitForTimeout(1000)
    await ss(page, 'final_state')

  } catch (e) {
    console.error('\nFATAL:', e.message, e.stack)
    await ss(page, 'fatal').catch(() => {})
  } finally {
    await ctx.close()
    await browser.close()
  }

  // ────────── WRITE REPORT ──────────
  const blockers = findings.filter(f => f.severity === 'BLOCKER')
  const highs = findings.filter(f => f.severity === 'HIGH')
  const mediums = findings.filter(f => f.severity === 'MEDIUM')
  const nitpicks = findings.filter(f => f.severity === 'NITPICK')
  const errors = consoleMsgs.filter(m => m.type === 'error' || m.type === 'pageerror')

  function findingsMd(list, prefix) {
    if (list.length === 0) return 'None found.\n'
    return list.map((f, i) => `### ${prefix}${i+1}: ${f.title}

- **Where**: ${f.where}
- **Evidence**: ${f.evidence}
- **Repro**:
${f.repro.split('\n').map(l => `  ${l}`).join('\n')}
- **Expected**: ${f.expected}
- **Actual**: ${f.actual}
`).join('\n')
  }

  // Determine CSV injection verdict
  let csvInjectionVerdict = 'NOT TESTED (download failed)'
  if (csvPath) {
    const injRisk = results.csv?.injectionRisk || 0
    const injSafe = results.csv?.injectionSafe
    if (injSafe) csvInjectionVerdict = 'SAFE — no cells start with =+-@'
    else if (injRisk > 0) csvInjectionVerdict = `RISK — ${injRisk} cell(s) start with =+-@`
    else csvInjectionVerdict = 'SAFE (no injection chars found)'
  }

  // Pagination / Check All verdict
  let paginationVerdict = 'NOT TESTED (no data loaded)'
  const checkAllResult = results.checkAll
  if (checkAllResult) {
    if (checkAllResult.found === false) {
      paginationVerdict = 'Check All button not found'
    } else {
      const tot = checkAllResult.totalShowing
      const chk = checkAllResult.checked
      if (tot && chk < tot) paginationVerdict = `ISSUE — Check All only selected ${chk}/${tot} (page-only)`
      else if (chk === 0 && tot > 0) paginationVerdict = `ISSUE — Check All selected 0 of ${tot}`
      else paginationVerdict = `OK — Check All selected ${chk} of ${tot}`
    }
  }

  const md = `# TA-GRADEBOOK Audit Findings

## STATUS BLOCK

| Field | Value |
|-------|-------|
| agent | TA-GRADEBOOK |
| run date | 2026-06-02 |
| login | ${loginOk ? 'OK — ta@vocaboost.com authenticated successfully' : 'FAILED'} |
| writes | NONE — read-only audit; no Firestore writes, no app state changes |
| 26SM scope | ${findings.some(f => f.title.includes('26SM')) ? 'VIOLATION FOUND — see Blockers' : 'CLEAN — no 26SM data observed in any view or filter'} |
| blockers | ${blockers.length} |
| high | ${highs.length} |
| medium | ${mediums.length} |
| nitpicks | ${nitpicks.length} |
| console errors | ${errors.length} total (${errors.filter(e => !e.text.includes('favicon') && !e.text.includes('analytics')).length} non-trivial) |
| csv injection verdict | ${csvInjectionVerdict} |
| pagination / Check All | ${paginationVerdict} |
| csv path | ${csvPath || 'Download did not occur'} |

---

## Audit Context

The teacher account ta@vocaboost.com owns exactly 4 classes (all "25WT 2차" prefix):
- GNktwcqI18vyAps3iJDf — 25WT 2차 TOP ONLINE (36 students)
- LVjBTFuYE8FbPG34pVAt — 25WT 2차 CORE OFFLINE (66 students)
- OMMwcLz3FlOiKBYjBMla — 25WT 2차 CORE ONLINE (37 students)
- k8tzOiiwotBbtJS3uTiv — 25WT 2차 TOP OFFLINE (63 students)

The gradebook page at /teacher/gradebook shows "Showing: 0" until a filter is applied.
The filter workflow: click a chip button (Class/Name/List/Test Type/Date) → type in search input → click "Add Filter" → results appear as active filter tags.

### Filter Results Summary

| Filter | Value | Showing | Rows |
|--------|-------|---------|------|
| Class | 25WT 2차 TOP OFFLINE | ${results.filter_class_exact?.showing ?? 'N/A'} | ${results.filter_class_exact?.rows ?? 'N/A'} |
| Class | 25WT 2차 TOP ONLINE | ${results['scope_25WT 2차 TOP ONLINE']?.showing ?? 'N/A'} | ${results['scope_25WT 2차 TOP ONLINE']?.rows ?? 'N/A'} |
| Class | 25WT 2차 CORE OFFLINE | ${results.coreOfflineFilter?.showing ?? 'N/A'} | ${results.coreOfflineFilter?.rows ?? 'N/A'} |
| Class | 25WT 2차 CORE ONLINE | ${results['scope_25WT 2차 CORE ONLINE']?.showing ?? 'N/A'} | ${results['scope_25WT 2차 CORE ONLINE']?.rows ?? 'N/A'} |
| Name | 김 | ${results.filter_name?.showing ?? 'N/A'} | ${results.filter_name?.rows ?? 'N/A'} |
| Name | Park | ${results.filter_name_english?.showing ?? 'N/A'} | ${results.filter_name_english?.rows ?? 'N/A'} |
| List | List 1 | ${results.filter_list?.showing ?? 'N/A'} | ${results.filter_list?.rows ?? 'N/A'} |
| Test Type | new | ${results.filter_testtype?.showing ?? 'N/A'} | ${results.filter_testtype?.rows ?? 'N/A'} |
| Combined | Class+Name | ${results.filter_combined?.showing ?? 'N/A'} | ${results.filter_combined?.rows ?? 'N/A'} |

---

## BLOCKERS (${blockers.length})

${findingsMd(blockers, 'B')}

---

## HIGH (${highs.length})

${findingsMd(highs, 'H')}

---

## MEDIUM (${mediums.length})

${findingsMd(mediums, 'M')}

---

## NITPICKS (${nitpicks.length})

${findingsMd(nitpicks, 'N')}

---

## Screenshots

Location: /app/audit/playwright/findings/screenshots/TA-GRADEBOOK/

| # | Filename | Description |
|---|----------|-------------|
| 41 | 41_login_ok.png | Login success |
| 42 | 42_gradebook_empty.png | Initial empty state |
| Various | filter_class_*.png | Class filter tests |
| Various | scope_class_*.png | Per-class scope checks |
| Various | page_size_*.png | Pagination tests |
| Various | after_csv_export.png | Post-export state |

---

## Appendix: Raw Results Data

\`\`\`json
${JSON.stringify({ results, csvInjectionVerdict, paginationVerdict }, null, 2).substring(0, 5000)}
\`\`\`

## Appendix: Console Errors

Total: ${errors.length}

\`\`\`json
${JSON.stringify(errors.slice(0, 20).map(e => ({ type: e.type, text: e.text.substring(0, 200) })), null, 2)}
\`\`\`
`

  writeFileSync('/app/audit/playwright/findings/TA-GRADEBOOK.md', md)
  console.log('\n  Findings written to /app/audit/playwright/findings/TA-GRADEBOOK.md')

  // Save raw data
  writeFileSync('/app/e2e/audit/_tmp/phase3_data.json', JSON.stringify({
    findings, results, consoleMsgs: consoleMsgs.slice(-50),
    csvPath, csvInjectionVerdict, paginationVerdict,
  }, null, 2))

  console.log('\n========================================')
  console.log('AUDIT COMPLETE')
  console.log(`Login: ${loginOk ? 'OK' : 'FAILED'}`)
  console.log(`CSV injection: ${csvInjectionVerdict}`)
  console.log(`Pagination/CheckAll: ${paginationVerdict}`)
  console.log(`Blockers: ${blockers.length}`)
  console.log(`High: ${highs.length}`)
  console.log(`Medium: ${mediums.length}`)
  console.log(`Nitpicks: ${nitpicks.length}`)
  console.log(`No 26SM leakage: ${!findings.some(f => f.title.includes('26SM'))}`)
  console.log(`No writes performed: TRUE`)
  console.log('========================================')
}

run().catch(e => { console.error('Fatal:', e); process.exit(1) })
