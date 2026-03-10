/**
 * B1 S-05 targeted re-run
 * Tests flag/unflag cycle, handling existing flagged state from prior runs
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const STUDENT_EMAIL = 'student@apboost.test';
const STUDENT_PASSWORD = 'Student123!';
const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_b1_live';
const MICRO_TEST_ID = 'test_micro_full_1';
const RESULTS_FILE = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b1_live_results.json';

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true }).catch(e => console.log(`SCREENSHOT FAIL ${name}: ${e.message}`));
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

async function getCurrentQuestion(page) {
  return await page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first().textContent().catch(() => '');
}

async function navigateToQ(page, target) {
  for (let i = 0; i < 20; i++) {
    const counter = await getCurrentQuestion(page);
    const m = counter.match(/Question (\d+) of/);
    const cur = m ? parseInt(m[1]) : -1;
    if (cur === target) break;
    if (cur < target) {
      const next = page.locator('button').filter({ hasText: 'Next →' }).first();
      if (await next.isVisible().catch(() => false)) { await next.click({ timeout: 3000 }); await page.waitForTimeout(400); }
      else break;
    } else {
      const back = page.locator('button').filter({ hasText: '← Back' }).first();
      if (await back.isVisible().catch(() => false) && !await back.isDisabled().catch(() => true)) {
        await back.click({ timeout: 3000 }); await page.waitForTimeout(400);
      } else break;
    }
  }
  const final = await getCurrentQuestion(page);
  console.log(`[NAV] Target Q${target} → "${final.trim()}"`);
  return final.includes(`Question ${target} of`);
}

async function closeModalIfOpen(page) {
  const overlay = await page.locator('div.fixed.inset-0.z-50').first().isVisible().catch(() => false);
  if (overlay) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const stillOpen = await page.locator('div.fixed.inset-0.z-50').first().isVisible().catch(() => false);
    if (stillOpen) {
      // Click on the slide-up panel's header area to close
      await page.locator('div.fixed.inset-0.z-50').first().click({ position: { x: 200, y: 30 }, force: true });
      await page.waitForTimeout(500);
    }
  }
}

test('B1-S05-TARGETED: Flag/Unflag cycle with existing session', async ({ page }) => {
  test.setTimeout(120000);

  const findings = { high: [], medium: [] };

  await loginAs(page, STUDENT_EMAIL, STUDENT_PASSWORD);
  await page.goto(`http://localhost:5173/ap/test/${MICRO_TEST_ID}`);
  await page.waitForTimeout(3000);

  // Handle dup tab modal
  const dup = await page.locator('button').filter({ hasText: /Use This Tab/ }).first().isVisible().catch(() => false);
  if (dup) {
    await page.locator('button').filter({ hasText: /Use This Tab/ }).first().click();
    await page.waitForTimeout(2000);
  }

  // Start test
  const beginBtn = await page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first().isVisible().catch(() => false);
  if (beginBtn) {
    await page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first().click();
    await page.waitForTimeout(3000);
  }

  await screenshot(page, 's05r_01_in_test');

  // Navigate to Q1
  await navigateToQ(page, 1);
  await page.waitForTimeout(400);

  await screenshot(page, 's05r_02_q1_initial');

  // Find the flag button — it can say "Flag for Review" OR "Flagged"
  const flagBtnAny = page.locator('button').filter({ hasText: /Flag for Review|Flagged/ }).first();
  const flagBtnVisible = await flagBtnAny.isVisible().catch(() => false);
  const flagBtnText = await flagBtnAny.textContent().catch(() => '');
  const initiallyFlagged = flagBtnText.trim() === 'Flagged';
  console.log(`Flag button visible: ${flagBtnVisible} | text: "${flagBtnText.trim()}" | initially flagged: ${initiallyFlagged}`);

  if (!flagBtnVisible) {
    console.log('FAIL: No flag button (Flag for Review OR Flagged) found on Q1');
    // Update results
    const data = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
    data.results['S-05'] = {
      status: 'FAIL',
      notes: 'No flag button visible at all on Q1',
      flagBtnVisible: false,
      issues: ['No flag button visible on Q1 (not "Flag for Review" nor "Flagged")']
    };
    data.findings.high.push({ id: 'FINDING-B1-H-S05-X', scenario: 'S-05', title: 'Flag button completely missing from Q1', criteriaRef: '1.2' });
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(data, null, 2));
    return;
  }

  // STEP 1: Ensure we're in "unflagged" state before testing the toggle
  // If already flagged, unflag first to get to known state
  if (initiallyFlagged) {
    console.log('Q1 is already flagged — unflagging first to get to known state');
    await flagBtnAny.click();
    await page.waitForTimeout(600);
    const afterUnflagText = await page.locator('button').filter({ hasText: /Flag for Review|Flagged/ }).first().textContent().catch(() => '');
    console.log(`After initial unflag: "${afterUnflagText.trim()}"`);
    await screenshot(page, 's05r_03_q1_unflagged_init');
  }

  // Now Q1 should be in "Flag for Review" state
  const flagBtnUnflagged = page.locator('button').filter({ hasText: 'Flag for Review' }).first();
  const unflaggedVisible = await flagBtnUnflagged.isVisible().catch(() => false);
  const unflaggedClass = unflaggedVisible ? await flagBtnUnflagged.getAttribute('class').catch(() => '') : '';
  console.log(`"Flag for Review" visible: ${unflaggedVisible} | class: ${unflaggedClass.substring(0, 100)}`);

  await screenshot(page, 's05r_04_ready_to_flag');

  // STEP 2: Click Flag — should change to "Flagged" with bg-warning
  if (unflaggedVisible) {
    await flagBtnUnflagged.click();
    await page.waitForTimeout(700);
  }
  await screenshot(page, 's05r_05_after_flag_click');

  const flaggedBtn = page.locator('button').filter({ hasText: 'Flagged' }).first();
  const flaggedVisible = await flaggedBtn.isVisible().catch(() => false);
  const flaggedClass = flaggedVisible ? await flaggedBtn.getAttribute('class').catch(() => '') : '';
  const hasBgWarning = flaggedClass.includes('bg-warning');
  console.log(`"Flagged" visible: ${flaggedVisible} | bg-warning: ${hasBgWarning}`);
  console.log(`Flagged class: ${flaggedClass.substring(0, 120)}`);

  // STEP 3: Navigate to Q2 and flag it too
  await page.locator('button').filter({ hasText: 'Next →' }).first().click();
  await page.waitForTimeout(600);
  const q2Q = await getCurrentQuestion(page);
  console.log(`At: ${q2Q.trim()}`);

  // Q2 flag button — may already be flagged from prior run
  const q2FlagAny = page.locator('button').filter({ hasText: /Flag for Review|Flagged/ }).first();
  const q2FlagText = await q2FlagAny.textContent().catch(() => '');
  console.log(`Q2 flag state: "${q2FlagText.trim()}"`);

  if (q2FlagText.trim() === 'Flag for Review') {
    await q2FlagAny.click();
    await page.waitForTimeout(600);
    console.log('Flagged Q2');
  } else {
    console.log('Q2 already flagged');
  }
  await screenshot(page, 's05r_06_q2_flagged');

  // STEP 4: Open navigator and verify flag emojis
  const centerBtn = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
  let navOpens = false, flagsInNav = 0, navBoxCount = 0, answeredCount = 0, legendOk = false;

  if (await centerBtn.isVisible().catch(() => false)) {
    await centerBtn.click();
    await page.waitForTimeout(1500);
    await screenshot(page, 's05r_07_navigator');

    navOpens = await page.locator('h3').filter({ hasText: 'Question Navigator' }).first().isVisible().catch(() => false);
    console.log(`Navigator heading: ${navOpens}`);

    if (navOpens) {
      flagsInNav = await page.locator('button').filter({ hasText: '🚩' }).count();
      navBoxCount = await page.locator('button.w-10, button.w-12').count();
      answeredCount = await page.locator('button.w-10[class*="bg-brand-primary"], button.w-12[class*="bg-brand-primary"]').count();
      const answeredLeg = await page.locator('span, div').filter({ hasText: /^Answered$/ }).count();
      const flaggedLeg = await page.locator('span, div').filter({ hasText: /^Flagged$/ }).count();
      const unanswLeg = await page.locator('span, div').filter({ hasText: /^Unanswered$/ }).count();
      legendOk = answeredLeg > 0 && flaggedLeg > 0 && unanswLeg > 0;
      console.log(`Flags: ${flagsInNav} | Boxes: ${navBoxCount} | Answered: ${answeredCount} | Legend: ${legendOk}`);
      await screenshot(page, 's05r_08_nav_flags');

      // Close navigator
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
      const closed = !(await page.locator('h3').filter({ hasText: 'Question Navigator' }).first().isVisible().catch(() => false));
      console.log(`Navigator closed: ${closed}`);
      if (!closed) {
        await closeModalIfOpen(page);
      }
    }
  }

  // STEP 5: Back to Q1 and unflag
  await navigateToQ(page, 1);
  await page.waitForTimeout(400);
  await screenshot(page, 's05r_09_q1_before_unflag');

  const q1FlaggedState = page.locator('button').filter({ hasText: 'Flagged' }).first();
  const q1StillFlagged = await q1FlaggedState.isVisible().catch(() => false);
  console.log(`Q1 in "Flagged" state on return: ${q1StillFlagged}`);

  let unflagWorks = false;
  if (q1StillFlagged) {
    await q1FlaggedState.click();
    await page.waitForTimeout(700);
    await screenshot(page, 's05r_10_q1_after_unflag');
    const afterText = await page.locator('button').filter({ hasText: /Flag for Review|Flagged/ }).first().textContent().catch(() => '');
    unflagWorks = afterText.trim() === 'Flag for Review';
    console.log(`After unflag: "${afterText.trim()}" | reverts to "Flag for Review": ${unflagWorks}`);

    // Check navigator shows 1 flag (only Q2)
    const checkCenter = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
    if (await checkCenter.isVisible().catch(() => false)) {
      await checkCenter.click();
      await page.waitForTimeout(1000);
      const flagsAfter = await page.locator('button').filter({ hasText: '🚩' }).count();
      console.log(`Flags in nav after Q1 unflag: ${flagsAfter} (expect 1 for Q2)`);
      await screenshot(page, 's05r_11_nav_after_unflag');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }
  }

  // Determine S-05 status
  const s05Issues = [];
  if (!flaggedVisible) s05Issues.push('Flag button does not toggle to "Flagged" state');
  if (flaggedVisible && !hasBgWarning) s05Issues.push('Missing bg-warning on Flagged button');
  if (!navOpens) s05Issues.push('Navigator modal does not open');
  if (navOpens && flagsInNav < 2) s05Issues.push(`Only ${flagsInNav} flag emoji in nav (expected 2)`);
  if (navOpens && navBoxCount < 15) s05Issues.push(`Only ${navBoxCount} nav grid boxes (expected 15)`);
  if (navOpens && !legendOk) s05Issues.push('Navigator legend incomplete');
  if (!q1StillFlagged) s05Issues.push('Q1 flag state not persisted after nav to Q2 and back');
  if (q1StillFlagged && !unflagWorks) s05Issues.push('Unflag does not revert to "Flag for Review"');

  const s05Result = {
    status: s05Issues.length === 0 ? 'PASS' : (flaggedVisible && navOpens ? 'PARTIAL' : 'FAIL'),
    flagBtnVisible, initiallyFlagged,
    flaggedVisible, hasBgWarning,
    navOpens, navBoxCount, answeredCount, flagsInNav, legendOk,
    q1StillFlagged, unflagWorks,
    issues: s05Issues
  };
  console.log(`\nS-05: ${s05Result.status}${s05Issues.length ? ' — ' + s05Issues.join(' | ') : ' CLEAN'}`);

  // Update findings
  if (!flaggedVisible) findings.high.push({ id: 'FINDING-B1-H-S05B', scenario: 'S-05', title: 'Flag button not toggling to "Flagged" state', criteriaRef: '1.2' });
  if (flaggedVisible && !hasBgWarning) findings.medium.push({ id: 'FINDING-B1-M-S05C', scenario: 'S-05', title: 'Flagged button missing bg-warning class', criteriaRef: '1.2' });
  if (!navOpens) findings.high.push({ id: 'FINDING-B1-H-S05D', scenario: 'S-05', title: 'Navigator does not open', criteriaRef: '7.4' });
  if (navOpens && flagsInNav < 2) findings.high.push({ id: 'FINDING-B1-H-S05E', scenario: 'S-05', title: `Navigator shows ${flagsInNav} flags (expected 2)`, criteriaRef: '1.2' });

  // Merge into results file
  try {
    const data = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
    data.results['S-05'] = s05Result;
    // Remove the erroneous high finding from the previous S-05 FAIL
    data.findings.high = data.findings.high.filter(f => f.id !== 'FINDING-B1-H-S05A');
    data.findings.high.push(...findings.high);
    data.findings.medium.push(...findings.medium);
    data.runAt = new Date().toISOString();
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(data, null, 2));
    console.log('Results saved');
  } catch (e) {
    console.log('Save error:', e.message);
  }
});
