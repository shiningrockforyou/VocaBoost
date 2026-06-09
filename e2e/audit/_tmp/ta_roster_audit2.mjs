/**
 * TA-ROSTER Audit Script v2
 * Properly navigates to Students tab and inspects roster cells in detail.
 */

import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const SITE = 'https://vocaboostone.netlify.app';
const TEACHER_EMAIL = 'ta@vocaboost.com';
const TEACHER_PASSWORD = 'VocaTA2026!';
const SCREENSHOT_DIR = '/app/audit/playwright/findings/screenshots/TA-ROSTER';
const EXEC_PATH = '/ms-playwright/chromium-1223/chrome-linux64/chrome';

const ALLOWED_CLASSES = [
  { id: 'GNktwcqI18vyAps3iJDf', name: '25WT 2차 TOP ONLINE' },
  { id: 'LVjBTFuYE8FbPG34pVAt', name: '25WT 2차 CORE OFFLINE' },
  { id: 'OMMwcLz3FlOiKBYjBMla', name: '25WT 2차 CORE ONLINE' },
  { id: 'k8tzOiiwotBbtJS3uTiv', name: '25WT 2차 TOP OFFLINE' },
];

const findings = [];
let screenshotIndex = 100; // start at 100 to avoid overwrites from first run

function addFinding(severity, title, where, evidence, repro, expected, actual) {
  findings.push({ severity, title, where, evidence, repro, expected, actual });
  console.log(`[${severity}] ${title} @ ${where}`);
}

