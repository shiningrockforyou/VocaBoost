/**
 * TA-ROSTER Audit Script v3
 * Fixes SVGAnimatedString bug, comprehensive roster audit.
 */

import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';
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
let screenshotIndex = 200;

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
  if (await loginLink.count()) await loginLink.click();
  else {
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

async function gotoStudentsTab(page, classId) {
  await page.goto(`${SITE}/classes/${classId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Click Students tab/button/link
  const studentsTab = page.locator('button, a, [role="tab"]').filter({ hasText: /^Students$/i });
  if (await studentsTab.count() > 0) {
    await studentsTab.first().click();
    await page.waitForTimeout(2000);
  } else {
    // Try by text partial match
    const link = page.getByText('Students').first();
    if (await link.count() > 0) {
      await link.click();
      await page.waitForTimeout(2000);
    }
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: EXEC_PATH,
  });

  const allConsoleErrors = {};
  let loginOk = false;

  try {
    // ---- 1. Login verification ----
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      try {
        await login(page);
        loginOk = true;
        const dashUrl = page.url();
        console.log('Login OK, URL:', dashUrl);

        const ss = await screenshot(page, 'v3_dashboard');

        // Check dashboard for 26SM
        const dashText = await page.evaluate(() => document.body.innerText);
        if (dashText.includes('26SM')) {
          addFinding('Blocker', 'SCOPE VIOLATION: 26SM class visible on teacher dashboard',
            'Teacher dashboard', ss, 'Login as ta@vocaboost.com',
            'Only 4 allowed 25WT classes visible', '26SM text on dashboard');
        }

        // List all class links
        const classLinks = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a[href*="/classes/"]')).map(a => ({
            href: a.href,
            text: a.textContent?.trim().substring(0, 80),
          }));
        });
        console.log('Dashboard class links:', classLinks);
      } finally {
        await ctx.close();
      }
    }

    // ---- 2. Per-class audit ----
    for (const cls of ALLOWED_CLASSES) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`CLASS: ${cls.name} (${cls.id})`);
      console.log('='.repeat(60));

      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));

      try {
        await login(page);
        await gotoStudentsTab(page, cls.id);

        const overviewSs = await screenshot(page, `v3_class_${cls.id}`);
        console.log('Current URL:', page.url());

        // --- 2a. Score overflow check ---
        const pctData = await page.evaluate(() => {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          const results = [];
          let node;
          while ((node = walker.nextNode())) {
            const t = node.textContent.trim();
            const matches = t.match(/(\d+(?:\.\d+)?)\s*%/g);
            if (matches) {
              for (const m of matches) {
                const val = parseFloat(m);
                results.push({
                  val,
                  text: m,
                  context: t.substring(0, 120),
                  parentTag: node.parentElement?.tagName,
                  parentClass: (node.parentElement?.className ?? '').toString().substring(0, 80),
                });
              }
            }
          }
          return results;
        });

        const overflows = pctData.filter(p => p.val > 100);
        if (overflows.length > 0) {
          const ss = await screenshot(page, `v3_overflow_${cls.id}`);
          addFinding('Blocker',
            `Score percentage exceeds 100% (newWordsTestScore ×100 bug confirmed)`,
            `${cls.name} / Students tab — score cells`,
            ss,
            `Navigate to /classes/${cls.id}, Students tab, inspect "New:" score in Current Session column`,
            'New word test scores should be 0–100%; e.g. "New: ✓ 97%"',
            `Found ${overflows.length} value(s) > 100%: ${overflows.map(p => `"${p.text}" (context: ${p.context.trim()})`).join(' || ')}`
          );
        } else {
          console.log(`No overflow percentages in ${cls.name}`);
          if (pctData.length > 0) console.log('Sample pcts:', pctData.slice(0, 6).map(p => p.text));
        }

        // --- 2b. Check progress bar CSS widths > 100% ---
        const pbOverflows = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('[style*="width"]'))
            .filter(el => {
              const style = el.getAttribute('style') || '';
              const m = style.match(/width\s*:\s*(\d+(?:\.\d+)?)%/);
              return m && parseFloat(m[1]) > 100;
            })
            .map(el => ({
              style: el.getAttribute('style'),
              className: (el.className ?? '').toString().substring(0, 80),
              text: (el.textContent || '').trim().substring(0, 40),
            }));
        });

        if (pbOverflows.length > 0) {
          const ss = await screenshot(page, `v3_pb_overflow_${cls.id}`);
          addFinding('Blocker',
            'Progress bar CSS width > 100% (score rendering bug)',
            `${cls.name} / Students tab — progress bar elements`,
            ss,
            `Navigate to /classes/${cls.id}, Students tab, inspect progress bar elements`,
            'Progress bar width should be 0–100%',
            `${pbOverflows.length} bar(s) with width >100%: ${pbOverflows.map(b => b.style).join(' | ')}`
          );
        }

        // --- 2c. Inspect student rows for data sanity ---
        const rowData = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('tbody tr')).map(row => ({
            cells: Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim()),
          }));
        });

        console.log(`Student rows: ${rowData.length}`);
        if (rowData.length > 0) {
          console.log('Sample row cells:', rowData[0].cells);
          // Check for rows with Review: missing entirely (not "No History" or "Not Started")
          const badReviewRows = rowData.filter(row => {
            const curSession = row.cells[5] || row.cells[4] || '';
            // If there's a Day label but no review score shown
            return curSession.includes('Day') && !curSession.includes('Review') &&
                   !curSession.includes('Not Started') && !curSession.includes('No History');
          });
          if (badReviewRows.length > 0) {
            console.log('Rows with Day but no Review score:', badReviewRows.slice(0, 3));
          }
        }

        // --- 2d. Pending challenge badge ---
        const challengeInfo = await page.evaluate(() => {
          // Use string conversion to avoid SVGAnimatedString issues
          const allEls = Array.from(document.querySelectorAll('*'));
          const relevant = [];
          for (const el of allEls) {
            const cls = String(el.className || '').toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            const title = (el.getAttribute('title') || '').toLowerCase();
            const innerText = (el.innerText || '').trim();
            if (
              cls.includes('challenge') || cls.includes('pending') ||
              aria.includes('challenge') || title.includes('challenge') ||
              (innerText.length < 80 && innerText.toLowerCase().includes('challenge'))
            ) {
              relevant.push({
                tag: el.tagName,
                cls: cls.substring(0, 80),
                aria,
                title,
                text: innerText.substring(0, 80),
                visible: el.offsetParent !== null,
              });
            }
          }
          return relevant.slice(0, 20);
        });

        console.log('Challenge DOM elements:', challengeInfo.length);
        const visibleChallenge = challengeInfo.filter(e => e.visible);

        if (visibleChallenge.length === 0) {
          const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
          const hasChallengeAnywhere = bodyText.includes('challenge');
          addFinding('Medium',
            'Pending-challenge badge/count absent from class header and roster (Issue #12)',
            `${cls.name} / class header + roster header`,
            overviewSs,
            `Navigate to /classes/${cls.id}, Students tab — look for any challenge count, badge, or indicator`,
            'A pending-challenge count or badge should appear (e.g., "2 pending challenges") on the class header or roster',
            hasChallengeAnywhere
              ? 'No VISIBLE challenge element (text "challenge" exists elsewhere in DOM but not on Students view)'
              : 'No challenge-related DOM elements at all on Students tab'
          );
        } else {
          console.log('Challenge elements visible:', visibleChallenge);
        }

        // --- 2e. Name-edit UI test (1st student) ---
        const firstEditBtn = page.locator('button[aria-label="Edit name"]').first();
        const editBtnCount = await firstEditBtn.count();
        console.log(`\nEdit name buttons count: ${editBtnCount}`);

        if (editBtnCount === 0) {
          // Try hover on first student row to reveal the button (it's opacity-0 until hover)
          const firstStudentRow = page.locator('tbody tr').first();
          if (await firstStudentRow.count() > 0) {
            await firstStudentRow.hover();
            await page.waitForTimeout(400);
          }
        }

        // Check if the button is just opacity:0 (hover state)
        const editBtnInfo = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button[aria-label="Edit name"]'));
          return btns.slice(0, 3).map(btn => ({
            ariaLabel: btn.getAttribute('aria-label'),
            className: btn.className?.substring(0, 120),
            computed_opacity: window.getComputedStyle(btn).opacity,
            computed_visibility: window.getComputedStyle(btn).visibility,
            computed_display: window.getComputedStyle(btn).display,
            offsetParent: btn.offsetParent !== null,
          }));
        });
        console.log('Edit name button details:', editBtnInfo);

        // Try to click the edit button for the first student
        // We need to hover first to make it visible (opacity-0 group-hover:opacity-100)
        let nameEditOpened = false;
        let nameEditCancelled = false;

        if (editBtnInfo.length > 0) {
          try {
            // Force click to bypass opacity
            await firstEditBtn.evaluate(el => el.click());
            await page.waitForTimeout(800);

            const inputVisible = await page.locator('input[type="text"]').first().isVisible().catch(() => false);
            if (inputVisible) {
              nameEditOpened = true;
              const editOpenSs = await screenshot(page, `v3_name_edit_OPEN_${cls.id}`);
              console.log('Name edit OPENED successfully');

              // Find and click cancel - look for X button or Cancel button near the input
              const cancelSelectors = [
                'button[aria-label*="cancel" i]',
                'button[aria-label*="Cancel"]',
                'button[title*="cancel" i]',
              ];

              let cancelled = false;
              for (const sel of cancelSelectors) {
                const btn = page.locator(sel).first();
                if (await btn.count() > 0) {
                  await btn.click({ timeout: 3000 });
                  await page.waitForTimeout(400);
                  cancelled = true;
                  nameEditCancelled = true;
                  await screenshot(page, `v3_name_edit_CLOSED_${cls.id}`);
                  console.log('Name edit cancelled via:', sel);
                  break;
                }
              }

              if (!cancelled) {
                // Try Escape
                await page.keyboard.press('Escape');
                await page.waitForTimeout(400);
                const stillOpen = await page.locator('input[type="text"]').first().isVisible().catch(() => false);
                if (!stillOpen) {
                  nameEditCancelled = true;
                  await screenshot(page, `v3_name_edit_ESC_CLOSED_${cls.id}`);
                  console.log('Name edit closed via Escape');
                } else {
                  await screenshot(page, `v3_name_edit_STUCK_${cls.id}`);
                  addFinding('Medium',
                    'Name-edit inline editor cannot be cancelled (stuck open)',
                    `${cls.name} / student name cell inline editor`,
                    await screenshot(page, `v3_name_edit_STUCK2_${cls.id}`),
                    `Open /classes/${cls.id}, Students tab, click Edit name, try Escape or Cancel`,
                    'Cancel/X button or Escape key should close the editor without saving',
                    'Editor remained open after Escape and no Cancel button found'
                  );
                }
              }
            } else {
              addFinding('High',
                'Edit name button exists (aria-label="Edit name") but clicking does not open inline editor',
                `${cls.name} / student name cell`,
                await screenshot(page, `v3_name_edit_NO_INPUT_${cls.id}`),
                `Open /classes/${cls.id}, Students tab, click "Edit name" button on first student`,
                'An inline text input + Check/Cancel buttons should appear',
                'Input not visible after clicking the button'
              );
            }
          } catch (e) {
            console.log('Name edit error:', e.message);
            addFinding('High',
              `Name-edit interaction error: ${e.message}`,
              `${cls.name} / student name cell`,
              overviewSs,
              `Open /classes/${cls.id}, Students tab, click Edit name button`,
              'Edit should open inline input cleanly',
              `Exception: ${e.message}`
            );
          }
        } else {
          addFinding('High',
            'No "Edit name" button found in Students roster',
            `${cls.name} / student name cells`,
            overviewSs,
            `Open /classes/${cls.id}, Students tab, hover over student names, look for pencil icon`,
            'Each student row should have a pencil/Edit name button (aria-label="Edit name")',
            'No button[aria-label="Edit name"] found anywhere in DOM'
          );
        }

        console.log(`Name edit: opened=${nameEditOpened}, cancelled=${nameEditCancelled}`);

        // Store console errors
        allConsoleErrors[cls.id] = errors.filter(e =>
          !e.includes('favicon') && !e.includes('manifest') && !e.includes('net::ERR_')
        );

        if (allConsoleErrors[cls.id].length > 0) {
          console.log(`Console errors: ${allConsoleErrors[cls.id].length}`);
          allConsoleErrors[cls.id].slice(0, 3).forEach(e => console.log('  ', e.substring(0, 120)));
        }

      } finally {
        await ctx.close();
      }
    }

    // ---- 3. Responsive audit (first class only) ----
    const viewports = [
      { width: 1440, height: 900, label: 'desktop' },
      { width: 768, height: 1024, label: 'tablet' },
      { width: 375, height: 812, label: 'mobile' },
    ];

    for (const vp of viewports) {
      console.log(`\n--- Responsive: ${vp.label} (${vp.width}x${vp.height}) ---`);
      const cls = ALLOWED_CLASSES[0];

      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      try {
        await login(page);
        await gotoStudentsTab(page, cls.id);
        const ss = await screenshot(page, `v3_resp_${vp.label}_${cls.id}`);

        const overflow = await page.evaluate(() => {
          const sw = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth);
          const cw = Math.max(document.body.clientWidth, document.documentElement.clientWidth);
          return { scrollWidth: sw, clientWidth: cw, overflow: sw - cw };
        });
        console.log(`  Overflow: ${overflow.overflow}px`);

        if (overflow.overflow > 10) {
          addFinding('Medium',
            `Horizontal overflow at ${vp.label} viewport (${vp.width}px)`,
            `${cls.name} / Students tab at ${vp.label}`,
            ss,
            `Open /classes/${cls.id}, Students tab at ${vp.width}px viewport`,
            'No horizontal overflow; content fits within viewport width',
            `scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}, overflow=${overflow.overflow}px`
          );
        }

        // Check for layout issues at small viewports
        if (vp.width <= 768) {
          // Check if header nav overflows
          const navOverflow = await page.evaluate(() => {
            const nav = document.querySelector('nav, header, [role="navigation"]');
            if (!nav) return null;
            return {
              scrollWidth: nav.scrollWidth,
              clientWidth: nav.clientWidth,
              overflow: nav.scrollWidth - nav.clientWidth,
            };
          });
          if (navOverflow && navOverflow.overflow > 5) {
            addFinding('Medium',
              `Navigation bar overflows at ${vp.label} viewport`,
              `${cls.name} / navigation header at ${vp.label}`,
              ss,
              `Open at ${vp.width}px, inspect nav/header element`,
              'Navigation should not overflow',
              `Nav overflow: ${navOverflow.overflow}px`
            );
          }
        }

        // Check design token compliance (only at desktop to avoid duplicate findings)
        if (vp.label === 'desktop') {
          const tokenViolations = await page.evaluate(() => {
            const badPatterns = [
              [/\bbg-slate-\d+\b/, 'bg-slate-*'],
              [/\bbg-gray-\d+\b/, 'bg-gray-*'],
              [/\bbg-zinc-\d+\b/, 'bg-zinc-*'],
              [/\btext-gray-\d+\b/, 'text-gray-*'],
              [/\btext-slate-\d+\b/, 'text-slate-*'],
              [/\brounded-lg\b/, 'rounded-lg'],
              [/\brounded-md\b/, 'rounded-md'],
              [/\bshadow-lg\b/, 'shadow-lg'],
              [/\bshadow-md\b/, 'shadow-md'],
            ];
            const violations = [];
            document.querySelectorAll('[class]').forEach(el => {
              const cls = String(el.className || '');
              for (const [pattern, label] of badPatterns) {
                if (pattern.test(cls)) {
                  violations.push({ label, element: el.tagName, cls: cls.substring(0, 80) });
                  break;
                }
              }
            });
            return violations.slice(0, 15);
          });

          if (tokenViolations.length > 0) {
            const violationsByType = {};
            for (const v of tokenViolations) {
              violationsByType[v.label] = (violationsByType[v.label] || 0) + 1;
            }
            addFinding('Nitpick',
              'Raw Tailwind classes used instead of design tokens',
              `${cls.name} / Students tab elements`,
              ss,
              `Open /classes/${cls.id}, Students tab, inspect element classes`,
              'All styling should use project design tokens (bg-base, text-text-primary, etc.)',
              `Found ${tokenViolations.length} violation(s): ${Object.entries(violationsByType).map(([k,v]) => `${k}(${v})`).join(', ')}`
            );
            console.log('Design token violations:', violationsByType);
          }
        }

      } finally {
        await ctx.close();
      }
    }

    // ---- 4. Report console errors ----
    for (const cls of ALLOWED_CLASSES) {
      const errs = allConsoleErrors[cls.id] || [];
      if (errs.length > 0) {
        addFinding('Medium',
          'JavaScript console errors on Students tab',
          `${cls.name} / browser console`,
          'see class screenshots',
          `Open /classes/${cls.id}, Students tab, open browser DevTools console`,
          'No console errors',
          `${errs.length} error(s): ${errs.slice(0, 3).map(e => e.substring(0, 100)).join(' | ')}`
        );
      }
    }

  } finally {
    await browser.close();
  }

  const bySeverity = { Blocker: 0, High: 0, Medium: 0, Nitpick: 0 };
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;

  console.log('\n=== FINAL ===');
  console.log('Login OK:', loginOk);
  console.log('Findings:', bySeverity, 'Total:', findings.length);

  writeFileSync('/app/e2e/audit/_tmp/ta_roster_results3.json', JSON.stringify({
    loginOk, findings, bySeverity, allConsoleErrors,
  }, null, 2));

  return { loginOk, findings, bySeverity };
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
