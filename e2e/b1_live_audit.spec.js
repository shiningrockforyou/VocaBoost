/**
 * B1 LIVE Audit — S-01 through S-07 (Fresh comprehensive run)
 * Focus areas per instructions:
 *   S-03: DuplicateTabModal fix — modal should NOT keep re-appearing
 *   S-04: MCQ answers navigate away and back, verify persistence
 *   S-05: Flag, verify navigator, unflag
 *   S-06: Strikethrough X — opacity, line-through visual changes
 *   S-07: Navigator modal, grid layout, jump to Q7
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const STUDENT_EMAIL = 'student@apboost.test';
const STUDENT_PASSWORD = 'Student123!';
const TEACHER_EMAIL = 'teacher@apboost.test';
const TEACHER_PASSWORD = 'Teacher123!';
const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_b1_live';
const MICRO_TEST_ID = 'test_micro_full_1';
const RESULTS_FILE = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b1_live_results.json';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function saveResults(data) {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(data, null, 2));
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true }).catch(e => console.log(`[SCREENSHOT FAILED] ${name}: ${e.message}`));
  console.log(`[SCREENSHOT] ${name}.png`);
  return filePath;
}

async function loginAs(page, email, password) {
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.keyboard.press('Enter');
  await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 25000 });
  console.log(`[LOGIN] Logged in as ${email}, URL: ${page.url()}`);
}

async function dismissDuplicateTabModal(page, label) {
  await page.waitForTimeout(500);
  const btn = page.locator('button').filter({ hasText: /Use This Tab/ }).first();
  const isVisible = await btn.isVisible().catch(() => false);
  if (isVisible) {
    console.log(`[${label}] DuplicateTabModal detected — clicking "Use This Tab"`);
    await btn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, `dup_modal_dismissed_${label.toLowerCase().replace(/[\s-]/g, '_')}`);
    const stillVisible = await page.locator('button').filter({ hasText: /Use This Tab/ }).first().isVisible().catch(() => false);
    console.log(`[${label}] Modal still visible after dismiss: ${stillVisible}`);
    return { wasPresent: true, dismissed: !stillVisible };
  }
  return { wasPresent: false, dismissed: false };
}

async function getCurrentQuestion(page) {
  return await page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first().textContent().catch(() => '');
}

async function navigateToQuestion(page, targetQ) {
  for (let i = 0; i < 20; i++) {
    const counter = await getCurrentQuestion(page);
    const m = counter.match(/Question (\d+) of/);
    const cur = m ? parseInt(m[1]) : -1;
    if (cur === targetQ) break;
    if (cur < targetQ) {
      const next = page.locator('button').filter({ hasText: 'Next →' }).first();
      if (await next.isVisible().catch(() => false)) { await next.click(); await page.waitForTimeout(400); }
      else break;
    } else {
      const back = page.locator('button').filter({ hasText: '← Back' }).first();
      if (await back.isVisible().catch(() => false) && !await back.isDisabled().catch(() => true)) { await back.click(); await page.waitForTimeout(400); }
      else break;
    }
  }
  const finalQ = await getCurrentQuestion(page);
  console.log(`[NAV] Target Q${targetQ}, reached: ${finalQ.trim()}`);
  return finalQ.includes(`Question ${targetQ} of`);
}

test('B1-LIVE: Complete S-01 through S-07', async ({ page }) => {
  test.setTimeout(600000);

  const results = {};
  const findings = { blocker: [], high: [], medium: [], nitpick: [] };
  const consoleErrors = [];
  let accountType = 'student';

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('ERR_BLOCKED_BY_CLIENT') && !text.includes('net::ERR_') &&
          !text.includes('firebasedependencies') && !text.includes('favicon')) {
        consoleErrors.push({ url: page.url(), msg: text.substring(0, 200) });
        console.log('[CONSOLE_ERROR]', text.substring(0, 150));
      }
    }
  });

  // =====================================================
  // LOGIN
  // =====================================================
  try {
    await loginAs(page, STUDENT_EMAIL, STUDENT_PASSWORD);
    accountType = 'student';
    console.log('[LOGIN] Student login OK');
  } catch (err) {
    console.log('[LOGIN] Student login failed:', err.message.substring(0, 80), '— falling back to teacher');
    accountType = 'teacher';
    try {
      await loginAs(page, TEACHER_EMAIL, TEACHER_PASSWORD);
    } catch (err2) {
      const blocker = { id: 'FINDING-B1-000', scenario: 'ALL', title: 'Login failed — all accounts', detail: err2.message };
      findings.blocker.push(blocker);
      saveResults({ results, findings, consoleErrors, accountType: 'none', error: 'LOGIN_FAILED' });
      throw new Error('Login failed for all accounts');
    }
  }
  await screenshot(page, '00_login_success');

  // =====================================================
  // S-01: Dashboard Initial Load
  // =====================================================
  console.log('\n=== S-01: Dashboard ===');

  await page.goto('http://localhost:5173/ap');
  await page.waitForTimeout(5000);
  await screenshot(page, 's01_01_dashboard_loaded');

  const h1Text = await page.locator('h1').first().textContent().catch(() => '');
  const microCard = await page.locator('h3, h2').filter({ hasText: /Microeconomics/ }).count();
  const macroCard = await page.locator('h3, h2').filter({ hasText: /Macroeconomics/ }).count();
  const calcCard = await page.locator('h3, h2').filter({ hasText: /Calculus/ }).count();
  const statusBadges = await page.locator('span').filter({ hasText: /Not Started|In Progress|Completed/ }).count();
  const sectionText = await page.locator('text=/\\d+ sections?/').count();
  const timeText = await page.locator('text=/\\d+ min|\\d+ hr/').count();
  const errorBanner = await page.locator('[class*="bg-error"]').count();
  const apHeaderLink = await page.locator('a[href="/ap"]').count();
  const skeletonVisible = await page.locator('[class*="animate-pulse"]').count();

  console.log('H1:', h1Text.trim());
  console.log(`Cards: Micro=${microCard} Macro=${macroCard} Calc=${calcCard}`);
  console.log(`Badges=${statusBadges} Sections=${sectionText} Times=${timeText} Errors=${errorBanner} Header=${apHeaderLink} Skeleton=${skeletonVisible}`);

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
    h1: h1Text.trim(), microCard, macroCard, calcCard, statusBadges, sectionText, timeText, errorBanner, apHeaderLink, issues: s01Issues
  };
  console.log(`S-01: ${results['S-01'].status}${s01Issues.length ? ' — ' + s01Issues.join(' | ') : ''}`);
  saveResults({ results, findings, consoleErrors, accountType });

  // =====================================================
  // S-02: Instruction Screen
  // =====================================================
  console.log('\n=== S-02: Instruction Screen ===');

  await page.goto(`http://localhost:5173/ap/test/${MICRO_TEST_ID}`);
  await page.waitForTimeout(4000);

  // Dismiss any dup tab modal from a prior session
  await dismissDuplicateTabModal(page, 'S02-pre');

  await screenshot(page, 's02_01_initial_state');
  console.log('URL:', page.url());

  // Check what state we're in
  const s02TimerVisible = await page.locator('[class*="font-mono"]').first().isVisible().catch(() => false);
  const s02BeginVisible = await page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first().isVisible().catch(() => false);
  console.log(`Timer visible: ${s02TimerVisible} | Begin/Resume visible: ${s02BeginVisible}`);

  // Inspect instruction screen elements
  const instrH1 = await page.locator('h1').first().textContent().catch(() => '');
  const beginBtnEl = page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first();
  const beginBtn = await beginBtnEl.isVisible().catch(() => false);
  const beginBtnText = await beginBtnEl.textContent().catch(() => '');
  const cancelBtn = await page.locator('button').filter({ hasText: /Cancel/ }).first().isVisible().catch(() => false);
  const sectionBreakdown = await page.locator('text=/This test has \\d+ sections?/').count();
  const totalTimeText = await page.locator('text=/Total time:/').count();
  const frqInfoBox = await page.locator('[class*="bg-info"]').count();
  const freeResponseH3 = await page.locator('h3').filter({ hasText: /Free Response Section/ }).count();
  const warningBox = await page.locator('[class*="bg-warning"]').count();
  const cannotPause = await page.locator('li, p').filter({ hasText: /cannot pause the timer/i }).count();
  const cannotReturn = await page.locator('li, p').filter({ hasText: /cannot return to previous sections/i }).count();

  console.log(`H1: ${instrH1.trim()}`);
  console.log(`Begin: ${beginBtn} (${beginBtnText.trim()}) | Cancel: ${cancelBtn}`);
  console.log(`SectionBreakdown: ${sectionBreakdown} | TotalTime: ${totalTimeText} | FRQ info: ${frqInfoBox} | FRQ h3: ${freeResponseH3}`);
  console.log(`Warning: ${warningBox} | cannot-pause: ${cannotPause} | cannot-return: ${cannotReturn}`);

  await screenshot(page, 's02_02_instruction_elements');

  // Test Cancel
  let cancelWorks = false;
  if (cancelBtn && !s02TimerVisible) {
    await page.locator('button').filter({ hasText: /Cancel/ }).first().click();
    await page.waitForTimeout(2000);
    const cancelUrl = page.url();
    cancelWorks = cancelUrl.includes('/ap') && !cancelUrl.includes('/test/');
    console.log(`Cancel -> ${cancelUrl} | works: ${cancelWorks}`);
    await screenshot(page, 's02_03_after_cancel');

    // Go back for Begin Test check
    await page.goto(`http://localhost:5173/ap/test/${MICRO_TEST_ID}`);
    await page.waitForTimeout(3000);
    await dismissDuplicateTabModal(page, 'S02-after-cancel');
    const beginBtnText2 = await page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first().textContent().catch(() => '');
    console.log(`Begin/Resume after cancel: "${beginBtnText2.trim()}"`);
    await screenshot(page, 's02_04_begin_test_btn');
  }

  const s02Issues = [];
  if (s02TimerVisible) {
    s02Issues.push('Auto-resumed into test (instruction screen bypassed)');
  } else {
    if (!instrH1.includes('Microeconomics')) s02Issues.push(`H1 wrong: "${instrH1.trim()}"`);
    if (!beginBtn) s02Issues.push('Begin/Resume button missing');
    if (!cancelBtn) s02Issues.push('Cancel button missing');
    if (cancelBtn && !cancelWorks) s02Issues.push('Cancel does not return to dashboard');
    if (sectionBreakdown === 0) s02Issues.push('Section breakdown text missing');
    if (frqInfoBox === 0) s02Issues.push('FRQ info box (bg-info) missing');
    if (freeResponseH3 === 0) s02Issues.push('Free Response Section h3 missing');
    if (warningBox === 0) s02Issues.push('Warning box (bg-warning) missing');
    if (cannotPause === 0) s02Issues.push('"cannot pause the timer" text missing');
    if (cannotReturn === 0) s02Issues.push('"cannot return to previous sections" text missing');
  }

  results['S-02'] = {
    status: s02Issues.length === 0 ? 'PASS' : (beginBtn ? 'PARTIAL' : 'FAIL'),
    autoResumed: s02TimerVisible, instrH1: instrH1.trim(), beginBtn, beginBtnText: beginBtnText.trim(),
    cancelBtn, cancelWorks, sectionBreakdown, totalTimeText, frqInfoBox, freeResponseH3,
    warningBox, cannotPause, cannotReturn, issues: s02Issues
  };
  console.log(`S-02: ${results['S-02'].status}${s02Issues.length ? ' — ' + s02Issues.join(' | ') : ''}`);
  saveResults({ results, findings, consoleErrors, accountType });

  if (s02TimerVisible) {
    findings.high.push({ id: 'FINDING-B1-S02-A', scenario: 'S-02', title: 'Instruction screen auto-bypassed (auto-resume into test)', criteriaRef: '1.10' });
  }

  // =====================================================
  // S-03: Begin Test — Timer, Q1, Interface
  // =====================================================
  console.log('\n=== S-03: Begin Test ===');

  // Ensure on test URL
  if (!page.url().includes('/test/')) {
    await page.goto(`http://localhost:5173/ap/test/${MICRO_TEST_ID}`);
    await page.waitForTimeout(3000);
    await dismissDuplicateTabModal(page, 'S03-pre');
  }

  await page.waitForTimeout(500);
  let s03InTest = await page.locator('[class*="font-mono"]').first().isVisible().catch(() => false);
  let s03BeginVisible = await page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first().isVisible().catch(() => false);
  console.log(`State: inTest=${s03InTest} beginVisible=${s03BeginVisible}`);

  if (s03BeginVisible) {
    console.log('[S-03] Clicking Begin Test...');
    await page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first().click();
    await page.waitForTimeout(5000);
    await screenshot(page, 's03_01_after_begin');
  } else if (s03InTest) {
    console.log('[S-03] Already in test (existing session)');
    await screenshot(page, 's03_01_existing_session');
  } else {
    console.log('[S-03] Unknown state — waiting...');
    await page.waitForTimeout(3000);
    await screenshot(page, 's03_01_unknown_state');
  }

  // Handle modal that sometimes appears after begin (heartbeat self-notification)
  const dupAfterBegin = await dismissDuplicateTabModal(page, 'S03-post-begin');
  const modalPersisted = dupAfterBegin.wasPresent && !dupAfterBegin.dismissed;
  console.log(`DuplicateTabModal: wasPresent=${dupAfterBegin.wasPresent} dismissed=${dupAfterBegin.dismissed} persisted=${modalPersisted}`);

  if (modalPersisted) {
    findings.blocker.push({ id: 'FINDING-B1-001', scenario: 'S-03', title: 'DuplicateTabModal persists after clicking "Use This Tab"', criteriaRef: '1.1' });
  }

  // Verify test interface elements
  const hamburger = await page.locator('[aria-label="Open menu"]').first().isVisible().catch(() => false);
  const sectionLabel = await page.locator('text=/Section \\d+ of \\d+/').first().textContent().catch(() => '');

  // Timer countdown verification
  const timerEl = page.locator('[class*="font-mono"]').first();
  const t1 = await timerEl.textContent().catch(() => '');
  await page.waitForTimeout(3000);
  const t2 = await timerEl.textContent().catch(() => '');
  const timerCounts = t1.trim() !== '' && t2.trim() !== '' && t1.trim() !== t2.trim();
  console.log(`Timer: "${t1.trim()}" -> "${t2.trim()}" | counting: ${timerCounts}`);
  console.log(`Hamburger: ${hamburger} | Section: ${sectionLabel.trim()}`);

  await screenshot(page, 's03_02_timer_verified');

  // Q1 interface elements
  const q1Label = await page.locator('text=/Question 1/').count();
  const allChoiceBtns = await page.locator('button.flex-1').count();
  // Count enabled choices by checking class - avoid disabled selector issues
  const strikeBtns = await page.locator('button[title="Strike through"], button[title="Remove strikethrough"]').count();
  const nextBtn = page.locator('button').filter({ hasText: 'Next →' }).first();
  const backBtn = page.locator('button').filter({ hasText: '← Back' }).first();
  const nextVisible = await nextBtn.isVisible().catch(() => false);
  const backVisible = await backBtn.isVisible().catch(() => false);
  const backDisabled = backVisible ? await backBtn.isDisabled().catch(() => true) : true;
  const centerNavBtn = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
  const centerNavText = await centerNavBtn.textContent().catch(() => '');
  const centerNavVisible = await centerNavBtn.isVisible().catch(() => false);
  const flagVisible = await page.locator('button').filter({ hasText: /Flag for Review/ }).first().isVisible().catch(() => false);

  console.log(`Q1 label: ${q1Label} | Choices: ${allChoiceBtns} | Strike btns: ${strikeBtns}`);
  console.log(`Next: ${nextVisible} | Back: ${backVisible} disabled: ${backDisabled}`);
  console.log(`CenterNav: "${centerNavText.trim()}" visible: ${centerNavVisible}`);
  console.log(`Flag: ${flagVisible}`);

  await screenshot(page, 's03_03_full_interface');

  const s03Issues = [];
  if (modalPersisted) s03Issues.push('DuplicateTabModal persists after dismissal');
  if (!timerCounts) s03Issues.push(`Timer not counting: "${t1.trim()}" -> "${t2.trim()}"`);
  if (q1Label === 0) s03Issues.push('Question 1 label not visible');
  if (allChoiceBtns < 4) s03Issues.push(`Only ${allChoiceBtns} choice buttons`);
  if (strikeBtns < 4) s03Issues.push(`Only ${strikeBtns} strikethrough buttons`);
  if (!nextVisible) s03Issues.push('Next button not visible');
  if (!flagVisible) s03Issues.push('Flag for Review button not visible');
  if (!centerNavVisible) s03Issues.push('Center nav button not visible');
  if (backVisible && !backDisabled) s03Issues.push('Back button NOT disabled on Q1');
  if (!hamburger) s03Issues.push('Hamburger menu missing');

  results['S-03'] = {
    status: s03Issues.length === 0 ? 'PASS' : (timerCounts && allChoiceBtns >= 4 && !modalPersisted ? 'PARTIAL' : 'FAIL'),
    dupModal: dupAfterBegin.wasPresent, modalPersisted,
    timerCounts, timerTexts: `${t1.trim()}->${t2.trim()}`,
    hamburger, sectionLabel: sectionLabel.trim(),
    q1Label, allChoiceBtns, strikeBtns,
    nextVisible, backVisible, backDisabled,
    centerNavText: centerNavText.trim(), centerNavVisible, flagVisible,
    issues: s03Issues
  };
  console.log(`S-03: ${results['S-03'].status}${s03Issues.length ? ' — ' + s03Issues.join(' | ') : ''}`);
  saveResults({ results, findings, consoleErrors, accountType });

  if (!timerCounts && t1.trim() !== '') {
    findings.blocker.push({ id: 'FINDING-B1-TIMER', scenario: 'S-03', title: `Timer not counting down: "${t1.trim()}" -> "${t2.trim()}"`, criteriaRef: '1.1' });
  }

  // =====================================================
  // S-04: MCQ Answer Selection and Persistence
  // =====================================================
  console.log('\n=== S-04: MCQ Answer Selection ===');

  if (allChoiceBtns < 2 || modalPersisted) {
    results['S-04'] = { status: 'SKIP', notes: `Blocked: choices=${allChoiceBtns} modalPersisted=${modalPersisted}` };
    console.log('S-04: SKIP — blocked by S-03');
  } else {
    // Ensure on Q1
    await navigateToQuestion(page, 1);
    await page.waitForTimeout(400);

    const choicesQ1 = await page.locator('button.flex-1').all();
    console.log(`Q1 choices found: ${choicesQ1.length}`);

    // Verify no initial selection
    const initialStates = [];
    for (const btn of choicesQ1) {
      const cls = await btn.getAttribute('class').catch(() => '');
      initialStates.push(cls.includes('bg-brand-primary'));
    }
    console.log('Initial selection states:', initialStates);

    // Click B (index 1)
    let bSelected = false;
    if (choicesQ1.length > 1) {
      await choicesQ1[1].click();
      await page.waitForTimeout(800);
      const updatedChoices = await page.locator('button.flex-1').all();
      if (updatedChoices.length > 1) {
        const bCls = await updatedChoices[1].getAttribute('class').catch(() => '');
        const aCls = updatedChoices.length > 0 ? await updatedChoices[0].getAttribute('class').catch(() => '') : '';
        bSelected = bCls.includes('bg-brand-primary');
        const aNotSelected = !aCls.includes('bg-brand-primary');
        console.log(`B selected: ${bSelected} | A not selected: ${aNotSelected}`);
      }
    }
    await screenshot(page, 's04_01_b_selected');

    // Navigate to Q2
    await page.locator('button').filter({ hasText: 'Next →' }).first().click();
    await page.waitForTimeout(1200);
    const q2CounterText = await getCurrentQuestion(page);
    console.log(`At: ${q2CounterText.trim()}`);
    await screenshot(page, 's04_02_q2');

    // Select A on Q2
    const choicesQ2 = await page.locator('button.flex-1').all();
    let q2ASelected = false;
    if (choicesQ2.length > 0) {
      await choicesQ2[0].click();
      await page.waitForTimeout(600);
      const updatedQ2 = await page.locator('button.flex-1').all();
      if (updatedQ2.length > 0) {
        const aCls = await updatedQ2[0].getAttribute('class').catch(() => '');
        q2ASelected = aCls.includes('bg-brand-primary');
        console.log(`Q2 A selected: ${q2ASelected}`);
      }
    }
    await screenshot(page, 's04_03_q2_a_selected');

    // Back to Q1
    await page.locator('button').filter({ hasText: '← Back' }).first().click();
    await page.waitForTimeout(1200);
    const q1BackCounter = await getCurrentQuestion(page);
    console.log(`Back at: ${q1BackCounter.trim()}`);
    await screenshot(page, 's04_04_q1_back_nav');

    // Verify B persists
    const q1AfterBack = await page.locator('button.flex-1').all();
    let bPersists = false;
    if (q1AfterBack.length > 1) {
      const bCls = await q1AfterBack[1].getAttribute('class').catch(() => '');
      bPersists = bCls.includes('bg-brand-primary');
      console.log(`B persists after back nav: ${bPersists}`);
      // Log all button classes for debugging
      const allCls = [];
      for (const btn of q1AfterBack) {
        const c = await btn.getAttribute('class').catch(() => '');
        allCls.push(c.includes('bg-brand-primary') ? 'SELECTED' : 'unselected');
      }
      console.log('Q1 selection states after back:', allCls);
    }

    // Change Q1 to C
    let cSelected = false, bDeselected = false;
    const q1ForChange = await page.locator('button.flex-1').all();
    if (q1ForChange.length > 2) {
      await q1ForChange[2].click();
      await page.waitForTimeout(600);
      const updatedQ1C = await page.locator('button.flex-1').all();
      if (updatedQ1C.length > 2) {
        const cCls = await updatedQ1C[2].getAttribute('class').catch(() => '');
        const bCls2 = await updatedQ1C[1].getAttribute('class').catch(() => '');
        cSelected = cCls.includes('bg-brand-primary');
        bDeselected = !bCls2.includes('bg-brand-primary');
        console.log(`C selected: ${cSelected} | B deselected: ${bDeselected}`);
      }
    }
    await screenshot(page, 's04_05_c_selected_b_deselected');

    // Navigate back to Q2 - verify A persists
    await page.locator('button').filter({ hasText: 'Next →' }).first().click();
    await page.waitForTimeout(1200);
    const q2bChoices = await page.locator('button.flex-1').all();
    let q2APersists = false;
    if (q2bChoices.length > 0) {
      const aCls = await q2bChoices[0].getAttribute('class').catch(() => '');
      q2APersists = aCls.includes('bg-brand-primary');
      console.log(`Q2 A persists on forward nav: ${q2APersists}`);
    }
    await screenshot(page, 's04_06_q2_a_persists');

    const s04Issues = [];
    if (!bSelected) s04Issues.push('B click did not apply bg-brand-primary');
    if (!bPersists) s04Issues.push('Q1 answer lost when navigating to Q2 and back');
    if (!cSelected) s04Issues.push('C not selectable');
    if (!bDeselected) s04Issues.push('B not deselected when C clicked (multi-select bug)');
    if (!q2APersists) s04Issues.push('Q2 A answer lost when navigating back to Q1 then forward');

    results['S-04'] = {
      status: s04Issues.length === 0 ? 'PASS' : 'PARTIAL',
      bSelected, q2ASelected, bPersists, cSelected, bDeselected, q2APersists,
      issues: s04Issues
    };
    console.log(`S-04: ${results['S-04'].status}${s04Issues.length ? ' — ' + s04Issues.join(' | ') : ''}`);
    saveResults({ results, findings, consoleErrors, accountType });

    if (!bPersists) findings.high.push({ id: 'FINDING-B1-H-S04A', scenario: 'S-04', title: 'MCQ answer lost on back navigation', criteriaRef: '1.7' });
    if (!bDeselected) findings.high.push({ id: 'FINDING-B1-H-S04B', scenario: 'S-04', title: 'MCQ allows multiple simultaneous selections', criteriaRef: '2.1' });
  }

  // =====================================================
  // S-05: Question Flagging
  // =====================================================
  console.log('\n=== S-05: Question Flagging ===');

  // Navigate back to Q1
  await navigateToQuestion(page, 1);
  await page.waitForTimeout(400);

  const flagBtn05 = page.locator('button').filter({ hasText: /Flag for Review/ }).first();
  const flagVisible05 = await flagBtn05.isVisible().catch(() => false);
  console.log(`Flag for Review visible: ${flagVisible05}`);

  if (!flagVisible05) {
    results['S-05'] = { status: 'FAIL', notes: '"Flag for Review" button not found' };
    findings.high.push({ id: 'FINDING-B1-H-S05A', scenario: 'S-05', title: '"Flag for Review" button missing', criteriaRef: '1.2' });
    console.log('S-05: FAIL — flag button missing');
  } else {
    await screenshot(page, 's05_01_before_flag');

    // Get unflagged class for comparison
    const unflaggedClass = await flagBtn05.getAttribute('class').catch(() => '');
    console.log(`Unflagged class (sample): ${unflaggedClass.substring(0, 100)}`);

    // Flag Q1
    await flagBtn05.click();
    await page.waitForTimeout(700);
    await screenshot(page, 's05_02_q1_flagged');

    const flaggedBtn = page.locator('button').filter({ hasText: 'Flagged' }).first();
    const flaggedVisible = await flaggedBtn.isVisible().catch(() => false);
    const flaggedClass = flaggedVisible ? await flaggedBtn.getAttribute('class').catch(() => '') : '';
    const hasBgWarning = flaggedClass.includes('bg-warning');
    console.log(`Flagged state visible: ${flaggedVisible} | bg-warning class: ${hasBgWarning}`);
    console.log(`Flagged class: ${flaggedClass.substring(0, 120)}`);

    // Navigate to Q2 and flag it
    await page.locator('button').filter({ hasText: 'Next →' }).first().click();
    await page.waitForTimeout(700);

    const q2FlagBtn = page.locator('button').filter({ hasText: /Flag for Review/ }).first();
    const q2FlagVisible = await q2FlagBtn.isVisible().catch(() => false);
    if (q2FlagVisible) {
      await q2FlagBtn.click();
      await page.waitForTimeout(700);
      console.log('Q2 flagged');
    }
    await screenshot(page, 's05_03_q2_flagged');

    // Open Question Navigator
    const centerBtn05 = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
    const centerOk05 = await centerBtn05.isVisible().catch(() => false);
    let navOpens = false, flagsInNav = 0, legendOk = false;

    if (centerOk05) {
      await centerBtn05.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 's05_04_navigator_open');

      navOpens = await page.locator('h3').filter({ hasText: 'Question Navigator' }).first().isVisible().catch(() => false);
      console.log(`Navigator heading: ${navOpens}`);

      if (navOpens) {
        flagsInNav = await page.locator('button').filter({ hasText: '🚩' }).count();
        const answeredLeg = await page.locator('span, div').filter({ hasText: /^Answered$/ }).count();
        const flaggedLeg = await page.locator('span, div').filter({ hasText: /^Flagged$/ }).count();
        const unanswLeg = await page.locator('span, div').filter({ hasText: /^Unanswered$/ }).count();
        legendOk = answeredLeg > 0 && flaggedLeg > 0 && unanswLeg > 0;
        console.log(`Flags in nav: ${flagsInNav} | Legend (A/F/U): ${answeredLeg}/${flaggedLeg}/${unanswLeg} | legendOk: ${legendOk}`);

        // Check Q1 and Q2 boxes for flags
        const totalNavBtns = await page.locator('button.w-10, button.w-12').count();
        const answeredNavBtns = await page.locator('button.w-10[class*="bg-brand-primary"], button.w-12[class*="bg-brand-primary"]').count();
        console.log(`Nav grid boxes: ${totalNavBtns} | Answered: ${answeredNavBtns}`);

        await screenshot(page, 's05_05_nav_flags_detail');
      }

      // Close navigator
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }

    // Navigate back to Q1 and unflag
    await navigateToQuestion(page, 1);
    await page.waitForTimeout(400);

    let unflagWorks = false;
    const q1FlaggedBtn = page.locator('button').filter({ hasText: 'Flagged' }).first();
    const q1StillFlagged = await q1FlaggedBtn.isVisible().catch(() => false);
    console.log(`Q1 "Flagged" state on return: ${q1StillFlagged}`);

    await screenshot(page, 's05_06_q1_before_unflag');

    if (q1StillFlagged) {
      await q1FlaggedBtn.click();
      await page.waitForTimeout(700);
      await screenshot(page, 's05_07_q1_after_unflag');

      const afterUnflagBtn = page.locator('button').filter({ hasText: /Flag for Review|Flagged/ }).first();
      const afterText = await afterUnflagBtn.textContent().catch(() => '');
      unflagWorks = afterText.trim().includes('Flag for Review');
      console.log(`After unflag text: "${afterText.trim()}" | reverts: ${unflagWorks}`);

      // Verify navigator no longer shows Q1 flag
      const centerForUnflagCheck = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
      if (await centerForUnflagCheck.isVisible().catch(() => false)) {
        await centerForUnflagCheck.click();
        await page.waitForTimeout(1200);
        const flagsAfterUnflag = await page.locator('button').filter({ hasText: '🚩' }).count();
        console.log(`Flags in nav after Q1 unflag: ${flagsAfterUnflag} (expected 1 for Q2)`);
        await screenshot(page, 's05_08_nav_after_unflag');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    } else {
      console.log('Q1 is not in "Flagged" state on return — flag may not have persisted');
    }

    const s05Issues = [];
    if (!flaggedVisible) s05Issues.push('Flag does not toggle to "Flagged" state');
    if (flaggedVisible && !hasBgWarning) s05Issues.push('Missing bg-warning class on Flagged button');
    if (!navOpens) s05Issues.push('Question Navigator modal does not open');
    if (navOpens && flagsInNav < 2) s05Issues.push(`Only ${flagsInNav} flag emojis in navigator (expected 2)`);
    if (navOpens && !legendOk) s05Issues.push('Navigator legend incomplete');
    if (!q1StillFlagged) s05Issues.push('Q1 "Flagged" state not preserved after navigating to Q2 and back');
    if (q1StillFlagged && !unflagWorks) s05Issues.push('Unflag does not revert button to "Flag for Review"');

    results['S-05'] = {
      status: s05Issues.length === 0 ? 'PASS' : (flaggedVisible ? 'PARTIAL' : 'FAIL'),
      flaggedVisible, hasBgWarning, navOpens, flagsInNav, legendOk, q1StillFlagged, unflagWorks,
      issues: s05Issues
    };
    console.log(`S-05: ${results['S-05'].status}${s05Issues.length ? ' — ' + s05Issues.join(' | ') : ''}`);
    saveResults({ results, findings, consoleErrors, accountType });

    if (!flaggedVisible) findings.high.push({ id: 'FINDING-B1-H-S05B', scenario: 'S-05', title: 'Flag button not toggling to "Flagged" state', criteriaRef: '1.2' });
    if (flaggedVisible && !hasBgWarning) findings.medium.push({ id: 'FINDING-B1-M-S05C', scenario: 'S-05', title: 'Flagged button missing bg-warning token', criteriaRef: '1.2' });
    if (!navOpens) findings.high.push({ id: 'FINDING-B1-H-S05D', scenario: 'S-05', title: 'Question Navigator does not open', criteriaRef: '7.4' });
    if (navOpens && flagsInNav < 2) findings.high.push({ id: 'FINDING-B1-H-S05E', scenario: 'S-05', title: `Navigator shows ${flagsInNav} flag(s), expected 2`, criteriaRef: '1.2' });
  }

  // =====================================================
  // S-06: Strikethrough on MCQ Choices
  // =====================================================
  console.log('\n=== S-06: Strikethrough ===');

  // Navigate to Q3
  const reachedQ3 = await navigateToQuestion(page, 3);
  console.log(`Reached Q3: ${reachedQ3}`);
  await screenshot(page, 's06_01_q3_initial');

  const strikeBtnsQ3 = await page.locator('button[title="Strike through"], button[title="Remove strikethrough"]').all();
  console.log(`Strikethrough buttons on Q3: ${strikeBtnsQ3.length}`);

  if (strikeBtnsQ3.length === 0) {
    results['S-06'] = { status: 'FAIL', notes: 'No strikethrough buttons found on Q3', strikeBtnsFound: 0 };
    findings.high.push({ id: 'FINDING-B1-H-S06A', scenario: 'S-06', title: 'No strikethrough buttons on MCQ choices', criteriaRef: '1.4' });
    console.log('S-06: FAIL — no strikethrough buttons');
  } else {
    // Strike choice A (first button[title="Strike through"])
    const strikeABtn = page.locator('button[title="Strike through"]').first();
    await strikeABtn.click();
    await page.waitForTimeout(600);
    await screenshot(page, 's06_02_a_struck');

    // Check visual effects
    const lineThroughEls = await page.locator('[class*="line-through"]').count();
    const opacityEls = await page.locator('button.flex-1[class*="opacity"]').count();
    const strikeApplied = lineThroughEls > 0 || opacityEls > 0;
    console.log(`line-through elements: ${lineThroughEls} | opacity elements: ${opacityEls} | applied: ${strikeApplied}`);

    // Check "Remove strikethrough" button state
    const removeBtn = page.locator('button[title="Remove strikethrough"]').first();
    const removeBtnVisible = await removeBtn.isVisible().catch(() => false);
    const removeBtnClass = removeBtnVisible ? await removeBtn.getAttribute('class').catch(() => '') : '';
    const hasBgMuted = removeBtnClass.includes('bg-muted');
    console.log(`Remove btn visible: ${removeBtnVisible} | bg-muted: ${hasBgMuted}`);
    console.log(`Remove btn class: ${removeBtnClass.substring(0, 100)}`);

    // Strike choice D (3rd remaining "Strike through" button - A, B, C, D = indices 0,1,2,3)
    const remainingStrikes = await page.locator('button[title="Strike through"]').all();
    let dStruck = false;
    console.log(`Remaining "Strike through" buttons: ${remainingStrikes.length}`);
    if (remainingStrikes.length >= 3) {
      // 0=B, 1=C, 2=D (A was converted to "Remove strikethrough")
      await remainingStrikes[2].click();
      await page.waitForTimeout(500);
      const linesNow = await page.locator('[class*="line-through"]').count();
      dStruck = linesNow > lineThroughEls;
      console.log(`D struck: ${dStruck} | lines now: ${linesNow}`);
    } else if (remainingStrikes.length >= 1) {
      await remainingStrikes[0].click();
      await page.waitForTimeout(500);
      const linesNow = await page.locator('[class*="line-through"]').count();
      dStruck = linesNow > lineThroughEls;
      console.log(`Struck 2nd choice: ${dStruck}`);
    }
    await screenshot(page, 's06_03_multi_struck');

    // Select B as answer while strikes are active
    const choicesQ3 = await page.locator('button.flex-1').all();
    let bSelectedWithStrikes = false;
    console.log(`Q3 choice buttons: ${choicesQ3.length}`);
    if (choicesQ3.length >= 2) {
      await choicesQ3[1].click(); // B
      await page.waitForTimeout(600);
      const updatedChoices = await page.locator('button.flex-1').all();
      if (updatedChoices.length >= 2) {
        const bCls = await updatedChoices[1].getAttribute('class').catch(() => '');
        bSelectedWithStrikes = bCls.includes('bg-brand-primary');
        console.log(`B selected with strikes active: ${bSelectedWithStrikes}`);
      }
    }
    await screenshot(page, 's06_04_b_selected_with_strikes');

    // Toggle off A strikethrough
    const removeABtn = page.locator('button[title="Remove strikethrough"]').first();
    if (await removeABtn.isVisible().catch(() => false)) {
      await removeABtn.click();
      await page.waitForTimeout(500);
    }
    const linesAfterUnstrike = await page.locator('[class*="line-through"]').count();
    console.log(`Line-through after un-striking A: ${linesAfterUnstrike}`);
    await screenshot(page, 's06_05_a_unstruck');

    // Navigate to Q4 and back - test persistence
    await page.locator('button').filter({ hasText: 'Next →' }).first().click();
    await page.waitForTimeout(600);
    await page.locator('button').filter({ hasText: '← Back' }).first().click();
    await page.waitForTimeout(1000);
    await screenshot(page, 's06_06_after_nav_persistence');
    const persistedLines = await page.locator('[class*="line-through"]').count();
    console.log(`Persisted line-through after Q4 nav: ${persistedLines}`);

    const s06Issues = [];
    if (!strikeApplied) s06Issues.push('Strikethrough click has no visual effect (no opacity or line-through)');
    if (strikeApplied && !hasBgMuted) s06Issues.push('Remove strikethrough button missing bg-muted active state');
    if (!bSelectedWithStrikes) s06Issues.push('Cannot select answer choice while strikes are active');
    if (persistedLines === 0) s06Issues.push('Strikethrough state lost after navigating to Q4 and back');

    results['S-06'] = {
      status: s06Issues.length === 0 ? 'PASS' : (strikeApplied ? 'PARTIAL' : 'FAIL'),
      strikeBtnsFound: strikeBtnsQ3.length, strikeApplied, lineThroughEls, opacityEls,
      hasBgMuted, dStruck, bSelectedWithStrikes, persistedAfterNav: persistedLines > 0,
      issues: s06Issues
    };
    console.log(`S-06: ${results['S-06'].status}${s06Issues.length ? ' — ' + s06Issues.join(' | ') : ''}`);
    saveResults({ results, findings, consoleErrors, accountType });

    if (!strikeApplied) findings.high.push({ id: 'FINDING-B1-H-S06B', scenario: 'S-06', title: 'Strikethrough has no visual effect', criteriaRef: '1.4' });
    if (strikeApplied && !hasBgMuted) findings.medium.push({ id: 'FINDING-B1-M-S06C', scenario: 'S-06', title: 'Remove strikethrough btn missing bg-muted', criteriaRef: '1.4' });
    if (persistedLines === 0 && strikeApplied) findings.high.push({ id: 'FINDING-B1-H-S06D', scenario: 'S-06', title: 'Strikethrough not persisting through navigation', criteriaRef: '1.4' });
  }

  // =====================================================
  // S-07: Question Navigator — Full Grid
  // =====================================================
  console.log('\n=== S-07: Question Navigator ===');

  // Current state: on Q3, B selected, D struck through (from S-06)
  const currentQ07 = await getCurrentQuestion(page);
  console.log(`Current Q before S-07: ${currentQ07.trim()}`);
  await screenshot(page, 's07_01_before_nav');

  const centerBtn07 = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
  const centerVisible07 = await centerBtn07.isVisible().catch(() => false);
  console.log(`Center nav button visible: ${centerVisible07}`);

  if (!centerVisible07) {
    results['S-07'] = { status: 'FAIL', notes: 'Center nav button not visible' };
    findings.high.push({ id: 'FINDING-B1-H-S07A', scenario: 'S-07', title: 'Center "Question X of Y" nav button not visible', criteriaRef: '7.4' });
    console.log('S-07: FAIL — center nav missing');
  } else {
    await centerBtn07.click();
    await page.waitForTimeout(1500);
    await screenshot(page, 's07_02_nav_modal_open');

    const navH3 = await page.locator('h3').filter({ hasText: 'Question Navigator' }).first().isVisible().catch(() => false);
    console.log(`Nav heading "Question Navigator": ${navH3}`);

    // Count grid boxes
    const qBoxes = await page.locator('button.w-10, button.w-12').count();
    const answeredBoxes = await page.locator('button.w-10[class*="bg-brand-primary"], button.w-12[class*="bg-brand-primary"]').count();
    const flagBoxes = await page.locator('button').filter({ hasText: '🚩' }).count();
    const ringHighlight = await page.locator('button[class*="ring-2"]').count();
    console.log(`Grid boxes: ${qBoxes} | Answered: ${answeredBoxes} | Flag: ${flagBoxes} | Ring: ${ringHighlight}`);

    // Legend check
    const answeredLeg = await page.locator('span, div').filter({ hasText: /^Answered$/ }).count();
    const flaggedLeg = await page.locator('span, div').filter({ hasText: /^Flagged$/ }).count();
    const unanswLeg = await page.locator('span, div').filter({ hasText: /^Unanswered$/ }).count();
    const legendOk = answeredLeg > 0 && flaggedLeg > 0 && unanswLeg > 0;
    console.log(`Legend (A/F/U): ${answeredLeg}/${flaggedLeg}/${unanswLeg} | ok: ${legendOk}`);

    await screenshot(page, 's07_03_nav_grid_detail');

    // Test jump to Q7
    let jumpedQ7 = false;
    const q7Box = page.locator('button.w-10, button.w-12').filter({ hasText: '7' }).first();
    const q7Visible = await q7Box.isVisible().catch(() => false);
    console.log(`Q7 box visible: ${q7Visible}`);

    if (q7Visible) {
      await q7Box.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 's07_04_jumped_to_q7');
      const q7Counter = await getCurrentQuestion(page);
      jumpedQ7 = q7Counter.includes('Question 7 of');
      console.log(`After clicking Q7 box: "${q7Counter.trim()}" | jumped: ${jumpedQ7}`);
    } else {
      // Try locating by different selector
      const allNavBtns = await page.locator('button.w-10').all();
      console.log(`Total .w-10 buttons: ${allNavBtns.length}`);
      // Try text-based search
      const q7byText = await page.locator('button').filter({ hasText: /^7$/ }).count();
      console.log(`Buttons with exact text "7": ${q7byText}`);
    }

    // Re-open navigator for "Go to Review Screen" test
    const center07b = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
    let reviewBtnOk = false, reviewScreenOk = false, returnBtnOk = false;

    if (await center07b.isVisible().catch(() => false)) {
      await center07b.click();
      await page.waitForTimeout(1200);
      await screenshot(page, 's07_05_nav_for_review_btn');

      const goToReview = page.locator('button').filter({ hasText: 'Go to Review Screen' }).first();
      reviewBtnOk = await goToReview.isVisible().catch(() => false);
      console.log(`"Go to Review Screen" button: ${reviewBtnOk}`);

      if (reviewBtnOk) {
        await goToReview.click();
        await page.waitForTimeout(1500);
        await screenshot(page, 's07_06_review_screen');
        reviewScreenOk = await page.locator('h2, h1').filter({ hasText: /Review Your Answers/ }).first().isVisible().catch(() => false);
        console.log(`Review screen loads: ${reviewScreenOk}`);

        const returnBtn = page.locator('button').filter({ hasText: /Return to Questions/ }).first();
        returnBtnOk = await returnBtn.isVisible().catch(() => false);
        if (returnBtnOk) {
          await returnBtn.click();
          await page.waitForTimeout(1000);
          await screenshot(page, 's07_07_returned_to_test');
          console.log('"Return to Questions" clicked');
        }
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    const s07Issues = [];
    if (!navH3) s07Issues.push('Navigator heading "Question Navigator" missing');
    if (qBoxes < 15) s07Issues.push(`Only ${qBoxes} grid boxes (expected 15)`);
    if (!legendOk) s07Issues.push('Navigator legend incomplete (Answered/Unanswered/Flagged)');
    if (!jumpedQ7) s07Issues.push('Clicking Q7 box did not navigate to Q7');
    if (!reviewBtnOk) s07Issues.push('"Go to Review Screen" button missing from navigator');
    if (reviewBtnOk && !reviewScreenOk) s07Issues.push('Review screen did not load after clicking "Go to Review Screen"');
    if (reviewBtnOk && !returnBtnOk) s07Issues.push('"Return to Questions" button missing on review screen');

    results['S-07'] = {
      status: s07Issues.length === 0 ? 'PASS' : (navH3 && qBoxes >= 15 && jumpedQ7 ? 'PARTIAL' : 'FAIL'),
      navH3, qBoxes, answeredBoxes, flagBoxes, ringHighlight, legendOk,
      jumpedQ7, q7Visible, reviewBtnOk, reviewScreenOk, returnBtnOk,
      issues: s07Issues
    };
    console.log(`S-07: ${results['S-07'].status}${s07Issues.length ? ' — ' + s07Issues.join(' | ') : ''}`);
    saveResults({ results, findings, consoleErrors, accountType });

    if (!navH3) findings.high.push({ id: 'FINDING-B1-H-S07B', scenario: 'S-07', title: 'Navigator modal missing heading', criteriaRef: '7.4' });
    if (qBoxes < 15) findings.medium.push({ id: 'FINDING-B1-M-S07C', scenario: 'S-07', title: `Navigator only shows ${qBoxes} boxes`, criteriaRef: '7.4' });
    if (!jumpedQ7) findings.high.push({ id: 'FINDING-B1-H-S07D', scenario: 'S-07', title: 'Jump to Q7 from navigator failed', criteriaRef: '7.4' });
    if (!reviewBtnOk) findings.medium.push({ id: 'FINDING-B1-M-S07E', scenario: 'S-07', title: '"Go to Review Screen" missing from navigator', criteriaRef: '7.4' });
  }

  // =====================================================
  // Final save
  // =====================================================
  const summary = { results, findings, consoleErrors, accountType, runAt: new Date().toISOString() };
  saveResults(summary);

  console.log('\n=== B1 LIVE RESULTS SUMMARY ===');
  for (const [k, v] of Object.entries(results)) {
    console.log(`${k}: ${v.status}${v.issues?.length ? ' — ' + v.issues.join(' | ') : ' CLEAN'}`);
  }
  console.log(`Blockers: ${findings.blocker.length}`);
  console.log(`High: ${findings.high.length}`);
  console.log(`Medium: ${findings.medium.length}`);
  console.log(`Console errors: ${consoleErrors.length}`);

  // Test should not fail just because of findings — we report what we observed
  // Only truly assert there are no blockers
  if (findings.blocker.length > 0) {
    console.log('BLOCKERS:', JSON.stringify(findings.blocker, null, 2));
    // Not asserting to avoid test abort — we document all findings
  }
});
