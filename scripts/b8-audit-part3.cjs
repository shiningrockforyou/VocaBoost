/**
 * B8 Audit Part 3 - Targeted checks:
 * 1. Student profile navigation (click the button, not the td)
 * 2. MCQ grid data check (why is it empty)
 * 3. Grading panel - seed data structure check
 * 4. Verify "View" button behavior after Mark Complete
 * 5. Export PDF actual download verification
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'src', 'apBoost', 'criteria_audit', 'playwright_reports', 'screenshots_B8');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const results = {
  t08: {},
  t07: {},
  t05: {},
  t06: {},
  t09: {},
  consoleErrors: [],
};

async function login(page) {
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const emailField = page.locator('input[type="email"], input[name="email"]').first();
  await emailField.waitFor({ timeout: 10000 });
  await emailField.fill('teacher@apboost.test');
  await page.locator('input[type="password"]').fill('Teacher123!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });
}

async function takeScreenshot(page, name) {
  const filename = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`Screenshot saved: ${name}.png`);
}

async function runAudit() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      results.consoleErrors.push({
        type: msg.type(),
        text: msg.text().substring(0, 300),
        url: page.url(),
      });
    }
  });

  // Track downloads
  const downloads = [];
  context.on('download', download => {
    downloads.push({
      suggestedFilename: download.suggestedFilename(),
      url: download.url()
    });
    console.log('DOWNLOAD STARTED:', download.suggestedFilename());
  });

  try {
    await login(page);

    // =============================================
    // T-08: Student profile - click the BUTTON inside the cell
    // =============================================
    console.log('\n=== T-08: Student Profile (clicking button) ===');
    const analyticsUrl = 'http://localhost:5173/ap/teacher/analytics/test_micro_full_1';
    await page.goto(analyticsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    await takeScreenshot(page, 'p3_01_analytics_loaded');

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Find and click the button inside the student cell (not the td itself)
    const studentButtons = page.locator('button.text-brand-primary');
    const studentBtnCount = await studentButtons.count();
    console.log('Student name buttons found:', studentBtnCount);
    results.t08.buttonCount = studentBtnCount;

    if (studentBtnCount > 0) {
      const firstBtn = studentButtons.first();
      const btnText = await firstBtn.textContent();
      console.log('First student button text:', btnText);

      // Get the data before clicking
      const urlBefore = page.url();
      console.log('URL before click:', urlBefore);

      await firstBtn.click();
      await page.waitForTimeout(3000);

      const urlAfter = page.url();
      console.log('URL after button click:', urlAfter);
      results.t08.urlAfterButtonClick = urlAfter;
      results.t08.navigated = urlAfter.includes('/student');

      await takeScreenshot(page, 'p3_02_after_student_btn_click');

      if (urlAfter.includes('/student')) {
        const profileText = await page.evaluate(() => document.body.innerText);
        console.log('Student Profile page text (first 800):', profileText.substring(0, 800));
        results.t08.profileText = profileText.substring(0, 800);
        results.t08.hasTestHistory = profileText.includes('Test History') || profileText.includes('Score');
        results.t08.hasDomainAnalysis = profileText.includes('Domain');
        results.t08.hasStudentName = profileText.length > 100;
        console.log('Test history section:', results.t08.hasTestHistory);
        console.log('Domain analysis:', results.t08.hasDomainAnalysis);

        await page.evaluate(() => window.scrollBy(0, 400));
        await page.waitForTimeout(500);
        await takeScreenshot(page, 'p3_03_student_profile_scrolled');

        // Navigate back
        await page.goBack();
        await page.waitForTimeout(2000);
        results.t08.returnedToAnalytics = page.url().includes('/analytics');
        console.log('Returned to analytics:', results.t08.returnedToAnalytics);
      } else {
        console.log('Still on analytics page - click may not have triggered navigation');
        // Check if the button has click handler
        const btnDetails = await page.evaluate(() => {
          const btns = document.querySelectorAll('button.text-brand-primary');
          return Array.from(btns).slice(0, 3).map(b => ({
            text: b.textContent.trim(),
            hasOnClick: !!b.onclick,
            reactEvents: Object.keys(b).filter(k => k.startsWith('__react')).length > 0,
          }));
        });
        console.log('Button details:', JSON.stringify(btnDetails));
        results.t08.buttonDetails = btnDetails;
      }
    }

    // =============================================
    // T-07: Why is MCQ grid empty?
    // =============================================
    console.log('\n=== T-07: MCQ Grid Investigation ===');
    await page.goto(analyticsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    const analyticsText = await page.evaluate(() => document.body.innerText);

    // Check MCQ section
    const mcqSectionText = analyticsText.substring(analyticsText.indexOf('Multiple Choice'), analyticsText.indexOf('Student Results'));
    console.log('MCQ section:', mcqSectionText.substring(0, 500));
    results.t07.mcqSectionText = mcqSectionText.substring(0, 500);

    const hasNoMCQData = analyticsText.includes('No MCQ performance data');
    console.log('No MCQ data message:', hasNoMCQData);
    results.t07.noMCQDataMessage = hasNoMCQData;

    // Check PerformanceGrid component content
    const gridContent = await page.evaluate(() => {
      const gridSection = document.querySelector('[class*="grid"], [class*="Grid"]');
      return gridSection ? gridSection.innerHTML.substring(0, 2000) : 'No grid element found';
    });
    console.log('Grid component HTML:', gridContent.substring(0, 500));
    results.t07.gridHTML = gridContent.substring(0, 500);

    // Check if performance data is empty due to filter issue
    // The analytics filters by classIds - if no classes match students, results are filtered out
    const classFilterText = analyticsText.substring(analyticsText.indexOf('Filters:'), analyticsText.indexOf('Total Students'));
    console.log('Filter section:', classFilterText);
    results.t07.filterSection = classFilterText;

    // Check Highest Score and Lowest Score values
    const statsSection = analyticsText.substring(analyticsText.indexOf('Total Students'), analyticsText.indexOf('AP Score'));
    console.log('Stats section:', statsSection);
    results.t07.statsSection = statsSection;

    // Interesting: T-07 shows Total Students=10, Average=70%, but Highest=0pts and Lowest=0pts
    // This suggests the `score` field is 0 in seed data (vs percentage which is calculated)
    // Let's check the seed data result structure

    // =============================================
    // T-05: Check grading panel - why is frqAnswers missing?
    // =============================================
    console.log('\n=== T-05: Grading Panel - Why empty? ===');
    await page.goto('http://localhost:5173/ap/gradebook', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Click Grade on Ethan Williams (Micro exam - should have frq answers)
    const gradeButtons = page.locator('button:has-text("Grade")');
    const gradeCount = await gradeButtons.count();
    console.log('Grade buttons:', gradeCount);

    // Look for Ethan Williams / Micro
    const rows = await page.evaluate(() => {
      const trs = document.querySelectorAll('tbody tr');
      return Array.from(trs).map((tr, i) => ({
        idx: i,
        text: tr.innerText.substring(0, 100)
      }));
    });
    console.log('Table rows:', JSON.stringify(rows));

    // Click Grade on an Ethan Williams (Micro exam pending)
    let ethanIdx = rows.findIndex(r => r.text.includes('Ethan'));
    if (ethanIdx === -1) ethanIdx = 0;
    console.log('Clicking Grade for row index:', ethanIdx);

    if (gradeCount > ethanIdx) {
      await gradeButtons.nth(ethanIdx).click();
      await page.waitForTimeout(3000);
      await takeScreenshot(page, 'p3_04_grading_panel_ethan');

      const panelText = await page.evaluate(() => document.body.innerText);
      console.log('Panel text after opening:', panelText.substring(panelText.indexOf('Grading:'), panelText.indexOf('Grading:') + 1000));

      // Check detailed panel HTML
      const panelHTML = await page.evaluate(() => {
        const fixed = document.querySelector('.fixed');
        return fixed ? fixed.innerHTML.substring(0, 5000) : 'No fixed element';
      });
      console.log('Grading panel HTML:', panelHTML.substring(0, 3000));
      results.t05.panelHTML = panelHTML.substring(0, 3000);

      // Check number inputs
      const numInputs = await page.locator('input[type="number"]').count();
      console.log('Number inputs in panel:', numInputs);
      results.t05.numInputs = numInputs;

      // Close panel
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }

    // =============================================
    // T-06: Verify View button behavior
    // =============================================
    console.log('\n=== T-06: Mark Complete and View button ===');

    // Select All status to see all submissions
    const statusSelect = page.locator('select').first();
    const options = await page.evaluate(() => {
      const sel = document.querySelector('select');
      return Array.from(sel?.options || []).map(o => o.value);
    });
    console.log('Status options:', options);

    // Switch to All
    if (options.includes('all')) {
      await statusSelect.selectOption('all');
      await page.waitForTimeout(2000);
      await takeScreenshot(page, 'p3_05_all_status');
    }

    const allText = await page.evaluate(() => document.body.innerText);
    const hasViewBtn = allText.includes('View');
    const viewBtnCount = await page.locator('button:has-text("View")').count();
    console.log('View button count with All filter:', viewBtnCount);
    results.t06.viewButtonCountWithAll = viewBtnCount;

    if (viewBtnCount > 0) {
      const viewBtn = page.locator('button:has-text("View")').first();
      await viewBtn.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, 'p3_06_view_panel');

      const viewPanelText = await page.evaluate(() => document.body.innerText);
      console.log('View panel text:', viewPanelText.substring(viewPanelText.indexOf('Grading:'), viewPanelText.indexOf('Grading:') + 500));
      results.t06.viewPanelText = viewPanelText.substring(0, 500);

      // Check if it's in view mode (no editable inputs)
      const numInputsInView = await page.locator('input[type="number"]').count();
      console.log('Number inputs in view mode:', numInputsInView);
      results.t06.numInputsInViewMode = numInputsInView;

      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }

    // =============================================
    // T-09: PDF Export verification
    // =============================================
    console.log('\n=== T-09: PDF Export ===');
    await page.goto(analyticsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    const downloadsBefore = downloads.length;
    console.log('Downloads before exports:', downloadsBefore);

    // Click Export Questions PDF
    const exportQsBtn = page.locator('button:has-text("Export Questions PDF")');
    const qsBtnEnabled = await exportQsBtn.isEnabled();
    const qsBtnDisabled = await exportQsBtn.getAttribute('disabled');
    console.log('Export Questions PDF - enabled:', qsBtnEnabled, 'disabled attr:', qsBtnDisabled);
    results.t09.exportQsEnabled = qsBtnEnabled;

    if (qsBtnEnabled) {
      const consoleCountBefore = results.consoleErrors.length;
      await exportQsBtn.click();
      console.log('Clicked Export Questions PDF');
      await page.waitForTimeout(6000);
      const newErrors = results.consoleErrors.slice(consoleCountBefore).filter(e => e.type === 'error');
      console.log('Console errors after export1:', newErrors.length, newErrors.map(e => e.text.substring(0, 100)));
      results.t09.export1Errors = newErrors.length;
      results.t09.export1ErrorText = newErrors.map(e => e.text.substring(0, 100));
    }

    await takeScreenshot(page, 'p3_07_after_export_qs');

    // Click Export with Answers
    const exportAnsBtn = page.locator('button:has-text("Export with Answers")');
    const ansBtnEnabled = await exportAnsBtn.isEnabled();
    console.log('Export with Answers - enabled:', ansBtnEnabled);
    results.t09.exportAnsEnabled = ansBtnEnabled;

    if (ansBtnEnabled) {
      const consoleCountBefore = results.consoleErrors.length;
      await exportAnsBtn.click();
      console.log('Clicked Export with Answers');
      await page.waitForTimeout(6000);
      const newErrors = results.consoleErrors.slice(consoleCountBefore).filter(e => e.type === 'error');
      console.log('Console errors after export2:', newErrors.length);
      results.t09.export2Errors = newErrors.length;
    }

    await takeScreenshot(page, 'p3_08_after_export_answers');
    console.log('Total downloads captured:', downloads.length - downloadsBefore);
    results.t09.downloadsTriggered = downloads.length - downloadsBefore;
    results.t09.downloads = downloads;

    // =============================================
    // Final summary
    // =============================================
    console.log('\n=== SUMMARY ===');
    console.log('T-05 num inputs:', results.t05.numInputs);
    console.log('T-06 view button count:', results.t06.viewButtonCountWithAll);
    console.log('T-07 no MCQ data:', results.t07.noMCQDataMessage);
    console.log('T-08 navigated to profile:', results.t08.navigated);
    console.log('T-09 downloads triggered:', results.t09.downloadsTriggered);
    console.log('Total console errors:', results.consoleErrors.filter(e => e.type === 'error').length);

  } catch (error) {
    console.error('ERROR:', error.message);
    results.error = error.message;
    await takeScreenshot(page, 'p3_ERROR').catch(() => {});
  } finally {
    await browser.close();
  }

  const resultsFile = path.join(__dirname, '..', 'src', 'apBoost', 'criteria_audit', 'playwright_reports', 'b8_audit_results_part3.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log('\nResults written to:', resultsFile);
  return results;
}

runAudit().catch(console.error);
