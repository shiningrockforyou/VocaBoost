/**
 * B9 Audit Script v2 — Teacher Management & Editor
 * Scenarios: T-10, T-11, T-12, T-13, T-14, T-15
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, '../src/apBoost/criteria_audit/playwright_reports/screenshots_b9');
const TEACHER_EMAIL = 'teacher@apboost.test';
const TEACHER_PASSWORD = 'Teacher123!';

const results = {
  login: null,
  'T-10': null,
  'T-11': null,
  'T-12': null,
  'T-13': null,
  'T-14': null,
  'T-15': null,
  consoleErrors: [],
  findings: []
};

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`  [screenshot] ${name}.png`);
  return filePath;
}

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', TEACHER_EMAIL);
  await page.fill('input[type="password"]', TEACHER_PASSWORD);
  await page.click('button[type="submit"]');
  // Wait for redirect to root or /ap
  await page.waitForTimeout(3000);
  console.log('  After login URL:', page.url());
  return page.url().includes('/login') === false;
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleMessages = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const text = msg.text();
      // Filter out common non-critical React warnings
      if (!text.includes('Download the React DevTools') && !text.includes('Warning: An update to')) {
        consoleMessages.push({ type: msg.type(), text: text.substring(0, 200), url: page.url() });
      }
    }
  });

  // ============================================================
  // LOGIN
  // ============================================================
  console.log('\n=== LOGIN ===');
  try {
    const loggedIn = await login(page);
    if (loggedIn) {
      await screenshot(page, '00_login_success');
      console.log('  LOGIN: PASS — at:', page.url());
      results.login = 'PASS';
    } else {
      await screenshot(page, '00_login_fail');
      console.log('  LOGIN: FAIL — still at login page');
      results.login = 'FAIL: still on login page';
      await browser.close();
      return results;
    }
  } catch (err) {
    console.error('  LOGIN FAILED:', err.message);
    await screenshot(page, '00_login_fail');
    results.login = `FAIL: ${err.message}`;
    await browser.close();
    return results;
  }

  // ============================================================
  // T-11: Teacher Dashboard - Seed Data Button
  // ============================================================
  console.log('\n=== T-11: Teacher Dashboard - Seed Data Button ===');
  try {
    await page.goto(`${BASE_URL}/ap/teacher`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, 'T11_01_teacher_dashboard_top');

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await screenshot(page, 'T11_02_teacher_dashboard_bottom');

    console.log(`  URL: ${page.url()}`);

    // Check for Developer Tools section
    const devToolsVisible = await page.locator('text=Developer Tools').isVisible().catch(() => false);
    console.log(`  Developer Tools visible: ${devToolsVisible}`);

    // Check for seed button (various possible texts)
    const seedBtnSelectors = [
      'button:has-text("Seed Full Test Data")',
      'button:has-text("Seed")',
      'button:has-text("seed")',
    ];
    let seedBtnVisible = false;
    let seedBtnText = '';
    for (const sel of seedBtnSelectors) {
      const btn = await page.locator(sel).first();
      const vis = await btn.isVisible().catch(() => false);
      if (vis) {
        seedBtnVisible = true;
        seedBtnText = await btn.textContent().catch(() => sel);
        break;
      }
    }
    console.log(`  Seed button visible: ${seedBtnVisible}, text: "${seedBtnText}"`);

    // Get the page body to understand what's there
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasSeedText = bodyText.includes('Seed') || bodyText.includes('seed');
    const hasDeveloperTools = bodyText.includes('Developer');
    console.log(`  Body has 'Seed': ${hasSeedText}, has 'Developer': ${hasDeveloperTools}`);

    if (devToolsVisible && seedBtnVisible) {
      results['T-11'] = {
        status: 'PASS',
        details: `Developer Tools section and "${seedBtnText}" button both visible at /ap/teacher`,
      };
    } else if (hasSeedText) {
      results['T-11'] = {
        status: 'PARTIAL',
        details: `Seed text found in page but standard detection failed. devTools: ${devToolsVisible}, seedBtn: ${seedBtnVisible}`,
      };
    } else {
      results['T-11'] = {
        status: 'FAIL',
        details: `Developer Tools visible: ${devToolsVisible}, Seed button visible: ${seedBtnVisible}`,
      };
    }
  } catch (err) {
    console.error('  T-11 ERROR:', err.message);
    await screenshot(page, 'T11_error');
    results['T-11'] = { status: 'FAIL', details: err.message };
  }

  // ============================================================
  // T-10: Class Manager Page
  // ============================================================
  console.log('\n=== T-10: Class Manager Page ===');
  try {
    await page.goto(`${BASE_URL}/ap/teacher/classes`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, 'T10_01_initial');

    const currentUrl = page.url();
    console.log(`  URL: ${currentUrl}`);

    const bodyText = await page.evaluate(() => document.body.innerText);
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log(`  Headings: ${JSON.stringify(headings)}`);

    // Check for redirect away from expected URL
    if (!currentUrl.includes('/teacher/classes') && !currentUrl.includes('/ap/teacher')) {
      results['T-10'] = {
        status: 'FAIL',
        details: `Unexpected redirect to: ${currentUrl}`,
      };
    } else {
      // Check page content
      const is404 = bodyText.includes('Page Not Found') || (bodyText.includes('404') && bodyText.length < 200);
      const hasClassHeading = headings.some(h => h.toLowerCase().includes('class'));
      const hasEconClass = bodyText.includes('Economics') || bodyText.includes('AP Econ');
      const hasCalcClass = bodyText.includes('Calculus') || bodyText.includes('AP Calc');

      console.log(`  is404: ${is404}, class heading: ${hasClassHeading}, has Econ: ${hasEconClass}, has Calc: ${hasCalcClass}`);

      // Look for class list elements
      const classCards = await page.locator('[class*="class"], [class*="Class"]').count();
      const listItems = await page.locator('li').count();
      console.log(`  Class-related elements: ${classCards}, list items: ${listItems}`);

      await screenshot(page, 'T10_02_content');

      // Look for create class form
      const createBtn = await page.locator('button:has-text("Create"), button:has-text("New Class"), button:has-text("Add Class")').count();
      const nameInput = await page.locator('input[placeholder*="name" i]').count();
      console.log(`  Create buttons: ${createBtn}, name inputs: ${nameInput}`);

      // Try clicking on first class (if any)
      const classListItems = await page.locator('li').all();
      let clickedClass = false;
      for (const item of classListItems) {
        const text = await item.textContent().catch(() => '');
        if (text.includes('Period') || text.includes('Economics') || text.includes('Calc')) {
          await item.click();
          await page.waitForTimeout(1000);
          await screenshot(page, 'T10_03_class_clicked');
          clickedClass = true;
          break;
        }
      }

      const afterClickText = await page.evaluate(() => document.body.innerText);
      const hasStudents = afterClickText.toLowerCase().includes('student') && afterClickText.includes('@');
      const removeBtn = await page.locator('button:has-text("Remove"), button:has-text("Delete")').count();
      const addInput = await page.locator('input[type="email"]').count();
      console.log(`  Has student list (after click): ${hasStudents}, remove buttons: ${removeBtn}, email input: ${addInput}`);

      if (is404) {
        results['T-10'] = { status: 'FAIL', details: 'Page shows 404 Not Found' };
      } else if (hasEconClass || hasCalcClass || hasClassHeading) {
        results['T-10'] = {
          status: 'PASS',
          details: `Class manager loaded. Econ: ${hasEconClass}, Calc: ${hasCalcClass}. Create btn: ${createBtn > 0}. Student add/remove: input=${addInput > 0}, removeBtn=${removeBtn > 0}`,
          headings,
          hasEconClass,
          hasCalcClass,
          createBtn,
          hasStudents,
          addInput,
          removeBtn,
          clickedClass,
        };
      } else {
        results['T-10'] = {
          status: 'PARTIAL',
          details: `Page loaded but no class content found. Headings: ${JSON.stringify(headings)}`,
          headings,
          bodySnippet: bodyText.substring(0, 300),
        };
      }
    }
  } catch (err) {
    console.error('  T-10 ERROR:', err.message);
    await screenshot(page, 'T10_error');
    results['T-10'] = { status: 'FAIL', details: err.message };
  }

  // ============================================================
  // T-12: Test Editor - View Existing Test
  // ============================================================
  console.log('\n=== T-12: Test Editor - View Existing Test ===');
  try {
    // Go to teacher dashboard first to find Edit button
    await page.goto(`${BASE_URL}/ap/teacher`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, 'T12_01_dashboard');

    // Look for Edit buttons in test cards
    const editLinks = await page.locator('a[href*="/edit"], a:has-text("Edit")').all();
    console.log(`  Edit links: ${editLinks.length}`);

    let navigatedToEditor = false;
    if (editLinks.length > 0) {
      const href = await editLinks[0].getAttribute('href').catch(() => null);
      console.log(`  First edit link href: ${href}`);
      await editLinks[0].click();
      await page.waitForTimeout(2000);
      navigatedToEditor = true;
    } else {
      // Navigate directly
      await page.goto(`${BASE_URL}/ap/teacher/test/test_micro_full_1/edit`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
    }

    await screenshot(page, 'T12_02_editor_loaded');
    console.log(`  URL: ${page.url()}`);

    const bodyText = await page.evaluate(() => document.body.innerText);
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log(`  Headings: ${JSON.stringify(headings)}`);

    const is404 = bodyText.includes('Page Not Found') || (bodyText.includes('404') && !page.url().includes('/edit'));
    console.log(`  is404: ${is404}`);

    // Check for editor fields
    const titleInputs = await page.locator('input[value], input[placeholder*="title" i], input[placeholder*="name" i]').all();
    let titleValue = '';
    if (titleInputs.length > 0) {
      titleValue = await titleInputs[0].inputValue().catch(() => '');
    }
    console.log(`  Title input value: "${titleValue}"`);

    const subjectSelects = await page.locator('select').count();
    console.log(`  Select dropdowns: ${subjectSelects}`);

    // Check for sections
    const sectionCount = await page.locator('text=Section 1, text=Section').count();
    console.log(`  Section elements: ${sectionCount}`);

    // Check for question list
    const questionItems = await page.locator('[class*="question" i]').count();
    console.log(`  Question items: ${questionItems}`);

    // Look for reorder buttons
    const moveUpBtns = await page.locator('button[title*="up" i], button[aria-label*="up" i], button:has-text("↑"), button:has-text("▲")').count();
    const moveDownBtns = await page.locator('button[title*="down" i], button[aria-label*="down" i], button:has-text("↓"), button:has-text("▼")').count();
    console.log(`  Move Up buttons: ${moveUpBtns}, Move Down buttons: ${moveDownBtns}`);

    // Check for Save Draft / Save and Publish
    const saveDraftBtn = await page.locator('button:has-text("Save Draft"), button:has-text("Save draft")').count();
    const publishBtn = await page.locator('button:has-text("Publish"), button:has-text("Save and Publish")').count();
    console.log(`  Save Draft: ${saveDraftBtn}, Publish: ${publishBtn}`);

    await screenshot(page, 'T12_03_editor_detail');

    if (is404) {
      results['T-12'] = { status: 'FAIL', details: 'Test editor returned 404' };
    } else {
      const editorFunctional = titleValue.length > 0 || subjectSelects > 0;
      results['T-12'] = {
        status: editorFunctional ? 'PASS' : 'PARTIAL',
        details: `Editor at ${page.url()}. Title: "${titleValue}", Selects: ${subjectSelects}, Sections: ${sectionCount}, Questions: ${questionItems}. Reorder up/down: ${moveUpBtns}/${moveDownBtns}. Save/Publish: ${saveDraftBtn}/${publishBtn}`,
        headings,
        titleValue,
        subjectSelects,
        sectionCount,
        questionItems,
        moveUpBtns,
        moveDownBtns,
        saveDraftBtn,
        publishBtn,
      };
    }
  } catch (err) {
    console.error('  T-12 ERROR:', err.message);
    await screenshot(page, 'T12_error');
    results['T-12'] = { status: 'FAIL', details: err.message };
  }

  // ============================================================
  // T-13: Test Editor - Create New Test
  // ============================================================
  console.log('\n=== T-13: Test Editor - Create New Test ===');
  try {
    await page.goto(`${BASE_URL}/ap/teacher/test/new`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, 'T13_01_new_test');

    console.log(`  URL: ${page.url()}`);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log(`  Headings: ${JSON.stringify(headings)}`);

    const is404 = bodyText.includes('Page Not Found') || bodyText.includes('404 ');
    const redirectedAway = !page.url().includes('/teacher/test/');
    console.log(`  is404: ${is404}, redirected away: ${redirectedAway}`);

    // Check for empty form fields
    const allInputs = await page.locator('input').all();
    let titleInputFound = false;
    let titleIsEmpty = false;
    for (const inp of allInputs) {
      const placeholder = await inp.getAttribute('placeholder').catch(() => '');
      const val = await inp.inputValue().catch(() => '');
      console.log(`  Input: placeholder="${placeholder}", value="${val}"`);
      if (placeholder && (placeholder.toLowerCase().includes('title') || placeholder.toLowerCase().includes('name') || placeholder.toLowerCase().includes('test'))) {
        titleInputFound = true;
        titleIsEmpty = val === '';
      }
    }

    const subjectSelects = await page.locator('select').count();
    const addSectionBtn = await page.locator('button:has-text("Section"), button:has-text("Add Section")').count();
    console.log(`  Subject selects: ${subjectSelects}, Add section: ${addSectionBtn}`);

    // Check if the URL auto-created a new test ID (some editors create a doc immediately)
    await page.waitForTimeout(1000);
    const finalUrl = page.url();
    console.log(`  Final URL: ${finalUrl}`);

    if (is404) {
      results['T-13'] = {
        status: 'FAIL',
        details: `Route /ap/teacher/test/new returns 404. URL: ${page.url()}`,
        bodySnippet: bodyText.substring(0, 200),
      };
    } else if (redirectedAway) {
      results['T-13'] = {
        status: 'FAIL',
        details: `Route redirected to ${page.url()} instead of /ap/teacher/test/new or similar`,
      };
    } else {
      results['T-13'] = {
        status: titleInputFound ? 'PASS' : 'PARTIAL',
        details: `New test editor at ${finalUrl}. Title input: ${titleInputFound} (empty: ${titleIsEmpty}), Selects: ${subjectSelects}, Add section: ${addSectionBtn}`,
        headings,
        titleInputFound,
        titleIsEmpty,
        subjectSelects,
        addSectionBtn,
        finalUrl,
      };
    }
  } catch (err) {
    console.error('  T-13 ERROR:', err.message);
    await screenshot(page, 'T13_error');
    results['T-13'] = { status: 'FAIL', details: err.message };
  }

  // ============================================================
  // T-14: Question Bank Page
  // ============================================================
  console.log('\n=== T-14: Question Bank Page ===');
  try {
    await page.goto(`${BASE_URL}/ap/teacher/questions`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, 'T14_01_question_bank');

    console.log(`  URL: ${page.url()}`);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log(`  Headings: ${JSON.stringify(headings)}`);

    const is404 = bodyText.includes('Page Not Found') || (bodyText.includes('404') && bodyText.length < 300);
    console.log(`  is404: ${is404}`);

    // Count questions by looking for MCQ/FRQ badges or question rows
    const mcqCount = await page.locator(':text("MCQ")').count();
    const frqCount = await page.locator(':text("FRQ")').count();
    console.log(`  MCQ elements: ${mcqCount}, FRQ elements: ${frqCount}`);

    // Count rows
    const tableRows = await page.locator('tr').count();
    const tableDataRows = await page.locator('tbody tr, [role="row"]').count();
    console.log(`  Table rows: ${tableRows}, data rows: ${tableDataRows}`);

    // Filters
    const searchInput = await page.locator('input[type="search"], input[placeholder*="search" i]').count();
    const filterSelects = await page.locator('select').count();
    console.log(`  Search inputs: ${searchInput}, filter selects: ${filterSelects}`);

    // Create question button
    const createBtns = await page.locator('a:has-text("Create"), button:has-text("New Question"), a[href*="question/new"], a[href*="/question/new"]').count();
    console.log(`  Create question buttons/links: ${createBtns}`);

    // Preview button
    const previewBtns = await page.locator('button:has-text("Preview")').count();
    console.log(`  Preview buttons: ${previewBtns}`);

    // Edit links
    const editLinks = await page.locator('a[href*="/question/"], button:has-text("Edit")').count();
    console.log(`  Edit links: ${editLinks}`);

    // Test filtering
    let filterTested = false;
    if (filterSelects > 0) {
      const firstSelect = await page.locator('select').first();
      const options = await firstSelect.locator('option').allTextContents();
      console.log(`  First select options: ${JSON.stringify(options.slice(0, 5))}`);
      if (options.length > 1) {
        const countBefore = await page.locator('tbody tr, [role="row"]').count();
        await firstSelect.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
        const countAfter = await page.locator('tbody tr, [role="row"]').count();
        console.log(`  Row count before filter: ${countBefore}, after: ${countAfter}`);
        await screenshot(page, 'T14_02_filtered');
        filterTested = true;
      }
    }

    // Click edit on first question if available
    let navToQuestionWorks = false;
    const firstEditLink = await page.locator('a[href*="/question/"]').first();
    const firstEditHref = await firstEditLink.getAttribute('href').catch(() => null);
    if (firstEditHref) {
      navToQuestionWorks = firstEditHref.includes('/question/');
      console.log(`  First question edit href: ${firstEditHref}`);
    }

    await screenshot(page, 'T14_03_final');

    if (is404) {
      results['T-14'] = { status: 'FAIL', details: 'Question bank page returned 404' };
    } else {
      const hasQuestions = mcqCount > 0 || frqCount > 0 || tableDataRows > 1;
      results['T-14'] = {
        status: hasQuestions ? 'PASS' : 'PARTIAL',
        details: `Questions loaded: ${hasQuestions}. MCQ: ${mcqCount}, FRQ: ${frqCount}, rows: ${tableDataRows}. Filters: ${filterSelects}. Create: ${createBtns > 0}. Nav: ${navToQuestionWorks}`,
        headings,
        mcqCount,
        frqCount,
        tableDataRows,
        filterSelects,
        searchInput,
        createBtns,
        previewBtns,
        editLinks,
        filterTested,
        navToQuestionWorks,
      };
    }
  } catch (err) {
    console.error('  T-14 ERROR:', err.message);
    await screenshot(page, 'T14_error');
    results['T-14'] = { status: 'FAIL', details: err.message };
  }

  // ============================================================
  // T-15: Assign Test to Class
  // ============================================================
  console.log('\n=== T-15: Assign Test to Class ===');
  try {
    // Check teacher dashboard for Assign button
    await page.goto(`${BASE_URL}/ap/teacher`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, 'T15_01_dashboard');

    // Look for Assign buttons
    const assignBtns = await page.locator('button:has-text("Assign"), a:has-text("Assign")').all();
    console.log(`  Assign buttons: ${assignBtns.length}`);

    let assignBtnDisabled = null;
    let assignBtnHref = null;
    if (assignBtns.length > 0) {
      assignBtnDisabled = await assignBtns[0].isDisabled();
      assignBtnHref = await assignBtns[0].getAttribute('href').catch(() => null);
      console.log(`  First Assign: disabled=${assignBtnDisabled}, href=${assignBtnHref}`);
    }

    // Navigate to assign page directly
    await page.goto(`${BASE_URL}/ap/teacher/test/test_micro_full_1/assign`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, 'T15_02_assign_page');

    console.log(`  URL: ${page.url()}`);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log(`  Headings: ${JSON.stringify(headings)}`);

    const is404 = bodyText.includes('Page Not Found') || (bodyText.includes('404') && bodyText.length < 300);
    const redirectedAway = !page.url().includes('/assign');
    console.log(`  is404: ${is404}, redirected: ${redirectedAway}`);

    // Check content
    const hasTestInfo = bodyText.includes('Micro') || bodyText.includes('Economics') || bodyText.includes('Assign');
    const hasClassSection = bodyText.toLowerCase().includes('class') || bodyText.toLowerCase().includes('period');
    const hasDueDate = bodyText.toLowerCase().includes('due') || bodyText.toLowerCase().includes('date');
    const hasAttempts = bodyText.toLowerCase().includes('attempt');
    const hasFrqMode = bodyText.toLowerCase().includes('frq') || bodyText.toLowerCase().includes('handwritten') || bodyText.toLowerCase().includes('typed');
    console.log(`  hasTestInfo: ${hasTestInfo}, hasClassSection: ${hasClassSection}, hasDueDate: ${hasDueDate}, hasAttempts: ${hasAttempts}`);

    // Checkboxes for class selection
    const checkboxes = await page.locator('input[type="checkbox"]').count();
    const dateInputs = await page.locator('input[type="date"]').count();
    const selectsOnPage = await page.locator('select').count();
    const submitBtn = await page.locator('button:has-text("Assign"), button[type="submit"]').count();
    console.log(`  Checkboxes: ${checkboxes}, date inputs: ${dateInputs}, selects: ${selectsOnPage}, submit: ${submitBtn}`);

    // Check for student count display
    const studentCountText = bodyText.match(/\d+ student/i);
    console.log(`  Student count text: ${studentCountText}`);

    // Try checking a class checkbox
    if (checkboxes > 0) {
      const firstCheckbox = await page.locator('input[type="checkbox"]').first();
      const isChecked = await firstCheckbox.isChecked();
      if (!isChecked) {
        await firstCheckbox.check();
        await page.waitForTimeout(500);
      }
      await screenshot(page, 'T15_03_class_checked');
      const afterCheckText = await page.evaluate(() => document.body.innerText);
      const submitAfterCheck = await page.locator('button:has-text("Assign to")').count();
      console.log(`  Submit btn after check: ${submitAfterCheck}`);
    }

    await screenshot(page, 'T15_04_final');

    if (is404) {
      results['T-15'] = { status: 'FAIL', details: 'Assign page returned 404' };
    } else if (redirectedAway) {
      results['T-15'] = { status: 'FAIL', details: `Redirected to ${page.url()} instead of assign page` };
    } else {
      const assignLoaded = hasTestInfo || hasClassSection;
      results['T-15'] = {
        status: assignLoaded ? 'PASS' : 'PARTIAL',
        details: `Assign page at ${page.url()}. Test info: ${hasTestInfo}, Classes: ${hasClassSection}, Due date: ${hasDueDate}, Attempts: ${hasAttempts}. Checkboxes: ${checkboxes}, Submit: ${submitBtn}`,
        headings,
        hasTestInfo,
        hasClassSection,
        hasDueDate,
        hasAttempts,
        hasFrqMode,
        checkboxes,
        dateInputs,
        selectsOnPage,
        submitBtn,
        assignBtnDisabled,
      };
    }
  } catch (err) {
    console.error('  T-15 ERROR:', err.message);
    await screenshot(page, 'T15_error');
    results['T-15'] = { status: 'FAIL', details: err.message };
  }

  // Collect final console errors
  results.consoleErrors = consoleMessages;

  // Summary
  console.log('\n=== RESULTS SUMMARY ===');
  for (const [key, val] of Object.entries(results)) {
    if (key !== 'consoleErrors' && key !== 'findings') {
      const status = typeof val === 'object' ? val?.status : val;
      console.log(`  ${key}: ${status}`);
    }
  }
  console.log(`\n  Console errors/warnings: ${consoleMessages.length}`);
  consoleMessages.forEach(m => console.log(`    [${m.type}] ${m.url}: ${m.text.substring(0, 150)}`));

  await browser.close();
  return results;
}

run()
  .then(results => {
    const outPath = path.join(__dirname, '../src/apBoost/criteria_audit/playwright_reports/b9_raw_results.json');
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${outPath}`);
  })
  .catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
  });
