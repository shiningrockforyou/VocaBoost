import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TEACHER_EMAIL = 'teacher@apboost.test';
const TEACHER_PASSWORD = 'Teacher123!';
const STUDENT_EMAIL = 'student@apboost.test';
const STUDENT_PASSWORD = 'Student123!';
const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_b1';
const MICRO_TEST_ID = 'test_micro_full_1';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function saveScreenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`Screenshot: ${name}.png`);
  return filePath;
}

async function loginAs(page, role) {
  const email = role === 'student' ? STUDENT_EMAIL : TEACHER_EMAIL;
  const password = role === 'student' ? STUDENT_PASSWORD : TEACHER_PASSWORD;
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.keyboard.press('Enter');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
}

// Get MCQ answer choice buttons - they have specific class pattern and are not disabled
async function getMCQChoiceButtons(page) {
  // The answer choice buttons have: flex-1 flex items-start gap-3 p-3 rounded-[--radius-input] border
  // They're inside divs with class="flex items-start gap-2"
  const choiceDivs = await page.locator('div.flex.items-start.gap-2').all();
  const choices = [];
  for (const div of choiceDivs) {
    const btn = div.locator('button').first();
    const cls = await btn.getAttribute('class').catch(() => '');
    if (cls.includes('flex-1') && cls.includes('items-start') && cls.includes('p-3')) {
      choices.push(btn);
    }
  }
  return choices;
}

// Get enabled (non-disabled) MCQ choice buttons
async function getEnabledChoiceButtons(page) {
  return page.locator('button.flex-1.flex.items-start:not([disabled])').all();
}

test('B1-S01: Dashboard Initial Load', async ({ page }) => {
  test.setTimeout(60000);
  const results = {};
  const findings = { high: [], medium: [], nitpick: [] };

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[CONSOLE ERROR]', msg.text());
  });

  // Login
  let role = 'student';
  try { await loginAs(page, 'student'); }
  catch (e) { role = 'teacher'; await loginAs(page, 'teacher'); }

  await page.goto('http://localhost:5173/ap');
  await page.waitForTimeout(4000);
  await saveScreenshot(page, 's01_01_dashboard');

  const h1Text = await page.locator('h1').first().textContent().catch(() => '');
  const h3Texts = [];
  for (const h3 of await page.locator('h3').all()) {
    h3Texts.push((await h3.textContent().catch(() => '')).trim());
  }
  const statusBadges = await page.locator('span').filter({ hasText: /Not Started|In Progress|Completed/ }).count();
  const sectionCountText = await page.locator('text=/\\d+ section/').count();
  const timeText = await page.locator('text=/\\d+ min/').count();
  const errorBanner = await page.locator('[class*="bg-error"]').first().isVisible().catch(() => false);

  console.log('H1:', h1Text);
  console.log('H3s:', h3Texts);
  console.log('StatusBadges:', statusBadges, 'Sections:', sectionCountText, 'Time:', timeText);

  const apCards = h3Texts.filter(t => t.includes('AP'));
  const hasHeading = h1Text.includes('AP Practice Tests');
  const hasCards = apCards.length >= 3;
  const hasStatus = statusBadges >= 3;

  const status = (hasHeading && hasCards && hasStatus && !errorBanner) ? 'PASS'
    : (hasHeading && apCards.length >= 1) ? 'PARTIAL' : 'FAIL';

  results['S-01'] = { status, role, h1: h1Text, cards: h3Texts, statusBadges, sectionCountText, timeText, errorBanner };
  console.log('S-01:', status);

  if (!hasHeading) findings.high.push({ id: 'B1-H01', scenario: 'S-01', title: `Dashboard h1 missing "AP Practice Tests" (got: "${h1Text}")`, criteriaRef: '1.9' });
  if (!hasCards) findings.high.push({ id: 'B1-H02', scenario: 'S-01', title: `Only ${apCards.length} AP test cards (expected 3+)`, criteriaRef: '1.9' });
  if (!hasStatus) findings.medium.push({ id: 'B1-M01', scenario: 'S-01', title: `Only ${statusBadges} status badges (expected 3+)`, criteriaRef: '1.9' });
  if (sectionCountText < 3) findings.medium.push({ id: 'B1-M02', scenario: 'S-01', title: `Only ${sectionCountText} section count texts (expected 3)`, criteriaRef: '1.9' });

  await saveScreenshot(page, 's01_02_dashboard_final');
  fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/s01_results.json', JSON.stringify({ results, findings }, null, 2));
});

