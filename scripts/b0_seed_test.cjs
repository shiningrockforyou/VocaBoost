const { chromium } = require('playwright');
const path = require('path');
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
    seedClicked: null,
    consoleMessages: [],
    seedResultMessage: null,
    seedSuccess: null,
    testCardsAfterSeed: null,
    resultPageCheck: null,
  };

  // Capture console messages
  page.on('console', msg => {
    results.consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  try {
    // Step 1: Navigate to login
    console.log('Step 1: Navigating to login...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_01_login_page.png`, fullPage: true });
    console.log('Login page loaded');

    // Step 2: Log in as teacher
    console.log('Step 2: Logging in as teacher...');
    await page.fill('input[type="email"]', 'teacher@apboost.test');
    await page.fill('input[type="password"]', 'Teacher123!');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_02_login_filled.png`, fullPage: true });

    await page.click('button[type="submit"]');

    // Wait for redirect
    let loginOk = false;
    try {
      await page.waitForURL('**/ap/teacher', { timeout: 15000 });
      results.login = 'SUCCESS - redirected to /ap/teacher';
      loginOk = true;
    } catch (e) {
      const currentUrl = page.url();
      console.log('Current URL after login:', currentUrl);
      if (currentUrl.includes('/ap')) {
        results.login = `SUCCESS - redirected to ${currentUrl}`;
        loginOk = true;
        await page.goto('http://localhost:5173/ap/teacher', { waitUntil: 'networkidle', timeout: 30000 });
      } else {
        results.login = `FAILED - on ${currentUrl}`;
      }
    }

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_03_after_login.png`, fullPage: true });
    console.log('Login result:', results.login);

    if (!loginOk) {
      throw new Error('Login failed, stopping test');
    }

    // Wait for dashboard content
    await page.waitForTimeout(3000);

    // Step 3: Check teacher dashboard loaded
    const h1Text = await page.textContent('h1').catch(() => null);
    results.teacherDashboard = h1Text;
    console.log('Page h1:', h1Text);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_04_teacher_dashboard.png`, fullPage: true });

    // Step 4: Scroll to Developer Tools section
    console.log('Step 4: Looking for Developer Tools section...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_05_scrolled_bottom.png`, fullPage: true });

    const devToolsText = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('h2, h3, div, section'));
      const devSection = elements.find(el => el.textContent.includes('Developer Tools') || el.textContent.includes('Developer'));
      return devSection ? devSection.textContent.trim().substring(0, 100) : null;
    });
    results.developerToolsVisible = devToolsText;
    console.log('Developer Tools section:', devToolsText ? 'FOUND' : 'NOT FOUND');

    // Step 5: Find the seed button
    const seedButtonText = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const seedBtn = btns.find(b => b.textContent.includes('Seed Full Test Data') || b.textContent.includes('Seed'));
      return seedBtn ? seedBtn.textContent.trim() : null;
    });

    if (!seedButtonText) {
      const allButtons = await page.$$eval('button', btns => btns.map(b => b.textContent.trim()));
      results.seedButtonFound = 'NOT FOUND. Available buttons: ' + allButtons.join(' | ');
    } else {
      results.seedButtonFound = 'FOUND: ' + seedButtonText;
      console.log('Seed button found:', seedButtonText);
    }

    // Step 6: Click seed button
    if (seedButtonText) {
      console.log('Step 6: Clicking seed button...');

      const seedButton = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.find(b => b.textContent.includes('Seed Full Test Data') || b.textContent.includes('Seed'));
      });

      await seedButton.asElement().scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_06_before_seed_click.png`, fullPage: true });

      await seedButton.asElement().click();
      results.seedClicked = true;

      console.log('Waiting for seed result (up to 30 seconds)...');

      let seedDone = false;
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(1000);
        const bodyText = await page.evaluate(() => document.body.textContent);
        if (
          bodyText.includes('Seeded 3 tests') ||
          bodyText.includes('13 results') ||
          bodyText.includes('Missing or insufficient') ||
          bodyText.includes('Seed failed') ||
          bodyText.includes('seed complete') ||
          bodyText.includes('SEED COMPLETE')
        ) {
          seedDone = true;
          break;
        }
        if (i % 5 === 0) console.log(`  ... waiting ${i}s`);
      }

      if (!seedDone) {
        console.log('Seed did not complete in 30 seconds, taking screenshot of current state');
      }

      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_07_after_seed.png`, fullPage: true });

      const pageText = await page.evaluate(() => document.body.textContent);

      if (pageText.includes('Seeded 3 tests') || pageText.includes('13 results')) {
        results.seedResultMessage = 'SUCCESS: Seeded 3 tests message found';
        results.seedSuccess = true;
      } else if (pageText.includes('Missing or insufficient')) {
        results.seedResultMessage = 'ERROR: Missing or insufficient permissions';
        results.seedSuccess = false;
      } else {
        // Extract visible status messages
        const statusMsg = await page.evaluate(() => {
          const relevant = Array.from(document.querySelectorAll('p, span, div'))
            .filter(el => {
              const t = el.textContent.trim();
              return (t.includes('Seed') || t.includes('seed') || t.includes('Error') || t.includes('success') || t.includes('failed'))
                && t.length < 300 && el.children.length < 5;
            })
            .map(el => el.textContent.trim())
            .filter((v, i, a) => a.indexOf(v) === i);
          return statusMsg.slice(0, 10).join(' | ');
        }).catch(() => 'Could not extract status message');
        results.seedResultMessage = 'UNCLEAR: ' + statusMsg;
        results.seedSuccess = null;
      }

      console.log('Seed result:', results.seedResultMessage);
    }

    // Step 7: Verify test cards visible
    console.log('Step 7: Checking for test cards after seed...');
    await page.goto('http://localhost:5173/ap/teacher', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_08_test_cards.png`, fullPage: true });

    const microVisible = await page.evaluate(() => document.body.textContent.includes('Micro'));
    const macroVisible = await page.evaluate(() => document.body.textContent.includes('Macro'));
    const calcVisible = await page.evaluate(() => document.body.textContent.includes('Calc'));

    results.testCardsAfterSeed = { microVisible, macroVisible, calcVisible };
    console.log('Test cards:', results.testCardsAfterSeed);

    // Step 8: Check result page result_micro_student1
    console.log('Step 8: Checking result page result_micro_student1...');
    await page.goto('http://localhost:5173/ap/results/result_micro_student1', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_09_result_page.png`, fullPage: true });

    const resultPageText = await page.evaluate(() => document.body.textContent.trim());
    if (resultPageText.includes('Result not found') || resultPageText.includes('not found')) {
      results.resultPageCheck = 'FAIL: Result not found';
    } else if (
      resultPageText.includes('Report') ||
      resultPageText.includes('AP Score') ||
      resultPageText.includes('Score') ||
      resultPageText.includes('MCQ') ||
      resultPageText.includes('Alex Johnson')
    ) {
      results.resultPageCheck = 'PASS: Report card loaded successfully';
    } else {
      results.resultPageCheck = 'UNKNOWN: ' + resultPageText.substring(0, 200);
    }

    console.log('Result page check:', results.resultPageCheck);

    // Step 9: Check gradebook for pending submissions
    console.log('Step 9: Checking gradebook...');
    await page.goto('http://localhost:5173/ap/gradebook', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_10_gradebook.png`, fullPage: true });

    const gradebookText = await page.evaluate(() => document.body.textContent);
    if (gradebookText.includes('No submissions') || gradebookText.includes('no submissions')) {
      results.gradebookCheck = 'FAIL: No submissions found';
    } else {
      // Count any rows in the gradebook table
      const rowCount = await page.evaluate(() => {
        const rows = document.querySelectorAll('tr, [role="row"]');
        return rows.length;
      });
      results.gradebookCheck = rowCount > 1 ? `PASS: Found ${rowCount} rows in gradebook` : 'UNCLEAR: ' + gradebookText.substring(0, 200);
    }

    console.log('Gradebook check:', results.gradebookCheck);

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
  console.log('\nResults saved to b0_audit_results.json');
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
