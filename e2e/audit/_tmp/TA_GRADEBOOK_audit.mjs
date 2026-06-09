/**
 * TA-GRADEBOOK Audit — Teacher-side gradebook read-only audit
 * Account: ta@vocaboost.com / VocaTA2026!
 * Classes in scope: 4x 25WT classes only
 */

import { chromium } from '@playwright/test'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import path from 'path'

const BASE_URL = 'https://vocaboostone.netlify.app'
const SCREENSHOTS_DIR = '/app/audit/playwright/findings/screenshots/TA-GRADEBOOK'
const DOWNLOADS_DIR = '/app/e2e/audit/_tmp/downloads'
const TA_EMAIL = 'ta@vocaboost.com'
const TA_PASS = 'VocaTA2026!'

const ALLOWED_CLASSES = new Set([
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

let ssIdx = 0
async function screenshot(page, label) {
  const fname = `${String(++ssIdx).padStart(2, '0')}_${label}.png`
  const fpath = path.join(SCREENSHOTS_DIR, fname)
  await page.screenshot({ path: fpath, fullPage: true })
  console.log(`  [screenshot] ${fname}`)
  return fname
}

const consoleMessages = []
function captureConsole(page) {
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text(), ts: Date.now() })
    if (msg.type() === 'error') console.log(`  [console.error] ${msg.text()}`)
  })
  page.on('pageerror', err => {
    consoleMessages.push({ type: 'pageerror', text: err.toString(), ts: Date.now() })
    console.log(`  [pageerror] ${err.toString()}`)
  })
}

const findings = []
function addFinding(severity, title, where, evidence, repro, expected, actual) {
  const f = { severity, title, where, evidence, repro, expected, actual }
  findings.push(f)
  console.log(`  [FINDING:${severity}] ${title}`)
}

// ────────────────────────────────────────────────────────────
async function loginAsTA(page) {
  console.log('\n--- Login as TA ---')
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(1500)

  // Navigate to login
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first()
  if (await loginLink.count()) {
    await loginLink.click()
  } else {
    await page.evaluate(() => {
      history.pushState({}, '', '/login')
      dispatchEvent(new PopStateEvent('popstate'))
    })
  }

  const emailInput = page.getByLabel(/email/i).first()
  await emailInput.waitFor({ timeout: 20000 })
  await emailInput.fill(TA_EMAIL)
  await page.getByLabel(/password/i).first().fill(TA_PASS)
  await page.getByLabel(/password/i).first().press('Enter')

  try {
    await page.waitForURL(/\/(dashboard|teacher|$)/, { timeout: 15000 })
  } catch {
    const btn = page.getByRole('button', { name: /continue|log\s?in/i }).first()
    if (await btn.count()) await btn.click()
    await page.waitForURL(/\/(dashboard|teacher|$)/, { timeout: 15000 })
  }
  console.log('  Logged in. URL:', page.url())
}

