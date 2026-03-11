/**
 * B14-D: The Confused One — Playwright test script v7 (FINAL)
 * Handles DuplicateTabModal, disabled textarea, full flow
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5173';
const EMAIL = 'student7@apboost.test';
const PASSWORD = 'Student123!';
const SCREENSHOT_DIR = path.join(__dirname, '../criteria_audit/playwright_reports/screenshots_b14d');
const RESULTS_FILE = path.join(__dirname, '../criteria_audit/playwright_reports/b14d_results.json');

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = {
  loginStatus: 'pending',
  mcqCompletion: 'pending',
  frqChoiceScreenObservations: {},
  frqTopicSwitch: 'not_tested',
  frqTypingDeleteRetype: 'pending',
  frqPartialSubmit: 'pending',
  reportCardStatus: 'pending',
  consoleErrors: [],
  findings: [],
  screenshots: [],
  testUrl: null,
  resultUrl: null,
  stepLog: []
};

let screenshotCounter = 0;
function log(msg) { console.log(msg); results.stepLog.push(msg); }

async function takeScreenshot(page, name) {
  const filename = `${String(screenshotCounter++).padStart(2, '0')}_${name}.png`;
  try {
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: true });
    results.screenshots.push(filename);
    log(`Screenshot: ${filename}`);
  } catch (e) { log(`Screenshot fail: ${name}`); }
  return filename;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function getBodyText(page) { try { return await page.innerText('body'); } catch { return ''; } }

async function getCurrentView(page) {
  const t = await getBodyText(page);
  const url = page.url();
  if (url.includes('/results')) return 'results';
  if (t.match(/session active elsewhere|open in another.*tab|duplicate.*tab/i)) return 'duplicate_tab';
  if (t.match(/review your answers/i)) return 'mcq_review';
  if (t.match(/choose how you.d like|type your answers.*write by hand|write by hand.*type your answers/i)) return 'frq_type_choice';
  if (t.match(/choose.*question.*topic|which.*frq.*question.*would you|select.*free response.*question/i)) return 'frq_question_choice';
  if (t.match(/section 2.*free response/i) && t.match(/question \d+ of \d+/i)) return 'frq_question';
  if (t.match(/section 1.*multiple choice/i) && t.match(/question \d+ of \d+/i)) return 'mcq_question';
  if (t.match(/something went wrong|error boundary/i)) return 'error_boundary';
  if (t.match(/submitting|processing test/i)) return 'submitting';
  if (t.match(/begin test|resume test/i)) return 'instruction';
  return 'unknown';
}

async function clickMcqAnswerA(page) {
  return await page.evaluate(() => {
    const btns = document.querySelectorAll('button[type="button"]');
    for (const btn of btns) {
      if (btn.disabled) continue;
      for (const span of btn.querySelectorAll('span')) {
        if (span.textContent?.trim() === 'A') {
          btn.click();
          return { clicked: true, text: btn.textContent?.trim().substring(0, 50) };
        }
      }
    }
    return { clicked: false };
  });
}

async function clickBtn(page, pattern) {
  return await page.evaluate((p) => {
    const re = new RegExp(p, 'i');
    const btns = Array.from(document.querySelectorAll('button'));
    for (const btn of btns) {
      if (btn.disabled || !btn.getBoundingClientRect().width) continue;
      if (re.test(btn.textContent?.trim())) {
        btn.click();
        return { clicked: true, text: btn.textContent?.trim().substring(0, 50) };
      }
    }
    return { clicked: false };
  }, pattern);
}

async function handleDuplicateTabModal(page) {
  const view = await getCurrentView(page);
  if (view === 'duplicate_tab') {
    log('DuplicateTabModal detected — clicking "Use This Tab"');
    const res = await clickBtn(page, 'use this tab');
    if (res.clicked) {
      log('Clicked "Use This Tab"');
      await sleep(2000);
      return true;
    }
    log('WARNING: Could not click "Use This Tab"');
    return false;
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleMessages = [];
  page.on('console', msg => {
    const e = { type: msg.type(), text: msg.text(), url: page.url() };
    consoleMessages.push(e);
    if (e.type === 'error') results.consoleErrors.push(e);
  });
  page.on('pageerror', err => { results.consoleErrors.push({ type: 'pageerror', text: err.message }); });

  try {
    // ===== STEP 1: LOGIN =====
    log('--- STEP 1: Login ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
    await takeScreenshot(page, 'login');
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('input[type="password"]').press('Enter');
    try { await page.waitForURL(u => !u.includes('/login'), { timeout: 10000 }); } catch {}
    await sleep(3000);

    const loginUrl = page.url();
    log(`Login URL: ${loginUrl}`);
    await takeScreenshot(page, 'after_login');
    if (loginUrl.includes('/login')) throw new Error('Login failed');
    results.loginStatus = 'success';
    if (!loginUrl.includes('/ap')) results.findings.push({ type: 'observation', id: 'B4-006', message: `Redirects to ${loginUrl}` });

    // Navigate to test
    const testUrl = `${BASE_URL}/ap/test/test_micro_full_1`;
    results.testUrl = testUrl;
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    for (let i = 0; i < 8; i++) { await sleep(1000); if (!page.url().includes('/login')) break; }
    await takeScreenshot(page, 'test_page');
    log(`Test URL: ${page.url()}`);

    // ===== STEP 2: INSTRUCTION SCREEN =====
    log('--- STEP 2: Start ---');
    await sleep(1000);
    await takeScreenshot(page, 'instruction');

    // Handle duplicate tab modal if present from previous test run
    await handleDuplicateTabModal(page);

    const resumeRes = await clickBtn(page, 'resume test');
    const beginRes = resumeRes.clicked ? resumeRes : await clickBtn(page, 'begin test');

    if (resumeRes.clicked) {
      log('Clicked Resume Test (existing session)');
      results.findings.push({ type: 'info', message: 'student7 has existing session — resuming' });
    } else if (beginRes.clicked) {
      log('Clicked Begin Test');
    } else {
      log('WARNING: No begin/resume button');
      results.findings.push({ type: 'finding', severity: 'high', message: 'No begin/resume button found' });
    }

    await sleep(3000);
    await handleDuplicateTabModal(page);

    let view = await getCurrentView(page);
    log(`After start: ${view}`);
    await takeScreenshot(page, 'after_start');

    // ===== STEP 3: MCQ =====
    log('--- STEP 3: MCQ (3-5s per Q) ---');
    let mcqAnswered = 0;

    for (let q = 1; q <= 25; q++) {
      await sleep(3000 + Math.random() * 2000);
      await handleDuplicateTabModal(page);
      view = await getCurrentView(page);
      log(`Q${q}: ${view}`);

      if (view === 'mcq_review') { log('Review reached'); await takeScreenshot(page, 'mcq_review'); break; }
      if (!['mcq_question', 'unknown'].includes(view)) { log(`MCQ break: ${view}`); break; }

      const res = await clickMcqAnswerA(page);
      if (res.clicked) { mcqAnswered++; log(`Q${q}: A — "${res.text}"`); }
      else {
        // Try B if A not found (already selected or not available)
        const resB = await page.evaluate(() => {
          const btns = document.querySelectorAll('button[type="button"]');
          for (const btn of btns) {
            if (btn.disabled) continue;
            for (const span of btn.querySelectorAll('span')) {
              if (span.textContent?.trim() === 'B') { btn.click(); return { clicked: true, text: btn.textContent?.trim().substring(0, 40) }; }
            }
          }
          return { clicked: false };
        });
        if (resB.clicked) { mcqAnswered++; log(`Q${q}: B — "${resB.text}"`); }
        else log(`Q${q}: no answer`);
      }

      const navRes = await page.evaluate(() => {
        for (const label of ['Next →', 'Next', 'Review →', 'Review & Submit']) {
          const btn = Array.from(document.querySelectorAll('button')).find(b =>
            b.textContent?.trim() === label && !b.disabled && b.getBoundingClientRect().width > 0
          );
          if (btn) { btn.click(); return label; }
        }
        return null;
      });
      if (navRes) log(`Q${q}: nav "${navRes}"`);
    }

    results.mcqCompletion = `answered_${mcqAnswered}`;
    log(`MCQ: ${mcqAnswered}`);
    await takeScreenshot(page, 'mcq_done');

    // ===== STEP 4: MCQ SUBMIT =====
    log('--- STEP 4: MCQ Submit ---');

    view = await getCurrentView(page);
    if (view === 'mcq_question') {
      await clickBtn(page, 'review');
      await sleep(2000);
    }

    await takeScreenshot(page, 'mcq_review_screen');

    for (let att = 0; att < 5; att++) {
      await handleDuplicateTabModal(page);
      const res = await clickBtn(page, 'submit section');
      if (res.clicked) {
        log(`Submit Section: "${res.text}"`);
        await sleep(2000);
        await takeScreenshot(page, 'section_submit_clicked');
        await sleep(500);
        const cfm = await page.evaluate(() => {
          const patterns = [/^confirm$/i, /^yes$/i, /yes.*submit/i];
          const btn = Array.from(document.querySelectorAll('button')).find(b =>
            !b.disabled && b.getBoundingClientRect().width > 0 && patterns.some(p => p.test(b.textContent?.trim()))
          );
          if (btn) { btn.click(); return btn.textContent?.trim(); }
          return null;
        });
        if (cfm) { log(`Confirmed: "${cfm}"`); await sleep(4000); }
        break;
      }
      await sleep(1500);
    }

    await sleep(3000);
    await handleDuplicateTabModal(page);
    view = await getCurrentView(page);
    log(`After MCQ submit: ${view}`);
    await takeScreenshot(page, 'post_mcq_submit');

    // ===== STEP 5: FRQ SECTION =====
    log('--- STEP 5: FRQ Section ---');
    await sleep(2000);
    await handleDuplicateTabModal(page);
    view = await getCurrentView(page);
    log(`FRQ view: ${view}`);
    await takeScreenshot(page, 'frq_entry');

    const frqPageText = await getBodyText(page);
    log(`FRQ text: "${frqPageText.substring(0, 400)}"`);

    // Check FRQ submission type choice
    if (view === 'frq_type_choice') {
      log('FRQ type choice screen — testing confused user behavior');

      // Get the two choice buttons
      const typeChoiceBtns = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button')).filter(b => {
          const rect = b.getBoundingClientRect();
          return rect.width > 100 && rect.height > 50 && !b.disabled;
        }).map((b, i) => ({ idx: i, text: b.textContent?.trim().substring(0, 80), h: Math.round(b.getBoundingClientRect().height) }));
      });
      log(`FRQ type choice buttons: ${JSON.stringify(typeChoiceBtns)}`);

      results.frqChoiceScreenObservations = {
        screen: 'frq_type_choice',
        buttonCount: typeChoiceBtns.length,
        buttons: typeChoiceBtns.map(b => b.text.substring(0, 40))
      };

      if (typeChoiceBtns.length >= 2) {
        // CONFUSED ONE: click first choice (Type), read 5s, try to go back
        const firstBtn = typeChoiceBtns[0];
        log(`Clicking first choice [${firstBtn.idx}]: "${firstBtn.text.substring(0, 40)}"`);
        await page.evaluate(idx => {
          const allBtns = Array.from(document.querySelectorAll('button')).filter(b => {
            const rect = b.getBoundingClientRect();
            return rect.width > 100 && rect.height > 50 && !b.disabled;
          });
          allBtns[0]?.click();
        });
        await sleep(1000);
        await takeScreenshot(page, 'frq_type_clicked');

        // Read for 5 seconds
        log('User reading FRQ type choice for 5 seconds...');
        await sleep(5000);
        await takeScreenshot(page, 'frq_type_after_5s');

        const afterClickView = await getCurrentView(page);
        log(`After type click: ${afterClickView}`);

        // Dismiss duplicate tab modal if appeared
        const hadDup = await handleDuplicateTabModal(page);
        if (hadDup) {
          results.findings.push({
            type: 'finding',
            severity: 'high',
            id: 'B14D-DUP-TAB',
            message: 'DuplicateTabModal appeared on FRQ question screen when typing session started. This blocks all FRQ interaction (textarea disabled, buttons disabled). Previous session token conflict from multiple test runs.',
            note: 'This finding is partially an artifact of running the test multiple times. However, any real student who returns to a test URL in the same browser session will see this modal, and the confused user pattern specifically involves navigating around.'
          });
          await sleep(1000);
        }

        // Check for back button
        const btnsNow = await page.evaluate(() =>
          Array.from(document.querySelectorAll('button')).filter(b => b.getBoundingClientRect().width > 0).map((b, i) => ({
            idx: i, text: b.textContent?.trim().substring(0, 60), disabled: b.disabled
          }))
        );
        log(`Buttons after type click (after handling dup): ${JSON.stringify(btnsNow)}`);

        const backBtn = btnsNow.find(b => !b.disabled && b.text.match(/back|cancel|change|return|choose.*again|different/i));

        if (backBtn) {
          log(`Back button: [${backBtn.idx}] "${backBtn.text}"`);
          results.frqChoiceScreenObservations.backButtonPresent = true;
          results.frqChoiceScreenObservations.backButtonText = backBtn.text;
          await page.evaluate(idx => { document.querySelectorAll('button')[idx]?.click(); }, backBtn.idx);
          await sleep(2000);
          await takeScreenshot(page, 'after_frq_back');
          const afterBackView = await getCurrentView(page);
          log(`After back: ${afterBackView}`);
          results.frqTopicSwitch = `back_found_${backBtn.text}_returned_to_${afterBackView}`;
          if (afterBackView === 'frq_type_choice') {
            log('PASS: Can navigate back to FRQ type choice');
            // Now select Type to proceed
            await page.evaluate(() => {
              const allBtns = Array.from(document.querySelectorAll('button')).filter(b => {
                const rect = b.getBoundingClientRect();
                return rect.width > 100 && rect.height > 50 && !b.disabled;
              });
              allBtns[0]?.click();
            });
            await sleep(1000);
            results.frqTopicSwitch = 'PASS_back_and_reselect_works';
          }
        } else {
          // No back button
          results.frqChoiceScreenObservations.backButtonPresent = false;
          const movedOn = ['frq_question', 'frq_question_choice'].includes(afterClickView);
          if (movedOn) {
            results.frqTopicSwitch = 'PARTIAL_no_back_type_is_final';
            results.findings.push({
              type: 'finding',
              severity: 'low',
              id: 'B14D-001',
              message: 'FRQ submission type selection ("Type Your Answers" / "Write by Hand") is immediately final. After clicking, the user moves to the FRQ question with no back button to change the submission mode. For the confused student who clicks the wrong type, there is no way to switch without completely navigating away from the test and losing their place.'
            });
          } else if (afterClickView === 'frq_type_choice') {
            results.frqTopicSwitch = 'PASS_still_on_choice_can_reclick';
            results.findings.push({ type: 'info', message: 'FRQ type choice: clicking a card keeps you on the choice screen (no immediate navigation). Can freely change selection.' });
          }
          log(`FRQ type switch: ${results.frqTopicSwitch}`);
        }
      }
    }

    // Handle duplicate tab modal that may appear
    await handleDuplicateTabModal(page);
    await sleep(2000);

    view = await getCurrentView(page);
    log(`Current view: ${view}`);
    await takeScreenshot(page, 'pre_frq_typing');

    // ===== STEP 6: FRQ TYPING =====
    log('--- STEP 6: FRQ Typing ---');

    // Handle any lingering duplicate tab modal
    let handled = await handleDuplicateTabModal(page);
    if (handled) await sleep(1000);

    const frqTA = page.locator('textarea:not([disabled])').first();
    const taVis = await frqTA.isVisible({ timeout: 5000 }).catch(() => false);
    log(`FRQ textarea (enabled): ${taVis}`);

    // If disabled textarea visible, try "Use This Tab" again
    const disabledTA = page.locator('textarea[disabled]').first();
    const disabledVisible = await disabledTA.isVisible({ timeout: 1000 }).catch(() => false);
    if (disabledVisible) {
      log('Disabled textarea found — session conflict. Handling...');
      results.findings.push({
        type: 'finding',
        severity: 'high',
        id: 'B14D-DUP-002',
        message: 'FRQ textarea is disabled due to DuplicateTabModal/session conflict. The confused user who navigated multiple pages or the automated test running multiple times triggers session conflicts that disable all FRQ inputs.',
        details: 'This is a real UX issue for real students: if a student has the test open in two tabs and tries to use one, all inputs on the FRQ screen are disabled until they click "Use This Tab".'
      });

      // Try to take control
      const useThisTab = await clickBtn(page, 'use this tab');
      if (useThisTab.clicked) {
        log('"Use This Tab" clicked — re-enabling session');
        await sleep(2000);
      }
    }

    // Re-check for enabled textarea
    const frqTA2 = page.locator('textarea').first();
    const ta2Vis = await frqTA2.isVisible({ timeout: 3000 }).catch(() => false);
    const ta2Disabled = ta2Vis ? await frqTA2.evaluate(el => el.disabled) : true;
    log(`Textarea: visible=${ta2Vis}, disabled=${ta2Disabled}`);

    if (ta2Vis && !ta2Disabled) {
      const initial = 'The law of supply and demand states that as price increases, quantity demanded falls because consumers seek substitutes. For instance, if beef prices rise, consumers switch to chicken or pork as cheaper protein sources. This illustrates the inverse price-quantity relationship in competitive markets.';
      await frqTA2.click();
      await frqTA2.fill(initial);
      await sleep(500);
      await takeScreenshot(page, 'frq_typed_initial');

      const typedLen = await frqTA2.evaluate(el => el.value.length);
      log(`Typed: ${typedLen} chars`);

      // DELETE HALF
      const mid = Math.floor(typedLen / 2);
      await frqTA2.evaluate((el, p) => el.setSelectionRange(p, el.value.length), mid);
      await frqTA2.press('Delete');
      await sleep(400);
      const afterDelLen = await frqTA2.evaluate(el => el.value.length);
      log(`After delete: ${afterDelLen} (deleted ${typedLen - afterDelLen})`);
      await takeScreenshot(page, 'frq_after_delete');

      // RETYPE with INCOMPLETE SENTENCE
      const retyped = ' However, price elasticity differs. I think the answer involves';
      await frqTA2.type(retyped, { delay: 40 });
      await sleep(400);

      const finalLen = await frqTA2.evaluate(el => el.value.length);
      const finalVal = await frqTA2.evaluate(el => el.value);
      log(`Final: ${finalLen} chars — "${finalVal.substring(0, 200)}"`);
      await takeScreenshot(page, 'frq_final_answer');

      const isIncomplete = finalVal.trim().endsWith('involves');
      log(`Ends incomplete: ${isIncomplete}`);

      // Verify persistence
      await sleep(1000);
      const persistedLen = await frqTA2.evaluate(el => el.value.length);
      const persists = persistedLen === finalLen;
      log(`Persists: ${persists}`);

      results.frqTypingDeleteRetype = `typed_${typedLen}_del_${typedLen - afterDelLen}_final_${finalLen}_incomplete_${isIncomplete}_persists_${persists}`;
    } else {
      log(`Textarea not usable: visible=${ta2Vis}, disabled=${ta2Disabled}`);
      results.frqTypingDeleteRetype = `textarea_not_usable_vis_${ta2Vis}_dis_${ta2Disabled}`;

      if (ta2Vis && ta2Disabled) {
        results.findings.push({
          type: 'finding',
          severity: 'high',
          id: 'B14D-LOCKED-FRQ',
          message: 'FRQ textarea is visible but disabled. Session conflict prevents typing. The DuplicateTabModal handling may have failed. Partial answer cannot be tested.'
        });
      }
    }

    // ===== STEP 7: SUBMIT =====
    log('--- STEP 7: Submit ---');
    let done = false;

    for (let nav = 0; nav < 35 && !done; nav++) {
      await sleep(2000);
      await handleDuplicateTabModal(page);
      view = await getCurrentView(page);
      const url = page.url();
      log(`Nav ${nav}: view=${view}`);

      if (view === 'results' || url.includes('/results')) {
        log('Results!');
        await takeScreenshot(page, 'report_card');
        results.reportCardStatus = 'reached';
        results.resultUrl = url;
        done = true;
        break;
      }

      const action = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button')).filter(b =>
          !b.disabled && b.getBoundingClientRect().width > 0
        );
        const tries = [
          { re: /submit test|finish test/i, n: 'submit_test' },
          { re: /^confirm$/i, n: 'confirm' },
          { re: /^yes$/i, n: 'yes' },
          { re: /submit section/i, n: 'submit_section' },
          { re: /review.*→|review & submit/i, n: 'review' },
          { re: /^next\s*→?$/i, n: 'next' },
          { re: /^submit$/i, n: 'submit' },
          { re: /type your answers/i, n: 'type_choice' },
        ];
        for (const { re, n } of tries) {
          const btn = btns.find(b => re.test(b.textContent?.trim()));
          if (btn) { btn.click(); return { n, text: btn.textContent?.trim().substring(0, 40) }; }
        }
        return null;
      });

      if (action) {
        log(`Action: ${action.n} — "${action.text}"`);
        if (action.n === 'next') {
          const ta = page.locator('textarea:not([disabled])').first();
          if (await ta.isVisible({ timeout: 300 }).catch(() => false)) {
            const v = await ta.evaluate(el => el.value || '');
            if (!v.trim()) {
              await ta.fill('Economic principles apply here.');
              await sleep(200);
              await page.evaluate(() => {
                Array.from(document.querySelectorAll('button')).find(b =>
                  /^next\s*→?$/i.test(b.textContent?.trim()) && !b.disabled
                )?.click();
              });
            }
          }
        }
        if (['submit_test', 'submit_section', 'submit', 'review'].includes(action.n)) {
          await sleep(4000);
          await takeScreenshot(page, `after_${action.n}_${nav}`);
        }
        continue;
      }

      if (view === 'submitting') { await sleep(3000); continue; }

      const bText = await getBodyText(page);
      log(`No action. Text: "${bText.substring(0, 200)}"`);
      await takeScreenshot(page, `stuck_${nav}`);
    }

    // ===== FINAL =====
    await sleep(2000);
    await takeScreenshot(page, 'final');
    const finalUrl = page.url();
    const finalText = await getBodyText(page);
    log(`Final URL: ${finalUrl}`);
    log(`Final text: "${finalText.substring(0, 500)}"`);
    results.resultUrl = finalUrl;

    if (finalUrl.includes('/results')) {
      results.frqPartialSubmit = 'reached_results';
      results.reportCardStatus = 'reached';
      const hasPending = !!(finalText.match(/pending|awaiting|grading/i));
      const hasFRQ = !!(finalText.match(/free response|frq|section 2/i));
      const hasMCQ = !!(finalText.match(/section 1|multiple choice/i));
      log(`Report: pending=${hasPending}, FRQ=${hasFRQ}, MCQ=${hasMCQ}`);
      results.findings.push({ type: 'info', message: `Report: FRQpending=${hasPending}, FRQ=${hasFRQ}, MCQ=${hasMCQ}` });
      if (!hasFRQ && !hasPending) {
        results.findings.push({ type: 'finding', severity: 'medium', id: 'B14D-003', message: 'Report card missing FRQ section/status' });
      }
    } else {
      results.frqPartialSubmit = `no_results_${finalUrl}`;
      results.findings.push({ type: 'finding', severity: 'high', message: `Not submitted. URL: ${finalUrl}. Text: "${finalText.substring(0, 300)}"` });
    }

    const errors = consoleMessages.filter(m => m.type === 'error');
    log(`\nConsole errors: ${errors.length}`);
    errors.forEach(e => log(`  ${e.text.substring(0, 200)}`));

  } catch (err) {
    log(`FATAL: ${err.message}`);
    results.fatalError = err.message;
    await takeScreenshot(page, 'fatal').catch(() => {});
  } finally {
    results.allConsoleMessages = consoleMessages.map(m => ({ type: m.type, text: m.text.substring(0, 300), url: m.url }));
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    log(`Saved: ${RESULTS_FILE}`);
    await browser.close();
  }
})();
