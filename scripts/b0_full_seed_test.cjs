const { chromium } = require('playwright');
const fs = require('fs');

const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_B0';
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runB0() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = {
    login: null,
    teacherDashboard: null,
    developerToolsVisible: null,
    seedButtonFound: null,
    seedButtonText: null,
    seedClicked: null,
    consoleMessages: [],
    seedResultMessage: null,
    seedSuccess: null,
    testCardsAfterSeed: null,
    resultPageCheck: null,
    gradebookCheck: null,
  };

  // Capture all console messages
  page.on('console', msg => {
    results.consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  try {
    // ----------------------------------------------------------------
    // STEP 1: Login
    // ----------------------------------------------------------------
    console.log('STEP 1: Navigating to login...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_01_login_page.png`, fullPage: true });

    console.log('Filling credentials...');
    await page.fill('input[type="email"]', 'teacher@apboost.test');
    await page.fill('input[type="password"]', 'Teacher123!');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_02_login_filled.png`, fullPage: true });
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);

    const urlAfterLogin = page.url();
    console.log('URL after login:', urlAfterLogin);

    // Navigate to teacher dashboard
    console.log('Navigating to /ap/teacher...');
    await page.goto('http://localhost:5173/ap/teacher', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    if (currentUrl.includes('/ap/teacher')) {
      results.login = 'SUCCESS - at /ap/teacher';
    } else if (currentUrl.includes('/login')) {
      results.login = 'FAILED - redirected back to login';
      throw new Error('Login failed - redirected to login page');
    } else {
      results.login = `PARTIAL - at ${currentUrl}`;
    }

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_03_teacher_dashboard.png`, fullPage: true });
    console.log('Login result:', results.login);

    // ----------------------------------------------------------------
    // STEP 2: Verify teacher dashboard
    // ----------------------------------------------------------------
    const h1Text = await page.textContent('h1').catch(() => null);
    results.teacherDashboard = h1Text;
    console.log('Page H1:', h1Text);

    const bodyText = await page.evaluate(() => document.body.textContent);
    const hasTestCards = bodyText.includes('Micro') && bodyText.includes('Macro') && bodyText.includes('Calc');
    console.log('Test cards visible (pre-seed):', hasTestCards);

    // ----------------------------------------------------------------
    // STEP 3: Find Developer Tools section and seed button
    // ----------------------------------------------------------------
    console.log('STEP 3: Scrolling to find Developer Tools...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_04_scrolled.png`, fullPage: true });

    // Check Developer Tools section visibility
    const devToolsFound = await page.evaluate(() => {
      const text = document.body.textContent;
      return text.includes('Developer Tools');
    });
    results.developerToolsVisible = devToolsFound ? 'YES - Developer Tools section found' : 'NO - not found';
    console.log('Developer Tools visible:', devToolsFound);

    // Find seed button
    const seedBtnText = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Seed Full Test Data') || b.textContent.includes('Seed'));
      return btn ? btn.textContent.trim() : null;
    });

    if (!seedBtnText) {
      const allBtnTexts = await page.$$eval('button', btns => btns.map(b => b.textContent.trim()).filter(t => t.length > 0));
      results.seedButtonFound = 'NOT FOUND';
      console.log('Seed button NOT found. All buttons:', allBtnTexts);
      throw new Error('Seed button not found');
    } else {
      results.seedButtonFound = 'FOUND';
      results.seedButtonText = seedBtnText;
      console.log('Seed button found:', seedBtnText);
    }

    // ----------------------------------------------------------------
    // STEP 4: Click seed button and wait for result
    // ----------------------------------------------------------------
    console.log('STEP 4: Clicking seed button...');

    // Scroll to seed button and take screenshot before click
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Seed Full Test Data') || b.textContent.includes('Seed'));
      if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_05_before_seed.png`, fullPage: true });

    // Click the button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Seed Full Test Data') || b.textContent.includes('Seed'));
      if (btn) btn.click();
    });
    results.seedClicked = true;
    console.log('Seed button clicked. Waiting for result...');

    // Poll for seed completion (up to 45 seconds)
    let seedDone = false;
    let finalMessage = null;
    const startTime = Date.now();

    for (let i = 0; i < 45; i++) {
      await page.waitForTimeout(1000);

      const currentBodyText = await page.evaluate(() => document.body.textContent);

      if (currentBodyText.includes('Seeded 3 tests') || currentBodyText.includes('13 results')) {
        seedDone = true;
        finalMessage = 'SUCCESS: Found "Seeded 3 tests" in page';
        break;
      }
      if (currentBodyText.includes('Missing or insufficient')) {
        seedDone = true;
        finalMessage = 'ERROR: Missing or insufficient permissions';
        break;
      }
      if (currentBodyText.includes('Seed failed') || currentBodyText.includes('seed failed')) {
        seedDone = true;
        finalMessage = 'ERROR: Seed failed message';
        break;
      }

      // Check console for seed-related messages
      const seedConsoleMsg = results.consoleMessages.find(m =>
        m.text.includes('Seed error') || m.text.includes('SEED COMPLETE') || m.text.includes('Created') && m.text.includes('results')
      );
      if (seedConsoleMsg) {
        seedDone = true;
        finalMessage = `Console: ${seedConsoleMsg.text}`;
        break;
      }

      if (i % 10 === 9) {
        console.log(`  Still waiting... ${i + 1}s elapsed`);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_wait_${i + 1}s.png`, fullPage: true });
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`Seed completed in ~${elapsed}s. Done: ${seedDone}, Message: ${finalMessage}`);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_06_after_seed.png`, fullPage: true });

    // Get the full page text to find status message
    const postSeedText = await page.evaluate(() => document.body.textContent);
    results.seedResultMessage = finalMessage || 'No clear result after 45 seconds';
    results.seedSuccess = postSeedText.includes('Seeded 3 tests') || postSeedText.includes('13 results');

    // Extract visible status message near seed area
    const visibleMsg = await page.evaluate(() => {
      // Look for result message near the developer tools section
      const allText = Array.from(document.querySelectorAll('p, span, small, .text-success, .text-error, [class*="success"], [class*="error"]'))
        .filter(el => {
          const t = el.textContent.trim();
          return t.length > 5 && t.length < 400 && el.children.length < 5;
        })
        .map(el => ({ tag: el.tagName, class: el.className.substring(0, 50), text: el.textContent.trim() }));
      return allText.slice(-15);
    });
    console.log('Visible messages on page:');
    visibleMsg.forEach(m => console.log(`  [${m.tag}.${m.class}]: ${m.text.substring(0, 100)}`));

    // ----------------------------------------------------------------
    // STEP 5: Verify test cards visible after seed
    // ----------------------------------------------------------------
    console.log('STEP 5: Verifying test cards...');
    await page.goto('http://localhost:5173/ap/teacher', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_07_test_cards.png`, fullPage: true });

    const afterSeedText = await page.evaluate(() => document.body.textContent);
    results.testCardsAfterSeed = {
      microVisible: afterSeedText.includes('Microeconomics') || afterSeedText.includes('Micro'),
      macroVisible: afterSeedText.includes('Macroeconomics') || afterSeedText.includes('Macro'),
      calcVisible: afterSeedText.includes('Calculus') || afterSeedText.includes('Calc'),
      pendingGrading: (() => {
        const match = afterSeedText.match(/Pending Grading \((\d+)\)/);
        return match ? parseInt(match[1]) : 0;
      })(),
    };
    console.log('Test cards after seed:', results.testCardsAfterSeed);

    // ----------------------------------------------------------------
    // STEP 6: Verify result page loads
    // ----------------------------------------------------------------
    console.log('STEP 6: Checking result_micro_student1...');
    await page.goto('http://localhost:5173/ap/results/result_micro_student1', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_08_result_page.png`, fullPage: true });

    const resultText = await page.evaluate(() => document.body.textContent.trim());
    console.log('Result page text (first 300):', resultText.substring(0, 300));

    if (resultText.includes('Result not found') || resultText.includes('not found')) {
      results.resultPageCheck = 'FAIL: Result not found';
    } else if (
      resultText.includes('AP Score') || resultText.includes('MCQ') ||
      resultText.includes('Report') || resultText.includes('Alex Johnson') ||
      resultText.includes('Microeconomics')
    ) {
      results.resultPageCheck = 'PASS: Report card loaded';
    } else {
      results.resultPageCheck = 'UNKNOWN: ' + resultText.substring(0, 200);
    }
    console.log('Result page:', results.resultPageCheck);

    // ----------------------------------------------------------------
    // STEP 7: Check gradebook for pending submissions
    // ----------------------------------------------------------------
    console.log('STEP 7: Checking gradebook...');
    await page.goto('http://localhost:5173/ap/gradebook', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_09_gradebook.png`, fullPage: true });

    const gradebookText = await page.evaluate(() => document.body.textContent.trim());
    console.log('Gradebook text (first 500):', gradebookText.substring(0, 500));

    if (gradebookText.includes('No submissions') || gradebookText.includes('no submissions')) {
      results.gradebookCheck = 'FAIL: No submissions found';
    } else {
      // Count submission rows
      const rowCount = await page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr, [role="row"]');
        return rows.length;
      });
      if (rowCount > 0) {
        results.gradebookCheck = `PASS: Found ${rowCount} rows`;
      } else {
        results.gradebookCheck = 'UNCLEAR: ' + gradebookText.substring(0, 200);
      }
    }
    console.log('Gradebook:', results.gradebookCheck);

  } catch (err) {
    console.error('Test error:', err.message);
    results.error = err.message;
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_error.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  return results;
}

runB0().then(results => {
  console.log('\n=== FINAL RESULTS ===');
  console.log(JSON.stringify(results, null, 2));

  fs.writeFileSync(
    'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b0_audit_results.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\nResults saved.');
}).catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
