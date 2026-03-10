const { chromium } = require('playwright');
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));

  // Login
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', 'teacher@apboost.test');
  await page.fill('input[type="password"]', 'Teacher123!');
  await page.click('button[type="submit"]');
  await sleep(4000);
  await page.goto('http://localhost:5173/ap');
  await sleep(2000);
  console.log('At AP dashboard');

  // Click Macro
  const macroCard = page.locator('h3').filter({ hasText: /Macro/ });
  await macroCard.first().click();
  await page.waitForURL(/\/ap\/test\//, { timeout: 10000 });
  await sleep(1500);

  if (await page.locator('button:has-text("Resume Test")').count() > 0) {
    await page.click('button:has-text("Resume Test")');
  } else {
    await page.click('button:has-text("Begin Test")');
  }
  await sleep(2000);

  const inFRQ = await page.locator('text=Choose how you').count() > 0;
  if (inFRQ) {
    console.log('NOTE: In FRQ choice from resume');
    await page.locator('button:has-text("Type Your Answers")').click();
    await sleep(1000);
    // Check FRQ UI and navigate to report card
    const frqTA = await page.locator('textarea').count() > 0;
    console.log('FRQ textarea after resume:', frqTA);
    let loop = 0;
    while (loop < 20) {
      const ta = page.locator('textarea');
      if (await ta.count() > 0) {
        const v = await ta.first().inputValue().catch(() => '');
        if (!v) { await ta.first().fill('Test FRQ answer.'); await sleep(100); }
      }
      const revB = page.locator('button:has-text("Review")');
      const nxtB = page.locator('button:has-text("Next")').last();
      if (await revB.count() > 0 && await revB.first().isEnabled()) {
        await revB.first().click(); await sleep(800); break;
      } else if (await nxtB.count() > 0 && await nxtB.isEnabled()) {
        await nxtB.click(); await sleep(300);
      } else { break; }
      loop++;
    }
    const submitTestFinal = page.locator('button:has-text("Submit Test")');
    if (await submitTestFinal.count() > 0) {
      await submitTestFinal.first().click();
      await sleep(8000);
      console.log('Submit done. URL:', page.url());
    }
    await browser.close();
    return;
  }

  console.log('In MCQ section');
  const inTest = await page.locator('[aria-label="Open menu"]').count() > 0;
  console.log('In test (hamburger visible):', inTest);

  // Answer Q1-Q5
  const ansChoiceSel = 'button[class*="flex-1 flex items-start"]';
  for (let q = 1; q <= 5; q++) {
    const qVis = await page.locator('text=Question ' + q).count() > 0;
    const choices = page.locator(ansChoiceSel);
    const cCount = await choices.count();
    if (cCount > 0) { await choices.first().click(); await sleep(200); }

    if (q === 3 || q === 4) {
      const flagBtn = page.locator('button:has-text("Flag for Review")');
      if (await flagBtn.count() > 0) {
        await flagBtn.first().click();
        await sleep(200);
        const flagged = await page.locator('button:has-text("Flagged")').count() > 0;
        console.log('Q' + q + ' flagged:', flagged);
      }
    }

    if (q < 5) {
      const nxt = page.locator('button:has-text("Next")').last();
      if (await nxt.count() > 0 && await nxt.isEnabled()) { await nxt.click(); await sleep(300); }
    }
  }
  console.log('Q1-Q5 answered');

  // Navigate to Q15 via navigator
  const centerNav = page.locator('button').filter({ hasText: /Question 5 of/ });
  if (await centerNav.count() > 0) {
    await centerNav.first().click();
    await sleep(600);

    const navVis = await page.locator('text=Question Navigator').count() > 0;
    console.log('Navigator visible:', navVis);

    if (navVis) {
      const allBtns = await page.locator('button').all();
      for (const btn of allBtns) {
        const txt = await btn.textContent().catch(() => '');
        if (txt.trim() === '15') {
          await btn.click();
          await sleep(600);
          const q15vis = await page.locator('text=Question 15').count() > 0;
          console.log('Q15 shown:', q15vis);
          break;
        }
      }
    }
  } else {
    // Use Next buttons
    for (let i = 5; i < 15; i++) {
      const nxt = page.locator('button:has-text("Next")').last();
      if (await nxt.count() > 0 && await nxt.isEnabled()) { await nxt.click(); await sleep(150); }
    }
  }

  // Answer Q15
  const q15Choices = page.locator(ansChoiceSel);
  const q15Count = await q15Choices.count();
  console.log('Q15 choice count:', q15Count);
  if (q15Count > 0) { await q15Choices.first().click(); await sleep(300); }

  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_q15_final.png' });

  // Get all button texts
  const allBtnTexts = await page.locator('button').allTextContents().catch(() => []);
  console.log('Available buttons at Q15:', JSON.stringify(allBtnTexts.filter(t => t.trim()).slice(0, 15)));

  // Go to Review
  const reviewBtn = page.locator('button:has-text("Review")');
  const revCount = await reviewBtn.count();
  console.log('Review button count:', revCount);

  if (revCount > 0) {
    await reviewBtn.first().click();
    await sleep(1000);
    await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_review_screen.png' });

    const reviewH = await page.locator('text=Review Your Answers').count() > 0;
    console.log('Review screen visible:', reviewH);

    const answeredLi = await page.locator('li').filter({ hasText: 'Answered:' }).first().textContent().catch(() => 'N/A');
    const unansweredLi = await page.locator('li').filter({ hasText: 'Unanswered:' }).first().textContent().catch(() => 'N/A');
    const flaggedLi = await page.locator('li').filter({ hasText: 'Flagged:' }).first().textContent().catch(() => 'N/A');
    console.log('Answered:', answeredLi);
    console.log('Unanswered:', unansweredLi);
    console.log('Flagged:', flaggedLi);

    const unanswWarn = await page.locator('text=unanswered question').count() > 0;
    console.log('Unanswered warning:', unanswWarn);

    const submitSection = await page.locator('button:has-text("Submit Section")').count() > 0;
    const submitTest = await page.locator('button:has-text("Submit Test")').count() > 0;
    console.log('Submit Section:', submitSection, '| Submit Test:', submitTest);

    if (submitSection) {
      await page.click('button:has-text("Submit Section")');
      await sleep(2500);
      await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_frq_choice_screen.png' });
      console.log('After Submit Section. URL:', page.url());

      const frqChoice = await page.locator('text=Free Response Section').count() > 0;
      const typeOpt = await page.locator('text=Type Your Answers').count() > 0;
      const handOpt = await page.locator('text=Write by Hand').count() > 0;
      console.log('FRQ choice screen:', frqChoice);
      console.log('Type Your Answers:', typeOpt, '| Write by Hand:', handOpt);

      const timerInFRQ = await page.locator('[class*="mono"]').count() > 0;
      console.log('Timer in FRQ choice screen:', timerInFRQ);

      if (typeOpt) {
        await page.locator('button:has-text("Type Your Answers")').click();
        await sleep(1000);
        await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_frq_section.png' });

        const frqTA = await page.locator('textarea').count() > 0;
        console.log('FRQ textarea:', frqTA);

        const secHeader = await page.locator('header span').filter({ hasText: 'Section' }).textContent().catch(() => 'N/A');
        console.log('Section header in FRQ mode:', secHeader);

        const lockIcon = await page.locator('text=Locked').count() > 0;
        console.log('Lock indicator visible:', lockIcon);

        const backDisabled = await page.locator('button:has-text("Back")').first().isDisabled().catch(() => null);
        console.log('Back disabled in FRQ section 1st Q:', backDisabled);

        // Navigate and submit
        let loop = 0;
        while (loop < 20) {
          const ta = page.locator('textarea');
          if (await ta.count() > 0) {
            const v = await ta.first().inputValue().catch(() => '');
            if (!v) { await ta.first().fill('Test FRQ answer.'); await sleep(100); }
          }
          const revB = page.locator('button:has-text("Review")');
          const nxtB = page.locator('button:has-text("Next")').last();
          if (await revB.count() > 0 && await revB.first().isEnabled()) {
            await revB.first().click(); await sleep(800); break;
          } else if (await nxtB.count() > 0 && await nxtB.isEnabled()) {
            await nxtB.click(); await sleep(300);
          } else { break; }
          loop++;
        }

        await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_frq_review_final.png' });
        const finalSub = page.locator('button:has-text("Submit Test")');
        if (await finalSub.count() > 0) {
          await finalSub.first().click();
          await sleep(8000);
          console.log('Final submit URL:', page.url());

          if (page.url().includes('/results/')) {
            await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_report_card.png' });
            const scoreRpt = await page.locator('text=SCORE REPORT').count() > 0;
            const mcqTbl = await page.locator('table').count() > 0;
            const backDash = await page.locator('text=Back to Dashboard').count() > 0;
            const dlPDF = await page.locator('text=Download PDF').count() > 0;
            console.log('SCORE REPORT:', scoreRpt, '| MCQ table:', mcqTbl);
            console.log('Back to Dashboard:', backDash, '| Download PDF:', dlPDF);
          }
        }
      }
    }
  }

  const errors = logs.filter(l => l.type === 'error');
  console.log('\nErrors:', errors.length);
  errors.forEach(e => console.log(' E:', e.text.substring(0, 200)));

  await browser.close();
  console.log('Done');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