async function screenshot(page, label) {
  const filename = `${String(screenshotIndex++).padStart(3, '0')}_${label.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
  const fullPath = join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
  console.log(`Screenshot: ${fullPath}`);
  return fullPath;
}

async function login(page) {
  await page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });

  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  if (await loginLink.count()) {
    await loginLink.click();
  } else {
    await page.evaluate(() => {
      history.pushState({}, '', '/login');
      dispatchEvent(new PopStateEvent('popstate'));
    });
  }

  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
  await page.getByLabel(/email/i).first().fill(TEACHER_EMAIL);
  await page.getByLabel(/password/i).first().fill(TEACHER_PASSWORD);
  await page.getByLabel(/password/i).first().press('Enter');

  try {
    await page.waitForURL(/\/(dashboard|classes|$)/, { timeout: 15000 });
  } catch {
    await page.getByRole('button', { name: /continue/i }).first().click().catch(() => {});
    await page.waitForURL(/\/(dashboard|classes|$)/, { timeout: 15000 }).catch(() => {});
  }
}

async function navigateToStudentsTab(page, classId) {
  // Navigate to class page
  await page.goto(`${SITE}/classes/${classId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Check current URL
  console.log('Navigated to:', page.url());

  // Find the Students tab and click it
  const studentsTab = page.getByRole('tab', { name: /students/i });
  const tabCount = await studentsTab.count();
  console.log('Students tab count:', tabCount);

  if (tabCount > 0) {
    await studentsTab.click();
    await page.waitForTimeout(2000);
    console.log('Clicked Students tab');
  } else {
    // Try button or link with text "Students"
    const studentsBtn = page.locator('button, a, [role="tab"]').filter({ hasText: /^Students$/i });
    if (await studentsBtn.count() > 0) {
      await studentsBtn.first().click();
      await page.waitForTimeout(2000);
      console.log('Clicked Students button/link');
    } else {
      console.log('No Students tab found, checking available tabs...');
      const tabs = await page.locator('[role="tab"], .tab, [class*="tab"]').allTextContents();
      console.log('Available tabs:', tabs);

      // Try clicking any tab with "student" text
      const anyStudentLink = page.locator(':text("Students"), :text("Student")').first();
      if (await anyStudentLink.count() > 0) {
        await anyStudentLink.click();
        await page.waitForTimeout(2000);
      }
    }
  }
}

async function inspectStudentRoster(page, classId, className) {
  console.log(`\n=== Inspecting roster for ${className} ===`);

  const ss1 = await screenshot(page, `students_tab_${classId}`);

  // Capture full page content
  const pageContent = await page.evaluate(() => {
    return {
      bodyText: document.body.textContent.substring(0, 2000),
      allText: document.body.innerText.substring(0, 3000),
    };
  });
  console.log('Page content snippet:', pageContent.bodyText.substring(0, 500));

  // Find all percentage values on the page
  const allPercentages = await page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    const results = [];
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent.trim();
      const matches = text.match(/\d+(?:\.\d+)?%/g);
      if (matches) {
        for (const match of matches) {
          const pct = parseFloat(match);
          results.push({
            value: pct,
            text: match,
            context: text.substring(0, 100),
            parentTag: node.parentElement?.tagName,
            parentClass: node.parentElement?.className?.substring(0, 80),
          });
        }
      }
    }
    return results;
  });

  console.log('All percentages found:', allPercentages.length);
  const overflowPcts = allPercentages.filter(p => p.value > 100);

  if (overflowPcts.length > 0) {
    const ss = await screenshot(page, `overflow_pct_${classId}`);
    addFinding(
      'Blocker',
      `Score percentage exceeds 100% — likely newWordsTestScore ×100 bug`,
      `${className} / Students roster`,
      ss,
      `Navigate to /classes/${classId}, click Students tab, inspect score cells`,
      'All percentage scores should be between 0% and 100%',
      `Found ${overflowPcts.length} value(s) > 100%: ${overflowPcts.map(p => `${p.text} (context: "${p.context}")`).join(' | ')}`
    );
    console.log('[BLOCKER] Overflow percentages:', overflowPcts);
  } else {
    console.log('No overflow percentages found on Students tab');
    if (allPercentages.length > 0) {
      console.log('Sample percentages (all within 0-100):', allPercentages.slice(0, 10).map(p => p.text));
    }
  }

  // Extract all student row data
  const studentData = await page.evaluate(() => {
    // Look for table rows or list items that represent students
    const tableRows = document.querySelectorAll('tbody tr, [class*="student-row"], [class*="StudentRow"]');

    if (tableRows.length > 0) {
      return Array.from(tableRows).map(row => ({
        type: 'tableRow',
        html: row.innerHTML.substring(0, 500),
        text: row.textContent.trim().substring(0, 300),
        cells: Array.from(row.querySelectorAll('td, th')).map(td => td.textContent.trim()),
      }));
    }

    // Try looking for card-style student items
    const studentCards = document.querySelectorAll('[class*="student"], [data-testid*="student"]');
    return Array.from(studentCards).map(card => ({
      type: 'card',
      html: card.innerHTML.substring(0, 500),
      text: card.textContent.trim().substring(0, 300),
    })).slice(0, 30);
  });

  console.log(`Student rows found: ${studentData.length}`);
  if (studentData.length > 0) {
    console.log('Sample student row:', studentData[0]);
  }

  // Check for "Not Started" / "No History" states
  const stateTexts = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasNotStarted: text.includes('Not Started'),
      hasNoHistory: text.includes('No History'),
      hasCurrentSession: text.includes('Current Session') || text.includes('Current'),
      hasPreviousSession: text.includes('Previous Session') || text.includes('Previous'),
      hasDayLabel: /Day \d+/.test(text),
      dayLabels: (text.match(/Day \d+/g) || []).slice(0, 10),
      notStartedCount: (text.match(/Not Started/g) || []).length,
      noHistoryCount: (text.match(/No History/g) || []).length,
    };
  });
  console.log('State texts:', stateTexts);

  // Check for progress bars
  const progressBars = await page.evaluate(() => {
    const bars = document.querySelectorAll('[role="progressbar"], [class*="progress"], [class*="Progress"]');
    return Array.from(bars).map(bar => ({
      ariaValue: bar.getAttribute('aria-valuenow'),
      ariaMax: bar.getAttribute('aria-valuemax'),
      ariaMin: bar.getAttribute('aria-valuemin'),
      className: bar.className?.substring(0, 80),
      style: bar.getAttribute('style'),
      width: bar.style?.width,
    }));
  });
  console.log('Progress bars:', progressBars.length);
  const invalidProgressBars = progressBars.filter(b => {
    if (b.ariaValue !== null) {
      const val = parseFloat(b.ariaValue);
      const max = parseFloat(b.ariaMax || '100');
      return val > max || val < 0;
    }
    if (b.style && b.style.includes('width')) {
      const widthMatch = b.style.match(/width\s*:\s*(\d+(?:\.\d+)?)%/);
      if (widthMatch) return parseFloat(widthMatch[1]) > 100;
    }
    return false;
  });

  if (invalidProgressBars.length > 0) {
    const ss = await screenshot(page, `invalid_progress_bars_${classId}`);
    addFinding(
      'High',
      'Progress bar value exceeds maximum (possible ×100 bug in visual rendering)',
      `${className} / Students roster progress bars`,
      ss,
      `Navigate to /classes/${classId}, Students tab, inspect progress bar ARIA values`,
      'Progress bar values should be within 0–100% range',
      `Found ${invalidProgressBars.length} invalid progress bar(s): ${JSON.stringify(invalidProgressBars)}`
    );
  }

  // Check progress bar widths in style attribute
  const progressBarStyles = await page.evaluate(() => {
    const allEls = document.querySelectorAll('[style*="width"]');
    return Array.from(allEls).filter(el => {
      const style = el.getAttribute('style');
      if (!style) return false;
      const match = style.match(/width\s*:\s*(\d+(?:\.\d+)?)%/);
      if (match) {
        return parseFloat(match[1]) > 100;
      }
      return false;
    }).map(el => ({
      style: el.getAttribute('style'),
      className: el.className?.substring(0, 80),
      text: el.textContent?.trim().substring(0, 50),
    }));
  });

  if (progressBarStyles.length > 0) {
    const ss = await screenshot(page, `progress_bar_overflow_${classId}`);
    addFinding(
      'High',
      'Progress bar CSS width > 100% (likely score stored as 0-100 int but rendered ×100)',
      `${className} / Students roster progress bars`,
      ss,
      `Navigate to /classes/${classId}, Students tab, inspect elements with style="width: >100%"`,
      'Progress bar width should be 0–100%',
      `Found ${progressBarStyles.length} element(s) with width >100%: ${progressBarStyles.map(s => s.style).join(' | ')}`
    );
  }

  return {
    allPercentages,
    overflowPcts,
    studentData,
    stateTexts,
    progressBars,
    invalidProgressBars,
    screenshot: ss1,
  };
}

