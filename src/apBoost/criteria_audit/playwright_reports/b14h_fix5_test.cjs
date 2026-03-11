/**
 * FIX-5 targeted test (B14H-003)
 * Verify that Tab 1 flushes its queue before responding to SESSION_QUERY,
 * so Tab 2 sees Q1-Q3 answers when it takes control.
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots_B14H_retest_v3');

let ssN = 200;
const ss = async (p, lbl) => {
  ssN++;
  await p.screenshot({ path: path.join(SCREENSHOT_DIR, ssN + '_' + lbl + '.png'), fullPage: true }).catch(() => {});
  console.log('[SS ' + ssN + ']', lbl);
};
const log = (...a) => console.log('[' + new Date().toISOString().split('T')[1].slice(0, 8) + ']', ...a);

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const results = {
    fix5_tab2_sees_q1_q3: null,
    fix5_detail: null,
    session_flush_log: null,
  };

  // Tab 1: Login
  const tab1 = await context.newPage();
  const tab1Logs = [];
  tab1.on('console', m => {
    const t = m.text();
    if (t.includes('APBoost')) tab1Logs.push(t);
  });

  await tab1.goto('http://localhost:5173/login');
  await tab1.waitForTimeout(2000);
  await tab1.fill('input[type="email"]', 'student11@apboost.test');
  await tab1.fill('input[type="password"]', 'Student123!');
  await tab1.press('input[type="password"]', 'Enter');
  await tab1.waitForTimeout(4000);

  // Navigate to test
  await tab1.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await tab1.waitForTimeout(5000);

  // Handle stale modal
  const b1 = await tab1.locator('body').textContent();
  if (b1.includes('Use This Tab')) {
    await tab1.locator('button:has-text("Use This Tab")').first().click();
    await tab1.waitForTimeout(2000);
  }

  // Check state
  const b2 = await tab1.locator('body').textContent();
  const onInstruction = b2.includes('Begin Test') || b2.includes('Resume Test');
  const onFRQ = b2.includes('Type Your Answers');

  log('Tab1 state: onInstruction=' + onInstruction + ' onFRQ=' + onFRQ);

  if (onFRQ) {
    log('MCQ already completed - session in FRQ. Cannot run fresh FIX-5 test with this account.');
    log('FIX-5 status: UNKNOWN - Session already past MCQ stage. Previous test run (v3) showed Tab 2');
    log('entered testing at Q3 (cur:3), which means session was at the correct position from Tab 1.');
    log('The fire-and-forget flush in useDuplicateTabGuard.js (line 122: onSessionQueryRef.current?.())');
    log('is correctly coded but the onSessionQuery callback is NOT passed from useTestSession.js (line 66).');
    log('Therefore FIX-5 code is INCOMPLETE.');

    results.fix5_tab2_sees_q1_q3 = 'INCOMPLETE';
    results.fix5_detail = 'onSessionQuery callback not wired: useDuplicateTabGuard.js line 122 calls onSessionQueryRef.current?.() but useTestSession.js line 66 does NOT pass onSessionQuery parameter. Flush fire-and-forget NOT triggered on SESSION_QUERY.';
    results.session_flush_log = 'No SESSION_QUERY flush log found (callback not wired)';

    // Verify: check if Tab 1 fires a flush log when responding to SESSION_QUERY
    // Open Tab 2 briefly
    const tab2 = await context.newPage();
    await tab2.goto('http://localhost:5173/ap/test/test_micro_full_1');
    await tab2.waitForTimeout(4000);

    // Check Tab 1 logs for flush-related messages
    const tab1FlushLogs = tab1Logs.filter(l =>
      l.includes('Responding to query') ||
      l.includes('onSessionQuery') ||
      l.includes('flushQueue') ||
      l.includes('Flushing')
    );
    log('Tab1 flush logs after Tab2 opened:', tab1FlushLogs.length);
    for (const l of tab1FlushLogs) log('  ', l.substring(0, 200));

    if (tab1FlushLogs.length > 0) {
      results.session_flush_log = 'Flush triggered on SESSION_QUERY: ' + tab1FlushLogs.slice(0, 2).join(' | ');
      results.fix5_tab2_sees_q1_q3 = 'WIRED';
    } else {
      results.session_flush_log = 'NO flush log triggered when SESSION_QUERY received';
    }

    await tab2.close();
    await browser.close();

    log('\n=== FIX-5 RESULTS ===');
    for (const [k, v] of Object.entries(results)) log(' ', k, ':', v);
    return results;
  }

  // Enter testing
  if (onInstruction) {
    await tab1.locator('button:has-text("Resume Test"), button:has-text("Begin Test")').first().click({ force: true });
    await tab1.waitForTimeout(3000);
  }

  // Answer Q1-Q3 quickly (simulate race condition for FIX-5)
  const answerQ = async (idx) => {
    return await tab1.evaluate((i) => {
      const main = document.querySelector('main');
      if (!main) return false;
      const btns = main.querySelectorAll('button, [role="radio"]');
      if (btns.length > 0) { btns[i % btns.length].click(); return true; }
      return false;
    }, idx);
  };

  await answerQ(0);
  await tab1.waitForTimeout(200);
  log('Q1 answered');
  await tab1.locator('button:has-text("Next →")').first().click().catch(() => {});
  await tab1.waitForTimeout(200);

  await answerQ(1);
  await tab1.waitForTimeout(200);
  log('Q2 answered');
  await tab1.locator('button:has-text("Next →")').first().click().catch(() => {});
  await tab1.waitForTimeout(200);

  await answerQ(2);
  log('Q3 answered - opening Tab 2 IMMEDIATELY (before 300ms flush)');
  await ss(tab1, 'fix5_tab1_q3');

  // Check what Tab 1 has queued
  const preFlushLogs = tab1Logs.filter(l => l.includes('addToQueue') || l.includes('ANSWER_CHANGE'));
  log('Tab1 queue logs before Tab2 opens:', preFlushLogs.length, 'items');
  for (const l of preFlushLogs.slice(-6)) log('  ', l.substring(0, 150));

  // Open Tab 2 IMMEDIATELY - before the 300ms debounce flush fires
  const tab2 = await context.newPage();
  const tab2Logs = [];
  tab2.on('console', m => {
    if (m.text().includes('APBoost')) tab2Logs.push(m.text());
  });

  await tab2.goto('http://localhost:5173/ap/test/test_micro_full_1');

  // Wait for BroadcastChannel exchange
  for (let i = 0; i < 8; i++) {
    await tab2.waitForTimeout(500);
    const t2b = await tab2.locator('body').textContent();
    const hasModal = t2b.includes('Use This Tab');
    if (hasModal) { log('Tab2 modal at t=' + (i * 0.5) + 's'); break; }
  }

  // Check if Tab 1 fired a flush when it responded to SESSION_QUERY
  const responseLog = tab1Logs.filter(l =>
    l.includes('Responding to query') ||
    l.includes('SESSION_QUERY') ||
    l.includes('onSessionQuery')
  );
  log('Tab1 logs after Tab2 opened (SESSION_QUERY response):');
  for (const l of responseLog) log('  ', l.substring(0, 200));

  const flushLog = tab1Logs.filter(l => l.includes('flushQueue') || l.includes('Flushing') || l.includes('Flush complete'));
  log('Tab1 flush logs:');
  for (const l of flushLog) log('  ', l.substring(0, 200));

  // Click Use This Tab in Tab 2
  const useBtn = await tab2.locator('button:has-text("Use This Tab")').first().isVisible({ timeout: 3000 }).catch(() => false);
  if (useBtn) {
    await tab2.locator('button:has-text("Use This Tab")').first().click();
    await tab2.waitForTimeout(2000);
    log('Tab 2 clicked Use This Tab');
  }

  // Tab 2 enters testing
  const t2InstrBtn = await tab2.locator('button:has-text("Resume Test"), button:has-text("Begin Test")').first().isVisible({ timeout: 3000 }).catch(() => false);
  if (t2InstrBtn) {
    await tab2.locator('button:has-text("Resume Test"), button:has-text("Begin Test")').first().click({ force: true });
    await tab2.waitForTimeout(3000);
  }

  await ss(tab2, 'fix5_tab2_entered_testing');

  // Check Tab 2's current position - should be at Q3 if Tab 1's position was saved
  const tab2Pos = await tab2.locator('body').textContent().catch(() => '');
  const qMatch = tab2Pos.match(/Question (\d+) of (\d+)/);
  log('Tab 2 position:', qMatch ? qMatch[0] : 'unknown');

  // Navigate back to Q1 and check if it has an answer
  for (let i = 0; i < 3; i++) {
    const backBtn = tab2.locator('button:has-text("← Back")').first();
    const backVis = await backBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (backVis) {
      await backBtn.click();
      await tab2.waitForTimeout(300);
    }
  }

  const q1State = await tab2.locator('body').textContent().catch(() => '');
  const atQ1 = q1State.match(/Question (\d+) of/);
  log('Tab 2 at:', atQ1 ? 'Q' + atQ1[1] : 'unknown');

  // Check if Q1 has a selected answer by looking at the DOM
  const q1Selected = await tab2.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return null;
    // Look for any element with selected/checked state
    const selected = main.querySelectorAll('[aria-checked="true"], [aria-selected="true"], input[type="radio"]:checked');
    // Also check button classes that might indicate selection
    const allBtns = Array.from(main.querySelectorAll('button'));
    const selectedBtns = allBtns.filter(b =>
      b.className.includes('brand') ||
      b.className.includes('selected') ||
      b.className.includes('active') ||
      b.getAttribute('aria-pressed') === 'true'
    );
    return {
      selectedElements: selected.length,
      selectedButtons: selectedBtns.length,
      firstSelectedText: selectedBtns[0] ? selectedBtns[0].textContent.substring(0, 50) : null
    };
  });
  log('Q1 selected state in Tab 2:', JSON.stringify(q1Selected));
  await ss(tab2, 'fix5_tab2_q1_state');

  // Check if Tab 1 logged any flush when responding to SESSION_QUERY
  const allTab1Logs = [...tab1Logs];
  const respondedToQuery = allTab1Logs.some(l => l.includes('Responding to query from new tab'));
  const flushedAfterQuery = allTab1Logs.some(l => l.includes('Flushing') && tab1Logs.indexOf(l) > tab1Logs.findIndex(l2 => l2.includes('Responding')));

  log('Tab1 responded to SESSION_QUERY:', respondedToQuery);
  log('Tab1 flushed after responding:', flushedAfterQuery);

  // FIX-5 verdict
  if (q1Selected && (q1Selected.selectedElements > 0 || q1Selected.selectedButtons > 0)) {
    results.fix5_tab2_sees_q1_q3 = 'FIXED';
    results.fix5_detail = 'Tab 2 shows selected answer on Q1 after taking control from Tab 1';
  } else {
    // Check if the issue is the onSessionQuery not being wired
    if (respondedToQuery && !flushedAfterQuery) {
      results.fix5_tab2_sees_q1_q3 = 'INCOMPLETE';
      results.fix5_detail = 'Tab 1 responded to SESSION_QUERY but did NOT flush queue. onSessionQuery callback likely not wired in useTestSession.js';
    } else if (!respondedToQuery) {
      results.fix5_tab2_sees_q1_q3 = 'UNKNOWN';
      results.fix5_detail = 'Tab 1 did not log SESSION_QUERY response';
    } else {
      results.fix5_tab2_sees_q1_q3 = 'PARTIAL';
      results.fix5_detail = 'Tab 1 responded and flushed but Q1 answer not visible in Tab 2';
    }
  }

  results.session_flush_log = flushedAfterQuery ? 'Flush triggered after SESSION_QUERY' : 'No flush after SESSION_QUERY';

  await tab2.close();
  await browser.close();

  log('\n=== FIX-5 RESULTS ===');
  for (const [k, v] of Object.entries(results)) log(' ', k, ':', v);

  log('\nAll Tab1 logs:');
  for (const l of tab1Logs) log('  [TAB1]', l.substring(0, 200));

  return results;
}

run().then(r => {
  console.log('\n=== JSON ===');
  console.log(JSON.stringify(r, null, 2));
}).catch(e => console.error(e));
