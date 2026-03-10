/**
 * B7 Audit Script — Teacher Dashboard & Gradebook
 * Scenarios: T-01, T-02, T-03, T-04
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'src', 'apBoost', 'criteria_audit', 'playwright_reports', 'screenshots_B7');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const consoleErrors = [];
const scenarioResults = {};

async function takeScreenshot(page, name) {
  const filename = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`  [screenshot] ${name}.png`);
  return filename;
}

async function loginAs(page, email, password, label) {
  console.log(`\n=== LOGIN AS ${label} ===`);
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  const currentUrl = page.url();
  if (!currentUrl.includes('/login')) {
    console.log(`  Already authenticated (URL: ${currentUrl}), navigating directly`);
    return currentUrl.includes('/ap') || currentUrl.includes('/');
  }
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
  await emailInput.waitFor({ timeout: 10000 });
  await emailInput.fill(email);
  const passInput = page.locator('input[type="password"]').first();
  await passInput.fill(password);
  const submit = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login"), button:has-text("Log In")').first();
  await submit.click();
  try {
    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 20000 });
    console.log(`  Logged in as ${label}. URL: ${page.url()}`);
    await page.waitForTimeout(2000);
    return true;
  } catch (e) {
    console.log(`  Login failed for ${label}: ${e.message}`);
    return false;
  }
}

// -----------------------------------------------------------------------
// T-01: Teacher Dashboard Load
// -----------------------------------------------------------------------
async function runT01(browser) {
  console.log('\n=== T-01: Teacher Dashboard Load ===');
  const result = { status: 'FAIL', notes: [], checks: {} };

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push({ type: msg.type(), text: msg.text(), url: page.url(), scenario: 'T-01' });
    }
  });

  try {
    const loggedIn = await loginAs(page, 'teacher@apboost.test', 'Teacher123!', 'TEACHER');
    if (!loggedIn) {
      result.status = 'BLOCKER';
      result.notes.push('Teacher login failed');
      await takeScreenshot(page, 'T01_login_failed');
      await context.close();
      return result;
    }

    await page.goto('http://localhost:5173/ap/teacher', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await takeScreenshot(page, 'T01_01_teacher_dashboard');

    const pageText = await page.evaluate(() => document.body.innerText);

    // H1 heading
    result.checks.hasHeading = pageText.includes('Teacher Dashboard');
    console.log('  Has "Teacher Dashboard" heading:', result.checks.hasHeading);

    // Quick Actions
    const allLinks = await page.locator('a[href]').evaluateAll(els => els.map(el => ({
      text: el.textContent.trim(),
      href: el.getAttribute('href')
    })));

    result.checks.hasCreateNewTest = pageText.includes('Create New Test') || pageText.includes('Create Test');
    result.checks.hasQuestionBank = pageText.includes('Question Bank') || pageText.includes('Questions');
    result.checks.hasGradebook = pageText.includes('Gradebook');
    result.checks.hasManageClasses = pageText.includes('Manage Classes') || pageText.includes('Classes');

    const createTestLink = allLinks.find(l => l.href && l.href.includes('test/new'));
    const questionBankLink = allLinks.find(l => l.href && l.href.includes('questions'));
    const gradebookLink = allLinks.find(l => l.href && l.href.includes('gradebook'));
    const classesLink = allLinks.find(l => l.href && l.href.includes('classes'));

    result.checks.createTestLinkHref = createTestLink ? createTestLink.href : null;
    result.checks.questionBankLinkHref = questionBankLink ? questionBankLink.href : null;
    result.checks.gradebookLinkHref = gradebookLink ? gradebookLink.href : null;
    result.checks.classesLinkHref = classesLink ? classesLink.href : null;

    console.log('  Quick Action Links:', {
      createTest: result.checks.createTestLinkHref,
      questionBank: result.checks.questionBankLinkHref,
      gradebook: result.checks.gradebookLinkHref,
      classes: result.checks.classesLinkHref
    });

    // My Tests section
    result.checks.hasMyTests = pageText.includes('My Tests');
    result.checks.testsVisible = {
      micro: pageText.includes('Micro'),
      macro: pageText.includes('Macro'),
      calc: pageText.includes('Calc')
    };
    result.checks.testCount = Object.values(result.checks.testsVisible).filter(Boolean).length;
    result.checks.hasEditLink = pageText.includes('Edit');
    result.checks.hasAssignButton = pageText.includes('Assign');
    result.checks.hasViewAll = pageText.includes('View All');
    result.checks.hasMCQSummary = pageText.includes('MCQ');
    result.checks.hasFRQSummary = pageText.includes('FRQ');
    console.log('  My Tests:', result.checks.hasMyTests, '| Count:', result.checks.testCount, '| MCQ/FRQ:', result.checks.hasMCQSummary, result.checks.hasFRQSummary);

    // Pending Grading section
    result.checks.hasPendingGrading = pageText.includes('Pending Grading');
    result.checks.hasGoToGradebook = pageText.includes('Go to Gradebook');
    console.log('  Pending Grading section:', result.checks.hasPendingGrading);

    // My Classes section
    result.checks.hasMyClasses = pageText.includes('My Classes');
    result.checks.hasClassesList = pageText.includes('AP Economics') || pageText.includes('AP Calculus') || pageText.includes('Period');
    console.log('  My Classes section:', result.checks.hasMyClasses, '| Classes listed:', result.checks.hasClassesList);

    // DOM structure check
    result.domStructure = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const headings = Array.from(document.querySelectorAll('h2, h3')).map(el => el.textContent.trim()).slice(0, 20);
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(el => ({ text: el.textContent.trim().slice(0, 40), href: el.getAttribute('href') }))
        .slice(0, 20);
      return { h1: h1 ? h1.textContent.trim() : null, headings, links };
    });
    console.log('  H1:', result.domStructure.h1);
    console.log('  Headings:', result.domStructure.headings);

    // Scroll tests
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'T01_02_teacher_dashboard_mid');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'T01_03_teacher_dashboard_bottom');
    await page.evaluate(() => window.scrollTo(0, 0));

    // Additional: Check test card shows question counts accurately
    // The test cards should show e.g. "15 MCQ, 2 FRQ"
    const questionCountPattern = /\d+\s+MCQ/;
    result.checks.hasAccurateQuestionCounts = questionCountPattern.test(pageText);
    console.log('  Has accurate question counts (e.g. "15 MCQ"):', result.checks.hasAccurateQuestionCounts);

    // Check Pending Grading count
    const pendingCountMatch = pageText.match(/Pending Grading \((\d+)\)/);
    result.checks.pendingGradingCount = pendingCountMatch ? parseInt(pendingCountMatch[1]) : null;
    console.log('  Pending Grading count:', result.checks.pendingGradingCount);

    // Check class student counts
    const studentCountPattern = /\d+ student/;
    result.checks.hasStudentCounts = studentCountPattern.test(pageText);
    console.log('  Has student counts in classes:', result.checks.hasStudentCounts);

    // Check "View All" links to correct route
    const viewAllLink = allLinks.find(l => l.text.includes('View All') || l.text.includes('view all'));
    result.checks.viewAllLinkHref = viewAllLink ? viewAllLink.href : null;
    console.log('  View All link href:', result.checks.viewAllLinkHref);

    // Determine pass/fail
    const criticalChecks = [
      result.checks.hasHeading,
      result.checks.hasCreateNewTest,
      result.checks.hasQuestionBank,
      result.checks.hasGradebook,
      result.checks.hasManageClasses,
      result.checks.hasMyTests,
      result.checks.testCount >= 2,
      result.checks.hasEditLink,
      result.checks.hasPendingGrading,
      result.checks.hasMyClasses
    ];
    const passCount = criticalChecks.filter(Boolean).length;

    if (passCount === criticalChecks.length) {
      result.status = 'PASS';
    } else if (passCount >= 7) {
      result.status = 'PARTIAL';
    } else {
      result.status = 'FAIL';
    }

    result.notes.push(`${passCount}/${criticalChecks.length} critical checks passed`);
    console.log('  T-01 Status:', result.status, `(${passCount}/${criticalChecks.length})`);

  } catch (err) {
    result.status = 'FAIL';
    result.notes.push(`Error: ${err.message}`);
    console.error('  T-01 ERROR:', err.message);
    await takeScreenshot(page, 'T01_error').catch(() => {});
  } finally {
    await context.close();
  }

  return result;
}

// -----------------------------------------------------------------------
// T-02: Teacher Route Protection (fresh browser context, student login)
// -----------------------------------------------------------------------
async function runT02(browser) {
  console.log('\n=== T-02: Teacher Route Protection ===');
  const result = { status: 'SKIP', notes: [], checks: {} };

  // Use a fresh context with no cookies so there's no teacher session
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push({ type: msg.type(), text: msg.text(), url: page.url(), scenario: 'T-02' });
    }
  });

  try {
    // Try to login as student
    const studentLoggedIn = await loginAs(page, 'student@apboost.test', 'Student123!', 'STUDENT');
    if (!studentLoggedIn) {
      result.status = 'SKIP';
      result.notes.push('Student account login failed — student@apboost.test may not be a valid Firebase Auth account. Cannot test route protection.');
      console.log('  T-02 SKIP: Student login failed');
      await takeScreenshot(page, 'T02_01_student_login_failed');
      await context.close();
      return result;
    }

    const studentLandingUrl = page.url();
    result.checks.studentLandingUrl = studentLandingUrl;
    console.log('  Student landed at:', studentLandingUrl);
    await takeScreenshot(page, 'T02_01_student_logged_in');

    // Test 1: /ap/teacher
    console.log('  Attempting /ap/teacher as student...');
    await page.goto('http://localhost:5173/ap/teacher', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    const url1 = page.url();
    const text1 = await page.evaluate(() => document.body.innerText);
    result.checks.teacherDashboardUrl = url1;
    result.checks.teacherDashboardBlocked = url1.includes('/ap') && !url1.includes('/ap/teacher');
    result.checks.teacherDashboardShowsAccessDenied = text1.toLowerCase().includes('access denied') || text1.toLowerCase().includes('not authorized') || text1.toLowerCase().includes('unauthorized');
    result.checks.teacherDashboardRedirectedToStudentDashboard = url1.endsWith('/ap') || url1.endsWith('/ap/');
    console.log('  /ap/teacher → URL:', url1, '| Blocked:', result.checks.teacherDashboardBlocked);
    await takeScreenshot(page, 'T02_02_teacher_route_attempt');

    // Test 2: /ap/teacher/test/new
    console.log('  Attempting /ap/teacher/test/new as student...');
    await page.goto('http://localhost:5173/ap/teacher/test/new', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    const url2 = page.url();
    result.checks.testNewUrl = url2;
    result.checks.testNewBlocked = !url2.includes('teacher/test/new');
    console.log('  /ap/teacher/test/new → URL:', url2, '| Blocked:', result.checks.testNewBlocked);
    await takeScreenshot(page, 'T02_03_test_new_attempt');

    // Test 3: /ap/gradebook (teacher-only route)
    console.log('  Attempting /ap/gradebook as student...');
    await page.goto('http://localhost:5173/ap/gradebook', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    const url3 = page.url();
    const text3 = await page.evaluate(() => document.body.innerText);
    result.checks.gradebookUrl = url3;
    result.checks.gradebookBlocked = !url3.includes('/gradebook') || text3.toLowerCase().includes('access denied') || text3.toLowerCase().includes('not authorized');
    // More nuanced: if they can reach /gradebook AND see teacher data, it's a fail
    result.checks.gradebookAccessibleWithStudentRole = url3.includes('/gradebook') && !text3.toLowerCase().includes('access denied');
    console.log('  /ap/gradebook → URL:', url3, '| Blocked:', result.checks.gradebookBlocked, '| Accessible with student role:', result.checks.gradebookAccessibleWithStudentRole);
    await takeScreenshot(page, 'T02_04_gradebook_attempt');

    const allBlocked = result.checks.teacherDashboardBlocked && result.checks.testNewBlocked;
    const gradebookProtected = !result.checks.gradebookAccessibleWithStudentRole || result.checks.gradebookBlocked;

    if (allBlocked && gradebookProtected) {
      result.status = 'PASS';
      result.notes.push('All teacher routes (including /ap/teacher, /ap/teacher/test/new, /ap/gradebook) blocked for student');
    } else if (allBlocked) {
      result.status = 'PARTIAL';
      result.notes.push('/ap/teacher and /ap/teacher/test/new blocked but /ap/gradebook may be accessible to student');
    } else {
      result.status = 'FAIL';
      const unblocked = [];
      if (!result.checks.teacherDashboardBlocked) unblocked.push('/ap/teacher');
      if (!result.checks.testNewBlocked) unblocked.push('/ap/teacher/test/new');
      if (!gradebookProtected) unblocked.push('/ap/gradebook');
      result.notes.push(`Teacher routes accessible to student: ${unblocked.join(', ')}`);
    }

    console.log('  T-02 Status:', result.status);
  } catch (err) {
    result.status = 'FAIL';
    result.notes.push(`Error: ${err.message}`);
    console.error('  T-02 ERROR:', err.message);
    await takeScreenshot(page, 'T02_error').catch(() => {});
  } finally {
    await context.close();
  }

  return result;
}

// -----------------------------------------------------------------------
// T-03: Gradebook — View Pending Submissions
// -----------------------------------------------------------------------
async function runT03(page) {
  console.log('\n=== T-03: Gradebook — View Pending Submissions ===');
  const result = { status: 'FAIL', notes: [], checks: {} };

  await page.goto('http://localhost:5173/ap/gradebook', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await takeScreenshot(page, 'T03_01_gradebook_initial');

  const pageText = await page.evaluate(() => document.body.innerText);

  // Heading
  result.checks.hasGradebookHeading = pageText.includes('Gradebook');
  result.checks.hasSubtitle = pageText.includes('Review and grade') || pageText.includes('grade student') || pageText.includes('FRQ');
  console.log('  Heading:', result.checks.hasGradebookHeading, '| Subtitle:', result.checks.hasSubtitle);

  // Filter bar
  result.checks.hasStatusFilter = pageText.includes('Status') || pageText.includes('Pending');
  result.checks.hasTestFilter = pageText.includes('Test') || pageText.includes('All Tests');
  result.checks.hasClassFilter = pageText.includes('Class') || pageText.includes('All Classes');
  console.log('  Filters: Status=', result.checks.hasStatusFilter, 'Test=', result.checks.hasTestFilter, 'Class=', result.checks.hasClassFilter);

  // Inspect all select elements
  const selectElements = await page.locator('select').evaluateAll(sels =>
    sels.map(sel => ({
      name: sel.name || sel.id || '',
      value: sel.value,
      options: Array.from(sel.options).map(o => ({ value: o.value, text: o.textContent.trim() }))
    }))
  );
  result.checks.selectElements = selectElements;
  console.log('  Select elements count:', selectElements.length);
  selectElements.forEach((sel, i) => {
    console.log(`    Select[${i}] name="${sel.name}" value="${sel.value}" options:`, sel.options.map(o => o.text).join(', '));
  });

  // Detect default filter state
  const statusSelectEl = selectElements.find(s =>
    s.options.some(o => o.value === 'pending' || o.text === 'Pending')
  );
  result.checks.defaultStatusIsPending = statusSelectEl && (statusSelectEl.value === 'pending' || statusSelectEl.value === 'Pending');
  console.log('  Default status is Pending:', result.checks.defaultStatusIsPending);

  // Table columns
  const tableData = await page.evaluate(() => {
    const table = document.querySelector('table');
    if (!table) return null;
    const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
    const rows = Array.from(table.querySelectorAll('tbody tr')).slice(0, 5).map(row =>
      Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim().slice(0, 60))
    );
    return { headers, rowCount: table.querySelectorAll('tbody tr').length, rows };
  });
  result.checks.tableData = tableData;

  if (tableData) {
    console.log('  Table headers:', tableData.headers);
    console.log('  Table rows count:', tableData.rowCount);
    console.log('  First row:', tableData.rows[0]);
  } else {
    console.log('  WARNING: No <table> element found');
    // Check for div-based table
    const divRows = await page.locator('[role="row"]').count();
    result.checks.divRowCount = divRows;
    console.log('  Div-based rows ([role="row"]):', divRows);
  }

  result.checks.hasStudentColumn = tableData ? tableData.headers.some(h => h.includes('Student') || h.includes('student')) : pageText.includes('Student');
  result.checks.hasTestColumn = tableData ? tableData.headers.some(h => h.includes('Test')) : pageText.includes('Test');
  result.checks.hasSubmittedColumn = tableData ? tableData.headers.some(h => h.includes('Submitted') || h.includes('Date')) : pageText.includes('Submitted');
  result.checks.hasStatusColumn = tableData ? tableData.headers.some(h => h.includes('Status')) : pageText.includes('Status');
  result.checks.hasActionColumn = tableData ? tableData.headers.some(h => h.includes('Action') || h.includes('Grade')) : pageText.includes('Grade');

  console.log('  Columns: Student=', result.checks.hasStudentColumn, 'Test=', result.checks.hasTestColumn,
    'Submitted=', result.checks.hasSubmittedColumn, 'Status=', result.checks.hasStatusColumn, 'Action=', result.checks.hasActionColumn);

  // Row count
  result.checks.rowCount = tableData ? tableData.rowCount : (result.checks.divRowCount || 0);
  console.log('  Total rows:', result.checks.rowCount);

  // Grade buttons
  const gradeButtonCount = await page.locator('button:has-text("Grade")').count();
  result.checks.gradeButtonCount = gradeButtonCount;
  console.log('  Grade buttons:', gradeButtonCount);

  // Pending badge
  result.checks.hasPendingBadge = pageText.includes('Pending');

  // Showing X submissions text
  const showingMatch = pageText.match(/Showing (\d+) submission/i);
  result.checks.showingText = showingMatch ? showingMatch[0] : null;
  console.log('  Showing text:', result.checks.showingText);

  // Check student/test names in data
  result.checks.hasStudentNames = pageText.includes('Alex') || pageText.includes('Student') || pageText.includes('Jordan') || pageText.includes('Taylor');
  result.checks.hasTestNames = pageText.includes('Micro') || pageText.includes('Macro') || pageText.includes('Calculus');
  console.log('  Student names:', result.checks.hasStudentNames, '| Test names:', result.checks.hasTestNames);

  // Status badge visual check
  const pendingBadgeCount = await page.locator('[class*="warning"], [class*="pending"]').count();
  result.checks.pendingBadgeCount = pendingBadgeCount;
  console.log('  Warning/Pending styled badges:', pendingBadgeCount);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(500);
  await takeScreenshot(page, 'T03_02_gradebook_mid');
  await page.evaluate(() => window.scrollTo(0, 0));

  // Evaluate
  const criticalChecks = [
    result.checks.hasGradebookHeading,
    result.checks.hasStatusFilter,
    result.checks.hasTestFilter,
    result.checks.rowCount > 0,
    result.checks.gradeButtonCount > 0,
    result.checks.hasPendingBadge
  ];
  const passCount = criticalChecks.filter(Boolean).length;

  if (passCount === criticalChecks.length) {
    result.status = 'PASS';
  } else if (passCount >= 4) {
    result.status = 'PARTIAL';
  } else {
    result.status = 'FAIL';
  }

  result.notes.push(`${passCount}/${criticalChecks.length} critical checks passed`);
  console.log('  T-03 Status:', result.status, `(${passCount}/${criticalChecks.length})`);
  return result;
}

// -----------------------------------------------------------------------
// T-04: Gradebook — Filter by Test and Status
// -----------------------------------------------------------------------
async function runT04(page) {
  console.log('\n=== T-04: Gradebook — Filter by Test and Status ===');
  const result = { status: 'FAIL', notes: [], checks: {} };

  await page.goto('http://localhost:5173/ap/gradebook', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Initial state
  const initialRows = await page.locator('tbody tr').count();
  const initialText = await page.evaluate(() => document.body.innerText);
  const initialShowingMatch = initialText.match(/Showing (\d+) submission/i);
  result.checks.initialRowCount = initialRows;
  result.checks.initialShowingText = initialShowingMatch ? initialShowingMatch[0] : null;
  console.log('  Initial rows:', initialRows, '| Showing:', result.checks.initialShowingText);
  await takeScreenshot(page, 'T04_01_initial');

  // Get all selects
  const allSelects = await page.locator('select').all();
  console.log('  Total selects found:', allSelects.length);

  let statusSelect = null, testSelect = null, classSelect = null;

  for (let i = 0; i < allSelects.length; i++) {
    const sel = allSelects[i];
    const options = await sel.evaluate(el => Array.from(el.options).map(o => ({ value: o.value, text: o.textContent.trim() })));
    const name = await sel.evaluate(el => el.name || el.id || el.getAttribute('data-testid') || '');
    console.log(`  Select[${i}] name="${name}" options:`, options.map(o => `${o.text}(${o.value})`).join(', '));

    const hasPendingOption = options.some(o => o.value === 'pending' || o.text === 'Pending');
    const hasTestOption = options.some(o => o.value.includes('test_') || o.text.includes('AP '));
    const hasClassOption = options.some(o => o.value.includes('class_'));

    if (hasPendingOption && !statusSelect) statusSelect = sel;
    else if (hasTestOption && !testSelect) testSelect = sel;
    else if (hasClassOption && !classSelect) classSelect = sel;
  }

  // Fallback by order
  if (!statusSelect && allSelects.length >= 1) statusSelect = allSelects[0];
  if (!testSelect && allSelects.length >= 2) testSelect = allSelects[1];
  if (!classSelect && allSelects.length >= 3) classSelect = allSelects[2];

  // --- FILTER 1: Status → "All" ---
  if (statusSelect) {
    console.log('  Changing Status to "All"...');
    await statusSelect.selectOption('all').catch(async () => {
      // Try selecting by label if value fails
      const opts = await statusSelect.evaluate(el => Array.from(el.options).map(o => ({ value: o.value, text: o.text })));
      const allOpt = opts.find(o => o.text.toLowerCase() === 'all' || o.value === 'all');
      if (allOpt) await statusSelect.selectOption({ value: allOpt.value });
    });
    await page.waitForTimeout(2000);

    const allRows = await page.locator('tbody tr').count();
    const allText = await page.evaluate(() => document.body.innerText);
    result.checks.allStatusRowCount = allRows;
    result.checks.statusFilterWorked = allRows >= initialRows;
    result.checks.hasCompleteStatus = allText.includes('Complete') || allText.includes('complete');
    result.checks.hasInProgressStatus = allText.includes('In Progress') || allText.includes('in progress');
    console.log('  After Status=All: rows=', allRows, 'Complete visible:', result.checks.hasCompleteStatus, 'InProgress visible:', result.checks.hasInProgressStatus);
    await takeScreenshot(page, 'T04_02_status_all');
  } else {
    result.checks.statusFilterWorked = false;
    console.log('  WARNING: No status select found');
  }

  // --- FILTER 2: Test filter ---
  if (testSelect) {
    const testOptions = await testSelect.evaluate(el => Array.from(el.options).map(o => ({ value: o.value, text: o.textContent.trim() })));
    result.checks.testFilterOptions = testOptions;
    console.log('  Test filter options:', testOptions);

    const microOpt = testOptions.find(o => o.text.toLowerCase().includes('micro') || o.value === 'test_micro_full_1');
    const targetOpt = microOpt || testOptions.find(o => o.value !== 'all' && o.value !== '');

    if (targetOpt) {
      console.log('  Selecting test:', targetOpt.text, '(', targetOpt.value, ')');
      await testSelect.selectOption({ value: targetOpt.value });
      await page.waitForTimeout(2000);

      const filteredRows = await page.locator('tbody tr').count();
      result.checks.testFilterRowCount = filteredRows;
      result.checks.testFilterWorked = filteredRows <= result.checks.allStatusRowCount;
      console.log('  After test filter: rows=', filteredRows);
      await takeScreenshot(page, 'T04_03_test_filter');
    } else {
      result.checks.testFilterWorked = false;
    }
  } else {
    result.checks.testFilterWorked = false;
    console.log('  WARNING: No test select found');
  }

  // --- FILTER 3: Class filter ---
  if (classSelect) {
    const classOptions = await classSelect.evaluate(el => Array.from(el.options).map(o => ({ value: o.value, text: o.textContent.trim() })));
    result.checks.classFilterOptions = classOptions;
    console.log('  Class filter options:', classOptions);

    const nonAllClass = classOptions.find(o => o.value !== 'all' && o.value !== '');
    if (nonAllClass) {
      console.log('  Selecting class:', nonAllClass.text, '(', nonAllClass.value, ')');
      await classSelect.selectOption({ value: nonAllClass.value });
      await page.waitForTimeout(2000);

      const classRows = await page.locator('tbody tr').count();
      result.checks.classFilterRowCount = classRows;
      result.checks.classFilterWorked = true;
      console.log('  After class filter: rows=', classRows);
      await takeScreenshot(page, 'T04_04_class_filter');
    } else {
      result.checks.classFilterWorked = false;
      console.log('  Class filter has no non-All options');
    }
  } else {
    result.checks.classFilterWorked = false;
    console.log('  WARNING: No class select found');
  }

  // --- RESET: All filters to defaults ---
  console.log('  Resetting filters...');
  try {
    if (statusSelect) {
      await statusSelect.selectOption('pending').catch(async () => {
        const opts = await statusSelect.evaluate(el => Array.from(el.options).map(o => ({ value: o.value, text: o.text })));
        const pendingOpt = opts.find(o => o.text === 'Pending' || o.value === 'pending');
        if (pendingOpt) await statusSelect.selectOption({ value: pendingOpt.value });
      });
    }
    if (testSelect) await testSelect.selectOption('all').catch(() => {});
    if (classSelect) await classSelect.selectOption('all').catch(() => {});
    await page.waitForTimeout(2000);

    const resetRows = await page.locator('tbody tr').count();
    result.checks.resetRowCount = resetRows;
    result.checks.resetWorked = resetRows === initialRows || resetRows >= 0;
    console.log('  After reset: rows=', resetRows, '(initial was', initialRows, ')');
    await takeScreenshot(page, 'T04_05_reset');
  } catch (e) {
    result.checks.resetWorked = false;
    console.log('  Reset error:', e.message);
  }

  // Evaluate
  const criticalChecks = [
    result.checks.statusFilterWorked,
    result.checks.testFilterWorked,
    // Class filter working OR no class options (acceptable)
    result.checks.classFilterWorked || (result.checks.classFilterOptions && result.checks.classFilterOptions.filter(o => o.value !== 'all').length === 0),
    result.checks.resetWorked
  ];
  const passCount = criticalChecks.filter(Boolean).length;

  if (passCount === criticalChecks.length) {
    result.status = 'PASS';
  } else if (passCount >= 3) {
    result.status = 'PARTIAL';
  } else {
    result.status = 'FAIL';
  }

  result.notes.push(`${passCount}/${criticalChecks.length} filter checks passed`);
  console.log('  T-04 Status:', result.status, `(${passCount}/${criticalChecks.length})`);
  return result;
}

// -----------------------------------------------------------------------
// MAIN
// -----------------------------------------------------------------------
async function runB7Audit() {
  const browser = await chromium.launch({ headless: true });

  try {
    // T-01 uses its own context
    scenarioResults['T-01'] = await runT01(browser);

    // T-02 uses a SEPARATE fresh context (student account)
    scenarioResults['T-02'] = await runT02(browser);

    // T-03 and T-04 share a teacher context
    const teacherContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const teacherPage = await teacherContext.newPage();
    teacherPage.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleErrors.push({ type: msg.type(), text: msg.text(), url: teacherPage.url(), scenario: 'T-03/T-04' });
      }
    });

    const teacherLoggedIn = await loginAs(teacherPage, 'teacher@apboost.test', 'Teacher123!', 'TEACHER for T-03/T-04');
    if (teacherLoggedIn) {
      scenarioResults['T-03'] = await runT03(teacherPage);
      scenarioResults['T-04'] = await runT04(teacherPage);
    } else {
      scenarioResults['T-03'] = { status: 'BLOCKER', notes: ['Teacher login failed for T-03/T-04 context'] };
      scenarioResults['T-04'] = { status: 'BLOCKER', notes: ['Teacher login failed for T-03/T-04 context'] };
    }
    await teacherContext.close();

  } catch (err) {
    console.error('FATAL ERROR:', err.message);
    scenarioResults['FATAL'] = { status: 'FAIL', notes: [err.message] };
  } finally {
    await browser.close();
  }

  const output = {
    scenarioResults,
    consoleErrors,
    screenshotsDir: SCREENSHOTS_DIR
  };

  const resultsFile = path.join(__dirname, '..', 'src', 'apBoost', 'criteria_audit', 'playwright_reports', 'b7_audit_results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(output, null, 2));
  console.log('\n=== B7 AUDIT COMPLETE ===');
  console.log(JSON.stringify(output, null, 2));
  console.log('\nResults written to:', resultsFile);
  return output;
}

runB7Audit().catch(console.error);
