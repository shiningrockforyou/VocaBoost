const { chromium } = require('playwright');
const fs = require('fs');

async function ss(page, name) {
  var path = 'src/apBoost/criteria_audit/playwright_reports/b14b_retest_' + name + '.png';
  await page.screenshot({ path: path, fullPage: false });
  console.log('[SS] ' + name);
}

async function closeModal(page) {
  // Try to close any open modal
  var backdrop = await page.$('.fixed.inset-0 .absolute.inset-0.bg-black\\/50, [class*="fixed inset-0"] [class*="absolute inset-0"]');
  if (backdrop) {
    await backdrop.click();
    await page.waitForTimeout(500);
  }
  // Also try pressing escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

(async () => {
  var browser = await chromium.launch({ headless: true });
  var context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  var page = await context.newPage();

  var consoleErrors = [];
  page.on('console', function(msg) {
    if (msg.type() === 'error') consoleErrors.push({ url: page.url(), type: 'console_error', msg: msg.text().substring(0, 400) });
  });
  page.on('pageerror', function(err) {
    consoleErrors.push({ url: page.url(), type: 'pageerror', msg: err.message.substring(0, 400) });
  });

  var R = {};

  // === LOGIN ===
  console.log('\n=== [1] LOGIN ===');
  await page.goto('http://localhost:5173/ap');
  await page.waitForURL('**/login**', { timeout: 5000 }).catch(function() {});
  await page.fill('[type=email]', 'student5@apboost.test');
  await page.fill('[type=password]', 'Student123!');
  await page.click('[type=submit]');
  await page.waitForURL('**/ap**', { timeout: 10000 });
  await page.waitForTimeout(2000);
  console.log('Login URL:', page.url());
  R.login = page.url().includes('/ap') && !page.url().includes('login');
  await ss(page, '01_dashboard');

  // === NAVIGATE TO MICRO TEST ===
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await page.waitForTimeout(4000);
  var bodyCheck = await page.textContent('body');
  var hasError = bodyCheck.includes('Something went wrong');
  if (hasError) {
    console.log('ERROR: Error boundary still shown:', bodyCheck.substring(0, 200));
    await browser.close();
    return;
  }
  console.log('Test page loaded OK');
  await ss(page, '02_instruction');

  // Begin test
  var startBtn = await page.$('button:has-text("Begin Test"), button:has-text("Resume Test")');
  if (!startBtn) startBtn = await page.$('button:has-text("Resume"), button:has-text("Start")');
  var startText = startBtn ? (await startBtn.textContent()).trim() : 'NOT FOUND';
  console.log('Start/Resume button:', startText);
  if (startBtn) {
    await startBtn.click();
    await page.waitForTimeout(3000);
  }
  console.log('URL after start:', page.url());

  var body3 = await page.textContent('body');
  console.log('After start body:', body3.replace(/\s+/g, ' ').substring(0, 300));

  // ====================================================
  // VERIFY 1: logError crash (console check)
  // ====================================================
  console.log('\n=== VERIFY 1: B14B-NEW-001 logError crash ===');
  var codeStartsWithErrors = consoleErrors.filter(function(e) {
    return e.msg.includes('code.startsWith') || e.msg.includes('startsWith is not');
  });
  R.verify1_logError = codeStartsWithErrors.length === 0;
  console.log('code.startsWith errors:', codeStartsWithErrors.length, '->', R.verify1_logError ? 'PASS' : 'FAIL');

  var logErrorSrc = fs.readFileSync('src/apBoost/utils/logError.js', 'utf-8');
  var codeLineInSrc = logErrorSrc.split('\n').find(function(l) { return l.trim().startsWith('const code ='); });
  R.verify1_sourceFix = codeLineInSrc && codeLineInSrc.includes('String(');
  console.log('Source code fix (String()):', R.verify1_sourceFix ? 'YES' : 'NO');
  console.log('logError code line:', codeLineInSrc);

  // ====================================================
  // VERIFY 2: MCQ letter badge contrast
  // ====================================================
  console.log('\n=== VERIFY 2: B14B-LIVE-001 MCQ letter badge contrast ===');

  // Navigate to Q1 to test letter badge
  var navBtns = await page.$('button:has-text("Question")');
  // Look for a question with an unselected state
  var q1NavBtn = await page.$('button[class*="h-11"]:first-child');

  // Use navigator to go to Q1 if needed
  var navToggle = await page.$('button:has-text("of 15")');
  if (navToggle) {
    await navToggle.click();
    await page.waitForTimeout(800);
    // Click Q1 from navigator
    var q1InNav = await page.$eval('button[class*="h-11"]', function(el) { return { text: el.textContent.trim(), class: el.className }; }).catch(function() { return null; });
    console.log('First nav cell:', JSON.stringify(q1InNav));
    // Close modal and just go to Q1 by navigating
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // Go to Q1
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await page.waitForTimeout(3000);
  var bodyReload = await page.textContent('body');
  if (bodyReload.includes('Something went wrong')) {
    console.log('Error on reload');
    R.verify2_letterBadge = false;
  } else {
    var resumeBtn2 = await page.$('button:has-text("Resume Test"), button:has-text("Begin Test")');
    if (resumeBtn2) {
      await resumeBtn2.click();
      await page.waitForTimeout(3000);
    }

    // Now should be on test. Navigate to Q1 via navigator
    var navToggle2 = await page.$('button:has-text("of 15")');
    if (navToggle2) {
      await navToggle2.click();
      await page.waitForTimeout(800);
      var allNavCells = await page.$$('button[class*="h-11"]');
      console.log('Nav cells count:', allNavCells.length);
      if (allNavCells.length > 0) {
        await allNavCells[0].click(); // Q1
        await page.waitForTimeout(1000);
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }

    // Screenshot before selecting
    await ss(page, '03_mcq_q1_before');

    // Check if Q1 is already answered
    var q1Answered = await page.$('button[aria-checked="true"]');
    console.log('Q1 already answered:', !!q1Answered);

    if (q1Answered) {
      // Clear the answer by clicking the same option
      await q1Answered.click();
      await page.waitForTimeout(300);
    }

    // Now select answer A
    var answerABtn = await page.$('button[aria-label="Choice A"]');
    if (answerABtn) {
      await answerABtn.click();
      await page.waitForTimeout(500);
      await ss(page, '04_mcq_q1_after_select_a');

      var selectedBtns = await page.$$eval('button[aria-checked="true"]', function(btns) {
        return btns.map(function(b) {
          var spans = Array.from(b.querySelectorAll('span'));
          return {
            btnClass: b.className.substring(0, 100),
            spans: spans.map(function(s) { return { cls: s.className, txt: s.textContent.trim() }; })
          };
        });
      });
      console.log('Selected button info:', JSON.stringify(selectedBtns, null, 2));

      // Find the letter badge span (single letter A-J)
      if (selectedBtns.length > 0) {
        var letterBadge = null;
        selectedBtns[0].spans.forEach(function(s) {
          if (s.txt.length === 1 && /[A-J]/.test(s.txt)) letterBadge = s;
        });
        console.log('Letter badge:', JSON.stringify(letterBadge));

        var hasBgWhite = letterBadge && letterBadge.cls.includes('bg-white') && !letterBadge.cls.includes('bg-white/');
        var hasBgWhite20 = letterBadge && letterBadge.cls.includes('bg-white/20');
        var hasBrandPrimary = letterBadge && (letterBadge.cls.includes('text-brand-primary') || letterBadge.cls.includes('brand-primary'));

        console.log('Has bg-white (fix):', hasBgWhite);
        console.log('Has bg-white/20 (broken):', hasBgWhite20);
        console.log('Has text-brand-primary:', hasBrandPrimary);

        R.verify2_letterBadge = hasBgWhite && !hasBgWhite20;
        console.log('Letter badge fix:', R.verify2_letterBadge ? 'PASS' : 'FAIL');
      } else {
        console.log('No selected button found after clicking A');
        R.verify2_letterBadge = false;
      }
    } else {
      console.log('No Choice A button found');
      R.verify2_letterBadge = false;
    }
  }

  // ====================================================
  // VERIFY 6: Timer urgency cues (code check)
  // ====================================================
  console.log('\n=== VERIFY 6: B14B-006 Timer urgency cues ===');
  var timerSrc = fs.readFileSync('src/apBoost/components/TestTimer.jsx', 'utf-8');
  var hasUnder60Pulse = timerSrc.includes('<= 60') && timerSrc.includes('animate-pulse');
  var hasUnder300Bold = timerSrc.includes('<= 300') && timerSrc.includes('font-bold');
  R.verify6_timerUrgency = hasUnder60Pulse && hasUnder300Bold;
  console.log('Under 60s pulse:', hasUnder60Pulse ? 'YES' : 'NO');
  console.log('Under 300s bold:', hasUnder300Bold ? 'YES' : 'NO');
  console.log('Timer urgency:', R.verify6_timerUrgency ? 'PASS' : 'FAIL');

  // Check DOM at full time (urgency not visible yet)
  var timerEls = await page.$$eval('[class*="font-mono"]', function(els) {
    return els.map(function(el) { return { text: el.textContent.trim(), cls: el.className, parentCls: el.parentElement ? el.parentElement.className : '' }; });
  });
  console.log('Timer DOM:', JSON.stringify(timerEls));

  // ====================================================
  // VERIFY 8: Navigator dedup check
  // ====================================================
  console.log('\n=== VERIFY 8: Duplicate question ID dedup ===');
  var navToggle3 = await page.$('button:has-text("of 15")');
  if (!navToggle3) navToggle3 = await page.$('button:has-text("Question")');
  if (navToggle3) {
    await navToggle3.click();
    await page.waitForTimeout(800);
    await ss(page, '05_navigator_modal');

    // Check modal content
    var modalBody = await page.textContent('.fixed.inset-0, [class*="bottom-0 left-0 right-0"]').catch(function() { return ''; });
    console.log('Modal body:', modalBody.replace(/\s+/g, ' ').substring(0, 200));

    // Get all buttons in the navigator grid
    var navGridBtns = await page.$$eval('[class*="flex flex-wrap gap-2"] button, [class*="flex-wrap"] button', function(btns) {
      return btns.map(function(b) { return b.textContent.trim(); });
    });
    console.log('Nav grid buttons:', navGridBtns);

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    var seen = {};
    var dups = [];
    navGridBtns.forEach(function(l) {
      if (seen[l]) dups.push(l);
      else seen[l] = true;
    });
    console.log('Duplicate labels:', dups);
    R.verify8_noDups = dups.length === 0 && navGridBtns.length > 0;
    console.log('No duplicate nav entries:', R.verify8_noDups ? 'PASS' : 'FAIL (' + navGridBtns.length + ' entries, ' + dups.length + ' dups)');
  } else {
    console.log('No nav toggle found');
    R.verify8_noDups = null;
  }

  // Ensure modal is closed
  await closeModal(page);

  // ====================================================
  // Answer all MCQ questions Q1-Q15
  // ====================================================
  console.log('\n=== ANSWERING MCQ Q1-Q15 ===');

  // First check what question we're on
  var currentBody = await page.textContent('body');
  var currentQMatch = currentBody.match(/Question (\d+) of 15/);
  var startQ = currentQMatch ? parseInt(currentQMatch[1]) : 1;
  console.log('Currently on question:', startQ);

  // Answer from current question to Q15
  var answered = 0;
  for (var q = 0; q < 20; q++) {
    var qBody = await page.textContent('body');
    if (qBody.includes('Review Your Answers')) {
      console.log('Reached review screen');
      break;
    }

    // Pick answer B for this question (or A if B not available)
    var bBtn = await page.$('button[aria-label="Choice B"]');
    if (!bBtn) bBtn = await page.$('button[aria-label="Choice A"]');
    if (bBtn) {
      await bBtn.click();
      await page.waitForTimeout(150);
      answered++;
    }

    var nextBtn = await page.$('button:has-text("Next")');
    var reviewGoBtn = await page.$('button:has-text("Review")');

    if (nextBtn) {
      await nextBtn.click();
      await page.waitForTimeout(400);
    } else if (reviewGoBtn) {
      await reviewGoBtn.click();
      await page.waitForTimeout(2000);
      break;
    } else {
      break;
    }
  }
  console.log('Answered', answered, 'questions');

  // ====================================================
  // VERIFY 3: Timer on review screen
  // ====================================================
  console.log('\n=== VERIFY 3: B14B-LIVE-002 Timer on review screen ===');
  var reviewBody = await page.textContent('body');
  var onReview = reviewBody.includes('Review Your Answers');
  console.log('On review screen:', onReview);
  await ss(page, '06_review_screen');

  if (onReview) {
    var timerOnReview = await page.$$eval('[class*="font-mono"]', function(els) {
      return els.map(function(el) { return { text: el.textContent.trim(), cls: el.className }; });
    });
    console.log('Timer elements on review:', JSON.stringify(timerOnReview));
    var timerMatchReview = reviewBody.match(/\d{1,2}:\d{2}/);
    console.log('Time value on review:', timerMatchReview ? timerMatchReview[0] : 'NOT FOUND');
    R.verify3_timerOnReview = !!(timerMatchReview && timerOnReview.length > 0);
    console.log('Timer on review:', R.verify3_timerOnReview ? 'PASS' : 'FAIL');
  } else {
    console.log('Not on review screen, skipping verify 3');
    R.verify3_timerOnReview = null;
  }

  // ====================================================
  // Submit MCQ section -> FRQ choice screen
  // ====================================================
  console.log('\n=== SUBMITTING MCQ SECTION ===');
  var isSubmitSect = reviewBody.includes('Submit Section');
  var isSubmitTest = reviewBody.includes('Submit Test');
  console.log('Submit Section:', isSubmitSect, '| Submit Test:', isSubmitTest);

  if (isSubmitSect) {
    var submitSectBtn = await page.$('button:has-text("Submit Section")');
    if (submitSectBtn) {
      await submitSectBtn.click();
      await page.waitForTimeout(3000);
    }
  }

  var postSectionBody = await page.textContent('body');
  var onFRQChoice = postSectionBody.includes('Type Your Answers') || postSectionBody.includes('Write by Hand');
  console.log('On FRQ choice screen:', onFRQChoice);
  await ss(page, '07_frq_choice');

  // ====================================================
  // VERIFY 7: FRQ two-step confirmation
  // ====================================================
  console.log('\n=== VERIFY 7: FRQ two-step confirmation ===');
  if (onFRQChoice) {
    // Confirm button should NOT exist before selection
    var confirmBefore = await page.$('button:has-text("Confirm"), button:has-text("Confirm & Continue"), button:has-text("Confirm &amp; Continue")');
    console.log('Confirm button BEFORE selection:', !!confirmBefore);

    // Click "Type Your Answers" (should highlight, not navigate)
    var typeAnswersBtn = await page.$('button[class*="border-2"] h3:has-text("Type Your Answers"), button:has-text("Type Your Answers")');
    if (!typeAnswersBtn) {
      typeAnswersBtn = await page.$('h3:has-text("Type Your Answers")');
    }
    if (typeAnswersBtn) {
      await typeAnswersBtn.click();
      await page.waitForTimeout(600);
      await ss(page, '08_frq_type_selected');

      var postTypeBody = await page.textContent('body');
      var stillOnChoice = postTypeBody.includes('Type Your Answers') && postTypeBody.includes('Write by Hand');
      console.log('Still on choice screen after click:', stillOnChoice);

      var confirmAfter = await page.$('button:has-text("Confirm"), button:has-text("Confirm & Continue"), button:has-text("Confirm &amp; Continue")');
      console.log('Confirm button AFTER Type selection:', !!confirmAfter);

      R.verify7a_twoStep = !confirmBefore && !!confirmAfter;
      console.log('Two-step confirm:', R.verify7a_twoStep ? 'PASS' : 'FAIL');
      console.log('  - No confirm before:', !confirmBefore ? 'YES' : 'NO');
      console.log('  - Confirm after:', !!confirmAfter ? 'YES' : 'NO');

      if (confirmAfter) {
        await confirmAfter.click();
        await page.waitForTimeout(2500);
        console.log('After confirm click - URL:', page.url());
        var afterConfirmBody = await page.textContent('body');
        var navigatedToFRQ = afterConfirmBody.includes('Question') && afterConfirmBody.includes('textarea');
        console.log('Navigated to FRQ after confirm:', navigatedToFRQ);
      } else {
        // Try clicking Type Your Answers directly in the parent button
        var typeParent = await page.$('.grid button:first-child');
        if (typeParent) {
          await typeParent.click();
          await page.waitForTimeout(2500);
        }
      }
    } else {
      console.log('Type Your Answers button not found by h3 selector, trying grid button');
      var gridBtns = await page.$$('.grid button, [class*="grid"] button');
      console.log('Grid buttons count:', gridBtns.length);
      if (gridBtns.length > 0) {
        var btnText = await gridBtns[0].textContent();
        console.log('First grid button text:', btnText.substring(0, 50));
        await gridBtns[0].click();
        await page.waitForTimeout(600);
        var confirmAfter2 = await page.$('button:has-text("Confirm"), button:has-text("Confirm & Continue")');
        console.log('Confirm button after grid click:', !!confirmAfter2);
        R.verify7a_twoStep = !!confirmAfter2;
        if (confirmAfter2) {
          await confirmAfter2.click();
          await page.waitForTimeout(2500);
        }
      }
    }
  } else {
    console.log('Not on FRQ choice screen');
    R.verify7a_twoStep = null;
  }

  // ====================================================
  // VERIFY 5: FRQ navigator label (Q1 not Q0)
  // ====================================================
  console.log('\n=== VERIFY 5: B14B-003 FRQ navigator label ===');
  var frqBody = await page.textContent('body');
  var isFRQ = frqBody.includes('textarea') && frqBody.includes('Question');
  console.log('On FRQ section:', isFRQ);
  await ss(page, '09_frq_q1');

  if (isFRQ) {
    var navLabelMatch = frqBody.match(/Question (\d+) of (\d+)/);
    console.log('Nav label:', navLabelMatch ? navLabelMatch[0] : 'NOT FOUND');
    var frqNavIdx = navLabelMatch ? parseInt(navLabelMatch[1]) : null;
    R.verify5_frqNavIndex = frqNavIdx === 1;
    console.log('FRQ nav starts at 1:', R.verify5_frqNavIndex ? 'PASS' : 'FAIL (index=' + frqNavIdx + ')');
  } else {
    console.log('Not on FRQ section');
    R.verify5_frqNavIndex = null;
  }

  // ====================================================
  // Answer FRQ sub-questions
  // ====================================================
  console.log('\n=== ANSWERING FRQ SUB-QUESTIONS ===');
  for (var i = 0; i < 8; i++) {
    var frqTextarea = await page.$('textarea');
    if (frqTextarea) {
      await frqTextarea.fill('This is my answer for sub-question ' + (i+1) + '. The economic concept relates to supply and demand equilibrium in competitive markets with externalities and price controls.');
      await page.waitForTimeout(200);
    }

    var frqNext = await page.$('button:has-text("Next")');
    var frqReviewGo = await page.$('button:has-text("Review")');

    if (frqNext) {
      await frqNext.click();
      await page.waitForTimeout(500);
    } else if (frqReviewGo) {
      await frqReviewGo.click();
      await page.waitForTimeout(2000);
      break;
    } else {
      break;
    }
  }

  var frqReviewBody = await page.textContent('body');
  var onFRQReview = frqReviewBody.includes('Review Your Answers');
  console.log('On FRQ review screen:', onFRQReview);
  await ss(page, '10_frq_review');

  // ====================================================
  // VERIFY 7b: Submit Test confirmation dialog
  // ====================================================
  console.log('\n=== VERIFY 7b: Submit Test dialog ===');
  var hasSubmitTest = frqReviewBody.includes('Submit Test');
  console.log('Submit Test button visible:', hasSubmitTest);

  if (hasSubmitTest && onFRQReview) {
    var submitTestBtn2 = await page.$('button:has-text("Submit Test")');
    if (submitTestBtn2) {
      var dialogAppeared = false;
      var dialogMsg = '';

      page.once('dialog', async function(dialog) {
        dialogAppeared = true;
        dialogMsg = dialog.message();
        console.log('DIALOG appeared:', dialogMsg);
        await dialog.dismiss(); // Cancel
      });

      console.log('Clicking Submit Test...');
      await submitTestBtn2.click();
      await page.waitForTimeout(2500);

      var postCancelUrl = page.url();
      var navigatedAway = postCancelUrl.includes('/results/');

      console.log('Dialog appeared:', dialogAppeared);
      console.log('Dialog message:', dialogMsg);
      console.log('URL after dialog cancel:', postCancelUrl);
      console.log('Navigated to results (should be FALSE after cancel):', navigatedAway);

      R.verify7b_submitDialog = dialogAppeared;
      R.verify7b_cancelWorks = !navigatedAway;
      console.log('Submit dialog appears:', R.verify7b_submitDialog ? 'PASS' : 'FAIL');
      console.log('Cancel prevents submit:', R.verify7b_cancelWorks ? 'PASS' : 'FAIL');

      await ss(page, '11_after_submit_cancel');
    }
  } else {
    console.log('Not on FRQ review or no Submit Test button');
    R.verify7b_submitDialog = null;
  }

  await browser.close();

  // ====================================================
  // FINAL SUMMARY
  // ====================================================
  console.log('\n===== FINAL RESULTS SUMMARY =====');
  console.log('Login:', R.login ? 'PASS' : 'FAIL');
  console.log('1. logError crash fix (code.startsWith):', R.verify1_logError ? 'PASS' : 'FAIL');
  console.log('   Source fix (String() coercion):', R.verify1_sourceFix ? 'YES' : 'NO');
  console.log('2. MCQ letter badge contrast:', R.verify2_letterBadge ? 'PASS' : 'FAIL');
  console.log('3. Timer on review screen:', R.verify3_timerOnReview ? 'PASS' : (R.verify3_timerOnReview === null ? 'N/A' : 'FAIL'));
  console.log('5. FRQ nav starts at 1:', R.verify5_frqNavIndex ? 'PASS' : (R.verify5_frqNavIndex === null ? 'N/A' : 'FAIL'));
  console.log('6. Timer urgency code:', R.verify6_timerUrgency ? 'PASS' : 'FAIL');
  console.log('7a. FRQ two-step confirm:', R.verify7a_twoStep ? 'PASS' : (R.verify7a_twoStep === null ? 'N/A' : 'FAIL'));
  console.log('7b. Submit Test dialog:', R.verify7b_submitDialog ? 'PASS' : (R.verify7b_submitDialog === null ? 'N/A' : 'FAIL'));
  console.log('7c. Cancel prevents submit:', R.verify7b_cancelWorks ? 'PASS' : (R.verify7b_cancelWorks === null ? 'N/A' : 'FAIL'));
  console.log('8. No duplicate nav entries:', R.verify8_noDups ? 'PASS' : (R.verify8_noDups === null ? 'N/A' : 'FAIL'));

  console.log('\n=== CONSOLE ERRORS ===');
  consoleErrors.forEach(function(e) {
    console.log('[' + e.type + ']', e.url.substring(0, 50), ':', e.msg.substring(0, 200));
  });
})().catch(function(e) { console.error('FATAL:', e.message, e.stack ? e.stack.substring(0, 500) : ''); process.exit(1); });