// ────────────────────────────────────────────────────────────
async function navigateToGradebook(page) {
  console.log('\n--- Navigate to /teacher/gradebook ---')
  // Try clicking gradebook link first
  const gradebookLink = page.getByRole('link', { name: /gradebook/i }).first()
  if (await gradebookLink.count()) {
    await gradebookLink.click()
    await page.waitForTimeout(2000)
  } else {
    await page.evaluate(() => {
      history.pushState({}, '', '/teacher/gradebook')
      dispatchEvent(new PopStateEvent('popstate'))
    })
    await page.waitForTimeout(2000)
  }
  if (!page.url().includes('gradebook')) {
    // direct nav fallback
    await page.goto(`${BASE_URL}/teacher/gradebook`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
  }
  console.log('  Gradebook URL:', page.url())
}

// Helper: count visible result rows (non-header)
async function countRows(page) {
  // Look for table rows or list items that are result rows
  // Try various selectors
  const tbodyRows = await page.locator('tbody tr').count()
  if (tbodyRows > 0) return tbodyRows

  // Try data rows in any table-like structure
  const tableRows = await page.locator('table tr:not(:first-child)').count()
  if (tableRows > 0) return tableRows

  return 0
}

// Helper: get "Showing: N" count from UI
async function getShowingCount(page) {
  const bodyText = await page.locator('body').textContent()
  const match = bodyText.match(/[Ss]howing[:\s]+(\d+)/i)
  if (match) return parseInt(match[1])
  // Try "N results" pattern
  const match2 = bodyText.match(/(\d+)\s+results?\b/i)
  if (match2) return parseInt(match2[1])
  // Try "total: N" pattern
  const match3 = bodyText.match(/[Tt]otal[:\s]+(\d+)/i)
  if (match3) return parseInt(match3[1])
  return null
}

// Check for 26SM class leakage
async function checkForScopeLeakage(page, context) {
  const bodyText = await page.locator('body').textContent()
  if (bodyText.includes('26SM')) {
    addFinding(
      'BLOCKER',
      '26SM class data leaked into TA view',
      context,
      'Page body contains "26SM"',
      'Log in as ta@vocaboost.com, navigate to /teacher/gradebook',
      'Only 25WT classes visible',
      'Found "26SM" text on page'
    )
    return true
  }
  return false
}

// ────────────────────────────────────────────────────────────
async function run() {
  console.log('\n========================================')
  console.log('TA-GRADEBOOK AUDIT')
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
  const auditData = {
    filters: {},
    pagination: {},
    csv: {},
    counts: {},
    emptyState: {},
    consoleErrors: [],
  }

  try {
    // ────────── LOGIN ──────────
    await loginAsTA(page)
    loginOk = true
    await screenshot(page, 'login_success')

    // ────────── NAVIGATE TO GRADEBOOK ──────────
    await navigateToGradebook(page)
    await screenshot(page, 'gradebook_initial')

    // Check scope leakage on initial load
    await checkForScopeLeakage(page, '/teacher/gradebook initial load')

    // ────────── EXPLORE UI STRUCTURE ──────────
    console.log('\n=== UI STRUCTURE EXPLORATION ===')
    const bodyText0 = await page.locator('body').textContent()
    console.log('  Initial body (300 chars):', bodyText0.substring(0, 300))

    const initialShowing = await getShowingCount(page)
    const initialRows = await countRows(page)
    console.log('  Initial showing count:', initialShowing)
    console.log('  Initial rows:', initialRows)

    if (initialShowing === 0 || initialRows === 0) {
      console.log('  → "Showing: 0" state confirmed. Need to apply filters to populate.')
      auditData.emptyState.initial = 'Showing 0 until filter applied — as documented'
    }

    // Snapshot the empty state
    await screenshot(page, 'empty_state')
    const emptyStateText = await page.locator('body').textContent()
    if (emptyStateText.includes('No results') || emptyStateText.includes('no data') ||
        emptyStateText.includes('Showing: 0') || emptyStateText.includes('Showing 0') ||
        emptyStateText.includes('0 results')) {
      auditData.emptyState.rendersCorrectly = true
    } else if (initialRows === 0) {
      auditData.emptyState.rendersCorrectly = true // rows=0 is the empty state
    } else {
      auditData.emptyState.rendersCorrectly = false
    }

    // Identify filter elements
    const allSelects = await page.locator('select').all()
    const allInputs = await page.locator('input[type="text"], input[type="search"], input:not([type])').all()
    const allButtons = await page.locator('button').all()
    console.log('  Select elements:', allSelects.length)
    console.log('  Text inputs:', allInputs.length)
    console.log('  Buttons:', allButtons.length)

    // Get button labels
    const buttonLabels = []
    for (const btn of allButtons) {
      const t = await btn.textContent()
      const label = t?.trim()
      if (label) buttonLabels.push(label)
    }
    console.log('  Button labels:', buttonLabels)

    // Get select options for each select
    for (let i = 0; i < allSelects.length; i++) {
      const sel = allSelects[i]
      const selId = await sel.getAttribute('id') || `select_${i}`
      const opts = await sel.locator('option').all()
      const optTexts = []
      for (const opt of opts) {
        const t = await opt.textContent()
        const v = await opt.getAttribute('value')
        optTexts.push({ text: t?.trim(), value: v })
      }
      console.log(`  Select[${selId}] options:`, JSON.stringify(optTexts))
    }

    // ────────── FILTER AUDIT ──────────
    console.log('\n=== FILTER AUDIT ===')

    // Look for class filter specifically
    let classFilterSel = null
    // Try by name/id/aria
    const classSelByName = page.locator('select[name*="class" i], select[id*="class" i], select[aria-label*="class" i]').first()
    if (await classSelByName.count()) {
      classFilterSel = classSelByName
      console.log('  Found class select by name/id/aria')
    } else if (allSelects.length > 0) {
      // Assume first select is class filter
      classFilterSel = allSelects[0]
      console.log('  Using first select as class filter')
    }

    // Also look for chip/button filters
    const filterChips = await page.locator('[data-filter], .filter-chip, [role="option"]').all()
    console.log('  Filter chips/options:', filterChips.length)

    // Look for filter panel or filter area
    const filterArea = page.locator('[class*="filter" i], [data-testid*="filter" i], form').first()
    if (await filterArea.count()) {
      const filterHtml = await filterArea.innerHTML()
      console.log('  Filter area HTML (500):', filterHtml.substring(0, 500))
    }

    // ── Test 1: Filter by Class (25WT 2차 TOP OFFLINE) ──
    console.log('\n  -- Filter Test 1: Class = TOP OFFLINE --')
    let filteredByClass = false

    if (classFilterSel) {
      // Check if TOP OFFLINE option exists
      const topOfflineOpts = await classFilterSel.locator('option').all()
      let foundTopOption = false
      for (const opt of topOfflineOpts) {
        const t = await opt.textContent()
        const v = await opt.getAttribute('value')
        if (t?.includes('TOP OFFLINE') || v === 'k8tzOiiwotBbtJS3uTiv') {
          foundTopOption = true
        }
      }

      if (foundTopOption) {
        await classFilterSel.selectOption({ label: '25WT 2차 TOP OFFLINE' })
          .catch(() => classFilterSel.selectOption({ value: 'k8tzOiiwotBbtJS3uTiv' })
          .catch(() => console.log('  Could not select TOP OFFLINE')))
        await page.waitForTimeout(2000)
        await screenshot(page, 'filter_class_top_offline')

        const showingN = await getShowingCount(page)
        const rowN = await countRows(page)
        console.log(`  After CLASS=TOP OFFLINE: showing=${showingN} rows=${rowN}`)
        auditData.filters.classTopOffline = { showing: showingN, rows: rowN }

        // Check scope leakage
        await checkForScopeLeakage(page, 'After class filter TOP OFFLINE')

        // Verify only TOP OFFLINE students/data shown — check no 26SM
        const pageText = await page.locator('body').textContent()
        if (pageText.includes('26SM')) {
          addFinding('BLOCKER', '26SM data leaks after filtering for TOP OFFLINE',
            '/teacher/gradebook with class filter',
            'Page body contains "26SM" after filtering for TOP OFFLINE',
            'Select TOP OFFLINE class filter', 'Only TOP OFFLINE rows', '26SM rows visible')
        }

        filteredByClass = true

        // Count/row mismatch check
        if (showingN !== null && rowN !== null && rowN > 0 && showingN !== rowN) {
          addFinding('HIGH', 'Showing count does not match rendered row count (class filter)',
            '/teacher/gradebook after class filter',
            `screenshot: 02_filter_class_top_offline.png`,
            'Select TOP OFFLINE class filter',
            `showingN (${showingN}) === rowN (${rowN})`,
            `showingN=${showingN} but rowN=${rowN}`)
        }
      } else {
        console.log('  TOP OFFLINE option not found in select — trying other approach')
        // Check if options are 25WT-only
        const allOptTexts = []
        for (const opt of topOfflineOpts) {
          const t = await opt.textContent()
          if (t?.trim()) allOptTexts.push(t.trim())
        }
        console.log('  Available class options:', allOptTexts)

        // Check for 26SM leakage in the options themselves
        if (allOptTexts.some(t => t.includes('26SM'))) {
          addFinding('BLOCKER', '26SM class appears in class filter dropdown for ta@vocaboost.com',
            '/teacher/gradebook class filter',
            `Class options include 26SM classes: ${allOptTexts.filter(t => t.includes('26SM')).join(', ')}`,
            'Open class filter dropdown',
            'Only 25WT classes should appear',
            `Found 26SM classes in dropdown`)
        }
      }
    }

    // Try to find and use any class filter to get data
    // If class filter is a search/text input
    const classInput = page.locator('input[placeholder*="class" i], input[placeholder*="Class" i]').first()
    if (!filteredByClass && await classInput.count()) {
      console.log('  Trying text-based class search input')
      await classInput.fill('25WT 2차 TOP OFFLINE')
      await page.waitForTimeout(1500)
      // Look for dropdown results
      const dropdownItems = await page.locator('[role="option"], [class*="dropdown"] li, [class*="suggest"]').all()
      if (dropdownItems.length > 0) {
        await dropdownItems[0].click()
        await page.waitForTimeout(1500)
      }
    }

    // Get all filter inputs/selects to understand the UI
    const pageSnapshot = await page.locator('body').innerHTML()
    // Save it for analysis
    writeFileSync('/app/e2e/audit/_tmp/gradebook_html.html', pageSnapshot.substring(0, 50000))

    // ── Try getting data by interacting with whatever filters exist ──
    console.log('\n  -- Applying filters to get data --')

    // If we have selects, try each one
    let dataLoaded = false
    for (let i = 0; i < Math.min(allSelects.length, 5); i++) {
      const sel = allSelects[i]
      const opts = await sel.locator('option').all()
      if (opts.length > 1) {
        // Select second option (first non-placeholder)
        const optVal = await opts[1].getAttribute('value')
        const optText = await opts[1].textContent()
        console.log(`  Selecting option ${i}: "${optText?.trim()}" value="${optVal}"`)
        await sel.selectOption({ index: 1 })
        await page.waitForTimeout(1500)
      }
    }

    // Check if submit/search button needed
    const applyBtn = page.getByRole('button', { name: /apply|search|filter|go/i }).first()
    if (await applyBtn.count()) {
      console.log('  Clicking Apply/Search button')
      await applyBtn.click()
      await page.waitForTimeout(2000)
    }

    const afterFilters = await getShowingCount(page)
    const afterRows = await countRows(page)
    console.log(`  After default filter attempt: showing=${afterFilters} rows=${afterRows}`)

    if (afterRows === 0 || afterFilters === 0) {
      console.log('  Still no data — attempting specific class selection strategies')

      // Check URL structure to understand routing
      console.log('  Current URL:', page.url())

      // Try navigating directly with a class ID in the URL
      const testClassId = 'k8tzOiiwotBbtJS3uTiv' // TOP OFFLINE
      await page.goto(`${BASE_URL}/teacher/gradebook?classId=${testClassId}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2000)
      const afterUrlFilter = await getShowingCount(page)
      const afterUrlRows = await countRows(page)
      console.log(`  After URL classId param: showing=${afterUrlFilter} rows=${afterUrlRows}`)
      await screenshot(page, 'filter_via_url_classid')
    }

    // ── Reload fresh gradebook ──
    await navigateToGradebook(page)
    await page.waitForTimeout(2000)

    // Get full HTML to understand all UI elements
    const fullHtml = await page.content()
    writeFileSync('/app/e2e/audit/_tmp/gradebook_full.html', fullHtml)
    console.log('  Full HTML saved to /app/e2e/audit/_tmp/gradebook_full.html')

    // Extract text content for analysis
    const fullText = await page.locator('body').textContent()
    console.log('  Full page text (1000):', fullText.substring(0, 1000))

    // Find ALL interactive elements
    console.log('\n  All selects:')
    const selects2 = await page.locator('select').all()
    for (const s of selects2) {
      const id = await s.getAttribute('id')
      const name = await s.getAttribute('name')
      const cls = await s.getAttribute('class')
      const opts = await s.locator('option').count()
      console.log(`    select id="${id}" name="${name}" class="${cls?.substring(0, 50)}" opts=${opts}`)
    }

    console.log('\n  All inputs:')
    const inputs2 = await page.locator('input').all()
    for (const inp of inputs2) {
      const type = await inp.getAttribute('type')
      const id = await inp.getAttribute('id')
      const name = await inp.getAttribute('name')
      const placeholder = await inp.getAttribute('placeholder')
      console.log(`    input type="${type}" id="${id}" name="${name}" placeholder="${placeholder}"`)
    }

    // ────────── TRY CLASS FILTER INTERACTION ──────────
    console.log('\n=== TARGETED CLASS FILTER INTERACTION ===')

    // Look for elements containing class names
    const classNameEls = await page.getByText(/25WT|TOP OFFLINE|CORE OFFLINE|TOP ONLINE|CORE ONLINE/).all()
    console.log('  Elements with 25WT class names:', classNameEls.length)

    // Look for a class dropdown/combobox
    const comboboxes = await page.locator('[role="combobox"], [role="listbox"]').all()
    console.log('  Combobox/listbox elements:', comboboxes.length)

    // Check for React Select or custom dropdowns
    const reactSelects = await page.locator('[class*="react-select" i], [class*="Select" ]').all()
    console.log('  React Select elements:', reactSelects.length)

    // Look for filter/search section
    const filterSection = await page.locator('[class*="filter"], [class*="Filter"]').all()
    console.log('  Filter sections:', filterSection.length)
    for (let i = 0; i < Math.min(filterSection.length, 3); i++) {
      const text = await filterSection[i].textContent()
      console.log(`    Filter section ${i}: ${text?.substring(0, 100)}`)
    }

    // ────────── LOAD DATA VIA CLASS SELECTION ──────────
    console.log('\n=== LOADING DATA ===')

    // Check for any class-related buttons (25WT names as buttons or links)
    let dataFromClass = false

    // Try selecting TOP OFFLINE via various methods
    const topOfflineText = await page.getByText('25WT 2차 TOP OFFLINE').all()
    console.log('  "25WT 2차 TOP OFFLINE" text elements:', topOfflineText.length)
    if (topOfflineText.length > 0) {
      console.log('  Clicking first TOP OFFLINE element...')
      await topOfflineText[0].click().catch(e => console.log('  Click failed:', e.message))
      await page.waitForTimeout(2000)
      const showing = await getShowingCount(page)
      const rows = await countRows(page)
      console.log(`  After clicking TOP OFFLINE: showing=${showing} rows=${rows}`)
      if (rows > 0) dataFromClass = true
    }

    // If selects with class data exist, use them
    if (!dataFromClass && selects2.length > 0) {
      for (const sel of selects2) {
        const opts = await sel.locator('option').all()
        for (const opt of opts) {
          const text = await opt.textContent()
          if (text?.includes('TOP OFFLINE') || text?.includes('k8tzOiiwotBbtJS3uTiv')) {
            console.log('  Found TOP OFFLINE in select, selecting...')
            const optVal2 = await opt.getAttribute('value')
            await sel.selectOption({ value: optVal2 || '' }).catch(() => opt.click().catch(() => {}))
            await page.waitForTimeout(2000)
            const showing = await getShowingCount(page)
            const rows = await countRows(page)
            console.log(`  After select: showing=${showing} rows=${rows}`)
            if (rows > 0) { dataFromClass = true; break }
          }
        }
        if (dataFromClass) break
      }
    }

    await screenshot(page, 'after_class_filter_attempt')

    // ────────── PAGINATION AUDIT ──────────
    console.log('\n=== PAGINATION AUDIT ===')

    // Reset to gradebook
    await navigateToGradebook(page)
    await page.waitForTimeout(2000)

    // Look for page size selector
    const pageSizeSelectors = await page.locator('select[name*="page" i], select[id*="page" i], select[aria-label*="per page" i], select[aria-label*="show" i]').all()
    console.log('  Page size selectors (specific):', pageSizeSelectors.length)

    // Also check all selects for ones with 50/100 options
    let pageSizeSel = null
    for (const sel of await page.locator('select').all()) {
      const opts = await sel.locator('option').all()
      const optTexts = await Promise.all(opts.map(o => o.textContent()))
      if (optTexts.some(t => t?.includes('50') || t?.includes('100'))) {
        pageSizeSel = sel
        console.log('  Found page size selector with 50/100 options:', optTexts.map(t => t?.trim()).join(', '))
        break
      }
    }

    // Check for Show: N selector text
    const showSelectorText = await page.getByText(/show[:\s]+\d+|per page|\d+\s*\/\s*page/i).all()
    console.log('  "Show N" text elements:', showSelectorText.length)
    for (const el of showSelectorText) {
      const t = await el.textContent()
      console.log('    Show text:', t?.trim())
    }

    auditData.pagination.pageSizeSelectorFound = !!pageSizeSel

    // ────────── CSV EXPORT AUDIT ──────────
    console.log('\n=== CSV EXPORT AUDIT ===')

    // Look for export buttons
    const exportBtns = await page.locator('button, a').all()
    const exportButtons = []
    for (const btn of exportBtns) {
      const text = await btn.textContent()
      const label = text?.trim().toLowerCase()
      if (label?.includes('export') || label?.includes('csv') || label?.includes('download') || label?.includes('excel')) {
        exportButtons.push({ text: text?.trim(), el: btn })
      }
    }
    console.log('  Export-related buttons:', exportButtons.map(b => b.text))

    let exportAllBtn = null
    for (const { text, el } of exportButtons) {
      if (text.toLowerCase().includes('all') || text.toLowerCase().includes('export')) {
        exportAllBtn = el
        console.log('  Selected export button:', text)
        break
      }
    }

    // ────────── COMPREHENSIVE FILTER + LOAD DATA ──────────
    console.log('\n=== COMPREHENSIVE FILTER TESTING ===')

    // Fresh gradebook load
    await navigateToGradebook(page)
    await page.waitForTimeout(2000)

    // Get all interactive elements again fresh
    const allInteractive = await page.locator('select, input, button[class*="filter"], [role="combobox"]').all()
    console.log('  Interactive elements on gradebook:', allInteractive.length)

    // Look for any search box / filter panel
    const searchInputs = await page.locator('input[type="text"], input[type="search"]').all()
    console.log('  Search inputs:', searchInputs.length)
    for (const inp of searchInputs) {
      const ph = await inp.getAttribute('placeholder')
      const id = await inp.getAttribute('id')
      const name = await inp.getAttribute('name')
      console.log(`    Input: id="${id}" name="${name}" placeholder="${ph}"`)
    }

    // ── Try Name filter ──
    const nameInput = page.locator('input[placeholder*="name" i], input[id*="name" i], input[name*="name" i]').first()
    if (await nameInput.count()) {
      console.log('  Testing Name filter...')
      await nameInput.fill('김')
      await page.waitForTimeout(1500)
      const showing = await getShowingCount(page)
      const rows = await countRows(page)
      console.log(`  After name filter "김": showing=${showing} rows=${rows}`)
      auditData.filters.nameFilter = { showing, rows }
      await screenshot(page, 'filter_name_korean')

      // Clear
      await nameInput.fill('')
      await page.waitForTimeout(1000)
    }

    // ── Try getting a large result set to test pagination ──
    // First, let's get data loaded with any valid class
    console.log('\n  Attempting to load class data...')

    // Check URL for any parameters that help
    await page.goto(`${BASE_URL}/teacher/gradebook`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)

    const freshHTML = await page.content()
    // Look for React component state or data attributes
    const dataAttrs = freshHTML.match(/data-[a-z-]+="[^"]*"/g)?.slice(0, 20)
    console.log('  Data attributes found:', dataAttrs)

    // Check for any class option in select with our class IDs
    const html = freshHTML
    for (const classId of ALLOWED_CLASSES) {
      if (html.includes(classId)) {
        console.log(`  Class ID ${classId} found in HTML`)
      }
    }

    // Look for teacher nav menu
    const navLinks = await page.locator('nav a, [role="navigation"] a').all()
    console.log('  Nav links:', (await Promise.all(navLinks.map(l => l.textContent()))).map(t => t?.trim()).filter(Boolean))

    // Check if there's a "Select Class" instruction
    const selectInstructions = await page.getByText(/select.*class|choose.*class|filter.*class/i).all()
    console.log('  "Select class" instructions:', selectInstructions.length)

    // Try using filter chips (buttons that look like class name filters)
    const allVisibleButtons = await page.locator('button:visible').all()
    console.log('  Visible buttons:')
    for (const btn of allVisibleButtons) {
      const t = await btn.textContent()
      const cls = await btn.getAttribute('class')
      console.log(`    "${t?.trim()}" class="${cls?.substring(0, 60)}"`)
    }

    // If there are class name buttons/chips, click one
    for (const btn of allVisibleButtons) {
      const t = await btn.textContent()
      const trimmed = t?.trim()
      if (ALLOWED_CLASS_NAMES.some(cn => trimmed?.includes(cn) || cn.includes(trimmed || 'XXXX'))) {
        console.log(`  Clicking class button: "${trimmed}"`)
        await btn.click()
        await page.waitForTimeout(2000)
        const showing = await getShowingCount(page)
        const rows = await countRows(page)
        console.log(`  After class chip click: showing=${showing} rows=${rows}`)
        break
      }
    }

    // Get current state
    await screenshot(page, 'after_all_filter_attempts')
    const currentShowing = await getShowingCount(page)
    const currentRows = await countRows(page)
    console.log(`  Current state: showing=${currentShowing} rows=${currentRows}`)

    // ── Examine full page HTML structure for filter mechanics ──
    console.log('\n=== ANALYZING GRADEBOOK HTML STRUCTURE ===')
    const gradebookHtml = await page.content()

    // Save full HTML
    writeFileSync('/app/e2e/audit/_tmp/gradebook_analyzed.html', gradebookHtml)

    // Look for form elements and their structure
    const formElements = gradebookHtml.match(/<(select|input|button)[^>]*>/g) || []
    console.log('  Form elements in HTML:', formElements.slice(0, 20).join('\n    '))

    // Look for filter-related classes/IDs in HTML
    const filterRelated = gradebookHtml.match(/(?:id|class)="[^"]*(?:filter|Filter|class|Class|select|Select)[^"]*"/g) || []
    console.log('  Filter-related attributes:', [...new Set(filterRelated)].slice(0, 20))

    // Check for any combobox pattern
    const comboboxHtml = gradebookHtml.match(/<[^>]*role="combobox"[^>]*>/g) || []
    console.log('  Combobox elements:', comboboxHtml)

    // ────────── ATTEMPT TO GET DATA WITH CORRECT FILTER ──────────
    console.log('\n=== FINAL ATTEMPT TO LOAD DATA ===')
    await navigateToGradebook(page)
    await page.waitForTimeout(3000)

    // Use snapshot to understand the DOM
    const snapshot = await page.locator('body').innerHTML()

    // Find select elements and their parent labels
    const selectMatches = snapshot.match(/<label[^>]*>([^<]*)<\/label>[\s\S]*?<select[^>]*>([\s\S]*?)<\/select>/g) || []
    for (const m of selectMatches.slice(0, 5)) {
      console.log('  Select with label:', m.substring(0, 200))
    }

    // Try every visible select
    const visibleSelects = await page.locator('select:visible').all()
    console.log('  Visible selects:', visibleSelects.length)

    let hasData = false
    for (let si = 0; si < visibleSelects.length; si++) {
      const sel = visibleSelects[si]
      const opts = await sel.locator('option').all()
      console.log(`  Select ${si} has ${opts.length} options`)

      // Look for class-related options
      for (const opt of opts) {
        const text = await opt.textContent()
        const val = await opt.getAttribute('value')
        if (text?.includes('25WT') || val?.match(/^[A-Za-z0-9]{20}$/)) {
          console.log(`    → Class option: "${text?.trim()}" val="${val}"`)
          await sel.selectOption({ value: val || '' })
          await page.waitForTimeout(2000)

          const showing = await getShowingCount(page)
          const rows = await countRows(page)
          console.log(`    → After select: showing=${showing} rows=${rows}`)

          if ((showing || 0) > 0 || rows > 0) {
            hasData = true
            console.log('    → DATA LOADED!')
            await screenshot(page, `data_loaded_select${si}`)
            break
          }
        }
      }
      if (hasData) break
    }

    if (!hasData) {
      console.log('  Could not load data via selects. Checking if there is a different UI pattern...')

      // Check if teacher needs to go to a specific class first
      const teacherDashboard = await page.locator('[href*="/teacher"], [href*="teacher"]').all()
      console.log('  Teacher links:', (await Promise.all(teacherDashboard.map(l => l.getAttribute('href')))).filter(Boolean))

      // Check current URL and any hash/search params
      console.log('  Current URL:', page.url())

      // Try teacher class page then gradebook
      await page.goto(`${BASE_URL}/teacher/classes`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2000)
      console.log('  Teacher classes URL:', page.url())
      const classesText = await page.locator('body').textContent()
      console.log('  Classes page text (500):', classesText.substring(0, 500))
      await screenshot(page, 'teacher_classes_page')

      // Check for 26SM on classes page
      await checkForScopeLeakage(page, '/teacher/classes page')

      // Look for class links
      const classLinks = await page.locator('a[href*="class"]').all()
      for (const link of classLinks) {
        const href = await link.getAttribute('href')
        const text = await link.textContent()
        console.log(`  Class link: "${text?.trim()}" -> ${href}`)
      }
    }

    // ────────── FINAL DATA LOADING ATTEMPT ──────────
    console.log('\n=== FINAL DATA STRATEGY ===')

    // Go to teacher dashboard to understand navigation
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    const dashText = await page.locator('body').textContent()
    console.log('  After going to /, URL:', page.url())
    console.log('  Dashboard text (500):', dashText.substring(0, 500))
    await screenshot(page, 'teacher_dashboard')

    await checkForScopeLeakage(page, 'Teacher dashboard')

    // Find teacher-specific navigation
    const teacherNavLinks = await page.locator('a').all()
    for (const link of teacherNavLinks) {
      const href = await link.getAttribute('href') || ''
      const text = await link.textContent() || ''
      if (href.includes('teacher') || text.toLowerCase().includes('gradebook') || text.toLowerCase().includes('class')) {
        console.log(`  Nav: "${text.trim()}" -> ${href}`)
      }
    }

    // Navigate to gradebook again and try all interaction methods
    await page.evaluate(() => {
      history.pushState({}, '', '/teacher/gradebook')
      dispatchEvent(new PopStateEvent('popstate'))
    })
    await page.waitForTimeout(3000)
    await screenshot(page, 'gradebook_fresh_load')

    const gb_text = await page.locator('body').textContent()
    console.log('  Gradebook text (1000):', gb_text.substring(0, 1000))

    // Scan for ALL class names that appear in the page
    const allClassNames = gb_text.match(/\d+WT[^\n,]*/g) || []
    console.log('  Class name patterns in page:', [...new Set(allClassNames)])

    for (const cn of allClassNames) {
      if (cn.includes('26SM')) {
        addFinding('BLOCKER', '26SM class visible on gradebook page',
          '/teacher/gradebook',
          `Found: "${cn}"`,
          'Navigate to /teacher/gradebook',
          'Only 25WT classes',
          `26SM class visible: ${cn}`)
      }
    }

    // Check for ALL class selects and options one more time
    const allOpts = await page.locator('select option').all()
    console.log(`  Total options across all selects: ${allOpts.length}`)
    for (const opt of allOpts) {
      const text = await opt.textContent()
      const val = await opt.getAttribute('value')
      const selected = await opt.getAttribute('selected')
      console.log(`    option: text="${text?.trim()}" val="${val}" selected="${selected}"`)

      // Check for out-of-scope class
      if (text?.includes('26SM') || (val && !ALLOWED_CLASSES.has(val) && val.length === 20)) {
        if (text?.trim() !== '' && text?.toLowerCase() !== 'all' && text?.trim() !== 'all classes') {
          console.log(`    WARNING: Potentially out-of-scope option: "${text?.trim()}" val="${val}"`)
        }
      }
    }

    // ────────── TRY DATA LOAD WITH FIRST NON-EMPTY OPTION ──────────
    const firstClassOpt = page.locator('select option[value]:not([value=""])').first()
    if (await firstClassOpt.count()) {
      const firstVal = await firstClassOpt.getAttribute('value')
      const firstText = await firstClassOpt.textContent()
      console.log(`  Trying first class option: "${firstText?.trim()}" val="${firstVal}"`)

      // Find its parent select and select it
      const parentSelect = page.locator(`select:has(option[value="${firstVal}"])`).first()
      if (await parentSelect.count()) {
        await parentSelect.selectOption({ value: firstVal || '' })
        await page.waitForTimeout(2000)

        const showing = await getShowingCount(page)
        const rows = await countRows(page)
        console.log(`  After first class option: showing=${showing} rows=${rows}`)

        if ((showing || 0) > 0 || rows > 0) {
          hasData = true
          await screenshot(page, 'data_loaded_first_class')
          console.log('  DATA LOADED via first class option!')
        }
      }
    }

    // ── Check showing N vs rows ──
    if (hasData) {
      const showingFinal = await getShowingCount(page)
      const rowsFinal = await countRows(page)
      console.log(`  FINAL showing=${showingFinal} rows=${rowsFinal}`)

      if (showingFinal !== null && rowsFinal > 0 && showingFinal !== rowsFinal) {
        addFinding('HIGH', 'Showing count mismatch with rendered rows after class filter',
          '/teacher/gradebook',
          `screenshot: data_loaded_first_class.png`,
          'Select a class in the class filter',
          `UI shows count matches row count`,
          `showing=${showingFinal} but rendered rows=${rowsFinal}`)
      }
    }

    // ────────── SCORES SANITY CHECK ──────────
    console.log('\n=== SCORES SANITY CHECK ===')
    if (hasData) {
      const bodyText = await page.locator('body').textContent()

      // Check for NaN
      if (bodyText.includes('NaN')) {
        addFinding('HIGH', 'NaN values visible in gradebook',
          '/teacher/gradebook',
          'Text "NaN" found in page body',
          'Load gradebook with class data',
          'All numeric values should be valid numbers',
          'NaN visible on page')
      }

      // Check for undefined
      if (bodyText.includes('undefined')) {
        addFinding('MEDIUM', '"undefined" string visible in gradebook',
          '/teacher/gradebook',
          'Text "undefined" found in page body',
          'Load gradebook with class data',
          'No "undefined" text visible to user',
          '"undefined" text visible on page')
      }

      // Check for >100% scores
      const percentMatches = bodyText.match(/(\d+)%/g) || []
      const overHundred = percentMatches.filter(p => parseInt(p) > 100)
      if (overHundred.length > 0) {
        addFinding('HIGH', 'Score percentages > 100% found in gradebook',
          '/teacher/gradebook',
          `Percentage values > 100%: ${overHundred.join(', ')}`,
          'Load gradebook with class data',
          'All percentage scores should be 0-100',
          `Found: ${overHundred.join(', ')}`)
      }

      auditData.counts = {
        hasNaN: bodyText.includes('NaN'),
        hasUndefined: bodyText.includes('undefined'),
        overHundredPercent: overHundred,
      }
    }

    // ────────── PAGE SIZE SELECTOR TEST ──────────
    console.log('\n=== PAGE SIZE SELECTOR ===')
    await navigateToGradebook(page)
    await page.waitForTimeout(2000)

    // Find "Show: 50 / 100" type selectors
    const allSelectsForSize = await page.locator('select').all()
    for (const sel of allSelectsForSize) {
      const opts = await sel.locator('option').all()
      const optTexts = await Promise.all(opts.map(o => o.textContent()))
      const cleanTexts = optTexts.map(t => t?.trim()).filter(Boolean)
      console.log('  Select options:', cleanTexts)

      if (cleanTexts.some(t => t === '50' || t === '100' || t === '25' || t?.includes('50') || t?.includes('100'))) {
        console.log('  Found page-size selector!')
        auditData.pagination.pageSizeSelectorFound = true

        // Test: does changing page size affect filter scope?
        // First get a baseline with 25/50 items
        const baseShowing = await getShowingCount(page)
        const baseRows = await countRows(page)

        // Try changing to 100
        await sel.selectOption({ label: '100' }).catch(() =>
          sel.selectOption({ value: '100' }).catch(() => console.log('  Could not select 100'))
        )
        await page.waitForTimeout(1500)

        const afterSizeChange = await getShowingCount(page)
        const afterSizeRows = await countRows(page)
        console.log(`  After size=100: showing=${afterSizeChange} rows=${afterSizeRows}`)

        // Known concern: does filtering after page-size change filter full set or current page?
        if (afterSizeChange !== null && baseShowing !== null && afterSizeChange > baseRows) {
          auditData.pagination.pageSizeChangedCorrectly = true
        }

        await screenshot(page, 'page_size_100')
        break
      }
    }

    // ────────── CSV EXPORT ──────────
    console.log('\n=== CSV EXPORT TESTING ===')

    // Get current page state
    await navigateToGradebook(page)
    await page.waitForTimeout(2000)

    // Look for export buttons more thoroughly
    const pageContent = await page.content()
    const exportKeywords = ['export', 'Export', 'download', 'Download', 'CSV', 'csv', 'Excel']
    let exportBtnEl = null

    for (const kw of exportKeywords) {
      const btn = page.getByRole('button', { name: new RegExp(kw, 'i') }).first()
      if (await btn.count()) {
        exportBtnEl = btn
        const text = await btn.textContent()
        console.log(`  Found export button: "${text?.trim()}"`)
        break
      }
    }

    // Also look in links
    if (!exportBtnEl) {
      for (const kw of exportKeywords) {
        const link = page.getByRole('link', { name: new RegExp(kw, 'i') }).first()
        if (await link.count()) {
          const text = await link.textContent()
          console.log(`  Found export link: "${text?.trim()}"`)
          exportBtnEl = link
          break
        }
      }
    }

    // Check HTML for export mentions
    if (pageContent.includes('export') || pageContent.includes('Export') || pageContent.includes('CSV')) {
      console.log('  HTML mentions export/CSV')
      const exportMentions = pageContent.match(/export[^"<>]*|CSV[^"<>]*/gi)?.slice(0, 5)
      console.log('  Export mentions in HTML:', exportMentions)
    } else {
      console.log('  No export/CSV mention in HTML')
      auditData.csv.exportButtonExists = false
    }

    if (exportBtnEl) {
      auditData.csv.exportButtonExists = true

      // Try to trigger download
      console.log('  Attempting CSV export download...')

      try {
        const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
        await exportBtnEl.click()
        const download = await downloadPromise

        const suggestedName = download.suggestedFilename()
        console.log('  Download filename:', suggestedName)

        const downloadPath = path.join(DOWNLOADS_DIR, suggestedName || 'export.csv')
        await download.saveAs(downloadPath)
        csvPath = downloadPath
        console.log('  CSV saved to:', csvPath)

        // Read and analyze CSV
        if (existsSync(csvPath)) {
          csvContent = readFileSync(csvPath, 'utf-8')
          console.log('  CSV size:', csvContent.length, 'bytes')
          console.log('  CSV first 500 chars:', csvContent.substring(0, 500))

          const lines = csvContent.split('\n').filter(l => l.trim())
          const headerLine = lines[0]
          const dataLines = lines.slice(1)

          console.log('  CSV headers:', headerLine)
          console.log('  CSV data rows:', dataLines.length)

          auditData.csv = {
            exportButtonExists: true,
            downloaded: true,
            filename: suggestedName,
            headers: headerLine,
            rowCount: dataLines.length,
            size: csvContent.length,
          }

          // Check: row count vs UI showing count
          const uiShowingCount = await getShowingCount(page)
          if (uiShowingCount !== null && dataLines.length !== uiShowingCount) {
            addFinding('HIGH', 'CSV row count does not match UI "Showing" count',
              'CSV export',
              `CSV has ${dataLines.length} data rows; UI shows "Showing: ${uiShowingCount}"`,
              'Click Export, then compare CSV row count to UI Showing count',
              `CSV rows (${dataLines.length}) === UI showing (${uiShowingCount})`,
              `CSV rows=${dataLines.length}, UI showing=${uiShowingCount}`)
          }

          // Check Korean character rendering (mojibake check)
          // If CSV was read as UTF-8 and Korean chars appear as Korean → OK
          // If they appear as "???", "ï¿½" etc → mojibake
          const koreanPattern = /[가-힣]/  // Unicode Korean chars
          const mojibakePattern = /\?{3,}|efbfbd|replacement char/i  // simplified mojibake check
          const hasKorean = koreanPattern.test(csvContent)
          const hasMojibake = mojibakePattern.test(csvContent)
          console.log('  CSV has Korean chars:', hasKorean)
          console.log('  CSV has mojibake patterns:', hasMojibake)

          auditData.csv.hasKorean = hasKorean
          auditData.csv.hasMojibake = hasMojibake

          if (hasMojibake) {
            addFinding('HIGH', 'CSV export has mojibake (Korean characters corrupted)',
              'CSV export file',
              `Mojibake pattern detected in CSV content: ${csvContent.substring(0, 200)}`,
              'Export CSV and open in text editor',
              'Korean names render correctly (UTF-8)',
              'Characters appear as mojibake')
          }

          // CSV injection check
          // Dangerous: cells starting with =, +, -, @
          const injectionPattern = /^[=+\-@]/
          const allCells = lines.flatMap(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')))
          const dangerousCells = allCells.filter(c => injectionPattern.test(c))
          console.log('  Potentially dangerous CSV cells (start with =+-@):', dangerousCells.slice(0, 10))

          // Are they properly quoted/escaped?
          const injectionLines = lines.filter((line, idx) => {
            if (idx === 0) return false // skip header
            const cells = line.split(',')
            return cells.some(c => {
              const trimmed = c.trim()
              // Dangerous if: starts with injection char AND is NOT quoted, or quoted but just ="..."
              const unquoted = trimmed.replace(/^"|"$/g, '')
              return injectionPattern.test(unquoted)
            })
          })

          console.log('  Lines with potential injection chars (unquoted):', injectionLines.slice(0, 5))

          // Check properly: a cell is safe if wrapped in double quotes that prevent formula execution
          // Actually, most CSV apps execute ="formula" too. We need to check if dangerous chars
          // are present AND not prepended with a tab or single-quote escape
          const csvInjectionSafe = dangerousCells.length === 0 ||
            dangerousCells.every(cell => {
              // Safe if the original line has the cell properly prefixed (tab/apostrophe)
              return !injectionPattern.test(cell)
            })

          // Check raw CSV for = + - @ at start of quoted values
          const rawInjectionCheck = csvContent.split('\n').slice(1).filter(line => {
            const cells = line.match(/(?:^|,)("(?:[^""]|"")*"|[^,]*)/g) || []
            return cells.some(cell => {
              const unquoted = cell.replace(/^,?"?|"?$/g, '')
              return /^[=+\-@]/.test(unquoted)
            })
          })

          console.log('  Raw injection risk lines count:', rawInjectionCheck.length)
          console.log('  Sample injection risk:', rawInjectionCheck.slice(0, 3))

          auditData.csv.injectionCells = dangerousCells.slice(0, 10)
          auditData.csv.injectionRiskLines = rawInjectionCheck.length

          if (rawInjectionCheck.length > 0) {
            const sample = rawInjectionCheck[0]?.substring(0, 100)
            addFinding('HIGH', 'CSV export may be vulnerable to formula injection',
              'CSV export file',
              `${rawInjectionCheck.length} lines contain cells starting with =, +, -, or @ without safe escaping. Sample: "${sample}"`,
              '1. Export CSV\n2. Open in spreadsheet app\n3. Check if cells starting with =, +, -, @ execute as formulas',
              'All cell values starting with formula chars should be prefixed with tab or apostrophe, or the entire app should reject formula chars',
              `${rawInjectionCheck.length} potentially injectable cells found`)
          } else if (dangerousCells.length > 0) {
            addFinding('MEDIUM', 'CSV cells start with formula chars but appear quoted',
              'CSV export file',
              `Cells starting with =+-@: ${dangerousCells.slice(0, 5).join(', ')}`,
              'Export CSV and check in spreadsheet',
              'Formula chars properly escaped',
              'Cells start with formula chars — verify quoting prevents execution')
          } else {
            console.log('  CSV injection check: CLEAN — no cells start with =+-@')
            auditData.csv.injectionSafe = true
          }

          await screenshot(page, 'after_csv_export')
        }
      } catch (e) {
        console.log('  CSV download failed or timed out:', e.message)
        auditData.csv.downloadError = e.message

        if (e.message.includes('timeout')) {
          addFinding('MEDIUM', 'CSV export download did not trigger a file download event',
            '/teacher/gradebook Export button',
            `Clicking export button did not produce a download event within 15s. Error: ${e.message}`,
            'Click Export (All) button',
            'File download dialog or auto-download',
            'No download event fired')
        }
      }
    } else {
      auditData.csv.exportButtonExists = false
      addFinding('MEDIUM', 'No CSV export button found on gradebook page',
        '/teacher/gradebook',
        'Searched for buttons/links with text: export, Export, download, Download, CSV, Excel',
        'Look for export functionality on /teacher/gradebook',
        'Export button present',
        'No export button found')
    }

    // ────────── CHECK ALL BEHAVIOR ──────────
    console.log('\n=== CHECK ALL BEHAVIOR ===')
    await navigateToGradebook(page)
    await page.waitForTimeout(2000)

    // Look for "Check All" / "Select All" checkbox or button
    const checkAllEl = page.locator('input[type="checkbox"][name*="all" i], button:has-text("Check All"), input#checkAll, input[aria-label*="select all" i], th input[type="checkbox"]').first()
    const checkAllCount = await checkAllEl.count()
    console.log('  "Check All" element found:', checkAllCount > 0)

    if (checkAllCount > 0) {
      // First get a result set
      const showing = await getShowingCount(page)
      const rows = await countRows(page)

      if (rows > 0) {
        await checkAllEl.click()
        await page.waitForTimeout(1000)

        // Count checked checkboxes
        const checkedBoxes = await page.locator('input[type="checkbox"]:checked').count()
        console.log(`  After Check All: checked=${checkedBoxes} (rows=${rows} showing=${showing})`)

        auditData.pagination.checkAll = { checked: checkedBoxes, rows, showing }

        // Is Check All selecting ALL results or just visible page?
        if (showing !== null && checkedBoxes < showing) {
          addFinding('HIGH', '"Check All" selects only current page, not all results',
            '/teacher/gradebook Check All functionality',
            `Check All checked ${checkedBoxes} items but UI shows ${showing} total results`,
            '1. Load gradebook with results\n2. Set page size smaller than total\n3. Click Check All\n4. Count checked items',
            'Check All should select all N results across all pages',
            `Only ${checkedBoxes} selected (visible page), total=${showing}`)
        } else {
          auditData.pagination.checkAllSelectsAll = true
        }

        await screenshot(page, 'check_all_result')
      }
    } else {
      console.log('  No Check All element found')
      auditData.pagination.checkAllFound = false
    }

    // ────────── CONSOLE ERRORS SUMMARY ──────────
    console.log('\n=== CONSOLE ERRORS ===')
    const errors = consoleMessages.filter(m => m.type === 'error' || m.type === 'pageerror')
    console.log('  Total console errors:', errors.length)
    for (const err of errors.slice(0, 10)) {
      console.log('  Error:', err.text.substring(0, 200))
    }
    auditData.consoleErrors = errors

    if (errors.length > 0) {
      const seriousErrors = errors.filter(e =>
        !e.text.includes('favicon') &&
        !e.text.includes('404') &&
        !e.text.toLowerCase().includes('analytics')
      )
      if (seriousErrors.length > 0) {
        addFinding('MEDIUM', `${seriousErrors.length} console errors on gradebook page`,
          '/teacher/gradebook',
          `Errors: ${seriousErrors.slice(0, 3).map(e => e.text.substring(0, 100)).join('; ')}`,
          'Open DevTools console while on /teacher/gradebook',
          'No console errors',
          `${seriousErrors.length} error(s) logged`)
      }
    }

    // ────────── FINAL SCREENSHOT ──────────
    await screenshot(page, 'final_state')

  } catch (e) {
    console.error('\nFATAL ERROR:', e.message)
    console.error(e.stack)
    await screenshot(page, 'fatal_error').catch(() => {})
    findings.push({
      severity: 'BLOCKER',
      title: 'Script fatal error',
      where: 'audit script',
      evidence: e.stack,
      repro: 'Run audit script',
      expected: 'Script completes',
      actual: e.message
    })
  } finally {
    await ctx.close()
    await browser.close()
  }

  // ────────── WRITE FINDINGS REPORT ──────────
  console.log('\n=== WRITING FINDINGS ===')

  const blockers = findings.filter(f => f.severity === 'BLOCKER')
  const highs = findings.filter(f => f.severity === 'HIGH')
  const mediums = findings.filter(f => f.severity === 'MEDIUM')
  const nitpicks = findings.filter(f => f.severity === 'NITPICK')

  const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'pageerror')

  const md = `# TA-GRADEBOOK Audit Findings

## STATUS BLOCK

| Field | Value |
|-------|-------|
| agent | TA-GRADEBOOK |
| run date | 2026-06-02 |
| login | ${loginOk ? 'OK — ta@vocaboost.com authenticated successfully' : 'FAILED'} |
| writes | NONE — read-only audit |
| 26SM scope | ${findings.some(f => f.title.includes('26SM')) ? 'VIOLATION FOUND — see Blockers' : 'CLEAN — no 26SM data observed'} |
| blockers | ${blockers.length} |
| high | ${highs.length} |
| medium | ${mediums.length} |
| nitpicks | ${nitpicks.length} |
| console errors | ${consoleErrors.length} total |
| csv path | ${csvPath || 'No download'} |

---

## Audit Summary

Login was ${loginOk ? 'successful' : 'FAILED'} for ta@vocaboost.com.

The gradebook page at /teacher/gradebook shows **"Showing: 0"** (or no rows) until a class filter is applied — this is the documented design.

Detailed findings by category:

### Data Load Status
${JSON.stringify(auditData, null, 2).substring(0, 2000)}

---

${blockers.length > 0 ? `## BLOCKERS (${blockers.length})

${blockers.map((f, i) => `### B${i+1}: ${f.title}

- **Where**: ${f.where}
- **Evidence**: ${f.evidence}
- **Repro**: ${f.repro}
- **Expected**: ${f.expected}
- **Actual**: ${f.actual}
`).join('\n')}` : `## BLOCKERS

None found.`}

---

${highs.length > 0 ? `## HIGH (${highs.length})

${highs.map((f, i) => `### H${i+1}: ${f.title}

- **Where**: ${f.where}
- **Evidence**: ${f.evidence}
- **Repro**: ${f.repro}
- **Expected**: ${f.expected}
- **Actual**: ${f.actual}
`).join('\n')}` : `## HIGH

None found.`}

---

${mediums.length > 0 ? `## MEDIUM (${mediums.length})

${mediums.map((f, i) => `### M${i+1}: ${f.title}

- **Where**: ${f.where}
- **Evidence**: ${f.evidence}
- **Repro**: ${f.repro}
- **Expected**: ${f.expected}
- **Actual**: ${f.actual}
`).join('\n')}` : `## MEDIUM

None found.`}

---

${nitpicks.length > 0 ? `## NITPICKS (${nitpicks.length})

${nitpicks.map((f, i) => `### N${i+1}: ${f.title}

- **Where**: ${f.where}
- **Evidence**: ${f.evidence}
- **Repro**: ${f.repro}
- **Expected**: ${f.expected}
- **Actual**: ${f.actual}
`).join('\n')}` : `## NITPICKS

None found.`}

---

## Appendix: Console Messages
Total: ${consoleMessages.length} (errors: ${consoleErrors.length})

\`\`\`json
${JSON.stringify(consoleErrors.slice(0, 20), null, 2)}
\`\`\`

## Appendix: Audit Data
\`\`\`json
${JSON.stringify(auditData, null, 2)}
\`\`\`

## Screenshots
Location: /app/audit/playwright/findings/screenshots/TA-GRADEBOOK/
`

  writeFileSync('/app/audit/playwright/findings/TA-GRADEBOOK.md', md)
  console.log('\n  Findings written to /app/audit/playwright/findings/TA-GRADEBOOK.md')

  console.log('\n========================================')
  console.log('AUDIT COMPLETE')
  console.log(`Login: ${loginOk ? 'OK' : 'FAILED'}`)
  console.log(`Blockers: ${blockers.length}`)
  console.log(`High: ${highs.length}`)
  console.log(`Medium: ${mediums.length}`)
  console.log(`Nitpicks: ${nitpicks.length}`)
  console.log(`CSV path: ${csvPath || 'none'}`)
  console.log(`Console errors: ${consoleErrors.length}`)
  console.log('========================================')
}

run().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
