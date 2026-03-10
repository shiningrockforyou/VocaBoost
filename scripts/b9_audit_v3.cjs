/**
 * B9 Audit Script v3 — Teacher Management & Editor
 * Uses domcontentloaded instead of networkidle to avoid Firestore listener timeouts
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
};

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`  [screenshot] ${name}.png`);
}

async function nav(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  // Extra wait for React to render
  await page.waitForTimeout(3000);
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleMessages = [];
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      const text = msg.text();
      if (!text.includes('Download the React DevTools') &&
          !text.includes('Warning: ReactDOM.render') &&
          !text.includes('[webpack]')) {
        consoleMessages.push({ type, text: text.substring(0, 200), url: page.url() });
      }
    }
  });

  // ============================================================
  // LOGIN
  // ============================================================
  console.log('\n=== LOGIN ===');
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.fill('input[type="email"]', TEACHER_EMAIL);
    await page.fill('input[type="password"]', TEACHER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    const url = page.url();
    console.log(`  Post-login URL: ${url}`);
    if (url.includes('/login')) {
      results.login = 'FAIL: still on login page';
      await browser.close();
      return results;
    }
    await screenshot(page, '00_login_success');
    results.login = 'PASS';
    console.log('  LOGIN: PASS');
  } catch (err) {
    console.error('  LOGIN FAILED:', err.message);
    results.login = `FAIL: ${err.message}`;
    await browser.close();
    return results;
  }

  // ============================================================
  // T-11: Teacher Dashboard — Seed Data Button
  // ============================================================
  console.log('\n=== T-11: Teacher Dashboard - Seed Data Button ===');
  try {
    await nav(page, `${BASE_URL}/ap/teacher`);
    await screenshot(page, 'T11_01_top');

    // Scroll to bottom for Developer Tools
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await screenshot(page, 'T11_02_bottom');

    const bodyText = await page.evaluate(() => document.body.innerText);
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log(`  URL: ${page.url()}`);
    console.log(`  Headings: ${JSON.stringify(headings)}`);

    const devToolsVisible = await page.locator('text=Developer Tools').isVisible().catch(() => false);
    const seedBtnVisible = await page.locator('button:has-text("Seed Full Test Data")').isVisible().catch(() => false);
    const seedBtnAny = await page.locator('button:has-text("Seed")').isVisible().catch(() => false);

    console.log(`  Developer Tools: ${devToolsVisible}`);
    console.log(`  Seed Full Test Data btn: ${seedBtnVisible}`);
    console.log(`  Any Seed btn: ${seedBtnAny}`);

    // Get all button texts
    const allBtnTexts = await page.locator('button').allTextContents();
    console.log(`  All buttons: ${JSON.stringify(allBtnTexts.slice(0, 20))}`);

    // Body text analysis
    const hasDevSection = bodyText.includes('Developer') || bodyText.includes('developer');
    const hasSeedText = bodyText.includes('Seed') || bodyText.includes('seed');
    console.log(`  Body has Developer: ${hasDevSection}, Seed: ${hasSeedText}`);

    if (devToolsVisible && seedBtnVisible) {
      results['T-11'] = { status: 'PASS', details: 'Developer Tools + Seed button both present at /ap/teacher' };
    } else if (seedBtnAny || hasSeedText) {
      results['T-11'] = { status: 'PARTIAL', details: `Seed-related content found but devToolsVisible=${devToolsVisible}, seedBtnVisible=${seedBtnVisible}` };
    } else {
      results['T-11'] = { status: 'FAIL', details: `Missing Developer Tools section. devTools=${devToolsVisible}, seed=${seedBtnVisible}`, headings };
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
    await nav(page, `${BASE_URL}/ap/teacher/classes`);
    await screenshot(page, 'T10_01_initial');

    const currentUrl = page.url();
    console.log(`  URL: ${currentUrl}`);

    const bodyText = await page.evaluate(() => document.body.innerText);
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log(`  Headings: ${JSON.stringify(headings)}`);
    console.log(`  Body snippet: ${bodyText.substring(0, 300)}`);

    // Detect if page routed somewhere else
    if (!currentUrl.includes('teacher') && !currentUrl.includes('class')) {
      results['T-10'] = { status: 'FAIL', details: `Redirected to: ${currentUrl}` };
    } else {
      const is404 = bodyText.includes('Page Not Found') || bodyText.includes('not found');
      const hasClassHeading = headings.some(h => /class/i.test(h));
      const hasEcon = bodyText.includes('Economics') || bodyText.includes('Econ');
      const hasCalc = bodyText.includes('Calculus') || bodyText.includes('Calc');
      const hasPeriod = bodyText.includes('Period');

      console.log(`  is404=${is404}, classHeading=${hasClassHeading}, Econ=${hasEcon}, Calc=${hasCalc}, Period=${hasPeriod}`);

      // Look for create button or form
      const createBtnCount = await page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').count();
      const allInputs = await page.locator('input').all();
      let inputDetails = [];
      for (const inp of allInputs) {
        const ph = await inp.getAttribute('placeholder').catch(() => '');
        const type = await inp.getAttribute('type').catch(() => '');
        inputDetails.push({ placeholder: ph, type });
      }
      console.log(`  Inputs found: ${JSON.stringify(inputDetails)}`);
      console.log(`  Create/New/Add buttons: ${createBtnCount}`);

      // Check if classes are shown as a list
      const listElements = await page.locator('ul li, .class-card, [class*="ClassItem"], [class*="class-item"]').count();
      console.log(`  List elements: ${listElements}`);

      // Try clicking on class items
      const classItemsVisible = hasEcon || hasCalc || hasPeriod;
      let clickedClass = false;
      let studentListVisible = false;

      if (hasEcon) {
        const econEl = await page.locator('text=Economics, text=AP Economics').first();
        try {
          await econEl.click({ timeout: 3000 });
          await page.waitForTimeout(1500);
          await screenshot(page, 'T10_03_class_detail');
          clickedClass = true;
          const afterText = await page.evaluate(() => document.body.innerText);
          studentListVisible = /student/i.test(afterText) && afterText.includes('@');
          console.log(`  After clicking class: students visible=${studentListVisible}`);
        } catch (e) {
          console.log(`  Click on class failed: ${e.message}`);
        }
      }

      // Check for student management
      const removeButtons = await page.locator('button:has-text("Remove"), button:has-text("Delete"), button:has-text("×")').count();
      const emailInputs = await page.locator('input[type="email"]').count();
      console.log(`  Remove buttons: ${removeButtons}, email inputs: ${emailInputs}`);

      await screenshot(page, 'T10_04_final');

      if (is404) {
        results['T-10'] = { status: 'FAIL', details: 'Page shows 404' };
      } else if (hasClassHeading || hasEcon || hasCalc) {
        results['T-10'] = {
          status: 'PASS',
          details: `Class manager at ${currentUrl}. Classes: Econ=${hasEcon}, Calc=${hasCalc}. Create: ${createBtnCount > 0}. Students: visible=${studentListVisible}, email-add=${emailInputs > 0}, remove=${removeButtons > 0}`,
          headings, hasEcon, hasCalc, createBtnCount, studentListVisible, emailInputs, removeButtons, clickedClass,
        };
      } else {
        results['T-10'] = {
          status: 'PARTIAL',
          details: `Page loaded at ${currentUrl} but no class content found. Headings: ${JSON.stringify(headings)}`,
          bodySnippet: bodyText.substring(0, 400),
        };
      }
    }
  } catch (err) {
    console.error('  T-10 ERROR:', err.message);
    await screenshot(page, 'T10_error');
    results['T-10'] = { status: 'FAIL', details: err.message };
  }

  // ============================================================
  // T-12: Test Editor — View Existing Test
  // ============================================================
  console.log('\n=== T-12: Test Editor - View Existing Test ===');
  try {
    // Check teacher dashboard for Edit buttons
    await nav(page, `${BASE_URL}/ap/teacher`);
    await screenshot(page, 'T12_01_dashboard');

    const editLinks = await page.locator('a[href*="/edit"]').all();
    console.log(`  Edit links on dashboard: ${editLinks.length}`);
    for (let i = 0; i < Math.min(editLinks.length, 3); i++) {
      const href = await editLinks[i].getAttribute('href').catch(() => '');
      const text = await editLinks[i].textContent().catch(() => '');
      console.log(`  Edit link ${i}: href="${href}", text="${text?.trim()}"`);
    }

    // Navigate to editor directly with known test ID
    await nav(page, `${BASE_URL}/ap/teacher/test/test_micro_full_1/edit`);
    await screenshot(page, 'T12_02_editor');

    const currentUrl = page.url();
    console.log(`  URL: ${currentUrl}`);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log(`  Headings: ${JSON.stringify(headings)}`);
    console.log(`  Body snippet: ${bodyText.substring(0, 400)}`);

    const is404 = bodyText.includes('Page Not Found') || bodyText.includes('not found');
    const urlOk = currentUrl.includes('/edit') && currentUrl.includes('test_micro_full_1');
    console.log(`  is404=${is404}, URL ok=${urlOk}`);

    // Check editor form fields
    const allInputs = await page.locator('input').all();
    let titleInputFound = false;
    let titleValue = '';
    for (const inp of allInputs) {
      const val = await inp.inputValue().catch(() => '');
      const placeholder = await inp.getAttribute('placeholder').catch(() => '');
      if (val.length > 3 || (placeholder && /title|name|test/i.test(placeholder))) {
        titleInputFound = true;
        titleValue = val;
        console.log(`  Likely title input: val="${val}", placeholder="${placeholder}"`);
        break;
      }
    }

    const subjectSelects = await page.locator('select').count();
    const sectionText = await page.locator(':text("Section")').count();
    console.log(`  Selects: ${subjectSelects}, Section texts: ${sectionText}`);

    // Check for question list
    const mcqTexts = await page.locator(':text("MCQ")').count();
    const frqTexts = await page.locator(':text("FRQ")').count();
    console.log(`  MCQ refs: ${mcqTexts}, FRQ refs: ${frqTexts}`);

    // Look for reorder buttons
    const moveUpBtns = await page.locator('button[title*="up" i], button[aria-label*="up" i], button:has-text("↑"), button:has-text("▲"), button:has-text("Move Up")').count();
    const moveDownBtns = await page.locator('button[title*="down" i], button[aria-label*="down" i], button:has-text("↓"), button:has-text("▼"), button:has-text("Move Down")').count();
    console.log(`  Move Up: ${moveUpBtns}, Move Down: ${moveDownBtns}`);

    // Save/Publish buttons
    const saveDraft = await page.locator('button:has-text("Save Draft"), button:has-text("Save draft")').count();
    const publishBtn = await page.locator('button:has-text("Publish"), button:has-text("Save and Publish")').count();
    console.log(`  Save Draft: ${saveDraft}, Publish: ${publishBtn}`);

    // All button texts for analysis
    const allBtns = await page.locator('button').allTextContents();
    console.log(`  All buttons: ${JSON.stringify(allBtns.slice(0, 20))}`);

    await screenshot(page, 'T12_03_editor_detail');

    if (is404) {
      results['T-12'] = { status: 'FAIL', details: `Test editor 404 at ${currentUrl}` };
    } else {
      const editorLoaded = (titleInputFound && titleValue.length > 0) || subjectSelects > 0 || sectionText > 0;
      results['T-12'] = {
        status: editorLoaded ? 'PASS' : 'PARTIAL',
        details: `Editor at ${currentUrl}. Title="${titleValue}", selects=${subjectSelects}, sections=${sectionText}, MCQ=${mcqTexts}, FRQ=${frqTexts}. Reorder Up/Down: ${moveUpBtns}/${moveDownBtns}. Save/Publish: ${saveDraft}/${publishBtn}`,
        headings, titleValue, subjectSelects, sectionText, mcqTexts, frqTexts, moveUpBtns, moveDownBtns, saveDraft, publishBtn,
      };
    }
  } catch (err) {
    console.error('  T-12 ERROR:', err.message);
    await screenshot(page, 'T12_error');
    results['T-12'] = { status: 'FAIL', details: err.message };
  }

  // ============================================================
  // T-13: Test Editor — Create New Test
  // ============================================================
  console.log('\n=== T-13: Test Editor - Create New Test ===');
  try {
    await nav(page, `${BASE_URL}/ap/teacher/test/new`);
    await screenshot(page, 'T13_01_new');

    const currentUrl = page.url();
    console.log(`  URL: ${currentUrl}`);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log(`  Headings: ${JSON.stringify(headings)}`);
    console.log(`  Body snippet: ${bodyText.substring(0, 400)}`);

    const is404 = bodyText.includes('Page Not Found') || bodyText.includes('not found');
    // The route might auto-redirect to a new testId
    const urlIsTeacherTest = currentUrl.includes('/teacher/test/');
    console.log(`  is404=${is404}, URL in teacher/test: ${urlIsTeacherTest}`);

    // Inspect inputs
    const allInputs = await page.locator('input').all();
    let titleInputFound = false;
    let titleValue = '';
    let inputDetails = [];
    for (const inp of allInputs) {
      const val = await inp.inputValue().catch(() => '');
      const placeholder = await inp.getAttribute('placeholder').catch(() => '');
      const type = await inp.getAttribute('type').catch(() => 'text');
      inputDetails.push({ val, placeholder, type });
      if (/title|name|test/i.test(placeholder) || (type === 'text' && val === '')) {
        titleInputFound = true;
        titleValue = val;
      }
    }
    console.log(`  All inputs: ${JSON.stringify(inputDetails)}`);

    const subjectSelects = await page.locator('select').count();
    const addSectionBtns = await page.locator('button:has-text("Section"), button:has-text("Add"), button:has-text("+ Add")').count();
    const allBtns = await page.locator('button').allTextContents();
    console.log(`  Selects: ${subjectSelects}, Add section-ish btns: ${addSectionBtns}`);
    console.log(`  All buttons: ${JSON.stringify(allBtns.slice(0, 20))}`);

    // Check if URL changed after load (auto-redirect to new ID)
    await page.waitForTimeout(2000);
    const finalUrl = page.url();
    console.log(`  Final URL: ${finalUrl}`);

    if (is404) {
      results['T-13'] = { status: 'FAIL', details: `Route /ap/teacher/test/new returns 404. Body: ${bodyText.substring(0, 200)}` };
    } else if (!urlIsTeacherTest) {
      results['T-13'] = { status: 'FAIL', details: `Unexpected redirect from /ap/teacher/test/new to ${currentUrl}` };
    } else {
      results['T-13'] = {
        status: (allInputs.length > 0 || subjectSelects > 0) ? 'PASS' : 'PARTIAL',
        details: `New test editor at ${finalUrl}. Inputs: ${inputDetails.length}, selects: ${subjectSelects}, section btns: ${addSectionBtns}`,
        headings, inputDetails, subjectSelects, addSectionBtns, finalUrl,
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
    await nav(page, `${BASE_URL}/ap/teacher/questions`);
    await screenshot(page, 'T14_01_question_bank');

    const currentUrl = page.url();
    console.log(`  URL: ${currentUrl}`);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log(`  Headings: ${JSON.stringify(headings)}`);
    console.log(`  Body snippet: ${bodyText.substring(0, 400)}`);

    const is404 = bodyText.includes('Page Not Found') || bodyText.includes('not found');
    console.log(`  is404=${is404}`);

    // Count question type indicators
    const mcqCount = (bodyText.match(/\bMCQ\b/g) || []).length;
    const frqCount = (bodyText.match(/\bFRQ\b/g) || []).length;
    console.log(`  MCQ occurrences: ${mcqCount}, FRQ occurrences: ${frqCount}`);

    // Table rows
    const trCount = await page.locator('tr').count();
    const tbodyTrCount = await page.locator('tbody tr').count();
    console.log(`  tr total: ${trCount}, tbody tr: ${tbodyTrCount}`);

    // Filters
    const searchInput = await page.locator('input[type="search"], input[placeholder*="search" i]').count();
    const allSelects = await page.locator('select').count();
    console.log(`  Search: ${searchInput}, selects: ${allSelects}`);

    // Get select options to understand filter types
    const selectDetails = [];
    const selectEls = await page.locator('select').all();
    for (const sel of selectEls) {
      const options = await sel.locator('option').allTextContents();
      const name = await sel.getAttribute('name').catch(() => '');
      selectDetails.push({ name, options: options.slice(0, 6) });
    }
    console.log(`  Select details: ${JSON.stringify(selectDetails)}`);

    // Create question button
    const createLinks = await page.locator('a[href*="question/new"], a[href*="/new"]').count();
    const createBtns = await page.locator('button:has-text("Create"), button:has-text("New Question"), a:has-text("Create Question"), a:has-text("New Question")').count();
    console.log(`  Create links: ${createLinks}, create btns: ${createBtns}`);

    // Preview buttons
    const previewBtns = await page.locator('button:has-text("Preview")').count();
    console.log(`  Preview buttons: ${previewBtns}`);

    // Edit links
    const editLinks = await page.locator('a[href*="/question/"]').all();
    let firstEditHref = null;
    if (editLinks.length > 0) {
      firstEditHref = await editLinks[0].getAttribute('href').catch(() => null);
    }
    console.log(`  Edit links: ${editLinks.length}, first href: ${firstEditHref}`);

    // Test filter if available
    let filterChanged = false;
    if (allSelects > 0) {
      const rowsBefore = await page.locator('tbody tr').count();
      const firstSel = await page.locator('select').first();
      const opts = await firstSel.locator('option').allTextContents();
      if (opts.length > 1) {
        await firstSel.selectOption({ index: 1 });
        await page.waitForTimeout(1500);
        const rowsAfter = await page.locator('tbody tr').count();
        console.log(`  Rows before filter: ${rowsBefore}, after: ${rowsAfter}`);
        filterChanged = rowsBefore !== rowsAfter || rowsBefore > 0;
        await screenshot(page, 'T14_02_filtered');
      }
    }

    // Check for bulk select checkbox
    const checkboxes = await page.locator('input[type="checkbox"]').count();
    console.log(`  Checkboxes: ${checkboxes}`);

    // Navigate to question edit page
    let questionEditNavWorks = false;
    if (firstEditHref) {
      await nav(page, firstEditHref.startsWith('http') ? firstEditHref : `${BASE_URL}${firstEditHref}`);
      await screenshot(page, 'T14_03_question_edit');
      questionEditNavWorks = !page.url().includes('/login') && !page.url().includes('not-found');
      console.log(`  Question edit URL: ${page.url()}, nav works: ${questionEditNavWorks}`);
      await page.goBack();
      await page.waitForTimeout(1000);
    }

    await screenshot(page, 'T14_04_final');

    if (is404) {
      results['T-14'] = { status: 'FAIL', details: 'Question bank returned 404' };
    } else {
      const hasQuestions = mcqCount > 0 || frqCount > 0 || tbodyTrCount > 0;
      results['T-14'] = {
        status: hasQuestions ? 'PASS' : 'PARTIAL',
        details: `Questions: MCQ=${mcqCount}, FRQ=${frqCount}, rows=${tbodyTrCount}. Filters: ${allSelects} selects, ${searchInput} search. Create: ${createLinks + createBtns > 0}. Preview: ${previewBtns}. Nav: ${questionEditNavWorks}`,
        headings, mcqCount, frqCount, tbodyTrCount, allSelects, searchInput, createLinks, createBtns, previewBtns, editLinks: editLinks.length, filterChanged, questionEditNavWorks,
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
    // Check teacher dashboard for Assign buttons
    await nav(page, `${BASE_URL}/ap/teacher`);
    await screenshot(page, 'T15_01_dashboard');

    const assignBtns = await page.locator('button:has-text("Assign"), a:has-text("Assign")').all();
    console.log(`  Assign buttons on dashboard: ${assignBtns.length}`);

    let assignBtnDisabled = null;
    let dashboardAssignHref = null;
    if (assignBtns.length > 0) {
      assignBtnDisabled = await assignBtns[0].isDisabled().catch(() => null);
      dashboardAssignHref = await assignBtns[0].getAttribute('href').catch(() => null);
      console.log(`  First Assign btn: disabled=${assignBtnDisabled}, href=${dashboardAssignHref}`);
    }

    // Navigate to assign page
    await nav(page, `${BASE_URL}/ap/teacher/test/test_micro_full_1/assign`);
    await screenshot(page, 'T15_02_assign_page');

    const currentUrl = page.url();
    console.log(`  URL: ${currentUrl}`);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log(`  Headings: ${JSON.stringify(headings)}`);
    console.log(`  Body snippet: ${bodyText.substring(0, 500)}`);

    const is404 = bodyText.includes('Page Not Found') || bodyText.includes('not found');
    const staysOnAssign = currentUrl.includes('/assign');
    console.log(`  is404=${is404}, stays on assign: ${staysOnAssign}`);

    // Content checks
    const hasTestTitle = bodyText.includes('Micro') || bodyText.includes('Economics') || bodyText.toLowerCase().includes('assign');
    const hasClassSection = bodyText.toLowerCase().includes('class') || bodyText.includes('Period');
    const hasDueDate = bodyText.toLowerCase().includes('due');
    const hasAttempts = bodyText.toLowerCase().includes('attempt');
    const hasFrqMode = bodyText.toLowerCase().includes('frq') || bodyText.toLowerCase().includes('handwritten') || bodyText.toLowerCase().includes('typed');
    console.log(`  Content: test=${hasTestTitle}, class=${hasClassSection}, due=${hasDueDate}, attempts=${hasAttempts}, frqMode=${hasFrqMode}`);

    // Form elements
    const checkboxes = await page.locator('input[type="checkbox"]').count();
    const dateInputs = await page.locator('input[type="date"]').count();
    const numberInputs = await page.locator('input[type="number"]').count();
    const allSelects = await page.locator('select').count();
    const submitBtns = await page.locator('button:has-text("Assign"), button[type="submit"], button:has-text("Submit")').count();
    console.log(`  Form: checkboxes=${checkboxes}, date=${dateInputs}, number=${numberInputs}, selects=${allSelects}, submit=${submitBtns}`);

    // Get all button texts
    const allBtns = await page.locator('button').allTextContents();
    console.log(`  All buttons: ${JSON.stringify(allBtns)}`);

    // Test checkbox interaction
    let classSelected = false;
    if (checkboxes > 0) {
      await page.locator('input[type="checkbox"]').first().check().catch(() => {});
      await page.waitForTimeout(500);
      classSelected = true;
      await screenshot(page, 'T15_03_class_checked');
      // Look for dynamic count in button text
      const dynamicBtn = await page.locator('button:has-text("Assign to")').first();
      const dynamicBtnText = await dynamicBtn.textContent().catch(() => '');
      console.log(`  Dynamic assign btn text: "${dynamicBtnText}"`);
    }

    // Check max attempts default
    let defaultMaxAttempts = null;
    const maxAttemptsEl = await page.locator('select[name*="attempt" i], select[name*="max" i]').first();
    if (await maxAttemptsEl.isVisible().catch(() => false)) {
      defaultMaxAttempts = await maxAttemptsEl.inputValue().catch(() => null);
      console.log(`  Default max attempts: ${defaultMaxAttempts}`);
    }

    await screenshot(page, 'T15_04_final');

    if (is404) {
      results['T-15'] = { status: 'FAIL', details: 'Assign page returned 404' };
    } else if (!staysOnAssign) {
      results['T-15'] = { status: 'FAIL', details: `Redirected from assign to: ${currentUrl}` };
    } else {
      const assignLoaded = hasTestTitle || hasClassSection;
      results['T-15'] = {
        status: assignLoaded ? 'PASS' : 'PARTIAL',
        details: `Assign page at ${currentUrl}. Test: ${hasTestTitle}, Classes: ${hasClassSection}, Due: ${hasDueDate}, Attempts: ${hasAttempts}, FRQ mode: ${hasFrqMode}. Form: ${checkboxes} checkboxes, ${dateInputs} date, ${allSelects} selects, ${submitBtns} submit. MaxAttempts default: ${defaultMaxAttempts}`,
        headings, hasTestTitle, hasClassSection, hasDueDate, hasAttempts, hasFrqMode, checkboxes, dateInputs, allSelects, submitBtns, defaultMaxAttempts, assignBtnDisabled,
      };
    }
  } catch (err) {
    console.error('  T-15 ERROR:', err.message);
    await screenshot(page, 'T15_error');
    results['T-15'] = { status: 'FAIL', details: err.message };
  }

  // Collect errors
  results.consoleErrors = consoleMessages;

  console.log('\n=== RESULTS SUMMARY ===');
  for (const [key, val] of Object.entries(results)) {
    if (key !== 'consoleErrors') {
      const status = typeof val === 'object' ? val?.status : val;
      console.log(`  ${key}: ${status}`);
    }
  }
  console.log(`  Console errors: ${consoleMessages.length}`);
  consoleMessages.slice(0, 20).forEach(m => console.log(`    [${m.type}] ${m.url}: ${m.text.substring(0, 120)}`));

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
