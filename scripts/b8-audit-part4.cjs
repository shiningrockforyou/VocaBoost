/**
 * B8 Audit Part 4 - Final verification of student profile and gradings
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'src', 'apBoost', 'criteria_audit', 'playwright_reports', 'screenshots_B8');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function login(page) {
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('input[type="email"], input[name="email"]').first().fill('teacher@apboost.test');
  await page.locator('input[type="password"]').fill('Teacher123!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });
}

async function takeScreenshot(page, name) {
  const filename = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`Screenshot: ${name}.png`);
}

async function runAudit() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push({ type: msg.type(), text: msg.text().substring(0, 300), url: page.url() });
    }
  });

  try {
    await login(page);

    // =============================================
    // Student Profile - Navigate directly
    // =============================================
    console.log('\n=== Student Profile Direct Navigation ===');

    // Try navigating to a seed student profile directly
    await page.goto('http://localhost:5173/ap/teacher/student/student_seed_001', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await page.waitForTimeout(5000);
    await takeScreenshot(page, 'p4_01_student_profile_direct');

    const profileText1 = await page.evaluate(() => document.body.innerText);
    console.log('Student profile text (direct nav, first 1500):', profileText1.substring(0, 1500));

    const hasLoadingSpinner = profileText1.includes('Loading') || profileText1.includes('loading');
    const hasError = profileText1.includes('Error') || profileText1.includes('error');
    const hasTestHistory = profileText1.includes('Test History');
    const hasStudentName = profileText1.includes('Student') || profileText1.length > 200;

    console.log('Loading:', hasLoadingSpinner, '| Error:', hasError, '| Test History:', hasTestHistory, '| Has content:', hasStudentName);

    // Wait more if still loading
    if (hasLoadingSpinner || profileText1.trim().length < 200) {
      console.log('Waiting more for content to load...');
      await page.waitForTimeout(5000);
      await takeScreenshot(page, 'p4_02_student_profile_wait');
      const profileText2 = await page.evaluate(() => document.body.innerText);
      console.log('Profile text after wait:', profileText2.substring(0, 1500));
    }

    // =============================================
    // Check Grading Panel - seed result frqAnswers
    // =============================================
    console.log('\n=== Grading Panel Seed Data Structure ===');
    await page.goto('http://localhost:5173/ap/gradebook', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Filter to All to see all statuses
    const statusSelect = page.locator('select').first();
    await statusSelect.selectOption('all');
    await page.waitForTimeout(2000);

    // Find and click Grade on a PENDING item (not the In Progress one which is now complete)
    const rows = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('tbody tr')).map(tr => ({
        text: tr.innerText.substring(0, 150),
        hasPending: tr.innerText.includes('Pending'),
        hasGrade: tr.querySelector('button') ? tr.querySelector('button').textContent : null
      }));
    });
    console.log('All rows:', JSON.stringify(rows, null, 2));

    // Look for a Pending row
    const pendingRowIdx = rows.findIndex(r => r.hasPending);
    if (pendingRowIdx >= 0) {
      const gradeBtn = page.locator('tbody tr').nth(pendingRowIdx).locator('button');
      const gradeBtnText = await gradeBtn.textContent();
      console.log('Clicking button:', gradeBtnText, 'for row:', rows[pendingRowIdx].text.substring(0, 80));

      await gradeBtn.click();
      await page.waitForTimeout(3000);
      await takeScreenshot(page, 'p4_03_grading_panel');

      const panelHTML = await page.evaluate(() => {
        const fixed = document.querySelector('.fixed');
        return fixed ? fixed.innerHTML : 'No fixed element';
      });

      // Check for frqAnswers absence/presence
      const panelText = await page.evaluate(() => document.body.innerText);
      const panelSection = panelText.substring(panelText.indexOf('Grading:'), panelText.length);
      console.log('Panel section (full):', panelSection.substring(0, 2000));

      // Check HTML for question cards
      const hasQuestionCards = panelHTML.includes('Student Response') || panelHTML.includes('sub-question') || panelHTML.includes('ScoreInput') || panelHTML.includes('number');
      console.log('Has question cards/inputs:', hasQuestionCards);
      console.log('Panel HTML length:', panelHTML.length);

      // Check specific elements
      const inputs = await page.locator('.fixed input, .fixed textarea').count();
      console.log('Inputs/textareas in panel:', inputs);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }

    // =============================================
    // Gradebook - View button after completing grading
    // =============================================
    console.log('\n=== View button after Mark Complete ===');

    // Check for complete rows
    const allRowsText = await page.evaluate(() => document.body.innerText);
    const hasCompleteRow = allRowsText.includes('Complete');
    console.log('Has Complete rows:', hasCompleteRow);

    await takeScreenshot(page, 'p4_04_gradebook_all');

    // Try to click View on a Complete row
    const completeRows = await page.evaluate(() => {
      const trs = document.querySelectorAll('tbody tr');
      return Array.from(trs).map(tr => ({
        text: tr.innerText.substring(0, 100),
        isComplete: tr.innerText.includes('Complete'),
        buttonText: tr.querySelector('button')?.textContent || 'none'
      }));
    });
    console.log('Complete rows:', completeRows.filter(r => r.isComplete));

    const completeRowIdx = completeRows.findIndex(r => r.isComplete);
    if (completeRowIdx >= 0 && completeRows[completeRowIdx].buttonText === 'View') {
      const viewBtn = page.locator('tbody tr').nth(completeRowIdx).locator('button:has-text("View")');
      console.log('Found View button for Complete row');
      await viewBtn.click({ force: true });
      await page.waitForTimeout(2000);
      await takeScreenshot(page, 'p4_05_view_complete_panel');

      const viewText = await page.evaluate(() => document.body.innerText);
      const panelSection = viewText.substring(viewText.indexOf('Grading:'), viewText.length).substring(0, 500);
      console.log('View panel content:', panelSection);
    }

    // =============================================
    // Summary stats
    // =============================================
    console.log('\n=== CONSOLE ERRORS ===');
    const errors = consoleErrors.filter(e => e.type === 'error');
    console.log('Total errors:', errors.length);
    errors.forEach(e => console.log('  ERROR:', e.text.substring(0, 200)));

    console.log('\n=== WARNINGS ===');
    const warnings = consoleErrors.filter(e => e.type === 'warning' && !e.text.includes('firebase'));
    warnings.forEach(e => console.log('  WARNING:', e.text.substring(0, 200)));

  } catch (error) {
    console.error('ERROR:', error.message);
    await takeScreenshot(page, 'p4_ERROR').catch(() => {});
  } finally {
    await browser.close();
  }
}

runAudit().catch(console.error);
