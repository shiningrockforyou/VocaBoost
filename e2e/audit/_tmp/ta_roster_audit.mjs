/**
 * TA-ROSTER Audit Script
 * Teacher-side roster audit for vocaBoost production site.
 * READ-ONLY: no saves, no writes, no 26SM classes.
 */

import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';
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
const consoleErrors = {};
let screenshotIndex = 0;

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
  console.log('Navigating to root...');
  await page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });

  // Try to find login link or navigate to login
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  const loginLinkCount = await loginLink.count();

  if (loginLinkCount > 0) {
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
    // Try clicking Continue button
    try {
      await page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first().click();
      await page.waitForURL(/\/(dashboard|classes|$)/, { timeout: 15000 });
    } catch (e) {
      console.log('Login may have failed:', e.message);
    }
  }

  const url = page.url();
  console.log('Post-login URL:', url);
  return url;
}

async function captureConsoleErrors(page, classId) {
  consoleErrors[classId] = consoleErrors[classId] || [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors[classId].push({
        text: msg.text(),
        url: page.url(),
      });
    }
  });
  page.on('pageerror', err => {
    consoleErrors[classId].push({
      text: `PAGE ERROR: ${err.message}`,
      url: page.url(),
    });
  });
}

/**
 * Parse a percentage string and check if it's in valid range 0-100
 * Returns null if not a percentage, or the numeric value if it is
 */
function parsePercent(text) {
  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  return parseFloat(match[1]);
}

/**
 * Check score cells for > 100% values
 */
async function checkRosterScores(page, classId, className) {
  // Get all table cells / score cells
  const allText = await page.evaluate(() => {
    const cells = document.querySelectorAll('td, th, [class*="score"], [class*="Score"], [class*="percent"], [class*="Percent"]');
    return Array.from(cells).map(el => ({
      text: el.textContent?.trim(),
      tag: el.tagName,
      className: el.className,
    }));
  });

  const scoreIssues = [];
  for (const cell of allText) {
    if (!cell.text) continue;
    const pct = parsePercent(cell.text);
    if (pct !== null && pct > 100) {
      scoreIssues.push({ text: cell.text, tag: cell.tag, className: cell.className });
    }
  }

  if (scoreIssues.length > 0) {
    const ss = await screenshot(page, `score_overflow_${classId}`);
    addFinding(
      'Blocker',
      'Score percentage exceeds 100% (possible ×100 bug)',
      `${className} / roster table`,
      ss,
      'Open /classes/' + classId + ' and inspect score cells',
      'All percentage scores should be 0–100%',
      `Found cells with >100% values: ${scoreIssues.map(s => s.text).join(', ')}`
    );
  }

  return scoreIssues;
}

/**
 * Inspect the full roster row content
 */
async function inspectRosterRows(page, classId, className) {
  // Wait for roster to load
  await page.waitForTimeout(2000);

  const rowData = await page.evaluate(() => {
    // Look for student rows in the table
    const rows = document.querySelectorAll('tr, [class*="student"], [class*="row"], [role="row"]');
    const data = [];
    for (const row of rows) {
      const text = row.textContent?.trim();
      if (text && text.length > 0 && text.length < 500) {
        // Extract percentage values
        const percentMatches = text.match(/\d+(?:\.\d+)?%/g) || [];
        data.push({
          text: text.substring(0, 200),
          percents: percentMatches,
          tag: row.tagName,
          role: row.getAttribute('role'),
          className: row.className?.substring(0, 100),
        });
      }
    }
    return data;
  });

  // Check for any percentage > 100
  const overflowRows = rowData.filter(r =>
    r.percents.some(p => parseFloat(p) > 100)
  );

  if (overflowRows.length > 0) {
    console.log(`[BLOCKER] Overflow percentages found in ${className}:`, overflowRows);
  } else {
    console.log(`No overflow percentages in ${className}`);
  }

  // Also check for any suspiciously large numbers (like 9700, 10000 without %)
  const suspiciousNumbers = rowData.filter(r => {
    const nums = r.text.match(/\b(\d{4,})\b/g) || [];
    return nums.some(n => parseInt(n) > 1000 && !r.text.includes(n + ' ') && !r.text.includes('ID'));
  });

  return { rowData, overflowRows, suspiciousNumbers };
}

