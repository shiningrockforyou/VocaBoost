import { test, expect } from '@playwright/test';
import fs from 'fs';

const TEACHER_EMAIL = 'teacher@apboost.test';
const TEACHER_PASSWORD = 'Teacher123!';

async function loginAsTeacher(page) {
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('domcontentloaded');
  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.fill(TEACHER_EMAIL);
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(TEACHER_PASSWORD);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);
  console.log('URL after login:', page.url());
}

test.describe('B7 Fix Verification', () => {
  test.setTimeout(90000);

  test('B7-005: Quick Action buttons have SVG icons on Teacher Dashboard', async ({ page }) => {
    await loginAsTeacher(page);

    await page.goto('http://localhost:5173/ap/teacher');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const screenshot = await page.screenshot({ fullPage: true });
    fs.writeFileSync('src/apBoost/criteria_audit/playwright_reports/b7_005_teacher_dashboard.png', screenshot);
    console.log('Screenshot saved: b7_005_teacher_dashboard.png');

    // Check for SVG elements inside the quick action link buttons
    const svgInLinks = await page.locator('a svg').count();
    console.log('Total SVG icons found inside link elements: ' + svgInLinks);

    // Check specific quick action buttons by href
    const createBtnSvg = await page.locator('a[href="/ap/teacher/test/new"] svg').count();
    const questionBtnSvg = await page.locator('a[href="/ap/teacher/questions"] svg').count();
    const gradebookBtnSvg = await page.locator('a[href="/ap/gradebook"] svg').count();
    const classesBtnSvg = await page.locator('a[href="/ap/teacher/classes"] svg').count();

    console.log('SVGs in "Create New Test" button: ' + createBtnSvg);
    console.log('SVGs in "Question Bank" button: ' + questionBtnSvg);
    console.log('SVGs in "Gradebook" button: ' + gradebookBtnSvg);
    console.log('SVGs in "Manage Classes" button: ' + classesBtnSvg);

    // Get button text to verify no stray plain-text characters like "Q", "G", "C"
    // Use .first() for cases where multiple elements share the same href (e.g., "Go to Gradebook" sidebar link)
    const createBtnText = await page.locator('a[href="/ap/teacher/test/new"]').first().textContent();
    const questionBtnText = await page.locator('a[href="/ap/teacher/questions"]').first().textContent();
    const gradebookBtnText = await page.locator('a[href="/ap/gradebook"]').first().textContent();
    const classesBtnText = await page.locator('a[href="/ap/teacher/classes"]').first().textContent();
    console.log('Create New Test button text: "' + createBtnText + '"');
    console.log('Question Bank button text: "' + questionBtnText + '"');
    console.log('Gradebook button text: "' + gradebookBtnText + '"');
    console.log('Manage Classes button text: "' + classesBtnText + '"');

    expect(createBtnSvg, 'Create New Test button should have an SVG icon').toBeGreaterThan(0);
    expect(questionBtnSvg, 'Question Bank button should have an SVG icon').toBeGreaterThan(0);
    expect(gradebookBtnSvg, 'Gradebook button should have an SVG icon').toBeGreaterThan(0);
    expect(classesBtnSvg, 'Manage Classes button should have an SVG icon').toBeGreaterThan(0);
  });

  test('B7-001/002/003: Gradebook Student and Test columns show correct data', async ({ page }) => {
    await loginAsTeacher(page);

    await page.goto('http://localhost:5173/ap/gradebook');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(6000);

    const screenshot = await page.screenshot({ fullPage: true });
    fs.writeFileSync('src/apBoost/criteria_audit/playwright_reports/b7_001_002_003_gradebook.png', screenshot);

    // B7-001: Student column - should show display names not emails
    const allStudentCells = page.locator('table tbody tr td:first-child');
    const allStudents = await allStudentCells.allTextContents();
    console.log('All student column values: ' + JSON.stringify(allStudents));

    const hasEmails = allStudents.filter(s => s.includes('@'));
    console.log('Cells containing email addresses: ' + JSON.stringify(hasEmails));

    const hasDisplayNames = allStudents.filter(s => !s.includes('@') && s.trim().length > 0 && s !== 'Unknown Student');
    console.log('Cells with valid display names: ' + JSON.stringify(hasDisplayNames));

    // B7-002: Test column - should show titles not raw IDs
    const allTestCells = page.locator('table tbody tr td:nth-child(2)');
    const allTestValues = await allTestCells.allTextContents();
    console.log('All test column values: ' + JSON.stringify(allTestValues));

    const hasRawIds = allTestValues.filter(t => t.startsWith('test_') || t.includes('_full_'));
    console.log('Cells with raw test IDs: ' + JSON.stringify(hasRawIds));

    const hasTitles = allTestValues.filter(t =>
      t.includes('AP') || t.includes('Practice') || t.includes('Microeconomics') || t.includes('Macroeconomics') || t.includes('Calculus')
    );
    console.log('Cells with proper test titles: ' + JSON.stringify(hasTitles));

    // B7-003: Test filter dropdown
    const selectElements = page.locator('select');
    const selectCount = await selectElements.count();
    console.log('Number of select dropdowns: ' + selectCount);

    for (let i = 0; i < selectCount; i++) {
      const options = await selectElements.nth(i).locator('option').allTextContents();
      const val = await selectElements.nth(i).inputValue();
      console.log('Select ' + i + ' (value="' + val + '") options: ' + JSON.stringify(options));
    }

    const testFilter = selectElements.nth(1);
    const testOptions = await testFilter.locator('option').allTextContents();
    const hasIndividualTests = testOptions.filter(o => o !== 'All Tests' && !o.startsWith('All') && o.trim().length > 0);
    console.log('Individual test options beyond "All Tests": ' + JSON.stringify(hasIndividualTests));

    // Assertions
    expect(hasEmails.length, 'B7-001: No student cells should show email addresses').toBe(0);
    expect(hasDisplayNames.length, 'B7-001: Student cells should show display names').toBeGreaterThan(0);
    expect(hasRawIds.length, 'B7-002: No test cells should show raw IDs').toBe(0);
    expect(hasTitles.length, 'B7-002: Test cells should show human-readable titles').toBeGreaterThan(0);
    expect(testOptions.length, 'B7-003: Test filter should have more than just "All Tests"').toBeGreaterThan(1);
    expect(hasIndividualTests.length, 'B7-003: Test filter should have individual test name options').toBeGreaterThan(0);
  });

  test('B7-004: Gradebook Status "All" filter returns results without Firestore index errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await loginAsTeacher(page);

    await page.goto('http://localhost:5173/ap/gradebook');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(6000);

    // Get initial row count (Status=Pending default)
    const initialRows = await page.locator('table tbody tr').count();
    console.log('Initial row count (Status=Pending): ' + initialRows);

    const initialShowingEl = page.locator('p, div, span').filter({ hasText: /Showing \d+ submission/ });
    const initialShowingText = await initialShowingEl.first().textContent().catch(() => 'NOT FOUND');
    console.log('Initial showing text: "' + initialShowingText + '"');

    // Change Status to "All"
    const statusSelect = page.locator('select').first();
    const statusCurrentValue = await statusSelect.inputValue();
    console.log('Current status filter value: "' + statusCurrentValue + '"');

    await statusSelect.selectOption('all');
    await page.waitForTimeout(4000);

    const screenshot = await page.screenshot({ fullPage: true });
    fs.writeFileSync('src/apBoost/criteria_audit/playwright_reports/b7_004_status_all.png', screenshot);

    const rowCountAfterAll = await page.locator('table tbody tr').count();
    console.log('Row count after Status=All: ' + rowCountAfterAll);

    const showingElAfterAll = page.locator('p, div, span').filter({ hasText: /Showing \d+ submission/ });
    const showingTextAfterAll = await showingElAfterAll.first().textContent().catch(() => 'NOT FOUND');
    console.log('Showing text after Status=All: "' + showingTextAfterAll + '"');

    const noResultsVisible = await page.locator('text=No submissions found').count();
    console.log('"No submissions found" message visible: ' + (noResultsVisible > 0));

    console.log('All console errors during test: ' + JSON.stringify(consoleErrors));

    const indexErrors = consoleErrors.filter(e => e.includes('index') || e.includes('failed-precondition') || e.includes('requires an index'));
    console.log('Firestore index errors: ' + JSON.stringify(indexErrors));

    expect(rowCountAfterAll, 'B7-004: Status=All should show results (not 0 rows)').toBeGreaterThan(0);
    expect(indexErrors.length, 'B7-004: No Firestore index errors should occur with Status=All').toBe(0);
  });
});
