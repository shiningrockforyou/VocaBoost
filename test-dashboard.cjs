const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = { steps: [], errors: [] };

  page.on('console', msg => {
    if (msg.type() === 'error') results.errors.push(msg.text());
  });

  try {
    // Step 1: Login
    console.log('Step 1: Navigating to login...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    await page.fill('input[placeholder*="school" i]', 'teacher@apboost.test');
    await page.fill('input[type="password"]', 'Teacher123!');
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(5000);
    console.log('  Logged in. URL:', page.url());

    // Step 2: Navigate to teacher dashboard
    console.log('Step 2: Navigating to /ap/teacher...');
    await page.goto('http://localhost:5173/ap/teacher', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(5000);
    console.log('  URL:', page.url());
    await page.screenshot({ path: 'screenshots/b0_01_dashboard.png', fullPage: true });

    // Step 3: Check page content
    console.log('Step 3: Checking page content...');
    const h1 = await page.textContent('h1').catch(() => 'No h1');
    console.log('  Page h1:', h1);
    const sections = await page.$$eval('h2', els => els.map(e => e.textContent));
    console.log('  Sections:', sections);

    // Step 4: Check for Developer Tools + Seed button
    console.log('Step 4: Looking for Developer Tools...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    
    const devTools = await page.evaluate(() => {
      const body = document.body.textContent;
      return {
        hasDeveloperTools: body.includes('Developer Tools'),
        hasSeedButton: body.includes('Seed Full Test Data'),
      };
    });
    console.log('  Developer Tools found:', devTools.hasDeveloperTools);
    console.log('  Seed button found:', devTools.hasSeedButton);
    await page.screenshot({ path: 'screenshots/b0_02_dev_tools.png', fullPage: true });

    // Step 5: Click Seed button if found
    if (devTools.hasSeedButton) {
      console.log('Step 5: Clicking Seed button...');
      await page.click('button:has-text("Seed Full Test Data")');
      
      // Wait for seeding to complete (up to 60s)
      let seeded = false;
      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(5000);
        const text = await page.textContent('body');
        if (text.includes('Seeded 3 tests')) {
          seeded = true;
          console.log('  Seed SUCCESS');
          break;
        }
        console.log('  Waiting... (' + (i+1)*5 + 's)');
      }
      if (!seeded) console.log('  Seed TIMEOUT - may have failed');
      await page.screenshot({ path: 'screenshots/b0_03_after_seed.png', fullPage: true });
    } else {
      console.log('Step 5: SKIP - No seed button (may not be in dev mode or already redirected)');
    }

    // Step 6: Verify test cards
    console.log('Step 6: Checking test cards...');
    await page.waitForTimeout(2000);
    const testCards = await page.$$eval('h3', els => els.map(e => e.textContent.trim()));
    console.log('  Test card titles:', testCards);
    
    const quickActions = await page.$$eval('a.flex.items-center', els => els.map(e => ({ 
      text: e.textContent.trim(), 
      href: e.getAttribute('href') 
    })));
    console.log('  Quick actions:', JSON.stringify(quickActions));

    const buttons = await page.$$eval('button', els => els.map(e => ({ 
      text: e.textContent.trim(), 
      disabled: e.disabled 
    })));
    console.log('  Buttons:', JSON.stringify(buttons));

    // Step 7: Check classes sidebar
    console.log('Step 7: Checking sidebar...');
    const bodyText = await page.textContent('body');
    const hasClasses = bodyText.includes('My Classes');
    const hasPending = bodyText.includes('Pending Grading');
    console.log('  My Classes section:', hasClasses);
    console.log('  Pending Grading section:', hasPending);

    await page.screenshot({ path: 'screenshots/b0_04_final.png', fullPage: true });

    // Step 8: Test quick action links
    console.log('Step 8: Testing View All link...');
    const viewAllLink = await page.$('a:has-text("View All")');
    if (viewAllLink) {
      const href = await viewAllLink.getAttribute('href');
      console.log('  View All link href:', href);
      await viewAllLink.click();
      await page.waitForTimeout(3000);
      console.log('  View All navigated to:', page.url());
      await page.screenshot({ path: 'screenshots/b0_05_view_all.png', fullPage: true });
    }

    console.log('\n=== Console errors ===');
    results.errors.forEach(e => console.log('  ERROR:', e));
    if (results.errors.length === 0) console.log('  None');

    console.log('\n=== AUDIT COMPLETE ===');

  } catch (err) {
    console.error('FATAL:', err.message);
    await page.screenshot({ path: 'screenshots/b0_error.png', fullPage: true }).catch(() => {});
  }

  await browser.close();
})();
