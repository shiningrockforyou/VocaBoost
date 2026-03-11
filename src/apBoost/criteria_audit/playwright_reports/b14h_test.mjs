/**
 * B14-H: Realistic Simulation — Group Chat Student (student11@apboost.test)
 * Tests duplicate tab detection and session handoff with answer persistence.
 *
 * Flow:
 * 1. Login as student11
 * 2. Start Micro test (test_micro_full_1) in Tab 1, answer Q1-Q3
 * 3. Open same URL in Tab 2 — DuplicateTabModal should appear — click "Use This Tab"
 * 4. Answer Q4-Q6 in Tab 2
 * 5. Close Tab 2, go to Tab 1
 * 6. Tab 1 should show DuplicateTabModal — click "Use This Tab"
 * 7. Verify Q1-Q6 all present (no answer loss)
 * 8. Answer Q7-Q15, submit
 * 9. Verify report card shows all 15 answers
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_B14H';
const RESULTS_FILE = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14h_results.json';

const EMAIL = 'student11@apboost.test';
const PASSWORD = 'Student123!';
const TEST_ID = 'test_micro_full_1';
const BASE_URL = 'http://localhost:5173';

let screenshotCounter = 0;

async function screenshot(page, label) {
  screenshotCounter++;
  const filename = path.join(SCREENSHOTS_DIR, `${String(screenshotCounter).padStart(3, '0')}_${label}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`[Screenshot] ${filename}`);
  return filename;
}

async function getConsoleErrors(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

async function waitAndLog(ms, reason) {
  console.log(`[Wait] ${ms}ms — ${reason}`);
  await new Promise(r => setTimeout(r, ms));
}

const results = {
  batchId: 'B14-H',
  persona: 'The Group Chat Student (student11@apboost.test)',
  startedAt: new Date().toISOString(),
  steps: [],
  consoleErrors: [],
  findings: [],
};

function logStep(step, status, details = '') {
  const entry = { step, status, details, ts: new Date().toISOString() };
  results.steps.push(entry);
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : status === 'INFO' ? 'i' : '~';
  console.log(`[${icon}] ${step}: ${details}`);
}

async function run() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 200,
  });

  // We need a persistent context so BroadcastChannel works across pages in same browser
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  // Track console errors from all pages
  context.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('net::ERR')) {
        results.consoleErrors.push({ page: 'context', message: text, ts: new Date().toISOString() });
      }
    }
  });

  try {
    // ===== STEP 1: LOGIN =====
    console.log('\n=== STEP 1: Login as student11 ===');
    const page1 = await context.newPage();
    page1.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('net::ERR')) {
          results.consoleErrors.push({ page: 'tab1', message: text, ts: new Date().toISOString() });
        }
      }
    });

    await page1.goto(`${BASE_URL}/login`);
    await page1.waitForLoadState('networkidle');
    await screenshot(page1, 'login_page');
    logStep('Navigate to login', 'INFO', 'Login page loaded');

    // Fill login form
    const emailInput = await page1.$('input[type="email"], input[name="email"]');
    const passwordInput = await page1.$('input[type="password"], input[name="password"]');

    if (!emailInput || !passwordInput) {
      logStep('Login form', 'FAIL', 'Could not find email or password input');
      await screenshot(page1, 'login_form_not_found');
      throw new Error('Login form not found — BLOCKER');
    }

    await emailInput.fill(EMAIL);
    await passwordInput.fill(PASSWORD);
    await screenshot(page1, 'login_form_filled');

    const submitBtn = await page1.$('button[type="submit"], button:has-text("Log"), button:has-text("Sign")');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await passwordInput.press('Enter');
    }

    // Wait for navigation after login
    await page1.waitForTimeout(3000);
    await screenshot(page1, 'after_login');

    const currentUrl = page1.url();
    logStep('Login', currentUrl.includes('/login') ? 'FAIL' : 'PASS',
      `Redirected to: ${currentUrl}`);

    if (currentUrl.includes('/login')) {
      // Check if there's an error message
      const errorText = await page1.textContent('body').catch(() => '');
      logStep('Login error check', 'FAIL', 'Still on login page — login may have failed');
      results.findings.push({
        id: 'B14H-001',
        severity: 'Blocker',
        title: 'Login failed for student11@apboost.test',
        whatHappened: `After entering credentials and submitting, page remained at /login. Current URL: ${currentUrl}`,
        expected: 'Redirect to /ap dashboard',
      });
      await screenshot(page1, 'login_failed');
      // Try navigating directly to /ap to see if we need different approach
      await page1.goto(`${BASE_URL}/ap`);
      await page1.waitForTimeout(2000);
      const apUrl = page1.url();
      logStep('Direct /ap navigation after failed login', 'INFO', `URL: ${apUrl}`);
      if (apUrl.includes('/login')) {
        throw new Error('Login blocker — cannot proceed');
      }
    }

    // ===== STEP 2: Navigate to /ap dashboard =====
    console.log('\n=== STEP 2: Navigate to AP Dashboard ===');
    if (!page1.url().includes('/ap')) {
      await page1.goto(`${BASE_URL}/ap`);
      await page1.waitForTimeout(2000);
    }
    await screenshot(page1, 'ap_dashboard');
    logStep('AP Dashboard', 'INFO', `URL: ${page1.url()}`);

    // ===== STEP 3: Click Micro test =====
    console.log('\n=== STEP 3: Find and click Micro test ===');
    await page1.waitForTimeout(2000); // wait for cards to load

    // Find the Micro test card
    let microCard = null;
    const testCards = await page1.$$('[class*="card"], .cursor-pointer, button, a');

    // More targeted approach: look for test card with "Micro" in text
    const allText = await page1.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const found = [];
      elements.forEach(el => {
        if (el.textContent && el.textContent.includes('Microeconomics') && el.children.length < 5) {
          found.push({
            tag: el.tagName,
            class: el.className,
            text: el.textContent.trim().substring(0, 100)
          });
        }
      });
      return found.slice(0, 10);
    });
    console.log('Elements with "Microeconomics":', JSON.stringify(allText, null, 2));

    // Try clicking the Micro test
    try {
      await page1.click('text=AP Microeconomics', { timeout: 5000 });
      await page1.waitForTimeout(2000);
      await screenshot(page1, 'micro_test_clicked');
      logStep('Click Micro test card', 'PASS', `URL: ${page1.url()}`);
    } catch (e) {
      logStep('Click Micro test card', 'FAIL', `Error: ${e.message}`);
      // Try direct navigation to test
      await page1.goto(`${BASE_URL}/ap/test/${TEST_ID}`);
      await page1.waitForTimeout(2000);
      await screenshot(page1, 'direct_test_navigate');
      logStep('Direct test navigation', 'INFO', `URL: ${page1.url()}`);
    }

    // ===== STEP 4: Begin Test =====
    console.log('\n=== STEP 4: Begin Test ===');
    const testUrl = page1.url();

    // Check for instruction screen or begin button
    const beginBtn = await page1.$('button:has-text("Begin"), button:has-text("Start"), button:has-text("Take Test")');
    if (beginBtn) {
      await beginBtn.click();
      await page1.waitForTimeout(2000);
      await screenshot(page1, 'after_begin_test');
      logStep('Begin Test', 'PASS', `URL: ${page1.url()}`);
    } else {
      await screenshot(page1, 'no_begin_button');
      logStep('Begin Test button', 'INFO', 'No Begin button found — may already be in test or on instruction screen');

      // Check page content
      const pageText = await page1.evaluate(() => document.body.innerText.substring(0, 500));
      console.log('Page content:', pageText);
    }

    // Store the active test URL
    const activeTestUrl = page1.url();
    logStep('Active test URL', 'INFO', activeTestUrl);

    // ===== STEP 5: Answer Q1-Q3 in Tab 1 =====
    console.log('\n=== STEP 5: Answer Q1-Q3 in Tab 1 ===');

    for (let q = 1; q <= 3; q++) {
      await page1.waitForTimeout(1500);

      // Check if we're on a question
      const questionText = await page1.evaluate(() => {
        const qEl = document.querySelector('[class*="question"], h2, h3');
        return qEl ? qEl.textContent.trim().substring(0, 100) : 'no question found';
      });
      console.log(`Q${q} text:`, questionText);

      // Select answer A (first option)
      const answered = await page1.evaluate(() => {
        // Try to find answer choices and click first one
        const choices = document.querySelectorAll('[class*="choice"], [class*="answer"], [class*="option"], button[data-choice]');
        if (choices.length > 0) {
          choices[0].click();
          return { clicked: true, count: choices.length, text: choices[0].textContent.trim().substring(0, 50) };
        }

        // Try radio inputs
        const radios = document.querySelectorAll('input[type="radio"]');
        if (radios.length > 0) {
          radios[0].click();
          return { clicked: true, count: radios.length, type: 'radio' };
        }

        // Try buttons with A, B, C, D labels
        const allBtns = Array.from(document.querySelectorAll('button'));
        const choiceBtn = allBtns.find(b => /^[A-D]$/.test(b.textContent.trim()) || b.textContent.trim().startsWith('(A)'));
        if (choiceBtn) {
          choiceBtn.click();
          return { clicked: true, text: choiceBtn.textContent.trim() };
        }

        return { clicked: false, bodyPreview: document.body.innerText.substring(0, 200) };
      });

      console.log(`Q${q} answer attempt:`, JSON.stringify(answered));
      await page1.waitForTimeout(800);

      await screenshot(page1, `tab1_q${q}_answered`);
      logStep(`Tab1 Q${q} answer`, answered.clicked ? 'PASS' : 'FAIL',
        JSON.stringify(answered));

      // Click Next button (unless Q3 — we'll stay for screenshot)
      if (q < 3) {
        const nextClicked = await page1.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const next = btns.find(b => b.textContent.trim() === 'Next' || b.textContent.includes('Next'));
          if (next) { next.click(); return true; }
          return false;
        });
        logStep(`Tab1 Q${q} Next`, nextClicked ? 'PASS' : 'INFO', 'Clicked Next');
        await page1.waitForTimeout(500);
      }
    }

    // Take screenshot after Q3
    await screenshot(page1, 'tab1_after_q1_q2_q3');
    logStep('Tab1 Q1-Q3 answered', 'INFO', 'Three questions answered in Tab 1');

    // Get current URL to use for Tab 2
    const testPageUrl = page1.url();
    logStep('Test page URL for Tab 2', 'INFO', testPageUrl);

    // ===== STEP 6: Open Tab 2 with same URL =====
    console.log('\n=== STEP 6: Open Tab 2 with same test URL ===');
    const page2 = await context.newPage();
    page2.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error' && !text.includes('favicon') && !text.includes('net::ERR')) {
        results.consoleErrors.push({ page: 'tab2', message: text, ts: new Date().toISOString() });
      }
      if (msg.type() === 'log' && text.includes('DuplicateTab')) {
        console.log('[Tab2 BroadcastChannel]', text);
      }
    });

    await page2.goto(testPageUrl);
    logStep('Tab 2 opened', 'INFO', `Navigated to: ${testPageUrl}`);

    // Wait for the DuplicateTabModal to appear (up to 5 seconds)
    await page2.waitForTimeout(3000);
    await screenshot(page2, 'tab2_after_open');

    // Check if DuplicateTabModal is visible
    const duplicateModalInfo = await page2.evaluate(() => {
      const body = document.body.innerHTML;
      const hasModal = body.includes('Session Active Elsewhere') || body.includes('already open in another');
      const hasUseThisTab = body.includes('Use This Tab');
      const hasGoToDashboard = body.includes('Go to Dashboard');
      return {
        hasModal,
        hasUseThisTab,
        hasGoToDashboard,
        bodyPreview: document.body.innerText.substring(0, 300)
      };
    });

    console.log('Tab 2 Duplicate Modal check:', JSON.stringify(duplicateModalInfo, null, 2));

    if (duplicateModalInfo.hasModal) {
      logStep('DuplicateTabModal in Tab 2', 'PASS', 'Modal appeared with "Session Active Elsewhere"');
      await screenshot(page2, 'tab2_duplicate_modal');
    } else {
      logStep('DuplicateTabModal in Tab 2', 'FAIL', `Modal NOT found. Body: ${duplicateModalInfo.bodyPreview}`);
      results.findings.push({
        id: 'B14H-002',
        severity: 'High-Priority',
        title: 'DuplicateTabModal did not appear in Tab 2',
        whatHappened: `After opening same test URL in Tab 2, DuplicateTabModal was not shown. Tab 2 body: ${duplicateModalInfo.bodyPreview.substring(0, 200)}`,
        expected: 'DuplicateTabModal should appear blocking Tab 2 since Tab 1 is the active session',
      });
    }

    // ===== STEP 7: Click "Use This Tab" in Tab 2 =====
    console.log('\n=== STEP 7: Click "Use This Tab" in Tab 2 ===');

    const useThisTabClicked = await page2.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Use This Tab') || b.textContent.includes('Take Control'));
      if (btn) {
        btn.click();
        return { clicked: true, text: btn.textContent.trim() };
      }
      return { clicked: false };
    });

    logStep('Click "Use This Tab" in Tab 2', useThisTabClicked.clicked ? 'PASS' : 'FAIL',
      JSON.stringify(useThisTabClicked));

    await page2.waitForTimeout(2000);
    await screenshot(page2, 'tab2_after_take_control');

    // Verify Tab 2 now shows test content (not modal)
    const tab2AfterTakeover = await page2.evaluate(() => {
      const body = document.body.innerHTML;
      const hasModal = body.includes('Session Active Elsewhere');
      const hasQuestion = body.includes('Question') || body.includes('question');
      return { hasModal, hasQuestion, bodyPreview: document.body.innerText.substring(0, 200) };
    });

    logStep('Tab 2 after takeover', tab2AfterTakeover.hasModal ? 'FAIL' : 'PASS',
      `hasModal: ${tab2AfterTakeover.hasModal}, hasQuestion: ${tab2AfterTakeover.hasQuestion}`);

    // ===== STEP 8: Check Tab 1 — should now show DuplicateTabModal =====
    console.log('\n=== STEP 8: Check Tab 1 after Tab 2 took control ===');
    await page1.bringToFront();
    await page1.waitForTimeout(2000);
    await screenshot(page1, 'tab1_after_tab2_takeover');

    const tab1AfterTakeover = await page1.evaluate(() => {
      const body = document.body.innerHTML;
      const hasModal = body.includes('Session Active Elsewhere') || body.includes('already open in another');
      const hasUseThisTab = body.includes('Use This Tab');
      return {
        hasModal,
        hasUseThisTab,
        bodyPreview: document.body.innerText.substring(0, 300)
      };
    });

    console.log('Tab 1 after Tab 2 takeover:', JSON.stringify(tab1AfterTakeover, null, 2));

    if (tab1AfterTakeover.hasModal) {
      logStep('Tab 1 shows DuplicateTabModal after Tab 2 takeover', 'PASS',
        'Tab 1 correctly invalidated');
    } else {
      logStep('Tab 1 shows DuplicateTabModal after Tab 2 takeover', 'FAIL',
        `Modal NOT shown in Tab 1. Preview: ${tab1AfterTakeover.bodyPreview}`);
      results.findings.push({
        id: 'B14H-003',
        severity: 'High-Priority',
        title: 'Tab 1 not invalidated after Tab 2 takes control',
        whatHappened: `After Tab 2 clicked "Use This Tab", Tab 1 did not show DuplicateTabModal. Both tabs may be active simultaneously.`,
        expected: 'Tab 1 should show DuplicateTabModal with "Session Active Elsewhere" when another tab takes control',
      });
    }

    // ===== STEP 9: Answer Q4-Q6 in Tab 2 =====
    console.log('\n=== STEP 9: Answer Q4-Q6 in Tab 2 ===');
    await page2.bringToFront();

    // Navigate to Q4 — we need to advance from Q3
    // First check where we are in Tab 2
    const tab2CurrentQ = await page2.evaluate(() => {
      const text = document.body.innerText;
      const match = text.match(/Question\s+(\d+)/i);
      return match ? parseInt(match[1]) : null;
    });
    logStep('Tab 2 current question', 'INFO', `Current Q: ${tab2CurrentQ}`);

    // Navigate to Q4 if needed
    for (let q = (tab2CurrentQ || 1); q <= 3; q++) {
      const nextClicked = await page2.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const next = btns.find(b => b.textContent.trim() === 'Next' || b.textContent.includes('Next Question'));
        if (next && !next.disabled) { next.click(); return true; }
        return false;
      });
      await page2.waitForTimeout(800);
    }

    for (let q = 4; q <= 6; q++) {
      await page2.waitForTimeout(1000);

      // Check which question we're on
      const currentQ = await page2.evaluate(() => {
        const text = document.body.innerText;
        const match = text.match(/Question\s+(\d+)/i);
        return match ? parseInt(match[1]) : 'unknown';
      });
      console.log(`Tab2 currently on Q${currentQ}, targeting Q${q}`);

      // Select answer B (second option) for Q4-Q6
      const answered = await page2.evaluate(() => {
        const choices = document.querySelectorAll('[class*="choice"], [class*="answer"], [class*="option"]');
        if (choices.length > 1) {
          choices[1].click(); // Select second choice (B)
          return { clicked: true, count: choices.length, text: choices[1].textContent.trim().substring(0, 50) };
        }
        const radios = document.querySelectorAll('input[type="radio"]');
        if (radios.length > 1) {
          radios[1].click();
          return { clicked: true, count: radios.length, type: 'radio' };
        }
        // Select first if only one available
        if (choices.length > 0) {
          choices[0].click();
          return { clicked: true, count: choices.length, text: 'first only' };
        }
        return { clicked: false };
      });

      await page2.waitForTimeout(500);
      await screenshot(page2, `tab2_q${q}_answered`);
      logStep(`Tab2 Q${q} answer`, answered.clicked ? 'PASS' : 'FAIL', JSON.stringify(answered));

      if (q < 6) {
        await page2.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const next = btns.find(b => b.textContent.trim() === 'Next' || b.textContent.includes('Next Question'));
          if (next && !next.disabled) next.click();
        });
        await page2.waitForTimeout(500);
      }
    }

    await screenshot(page2, 'tab2_after_q4_q5_q6');
    logStep('Tab2 Q4-Q6 answered', 'INFO', 'Q4-Q6 answered in Tab 2');

    // ===== STEP 10: Close Tab 2, go to Tab 1 =====
    console.log('\n=== STEP 10: Close Tab 2 ===');
    await page2.close();
    logStep('Tab 2 closed', 'INFO', 'Closed Tab 2');
    await page1.waitForTimeout(2000);

    // ===== STEP 11: Tab 1 — DuplicateTabModal should appear (since Tab 2 was the active one) =====
    console.log('\n=== STEP 11: Check Tab 1 after Tab 2 closed ===');
    await page1.bringToFront();
    await page1.waitForTimeout(2000);
    await screenshot(page1, 'tab1_after_tab2_closed');

    const tab1AfterTab2Closed = await page1.evaluate(() => {
      const body = document.body.innerHTML;
      const hasModal = body.includes('Session Active Elsewhere') || body.includes('already open in another');
      const hasUseThisTab = body.includes('Use This Tab');
      return {
        hasModal,
        hasUseThisTab,
        bodyPreview: document.body.innerText.substring(0, 400)
      };
    });

    console.log('Tab 1 state after Tab 2 closed:', JSON.stringify(tab1AfterTab2Closed, null, 2));

    if (tab1AfterTab2Closed.hasModal) {
      logStep('Tab 1 shows DuplicateTabModal (Tab 2 closed)', 'PASS',
        'Modal still shown — user needs to click Use This Tab');
    } else {
      logStep('Tab 1 shows DuplicateTabModal (Tab 2 closed)', 'INFO',
        `Modal not shown — Tab 1 may have automatically recovered or never been invalidated. Preview: ${tab1AfterTab2Closed.bodyPreview.substring(0, 100)}`);
    }

    // ===== STEP 12: Click "Use This Tab" in Tab 1 (if modal shows) =====
    console.log('\n=== STEP 12: Click "Use This Tab" in Tab 1 ===');

    if (tab1AfterTab2Closed.hasModal || tab1AfterTakeover.hasModal) {
      const tab1UseThisTab = await page1.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent.includes('Use This Tab') || b.textContent.includes('Take Control'));
        if (btn) {
          btn.click();
          return { clicked: true, text: btn.textContent.trim() };
        }
        return { clicked: false };
      });

      logStep('Click "Use This Tab" in Tab 1', tab1UseThisTab.clicked ? 'PASS' : 'FAIL',
        JSON.stringify(tab1UseThisTab));
      await page1.waitForTimeout(2000);
      await screenshot(page1, 'tab1_after_use_this_tab');
    } else {
      logStep('Tab 1 "Use This Tab" click', 'INFO', 'Modal not shown, skipping click');
    }

    // ===== STEP 13: Verify Q1-Q6 all present in Tab 1 =====
    console.log('\n=== STEP 13: Verify Q1-Q6 answers present in Tab 1 ===');

    // Navigate through Q1-Q6 via navigator to check answers
    const answeredQs = await page1.evaluate(() => {
      // Check navigator grid state
      const navCells = document.querySelectorAll('[class*="navigator"] button, [class*="grid"] button[data-question]');
      const answeredCells = Array.from(navCells).filter(cell => {
        const cls = cell.className;
        return cls.includes('answered') || cls.includes('bg-brand') || cls.includes('bg-success');
      });

      return {
        navCellCount: navCells.length,
        answeredCount: answeredCells.length,
        cellClasses: Array.from(navCells).slice(0, 6).map(c => ({
          text: c.textContent.trim(),
          class: c.className
        }))
      };
    });

    console.log('Navigator state:', JSON.stringify(answeredQs, null, 2));

    // Also check via progress indicators
    const progressState = await page1.evaluate(() => {
      const text = document.body.innerText;
      const progressMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
      return {
        progressText: progressMatch ? progressMatch[0] : null,
        fullText: text.substring(0, 500)
      };
    });

    logStep('Verify Q1-Q6 answers in Tab 1', 'INFO',
      `Navigator: ${answeredQs.answeredCount} answered of ${answeredQs.navCellCount} cells. Progress: ${progressState.progressText}`);

    await screenshot(page1, 'tab1_verify_q1_q6');

    // ===== STEP 14: Answer Q7-Q15 in Tab 1 =====
    console.log('\n=== STEP 14: Answer Q7-Q15 in Tab 1 ===');

    // First navigate to Q7
    // Use navigator if available
    const navigatedToQ7 = await page1.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      // Look for navigator button for Q7
      const q7Btn = btns.find(b => b.textContent.trim() === '7');
      if (q7Btn) {
        q7Btn.click();
        return { clicked: true, method: 'navigator' };
      }
      return { clicked: false };
    });
    logStep('Navigate to Q7', 'INFO', JSON.stringify(navigatedToQ7));
    await page1.waitForTimeout(1000);

    // Answer Q7-Q15
    for (let q = 7; q <= 15; q++) {
      await page1.waitForTimeout(800);

      const currentQ = await page1.evaluate(() => {
        const text = document.body.innerText;
        const match = text.match(/Question\s+(\d+)/i);
        return match ? parseInt(match[1]) : 'unknown';
      });

      // Answer current question
      const answered = await page1.evaluate((targetQ) => {
        // Try choice buttons with specific patterns
        const choices = document.querySelectorAll('[class*="choice"]:not([disabled]), [class*="option"]:not([disabled])');
        if (choices.length > 0) {
          // Alternate between A and C for variety
          const idx = targetQ % 2 === 0 ? 0 : 2;
          const choice = choices[Math.min(idx, choices.length - 1)];
          choice.click();
          return { clicked: true, idx, text: choice.textContent.trim().substring(0, 30) };
        }

        const radios = document.querySelectorAll('input[type="radio"]');
        if (radios.length > 0) {
          const idx = targetQ % 2 === 0 ? 0 : Math.min(2, radios.length - 1);
          radios[idx].click();
          return { clicked: true, type: 'radio', idx };
        }

        return { clicked: false, bodyPreview: document.body.innerText.substring(200, 400) };
      }, q);

      await page1.waitForTimeout(400);
      logStep(`Tab1 Q${q} answer (on Q${currentQ})`, answered.clicked ? 'PASS' : 'INFO',
        JSON.stringify(answered));

      // Click Next (unless Q15)
      if (q < 15) {
        await page1.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const next = btns.find(b => (b.textContent.trim() === 'Next' || b.textContent.includes('Next Question')) && !b.disabled);
          if (next) next.click();
        });
        await page1.waitForTimeout(400);
      }
    }

    await screenshot(page1, 'tab1_after_q7_q15');
    logStep('Tab1 Q7-Q15 answered', 'INFO', 'All remaining questions answered');

    // ===== STEP 15: Submit Section 1 (MCQ) =====
    console.log('\n=== STEP 15: Navigate to Review and Submit ===');

    // Click Next on Q15 to get to review
    await page1.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const next = btns.find(b => (b.textContent.trim() === 'Next' || b.textContent.includes('Next')) && !b.disabled);
      if (next) next.click();
    });
    await page1.waitForTimeout(2000);
    await screenshot(page1, 'tab1_review_screen');

    // Check if we're on review screen
    const reviewState = await page1.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasReview: text.includes('Review') || text.includes('review'),
        hasSubmit: text.includes('Submit') && (text.includes('Section') || text.includes('MCQ')),
        text: text.substring(0, 400)
      };
    });

    logStep('Review screen check', reviewState.hasReview ? 'PASS' : 'INFO',
      `hasReview: ${reviewState.hasReview}, hasSubmit: ${reviewState.hasSubmit}`);

    // Click "Submit Section 1" button
    const submitSectionClicked = await page1.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submit = btns.find(b =>
        b.textContent.includes('Submit Section') ||
        b.textContent.includes('Submit MCQ') ||
        (b.textContent.includes('Submit') && b.textContent.includes('1'))
      );
      if (submit) {
        submit.click();
        return { clicked: true, text: submit.textContent.trim() };
      }
      return { clicked: false, available: btns.map(b => b.textContent.trim()).filter(t => t.length > 0) };
    });

    logStep('Submit Section 1', submitSectionClicked.clicked ? 'PASS' : 'INFO',
      JSON.stringify(submitSectionClicked));
    await page1.waitForTimeout(2000);
    await screenshot(page1, 'tab1_after_submit_section1');

    // Handle any confirmation dialog
    const confirmState = await page1.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasConfirm: text.includes('Are you sure') || text.includes('confirm') || text.includes('Confirm'),
        hasUnanswered: text.includes('unanswered'),
        text: text.substring(0, 300)
      };
    });

    if (confirmState.hasConfirm) {
      await page1.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const confirm = btns.find(b =>
          b.textContent.includes('Confirm') ||
          b.textContent.includes('Submit') ||
          b.textContent.includes('Yes')
        );
        if (confirm) confirm.click();
      });
      await page1.waitForTimeout(2000);
      await screenshot(page1, 'tab1_confirm_submit');
    }

    // Check for FRQ choice screen
    const frqState = await page1.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasFRQ: text.includes('Free Response') || text.includes('FRQ'),
        hasFRQChoice: text.includes('Choose') || text.includes('Topic'),
        text: text.substring(0, 400)
      };
    });

    logStep('FRQ/Choice Screen', 'INFO', JSON.stringify(frqState));
    await screenshot(page1, 'tab1_frq_choice_screen');

    // ===== STEP 16: Complete FRQ Section =====
    console.log('\n=== STEP 16: Complete FRQ Section ===');

    if (frqState.hasFRQChoice) {
      // Click first FRQ topic
      const topicClicked = await page1.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const topic = btns.find(b => b.textContent.length > 5 && !b.textContent.includes('Back') && !b.textContent.includes('Cancel'));
        if (topic) {
          topic.click();
          return { clicked: true, text: topic.textContent.trim().substring(0, 50) };
        }
        return { clicked: false };
      });
      logStep('FRQ topic selection', topicClicked.clicked ? 'PASS' : 'INFO', JSON.stringify(topicClicked));
      await page1.waitForTimeout(2000);
      await screenshot(page1, 'tab1_frq_topic_selected');
    }

    // Type FRQ answers in any text areas
    const textareas = await page1.$$('textarea');
    logStep('FRQ textareas found', 'INFO', `Count: ${textareas.length}`);

    for (let i = 0; i < Math.min(textareas.length, 5); i++) {
      await textareas[i].fill(`This is my FRQ answer for part ${i + 1}. The economic principles involved include supply and demand factors that affect market equilibrium.`);
      await page1.waitForTimeout(300);
    }

    if (textareas.length > 0) {
      await screenshot(page1, 'tab1_frq_answers_typed');
      logStep('FRQ answers typed', 'PASS', `Typed in ${textareas.length} textarea(s)`);
    }

    // Submit test
    const submitTestClicked = await page1.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submit = btns.find(b =>
        b.textContent.includes('Submit Test') ||
        b.textContent.includes('Finish Test') ||
        b.textContent.includes('Submit FRQ')
      );
      if (submit) {
        submit.click();
        return { clicked: true, text: submit.textContent.trim() };
      }
      return { clicked: false, available: btns.map(b => b.textContent.trim()).filter(t => t && t.length < 30) };
    });

    logStep('Submit Test', submitTestClicked.clicked ? 'PASS' : 'INFO',
      JSON.stringify(submitTestClicked));
    await page1.waitForTimeout(4000);
    await screenshot(page1, 'tab1_after_submit_test');

    // Handle confirmation
    const finalConfirm = await page1.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const confirm = btns.find(b => b.textContent.includes('Confirm') || b.textContent.includes('Yes'));
      if (confirm) {
        confirm.click();
        return { clicked: true, text: confirm.textContent.trim() };
      }
      return { clicked: false };
    });
    if (finalConfirm.clicked) {
      await page1.waitForTimeout(3000);
    }

    // ===== STEP 17: Verify Report Card =====
    console.log('\n=== STEP 17: Verify Report Card ===');
    await page1.waitForTimeout(3000);
    await screenshot(page1, 'tab1_report_card');

    const reportCard = await page1.evaluate(() => {
      const text = document.body.innerText;
      const url = window.location.href;
      return {
        url,
        hasResults: text.includes('Results') || text.includes('Score') || text.includes('Report'),
        hasMCQScore: text.includes('MCQ') || text.includes('Multiple Choice'),
        has15Questions: text.includes('15') || text.match(/\d+\/15/),
        text: text.substring(0, 600)
      };
    });

    logStep('Report Card', 'INFO', JSON.stringify({
      url: reportCard.url,
      hasResults: reportCard.hasResults,
      hasMCQScore: reportCard.hasMCQScore,
      has15Qs: !!reportCard.has15Questions
    }));

    if (reportCard.hasResults) {
      logStep('Report Card loaded', 'PASS', `URL: ${reportCard.url}`);
    } else {
      logStep('Report Card loaded', 'FAIL', `Not on results page. URL: ${reportCard.url}. Text: ${reportCard.text.substring(0, 200)}`);
    }

    // Final console error check
    console.log('\n=== Console Errors Collected ===');
    console.log(JSON.stringify(results.consoleErrors, null, 2));

    results.completedAt = new Date().toISOString();
    results.status = 'COMPLETE';

  } catch (error) {
    console.error('\n=== FATAL ERROR ===', error);
    results.fatalError = error.message;
    results.status = 'BLOCKED';
  } finally {
    // Save results
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log(`\n[Results saved to] ${RESULTS_FILE}`);

    await browser.close();
  }
}

run().catch(console.error);