async function testNameEdit(page, classId, className) {
  console.log(`\n=== Testing name edit for ${className} ===`);

  // Look for student name cells with edit functionality
  // First, get all the interactive elements near names
  const editableElements = await page.evaluate(() => {
    // Look for pencil icons (often SVGs inside buttons)
    const svgButtons = document.querySelectorAll('button svg, [class*="edit"] button, [class*="pencil"]');
    const results = [];

    // Check buttons with SVG for edit patterns
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const svg = btn.querySelector('svg');
      if (svg) {
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const title = btn.getAttribute('title') || '';
        const path = svg.getAttribute('d') || '';
        // Pencil icon has specific path patterns
        results.push({
          tag: 'button',
          ariaLabel,
          title,
          className: btn.className?.substring(0, 80),
          svgPathStart: path.substring(0, 50),
          text: btn.textContent?.trim().substring(0, 20),
          visible: btn.offsetParent !== null,
        });
      }
    }
    return results.slice(0, 30);
  });

  console.log('Buttons with SVG icons:', editableElements.filter(e => e.visible).length);
  editableElements.filter(e => e.visible).forEach(e => {
    console.log('  -', e.ariaLabel || e.title || e.className, 'text:', e.text);
  });

  // Try hovering over student names to reveal edit button
  const studentNameRow = page.locator('tr td:first-child, [class*="student-name"], [class*="StudentName"]').first();
  const nameRowCount = await studentNameRow.count();

  if (nameRowCount > 0) {
    await studentNameRow.hover();
    await page.waitForTimeout(500);
    const afterHoverSs = await screenshot(page, `name_hover_${classId}`);
  }

  // Try multiple strategies to find and click the edit pencil
  const editStrategies = [
    { selector: 'button[title*="edit" i]', desc: 'title=edit button' },
    { selector: 'button[aria-label*="edit" i]', desc: 'aria-label=edit button' },
    { selector: 'button[aria-label*="rename" i]', desc: 'aria-label=rename button' },
    { selector: 'button[aria-label*="pencil" i]', desc: 'aria-label=pencil button' },
    { selector: '[class*="edit-name"] button, [class*="editName"] button', desc: 'editName button' },
    { selector: 'button[title*="이름" i]', desc: 'title=이름 (Korean) button' },
  ];

  let editBtn = null;
  let editBtnDesc = '';

  for (const strategy of editStrategies) {
    const btn = page.locator(strategy.selector).first();
    if (await btn.count() > 0 && await btn.isVisible()) {
      editBtn = btn;
      editBtnDesc = strategy.desc;
      console.log(`Found edit button: ${strategy.desc}`);
      break;
    }
  }

  if (!editBtn) {
    console.log('No edit button found via direct selectors, trying hover approach...');

    // Get first student row and hover
    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.count() > 0) {
      await firstRow.hover();
      await page.waitForTimeout(600);

      // Re-check all strategies after hover
      for (const strategy of editStrategies) {
        const btn = page.locator(strategy.selector).first();
        if (await btn.count() > 0) {
          editBtn = btn;
          editBtnDesc = strategy.desc + ' (after hover)';
          console.log(`Found edit button after hover: ${strategy.desc}`);
          break;
        }
      }
    }
  }

  if (!editBtn) {
    // Check specifically for title="Edit" buttons (found in first run)
    const titleEditBtn = page.locator('button[title]').first();
    if (await titleEditBtn.count() > 0) {
      const titles = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button[title]')).map(b => ({
          title: b.getAttribute('title'),
          className: b.className?.substring(0, 60),
          visible: b.offsetParent !== null,
        }));
      });
      console.log('All titled buttons:', titles);
    }

    addFinding(
      'High',
      'Name-edit pencil icon not found or not visible in Students roster',
      `${className} / student name cells`,
      await screenshot(page, `no_edit_btn_${classId}`),
      `Navigate to /classes/${classId}, Students tab, look for pencil icon next to student names`,
      'A pencil/edit icon should appear on each student name row to allow renaming',
      'No edit button found in DOM or after hovering student rows'
    );
    return { nameEditWorked: false, error: 'No edit button found' };
  }

  // Click the edit button
  let nameEditWorked = false;
  let cancelWorked = false;

  try {
    await editBtn.click({ timeout: 5000 });
    await page.waitForTimeout(1000);

    // Check if inline editor appeared
    const inputField = page.locator('input[type="text"], input:not([type])').first();
    const inputVisible = await inputField.isVisible().catch(() => false);

    if (inputVisible) {
      nameEditWorked = true;
      const editOpenSs = await screenshot(page, `name_edit_OPEN_${classId}`);
      console.log(`Name edit opened! Input visible: ${inputVisible}`);

      // Look for cancel button (X, Cancel, ✕, ✗, close)
      const cancelSelectors = [
        'button[aria-label*="cancel" i]',
        'button[aria-label*="close" i]',
        'button[title*="cancel" i]',
        'button:has-text("Cancel")',
        'button:has-text("✕")',
        'button:has-text("✗")',
        'button:has-text("×")',
      ];

      let cancelBtn = null;
      for (const sel of cancelSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.count() > 0 && await btn.isVisible()) {
          cancelBtn = btn;
          console.log(`Found cancel button: ${sel}`);
          break;
        }
      }

      if (!cancelBtn) {
        // Try Escape key
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        const afterEscSs = await screenshot(page, `name_edit_ESCAPE_${classId}`);
        const inputStillVisible = await inputField.isVisible().catch(() => false);
        cancelWorked = !inputStillVisible;
        console.log('Escape pressed, input still visible:', inputStillVisible);
      } else {
        await cancelBtn.click({ timeout: 3000 });
        await page.waitForTimeout(500);
        const afterCancelSs = await screenshot(page, `name_edit_CLOSED_${classId}`);
        const inputStillVisible = await inputField.isVisible().catch(() => false);
        cancelWorked = !inputStillVisible;
        console.log('Cancel clicked, input still visible:', inputStillVisible);
      }
    } else {
      console.log('Edit button clicked but input did NOT appear');
      const afterClickSs = await screenshot(page, `name_edit_noInput_${classId}`);

      addFinding(
        'High',
        'Name-edit button exists but clicking it does not open inline editor',
        `${className} / student name cell edit button`,
        afterClickSs,
        `Navigate to /classes/${classId}, Students tab, click the edit button (${editBtnDesc})`,
        'A text input and Cancel/Check buttons should appear after clicking edit',
        'No text input appeared after clicking edit button'
      );
    }
  } catch (e) {
    console.log('Error during name edit test:', e.message);
    addFinding(
      'High',
      `Name-edit interaction threw an error: ${e.message}`,
      `${className} / student name cell edit button`,
      await screenshot(page, `name_edit_ERROR_${classId}`),
      `Navigate to /classes/${classId}, Students tab, click edit button`,
      'Edit should open cleanly with input + cancel button',
      `Exception: ${e.message}`
    );
  }

  return { nameEditWorked, cancelWorked };
}

