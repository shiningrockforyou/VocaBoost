/**
 * B7 Audit - Second pass to investigate specific issues
 */
const { chromium } = require('@playwright/test');
const path = require('path');

async function runAudit2() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const allConsoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('index') || msg.text().includes('Index')) {
      allConsoleErrors.push({ type: msg.type(), url: page.url(), text: msg.text().substring(0, 300) });
    }
  });

  // Login as teacher
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"]', 'teacher@apboost.test');
  await page.fill('input[type="password"]', 'Teacher123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  console.log('Logged in:', page.url());

  // === Check pending count more carefully ===
  console.log('\n=== B0-001 FIX VERIFICATION: Pending Grading Count ===');
  await page.goto('http://localhost:5173/ap/teacher');
  await page.waitForTimeout(5000);

  const dashText = await page.evaluate(() => document.body.innerText);
  const pendingMatch = dashText.match(/Pending Grading \((\d+)\)/);
  const dashboardPendingCount = pendingMatch ? parseInt(pendingMatch[1]) : -1;
  console.log('Dashboard "Pending Grading" count:', dashboardPendingCount);

  // Get the full pending grading section content
  const pendingSection = await page.evaluate(() => {
    // Find elements containing "Pending Grading"
    const elements = document.querySelectorAll('*');
    for (const el of elements) {
      if (el.children.length === 0 && el.textContent.includes('Pending Grading')) {
        return el.closest('section, div[class]')?.innerText || el.parentElement?.innerText || 'not found';
      }
    }
    return 'section not found';
  });
  console.log('Pending grading section:', pendingSection);

  // === Navigate to gradebook to count actual pending ===
  await page.goto('http://localhost:5173/ap/gradebook');
  await page.waitForTimeout(5000);
  const gradebookPendingRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
  console.log('Gradebook pending count (default filter):', gradebookPendingRows);

  // Note whether dashboard count matches gradebook
  console.log('Dashboard count matches gradebook:', dashboardPendingCount === gradebookPendingRows);
  console.log('Dashboard count:', dashboardPendingCount, 'Gradebook count:', gradebookPendingRows);

  // === Class filter detailed investigation ===
  console.log('\n=== T-04: Class Filter Investigation ===');

  // Change to All first to get all results
  const selects = await page.$$('select');
  let statusSelect = null, testSelect = null, classSelect = null;

  for (const sel of selects) {
    const options = await sel.evaluate(s => Array.from(s.options).map(o => o.text.trim()));
    if (options.includes('Pending') && options.includes('All')) {
      statusSelect = sel;
    } else if (options.some(o => o.includes('All Tests'))) {
      testSelect = sel;
    } else if (options.some(o => o.includes('All Classes'))) {
      classSelect = sel;
    }
  }

  // Set to All status
  if (statusSelect) {
    await statusSelect.selectOption({ label: 'All' });
    await page.waitForTimeout(3000);
    const allRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
    console.log('All status filter rows:', allRows);
  }

  // Check class filter with Calc AB class
  if (classSelect) {
    const classOptions = await classSelect.evaluate(s => Array.from(s.options).map(o => ({ value: o.value, text: o.text })));
    console.log('Class options:', JSON.stringify(classOptions));

    // Try class_calc_p3
    await classSelect.selectOption({ value: 'class_calc_p3' });
    await page.waitForTimeout(3000);
    const calcRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
    const calcText = await page.evaluate(() => document.body.innerText);
    console.log('Calc AB class filter rows:', calcRows);
    console.log('Calc class rows text:', calcText.substring(0, 500));

    await page.screenshot({ path: path.join(process.cwd(), 'screenshots', 'b7_t04_class_calc_filter.png') });

    // Try class_econ_p1
    await classSelect.selectOption({ value: 'class_econ_p1' });
    await page.waitForTimeout(3000);
    const econRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
    const econText = await page.evaluate(() => document.body.innerText);
    console.log('Econ class filter rows:', econRows);
    console.log('Econ class rows text:', econText.substring(0, 500));

    await page.screenshot({ path: path.join(process.cwd(), 'screenshots', 'b7_t04_class_econ_filter.png') });
  }

  // === Check console errors specifically ===
  console.log('\n=== ALL CONSOLE ERRORS FOUND ===');
  allConsoleErrors.forEach(e => console.log(`[${e.type}] ${e.url}: ${e.text}`));

  // === Verify test filter shows titles (B7-003 fix) ===
  console.log('\n=== B7-003 FIX VERIFICATION: Test Filter Has Titles ===');
  if (testSelect) {
    const testOptions = await testSelect.evaluate(s => Array.from(s.options).map(o => ({ value: o.value, text: o.text })));
    console.log('Test filter options:', JSON.stringify(testOptions));
    const hasTitle = testOptions.some(o => o.text.includes('AP') && !o.text.includes('test_'));
    console.log('Test filter shows proper titles (not IDs):', hasTitle);
  }

  // === Verify SVG icons in quick actions (B7-005 fix) ===
  console.log('\n=== B7-005 FIX VERIFICATION: Quick Action SVG Icons ===');
  await page.goto('http://localhost:5173/ap/teacher');
  await page.waitForTimeout(4000);

  const quickActionDetails = await page.evaluate(() => {
    const targetHrefs = ['/ap/teacher/test/new', '/ap/teacher/questions', '/ap/gradebook', '/ap/teacher/classes'];
    const result = [];
    for (const href of targetHrefs) {
      const a = document.querySelector(`a[href="${href}"]`);
      if (a) {
        const svg = a.querySelector('svg');
        result.push({
          href,
          hasSvg: !!svg,
          svgHtml: svg ? svg.outerHTML.substring(0, 200) : null,
          text: a.innerText.trim()
        });
      } else {
        result.push({ href, found: false });
      }
    }
    return result;
  });
  console.log('Quick action SVG verification:', JSON.stringify(quickActionDetails, null, 2));

  await browser.close();
}

runAudit2().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
