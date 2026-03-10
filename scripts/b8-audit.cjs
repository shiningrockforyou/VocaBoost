/**
 * B8 Audit Script - Teacher Grading & Analytics
 * Tests: T-05, T-06, T-07, T-08, T-09
 *
 * Flow:
 *  1. Login as teacher -> /ap/gradebook -> filter to Pending
 *  2. Click "Grade" on a seed result -> enter scores -> save draft (T-05)
 *  3. Re-open -> mark complete -> verify status change (T-06)
 *  4. Navigate to /ap/teacher/analytics/test_micro_full_1 -> verify analytics (T-07)
 *  5. Click student name -> verify APStudentProfile (T-08)
 *  6. Export PDF from analytics (T-09)
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'src', 'apBoost', 'criteria_audit', 'playwright_reports', 'screenshots_B8');
const STATE_FILE = path.join(__dirname, '..', 'src', 'apBoost', 'criteria_audit', 'playwright_reports', 'audit_state.json');

// Ensure screenshots dir exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const results = {
  loginSuccess: false,
  scenarios: {
    T05: { status: 'PENDING', notes: [], findings: [] },
    T06: { status: 'PENDING', notes: [], findings: [] },
    T07: { status: 'PENDING', notes: [], findings: [] },
    T08: { status: 'PENDING', notes: [], findings: [] },
    T09: { status: 'PENDING', notes: [], findings: [] },
  },
  consoleErrors: [],
  screenshots: [],
};

async function takeScreenshot(page, name) {
  const filename = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  results.screenshots.push(filename);
  console.log(`Screenshot saved: ${name}.png`);
  return filename;
}

async function getPageText(page) {
  return page.evaluate(() => document.body.innerText);
}

async function getConsoleErrors(page) {
  // Returns accumulated errors
  return results.consoleErrors.filter(e => e.url === page.url());
}

async function runB8Audit() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Collect console messages
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      results.consoleErrors.push({
        type: msg.type(),
        text: msg.text(),
        url: page.url(),
        timestamp: new Date().toISOString()
      });
    }
  });

  try {
    // =============================================
    // LOGIN
    // =============================================
    console.log('\n=== LOGIN ===');
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await takeScreenshot(page, '00_login_page');

    const emailField = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    await emailField.waitFor({ timeout: 10000 });
    await emailField.fill('teacher@apboost.test');

    const passwordField = page.locator('input[type="password"]').first();
    await passwordField.fill('Teacher123!');

    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login"), button:has-text("Log In")').first();
    await submitBtn.click();

    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });
    console.log('Login successful. Current URL:', page.url());
    results.loginSuccess = true;
    await takeScreenshot(page, '01_post_login');

    // =============================================
    // T-05: Grade FRQ Submission via Grading Panel
    // =============================================
    console.log('\n=== T-05: Grade FRQ Submission via Grading Panel ===');

    await page.goto('http://localhost:5173/ap/gradebook', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '02_gradebook_initial');

    const pageText = await getPageText(page);
    console.log('Gradebook page text (first 500):', pageText.substring(0, 500));

    // Verify page heading
    const headingEl = page.locator('h1, h2').first();
    const headingText = await headingEl.textContent().catch(() => '');
    console.log('Heading text:', headingText);

    // Check for "Gradebook" heading
    const hasGradebookHeading = pageText.includes('Gradebook');
    results.scenarios.T05.notes.push(`Gradebook heading found: ${hasGradebookHeading}`);

    // Check status filter is Pending by default
    const statusFilter = page.locator('select').first();
    const statusValue = await statusFilter.evaluate(el => el.value).catch(() => 'N/A');
    console.log('Status filter value:', statusValue);
    results.scenarios.T05.notes.push(`Status filter value: ${statusValue}`);

    // Check for pending rows
    const gradeButtons = page.locator('button:has-text("Grade")');
    const gradeButtonCount = await gradeButtons.count();
    console.log('Grade buttons found:', gradeButtonCount);
    results.scenarios.T05.notes.push(`Grade buttons found: ${gradeButtonCount}`);

    if (gradeButtonCount === 0) {
      // Try switching to All status to find any rows
      const selects = await page.locator('select').all();
      if (selects.length > 0) {
        await selects[0].selectOption('all');
        await page.waitForTimeout(2000);
        const gradeButtonsAfterAll = page.locator('button:has-text("Grade")');
        const countAfterAll = await gradeButtonsAfterAll.count();
        console.log('Grade buttons after selecting All status:', countAfterAll);
        results.scenarios.T05.notes.push(`Grade buttons after All filter: ${countAfterAll}`);

        // Reset to Pending
        await selects[0].selectOption('pending');
        await page.waitForTimeout(2000);
      }
    }

    await takeScreenshot(page, '03_gradebook_pending_filter');

    // Click Grade button if available
    const firstGradeBtn = page.locator('button:has-text("Grade")').first();
    const gradeButtonVisible = await firstGradeBtn.isVisible().catch(() => false);

    if (gradeButtonVisible) {
      console.log('Clicking first Grade button...');
      await firstGradeBtn.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, '04_grading_panel_opened');

      const pageTextAfterClick = await getPageText(page);

      // Verify grading panel elements
      const hasGradingPanel = pageTextAfterClick.includes('Grading') || pageTextAfterClick.includes('Student Response') || pageTextAfterClick.includes('Total FRQ');
      console.log('Grading panel opened:', hasGradingPanel);
      results.scenarios.T05.notes.push(`Grading panel opened: ${hasGradingPanel}`);

      // Check for panel header
      const panelHeader = pageTextAfterClick.match(/Grading:\s*[^\n]+/);
      console.log('Panel header:', panelHeader ? panelHeader[0] : 'Not found');

      // Check for score summary
      const hasScoreSummary = pageTextAfterClick.includes('Total FRQ Score') || pageTextAfterClick.includes('Total Score');
      console.log('Score summary bar found:', hasScoreSummary);
      results.scenarios.T05.notes.push(`Score summary bar: ${hasScoreSummary}`);

      // Check for sub-questions and response boxes
      const hasStudentResponse = pageTextAfterClick.includes('Student Response');
      const hasSubQuestions = pageTextAfterClick.match(/\([a-z]\)/g);
      console.log('Student responses shown:', hasStudentResponse);
      console.log('Sub-question labels found:', hasSubQuestions ? hasSubQuestions.length : 0);
      results.scenarios.T05.notes.push(`Student responses shown: ${hasStudentResponse}`);

      // Find score input fields
      const scoreInputs = page.locator('input[type="number"]');
      const scoreInputCount = await scoreInputs.count();
      console.log('Score input fields found:', scoreInputCount);
      results.scenarios.T05.notes.push(`Score input fields: ${scoreInputCount}`);

      if (scoreInputCount > 0) {
        // Enter a score in the first field
        const firstInput = scoreInputs.first();
        const maxPts = await firstInput.getAttribute('max').catch(() => '3');
        const enterScore = Math.min(2, parseInt(maxPts) || 2);
        await firstInput.fill(String(enterScore));
        console.log(`Entered score ${enterScore} in first field (max: ${maxPts})`);
        await page.waitForTimeout(500);

        // If there's a second input, enter a score
        if (scoreInputCount > 1) {
          const secondInput = scoreInputs.nth(1);
          const max2 = await secondInput.getAttribute('max').catch(() => '3');
          await secondInput.fill(String(Math.min(3, parseInt(max2) || 3)));
          await page.waitForTimeout(500);
        }

        await takeScreenshot(page, '05_scores_entered');
      }

      // Find feedback textarea
      const feedbackTextarea = page.locator('textarea');
      const feedbackCount = await feedbackTextarea.count();
      console.log('Feedback textarea found:', feedbackCount > 0);
      results.scenarios.T05.notes.push(`Feedback textarea: ${feedbackCount > 0}`);

      if (feedbackCount > 0) {
        await feedbackTextarea.first().fill('Good analysis. Consider including more specific examples.');
        console.log('Feedback entered');
      }

      // Check score update in summary
      await page.waitForTimeout(500);
      const textAfterScores = await getPageText(page);
      const scorePattern = textAfterScores.match(/Total FRQ Score:\s*[\d]+\s*\/\s*[\d]+/);
      console.log('Score summary after entry:', scorePattern ? scorePattern[0] : 'Not found');

      // Click Save Draft
      const saveDraftBtn = page.locator('button:has-text("Save Draft")');
      const saveDraftVisible = await saveDraftBtn.isVisible().catch(() => false);
      console.log('Save Draft button visible:', saveDraftVisible);
      results.scenarios.T05.notes.push(`Save Draft button: ${saveDraftVisible}`);

      if (saveDraftVisible) {
        await saveDraftBtn.click();
        console.log('Save Draft clicked');
        await page.waitForTimeout(3000); // Wait for save
        await takeScreenshot(page, '06_after_save_draft');

        const textAfterSave = await getPageText(page);
        const showsSaving = textAfterSave.includes('Saving') || textAfterSave.includes('Saved') || textAfterSave.includes('saved');
        console.log('Saving indication shown:', showsSaving);
        results.scenarios.T05.notes.push(`Saving feedback: ${showsSaving}`);
      } else {
        results.scenarios.T05.findings.push({
          severity: 'High-Priority',
          description: 'Save Draft button not found in grading panel'
        });
      }

      // Close the grading panel
      const closeBtn = page.locator('button[aria-label*="close" i], button:has-text("×"), button:has-text("Close"), [data-testid="close-panel"]').first();
      const closeBtnVisible = await closeBtn.isVisible().catch(() => false);
      if (closeBtnVisible) {
        await closeBtn.click();
        await page.waitForTimeout(1000);
        console.log('Panel closed');
      } else {
        // Try pressing Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
        console.log('Tried Escape to close panel');
      }

      await takeScreenshot(page, '07_after_panel_close');

      // Check if status changed to "In Progress"
      const textAfterClose = await getPageText(page);
      const hasInProgress = textAfterClose.includes('In Progress') || textAfterClose.includes('in_progress');
      console.log('In Progress status found after save:', hasInProgress);
      results.scenarios.T05.notes.push(`Status changed to In Progress: ${hasInProgress}`);

      if (hasInProgress) {
        results.scenarios.T05.status = 'PASS';
      } else if (saveDraftVisible) {
        results.scenarios.T05.status = 'PARTIAL';
        results.scenarios.T05.findings.push({
          severity: 'High-Priority',
          description: 'After Save Draft, gradebook status did not show In Progress'
        });
      } else {
        results.scenarios.T05.status = 'FAIL';
      }
    } else {
      console.log('No Grade button visible - checking page state');
      // Check if the gradebook loaded at all
      const noSubmissions = pageText.includes('No submissions') || pageText.includes('no submissions');
      if (noSubmissions) {
        results.scenarios.T05.notes.push('Gradebook shows "No submissions" message');
        results.scenarios.T05.findings.push({
          severity: 'Blocker',
          description: 'No pending submissions found in gradebook - seed data may be missing'
        });
      }
      results.scenarios.T05.status = 'FAIL';
    }

    // =============================================
    // T-06: Complete FRQ Grading - Mark Complete
    // =============================================
    console.log('\n=== T-06: Complete FRQ Grading - Mark Complete ===');

    // Make sure we're still on gradebook
    const currentUrl = page.url();
    if (!currentUrl.includes('/gradebook')) {
      await page.goto('http://localhost:5173/ap/gradebook', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
    }

    // Filter by "In Progress" to find the draft we just saved
    const selects = await page.locator('select').all();
    if (selects.length > 0) {
      // Change status filter to see In Progress items
      await selects[0].selectOption('in_progress');
      await page.waitForTimeout(2000);
      await takeScreenshot(page, '08_gradebook_in_progress_filter');
    }

    const inProgressText = await getPageText(page);
    const inProgressGradeBtn = page.locator('button:has-text("Grade")').first();
    const inProgressGradeBtnVisible = await inProgressGradeBtn.isVisible().catch(() => false);
    console.log('In Progress Grade button visible:', inProgressGradeBtnVisible);
    results.scenarios.T06.notes.push(`In Progress Grade button: ${inProgressGradeBtnVisible}`);

    if (!inProgressGradeBtnVisible) {
      // Maybe it's still pending - try All
      if (selects.length > 0) {
        await selects[0].selectOption('all');
        await page.waitForTimeout(2000);
      }

      // Try to find any Grade button
      const anyGradeBtn = page.locator('button:has-text("Grade")').first();
      const anyGradeBtnVisible = await anyGradeBtn.isVisible().catch(() => false);
      if (anyGradeBtnVisible) {
        await anyGradeBtn.click();
        await page.waitForTimeout(2000);
      }
    } else {
      await inProgressGradeBtn.click();
      await page.waitForTimeout(2000);
    }

    await takeScreenshot(page, '09_grading_panel_t06');
    const panelTextT06 = await getPageText(page);

    // Check that previously saved scores are shown
    const hasMarkComplete = panelTextT06.includes('Mark Complete') || panelTextT06.includes('mark complete');
    console.log('Mark Complete button found:', hasMarkComplete);
    results.scenarios.T06.notes.push(`Mark Complete button: ${hasMarkComplete}`);

    // Check if scores are pre-populated (from T-05 draft)
    const scoreInputsT06 = page.locator('input[type="number"]');
    const scoreInputCountT06 = await scoreInputsT06.count();
    console.log('Score inputs count in T-06:', scoreInputCountT06);

    if (scoreInputCountT06 > 0) {
      const firstInputValue = await scoreInputsT06.first().inputValue().catch(() => '');
      console.log('First score input value:', firstInputValue);
      results.scenarios.T06.notes.push(`Draft score persisted: ${firstInputValue !== '' && firstInputValue !== '0'}`);
    }

    const markCompleteBtn = page.locator('button:has-text("Mark Complete")');
    const markCompleteBtnVisible = await markCompleteBtn.isVisible().catch(() => false);
    results.scenarios.T06.notes.push(`Mark Complete button visible: ${markCompleteBtnVisible}`);

    if (markCompleteBtnVisible) {
      // Make sure there are scores before marking complete
      if (scoreInputCountT06 > 0) {
        const firstVal = await scoreInputsT06.first().inputValue().catch(() => '0');
        if (firstVal === '' || firstVal === '0') {
          // Fill in a score
          const maxPts = await scoreInputsT06.first().getAttribute('max').catch(() => '3');
          await scoreInputsT06.first().fill(String(Math.min(2, parseInt(maxPts) || 2)));
        }
      }

      await markCompleteBtn.click();
      console.log('Mark Complete clicked');
      await page.waitForTimeout(3000);
      await takeScreenshot(page, '10_after_mark_complete');

      const textAfterComplete = await getPageText(page);
      const hasComplete = textAfterComplete.includes('Complete') || textAfterComplete.includes('Completed') || textAfterComplete.includes('complete');
      console.log('Complete status found:', hasComplete);

      // Check if panel closed automatically
      const panelStillOpen = textAfterComplete.includes('Mark Complete');
      console.log('Panel auto-closed:', !panelStillOpen);
      results.scenarios.T06.notes.push(`Panel auto-closed: ${!panelStillOpen}`);

      // Verify "View" button appears for completed row
      const viewBtn = page.locator('button:has-text("View")');
      const viewBtnCount = await viewBtn.count();
      console.log('"View" buttons found:', viewBtnCount);
      results.scenarios.T06.notes.push(`View button appeared: ${viewBtnCount > 0}`);

      if (viewBtnCount > 0) {
        await viewBtn.first().click();
        await page.waitForTimeout(2000);
        await takeScreenshot(page, '11_view_completed_panel');
        const viewText = await getPageText(page);
        console.log('View mode opened, has scores:', viewText.includes('/'));
        results.scenarios.T06.notes.push('Clicked View, panel opened in view mode');

        // Close the panel
        const closeViewBtn = page.locator('button[aria-label*="close" i], button:has-text("×"), button:has-text("Close")').first();
        await closeViewBtn.click().catch(() => page.keyboard.press('Escape'));
        await page.waitForTimeout(1000);
      }

      results.scenarios.T06.status = viewBtnCount > 0 ? 'PASS' : 'PARTIAL';
    } else {
      results.scenarios.T06.findings.push({
        severity: 'High-Priority',
        description: 'Mark Complete button not found in grading panel'
      });
      results.scenarios.T06.status = 'FAIL';

      // Close panel if open
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }

    // =============================================
    // T-07: Exam Analytics Page
    // =============================================
    console.log('\n=== T-07: Exam Analytics Page ===');

    const analyticsUrl = 'http://localhost:5173/ap/teacher/analytics/test_micro_full_1';
    await page.goto(analyticsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000); // Analytics may take time to load
    await takeScreenshot(page, '12_analytics_initial');

    const analyticsText = await getPageText(page);
    console.log('Analytics page text (first 1000):', analyticsText.substring(0, 1000));

    // Check page heading
    const hasAnalyticsHeading = analyticsText.includes('Exam Analytics') || analyticsText.includes('Analytics');
    console.log('Analytics heading found:', hasAnalyticsHeading);
    results.scenarios.T07.notes.push(`Analytics heading: ${hasAnalyticsHeading}`);

    // Check for test title
    const hasMicroTitle = analyticsText.includes('Micro') || analyticsText.includes('micro');
    console.log('Micro test title found:', hasMicroTitle);
    results.scenarios.T07.notes.push(`Micro test title: ${hasMicroTitle}`);

    // Check for action buttons
    const hasExportBtn = analyticsText.includes('Export') || analyticsText.includes('PDF');
    const hasBackBtn = analyticsText.includes('Back') || analyticsText.includes('back');
    console.log('Export button found:', hasExportBtn, '| Back button:', hasBackBtn);
    results.scenarios.T07.notes.push(`Export buttons: ${hasExportBtn} | Back button: ${hasBackBtn}`);

    // Check for summary stats
    const hasTotalStudents = analyticsText.includes('Total Students') || analyticsText.includes('Students');
    const hasAvgScore = analyticsText.includes('Average Score') || analyticsText.includes('Average');
    const hasHighScore = analyticsText.includes('Highest') || analyticsText.includes('Highest Score');
    const hasLowScore = analyticsText.includes('Lowest') || analyticsText.includes('Lowest Score');
    console.log('Summary stats - Total Students:', hasTotalStudents, '| Avg:', hasAvgScore, '| High:', hasHighScore, '| Low:', hasLowScore);
    results.scenarios.T07.notes.push(`Summary stats: Total=${hasTotalStudents} Avg=${hasAvgScore} High=${hasHighScore} Low=${hasLowScore}`);

    // Check for AP Score Distribution
    const hasScoreDistribution = analyticsText.includes('Score Distribution') || analyticsText.includes('Distribution') || analyticsText.includes('AP Score');
    console.log('AP Score distribution found:', hasScoreDistribution);
    results.scenarios.T07.notes.push(`AP Score distribution: ${hasScoreDistribution}`);

    // Check for MCQ Section
    const hasMCQSection = analyticsText.includes('Multiple Choice') || analyticsText.includes('MCQ');
    console.log('MCQ section found:', hasMCQSection);
    results.scenarios.T07.notes.push(`MCQ section: ${hasMCQSection}`);

    // Check for Grid/Detailed toggle
    const hasGridToggle = analyticsText.includes('Grid') || analyticsText.includes('Detailed');
    console.log('Grid/Detailed toggle found:', hasGridToggle);
    results.scenarios.T07.notes.push(`Grid/Detailed toggle: ${hasGridToggle}`);

    await takeScreenshot(page, '13_analytics_top');

    // Scroll down to see more content
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '14_analytics_middle');

    // Try clicking the Detailed toggle
    const detailedBtn = page.locator('button:has-text("Detailed"), button:has-text("detailed")');
    const detailedBtnVisible = await detailedBtn.isVisible().catch(() => false);
    console.log('Detailed toggle visible:', detailedBtnVisible);
    results.scenarios.T07.notes.push(`Detailed toggle visible: ${detailedBtnVisible}`);

    if (detailedBtnVisible) {
      await detailedBtn.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, '15_analytics_detailed_view');
      const detailedText = await getPageText(page);
      const hasDetailedContent = detailedText.includes('%') || detailedText.includes('correct');
      console.log('Detailed view shows per-question data:', hasDetailedContent);
      results.scenarios.T07.notes.push(`Detailed view content: ${hasDetailedContent}`);
    }

    // Try clicking a question to open detail modal
    // First go back to grid view
    const gridBtn = page.locator('button:has-text("Grid"), button:has-text("grid")');
    const gridBtnVisible = await gridBtn.isVisible().catch(() => false);
    if (gridBtnVisible) {
      await gridBtn.click();
      await page.waitForTimeout(1000);
    }

    // Look for clickable question boxes in the grid
    const questionBoxes = page.locator('[class*="question"], [class*="mcq"], [class*="grid"] button, [class*="square"]');
    const qBoxCount = await questionBoxes.count();
    console.log('Question boxes found:', qBoxCount);
    results.scenarios.T07.notes.push(`Question boxes in grid: ${qBoxCount}`);

    if (qBoxCount > 0) {
      await questionBoxes.first().click().catch(async () => {
        // Try clicking on a number in the grid
        const gridNumbers = page.locator('button[class*="w-8"], button[class*="w-10"]').first();
        await gridNumbers.click().catch(() => console.log('Could not click question box'));
      });
      await page.waitForTimeout(1500);
      const modalText = await getPageText(page);
      const hasModal = modalText.includes('Response') || modalText.includes('Distribution') || modalText.includes('correct') || modalText.includes('Question');
      console.log('Question detail modal opened:', hasModal);
      results.scenarios.T07.notes.push(`Question detail modal: ${hasModal}`);
      await takeScreenshot(page, '16_question_detail_modal');

      // Close modal
      const closeModal = page.locator('button:has-text("Close"), button:has-text("×"), button:has-text("✕"), [role="dialog"] button').first();
      await closeModal.click().catch(() => page.keyboard.press('Escape'));
      await page.waitForTimeout(500);
    }

    // Scroll down to Student Results table
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '17_analytics_bottom');

    const bottomText = await getPageText(page);
    const hasStudentResults = bottomText.includes('Student Results') || bottomText.includes('Students') || bottomText.includes('student_seed');
    console.log('Student Results table found:', hasStudentResults);
    results.scenarios.T07.notes.push(`Student Results table: ${hasStudentResults}`);

    // Verify analytics is passing overall
    const analyticsPassCount = [hasAnalyticsHeading, hasMicroTitle, hasExportBtn, hasTotalStudents, hasMCQSection, hasStudentResults].filter(Boolean).length;
    if (analyticsPassCount >= 5) {
      results.scenarios.T07.status = 'PASS';
    } else if (analyticsPassCount >= 3) {
      results.scenarios.T07.status = 'PARTIAL';
      results.scenarios.T07.findings.push({
        severity: 'High-Priority',
        description: `Analytics page missing some required sections. Passed ${analyticsPassCount}/6 checks.`
      });
    } else {
      results.scenarios.T07.status = 'FAIL';
      results.scenarios.T07.findings.push({
        severity: 'Blocker',
        description: `Analytics page severely incomplete. Passed only ${analyticsPassCount}/6 checks.`
      });
    }

    // =============================================
    // T-08: Analytics - Student Profile Navigation
    // =============================================
    console.log('\n=== T-08: Analytics - Student Profile Navigation ===');

    // Go back to analytics page
    await page.goto(analyticsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    // Scroll to Student Results table
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Look for student name links or clickable student rows
    const studentLinks = page.locator('a[href*="/ap/teacher/student"], button[data-student], [class*="student"] a, tbody tr td:first-child');
    const studentLinksCount = await studentLinks.count();
    console.log('Student name elements found:', studentLinksCount);
    results.scenarios.T08.notes.push(`Student name elements: ${studentLinksCount}`);

    // Try clicking on a student name
    let studentProfileLoaded = false;
    if (studentLinksCount > 0) {
      const firstStudentLink = studentLinks.first();
      const linkText = await firstStudentLink.textContent().catch(() => '');
      console.log('First student element text:', linkText);

      await firstStudentLink.click().catch(async () => {
        // Try clicking on any link in the student results area
        const studentArea = page.locator('[class*="StudentResults"], [class*="student-results"]');
        const links = studentArea.locator('a, button').first();
        await links.click().catch(() => console.log('Could not click student link'));
      });
      await page.waitForTimeout(3000);

      const profileUrl = page.url();
      console.log('URL after clicking student:', profileUrl);
      const isProfilePage = profileUrl.includes('/ap/teacher/student') || profileUrl.includes('/student/');
      console.log('Navigated to student profile:', isProfilePage);
      results.scenarios.T08.notes.push(`Student profile URL: ${profileUrl}`);

      if (isProfilePage) {
        studentProfileLoaded = true;
        await takeScreenshot(page, '18_student_profile');

        const profileText = await getPageText(page);

        // Verify profile elements
        const hasStudentName = profileText.length > 100;  // Profile should have content
        const hasTestHistory = profileText.includes('Test History') || profileText.includes('test history') || profileText.includes('Results') || profileText.includes('Score');
        const hasDomainAnalysis = profileText.includes('Domain') || profileText.includes('domain') || profileText.includes('Performance');

        console.log('Profile has content:', hasStudentName);
        console.log('Test history:', hasTestHistory);
        console.log('Domain analysis:', hasDomainAnalysis);
        results.scenarios.T08.notes.push(`Test history: ${hasTestHistory} | Domain analysis: ${hasDomainAnalysis}`);

        // Scroll through the profile
        await page.evaluate(() => window.scrollBy(0, 600));
        await page.waitForTimeout(500);
        await takeScreenshot(page, '19_student_profile_scroll');

        // Navigate back to analytics
        await page.goBack();
        await page.waitForTimeout(2000);
        const backUrl = page.url();
        console.log('URL after going back:', backUrl);
        const returnedToAnalytics = backUrl.includes('/analytics');
        console.log('Returned to analytics:', returnedToAnalytics);
        results.scenarios.T08.notes.push(`Returned to analytics: ${returnedToAnalytics}`);

        results.scenarios.T08.status = (hasTestHistory || hasDomainAnalysis) ? 'PASS' : 'PARTIAL';
      } else {
        // Navigation didn't go to student profile - could be a different behavior
        await takeScreenshot(page, '18_student_click_result');
        const currentText = await getPageText(page);
        results.scenarios.T08.notes.push('Student click did not navigate to profile page');
        results.scenarios.T08.findings.push({
          severity: 'High-Priority',
          description: 'Clicking student name/row did not navigate to /ap/teacher/student/:userId'
        });
        results.scenarios.T08.status = 'FAIL';
      }
    } else {
      // No student links found - take a screenshot to understand the layout
      await takeScreenshot(page, '18_no_student_links');
      results.scenarios.T08.notes.push('No student name clickable elements found in analytics page');
      results.scenarios.T08.findings.push({
        severity: 'High-Priority',
        description: 'Student Results table either not visible or student names not clickable'
      });
      results.scenarios.T08.status = 'FAIL';
    }

    // =============================================
    // T-09: Analytics - Export PDFs
    // =============================================
    console.log('\n=== T-09: Analytics - Export PDFs ===');

    // Navigate to analytics page
    await page.goto(analyticsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);
    await takeScreenshot(page, '20_analytics_for_export');

    const analyticsTextT09 = await getPageText(page);

    // Track downloads
    const downloadPromise = new Promise((resolve) => {
      const downloads = [];
      page.on('download', download => {
        downloads.push({
          suggestedFilename: download.suggestedFilename(),
          url: download.url()
        });
        console.log('Download started:', download.suggestedFilename());
        if (downloads.length >= 1) resolve(downloads);
      });
      setTimeout(() => resolve(downloads), 15000); // Timeout after 15s
    });

    // Find and click Export Questions PDF button
    const exportQsBtn = page.locator('button:has-text("Export Questions PDF"), button:has-text("Export Questions"), button:has-text("Questions PDF")');
    const exportQsBtnVisible = await exportQsBtn.isVisible().catch(() => false);
    console.log('Export Questions PDF button visible:', exportQsBtnVisible);
    results.scenarios.T09.notes.push(`Export Questions PDF button: ${exportQsBtnVisible}`);

    // Also check for "Export with Answers" button
    const exportAnswersBtn = page.locator('button:has-text("Export with Answers"), button:has-text("With Answers"), button:has-text("Answers PDF")');
    const exportAnswersBtnVisible = await exportAnswersBtn.isVisible().catch(() => false);
    console.log('Export with Answers button visible:', exportAnswersBtnVisible);
    results.scenarios.T09.notes.push(`Export with Answers button: ${exportAnswersBtnVisible}`);

    // Check if either button exists with different text
    if (!exportQsBtnVisible && !exportAnswersBtnVisible) {
      // Look for any export button
      const allButtons = await page.locator('button').allTextContents();
      console.log('All buttons on analytics page:', allButtons);
      results.scenarios.T09.notes.push(`All buttons: ${JSON.stringify(allButtons.filter(b => b.trim()))}`);
    }

    let pdfExport1Success = false;
    let pdfExport2Success = false;
    let noConsoleErrors = true;

    if (exportQsBtnVisible) {
      const consoleErrorsBefore = results.consoleErrors.length;
      await exportQsBtn.click();
      console.log('Clicked Export Questions PDF');
      await page.waitForTimeout(5000); // Wait for PDF generation
      await takeScreenshot(page, '21_after_export_questions');

      const consoleErrorsAfter = results.consoleErrors.filter(e => e.timestamp > new Date(Date.now() - 6000).toISOString());
      if (consoleErrorsAfter.filter(e => e.type === 'error').length > 0) {
        noConsoleErrors = false;
        results.scenarios.T09.findings.push({
          severity: 'High-Priority',
          description: 'Console errors during Export Questions PDF: ' + consoleErrorsAfter.map(e => e.text).join(', ')
        });
      }
      pdfExport1Success = true; // If no crash occurred
    }

    if (exportAnswersBtnVisible) {
      const consoleErrorsBefore = results.consoleErrors.length;
      await exportAnswersBtn.click();
      console.log('Clicked Export with Answers');
      await page.waitForTimeout(5000);
      await takeScreenshot(page, '22_after_export_answers');

      const consoleErrorsAfter = results.consoleErrors.filter(e => e.timestamp > new Date(Date.now() - 6000).toISOString());
      if (consoleErrorsAfter.filter(e => e.type === 'error').length > 0) {
        noConsoleErrors = false;
        results.scenarios.T09.findings.push({
          severity: 'High-Priority',
          description: 'Console errors during Export with Answers: ' + consoleErrorsAfter.map(e => e.text).join(', ')
        });
      }
      pdfExport2Success = true;
    }

    results.scenarios.T09.notes.push(`Export1 success: ${pdfExport1Success} | Export2 success: ${pdfExport2Success} | No console errors: ${noConsoleErrors}`);

    if (!exportQsBtnVisible && !exportAnswersBtnVisible) {
      results.scenarios.T09.status = 'FAIL';
      results.scenarios.T09.findings.push({
        severity: 'High-Priority',
        description: 'Neither "Export Questions PDF" nor "Export with Answers" buttons found on analytics page'
      });
    } else if (exportQsBtnVisible && exportAnswersBtnVisible && noConsoleErrors) {
      results.scenarios.T09.status = 'PASS';
    } else if (exportQsBtnVisible || exportAnswersBtnVisible) {
      results.scenarios.T09.status = 'PARTIAL';
    } else {
      results.scenarios.T09.status = 'FAIL';
    }

    // =============================================
    // ADDITIONAL CHECKS: Capture DOM snapshots for findings
    // =============================================
    console.log('\n=== Additional checks - capturing DOM details ===');

    // Get gradebook detailed snapshot
    await page.goto('http://localhost:5173/ap/gradebook', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Switch status to All to see complete picture
    const statusSelects = await page.locator('select').all();
    if (statusSelects.length > 0) {
      await statusSelects[0].selectOption('all');
      await page.waitForTimeout(2000);
    }
    await takeScreenshot(page, '23_gradebook_all_statuses');

    const finalGradebookText = await getPageText(page);
    const hasCompleteRows = finalGradebookText.includes('Complete') || finalGradebookText.includes('complete');
    const hasPendingRows = finalGradebookText.includes('Pending') || finalGradebookText.includes('pending');
    const hasInProgressRows = finalGradebookText.includes('In Progress') || finalGradebookText.includes('in_progress');
    console.log('Final gradebook - Complete rows:', hasCompleteRows, '| Pending:', hasPendingRows, '| In Progress:', hasInProgressRows);

  } catch (error) {
    console.error('ERROR during B8 audit:', error.message);
    console.error(error.stack);
    results.error = error.message;
    await takeScreenshot(page, 'ERROR_state').catch(() => {});
  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n=== B8 AUDIT RESULTS ===');
  for (const [scenario, data] of Object.entries(results.scenarios)) {
    console.log(`${scenario}: ${data.status}`);
    data.notes.forEach(n => console.log(`  - ${n}`));
    if (data.findings.length > 0) {
      console.log(`  Findings:`);
      data.findings.forEach(f => console.log(`    [${f.severity}] ${f.description}`));
    }
  }

  console.log('\nConsole Errors:', results.consoleErrors.length);
  results.consoleErrors.forEach(e => console.log(`  [${e.type}] ${e.text.substring(0, 200)}`));

  // Write results to file
  const resultsFile = path.join(__dirname, '..', 'src', 'apBoost', 'criteria_audit', 'playwright_reports', 'b8_audit_results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log('\nResults written to:', resultsFile);

  return results;
}

runB8Audit().catch(console.error);
