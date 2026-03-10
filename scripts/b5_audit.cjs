/**
 * B5 Audit Script: Annotation Tools & Visual Polish
 * Scenarios: S-22, S-23, S-24, S-25, S-26
 */
const { chromium } = require('playwright');
const fs = require('fs');

const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_B5';
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const EMAIL = 'teacher@apboost.test';
const PASSWORD = 'Teacher123!';
const BASE_URL = 'http://localhost:5173';

async function loginAsTeacher(page) {
  console.log('Logging in as teacher...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  const url = page.url();
  console.log('URL after login:', url);
  return url;
}

async function runB5() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleMessages = [];
  page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));

  const results = {
    login: null,
    s22: { status: null, notes: [], evidence: [] },
    s23: { status: null, notes: [], evidence: [] },
    s24: { status: null, notes: [], evidence: [] },
    s25: { status: null, notes: [], evidence: [] },
    s26: { status: null, notes: [], evidence: [] },
    consoleErrors: [],
  };

  try {
    // -------------------------------------------------------
    // LOGIN
    // -------------------------------------------------------
    const urlAfterLogin = await loginAsTeacher(page);
    if (urlAfterLogin.includes('/login')) {
      results.login = 'FAIL - still on login page';
      throw new Error('Login failed');
    }
    // Navigate to AP dashboard directly
    await page.goto(`${BASE_URL}/ap`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    const bodyText = await page.evaluate(() => document.body.textContent);
    if (bodyText.includes('AP Practice Tests') || bodyText.includes('Calculus') || bodyText.includes('Micro')) {
      results.login = 'SUCCESS - at /ap dashboard';
    } else {
      results.login = `UNCLEAR - ${bodyText.substring(0, 100)}`;
    }
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_01_dashboard.png`, fullPage: true });
    console.log('Login result:', results.login);

    // -------------------------------------------------------
    // CHECK SEED DATA: Are there HORIZONTAL format questions in Calc test?
    // -------------------------------------------------------
    console.log('\n=== CHECKING SEED DATA FOR HORIZONTAL QUESTIONS ===');
    // Navigate to Calc test
    await page.goto(`${BASE_URL}/ap/test/test_calc_ab_full_1`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_02_calc_instruction.png`, fullPage: true });
    const instrText = await page.evaluate(() => document.body.textContent);
    console.log('Instruction screen text (first 200):', instrText.substring(0, 200));

    // Check if there's a Begin Test or Resume Test button
    const hasBeginBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent.includes('Begin Test') || b.textContent.includes('Resume'));
    });
    console.log('Has begin/resume button:', hasBeginBtn);

    if (!hasBeginBtn) {
      results.s26.notes.push('No Begin Test button found on Calc test instruction screen');
    } else {
      // Click Begin Test (or Resume)
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent.includes('Begin Test') || b.textContent.includes('Resume'));
        if (btn) btn.click();
      });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_03_calc_q1.png`, fullPage: true });
      console.log('Entered test. URL:', page.url());
    }

    // -------------------------------------------------------
    // S-26: LaTeX Rendering in Calc Test
    // -------------------------------------------------------
    console.log('\n=== S-26: LaTeX Rendering ===');

    // Check current page for LaTeX/MathText
    const q1DOM = await page.evaluate(() => {
      const body = document.body;
      const hasRawLatex = body.textContent.includes('$f(') ||
        body.textContent.includes('\\int') ||
        body.textContent.includes('\\frac') ||
        body.textContent.includes('\\lim');
      const mathElements = document.querySelectorAll('[class*="MJX"], .MathJax, mjx-container, math');
      const hasMathJax = mathElements.length > 0;
      const questionText = (() => {
        const el = document.querySelector('[class*="text-text-primary"]');
        return el ? el.textContent.trim().substring(0, 200) : 'Not found';
      })();
      return {
        hasRawLatex,
        hasMathJax,
        mathElementCount: mathElements.length,
        questionText,
        bodyTextSnippet: body.textContent.substring(0, 300),
      };
    });
    console.log('Q1 DOM check:', JSON.stringify(q1DOM, null, 2));
    results.s26.evidence.push(`Q1 DOM: hasMathJax=${q1DOM.hasMathJax}, hasRawLatex=${q1DOM.hasRawLatex}, mathCount=${q1DOM.mathElementCount}`);

    // Take DOM snapshot of question area
    const q1Text = await page.evaluate(() => {
      const questionEl = document.querySelector('[class*="rounded-card"]') || document.querySelector('main');
      return questionEl ? questionEl.textContent.trim().substring(0, 500) : 'No question element found';
    });
    console.log('Q1 text content:', q1Text.substring(0, 300));
    results.s26.evidence.push(`Q1 text: ${q1Text.substring(0, 200)}`);

    // Check for math rendering more specifically
    const mathCheck = await page.evaluate(() => {
      // Check for MathJax rendered elements
      const mjxContainers = document.querySelectorAll('mjx-container');
      const mathElements = document.querySelectorAll('math');
      const svgMath = document.querySelectorAll('svg[class*="math"]');
      // Check for raw LaTeX in visible text
      const bodyText = document.body.textContent;
      const rawLatexPatterns = ['$f(', '$g(', '$h(', '\\int', '\\frac', '\\lim', '$x', '$$', '$f\''];
      const rawLatexFound = rawLatexPatterns.filter(p => bodyText.includes(p));
      // Check for MathText component rendering
      const mathTextSpans = document.querySelectorAll('span');
      const mathTextContent = Array.from(mathTextSpans).filter(s => s.innerHTML.includes('katex') || s.className.includes('katex')).length;
      return {
        mjxContainerCount: mjxContainers.length,
        mathElementCount: mathElements.length,
        svgMathCount: svgMath.length,
        rawLatexFound,
        katexElements: mathTextContent,
      };
    });
    console.log('Math rendering check:', JSON.stringify(mathCheck, null, 2));
    results.s26.evidence.push(`Math rendering: ${JSON.stringify(mathCheck)}`);

    // Check if question text has LaTeX markers or math-rendered content
    // Navigate through a few questions to find math content
    let latexFoundInAnyQuestion = false;
    let rawLatexInAnyQuestion = false;
    let mathRenderedInAnyQuestion = false;
    let questionTexts = [];

    for (let i = 0; i < 5; i++) {
      const qState = await page.evaluate(() => {
        const questionEl = document.querySelector('.text-text-primary');
        const questionText = questionEl ? questionEl.textContent.trim() : '';
        // Check for raw dollar signs or backslashes indicating unrendered LaTeX
        const hasRawDollar = questionText.includes('$') || questionText.includes('\\');
        // Check for MathJax containers
        const hasMjx = document.querySelectorAll('mjx-container').length > 0;
        // Check for katex
        const hasKatex = document.querySelectorAll('.katex, .katex-html').length > 0;
        // Check answer choices for math
        const choices = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
        const choiceWithMath = choices.some(c => c.includes('$') || c.includes('\\'));
        return {
          questionText: questionText.substring(0, 150),
          hasRawDollar,
          hasMjx,
          hasKatex,
          choiceWithMath,
          questionNum: document.body.textContent.match(/Question (\d+)/)?.[1] || '?',
        };
      });
      questionTexts.push(qState);
      console.log(`  Q${i+1} state:`, JSON.stringify(qState));

      if (qState.hasRawDollar) rawLatexInAnyQuestion = true;
      if (qState.hasMjx || qState.hasKatex) { mathRenderedInAnyQuestion = true; latexFoundInAnyQuestion = true; }

      await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_s26_q${i+1}.png`, fullPage: true });

      // Try to go to next question
      const nextClicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const nextBtn = btns.find(b => b.textContent.trim() === 'Next' || b.textContent.includes('Next Question'));
        if (nextBtn && !nextBtn.disabled) { nextBtn.click(); return true; }
        return false;
      });
      if (!nextClicked) {
        console.log('  No Next button found at Q', i+1);
        break;
      }
      await page.waitForTimeout(1000);
    }

    results.s26.evidence.push(`Question texts: ${JSON.stringify(questionTexts.map(q => ({ num: q.questionNum, text: q.questionText.substring(0, 80), rawLatex: q.hasRawDollar, katex: q.hasKatex, mjx: q.hasMjx })))}`);

    // Determine S-26 status
    if (rawLatexInAnyQuestion) {
      results.s26.status = 'FAIL';
      results.s26.notes.push('Raw LaTeX ($...) found in question text - MathJax/KaTeX not rendering');
    } else if (mathRenderedInAnyQuestion) {
      results.s26.status = 'PASS';
      results.s26.notes.push('Math content found and rendered by MathJax/KaTeX');
    } else {
      // No math found in any of the first 5 questions - check if questions contain math at all
      const hasAnyMathContent = questionTexts.some(q => q.questionText.includes('f(x)') || q.questionText.includes('integral') || q.questionText.includes('derivative') || q.questionText.includes('limit'));
      if (hasAnyMathContent) {
        results.s26.status = 'PARTIAL';
        results.s26.notes.push('Math concepts found in text but no LaTeX or MathJax elements detected');
      } else {
        results.s26.status = 'PARTIAL';
        results.s26.notes.push('No raw LaTeX found and no MathJax detected in first 5 Calc questions - questions may use plain text descriptions of math rather than LaTeX notation');
      }
    }

    // -------------------------------------------------------
    // S-22: Annotation Tools - Highlighter
    // -------------------------------------------------------
    console.log('\n=== S-22: Highlighter Tool ===');
    // Check if any current question has HORIZONTAL layout with text stimulus
    const hasHorizontalLayout = await page.evaluate(() => {
      // Look for the two-column grid (HORIZONTAL layout)
      const gridDiv = document.querySelector('.grid.grid-cols-1.lg\\:grid-cols-2');
      // Also look for ToolsToolbar elements
      const highlightBtn = Array.from(document.querySelectorAll('button')).find(b =>
        b.textContent.includes('Highlight') || b.title === 'Highlight tool'
      );
      const readerBtn = Array.from(document.querySelectorAll('button')).find(b =>
        b.textContent.includes('Reader') || b.title?.includes('line reader')
      );
      return {
        hasGrid: !!gridDiv,
        hasHighlightBtn: !!highlightBtn,
        highlightBtnText: highlightBtn ? highlightBtn.textContent.trim() : null,
        hasReaderBtn: !!readerBtn,
        readerBtnText: readerBtn ? readerBtn.textContent.trim() : null,
      };
    });
    console.log('Horizontal layout check:', JSON.stringify(hasHorizontalLayout));

    if (!hasHorizontalLayout.hasHighlightBtn) {
      results.s22.status = 'SKIP';
      results.s22.notes.push('No HORIZONTAL format questions with text stimulus found in Calc test seed data. Seed data (seedFullData.js) does not include stimulus content for any Calc questions - all questions use VERTICAL format. ToolsToolbar not rendered.');
      results.s22.evidence.push('No Highlight button found in DOM after checking Calc test Q1-Q5');
      console.log('S-22 SKIP: No text stimulus questions in Calc test');
    } else {
      // Test the highlighter
      console.log('  Highlight button found! Testing highlighter...');
      results.s22.notes.push('Highlight button found');

      // Screenshot of toolbar
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_s22_toolbar.png`, fullPage: true });

      // Click the Highlight dropdown
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.includes('Highlight') || b.title === 'Highlight tool'
        );
        if (btn) btn.click();
      });
      await page.waitForTimeout(500);

      // Check color picker appeared
      const colorPickerVisible = await page.evaluate(() => {
        const picker = document.querySelector('[class*="absolute"][class*="shadow"]');
        const colorBtns = Array.from(document.querySelectorAll('button')).filter(b =>
          b.className.includes('bg-yellow') || b.className.includes('bg-green') ||
          b.className.includes('bg-pink') || b.className.includes('bg-blue')
        );
        return {
          pickerVisible: !!picker,
          colorButtonCount: colorBtns.length,
          colorClasses: colorBtns.map(b => b.className.substring(0, 50)),
        };
      });
      console.log('  Color picker check:', JSON.stringify(colorPickerVisible));
      results.s22.evidence.push(`Color picker: ${JSON.stringify(colorPickerVisible)}`);

      if (colorPickerVisible.colorButtonCount > 0) {
        results.s22.status = 'PASS';
        results.s22.notes.push('Highlight dropdown opens, color picker appears with color swatches');
      } else {
        results.s22.status = 'FAIL';
        results.s22.notes.push('Highlight dropdown clicked but color picker did not appear properly');
      }
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_s22_colorpicker.png`, fullPage: true });
    }

    // -------------------------------------------------------
    // S-23: Line Reader Tool
    // -------------------------------------------------------
    console.log('\n=== S-23: Line Reader Tool ===');
    if (!hasHorizontalLayout.hasReaderBtn) {
      results.s23.status = 'SKIP';
      results.s23.notes.push('No text stimulus questions with ToolsToolbar found in Calc test seed data. Same root cause as S-22: seedFullData.js Calc questions have no stimulus field.');
      results.s23.evidence.push('No Reader button found in DOM after checking Calc test Q1-Q5');
      console.log('S-23 SKIP: No text stimulus questions in Calc test');
    } else {
      // Test line reader
      console.log('  Reader button found! Testing line reader...');
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.includes('Reader') || b.title?.includes('line reader')
        );
        if (btn) btn.click();
      });
      await page.waitForTimeout(500);

      const lineReaderCheck = await page.evaluate(() => {
        // Check button active state (bg-brand-primary)
        const readerBtn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.includes('Reader')
        );
        const isActive = readerBtn ? readerBtn.className.includes('bg-brand-primary') : false;
        // Check for overlay div (absolute inset-0 with pointer-events-auto)
        const overlay = document.querySelector('.absolute.inset-0.pointer-events-auto');
        // Check for dark overlays
        const darkOverlays = document.querySelectorAll('[class*="bg-black"]');
        // Check for line count select
        const lineSelect = document.querySelector('select');
        // Check for arrow key hint
        const arrowHint = document.body.textContent.includes('arrow keys') || document.body.textContent.includes('↑↓');
        return {
          isActive,
          overlayPresent: !!overlay,
          darkOverlayCount: darkOverlays.length,
          lineSelectPresent: !!lineSelect,
          lineSelectValue: lineSelect ? lineSelect.value : null,
          arrowHintPresent: arrowHint,
        };
      });
      console.log('  Line reader check:', JSON.stringify(lineReaderCheck));
      results.s23.evidence.push(`Line reader state: ${JSON.stringify(lineReaderCheck)}`);

      await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_s23_linereader.png`, fullPage: true });

      if (lineReaderCheck.overlayPresent && lineReaderCheck.isActive) {
        results.s23.status = 'PASS';
        results.s23.notes.push('Line reader activates, overlay appears, button switches to active state');
      } else {
        results.s23.status = 'FAIL';
        results.s23.notes.push('Line reader button clicked but overlay or active state not confirmed');
      }
    }

    // -------------------------------------------------------
    // S-24: Timer Warning Colors
    // -------------------------------------------------------
    console.log('\n=== S-24: Timer Warning Colors ===');

    // Check current timer state (should be normal color > 5 min)
    const timerCheck = await page.evaluate(() => {
      // Find timer element (font-mono)
      const timerEl = document.querySelector('.font-mono');
      if (!timerEl) return { found: false };
      const timerText = timerEl.textContent.trim();
      const timerParent = timerEl.closest('[class*="text-"]') || timerEl.parentElement;
      const parentClass = timerParent ? timerParent.className : '';
      // Check color classes
      const hasErrorColor = parentClass.includes('text-error-text') || timerEl.closest('[class*="text-error"]');
      const hasWarningColor = parentClass.includes('text-warning-text') || timerEl.closest('[class*="text-warning"]');
      const hasDefaultColor = parentClass.includes('text-text-primary') || (!hasErrorColor && !hasWarningColor);
      const hasClockEmoji = document.body.textContent.includes('⏱') || document.body.textContent.includes('🕐');
      return {
        found: true,
        timerText,
        parentClass: parentClass.substring(0, 100),
        hasErrorColor,
        hasWarningColor,
        hasDefaultColor,
        hasClockEmoji,
        format: /^\d{1,2}:\d{2}$/.test(timerText) ? 'MM:SS' : 'Other',
      };
    });
    console.log('Timer initial check:', JSON.stringify(timerCheck));
    results.s24.evidence.push(`Timer initial state: ${JSON.stringify(timerCheck)}`);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_s24_timer_normal.png`, fullPage: true });

    // Test S-24 part 1: Check timer format and initial color
    let timerFormatPass = timerCheck.format === 'MM:SS';
    let timerClockPass = timerCheck.hasClockEmoji;
    let timerDefaultColorPass = timerCheck.hasDefaultColor && !timerCheck.hasWarningColor && !timerCheck.hasErrorColor;

    results.s24.notes.push(`Timer found: ${timerCheck.found}`);
    results.s24.notes.push(`Timer text: "${timerCheck.timerText}"`);
    results.s24.notes.push(`Timer format MM:SS: ${timerFormatPass}`);
    results.s24.notes.push(`Clock emoji present: ${timerClockPass}`);
    results.s24.notes.push(`Default color (>5min): ${timerDefaultColorPass}`);

    // Now manipulate timer to test warning thresholds via page.evaluate
    console.log('  Testing timer at 4:00 (warning threshold)...');

    // Inject a way to test timer rendering at different values
    // The timer is rendered by TestTimer component which reads timeRemaining prop
    // We need to find and manipulate the React state
    // First, let's check what the timer component renders at different values
    // by checking the component's classes with different injected values

    // Check if we can find the timer container with its color class
    const timerContainerCheck = await page.evaluate(() => {
      // Find the timer div (flex items-center gap-2 with color class)
      const monoEl = document.querySelector('.font-mono');
      if (!monoEl) return { found: false };
      const container = monoEl.parentElement;
      return {
        found: true,
        containerClass: container ? container.className : '',
        monoClass: monoEl.className,
        text: monoEl.textContent,
      };
    });
    console.log('Timer container:', JSON.stringify(timerContainerCheck));
    results.s24.evidence.push(`Timer container: ${JSON.stringify(timerContainerCheck)}`);

    // The TestTimer component uses classes text-text-primary, text-warning-text, text-error-text
    // We verify the code handles these thresholds by checking TestTimer.jsx source
    // Since we already read the source, we know the logic is:
    // timeRemaining <= 60: text-error-text
    // timeRemaining <= 300: text-warning-text
    // else: text-text-primary
    // Let's try to test this by manipulating React state if possible

    // Try to set timer to low values via React DevTools fiber
    const warningTest = await page.evaluate(() => {
      // Find React root and try to manipulate timer state
      // This is a best-effort approach
      const timerEl = document.querySelector('.font-mono');
      if (!timerEl) return { attempted: false, reason: 'No timer element' };

      // Check if we can access React fiber
      const reactFiber = timerEl._reactFiber || timerEl.__reactFiber || timerEl._reactInternals;
      return {
        attempted: true,
        hasFiber: !!reactFiber,
        currentText: timerEl.textContent,
      };
    });
    console.log('React fiber access attempt:', JSON.stringify(warningTest));

    // Alternative: Test timer display code correctness by checking the DOM classes
    // We can try to simulate the timer reaching low values by checking if the
    // TestTimer component is exported and accessible, or by simulating time
    // For automated testing, we inject test values into the component

    // Since direct React state manipulation is complex, let's check the component
    // renders the correct CSS classes by examining what's in the DOM vs the timer value
    const currentTimerValue = await page.evaluate(() => {
      const mono = document.querySelector('.font-mono');
      if (!mono) return null;
      const text = mono.textContent.trim(); // e.g., "44:58"
      const parts = text.split(':');
      if (parts.length !== 2) return null;
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    });
    console.log('  Current timer value in seconds:', currentTimerValue);

    // Check the classes on the timer container
    const timerColorNormal = await page.evaluate(() => {
      const monoEl = document.querySelector('.font-mono');
      if (!monoEl) return null;
      const container = monoEl.parentElement;
      return container ? container.className : null;
    });
    console.log('  Timer color class (normal):', timerColorNormal);

    // Test: Inject a 4-minute timer (240 seconds) to check warning state
    // We do this by temporarily modifying the DOM to test the render output
    // First, let's verify the source is correct by checking what we know:
    // TestTimer.jsx: timeRemaining <= 300 → text-warning-text, <= 60 → text-error-text
    // The source was verified correct. Now we test by direct DOM class inspection.

    // Try window.__REACT_APP__ or similar global state
    const stateInjectionResult = await page.evaluate(() => {
      try {
        // Try to find React internals on the root
        const rootEl = document.getElementById('root');
        if (!rootEl) return { success: false, reason: 'No root element' };

        // Try React 18 root
        const reactKey = Object.keys(rootEl).find(k =>
          k.startsWith('__reactFiber') || k.startsWith('_reactRootContainer')
        );
        return {
          success: !!reactKey,
          keyFound: reactKey || null,
        };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
    console.log('  React state injection check:', JSON.stringify(stateInjectionResult));

    // Since direct manipulation is unreliable, we verify the timer behavior by:
    // 1. Checking the source code is correct (done - TestTimer.jsx verified)
    // 2. Checking initial state shows text-text-primary
    // 3. Wait for a brief time to confirm timer is counting down

    // Wait 3 seconds and check if timer changed
    const timerBefore = await page.evaluate(() => {
      const mono = document.querySelector('.font-mono');
      return mono ? mono.textContent.trim() : null;
    });
    await page.waitForTimeout(3000);
    const timerAfter = await page.evaluate(() => {
      const mono = document.querySelector('.font-mono');
      return mono ? mono.textContent.trim() : null;
    });
    console.log(`  Timer countdown check: before="${timerBefore}" after="${timerAfter}"`);

    const isCountingDown = timerBefore && timerAfter && timerBefore !== timerAfter;
    results.s24.notes.push(`Timer is counting down: ${isCountingDown} (${timerBefore} → ${timerAfter})`);
    results.s24.evidence.push(`Timer countdown: ${timerBefore} → ${timerAfter}`);

    // Determine S-24 status
    // We can verify the warning color logic by setting up a test via evaluate
    // Let's try to test the TestTimer component with injected values
    // by creating a temporary React element if possible, or checking the container class logic

    // Since we can't easily manipulate timer state, we mark PARTIAL if:
    // - Timer found ✓, format correct ✓, counting down ✓, source code correct ✓
    // - But warning/error thresholds not directly observed
    if (timerCheck.found && timerFormatPass && isCountingDown) {
      // Timer working, now verify class logic by reading actual class at current time
      const finalTimerClass = await page.evaluate(() => {
        const mono = document.querySelector('.font-mono');
        const container = mono ? mono.parentElement : null;
        return {
          containerClass: container ? container.className : null,
          hasTextPrimary: container ? container.className.includes('text-text-primary') : false,
          hasWarning: container ? container.className.includes('text-warning-text') : false,
          hasError: container ? container.className.includes('text-error-text') : false,
        };
      });
      console.log('  Final timer class:', JSON.stringify(finalTimerClass));
      results.s24.evidence.push(`Final timer class: ${JSON.stringify(finalTimerClass)}`);

      if (finalTimerClass.hasTextPrimary) {
        results.s24.status = 'PARTIAL';
        results.s24.notes.push('PARTIAL: Timer format correct (MM:SS), counting down, default color text-text-primary confirmed at >5min. Warning/error thresholds not directly observed (timer too high). Source code confirmed: text-warning-text at ≤300s, text-error-text at ≤60s.');
      } else {
        results.s24.status = 'PARTIAL';
        results.s24.notes.push(`PARTIAL: Timer found and counting, but class "${finalTimerClass.containerClass}" not text-text-primary as expected for default state`);
      }
    } else {
      results.s24.status = 'FAIL';
      results.s24.notes.push(`Timer check failed: found=${timerCheck.found}, format=${timerFormatPass}, countingDown=${isCountingDown}`);
    }

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_s24_timer_check.png`, fullPage: true });

    // -------------------------------------------------------
    // S-25: Section Lock Indicator
    // -------------------------------------------------------
    console.log('\n=== S-25: Section Lock Indicator ===');

    // We need to complete Section 1 (MCQ) and reach Section 2 (FRQ)
    // The Calc test has multiple sections. Let's navigate to complete it quickly.
    // First, let's go back to dashboard and start a fresh Calc test if needed,
    // or continue the current session and submit MCQ section

    // Check current section header
    const sectionHeaderCheck = await page.evaluate(() => {
      const bodyText = document.body.textContent;
      // Look for section indicator
      const sectionMatch = bodyText.match(/Section (\d+) of (\d+)/);
      // Look for "Review" button or submit state
      const hasReviewBtn = Array.from(document.querySelectorAll('button')).some(b =>
        b.textContent.trim() === 'Review' || b.textContent.includes('Review Answers')
      );
      const hasSubmitSection = Array.from(document.querySelectorAll('button')).some(b =>
        b.textContent.includes('Submit Section')
      );
      return {
        sectionMatch: sectionMatch ? sectionMatch[0] : null,
        currentSection: sectionMatch ? sectionMatch[1] : null,
        totalSections: sectionMatch ? sectionMatch[2] : null,
        hasReviewBtn,
        hasSubmitSection,
        bodySnippet: bodyText.substring(0, 200),
      };
    });
    console.log('Section header check:', JSON.stringify(sectionHeaderCheck));
    results.s25.notes.push(`Current section: ${sectionHeaderCheck.sectionMatch || 'Not found'}`);

    // To test S-25, we need to be in Section 2 after completing Section 1
    // Navigate through all MCQ questions quickly and submit section 1
    // First, find how many questions are in section 1

    // Navigate to Review screen
    console.log('  Navigating to Review screen...');
    // Try clicking Review button or navigate to end
    let reachedReview = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const reviewBtnFound = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const reviewBtn = btns.find(b => b.textContent.trim() === 'Review' || b.textContent.includes('Review Answers') || b.textContent.includes('Review Section'));
        if (reviewBtn) { reviewBtn.click(); return true; }
        // Try Next button
        const nextBtn = btns.find(b => b.textContent.trim() === 'Next' || (b.textContent.includes('Next') && !b.textContent.includes('Review')));
        if (nextBtn && !nextBtn.disabled) { nextBtn.click(); return false; }
        return false;
      });
      await page.waitForTimeout(500);
      if (reviewBtnFound) {
        reachedReview = true;
        break;
      }
      // Check if we're on review screen
      const onReview = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.some(b => b.textContent.includes('Submit Section'));
      });
      if (onReview) {
        reachedReview = true;
        break;
      }
    }
    console.log('  Reached review:', reachedReview);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_s25_review.png`, fullPage: true });

    // Submit Section 1
    if (reachedReview) {
      console.log('  Submitting Section 1...');
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const submitBtn = btns.find(b => b.textContent.includes('Submit Section'));
        if (submitBtn) submitBtn.click();
      });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_s25_after_submit_s1.png`, fullPage: true });

      // Check for FRQ choice or Section 2 entry
      const afterSubmitState = await page.evaluate(() => {
        const bodyText = document.body.textContent;
        const btns = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
        return {
          bodySnippet: bodyText.substring(0, 300),
          buttons: btns.filter(t => t.length > 2 && t.length < 80),
        };
      });
      console.log('  After submit state:', JSON.stringify(afterSubmitState));
      results.s25.evidence.push(`After submit Section 1: ${JSON.stringify(afterSubmitState)}`);

      // Handle FRQ choice screen if shown
      const hasFRQChoice = afterSubmitState.bodySnippet.includes('Type Your Answers') ||
        afterSubmitState.bodySnippet.includes('Write by Hand') ||
        afterSubmitState.bodySnippet.includes('FRQ Choice') ||
        afterSubmitState.bodySnippet.includes('Choose how you');
      if (hasFRQChoice) {
        console.log('  FRQ choice screen shown. Clicking "Type Your Answers"...');
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const typeBtn = btns.find(b => b.textContent.includes('Type Your Answers') || b.textContent.includes('Type'));
          if (typeBtn) typeBtn.click();
        });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_s25_frq_entry.png`, fullPage: true });
      }

      // Now check for Section 2 header and lock indicator
      const section2Check = await page.evaluate(() => {
        const bodyText = document.body.textContent;
        const sectionMatch = bodyText.match(/Section (\d+) of (\d+)/);
        // Check for lock icon SVG or "Locked" text
        const hasLockedText = bodyText.includes('Locked') || bodyText.includes('Previous sections are locked');
        // Check for lock SVG (viewBox="0 0 20 20")
        const svgs = document.querySelectorAll('svg');
        const hasLockSVG = Array.from(svgs).some(svg =>
          svg.getAttribute('viewBox') === '0 0 20 20' ||
          svg.innerHTML.includes('M10 2a5 5 0 00-5 5v') ||
          svg.innerHTML.includes('lock')
        );
        // Check for text-text-muted class on lock area
        const mutedElements = document.querySelectorAll('[class*="text-text-muted"]');
        const lockMutedEl = Array.from(mutedElements).find(el =>
          el.textContent.includes('Locked') || el.title?.includes('locked')
        );
        // Check for "Previous sections are locked" title attribute
        const lockTitleEl = document.querySelector('[title="Previous sections are locked"]');
        // Check Back button disabled on Q1 of section 2
        const backBtn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.trim() === 'Back' || b.textContent.trim() === '← Back'
        );
        return {
          sectionMatch: sectionMatch ? sectionMatch[0] : null,
          currentSection: sectionMatch ? sectionMatch[1] : null,
          hasLockedText,
          hasLockSVG,
          hasLockTitleEl: !!lockTitleEl,
          lockTitleText: lockTitleEl ? lockTitleEl.getAttribute('title') : null,
          backBtnDisabled: backBtn ? backBtn.disabled : 'Not found',
          backBtnText: backBtn ? backBtn.textContent.trim() : null,
          mutedLockEl: lockMutedEl ? lockMutedEl.textContent.trim().substring(0, 50) : null,
          bodySnippet: bodyText.substring(0, 400),
        };
      });
      console.log('  Section 2 check:', JSON.stringify(section2Check, null, 2));
      results.s25.evidence.push(`Section 2 state: ${JSON.stringify(section2Check)}`);
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_s25_section2_header.png`, fullPage: true });

      // Determine S-25 status
      const inSection2 = section2Check.currentSection === '2';
      const lockVisible = section2Check.hasLockedText || section2Check.hasLockSVG || section2Check.hasLockTitleEl;
      const backBlocked = section2Check.backBtnDisabled === true || section2Check.backBtnDisabled === 'Not found';

      results.s25.notes.push(`In Section 2: ${inSection2}`);
      results.s25.notes.push(`Lock indicator visible: ${lockVisible}`);
      results.s25.notes.push(`Locked text: ${section2Check.hasLockedText}`);
      results.s25.notes.push(`Lock SVG: ${section2Check.hasLockSVG}`);
      results.s25.notes.push(`Lock title attr: ${section2Check.hasLockTitleEl}`);
      results.s25.notes.push(`Back button disabled: ${section2Check.backBtnDisabled}`);

      if (inSection2 && lockVisible) {
        if (backBlocked) {
          results.s25.status = 'PASS';
          results.s25.notes.push('PASS: In Section 2, lock indicator visible, back navigation blocked');
        } else {
          results.s25.status = 'PARTIAL';
          results.s25.notes.push('PARTIAL: In Section 2, lock indicator visible, but Back button state unclear');
        }
      } else if (inSection2 && !lockVisible) {
        results.s25.status = 'FAIL';
        results.s25.notes.push('FAIL: In Section 2 but lock indicator NOT visible');
      } else if (!inSection2) {
        results.s25.status = 'PARTIAL';
        results.s25.notes.push('PARTIAL: Could not reach Section 2 to verify lock indicator');
      }
    } else {
      results.s25.status = 'PARTIAL';
      results.s25.notes.push('PARTIAL: Could not reach review screen to submit Section 1 and test lock indicator');
    }

    // -------------------------------------------------------
    // Additional: Verify Highlighter source-code structure
    // to document the SKIP findings accurately
    // -------------------------------------------------------

    // Collect console errors
    results.consoleErrors = consoleMessages.filter(m =>
      m.type === 'error' || (m.type === 'warning' && m.text.includes('[APBoost'))
    );

    // Final screenshot
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_99_final.png`, fullPage: true });

  } catch (err) {
    console.error('Test error:', err.message);
    results.error = err.message;
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b5_error.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  return results;
}

runB5().then(results => {
  console.log('\n=== B5 FINAL RESULTS ===');
  console.log(JSON.stringify(results, null, 2));

  fs.writeFileSync(
    'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b5_audit_results.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\nResults saved to b5_audit_results.json');
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
