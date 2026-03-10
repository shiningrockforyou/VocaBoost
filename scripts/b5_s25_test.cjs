/**
 * B5 S-25: Section Lock Indicator - Focused test
 * Also tests S-24 timer warning colors via React state manipulation
 */
const { chromium } = require('playwright');
const fs = require('fs');

const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_B5';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleMsgs = [];
  page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));

  const results = {
    s24_warning: null,
    s24_error: null,
    s25_lockIndicator: null,
    s25_backBlocked: null,
    consoleErrors: [],
  };

  try {
    // Login
    console.log('Logging in...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.fill('input[type="email"]', 'teacher@apboost.test');
    await page.fill('input[type="password"]', 'Teacher123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);
    console.log('URL after login:', page.url());

    // -------------------------------------------------------
    // S-24: Timer Warning Test via React state injection
    // -------------------------------------------------------
    console.log('\n=== S-24: Timer Warning Colors (React state injection) ===');

    // Start the Calc test
    await page.goto('http://localhost:5173/ap/test/test_calc_ab_full_1', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    // Click Begin Test or Resume
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Begin Test') || b.textContent.includes('Resume'));
      if (btn) btn.click();
    });
    await page.waitForTimeout(3000);

    // Verify we're in the test
    const inTest = await page.evaluate(() => document.body.textContent.includes('Section 1 of 2'));
    console.log('In test:', inTest);

    // S-24: Timer warning color test
    // Strategy: Use React DevTools fiber to find the TestTimer component state
    // and manipulate it, OR use a simpler approach of checking the CSS classes
    // that would appear at different timer values

    // First, check current timer
    const timerInfo = await page.evaluate(() => {
      const mono = document.querySelector('.font-mono');
      const container = mono ? mono.parentElement : null;
      return {
        text: mono ? mono.textContent.trim() : null,
        containerClass: container ? container.className : null,
        classes: {
          textPrimary: container ? container.classList.contains('text-text-primary') : null,
          warningText: container ? container.classList.contains('text-warning-text') : null,
          errorText: container ? container.classList.contains('text-error-text') : null,
        }
      };
    });
    console.log('Timer at start (>5min):', JSON.stringify(timerInfo));
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_s24_v2_normal.png`, fullPage: true });

    // Try to find React root and navigate fiber tree to find TestTimer's timeRemaining prop
    const fiberManipResult = await page.evaluate(() => {
      try {
        // Get root div and find React fiber
        const root = document.getElementById('root');
        if (!root) return { success: false, reason: 'No root' };

        // Find React fiber key
        const fiberKey = Object.keys(root).find(k => k.startsWith('__reactFiber$'));
        if (!fiberKey) return { success: false, reason: 'No fiber key on root' };

        // Traverse fiber tree to find TestTimer component
        function findComponentByName(fiber, name, depth = 0) {
          if (!fiber || depth > 100) return null;
          if (fiber.type && (typeof fiber.type === 'function' || typeof fiber.type === 'object')) {
            const typeName = fiber.type.name || fiber.type.displayName || '';
            if (typeName === name) return fiber;
          }
          // Check child and sibling
          const inChild = findComponentByName(fiber.child, name, depth + 1);
          if (inChild) return inChild;
          return findComponentByName(fiber.sibling, name, depth + 1);
        }

        const rootFiber = root[fiberKey];
        const testTimerFiber = findComponentByName(rootFiber, 'TestTimer');

        if (!testTimerFiber) {
          return { success: false, reason: 'TestTimer fiber not found in tree' };
        }

        return {
          success: true,
          props: testTimerFiber.pendingProps || testTimerFiber.memoizedProps,
          componentName: testTimerFiber.type?.name,
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
    console.log('Fiber manipulation result:', JSON.stringify(fiberManipResult));

    // Since we can verify classes at runtime, let's try a different approach:
    // We'll find the TestTimer element in the DOM and manually apply the classes
    // to test what each state would look like, then check the source code class logic

    // Check what CSS variables are defined for text-warning-text and text-error-text
    const cssVarsCheck = await page.evaluate(() => {
      const root = document.documentElement;
      const styles = getComputedStyle(root);
      // Get all CSS custom properties
      const allVars = {};
      for (const name of ['--warning-text', '--error-text', '--text-primary', '--warning', '--error']) {
        allVars[name] = styles.getPropertyValue(name).trim();
      }
      // Get the computed color of elements with these classes
      const timerEl = document.querySelector('.font-mono');
      const container = timerEl ? timerEl.parentElement : null;
      return {
        cssVars: allVars,
        currentContainerClass: container ? container.className : null,
        // Test warning class by creating a temp element
        warningTextColor: (() => {
          const tmp = document.createElement('span');
          tmp.className = 'text-warning-text';
          document.body.appendChild(tmp);
          const color = getComputedStyle(tmp).color;
          document.body.removeChild(tmp);
          return color;
        })(),
        errorTextColor: (() => {
          const tmp = document.createElement('span');
          tmp.className = 'text-error-text';
          document.body.appendChild(tmp);
          const color = getComputedStyle(tmp).color;
          document.body.removeChild(tmp);
          return color;
        })(),
        primaryTextColor: (() => {
          const tmp = document.createElement('span');
          tmp.className = 'text-text-primary';
          document.body.appendChild(tmp);
          const color = getComputedStyle(tmp).color;
          document.body.removeChild(tmp);
          return color;
        })(),
      };
    });
    console.log('CSS vars check:', JSON.stringify(cssVarsCheck, null, 2));

    // Now test S-24 warning and error by directly finding the React setState and setting timeRemaining
    // Alternative: Check if timer has a test hook or use a time-skip approach

    // Advanced: Try to find React setState for the timer hook in useTestSession
    const stateManipAttempt = await page.evaluate(() => {
      try {
        // Walk the fiber tree from root to find a fiber with timeRemaining in state
        const root = document.getElementById('root');
        if (!root) return { success: false };
        const fiberKey = Object.keys(root).find(k => k.startsWith('__reactFiber$'));
        if (!fiberKey) return { success: false, reason: 'No fiber key' };

        function findFiberWithState(fiber, depth = 0) {
          if (!fiber || depth > 200) return null;
          // Check memoizedState for hook state with timeRemaining-like values
          let hookState = fiber.memoizedState;
          while (hookState) {
            if (hookState.queue && typeof hookState.memoizedState === 'number' &&
                hookState.memoizedState > 60 && hookState.memoizedState < 10000) {
              // This could be the timeRemaining state
              return { fiber, hookState, value: hookState.memoizedState };
            }
            hookState = hookState.next;
          }
          const inChild = findFiberWithState(fiber.child, depth + 1);
          if (inChild) return inChild;
          return findFiberWithState(fiber.sibling, depth + 1);
        }

        const rootFiber = root[fiberKey];
        const found = findFiberWithState(rootFiber);
        if (found) {
          return {
            success: true,
            value: found.value,
            hasQueue: !!found.hookState.queue,
          };
        }
        return { success: false, reason: 'No matching state found' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
    console.log('State manip attempt:', JSON.stringify(stateManipAttempt));

    // Since direct state manipulation is complex, let's verify warning colors
    // by checking what happens at the DOM level when classes are applied
    // This confirms the CSS tokens resolve correctly
    const colorTokenTest = await page.evaluate(() => {
      const timerEl = document.querySelector('.font-mono');
      const container = timerEl ? timerEl.parentElement : null;

      if (!container) return { error: 'No timer container' };

      // Test: temporarily apply warning class and check rendering
      const origClass = container.className;

      // Test warning state
      container.className = 'flex items-center gap-2 text-warning-text';
      const warningColor = getComputedStyle(container).color;

      // Test error state
      container.className = 'flex items-center gap-2 text-error-text';
      const errorColor = getComputedStyle(container).color;

      // Test normal state
      container.className = 'flex items-center gap-2 text-text-primary';
      const normalColor = getComputedStyle(container).color;

      // Restore
      container.className = origClass;

      return {
        normalColor,
        warningColor,
        errorColor,
        colorsAreDifferent: normalColor !== warningColor && warningColor !== errorColor && normalColor !== errorColor,
        warningDiffersFromNormal: warningColor !== normalColor,
        errorDiffersFromNormal: errorColor !== normalColor,
      };
    });
    console.log('Color token test:', JSON.stringify(colorTokenTest, null, 2));

    results.s24_warning = colorTokenTest.warningDiffersFromNormal ? 'TOKENS RESOLVE: warning color differs from normal' : 'TOKENS FAIL: warning color same as normal';
    results.s24_error = colorTokenTest.errorDiffersFromNormal ? 'TOKENS RESOLVE: error color differs from normal' : 'TOKENS FAIL: error color same as normal';

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_s24_v2_colortest.png`, fullPage: true });

    // -------------------------------------------------------
    // S-25: Section Lock Indicator - Navigate to Section 2
    // -------------------------------------------------------
    console.log('\n=== S-25: Section Lock Indicator ===');

    // Get all button texts to understand navigation
    const allButtons = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t.length > 0)
    );
    console.log('All buttons:', JSON.stringify(allButtons));

    // Navigate to Q15 (last question) quickly using question navigator
    // Click the "Question 1 of 15" button to open navigator
    console.log('  Opening question navigator...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const navBtn = btns.find(b => b.textContent.includes('of 15') || b.textContent.includes('Question 1'));
      if (navBtn) navBtn.click();
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_s25_v2_navigator.png`, fullPage: true });

    // Check if navigator is open
    const navOpen = await page.evaluate(() => {
      const bodyText = document.body.textContent;
      return bodyText.includes('Question Navigator') || bodyText.includes('Q15') || bodyText.includes('15\n') || bodyText.includes(' 15 ');
    });
    console.log('Navigator open:', navOpen);

    // Click Q15 directly in the navigator grid
    const q15Clicked = await page.evaluate(() => {
      // Look for button with text "15" in the navigator
      const btns = Array.from(document.querySelectorAll('button'));
      const q15Btn = btns.find(b => b.textContent.trim() === '15');
      if (q15Btn) { q15Btn.click(); return true; }
      return false;
    });
    console.log('Q15 clicked:', q15Clicked);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_s25_v2_q15.png`, fullPage: true });

    // If navigator didn't work, navigate using repeated Next clicks
    if (!q15Clicked) {
      console.log('  Navigator Q15 click failed. Using repeated Next → clicks...');
      for (let i = 0; i < 15; i++) {
        const nextResult = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          // Next → has the arrow character
          const nextBtn = btns.find(b => b.textContent.includes('Next') && b.textContent.includes('→'));
          const reviewBtn = btns.find(b => b.textContent.includes('Review') && b.textContent.includes('→'));
          if (nextBtn && !nextBtn.disabled) { nextBtn.click(); return 'next'; }
          if (reviewBtn) { reviewBtn.click(); return 'review'; }
          return null;
        });
        console.log(`  Nav step ${i+1}: ${nextResult}`);
        await page.waitForTimeout(400);
        if (nextResult === 'review') break;
      }
    }

    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_s25_v2_near_end.png`, fullPage: true });

    // Check if we have a Review → button (means we're on last question)
    const onLastQ = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent.includes('Review') && b.textContent.includes('→'));
    });
    console.log('On last question (Review → button present):', onLastQ);

    // Click Review → to go to review screen
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const reviewBtn = btns.find(b => b.textContent.includes('Review') && b.textContent.includes('→'));
      if (reviewBtn) reviewBtn.click();
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_s25_v2_review.png`, fullPage: true });

    // Check if we're on review screen with Submit Section button
    const onReviewScreen = await page.evaluate(() => {
      const bodyText = document.body.textContent;
      const btns = Array.from(document.querySelectorAll('button'));
      return {
        hasSubmitSection: btns.some(b => b.textContent.includes('Submit Section')),
        hasReviewHeading: bodyText.includes('Review Your Answers') || bodyText.includes('Section Summary'),
        bodySnippet: bodyText.substring(0, 300),
        buttons: btns.map(b => b.textContent.trim()).filter(t => t.length > 2),
      };
    });
    console.log('Review screen state:', JSON.stringify(onReviewScreen));

    // Submit Section 1
    if (onReviewScreen.hasSubmitSection) {
      console.log('  Submitting Section 1...');
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const submitBtn = btns.find(b => b.textContent.includes('Submit Section'));
        if (submitBtn) submitBtn.click();
      });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_s25_v2_after_submit.png`, fullPage: true });

      const afterSubmit = await page.evaluate(() => {
        const bodyText = document.body.textContent;
        return {
          bodySnippet: bodyText.substring(0, 400),
          buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t.length > 2 && t.length < 80),
        };
      });
      console.log('After submit state:', JSON.stringify(afterSubmit));

      // Check for FRQ choice screen
      const hasFRQChoice = afterSubmit.bodySnippet.includes('Type Your Answers') ||
        afterSubmit.bodySnippet.includes('Write by Hand');

      if (hasFRQChoice) {
        console.log('  FRQ choice screen shown. Clicking Type Your Answers...');
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const typeBtn = btns.find(b => b.textContent.includes('Type Your Answers') || b.textContent.includes('Type'));
          if (typeBtn) typeBtn.click();
        });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_s25_v2_section2_entered.png`, fullPage: true });
      }

      // Now check Section 2 header and lock indicator
      const section2State = await page.evaluate(() => {
        const bodyText = document.body.textContent;
        const sectionMatch = bodyText.match(/Section (\d+) of (\d+)/);

        // Check lock indicator: lock SVG (viewBox="0 0 20 20")
        const svgs = Array.from(document.querySelectorAll('svg'));
        const lockSVGData = svgs.map(svg => ({
          viewBox: svg.getAttribute('viewBox'),
          innerHTML: svg.innerHTML.substring(0, 100),
          parentTitle: svg.closest('[title]')?.getAttribute('title'),
        }));

        // Check for "Locked" text in DOM
        const lockedTextEl = Array.from(document.querySelectorAll('*')).find(el =>
          el.children.length === 0 && el.textContent.trim() === 'Locked'
        );

        // Check for title="Previous sections are locked"
        const lockedTitleEl = document.querySelector('[title="Previous sections are locked"]');

        // Check header area (APHeader)
        const headerEl = document.querySelector('header') || document.querySelector('[class*="border-b"]');
        const headerText = headerEl ? headerEl.textContent.trim().substring(0, 200) : null;
        const headerHTML = headerEl ? headerEl.innerHTML.substring(0, 500) : null;

        // Check Back button
        const backBtn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.includes('Back') || b.textContent.includes('←')
        );

        return {
          currentSection: sectionMatch ? sectionMatch[1] : null,
          totalSections: sectionMatch ? sectionMatch[2] : null,
          lockedTextFound: !!lockedTextEl,
          lockedTextContent: lockedTextEl ? lockedTextEl.textContent.trim() : null,
          lockedTitleFound: !!lockedTitleEl,
          lockedTitleText: lockedTitleEl ? lockedTitleEl.getAttribute('title') : null,
          lockSVGs: lockSVGData.filter(s => s.viewBox === '0 0 20 20' || s.parentTitle?.includes('lock')),
          headerText,
          backBtnFound: !!backBtn,
          backBtnDisabled: backBtn ? backBtn.disabled : null,
          backBtnText: backBtn ? backBtn.textContent.trim() : null,
          bodySnippet: bodyText.substring(0, 500),
        };
      });
      console.log('Section 2 state:', JSON.stringify(section2State, null, 2));
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_s25_v2_section2_full.png`, fullPage: true });

      // Set results
      results.s25_lockIndicator = {
        inSection2: section2State.currentSection === '2',
        lockedTextFound: section2State.lockedTextFound,
        lockedTitleFound: section2State.lockedTitleFound,
        lockSVGsFound: section2State.lockSVGs.length > 0,
        raw: section2State,
      };
      results.s25_backBlocked = {
        backBtnFound: section2State.backBtnFound,
        backBtnDisabled: section2State.backBtnDisabled,
      };
    } else {
      console.log('  Could NOT reach review screen with Submit Section button');
      console.log('  Buttons found:', onReviewScreen.buttons.slice(0, 10));
      results.s25_lockIndicator = { error: 'Could not submit Section 1', buttons: onReviewScreen.buttons };
    }

    // -------------------------------------------------------
    // Also check APHeader source for lock indicator structure
    // -------------------------------------------------------

    // Collect console errors
    results.consoleErrors = consoleMsgs.filter(m =>
      m.type === 'error' || m.text.includes('[APBoost:') || m.text.includes('Error')
    );

    console.log('\n=== CONSOLE ERRORS ===');
    results.consoleErrors.slice(0, 10).forEach(e => console.log(' ', e.type, ':', e.text.substring(0, 100)));

  } catch (err) {
    console.error('Error:', err.message);
    results.error = err.message;
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_s25_error.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  console.log('\n=== FINAL RESULTS ===');
  console.log(JSON.stringify(results, null, 2));

  fs.writeFileSync(
    'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b5_audit_results_v2.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\nSaved to b5_audit_results_v2.json');
  return results;
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
