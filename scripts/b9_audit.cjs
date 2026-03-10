/**
 * B9 Audit Script — Teacher Management & Editor
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

async function getConsoleErrors(page) {
  // Console messages collected via listener
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleMessages = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleMessages.push({ type: msg.type(), text: msg.text(), url: page.url() });
    }
  });

  // ============================================================
  // LOGIN
  // ============================================================
  console.log('\n=== LOGIN ===');
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', TEACHER_EMAIL);
    await page.fill('input[type="password"]', TEACHER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/ap**', { timeout: 15000 });
    await screenshot(page, '00_login_success');
    console.log('  LOGIN: PASS — redirected to:', page.url());
    results.login = 'PASS';
  } catch (err) {
    console.error('  LOGIN FAILED:', err.message);
    await screenshot(page, '00_login_fail');
    results.login = `FAIL: ${err.message}`;
    await browser.close();
    return results;
  }

  // ============================================================
  // T-11: Teacher Dashboard - Seed Data Button
  // (Check first since it's quick and confirms dev mode is working)
  // ============================================================
  console.log('\n=== T-11: Teacher Dashboard - Seed Data Button ===');
  try {
    await page.goto(`${BASE_URL}/ap/teacher`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Scroll to bottom to find Developer Tools
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await screenshot(page, 'T11_01_teacher_dashboard_bottom');

    // Check for Developer Tools section
    const devToolsSection = await page.locator('text=Developer Tools').first();
    const devToolsVisible = await devToolsSection.isVisible().catch(() => false);
    console.log(`  Developer Tools section visible: ${devToolsVisible}`);

    // Check for seed button
    const seedBtn = await page.locator('button:has-text("Seed Full Test Data")').first();
    const seedBtnVisible = await seedBtn.isVisible().catch(() => false);
    console.log(`  Seed Full Test Data button visible: ${seedBtnVisible}`);

    await screenshot(page, 'T11_02_seed_button');

    if (devToolsVisible && seedBtnVisible) {
      results['T-11'] = {
        status: 'PASS',
        details: 'Developer Tools section and Seed Full Test Data button both visible',
        devToolsVisible,
        seedBtnVisible
      };
    } else {
      results['T-11'] = {
        status: 'FAIL',
        details: `Developer Tools visible: ${devToolsVisible}, Seed button visible: ${seedBtnVisible}`,
        devToolsVisible,
        seedBtnVisible
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
    await screenshot(page, 'T10_01_class_manager');

    const pageTitle = await page.title();
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log(`  Page URL: ${page.url()}`);
    console.log(`  Page title: ${pageTitle}`);

    // Check if page loaded (not 404)
    const is404 = bodyText.includes('404') || bodyText.includes('Not Found') || bodyText.includes('not found');
    console.log(`  Is 404/Not Found: ${is404}`);

    // Look for class-related content
    const hasClassContent = bodyText.toLowerCase().includes('class') || bodyText.toLowerCase().includes('Class');
    console.log(`  Has class-related content: ${hasClassContent}`);

    // Check for heading
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log(`  Headings found: ${JSON.stringify(headings)}`);

    // Check for seed classes
    const hasEconClass = bodyText.includes('Economics') || bodyText.includes('Econ') || bodyText.includes('AP Economics');
    const hasCalcClass = bodyText.includes('Calculus') || bodyText.includes('Calc');
    console.log(`  Has Economics class: ${hasEconClass}`);
    console.log(`  Has Calculus class: ${hasCalcClass}`);

    // Look for Create Class button/form
    const createClassElements = await page.locator('button:has-text("Create"), button:has-text("New Class"), input[placeholder*="class" i], button:has-text("Add Class")').count();
    console.log(`  Create class UI elements found: ${createClassElements}`);

    await screenshot(page, 'T10_02_class_list');

    // Try clicking on the first class card if any exist
    const classItems = await page.locator('[class*="class"], .class-item, [data-testid*="class"]').count();
    console.log(`  Class item elements found: ${classItems}`);

    // Look for any clickable list items
    const listItems = await page.locator('li, [role="listitem"]').count();
    console.log(`  List items: ${listItems}`);

    // Get all visible text to understand what's on page
    const visibleText = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const texts = [];
      let node;
      while ((node = walker.nextNode())) {
        const t = node.textContent.trim();
        if (t.length > 2) texts.push(t);
      }
      return texts.slice(0, 50);
    });
    console.log(`  Page text samples: ${JSON.stringify(visibleText.slice(0, 20))}`);

    // Check if page redirected (possibly unprotected or missing)
    if (page.url() !== `${BASE_URL}/ap/teacher/classes`) {
      console.log(`  WARNING: Page redirected to ${page.url()}`);
      results['T-10'] = {
        status: 'FAIL',
        details: `Route redirected to ${page.url()} instead of /ap/teacher/classes`,
        pageRedirected: true
      };
    } else if (is404) {
      results['T-10'] = { status: 'FAIL', details: 'Page shows 404 or Not Found' };
    } else {
      // Determine pass/fail based on content
      const hasClasses = hasEconClass || hasCalcClass;
      results['T-10'] = {
        status: hasClasses ? 'PASS' : 'PARTIAL',
        details: `Page loaded at correct URL. Classes found: Econ=${hasEconClass}, Calc=${hasCalcClass}. Create class UI: ${createClassElements > 0}`,
        headings,
        hasEconClass,
        hasCalcClass,
        createClassElements
      };
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
    // First go to teacher dashboard to find the Edit button
    await page.goto(`${BASE_URL}/ap/teacher`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, 'T12_01_teacher_dashboard');

    // Look for Edit button on test cards
    const editButtons = await page.locator('a:has-text("Edit"), button:has-text("Edit")').all();
    console.log(`  Edit buttons found: ${editButtons.length}`);

    if (editButtons.length > 0) {
      // Click the first Edit button
      const firstEditBtn = editButtons[0];
      const editHref = await firstEditBtn.getAttribute('href');
      console.log(`  First Edit button href: ${editHref}`);
      await firstEditBtn.click();
      await page.waitForTimeout(2000);
    } else {
      // Navigate directly using known test ID
      await page.goto(`${BASE_URL}/ap/teacher/test/test_micro_full_1/edit`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
    }

    await screenshot(page, 'T12_02_test_editor_loaded');
    console.log(`  URL after navigation: ${page.url()}`);

    const bodyText = await page.evaluate(() => document.body.innerText);
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log(`  Headings: ${JSON.stringify(headings)}`);

    // Check for editor content
    const titleInput = await page.locator('input[placeholder*="title" i], input[placeholder*="test" i], input[placeholder*="name" i]').count();
    const subjectDropdown = await page.locator('select, [role="combobox"]').count();
    const sectionElements = await page.locator('text=Section').count();

    console.log(`  Title inputs: ${titleInput}`);
    console.log(`  Dropdowns/comboboxes: ${subjectDropdown}`);
    console.log(`  Section elements: ${sectionElements}`);

    // Check for questions
    const questionElements = await page.locator('text=MCQ, text=FRQ').count();
    console.log(`  Question type labels: ${questionElements}`);

    // Check for up/down arrow buttons (question reorder)
    const arrowButtons = await page.locator('button[title*="up" i], button[title*="down" i], button[title*="move" i], button:has-text("↑"), button:has-text("↓"), button[aria-label*="up" i], button[aria-label*="down" i]').count();
    console.log(`  Arrow/reorder buttons: ${arrowButtons}`);

    // Check URL format
    const urlHasEdit = page.url().includes('/edit');
    const urlHasTestId = page.url().includes('test_micro_full_1') || page.url().includes('/test/');
    console.log(`  URL has /edit: ${urlHasEdit}, URL has test ID: ${urlHasTestId}`);

    // Try clicking the up arrow on second question
    const upBtns = await page.locator('button[title*="up" i], button[aria-label*="up" i], button:has-text("↑")').all();
    let reorderWorked = false;
    if (upBtns.length >= 2) {
      const textBefore = await page.locator('[class*="question"], [class*="Question"]').allTextContents().catch(() => []);
      await upBtns[1].click();
      await page.waitForTimeout(500);
      const textAfter = await page.locator('[class*="question"], [class*="Question"]').allTextContents().catch(() => []);
      reorderWorked = JSON.stringify(textBefore) !== JSON.stringify(textAfter);
      console.log(`  Reorder worked: ${reorderWorked}`);
    }

    await screenshot(page, 'T12_03_test_editor_detail');

    const is404 = bodyText.includes('404') || bodyText.includes('Not Found');
    if (is404) {
      results['T-12'] = { status: 'FAIL', details: 'Editor page returned 404 or Not Found' };
    } else if (!urlHasTestId && !urlHasEdit) {
      results['T-12'] = { status: 'FAIL', details: `URL doesn't match expected editor URL: ${page.url()}` };
    } else {
      results['T-12'] = {
        status: 'PASS',
        details: `Editor loaded at ${page.url()}. Title inputs: ${titleInput}, Dropdowns: ${subjectDropdown}, Sections: ${sectionElements}`,
        headings,
        titleInput,
        subjectDropdown,
        sectionElements,
        arrowButtons,
        reorderWorked
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
    await screenshot(page, 'T13_01_new_test_editor');

    console.log(`  URL: ${page.url()}`);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log(`  Headings: ${JSON.stringify(headings)}`);

    const is404 = bodyText.includes('404') || bodyText.includes('Not Found');
    const urlIsNew = page.url().includes('/new') || page.url().includes('/teacher/test/');
    console.log(`  Is 404: ${is404}, URL is new-test related: ${urlIsNew}`);

    // Check for title input (empty)
    const titleInputs = await page.locator('input[placeholder*="title" i], input[placeholder*="test" i], input[placeholder*="name" i]').all();
    console.log(`  Title inputs found: ${titleInputs.length}`);

    let titleInputEmpty = false;
    if (titleInputs.length > 0) {
      const titleVal = await titleInputs[0].inputValue();
      titleInputEmpty = titleVal === '' || titleVal.length === 0;
      console.log(`  First title input value: "${titleVal}" (empty: ${titleInputEmpty})`);
    }

    // Check for subject dropdown
    const selects = await page.locator('select').count();
    console.log(`  Select dropdowns: ${selects}`);

    // Check for Add Section button
    const addSectionBtn = await page.locator('button:has-text("Add Section"), button:has-text("+ Section")').count();
    console.log(`  Add Section buttons: ${addSectionBtn}`);

    // Get URL after load — if it auto-creates, it might have a different testId
    await page.waitForTimeout(1000);
    console.log(`  Final URL: ${page.url()}`);

    if (is404) {
      results['T-13'] = { status: 'FAIL', details: 'Route /ap/teacher/test/new returns 404 or Not Found' };
    } else {
      results['T-13'] = {
        status: titleInputs.length > 0 ? 'PASS' : 'PARTIAL',
        details: `Editor loaded. Title inputs: ${titleInputs.length}, empty: ${titleInputEmpty}. Dropdowns: ${selects}, Add Section: ${addSectionBtn}`,
        headings,
        urlFinal: page.url()
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

    const is404 = bodyText.includes('404') || bodyText.includes('Not Found');
    console.log(`  Is 404: ${is404}`);

    // Count question rows
    const questionRows = await page.locator('tr, [role="row"], li').count();
    console.log(`  Table rows/list items: ${questionRows}`);

    // Look for question type badges
    const mcqBadges = await page.locator('text=MCQ').count();
    const frqBadges = await page.locator('text=FRQ').count();
    console.log(`  MCQ badges: ${mcqBadges}, FRQ badges: ${frqBadges}`);

    // Search/filter functionality
    const searchInput = await page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i], input[placeholder*="question" i]').count();
    const filterDropdowns = await page.locator('select').count();
    console.log(`  Search inputs: ${searchInput}, filter dropdowns: ${filterDropdowns}`);

    // Create question button
    const createBtn = await page.locator('a:has-text("Create"), button:has-text("Create"), a:has-text("New Question"), button:has-text("New Question")').count();
    console.log(`  Create question buttons: ${createBtn}`);

    // Test filter - try selecting a filter
    let filterWorked = false;
    if (filterDropdowns > 0) {
      const firstSelect = await page.locator('select').first();
      const options = await firstSelect.locator('option').allTextContents();
      console.log(`  First dropdown options: ${JSON.stringify(options)}`);
      if (options.length > 1) {
        await firstSelect.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
        await screenshot(page, 'T14_02_filtered');
        filterWorked = true;
      }
    }

    // Try clicking on a question to navigate to edit
    let questionNavWorks = false;
    const editLinks = await page.locator('a[href*="/question/"], button:has-text("Edit")').all();
    console.log(`  Edit links: ${editLinks.length}`);
    if (editLinks.length > 0) {
      const href = await editLinks[0].getAttribute('href').catch(() => null);
      console.log(`  First edit link href: ${href}`);
      questionNavWorks = href && href.includes('/question/');
    }

    await screenshot(page, 'T14_03_question_bank_final');

    if (is404) {
      results['T-14'] = { status: 'FAIL', details: 'Question bank page returned 404 or Not Found' };
    } else {
      const questionsLoaded = mcqBadges > 0 || frqBadges > 0;
      results['T-14'] = {
        status: questionsLoaded ? 'PASS' : 'PARTIAL',
        details: `Questions loaded: ${questionsLoaded}. MCQ: ${mcqBadges}, FRQ: ${frqBadges}. Filters: ${filterDropdowns} dropdowns. Create btn: ${createBtn > 0}. Nav works: ${questionNavWorks}`,
        headings,
        mcqBadges,
        frqBadges,
        filterDropdowns,
        createBtn,
        filterWorked,
        questionNavWorks
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
    // First check from teacher dashboard for Assign button
    await page.goto(`${BASE_URL}/ap/teacher`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, 'T15_01_teacher_dashboard');

    // Look for Assign buttons
    const assignBtns = await page.locator('button:has-text("Assign"), a:has-text("Assign")').all();
    console.log(`  Assign buttons found: ${assignBtns.length}`);

    let assignUrl = `${BASE_URL}/ap/teacher/test/test_micro_full_1/assign`;

    if (assignBtns.length > 0) {
      const firstAssignBtn = assignBtns[0];
      const href = await firstAssignBtn.getAttribute('href').catch(() => null);
      console.log(`  First Assign button href: ${href}`);
      if (href) {
        assignUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
      }
      // Check if button is disabled (for unpublished tests)
      const isDisabled = await firstAssignBtn.isDisabled();
      console.log(`  First Assign button disabled: ${isDisabled}`);
    }

    // Navigate to assign page
    await page.goto(assignUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, 'T15_02_assign_page');

    console.log(`  URL: ${page.url()}`);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log(`  Headings: ${JSON.stringify(headings)}`);

    const is404 = bodyText.includes('404') || bodyText.includes('Not Found');
    console.log(`  Is 404: ${is404}`);

    // Check for expected content
    const hasTestTitle = bodyText.includes('Micro') || bodyText.includes('Economics') || bodyText.includes('test_micro');
    const hasClassList = bodyText.toLowerCase().includes('class') || bodyText.toLowerCase().includes('period');
    const hasDueDate = bodyText.toLowerCase().includes('due date') || bodyText.toLowerCase().includes('due');
    const hasMaxAttempts = bodyText.toLowerCase().includes('attempt') || bodyText.toLowerCase().includes('max');

    console.log(`  Has test title: ${hasTestTitle}`);
    console.log(`  Has class list: ${hasClassList}`);
    console.log(`  Has due date: ${hasDueDate}`);
    console.log(`  Has max attempts: ${hasMaxAttempts}`);

    // Check for class checkboxes
    const checkboxes = await page.locator('input[type="checkbox"]').count();
    console.log(`  Checkboxes: ${checkboxes}`);

    // Check for assign button
    const submitBtn = await page.locator('button:has-text("Assign"), button[type="submit"]').count();
    console.log(`  Submit/Assign buttons: ${submitBtn}`);

    // Try selecting a class if available
    if (checkboxes > 0) {
      await page.locator('input[type="checkbox"]').first().check();
      await page.waitForTimeout(500);
      await screenshot(page, 'T15_03_class_selected');
    }

    // Look for success feedback after assignment attempt
    // (We won't actually submit to avoid creating real assignments)

    if (is404) {
      results['T-15'] = { status: 'FAIL', details: 'Assign page returned 404 or Not Found' };
    } else {
      results['T-15'] = {
        status: (hasTestTitle || hasClassList) ? 'PASS' : 'PARTIAL',
        details: `Assign page loaded. Test title: ${hasTestTitle}, Class list: ${hasClassList}, Due date: ${hasDueDate}, Max attempts: ${hasMaxAttempts}, Checkboxes: ${checkboxes}`,
        headings,
        hasTestTitle,
        hasClassList,
        hasDueDate,
        hasMaxAttempts,
        checkboxes,
        submitBtn
      };
    }
  } catch (err) {
    console.error('  T-15 ERROR:', err.message);
    await screenshot(page, 'T15_error');
    results['T-15'] = { status: 'FAIL', details: err.message };
  }

  // ============================================================
  // Additional T-10 deep checks — class creation & student mgmt
  // ============================================================
  console.log('\n=== T-10 Deep Checks — Class CRUD ===');
  try {
    await page.goto(`${BASE_URL}/ap/teacher/classes`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const bodyText = await page.evaluate(() => document.body.innerText);

    // Try to find clickable class items
    const classButtons = await page.locator('button, [role="button"], li').all();
    const econClassBtn = await page.locator('text=AP Economics, text=Economics, text=Econ').first();
    const econVisible = await econClassBtn.isVisible().catch(() => false);
    console.log(`  Econ class element visible: ${econVisible}`);

    if (econVisible) {
      await econClassBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'T10_03_class_selected');
      const afterClickText = await page.evaluate(() => document.body.innerText);
      const hasStudentList = afterClickText.toLowerCase().includes('student') || afterClickText.includes('@');
      console.log(`  Student list visible after click: ${hasStudentList}`);

      // Check for student management (add/remove)
      const addStudentInput = await page.locator('input[placeholder*="email" i], input[placeholder*="student" i]').count();
      const removeButtons = await page.locator('button:has-text("Remove"), button:has-text("Delete")').count();
      console.log(`  Add student input: ${addStudentInput}, Remove buttons: ${removeButtons}`);

      results['T-10'].studentManagement = { hasStudentList, addStudentInput, removeButtons };
    }

    // Try to find Create Class form
    const createClassInput = await page.locator('input[placeholder*="class name" i], input[placeholder*="name" i]').all();
    console.log(`  Create class name inputs: ${createClassInput.length}`);

    if (createClassInput.length > 0) {
      await createClassInput[0].fill('AP Government Period 2');
      await page.waitForTimeout(200);
      await screenshot(page, 'T10_04_create_class_filled');
      results['T-10'].createClassForm = true;
    } else {
      results['T-10'].createClassForm = false;
    }

  } catch (err) {
    console.error('  T-10 deep checks ERROR:', err.message);
  }

  // Collect final console errors
  results.consoleErrors = consoleMessages;

  // Summary
  console.log('\n=== RESULTS SUMMARY ===');
  for (const [key, val] of Object.entries(results)) {
    if (key !== 'consoleErrors' && key !== 'findings') {
      console.log(`  ${key}: ${typeof val === 'object' ? JSON.stringify(val?.status || val) : val}`);
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
