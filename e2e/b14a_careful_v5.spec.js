/**
 * B14-A v5: Complete the FRQ section and verify report card.
 * student4 has an existing session in FRQ section (Q6 of 7).
 * This script: logs in → resumes → navigates FRQ to completion → verifies results.
 *
 * FRQ section has 7 navigation items (2 FRQ questions with sub-questions).
 * We are at Q6 of 7. Need to complete Q6 and Q7 then submit.
 */
import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const STUDENT_EMAIL = 'student4@apboost.test';
const STUDENT_PASSWORD = 'Student123!';
const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_B14A';
const RESULTS_FILE = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14a_results.json';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function saveResults(results) {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  try {
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`[SCREENSHOT] ${name}.png`);
  } catch {}
}

async function clickNext(page) {
  const btn = page.locator('button').filter({ hasText: /^Next →$/ }).first();
  try {
    if (await btn.isVisible({ timeout: 3000 }) && !await btn.isDisabled()) {
      await btn.click();
      await page.waitForTimeout(1000);
      return true;
    }
  } catch {}
  return false;
}

test.setTimeout(180000); // 3 minutes

test('B14-A v5: Complete FRQ and verify report card', async ({ page }) => {

  // Load existing results
  let results = {};
  try {
    results = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
  } catch {
    results = { scenarioId: 'B14-A', findings: [], steps: [], consoleErrors: [] };
  }

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('Heartbeat')) {
        consoleErrors.push({ url: page.url(), msg: text });
        console.log(`[CONSOLE ERROR] ${text.substring(0, 120)}`);
      }
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push({ url: page.url(), msg: err.message, type: 'pageerror' });
    console.log(`[PAGE ERROR] ${err.message.substring(0, 120)}`);
  });

  // ==============================
  // 1. LOGIN & RESUME TEST
  // ==============================
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.locator('input[type="email"]').first().fill(STUDENT_EMAIL);
  await page.locator('input[type="password"]').first().fill(STUDENT_PASSWORD);
  await page.keyboard.press('Enter');
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 30000 });
  console.log(`[LOGIN] ${page.url()}`);

  // Navigate to test
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await page.waitForTimeout(3000);
  await screenshot(page, 'v5_01_test_page');

  const pageText = await page.locator('body').textContent().catch(() => '');
  const isInstruction = /Resume Test|Begin Test/i.test(pageText);
  const isInFRQ = /Section 2 of 2|Free Response|Question \d+ of 7/i.test(pageText);
  const isCompleted = /your score|report card|result/i.test(pageText);

  console.log(`[STATE] instruction: ${isInstruction}, inFRQ: ${isInFRQ}, completed: ${isCompleted}`);

  if (isInstruction) {
    // Click Resume Test (should be in FRQ section)
    const resumeBtn = page.locator('button').filter({ hasText: /Resume Test|Begin Test/ }).first();
    if (await resumeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await resumeBtn.click();
      await page.waitForTimeout(3000);
      console.log('[RESUME] Clicked Resume Test');
    }
  }

  await screenshot(page, 'v5_02_in_frq');
  const afterResumeText = await page.locator('body').textContent().catch(() => '');
  const inFRQNow = /Section 2 of 2|Free Response|Question \d+ of 7/i.test(afterResumeText);
  console.log(`[FRQ] In FRQ section: ${inFRQNow}`);

  // ==============================
  // 2. COMPLETE ALL FRQ SUB-QUESTIONS
  // ==============================
  const frqAnswers = [
    'In a monopsonistic labor market, the firm faces an upward-sloping supply curve and a marginal factor cost above the wage. The monopsonist hires Lm workers at wage Wm, which is less than MRP, creating a deadweight loss compared to the competitive equilibrium where W=MRP.',
    'In the competitive market, wage equals MRP and employment level is higher (Lc > Lm). Workers receive a wage equal to their marginal product. The monopsonist pays less and employs fewer workers, reducing both wages and employment below competitive levels.',
    'A minimum wage set between Wm and the competitive wage (Wc) can increase both wages and employment. This occurs because the minimum wage makes the supply curve elastic up to that wage level, reducing the marginal factor cost. If set correctly, the minimum wage forces the monopsonist to hire more workers at the higher wage, moving output toward the competitive outcome.',
  ];

  let frqNavItem = -1;
  let submitReached = false;

  for (let iteration = 0; iteration < 10; iteration++) {
    const currentText = await page.locator('body').textContent().catch(() => '');

    // Get FRQ question counter
    const counterMatch = currentText.match(/Question (\d+) of (\d+)/);
    frqNavItem = counterMatch ? parseInt(counterMatch[1]) : -1;
    const frqTotal = counterMatch ? parseInt(counterMatch[2]) : 7;
    console.log(`[FRQ iter ${iteration}] Q${frqNavItem} of ${frqTotal}`);

    // Check if already on results page
    if (page.url().includes('/results/') || /report card|your score|mcq score/i.test(currentText)) {
      console.log('[FRQ] Already on results page!');
      submitReached = true;
      break;
    }

    // Type in textarea if empty
    const ta = page.locator('textarea').first();
    if (await ta.isVisible({ timeout: 2000 }).catch(() => false)) {
      const val = await ta.inputValue().catch(() => '');
      if (!val) {
        const ansIdx = (frqNavItem >= 1 ? frqNavItem - 1 : iteration) % frqAnswers.length;
        await ta.click();
        await ta.fill(frqAnswers[ansIdx]);
        await page.waitForTimeout(600);
        console.log(`[FRQ iter ${iteration}] Typed answer for Q${frqNavItem}`);
      }
    }

    await screenshot(page, `v5_03_frq_q${frqNavItem}`);

    // Check for Submit Test button
    const submitTestBtn = page.locator('button').filter({ hasText: /Submit Test|Submit Exam/ }).first();
    const submitVis = await submitTestBtn.isVisible({ timeout: 2000 }).catch(() => false);
    const submitDis = await submitTestBtn.isDisabled().catch(() => true);
    console.log(`[FRQ iter ${iteration}] Submit Test: vis=${submitVis}, dis=${submitDis}`);

    if (submitVis && !submitDis) {
      console.log('[FRQ] CLICKING SUBMIT TEST');
      await submitTestBtn.click();
      await page.waitForTimeout(8000); // Wait for submission to complete
      submitReached = true;
      console.log(`[FRQ] After submit: ${page.url()}`);
      await screenshot(page, 'v5_04_after_submit');
      break;
    }

    // Check for Review → button (FRQ review screen)
    const reviewBtn = page.locator('button').filter({ hasText: /^Review →$/ }).first();
    const reviewVis = await reviewBtn.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`[FRQ iter ${iteration}] Review →: vis=${reviewVis}`);

    if (reviewVis && !await reviewBtn.isDisabled().catch(() => true)) {
      console.log('[FRQ] Clicking Review → (FRQ review)');
      await reviewBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'v5_05_frq_review');
      continue; // Loop again — next iteration should find Submit Test
    }

    // Navigate to next FRQ item
    const moved = await clickNext(page);
    console.log(`[FRQ iter ${iteration}] Moved to next: ${moved}`);

    if (!moved && !reviewVis && !submitVis) {
      console.log('[FRQ] No navigation forward available — stuck');
      break;
    }
  }

  await screenshot(page, 'v5_06_after_frq_loop');

  // ==============================
  // 3. WAIT FOR RESULTS PAGE
  // ==============================
  const finalUrl = page.url();
  const finalText = await page.locator('body').textContent().catch(() => '');
  let isOnResults = finalUrl.includes('/results/');

  if (!isOnResults) {
    // Wait up to 10 more seconds for navigation
    console.log('[RESULTS] Not on results page yet. Waiting...');
    try {
      await page.waitForURL(url => url.toString().includes('/results/'), { timeout: 10000 });
      isOnResults = true;
      console.log(`[RESULTS] Now on: ${page.url()}`);
    } catch {
      console.log('[RESULTS] Still not on results page after wait');
    }
  }

  await screenshot(page, 'v5_07_results');
  const resultsUrl = page.url();
  const resultsText = await page.locator('body').textContent().catch(() => '');

  // Properly check for report card content (exclude FRQ question content from match)
  const isActualResultsPage = resultsUrl.includes('/results/');
  const hasReportCardHeading = /report card|ap score|mcq score|your performance/i.test(resultsText);
  const hasScore = /\d+\s*\/\s*15|\d+\s*\/\s*\d+\s*MCQ|MCQ Score/i.test(resultsText);
  const hasMCQTable = /your answer.*correct|correct.*your answer|Q\d+.*correct|incorrect/i.test(resultsText);
  const hasAPScore = /AP\s*Score\s*\d|Projected\s*AP\s*Score/i.test(resultsText);
  const hasDomain = /Performance by Domain|domain performance/i.test(resultsText);
  const hasFlaggedSection = /Flagged for Review/i.test(resultsText);

  console.log(`[RESULTS] URL: ${resultsUrl}`);
  console.log(`[RESULTS] isResultsPage: ${isActualResultsPage}, hasHeading: ${hasReportCardHeading}`);
  console.log(`[RESULTS] score: ${hasScore}, MCQ table: ${hasMCQTable}`);
  console.log(`[RESULTS] AP score: ${hasAPScore}, domain: ${hasDomain}, flagged: ${hasFlaggedSection}`);
  console.log(`[RESULTS] submitReached: ${submitReached}`);

  // ==============================
  // 4. UPDATE FINDINGS
  // ==============================

  // Remove the false "Blocker" from v4 about report card not loading
  results.findings = (results.findings || []).filter(f =>
    f.title !== 'Report card did not load after test submission'
  );

  // Remove false positives from v4 steps
  results.steps = (results.steps || []).filter(s => s.label !== 'Report card');

  // Add new console errors
  for (const ce of consoleErrors) {
    results.consoleErrors = results.consoleErrors || [];
    const isDupe = results.consoleErrors.some(e => e.msg === ce.msg);
    if (!isDupe) results.consoleErrors.push(ce);
  }

  // Check for code.startsWith error (from v4 run)
  const hasStartsWithError = (results.consoleErrors || []).some(e => e.msg === 'code.startsWith is not a function');
  if (hasStartsWithError) {
    const alreadyReported = results.findings.some(f => f.title.includes('code.startsWith'));
    if (!alreadyReported) {
      results.findings.push({
        severity: 'High-Priority',
        title: 'JavaScript error: code.startsWith is not a function',
        what: 'Page error: "code.startsWith is not a function" fires when submitting MCQ section (2 occurrences in v4 run)',
        expected: 'No JavaScript errors during test submission flow',
        evidence: 'Captured twice in consoleErrors during /ap/test/test_micro_full_1 submit flow',
        time: new Date().toISOString()
      });
    }
  }

  if (!submitReached) {
    results.findings.push({
      severity: 'High-Priority',
      title: 'FRQ submission not reached after 10 navigation iterations',
      what: `FRQ section has 7 navigation items. After 10 loop iterations (completing items Q${frqNavItem} of 7), Submit Test button was never found enabled. The script exhausted its iteration budget.`,
      expected: 'After completing all FRQ sub-questions, Submit Test button should appear enabled',
      evidence: `Screenshots v5_03_frq_q*.png — last FRQ item reached: Q${frqNavItem} of 7. FRQ Review → button: visible but cycling through sub-questions did not produce Submit Test.`,
      time: new Date().toISOString()
    });
  }

  if (!isActualResultsPage || !hasReportCardHeading) {
    results.findings.push({
      severity: 'Blocker',
      title: 'Report card page not reached after FRQ completion attempt',
      what: `After FRQ navigation iterations (submitReached=${submitReached}), URL is ${resultsUrl}. Expected /ap/results/:id. Page text: ${resultsText.substring(0, 300)}`,
      expected: 'After Submit Test, app should navigate to /ap/results/:resultId showing the complete report card',
      evidence: 'Screenshot v5_07_results.png'
    });
  } else {
    // Report card loaded — verify sections
    results.steps.push({
      label: 'Report card loaded',
      status: 'PASS',
      notes: `URL: ${resultsUrl}`,
      time: new Date().toISOString()
    });

    if (!hasScore) {
      results.findings.push({
        severity: 'Medium-Priority',
        title: 'MCQ score not displayed on report card',
        what: 'Report card loaded but no MCQ score (X/15 or %) found',
        expected: 'Report card should show MCQ score prominently (e.g., "10/15" or "67%")',
        evidence: 'Screenshot v5_07_results.png'
      });
    }

    if (!hasMCQTable) {
      results.findings.push({
        severity: 'Medium-Priority',
        title: 'MCQ per-question breakdown missing from report card',
        what: 'No question-by-question correct/incorrect breakdown found on report card',
        expected: 'Report card should include MCQ table showing Q1-Q15 results with correct/incorrect',
        evidence: 'Screenshot v5_07_results.png'
      });
    }

    if (!hasFlaggedSection && (results.summary?.flagsPlaced || 0) > 0) {
      const alreadyReported = results.findings.some(f => f.title.includes('Flagged for Review section absent'));
      if (!alreadyReported) {
        results.findings.push({
          severity: 'High-Priority',
          title: 'Flagged for Review section absent from report card',
          what: `Student flagged questions during test. Report card has no "Flagged for Review" section.`,
          expected: 'Report card should display which questions were flagged for review',
          evidence: 'Consistent with known B3-001 finding',
          time: new Date().toISOString()
        });
      }
    }

    results.steps.push({
      label: 'Report card content verified',
      status: (hasScore && hasMCQTable) ? 'PASS' : 'PARTIAL',
      notes: `score=${hasScore}, MCQTable=${hasMCQTable}, AP=${hasAPScore}, domain=${hasDomain}, flagged=${hasFlaggedSection}`,
      time: new Date().toISOString()
    });
  }

  // ==============================
  // 5. SCROLL AND SCREENSHOT FULL REPORT CARD
  // ==============================
  if (isActualResultsPage) {
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(500);
    await screenshot(page, 'v5_08_results_mid');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await screenshot(page, 'v5_09_results_bottom');
  }

  // ==============================
  // 6. SAVE FINAL RESULTS
  // ==============================
  results.reportCard = {
    url: resultsUrl,
    isResultsPage: isActualResultsPage,
    hasHeading: hasReportCardHeading,
    hasScore,
    hasMCQTable,
    hasAPScore,
    hasDomain,
    hasFlaggedSection,
    submitReached,
    textSnippet: resultsText.substring(0, 1000)
  };

  results.completedAt = new Date().toISOString();
  results.finalStatus = isActualResultsPage ? 'COMPLETE' : 'PARTIAL';
  results.summary = {
    ...(results.summary || {}),
    finalUrl: resultsUrl,
    reportCardLoaded: isActualResultsPage && hasReportCardHeading,
    totalFindings: results.findings.length,
    consoleErrorCount: (results.consoleErrors || []).length,
    finalStatus: isActualResultsPage ? 'COMPLETE' : 'PARTIAL',
    steps: {
      total: results.steps.length,
      pass: results.steps.filter(s => s.status === 'PASS').length,
      fail: results.steps.filter(s => s.status === 'FAIL').length,
      partial: results.steps.filter(s => s.status === 'PARTIAL').length,
      skip: results.steps.filter(s => s.status === 'SKIP').length,
    }
  };

  saveResults(results);
  console.log('\n[DONE] Summary:', JSON.stringify(results.summary, null, 2));
  console.log('[FINDINGS COUNT]', results.findings.length);
  results.findings.forEach((f, i) => console.log(`  [${i+1}][${f.severity}] ${f.title}`));
});
