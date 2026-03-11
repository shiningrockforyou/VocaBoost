import { test } from '@playwright/test';
import fs from 'fs';

const SCREENSHOTS = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_B14E';

test('B14-E: FRQ choice screen inspection', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"]');
  await page.locator('input[type="email"]').fill('student8@apboost.test');
  await page.locator('input[type="password"]').fill('Student123!');
  await page.keyboard.press('Enter');
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20000 });
  
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await page.waitForTimeout(3000);
  
  // Resume test
  const resumeBtn = page.locator('button:has-text("Resume Test")').first();
  if (await resumeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await resumeBtn.click();
    await page.waitForTimeout(2000);
  }
  
  // Navigate to Q15 and go to review
  // Try clicking the navigator to jump to Q15
  const qCounterBtn = page.locator('button').filter({ hasText: /of 15/ }).first();
  if (await qCounterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await qCounterBtn.click();
    await page.waitForTimeout(1000);
    
    // Click Q15 in navigator
    const q15btn = page.locator('button').filter({ hasText: /^\s*15\s*$/ }).first();
    if (await q15btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await q15btn.click();
      await page.waitForTimeout(1000);
    }
  }
  
  // Go to review
  const reviewBtn = page.locator('button').filter({ hasText: /Review/ }).first();
  if (await reviewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await reviewBtn.click();
    await page.waitForTimeout(2000);
  }
  
  await page.screenshot({ path: `${SCREENSHOTS}/frq_check_01_review.png`, fullPage: true });
  const reviewText = await page.locator('body').textContent();
  console.log('REVIEW TEXT:', reviewText.substring(0, 400));
  
  // Submit section
  const submitBtn = page.locator('button:has-text("Submit Section")').first();
  if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await submitBtn.click();
    await page.waitForTimeout(5000);
  }
  
  await page.screenshot({ path: `${SCREENSHOTS}/frq_check_02_after_submit.png`, fullPage: true });
  const afterText = await page.locator('body').textContent();
  console.log('AFTER SUBMIT TEXT:', afterText.substring(0, 500));
  
  // Check all buttons
  const btns = page.locator('button');
  const btnCount = await btns.count();
  console.log('\n=== BUTTONS AFTER MCQ SUBMIT ===');
  for (let i = 0; i < Math.min(btnCount, 30); i++) {
    const text = await btns.nth(i).textContent();
    const isVis = await btns.nth(i).isVisible().catch(() => false);
    if (isVis) {
      console.log(`Button[${i}]: "${text?.trim().substring(0, 80)}"`);
    }
  }
  
  // Try to start FRQ
  const startFrqBtn = page.locator('button').filter({ hasText: /start|begin|section 2/i }).first();
  if (await startFrqBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    const btnText = await startFrqBtn.textContent();
    console.log(`\nStarting FRQ with button: "${btnText?.trim()}"`);
    await startFrqBtn.click();
    await page.waitForTimeout(3000);
  }
  
  await page.screenshot({ path: `${SCREENSHOTS}/frq_check_03_frq_started.png`, fullPage: true });
  const frqText = await page.locator('body').textContent();
  console.log('\nFRQ SCREEN TEXT:', frqText.substring(0, 800));
  
  // Check for textareas
  const tas = page.locator('textarea');
  const taCount = await tas.count();
  console.log(`\n=== TEXTAREAS: ${taCount} ===`);
  
  // Check for input elements
  const inputs = page.locator('input');
  const inputCount = await inputs.count();
  console.log(`=== INPUTS: ${inputCount} ===`);
  
  // Check contenteditable
  const editables = page.locator('[contenteditable="true"]');
  const editCount = await editables.count();
  console.log(`=== CONTENTEDITABLE: ${editCount} ===`);
  
  // Check all buttons
  const btns2 = page.locator('button');
  const btnCount2 = await btns2.count();
  console.log('\n=== BUTTONS ON FRQ SCREEN ===');
  for (let i = 0; i < Math.min(btnCount2, 30); i++) {
    const text = await btns2.nth(i).textContent();
    const isVis = await btns2.nth(i).isVisible().catch(() => false);
    if (isVis) console.log(`Button[${i}]: "${text?.trim().substring(0, 80)}"`);
  }
  
  // Check DOM structure for FRQ input
  const frqInputInfo = await page.evaluate(() => {
    const allInputs = document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]');
    return Array.from(allInputs).map(el => ({
      tag: el.tagName,
      type: el.type,
      contentEditable: el.contentEditable,
      className: el.className.substring(0, 60),
      isVisible: el.offsetParent !== null,
    }));
  });
  console.log('\n=== FRQ INPUT ELEMENTS ===');
  console.log(JSON.stringify(frqInputInfo, null, 2));
});