async function auditClass(browser, classData, viewportWidth = 1440, viewportHeight = 900) {
  const context = await browser.newContext({
    viewport: { width: viewportWidth, height: viewportHeight },
  });
  const page = await context.newPage();

  // Capture console errors for this class
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({ text: msg.text(), url: page.url() });
    }
  });
  page.on('pageerror', err => {
    errors.push({ text: `PAGE ERROR: ${err.message}`, url: page.url() });
  });

  try {
    // Login
    console.log(`\n=== Auditing class: ${classData.name} (${classData.id}) ===`);
    await login(page);

    // Navigate to class detail page
    const classUrl = `${SITE}/classes/${classData.id}`;
    console.log(`Navigating to ${classUrl}`);

    // Use client-side routing to avoid Netlify SPA issues
    await page.evaluate((url) => {
      history.pushState({}, '', url);
      dispatchEvent(new PopStateEvent('popstate'));
    }, `/classes/${classData.id}`);

    await page.waitForTimeout(3000);

    let currentUrl = page.url();
    console.log('Current URL after navigation:', currentUrl);

    // If routing didn't work, try direct goto
    if (!currentUrl.includes(classData.id)) {
      await page.goto(classUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      currentUrl = page.url();
      console.log('After direct goto URL:', currentUrl);
    }

    // Take initial screenshot
    const initSs = await screenshot(page, `class_${classData.id}_desktop`);

    // Check page title/header
    const pageTitle = await page.title();
    const headingText = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const h2 = document.querySelector('h2');
      return { h1: h1?.textContent?.trim(), h2: h2?.textContent?.trim() };
    });
    console.log('Page title:', pageTitle, 'Headings:', headingText);

    // Check for 26SM classes (scope violation)
    const page26SM = await page.getByText(/26SM/i).count();
    if (page26SM > 0) {
      const ss26 = await screenshot(page, `26SM_violation_${classData.id}`);
      addFinding(
        'Blocker',
        'SCOPE VIOLATION: 26SM class visible or navigated to',
        `${classData.name} / page`,
        ss26,
        'Login as ta@ and navigate',
        'Only 4 allowed classes visible',
        '26SM class text detected on page'
      );
    }

    // Wait for roster to load - look for table or student list
    await page.waitForTimeout(2000);

    // Check what's on the page
    const pageStructure = await page.evaluate(() => {
      return {
        tables: document.querySelectorAll('table').length,
        rows: document.querySelectorAll('tr').length,
        hasStudentText: document.body.textContent.includes('student') || document.body.textContent.includes('Student'),
        hasRosterText: document.body.textContent.includes('roster') || document.body.textContent.includes('Roster'),
        bodyTextSnippet: document.body.textContent.substring(0, 500),
      };
    });
    console.log('Page structure:', pageStructure);

    // === CHECK 1: Score values (0-100% rule) ===
    const { overflowRows } = await inspectRosterRows(page, classData.id, classData.name);
    await checkRosterScores(page, classData.id, classData.name);

    // === CHECK 2: Detailed cell inspection ===
    const rosterCellData = await page.evaluate(() => {
      // Get all visible text content that could be scores
      const allElements = document.querySelectorAll('td, [class*="cell"], [class*="score"], [class*="session"]');
      const results = [];
      for (const el of allElements) {
        const text = el.textContent?.trim();
        if (text && /\d/.test(text)) {
          results.push({
            text: text.substring(0, 100),
            className: el.className?.substring(0, 80),
            tag: el.tagName,
          });
        }
      }
      return results.slice(0, 100); // limit output
    });

    // Look for scores above 100
    const highScores = rosterCellData.filter(cell => {
      const pct = parsePercent(cell.text);
      return pct !== null && pct > 100;
    });

    if (highScores.length > 0) {
      const ss = await screenshot(page, `high_scores_${classData.id}`);
      addFinding(
        'Blocker',
        'Score >100% detected in roster cells',
        `${classData.name} / roster table cells`,
        ss,
        `Navigate to /classes/${classData.id} and inspect score cells`,
        'All scores should be 0–100%',
        `High scores found: ${highScores.map(s => s.text).join(' | ')}`
      );
    }

    // === CHECK 3: Pending-challenge indicator ===
    const challengeIndicators = await page.evaluate(() => {
      // Look for challenge badge / indicator
      const selectors = [
        '[class*="challenge"]', '[class*="Challenge"]',
        '[class*="pending"]', '[class*="Pending"]',
        '[class*="badge"]', '[class*="Badge"]',
        '[aria-label*="challenge"]', '[title*="challenge"]',
      ];
      const found = [];
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          found.push({
            selector: sel,
            text: el.textContent?.trim().substring(0, 50),
            className: el.className?.substring(0, 80),
            visible: el.offsetParent !== null,
          });
        }
      }
      return found;
    });

    console.log('Challenge indicators found:', challengeIndicators.length);
    if (challengeIndicators.length === 0) {
      // Check if there's any mention of pending/challenge in the DOM at all
      const hasChallengeText = await page.evaluate(() => {
        const text = document.body.textContent;
        return {
          hasPending: text.toLowerCase().includes('pending'),
          hasChallenge: text.toLowerCase().includes('challenge'),
          pendingSnippet: '',
        };
      });
      console.log('Challenge text check:', hasChallengeText);

      // Only flag if we see the issue - no indicator at all
      if (!hasChallengeText.hasChallenge && !hasChallengeText.hasPending) {
        addFinding(
          'Medium',
          'Pending-challenge indicator absent from roster/class header (Issue #12)',
          `${classData.name} / class header and roster`,
          initSs,
          `Navigate to /classes/${classData.id} and inspect for pending challenge badge`,
          'Pending-challenge count/badge should appear on roster or class header',
          'No pending-challenge indicator or badge found in the DOM'
        );
      }
    }

    // === CHECK 4: Name-edit UI ===
    // Find pencil/edit icons on student names
    const pencilIcons = await page.evaluate(() => {
      const editElements = document.querySelectorAll(
        '[class*="edit"], [class*="pencil"], button[aria-label*="edit"], button[aria-label*="rename"], svg[class*="edit"], [data-testid*="edit"]'
      );
      return Array.from(editElements).map(el => ({
        tag: el.tagName,
        className: el.className?.substring(0, 80),
        ariaLabel: el.getAttribute('aria-label'),
        text: el.textContent?.trim().substring(0, 30),
        visible: el.offsetParent !== null,
      })).slice(0, 20);
    });

    console.log('Edit icons found:', pencilIcons.length);

    // Try clicking the first edit icon
    const editableNameCells = page.locator('[class*="edit"], button[aria-label*="edit"], button[aria-label*="rename"]').first();
    const editIconCount = await editableNameCells.count();

    if (editIconCount > 0) {
      try {
        // Look for pencil icon specifically using common patterns
        const pencilButton = page.locator('button').filter({ has: page.locator('svg') }).first();
        // More targeted: look for edit/pencil near student names
        const svgButtons = await page.evaluate(() => {
          const btns = document.querySelectorAll('button');
          return Array.from(btns)
            .filter(b => b.querySelector('svg'))
            .map(b => ({
              ariaLabel: b.getAttribute('aria-label'),
              text: b.textContent?.trim().substring(0, 30),
              className: b.className?.substring(0, 80),
            }))
            .slice(0, 20);
        });
        console.log('SVG buttons:', svgButtons);
      } catch (e) {
        console.log('Error checking edit icons:', e.message);
      }
    }

    // Take a screenshot before trying name edit
    const preEditSs = await screenshot(page, `pre_name_edit_${classData.id}`);

    // Try to find and click name edit pencil
    let nameEditWorked = false;
    let nameEditError = null;

    try {
      // Try various selectors for the pencil/edit button
      const editSelectors = [
        'button[aria-label*="edit" i]',
        'button[aria-label*="rename" i]',
        '[class*="pencil"]',
        'button[title*="edit" i]',
      ];

      let editBtn = null;
      for (const sel of editSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.count() > 0) {
          editBtn = btn;
          console.log('Found edit button with selector:', sel);
          break;
        }
      }

      if (editBtn) {
        await editBtn.click({ timeout: 5000 });
        await page.waitForTimeout(1000);

        // Check if input appeared
        const inputVisible = await page.locator('input[type="text"]').count() > 0;
        const cancelBtn = page.locator('button[aria-label*="cancel" i], button[aria-label*="close" i], button:has-text("Cancel"), button:has-text("X"), button:has-text("✕")').first();
        const cancelCount = await cancelBtn.count();

        if (inputVisible) {
          nameEditWorked = true;
          const editOpenSs = await screenshot(page, `name_edit_open_${classData.id}`);
          console.log('Name edit opened successfully');

          // Now cancel (READ-ONLY: must not save)
          if (cancelCount > 0) {
            await cancelBtn.click({ timeout: 3000 });
            await page.waitForTimeout(500);
            const editClosedSs = await screenshot(page, `name_edit_closed_${classData.id}`);
            console.log('Name edit cancelled successfully');
          } else {
            // Try Escape key
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
          }
        } else {
          nameEditError = 'Edit button clicked but no text input appeared';
        }
      } else {
        nameEditError = 'No edit/pencil button found in DOM';
        console.log('No edit button found. Looking for inline edit patterns...');

        // Check if name cells have hover state edit
        const nameCell = page.locator('td, [class*="name"]').first();
        if (await nameCell.count() > 0) {
          await nameCell.hover();
          await page.waitForTimeout(500);
          const afterHoverSs = await screenshot(page, `name_hover_state_${classData.id}`);

          // Re-check for edit button after hover
          for (const sel of editSelectors) {
            const btn = page.locator(sel).first();
            if (await btn.count() > 0) {
              editBtn = btn;
              nameEditError = null;
              console.log('Found edit button after hover with selector:', sel);
              break;
            }
          }
        }
      }
    } catch (e) {
      nameEditError = `Exception: ${e.message}`;
      console.log('Name edit test error:', e.message);
    }

    if (nameEditError) {
      addFinding(
        'Medium',
        'Name-edit pencil/button not found or not functional',
        `${classData.name} / student name cells`,
        preEditSs,
        `Navigate to /classes/${classData.id}, look for pencil/edit icon on student names`,
        'Clicking pencil icon opens inline editor with input + Cancel/Check buttons',
        nameEditError
      );
    }

    // Store console errors
    consoleErrors[classData.id] = errors;

    if (errors.length > 0) {
      console.log(`Console errors for ${classData.name}:`, errors.slice(0, 5));
    }

    return { errors, overflowRows, nameEditWorked };

  } finally {
    await context.close();
  }
}