test('B1-S02: Instruction Screen', async ({ page }) => {
  test.setTimeout(60000);
  const results = {};
  const findings = { high: [], medium: [] };

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[CONSOLE ERROR]', msg.text());
  });

  let role = 'student';
  try { await loginAs(page, 'student'); }
  catch (e) { role = 'teacher'; await loginAs(page, 'teacher'); }

  await page.goto('http://localhost:5173/ap');
  await page.waitForTimeout(3000);

  // Click micro test card
  const microCard = page.locator('text=AP Microeconomics Practice Exam').first();
  if (await microCard.isVisible().catch(() => false)) {
    // Find the anchor or button wrapping the card
    const clickable = page.locator('a, button').filter({ has: page.locator('text=AP Microeconomics Practice Exam') }).first();
    if (await clickable.isVisible().catch(() => false)) {
      await clickable.click();
    } else {
      await microCard.click();
    }
  } else {
    await page.goto(`http://localhost:5173/ap/test/${MICRO_TEST_ID}`);
  }

  await page.waitForURL(/\/ap\/test\//, { timeout: 10000 });
  await page.waitForTimeout(2000);
  await saveScreenshot(page, 's02_01_instruction');

  const h1Text = await page.locator('h1').first().textContent().catch(() => '');
  const frqInfoVisible = await page.locator('text=/Free Response Section/').first().isVisible().catch(() => false);
  const warningCount = (await page.locator('text=/cannot pause the timer/i').count()) + (await page.locator('text=/cannot return to previous/i').count());
  const cancelBtn = page.locator('button', { hasText: /^Cancel$/ }).first();
  const cancelVisible = await cancelBtn.isVisible().catch(() => false);
  const beginBtn = page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first();
  const beginVisible = await beginBtn.isVisible().catch(() => false);
  const beginText = await beginBtn.textContent().catch(() => '');
  const totalTime = await page.locator('text=/Total time/i').count();

  console.log('H1:', h1Text, 'FRQ:', frqInfoVisible, 'Warning:', warningCount, 'Cancel:', cancelVisible, 'Begin:', beginText.trim());

  // Test Cancel
  let cancelWorks = false;
  if (cancelVisible) {
    await cancelBtn.click();
    await page.waitForTimeout(1500);
    const url = page.url();
    cancelWorks = url.endsWith('/ap') || (url.includes('/ap') && !url.includes('/test/'));
    console.log('Cancel URL:', url, 'Works:', cancelWorks);
    await saveScreenshot(page, 's02_02_after_cancel');
    await page.goto(`http://localhost:5173/ap/test/${MICRO_TEST_ID}`);
    await page.waitForTimeout(2000);
  }

  const beginText2 = await page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first().textContent().catch(() => '');

  const issues = [];
  if (!h1Text.includes('Microeconomics')) issues.push(`H1 missing Microeconomics: "${h1Text}"`);
  if (!frqInfoVisible) issues.push('FRQ info box not visible');
  if (warningCount === 0) issues.push('Warning text missing');
  if (!cancelVisible) issues.push('Cancel button missing');
  if (!beginVisible) issues.push('Begin Test button missing');
  if (beginText.trim() !== 'Begin Test') issues.push(`Begin button text: "${beginText.trim()}" (expected "Begin Test")`);

  const status = issues.length === 0 ? 'PASS' : issues.length <= 2 ? 'PARTIAL' : 'FAIL';
  results['S-02'] = { status, role, h1Text, frqInfoVisible, warningCount, cancelVisible, cancelWorks, beginText: beginText.trim(), issues };
  console.log('S-02:', status, issues);

  if (!frqInfoVisible) findings.high.push({ id: 'B1-H03', scenario: 'S-02', title: 'FRQ info box missing from instruction screen', criteriaRef: '8.1' });
  if (!cancelWorks && cancelVisible) findings.high.push({ id: 'B1-H04', scenario: 'S-02', title: 'Cancel button does not navigate to /ap', criteriaRef: '1.10' });
  if (!beginVisible || beginText.trim() !== 'Begin Test') findings.high.push({ id: 'B1-H05', scenario: 'S-02', title: `Begin Test button issue: "${beginText.trim()}"`, criteriaRef: '1.10' });
  if (warningCount === 0) findings.medium.push({ id: 'B1-M03', scenario: 'S-02', title: 'Warning box text missing', criteriaRef: '1.10' });

  await saveScreenshot(page, 's02_03_final');
  fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/s02_results.json', JSON.stringify({ results, findings }, null, 2));
});

