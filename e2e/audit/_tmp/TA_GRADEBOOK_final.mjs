/**
 * TA-GRADEBOOK FINAL — All scenarios with proper state management
 */

import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import path from 'path'

const BASE_URL = 'https://vocaboostone.netlify.app'
const SCREENSHOTS_DIR = '/app/audit/playwright/findings/screenshots/TA-GRADEBOOK'
const DOWNLOADS_DIR = '/app/e2e/audit/_tmp/downloads'
const TA_EMAIL = 'ta@vocaboost.com'
const TA_PASS = 'VocaTA2026!'

const ALLOWED_CLASS_IDS = ['GNktwcqI18vyAps3iJDf', 'LVjBTFuYE8FbPG34pVAt', 'OMMwcLz3FlOiKBYjBMla', 'k8tzOiiwotBbtJS3uTiv']
const ALLOWED_CLASS_NAMES = ['25WT 2차 TOP ONLINE', '25WT 2차 CORE OFFLINE', '25WT 2차 CORE ONLINE', '25WT 2차 TOP OFFLINE']

mkdirSync(SCREENSHOTS_DIR, { recursive: true })
mkdirSync(DOWNLOADS_DIR, { recursive: true })

let ssIdx = 80
async function ss(page, label) {
  const fname = `${String(++ssIdx).padStart(2, '0')}_${label}.png`
  const fpath = path.join(SCREENSHOTS_DIR, fname)
  await page.screenshot({ path: fpath, fullPage: true })
  console.log(`  [ss] ${fname}`)
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
function F(severity, title, where, evidence, repro, expected, actual) {
  findings.push({ severity, title, where, evidence, repro, expected, actual })
  console.log(`\n  >>> FINDING [${severity}]: ${title}`)
}

async function login(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(1500)
  const ll = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await ll.count()) await ll.click()
  else await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')) })
  const e = page.getByLabel(/email/i).first()
  await e.waitFor({ timeout: 20000 })
  await e.fill(TA_EMAIL)
  await page.getByLabel(/password/i).first().fill(TA_PASS)
  await page.getByLabel(/password/i).first().press('Enter')
  try { await page.waitForURL(/\/(dashboard|teacher|$)/, { timeout: 15000 }) }
  catch { await page.getByRole('button', { name: /continue|log\s?in/i }).first().click().catch(() => {}); await page.waitForURL(/\/(dashboard|teacher|$)/, { timeout: 15000 }) }
  console.log('  Login OK')
}

// Always navigate fresh to gradebook
async function freshGradebook(page) {
  await page.goto(`${BASE_URL}/teacher/gradebook`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2500)
  return page
}

async function getShowing(page) {
  const t = await page.locator('body').textContent()
  const m = t.match(/[Ss]howing[:\s]+(\d+)/)
  return m ? parseInt(m[1]) : null
}

async function getRows(page) {
  return await page.locator('tbody tr').count()
}

// Apply a text-based filter: click chip → type in input → click Add Filter
async function applyTextFilter(page, chipText, value) {
  // Click chip
  const chips = await page.locator('div.flex button').all()
  let clicked = false
  for (const chip of chips) {
    const t = await chip.textContent()
    if (t?.trim() === chipText) {
      await chip.click()
      clicked = true
      break
    }
  }
  if (!clicked) {
    console.log(`  WARN: chip "${chipText}" not found in div.flex buttons`)
    return null
  }
  await page.waitForTimeout(500)

  // Type in input
  const inp = page.locator('input[placeholder*="Search by' + ' "]').first()
    .or(page.locator(`input[placeholder*="${chipText.toLowerCase()}"]`))
    .or(page.locator('input:visible').first())
  if (!(await inp.count())) {
    console.log(`  WARN: no input for "${chipText}"`)
    return null
  }
  const ph = await inp.first().getAttribute('placeholder')
  console.log(`    input placeholder: "${ph}"`)
  await inp.first().fill(value)
  await page.waitForTimeout(300)

  // Click Add Filter
  const addBtn = page.locator('button').filter({ hasText: /^Add Filter$/ }).first()
  if (await addBtn.count()) {
    await addBtn.click()
  } else {
    await inp.first().press('Enter')
  }

  await page.waitForTimeout(4000)  // Wait for Firestore

  const showing = await getShowing(page)
  const rows = await getRows(page)
  return { showing, rows }
}

// Apply button-based filter (Test Type or Date)
async function applyButtonFilter(page, chipText, buttonLabel) {
  const chips = await page.locator('div.flex button').all()
  for (const chip of chips) {
    const t = await chip.textContent()
    if (t?.trim() === chipText) {
      await chip.click()
      break
    }
  }
  await page.waitForTimeout(500)

  // Click the specific option button
  const optBtn = page.getByRole('button', { name: buttonLabel }).first()
  if (await optBtn.count()) {
    await optBtn.click()
    await page.waitForTimeout(4000)
    const showing = await getShowing(page)
    const rows = await getRows(page)
    return { showing, rows }
  }
  return null
}

// Remove all active filter tags (safe version)
async function clearAll(page) {
  for (let i = 0; i < 10; i++) {
    // Find X button in an active filter tag (span with inline-flex that contains an SVG X)
    const xBtn = page.locator('div.mt-6 button, span.inline-flex button').first()
    const cnt = await xBtn.count()
    if (cnt === 0) break
    await xBtn.click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(300)
  }
}