async function checkPendingChallenge(page, classId, className) {
  console.log(`\n=== Checking pending challenge indicator for ${className} ===`);

  // Detailed DOM inspection for challenge-related elements
  const challengeDOM = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    const challengeRelated = [];

    for (const el of allElements) {
      const text = el.textContent?.trim() || '';
      const className = el.className || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      const title = el.getAttribute('title') || '';
      const dataAttrs = Array.from(el.attributes)
        .filter(a => a.name.startsWith('data-'))
        .map(a => `${a.name}=${a.value}`)
        .join(',');

      if (
        className.toLowerCase().includes('challenge') ||
        className.toLowerCase().includes('pending') ||
        ariaLabel.toLowerCase().includes('challenge') ||
        title.toLowerCase().includes('challenge') ||
        dataAttrs.toLowerCase().includes('challenge') ||
        (text.length < 100 && text.toLowerCase().includes('challenge'))
      ) {
        challengeRelated.push({
          tag: el.tagName,
          className: className.substring(0, 80),
          ariaLabel,
          title,
          text: text.substring(0, 80),
          visible: el.offsetParent !== null,
          childCount: el.childElementCount,
        });
      }
    }
    return challengeRelated.slice(0, 20);
  });

  console.log('Challenge-related DOM elements:', challengeDOM.length);
  challengeDOM.forEach(el => console.log('  -', el.tag, el.className, '"' + el.text + '"'));

  // Check if challenge indicator is present at all
  const hasChallengeIndicator = challengeDOM.some(el => el.visible);

  if (!hasChallengeIndicator) {
    // Check if there should be challenges by looking for any review challenge state
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasChallengeText = pageText.toLowerCase().includes('challenge');

    addFinding(
      'Medium',
      'Pending-challenge badge/count absent from class roster (Issue #12)',
      `${className} / class header and roster`,
      await screenshot(page, `no_challenge_badge_${classId}`),
      `Navigate to /classes/${classId}, Students tab, look for pending challenge count near class header or student rows`,
      'A pending-challenge count/badge should appear indicating students with pending review challenges',
      hasChallengeText
        ? 'No visible challenge indicator/badge (text mentions "challenge" elsewhere)'
        : 'No challenge-related elements in visible DOM at all'
    );
  } else {
    console.log('Challenge indicator found:', challengeDOM.filter(el => el.visible));
  }

  return { hasChallengeIndicator, challengeDOM };
}