test('B1-S03: Begin Test Timer and Interface', async ({ page }) => {
  test.setTimeout(90000);
  const results = {};
  const findings = { blocker: [], high: [], medium: [] };

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') { consoleErrors.push(msg.text()); console.log('[CONSOLE ERROR]', msg.text()); }
  });

  let role = 'student';
  try { await loginAs(page, 'student'); }
  catch (e) { role = 'teacher'; await loginAs(page, 'teacher'); }

  await page.goto(`http://localhost:5173/ap/test/${MICRO_TEST_ID}`);
  await page.waitForTimeout(3000);
  await saveScreenshot(page, 's03_01_instruction');

  const beginBtn = page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first();
  const beginVisible = await beginBtn.isVisible().catch(() => false);
  if (!beginVisible) {
    results['S-03'] = { status: 'FAIL', notes: 'Begin button not found', role };
    findings.blocker.push({ id: 'B1-BL01', scenario: 'S-03', title: 'Begin Test button missing', criteriaRef: '1.1' });
    fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/s03_results.json', JSON.stringify({ results, findings, consoleErrors }, null, 2));
    return;
  }

  await beginBtn.click();
  await page.waitForTimeout(4000);
  await saveScreenshot(page, 's03_02_test_started');
  console.log('URL:', page.url());

  // Hamburger (aria-label="Open menu")
  const hamburger = page.locator('[aria-label="Open menu"]').first();
  const hamburgerOk = await hamburger.isVisible().catch(() => false);
  console.log('Hamburger (aria-label="Open menu"):', hamburgerOk);

  // Section info
  const sectionText = await page.locator('text=/Section \\d+ of \\d+/').first().textContent().catch(() => '');
  console.log('Section text:', sectionText);

  // Timer (font-mono class)
  const timerEl = page.locator('[class*="font-mono"]').first();
  const timerText1 = await timerEl.textContent().catch(() => '');
  await page.waitForTimeout(3000);
  const timerText2 = await timerEl.textContent().catch(() => '');
  const timerCounting = timerText1 !== '' && timerText2 !== '' && timerText1 !== timerText2;
  console.log('Timer:', timerText1, '->', timerText2, 'counting:', timerCounting);
  await saveScreenshot(page, 's03_03_timer_check');

  // Q1 label - look for "Question 1" text in small gray text
  const q1Label = await page.locator('span', { hasText: /Question 1/ }).count();
  console.log('Q1 label elements:', q1Label);

  // Answer choice buttons (flex-1 flex items-start gap-3 p-3)
  const mcqChoices = await getEnabledChoiceButtons(page);
  console.log('MCQ choices (enabled, flex-1):', mcqChoices.length);

  // Also count all flex-1 buttons (including disabled)
  const allFlexBtns = await page.locator('button.flex-1').count();
  console.log('All flex-1 buttons (including disabled):', allFlexBtns);

  // Strikethrough buttons - title="Strike through" or title="Remove strikethrough"
  const strikeBtns = await page.locator('button[title="Strike through"], button[title="Remove strikethrough"]').count();
  console.log('Strikethrough buttons:', strikeBtns);

  // Bottom nav - "← Back" button
  const backBtn = page.locator('button', { hasText: '← Back' }).first();
  const backVisible = await backBtn.isVisible().catch(() => false);
  const backDisabled = backVisible ? await backBtn.isDisabled().catch(() => false) : null;

  // "Next →" button
  const nextBtn = page.locator('button', { hasText: 'Next →' }).first();
  const nextVisible = await nextBtn.isVisible().catch(() => false);
  console.log('Back "← Back":', backVisible, 'disabled:', backDisabled, '| Next "Next →":', nextVisible);

  // "Question X of Y" button (center nav)
  const centerNav = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
  const centerNavText = await centerNav.textContent().catch(() => '');
  const centerNavVisible = await centerNav.isVisible().catch(() => false);
  console.log('Center nav:', centerNavText.trim(), 'visible:', centerNavVisible);

  // Flag button
  const flagBtn = page.locator('button', { hasText: /Flag for Review|Flagged/ }).first();
  const flagVisible = await flagBtn.isVisible().catch(() => false);
  console.log('Flag button visible:', flagVisible);

  await saveScreenshot(page, 's03_04_full_interface');

  const issues = [];
  if (!timerCounting) issues.push(`Timer not counting: "${timerText1}" -> "${timerText2}"`);
  if (q1Label === 0) issues.push('Question 1 label not found');
  if (mcqChoices.length < 4) issues.push(`Only ${mcqChoices.length} enabled choice buttons (expected 4)`);
  if (strikeBtns === 0) issues.push('No strikethrough buttons found');
  if (!nextVisible && !backVisible) issues.push('No nav buttons visible (Back/Next)');
  if (!flagVisible) issues.push('Flag for Review button not visible');
  if (!centerNavVisible) issues.push('Center nav "Question X of Y" not visible');

  // Back should be disabled on Q1 (since it's first question)
  if (backVisible && backDisabled === false) issues.push('Back button not disabled on Q1');

  const status = issues.length === 0 ? 'PASS' : issues.length <= 2 ? 'PARTIAL' : 'FAIL';
  results['S-03'] = {
    status, role, hamburger: hamburgerOk, sectionText, timerCounting,
    timer: `${timerText1}->${timerText2}`, choices: mcqChoices.length,
    strikeBtns, backVisible, backDisabled, nextVisible, centerNav: centerNavText.trim(),
    flagVisible, issues, consoleErrors
  };
  console.log('S-03:', status, issues);

  if (!timerCounting) findings.blocker.push({ id: 'B1-BL02', scenario: 'S-03', title: `Timer not counting down: "${timerText1}" -> "${timerText2}"`, criteriaRef: '1.1' });
  if (mcqChoices.length < 4) findings.high.push({ id: 'B1-H06', scenario: 'S-03', title: `Only ${mcqChoices.length} enabled MCQ choice buttons`, criteriaRef: '2.1' });
  if (strikeBtns === 0) findings.high.push({ id: 'B1-H07', scenario: 'S-03', title: 'No strikethrough buttons on MCQ choices', criteriaRef: '1.4' });
  if (!flagVisible) findings.high.push({ id: 'B1-H08', scenario: 'S-03', title: 'Flag for Review button not visible', criteriaRef: '1.2' });
  if (!centerNavVisible) findings.high.push({ id: 'B1-H09', scenario: 'S-03', title: 'Center nav "Question X of Y" not visible', criteriaRef: '7.4' });

  fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/s03_results.json', JSON.stringify({ results, findings, consoleErrors }, null, 2));
});