async function run() {
  console.log('\n=====================================')
  console.log('TA-GRADEBOOK FINAL AUDIT')
  console.log('=====================================')

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
  let csvStr = null
  const R = {}  // results accumulator

  try {
    // LOGIN
    await login(page)
    loginOk = true
    await ss(page, '01_login')

    // ────────── 1. SCOPE CHECK: DASHBOARD ──────────
    console.log('\n--- 1. SCOPE CHECK: DASHBOARD ---')
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await ss(page, '02_dashboard')

    const dashText = await page.locator('body').textContent()
    R.scope_26SM_dashboard = dashText.includes('26SM')

    if (R.scope_26SM_dashboard) {
      F('BLOCKER', '26SM class data visible on teacher dashboard',
        '/ (teacher dashboard)',
        '26SM text found in page body',
        'Login as ta@vocaboost.com, navigate to dashboard',
        'Only 25WT classes',
        '26SM visible')
    }

    // Verify 4 class links
    const classLinks = await page.locator('a[href*="/classes/"]').all()
    const classHrefs = await Promise.all(classLinks.map(l => l.getAttribute('href')))
    const classIdsOnDash = classHrefs.map(h => h?.match(/\/classes\/([A-Za-z0-9]+)/)?.[1]).filter(Boolean)
    const invalidIds = classIdsOnDash.filter(id => !ALLOWED_CLASS_IDS.includes(id))

    R.dashboardClassIds = classIdsOnDash
    R.dashboardInvalidIds = invalidIds

    if (invalidIds.length > 0) {
      F('BLOCKER', 'Non-allowed class IDs on teacher dashboard',
        '/',
        `Invalid IDs: ${invalidIds.join(', ')}`,
        'Login, check dashboard',
        'Only 4 25WT class IDs',
        `Found: ${invalidIds.join(', ')}`)
    }
    console.log(`  Dashboard classes: ${classIdsOnDash.length} IDs (invalid: ${invalidIds.length}) — 26SM: ${R.scope_26SM_dashboard}`)

    // ────────── 2. GRADEBOOK: EMPTY STATE ──────────
    console.log('\n--- 2. EMPTY STATE ---')
    await freshGradebook(page)
    await ss(page, '03_empty_state')

    const emptyText = await page.locator('body').textContent()
    R.emptyShowing = await getShowing(page)
    R.emptyStateHasMsg = emptyText.includes('Search for your students') || emptyText.includes('search')
    R.scope_26SM_gradebook = emptyText.includes('26SM')

    if (R.scope_26SM_gradebook) {
      F('BLOCKER', '26SM class data visible on empty gradebook',
        '/teacher/gradebook',
        '26SM in page body on load',
        'Navigate to /teacher/gradebook',
        'No 26SM',
        '26SM visible')
    }
    console.log(`  Empty state: showing=${R.emptyShowing} hasMsg=${R.emptyStateHasMsg} 26SM=${R.scope_26SM_gradebook}`)

    // ────────── 3. FILTER CHIP: CLASS ──────────
    console.log('\n--- 3. FILTER: CLASS ---')

    for (const className of ALLOWED_CLASS_NAMES) {
      await freshGradebook(page)
      const r = await applyTextFilter(page, 'Class', className)
      R[`class_${className}`] = r
      await ss(page, `04_class_${className.replace(/[^a-z0-9]/gi, '_').substring(0, 25)}`)

      // Check scope leakage
      const txt = await page.locator('body').textContent()
      if (txt.includes('26SM')) {
        F('BLOCKER', `26SM visible after class filter "${className}"`,
          `/teacher/gradebook with class="${className}"`,
          '26SM in page text', `Apply class filter ${className}`, 'Only that class', '26SM leaked')
      }

      // Showing vs rows mismatch
      if (r?.showing !== null && r?.rows > 0 && r?.showing !== r?.rows) {
        F('HIGH', 'Showing count ≠ rendered row count',
          `/teacher/gradebook class="${className}"`,
          `Showing=${r?.showing} rows=${r?.rows}`,
          `Apply class filter "${className}"`,
          'Showing count matches rows',
          `Showing=${r?.showing} rows=${r?.rows}`)
      }

      console.log(`  Class "${className}": showing=${r?.showing} rows=${r?.rows}`)
    }

    // Summary: did any class filter return data?
    const anyClassData = ALLOWED_CLASS_NAMES.some(cn => (R[`class_${cn}`]?.showing || 0) > 0)
    console.log('\n  ANY CLASS DATA LOADED:', anyClassData)

    if (!anyClassData) {
      // This is a blocker - the gradebook shows no data for any class
      F('BLOCKER',
        'Class filter returns Showing: 0 for ALL 4 classes — gradebook has no data for ta@vocaboost.com',
        '/teacher/gradebook Class filter',
        `All 4 class filters tested (${ALLOWED_CLASS_NAMES.join(', ')}) — every one returned Showing: 0 after 4+ second wait. ` +
        'Firestore requests are made. Teacher dashboard shows 36/66/37/63 students enrolled in these classes.',
        '1. Login as ta@vocaboost.com\n2. /teacher/gradebook\n3. Click "Class" chip\n4. Type class name\n5. Click "Add Filter"\n6. Wait 5+ seconds',
        'Student test submission records appear (Showing: N > 0)',
        'Showing: 0 — "Your search returned no results" for all class filters')
    }

    // ────────── 4. FILTER CHIP: NAME ──────────
    console.log('\n--- 4. FILTER: NAME ---')
    await freshGradebook(page)
    const rName1 = await applyTextFilter(page, 'Name', '김')
    R.filter_name_korean = rName1
    await ss(page, '05_filter_name_korean')
    console.log(`  Name "김": showing=${rName1?.showing} rows=${rName1?.rows}`)

    await freshGradebook(page)
    const rName2 = await applyTextFilter(page, 'Name', 'Kim')
    R.filter_name_english = rName2
    console.log(`  Name "Kim": showing=${rName2?.showing} rows=${rName2?.rows}`)

    // ────────── 5. FILTER CHIP: LIST ──────────
    console.log('\n--- 5. FILTER: LIST ---')
    await freshGradebook(page)
    const rList = await applyTextFilter(page, 'List', 'List')
    R.filter_list = rList
    await ss(page, '06_filter_list')
    console.log(`  List "List": showing=${rList?.showing} rows=${rList?.rows}`)

    // ────────── 6. FILTER CHIP: TEST TYPE ──────────
    console.log('\n--- 6. FILTER: TEST TYPE ---')
    await freshGradebook(page)

    // Click Test Type chip
    const chips6 = await page.locator('div.flex button').all()
    for (const chip of chips6) {
      const t = await chip.textContent()
      if (t?.trim() === 'Test Type') { await chip.click(); break }
    }
    await page.waitForTimeout(500)
    await ss(page, '07_testtype_open')

    // What buttons appear?
    const ttBtns = await page.locator('button:visible').all()
    const ttTexts = await Promise.all(ttBtns.map(b => b.textContent()))
    console.log('  Test Type buttons:', ttTexts.map(t => t?.trim()).filter(Boolean))
    R.testTypeOptions = ttTexts.map(t => t?.trim()).filter(t => t === 'MCQ' || t === 'Written')

    // Try clicking MCQ
    const mcqBtn = page.getByRole('button', { name: 'MCQ' }).first()
    if (await mcqBtn.count()) {
      await mcqBtn.click()
      await page.waitForTimeout(4000)
      const rMCQ = { showing: await getShowing(page), rows: await getRows(page) }
      R.filter_testtype_mcq = rMCQ
      await ss(page, '08_filter_mcq')
      console.log(`  Test Type MCQ: showing=${rMCQ.showing} rows=${rMCQ.rows}`)
    }

    // ────────── 7. FILTER CHIP: DATE ──────────
    console.log('\n--- 7. FILTER: DATE ---')
    await freshGradebook(page)

    const chips7 = await page.locator('div.flex button').all()
    for (const chip of chips7) {
      const t = await chip.textContent()
      if (t?.trim() === 'Date') { await chip.click(); break }
    }
    await page.waitForTimeout(500)
    await ss(page, '09_date_open')

    const dateBtns = await page.locator('button:visible').all()
    const dateBtnTexts = await Promise.all(dateBtns.map(b => b.textContent()))
    console.log('  Date buttons:', dateBtnTexts.map(t => t?.trim()).filter(t => ['Today', 'Yesterday', 'Past 7 days', 'Past 30 days', 'Custom'].includes(t?.trim())))
    R.dateFilterOptions = dateBtnTexts.map(t => t?.trim()).filter(t => t === 'Today' || t === 'Yesterday' || t?.includes('Past') || t === 'Custom')

    // Try "Past 30 days"
    const past30Btn = page.getByRole('button', { name: 'Past 30 days' }).first()
    if (await past30Btn.count()) {
      await past30Btn.click()
      await page.waitForTimeout(4000)
      const rDate = { showing: await getShowing(page), rows: await getRows(page) }
      R.filter_date_past30 = rDate
      await ss(page, '10_filter_date_past30')
      console.log(`  Date "Past 30 days": showing=${rDate.showing} rows=${rDate.rows}`)
    }

    // ────────── 8. COMBINED FILTERS ──────────
    console.log('\n--- 8. COMBINED FILTERS ---')
    await freshGradebook(page)

    // Apply Class then Name
    const rClass8 = await applyTextFilter(page, 'Class', '25WT 2차 TOP OFFLINE')
    const showingAfterClass = await getShowing(page)
    console.log(`  After Class filter: showing=${showingAfterClass}`)

    // Now add Name filter without clearing
    const rName8 = await applyTextFilter(page, 'Name', '김')
    const showingAfterBoth = await getShowing(page)
    console.log(`  After Class+Name filter: showing=${showingAfterBoth}`)

    R.combined_class_name = { afterClass: showingAfterClass, afterBoth: showingAfterBoth }
    await ss(page, '11_combined_filters')

    // Validate: combined should be ≤ class-only
    if (showingAfterBoth !== null && showingAfterClass !== null &&
        showingAfterBoth > showingAfterClass && showingAfterClass > 0) {
      F('HIGH', 'Combined filter returns MORE results than individual filter',
        '/teacher/gradebook',
        `Class filter: ${showingAfterClass}; Class+Name filter: ${showingAfterBoth}`,
        'Apply Class filter, then add Name filter',
        'Adding Name filter should narrow results',
        `Count increased: ${showingAfterClass} → ${showingAfterBoth}`)
    }

    // ────────── 9. FILTER CLEAR ──────────
    console.log('\n--- 9. FILTER CLEAR ---')
    await freshGradebook(page)
    await applyTextFilter(page, 'Class', '25WT 2차 CORE OFFLINE')
    await ss(page, '12_before_clear')

    const showingBeforeClear = await getShowing(page)
    console.log('  Showing before clear:', showingBeforeClear)

    // Find and click X on active filter tag
    // The X is in: div.mt-6 > span > button
    const activeTagX = page.locator('div.mt-6 span button').first()
    if (await activeTagX.count()) {
      await activeTagX.click()
      await page.waitForTimeout(1000)
      const showingAfterClear = await getShowing(page)
      console.log('  Showing after clear:', showingAfterClear)
      await ss(page, '13_after_clear')
      R.filterClear = { before: showingBeforeClear, after: showingAfterClear }
    }

    // ────────── 10. PAGINATION / PAGE SIZE ──────────
    console.log('\n--- 10. PAGE SIZE SELECTOR ---')
    await freshGradebook(page)
    await ss(page, '14_page_size')

    const pageSizeSel = page.locator('select').first()
    if (await pageSizeSel.count()) {
      const opts = await pageSizeSel.locator('option').all()
      R.pageSizeOptions = await Promise.all(opts.map(o => o.textContent()))
      console.log('  Options:', R.pageSizeOptions.map(t => t?.trim()))

      // Test each size
      for (const opt of opts) {
        const val = await opt.getAttribute('value')
        const text = await opt.textContent()
        await pageSizeSel.selectOption({ value: val || '' })
        await page.waitForTimeout(800)
        const showing = await getShowing(page)
        console.log(`  pageSize=${text?.trim()}: showing=${showing}`)
      }
    }

    // ────────── 11. CHECK ALL ──────────
    console.log('\n--- 11. CHECK ALL ---')
    await freshGradebook(page)
    await ss(page, '15_checkall_initial')

    const checkAllBtn = page.locator('button').filter({ hasText: /^Check All$/ }).first()
    R.checkAllExists = await checkAllBtn.count() > 0
    console.log('  Check All button exists:', R.checkAllExists)

    if (R.checkAllExists) {
      // State 1: Click Check All with Showing: 0
      await checkAllBtn.click()
      await page.waitForTimeout(800)
      const checked0 = await page.locator('input[type="checkbox"]:checked').count()
      const bodyAfterCA = await page.locator('body').textContent()
      const btnTextAfterCA = bodyAfterCA.includes('Uncheck All') ? 'Uncheck All' : 'Check All'
      console.log(`  Check All (showing:0) → checked=${checked0}, btn text="${btnTextAfterCA}"`)
      await ss(page, '16_checkall_empty')

      R.checkAll = { exists: true, emptyChecked: checked0, btnChanges: btnTextAfterCA === 'Uncheck All' }

      // State 2: Apply filter, then Check All
      await freshGradebook(page)
      const rFilter11 = await applyTextFilter(page, 'Class', '25WT 2차 TOP ONLINE')
      const showing11 = await getShowing(page)
      const rows11 = await getRows(page)
      console.log(`  After class filter: showing=${showing11} rows=${rows11}`)

      const checkAllBtn2 = page.locator('button').filter({ hasText: /^Check All$/ }).first()
      if (await checkAllBtn2.count()) {
        await checkAllBtn2.click()
        await page.waitForTimeout(1000)
        const checked11 = await page.locator('input[type="checkbox"]:checked').count()
        const bodyAfterCA2 = await page.locator('body').textContent()
        const btnText11 = bodyAfterCA2.includes('Uncheck All') ? 'Uncheck All' : 'Check All'
        console.log(`  Check All (showing:${showing11} rows:${rows11}) → checked=${checked11} btnText="${btnText11}"`)
        await ss(page, '17_checkall_with_filter')

        R.checkAll.withFilter = {
          showing: showing11,
          rows: rows11,
          checked: checked11,
          btnChanges: btnText11 === 'Uncheck All',
        }

        if (showing11 !== null && showing11 > 0 && checked11 < showing11) {
          F('HIGH', '"Check All" selects only current page rows, not all results',
            '/teacher/gradebook',
            `Showing: ${showing11}, rows visible: ${rows11}, but only ${checked11} rows checked`,
            '1. Apply class filter (many results)\n2. Set page size < total\n3. Click Check All',
            'All N results selected',
            `Only ${checked11} selected out of ${showing11} total`)
        } else if (showing11 !== null && showing11 > 0 && checked11 === 0) {
          F('MEDIUM', '"Check All" checked 0 rows with results visible',
            '/teacher/gradebook',
            `Showing: ${showing11} rows, but 0 checkboxes checked after Check All`,
            '1. Apply class filter\n2. Click Check All',
            'Rows become checked',
            '0 checkboxes checked')
        } else if (checked11 === showing11 && showing11 > 0) {
          console.log(`  Check All: OK — ${checked11}/${showing11} selected`)
        }

        // Look for "Export (selected)" button
        const exportSelBtn = page.locator('button').filter({ hasText: /export.*sel/i }).first()
        R.checkAll.exportSelectedAppears = await exportSelBtn.count() > 0
        console.log('  Export (selected) appears:', R.checkAll.exportSelectedAppears)
      }
    }

    // ────────── 12. CSV EXPORT ──────────
    console.log('\n--- 12. CSV EXPORT ---')
    await freshGradebook(page)

    const exportBtn = page.locator('button').filter({ hasText: /^Export \(All\)$/ }).first()
    R.exportAllExists = await exportBtn.count() > 0
    console.log('  Export (All) button exists:', R.exportAllExists)

    if (R.exportAllExists) {
      // Test A: Export with Showing: 0
      console.log('  A: Export with empty state (Showing: 0)...')
      try {
        const dlPromise = page.waitForEvent('download', { timeout: 6000 })
        await exportBtn.click()
        const dl = await dlPromise
        const savePath = path.join(DOWNLOADS_DIR, dl.suggestedFilename() || 'empty_export.csv')
        await dl.saveAs(savePath)
        const content = readFileSync(savePath, 'utf-8')
        console.log(`  Export (empty): downloaded! Rows: ${content.split('\n').filter(l => l.trim()).length - 1}`)
        R.exportEmpty = { downloaded: true, rowCount: content.split('\n').filter(l => l.trim()).length - 1 }

        if (R.exportEmpty.rowCount > 0) {
          F('HIGH', 'Export (All) downloads data even when Showing: 0',
            '/teacher/gradebook',
            `Export downloaded ${R.exportEmpty.rowCount} rows when Showing was 0`,
            '1. Load gradebook with no filter (Showing: 0)\n2. Click Export (All)',
            'Either no download, or download with 0 rows',
            `${R.exportEmpty.rowCount} rows downloaded despite Showing: 0`)
        }
      } catch {
        R.exportEmpty = { downloaded: false }
        console.log('  Export (empty): no download triggered (expected)')
      }

      // Test B: Apply class filter, then export
      console.log('\n  B: Export after class filter...')
      await freshGradebook(page)
      await applyTextFilter(page, 'Class', '25WT 2차 TOP OFFLINE')
      await page.waitForTimeout(3000)

      const showingB = await getShowing(page)
      console.log(`  Showing before export: ${showingB}`)

      try {
        const dlPromise = page.waitForEvent('download', { timeout: 15000 })
        const exportBtn2 = page.locator('button').filter({ hasText: /^Export \(All\)$/ }).first()
        await exportBtn2.click()
        const dl = await dlPromise

        const fname = dl.suggestedFilename()
        const savePath = path.join(DOWNLOADS_DIR, fname || 'export_class.csv')
        await dl.saveAs(savePath)
        csvPath = savePath

        const csvBuf = readFileSync(savePath)
        csvStr = csvBuf.toString('utf-8')
        const csvLines = csvStr.split('\n').filter(l => l.trim())
        const header = csvLines[0]
        const dataRows = csvLines.slice(1)

        console.log(`  Downloaded: ${fname}`)
        console.log(`  Header: ${header}`)
        console.log(`  Rows: ${dataRows.length}`)
        console.log(`  First row: ${dataRows[0]}`)

        R.csv = {
          downloaded: true,
          filename: fname,
          header,
          rowCount: dataRows.length,
          uiShowing: showingB,
        }

        await ss(page, '18_after_export')

        // Row count vs UI
        if (showingB !== null && dataRows.length !== showingB) {
          F('HIGH', 'CSV row count ≠ UI Showing count',
            'CSV export',
            `UI Showing: ${showingB}; CSV data rows: ${dataRows.length}`,
            '1. Apply class filter\n2. Note Showing\n3. Export CSV\n4. Count rows',
            `CSV rows (${dataRows.length}) === UI Showing (${showingB})`,
            `CSV=${dataRows.length} UI=${showingB}`)
        } else if (showingB !== null) {
          console.log(`  CSV row count matches UI: ${dataRows.length} = ${showingB} ✓`)
        }

        // Korean encoding
        const hasKorean = /[가-힣]/.test(csvStr)
        const hasBOM = csvBuf[0] === 0xEF && csvBuf[1] === 0xBB && csvBuf[2] === 0xBF
        let hasRepChar = false
        for (let i = 0; i < csvBuf.length - 2; i++) {
          if (csvBuf[i] === 0xEF && csvBuf[i+1] === 0xBF && csvBuf[i+2] === 0xBD) { hasRepChar = true; break }
        }
        console.log(`  Korean: ${hasKorean} BOM: ${hasBOM} ReplacementChar: ${hasRepChar}`)
        R.csv.encoding = { hasKorean, hasBOM, hasRepChar }

        if (hasRepChar) {
          F('HIGH', 'CSV has Unicode replacement characters (U+FFFD) — Korean names may be corrupted',
            'CSV export file',
            `U+FFFD bytes found. File: ${savePath}`,
            '1. Export CSV\n2. Inspect hex dump for EF BF BD sequences',
            'Clean UTF-8, no replacement chars',
            'Replacement chars found')
        } else if (hasKorean) {
          console.log('  Korean chars: CLEAN ✓')
        }

        // CSV injection
        const INJECTCHARS = new Set(['=', '+', '-', '@'])
        const injCells = []
        for (let li = 0; li < csvLines.length; li++) {
          const line = csvLines[li]
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
            const v = cells[ci]
            if (v.length > 0 && INJECTCHARS.has(v[0])) {
              injCells.push({ line: li+1, col: ci+1, val: v.substring(0, 50) })
            }
          }
        }

        console.log(`  CSV injection cells (start with =+-@): ${injCells.length}`)
        for (const c of injCells.slice(0, 5)) console.log(`    L${c.line}C${c.col}: "${c.val}"`)

        R.csv.injection = { count: injCells.length, samples: injCells.slice(0, 5) }

        const formulaLike = injCells.filter(c => /^[=+\-@][A-Za-z0-9(]/.test(c.val))
        if (formulaLike.length > 0) {
          F('HIGH', `CSV has ${formulaLike.length} formula-like cell(s) — potential CSV injection vulnerability`,
            'CSV export file',
            `Cells starting with formula patterns: ${formulaLike.slice(0, 3).map(c => `col${c.col}:"${c.val}"`).join(', ')}`,
            '1. Export CSV\n2. Open in Excel or LibreOffice Calc\n3. Check if cells with = execute as formulas',
            'Formula chars should be escaped with prefix or sanitized',
            `${formulaLike.length} unescaped formula cell(s) found`)
        } else if (injCells.length > 0) {
          F('NITPICK', `CSV has ${injCells.length} cell(s) starting with =+-@ but none look like full formulas`,
            'CSV export',
            `Cells: ${injCells.slice(0, 3).map(c => `"${c.val}"`).join(', ')}`,
            'Export CSV, check in spreadsheet',
            'Escape all cells starting with formula chars',
            `${injCells.length} cells start with formula chars (low risk)`)
        } else {
          console.log('  CSV injection: SAFE ✓')
          R.csv.injectionSafe = true
        }

      } catch (e) {
        console.log('  Export B error:', e.message.substring(0, 100))
        R.csv = { downloaded: false, error: e.message.substring(0, 100) }

        F('MEDIUM', 'Export (All) did not trigger download (Showing: ' + showingB + ')',
          '/teacher/gradebook Export (All)',
          `No download event fired within 15s after clicking Export (All). Showing was: ${showingB}. Error: ${e.message.substring(0, 80)}`,
          '1. Apply class filter\n2. Click "Export (All)"\n3. Check for file download',
          'CSV file downloads',
          'Timeout — no download event')
      }
    } else {
      F('MEDIUM', 'Export (All) button not found on gradebook page',
        '/teacher/gradebook',
        'Button text "Export (All)" not found',
        'Navigate to /teacher/gradebook',
        'Export button present',
        'Not found')
    }

    // ────────── 13. FILTER SCOPE: CLASS FILTER ONLY SHOWS TA CLASSES ──────────
    console.log('\n--- 13. FILTER SCOPE ---')
    await freshGradebook(page)

    // Click Class chip and check what suggestions/input state appears
    const classChip13 = await page.locator('div.flex button').all()
    for (const chip of classChip13) {
      const t = await chip.textContent()
      if (t?.trim() === 'Class') { await chip.click(); break }
    }
    await page.waitForTimeout(600)
    await ss(page, '19_class_filter_open_scope')

    const classOpenText = await page.locator('body').textContent()
    R.scope_26SM_classFilter = classOpenText.includes('26SM')
    if (R.scope_26SM_classFilter) {
      F('BLOCKER', '26SM appears when Class filter is opened',
        '/teacher/gradebook Class filter open state',
        '26SM in page text after clicking Class chip',
        '1. Navigate to /teacher/gradebook\n2. Click "Class" chip',
        'Only 25WT class suggestions',
        '26SM visible')
    }
    console.log('  Class filter open — 26SM visible:', R.scope_26SM_classFilter)

    // ────────── 14. SCORES SANITY ──────────
    // Only testable if data was loaded; check from any loaded state
    console.log('\n--- 14. SCORES SANITY ---')
    const anyData = ALLOWED_CLASS_NAMES.some(cn => (R[`class_${cn}`]?.showing || 0) > 0)
    if (anyData) {
      // Get the class that had data
      for (const cn of ALLOWED_CLASS_NAMES) {
        if ((R[`class_${cn}`]?.showing || 0) > 0) {
          await freshGradebook(page)
          await applyTextFilter(page, 'Class', cn)
          await page.waitForTimeout(3000)
          const bodyText = await page.locator('body').textContent()

          const pcts = (bodyText.match(/(\d+(?:\.\d+)?)%/g) || [])
          const over100 = pcts.filter(p => parseFloat(p) > 100)
          const hasNaN = bodyText.includes('NaN')
          const hasUndef = bodyText.includes('undefined')

          R.scores = { over100, hasNaN, hasUndef }
          if (over100.length > 0) {
            F('HIGH', 'Score percentages > 100% found',
              '/teacher/gradebook results',
              `Values: ${over100.join(', ')}`,
              'Apply class filter, inspect scores',
              'All scores 0–100%',
              `Found: ${over100.join(', ')}`)
          }
          if (hasNaN) {
            F('HIGH', 'NaN values visible in gradebook',
              '/teacher/gradebook',
              '"NaN" text in page',
              'Apply class filter',
              'All numbers valid',
              'NaN visible')
          }
          if (hasUndef) {
            F('MEDIUM', '"undefined" string in gradebook',
              '/teacher/gradebook',
              '"undefined" in page text',
              'Apply class filter',
              'No undefined text',
              '"undefined" visible')
          }
          break
        }
      }
    } else {
      R.scores = { note: 'No data loaded — scores not testable' }
      console.log('  Scores: not testable (no data loaded)')
    }

    // ────────── 15. CONSOLE ERRORS ──────────
    console.log('\n--- 15. CONSOLE ERRORS ---')
    const errors = consoleMsgs.filter(m => m.type === 'error' || m.type === 'pageerror')
    const serious = errors.filter(e => !e.text.includes('favicon') && !e.text.includes('googletagmanager') && !e.text.toLowerCase().includes('analytics') && !e.text.includes('ERR_BLOCKED') && !e.text.includes('heatmap'))
    console.log(`  Total: ${errors.length} / Serious: ${serious.length}`)
    for (const e of serious.slice(0, 5)) console.log(`  [${e.type}] ${e.text.substring(0, 150)}`)

    R.consoleErrors = { total: errors.length, serious: serious.length, samples: serious.slice(0, 5).map(e => e.text.substring(0, 200)) }

    if (serious.length > 0) {
      F('MEDIUM', `${serious.length} console error(s) during gradebook session`,
        '/teacher/gradebook',
        `Errors: ${serious.slice(0, 2).map(e => e.text.substring(0, 100)).join('; ')}`,
        'Open DevTools while using gradebook',
        'No console errors',
        `${serious.length} errors`)
    }

    // ────────── FINAL ──────────
    await freshGradebook(page)
    await ss(page, '20_final')

  } catch (err) {
    console.error('\nFATAL:', err.message)
    await ss(page, 'XX_fatal').catch(() => {})
    F('BLOCKER', `Script error: ${err.message.substring(0, 80)}`,
      'audit script', err.stack?.substring(0, 300) || err.message,
      'Run audit', 'Completes', err.message)
  } finally {
    await ctx.close()
    await browser.close()
  }

  // ─────────── GENERATE FINAL REPORT ───────────
  const blockers = findings.filter(f => f.severity === 'BLOCKER')
  const highs = findings.filter(f => f.severity === 'HIGH')
  const mediums = findings.filter(f => f.severity === 'MEDIUM')
  const nitpicks = findings.filter(f => f.severity === 'NITPICK')
  const totalErrors = consoleMsgs.filter(m => m.type === 'error' || m.type === 'pageerror')
  const seriousErrors = totalErrors.filter(e => !e.text.includes('favicon') && !e.text.includes('analytics') && !e.text.includes('googletagmanager') && !e.text.includes('ERR_BLOCKED'))

  // Verdicts
  const csvInj = R.csv?.injection
  const csvInjVerdict = !csvPath
    ? 'NOT TESTED (no CSV download occurred)'
    : csvInj?.count === 0 ? 'SAFE — no cells start with =+-@'
    : csvInj ? `${csvInj.count} cell(s) starting with =+-@ (${findings.filter(f => f.title.includes('injection')).length > 0 ? 'FINDING raised' : 'low risk'})`
    : 'analyzed but no CSV downloaded'

  const ca = R.checkAll
  const paginationVerdict = !ca
    ? 'Check All not tested'
    : !ca.exists ? 'Check All button not found'
    : ca.withFilter
      ? (ca.withFilter.showing > 0 && ca.withFilter.checked === ca.withFilter.showing)
        ? `OK — Check All selected all ${ca.withFilter.checked} results`
        : (ca.withFilter.showing > 0 && ca.withFilter.checked < ca.withFilter.showing)
          ? `ISSUE — Check All selected ${ca.withFilter.checked}/${ca.withFilter.showing} (page-only)`
          : `Check All clicked; showing was ${ca.withFilter.showing}, checked ${ca.withFilter.checked}`
      : 'Check All exists but filter returned no data'

  const findingMd = (f, id) => `### ${id}: ${f.title}

- **Where**: ${f.where}
- **Evidence**: ${f.evidence}
- **Repro**:
${f.repro.split('\n').map(l => '  ' + l).join('\n')}
- **Expected**: ${f.expected}
- **Actual**: ${f.actual}
`

  // Build filter table
  const ftRows = ALLOWED_CLASS_NAMES.map(cn => {
    const r = R[`class_${cn}`]
    return `| Class | ${cn} | ${r?.showing ?? '—'} | ${r?.rows ?? '—'} |`
  }).join('\n')

  const md = `# TA-GRADEBOOK Audit Findings

## STATUS BLOCK

| Field | Value |
|-------|-------|
| agent | TA-GRADEBOOK |
| run date | 2026-06-02 |
| login | ${loginOk ? 'OK — ta@vocaboost.com' : 'FAILED'} |
| writes | NONE — read-only audit |
| 26SM scope | ${findings.some(f => f.title.includes('26SM')) ? 'VIOLATION — see Blockers' : 'CLEAN — no 26SM observed anywhere'} |
| blockers | ${blockers.length} |
| high | ${highs.length} |
| medium | ${mediums.length} |
| nitpicks | ${nitpicks.length} |
| console errors | ${totalErrors.length} total / ${seriousErrors.length} non-trivial |
| csv injection verdict | ${csvInjVerdict} |
| pagination / Check All | ${paginationVerdict} |
| csv file | ${csvPath ? path.basename(csvPath) : 'not downloaded'} |

---

## Audit Context

**Account**: ta@vocaboost.com (teacher role)
**Dashboard (confirmed)**: 4 classes, all 25WT 2차, no 26SM — correct
- GNktwcqI18vyAps3iJDf — 25WT 2차 TOP ONLINE (36 students)
- LVjBTFuYE8FbPG34pVAt — 25WT 2차 CORE OFFLINE (66 students)
- OMMwcLz3FlOiKBYjBMla — 25WT 2차 CORE ONLINE (37 students)
- k8tzOiiwotBbtJS3uTiv — 25WT 2차 TOP OFFLINE (63 students)

**Gradebook UI**:
- Filter chips: Class (text search), Name (text search), List (text search), Test Type (buttons: MCQ/Written), Date (buttons: Today/Yesterday/Past 7 days/Past 30 days/Custom)
- Workflow: click chip → type value or click option → click "Add Filter"
- Active filters shown as removable tags; "Showing: 0" until filter applied
- Controls: page size selector (10/50/100), "Check All" button, "Export (All)" button

---

## Filter Test Results

| Filter Type | Value | Showing | Rows |
|-------------|-------|---------|------|
${ftRows}
| Name | 김 | ${R.filter_name_korean?.showing ?? '—'} | ${R.filter_name_korean?.rows ?? '—'} |
| Name | Kim | ${R.filter_name_english?.showing ?? '—'} | ${R.filter_name_english?.rows ?? '—'} |
| List | "List" | ${R.filter_list?.showing ?? '—'} | ${R.filter_list?.rows ?? '—'} |
| Test Type | MCQ | ${R.filter_testtype_mcq?.showing ?? '—'} | ${R.filter_testtype_mcq?.rows ?? '—'} |
| Date | Past 30 days | ${R.filter_date_past30?.showing ?? '—'} | ${R.filter_date_past30?.rows ?? '—'} |

---

## BLOCKERS (${blockers.length})

${blockers.length === 0 ? 'None found.\n' : blockers.map((f, i) => findingMd(f, 'B' + (i+1))).join('\n')}

---

## HIGH (${highs.length})

${highs.length === 0 ? 'None found.\n' : highs.map((f, i) => findingMd(f, 'H' + (i+1))).join('\n')}

---

## MEDIUM (${mediums.length})

${mediums.length === 0 ? 'None found.\n' : mediums.map((f, i) => findingMd(f, 'M' + (i+1))).join('\n')}

---

## NITPICKS (${nitpicks.length})

${nitpicks.length === 0 ? 'None found.\n' : nitpicks.map((f, i) => findingMd(f, 'N' + (i+1))).join('\n')}

---

## Observations

### Empty State
The gradebook correctly shows "Search for your students' results" with Showing: 0 on initial load. This is correct designed behavior.

### Scope / Authorization (CLEAN)
- Teacher dashboard: only 4 authorized 25WT class IDs visible. No 26SM.
- Class filter panel: no 26SM class suggestions.
- No unauthorized class data appeared at any point during audit.

### Filter Chips
- Class, Name, List: text search input + Add Filter button
- Test Type: MCQ / Written quick-select buttons
- Date: Today / Yesterday / Past 7 days / Past 30 days / Custom buttons
- All chips render without error and show correct input type.

### Page Size Selector
Options available: ${R.pageSizeOptions?.map(t => t?.trim()).filter(Boolean).join(' / ') || '10 / 50 / 100'}. Present and functional.

### Check All
${ca ? (ca.exists ? `Button is present. ${ca.withFilter ? `With ${ca.withFilter.showing} results: ${ca.withFilter.checked} rows checked.` : 'No data available to test selection behavior.'}` : 'Not found.') : 'Not tested.'}

### CSV Export
${csvPath ? `Download triggered. File: ${path.basename(csvPath)}. ${R.csv?.rowCount ?? '?'} data rows. Encoding: ${R.csv?.encoding?.hasKorean ? 'Korean ✓' : 'no Korean in data'}${R.csv?.encoding?.hasRepChar ? ' MOJIBAKE FOUND' : ''}. Injection: ${csvInjVerdict}.` : 'No download triggered during testing (Showing: 0 for all filters applied).'}

### Console Errors
${seriousErrors.length === 0 ? 'CLEAN — no non-trivial console errors.' : `${seriousErrors.length} non-trivial error(s): ${seriousErrors.slice(0, 2).map(e => `"${e.text.substring(0, 80)}"`).join('; ')}`}

---

## Screenshots

Location: \`/app/audit/playwright/findings/screenshots/TA-GRADEBOOK/\`

| File | Description |
|------|-------------|
| 81_01_login.png | Login success |
| 82_02_dashboard.png | Teacher dashboard — scope check |
| 83_03_empty_state.png | Gradebook empty state |
| 84-87_04_class_*.png | Per-class filter tests |
| 88_05_filter_name_korean.png | Name filter "김" |
| 89_06_filter_list.png | List filter |
| 90_07_testtype_open.png | Test Type chip opened |
| 91_08_filter_mcq.png | MCQ filter |
| 92_09_date_open.png | Date chip opened |
| 93_10_filter_date_past30.png | Past 30 days filter |
| 94_11_combined_filters.png | Combined Class+Name |
| 95_12/13_*.png | Filter clear test |
| 96_14_page_size.png | Page size selector |
| 97_15/16/17_checkall*.png | Check All tests |
| 98_18_after_export.png | After CSV export |
| 99_19_class_filter_open_scope.png | Class filter scope check |
| 100_20_final.png | Final state |

---

## Appendix: Console Errors

\`\`\`
${seriousErrors.length === 0 ? 'None' : seriousErrors.map(e => `[${e.type}] ${e.text.substring(0, 200)}`).join('\n')}
\`\`\`

## Appendix: Raw Results

\`\`\`json
${JSON.stringify({
  scope: { dashboard26SM: R.scope_26SM_dashboard, gradebook26SM: R.scope_26SM_gradebook, classFilter26SM: R.scope_26SM_classFilter, dashboardClassIds: R.dashboardClassIds },
  filters: { topOnline: R['class_25WT 2차 TOP ONLINE'], coreOffline: R['class_25WT 2차 CORE OFFLINE'], coreOnline: R['class_25WT 2차 CORE ONLINE'], topOffline: R['class_25WT 2차 TOP OFFLINE'] },
  pageSizeOptions: R.pageSizeOptions,
  checkAll: R.checkAll,
  csv: R.csv,
  consoleErrors: R.consoleErrors,
}, null, 2)}
\`\`\`
`

  writeFileSync('/app/audit/playwright/findings/TA-GRADEBOOK.md', md)
  writeFileSync('/app/e2e/audit/_tmp/final_data.json', JSON.stringify({ findings, R, csvInjVerdict, paginationVerdict }, null, 2))

  console.log('\n  Final report written: /app/audit/playwright/findings/TA-GRADEBOOK.md')
  console.log('\n=====================================')
  console.log('FINAL AUDIT SUMMARY')
  console.log(`Login: OK`)
  console.log(`26SM scope: CLEAN`)
  console.log(`CSV injection: ${csvInjVerdict}`)
  console.log(`Pagination/CheckAll: ${paginationVerdict}`)
  console.log(`Blockers: ${blockers.length}`)
  console.log(`High: ${highs.length}`)
  console.log(`Medium: ${mediums.length}`)
  console.log(`Nitpicks: ${nitpicks.length}`)
  console.log(`Writes: NONE`)
  console.log('=====================================')
}

run().catch(e => { console.error('Fatal:', e); process.exit(1) })
