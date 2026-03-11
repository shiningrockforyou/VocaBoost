// B14E - Review screen and submit test
// Resumes existing session, navigates to review, submits
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'b14e_retest_screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const RESULTS = [];
const CONSOLE_MSGS = [];

function log(msg) {
  console.log('[B14E-REVIEW] ' + msg);
  RESULTS.push(msg);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', msg => {
    CONSOLE_MSGS.push({ type: msg.type(), text: msg.text(), url: page.url() });
  });
  page.on('pageerror', err => {
    CONSOLE_MSGS.push({ type: 'pageerror', text: err.message, url: page.url() });
  });

  // Login
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await page.fill('input[type="email"]', 'student8@apboost.test');
  await page.fill('input[type="password"]', 'Student123!');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('domcontentloaded');
  await sleep(2500);
  log('Login URL: ' + page.url());

  if (!page.url().includes('/ap')) {
    await page.goto('http://localhost:5173/ap/test/test_micro_full_1', { waitUntil: 'domcontentloaded' });
    await sleep(3000);
  } else {
    await page.goto('http://localhost:5173/ap/test/test_micro_full_1', { waitUntil: 'domcontentloaded' });
    await sleep(3000);
  }

  log('Test page URL: ' + page.url());
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'review_01_test_page.png') });

  // Check errors
  const errors = CONSOLE_MSGS.filter(m => m.type === 'error' || m.type === 'pageerror');
  log('Console errors on test page load: ' + errors.length);
  errors.forEach(e => log('  ERROR: ' + (e.text || '').substring(0, 200)));

  const bodyText = await page.locator('body').textContent().catch(() => '');
  log('Has "Something went wrong": ' + bodyText.includes('Something went wrong'));

  // Resume or begin
  const resumeBtn = page.locator('button:has-text("Resume Test")').first();
  const beginBtn = page.locator('button:has-text("Begin Test")').first();

  if (await resumeBtn.count() > 0) {
    log('Resuming existing session...');
    await resumeBtn.click();
    await sleep(2000);
  } else if (await beginBtn.count() > 0) {
    log('No resume — beginning fresh (answering all 15 first)...');
    await beginBtn.click();
    await sleep(2000);

    // Answer all 15 quickly
    const letters = ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C'];
    for (let i = 0; i < 15; i++) {
      const allBtns = await page.locator('button').all();
      let clicked = false;
      for (const btn of allBtns) {
        const txt = await btn.textContent().catch(() => '');
        const vis = await btn.isVisible().catch(() => false);
        if (vis && txt && txt.trim().startsWith(letters[i]) && txt.trim().length > 2 && txt.trim().length < 200) {
          const isNav = /Back|Next|Review|Submit|Flag/i.test(txt.trim().substring(0, 15));
          if (!isNav) {
            await btn.click();
            clicked = true;
            break;
          }
        }
      }
      if (clicked) log('Q' + (i + 1) + ': answered ' + letters[i]);
      else log('Q' + (i + 1) + ': WARN not answered');
      await sleep(300);

      if (i < 14) {
        const nextBtn = page.locator('button:has-text("Next")').first();
        if (await nextBtn.count() > 0) {
          await nextBtn.click();
          await sleep(400);
        }
      }
    }
    log('All 15 answered');
  }

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'review_02_in_test.png') });

  // Navigate to Q15 if needed and then go to review
  const currentBody = await page.locator('body').textContent().catch(() => '');
  log('Current state snippet: ' + currentBody.substring(0, 100).replace(/\s+/g, ' '));

  // Check if we need to navigate to Q15
  const questionMatch = currentBody.match(/Question (\d+) of 15/);
  if (questionMatch) {
    const currentQ = parseInt(questionMatch[1]);
    log('Currently on Q' + currentQ);

    // Navigate to Q15
    const stepsForward = 15 - currentQ;
    for (let i = 0; i < stepsForward; i++) {
      const nextBtn = page.locator('button:has-text("Next")').first();
      if (await nextBtn.count() > 0) {
        await nextBtn.click();
        await sleep(400);
      } else {
        log('No Next button at Q' + (currentQ + i + 1));
        break;
      }
    }
  }

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'review_03_at_q15.png') });

  // Look for Review button - check all buttons
  log('Buttons on current page:');
  const allPageBtns = await page.locator('button').all();
  for (const btn of allPageBtns) {
    const txt = await btn.textContent().catch(() => '');
    const vis = await btn.isVisible().catch(() => false);
    if (vis) log('  Button: "' + (txt || '').trim().substring(0, 50) + '"');
  }

  // Click Review button (with arrow)
  const reviewBtns = page.locator('button').filter({ hasText: /Review/i });
  const reviewCount = await reviewBtns.count();
  log('Review buttons found: ' + reviewCount);

  if (reviewCount > 0) {
    await reviewBtns.first().click();
    log('Clicked Review button');
    await sleep(2500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'review_04_review_screen.png') });

    const reviewBody = await page.locator('body').textContent().catch(() => '');
    log('Review screen body (first 300): ' + reviewBody.substring(0, 300).replace(/\s+/g, ' '));

    // Check answered count
    const answeredMatch = reviewBody.match(/Answered[:\s]+(\d+)\s*\/\s*(\d+)/i)
      || reviewBody.match(/(\d+)\s*\/\s*(\d+)\s+answered/i)
      || reviewBody.match(/(\d+)\s*of\s*(\d+)\s*answered/i);
    if (answeredMatch) {
      log('Answered: ' + answeredMatch[0]);
    } else {
      log('All count patterns: ' + (reviewBody.match(/\d+\/\d+/g) || []).join(', '));
    }

    // Look for Submit Section button
    log('Looking for Submit Section button...');
    const submitBtns = await page.locator('button').all();
    for (const btn of submitBtns) {
      const txt = await btn.textContent().catch(() => '');
      const vis = await btn.isVisible().catch(() => false);
      if (vis) log('  Visible button: "' + (txt || '').trim().substring(0, 50) + '"');
    }

    const submitSecBtn = page.locator('button').filter({ hasText: /Submit Section/i }).first();
    if (await submitSecBtn.count() > 0) {
      log('PASS: Submit Section button found');
      await submitSecBtn.click();
      log('Clicked Submit Section');
      await sleep(2000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'review_05_submit_section.png') });

      // Confirm
      const confirmBtns = page.locator('button').filter({ hasText: /Confirm|Yes/i });
      if (await confirmBtns.count() > 0) {
        await confirmBtns.first().click();
        log('Confirmed submission');
        await sleep(3000);
      }
    } else {
      log('FAIL: Submit Section button NOT found on review screen');
    }
  } else {
    log('WARN: No Review button found — checking current question');
  }

  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await sleep(2500);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'review_06_post_submit.png') });

  const postSubmitBody = await page.locator('body').textContent().catch(() => '');
  const postSubmitUrl = page.url();
  log('Post-submit URL: ' + postSubmitUrl);

  const onFRQChoice = postSubmitBody.includes('Type Your Answers') || postSubmitBody.includes('Write by Hand') || postSubmitBody.includes('Free Response');
  log('FRQ choice screen: ' + onFRQChoice);

  if (onFRQChoice) {
    log('PASS: FRQ choice screen appeared');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'review_07_frq_choice.png') });

    // Click Type Your Answers
    const allBtns = await page.locator('button').all();
    let typeFound = false;
    for (const btn of allBtns) {
      const txt = await btn.textContent().catch(() => '');
      const vis = await btn.isVisible().catch(() => false);
      if (vis && txt && (txt.includes('Type') || txt.includes('type')) && txt.length < 80) {
        await btn.click();
        typeFound = true;
        log('Clicked: "' + txt.trim().substring(0, 40) + '"');
        await sleep(1500);
        break;
      }
    }

    if (typeFound) {
      // Confirm selection if needed
      const confirmBtn = page.locator('button').filter({ hasText: /Confirm & Continue|Confirm|Continue/i }).first();
      if (await confirmBtn.count() > 0) {
        await confirmBtn.click();
        await sleep(1000);
      }

      // Type FRQ answer
      const ta = page.locator('textarea').first();
      if (await ta.count() > 0) {
        await ta.fill('A public good is non-excludable and non-rival. National defense is the classic example. Toll roads are excludable (you can deny access) and rival (congestion). Hamburgers are private goods. Cable TV is non-rival but excludable.');
        log('FRQ answer typed');
        await sleep(400);
      }

      // Navigate through FRQ
      for (let fq = 0; fq < 12; fq++) {
        const submitTestBtn = page.locator('button').filter({ hasText: /Submit Test/i }).first();
        const nextBtn = page.locator('button').filter({ hasText: /Next|Save & Next/i }).first();

        if (await submitTestBtn.count() > 0) {
          log('Submit Test button found at FRQ ' + (fq + 1));
          await submitTestBtn.click();
          await sleep(2000);
          const finalConfirm = page.locator('button').filter({ hasText: /Confirm|Yes/i }).first();
          if (await finalConfirm.count() > 0) {
            await finalConfirm.click();
            await sleep(4000);
          }
          break;
        } else if (await nextBtn.count() > 0) {
          await nextBtn.click();
          await sleep(800);
          const nextTa = page.locator('textarea').first();
          if (await nextTa.count() > 0) {
            await nextTa.fill('Economic efficiency occurs when marginal benefit equals marginal cost in all markets. Market failures like externalities and public goods require government intervention.');
          }
        } else {
          log('No Next or Submit at FRQ ' + (fq + 1));
          break;
        }
      }
    }
  }

  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await sleep(3000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'review_08_final.png') });

  const finalUrl = page.url();
  const finalBody = await page.locator('body').textContent().catch(() => '');
  log('Final URL: ' + finalUrl);
  log('Report card: ' + (finalUrl.includes('/results/') || finalBody.includes('Report Card') ? 'REACHED' : 'NOT REACHED'));

  if (finalUrl.includes('/results/')) {
    const scoreMatch = finalBody.match(/(\d+)\s*\/\s*15/);
    if (scoreMatch) log('MCQ Score: ' + scoreMatch[0]);
    log('FRQ pending: ' + (finalBody.includes('Pending') ? 'YES' : 'NO'));
  }

  // Final console check
  const allErrors = CONSOLE_MSGS.filter(m => m.type === 'error' || m.type === 'pageerror');
  log('Total console errors: ' + allErrors.length);
  allErrors.forEach(e => log('  ERROR: ' + (e.text || '').substring(0, 200)));

  const output = { results: RESULTS, consoleMsgs: CONSOLE_MSGS, timestamp: new Date().toISOString() };
  fs.writeFileSync(path.join(__dirname, 'b14e_review_submit_results.json'), JSON.stringify(output, null, 2));
  log('Done.');

  await browser.close();
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
