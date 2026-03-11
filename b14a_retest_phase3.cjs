const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'src/apBoost/criteria_audit/playwright_reports');

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  const results = [];
  const consoleErrors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ type: msg.type(), text: msg.text().substring(0, 400), url: page.url() });
    }
  });
  
  try {
    // === PHASE 3: Verify logout works (B12-006) ===
    // Login as student4
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'student4@apboost.test');
    await page.fill('input[type="password"]', 'Student123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    results.push({ step: '1_student4_login', url: page.url() });
    
    // Check AP dashboard shows tests
    const dashboardText = await page.evaluate(() => document.body.textContent.substring(0, 400));
    results.push({ step: '2_dashboard_text', text: dashboardText });
    
    // Click logout button
    const logoutBtn = await page.$('button:has-text("Log out")') || await page.$('button:has-text("Logout")') || await page.$('button:has-text("Sign out")');
    if (logoutBtn) {
      await logoutBtn.click();
      await page.waitForTimeout(3000);
      const afterLogoutUrl = page.url();
      results.push({ step: '3_after_logout', url: afterLogoutUrl, redirectedToLogin: afterLogoutUrl.includes('/login') || afterLogoutUrl === 'http://localhost:5173/' });
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'b14a_retest_07_after_logout.png') });
    } else {
      results.push({ step: '3_logout_button_not_found', FAIL: true });
    }
    
    // === PHASE 3b: Test teacher login and verify analytics total students (dedup check) ===
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'teacher@apboost.test');
    await page.fill('input[type="password"]', 'Teacher123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    results.push({ step: '4_teacher_login', url: page.url() });
    
    // Navigate to analytics
    await page.goto('http://localhost:5173/ap/teacher/analytics/test_micro_full_1');
    await page.waitForTimeout(3000);
    
    // Capture Total Students value and student table count
    const totalStudentsCard = await page.evaluate(() => {
      // Find "Total Students" text and its value
      const allText = document.body.textContent;
      const match = allText.match(/Total Students(\d+)/);
      return match ? match[1] : 'not found';
    });
    results.push({ step: '5_total_students_B12_005', totalStudents: totalStudentsCard });
    
    // Count unique students in table
    const tableRows = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      return rows.map(r => r.textContent.trim().substring(0, 100));
    });
    results.push({ step: '6_student_table_rows', count: tableRows.length, rows: tableRows.slice(0, 10) });
    
    // Count unique students by email
    const uniqueEmails = new Set(tableRows.map(r => {
      const emailMatch = r.match(/[\w.]+@[\w.]+/);
      return emailMatch ? emailMatch[0] : '';
    }).filter(e => e));
    results.push({ step: '7_unique_students', uniqueCount: uniqueEmails.size, emails: Array.from(uniqueEmails) });
    
    // B12-005 PASS check: total rows should equal unique students (dedup working)
    results.push({ 
      step: '8_dedup_check_B12_005',
      totalRows: tableRows.length, 
      uniqueStudents: uniqueEmails.size,
      PASS: tableRows.length === uniqueEmails.size 
    });
    
    // === Phase 3c: Check average score format (B12-007) ===
    const analyticsText = await page.evaluate(() => document.body.textContent.substring(0, 3000));
    const hasDenominatorFormat = /\d+\/\d+\s*pts/.test(analyticsText);
    const avgScoreSection = analyticsText.match(/Average Score.{0,50}/);
    results.push({ 
      step: '9_avg_score_format_B12_007',
      hasDenominator: hasDenominatorFormat,
      avgScoreText: avgScoreSection ? avgScoreSection[0] : 'not found',
      PASS: hasDenominatorFormat
    });
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'b14a_retest_08_analytics_dedup.png') });
    
    // === Phase 3d: Check report card student name when teacher views student result ===
    // Navigate to a seeded student result
    await page.goto('http://localhost:5173/ap/results/result_micro_student1');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'b14a_retest_09_student_report_teacher_view.png') });
    
    const reportText = await page.evaluate(() => document.body.textContent.substring(0, 800));
    const studentLineMatch = reportText.match(/Student:\s*([^\n\r]+)/i);
    const showsTeacherName = reportText.includes('Ms. Thompson');
    results.push({
      step: '10_report_card_student_name_B12_002',
      studentLine: studentLineMatch ? studentLineMatch[0] : 'not found',
      showsTeacherName: showsTeacherName,
      PASS: !showsTeacherName
    });
    
    // === Phase 3e: Check test page error (new regression) ===
    await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
    await page.waitForTimeout(3000);
    const testPageText = await page.evaluate(() => document.body.textContent.substring(0, 500));
    const hasError = testPageText.includes('Something went wrong') || testPageText.includes('Error');
    results.push({
      step: '11_test_page_error_check',
      hasError: hasError,
      text: testPageText,
      BLOCKER: hasError
    });
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'b14a_retest_10_test_page_error.png') });
    
  } catch (err) {
    results.push({ step: 'ERROR', error: err.message });
  }
  
  results.push({ step: 'console_errors', errors: consoleErrors.slice(0, 20) });
  
  await browser.close();
  const output = JSON.stringify(results, null, 2);
  fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'b14a_phase3_results.json'), output);
  console.log(output);
}

runTest().catch(console.error);
