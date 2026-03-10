/**
 * B1 Re-Run Audit — S-01 through S-07
 * Uses teacher account (student account may not exist in Firebase Auth)
 * Tests the full student core flow after DuplicateTabModal fix
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const STUDENT_EMAIL = 'student@apboost.test';
const STUDENT_PASSWORD = 'Student123!';
const TEACHER_EMAIL = 'teacher@apboost.test';
const TEACHER_PASSWORD = 'Teacher123!';
const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_b1_rerun';
const MICRO_TEST_ID = 'test_micro_full_1';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function saveScreenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
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

test('B1-RERUN: Student Core Flow S01-S07', async ({ page }) => {
  test.setTimeout(600000);

  const results = {};
  const findings = { blocker: [], high: [], medium: [], nitpick: [] };
  const consoleErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ url: page.url(), msg: msg.text() });
      console.log('[CONSOLE_ERROR]', msg.text().substring(0, 150));
    }
  });

  // Try student login first, fall back to teacher
  let accountType = 'student';
  try {
    await loginAs(page, STUDENT_EMAIL, STUDENT_PASSWORD);
    await saveScreenshot(page, '00_student_login');
    console.log('[LOGIN] Student login succeeded');
  } catch (err) {
    console.log('[LOGIN] Student login failed:', err.message, '- falling back to teacher');
    accountType = 'teacher';
    await loginAs(page, TEACHER_EMAIL, TEACHER_PASSWORD);
    await saveScreenshot(page, '00_teacher_login');
  }

  // =====================================================
  // S-01: Dashboard Initial Load
  // =====================================================
  console.log('\n=== S-01: Dashboard ===');
  await page.goto('http://localhost:5173/ap');
  await page.waitForTimeout(4000);
  await saveScreenshot(page, 's01_01_dashboard');

  const h1Text = await page.locator('h1').first().textContent().catch(() => '');
  console.log('H1:', h1Text.trim());

  // Count test cards
  const cardTitles = await page.locator('h3').allTextContents();
  console.log('H3 elements:', cardTitles);

  // Check for AP test cards specifically
  const microCard = await page.locator('h3, h2').filter({ hasText: /Microeconomics/ }).count();
  const macroCard = await page.locator('h3, h2').filter({ hasText: /Macroeconomics/ }).count();
  const calcCard = await page.locator('h3, h2').filter({ hasText: /Calculus/ }).count();
  console.log('Cards: Micro:', microCard, '| Macro:', macroCard, '| Calc:', calcCard);

  // Count status badges
  const statusBadges = await page.locator('span').filter({ hasText: /Not Started|In Progress|Completed/ }).count();
  console.log('Status badges:', statusBadges);

  // Check section text
  const sectionText = await page.locator('text=/\\d+ sections?/').count();
  const timeText = await page.locator('text=/\\d+ min/').count();
  console.log('Section count text:', sectionText, '| Time text:', timeText);

  // Error banner?
  const errorBanner = await page.locator('[class*="bg-error"]').count();
  console.log('Error banners:', errorBanner);

  // AP header
  const apHeader = await page.locator('a[href="/ap"]').count();
  console.log('AP header link:', apHeader);

  await saveScreenshot(page, 's01_02_dashboard_final');

  const s01Issues = [];
  if (!h1Text.includes('AP Practice Tests')) s01Issues.push(`H1 wrong: "${h1Text.trim()}"`);
  if (microCard === 0) s01Issues.push('Micro card missing');
  if (macroCard === 0) s01Issues.push('Macro card missing');
  if (calcCard === 0) s01Issues.push('Calc card missing');
  if (statusBadges < 3) s01Issues.push(`Only ${statusBadges} status badges`);
  if (sectionText < 1) s01Issues.push('Section count text missing');
  if (errorBanner > 0) s01Issues.push('Error banner shown');

  results['S-01'] = {
    status: s01Issues.length === 0 ? 'PASS' : (microCard > 0 && macroCard > 0 && calcCard > 0 ? 'PARTIAL' : 'FAIL'),
    accountType, h1: h1Text.trim(), microCard, macroCard, calcCard, statusBadges, sectionText, timeText, errorBanner,
    issues: s01Issues
  };
  console.log('S-01:', results['S-01'].status, s01Issues);

  // =====================================================
  // S-02: Instruction Screen
  // =====================================================
  console.log('\n=== S-02: Instruction Screen ===');

  // Click on Micro test card
  const microLink = page.locator('a, button').filter({ hasText: /Microeconomics/ }).first();
  const microVisible = await microLink.isVisible().catch(() => false);
  console.log('Micro card link visible:', microVisible);

  if (microVisible) {
    await microLink.click();
  } else {
    // Direct navigate
    await page.goto(`http://localhost:5173/ap/test/${MICRO_TEST_ID}`);
  }
  await page.waitForTimeout(4000);
  await saveScreenshot(page, 's02_01_instruction');
  console.log('URL after clicking test:', page.url());

  // Check for instruction screen
  const instrH1 = await page.locator('h1').filter({ hasText: /AP.*Exam|Practice/ }).first().textContent().catch(() => '');
  const beginBtn = await page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first().isVisible().catch(() => false);
  const cancelBtn = await page.locator('button').filter({ hasText: /Cancel/ }).first().isVisible().catch(() => false);
  console.log('Instruction H1:', instrH1.trim(), '| Begin:', beginBtn, '| Cancel:', cancelBtn);

  // Check for elements
  const sectionBreakdown = await page.locator('text=/This test has \\d+ sections?/').count();
  const frqInfoBox = await page.locator('.bg-info, [class*="bg-info"]').count();
  const warningBox = await page.locator('.bg-warning, [class*="bg-warning"]').count();
  const freeResponseH3 = await page.locator('h3').filter({ hasText: /Free Response Section/ }).count();
  const totalTimeText = await page.locator('text=/Total time:/').count();
  console.log('Section breakdown:', sectionBreakdown, '| FRQ info:', frqInfoBox, '| Warning:', warningBox);
  console.log('Free Response h3:', freeResponseH3, '| Total time:', totalTimeText);

  // Check warning bullet text
  const cannotPause = await page.locator('text=/Once you begin.*cannot pause|cannot pause the timer/i').count();
  const cannotReturn = await page.locator('text=/You cannot return to previous sections/i').count();
  console.log('Warning bullets: cannot-pause:', cannotPause, '| cannot-return:', cannotReturn);

  await saveScreenshot(page, 's02_02_instruction_detail');

  // Test Cancel button
  if (cancelBtn) {
    await page.locator('button').filter({ hasText: /Cancel/ }).first().click();
    await page.waitForTimeout(2000);
    const afterCancelUrl = page.url();
    console.log('After Cancel URL:', afterCancelUrl);
    await saveScreenshot(page, 's02_03_after_cancel');

    const cancelGoesToDash = afterCancelUrl.includes('/ap') && !afterCancelUrl.includes('/test/');
    console.log('Cancel -> dashboard:', cancelGoesToDash);

    // Go back to test for Begin Test verification
    await page.goto(`http://localhost:5173/ap/test/${MICRO_TEST_ID}`);
    await page.waitForTimeout(3000);
    const beginBtnText = await page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first().textContent().catch(() => '');
    console.log('Begin/Resume text:', beginBtnText.trim());
    await saveScreenshot(page, 's02_04_begin_text');
  }

  const s02Issues = [];
  if (!instrH1.includes('Microeconomics')) s02Issues.push(`H1 wrong: "${instrH1.trim()}"`);
  if (!beginBtn) s02Issues.push('Begin Test button missing');
  if (!cancelBtn) s02Issues.push('Cancel button missing');
  if (sectionBreakdown === 0) s02Issues.push('Section breakdown text missing');
  if (frqInfoBox === 0) s02Issues.push('FRQ info box (bg-info) missing');
  if (freeResponseH3 === 0) s02Issues.push('Free Response h3 heading missing (was fixed from p to h3)');
  if (warningBox === 0) s02Issues.push('Warning box missing');
  if (cannotPause === 0) s02Issues.push('Warning "cannot pause" text missing');
  if (cannotReturn === 0) s02Issues.push('Warning "cannot return" text missing');

  results['S-02'] = {
    status: s02Issues.length === 0 ? 'PASS' : (beginBtn ? 'PARTIAL' : 'FAIL'),
    instrH1: instrH1.trim(), beginBtn, cancelBtn, sectionBreakdown, frqInfoBox,
    freeResponseH3, warningBox, cannotPause, cannotReturn,
    issues: s02Issues
  };
  console.log('S-02:', results['S-02'].status, s02Issues);

  // =====================================================
  // S-03: Begin Test
  // =====================================================
  console.log('\n=== S-03: Begin Test ===');

  // Ensure we are on the instruction screen
  const currentUrl03 = page.url();
  if (!currentUrl03.includes('/test/')) {
    await page.goto(`http://localhost:5173/ap/test/${MICRO_TEST_ID}`);
    await page.waitForTimeout(3000);
  }

  // Check for DuplicateTabModal (from a prior session)
  const dupModal = await page.locator('button').filter({ hasText: /Use This Tab/ }).first().isVisible().catch(() => false);
  console.log('DuplicateTabModal visible:', dupModal);

  if (dupModal) {
    console.log('[S-03] Handling DuplicateTabModal...');
    await page.locator('button').filter({ hasText: /Use This Tab/ }).first().click();
    await page.waitForTimeout(2000);
    await saveScreenshot(page, 's03_after_use_this_tab');
    // Check if modal is gone
    const dupModalStillVisible = await page.locator('button').filter({ hasText: /Use This Tab/ }).first().isVisible().catch(() => false);
    console.log('Dup modal still visible after Use This Tab:', dupModalStillVisible);
    if (dupModalStillVisible) {
      findings.blocker.push({ id: 'FINDING-B1-001', scenario: 'S-03', title: 'DuplicateTabModal persists after clicking "Use This Tab"', criteriaRef: '1.1' });
    }
  }

  // Now check: are we on instruction screen or test interface?
  await page.waitForTimeout(2000);
  const beginBtn03 = await page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first().isVisible().catch(() => false);
  const timerEl03 = await page.locator('[class*="font-mono"]').first().isVisible().catch(() => false);
  const q1Label03 = await page.locator('text=/Question 1/').count();
  console.log('Begin btn:', beginBtn03, '| Timer:', timerEl03, '| Q1 label:', q1Label03);

  if (beginBtn03) {
    console.log('[S-03] On instruction screen - clicking Begin Test');
    await page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first().click();
    await page.waitForTimeout(4000);
    await saveScreenshot(page, 's03_01_after_begin');
  } else if (timerEl03 || q1Label03 > 0) {
    console.log('[S-03] Already in test interface (resume or existing session)');
    await saveScreenshot(page, 's03_01_in_test');
  } else {
    console.log('[S-03] Neither instruction screen nor test interface found');
    await saveScreenshot(page, 's03_01_unknown_state');
  }

  // Verify test interface elements
  const hamburger03 = await page.locator('[aria-label="Open menu"]').first().isVisible().catch(() => false);
  const sectionLabel03 = await page.locator('text=/Section \\d+ of \\d+/').first().textContent().catch(() => '');
  console.log('Hamburger:', hamburger03, '| Section:', sectionLabel03.trim());

  // Timer count-down
  const timerEl = page.locator('[class*="font-mono"]').first();
  const timerText1 = await timerEl.textContent().catch(() => '');
  await page.waitForTimeout(3000);
  const timerText2 = await timerEl.textContent().catch(() => '');
  const timerCountDown = timerText1 !== '' && timerText2 !== '' && timerText1 !== timerText2;
  console.log('Timer:', timerText1, '->', timerText2, '| Counting down:', timerCountDown);

  await saveScreenshot(page, 's03_02_timer_verify');

  // Question 1 elements
  const q1LabelVisible = await page.locator('text=/Question 1/').count();
  const allChoices = await page.locator('button.flex-1').count();
  const enabledChoices = await page.locator('button.flex-1:not([disabled])').count();
  const strikeBtns = await page.locator('button[title="Strike through"], button[title="Remove strikethrough"]').count();
  const backBtn = page.locator('button').filter({ hasText: '← Back' }).first();
  const nextBtn = page.locator('button').filter({ hasText: 'Next →' }).first();
  const backVisible = await backBtn.isVisible().catch(() => false);
  const backDisabled = backVisible ? await backBtn.isDisabled().catch(() => false) : null;
  const nextVisible = await nextBtn.isVisible().catch(() => false);
  const centerNavBtn = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
  const centerNavText = await centerNavBtn.textContent().catch(() => '');
  const centerNavVisible = await centerNavBtn.isVisible().catch(() => false);
  const flagBtn = page.locator('button').filter({ hasText: /Flag for Review/ }).first();
  const flagVisible = await flagBtn.isVisible().catch(() => false);

  console.log('Q1 labels:', q1LabelVisible, '| Choices(all/enabled):', allChoices, enabledChoices);
  console.log('Strikethrough btns:', strikeBtns);
  console.log('Back:', backVisible, 'disabled:', backDisabled, '| Next:', nextVisible);
  console.log('Center nav:', centerNavText.trim(), 'visible:', centerNavVisible);
  console.log('Flag:', flagVisible);

  await saveScreenshot(page, 's03_03_full_interface');

  const s03Issues = [];
  if (!timerCountDown) s03Issues.push(`Timer not counting down: "${timerText1}" -> "${timerText2}"`);
  if (q1LabelVisible === 0) s03Issues.push('Q1 label missing');
  if (enabledChoices < 4) s03Issues.push(`Only ${enabledChoices} enabled choices`);
  if (strikeBtns < 4) s03Issues.push(`Only ${strikeBtns} strikethrough buttons`);
  if (!nextVisible) s03Issues.push('Next button missing');
  if (!flagVisible) s03Issues.push('Flag for Review missing');
  if (!centerNavVisible) s03Issues.push('Center nav button missing');
  if (backVisible && backDisabled === false) s03Issues.push('Back not disabled on Q1');

  results['S-03'] = {
    status: s03Issues.length === 0 ? 'PASS' : (enabledChoices >= 4 && timerCountDown ? 'PARTIAL' : 'FAIL'),
    dupModal, timerCountDown, timer: `${timerText1}->${timerText2}`,
    q1LabelVisible, allChoices, enabledChoices, strikeBtns,
    backVisible, backDisabled, nextVisible,
    centerNavText: centerNavText.trim(), centerNavVisible, flagVisible,
    issues: s03Issues
  };
  console.log('S-03:', results['S-03'].status, s03Issues);

  if (!timerCountDown) {
    findings.blocker.push({ id: 'FINDING-B1-002', scenario: 'S-03', title: `Timer not counting down: "${timerText1}" -> "${timerText2}"`, criteriaRef: '1.1' });
  }
  if (enabledChoices < 4) {
    findings.high.push({ id: 'FINDING-B1-003', scenario: 'S-03', title: `Only ${enabledChoices} enabled MCQ choice buttons`, criteriaRef: '2.1' });
  }

  // =====================================================
  // S-04: MCQ Answer Selection
  // =====================================================
  console.log('\n=== S-04: MCQ Answer Selection ===');

  if (enabledChoices < 2) {
    results['S-04'] = { status: 'FAIL', notes: 'Not enough enabled choices to test' };
    findings.high.push({ id: 'FINDING-B1-004', scenario: 'S-04', title: 'MCQ answer selection cannot be tested - fewer than 2 enabled choices', criteriaRef: '2.1' });
  } else {
    // Current state: on Q1, no answer selected
    const q1Choices = await page.locator('button.flex-1:not([disabled])').all();

    // Check all unselected
    const initialSelected = [];
    for (const btn of q1Choices) {
      const cls = await btn.getAttribute('class').catch(() => '');
      initialSelected.push(cls.includes('bg-brand-primary'));
    }
    console.log('Initial selected states:', initialSelected);

    // Click B (index 1)
    if (q1Choices.length > 1) {
      await q1Choices[1].click();
      await page.waitForTimeout(800);
    }
    await saveScreenshot(page, 's04_01_b_selected');

    const bClass = await (await page.locator('button.flex-1:not([disabled])').all())[1]?.getAttribute('class').catch(() => '');
    const bSelected = bClass?.includes('bg-brand-primary') || false;
    const aClass = await (await page.locator('button.flex-1:not([disabled])').all())[0]?.getAttribute('class').catch(() => '');
    const aNotSelected = !aClass?.includes('bg-brand-primary');
    console.log('B selected:', bSelected, '| A not selected:', aNotSelected);

    if (!bSelected) {
      findings.high.push({ id: 'FINDING-B1-005', scenario: 'S-04', title: 'Clicking MCQ choice does not apply bg-brand-primary selection', criteriaRef: '2.1' });
    }

    // Navigate to Q2
    const nextBtnQ1 = page.locator('button').filter({ hasText: 'Next →' }).first();
    await nextBtnQ1.click();
    await page.waitForTimeout(1200);
    await saveScreenshot(page, 's04_02_q2');
    const q2Counter = await page.locator('button').filter({ hasText: /Question 2 of/ }).first().textContent().catch(() => '');
    console.log('Q2 counter:', q2Counter.trim());

    // Select A on Q2
    const q2Choices = await page.locator('button.flex-1:not([disabled])').all();
    let q2ASelected = false;
    if (q2Choices.length > 0) {
      await q2Choices[0].click();
      await page.waitForTimeout(600);
      const cls = await q2Choices[0].getAttribute('class').catch(() => '');
      q2ASelected = cls.includes('bg-brand-primary');
      console.log('Q2 A selected:', q2ASelected);
    }
    await saveScreenshot(page, 's04_03_q2_a_selected');

    // Back to Q1 - verify B persists
    const backBtnQ2 = page.locator('button').filter({ hasText: '← Back' }).first();
    await backBtnQ2.click();
    await page.waitForTimeout(1200);
    await saveScreenshot(page, 's04_04_q1_back');

    const q1After = await page.locator('button.flex-1:not([disabled])').all();
    let bPersists = false;
    if (q1After.length > 1) {
      const cls = await q1After[1].getAttribute('class').catch(() => '');
      bPersists = cls.includes('bg-brand-primary');
      console.log('B persists after back nav:', bPersists);
    }
    if (!bPersists) {
      findings.high.push({ id: 'FINDING-B1-006', scenario: 'S-04', title: 'MCQ answer lost when navigating back', criteriaRef: '1.7' });
    }

    // Change to C - verify deselection
    let cSelected = false, bDeselected = false;
    const q1ForChange = await page.locator('button.flex-1:not([disabled])').all();
    if (q1ForChange.length > 2) {
      await q1ForChange[2].click();
      await page.waitForTimeout(600);
      const cCls = await q1ForChange[2].getAttribute('class').catch(() => '');
      const bCls2 = await q1ForChange[1].getAttribute('class').catch(() => '');
      cSelected = cCls.includes('bg-brand-primary');
      bDeselected = !bCls2.includes('bg-brand-primary');
      console.log('C selected:', cSelected, '| B deselected:', bDeselected);
    }
    await saveScreenshot(page, 's04_05_c_selected');

    if (!bDeselected) {
      findings.high.push({ id: 'FINDING-B1-007', scenario: 'S-04', title: 'MCQ allows multiple simultaneous selections', criteriaRef: '2.1' });
    }

    // Navigate to Q2 - verify A persists
    const nextBtn04b = page.locator('button').filter({ hasText: 'Next →' }).first();
    await nextBtn04b.click();
    await page.waitForTimeout(1200);
    const q2bChoices = await page.locator('button.flex-1:not([disabled])').all();
    let q2APersists = false;
    if (q2bChoices.length > 0) {
      const cls = await q2bChoices[0].getAttribute('class').catch(() => '');
      q2APersists = cls.includes('bg-brand-primary');
      console.log('Q2 A persists:', q2APersists);
    }
    await saveScreenshot(page, 's04_06_q2_persist');

    const s04Issues = [];
    if (!bSelected) s04Issues.push('B click did not select');
    if (!bPersists) s04Issues.push('B lost on back nav');
    if (!cSelected) s04Issues.push('C not selectable');
    if (!bDeselected) s04Issues.push('B not deselected when C clicked');
    if (!q2APersists) s04Issues.push('Q2 A lost on forward nav');

    results['S-04'] = {
      status: s04Issues.length === 0 ? 'PASS' : 'PARTIAL',
      bSelected, aNotSelected, q2ASelected, bPersists, cSelected, bDeselected, q2APersists,
      issues: s04Issues
    };
    console.log('S-04:', results['S-04'].status, s04Issues);
  }

  // =====================================================
  // S-05: Question Flagging
  // =====================================================
  console.log('\n=== S-05: Question Flagging ===');

  // Navigate back to Q1
  const backToQ1 = page.locator('button').filter({ hasText: '← Back' }).first();
  if (await backToQ1.isVisible().catch(() => false) && !await backToQ1.isDisabled().catch(() => false)) {
    await backToQ1.click();
    await page.waitForTimeout(800);
  }

  const currentQ05 = await page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first().textContent().catch(() => '');
  console.log('Current Q:', currentQ05.trim());

  const flagBtn05 = page.locator('button').filter({ hasText: /Flag for Review/ }).first();
  const flagVisible05 = await flagBtn05.isVisible().catch(() => false);
  console.log('Flag for Review visible:', flagVisible05);

  if (!flagVisible05) {
    results['S-05'] = { status: 'FAIL', notes: 'Flag button not found' };
    findings.high.push({ id: 'FINDING-B1-008', scenario: 'S-05', title: '"Flag for Review" button not found on Q1', criteriaRef: '1.2' });
  } else {
    await saveScreenshot(page, 's05_01_before_flag');
    const unflagClass = await flagBtn05.getAttribute('class').catch(() => '');
    console.log('Unflagged class:', unflagClass.substring(0, 120));

    // Flag Q1
    await flagBtn05.click();
    await page.waitForTimeout(600);
    await saveScreenshot(page, 's05_02_flagged');

    const flaggedBtn = page.locator('button').filter({ hasText: 'Flagged' }).first();
    const flaggedVisible = await flaggedBtn.isVisible().catch(() => false);
    const flaggedClass = await flaggedBtn.getAttribute('class').catch(() => '');
    const hasBgWarning = flaggedClass.includes('bg-warning');
    console.log('Flagged state visible:', flaggedVisible, '| bg-warning:', hasBgWarning);

    if (!flaggedVisible) {
      findings.high.push({ id: 'FINDING-B1-009', scenario: 'S-05', title: 'Flag button does not change to "Flagged" state after click', criteriaRef: '1.2' });
    }
    if (!hasBgWarning) {
      findings.medium.push({ id: 'FINDING-B1-M01', scenario: 'S-05', title: 'Flagged button missing bg-warning class', criteriaRef: '1.2' });
    }

    // Navigate to Q2 and flag it
    const nextBtn05 = page.locator('button').filter({ hasText: 'Next →' }).first();
    await nextBtn05.click();
    await page.waitForTimeout(800);

    const q2Flag = page.locator('button').filter({ hasText: /Flag for Review/ }).first();
    if (await q2Flag.isVisible().catch(() => false)) {
      await q2Flag.click();
      await page.waitForTimeout(600);
    }
    await saveScreenshot(page, 's05_03_q2_flagged');

    // Open Question Navigator
    const centerBtn05 = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
    const centerVisible05 = await centerBtn05.isVisible().catch(() => false);
    let navOpens05 = false, flagsInNav05 = 0, legendOk05 = false;

    if (centerVisible05) {
      await centerBtn05.click();
      await page.waitForTimeout(1200);
      await saveScreenshot(page, 's05_04_navigator');

      navOpens05 = await page.locator('h3').filter({ hasText: 'Question Navigator' }).first().isVisible().catch(() => false);
      console.log('Navigator heading:', navOpens05);

      if (navOpens05) {
        flagsInNav05 = await page.locator('button').filter({ hasText: '🚩' }).count();
        const answeredLegend = await page.locator('span, div').filter({ hasText: 'Answered' }).count();
        const flaggedLegend = await page.locator('span, div').filter({ hasText: 'Flagged' }).count();
        const unansweredLegend = await page.locator('span, div').filter({ hasText: 'Unanswered' }).count();
        legendOk05 = answeredLegend > 0 && flaggedLegend > 0 && unansweredLegend > 0;
        console.log('Flag emojis in nav:', flagsInNav05, '| Legend (A/F/U):', answeredLegend, flaggedLegend, unansweredLegend);
        await saveScreenshot(page, 's05_05_nav_flags');
      }

      if (!navOpens05) {
        findings.high.push({ id: 'FINDING-B1-010', scenario: 'S-05', title: 'Question Navigator modal does not open', criteriaRef: '7.4' });
      }
      if (flagsInNav05 < 2) {
        findings.high.push({ id: 'FINDING-B1-011', scenario: 'S-05', title: `Navigator shows only ${flagsInNav05} flag emoji(s), expected 2`, criteriaRef: '1.2' });
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }

    // Back to Q1 and unflag
    const back05 = page.locator('button').filter({ hasText: '← Back' }).first();
    if (await back05.isVisible().catch(() => false) && !await back05.isDisabled().catch(() => false)) {
      await back05.click();
      await page.waitForTimeout(600);
    }

    let unflagWorks = false;
    const q1FlaggedState = page.locator('button').filter({ hasText: 'Flagged' }).first();
    if (await q1FlaggedState.isVisible().catch(() => false)) {
      await q1FlaggedState.click();
      await page.waitForTimeout(600);
      const afterText = await page.locator('button').filter({ hasText: /Flag for Review|Flagged/ }).first().textContent().catch(() => '');
      unflagWorks = afterText.trim().includes('Flag for Review');
      console.log('After unflag:', afterText.trim(), '| Reverts:', unflagWorks);
    }
    await saveScreenshot(page, 's05_06_unflagged');

    const s05Issues = [];
    if (!flaggedVisible) s05Issues.push('Flag not toggling to "Flagged"');
    if (!hasBgWarning) s05Issues.push('Missing bg-warning on flagged state');
    if (!navOpens05) s05Issues.push('Navigator not opening');
    if (flagsInNav05 < 2) s05Issues.push(`Only ${flagsInNav05} flag in navigator (expected 2)`);
    if (!legendOk05) s05Issues.push('Legend incomplete');
    if (!unflagWorks) s05Issues.push('Unflag does not revert');

    results['S-05'] = {
      status: s05Issues.length === 0 ? 'PASS' : (flaggedVisible && hasBgWarning ? 'PARTIAL' : 'FAIL'),
      flaggedVisible, hasBgWarning, navOpens: navOpens05, flagsInNav: flagsInNav05,
      legendOk: legendOk05, unflagWorks, issues: s05Issues
    };
    console.log('S-05:', results['S-05'].status, s05Issues);
  }

  // =====================================================
  // S-06: Strikethrough
  // =====================================================
  console.log('\n=== S-06: Strikethrough ===');

  // Navigate to Q3 (currently on Q1)
  const nextBtn06a = page.locator('button').filter({ hasText: 'Next →' }).first();
  if (await nextBtn06a.isVisible().catch(() => false)) {
    await nextBtn06a.click(); await page.waitForTimeout(500);
    await nextBtn06a.click(); await page.waitForTimeout(500);
  }

  const q3Counter = await page.locator('button').filter({ hasText: /Question 3 of/ }).first().textContent().catch(() => '');
  console.log('Q3:', q3Counter.trim());
  await saveScreenshot(page, 's06_01_q3');

  const strikeBtns06 = await page.locator('button[title="Strike through"], button[title="Remove strikethrough"]').all();
  console.log('Strikethrough buttons on Q3:', strikeBtns06.length);

  if (strikeBtns06.length === 0) {
    results['S-06'] = { status: 'FAIL', notes: 'No strikethrough buttons found on Q3' };
    findings.high.push({ id: 'FINDING-B1-012', scenario: 'S-06', title: 'No strikethrough buttons found on Q3', criteriaRef: '1.4' });
  } else {
    // Click strike on A
    const strikeA = page.locator('button[title="Strike through"]').first();
    await strikeA.click();
    await page.waitForTimeout(500);
    await saveScreenshot(page, 's06_02_a_struck');

    const lineThroughCount = await page.locator('[class*="line-through"]').count();
    const opacityCount = await page.locator('button.flex-1[class*="opacity"]').count();
    const strikeApplied = lineThroughCount > 0 || opacityCount > 0;
    console.log('line-through:', lineThroughCount, '| opacity:', opacityCount, '| applied:', strikeApplied);

    // Verify "Remove strikethrough" button appears (active state)
    const removeBtnVisible = await page.locator('button[title="Remove strikethrough"]').first().isVisible().catch(() => false);
    const removeBtnClass = await page.locator('button[title="Remove strikethrough"]').first().getAttribute('class').catch(() => '');
    const hasBgMuted = removeBtnClass.includes('bg-muted');
    console.log('Remove btn:', removeBtnVisible, '| bg-muted:', hasBgMuted);

    // Strike D (index 2 of remaining "Strike through" buttons)
    const strikeBtnsAfterA = await page.locator('button[title="Strike through"]').all();
    let dStruck = false;
    if (strikeBtnsAfterA.length >= 3) {
      await strikeBtnsAfterA[2].click(); // D
      await page.waitForTimeout(500);
      const linesAfterD = await page.locator('[class*="line-through"]').count();
      dStruck = linesAfterD > lineThroughCount;
      console.log('D struck:', dStruck, '| lines now:', linesAfterD);
    } else if (strikeBtnsAfterA.length >= 1) {
      // Only click the first one
      await strikeBtnsAfterA[0].click();
      await page.waitForTimeout(500);
    }
    await saveScreenshot(page, 's06_03_multi_struck');

    // Select B as answer
    const choices06 = await page.locator('button.flex-1:not([disabled])').all();
    let bSelectedWithStrikes = false;
    if (choices06.length >= 2) {
      await choices06[1].click();
      await page.waitForTimeout(500);
      const bCls = await choices06[1].getAttribute('class').catch(() => '');
      bSelectedWithStrikes = bCls.includes('bg-brand-primary');
      console.log('B selected while A struck:', bSelectedWithStrikes);
    }
    await saveScreenshot(page, 's06_04_b_with_strikes');

    // Toggle off A
    const removeA = page.locator('button[title="Remove strikethrough"]').first();
    if (await removeA.isVisible().catch(() => false)) {
      await removeA.click();
      await page.waitForTimeout(500);
    }
    const linesAfterUnstrike = await page.locator('[class*="line-through"]').count();
    console.log('Lines after un-strike A:', linesAfterUnstrike);
    await saveScreenshot(page, 's06_05_a_unstruck');

    // Navigate to Q4 and back - test persistence
    const nextBtn06b = page.locator('button').filter({ hasText: 'Next →' }).first();
    await nextBtn06b.click(); await page.waitForTimeout(500);
    const backBtn06b = page.locator('button').filter({ hasText: '← Back' }).first();
    if (await backBtn06b.isVisible().catch(() => false)) {
      await backBtn06b.click(); await page.waitForTimeout(1000);
    }
    await saveScreenshot(page, 's06_06_persist');
    const persistedLines = await page.locator('[class*="line-through"]').count();
    console.log('Persisted line-through after nav:', persistedLines);

    const s06Issues = [];
    if (!strikeApplied) s06Issues.push('Strikethrough click has no visual effect');
    if (!hasBgMuted) s06Issues.push('Remove btn missing bg-muted active state');
    if (!bSelectedWithStrikes) s06Issues.push('B not selectable while strikes active');
    if (persistedLines === 0) s06Issues.push('Strikethrough not persisting through navigation');

    results['S-06'] = {
      status: s06Issues.length === 0 ? 'PASS' : (strikeApplied ? 'PARTIAL' : 'FAIL'),
      strikeBtnsFound: strikeBtns06.length, strikeApplied, hasBgMuted, dStruck,
      bSelectedWithStrikes, persistedAfterNav: persistedLines > 0, issues: s06Issues
    };
    console.log('S-06:', results['S-06'].status, s06Issues);

    if (!strikeApplied) {
      findings.high.push({ id: 'FINDING-B1-013', scenario: 'S-06', title: 'Strikethrough click has no visual effect', criteriaRef: '1.4' });
    }
  }

  // =====================================================
  // S-07: Question Navigator - Full Grid Navigation
  // =====================================================
  console.log('\n=== S-07: Question Navigator ===');

  // Ensure Q3 has an answer (B was selected above)
  await saveScreenshot(page, 's07_01_before_nav');

  const centerBtn07 = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
  const centerVisible07 = await centerBtn07.isVisible().catch(() => false);
  console.log('Center nav button:', centerVisible07);

  if (!centerVisible07) {
    results['S-07'] = { status: 'FAIL', notes: 'Center nav button not found' };
    findings.high.push({ id: 'FINDING-B1-014', scenario: 'S-07', title: 'Center "Question X of Y" nav button not visible', criteriaRef: '7.4' });
  } else {
    await centerBtn07.click();
    await page.waitForTimeout(1200);
    await saveScreenshot(page, 's07_02_nav_open');

    const navH3 = await page.locator('h3').filter({ hasText: 'Question Navigator' }).first().isVisible().catch(() => false);
    console.log('Nav H3:', navH3);

    // Count grid boxes - look for all variants
    const qBoxes = await page.locator('button.w-10, button.w-12').count();
    const answeredBoxes = await page.locator('button[class*="bg-brand-primary"]').filter({ hasText: /[0-9]|🚩/ }).count();
    const flagBoxes = await page.locator('button').filter({ hasText: '🚩' }).count();
    const ringHighlight = await page.locator('button[class*="ring-2"]').count();
    console.log('Grid boxes:', qBoxes, '| Answered:', answeredBoxes, '| Flags:', flagBoxes, '| Ring:', ringHighlight);

    // Legend
    const answeredLeg = await page.locator('span, div').filter({ hasText: /^Answered$/ }).count();
    const flaggedLeg = await page.locator('span, div').filter({ hasText: /^Flagged$/ }).count();
    const unanswLeg = await page.locator('span, div').filter({ hasText: /^Unanswered$/ }).count();
    const legendOk = answeredLeg > 0 && flaggedLeg > 0 && unanswLeg > 0;
    console.log('Legend (A/F/U):', answeredLeg, flaggedLeg, unanswLeg, '| ok:', legendOk);

    await saveScreenshot(page, 's07_03_nav_grid');

    if (!navH3) {
      findings.high.push({ id: 'FINDING-B1-015', scenario: 'S-07', title: 'Navigator modal missing "Question Navigator" h3 heading', criteriaRef: '7.4' });
    }

    // Click Q7 box
    let jumpedQ7 = false;
    const q7Box = page.locator('button.w-10, button.w-12').filter({ hasText: '7' }).first();
    const q7Visible = await q7Box.isVisible().catch(() => false);
    console.log('Q7 box visible:', q7Visible);

    if (q7Visible) {
      await q7Box.click();
      await page.waitForTimeout(1200);
      await saveScreenshot(page, 's07_04_jump_q7');
      const q7Counter = await page.locator('button').filter({ hasText: /Question 7 of/ }).first().textContent().catch(() => '');
      jumpedQ7 = q7Counter.includes('7');
      console.log('Jumped to Q7:', jumpedQ7, '| Counter:', q7Counter.trim());
    }

    if (!jumpedQ7) {
      findings.high.push({ id: 'FINDING-B1-016', scenario: 'S-07', title: 'Clicking Q7 in navigator did not navigate to Q7', criteriaRef: '7.4' });
    }

    // Re-open and test "Go to Review Screen"
    const center07b = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
    let reviewBtnOk = false;
    let reviewH2 = false;

    if (await center07b.isVisible().catch(() => false)) {
      await center07b.click();
      await page.waitForTimeout(1000);
      await saveScreenshot(page, 's07_05_nav_for_review');

      const goToReviewBtn = page.locator('button').filter({ hasText: 'Go to Review Screen' }).first();
      reviewBtnOk = await goToReviewBtn.isVisible().catch(() => false);
      console.log('"Go to Review Screen" button:', reviewBtnOk);

      if (!reviewBtnOk) {
        findings.medium.push({ id: 'FINDING-B1-M02', scenario: 'S-07', title: '"Go to Review Screen" button missing from Question Navigator', criteriaRef: '7.4' });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        await goToReviewBtn.click();
        await page.waitForTimeout(1200);
        await saveScreenshot(page, 's07_06_review_screen');

        reviewH2 = await page.locator('h2, h1').filter({ hasText: /Review Your Answers/ }).first().isVisible().catch(() => false);
        console.log('Review screen H1/H2:', reviewH2);

        // Return to questions
        const returnBtn = page.locator('button').filter({ hasText: /Return to Questions/ }).first();
        if (await returnBtn.isVisible().catch(() => false)) {
          await returnBtn.click();
          await page.waitForTimeout(1000);
          await saveScreenshot(page, 's07_07_returned_to_test');
        }
      }
    }

    const s07Issues = [];
    if (!navH3) s07Issues.push('Navigator H3 heading missing');
    if (qBoxes < 15) s07Issues.push(`Only ${qBoxes} grid boxes (expected 15+)`);
    if (!jumpedQ7) s07Issues.push('Jump to Q7 failed');
    if (!legendOk) s07Issues.push('Legend incomplete');
    if (!reviewBtnOk) s07Issues.push('"Go to Review Screen" missing');

    results['S-07'] = {
      status: s07Issues.length === 0 ? 'PASS' : (navH3 && jumpedQ7 ? 'PARTIAL' : 'FAIL'),
      navH3, qBoxes, answeredBoxes, flagBoxes, ringHighlight, legendOk,
      jumpedQ7, reviewBtnOk, reviewH2, issues: s07Issues
    };
    console.log('S-07:', results['S-07'].status, s07Issues);
  }

  // =====================================================
  // Save results
  // =====================================================
  const summary = { results, findings, consoleErrors, accountType };
  fs.writeFileSync(
    'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b1_rerun_results.json',
    JSON.stringify(summary, null, 2)
  );

  console.log('\n=== FINAL RESULTS ===');
  for (const [k, v] of Object.entries(results)) {
    console.log(`${k}: ${v.status}${v.issues?.length ? ' - ' + v.issues.join(', ') : ''}`);
  }
  console.log('Blockers:', findings.blocker.length);
  console.log('High:', findings.high.length);
  console.log('Medium:', findings.medium.length);
  console.log('Console Errors:', consoleErrors.length);
});
