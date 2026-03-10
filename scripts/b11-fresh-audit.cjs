/**
 * B11 Fresh Audit - Cross-Cutting Quality
 * Scenarios: X-01 (Design Token Compliance), X-02 (Responsive Layout), X-03 (Console Errors)
 * Run date: 2026-03-09
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5173';
const TEACHER_EMAIL = 'teacher@apboost.test';
const TEACHER_PASSWORD = 'Teacher123!';
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots/b11_fresh');

// Patterns for raw Tailwind violations
// These match class names that should use design tokens instead
const VIOLATION_PATTERNS = [
  // bg colors
  /^bg-slate-\d+$/, /^bg-gray-\d+$/, /^bg-zinc-\d+$/, /^bg-neutral-\d+$/,
  /^bg-stone-\d+$/, /^bg-red-\d+$/, /^bg-orange-\d+$/, /^bg-amber-\d+$/,
  /^bg-yellow-\d+$/, /^bg-lime-\d+$/, /^bg-green-\d+$/, /^bg-emerald-\d+$/,
  /^bg-teal-\d+$/, /^bg-cyan-\d+$/, /^bg-sky-\d+$/, /^bg-blue-\d+$/,
  /^bg-indigo-\d+$/, /^bg-violet-\d+$/, /^bg-purple-\d+$/, /^bg-fuchsia-\d+$/,
  /^bg-pink-\d+$/, /^bg-rose-\d+$/,
  /^bg-white$/, /^bg-black$/,
  // text colors
  /^text-slate-\d+$/, /^text-gray-\d+$/, /^text-zinc-\d+$/, /^text-neutral-\d+$/,
  /^text-stone-\d+$/, /^text-red-\d+$/, /^text-orange-\d+$/, /^text-amber-\d+$/,
  /^text-yellow-\d+$/, /^text-lime-\d+$/, /^text-green-\d+$/, /^text-emerald-\d+$/,
  /^text-teal-\d+$/, /^text-cyan-\d+$/, /^text-sky-\d+$/, /^text-blue-\d+$/,
  /^text-indigo-\d+$/, /^text-violet-\d+$/, /^text-purple-\d+$/, /^text-fuchsia-\d+$/,
  /^text-pink-\d+$/, /^text-rose-\d+$/,
  // border colors
  /^border-slate-\d+$/, /^border-gray-\d+$/, /^border-zinc-\d+$/, /^border-neutral-\d+$/,
  /^border-red-\d+$/, /^border-orange-\d+$/, /^border-amber-\d+$/, /^border-yellow-\d+$/,
  /^border-lime-\d+$/, /^border-green-\d+$/, /^border-emerald-\d+$/, /^border-teal-\d+$/,
  /^border-cyan-\d+$/, /^border-sky-\d+$/, /^border-blue-\d+$/, /^border-indigo-\d+$/,
  /^border-violet-\d+$/, /^border-purple-\d+$/, /^border-fuchsia-\d+$/, /^border-pink-\d+$/,
  /^border-rose-\d+$/, /^border-white$/, /^border-black$/,
  // raw radius
  /^rounded-lg$/, /^rounded-xl$/, /^rounded-2xl$/, /^rounded-3xl$/, /^rounded-md$/, /^rounded-sm$/,
];

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function login(page) {
  console.log('\n[LOGIN] Navigating to login page...');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '00_login_page.png'), fullPage: true });
  console.log('[LOGIN] Login page loaded');

  await page.fill('input[type="email"], input[name="email"]', TEACHER_EMAIL);
  await page.fill('input[type="password"]', TEACHER_PASSWORD);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '00_login_filled.png'), fullPage: true });

  const submitBtn = page.locator('button[type="submit"]');
  if (await submitBtn.count() > 0) {
    await submitBtn.click();
  } else {
    await page.keyboard.press('Enter');
  }

  try {
    await page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 });
    console.log('[LOGIN] Login succeeded. URL:', page.url());
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '00_post_login.png'), fullPage: true });
    return true;
  } catch (e) {
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '00_login_failed.png'), fullPage: true });
    const errors = await page.locator('[class*="error"], [class*="alert"], .text-error').allTextContents();
    throw new Error(`Login failed. Page URL: ${page.url()}. Errors: ${errors.join(', ')}`);
  }
}

async function scanForViolations(page, pageName) {
  // This function runs in the browser context
  const violations = await page.evaluate((patterns) => {
    const results = [];
    const seen = new Set();
    const allElements = document.querySelectorAll('[class]');

    for (const el of allElements) {
      const classes = Array.from(el.classList);
      for (const cls of classes) {
        if (seen.has(cls)) continue;
        // Check against patterns
        let isViolation = false;
        for (const patternStr of patterns) {
          const re = new RegExp(patternStr);
          if (re.test(cls)) {
            isViolation = true;
            break;
          }
        }
        if (isViolation) {
          seen.add(cls);
          const elDesc = el.tagName.toLowerCase() +
            (el.id ? '#' + el.id : '') +
            (el.className ? '.' + Array.from(el.classList).slice(0, 2).join('.') : '');
          results.push({
            class: cls,
            element: elDesc.substring(0, 120),
            textContent: (el.textContent || '').trim().substring(0, 50)
          });
        }
      }
    }
    return results;
  }, VIOLATION_PATTERNS.map(p => p.source));

  return violations;
}

async function checkResponsiveOverflow(page) {
  return await page.evaluate(() => {
    const viewW = window.innerWidth;
    const bodyW = document.body.scrollWidth;
    const htmlW = document.documentElement.scrollWidth;

    const overflowingEls = [];
    for (const el of document.querySelectorAll('*')) {
      const rect = el.getBoundingClientRect();
      if (rect.right > viewW + 5) { // 5px tolerance
        overflowingEls.push({
          tag: el.tagName.toLowerCase(),
          classes: Array.from(el.classList).slice(0, 4).join(' '),
          right: Math.round(rect.right),
          left: Math.round(rect.left),
          viewportWidth: viewW
        });
      }
    }

    // Check tables specifically
    const tableScrollInfo = [];
    for (const container of document.querySelectorAll('[class*="overflow-x"]')) {
      const tables = container.querySelectorAll('table');
      if (tables.length > 0) {
        tableScrollInfo.push({
          containerClasses: Array.from(container.classList).slice(0, 5).join(' '),
          scrollWidth: container.scrollWidth,
          clientWidth: container.clientWidth,
          isScrollable: container.scrollWidth > container.clientWidth,
          tableCount: tables.length
        });
      }
    }

    return {
      viewportWidth: viewW,
      bodyScrollWidth: bodyW,
      htmlScrollWidth: htmlW,
      hasOverflow: bodyW > viewW + 5,
      overflowingElements: overflowingEls.slice(0, 15),
      tableScrollInfo
    };
  });
}

async function main() {
  await ensureDir(SCREENSHOTS_DIR);

  const allConsoleMessages = [];
  const results = {
    timestamp: new Date().toISOString(),
    login: null,
    x01: { status: null, violations: {} },
    x02: { status: null, responsive: {} },
    x03: { status: null, consoleMessages: [] }
  };

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-web-security', '--no-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  // Collect ALL console events
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    const url = page.url();
    // Log everything non-trivial
    if (type === 'error' || type === 'warn' || type === 'warning') {
      allConsoleMessages.push({ type, text, url, timestamp: new Date().toISOString() });
      console.log(`  [CONSOLE ${type.toUpperCase()}] ${url.replace(BASE_URL, '')}: ${text.substring(0, 150)}`);
    }
  });

  page.on('pageerror', err => {
    allConsoleMessages.push({
      type: 'pageerror',
      text: err.message,
      url: page.url(),
      timestamp: new Date().toISOString()
    });
    console.log(`  [PAGE ERROR] ${page.url()}: ${err.message.substring(0, 150)}`);
  });

  try {
    // ============================================================
    // STEP 1: LOGIN
    // ============================================================
    await login(page);
    results.login = 'PASS';

    // ============================================================
    // X-01: DESIGN TOKEN COMPLIANCE
    // ============================================================
    console.log('\n============================================================');
    console.log('X-01: DESIGN TOKEN COMPLIANCE SCAN');
    console.log('============================================================');

    const x01Pages = [
      { name: 'Student Dashboard', url: '/ap' },
      { name: 'Teacher Dashboard', url: '/ap/teacher' },
      { name: 'Gradebook', url: '/ap/gradebook' },
      { name: 'Class Manager', url: '/ap/teacher/classes' },
      { name: 'Analytics', url: '/ap/teacher/analytics/test_micro_full_1' },
      { name: 'Question Bank', url: '/ap/teacher/questions' },
      { name: 'Report Card', url: '/ap/results/result_micro_student1' },
      { name: 'Test Editor', url: '/ap/teacher/test/test_micro_full_1/edit' },
    ];

    let totalViolations = 0;
    for (const pg of x01Pages) {
      await page.goto(`${BASE_URL}${pg.url}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);

      const screenshotName = `x01_${pg.name.toLowerCase().replace(/ /g, '_')}.png`;
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, screenshotName), fullPage: true });

      const violations = await scanForViolations(page, pg.name);
      results.x01.violations[pg.name] = violations;
      totalViolations += violations.length;

      if (violations.length === 0) {
        console.log(`[X-01] ${pg.name}: CLEAN (0 violations)`);
      } else {
        console.log(`[X-01] ${pg.name}: ${violations.length} VIOLATION(S) FOUND:`);
        violations.forEach(v => {
          console.log(`       Class: "${v.class}" on <${v.element}> (text: "${v.textContent}")`);
        });
      }
    }

    results.x01.status = totalViolations === 0 ? 'PASS' : 'PARTIAL';
    console.log(`\n[X-01] TOTAL VIOLATIONS: ${totalViolations}`);

    // ============================================================
    // X-02: RESPONSIVE LAYOUT
    // ============================================================
    console.log('\n============================================================');
    console.log('X-02: RESPONSIVE LAYOUT CHECK');
    console.log('============================================================');

    const x02Pages = [
      { name: 'Student Dashboard', url: '/ap' },
      { name: 'Teacher Dashboard', url: '/ap/teacher' },
      { name: 'Gradebook', url: '/ap/gradebook' },
      { name: 'Class Manager', url: '/ap/teacher/classes' },
      { name: 'Report Card', url: '/ap/results/result_micro_student1' },
    ];

    const viewports = [
      { width: 375, height: 812, label: 'mobile_375' },
      { width: 768, height: 1024, label: 'tablet_768' },
      { width: 1440, height: 900, label: 'desktop_1440' },
    ];

    let responsiveIssues = [];

    for (const vp of viewports) {
      results.x02.responsive[vp.label] = {};
      console.log(`\n-- ${vp.label} (${vp.width}x${vp.height}) --`);

      for (const rp of x02Pages) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`${BASE_URL}${rp.url}`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2500);

        const screenshotName = `x02_${vp.label}_${rp.name.toLowerCase().replace(/ /g, '_')}.png`;
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, screenshotName),
          fullPage: false  // viewport-only screenshot is more realistic
        });

        const overflowInfo = await checkResponsiveOverflow(page);
        results.x02.responsive[vp.label][rp.name] = overflowInfo;

        const status = overflowInfo.hasOverflow ? 'OVERFLOW' : 'OK';
        console.log(`  [${status}] ${rp.name} at ${vp.width}px`);
        if (overflowInfo.hasOverflow) {
          responsiveIssues.push(`${rp.name} at ${vp.width}px has horizontal overflow (body=${overflowInfo.bodyScrollWidth})`);
          overflowInfo.overflowingElements.slice(0, 3).forEach(e =>
            console.log(`         Overflow: <${e.tag} class="${e.classes}"> right=${e.right}px`)
          );
        }
        if (overflowInfo.tableScrollInfo.length > 0) {
          overflowInfo.tableScrollInfo.forEach(t => {
            if (t.isScrollable) {
              console.log(`         Table in .${t.containerClasses}: scrollWidth=${t.scrollWidth}, clientWidth=${t.clientWidth} [SCROLLABLE - check affordance]`);
            }
          });
        }
      }
    }

    // Reset viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    results.x02.status = responsiveIssues.length === 0 ? 'PASS' : 'PARTIAL';

    // ============================================================
    // X-03: CONSOLE ERROR AUDIT
    // ============================================================
    console.log('\n============================================================');
    console.log('X-03: CONSOLE ERROR AUDIT');
    console.log('============================================================');

    // Navigate through additional pages to catch late-loading errors
    const x03Routes = [
      '/ap',
      '/ap/teacher',
      '/ap/gradebook',
      '/ap/teacher/classes',
      '/ap/teacher/analytics/test_micro_full_1',
      '/ap/teacher/questions',
      '/ap/results/result_micro_student1',
    ];

    console.log('Navigating through routes to collect console messages...');
    for (const route of x03Routes) {
      await page.goto(`${BASE_URL}${route}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2500);
      console.log(`  Visited: ${route} - collected ${allConsoleMessages.filter(m => m.url.includes(route)).length} messages`);
    }

    results.x03.consoleMessages = allConsoleMessages;
    results.x03.status = allConsoleMessages.length === 0 ? 'PASS' : (allConsoleMessages.filter(m => m.type === 'pageerror' || m.type === 'error').length > 0 ? 'FAIL' : 'PARTIAL');

    const errors = allConsoleMessages.filter(m => m.type === 'error' || m.type === 'pageerror');
    const warnings = allConsoleMessages.filter(m => m.type === 'warn' || m.type === 'warning');
    console.log(`\n[X-03] Errors: ${errors.length}, Warnings: ${warnings.length}`);

  } catch (err) {
    console.error('\nFATAL ERROR:', err.message);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'FATAL_ERROR.png'), fullPage: true });
    results.fatalError = err.message;
  } finally {
    await browser.close();
  }

  // Save results
  const outFile = path.join(SCREENSHOTS_DIR, 'b11_fresh_results.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log('\n\nResults saved to:', outFile);

  // Print final summary
  console.log('\n====== FINAL SUMMARY ======');
  console.log(`Login: ${results.login}`);
  console.log(`X-01 Status: ${results.x01.status}`);
  console.log(`X-02 Status: ${results.x02.status}`);
  console.log(`X-03 Status: ${results.x03.status}`);

  const violationCount = Object.values(results.x01.violations).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`\nX-01 Total violations found: ${violationCount}`);
  for (const [pg, viols] of Object.entries(results.x01.violations)) {
    if (viols.length > 0) {
      console.log(`  ${pg}: ${viols.map(v => v.class).join(', ')}`);
    }
  }

  const overflowPages = [];
  for (const [vp, pages] of Object.entries(results.x02.responsive)) {
    for (const [pg, data] of Object.entries(pages)) {
      if (data.hasOverflow) overflowPages.push(`${pg}@${vp}`);
    }
  }
  console.log(`\nX-02 Overflow pages: ${overflowPages.length > 0 ? overflowPages.join(', ') : 'None'}`);
  console.log(`\nX-03 Console errors: ${results.x03.consoleMessages.filter(m => m.type === 'error' || m.type === 'pageerror').length}`);
  console.log(`X-03 Console warnings: ${results.x03.consoleMessages.filter(m => m.type === 'warn' || m.type === 'warning').length}`);

  return results;
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
