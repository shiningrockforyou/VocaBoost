const { chromium } = require('playwright');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => logs.push({ type: 'pageerror', text: err.message }));

  // STEP 1: LOGIN
  console.log('=== STEP 1: LOGIN ===');
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', 'teacher@apboost.test');
  await page.fill('input[type="password"]', 'Teacher123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  // Teacher lands at vocaboost dashboard, then navigate to AP
  await page.goto('http://localhost:5173/ap');
  await page.waitForTimeout(2000);
  console.log('Login successful. URL:', page.url());
  await sleep(2000);

  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_01_dashboard.png' });
  const h1 = await page.locator('h1').first().textContent().catch(() => 'NOT FOUND');
  console.log('Dashboard h1:', h1);
  const cards = await page.locator('h3').allTextContents().catch(() => []);
  console.log('Test cards:', JSON.stringify(cards));

  // S-21: SESSION RESUME FLOW (Calc AB)
  console.log('\n=== S-21: SESSION RESUME TEST ===');

  const calcCard = page.locator('h3').filter({ hasText: /Calc/ });
  const calcCount = await calcCard.count();
  console.log('Calc card count:', calcCount);

  if (calcCount === 0) {
    console.log('ERROR: No calc test card found');
    await browser.close();
    process.exit(1);
  }

  await calcCard.first().click();
  await page.waitForURL(/\/ap\/test\//, { timeout: 10000 });
  await sleep(1500);
  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_02_instruction.png' });

  const instrTitle = await page.locator('h1').first().textContent().catch(() => 'N/A');
  console.log('Instruction h1:', instrTitle);

  const isResuming = await page.locator('button:has-text("Resume Test")').count() > 0;
  const hasBegin = await page.locator('button:has-text("Begin Test")').count() > 0;
  const hasResumeInfo = await page.locator('text=Resume from').count() > 0;
  const hasFRQInfo = await page.locator('text=Free Response Section').count() > 0;
  const hasTimerWarning = await page.locator('text=cannot pause the timer').count() > 0;
  const hasSectionsWarning = await page.locator('text=cannot return to previous').count() > 0;
  const hasCancel = await page.locator('button:has-text("Cancel")').count() > 0;

  console.log('isResuming:', isResuming, '| hasBegin:', hasBegin);
  console.log('hasResumeInfo:', hasResumeInfo, '| hasFRQInfo:', hasFRQInfo);
  console.log('hasTimerWarning:', hasTimerWarning, '| hasSectionsWarning:', hasSectionsWarning);
  console.log('hasCancel:', hasCancel);

  if (isResuming && hasResumeInfo) {
    const resumeTxt = await page.locator('text=Resume from').textContent().catch(() => 'N/A');
    console.log('Resume position text:', resumeTxt);
  }

  // Begin or resume
  if (isResuming) {
    await page.click('button:has-text("Resume Test")');
  } else {
    await page.click('button:has-text("Begin Test")');
  }
  await sleep(2000);
  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_03_testing.png' });
  console.log('After begin. URL:', page.url());

  // If in FRQ choice, choose typed
  const inFRQChoice = await page.locator('text=Choose how you').count() > 0;
  if (inFRQChoice) {
    console.log('NOTE: In FRQ choice already - choosing Type');
    await page.locator('button:has-text("Type Your Answers")').click();
    await sleep(1000);
  }

  // Verify test interface
  const hasHamburger = await page.locator('[aria-label="Open menu"]').count() > 0;
  const sectionHeader = await page.locator('header').textContent().catch(() => '');
  const timerEl = await page.locator('[class*="mono"]').first().textContent().catch(() => 'N/A');
  const q1Visible = await page.locator('text=Question 1').count() > 0;
  const backDisabled = await page.locator('button:has-text("Back")').first().isDisabled().catch(() => null);

  console.log('hasHamburger:', hasHamburger);
  console.log('Section header:', sectionHeader.substring(0, 100));
  console.log('Timer:', timerEl);
  console.log('Q1 visible:', q1Visible);
  console.log('Back disabled on Q1:', backDisabled);

  // Answer Q1 = option B
  const choicesQ1 = await page.locator('button').filter({ hasText: /^[ABCD]$/ }).all();
  console.log('Q1 choice buttons:', choicesQ1.length);
  if (choicesQ1.length >= 2) {
    await choicesQ1[1].click(); // B
    await sleep(400);
    console.log('Clicked B on Q1');
  }

  // Flag Q1
  const flagQ1 = page.locator('button:has-text("Flag for Review")');
  if (await flagQ1.count() > 0) {
    await flagQ1.first().click();
    await sleep(300);
    const flagged = await page.locator('button:has-text("Flagged")').count() > 0;
    console.log('Q1 flagged:', flagged);
  }

  // Go to Q2
  const nextBtnQ1 = page.locator('button:has-text("Next")').last();
  if (await nextBtnQ1.count() > 0) {
    await nextBtnQ1.click();
    await sleep(400);
    const q2Vis = await page.locator('text=Question 2').count() > 0;
    console.log('Q2 visible:', q2Vis);
    // Answer Q2 = A
    const choicesQ2 = await page.locator('button').filter({ hasText: /^[ABCD]$/ }).all();
    if (choicesQ2.length >= 1) {
      await choicesQ2[0].click();
      await sleep(300);
      console.log('Clicked A on Q2');
    }
  }

  const timerPreRefresh = await page.locator('[class*="mono"]').first().textContent().catch(() => 'N/A');
  console.log('Timer before refresh:', timerPreRefresh);
  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_04_before_refresh.png' });

  // REFRESH
  console.log('\n--- REFRESHING PAGE ---');
  await page.reload({ timeout: 20000 });
  await sleep(4000);
  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_05_after_refresh.png' });
  console.log('After refresh URL:', page.url());

  const resumeAfter = await page.locator('button:has-text("Resume Test")').count() > 0;
  const beginAfter = await page.locator('button:has-text("Begin Test")').count() > 0;
  const resumeInfoAfter = await page.locator('text=Resume from').count() > 0;
  const inTestingAfter = await page.locator('[aria-label="Open menu"]').count() > 0;

  console.log('After refresh - Resume Test:', resumeAfter);
  console.log('After refresh - Begin Test:', beginAfter);
  console.log('After refresh - Resume from info:', resumeInfoAfter);
  console.log('After refresh - In testing (hamburger):', inTestingAfter);

  if (resumeAfter && resumeInfoAfter) {
    const rText = await page.locator('text=Resume from').textContent().catch(() => 'N/A');
    console.log('Resume from text:', rText);
  }

  // S-21 outcome
  if (inTestingAfter && !resumeAfter) {
    console.log('S-21: AUTO-TRANSITIONED directly to testing (no resume UI shown)');
  } else if (resumeAfter) {
    console.log('S-21: Resume Test button shown correctly');
    if (resumeInfoAfter) {
      console.log('S-21: Position info shown - PASS criteria met');
    } else {
      console.log('S-21: No position info - PARTIAL');
    }
    await page.click('button:has-text("Resume Test")');
    await sleep(2000);
  }

  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_06_resumed.png' });

  // Check state restoration (Q1 flag and answers)
  const currentQText = await page.locator('text=Question').first().textContent().catch(() => 'N/A');
  console.log('Current question after resume:', currentQText);

  const backBtnAfterResume = page.locator('button:has-text("Back")');
  if (await backBtnAfterResume.count() > 0) {
    const backEnabled = !(await backBtnAfterResume.first().isDisabled().catch(() => true));
    if (backEnabled) {
      await backBtnAfterResume.first().click();
      await sleep(400);
    }
  }

  const q1FlagRestored = await page.locator('button:has-text("Flagged")').count() > 0;
  console.log('Q1 flag restored:', q1FlagRestored);

  const timerAfterResume = await page.locator('[class*="mono"]').first().textContent().catch(() => 'N/A');
  console.log('Timer after resume:', timerAfterResume);

  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_07_state_restored.png' });

  // S-20: HAMBURGER MENU TEST
  console.log('\n=== S-20: HAMBURGER MENU TEST ===');

  const hamBtn = page.locator('[aria-label="Open menu"]');
  const hamCount2 = await hamBtn.count();
  console.log('Hamburger count:', hamCount2);

  if (hamCount2 > 0) {
    await hamBtn.click();
    await sleep(500);
    await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_08_menu.png' });

    const menuH3 = await page.locator('h3:has-text("Menu")').count() > 0;
    const goToQ = await page.locator('button:has-text("Go to Question")').count() > 0;
    const exitT = await page.locator('button:has-text("Exit Test")').count() > 0;
    console.log('Menu heading:', menuH3);
    console.log('Go to Question:', goToQ);
    console.log('Exit Test:', exitT);

    // Check close button (should be SVG X, not text 'x')
    const closeEl = page.locator('[aria-label="Close menu"]');
    if (await closeEl.count() > 0) {
      const closeHTML = await closeEl.innerHTML().catch(() => '');
      const hasSVG = closeHTML.includes('<svg') || closeHTML.includes('path');
      console.log('Close button has SVG:', hasSVG);
      console.log('Close button HTML:', closeHTML.substring(0, 200));
    }

    // Check ARIA attributes
    const dialogEl = page.locator('[role="dialog"]');
    const hasDialog = await dialogEl.count() > 0;
    const ariaLabel = await dialogEl.getAttribute('aria-label').catch(() => null);
    const ariaModal = await dialogEl.getAttribute('aria-modal').catch(() => null);
    console.log('role="dialog":', hasDialog);
    console.log('aria-label:', ariaLabel);
    console.log('aria-modal:', ariaModal);

    // Test Go to Question
    if (goToQ) {
      await page.locator('button:has-text("Go to Question")').first().click();
      await sleep(500);
      await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_09_nav_from_menu.png' });
      const navVis = await page.locator('text=Question Navigator').count() > 0;
      console.log('Navigator from Go to Question:', navVis);
      await page.keyboard.press('Escape');
      await sleep(300);
    }

    // Reopen menu
    await hamBtn.click();
    await sleep(400);

    // Test Exit Test -> Cancel
    if (await page.locator('button:has-text("Exit Test")').count() > 0) {
      await page.locator('button:has-text("Exit Test")').first().click();
      await sleep(400);
      await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_10_exit_confirm.png' });

      const exitH3 = await page.locator('h3:has-text("Exit Test?")').count() > 0;
      const areYouSure = await page.locator('text=Are you sure').count() > 0;
      const progressSaved = await page.locator('text=progress will be saved').count() > 0;
      const cancelInConfirm = await page.locator('button:has-text("Cancel")').count() > 0;
      console.log('Exit confirm h3:', exitH3);
      console.log('Are you sure:', areYouSure);
      console.log('progress saved:', progressSaved);
      console.log('Cancel in confirm:', cancelInConfirm);

      // Click Cancel
      if (cancelInConfirm) {
        await page.locator('button:has-text("Cancel")').first().click();
        await sleep(400);
        const testStillActive = await page.locator('[aria-label="Open menu"]').count() > 0;
        console.log('Test continues after Cancel:', testStillActive);
        await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_11_after_cancel.png' });
      }

      // Confirm exit (click Exit Test again, then confirm)
      await hamBtn.click();
      await sleep(300);
      if (await page.locator('button:has-text("Exit Test")').count() > 0) {
        await page.locator('button:has-text("Exit Test")').first().click();
        await sleep(300);
        // Confirm with the Exit Test confirmation button
        const allExitBtns = await page.locator('button:has-text("Exit Test")').all();
        if (allExitBtns.length > 0) {
          await allExitBtns[allExitBtns.length - 1].click();
          await sleep(2000);
          console.log('After confirmed exit URL:', page.url());
          const atDash = page.url().endsWith('/ap') || page.url().endsWith('/ap/');
          console.log('At dashboard after exit:', atDash);
          await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_12_after_exit.png' });
        }
      }
    }
  }

  // S-19: SECOND TEST (MACRO) ABBREVIATED
  console.log('\n=== S-19: MACRO ABBREVIATED FLOW ===');
  await page.goto('http://localhost:5173/ap');
  await sleep(2000);
  await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_13_dash_for_macro.png' });

  const macroCard = page.locator('h3').filter({ hasText: /Macro/ });
  const macroCardCount = await macroCard.count();
  console.log('Macro card count:', macroCardCount);

  if (macroCardCount > 0) {
    await macroCard.first().click();
    await page.waitForURL(/\/ap\/test\//, { timeout: 10000 });
    await sleep(1500);
    await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_14_macro_instr.png' });

    const macroH1 = await page.locator('h1').first().textContent().catch(() => 'N/A');
    console.log('Macro instruction h1:', macroH1);

    const macroResume = await page.locator('button:has-text("Resume Test")').count() > 0;
    const macroBegin = await page.locator('button:has-text("Begin Test")').count() > 0;
    console.log('Macro Resume:', macroResume, 'Begin:', macroBegin);

    if (macroResume) {
      await page.click('button:has-text("Resume Test")');
    } else {
      await page.click('button:has-text("Begin Test")');
    }
    await sleep(2000);
    await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_15_macro_q1.png' });
    console.log('Macro started. URL:', page.url());

    // Check if in FRQ choice (was already in FRQ phase)
    const inFRQChoiceMacro = await page.locator('text=Choose how you').count() > 0;
    if (inFRQChoiceMacro) {
      console.log('S-19: Macro already in FRQ - resume mode at FRQ choice');
      await page.locator('button:has-text("Type Your Answers")').click();
      await sleep(1000);
      // Since we can't reset, just verify the FRQ flow works
      const frqTA = await page.locator('textarea').count() > 0;
      console.log('FRQ textarea in resumed mode:', frqTA);
    } else {
      // Fresh MCQ section - answer Q1-Q5, flag Q3/Q4
      for (let i = 1; i <= 5; i++) {
        const qVis = await page.locator('text=Question ' + i).count() > 0;

        const cBtns = await page.locator('button').filter({ hasText: /^[ABCD]$/ }).all();
        if (cBtns.length > 0) {
          await cBtns[0].click();
          await sleep(200);
        }

        if (i === 3 || i === 4) {
          const flg = page.locator('button:has-text("Flag for Review")');
          if (await flg.count() > 0) {
            await flg.first().click();
            await sleep(200);
            console.log('Flagged Q' + i);
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

      await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_16_macro_q5.png' });

      // Open navigator
      const centerNavBtn = page.locator('button').filter({ hasText: /Question \d+ of \d+/ });
      if (await centerNavBtn.count() > 0) {
        await centerNavBtn.first().click();
        await sleep(500);
        await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_17_macro_nav.png' });

        const navVis = await page.locator('text=Question Navigator').count() > 0;
        console.log('Navigator visible:', navVis);

        if (navVis) {
          const answeredBoxes = await page.locator('[class*="bg-brand-primary"]').count();
          console.log('Answered boxes:', answeredBoxes);

          // Navigate to Q15
          const allBtns = await page.locator('button').all();
          for (const btn of allBtns) {
            const txt = await btn.textContent().catch(() => '');
            if (txt.trim() === '15') {
              await btn.click();
              await sleep(500);
              const q15vis = await page.locator('text=Question 15').count() > 0;
              console.log('Q15 visible after nav click:', q15vis);
              break;
            }
          }
        }
      } else {
        // Navigate to Q15 via Next buttons
        for (let i = 5; i < 15; i++) {
          const nxt = page.locator('button:has-text("Next")').last();
          if (await nxt.count() > 0 && await nxt.isEnabled()) {
            await nxt.click();
            await sleep(200);
          }
        }
        console.log('Navigated to Q15 via Next buttons');
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

      // Click Review
      const revBtns = page.locator('button:has-text("Review")');
      if (await revBtns.count() > 0) {
        await revBtns.first().click();
        await sleep(1000);
        await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_18_macro_review.png' });

        const reviewH = await page.locator('text=Review Your Answers').count() > 0;
        console.log('Review heading:', reviewH);

        const answeredLi = await page.locator('li').filter({ hasText: 'Answered:' }).first().textContent().catch(() => 'N/A');
        const unansweredLi = await page.locator('li').filter({ hasText: 'Unanswered:' }).first().textContent().catch(() => 'N/A');
        const flaggedLi = await page.locator('li').filter({ hasText: 'Flagged:' }).first().textContent().catch(() => 'N/A');
        console.log('Answered:', answeredLi);
        console.log('Unanswered:', unansweredLi);
        console.log('Flagged:', flaggedLi);

        const unansweredWarning = await page.locator('text=unanswered question').count() > 0;
        console.log('Unanswered warning:', unansweredWarning);

        const submitSection = await page.locator('button:has-text("Submit Section")').count() > 0;
        const submitTest = await page.locator('button:has-text("Submit Test")').count() > 0;
        console.log('Submit Section button:', submitSection);
        console.log('Submit Test button (should be false for section 1):', submitTest);

        if (submitSection) {
          await page.click('button:has-text("Submit Section")');
          await sleep(2000);
          await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_19_post_section_submit.png' });
          console.log('After Submit Section URL:', page.url());

          const frqChoiceScreen = await page.locator('text=Free Response Section').count() > 0;
          const typeOpt = await page.locator('text=Type Your Answers').count() > 0;
          const handOpt = await page.locator('text=Write by Hand').count() > 0;
          console.log('FRQ choice screen:', frqChoiceScreen);
          console.log('Type Your Answers:', typeOpt);
          console.log('Write by Hand:', handOpt);

          if (typeOpt) {
            await page.locator('button:has-text("Type Your Answers")').click();
            await sleep(1000);
            await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_20_frq_mode.png' });

            const frqTA = await page.locator('textarea').count() > 0;
            const charCount = await page.locator('text=/ 10,000').count() > 0;
            console.log('FRQ textarea:', frqTA);
            console.log('Char count:', charCount);

            // Navigate through FRQ and submit
            let loop = 0;
            while (loop < 20) {
              const ta = page.locator('textarea');
              if (await ta.count() > 0) {
                const v = await ta.first().inputValue().catch(() => '');
                if (!v) { await ta.first().fill('Brief FRQ answer.'); await sleep(150); }
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

            await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_21_frq_review.png' });

            const finalSubmit = page.locator('button:has-text("Submit Test")');
            if (await finalSubmit.count() > 0) {
              await finalSubmit.first().click();
              await sleep(8000);
              await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_22_final_submit.png' });
              console.log('After final submit URL:', page.url());
              const onResults = page.url().includes('/results/');
              console.log('On results page:', onResults);

              if (onResults) {
                await page.screenshot({ path: 'C:/Users/dmchw/vocaboost/b4_23_report_card.png' });
                const scoreRpt = await page.locator('text=SCORE REPORT').count() > 0;
                const mcqTbl = await page.locator('table').count() > 0;
                const backDash = await page.locator('text=Back to Dashboard').count() > 0;
                const dlPDF = await page.locator('text=Download PDF').count() > 0;
                console.log('SCORE REPORT:', scoreRpt);
                console.log('MCQ table:', mcqTbl);
                console.log('Back to Dashboard:', backDash);
                console.log('Download PDF:', dlPDF);
              }
            }
          }
        }
      }
    }
  }

  // Collect console errors
  const errors = logs.filter(l => l.type === 'error' || l.type === 'pageerror');
  const warnings = logs.filter(l => l.type === 'warning' || l.type === 'warn');
  console.log('\n=== CONSOLE ERRORS ===');
  console.log('Error count:', errors.length);
  errors.forEach(e => console.log(' E:', e.text.substring(0, 300)));
  console.log('Warning count:', warnings.length);
  warnings.slice(0, 10).forEach(w => console.log(' W:', w.text.substring(0, 200)));

  await browser.close();
  console.log('\n=== AUDIT COMPLETE ===');
})().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
