/**
 * B14-H v3: Complete submission test for Micro test (starting from existing session with Q1-Q15 answered)
 * This script handles the Review → Submit Section → FRQ → Submit Test flow correctly.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_B14H';
const RESULTS_FILE = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14h_results_v3.json';

const EMAIL = 'student11@apboost.test';
const PASSWORD = 'Student123!';
const TEST_ID = 'test_micro_full_1';
const BASE_URL = 'http://localhost:5173';

let screenshotCounter = 200;

async function screenshot(page, label) {
  screenshotCounter++;
  const filename = path.join(SCREENSHOTS_DIR, `${String(screenshotCounter).padStart(3, '0')}_v3_${label}.png`);
  try {
    await page.screenshot({ path: filename, fullPage: true });
    console.log(`[Screenshot] ${filename}`);
  } catch (e) {
    console.log(`[Screenshot FAILED] ${label}`);
  }
  return filename;
}

const results = {
  batchId: 'B14-H',
  version: 'v3-submit',
  startedAt: new Date().toISOString(),
  steps: [],
  consoleErrors: [],
  findings: [],
};

function logStep(step, status, details = '') {
  const entry = { step, status, details, ts: new Date().toISOString() };
  results.steps.push(entry);
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : 'i';
  console.log(`[${icon}] ${step}: ${details.substring(0, 200)}`);
  return entry;
}

async function clickAnswerChoice(page, choiceIndex = 0) {
  return await page.evaluate((idx) => {
    const allButtons = Array.from(document.querySelectorAll('button[type="button"]'));
    const choiceButtons = allButtons.filter(btn => {
      const text = btn.textContent.trim();
      return /^[A-Z]/.test(text) && text.length > 2 && text.length < 500 &&
        !text.includes('Flag') && !text.includes('Back') && !text.includes('Next') &&
        !text.includes('Review') && !text.includes('Submit') && !text.includes('Section');
    });
    if (choiceButtons.length === 0) {
      return { clicked: false };
    }
    const btn = choiceButtons[Math.min(idx, choiceButtons.length - 1)];
    btn.click();
    return { clicked: true, text: btn.textContent.trim().substring(0, 50), total: choiceButtons.length };
  }, choiceIndex);
}

async function clickNext(page) {
  return await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    // Look specifically for navigation next button (not choice buttons)
    const next = btns.find(b => {
      const t = b.textContent.trim();
      return (t === 'Next →' || t === '→' || (t.includes('Next') && !t.includes('Question'))) && !b.disabled;
    });
    if (next) { next.click(); return { clicked: true, text: next.textContent.trim() }; }
    return { clicked: false };
  });
}

async function getCurrentQ(page) {
  return await page.evaluate(() => {
    const text = document.body.innerText;
    const match = text.match(/Question\s+(\d+)\s+of\s+(\d+)/i);
    if (match) return { current: parseInt(match[1]), total: parseInt(match[2]) };
    return { current: null, total: null };
  });
}

async function getPageState(page) {
  return await page.evaluate(() => ({
    url: window.location.href,
    text: document.body.innerText.substring(0, 500),
    hasModal: document.body.innerText.includes('Session Active Elsewhere'),
    hasQuestion: /Question\s+\d+\s+of\s+\d+/i.test(document.body.innerText),
    isReview: document.body.innerText.includes('Review All') || document.body.innerText.includes('Question Review') || (document.body.innerText.includes('Review') && document.body.innerText.includes('Flag')),
    isFRQChoice: document.body.innerText.includes('Type Your Answers'),
    isFRQQuestion: document.body.innerText.includes('Section 2') && document.body.innerText.includes('Question'),
    isResults: window.location.href.includes('/results/'),
  }));
}

async function run() {
  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  context.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('favicon') && !text.includes('ERR_')) {
      results.consoleErrors.push({ message: text, ts: new Date().toISOString() });
    }
    if (text.includes('useDuplicateTabGuard') || text.includes('SESSION_')) {
      console.log('[BroadcastChannel]', text.substring(0, 100));
    }
  });

  const page1 = await context.newPage();

  try {
    // LOGIN
    await page1.goto(`${BASE_URL}/login`);
    await page1.waitForLoadState('networkidle');

    await page1.fill('input[type="email"]', EMAIL);
    await page1.fill('input[type="password"]', PASSWORD);
    await page1.$eval('button[type="submit"]', b => b.click()).catch(() => page1.press('input[type="password"]', 'Enter'));
    await page1.waitForTimeout(3000);
    logStep('Login', page1.url().includes('/login') ? 'FAIL' : 'PASS', `URL: ${page1.url()}`);

    if (!page1.url().includes('/ap')) {
      await page1.goto(`${BASE_URL}/ap`);
      await page1.waitForTimeout(2000);
    }
    await screenshot(page1, '01_ap_dashboard');

    // Navigate to test
    await page1.goto(`${BASE_URL}/ap/test/${TEST_ID}`);
    await page1.waitForTimeout(2000);
    await screenshot(page1, '02_instruction_screen');

    let state = await getPageState(page1);
    logStep('Instruction screen', 'INFO', state.text.substring(0, 150));

    // Click Resume/Begin
    const resumeClicked = await page1.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Resume') || b.textContent.includes('Begin') || b.textContent.includes('Start'));
      if (btn) { btn.click(); return btn.textContent.trim(); }
      return null;
    });
    logStep('Resume/Begin clicked', resumeClicked ? 'PASS' : 'FAIL', `Button: "${resumeClicked}"`);
    await page1.waitForTimeout(2000);
    await screenshot(page1, '03_after_begin');

    state = await getPageState(page1);
    logStep('After Begin', state.hasQuestion ? 'PASS' : 'INFO', state.text.substring(0, 150));

    // Navigate to current position and answer any unanswered questions
    // Since v2 already answered Q1-Q15, we just need to navigate to Review
    const qInfo = await getCurrentQ(page1);
    logStep('Current question', 'INFO', `Q${qInfo.current} of ${qInfo.total}`);

    // Check if Q1-Q3 answers are still present
    // Navigate to Q1 to verify
    const navToQ1 = await page1.evaluate(() => {
      // Try to find Q1 in navigator
      const allBtns = Array.from(document.querySelectorAll('button'));
      // Look for numbered button with text "1"
      const q1 = allBtns.find(b => b.textContent.trim() === '1');
      if (q1) { q1.click(); return 'clicked navigator Q1'; }
      return 'no navigator button for Q1';
    });
    logStep('Navigate to Q1', 'INFO', navToQ1);
    await page1.waitForTimeout(500);

    const q1State = await page1.evaluate(() => {
      const text = document.body.innerText;
      const isQ1 = text.includes('Question 1') || text.includes('production possibilities');
      const selectedBtns = Array.from(document.querySelectorAll('button')).filter(b =>
        b.className.includes('bg-brand-primary')
      );
      return {
        isQ1,
        hasSelectedAnswer: selectedBtns.length > 0,
        selectedText: selectedBtns.map(b => b.textContent.trim().substring(0, 40)),
        preview: text.substring(0, 200)
      };
    });
    logStep('Q1 answer preserved', q1State.hasSelectedAnswer ? 'PASS' : 'FAIL',
      JSON.stringify({ hasAnswer: q1State.hasSelectedAnswer, selected: q1State.selectedText }));
    await screenshot(page1, '04_q1_answer_check');

    // Answer any remaining unanswered questions
    // Navigate through all 15 and answer if not answered
    let answeredCount = 0;
    for (let q = 1; q <= 15; q++) {
      const qState = await page1.evaluate((targetQ) => {
        const text = document.body.innerText;
        const qMatch = text.match(/Question\s+(\d+)/i);
        const currentQ = qMatch ? parseInt(qMatch[1]) : null;
        const selectedBtns = Array.from(document.querySelectorAll('button')).filter(b =>
          b.className.includes('bg-brand-primary')
        );
        return { currentQ, hasAnswer: selectedBtns.length > 0 };
      }, q);

      if (!qState.hasAnswer) {
        // Need to answer this question
        const answered = await clickAnswerChoice(page1, q % 4);
        if (answered.clicked) answeredCount++;
        await page1.waitForTimeout(300);
      }

      // Navigate next (unless last question)
      if (q < 15) {
        await clickNext(page1);
        await page1.waitForTimeout(400);
      }
    }
    logStep('Additional answers', 'INFO', `Answered ${answeredCount} previously unanswered questions`);
    await screenshot(page1, '05_q15_state');

    // Now click "Review →" button on Q15
    const reviewBtnClicked = await page1.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const review = btns.find(b => b.textContent.includes('Review'));
      if (review) { review.click(); return { clicked: true, text: review.textContent.trim() }; }
      return { clicked: false, available: btns.map(b => b.textContent.trim()).filter(t => t).slice(0, 10) };
    });
    logStep('Click Review →', reviewBtnClicked.clicked ? 'PASS' : 'FAIL', JSON.stringify(reviewBtnClicked));
    await page1.waitForTimeout(2000);
    await screenshot(page1, '06_review_screen');

    state = await getPageState(page1);
    logStep('Review screen state', state.isReview ? 'PASS' : 'INFO', state.text.substring(0, 200));

    // Check review screen details
    const reviewDetails = await page1.evaluate(() => {
      const text = document.body.innerText;
      return {
        answeredCount: (text.match(/Answered/gi) || []).length,
        flaggedCount: (text.match(/Flagged/gi) || []).length,
        hasSubmitBtn: text.includes('Submit Section') || text.includes('Submit All'),
        questionRows: (text.match(/Question \d+/g) || []).length,
        preview: text.substring(0, 600)
      };
    });
    logStep('Review screen details', 'INFO', JSON.stringify(reviewDetails));

    // Submit Section
    const submitSectionResult = await page1.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      // Look for Submit Section button
      const submit = btns.find(b => {
        const t = b.textContent.trim();
        return t.includes('Submit Section') || t.includes('Submit All') ||
          (t.includes('Submit') && !t.includes('Test') && !t.includes('FRQ'));
      });
      if (submit) { submit.click(); return { clicked: true, text: submit.textContent.trim() }; }
      return {
        clicked: false,
        available: btns.map(b => b.textContent.trim()).filter(t => t && t.length < 30 && t.length > 0).slice(0, 20)
      };
    });
    logStep('Submit Section', submitSectionResult.clicked ? 'PASS' : 'FAIL', JSON.stringify(submitSectionResult));
    await page1.waitForTimeout(2000);
    await screenshot(page1, '07_after_submit_section');

    state = await getPageState(page1);
    logStep('After Submit Section', 'INFO', state.text.substring(0, 200));

    // Handle confirmation dialog if any
    if (state.text.includes('confirm') || state.text.includes('Are you sure') || state.text.includes('Unanswered')) {
      const confirmResult = await page1.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const confirm = btns.find(b =>
          b.textContent.includes('Confirm') ||
          b.textContent.includes('Submit Anyway') ||
          b.textContent.includes('Submit Section')
        );
        if (confirm) { confirm.click(); return { confirmed: true, text: confirm.textContent.trim() }; }
        return { confirmed: false };
      });
      logStep('Confirm submission', confirmResult.confirmed ? 'PASS' : 'INFO', JSON.stringify(confirmResult));
      await page1.waitForTimeout(3000);
      await screenshot(page1, '08_confirmation_handled');
    }

    state = await getPageState(page1);
    logStep('After Section 1 submit', 'INFO', `URL: ${state.url}, FRQChoice: ${state.isFRQChoice}`);

    // FRQ Choice screen
    if (state.isFRQChoice) {
      logStep('FRQ Choice screen', 'PASS', 'Choice screen appeared');
      await screenshot(page1, '09_frq_choice_screen');

      const typeAnswersClicked = await page1.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent.includes('Type Your Answers') || b.textContent.includes('Type'));
        if (btn) { btn.click(); return { clicked: true, text: btn.textContent.trim() }; }
        return { clicked: false };
      });
      logStep('Select Type Your Answers', typeAnswersClicked.clicked ? 'PASS' : 'FAIL',
        JSON.stringify(typeAnswersClicked));
      await page1.waitForTimeout(2000);
      await screenshot(page1, '10_frq_typed_mode');
    } else {
      logStep('FRQ Choice screen', 'FAIL', `Not shown. State: ${state.text.substring(0, 200)}`);
    }

    // FRQ Questions
    await page1.waitForTimeout(1000);
    state = await getPageState(page1);
    logStep('FRQ section state', 'INFO', `hasQ: ${state.hasQuestion}, text: ${state.text.substring(0, 150)}`);

    // Type FRQ answers
    let frqAnswered = 0;
    const maxFRQPages = 10; // Safety limit

    for (let attempt = 0; attempt < maxFRQPages; attempt++) {
      const textareas = await page1.$$('textarea');
      if (textareas.length > 0) {
        for (let i = 0; i < textareas.length; i++) {
          const currentVal = await textareas[i].evaluate(el => el.value);
          if (!currentVal) {
            await textareas[i].fill(`FRQ Answer: The economic principle demonstrated here involves market equilibrium theory and the relationship between price, supply, and demand in competitive markets. Multiple factors including elasticity and consumer surplus affect the outcome.`);
            frqAnswered++;
            await page1.waitForTimeout(300);
          }
        }
      }

      // Check for Submit FRQ or Submit Test button
      const submitFRQResult = await page1.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const submit = btns.find(b => {
          const t = b.textContent.trim();
          return t.includes('Submit Test') || t.includes('Submit FRQ') || t.includes('Finish');
        });
        if (submit) { submit.click(); return { clicked: true, text: submit.textContent.trim() }; }

        // Try Next to advance
        const next = btns.find(b => {
          const t = b.textContent.trim();
          return (t === 'Next →' || t.includes('Next Question') || t.includes('Next Part')) && !b.disabled;
        });
        if (next) { next.click(); return { advanced: true, text: next.textContent.trim() }; }

        return { clicked: false, advanced: false };
      });

      if (submitFRQResult.clicked) {
        logStep('Submit FRQ/Test', 'PASS', JSON.stringify(submitFRQResult));
        await page1.waitForTimeout(3000);
        break;
      } else if (submitFRQResult.advanced) {
        logStep(`FRQ advance ${attempt + 1}`, 'INFO', JSON.stringify(submitFRQResult));
        await page1.waitForTimeout(1000);
        await screenshot(page1, `11_frq_advance_${attempt + 1}`);
      } else {
        logStep(`FRQ loop ${attempt + 1}`, 'INFO', 'No submit or next button found');
        await screenshot(page1, `12_frq_stuck_${attempt + 1}`);

        // Try the Review button if present
        const reviewOrSubmit = await page1.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const r = btns.find(b => b.textContent.includes('Review') || b.textContent.includes('Submit'));
          if (r) { r.click(); return r.textContent.trim(); }
          return null;
        });
        logStep('FRQ fallback click', 'INFO', `Clicked: ${reviewOrSubmit}`);
        await page1.waitForTimeout(2000);
        break;
      }
    }

    logStep('FRQ answers typed', 'INFO', `${frqAnswered} FRQ textarea(s) filled`);
    await screenshot(page1, '13_after_frq_submit');

    // Handle final confirmation
    await page1.waitForTimeout(2000);
    state = await getPageState(page1);

    if (!state.isResults) {
      const finalSubmit = await page1.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const submit = btns.find(b =>
          b.textContent.includes('Confirm') ||
          b.textContent.includes('Submit Test') ||
          b.textContent.includes('Finish Test')
        );
        if (submit) { submit.click(); return submit.textContent.trim(); }
        return null;
      });
      if (finalSubmit) {
        logStep('Final submit/confirm', 'INFO', `Clicked: "${finalSubmit}"`);
        await page1.waitForTimeout(5000);
      }
    }

    await screenshot(page1, '14_final_state');
    state = await getPageState(page1);
    logStep('Final state', state.isResults ? 'PASS' : 'FAIL',
      `URL: ${state.url}, isResults: ${state.isResults}`);

    if (state.isResults) {
      // Verify report card content
      const reportCardContent = await page1.evaluate(() => {
        const text = document.body.innerText;
        return {
          hasScore: text.includes('Score') || text.includes('%'),
          hasMCQSection: text.includes('MCQ') || text.includes('Multiple Choice'),
          hasFRQSection: text.includes('FRQ') || text.includes('Free Response'),
          questionRows: (text.match(/\d+\s*[\.\)]/g) || []).length,
          scoreText: text.match(/\d+\s*\/\s*\d+/)?.[0] || null,
          preview: text.substring(0, 800)
        };
      });
      logStep('Report Card content', 'PASS', JSON.stringify(reportCardContent));
      await screenshot(page1, '15_report_card');

      results.findings.push({
        id: 'B14H-SUCCESS-001',
        severity: 'INFO',
        title: 'Full test submission successful after tab handoff',
        whatHappened: `Test submitted successfully. Report card loaded at ${state.url}. Score: ${reportCardContent.scoreText || 'pending FRQ'}.`,
        expected: 'Report card with MCQ score, pending FRQ section, AP score projection.'
      });
    }

    // Summary
    console.log('\n=== CONSOLE ERRORS ===');
    console.log(JSON.stringify(results.consoleErrors, null, 2));

    results.status = 'COMPLETE';
    results.completedAt = new Date().toISOString();

  } catch (error) {
    console.error('\n=== FATAL ERROR ===', error.message);
    results.fatalError = error.message;
    results.status = 'PARTIAL';
    try { await screenshot(page1, '99_error'); } catch (e) { }
  } finally {
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log(`[Results saved] ${RESULTS_FILE}`);
    await browser.close();
  }
}

run().catch(console.error);