test('B1-S04: MCQ Answer Selection and Persistence', async ({ page }) => {
  test.setTimeout(120000);
  const results = {};
  const findings = { high: [], medium: [] };

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') { consoleErrors.push(msg.text()); console.log('[CE]', msg.text()); }
  });

  let role = 'student';
  try { await loginAs(page, 'student'); }
  catch (e) { role = 'teacher'; await loginAs(page, 'teacher'); }

  await page.goto(`http://localhost:5173/ap/test/${MICRO_TEST_ID}`);
  await page.waitForTimeout(3000);

  const beginBtn = page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first();
  if (!await beginBtn.isVisible().catch(() => false)) {
    results['S-04'] = { status: 'SKIP', notes: 'Begin button not found', role };
    fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/s04_results.json', JSON.stringify({ results, findings }, null, 2));
    return;
  }
  await beginBtn.click();
  await page.waitForTimeout(3000);
  await saveScreenshot(page, 's04_01_q1_start');

  // Verify no answer selected (check all flex-1 buttons' classes)
  const allChoiceBtns = await page.locator('button.flex-1').all();
  console.log('Total flex-1 buttons:', allChoiceBtns.length);
  const choiceClasses = [];
  for (const btn of allChoiceBtns) {
    choiceClasses.push((await btn.getAttribute('class').catch(() => '')).substring(0, 80));
  }
  console.log('Choice classes:', choiceClasses);

  // Find enabled choices
  const enabledChoices = await page.locator('button.flex-1:not([disabled])').all();
  console.log('Enabled choices:', enabledChoices.length);

  if (enabledChoices.length < 2) {
    // Debug: print all button texts
    for (const btn of await page.locator('button').all()) {
      const txt = (await btn.textContent().catch(() => '')).trim();
      const disabled = await btn.isDisabled().catch(() => false);
      if (txt.length < 200) console.log(`Btn [disabled=${disabled}]: "${txt.substring(0, 60)}"`);
    }
    results['S-04'] = { status: 'FAIL', notes: `Only ${enabledChoices.length} enabled choice buttons`, role };
    findings.high.push({ id: 'B1-H10', scenario: 'S-04', title: `MCQ has only ${enabledChoices.length} enabled choices`, criteriaRef: '2.1' });
    fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/s04_results.json', JSON.stringify({ results, findings }, null, 2));
    return;
  }

  // Check Q1: none selected
  const q1Choice1Class = await enabledChoices[0].getAttribute('class').catch(() => '');
  const q1Choice2Class = await enabledChoices[1].getAttribute('class').catch(() => '');
  const noneSelected = !q1Choice1Class.includes('bg-brand') && !q1Choice2Class.includes('bg-brand');
  console.log('None selected initially:', noneSelected);

  // Click choice B (index 1)
  await enabledChoices[1].click();
  await page.waitForTimeout(600);
  await saveScreenshot(page, 's04_02_b_selected');

  const bClassAfterClick = await enabledChoices[1].getAttribute('class').catch(() => '');
  const bSelected = bClassAfterClick.includes('bg-brand-primary');
  const aNotSelected = !(await enabledChoices[0].getAttribute('class').catch(() => '')).includes('bg-brand-primary');
  console.log('B selected:', bSelected, '| A not selected:', aNotSelected, '| B class:', bClassAfterClick.substring(0, 120));

  if (!bSelected) {
    findings.high.push({ id: 'B1-H11', scenario: 'S-04', title: 'Clicking MCQ choice does not highlight it', criteriaRef: '2.1' });
  }

  // Navigate to Q2
  const nextBtn = page.locator('button', { hasText: 'Next →' }).first();
  if (!await nextBtn.isVisible().catch(() => false)) {
    // Try "Next" without arrow
    console.log('No "Next →" button - checking other variants');
    const btns = await page.locator('button').all();
    for (const b of btns) {
      const t = (await b.textContent().catch(() => '')).trim();
      console.log('Button:', t.substring(0, 40));
    }
  }

  await nextBtn.click();
  await page.waitForTimeout(1000);
  await saveScreenshot(page, 's04_03_q2');

  const q2Counter = await page.locator('button').filter({ hasText: /Question 2 of/ }).first().textContent().catch(() => '');
  console.log('Q2 counter:', q2Counter.trim());

  // Click choice A on Q2
  const q2Choices = await page.locator('button.flex-1:not([disabled])').all();
  let q2AClass = '';
  if (q2Choices.length >= 1) {
    await q2Choices[0].click();
    await page.waitForTimeout(600);
    q2AClass = await q2Choices[0].getAttribute('class').catch(() => '');
    console.log('Q2 A selected:', q2AClass.includes('bg-brand-primary'));
    await saveScreenshot(page, 's04_04_q2_a');
  }

  // Back to Q1
  const backBtn = page.locator('button', { hasText: '← Back' }).first();
  await backBtn.click();
  await page.waitForTimeout(1000);
  await saveScreenshot(page, 's04_05_back_q1');

  // Check B still selected
  const q1ChoicesAgain = await page.locator('button.flex-1:not([disabled])').all();
  let bPersists = false;
  if (q1ChoicesAgain.length >= 2) {
    const bClass2 = await q1ChoicesAgain[1].getAttribute('class').catch(() => '');
    bPersists = bClass2.includes('bg-brand-primary');
    console.log('B persists after back nav:', bPersists, '| Class:', bClass2.substring(0, 100));
    if (!bPersists) {
      findings.high.push({ id: 'B1-H12', scenario: 'S-04', title: 'MCQ answer lost when navigating back', criteriaRef: '1.7, 2.1' });
    }
  }

  // Change to C
  let cSelected = false, bDeselected = false;
  if (q1ChoicesAgain.length >= 3) {
    await q1ChoicesAgain[2].click();
    await page.waitForTimeout(600);
    await saveScreenshot(page, 's04_06_change_to_c');
    cSelected = (await q1ChoicesAgain[2].getAttribute('class').catch(() => '')).includes('bg-brand-primary');
    const bClass3 = await q1ChoicesAgain[1].getAttribute('class').catch(() => '');
    bDeselected = !bClass3.includes('bg-brand-primary');
    console.log('C selected:', cSelected, '| B deselected:', bDeselected);
    if (!bDeselected) findings.high.push({ id: 'B1-H13', scenario: 'S-04', title: 'MCQ allows multiple answers selected', criteriaRef: '2.1' });
  }

  // Go to Q2 verify A persists
  await nextBtn.click();
  await page.waitForTimeout(1000);
  const q2ChoicesB = await page.locator('button.flex-1:not([disabled])').all();
  let q2APersists = false;
  if (q2ChoicesB.length >= 1) {
    const aClass2 = await q2ChoicesB[0].getAttribute('class').catch(() => '');
    q2APersists = aClass2.includes('bg-brand-primary');
    console.log('Q2 A persists:', q2APersists);
  }
  await saveScreenshot(page, 's04_07_q2_a_persists');

  const s04Pass = bSelected && bPersists && cSelected && bDeselected && q2APersists;
  results['S-04'] = {
    status: s04Pass ? 'PASS' : 'PARTIAL',
    role, noneSelected, bSelected, bPersists, cSelected, bDeselected, q2APersists,
    issues: findings.high.map(f => f.title)
  };
  console.log('S-04:', results['S-04'].status);
  fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/s04_results.json', JSON.stringify({ results, findings, consoleErrors }, null, 2));
});

