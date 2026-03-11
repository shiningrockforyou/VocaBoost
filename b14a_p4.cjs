const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = '/c/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  const results = [];
  const errs = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errs.push(msg.text().substring(0, 300));
    }
  });

  // Login student4
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'student4@apboost.test');
  await page.fill('input[type="password"]', 'Student123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  results.push({ step: 'student4_login', url: page.url() });

  // Navigate to /ap
  await page.goto('http://localhost:5173/ap');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: SCREENSHOTS_DIR + '/b14a_r_ap_student4.png' });

  // Check logout button
  const logoutBtns = await page.evaluate(function() {
    var buttons = Array.from(document.querySelectorAll('button'));
    return buttons.filter(function(b) {
      var t = b.textContent.toLowerCase().trim();
      return t === 'log out' || t === 'logout' || t === 'sign out';
    }).map(function(b) { return { text: b.textContent.trim(), visible: b.offsetParent !== null }; });
  });
  results.push({ step: 'B12_006_logout_btn', found: logoutBtns, PASS: logoutBtns.length > 0 });

  // Click logout
  if (logoutBtns.length > 0) {
    try {
      await page.click('button:has-text("Log out")');
      await page.waitForTimeout(3000);
      results.push({ step: 'after_logout', url: page.url() });
      await page.screenshot({ path: SCREENSHOTS_DIR + '/b14a_r_after_logout.png' });
      
      // Try accessing /ap again - should redirect to login
      await page.goto('http://localhost:5173/ap');
      await page.waitForTimeout(2000);
      results.push({ step: 'ap_after_logout', url: page.url(), redirectedToLogin: page.url().includes('/login') });
    } catch(e) {
      results.push({ step: 'logout_click_error', error: e.message });
    }
  }

  // Teacher login
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'teacher@apboost.test');
  await page.fill('input[type="password"]', 'Teacher123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  results.push({ step: 'teacher_login', url: page.url() });

  // Analytics
  await page.goto('http://localhost:5173/ap/teacher/analytics/test_micro_full_1');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: SCREENSHOTS_DIR + '/b14a_r_analytics.png' });

  var analyticsText = await page.evaluate(function() {
    return document.body.textContent.substring(0, 3000);
  });

  // Total Students
  var tsMatch = analyticsText.match(/Total Students\s*(\d+)/);
  var totalStudents = tsMatch ? parseInt(tsMatch[1]) : null;

  // Table rows
  var tableRows = await page.evaluate(function() {
    var rows = Array.from(document.querySelectorAll('tbody tr'));
    return rows.map(function(r) { return r.textContent.trim().substring(0, 100); });
  });

  // Unique emails
  var emailRegex = /[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g;
  var emailsFound = (analyticsText.match(emailRegex) || []);
  var uniqueEmails = Array.from(new Set(emailsFound));
  
  results.push({
    step: 'B12_005_dedup',
    totalStudentsCard: totalStudents,
    tableRowCount: tableRows.length,
    uniqueEmailCount: uniqueEmails.length,
    uniqueEmails: uniqueEmails,
    PASS: tableRows.length === uniqueEmails.length,
    tableRows: tableRows.slice(0, 12)
  });

  // Average score denominator
  var avgIdx = analyticsText.indexOf('Average Score');
  var avgSection = avgIdx >= 0 ? analyticsText.substring(avgIdx, avgIdx + 60) : 'not found';
  var hasDenom = /\d+\/\d+/.test(avgSection);
  results.push({ step: 'B12_007_denominator', avgSection: avgSection, hasDenom: hasDenom, PASS: hasDenom });

  // Gradebook names
  await page.goto('http://localhost:5173/ap/gradebook');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: SCREENSHOTS_DIR + '/b14a_r_gradebook.png' });
  
  var gradebookText = await page.evaluate(function() { return document.body.textContent.substring(0, 2000); });
  var hasUnknown = gradebookText.includes('Unknown Student');
  results.push({ step: 'B12_004_gradebook_names', hasUnknownStudent: hasUnknown, PASS: !hasUnknown, snippet: gradebookText.substring(0, 500) });

  // Report card - teacher views student result
  await page.goto('http://localhost:5173/ap/results/result_micro_student1');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: SCREENSHOTS_DIR + '/b14a_r_student_report_teacherview.png' });
  
  var reportText = await page.evaluate(function() { return document.body.textContent.substring(0, 500); });
  var studentLine = reportText.match(/Student:\s*([^\n\r]+)/i);
  var showsThompson = reportText.includes('Thompson');
  results.push({
    step: 'B12_002_report_card_name',
    studentLine: studentLine ? studentLine[0] : 'not found',
    showsThompson: showsThompson,
    PASS: !showsThompson,
    snippet: reportText.substring(0, 300)
  });

  // Test page TDZ error check
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'student4@apboost.test');
  await page.fill('input[type="password"]', 'Student123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: SCREENSHOTS_DIR + '/b14a_r_test_page.png' });

  var testPageText = await page.evaluate(function() { return document.body.textContent.substring(0, 400); });
  var hasError = testPageText.includes('Something went wrong') || testPageText.includes('unexpected error') || testPageText.includes('Cannot access');
  results.push({
    step: 'NEW_TDZ_ERROR_test_page',
    hasError: hasError,
    BLOCKER: hasError,
    text: testPageText
  });

  results.push({ step: 'console_errors', errors: errs.slice(0, 20) });

  await browser.close();
  var out = JSON.stringify(results, null, 2);
  fs.writeFileSync(SCREENSHOTS_DIR + '/b14a_phase4_results.json', out);
  console.log(out);
}

main().catch(function(err) { console.error(err); });
