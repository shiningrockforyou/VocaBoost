/**
 * B7 Audit Script - Teacher Dashboard & Gradebook
 * Tests T-01, T-02, T-03, T-04
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const TEACHER_EMAIL = 'teacher@apboost.test';
const TEACHER_PASS = 'Teacher123!';
const STUDENT_EMAIL = 'student@apboost.test';
const STUDENT_PASS = 'Student123!';
const BASE_URL = 'http://localhost:5173';

async function runAudit() {
  const browser = await chromium.launch({ headless: true });

  const results = {
    t01: {},
    t02: {},
    t03: {},
    t04: {},
    consoleErrors: []
  };

  // ========================
  // TEACHER SESSION
  // ========================
  const teacherContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await teacherContext.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ route: page.url(), text: msg.text() });
    }
  });

  // Login as teacher
  await page.goto(`${BASE_URL}/login`);
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"]', TEACHER_EMAIL);
  await page.fill('input[type="password"]', TEACHER_PASS);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  console.log('After login URL:', page.url());

  // ========================
  // T-01: TEACHER DASHBOARD
  // ========================
  console.log('\n=== T-01: Teacher Dashboard ===');
  await page.goto(`${BASE_URL}/ap/teacher`);
  await page.waitForTimeout(5000);

  const t01Text = await page.evaluate(() => document.body.innerText);
  const t01Html = await page.evaluate(() => document.body.innerHTML);

  // Check heading
  results.t01.heading = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    return h1 ? h1.textContent : 'MISSING';
  });
  console.log('T-01 H1:', results.t01.heading);

  // Quick actions check
  results.t01.hasCreateTest = t01Text.includes('Create New Test');
  results.t01.hasQuestionBank = t01Text.includes('Question Bank');
  results.t01.hasGradebook = t01Text.includes('Gradebook');
  results.t01.hasManageClasses = t01Text.includes('Manage Classes');
  console.log('Quick actions - Create:', results.t01.hasCreateTest, '| QBank:', results.t01.hasQuestionBank, '| Gradebook:', results.t01.hasGradebook, '| Classes:', results.t01.hasManageClasses);

  // Check SVG icons in quick actions
  results.t01.quickActionSVGs = await page.evaluate(() => {
    const anchors = document.querySelectorAll('a[href]');
    const result = [];
    for (const a of anchors) {
      const text = a.innerText.trim();
      const hasSvg = a.querySelector('svg') !== null;
      const href = a.getAttribute('href');
      if (href && (
        href.includes('/teacher/test/new') ||
        href.includes('/teacher/questions') ||
        href.includes('/gradebook') ||
        href.includes('/teacher/classes')
      )) {
        result.push({ href, text: text.substring(0, 60), hasSvg });
      }
    }
    return result;
  });
  console.log('Quick action links SVG check:', JSON.stringify(results.t01.quickActionSVGs));

  // My Tests
  const myTestsMatch = t01Text.match(/My Tests \((\d+)\)/);
  results.t01.myTestsText = myTestsMatch ? myTestsMatch[0] : 'NOT FOUND';
  console.log('My Tests:', results.t01.myTestsText);

  // Test cards - look for question summaries
  results.t01.questionSummaries = t01Text.match(/\d+ MCQ/g) || [];
  console.log('Question summaries:', results.t01.questionSummaries);

  // Check for Edit links (test card presence)
  results.t01.editLinkCount = await page.evaluate(() => {
    return document.querySelectorAll('a[href*="edit"]').length;
  });
  console.log('Edit links count:', results.t01.editLinkCount);

  // Pending Grading section
  const pendingMatch = t01Text.match(/Pending Grading \((\d+)\)/);
  results.t01.pendingGradingText = pendingMatch ? pendingMatch[0] : 'NOT FOUND';
  results.t01.pendingCount = pendingMatch ? parseInt(pendingMatch[1]) : -1;
  console.log('Pending Grading:', results.t01.pendingGradingText);

  // Check if pending count is correct (should be 7 based on seed data)
  // B0-001 fix: dashboard should now count correctly
  // Seed has 13 results: some completed, some pending
  // Per previous audit: gradebook shows 7 pending, dashboard showed 2 (wrong)
  results.t01.pendingCountCorrect = results.t01.pendingCount >= 5; // should be ~7
  console.log('Pending count seems correct (>=5):', results.t01.pendingCountCorrect);

  // My Classes
  const classesMatch = t01Text.match(/My Classes \((\d+)\)/);
  results.t01.myClassesText = classesMatch ? classesMatch[0] : 'NOT FOUND';
  console.log('My Classes:', results.t01.myClassesText);

  // Go to Gradebook link
  results.t01.hasGoToGradebook = t01Text.includes('Go to Gradebook');
  console.log('Has Go to Gradebook:', results.t01.hasGoToGradebook);

  // Check student counts in classes
  results.t01.hasStudentCount = /\d+ student/i.test(t01Text);
  console.log('Has student count in classes:', results.t01.hasStudentCount);

  // Assign button present in test cards
  results.t01.hasAssignButton = t01Text.includes('Assign');
  console.log('Has Assign button:', results.t01.hasAssignButton);

  // Screenshot
  await page.screenshot({ path: path.join(process.cwd(), 'screenshots', 'b7_t01_teacher_dashboard.png'), fullPage: true });
  console.log('T-01 screenshot saved');

  // Print page text for inspection
  console.log('\n=== T-01 Page Text (first 2500 chars) ===');
  console.log(t01Text.substring(0, 2500));

  // ========================
  // T-02: ROUTE PROTECTION
  // ========================
  console.log('\n=== T-02: Teacher Route Protection ===');

  // Try logging in as student
  const studentContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const studentPage = await studentContext.newPage();

  await studentPage.goto(`${BASE_URL}/login`);
  await studentPage.waitForTimeout(2000);
  await studentPage.fill('input[type="email"]', STUDENT_EMAIL);
  await studentPage.fill('input[type="password"]', STUDENT_PASS);
  await studentPage.click('button[type="submit"]');
  await studentPage.waitForTimeout(4000);

  const studentLoginUrl = studentPage.url();
  console.log('Student login URL:', studentLoginUrl);
  results.t02.studentLoginWorks = !studentLoginUrl.includes('/login');

  if (results.t02.studentLoginWorks) {
    // Try teacher route
    await studentPage.goto(`${BASE_URL}/ap/teacher`);
    await studentPage.waitForTimeout(3000);
    const teacherRouteUrl = studentPage.url();
    const teacherText = await studentPage.evaluate(() => document.body.innerText);
    results.t02.teacherRouteDenied = !teacherRouteUrl.includes('/teacher') || teacherText.includes('Access Denied') || teacherText.includes('Not authorized') || teacherText.includes('not authorized');
    results.t02.teacherRouteUrl = teacherRouteUrl;
    console.log('After navigating to /ap/teacher, URL:', teacherRouteUrl);
    console.log('Teacher route denied:', results.t02.teacherRouteDenied);

    // Try teacher test create
    await studentPage.goto(`${BASE_URL}/ap/teacher/test/new`);
    await studentPage.waitForTimeout(3000);
    const testNewUrl = studentPage.url();
    results.t02.testNewDenied = !testNewUrl.includes('/teacher');
    results.t02.testNewUrl = testNewUrl;
    console.log('After /ap/teacher/test/new, URL:', testNewUrl);

    // Try gradebook (teacher-only)
    await studentPage.goto(`${BASE_URL}/ap/gradebook`);
    await studentPage.waitForTimeout(3000);
    const gradebookUrl = studentPage.url();
    const gradebookText = await studentPage.evaluate(() => document.body.innerText);
    results.t02.gradebookDenied = !gradebookUrl.includes('/gradebook') || gradebookText.includes('Access Denied') || gradebookText.includes('not authorized');
    results.t02.gradebookUrl = gradebookUrl;
    console.log('After /ap/gradebook (student), URL:', gradebookUrl);
    console.log('Gradebook text snippet:', gradebookText.substring(0, 200));

    await studentPage.screenshot({ path: path.join(process.cwd(), 'screenshots', 'b7_t02_student_teacher_route.png') });
  } else {
    results.t02.note = 'Student login failed - T-02 SKIP';
    console.log('Student login failed, T-02 will be skipped');
  }

  await studentContext.close();

  // ========================
  // T-03: GRADEBOOK - PENDING SUBMISSIONS
  // ========================
  console.log('\n=== T-03: Gradebook - Pending Submissions ===');
  await page.goto(`${BASE_URL}/ap/gradebook`);
  await page.waitForTimeout(5000);

  const gradebookText = await page.evaluate(() => document.body.innerText);
  const gradebookHtml = await page.evaluate(() => document.body.innerHTML);

  // Check heading and subtitle
  results.t03.heading = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    return h1 ? h1.textContent.trim() : 'MISSING';
  });
  console.log('T-03 Heading:', results.t03.heading);

  results.t03.hasSubtitle = gradebookText.includes('Review and grade student FRQ submissions');
  console.log('Has subtitle:', results.t03.hasSubtitle);

  // Filter dropdowns
  results.t03.hasStatusFilter = gradebookText.includes('Status') || gradebookText.includes('Pending');
  results.t03.hasTestFilter = gradebookText.includes('Test') || gradebookText.includes('All Tests');
  results.t03.hasClassFilter = gradebookText.includes('Class') || gradebookText.includes('All Classes');
  console.log('Filters - Status:', results.t03.hasStatusFilter, '| Test:', results.t03.hasTestFilter, '| Class:', results.t03.hasClassFilter);

  // Check filter options
  const filterDetails = await page.evaluate(() => {
    const selects = document.querySelectorAll('select');
    return Array.from(selects).map(s => ({
      name: s.name || s.id || 'unknown',
      value: s.value,
      options: Array.from(s.options).map(o => o.text.trim())
    }));
  });
  console.log('Filter dropdowns:', JSON.stringify(filterDetails));
  results.t03.filterDetails = filterDetails;

  // Check default filter value
  results.t03.defaultFilterIsPending = filterDetails.some(f => f.value === 'pending' || f.value === 'PENDING' || f.options.some(o => o === 'Pending'));

  // Table columns check
  results.t03.hasStudentColumn = gradebookText.includes('Student');
  results.t03.hasTestColumn = gradebookText.includes('Test');
  results.t03.hasSubmittedColumn = gradebookText.includes('Submitted');
  results.t03.hasStatusColumn = gradebookText.includes('Status');
  results.t03.hasActionColumn = gradebookText.includes('Action') || gradebookText.includes('Grade') || gradebookText.includes('View');
  console.log('Columns - Student:', results.t03.hasStudentColumn, '| Test:', results.t03.hasTestColumn, '| Submitted:', results.t03.hasSubmittedColumn, '| Status:', results.t03.hasStatusColumn, '| Action:', results.t03.hasActionColumn);

  // Check row data - student names vs emails
  const tableRows = await page.evaluate(() => {
    const rows = document.querySelectorAll('tbody tr, [role="row"]');
    return Array.from(rows).slice(0, 5).map(row => row.innerText.trim());
  });
  console.log('Table rows (first 5):', tableRows);
  results.t03.tableRows = tableRows;

  // Check for display names vs emails in student column
  const hasEmailInRows = tableRows.some(r => r.includes('@'));
  const hasProperName = tableRows.some(r => /[A-Z][a-z]+ [A-Z][a-z]+/.test(r)); // "First Last"
  results.t03.studentColumnShowsEmail = hasEmailInRows;
  results.t03.studentColumnShowsName = hasProperName;
  console.log('Student column shows email:', hasEmailInRows);
  console.log('Student column shows proper name:', hasProperName);

  // Check test column for IDs vs titles
  const hasTestId = tableRows.some(r => r.includes('test_') || r.includes('result_'));
  const hasTestTitle = tableRows.some(r => r.includes('Micro') || r.includes('Macro') || r.includes('Calc') || r.includes('AP '));
  results.t03.testColumnShowsId = hasTestId;
  results.t03.testColumnShowsTitle = hasTestTitle;
  console.log('Test column shows raw ID:', hasTestId);
  console.log('Test column shows title:', hasTestTitle);

  // Check for Grade buttons
  results.t03.hasGradeButton = gradebookText.includes('Grade');
  results.t03.gradeButtonCount = (gradebookText.match(/\bGrade\b/g) || []).length;
  console.log('Grade button count:', results.t03.gradeButtonCount);

  // Check "Showing X submissions" text
  const showingMatch = gradebookText.match(/Showing \d+ submissions?/i);
  results.t03.showingText = showingMatch ? showingMatch[0] : 'NOT FOUND';
  console.log('Showing text:', results.t03.showingText);

  // Screenshot
  await page.screenshot({ path: path.join(process.cwd(), 'screenshots', 'b7_t03_gradebook.png'), fullPage: true });
  console.log('T-03 screenshot saved');

  console.log('\n=== T-03 Page Text (first 2500 chars) ===');
  console.log(gradebookText.substring(0, 2500));

  // ========================
  // T-04: GRADEBOOK FILTERS
  // ========================
  console.log('\n=== T-04: Gradebook Filters ===');

  // Get initial pending count
  const initialText = await page.evaluate(() => document.body.innerText);
  const initialRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
  results.t04.initialRowCount = initialRows;
  console.log('Initial row count (Pending filter):', initialRows);

  // Change Status filter to "All"
  const selects = await page.$$('select');
  let statusSelect = null;
  let testSelect = null;
  let classSelect = null;

  for (const sel of selects) {
    const options = await sel.evaluate(s => Array.from(s.options).map(o => o.text.trim()));
    const value = await sel.evaluate(s => s.value);
    if (options.includes('Pending') && options.includes('All')) {
      statusSelect = sel;
    } else if (options.some(o => o.includes('Micro') || o.includes('All Tests'))) {
      testSelect = sel;
    } else if (options.some(o => o.includes('Economics') || o.includes('All Classes'))) {
      classSelect = sel;
    }
  }

  if (statusSelect) {
    console.log('Status select found, changing to All...');
    await statusSelect.selectOption({ label: 'All' });
    await page.waitForTimeout(3000);

    const afterAllText = await page.evaluate(() => document.body.innerText);
    const afterAllRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
    results.t04.allStatusRowCount = afterAllRows;
    results.t04.allStatusHasComplete = afterAllText.toLowerCase().includes('complete');
    console.log('After Status=All: row count:', afterAllRows, 'has Complete:', results.t04.allStatusHasComplete);

    await page.screenshot({ path: path.join(process.cwd(), 'screenshots', 'b7_t04_status_all.png'), fullPage: true });

    // Console errors after All filter
    const errorsBeforeAllFilter = consoleErrors.length;
  } else {
    results.t04.statusSelectFound = false;
    console.log('Status select not found!');
  }

  // Test filter
  if (testSelect) {
    const testOptions = await testSelect.evaluate(s => Array.from(s.options).map(o => ({ value: o.value, text: o.text.trim() })));
    console.log('Test filter options:', JSON.stringify(testOptions));
    results.t04.testFilterOptions = testOptions;
    results.t04.testFilterHasTitles = testOptions.some(o => o.text.includes('Micro') || o.text.includes('Macro') || o.text.includes('Calc'));

    // Select a specific test
    const microOption = testOptions.find(o => o.text.includes('Micro'));
    if (microOption) {
      await testSelect.selectOption({ value: microOption.value });
      await page.waitForTimeout(3000);

      const afterTestFilter = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
      results.t04.afterTestFilterRows = afterTestFilter;
      console.log('After Test=Micro filter: row count:', afterTestFilter);

      // Verify all rows show Micro
      const rowsAfterTestFilter = await page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr');
        return Array.from(rows).map(r => r.innerText.trim());
      });
      results.t04.testFilterRows = rowsAfterTestFilter.slice(0, 3);
      const allShowMicro = rowsAfterTestFilter.every(r => r.includes('Micro') || r.includes('Econ') || r.includes('Economics'));
      results.t04.testFilterCorrect = allShowMicro;
      console.log('All rows show Micro after filter:', allShowMicro);

      await page.screenshot({ path: path.join(process.cwd(), 'screenshots', 'b7_t04_test_filter.png') });
    }
  } else {
    results.t04.testSelectFound = false;
    console.log('Test select not found!');
  }

  // Class filter
  if (classSelect) {
    const classOptions = await classSelect.evaluate(s => Array.from(s.options).map(o => ({ value: o.value, text: o.text.trim() })));
    console.log('Class filter options:', JSON.stringify(classOptions));
    results.t04.classFilterOptions = classOptions;
    results.t04.classFilterHasClasses = classOptions.length > 1; // more than just "All Classes"

    // Select a specific class
    const firstClass = classOptions.find(o => o.value !== '' && o.value !== 'all');
    if (firstClass) {
      await classSelect.selectOption({ value: firstClass.value });
      await page.waitForTimeout(3000);
      const afterClassFilter = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
      results.t04.afterClassFilterRows = afterClassFilter;
      console.log('After Class filter:', firstClass.text, '- row count:', afterClassFilter);
    }
  } else {
    results.t04.classSelectFound = false;
    console.log('Class select not found!');
  }

  // Reset filters
  if (statusSelect) await statusSelect.selectOption({ label: 'Pending' }).catch(() => {});
  if (testSelect) await testSelect.selectOption({ index: 0 }).catch(() => {});
  if (classSelect) await classSelect.selectOption({ index: 0 }).catch(() => {});
  await page.waitForTimeout(2000);

  const afterResetRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
  results.t04.afterResetRows = afterResetRows;
  console.log('After reset, row count:', afterResetRows);

  // Final screenshot
  await page.screenshot({ path: path.join(process.cwd(), 'screenshots', 'b7_t04_reset.png') });

  // All console errors
  results.consoleErrors = consoleErrors;
  console.log('\n=== CONSOLE ERRORS ===');
  consoleErrors.forEach(e => console.log('ERROR at', e.route, ':', e.text));

  // Save results
  const reportPath = path.join(process.cwd(), 'screenshots', 'b7_results.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log('\nResults saved to', reportPath);

  await teacherContext.close();
  await browser.close();

  return results;
}

runAudit().then(results => {
  console.log('\n=== AUDIT COMPLETE ===');
  console.log('T-01 pending count:', results.t01.pendingCount, '(correct >= 5:', results.t01.pendingCountCorrect, ')');
  console.log('T-02 student login works:', results.t02.studentLoginWorks);
  console.log('T-03 student names (not emails):', !results.t03.studentColumnShowsEmail);
  console.log('T-03 test titles (not IDs):', results.t03.testColumnShowsTitle);
  console.log('T-04 test filter options have titles:', results.t04.testFilterHasTitles);
  console.log('T-04 All-status filter works (no crash):', results.t04.allStatusRowCount !== undefined);
}).catch(e => {
  console.error('Audit failed:', e.message);
  process.exit(1);
});