test('B1-S05: Question Flagging', async ({ page }) => {
  test.setTimeout(120000);
  const results = {};
  const findings = { high: [], medium: [] };

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') { consoleErrors.push(msg.text()); console.log('[CE]', msg.text()); }
  });

  let role = 'student';
  try { await loginAs(page, 'student'); }
  catch (e) { role = 'teacher'; await loginAs(page, 'teacher'); }

  await page.goto(`http://localhost:5173/ap/test/${MICRO_TEST_ID}`);
  await page.waitForTimeout(3000);

  const beginBtn = page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first();
  if (!await beginBtn.isVisible().catch(() => false)) {
    results['S-05'] = { status: 'SKIP', notes: 'Begin button not found', role };
    fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/s05_results.json', JSON.stringify({ results, findings }, null, 2));
    return;
  }
  await beginBtn.click();
  await page.waitForTimeout(3000);

  // Flag button - it contains ⚐ (unflagged) or 🚩 (flagged) plus text
  const flagBtn = page.locator('button', { hasText: /Flag for Review/ }).first();
  const flagVisible = await flagBtn.isVisible().catch(() => false);
  console.log('Flag for Review visible:', flagVisible);

  if (!flagVisible) {
    results['S-05'] = { status: 'FAIL', notes: 'Flag button not found', role };
    findings.high.push({ id: 'B1-H14', scenario: 'S-05', title: 'Flag for Review button not found', criteriaRef: '1.2' });
    fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/s05_results.json', JSON.stringify({ results, findings }, null, 2));
    return;
  }

  await saveScreenshot(page, 's05_01_before_flag');
  const flagClassBefore = await flagBtn.getAttribute('class').catch(() => '');
  console.log('Flag class before:', flagClassBefore.substring(0, 100));

  // Click flag
  await flagBtn.click();
  await page.waitForTimeout(600);
  await saveScreenshot(page, 's05_02_after_flag_q1');

  // Check new state - look for "Flagged" text
  const flagBtnAfter = page.locator('button', { hasText: /^(Flagged|Flag for Review)$/ }).first();
  const flagTextAfter = await flagBtnAfter.textContent().catch(() => '');
  const flagClassAfter = await flagBtnAfter.getAttribute('class').catch(() => '');
  const isFlagged = flagTextAfter.includes('Flagged') && !flagTextAfter.includes('Flag for Review');
  const hasWarningBg = flagClassAfter.includes('bg-warning');
  console.log('Flag text after:', flagTextAfter.trim(), '| Flagged:', isFlagged, '| Warning bg:', hasWarningBg);

  if (!isFlagged) {
    findings.high.push({ id: 'B1-H15', scenario: 'S-05', title: `Flag button not showing "Flagged" state: "${flagTextAfter.trim()}"`, criteriaRef: '1.2' });
  }
  if (!hasWarningBg) {
    findings.medium.push({ id: 'B1-M04', scenario: 'S-05', title: 'Flag button missing bg-warning class in flagged state', criteriaRef: '1.2' });
  }

  // Navigate to Q2
  const nextBtn = page.locator('button', { hasText: 'Next →' }).first();
  await nextBtn.click();
  await page.waitForTimeout(800);

  // Q2 flag should be unflagged
  const q2FlagBtn = page.locator('button', { hasText: /Flag for Review/ }).first();
  const q2FlagVisible = await q2FlagBtn.isVisible().catch(() => false);
  console.log('Q2 has unflagged Flag button:', q2FlagVisible);

  // Flag Q2
  if (q2FlagVisible) {
    await q2FlagBtn.click();
    await page.waitForTimeout(600);
    await saveScreenshot(page, 's05_03_q2_flagged');
  }

  // Open navigator - click the center button
  const centerBtn = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
  const centerVisible = await centerBtn.isVisible().catch(() => false);
  console.log('Center nav button visible:', centerVisible);

  let navOpens = false, flagsInNav = 0, legendOk = false;

  if (centerVisible) {
    await centerBtn.click();
    await page.waitForTimeout(1000);
    await saveScreenshot(page, 's05_04_nav_open');

    const navHeading = page.locator('h3', { hasText: 'Question Navigator' }).first();
    navOpens = await navHeading.isVisible().catch(() => false);
    console.log('Navigator opens:', navOpens);

    if (navOpens) {
      // Count flag emojis in navigator grid
      flagsInNav = await page.locator('text=🚩').count();
      console.log('Flag emojis in nav:', flagsInNav);

      // Legend
      const legendAnswered = await page.locator('span', { hasText: 'Answered' }).count() > 0;
      const legendFlagged = await page.locator('span', { hasText: 'Flagged' }).count() > 0;
      const legendUnanswered = await page.locator('span', { hasText: 'Unanswered' }).count() > 0;
      legendOk = legendAnswered && legendFlagged && legendUnanswered;
      console.log('Legend: Answered:', legendAnswered, 'Flagged:', legendFlagged, 'Unanswered:', legendUnanswered);
      await saveScreenshot(page, 's05_05_nav_flags');
    }

    // Close via ESC or backdrop
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } else {
    findings.high.push({ id: 'B1-H16', scenario: 'S-05', title: 'Center nav button not visible to open navigator', criteriaRef: '7.4' });
  }

  // Navigate back to Q1 and unflag
  const backBtn = page.locator('button', { hasText: '← Back' }).first();
  if (await backBtn.isVisible().catch(() => false)) {
    await backBtn.click();
    await page.waitForTimeout(600);
  }

  const q1Flagged = page.locator('button', { hasText: 'Flagged' }).first();
  let unflagWorks = false;
  if (await q1Flagged.isVisible().catch(() => false)) {
    await q1Flagged.click();
    await page.waitForTimeout(600);
    const afterText = await page.locator('button').filter({ hasText: /Flag for Review|Flagged/ }).first().textContent().catch(() => '');
    unflagWorks = afterText.includes('Flag for Review') && !afterText.includes('Flagged for');
    console.log('Unflag text:', afterText.trim(), '| Works:', unflagWorks);
    await saveScreenshot(page, 's05_06_unflagged');
  }

  const s05Pass = isFlagged && hasWarningBg && centerVisible && navOpens && flagsInNav >= 2 && legendOk && unflagWorks;
  results['S-05'] = {
    status: s05Pass ? 'PASS' : 'PARTIAL',
    role, isFlagged, hasWarningBg, centerVisible, navOpens, flagsInNav, legendOk, unflagWorks,
    issues: findings.high.map(f => f.title)
  };
  console.log('S-05:', results['S-05'].status);
  fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/s05_results.json', JSON.stringify({ results, findings, consoleErrors }, null, 2));
});

