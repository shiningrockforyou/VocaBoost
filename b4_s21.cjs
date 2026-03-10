const { chromium } = require('playwright');
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));

  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', 'teacher@apboost.test');
  await page.fill('input[type="password"]', 'Teacher123!');
  await page.click('button[type="submit"]');
  await sleep(4000);
  await page.goto('http://localhost:5173/ap');
  await sleep(2000);

  await page.goto('http://localhost:5173/ap/test/test_calc_ab_full_1');
  await sleep(2000);

  console.log('=== S-21 FLAG & ANSWER RESTORATION TEST ===');
  const isResuming = await page.locator('button:has-text("Resume Test")').count() > 0;
  console.log('isResuming:', isResuming);

  if (isResuming) {
    const resumeInfo = await page.locator('text=Resume from').textContent().catch(() => 'N/A');
    console.log('Resume from text:', resumeInfo);
    await page.click('button:has-text("Resume Test")');
  } else {
    await page.click('button:has-text("Begin Test")');
  }
  await sleep(2000);

  const inFRQ = await page.locator('text=Choose how you').count() > 0;
  if (inFRQ) {
    await page.locator('button:has-text("Type Your Answers")').click();
    await sleep(1000);
  }

  // Go to Q1
  const backBtn = page.locator('button:has-text("Back")').first();
  let onQ1 = await page.locator('text=Question 1').count() > 0;
  if (onQ1 === false) {
    let tries = 0;
    while (tries < 10) {
      const isEnabled = await backBtn.isEnabled().catch(() => false);
      if (isEnabled === false) break;
      await backBtn.click();
      await sleep(300);
      const check = await page.locator('text=Question 1').count() > 0;
      if (check) { onQ1 = true; break; }
      tries++;
    }
  }
  console.log('On Q1:', onQ1);

  // Check initial state
  const q1FlaggedInit = await page.locator('button:has-text("Flagged")').count() > 0;
  const q1FlagForReviewInit = await page.locator('button:has-text("Flag for Review")').count() > 0;
  const brandPrimaryInit = await page.locator('[class*="bg-brand-primary"]').count();
  console.log('Initial Q1 state - Flagged:', q1FlaggedInit, '| FlagForReview:', q1FlagForReviewInit);
  console.log('Initial brand-primary count:', brandPrimaryInit);

  // If not already flagged, flag it
  if (q1FlagForReviewInit) {
    await page.locator('button:has-text("Flag for Review")').first().click();
    await sleep(500);
    const nowFlagged = await page.locator('button:has-text("Flagged")').count() > 0;
    console.log('Q1 flagged:', nowFlagged);
  }

  // If no answer selected, select B
  const answerChosen = await page.locator('[class*="bg-brand-primary"]').count();
  if (answerChosen === 0) {
    const choiceBtns = page.locator('button[class*="flex-1 flex items-start"]');
    const cCount = await choiceBtns.count();
    if (cCount >= 2) {
      await choiceBtns.nth(1).click(); // B
      await sleep(500);
      console.log('Selected answer B on Q1');
    }
  } else {
    console.log('Q1 already has an answer selected');
  }

  const t1 = await page.locator('[class*="mono"]').first().textContent().catch(() => 'N/A');
  console.log('Timer before refresh:', t1);

  // Wait a moment for queue to process
  await sleep(3000);
  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s21_before_refresh.png' });

  // REFRESH
  console.log('\n--- REFRESHING ---');
  await page.reload({ timeout: 20000 });
  await sleep(5000);

  const resumeAfterR = await page.locator('button:has-text("Resume Test")').count() > 0;
  const beginAfterR = await page.locator('button:has-text("Begin Test")').count() > 0;
  const resumeInfoAfterR = await page.locator('text=Resume from').count() > 0;
  const inTestAfterR = await page.locator('[aria-label="Open menu"]').count() > 0;

  console.log('After refresh - Resume:', resumeAfterR, '| Begin:', beginAfterR);
  console.log('Resume from info:', resumeInfoAfterR, '| In testing:', inTestAfterR);

  if (resumeAfterR && resumeInfoAfterR) {
    const rt = await page.locator('text=Resume from').textContent().catch(() => 'N/A');
    console.log('Resume position:', rt);
  }

  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s21_after_refresh.png' });

  // S-21 PASS/FAIL assessment
  if (resumeAfterR && resumeInfoAfterR) {
    console.log('S-21 RESUME UI: PASS - Resume Test button + position info shown');
  } else if (inTestAfterR) {
    console.log('S-21 RESUME UI: ISSUE - Auto-transitioned to testing without showing resume UI');
  } else {
    console.log('S-21 RESUME UI: FAIL - Neither resume UI nor testing view shown');
  }

  if (resumeAfterR) {
    await page.click('button:has-text("Resume Test")');
    await sleep(2000);
  }

  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s21_after_resume.png' });

  // Navigate to Q1 and check state restoration
  let onQ1After = await page.locator('text=Question 1').count() > 0;
  if (onQ1After === false) {
    const backBtn2 = page.locator('button:has-text("Back")').first();
    let tries2 = 0;
    while (tries2 < 10) {
      const isEnabled2 = await backBtn2.isEnabled().catch(() => false);
      if (isEnabled2 === false) break;
      await backBtn2.click();
      await sleep(300);
      const check2 = await page.locator('text=Question 1').count() > 0;
      if (check2) { onQ1After = true; break; }
      tries2++;
    }
  }

  const q1FlaggedAfter = await page.locator('button:has-text("Flagged")').count() > 0;
  const q1FlagReviewAfter = await page.locator('button:has-text("Flag for Review")').count() > 0;
  const brandPrimaryAfter = await page.locator('[class*="bg-brand-primary"]').count();
  const t2 = await page.locator('[class*="mono"]').first().textContent().catch(() => 'N/A');

  console.log('\n=== STATE RESTORATION AFTER RESUME ===');
  console.log('On Q1:', onQ1After);
  console.log('Q1 flag - Flagged:', q1FlaggedAfter, '| Flag for Review:', q1FlagReviewAfter);
  console.log('Answer selected (brand-primary count):', brandPrimaryAfter);
  console.log('Timer before refresh:', t1, '| Timer after resume:', t2);
  console.log('Flag restored:', q1FlaggedAfter);
  console.log('Answer restored (brand-primary > 0):', brandPrimaryAfter > 0);

  if (q1FlaggedAfter && brandPrimaryAfter > 0) {
    console.log('S-21 STATE RESTORATION: PASS');
  } else {
    console.log('S-21 STATE RESTORATION: PARTIAL/FAIL');
    if (!q1FlaggedAfter) console.log('  - Flag NOT restored');
    if (brandPrimaryAfter === 0) console.log('  - Answer NOT restored');
  }

  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s21_restored.png' });

  const errors = logs.filter(l => l.type === 'error');
  console.log('\nErrors:', errors.length);
  errors.forEach(e => console.log(' E:', e.text.substring(0, 200)));

  await browser.close();
  console.log('Done');
})().catch(e => { console.error('FATAL:', e.message); });
