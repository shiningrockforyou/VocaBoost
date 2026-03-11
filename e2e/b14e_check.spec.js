import { test } from '@playwright/test';
import fs from 'fs';

const SCREENSHOTS = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_B14E';

test('B14-E check: inspect answer choice structure', async ({ page }) => {
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
  
  // Look for begin button and click it
  const beginBtn = page.locator('button:has-text("Begin Test")').first();
  if (await beginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await beginBtn.click();
    await page.waitForTimeout(2000);
  }
  
  // Check all buttons on the page
  const btns = page.locator('button');
  const btnCount = await btns.count();
  console.log('\n=== PAGE BUTTONS ===');
  for (let i = 0; i < Math.min(btnCount, 20); i++) {
    const text = await btns.nth(i).textContent();
    const ariaLabel = await btns.nth(i).getAttribute('aria-label');
    const classes = await btns.nth(i).getAttribute('class');
    console.log(`Button[${i}]: text="${text?.trim().substring(0,60)}" aria="${ariaLabel}" class="${classes?.substring(0,60)}"`);
  }
  
  // Check for radio inputs
  const radios = page.locator('input[type="radio"]');
  const radioCount = await radios.count();
  console.log(`\n=== RADIO INPUTS: ${radioCount} ===`);
  
  // Check body text
  const bodyText = await page.locator('body').textContent();
  console.log('\n=== BODY TEXT SNIPPET ===');
  console.log(bodyText.substring(0, 500));
  
  await page.screenshot({ path: `${SCREENSHOTS}/check_q1_structure.png`, fullPage: true });
  
  // Try to click the first answer choice
  // Look for buttons with single letter labels (A, B, C, D)
  const lettersToCheck = ['A', 'B', 'C', 'D'];
  for (const letter of lettersToCheck) {
    // Look for buttons that contain just a letter
    const letterBtn = page.locator(`button`).filter({ hasText: new RegExp(`^\s*${letter}\s*$`) }).first();
    const letterBtnCount = await page.locator('button').filter({ hasText: new RegExp(`^\s*${letter}\s*$`) }).count();
    console.log(`\nLetter "${letter}" buttons found: ${letterBtnCount}`);
    if (letterBtnCount > 0) {
      const text = await letterBtn.textContent();
      const cls = await letterBtn.getAttribute('class');
      console.log(`  text="${text?.trim()}" class="${cls?.substring(0,60)}"`);
    }
  }
  
  // Check the actual answer state via React internals or aria
  const answeredState = await page.evaluate(() => {
    // Try to find React fiber / state 
    const radioInputs = document.querySelectorAll('input[type="radio"]');
    const checkedRadios = Array.from(radioInputs).filter(r => r.checked);
    
    // Try to find selected answer buttons
    const allBtns = document.querySelectorAll('button');
    const selectedAnswerBtns = Array.from(allBtns).filter(b => {
      const cls = b.className;
      return /bg-brand-primary/.test(cls) || /selected/.test(cls) || /active/.test(cls);
    });
    
    return {
      radioInputCount: radioInputs.length,
      checkedRadioCount: checkedRadios.length,
      selectedAnswerBtnCount: selectedAnswerBtns.length,
      selectedAnswerBtnText: selectedAnswerBtns.map(b => b.textContent?.trim().substring(0, 40)),
    };
  });
  
  console.log('\n=== ANSWER STATE ===');
  console.log(JSON.stringify(answeredState, null, 2));
});
