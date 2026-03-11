import { test } from '@playwright/test';
import fs from 'fs';

const SCREENSHOTS = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_B14E';

test('B14-E check2: inspect answer structure on question screen', async ({ page }) => {
  // Login
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"]');
  await page.locator('input[type="email"]').fill('student8@apboost.test');
  await page.locator('input[type="password"]').fill('Student123!');
  await page.keyboard.press('Enter');
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20000 });
  
  // Navigate to test
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await page.waitForTimeout(3000);
  
  // Handle resume dialog or begin test
  const bodyText1 = await page.locator('body').textContent();
  console.log('Initial page text:', bodyText1.substring(0, 200));
  
  // Try Resume Test first (continue existing session)
  const resumeBtn = page.locator('button:has-text("Resume Test")').first();
  const beginBtn = page.locator('button:has-text("Begin Test")').first();
  
  if (await resumeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Resume dialog visible — clicking Resume Test');
    await resumeBtn.click();
    await page.waitForTimeout(3000);
  } else if (await beginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Begin test visible — clicking Begin Test');
    await beginBtn.click();
    await page.waitForTimeout(3000);
  }
  
  const bodyText2 = await page.locator('body').textContent();
  console.log('After begin/resume:', bodyText2.substring(0, 300));
  
  await page.screenshot({ path: `${SCREENSHOTS}/check2_after_begin.png`, fullPage: true });
  
  // Now check buttons
  const btns = page.locator('button');
  const btnCount = await btns.count();
  console.log('\n=== VISIBLE BUTTONS ===');
  for (let i = 0; i < Math.min(btnCount, 25); i++) {
    const text = await btns.nth(i).textContent();
    const ariaLabel = await btns.nth(i).getAttribute('aria-label');
    const isVisible = await btns.nth(i).isVisible().catch(() => false);
    if (isVisible) {
      console.log(`Button[${i}]: text="${text?.trim().substring(0,60)}" aria="${ariaLabel}"`);
    }
  }
  
  // Check answer state
  const answeredState = await page.evaluate(() => {
    const allBtns = document.querySelectorAll('button');
    const selectedAnswerBtns = Array.from(allBtns).filter(b => {
      const cls = b.className;
      return /bg-brand-primary/.test(cls);
    });
    
    return {
      totalBtns: allBtns.length,
      selectedAnswerBtnCount: selectedAnswerBtns.length,
      selectedAnswerBtnText: selectedAnswerBtns.map(b => b.textContent?.trim().substring(0, 60)),
      selectedAnswerBtnClass: selectedAnswerBtns.map(b => b.className.substring(0, 80)),
    };
  });
  
  console.log('\n=== SELECTED ANSWER BUTTONS (bg-brand-primary) ===');
  console.log(JSON.stringify(answeredState, null, 2));
  
  // The answers we entered before should be selected (blue)
  // Get full DOM structure of answer area
  const answerAreaHtml = await page.evaluate(() => {
    // Look for .space-y-3 which is the answer container class
    const container = document.querySelector('.space-y-3');
    if (container) return container.innerHTML.substring(0, 1000);
    return 'Not found';
  });
  console.log('\n=== ANSWER AREA HTML (first 1000 chars) ===');
  console.log(answerAreaHtml);
});
