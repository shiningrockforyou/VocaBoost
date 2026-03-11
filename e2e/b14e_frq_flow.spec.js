import { test } from '@playwright/test';

const SCREENSHOTS = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_B14E';

test('B14-E: FRQ flow after MCQ submit', async ({ page }) => {
  // Login
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"]');
  await page.locator('input[type="email"]').fill('student8@apboost.test');
  await page.locator('input[type="password"]').fill('Student123!');
  await page.keyboard.press('Enter');
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20000 });
  
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await page.waitForTimeout(3000);
  
  // Resume
  const resumeBtn = page.locator('button:has-text("Resume Test")').first();
  if (await resumeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await resumeBtn.click();
    await page.waitForTimeout(2000);
  }
  
  // Navigate to Q15 directly
  const qCounterBtn = page.locator('button').filter({ hasText: /of 15/ }).first();
  if (await qCounterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await qCounterBtn.click();
    await page.waitForTimeout(1000);
    const q15btn = page.locator('button').filter({ hasText: /^\s*15\s*$/ }).first();
    if (await q15btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await q15btn.click();
      await page.waitForTimeout(1000);
    }
  }
  
  await page.screenshot({ path: `${SCREENSHOTS}/frq_flow_01_q15.png`, fullPage: true });
  const q15Text = await page.locator('body').textContent();
  console.log('Q15 TEXT:', q15Text.substring(0, 200));
  
  // Click "Review →" button  
  const reviewBtn = page.locator('button:has-text("Review →")').first();
  const reviewBtnCount = await page.locator('button').filter({ hasText: 'Review →' }).count();
  console.log(`Review → button count: ${reviewBtnCount}`);
  
  if (await reviewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Clicking Review →');
    await reviewBtn.click();
    await page.waitForTimeout(2000);
  }
  
  await page.screenshot({ path: `${SCREENSHOTS}/frq_flow_02_review.png`, fullPage: true });
  const reviewText = await page.locator('body').textContent();
  console.log('REVIEW TEXT:', reviewText.substring(0, 500));
  
  // Check if on review screen
  const isOnReview = /review your answers|answered:/i.test(reviewText);
  console.log(`On review screen: ${isOnReview}`);
  
  if (isOnReview) {
    // Submit section from review
    const subBtn = page.locator('button:has-text("Submit Section")').first();
    if (await subBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Clicking Submit Section');
      await subBtn.click();
      await page.waitForTimeout(5000);
    }
    
    await page.screenshot({ path: `${SCREENSHOTS}/frq_flow_03_after_submit.png`, fullPage: true });
    const afterText = await page.locator('body').textContent();
    console.log('AFTER SUBMIT TEXT:', afterText.substring(0, 600));
    
    const hasFRQ = /section 2|free response|frq|choose.*topic/i.test(afterText);
    console.log(`Has FRQ choice: ${hasFRQ}`);
    
    if (hasFRQ) {
      // Capture button structure
      const btns = page.locator('button');
      const count = await btns.count();
      console.log('\n=== BUTTONS ON FRQ CHOICE ===');
      for (let i = 0; i < Math.min(count, 20); i++) {
        const t = await btns.nth(i).textContent();
        const v = await btns.nth(i).isVisible().catch(() => false);
        if (v) console.log(`  [${i}] "${t?.trim().substring(0, 80)}"`);
      }
      
      // Look for "Start Section 2" or topic buttons
      const startBtn = page.locator('button').filter({ hasText: /start.*section|begin/i }).first();
      if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        const startText = await startBtn.textContent();
        console.log(`Starting FRQ: "${startText?.trim()}"`);
        await startBtn.click();
        await page.waitForTimeout(3000);
      }
      
      await page.screenshot({ path: `${SCREENSHOTS}/frq_flow_04_frq_started.png`, fullPage: true });
      const frqText = await page.locator('body').textContent();
      console.log('FRQ SCREEN TEXT:', frqText.substring(0, 800));
      
      // Check for input areas
      const tas = page.locator('textarea');
      const taCount = await tas.count();
      console.log(`\nTextareas: ${taCount}`);
      
      // Inspect DOM for input areas
      const inputs = await page.evaluate(() => {
        const result = [];
        // Textarea
        document.querySelectorAll('textarea').forEach((el, i) => {
          result.push({ type: 'textarea', index: i, visible: el.offsetParent !== null });
        });
        // ContentEditable
        document.querySelectorAll('[contenteditable]').forEach((el, i) => {
          result.push({ type: 'contenteditable', index: i, value: el.contentEditable, visible: el.offsetParent !== null });
        });
        // Input[text]
        document.querySelectorAll('input[type="text"]').forEach((el, i) => {
          result.push({ type: 'input-text', index: i, visible: el.offsetParent !== null });
        });
        return result;
      });
      console.log('Input elements:', JSON.stringify(inputs, null, 2));
      
      // Also check all button texts on FRQ
      const btnsFRQ = page.locator('button');
      const bcount = await btnsFRQ.count();
      console.log('\n=== BUTTONS ON FRQ SCREEN ===');
      for (let i = 0; i < Math.min(bcount, 30); i++) {
        const t = await btnsFRQ.nth(i).textContent();
        const v = await btnsFRQ.nth(i).isVisible().catch(() => false);
        if (v) console.log(`  [${i}] "${t?.trim().substring(0, 80)}"`);
      }
    }
  }
});