async function auditResponsive(browser, classData) {
  const viewports = [
    { width: 1440, height: 900, label: 'desktop' },
    { width: 768, height: 1024, label: 'tablet' },
    { width: 375, height: 812, label: 'mobile' },
  ];

  for (const vp of viewports) {
    console.log(`\n--- Responsive test: ${vp.label} (${vp.width}x${vp.height}) for ${classData.name} ---`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await context.newPage();

    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    try {
      await login(page);

      // Navigate to class
      await page.evaluate((classId) => {
        history.pushState({}, '', `/classes/${classId}`);
        dispatchEvent(new PopStateEvent('popstate'));
      }, classData.id);

      await page.waitForTimeout(3000);

      // Check for horizontal overflow
      const overflowInfo = await page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;
        const scrollWidth = Math.max(body.scrollWidth, html.scrollWidth);
        const clientWidth = Math.max(body.clientWidth, html.clientWidth);
        return {
          scrollWidth,
          clientWidth,
          hasHorizontalOverflow: scrollWidth > clientWidth,
          overflowDiff: scrollWidth - clientWidth,
        };
      });

      const ss = await screenshot(page, `responsive_${vp.label}_${classData.id}`);

      if (overflowInfo.hasHorizontalOverflow && overflowInfo.overflowDiff > 5) {
        addFinding(
          'Medium',
          `Horizontal overflow at ${vp.label} viewport (${vp.width}px)`,
          `${classData.name} / roster at ${vp.label}`,
          ss,
          `Open /classes/${classData.id} at ${vp.width}px viewport width`,
          'No horizontal scrollbar, layout fits viewport',
          `scrollWidth=${overflowInfo.scrollWidth}, clientWidth=${overflowInfo.clientWidth}, overflow=${overflowInfo.overflowDiff}px`
        );
      }

      // Check for broken/missing elements at smaller viewports
      if (vp.width <= 768) {
        const tableCheck = await page.evaluate(() => {
          const tables = document.querySelectorAll('table');
          return {
            tableCount: tables.length,
            hasOverflowX: Array.from(tables).some(t => {
              const style = window.getComputedStyle(t.parentElement || t);
              return style.overflowX === 'auto' || style.overflowX === 'scroll';
            }),
          };
        });

        if (tableCheck.tableCount > 0 && !tableCheck.hasOverflowX && overflowInfo.hasHorizontalOverflow) {
          addFinding(
            'Medium',
            `Table not wrapped in scrollable container at ${vp.label}`,
            `${classData.name} / roster table at ${vp.label} viewport`,
            ss,
            `Open /classes/${classData.id} at ${vp.width}px`,
            'Table should be wrapped in overflow-x: auto container on small screens',
            'Table overflows viewport without scroll wrapper'
          );
        }
      }

      console.log(`${vp.label} overflow: ${JSON.stringify(overflowInfo)}`);

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

  try {
    // First, do a general login test and check what classes ta@ sees
    console.log('\n=== Initial login and class list check ===');
    const initContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const initPage = await initContext.newPage();
    let loginOk = false;

    try {
      const postLoginUrl = await login(initPage);
      loginOk = postLoginUrl.includes('vocaboostone.netlify.app');
      console.log('Login OK:', loginOk, 'URL:', postLoginUrl);

      const initSs = await screenshot(initPage, 'initial_dashboard');

      // Check what's visible on dashboard
      const dashboardContent = await initPage.evaluate(() => {
        return {
          text: document.body.textContent.substring(0, 1000),
          classLinks: Array.from(document.querySelectorAll('a[href*="/classes/"]')).map(a => ({
            href: a.href,
            text: a.textContent?.trim().substring(0, 50),
          })),
        };
      });

      console.log('Dashboard class links:', dashboardContent.classLinks);

      // Check for 26SM classes
      const sm26Count = dashboardContent.classLinks.filter(l => l.text.includes('26SM')).length;
      if (sm26Count > 0) {
        addFinding(
          'Blocker',
          'SCOPE VIOLATION: 26SM class(es) visible on teacher dashboard',
          'Teacher dashboard',
          initSs,
          'Login as ta@vocaboost.com and check class list',
          'Only 4 allowed 25WT classes should be visible',
          `Found ${sm26Count} 26SM class(es) in dashboard: ${dashboardContent.classLinks.filter(l => l.text.includes('26SM')).map(l => l.text).join(', ')}`
        );
      }

      // Check if unauthorized classes are visible
      const unauthorizedClasses = dashboardContent.classLinks.filter(l => {
        const id = l.href.split('/classes/')[1];
        return id && !ALLOWED_CLASSES.find(c => c.id === id);
      });

      if (unauthorizedClasses.length > 0) {
        console.log('WARNING: Unauthorized class links on dashboard:', unauthorizedClasses);
      }

    } finally {
      await initContext.close();
    }

    // Now audit each of the 4 allowed classes
    const classResults = {};
    for (const classData of ALLOWED_CLASSES) {
      classResults[classData.id] = await auditClass(browser, classData);
    }

    // Responsive audit on first class only (as per instructions)
    console.log('\n=== Responsive audit (first class) ===');
    await auditResponsive(browser, ALLOWED_CLASSES[0]);

    // Compile console error findings
    for (const classData of ALLOWED_CLASSES) {
      const errors = consoleErrors[classData.id] || classResults[classData.id]?.errors || [];
      if (errors.length > 0) {
        // Filter out noise
        const significantErrors = errors.filter(e =>
          !e.text?.includes('favicon') &&
          !e.text?.includes('manifest') &&
          !e.text?.includes('net::ERR_')
        );
        if (significantErrors.length > 0) {
          addFinding(
            'Medium',
            `Console errors on class roster page`,
            `${classData.name} / console`,
            'N/A',
            `Open /classes/${classData.id} and check browser console`,
            'No errors in console',
            `${significantErrors.length} error(s): ${significantErrors.slice(0, 3).map(e => e.text).join(' | ')}`
          );
        }
      }
    }

    console.log('\n=== Findings summary ===');
    const bySeverity = { Blocker: 0, High: 0, Medium: 0, Nitpick: 0 };
    for (const f of findings) {
      bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    }
    console.log(bySeverity);
    console.log('Total findings:', findings.length);

    // Return results object for report generation
    return {
      loginOk,
      findings,
      bySeverity,
      consoleErrors,
    };

  } finally {
    await browser.close();
  }
}

// Run the audit
main().then(results => {
  // Write results to a temp JSON for report generation
  writeFileSync('/app/e2e/audit/_tmp/ta_roster_results.json', JSON.stringify(results, null, 2));
  console.log('\nAudit complete. Results written to ta_roster_results.json');
}).catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