test('B1-S06: Strikethrough on MCQ Choices', async ({ page }) => {
  test.setTimeout(120000);
  const results = {};
  const findings = { high: [], medium: [] };

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') { consoleErrors.push(msg.text()); console.log('[CE]', msg.text()); }
  });

  let role = 'student';
  try { await loginAs(page, 'student'); }
  catch (e) { role = 'teacher'; await loginAs(page, 'teacher'); }

  await page.goto(`http://localhost:5173/ap/test/${MICRO_TEST_ID}`);
  await page.waitForTimeout(3000);

  const beginBtn = page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first();
  if (!await beginBtn.isVisible().catch(() => false)) {
    results['S-06'] = { status: 'SKIP', notes: 'Begin button not found', role };
    fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/s06_results.json', JSON.stringify({ results, findings }, null, 2));
    return;
  }
  await beginBtn.click();
  await page.waitForTimeout(3000);

  // Navigate to Q3 (Next x2)
  const nextBtn = page.locator('button', { hasText: 'Next →' }).first();
  await nextBtn.click(); await page.waitForTimeout(500);
  await nextBtn.click(); await page.waitForTimeout(500);
  await page.waitForTimeout(500);

  const q3Counter = await page.locator('button').filter({ hasText: /Question 3 of/ }).first().textContent().catch(() => '');
  console.log('Q3 counter:', q3Counter.trim());
  await saveScreenshot(page, 's06_01_q3');

  // Find strikethrough buttons (title="Strike through")
  const strikeBtns = await page.locator('button[title="Strike through"]').all();
  console.log('Strike-through buttons (title="Strike through"):', strikeBtns.length);

  // Also check "Remove strikethrough" variant (some may already be struck)
  const allStrikeBtns = await page.locator('button[title="Strike through"], button[title="Remove strikethrough"]').all();
  console.log('All strikethrough buttons:', allStrikeBtns.length);

  if (allStrikeBtns.length === 0) {
    // Debug - show all button titles
    for (const btn of await page.locator('button').all()) {
      const title = await btn.getAttribute('title').catch(() => '');
      if (title) console.log('Button title:', title);
    }
    findings.high.push({ id: 'B1-H17', scenario: 'S-06', title: 'No strikethrough buttons found on MCQ choices', criteriaRef: '1.4' });
    results['S-06'] = { status: 'FAIL', notes: 'No strikethrough buttons found', role };
    fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/s06_results.json', JSON.stringify({ results, findings, consoleErrors }, null, 2));
    return;
  }

  // Click strike on first choice (A)
  const strikeA = page.locator('button[title="Strike through"]').first();
  await strikeA.click();
  await page.waitForTimeout(500);
  await saveScreenshot(page, 's06_02_a_struck');

  // Verify visual effect - line-through on text
  const lineThroughEls = await page.locator('[class*="line-through"]').count();
  const opacityEls = await page.locator('button[class*="opacity"]').count();
  console.log('line-through elements:', lineThroughEls, '| opacity elements:', opacityEls);
  const strikeApplied = lineThroughEls > 0 || opacityEls > 0;
  console.log('Strike visual applied:', strikeApplied);

  // The button should now say "Remove strikethrough"
  const removeStrBtn = page.locator('button[title="Remove strikethrough"]').first();
  const removeStrVisible = await removeStrBtn.isVisible().catch(() => false);
  console.log('Remove strikethrough button appeared:', removeStrVisible);

  // Check active state class on the strike button (bg-muted border-border-strong)
  const strikeActiveCls = await removeStrBtn.getAttribute('class').catch(() => '');
  const hasActiveClass = strikeActiveCls.includes('bg-muted');
  console.log('Strike button active class (bg-muted):', hasActiveClass, '| Class:', strikeActiveCls.substring(0, 100));

  if (!strikeApplied && !removeStrVisible) {
    findings.high.push({ id: 'B1-H18', scenario: 'S-06', title: 'Strikethrough click has no visual effect', criteriaRef: '1.4' });
  }

  // Click strike on choice D (4th button if present)
  const strikeAll = await page.locator('button[title="Strike through"], button[title="Remove strikethrough"]').all();
  let dStrikeApplied = false;
  if (strikeAll.length >= 4) {
    // 4th strike button (D) - but since we struck A, it's now "Remove strikethrough" for A and "Strike through" for B,C,D
    const strikeD = await page.locator('button[title="Strike through"]').nth(2).click().catch(() => null); // 3rd remaining
    await page.waitForTimeout(500);
    const lineThroughAfterD = await page.locator('[class*="line-through"]').count();
    dStrikeApplied = lineThroughAfterD > lineThroughEls;
    console.log('D strike applied:', dStrikeApplied, '| line-through after D:', lineThroughAfterD);
    await saveScreenshot(page, 's06_03_a_d_struck');
  }

  // Click choice B as answer
  const enabledChoices = await page.locator('button.flex-1:not([disabled])').all();
  let bSelected = false;
  if (enabledChoices.length >= 2) {
    await enabledChoices[1].click(); // B
    await page.waitForTimeout(500);
    bSelected = (await enabledChoices[1].getAttribute('class').catch(() => '')).includes('bg-brand-primary');
    console.log('B selected (while A/D struck):', bSelected);
    await saveScreenshot(page, 's06_04_b_selected');
  }

  // Toggle A back to normal (click "Remove strikethrough" for A)
  const removeA = page.locator('button[title="Remove strikethrough"]').first();
  await removeA.click().catch(() => {});
  await page.waitForTimeout(500);
  const lineThroughAfterToggle = await page.locator('[class*="line-through"]').count();
  console.log('line-through after un-strike A:', lineThroughAfterToggle);
  await saveScreenshot(page, 's06_05_a_unstruck');

  // Navigate to Q4 and back - check persistence
  await nextBtn.click();
  await page.waitForTimeout(400);
  const backBtn = page.locator('button', { hasText: '← Back' }).first();
  await backBtn.click();
  await page.waitForTimeout(1000);
  await saveScreenshot(page, 's06_06_persistence');
  const persistedLineThrough = await page.locator('[class*="line-through"]').count();
  const strikePersistedAny = persistedLineThrough > 0;
  console.log('Strike persisted after nav:', strikePersistedAny, '| Count:', persistedLineThrough);

  const s06Pass = strikeApplied && bSelected && strikePersistedAny && allStrikeBtns.length >= 4;
  results['S-06'] = {
    status: s06Pass ? 'PASS' : (strikeApplied ? 'PARTIAL' : 'FAIL'),
    role, strikeButtonCount: allStrikeBtns.length, strikeApplied,
    removeStrVisible, hasActiveClass, bSelected, strikePersistedAny,
    issues: findings.high.map(f => f.title)
  };
  console.log('S-06:', results['S-06'].status);
  fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/s06_results.json', JSON.stringify({ results, findings, consoleErrors }, null, 2));
});

