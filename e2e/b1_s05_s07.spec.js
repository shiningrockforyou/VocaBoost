/**
 * B1 S-05 to S-07 continuation
 * Starts a fresh test session and runs S-05, S-06, S-07
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

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true }).catch(e => console.log(`[SCREENSHOT FAILED] ${name}: ${e.message}`));
  console.log(`[SCREENSHOT] ${name}.png`);
}

async function loginAs(page, email, password) {
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.keyboard.press('Enter');
  await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 25000 });
}

async function dismissModal(page) {
  // Try Escape first
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  // Check if a "fixed inset-0 z-50" modal overlay is still present
  const overlay = await page.locator('div.fixed.inset-0.z-50').first().isVisible().catch(() => false);
  if (overlay) {
    // Try clicking the close button inside the modal
    const closeBtn = page.locator('div.fixed.inset-0.z-50 button').filter({ hasText: /close|✕|×/i }).first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(400);
    } else {
      // Click the backdrop (top of the overlay)
      await page.locator('div.fixed.inset-0.z-50').first().click({ position: { x: 10, y: 10 }, force: true });
      await page.waitForTimeout(400);
    }
  }
  return overlay;
}

async function getCurrentQuestion(page) {
  return await page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first().textContent().catch(() => '');
}

async function navigateToQ(page, target) {
  for (let i = 0; i < 25; i++) {
    // First make sure no modal is blocking
    const overlay = await page.locator('div.fixed.inset-0.z-50').first().isVisible().catch(() => false);
    if (overlay) {
      await dismissModal(page);
      await page.waitForTimeout(300);
    }

    const counter = await getCurrentQuestion(page);
    const m = counter.match(/Question (\d+) of/);
    const cur = m ? parseInt(m[1]) : -1;
    if (cur === target) break;

    if (cur < target) {
      const next = page.locator('button').filter({ hasText: 'Next →' }).first();
      if (await next.isVisible().catch(() => false) && !await next.isDisabled().catch(() => true)) {
        await next.click({ timeout: 3000 });
        await page.waitForTimeout(400);
      } else break;
    } else {
      const back = page.locator('button').filter({ hasText: '← Back' }).first();
      if (await back.isVisible().catch(() => false) && !await back.isDisabled().catch(() => true)) {
        await back.click({ timeout: 3000 });
        await page.waitForTimeout(400);
      } else break;
    }
  }
  const final = await getCurrentQuestion(page);
  console.log(`[NAV] Target Q${target} → "${final.trim()}"`);
  return final.includes(`Question ${target} of`);
}

test('B1-S05-S07: Flagging, Strikethrough, Navigator', async ({ page }) => {
  test.setTimeout(300000);

  const results = {};
  const findings = { blocker: [], high: [], medium: [], nitpick: [] };
  const consoleErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!t.includes('ERR_BLOCKED_BY_CLIENT') && !t.includes('net::ERR_') && !t.includes('firebasedependencies')) {
        consoleErrors.push({ url: page.url(), msg: t.substring(0, 200) });
        console.log('[CONSOLE_ERROR]', t.substring(0, 150));
      }
    }
  });

  // Login
  try {
    await loginAs(page, STUDENT_EMAIL, STUDENT_PASSWORD);
    console.log('[LOGIN] Student OK');
  } catch (e) {
    console.log('[LOGIN] Student failed, trying teacher');
    await loginAs(page, TEACHER_EMAIL, TEACHER_PASSWORD);
  }

  // Navigate to test URL
  await page.goto(`http://localhost:5173/ap/test/${MICRO_TEST_ID}`);
  await page.waitForTimeout(3000);

  // Handle any dup modal
  const dupModal = await page.locator('button').filter({ hasText: /Use This Tab/ }).first().isVisible().catch(() => false);
  if (dupModal) {
    await page.locator('button').filter({ hasText: /Use This Tab/ }).first().click();
    await page.waitForTimeout(2000);
    await screenshot(page, 's05_dup_modal_dismissed');
  }

  await screenshot(page, 's05_00_initial_state');

  // Start test if needed
  const beginBtn = await page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first().isVisible().catch(() => false);
  if (beginBtn) {
    await page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first().click();
    await page.waitForTimeout(4000);
    // Handle any modal after begin
    const dupAfterBegin = await page.locator('button').filter({ hasText: /Use This Tab/ }).first().isVisible().catch(() => false);
    if (dupAfterBegin) {
      await page.locator('button').filter({ hasText: /Use This Tab/ }).first().click();
      await page.waitForTimeout(2000);
    }
  }

  await screenshot(page, 's05_01_in_test');
  const timerEl = await page.locator('[class*="font-mono"]').first().isVisible().catch(() => false);
  console.log(`In test (timer visible): ${timerEl}`);

  // Navigate to Q1
  await navigateToQ(page, 1);

  // =====================================================
  // S-05: QUESTION FLAGGING
  // =====================================================
  console.log('\n=== S-05: Question Flagging ===');

  const flagBtn = page.locator('button').filter({ hasText: /Flag for Review/ }).first();
  const flagVisible = await flagBtn.isVisible().catch(() => false);
  console.log(`Flag for Review visible: ${flagVisible}`);
  await screenshot(page, 's05_02_before_flag');

  if (!flagVisible) {
    results['S-05'] = { status: 'FAIL', notes: 'Flag button not visible on Q1' };
    findings.high.push({ id: 'FINDING-B1-H-S05A', scenario: 'S-05', title: '"Flag for Review" button missing on Q1', criteriaRef: '1.2' });
  } else {
    // Check initial class
    const unflaggedClass = await flagBtn.getAttribute('class').catch(() => '');
    console.log(`Unflagged class: ${unflaggedClass.substring(0, 100)}`);

    // FLAG Q1
    await flagBtn.click();
    await page.waitForTimeout(600);
    await screenshot(page, 's05_03_q1_flagged');

    const flaggedBtn = page.locator('button').filter({ hasText: 'Flagged' }).first();
    const flaggedVisible = await flaggedBtn.isVisible().catch(() => false);
    const flaggedClass = flaggedVisible ? await flaggedBtn.getAttribute('class').catch(() => '') : '';
    const hasBgWarning = flaggedClass.includes('bg-warning');
    console.log(`"Flagged" visible: ${flaggedVisible} | bg-warning: ${hasBgWarning}`);
    console.log(`Flagged class: ${flaggedClass.substring(0, 120)}`);

    // Go to Q2 and flag it
    await page.locator('button').filter({ hasText: 'Next →' }).first().click();
    await page.waitForTimeout(600);
    const q2Current = await getCurrentQuestion(page);
    console.log(`Now at: ${q2Current.trim()}`);

    const q2FlagBtn = page.locator('button').filter({ hasText: /Flag for Review/ }).first();
    const q2Visible = await q2FlagBtn.isVisible().catch(() => false);
    if (q2Visible) {
      await q2FlagBtn.click();
      await page.waitForTimeout(600);
      const q2FlaggedBtn = page.locator('button').filter({ hasText: 'Flagged' }).first();
      const q2FlaggedVisible = await q2FlaggedBtn.isVisible().catch(() => false);
      console.log(`Q2 "Flagged" visible: ${q2FlaggedVisible}`);
    }
    await screenshot(page, 's05_04_q2_flagged');

    // Open navigator from Q2
    const centerBtn = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
    const centerOk = await centerBtn.isVisible().catch(() => false);
    let navOpens = false, flagsInNav = 0, legendOk = false, navBoxCount = 0, answeredCount = 0;

    if (centerOk) {
      await centerBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 's05_05_navigator');

      navOpens = await page.locator('h3').filter({ hasText: 'Question Navigator' }).first().isVisible().catch(() => false);
      console.log(`Navigator heading visible: ${navOpens}`);

      if (navOpens) {
        flagsInNav = await page.locator('button').filter({ hasText: '🚩' }).count();
        navBoxCount = await page.locator('button.w-10, button.w-12').count();
        answeredCount = await page.locator('button.w-10[class*="bg-brand-primary"], button.w-12[class*="bg-brand-primary"]').count();
        const answeredLeg = await page.locator('span, div').filter({ hasText: /^Answered$/ }).count();
        const flaggedLeg = await page.locator('span, div').filter({ hasText: /^Flagged$/ }).count();
        const unanswLeg = await page.locator('span, div').filter({ hasText: /^Unanswered$/ }).count();
        legendOk = answeredLeg > 0 && flaggedLeg > 0 && unanswLeg > 0;

        console.log(`Nav boxes: ${navBoxCount} | Answered: ${answeredCount} | Flags: ${flagsInNav}`);
        console.log(`Legend (A/F/U): ${answeredLeg}/${flaggedLeg}/${unanswLeg} | ok: ${legendOk}`);

        await screenshot(page, 's05_06_nav_flags');

        // Close navigator properly using the close button inside the modal
        // First try clicking outside (backdrop)
        await page.keyboard.press('Escape');
        await page.waitForTimeout(800);

        // Check if still open
        const stillOpen = await page.locator('h3').filter({ hasText: 'Question Navigator' }).first().isVisible().catch(() => false);
        if (stillOpen) {
          console.log('[NAV] Still open after Escape — trying backdrop click');
          // Get the modal container and click its top area (backdrop)
          await page.locator('div.fixed.inset-0.z-50').first().click({ position: { x: 200, y: 20 }, force: true });
          await page.waitForTimeout(600);
        }
        const closedOk = !(await page.locator('h3').filter({ hasText: 'Question Navigator' }).first().isVisible().catch(() => false));
        console.log(`Navigator closed: ${closedOk}`);
      }
    }

    // Back to Q1 and unflag
    await navigateToQ(page, 1);
    await page.waitForTimeout(400);
    await screenshot(page, 's05_07_q1_returned');

    const q1StillFlagged = await page.locator('button').filter({ hasText: 'Flagged' }).first().isVisible().catch(() => false);
    console.log(`Q1 still in "Flagged" state: ${q1StillFlagged}`);

    let unflagWorks = false;
    if (q1StillFlagged) {
      await page.locator('button').filter({ hasText: 'Flagged' }).first().click();
      await page.waitForTimeout(600);
      await screenshot(page, 's05_08_q1_unflagged');

      const afterText = await page.locator('button').filter({ hasText: /Flag for Review|Flagged/ }).first().textContent().catch(() => '');
      unflagWorks = afterText.trim().includes('Flag for Review');
      console.log(`After unflag: "${afterText.trim()}" | reverts: ${unflagWorks}`);

      // Verify in navigator
      const centerForCheck = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
      if (await centerForCheck.isVisible().catch(() => false)) {
        await centerForCheck.click();
        await page.waitForTimeout(1000);
        const flagsAfter = await page.locator('button').filter({ hasText: '🚩' }).count();
        console.log(`Flags in nav after Q1 unflag: ${flagsAfter} (expect 1 for Q2)`);
        await screenshot(page, 's05_09_nav_after_unflag');
        // Close
        await page.keyboard.press('Escape');
        await page.waitForTimeout(600);
        const stillOpenCheck = await page.locator('h3').filter({ hasText: 'Question Navigator' }).first().isVisible().catch(() => false);
        if (stillOpenCheck) {
          await page.locator('div.fixed.inset-0.z-50').first().click({ position: { x: 200, y: 20 }, force: true });
          await page.waitForTimeout(600);
        }
      }
    }

    const s05Issues = [];
    if (!flaggedVisible) s05Issues.push('Flag does not toggle to "Flagged" state');
    if (flaggedVisible && !hasBgWarning) s05Issues.push('Missing bg-warning on Flagged button');
    if (!navOpens) s05Issues.push('Navigator modal does not open');
    if (navOpens && flagsInNav < 2) s05Issues.push(`Only ${flagsInNav} flag emoji in nav (expected 2)`);
    if (navOpens && navBoxCount < 15) s05Issues.push(`Only ${navBoxCount} nav grid boxes (expected 15)`);
    if (navOpens && !legendOk) s05Issues.push('Legend incomplete');
    if (!q1StillFlagged) s05Issues.push('Q1 flag state lost when returning from Q2');
    if (q1StillFlagged && !unflagWorks) s05Issues.push('Unflag does not revert to "Flag for Review"');

    results['S-05'] = {
      status: s05Issues.length === 0 ? 'PASS' : (flaggedVisible && navOpens ? 'PARTIAL' : 'FAIL'),
      flaggedVisible, hasBgWarning, navOpens, navBoxCount, answeredCount,
      flagsInNav, legendOk, q1StillFlagged, unflagWorks, issues: s05Issues
    };
    console.log(`S-05: ${results['S-05'].status}${s05Issues.length ? ' — ' + s05Issues.join(' | ') : ' CLEAN'}`);

    if (!flaggedVisible) findings.high.push({ id: 'FINDING-B1-H-S05B', scenario: 'S-05', title: 'Flag button not toggling', criteriaRef: '1.2' });
    if (flaggedVisible && !hasBgWarning) findings.medium.push({ id: 'FINDING-B1-M-S05C', scenario: 'S-05', title: 'Flagged button missing bg-warning token', criteriaRef: '1.2' });
    if (!navOpens) findings.high.push({ id: 'FINDING-B1-H-S05D', scenario: 'S-05', title: 'Question Navigator does not open', criteriaRef: '7.4' });
    if (navOpens && flagsInNav < 2) findings.high.push({ id: 'FINDING-B1-H-S05E', scenario: 'S-05', title: `Navigator shows ${flagsInNav} flags (expected 2)`, criteriaRef: '1.2' });
  }

  // =====================================================
  // S-06: STRIKETHROUGH
  // =====================================================
  console.log('\n=== S-06: Strikethrough ===');

  // Navigate to Q3 (unanswered)
  const reachedQ3 = await navigateToQ(page, 3);
  console.log(`Reached Q3: ${reachedQ3}`);
  await screenshot(page, 's06_01_q3_start');

  const strikeBtns = await page.locator('button[title="Strike through"], button[title="Remove strikethrough"]').count();
  console.log(`Strike buttons on Q3: ${strikeBtns}`);

  if (strikeBtns === 0) {
    results['S-06'] = { status: 'FAIL', notes: 'No strikethrough buttons on Q3', strikeBtnsFound: 0 };
    findings.high.push({ id: 'FINDING-B1-H-S06A', scenario: 'S-06', title: 'No strikethrough buttons on MCQ choices', criteriaRef: '1.4' });
    console.log('S-06: FAIL — no strike buttons');
  } else {
    // Click strike on choice A
    const strikeFirst = page.locator('button[title="Strike through"]').first();
    await strikeFirst.click({ timeout: 5000 });
    await page.waitForTimeout(600);
    await screenshot(page, 's06_02_a_struck');

    const lineThrough1 = await page.locator('[class*="line-through"]').count();
    const opacity1 = await page.locator('button.flex-1[class*="opacity"]').count();
    const strikeApplied = lineThrough1 > 0 || opacity1 > 0;
    console.log(`line-through: ${lineThrough1} | opacity: ${opacity1} | applied: ${strikeApplied}`);

    // Verify Remove button active state
    const removeBtn = page.locator('button[title="Remove strikethrough"]').first();
    const removeBtnOk = await removeBtn.isVisible().catch(() => false);
    const removeCls = removeBtnOk ? await removeBtn.getAttribute('class').catch(() => '') : '';
    const hasBgMuted = removeCls.includes('bg-muted');
    console.log(`Remove btn: ${removeBtnOk} | bg-muted: ${hasBgMuted} | class: ${removeCls.substring(0, 80)}`);

    // Strike choice D (last strike button — all have title "Strike through" except A which is now "Remove strikethrough")
    const remainingStrikes = await page.locator('button[title="Strike through"]').all();
    let dStruck = false;
    console.log(`Remaining "Strike through" buttons: ${remainingStrikes.length}`);
    if (remainingStrikes.length >= 1) {
      // D is the last choice, so strike the last available button
      const lastIdx = remainingStrikes.length - 1;
      await remainingStrikes[lastIdx].click({ timeout: 5000 });
      await page.waitForTimeout(500);
      const lineThrough2 = await page.locator('[class*="line-through"]').count();
      dStruck = lineThrough2 > lineThrough1;
      console.log(`After D strike: lineThrough=${lineThrough2} | dStruck: ${dStruck}`);
    }
    await screenshot(page, 's06_03_multi_struck');

    // Select B as answer while strikes active
    const choicesQ3 = await page.locator('button.flex-1').all();
    let bSelectedWithStrikes = false;
    console.log(`Q3 choice buttons count: ${choicesQ3.length}`);
    if (choicesQ3.length >= 2) {
      await choicesQ3[1].click({ timeout: 5000 }); // B = index 1
      await page.waitForTimeout(600);
      const updatedC = await page.locator('button.flex-1').all();
      if (updatedC.length >= 2) {
        const bCls = await updatedC[1].getAttribute('class').catch(() => '');
        bSelectedWithStrikes = bCls.includes('bg-brand-primary');
        // Check A is not selected
        const aCls = await updatedC[0].getAttribute('class').catch(() => '');
        const aStillStruck = aCls.includes('opacity');
        console.log(`B selected: ${bSelectedWithStrikes} | A still struck: ${aStillStruck}`);
      }
    }
    await screenshot(page, 's06_04_b_selected_strikes_active');

    // Un-strike A
    const removeA = page.locator('button[title="Remove strikethrough"]').first();
    if (await removeA.isVisible().catch(() => false)) {
      await removeA.click({ timeout: 5000 });
      await page.waitForTimeout(500);
    }
    const lineThroughAfterUnstrike = await page.locator('[class*="line-through"]').count();
    console.log(`line-through after un-striking A: ${lineThroughAfterUnstrike}`);
    await screenshot(page, 's06_05_a_unstruck');

    // Navigate Q4 and back — test persistence of D strikethrough
    const nextBtn = page.locator('button').filter({ hasText: 'Next →' }).first();
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click({ timeout: 5000 });
      await page.waitForTimeout(500);
    }
    const backBtn = page.locator('button').filter({ hasText: '← Back' }).first();
    if (await backBtn.isVisible().catch(() => false) && !await backBtn.isDisabled().catch(() => true)) {
      await backBtn.click({ timeout: 5000 });
      await page.waitForTimeout(1000);
    }
    await screenshot(page, 's06_06_after_nav_back');

    const persistedLines = await page.locator('[class*="line-through"]').count();
    console.log(`Persisted line-through after nav: ${persistedLines}`);

    const s06Issues = [];
    if (!strikeApplied) s06Issues.push('Strikethrough click has no visual effect');
    if (strikeApplied && !hasBgMuted) s06Issues.push('Remove btn missing bg-muted active state');
    if (!bSelectedWithStrikes) s06Issues.push('Cannot select answer while strikes active');
    if (persistedLines === 0 && strikeApplied) s06Issues.push('Strikethrough state lost after navigation');

    results['S-06'] = {
      status: s06Issues.length === 0 ? 'PASS' : (strikeApplied ? 'PARTIAL' : 'FAIL'),
      strikeBtnsFound: strikeBtns, strikeApplied, lineThrough1, opacity1,
      hasBgMuted, dStruck, bSelectedWithStrikes, persistedAfterNav: persistedLines > 0,
      issues: s06Issues
    };
    console.log(`S-06: ${results['S-06'].status}${s06Issues.length ? ' — ' + s06Issues.join(' | ') : ' CLEAN'}`);

    if (!strikeApplied) findings.high.push({ id: 'FINDING-B1-H-S06B', scenario: 'S-06', title: 'Strikethrough has no visual effect', criteriaRef: '1.4' });
    if (strikeApplied && !hasBgMuted) findings.medium.push({ id: 'FINDING-B1-M-S06C', scenario: 'S-06', title: 'Remove strikethrough btn missing bg-muted', criteriaRef: '1.4' });
    if (!bSelectedWithStrikes) findings.high.push({ id: 'FINDING-B1-H-S06D', scenario: 'S-06', title: 'Cannot select answer with strikes active', criteriaRef: '1.4' });
    if (persistedLines === 0 && strikeApplied) findings.high.push({ id: 'FINDING-B1-H-S06E', scenario: 'S-06', title: 'Strikethrough not persisting through navigation', criteriaRef: '1.4' });
  }

  // =====================================================
  // S-07: QUESTION NAVIGATOR - FULL GRID
  // =====================================================
  console.log('\n=== S-07: Question Navigator ===');

  const currentQ = await getCurrentQuestion(page);
  console.log(`Current Q before S-07: ${currentQ.trim()}`);
  await screenshot(page, 's07_01_before_nav');

  const centerBtn07 = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
  const centerOk07 = await centerBtn07.isVisible().catch(() => false);
  console.log(`Center nav button visible: ${centerOk07}`);

  if (!centerOk07) {
    results['S-07'] = { status: 'FAIL', notes: 'Center nav button not visible' };
    findings.high.push({ id: 'FINDING-B1-H-S07A', scenario: 'S-07', title: 'Center nav "Question X of Y" button missing', criteriaRef: '7.4' });
    console.log('S-07: FAIL');
  } else {
    await centerBtn07.click();
    await page.waitForTimeout(1500);
    await screenshot(page, 's07_02_nav_modal');

    const navH3 = await page.locator('h3').filter({ hasText: 'Question Navigator' }).first().isVisible().catch(() => false);
    const qBoxes = await page.locator('button.w-10, button.w-12').count();
    const answeredBoxes = await page.locator('button.w-10[class*="bg-brand-primary"], button.w-12[class*="bg-brand-primary"]').count();
    const flagBoxes = await page.locator('button').filter({ hasText: '🚩' }).count();
    const ringBoxes = await page.locator('button.w-10[class*="ring-2"], button.w-12[class*="ring-2"]').count();

    const answeredLeg = await page.locator('span, div').filter({ hasText: /^Answered$/ }).count();
    const flaggedLeg = await page.locator('span, div').filter({ hasText: /^Flagged$/ }).count();
    const unanswLeg = await page.locator('span, div').filter({ hasText: /^Unanswered$/ }).count();
    const legendOk = answeredLeg > 0 && flaggedLeg > 0 && unanswLeg > 0;

    console.log(`Nav H3: ${navH3} | Boxes: ${qBoxes} | Answered: ${answeredBoxes} | Flags: ${flagBoxes} | Ring: ${ringBoxes}`);
    console.log(`Legend (A/F/U): ${answeredLeg}/${flaggedLeg}/${unanswLeg} | ok: ${legendOk}`);

    await screenshot(page, 's07_03_nav_grid');

    // Jump to Q7
    let jumpedQ7 = false;
    // Try different selectors for Q7 box
    let q7Box = page.locator('button.w-10').filter({ hasText: '7' }).first();
    let q7Visible = await q7Box.isVisible().catch(() => false);
    if (!q7Visible) {
      q7Box = page.locator('button.w-12').filter({ hasText: '7' }).first();
      q7Visible = await q7Box.isVisible().catch(() => false);
    }
    if (!q7Visible) {
      // Try a more general approach
      q7Box = page.locator('[data-question-index="6"]').first(); // 0-indexed
      q7Visible = await q7Box.isVisible().catch(() => false);
    }
    console.log(`Q7 box visible: ${q7Visible}`);

    if (q7Visible) {
      await q7Box.click({ timeout: 5000 });
      await page.waitForTimeout(1500);
      await screenshot(page, 's07_04_jumped_q7');
      const q7Counter = await getCurrentQuestion(page);
      jumpedQ7 = q7Counter.includes('Question 7 of');
      console.log(`After Q7 click: "${q7Counter.trim()}" | jumped: ${jumpedQ7}`);
    } else {
      // Print all button texts in modal to debug
      const navBtns = await page.locator('button.w-10').allTextContents().catch(() => []);
      console.log('Nav button texts (w-10):', navBtns.slice(0, 20));
    }

    // Re-open navigator for "Go to Review Screen" test
    const center07b = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
    let reviewBtnOk = false, reviewScreenOk = false, returnBtnOk = false;

    if (await center07b.isVisible().catch(() => false)) {
      await center07b.click();
      await page.waitForTimeout(1200);
      await screenshot(page, 's07_05_nav_for_review');

      const goToReview = page.locator('button').filter({ hasText: 'Go to Review Screen' }).first();
      reviewBtnOk = await goToReview.isVisible().catch(() => false);
      console.log(`"Go to Review Screen" button: ${reviewBtnOk}`);

      if (reviewBtnOk) {
        await goToReview.click();
        await page.waitForTimeout(1500);
        await screenshot(page, 's07_06_review_screen');
        reviewScreenOk = await page.locator('h2, h1').filter({ hasText: /Review Your Answers/ }).first().isVisible().catch(() => false);
        console.log(`Review screen visible: ${reviewScreenOk}`);

        const returnBtn = page.locator('button').filter({ hasText: /Return to Questions/ }).first();
        returnBtnOk = await returnBtn.isVisible().catch(() => false);
        if (returnBtnOk) {
          await returnBtn.click({ timeout: 5000 });
          await page.waitForTimeout(1000);
          await screenshot(page, 's07_07_returned');
        }
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    const s07Issues = [];
    if (!navH3) s07Issues.push('Navigator "Question Navigator" h3 heading missing');
    if (qBoxes < 15) s07Issues.push(`Only ${qBoxes} grid boxes (expected 15)`);
    if (!legendOk) s07Issues.push('Legend (Answered/Unanswered/Flagged) incomplete');
    if (!jumpedQ7) s07Issues.push('Jump to Q7 from navigator failed');
    if (!reviewBtnOk) s07Issues.push('"Go to Review Screen" button missing from navigator');
    if (reviewBtnOk && !reviewScreenOk) s07Issues.push('Review screen did not load');
    if (reviewBtnOk && !returnBtnOk) s07Issues.push('"Return to Questions" button missing on review screen');

    results['S-07'] = {
      status: s07Issues.length === 0 ? 'PASS' : (navH3 && qBoxes >= 15 && jumpedQ7 ? 'PARTIAL' : 'FAIL'),
      navH3, qBoxes, answeredBoxes, flagBoxes, ringBoxes, legendOk,
      jumpedQ7, q7Visible, reviewBtnOk, reviewScreenOk, returnBtnOk,
      issues: s07Issues
    };
    console.log(`S-07: ${results['S-07'].status}${s07Issues.length ? ' — ' + s07Issues.join(' | ') : ' CLEAN'}`);

    if (!navH3) findings.high.push({ id: 'FINDING-B1-H-S07B', scenario: 'S-07', title: 'Navigator heading missing', criteriaRef: '7.4' });
    if (qBoxes < 15) findings.medium.push({ id: 'FINDING-B1-M-S07C', scenario: 'S-07', title: `Only ${qBoxes} nav boxes`, criteriaRef: '7.4' });
    if (!jumpedQ7) findings.high.push({ id: 'FINDING-B1-H-S07D', scenario: 'S-07', title: 'Jump to Q7 failed', criteriaRef: '7.4' });
    if (!reviewBtnOk) findings.medium.push({ id: 'FINDING-B1-M-S07E', scenario: 'S-07', title: '"Go to Review Screen" button missing', criteriaRef: '7.4' });
  }

  // =====================================================
  // Merge with prior results and save
  // =====================================================
  let priorResults = {};
  let priorFindings = { blocker: [], high: [], medium: [], nitpick: [] };
  let priorConsoleErrors = [];
  let priorAccountType = 'student';

  try {
    const data = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
    priorResults = data.results || {};
    priorFindings = data.findings || { blocker: [], high: [], medium: [], nitpick: [] };
    priorConsoleErrors = data.consoleErrors || [];
    priorAccountType = data.accountType || 'student';
  } catch (e) {}

  const mergedResults = { ...priorResults, ...results };
  const mergedFindings = {
    blocker: [...priorFindings.blocker, ...findings.blocker],
    high: [...priorFindings.high, ...findings.high],
    medium: [...priorFindings.medium, ...findings.medium],
    nitpick: [...priorFindings.nitpick, ...findings.nitpick],
  };
  const mergedErrors = [...priorConsoleErrors, ...consoleErrors];

  const final = {
    results: mergedResults,
    findings: mergedFindings,
    consoleErrors: mergedErrors,
    accountType: priorAccountType,
    runAt: new Date().toISOString(),
    note: 'S-01/S-02/S-03/S-04 from b1_live_audit.spec.js; S-05/S-06/S-07 from b1_s05_s07.spec.js'
  };
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(final, null, 2));

  console.log('\n=== S-05 to S-07 RESULTS ===');
  for (const [k, v] of Object.entries(results)) {
    console.log(`${k}: ${v.status}${v.issues?.length ? ' — ' + v.issues.join(' | ') : ' CLEAN'}`);
  }
  console.log(`New Blockers: ${findings.blocker.length} | High: ${findings.high.length} | Medium: ${findings.medium.length}`);
});
