const { chromium } = require('playwright');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function closeAnyModal(page) {
  // Try to close any open modal by pressing Escape or clicking backdrop
  await page.keyboard.press('Escape');
  await sleep(300);
  // Also try clicking outside if backdrop visible
  const backdrop = page.locator('.fixed.inset-0.bg-black\\/50, .fixed.inset-0.z-50 > div.absolute.inset-0');
  if (await backdrop.count() > 0) {
    await backdrop.first().click({ position: { x: 10, y: 10 } });
    await sleep(300);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => logs.push({ type: 'pageerror', text: err.message }));

  // LOGIN (teacher account - can access /ap routes)
  console.log('=== LOGIN ===');
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', 'teacher@apboost.test');
  await page.fill('input[type="password"]', 'Teacher123!');
  await page.click('button[type="submit"]');
  await sleep(4000);
  await page.goto('http://localhost:5173/ap');
  await sleep(2000);
  console.log('At AP dashboard. URL:', page.url());
  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_01_dashboard.png' });

  const h1 = await page.locator('h1').first().textContent().catch(() => 'N/A');
  console.log('Dashboard h1:', h1);
  const cards = await page.locator('h3').allTextContents().catch(() => []);
  console.log('Cards:', JSON.stringify(cards));

  // ============================================================
  // S-21 DEEP VERIFICATION (Session Resume After Refresh)
  // From prior run we know: Resume Test button + "Resume from" info appears
  // Now we need to verify: Q1 flag restored, Q1 answer restored, timer restored
  // ============================================================
  console.log('\n=== S-21: SESSION RESUME - FULL VERIFICATION ===');

  // Navigate to Calc test (which has an in-progress session from previous run)
  const calcCard = page.locator('h3').filter({ hasText: /Calc/ });
  await calcCard.first().click();
  await page.waitForURL(/\/ap\/test\//, { timeout: 10000 });
  await sleep(1500);
  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s21_01_instruction.png' });

  const hasResume = await page.locator('button:has-text("Resume Test")').count() > 0;
  const hasBegin = await page.locator('button:has-text("Begin Test")').count() > 0;
  const hasResumeInfo = await page.locator('text=Resume from').count() > 0;
  console.log('Resume Test button:', hasResume);
  console.log('Begin Test button:', hasBegin);
  console.log('Resume from info:', hasResumeInfo);

  if (hasResumeInfo) {
    const resumeText = await page.locator('text=Resume from').textContent().catch(() => 'N/A');
    console.log('Resume position:', resumeText);
  }

  // Also verify instruction screen elements (S-02 cross-check)
  const instrH1 = await page.locator('h1').first().textContent().catch(() => 'N/A');
  const hasFRQInfo = await page.locator('text=Free Response Section').count() > 0;
  const hasTimerWarn = await page.locator('text=cannot pause the timer').count() > 0;
  const hasSectionsWarn = await page.locator('text=cannot return to previous').count() > 0;
  const hasCancel = await page.locator('button:has-text("Cancel")').count() > 0;
  console.log('Instruction h1:', instrH1);
  console.log('FRQ info box:', hasFRQInfo);
  console.log('Timer warning:', hasTimerWarn);
  console.log('Sections warning:', hasSectionsWarn);
  console.log('Cancel button:', hasCancel);

  // Click Resume Test
  if (hasResume) {
    await page.click('button:has-text("Resume Test")');
  } else {
    await page.click('button:has-text("Begin Test")');
  }
  await sleep(2000);
  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s21_02_after_resume.png' });
  console.log('After resume click. URL:', page.url());

  // Check if FRQ choice (Calc test may be in FRQ section)
  const inFRQChoice = await page.locator('text=Choose how you').count() > 0;
  if (inFRQChoice) {
    console.log('NOTE: Calc session in FRQ choice screen');
    await page.locator('button:has-text("Type Your Answers")').click();
    await sleep(1000);
  }

  const inTesting = await page.locator('[aria-label="Open menu"]').count() > 0;
  console.log('In testing view:', inTesting);

  const timerVal1 = await page.locator('[class*="mono"]').first().textContent().catch(() => 'N/A');
  console.log('Timer value (should be counting):', timerVal1);
  await sleep(2000);
  const timerVal2 = await page.locator('[class*="mono"]').first().textContent().catch(() => 'N/A');
  console.log('Timer 2s later (should be different):', timerVal2);
  console.log('Timer counting down:', timerVal1 !== timerVal2);

  // Navigate to Q1 to check flag restoration
  const currentQ = await page.locator('text=Question').first().textContent().catch(() => 'N/A');
  console.log('Current question:', currentQ);

  // If on Q2, go back to Q1
  const backBtn = page.locator('button:has-text("Back")');
  if (await backBtn.count() > 0 && !(await backBtn.first().isDisabled().catch(() => true))) {
    await backBtn.first().click();
    await sleep(500);
  }

  // Check Q1 state
  const q1Text = await page.locator('text=Question 1').count() > 0;
  console.log('Q1 displayed:', q1Text);

  const q1Flagged = await page.locator('button:has-text("Flagged")').count() > 0;
  const q1FlagReview = await page.locator('button:has-text("Flag for Review")').count() > 0;
  console.log('Q1 flag state - Flagged:', q1Flagged, 'Flag for Review:', q1FlagReview);

  // Check Q1 answer (should show B selected = brand-primary)
  const selectedChoices = await page.locator('[class*="bg-brand-primary"]').count();
  console.log('Selected answer elements (brand-primary):', selectedChoices);

  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s21_03_q1_state.png' });

  // Now refresh page again to test resume flow properly
  console.log('\n--- Second Refresh Test ---');
  await page.reload({ timeout: 20000 });
  await sleep(4000);
  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s21_04_second_refresh.png' });

  const resumeAfter2 = await page.locator('button:has-text("Resume Test")').count() > 0;
  const resumeInfo2 = await page.locator('text=Resume from').count() > 0;
  const inTestingAfter2 = await page.locator('[aria-label="Open menu"]').count() > 0;
  console.log('After 2nd refresh - Resume Test:', resumeAfter2);
  console.log('After 2nd refresh - Resume from info:', resumeInfo2);
  console.log('After 2nd refresh - In testing:', inTestingAfter2);

  if (resumeInfo2) {
    const rt = await page.locator('text=Resume from').textContent().catch(() => 'N/A');
    console.log('Resume position text:', rt);
  }

  // Resume again
  if (resumeAfter2) {
    await page.click('button:has-text("Resume Test")');
    await sleep(2000);
  }

  // ============================================================
  // S-20: HAMBURGER MENU (clean start after modal issues)
  // ============================================================
  console.log('\n=== S-20: HAMBURGER MENU ===');

  // Close any open modals first
  await closeAnyModal(page);

  const hamBtn = page.locator('[aria-label="Open menu"]');
  const hamCount = await hamBtn.count();
  console.log('Hamburger count:', hamCount);

  if (hamCount > 0) {
    await hamBtn.click({ force: false });
    await sleep(600);
    await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s20_01_menu_open.png' });

    // Verify menu elements
    const menuH3 = await page.locator('h3').filter({ hasText: 'Menu' }).count() > 0;
    const goToQ = await page.locator('button').filter({ hasText: 'Go to Question' }).count() > 0;
    const exitT = await page.locator('button').filter({ hasText: 'Exit Test' }).count() > 0;
    console.log('Menu h3 "Menu":', menuH3);
    console.log('Go to Question button:', goToQ);
    console.log('Exit Test button:', exitT);

    // Verify close button icon type
    const closeBtn = page.locator('[aria-label="Close menu"]');
    if (await closeBtn.count() > 0) {
      const closeHTML = await closeBtn.innerHTML().catch(() => '');
      const isSVG = closeHTML.includes('<svg');
      const isLowercaseX = closeHTML.trim().toLowerCase() === 'x';
      console.log('Close button is SVG icon:', isSVG);
      console.log('Close button is lowercase "x" text:', isLowercaseX);
    }

    // Verify ARIA
    const dialog = page.locator('[role="dialog"]');
    const dialogCount = await dialog.count();
    const ariaLabel = await dialog.getAttribute('aria-label').catch(() => null);
    const ariaModal = await dialog.getAttribute('aria-modal').catch(() => null);
    const ariaLabelledby = await dialog.getAttribute('aria-labelledby').catch(() => null);
    console.log('role="dialog" present:', dialogCount > 0);
    console.log('aria-label:', ariaLabel);
    console.log('aria-modal:', ariaModal);
    console.log('aria-labelledby:', ariaLabelledby);

    // Verify Exit Test button has error styling
    const exitBtnClass = await page.locator('button').filter({ hasText: 'Exit Test' }).first().getAttribute('class').catch(() => '');
    console.log('Exit Test button class:', exitBtnClass);
    const hasErrorColor = exitBtnClass.includes('error');
    console.log('Exit Test has error color class:', hasErrorColor);

    // Test Go to Question -> opens navigator -> closes -> back to test
    if (goToQ) {
      await page.locator('button').filter({ hasText: 'Go to Question' }).first().click();
      await sleep(600);
      await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s20_02_navigator_from_menu.png' });
      const navVis = await page.locator('text=Question Navigator').count() > 0;
      console.log('Navigator opened from menu:', navVis);

      // Close navigator by clicking backdrop or Escape
      await page.keyboard.press('Escape');
      await sleep(500);

      // Check that navigator closed
      const navClosed = await page.locator('text=Question Navigator').count() === 0;
      console.log('Navigator closed:', navClosed);
    }

    // Ensure menu is closed before reopening
    await closeAnyModal(page);
    await sleep(400);

    // Reopen menu for Exit Test test
    await hamBtn.click({ force: true });
    await sleep(500);

    // Click Exit Test
    const exitTestBtn = page.locator('button').filter({ hasText: 'Exit Test' });
    if (await exitTestBtn.count() > 0) {
      await exitTestBtn.first().click();
      await sleep(500);
      await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s20_03_exit_confirm.png' });

      // Verify exit confirmation
      const exitConfirmH3 = await page.locator('h3').filter({ hasText: 'Exit Test?' }).count() > 0;
      const areYouSure = await page.locator('text=Are you sure').count() > 0;
      const progressSaved = await page.locator('text=progress will be saved').count() > 0;
      const cancelBtn = page.locator('button').filter({ hasText: 'Cancel' });
      const cancelCount = await cancelBtn.count();
      console.log('Exit confirm heading "Exit Test?":', exitConfirmH3);
      console.log('"Are you sure" text:', areYouSure);
      console.log('"progress will be saved" text:', progressSaved);
      console.log('Cancel button present:', cancelCount > 0);

      // Test Cancel button
      if (cancelCount > 0) {
        await cancelBtn.first().click();
        await sleep(500);
        // Menu should close, test should continue
        const menuClosed = await page.locator('h3').filter({ hasText: 'Menu' }).count() === 0;
        const testActive = await page.locator('[aria-label="Open menu"]').count() > 0;
        console.log('Menu closed after Cancel:', menuClosed);
        console.log('Test session still active:', testActive);
        await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s20_04_after_cancel.png' });
      }

      // Reopen and confirm Exit
      await hamBtn.click({ force: true });
      await sleep(500);

      const exitBtns = page.locator('button').filter({ hasText: 'Exit Test' });
      if (await exitBtns.count() > 0) {
        await exitBtns.first().click();
        await sleep(400);
        // Now confirm
        const confirmExit = page.locator('button').filter({ hasText: 'Exit Test' });
        const confirmCount = await confirmExit.count();
        if (confirmCount > 0) {
          await confirmExit.last().click();
          await sleep(2000);
          const afterExitUrl = page.url();
          console.log('After confirmed exit URL:', afterExitUrl);
          const atDashboard = afterExitUrl.includes('/ap') && !afterExitUrl.includes('/test/');
          console.log('Navigated to dashboard after exit:', atDashboard);
          await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s20_05_after_exit.png' });
        }
      }
    }
  }

  // ============================================================
  // S-19: MACRO TEST ABBREVIATED FLOW
  // ============================================================
  console.log('\n=== S-19: MACRO TEST ===');
  await page.goto('http://localhost:5173/ap');
  await sleep(2500);
  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s19_01_dashboard.png' });

  const macroCard = page.locator('h3').filter({ hasText: /Macro/ });
  if (await macroCard.count() > 0) {
    await macroCard.first().click();
    await page.waitForURL(/\/ap\/test\//, { timeout: 10000 });
    await sleep(1500);
    await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s19_02_instruction.png' });

    const macroH1 = await page.locator('h1').first().textContent().catch(() => 'N/A');
    console.log('Macro test h1:', macroH1);

    const macroResume = await page.locator('button:has-text("Resume Test")').count() > 0;
    const macroBegin = await page.locator('button:has-text("Begin Test")').count() > 0;
    console.log('Macro Resume:', macroResume, 'Begin:', macroBegin);

    if (macroResume) {
      await page.click('button:has-text("Resume Test")');
    } else {
      await page.click('button:has-text("Begin Test")');
    }
    await sleep(2000);
    await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s19_03_started.png' });
    console.log('Macro started. URL:', page.url());

    // If in FRQ choice already, handle it
    const inFRQChoiceMacro = await page.locator('text=Choose how you').count() > 0;
    if (inFRQChoiceMacro) {
      console.log('S-19: Macro already at FRQ choice (resumed from FRQ section)');
      await page.locator('button:has-text("Type Your Answers")').click();
      await sleep(1000);
      // Just verify FRQ interface exists
      const frqTA = await page.locator('textarea').count() > 0;
      console.log('FRQ textarea present:', frqTA);

      // Navigate to review and submit
      let loop = 0;
      while (loop < 20) {
        const ta = page.locator('textarea');
        if (await ta.count() > 0) {
          const v = await ta.first().inputValue().catch(() => '');
          if (!v) { await ta.first().fill('Brief answer.'); await sleep(100); }
        }
        const revB = page.locator('button:has-text("Review")');
        const nxtB = page.locator('button:has-text("Next")').last();
        if (await revB.count() > 0 && await revB.first().isEnabled()) {
          await revB.first().click();
          await sleep(800);
          break;
        } else if (await nxtB.count() > 0 && await nxtB.isEnabled()) {
          await nxtB.click();
          await sleep(250);
        } else { break; }
        loop++;
      }
      const finalSub = page.locator('button:has-text("Submit Test")');
      if (await finalSub.count() > 0) {
        await finalSub.first().click();
        await sleep(6000);
        console.log('After FRQ submit URL:', page.url());
      }
    } else {
      // MCQ section - execute abbreviated flow
      // Answer Q1-Q5 with A, flag Q3/Q4
      for (let i = 1; i <= 5; i++) {
        const qVis = await page.locator('text=Question ' + i).count() > 0;

        const cBtns = await page.locator('button').filter({ hasText: /^[ABCD]$/ }).all();
        if (cBtns.length > 0) {
          await cBtns[0].click();
          await sleep(200);
        }

        if (i === 3 || i === 4) {
          const flg = page.locator('button').filter({ hasText: 'Flag for Review' });
          if (await flg.count() > 0) {
            await flg.first().click();
            await sleep(200);
            console.log('Flagged Q' + i + ':', qVis);
          }
        }

        if (i < 5) {
          const nxt = page.locator('button:has-text("Next")').last();
          if (await nxt.count() > 0 && await nxt.isEnabled()) {
            await nxt.click();
            await sleep(250);
          }
        }
      }
      await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s19_04_q5.png' });

      // Open navigator to verify states
      const centerNavBtn = page.locator('button').filter({ hasText: /Question \d+ of \d+/ });
      if (await centerNavBtn.count() > 0) {
        await centerNavBtn.first().click();
        await sleep(600);
        await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s19_05_navigator.png' });

        const navVis = await page.locator('text=Question Navigator').count() > 0;
        console.log('Navigator visible:', navVis);

        if (navVis) {
          const navGrid = await page.locator('[class*="bg-brand-primary"]').count();
          console.log('Answered boxes in navigator:', navGrid);

          // Navigate to Q15
          const allBtns = await page.locator('button').all();
          let foundQ15 = false;
          for (const btn of allBtns) {
            const txt = await btn.textContent().catch(() => '');
            if (txt.trim() === '15') {
              await btn.click();
              await sleep(500);
              foundQ15 = true;
              const q15shown = await page.locator('text=Question 15').count() > 0;
              console.log('Q15 shown after navigator click:', q15shown);
              break;
            }
          }
          if (!foundQ15) {
            console.log('Q15 box not found in navigator');
            await page.keyboard.press('Escape');
            await sleep(400);
          }
        }
      } else {
        // Navigate via Next buttons
        for (let i = 5; i < 15; i++) {
          const nxt = page.locator('button:has-text("Next")').last();
          if (await nxt.count() > 0 && await nxt.isEnabled()) {
            await nxt.click();
            await sleep(150);
          }
        }
        console.log('Navigated to Q15 via Next');
      }

      // Answer Q15 with D
      const q15Choices = await page.locator('button').filter({ hasText: /^[ABCD]$/ }).all();
      if (q15Choices.length >= 4) {
        await q15Choices[3].click();
        console.log('Q15 answered with D');
      } else if (q15Choices.length > 0) {
        await q15Choices[0].click();
        console.log('Q15 answered (fallback A)');
      }
      await sleep(300);

      await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s19_06_q15.png' });

      // Go to Review
      const revBtns = page.locator('button:has-text("Review")');
      if (await revBtns.count() > 0) {
        await revBtns.first().click();
        await sleep(1000);
        await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s19_07_review.png' });

        const reviewH = await page.locator('text=Review Your Answers').count() > 0;
        console.log('Review screen:', reviewH);

        // Check summary counts
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
        console.log('Submit Section:', submitSection);
        console.log('Submit Test (WRONG for section 1):', submitTest);

        // Submit section
        const submitBtn = submitSection ? 'button:has-text("Submit Section")' : 'button:has-text("Submit Test")';
        await page.click(submitBtn);
        await sleep(2500);
        await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s19_08_post_section.png' });
        console.log('After submit. URL:', page.url());

        // Check FRQ choice screen
        const frqChoice = await page.locator('text=Free Response Section').count() > 0;
        const typeOpt = await page.locator('text=Type Your Answers').count() > 0;
        const handOpt = await page.locator('text=Write by Hand').count() > 0;
        console.log('FRQ choice screen:', frqChoice);
        console.log('Type Your Answers:', typeOpt);
        console.log('Write by Hand:', handOpt);

        // Also check: did section locking work? (section 2 shows Locked indicator)
        const lockedIndicator = await page.locator('text=Locked').count() > 0;
        console.log('Lock indicator after section transition:', lockedIndicator);

        if (typeOpt) {
          await page.locator('button:has-text("Type Your Answers")').click();
          await sleep(1000);
          await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s19_09_frq.png' });

          const frqTA = await page.locator('textarea').count() > 0;
          const charCount = await page.locator('text=/ 10,000').count() > 0;
          console.log('FRQ textarea:', frqTA);
          console.log('Char count:', charCount);

          // Check section header shows Section 2
          const secHeader = await page.locator('header').textContent().catch(() => '');
          console.log('FRQ section header:', secHeader.substring(0, 100));

          // Navigate through all FRQ sub-questions
          let loop = 0;
          while (loop < 20) {
            const ta = page.locator('textarea');
            if (await ta.count() > 0) {
              const v = await ta.first().inputValue().catch(() => '');
              if (!v) { await ta.first().fill('Brief FRQ answer for testing.'); await sleep(100); }
            }
            const revB = page.locator('button:has-text("Review")');
            const nxtB = page.locator('button:has-text("Next")').last();
            if (await revB.count() > 0 && await revB.first().isEnabled()) {
              await revB.first().click();
              await sleep(800);
              break;
            } else if (await nxtB.count() > 0 && await nxtB.isEnabled()) {
              await nxtB.click();
              await sleep(300);
            } else { break; }
            loop++;
          }

          await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s19_10_frq_review.png' });

          const finalSubBtn = page.locator('button:has-text("Submit Test")');
          if (await finalSubBtn.count() > 0) {
            await finalSubBtn.first().click();
            await sleep(8000);
            await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s19_11_final.png' });
            console.log('After final submit URL:', page.url());

            const onResults = page.url().includes('/results/');
            console.log('On results page:', onResults);

            if (onResults) {
              const scoreRpt = await page.locator('text=SCORE REPORT').count() > 0;
              const mcqTbl = await page.locator('table').count() > 0;
              const backDash = await page.locator('text=Back to Dashboard').count() > 0;
              const dlPDF = await page.locator('text=Download PDF').count() > 0;
              console.log('SCORE REPORT:', scoreRpt);
              console.log('MCQ table:', mcqTbl);
              console.log('Back to Dashboard:', backDash);
              console.log('Download PDF:', dlPDF);
              await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_s19_12_report.png' });
            }
          }
        }
      }
    }
  }

  // Console error summary
  const errors = logs.filter(l => l.type === 'error' || l.type === 'pageerror');
  const warnings = logs.filter(l => l.type === 'warning' || l.type === 'warn');
  console.log('\n=== CONSOLE SUMMARY ===');
  console.log('JS Errors:', errors.length);
  errors.forEach(e => console.log(' E:', e.text.substring(0, 300)));
  console.log('Warnings:', warnings.length);
  warnings.slice(0, 8).forEach(w => console.log(' W:', w.text.substring(0, 200)));

  await browser.close();
  console.log('\n=== AUDIT COMPLETE ===');
})().catch(err => {
  console.error('FATAL:', err.message, err.stack ? err.stack.split('\n')[1] : '');
  process.exit(1);
});
