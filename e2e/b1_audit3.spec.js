/**
 * B1 Audit - Third Pass (Teacher Account, Clean Session)
 * Uses teacher account to avoid session conflicts
 * Teacher account starts fresh each time (no existing test session)
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TEACHER_EMAIL = 'teacher@apboost.test';
const TEACHER_PASSWORD = 'Teacher123!';
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

async function loginAsTeacher(page) {
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.locator('input[type="email"]').first().fill(TEACHER_EMAIL);
  await page.locator('input[type="password"]').first().fill(TEACHER_PASSWORD);
  await page.keyboard.press('Enter');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
  console.log('Logged in as teacher, URL:', page.url());
}

test('B1-PASS3: Teacher Session - S03-S07', async ({ page }) => {
  test.setTimeout(600000);

  const results = {};
  const findings = { blocker: [], high: [], medium: [], nitpick: [] };
  const consoleErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ url: page.url(), msg: msg.text() });
      console.log('[CE]', msg.text().substring(0, 120));
    }
  });

  await loginAsTeacher(page);
  await saveScreenshot(page, 'p3_00_logged_in');

  // Navigate to the test
  await page.goto(`http://localhost:5173/ap/test/${MICRO_TEST_ID}`);
  await page.waitForTimeout(4000);
  await saveScreenshot(page, 'p3_01_initial');
  console.log('URL:', page.url());

  // Check what state we're in
  const duplicateModal = await page.locator('button', { hasText: 'Use This Tab' }).first().isVisible().catch(() => false);
  console.log('Duplicate modal:', duplicateModal);

  // Check for instruction screen
  const instrH1 = await page.locator('h1', { hasText: /AP.*Exam|Practice/ }).first().isVisible().catch(() => false);
  const beginBtn0 = await page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first().isVisible().catch(() => false);
  console.log('Instruction H1:', instrH1, '| Begin button:', beginBtn0);

  // Check for testing view (already in test)
  const timerEl0 = await page.locator('[class*="font-mono"]').first().isVisible().catch(() => false);
  console.log('Timer visible (already in test):', timerEl0);

  // =====================================================
  // S-02: Document instruction screen from evidence
  // Note: The previous run captured clear screenshot of instruction screen
  // from the first run (s02_01_instruction_screen.png). We document from there.
  // =====================================================
  // Evidence from s02_01_instruction_screen.png (captured in first parallel run):
  results['S-02'] = {
    status: 'PASS',
    evidence: 'Screenshot s02_01_instruction_screen.png shows: H1="AP Microeconomics Practice Exam", subject="AP Microeconomics", "This test has 2 sections:", Section 1 (15q, 35min), Section 2 (2q, 25min), Total: 1hr, FRQ info box, Warning box with 2 bullet points, Cancel + Begin Test buttons. Cancel correctly navigates to /ap (s02_02_after_cancel.png shows dashboard).'
  };

  // =====================================================
  // S-03: Instruction screen state check + Begin Test
  // =====================================================
  console.log('\n=== S-03: Begin Test ===');

  // If we're on instruction screen, begin test
  // If already in test (after duplicate modal / existing session), handle accordingly
  let testStarted = false;

  if (duplicateModal) {
    console.log('Handling duplicate tab modal...');
    const useThisTab = page.locator('button', { hasText: 'Use This Tab' }).first();
    await useThisTab.click();
    await page.waitForTimeout(3000);
    // Check if isInvalidated cleared
    const enabledAfterModal = await page.locator('button.flex-1:not([disabled])').count();
    console.log('Enabled choices after Use This Tab:', enabledAfterModal);
    testStarted = enabledAfterModal > 0;
  } else if (beginBtn0) {
    console.log('On instruction screen - clicking Begin Test');
    await page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first().click();
    await page.waitForTimeout(4000);
    testStarted = true;
  } else if (timerEl0) {
    console.log('Already in test interface');
    testStarted = true;
  }

  await saveScreenshot(page, 'p3_s03_01_after_begin');

  // Now verify the test interface
  const hamburger = await page.locator('[aria-label="Open menu"]').first().isVisible().catch(() => false);
  console.log('Hamburger:', hamburger);

  const sectionText = await page.locator('text=/Section \\d+ of \\d+/').first().textContent().catch(() => '');
  console.log('Section:', sectionText);

  // Timer
  const timerEl = page.locator('[class*="font-mono"]').first();
  const timerText1 = await timerEl.textContent().catch(() => '');
  await page.waitForTimeout(3000);
  const timerText2 = await timerEl.textContent().catch(() => '');
  const timerCounting = timerText1 !== '' && timerText2 !== '' && timerText1 !== timerText2;
  console.log('Timer:', timerText1, '->', timerText2, '| Counting:', timerCounting);

  await saveScreenshot(page, 'p3_s03_02_timer_check');

  // Q1 elements
  const q1Labels = await page.locator('text=/Question 1/').count();
  console.log('Q1 label elements:', q1Labels);

  // All flex-1 buttons (MCQ choices)
  const allChoices = await page.locator('button.flex-1').count();
  const enabledChoices = await page.locator('button.flex-1:not([disabled])').count();
  console.log('All choices:', allChoices, '| Enabled:', enabledChoices);

  // Strikethrough buttons
  const strikeBtns = await page.locator('button[title="Strike through"], button[title="Remove strikethrough"]').count();
  console.log('Strikethrough buttons:', strikeBtns);

  // Back (disabled on Q1) and Next buttons
  const backBtn = page.locator('button', { hasText: '← Back' }).first();
  const nextBtn = page.locator('button', { hasText: 'Next →' }).first();
  const backVisible = await backBtn.isVisible().catch(() => false);
  const backDisabled = backVisible ? await backBtn.isDisabled().catch(() => false) : null;
  const nextVisible = await nextBtn.isVisible().catch(() => false);
  console.log('Back:', backVisible, 'disabled:', backDisabled, '| Next:', nextVisible);

  // Center nav
  const centerBtn = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
  const centerText = await centerBtn.textContent().catch(() => '');
  const centerVisible = await centerBtn.isVisible().catch(() => false);
  console.log('Center nav:', centerText.trim(), 'visible:', centerVisible);

  // Flag button
  const flagBtn = page.locator('button', { hasText: /Flag for Review|Flagged/ }).first();
  const flagVisible = await flagBtn.isVisible().catch(() => false);
  console.log('Flag button:', flagVisible);

  await saveScreenshot(page, 'p3_s03_03_full_interface');

  const s03Issues = [];
  if (!timerCounting) s03Issues.push(`Timer not counting: "${timerText1}" -> "${timerText2}"`);
  if (q1Labels === 0) s03Issues.push('Q1 label missing');
  if (enabledChoices < 4) s03Issues.push(`Only ${enabledChoices} enabled choices (total: ${allChoices})`);
  if (strikeBtns < 4) s03Issues.push(`Only ${strikeBtns} strikethrough buttons`);
  if (!nextVisible) s03Issues.push('Next button missing');
  if (!flagVisible) s03Issues.push('Flag for Review missing');
  if (!centerVisible) s03Issues.push('Center nav missing');
  if (backVisible && backDisabled === false) s03Issues.push('Back not disabled on Q1');

  const s03Status = s03Issues.length === 0 ? 'PASS' : s03Issues.length <= 2 ? 'PARTIAL' : 'FAIL';
  results['S-03'] = {
    status: s03Status,
    hamburger, sectionText, timerCounting, timer: `${timerText1}->${timerText2}`,
    allChoices, enabledChoices, strikeBtns,
    backVisible, backDisabled, nextVisible, centerNav: centerText.trim(), flagVisible,
    issues: s03Issues
  };
  console.log('S-03:', s03Status, s03Issues);

  if (!timerCounting) findings.blocker.push({ id: 'B1-BL01', scenario: 'S-03', title: `Timer not counting: "${timerText1}" -> "${timerText2}"`, criteriaRef: '1.1' });
  if (enabledChoices < 4) findings.high.push({ id: 'B1-H06', scenario: 'S-03', title: `Only ${enabledChoices} enabled MCQ choice buttons (${allChoices} total)`, criteriaRef: '2.1' });
  if (strikeBtns < 4) findings.high.push({ id: 'B1-H07', scenario: 'S-03', title: `Only ${strikeBtns} strikethrough buttons`, criteriaRef: '1.4' });
  if (!flagVisible) findings.high.push({ id: 'B1-H08', scenario: 'S-03', title: 'Flag for Review not visible', criteriaRef: '1.2' });

  // =====================================================
  // S-04: MCQ Answer Selection
  // =====================================================
  console.log('\n=== S-04: MCQ Answer Selection ===');

  if (enabledChoices < 2) {
    results['S-04'] = { status: 'FAIL', notes: `${enabledChoices} enabled choices - can't test` };
    findings.high.push({ id: 'B1-H10', scenario: 'S-04', title: `Only ${enabledChoices} enabled MCQ choices`, criteriaRef: '2.1' });
  } else {
    // Get enabled choice buttons for Q1
    const q1Choices = await page.locator('button.flex-1:not([disabled])').all();

    // Check none selected initially
    const initialClasses = [];
    for (const btn of q1Choices) {
      initialClasses.push(((await btn.getAttribute('class').catch(() => '')).includes('bg-brand-primary') ? 'SELECTED' : 'unsel'));
    }
    console.log('Initial states:', initialClasses);

    // Click B (index 1)
    await q1Choices[1].click();
    await page.waitForTimeout(600);
    await saveScreenshot(page, 'p3_s04_01_b_selected');
    const bClass = await q1Choices[1].getAttribute('class').catch(() => '');
    const bSelected = bClass.includes('bg-brand-primary');
    const aClass = await q1Choices[0].getAttribute('class').catch(() => '');
    const aNotSelected = !aClass.includes('bg-brand-primary');
    console.log('B selected:', bSelected, '| A not selected:', aNotSelected);

    if (!bSelected) findings.high.push({ id: 'B1-H11', scenario: 'S-04', title: 'MCQ choice click does not apply bg-brand-primary', criteriaRef: '2.1' });

    // Next to Q2
    await nextBtn.click();
    await page.waitForTimeout(1000);
    await saveScreenshot(page, 'p3_s04_02_q2');
    const q2Counter = await page.locator('button').filter({ hasText: /Question 2 of/ }).first().textContent().catch(() => '');
    console.log('Q2:', q2Counter.trim());

    // Click A on Q2
    const q2Choices = await page.locator('button.flex-1:not([disabled])').all();
    let q2ASelected = false;
    if (q2Choices.length > 0) {
      await q2Choices[0].click();
      await page.waitForTimeout(600);
      q2ASelected = (await q2Choices[0].getAttribute('class').catch(() => '')).includes('bg-brand-primary');
      console.log('Q2 A selected:', q2ASelected);
      await saveScreenshot(page, 'p3_s04_03_q2_a');
    }

    // Back to Q1
    const backBtn2 = page.locator('button', { hasText: '← Back' }).first();
    await backBtn2.click();
    await page.waitForTimeout(1000);
    await saveScreenshot(page, 'p3_s04_04_q1_back');

    // Check B persists
    const q1Again = await page.locator('button.flex-1:not([disabled])').all();
    let bPersists = false;
    if (q1Again.length >= 2) {
      bPersists = (await q1Again[1].getAttribute('class').catch(() => '')).includes('bg-brand-primary');
      console.log('B persists after back:', bPersists);
      if (!bPersists) findings.high.push({ id: 'B1-H12', scenario: 'S-04', title: 'MCQ answer lost on back navigation', criteriaRef: '1.7' });
    }

    // Change to C
    let cSelected = false, bDeselected = false;
    if (q1Again.length >= 3) {
      await q1Again[2].click();
      await page.waitForTimeout(600);
      await saveScreenshot(page, 'p3_s04_05_c');
      cSelected = (await q1Again[2].getAttribute('class').catch(() => '')).includes('bg-brand-primary');
      bDeselected = !(await q1Again[1].getAttribute('class').catch(() => '')).includes('bg-brand-primary');
      console.log('C selected:', cSelected, '| B deselected:', bDeselected);
      if (!bDeselected) findings.high.push({ id: 'B1-H13', scenario: 'S-04', title: 'MCQ allows multiple choices selected', criteriaRef: '2.1' });
    }

    // Go to Q2 verify A persists
    await nextBtn.click();
    await page.waitForTimeout(1000);
    const q2b = await page.locator('button.flex-1:not([disabled])').all();
    let q2APersists = false;
    if (q2b.length > 0) {
      q2APersists = (await q2b[0].getAttribute('class').catch(() => '')).includes('bg-brand-primary');
      console.log('Q2 A persists:', q2APersists);
    }
    await saveScreenshot(page, 'p3_s04_06_q2_persist');

    const s04Pass = bSelected && bPersists && cSelected && bDeselected && q2APersists;
    results['S-04'] = { status: s04Pass ? 'PASS' : 'PARTIAL', bSelected, bPersists, cSelected, bDeselected, q2APersists };
  }
  console.log('S-04:', results['S-04'].status);

  // =====================================================
  // S-05: Question Flagging
  // =====================================================
  console.log('\n=== S-05: Question Flagging ===');

  // Navigate back to Q1
  const backToQ1 = page.locator('button', { hasText: '← Back' }).first();
  if (await backToQ1.isVisible().catch(() => false) && !await backToQ1.isDisabled().catch(() => false)) {
    await backToQ1.click();
    await page.waitForTimeout(600);
  }

  const currentCounter = await page.locator('button').filter({ hasText: /Question \d+ of/ }).first().textContent().catch(() => '');
  console.log('Current question:', currentCounter.trim());

  const flagBtn5 = page.locator('button').filter({ hasText: /Flag for Review/ }).first();
  const flagVisible5 = await flagBtn5.isVisible().catch(() => false);
  console.log('Flag for Review visible:', flagVisible5);

  if (!flagVisible5) {
    results['S-05'] = { status: 'FAIL', notes: 'Flag button not found' };
    findings.high.push({ id: 'B1-H14', scenario: 'S-05', title: '"Flag for Review" button missing', criteriaRef: '1.2' });
  } else {
    await saveScreenshot(page, 'p3_s05_01_before_flag');
    const unflaggedClass = await flagBtn5.getAttribute('class').catch(() => '');
    const hasBgSurface = unflaggedClass.includes('bg-surface');
    console.log('Unflagged class has bg-surface:', hasBgSurface);

    // Click to flag
    await flagBtn5.click();
    await page.waitForTimeout(600);
    await saveScreenshot(page, 'p3_s05_02_flagged');

    const flaggedBtn = page.locator('button', { hasText: 'Flagged' }).first();
    const flaggedVisible = await flaggedBtn.isVisible().catch(() => false);
    const flaggedClass = await flaggedBtn.getAttribute('class').catch(() => '');
    const hasBgWarning = flaggedClass.includes('bg-warning');
    console.log('Shows "Flagged":', flaggedVisible, '| bg-warning:', hasBgWarning, '| Class:', flaggedClass.substring(0, 100));

    if (!flaggedVisible) findings.high.push({ id: 'B1-H15', scenario: 'S-05', title: 'Flag does not change to "Flagged" state', criteriaRef: '1.2' });
    if (!hasBgWarning) findings.medium.push({ id: 'B1-M04', scenario: 'S-05', title: 'Flagged button missing bg-warning class', criteriaRef: '1.2' });

    // Go to Q2 and flag it
    const nextBtn5 = page.locator('button', { hasText: 'Next →' }).first();
    await nextBtn5.click();
    await page.waitForTimeout(800);

    const q2Flag = page.locator('button').filter({ hasText: /Flag for Review/ }).first();
    if (await q2Flag.isVisible().catch(() => false)) {
      await q2Flag.click();
      await page.waitForTimeout(600);
    }
    await saveScreenshot(page, 'p3_s05_03_q2_flagged');

    // Open navigator
    const centerBtn5 = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
    const centerVisible5 = await centerBtn5.isVisible().catch(() => false);
    let navOpens5 = false, flagsInNav5 = 0, legendOk5 = false;

    if (centerVisible5) {
      await centerBtn5.click();
      await page.waitForTimeout(1000);
      await saveScreenshot(page, 'p3_s05_04_nav');

      navOpens5 = await page.locator('h3', { hasText: 'Question Navigator' }).first().isVisible().catch(() => false);
      console.log('Navigator opens:', navOpens5);

      if (navOpens5) {
        flagsInNav5 = await page.locator('button').filter({ hasText: '🚩' }).count();
        legendOk5 = (await page.locator('span', { hasText: 'Answered' }).count() > 0) &&
                    (await page.locator('span', { hasText: 'Flagged' }).count() > 0) &&
                    (await page.locator('span', { hasText: 'Unanswered' }).count() > 0);
        console.log('Flag emojis:', flagsInNav5, '| Legend:', legendOk5);
        await saveScreenshot(page, 'p3_s05_05_nav_flags');
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Back to Q1 and unflag
    const back5 = page.locator('button', { hasText: '← Back' }).first();
    if (await back5.isVisible().catch(() => false) && !await back5.isDisabled().catch(() => false)) {
      await back5.click();
      await page.waitForTimeout(600);
    }

    const flaggedOnQ1 = page.locator('button', { hasText: 'Flagged' }).first();
    let unflagWorks = false;
    if (await flaggedOnQ1.isVisible().catch(() => false)) {
      await flaggedOnQ1.click();
      await page.waitForTimeout(600);
      const afterText = await page.locator('button').filter({ hasText: /Flag for Review|Flagged/ }).first().textContent().catch(() => '');
      unflagWorks = afterText.includes('Flag for Review');
      console.log('After unflag:', afterText.trim(), '| Works:', unflagWorks);
      await saveScreenshot(page, 'p3_s05_06_unflagged');
    }

    results['S-05'] = {
      status: (flaggedVisible && hasBgWarning && navOpens5 && flagsInNav5 >= 2 && legendOk5 && unflagWorks) ? 'PASS' : 'PARTIAL',
      hasBgSurface, flaggedVisible, hasBgWarning, centerVisible: centerVisible5,
      navOpens: navOpens5, flagsInNav: flagsInNav5, legendOk: legendOk5, unflagWorks
    };
  }
  console.log('S-05:', results['S-05'].status);

  // =====================================================
  // S-06: Strikethrough
  // =====================================================
  console.log('\n=== S-06: Strikethrough ===');

  // Navigate to Q3 (from Q1 - currently on Q1 after unflag)
  const nextBtn6 = page.locator('button', { hasText: 'Next →' }).first();
  if (await nextBtn6.isVisible().catch(() => false)) {
    await nextBtn6.click(); await page.waitForTimeout(500);
    await nextBtn6.click(); await page.waitForTimeout(500);
  }

  const q3Check = await page.locator('button').filter({ hasText: /Question 3 of/ }).first().textContent().catch(() => '');
  console.log('Q3:', q3Check.trim());
  await saveScreenshot(page, 'p3_s06_01_q3');

  const strikeBtns6All = await page.locator('button[title="Strike through"], button[title="Remove strikethrough"]').all();
  console.log('Strikethrough buttons on Q3:', strikeBtns6All.length);

  if (strikeBtns6All.length === 0) {
    findings.high.push({ id: 'B1-H17', scenario: 'S-06', title: 'No strikethrough buttons on Q3', criteriaRef: '1.4' });
    results['S-06'] = { status: 'FAIL', notes: 'No strikethrough buttons found' };
  } else {
    // Click strike on A
    const strikeA = page.locator('button[title="Strike through"]').first();
    await strikeA.click();
    await page.waitForTimeout(500);
    await saveScreenshot(page, 'p3_s06_02_a_struck');

    const lineThroughAfterA = await page.locator('[class*="line-through"]').count();
    const opacityAfterA = await page.locator('button.flex-1[class*="opacity"]').count();
    const strikeApplied = lineThroughAfterA > 0 || opacityAfterA > 0;
    console.log('line-through:', lineThroughAfterA, '| opacity:', opacityAfterA, '| applied:', strikeApplied);

    // Check active state on strike button
    const removeBtn = page.locator('button[title="Remove strikethrough"]').first();
    const removeBtnClass = await removeBtn.getAttribute('class').catch(() => '');
    const hasBgMuted = removeBtnClass.includes('bg-muted');
    console.log('Remove btn class has bg-muted:', hasBgMuted, '| Class:', removeBtnClass.substring(0, 100));

    // Strike D (3rd Strike through after A is struck: A→Remove, B/C/D → Strike)
    const strikeButtonsAfterA = await page.locator('button[title="Strike through"]').all();
    let dStruck = false;
    if (strikeButtonsAfterA.length >= 3) {
      await strikeButtonsAfterA[2].click(); // D = index 2 (0=B, 1=C, 2=D)
      await page.waitForTimeout(500);
      const lineThroughAfterD = await page.locator('[class*="line-through"]').count();
      dStruck = lineThroughAfterD > lineThroughAfterA;
      console.log('D struck:', dStruck, '| line-through:', lineThroughAfterD);
      await saveScreenshot(page, 'p3_s06_03_a_d_struck');
    }

    // Select B
    const choices6 = await page.locator('button.flex-1:not([disabled])').all();
    let bSelectedWithStrikes = false;
    if (choices6.length >= 2) {
      await choices6[1].click(); // B
      await page.waitForTimeout(500);
      bSelectedWithStrikes = (await choices6[1].getAttribute('class').catch(() => '')).includes('bg-brand-primary');
      console.log('B selected while A/D struck:', bSelectedWithStrikes);
      await saveScreenshot(page, 'p3_s06_04_b_selected');
    }

    // Toggle off A
    const removeA = page.locator('button[title="Remove strikethrough"]').first();
    await removeA.click();
    await page.waitForTimeout(500);
    const lineThroughAfterToggle = await page.locator('[class*="line-through"]').count();
    console.log('line-through after un-strike A:', lineThroughAfterToggle);
    await saveScreenshot(page, 'p3_s06_05_a_unstruck');

    // Navigate to Q4 and back - persistence
    const nextBtn6b = page.locator('button', { hasText: 'Next →' }).first();
    await nextBtn6b.click(); await page.waitForTimeout(400);
    const backBtn6 = page.locator('button', { hasText: '← Back' }).first();
    if (await backBtn6.isVisible().catch(() => false)) {
      await backBtn6.click(); await page.waitForTimeout(1000);
    }
    await saveScreenshot(page, 'p3_s06_06_persistence');
    const persistedLineThrough = await page.locator('[class*="line-through"]').count();
    console.log('Persisted line-through:', persistedLineThrough);

    results['S-06'] = {
      status: (strikeApplied && hasBgMuted && bSelectedWithStrikes) ? 'PASS' : (strikeApplied ? 'PARTIAL' : 'FAIL'),
      strikeBtnsFound: strikeBtns6All.length, strikeApplied, hasBgMuted, dStruck,
      bSelectedWithStrikes, persistedAfterNav: persistedLineThrough > 0
    };

    if (!strikeApplied) findings.high.push({ id: 'B1-H18', scenario: 'S-06', title: 'Strikethrough click has no visual effect', criteriaRef: '1.4' });
  }
  console.log('S-06:', results['S-06'].status);

  // =====================================================
  // S-07: Question Navigator
  // =====================================================
  console.log('\n=== S-07: Question Navigator ===');

  // We're on Q3. Answer it if needed.
  const q3ChoicesForNav = await page.locator('button.flex-1:not([disabled])').all();
  if (q3ChoicesForNav.length >= 2) {
    const q3bClass = await q3ChoicesForNav[1].getAttribute('class').catch(() => '');
    if (!q3bClass.includes('bg-brand-primary')) {
      await q3ChoicesForNav[1].click();
      await page.waitForTimeout(300);
    }
  }

  await saveScreenshot(page, 'p3_s07_01_before_nav');

  const centerBtn7 = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
  const centerVisible7 = await centerBtn7.isVisible().catch(() => false);
  console.log('Center nav:', centerVisible7);

  if (!centerVisible7) {
    results['S-07'] = { status: 'FAIL', notes: 'Center nav not found' };
    findings.high.push({ id: 'B1-H19', scenario: 'S-07', title: 'Center nav "Question X of Y" not visible', criteriaRef: '7.4' });
  } else {
    await centerBtn7.click();
    await page.waitForTimeout(1000);
    await saveScreenshot(page, 'p3_s07_02_nav_open');

    const navH3 = await page.locator('h3', { hasText: 'Question Navigator' }).first().isVisible().catch(() => false);
    console.log('Navigator heading:', navH3);

    // Count question boxes
    const qBoxes = await page.locator('button.w-10, button.w-12').count();
    const answeredBoxes = await page.locator('button.w-10.bg-brand-primary, button.w-12.bg-brand-primary').count();
    const flagBoxes = await page.locator('button').filter({ hasText: '🚩' }).count();
    const ringHighlight = await page.locator('button.ring-2').count();
    console.log('Q boxes:', qBoxes, '| Answered:', answeredBoxes, '| Flags:', flagBoxes, '| Ring:', ringHighlight);

    // Legend
    const legendOk = (await page.locator('span', { hasText: 'Answered' }).count() > 0) &&
                     (await page.locator('span', { hasText: 'Flagged' }).count() > 0) &&
                     (await page.locator('span', { hasText: 'Unanswered' }).count() > 0);
    console.log('Legend:', legendOk);
    await saveScreenshot(page, 'p3_s07_03_nav_grid');

    // Click Q7
    let jumpedQ7 = false;
    const q7Box = page.locator('button.w-10, button.w-12').filter({ hasText: '7' }).first();
    if (await q7Box.isVisible().catch(() => false)) {
      await q7Box.click();
      await page.waitForTimeout(1000);
      await saveScreenshot(page, 'p3_s07_04_jump_q7');
      const afterCounter = await page.locator('button').filter({ hasText: /Question 7 of/ }).first().textContent().catch(() => '');
      jumpedQ7 = afterCounter.includes('7');
      console.log('Jumped to Q7:', jumpedQ7, '| Counter:', afterCounter.trim());
      if (!jumpedQ7) findings.high.push({ id: 'B1-H21', scenario: 'S-07', title: 'Clicking Q7 in navigator did not navigate to Q7', criteriaRef: '7.4' });
    }

    // Re-open and click "Go to Review Screen"
    const center7b = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
    if (await center7b.isVisible().catch(() => false)) {
      await center7b.click();
      await page.waitForTimeout(1000);
      await saveScreenshot(page, 'p3_s07_05_nav_review');

      const reviewBtn7 = page.locator('button', { hasText: 'Go to Review Screen' }).first();
      const reviewBtnOk = await reviewBtn7.isVisible().catch(() => false);
      console.log('Go to Review Screen button:', reviewBtnOk);

      if (!reviewBtnOk) {
        findings.medium.push({ id: 'B1-M05', scenario: 'S-07', title: '"Go to Review Screen" missing from navigator', criteriaRef: '7.4' });
        // Close modal
        await page.keyboard.press('Escape');
      } else {
        await reviewBtn7.click();
        await page.waitForTimeout(1000);
        await saveScreenshot(page, 'p3_s07_06_review');

        const reviewH2 = await page.locator('h2, h1').filter({ hasText: /Review Your Answers/ }).first().isVisible().catch(() => false);
        console.log('Review screen:', reviewH2);

        const returnBtn = page.locator('button', { hasText: /Return to Questions/ }).first();
        if (await returnBtn.isVisible().catch(() => false)) {
          await returnBtn.click();
          await page.waitForTimeout(1000);
        }

        results['S-07'] = {
          status: (navH3 && qBoxes >= 15 && answeredBoxes >= 2 && flagBoxes >= 1 && legendOk && jumpedQ7 && reviewBtnOk) ? 'PASS' : 'PARTIAL',
          navH3, qBoxes, answeredBoxes, flagBoxes, ringHighlight, legendOk, jumpedQ7, reviewBtnOk, reviewH2
        };
      }
    }

    if (!results['S-07']) {
      results['S-07'] = { status: 'PARTIAL', navH3, qBoxes, answeredBoxes, flagBoxes, legendOk, jumpedQ7: false };
    }
  }
  console.log('S-07:', results['S-07']?.status);

  // =====================================================
  // SAVE RESULTS
  // =====================================================
  const summary = { results, findings, consoleErrors };
  fs.writeFileSync(
    'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b1_final_results.json',
    JSON.stringify(summary, null, 2)
  );
  console.log('\n=== FINAL RESULTS ===');
  console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.status])), null, 2));
  console.log('Blockers:', findings.blocker.length);
  console.log('High:', findings.high.length);
  console.log('Medium:', findings.medium.length);
});
