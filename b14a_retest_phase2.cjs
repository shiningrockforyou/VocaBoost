const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'src/apBoost/criteria_audit/playwright_reports');

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const consoleErrors = [];
  
  // === PHASE 2: Test teacher-side fixes ===
  // Login as teacher to check gradebook / analytics / report card fixes
  
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      consoleErrors.push({ type: msg.type(), text: msg.text().substring(0, 300), url: page.url() });
    }
  });
  
  try {
    // Login as teacher
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', 'teacher@apboost.test');
    await page.fill('input[type="password"]', 'Teacher123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);
    
    const teacherUrl = page.url();
    results.push({ step: '1_teacher_login', url: teacherUrl, success: teacherUrl.includes('/ap') });
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'b14a_retest_03_teacher_login.png') });
    
    // Check for logout button in teacher APHeader (B12-006)
    const logoutBtn = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.filter(b => {
        const t = b.textContent.toLowerCase().trim();
        return t.includes('logout') || t.includes('log out') || t.includes('sign out');
      }).map(b => ({ text: b.textContent.trim(), visible: b.offsetParent !== null }));
    });
    results.push({ step: '2_teacher_logout_button_B12_006', found: logoutBtn, PASS: logoutBtn.length > 0 });
    
    // Navigate to gradebook
    await page.goto('http://localhost:5173/ap/gradebook');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'b14a_retest_04_gradebook.png') });
    
    const gradebookText = await page.evaluate(() => document.body.textContent.substring(0, 2000));
    results.push({ step: '3_gradebook', url: page.url(), text: gradebookText.substring(0, 500) });
    
    // Check B12-004: student names in gradebook (not "Unknown Student")
    const unknownStudents = gradebookText.includes('Unknown Student');
    const hasStudentNames = gradebookText.match(/[A-Z][a-z]+ [A-Z][a-z]+/g) || [];
    results.push({ 
      step: '4_check_B12_004_student_names', 
      hasUnknownStudent: unknownStudents, 
      PASS_B12_004: !unknownStudents,
      sampleNames: hasStudentNames.slice(0, 5),
      gradebookText: gradebookText.substring(0, 800)
    });
    
    // Navigate to Micro analytics
    await page.goto('http://localhost:5173/ap/teacher/analytics/test_micro_full_1');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'b14a_retest_05_analytics.png') });
    
    const analyticsText = await page.evaluate(() => document.body.textContent.substring(0, 3000));
    results.push({ step: '5_analytics', url: page.url(), textSample: analyticsText.substring(0, 600) });
    
    // Check B12-007: average score denominator (e.g., "5/15 pts")
    const hasDenominator = /\d+\/\d+ pts/.test(analyticsText) || /\d+\/\d+\s*pts/.test(analyticsText);
    const denominatorMatch = analyticsText.match(/\d+\/\d+ pts/g) || analyticsText.match(/\d+ pts/g) || [];
    results.push({ 
      step: '6_check_B12_007_denominator', 
      hasDenominator: hasDenominator,
      matches: denominatorMatch.slice(0, 5),
      PASS_B12_007: hasDenominator
    });
    
    // Check B12-005: deduplication (analytics summary stats)
    // Look for class average / unique students
    const uniqueStudentsMatch = analyticsText.match(/(\d+)\s*students?/i) || [];
    const avgScoreMatch = analyticsText.match(/Average.*?(\d+[\./]\d+)/i) || [];
    results.push({ 
      step: '7_check_B12_005_deduplication', 
      uniqueStudents: uniqueStudentsMatch,
      avgScore: avgScoreMatch,
      analyticsText: analyticsText.substring(0, 800)
    });
    
    // Get all card/stat text to find class average display
    const statsCards = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[class*="card"], [class*="stat"], [class*="summary"]'));
      return cards.slice(0, 10).map(c => c.textContent.trim().substring(0, 200));
    });
    results.push({ step: '7b_stats_cards', cards: statsCards });
    
    // Check analytics student results table for names (not "Unknown Student")
    const studentTableRows = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr, [class*="row"]'));
      return rows.slice(0, 10).map(r => r.textContent.trim().substring(0, 150));
    });
    results.push({ step: '8_analytics_student_table', rows: studentTableRows });
    
    const analyticsUnknown = analyticsText.includes('Unknown Student');
    results.push({ step: '9_analytics_unknown_student', hasUnknownStudent: analyticsUnknown, PASS: !analyticsUnknown });
    
    // Navigate to a seeded student result to check B12-002 (student name in report card)
    // Use result_micro_student1 which should be a seeded student result
    await page.goto('http://localhost:5173/ap/results/result_micro_student1');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'b14a_retest_06_student_report.png') });
    
    const reportCardText = await page.evaluate(() => document.body.textContent.substring(0, 2000));
    results.push({ step: '10_report_card_student1', url: page.url(), text: reportCardText.substring(0, 600) });
    
    // Check B12-002: report card shows student name, not teacher name
    const showsThompson = reportCardText.includes('Ms. Thompson') || reportCardText.includes('Thompson');
    const studentNameMatch = reportCardText.match(/Student:\s*([^\n]+)/i) || reportCardText.match(/student\s*([A-Z][a-z]+ [A-Z][a-z]+)/i) || [];
    results.push({ 
      step: '11_check_B12_002_student_name', 
      showsThompson: showsThompson,
      studentLabel: studentNameMatch,
      PASS_B12_002: !showsThompson || studentNameMatch.length > 0
    });
    
    // More specific check - look for the student name display
    const studentDisplay = await page.evaluate(() => {
      const body = document.body.innerHTML;
      // Find "Student:" text and what follows
      const match = body.match(/Student[:\s]+([^<]{2,50})/i);
      return match ? match[0] : 'not found';
    });
    results.push({ step: '11b_student_display_text', text: studentDisplay });
    
  } catch (err) {
    results.push({ step: 'ERROR', error: err.message, stack: err.stack.substring(0, 500) });
  }
  
  results.push({ step: 'console_errors_teacher', errors: consoleErrors.slice(0, 20) });
  
  await browser.close();
  const output = JSON.stringify(results, null, 2);
  fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'b14a_phase2_results.json'), output);
  console.log(output);
}

runTest().catch(console.error);