async function auditClassFull(browser, classData) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ text: msg.text(), url: page.url() });
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push({ text: `PAGE ERROR: ${err.message}`, url: page.url() });
  });

  try {
    await login(page);
    await navigateToStudentsTab(page, classData.id);

    // Take overview screenshot after navigating to Students tab
    const overviewSs = await screenshot(page, `students_overview_${classData.id}`);

    const rosterResults = await inspectStudentRoster(page, classData.id, classData.name);
    await checkPendingChallenge(page, classData.id, classData.name);
    const nameEditResults = await testNameEdit(page, classData.id, classData.name);

    // Filter significant console errors
    const significantErrors = consoleErrors.filter(e =>
      !e.text.includes('favicon') &&
      !e.text.includes('net::ERR_ABORTED') &&
      !e.text.includes('manifest') &&
      e.text.length > 5
    );

    if (significantErrors.length > 0) {
      console.log(`Console errors (${significantErrors.length}):`, significantErrors.slice(0, 3));
    }

    return { rosterResults, nameEditResults, consoleErrors: significantErrors };

  } finally {
    await context.close();
  }
}

async function auditResponsive(browser, classData) {
  console.log(`\n=== Responsive audit for ${classData.name} ===`);

  const viewports = [
    { width: 1440, height: 900, label: 'desktop' },
    { width: 768, height: 1024, label: 'tablet' },
    { width: 375, height: 812, label: 'mobile' },
  ];

  for (const vp of viewports) {
    console.log(`\n--- ${vp.label} (${vp.width}x${vp.height}) ---`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await context.newPage();

    try {
      await login(page);
      await navigateToStudentsTab(page, classData.id);

      const ss = await screenshot(page, `responsive_${vp.label}_v2_${classData.id}`);

      // Check overflow
      const overflowInfo = await page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;
        return {
          bodyScrollWidth: body.scrollWidth,
          htmlScrollWidth: html.scrollWidth,
          bodyClientWidth: body.clientWidth,
          htmlClientWidth: html.clientWidth,
          windowInnerWidth: window.innerWidth,
        };
      });

      const maxScrollWidth = Math.max(overflowInfo.bodyScrollWidth, overflowInfo.htmlScrollWidth);
      const maxClientWidth = Math.max(overflowInfo.bodyClientWidth, overflowInfo.htmlClientWidth);
      const overflow = maxScrollWidth - maxClientWidth;

      console.log(`  Overflow: ${overflow}px (scroll: ${maxScrollWidth}, client: ${maxClientWidth})`);

      if (overflow > 10) {
        addFinding(
          'Medium',
          `Horizontal overflow at ${vp.label} (${vp.width}px) — Students tab`,
          `${classData.name} / Students tab at ${vp.label} viewport`,
          ss,
          `Open /classes/${classData.id} at ${vp.width}px, navigate to Students tab`,
          'No horizontal scrollbar; all content fits within viewport',
          `Horizontal overflow of ${overflow}px (scrollWidth=${maxScrollWidth}, clientWidth=${maxClientWidth})`
        );
      }

      // Check for raw Tailwind values (design token violations) at any viewport
      const designTokenViolations = await page.evaluate(() => {
        const badClasses = [];
        const allEls = document.querySelectorAll('[class]');
        const badPatterns = [
          /\bbg-slate-\d+\b/, /\bbg-gray-\d+\b/, /\bbg-zinc-\d+\b/, /\bbg-stone-\d+\b/,
          /\btext-gray-\d+\b/, /\btext-slate-\d+\b/, /\btext-zinc-\d+\b/,
          /\brounded-lg\b/, /\brounded-md\b/, /\brounded-xl\b/, /\brounded-2xl\b/,
          /\bshadow-lg\b/, /\bshadow-md\b/, /\bshadow-sm\b/, /\bshadow-xl\b/,
        ];
        for (const el of allEls) {
          const cls = el.className;
          if (typeof cls === 'string') {
            for (const pattern of badPatterns) {
              if (pattern.test(cls)) {
                badClasses.push({
                  tag: el.tagName,
                  className: cls.substring(0, 100),
                  matched: cls.match(pattern)?.[0],
                });
                break; // one violation per element is enough
              }
            }
          }
        }
        return badClasses.slice(0, 20);
      });

      if (designTokenViolations.length > 0 && vp.label === 'desktop') {
        // Only report once (at desktop) to avoid duplicates
        addFinding(
          'Nitpick',
          'Raw Tailwind classes used instead of design tokens',
          `${classData.name} / Students tab`,
          ss,
          `Open /classes/${classData.id}, Students tab, inspect elements with raw utility classes`,
          'All classes should use design tokens (bg-base, text-text-primary, rounded-[--radius-card], etc.)',
          `Found ${designTokenViolations.length} element(s) with raw Tailwind values: ${designTokenViolations.slice(0, 3).map(v => v.matched).join(', ')}`
        );
        console.log('Design token violations:', designTokenViolations.slice(0, 5));
      }

    } finally {
      await context.close();
    }
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: EXEC_PATH,
  });

  const results = {
    loginOk: false,
    classesAudited: [],
    allConsoleErrors: {},
    findings: [],
  };

  try {
    // Quick login test
    const testCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const testPage = await testCtx.newPage();
    try {
      await login(testPage);
      results.loginOk = true;

      // Take dashboard screenshot
      await screenshot(testPage, 'dashboard_initial');

      // Check for 26SM classes on dashboard
      const dashboardText = await testPage.evaluate(() => document.body.innerText);
      if (dashboardText.includes('26SM')) {
        addFinding(
          'Blocker',
          'SCOPE VIOLATION: 26SM class visible on teacher dashboard',
          'Teacher dashboard',
          await screenshot(testPage, 'dashboard_26SM_violation'),
          'Login as ta@vocaboost.com',
          'Only 4 allowed 25WT 2차 classes should be visible',
          `26SM text found on dashboard`
        );
      }

      // Get class links visible to ta@
      const classLinks = await testPage.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href*="/classes/"]')).map(a => ({
          href: a.href,
          text: a.textContent?.trim().substring(0, 60),
        }));
      });
      console.log('Class links on dashboard:', classLinks);

    } finally {
      await testCtx.close();
    }

    // Full audit of each class
    for (const classData of ALLOWED_CLASSES) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`AUDITING: ${classData.name} (${classData.id})`);
      console.log('='.repeat(60));

      const classResult = await auditClassFull(browser, classData);
      results.classesAudited.push(classData.id);
      results.allConsoleErrors[classData.id] = classResult.consoleErrors;

      // Report console errors as finding
      if (classResult.consoleErrors.length > 0) {
        const sig = classResult.consoleErrors.filter(e =>
          !e.text.includes('favicon') && !e.text.includes('manifest')
        );
        if (sig.length > 0) {
          addFinding(
            'Medium',
            `Console JavaScript errors on Students tab`,
            `${classData.name} / browser console`,
            'N/A (see screenshot)',
            `Open /classes/${classData.id}, Students tab, open browser DevTools console`,
            'No JavaScript errors in console',
            `${sig.length} error(s): ${sig.slice(0, 3).map(e => e.text.substring(0, 100)).join(' | ')}`
          );
        }
      }
    }

    // Responsive audit (only first class per instructions)
    await auditResponsive(browser, ALLOWED_CLASSES[0]);

  } finally {
    await browser.close();
  }

  results.findings = findings;

  const bySeverity = { Blocker: 0, High: 0, Medium: 0, Nitpick: 0 };
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;

  console.log('\n=== FINAL FINDINGS SUMMARY ===');
  console.log(bySeverity);
  console.log('Total:', findings.length);

  writeFileSync('/app/e2e/audit/_tmp/ta_roster_results2.json', JSON.stringify({ ...results, bySeverity }, null, 2));
  return { ...results, bySeverity };
}

main().then(r => {
  console.log('\nAudit v2 complete:', r.bySeverity);
}).catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
