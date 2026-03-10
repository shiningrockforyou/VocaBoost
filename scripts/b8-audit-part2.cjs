/**
 * B8 Audit Script Part 2 - Deep inspection of T-05, T-06, T-07, T-08, T-09
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'src', 'apBoost', 'criteria_audit', 'playwright_reports', 'screenshots_B8');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const results = {
  loginSuccess: false,
  gradingPanelDetails: {},
  t05Details: {},
  t06Details: {},
  t07Details: {},
  t08Details: {},
  t09Details: {},
  consoleErrors: [],
};

async function takeScreenshot(page, name) {
  const filename = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`Screenshot saved: ${name}.png`);
  return filename;
}

async function login(page) {
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const emailField = page.locator('input[type="email"], input[name="email"]').first();
  await emailField.waitFor({ timeout: 10000 });
  await emailField.fill('teacher@apboost.test');
  const passwordField = page.locator('input[type="password"]').first();
  await passwordField.fill('Teacher123!');
  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });
  console.log('Login successful:', page.url());
}

async function runAudit() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      results.consoleErrors.push({
        type: msg.type(),
        text: msg.text().substring(0, 300),
        url: page.url(),
        timestamp: new Date().toISOString()
      });
    }
  });

  try {
    await login(page);
    results.loginSuccess = true;

    // =============================================
    // DEEP INSPECTION: Grading Panel (T-05/T-06)
    // =============================================
    console.log('\n=== DEEP INSPECTION: Grading Panel ===');
    await page.goto('http://localhost:5173/ap/gradebook', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Get full DOM structure of the gradebook
    const gradebookHTML = await page.evaluate(() => document.body.innerHTML.substring(0, 5000));
    console.log('Gradebook HTML (first 3000):', gradebookHTML.substring(0, 3000));

    // Get actual select options
    const statusSelectOptions = await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      return Array.from(selects).map(s => ({
        name: s.name || s.id || 'unnamed',
        value: s.value,
        options: Array.from(s.options).map(o => ({ value: o.value, text: o.text }))
      }));
    });
    console.log('Select options:', JSON.stringify(statusSelectOptions, null, 2));
    results.gradingPanelDetails.selectOptions = statusSelectOptions;

    // Click Grade button
    const gradeBtn = page.locator('button:has-text("Grade")').first();
    await gradeBtn.waitFor({ timeout: 5000 });
    await gradeBtn.click();
    await page.waitForTimeout(2000);
    await takeScreenshot(page, 'p2_01_grading_panel');

    // Get the full grading panel HTML
    const panelHTML = await page.evaluate(() => {
      // Look for the panel/modal element
      const panel = document.querySelector('[class*="panel"], [class*="Panel"], [class*="modal"], [class*="Modal"], [class*="drawer"], [class*="Drawer"], aside, [role="dialog"]');
      if (panel) return panel.innerHTML.substring(0, 8000);
      return document.body.innerHTML.substring(0, 8000);
    });
    console.log('Panel HTML (first 5000):', panelHTML.substring(0, 5000));
    results.gradingPanelDetails.panelHTML = panelHTML.substring(0, 2000);

    // Get all input elements in the panel
    const inputDetails = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input, textarea');
      return Array.from(inputs).map(i => ({
        type: i.type,
        value: i.value,
        placeholder: i.placeholder,
        name: i.name,
        id: i.id,
        className: i.className.substring(0, 100),
        parentText: i.parentElement ? i.parentElement.textContent.substring(0, 100) : ''
      }));
    });
    console.log('All inputs in page:', JSON.stringify(inputDetails, null, 2));
    results.gradingPanelDetails.inputs = inputDetails;

    // Check what's visible on the page
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('Full page text (first 2000):', pageText.substring(0, 2000));
    results.t05Details.pageTextWithPanel = pageText.substring(0, 2000);

    // Now look specifically for score-related content
    const scoreContent = await page.evaluate(() => {
      // Find all text containing "pts", "points", "score", "/"
      const allText = document.body.innerText;
      const lines = allText.split('\n').filter(l => l.match(/pts|points|score|\/\s*\d|grading/i));
      return lines;
    });
    console.log('Score-related content:', scoreContent);

    // Find ALL buttons in the panel
    const allButtons = await page.locator('button').allTextContents();
    console.log('All buttons visible:', allButtons);

    // Check if there's a panel visible with specific class
    const panelSelector = await page.evaluate(() => {
      const possiblePanels = [
        document.querySelector('[class*="GradingPanel"]'),
        document.querySelector('[class*="grading-panel"]'),
        document.querySelector('[class*="side-panel"]'),
        document.querySelector('[class*="SidePanel"]'),
        document.querySelector('aside'),
        document.querySelector('[role="dialog"]'),
        document.querySelector('[role="complementary"]'),
      ];
      const found = possiblePanels.find(p => p !== null);
      return found ? found.className + ' / ' + found.tagName : 'No panel found';
    });
    console.log('Panel element found:', panelSelector);

    // Find score inputs specifically
    const numberInputs = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="number"]');
      return inputs.length + ' number inputs';
    });
    console.log('Number inputs:', numberInputs);

    // Check if panel content has scrolled off - take viewport screenshot
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'p2_02_viewport.png'), fullPage: false });
    console.log('Viewport screenshot saved');

    // Scroll within the panel to find content
    await page.evaluate(() => {
      const panels = document.querySelectorAll('[class*="overflow-y-auto"], [class*="overflow-auto"], [style*="overflow"]');
      panels.forEach(p => {
        console.log('Scrollable panel:', p.className.substring(0, 50), 'scrollHeight:', p.scrollHeight);
      });
    });

    const scrollablePanels = await page.evaluate(() => {
      const panels = document.querySelectorAll('[class*="overflow-y-auto"], [class*="overflow-auto"], aside, [role="dialog"]');
      return Array.from(panels).map(p => ({
        tag: p.tagName,
        class: p.className.substring(0, 80),
        scrollHeight: p.scrollHeight,
        clientHeight: p.clientHeight,
        innerText: p.innerText.substring(0, 500)
      }));
    });
    console.log('Scrollable panels:', JSON.stringify(scrollablePanels, null, 2));
    results.gradingPanelDetails.scrollablePanels = scrollablePanels;

    // Try scrolling inside the panel
    await page.evaluate(() => {
      const panel = document.querySelector('aside, [role="dialog"], [class*="overflow-y-auto"]');
      if (panel) panel.scrollTop = 200;
    });
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'p2_03_panel_scrolled');

    // Get the full inner text now
    const panelInnerText = await page.evaluate(() => {
      const panel = document.querySelector('aside, [role="dialog"]') || document.body;
      return panel.innerText;
    });
    console.log('Panel inner text (full):', panelInnerText.substring(0, 3000));
    results.t05Details.panelInnerText = panelInnerText.substring(0, 3000);

    // Get count of number inputs after scrolling
    const numInputsNow = await page.evaluate(() => document.querySelectorAll('input[type="number"]').length);
    console.log('Number inputs now:', numInputsNow);

    // Try entering scores if inputs exist
    let scoreEntered = false;
    if (numInputsNow > 0) {
      const scoreInputs = page.locator('input[type="number"]');
      const count = await scoreInputs.count();
      console.log(`Found ${count} number inputs, entering scores...`);
      for (let i = 0; i < count; i++) {
        const input = scoreInputs.nth(i);
        const max = await input.getAttribute('max').catch(() => '3');
        const score = Math.min(2, parseInt(max) || 2);
        await input.fill(String(score));
        await page.waitForTimeout(200);
        scoreEntered = true;
      }
    } else {
      // Check for alternative score input patterns
      const altInputs = await page.evaluate(() => {
        // Check for all inputs
        const all = document.querySelectorAll('input');
        return Array.from(all).map(i => ({ type: i.type, class: i.className.substring(0, 80), value: i.value, placeholder: i.placeholder }));
      });
      console.log('All inputs (no type filter):', JSON.stringify(altInputs));
    }

    // Enter feedback
    const textareas = page.locator('textarea');
    const taCount = await textareas.count();
    console.log('Textarea count:', taCount);
    if (taCount > 0) {
      await textareas.first().fill('Good analysis. Consider more examples.');
      console.log('Feedback entered');
    }

    // Find Save Draft button
    const saveDraft = page.locator('button:has-text("Save Draft")');
    const saveDraftVisible = await saveDraft.isVisible().catch(() => false);
    console.log('Save Draft button:', saveDraftVisible);
    results.t05Details.saveDraftVisible = saveDraftVisible;

    if (saveDraftVisible) {
      const consoleCountBefore = results.consoleErrors.length;
      await saveDraft.click();
      await page.waitForTimeout(4000);
      await takeScreenshot(page, 'p2_04_after_save_draft');

      const consoleErrors = results.consoleErrors.slice(consoleCountBefore);
      console.log('Console errors during save:', consoleErrors.length);

      const textAfterSave = await page.evaluate(() => document.body.innerText);
      console.log('Text after save draft:', textAfterSave.substring(0, 1000));
      results.t05Details.textAfterSave = textAfterSave.substring(0, 1000);

      // Check for In Progress status
      const hasInProgress = textAfterSave.includes('In Progress');
      console.log('In Progress after save:', hasInProgress);
      results.t05Details.statusChangedToInProgress = hasInProgress;
    }

    // Close panel
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // =============================================
    // T-06: Mark Complete
    // =============================================
    console.log('\n=== T-06: Mark Complete ===');

    // Refresh page to see updated state
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await takeScreenshot(page, 'p2_05_gradebook_refreshed');

    // Get all select options
    const selectOptionsT06 = await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      return Array.from(selects).map(s => ({
        value: s.value,
        options: Array.from(s.options).map(o => ({ value: o.value, text: o.text }))
      }));
    });
    console.log('Select options for T06:', JSON.stringify(selectOptionsT06, null, 2));

    // Get the correct option value for "In Progress"
    const statusSelect = page.locator('select').first();
    const inProgressOption = selectOptionsT06[0]?.options?.find(o => o.text.toLowerCase().includes('progress') || o.value.toLowerCase().includes('progress'));
    console.log('In Progress option:', inProgressOption);

    if (inProgressOption) {
      await statusSelect.selectOption(inProgressOption.value);
      await page.waitForTimeout(2000);
      await takeScreenshot(page, 'p2_06_in_progress_filter');

      const inProgressText = await page.evaluate(() => document.body.innerText);
      console.log('Page with In Progress filter:', inProgressText.substring(0, 1000));
      results.t06Details.inProgressFilterText = inProgressText.substring(0, 1000);
    } else {
      // Try "all" to see everything
      const allOption = selectOptionsT06[0]?.options?.find(o => o.text.toLowerCase() === 'all' || o.value === 'all');
      if (allOption) {
        await statusSelect.selectOption(allOption.value);
        await page.waitForTimeout(2000);
        await takeScreenshot(page, 'p2_06_all_filter');
      }
    }

    const textT06 = await page.evaluate(() => document.body.innerText);
    const hasInProgressRow = textT06.includes('In Progress');
    const hasGradeBtn = textT06.includes('Grade');
    console.log('In Progress row visible:', hasInProgressRow, '| Grade button:', hasGradeBtn);
    results.t06Details.inProgressRowVisible = hasInProgressRow;

    if (hasGradeBtn) {
      const gradeBtnT06 = page.locator('button:has-text("Grade")').first();
      await gradeBtnT06.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, 'p2_07_grading_panel_t06');

      const panelTextT06 = await page.evaluate(() => document.body.innerText);
      console.log('Panel T06:', panelTextT06.substring(0, 1000));

      // Find Mark Complete button
      const markCompleteBtn = page.locator('button:has-text("Mark Complete")');
      const markCompleteVisible = await markCompleteBtn.isVisible().catch(() => false);
      console.log('Mark Complete button:', markCompleteVisible);
      results.t06Details.markCompleteVisible = markCompleteVisible;

      // Enter scores if needed
      const numInputsT06 = await page.locator('input[type="number"]').count();
      if (numInputsT06 > 0) {
        const scoreInputsT06 = page.locator('input[type="number"]');
        for (let i = 0; i < numInputsT06; i++) {
          const input = scoreInputsT06.nth(i);
          const currentVal = await input.inputValue();
          const max = await input.getAttribute('max').catch(() => '3');
          if (!currentVal || currentVal === '0') {
            await input.fill(String(Math.min(2, parseInt(max) || 2)));
            await page.waitForTimeout(200);
          }
          console.log(`Score input ${i}: value=${currentVal}, max=${max}`);
        }
      }

      if (markCompleteVisible) {
        await markCompleteBtn.click();
        await page.waitForTimeout(4000);
        await takeScreenshot(page, 'p2_08_after_mark_complete');

        const textAfterComplete = await page.evaluate(() => document.body.innerText);
        console.log('Text after mark complete:', textAfterComplete.substring(0, 1000));
        results.t06Details.textAfterComplete = textAfterComplete.substring(0, 1000);

        // Check if status shows Complete
        const hasComplete = textAfterComplete.includes('Complete');
        console.log('Complete status shown:', hasComplete);
        results.t06Details.completeStatusShown = hasComplete;

        // Check for View button
        const viewBtnT06 = page.locator('button:has-text("View")');
        const viewBtnCount = await viewBtnT06.count();
        console.log('View buttons:', viewBtnCount);
        results.t06Details.viewButtonCount = viewBtnCount;

        if (viewBtnCount > 0) {
          await viewBtnT06.first().click();
          await page.waitForTimeout(2000);
          await takeScreenshot(page, 'p2_09_view_completed');
          const viewText = await page.evaluate(() => document.body.innerText);
          console.log('View panel text:', viewText.substring(0, 500));
          results.t06Details.viewPanelText = viewText.substring(0, 500);

          // Close panel
          await page.keyboard.press('Escape');
          await page.waitForTimeout(1000);
        }
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      }
    }

    // =============================================
    // T-07: Exam Analytics Page
    // =============================================
    console.log('\n=== T-07: Exam Analytics Page ===');
    const analyticsUrl = 'http://localhost:5173/ap/teacher/analytics/test_micro_full_1';
    await page.goto(analyticsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    await takeScreenshot(page, 'p2_10_analytics_top');

    // Get detailed page content
    const analyticsHTML = await page.evaluate(() => document.body.innerHTML.substring(0, 10000));
    const analyticsText = await page.evaluate(() => document.body.innerText);

    console.log('Analytics page text:', analyticsText.substring(0, 3000));
    results.t07Details.pageText = analyticsText.substring(0, 3000);

    // Detailed checks
    const checks = {
      heading: analyticsText.includes('Exam Analytics') || analyticsText.includes('Analytics'),
      testTitle: analyticsText.includes('Micro') || analyticsText.includes('Microeconomics'),
      exportQuestions: analyticsText.includes('Export Questions') || analyticsText.includes('Questions PDF'),
      exportAnswers: analyticsText.includes('Export with Answers') || analyticsText.includes('Answers PDF'),
      backButton: analyticsText.includes('Back') || analyticsText.includes('← Back'),
      totalStudents: analyticsText.includes('Total Students') || analyticsText.includes('Students'),
      avgScore: analyticsText.includes('Average') || analyticsText.includes('Avg'),
      highScore: analyticsText.includes('Highest') || analyticsText.includes('High Score'),
      lowScore: analyticsText.includes('Lowest') || analyticsText.includes('Low Score'),
      apScoreDistribution: analyticsText.includes('Score Distribution') || analyticsText.includes('Distribution') || analyticsText.match(/\b[1-5]\b.*student/i),
      mcqSection: analyticsText.includes('Multiple Choice') || analyticsText.includes('MCQ'),
      gridToggle: analyticsText.includes('Grid') && analyticsText.includes('Detailed'),
      studentResultsTable: analyticsText.includes('Student Results') || analyticsText.includes('Student Name'),
    };

    console.log('T-07 checks:', JSON.stringify(checks, null, 2));
    results.t07Details.checks = checks;

    // Get all buttons
    const analyticsButtons = await page.locator('button').allTextContents();
    console.log('Analytics buttons:', analyticsButtons);
    results.t07Details.buttons = analyticsButtons;

    // Get all links
    const analyticsLinks = await page.evaluate(() => {
      const links = document.querySelectorAll('a');
      return Array.from(links).map(a => ({ href: a.href, text: a.textContent.trim() }));
    });
    console.log('Analytics links:', JSON.stringify(analyticsLinks));
    results.t07Details.links = analyticsLinks;

    // Scroll to see more
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'p2_11_analytics_mid');

    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'p2_12_analytics_mid2');

    // Try Detailed toggle
    const detailedBtn = page.locator('button:has-text("Detailed")');
    const detailedVisible = await detailedBtn.isVisible().catch(() => false);
    if (detailedVisible) {
      await detailedBtn.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, 'p2_13_analytics_detailed');
      console.log('Detailed view clicked');

      // Go back to Grid
      const gridBtn = page.locator('button:has-text("Grid")');
      if (await gridBtn.isVisible().catch(() => false)) {
        await gridBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // Try clicking a question box in grid
    const questionGrid = page.locator('[class*="grid"] button, [class*="square"] button, .mcq-grid button');
    const gridBtnCount = await questionGrid.count();
    console.log('Grid question buttons:', gridBtnCount);

    if (gridBtnCount > 0) {
      await questionGrid.first().click();
      await page.waitForTimeout(1500);
      await takeScreenshot(page, 'p2_14_question_modal');

      const modalText = await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]') || document.body;
        return modal.innerText.substring(0, 500);
      });
      console.log('Question modal text:', modalText);
      results.t07Details.questionModalText = modalText;

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Scroll to bottom to see Student Results table
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'p2_15_analytics_bottom');

    const bottomText = await page.evaluate(() => document.body.innerText);
    console.log('Bottom of analytics:', bottomText.substring(bottomText.length - 2000));
    results.t07Details.bottomText = bottomText.substring(bottomText.length - 2000);

    // =============================================
    // T-08: Student Profile Navigation
    // =============================================
    console.log('\n=== T-08: Student Profile Navigation ===');

    // Get all clickable elements in the student results area
    const studentResultsSection = await page.evaluate(() => {
      // Find the student results table
      const tables = document.querySelectorAll('table, [class*="Table"], [class*="Results"]');
      return Array.from(tables).map(t => ({
        class: t.className.substring(0, 80),
        rows: t.querySelectorAll('tr, [class*="row"]').length,
        firstRow: t.querySelector('tr:not(:first-child)')?.innerText?.substring(0, 200) || ''
      }));
    });
    console.log('Student results tables:', JSON.stringify(studentResultsSection, null, 2));

    // Find student links or clickable rows
    const studentLinks = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/student"], a[href*="student"]');
      const buttons = document.querySelectorAll('[data-student-id], [data-userid]');
      return {
        links: Array.from(links).map(l => ({ href: l.href, text: l.textContent.trim() })),
        buttons: Array.from(buttons).map(b => ({ text: b.textContent.trim().substring(0, 50), dataId: b.dataset.studentId || b.dataset.userid }))
      };
    });
    console.log('Student links/buttons:', JSON.stringify(studentLinks, null, 2));

    // Try clicking on a student name in the table
    const studentNameCells = page.locator('table td:first-child, [class*="student-name"], [class*="StudentName"]');
    const cellCount = await studentNameCells.count();
    console.log('Student name cells:', cellCount);
    results.t08Details.studentCellCount = cellCount;

    if (cellCount > 0) {
      const firstCellText = await studentNameCells.first().textContent();
      console.log('First student cell text:', firstCellText);
      await studentNameCells.first().click();
      await page.waitForTimeout(3000);

      const urlAfterClick = page.url();
      console.log('URL after clicking student cell:', urlAfterClick);
      results.t08Details.urlAfterClick = urlAfterClick;

      await takeScreenshot(page, 'p2_16_after_student_click');
      const profileText = await page.evaluate(() => document.body.innerText);
      console.log('Profile page text:', profileText.substring(0, 1500));
      results.t08Details.profileText = profileText.substring(0, 1500);

      if (urlAfterClick.includes('/student')) {
        results.t08Details.navigatedToProfile = true;
        console.log('Navigated to student profile page');
      } else {
        results.t08Details.navigatedToProfile = false;
        console.log('Did NOT navigate to student profile - stayed on:', urlAfterClick);
      }
    } else {
      // Try clicking any row in the Student Results table
      const tableRows = page.locator('tbody tr');
      const rowCount = await tableRows.count();
      console.log('Table rows found:', rowCount);
      results.t08Details.tableRowCount = rowCount;

      if (rowCount > 0) {
        await tableRows.first().click();
        await page.waitForTimeout(3000);
        const urlAfterRowClick = page.url();
        console.log('URL after clicking table row:', urlAfterRowClick);
        results.t08Details.urlAfterClick = urlAfterRowClick;
        await takeScreenshot(page, 'p2_16_after_row_click');
      } else {
        // No student data found in table
        console.log('No student table rows found - checking for student data elsewhere');
        const pageForStudents = await page.evaluate(() => document.body.innerText);
        const hasStudentData = pageForStudents.includes('student_seed') || pageForStudents.includes('Student ');
        console.log('Student data found elsewhere:', hasStudentData);
        results.t08Details.hasStudentData = hasStudentData;
      }
    }

    // =============================================
    // T-09: Export PDFs
    // =============================================
    console.log('\n=== T-09: Export PDFs ===');
    await page.goto('http://localhost:5173/ap/teacher/analytics/test_micro_full_1', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    // Get all button details
    const exportButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      return Array.from(buttons).map(b => ({
        text: b.textContent.trim(),
        class: b.className.substring(0, 80),
        disabled: b.disabled,
        onclick: b.onclick ? 'has onclick' : 'no onclick'
      })).filter(b => b.text.length > 0);
    });
    console.log('All buttons on analytics page:', JSON.stringify(exportButtons, null, 2));
    results.t09Details.allButtons = exportButtons;

    // Look for PDF/export related buttons with flexible matching
    const pdfButtons = exportButtons.filter(b =>
      b.text.toLowerCase().includes('export') ||
      b.text.toLowerCase().includes('pdf') ||
      b.text.toLowerCase().includes('download') ||
      b.text.toLowerCase().includes('print')
    );
    console.log('PDF/Export buttons:', JSON.stringify(pdfButtons, null, 2));
    results.t09Details.pdfButtons = pdfButtons;

    // Try each potential export button
    for (const btnInfo of pdfButtons) {
      console.log(`Clicking button: "${btnInfo.text}"`);
      const btn = page.locator(`button:has-text("${btnInfo.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}")`).first();
      const consoleCountBefore = results.consoleErrors.length;

      await btn.click().catch(e => console.log('Click error:', e.message));
      await page.waitForTimeout(4000);

      const consoleErrsNew = results.consoleErrors.slice(consoleCountBefore);
      const hasErrors = consoleErrsNew.filter(e => e.type === 'error').length > 0;
      console.log(`After clicking "${btnInfo.text}": ${hasErrors ? 'ERRORS' : 'No errors'}`);
      results.t09Details[btnInfo.text] = { clicked: true, hasErrors, errors: consoleErrsNew.map(e => e.text) };

      await takeScreenshot(page, `p2_17_after_export_${btnInfo.text.replace(/\s+/g, '_').toLowerCase().substring(0, 20)}`);
    }

    if (pdfButtons.length === 0) {
      // Look specifically with the exact button text
      const exactButtons = ['Export Questions PDF', 'Export with Answers', 'Export', 'Download PDF'];
      for (const exactText of exactButtons) {
        const btn = page.locator(`button`).filter({ hasText: exactText });
        const count = await btn.count();
        if (count > 0) {
          console.log(`Found button with text: "${exactText}"`);
          pdfButtons.push({ text: exactText });
        }
      }
    }

    // Final screenshot
    await takeScreenshot(page, 'p2_18_analytics_final');

    // Check console errors for the entire session
    const allConsoleErrors = results.consoleErrors.filter(e => e.type === 'error');
    console.log('\nTotal console errors:', allConsoleErrors.length);
    allConsoleErrors.forEach(e => console.log('  ERROR:', e.text.substring(0, 200)));

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
    results.error = error.message;
    await takeScreenshot(page, 'p2_ERROR').catch(() => {});
  } finally {
    await browser.close();
  }

  // Write results
  const resultsFile = path.join(__dirname, '..', 'src', 'apBoost', 'criteria_audit', 'playwright_reports', 'b8_audit_results_part2.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log('\nResults written to:', resultsFile);

  return results;
}

runAudit().catch(console.error);