test('B1-S07: Question Navigator Modal', async ({ page }) => {
  test.setTimeout(120000);
  const results = {};
  const findings = { high: [], medium: [] };

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') { consoleErrors.push(msg.text()); console.log('[CE]', msg.text()); }
  });

  let role = 'student';
  try { await loginAs(page, 'student'); }
  catch (e) { role = 'teacher'; await loginAs(page, 'teacher'); }

  await page.goto(`http://localhost:5173/ap/test/${MICRO_TEST_ID}`);
  await page.waitForTimeout(3000);

  const beginBtn = page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first();
  if (!await beginBtn.isVisible().catch(() => false)) {
    results['S-07'] = { status: 'SKIP', notes: 'Begin button not found', role };
    fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/s07_results.json', JSON.stringify({ results, findings }, null, 2));
    return;
  }
  await beginBtn.click();
  await page.waitForTimeout(3000);

  // Answer Q1 (choice A) and Q2 (choice A), flag Q2, navigate to Q3 (choice B)
  const nextBtn = page.locator('button', { hasText: 'Next →' }).first();
  const backBtn = page.locator('button', { hasText: '← Back' }).first();

  // Q1: click first enabled choice
  let q1Choices = await page.locator('button.flex-1:not([disabled])').all();
  if (q1Choices.length > 0) {
    await q1Choices[0].click();
    await page.waitForTimeout(300);
  }

  // Q2
  await nextBtn.click(); await page.waitForTimeout(800);
  let q2Choices = await page.locator('button.flex-1:not([disabled])').all();
  if (q2Choices.length > 0) {
    await q2Choices[0].click();
    await page.waitForTimeout(300);
  }
  // Flag Q2
  const flagQ2 = page.locator('button', { hasText: /Flag for Review/ }).first();
  if (await flagQ2.isVisible().catch(() => false)) {
    await flagQ2.click();
    await page.waitForTimeout(300);
  }

  // Q3
  await nextBtn.click(); await page.waitForTimeout(800);
  let q3Choices = await page.locator('button.flex-1:not([disabled])').all();
  if (q3Choices.length > 1) {
    await q3Choices[1].click(); // B
    await page.waitForTimeout(300);
  }

  await saveScreenshot(page, 's07_01_before_nav');

  // Open navigator
  const centerBtn = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
  const centerVisible = await centerBtn.isVisible().catch(() => false);
  console.log('Center nav button visible:', centerVisible);

  if (!centerVisible) {
    findings.high.push({ id: 'B1-H19', scenario: 'S-07', title: 'Center nav "Question X of Y" button not found', criteriaRef: '7.4' });
    results['S-07'] = { status: 'FAIL', notes: 'Center nav not found', role };
    fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/s07_results.json', JSON.stringify({ results, findings }, null, 2));
    return;
  }

  await centerBtn.click();
  await page.waitForTimeout(1000);
  await saveScreenshot(page, 's07_02_nav_open');

  // Navigator heading (h3)
  const navH3 = page.locator('h3', { hasText: 'Question Navigator' }).first();
  const navOpens = await navH3.isVisible().catch(() => false);
  console.log('Navigator heading visible:', navOpens);

  if (!navOpens) {
    findings.high.push({ id: 'B1-H20', scenario: 'S-07', title: 'Navigator modal did not open', criteriaRef: '7.4' });
    results['S-07'] = { status: 'FAIL', notes: 'Navigator modal did not open', role };
    fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/s07_results.json', JSON.stringify({ results, findings }, null, 2));
    return;
  }

  // Count question boxes (buttons in the grid with number labels or 🚩)
  // They have classes: w-10 h-10 rounded-[--radius-button-sm] border
  const questionBoxes = await page.locator('button.w-10, button.w-12').count();
  console.log('Question boxes (w-10 or w-12):', questionBoxes);

  // Answered boxes (bg-brand-primary within those buttons)
  const answeredBoxes = await page.locator('button.bg-brand-primary').count();
  console.log('Answered boxes:', answeredBoxes);

  // Flagged (border-warning-ring border-2 or contains 🚩)
  const flaggedBoxes = await page.locator('button.border-warning-ring, button').filter({ hasText: '🚩' }).count();
  console.log('Flagged boxes:', flaggedBoxes);

  // Current question highlight (ring-2 ring-info-ring)
  const currentHighlight = await page.locator('button.ring-2').count();
  console.log('Current question highlight (ring-2):', currentHighlight);

  // Legend
  const legendAnswered = await page.locator('span', { hasText: 'Answered' }).count() > 0;
  const legendFlagged = await page.locator('span', { hasText: 'Flagged' }).count() > 0;
  const legendUnanswered = await page.locator('span', { hasText: 'Unanswered' }).count() > 0;
  console.log('Legend: A:', legendAnswered, 'F:', legendFlagged, 'U:', legendUnanswered);

  await saveScreenshot(page, 's07_03_nav_grid');

  // Click Q7 box (should be labeled "7")
  let jumpedToQ7 = false;
  const q7Box = page.locator('button.w-10, button.w-12').filter({ hasText: '7' }).first();
  const q7Exists = await q7Box.isVisible().catch(() => false);
  console.log('Q7 box exists:', q7Exists);
  if (q7Exists) {
    await q7Box.click();
    await page.waitForTimeout(1000);
    await saveScreenshot(page, 's07_04_jumped_q7');
    const q7Counter = await page.locator('button').filter({ hasText: /Question 7 of/ }).first().textContent().catch(() => '');
    jumpedToQ7 = q7Counter.includes('7');
    console.log('Jumped to Q7:', jumpedToQ7, '| Counter:', q7Counter.trim());
    if (!jumpedToQ7) {
      findings.high.push({ id: 'B1-H21', scenario: 'S-07', title: 'Clicking Q7 box in navigator does not jump to Q7', criteriaRef: '7.4' });
    }
  }

  // Re-open navigator and click "Go to Review Screen"
  const centerBtn2 = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
  if (await centerBtn2.isVisible().catch(() => false)) {
    await centerBtn2.click();
    await page.waitForTimeout(1000);
    await saveScreenshot(page, 's07_05_nav_review_btn');

    const reviewBtn = page.locator('button', { hasText: 'Go to Review Screen' }).first();
    const reviewBtnVisible = await reviewBtn.isVisible().catch(() => false);
    console.log('Go to Review Screen button:', reviewBtnVisible);

    if (!reviewBtnVisible) {
      findings.medium.push({ id: 'B1-M05', scenario: 'S-07', title: '"Go to Review Screen" button missing from navigator', criteriaRef: '7.4' });
    } else {
      await reviewBtn.click();
      await page.waitForTimeout(1000);
      await saveScreenshot(page, 's07_06_review_screen');

      const reviewHeading = await page.locator('h2, h1', { hasText: /Review Your Answers/ }).first().isVisible().catch(() => false);
      console.log('Review screen heading:', reviewHeading);

      // Return to questions
      const returnBtn = page.locator('button', { hasText: /Return to Questions/ }).first();
      if (await returnBtn.isVisible().catch(() => false)) {
        await returnBtn.click();
        await page.waitForTimeout(1000);
        console.log('Returned to questions');
      }

      const s07Pass = navOpens && questionBoxes >= 15 && answeredBoxes >= 2 && flaggedBoxes >= 1 &&
        legendAnswered && legendFlagged && legendUnanswered && jumpedToQ7 && reviewBtnVisible;
      results['S-07'] = {
        status: s07Pass ? 'PASS' : 'PARTIAL',
        role, navOpens, questionBoxes, answeredBoxes, flaggedBoxes, currentHighlight,
        legendOk: legendAnswered && legendFlagged && legendUnanswered,
        jumpedToQ7, reviewBtnVisible, reviewHeading,
        issues: findings.high.map(f => f.title)
      };
      console.log('S-07:', results['S-07'].status);
      fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/s07_results.json', JSON.stringify({ results, findings, consoleErrors }, null, 2));
      return;
    }
  }

  // Fallback result if review button not found
  const s07FallbackPass = navOpens && questionBoxes >= 15 && jumpedToQ7;
  results['S-07'] = {
    status: s07FallbackPass ? 'PARTIAL' : 'PARTIAL',
    role, navOpens, questionBoxes, answeredBoxes, flaggedBoxes,
    legendOk: legendAnswered && legendFlagged && legendUnanswered,
    jumpedToQ7, issues: findings.high.map(f => f.title).concat(findings.medium.map(f => f.title))
  };
  console.log('S-07:', results['S-07'].status);
  fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/s07_results.json', JSON.stringify({ results, findings, consoleErrors }, null, 2));
});
