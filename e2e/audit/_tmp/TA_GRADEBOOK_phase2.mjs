/**
 * TA-GRADEBOOK Phase 2 — Targeted filter interaction & comprehensive audit
 * Now that we know the UI structure:
 *   - Filter chips are buttons: Class, Name, List, Test Type, Date
 *   - Clicking "Class" shows a "Search by class..." input
 *   - Need to type class name → select from dropdown
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

let ssIdx = 20  // Start at 20 to avoid overwriting phase 1 screenshots
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

async function loginAsTA(page) {
  console.log('\n--- Login as TA ---')
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(1500)

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

async function goToGradebook(page) {
  await page.evaluate(() => {
    history.pushState({}, '', '/teacher/gradebook')
    dispatchEvent(new PopStateEvent('popstate'))
  })
  await page.waitForTimeout(2500)
  // Verify we're on gradebook
  const text = await page.locator('body').textContent()
  if (!text.includes('Gradebook') && !text.includes('gradebook')) {
    await page.goto(`${BASE_URL}/teacher/gradebook`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
  }
  console.log('  On gradebook. URL:', page.url())
}

async function getShowingCount(page) {
  const bodyText = await page.locator('body').textContent()
  const match = bodyText.match(/[Ss]howing[:\s]+(\d+)/i)
  if (match) return parseInt(match[1])
  return null
}

async function countRows(page) {
  // Count tbody rows
  const tbodyRows = await page.locator('tbody tr').count()
  if (tbodyRows > 0) return tbodyRows
  // Count table rows excluding header
  const tableRows = await page.locator('table tr').count()
  if (tableRows > 1) return tableRows - 1  // subtract header
  return 0
}

// Apply class filter using the chip UI
async function applyClassFilter(page, className) {
  console.log(`\n  Applying class filter: "${className}"`)

  // Click the "Class" filter chip button
  const classChip = page.getByRole('button', { name: /^Class$/i })
  if (!(await classChip.count())) {
    console.log('  ERROR: Class filter chip not found')
    return false
  }
  await classChip.click()
  await page.waitForTimeout(800)

  // A "Search by class..." input should appear
  const classSearchInput = page.locator('input[placeholder*="class" i]').first()
  await classSearchInput.waitFor({ timeout: 5000 }).catch(() => {})

  if (!(await classSearchInput.count())) {
    console.log('  ERROR: Class search input did not appear')
    return false
  }

  // Type the class name
  await classSearchInput.fill(className)
  await page.waitForTimeout(1000)

  await screenshot(page, `class_filter_typing_${className.replace(/\s/g, '_').substring(0, 20)}`)

  // Look for dropdown suggestions
  const suggestions = await page.locator('[role="option"], [role="listitem"], ul li, .dropdown-item').all()
  console.log(`  Suggestions found: ${suggestions.length}`)

  if (suggestions.length > 0) {
    for (const s of suggestions) {
      const t = await s.textContent()
      console.log(`    Suggestion: "${t?.trim()}"`)
      if (t?.includes(className) || t?.includes('25WT')) {
        console.log('  Clicking matching suggestion')
        await s.click()
        await page.waitForTimeout(1500)
        return true
      }
    }
    // Click first if no exact match
    console.log('  Clicking first suggestion')
    await suggestions[0].click()
    await page.waitForTimeout(1500)
    return true
  }

  // Try pressing Enter to apply
  await classSearchInput.press('Enter')
  await page.waitForTimeout(1500)

  return true
}

// Remove active filters by clicking X on active filter tags
async function clearFilters(page) {
  // Look for X buttons on active filter chips
  const removeBtns = await page.locator('button[aria-label*="remove" i], button:has-text("×"), [data-filter-remove]').all()
  for (const btn of removeBtns) {
    await btn.click()
    await page.waitForTimeout(300)
  }

  // Alternative: look for a "Clear all" or "Reset" button
  const clearBtn = page.getByRole('button', { name: /clear|reset/i }).first()
  if (await clearBtn.count()) {
    await clearBtn.click()
    await page.waitForTimeout(500)
  }
}

async function run() {
  console.log('\n========================================')
  console.log('TA-GRADEBOOK Phase 2 — Targeted Audit')
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
    scopeCheck: {},
  }

  try {
    // ────────── LOGIN ──────────
    await loginAsTA(page)
    loginOk = true

    // ────────── GO TO GRADEBOOK ──────────
    await goToGradebook(page)
    await screenshot(page, 'gradebook_start')

    // ────────── EMPTY STATE CHECK ──────────
    console.log('\n=== EMPTY STATE CHECK ===')
    const emptyText = await page.locator('body').textContent()
    const showing0 = await getShowingCount(page)
    console.log('  Showing count on load:', showing0)
    console.log('  Page contains empty state message:', emptyText.includes('Search for your students') || emptyText.includes('no results'))
    auditData.emptyState = {
      showingOnLoad: showing0,
      hasEmptyMessage: emptyText.includes('Search for your students') || emptyText.includes('no results') || emptyText.includes('No results'),
    }

    // ────────── FILTER INTERACTION - UNDERSTAND CHIP UI ──────────
    console.log('\n=== FILTER CHIP UI INTERACTION ===')

    // Describe chip buttons
    const chipButtons = await page.locator('button').all()
    console.log('  All buttons before Class click:')
    for (const btn of chipButtons) {
      const t = await btn.textContent()
      console.log(`    "${t?.trim()}"`)
    }

    // ── Click Class filter ──
    console.log('\n  -- Clicking "Class" chip --')
    await page.getByRole('button', { name: /^Class$/i }).click()
    await page.waitForTimeout(1000)
    await screenshot(page, 'class_chip_clicked')

    // Describe UI after click
    const afterClassClick = await page.locator('body').innerHTML()
    console.log('  HTML after Class click (2000):', afterClassClick.substring(0, 2000))

    // Find all inputs after click
    const inputsAfter = await page.locator('input').all()
    for (const inp of inputsAfter) {
      const ph = await inp.getAttribute('placeholder')
      const t = await inp.getAttribute('type')
      const val = await inp.evaluate(el => el.value)
      console.log(`  Input: type="${t}" placeholder="${ph}" value="${val}"`)
    }

    // Find dropdown/suggestions
    const allAfterClick = await page.locator('body').textContent()
    console.log('  Page text after Class click (500):', allAfterClick.substring(0, 500))

    // Check if class names appear as suggestions immediately
    for (const cn of ALLOWED_CLASS_NAMES) {
      if (allAfterClick.includes(cn)) {
        console.log(`  Found class name suggestion: ${cn}`)
      }
    }

    // Try typing in the search input
    const searchInput = page.locator('input[placeholder*="class" i], input[placeholder*="Class" i]').first()
    if (await searchInput.count()) {
      console.log('  Found class search input, typing "25WT"...')
      await searchInput.fill('25WT')
      await page.waitForTimeout(1000)
      await screenshot(page, 'class_search_typed_25WT')

      const afterType = await page.locator('body').textContent()
      console.log('  After typing "25WT" (500):', afterType.substring(0, 500))

      // Check for suggestions/dropdown
      const suggestions = await page.locator('li, [role="option"], [role="listitem"]').all()
      console.log('  Suggestions/list items:', suggestions.length)
      for (const s of suggestions) {
        const t = await s.textContent()
        if (t?.includes('25WT') || t?.includes('TOP') || t?.includes('CORE')) {
          console.log(`  → Class suggestion: "${t?.trim()}"`)
        }
      }

      // Try clicking first class suggestion
      let classSelected = false
      for (const s of suggestions) {
        const t = await s.textContent()
        if (t?.includes('25WT') || t?.includes('TOP OFFLINE')) {
          console.log(`  Clicking suggestion: "${t?.trim()}"`)
          await s.click()
          await page.waitForTimeout(2000)
          classSelected = true
          break
        }
      }

      if (!classSelected) {
        // Try pressing Enter
        await searchInput.press('Enter')
        await page.waitForTimeout(2000)
      }

      await screenshot(page, 'after_class_selection')
      const showing = await getShowingCount(page)
      const rows = await countRows(page)
      console.log(`  After class selection: showing=${showing} rows=${rows}`)

      if ((showing || 0) > 0 || rows > 0) {
        console.log('  CLASS FILTER WORKING — data loaded!')
        auditData.filters.classFilterWorks = true
        auditData.filters.initialClassLoad = { showing, rows }
      }
    }

    // Get full page HTML to understand the class filter dropdown behavior
    const currentHtml = await page.content()
    writeFileSync('/app/e2e/audit/_tmp/gradebook_after_class_click.html', currentHtml)

    // ────────── RELOAD AND TRY DIFFERENT APPROACH ──────────
    await goToGradebook(page)
    await page.waitForTimeout(1000)

    console.log('\n=== TRYING ALL CLASS NAME FILTER APPROACHES ===')

    // The UI has a "Class" chip button that when clicked shows a search input
    // Let's try clicking "Class" and then looking at what loads/shows in the dropdown

    // Approach: click Class, wait for input, type partial name, look for any result element
    const classBtn = page.getByRole('button', { name: 'Class' }).first()
    await classBtn.click()
    await page.waitForTimeout(500)

    const classInput = page.locator('input').first()
    await classInput.waitFor({ timeout: 5000 }).catch(() => {})

    if (await classInput.count()) {
      // Try each allowed class name
      for (const cn of ALLOWED_CLASS_NAMES) {
        console.log(`\n  Trying class: ${cn}`)
        await classInput.fill('')
        await page.waitForTimeout(200)
        await classInput.fill(cn)
        await page.waitForTimeout(1200)

        // Look for clickable results
        const clickableItems = await page.locator('li, [role="option"]').all()
        const divResults = await page.locator('div[class*="result"], div[class*="item"], div[class*="option"]').all()
        console.log(`  clickable items: ${clickableItems.length}, div results: ${divResults.length}`)

        // Check if class name appears in page
        const pageText = await page.locator('body').textContent()
        if (pageText.includes(cn)) {
          console.log(`  "${cn}" appears in page after typing`)

          // Find and click it
          const target = page.getByText(cn, { exact: true }).first()
          if (await target.count()) {
            const tagName = await target.evaluate(el => el.tagName)
            console.log(`  Target element: ${tagName}`)
            // Only click if it's a clickable element (li, button, div with click)
            await target.click({ force: true }).catch(e => console.log(`  Click failed: ${e.message}`))
            await page.waitForTimeout(2000)

            const showing = await getShowingCount(page)
            const rows = await countRows(page)
            console.log(`  After selecting "${cn}": showing=${showing} rows=${rows}`)

            if ((showing || 0) > 0 || rows > 0) {
              console.log(`  SUCCESS! Got data with class: ${cn}`)
              auditData.filters.classFilterWorks = true
              auditData.filters.workingClass = cn
              auditData.filters.workingClassCount = { showing, rows }
              break
            }
          }
        } else {
          // The class name wasn't found — no matches
          console.log(`  "${cn}" NOT in page after typing — class filter may work differently`)
        }
      }
    }

    await screenshot(page, 'filter_class_attempts_done')

    // ────────── TRY PRESSING ENTER ON CLASS SEARCH ──────────
    await goToGradebook(page)
    await page.waitForTimeout(1000)

    console.log('\n=== PRESSING ENTER ON CLASS SEARCH ===')
    const classBtn2 = page.getByRole('button', { name: 'Class' }).first()
    await classBtn2.click()
    await page.waitForTimeout(500)

    const classInput2 = page.locator('input').first()
    if (await classInput2.count()) {
      await classInput2.fill('TOP OFFLINE')
      await page.waitForTimeout(500)
      await screenshot(page, 'class_search_top_offline')

      // Full HTML to see what's rendered
      const html2 = await page.content()
      writeFileSync('/app/e2e/audit/_tmp/class_search_html.html', html2)

      // Parse for dropdown items
      const dropdownMatch = html2.match(/<li[^>]*>([^<]*(?:25WT|TOP|CORE)[^<]*)<\/li>/gi) || []
      console.log('  Dropdown li items with class names:', dropdownMatch.slice(0, 5))

      // Check for any element with class names
      const classNameEls = await page.getByText(/25WT|TOP OFFLINE|CORE OFFLINE/).all()
      console.log('  Elements with class names after search:', classNameEls.length)

      for (const el of classNameEls) {
        const t = await el.textContent()
        const tagName = await el.evaluate(e => e.tagName)
        const role = await el.getAttribute('role')
        console.log(`  Class el: "${t?.trim()}" tag=${tagName} role=${role}`)
        if (tagName !== 'INPUT') {
          await el.click({ force: true }).catch(e => console.log(`  Click: ${e.message}`))
          await page.waitForTimeout(2000)
          const showing = await getShowingCount(page)
          const rows = await countRows(page)
          console.log(`  After click: showing=${showing} rows=${rows}`)
          if ((showing || 0) > 0 || rows > 0) {
            auditData.filters.classFilterWorks = true
            console.log('  DATA LOADED!')
            break
          }
        }
      }
    }

    // ────────── GET DATA STATE FOR PAGINATION/EXPORT TESTS ──────────
    console.log('\n=== CHECKING CURRENT DATA STATE ===')
    const currentShowing = await getShowingCount(page)
    const currentRows = await countRows(page)
    console.log(`  Current: showing=${currentShowing} rows=${currentRows}`)
    await screenshot(page, 'current_data_state')

    // ────────── DEEP HTML ANALYSIS OF CLASS FILTER ──────────
    console.log('\n=== DEEP HTML ANALYSIS ===')
    const deepHtml = await page.content()

    // Find all list items
    const liElements = deepHtml.match(/<li[^>]*>[\s\S]*?<\/li>/g) || []
    console.log('  List items in DOM:', liElements.length)
    for (const li of liElements.slice(0, 10)) {
      console.log('  LI:', li.substring(0, 200))
    }

    // Find dropdowns/overlays
    const divOverlays = deepHtml.match(/<div[^>]*(?:dropdown|overlay|popup|modal|suggest)[^>]*>[\s\S]*?<\/div>/gi) || []
    console.log('  Overlay/dropdown divs:', divOverlays.length)

    // Extract all text nodes
    const allText2 = await page.locator('body').textContent()
    console.log('  Page text (800):', allText2.substring(0, 800))

    // ────────── RESET AND TRY CLICKING WITH KEYBOARD ──────────
    await goToGradebook(page)
    await page.waitForTimeout(1000)

    console.log('\n=== KEYBOARD-DRIVEN CLASS FILTER ===')
    const classBtn3 = page.getByRole('button', { name: 'Class' }).first()
    await classBtn3.click()
    await page.waitForTimeout(800)

    // Screenshot the state immediately after clicking Class
    await screenshot(page, 'class_btn_clicked_fresh')
    const htmlAfterClassClick = await page.content()
    writeFileSync('/app/e2e/audit/_tmp/after_class_btn_click.html', htmlAfterClassClick)
    console.log('  HTML after Class btn click saved')

    // Find visible input
    const visibleInput = page.locator('input:visible').first()
    if (await visibleInput.count()) {
      const ph = await visibleInput.getAttribute('placeholder')
      console.log(`  Visible input: placeholder="${ph}"`)

      // Type '2' and wait for suggestions
      await visibleInput.pressSequentially('2', { delay: 50 })
      await page.waitForTimeout(500)
      await visibleInput.pressSequentially('5', { delay: 50 })
      await page.waitForTimeout(500)
      await visibleInput.pressSequentially('W', { delay: 50 })
      await page.waitForTimeout(500)
      await visibleInput.pressSequentially('T', { delay: 50 })
      await page.waitForTimeout(1000)

      await screenshot(page, 'class_typed_25WT_slow')
      const htmlAfterTyping = await page.content()
      writeFileSync('/app/e2e/audit/_tmp/after_typing_25WT.html', htmlAfterTyping)

      // Get all text
      const allTextNow = await page.locator('body').textContent()
      console.log('  Page text after typing 25WT (800):', allTextNow.substring(0, 800))

      // Look for any dropdown list
      const allLiNow = await page.locator('li').all()
      console.log('  Li elements now:', allLiNow.length)
      for (const li of allLiNow) {
        const t = await li.textContent()
        console.log(`  LI: "${t?.trim()}"`)
      }

      // Look for any div that appeared recently
      const allDivs = await page.locator('div').count()
      console.log('  Total divs:', allDivs)

      // Look for anything with class names
      const classNameMatch = allTextNow.match(/25WT[^\n]*/g) || []
      console.log('  25WT text in page:', classNameMatch)
    }

    // ────────── STRATEGY: try direct URL navigation with state ──────────
    console.log('\n=== STRATEGY: Check if class filter has URL state ===')
    // Try navigating with query params
    const testUrls = [
      `${BASE_URL}/teacher/gradebook?class=k8tzOiiwotBbtJS3uTiv`,
      `${BASE_URL}/teacher/gradebook?classId=k8tzOiiwotBbtJS3uTiv`,
      `${BASE_URL}/teacher/gradebook?filter=class&value=k8tzOiiwotBbtJS3uTiv`,
    ]
    for (const url of testUrls) {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(2000)
      const showing = await getShowingCount(page)
      const rows = await countRows(page)
      console.log(`  URL "${url}" → showing=${showing} rows=${rows}`)
      if ((showing || 0) > 0 || rows > 0) {
        console.log('  DATA LOADED via URL param!')
        auditData.filters.classFilterWorks = true
        break
      }
    }

    // ────────── GET FRESH HTML WITH CLASS SEARCH OPEN ──────────
    console.log('\n=== FRESH CLASS SEARCH STATE ===')
    await goToGradebook(page)
    await page.waitForTimeout(1000)

    // Click Class filter
    await page.getByRole('button', { name: 'Class' }).click()
    await page.waitForTimeout(600)

    const freshSearchHtml = await page.content()
    // Find the search panel area
    const searchPanelMatch = freshSearchHtml.match(/Search by class[\s\S]{0,2000}/i)
    if (searchPanelMatch) {
      console.log('  Search panel context:', searchPanelMatch[0].substring(0, 500))
    }

    // Find ALL list items
    const liAll = await page.locator('li').all()
    console.log('  LI count after Class click (no typing):', liAll.length)
    for (const li of liAll) {
      const t = await li.textContent()
      const cls = await li.getAttribute('class')
      const role = await li.getAttribute('role')
      console.log(`  LI: "${t?.trim()}" class="${cls?.substring(0, 50)}" role="${role}"`)
    }

    // Find clickable items inside any potential dropdown
    const allClickable = await page.locator('[onclick], button, a, [role="option"], [role="menuitem"]').all()
    console.log('  Clickable elements:', allClickable.length)

    // Look for class name elements specifically
    for (const cn of ALLOWED_CLASS_NAMES) {
      const el = page.getByText(cn).first()
      const count = await el.count()
      if (count) {
        console.log(`  "${cn}" found in DOM! Count: ${count}`)
        const tag = await el.evaluate(e => e.tagName)
        const role = await el.getAttribute('role')
        const clickable = await el.evaluate(e => {
          const s = window.getComputedStyle(e)
          return s.cursor === 'pointer' || e.tagName === 'BUTTON' || e.tagName === 'A' || e.onclick !== null
        })
        console.log(`    tag=${tag} role=${role} clickable=${clickable}`)
      }
    }

    // Check if class filter opens a panel showing classes immediately
    await screenshot(page, 'class_filter_open_state')

    const stateHtml = await page.content()

    // Look for React component with class list
    const reactData = stateHtml.match(/data-[a-z]+="(?:class|GNktw|LVjBT|OMMwc|k8tzO)[^"]*"/gi) || []
    console.log('  React data attrs:', reactData)

    // ────────── INSPECT THE CLASS SEARCH PANEL HTML ──────────
    console.log('\n=== CLASS SEARCH PANEL HTML ANALYSIS ===')
    // Take the HTML from search panel opened state
    writeFileSync('/app/e2e/audit/_tmp/class_filter_open.html', stateHtml)

    // Let's look at parent of the input
    const inputEl = page.locator('input[placeholder*="class" i]').first()
    if (await inputEl.count()) {
      const parentHtml = await inputEl.evaluate(el => {
        let parent = el.parentElement
        for (let i = 0; i < 5; i++) {
          if (!parent) break
          parent = parent.parentElement
        }
        return parent ? parent.innerHTML : ''
      })
      console.log('  Input parent HTML (3000):', parentHtml.substring(0, 3000))
    }

    // ────────── TRY FILLING INPUT WITH EACH CLASS ID ──────────
    console.log('\n=== TYPING CLASS ID IN SEARCH ===')
    const classSearchEl = page.locator('input[placeholder*="class" i]').first()
    if (await classSearchEl.count()) {
      // Type class ID directly to see if it works
      await classSearchEl.fill('k8tzOiiwotBbtJS3uTiv')
      await page.waitForTimeout(1000)
      const showingAfterIdSearch = await getShowingCount(page)
      const rowsAfterIdSearch = await countRows(page)
      console.log(`  After typing class ID: showing=${showingAfterIdSearch} rows=${rowsAfterIdSearch}`)
      await screenshot(page, 'typing_class_id')

      // Check what appeared
      const textAfterIdType = await page.locator('body').textContent()
      console.log('  Text after ID type (500):', textAfterIdType.substring(0, 500))
    }

    // ────────── ANALYZE THE PARENT CONTAINER RENDERING ──────────
    // The class filter seems to show classes as suggestions when typing
    // Let's look at what the filter panel looks like when open

    await goToGradebook(page)
    await page.waitForTimeout(1000)
    await page.getByRole('button', { name: 'Class' }).click()
    await page.waitForTimeout(500)

    // Type one char at a time and check what loads
    const searchEl = page.locator('input[placeholder*="class" i]').first()
    if (await searchEl.count()) {
      // First check: are class names already listed WITHOUT typing?
      const freshDom = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input')
        let container = null
        for (const input of inputs) {
          if (input.placeholder && input.placeholder.toLowerCase().includes('class')) {
            container = input.closest('[class*="panel"], [class*="filter"], [class*="search"], div')
            break
          }
        }
        return container ? container.innerHTML : document.body.innerHTML.substring(0, 5000)
      })
      console.log('  Input container innerHTML (3000):', freshDom.substring(0, 3000))
    }

    // ────────── PAGINATION TESTS WITH PAGE SIZE ──────────
    console.log('\n=== PAGE SIZE SELECTOR ===')
    await goToGradebook(page)
    await page.waitForTimeout(1000)

    const pageSizeSel = page.locator('select')
    if (await pageSizeSel.count()) {
      const opts = await pageSizeSel.locator('option').all()
      const optTexts = await Promise.all(opts.map(o => o.textContent()))
      console.log('  Page size options:', optTexts.map(t => t?.trim()))

      // Current (default) showing
      const defaultShowing = await getShowingCount(page)
      console.log('  Default showing:', defaultShowing)

      // These tests require data to be meaningful — check if we managed to load any
      auditData.pagination = {
        selectorFound: true,
        options: optTexts.map(t => t?.trim()),
        defaultShowing,
      }
    }

    // ────────── CSV EXPORT ──────────
    console.log('\n=== CSV EXPORT ===')
    await goToGradebook(page)
    await page.waitForTimeout(1000)

    const exportAllBtn = page.getByRole('button', { name: /export.*all/i }).first()
    if (await exportAllBtn.count()) {
      console.log('  "Export (All)" button found')
      auditData.csv.exportButtonExists = true

      // Try to click and capture download
      try {
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
        await exportAllBtn.click()
        const dl = await downloadPromise

        const fname = dl.suggestedFilename()
        console.log('  Download filename:', fname)
        const savePath = path.join(DOWNLOADS_DIR, fname || 'export.csv')
        await dl.saveAs(savePath)
        csvPath = savePath
        console.log('  Saved to:', savePath)

        if (existsSync(savePath)) {
          csvContent = readFileSync(savePath, 'utf-8')
          console.log('  CSV size:', csvContent.length)
          console.log('  CSV first 500:', csvContent.substring(0, 500))

          const lines = csvContent.split('\n').filter(l => l.trim())
          console.log('  CSV lines:', lines.length)
          console.log('  Header:', lines[0])
          auditData.csv = {
            exportButtonExists: true,
            downloaded: true,
            rowCount: lines.length - 1,
            header: lines[0],
            size: csvContent.length,
          }
        }
      } catch (e) {
        console.log('  Export download failed:', e.message)
        auditData.csv.downloadError = e.message

        // Export with no data loaded might just silently not download
        // Try to load class data first
        addFinding('MEDIUM', 'Export (All) with no filter applied — download did not trigger',
          '/teacher/gradebook Export (All) button',
          `Clicking Export (All) with Showing: 0 did not produce a file download. Error: ${e.message}`,
          '1. Navigate to /teacher/gradebook\n2. Do not apply any filter (Showing: 0)\n3. Click "Export (All)"',
          'Either export is disabled when no results, or it exports all records',
          'No download event fired — button click appears to be a no-op when data empty')
      }
    } else {
      console.log('  Export button not found')
      auditData.csv.exportButtonExists = false
    }

    // ────────── CHECK ALL BUTTON ──────────
    console.log('\n=== CHECK ALL BUTTON ===')
    await goToGradebook(page)
    await page.waitForTimeout(1000)

    const checkAllBtn = page.getByRole('button', { name: /check all/i }).first()
    if (await checkAllBtn.count()) {
      console.log('  "Check All" button found')
      auditData.pagination.checkAllFound = true
      auditData.pagination.checkAllIsButton = true  // Not a checkbox!

      // Click it when Showing: 0 to see what happens
      await checkAllBtn.click()
      await page.waitForTimeout(1000)
      await screenshot(page, 'check_all_empty_state')

      const afterCheckAll = await page.locator('body').textContent()
      console.log('  After Check All (empty state):', afterCheckAll.substring(0, 300))

      // Count checked boxes
      const checkedBoxes = await page.locator('input[type="checkbox"]:checked').count()
      console.log('  Checked boxes after Check All (empty):', checkedBoxes)

      auditData.pagination.checkAllEmptyState = { checkedBoxes }
    } else {
      console.log('  Check All button not found as role=button')
      // Check as checkbox
      const checkAllChk = page.locator('input[type="checkbox"]#checkAll, input[type="checkbox"][aria-label*="all"]').first()
      if (await checkAllChk.count()) {
        console.log('  Check All found as checkbox')
        auditData.pagination.checkAllFound = true
        auditData.pagination.checkAllIsCheckbox = true
      }
    }

    // ────────── SCOPE LEAKAGE CHECK ──────────
    console.log('\n=== SCOPE LEAKAGE CHECK ===')
    await goToGradebook(page)
    await page.waitForTimeout(1000)

    const bodyForScope = await page.locator('body').textContent()
    const has26SM = bodyForScope.includes('26SM')
    console.log('  Body contains "26SM":', has26SM)
    auditData.scopeCheck.gradebookHas26SM = has26SM

    if (has26SM) {
      addFinding('BLOCKER', '26SM class data visible on gradebook page for ta@vocaboost.com',
        '/teacher/gradebook',
        'Page body contains "26SM"',
        'Navigate to /teacher/gradebook as ta@vocaboost.com',
        'Only 25WT classes visible',
        '26SM class data visible')
    }

    // ────────── CHECK "Class" FILTER SHOWS ONLY 25WT CLASSES ──────────
    console.log('\n=== CLASS FILTER SCOPE CHECK ===')
    const classBtn4 = page.getByRole('button', { name: 'Class' }).first()
    await classBtn4.click()
    await page.waitForTimeout(600)

    const filterOpenBody = await page.locator('body').textContent()
    console.log('  After Class chip open - looking for class names...')

    // Check if 26SM appears as a filter option
    if (filterOpenBody.includes('26SM')) {
      addFinding('BLOCKER', '26SM class appears as option in Class filter dropdown',
        '/teacher/gradebook Class filter',
        'After clicking Class filter chip, 26SM class names appear',
        '1. Click "Class" filter button\n2. Check dropdown options',
        'Only 25WT classes visible in filter',
        '26SM classes appear in filter options')
    }

    // Check all class names that appear
    const classNameMatches = filterOpenBody.match(/\d+[A-Z]{2}[^,\n]*/g) || []
    console.log('  Class name patterns found:', [...new Set(classNameMatches)])
    auditData.scopeCheck.classFilterOptions = [...new Set(classNameMatches)]

    await screenshot(page, 'class_filter_scope_check')

    // ────────── TEST EACH FILTER CHIP ──────────
    console.log('\n=== ALL FILTER CHIP TESTS ===')
    await goToGradebook(page)
    await page.waitForTimeout(1000)

    const filterChips = ['Class', 'Name', 'List', 'Test Type', 'Date']
    for (const chip of filterChips) {
      console.log(`\n  -- Testing "${chip}" chip --`)
      // Find and click the chip
      const chipBtn = page.getByRole('button', { name: chip }).first()
      if (await chipBtn.count()) {
        await chipBtn.click()
        await page.waitForTimeout(700)

        const bodyAfterChip = await page.locator('body').textContent()
        console.log(`  Page text after "${chip}" click (300):`, bodyAfterChip.substring(0, 300))

        await screenshot(page, `filter_chip_${chip.toLowerCase().replace(/\s/g, '_')}`)

        // Check what appeared
        const newInputs = await page.locator('input:visible, select:visible').all()
        console.log(`  Visible inputs/selects after "${chip}" click: ${newInputs.length}`)
        for (const inp of newInputs) {
          const t = await inp.getAttribute('type')
          const ph = await inp.getAttribute('placeholder')
          console.log(`    ${t}: "${ph}"`)
        }

        // Look for 26SM in options
        if (bodyAfterChip.includes('26SM')) {
          addFinding('BLOCKER', `26SM data visible in ${chip} filter options`,
            `/teacher/gradebook ${chip} filter`,
            `26SM appears in filter panel after clicking ${chip}`,
            `Click "${chip}" filter chip`,
            'Only 25WT class data',
            '26SM data visible')
        }

        // Press Escape to close this chip
        await page.keyboard.press('Escape')
        await page.waitForTimeout(400)
      } else {
        console.log(`  "${chip}" chip not found`)
      }
    }

    // ────────── CONSOLE ERRORS SUMMARY ──────────
    console.log('\n=== CONSOLE ERRORS ===')
    const errors = consoleMessages.filter(m => m.type === 'error' || m.type === 'pageerror')
    console.log('  Total:', errors.length)
    for (const err of errors.slice(0, 10)) {
      console.log('  Error:', err.text.substring(0, 150))
    }

    if (errors.length > 0) {
      const serious = errors.filter(e =>
        !e.text.includes('favicon') && !e.text.includes('googletagmanager') &&
        !e.text.includes('analytics') && !e.text.includes('ERR_BLOCKED')
      )
      if (serious.length > 0) {
        addFinding('MEDIUM', `${serious.length} console error(s) on gradebook page`,
          '/teacher/gradebook',
          `Errors: ${serious.slice(0, 3).map(e => e.text.substring(0, 100)).join('; ')}`,
          'Open DevTools console on /teacher/gradebook',
          'No console errors',
          `${serious.length} error(s)`)
      }
    }

    // ────────── FINAL SCREENSHOT ──────────
    await goToGradebook(page)
    await page.waitForTimeout(1000)
    await screenshot(page, 'phase2_final')

  } catch (e) {
    console.error('\nFATAL ERROR:', e.message)
    console.error(e.stack)
    await screenshot(page, 'fatal_error').catch(() => {})
  } finally {
    await ctx.close()
    await browser.close()
  }

  // ────────── SAVE PHASE 2 DATA ──────────
  const phase2Data = {
    loginOk,
    csvPath,
    auditData,
    findings,
    consoleErrors: consoleMessages.filter(m => m.type === 'error' || m.type === 'pageerror'),
  }
  writeFileSync('/app/e2e/audit/_tmp/phase2_data.json', JSON.stringify(phase2Data, null, 2))

  console.log('\n========================================')
  console.log('PHASE 2 COMPLETE')
  console.log(`Login: ${loginOk ? 'OK' : 'FAILED'}`)
  console.log(`Findings: ${findings.length} (B:${findings.filter(f => f.severity === 'BLOCKER').length} H:${findings.filter(f => f.severity === 'HIGH').length} M:${findings.filter(f => f.severity === 'MEDIUM').length})`)
  console.log(`CSV: ${csvPath || 'not downloaded'}`)
  console.log('========================================')

  return phase2Data
}

run().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
