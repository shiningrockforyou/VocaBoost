/**
 * B1 Final Audit — S-01 through S-07
 * Re-run after DuplicateTabModal 3-part fix
 * Uses student account first, falls back to teacher
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const STUDENT_EMAIL = 'student@apboost.test';
const STUDENT_PASSWORD = 'Student123!';
const TEACHER_EMAIL = 'teacher@apboost.test';
const TEACHER_PASSWORD = 'Teacher123!';
const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_b1_final';
const MICRO_TEST_ID = 'test_micro_full_1';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function saveScreenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true }).catch(() => console.log(`[SCREENSHOT FAILED] ${name}`));
  console.log(`[SCREENSHOT] ${name}.png`);
  return filePath;
}

async function loginAs(page, email, password) {
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.keyboard.press('Enter');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 25000 });
  console.log(`[LOGIN] Logged in as ${email}, URL: ${page.url()}`);
}

async function handleDuplicateTabModal(page, context) {
  // Check for modal and handle it
  await page.waitForTimeout(500);
  const dupModal = await page.locator('button').filter({ hasText: /Use This Tab/ }).first().isVisible().catch(() => false);
  if (dupModal) {
    console.log(`[${context}] DuplicateTabModal detected - clicking "Use This Tab"`);
    await page.locator('button').filter({ hasText: /Use This Tab/ }).first().click();
    // Wait for navigation/state change after clicking
    await page.waitForTimeout(3000);
    // Check if we need to wait for page reload
    try {
      await page.waitForSelector('body', { timeout: 5000 });
    } catch (e) {
      console.log(`[${context}] Page reload after modal dismiss`);
      await page.waitForTimeout(2000);
    }
    await saveScreenshot(page, `${context.toLowerCase().replace(/[\s-]+/g,'_')}_after_use_this_tab`);
    const stillVisible = await page.locator('button').filter({ hasText: /Use This Tab/ }).first().isVisible().catch(() => false);
    console.log(`[${context}] Modal still visible after Use This Tab:`, stillVisible);
    return { wasPresent: true, dismissed: !stillVisible };
  }
  return { wasPresent: false, dismissed: false };
}

test('B1-FINAL: S-01 Dashboard', async ({ page }) => {
  test.setTimeout(60000);
  const results = {};

  await loginAs(page, STUDENT_EMAIL, STUDENT_PASSWORD).catch(async () => {
    await loginAs(page, TEACHER_EMAIL, TEACHER_PASSWORD);
  });
  await saveScreenshot(page, 's01_login');

  await page.goto('http://localhost:5173/ap');
  await page.waitForTimeout(5000);
  await saveScreenshot(page, 's01_dashboard');

  const h1Text = await page.locator('h1').first().textContent().catch(() => '');
  const microCard = await page.locator('h3, h2').filter({ hasText: /Microeconomics/ }).count();
  const macroCard = await page.locator('h3, h2').filter({ hasText: /Macroeconomics/ }).count();
  const calcCard = await page.locator('h3, h2').filter({ hasText: /Calculus/ }).count();
  const statusBadges = await page.locator('span').filter({ hasText: /Not Started|In Progress|Completed/ }).count();
  const sectionText = await page.locator('text=/\\d+ sections?/').count();
  const timeText = await page.locator('text=/\\d+ min/').count();
  const errorBanner = await page.locator('[class*="bg-error"]').count();
  const apHeaderLink = await page.locator('a[href="/ap"]').count();
  const skeletonVisible = await page.locator('[class*="animate-pulse"]').count();

  console.log('H1:', h1Text.trim());
  console.log('Cards - Micro:', microCard, '| Macro:', macroCard, '| Calc:', calcCard);
  console.log('Status badges:', statusBadges, '| Section text:', sectionText, '| Time text:', timeText);
  console.log('Error banners:', errorBanner, '| AP header link:', apHeaderLink, '| Skeleton:', skeletonVisible);

  const s01Issues = [];
  if (!h1Text.trim().includes('AP Practice Tests')) s01Issues.push(`H1 wrong: "${h1Text.trim()}"`);
  if (microCard === 0) s01Issues.push('Micro card missing');
  if (macroCard === 0) s01Issues.push('Macro card missing');
  if (calcCard === 0) s01Issues.push('Calc card missing');
  if (statusBadges < 3) s01Issues.push(`Only ${statusBadges} status badges`);
  if (sectionText < 1) s01Issues.push('Section count text missing');
  if (errorBanner > 0) s01Issues.push('Error banner shown');

  results['S-01'] = {
    status: s01Issues.length === 0 ? 'PASS' : (microCard > 0 && macroCard > 0 && calcCard > 0 ? 'PARTIAL' : 'FAIL'),
    h1: h1Text.trim(), microCard, macroCard, calcCard, statusBadges, sectionText, timeText,
    errorBanner, apHeaderLink, skeletonVisible, issues: s01Issues
  };

  console.log('S-01:', results['S-01'].status, s01Issues.length ? s01Issues : 'CLEAN');

  // Save partial
  const existing = JSON.parse(fs.readFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b1_final_results.json', 'utf8').replace('{}', '{"results":{}}').trim()).results || {};
  existing['S-01'] = results['S-01'];
  fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b1_final_results.json', JSON.stringify({ results: existing, runAt: new Date().toISOString() }, null, 2));

  expect(s01Issues).toHaveLength(0);
});

test('B1-FINAL: S-02 Instruction Screen', async ({ page }) => {
  test.setTimeout(90000);

  await loginAs(page, STUDENT_EMAIL, STUDENT_PASSWORD).catch(async () => {
    await loginAs(page, TEACHER_EMAIL, TEACHER_PASSWORD);
  });

  await page.goto(`http://localhost:5173/ap/test/${MICRO_TEST_ID}`);
  await page.waitForTimeout(4000);

  // Handle any modal from a prior session
  await handleDuplicateTabModal(page, 'S-02-pre');

  // Make sure we're on the instruction screen (not in the test)
  const timerInTest = await page.locator('[class*="font-mono"]').first().isVisible().catch(() => false);
  if (timerInTest) {
    // We're inside the test, navigate back to dashboard and then to instruction
    await page.goto('http://localhost:5173/ap');
    await page.waitForTimeout(2000);
    await page.goto(`http://localhost:5173/ap/test/${MICRO_TEST_ID}`);
    await page.waitForTimeout(3000);
    await handleDuplicateTabModal(page, 'S-02-retry');
  }

  await saveScreenshot(page, 's02_instruction');
  console.log('URL:', page.url());

  const instrH1 = await page.locator('h1').first().textContent().catch(() => '');
  const beginBtn = await page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first().isVisible().catch(() => false);
  const cancelBtn = await page.locator('button').filter({ hasText: /Cancel/ }).first().isVisible().catch(() => false);
  const beginBtnText = await page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first().textContent().catch(() => '');
  const sectionBreakdown = await page.locator('text=/This test has \\d+ sections?/').count();
  const totalTimeText = await page.locator('text=/Total time:/').count();
  const frqInfoBox = await page.locator('[class*="bg-info"]').count();
  const freeResponseH3 = await page.locator('h3').filter({ hasText: /Free Response Section/ }).count();
  const warningBox = await page.locator('[class*="bg-warning"]').count();
  const cannotPause = await page.locator('li, p').filter({ hasText: /cannot pause the timer/i }).count();
  const cannotReturn = await page.locator('li, p').filter({ hasText: /cannot return to previous sections/i }).count();

  console.log('H1:', instrH1.trim());
  console.log('Begin:', beginBtn, '(text:', beginBtnText.trim(), ') | Cancel:', cancelBtn);
  console.log('Section breakdown:', sectionBreakdown, '| Total time:', totalTimeText);
  console.log('FRQ info (bg-info):', frqInfoBox, '| Free Response h3:', freeResponseH3);
  console.log('Warning box:', warningBox, '| cannot-pause:', cannotPause, '| cannot-return:', cannotReturn);

  await saveScreenshot(page, 's02_instruction_elements');

  // Test Cancel
  let cancelWorks = false;
  if (cancelBtn) {
    await page.locator('button').filter({ hasText: /Cancel/ }).first().click();
    await page.waitForTimeout(2000);
    const afterCancelUrl = page.url();
    cancelWorks = afterCancelUrl.includes('/ap') && !afterCancelUrl.includes('/test/');
    console.log('After cancel URL:', afterCancelUrl, '| cancelWorks:', cancelWorks);
    await saveScreenshot(page, 's02_after_cancel');
  }

  const s02Issues = [];
  if (!instrH1.includes('Microeconomics')) s02Issues.push(`H1 wrong: "${instrH1.trim()}"`);
  if (!beginBtn) s02Issues.push('Begin Test button missing');
  if (!cancelBtn) s02Issues.push('Cancel button missing');
  if (cancelBtn && !cancelWorks) s02Issues.push('Cancel does not navigate to dashboard');
  if (!beginBtnText.trim().includes('Begin Test')) s02Issues.push(`Button says "${beginBtnText.trim()}" not "Begin Test"`);
  if (sectionBreakdown === 0) s02Issues.push('Section breakdown text missing');
  if (frqInfoBox === 0) s02Issues.push('FRQ info box (bg-info) missing');
  if (freeResponseH3 === 0) s02Issues.push('Free Response Section h3 missing');
  if (warningBox === 0) s02Issues.push('Warning box (bg-warning) missing');
  if (cannotPause === 0) s02Issues.push('"cannot pause the timer" text missing');
  if (cannotReturn === 0) s02Issues.push('"cannot return to previous sections" text missing');

  const result = {
    status: s02Issues.length === 0 ? 'PASS' : (beginBtn ? 'PARTIAL' : 'FAIL'),
    instrH1: instrH1.trim(), beginBtn, cancelBtn, cancelWorks, beginBtnText: beginBtnText.trim(),
    sectionBreakdown, totalTimeText, frqInfoBox, freeResponseH3, warningBox, cannotPause, cannotReturn,
    issues: s02Issues
  };

  console.log('S-02:', result.status, s02Issues.length ? s02Issues : 'CLEAN');

  try {
    const existing = JSON.parse(fs.readFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b1_final_results.json', 'utf8'));
    existing.results = existing.results || {};
    existing.results['S-02'] = result;
    fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b1_final_results.json', JSON.stringify(existing, null, 2));
  } catch (e) {}
});

test('B1-FINAL: S-03 to S-07 Core Test Flow', async ({ page }) => {
  test.setTimeout(600000);

  const results = {};
  const findings = { blocker: [], high: [], medium: [], nitpick: [] };
  const consoleErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('ERR_BLOCKED_BY_CLIENT') && !text.includes('net::ERR_') && !text.includes('firebasedependencies')) {
        consoleErrors.push({ url: page.url(), msg: text.substring(0, 200) });
        console.log('[CONSOLE_ERROR]', text.substring(0, 150));
      }
    }
  });

  let accountType = 'student';
  try {
    await loginAs(page, STUDENT_EMAIL, STUDENT_PASSWORD);
    console.log('[LOGIN] Student login succeeded');
  } catch (err) {
    console.log('[LOGIN] Student login failed:', err.message, '- falling back to teacher');
    accountType = 'teacher';
    await loginAs(page, TEACHER_EMAIL, TEACHER_PASSWORD);
  }
  await saveScreenshot(page, 's03_login');

  // =====================================================
  // S-03: Begin Test
  // =====================================================
  console.log('\n=== S-03: Begin Test ===');

  await page.goto(`http://localhost:5173/ap/test/${MICRO_TEST_ID}`);
  await page.waitForTimeout(4000);

  // Handle any modal
  const dupResult03a = await handleDuplicateTabModal(page, 'S-03-initial');

  await page.waitForTimeout(1000);
  let beginBtn03 = await page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first().isVisible().catch(() => false);
  let timerVisible03 = await page.locator('[class*="font-mono"]').first().isVisible().catch(() => false);
  let q1Check03 = await page.locator('text=/Question 1/').count();

  console.log('State: begin:', beginBtn03, '| timer:', timerVisible03, '| Q1 count:', q1Check03);
  await saveScreenshot(page, 's03_01_initial_state');

  if (beginBtn03) {
    console.log('[S-03] Clicking Begin Test...');
    await page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first().click();
    await page.waitForTimeout(5000);
    await saveScreenshot(page, 's03_02_after_begin');
  } else {
    console.log('[S-03] Already in test or other state');
    await saveScreenshot(page, 's03_02_already_in_test');
  }

  // Handle modal after begin (initial heartbeat fires)
  const dupResult03b = await handleDuplicateTabModal(page, 'S-03-post-begin');
  const modalPersisted = (dupResult03b.wasPresent && !dupResult03b.dismissed);

  if (modalPersisted) {
    console.log('[S-03] BLOCKER: Modal still showing after Use This Tab');
    findings.blocker.push({ id: 'FINDING-B1-001', scenario: 'S-03', title: 'DuplicateTabModal persists after clicking "Use This Tab"', criteriaRef: '1.1' });
  } else if (dupResult03a.wasPresent || dupResult03b.wasPresent) {
    console.log('[S-03] DuplicateTabModal was shown and successfully dismissed');
  }

  await page.waitForTimeout(1000);

  // Verify test interface
  const hamburger03 = await page.locator('[aria-label="Open menu"]').first().isVisible().catch(() => false);
  const sectionLabel03 = await page.locator('text=/Section \\d+ of \\d+/').first().textContent().catch(() => '');

  // Timer countdown
  const timerEl03 = page.locator('[class*="font-mono"]').first();
  const timerText1 = await timerEl03.textContent().catch(() => '');
  await page.waitForTimeout(3000);
  const timerText2 = await timerEl03.textContent().catch(() => '');
  const timerCountDown = timerText1.trim() !== '' && timerText2.trim() !== '' && timerText1.trim() !== timerText2.trim();
  console.log('Timer:', timerText1.trim(), '->', timerText2.trim(), '| Counting:', timerCountDown);
  console.log('Hamburger:', hamburger03, '| Section:', sectionLabel03.trim());

  await saveScreenshot(page, 's03_03_timer_verify');

  const q1LabelAlt = await page.locator('text=/Question 1/').count();
  const allChoiceBtns = await page.locator('button.flex-1').all();
  let enabledChoices = 0;
  for (const btn of allChoiceBtns) {
    const isDisabled = await btn.isDisabled().catch(() => false);
    if (!isDisabled) enabledChoices++;
  }
  const strikeBtns = await page.locator('button[title="Strike through"], button[title="Remove strikethrough"]').count();
  const backBtn03 = page.locator('button').filter({ hasText: '← Back' }).first();
  const nextBtn03 = page.locator('button').filter({ hasText: 'Next →' }).first();
  const backVisible03 = await backBtn03.isVisible().catch(() => false);
  const backDisabled03 = backVisible03 ? await backBtn03.isDisabled().catch(() => true) : true;
  const nextVisible03 = await nextBtn03.isVisible().catch(() => false);
  const centerNavText03 = await page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first().textContent().catch(() => '');
  const centerNavVisible03 = await page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first().isVisible().catch(() => false);
  const flagVisible03 = await page.locator('button').filter({ hasText: /Flag for Review/ }).first().isVisible().catch(() => false);

  console.log('Q1 labels:', q1LabelAlt, '| Choices(all/enabled):', allChoiceBtns.length, '/', enabledChoices);
  console.log('Strike btns:', strikeBtns);
  console.log('Back:', backVisible03, 'disabled:', backDisabled03, '| Next:', nextVisible03);
  console.log('Center nav:', centerNavText03.trim(), 'visible:', centerNavVisible03);
  console.log('Flag:', flagVisible03);

  await saveScreenshot(page, 's03_04_full_interface');

  const s03Issues = [];
  if (modalPersisted) s03Issues.push('DuplicateTabModal persists');
  if (!timerCountDown) s03Issues.push(`Timer not counting down: "${timerText1.trim()}" -> "${timerText2.trim()}"`);
  if (q1LabelAlt === 0) s03Issues.push('Q1 label not visible');
  if (enabledChoices < 4) s03Issues.push(`Only ${enabledChoices} enabled choices`);
  if (strikeBtns < 4) s03Issues.push(`Only ${strikeBtns} strikethrough buttons`);
  if (!nextVisible03) s03Issues.push('Next button missing');
  if (!flagVisible03) s03Issues.push('Flag for Review missing');
  if (!centerNavVisible03) s03Issues.push('Center nav button missing');
  if (backVisible03 && !backDisabled03) s03Issues.push('Back should be disabled on Q1');
  if (!hamburger03) s03Issues.push('Hamburger menu missing');

  results['S-03'] = {
    status: s03Issues.length === 0 ? 'PASS' : (enabledChoices >= 4 && timerCountDown && !modalPersisted ? 'PARTIAL' : 'FAIL'),
    modalPersisted, dupModalWasPresent: dupResult03a.wasPresent || dupResult03b.wasPresent,
    dupModalDismissed: !modalPersisted,
    timerCountDown, timerTexts: `${timerText1.trim()}->${timerText2.trim()}`,
    hamburger: hamburger03, sectionLabel: sectionLabel03.trim(),
    q1Label: q1LabelAlt, enabledChoices, strikeBtns,
    backVisible: backVisible03, backDisabled: backDisabled03, nextVisible: nextVisible03,
    centerNavText: centerNavText03.trim(), centerNavVisible: centerNavVisible03, flagVisible: flagVisible03,
    issues: s03Issues
  };
  console.log('S-03:', results['S-03'].status, s03Issues.length ? s03Issues : 'CLEAN');

  // =====================================================
  // S-04: MCQ Answer Selection
  // =====================================================
  console.log('\n=== S-04: MCQ Answer Selection ===');

  if (enabledChoices < 2 || modalPersisted) {
    results['S-04'] = { status: 'FAIL', notes: 'Blocked by S-03' };
  } else {
    const q1Choices = await page.locator('button.flex-1').all();

    // Click B (index 1)
    if (q1Choices.length > 1) {
      await q1Choices[1].click();
      await page.waitForTimeout(800);
    }
    await saveScreenshot(page, 's04_01_b_selected');

    const freshQ1a = await page.locator('button.flex-1').all();
    const bClass = freshQ1a.length > 1 ? await freshQ1a[1].getAttribute('class').catch(() => '') : '';
    const aClass = freshQ1a.length > 0 ? await freshQ1a[0].getAttribute('class').catch(() => '') : '';
    const bSelected = bClass.includes('bg-brand-primary');
    const aNotSelected = !aClass.includes('bg-brand-primary');
    console.log('B selected:', bSelected, '| A not selected:', aNotSelected);

    // Go to Q2
    await page.locator('button').filter({ hasText: 'Next →' }).first().click();
    await page.waitForTimeout(1500);
    await saveScreenshot(page, 's04_02_q2');
    const q2Counter = await page.locator('button').filter({ hasText: /Question 2 of/ }).first().textContent().catch(() => '');
    console.log('Q2 counter:', q2Counter.trim());

    // Select A on Q2
    const q2Choices = await page.locator('button.flex-1').all();
    let q2ASelected = false;
    if (q2Choices.length > 0) {
      await q2Choices[0].click();
      await page.waitForTimeout(600);
      const freshQ2 = await page.locator('button.flex-1').all();
      const cls = freshQ2.length > 0 ? await freshQ2[0].getAttribute('class').catch(() => '') : '';
      q2ASelected = cls.includes('bg-brand-primary');
    }
    console.log('Q2 A selected:', q2ASelected);
    await saveScreenshot(page, 's04_03_q2_a_selected');

    // Back to Q1
    await page.locator('button').filter({ hasText: '← Back' }).first().click();
    await page.waitForTimeout(1500);
    await saveScreenshot(page, 's04_04_q1_back');

    const freshQ1b = await page.locator('button.flex-1').all();
    let bPersists = false;
    if (freshQ1b.length > 1) {
      const cls = await freshQ1b[1].getAttribute('class').catch(() => '');
      bPersists = cls.includes('bg-brand-primary');
    }
    console.log('B persists:', bPersists);

    // Change to C
    const q1ForChange = await page.locator('button.flex-1').all();
    let cSelected = false, bDeselected = false;
    if (q1ForChange.length > 2) {
      await q1ForChange[2].click();
      await page.waitForTimeout(600);
      const freshAfterC = await page.locator('button.flex-1').all();
      if (freshAfterC.length > 2) {
        cSelected = (await freshAfterC[2].getAttribute('class').catch(() => '')).includes('bg-brand-primary');
        bDeselected = !(await freshAfterC[1].getAttribute('class').catch(() => '')).includes('bg-brand-primary');
      }
    }
    console.log('C selected:', cSelected, '| B deselected:', bDeselected);
    await saveScreenshot(page, 's04_05_c_selected');

    // Forward to Q2
    await page.locator('button').filter({ hasText: 'Next →' }).first().click();
    await page.waitForTimeout(1500);
    const q2bChoices = await page.locator('button.flex-1').all();
    let q2APersists = false;
    if (q2bChoices.length > 0) {
      const cls = await q2bChoices[0].getAttribute('class').catch(() => '');
      q2APersists = cls.includes('bg-brand-primary');
    }
    console.log('Q2 A persists:', q2APersists);
    await saveScreenshot(page, 's04_06_q2_persist');

    const s04Issues = [];
    if (!bSelected) s04Issues.push('B click did not select');
    if (!aNotSelected) s04Issues.push('A also selected with B');
    if (!bPersists) s04Issues.push('B lost on back nav');
    if (!cSelected) s04Issues.push('C not selectable');
    if (!bDeselected) s04Issues.push('B not deselected when C selected');
    if (!q2APersists) s04Issues.push('Q2 A lost on forward nav');

    results['S-04'] = {
      status: s04Issues.length === 0 ? 'PASS' : 'PARTIAL',
      bSelected, aNotSelected, q2ASelected, bPersists, cSelected, bDeselected, q2APersists, issues: s04Issues
    };
    console.log('S-04:', results['S-04'].status, s04Issues.length ? s04Issues : 'CLEAN');

    if (!bPersists) findings.high.push({ id: 'FINDING-B1-002', scenario: 'S-04', title: 'MCQ answer lost when navigating back', criteriaRef: '1.7' });
    if (!bDeselected) findings.high.push({ id: 'FINDING-B1-003', scenario: 'S-04', title: 'MCQ allows multiple simultaneous selections', criteriaRef: '2.1' });
  }

  // =====================================================
  // S-05: Question Flagging
  // =====================================================
  console.log('\n=== S-05: Question Flagging ===');

  // Navigate back to Q1
  const backBtn05check = page.locator('button').filter({ hasText: '← Back' }).first();
  if (await backBtn05check.isVisible().catch(() => false) && !await backBtn05check.isDisabled().catch(() => true)) {
    await backBtn05check.click();
    await page.waitForTimeout(800);
  }
  const currentQ05 = await page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first().textContent().catch(() => '');
  console.log('Current Q:', currentQ05.trim());

  const flagBtn05 = page.locator('button').filter({ hasText: /Flag for Review/ }).first();
  const flagVisible05 = await flagBtn05.isVisible().catch(() => false);
  console.log('Flag for Review visible:', flagVisible05);

  if (!flagVisible05) {
    results['S-05'] = { status: 'FAIL', notes: '"Flag for Review" not found' };
    findings.high.push({ id: 'FINDING-B1-004', scenario: 'S-05', title: '"Flag for Review" button not visible', criteriaRef: '1.2' });
  } else {
    await saveScreenshot(page, 's05_01_before_flag');

    // Flag Q1
    await flagBtn05.click();
    await page.waitForTimeout(700);
    await saveScreenshot(page, 's05_02_q1_flagged');

    const flaggedBtn05 = page.locator('button').filter({ hasText: 'Flagged' }).first();
    const flaggedVisible = await flaggedBtn05.isVisible().catch(() => false);
    const flaggedClass = await flaggedBtn05.getAttribute('class').catch(() => '');
    const hasBgWarning = flaggedClass.includes('bg-warning');
    console.log('Flagged visible:', flaggedVisible, '| bg-warning:', hasBgWarning);
    console.log('Flagged class excerpt:', flaggedClass.substring(0, 120));

    // Go to Q2 and flag it
    await page.locator('button').filter({ hasText: 'Next →' }).first().click();
    await page.waitForTimeout(800);
    const q2FlagBtn = page.locator('button').filter({ hasText: /Flag for Review/ }).first();
    if (await q2FlagBtn.isVisible().catch(() => false)) {
      await q2FlagBtn.click();
      await page.waitForTimeout(700);
    }
    await saveScreenshot(page, 's05_03_q2_flagged');

    // Open Question Navigator
    const centerBtn05 = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
    let navOpens = false, flagsInNav = 0, legendOk = false;

    if (await centerBtn05.isVisible().catch(() => false)) {
      await centerBtn05.click();
      await page.waitForTimeout(1500);
      await saveScreenshot(page, 's05_04_navigator');

      navOpens = await page.locator('h3').filter({ hasText: 'Question Navigator' }).first().isVisible().catch(() => false);
      console.log('Navigator opens:', navOpens);

      if (navOpens) {
        flagsInNav = await page.locator('button').filter({ hasText: '🚩' }).count();
        const answeredLeg = await page.locator('span, div').filter({ hasText: /^Answered$/ }).count();
        const flaggedLeg = await page.locator('span, div').filter({ hasText: /^Flagged$/ }).count();
        const unanswLeg = await page.locator('span, div').filter({ hasText: /^Unanswered$/ }).count();
        legendOk = answeredLeg > 0 && flaggedLeg > 0 && unanswLeg > 0;
        console.log('Flags:', flagsInNav, '| Legend (A/F/U):', answeredLeg, flaggedLeg, unanswLeg, '| ok:', legendOk);
        await saveScreenshot(page, 's05_05_nav_flags');
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }

    // Back to Q1 and unflag
    const back05 = page.locator('button').filter({ hasText: '← Back' }).first();
    if (await back05.isVisible().catch(() => false) && !await back05.isDisabled().catch(() => true)) {
      await back05.click();
      await page.waitForTimeout(800);
    }

    let unflagWorks = false;
    const q1FlaggedState = page.locator('button').filter({ hasText: 'Flagged' }).first();
    if (await q1FlaggedState.isVisible().catch(() => false)) {
      await q1FlaggedState.click();
      await page.waitForTimeout(600);
      const afterText = await page.locator('button').filter({ hasText: /Flag for Review|Flagged/ }).first().textContent().catch(() => '');
      unflagWorks = afterText.trim().includes('Flag for Review');
      console.log('After unflag:', afterText.trim(), '| reverts:', unflagWorks);
    }
    await saveScreenshot(page, 's05_06_unflagged');

    const s05Issues = [];
    if (!flaggedVisible) s05Issues.push('Flag not toggling to "Flagged"');
    if (flaggedVisible && !hasBgWarning) s05Issues.push('Missing bg-warning on flagged');
    if (!navOpens) s05Issues.push('Navigator not opening');
    if (navOpens && flagsInNav < 2) s05Issues.push(`Only ${flagsInNav} flags (expected 2)`);
    if (navOpens && !legendOk) s05Issues.push('Legend incomplete');
    if (!unflagWorks) s05Issues.push('Unflag not reverting');

    results['S-05'] = {
      status: s05Issues.length === 0 ? 'PASS' : (flaggedVisible && hasBgWarning ? 'PARTIAL' : 'FAIL'),
      flaggedVisible, hasBgWarning, navOpens, flagsInNav, legendOk, unflagWorks, issues: s05Issues
    };
    console.log('S-05:', results['S-05'].status, s05Issues.length ? s05Issues : 'CLEAN');

    if (!flaggedVisible) findings.high.push({ id: 'FINDING-B1-005', scenario: 'S-05', title: 'Flag not toggling to "Flagged"', criteriaRef: '1.2' });
    if (!navOpens) findings.high.push({ id: 'FINDING-B1-006', scenario: 'S-05', title: 'Question Navigator does not open', criteriaRef: '7.4' });
    if (navOpens && flagsInNav < 2) findings.high.push({ id: 'FINDING-B1-007', scenario: 'S-05', title: `Navigator shows ${flagsInNav} flags (expected 2)`, criteriaRef: '1.2' });
    if (flaggedVisible && !hasBgWarning) findings.medium.push({ id: 'FINDING-B1-M01', scenario: 'S-05', title: 'Flagged button missing bg-warning class', criteriaRef: '1.2' });
  }

  // =====================================================
  // S-06: Strikethrough
  // =====================================================
  console.log('\n=== S-06: Strikethrough ===');

  // Navigate to Q3
  let navCount = 0;
  while (navCount < 8) {
    const counter = await page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first().textContent().catch(() => '');
    if (counter.includes('Question 3 of')) break;
    const m = counter.match(/Question (\d+) of/);
    const qNum = m ? parseInt(m[1]) : 1;
    if (qNum < 3) {
      const n = page.locator('button').filter({ hasText: 'Next →' }).first();
      if (await n.isVisible().catch(() => false)) { await n.click(); await page.waitForTimeout(500); }
    } else if (qNum > 3) {
      const b = page.locator('button').filter({ hasText: '← Back' }).first();
      if (await b.isVisible().catch(() => false)) { await b.click(); await page.waitForTimeout(500); }
    } else break;
    navCount++;
  }

  const q3Counter = await page.locator('button').filter({ hasText: /Question 3 of/ }).first().textContent().catch(() => '');
  console.log('On Q3:', q3Counter.trim() || 'NOT Q3');
  await saveScreenshot(page, 's06_01_q3');

  const strikeBtnsQ3 = await page.locator('button[title="Strike through"], button[title="Remove strikethrough"]').all();
  console.log('Strike buttons on Q3:', strikeBtnsQ3.length);

  if (strikeBtnsQ3.length === 0) {
    results['S-06'] = { status: 'FAIL', notes: 'No strikethrough buttons' };
    findings.high.push({ id: 'FINDING-B1-008', scenario: 'S-06', title: 'No strikethrough buttons on MCQ choices', criteriaRef: '1.4' });
  } else {
    // Strike A
    await page.locator('button[title="Strike through"]').first().click();
    await page.waitForTimeout(600);
    await saveScreenshot(page, 's06_02_a_struck');

    const lineThroughCount = await page.locator('[class*="line-through"]').count();
    const opacityCount = await page.locator('button.flex-1[class*="opacity"]').count();
    const strikeApplied = lineThroughCount > 0 || opacityCount > 0;
    const removeClass06 = await page.locator('button[title="Remove strikethrough"]').first().getAttribute('class').catch(() => '');
    const hasBgMuted = removeClass06.includes('bg-muted');
    console.log('line-through:', lineThroughCount, '| opacity:', opacityCount, '| applied:', strikeApplied);
    console.log('Remove btn bg-muted:', hasBgMuted);

    // Strike D (index 2 of remaining)
    const remaining = await page.locator('button[title="Strike through"]').all();
    let multiStruck = false;
    if (remaining.length >= 2) {
      await remaining[remaining.length >= 3 ? 2 : remaining.length - 1].click();
      await page.waitForTimeout(500);
      const linesNow = await page.locator('[class*="line-through"]').count();
      multiStruck = linesNow > lineThroughCount;
      console.log('Multi-strike (D):', multiStruck, '(lines:', linesNow, ')');
    }
    await saveScreenshot(page, 's06_03_multi_struck');

    // Select B while strikes active
    const choices06 = await page.locator('button.flex-1').all();
    let bSelectedWithStrikes = false;
    if (choices06.length >= 2) {
      await choices06[1].click();
      await page.waitForTimeout(600);
      const freshC = await page.locator('button.flex-1').all();
      if (freshC.length >= 2) {
        bSelectedWithStrikes = (await freshC[1].getAttribute('class').catch(() => '')).includes('bg-brand-primary');
      }
      console.log('B selected with strikes:', bSelectedWithStrikes);
    }
    await saveScreenshot(page, 's06_04_b_with_strikes');

    // Toggle off A
    const removeA06 = page.locator('button[title="Remove strikethrough"]').first();
    if (await removeA06.isVisible().catch(() => false)) {
      await removeA06.click();
      await page.waitForTimeout(500);
    }
    const linesAfterUnstrike = await page.locator('[class*="line-through"]').count();
    console.log('Lines after un-strike A:', linesAfterUnstrike);
    await saveScreenshot(page, 's06_05_a_unstruck');

    // Nav Q4 and back - persistence
    await page.locator('button').filter({ hasText: 'Next →' }).first().click();
    await page.waitForTimeout(600);
    const backBtn06 = page.locator('button').filter({ hasText: '← Back' }).first();
    if (await backBtn06.isVisible().catch(() => false)) { await backBtn06.click(); await page.waitForTimeout(1000); }
    await saveScreenshot(page, 's06_06_after_nav');
    const persistedLines = await page.locator('[class*="line-through"]').count();
    console.log('Persisted lines after nav:', persistedLines);

    const s06Issues = [];
    if (!strikeApplied) s06Issues.push('Strikethrough has no visual effect');
    if (strikeApplied && !hasBgMuted) s06Issues.push('Remove btn missing bg-muted');
    if (!bSelectedWithStrikes) s06Issues.push('Cannot select answer while strikes active');
    if (persistedLines === 0) s06Issues.push('Strikethrough not persisting through navigation');

    results['S-06'] = {
      status: s06Issues.length === 0 ? 'PASS' : (strikeApplied ? 'PARTIAL' : 'FAIL'),
      strikeBtnsFound: strikeBtnsQ3.length, strikeApplied, hasBgMuted, multiStruck,
      bSelectedWithStrikes, persistedAfterNav: persistedLines > 0, issues: s06Issues
    };
    console.log('S-06:', results['S-06'].status, s06Issues.length ? s06Issues : 'CLEAN');

    if (!strikeApplied) findings.high.push({ id: 'FINDING-B1-009', scenario: 'S-06', title: 'Strikethrough has no visual effect', criteriaRef: '1.4' });
    if (!hasBgMuted && strikeApplied) findings.medium.push({ id: 'FINDING-B1-M02', scenario: 'S-06', title: 'Remove strikethrough btn missing bg-muted', criteriaRef: '1.4' });
  }

  // =====================================================
  // S-07: Question Navigator
  // =====================================================
  console.log('\n=== S-07: Question Navigator ===');

  await saveScreenshot(page, 's07_01_before_nav');
  const centerBtn07 = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
  const centerVisible07 = await centerBtn07.isVisible().catch(() => false);
  console.log('Center nav visible:', centerVisible07);

  if (!centerVisible07) {
    results['S-07'] = { status: 'FAIL', notes: 'Center nav button not found' };
    findings.high.push({ id: 'FINDING-B1-010', scenario: 'S-07', title: 'Center "Question X of Y" nav button not visible', criteriaRef: '7.4' });
  } else {
    await centerBtn07.click();
    await page.waitForTimeout(1500);
    await saveScreenshot(page, 's07_02_nav_open');

    const navH3 = await page.locator('h3').filter({ hasText: 'Question Navigator' }).first().isVisible().catch(() => false);
    const qBoxes = await page.locator('button.w-10, button.w-12').count();
    const answeredBoxes07 = await page.locator('button[class*="bg-brand-primary"]').filter({ hasText: /[0-9🚩]/ }).count();
    const flagBoxes07 = await page.locator('button').filter({ hasText: '🚩' }).count();
    const ringHighlight07 = await page.locator('button[class*="ring-2"]').count();
    const answeredLeg07 = await page.locator('span, div').filter({ hasText: /^Answered$/ }).count();
    const flaggedLeg07 = await page.locator('span, div').filter({ hasText: /^Flagged$/ }).count();
    const unanswLeg07 = await page.locator('span, div').filter({ hasText: /^Unanswered$/ }).count();
    const legendOk07 = answeredLeg07 > 0 && flaggedLeg07 > 0 && unanswLeg07 > 0;

    console.log('Nav h3:', navH3, '| Grid boxes:', qBoxes, '| Answered:', answeredBoxes07, '| Flags:', flagBoxes07, '| Ring:', ringHighlight07);
    console.log('Legend (A/F/U):', answeredLeg07, flaggedLeg07, unanswLeg07, '| ok:', legendOk07);

    await saveScreenshot(page, 's07_03_nav_grid');

    // Click Q7
    let jumpedQ7 = false;
    const q7Box = page.locator('button.w-10, button.w-12').filter({ hasText: '7' }).first();
    const q7Visible = await q7Box.isVisible().catch(() => false);

    if (q7Visible) {
      await q7Box.click();
      await page.waitForTimeout(1500);
      await saveScreenshot(page, 's07_04_jump_q7');
      const q7Counter = await page.locator('button').filter({ hasText: /Question 7 of/ }).first().textContent().catch(() => '');
      jumpedQ7 = q7Counter.includes('7');
      console.log('Jumped to Q7:', jumpedQ7, '(counter:', q7Counter.trim(), ')');
    } else {
      console.log('Q7 box not visible in navigator');
    }

    // Re-open for Review Screen button
    const center07b = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
    let reviewBtnOk = false, reviewScreenLoads = false, returnBtnOk = false;

    if (await center07b.isVisible().catch(() => false)) {
      await center07b.click();
      await page.waitForTimeout(1200);
      await saveScreenshot(page, 's07_05_nav_for_review');

      const goToReviewBtn = page.locator('button').filter({ hasText: 'Go to Review Screen' }).first();
      reviewBtnOk = await goToReviewBtn.isVisible().catch(() => false);
      console.log('"Go to Review Screen" visible:', reviewBtnOk);

      if (reviewBtnOk) {
        await goToReviewBtn.click();
        await page.waitForTimeout(1500);
        await saveScreenshot(page, 's07_06_review_screen');
        reviewScreenLoads = await page.locator('h2, h1').filter({ hasText: /Review Your Answers/ }).first().isVisible().catch(() => false);
        console.log('Review screen loads:', reviewScreenLoads);

        const returnBtn07 = page.locator('button').filter({ hasText: /Return to Questions/ }).first();
        returnBtnOk = await returnBtn07.isVisible().catch(() => false);
        if (returnBtnOk) {
          await returnBtn07.click();
          await page.waitForTimeout(1000);
          await saveScreenshot(page, 's07_07_returned');
          console.log('"Return to Questions" clicked and returned');
        }
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    const s07Issues = [];
    if (!navH3) s07Issues.push('Navigator h3 heading missing');
    if (qBoxes < 15) s07Issues.push(`Only ${qBoxes} grid boxes (expected 15)`);
    if (!jumpedQ7 && q7Visible) s07Issues.push('Jump to Q7 failed');
    if (!legendOk07) s07Issues.push('Legend incomplete');
    if (!reviewBtnOk) s07Issues.push('"Go to Review Screen" missing');
    if (reviewBtnOk && !reviewScreenLoads) s07Issues.push('Review screen not loading');
    if (reviewBtnOk && !returnBtnOk) s07Issues.push('"Return to Questions" missing');

    results['S-07'] = {
      status: s07Issues.length === 0 ? 'PASS' : (navH3 && (jumpedQ7 || !q7Visible) ? 'PARTIAL' : 'FAIL'),
      navH3, qBoxes, answeredBoxes: answeredBoxes07, flagBoxes: flagBoxes07, ringHighlight: ringHighlight07,
      legendOk: legendOk07, jumpedQ7, q7Visible, reviewBtnOk, reviewScreenLoads, returnBtnOk, issues: s07Issues
    };
    console.log('S-07:', results['S-07'].status, s07Issues.length ? s07Issues : 'CLEAN');

    if (!navH3) findings.high.push({ id: 'FINDING-B1-011', scenario: 'S-07', title: 'Navigator modal h3 heading missing', criteriaRef: '7.4' });
    if (!reviewBtnOk) findings.medium.push({ id: 'FINDING-B1-M03', scenario: 'S-07', title: '"Go to Review Screen" missing from navigator', criteriaRef: '7.4' });
  }

  // =====================================================
  // SAVE RESULTS
  // =====================================================
  const summary = {
    results, findings, consoleErrors, accountType, runAt: new Date().toISOString()
  };

  try {
    const existing = JSON.parse(fs.readFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b1_final_results.json', 'utf8'));
    existing.results = { ...existing.results, ...results };
    existing.findings = findings;
    existing.consoleErrors = consoleErrors;
    existing.accountType = accountType;
    existing.runAt = summary.runAt;
    fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b1_final_results.json', JSON.stringify(existing, null, 2));
  } catch (e) {
    fs.writeFileSync('C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b1_final_results.json', JSON.stringify(summary, null, 2));
  }

  console.log('\n=== B1 FINAL RESULTS ===');
  for (const [k, v] of Object.entries(results)) {
    console.log(`${k}: ${v.status}${v.issues?.length ? ' - ISSUES: ' + v.issues.join(' | ') : ''}`);
  }
  console.log('Blockers:', findings.blocker.length);
  console.log('High:', findings.high.length);
  console.log('Medium:', findings.medium.length);
  console.log('Console Errors:', consoleErrors.length);
});
