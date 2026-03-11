const { chromium } = require('playwright');
const fs = require('fs');

async function ss(page, name) {
  const path = 'src/apBoost/criteria_audit/playwright_reports/b14b_retest_' + name + '.png';
  await page.screenshot({ path, fullPage: false });
  console.log('[SS] ' + name);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];

  page.on('console', function(msg) {
    if (msg.type() === 'error') {
      consoleErrors.push({ url: page.url(), type: 'console_error', msg: msg.text().substring(0, 400) });
    }
  });
  page.on('pageerror', function(err) {
    consoleErrors.push({ url: page.url(), type: 'pageerror', msg: err.message.substring(0, 400) });
  });

  var results = {};

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
  results.login = page.url().includes('/ap') && !page.url().includes('login');
  await ss(page, '01_dashboard');

  // === NAVIGATE TO MICRO TEST ===
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await page.waitForTimeout(4000);

  var bodyCheck = await page.textContent('body');
  var hasError = bodyCheck.includes('Something went wrong') || bodyCheck.includes('unexpected error');
  if (hasError) {
    console.log('ERROR: Test session still broken:', bodyCheck.substring(0, 300));
    await browser.close();
    return;
  }

  await ss(page, '02_micro_instruction');

  // Begin test
  var startBtn = await page.$('button:has-text("Begin Test"), button:has-text("Resume Test")');
  if (!startBtn) {
    startBtn = await page.$('button:has-text("Resume"), button:has-text("Start")');
  }
  var startBtnText = startBtn ? await startBtn.textContent() : 'NOT FOUND';
  console.log('Start button:', startBtnText.trim());

  if (startBtn) {
    await startBtn.click();
    await page.waitForTimeout(3000);
  }

  // Check errors after loading test
  var errorsAfterLoad = consoleErrors.slice();

  // =====================================
  // VERIFY 1: logError crash (console check)
  // =====================================
  console.log('\n=== VERIFY 1: B14B-NEW-001 logError crash ===');
  var codeStartsWithErrors = consoleErrors.filter(function(e) {
    return e.msg.includes('code.startsWith') || e.msg.includes('startsWith is not');
  });
  var scheduleFlushErrors = consoleErrors.filter(function(e) {
    return e.msg.includes('scheduleFlush');
  });
  results.logErrorFix = codeStartsWithErrors.length === 0;
  results.scheduleFlushFix = scheduleFlushErrors.length === 0;
  console.log('code.startsWith errors:', codeStartsWithErrors.length, '->', results.logErrorFix ? 'PASS' : 'FAIL');
  console.log('scheduleFlush errors:', scheduleFlushErrors.length, '->', results.scheduleFlushFix ? 'PASS' : 'FAIL');
  console.log('Total console errors:', consoleErrors.length);

  var logErrorSource = fs.readFileSync('src/apBoost/utils/logError.js', 'utf-8');
  var codeLine = logErrorSource.split('\n').find(function(l) { return l.trim().startsWith('const code ='); });
  console.log('logError.js code line:', codeLine);
  console.log('String() coercion applied:', codeLine && codeLine.includes('String(') ? 'YES' : 'NO');

  // =====================================
  // VERIFY 2: MCQ letter badge contrast
  // =====================================
  console.log('\n=== VERIFY 2: B14B-LIVE-001 MCQ letter badge contrast ===');
  await ss(page, '03_mcq_q1_before_answer');

  var answerA = await page.$('button[aria-label="Choice A"]');
  if (answerA) {
    await answerA.click();
    await page.waitForTimeout(500);
    await ss(page, '04_mcq_q1_selected');

    var selectedSpans = await page.$$eval('button[aria-checked="true"] span', function(spans) {
      return spans.map(function(s) { return { cls: s.className, txt: s.textContent.trim() }; });
    });
    console.log('Selected button spans:', JSON.stringify(selectedSpans));

    // Check if badge uses bg-white text-brand-primary (the fix)
    var badgeSpan = selectedSpans.find(function(s) { return s.txt.length === 1 && /[A-J]/.test(s.txt); });
    console.log('Letter badge span:', JSON.stringify(badgeSpan));

    var hasFix = badgeSpan && badgeSpan.cls.includes('bg-white') && !badgeSpan.cls.includes('bg-white/');
    var hasBroken = badgeSpan && badgeSpan.cls.includes('bg-white/20');

    results.letterBadgeFix = hasFix && !hasBroken;
    console.log('Badge bg-white (not bg-white/20):', results.letterBadgeFix ? 'PASS' : 'FAIL');
    console.log('Has fix (bg-white):', hasFix, '  Still broken (bg-white/20):', hasBroken);
  } else {
    console.log('No choice A button found');
    results.letterBadgeFix = false;
  }

  // =====================================
  // VERIFY 6: Timer urgency DOM check
  // =====================================
  console.log('\n=== VERIFY 6: B14B-006 Timer urgency cues (DOM check) ===');
  var timerEls = await page.$$eval('[class*="font-mono"]', function(els) {
    return els.map(function(el) {
      return { text: el.textContent.trim(), cls: el.className, parentCls: el.parentElement ? el.parentElement.className : '' };
    });
  });
  console.log('Timer elements:', JSON.stringify(timerEls));
  results.timerStructure = timerEls.length > 0;

  // Check urgency classes on parent
  var timerParentCls = timerEls[0] ? timerEls[0].parentCls : '';
  var hasBoldClass = timerParentCls.includes('font-bold');
  var hasPulseClass = timerParentCls.includes('animate-pulse');
  console.log('Timer parent classes:', timerParentCls);
  console.log('font-bold present in timer:', hasBoldClass);
  console.log('animate-pulse present in timer:', hasPulseClass);
  console.log('Timer structure exists:', results.timerStructure ? 'PASS (structure present)' : 'FAIL');

  // Note: urgency classes only appear when timer < 5min or < 1min
  // At test start the timer is at 35min so urgency classes won't show
  // We verify the code is correct by reading TestTimer.jsx
  var testTimerSource = fs.readFileSync('src/apBoost/components/TestTimer.jsx', 'utf-8');
  var hasUnder60Check = testTimerSource.includes('<= 60') && testTimerSource.includes('animate-pulse');
  var hasUnder300Check = testTimerSource.includes('<= 300') && testTimerSource.includes('font-bold');
  console.log('TestTimer has under-60 pulse:', hasUnder60Check ? 'YES' : 'NO');
  console.log('TestTimer has under-300 bold:', hasUnder300Check ? 'YES' : 'NO');
  results.timerUrgency = hasUnder60Check && hasUnder300Check;
  console.log('Timer urgency code:', results.timerUrgency ? 'PASS' : 'FAIL');

  // =====================================
  // VERIFY 8: No duplicate nav entries
  // =====================================
  console.log('\n=== VERIFY 8: Duplicate question ID dedup ===');
  var navToggle = await page.$('button:has-text("Question 1 of")');
  if (navToggle) {
    await navToggle.click();
    await page.waitForTimeout(800);
    await ss(page, '05_navigator_open');

    var navBtns = await page.$$eval('button[class*="h-11"]', function(btns) {
      return btns.map(function(b) { return b.textContent.trim(); });
    });
    console.log('Navigator buttons:', navBtns);

    // Count duplicates
    var seen = {};
    var dups = [];
    navBtns.forEach(function(l) {
      if (seen[l]) dups.push(l);
      seen[l] = true;
    });
    console.log('Duplicate labels:', dups);
    results.noDuplicateNav = dups.length === 0 && navBtns.length > 0;
    console.log('No duplicate nav entries:', results.noDuplicateNav ? 'PASS' : 'FAIL');

    // Close navigator by pressing Escape or clicking backdrop
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } else {
    console.log('Nav toggle not found');
    results.noDuplicateNav = null;
  }

  // =====================================
  // Answer all MCQ questions
  // =====================================
  console.log('\n=== ANSWERING MCQ Q1-Q15 ===');
  // Already answered Q1 (choice A). Now answer Q2-Q15
  for (var q = 2; q <= 15; q++) {
    var nextBtn = await page.$('button:has-text("Next \u2192")');
    if (!nextBtn) nextBtn = await page.$('button:has-text("Next")');
    var reviewGoBtn = await page.$('button:has-text("Review \u2192")');

    if (nextBtn) {
      var bBtn = await page.$('button[aria-label="Choice B"]');
      if (bBtn) await bBtn.click();
      await page.waitForTimeout(150);
      await nextBtn.click();
      await page.waitForTimeout(400);
    } else if (reviewGoBtn) {
      var bBtn2 = await page.$('button[aria-label="Choice B"]');
      if (bBtn2) await bBtn2.click();
      await page.waitForTimeout(150);
      break;
    }
  }

  // Click Review
  var reviewGoBtn2 = await page.$('button:has-text("Review \u2192")');
  if (!reviewGoBtn2) reviewGoBtn2 = await page.$('button:has-text("Review")');
  if (reviewGoBtn2) {
    await reviewGoBtn2.click();
    await page.waitForTimeout(2000);
  }

  // =====================================
  // VERIFY 3: Timer on review screen
  // =====================================
  console.log('\n=== VERIFY 3: B14B-LIVE-002 Timer on review screen ===');
  var reviewBody = await page.textContent('body');
  var onReview = reviewBody.includes('Review Your Answers');
  console.log('On review screen:', onReview);
  await ss(page, '06_review_screen');

  var reviewTimerEls = await page.$$eval('[class*="font-mono"]', function(els) {
    return els.map(function(el) { return { text: el.textContent.trim(), cls: el.className }; });
  });
  console.log('Timer elements on review:', JSON.stringify(reviewTimerEls));
  var timerOnReview = reviewBody.match(/\d{1,2}:\d{2}/);
  console.log('Timer value on review:', timerOnReview ? timerOnReview[0] : 'NOT FOUND');
  results.timerOnReview = !!(timerOnReview && reviewTimerEls.length > 0);
  console.log('Timer on review:', results.timerOnReview ? 'PASS' : 'FAIL');

  // =====================================
  // VERIFY 7 (MCQ section): Submit Section
  // =====================================
  console.log('\n=== SUBMITTING MCQ SECTION ===');
  var isSubmitSection = reviewBody.includes('Submit Section');
  var isSubmitTest = reviewBody.includes('Submit Test');
  console.log('Submit Section button:', isSubmitSection);
  console.log('Submit Test button:', isSubmitTest);

  if (isSubmitSection) {
    var submitSectionBtn = await page.$('button:has-text("Submit Section")');
    if (submitSectionBtn) {
      await submitSectionBtn.click();
      await page.waitForTimeout(3000);
      var postSectionBody = await page.textContent('body');
      var onFRQChoice = postSectionBody.includes('Type Your Answers') || postSectionBody.includes('Write by Hand');
      console.log('On FRQ choice screen:', onFRQChoice);
      await ss(page, '07_frq_choice');

      // =====================================
      // VERIFY 7: FRQ two-step confirmation
      // =====================================
      console.log('\n=== VERIFY 7: FRQ choice two-step confirmation ===');
      if (onFRQChoice) {
        var confirmBtnBefore = await page.$('button:has-text("Confirm")');
        console.log('Confirm button BEFORE selection:', !!confirmBtnBefore);

        // Click Type Your Answers card
        var typeCard = await page.$('h3:has-text("Type Your Answers")');
        if (!typeCard) typeCard = await page.$('button:has-text("Type Your Answers")');
        if (typeCard) {
          await typeCard.click();
          await page.waitForTimeout(600);
          await ss(page, '08_frq_type_selected');

          var confirmBtnAfter = await page.$('button:has-text("Confirm")');
          console.log('Confirm button AFTER Type selection:', !!confirmBtnAfter);
          results.frqTwoStepConfirm = !confirmBtnBefore && !!confirmBtnAfter;
          console.log('FRQ two-step confirm:', results.frqTwoStepConfirm ? 'PASS' : 'FAIL');

          // Click Confirm to enter FRQ section
          if (confirmBtnAfter) {
            await confirmBtnAfter.click();
            await page.waitForTimeout(2500);
          }
        }
      }
    }
  }

  // =====================================
  // VERIFY 5: FRQ navigator label (Q1 not Q0)
  // =====================================
  console.log('\n=== VERIFY 5: B14B-003 FRQ navigator label ===');
  var frqBody = await page.textContent('body');
  var isFRQSection = frqBody.includes('Question') && frqBody.includes('textarea');
  console.log('On FRQ section:', isFRQSection);
  await ss(page, '09_frq_q1');

  var navLabel = frqBody.match(/Question (\d+) of (\d+)/);
  console.log('Nav label match:', navLabel ? navLabel[0] : 'NOT FOUND');
  var frqNavIndex = navLabel ? parseInt(navLabel[1]) : null;
  results.frqNavStartsAtOne = frqNavIndex === 1;
  console.log('FRQ nav index:', frqNavIndex, '-> starts at 1:', results.frqNavStartsAtOne ? 'PASS' : 'FAIL');

  // =====================================
  // Answer FRQ + VERIFY 7: Submit Test confirmation
  // =====================================
  console.log('\n=== ANSWERING FRQ SUB-QUESTIONS ===');
  for (var i = 0; i < 8; i++) {
    var frqTextarea = await page.$('textarea');
    if (frqTextarea) {
      await frqTextarea.fill('This is my detailed answer for this sub-question. The economic concept relates to market equilibrium and supply/demand interactions in the short run.');
      await page.waitForTimeout(200);
    }

    var frqNext = await page.$('button:has-text("Next \u2192")');
    var frqReview = await page.$('button:has-text("Review \u2192")');

    if (frqNext) {
      await frqNext.click();
      await page.waitForTimeout(500);
    } else if (frqReview) {
      await frqReview.click();
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

  // =====================================
  // VERIFY 7: Submit Test confirmation dialog
  // =====================================
  console.log('\n=== VERIFY 7 (cont): B14B-LIVE-007 Submit Test confirmation ===');
  var hasSubmitTest = frqReviewBody.includes('Submit Test');
  console.log('Submit Test button on FRQ review:', hasSubmitTest);

  if (hasSubmitTest) {
    var submitTestBtn = await page.$('button:has-text("Submit Test")');
    if (submitTestBtn) {
      var dialogAppeared = false;
      var dialogMsg = '';

      page.once('dialog', async function(dialog) {
        dialogAppeared = true;
        dialogMsg = dialog.message();
        console.log('Dialog message:', dialogMsg);
        await dialog.dismiss();
      });

      await submitTestBtn.click();
      await page.waitForTimeout(2000);

      var postSubmitUrl = page.url();
      var navigatedAway = postSubmitUrl.includes('/results/');

      console.log('Dialog appeared:', dialogAppeared);
      console.log('Dialog message:', dialogMsg);
      console.log('URL after cancel:', postSubmitUrl);
      console.log('Navigated to results after cancel:', navigatedAway);

      results.submitConfirm = dialogAppeared;
      results.cancelWorks = !navigatedAway;
      console.log('Submit dialog appeared:', dialogAppeared ? 'PASS' : 'FAIL');
      console.log('Cancel prevents submit:', !navigatedAway ? 'PASS' : 'FAIL');

      await ss(page, '11_after_submit_cancel');
    }
  } else {
    console.log('No Submit Test button found on FRQ review');
    results.submitConfirm = false;
    results.cancelWorks = false;
  }

  await browser.close();

  // === FINAL SUMMARY ===
  console.log('\n===== FINAL RESULTS SUMMARY =====');
  console.log('Login:', results.login ? 'PASS' : 'FAIL');
  console.log('1. logError no crash (code.startsWith):', results.logErrorFix ? 'PASS' : 'FAIL');
  console.log('   scheduleFlush TDZ fixed:', results.scheduleFlushFix ? 'PASS' : 'FAIL');
  console.log('2. MCQ letter badge contrast:', results.letterBadgeFix ? 'PASS' : 'FAIL');
  console.log('3. Timer on review screen:', results.timerOnReview ? 'PASS' : 'FAIL');
  console.log('5. FRQ nav starts at 1:', results.frqNavStartsAtOne ? 'PASS' : 'FAIL');
  console.log('6. Timer urgency code:', results.timerUrgency ? 'PASS' : 'FAIL');
  console.log('7a. FRQ two-step confirm:', results.frqTwoStepConfirm ? 'PASS' : 'FAIL');
  console.log('7b. Submit Test dialog appears:', results.submitConfirm ? 'PASS' : 'FAIL');
  console.log('7c. Cancel prevents submit:', results.cancelWorks ? 'PASS' : 'FAIL');
  console.log('8. No duplicate nav entries:', results.noDuplicateNav ? 'PASS' : (results.noDuplicateNav === null ? 'N/A' : 'FAIL'));

  console.log('\n=== ALL CONSOLE ERRORS ===');
  consoleErrors.forEach(function(e) {
    console.log('[' + e.type + ']', e.url.substring(0, 50), ':', e.msg.substring(0, 200));
  });

  return results;
})().catch(function(e) { console.error('FATAL:', e.message, e.stack ? e.stack.substring(0, 400) : ''); process.exit(1); });
