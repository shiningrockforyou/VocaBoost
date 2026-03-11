// B14E - FRQ completion and final submission
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
  console.log('[B14E-FRQ] ' + msg);
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
  log('Post-login URL: ' + page.url());

  // Navigate to test
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1', { waitUntil: 'domcontentloaded' });
  await sleep(3500);
  log('Test page URL: ' + page.url());
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'frq_01_test_page.png') });

  const errors1 = CONSOLE_MSGS.filter(m => m.type === 'error' || m.type === 'pageerror');
  log('Errors on test page load: ' + errors1.length);

  const bodyText = await page.locator('body').textContent().catch(() => '');
  const resumeCount = await page.locator('button:has-text("Resume Test")').count();
  const beginCount = await page.locator('button:has-text("Begin Test")').count();
  log('Resume: ' + resumeCount + ', Begin: ' + beginCount);

  if (resumeCount > 0) {
    log('Resuming...');
    await page.locator('button:has-text("Resume Test")').first().click();
    await sleep(2000);
  } else if (beginCount > 0) {
    log('Beginning fresh...');
    await page.locator('button:has-text("Begin Test")').first().click();
    await sleep(2000);
  }

  // Answer all 15 MCQ
  const letters = ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C'];
  for (let i = 0; i < 15; i++) {
    const allBtns = await page.locator('button').all();
    let clicked = false;
    for (const btn of allBtns) {
      const txt = await btn.textContent().catch(() => '');
      const vis = await btn.isVisible().catch(() => false);
      if (!vis || !txt) continue;
      const t = txt.trim();
      if (t.startsWith(letters[i]) && t.length > 2 && t.length < 200) {
        if (!/Back|Next|Review|Submit|Flag/i.test(t.substring(0, 15))) {
          await btn.click();
          clicked = true;
          break;
        }
      }
    }
    if (!clicked) log('Q' + (i+1) + ': WARN not clicked');
    await sleep(300);
    if (i < 14) {
      const next = page.locator('button:has-text("Next")').first();
      if (await next.count() > 0) { await next.click(); await sleep(400); }
    }
  }
  log('All 15 MCQ answered');

  // Click Review
  const reviewBtn = page.locator('button').filter({ hasText: /Review/i }).first();
  if (await reviewBtn.count() > 0) {
    await reviewBtn.click();
    await sleep(2000);
  }

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'frq_02_review.png') });
  const reviewBody = await page.locator('body').textContent().catch(() => '');
  log('Review screen: ' + reviewBody.substring(0, 100).replace(/\s+/g, ' '));

  // Submit Section
  const submitSec = page.locator('button').filter({ hasText: /Submit Section/i }).first();
  if (await submitSec.count() > 0) {
    await submitSec.click();
    log('Clicked Submit Section');
    await sleep(2000);
    const confirmBtn = page.locator('button').filter({ hasText: /Confirm|Yes/i }).first();
    if (await confirmBtn.count() > 0) { await confirmBtn.click(); await sleep(2500); }
  }

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'frq_03_frq_choice.png') });
  const frqChoiceBody = await page.locator('body').textContent().catch(() => '');
  log('FRQ choice screen body: ' + frqChoiceBody.substring(0, 150).replace(/\s+/g, ' '));

  // Inspect all clickable elements on FRQ choice screen
  log('All interactive elements on FRQ choice screen:');
  const allInteractive = await page.locator('button, [role="button"], a, [onclick], div[class*="card"], div[class*="Card"]').all();
  for (const el of allInteractive) {
    const txt = await el.textContent().catch(() => '');
    const vis = await el.isVisible().catch(() => false);
    const tag = await el.evaluate(e => e.tagName).catch(() => '?');
    const cls = await el.getAttribute('class').catch(() => '');
    if (vis && txt && txt.trim().length > 0) {
      log('  [' + tag + '] "' + txt.trim().substring(0, 60) + '" class: ' + (cls || '').substring(0, 40));
    }
  }

  // Try clicking the "Type Your Answers" card
  // It might be a div with a click handler
  const typeCard = page.locator('div, button').filter({ hasText: /Type Your Answers/i }).first();
  const typeCardCount = await typeCard.count();
  log('Type Your Answers element count: ' + typeCardCount);

  if (typeCardCount > 0) {
    await typeCard.click();
    log('Clicked Type Your Answers card');
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'frq_04_type_selected.png') });

    // Look for Confirm & Continue button
    const confirmBody = await page.locator('body').textContent().catch(() => '');
    log('After type click body: ' + confirmBody.substring(0, 150).replace(/\s+/g, ' '));

    const confirmFrq = page.locator('button').filter({ hasText: /Confirm & Continue|Confirm|Continue/i }).first();
    if (await confirmFrq.count() > 0) {
      await confirmFrq.click();
      log('Confirmed FRQ type choice');
      await sleep(1500);
    }
  } else {
    log('WARN: Type Your Answers card not found');
  }

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'frq_05_frq_start.png') });
  const frqStartBody = await page.locator('body').textContent().catch(() => '');
  log('FRQ start body: ' + frqStartBody.substring(0, 200).replace(/\s+/g, ' '));

  // Type FRQ answers
  const ta = page.locator('textarea').first();
  if (await ta.count() > 0) {
    await ta.fill('A public good is non-excludable and non-rival in consumption. National defense is the classic example because one persons consumption does not diminish it and no one can be excluded. Hamburgers are excludable and rival. Toll roads are excludable but rival.');
    log('FRQ answer typed');
    await sleep(500);
  }

  // Navigate through FRQ sub-questions
  for (let fq = 0; fq < 15; fq++) {
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'frq_q' + (fq+1) + '.png') });
    const submitTestBtn = page.locator('button').filter({ hasText: /Submit Test/i }).first();
    const nextBtn = page.locator('button').filter({ hasText: /^Next$|Save & Next|Next Question/i }).first();

    const currentBody = await page.locator('body').textContent().catch(() => '');
    log('FRQ sub-q ' + (fq+1) + ' page: ' + currentBody.substring(0, 80).replace(/\s+/g, ' '));

    if (await submitTestBtn.count() > 0) {
      log('Submit Test button found at FRQ sub-q ' + (fq+1));
      await submitTestBtn.click();
      await sleep(2000);
      const finalConfirm = page.locator('button').filter({ hasText: /Confirm|Yes, Submit/i }).first();
      if (await finalConfirm.count() > 0) {
        await finalConfirm.click();
        log('Final submission confirmed');
        await sleep(5000);
      }
      break;
    } else if (await nextBtn.count() > 0) {
      await nextBtn.click();
      log('FRQ sub-q ' + (fq+1) + ': clicked Next');
      await sleep(800);
      const nextTa = page.locator('textarea').first();
      if (await nextTa.count() > 0) {
        await nextTa.fill('Economic efficiency requires that price equals marginal cost. Deadweight loss occurs when output deviates from the socially optimal level.');
      }
    } else {
      log('FRQ sub-q ' + (fq+1) + ': No Next or Submit Test button found');
      // Log all buttons
      const allBtns = await page.locator('button').all();
      for (const btn of allBtns) {
        const txt = await btn.textContent().catch(() => '');
        const vis = await btn.isVisible().catch(() => false);
        if (vis) log('  Button: "' + (txt || '').trim().substring(0, 40) + '"');
      }
      break;
    }
  }

  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await sleep(4000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'frq_final.png') });

  const finalUrl = page.url();
  const finalBody = await page.locator('body').textContent().catch(() => '');
  log('Final URL: ' + finalUrl);
  log('Final body snippet: ' + finalBody.substring(0, 200).replace(/\s+/g, ' '));
  log('Report card reached: ' + (finalUrl.includes('/results/') || finalBody.includes('Report Card') ? 'YES - PASS' : 'NO - FAIL'));

  if (finalUrl.includes('/results/')) {
    const scoreMatch = finalBody.match(/(\d+)\s*\/\s*15/);
    log('MCQ Score: ' + (scoreMatch ? scoreMatch[0] : 'not found'));
  }

  // Final console analysis
  const allErrors = CONSOLE_MSGS.filter(m => m.type === 'error' || m.type === 'pageerror');
  log('Total console errors: ' + allErrors.length);
  allErrors.forEach(e => log('  ERROR: ' + (e.text || '').substring(0, 200)));

  const output = { results: RESULTS, consoleMsgs: CONSOLE_MSGS, timestamp: new Date().toISOString() };
  fs.writeFileSync(path.join(__dirname, 'b14e_frq_submit_results.json'), JSON.stringify(output, null, 2));
  log('Saved b14e_frq_submit_results.json');

  await browser.close();
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
